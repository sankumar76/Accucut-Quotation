# DEF-042: `task-queue.spec.ts:74` [desktop] flaky: `seedQueueTask` hits duplicate key `uq_tasks_code` (Q-9998-557630) because `queueTaskCode()` draws a random 6-digit number with no retry

| Field | Value |
|-------|-------|
| Story / AC | STORY-04.02 (AQP-298) AC-1, AC-3, AC-6 (the spec `task-queue.spec.ts` and `support/queue.ts`) |
| Severity | **Sev-3 Moderate (regraded 2026-11-23 on the second occurrence, see "Second occurrence" at the end)**; was Sev-4 Minor |
| Priority | P3 |
| Type | Test (flaky E2E, test-data generator) |
| Status | **Open** (Jira To Do, Medium after the regrade; Sev-3: fixed before G8 or accepted in writing by master, test plan section 6). Second occurrence 2026-11-23: PR #658 run 45181789370, `task-status.spec.ts:103` [mobile] |
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

## Second occurrence 2026-11-23, regrade to Sev-3 (qa-engineer; read from the Stage 12 job log, ANSI stripped; no re-run, no ruling)

**Where.** PR #658 (`test/AQP-417-delete-diagnostic`, head e41e8f74, base `master` 87719a6e), run **45181789370** (every job `success`), Stage 12 shard 2 job **137717154377** (`1 flaky, 7 skipped, 541 passed (16.1m)`): `task-status.spec.ts:103` [mobile] "an Engineer > AC-2, AC-3: GET /api/v1/tasks/{id} answers the own task in each state with the named keys only, and no price, approver or reason": attempt 1 failed after **288 ms** with `error: duplicate key value violates unique constraint "uq_tasks_code"` at `tests/e2e/support/queue.ts:57` (`seedQueueTask`, called from `seedStates` at `task-status.spec.ts:41`, `openQueueWithStates` :50, the case at :104); the retry passed in **5.8 s**. The signature is the same as the first occurrence (run 44116384090, `task-queue.spec.ts:74` [desktop], 243 ms in): the same file and line, the same error, the same generator (`queueTaskCode()`: `Q-9998-` plus `randomInt(100000, 999999)`, no uniqueness by construction, no retry on SQLSTATE 23505), a different spec and project.

**Reading.** A test-data collision, not the product and not a time-out: a random 6-digit running number drawn in a shard's database that already holds the codes seeded earlier in that shard (about 50 `seedQueueTask` call sites across `task-queue`, `task-queue-filters`, `task-status`, `overdue-bell`, `reassign-task` and `canary-scan`, each run at three widths). The first occurrence's estimate was 0.05 to 0.2 % per shard; two occurrences in the 498 completed CI runs since the first (401 `success`, 97 `failure`; `gh api` count of the CI workflow since 2026-11-17T14:00Z, 185 more were cancelled) is about 0.4 % per run, 0.1 % per shard: the same order. The retry draws a fresh number, so a failure of **both** attempts needs a second collision (about one chance in 10,000 per case), which is why the run stayed `success`. **Not counted on RISK-031:** a seed error at 288 ms, not a time-out, on a PR run. **No new Bug:** this is the second occurrence of DEF-042, and nothing in the logs read so far shows a third.

**Regrade (this file's own rule: "Raise the grade if seen again").** **Sev-4 Minor to Sev-3 Moderate**, type Test (a flaky E2E, test-data generator), priority P3, not a G8 blocker. Test plan section 6: Sev-3 is fixed before G8 or accepted in writing by master; the case is the same shape as DEF-067 (a flaky test that can mark any PR's run flaky, and fail it if both attempts collide). Jira AQP-345 priority Low to Medium and label `sev-4` to `sev-3`; GitHub #480 `sev-4` to `sev-3` (done by QA 2026-11-23).

**Fix route (QA's proposal; a change under `tests/e2e/support/**` comes to master first, as in DL-334 and DL-342).** Make the code unique by construction (the worker index plus a counter or a database sequence) or retry the insert on SQLSTATE 23505 (a new draw, a bounded number of tries), keeping the year 9998; no change to any spec, assertion, budget or retry; the E2E test count is unchanged. Callers: `task-queue`, `task-queue-filters`, `task-status`, `overdue-bell`, `reassign-task`, `canary-scan`. **Proof (proposal):** the helper's unit test shows two draws that collide get two different codes (or that the second try is made), and the next two CI runs show no `uq_tasks_code` line. **A third occurrence** is read against this file: it comes to master with the route above.

**For master.** (1) The regrade to Sev-3 (QA's, on this file's rule). (2) The route: a small test-only change to `tests/e2e/support/queue.ts` in a free lane before G8, or acceptance in writing at G8 (about 1 CI run in 250, passing on retry). QA recommends the change: it is one function.
