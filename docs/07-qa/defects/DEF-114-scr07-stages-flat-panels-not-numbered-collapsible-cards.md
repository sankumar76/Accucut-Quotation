# DEF-114: SCR-07 the six stages are flat panels; the design is numbered collapsible cards with the stage total at the right, lettered line items, mono formulas and capital sub-headings (conformance; Product; Sev-3; Jira AQP-475, GitHub #765)

| Field | Value |
|-------|-------|
| Story / AC | AQP-320 (STORY-06.03); SCR-07 Cost details (Lead); the ux-expert's batch 2, item V. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major/Minor). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **REOPENED at Sev-4 on 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 of `master` `c30b349f`): the fix (PR #780, `a6eb9809`) is in and mostly right, but the stage number tile is squeezed to a sliver about 8 px wide and its digit is clipped.** Jira AQP-475 is back To Do (it had closed on the merge), priority Low, label `sev-4`; GitHub #765 reopened, label `sev-4`. Proposed grade Sev-4 (the ux-expert's word: Minor); master grades. Earlier: **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 3.** Open. |
| Jira / GitHub | [AQP-475](https://sankumar76.atlassian.net/browse/AQP-475) / [#765](https://github.com/sankumar76/Accucut-Quotation/issues/765) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-114, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
Numbered collapsible cards '1 . Weights and areas' with the stage total at the right and a chevron; line items with a letter tile, a bold name, a mono formula and the substituted formula; capital sub-headings (CUTTING, BENDING, WELDING, DRILLING AND TAPPING).

## Build (what the ux-expert saw)
Flat panels '1. Weights & Areas' with 'Stage total: ...'.

## Ruling check
No conflicting ruling found.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Lane 3 after SCR-06 (DL-416 (5)).

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 3 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Reopened: the stage number tile (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. **Present and right:** six numbered collapsible cards, the stage total at the right (for example `13,29,112.90`), a chevron, line items with a letter tile, a bold name, the formula and the substituted formula in mono, capital sub-headings (`CUTTING`), the input rows shown as references (`I`), stage 1 open and the others closed at 360, all open at 768 and 1366 as ruled. **The fault:** the stage **number tile is squeezed to a sliver about 8 px wide and the digit is clipped**, so each card head reads as a black blob before '1 · Weights & Areas'; the mock-up's tile is a 28 px rounded square with a clear '1'. **Every stage head, every width.** Screenshot: `w1366-stage-summary.png` (zoomed), `w768\scr07-top.png`, mock-up `w1366\mock-SCR-07.png` in the ux-expert's scratch folder (may be cleared by a reboot).
**Proof for the fix (proposed):** the tile is 28 px square at three widths with the digit fully visible (a computed-size and bounding-box assertion on the tile, and a screenshot read by the ux-expert); the existing assertions kept; axe clean; first load stated against 193,500 B (CSS only); the ux-expert's hands-on check repeated.

## Records
Jira Bug AQP-475 and GitHub issue #765, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
