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
2. Unpack the zip into a short folder that **only administrators can write**, such as `C:\Program Files\accucut-pkg` (right-click, **Extract All**).
   This matters: `install.ps1` is where the trust starts. No script can check itself, so the copy you start must be one that nobody else could have
   changed. Do not unpack into a new folder directly under `C:\`: it inherits the drive's rights, so ordinary users may be able to replace files in it
   before you run the script.
3. Look up the zip's SHA-256 on the release page and keep it at hand. It is the only check that someone who can replace both the zip and its
   `.sha256` file cannot fake.
4. Open **Windows PowerShell as administrator** (right-click, **Run as administrator**) and run:

   ```powershell
   cd "C:\Program Files\accucut-pkg"
   .\install.ps1 -ZipPath C:\path\to\accucut-<tag>-win-x64.zip -Sha256 <the SHA-256 from the release page>
   ```

   (Without `-Sha256` it uses the `.sha256` file next to the zip. That only guards against a damaged download.)
5. It checks the zip's SHA-256 first, then asks a few questions: the address people will type, the first Admin's e-mail address and a first
   password, the PostgreSQL administrator password and, if you use it, mail settings. It invents every other secret itself.
6. It installs, starts the portal and waits until `/api/health` answers. When it ends with **Done**, open the address you gave and sign in as
   the first Admin. You will be asked to choose a new password.

For an install with no one at the keyboard, copy `values.example.txt`, fill it in, and run
`.\install.ps1 -ZipPath <zip> -Sha256 <hash> -ValuesFile <your copy> -NonInteractive`. **Delete your copy afterwards**: it holds the first password.

Useful switches: `-Root` (not `C:\Accucut`; exactly one folder below a drive, such as `D:\Accucut`), `-Port` (not 3000), `-NodeExe` (not
`C:\Program Files\nodejs\node.exe`), `-WithProxy` (a TLS proxy such as Caddy or IIS will stand in front: the portal
listens on 127.0.0.1 only and Windows Firewall opens TCP 80 and 443; **you install the proxy**), `-DefenderExclusion Yes|No|Ask`.

### Why the install runs in two halves

The rule is: **code is never loaded or run before it has been checked, and code is never checked with functions from the code being checked.**
So `install.ps1` does the following, and nothing more, before any other script exists on the machine:

1. **The first half** (the copy of `install.ps1` that you started) uses only the checks that are written inside it (the "trust block", a single
   block of .NET calls that is byte for byte the same in `install.ps1` and `update.ps1`). It checks that you are an administrator, the shape of `-Root`,
   and the zip's SHA-256. It creates the install folder (which must not exist), copies the zip into it, checks the SHA-256 of the **copy**, unpacks the
   copy to `releases\<tag>`, refuses any link in it, and then starts the copy of `install.ps1` that is **in that release folder**, in a child
   `powershell.exe`. It loads no module.
2. **The second half** (`C:\Accucut\releases\<tag>\install.ps1`, started by the first half) refuses to run from anywhere else. It checks the install
   folder, `releases`, the release folder and the module file, and only then loads `AccucutOps.psm1`. Node.js, `psql` and PowerShell are checked and
   run by their **full path**, never found through `PATH`.

A tampered `AccucutOps.psm1` placed beside the zip (or in the folder you unpacked into) is therefore never loaded: the module that is loaded is the one
from the copy of the zip whose SHA-256 was checked, after it has passed the trust check.

**The one thing the script cannot do for you** is check the first half itself: if someone changed `install.ps1` before you started it, nothing it does can
be trusted. That is why step 2 says to start it from a folder only administrators can write, and why step 3 says to compare the zip's SHA-256 with the
release page. Both are yours to do.

**The trust rules** (the same two rules, in `update.ps1` too):

- *Above the install folder* (the drive root and the folders between): not a link, owned by Administrators, SYSTEM or TrustedInstaller, and no other
  account may be able to delete, replace or take over the folder (delete, delete child, change permissions, take ownership). The Windows default for the
  root of a drive, where users may create folders, passes; deleting or replacing it does not.
- *The install folder and everything checked below it* (and a program together with its own folder, because Windows looks there first for DLLs):
  not a link, owned by Administrators, SYSTEM or TrustedInstaller, and every entry of any other account, inherited or not, may allow reading and executing
  **only**. (The one exception: an entry that applies only to children and names CREATOR OWNER, as `C:\Program Files` has.) The install folder's own
  permission list must not inherit. The logs folder alone lets the two service accounts write.

**A note on who owns the files.** The install folder is created with Administrators as the owner. The files that the install and the unpacking write are owned
by the account that creates them, which for an elevated administrator is, by Windows default, the Administrators group. If the server's security policy
*System objects: Default owner for objects created by members of the Administrators group* is set to **Object creator**, they would be owned by your own user
account instead, the trust rule would refuse them, and the install would stop with a message that names the owner. Set the policy back to its default,
**Administrators group**, and run the install again.

### What the install does

| Step | Result |
|------|--------|
| Checks | The zip's SHA-256 (nothing is created if it differs), Node.js 22.12 or later (`C:\Program Files\nodejs\node.exe`, which with its folder must be writable by administrators only), PostgreSQL 17 (`psql.exe`, with its folder, the same). |
| The install folder | `C:\Accucut` must **not exist yet**. Not even an empty folder is used: someone could have made it first and kept control of it. The install creates it with its permissions in one call (owner Administrators, no inheritance, Administrators and SYSTEM only), so there is no moment when it is open, and then checks it exactly (owner, protection, the two entries, empty). The folder must be exactly one folder below a fixed NTFS drive. The trust rules described above are applied to every path that is loaded or run, from the drive root down, and again between the steps. |
| The zip, twice | It copies the zip into that locked folder, checks the SHA-256 of the **copy**, and unpacks the copy to `C:\Accucut\releases\<tag>`. From then on every file it reads or runs (the second half of this script, the module, `.env.example`, the SQL, WinSW and the programs) comes from that folder, never from the folder you unpacked into. |
| Refuses | To run twice, and to touch a database called `accucut` or roles `accucut_app` or `accucut_owner` that already exist. It never changes existing data. |
| Settings | `C:\Accucut\config\.env` for the web app and the worker, and `C:\Accucut\config\migrate.env` (the owner database role and the first Admin) for the install and update scripts only. Both are created empty, locked, and only then filled. |
| Database | Creates the database and the two roles from `sql\create-roles.psql`, runs the migrations as the owner role, loads the field registry, creates the first Admin. |
| Services | `AccucutApp` and `AccucutWorker` (WinSW 2.12.0): Automatic (Delayed Start), after PostgreSQL, restart after 10, 30 and 60 seconds, each as its own account (`NT SERVICE\AccucutApp`, `NT SERVICE\AccucutWorker`), **never LocalSystem**. |
| Logs | `C:\Accucut\logs\`: the services write a new file each day. The install and update logs are new files with unpredictable names (`install-<time>-<random>.log`), created fresh and never appended to, because the two service accounts can write in this folder. There is no scheduled task and no other account for the clean-up: **AccucutWorker deletes the service, install and update logs older than 30 days itself, once a day at 03:30 India time** (its `log-prune` job; the install writes the folder into `LOG_DIRECTORY` in `.env`). It deletes only regular files directly in that folder that have the portal's own log names, and never follows a link. |
| Defender | **Offers to exclude PostgreSQL's data folder from Windows Defender real-time scanning, and says so.** PostgreSQL advises it. You may refuse (`-DefenderExclusion No`, or answer no). Undo it with `Remove-MpPreference -ExclusionPath <folder>`. |
| Backups | The weekly backup task and `backup.ps1` arrive with the backup release (STORY-10.05). |

If a step fails before the services are registered, the install drops what it created (the database and the two roles, which are new and empty),
copies its log to your temp folder (`%TEMP%\accucut-failed-install-<time>.log`) and removes the whole install folder that this run made, so that you can
run it again. Read the message, fix the cause, run it again. The log is `C:\Accucut\logs\install-<time>.log` once the install has succeeded.

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
.\update.ps1 C:\path\to\accucut-<new-tag>-win-x64.zip -Sha256 <the SHA-256 from the release page>
```

Type the SHA-256 from the release page, as for the install. (The `.sha256` file next to the zip only guards against a damaged download: whoever can replace the
zip can replace that file too.)

It must be run as `C:\Accucut\current\update.ps1` (it refuses to run from anywhere else, such as the folder you unpacked the new zip into). It is one
phase, run by the **installed** release, and it never runs a script from the new release (those first run at the next update). Before it loads anything
it checks, with the trust rules above, the install folder, the running release folder, its `update.ps1` and `AccucutOps.psm1`, `config`, `services`
and `logs`, and that the running release holds no link. If any of that fails, for instance because a user was given write access to the module, it
**stops with exit code 1 and changes nothing**; the services keep running. Only then does it load the module. Then it checks the zip's SHA-256,
takes a **release backup** (`backup.ps1 -Reason release`), copies the zip into the install folder and checks the copy, unpacks it to
`C:\Accucut\releases\<tag>` (a folder of that tag that exists is deleted and unpacked again, never reused; the running release is refused), stops the
two services, checks the new release again, migrates, moves the `current` junction, starts, and waits for `/api/health`. Afterwards only the new and
the previous release are kept.

- **No backup script yet** (before STORY-10.05): the update refuses. If you accept that nothing can be restored if it goes wrong, add `-NoBackup`.
- **If the migrations fail**, the junction is not moved and the previous release starts again.
- **If any step after the switch fails** (the service files, the WinSW check, the refresh) it is rolled back the same way, and the rollback puts the service
  XML files **and the WinSW programs** back as they were, byte for byte. If a rollback step itself fails, the message names it, the previous release is still
  started, and the script says "Call your IT person".
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

STORY-10.05 (backup) and STORY-10.11 (restore, JEA) import this module and add their own functions to it. The module is loaded only **after** it has passed
the trust check, so it holds no trust, install-folder, zip, or script-running function (those are in the trust block of `install.ps1` and `update.ps1`),
and it does nothing when it is loaded except define functions and constants (a test checks this on its syntax tree). New scripts that load or run code must
use `Import-AccucutTrustedModule` and `Invoke-AccucutTrustedScript` from the trust block, not `Import-Module` or `&`. What it offers today:

| Group | Functions |
|-------|-----------|
| Layout and files | `Get-AccucutPaths`, `Get-AccucutFileSha256`, `Read-AccucutSha256File`, `Read-AccucutReleaseInfo`, `Test-AccucutAdministrator`, `Assert-AccucutFreeSpace` |
| Versions | `ConvertTo-AccucutVersion`, `Test-AccucutNodeVersion`, `Test-AccucutPostgresVersion` |
| Prompts (so Pester can mock them) | `Read-AccucutHostInput`, `Read-AccucutSecretInput` |
| Secrets, logs and child programs | `New-AccucutSecret`, `Register-AccucutSecret`, `Hide-AccucutSecrets`, `Write-AccucutLog`, `ConvertTo-AccucutArgumentString`, `Invoke-AccucutNative` (a secret goes in `-Environment` or `-StdIn`, never in the arguments) |
| Settings | `Read-AccucutValuesFile`, `Read-AccucutEnvTemplate`, `Read-AccucutEnvFile`, `Format-AccucutEnvValue`, `Split-AccucutEnvValues`, `Set-AccucutFileAcl`, `Write-AccucutSecureFile`, `Expand-AccucutTemplate` |
| Releases | `Get-AccucutCurrentRelease`, `Set-AccucutCurrentRelease`, `Remove-AccucutOldReleases`, `Remove-AccucutDirectory`, `Copy-AccucutTree`, `Remove-AccucutOldLogs` |
| Services and health | `Get-AccucutServiceNames`, `Get-AccucutPostgresServiceName`, `Initialize-AccucutServiceFiles`, `Set-AccucutServiceIdentity`, `Assert-AccucutServiceIdentity`, `Start-AccucutServices`, `Stop-AccucutServices`, `Get-AccucutHttpStatus`, `Wait-AccucutHealth`, `Invoke-AccucutMigration` |

Not here yet, and added by the stories that need them: the `job_runs` write, the backup manifest, the free-space reading for the backup check,
and the byte pipe (`pg_dump | age`, inside `cmd.exe /c`).

## Tests

`Invoke-Pester deploy/windows/tests` (Pester 5): prompts, programs and services are mocked, so it changes nothing on the machine. `Trust.Tests.ps1`
tests the trust block (every rule, on invented security descriptors, plus real links, unpacking and child processes under `TestDrive`). CI stage 13
(`.github/workflows/windows-package.yml`, job **Stage 13: Windows package**) builds the zip on a Windows runner, installs it, updates it, proves
the rollback with a release that is broken on purpose, and runs those tests. On the real install it also proves three things of ADR-015 Amendment 2:
a tampered module planted beside the true zip is never loaded; an update is refused (exit code 1, services still running) when the Users group can write
the running module; and `install.ps1 -Root C:\AccucutPre` over an existing empty folder is refused and leaves the folder untouched. It is not a required check; every pull request that touches
`deploy/**`, `package.json`, `package-lock.json`, `next.config.ts`, `prisma/**` or the worker must still have it green.
Not tested in CI: the timed walk-through of NFR-030 and a real Windows Update reboot (both by hand).
