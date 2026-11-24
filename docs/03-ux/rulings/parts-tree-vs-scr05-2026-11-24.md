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
| **10** | Tree header and count | **Change build to match mock-up** | The tree sits in a **card of its own** beside the form's card: head with "Parts tree" (`text-sub font-semibold`, an `h2`) on the left and "12 rows" on the right (`text-label text-ink-3`; "1 row" for one), a hairline under the head. Keep the form's card and its title "Parts and inputs" (the rows' links point to it). Count is every row, open or closed. Optionally name the `nav` "Parts tree, 12 rows" as the mock-up does. On tablet and phone the same head sits above the list inside the panel and the drawer | | **No** |
| **11** | Tree column width | **Change build to match mock-up** (the spec's 288 px is the thing to update) | `--tree-w: 320px` | Names wrap at 288 px (see `build-707-1280-tree.png`: "Control cabinet assembly" and "Corner gusset" take two lines, and #707 made it worse than `master`, where the first took one; in the mock-up at 320 px both take one). This is evidence for width, not an accessibility rule, so I rule for the mock-up, which the delivery lead calls the agreed design. The spec (SCR-05 "Layout") says 288 px and resizable 240 to 400; the mock-up's own CSS says 320 | | **No** |
| **12** | Arrow cell, row height and indent on a mouse | **Change build** | At `fine-wide:` (1024 px and wider, mouse): `ARROW_CELL` becomes `fine-wide:w-s-5 fine-wide:min-h-(--compact-field-h)` (24 wide, 36 high, meets WCAG 2.5.8) so the row is 36 px, as the link already asks; nested list `fine-wide:ml-s-3 fine-wide:pl-s-2` so the guide line stays under the arrow's centre and each level steps about 20 px. Below 1024 px and on touch: unchanged (44 px, 24 px indent) | Touch size only (see 7b). On a mouse there is no reason to keep 44 px: today the 44 px arrow holds the row at 44 px although the link asks for 36 | **No** |
| **13** | "Add main assembly" | **Change build to match mock-up** | A hairline (`border-t border-border`, space above and below) then a `ghost` Button with the "+" icon, left-aligned (`primary-ink` text, 6.48:1; the words and the "+" are the cue). Height stays 44 px (`--control-h`), as the mock-up's. Today it is an outlined `secondary` button with no line above | | **No** |
| **14** | Legends at the foot | **Change build to match mock-up** (words stay the build's) | (a) No visible "Row kinds" title and no line above the legend; keep `aria-label="Row kinds"` on the section. (b) Add the **status legend** the mock-up has under it: the same icons at 18 px in the same inks (`CircleCheck` `text-success`, `Contrast` `text-ink-2`, `Circle` `text-ink-3`, `TriangleAlert` `text-danger`) with the words the build already speaks to screen readers: "All inputs entered", "Some inputs entered", "No inputs yet", "Missing inputs" (STORY-05.11 AC-4, `estimate-texts.ts`). (c) Kind legend uses the same 24 px tile as the rows (the mock-up's 22 px is not kept; see ruling 1) | Words: the mock-up says "Complete / In progress / Not started / Missing data", but the build's words are an accepted acceptance criterion and a key that differs from what a screen reader says is confusing. Mock-up wording to be aligned by the CR-01 session | **No** (#707 only puts the tile in the kind legend) |
| **15** | Tree resize handle | **Not a styling item; raised, not ruled** | Spec SCR-05 asks for a resizable tree (240 to 400 px, mouse or arrow keys); the mock-up has `.tree-handle`; the build has no handle (`lg:w-(--tree-w)` fixed) | | n/a |

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
