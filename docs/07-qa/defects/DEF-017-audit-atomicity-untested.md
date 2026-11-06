# DEF-017: Audit atomicity is untested for most user events; an audit write moved into its own transaction survives a rollback undetected

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.07 (AQP-74) / AC-2 (the entry is in the caller's transaction); master's G7 item "a planted bypass of the single transaction must fail" |
| Jira / GitHub | [AQP-224](https://sankumar76.atlassian.net/browse/AQP-224) / [#103](https://github.com/sankumar76/Accucut-Quotation/issues/103) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test |
| Status | New |
| Found by / date | qa-engineer, 2026-11-06 (AQP-74 G7 attempt 1, QA-F1); master NO-GO on it alone (DL-107, Jira 11112) |
| Build / commit | `7e0f287` (PR #97) |
| Environment | Scratch `git archive` copy, throwaway local PostgreSQL 17, Vitest |

## Steps to Reproduce
1. In a scratch copy, in `src/server/services/user-service.ts`, replace one event's `await audit.record(tx, {...})` with `await transactions.run((own) => audit.record(own, {...}))`. The entry is then written in its own transaction, which commits even if the user change rolls back.
2. Run `npx vitest run tests/integration/audit tests/integration/users` (migrated throwaway PostgreSQL).
3. Run `npx vitest run tests/unit/user-service tests/unit/user-service-audit.test.ts tests/unit/audit`.

## Expected Result
Each planted bypass fails at least one test, for every user event.

## Actual Result
| Event (line) | Integration (64) | Unit (183) | Caught |
|---|---|---|---|
| `user.renamed` (166) | 1 fail: the self-rename test **timed out at 5 s** (a lock wait on the actor row, not an atomicity assertion) | all pass | only incidentally |
| `user.role_changed` (169) | all pass | 3 fail | yes |
| `user.activated` (172) | all pass | all pass | **no** |
| `user.deactivated`, `user.created`, `user.password_reset` | not run (the PC's temp volume filled up) | — | **not checked** |

**Why the rename rollback test does not catch it.** "A rename that is rolled back writes no entry and leaves the name" makes the rollback happen by rejecting inside `audit.record` itself. The rollback therefore happens whether or not the entry was in its own transaction.

## Evidence
- QA report `docs/07-qa/AQP-74-test-report.md` (commit `2843d13`, section QA-F1).
- Jira AQP-74 comment 11111.

The product code is not in question: every `audit.record` takes the caller's `tx`.

## Suspected Area (optional)
The tests in `tests/integration/audit/` and `tests/unit/user-service-audit.test.ts` need one of these:
- a test per event in which a later step of the same transaction fails **after** the entry is written, asserting no entry and no change. For example, a name plus role save where the second entry is refused: no `user.renamed` entry, and the name is unchanged;
- or a unit assertion that each `record` call receives the transaction it was opened with.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | Attempt 2: six planted bypasses, one per event, each must fail a test |
