# DEF-118: SCR-17 Fields and formulas: header buttons "Checkpoints" and "Insert field" and the configuration-version note are missing; Kind and Section are plain text; row actions and the Formula column differ (conformance; Product; Sev-3 proposed; Jira AQP-473, GitHub #769)

| Field | Value |
|-------|-------|
| Story / AC | AQP-337 (STORY-08.01), AQP-360 (STORY-08.05), AQP-359; SCR-17 Fields and formulas (Admin); the ux-expert's batch 2, item AC. The mock-up and spec text quoted below. |
| Severity | **Sev-3 proposed by QA** (the ux-expert's word: Major); **master grades.** |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** Not yet graded by master. |
| Jira / GitHub | [AQP-473](https://sankumar76.atlassian.net/browse/AQP-473) / [#769](https://github.com/sankumar76/Accucut-Quotation/issues/769) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-118, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
Header buttons 'Checkpoints' and 'Insert field'; the note 'Configuration version 9, 67 columns, A to BO.'; 'Part Details' and Auto / Input pills with icons; icon buttons + and bin; the Formula column reading 'From tree position', 'Material-Considered for E' on auto rows.

## Build (what the ux-expert saw)
The header buttons and the note are missing; the description differs; Kind and Section are plain text ('Section 1: Part Details', 'Input', 'Auto'); the row actions are text buttons 'Insert after' and 'Delete'; the Formula column reads 'No formula' on auto rows.

## Ruling check
**The ux-expert asks whether Insert field is reachable from this page at all** (the build has 'Insert after' on a row; QA did not check). No conflicting ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-473 and GitHub issue #769, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
