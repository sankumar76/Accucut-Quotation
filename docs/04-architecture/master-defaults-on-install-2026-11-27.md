# Master data defaults on a fresh install (design note, 2026-11-27)

| Field | Value |
|-------|-------|
| Status | **PARKED.** Parked 27 Nov at the delivery lead's request (DL to follow); not scheduled. The customer enters the masters by hand. G-MD-1 (README first-use line) still goes in before the freeze. Q-MD-1 (section 7) is overtaken by the parking. Before parking: Proposed, design only, no product code |
| Author | solution-architect |
| Request | The delivery lead, 2026-11-27 (relayed by the orchestrator, Jira AQP-1): a fresh install should start with default values in the Process Master and the Material Master |
| As built | `origin/master` 744a8fa5 |
| Related | ADR-014 (master data outside the repository), ADR-015 (Windows runtime), ADR-018 (`recordMany`), ADR-021 (two set-ups); architecture 5.5, 5.6, 8 ("First Admin", "Emergency Admin password reset"), 9.9; SPEC 4.1 to 4.5, 7.4, D-23, D-38, D-39, D-40; HOLD-01; DL-008, DL-380; NFR-002, NFR-006, NFR-011 |
| Source of the values | **The delivery lead's defaults sheet (held outside the repo).** No value from it appears in this note, and none may appear in any repository file, Jira, GitHub, a commit message or CI. This note maps rows by name and unit only |

## 1. Summary of the decisions

1. **Not in the repository.** The repository is public (checked on 2026-11-27 with `gh repo view --json visibility`: `PUBLIC`). ADR-014 (Accepted) and the delivery lead's own D-38 already say that real defaults never enter it. This is settled, so no question is asked about it (section 4).
2. **A defaults file supplied at install.** It is a small JSON file that the delivery lead or the Admin keeps in Accucut-controlled storage (HOLD-01). `install.ps1 -MasterDefaultsFile <path>` checks the file before anything is created, then loads it once, after the first Admin exists and before the services start. Without the parameter, the install behaves as it does today: every rate is 0 and the Material Master is empty.
3. **One loader, guarded in the database.** It is a new mode, `--load-master-defaults <file>`, of the packaged `bootstrap-admin.mjs`, the same pattern as DL-380's `--reset-admin-password`. Inside one transaction under an advisory lock, it loads only if the masters are untouched ("fresh", section 3.2). Otherwise it changes nothing and exits 3. So it is idempotent, it can never overwrite or merge into a live database, and it behaves the same on the Windows package and on a Docker or web host. `update.ps1`, `restore.ps1` and the `migrate` step never call it.
4. **Audit, with no new event type.** The load writes 15 `master.edited` entries (`object_type` `process_item`) and one `master.created` entry per material, using the existing shapes. They are written with `recordMany` and share one `request_id`. `actor_id` is the first Admin, the only user the row can name. `actor_label` is `System: install defaults (Windows account <DOMAIN>\<user>)`, following DL-380's precedent. No configuration version is created, because rates are not part of the field registry.
5. **Mapping.** All 15 sheet rows match the 15 seed items exactly, with the same names and units. The 3 materials fit the Material Master with no schema change. Plating is answered by the SPEC (section 5.2): it is **one** rate. "15" is the total number of rates, not 15 plating rates. No formula reads it (D-40), so its default changes no figure. No migration and no `/estimates/[code]` change are needed.
6. **Effort:** about **14.5 developer-hours**, plus about 2 hours for the combined review (CLAUDE.md section 9 item 2, because the loader writes data). It is feasible before the freeze only if a lane starts by the end of Mon 30 Nov. **Q-MD-1** asks the delivery lead whether to build it before the freeze or right after G8 (section 7).

## 2. What exists today (as built at 744a8fa5)

| Item | As built | Source |
|------|----------|--------|
| The 15 Process Master items | Inserted by migration `20261106182200_process_items` on every environment, with fixed IDs `00000000-0000-4000-8000-0004000000NN` (01 to 15), names and units, and `default_value` 0 | Migration header; `prisma/seed/config/seed-ids.ts` |
| Materials | Table created empty. Only the hidden system row "Not applicable" (`…000500000001`) is inserted (migration `20261114140000_not_applicable_entries`). Unique on `lower(material_in_drawing)`. The checks are: price and scrap rate 0 or more, specific gravity above 0, Material Considered not blank | Migrations `20261108100000_materials`, `20261114140000_…` |
| Treatment / colour list | "Other" (system, visible) and "Not applicable" (system, hidden) are inserted by migration | Migrations `20261110120000_treatments`, `20261114140000_…` |
| Exchange rates | Table created empty. `updated_by` is NOT NULL with a foreign key to `users`. Only USD and EUR are allowed | Migration `20261110040000_exchange_rates` |
| `prisma/seed` | Only the guard (refuses `NODE_ENV=production`) and empty placeholder collections. It holds no real-data path | `prisma/seed/index.ts`, `guard.ts`, `placeholders/index.ts` |
| `ensure-seed-version` | Runs in `Invoke-AccucutMigration` after `prisma migrate deploy` on install, update and restore. It writes configuration version 1 only if none exists. It holds structure, not master data | `scripts/ensure-seed-version.ts`; `AccucutOps.psm1` `Invoke-AccucutMigration` |
| Install order | Checks and values, then database and roles, then `Invoke-AccucutMigration`, then `bootstrap-admin.mjs` (runtime role), then backup account, services, start and `/api/health` | `deploy/windows/install.ps1` |
| Audit | `actor_id` NOT NULL with a foreign key to `users`, and no system user. `bootstrap:admin` writes no entry. DL-380's emergency reset writes the Admin's ID with a `System: server command (…)` label | Architecture 8 |
| Importer of ADR-014 option 2 (`import:masters`) | **Never built.** There is no such script in `package.json` | `package.json` |
| README first-use step | Architecture 5.6 "One limit" requires the README to say "enter all 15 before any estimate is calculated". **The README has no such row** (gap G-MD-1, section 8) | `deploy/windows/README.md` |
| Docker | Only `compose.dev.yml` (development). The web-host set-up is H1, after G8, design only (ADR-021) | `compose.dev.yml`; ADR-021 |

## 3. Point 1: the load mechanism

### 3.1 Entry point: reuse the `bootstrap-admin` step

The loader is a mode of `scripts/bootstrap-admin.ts`, which is packaged as `app\bootstrap-admin.mjs`:

- `--check-master-defaults <file>` parses and validates the file only. It opens no database connection.
- `--load-master-defaults <file>` validates, then loads in one transaction.

**Why a mode and not a new script.** DL-380 chose a mode for the same reasons, and they still hold:
- `package-windows.ps1` already bundles this entry with the `react-server` condition that the audit service needs.
- The install already runs it with the runtime role's `DATABASE_URL`.
- It needs no new load site, no trust-block change and no new packaged program.

`ensure-seed-version` is rejected as the home for this. It runs in `Invoke-AccucutMigration`, which `update.ps1` and the restore also call, so a defaults load there would run on every update and every restore. It also runs before any user exists, so the audit row could name no actor.

**Exit codes** (in a new `scripts/lib/master-defaults-cli.ts`, worded like `admin-password-reset-cli.ts`):

| Code | Meaning |
|------|---------|
| 0 | Loaded, or (check mode) the file is valid |
| 1 | Failed (database error). Nothing changed: the transaction rolled back |
| 2 | Not exactly one active Admin. Run the first-Admin step first |
| 3 | **Not fresh: the masters already hold data. Nothing changed.** This is the idempotent outcome of a re-run |
| 4 | Usage error, or the file is invalid. The message names the field and the rule, **never a value** |

Output is counts and the file's SHA-256 only. Example: `master defaults: 15 rates and 3 materials loaded (file sha256 <hex>)`. No rate is ever printed or logged (NFR-002, ADR-014).

### 3.2 The "fresh" rule (the guard lives in the database, not in the installer)

In one transaction:
1. `SELECT pg_advisory_xact_lock(<fixed constant>)`, so two runs cannot interleave. The runtime role needs no extra right for this.
2. The masters are **fresh** only if all of these hold:
   - **F1.** `process_items` holds exactly the 15 seed IDs and no other row, each with `default_value = 0`.
   - **F2.** `materials` holds no row with `is_system = false`, soft-deleted rows included.
   - **F3.** `customers` holds no row.
   - **F4.** `audit_log` holds no row whose `object_type` is `process_item`, `material` or `customer`.
   - **F5.** `calculations` holds no row. A calculation priced at 0 would otherwise later report "rates changed" (`ratesChangedSince`).
3. If any check fails, the loader rolls back and exits 3, naming which check failed. Otherwise it continues:
   - It updates the 15 rows by seed ID. A value of 0 in the file writes nothing for that row, as a no-op save writes nothing today.
   - It inserts the materials.
   - It appends the audit entries.
   - It commits.

**Idempotency.** After a successful load, F1 (values) and F4 (audit) fail, so any re-run exits 3 and changes nothing. A file of all zeros and no materials writes nothing, so its re-run is also a no-op. **A live database can never be overwritten or merged into.** One Admin edit on SCR-11 or SCR-13, one customer or one calculation is enough to make the loader refuse.

The writes go through the existing repository methods and services, which hold the screens' own rules (name rules, decimal places, the reserved name "Not applicable", case-insensitive uniqueness). The database CHECKs are the backstop. No raw insert bypasses them.

### 3.3 Windows package (`install.ps1`)

- **New optional parameter `-MasterDefaultsFile <path>`.** It is a parameter and not a `-ValuesFile` line, because `Split-AccucutEnvValues` copies values-file lines into `.env`, and the defaults have no place there.
- **Checked before anything is created**, next to "the values" step ("so a typing slip costs nothing"):
  - The path is absolute and the file exists.
  - The file is 64 KB or smaller.
  - The file is not under the install root.
  - Then `node app\bootstrap-admin.mjs --check-master-defaults <path>` must exit 0. With any other code, the install stops with that message and nothing has been changed.
- **Loaded right after `bootstrap-admin.mjs`**, before the backup account, the services and the first start, so no person can sign in during the load. The command is `--load-master-defaults <path>` with `DATABASE_URL` from the install's values and `NODE_ENV=production`. At install, any code other than 0 is an install error. Exit 3 cannot happen on a database the install has just created.
- **Install log:** the counts and the SHA-256 only. The operator can compare the hash with one they computed on their own PC. The file is never copied into `C:\Accucut`. The README tells them to keep it in Accucut-controlled storage and to delete any other copy (ADR-014, HOLD-01).
- **The trust block, `update.ps1`, `restore.ps1` and `Invoke-AccucutMigration` are unchanged.**

### 3.4 Docker Compose and the web host (H1, after G8: design only)

The same mode runs as a one-off, after the first Admin exists:

```
docker compose run --rm -v <path-on-host>:/run/defaults/master-defaults.json:ro app node bootstrap-admin.mjs --load-master-defaults /run/defaults/master-defaults.json
```

On a managed web host, the operator runs it once from the host's one-off shell, or from their own PC against the managed database, with the file supplied for that run only. **It is never stored as a CI variable, a GitHub secret or an image layer** (ADR-014). Because the guard is in the database (3.2), both set-ups behave the same: fresh means load, anything else means exit 3. The H1 README (`deploy/web-host/README.md`, to be written in H1) gets the same step. This note adds one row to [hosting-h1-dual-target.md](hosting-h1-dual-target.md) when H1 starts. No H1 work happens before then (ADR-021 entry criterion).

### 3.5 Restore and upgrade

| Path | What happens to the masters | Why |
|------|-----------------------------|-----|
| **Restore** (architecture 9.9, `restore.ps1`) | The dump's masters win entirely. The loader does not run | `restore.ps1` calls `Invoke-AccucutMigration` only. Even if someone ran the loader by hand afterwards, F1 to F5 fail on any restored production data, so it exits 3 |
| **Upgrade** (`update.ps1`) | Never touched | `update.ps1` does not call the loader. Migrations carry no values (ADR-014). `ensure-seed-version` touches only configuration version 1, and only if none exists |
| **Re-install on a new server** | Either restore a backup (the masters come with it) or install with the file onto an empty database | `install.ps1` refuses an existing `accucut` database |
| **Development, CI, staging** | Unchanged: placeholders from `prisma/seed/placeholders/`. Integration tests use invented files (section 6.2) | ADR-014 |

### 3.6 Audit log and version history

- **Actor.** `actor_id` is the one active Admin. It is NOT NULL with a foreign key to `users`, and no system user exists (DL-380 rejected adding one). `actor_label` is `System: install defaults (Windows account <USERDOMAIN>\<user>)`, cut to 200 characters. On Linux it is `System: install defaults (account <user>)`, using the same `windowsAccountName` helper as the emergency reset. So SCR-16 shows a system act, not a person's edit, and the Who filter (by `actor_id`) still finds it under the Admin.
- **Entries:**
  - One `master.edited` per rate whose value changes, `object_type` `process_item`, with `before {name, unit, defaultValue: "0.00"}` and `after {…, defaultValue}`. This is the existing `processItemState` shape.
  - One `master.created` per material, `object_type` `material`, using the existing `materialState` shape.
  - All are written by one `AuditService.recordMany` call (ADR-018), inside the load's transaction and under one `request_id`.
  - **No new event type, no new SCR-16 words and no schema change.**
- **Values in the log.** ADR-014 had said the importer's entry would hold "counts only". This design deliberately departs from that (ADR-014 amendment 1, section 8). The audit log is in the same Restricted, Admin-only database that holds the rates themselves. Every Admin edit already logs values there. Per-item entries give each rate a history that starts with its default. A counts-only entry would need a new event type and new UX words for no added safety.
- **Configuration versions.** None is created. `config_versions` holds the field registry (formulas), which this does not touch. `ensure-seed-version` still writes version 1 as today. Rates have no version table: the audit log is their history, and every calculation's `master_snapshot` freezes the rates it used (architecture v0.49).
- **Customers.** None exist (F3), so no propagation runs. A customer created later copies the loaded defaults (SPEC 4.2 rule 1).

## 4. Point 2: confidentiality

**Finding: the real rates cannot sit in the repository. This is not a genuine choice under the decisions in force, so no question is asked.**

| Fact | Evidence |
|------|----------|
| The repository is public | `gh repo view --json visibility` gives `{"isPrivate":false,"visibility":"PUBLIC"}` (2026-11-27). D-13 and DL-008: it stays public by the delivery lead's decision |
| Real defaults never enter it | ADR-014 (Accepted at G3); architecture 5.5 "Never: in `prisma/seed`, tests, fixtures, documents, Jira, GitHub, CI variables, logs or chat" |
| The delivery lead decided the same for these very values | SPEC D-38: "Default values are not recorded anywhere in the repository, Jira or GitHub" |
| NFR-002 | It keeps material and customer rates from the portal's own Engineers. Rates on a public GitHub would be readable by those Engineers and by anyone else, and a published value cannot be recalled (ADR-021) |
| NFR-006 | No real customer data in code, tests, fixtures or documents |
| The CI cost-confidentiality scan would **not** catch them | That scan (`tests/e2e/canary-scan.spec.ts`, ADR-008 layer 5) checks what an Engineer receives from a running app, not repository content. The repository-side controls are Gitleaks (stage 2), which finds secrets and not rates, and the stage 3 data-file allow-list. Stage 3 would refuse a new `.json` or `.csv` outside its allow-list, but not numbers typed into a `.ts` file. The placeholder-pattern test covers only `prisma/seed/placeholders/`. So keeping values out rests on the rule, not on a scan |
| Removing them later | It needs a history rewrite, which only the delivery lead can authorise. Forks and caches may already hold them |

Putting them in the repository would mean the delivery lead reversing their own D-38, together with ADR-014. This note does not recommend that and does not ask it.

### 4.1 The defaults file

**Format** (`accucut-master-defaults`, version 1; UTF-8 JSON, 64 KB or smaller):

```json
{
  "format": "accucut-master-defaults",
  "version": 1,
  "processRates": [
    { "name": "Cutting-Rate-per-Sec", "unit": "per second", "defaultValue": null }
  ],
  "materials": [
    { "materialInDrawing": "<name>", "materialConsidered": "<name>", "pricePerKg": null, "specificGravity": null, "scrapRate": null }
  ]
}
```

**Template.** `deploy/windows/master-defaults.example.json` lists the 15 names and units with every value `null`, and one material row of `null`s. Names and units are structure and may be committed (ADR-014). Every value is `null`, and the loader refuses `null`, so **an unfilled template cannot load**. The template needs one entry in the stage 3 allow-list (`scripts/lib/data-files.ts`) and one in `package-windows.ps1`'s file list. The delivery lead or the Admin fills in a copy outside the repository.

**Validation**, all before any write:
- `format` and `version` must match exactly.
- **`processRates`:**
  - It holds exactly the 15 seed names, each once, matched exactly (case and spaces included). A new rate name is refused: adding rates is the Admin's job on SCR-11 (FR-012).
  - `unit` must equal the seed unit. It is checked, never changed.
  - `defaultValue` must be a **decimal string** (for example `"12.50"`), never a JSON number, so that no binary rounding can creep in. It is checked by the SCR-11 rule (0 or more, up to 2 decimals).
  - Percent rates are written as the percentage itself (`"12"` means 12 %, as on SCR-11).
- **`materials`:**
  - From 0 to 500 rows (NFR-011).
  - Each is checked by the SCR-13 rules: names not blank, unique without regard to case (both within the file and against the hidden row), not the reserved "Not applicable".
  - Price and scrap rate are decimal strings, 0 or more. Specific gravity is above 0.
- **Placeholder refusal:** in production, a file in which every number follows the invented `n.37` pattern is refused, so a development fixture cannot be installed by mistake. This follows ADR-014's "seeding refuses placeholders in production".
- **Unknown keys:** any unknown key is refused (strict schemas), so a misspelt field cannot be silently dropped.

**Where it lives.** It stays in Accucut-controlled storage held by the delivery lead or the Admin (HOLD-01, met 2026-11-01). It is passed to the install by path only. It is never sent through Jira, GitHub, CI, e-mail to the team or chat.

**When it is absent.** The install runs exactly as today and adds one log line: "No master defaults file was given. The 15 rates are 0 and the Material Master is empty. Enter them on Process master and Materials and lists before anyone calculates an estimate." The README first-use row (G-MD-1) says the same.

## 5. Point 3: mapping

### 5.1 Process Master: every row maps to a seed item, by name and unit

| Sheet row (left-column label) | Sheet rate name | Unit | Seed ID suffix | Portal formula that reads it (SPEC 7.4) | Sheet "Used in" | Note |
|---|---|---|---|---|---|---|
| CUTTING COST | `Cutting-Rate-per-Sec` | per second | …01 | AL | AI | Same name and unit |
| BENDING COST | `Bending-Rate-per-stroke` | per stroke | …02 | AM | AJ | Same |
| DRILLING/TAPPING | `Drilling-Tapping-Rate` | per hole | …03 | AN | AK | Same |
| WELDING COST | `Welding-rate-per-kg` | per kg | …04 | AO | AL | Same |
| HOT DIP GALVANIZING | `Dip-Galvanizing-Cost-per-kg` | per kg | …05 | AQ | AN | Same |
| PRIMER | `Primer-rate-per-sqft` | per sq ft | …06 | AR | AO | Same |
| SHOT BLASTING | `Shot-Blasting-rate-per-kg` | per kg | …07 | AS | AP | Same |
| POLISHING | `Polishing-rate-per-sqin` | per sq in | …08 | AT | AQ | Same |
| PLATING | `Plating-rate-per-sqin` | per sq in | …09 | **none** (D-40) | none (yellow row) | Same. See 5.2 |
| POWDER COATING | `Powder-rate-per-sqft` | per sq ft | …10 | AV | AS | Same |
| FOAM | `Foam Cost` | per sq ft | …11 | AW | AT | Same |
| SOFT ANODIZE | `Soft-Anodize-rate-per-sqin` | per sq in | …12 | AX | AU | Same |
| (no label) | `OH Profit %` | % | …13 | BD | AZ | Same. Typed as the percentage |
| (no label) | `Transport %` | % | …14 | BF | BB | Same. Typed as the percentage |
| (no label) | `Inspection & Packing %` | % | …15 | BE | BA | Same. Typed as the percentage |

- **Names and units:** all 15 match the seed rows exactly (SPEC 4.1, D-38). There are no name differences, so no rename and no migration is needed.
- **Percent rates:** the sheet shows them with a `%` sign. The file holds the plain percentage (SPEC 7.4 "Percent rates"), and the loader refuses a `%` sign in a value.
- **The sheet's "Used in" letters are not loaded.** They come from the delivery lead's own workbook layout. They are a steady shift of the SPEC 7 letters: +3 for the process rates (AI to AL … AU to AX) and +4 for the three percent rates (AZ to BD, BA to BE, BB to BF). SCR-11's "Used in" column is computed from the stored formulas, so it shows the portal's letters. That is expected and is not a conflict.
- **"Customers with own value" is not loaded.** It is computed, and a fresh install has no customers.
- **The left-column labels are row captions**, the same as the portal's output names (Cutting Cost, Hot Dip Galvanizing Cost, …). They are **not** Treatment / Color list entries and are not loaded anywhere.

### 5.2 The yellow Plating row: the SPEC answers it

The brief read "15 rates" as 15 plating rates. **The SPEC says otherwise.**
- SPEC 4.1 and D-38: the sheet has **15 items in total**, the 14 earlier seed items plus **one** `Plating-rate-per-sqin`, per sq in.
- UX spec 0.8: "the Process master has 15 rates, not 14. Plating-rate-per-sqin … no formula uses it, so its Used in cell reads 'None yet'".
- SPEC 4.1 and D-40 (Q-42): "Keep the data for now". Plating Cost (AU) stays typed by the Engineer, the Plating flag (AD) stays unused, and a plating formula is a later change, not in Release 1.

So the row is **one default for one rate**, stored as data. **It changes no calculated figure**, because no formula reads it. The sheet's empty "Used in" cell is consistent with that: on the sheet's +3 shift its column would be AR, which is the portal's AU, Plating Cost, a typed input. The SPEC does not say why the row is yellow. The likely reading is that it marks the row the delivery lead corrected and named on 2026-11-03 (D-38), the one no column uses. Whatever the colour means, it changes neither the mapping nor any figure, so **no question is asked**. If the delivery lead later wants a plating formula, that is the change request BC-01 (release plan 5.1), and it would read this rate by ID.

### 5.3 Material Master

| Sheet column | Field (Prisma / column) | Check | Fit |
|---|---|---|---|
| Material in drawing | `materialInDrawing` / `material_in_drawing` | Not blank, unique without regard to case, not "Not applicable" | The name the Engineer picks in column E. Names of the kind used on drawings (a grade and form after the material) fit; a comma is allowed |
| Material considered | `materialConsidered` / `material_considered` | Not blank | The mapping shown in column F. A plain material name fits |
| Price per kg ₹ | `pricePerKg` / `price_per_kg` | 0 or more | Material Rate (I) in AK. ₹ per kg |
| Specific gravity | `specificGravity` / `specific_gravity` | Above 0 | Used in M |
| Scrap rate per kg | `scrapRate` / `scrap_rate` (SPEC name `Material-Scrap-Rate`, D-39) | 0 or more | ₹ per kg, used in AK |

- **Currency.** The Material Master has **no currency field**. Every price and scrap rate is in ₹, which matches the sheet's "₹". Nothing needs converting.
- **Exchange rates.** These are a separate master (SPEC 4.4: 1 USD to INR and 1 EUR to INR, used for BH, BI, BJ and BK). **The sheet gives none.** The table starts empty, and a calculation reads a missing rate as not set. The loader does not carry exchange rates in format version 1, because they change from day to day, so a default taken from a sheet would be stale on the day of the install. The Admin types the day's rates on Materials and lists, Exchange rates, at first use. The README row (G-MD-1) names them. This is an assumption, A-MD-1. A later format version can add an optional block if the delivery lead wants one (about 1.5 hours; `updated_by` can name the Admin, because the loader runs after the Admin exists).

### 5.4 "Materials and lists": other lists

SCR-13 "Materials and lists" has three tabs: Materials, Exchange rates, and the Treatment / colour list.
- **Treatment / colour list:** the migrations already create "Other" (visible) and "Not applicable" (hidden). That is all the form needs: an Engineer can choose "Other" and type the treatment. The sheet shows no treatment or colour names, so **no list default is needed and none is loaded**.
- **Exchange rates:** see 5.3. They are entered by the Admin.
- **Settings** (e-mail on or off, sender) are not master data and stay as the install sets them (DL-378).

## 6. Point 4: effort and risk

### 6.1 Files to touch (option A of Q-MD-1)

| # | File | Change | Hours |
|---|------|--------|------:|
| 1 | `src/lib/masters/master-defaults-file.ts` (new, pure) | Strict zod schema for format version 1. Maps names to the seed IDs from `seed-ids.ts`. Reuses the SCR-11 and SCR-13 rules (`process-items.ts`, `materials.ts`, `master-rules.ts`). Placeholder refusal | 1.5 |
| 2 | `src/server/repositories/master-defaults-methods.ts` (new, included by `master-repository.ts` per the one-method-file rule) | Freshness reads F1 to F5 as tagged-template SQL, zod-parsed. Advisory transaction lock | 1.0 |
| 3 | `src/server/services/master-defaults-service.ts` (new) | One transaction: lock, check, update 15 rows by ID, insert the materials through the existing methods, then `recordMany` with the system label | 2.0 |
| 4 | `scripts/bootstrap-admin.ts`, `scripts/lib/master-defaults-cli.ts` (new) | The two modes, exit codes 0 to 4, words with counts and SHA-256 only | 1.0 |
| 5 | `deploy/windows/install.ps1` | `-MasterDefaultsFile`. The early check before anything is created. The load after `bootstrap-admin.mjs`. The log line. Comment-based help | 1.5 |
| 6 | `deploy/windows/master-defaults.example.json` (new), `scripts/lib/data-files.ts`, `scripts/package-windows.ps1` | The `null` template, its allow-list entry, and the package file list | 0.5 |
| 7 | `deploy/windows/README.md` | "Install": the parameter and where the file lives. "At install, before go-live": the first-use row (G-MD-1, needed in either option) | 0.5 |
| 8 | Tests (6.2) | Unit, integration, Pester, and the Engineer import-rule counts | 5.0 |
| 9 | CI loop and fixes | Buffer for one red round | 1.5 |
| | **Total (developer)** | | **14.5** |
| | Combined security-and-quality review (CLAUDE.md section 9 item 2: it writes data at install) | | 2.0 (reviewer) |
| | Records after the decision: ADR-014 amendment 1, architecture 5.5, 5.6 and 8 (solution-architect) | | 1.0 |

**Option B of Q-MD-1** (decide now, build after G8): only row 7's first-use row, about **0.5 hour** before the freeze.

### 6.2 Tests (no person-making E2E)

- **Unit** (`tests/unit/masters/master-defaults-file.test.ts`, about 14 cases):
  - A valid file passes.
  - Each of these is refused, naming the field and never the value: a missing or duplicate seed name, a wrong case or extra space in a name, a unit mismatch, a JSON number instead of a string, `null`, a negative value, 3 decimals, a `%` sign, an unknown key, a wrong `format` or `version`, a duplicate material ignoring case, "Not applicable", a specific gravity of 0, more than 500 rows, a file over 64 KB.
  - Placeholder refusal in production only.
  - CLI words hold no value. A canary value in the file must not appear in stdout or stderr.
- **Integration** (`tests/integration/masters/master-defaults.test.ts`, real PostgreSQL as in `tests/integration/masters`):
  1. A fresh database loads: 15 values set by ID, materials inserted, the IDs and names unchanged.
  2. The audit set for the `request_id` is 15 `master.edited` and N `master.created`, checked as a set (ADR-018 trap: rows tie on `created_at`), with `actor_id` the Admin and the system label.
  3. A re-run exits 3 and changes nothing (rows and audit counts the same).
  4. Each of F1 to F5 alone makes the loader exit 3 with nothing changed.
  5. A failure mid-way (a forced unique clash) rolls everything back.
  6. Two parallel loads: one loads, the other exits 3.
  7. No active Admin, or two: exit 2.
  8. A file of all zeros writes no audit entry.
  - Update the Engineer import-rule arithmetic for the new repository method file and service (architecture 10; `tests/security`).
- **Pester** (`deploy/windows/tests/install.Tests.ps1`):
  - Without `-MasterDefaultsFile`, no defaults call is made and the log carries the "No master defaults file" line.
  - With it, the check runs before the database is created and the load runs after `bootstrap-admin` and before the services.
  - A non-zero check code stops the install with nothing created.
  - A non-zero load code fails the install.
  - A relative path, a missing file, a file over 64 KB or a file under the root is refused.
  - The log holds the hash and counts only.
- **Stage 13** (Windows package job): **not changed before G8.** Its existing install run proves that the no-file path is unchanged. Adding an invented file to that job is a CI change, frozen until G8 (CLAUDE.md section 9 item 4), and is about 1 hour after G8.

### 6.3 Risk to the freeze

| Check | Answer |
|-------|--------|
| `/estimates/[code]` first load (192,500 B ceiling, DL-424) | **Not touched.** Every change is a server script, service, repository or PowerShell file. No client module and no page import change, so the stage 11b figure cannot move |
| Migrations | **None.** The 15 rows and the tables exist. No schema, CHECK, trigger or grant change. The runtime role already has SELECT, INSERT and UPDATE on `process_items` and `materials` and INSERT on `audit_log` |
| `install.ps1` | **Touched** (one optional parameter and two native calls through the existing `Invoke-AccucutNative`). The trust block is unchanged. This script took six rounds of security findings before (ADR-015 Amendment 2), so it is the main risk. It is mitigated by the no-file path staying as it is and by stage 13 still running it |
| `update.ps1`, `restore.ps1`, `AccucutOps.psm1` | Not touched |
| Data | The loader can write only to untouched masters (F1 to F5), in one transaction. It counts as "data" under CLAUDE.md section 9 item 2, so one combined review is needed before merge |
| Schedule | About 14.5 developer-hours plus a 2-hour review is about two developer-days. The last start is end of Mon 30 Nov and the last merge is end of Wed 2 Dec (DL-370). Both lanes are busy with defects (DL-425 to DL-427). **Feasible only if a lane can start it by Mon 30 Nov. Otherwise it slips past the freeze** |
| Overall | **Low risk to the product, moderate risk to the schedule** |

## 7. Question for the delivery lead (one)

**Q-MD-1. Should the defaults-file loader go into the G8 release, or be built right after G8?**

- **(a) Build it before the freeze.** A developer starts by the end of Mon 30 Nov and it merges by the end of Wed 2 Dec. It costs about 14.5 developer-hours plus a 2-hour combined review. The R1 install then runs `install.ps1 -MasterDefaultsFile <your file>`, and the 15 rates and 3 materials are there at first sign-in. **Cost:** it changes `install.ps1` in the last three days before the freeze, and it takes a lane from the defect work.
- **(b) Keep the G8 release as it is.** At first sign-in the Admin types the 15 rates and 3 materials from your sheet on Process master and Materials and lists (about 10 minutes), and a second person checks the screen against the sheet. A README row says so (0.5 hour, before the freeze). The loader is the first change after G8, for any re-install and for H1.

**Recommendation: (b).** The R1 server is installed once, and typing the values is a 10-minute step whose result the Admin can check on screen against your sheet. Option (a) changes the install script, which has had the most security findings, in the last days before the freeze, while both lanes are fixing defects. **Choose (a)** if you expect several fresh installs before G8 (for example rehearsals on clean servers), or if you do not want the Admin to type rates by hand.

Confidentiality (section 4) and Plating (section 5.2) need no question.

## 8. Records and gaps after the decision

- **G-MD-1 (needed in both options; developer, 0.5 hour; the README is code).** `deploy/windows/README.md` "At install, before go-live" has no row telling the Admin to enter the 15 rates, the materials and the two exchange rates before anyone calculates an estimate. Architecture 5.6 "One limit" requires one. The row says: enter them on Process master and Materials and lists (or check them after a defaults-file install), compare them with the sheet, and only then assign the first task.
- **ADR-014 amendment 1 (solution-architect, after Q-MD-1):**
  - Option 2 becomes "the `--load-master-defaults` mode of `bootstrap-admin`, at install, fresh databases only (F1 to F5)". This replaces `import:masters` in the `app` container.
  - The audit wording "counts only" becomes "per-item entries under the system label" (3.6).
  - Architecture 5.5's table and 5.6's "What every install starts with" follow.
  - Architecture 8 gains the `System: install defaults (…)` label next to DL-380's `System: server command (…)`. Master still has to confirm that pattern (DL-380).
- **Assumption A-MD-1:** exchange rates are entered by the Admin on the day, not loaded (5.3).
- **Assumption A-MD-2:** the file holds exactly the 15 seed names. A rate the delivery lead adds later is added on SCR-11, not through the file.
- **Never:** any value from the sheet in this repository, Jira, GitHub, CI, a commit message or a log.
