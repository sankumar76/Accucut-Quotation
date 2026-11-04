# Review Report — AQP-184 (DEF-009) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...fix/AQP-184-axe-wait` (PR #65) |
| Commit reviewed | d6a441f44e2ded82a4caa9eaa0b992d7f0fc7525 |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The fix removes the cause of DEF-009 instead of hiding it. `expectNoAxeViolations` now waits on the browser's own `Animation.finished` for every running or pending animation with a finite end, so axe judges settled colours. It adds no timeout and no retry. Infinite and paused animations are skipped, which is safer than the defect record's suggestion (that would hang on the design-system spinner and shimmer). Chained transitions are handled by querying again. The probe page and its control prove the wait matters, and so does the developer's fail-first run. One Minor: test 1 has its own load-sensitive assertion.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff and callers | `git show d6a441f`, `git grep expectNoAxeViolations` | 4 product specs use the helper (`sign-in`, `design-system`, `shell`, `aqp-38-qa`) plus the new spec |
| E2E | not run locally (needs servers and the database; shared PC) | CI run 41866502689 green, 170 E2E passed |
| Fail-first | developer's record | test 4 fails with `color-contrast` at both widths when the wait is removed |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-39 | Minor | `tests/e2e/axe-helper.spec.ts:57-59` | Test strategy §10, DL-057 | The "before" colour is read in a second `evaluate`; if more than 2 s pass after the transition starts, `jump-end` has already reached black and the assertion fails. The header's "slow machines can only make it pass" does not hold for this test. | A false failure under load, the class DEF-003, DEF-007 and DEF-009 remove. | Read the start colour inside the same `evaluate` that starts the transition, or skip the "before" check when the transition is no longer running. |
| QLT-40 | Info | `tests/e2e/support/design-system.ts:73-87` | Test strategy §10 | Waits until the test timeout on an endless chain of finite animations or on a "running" animation that cannot advance (`playbackRate = 0`); neither exists today. A transition starting after the wait returns is not seen (inherent). Finite exit animations are now scanned at their end state. | A hang would show only as a plain test timeout. | Wrap the call in `test.step('wait for animations to finish', …)`; add one sentence on exit animations. |
| QLT-41 | Info | `tests/e2e/axe-helper.spec.ts` (test 5) | Test adequacy | The control can skip on every project on a runner where one axe scan takes more than 2 s, and CI would not show it. | The proof that the wait matters could disappear silently. | Confirm in the CI 41866502689 report that test 5 passed, not skipped, on each project; lengthen the transition if skips appear. |

## Reviewer-specific tables
**Quality: acceptance of DEF-009**

| Requirement (defect record) | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| Every axe scan judges the steady state, not a mid-fade blend | `waitForAnimationsToFinish` called first in `expectNoAxeViolations` | `axe-helper.spec.ts` tests 1 and 4; control test 5; developer fail-first | Met |
| No raised timeout, no reliance on retry | waits on `Animation.finished`; no timeout or retry of its own | code reading | Met |
| Must not hang on the spinner or shimmer | infinite and paused animations skipped | test 2 (a spinner keeps running afterwards) | Met |
| Nothing to wait for returns at once | loop exits when the filtered list is empty | test 3 | Met |

**Questions from the brief**
- **Hang:** not on current pages; theoretical cases in QLT-40.
- **Skipping a finite animation:** none found. The delay phase counts as running; finite iterations give a finite `endTime`; `getAnimations()` flushes style; shadow trees are included.
- **Chained animations:** handled by querying again after each settled batch; cancelled or replaced ones reject `finished`, which counts as ended.
- **Control proves the wait matters:** yes, when it runs (QLT-41).
- **Interaction with AQP-183 pressed-state fades:** compatible. The 150 ms post-release fade, `sheet-in` and `fade-in` are finite and waited for, so the settled colours are judged. The infinite spinner and shimmer are skipped. Reduced motion makes all of them 0 s. A held press is a steady state.

## Previous Findings (re-review only)
n/a (first quality review of this PR).
