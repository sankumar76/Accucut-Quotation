# ADR-011: Worker with node-cron and a Postgres e-mail outbox

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-019, 081 to 084; NFR-014, 015, 024; SPEC §2, §5.4; ADR-001 |

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

## Consequences
- Positive: exactly one e-mail per event, in plain SQL. Nothing new to back up.
- Negative / trade-offs accepted: sends can lag by up to a minute, well inside the 5-minute target. If SMTP is down longer than the retry window, rows stay `failed` until someone acts, which is shown on Settings and logged.
- Follow-up actions (with owners): Accucut IT supplies SMTP details (Q-18). Mailpit is used until then.

## Verification
Controlled-clock tests with Mailpit (SPEC §14.11): job re-run sends 0 duplicates; alerts OFF sends none; failures retried and logged.
