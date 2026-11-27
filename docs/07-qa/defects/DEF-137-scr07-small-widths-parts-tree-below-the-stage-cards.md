# DEF-137: SCR-07 at 360 and 768 px: the Parts tree is a foldable panel at the foot of the page, after the six stage cards; SCR-06 puts it above (conformance; Product; Sev-4 proposed; Jira AQP-494, GitHub #815)

| Field | Value |
|-------|-------|
| Story / AC | SCR-07 Cost details (DEF-113, AQP-469, which closes with this difference filed here); the SCR-06 layout below 1024 px. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
| Jira / GitHub | [AQP-494](https://sankumar76.atlassian.net/browse/AQP-494) / [#815](https://github.com/sankumar76/Accucut-Quotation/issues/815) (labels bug, sev-4, ai-delivery, final-review; Jira also aiid-DEF-137, agent-qa-engineer). Relates to DEF-113, DEF-136, AQP-1. Searched first: JQL on `aiid-DEF-137` and a GitHub search for the same words: nothing earlier. |
| Found by / date | The ux-expert's hands-on re-check pass 2 (N-5) (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `d5e352f9`, a throwaway database with invented estimates, scripted Playwright at 360 and 768 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open SCR-07 for a row of a calculated estimate as a Lead at 360 or 768 px; find the Parts tree panel.

## Expected Result
Below 1024 px the foldable Parts tree sits above the stage cards, as on SCR-06.

## Actual Result
The Parts tree is a foldable panel at the foot of the page, after the six stage cards (about 3,100 px down at 768). Screenshot `w768\head-scr07.png` (no tree in view).

## Binding and proof (proposed)
At 360 and 768 the tree panel is above the stage cards; the existing assertions kept; axe clean; first load stated against 193,500 B; the ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-494 and GitHub issue #815, created 2026-11-27 and cross-linked. Related: DEF-113, DEF-136, AQP-1; the ux-expert's pass 2 (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); test plan 0.3.102.
