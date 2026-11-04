# DEF-012: tokens.test.ts re-reads every source file inside each scan test and times out at the default 5 s under load

| Field | Value |
|-------|-------|
| Story / AC | Found at AQP-182 G7 evidence (b). Origin: AQP-28 (`tests/unit/tokens.test.ts`), in PR #57 through the master merge. Class: DEF-003 and DEF-007 (DL-057) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (load-sensitive timing) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-04 |
| Build / commit | `db768eb` (PR #57) |
| Environment | Windows 11, Node v24.19.0; `tsc`, `eslint` and `next build` looping in a second checkout (the DEF-003 record's load) |
| Jira / GitHub | [AQP-187](https://sankumar76.atlassian.net/browse/AQP-187) / [#68](https://github.com/sankumar76/Accucut-Quotation/issues/68) |

## Steps to Reproduce
1. In a second checkout, run `npx tsc --noEmit`, `npx eslint .` and `npx next build` together, over and over.
2. In PR #57's checkout, run `npx vitest run tests/unit` ten times in a row.

## Expected Result
1,487 of 1,487 every run, as alone and in CI.

## Actual Result
2 of 10 runs failed one test each, with `Test timed out in 5000ms`:
- run 3: "AC-1: finds 0 rgb(), hsl() or similar colour functions in src outside globals.css" (5,360 ms);
- run 6: "AC-1: finds 0 pixel font sizes in src outside globals.css" (6,530 ms).

The other 8 runs passed 1,487 of 1,487. The DEF-007 files (`env-example`, `server-only`, `data-files`) did not fail in any run, and no run reported a `ProcessStartError`.

## Evidence
The run logs are in QA's scratch folder; the summary is in `docs/07-qa/AQP-182-test-report.md`. The test builds its file list once, in the `describe` block. But `offences(pattern)` calls `readFileSync` on every file in `src` again inside each of the three scan tests, so the 5 s test limit covers the disk reads.

## Suspected Area
`tests/unit/tokens.test.ts`, the "no hard-coded colour or pixel font size" block. Read the contents once in a `beforeAll`, under the 120 s hook limit, and let each test only match its pattern against the text already in memory, as `server-only.test.ts` now does (DEF-007). No limit raised, no retry.

## Impact
No product effect. A developer who tests while building sees a red token test that says nothing about tokens.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
