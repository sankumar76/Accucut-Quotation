# DEF-022: `e2e-shards` union test still fails on a cold Playwright cache when it runs beside `one-width-tag.test.ts`

| Field | Value |
|-------|-------|
| Story / AC | STORY-10.17 (AQP-227) / AC-2 (the guard that protects it); G6 ruling 4 (QLT-04) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (flaky guard; residual of QLT-04, pre-existing at base `3695f90`) |
| Status | New |
| Jira / GitHub | [AQP-236](https://sankumar76.atlassian.net/browse/AQP-236) / [#129](https://github.com/sankumar76/Accucut-Quotation/issues/129) |
| Found by / date | qa-engineer, 2026-11-09 |
| Build / commit | `0147c3e` on `feat/AQP-227-three-shards` (PR #124) |
| Environment | Windows 11, Node v24.19.0, `npm ci`, a new empty `PWTEST_CACHE_DIR` for every run |

## Steps to Reproduce
1. Check out `0147c3e`, `npm ci`.
2. Set `PWTEST_CACHE_DIR` to a new, empty folder.
3. `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-workflow-shards.test.ts tests/unit/e2e-shards.test.ts tests/unit/ci-fan-in.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/one-width-tag.test.ts`
4. Repeat 10 times, each with a new `PWTEST_CACHE_DIR`.

## Expected Result
83 of 83 pass every time (G6 ruling 4: `e2e-shards.test.ts` passes on a fresh cache).

## Actual Result
Runs 7, 8 and 9 of 10 fail with 1 failed, 82 passed: `e2e-shards.test.ts > the union of the shards' mobile, tablet and desktop lists is the whole list, with none missing and none in two shards`, `AssertionError: expected [ ...(467) ] to deeply equal [ ...(467) ]` (same count, different `file:line` keys). Counting the first run and the 19 plant runs too, 7 of 30 six-file cold runs failed this one test; two of them were under plants that cannot affect it (P13, a change to the fan-in job, and P18, a change to `scripts/lib/ci-feedback-time.ts`). `e2e-shards.test.ts` alone passes 10 of 10 on a new cache.

## Evidence
* Six-file cold loop, clean `0147c3e`: exit codes 0 0 0 0 0 0 1 1 1 0 (logs in the QA scratch folder, summary in the test report).
* Single-file cold loop, clean `0147c3e`: 10 of 10 pass.
* Reproduction outside Vitest (plain Node script, two concurrent `playwright test --list --reporter=json` on one new cache, then a warm listing as reference): trials 2, 3 and 5 of 6 had one listing that differed from the warm one in 2, 33 and 39 entries, for example `sign-in.spec.ts:46` and `audit.spec.ts:121` (compiled line numbers). The other listing was always right.
* Not seen in CI: stages 6 and 11b were green in all five attempts of `fe520d2` (run 42513656141) and in run 42588037093 on `0147c3e`.

## Suspected Area
`tests/support/playwright-list.ts` (`listPlaywrightSuites`) is called from two test files that Vitest runs at the same time (`e2e-shards.test.ts`, `one-width-tag.test.ts`). The G6 fix orders the listings inside `e2e-shards.test.ts` only. Suggested fix, test only: give each listing its own `PWTEST_CACHE_DIR`, or warm the cache once in a Vitest `globalSetup`. No retry, no raised limit (DL-057). Verify 10 of 10.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
