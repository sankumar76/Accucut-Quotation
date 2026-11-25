# UX ruling: parts-tree rows, built UI against the SCR-05 mock-up (DEF-081, AQP-424, GH #706; story AQP-404, CR-01 item 3B)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-24 |
| Scope | Styling only. No behaviour, no figure, no cost data. The Engineer view still shows no cost, rate or formula. |
| Read from | `origin/master` `c7faf76f` (`git show origin/master:<path>`): `SCR-05.html`, `screens.css`, `ux-spec.md` row 3 of section 0.9 (line 201), `node-kind-icon.tsx`, `tree-node.tsx`, `parts-tree-list.tsx`, `tree-legend.tsx`, `add-node-menu-panel.tsx`, `globals.css`, `design-tokens.ts`, `parts-tree-markup.test.ts`. Lucide glyphs checked in `lucide-react@1.73.0` (the version `master` pins), from the npm tarball. |
| Main checkout's uncommitted edits | Read only (diffed against `origin/master`). **They change none of the nine points.** The working copy of `screens.css` and `SCR-05.html` is older than `master` (it lacks the later 36 px / fine-pointer rule; SCR-05 differs only in one review-note sentence). The tree rules (`.kind-*`, `.tree-item.is-active`, `.tree-no`, `.tree-row::before`, `.tree-twist`) are identical. `ux-spec.md` row 3 differs only by the trailing "Built" column. |
| Render | None. No browser was available (the Playwright and Chrome DevTools servers did not connect). Contrast figures are computed with the WCAG formula from the token hex values; sizes are from CSS and class names. The developer should look at the legend at 100 % and 200 % zoom once. |

## How to read the rulings

The spec (row 3) says only: an icon per kind (Main "stacked blocks", Sub "grouped blocks", Part and Sub-part "one block", Fastener "hex nut"), kind told by shape first and tint second, a status icon at the end, thin guide lines. **It is silent on the tile, on which colour goes with which kind, on the open-row look and on the number font.** Where the spec is silent, the mock-up is the only statement of intent and the customer reviewed it, so the build follows it unless it breaks a rule (NFR-017 touch size, NFR-018 not colour alone, WCAG 2.2 AA). Tokens are the existing ones; no colour is added.

## Rulings

| # | Point | Verdict | Exact target (build) |
|---|---|---|---|
| 1 | Kind icon | **Change build to match mock-up** | A tile, not a bare icon. Tile: `inline-flex size-s-5 shrink-0 items-center justify-center rounded-sm` (24 x 24, 4 px radius = `--radius-sm`). Glyph: `size="default"` (18 px, `ICON_SIZE.default`) with `strokeWidth={1.75}`. Fill and glyph colour per kind in row 3. The legend and the "+" menu use the same tile. |
| 2 | Glyphs | **Change build to match mock-up** (the build is not right) | `MAIN_ASSEMBLY = Boxes`, `SUB_ASSEMBLY = Blocks`, `PART = Box` (unchanged), `FASTENER = Bolt` (see 7a). Import `Blocks` and `Bolt`; drop `Layers` and `Nut`. |
| 3 | Tints | **Change build to match mock-up** | `MAIN_ASSEMBLY`: `bg-primary-soft text-primary-ink`. `SUB_ASSEMBLY`: `bg-accent-soft text-accent-ink`. `PART`: `bg-surface-2 text-ink-2`. `FASTENER`: `bg-info-soft text-info-ink`. (Info is a neutral graphite slate, #333945, not blue.) |
| 4 | Open row | **Change build to match mock-up** | Replace `aria-[current=true]:border-primary-line aria-[current=true]:bg-primary-soft` with `aria-[current=true]:bg-surface-2` plus a 4 px left bar in `--primary`: `aria-[current=true]:shadow-[inset_var(--s-1)_0_0_var(--primary)]`. Keep `aria-[current=true]:font-semibold` (600). Drop `border border-transparent` (it only held the old border and would push the bar 1 px in). Keep `hover:bg-surface-2`. |
| 5 | Number | **Change build to match mock-up** | `shrink-0 font-mono text-label text-ink-2` (IBM Plex Mono 12/16, `--ink-2`); keep `data-sl-no`. `tabular-nums` is no longer needed. Make it one shared class constant used by `tree-node.tsx` and `review-tree.tsx` (the review row already uses `text-ink-2 tabular-nums`, so the two trees differ from each other today). The open row's 600 weight still applies to it, as in the mock-up. |
| 6 | Complete status | **Change build to match mock-up** | `COMPLETE = CircleCheck` (lucide: ring r10 with a tick), kept `text-success`. As in the mock-up, also: `PARTIAL = Contrast` stays but moves from `text-ink-3` to `text-ink-2`; `EMPTY = Circle` stays `text-ink-3`; all three at `size="default"` (18 px) instead of `small` (16). The three share one outer ring, so the column reads as one set. Keep `aria-hidden` and the `sr-only` words (the E2E asserts both). |
| 7 | Guide lines | **Keep build** (the mock-up has lines too; only the geometry differs) | No change: `ml-s-5 border-l border-border` on each nested `ul` (1 px `--border`, 24 px indent). A real border is sturdier than the mock-up's gradient and follows the 44 px arrow cell. See 7b if the desktop row is compacted. |
| 7a | Fastener glyph | **Change build** (mock-up right; matches spec "hex nut") | `Bolt` (hexagon with a round bore). Lucide `Nut` is a food nut at 1.66.0 and unchanged at 1.73.0 (organic outline and a stem stroke, no six-sided shape), so it contradicts the spec words "hex nut". Lucide has no true hex-nut glyph; a custom SVG would be a new asset and needs the delivery lead. |
| 7b | Arrow cell and row height | **Keep build on touch and below 1024 px; change build for a mouse at 1024 px and wider (updated 2026-11-24 after the 1280 px comparison: see item 12)** | Keep the 44 x 44 arrow cell and 44 px row on a touch screen or one narrower than 1024 px (NFR-017; spec section 0.9 row 1: "touch screens and anything narrower keep the 44 px target", OQ-PM-12). Required for a mouse (was optional; see item 12): at `fine-wide:` (1024 px and wider with a mouse) make `ARROW_CELL` `fine-wide:min-h-(--compact-field-h) fine-wide:w-s-5` (24 x 36, meets WCAG 2.5.8), so the row is 36 px as the link already intends; today the 44 px arrow cell holds the row at 44 px even where the link asks for 36. If done, set the nested list to `fine-wide:ml-s-3 fine-wide:pl-s-2` so the guide line stays under the arrow's centre.  |

## Reasons, spec lines and accessibility, item by item

**1. Tile.** Spec: nothing on the tile (row 3 says "an icon for the kind"); the mock-up (`.kind-ic`, css:602-603) is the intent. A tinted tile gives the glyph a fixed 24 px footprint, so rows align whatever the glyph, and the tint reads as a chip rather than a thin coloured line. The tile is decoration; the **glyph** carries the kind, so the 3:1 non-text rule applies to glyph against tile. All four pass: `--primary-ink` on `--primary-soft` 5.67:1, `--accent-ink` on `--accent-soft` 6.92:1, `--info-ink` on `--info-soft` 9.98:1 (the three pairs printed in ux-spec 7.3 and held by `CONTRAST_PAIRS`), `--ink-2` on `--surface-2` 7.27:1 (computed; the pair is in `CONTRAST_PAIRS` too). The Part tile has the same fill as the open and hovered row, so on those rows only the glyph shows; the glyph keeps 7.27:1, so nothing is lost.
Build notes. Keep `data-node-kind` on the svg (tests read it) and put the tint classes on the tile. Keep `role="img"`, `aria-label` and `<title>` on the svg, so the tooltip shows over the glyph, and the legend variant (no label) stays `aria-hidden`. `add-node-menu-panel.tsx:51` draws `NODE_KIND_ICON[...]` bare; switch it to `<NodeKindIcon kind={nodeKind} />` so the menu matches (the mock-up's `.add-opt` uses the tile). The mock-up legend tile is 22 px with a 16 px glyph; use the same 24 / 18 tile so the legend looks exactly like the rows it names (the spec sets no legend size). `parts-tree-markup.test.ts:55-56` pins `['layers','boxes','box','nut']`; update it to `['boxes','blocks','box','bolt']`. Its tint test reads the first `text-...` class, so keep a `text-*` class on the tile.

**2. Glyphs.** Spec: Main "stacked blocks", Sub "grouped blocks", Part "one block". `Layers` is stacked sheets, not blocks, so it does not meet "stacked blocks"; `Boxes` (three cubes piled up) does, and it is the usual CAD assembly icon, which is the customer's "manner of a CAD feature tree". `Blocks` (an L-shaped block with a loose square) reads as "grouped blocks" and is clearly unlike `Box`. The build's Sub glyph (`Boxes`) was the same cube family as Part, which weakens shape-first. NFR-018 holds with the mock-up set: four different outlines, plus tooltip, spoken name, number and the legend. `Boxes` against `Box` (three cubes against one) differ by count; at 18 px in a tile that is visible, but check it once at 100 % zoom. Use the library glyphs, not the mock-up's pasted paths (the mock-up's `Blocks` is from an older version: a 7 px square at 14,3 against 8 px at 14,2 in 1.73.0).

**3. Tints.** Spec: only "tint second". The mock-up gives red to Main, amber to Sub, grey to Part and graphite to Fastener. Reason to follow it: amber is the system's attention colour (spec 7.3: "overdue and attention"); fasteners are the most numerous rows in a real tree, so amber there would pull the eye away from the structure, while Sub-Assemblies are few. Red, amber, neutral also orders the tree by weight. **Limitation to accept:** the Part tint (`--ink-2` on `--surface-2`) and the Fastener tint (`--info-ink` on `--info-soft`) are close, because the palette has no blue ("no blue in this brand", css:82). They are told apart by shape, tooltip and legend, which is what the spec asks ("shape first"). Do not describe the tints as what tells the kinds apart in the PR or test names. No new colour without the product-manager.

**4. Open row.** Spec: nothing on the row; spec 7.3 names `--primary` for "active marker". Why the mock-up wins. (a) The build's cue is a `--primary-soft` fill (about 1.1:1 on white) and a `--primary-line` edge (**1.71:1** on white, computed), neither near the 3:1 that WCAG 1.4.11 asks of a state indicator; only the 600 weight and `aria-current` remain. The bar is `--primary` on the row fill: **3.96:1 on `--surface-2`** and 4.59:1 on white (7.3), so it passes. (b) The pink fill and edge are the look of the brand badge (`badge.tsx`, `brand`) and of the picture drop target (`part-picture.tsx`), and `--primary-soft` is almost `--danger-soft` (#FDECEC against #FCEDEB), so an open row can be mistaken for a row in error. (c) A bar is a shape: bar, weight 600 and `aria-current="true"` are three cues, so the open row is not told by colour alone. axe: no text contrast changes (`--ink` on `--surface-2` is 15.5:1). **Windows forced colours:** shadows are not drawn there (the spec already accepts this for the table hairline, line 456), so the bar disappears; weight and `aria-current` remain. Optional hardening: `forced-colors:aria-[current=true]:outline-2 forced-colors:aria-[current=true]:outline-[Highlight]`. The 3 px `--focus` ring is unchanged and must still show on an open row.

**5. Number.** Spec: nothing (7.1 names mono for column letters, formulas and tags, which are identifiers; a row number is one). A 12 px `--ink-2` number lets the name lead and the number read as a reference, which is the mock-up's intent. Contrast: `--ink-2` on white 8.43:1, on `--surface-2` 7.27:1 (12 px text needs 4.5:1). Width: Plex Mono at 12 px is about 7.2 px a character, so "1.2.3.4" is about 50 px, no wider than the 14 px sans digits it replaces; names already wrap (`BREAK_LONG_NAMES`), so nothing overflows at 360 px. Low severity.

**6. Complete status.** Spec: "check, half circle, empty circle" (ux-spec.md:689). A circled check is a check, so both builds comply; the mock-up wins because all three share one outer ring, so the eye reads one status column, and the shapes still differ (ring, half-filled ring, ring with tick). Colour is never the only signal: shape plus the `sr-only` words. Glyph contrast (non-text, 3:1): `--success` on white 5.08:1 and on `--surface-2` (open and hovered row) 4.39:1; `--ink-2` 7.27:1 and `--ink-3` 5.33:1 on `--surface-2`. The status icons are not controls, so no target-size rule applies.

**7. Guide lines.** The premise that the mock-up has none is not right: `screens.css:613-614` draws a 1 px `--border` line per level every 20 px, 11 px in. Spec: "thin guide lines mark each level". The build draws them as a real left border on each nested list, 24 px per level. Different geometry, same meaning, both thin and `--border`; they are decoration (indentation and list nesting carry the level), so no 3:1 is owed. Keep the build: a border survives forced-colours mode more surely than a gradient, and the 24 px step follows the 44 px arrow cell.

**7a. Fastener glyph.** See the table. `Bolt` is a hexagon with a round bore, i.e. the face of a nut. It shares the hexagon outline with `Box` (a hexagon with a Y inside); at 18 px the circle and the Y differ clearly, and the tint, tooltip and legend add to it. Verified in 1.73.0 that `Nut`'s paths are the organic ones (`M16.847 5.847 ...`, and a stem stroke `M4.93 4.93 3 3 ...`).

**7b. Arrow cell and row height.** The 44 px sizes are right on touch and are not a defect (NFR-017). The mock-up's 24 px arrow and 36 px row are right only for a mouse at 1024 px and wider; see the optional compaction above (24 x 36 passes WCAG 2.5.8).

## Where the mock-up and the spec disagree, and gaps (for the CR-01 UX session; I have not edited them)

1. **Touch size on tablets.** Mock-up `screens.css:640` raises `.tree-twist` and `.tree-act` to 44 px only at `max-width: 767px`. From 768 to 1023 px (and on any touch screen at 1024 and up) the arrow is 24 px and the row 36 px. Spec section 0.9 row 1 and OQ-PM-12 say touch screens and anything narrower than 1024 px keep 44 px. **The spec wins.** Mock-up fix: `@media (max-width: 1023px), (pointer: coarse)`.
2. **Spec gap.** Row 3 does not state the tile, the glyph names, the kind-to-tint table, the open-row style or the number font, so mock-up and build can drift. Suggested sentence for row 3: "Each icon sits on a 24 px tinted tile (Main Assembly red, Sub-Assembly amber, Part and Sub-part grey, Fastener graphite; glyphs Boxes, Blocks, Box, Bolt). The open row has a grey fill, a 4 px red bar on its left and weight 600. The number is IBM Plex Mono 12 px, `--ink-2`." Also record that the Part and Fastener tints are close and that shape carries the kind.
3. **Legend size.** The mock-up legend tile is 22 px (`.tree-legend .kind-ic`), the rows 24 px. The ruling uses one size; the mock-up could drop the 22 px rule.
4. **Arrow cell on desktop.** If the optional compaction in 7b is accepted, record the 24 x 36 arrow for a fine pointer in the spec; the mock-up already draws it.

## Proof the developer should give (styling only)

- Unit: update the shapes in `parts-tree-markup.test.ts` to `['boxes','blocks','box','bolt']`; keep the four-distinct-shapes and four-distinct-tints checks; add one assertion that the open row has the bar class and no `bg-primary-soft`.
- E2E: the existing tree spec and the axe case stay green at 360, 768 and 1366 px. No new axe rule is expected.
- First-load size of `/estimates/[code]` stated (`Blocks`, `Bolt` and `CircleCheck` are small paths; `Layers` and `Nut` leave the bundle).
- The review tree (SCR-06, SCR-07) uses the same `NodeKindIcon` and number: check it shows the same tile and number.

## For the defect file (DEF-081, "Ruling" table; QA fills it in, `docs/07-qa/` is not mine)

| # | Point | Ruling | By / date |
|---|---|---|---|
| 1 | Kind icon tile | Mock-up right: 24 px tile, `rounded-sm`, 18 px glyph, stroke 1.75 | ux-expert, 2026-11-24 |
| 2 | Glyphs | Mock-up right: Boxes, Blocks, Box, Bolt | ux-expert, 2026-11-24 |
| 3 | Tints | Mock-up right: Sub accent, Fastener info (neutral slate) | ux-expert, 2026-11-24 |
| 4 | Open row | Mock-up right: `--surface-2`, 4 px `--primary` bar, 600 | ux-expert, 2026-11-24 |
| 5 | Number font | Mock-up right: mono, `text-label`, `text-ink-2` | ux-expert, 2026-11-24 |
| 6 | Complete-status icon | Mock-up right: `CircleCheck`; partial `text-ink-2`; 18 px | ux-expert, 2026-11-24 |
| 7 | Guide-line geometry | Build right: keep | ux-expert, 2026-11-24 |
| 7a | Fastener glyph | Mock-up right: `Bolt`; `Nut` is a food nut | ux-expert, 2026-11-24 |
| 7b | Arrow cell and row height | Build right on touch and below 1024 px (NFR-017); change to 24 x 36 at fine pointer 1024+ (item 12) | ux-expert, 2026-11-24 |


---

# 1280 px comparison (added 2026-11-24, at the delivery lead's request relayed by QA)

**Status at the pause (2026-11-24): PARTIAL as to evidence, COMPLETE as to rulings.** All 15 items below are ruled. The evidence is a static render of the real components with the real CSS (no running page, no E2E run, states other than default, hover and focus not rendered), and the cause of the #707 tablet axe failure is not proven. Screenshots listed below all exist. Nothing is committed by me.

Rule used here, as the delivery lead set it: **the built tree looks like the SCR-05 mock-up on `master` unless there is a stated reason** (an accessibility rule such as WCAG 2.2 AA or NFR-017, or a defect fix). Every "keep build" below gives its reason in plain words.

## How the two were compared, and what is not shown

| | |
|---|---|
| Mock-up | `docs/03-ux/screens/SCR-05.html` and `screens.css` from `master` `c7faf76f` (`git archive`), opened in headless Chromium at 1280 x 900, device scale 2. The main checkout's working copy was not used. |
| Build, `master` | The **real** components (`PartsTreeList`, `TreeNode`, `RowActions`, `TreeLegend`, `Button`, `Card`) of `master` `c7faf76f`, rendered to static markup with the same twelve rows as the mock-up (same names, kinds, completeness, row 1.1 open), and styled with the project's **own compiled Tailwind and `globals.css`**, in the same Chromium at 1280 px. IBM Plex fonts were loaded from the mock-up's `fonts/` folder, because the real page gets them from `next/font`. |
| Build, #707 | The same, from `4df117e5` (branch `fix/AQP-424-parts-tree-mockup`). |
| **Not a running page** | I could not run the E2E set-up: it needs the lane worktree (`aqp-398`, not mine to change) and a test database and servers, and the Playwright and Chrome servers were down. Nothing was started, so nothing needed stopping. So this is **not** the page with the sidebar, top bar, live data, sticky bars or scrolling. It shows the tree column faithfully, in its default state, hover and focus. States not rendered: Calculate blocked (triangle), drag line, "+" menu, delete dialog, read-only, the Lead's figures. |
| The delivery lead's observations | All confirmed by the render of `master` (below). |

Screenshots, all in `C:\Users\sanku\AppData\Local\Temp\claude\859e50c63dd2e28b\7796688b-a5ea-486d-ad8c-2c45e904009d\scratchpad\tree-compare\`:

| File | Shows |
|---|---|
| `mockup-1280-tree.png`, `mockup-1280-full.png` | Mock-up tree card, and the whole screen |
| `mockup-1280-tree-hover-1.1.1.png`, `mockup-1280-tree-hover-1.1.3.png` | Mock-up with the pointer on a row: the floating toolbar |
| `build-master-1280-tree.png`, `build-master-1280-full.png` | Build on `master` |
| `build-master-1280-tree-hover-1.1.1.png`, `build-master-1280-tree-focus-1.1.1.png` | Build on `master`: hover (only a tint) and keyboard focus |
| `build-707-1280-tree.png`, `build-707-1280-full.png`, `build-707-1280-tree-hover-1.1.1.png`, `build-707-1280-tree-focus-1.1.1.png` | The same for PR #707 |
| `build-master-768-tree.png`, `build-707-768-tree.png`, `build-master-1023-tree.png`, `build-707-1023-tree.png` | Tablet widths |
| `build-master.html`, `build-707.html`, `shoot.mjs`, `shoot.json` | The rendered pages, the script and the measurements |

## What was measured (CSS pixels, row 1.1.1)

| Thing | Mock-up | Build on `master` | PR #707 |
|---|---|---|---|
| Tree column width | **320** (`screens.css:673`, `.ws:has(.tree-row) { --tree-w: 320px }`) | 288 (`--tree-w`) | 288 |
| Header | Card head "**Parts tree**" and "**12 rows**" | **None.** The only heading in the area is "Parts and inputs", the title of the card that holds both tree and form | none |
| Kind icon | 24 px tile, 18 px glyph | bare 20 px icon | 24 px tile, 18 px glyph |
| Number | Plex Mono 12 px | Plex Sans 14 px | Plex Mono 12 px |
| Status icon | 18 px circled check | 16 px plain check | 18 px circled check |
| Open row | `rgb(238,238,240)` fill, `rgb(222,48,48) 4px inset` bar | `rgb(253,236,236)` fill, `rgb(242,184,184)` 1 px edge | as the mock-up |
| Arrow, row height | 24 px arrow, 36 px row | 44 px arrow, row 44 px | 44 px, 44 px |
| Toolbar | floating, 92 x 32, right 2 px, top 4 px, on hover of any row | own 42 px line under the open or focused row only, red icons | as `master` |
| Tree column height (12 rows) | 743 (card) | 777 | **797** (+20) |
| Tree column height at 768 and 1023 px | not drawn | 699 | **707** (+8, the legend only) |

## The complete ruled list (items 1 to 7b as ruled above, and the new items 8 to 15)

"#707" says whether PR #707 (`4df117e5`) already does it. I read its diff and rendered it: it implements my rulings 1, 2, 3, 4, 5, 6 and 7a and nothing else.

| # | Element | Verdict | Exact target | Reason when keeping the build | #707 |
|---|---|---|---|---|---|
| 1 | Kind icon tile | Change build | 24 px tile, `rounded-sm`, 18 px glyph, stroke 1.75 | | Done |
| 2 | Kind glyphs | Change build | Boxes, Blocks, Box | | Done |
| 3 | Kind tints | Change build | Sub accent, Fastener info | | Done |
| 4 | Open row | Change build | `bg-surface-2`, 4 px `--primary` inset bar, 600 | | Done |
| 5 | Row number | Change build | `font-mono text-label text-ink-2` | | Done |
| 6 | Status icons | Change build | `CircleCheck`, `Contrast` in `text-ink-2`, `Circle`; 18 px | | Done |
| 7 | Guide lines | Keep build (geometry per item 12 on a mouse) | `border-l border-border` | The mock-up has them too; the build's real border shows in Windows high-contrast mode, a gradient may not | n/a |
| 7a | Fastener glyph | Change build | `Bolt` | | Done (the render of `master` shows `Nut` as an acorn-like shape) |
| 7b / **12** | Arrow cell, row height, indent | **Change build for a mouse at 1024 px and wider; keep 44 px on touch and below 1024 px** | See item 12 | 44 px stays where a finger is the pointer (NFR-017; spec section 0.9 row 1: touch and anything narrower keep 44 px) | **No** |
| **8** | Row toolbar: place and when it shows | **Keep build.** Mock-up and spec are the ones to change | Under the name, on the open row and on a row with keyboard focus, no hover reveal (ux-expert design, AQP-406 comment 12939, DL-346). Update SCR-05 and spec row 3 | Hovering a row in the mock-up hides the name and the status icon behind the toolbar (see `mockup-1280-tree-hover-1.1.1.png`: "Corn" and no status). In the build's 288 px column a floating toolbar (3 x 36 px buttons, about 110 px) would cover most of a deep row's name, so a press on the name lands on a button; that is DEF-075, where a press at the centre of a Part opened the move menu. Showing it on hover in line makes the rows below jump under the pointer (DEF-076). | n/a |
| **9** | Toolbar icon colour | **Change build to match mock-up** | Handle, "+" and "-" at rest: `text-ink-2` (8.43:1 on `--surface`). Hover: `hover:bg-surface-2 hover:text-ink`; pressed: `active:bg-border active:text-ink active:shadow-pressed` (the secondary look, spec 7.3.1). "-" on hover: `hover:bg-danger-soft hover:text-danger` (5.74:1). Today the three use the `ghost` variant (`text-primary-ink`) and the "-" `text-danger-ink`, so they are red at rest | | **No** |
| **10** | Tree header and count | **Change build to match mock-up** | The tree sits in a **card of its own** beside the form's card: head with "Parts tree" (`text-sub font-semibold`, an `h2`) on the left and "12 rows" on the right (`text-label text-ink-3`; "1 row" for one), a hairline under the head. The form column needs no card of its own (see the correction of 2026-11-25 at the end of this note); keep its title "Parts and inputs" as the group's accessible name (the rows' links point to it). Count is every row, open or closed. Optionally name the `nav` "Parts tree, 12 rows" as the mock-up does. On tablet and phone the same head sits above the list inside the panel and the drawer | | **No** |
| **11** | Tree column width | **Change build to match mock-up** (the spec's 288 px is the thing to update) | `--tree-w: 320px` | Names wrap at 288 px (see `build-707-1280-tree.png`: "Control cabinet assembly" and "Corner gusset" take two lines, and #707 made it worse than `master`, where the first took one; in the mock-up at 320 px both take one). This is evidence for width, not an accessibility rule, so I rule for the mock-up, which the delivery lead calls the agreed design. The spec (SCR-05 "Layout") says 288 px and resizable 240 to 400; the mock-up's own CSS says 320 | | **No** |
| **12** | Arrow cell, row height and indent on a mouse | **Change build** | At `fine-wide:` (1024 px and wider, mouse): `ARROW_CELL` becomes `fine-wide:w-s-5 fine-wide:min-h-(--compact-field-h)` (24 wide, 36 high, meets WCAG 2.5.8) so the row is 36 px, as the link already asks; nested list `fine-wide:ml-s-3 fine-wide:pl-s-2` so the guide line stays under the arrow's centre and each level steps about 20 px. Below 1024 px and on touch: unchanged (44 px, 24 px indent) | Touch size only (see 7b). On a mouse there is no reason to keep 44 px: today the 44 px arrow holds the row at 44 px although the link asks for 36 | **No** |
| **13** | "Add main assembly" | **Change build to match mock-up** | A hairline (`border-t border-border`, space above and below) then a `ghost` Button with the "+" icon, left-aligned (`primary-ink` text, 6.48:1; the words and the "+" are the cue). Height stays 44 px (`--control-h`), as the mock-up's. Today it is an outlined `secondary` button with no line above | | **No** |
| **14** | Legends at the foot | **Change build to match mock-up** (words stay the build's) | (a) No visible "Row kinds" title and no line above the legend; keep `aria-label="Row kinds"` on the section. (b) Add the **status legend** the mock-up has under it: the same icons at 18 px in the same inks (`CircleCheck` `text-success`, `Contrast` `text-ink-2`, `Circle` `text-ink-3`, `TriangleAlert` `text-danger`) with the words the build already speaks to screen readers: "All inputs entered", "Some inputs entered", "No inputs yet", "Missing inputs" (STORY-05.11 AC-4, `estimate-texts.ts`). (c) Kind legend uses the same 24 px tile as the rows (the mock-up's 22 px is not kept; see ruling 1) | Words: the mock-up says "Complete / In progress / Not started / Missing data", but the build's words are an accepted acceptance criterion and a key that differs from what a screen reader says is confusing. Mock-up wording to be aligned by the CR-01 session | **No** (#707 only puts the tile in the kind legend) |
| **15** | Tree resize handle | **Ruled 2026-11-24: build before the freeze; see "Item 15 specification" below** | Spec SCR-05 asks for a resizable tree (240 to 400 px, mouse or arrow keys); the mock-up has `.tree-handle`; the build has no handle (`lg:w-(--tree-w)` fixed) | | n/a |

### Why items 8 to 15 are not in #707 and what to do

Items 9, 10, 12, 13, 14 and 11 are small styling changes. They can go into #707 or a second styling PR, as the delivery lead and the orchestrator choose. Item 10 changes the page frame (`estimate-workspace.tsx`, a second card), so it is the largest. **Item 8 must not be built:** it would bring back DEF-075 and DEF-076. If the delivery lead wants the floating toolbar anyway, the least-bad version is the mock-up's own: 28 px buttons, `pointer-events: none` while hidden, shown on hover and focus-within, only at `fine-wide:` with the compact 24 px arrow and 320 px column, and the delivery lead accepts that the name and status are covered while the pointer is on the row. It would need the test of AQP-418 (centre press on a short row at 1366 px) to pass again, and DEF-076's press-hold. I advise against it.

**Decision still open for the product-manager** (from comment 12939, section 7): the customer saw the floating toolbar, so the next customer review should show the under-the-name toolbar, or the customer is told. The ux-spec row 3 text ("floats over the end of the row on hover") and SCR-05 are still the old version; the CR-01 UX session owns them.

## PR #707: the red tablet test (`estimate-save.spec.ts:304`, axe `target-size`)

What I can say from the render, not from the failing run (no artefact was kept, and I could not run the spec):

1. **#707 does make the tree column taller:** +8 px at 768 and 1023 px (699 to 707), +20 px at 1280. At tablet the whole 8 px is the **legend**: its tiles are 24 px, the old icons 16 px. The rows do not change height at 768 px: each is 44 px (the arrow cell) and the tile is 24 px. So the form below the tree moves down by 8 px at tablet. The tree is above the form at that width, which fits the developer's suspicion.
2. **The tile cannot itself fail WCAG 2.5.8.** It is not a control; the rule counts buttons and links. Every tree control is 44 x 44 px at tablet (arrow, link row, toolbar buttons), well above 24 px.
3. The flagged target is the form panel's notice button, with the top bar's "Open menu" and two header elements as the overlapped neighbours. That is a button **under the sticky top bar**, a position that depends on the scroll offset. An 8 px shift can move a button into or out of that band. So the shift is the trigger, and the likely cause is a button that can sit beneath the sticky bar after a scroll. That would be a defect of its own (spec: the sticky bar must not hide a focused field, WCAG 2.4.11 and the scroll padding of UX-14), present on `master` and uncovered by the shift. **Not proven.**
4. **Ruling on tile size and spacing: keep the 24 px tile and the spacing as ruled. No change is needed for WCAG 2.5.8 at any width.** Making the legend smaller would not remove the cause: the mock-up's own 22 px legend tile still adds 6 px, and any change of height above the form can move that button. Do not shrink the tiles to make this test pass.
5. **Next step, for the developer:** run `estimate-save.spec.ts:304` on the tablet project of #707 with a screenshot at the axe call, and read which element covers the button. If it is the sticky top bar, fix it in the form panel (scroll margin for the notice's buttons equal to the top bar's height, so a scrolled-to button is never under it), not in the tree. If it is something else, send me the screenshot.

## Mock-up, spec and build disagreements found in this round (for the CR-01 UX session; I have not edited them)

1. **Toolbar** (item 8): SCR-05 and spec row 3 still describe the floating hover toolbar; the design since 2026-11-23 (comment 12939, DL-346) is under the name on the open and focused row.
2. **Width** (item 11): spec says 288 px resizable, mock-up draws 320 px.
3. **Status words** (item 14): mock-up "Complete / In progress / Not started / Missing data", build and AC-4 "All inputs entered / Some inputs entered / No inputs yet / Missing inputs".
4. **Tablet touch size** (round one): mock-up raises the arrow and buttons to 44 px only below 768 px.
5. **Spec gap** (round one): the spec does not state the tile, glyph names, tints, open-row look, number font, header and count, legends or the "Add main assembly" style, which is why the build and mock-up drifted. One paragraph in row 3 would close it.

## What I started and stopped

Nothing was started that needs stopping: no container, no server, no E2E, no change to `aqp-398`, `aqp-403`, the demo copy or `accucut-demo-db`. In the scratchpad folder above I created two folders (`b-master`, `b-707`) holding `git archive` copies of `src` and `package.json` from the two commits, each with a directory junction named `node_modules` pointing at `aqp-398`'s (read only; the junctions were removed afterwards, the target was not touched), and ran Tailwind's PostCSS plugin, Vitest (to render markup) and Playwright's Chromium (screenshots) from there. No file in any repository was written except this one.


---

# Delivery lead decisions (2026-11-24)

Given in chat on 2026-11-24 and relayed by the coordinator. They settle the open points of the ruled list above.

| Item | Decision | What it means |
|---|---|---|
| 8 Row toolbar | **Keep the build.** The toolbar stays in line under the name of the open row and of the row that has keyboard focus; it does not float and does not appear on hover | The mock-up and the spec are the ones that change. Reason: DEF-075 (a press at the centre of a Part opened the move menu) and DEF-076 (rows jumped under the pointer). Do not build the floating toolbar. The product-manager's open point stands: the customer saw the floating one, so the next customer review shows the new one or tells the customer |
| 10 Header | **Match the design.** The tree sits in its own card headed "Parts tree", with the row count on the right | Build change (a second card in `estimate-workspace.tsx`); the mock-up already draws it, so only the spec needs a sentence |
| 15 Resizable tree | **Build before the freeze**, to the SCR-05 / ux-spec description | Handle on the panel edge, keyboard resize, a single-pointer alternative, tests at three widths. Specified below |
| 1 to 7b, 9, 11 to 14 | **Go ahead as ruled** | Item 11 sets the default width at 320 px; item 14 changes the mock-up's status words to the build's |

Who updates the mock-up and the spec: **the CR-01 UX session in the main checkout** (delivery lead, option A, 2026-11-24). It folds items 8, 10 and 14 (and 11, 12, 15 below) into its own uncommitted work. The ux-expert session that wrote this note did **not** edit `docs/03-ux/generator/**`, any `SCR-05*.html`, `screens.css` or `ux-spec.md`. The exact changes follow, so they can be handed over.

## Changes the CR-01 session needs to make (SCR-05 mock-up and ux-spec)

Line numbers are those of `records-u` at `854cbeb5`; the main checkout's working copy may have moved them, so match on the quoted text.

### Item 8: toolbar in line under the open or focused row (reason: DEF-075, DEF-076, DL-346)

| File and place | Current | New |
|---|---|---|
| `docs/03-ux/screens/screens.css` ~629-630 (`.tree-acts`, `.tree-row:hover > .tree-acts, .tree-row:focus-within > .tree-acts, ...`) | Absolute box at `right: 2px; top: 4px`, `opacity: 0`, floats over the end of the row, revealed on **hover**, focus-within or an open menu | In flow: `position: static; flex: 0 0 100%; opacity: 1`, a line of its own under the row's link, indented to line up with the name (arrow cell plus tile). **Hidden** (`display: none`) except on the open row (`.tree-row:has(.is-active)`) and on a row with `:focus-within` or an open menu (`:has([aria-expanded="true"])`). **No `:hover` selector.** No shadow or white box (it is not a floating layer) |
| `screens.css` ~631 (`.tree-act`, 28 x 28) | 28 px buttons | 36 px high and wide with a mouse at 1024 px and wider (spec: row icon buttons are 36 px), 44 px otherwise (next row). Keep `color: var(--ink-2)`; hover `--surface-2` / `--ink`; the minus hover `--danger-soft` / `--danger` (item 9) |
| `screens.css` ~637-638 and ~640 (touch special case; 44 px only at `max-width: 767px`) | Hides the toolbar below 1024 px, then shows it static on the open row; 44 px only below 768 px | Delete the special case (the rule above applies at every width). 44 px at `@media (max-width: 1023px), (pointer: coarse)` (this also fixes round-one point 1) |
| `docs/03-ux/generator/s2.cjs` ~31-42 (comment "Row actions, shown on hover and focus" and the `acts` span) | Comment says hover and focus; the span is the last child of the `li` | Comment: "shown in line under the open row and the row in focus; never on hover (DEF-075, DEF-076)". Markup unchanged (same three buttons, same names); keep it the last child so `flex-wrap` puts it on its own line |
| `s2.cjs` ~186 (CR-01 review note) and any other `reviewNote` that says the toolbar "floats" or shows "on hover" | Floating text | Reword to the under-the-name toolbar; add "Changed after the customer's third look; the customer is told at the next review" (product-manager's open point) |
| `ux-spec.md` section 0.9 row 3 (line 201), sentence "**Row actions (third look, 17 Nov 2026):** on hover or keyboard focus a small toolbar floats over the end of the row: **move** (drag handle), **"+" add**, **"-" delete**; on touch screens it shows in line on the selected row." | Floats on hover or focus; in line on touch only | "**Row actions (revised 24 Nov 2026, DEF-075, DEF-076):** a small toolbar of **move** (drag handle), **"+" add** and **"-" delete** shows in line, on its own line under the name, on the open row and on the row that has keyboard focus, on every screen. It never appears on hover: a floating toolbar hid the name and the status and, in the 320 px column, took the press meant for the name; showing it on hover moved the rows below the pointer." |
| Same row 3, sentence "A small "+" (shown on the row under the pointer, the row in focus and the open row, and always on touch screens) opens a menu..." | Hover and touch wording | "A small "+" (shown with the toolbar, on the open row and the row in focus) opens a menu..." |
| `ux-spec.md` section 0.9 row 3, "Built" column | n/a | Add "Toolbar under the name: built (AQP-406, DL-346)" |
| `ux-spec.md` accessibility table row "Target size" (~1443) | "the smallest interactive items (row icon buttons) are 36 px" | Add "(44 px with a finger and below 1024 px)" |

### Item 10: card head "Parts tree" and the count (reason: delivery lead, match the design)

The mock-up **already draws it** (`s2.cjs:50`: `h2` "Parts tree", spacer, "N rows"; `nav aria-label="Parts tree, N rows"`). **No mock-up change** apart from the item 15 button below. The spec is silent, which is how the build drifted:

| File and place | New |
|---|---|
| `ux-spec.md` SCR-05 "Layout rules" (~line 636) and section 0.9 row 3 | Add: "The tree is a card of its own beside the form's card. Its head has the title **Parts tree** (an `h2`) on the left and the row count on the right ("12 rows"; "1 row" for one; every row, open or closed), with a hairline under it. The form column has no card of its own: its section cards are the cards, and the group keeps the accessible name "Parts and inputs". The `nav` is named "Parts tree, 12 rows". On tablet and phone the same head sits above the list inside the panel and the drawer." |

### Item 14: legends at the foot of the tree (reason: delivery lead; the build's words are an accepted AC, STORY-05.11 AC-4)

| File and place | Current | New |
|---|---|---|
| `s2.cjs:54` kind legend | `aria-label="Kinds of row"`, glyph size 16 | `aria-label="Row kinds"`; same 24 px tile as the rows (`L.kindIcon(k, t, false, 18)`); no visible "Row kinds" title (none is drawn today: keep it so) |
| `screens.css:609` `.tree-legend .kind-ic { width: 22px; height: 22px }` | 22 px legend tile | Delete the rule (24 px, like the rows) |
| `s2.cjs:56` status legend | `aria-label="Legend"`; words "Complete", "In progress", "Not started", "Missing data" | `aria-label="Row status"`; words **"All inputs entered", "Some inputs entered", "No inputs yet", "Missing inputs"** |
| `docs/03-ux/generator/lib.cjs:406` (`stIcon` map and its spoken words) | "Complete / In progress / Not started / Missing data" | The same four new words, so the row's spoken status and the legend agree. Check `SCR-05.html`, `SCR-06.html` and `SCR-07.html` after regenerating for the old words |
| `ux-spec.md` row 3 | The legend of the four icons is named; the status legend is not | Add: "Under the kind legend, a second legend names the four status icons in the words a screen reader speaks: All inputs entered, Some inputs entered, No inputs yet, Missing inputs. Neither legend has a visible title." Check ~line 689 ("check, half circle, empty circle") and any other place that uses the old words |

### Items 11 and 15 (spec and mock-up consequences)

| File and place | Current | New |
|---|---|---|
| `ux-spec.md` SCR-05 Layout rules (~636): "**tree** (288 px, resizable 240 to 400 by mouse or arrow keys)" | 288 px | "**tree** (320 px by default, resizable from 240 to 400 px: see the item 15 specification in `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`)". Also re-check "At 1280 px with the tree, three columns fit; at 1024 px, two" with 320 px (the form is about 390 px wide at 1024 px, one card column; the CR-01 session confirms from the mock-up) |
| `screens.css` ~372, ~495 (256 px at 1279 and below), ~510 (240) and `.tree-handle` ~367-369, ~514 | 288 / 256 / 240 defaults; handle 12 px wide, a `button` | Default 320 at every width from 1024 (line 673 already does this: remove the 288 and 256 fallbacks it overrides, so the file has one number); handle per the item 15 look below |
| `screens.js` `initResize` (~189-207) | min 240, max 400, step 16, no Shift, no Home/End, no reset | Match the item 15 behaviour: Shift+Arrow 64, Home 240, End 400, Enter and double-click reset to 320, Escape cancels a drag, `aria-valuetext`; the element becomes `div tabindex="0" role="separator"` (a `button` may not take that role) with `aria-controls="tree"` and the label "Resize parts tree" |
| `s2.cjs:57` | `button`, label "Resize parts tree. Use left and right arrow keys.", `aria-valuenow="288"` | `div`, label "Resize parts tree", `aria-valuenow="320"`, `aria-valuetext="Parts tree 320 pixels wide"`, `aria-describedby` pointing at a hidden hint "Drag, or use the left and right arrow keys. Enter resets to the standard width." Add the "Tree width" button and its three-choice popover to the card head (after the count) |
| `ux-spec.md` accessibility table row "Dragging" (~1444): "No feature needs dragging: the tree is reordered by buttons; the panel is resized with arrow keys" | Wrong for SC 2.5.7: arrow keys serve a keyboard, not a single-pointer user | "The tree is reordered by buttons (Move up / Move down). The panel is resized by dragging its edge, with the arrow keys, or, without dragging, with the **Tree width** button in the tree's head (three choices)." |

Not changed in the mock-up: items 9, 12 and 13 (the build changes; the mock-up already has them) and items 1 to 7b (the mock-up is right, the build changes).

---

# Item 15 specification: resizable parts tree (written 2026-11-24; for the scrum-master to turn into a story)

**Scope.** The tree column of SCR-05 when it sits beside the form (1024 px and wider). It is one reusable component (a resizable column wrapper), so SCR-06 and SCR-07, whose mock-ups draw the same handle, can use it and read the same stored width. SCR-05 is required; whether SCR-06 and SCR-07 join the same story is for the scrum-master and the developer to decide after checking how those two trees are laid out (the spec text at line 636 names SCR-05 only). No cost, rate or formula is involved, so the Engineer view is unaffected.

## The numbers

| Thing | Value | Why |
|---|---|---|
| Default | **320 px** | Item 11; names stay on one line (mock-up, delivery lead) |
| Minimum | **240 px** | The spec's lower bound and the mock-up's `min`. Below it the indent, the arrow cell and a name leave no room |
| Maximum | **400 px**, and never more than the room allows (next row) | The spec's upper bound and the mock-up's `max` |
| Room rule | Effective maximum = `min(400, workspace width - gap - 232)` | The form track never goes below **232 px** (14.5 rem, one section card: the minimum the card grid and `DRAWING_REGION` already use). At 1024 px the workspace is about 728 px wide (side menu 248, padding 2 x 24; the developer measures), so the room is about 480 px and 400 is allowed; the clamp only acts on a narrower window or a larger text size |
| Drawing region | Yields first | The existing `DRAWING_REGION` clamp already reads `--tree-w` first and shrinks the region, so the tree keeps what the person set |
| Presets (the non-drag alternative) | Narrow **256**, Standard **320**, Wide **400** | 256 is the mock-up's old default below 1280 px; 400 is the maximum. Standard is also the reset value |
| Arrow step | **16 px** | The mock-up's; ten presses cross the range |
| Shift + Arrow step | **64 px** | Four steps; crosses the range in three presses |
| Home / End | Minimum **240** / effective maximum | |
| Reset | **Enter**, **double-click** on the handle, and the Standard choice | One number, 320 |
| Persistence | **localStorage**, per browser and per signed-in user, one number for every estimate | See below |

## Where it exists

- **1024 px and wider** (the width at which `useViewport()` says `desktop`, so the tree is docked beside the form): handle, "Tree width" button, resizing and stored width all apply. This includes a touch screen of 1024 px or more (a tablet held landscape): the handle takes a finger.
- **Below 1024 px** (tablet 768 to 1023: the tree is the stacked, openable panel above the form; phone: the drawer): **no handle, no "Tree width" button, no `separator` in the accessibility tree**, and the stored width is ignored. The panel is the full width of its container; the drawer keeps its own width (`--drawer-w`). Nothing is clipped or scrolled sideways.
- The stored width is **kept**, not erased, while the window is below 1024 px, so it comes back when the window grows.

## The handle

- **Place.** On the right edge of the tree card, in the gap between the tree and the form, full height of the card. It is **not a child of the scrolling box** (`overflow: auto` would clip it and scroll it away); it belongs to the column wrapper, which is `position: relative`. It does not cover the tree's scroll bar.
- **Look.** The visible grip is a **4 x 40 px** rounded bar in `--border-strong` (3.23:1 on `--bg`, 3.55:1 on white, computed: passes the 3:1 of WCAG 1.4.11). On hover, keyboard focus and while dragging the bar turns `--primary` (4.18:1 on `--bg`). While dragging the cursor is `col-resize` over the whole page and text selection is off.
- **Hit area.** Full card height and **24 px wide** with a mouse (the WCAG 2.5.8 minimum), starting at the tree card's right edge (the 16 px gap plus 8 px into the form's side). **44 px wide** with a coarse pointer (`@media (pointer: coarse)`; NFR-017), starting at the tree edge. `touch-action: none` on the hit area, so a finger drags it and does not scroll the page. A test checks that no form control's box overlaps the hit area at 1024 px with touch; if one does, the form track gets a left padding of the excess under `pointer: coarse` only.
- **Focus.** The 3 px `--focus` ring with 2 px offset (the global `:focus-visible` style) around the grip bar and a 12 x 48 px pill behind it, not around the full-height strip. The grip also turns `--primary`; the ring, not the colour, is the cue. The ring is not clipped by the card or the column.
- **Motion.** The width follows the pointer and the keys directly, with no transition. The grip's colour change is not animated. `prefers-reduced-motion: reduce` therefore needs no special case; a test asserts no `transition` on the column's width.
- **Cancel.** Escape during a drag returns the column to the width it had when the drag began. The width is stored only at the end of a gesture (pointer up, a key press, a choice), not on every pixel.

## Keyboard and screen reader

| Item | Value |
|---|---|
| Element | `div tabindex="0" role="separator"` (not a `button`: ARIA does not allow `separator` on a button). In the tab order after the tree's last control and before the form |
| `aria-orientation` | `vertical` |
| `aria-valuenow` / `aria-valuemin` / `aria-valuemax` | The current width in px / 240 / the effective maximum (updates when the window changes) |
| `aria-valuetext` | "Parts tree 320 pixels wide" |
| `aria-controls` | The id of the tree column (the element whose width changes) |
| `aria-label` | "Resize parts tree" |
| `aria-describedby` | Hidden hint: "Drag, or use the left and right arrow keys. Enter resets to the standard width." Also shown as a tooltip on hover and focus |
| Left / Right | Narrower / wider by 16 px (the handle is on the tree's right edge, so Right widens; the page is left-to-right only) |
| Shift + Left / Right | by 64 px |
| Home / End | 240 / effective maximum |
| Enter | Reset to 320 |
| Up / Down and other keys | No effect; the key is not captured (the page scrolls as usual) |
| Announcement | The separator's own value is read as a key repeats. After a preset or a reset, a polite live region (the existing one; no focus move) says "Parts tree width: standard, 320 pixels." |

## The non-drag alternative (WCAG 2.2 SC 2.5.7): required, and the keyboard is not enough

SC 2.5.7 (Level AA, inside the project's WCAG 2.2 AA floor) asks that anything done by dragging can also be done by a **single pointer without dragging**. The arrow keys serve a keyboard, not a person who uses a mouse, trackball, head pointer or stylus and only taps. So the keyboard route does **not** satisfy it, and the ux-spec line "the panel is resized with arrow keys" must be corrected (see the table above). The cheapest honest fix:

- A **"Tree width" icon button** (lucide `ArrowLeftRight`, 18 px glyph; accessible name "Tree width"; tooltip the same) at the right end of the tree card's head, after the row count. 32 x 32 px with a mouse (above the 24 px minimum), 44 x 44 px with a coarse pointer. It opens a shadcn `Popover` with a `RadioGroup` named "Tree width": **Narrow (256 px)**, **Standard (320 px)** (marked "default"), **Wide (400 px)**. Choosing one applies it at once and stores it; the popover stays open until Escape or a click outside, so the person sees the result. Focus returns to the button on close. If the effective maximum is below a preset (a narrow window), that radio is disabled, with the description "Not enough room at this window size".
- The button shows only where the handle shows (1024 px and wider). It is an addition beyond the delivery lead's brief ("handle plus keyboard"), and the minimum to meet 2.5.7. **If the delivery lead declines it, he waives SC 2.5.7 for this control in writing and the decision log records it**, because without it the handle fails WCAG 2.2 AA for pointer-only users.
- A bare click on the handle does nothing (it only takes focus).

## Persistence

- Written to `localStorage` under the key `aqp.ui.treeWidth.<userId>` (the signed-in user's id, so two engineers who share a PC each keep their own); the value is the integer px as text. Read once in the browser after mount, **applied before first paint where the framework allows (a layout effect), and never blocking the page**. If the read throws (private window, blocked storage), or the value is not an integer from 240 to 400, it is ignored and 320 is used. A write that throws is swallowed; the width still applies for the session.
- **Per browser, not on the server.** Window size differs from one PC to the next, so a server value would be wrong on the other machine; no migration and no API. One number for all estimates (the layout is the person's habit, not a property of one estimate). It is not shared with other users.
- One pure function decides every width (`clampTreeWidth(value, workspaceWidth)`): a stored 400 on a window with room for 360 shows 360 and an `aria-valuemax` of 360. A clamp **does not rewrite** the stored number, so a bigger window brings 400 back.
- Reset (Enter, double-click, Standard) removes the stored key, so a later change of the default reaches this person.

## What the form does when the tree widens

- The form track is `minmax(0, 1fr)` and shrinks; its section cards reflow in the existing auto-fit grid (3, 2 or 1 columns by the room), never below one 232 px card. **No horizontal scroll of the page** at any width from 1024 px, with the tree at any width from 240 to its effective maximum. The sticky Actions bar and top bar keep their measured offsets (WCAG 2.4.11).
- The tree card's own contents reflow too: names wrap (already allowed), the status icon stays at the right, and the tree has no horizontal scroll.
- The reserved drawing region is unchanged (it yields to the tree).

## Acceptance-criteria-ready wording (UX-AC-15.n)

1. **UX-AC-15.1** At 1024 px and wider the parts tree column is 320 px wide when no width has been chosen and no valid width is stored.
2. **UX-AC-15.2** At 1024 px and wider a resize handle (`role="separator"`, `aria-orientation="vertical"`) sits on the tree card's right edge. It is in the tab order, has the name "Resize parts tree", and carries `aria-controls` naming the tree column, `aria-valuenow` equal to the column's width in px, `aria-valuemin="240"`, `aria-valuemax` equal to the effective maximum, and `aria-valuetext` "Parts tree N pixels wide".
3. **UX-AC-15.3** Dragging the handle with a mouse or a finger changes the width continuously between 240 px and the effective maximum, never beyond them. Escape during the drag restores the width the drag began with.
4. **UX-AC-15.4** With the handle focused, Left and Right change the width by 16 px, Shift+Left and Shift+Right by 64 px, Home sets 240 px, End sets the effective maximum, and Enter sets 320 px. Up and Down do nothing. Each change updates `aria-valuenow` and `aria-valuetext`.
5. **UX-AC-15.5** Double-clicking the handle sets 320 px and removes the stored width.
6. **UX-AC-15.6** The effective maximum is 400 px or, where less, the workspace width minus the gap minus 232 px. The form never gets narrower than 232 px, the page never scrolls sideways, and the reserved drawing region gives way before the tree does.
7. **UX-AC-15.7** Without dragging, a pointer user can set the width: the tree card's head has a button named "Tree width" (32 px square with a mouse, 44 px with a coarse pointer) that opens a group of three choices, "Narrow (256 px)", "Standard (320 px)" and "Wide (400 px)". Choosing one applies it at once and focus returns to the button on close; a choice that does not fit the window is disabled with a stated reason.
8. **UX-AC-15.8** The chosen width is stored in the browser for the signed-in user at the end of a gesture and restored on the next visit to any estimate in that browser, before first paint where possible. A missing, unreadable, non-integer or out-of-range stored value is ignored (320 px is used) and no error is shown. A window too small for the stored width shows the clamped width without erasing the stored one.
9. **UX-AC-15.9** The handle's grip has at least 3:1 contrast against the page and the card. On hover, focus and drag it is `--primary`; keyboard focus shows the 3 px `--focus` ring, which is not clipped.
10. **UX-AC-15.10** The handle's hit area is at least 24 px wide with a mouse and 44 px wide with a coarse pointer, the full height of the card, does not cover the tree's scroll bar and does not overlap any form control.
11. **UX-AC-15.11** Below 1024 px (tablet and phone) there is no handle, no "Tree width" button and no `separator` in the accessibility tree; the stored width is ignored there, and the panel and drawer keep their own widths.
12. **UX-AC-15.12** The width changes with no animation: no `transition` on the column's width exists, so `prefers-reduced-motion` needs no special case.
13. **UX-AC-15.13** After a choice from the "Tree width" group, or a reset, a polite announcement states the new width ("Parts tree width: standard, 320 pixels.").
14. **UX-AC-15.14** The same component and the same stored width serve SCR-06 and SCR-07 where their trees sit beside the content (the scrum-master may split these into a second story).
15. **UX-AC-15.15** axe reports no violation (including `target-size`) on SCR-05 at 360, 768 and 1366 px, with the tree at its narrowest, standard and widest width (360 and 768 px have no handle, so the widths apply at 1366 px).

## Tests to run

Unit (Vitest, no browser):
- `clampTreeWidth`: below 240, above 400, above the room, NaN, non-integer, and a stored 400 on a window with room for 360 (UX-AC-15.6, 15.8).
- Step logic: Arrow 16, Shift 64, Home, End, Enter, and clamping at both ends (15.4).
- Stored-width parser: valid, missing, `"abc"`, `"300.5"`, `"1000"`, and a throwing `localStorage` for read and for write (15.8).
- Preset list: values 256, 320, 400, and the disabled rule (15.7).

End to end (Playwright, the three existing projects, plus the 1023 / 1024 edge):
- **Mobile, 360 px.** Open the workspace with `localStorage` holding 400: no `separator`, no "Tree width" button, the tree drawer keeps its own width, no horizontal page scroll; axe clean (15.11, 15.15).
- **Tablet, 768 px and 1023 px.** The same assertions with the stacked panel open; stored width ignored; the form not shifted sideways. At **1024 px** the separator and the button exist (the boundary; 15.11).
- **Tablet landscape with touch, 1024 x 768, `hasTouch`.** The handle's box is at least 44 px wide, it drags by a touch pointer-event sequence, and no form control overlaps it (15.3, 15.10).
- **Desktop, 1280 and 1366 px, mouse.** Default 320 px (15.1). Drag by mouse to a smaller and a larger width, and past both ends (clamped); Escape mid-drag restores (15.3). Keyboard: focus the handle and check each key of 15.4 and the ARIA values (15.2, 15.4). Double-click resets and the stored key is gone (15.5). The "Tree width" button: open, choose Wide, the width is 400, focus returns on Escape; choose Standard (15.7, 15.13). Reload: the width persists; clear storage: 320 (15.8). Form width is at least 232 at the widest, no horizontal scroll (15.6). With the viewport shrunk from 1400 to 1024 and 400 stored, the width is clamped and `aria-valuemax` follows (15.6, 15.8). Grip contrast at least 3:1 (computed) and the focus ring visible in a screenshot (15.9). Hit area 24 px (15.10). No `transition` on the column (15.12). axe at three tree widths (15.15). Re-run the existing tree tests (including the centre press on a short row at 1366 px, AQP-418) at 240 and 400 px, to show the row layout holds.
- **Not tested in E2E:** the feel on a real touch screen: one manual check on the tablet the workshop uses, before G8.

## Notes for the developer

- The handle must not live inside the `overflow: auto` box. Wrap the scrolling column in a `position: relative` wrapper (today `parts-tree-area.tsx` has `lg:w-(--tree-w)` on the wrapper) and put the handle in the wrapper.
- Set the width as the CSS custom property `--tree-w` on the workspace element (the one `globals.css` and `DRAWING_REGION` already read), batched with `requestAnimationFrame`, not as React state per pixel.
- `useViewport()` reads the browser, so the server render shows the tablet or phone shape first. Do not render the separator until the viewport is `desktop`, so no server-rendered separator is announced at the wrong size.
- The ux-spec line about arrow keys and the mock-up's `button` role are wrong (see the table above); the build follows this note.

---

# Correction, 2026-11-25: the form column has no card of its own (PR #707, DEF-081)

**Ruling: accept the build as is.** The SCR-05 mock-up draws `.ws-form` as a plain column (generator `s2.cjs` ~171: heading row, stepper, then the section cards; no `.card` around it), so a borderless, unfilled, unpadded form area from 1024 px matches it, and the bordered card must not come back; the layout contract (two section columns at 1280 px, the 340 px drawing region of estimate-layout AC-2) stays as it is. My item 10 wording "keep the form's card" was wrong: it read the build's old wrapper as design, and the two places above are corrected. Conditions: the group keeps its accessible name "Parts and inputs" and role (the rows' links point to it), the section cards keep their own borders, and below 1024 px the area is unchanged.

---

# Note, 2026-11-25: coarse-pointer hit area and UX-AC-15.14 (PR #721, AQP-426)

**Hit area: accept the developer's version.** The 44 px touch area extends 28 px into the tree card's own padding instead of padding the form (which cost the section cards a column at 1280 px and failed estimate-layout AC-2 on tablet), so the line in "The handle" about a left padding on the form is replaced by this. Conditions: it reaches only the card's padding and at most the last 4 px of a row's end, holds no control (the status icon is not one), no form control lies under it, and the grip, 24 px mouse area and no-overlap test of UX-AC-15.10 stand (assert that every point on the area's centre line hits the handle).
**UX-AC-15.14 (SCR-06 and SCR-07 reuse) is deferred to follow-up #720, which is consistent with the spec:** the criterion applies only "where their trees sit beside the content", and SCR-06's tree is a server-rendered `details` panel above it, so there is nothing to resize until that layout changes.
