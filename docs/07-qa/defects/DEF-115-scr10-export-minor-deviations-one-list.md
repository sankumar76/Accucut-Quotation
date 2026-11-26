# DEF-115: SCR-10 Excel export (Lead) minor deviations in one list: breadcrumb, intro, card heading and labels, the file-name rule line, kind icons and indentation in the rows table (conformance; Product; Sev-4; Jira AQP-470, GitHub #766)

| Field | Value |
|-------|-------|
| Story / AC | AQP-331 (STORY-07.01); SCR-10 Excel export (Lead); the ux-expert's batch 2, item W. The mock-up and spec text quoted below. |
| Severity | **Sev-4, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-4 (the ux-expert's word: Minor). |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-4; no lane before the freeze (first update, DL-417).** Open. |
| Jira / GitHub | [AQP-470](https://sankumar76.atlassian.net/browse/AQP-470) / [#766](https://github.com/sankumar76/Accucut-Quotation/issues/766) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-115, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
A breadcrumb; the intro 'Download this estimate as an .xlsx file that follows the worksheet layout. The file is available once a calculation is current.'; the card heading 'File' with 'Rows: 1 header row, then one row per part in tree order (12 rows), then one empty row and the Total Tool Cost row', 'Columns: A to BO, in the worksheet's order and widths' and the file-name rule line 'Customer Short Name _ Subject _ download date (DD-MM-YYYY, IST)'; kind icons and indentation by level in the rows table.

## Build (what the ux-expert saw)
No breadcrumb (a button 'Back to the estimate'); no intro; the card headed 'The file' with labels 'File name / Rows in the file / Columns' and values '12 parts', 'A to BO'; no kind icons and no indentation.

## Ruling check
Minor group, one fix list. No conflicting ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-4, no lane before the freeze (first update, DL-417) |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-470 and GitHub issue #766, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
