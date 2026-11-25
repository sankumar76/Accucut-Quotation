# Moving the portal's data between targets

| Field | Value |
|-------|-------|
| Version | 0.1 (2026-11-23) |
| Owner | solution-architect |
| Status | Design for Hosting release H1 (DL-350, PRD H1-N3). The tooling is H1 row 12 ([hosting-h1-dual-target.md](hosting-h1-dual-target.md)). Rehearsed in both directions before H1 ships |
| Decision | [ADR-021](adr/ADR-021-deployment-targets.md): one codebase, two set-ups; data moves by database export and import |
| Applies to | `accucut-server` (Windows, ADR-015) to `web-host`, `web-host` to `accucut-server`, and one web provider to another |

**In one paragraph.** A move is a **restore into a new, empty database on the other target**, using the format the portal already uses for backups: `pg_dump -Fc` of schema `public`, encrypted with `age`, with a manifest. The source stops writing first, so there is only one writer. The target gets the same release and roles before the import. The move is checked by counts and checksums, then the portal opens on the target. The source is kept, stopped and untouched, so going back is a restart until people write on the target.

---

## 1. Why this shape

- **Single writer.** Pending e-mails in the outbox, job idempotency keys and estimate code counters (`task_sequences`) are all rows. If both targets ran at once, mail could go twice and estimate codes could collide. So the source stops before the export, and nothing is merged.
- **One format.** A Windows weekly copy and a web-host weekly copy are the same thing: `pg_dump -Fc | age`, with a manifest. So a move is "back up here, restore there". The restore safety rules of architecture section 9.5 carry over: restore into a **new** database, never a half-restored portal, and record the restore outside the database.
- **Whole database, schema `public` only.** The portal uses no other schema, no extension and no sequence. Counters are rows in `task_sequences`. Pictures are rows in `part_images` (ADR-013). Taking `public` only leaves out a provider's own schemas, such as Supabase's `auth`, `storage` and `extensions`.
- **Privileges must travel.** The migrations carry per-table `GRANT` and `REVOKE` statements. For example, `audit_log`, `calculations` and `part_images` revoke `UPDATE`, `DELETE` and `TRUNCATE` from `accucut_app`. So the dump keeps its privileges. That works because **both targets have the same three role names** (`deploy/db/create-roles.psql`). Ownership does not need to travel: every object is owned by `accucut_owner`, which is the role that runs the import.
- **Triggers are safe on an empty database.** `pg_dump` puts triggers in the post-data section, so the forbid-change and forbid-truncate triggers are created after the rows are loaded. They never fire during the import. An import into a database that already holds the portal would hit them, which is one more reason the target must be new.

---

## 2. What moves and what does not (answers OQ-PM-16 (c))

| Moves (inside the database) | Does not move (per target) |
|-----------------------------|----------------------------|
| Users and their argon2id password hashes, roles and `session_version` | **Secrets:** `AUTH_SECRET`, database passwords, mail credentials, `JOBS_SECRET`, bucket keys. Each target has its own (ADR-021 SEC-4) |
| Every task, estimate, node, calculation and calculation row, approval, price and reason, download log | **Sessions:** the target's `AUTH_SECRET` differs, so everyone signs in again |
| The audit log, complete and in order | **Sign-in throttle counters:** their keys are HMACs under the source's `AUTH_SECRET`, so they mean nothing on the target. They are deleted after the import (step 8) |
| Part pictures (`part_images`, ADR-013): there is no separate file store | **Logs:** they stay where they were written and are kept by that target's retention (NFR-024) |
| Master data, customers and customer rates, the configuration versions and checkpoints | **The source's backup copies:** they stay with the source. They are kept by the source's retention, and can still restore the source |
| `job_runs`, the e-mail outbox (unsent mail is sent by the target), `task_sequences`, `_prisma_migrations` | Settings files (`.env`), WinSW and JEA files, scheduler entries |

---

## 3. Preconditions (all must hold; the script checks the ones marked *)

1. **Same release on both sides.*** The target runs the same release tag as the source, so `_prisma_migrations` heads match. To move and upgrade, move first, then run the target's normal update.
2. **Same PostgreSQL major version: 17.*** `pg_restore` cannot reliably restore an archive made by a newer major version into an older one. Both targets are upgraded together (ADR-021 PI-4). Use the `pg_dump` and `pg_restore` binaries of major version 17.
3. **Target database new and empty**, encoding UTF8.* Roles are created by `create-roles.psql` (on a managed database, its no-superuser variant from H1 spike S-3). **No `migrate deploy`, `ensure-seed-version` or `bootstrap-admin` runs on the target before the import.**
4. **"No foreign grants" holds on the source.*** No role outside `accucut_owner`, `accucut_app` and `accucut_backup` has a privilege on a table in `public`. If one does, the import refuses on the other side (step 7 uses `--exit-on-error`), so fix the source first.
5. A **maintenance window** was announced to the portal's users (about 1 to 2 hours).
6. The **Admin's `age` key** is available on the operator machine for the import. The public recipient is enough for the export.
7. The operator machine has PostgreSQL 17 client tools and Node 22, and reaches both databases over TLS (`sslmode=verify-full` for a managed database).

---

## 4. The steps

Run by Accucut IT or the delivery lead, with the Admin for the key. "Source" and "target" are the two set-ups.

| Step | What | How | Checks |
|------|------|-----|--------|
| 1 | **Close the source** | Windows: stop `AccucutApp` and `AccucutWorker`, and disable the weekly backup task for the window. Web host: take the deployment off its domain or scale it to zero, and pause the scheduler entries | `/api/health` on the source does not answer; `SELECT count(*) FROM pg_stat_activity WHERE usename = 'accucut_app'` is 0 |
| 2 | **Take a normal backup of the source** | Windows: `backup.ps1` (a "release" copy). Web host: the weekly copy job, run once by hand | A manifest is written; this copy is the source's fallback |
| 3 | **Write the source manifest** | `node scripts/data-move.js manifest --url <source owner URL>` reads, for every table in `public`: the row count; an MD5 over the rows ordered by primary key; the `task_sequences` rows; the migration head; the server major version; table privileges; trigger names. It writes **counts, hashes and names only, never row data** | The script refuses if any precondition marked * fails |
| 4 | **Export** | `pg_dump --format=custom --schema=public --no-owner --file=- \| age -r <recipient> > accucut-move-<UTC>.age`. On Windows, the same byte pipe as `backup.ps1` (no PowerShell 5.1 pipeline, ADR-015 Amendment 3.1) | Both exit codes 0; SHA-256 of the file recorded in the manifest |
| 5 | **Carry the file** | On encrypted storage under Accucut's control. **Never** through CI artefacts, the public repository, e-mail or chat (RISK-006) | SHA-256 matches on arrival |
| 6 | **Prepare the target** | Create the empty database and the three roles (precondition 3) | The database exists with no tables in `public` |
| 7 | **Import** | Decrypt with `age -d -i - accucut-move-<UTC>.age`, with the key on standard input as in `restore.ps1`, never on a command line. First pipe it to `pg_restore --list` and remove the `SCHEMA public` and `COMMENT ON SCHEMA public` entries from that list, because `public` already exists on the target. Then pipe it again to `pg_restore --use-list <list> --dbname <target owner URL> --no-owner --single-transaction --exit-on-error`, connected as `accucut_owner` | Exit code 0. Because of `--single-transaction`, a failure leaves the target empty: correct the cause and repeat from step 6 |
| 8 | **Clean the per-target rows** | As `accucut_owner`: `DELETE FROM login_throttles;` | — |
| 9 | **Verify** | `node scripts/data-move.js verify --manifest <file> --url <target owner URL>` compares everything step 3 recorded, except `login_throttles`, whose count is now 0 by design | All equal. See section 5 |
| 10 | **Open the target** | Start the app and jobs on the target with **its** secrets and `DEPLOY_TARGET`. Run the smoke checks in section 5. Take the first target backup at once, so the Settings "Last backup" line shows a backup of the target, not the source's last one | The smoke checks pass |
| 11 | **Point people at the target** | DNS or the bookmark or shortcut; tell the users. From here on, the target holds the only current data | — |
| 12 | **Keep the source closed** | Leave the source database and its backups untouched and its services disabled, for the period in section 7 | — |

---

## 5. Verification

**Data (step 9, all must be equal between the manifest and the target):**
- The row count of every table in `public`.
- The ordered MD5 of every table. At this size it takes seconds, pictures included.
- The `task_sequences` rows, so the next estimate code continues without a gap or a repeat.
- The migration head in `_prisma_migrations`, and `prisma migrate status` from the target's release, which reports "up to date".
- Table privileges per role (`information_schema.role_table_grants`) and the **"no foreign grants" query**, which returns no rows.
- The trigger names on every table (the forbid-change, forbid-truncate and same-estimate triggers).

**Portal (step 10, smoke):**
1. `/api/health` is 200; the database is reachable; on the web host, the client address seen is the caller's (check C5 under `CLIENT_ADDRESS_SOURCE`).
2. The Admin signs in with their **existing** password (the hashes moved).
3. Open a known estimate. Its figures and pictures show, and its last audit entry is the one in the manifest.
4. Download its Excel file. It opens, and a new download record is written.
5. Settings shows the backup lines. The jobs heartbeat appears within 3 minutes. If mail is on, an unsent outbox item is sent once.
6. An Engineer test account cannot see cost data (NFR-002 spot check).

---

## 6. Collation and text

The databases on the two targets may have different locales: Windows uses a Windows locale name, and a managed database usually uses `en_US.UTF-8` or `C.UTF-8`. `pg_restore` rebuilds every index, so nothing is corrupted. But two customer short names that differ only in a non-ASCII letter could fold to the same `lower(short_name)` under the target's rules. The unique index would then refuse the import. `--exit-on-error` and `--single-transaction` stop that safely, and the fix is to rename one customer on the source and repeat. Sort order in lists may differ slightly between targets. **Rule (ADR-021 PI-4):** both databases use UTF8. H1 rehearses the move both ways on data with Indian names and non-ASCII letters.

---

## 7. Rollback

| When | Rollback |
|------|----------|
| Before step 11 (nobody has written on the target) | Stop the target. Start the source services again (step 1 in reverse) and re-enable its scheduler or backup task. Nothing is lost. Drop the target database when convenient |
| After step 11 (people have written on the target) | **There is no merge.** Going back is a new move in the other direction, by this same procedure, with its own window. The source's old data is replaced, not merged. Its backups from before the move stay as they were |
| The import fails (step 7) | The target is empty (single transaction). Correct the cause and repeat from step 6. The source is still closed, so either repeat now or restart the source |
| The checks fail (step 9 or 10) | Do not open the target. Restart the source. Keep the target's database for diagnosis, then drop it |

**How long to keep the closed source:** at least 14 days and at least one good backup on the target. The delivery lead decides when it is removed. If the old target stays as a standby (OQ-ARCH-H1-2), keep it closed: a running standby with old data invites writes that cannot be merged. A Windows standby keeps its backup task off and its services disabled.

---

## 8. Moving between two web providers

The same steps, with both ends `web-host`. Only the target's settings change (database URL, `CLIENT_ADDRESS_SOURCE`, bucket and scheduler). There is no code change (ADR-021 PI-7).

## 9. What H1 builds and rehearses

- `scripts/data-move.ts`, a small Node script (manifest and verify only; `pg_dump`, `pg_restore` and `age` stay the vendors' binaries). It is built into both artefacts and has unit tests on a CI database.
- A Windows wrapper section in `deploy/windows/README.md`, and `deploy/web-host/README.md`.
- Two timed rehearsals on staging, Windows to web and web to Windows, with the results recorded. This also proves NFR-013's RTO on the web host.
- **To prove in H1 spike S-5 (not verified today):**
  - Whether `pg_restore` accepts `--use-list` on a piped, non-seekable input. If it refuses, the alternative is decrypting to a temporary file on encrypted storage that is deleted after step 9.
  - Whether the step 7 list filter is needed at all, depending on how `pg_dump` 17 writes schema `public` under `--schema=public`.
  - Whether `restore.ps1` accepts a copy whose manifest was written on the web host.
