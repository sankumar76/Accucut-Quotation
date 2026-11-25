# ADR-021: Deployment targets: one codebase, two set-ups (Accucut server and web host)

| Field | Value |
|-------|-------|
| Status | **Accepted** as the target model (2026-11-23; the decision is the delivery lead's, DL-350, AQP-1 comment 12971; for `master` to log). The provider-independence rules (PI) and the security controls (SEC) are **Proposed** until the H1 spike ([hosting-h1-dual-target.md](../hosting-h1-dual-target.md) section 9) confirms them |
| Date | 2026-11-23 |
| Deciders | solution-architect (+ Santhosh, delivery lead: the target model; H1 release decision) |
| Related | PRD 6.5 (H1-N1 to H1-N6), OQ-PM-16; FR-091, FR-105, NFR-002, NFR-003, NFR-006, NFR-007, NFR-012, NFR-013, NFR-024, NFR-030; RISK-006, RISK-011, **RISK-036** (owned here); ADR-002, **ADR-015 (stays in force for the Windows target)**, ADR-011, ADR-012, ADR-013, ADR-017; DL-350; [data-move.md](../data-move.md); [hosting-h1-dual-target.md](../hosting-h1-dual-target.md) |

## Context

- The G8 release runs on one Windows Server at Accucut (ADR-015): Windows services, a reverse proxy, PostgreSQL 17 on the same machine, weekly `age` backups on the same disk, and a JEA endpoint through which the Admin restores.
- On 2026-11-23 the delivery lead decided three things:
  - G8 stays exactly as designed.
  - A post-G8 Hosting release H1 also runs the portal on a managed web host, "similar to Vercel or Railway", with a separate managed PostgreSQL, without depending on one provider.
  - "One codebase, two set-ups": the same features; configuration selects "Accucut server" or "web host"; every fix lands in both; data moves by export and import so they can switch. This adds a target and replaces none.
- The code as built at `origin/master` b85b2aa9 assumes the Windows host in four places. Each one breaks or weakens on a managed host:
  1. The export answers one buffer (`file-response.ts`). About 97.5 MB at 500 parts with pictures is over a function host's 4.5 MB buffered-response cap.
  2. The throttle trusts the last `X-Forwarded-For` entry (`client-address.ts`). That is right behind our own proxy, but wrong where the platform appends its own address.
  3. A managed database can expose its own data API. Supabase serves `public` over REST by default, and the portal's tables are in `public` with no row-level security.
  4. Pool timeouts are start-up parameters (`prisma-client.ts`), which a transaction-mode pooler drops.

## Decision Drivers

- H1-N1 and H1-N2: one codebase, every fix in both; H1-N5: Windows stays supported, including JEA and AC-8.
- H1-N4: no provider lock-in; H1-N3: data moves by export and import.
- NFR-002 (cost confidentiality; "a leak cannot be recalled"), NFR-006 (sign-in throttle), NFR-007 (secrets).
- NFR-013: the web host can remove RISK-011 (a server loss loses every backup) for that target.
- G8 must not move (DL-350 (2)); CI tooling is frozen until G8 (CLAUDE.md section 9 item 4).
- A small team: the simplest design that runs on both.

## Considered Options

### Option A: Replace the Windows target with the web host (the earlier sizing)
- Pros: one set-up to run and test. About 19 developer-days. Retires about 15,000 lines of Windows scripts and tests.
- Cons: **contradicts the delivery lead's decision** (H1-N5). Throws away STORY-10.04, 10.05 and 10.11 and the JEA design. Accucut loses the on-premises option and the ability to switch back.
- Cost / effort: 12 / 19 / 29 developer-days.

### Option B: Fork, with a branch or a copy per target
- Pros: each target's code is free of the other's concerns.
- Cons: **"every fix lands in both" becomes manual cherry-picking**, so drift is certain. Two review and CI streams. The audit and cost-confidentiality guarantees would have to be proved twice and kept equal by hand.
- Cost / effort: lower at first (about 18 days). The cost grows with every fix after that, without limit.

### Option C: One codebase, built for one provider (for example Vercel plus Supabase, using their SDKs and features)
- Pros: the least code. About 2 days fewer than a portable design. Uses Vercel Cron, `@vercel/functions` and the Supabase client directly.
- Cons: **lock-in contradicts H1-N4.** Moving provider becomes a project. Supabase's Data API, Auth or row-level security, once used, become a second authorisation model beside role projection (ADR-008).
- Cost / effort: about 20 developer-days.

### Option D: One codebase, two set-ups, selected by configuration, using only provider-neutral interfaces (chosen)
- Pros: meets H1-N1 to H1-N5. One code path for every feature. Differences are named in one profile. Both targets are tested on every relevant change. Data moves in the backup format that already exists.
- Cons: two set-ups to run, document and test. CI gains a second package workflow and a nightly job. Every H1 change is checked on both. About 3.5 developer-days more than Option A.
- Cost / effort: **14 / 22.5 / 35 developer-days** ([hosting-h1-dual-target.md](../hosting-h1-dual-target.md) section 4).

## Decision

We will run **one codebase with two set-ups**:

- `accucut-server` is the default and is ADR-015 unchanged.
- `web-host` is a managed web host plus a separate managed PostgreSQL 17.
- **One setting, `DEPLOY_TARGET`, selects the set-up.** It is read once in `src/lib/env.ts` and turned into a typed **target profile** (proposed `src/server/config/target-profile.ts`). The profile is the only place target differences live:
  - job mode (worker or HTTP);
  - the job set;
  - the storage check (disk or database size);
  - pool constants per (target, kind);
  - pooler mode;
  - the client-address source;
  - the export time cap;
  - the settings each target requires or forbids.
- **Features, screens, rules and data model are identical.**

The four code fixes are made **target-neutral** ([hosting-h1-dual-target.md](../hosting-h1-dual-target.md) section 6):

1. The export body is streamed on both targets, with the same bytes and headers.
2. The client-address source is a setting whose default is today's rule.
3. The database API exposure is closed by provider setting plus a neutral "no foreign grants" check, not by code.
4. The timeouts stay start-up parameters through a direct connection or a session-mode pooler. Role defaults are used only if a transaction-mode pooler cannot be avoided.

**Data moves** by restoring the backup format into a new, empty database on the other target ([data-move.md](../data-move.md)).

**Entry criterion (the delivery lead, 2026-11-23, relayed by the orchestrator):** Hosting release H1 starts only after the customer has **fully signed off Release 1 on Accucut's own Windows Server**, which comes after the G8 sign-off and the install. Until then, H1 is **design only**: this ADR, the sizing and the data-move procedure. There is no H1 build work, no spike and no CI change. A code fix that lands before the G8 freeze under DL-350 (3) H-a to H-f is a G8 change, not H1 work, and it does not start H1. H1's effort is therefore given as a **duration from its start**, not a date ([hosting-h1-dual-target.md](../hosting-h1-dual-target.md) section 8).

**ADR-015 stays in force** for the `accucut-server` target. This ADR adds to it and supersedes nothing. ADR-011 (jobs: worker or HTTP), ADR-012 and ADR-017 (streamed answer; time cap per target) are amended in H1.

### Provider-independence rules

| ID | Rule | Enforced by |
|----|------|-------------|
| PI-1 | Only standard interfaces between the portal and a provider: the PostgreSQL wire protocol through a connection string; HTTP in and out; SMTP or the existing mail `transport.ts` adapter; an S3-compatible API for backup copies; an OCI container image, or a Node.js build from source where a function host builds it | Design review in H1 |
| PI-2 | **No provider SDK in `src/`**: no `@vercel/*`, `@supabase/*`, `@neondatabase/*`, `@railway/*` or similar | `no-restricted-imports` lint rule and a dependency test (H1 row 3) |
| PI-3 | Provider-specific files are **configuration only**, under `deploy/web-host/<provider>/` (for example `vercel.json`, `railway.toml`), plus the scheduler entries that call the job endpoints | Review; CODEOWNERS on `deploy/` |
| PI-4 | **The database is plain PostgreSQL 17 on both targets, with UTF8 encoding.** The portal uses schema `public`, the three roles of `create-roles.psql` with the same names, no extension, no row-level security, and no provider Auth, Storage, Realtime or data API. Both targets move to a new major version together | Role SQL; the "no foreign grants" check; the data-move preconditions |
| PI-5 | **A provider's own data API is switched off** before any portal table exists, and the go-live list proves it (SEC-3) | H1 go-live list; data-move verify |
| PI-6 | The app and the database sit **in the same region**. The region is chosen under OQ-PM-16 (b) (data residency of cost data) | H1 environment set-up |
| PI-7 | **Changing provider is a data move plus new settings, with no code change** ([data-move.md](../data-move.md) section 8) | The web-to-Windows rehearsal proves the format is neutral |
| PI-8 | `DEPLOY_TARGET` is read only in `env.ts`. No code tests for a provider's environment variables (`VERCEL`, `RAILWAY_*` and the like). A target difference that is not in the profile is a defect | A unit test that fails if `DEPLOY_TARGET` or a provider's variable name appears in `src/` outside `env.ts`. Today nine files in `src/` read `process.env` (b85b2aa9), so a blanket lint ban would be a separate, larger change and is not proposed |
| PI-9 | Jobs are plain functions, callable by the worker or by an HTTP endpoint protected by a secret. Any scheduler may call them. Jobs stay idempotent (`SKIP LOCKED`, idempotency keys), so a repeated or missed call is safe | ADR-011 as amended; existing job tests |
| PI-10 | Backups use one format on both targets (`pg_dump -Fc \| age` plus a manifest). Each target has its own copies; the web host also keeps the provider's daily backups | Backup tests per target; data-move rehearsal |

## Security (owns RISK-036)

The web-host target puts a portal that holds Restricted cost data on the public internet, with a database run by a provider. Today the portal runs on one private server. Each control below states what it guards and how it is checked. **H1 does not ship without its own combined security review (CLAUDE.md section 9 item 2) and a regression on both targets.**

| ID | Threat (STRIDE) | Control on `web-host` | On `accucut-server` | Verified by |
|----|-----------------|-----------------------|---------------------|-------------|
| SEC-1 | **Internet-facing sign-in** (spoofing; brute force) | The existing password rule, argon2id, the account and address throttles, the 12-hour session, `Secure`/`HttpOnly`/`SameSite` cookies, and the security headers in `proxy.ts`. TLS and HSTS come from the platform: `APP_ORIGIN` is `https`, and the platform redirects HTTP. **An IP allow-list or MFA is a product decision** for the product-manager, not part of H1's baseline (earlier sizing H-8) | Private network plus the reverse proxy (P1 to P8), unchanged | H1 security review; E2E sign-in and throttle on the web staging; securityheaders check |
| SEC-2 | **Client address from a forgeable header** (spoofing; denial of service through one shared counter) | `CLIENT_ADDRESS_SOURCE` **must** be set on `web-host`, and start-up refuses a missing value. Only a well-formed IP is accepted, as today. `/api/health` returns `X-Client-Address-Seen` under the configured rule. The go-live check C5-W: from two networks, the address seen is the caller's and differs, and a client-sent `X-Forwarded-For` does not change it | `forwarded-last` default, unchanged; check C5 unchanged | Unit tests per mode; go-live C5-W; H1 review |
| SEC-3 | **The managed database's own API** (information disclosure of cost data, NFR-002) | The provider's data API is off (Supabase: Data API disabled) **before** the first migration. The neutral query "no role outside `accucut_owner`, `accucut_app` and `accucut_backup` holds a privilege on a table in `public`" returns no rows. Database network access is restricted where the provider allows, and connections use TLS with `sslmode=verify-full` | Not applicable: localhost-only listener | Go-live list; the query in the nightly web-host job and in data-move verify |
| SEC-4 | **Secrets held by a provider** (information disclosure; elevation) | Runtime secrets live in the host's secret store, never in the image or the repository: `DATABASE_URL`, `AUTH_SECRET`, mail credentials, `JOBS_SECRET` and bucket keys. **Each target has its own values. A secret is never shared between targets**, so a leak on one does not open the other. `MIGRATE_DATABASE_URL` and the deploy token exist only in a GitHub **protected environment** with the delivery lead as required reviewer, never in pull-request workflows (public repository, TB-6), and the logs are masked. The bucket key may write only. **The `age` private key never reaches the web host**: the host holds only the public recipient. Rotation follows the existing runbook | `C:\Accucut\config\.env` with its ACL, `backup.pgpass`, the Admin's key: unchanged | H1 review; Gitleaks; a protected-environment check in the deploy workflow |
| SEC-5 | **Job endpoints** (elevation; repeated jobs as a denial of service) | `POST /api/internal/jobs/*` checks a bearer `JOBS_SECRET` in constant time, answers 404 without leaking whether it exists, and runs only idempotent jobs under 60 s | The endpoints answer 404: the profile switches them off | Unit tests on both profiles |
| SEC-6 | **Verifying every fix on two targets** (a fix proved on one target only) | Per-target unit tests in the required check; the Web host package and Windows package workflows on relevant PRs; the nightly web-host E2E; the H1 merge rule (both package workflows green when they ran); before H1 ships, a regression on both targets (sizing row 19) | Same | CI; H1 release checklist |
| SEC-7 | **Drift between the set-ups** (tampering by omission) | One profile module (PI-8); profile-completeness tests that fail when a setting is added to one target only; `.env.example` lists every setting with the target(s) that need it; the data-move rehearsal in both directions proves the schemas are the same | Same | Unit tests; rehearsals; a review item on every H1 PR |
| SEC-8 | **Data residency and provider access** (information disclosure) | Region per PI-6; the provider's staff access and sub-processors are a delivery-lead decision under OQ-PM-16 (b), recorded before H1 is scheduled. Logs already redact inputs, outputs and rates. This is not legal advice | Data stays at Accucut | OQ-PM-16 (b) answer |
| SEC-9 | **Restore and move files** (disclosure of a full copy) | Copies and move files are `age`-encrypted. Move files are carried only on storage Accucut controls, never through CI, the repository, e-mail or chat ([data-move.md](../data-move.md) step 5) | As section 9.5 | Rehearsal record |

## Consequences

**Positive**
- Accucut can run on its own server, on a web host, or switch between them, with one product and one fix stream.
- On the web host, a server or disk loss no longer loses every backup: RPO is about 1 day, with weekly copies kept off the provider.
- The streamed export and the explicit client-address source also make the Windows target's assumptions visible and tested.

**Negative / trade-offs accepted**
- Two set-ups to document, run and test.
- About 200 extra CI minutes a day, and a nightly job.
- H1 changes need checks on both targets.
- The managed database adds a provider and a residency question.
- Running both targets at once costs both.

**Follow-up actions (with owners)**
1. Master logs this ADR and the target model (DL-350).
2. Before H1 day 1, which comes after the customer's sign-off of Release 1, the delivery lead chooses the host and database provider and answers OQ-PM-16 (a) and (b).
3. The product-manager restates FR-091, FR-105, NFR-013, NFR-024 and NFR-030 per target, from sizing section 3, and answers OQ-ARCH-H1-1 (who restores on the web host).
4. The architect, on H1 day 1 (after the entry criterion), not before: the spike S-1 to S-5. Then architecture sections 9.1 to 9.9 split per target; ADR-011, 012 and 017 amended; and the test strategy gains a per-target section.
5. The scrum-master and product-owner turn sizing section 4 into H1 stories. Every story carries its target scope, and a story is not Done until both targets are checked.
6. Fix 1 (streamed export) may land before the freeze only under DL-350 (3) H-a to H-f (sizing section 7).

## Verification

- **Entry criterion met** before any H1 build work: the customer's full sign-off of Release 1 is recorded on AQP-1.
- **Spike S-1 to S-5** pass on the chosen provider (H1 day 1).
- **Both data-move rehearsals** (Windows to web, web to Windows) pass every check in [data-move.md](../data-move.md) section 5, timed.
- The NFR-030 counterpart, from a release to a working sign-in on a new web host in 30 minutes or less, is timed in the H1 rehearsal.
- The H1 security review has no open Blocker, Critical or Major finding. Both targets pass the full regression on the H1 head.
- **Review date:** at the H1 release decision. Again at the first real switch of targets.
