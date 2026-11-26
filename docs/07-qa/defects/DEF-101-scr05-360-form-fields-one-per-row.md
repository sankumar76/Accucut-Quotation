# DEF-101: SCR-05 at 360 px the form fields are one per row (design: two per row, compact) and the tree button reads "Parts tree, part 1" (design "Parts tree 1.1 Base frame" with the branch icon) (conformance; Product; Sev-3; Jira AQP-458, GitHub #751)

| Field | Value |
|-------|-------|
| Story / AC | AQP-388 (CR-01 item 1), AQP-303, AQP-304; SCR-05 (360 px); the ux-expert's batch 1, item J. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 1.** Open. |
| Jira / GitHub | [AQP-458](https://sankumar76.atlassian.net/browse/AQP-458) / [#751](https://github.com/sankumar76/Accucut-Quotation/issues/751) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-101, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Two fields per row (compact); the button 'Parts tree 1.1 Base frame' with the branch icon.

## Build (what the ux-expert saw)
One field per row; the button 'Parts tree, part 1'.

## Ruling check
The compact 360 layout is CR-01 item 1, scheduled before G8: **not an accepted deviation**. The button's name follows DEF-089.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Last of lane 1's SCR-05 group (DL-416 (5)).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 1 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-458 and GitHub issue #751, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
