# DEF-098: SCR-05 section cards use title case, short names and a plain number; the design is sentence case, the SPEC 7.1 names, a green number tile and the range tag on one line (conformance; Product; Sev-3 proposed; Jira AQP-455, GitHub #748)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (all widths); the ux-expert's batch 1, item F. The mock-up and spec text quoted below. |
| Severity | **Sev-3 proposed by QA** (the ux-expert's word: Major); **master grades.** |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** Not yet graded by master. |
| Jira / GitHub | [AQP-455](https://sankumar76.atlassian.net/browse/AQP-455) / [#748](https://github.com/sankumar76/Accucut-Quotation/issues/748) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-098, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Sentence case; the SPEC 7.1 names ('Part details', 'Welding, drilling and tapping', 'Surface treatment', 'Other costs and remarks'); a green number tile; the range tag and '4 of 4' on one line.

## Build (what the ux-expert saw)
Title case with short names ('01 Part Details', '03 Cutting Process', '06 Welding', '07 Surface Treatment', '08 Other Costs and Remarks'); a plain number; '4 of 4 complete' on its own line.

## Ruling check
No conflicting ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-455 and GitHub issue #748, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
