# Accucut Quotation Portal on Windows Server

How to install the portal on a Windows Server, update it, and roll it back. It is written for a Windows IT person who is not a developer
(NFR-030: a clean server should reach the sign-in page within 30 minutes). Everything runs in Windows PowerShell 5.1, which every Windows
Server has. Nothing else is installed except Node.js and PostgreSQL, from their own installers. The server never runs `npm`.

Design: [ADR-015](../../docs/04-architecture/adr/ADR-015-native-windows-services.md) and architecture section 9.9. Recommended: Windows Server 2022
Standard, one disk of about 100 GB.

## What you need

1. **Windows Server 2022** (Server 2019 works but is not recommended; Server 2025 works but PostgreSQL 17 is outside EDB's list for it).
2. **Node.js 22 LTS, 22.12 or later**, from nodejs.org (the Windows installer, for all users).
3. **PostgreSQL 17**, from postgresql.org (the Windows installer). Keep the default service name `postgresql-x64-17` and port 5432. Write
   down the password you give the `postgres` administrator: the install asks for it once and never stores it.
4. **The release zip** `accucut-<tag>-win-x64.zip` and its checksum file `accucut-<tag>-win-x64.zip.sha256`, kept side by side.
5. A Windows account that is an **administrator**.

## Install (about 15 minutes)

1. Right-click the zip, choose **Properties**, tick **Unblock** if it is there, and click OK. (Otherwise Windows may refuse to run the scripts.)
2. Unpack the zip into a short folder such as `C:\accucut-pkg` (right-click, **Extract All**). Keep the path short.
3. Open **Windows PowerShell as administrator** (right-click, **Run as administrator**) and run:

   ```powershell
   cd C:\accucut-pkg
   .\install.ps1 -ZipPath C:\path\to\accucut-<tag>-win-x64.zip
   ```

4. It checks the zip's SHA-256 first, then asks a few questions: the address people will type, the first Admin's e-mail address and a first
   password, the PostgreSQL administrator password and, if you use it, mail settings. It invents every other secret itself.
5. It installs, starts the portal and waits until `/api/health` answers. When it ends with **Done**, open the address you gave and sign in as
   the first Admin. You will be asked to choose a new password.

For an install with no one at the keyboard, copy `values.example.txt`, fill it in, and run
`.\install.ps1 -ZipPath <zip> -ValuesFile <your copy> -NonInteractive`. **Delete your copy afterwards**: it holds the first password.

Useful switches: `-Root` (not `C:\Accucut`), `-Port` (not 3000), `-WithProxy` (a TLS proxy such as Caddy or IIS will stand in front: the portal
listens on 127.0.0.1 only and Windows Firewall opens TCP 80 and 443; **you install the proxy**), `-DefenderExclusion Yes|No|Ask`.

### What the install does

| Step | Result |
|------|--------|
| Checks | The zip's SHA-256 (nothing is changed if it differs), Node.js 22.12 or later, PostgreSQL 17. Unblocks the scripts. |
| Refuses | To run twice, and to touch a database called `accucut` or roles `accucut_app` or `accucut_owner` that already exist. It never changes existing data. |
| Settings | `C:\Accucut\config\.env` for the web app and the worker, and `C:\Accucut\config\migrate.env` (the owner database role and the first Admin) for the install and update scripts only. Both are created empty, locked, and only then filled. |
| Database | Creates the database and the two roles from `sql\create-roles.psql`, runs the migrations as the owner role, loads the field registry, creates the first Admin. |
| Services | `AccucutApp` and `AccucutWorker` (WinSW 2.12.0): Automatic (Delayed Start), after PostgreSQL, restart after 10, 30 and 60 seconds, each as its own account (`NT SERVICE\AccucutApp`, `NT SERVICE\AccucutWorker`), **never LocalSystem**. |
| Logs | `C:\Accucut\logs\`: a new file each day; a scheduled task, `Accucut log cleanup`, deletes files older than 30 days. |
| Defender | **Offers to exclude PostgreSQL's data folder from Windows Defender real-time scanning, and says so.** PostgreSQL advises it. You may refuse (`-DefenderExclusion No`, or answer no). Undo it with `Remove-MpPreference -ExclusionPath <folder>`. |
| Backups | The weekly backup task and `backup.ps1` arrive with the backup release (STORY-10.05). |

If a step fails after the database was created by this run, the install drops what it created (the database and the two roles, which are new
and empty) so that you can run it again. Read the message, fix the cause, run it again. The log is `C:\Accucut\logs\install-<time>.log`.

### Folders

```
C:\Accucut\
  releases\<tag>\   the running release and the previous one (nothing older is kept)
  current           a junction to the running release
  config\           .env, migrate.env, install-state.json (no secret in the last)
  services\         the WinSW programs and their XML files
  logs\             install, update and service logs
  backups\          made by the backup release
```

`C:\Accucut` is closed to ordinary users: only Administrators and SYSTEM can write, and only the two service accounts can read the program
files. `.env` can be read by Administrators and the two service accounts only; `migrate.env` by Administrators only.

## Update (about 5 minutes, under a minute of interruption)

```powershell
cd C:\Accucut\current
.\update.ps1 C:\path\to\accucut-<new-tag>-win-x64.zip
```

It checks the zip's SHA-256, takes a **release backup** (`backup.ps1 -Reason release`), unpacks the new release, stops the two services,
migrates, moves the `current` junction, starts, and waits for `/api/health`. Afterwards only the new and the previous release are kept.

- **No backup script yet** (before STORY-10.05): the update refuses. If you accept that nothing can be restored if it goes wrong, add `-NoBackup`.
- **If the migrations fail**, the junction is not moved and the previous release starts again.
- **If the new release is not healthy**, the junction moves back, the previous release starts, and the script says **"Call your IT person"**.
  Migrations only add things (expand, then contract: architecture section 9.7), so the previous release still works on the migrated database.
- **To go back to an older release on purpose**, run `update.ps1` with that release's zip.

## Look and fix

| You want | Do |
|----------|----|
| See the services | `Get-Service AccucutApp, AccucutWorker, postgresql-x64-17` |
| Restart the portal | `Restart-Service AccucutWorker, AccucutApp` |
| Check it is alive | Open `http://127.0.0.1:3000/api/health` on the server: `{"status":"ok"}` |
| Read the logs | `C:\Accucut\logs\` (`AccucutApp.*.err.log` first) |
| Start over after a failed install | Drop what is left (`DROP DATABASE accucut; DROP ROLE accucut_app, accucut_owner;` in `psql` as `postgres`), run `C:\Accucut\services\AccucutApp.exe uninstall` and the same for `AccucutWorker`, delete `C:\Accucut`, run the install again. |

After a Windows Update reboot both services start by themselves, a minute or so after PostgreSQL (NFR-012).

## The shared module (`AccucutOps.psm1`)

STORY-10.05 (backup) and STORY-10.11 (restore, JEA) import this module and add their own functions to it. What it offers today:

| Group | Functions |
|-------|-----------|
| Layout and files | `Get-AccucutPaths`, `Get-AccucutFileSha256`, `Read-AccucutSha256File`, `Assert-AccucutSha256`, `Read-AccucutReleaseInfo`, `Test-AccucutAdministrator`, `Assert-AccucutFreeSpace` |
| Versions | `ConvertTo-AccucutVersion`, `Test-AccucutNodeVersion`, `Test-AccucutPostgresVersion` |
| Prompts (so Pester can mock them) | `Read-AccucutHostInput`, `Read-AccucutSecretInput` |
| Secrets, logs and child programs | `New-AccucutSecret`, `Register-AccucutSecret`, `Hide-AccucutSecrets`, `Write-AccucutLog`, `ConvertTo-AccucutArgumentString`, `Invoke-AccucutNative` (a secret goes in `-Environment` or `-StdIn`, never in the arguments) |
| Settings | `Read-AccucutValuesFile`, `Read-AccucutEnvTemplate`, `Read-AccucutEnvFile`, `Format-AccucutEnvValue`, `Split-AccucutEnvValues`, `Set-AccucutFileAcl`, `Write-AccucutSecureFile`, `Expand-AccucutTemplate` |
| Releases | `Get-AccucutCurrentRelease`, `Set-AccucutCurrentRelease`, `Remove-AccucutOldReleases`, `Remove-AccucutDirectory`, `Copy-AccucutTree`, `Remove-AccucutOldLogs` |
| Services and health | `Get-AccucutServiceNames`, `Get-AccucutPostgresServiceName`, `Initialize-AccucutServiceFiles`, `Set-AccucutServiceIdentity`, `Assert-AccucutServiceIdentity`, `Start-AccucutServices`, `Stop-AccucutServices`, `Get-AccucutHttpStatus`, `Wait-AccucutHealth`, `Invoke-AccucutMigration` |

Not here yet, and added by the stories that need them: the `job_runs` write, the backup manifest, the free-space reading for the backup check,
and the byte pipe (`pg_dump | age`, inside `cmd.exe /c`).

## Tests

`Invoke-Pester deploy/windows/tests` (Pester 5): prompts, programs and services are mocked, so it changes nothing on the machine. CI stage 13
(`.github/workflows/windows-package.yml`, job **Stage 13: Windows package**) builds the zip on a Windows runner, installs it, updates it, proves
the rollback with a release that is broken on purpose, and runs those tests. It is not a required check; every pull request that touches
`deploy/**`, `package.json`, `package-lock.json`, `next.config.ts`, `prisma/**` or the worker must still have it green.
Not tested in CI: the timed walk-through of NFR-030 and a real Windows Update reboot (both by hand).
