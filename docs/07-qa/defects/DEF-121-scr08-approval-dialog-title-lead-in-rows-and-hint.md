# DEF-121: SCR-08 the approval dialog lacks the title code, the lead-in, the "Calculated total (BL)" and "Customer" rows and the price hint (conformance; Product; Sev-3; Jira AQP-478, GitHub #772)

| Field | Value |
|-------|-------|
| Story / AC | AQP-323 (STORY-06.06); SCR-08 Approve dialog (desktop); the ux-expert's report, rows C-08-01. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 2.** **Lane moved to lane 3 on 2026-11-27 (the orchestrator's relay: lane 2 is dedicated to DEF-131's edit, three PRs by Wed 2 Dec; the architect's note v1.1, section 6.1); grade, type and proof unchanged.** Open. |
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

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **AC check, 26 Nov: no AC fails; stays Sev-3.** AQP-323 (STORY-06.06) AC-1 names the field "Approved Quote Price (BO)" pre-filled with BL, its validation message and the override info text; the build has those words exactly (`src/lib/estimate/approve-price.ts:19` PRICE_MESSAGE, `src/components/features/estimate-approve/approve-texts.ts:12` PRICE_INFO). The title code, the lead-in, the "Calculated total (BL)" and "Customer" rows and the price hint are in no AC. The fix touches the approval dialog, so the combined review applies (CLAUDE.md section 9 item 2; DL-416 (3)). Lane 2 after DEF-096.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 2; **lane moved to lane 3 on 2026-11-27 (relayed by the orchestrator; master's record not read by QA)** |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-478 and GitHub issue #772, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
