# ADR-011: Worker with node-cron and a Postgres e-mail outbox

| Field | Value |
|-------|-------|
| Status | Proposed. Revised for v0.3 (D-15). The mail sign-in mode depends on OQ-ARCH-11 |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-019, 081 to 084; NFR-013, 014, 015, 024; SPEC §2, §5.4, §18 D-15; Q-18; OQ-ARCH-11; ADR-001 |

## Context
SPEC §5.4 needs an assignment e-mail, an overdue e-mail within 5 minutes, and a daily digest at 11:00 IST, all only when alerts are ON, idempotent, retried and logged. SPEC §2 allows node-cron in a separate worker process.

## Decision Drivers
- NFR-014: 100 % sent, 0 duplicates, up to 3 retries
- NFR-015: schedules in IST
- Simplicity: Postgres is already there
- Testability with a controlled clock

## Considered Options
### Option A — `worker` process, node-cron schedules, transactional outbox table
- Pros: no new infrastructure; the e-mail row commits with the business change; a unique key gives idempotency; the table doubles as the e-mail log (DR-013)
- Cons: polling once a minute; a small amount of retry code to write
- Cost / effort: low

### Option B — pg-boss
- Pros: retries, backoff and scheduling built in, on Postgres, MIT
- Cons: another schema and API for four small jobs; the unique business key and the log are still ours
- Cost / effort: low to medium

### Option C — BullMQ and Redis
- Pros: mature queue
- Cons: a new stateful container and a backup concern, for a few e-mails a day
- Cost / effort: medium

### Option D — OS cron calling a protected endpoint
- Pros: no scheduler code
- Cons: host configuration outside Compose; a new secret-protected endpoint
- Cost / effort: low, worse for NFR-030

## Decision
We will run a `worker` container from the same image, using node-cron 4 with `timezone: 'Asia/Kolkata'`. Jobs write to `email_outbox`, whose unique `idempotency_key` makes re-runs harmless. The assignment e-mail row is written in the task's own transaction. `outbox-send` claims rows with `FOR UPDATE SKIP LOCKED`, checks the alerts setting at send time, and retries up to 3 times (1, 5, 15 minutes). The digest also runs at start-up if today's is missing, so a restart at 11:00 does not lose it.

Nodemailer must be **10.3.1 or later**. Older lines carry high-severity advisories that include header injection and address-parsing issues (`npm audit`, 2026-11-01). Credentials come from environment variables only. Recipients come only from `users`.

In R1 the worker runs only a heartbeat, so FR-091's three-container install is true from the first hand-over.

**Added at UX reconciliation.** Messages have HTML and plain-text bodies (`body_html`, `body_text`), full links built from `APP_ORIGIN`, and an inline logo by content ID, as SCR-22 shows. **One exception to the outbox:** the Settings test e-mail (SCR-15) is sent directly by `app` to the signed-in Admin's own address, because the screen reports success or failure at once. So `app` also receives the SMTP variables. The API accepts no recipient, so this cannot be used to send mail elsewhere.

**Added for v0.3: mail sign-in.** The delivery lead's service is Microsoft Outlook and the sender is not decided (D-15). SMTP with a user name and password, as SPEC §2 implies, cannot be relied on. Personal Outlook.com requires OAuth2. Microsoft 365 needs SMTP AUTH enabled per mailbox, and Basic authentication is reported to go off by default for existing tenants at the end of December 2026 (second-hand, architecture section 4.7). Outlook may also be only the mail app, in which case the mailbox's real provider decides.

| Option | Pros | Cons |
|--------|------|------|
| **Chosen:** Nodemailer stays, with `SMTP_AUTH_MODE` of `none`, `password` or `oauth2-client-credentials`, in one file, `transport.ts` | Keeps SPEC §2 and the outbox; no new dependency; the mode is a setting, so the open facts change configuration | One small token function to write, unproven until tested on a real tenant |
| Password only | Simplest | Would stop working on Microsoft 365, and cannot work on Outlook.com |
| Microsoft Graph `sendMail` | No SMTP AUTH dependency | Leaves SPEC §2, needs a second transport for other providers; held as the fallback if the organisation refuses SMTP AUTH |

The `oauth2-client-credentials` mode posts to Microsoft's token endpoint with `fetch` and gives the token to Nodemailer through `provisionCallback`. Credentials are environment variables only, never in `settings`. `outbox-send` claims at most 25 rows a run, under Microsoft's 30 messages a minute. `settings.sender_address` must be the mailbox or one with Send As rights, and the Settings test e-mail proves it. Delegated OAuth for a personal mailbox is not designed.

**Added for v0.3: `backup-watch`.** One daily job raises an alert after 8 days without a good backup (architecture section 9.5). It uses `job_runs` and the outbox, so it adds no infrastructure.

## Consequences
- Positive: exactly one e-mail per event, in plain SQL. Nothing new to back up.
- Negative / trade-offs accepted: sends can lag by up to a minute, well inside the 5-minute target. If mail is down longer than the retry window, rows stay `failed` until someone acts, which is shown on Settings and logged. An Entra client secret expires, and then every send fails until it is renewed. The mailbox must be dedicated, since Microsoft's steps give the app `FullAccess` to it.
- Follow-up actions (with owners): their IT person answers OQ-ARCH-11, and the tenant administrator sets up the mailbox and app. Mailpit and `FEATURE_EMAIL` are used until then.

## Verification
Controlled-clock tests with Mailpit (SPEC §14.11): job re-run sends 0 duplicates; alerts OFF sends none; failures retried and logged. A local stub covers the token flow. A real send through the actual mailbox is required before alerts go live, as Mailpit cannot test XOAUTH2.
