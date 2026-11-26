# DEF-105: SCR-03 Lead task queue minor deviations in one list: row action text, subtitle, filter chip and card order, field labels, the browser-links note (conformance; Product; Sev-4; Jira AQP-462, GitHub #755)

| Field | Value |
|-------|-------|
| Story / AC | AQP-298 (STORY-04.02); SCR-03 Task queue (Lead); the ux-expert's batch 1, item N. The mock-up and spec text quoted below. |
| Severity | **Sev-4, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-4 (the ux-expert's word: Minor). |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-4; no lane before the freeze (first update, DL-417).** Open. |
| Jira / GitHub | [AQP-462](https://sankumar76.atlassian.net/browse/AQP-462) / [#755](https://github.com/sankumar76/Accucut-Quotation/issues/755) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-105, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
A pencil icon button as the row action; the subtitle 'All tasks. Filtered to the ones you assigned; remove the filter to see everyone's.'; the chip with a 'Filter:' label; tabs first, then one card; the labels 'Search' and 'Deadline from'; (the ux-expert states no design position for the 'Your browser may block links...' note).

## Build (what the ux-expert saw)
A text button 'Reassign or change deadline'; the subtitle 'All tasks assigned to Engineers.'; the chip without 'Filter:'; the filter card above the tabs; the labels 'Search tasks' and 'Deadline from (IST)'; the note above the table.

## Ruling check
Minor group: one defect, one fix list. No ruling found; master to confirm.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** DL-416 (4): "DEF-105 only if it is cheap inside" the DEF-103 and DEF-104 PR.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-4, no lane before the freeze (first update, DL-417) |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-462 and GitHub issue #755, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
