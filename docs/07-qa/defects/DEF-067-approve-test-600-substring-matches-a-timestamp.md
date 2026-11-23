# DEF-067: `approve.test.ts:339` asserts the removed-price record does not contain the text "600"; a timestamp ending `.600Z` fails it (about 1 run in 1,000; red `Stages 1 to 11b` on PR #633 run 45100288884)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.04 (AQP-321, Recalculate and the cleared figures), the test title "AC-9 (AQP-321 AC-4): BO is the approvals row, so clearing the calculated figures cannot change it". **No AC is shown to fail**: the product answer is right |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23; a flaky test, test plan section 6; it can turn a required check red on any PR) |
| Priority | P3. Lane: hardening window, test-only; ahead of Minors. Does not block G8 |
| Type | **Test** |
| Status | **CLOSED 2026-11-23 (qa-engineer): fixed by #654 (`master` 87719a6e); DL-322 (5) P1, P2 and P3 met (P3 on the squash push 45179046845: Stage 11 `640 files, 16272 tests passed`, `approve.test.ts` 14 tests passed, 0 five-second cuts; section "Closed" at the end). R14 ended with the merge; a recurrence reopens it the same day.** Earlier: **Open** (logged 2026-11-23) |
| Jira / GitHub | [AQP-409](https://sankumar76.atlassian.net/browse/AQP-409) / [#635](https://github.com/sankumar76/Accucut-Quotation/issues/635). Jira "relates to" AQP-321 and AQP-1. Labels `ai-delivery`, `aiid-DEF-067`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium |
| Risk / rule | No re-run rule covers a Stage 11 integration failure (R13 is the Mailpit signature, DL-305; W1 is Stage 12). A red `Stages 1 to 11b` from this case comes to master for a ruling before a re-run. Not a RISK-031 event |
| Found by / date | qa-engineer, 2026-11-23, reading PR #633's run |
| Build / commit | PR #633 head 43b6366f, run 45100288884, job `Stages 1 to 11b` 137449332477 (the test is unchanged on `master`; #633 touches `use-part-form.ts` and `tests/unit/use-part-values.test.ts` only) |
| Environment | GitHub Actions, integration Vitest run on PostgreSQL; invented data only |

## Steps to Reproduce
Not on demand in CI. By the cause: the test removes the latest approval and reads the view; `view.priceRemoved` is `{ at, byName }` with `at` the server clock's ISO time. Run the case with a clock whose milliseconds are 600 and the assertion at :339 fails.

## Expected Result
The assertion checks that no figure of the removed price is in the record, whatever the time of day.

## Actual Result
`AssertionError: expected '{"at":"2026-11-23T02:33:11.600Z","byN…' not to contain '600'` at `tests/integration/approval/approve.test.ts:339:51`. One test failed of 16,045 (`Test Files 1 failed | 634 passed (635)`); the unit stage passed (473 files, 10,492 tests).

## Evidence
Job 137449332477 log, lines "FAIL tests/integration/approval/approve.test.ts > AC-9 (AQP-321 AC-4) ... BO is the latest approval" and "Received: {"at":"2026-11-23T02:33:11.600Z","byName":"Invented Calculation Lead"}". The test line: `expect(JSON.stringify(view.priceRemoved)).not.toContain('600');`.

## Suspected Area
`tests/integration/approval/approve.test.ts:339`. The record has two keys; `JSON.stringify` includes the timestamp, whose milliseconds (three digits) equal 600 once in 1,000 on average. The same style (a number as text over JSON that holds a timestamp) may exist elsewhere in `tests/`.

## Fix route (developer; test-only)
Assert the shape instead of a substring: the keys of `view.priceRemoved` are exactly `at` and `byName` (and `byName` is a string), so a price field would still fail it. Read the other `not.toContain('<number>')` assertions over JSON with timestamps (`git grep -n "not.toContain('[0-9]" tests`). No skip, retry, timeout or weakened assertion.

## Proof needed
1. The case green with a fixed clock whose milliseconds are 600, and **red on `master` with the same clock before the fix**.
2. The integration suite green; the approval pack (`tests/integration/approval/`) unchanged otherwise.
3. QA reruns the case and the pack, then closes.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added (red on master first) | developer | | |
| Verified | qa-engineer | | |

## Fix PR #654 read against DL-322 (5) (qa-engineer, 2026-11-23; PR run 45174775621 Stage 11 job log, ANSI stripped; no re-run)

**The fix.** #654 (AQP-409; head 5f7a92ae; squashed as `master` 87719a6e; one file, `tests/integration/approval/approve.test.ts` +6 -3). Commit 1 (`7e154426`) fixes the test's own `removed_at` to the literal `2026-11-23T02:33:11.600Z` (set-up) and is shown red in the PR body (`not to contain '600'` at :342, the CI failure's received value); commit 2 replaces the substring check with `expect(view.priceRemoved).toEqual({ at: REMOVED_AT_WITH_600_MS, byName: 'Invented Calculation Lead' })` (stricter than DL-322 (5)'s `expect.any(String)`: the value is fixed, the keys are exactly `at` and `byName`, so a price field still fails). The `toMatchObject` line before it is dropped (the `toEqual` includes it); test count unchanged (14 in the file); nothing else under `tests/integration/approval/` changed; no `src/`, config or CI change.

| DL-322 (5) | Reading | Met |
|---|---|---|
| **P1** a fixed `.600` clock, red first, then green | the PR body's red run (commit 1, local, `1 failed`) and the green commit 2; QA did not repeat the local red run | **Yes** (developer's evidence, not repeated) |
| **P2** the integration suite is green on the PR's run of record, nothing else under `tests/integration/approval/` changed | PR run **45174775621** (head 5f7a92ae; every job `success`): Stage 11 `640 files, 16272 tests passed`; `approve.test.ts` **14 tests** passed with its siblings `cancel` (27), `unlock` (26), `remove-price` (17), `grants` (59), `override` (19), `guard` (14), `immutability` (17); one file changed | **Yes** |
| **P3** QA reruns the case and the approval pack, then closes | the approval pack (8 files, 193 tests) is green on the PR's run, 0 failures, 0 five-second cuts; QA's "rerun" is this CI run (no local PostgreSQL run by QA); **the squash push's Stage 11 (`master` 87719a6e, CI run 45179046845) was still running at this read** | **Met on the PR run; the close waits for the push's Stage 11** |
| **Sweep** (`git grep -nE "not\.toContain\('[0-9]" tests`) | QA ran it on `origin/master` 1eae9353: 44 lines in 40 files; the PR's list is the same families. The lines over data that holds a database clock are only `approve.test.ts:339` (fixed here) and `remove-price.test.ts:200` (`'1234'`: an ISO time holds four digits in a row only as the year); the rest search fixed constants or strings with a dot, a space or five or more digits. The residual: `tests/e2e/remove-price.spec.ts:184` and `:215` (`'48271'`) search page text that may hold UUIDs; the chance that a UUID holds that exact five-digit run is about 1 in 100,000 per UUID, not worth a change (QA) | **Accepted** |

R14 (DL-322 (3)) ends with the merge. **Not closed here until the squash push's Stage 11 is read clean** (QA then closes: this file, test plan, Jira AQP-409 through the Done transition, GitHub #635).

## Closed 2026-11-23 (qa-engineer; DL-322 (5) P3; Stage 11 job log of `master` push 45179046845, ANSI stripped)

**P3 on the squash push.** `master` 87719a6e (#654's squash), CI run 45179046845, every job `success`: Stage 6 `475 files, 10650 tests`, Stage 11 `640 files, 16272 tests passed`, `approve.test.ts` (14 tests) passed in 1,552 ms, 0 five-second cuts, 0 "Mailpit answered". The fixed `.600Z` literal keeps the case's regression guard on every run. **DEF-067 is closed** (this file, test plan, Jira AQP-409 through the Done transition, GitHub #635 closed with a comment); R14 ended with the merge; a recurrence (a failure of `approve.test.ts` on a timestamp digit) reopens it the same day.
