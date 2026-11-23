# DEF-067: `approve.test.ts:339` asserts the removed-price record does not contain the text "600"; a timestamp ending `.600Z` fails it (about 1 run in 1,000; red `Stages 1 to 11b` on PR #633 run 45100288884)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.04 (AQP-321, Recalculate and the cleared figures), the test title "AC-9 (AQP-321 AC-4): BO is the approvals row, so clearing the calculated figures cannot change it". **No AC is shown to fail**: the product answer is right |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23; a flaky test, test plan section 6; it can turn a required check red on any PR) |
| Priority | P3. Lane: hardening window, test-only; ahead of Minors. Does not block G8 |
| Type | **Test** |
| Status | **Open** (logged 2026-11-23) |
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
