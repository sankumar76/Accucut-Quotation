# ADR-015: Native Windows services on one Windows Server

| Field | Value |
|-------|-------|
| Status | **Accepted (solution-architect ruling, 2026-11-13, fast track, CLAUDE.md section 9), for `master` to log.** It **supersedes ADR-002 for the runtime and the install model** (Docker Compose, the `migrate` container, the Caddy profile, `restore.sh` and `clear-copies.sh`). ADR-002's other decisions stand: one host, backups on the same server, the Admin holds the key and runs the restore, 2 years "as the disk allows". **Rests on assumptions A-01 (restated), A-35 (restated for Windows), A-39 and A-40.** **Amended 2026-11-13: OQ-ARCH-14 answered, one disk of about 100 GB (see Amendment)**. **Amended 2026-11-14: the install and update trust flow (Amendment 2, STORY-10.04, AQP-310, PR #396), with Amendment 2.1 (rulings on the combined review: SQR-01, 07, 08, 09)**. **Amended 2026-11-15: backups on Windows (Amendment 3, STORY-10.05, AQP-311)** |
| Date | 2026-11-13 |
| Deciders | solution-architect; the delivery lead's stated target (AQP-1 comment 11790, relayed); Accucut IT confirms at install |
| Related | FR-091, FR-105; NFR-003, 012, 013, 024, 030; ADR-001, ADR-002, ADR-011; OQ-ARCH-02, OQ-ARCH-03, OQ-ARCH-14; STORY-10.04, 10.05, 10.11, 02.09; architecture section 9.9; test strategy section 10.8 |

## Context

The delivery lead stated on 2026-11-13: "build 10.04, 10.05 and 10.11 now, against the assumption that the target is a **Windows Server with a 40 GB disk**". This replaces assumption A-01 (one Linux VM with Docker). The limited Admin account (A-35) stays an assumption. Nothing in the deployment has been built yet: `compose.dev.yml` is for local development only, CI stage 13 (image) is disabled, and there is no `Dockerfile`, production Compose file or script. So the switch costs no written code.

The application itself is portable: Node 22, Next.js `output: 'standalone'`, Prisma 7 with the `pg` driver adapter (no engine binary), `@node-rs/argon2` (prebuilt Windows x64 binary), `node-cron` in the worker (ADR-011).

## Decision Drivers

- The least operational risk for a small IT team with no platform engineer (the brief).
- NFR-013 and FR-091: a weekly encrypted backup, a guided restore and a guided clear, run by an Admin who is not a system administrator; **40 GB** (OQ-ARCH-03, DL-034), **grown to one 100 GB disk by OQ-ARCH-14 (Amendment)**.
- NFR-030: a clean machine reaches the sign-in page within 30 minutes by the README.
- NFR-012: 99.0 % a month on one host; NFR-024: logs kept 30 days.
- Supported, licensed components only; nothing in preview.

## Considered Options

### Option A — Docker on Windows Server running the existing Linux images (WSL2 or Hyper-V)

What was checked (2026-11-13; sources in the hand-off):
- **Docker Desktop is not supported on Windows Server** ("not supported on server versions of Windows, such as Windows Server 2019 or Windows Server 2022", docs.docker.com, Windows install page). It also needs a paid subscription for a company over 250 staff or USD 10 million revenue.
- **Docker Engine or Mirantis Container Runtime directly on Windows Server runs Windows containers.** Linux containers on Windows (LCOW) are deprecated on Windows Server (Microsoft support policy for Windows Server containers). Mirantis is a paid, supported product for Windows containers. The images here (`postgres:17`, a Node image) are Linux.
- So the Linux images need **Docker Engine inside WSL2**, or inside a **Hyper-V Linux VM**. WSL2 installs with `wsl --install` on Server 2022 and 2025, and by manual steps on 2019 (Microsoft Learn). Inside a VM it needs nested virtualisation. Microsoft's WSL FAQ says WSL "has been designed and built to use with inner loop development workflows": its VM **shuts down when no Windows process holds it**, and **its Linux kernel updates automatically**. Microsoft's WSL container API is a public preview (June 2026).
- Pros: one runtime model for development, CI and production; the Compose design is already written down.
- Cons: an unsupported production pattern (WSL) or a second operating system to patch (Hyper-V VM). Neither is a Windows skill. WSL's virtual disk grows and **does not shrink by itself**, so a copy cleared inside it does not give space back to the 40 GB volume, which would defeat `clear-copies`. A Linux VM also spends 40 GB on two operating systems. The Admin's limited account would need to cross the Windows-Linux boundary.
- Cost / effort: about the same scripts, plus WSL or VM set-up and its failure modes; highest risk.

### Option B — Native Node 22 LTS and PostgreSQL 17 as Windows services, PowerShell scripts (chosen)

- Pros: everything is a Windows service, a scheduled task or a PowerShell script, which a Windows IT person already runs. One operating system on the disk. Supported by the vendors: Node 22 is Tier 1 on Windows 10 and Server 2016 or later (Node `BUILDING.md`). The PostgreSQL 17 Windows installer installs it as a service. The EDB platform list names **Windows Server 2022 for PostgreSQL 17**, and Server 2025 only from PostgreSQL 18. GitHub's `windows-latest` image (Server 2025) ships PostgreSQL 17.11, so CI can test the scripts on Windows with no install step. Every added component has a compatible licence: PostgreSQL (PostgreSQL Licence), Node (MIT), WinSW 2.12.0 (MIT, stable), `age` (BSD-3-Clause, Windows binaries) and Caddy (Apache-2.0, optional). The Admin's limited account can be built with Windows' own Just Enough Administration (JEA).
- Cons: production differs from development and CI, which run Linux, so a Windows-only defect (paths, file locks, services) can slip past the Linux suites. Stage 13 on Windows covers this (below). The IT person updates Node and PostgreSQL by hand; there is no image to pull. Node 22 reaches end of life on 2027-04-30 (ARCH-R9). Windows PowerShell 5.1 pipelines turn native output into text, so binary pipes must go through `cmd.exe`.
- Cost / effort: the scripts are about the size of the Linux ones, and the `Dockerfile` and Compose file are no longer needed. JEA, the Windows package and stage 13 on Windows add about 2 to 4 hours in total, net, which is 0.25 to 0.5 of a working day in one lane (architecture 9.9).

## Decision

**We will run the portal natively on one Windows Server: PostgreSQL 17 as its own Windows service, the `app` (Next.js standalone server) and the `worker` as two Windows services wrapped by WinSW 2.12.0, and PowerShell 5.1 scripts for install, update, backup, clear and restore.** Option A is rejected because the only way to run the Linux images on Windows Server is WSL2 or a Linux VM. WSL2 is a development tool that Microsoft does not position for unattended production, and its disk does not give space back. A Linux VM is the Linux server that the stated target replaces, with two operating systems on 40 GB.

- **Recommended OS: Windows Server 2022 Standard** (EDB lists it for PostgreSQL 17). Server 2025 works (CI runs on it), but PostgreSQL 17 is outside EDB's list for it. Server 2019 is not recommended. A-39 records this.
- **Scripts target Windows PowerShell 5.1**, which is built into every Windows Server version, so nothing extra is installed. Rules: byte streams (`pg_dump | age`, `age -d | pg_restore`) run inside `cmd.exe /c`; secrets enter through standard input (`age -d -i -`) or an ACL'd `PGPASSFILE`, never a command line; downloaded scripts are unblocked by `install.ps1` only after their SHA-256 matches.
- **The release package is built by CI on `windows-latest`** (stage 13, test strategy 10.8): a zip of the standalone server, the worker, Prisma migrations, the scripts and the WinSW configurations, with a SHA-256. The server never runs `npm`, so it needs no build tools and no access to the npm registry, and it keeps disk free.
- **The Admin's limited account (A-35, Windows form):** a standard user, not in Administrators, who may use one JEA endpoint. The endpoint runs as a virtual account and exposes exactly two commands, `Restore-AccucutBackup` and `Clear-AccucutCopies`. This is the Windows equivalent of "`sudo` for two scripts". If Accucut IT prefers full administrator rights, the same scripts run unchanged, and RISK-018 applies in full.

## Consequences

- Positive: one operating system and Windows-native tools; no container runtime to license or patch; services restart after a Windows Update reboot; the restore and clear commands are still one guided command each.
- Negative / trade-offs accepted:
  - **Windows itself takes about 20 GB more of the 40 GB than a Linux host did, so the retention ceiling falls from about 5 to 6 GB of data to about 1.4 GB** (architecture 9.9, ARCH-R10). 2 years of weekly copies does not fit unless the data stays under about 0.07 GB. **Superseded by the Amendment: on one 100 GB disk the ceiling is about 10 GB, and 2 years fits under about 0.5 GB.**
  - Runtime parity with CI is lost; stage 13 on Windows is the mitigation.
  - Manual runtime updates (Node, PostgreSQL minor versions) are now the IT person's, through `update.ps1`.
- Follow-up actions (with owners):
  - developer: STORY-10.04, 10.05 and 10.11 as restated in architecture 9.9.
  - product-manager: restate FR-091 and NFR-030 ("`docker compose up`" becomes "`install.ps1` from the release zip").
  - product-owner and scrum-master: restate the three EPIC-10 rows and STORY-02.09.
  - master: log the decision; ARCH-R9 and ARCH-R10 to the register.
  - Accucut IT: confirm the Windows version and whether the JEA account suits them (A-35); provide one disk of about 100 GB (OQ-ARCH-14, answered); the off-server copy is recommended to them (Amendment).

## Amendment, 2026-11-13: OQ-ARCH-14 answered (one disk of about 100 GB)

**Decision (the delivery lead, option (b), relayed in the orchestrator's brief on AQP-1):** grow the server's one disk to about 100 GB. The backups stay on the same disk as the data. Options (a), a second volume for the backups, and (c), accepting the 40 GB ceiling, were not chosen. The delivery lead was told that one disk failure loses both the data and its backups.

- **Retention (architecture 9.9, v0.44, same method as for 40 GB):** fixed use about 25 GB, 20 GB kept free, about 55 GB for the live data and its copies. 2 years of weekly copies at 0.25 and 0.5 GB of data; about a year at 1 GB; about 6 months at 2 GB. **Ceiling about 10 GB of data** (was about 1.4 GB). With the invented rates and a start at 0.1 GB, it is reached after about 99 weeks at 0.1 GB a week, about 20 weeks at 0.5 GB a week, and about 9.5 years at 0.02 GB a week.
- **Single-disk risk (ARCH-R10, reworded):** a disk failure or the loss of the server loses the data and every backup together (RISK-011). Accepted by the delivery lead.
- **Go-live recommendation, owner Accucut IT:** copy each weekly encrypted backup off the server (a scheduled copy to a network share or other storage), keeping the key elsewhere. A recommendation only: no code, no script, no story.
- **No change** to the scripts, the stories, the effort or stage 13: the paths are configurable and the free-space thresholds are percentages.

## Amendment 2, 2026-11-14: install and update trust flow (STORY-10.04)

**Why.** Six rounds of automated security review on PR #396 (Jira AQP-310 comments 11901, 11902, 11903, 11907) each found a gap in a design that grew by patches: a reused root, an unverified extracted copy, a create-then-lock race, a short ancestor walk, generic rights and CREATOR OWNER, and finally code loaded before it was checked. This amendment replaces the patches with one flow. It is a rule inside ADR-015's decision, not a new decision, so it is an amendment and not ADR-016. The reviewer's rule is adopted as stated: **code is never loaded or run before it is checked, and code is never checked with functions from the code being checked.**

**Decision (b): one inline trust block, duplicated on purpose.** The check lives as a self-contained block, byte-identical in `install.ps1` and `update.ps1` between the lines `# >>> ACCUCUT TRUST BLOCK v1` and `# <<< ACCUCUT TRUST BLOCK v1`. A test compares the two. A later script that loads code (10.05 `backup.ps1`, 10.11 `restore.ps1`) carries the same block and joins the test. The block uses only .NET calls and PowerShell language features, never a cmdlet that a module could shadow. The only exceptions are the two load calls, written module-qualified as `Microsoft.PowerShell.Core\Import-Module` and the child `powershell.exe`. **Rejected:** a separate `trust.ps1` file, because loading it is loading code before it is checked; and the check in `AccucutOps.psm1`, because that checks the module with its own functions.

### The block's functions (names are fixed; the module may not reuse them)

| Function | Does |
|----------|------|
| `Get-AccucutTrustSecurity -Path` | The only reader of security, and the Pester mock point. It reads attributes with `[IO.File]::GetAttributes` (this does not follow a link), and owner and DACL as a `RawSecurityDescriptor` from `GetAccessControl('Owner, Access').GetSecurityDescriptorBinaryForm()`. It returns the owner SID, the protected flag, the reparse flag and every ACE as {SID, allow or deny, mask after generic mapping, inherit-only}. **It refuses a null DACL and any ACE that is not a `CommonAce`** (object, callback or compound ACEs). |
| `Assert-AccucutTrustedPath -Path -Root [-Writer <SID[]>]` | Walks every component from the drive root to `Path` and applies Rule A above `Root` and Rule B from `Root` down (below). It appends `check:<full path>` to `$script:AccucutTrustLog`. |
| `New-AccucutTrustedRoot -Root` | Creates the root with its security in one call, then checks it (step I5). |
| `Get-AccucutTrustedSha256 -Path` | SHA-256 over a `FileStream` opened with `FileShare.Read`, so no writer can change the file while it is read. |
| `Expand-AccucutTrustedPackage -Root -ZipPath -Sha256` | Steps I6 and I7 (copy, hash the copy, extract, move); returns `<Root>\releases\<tag>`. |
| `Get-AccucutTrustedCurrent -Root` | `<Root>\current` must be a junction (`LinkType` is `Junction`) whose `Target` is exactly `<Root>\releases\<tag>`, with `<tag>` matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`. Returns the target, which it has checked. This is the only place a reparse point is accepted. |
| `Resolve-AccucutTrustedExecutable -Path` | Checks a native program (`node.exe`, `psql.exe`, `powershell.exe`, the WinSW `.exe` files) and returns its full path. The program and its own folder get Rule B, because Windows searches that folder first for DLLs. Programs are never found through `PATH`. |
| `Import-AccucutTrustedModule -Root -Release` | Runs `Assert-AccucutTrustedPath` on `<Release>\AccucutOps.psm1` and then imports that exact path. It logs `load:<path>`. |
| `Invoke-AccucutTrustedScript -Root -Path -ArgumentList` | Checks `powershell.exe` and the script, then runs `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <path> …` as a child process and checks its exit code. It logs `run:<path>`. |

**Trusted SIDs** (as owners, and as ACE holders with any rights): Administrators `S-1-5-32-544`, SYSTEM `S-1-5-18`, and TrustedInstaller `S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464`, which owns `C:\` and `Program Files`. Every other SID is untrusted, **CREATOR OWNER (`S-1-3-0`) and OWNER RIGHTS (`S-1-3-4`) included**. Deny ACEs are ignored, because they only remove access.

**Generic mapping, applied before any test:** GENERIC_ALL `0x10000000` becomes `0x1F01FF`, GENERIC_WRITE `0x40000000` becomes `0x120116`, GENERIC_READ `0x80000000` becomes `0x120089` and GENERIC_EXECUTE `0x20000000` becomes `0x1200A0`. The generic bits are then cleared.

**Rule A (the drive root, and every component above `Root` or above an executable's folder).** The component must not be a reparse point, and its owner must be trusted. Inherit-only ACEs are ignored: they reach only children, and each child is checked on its own. An effective ACE of an untrusted SID must not hold any bit of `0x000D0040` (DeleteChild, DELETE, WRITE_DAC, WRITE_OWNER). **The exact drive-root rule:** the drive root is held to `0x000C0040`, because DELETE on a volume root can delete nothing. The Windows default for a drive root therefore passes: Users or Authenticated Users with create-folder and create-file rights on the root itself, and Modify or Full inherit-only. GENERIC_ALL, DeleteChild, WRITE_DAC or WRITE_OWNER for a non-admin there is refused.

**Rule B (`Root` and every component below it on a checked path; an executable and its folder).** The component must not be a reparse point, and its owner must be trusted. **Every** ACE of an untrusted SID, effective or inherit-only, must hold only bits inside `0x001200A9` (read, list, execute, read attributes and extended attributes, READ_CONTROL, SYNCHRONIZE). Any other bit refuses, including ACCESS_SYSTEM_SECURITY and MAXIMUM_ALLOWED. This is an allow-list, so an unknown right cannot pass. One exception: an inherit-only CREATOR OWNER ACE is accepted, because the same rule leaves no untrusted SID able to create a child, so CREATOR OWNER can only ever name a trusted creator. Program Files folders carry such an ACE. `Root` must also have a protected DACL. `-Writer` is used only for `<Root>\logs`: it lets the two service SIDs hold up to Modify (`0x1301BF`). `logs` holds no code.

**Root shape:** `-Root` must match `^[A-Za-z]:\\[A-Za-z0-9_-]{1,32}$`, which puts it **exactly one level below a drive root** (default `C:\Accucut`; `D:\Accucut` is allowed). The volume must be `Fixed` and `NTFS` (`[IO.DriveInfo]`). So the only ancestor is a drive root, which cannot be swapped or be a link, and the whole class of races on ancestors is gone. UNC paths, `\\?\` paths, relative paths, `..`, `:` and deeper roots are refused.

**Name re-resolution (c).** After the steps below, every path that is loaded or run lies under a chain that only trusted SIDs can change. Resolving such a name again cannot reach a non-admin's object. The flow therefore does not try to work on handles; it **re-checks the chain at the moment of each load or run**, inside `Import-AccucutTrustedModule`, `Invoke-AccucutTrustedScript` and `Resolve-AccucutTrustedExecutable`. The cost is a few milliseconds.

### (a) Step order. T = trusted from here on, and why

**install.ps1, first half** (started by IT from the unpacked zip as `powershell -ExecutionPolicy Bypass -File .\install.ps1 -ZipPath … [-Sha256 …]`):

1. **The script starts.** It is the trust anchor: what an administrator chose to run, and no script can verify itself (residual R-T1). There is no `Import-Module` and no dot-source; it calls only the inline block and its own inline code. It sets `Set-StrictMode` and `$ErrorActionPreference = 'Stop'`.
2. It checks for administrator rights, the shape of `-Root` and the volume, and the expected SHA-256 (`-Sha256`, or the first token of `<zip>.sha256`, which is a hint against corruption only).
3. `Get-AccucutTrustedSha256` on the source zip. On a mismatch it stops, and **nothing has been created**. This check is a fail-fast for the user, not the trust step.
4. **`Root` must not exist.** Any existing file, folder or link refuses (finding 1; replaces "empty and admin-owned"). Rule A on the drive root.
5. `New-AccucutTrustedRoot` calls `[IO.Directory]::CreateDirectory(Root, DirectorySecurity)`, which in .NET Framework sets the descriptor at creation, with: owner Administrators; DACL protected; exactly Administrators `0x1F01FF` (OI CI) and SYSTEM `0x1F01FF` (OI CI). PowerShell 5.1 needs no `SetAccessControl` afterwards. It then checks exactly that owner, flag and pair of ACEs, no reparse point and an empty folder. If someone created the folder in the race, `CreateDirectory` returns theirs, this check refuses it, and nothing of theirs is removed. **T: `Root`**, because only trusted SIDs can change it or anything that inherits from it.
6. It creates `<Root>\.in\<guid>\` (inherits) and copies the zip to `package.zip` there with `FileMode.CreateNew`. It runs Rule B on the copy, then `Get-AccucutTrustedSha256` on the copy, and the copy must match. **T: the copy** (finding 2: the file unpacked is the file checked, and no one else can change it).
7. It extracts from that same copy into `.in\<guid>\x`, entry by entry. It refuses a rooted path, `..`, `:` and any target outside the folder. It reads `release.json` and validates the tag. It creates `<Root>\releases` and moves `x` to `releases\<tag>`. It then scans the new tree recursively and refuses any reparse point, and deletes `.in\<guid>`. No `Unblock-File` is needed: .NET extraction writes no zone mark, and the child is started with `-ExecutionPolicy Bypass`. **T: the release tree.**
8. `Invoke-AccucutTrustedScript` on `<Root>\releases\<tag>\install.ps1 -VerifiedRelease <that folder> …`. The check of the chain and the file runs inside the call, right before the start.

**install.ps1, second half (`-VerifiedRelease`)**, the verified copy in a child process:

9. It checks for administrator rights. `$PSCommandPath` must equal `<VerifiedRelease>\install.ps1`, and `VerifiedRelease` must be exactly `<Root>\releases\<tag>`. Otherwise it stops before loading anything; this also covers a start by hand.
10. Rule B on `Root`, `releases`, `releases\<tag>` and the module file, and the recursive reparse scan.
11. `Import-AccucutTrustedModule`. **The module is loaded only here (d).**
12. `Resolve-AccucutTrustedExecutable` for `node.exe` (from `-NodeExe`, default `$env:ProgramFiles\nodejs\node.exe`), `psql.exe` (the PostgreSQL service's bin folder) and `powershell.exe` (`$env:SystemRoot\System32\WindowsPowerShell\v1.0\`). Then the version checks.
13. The values, `.env` and `migrate.env`, the database and roles, the migrations (the checked `node.exe` on the release tree), the first Admin, the services (WinSW copied to `<Root>\services`, then `Resolve-AccucutTrustedExecutable` on each `.exe` before `install`), the service SIDs given ReadAndExecute on `Root` and Modify on `logs`, Defender, the firewall, and `register-backup-task.ps1` through `Invoke-AccucutTrustedScript` if it exists.
14. It starts the services and waits for `/api/health` 200. If a step fails before the services are registered, it drops what this run created, copies the log to `%TEMP%` and **removes the whole `Root` that this run made**, so that step 4 lets the next run through.

**update.ps1** (started by IT as `powershell -ExecutionPolicy Bypass -File C:\Accucut\current\update.ps1 -ZipPath …`). It is one phase, run by the **installed** release. The new release's scripts are never run during the update; they first run at the next update.

- U1. Administrator check and the shape of `Root`. `Get-AccucutTrustedCurrent` gives `<Root>\releases\<old>`. `$PSCommandPath` must be `<Root>\current\update.ps1` or `<old>\update.ps1`; otherwise it stops ("run the installed update.ps1"). Rule B on `Root`, `releases`, `<old>`, `<old>\update.ps1`, `<old>\AccucutOps.psm1`, `config` and `services`. Rule B with `-Writer` (the service SIDs) on `logs`. This checks the anchor's surroundings: it shows a damaged install, but it cannot prove the anchor itself (R-T1).
- U2. `Import-AccucutTrustedModule` on `<old>` (finding 6: no import before the check).
- U3. The install state (module). `Get-AccucutTrustedSha256` on the source zip, as a fail-fast. Free space (module).
- U4. The release backup: `Invoke-AccucutTrustedScript <old>\backup.ps1 -Reason release`, or a stop, or `-NoBackup` stated on purpose (as built).
- U5. `Expand-AccucutTrustedPackage`, as I6 and I7. If the tag is `<old>`, it stops with "already running". If `releases\<new>` exists, it is deleted and extracted again from the checked copy. **An existing release folder is never reused** (this replaces the `.zip-sha256` reuse).
- U6. Stop the services. Rule B again on `Root`, `releases` and `<new>`, the reparse scan again, and `Resolve-AccucutTrustedExecutable` on `node.exe`. Migrate.
- U7. Move the junction to `<new>` (module). Write the service XML from `<new>`'s templates. `Resolve-AccucutTrustedExecutable` on each WinSW `.exe`, then `refresh`. Start the services and wait for health.
- U8. On failure, roll back as built (junction back, XML snapshot, previous release started, "Call your IT person"). On success, keep the current and the previous release, and write the state file.

### (d) What the module may and may not do

`AccucutOps.psm1` is trusted only once the block has passed it; it is loaded at I11 or U2 and nowhere else. **It may:** hold configuration and paths; read and write `.env`; handle secrets and redaction; log; run native programs **by the full paths it is given**; run psql and the migrations; write the service files and register services; set ACLs on `config`, `logs` and the service SIDs; move the junction; prune releases; wait for health; and, for 10.05 and 10.11, write `job_runs` and the manifest, read free space and run the byte pipe. **It may not:** check trust; create `Root`; hash, copy or extract a release package; import a module, dot-source, or run a `.ps1` file; resolve a program through `PATH`; run anything at import beyond defining functions and `$script:` constants; export aliases; or export a name that is not `Verb-Accucut*` or that matches a block function. Log files in `logs` (writable by the services) are opened with `FileMode.CreateNew` under a fresh timestamped name, never appended to or followed.

**Removed from the module and replaced by the block:** `Get-AccucutPathSecurity`, `Assert-AccucutPathTrusted`, `Assert-AccucutFreshRoot`, `Assert-AccucutLockedInstallRoot`, `Assert-AccucutInstallTrusted`, `New-AccucutDirectorySecurity`, `New-AccucutLockedDirectory`, `Set-AccucutDirectoryAcl`, `Expand-AccucutZip` and `Assert-AccucutSha256`. **Removed from the scripts:** `Import-AccucutBootstrapModule`, `Import-AccucutVerifiedModule` and both `-VerifiedRelease` import branches. `Get-AccucutFileSha256` stays in the module for backup manifests, which hash data, not code.

### (e) Required tests (Pester 5 in stage 13, prompts mocked; real ACLs wherever the runner allows, `Get-AccucutTrustSecurity` mocked otherwise)

1. **Block identity:** the text between the markers is identical in `install.ps1` and `update.ps1` after CRLF is normalised to LF, and each marker appears exactly once.
2. **Block self-containment (AST):** every command called inside the block is either a block function or `Microsoft.PowerShell.Core\Import-Module`, and no `*-Accucut*` name from outside the block is called.
3. **Load sites (AST):** outside the block, neither script contains `Import-Module`, `using module`, `#Requires -Modules`, dot-sourcing, `&` or `.` on a path, `Start-Process`, or a `powershell.exe` call.
4. **Module hygiene (AST and import):** exports match `^[A-Z][a-z]+-Accucut[A-Za-z]+$`, there are no aliases and no block names, the top level holds only functions, constants, `Set-StrictMode` and `Export-ModuleMember`, and the module has no load or run sites.
5. **A tampered module is never imported (marker module):** its top level writes a marker file. (a) In the unpacked folder for the first half: the install succeeds and the marker is absent. (b) In the release with the check failing on `Root`, `releases`, the release or the module file: the second half stops and the marker is absent. (c) The same for `update.ps1` on `<old>`.
6. **A tampered package is never extracted:** a source hash mismatch leaves `Root` uncreated. A copy swapped after the source hash (mocked copy) is refused and the `Root` of this run is removed. A zip-slip entry is refused.
7. **Order trace:** with the loads and the native runner mocked, every `load:` and `run:` entry in `$script:AccucutTrustLog` (module, second-half `install.ps1`, `backup.ps1`, `register-backup-task.ps1`, `node.exe`, `psql.exe`, `powershell.exe`, WinSW `.exe`) directly follows a `check:` of the same full path, and nothing is loaded or run without one.
8. **A junction at each component** (real junctions): `Root`, `releases`, `releases\<tag>`, `config`, `services`, the module file's folder; `current` pointing outside `releases`, or at a name that is not a tag. Each is refused, naming the component.
9. **An owner that is not trusted** (real, `icacls /setowner` to a test local user): `Root`, the release, the module file and the executable's folder are refused. A drive root with an untrusted owner (mocked) is refused.
10. **Generic rights:** GENERIC_ALL and GENERIC_WRITE for Users on `Root`, the release and the module file are refused (real ACEs); GENERIC_READ with GENERIC_EXECUTE is accepted. GENERIC_ALL on the drive root (mocked) is refused.
11. **CREATOR OWNER:** an effective CREATOR OWNER write ACE on `Root` is refused. An inherit-only CREATOR OWNER on `Root` is accepted only while no untrusted SID can create a child. An inherit-only CREATOR OWNER on the drive root is accepted.
12. **Inherit-only:** an inherit-only write ACE for Users is refused on `Root` and accepted on the drive root.
13. **A root that already exists:** an empty admin-owned folder, a non-empty folder, a file and a junction are each refused and left untouched. A root made during the race (`CreateDirectory` mocked to pre-create it with a user owner) is refused and nothing of it is removed.
14. **The drive-root rule (mocked SDDL):** the default Windows Server 2022 `C:\` descriptor is accepted; Authenticated Users Modify (effective) is accepted; DeleteChild, WRITE_DAC or WRITE_OWNER for Users is refused. A non-NTFS volume, a volume that is not fixed, `C:\a\b`, `C:\`, UNC, `\\?\`, a relative path and `..` are refused.
15. **Unknown ACEs:** a null DACL and a callback or object ACE (mocked) are refused.
16. **Executables:** `node.exe` from a folder where Users can create files is refused (a real temporary folder), and `PATH` is never consulted.
17. **Second half by hand:** a `-VerifiedRelease` that is not `<Root>\releases\<tag>`, or a script path that is not `<VerifiedRelease>\install.ps1`, stops before the import (marker absent).
18. **Update from the wrong place** (the unpacked new zip) stops before the import (marker absent). An existing `releases\<new>` is deleted and extracted again, never reused.
19. **Stage 13 end to end on `windows-latest`** (existing install, update and rollback steps, plus three new steps): (i) the unpacked folder holds a marker-writing `AccucutOps.psm1` next to the true zip; the install succeeds and the marker is absent. (ii) After the install, a Users write ACE on `C:\Accucut\releases\<tag>\AccucutOps.psm1`: `update.ps1` exits 1 naming the file, the services stay Running, and the ACE is then removed. (iii) `install.ps1 -Root C:\AccucutPre` over an existing empty folder is refused and the folder is left untouched. `assert-install.ps1` adds: `Root`'s owner, protected DACL and exact ACEs, and no reparse point in the release tree. **Node on the runner:** the install uses a Node 22 in `C:\Program Files\nodejs` (the image's own if it is 22.12 or later, or else the pinned vendor MSI, checksum-checked), as on the server. If the runner's `hostedtoolcache` fails Rule B, as expected from `C:\`'s inherited create rights, that is the rule working: do not loosen it.

### (f) Out of scope for 10.04, and residual risk

- **Out of scope:** `backup.ps1` and `clear-copies.ps1` (STORY-10.05) and `restore.ps1` (STORY-10.11) carry the same block if they load the module, and join test 1. The JEA endpoint's role-capability and session files, and how the module is loaded under the JEA virtual account, are designed and proved in 10.11. The proxy, the off-server copy, and code signing are also out of scope.
- **R-T1 (accepted):** the script an administrator starts (the first half, and `update.ps1`) is the trust anchor and cannot verify itself. Mitigation in the README: check the zip's SHA-256 against the GitHub release page before unpacking, unpack into a folder only administrators can write, and start updates only from `C:\Accucut\current`.
- **R-T2 (logged, GitHub #398):** there is no Authenticode signature on the scripts or the zip. `<zip>.sha256` next to the zip guards against corruption, not against someone who can replace both files; a `-Sha256` typed from the release page is the authenticity anchor. Signing is a later decision.
- **R-T3 (accepted):** an administrator or SYSTEM can change anything, which is out of the threat model. The release tree is scanned for reparse points but not ACE by ACE (about 20,000 files). Only a trusted SID could add a foreign ACE there, because `Root` is protected.
- **R-T4 (fails safe):** on a server where "Default owner for objects created by members of the Administrators group" is set to "Object creator" (not the Windows Server default), the files owned by the installing user fail Rule B and the install stops with that reason. The README names the setting.

### Amendment 2.1, 2026-11-14: rulings on the combined review of PR #396 (SQR-01, 07, 08, 09)

- **SQR-07: `Get-Item` is allowed.** The block may call one more cmdlet: `Microsoft.PowerShell.Management\Get-Item`, module-qualified so that no function can shadow it. It is used only in `Get-AccucutTrustedCurrent`, to read `LinkType` and `Target` of `<Root>\current`. .NET Framework 4.x has no API that reads a junction's target without P/Invoke, and P/Invoke would mean compiling C# with `Add-Type`. The block's full list of exceptions is therefore `Microsoft.PowerShell.Core\Import-Module`, `Microsoft.PowerShell.Management\Get-Item` and the child `powershell.exe`. Test 2's allow-list is exactly these.
- **SQR-08: the attribute read is repeated after the descriptor read (required), and the rest is residual R-T5.** `Get-AccucutTrustSecurity` reads the attributes, then the descriptor, then the attributes again. It refuses if either attribute read shows a reparse point or if the two reads differ. **R-T5 (accepted):** a swap and a swap back, both inside that window, is still possible in theory. It can happen only where an untrusted SID can replace the component. Inside the root no untrusted SID can, and a drive root cannot be swapped. So it applies only to a root created during the I5 race by someone else, who would also have to win the same race again at every later check (I10, U1, U6 and each load). This is not a practical attack. Reading through a handle opened with `FILE_FLAG_OPEN_REPARSE_POINT` would close it, but that needs P/Invoke and is not done.
- **SQR-09: a rollback restores the WinSW programs too (required).** In U6, `update.ps1` takes a byte snapshot of `<Root>\services\AccucutApp.exe` and `AccucutWorker.exe` next to the XML snapshot. In U8 it writes back any that differ, then calls `Resolve-AccucutTrustedExecutable` on each before `refresh`. WinSW is pinned at 2.12.0, so this normally restores nothing. It still means a rollback brings back exactly the previous service setup if a later release changes the pin. Add a Pester case: a release with a different WinSW `.exe` is rolled back and the old bytes are back.
- **SQR-01: the worker prunes the logs; no scheduled task, no `clean-logs.ps1`, no extra account (required).** *Re-ruled 2026-11-14 on the automated review's MEDIUM: the first 2.1 ruling (a task running as LOCAL SERVICE, `S-1-5-19`) is withdrawn. LOCAL SERVICE is a principal shared by other services, and it needed ReadAndExecute on the root to read the script through `current`.*
  - **Model (the reviewer's (b)).** `AccucutWorker` already runs as its own virtual account `NT SERVICE\AccucutWorker` and already has Modify on `logs`. It gets a daily `log-prune` job (node-cron 4.6.0, already a dependency, ADR-011) at 03:30 Asia/Kolkata.
    - Logic: `src/server/jobs/log-prune.ts`, with its call in `src/worker/main.ts`. The job runs only when `LOG_DIRECTORY` is set; `install.ps1` writes `LOG_DIRECTORY=<Root>\logs` into `.env`, and in development and CI it is unset, so nothing runs. The value must be an absolute path whose directory is not a link (`lstat`); otherwise the job logs one warning and does nothing.
    - What it deletes: only entries directly in that folder (no recursion) that are regular files by `lstat` (links and junctions skipped), whose names match `^(AccucutApp|AccucutWorker)\..+|^(install|update)-\d{8}-\d{6}\.log$`, and whose `mtime` is older than 30 days. It writes one log line with the count and no `job_runs` row.
  - **Why not the reviewer's (a) or (c).** Task Scheduler cannot use an `NT SERVICE\…` virtual account as a principal. A gMSA needs Active Directory, which is not assumed. A dedicated local user needs a password that Windows stores, or S4U plus the "Log on as a batch job" right. Option (c) still uses a shared principal. Model (b) adds no identity, no task and no script, and the account doing the deleting can delete only what it could already write.
  - **Removed:** `clean-logs.ps1`, `Register-AccucutLogCleanupTask`, `$script:AccucutLogCleanupSid` and its two `Grant-AccucutFolderAccess` lines, and `S-1-5-19` in `update.ps1`'s `-Writer` list and in `assert-install.ps1`. Nothing has been installed in production, so no update step has to unregister the task.
  - **The exact ACEs after an install** (SIDs: Administrators `S-1-5-32-544`, SYSTEM `S-1-5-18`, and `App` and `Worker` for the two service SIDs, `S-1-5-80-…` derived from the service names):
    - `<Root>`: owner Administrators, DACL protected, exactly four allow ACEs (five from STORY-10.05: Amendment 3 adds `AccucutBackup` with ReadAndExecute), none inherited, all `(OI)(CI)`. They are Administrators `0x1F01FF`, SYSTEM `0x1F01FF`, App ReadAndExecute `0x1200A9` and Worker ReadAndExecute `0x1200A9`.
    - `<Root>\logs`: the four inherited ACEs plus exactly two explicit ones, App Modify `0x1301BF (OI)(CI)` and Worker Modify `0x1301BF (OI)(CI)`. U1's `-Writer` list for `logs` is exactly App and Worker.
    - There is no `clean-logs.ps1`, and no `<Root>\tools`. The junction question goes away, because the worker reads nothing through `current` that it cannot already read as a service.
  - **Tests to add:**
    - (1) Stage 13 `assert-install.ps1` and a Pester real-ACL case:
      - The root's DACL is exactly the four ACEs above and is protected.
      - The explicit ACEs on `logs` are exactly the two Modify ACEs.
      - No ACE anywhere on `<Root>`, `releases`, the current release, `config`, `services` or `logs` names `S-1-5-19`, `S-1-5-20`, `S-1-5-11`, `S-1-5-32-545` or `S-1-1-0`.
      - No scheduled task named `Accucut log cleanup` exists.
    - (2) `windows-deploy-files.test.ts`: the package has no `clean-logs.ps1`, and no script under `deploy/windows/` registers a scheduled task other than the backup task of 10.05.
    - (3) Vitest unit tests for `log-prune` on temporary folders:
      - A file 31 days old with a matching name is deleted.
      - A file 29 days old is kept.
      - An unknown name is kept.
      - A symlink (or junction) is skipped, and so is its target.
      - A subfolder is not entered.
      - An unset or relative `LOG_DIRECTORY`, or one that is a link, does nothing.
- **The rule, confirmed and widened.** Every script in the release package that loads the module or runs another script carries the trust block, byte-identical, and joins test 1. Today those are `install.ps1` and `update.ps1`, with `backup.ps1` and `clear-copies.ps1` (10.05) and `restore.ps1` (10.11) to follow. Every other script must have no load site at all; today there is none, because `clean-logs.ps1` is removed. **Test 3 now parses every `.ps1` and `.psm1` in `deploy/windows/` except `ci/` and `tests/`.** A load site outside a trust block fails it, so a new script cannot escape the rule unnoticed.

## Amendment 3, 2026-11-15: backups on Windows (STORY-10.05, AQP-311; forward note for 10.11)

**Why.** The developer stopped before writing any code and listed four open questions (Jira AQP-311 comment 11943). Each one touches the exact-ACE rule or the trust rule. These are the rulings, one per question. Amendments 2 and 2.1 apply unchanged.

1. **`job_runs` is created by STORY-02.09 (AQP-307), in the shape it is building:** `id uuid DEFAULT gen_random_uuid()`, `job text`, `started_at timestamptz`, `finished_at timestamptz`, `result jsonb` with `status`, `sizeBytes`, `freeBytes` and `totalBytes`, as architecture 5.1 states. The worker (`accucut_app`) reads and inserts. **02.09 grants nothing to a backup role.** STORY-10.05 creates `accucut_backup` and its grants (point 3), because that role may not exist when 02.09 merges. 10.05 rebases on 02.09. **`backup-watch` is a worker node-cron job, confirmed** (AQP-307 AC-4). It runs as `accucut_app`, under the worker's service account, and reads the free space with `fs.statfs` (point 5). Only `backup.ps1` and `clear-copies.ps1` are PowerShell scripts. Both carry the trust block and join tests 1 and 3.
2. **The weekly task runs as a dedicated local user, `AccucutBackup`, with its password stored by Task Scheduler.** SYSTEM, LOCAL SERVICE and the worker account are ruled out. SYSTEM and LOCAL SERVICE fall by Amendment 2.1. The worker is excluded so that a compromised portal can neither read nor delete the backups.
   - **Creation.** `install.ps1`'s second half does this through the module, after the import. It generates a 32-character random password in memory, with at least one upper-case letter, one lower-case letter, one digit and one symbol, so that Windows' complexity rule passes. It registers the password for redaction. It calls `New-LocalUser AccucutBackup -Password <SecureString> -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires`, with the description "Accucut weekly backup (no interactive use)". The account is added to no local group. Then `Register-ScheduledTask` is called with `-User AccucutBackup -Password <in-process string>`, logon type Password and RunLevel Limited, and the password variables are cleared.
   - **Where the password is held.** Only by Task Scheduler (LSA). It is never on a process command line, because both are cmdlets in the same process, and never in a file or a log.
   - **The task.** Weekly on Sunday at 02:00 IST. The action is `$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <Root>\current\backup.ps1 -Reason weekly`. The path goes through `current`, so an update needs no new registration and no password.
   - **"Log on as a batch job".** Windows needs this right for a task with a stored password. **The install proves it works by running the task once at the end** (`Start-ScheduledTask`, wait up to 5 minutes for `LastTaskResult` 0 and a `job_runs` row with `job = 'backup'`). That run is also the first backup.
     - If the right is missing (logon-type failure `0x80070569`), the install exits 1 with the portal running and says: "Give AccucutBackup the right 'Log on as a batch job' (a domain Group Policy may be removing it), then run `Start-ScheduledTask 'Accucut weekly backup'`."
     - The README names this.
   - **Reading the script, the module and the programs: a fifth ACE on `Root`, `AccucutBackup` ReadAndExecute `0x1200A9 (OI)(CI)`.** The trust block in `backup.ps1` must read the descriptor of every component from `Root` down, which needs READ_CONTROL there. Rule B already allows read and execute for an untrusted SID. The release code, `services` and `logs` are not secret.
     - Every secret file has a protected ACL, so no `Root` ACE reaches it: `.env`, `migrate.env` and `backup.pgpass` (point 3).
     - **Rejected:** a script outside the release tree. Its trust check would still have to read `Root`'s descriptor, so it saves no ACE and adds a second copy of the code.
     - Amendment 2.1's "exactly four" becomes "exactly five".
3. **Database role `accucut_backup`**, created by 10.05 in `deploy/db/create-roles.psql` (the one SQL source, read by the install, the development database and CI). It has `LOGIN` and `NOSUPERUSER NOCREATEDB NOCREATEROLE`, `CONNECT` on the database and `USAGE` on `public`. It gets `GRANT pg_read_all_data TO accucut_backup` (PostgreSQL 14 and later), which is what `pg_dump` needs, and nothing else. A 10.05 migration adds `GRANT INSERT ON job_runs TO accucut_backup` and nothing more: no UPDATE, no DELETE, and no other table. **The owner and app roles are never used by the backup.**
   - Its password is generated by the install, like the other two roles, and passed to psql through the environment.
   - It is written only to **`<Root>\config\backup.pgpass`** (`127.0.0.1:5432:accucut:accucut_backup:<password>`). That file has a protected ACL, owner Administrators, with exactly Administrators `0x1F01FF`, SYSTEM `0x1F01FF` and AccucutBackup Read `0x120089`, and no inheritance.
   - Scripts pass it as `PGPASSFILE` in the environment of the `pg_dump` and `psql` children only.
   - No traverse ACE is needed on `config`: the fifth `Root` ACE gives list and traverse there, and `.env` and `migrate.env` stay protected without AccucutBackup.
   - An administrator (an update's release backup, `clear-copies.ps1`) uses the same file through the Administrators ACE.
   - **No install exists before 10.05 ships, so there is no upgrade step.** In development, recreate the local database to get the new role.
4. **`<Root>\backups`: a protected DACL, owner Administrators, exactly Administrators `0x1F01FF (OI)(CI)`, SYSTEM `0x1F01FF (OI)(CI)` and AccucutBackup Modify `0x1301BF (OI)(CI)`.** No ACE for App or Worker, and none inherited. It holds data, not code. Before any administrator script writes to or deletes from it (an update's release backup, `clear-copies.ps1`), the script checks it with `Assert-AccucutTrustedPath -Writer <AccucutBackup SID>`: owner trusted, not a link, protected, and AccucutBackup the only writer up to Modify.
   - Every write and delete there follows the `logs` rule:
     - files are created with `FileMode.CreateNew` under a temporary name and renamed after the manifest is written;
     - only regular files directly in the folder are deleted, by `lstat`-style attribute checks, with links skipped and no recursion;
     - only files named `^accucut-\d{8}-\d{6}-(weekly|release)\.age$` are deleted, together with their `.manifest.json`.
   - **The JEA account belongs to 10.11** (forward note): 10.11 adds exactly one ACE here for its virtual account and decides that account's database credential. Its virtual account is limited with `RunAsVirtualAccountGroups`, never left as a local administrator by default. Accucut IT's off-server copy account (Amendment 1) may be given Read, which Rule B accepts.
5. **The developer's small points, as ruled.**
   - **The `age` recipient is not in `.env`,** which AccucutBackup cannot read, and it must not be able to. It goes in **`<Root>\config\backup-settings.json`**, which uses the same protected ACL as `backup.pgpass`. A recipient swapped by someone who could write the file would encrypt to their key, so the file is read-only to the task.
     - The file holds `ageRecipient` (checked against `^age1[0-9a-z]{58}$`), `pgHost`, `pgPort`, `database` and `pgBinDirectory`. It holds no secret.
     - `install.ps1` asks for `BACKUP_AGE_RECIPIENT`, or reads it from the values file; CI passes a per-run `age-keygen` public key.
   - **Programs:** the release's `bin\age.exe`, then `pg_dump.exe` and `psql.exe` from `pgBinDirectory`, then `$env:SystemRoot\System32\cmd.exe` for the byte pipe. Each goes through `Resolve-AccucutTrustedExecutable` at every run. The recipient is public, so it may appear on the `age` command line.
   - **`backup-watch` free space:** `.env` gains `PG_DATA_VOLUME` and `BACKUP_VOLUME`, the **drive roots** (`X:\`) of the data folder and of `backups`, worked out by the install. The worker cannot open either folder (both are protected), but `fs.statfs` on a drive root works. When both are the same volume, one reading is taken.

**Tests that stage 13 must assert** (real, after the install), on top of Amendment 2's:
- `AccucutBackup` exists, is enabled, its password never expires, and it is an explicit member of no local group.
- The task's principal is AccucutBackup, logon type Password, RunLevel Limited, with a weekly trigger at Sunday 02:00 and the exact action above.
- The install's own run left `LastTaskResult` 0, a new `.age` file with its manifest, and a `job_runs` `backup` row with `status` ok. That copy decrypts with the run's own key and restores into a scratch database.
- **Exact ACEs:**
  - `Root` has five, as above.
  - `backups` is protected with exactly three.
  - `backup.pgpass` and `backup-settings.json` are each protected with exactly three.
  - Neither `.env` nor `migrate.env` names AccucutBackup.
  - No App or Worker ACE on `backups`.
  - No `S-1-5-19`, `S-1-5-20`, `S-1-5-11`, `S-1-5-32-545` or `S-1-1-0` anywhere under `Root`.
- **The database role, checked with psql as `accucut_backup`:**
  - member of `pg_read_all_data`;
  - `INSERT` into `job_runs` succeeds, while `UPDATE` or `DELETE` on it and `INSERT` into any other table are refused;
  - `CREATE TABLE` is refused.
- **Pester (mocked):**
  - The password reaches only `New-LocalUser` (as a `SecureString`) and `Register-ScheduledTask`, never `Invoke-AccucutNative` or a log.
  - An install whose test run fails with `0x80070569` exits 1 with the batch-right message.
  - Admin scripts refuse a `backups` folder with an extra writer, a link, or an owner who is not trusted.
  - Pruning deletes only matching regular files older than 2 calendar years, never one of the newest 4, and skips links.
  - Tests 1 and 3 include `backup.ps1` and `clear-copies.ps1`.

## Verification

- Stage 13 on `windows-latest` (test strategy 10.8): install from the zip on a clean runner, the services start, `/api/health` returns 200 and the sign-in page loads; a backup, a clear and a restore succeed, and the restore's failure paths are tested.
- NFR-030: a timed walk-through on a clean Windows Server 2022 VM by someone who did not write the README.
- NFR-013: the Admin's restore rehearsal on staging (a Windows VM), from the README alone, through the JEA endpoint.
- Review this decision if Accucut's server turns out to be Linux, or if Microsoft makes a supported Linux-container runtime for Windows Server generally available.
