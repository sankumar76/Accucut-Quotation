# DEF-075: the parts tree's row toolbar (invisible until hover, but it takes the press) covers the middle of a row in the 288 px side panel from 1024 px; with 3D's move handle (#656) a press at the centre of a Part row lands on the handle and not on the row (GitHub #655; type Product, layout)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.3C (AQP-405, the row actions "+" and "-" that float over the end of the row, UX spec section 0.9 row 3) and STORY-CR01.3D (AQP-406, the move handle, PR #656). **No AC is shown to fail:** every action stays reachable (keyboard, the open row, a press on the visible toolbar). It is a layout defect that makes a press where the person sees a row's name land on a hidden control |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, on master's DL-346 (B); test plan section 6: "a layout defect at one width that leaves every action reachable"). Grade evidence below; **regrade to Sev-2 (a G8 blocker) if a browser measurement shows the "+" of a Part or Sub-part row (the Fastener add, at once, no confirmation) under the centre of a row** |
| Priority | P3 (Jira Medium, label `sev-3`). Sev-3 is fixed before G8 or accepted in writing by master (section 6). Lane: the next free lane after the current queue (DL-346 (3)); ux-expert sets the design first. #656 may merge first (DL-346 (C)) |
| Type | **Product (layout)** (master, DL-346 (B)) |
| Status | **Open** (logged 2026-11-23). No design, no fix PR. Not a G8 blocker as graded |
| Jira / GitHub | [AQP-418](https://sankumar76.atlassian.net/browse/AQP-418) / [#655](https://github.com/sankumar76/Accucut-Quotation/issues/655) (the follow-up issue, converted: relabelled `bug`, `sev-3`, retitled; not duplicated). Jira "relates to" AQP-1 (Intake), AQP-406 (3D) and AQP-405 (3C, which introduced the floating "+" and "-"). Labels `ai-delivery`, `aiid-DEF-075`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-075 was free (no file, no Jira label or summary, no GitHub issue) |
| Found by / date | The developer of 3D, found while running the tree E2E locally (Playwright's default centre click hit the handle); graded by qa-engineer 2026-11-23 |
| Build / commit | `master` **87719a6e** (3C: two buttons) and PR #656 head **e1726a37** (3D: three buttons; QA read the branch as `pr656`, 53896145 at the fetch) |
| Environment | Fine pointer, 1024 px and wider (the side panel), `next dev`; invented data only. Read from the code; **not measured in a browser** (no local E2E, CLAUDE.md section 9 item 5) |

## Steps to Reproduce
1. Open an estimate as a person who may change inputs (Engineer on a Draft, Lead or Admin on a Draft or Prepared estimate) on a screen at least 1024 px wide with a mouse, so the tree is the 288 px side panel.
2. On #656's build, move the mouse to the middle of the row of a Part (for example "1.1.1") and press. Expected: the row is chosen. Actual: the press lands on the move handle (opacity 0 until hover, but it takes the press), and the row is not chosen. The E2E presses at the start of the name for this reason (`choose` in `tests/e2e/estimate-tree.spec.ts`, `{ position: { x: 16, y: 10 } }`).

## Expected Result
A press on a row's name chooses the row; the row's buttons appear on hover without covering what the person is pressing on.

## Actual Result
The toolbar slot (`TOOLBAR_SLOT` in `src/components/shared/parts-tree-list.tsx:92-96` on `master`: `absolute inset-y-0 right-0 flex items-center opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-has-[[aria-current=true]]/row:opacity-100 pointer-coarse:static ...`) has no `pointer-events-none`, so while it is invisible it still takes the press. On a coarse pointer it is in line and only on the open row, so there is no overlap there.

## Evidence (code read; the geometry is computed from the CSS values, not measured)
**Inputs:** the panel is `lg:w-(--tree-w)` = **288 px** at every width from 1024 px (`parts-tree-area.tsx:107`, `globals.css` `--tree-w: 288px`); the row's link (`TreeNode`, the element the E2E's `part()` clicks) is `flex` inside `min-w-0 flex-1`, so it spans from the arrow cell (44 px, `w-(--control-h)`) to the panel's right edge; each nested level indents 25 px (`ml-s-5` 24 px plus a 1 px guide); the toolbar is `flex items-center rounded-md border` with 36 px buttons (`--control-h-row`, from 1024 px with a fine pointer) plus a 1 px border each side, anchored at the right edge.

| Row | Toolbar on `master` 87719a6e | Toolbar on #656 e1726a37 |
|---|---|---|
| Main Assembly, Sub-Assembly, Part (has a "+") | `[+][-]`, 74 px, x = 214 to 288: "+" 215 to 251, "-" 251 to 287 | `[handle][+][-]`, 110 px, x = 178 to 288: **handle 179 to 215**, "+" 215 to 251, "-" 251 to 287 |
| Fastener (no "+") | `[-]`, 38 px: "-" 251 to 287 | `[handle][-]`, 74 px: handle 215 to 251, "-" 251 to 287 |

**Centre of the row's link** (what Playwright's default click presses): level 1 **166**, level 2 **178.5**, level 3 **191**, level 4 **203.5** (levels 1 to 4 are what the kinds allow: Main Assembly > Sub-Assembly > Part > Fastener).
- **On `master`:** every centre (166 to 203.5) is left of the toolbar's left edge (214), so a centre press chooses the row. No overlap at the centre.
- **On #656:** a Main Assembly row at level 1 (166) is clear. A Sub-Assembly or a Part at level 2 (178.5) is on the toolbar's left border (a press that does nothing). **A Part at level 3 (191) is on the handle** (179 to 215): the press opens the handle's menu or starts a drag, and the row is not chosen. A Fastener row (no "+") at level 4 (203.5) is left of its toolbar (214): clear. This matches the developer's finding.
- **The "+" and "-" are at the same x (215 to 287) on both versions**: 3D widened the toolbar to the left by the handle's 36 px; it did not move them. **No centre press (166 to 203.5) reaches a "+".** A "+" (a Part's adds a Fastener at once, with no confirmation, 3C `addActionOf`) is pressed only by a press on the 36 px at x = 215 to 251 (the "+" button, second from the right edge of the row), where the toolbar is already visible on hover before the press (the 3C design: it "floats over the end of the row on hover").

## Grade (test plan section 6, master's reading in DL-346 (3))
Master's test: "if a centre press on a short Part or Sub-part row at 1366 px can add a Fastener, that is an unintended change to stored inputs and points to Sev-2; if only the handle or the '-' can be hit, Sev-3". **QA's reading: only the handle can be hit by a centre press (and only on #656); the "+" cannot (the centre is at most x = 203.5, the "+" starts at 215); the "-" starts at 251 and opens its confirmation.** The handle's press opens a menu (nothing changes). Every action stays reachable (Tab reaches the toolbar, the open row shows it, a press on the visible toolbar works). **Sev-3** (a layout defect at one width range, from 1024 px, that leaves every action reachable), type Product, not a G8 blocker; section 6: fixed before G8 or accepted in writing by master. **Residual, stated:** (a) the geometry is read from the code, not measured: the 36 px buttons assume a fine pointer from 1024 px (the 44 px buttons are on a coarse pointer, where there is no overlap); (b) a stray press in the "+" zone (x = 215 to 251 of a Part row) does add a Fastener at once, and on a Prepared estimate a structure change raises `inputs_revision` and clears the figures (`tree-actions.ts`, FR-100): that is the 3C design and not what #655 reports, but the fix's design (ux-expert) may want to cover it; (c) QA regrades to Sev-2 if a browser measurement puts the "+" under a centre press.

## Fix route (master, DL-346 (3))
1. **ux-expert** decides the design before the fix (reserve the toolbar's width in the row, place it under the name on a narrow panel, or stop presses while it is hidden, for example `pointer-events-none` until the toolbar shows) and states the rule in the UX spec. The words and layout are theirs.
2. **A product fix in its own PR:** `parts-tree-list.tsx` and any row component it needs. `choose` in `estimate-tree.spec.ts` goes back to a plain click on the row in the same PR.
3. **Proof (DL-346 (3)):** an E2E press at the centre of a short row's name, in the 1366 px side panel, selects the row and opens no menu, dialog or add, at the widths where the toolbar floats. The case is added in the fix PR; the test-count freeze binds defect-fix PRs until DEF-057's observer is ruled (T4, 26 Nov), so before that ruling the check goes into an existing tree case instead. QA proposes that the check also presses at the centre of a Part row at level 3 (the case that lands on the handle on #656). **Lane:** the next free lane after the current queue; if it were Sev-2 it would go ahead of non-blocker work.
4. **Until the fix:** #656's `choose` helper carries a comment naming this Bug and the PR body says the same (DL-346 (C) (a), (b)).

## Suspected Area (optional)
`src/components/shared/parts-tree-list.tsx` `TOOLBAR_SLOT` (absolute toolbar over the row's end, no `pointer-events-none` while hidden) and the width of `RowActions` (`row-actions.tsx`, three buttons on #656).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Design | ux-expert | | not started |
| Fixed | developer (own PR) | | |
| Regression test added | developer (an existing tree case, or a new one after the freeze) | | |
| Verified | qa-engineer | | not started |

## For master
None open. If a browser measurement is wanted before the fix (to confirm the centre of a Part row on #656 and that no centre press reaches the "+"), QA asks for a CI step-line probe in the fix PR rather than a local run.
