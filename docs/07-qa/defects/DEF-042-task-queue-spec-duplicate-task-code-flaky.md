# DEF-042: `task-queue.spec.ts:74` [desktop] flaky: `seedQueueTask` hits duplicate key `uq_tasks_code` (Q-9998-557630) because `queueTaskCode()` draws a random 6-digit number with no retry

| Field | Value |
|-------|-------|
| Story / AC | STORY-04.02 (AQP-298) AC-1, AC-3, AC-6 (the spec `task-queue.spec.ts` and `support/queue.ts`) |
| Severity | Sev-4 Minor |
| Priority | P3 |
| Type | Test (flaky E2E, test-data generator) |
| Status | **Open** (Jira To Do, Low; backlog per test plan section 6) |
| Jira / GitHub | [AQP-345](https://sankumar76.atlassian.net/browse/AQP-345) / [#480](https://github.com/sankumar76/Accucut-Quotation/issues/480) |
| Found by / date | qa-engineer, 2026-11-17; master `d7e0208` |
| Environment | CI run 44116384090, job 134155465363, Stage 12 shard 4, desktop, Postgres 17, 4 workers; seen once in 20 runs |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-345, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Chance collision; not reproducible on demand. `seedQueueTask` inserts five tasks with `queueTaskCode()` (`Q-9998-` plus `randomInt(100000, 999999)`); one equals a row made earlier in the shard.

## Expected Result
Every seeded task gets a code no other row has.

## Actual Result
`duplicate key value violates unique constraint "uq_tasks_code"` at `tests/e2e/support/queue.ts:57`, 243 ms in; the retry passed in 3.8 s; CI green. Birthday estimate: 0.05 to 0.2 % per shard.

## Suspected Area
`tests/e2e/support/queue.ts`: make the code unique by construction (worker index and counter or sequence) or retry on SQLSTATE 23505; keep the year 9998. Callers: `task-queue`, `overdue-bell`, `task-status`, `canary-scan` specs.

## Fix & Verification  _(developer / qa-engineer)_
Raise the grade if seen again. No fix made.
