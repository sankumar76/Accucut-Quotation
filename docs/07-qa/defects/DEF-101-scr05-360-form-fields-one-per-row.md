# DEF-101: SCR-05 at 360 px the form fields are one per row (design: two per row, compact) and the tree button reads "Parts tree, part 1" (design "Parts tree 1.1 Base frame" with the branch icon) (conformance; Product; Sev-3; Jira AQP-458, GitHub #751)

| Field | Value |
|-------|-------|
| Story / AC | AQP-388 (CR-01 item 1), AQP-303, AQP-304; SCR-05 (360 px); the ux-expert's batch 1, item J. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 and the CI of `master` `c30b349f`): Closed now; DEF-133 filed.** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 1.** Open. |
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
| Fixed | developer | 2026-11-27 | PR #791, squash `c30b349f` (form fields two to a row at 360 px; the tree button reads 'Parts tree 1.1 Base frame': `tree-button-label.tsx`, `parts-tree-area.tsx`, `estimate-workspace.tsx`) |
| Regression test added | developer | 2026-11-27 | `compact-layout.spec.ts` (a card with two fields or more flows them in at least two columns at every width, 360 px included), `estimate-tree.spec.ts` (the button's name `/^Parts tree 1/`), `tree-button-label.test.ts` (4 tests), `parts-tree-card.test.ts` (26) |
| CI proof read by QA (the push `c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`) | qa-engineer | 2026-11-27 | the `compact-layout.spec.ts` cases `:60`, `:126`, `:135` and `:162` passed at all three widths on attempt 1; `estimate-tree.spec.ts:901` and `:1065` and `estimate-tree-names.spec.ts:52` passed; the two new unit files passed; `/estimates/[code]` first load **192,291 B** gzip (209 B under the 192,500 B ceiling then in force; #791 added 129 B to the 192,162 B of `d2b58f04`; **the ceiling was then raised to 193,500 B by PRD 0.65, time-limited to G8, so the headroom is 1,209 B**); the push's one flaky (`estimate-warning.spec.ts:117` [tablet]) is unrelated; test plan 0.3.95 |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 1 on `c30b349f` (`hands-on-recheck-1-2026-11-27.md`) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 1 on `c30b349f` and its CI; closed |

## Verified and closed (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. Conforms at 360: the tree button reads 'Parts tree' with the branch icon and the open row at the right ('1.1 Base frame'); fields sit two to a row (Sl. No with Part No.; Description with Treatment / Color; Material in Drawing with Material Considered; Length with Width; and so on); a field is alone only where it is wide by design.
**CI, read by QA on the same push** (`c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`): 0 failed, 1 flaky (`estimate-warning.spec.ts:117` [tablet], unrelated, test plan 0.3.95); the E2E and unit cases of the fix are in the suite and passed; no DEF-085 miss and no interception line.
**A new finding at the same width, filed separately:** DEF-133 (AQP-490, #808), tapping a tree row in the 360 px drawer selects it but does not close the drawer.
**Not covered by this closure (all defects of this pass):** the Indian digit grouping of the figures (the conformance report's open check), drag reorder, the unsaved-changes dialog, Picture too large, and an accessibility scan were not part of the pass; the final regression's keyboard, screen-reader and axe checks remain.

## Records
Jira Bug AQP-458 and GitHub issue #751, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
