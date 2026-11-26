# UX ruling: parts tree against SCR-05, four deviations found in the running demo (master `e3dc5b0b`)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-26 |
| Asked by | Delivery lead, through the main session (urgent, part 1 of 2). Developers build to this today; merge cut-off end of Wed 2 Dec, freeze Thu 3 Dec |
| Scope | Behaviour and words of the parts tree on SCR-05, and the same rows on the read-only trees of SCR-06 and SCR-07. No figure, rate or formula: the Engineer view is unchanged (NFR-002). Nothing here is a cost |
| Accepted deviations, not re-opened | Item 8 (the row toolbar sits **under** the row, on its own line, not floating over it; DEF-075, DEF-076), e-mail off at go-live, and the earlier rulings in this folder |
| Read from | `origin/master` `e3dc5b0b`: `SCR-05.html` (the tree, the "+" menu of row 1.1, the legend), `screens.css` (lines 352 to 357, 602 to 674), `ux-spec.md` section 0.9 row 3 (line 201) and SCR-05 (lines 614 to 665), `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` section 6.1 and section 7.1, D-44, `node-kinds.ts`, `node-kind-icon.tsx`, `tree-node.tsx`, `row-actions.tsx`, `add-node-menu-panel.tsx`, `estimate-texts.ts`, `part-name.ts`, `estimate-service.ts` |
| Not done | No browser (the Playwright and Chrome DevTools servers did not connect), so nothing here was seen running. Part 2 (a hands-on check of the running build) follows |
| Not touched | `SCR-*.html`, the generator, `screens.css`, `ux-spec.md` (the CR-01 session owns them). The sentences they need to add are in "For the CR-01 session" at the end |

## Answers in one screen

| # | Question | Answer |
|---|---|---|
| 1 | Why does every row say "Part"? | The design says the row shows its **name** after its number, and the name is the row's **Description** (column D), else its **Part No.** (column B), else the **kind's own name** in a muted style. The build sends an empty label for every row (`estimate-service.ts:244`, `label: ''`) and `tree-node.tsx` then draws the fixed word "Part". That is a build defect against the design, not a design change. The kind is shown by the icon tile on every row, as the table in item 1 |
| 2 | How is a row named or renamed? | **The design was silent. It is now designed.** There is **no separate name field**: the Description in section 01 of the row's form is the name. A new row is unnamed (it shows its kind's name, muted) until a Description is typed. Renaming is editing the Description. The tree row follows when the person leaves the field. One hint is added under Description |
| 3 | When does the row toolbar show? | Mouse: the hovered row, and a row that holds keyboard focus. Never because a row is open or was just added. Touch: the selected row only. Details and the add-a-row sequence in item 3 |
| 4 | What does "+" offer? | Main Assembly: **Sub-Assembly, Part, Fastener** (in that order). Sub-Assembly: **Part, Fastener**. Part and Sub-part: no menu, adds a **Fastener** at once. Fastener: no "+". **Sub-part is not a menu choice and the design does not lack it**: it is the automatic name of a Part when there are two or more under one parent, by SPEC 6.1, FR-043, BR-062, D-44 and DL-299. The menu says so in a hint under "Part". Making it a choice is a scope change (item 4) |

## 1. The row: what it shows and where the name comes from

**Row, left to right (as SCR-05):** open/close arrow (leaf rows keep the space) · kind tile · Sl. No (IBM Plex Mono 12 px, `--ink-2`) · name · status icon. The Lead's figures line does not exist on the Engineer's screen.

**The name, in this order (first that holds a value after trimming spaces):**

1. **Description** (column D), exactly as typed.
2. **Part No.** (column B), exactly as typed.
3. **No name yet: the kind's own name**, one of `Main Assembly`, `Sub-Assembly`, `Part`, `Sub-part`, `Fastener`. It follows the automatic rule, so an unnamed Part reads `Sub-part` as soon as a second Part is added under the same parent. It is drawn muted: `--ink-2`, *italic*, weight 400 (8.4:1 on white, 7.3:1 on the open row's `--surface-2`). The fixed word "Part" for every kind is withdrawn.

The same rule names the row in every place the build names a row: the tree on SCR-05, SCR-06 and SCR-07, the accessible names of the row's buttons (`Add under 1.1 Sub-Assembly`), the delete confirmation (`Delete 1.1 Sub-Assembly?`), and the form title. Today SCR-06 and SCR-07 already read Description, then Part No. (`part-name.ts`), and then draw "Part"; only the last step changes. The export list's `No name yet` and the quantity dialog keep their words for now (they have no kind icon); the developer may align them if it is a one-line change.

**Long names** wrap onto further lines inside the tree (the mock-up's `.tree-name`, `white-space: normal`); nothing is cut and the row grows. The tree is 320 px by default and resizable (FR-112).

**Screen reader.** The row link reads the kind (from the icon's name), the number, the name, then the status, as built. When the name is the kind's own name, an extra `sr-only` `, no description yet` follows it, so the repeated word is understood as a placeholder: `Sub-Assembly, 1.1, Sub-Assembly, no description yet, Not started`.

**The kind of each row.** Shape first, tint second, never colour alone, no text label on the row (SPEC 6.1; ruling 2026-11-24 items 1 to 3 and 7a, already in `node-kind-icon.tsx`). 24 px tile, 18 px glyph, stroke 1.75, tooltip on hover and spoken name on the glyph. The legend (four entries, tile 24 px) is `Main Assembly`, `Sub-Assembly`, `Part or Sub-part`, `Fastener`.

| Kind | Glyph (lucide) | Tile | Tooltip and spoken name | When |
|---|---|---|---|---|
| Main Assembly | `Boxes` | `--primary-soft` fill, `--primary-ink` glyph (red) | `Main Assembly` | A top-level row |
| Sub-Assembly | `Blocks` | `--accent-soft`, `--accent-ink` (amber) | `Sub-Assembly` | Stored kind |
| Part | `Box` | `--surface-2`, `--ink-2` (grey) | `Part` | The only Part under its parent |
| Sub-part | `Box` (same as Part) | same as Part | `Sub-part` | Two or more Parts under one parent; not stored, derived on every read; renames on add and on delete |
| Fastener | `Bolt` | `--info-soft`, `--info-ink` (graphite) | `Fastener` | Holds nothing |

**Build to this (developer).** (a) The tree answer's `label` is the name by steps 1 and 2 (an input typed by the person, never a figure, so it is in every role's tree; `partNameOf` already does it for SCR-06 and SCR-07: use it in `estimate-service.ts:244`). (b) `tree-node.tsx` draws the label, or step 3 from `nodeKindLabel` when it is empty, in the muted style, with the `sr-only` suffix. (c) `row-actions.tsx`, `review-tree.tsx`, `build-table.tsx`, `cost-details.tsx` replace `TREE_PART_NAME` / `PART_NAME_FALLBACK` with the same step 3.

## 2. Naming a new row and renaming a row

**What the design said before.** SCR-05 draws names in the tree and in the form title (`1.1 · Base frame`) but has no field for a name. Section 01 holds Sl. No, Part No., Part Model, Description, Treatment / Color and QTY per Assy (SPEC 7.1). The DL-219 paragraph of the spec lists a "Part Name" among the typed fields, which no screen or table has. **That was a gap in my design.** It is closed as follows.

**Decision: the Description is the name. No new field.** Reasons: SPEC 7.1 has no name field and the Excel file is the customer's layout, with one cell for Description and none for a name (DL-300), so a second name would be a new column and a migration; the review, cost-details and quantity screens already name a row by Description; one place to type is the guided form's idea (UD-1). A short separate name is possible later as a product change (PM), and it would take the first place in the order above.

**New row.** It is added last under its parent with no inputs, so it shows step 3 (its kind's name, muted) and its status icon `Not started`. Nobody has to name it to add the next row.

**Naming and renaming (one way).** Type in **Description** in section 01 of the row's form. It is the same field, with the same rules, for a new row and a rename:

| Item | Rule |
|---|---|
| Label | `Description` (unchanged), with the column tag `D` |
| Hint (new, under the field) | `Names this row in the parts tree.` |
| When the tree changes | When the person **leaves the field** (the moment the form commits the value), not on each key, so a screen reader is not interrupted. No wait for the 30 s auto-save. A reload shows the saved value (step 1 on the server) |
| Cleared | Back to Part No., else the kind's own name |
| Required | On Calculate, as today: `Enter this value.` |
| Length | 100 characters or fewer, else `Use 100 characters or fewer.` (the typed-text rule of the spec) |
| Hidden characters | Refused with the existing message, `The text has a hidden character, <name> (U+<code>). Type it again instead of pasting it.` |
| Only spaces | Counts as empty |
| Same name on two rows | Allowed. The Sl. No tells them apart |
| When it cannot change | The field is read-only when the inputs are (Prepared for an Engineer, Approved, Quoted, Ignored), and so the name is |
| Rename from the tree | **Not offered.** A row is a link; a second control for typing in it breaks the "list of links" pattern (spec row 3) and adds a keyboard and touch case. One place to type |

**Announcements** (polite `status`, one at a time, nothing for a rename):

- After an add: `Added 1.5 Part. Type a Description to name it.` The kind word is the new row's own kind. If the add made an earlier sibling a Sub-part, append ` 1.2 is now a Sub-part.`
- After a delete that leaves one Part under a parent: `Row deleted. 1.1 is now a Part.` (several rows: `4 rows deleted. 1.1 is now a Part.`)

## 3. The row toolbar: when it shows, and what happens after an add

The toolbar (move handle, "+", "−") sits **under** the row on its own line (accepted, item 8). It is clipped to 1 px while not in view, never `display: none` or `opacity: 0`, so it stays in the tab order and the accessibility tree.

**Mouse** (`@media (hover: hover) and (pointer: fine)`). In view only when:

| Cause | In view |
|---|---|
| The pointer is over the row (its link or its toolbar line) | Yes |
| Keyboard focus is within the row (`:focus-visible` within; Tab onto the link shows it before Tab reaches a button) | Yes |
| A menu of the row is open (move menu, "+" menu) or its delete confirmation is open | Yes, until closed |
| A press holds it (`data-hold`, as built) | Yes, until the press ends |
| **The row is the open row (`aria-current`)** | **No.** Withdrawn from the build: this is why the toolbar stays under the last added row |
| The row was just added | No |

**Touch** (any other pointer: `(hover: none)` or `(pointer: coarse)`). In view on **the selected row only** (the open row), plus the keyboard-focus and open-menu causes above for a tablet with a keyboard. No other row shows a toolbar. Targets 44 px (NFR-017), as built.

**Layout.** Showing the toolbar adds its line to that row and moves the rows below down, with no animation. The toolbar belongs to the same list item as the row, so moving the pointer from the row down onto its toolbar keeps it. Developers check: moving the pointer slowly down five rows shows one toolbar at a time with no flicker between two rows. If a row flips, hide the toolbar 100 ms after the pointer leaves (never delay showing).

**After a row is added** (from the "+" menu, from the direct Fastener "+", or from `Add main assembly`; by mouse, keyboard or touch):

1. The new row appears **last under its parent**; a closed parent opens. It is numbered by position.
2. It is **selected**: it has `aria-current="true"` and the form shows its inputs (section 01, Description empty).
3. **Focus moves to the new row's link** (CR-01 item 3C AC-3, as built; it keeps the person in the tree to add the next row; Enter on the link moves focus into the form, as built).
4. The tree scrolls the row into view (`block: nearest`).
5. The status of item 2 is announced.
6. **Toolbar**: mouse, **none visible** anywhere unless a row is hovered; keyboard, the new row's toolbar is in view because focus is in it, and goes when focus leaves; touch, the new row's toolbar is in view because it is the selected row.
7. On a phone the tree drawer stays open with the new row selected; tapping the row closes the drawer and shows the form (as for any row).

A mouse add must not leave the toolbar in view by the browser treating the script focus as keyboard focus. If Chrome or Edge shows `:focus-visible` after a mouse add, the code remembers the input type of the choosing press (the build already knows `event.detail === 0` for a key) and suppresses the look for that one focus.

## 4. The "+" menu, per kind

Header of every menu (as the mock-up, `aria-hidden` text, the menu is named by its `aria-label`): `Add under <Sl. No> <name>`, for example `Add under 1 Control cabinet assembly`. Each item is a kind tile (the same tile as the tree) with the kind's name in bold and one hint line. Items are `role="menuitem"`; arrow keys move, Enter or Space chooses, Escape closes and returns focus to the "+". The menu opens **in line under its row** (spec row 3: "so the panel never clips it").

| Row | "+" | Items, in this order | Hint under each (exact) |
|---|---|---|---|
| Main Assembly | Menu | 1 `Sub-Assembly` · 2 `Part` · 3 `Fastener` | `A group of parts and fasteners` · `Called "Sub-part" when there are two or more here` · `A bought-out item, same inputs as a part` |
| Sub-Assembly | Menu | 1 `Part` · 2 `Fastener` | `Called "Sub-part" when there are two or more here` · `A bought-out item, same inputs as a part` |
| Part or Sub-part | **No menu**: adds a Fastener at once | none | Tooltip and spoken name: `Add fastener under <Sl. No> <name>` |
| Fastener | None (the space is kept so the toolbars line up) | none | none |
| Foot of the tree | `Add main assembly` button, adds a Main Assembly at once | none | none |

The order is the table `ALLOWED_CHILDREN` (`node-kinds.ts`) and the hints for Part and Fastener are the mock-up's own words. The Main Assembly menu was not drawn on SCR-05 (only row 1.1's menu is); the Sub-Assembly line and its hint are new. The build's menu has no header and no hints: add them.

**Sub-part is not an item, and the design is not missing it.** SPEC 6.1: "A part is named 'Part' when it is the only part under its parent and 'Sub-part' when there are two or more under it" (and acceptance criterion 31, FR-043, BR-062, D-44, DL-299, ADR-020 K1: four kinds are stored, Sub-part is derived). A Part and a Sub-part are the same row with the same inputs; they differ only in a name that follows the siblings. A "Sub-part" item would let someone make the only part a Sub-part, or a second Part still called "Part", and the name would then contradict the rule and the server's table. The way a person gets a Sub-part is to add a second Part: the menu hint says so, and the polite announcement says which row changed (item 2). **If the delivery lead or the customer now wants Sub-part as a choice of its own, that is a change of requirement** (product-manager: FR-043, BR-062, §6.1; solution-architect: ADR-020 K1; developer: `ALLOWED_CHILDREN`, tests 14.30 and 14.31), and the business-analyst should first confirm with the customer what a Sub-part is to them, because under this tree a Part can hold only a Fastener. I have not drawn that option. Nothing in the build today needs to change for it, apart from the header and hints above.

## Checks (developer and tester; each is one assertion)

| ID | Check |
|---|---|
| NAME-1 | A part with Description `Base frame` shows `Base frame` in the tree on SCR-05, SCR-06 and SCR-07, and nowhere shows `Part` for it |
| NAME-2 | Description empty, Part No. `XP-1101`: the row shows `XP-1101` |
| NAME-3 | Both empty: a Sub-Assembly shows `Sub-Assembly`, italic, with `, no description yet` in its accessible name; a fresh Fastener shows `Fastener`; a second Part under a parent shows `Sub-part` and the first changes to `Sub-part` too |
| NAME-4 | Type `Base frame` in Description and Tab away: the tree row reads `Base frame` before any save; reload: still `Base frame` |
| NAME-5 | Clear it: the row falls back by the order above |
| NAME-6 | The tree answer for an Engineer carries `label` with the typed text and no figure (the cost-confidentiality scan stays green) |
| KIND-1 | Five rows of the five kinds show glyphs `Boxes`, `Blocks`, `Box`, `Box`, `Bolt` on the tiles of the table, each tile with its tooltip and `aria-label` |
| TB-1 | Desktop, mouse: with the pointer outside the tree, no row's toolbar is in view, including the open row and a just-added row |
| TB-2 | Hover a row: its toolbar is in view under it; move off: it goes |
| TB-3 | Tab onto a row's link: its toolbar is in view before the next Tab; Tab out: it goes |
| TB-4 | Add by mouse: the new row is open, has focus, and no toolbar is in view anywhere |
| TB-5 | Add by keyboard: focus is on the new row's link and its toolbar is in view; the status reads `Added 1.5 Part. Type a Description to name it.` |
| TB-6 | Phone and tablet touch (coarse pointer): only the selected row shows a toolbar; tapping another row moves it |
| MENU-1 | Main Assembly "+" lists `Sub-Assembly`, `Part`, `Fastener` in that order, with the header and hints; Sub-Assembly "+" lists `Part`, `Fastener`; neither lists `Sub-part` |
| MENU-2 | Part and Sub-part "+" opens no menu and adds a Fastener, named `Add fastener under <Sl. No> <name>`; a Fastener has no "+" |

Accessibility notes: the name is real text (no tooltip-only name); the muted style is `--ink-2`, not `--ink-3`, and the italic is a second cue to the placeholder, so colour is not the only one (WCAG 1.4.1); announcements are polite `status` (4.1.3); the hint is tied to the field with `aria-describedby` (3.3.2); every toolbar button stays 28 px or more on a fine pointer and 44 px on touch (2.5.8); the toolbar is reachable by keyboard whether in view or not (2.1.1, 2.4.7); drag has the Move up / Move down alternative (2.5.7, as built).

## For the CR-01 session (the files I did not touch)

1. **ux-spec.md, section 0.9 row 3**, add after "Part or Sub-part is named automatically": "A row's name is its Description, else its Part No., else the kind's own name in a muted style (no separate name field). The Description's hint reads 'Names this row in the parts tree.'"
2. **ux-spec.md, row 3 "Row actions"**, replace "on hover or keyboard focus a small toolbar floats over the end of the row ... on touch screens it shows in line on the selected row" with: "the toolbar sits under the row (DEF-075); with a mouse it shows on the hovered row and on keyboard focus, never because a row is open; on touch only on the selected row."
3. **ux-spec.md SCR-05** (lines 614 to 665): the `Part Name` in the DL-219 paragraph is the Description; delete it from the list. The wireframe's toolbar `[+Sub-part][+Beside][↑][↓][Delete]` is the old one and should be replaced by the toolbar of row 3.
4. **SCR-05.html and the generator**: draw the Main Assembly "+" menu (state "Add under a row (+)" on row 1); give the Sub-Assembly menu its header and hints as in item 4; add the hint under Description; make the mock-up's Description for 1.1 read `Base frame` (it reads `Base frame, laser cut, 4 bends`, which does not match the tree's `Base frame`); show one unnamed row (`Sub-Assembly`, muted, italic); change the toolbar on the open row 1.1 so it is in view only on hover and focus (mouse) and add a touch note.

## Hand-off notes

- No decision of the delivery lead is changed. Two things are new design: the naming rule (item 2) and the Main Assembly menu's third line and hint (item 4). Both are the smallest design that the rest of the product already assumes.
- Open question for the product-manager, not blocking today: does the customer want a short name separate from Description (a new column in the file)? Owner product-manager, needed by the end of the hardening window.
- Open question for the business-analyst, only if the delivery lead wants Sub-part as a choice: what does the customer mean by a Sub-part under this tree?
