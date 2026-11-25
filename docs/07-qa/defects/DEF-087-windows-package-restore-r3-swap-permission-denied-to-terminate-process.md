# DEF-087: `Windows package` Pester `Restore.Tests.ps1:973` R3 fails once on a `master` push: the restore's database swap gets "permission denied to terminate process" from `pg_terminate_backend` (`AccucutOps.psm1:2831`, run as `accucut_restore`); the restore fails safely, the same sha passes on the scheduled run (provisional Sev-2, product not excluded; Jira AQP-443, GitHub #729)

| Field | Value |
|-------|-------|
| Story / AC | AQP-312 (STORY-10.11, the guided restore, JEA; In Review in Jira), the restore path; NFR-013 (recovery). **No AC is shown to fail by value:** the restore stopped with a stated error, kept the live database and restarted the portal on it. |
| Severity | **Provisional Sev-2 (master, DL-398 (B), 2026-11-25); QA recorded it as given.** It is on the recovery path, and if the hypothesis below holds a real restore can fail the same way. The restore failed **safely**: a safety copy was made, the live database was never renamed, the portal was restarted on the old database; no data was lost. The grade moves on the cause step (the solution-architect, by the end of Thu 26 Nov). |
| Priority | P2 (Jira High, labels `sev-2`, `final-review`) |
| Type | **Product not excluded** (the module's swap SQL, or the test's PostgreSQL set-up; open). |
| Status | **Open (new), 2026-11-25 (qa-engineer, on master's DL-398 (B)).** First occurrence. QA reads every `Windows package` run until the Bug closes; a second occurrence goes on this Bug (DL-398 (C)). |
| Jira / GitHub | [AQP-443](https://sankumar76.atlassian.net/browse/AQP-443) / [#729](https://github.com/sankumar76/Accucut-Quotation/issues/729) (labels bug, sev-2, ai-delivery, final-review; Jira also aiid-DEF-087, agent-qa-engineer). Relates to AQP-312 and AQP-1. Searched first: JQL on `aiid-DEF-087` and 'Windows package'; a GitHub search: no earlier Bug. |
| Found by / date | CI (the push run); read and logged by qa-engineer, 2026-11-25; classified by master, DL-398 |
| Build / commit | `master` `a761ca9d` (#723, STD-C-04: `scripts/lib/tls-front.ts` and a unit test; nothing under `deploy/windows`) |
| Environment | GitHub-hosted Windows runner, workflow `Windows package`, push run 45605853197 (created 11:35:27Z, ended 11:53:46Z), job 139176382692 'Stage 13: Windows package', step 'Pester tests of the scripts (deploy/windows/tests)'. |

## Steps to Reproduce
Not on demand (one failure; the scheduled run on the same sha passed).
1. Run the Windows package job; its Pester stage runs `deploy/windows/tests/Restore.Tests.ps1`.
2. R3 (line 973) restores a copy that is one migration behind the installed release and migrates it forward as `accucut_restore`.

## Expected Result
The restore's swap ends the last connections to the live and the new database and renames them in one transaction; R3 passes.

## Actual Result
`Tests Passed: 580, Failed: 1`. R3 failed after 9.96 s: `InvalidOperationException: The restore of accucut-20261125-115309-weekly.age failed: 'psql.exe' failed with exit code 3. psql:<stdin>:3: ERROR: permission denied to terminate process  DETAIL: Only roles with the SUPERUSER attribute may terminate processes of roles with the SUPERUSER attribute.` (at `AccucutOps.psm1:3250`, `Invoke-AccucutRestore`; called from `Restore.Tests.ps1:973`). The job log in order: 11:53:10 the key opens the copy; the portal is stopped; 11:53:11 a safety copy is made (accucut-20261125-115310-release.age, 99 KB); the copy is restored into the new database accucut_new_20261125115310; 'Running the migrations on it'; **11:53:13 `ERROR The restore failed (restore-failed)`**; 11:53:15 `WARNING The portal was started again on the old database.`; event 1111 'The restore ... stopped (code restore-failed)'.

## Evidence (job log, ANSI stripped; no secrets or personal data)
- `deploy/windows/AccucutOps.psm1:2831` (`Switch-AccucutRestoreDatabase`, read by QA on master): `SET ROLE NONE;\nSELECT count(*) FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('<live>', '<replacement>') AND pid <> pg_backend_pid()) AS ended;\nBEGIN; ALTER DATABASE "<live>" RENAME TO "<previous>"; ALTER DATABASE "<replacement>" RENAME TO "<live>"; COMMIT;`, run as `accucut_restore` through `Invoke-AccucutRestoreSql`. It is the only `pg_terminate_backend` call in the module. The error names line 3 of the piped SQL, the SELECT.
- **The same sha passed:** the scheduled `Windows package` run 45607001720 on a761ca9d (event `schedule`, 11:43:00Z, ended 12:08:22Z), job 139186022342, is `success`.
- **No earlier red on record:** the `Windows package` run of every `master` push from a619a3ef to 54c85e43 shows `success` in the run list, and 0244e930's (45611772699) is `success` after it.
- a761ca9d's own diff does not touch `deploy/windows`; the CI run 45605853205 is red separately for DEF-053 (`users.spec.ts:58`).

## Suspected Area (leads, not findings)
- **Master's hypothesis (DL-398 (B), unverified):** on PostgreSQL 17 a non-superuser cannot terminate autovacuum workers, so a real restore can fail the same way when an autovacuum worker is connected to the live or the new database at the swap (NFR-013 recovery path). It would explain a pass at another time on the same sha: the new database has just been restored and migrated, a moment when autovacuum is likely to have a worker on it. QA has not reproduced it and has not read the PostgreSQL role set-up of the job.
- The module's own header says the swap 'ends the last connections'; if `accucut_restore` is not a superuser, `pg_terminate_backend` is limited to backends of the same role (or of a role it is a member of, or with `pg_signal_backend`), and never reaches an autovacuum worker.
- **Not for QA to change:** `deploy/windows/**` and the Pester suite. The solution-architect does the cause step (DL-398 (B)).

## Route and proof (DL-398; QA reads it)
1. **Cause step** by the solution-architect by the end of **Thu 26 Nov**, in writing on this Bug.
2. QA reads **every `Windows package` run** (push, pull request and schedule) until the Bug closes; a second occurrence goes on this Bug (it is not a new item).
3. Proof (QA's proposal; master rules): the fix's PR run and the first two `master` pushes after its squash read the Windows package `success` with R3 passing, and a test or a stated check that covers the case of a live autovacuum worker on either database at the swap (as the cause step names it).

## Fix & Verification  _(solution-architect / developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Cause step in writing | solution-architect | | |
| Fix | developer | | |
| Regression test for a live autovacuum worker at the swap | developer | | |
| Proof: fix PR run and first two `master` pushes | qa-engineer | | |
| Grade set (kept or lowered) | master | | |
| Closed | qa-engineer | | |

## Records
Jira Bug AQP-443 and GitHub issue #729, created 2026-11-25 and cross-linked. Related: AQP-312, AQP-1, DEF-053 (the same push's red, separate); DL-398 (master's ruling); test plan 0.3.60; Windows package runs 45605853197 (red), 45607001720 (the same sha, green), 45611772699 (0244e930, green); job log in the session scratchpad (`win_45605853197.log`).
