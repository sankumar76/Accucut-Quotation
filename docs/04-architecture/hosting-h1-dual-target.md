# Hosting release H1: dual-target sizing and pre-freeze assessment

| Field | Value |
|-------|-------|
| Version | 0.2 (2026-11-23; 0.2 adds the delivery lead's entry criterion and gives H1 as a duration from its start, not a date) |
| Owner | solution-architect |
| Status | Sizing for the delivery lead's scheduling (OQ-PM-16 (a)). It does not change G8. **H1 starts only after the customer's full sign-off of Release 1 on the Windows Server (ADR-021 entry criterion); until then H1 is design only** |
| Decision it sizes | DL-350, AQP-1 comment 12971: G8 on Accucut's Windows Server (ADR-015), unchanged. After G8, Hosting release H1 adds a managed web host with a separate managed PostgreSQL. One codebase, two set-ups. Every fix lands in both. Data moves by export and import |
| Companions | [ADR-021](adr/ADR-021-deployment-targets.md) (deployment targets), [data-move.md](data-move.md) (moving data between the targets), PRD 6.5 (H1-N1 to H1-N6), RISK-036 |
| Code read | `origin/master` b85b2aa9: `src/server/http/file-response.ts`, `src/server/export/thread-runner.ts`, `src/server/auth/client-address.ts`, `src/app/api/health/route.ts`, `src/server/repositories/prisma-client.ts`, `deploy/db/create-roles.psql`, `deploy/windows/backup.ps1`, `restore.ps1`, `prisma/migrations/**`, `.github/workflows/windows-package.yml` |

**How this differs from the earlier sizing.** The earlier sizing (2026-11-23, session scratchpad only) treated the web host as a **replacement** for the Windows target: about 19 developer-days (12 to 29), H1 about 17 Dec. It retired the Windows package, JEA and `backup.ps1`. That basis no longer applies. H1 now **adds** a target, and the Windows target stays fully supported (H1-N5). Vendor facts below come from that sizing (vendors' pages, read 2026-11-23) and were not re-read today.

---

## 1. The answer in six lines

1. **Effort: about 22.5 developer-days central (range 14 to 35).** The replacement sizing was 19 (12 to 29). Keeping both targets adds about **3.5 days**. The extra work is the target switch, the data-move tooling with two rehearsals, a second CI package workflow, and a regression on both targets.
2. **Duration, counted from H1's start (not a calendar date):**
   - With **3 developer lanes**, about **11 calendar days** (range 7 to 15).
   - With **2 lanes**, about **15 days** (range 8 to 20).

   **Entry criterion (the delivery lead, 2026-11-23; ADR-021):** H1 starts only after the customer has fully signed off Release 1 on Accucut's Windows Server, which comes after the G8 sign-off and the install. Until then, H1 work is design only: this sizing, ADR-021 and the data move. The switch of targets comes after the H1 release decision and is the delivery lead's call. It needs about half a day of work and 1 to 2 hours with the portal closed ([data-move.md](data-move.md)).
3. **One codebase.** One setting, `DEPLOY_TARGET`, chooses `accucut-server` (the default, today's behaviour) or `web-host`. All differences go through one target profile. No code checks for a provider.
4. **CI covers both targets without slowing the required check.** The per-target unit tests run inside the existing `Stages 1 to 11` (seconds). A new **Web host package** workflow mirrors `windows-package.yml`: path-filtered on PRs, on every `master` push, and nightly. It is not required at first. All CI work is post-G8 (CLAUDE.md section 9 item 4).
5. **Pre-freeze (a separate G8 question for master, not H1 work): only the streamed Excel export is eligible, and even that one is optional.** It meets H-a to H-d by design. It can land only if a lane is idle, which settles H-e and H-f. The other three fixes wait for H1 (section 7).
6. **Security (RISK-036)** is owned by ADR-021's security section. H1 gets its own combined security review and a regression on both targets before it ships.

---

## 2. What "one codebase, two set-ups" means in the code

| Concern | `accucut-server` (G8, ADR-015) | `web-host` (H1) | How it is selected |
|---------|-------------------------------|-----------------|--------------------|
| Artefact | `accucut-<tag>-win-x64.zip` (unchanged) | One Linux container image (OCI), built in CI from the same commit. A function host such as Vercel builds from source with one `vercel.json` | Build pipeline per target; same commit, same `npm run build` |
| Jobs (ADR-011) | `AccucutWorker` service runs node-cron (unchanged) | `POST /api/internal/jobs/<name>`, which checks a `JOBS_SECRET` bearer token in constant time and is called by any scheduler. The same `worker` process is allowed on a container host that keeps a process alive | Profile `jobs: 'worker' \| 'http'`. The job endpoints answer 404 on `accucut-server`, so Windows gains no attack surface |
| Job set | Adds `log-prune` (log files on disk) | No `log-prune`; logs go to the host | Profile |
| Storage line (FR-105) | `fs.statfs`, "Disk nearly full" below 20 % free | `pg_database_size` against `DB_SIZE_LIMIT_GB`, below 20 % headroom | Profile `storageCheck: 'disk' \| 'database'` |
| Client address (throttle) | `CLIENT_ADDRESS_SOURCE` unset means `forwarded-last`, today's rule | Must be set explicitly (`forwarded-hops:<n>` or `header:<name>`). Start-up refuses a missing value | Setting, validated in `env.ts` per profile |
| Database pool | Constants per process kind, as today (R4, PRF-01, STD-15) | Constants per (target, kind): app 3, worker 2, script 2 (proposed) | Profile. Still constants, not free settings, so R4 holds |
| Timeouts | Start-up parameters, as today | The same, through a direct connection or a session-mode pooler. Role defaults are used only if a transaction-mode pooler cannot be avoided (section 6, fix 4) | Profile `pooler: 'none' \| 'session' \| 'transaction'` |
| Migrations | Step in `install.ps1` and `update.ps1` (unchanged, DL-317 target check) | A release job in a protected GitHub environment, before traffic moves | Pipeline per target |
| Backups | `backup.ps1`, same disk, `age`, manifest (unchanged) | Provider daily backups, plus a weekly `pg_dump -Fc \| age` copy in an S3-compatible bucket, **in the same format and manifest as Windows** | Profile and job set |
| Restore | `restore.ps1` through JEA (unchanged, AC-8) | Runbook: the provider's restore, or `age` copy into a new database | Runbook per target |
| Export | One code path: a streamed body (fix 1) | Same | None. The behaviour is the same on both |

**The rule that keeps them one codebase:** `DEPLOY_TARGET` is read once, in `src/lib/env.ts`. A proposed `src/server/config/target-profile.ts` turns it into a typed profile. The composition root hands the profile to whatever needs it. Nothing else reads the variable, and no code tests for `VERCEL`, `RAILWAY_*` or any provider variable. A source-scan unit test enforces this (ADR-021 rule PI-8).

---

## 3. Per-target treatment of the named requirements

The Windows column is the G8 text, unchanged. The web-host column is the design that answers PRD 6.5's "to be detailed". Product wording stays with the product-manager.

| ID | On `accucut-server` (Windows) | On `web-host` | Holds? |
|----|-------------------------------|---------------|--------|
| **FR-091** Install and update | `install.ps1` and `update.ps1` from the release zip; services; settings file; README; the Admin restores through JEA | **Deploy** by a GitHub deploy workflow in a protected environment, with the delivery lead as required reviewer: build the image, run `migrate deploy` and `ensure-seed-version` as a release job, then move traffic. **Update** means a new image tag. **Rollback** means the previous tag (expand-then-contract, section 9.7). `bootstrap-admin` and `import-masters` get a runbook. The person deploying is the delivery lead or Accucut IT, never a portal role | Yes, restated per target |
| **FR-105** Backup lines on Settings | Last good weekly backup; "Backup late" after 8 days; "Disk nearly full" below 20 % free | **Line 1** comes from the weekly neutral copy's `job_runs` row, the same source as on Windows. **Line 2** is "Backup late" after 8 days, unchanged. **Line 3** is "Database near plan size" from `pg_database_size` against `DB_SIZE_LIMIT_GB`, below 20 % headroom. The provider's own daily backups are not shown: the portal cannot read them through a neutral interface | Yes. Line 3's words are for the product-manager and ux-expert |
| **NFR-013** Backup and recovery | Weekly, same disk, `age`, kept up to 2 years as the disk allows; RPO 7 days; the Admin restores through JEA; **a server or disk loss loses everything** (RISK-011) | **RPO about 1 day** from the provider's daily backups (kept about 7 days on entry plans). Weekly `age` copies go **off the provider**, to an S3-compatible bucket, kept 2 years by a lifecycle rule. So a provider loss costs at most 7 days. **Restore:** the provider's console (account owner), or an `age` copy into a new database. The private key stays with the Admin and is used only on an operator machine. RTO about 4 h by runbook (estimate, timed in the H1 rehearsal). Who restores is open (OQ-PM-16, PRD H1-N3) | Better on the web host. Windows unchanged |
| **NFR-024** Observability | pino JSON to daily log files, kept 30 days, pruned by `log-prune` | The same pino JSON to stdout, with the same redaction. 30 days needs the host's longer log plan or a log drain to a neutral sink (about $0 to $10 a month). `/api/health` and the 3-minute heartbeat rule are unchanged, and the uptime monitor points at the web address | Yes. One paid setting per host |
| **NFR-030** Deployability | One `install.ps1` run on a clean Windows Server reaches sign-in in 30 minutes or less | "From a release to a working sign-in page on a new web host in 30 minutes or less, following `deploy/web-host/README.md`." That covers creating the database, running the role SQL, setting the secrets, deploying the image, the release job and `bootstrap-admin`. It is timed in the H1 rehearsal | Yes, restated |
| NFR-012 Availability | 99.0 %; one host is a single point of failure | 99.0 % with margin, on the provider's platform; the same 5-minute monitor | Yes |
| NFR-002, NFR-006, NFR-007 (cost confidentiality, throttle, secrets) | Unchanged | Unchanged in code. **Added**: the database's own API off and no grants to foreign roles; an explicit client-address source; secrets in the host's store (ADR-021 security section) | Yes, with the RISK-036 controls |
| FR-081 to FR-084, NFR-014, NFR-015 (mail and jobs) | node-cron in IST | HTTP jobs; scheduler entries in UTC (11:00 IST is 05:30 UTC); IST logic stays in code; jobs are idempotent, so a repeated or missed call is safe | Yes |
| AC-8 (JEA restore proof) | Unchanged | Not applicable: there is no Windows endpoint. The web-host restore runbook takes its place | Windows only |

---

## 4. Effort (developer-days, low / central / high)

Includes the tests each change needs under CLAUDE.md section 9 (test-first, fully green CI). "Row" refers to the earlier replacement sizing where it applies.

| # | Item | Change from the replacement sizing | L / C / H |
|---|------|------------------------------------|-----------|
| 1 | Architecture: ADR-021 (written today, no code), the per-target split of sections 9.1 to 9.9, amendments to ADR-011, 012 and 017, test strategy 10.x | ADR-002 and ADR-015 are **not** superseded; sections are split, not rewritten | 0.75 / 1 / 1.5 |
| 2 | Product restatements per target (product-manager, ux-expert): FR-091, FR-105, NFR-013, 024, 030 | Two columns instead of a rewrite | 0.5 / 0.75 / 1 |
| 3 | **New: target switch.** `DEPLOY_TARGET` in `env.ts` with per-target required and forbidden settings; `target-profile.ts`; a source-scan test (PI-8); tests that each profile is complete | New | 0.5 / 0.75 / 1 |
| 4 | Web-host artefact: multi-stage `Dockerfile` (standalone server, `.next/export-worker.mjs`, Prisma client, Linux `@node-rs/argon2`); optional `deploy/web-host/vercel.json` | Same. The Windows zip is kept | 0.5 / 1 / 1.5 |
| 5 | Jobs: HTTP job endpoints (404 on Windows); the job set per target; `backup-watch` storage check per profile | +0.25 for the per-target job set | 1.5 / 2.25 / 3.25 |
| 6 | Export: streamed body (fix 1); explicit thread-bundle path (file tracing on a function host); `EXPORT_TIMEOUT_SECONDS` capped per target | Same; −0.5 if fix 1 lands before the freeze | 0.75 / 1.25 / 2 |
| 7 | Database: pool per (target, kind); pooler mode; role SQL on a managed database with no superuser (`ALTER SCHEMA public OWNER` may be refused there, so grant `CREATE` instead); the database API off and a "no foreign grants" check (fix 3); timeouts only if a transaction-mode pooler is unavoidable (fix 4) | +0.25: app and worker share role `accucut_app` with different timeouts, so role defaults alone cannot carry both | 1 / 1.75 / 2.75 |
| 8 | Migrations as a release job on the web host (Windows unchanged) | Same | 0.5 / 1 / 1.5 |
| 9 | Client-address source (fix 2) with Windows default unchanged; health route `X-Client-Address-Seen` and check C5 per target | +0.25 for two tested modes | 0.5 / 0.75 / 1.25 |
| 10 | Web-host backups: provider daily backups plus the weekly neutral copy, in Windows' format and manifest, to an S3-compatible bucket | Same. `backup.ps1` is kept | 1.5 / 2 / 3 |
| 11 | Web-host restore runbook and one timed rehearsal (Windows `restore.ps1` and JEA unchanged) | Same | 0.5 / 1 / 1.5 |
| 12 | **New: data move** ([data-move.md](data-move.md)): a small Node script, `scripts/data-move.ts`, shipped in both artefacts, that writes and checks the move manifest; two rehearsals (Windows to web, web to Windows) | New | 1 / 1.5 / 2.5 |
| 13 | Observability per target (log sink, uptime monitor) | Same | 0.25 / 0.5 / 1 |
| 14 | Mail from the web host (Microsoft 365 OAuth over 587; mail API fallback) | Same | 0.25 / 0.5 / 1 |
| 15 | **CI for both targets** (section 5): per-target unit tests; the Web host package workflow; the nightly web-host E2E; `windows-package.yml` kept | Windows CI is kept, not retired | 1 / 1.5 / 2.5 |
| 16 | Environments: web staging and production (two databases, secrets, domain, TLS) | Same | 0.5 / 1 / 1.5 |
| 17 | **H1 security review** (RISK-036, CLAUDE.md section 9 item 2) and its fixes | +0.25 for two targets | 0.75 / 1.25 / 2 |
| 18 | Proof on the web target: NFR-008, 010, 011 load; NFR-009 Lighthouse; export AC-2 at 500 parts with pictures; argon2id timing | Same | 1 / 1.5 / 2 |
| 19 | **New: regression on both targets.** The full E2E against the web staging; on the Windows staging VM, `update.ps1` from the G8 release to the H1 release, then a backup and a JEA restore rehearsal | New | 0.75 / 1.25 / 2 |
| | **Total** | | **14 / 22.5 / 34.75** |

Rounded: **about 22.5 developer-days (14 to 35).** If fix 1 lands before the freeze, the central figure is about 22.

**What stays untouched:** the formula engine, role projection, immutable records, audit design, Auth.js sessions, security headers, the 768 KB request cap, images in PostgreSQL (ADR-013), every screen, and every Windows script, workflow and test.

---

## 5. CI for both targets (post-G8; CI-speed and tooling changes are frozen until G8, CLAUDE.md section 9 item 4)

| Job | Where | Runs on | Required? | Wall time (estimate) | Runner minutes |
|-----|-------|---------|-----------|----------------------|----------------|
| Per-target unit tests: profile completeness for both values; client-address modes; job endpoint secret and 404 on Windows; streamed body identity | Inside `Stages 1 to 11` (Vitest) | ubuntu | Yes (the existing check, name unchanged) | + under 10 s | ~0 |
| **Web host package** (new `web-host-package.yml`): build the image; start PostgreSQL 17 behind PgBouncer in **transaction** mode (the hardest pooler case); run the release job; start the container with `DEPLOY_TARGET=web-host`; smoke `/api/health`, sign-in, an export over 4.5 MB through the streamed path, a job endpoint with and without the secret | Own workflow, same triggers as `windows-package.yml`: PRs touching `deploy/**`, `Dockerfile`, `prisma/**`, `package*.json`, `next.config.ts`, `src/worker/**`, `src/app/api/health/**`, `src/app/api/internal/**`, `src/server/config/**`, `src/server/http/file-response.ts`, `src/server/auth/client-address.ts`, `.env.example`; every `master` push; nightly | ubuntu-latest | No at first. Master may make it required once it is stable for 2 weeks | 10 to 12 min, parallel to the required check | ~12 per run |
| `windows-package.yml` (stage 13) | Unchanged | windows-latest | Unchanged | ~18 min (measured 23 Nov: 17:43, 18:07, 18:37) | Unchanged |
| **Nightly web-host E2E**: the Playwright suite at three widths against the web-host container behind the pooler | `nightly.yml`, new job | ubuntu-latest | No (report; failures raise a defect) | 25 to 30 min | ~30 a night |

- **The required check does not get slower.** Only seconds of unit tests are added to it. The two package workflows run beside it and are not in branch protection.
- **Cost:** at about 10 path-matching PR runs and 5 `master` pushes a day, plus nightly, about **200 extra runner minutes a day** (estimate). Standard GitHub-hosted runners are free for a public repository, so the cost is concurrency, not money. Many runs at once could queue a required job behind them. The `concurrency` group cancels superseded PR runs, as `windows-package.yml` does.
- **Merge rule for H1 PRs** (orchestrator): both package workflows must be green when they ran on the PR. A target-specific change must pass the other target's package workflow too (H1-N2, "every fix lands in both").

---

## 6. The four code fixes, as target-neutral changes

| # | Fix | Target-neutral form | Windows effect |
|---|-----|---------------------|----------------|
| 1 | **Stream the Excel export** (Vercel refuses a buffered response over 4.5 MB; 500 parts with pictures is about 97.5 MB) | In `fileResponse`, the body becomes a `ReadableStream` that enqueues `subarray` views of the built bytes in 1 MiB chunks (no copy). `Content-Length` and every header stay as they are. One code path for both targets and both file routes (export and part pictures). Unknown until the H1 spike: whether a function host counts a stream that has `Content-Length` as streamed. If it does not, H1 drops `Content-Length` on both targets and re-runs the Windows regression | None: same bytes, same headers |
| 2 | **Configurable client-address source** | `CLIENT_ADDRESS_SOURCE`: `forwarded-last` (default, today's rule), `forwarded-hops:<n>` (the entry n from the end, for hosts that append their own addresses), or `header:<name>` (a platform header that holds the client address). Same rules: a well-formed IP or nothing. The web-host profile has **no default**, so a missing value stops start-up. The health route reports the address seen under the configured rule (check C5 per target) | None by default |
| 3 | **Supabase Data API off** | **Not a code change.** It is a provider setting plus a neutral check: a SQL query, run in the go-live list and in the data-move check, that **no role outside `accucut_owner`, `accucut_app` and `accucut_backup` holds a privilege on any table in `public`**. It passes trivially on Windows. A `REVOKE … FROM anon` migration is rejected: those roles do not exist on Windows, so the migration would fail there | None |
| 4 | **Database timeouts in database settings** | **First choice: no code change.** On a container host, use a direct connection; on a serverless host, use the provider's session-mode pooler. Both keep start-up parameters. **Only if a transaction-mode pooler is unavoidable:** `ALTER ROLE accucut_app SET statement_timeout = '10s', idle_in_transaction_session_timeout = '30s'` in `create-roles.psql`, the same values as today, on both targets. The worker's longer 30 s goes in `SET LOCAL` inside its job transactions, because app and worker share the role. Start-up parameters are left out only when the profile says `pooler: 'transaction'` | None in the first choice. In the fallback, the role SQL changes, so it also needs the Windows `install.ps1` and Pester tests |

---

## 7. Pre-freeze assessment (freeze about 3 Dec), against DL-350 (3) H-a to H-f

This is a **G8 question for master**, separate from H1. A fix that lands before the freeze is a G8 change made under H-a to H-f; it is not H1 work, and it does not start H1. Master rules on each candidate when it is proposed. These are the architect's readings.

| Fix | Size | H-a Windows unchanged, default = today, shown by a test | H-b small, tested, no dependency | H-c combined review (CLAUDE.md section 9 item 2) | H-d first-load and watched E2E | H-e merges before the freeze, takes no CR-01 or G8-blocker lane | H-f final regression on a head with it | **Recommendation** |
|-----|------|------|------|------|------|------|------|------|
| **1. Streamed export** | About 0.5 day: about 20 lines in `file-response.ts` plus a unit test | **Meets.** No setting; the test asserts identical bytes and headers, `Content-Length` included, for both file routes | **Meets.** One function; Web Streams are built into Node 22 | **Needed and feasible.** The export carries cost data (NFR-002). It is a small review: the Engineer refusal in `withRoute` and the download log record (written before the bytes leave) are untouched | **Meets.** Server-only; no client JavaScript; `export.spec.ts` and the watched or observer cases are not edited | **Only if a lane is idle** after the CR-01 stories and the G8-blocker fixes are assigned. **Latest merge 1 Dec**, so the final review and regression see it | **Meets** if merged by 1 Dec | **Eligible, optional.** Land it only on an idle lane, merged by 1 Dec, with the combined review. Otherwise do it in H1. Its value before G8 is small: it saves about 0.5 day in H1 and does not prove the Vercel behaviour, which needs the H1 spike |
| **2. Client-address source** | About 0.75 day with two modes | Can meet, with a default test | Meets | **Needed** (authentication, NFR-006). It uses reviewer capacity during the hardening window | Meets | **Fails in practice:** it touches the health route's C5 check, which the install rehearsal (DL-311) relies on. It brings no G8 value | — | **Post-G8 (H1).** No benefit before G8, and it adds risk to the sign-in throttle and the install rehearsal |
| **3. Database API off** | 0 code | — | — | — | — | — | — | **Not a code fix; nothing to land.** It is ADR-021 rule PI-5, the H1 go-live list and the neutral "no foreign grants" check. A migration form would fail H-a |
| **4. Timeouts into database settings** | 0 days (first choice) to about 1.75 days (fallback) | **Fails in the fallback:** it changes `create-roles.psql`, which `install.ps1` runs, plus its Pester tests | **Fails:** the shared role needs a `SET LOCAL` path for the worker; that is not small | **Needed** (database access; RISK-036 trigger; locks on data writes) | Meets | Fails: no G8 value | — | **Post-G8, and only if the H1 spike shows a transaction-mode pooler cannot be avoided.** It may never be needed |

**Net:** nothing needs to land before the freeze. Fix 1 may land if a lane is genuinely idle. Until the customer's sign-off of Release 1, H1 is design only: ADR-021, this sizing and the data move (all done today), and the spike plan (section 9). The spike is code, so it is H1's first day and comes after the sign-off.

---

## 8. Duration from H1's start

**Entry criterion (the delivery lead, 2026-11-23; recorded in ADR-021):** H1 starts only after the customer has fully signed off Release 1 on Accucut's Windows Server. That sign-off comes after the G8 sign-off and the install. Before it, H1 is design only: no H1 build work, spike or CI change. So the sizing gives a **duration from day 1 of H1**, not a calendar date. The delivery lead schedules day 1 (OQ-PM-16 (a)).

**Assumptions (labelled).**
- **A-H1-1:** Day 1 is the first day after the entry criterion is met **and** the host and database provider are chosen, the accounts are open, and OQ-PM-16 (b) (data residency of cost data) is answered. Anything missing on day 1 adds its delay to the duration.
- **A-H1-2:** The lanes are stated per case: **3 developer lanes**, as on the fast track, or **2 lanes** if one stays on Release 1 support. Release 1 is signed off by then, so no lane is reserved for go-live work.
- **A-H1-3:** The team works every day, as on the fast track. If it works a five-day week, multiply the calendar days by about 1.4. Holidays inside the span add their days.
- **A-H1-4:** Story PRs merge one at a time through a CI of 25 to 40 minutes, under whatever replaces CLAUDE.md section 9 after G8.
- **A-H1-5:** H1 has its own combined security review (row 17) and a regression on both targets (row 19), as RISK-036 requires.

**The phases, counted in calendar days from day 1.**

| Phase | Rows | 3 lanes: central (low to high) | 2 lanes: central (low to high) |
|-------|------|--------------------------------|--------------------------------|
| Build, spike on day 1 | 1 to 16 | 7 (5 to 11) | 10 (6 to 16) |
| Security review and fixes; proof on the web target | 17, 18 | 2 (1 to 2) | 2 (1 to 2) |
| Regression on both targets; data-move rehearsals both ways | 19, 12 | 2 (1 to 2) | 2 (1 to 2) |
| **H1 ready for its release decision** | | **about 11 days (7 to 15)** | **about 15 days (8 to 20)** |

- How the build row is worked out: 18.5 developer-days central (11.5 low, 28.75 high) divided by the lanes, plus 0.5 to 1.5 days of merge-queue friction.
- After the duration: the H1 release decision is human, as G8 is. The switch of targets then follows [data-move.md](data-move.md), on a date the delivery lead picks: about half a day of work and 1 to 2 hours with the portal closed.

**Lanes (3-lane central case).**

| Lane | Days 1 to 7 (build) |
|------|---------------------|
| A: platform | Spike on day 1 (streamed export on the chosen host, pooler with Prisma 7 and the `pg` adapter, database API off, role SQL, a Windows copy restored), then target switch (row 3), image (4), release job (8), environments (16), CI (15) |
| B: jobs and data | Jobs over HTTP (5), web-host backups (10), restore runbook (11), data-move script (12) |
| C | Export (6), database (7), client address (9), observability (13), mail (14) |

With 2 lanes, lane C's rows are split between A and B after their first items.

The replacement sizing would take about 10 calendar days at 2.5 lanes from the same start. Keeping both targets adds about 3.5 developer-days, which is about 1 to 2 calendar days at 3 lanes.

---

## 9. H1 spike (day 1 of H1, after the entry criterion; spikes in `spikes/`, never merged)

| ID | Question | Pass |
|----|----------|------|
| S-1 | Does the chosen host deliver a 97.5 MB streamed `.xlsx` with `Content-Length` set? | The file downloads whole at 500 parts with pictures, inside the function's memory (2 GB, or 4 GB on Pro if tight) |
| S-2 | Do Prisma 7 and `@prisma/adapter-pg` work through the provider's **session** pooler with start-up parameters (`statement_timeout` visible in `SHOW`)? | Yes means fix 4 is not needed |
| S-3 | Can the role SQL run without a superuser (no `ALTER SCHEMA public OWNER`)? | `migrate deploy` as `accucut_owner` succeeds |
| S-4 | Is the database API off, and does the "no foreign grants" query return no rows after the migrations? | Both |
| S-5 | Does a Windows backup copy restore into the managed database by [data-move.md](data-move.md) steps 6 to 8? | Every check in step 9 passes |

---

## 10. Monthly running cost (unchanged from the earlier sizing, not re-read today)

Web host for 10 to 20 users: Vercel Pro plus Supabase Pro in Mumbai, about **$46 to $62 a month**. A container host (for example Cloud Run in Mumbai) with a Mumbai database is about $35 to $60 (estimate). Railway was not priced. Accucut's Windows Server stays at Accucut's own cost. **Running both targets at once costs both.** Region rule: keep the app and the database in the same region (ADR-021 PI-6). OQ-PM-16 (b) decides whether cost data may sit outside India.

---

## 11. Open questions and risks raised

| ID | Item | Owner | Needed by |
|----|------|-------|-----------|
| OQ-PM-16 (a), (b) | Schedule (day 1, after the customer's sign-off of Release 1); data residency of cost data on a provider | delivery lead | Before H1 day 1 (A-H1-1) |
| OQ-PM-16 (c) | What survives a move: **answered by the architect** in [data-move.md](data-move.md) section 2. Users, password hashes, the audit record, pictures and every estimate survive. Sessions, throttle counters, logs and the source's backup copies do not | solution-architect | Answered |
| OQ-ARCH-H1-1 (new) | Who restores on the web host: the provider account owner, or the Admin with the `age` key (H-7 of the earlier sizing) | product-manager with the delivery lead | Before H1 row 11 |
| OQ-ARCH-H1-2 (new) | Does the web host become the main target after H1, or stay a standby? It changes how long the old target is kept after a switch ([data-move.md](data-move.md) section 7) | delivery lead | Before the first switch |
| RISK-036 | Owned by ADR-021's security section | solution-architect | H1 |
