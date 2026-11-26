# DEF-099: SCR-05 words: the delete dialog says "Delete row 1.1?" with only a count (the design names the row and every row under it), and the empty Draft points at a "New item" button that no longer exists (conformance; Product; Sev-2 proposed; Jira AQP-456, GitHub #749)

| Field | Value |
|-------|-------|
| Story / AC | AQP-405 (STORY-CR01.3C, delete), AQP-302; SCR-05 (words); the ux-expert's batch 1, item G and H. The mock-up and spec text quoted below. |
| Severity | **Sev-2 proposed by QA** (the ux-expert's word: Major); **master grades.** |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** Not yet graded by master. |
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
Jira Bug AQP-456 and GitHub issue #749, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
