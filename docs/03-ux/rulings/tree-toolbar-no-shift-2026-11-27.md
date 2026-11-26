# UX ruling: the row toolbar of the parts tree never moves a row (DEF-129, DEF-132; DL-411; master DL-440)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-26 (file dated 27 Nov as asked) |
| Asked by | The coordinator, through the main session, urgent. Lane 1 builds it, target end of Sun 29 Nov; a developer builds it before Wed 2 Dec at the latest |
| Constraints (master DL-440, relayed) | (1) No row moves when a toolbar shows or hides. (2) No control revealed on hover sits over another row's hit area. (3) The toolbar sits **under** its row and shows on hover, focus or selection (touch: selection), never by default (the delivery lead's instruction, DL-377 item 8, DL-409 (C)). (4) The keyboard path, the touch rule and the 24 px and 44 px targets do not change |
| Fault (lane 2's measurement, master d2b58f04, 1366 by 768, fine pointer, 5 rows) | The toolbar line (38 px plus a 4 px margin) is added under the hovered row and pushes every row below it down by 42 px. Moving the pointer from row 1.1 straight down onto row 1.2's link hides 1.1's toolbar, so 1.2's link slides 42 px **up**, above the pointer, which is now over 1.2's own toolbar: a click lands on "+" (adds a Fastener at once), on the move handle or on "-" (opens the delete dialog). A hide delay only postpones the slide |
| Read from | `ux-spec.md` section 0.9 row 3; `rulings/parts-tree-scr05-conformance-2026-11-26.md` item 3 (**superseded in its "Layout" paragraph by this ruling**); `rulings/lead-admin-edit-inputs-2026-11-27.md` 4.7; `screens.css` (`.tree-acts`, the original floating toolbar); DL-377, DL-409, DL-410; on `origin/master` `shared/parts-tree-list.tsx` (`TOOLBAR_SLOT`, the `renderToolbar` slot), `estimate-workspace/row-actions.tsx` (`HIDDEN_UNTIL_NEEDED`), `app/globals.css` (`--control-h` 44, `--control-h-row` 36, `--compact-field-h` 36, `--tree-w` 320, the `mouse:` and `touch:` variants) |
| Not done | No browser. Nothing here was seen running; the numbers are from the code and the lane's measurement. No code edited |

## Answer

**All four constraints can be met. No question goes to the delivery lead.** The design is **a toolbar slot reserved under every row** (the coordinator's option (a)) for a mouse. The slot has a fixed height whether or not the toolbar is in view, so showing or hiding the toolbar changes no row's position. Nothing is drawn over any row. What the delivery lead asked for is unchanged: under the row, on hover, keyboard focus or selection, never by default.

**The cost, stated plainly:** a tree row with a mouse takes 40 px more height all the time, so the Engineer's tree is about twice as tall as today (row pitch 36 to 76 px) and the Lead's review row about 60 to 100 px. The trees already scroll inside their own column. It is the price of a toolbar that is under the row and never moves it; section 5 lists what was tried and why the cheaper ones fail, and one fallback that costs less height but does not meet constraint 1.

## 1. The design

1. **The slot.** The `TOOLBAR_SLOT` element of `PartsTreeList` (the row's second grid line, in the link's column) gets a fixed minimum height `--tree-slot-h`, **40 px**, for a mouse (the `mouse:` variant: a pointer that hovers and points finely; the one the build already uses). It is there on every row **that has a toolbar**, in view or not. Trees with no toolbar (SCR-07's tree, the review tree of a locked estimate, an Engineer's Prepared tree, a person who may not edit) have no slot and keep today's height.
2. **The toolbar inside the slot.** Where it is in view it sits at the slot's top left, in the column of the link, **38 px high** (36 px buttons and the 1 px border), 2 px under the row's text line. It fills the slot, so the slot's height does not change when the toolbar shows. The three controls, their order, names, tooltips and 36 px buttons are unchanged.
3. **When it is in view** is the 26 Nov rule, unchanged (item 3 of that ruling and DL-409 (C)): the pointer is over the row, which **includes its slot** (so the pointer can go down onto the toolbar without losing it); keyboard focus is anywhere in the row; a menu or the delete dialog of the row is open; a press holds it (`data-hold`). Never because a row is open or was just added. Never by default.
4. **When it is not in view** it is clipped to 1 px with no hit area (`sr-only`), as built: in the tab order and the accessibility tree, **never `opacity: 0`, `visibility: hidden` or `display: none`**. `opacity: 0` is forbidden for a stronger reason now: an invisible button inside a reserved slot would take a press aimed at nothing. The empty part of a slot is not a control: a press on it does nothing.
5. **Nothing covers another row.** The slot belongs to its own row's list item. A row's toolbar never extends past its slot's bottom edge, so it never sits over the next row's link or hit area (constraint 2).
6. **The pointer path now works.** Move down from row 1.1: the pointer crosses 1.1's slot (1.1's toolbar in view), then enters 1.2's link: 1.1's toolbar goes out of view and 1.2's comes into view, and **no row has moved**, so 1.2's link is where it was. A click there opens 1.2 and presses nothing. A hide delay of 100 ms after the pointer leaves (never a delay before showing) is allowed to steady the look; it is no longer needed for correctness.
7. **Touch and any pointer that is not a mouse** (`touch:`) is unchanged: the toolbar shows on the **selected row only**, 44 px buttons, 48 px slot (44 px buttons, 2 px border, 2 px gap), added under the selected row and nowhere else, so the tree is not taller on a phone or tablet. Rows below the selected row move when the person **taps another row**, because the tap changes the selection and the toolbar goes with it. That is the one place a row moves for a toolbar, and it is not constraint 1's case (no hover; the finger has lifted; the browser's own layout-shift measure ignores a change within 500 ms of a tap). If the delivery lead wants even that gone, the answer is a slot under every row on touch, 94 px a row, which I do not recommend.
8. **The keyboard path is unchanged.** Tab goes row link, arrow, Cost details link (review tree), then the toolbar's buttons, in the DOM order of today. The toolbar is in view while focus is in the row, with no row moving. Escape closes a menu and returns focus to its "+".
9. **Focus is never hidden (WCAG 2.4.11).** Because the hidden toolbar is a 1 px sliver, the browser scrolls to the sliver, and the 38 px toolbar then appears below it. So each toolbar button and the slot carry `scroll-margin-block: 40px`, and the tree's scroll container keeps `scroll-padding-bottom: var(--sticky-bottom, 0px)` (the Calculate or action bar) and the top bar's height at the top. A focused button is wholly in view above the sticky bar.
10. **Targets (WCAG 2.5.8).** Buttons are 36 by 36 px for a mouse (24 px is the floor) and 44 by 44 px on touch, side by side with no gap as built. Nothing smaller is introduced.
11. **No animation.** Showing and hiding the toolbar has no transition, so there is nothing for `prefers-reduced-motion` to switch off.

## 2. Where it applies

| Tree | Slot reserved (mouse) |
|---|---|
| SCR-05 Engineer tree, DRAFT, own task (the 320 px column from 1024 px, the tablet panel, the phone drawer) | Yes, under every row. At 240 to 400 px (the resizable range) the toolbar's 112 px plus the deepest indent (level 4) fits; it is never clipped |
| SCR-06 review tree, Lead and Admin, DRAFT or PREPARED, not ignored (lead-admin-edit-inputs 4.7) | Yes. The row is two lines (name; count, figures, Cost details link), then the slot. The slot is the **third** line, as 4.7 (a) says |
| SCR-05 Prepared, Approved, Quoted, Ignored; SCR-06 locked; SCR-07's tree | No toolbar, no slot, no change |
| Phone drawer | The touch rule of item 7 (selected row only); a phone with a mouse takes the mouse rule |

## 3. What it costs, and what stays tight

| | Today (pitch with the toolbar hidden) | With the slot (mouse) |
|---|---|---|
| Engineer tree row | 36 px | 76 px |
| Lead review row (two lines) | about 60 px | about 100 px |
| Rows visible in the tree column at 1366 by 768 (column about 600 px) | about 16 (Engineer), 10 (Lead) | about 8 (Engineer), 6 (Lead) |

The tree already has its own scroll; the arrows still close a branch, and a closed branch's rows and slots are not drawn. The build may trim the rest of a row by one or two pixels at the developer's choice **only** if the slot stays 40 px. The idle look is rows with room under each; **no divider or ornament is added** (the CAD-tree look of the customer's sample keeps its thin level guide lines).

## 4. Checks (QA and the developer; each is one assertion; Chromium at 1366 by 768, fine pointer, unless stated)

| ID | Check |
|---|---|
| TS-1 | **No row moves (the lane's measurement).** A tree of 5 or more rows, the pointer outside: record the top of every row's link. Hover each row in turn, then each of its three buttons, then move the pointer out: every row's top is **identical (0 px)** at every step, and the tree's `scrollHeight` is unchanged |
| TS-2 | **The pointer moves down five rows and no row box moves.** Move the pointer from the first row's link to the fifth, in 20 steps and in one jump: at every step each row's bounding box equals its box with the pointer outside |
| TS-3 | **A click on the next row's link opens that row and adds nothing.** For each pair of neighbouring rows: hover row N, move straight down to row N+1's link centre, click: row N+1 gets `aria-current="true"`, its form opens, and no request is sent to add, move or delete; the delete dialog is not open; the row count is unchanged. Repeat with the move in one jump and with 5 intermediate moves. No `force`, no wait for the toolbar to hide |
| TS-4 | **CLS from hover is 0.** Record layout shifts with a `PerformanceObserver` (`layout-shift`, `hadRecentInput` ignored) while the pointer sweeps the whole tree and while Tab moves focus through every row and button: the sum is 0 |
| TS-5 | The toolbar of the hovered row is in the slot directly under its row: its top is within 2 px of the slot's top, its height is 38 px, each button is 36 by 36 px (computed), and it lies wholly inside the slot (it overlaps no other row's link, checked with `elementsFromPoint` at the slot's bottom edge) |
| TS-6 | Not in view, a row's toolbar has no hit area: `elementFromPoint` over where it would be returns the slot or the list item, never a button; a press on an empty slot sends no request and changes no selection; the buttons are still reachable by Tab |
| TS-7 | Keyboard: Tab onto a row's link: its toolbar is in view in the slot and no row has moved; Tab through its buttons; Tab out: it goes; rows unchanged at every step. Escape in the "+" menu closes it and returns focus to the "+" |
| TS-8 | **Touch** (coarse pointer, 360 and 768 px): only the selected row has a toolbar and a slot (the tree is the rows plus one 48 px slot); buttons are at least 44 by 44 px; tapping another row moves the toolbar to it; no toolbar and no slot on any other row |
| TS-9 | WCAG 2.4.11: with the focused row at the bottom of the viewport and the Calculate bar showing (Engineer) or the action bar (Lead), focus each toolbar button: it is wholly visible, not under a sticky bar |
| TS-10 | WCAG 2.5.8: every toolbar button is 24 by 24 px or larger (36 mouse, 44 touch) and no two targets overlap |
| TS-11 | The idle pitch: with the pointer outside, an Engineer's rows are 76 px apart (plus 1 px) and a Lead's two-line rows about 100 px; a tree with no toolbar (SCR-07, locked, Prepared) has the heights it has today |
| TS-12 | The 320 px column at 1024 px, the 240 and 400 px resize extremes, and the deepest row (level 4): the toolbar is wholly inside the column, nothing is clipped, and there is no horizontal scroll |
| TS-13 | Drag reorder: while a row is dragged, no row moves except the one being dragged and the drop line (an absolutely placed line); the slot heights do not change |
| TS-14 | The "+" menu opens in line under its row; opening it moves only the rows below; pressing outside it closes it and **does nothing else** (the press does not pass through to the row it was over). Verify on the build; report a pass-through as a defect |
| TS-15 | The existing parts-tree E2E specs (`estimate-tree.spec.ts`, DEF-129 and DEF-132 cases) pass with a hover followed by a click on a neighbouring row, with no `force: true`, no `waitForTimeout` and no retry; TB-1 to TB-6 of the 26 Nov ruling stay green |
| TS-16 | axe at 360, 768 and 1366 px with a toolbar in view, the "+" menu open and the delete dialog open: no serious or critical finding |
| TS-17 | The review tree for a Lead (SCR-06, DRAFT and PREPARED) passes TS-1 to TS-7 and TS-9 to TS-12 with its two-line rows; an Engineer's page build holds no review code (NFR-002 unchanged) |

## 5. What else was considered

| Option | Verdict |
|---|---|
| **(a) A slot reserved under every row** | **Chosen.** Meets all four constraints with CSS only; the toolbar, its words and its order are unchanged. The cost is height |
| (b) The toolbar over the hovered row's bottom edge, or over the top of the next row | Rejected: it covers the next row's hit area (constraint 2) or the row's own text (DEF-075, the reason the delivery lead asked for "under") |
| (c) In the row's own line at the right end | Rejected: a row's name column at level 4 in a 320 px tree is about 110 px, so 112 px of toolbar leaves nothing; as an overlay it covers the name and takes presses meant for it (DEF-075 again) |
| A hide delay or a hover delay | Rejected: it postpones the slide (the coordinator's own finding); it is allowed only as a polish (item 6) |
| A "..." actions menu per row, or one toolbar above the tree for the selected row | Rejected: it changes the three controls (the instruction) and the customer's "+ next to a row" (CR-01 item 3C) |
| **Fallback S: reserve a slot only under rows the pointer or focus has visited, until it leaves the tree** | **Not recommended; named so the choice is complete.** The tree is compact when idle, but rows below a visited row still move down as the pointer sweeps, so it does not meet constraint 1 as written, it leaves uneven gaps while the pointer is in the tree, and it needs script. It would be the answer only if the delivery lead finds the height of (a) unacceptable and accepts that rows below the pointer may still move |

## 6. Changes to earlier rulings

- `parts-tree-scr05-conformance-2026-11-26.md` item 3, paragraph "Layout" (`Showing the toolbar adds its line to that row and moves the rows below down, with no animation ... If a row flips, hide the toolbar 100 ms after the pointer leaves`) is **replaced** by items 1 and 6 above. Everything else in item 3 (the table of causes, touch, the sequence after an add, the focus rules) stands. Its "Developers check" sentence (one toolbar at a time with no flicker between rows) is replaced by TS-2 and TS-3.
- `lead-admin-edit-inputs-2026-11-27.md` 4.7 (a): the sentence "The review tree is no taller than today until the person points at a row" is wrong from now on; it is replaced by "the review tree reserves the slot of this ruling under every row with a toolbar, so it is taller and no row moves".
- ux-spec section 0.9 row 3, SCR-05 and SCR-06: the next spec touch adds the slot (40 px, `--tree-slot-h`) and the two sentences above. The SCR-05 and SCR-06 mock-ups draw the toolbar floating over the row's end (`.tree-acts`); they are not changed here, and the build follows this ruling, not that drawing.
