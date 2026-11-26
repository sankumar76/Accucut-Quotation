# DEF-100: SCR-05 form minor deviations in one list: unit addons missing, badge order, "Auto" tags, hint wording, Surface treatments control, left nav "Home" and footer (conformance; Product; Sev-4 proposed; Jira AQP-457, GitHub #750)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (form, every signed-in page nav); the ux-expert's batch 1, item I. The mock-up and spec text quoted below. |
| Severity | **Sev-4 proposed by QA** (the ux-expert's word: Minor); **master grades.** |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** Not yet graded by master. |
| Jira / GitHub | [AQP-457](https://sankumar76.atlassian.net/browse/AQP-457) / [#750](https://github.com/sankumar76/Accucut-Quotation/issues/750) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-100, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Unit addons (mm on Length, Width, Thickness, Cutting Length; nos on QTY per Assy, No. of Bend, Weld, Fasteners Qty; holes on Drilling, Tapping, CSK; Rs / pc on Fasteners Cost); the label, then the column-letter badge; 'Auto' tags on Sl. No and Material Considered; the hint wording of the mock-up (including 'From the Material Master.', 'Enter 0 if this part has no tooling.', 'Enter moves to the next field; Shift+Enter starts a new line.'); the Surface treatments control: label 'Surface treatments Z to AG', chips 'Primer AA = 1', hint 'Selected = 1, not selected = 0. You can select none.'; the left nav without 'Home', My tasks highlighted, and a 'Version 1.0 / (c) Accucut Lasers Pvt Ltd' footer.

## Build (what the ux-expert saw)
Unit addons missing (`prisma/seed/config/seed-config.ts` seeds only kg and sec); the badge sits before the label; Sl. No shows '1' without 'Auto' and Material Considered without 'Auto'; hints use 'Not applicable' in single quotes without the full stop, the Material hint lacks 'From the Material Master.', Tool Cost reads 'Enter 0 if there is none.', the Remarks hint lacks the Enter / Shift+Enter sentence; the Surface treatments control reads 'None selected' with the hint 'Choose every treatment this part needs. Choose none if it needs none.'; an extra 'Home' nav item, My tasks not highlighted, no footer (**applies to every signed-in page**).

## Ruling check
Minor group: one defect, one fix list. The unit addons may merit Sev-3 (master).

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
Jira Bug AQP-457 and GitHub issue #750, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
