# DEF-109: SCR-06 the row detail panel and the Lead's input form are absent although STORY-06.04 (AQP-321) is Done (to be confirmed) (conformance; closed, accepted deviation; Jira AQP-474, GitHub #760)

| Field | Value |
|-------|-------|
| Story / AC | AQP-321 (STORY-06.04, Done), AQP-319; SCR-06 Estimate review (Lead, Prepared); the ux-expert's batch 2, item Q. The mock-up and spec text quoted below. |
| Severity | **Not a defect (master, DL-414 (2) / DL-416 (2)); closed.** QA had proposed Sev-2. |
| Priority | none (closed) |
| Type | **Not a defect** (accepted deviation) |
| Status | **Closed 2026-11-26 (qa-engineer), accepted by DL-306 (known gap G8-C-FR064).** |
| Jira / GitHub | [AQP-474](https://sankumar76.atlassian.net/browse/AQP-474) / [#760](https://github.com/sankumar76/Accucut-Quotation/issues/760) (labels bug, sev-2, closed; ai-delivery, final-review, conformance; Jira also aiid-DEF-109, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
A row detail panel and the Lead's input form: heading 'Inputs', 'You can correct inputs. Any change clears every calculated figure; press Recalculate to see them again.', sections 01 to 08, a 'View cost details' button, and the box 'This row, on screen and in the Excel row'.

## Build (what the ux-expert saw)
Absent.

## Ruling check
**Closed as an accepted deviation, 2026-11-26 (master, DL-416 (2)).** DL-306 (the delivery lead, 22 Nov, OQ-PM-14 option (b)): "The Lead or Admin edit part of FR-064 is waived until after G8 ... No Lead or Admin edit entry is built on SCR-06 before G8, and the gap is listed as known in the release notes" (G8-C-FR064, met by DL-315). Master read the code on `origin/master`: a Lead or Admin gets `renderReview` (`estimates/[code]/page.tsx:54-58`), which has no part form, while `canEditInputs` lets a Lead edit a PREPARED estimate on the server. That is the known gap DL-306 accepted. QA's open point (STORY-06.04 AQP-321 Done in Jira) is answered: that story did not carry the Lead edit form. The gap stays on the release-notes list of known gaps.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-416 (2): accepted deviation (DL-306) |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | 2026-11-26 | Closed: accepted by DL-306 (known gap G8-C-FR064). |

## Records
Jira Bug AQP-474 and GitHub issue #760, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
