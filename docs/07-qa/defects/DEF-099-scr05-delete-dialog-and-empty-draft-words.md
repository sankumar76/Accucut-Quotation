# DEF-099: SCR-05 words: the delete dialog says "Delete row 1.1?" with only a count (the design names the row and every row under it), and the empty Draft points at a "New item" button that no longer exists (conformance; Product; Sev-2; Jira AQP-456, GitHub #749)

| Field | Value |
|-------|-------|
| Story / AC | AQP-405 (STORY-CR01.3C, delete), AQP-302; SCR-05 (words); the ux-expert's batch 1, item G and H. The mock-up and spec text quoted below. |
| Severity | **Sev-2, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-2 (the ux-expert's word: Major). |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 and the CI of `master` `c30b349f`): Closed now (Sev-2 cleared).** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-2; lane 1.** Open. |
| Jira / GitHub | [AQP-456](https://sankumar76.atlassian.net/browse/AQP-456) / [#749](https://github.com/sankumar76/Accucut-Quotation/issues/749) (labels bug, sev-2, ai-delivery, final-review, conformance; Jira also aiid-DEF-099, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
[G] 'Delete 1.1 Base frame?' / 'This also deletes the 3 rows under it (1.1.1 Corner gusset, 1.1.2 Cross brace, 1.1.3 Hex bolt set M6) and everything entered for them. The remaining parts are renumbered. This cannot be undone.' (the 'Delete 4 rows' button is right). [H] The empty Draft's text points at 'Add main assembly'.

## Build (what the ux-expert saw)
[G] 'Delete row 1.1?' with only a count. [H] (0 rows) 'Choose a part in the tree to fill in its form, or add the first one with "New item".' **No 'New item' exists any more.**

## Ruling check
Copy-only, one fix (the screen's text constants), so one defect. Spec row 3: the dialog names the row and every row under it; QA proposes Sev-2 for that (an AC of the delete fails, workaround: look at the tree). The names depend on DEF-089 (rows read 'Part').

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Sev-2: the delete AC fails (spec row 3) with a workaround, and a text that points at a control that does not exist is false every time it shows (the DL-168 standard). Copy only; depends on DEF-089 for the row names. Lane 1 after DEF-089 and DEF-090 (DL-414 (3)).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-2, lane 1 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 1 on `c30b349f` (`hands-on-recheck-1-2026-11-27.md`) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 1 on `c30b349f` and its CI; closed |

## Verified and closed (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. Conforms at 360, 768 and 1366: the dialog title 'Delete 1.1 Base frame?'; 'This also deletes the 3 rows under it (1.1.1 Corner gusset, 1.1.2 Cross brace, 1.1.3 Fastener) and everything entered for them. The remaining parts are renumbered. This cannot be undone.'; buttons 'Keep it' (holds focus) and 'Delete 4 rows'; the empty Draft says 'Choose a part in the tree to fill in its form, or add the first one with "Add main assembly".' and the tree shows 'Add main assembly'.
**CI, read by QA on the same push** (`c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`): 0 failed, 1 flaky (`estimate-warning.spec.ts:117` [tablet], unrelated, test plan 0.3.95); the E2E and unit cases of the fix are in the suite and passed; no DEF-085 miss and no interception line.
**Not covered by this closure (all defects of this pass):** the Indian digit grouping of the figures (the conformance report's open check), drag reorder, the unsaved-changes dialog, Picture too large, and an accessibility scan were not part of the pass; the final regression's keyboard, screen-reader and axe checks remain.

## Records
Jira Bug AQP-456 and GitHub issue #749, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
