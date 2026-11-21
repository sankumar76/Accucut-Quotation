# DEF-055: Assignment e-mail rows never expire and are written while FEATURE_EMAIL is off, so switching e-mail on or a worker outage sends every old "Task assigned" mail

| Field | Value |
|-------|-------|
| Story / AC | STORY-09.03 (AQP-350) AC-1 and AC-7; FR-081, FR-084, BR-040; decision D-c (a mail about an old event must not go out late) |
| Severity | **Sev-2 Major** (qa-engineer, 2026-11-21): lands on the first real send; the workaround (clear the outbox by hand before switching on) is not documented and does not cover an outage |
| Priority | P2. Fix before STORY-09.08 (AQP-355, the real send) and before G8 |
| Type | Product |
| Status | New (logged 2026-11-21) |
| Jira / GitHub | [AQP-385](https://sankumar76.atlassian.net/browse/AQP-385) / [#578](https://github.com/sankumar76/Accucut-Quotation/issues/578) (existing, label `sev-2` added). Same as reviewer-quality QLT-F-01 (`docs/06-reviews/final/quality.md`) |
| Found by / date | qa-engineer, final regression, 2026-11-21, by reading code (no live app) |
| Build / commit | master `242c21f7` |
| Environment | Read-only worktree; no run. The check with Mailpit and a real mailbox is on the release-round list (09.08) |

## Steps to Reproduce
1. Read `src/server/services/task-mail.ts` `enqueueTaskAssigned` (lines 74 to 86): `mail.enqueue(...)` is called with no `sendBefore`.
2. Read `src/server/services/task-service.ts` lines 256, 273 and 362: the row is written whenever alerts are ON, with `FEATURE_EMAIL` on or off.
3. `outbox-send` sends any due row and does not check whether the task was closed or reassigned since.
4. Live check for the release round (Mailpit): assign tasks with `FEATURE_EMAIL=off`, switch it on, start the worker; expect no mail for rows older than the window.

## Expected Result
A row older than its window (suggested 24 h) is skipped as EXPIRED (as the reset and overdue rows already are); a reassigned task's older pending row is not sent.

## Actual Result
Every queued "Task assigned" mail goes out at the send rate, including mails about closed tasks and to the previous Engineer of a reassigned task.

## Evidence
`task-mail.ts:74-86`, `task-service.ts:256, :273, :362`, `docs/06-reviews/final/quality.md` QLT-F-01.

## Suspected Area
`src/server/services/task-mail.ts`, `task-service.ts`, `src/server/mail/` (`sendBefore`), `src/server/jobs/outbox-send.ts`.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | `fix/AQP-385-<slug>` |
| Regression test added | developer | | unit and integration: expiry; a reassigned row is not sent |
| Verified | qa-engineer | | CI, then the 09.08 real send |
