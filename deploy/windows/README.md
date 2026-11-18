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
6. **An age key pair for the backups**, made on **your own computer** (not on the server) with `age-keygen` (it is in the release's `bin` folder, or from
   github.com/FiloSottile/age): `age-keygen -o accucut-backup-key.txt`. The install asks for the **public key** (the text that starts with `age1`) and
   nothing else. **Keep the file with the private key (`AGE-SECRET-KEY-...`) in two safe places that are not this server.** Every backup is encrypted to
   the public key, so whoever holds the private key can read every backup, and **without it no backup can ever be restored**. The private key must never be on
   the server, in a values file, or in an e-mail to the installer.

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
   password, **the age public key for the backups**, the PostgreSQL administrator password and, if you use it, mail settings. It invents every other secret itself.
6. It installs, starts the portal and waits until `/api/health` answers, then **runs the weekly backup once** (the first backup, see "Backups" below). When it
   ends with **Done**, open the address you gave and sign in as the first Admin. You will be asked to choose a new password.
   If it stops at the backup with "Windows refused the logon of AccucutBackup", the portal is running and only the backup needs a setting: see
   "Backups" below.

For an install with no one at the keyboard, copy `values.example.txt`, fill it in, and run
`.\install.ps1 -ZipPath <zip> -Sha256 <hash> -ValuesFile <your copy> -NonInteractive`. **Delete your copy afterwards**: it holds the first password.

Useful switches: `-Root` (not `C:\Accucut`; exactly one folder below a drive, such as `D:\Accucut`), `-Port` (not 3000), `-NodeExe` (not
`C:\Program Files\nodejs\node.exe`), `-WithProxy` (a TLS proxy such as Caddy or IIS will stand in front: the portal
listens on 127.0.0.1 only and Windows Firewall opens TCP 80 and 443; **you install the proxy**), `-DefenderExclusion Yes|No|Ask`, `-AdminAccount <DOMAIN\user>` (the Admin's own, limited Windows account: sets up the JEA endpoint of the guided restore, see "Restore a backup").

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
| Refuses | To run twice, and to touch a database called `accucut` or roles `accucut_app`, `accucut_owner` or `accucut_backup` that already exist. It never changes existing data. |
| Settings | `C:\Accucut\config\.env` for the web app and the worker, and `C:\Accucut\config\migrate.env` (the owner database role and the first Admin) for the install and update scripts only. Both are created empty, locked, and only then filled. |
| Database | Creates the database and the three roles from `sql\create-roles.psql` (the owner, the app, and `accucut_backup`, which can read the data and add one row to `job_runs`, nothing else), runs the migrations as the owner role, loads the field registry, creates the first Admin. |
| Services | `AccucutApp` and `AccucutWorker` (WinSW 2.12.0): Automatic (Delayed Start), after PostgreSQL, restart after 10, 30 and 60 seconds, each as its own account (`NT SERVICE\AccucutApp`, `NT SERVICE\AccucutWorker`), **never LocalSystem**. |
| Logs | `C:\Accucut\logs\`: the services write a new file each day. The install and update logs are new files with unpredictable names (`install-<time>-<random>.log`), created fresh and never appended to, because the two service accounts can write in this folder. There is no scheduled task and no other account for the clean-up: **AccucutWorker deletes the service, install and update logs older than 30 days itself, once a day at 03:30 India time** (its `log-prune` job; the install writes the folder into `LOG_DIRECTORY` in `.env`). It deletes only regular files directly in that folder that have the portal's own log names, and never follows a link. |
| Defender | **Offers to exclude PostgreSQL's data folder from Windows Defender real-time scanning, and says so.** PostgreSQL advises it. You may refuse (`-DefenderExclusion No`, or answer no). Undo it with `Remove-MpPreference -ExclusionPath <folder>`. |
| Backups | The local user `AccucutBackup` (for the weekly task only), the task **Accucut weekly backup** (Sunday 02:00), the protected folder `C:\Accucut\backups`, the protected files `config\backup.pgpass` and `config\backup-settings.json`, and the first backup. See "Backups". |
| Restore (STORY-10.11) | The database role `accucut_restore` (it can create a database and act as the owner; it is not a superuser), its password in `configestore.pgpass` (Administrators only), and, with `-AdminAccount`, the Admin's limited account: a local group, the JEA endpoint `AccucutAdmin` and a desktop shortcut. See "Restore a backup". |

If a step fails before the services are registered, the install drops what it created (the database and the two roles, which are new and empty),
copies its log to your temp folder (`%TEMP%\accucut-failed-install-<time>.log`) and removes the whole install folder that this run made, so that you can
run it again. Read the message, fix the cause, run it again. The log is `C:\Accucut\logs\install-<time>.log` once the install has succeeded.

### Folders

```
C:\Accucut\
  releases\<tag>\   the running release and the previous one (nothing older is kept)
  current           a junction to the running release
  config\           .env, migrate.env, backup.pgpass, backup-settings.json, restore.pgpass, install-state.json (no secret in the two .json files); jea\ with -AdminAccount
  services\         the WinSW programs and their XML files
  logs\             install, update and service logs; restore.log (every restore); jea\ (the transcripts of the Admin's session)
  backups\          the encrypted backup copies and their manifests (the backup account and Administrators only)
```

`C:\Accucut` is closed to ordinary users: only Administrators and SYSTEM can write, and only the two service accounts and `AccucutBackup` can read the
program files (read and execute: five entries in all, none inherited). `.env` can be read by Administrators and the two service accounts only;
`migrate.env` by Administrators only. `backup.pgpass` and `backup-settings.json` by Administrators and `AccucutBackup` only; `restore.pgpass` by Administrators only. With `-AdminAccount` (see "Restore a backup") the root gets a sixth entry, read and execute for one local group,
and that group may also read the three settings files above. `backups` is protected
too: Administrators and SYSTEM full control, `AccucutBackup` Modify, and **no entry for the portal's own services**, so a taken-over portal can neither read
nor delete a backup.

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

- **No backup, no update.** The release backup runs first (`backup.ps1 -Reason release`, through the same trust checks); if it fails, nothing has been
  changed and the update stops. If you accept that nothing can be restored if it goes wrong, add `-NoBackup`; it says so in the log.
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
| Start over after a failed install | Drop what is left (`DROP DATABASE accucut; DROP ROLE accucut_restore, accucut_app, accucut_owner, accucut_backup;` in `psql` as `postgres`; and `DROP DATABASE` for any `accucut_new_...`, `accucut_old_...` or `accucut_failed_...` that a restore left), run `C:\Accucut\services\AccucutApp.exe uninstall` and the same for `AccucutWorker`, run `Unregister-ScheduledTask 'Accucut weekly backup' -Confirm:$false`, take `AccucutBackup` out of "Log on as a batch job" (Local Security Policy, Local Policies, User Rights Assignment; do this **before** the next command, or a bare SID stays in the list) and run `Remove-LocalUser AccucutBackup`, delete `C:\Accucut`, run the install again. |
| See the last backups | `Get-ChildItem C:\Accucut\backups` as an administrator, or the "Last backup" line on the portal's Settings page (Admin). |

After a Windows Update reboot both services start by themselves, a minute or so after PostgreSQL (NFR-012).

## Backups (STORY-10.05)

**What happens.** Every Sunday at 02:00 **server time** (keep the server on India Standard Time: the install warns "The backup runs at 02:00 server time; this server is not set to India Standard Time." when it is not), the scheduled task
**Accucut weekly backup** runs `C:\Accucut\current\backup.ps1 -Reason weekly` as the local user **AccucutBackup**. That user is in no group, is not
for signing in, and its password is known only to Task Scheduler. The script:

1. checks, with the trust rules above and before it does any work, where it runs from, the install folder, the module, its settings files, the backups folder
   and the three programs (`age.exe` from the release, `pg_dump.exe` and `psql.exe` from PostgreSQL's folder), each by full path. A failed check stops it;
2. checks the **free space first**: a copy is made only if at least **20 %** of the disk is still free afterwards (the planned size is the last copy plus 10 %).
   If not, **no copy is made and nothing is deleted** (a newer copy is never removed to make room), a failed run is recorded and the exit code is 1;
3. runs `pg_dump -Fc` and encrypts it with `age` to your public key, as bytes (no PowerShell pipeline, no `cmd.exe`), into
   `C:\Accucut\backups\accucut-<UTC time>-weekly.age`, under a temporary name first. It keeps the copy only if **both programs exit 0**, the file is not empty and
   starts with the age header (`age-encryption.org/v1`); otherwise the temporary file is deleted and the run is a failure;
4. writes the manifest beside it, `accucut-<UTC time>-weekly.manifest.json` (SHA-256, size, PostgreSQL version, time, reason, release), and only then gives the copy
   its final name;
5. prunes: **only copies older than 2 calendar years (counted in UTC), never one of the newest 4, never a newer copy**; and writes one `job_runs` row (`job = 'backup'`:
   status, size, free space and total size of the disk) as the database role `accucut_backup`, whenever the database can be reached;
6. writes **one event in the Windows Application log**, source `Accucut` (the install registers it): Information 1000 with the file name and size, or Error 1010
   (a check failed and nothing was done), 1011 (the backup failed) or 1012 (not enough free space), with a short message that holds no path and no secret. The
   exit code is 1 on any failure, so Task Scheduler's history shows it too. There is no log file: `AccucutBackup` has no right on `C:\Accucut\logs`. Look at it with
   `Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Accucut' }`.

Before every update the update script runs the same script with `-Reason release`: that copy is named `...-release.age` and is not pruned within its first 2 years.
Once a day the worker's `backup-watch` job reads the free space of the data volume and the backup volume (`PG_DATA_VOLUME` and `BACKUP_VOLUME` in `.env`)
and writes its own row, and flags a week with no good backup (8 days). The Settings page shows the last backup and "Disk nearly full" from those rows.

**The key.** The server holds only the public key (`config\backup-settings.json`, which `AccucutBackup` can read and cannot change). The private key is yours
(Install, item 6). **The key must not be kept with the backups.** A restore (`restore.ps1`, see "Restore a backup") asks for it at a secure prompt, passes it to `age` on standard input only, and never writes it anywhere.

**The right "Log on as a batch job".** Windows lets a user run a task with a stored password only if the user has the right "Log on as a batch job". The install
gives that right to `AccucutBackup` and to no one else, and it gives it to the account's own SID, never to a group. It changes nothing else in the server's
policy: no other right, no other account, and not "Deny log on as a batch job". Removing the account (see "Start over") takes the right away first. The install
reads the policy before it creates anything and stops, with nothing changed, if "Deny log on as a batch job" already holds Everyone, Authenticated Users,
Local account or Users (a deny wins over a grant, so the backup could never log on).

**On a server that belongs to a domain.** A Group Policy that sets "Log on as a batch job" for the whole server would remove a right given here at its next
refresh. The install reads the policy result (read-only). If a policy sets the right and does not list `AccucutBackup`, or the result cannot be read, it stops
before it creates anything and says which policy. Ask the domain administrator to add the local account of this server (`<server name>\AccucutBackup`) to that
setting, keeping the accounts already there, then run the install again. If you have checked by hand that no policy sets the right, run the install again with
`-BatchRightPolicyConfirmed`; it then skips only the reading of the policy result and writes a warning to the install log.

**If the first backup at the end of the install says "Windows refused the logon of AccucutBackup".** The Security log holds event 4625 with status 0xC000015B for
that account: the right was missing or removed. Give `AccucutBackup` the right again (Local Security Policy, Local Policies, User Rights Assignment, Log on as a
batch job; or ask the domain administrator), then run `Start-ScheduledTask 'Accucut weekly backup'` and check that a new `.age` file appears in
`C:\Accucut\backups`. The portal itself is running.

**If the weekly backup stops starting later.** An update checks the right and writes a warning ("The weekly backup cannot log on: AccucutBackup no longer has 'Log on
as a batch job'") when it is gone, and carries on: it never gives the right back and never takes it away. The usual cause is a Group Policy that was added after the
install. Give the right again as above.

**PowerShell logging.** If a Group Policy switches on PowerShell **module logging** (`HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging\EnableModuleLogging = 1`), Windows
records the values given to commands in the event log `Microsoft-Windows-PowerShell/Operational` (event 4103), and that would include the passwords the install gives to the backup
account and to the database role `accucut_backup`. The install checks for it and says so in a warning, and carries on. Switch module logging off for the install, or clear that log
afterwards (`wevtutil cl Microsoft-Windows-PowerShell/Operational`).

**Off-server copy (recommended, yours to set up).** The copies are on the same disk as the data: a failed disk or a lost server loses both. Copy each weekly
`.age` file and its manifest to another place (a share, a NAS, a rotated disk kept elsewhere) with a task of your own, for example on Sunday at 04:00. The
files are already encrypted. Give your copy account **Read** on `C:\Accucut\backups` only. Keep the private key somewhere else again.

### When Settings says "Disk nearly full" (for the Admin)

It means the disk has less than 20 % free and the portal may stop if nothing is done. The Admin clears the oldest copies with one command. Sign in to the server
(Remote Desktop), open **Windows PowerShell as administrator** and run:

```powershell
cd C:\Accucut\current
.\clear-copies.ps1
```

(When the Admin's limited account is set up (see "Restore a backup", below), it is one command, `Clear-AccucutCopies`, in the Admin's own window; the questions are the same.)

1. It lists the copies **oldest first** with date, kind and size, and the free space. The **newest 4 copies are always kept** and are marked KEEP.
2. It asks you to **type the date** (`YYYY-MM-DD`, as listed, in UTC) of the **newest** copy to remove. Every older copy goes with it, oldest first. If what you
   type is not the date of a copy that may be removed, **nothing is removed**.
3. It tells you how many copies go and how much space that frees, and asks you to type **YES**. Anything else stops it.
4. It removes each copy with its manifest, and nothing else (it deletes only files that it can prove are the backup's own: the exact name, a regular file directly
   in the folder, a manifest that agrees), and writes one `job_runs` row (`backup-clear`: how many, which dates, the free space after).

**A copy that is removed cannot be restored.** If only the newest 4 are left and the disk is still too full, the script says so: the disk is too small for the data.
Call your IT person.

## Restore a backup (STORY-10.11)

**Who this is for.** The Admin, who is **not** a system administrator, with the IT person on hand but not helping. You do not need to know Windows Server, PostgreSQL or
PowerShell: you open one window, type one command, answer four questions in plain words, and read what it says.

**When to use it.** After a bad update, or when data in the portal has been damaged and cannot be put right inside the portal. A restore puts the whole portal back to
the day of a backup copy. **Everything entered after that day is lost: every estimate, every approval, every master value, and the audit rows too.** A copy is made once a
week, so a restore from the last good copy loses up to 7 days of work (14 if a weekly run failed without anyone noticing). If only one thing was changed by mistake, the record
often survives inside the portal: ask first.

**What you need before you start.**

1. **The backup key**: the one line that starts with `AGE-SECRET-`, from the place where you keep it (never on this server). **Without it no backup can be read.**
2. **Your IT person**, on hand. They are not there to help you type; they are there if the command stops.
3. **A quiet time.** The portal is stopped while it restores, usually for a few minutes (longer for a big database). Tell the people who use it.

### How to do it

1. **Sign in to the server with your own Windows account** (Remote Desktop, as your IT person set up for you).
2. **Double-click "Accucut Admin" on the desktop.** A window opens and connects. (If there is no shortcut, your IT person has not set up your limited account yet: they
   open Windows PowerShell **as administrator**, run `cd C:\Accucut\current` and `.\restore.ps1`, and the questions below are the same.)
3. **Type `Restore-AccucutBackup` and press Enter.** It takes no arguments.
4. **It lists the copies, newest first**, with the date (UTC), the kind (`weekly` or `release`) and the size. **Type the number** of the copy you want and press Enter (Enter on
   its own stops everything). A copy marked CANNOT BE USED has no matching record and cannot be chosen.
5. **It checks the copy before it touches anything:** that the file is exactly what was written (its SHA-256 against its manifest), that the PostgreSQL version that made it is the same as
   or older than this server's, and that the disk has room. You see `Checks passed`, or it stops (see "If it stops" below).
6. **It tells you what will be lost and asks you to TYPE the date of the copy** exactly as it is shown, such as `2026-11-15`. **This is the step that cannot be undone by a slip of a key.**
   If what you type is not that date, nothing is restored. Read the date again, and type it.
7. **It asks you to paste the backup key.** Right-click in the window to paste, then press Enter. **Nothing is shown on the screen, not even dots: that is normal.** It checks, before it
   stops anything, that the key opens the copy you chose.
8. **It restores.** It stops the portal, takes a **safety copy of the portal as it is now** (so that a wrong restore can be put back), makes a new database from the copy, brings it up to
   this release, swaps it in only if everything worked, starts the portal and checks that it answers. You can read each step as it happens. Do not close the window.
9. **`Restore finished`** means the portal is running on the copy. Open the portal and check that what you expect is there. The safety copy is in the backups folder as a copy named
   `...-release.age`; it is the way back if the restore was a mistake (restore it the same way).

### If it stops

Every stop ends with **"Call your IT person."** What the portal is doing is in the message. **When you call, read them the message and say which copy (the date) you chose.**

| It says | What it means | What happens to the portal |
|---------|---------------|----------------------------|
| `does not match the checksum in its manifest` | That copy has been changed or damaged. | Nothing was changed; the portal is running as before. Choose another copy with your IT person. |
| `can be restored only into the same or a newer PostgreSQL` | The copy was made by a newer PostgreSQL than this server has. | Nothing was changed. |
| `not enough free disk space for a restore` | A restore needs room for a safety copy and the new database. | Nothing was changed. Clear old copies (see "Disk nearly full") or ask IT for a bigger disk. |
| `not the date of the copy` | You typed a different date. | Nothing was changed. Run the command again and type the date exactly as shown. |
| `does not open the copy` | The key is not the one that belongs to this server's backups. | Nothing was changed. Find the right key (two copies are kept apart). |
| `The restore of ... failed ... The portal is running on the old database` | Something failed after the portal was stopped. The old database was put back and the portal started again. | The portal is running as before the restore. The safety copy is in the backups folder. |
| `... may not be running: look at the services first` | A step failed and the old database could not be put back, or the portal could not be started. | **The portal may be down.** Tell your IT person at once. |

**Where it is recorded.** Every restore, good or not, is written to `C:\Accucut\logs\restore.log` and as one event in the Windows Application log, source `Accucut`
(1100 done, 1101 stopped by the Admin, 1110 a check failed and nothing was done, 1111 it failed and the portal runs on the old database, 1112 it failed and the old database could not be put
back). That record is **outside the database**, because restoring an older copy rolls the database's own audit rows back. Look at it with
`Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Accucut' }`.

**The key.** You paste it at a secure prompt. It goes to `age` on standard input only. It is never written to a disk, a log, a transcript or the temp folder, and it is blanked from every message.

### For the IT person: the Admin's limited account (A-35)

The Admin should not be an administrator (the Admin already sees every cost in the portal; what an administrator account would add is `.env`, the database and the audit tables).
`install.ps1 -AdminAccount <DOMAIN\user>` sets up **one JEA endpoint, `AccucutAdmin`**, which that one account may open (give the account Remote Desktop rights as you see fit):

- It shows **exactly two commands**, `Restore-AccucutBackup` and `Clear-AccucutCopies`, each of which runs the installed `restore.ps1` or `clear-copies.ps1` (checked like every script that loads
  or runs code). The Admin can reach nothing else.
- It runs as a **virtual account that is in one new local group, `AccucutAdminRunAs`, and nothing else** (never a local administrator). The group is given: read and execute on `C:\Accucut` (the sixth
  entry of the root), Modify on `backups`, read on `backup.pgpass`, `backup-settings.json` and `restore.pgpass`, Modify on `logs\jea` and on the one file `logs\restore.log` (the `logs` folder itself gets
  no entry), and start and stop on the two services. Nothing on `.env`, `migrate.env` or the database's own roles.
- It writes a **transcript of every session** to `C:\Accucut\logs\jea\`. The key is read as a secure string, so it is not in them.
- A shortcut **Accucut Admin** is put on the desktop. It runs `Enter-PSSession -ComputerName localhost -ConfigurationName AccucutAdmin`, so Windows Remote Management (WinRM) must be running
  (`Enable-PSRemoting -Force` if it is not; the install does not switch it on).
- **A restore needs a database role of its own.** The install makes `accucut_restore` (CREATEDB, acts as the owner, **not** a superuser) with its password only in `config\restore.pgpass`.
  A restore itself replaces the database, so the account that runs it can do what the owner can do; the endpoint is what keeps the Admin from using that directly.

**If the Admin's account cannot be limited** (Accucut IT declines A-35, or the check in `deploy/windows/manual/AC-8-jea-prompt-check.md` fails on your server), leave `-AdminAccount` off: the scripts are
the same, `restore.ps1` and `clear-copies.ps1` run as a full administrator from `C:\Accucut\current`, and the Admin's risk (RISK-018) is the full one.

**Hand-over of the Admin's role.** The portal cannot do this for you. (1) Pass the **backup key** to the new Admin, and keep two copies apart. (2) Remove the old account's access:
`Unregister-PSSessionConfiguration -Name AccucutAdmin -Force`, delete the desktop shortcut, and register the endpoint again for the new account (`install.ps1` is not run twice: ask for a re-registration
change, or follow `Register-AccucutAdminEndpoint` in the module). (3) Check that the old Admin's Windows account is disabled.

**Before go-live the Admin does one restore rehearsal**, from this chapter alone, timed, with you on hand and not helping unless it stops (NFR-013, DL-035). Do it on the staging copy, with a copy made on
staging. A restore from the oldest copy once a year is recommended: a 2-year copy is worth only what can still be read.

**Not covered here:** an off-server copy (yours to set up, see "Backups"), the timed walk-through of NFR-030 and the interactive proof in a real JEA session (it is by hand, with the script in
`deploy/windows/manual/`).

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
| The backup account and task (the install) | `Register-AccucutBackupTask` (the local user and the weekly task; the password is made in memory and never leaves it), `Remove-AccucutBackupAccount`, `Wait-AccucutBackupTask`, `Test-AccucutLogonTypeFailure`, `Get-AccucutBackupAccountSid`, `New-AccucutComplexPassword`, `Grant-AccucutBackupRootAccess`, `New-AccucutBackupFolder`, `Write-AccucutBackupConfig` (`backup.pgpass`, `backup-settings.json`), `Read-AccucutBackupSettings` |
| The backup (`backup.ps1`, `clear-copies.ps1`) | `Invoke-AccucutBackup`, `Invoke-AccucutBackupPipe` (`pg_dump` to `age` to a file, both exit codes checked), `Test-AccucutBackupRoom` (the 20 % rule), `Get-AccucutBackupCopy`, `Get-AccucutBackupKeepSet` (the newest 4), `Get-AccucutBackupPruneCandidate`, `Invoke-AccucutBackupPrune`, `Remove-AccucutBackupCopy` (the only delete of a copy), `Clear-AccucutCopies` (the guided clear), `Add-AccucutJobRun` (INSERT only, values quoted by psql), `Get-AccucutDatabaseInfo`, `Get-AccucutVolumeSpace`, `Format-AccucutSize` |
| The restore (`restore.ps1`) | `Invoke-AccucutRestore` (the whole guided restore), `Invoke-AccucutRestorePipe` (`age -d` to `pg_restore`, as bytes, both exit codes checked), `Test-AccucutBackupKey`, `Test-AccucutRestoreVersion`, `Test-AccucutRestoreRoom`, `New-AccucutRestoreDatabase`, `Switch-AccucutRestoreDatabase` (the swap), `Remove-AccucutRestoreDatabase`, `Add-AccucutRestoreLogLine` (restore.log), `Write-AccucutRestoreEvent`, `Read-AccucutKeyInput` (the secure prompt) |
| The Admin endpoint (the install, `-AdminAccount`) | `Register-AccucutAdminEndpoint`, `Unregister-AccucutAdminEndpoint`, `Grant-AccucutAdminEndpointAccess`, `Grant-AccucutServiceControl`, `New-AccucutAdminEndpointFiles`, `Write-AccucutRestoreConfig` |

`backup.ps1`, `clear-copies.ps1` and `restore.ps1` carry the same trust block as `install.ps1` and `update.ps1` (a test keeps the five copies equal) because they load the module.

## Tests

`Invoke-Pester deploy/windows/tests` (Pester 5): prompts, programs and services are mocked, so it changes nothing on the machine. `Trust.Tests.ps1`
tests the trust block (every rule, on invented security descriptors, plus real links, unpacking and child processes under `TestDrive`). CI stage 13
(`.github/workflows/windows-package.yml`, job **Stage 13: Windows package**) builds the zip on a Windows runner, installs it, updates it, proves
the rollback with a release that is broken on purpose, and runs those tests. On the real install it also proves three things of ADR-015 Amendment 2:
a tampered module planted beside the true zip is never loaded; an update is refused (exit code 1, services still running) when the Users group can write
the running module; and `install.ps1 -Root C:\AccucutPre` over an existing empty folder is refused and leaves the folder untouched. For STORY-10.05 it also proves, on the real install: the
account `AccucutBackup`, the task, the right "Log on as a batch job" (an export of the user rights before and after the install shows the new SID added and nothing else changed, and an export after the removal shows the policy as it was), the five entries of the root, the exact entries of `backups` and of the two backup files, the install's own first backup (it
decrypts with the run's own throwaway key and restores into a scratch database), what the `accucut_backup` role can and cannot do, a release backup, a clear
(a wrong date removes nothing; the right one keeps the newest 4 and leaves everything that is not the backup's own), and that a replaced module is never loaded by
`backup.ps1` or `clear-copies.ps1`. It is not a required check; every pull request that touches
`deploy/**`, `package.json`, `package-lock.json`, `next.config.ts`, `prisma/**` or the worker must still have it green.
For STORY-10.11, `Restore.Tests.ps1` restores a small invented dump with the **real `age`** and a key that `age-keygen` made for that test (a stand-in `pg_restore` keeps what it receives), answers every prompt by a
mock, and proves the four failures that stop before anything is touched (a changed SHA-256, a newer PostgreSQL, a wrong key, a mismatched date), the failures after the portal was stopped (the old database is put back and
the portal started again), and that the key is on no disk, no screen line and no log line. Its last group restores the install's own newest copy on the real install of stage 13 (real services, PostgreSQL, `pg_restore`
and migrations, with only the two prompts mocked). `Jea.Tests.ps1` reads the two endpoint templates, and on the runner registers a real endpoint, opens a session, lists what it offers (exactly the two commands) and runs
them as a virtual account that is not an administrator.
Not tested in CI: the interactive proof that the prompts, including pasting the key as a secure string, work inside a real JEA session on a real Windows Server (AC-8, by hand first, with the script in
`deploy/windows/manual/AC-8-jea-prompt-check.md`), the timed walk-through of NFR-030 and a real Windows Update reboot (all by hand).
