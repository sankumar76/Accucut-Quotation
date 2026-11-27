# DEF-095: SCR-05 header has no breadcrumb "My tasks / Q-..."; the H1 is the bare code; the design is "Estimate <code>" with a Draft badge, a subtitle and the due pill (conformance; Product; Sev-3; Jira AQP-452, GitHub #745)

| Field | Value |
|-------|-------|
| Story / AC | AQP-301 (STORY-05.01), AQP-388 (CR-01 item 1); SCR-05 (all widths); the ux-expert's batch 1, item C. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 2 and the CI of `master` `69ba8d98` / `d5e352f9`): DEF-095 closes on the ux-expert's pass 2 (breadcrumb `My tasks / <code>`, H1 `Estimate <code>` with the `Draft` badge, the subtitle, the due pill at 360 and 1366; 768 read in text only).** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 1.** Open. |
| Jira / GitHub | [AQP-452](https://sankumar76.atlassian.net/browse/AQP-452) / [#745](https://github.com/sankumar76/Accucut-Quotation/issues/745) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-095, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Breadcrumb 'My tasks / Q-...'; H1 'Estimate <code>' with the Draft badge on one line; subtitle '<title> . Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals.'; the due pill beneath it on phone.

## Build (what the ux-expert saw)
No breadcrumb; the H1 is the bare code.

## Ruling check
No conflicting ruling found.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Shared page head with DEF-110 and DEF-113 (the C-G-03 pattern): one fix (DL-416 (5)).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 1 |
| Fixed | developer | 2026-11-27 | PR #789 (AQP-452), squash `69ba8d98`: one shared page head for SCR-05, SCR-06 and SCR-07 (`page-head`) |
| Regression test added | developer | 2026-11-27 | `page-head.test.ts` (17 tests), `cost-details-head.test.ts` (6), `cost-details-tree.test.ts` (5), `estimate-review-architecture.test.ts` (23, with the new case), and the E2E changes in `cost-details`, `estimate-review`, `estimate-customer`, `estimate-save` and about ten other specs for the new head |
| CI proof read by QA (the push `69ba8d98`: CI 45888716522 RED in shard 4 for a DEF-129 case unrelated to the head; Windows package 45888716486 `success`) | qa-engineer | 2026-11-27 | `Stages 1 to 11b` `success` (530 and 705 files); the four unit files above passed; the changed E2E specs passed attempt 1 at all three widths (`cost-details` 10, `estimate-review` 10 to 11, `estimate-customer` 9, `estimate-save` 12, `cancel-approval` 9, `unlock` 7, `mark-quoted` 9, `remove-price` 9, `review-download` 8, `export-refusal` 3, `ignore-restore` 16, `lead-warning` 13, `rates-changed` 4, `estimate-cleared` 8 cases per width); `estimate-customer.spec.ts` (the two cases that had failed on #789's earlier PR runs) passes; `/estimates/[code]` first load **192,128 B** gzip (1,372 B under the 193,500 B ceiling; #789 is -163 B against `master`'s 192,291 B); the push's red is `estimate-tree-plus-menu.spec.ts:64` (DEF-129), not the head; test plan 0.3.98. **The ux-expert's hands-on check (pass 2) is still due before QA verifies and closes it.** |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 2 on `master` `d5e352f9` (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 2 and the CI proof above; closed |

## Records
Jira Bug AQP-452 and GitHub issue #745, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
