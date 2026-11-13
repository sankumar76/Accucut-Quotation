# ADR-015: Native Windows services on one Windows Server

| Field | Value |
|-------|-------|
| Status | **Accepted (solution-architect ruling, 2026-11-13, fast track, CLAUDE.md section 9), for `master` to log.** It **supersedes ADR-002 for the runtime and the install model** (Docker Compose, the `migrate` container, the Caddy profile, `restore.sh` and `clear-copies.sh`). ADR-002's other decisions stand: one host, backups on the same server, the Admin holds the key and runs the restore, 2 years "as the disk allows". **Rests on assumptions A-01 (restated), A-35 (restated for Windows), A-39 and A-40** |
| Date | 2026-11-13 |
| Deciders | solution-architect; the delivery lead's stated target (AQP-1 comment 11790, relayed); Accucut IT confirms at install |
| Related | FR-091, FR-105; NFR-003, 012, 013, 024, 030; ADR-001, ADR-002, ADR-011; OQ-ARCH-02, OQ-ARCH-03, OQ-ARCH-14; STORY-10.04, 10.05, 10.11, 02.09; architecture section 9.9; test strategy section 10.8 |

## Context

The delivery lead stated on 2026-11-13: "build 10.04, 10.05 and 10.11 now, against the assumption that the target is a **Windows Server with a 40 GB disk**". This replaces assumption A-01 (one Linux VM with Docker). The limited Admin account (A-35) stays an assumption. Nothing in the deployment has been built yet: `compose.dev.yml` is for local development only, CI stage 13 (image) is disabled, and there is no `Dockerfile`, production Compose file or script. So the switch costs no written code.

The application itself is portable: Node 22, Next.js `output: 'standalone'`, Prisma 7 with the `pg` driver adapter (no engine binary), `@node-rs/argon2` (prebuilt Windows x64 binary), `node-cron` in the worker (ADR-011).

## Decision Drivers

- The least operational risk for a small IT team with no platform engineer (the brief).
- NFR-013 and FR-091: a weekly encrypted backup, a guided restore and a guided clear, run by an Admin who is not a system administrator; **40 GB** (OQ-ARCH-03, DL-034).
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
  - **Windows itself takes about 20 GB more of the 40 GB than a Linux host did, so the retention ceiling falls from about 5 to 6 GB of data to about 1.5 GB** (architecture 9.9, ARCH-R10). 2 years of weekly copies does not fit unless the data stays under about 0.07 GB. Their decision on the disk stands; OQ-ARCH-14 asks whether a second volume or a larger disk is wanted.
  - Runtime parity with CI is lost; stage 13 on Windows is the mitigation.
  - Manual runtime updates (Node, PostgreSQL minor versions) are now the IT person's, through `update.ps1`.
- Follow-up actions (with owners):
  - developer: STORY-10.04, 10.05 and 10.11 as restated in architecture 9.9.
  - product-manager: restate FR-091 and NFR-030 ("`docker compose up`" becomes "`install.ps1` from the release zip").
  - product-owner and scrum-master: restate the three EPIC-10 rows and STORY-02.09.
  - master: log the decision; ARCH-R9 and ARCH-R10 to the register.
  - Accucut IT: confirm the Windows version, OQ-ARCH-14, and whether the JEA account suits them (A-35).

## Verification

- Stage 13 on `windows-latest` (test strategy 10.8): install from the zip on a clean runner, the services start, `/api/health` returns 200 and the sign-in page loads; a backup, a clear and a restore succeed, and the restore's failure paths are tested.
- NFR-030: a timed walk-through on a clean Windows Server 2022 VM by someone who did not write the README.
- NFR-013: the Admin's restore rehearsal on staging (a Windows VM), from the README alone, through the JEA endpoint.
- Review this decision if Accucut's server turns out to be Linux, or if Microsoft makes a supported Linux-container runtime for Windows Server generally available.
