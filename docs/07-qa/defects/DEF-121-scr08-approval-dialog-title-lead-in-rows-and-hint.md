# DEF-121: SCR-08 the approval dialog lacks the title code, the lead-in, the "Calculated total (BL)" and "Customer" rows and the price hint (conformance; Product; Sev-3 proposed; Jira AQP-478, GitHub #772)

| Field | Value |
|-------|-------|
| Story / AC | AQP-323 (STORY-06.06); SCR-08 Approve dialog (desktop); the ux-expert's report, rows C-08-01. The mock-up and spec text quoted below. |
| Severity | **Sev-3 proposed by QA** (the ux-expert's word: Major); **master grades.** |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** Not yet graded by master. |
| Jira / GitHub | [AQP-478](https://sankumar76.atlassian.net/browse/AQP-478) / [#772](https://github.com/sankumar76/Accucut-Quotation/issues/772) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-121, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 3, report `docs/03-ux/rulings/conformance-check-2026-11-28.md` (records-u fa07bba3); logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data; QA did not run it |
| Environment | the ux-expert's hands-on check at the widths named |

## Design (mock-up and spec)
Title 'Approve and lock <code>'; the lead-in 'Set the Approved Quote Price. After you approve, inputs become read-only and the task moves to Closed.'; the rows 'Calculated total (BL)' and 'Customer'; the hint 'Starts as the calculated total. Edit it to set a different price.'

## Build (what the ux-expert saw)
Title 'Approve and lock'; only the override sentence and the price field.

## Ruling check
No conflicting ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-478 and GitHub issue #772, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
