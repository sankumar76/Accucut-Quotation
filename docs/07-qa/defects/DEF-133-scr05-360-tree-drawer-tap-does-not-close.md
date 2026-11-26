# DEF-133: SCR-05 at 360 px, tapping a row in the Parts tree drawer selects it but does not close the drawer; the 26 Nov ruling says the tap closes it and shows the form (conformance; Product; Sev-3 proposed; Jira AQP-490, GitHub #808)

| Field | Value |
|-------|-------|
| Story / AC | The 26 Nov parts-tree ruling (`rulings/parts-tree-scr05-conformance-2026-11-26.md`, item 3, point 7: 'tapping the row closes the drawer and shows the form') and the SCR-05 spec ('Sheet (tree on phones)'); DEF-101 (AQP-458) is the neighbour. |
| Severity | **Sev-3 Moderate, proposed by QA (the ux-expert's word: Major); master grades.** |
| Priority | P3 (Jira Medium; labels `sev-3`, `final-review`, `conformance`). The orchestrator's last start for these fixes is the end of Mon 30 Nov. |
| Type | **Product** (conformance deviation of the running build from the ruling) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
| Jira / GitHub | [AQP-490](https://sankumar76.atlassian.net/browse/AQP-490) / [#808](https://github.com/sankumar76/Accucut-Quotation/issues/808) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-133, agent-qa-engineer). Relates to DEF-101, DEF-129, AQP-1. Searched first: JQL on `aiid-DEF-133` and 'drawer': nothing. |
| Found by / date | The ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `c30b349f`, a throwaway database with invented estimates, scripted Playwright at 360, 768 and 1366 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
1. At **360 px** open an estimate as an Engineer with a Draft holding several rows (touch, the Parts tree drawer).
2. Open the Parts tree and tap a row.

## Expected Result
The drawer closes and the tapped row's form shows (the 26 Nov ruling, item 3 point 7); Enter on the row's link keeps working.

## Actual Result
The row is selected (the form follows) but **the drawer stays open**; the person must close it (X or Escape) to see the form. The ux-expert drove it with Playwright's `tap()` (touch events and a click with `detail` 1) and believes a real finger does the same. Screenshot `w360\p-after-choose.png` (the ux-expert's scratch folder, may be cleared by a reboot).

## Evidence
- The ux-expert's pass 1 (above). **Lead (not a finding):** `parts-tree-area.tsx` closes the drawer only from `onOpen`, which `TreeNode` calls for Enter on the link, not for a press ('A press with a mouse or a finger only chooses the row').
- QA ran nothing.

## Binding and proof (proposed; master and the ux-expert set it)
1. A 360 px E2E at a coarse pointer: tap a row in the drawer: the drawer closes, that row's form shows, the Parts tree button names the row; Enter on the link still works.
2. The existing cases kept; axe at 360 px with the drawer open and closed; `/estimates/[code]` first load stated against **193,500 B** (PRD 0.65).
3. **Read with DEF-129:** on touch the selected row shows the toolbar in its 48 px slot (TS-8); a tap that selects and closes the drawer must not leave the toolbar unreachable or press anything.
4. The ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-490 and GitHub issue #808, created 2026-11-27 and cross-linked. Related: DEF-101 (AQP-458, #751), DEF-129 (AQP-486), the 26 Nov parts-tree ruling, the ux-expert's pass 1 (`hands-on-recheck-1-2026-11-27.md`, N-1); test plan 0.3.97.
