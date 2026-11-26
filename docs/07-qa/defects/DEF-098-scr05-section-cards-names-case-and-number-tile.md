# DEF-098: SCR-05 section cards: the design has a green number tile and the range tag and "4 of 4" on one line; the build has a plain number and "4 of 4 complete" on its own line (the SPEC 7.1 section names are right) (conformance; Product; Sev-3; Jira AQP-455, GitHub #748)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (all widths); the ux-expert's batch 1, item F. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master (DL-414, DL-416); QA's AC-check raise to Sev-2 (0.3.68) is WITHDRAWN (master, DL-418 (1)):** the AC it rested on is itself the drift from SPEC 7.1. Sev-3 stays for the card layout only. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-2; lane 1.** Open. |
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
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-455 and GitHub issue #748, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
