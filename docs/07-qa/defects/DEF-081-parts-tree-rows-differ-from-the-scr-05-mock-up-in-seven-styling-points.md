# DEF-081: The parts tree rows differ from the SCR-05 mock-up in seven styling points: kind-icon tile, glyphs, swapped tints, open-row style, number font, complete-status icon and guide-line geometry (CR-01 item 3B; type Product (UI, styling only))

| Field | Value |
|-------|-------|
| Story / AC | AQP-404 (STORY-CR01.3B, Done), AC-1, AC-2, AC-3 (kind icon, shapes and tints, guide lines); UX spec section 0.9 row 3 ("second look"); SCR-05 |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6: a visual defect that leaves every action reachable and misleads about no price). Styling only: no behaviour, no figure, no cost data is involved |
| Priority | P3 (Jira Medium, label `sev-3`); fixed before G8 or accepted in writing by master (section 6) |
| Type | **Product (UI, styling only)**. Which side is right (mock-up or build) is **not decided here**: ux-expert rules, see "Ruling" below |
| Status | **CLOSED 2026-11-25 (qa-engineer), on DL-377 (3): fixed by PR #707 (squash `e20aa039`, AQP-424), the ruling table filled to row 15.** #707 carries items 1 to 6, 7a, 7b / 12, 9, 10, 11, 13 and 14; item 8 stays as built **by decision** (the delivery lead, DL-377 (2)); item 15 (the resizable tree) moved to the FR-112 story and is **not** part of this close-out. Jira AQP-424 Done, GitHub #706 closed (completed). **Not covered by this close-out (open for the final regression, not conditions of closing):** QA's hand reading of the tree at 360, 768 and 1366 px and of the legends at 100 % and 200 % zoom (the PR body asks for it), and a 3:1 non-text contrast read of each tint and tile; the SCR-05 mock-up and ux-spec updates (item 8 and the 288 px width) are the CR-01 UX session's, now G8-C-UX05 (DL-378 (7)). QA read the PR description, its file list and its checks; QA did not run the tree. Earlier: **Open: ruled, fix assigned to lane 1** (2026-11-24); the ux-expert's ruling is in (`docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, records-u 7840c5fb): the mock-up is right on items 1 to 6 and 7a, the build is right on 7 and 7b. |
| Jira / GitHub | [AQP-424](https://sankumar76.atlassian.net/browse/AQP-424) / [#706](https://github.com/sankumar76/Accucut-Quotation/issues/706). Labels: Jira `ai-delivery`, `aiid-DEF-081`, `agent-qa-engineer`, `bug`, `sev-3`; GitHub `bug`, `sev-3`, `ai-delivery`. Relates to AQP-404 |
| Found by / date | qa-engineer, 2026-11-24, at the delivery lead's request (relayed by the orchestrator, AQP-404 comment 13157) |
| Build / commit | `origin/master` `c7faf76f` (all files read with `git show origin/master:<path>`; the main checkout's uncommitted edits to `docs/03-ux/screens/*` were not read) |
| Environment | Code and mock-up source read only; no browser run (the Playwright and Chrome DevTools MCP servers failed to connect in this session). Sizes and colours are those of the CSS and class names, not measured in a browser |

## Steps to Reproduce
1. Open `docs/03-ux/screens/SCR-05.html` (the mock-up) at a desktop width and look at the parts tree: kind icons, numbers, the open row, the status icons, the level lines.
2. Open an estimate in the built portal (`/estimates/<code>`, Engineer or Lead) with a tree of a Main Assembly, a Sub-Assembly, a Part or Sub-part and a Fastener, one row open, one part complete.
3. Compare the two, row by row, against the table below (or read the cited lines).

## Expected Result
To be ruled by the ux-expert, item by item (UX spec section 0.9 row 3, about line 201, against the mock-up on `master`). QA states no expected side.

## Actual Result
All lines are on `origin/master` `c7faf76f`. Mock-up = `docs/03-ux/screens/SCR-05.html` ("html") and `docs/03-ux/screens/screens.css` ("css"). Build = `src/components/shared/node-kind-icon.tsx` ("icon"), `src/components/features/estimate-workspace/tree-node.tsx` ("node") and `src/components/shared/parts-tree-list.tsx` ("list").

| # | Point | Mock-up | Build | Confirmed |
|---|---|---|---|---|
| 1 | Kind icon | A **24 x 24 px tile**, `border-radius: var(--radius-sm)` (4 px), a `--*-soft` background per kind, an 18 px glyph at stroke 1.75 (css:602-607; the legend 22 px, css:609) | A **bare icon** of 20 px (`size="large"`, tokens `ICON_SIZE.large` = 20), tinted text colour only, **no tile and no background** (icon:40) | Yes |
| 2 | Glyphs | Main Assembly = the lucide **Boxes** paths (three cubes); Sub-Assembly = **two overlapping squares** (a 7 x 7 square at top right and an L-shaped outline; html:66) | Main Assembly = **Layers**, Sub-Assembly = **Boxes** (icon:13-14). UX spec row 3: Main "stacked blocks", Sub "grouped blocks" | Yes |
| 3 | Tints | Sub-Assembly = **accent** (`--accent-ink` #8A3F05 on `--accent-soft` #FFF4E5; css:605); Fastener = **info** (`--info-ink` #333945 on `--info-soft` #ECEEF2; css:607). Main = primary, Part and Sub-part = ink-2 on surface-2 (css:604, 606) | Sub-Assembly = `text-info-ink`, Fastener = `text-accent-ink` (icon:22, 24). Main = `text-primary-ink`, Part = `text-ink-2`, no backgrounds (icon:21, 23) | Yes, **Sub and Fastener are swapped**. Note: the mock-up's "info" is a neutral slate, **not blue** (css:82: "neutral notices; no blue in this brand"; `globals.css:117` the same value) |
| 4 | Open row | `.tree-item.is-active`: `background: var(--surface-2)`, `box-shadow: inset 4px 0 0 var(--primary)`, `font-weight: 600` (css:354; the open row carries `is-active`, html:66) | `aria-[current=true]:border-primary-line aria-[current=true]:bg-primary-soft aria-[current=true]:font-semibold` on a row with `border border-transparent rounded-md` (node:56-57): a `--primary-soft` fill (#fdecec) and a `--primary-line` border (#f2b8b8) **all round** | Yes |
| 5 | Number | `.tree-no`: `font-family: var(--font-mono)`, `font-size: var(--fs-label)` (12 px), `color: var(--ink-2)` (css:356, `min-width` reset to 0 in a row at css:621) | `<span data-sl-no className="shrink-0 tabular-nums">`: inherits the row's body font, `text-body` and `text-ink` (node:56, 62) | Yes |
| 6 | Complete status | `.st-done` is a **circle with a tick** (`<circle r="9"/><path d="M8 12l3 3 5-6"/>`, 18 px, `--success`; html:66, css:360) | `COMPLETENESS_ICON.COMPLETE = Check`: a **plain lucide Check**, 16 px, `text-success` (node:18, 66). UX spec "Content": "check, half circle, empty circle" (ux-spec.md:689) | Yes |
| 7 | Guide lines | **The mock-up has them too**: `.tree-row::before` draws one 1 px `--border` line per level, `--step: 20px`, at x = 11 px of each step, over `--lvl` steps (css:612-614; comment css:600-601 "thin guide lines show the levels") | `<ul className="... ml-s-5 border-l border-border">` on each branch: indent `--s-5` = **24 px**, a line at the left edge of the indented list (list:130; `globals.css:33`). Not drawn from `LAST_INDENTED_LEVEL` = 5 down (list:58, 130) | **No, not as stated.** The request says "build has them, mock-up does not"; the files show **both** draw guide lines. What differs is the **geometry**: step 20 px vs 24 px, and the line's position (11 px into each step vs the edge of the indented list). If the delivery lead sees no lines in the mock-up, that was not found in the source (QA did not render it: no browser) |

### Added by QA (not in the delivery lead's seven; for the ux-expert to rule on or drop)
- **7a. Fastener glyph.** The build uses lucide `Nut` (icon:16). In the installed lucide-react (1.66.0 in the main checkout's `node_modules`; `master` pins 1.73.0, and the icon was not re-checked at that version) `Nut` is drawn as a **food nut** (its first path begins `M16.847 5.847 20 9a7.23 ...`), not a hex nut. The mock-up draws a **hexagonal prism with a circle** (`<circle cx="12" cy="12" r="4"/>`, html:66). The UX spec says "Fastener: hex nut" (ux-spec.md:201). The Part and Sub-part glyph is the same in both (lucide Box).
- **7b. Arrow cell and row height.** The mock-up's arrow cell is 24 x 24 px (css:615) and its row min-height 36 px (css:620); the build's arrow cell is at least 44 x 44 px (list:61, NFR-017 touch target) and its row `min-h-(--control-h)` (44 px; `--compact-field-h` from the fine-pointer wide layout; node:56). Probably deliberate for touch; listed so the ux-expert can say so.

## Evidence
Source reads only, on `origin/master` `c7faf76f` (`git show origin/master:<path>`): the lines cited in the table. The build files were read whole; the mock-up row markup is `SCR-05.html` line 66 (one long line). Lucide paths compared from `node_modules/lucide-react/dist/esm/icons/{nut,layers,boxes,box,group,circle-check}.mjs` (main checkout, read only). No test was run: this is a styling comparison with no failing test (the existing `estimate-tree.spec.ts` and axe cases assert behaviour and contrast, not these styles). No secrets or personal data.

## Suspected Area (optional)
`src/components/shared/node-kind-icon.tsx` (items 1 to 3, 7a), `src/components/features/estimate-workspace/tree-node.tsx` (items 4 to 6), `src/components/shared/parts-tree-list.tsx` (item 7, 7b). If the ruling changes the mock-up instead, the files are `docs/03-ux/screens/SCR-05.html`, `screens.css` and `docs/03-ux/ux-spec.md` (the "Built" column).

## Ruling _(ux-expert; QA copied the table from the ruling file and decided nothing)_
Source: `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md` (records-u 7840c5fb), last section. Its reasons, spec lines, contrast figures and the spec gaps it lists for the CR-01 UX session are in that file, not repeated here. On item 7 it agrees that the mock-up does draw guide lines (`screens.css:613-614`).

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
| 7b | Arrow cell and row height | Build right on touch and below 1024 px (NFR-017); optional 24 x 36 at fine pointer 1024+ (made definite as item 12) | ux-expert, 2026-11-24 |
| 8 | Row toolbar: place and when it shows | **Keep build, by decision.** Under the name, on the open row and on a row with keyboard focus, no hover reveal (reason DEF-075, DEF-076, DL-346). The mock-up and the spec (SCR-05, ux-spec section 0.9 row 3) are the ones to change, by the CR-01 UX session (option A, G8-C-UX05) | ux-expert, 2026-11-24; the delivery lead's decision, DL-377 (2) |
| 9 | Toolbar icon colour | Mock-up right: handle, plus and minus `text-ink-2` at rest; hover `bg-surface-2` and `text-ink`; minus on hover `bg-danger-soft` and `text-danger` | ux-expert, 2026-11-24; in #707 |
| 10 | Tree header and count | Mock-up right (the delivery lead: match the design): the tree in a card of its own, head 'Parts tree' and 'N rows' ('1 row' for one), a hairline under the head; the form column needs no card of its own from 1024 px (ux-expert's correction of 2026-11-25) and keeps the title 'Parts and inputs' | ux-expert, 2026-11-24 and 2026-11-25; DL-377 (2); in #707 |
| 11 | Tree column width | Mock-up right: `--tree-w` 320 px (the spec's 288 px is the thing to update) | ux-expert, 2026-11-24; in #707 |
| 12 | Arrow cell, row height and indent on a mouse | Build changes at 1024 px and wider with a mouse: arrow cell 24 x 36 px (WCAG 2.5.8), 20 px step per level; 44 px kept on touch and below 1024 px (NFR-017) | ux-expert, 2026-11-24; in #707 |
| 13 | 'Add main assembly' | Mock-up right: a hairline, then a ghost button with the plus icon, left-aligned, 44 px high | ux-expert, 2026-11-24; in #707 |
| 14 | Legends at the foot | Mock-up right, the build's words stay: no visible 'Row kinds' title or line above it (the `aria-label` stays); add the status legend under it with the same icons and inks and the words 'All inputs entered', 'Some inputs entered', 'No inputs yet', 'Missing inputs' | ux-expert, 2026-11-24; in #707 |
| 15 | Tree resize handle | **Build before the freeze (a scope change, DL-373); moved to the FR-112 story** with the 'Tree width' button (Narrow 256, Standard 320, Wide 400, WCAG 2.2 SC 2.5.7, DL-377 (2)). **Not part of DEF-081's close-out** | ux-expert, 2026-11-24; DL-373, DL-377 (2) and (3) |

## Fix route and proof (QA's recommendation; master routes)
- A test-first, styling-only developer PR from `master` for the items the ux-expert rules to change; no behaviour change.
- **Proof:** the changed styles asserted in the tree's existing E2E or a unit test where a class or a token is the contract; `estimate-tree.spec.ts` and the axe case stay green at 360, 768 and 1366 px; a 3:1 non-text contrast read for each tint and tile (NFR-018: the shape tells the kind first, the tint second); first-load of `/estimates/[code]` stated (under 200,000 B gzip, headroom rule). QA reads the tree at three widths by hand in the final regression.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled | ux-expert | 2026-11-24 | `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md` (records-u 7840c5fb) |
| Fixed | developer | 2026-11-25 | PR #707 `AQP-424: DEF-081 parts tree matches the SCR-05 mock-up`, squash `e20aa039`; run of record 45550245168 on `b388f626` per the PR body; every PR check `SUCCESS` (`Stages 1 to 11b`, Stage 12 shards 1 to 4, `Stages 1 to 11`) |
| Regression test added | developer | 2026-11-25 | `tests/unit/parts-tree-card.test.ts` (new, 24 tests: items 7b/12, 9, 10, 11, 13, 14), `parts-tree-mockup.test.ts` and `parts-tree-markup.test.ts` (items 1 to 7a), `estimate-tree.spec.ts` (arrow 24 x 36 for a mouse at 1024 px and wider, 44 px otherwise), `estimate-layout.spec.ts` (`TREE_WIDTH` 320). First load of `/estimates/[code]` 190,265 B gzip (limit 200,000) per the PR body |
| Verified | qa-engineer | 2026-11-25 | Records only: PR description, file list and checks read; the first `master` push after the squash (`e20aa039`) read to its end in test plan 0.3.56. The `estimate-save.spec.ts:304` [tablet] axe `target-size` failure that held #707 is fixed at its cause per the PR body (the card layout moved the button 130 px higher; test unchanged); QA did not reproduce it. The hand reading of the tree is open for the final regression (Status) |
