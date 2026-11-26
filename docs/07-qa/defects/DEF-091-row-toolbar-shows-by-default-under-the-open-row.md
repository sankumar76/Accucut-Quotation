# DEF-091: the row toolbar (move, +, -) shows by default under the open (last added) row; the delivery lead expects hover, focus-within, or the selected row on touch (may conflict with DL-377 item 8) (Product; Sev-3 proposed; Jira AQP-448, GitHub #739)

| Field | Value |
|-------|-------|
| Story / AC | Found in the delivery lead's demo of master e3dc5b0b (26 Nov). Stories: AQP-405 (STORY-CR01.3C), AQP-424 (DEF-081, item 8), AQP-418 (DEF-075), AQP-419 (DEF-076). |
| Severity | **Sev-3, type Product (master, DL-409 (A), (C)).** (Proposed at filing by the orchestrator: Sev-3.) |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`) |
| Type | **Product.** |
| Status | **Open, ruled (DL-409, DL-410, DL-411, DL-413), 2026-11-26.** Fix in lane 2 (owns `estimate-tree.spec.ts`). Not yet built or proved. |
| Jira / GitHub | [AQP-448](https://sankumar76.atlassian.net/browse/AQP-448) / [#739](https://github.com/sankumar76/Accucut-Quotation/issues/739) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-091, agent-qa-engineer). Relates to AQP-1 and the stories above. Searched first: JQL on `aiid-DEF-091` and the title words, and a GitHub search: nothing. |
| Found by / date | The delivery lead, in the demo at master e3dc5b0b (26 Nov 2026), relayed by the orchestrator; read and logged by qa-engineer, 2026-11-26 |
| Build / commit | `master` `e3dc5b0b` (code read with `git show origin/master:<path>`; no browser run by QA) |
| Environment | The delivery lead's demo copy of master (not the CI) |

## Steps to Reproduce
Open an estimate with several rows on the estimate screen (SCR-05) and read the tree as in "What" below.

## Expected Result
(Delivery lead) The toolbar under the row, shown on hover, focus-within, or the selected row on touch.

## Actual Result
Shown by default under the open row (the last added row after an add).

## What
The row toolbar (move dots, '+', '-') is shown by default under the last added row. The delivery lead expects it only on hover, on focus-within, or on the selected row on touch; the toolbar's place under the row (item 8) stays.

## Evidence (code read, not run; no secrets or personal data)
- `src/components/features/estimate-workspace/row-actions.tsx` (`HIDDEN_UNTIL_NEEDED`): the toolbar is clipped (`sr-only`) except while a press holds it (`data-hold`), **on the open row (`aria-current=true`)**, on keyboard focus within the row (`:focus-visible`) and while its menu is open. **A newly added row becomes the open row, so its toolbar shows under it; that is the build as designed.** The code comment says there is no hover look and no touch variant.
- **DL-377 (2) item 8** (the delivery lead's decision, 24 Nov, relayed): keep the build: the row toolbar stays in line under the name of the open or focused row; no floating toolbar (reason DEF-075 and DEF-076). The ux-expert's ruling (`docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, item 8): 'Under the name, on the open row and on a row with keyboard focus, no hover reveal'. **So what the delivery lead reports now matches that decision for a mouse user.** The rule they expect (hover, focus-within, the selected row on touch) is the older ux-spec row 3 rule, which item 8 replaced.

## Suspected Area (leads, not findings; the architect and developer decide)
QA's reading: a change of DL-377 (2) item 8, not a build defect. Master and the ux-expert rule whether it is a defect, a change request (which reopens DEF-075 and DEF-076's reason: a hover toolbar covers a row's name and takes the press at 288 to 320 px), or a refinement (for example hide the toolbar on the open row until hovered or focused, and keep it in view on the open row on touch). The design reference is coming from the ux-expert.

## Proof (proposed; master rules)
To be set with the ruling; any change keeps the DEF-075 and DEF-076 behaviours (a press on a name is a press on the row; a keyboard-revealed toolbar does not collapse on mouse-down) and the touch 44 px targets.

## Ruling (master; 2026-11-26; recorded by QA from DL-409 to DL-413, read on records-u 02f10cd4)
- **The delivery lead's refinement of DL-377 (2) item 8, recorded as their decision (DL-409 (2) (C)):** the row toolbar (+, - and the move handle) stays **under** the row and is shown only for the hovered, keyboard-focused or selected row (with touch, the selected row), **never by default under the last added or opened row.** The keyboard route must reveal it (focus within the row), so SC 2.1.1 and 2.4.7 stay met. This supersedes QA's reading that the open-row behaviour was the decision of record; the conflict QA flagged with DL-377 (2) item 8 is resolved by their refinement.
- **The design (ux ruling item 3; DL-411 (1), DL-413).** With a mouse: the toolbar shows on the hovered row and on a row holding keyboard focus, **never because a row is open or was just added**; showing it adds its line under the row and moves the rows below down, with no animation (the accepted layout, item 8, DEF-075; the hover-delay and 'select only' options were withdrawn as questions, D1, DL-411 (2)). With touch: on the selected row only. After a mouse add no toolbar is in view; after a keyboard add the toolbar is in view by focus (ux checks TB-4 and TB-5). The 'open row' cause is withdrawn for the mouse and kept for touch and keyboard focus (DL-413; AQP-405 AC-1 and AC-7 amended by the product-owner). The mouse-add `:focus-visible` suppression is part of the build.
- **Must keep:** the DEF-075 and DEF-076 behaviours (a press on a name is a press on the row; a keyboard-revealed toolbar does not collapse on mouse-down) and the touch 44 px targets.
- **Proof (QA's reading, to be confirmed on the PR):** the ux ruling's checks TB-1 to TB-6 as written; no toolbar in view after a mouse add; the toolbar in view on the hovered row, on keyboard focus within a row, and on the selected row with touch, at three widths.
- Cut-offs (DL-370 (E)): start by the end of Mon 30 Nov, merge by the end of Wed 2 Dec; every fix is test-first, with E2E at three widths for what the delivery lead saw, every existing assertion kept; lanes: lane 1 DEF-089 and DEF-090, lane 2 DEF-091, lane 3 DEF-092; merge order lane 3, then lane 2, then lane 1 (DL-410 (1)). The delivery lead's instruction that the build works as designed (DL-409 (1)) applies.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled (type, grade, route) | master | 2026-11-26 | DL-409 to DL-413 |
| Design reference | ux-expert, solution-architect | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-448 and GitHub issue #739, created 2026-11-26 and cross-linked. Related: AQP-1; the neighbours DEF-089 to DEF-092 were filed together from the same demo (AQP-446, AQP-447, AQP-448, AQP-449); DL-377 (item 8); DEF-081 (AQP-424), DEF-075, DEF-076; test plan 0.3.64. Detail and evidence are read from `origin/master` e3dc5b0b (code read, not run); QA ran no browser for this record. Master's and the architect's causes and the ux-expert's design reference follow on the Jira Bug.
