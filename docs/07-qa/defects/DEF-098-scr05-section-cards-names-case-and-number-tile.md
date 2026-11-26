# DEF-098: SCR-05 section cards: the design has a green number tile and the range tag and "4 of 4" on one line; the build has a plain number and "4 of 4 complete" on its own line (the SPEC 7.1 section names are right) (conformance; Product; Sev-3; Jira AQP-455, GitHub #748)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (all widths); the ux-expert's batch 1, item F. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master (DL-414, DL-416); QA's AC-check raise to Sev-2 (0.3.68) is WITHDRAWN (master, DL-418 (1)):** the AC it rested on is itself the drift from SPEC 7.1. Sev-3 stays for the card layout only. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 and the CI of `master` `c30b349f`): Closed now (Sev-2 cleared); the incomplete-section tile is a question for the product-owner, kept for the final regression.** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-2; lane 1.** Open. |
| Jira / GitHub | [AQP-455](https://sankumar76.atlassian.net/browse/AQP-455) / [#748](https://github.com/sankumar76/Accucut-Quotation/issues/748) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-098, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
A green number tile; the range tag and '4 of 4' on one line. (The section names and their case follow SPEC 7.1, which governs: DL-418 (1).)

## Build (what the ux-expert saw)
A plain number; '4 of 4 complete' on its own line. The names ('01 Part Details', '03 Cutting Process', '06 Welding', '07 Surface Treatment', '08 Other Costs and Remarks') are the SPEC 7.1 names and are right.

## Ruling check
No conflicting ruling found.

**Ruling 2026-11-26 (master, DL-418 (1)):** SPEC 7.1 governs the section names, so the build is right on names and the names part of this defect is not a defect. The product-owner amends AQP-303 AC-1 and AQP-304 AC-1 to the SPEC names; the ux-expert amends ux-spec :637 and the mock-up (G8-C-UX05). QA's AC-check (test plan 0.3.68) had found that SPEC 7.1 itself says 'Part Details', 'Cutting Process' and 'Welding' (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` lines 260, 273, 279), which the build shows. The Sev-2 raise is withdrawn; DEF-098 is Sev-3 for the card layout only.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-2, lane 1 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 1 on `c30b349f` (`hands-on-recheck-1-2026-11-27.md`) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 1 on `c30b349f` and its CI; closed |

## Verified and closed (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. Conforms at 1366 and 360 (768 seen in the stacked layout only): the number tile, the name (SPEC 7.1), the range tag and '4 of 4' on one line, the tile green when the section is complete. **Noted by the ux-expert, not a deviation:** at 360 a section that is not complete has a black tile and '3 of 4'; the mock-up draws only the complete (green) state.
**CI, read by QA on the same push** (`c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`): 0 failed, 1 flaky (`estimate-warning.spec.ts:117` [tablet], unrelated, test plan 0.3.95); the E2E and unit cases of the fix are in the suite and passed; no DEF-085 miss and no interception line.
**QA's decision: closed now (a Sev-2 conformance item).** The incomplete-section tile is a **question for the product-owner** (is a black tile with '3 of 4' the intended incomplete state?); it is **not filed as a defect**; the final regression reads it at 360 px and records the product-owner's answer if one comes.
**Not covered by this closure (all defects of this pass):** the Indian digit grouping of the figures (the conformance report's open check), drag reorder, the unsaved-changes dialog, Picture too large, and an accessibility scan were not part of the pass; the final regression's keyboard, screen-reader and axe checks remain.

## Records
Jira Bug AQP-455 and GitHub issue #748, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
