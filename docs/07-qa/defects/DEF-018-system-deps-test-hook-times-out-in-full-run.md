# DEF-018: tests/unit/playwright-system-deps.test.ts hook times out at 120 s in the full Vitest run on Windows; it passes alone in 43 s

| Field | Value |
|-------|-------|
| Story / AC | AQP-57 (STORY-01.03) / regression (not caused by this story) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (load-sensitive timing; the DEF-003, DEF-007 and DEF-012 class, DL-057) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-08 |
| Build / commit | `64a1678` on `feat/AQP-57-engineer-projection-scan` |
| Environment | Windows 11, Node v24.19.0, Vitest 5.0.5, throwaway `postgres:17` with invented credentials; 177 Vitest workers on one machine |
| Jira / GitHub | [AQP-225](https://sankumar76.atlassian.net/browse/AQP-225) / [#117](https://github.com/sankumar76/Accucut-Quotation/issues/117) |

## Steps to Reproduce
1. Check out `64a1678`, run `npm ci` and migrate a throwaway database.
2. Run `npx vitest run` (the whole suite, 177 files).
3. Run `npx vitest run tests/unit/playwright-system-deps.test.ts` on its own.

## Expected Result
All 177 files pass, as CI stage 11 does on Linux for this head (run 42484736523, green).

## Actual Result
Step 2: 176 files and 4,255 tests pass, 25 are skipped, and 1 suite fails: `tests/unit/playwright-system-deps.test.ts > scripts/ci/playwright-system-deps.sh`, `Error: Hook timed out in 120000ms` at the `beforeAll` on line 270 (the suite ran 145,952 ms and its 25 tests were skipped).
Step 3: 25 of 25 pass in 42.7 s.
The developer's baseline on `master` e466c3b (PR #115 Dev Record) records the same failed suite, so it is pre-existing. PR #115 changes neither the test nor `scripts/ci/playwright-system-deps.sh`.

## Evidence
- Full run: `Test Files 1 failed | 176 passed (177)`, `Tests 4255 passed | 25 skipped (4280)`, `Duration 198.34s`.
- Isolated run: `Test Files 1 passed (1)`, `Tests 25 passed (25)`, `Duration 42.71s`.

## Suspected Area
One `beforeAll` runs every scenario of the shell script in turn. Each starts `bash` (slow on Windows), and with 177 workers starting together the total passes the 120 s hook limit.
Fix in the DEF-003 family: give each scenario its own `it` or hook, or mark the file as Linux-only. Do not raise the limit (DL-057).

## Impact
A red local run that says nothing about the product. It does not hold G7 of AQP-57: CI is green on the same head and the file is green alone.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
