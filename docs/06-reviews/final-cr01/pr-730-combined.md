# Review Report — PR #730 (AQP-443, DEF-087: the restore swap ends only the sessions it may end; bounded rename retry) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: anything that can lose or corrupt data, here the Windows restore's database swap) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-443-restore-swap-terminate` (PR [#730](https://github.com/sankumar76/Accucut-Quotation/pull/730)), 0 behind `master`, 2 commits ahead |
| Commit reviewed | `b16c85ff` |
| Date | 2026-11-25 |
| Reviewed against | DEF-087 / #729; master's ruling DL-398 (B); architecture 0.71d §9.9 "Restore", "The swap and other connections" (records-u `2ff9fba6`); `deploy/db/create-restore-role.psql` (the restore role's grants); `docs/standards/coding-standards.md` §4, §5, §6; precedent `pr-715-combined.md`, `pr-699-combined.md` |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. CI 45624790106 and Windows package 45624790185 are green at the head |

## Summary

The fix is correct and keeps every safety property of the restore. The safety copy is still made first. The live database is renamed only inside the one transaction that also renames the new one. Any failure after the stop still drops the new database (or swaps back) and starts the portal on the old database. I read all of this in `Invoke-AccucutRestore` at the head, and the mocked harness and stage 13 tests prove it.

**The developer's deviation is right, and architecture 0.71d needs correcting.** In PostgreSQL 17, `pg_stat_activity.backend_type` (with `state`, `query` and the other per-session fields) is filled only when the caller has the privileges of the session's role or `pg_read_all_stats`. `accucut_restore` has the privileges of itself and of `accucut_owner` only (`GRANT accucut_owner TO accucut_restore WITH INHERIT TRUE`, `create-restore-role.psql:20`). So a `backend_type = 'client backend'` filter would never select a session of `accucut_app` or `accucut_backup`, and the rename would then fail with 55006. The join to `pg_roles` with `NOT r.rolsuper` selects exactly the set that `pg_signal_backend` lets the role end: a valid role (`proc->roleId`, which is the `usesysid` that `pg_stat_activity` shows) that is not a superuser. Autovacuum workers have no `usesysid`, so the inner join leaves them out, and `ALTER DATABASE … RENAME` SIGTERMs them itself. Stage 13 proves both cases on real PostgreSQL 17: a live autovacuum worker on the new database, and an `accucut_backup` session.

**Can a missed role-less session block the swap for ever?** No. Client backends always have a role. The role-less processes that can sit in a database are autovacuum workers, which the rename ends. A background worker started with no user shows the bootstrap superuser, so the pre-check refuses it plainly. Prepared transactions are not possible here (`max_prepared_transactions` 0). Even an exotic case, such as a session whose role was dropped while it was connected, only fills the bounded loop: 4 runs, then the plain `database-in-use` stop with both names as they were. On CI that took 21 s (13:53:31 to 13:53:52 in the job log).

There are three Minors. **SEC-730-01:** a role name with `|` or a line break shifts or splits the parsed row. A superuser role with a line break in its name would get past the pre-check (the swap then fails safely), and such a name can write a forged line into `restore.log`. **QLT-730-01:** the 55006 pattern needs the English severity word `ERROR`. On a server with non-English `lc_messages`, the retry never fires, and the restore falls back to today's safe but raw failure. **QLT-730-02:** nothing outside a code comment tracks putting R3 back to one run.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 6 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 730`; full `AccucutOps.psm1` and `Restore.Tests.ps1` at `b16c85ff` (exported with `git archive` to the scratchpad, read-only) | 3 files (+603 / −12): the module, the tests, the README. No change to `create-restore-role.psql`, `install.ps1` or any grant |
| CI | `gh run view 45624790106`; `gh pr view 730` rollup | **success** at `b16c85ff`: 7/7 checks SUCCESS, merge state CLEAN, 0 behind `master` |
| Windows package (stage 13) | `gh run view 45624790185 --log` | **success**: `Tests Passed: 609, Failed: 0, Skipped: 0`. R3 runs 1 to 5 of 5 green (12.6 s to 15.8 s each), with no retry line in any of them. All 5 real-PostgreSQL DEF-087 tests passed: the plain refusal on the live database (the log line names role `postgres`, "session type not shown to the restore role"), the autovacuum swap plus `DROP … WITH (FORCE)`, the `accucut_backup` session ended, and the held `postgres` session (retries 1 to 3 of 3, then the plain stop). The 3 mocked-harness DEF-087 cases and the 4 module-level Describes are green |
| Local Pester | not run | Only Pester 3.4.0 is installed on this PC, and the suite needs Pester 5. I did not install packages (role rule). The Windows package run above is the record |
| Probe: row parsing and the 55006 pattern | PowerShell 5.1, module at the head imported from the scratchpad, `Invoke-AccucutRestoreSql` replaced inside the module scope by a stub | Two superuser rows, one role named `we|ird` and one with a line break, gave **1 row** back, parsed as `user=we super=False` (SEC-730-01). `RestoreInUsePattern` matched the English `ERROR:  55006:` but **not** `FEHLER:  55006:` (QLT-730-01). The suggested pattern matched both and did not match `role "x55006"` |
| Restore role's privileges | `git grep` at the head | `NOSUPERUSER CREATEDB NOCREATEROLE`, `GRANT accucut_owner … WITH INHERIT TRUE, SET TRUE`, `GRANT pg_signal_backend`. No new grant in the PR (no `pg_read_all_stats`) |
| Test-first evidence | PR Dev Record; commit list | 2 commits, with code and tests together. The unit-level red on the old module was CommandNotFound. The red for the right reason (`permission denied to terminate process` with the old SQL and a live autovacuum worker) is the developer's local S1 run on real PostgreSQL 17.11, not a CI run (QLT-730-05) |
| Secrets, query text | read the diff and the stage 13 log | Nothing logged beyond database, role and type. The diagnostic-failure line goes through `ConvertTo-AccucutShortMessage` (secrets blanked, control characters removed, 300 characters). The test superuser password is the run's own invented one, passed by environment only |
| Lint, type-check, build | n/a | PowerShell module; the CI module guard (`tests/unit/windows-deploy-files.test.ts`) is green at the head |

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Why (impact) | Fix |
|----|----------|-----------|-----------|-------|--------------|-----|
| SEC-730-01 | Minor | `deploy/windows/AccucutOps.psm1:2845`, `:2850`, `:2879`, `:2936` | coding standards §4 (logs), §5 (encode output for its context); fix shape (3), (4) | **A role name that holds `|` or a line break breaks the session rows.** `usename` is the second of four `|`-joined fields, and the answer is split by lines and then into 4 parts. A name with `|` shifts the fields: probe `we|ird` gave `UserName=we`, `Superuser=False`, `BackendType='true|'`. A name with a line break splits the row into two lines with the wrong field count, and **both are dropped**: the pre-check then finds no superuser session. The raw name also reaches `restore.log` and the screen, and `Write-AccucutRestoreRecord` blanks secrets but keeps line breaks, so the name can write a line that looks like a separate record. | Low likelihood: only a PostgreSQL superuser can create such a role. No data risk: a missed superuser session still stops the swap, with 55006 then the plain `database-in-use` stop, both names unchanged. But `restore.log` is the record outside the database (AC-6), and a forged line in it is a loss of integrity. | In the SQL, put the role last and remove control characters and the separator: `format('%s|%s|%s|%s', a.datname, coalesce(r.rolsuper, false)::text, coalesce(a.backend_type, ''), regexp_replace(coalesce(a.usename, ''), '[[:cntrl:]|]', '?', 'g'))`, and read the fields in that order. **Test:** in the "read the sessions" Describe, pin the `regexp_replace` in the SQL text, and add an answer whose fourth field contains `|`. It must give one row with the right `Superuser` value. Optionally, the assert can also count from the SQL (`count(*)`), so that parsing never decides whether it refuses |
| QLT-730-01 | Minor | `deploy/windows/AccucutOps.psm1:2497`, `:2922` | fix shape (2); the PR's claim "Locale-proof (no message text)" | **The 55006 test needs the English word `ERROR`.** psql prints the server's *localised* severity (`FEHLER:`, `ERREUR:` and so on) in front of the SQLSTATE. On a PostgreSQL whose `lc_messages` is not English (the Windows installer sets it from the server's locale), the retry never fires. A rename that finds an autovacuum worker still in its 5 s wait, or a session, then fails at once with the raw psql text. That is the pre-PR behaviour: safe (rollback path, event 1111), but not the plain message. | Unlikely on an English-language Windows server, and safe either way. But the bounded retry is the fix's second leg (autovacuum left to the rename), and the PR states it does not depend on the locale. | Anchor on the SQLSTATE position, not the word: `$script:RestoreInUsePattern = '(?m)^psql:[^\r\n]*?:\s\S+:\s+55006:'`. The probe matched English and German and rejected `role "x55006"`. **Test:** add a `-ForEach` case to "a rename that finds another session … is tried again" with `psql:<stdin>:7: FEHLER:  55006: Datenbank "accucut" wird von anderen Benutzern verwendet` that must retry. Correct the Dev Record sentence |
| QLT-730-02 | Minor | `deploy/windows/tests/Restore.Tests.ps1:972-973` | DL-398 (B) proof; DoD (no untracked TODOs) | **The plan to put R3 back to one run is tracked only by a code comment** ("It may go back to one run when QA closes DEF-087"). #729, DEF-087's close-out and the follow-ups do not name it. | R3 ×5 adds about 60 s to every Windows package run, on `master` and on every PR that touches `deploy/windows/**`, until someone remembers. That is cheap now and right while DL-398's proof runs (stage 13 on the PR and on the first two `master` pushes after the squash). But untracked, it stays for good. Cross-reference reviewer-performance for the time. | Add one line to DEF-087's close-out steps (QA, in the defect file on records-u and on #729): "When DEF-087 closes: set R3 back to one run (`Restore.Tests.ps1:973`, drop `-ForEach`)." Or open a `follow-up` issue linked to #729. No code change in this PR |
| QLT-730-03 | Info | `deploy/windows/AccucutOps.psm1:2913` | architecture 0.71d fix shape (1), (4) | **Deviation accepted: no `backend_type` filter.** Confirmed by PostgreSQL 17's rules (per-session fields only with the privileges of the session's role or `pg_read_all_stats`) and by the restore role's grants. A `client backend` filter would select only `accucut_owner` or `accucut_restore` sessions. `JOIN pg_roles … NOT r.rolsuper` is exactly `pg_signal_backend`'s allowed set. The stage 13 log shows the consequence for fix shape (4): "session type not shown to the restore role". | Correct, and the safest available filter | Solution-architect: correct 0.71d (see "Issues for other roles") |
| SEC-730-02 | Info | `deploy/db/create-restore-role.psql` (unchanged) | least privilege | **No `pg_read_all_stats`. Agreed, and recommended to stay so.** It would let the restore role read the query text of every session (customer data in the app's queries) only to label a log line. Role and database identify the blocker well enough. | none | Close the developer's optional follow-up as "not wanted" unless the architect disagrees |
| SEC-730-03 | Info | `:2842-2845`, `:2913-2914` | coding standards §5 (no string-built SQL) | **The SQL is built by string, but every interpolated name passes an allow-list first:** the live name `^[a-z_][a-z0-9_]{0,62}$`, the restore names `^accucut_(new|old|failed)_\d{14}$`, and in `Get-AccucutRestoreSession` every name, before any SQL is sent (with an injection test). DDL cannot take parameters. This is the module's established pattern (STORY-10.11). `format()` is used only for the output row. | none | none |
| QLT-730-04 | Info | `:2943`; `README.md:612`; `:3325` | AC (plain messages); README accuracy | (a) The bound is right: 3 retries, only on 55006, any other error raised after one run (4 negative cases, including a lock time-out `55P03` and a text that only mentions 55006). "About 20 seconds" matches CI (21 s). The rare worst case is about 40 s, when the live rename waits its 5 s and then the new one waits 5 s in the same run. (b) The `database-in-use` wording presumes an administrator session. In the roll-back swap (`:3325`, event 1112) its "then try again" reads as "run the restore again", while the IT person has to put the names back. (c) When a superuser session sits on the **new** database at the pre-swap check, `DROP … WITH (FORCE)` of it fails (permission denied). It is logged ("could not be removed … your IT person can drop it"), and the outcome is still 1111 with the portal on the old database. The README row does not mention the leftover database. | Wording only; every path is safe | Optional: in the README row for "Someone is connected …", add "a database named `accucut_new_…` may be left for your IT person to drop". Leave the message as is |
| QLT-730-05 | Info | `Restore.Tests.ps1:1529` | DL-398 (B) "test-first" | The unit-level red on the old module was CommandNotFound, not a failing SQL assertion. DL-398's second option (the statement pinned plus a real-PostgreSQL check) is met: the SQL pin, and stage 13's autovacuum test with `workers = 2` asserted before the swap. The red for the right reason is a local run. | Accepted | Optional: before the swap, run the old statement as `accucut_restore` and expect `permission denied to terminate process`. Every stage 13 run would then prove that the scenario still reproduces DEF-087 |
| QLT-730-06 | Info | `:2875-2881`, `:2928-2938` | DRY, maintainability | Two near-identical "at most 5 sessions, then N more" log loops with slightly different wording. Cross-reference reviewer-standards. | Readability only | Optional: one `Write-AccucutRestoreSessionRecord -Sessions -Prefix` helper. Fold it in only if the SEC-730-01 fix touches both loops |

## Security notes (the §9 item 2 focus in the brief)

| Check | Result | Evidence |
|-------|--------|----------|
| Safety copy first; live never renamed until safe | **Kept** | `Invoke-AccucutRestore:3288-3303`: stop, safety copy, new database, restore, newer check, migrate, pre-swap check, then the swap. The swap's two renames are in one `BEGIN … COMMIT`. `ON_ERROR_STOP=1` plus psql's exit drops the connection, so a failed second rename rolls the first back. A retry waits on the database lock until that rollback is done. Stage 13 retry test: live and new names unchanged, no `old` |
| On any failure the portal restarts on the old database, and both names are as they were | **Kept** | Inner catch unchanged (`:3311-3341`). Mocked harness "found just before the swap": no `swap:` step, `drop:accucut_new_T`, `start`, event 1111 |
| 55006-only retry, at most 3, about 20 s; any other error raised | **Yes** (QLT-730-01 for the locale) | `:2915-2947`. Pester: 4 runs then `database-in-use`; the third retry may succeed; 4 non-55006 cases raised after 1 run; diagnostic failure does not hide the message; no records without `-Paths`. Stage 13: real psql output matched, 21 s |
| Superuser pre-checks: before the stop (1110) and before the swap (1111); plain message, no raw psql error | **Yes** (SEC-730-01 for unusual role names) | `:3250` (before the date, the key and the stop, live database only, because the new one does not exist yet); `:3302` (live and new). Pester asserts the message excludes `ERROR|psql:|pg_terminate_backend|permission denied|SQLSTATE`. Stage 13: services running, health 200, names, migrations and the backup count unchanged |
| `DROP DATABASE … WITH (FORCE)` | **Unchanged and correct** | PostgreSQL 17's FORCE check refuses only a superuser's process (`superuser_arg` of an invalid role is false), and `pg_signal_backend` covers the rest. Stage 13 drops a database with a live autovacuum worker as `accucut_restore` |
| Names and injection | **Safe** | SEC-730-03 |
| restore.log: no query text, no secrets | **Yes** | Only `datname`, `usename`, `backend_type`; `query` and `state` are never selected (a Pester assertion pins this). Verbose psql output adds SQLSTATE and LOCATION to a failure detail, never another session's query. SEC-730-01 covers line breaks in role names |
| Least privilege | **Yes** | SEC-730-02 |
| README restore chapter | **Accurate** | "What you need" item 4, the two new "If it stops" rows, the restore.log sentence, the function table and the tests paragraph match the code and the CI log (QLT-730-04 (c) optional) |

## Reviewer-specific tables

### AC conformance (DEF-087 route, DL-398 (B), architecture 0.71d fix shape → code → test)

| Item | Code | Test(s) | Status |
|------|------|---------|--------|
| (1) End only sessions the role may end | `Switch-AccucutRestoreDatabase:2913` (`JOIN pg_roles … NOT r.rolsuper`) | Pester SQL pin (no `backend_type`, a single `pg_terminate_backend`, order of the statements); stage 13 `accucut_backup` session ended | Met, with the accepted deviation (QLT-730-03) |
| (2) Autovacuum left to RENAME; retry only on 55006, at most 3 | `:2915-2947`, `RestoreSwapRetries` | Pester ×7; stage 13 autovacuum swap and held-`postgres` retry | Met (QLT-730-01 Minor) |
| (3) Superuser check before the stop and before the swap, plain refusal | `Get-AccucutRestoreSession`, `Assert-AccucutRestoreNoSuperuserSession`, `:3250`, `:3302` | Mocked harness ×3 (order, 1110, 1111); module Describe ×5; stage 13 refusal on the live database | Met (SEC-730-01 Minor) |
| (4) Blocker to restore.log, never a query | `:2875-2881`, `:2928-2940` | Pester (at most 5, "and 3 more", no `SELECT`); stage 13 log asserts | Met (the type only when readable) |
| (5) `DROP … WITH (FORCE)` verified with autovacuum | unchanged, comment `:2951` | Pester SQL pin; stage 13 drop with a live worker | Met |
| R3 ×5 in one job | `Restore.Tests.ps1:973` | Windows package 45624790185: runs 1 to 5 green | Met (QLT-730-02: tracking the revert) |
| QA proof (DL-398: stage 13 on the PR and on the first two `master` pushes after the squash; the rehearsal restore) | n/a | PR run green; the two `master` runs and the rehearsal come after the merge | Pending (QA) |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| SEC-730-01 | `:2845`, `:2850` | "read the sessions" Describe: an answer with `|` in the role field gives one correct row; the SQL text pins `regexp_replace(… '[[:cntrl:]|]' …)` |
| QLT-730-01 | `:2497` | swap Describe: a `FEHLER:  55006:` outcome is retried |
| QLT-730-02 | `Restore.Tests.ps1:972` | n/a (a tracking item) |
| QLT-730-03..06, SEC-730-02..03 | as listed | n/a |

## Issues for other roles

- **solution-architect: architecture 0.71d needs correcting** (§9.9, "The swap and other connections"). Fix shape (1): drop `backend_type = 'client backend'`. The restore role reads `backend_type` as NULL for every role it has no privileges over, so the filter is `JOIN pg_roles … NOT rolsuper`, which equals `pg_signal_backend`'s allowed set. (3): "superuser sessions of any type" (the type is unreadable). Before the stop only the live database exists, so the check is on the live database then, and on both before the swap. (4): role and database, plus the type only when readable. Do not add `pg_read_all_stats` (SEC-730-02). (5): verified on stage 13. Record it as 0.71e or a patch line.
- **developer:** SEC-730-01 and QLT-730-01 are about 30 minutes together, with 2 Pester cases. I recommend them in this PR before the merge cut-off (end of Wed 2 Dec). Otherwise they go to the hardening window. Neither blocks the merge.
- **qa-engineer:** add the R3 revert to DEF-087's close-out (QLT-730-02). DL-398's remaining proof: stage 13 green on the first two `master` pushes after the squash, and the rehearsal restore (G8-C-NFR10 (b)).
- **reviewer-performance:** R3 ×5 adds about 60 s to each Windows package run until it is reverted (QLT-730-02).
- **reviewer-standards:** QLT-730-06 (duplicated log loops), if you want it.

## Previous Findings (re-review only)

n/a (round 1).

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 3, Info 6). CI and the Windows package are green at `b16c85ff`, 0 behind `master`.
- Recommended next agent: developer (optional, before the merge: SEC-730-01 and QLT-730-01), then orchestrator: merge per CLAUDE.md §9 on fully green CI by the end of Wed 2 Dec; solution-architect: correct 0.71d; qa-engineer: DEF-087 proof runs and the R3 revert item.
