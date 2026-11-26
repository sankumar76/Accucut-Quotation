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
5. It checks the zip's SHA-256 first, then asks a few questions: the address people will type (the proxy's https address, such as
   `https://portal.example.test`, with no port: see "Reverse proxy"), the first Admin's e-mail address and a first
   password, **the age public key for the backups**, the PostgreSQL administrator password and, if you use it, mail settings. It invents every other secret itself.
6. It installs, starts the portal and waits until `/api/health` answers, then **runs the weekly backup once** (the first backup, see "Backups" below). When it
   ends with **Done**, open the address you gave and sign in as the first Admin. You will be asked to choose a new password.
   If it stops at the backup with "Windows refused the logon of AccucutBackup", the portal is running and only the backup needs a setting: see
   "Backups" below.

For an install with no one at the keyboard, copy `values.example.txt`, fill it in, and run
`.\install.ps1 -ZipPath <zip> -Sha256 <hash> -ValuesFile <your copy> -NonInteractive`. **Delete your copy afterwards**: it holds the first password.

Useful switches: `-Root` (not `C:\Accucut`; exactly one folder below a drive, such as `D:\Accucut`), `-Port` (not 3000), `-NodeExe` (not
`C:\Program Files\nodejs\node.exe`), `-WithProxy` (a TLS proxy such as Caddy or IIS will stand in front: the portal
listens on 127.0.0.1 only and Windows Firewall opens TCP 80 and 443; **you install the proxy, as "Reverse proxy" below says. Use this switch on every server that people use**: without it the portal answers plain http on every address, sign-in works only in a browser on the server itself, and the sign-in limits can be dodged), `-DefenderExclusion Yes|No|Ask`.

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
| Restore (STORY-10.11) | The database role `accucut_restore` (it can create a database and act as the owner; it is not a superuser) and its password in `config\restore.pgpass`, which only Administrators and SYSTEM can read. Nothing else: the Admin runs the restore as an administrator (see "Restore a backup"). |

If a step fails before the services are registered, the install drops what it created (the database and the two roles, which are new and empty),
copies its log to your temp folder (`%TEMP%\accucut-failed-install-<time>.log`) and removes the whole install folder that this run made, so that you can
run it again. Read the message, fix the cause, run it again. The log is `C:\Accucut\logs\install-<time>.log` once the install has succeeded.

### Folders

```
C:\Accucut\
  releases\<tag>\   the running release and the previous one (nothing older is kept)
  current           a junction to the running release
  config\           .env, migrate.env, backup.pgpass, backup-settings.json, restore.pgpass, install-state.json (no secret in the two .json files)
  services\         the WinSW programs and their XML files
  logs\             install, update and service logs; restore.log (every restore)
  backups\          the encrypted backup copies and their manifests (the backup account and Administrators only)
```

`C:\Accucut` is closed to ordinary users: only Administrators and SYSTEM can write, and only the two service accounts and `AccucutBackup` can read the program files (read and execute: five entries in all, none inherited). `.env` can be read by Administrators and the two service accounts only; `migrate.env` and `restore.pgpass` by Administrators only; `backup.pgpass` and `backup-settings.json` by Administrators and `AccucutBackup` only. `backups` is protected too: Administrators and SYSTEM full control, `AccucutBackup` Modify, and **no entry for the portal's own services**, so a taken-over portal can neither read nor delete a backup. An account that is not an administrator cannot open `C:\Accucut` at all.

## Reverse proxy (required on every server people use)

The portal does not speak https itself. A **TLS reverse proxy** on the same server takes the https connection and passes each request to the portal at
`http://127.0.0.1:3000` (or your `-Port`). The portal's security depends on what that proxy does. This section says what it must do, gives a configuration
for each of the two proxies we describe, and ends with a checklist you tick. Design: architecture section 8 ("Reverse proxy contract") and
[ADR-017](../../docs/04-architecture/adr/ADR-017-export-limits-from-target-host.md) (export time and memory).

**Which proxy.** **Caddy** is the one we support and describe first: one small program, one text file, no other Windows roles. **IIS** (with URL Rewrite and
Application Request Routing) is described second, for a server where Accucut IT already runs IIS. The delivery team has not run the IIS configuration;
the checklist at the end is what proves it on your server. Use one proxy only, directly in front of the portal. If another device (a load balancer or a
firewall that ends TLS) also forwards to this server, stop and ask the delivery team first: the sign-in limits would then see that device's address for
everyone.

### What the proxy must do, and why

| # | The proxy must | Why the portal needs it | Caddy | IIS |
|---|----------------|-------------------------|-------|-----|
| P1 | **End TLS** (TLS 1.2 or later) with a certificate for the address people type, and send plain http to `https://` | The session cookie is `__Secure-`, Secure-only. Over plain http no browser except one on the server itself keeps it, so nobody can sign in. `APP_ORIGIN` in `C:\Accucut\config\.env` must be exactly that https address, with no port and no path (for example `https://portal.example.test`), or every save is refused by the portal's same-origin check | `tls` line, automatic redirect | https binding, HSTS redirect |
| P2 | **Put the address of the connecting computer as the last entry of `X-Forwarded-For`, and never pass on an address the browser sent as if it were real** | The sign-in, password-change and password-reset limits count failures per address, and take that address from the **last** entry of `X-Forwarded-For` (`src/server/auth/client-address.ts`). If the proxy passes on what the browser sent, an attacker gets a fresh counter on every request by inventing an address. If the proxy sends nothing, or adds a port (`198.51.100.4:51234` is not an address), every caller shares one counter, so one person's typos can lock out the whole office | default; never set `trusted_proxies` | `includePortInXForwardedFor` False |
| P3 | **Add `Strict-Transport-Security: max-age=31536000`** and **remove the `Server` header**, and **pass the portal's own security headers through unchanged** | HSTS belongs to whatever ends TLS, so the proxy is its only sender. The portal sends `Content-Security-Policy` (with `frame-ancestors 'none'`, which stops other sites framing the sign-in or the Approve and Unlock dialogs), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` itself (DEF-054); the proxy must not add, change or strip them | `header` block | site `hsts`, `removeServerHeader` |
| P4 | **Keep the query string out of its access log** | The password-reset link is `https://<address>/reset-password?token=<secret>`. A log that records query strings would hold working reset links for an hour (#560 SQR-03) | `query` filter deletes `token` | the W3C field `cs-uri-query` is off |
| P5 | **Refuse a request body over 1 MB** | The portal reads up to 10 MB of a request into memory before its own checks run (#410). The largest real body is a picture upload of 256 KB | `request_body max_size 1MB` | `maxAllowedContentLength` 1048576 |
| P6 | **Drop an idle connection to the portal sooner than the portal drops it**: proxy 60 s, portal 125 s | A proxy that re-sends a request on a connection the portal is closing at that moment gives the person a random 502 or a lost save (RISK-032). Node's own default is 5 s, shorter than both proxies' defaults, so the portal service sets `KEEP_ALIVE_TIMEOUT=125000` (125 s) | `keepalive 60s` | (not adjustable: see the note) |
| P7 | **Wait up to 6 minutes for an answer** from the portal | The largest export (500 parts with pictures) can take minutes on a slow server, and the portal allows a build up to `EXPORT_TIMEOUT_SECONDS` (240 s by default, at most 300; ADR-017). A proxy that gives up first throws the file away | no response timeout (default) | proxy `timeout` 00:06:00 |
| P8 | **Be the only way in**: the portal listens on 127.0.0.1 only | Anything that reaches port 3000 directly skips P1 to P5 | `-WithProxy` at install | `-WithProxy` at install |

**The portal's side, for the developer (#576).** The service file `AccucutApp.xml` carries `<env name="KEEP_ALIVE_TIMEOUT" value="125000"/>` (P6; Next.js's
standalone `server.js` reads it) and `--max-old-space-size=1024` (ADR-017). `GET /api/health` answers with a header `X-Client-Address-Seen`, giving the address
the portal worked out (or `none`), so that check C5 can see P2 working. With `-WithProxy`, the install refuses an `APP_ORIGIN` that is not `https://`, and
ends with checks C2, C3 and C5 against `APP_ORIGIN`. Until those land, tick C5 by reading the configuration (no `trusted_proxies` in the Caddyfile;
`includePortInXForwardedFor` False in IIS).

### Certificates

The proxy needs a certificate for the address people type, which every phone, tablet and PC that uses the portal already trusts. Choose one:

- **A certificate from your own certificate authority or a bought one** (the usual case on an office network). Caddy needs it as two PEM files: the certificate with
  its chain, and the private key. IIS takes a `.pfx`. Keep the private key readable by Administrators and the proxy only.
- **A free public certificate that Caddy fetches and renews by itself.** This works only if the address is a public DNS name pointing to this server, and ports 80
  and 443 are reachable from the internet. Leave the `tls` line out of the Caddyfile.
- **Not supported:** a self-signed certificate or Caddy's `tls internal`. Every device would show a warning or need a root installed by hand, and HSTS (P3)
  then forbids clicking past the warning.

### Caddy (supported)

1. Download **Caddy 2.10 or a later 2.x** for Windows amd64 from the Caddy project's GitHub releases. Check the zip's SHA-256 against the checksums file of that
   release (`Get-FileHash <zip> -Algorithm SHA256`).
2. As an administrator, make the folders and copy `caddy.exe` into `C:\AccucutProxy`, and the certificate and key into `C:\AccucutProxy\certs`:

   ```powershell
   New-Item -ItemType Directory C:\AccucutProxy, C:\AccucutProxy\data, C:\AccucutProxy\logs, C:\AccucutProxy\certs | Out-Null
   ```

3. Save this as `C:\AccucutProxy\Caddyfile`. Replace `portal.example.test` with your address, the two certificate file names with yours, and `3000` with your
   `-Port` if you changed it. Forward slashes are correct in Windows paths here.

   ```caddyfile
   {
   	# No admin endpoint on the server; restart the service to apply a change.
   	admin off
   	storage file_system C:/AccucutProxy/data
   	servers {
   		timeouts {
   			read_header 10s
   			read_body 30s
   			idle 2m
   			# No write timeout: a large export is a long answer (P7).
   		}
   	}
   	# Caddy's own messages (502s and other errors). The filter keeps a reset token out of them too (P4).
   	log {
   		output file C:/AccucutProxy/logs/caddy.log {
   			roll_keep_for 720h
   		}
   		format filter {
   			request>uri query {
   				delete token
   			}
   		}
   	}
   }

   portal.example.test {
   	# P1. Leave this line out to let Caddy fetch a public certificate (see "Certificates").
   	tls C:/AccucutProxy/certs/portal.crt C:/AccucutProxy/certs/portal.key

   	# P5
   	request_body {
   		max_size 1MB
   	}

   	# P3: HSTS from the proxy only; Caddy's own Server header removed. The portal's other headers pass through untouched.
   	header {
   		Strict-Transport-Security "max-age=31536000"
   		-Server
   	}

   	# P2 is Caddy's default: it replaces any X-Forwarded-For the browser sent with the real address. Never add trusted_proxies here.
   	reverse_proxy 127.0.0.1:3000 {
   		transport http {
   			# P6: shorter than the portal's 125 s.
   			keepalive 60s
   			# P7: no read_timeout or response_header_timeout (none by default).
   		}
   	}

   	# P4: the access log, with the reset token removed from every address it records. Kept 30 days.
   	log {
   		output file C:/AccucutProxy/logs/access.log {
   			roll_keep_for 720h
   		}
   		format filter {
   			request>uri query {
   				delete token
   			}
   		}
   	}
   }
   ```

4. Check the file, then register Caddy as the service `AccucutProxy`, under its own virtual account and never LocalSystem. Give that account read access to
   the program, the file and the certificates, and write access to `data` and `logs` only. (The `icacls` lines come after `sc.exe config`, because the
   account `NT SERVICE\AccucutProxy` exists only once the service does. Keep the folder name free of spaces, as the service command line has no quotes.)

   ```powershell
   & C:\AccucutProxy\caddy.exe validate --config C:\AccucutProxy\Caddyfile --adapter caddyfile
   sc.exe create AccucutProxy start= delayed-auto DisplayName= "Accucut Quotation Portal (TLS proxy)" binPath= "C:\AccucutProxy\caddy.exe run --config C:\AccucutProxy\Caddyfile --adapter caddyfile"
   sc.exe config AccucutProxy obj= "NT SERVICE\AccucutProxy"
   sc.exe failure AccucutProxy reset= 86400 actions= restart/10000/restart/30000/restart/60000
   icacls C:\AccucutProxy /inheritance:r /grant:r "Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "NT SERVICE\AccucutProxy:(OI)(CI)RX"
   icacls C:\AccucutProxy\data /grant "NT SERVICE\AccucutProxy:(OI)(CI)M"
   icacls C:\AccucutProxy\logs /grant "NT SERVICE\AccucutProxy:(OI)(CI)M"
   Start-Service AccucutProxy
   ```

   After any change to the Caddyfile, run the `validate` line again, then `Restart-Service AccucutProxy`. If the service does not start, read
   `C:\AccucutProxy\logs\caddy.log`.

### IIS (alternative, where IIS is already in use)

Needs the Web Server (IIS) role, and Microsoft's **URL Rewrite 2.1** and **Application Request Routing 3.0** installed. The site is named `Accucut` below. As an
administrator:

1. Make a site `Accucut` with an **https** binding for your address and your certificate (a `.pfx` imported into the computer's certificate store). Add an http
   binding on port 80 for the redirect. Its folder (for example `C:\inetpub\accucut`) holds only the `web.config` below.
2. Server-wide ARR settings (P2, P7, and the Host header kept):

   ```powershell
   $appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
   & $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False" /includePortInXForwardedFor:"False" /timeout:"00:06:00" /commit:apphost
   ```

   If `appcmd` says an attribute is unknown, your ARR version differs from the one this was written for. Stop and ask the delivery team: P2 must not be
   guessed.
3. HSTS and the redirect to https (P1, P3), and the access log without the query string (P4):

   ```powershell
   & $appcmd set config -section:system.applicationHost/sites "/[name='Accucut'].hsts.enabled:True" "/[name='Accucut'].hsts.max-age:31536000" "/[name='Accucut'].hsts.redirectHttpToHttps:True" /commit:apphost
   & $appcmd set config -section:system.applicationHost/sites "/[name='Accucut'].logFile.logExtFileFlags:Date,Time,ClientIP,ServerIP,Method,UriStem,HttpStatus,HttpSubStatus,Win32Status,TimeTaken,ServerPort,UserAgent" /commit:apphost
   ```

   Do not turn on Failed Request Tracing for this site: it records full addresses.
4. The site's `web.config` (P3, P5, and the forwarding itself). `{UNENCODED_URL}` passes the path and query string exactly as the browser sent them:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="Accucut portal" stopProcessing="true">
             <match url=".*" />
             <action type="Rewrite" url="http://127.0.0.1:3000{UNENCODED_URL}" appendQueryString="false" />
           </rule>
         </rules>
       </rewrite>
       <security>
         <requestFiltering removeServerHeader="true">
           <requestLimits maxAllowedContentLength="1048576" />
         </requestFiltering>
       </security>
       <httpProtocol>
         <customHeaders>
           <remove name="X-Powered-By" />
         </customHeaders>
       </httpProtocol>
     </system.webServer>
   </configuration>
   ```

**Note on P6 for IIS.** ARR re-uses its connections to the portal but has no setting for how long it keeps an idle one. The portal's 125 s is meant to be longer,
but this is not proven for IIS. C9 is the check: if IIS logs show 502 with sub-status 3, tell the delivery team.

### Checklist (tick each one after the install, and again after any proxy change)

Run these in PowerShell. Use `curl.exe` (part of Windows Server 2019 and later), not `curl`, which in Windows PowerShell 5.1 is another command. Replace
`portal.example.test` with your address. Run C1, C4 and C5 **from another computer** on the office network, not from the server.

| # | Check | Command | Pass when |
|---|-------|---------|-----------|
| C1 | P1: https works with no certificate warning | `curl.exe -sS -o NUL -w "%{http_code}\n" https://portal.example.test/sign-in`, and open the address on one phone and one PC | `200`, and the browsers show no warning |
| C2 | P1: http goes to https | `curl.exe -sS -o NUL -w "%{http_code} %{redirect_url}\n" http://portal.example.test/sign-in` | `301` or `308`, then `https://portal.example.test/sign-in` |
| C3 | P3: the headers | `curl.exe -sSI https://portal.example.test/sign-in` | `strict-transport-security: max-age=31536000` once; `content-security-policy` holding `frame-ancestors 'none'`; `x-content-type-options: nosniff`; `x-frame-options: DENY`; `referrer-policy`; `permissions-policy`; no `server:` and no `x-powered-by:` line |
| C4 | P8: no way round the proxy | `curl.exe -sS -m 5 http://<the server's own address>:3000/api/health` | It fails (refused or timed out) |
| C5 | P2: the real address, last | `curl.exe -sSI -H "X-Forwarded-For: 203.0.113.7" https://portal.example.test/api/health` | `x-client-address-seen` is the address of the computer you ran it on: not `203.0.113.7`, not `none`, and no `:port` |
| C6 | P5: the body cap | `fsutil file createnew "$env:TEMP\accucut-2mb.bin" 2097152`, then `curl.exe -sS -o NUL -w "%{http_code}\n" -X POST -H "Content-Type: application/json" --data-binary "@$env:TEMP\accucut-2mb.bin" https://portal.example.test/api/v1/account/password/forgot` | `413` (Caddy) or `404` (IIS; its log shows sub-status 13). Delete the file afterwards |
| C7 | P4: no reset token in any log | Open `https://portal.example.test/reset-password?token=accucut-log-check` in a browser (it says the link does not work), wait a minute (IIS: `netsh http flush logbuffer`), then `Select-String -Path C:\AccucutProxy\logs\*.log -Pattern accucut-log-check` (IIS: the site's folder under `C:\inetpub\logs\LogFiles\`) | No output |
| C8 | P6: the keep-alive pair | `Select-String -Path C:\Accucut\services\AccucutApp.xml -Pattern KEEP_ALIVE_TIMEOUT`, and the Caddyfile's `keepalive 60s` | `value="125000"`, and `60s` (IIS: the first part only) |
| C9 | P6, P7: a working day without proxy errors (at the rehearsal, and after go-live) | `Select-String -Path C:\AccucutProxy\logs\caddy.log -Pattern '"status":502'` (IIS: lines with ` 502 3 ` in the site's log) | No output during a day of normal use that includes the largest export downloaded through the https address |
| C10 | The proxy comes back by itself | Restart the server and wait 3 minutes, with nobody signed in | C1 passes |

Keep the ticked list with the install record. A failed C3 to C7 means the portal is running with a weaker defence than it was designed for: fix it before people
start using the portal.

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

**Before you run it: check where the migrations will go (DL-317).** The update migrates whatever database `MIGRATE_DATABASE_URL` in
`C:\Accucut\config\migrate.env` names, whatever you meant. Nothing else changes the target: the release's own Prisma settings (`migrate\prisma.config.mjs`) read
no `.env` file, Prisma 7 reads none by itself, and the script hands the value to the one process that migrates. So a `.env` left in a release folder
cannot change it; only `migrate.env` can. In Windows PowerShell as administrator, run these three lines. They print the host, the port and the database name,
**never the password**:

```powershell
$line = (Select-String -LiteralPath C:\Accucut\config\migrate.env -Pattern '^MIGRATE_DATABASE_URL=').Line
$u = [Uri]$line.Substring($line.IndexOf('=') + 1).Trim([char]39, [char]34)
"Migrations will go to: host {0}, port {1}, database {2}" -f $u.Host, $u.Port, $u.AbsolutePath.TrimStart('/')
```

It must say the server's own PostgreSQL (normally host `127.0.0.1`, port `5432`, database `accucut`). If it names anything else, stop and call your IT person. Do not
print `$line` or `$u` themselves: they hold the password.

- **No backup, no update.** The release backup runs first (`backup.ps1 -Reason release`, through the same trust checks); if it fails, nothing has been
  changed and the update stops. If you accept that nothing can be restored if it goes wrong, add `-NoBackup`; it says so in the log.
- **If the migrations fail**, the junction is not moved and the previous release starts again.
- **If any step after the switch fails** (the service files, the WinSW check, the refresh) it is rolled back the same way, and the rollback puts the service
  XML files **and the WinSW programs** back as they were, byte for byte. If a rollback step itself fails, the message names it, the previous release is still
  started, and the script says "Call your IT person".
- **If the new release is not healthy**, the junction moves back, the previous release starts, and the script says **"Call your IT person"**.
  Migrations only add things (expand, then contract: architecture section 9.7), so the previous release still works on the migrated database.
- **To go back to an older release on purpose**, run `update.ps1` with that release's zip.
- **Going back past the CR-01 migrations is different.** Those migrations do not only add things, so running `update.ps1` with the older zip is not enough. Use the
  rollback runbook in architecture section 5.6, "CR-01 release rollback runbook" ([architecture.md](../../docs/04-architecture/architecture.md)). It applies to a
  database that has applied some of the CR-01 migrations and must go back to a release without them. Its server steps have not been rehearsed: rehearse them first.
- **Never run `prisma migrate deploy` by hand on the server.** `install.ps1` and `update.ps1` are the only ways the server's database is migrated. If a
  developer ever has to run Prisma by hand somewhere else (a copy, a test machine), the rule in "Migrating by hand" below applies.

### Migrating by hand (developers, copies and the rehearsal machine only)

From a checkout of the repository, `npx prisma migrate deploy` reads `prisma.config.ts`, which loads a `.env` file **from the folder you run it in**, for any
variable not already set in the shell. So the target is the shell's `MIGRATE_DATABASE_URL` if it is set, and otherwise the one in that `.env`, whatever you
meant. That is how a planned rehearsal on a throwaway copy went to the demo database on 22 Nov (DL-317; no harm, there was a backup). Before **any**
`migrate deploy` by hand:

1. In the same window and folder, run `npx prisma migrate status`. Its first line names the target without the password:
   `Datasource "db": PostgreSQL database "<name>", schema "public" at "<host>:<port>"`. Check the database name, the host and the port. Its list of
   migrations "not yet applied" must be exactly the ones you expect.
2. Take a backup of that database (`pg_dump -Fc`), and keep it outside the repository until the result is confirmed.
3. Only then run `npx prisma migrate deploy`, in the same window and folder.

On the delivery PC this matters most: it holds the development `.env` and several Docker databases.

**Rehearsing on a throwaway copy.** Restore the dump with its **original owners** (`pg_restore` without `--no-owner`, into a new database owned by the
owner role). With `--no-owner`, `_prisma_migrations` belongs to `postgres`, and `migrate deploy` as the owner role fails with "migration persistence is not
initialized" (seen in the DL-317 rehearsal, 22 Nov). Then run the three steps above against the copy. Step 1 must name the copy, not the original.

## At install, before go-live (DL-311, DL-317)

The release is rehearsed on the delivery PC (Windows 11, Docker Desktop), not on a Windows Server (DL-311, RISK-034). So the IT person, with the delivery
lead, runs this list on the real server at install and **before people start using the portal**. Go-live waits until every line is done or the delivery lead
has accepted, in writing, the line that is not.

| # | Check | How | Pass |
|---|-------|-----|------|
| 1 | **Which PostgreSQL the install will use** (DL-317) | Before `install.ps1`: the install creates its database on the PostgreSQL at `-PgHost` and `-PgPort` (default `127.0.0.1`, `5432`). Run `Get-NetTCPConnection -LocalPort 5432 -State Listen \| ForEach-Object { Get-Process -Id $_.OwningProcess }` with your port | The answer is `postgres` (the PostgreSQL 17 of "What you need"), not another program such as a Docker container. No backup is needed first: the install refuses a database called `accucut` that already exists |
| 2 | **Where every later migration goes** (DL-317) | Before every `update.ps1`: the three lines in "Before you run it: check where the migrations will go" (under Update). Keep the release backup on: never `-NoBackup` for a release that holds migrations | Host, port and database are the server's own (`127.0.0.1`, `5432`, `accucut`), and the update log shows the release backup |
| 3 | **The steps the rehearsal had to do differently** (DL-311 (2)) | The rehearsal record (qa-engineer, R-release tier of the test plan) lists each step the delivery PC forced to differ, for example Windows 11 instead of Windows Server, a port clash, IIS not available, administrator rights. Run each of those steps here as this guide says | Each step works as written on the server |
| 4 | **The reverse-proxy checklist C1 to C10** (DL-292 (3)), if IIS is the proxy | The IIS checklist in the reverse-proxy section of this guide | All ten lines pass |
| 5 | **The Admin's account** (ADR-015 Amendment 3.4) | Create the Admin's own Windows account and add it to the local Administrators group, as "Restore a backup", "For the IT person" says | The Admin can sign in, open Windows PowerShell as administrator and run `cd C:\Accucut\current` without an error |
| 6 | **`FEATURE_EMAIL` is off on web and worker** (DL-378) | In Windows PowerShell as an administrator: (a) `Select-String -Path C:\Accucut\config\.env -Pattern '^FEATURE_EMAIL='`; (b) `[Environment]::GetEnvironmentVariable('FEATURE_EMAIL','Machine')`; (c) `Select-String -Path C:\Accucut\services\*.xml -Pattern 'FEATURE_EMAIL'`; (d) `Restart-Service AccucutWorker, AccucutApp`, wait a minute, then `Select-String -Path C:\Accucut\logs\AccucutWorker.*.out.log -Pattern 'mail jobs are off: FEATURE_EMAIL is not on' \| Select-Object -Last 1`; (e) open the portal's sign-in page | (a) prints nothing, `FEATURE_EMAIL=` or `FEATURE_EMAIL=off`, never `on`; (b) and (c) print nothing; (d) shows a line from today with `"msg":"mail jobs are off: FEATURE_EMAIL is not on, so outbox-send is not scheduled"`; (e) shows "Forgot your password? Ask the Admin to reset it." and no "Forgot your password?" link. `SMTP_AUTH_MODE` is `none` and no mailbox password is in `.env`. E-mail stays off (alerts, password reset by e-mail, backup-watch e-mail), as the release notes say (KG-2) |
| 7 | **One 50-node export timing on the server** (NFR-010, DL-311 (4)) | Sign in as a Lead, open an estimate with 50 parts and 50 pictures (invented test data, removed afterwards), and time Download Excel from the click to the file | Within **10 s**. Over 10 s is a defect against NFR-010; record the figure, the release and the server in the install record |
| 8 | **The first backup and the Admin's restore rehearsal** (NFR-013, DL-035, DL-253) | "Backups" and "Restore a backup" below | A new `.age` file in `C:\Accucut\backups`; the rehearsal finished from this guide alone |
| 9 | **A forgotten password, with e-mail off** (DL-378, FR-004) | Sign in as the Admin, open Users, choose Reset password for a test user (invented, removed afterwards) and set a temporary password. Sign in as that user in a private window | The user is taken to "Set a new password", sets one, and reaches the portal. The old password no longer works |

## After go-live: switching e-mail on (DL-378 (3))

E-mail goes live only after one real send from **this server** on the chosen mailbox. It is not a go-live check. Do it when the delivery lead has chosen the mailbox and Accucut IT has given the mail settings.

| # | Step | How | Pass |
|---|------|-----|------|
| 1 | **Mail settings** | Edit `C:\Accucut\config\.env` as an administrator: `SMTP_AUTH_MODE` (`password` for a cPanel mailbox, `oauth2-client-credentials` for Microsoft 365), `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, and `SMTP_PASSWORD` or the three `SMTP_OAUTH_*` values. Leave `FEATURE_EMAIL` off. Then `Restart-Service AccucutWorker, AccucutApp` | Both services run (`Get-Service AccucutApp, AccucutWorker`) and `http://127.0.0.1:3000/api/health` answers `{"status":"ok"}`. The password is in this file only: never in an e-mail, chat, Jira or GitHub |
| 2 | **The real send** (DL-371 (5) (i) to (v)) | As the Admin, Settings, E-mail alerts: save the sender name and address, then Send test e-mail | The test e-mail arrives in the Admin's inbox (not junk), from the chosen sender. Record the date, who, mode, port, and inbox or junk, with no address or password. This send meets G3 condition 16 |
| 3 | **Switch on** | Set `FEATURE_EMAIL=on` in `C:\Accucut\config\.env`, then `Restart-Service AccucutWorker, AccucutApp` | The newest worker start in `AccucutWorker.*.out.log` shows `outbox-send scheduled every minute`, `overdue-scan scheduled every minute` and `daily-digest scheduled at 11:00 Asia/Kolkata`. The sign-in page shows the "Forgot your password?" link |
| 4 | **First real alert and reset** | Assign a task to a test Engineer whose address the team controls, and ask for one password reset by e-mail for a test user | Both e-mails arrive within a few minutes, and the reset link sets a new password that works |

**To switch off again:** set `FEATURE_EMAIL=off` and restart both services. Nothing new is queued while it is off. Rows already queued wait: an unsent assignment e-mail expires 24 hours after it was written and a reset link 60 minutes after it was asked for, so neither goes out late. Overdue, digest and backup e-mails that were queued but not sent go out when e-mail is switched on again.

## Look and fix

| You want | Do |
|----------|----|
| See the services | `Get-Service AccucutApp, AccucutWorker, postgresql-x64-17` |
| Restart the portal | `Restart-Service AccucutWorker, AccucutApp` |
| Check it is alive | Open `http://127.0.0.1:3000/api/health` on the server: `{"status":"ok"}`. It answers **503** `{"status":"unavailable"}` when the database does not answer **or when the worker has stopped**: the worker writes a heartbeat every minute, and the check turns red when the newest one is 3 minutes old. For a 503, look at `Get-Service AccucutWorker` first, then `AccucutWorker.*.err.log` in the logs folder |
| Read the logs | `C:\Accucut\logs\` (`AccucutApp.*.err.log` first) |
| Start over after a failed install | Drop what is left (`DROP DATABASE accucut; DROP ROLE accucut_restore, accucut_app, accucut_owner, accucut_backup;` in `psql` as `postgres`; and `DROP DATABASE` for any `accucut_new_...`, `accucut_old_...` or `accucut_failed_...` that a restore left), run `C:\Accucut\services\AccucutApp.exe uninstall` and the same for `AccucutWorker`, run `Unregister-ScheduledTask 'Accucut weekly backup' -Confirm:$false`, take `AccucutBackup` out of "Log on as a batch job" (Local Security Policy, Local Policies, User Rights Assignment; do this **before** the next command, or a bare SID stays in the list) and run `Remove-LocalUser AccucutBackup`, delete `C:\Accucut`, run the install again. |
| See the last backups | `Get-ChildItem C:\Accucut\backups` as an administrator, or the "Last backup" line on the portal's Settings page (Admin). |

After a Windows Update reboot both services start by themselves, a minute or so after PostgreSQL (NFR-012).

## Uptime monitor (NFR-012)

The portal should answer **99 % of the time** (NFR-012). The way to know when it does not is an **external monitor**: a free or paid web service that asks the portal's health address every **5 minutes** and tells the IT person when the answer is wrong. It runs outside the server, so it also notices a server that is switched off or cut off from the network, which nothing on the server can report. **Setting it up is a human step for the IT person after go-live and is not a condition for accepting a release** (it needs the web address of the portal, which Accucut IT has not given yet: Q-18).

What to give the monitor:

| Setting | Value |
|---------|-------|
| Type | HTTP(S) monitor (not "ping") |
| Address | The portal's web address followed by `/api/health`, for example `https://quotes.example.test/api/health` (the address is Accucut's; the example is invented). The path needs no sign-in and no value in the request |
| Interval | **5 minutes** |
| Healthy answer | HTTP **200** with the body `{"status":"ok"}`. If the service can look for a word in the answer, the word `ok` is enough |
| Alert when | The answer is anything else, or there is no answer. If the service lets you wait for **2 checks in a row** (10 minutes) before it alerts, do so: one slow reply or a restart for an update then wakes nobody |
| Who receives the alerts | **The IT person who looks after the server** (the one who ran the install), by e-mail. Add a second address, such as the delivery lead's, if Accucut wants a back-up reader. The portal's own e-mail cannot be the alert route: if the portal is down, it cannot send |

**What a 503 means.** The portal answers **503** with `{"status":"unavailable"}` in two cases, and the answer never says which (it reveals nothing about the server to a stranger): the **database** did not answer, or the **worker** has stopped (it writes a heartbeat every minute, and the check turns red when the newest one is 3 minutes old). Alerts that come with no answer at all (a timeout, no connection) mean the server, the network or the reverse proxy is down, or the web address is wrong. For any of these:

1. On the server, run `Get-Service AccucutApp, AccucutWorker, postgresql-x64-17`. Start what is stopped (`Start-Service`), PostgreSQL first.
2. If a service keeps stopping, read `AccucutApp.*.err.log` and `AccucutWorker.*.err.log` in `C:\Accucut\logs\` (the "Look and fix" table above says where to begin).
3. Open `http://127.0.0.1:3000/api/health` on the server. `200` with `{"status":"ok"}` there but an alert from outside means the fault is between the monitor and the server: the reverse proxy, the certificate, the firewall or DNS.

An update and a restart take the portal down for under a minute (see "Update"); that is why waiting for two checks is worth setting.

**Which service, and the plan terms (architecture A-02).** The service chosen at the design review is **UptimeRobot**. Sources disagree on whether its **free plan allows business use**, so **Accucut IT must read the current terms** before relying on it, or buy the paid plan. Any external HTTP monitor with a **5-minute** interval meets NFR-012, so the choice is easy to change: use another service if the terms do not suit. Whatever is chosen, **read the monitor's own report once a month** and note the percentage: 99 % is about 7 hours of downtime in a month.

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

It means the disk has less than 20 % free and the portal may stop if nothing is done. The Admin clears the oldest copies with one command. Sign in to the server (Remote Desktop) with your own Windows account, open **Windows PowerShell as administrator** (right-click it, choose **Run as administrator**, and say Yes when Windows asks) and run:

```powershell
cd C:\Accucut\current
.\clear-copies.ps1
```

1. It lists the copies **oldest first** with date, kind and size, and the free space. The **newest 4 copies are always kept** and are marked KEEP.
2. It asks you to **type the date** (`YYYY-MM-DD`, as listed, in UTC) of the **newest** copy to remove. Every older copy goes with it, oldest first. If what you
   type is not the date of a copy that may be removed, **nothing is removed**.
3. It tells you how many copies go and how much space that frees, and asks you to type **YES**. Anything else stops it.
4. It removes each copy with its manifest, and nothing else (it deletes only files that it can prove are the backup's own: the exact name, a regular file directly
   in the folder, a manifest that agrees), and writes one `job_runs` row (`backup-clear`: how many, which dates, the free space after).

**A copy that is removed cannot be restored.** If only the newest 4 are left and the disk is still too full, the script says so: the disk is too small for the data.
Call your IT person.

## Restore a backup (STORY-10.11)

**Who this is for.** The Admin, who is **not** a system administrator, with the IT person on hand but not helping. Your Windows account on the server is an administrator account (your IT person sets it up), but you need no Windows Server, PostgreSQL or PowerShell knowledge: you open one window, type two lines, answer four questions in plain words, and read what it says.

**When to use it.** After a bad update, or when data in the portal has been damaged and cannot be put right inside the portal. A restore puts the whole portal back to
the day of a backup copy. **Everything entered after that day is lost: every estimate, every approval, every master value, and the audit rows too.** A copy is made once a
week, so a restore from the last good copy loses up to 7 days of work (14 if a weekly run failed without anyone noticing). If only one thing was changed by mistake, the record
often survives inside the portal: ask first.

**What you need before you start.**

1. **Your own Windows account on the server, in the Administrators group.** Your IT person sets it up. Never use a shared account: the server records who ran each restore.
2. **The backup key**: the one line that starts with `AGE-SECRET-`, from the place where you keep it (never on this server). **Without it no backup can be read.**
3. **Your IT person**, on hand. They are not there to help you type; they are there if the command stops.
4. **A quiet time.** The portal is stopped while it restores, usually for a few minutes (longer for a big database). Tell the people who use it. Do not start a restore while an update or another restore is running, or while your IT person is working on the portal: one at a time. **Close every program that is connected to the portal's database as a PostgreSQL administrator** (pgAdmin, or `psql` as `postgres`): the restore cannot end such a connection, so it stops, with nothing changed, if one is open.

### How to do it

1. **Sign in to the server with your own Windows account** (Remote Desktop, as your IT person set up for you).
2. **Open Windows PowerShell as administrator.** Click Start, type `PowerShell`, right-click **Windows PowerShell** (the blue one, not PowerShell 7) and choose **Run as administrator**. Say **Yes** when Windows asks. The window's title starts with **Administrator:**. If it does not, close it and do this step again.
3. **Type these two lines, pressing Enter after each:**

   ```powershell
   cd C:\Accucut\current
   .\restore.ps1
   ```

   It takes no arguments. If `cd` says that access is denied or that the path does not exist, the window was not opened as administrator: close it and go back to step 2.
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
| `Access to the path ... is denied`, or `Cannot find path 'C:\Accucut\current'` | The window was not opened with **Run as administrator**. | Nothing was changed. Close the window and open Windows PowerShell as administrator (step 2). |
| `does not match the checksum in its manifest` | That copy has been changed or damaged. | Nothing was changed; the portal is running as before. Choose another copy with your IT person. |
| `can be restored only into the same or a newer PostgreSQL` | The copy was made by a newer PostgreSQL than this server has. | Nothing was changed. |
| `not enough free disk space for a restore` | A restore needs room for a safety copy and the new database. | Nothing was changed. Clear old copies (see "Disk nearly full") or ask IT for a bigger disk. |
| `not the date of the copy` | You typed a different date. | Nothing was changed. Run the command again and type the date exactly as shown. |
| `does not open the copy` | The key is not the one that belongs to this server's backups. | Nothing was changed. Find the right key (two copies are kept apart). |
| `made by a newer release of the portal than the one installed` | The copy has applied a database change that the installed release does not know (it was made after a newer release was installed). A copy from an **older** release is fine: it is brought up to date as part of the restore. | The restore stops before the swap; the portal is running on the old database. Ask your IT person to install that release, then run the restore again. |
| `Someone is connected to the portal's database as a PostgreSQL administrator` | pgAdmin, or `psql` as `postgres`, has the portal's database open. The restore's own database role is not a PostgreSQL administrator, so it cannot end that connection. It looks for one before it stops the portal, and again just before the swap. | Close that connection and run the restore again. Said before the portal is stopped: nothing was changed. Said later (inside "The restore of ... failed"): the portal is running on the old database, and a safety copy was made. If an administrator connection was on the **new** database, that database cannot be dropped either: `restore.log` then names an `accucut_new_...` database for your IT person to drop. |
| `Another connection to the database could not be ended` | A connection to the portal's database stayed open through four tries (about 20 seconds), although the restore ended every connection it may end. | The database names were not swapped; the portal is running on the old database. Close the connection and run the restore again. |
| `The group AccucutAdminRunAs has members` | A group of that name was made on this server by hand. This version of the portal does not use it. | Nothing was changed. Ask your IT person to delete the group (`Remove-LocalGroup AccucutAdminRunAs`, as administrator). |
| `The restore of ... failed ... The portal is running on the old database` | Something failed after the portal was stopped. The old database was put back and the portal started again. | The portal is running as before the restore. The safety copy is in the backups folder. |
| `... may not be running: look at the services first` | A step failed and the old database could not be put back, or the portal could not be started. | **The portal may be down.** Tell your IT person at once. |

**Where it is recorded.** Every restore, good or not, is written to `C:\Accucut\logs\restore.log` and as one event in the Windows Application log, source `Accucut`
(1100 done, 1101 stopped by the Admin, 1110 a check failed and nothing was done, 1111 it failed and the portal runs on the old database, 1112 it failed and the old database could not be put
back). That record is **outside the database**, because restoring an older copy rolls the database's own audit rows back. Look at it with
`Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Accucut' }`. The first line of each restore in `restore.log`, and each event, names the Windows account that ran it. When a connection is in the way of the swap, `restore.log` names its database and its database role (and its type, when PostgreSQL shows it to the restore role), never what it ran.

**The key.** You paste it at a secure prompt. It goes to `age` on standard input only. It is never written to a disk, a log, a transcript or the temp folder, and it is blanked from every message.

### For the IT person: the Admin's account (full administrator)

The Admin runs the restore and the clearing as **a local administrator**. Give the Admin **a Windows account of their own**, add it to the local **Administrators** group, and allow it to sign in by Remote Desktop. Do not let them use a shared or the built-in Administrator account: the Windows Security log and the restore's own record (`restore.log` and the Application events) name the account, and that is the only record of who did it.

**What this means (accepted by Accucut's delivery lead on 2026-11-24).** An administrator account can do anything on this server: read `.env`, `migrate.env` and the password files in `C:\Accucut\config`, use the database directly, change the audit records and delete the backups. Nothing in the portal or in these scripts can limit it. A limited account was designed (a JEA endpoint), but it failed its check on a test server that is not in a Windows domain, so it is not part of this release (architecture A-35, RISK-018). Keep the number of administrator accounts small, keep the backup key away from the server, and keep the off-server copy (see "Backups"): an administrator can delete the copies on this server.

**A restore needs a database role of its own.** The install makes `accucut_restore` (CREATEDB, acts as the owner, **not** a superuser) with its password only in `config\restore.pgpass`. Before `restore.ps1` uses that file, it checks that only Administrators and SYSTEM can read it, and it stops if anyone else can.

**Hand-over of the Admin's role.** The portal cannot do this for you. (1) Pass the **backup key** to the new Admin, and keep two copies apart. (2) Create the new Admin's own account and add it to Administrators. (3) Remove the old Admin's account from Administrators and disable it.

**Before go-live the Admin does one restore rehearsal**, from this chapter alone, timed, with you on hand and not helping unless it stops (NFR-013, DL-035). Do it on the staging copy, with a copy made on
staging. A restore from the oldest copy once a year is recommended: a 2-year copy is worth only what can still be read.

**Not covered here:** an off-server copy (yours to set up, see "Backups") and the timed walk-through of NFR-030.

## If the Admin forgets their password

E-mail is off at go-live, so the Admin cannot use a reset link, and nobody else can reset the Admin. A server administrator can set a temporary password for the one Admin, on the server:

1. Sign in to the server with your own Windows account (a member of Administrators) and open **Windows PowerShell** with **Run as administrator**.
2. Run these four lines:
   ```
   $node = (Select-Xml -Path C:\Accucut\services\AccucutApp.xml -XPath '/service/executable').Node.InnerText
   cd C:\Accucut\current\app
   $env:NODE_ENV = 'production'
   & $node --env-file=C:\Accucut\config\.env bootstrap-admin.mjs --reset-admin-password
   ```
3. Check the name and e-mail it shows, type `RESET`, then type a temporary password twice (10 to 128 characters, with a number and a symbol; nothing shows as you type).
4. Give the Admin the temporary password in person or by phone, never by e-mail or chat. At their next sign-in they must choose their own. Every session they had has ended.

The portal's audit log records it as "System: server command" with your Windows account name. The command never runs from the web, never reactivates a deactivated Admin, and changes nothing if it stops.

**Note the date and your Windows account in the server's operations record.** The Windows name in the audit entry comes from the process that ran the command and is not proof of who it was; your own note, and the server's Windows Security log if process auditing is on, are (DL-381 (3)(b)). Never write the temporary password in chat, Jira, GitHub or the record: it is shared with the Admin only, in person or by phone.

| Exit code | Meaning |
|---|---|
| 0 | Done |
| 1 | `.env` was read, but `DATABASE_URL` or `AUTH_SECRET` is missing or invalid, or the database cannot be reached: check `Get-Service postgresql-x64-17` |
| 2 | Not exactly one active Admin, or "The Admin account changed while this ran. Nothing was changed. Run it again.": nothing was changed |
| 3 | The password was refused (empty, the two entries differ, or the rule): run it again |
| 4 | Stopped: not an interactive window, an unknown argument, `RESET` not typed, or Ctrl+C |

A window that is not elevated never reaches the command, and nothing changes: PowerShell is refused access to `C:\Accucut` (the first two lines fail with "Access is denied") and then cannot run `& $node`, so Node never starts and there is no exit code from the command. Exit code 9 (`.env` not found) appears only if Node is started by hand, by its full path, from such a window. Open Windows PowerShell with Run as administrator.

## The shared module (`AccucutOps.psm1`)

STORY-10.05 (backup) and STORY-10.11 (restore) import this module and add their own functions to it. The module is loaded only **after** it has passed
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
| The restore (`restore.ps1`) | `Invoke-AccucutRestore` (the whole guided restore), `Invoke-AccucutRestorePipe` (`age -d` to `pg_restore`, as bytes, both exit codes checked), `Test-AccucutBackupKey`, `Test-AccucutRestoreVersion`, `Test-AccucutRestoreRoom`, `New-AccucutRestoreDatabase`, `Switch-AccucutRestoreDatabase` (the swap: it ends only the sessions of roles that are not superusers, and tries a rename again, at most 3 times, only when PostgreSQL answers SQLSTATE 55006), `Get-AccucutRestoreSession`, `Assert-AccucutRestoreNoSuperuserSession` (the plain refusal when a PostgreSQL administrator is connected), `Remove-AccucutRestoreDatabase`, `Add-AccucutRestoreLogLine` (restore.log), `Write-AccucutRestoreEvent`, `Read-AccucutKeyInput` (the secure prompt), `Write-AccucutRestoreConfig` (`restore.pgpass`), `Get-AccucutRunningAccount` (the account named in the record), `Get-AccucutAdminGroupSid` (inert: ADR-015 Amendment 3.4) |

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
and migrations, with only the two prompts mocked; its R3 case, a copy one migration behind, runs 5 times in the job). DEF-087 (AQP-443): on stage 13 the swap is also run on scratch databases that have a live autovacuum worker, or a session of another role, or a held `postgres` session (a plain refusal, both names as they were), and the restore refuses plainly with a held `postgres` session on the live database. Stage 13 also runs the installed `restore.ps1` as an administrator up to the copy list (Enter stops it, nothing is changed, the event names the account), and checks that the install made no JEA endpoint, group, shortcut or `jea` folder.
Not tested in CI: a full restore through `restore.ps1` with a pasted key (the Admin's rehearsal, NFR-013), the timed walk-through of NFR-030 and a real Windows Update reboot (all by hand).
