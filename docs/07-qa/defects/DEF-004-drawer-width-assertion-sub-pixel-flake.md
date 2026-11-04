# DEF-004: shell.spec.ts drawer-width assertion fails about 1 run in 10 (sub-pixel overshoot of 0.000008 px)

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02) / AC-4, AC-8 |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (flaky assertion; test plan section 7 treats a test that fails and then passes as a defect of type Test) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `f903d48` on `feat/AQP-28-tokens-and-shell`; the test file is unchanged on the merged head `a4b94a0` |
| Environment | Windows 11, Node v24.19.0, Chromium via Playwright 1.64.1, development server on a private port, two other QA runs sharing the machine |
| Jira / GitHub | [AQP-179](https://sankumar76.atlassian.net/browse/AQP-179) / [#43](https://github.com/sankumar76/Accucut-Quotation/issues/43) |

## Steps to Reproduce
1. Start the development server on a free port with the invented settings of `playwright.config.ts`.
2. Run `npx playwright test tests/e2e/shell.spec.ts --project=mobile --project=tablet --grep "no wider than the drawer token" --repeat-each=15 --retries=0 --workers=1` (30 runs).

## Expected Result
30 of 30 pass. The drawer is 288 px wide, which is the `--drawer-w` token.

## Actual Result
27 pass, 3 fail (10 percent) with `expect(received).toBeLessThanOrEqual(expected)`, `Expected: <= 288`, `Received: 288.00000381469727` (once) and `288.00000762939453` (twice). In the first full run of the whole suite the same test failed once on `mobile` and passed on the retry; Playwright's one allowed retry hides it.

## Evidence
- `tests/e2e/shell.spec.ts:106`: `expect((await drawer.boundingBox())?.width ?? 0).toBeLessThanOrEqual(drawerWidth);`
- The product value is exact: the computed width is 288 px; only the transformed box read during the slide-in animation carries float noise.
- Run output is kept in the QA session's scratch folder; the failing lines are quoted above.

## Suspected Area
`tests/e2e/shell.spec.ts` line 106. Use a tolerance (for example `<= drawerWidth + 0.5`), read `getComputedStyle(drawer).width`, or wait for the open animation to end before measuring.

## Impact
No product effect. A spurious failure about one run in ten, hidden today by the single retry. It does not hold G7 (Sev-3); the retry means a green CI is not proof that it will not fail on a first attempt.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
