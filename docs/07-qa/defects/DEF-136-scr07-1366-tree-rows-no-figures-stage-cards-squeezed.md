# DEF-136: SCR-07 at 1366 px: the Parts tree rows run the Sl. No into the name and have no count or figure line; the stage cards are squeezed beside the tree and the box (conformance; Product; Sev-4 proposed; Jira AQP-493, GitHub #814)

| Field | Value |
|-------|-------|
| Story / AC | SCR-07 Cost details (DEF-113, AQP-469, which closes with this difference filed here); the SCR-07 mock-up. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation from the mock-up) |
| Status | **Open (new), 2026-11-27.** **Graded by master 2026-11-27 (DL-446, records-u 1cb3fcbc): Sev-4.** Goes into lane 3's polish PR if cheap; otherwise one G8 line for the delivery lead's explicit acceptance, with the fix in the first update. Owner lane: lane 3 for the polish PR, else the G8 acceptance line. |
| Jira / GitHub | [AQP-493](https://sankumar76.atlassian.net/browse/AQP-493) / [#814](https://github.com/sankumar76/Accucut-Quotation/issues/814) (labels bug, sev-4, ai-delivery, final-review; Jira also aiid-DEF-136, agent-qa-engineer). Relates to DEF-113, DEF-114, DEF-137, AQP-1. Searched first: JQL on `aiid-DEF-136` and a GitHub search for the same words: nothing earlier. |
| Found by / date | The ux-expert's hands-on re-check pass 2 (N-4) (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `d5e352f9`, a throwaway database with invented estimates, scripted Playwright at 1366 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open SCR-07 (Cost details) for a row of a calculated estimate as a Lead, at 1366 px; read the Parts tree rows and the column layout of the box and the six stage cards.

## Expected Result
As the mock-up: the Sl. No and the name separated (the SCR-05 tree's row look); the count and figure line under each row (`2 nos 0.00` in the mock-up), for Lead and Admin only (NFR-002 unchanged); the box above the stages in one wide column.

## Actual Result
The tree's rows run the Sl. No into the name (`1Control cabinet assembly`, `1.1Base frame`) and carry no count or figure line. The box and the six stages sit side by side after the tree, so the stage cards are squeezed to about 360 px and their formulas wrap. Screenshots `w1366\head-scr07.png` (pass 2) and `w1366\mock-SCR-07.png` (pass 1).

## Binding and proof (proposed)
The three points read as the mock-up at 1366; the existing assertions kept; axe clean; first load stated against 193,500 B; the ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-493 and GitHub issue #814, created 2026-11-27 and cross-linked. Related: DEF-113, DEF-114, DEF-137, AQP-1; the ux-expert's pass 2 (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); test plan 0.3.102.
