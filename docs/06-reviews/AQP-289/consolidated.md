# Consolidated review: AQP-289 (DEF-035, Sev-2: Process "No match" title wraps a long search), PR #361

| Field | Value |
|---|---|
| Defect | DEF-035, Jira AQP-289 (In Review), GitHub #123 |
| PR / head | #361 at b7fbad8 (`fix/AQP-289-empty-state-title-wrap`, base `master` b6b38c5) |
| Route | DL-196: reviewer-quality (with plant) and reviewer-standards |
| CI (G5) | 43268411939, 5 of 5. Against `master` push run 43261705805: unit 3,207 (+7), all levels 5,571 (+7), E2E 825 (+3: the new test at three widths), skipped 24 (+0) |
| Plant | #362 (d7e3349, run 43270642734, closed unmerged): heading class removed. 6 of 7 new unit tests red (the 7th checks styles, green by design); `materials.spec.ts:327` and five `aqp-122-qa.spec.ts:368` cases red at three widths; the new SCR-11 test red at mobile and tablet, **green at desktop**; nothing else red |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 3 | 0 | `standards.md`, Jira 11749 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 1 | 1 | 2 | `quality.md`, review 5879225685, Jira 11750 |
| **Total** | | **0** | **0** | **1** | **4** | **2** | |

STD-02 (the unnamed `10` at `process-master.spec.ts:341`) is settled by QLT-01's proposed fix, which replaces that line.

## Findings (sorted by severity)

| ID | Severity | Where | Finding | Proposed fix / owner |
|---|---|---|---|---|
| QLT-01 | **Major** | `tests/e2e/process-master.spec.ts:341` | The 100-character `abcdefghij` search fits the desktop content area unwrapped, so at 1366 px the new test passes without the fix; the PR and DL-196 (10)(c)/(d) count that width as covered | Developer (test only): search with `'W'.repeat(LONG_SEARCH_LENGTH)` and assert the title wrapped (height over 1.5 line heights); re-run the same plant, which must then be red at all three widths |
| QLT-02 | Minor | `process-master.spec.ts:349` | No axe scan in the new test, unlike `materials.spec.ts:327`; no CI test runs axe on the SCR-11 "No match" state | Developer: add `expectNoAxeViolations` |
| STD-01 | Minor | `break-long-names.ts:1-4`, `master-texts.ts:10` (anchored at `states.tsx:77`) | Comments still say only `Notice` wraps by itself; they should also name `EmptyState` titles | Developer: comment-only |
| STD-02 | Minor | `process-master.spec.ts:341` | Unnamed `10` | Settled by QLT-01's fix |
| STD-03 | Minor | `empty-state-wraps-long-names.test.ts:55` | Bare `100` in `'x'.repeat(100)` | Developer: name the constant |
| QLT-03 | Info | DL-196 (10)(c) | 1024 px is not a CI width, so QA checks it at G7; the search box has no maximum length, so the "maximum" clause does not apply | qa-engineer at G7 |
| QLT-04 | Info | `states.tsx` | The rule sits on the shared heading, so no caller can drop it | None (good) |

## For master (G6)

- 0 Blocker, 0 Critical, 1 Major (test only, specified to the line), the same pattern as AQP-142's QLT-10 (DL-197).
- The fix head is verified by re-running the plant: the new SCR-11 test must be red at 360, 768 and 1366 px.
