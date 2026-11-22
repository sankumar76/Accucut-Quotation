# DEF-039: `customer-delete.test.ts` leaves an unhandled rejection (FieldValidationError "Choose a customer from the list.") in the "delete holds the customer first" test; fails CI Stage 11 although all tests pass

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.07 (AQP-306) AC-5; related STORY-05.01 (AQP-301); found on PR #464 |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (harness race); not a product defect on the evidence |
| Status | **Closed** (Jira Done; GitHub #465 closed). Fixed by PR #466, squash `06c9f995` |
| Jira / GitHub | [AQP-342](https://sankumar76.atlassian.net/browse/AQP-342) / [#465](https://github.com/sankumar76/Accucut-Quotation/issues/465) |
| Found by / date | qa-engineer, 2026-11-17; head `cfef96e` of PR #464 |
| Environment | CI run 44083475042, Stage 11 integration tests; seen once in 15 runs |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-342, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Read the Stage 11 log of run 44083475042: "Unhandled Errors" after all 412 files finished (Tests 11205 passed, Errors 1).

## Expected Result
Vitest reports 0 errors; Stage 11 green.

## Actual Result
Vitest exits non-zero, so `Stages 1 to 11b` fails.

## Suspected Area
`tests/integration/masters/customer-delete.test.ts`, the second test of describe AC-5: the `choice` rejection handler is attached after `release()`; the rejection is the specified result (422), so the fix must keep the assertion and not mute the error.

## Fix & Verification  _(developer / qa-engineer)_
PR #466. Re-runs under DL-233 R1 lapsed with the fix.
