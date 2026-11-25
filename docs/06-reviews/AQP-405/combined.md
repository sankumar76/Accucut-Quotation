# Combined security-and-quality review: AQP-405 (CR-01 item 3C "Parts tree row actions")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/625 |
| Head reviewed | `142e8ca1` on `feat/AQP-405-tree-row-actions` (master `5db39609` merged in, with 3A #621 and 3B #623), plus the test-only follow-up `28cfd8e5` (one E2E file, +2 / -2, read in full). Diff `git diff origin/master...142e8ca1`: 20 files, +642 / -170. Source: 13 files (4 new: `tree-actions.ts`, `row-actions.tsx`, `add-node-menu.tsx`, `add-node-menu-panel.tsx`, `add-node-trigger.tsx`; `tree-add.ts` removed). Tests: 7 files (2 new unit files, `tree-add.test.ts` removed, 4 E2E specs changed). **No server file, route, schema or migration changed** |
| CI | **Run 45040022983 on `142e8ca1`: failed.** "Stages 1 to 11b" passed (lint, type-check, 469 + 628 unit and security files, 10,403 + 15,856 tests, integration, changed-code coverage 100.0 % (8 of 8 lines), JS budget). E2E shard 3 passed; shards 1 and 2 failed on one case, `estimate-tree.spec.ts:564` "AC-9: the screen" at [mobile] and [tablet] (544 passed, 1 failed, 1 skipped on shard 1); shard 4 was cancelled. That is QLT-01, which I had predicted from the code before the run ended. **Run 45041853021 on `28cfd8e5`: still running when this review was closed** (pause requested by the delivery lead). The verdict on the code stands; the merge still needs that run fully green |
| First load | `PASS /estimates/[code] gzip 185,710 B, limit 200,000, headroom 14,290 B` (run 45040022983). 3B left 14,938 B, so 3C adds **648 B**, and the headroom stays above the 10,000 B line (AC-9, ADR-016). The Radix `DropdownMenu` is behind a bare `import()` (`add-node-menu.tsx:27`); the PR body still says "not measured yet" and should be updated with these figures |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2, label `critical-review`), because a row delete can lose data (master DL-302 (b), orchestrator comment 12718). Trace: SPEC §14.30, §14.33, §14.35; architecture v0.62 §4.12 e and g; ADR-020; DL-300 ruling 1, DL-302, DL-303; UX spec §0.9 row 3 |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-22 |
| **Verdict** | **APPROVE WITH COMMENTS** on the code at `142e8ca1` + `28cfd8e5`. Merge only when run 45041853021 (or a later run on the merge head) is fully green. **No open Blocker, Critical or Major.** The one Blocker, QLT-01 (a red E2E case at two widths), was a test fault and is fixed by `28cfd8e5`; I read that change and it does not weaken the test. **Delete cannot remove rows the person did not see.** The "−" is bound to its own row's ID, the dialog names that row and the count under it, and the request goes to the unchanged guarded route. That route checks the estimate lock, `assertEditable`, the row's revision, the count and the subtree fingerprint, and deletes and renumbers in one transaction, scoped to this estimate's rows. **The "+" offers exactly `ALLOWED_CHILDREN`**, the table the server also checks (`placeForAdd`, 422 `NODE_KIND_NOT_ALLOWED`), so no rule lives only in the browser. The 8 Minor findings are focus and visibility details, two thin unit seams, and one dead function that its tests describe wrongly |
| Counts | Blocker 1 (QLT-01, fixed in `28cfd8e5`, CI pending) · Critical 0 · Major 0 · Minor 7 · Info 5. **Open at Blocker, Critical or Major: 0** |

## How I read it

- **Records:** Jira AQP-405 (AC-1 to AC-10, Dev Context, Testing Notes, risks; comments 12718, 12728, 12743). The PR #625 body (Dev Record, decisions). From `origin/docs/AQP-1-records-u`: architecture v0.62 §4.12 e, f and g; decision log DL-300, DL-302, DL-303 and DL-304. UX spec §0.9 row 3 (master). `docs/standards/coding-standards.md` §1, §3 and §6.
- **Code read at the head** (PR worktree `aqp-403`, clean at `142e8ca1`): every changed source file in full. Also these direct callers and callees: `estimate-workspace.tsx` (`editable`, `guardedTree`), `parts-tree-area.tsx` (drawer, `open`), `tree-panel.tsx` (`focusTree`, the delete dialog), `delete-part-dialog.tsx`, `use-first-open.ts`, `tree-moves.ts` (`partsRemoved`, `deleteGuardOf`), `can-edit-inputs.ts`, `state-machine.ts` (statuses on this head: DRAFT, SUBMITTED, APPROVED), and `estimate-service.ts` (`lockForChange`, `assertEditable`, `placeForAdd`, `addPart`, `moveNode`, `deleteNode`). The Playwright projects in `playwright.config.ts` (mobile and tablet have `hasTouch: true`, and `compact-layout.spec.ts:118` shows this makes `(pointer: coarse)` match).
- **Server tests read (unchanged here, they carry the server half of the ACs):** `tests/integration/estimates/tree.test.ts` (delete with count 3, 409 on a wrong count, 409 on a same-count different set, 409 on a typed-into sub-part, another estimate's part is 404, a submitted estimate is 409 for the Engineer), `node-kinds.test.ts` (all 20 parent and kind pairs on real tables), and `cleared.test.ts` (every Lead writer clears the figures, FR-100).
- **Run by me:**
  - (a) `vitest run` on `tree-actions`, `tree-row-actions`, `parts-tree-markup`, `tree-moves` and `estimate/state-machine` at `142e8ca1`: **5 files, 96 passed**.
  - (b) **Planted faults** in a `git archive` copy of `142e8ca1` in my scratchpad, never in a checkout, against the three tree unit files (45 tests):

| # | Fault planted | Unit result | Caught elsewhere |
|---|---|---|---|
| P1 | The "−" opens the delete of the row's **parent** (`onDelete(part.parentId ?? part.id)`) | **Survived** (45 of 45 passed) | E2E `AQP-405 AC-4` (desktop only: the dialog would be named "Delete row 1?", not "1.1"). QLT-06 |
| P2 | The "+" menu offers all three kinds under a Sub-Assembly and a Part | Caught (5 failed) | — |
| P3 | The row toolbar is drawn whatever `editable` says | Caught (1 failed) | — |
| P4 | The at-once "+" adds the Fastener under the row's **parent** | **Survived** (45 of 45 passed) | E2E `AQP-405 AC-1` (Sl. No `1.1.2`, not `1.1.1.1`). QLT-06 |

  - I did not run E2E or integration locally (§9 item 5: heavy browser tests in CI). CI is the evidence for those.

## AC conformance

| AC | Code | Tests | Result |
|---|---|---|---|
| AC-1 "+" menu offers only `ALLOWED_CHILDREN` | `tree-actions.ts:24-29` (`addActionOf` reads `ALLOWED_CHILDREN`), `row-actions.tsx:42`, `add-node-menu.tsx`, `add-node-menu-panel.tsx:51-56` | `tree-actions.test.ts` (each kind equals the table); `tree-row-actions.test.ts`; E2E `AQP-405 AC-1` (items per kind, Escape returns focus, keyboard focuses the first item) | **Met.** Visibility on touch follows AC-7 (the open row only), not AC-1's "always visible on touch" (QLT-11) |
| AC-2 Fastener at once, "Add fastener under <row>" | `row-actions.tsx:41`, `tree-actions.ts:35` | markup test (no `aria-haspopup`, name and title); E2E (no menu, a Fastener icon appears) | **Met** |
| AC-3 Add main assembly, last, opened and focused | `tree-panel.tsx:87-94`, `use-parts-tree.ts:97-113`, `tree-node.tsx:51-53` | markup test (foot of the tree, empty tree, absent when not editable); E2E (`2` is `aria-current` and focused) | **Met.** See QLT-03 and QLT-04 |
| AC-4 "−" opens the existing confirmation, same route and guard, count, renumber, cancel | `row-actions.tsx:43`, `use-parts-tree.ts:127-146`, `delete-part-dialog.tsx` (words only, DL-303 (2)), server `deleteNode` unchanged | E2E: "Delete 3 rows" with 2 under it, Cancel focused first, Cancel sends nothing, Escape sends nothing, confirm removes three and the tree is empty, the "−" of a non-open row deletes that row and the open row stays open and is renumbered; integration 409 cases | **Met.** The story's "Delete 4 rows" example is the same rule with one more row. See QLT-02 and QLT-06 |
| AC-5 old buttons removed | `tree-panel.tsx:145-151` (Add, Sub-part, Part beside and Delete gone; Move up and Move down kept) | markup test | **Met as ruled** (DL-303 (1): Move up and Move down stay until 3D). There were no buttons in `part-form.tsx` on master; they were in the tree panel |
| AC-6 offered exactly when `canEditInputs`; server refuses; FR-100 | `estimate-workspace.tsx:67` (`canEditInputs(status, 'ENGINEER')`, unchanged); `tree-actions.ts:16` (`treeActionsOffered`, **not called by any screen**); server `lockForChange` → `assertEditable` | `tree-actions.test.ts` (9 pairs); E2E `estimate-calculate` (a submitted estimate has no "+", "−" or Add main assembly); integration (submitted is 409 for the Engineer; Lead writers clear the figures) | **Met for the screens that exist** (DL-303 (3): the Lead and Admin part is server-only for now, OQ-PM-14). Approved is covered by the unit markup test only. Quoted and Ignored are not on this head. See QLT-05 |
| AC-7 touch, keyboard, 44 px, menu not clipped | `parts-tree-list.tsx:95-96` (slot), `add-node-trigger.tsx:9` (44 px, 36 px fine-wide), portalled Radix content (never clipped by the panel) | E2E AC-9 row buttons at 44 px (touch) and 36 px (desktop); Tab, Enter, arrows and Escape in `AQP-405 AC-1` | **Met.** It opens under its row as a portalled popper, not "in line" in the DOM; the intent (never clipped) holds. See QLT-07 and QLT-08 |
| AC-8 SCR-06 and SCR-07 read-only | the review tree passes no `renderToolbar` (`PartsTreeList` draws the slot empty) | `parts-tree-markup.test.ts`; markup test with `editable=false` | **Met** |
| AC-9 first load, figure stated | plain buttons in the first load, the menu behind `import()` | CI JS budget: 185,710 B, headroom 14,290 B | **Met.** The PR body must state the figure (it still says "not measured") |
| AC-10 E2E at 360, 768, 1366 with axe | `estimate-tree.spec.ts` | Run 45040022983: one case red at 360 and 768 (QLT-01); fixed by `28cfd8e5`; run 45041853021 pending | **Pending CI** |

## Security and correctness checks

| # | Check | Result |
|---|---|---|
| 1 | **Delete goes through the same guarded route** | **Holds.** `confirmDelete` sends `{ nodeId, revision, parts, subtree }` from the `DeleteTarget` captured when the "−" was pressed (`use-parts-tree.ts:127-146`). The server (`estimate-service.ts` `deleteNode`) locks the estimate, checks `mayOpen` (404) and `assertEditable` (409), finds the row only among **this** estimate's rows (`partIn`, 404), and recomputes the doomed set. It refuses with 409 and the fresh tree on a changed revision, a changed count or a changed fingerprint, then deletes and renumbers in one transaction. Nothing in the route or the service changed |
| 2 | **The confirmation names the row and the count; cancel changes nothing** | **Holds.** The title is "Delete row <Sl. No>?". The body is "This also deletes the N rows under it …" and the button "Delete N+1 rows", with N+1 = `partsRemoved(nodes, id).length`, the same set the fingerprint covers. Cancel and Escape only set `deleteOpen` to false; no request is sent (E2E counts DELETE requests) |
| 3 | **No wrong-row delete** | **Holds.** Each row's `RowActions` closes over its own `part.id` (`row-actions.tsx:43`), and `askDelete(id)` looks the row up by that ID, not by the selection (`use-parts-tree.ts:128`). The dialog's words are taken from that row. The open-row selection after a delete is correct: it stays unless it was in the removed set, and then moves to the deleted row's parent (`use-parts-tree.ts:143`). Only E2E at desktop width pins the binding (QLT-06) |
| 4 | **Concurrency: stale tree** | **Fails closed.** A save that lands after the dialog opened raises a revision inside the subtree, so the captured fingerprint no longer matches and the server answers 409 with the fresh tree. `change()` shows it with the "changed" notice. A delete never sends a count the person did not see. One change at a time (`busy`) is unchanged. The plain "+" is not disabled while busy; a press then is ignored, as before |
| 5 | **"+" offers exactly `ALLOWED_CHILDREN`; the server refuses anything else** | **Holds.** `addActionOf` reads the frozen table that `placeForAdd` also reads. The server refuses any other kind with 422 `NODE_KIND_NOT_ALLOWED` before the insert, after the lock and `assertEditable` (integration, all 20 pairs). Add main assembly sends `{ parentId: null, nodeKind: 'MAIN_ASSEMBLY' }`, which is the only kind the table allows at the top |
| 6 | **Who sees the actions** | **Holds for today's screens.** `/estimates/[code]` renders the workspace only for an Engineer, so `editable = canEditInputs(status, 'ENGINEER')`: DRAFT yes, SUBMITTED and APPROVED no. A Lead or Admin gets SCR-06, whose tree has no actions (DL-303 (3)). `assertEditable` stays the authority for every role. `treeActionsOffered` is correct but unused (QLT-05) |
| 7 | **FR-100: a structure change on a Prepared estimate clears the figures** | **Holds on the server** (`cleared.test.ts`: the Lead's add, move and delete raise `inputs_revision` and clear the figures; Recalculate brings them back). No screen offers it to a Lead yet |
| 8 | **Ignored and Quoted** | **Not on this head.** The statuses are DRAFT, SUBMITTED and APPROVED (7A and 7B are not merged), so nothing here can be Ignored. Ignored is planned as a layer over the status (ADR-019), so `canEditInputs(status, role)` cannot see it as written. 7B, which owns `can-edit-inputs.ts`, and 7D must make the workspace's `editable` (and `treeActionsOffered` if it is kept) false while Ignored. The server must refuse it on its own route check (DL-304). QLT-05 and "Issues for other roles" |
| 9 | **Lazy menu: first load and failure** | **Holds.** `add-node-menu.tsx` imports only types from the panel and loads it with a bare `import()` through `useFirstOpen`, the shared loader with retry after a failure (`FirstOpenFailure`, Escape cancels a pending open). Each row has its own loader ID, and the module is fetched once. +648 B on the route |
| 10 | **Menu inside the phone drawer** | **Sound by construction.** The menu is `modal={false}` and portalled. Radix nests it as a child layer of the drawer's dialog: React-tree pointer and focus events inside the portal do not count as outside the dialog, and the menu's `FocusScope` pauses the drawer's trap while it is open. Escape closes the menu first, and focus returns to its trigger. E2E `AQP-405 AC-1` runs at 360 px with the drawer open, and axe runs at its end, but not while the menu is open (QLT-12) |
| 11 | **Touch toolbar only on the open row** | **Holds.** The slot is `pointer-coarse:hidden` unless the row's own `div.group/row` holds `aria-current=true`. The children's `ul` is outside that div, so a parent row does not light up for a child. Hidden toolbars are `display: none`, so they leave the tab order. On a fine pointer the toolbar is `opacity-0`, stays in the tab order, and shows on hover, focus-within and the open row. This is the rule QLT-01's test missed |
| 12 | **Old buttons and the 3A interim mapping removed; Move kept** | **Holds.** `tree-add.ts` and its test are gone with the only caller. The texts New item, Sub-part, Part beside, Delete and the interim Fastener notice are removed. Move up and Move down stay (DL-303 (1)). `firstAllowedChild` is left with no `src` caller (QLT-10) |
| 13 | **NFR-002 and cost data** | **Not touched.** No figure on any row action, no new schema field, route or page. The cost-confidentiality scan is part of the CI stages that passed on `142e8ca1` |
| 14 | **Tests: none deleted or weakened** | **Met.** `tree-add.test.ts` goes with the code it tested; its "always allowed" property is replaced by `addActionOf` against the table for every kind. Every E2E edit moves the same assertion to the new control: same counts, same Cancel, Escape and DELETE-request checks, same axe calls. The arrow-button locator is narrowed to "Close/Open branch", because the tree now holds other buttons. `28cfd8e5` measures the open row's buttons (`1.1`) instead of row 1's, which on touch are rightly not drawn. Same sizes, same widths, no skip, retry or time-out added. New: 2 unit files (29 tests) and 2 E2E cases |

## Findings

### QLT-01 · Blocker (fixed in `28cfd8e5`; CI pending) — AC-9 E2E red at 360 and 768 px
- **Where:** `tests/e2e/estimate-tree.spec.ts:578-580` at `142e8ca1`.
- **Issue:** the case adds 1.1, which becomes the open row, and then measures the "+" and "−" of row **1**. On a touch screen (`hasTouch: true`, so `pointer: coarse`) only the open row's toolbar is drawn (`parts-tree-list.tsx:95-96`), so the locator never resolved and `boundingBox` timed out. Run 45040022983, jobs 137262157620 and 137262157714.
- **Impact:** CI red, so no merge. The product behaviour is the designed one (AC-7).
- **Fix (done):** measure the open row, `['Add under', '1.1'], ['Delete', '1.1']`. I read the diff: two lines, same thresholds, no weakening.
- **Test that catches it:** the case itself, on the next fully green run.

### QLT-02 · Minor — Closing the delete dialog without deleting sends focus to the open row, not to the "−" that was pressed
- **Where:** `tree-panel.tsx:51-54` (`focusTree`) with `row-actions.tsx:43`.
- **Issue:** `onCloseAutoFocus` always prevents Radix's return to the trigger and focuses `a[aria-current="true"]`. That was right when Delete acted only on the open row. Now the "−" can belong to any row, so Cancel or Escape on row 3.2's "−" moves a keyboard user to, say, row 1.
- **Impact:** keyboard and screen-reader users lose their place (WCAG 2.4.3); no data effect.
- **Fix:** keep Radix's default when nothing was deleted, and redirect only after a delete:
  ```ts
  const focusAfterDelete = (event: Event): void => { if (tree.deleting !== null && tree.nodes?.some((n) => n.id === tree.deleting?.id)) return; focusTree(event); };
  ```
- **Test:** E2E (desktop): open row 1.2, Tab to "Delete 1.1 …", Enter, Escape, then expect that button to be focused.

### QLT-03 · Minor — Adding under a closed branch hides the new row and leaves a focus request armed
- **Where:** `use-parts-tree.ts:97-113` (`focusAfterAdd`, `wantsFocus`) and `tree-panel.tsx:81-82` (`closed`).
- **Issue:** the "+" of a row whose branch the person closed adds the child, but the branch stays closed. The new row is open in the form but not drawn in the tree, and `focusAfterAdd` stays set. When the person later opens that branch, the row's ref callback steals focus.
- **Impact:** a confusing "Part 1.3 added" with nothing visible, and a later unexpected focus jump.
- **Fix:** open the parent's branch when adding under it, for example in `TreePanel`: `onAdd={(parentId, kind) => { if (parentId !== null) setClosed((c) => new Set([...c].filter((id) => id !== parentId))); tree.addUnder(parentId, kind); }}`. Also clear `focusAfterAdd` at the start of every `change()`.
- **Test:** E2E: close branch 1, use "+" on row 1 to add a Part, and expect the new row to be visible and focused.

### QLT-04 · Minor — "Add main assembly" uses `disabled`, which drops keyboard focus
- **Where:** `tree-panel.tsx:89`. Compare the panel's own rule at `tree-panel.tsx:56-59`: "`aria-disabled`, not `disabled`: a button that is pressed and then disabled … would drop the keyboard focus".
- **Issue:** Enter on it disables it at once (`busy`), so focus falls to `<body>`. If the add is refused or fails, focus stays there. The row "+" buttons are not disabled at all, so the two are inconsistent.
- **Fix:** `aria-disabled={busy || undefined}`, with the click ignored while busy (`change()` already ignores it), or no disabling, like the "+".
- **Test:** E2E with the add route stubbed to 500: Enter on Add main assembly, then expect it to still be focused.

### QLT-05 · Minor — `treeActionsOffered` is not used by any screen, and its test header claims a guard it does not give
- **Where:** `src/lib/estimates/tree-actions.ts:16`; `estimate-workspace.tsx:67` (`canEditInputs(status, 'ENGINEER')`); `tests/unit/tree-actions.test.ts:9-18`; doc comments at `row-actions.tsx:29` and `tree-panel.tsx:37`.
- **Issue:** the screen does not call the function the AC-6 unit test exercises, so the test proves an identity (`treeActionsOffered === canEditInputs`), not what is drawn. The header says "a status added later (Quoted, Ignored) fails here until someone decides". That is false: `STATUSES` is a hand-written list, so a new enum value is never iterated, and Ignored is a layer (ADR-019) that `(status, role)` cannot see. The PR body's "When 7B adds Quoted and Ignored, they follow `canEditInputs` and need no change here" holds only if 7B changes `canEditInputs`' inputs.
- **Impact:** a false sense of coverage for AC-6 when 7B and 7D land. The server stays the authority, so no data risk.
- **Fix:** either call it (`const editable = treeActionsOffered(status, 'ENGINEER')`, and later pass the ignored flag), or delete it and keep `canEditInputs`' own tests. Iterate `ESTIMATE_STATUSES` rather than a literal list, and correct the header.
- **Test:** `ESTIMATE_STATUSES.flatMap(...)` with an explicit expected table, which then fails when 7B adds QUOTED.

### QLT-06 · Minor — The "−" and "+" row binding is pinned only by E2E, and only at one width for a non-open row
- **Where:** `row-actions.tsx:41-43`; `tests/unit/tree-row-actions.test.ts` renders static markup with no-op handlers.
- **Issue:** planted faults P1 (the "−" deletes the parent) and P4 (the Fastener goes under the parent) pass every unit test. The data-loss path is protected only by E2E, and for a non-open row only at 1366 px.
- **Impact:** a later refactor of `RowActions` that mis-binds the ID is caught late (in E2E) or, for touch-only paths, not at all.
- **Fix:** a small unit test that calls the handlers, for example by extracting `rowActionCalls(part)` or rendering with `react-dom/client` in the existing jsdom setup and asserting `onDelete` was called with `part.id` and `onAdd` with `(part.id, 'FASTENER')`.
- **Test:** as above. P1 and P4 must then fail.

### QLT-07 · Minor — On a desktop, the open row's toolbar permanently covers its status icon and the missing-input triangle
- **Where:** `parts-tree-list.tsx:95-96` (the slot is `absolute right-0`, opaque `bg-surface` from `row-actions.tsx:40`, and always shown on the `aria-current` row); `tree-node.tsx` puts the completeness icon and the triangle at the end of the link.
- **Issue:** at 1024 px and wider with a fine pointer, the open row never shows its completeness icon or, after a blocked Calculate, its red triangle. The words remain for screen readers only.
- **Impact:** sighted users lose the open row's state in the tree (the form still lists the missing fields).
- **Fix:** reserve the toolbar's width on the open row (for example `group-has-[[aria-current=true]]/row:pr-[calc(2*var(--control-h-row)+2px)]` on the link), or ask the ux-expert whether the open row's toolbar should sit in line. Cross-reference the ux-expert.
- **Test:** E2E (desktop): after a blocked Calculate, the open row's triangle is visible (`toBeVisible` and not covered: `elementFromPoint` at its centre is the icon).

### QLT-08 · Minor — The "+" fades out while its own menu is open, once the pointer leaves the row
- **Where:** `parts-tree-list.tsx:95-96`.
- **Issue:** the menu content is portalled, so focus inside it is not `focus-within` the row. On a non-open row the trigger goes back to `opacity-0` while the menu hangs from it.
- **Fix:** add `group-has-[[data-state=open]]/row:opacity-100`.
- **Test:** E2E (desktop): open the menu of a non-open row, move the mouse away, and expect the trigger to have opacity 1.

### QLT-09 · Info — Announcements still say "Part"
`addedMessage` ("Part 1.1 added") and `renumberedMessage` name every kind "Part", while the delete now says "row" (DL-303 (2)). The ux-expert owns the words. A follow-up, not this story.

### QLT-10 · Info — `firstAllowedChild` is now dead
`src/lib/estimate/node-kinds.ts:42` has no `src` caller since `tree-add.ts` went, and its test still calls it "the interim 'Add sub-part'". Remove it in 3D or the hardening window.

### QLT-11 · Info — AC wording to align (product-owner)
- AC-1 says "always visible on touch". AC-7 and UX §0.9 row 3 (third look) say "in line on the selected row". The build follows AC-7.
- AC-4's "existing confirmation … unchanged" vs the words now saying "rows" (DL-303 (2)).
- AC-5's "Move up, Move down … removed" vs DL-303 (1).
- AC-7's "opens in line under its row" is met as a portalled popper under the row.

### QLT-12 · Info — Test gaps accepted for now
"Absent on Approved" has only the unit markup test (`editable=false`); E2E covers Submitted. "Lead on Prepared" is the pure rule and the server only (DL-303 (3), OQ-PM-14). There is no axe run while the "+" menu is open inside the phone drawer. Stale-tree delete 409 is integration-only, which is where the guard lives. Worth adding the axe-with-menu-open check at 360 px in the final review.

### QLT-13 · Info — Done well
Delete reuses the guarded route untouched. `askDelete(id)` captures the count, fingerprint and removed IDs together, so the dialog, the request and the selection rule all describe the same set. One table drives both the menu and the server refusal. The lazy menu reuses the shared first-open loader with its failure and retry path. The first-load growth is 648 B.

## Issues for other roles

- **developer:** QLT-02 to QLT-08 (cheap), and update the PR body with the JS figure (185,710 B; 14,290 B headroom).
- **solution-architect / 7B and 7D developers:** Ignored as a layer must reach the workspace's `editable` (and `treeActionsOffered` if it is kept); `canEditInputs(status, role)` cannot see it (check 8, QLT-05). DL-304 requires the server's own refusal per route.
- **ux-expert:** QLT-07 (the open row's toolbar covers its status) and QLT-09 (announcement words).
- **product-owner:** QLT-11 AC wording.
- **reviewer-performance (final review):** every row now mounts a `RowActions`, and each menu row a `useFirstOpen` with its own effects. At the 2,000-part limit that is up to 2,000 loaders and about 4,000 extra buttons.

## Hand-off

- Status: COMPLETE (CI on `28cfd8e5`, run 45041853021, pending at close: pause requested by the delivery lead)
- Verdict: APPROVE WITH COMMENTS; merge on a fully green run
- Counts: Blocker 1 (fixed, CI pending) · Critical 0 · Major 0 · Minor 7 · Info 5
