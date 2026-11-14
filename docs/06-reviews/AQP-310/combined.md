# Combined security-and-quality review: AQP-310 (STORY-10.04), PR #396

| Item | Value |
|---|---|
| Story | AQP-310, STORY-10.04: Install and update on Windows Server (native services, PowerShell) |
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/396 |
| Head reviewed | `b3338a20fdf98dfc98c9db840600dbb4052398b9`. The master merge `8114ccf` was not reviewed: it changes no file under `deploy/`, `scripts/` or the workflow (checked with `get_commit`). |
| Reviewer | reviewer-quality (one combined security-and-quality review, CLAUDE.md section 9 item 2, label `critical-review`) |
| Date | 2026-11-14 |
| Governing design | ADR-015 Amendment 2 (ref `docs/AQP-1-records-q`), architecture section 9.9 v0.45, test strategy section 10.8 v0.40 |
| Verdict | **REQUEST CHANGES**: no Blocker or Critical, 4 Majors (all small; fix before the squash recommended) |
| Counts | Blocker 0, Critical 0, Major 4, Minor 2, Info 3 |

## 1. What was checked and how

- **Method:** GitHub MCP only (`pull_request_read` get/get_files/get_commits, `get_file_contents` at `b3338a2`, `get_commit`). No git, no edits in any worktree, and no PowerShell run against the system. The added files were rebuilt from the PR patches; `install.ps1` matched the fetched copy apart from the final newline.
- **Read in full:** `deploy/windows/install.ps1` (1,103 lines), `update.ps1` (744), `AccucutOps.psm1` (908), `clean-logs.ps1`, `services/*.xml`, `tools.psd1`, `.github/workflows/windows-package.yml`, `deploy/db/create-roles.psql`, the `compose.dev.yml` and `docker/postgres-init/01-create-roles.sh` changes, `deploy/windows/README.md` (install and update sections), the repository `README.md` change, `src/app/api/health/route.ts`, `src/worker/main.ts`, and the manifest row.
- **Tests:** every Describe/It title in `Trust.Tests.ps1`, `install.Tests.ps1` and `update.Tests.ps1` was mapped to the 19 required tests. These were read in depth: block identity (Trust 99-111), AST self-containment and load sites (113-236), the marker-module and script tests (511-581), and the install order and full-path tests (install.Tests 339-454). The placeholder regression test (AccucutOps.Tests 125-129) and the static Vitest guards (`windows-deploy-files.test.ts`) were also checked.
- **Test run:** I did not run any tests (MCP-only review, and Pester 5 is not on this PC). Results are taken from CI: run 43648696949, 6 of 6 required checks green; Stage 13 run 43648696889 green, Pester 5 with 218 passed, 0 failed, 0 skipped. Both are on `b3338a2`.
- **Own check, by script on the fetched text:** the trust block is byte-identical in `install.ps1` and `update.ps1` (27,117 characters), and each marker appears exactly once in each script.
- **Jira:** AQP-310 description (AC-1 to AC-10) and comments 11901, 11902, 11903, 11907, 11909, 11910, 11916, 11918.

## 2. Findings

### SQR-01 · Major: `clean-logs.ps1` loads the module unchecked, as SYSTEM

- **Where:** `deploy/windows/clean-logs.ps1:16`, registered at `deploy/windows/install.ps1:828-841`.
- **Issue:** `Import-Module (Join-Path $PSScriptRoot 'AccucutOps.psm1')` has no trust block before it. The scheduled task `Accucut log cleanup` runs it daily as `NT AUTHORITY\SYSTEM`, through `C:\Accucut\current`.
- **Rule broken:** ADR-015 Amendment 2 (d): "it is loaded at I11 or U2 and nowhere else". Amendment 2 (f): "a later script that loads code carries the same block". Architecture section 9.9: "loaded only after the inline trust block has checked it". This is the same kind of gap as finding S-6. Required test 3 parses only `install.ps1` and `update.ps1`, so nothing catches this site.
- **Impact:** A non-admin cannot exploit it today, because the release tree sits under the protected root. That is why this is Major, not Critical. But it is a SYSTEM-level load site outside the trust flow, and later scripts would copy the pattern.
- **Fix:** make `clean-logs.ps1` self-contained, with no import and .NET only:
  ```powershell
  $limit = [DateTime]::UtcNow.AddDays(-$KeepDays)
  foreach ($file in [System.IO.Directory]::GetFiles($LogDirectory, '*.log')) {
      $attributes = [System.IO.File]::GetAttributes($file)
      if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
      if ([System.IO.File]::GetLastWriteTimeUtc($file) -lt $limit) { [System.IO.File]::Delete($file) }
  }
  ```
  Then add `clean-logs.ps1` to the AST load-site tests. Optional: run the task as `NT AUTHORITY\LOCAL SERVICE` with Modify on `logs`, instead of SYSTEM. Section 9.9 gives the backup task "a local account of its own".
- **Test that catches it:** `Trust.Tests.ps1` "neither script dot-sources …" and "Import-Module is called in one place only", extended to `clean-logs.ps1` with an expected import count of 0.

### SQR-02 · Major: no rollback between the junction switch and the health check

- **Where:** `deploy/windows/update.ps1:699-704`. The rollback branch is at 709-712.
- **Issue:** `Set-AccucutCurrentRelease`, `Initialize-AccucutServiceFiles`, the `Resolve-AccucutTrustedExecutable` loop on WinSW (line 702, which throws by design whenever the trust rule refuses a program) and `Update-AccucutServiceProgram` all run outside any `try`. When one of them throws, the top-level `catch` only prints and exits 1. The services stay stopped, `current` points at the new, already-migrated release, the old release is not restarted, and no "Call your IT person" message appears. The rollback branch is not exception-safe either: if `Restore-AccucutServiceFiles` throws inside its WinSW check, the previous release never starts.
- **Impact:** AC-4. A failure after the update leaves the portal down with no automatic recovery.
- **Fix:** wrap lines 699-704 in a `try`. In the `catch`, run the same rollback: stop the services, move the junction back to `$oldTag`, restore the service files, start them, log "Call your IT person" and throw. Give each rollback step its own `try`, so that one failure never skips "start the previous release".
- **Test that catches it:** `update.Tests.ps1`: mock `Initialize-AccucutServiceFiles` to throw, and in a second case `Resolve-AccucutTrustedExecutable` for `*Accucut*.exe`. Assert that the last junction call targets the old tag, that `Start-AccucutServicesAndCheck` ran, and that the error names "Call your IT person".

### SQR-03 · Major: install and update logs are appended in a folder the services can write

- **Where:** `deploy/windows/AccucutOps.psm1:288-292` (`Add-Content`), used for `logs\install-<time>.log` (`install.ps1:893`) and `logs\update-<time>.log` (`update.ps1:658`).
- **Issue:** ADR-015 Amendment 2 (d): "Log files in `logs` (writable by the services) are opened with `FileMode.CreateNew` under a fresh timestamped name, never appended to or followed." The code does not do this, and no test checks it. Both service accounts hold Modify on `logs` (`install.ps1:975`). The same inherited Modify reaches the install log while the install is still writing to it.
- **Impact:** an attacker who takes over the web app (`NT SERVICE\AccucutApp`) can pre-create or swap the predictable update log. With that they can forge lines, or hold the file with an exclusive handle so every `Write-AccucutLog` throws and the update aborts part-way, including inside the rollback. On a host that still lets an unprivileged account hard-link to a file it can only read, they could point the admin's appends at, for example, `config\.env` or a release file.
- **Fix:** write install and update logs to a folder the services cannot write (for example `<Root>\logs\admin`, protected, Administrators and SYSTEM only, checked with Rule B). Or open the log once with `[IO.FileMode]::CreateNew` and `FileShare.Read`, keep the stream for the whole run, and refuse if the name already exists.
- **Test that catches it:** pre-create the update log, then assert that the update refuses before any change or writes to a new file. Add a static check that no `Add-Content` targets a log path.

### SQR-04 · Major: the repository README undoes the R-T1 mitigation

- **Where:** `README.md:149-155`. Also the update example at `deploy/windows/README.md:122`.
- **Issue:** the repository README says to unpack to `C:\accucut-pkg` and run `.\install.ps1 -ZipPath <the zip>` with no `-Sha256`. The deploy README (steps 2-4) says to unpack into an admin-only folder (`C:\Program Files\accucut-pkg`) and type `-Sha256` from the release page, and warns that `C:\accucut-pkg` is not fine on a shared server. Neither README's update command shows `-Sha256` (R-T2: a `.sha256` file next to the zip guards against a bad download only).
- **Impact:** R-T1 was accepted only because of that README instruction. A new folder under `C:\` inherits the drive root's create and inherit-only rights for ordinary users. A local non-admin could replace `install.ps1` before the administrator runs it, and their code would run elevated.
- **Fix (docs only):** use the deploy README's steps in the repository README, or link to them. Show `-Sha256 <hash from the release page>` in the install and update commands of both READMEs.
- **Test that catches it:** a Vitest check in `windows-deploy-files.test.ts` that neither README tells IT to unpack under `C:\` and that every install or update command shows `-Sha256`.

### SQR-05 · Minor: a second half started by hand can remove an existing root

- **Where:** `deploy/windows/install.ps1:1016` (`Remove-AccucutInstallRoot`) and `install.ps1:1048-1065`.
- **Issue:** the second half trusts `-Root` and `-VerifiedRelease` from its command line, does not call `Assert-AccucutTrustedRootShape`, and has no proof that this run created `Root`. Suppose it is started by hand from the right place, on an install whose services were removed. When any step then fails, the whole root is deleted: `config\.env` (the only copy of the role passwords), the logs, and, once 10.05 lands, `backups\`.
- **Impact:** data loss that cannot be undone. Unlikely, because it needs an internal switch the README says never to use.
- **Fix:** call `Assert-AccucutTrustedRootShape` in the second half. Refuse before creating anything if `<Root>\config` or `install-state.json` already exists. Remove the root only when this run created `config`.
- **Test:** the second half with an existing `config\.env` stops, and the root stays.

### SQR-06 · Minor: the order trace (required test 7) does not cover the native programs

- **Where:** `deploy/windows/tests/install.Tests.ps1:388-391`. The update counterpart is `update.Tests.ps1:173`.
- **Issue:** `Should -Invoke Resolve-AccucutTrustedExecutable` proves that node, psql and WinSW were resolved, but not that the check came before the run. `Invoke-AccucutNative` writes no `run:` entry. The code order is right today; the gap is that the test would not catch a future reordering.
- **Fix:** have both mocks append to one shared list (`check:<path>`, `run:<path>`) and assert that each `run:` comes right after a `check:` of the same path.

### SQR-07 · Info: `Get-Item` is an exception missing from the ADR

- **Where:** `install.ps1:473` (the same line is in `update.ps1`'s copy of the block).
- **Issue:** the amendment lists only `Import-Module` and the child `powershell.exe` as exceptions. The block comment and test 2 also document `Microsoft.PowerShell.Management\Get-Item`. On PowerShell 5.1 there is no .NET API that reads a junction target without P/Invoke, so the choice is reasonable.
- **Ask:** solution-architect adds it to the amendment.

### SQR-08 · Info: a residual in the two-step security read

- **Where:** `install.ps1:325` (`New-AccucutTrustedRoot`) and `Get-AccucutTrustSecurity`.
- **Issue:** attributes are read without following a link, but the ACL is read by name, which does follow one. An attacker who won the create race could swap the root to a junction between the two reads and pass the exact check. They would then have to win the same race again at every later check. Not practical.
- **Ask:** record it as a residual under (c). Optional hardening: re-read the attributes after the descriptor.

### SQR-09 · Info: rollback does not restore the previous WinSW program

- **Where:** `update.ps1:711`.
- **Issue:** the rollback restores the XML snapshot but not the previous WinSW `.exe` when the new release brought a different one. Low risk, because WinSW is pinned at 2.12.0.
- **Fix:** take a byte snapshot of the two `.exe` files next to the XML snapshot, together with the SQR-02 fix.

## 3. ADR-015 Amendment 2: conformance per step

| Step | Implemented as written | Notes |
|---|---|---|
| I1 first half imports nothing, StrictMode and Stop | yes | The AST test confirms it (Trust 200-208). |
| I2 admin, root shape plus volume, expected SHA-256 | yes | `Assert-AccucutTrustedRootShape`: regex `^[A-Za-z]:\\[A-Za-z0-9_-]{1,32}$`, `DriveInfo` Fixed and NTFS. |
| I3 source hash before anything is created | yes | |
| I4 root must not exist; Rule A on the drive root | yes | `GetAttributes` does not follow a link. Only "not found" counts as absent. |
| I5 created locked in one call, then the exact check | yes | Owner S-1-5-32-544, protected, exactly SYSTEM and Administrators at 0x1F01FF, not inherited, not inherit-only, empty, no reparse. Someone else's folder is never removed (the throw comes before the `try`). See SQR-08. |
| I6 `.in\<guid>` copy with `CreateNew`, Rule B on the copy, hash of the copy | yes | |
| I7 unpack from the copy, entry checks, tag, move, reparse scan, scratch deleted | yes | Leading `/` or `\` (rooted and UNC), any `:` (drive letters and ADS) and `..` segments are refused. The destination-prefix check stays, and so does the reparse scan after the move. The `[...nextauth]` relaxation is safe. |
| I8 hand-off through `Invoke-AccucutTrustedScript` | yes | `powershell.exe` resolved and the script checked immediately before `Process.Start`; `-NoProfile -ExecutionPolicy Bypass -File`. |
| I9 location check | yes | Root shape is not re-checked (SQR-05). |
| I10 Rule B chain plus reparse scan | yes | |
| I11 module loaded only here | yes in `install.ps1`; **no across the package** | SQR-01 (`clean-logs.ps1`). |
| I12 node, psql, powershell by full path | yes | Default `$env:ProgramFiles\nodejs\node.exe`. Stage 13 passes `-NodeExe C:\Program Files\nodejs\node.exe`. |
| I13 settings, DB, migrations, WinSW checked before install, ACLs, Defender, backup task through the wrapper | yes | |
| I14 cleanup before any service exists | yes | Edge case in SQR-05. |
| U1 run from `current`; Rule B on root, releases, old, `update.ps1`, module, config, services; logs with `-Writer` | yes | |
| U2 import only after the check | yes | |
| U3 / U4 hash fail-fast; backup through the wrapper, or stop, or `-NoBackup` | yes | |
| U5 a release folder is never reused; the running tag is refused | yes | |
| U6 stop, Rule B plus scan again, node resolved, migrate | yes | |
| U7 / U8 switch, WinSW checked, refresh, health, rollback | partly | SQR-02, SQR-09. |
| (d) module limits | module: yes; log rule: no | The module has no trust, root, zip, load or PATH functions, and only `Verb-Accucut*` exports. SQR-03. |
| (e) 19 required tests | yes, with one gap | Test 7 covers the native programs only weakly (SQR-06). |

**Trust-block arithmetic, checked by hand.** Generic mapping: 0x10000000 → 0x1F01FF, 0x40000000 → 0x120116, 0x80000000 → 0x120089, 0x20000000 → 0x1200A0, then `-band 0x0FFFFFFF`. A negative `int` mask is handled through `UInt32`. Rule A forbidden mask 0xD0040 = 0x40 | 0x10000 | 0x40000 | 0x80000; the drive root uses 0xC0040. Rule B allow-list 0x1200A9 = 0x1 | 0x8 | 0x20 | 0x80 | 0x20000 | 0x100000, which equals FILE_GENERIC_READ | FILE_GENERIC_EXECUTE. ACCESS_SYSTEM_SECURITY and MAXIMUM_ALLOWED are refused. Flags: INHERIT_ONLY 0x08, INHERITED 0x10, SE_DACL_PROTECTED 0x1000. Rule A ignores inherit-only ACEs; Rule B checks them. The only exception is an inherit-only CREATOR OWNER; OWNER RIGHTS counts as an ordinary account. A null DACL, ACEs that are not `CommonAce`, callback ACEs and audit or alarm qualifiers are refused, and deny ACEs are ignored. `-Writer` applies only to the last path component.

## 4. The six earlier findings

| # | Finding | Status |
|---|---|---|
| S-1 | Pre-existing root | Closed (I4, I5; stage 13 step iii) |
| S-2 | Unverified extracted copy | Closed (I6, I7; stage 13 step i) |
| S-3 | Create-then-lock race | Closed (one-call create plus exact check; no `Set-Acl` or `icacls` in `install.ps1`, by static test) |
| S-4 | Ancestor walk | Closed (every component from the drive root; the root shape leaves only the drive root above) |
| S-5 | Generic rights and CREATOR OWNER | Closed (see arithmetic above) |
| S-6 | Load before check | Closed in `install.ps1` and `update.ps1`. **The same kind of gap is re-introduced in `clean-logs.ps1` (SQR-01).** |

## 5. Secrets (AC-5)

- No secret is on a command line. The `postgres` password goes to psql as `PGPASSWORD` in the child's environment. The owner and app passwords reach the SQL through `\getenv`. The owner URL reaches Prisma, and the Admin password reaches `bootstrap-admin`, in the child's environment. The first half passes only a values-file path to the second half. `sc.exe config obj=` takes no password.
- Every secret is registered for redaction, and `Invoke-AccucutNative` blanks child output. `assert-install.ps1` scans every log for the real values.
- `.env` is protected: Administrators full control, the two service SIDs read. `migrate.env` is protected, Administrators only, and is written before the root grant, so the service SIDs never inherit access to it. The first Admin password is removed after its one use.
- Placeholder detection uses `Contains('CHANGE_ME')`, so a placeholder anywhere in a value is refused. That fixes the `...:CHANGE_ME_OWNER_PASSWORD@...` case, and a regression test covers it.
- The services run as `NT SERVICE\AccucutApp` and `NT SERVICE\AccucutWorker`, verified through CIM; never LocalSystem.
- Stage 13 invents every value per run, masks it, deletes the values file, and changes the image's `postgres` password through stdin.

## 6. CI limits (DL-211)

The workflow is separate (`.github/workflows/windows-package.yml`), has `permissions: contents: read`, uses the `pull_request` trigger and never `pull_request_target`, and uses no secret. All actions are pinned to commit SHAs. WinSW, age and the Node MSI are refused unless their SHA-256 matches `tools.psd1`. `ci.yml` is not in the diff, and the static test asserts the fan-in still has `needs: [verify, e2e]` and does not name stage 13. I could not inspect branch protection itself through MCP.

## 7. AC conformance (Jira AQP-310)

| AC | Implemented in | Test | Result |
|---|---|---|---|
| AC-1 install | `install.ps1` (both halves), `AccucutOps.psm1`, `create-roles.psql`, `services/*.xml` | `Trust.Tests.ps1`, `install.Tests.ps1`, `AccucutOps.Tests.ps1`; stage 13 install plus `assert-install.ps1` | Met |
| AC-2 reboot | WinSW Automatic (Delayed Start), depends on `postgresql-x64-17`, restart 10/30/60 s | `assert-install.ps1` (CIM, `sc qc`, `sc qfailure`); a real reboot is manual (section 10.8) | Met |
| AC-3 update | `update.ps1` U1 to U8 | `update.Tests.ps1`; stage 13 update, 2 releases kept | Met |
| AC-4 rollback | health-fail path | `update.Tests.ps1`; stage 13 broken release | **Partly** (SQR-02) |
| AC-5 secrets | see section 5 | install and Ops Pester; `assert-install.ps1` log scan | Met |
| AC-6 logs | WinSW roll-by-time plus the 30-day task | Ops Pester | Met (SQR-01 concerns how the task loads code) |
| AC-7 Defender | `Set-AccucutDefenderExclusion` | install Pester; stage 13 | Met |
| AC-8 stage 13 | `windows-package.yml` | `windows-deploy-files.test.ts`; green run | Met |
| AC-9 policy | separate workflow, not a required check, outside the fan-in | static test | Met |
| AC-10 | No `Dockerfile` or production Compose file existed at `b3338a2` (root listing checked). `compose.dev.yml` and `docker/postgres-init` are kept and now read `deploy/db/create-roles.psql`. No file was deleted, and CI is green. A Windows section was added to the README. | static test; CI | Met (see SQR-04 for the README content) |

**README wording for R-T1 and R-T4** (developer question, Jira 11916): in `deploy/windows/README.md`, steps 2-3, "The one thing the script cannot do for you", and "A note on who owns the files" are accurate and match the ADR. The repository README contradicts R-T1 (SQR-04).

**D-1** (`/api/health`, worker shell): minimal. The route answers only `ok` or `unavailable`, prints no error, and is listed in the manifest as public. Accepted as the stated assumption.

## 8. Issues for other roles

- **solution-architect:** add `Get-Item` to the Amendment 2 list of exceptions (SQR-07). Record the attributes-then-ACL residual under (c) (SQR-08). Confirm that the log-cleanup task's account should be a low-privilege one, as for the backup task (SQR-01).
- **developer:** SQR-01 to SQR-04 before the squash; SQR-05 and SQR-06 recommended in the same pass.

## Hand-off

- Status: COMPLETE
- Verdict: REQUEST CHANGES (Blocker 0, Critical 0, Major 4, Minor 2, Info 3)
- Artefacts: this file; PR review on #396 (COMMENT, 9 inline comments); label `review:quality-changes-requested`
- Recommended next agent: developer, to fix SQR-01 to SQR-04 (and SQR-05 and SQR-06 if cheap). Then a re-review of the new diff only.
