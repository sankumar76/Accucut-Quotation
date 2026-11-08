# DEF-019: Users and Audit E2E specs time out at tablet width once a long-lived local database holds about 200 disposable E2E users

| Field | Value |
|-------|-------|
| Story / AC | AQP-57 (STORY-01.03) / regression (not caused by this story) |
| Severity | Sev-4 Minor |
| Priority | P3 |
| Type | Test / Environment (data growth) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-08 |
| Build / commit | `64a1678` on `feat/AQP-57-engineer-projection-scan` |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium, throwaway `postgres:17` with invented credentials, 2 workers, CI mode (one retry as configured) |
| Jira / GitHub | [AQP-226](https://sankumar76.atlassian.net/browse/AQP-226) / [#118](https://github.com/sankumar76/Accucut-Quotation/issues/118) |

## Steps to Reproduce
1. Use a throwaway local database that has had many E2E runs. Each run makes disposable users (`e2e.*@example.test`, DL-085) and the runtime role cannot delete users, so they accumulate. Here: 198 users after the many E2E runs of this QA session (scan runs, planted-fault runs and two full-suite runs).
2. Run `npx playwright test --workers=2` (the full suite).
3. Run `npx playwright test users.spec.ts audit.spec.ts --project=tablet --workers=2 --retries=0`.
4. Delete the disposable users as the database owner (193 rows, 5 left) and run `npx playwright test users.spec.ts audit.spec.ts --workers=2 --retries=0`.

## Expected Result
Every Users and Audit test passes at the three widths, as in CI (a fresh database per shard).

## Actual Result
- Step 2: 470 tests, 445 passed, 21 skipped, **2 failed and 2 flaky, all at tablet (768 px)**. Failed: `users.spec.ts:51` (`page.evaluate`, `Test timeout of 30000ms exceeded`) and `users.spec.ts:227` (timeout). Flaky: `audit.spec.ts:98`, `users.spec.ts:204`. 26.4 minutes.
- Step 3, same 198 users and nothing else running: `users.spec.ts:51` fails again (32.0 s); the other 19 pass. So this is data volume, not machine load.
- Step 4: **67 passed, 0 failed, 0 flaky** at mobile, tablet and desktop.

## Evidence
Logs of the three runs (QA scratchpad `e2e-full-clean.log`, `e2e-rerun-tablet.log`, `e2e-rerun-users-audit.log`); `select count(*) from users` gave 198 before and 5 after.

## Suspected Area
The Users page lists every person with no paging, so an axe scan over about 200 rows at 768 px passes the 30 s limit. `createDisposableUser` (`tests/e2e/support/auth.ts`) adds rows by design.
Options: a README line to recreate the throwaway database when the list passes about 100 rows; scope the Users spec's axe scan to the first rows; or let the set-up project clear old `e2e.*` rows locally through the owner role. No limit raised, no retry added (DL-057).

## Impact
Only a long-lived local database. CI is unaffected. It does not hold G7 of AQP-57.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
