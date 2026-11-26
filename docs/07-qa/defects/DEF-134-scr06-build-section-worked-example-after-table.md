# DEF-134: SCR-06 'How the total is built': the worked example and the rounding sentence come after the table; the mock-up puts the example between the explanation and the table (conformance; Product; Sev-4 proposed; Jira AQP-491, GitHub #809)

| Field | Value |
|-------|-------|
| Story / AC | SCR-06 (the cost review), 'How the total is built' (STORY-06.x; DEF-112, AQP-468, which closes with this difference filed here); the SCR-06 mock-up. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation from the mock-up) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
| Jira / GitHub | [AQP-491](https://sankumar76.atlassian.net/browse/AQP-491) / [#809](https://github.com/sankumar76/Accucut-Quotation/issues/809) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-134, agent-qa-engineer). Relates to DEF-112, DEF-135, AQP-1. Searched first: JQL on `aiid-DEF-134` and 'worked example': nothing. |
| Found by / date | The ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `c30b349f`, a throwaway database with invented estimates, scripted Playwright at 360, 768 and 1366 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open a calculated estimate as a Lead, press 'Show' on 'How the total is built'.

## Expected Result
The mock-up's order: the explanation, the **worked example** (24 + 6 + 0 = 30), the table (Sl. No, Part, QTY per Assy, BG, ending 'Total (the sum of the BG column)'); the owner reads `SCR-06.html` and the ux-spec for the exact place of the rounding sentence.

## Actual Result
The worked example and the rounding sentence come **after** the table, at all widths. Screenshot `w768\scr06-build-open.png` (the ux-expert's scratch folder).

## Binding and proof (proposed)
The section reads in the mock-up's order at three widths; the existing assertions kept; axe clean; first load stated against 193,500 B (text only); the ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-491 and GitHub issue #809, created 2026-11-27 and cross-linked. Related: DEF-112 (AQP-468, #763), DEF-135, the ux-expert's pass 1 (N-2); test plan 0.3.97.
