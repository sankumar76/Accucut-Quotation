# Combined security-and-quality review: AQP-311 (STORY-10.05), PR #417

| Item | Value |
|---|---|
| Story | AQP-311, STORY-10.05: Weekly backup, watch check and free-space check (Windows) |
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/417 (label `critical-review`) |
| Head reviewed | `7f17383aaa0a7856924f9880c80170f78b4e3156` (merge base with master `dc935b8`) |
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md section 9 item 2) |
| Date | 2026-11-15 |
| Governing design | ADR-015 Amendments 2, 2.1, 3, 3.1 and 3.2 (master); architecture section 9.9 v0.49; test strategy section 10.8; ux-spec v0.28 and v0.29 (SCR-15) |
| Verdict | **REQUEST CHANGES** on one Major, which is CI only and cheap. There is no Blocker and no Critical, and **the product code has no open finding above Minor.** Merge condition: Stage 13 green end to end, including exercise, update, removal and Pester (see section 4). |
| Counts | Blocker 0, Critical 0, Major 1, Minor 6, Info 5 |

## 1. What was checked and how

- **Method:** read-only. I used `git fetch`, `git diff dc935b8 7f17383`, `git archive` of the PR head into the session scratchpad, `gh pr view/diff`, `gh run view`, and Jira AQP-311 (ACs 1 to 10). No developer worktree was touched, no branch was switched, and nothing was committed.
- **Read in full:**
  - `AccucutOps.psm1`, region Backups, lines 970-2240 (LSA, account and task, ACLs, settings, free space, copies, prune, pipe, `job_runs`, clear);
  - `backup.ps1` and `clear-copies.ps1` outside the trust block;
  - the `install.ps1` and `update.ps1` diffs;
  - `deploy/db/create-roles.psql`, migration `20261115100000_job_runs_backup_grant`;
  - `src/lib/settings/backup-status.ts`, `src/server/jobs/backup-watch.ts`, `src/worker/main.ts`, `job-run-repository.ts`, Settings `texts.ts` and `backup-lines.tsx`;
  - the `windows-package.yml` diff, including both on-failure diagnostic steps;
  - `ci/assert-install.ps1`, `ci/assert-removal.ps1`, `ci/exercise-backup.ps1` and `ci/diagnose-backup-login.ps1`.
- **Tests read:** the new `windows-deploy-files.test.ts` guards, `backup-watch.test.ts` and `backup-status.test.ts`. I also read the titles of the Pester cases against the ADR-015 3.2 list: `AccucutOps.Tests.ps1` lines 506-1120.
- **Own checks:**
  - The trust block is byte-identical in `install.ps1`, `update.ps1`, `backup.ps1` and `clear-copies.ps1` (SHA-256 `70bcd910…` after CRLF to LF) and unchanged from master.
  - No `Add-Type` appears in any `.ps1` or `.psm1` under `deploy/windows/` outside `ci/` and `tests/` (grep).
- **Tests run (local, on a scratch copy of the PR head, using the main checkout's `node_modules`):**
  - Command: `vitest run tests/unit/jobs/backup-watch.test.ts tests/unit/jobs/job-run-writer.test.ts tests/unit/settings tests/unit/windows-deploy-files.test.ts tests/unit/postgres-roles-script.test.ts tests/security/engineer-import-rule.test.ts`.
  - Result: **9 files, 1311 tests passed, 0 failed.**
  - Not run: the integration tests (they need a database), Playwright, the build and Docker (per the brief), and Pester (only Pester 3.4 is on this PC).
- **CI evidence (Stage 13, `windows-package.yml`, not a required check):**
  - Run 43738704002 on `7f17383`: **every install assertion passed** ("All install assertions passed.", 17:13:45Z). The step then exited 1 on a stale `$LASTEXITCODE`; see SQR-11.
  - What that run proves on a real Windows runner:
    - the LSA grant is exact against an independent `secedit` snapshot, and no other right changed;
    - the five root ACEs and the exact ACEs on `backups`, `backup.pgpass` and `backup-settings.json` are in place;
    - the task's principal, trigger and action are as specified;
    - the first weekly copy was made, its manifest agrees, it **decrypts with the run's key and restores**, and the `job_runs` ok row exists;
    - exactly one Information event was written, and it holds no path;
    - `accucut_backup` can log in, is a member of `pg_read_all_data`, can INSERT on `job_runs`, and is refused UPDATE, DELETE, INSERT into another table and CREATE TABLE;
    - seven secrets were looked for in every log, the state file, the settings and the manifests, and none was found.
  - **Never run yet on this PR:** the exercise, update with the real release backup, rollback, removal and Pester steps (every Stage 13 run so far stopped at or before "Assert the install").

## 2. AC conformance

| AC | Code | Test | Status |
|---|---|---|---|
| AC-1 weekly backup, free-space check first, pipe, manifest, `job_runs` row | `AccucutOps.psm1` `Invoke-AccucutBackup` 2004-2084, `Invoke-AccucutBackupPipe` 1858-1954; `install.ps1` 1024-1036, 1077; `backup.ps1` 547-596 | Stage 13 run 43738704002 (copy, manifest, decrypt and restore, ok row) | **Met.** `cmd.exe /c` is replaced by the direct pipe (Amendment 3.1 point 1, ratified). |
| AC-2 low space: no copy, failed row, exit non-zero | `Test-AccucutBackupRoom` 1680-1704, `Invoke-AccucutBackup` 2040-2044 | `Backup.Tests.ps1` (boundary to the byte) | Implemented; the code review found it correct. **Pester has not run.** |
| AC-3 prune: older than 2 calendar years only, never the newest 4, never a newer copy | `Get-AccucutBackupPruneCandidate` 1785-1796, `Remove-AccucutBackupCopy` 1798-1822 | `Backup.Tests.ps1` | Implemented and correct. **Pester has not run.** |
| AC-4 `-Reason release` tagged, same 2-year rule | `Invoke-AccucutBackup`; `update.ps1` release backup | `exercise-backup.ps1` step 1; update step | Implemented. **Stage 13 has not reached it.** |
| AC-5 `backup-watch`: `fs.statfs` on both volumes, own row, missed week | `backup-watch.ts`; `worker/main.ts` | `backup-watch.test.ts` (pass, run here) | **Met** (SQR-06 is Minor). |
| AC-6 guided clear | `Clear-AccucutCopies` 2120-2219; `clear-copies.ps1` | `ClearCopies.Tests.ps1`; `exercise-backup.ps1` step 3 | Implemented and correct. **Stage 13 has not reached it, and SQR-01 breaks the check after it.** |
| AC-7 secrets | `PGPASSFILE` only, `Clear-AccucutPgEnvironment`; the password in memory only; public recipient | Stage 13 secret scan (pass); Vitest guards (pass) | **Met** (residual SQR-02). |
| AC-8 Pester in Stage 13 | `deploy/windows/tests/*.Tests.ps1` | — | Implemented. **Never run** (Stage 13 has always stopped before it). |
| AC-9 row shape for 02.09 | `Add-AccucutJobRun`, `createJobRunWriter` | `backup-watch.test.ts`; Stage 13 row assertion | **Met.** |
| AC-10 one shared late rule; never counts as late; exact words | `isBackupLate` in `src/lib/settings/backup-status.ts`, used by `backup-watch.ts` and `deriveBackupStatus`; `texts.ts` | `backup-status.test.ts` (null, 7, 8, 8 d + 1 ms, 9 d, future, both importers) | **Met.** The words match ux-spec 0.28 exactly: `No good backup yet.` and `No backup has finished without errors yet. Ask Accucut IT to check the weekly backup.` |

## 3. The specific checks in the brief

1. **Amendment 3.2, LSA through Reflection.Emit: correct.**
   - **Signatures.** All seven match the Win32 prototypes on x64:
     - `LSA_OBJECT_ATTRIBUTES` is 48 bytes;
     - `LSA_UNICODE_STRING` is 16 bytes, with Length at 0, MaximumLength at 2 and Buffer at 8;
     - `BOOLEAN AllRights` is a `byte`, always 0;
     - the enumerate buffer holds 8-byte `PSID` entries, read with `ReadIntPtr(buffer, i*8)`;
     - the `out` parameters use `MakeByRefType` with `ParameterAttributes.Out`.
   - **Access and statuses.** The access mask is `0x811`. `STATUS_NO_MORE_ENTRIES` and `STATUS_OBJECT_NAME_NOT_FOUND` are the only allowed statuses.
   - **Handles.** They are closed in `finally`. The narrow window before `try` is SQR-05.
   - **Load sites.** No `Add-Type` outside `ci/` and `tests/`.
   - **Pre-check.** Deny SIDs S-1-1-0, S-1-5-11, S-1-5-113 and S-1-5-32-545, and the RSoP read, run at `install.ps1:960`, before any value, database, role or user is made.
   - **Grant.** The exact holder set is checked after the grant (`Grant-AccucutBatchLogonRight` 1307-1313), and Stage 13 proved it against `secedit`.
   - **Removal.** Order: unregister, revoke, then `Remove-LocalUser` (1455-1462).
   - **Update.** It only warns (`update.ps1` `Write-AccucutBatchRightWarning`).
2. **Secrets.**
   - **AccucutBackup's password.** It is made in memory (32 characters, CSPRNG, rejection sampling, Fisher-Yates) and reaches only `New-LocalUser` (as a `SecureString`) and `Register-ScheduledTask`. It is also kept in the redaction list.
   - **File ACLs.** `backup.pgpass` and `backup-settings.json` are exactly three ACEs, protected and owned by Administrators (Stage 13 PASS). They are written without a BOM, and the pgpass line ends with LF.
   - **PG\* environment.** It is cleared before every `psql` and `pg_dump` call (`Clear-AccucutPgEnvironment` in the pipe and `-ClearPgEnvironment` in `Add-AccucutJobRun` and `Get-AccucutDatabaseInfo`).
   - **The on-failure diagnostic steps leak nothing:**
     - the new account password is passed by splat (`Set-LocalUser @set`), so no error position line shows it, and it is never printed;
     - `diagnose-backup-login.ps1` prints shapes only;
     - `rolpassword` is cut to 14 characters, which for SCRAM is exactly the `SCRAM-SHA-256$` prefix;
     - the age secret key line is `::add-mask::`ed and deleted;
     - `RUNNER_TEMP` is not uploaded.
   - **Residual:** SQR-02 (PowerShell module logging).
3. **Trust flow (Amendments 2 and 2.1).** The block is identical. Nothing is loaded before its check: root from the script path, shape, `current`, script, release, then the module. After that come the settings files, the `backups` folder with `-Writer` set to AccucutBackup, and then `age.exe`, `pg_dump.exe` and `psql.exe` through `Resolve-AccucutTrustedExecutable`. No `cmd`, no `PATH`, no `Start-Process`.
4. **The pipe.**
   - **When a copy is kept.** Only when both exit codes are 0, the copy error is null, the size is greater than 0, and the file starts with the 21-byte `age-encryption.org/v1`.
   - **SHA-256.** It is computed from the file as written.
   - **Leftover files.** A failure deletes the `.part` file. A killed run leaves only `.part` (removed after 24 h) or a manifest without a copy, never an unverified `.age`. The final name comes from an atomic rename after the manifest.
   - **20 % rule.** `after = free - ceil(basis * 1.10) >= ceil(total * 0.20)`.
   - **Row contract.** `status`, `sizeBytes`, `freeBytes` and `totalBytes`; a failed row carries `code`.
5. **Database role.**
   - LOGIN only with a password; the install refuses an empty one, and Stage 13 asserted `rolcanlogin`.
   - `NOSUPERUSER NOCREATEDB NOCREATEROLE`; CONNECT and USAGE only.
   - `pg_read_all_data`, plus INSERT on `job_runs` through a guarded migration.
   - No default privileges are granted to it, and the schema has no RLS that `pg_read_all_data` would bypass.
   - `pg_read_all_data` is cluster-wide (SQR-08).
6. **AC-10.** See the table. One function, null counts as late, and the boundary is "more than 8 days".
7. **Tests.**
   - **The Vitest guards** are mostly text-presence checks. They are brittle but meaningful as tripwires, and they passed.
   - **The Stage 13 assertions** are exact: they compare with the `secedit` snapshot without a hard-coded list, use exact ACE strings, and check the role by `permission denied`.
   - **The INSERT into `_prisma_migrations`** fails on privilege before any NOT NULL check, so that test is meaningful.
   - **`assert-removal.ps1`** compares every right with the snapshot taken before the install and looks for a bare SID.
   - **One defect:** SQR-01.

## 4. Merge condition (applies to the orchestrator)

Stage 13 is outside the required checks (DL-211). For this `critical-review` story, the exercise, update with the real release backup, rollback, removal and Pester steps have **never run**, and Pester carries AC-2, AC-3, AC-6 and AC-8. Do not merge PR #417 on the required checks alone. **Merge only after a Stage 13 run is green from start to end**, which needs SQR-01 fixed (and SQR-11). A delta review of the CI fixes will follow.

## 5. Findings

### SQR-01 · Major: Stage 13 fails after the exercise step; the install's weekly copy has been cleared

- **Where:** `deploy/windows/ci/assert-install.ps1:259-262`, called again at `.github/workflows/windows-package.yml:327`, `:339`, `:370` and `:382`, after `deploy/windows/ci/exercise-backup.ps1:113-126`.
- **Issue:** the exercise step makes 5 release copies and clears up to the date of the oldest removable copy. That removes the install's own weekly copy, because it is the oldest and not one of the newest 4. Each later `assert-install.ps1` sets `$first = @(... Reason -eq 'weekly')[0]` to `$null`. Under StrictMode 2.0, line 260 throws, and the decrypt and restore check after it cannot run.
- **Impact:** Stage 13 cannot pass, so AC-4, AC-6, AC-8 and the Amendment 3.2 removal proof never run before merge.
- **Fix (CI only, cheap; recommended in this PR):** run the weekly-copy checks (name, event, decrypt, restore) only in the call made straight after the install, with a new `-AfterInstall` switch. Later calls decrypt and restore the newest verified copy:
  ```powershell
  $first = @($copies | Where-Object { $_.Reason -eq 'weekly' } | Select-Object -First 1)
  if ($AfterInstall) { Assert-That ($first.Count -eq 1) 'the install made a weekly copy' }
  $probe = if ($first.Count -eq 1) { $first[0] } else { $copies[$copies.Count - 1] }
  ```
- **Test that catches it:** the next Stage 13 run. **GitHub issue:** #438 (`tech-debt`, `ai-delivery`).

### SQR-02 · Minor: secrets reach the PowerShell log if Group Policy turns on module logging

- **Where:** `deploy/windows/AccucutOps.psm1:1433` (`Register-ScheduledTask … -Password $password`) and `deploy/windows/install.ps1:1031` (`Write-AccucutBackupConfig -BackupPassword …`). The same class exists from 10.04 for other string parameters.
- **Issue:** with "Turn on Module Logging" set for `*` (common in hardened domains), event 4103 in Microsoft-Windows-PowerShell/Operational records the bound parameter values of cmdlets and module functions in plain text.
- **Impact:** the AccucutBackup password and the `accucut_backup` role password could persist in an event log. This conflicts with AC-7 ("no password in a log or transcript") on such a server. It is environmental, so Minor.
- **Fix:** cheap: a README line under Install, "check that PowerShell module logging is off for the install, or clear the PowerShell Operational log afterwards"; and an install warning when `HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging\EnableModuleLogging` is 1. Later: register the task through the `Schedule.Service` COM `RegisterTaskDefinition` (method calls are not module-logged), and pass secrets to module functions as `SecureString` or `PSCredential`.
- **Test:** a Pester case where the module-logging policy is mocked on, and the install warns.

### SQR-03 · Minor: `Write-AccucutBackupFile` creates the file, then locks it, and does not read the result back

- **Where:** `deploy/windows/AccucutOps.psm1:1577-1580`.
- **Issue:** the file is created empty with the ACL inherited from `config` (Root ACEs, including App, Worker and AccucutBackup with read). It is closed, then `SetAccessControl` runs, then the content is written. A reader that opened a handle in that window keeps read access after the ACL change, and can read the password once it is written. The folder (`New-AccucutBackupFolder`) and the root use create-with-security plus a read-back; these files do not.
- **Impact:** not exploitable at install today, because the services are registered and started only later. The pattern is the "create-then-lock" class that Amendment 2 removed, and a later caller (rotation, 10.11) would inherit it.
- **Fix:** `[System.IO.FileStream]::new($Path, [IO.FileMode]::CreateNew, [Security.AccessControl.FileSystemRights]::Write, [IO.FileShare]::None, 4096, [IO.FileOptions]::None, $security)`, then write through that stream, then read the owner, protection and three ACEs back as `New-AccucutBackupFolder` does (lines 1539-1545).
- **Test:** the existing real-ACL Pester case, plus an assertion that the descriptor is exact before any byte is written.

### SQR-04 · Minor: the preflight warning and the rollback's revoke error do not reach the install log

- **Where:**
  - `deploy/windows/install.ps1:960` calls `Test-AccucutBatchRightPolicy` without `-LogFile`;
  - `install.ps1:1084` and `AccucutOps.psm1:1437` call `Remove-AccucutBackupAccount` without `-LogFile`.
- **Issue:** the `-BatchRightPolicyConfirmed` warning (Amendment 3.2: "its use is logged as a warning") and the "remove the bare SID … by hand" error go only to the console. The install log, which is copied to `%TEMP%` on failure, misses them.
- **Fix:** pass `-LogFile $logFile` at both install call sites. Give `Register-AccucutBackupTask`'s catch `Remove-AccucutBackupAccount -LogFile $LogFile`.
- **Test:** an `install.Tests.ps1` case with `-BatchRightPolicyConfirmed` asserting that the warning is in the log file.

### SQR-05 · Minor: LSA handle and string allocated before `try`

- **Where:** `deploy/windows/AccucutOps.psm1:1208-1209`, `1240-1241` and `1261-1262`.
- **Issue:** `Open-AccucutLsaPolicy` and `New-AccucutLsaString` both run before `try`. If the second throws (out of memory), the policy handle leaks. In `finally`, a throw from `Remove-AccucutLsaString` would skip `LsaClose`.
- **Fix:** open the handle, then `try { $name = New-AccucutLsaString …; … } finally { if ($name) { Remove-AccucutLsaString $name }; Close-AccucutLsaPolicy $handle }`.
- **Note:** the read-only callers (`Get-AccucutRightHolder`, the preflight) could open with `0x801` instead of `0x811`. That is Info, as ADR-015 states `0x811` for every call.

### SQR-06 · Minor: one malformed volume variable also turns off the missed-week check, and it is logged as info

- **Where:** `src/server/jobs/backup-watch.ts:98-101` and `:197-201`.
- **Issue:** if either `PG_DATA_VOLUME` or `BACKUP_VOLUME` is set but is not a drive root, `scheduleBackupWatch` returns `undefined`. The whole job, including the AC-5 late flag, is then off, and the only trace is one info-level line at start-up.
- **Impact:** an `.env` typo silently disables the only alert for a stopped backup apart from Settings.
- **Fix:** log that case at `'error'`. Better: measure the valid volume, record a failed reading for the bad one, and always run the late check.
- **Test:** `scheduleBackupWatch({ dataVolume: 'D:', backupVolume: 'C:/' }, …)` logs at error and still schedules.

### SQR-07 · Minor: "low space" is recognised by the text of the message, in two places

- **Where:** `deploy/windows/AccucutOps.psm1:2076` and `deploy/windows/backup.ps1:590` (`-like 'Not enough free disk space*'`).
- **Issue:** the error code of the row and the event (`low-space`, 1012) and the decision not to write a second row depend on the wording of `Test-AccucutBackupRoom`'s message. Rewording it would write two rows and log event 1011.
- **Fix:** throw a marked error, for example `$e = [System.InvalidOperationException]::new($room.Message); $e.Data['AccucutCode'] = 'low-space'; throw $e`, and test `$_.Exception.Data['AccucutCode']`.
- **Test:** the existing low-space Pester case, asserting exactly one `job_runs` row and event 1012.

### SQR-08 · Info: `pg_read_all_data` is cluster-wide

- **Where:** `deploy/db/create-roles.psql:54`.
- **Note:** the role can also connect to, and read, any other database in the same PostgreSQL cluster whose CONNECT is still granted to PUBLIC. This is accepted by Amendment 3 point 3 and is harmless on a dedicated cluster.
- **Suggestion:** one README line, "keep this PostgreSQL for Accucut only".

### SQR-09 · Info: the removal step imports the repository's module, not the installed one

- **Where:** `deploy/windows/ci/assert-removal.ps1:20`.
- **Note:** Amendment 3.2 Stage 13 step 4 says "imports the installed module from `C:\Accucut\current`". The bytes are the same source, so this is not a defect. Align the code or the ADR text when convenient.

### SQR-10 · Info: an error event can hold a path

- **Where:** `deploy/windows/backup.ps1:530` (comment) and `:592`.
- **Note:** an Error event (1010, 1011, 1012) carries the exception message, which can name a path. This is not a secret, and the Information event is path-free (asserted in Stage 13). Correct the comment, or strip paths if the rule is meant literally.

### SQR-11 · Info: Stage 13 on `7f17383` passed every install assertion but the step exited 1

- **Where:** `.github/workflows/windows-package.yml:313-315`.
- **Note:** run 43738704002 printed "All install assertions passed." and then `Process completed with exit code 1`, from the last native exit code left in `$LASTEXITCODE`.
- **Fix:** end `assert-install.ps1` (or the step) with `$global:LASTEXITCODE = 0`, as the other steps do. CI only; for the orchestrator's delta.

### SQR-12 · Info: what was done well

- The LSA design is right. It has no compiler, no program and no `-Right` parameter. It takes before and after set equality on grant and revoke, and Stage 13 compares it with an independent `secedit` oracle in both directions.
- The pipe is careful. It uses `CreateNew`, starts both processes directly, reads both standard-error streams asynchronously, checks both exit codes, the header and a non-zero size, and renames only after the manifest.
- Deletion is defensive. It re-proves each copy just before deleting it, never recurses, skips links, deletes only matching names, and treats unverified copies as kept.
- The role assertions in Stage 13 are real, not mocked, and the restore check proves that the copy is usable.

## 6. Issues for other roles

- **orchestrator:** see section 4. Do not merge on the required checks alone; wait for a Stage 13 run that is green end to end. Then send the CI delta (SQR-01, SQR-11) for a short re-check.
- **developer:** SQR-01 (with SQR-11) before the squash. SQR-02 (README line), SQR-04 and SQR-05 are a few lines each and fit this PR. SQR-03, SQR-06 and SQR-07 can go in this PR or in the hardening window.
