# DEF-094: SCR-05 the "+" menu opens as a floating popover above the row, covering the tree head and the form; the design is in line under its row (conformance; Product; Sev-3; Jira AQP-451, GitHub #744)

| Field | Value |
|-------|-------|
| Story / AC | AQP-405 (STORY-CR01.3C, the '+' menu); SCR-05 (all widths); the ux-expert's batch 1, item B. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 and the CI of `master` `c30b349f`): Closed now.** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 3.** Open. **Update 2026-11-26 (batch 3, row C-05-02):** the same fault also shows **at 360 px inside the parts-tree drawer**: the '+' menu floats over the rows (ux-expert, Major); the fix covers every width and the drawer. |
| Jira / GitHub | [AQP-451](https://sankumar76.atlassian.net/browse/AQP-451) / [#744](https://github.com/sankumar76/Accucut-Quotation/issues/744) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-094, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
The '+' menu is in line under its row 'so the panel never clips it' (spec row 3).

## Build (what the ux-expert saw)
It opens as a floating popover above the row, covering the tree head and the form.

## Ruling check
A separate fault from DEF-092 (the wording of the Part item); lane 3 owns `add-node-menu-panel.tsx` for DEF-092 and should be told. No conflicting ruling found; master to confirm.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Goes into the DEF-092 PR (#742, `add-node-menu-panel.tsx`) so the two do not conflict (DL-414 (2)). C-05-02 (the "+" menu at 360 px) is folded in.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 3 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 1 on `c30b349f` (`hands-on-recheck-1-2026-11-27.md`) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 1 on `c30b349f` and its CI; closed |

## Verified and closed (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. Conforms at 360, 768 and 1366: the '+' menu is in line (`position: static`) inside the tree column, under its row and its toolbar, and covers neither the tree head nor the form; header 'Add under 1.1 Base frame'; items 'Sub-part' (hint 'A part is already here, so both are called "Sub-part"') and 'Fastener' (hint 'A bought-out item, same inputs as a part'): DEF-092's wording is in as well.
**CI, read by QA on the same push** (`c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`): 0 failed, 1 flaky (`estimate-warning.spec.ts:117` [tablet], unrelated, test plan 0.3.95); the E2E and unit cases of the fix are in the suite and passed; no DEF-085 miss and no interception line.
The menu's place is re-read against the no-shift toolbar ruling (TS-14: the menu opens in line under its row; pressing outside closes it and does nothing else).
**Not covered by this closure (all defects of this pass):** the Indian digit grouping of the figures (the conformance report's open check), drag reorder, the unsaved-changes dialog, Picture too large, and an accessibility scan were not part of the pass; the final regression's keyboard, screen-reader and axe checks remain.

## Records
Jira Bug AQP-451 and GitHub issue #744, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
