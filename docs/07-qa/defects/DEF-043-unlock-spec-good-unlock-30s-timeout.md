# DEF-043: `unlock.spec.ts:134` [mobile] flaky: "a good unlock" hits the 30 s test timeout at its last step (`#calculate-button` not found, line 179); passed on retry; seen once, master push run 44111919914

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.08 (AQP-325) AC-2, AC-3, AC-7, AC-11; same family as AQP-340 (DEF-037) |
| Severity | Sev-3 Moderate |
| Priority | P2 |
| Type | Test (time budget); a product fault is not shown |
| Status | **Open** (Jira To Do, Medium; fix or written acceptance at G8, DL-275 A11) |
| Jira / GitHub | [AQP-346](https://sankumar76.atlassian.net/browse/AQP-346) / [#481](https://github.com/sankumar76/Accucut-Quotation/issues/481) |
| Found by / date | qa-engineer, 2026-11-17; master `29ae4e0` |
| Environment | CI run 44111919914, job 134139533505, shard 2, mobile, 4 workers, test timeout 30 s, expect 15 s |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-346, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Not reproducible on demand. The test approves through the API, unlocks through the dialog (route delayed 800 ms), runs axe, then signs in as the Engineer and loads `/estimates/<code>` expecting `#calculate-button` to read "Calculate" (line 179).

## Expected Result
The test finishes inside 30 s whatever the load.

## Actual Result
`Test timeout of 30000ms exceeded` with the expect still waiting; every earlier assertion passed; the retry passed in 18.4 s; the same test passed at tablet and desktop (about 16 s). The mobile tests of the spec ran up to 2.5x slower in the same run and :186 passed at 30.0 s.

## Suspected Area
`tests/e2e/unlock.spec.ts:134-179`: split the Engineer half (AC-7) from the Lead half, keeping every assertion; do not widen a timeout. If it recurs at normal speed, reopen as a product defect.

## Fix & Verification  _(developer / qa-engineer)_
No fix made. Same pattern as the DEF-053 and watch-list cases.
