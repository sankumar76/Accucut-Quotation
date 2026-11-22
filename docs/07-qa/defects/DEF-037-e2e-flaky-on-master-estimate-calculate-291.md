# DEF-037: E2E flaky on master: `estimate-calculate.spec.ts:291` (AC-9 axe, blocked and submitted states) times out at 30 s; also `estimate-fasteners:113`, `estimate-picture:169`, `export:63` and `:80`

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.09 and others (several specs); RISK-031 (DL-229) |
| Severity | Sev-2 Major (as graded in Jira; the cause is a time budget, not a product fault) |
| Priority | P2, first in the one available lane (DL-229) |
| Type | Test |
| Status | **Closed** (Jira Done, DL-232 (6), DL-234, 2026-11-17). Fixed by PR #459 (part 1, `643f56d8`) and PR #464 (part 2, `a2d4fa60`); proof runs on `master` 44090409641 and 44095996581, 0 flaky |
| Jira / GitHub | [AQP-340](https://sankumar76.atlassian.net/browse/AQP-340) / no mirror issue found by QA |
| Found by / date | CI, 2026-11-17; master push run 43998662056 on `dc2f98e` red; docs-only PR #456 run 44021818197 red |
| Environment | GitHub Actions ubuntu-latest, Stage 12 E2E, Chromium three widths |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-340, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Run Stage 12 on master or any PR; `estimate-calculate.spec.ts:291` fails on tablet at 30 s (`page.evaluate`), the retry too. The web-server log shows `Error: aborted` in the same windows (compare DEF-036).

## Expected Result
Each spec passes deterministically at all three widths.

## Actual Result
Timeouts that depend on runner load; a docs-only change fails CI.

## Suspected Area
The E2E specs named above and `tests/e2e/support/`. No quarantine, skip, extra retry or blanket timeout increase (DL-229).

## Fix & Verification  _(developer / qa-engineer)_
See status. `estimate-fasteners:113` wrong stored value was split to DEF-038 (AQP-341). Re-open on a red Stage 12 on a `master` push run in the time-out mode (RISK-031).
