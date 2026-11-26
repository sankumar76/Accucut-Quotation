# DEF-135: SCR-06 'How the total is built' table: the Part column omits the kind ('Main Assembly: ', 'Sub-Assembly: ', 'Sub-part: ') that the mock-up shows before the name (conformance; Product; Sev-4 proposed; Jira AQP-492, GitHub #810)

| Field | Value |
|-------|-------|
| Story / AC | SCR-06 'How the total is built' (DEF-112, AQP-468, which closes with this difference filed here); the SCR-06 mock-up; the row-name rules of DEF-089 and the Sub-part wording of DEF-092. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation from the mock-up) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
| Jira / GitHub | [AQP-492](https://sankumar76.atlassian.net/browse/AQP-492) / [#810](https://github.com/sankumar76/Accucut-Quotation/issues/810) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-135, agent-qa-engineer). Relates to DEF-112, DEF-134, DEF-089, DEF-092, AQP-1. Searched first: JQL on `aiid-DEF-135`: nothing. |
| Found by / date | The ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `c30b349f`, a throwaway database with invented estimates, scripted Playwright at 360, 768 and 1366 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open a calculated estimate as a Lead, press 'Show' on 'How the total is built', read the Part column.

## Expected Result
`<Kind>: <name>` as the mock-up (`Main Assembly: Control cabinet assembly`), the kind names as the tree names them (Main Assembly, Sub-Assembly, Part, Sub-part, Fastener; Sub-part is the label of a Part with a Part sibling); a row with no name reads the kind's own name once; names by the DEF-089 row-name rules; Lead and Admin only (NFR-002 unchanged).

## Actual Result
The Part column shows the name only, at all widths. Screenshot `w768\scr06-build-open.png`.

## Binding and proof (proposed)
The column reads as the mock-up at three widths for a five-kind tree; an unnamed row reads once; the existing assertions kept; axe clean; first load stated against 193,500 B (text only); the ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-492 and GitHub issue #810, created 2026-11-27 and cross-linked. Related: DEF-112 (AQP-468, #763), DEF-134, DEF-089, DEF-092, the ux-expert's pass 1 (N-3); test plan 0.3.97.
