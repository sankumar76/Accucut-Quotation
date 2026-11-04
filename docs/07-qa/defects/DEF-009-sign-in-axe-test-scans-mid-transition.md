# DEF-009: sign-in axe E2E test is flaky: it scans the Sign in button while its colours are still fading

| Field | Value |
|-------|-------|
| Story / AC | AQP-38 (STORY-01.01) / AC-8 |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (flaky; test plan section 7) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-04 |
| Build / commit | `b69a50a` on `feat/AQP-38-sign-in` (PR #62) |
| Environment | CI stage 12 (Chromium, mobile project); reproduced locally on the production build |
| Jira / GitHub | [AQP-184](https://sankumar76.atlassian.net/browse/AQP-184) / [#63](https://github.com/sankumar76/Accucut-Quotation/issues/63) |

## Steps to Reproduce
1. Run `npx playwright test tests/e2e/sign-in.spec.ts --retries=0` on the production build. Repeat it: the failure depends on timing.
2. Test: `sign-in.spec.ts:54` "AC-8: axe finds no violation (WCAG 2.0, 2.1 and 2.2 A and AA), in the default state and with the error shown".

## Expected Result
0 axe violations every time, as the page at rest has.

## Actual Result
CI run 41856930147: the test failed on its first try on the mobile project with `color-contrast` (serious) on `.border-transparent`, the Sign in button, and passed on its retry (reported "1 flaky"). Tablet and desktop passed.

## Evidence
- CI log, stage 12: `"id": "color-contrast", "impact": "serious", "nodes": [".border-transparent"]`, then `(retry #1)` passed.
- QA probe on the production build, reading the button right after the error notice appears: `bg rgb(223, 63, 63)`, `color rgb(242, 243, 243)`, 6 transitions running. Once settled: `bg rgb(222, 48, 48)`, `color rgb(255, 255, 255)`, 0 running.

## Suspected Area
After a failed sign-in the button leaves its loading look (disabled, grey) and returns to primary red. `src/components/ui/button.tsx` gives it `transition-colors`, so the change is a fade. The test calls `expectNoAxeViolations` as soon as the notice appears, so axe can read blended colours mid-fade.

**Fix:** before each axe scan, wait until no CSS transition is running, for example once inside `expectNoAxeViolations` in `tests/e2e/support/design-system.ts`:

```ts
await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
```

Do not rely on the retry and do not raise a timeout. QA's `tests/e2e/aqp-38-qa.spec.ts` already waits this way before its own axe scans.

## Impact
No product effect: WCAG judges the steady state, the fade lasts a fraction of a second, and the colours at rest pass. CI is green only through the retry, which test strategy section 10 counts as a defect of type Test.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
