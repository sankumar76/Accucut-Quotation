# DEF-113: SCR-07 Cost details: no breadcrumb, no description, no parts-tree column, no "Cost details for one row" heading and no "This row, on screen and in the Excel row" box (conformance; Product; Sev-3; Jira AQP-469, GitHub #764)

| Field | Value |
|-------|-------|
| Story / AC | AQP-320 (STORY-06.03); SCR-07 Cost details (Lead); the ux-expert's batch 2, item U. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 1.** Open. |
| Jira / GitHub | [AQP-469](https://sankumar76.atlassian.net/browse/AQP-469) / [#764](https://github.com/sankumar76/Accucut-Quotation/issues/764) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-113, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
Breadcrumb 'Task queue / Q-... / Cost details 1.4'; the description 'Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.'; a Parts tree column; the heading 'Cost details for one row / 1.4 . Top cover'; the box 'This row, on screen and in the Excel row'.

## Build (what the ux-expert saw)
None of these; a one-line strip 'Part 1 Control cabinet assembly'; a tile 'Unit Production Price BG' with '4 nos for the whole order, already included in the price'.

## Ruling check
The same tree-column issue as DEF-108. No conflicting ruling found.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Shared page head with DEF-095 and DEF-110 (the C-G-03 pattern): one fix.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 1 |
| Fixed | developer | 2026-11-27 | PR #789 (AQP-452), squash `69ba8d98`: one shared page head for SCR-05, SCR-06 and SCR-07 (`page-head`) |
| Regression test added | developer | 2026-11-27 | `page-head.test.ts` (17 tests), `cost-details-head.test.ts` (6), `cost-details-tree.test.ts` (5), `estimate-review-architecture.test.ts` (23, with the new case), and the E2E changes in `cost-details`, `estimate-review`, `estimate-customer`, `estimate-save` and about ten other specs for the new head |
| CI proof read by QA (the push `69ba8d98`: CI 45888716522 RED in shard 4 for a DEF-129 case unrelated to the head; Windows package 45888716486 `success`) | qa-engineer | 2026-11-27 | `Stages 1 to 11b` `success` (530 and 705 files); the four unit files above passed; the changed E2E specs passed attempt 1 at all three widths (`cost-details` 10, `estimate-review` 10 to 11, `estimate-customer` 9, `estimate-save` 12, `cancel-approval` 9, `unlock` 7, `mark-quoted` 9, `remove-price` 9, `review-download` 8, `export-refusal` 3, `ignore-restore` 16, `lead-warning` 13, `rates-changed` 4, `estimate-cleared` 8 cases per width); `estimate-customer.spec.ts` (the two cases that had failed on #789's earlier PR runs) passes; `/estimates/[code]` first load **192,128 B** gzip (1,372 B under the 193,500 B ceiling; #789 is -163 B against `master`'s 192,291 B); the push's red is `estimate-tree-plus-menu.spec.ts:64` (DEF-129), not the head; test plan 0.3.98. **The ux-expert's hands-on check (pass 2) is still due before QA verifies and closes it.** |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-469 and GitHub issue #764, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
