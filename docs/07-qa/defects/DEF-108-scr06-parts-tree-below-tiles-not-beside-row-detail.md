# DEF-108: SCR-06 the parts tree is a full-width card below the tiles; the design is a 240 to 320 px column beside the row detail (recorded follow-up AQP-319 SQR-10 (1), "not accepted from 1024 px") (conformance; Product; Sev-3; Jira AQP-465, GitHub #759)

| Field | Value |
|-------|-------|
| Story / AC | AQP-319 (STORY-06.02); SCR-06 Estimate review (Lead, Prepared); the ux-expert's batch 2, item P. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 3.** Open. |
| Jira / GitHub | [AQP-465](https://sankumar76.atlassian.net/browse/AQP-465) / [#759](https://github.com/sankumar76/Accucut-Quotation/issues/759) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-108, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
A 240 to 320 px parts-tree column beside the row detail.

## Build (what the ux-expert saw)
The parts tree is a full-width card BELOW the tiles listing every row with its figures.

## Ruling check
**Recorded ruling** (ux-spec 'SCR-06 parts tree (AQP-319 SQR-10 (1); FR-085)'): accepted at 360 and 768 px (a foldable panel); **'not accepted from 1024 px ... a follow-up for the hardening window'**. So this is the recorded follow-up, **a defect, not an accepted deviation**. Related: DEF-109 (the row detail is absent), DEF-113 (SCR-07 has the same tree-column issue).

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** AQP-319 SQR-10 (1) was graded Info in the combined review (`docs/06-reviews/AQP-319/combined.md:85`), so CLAUDE.md section 9 item 3 does not apply; it is a design deviation (DL-416 (2)). Lane 3 with DEF-112.

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

## Records
Jira Bug AQP-465 and GitHub issue #759, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
