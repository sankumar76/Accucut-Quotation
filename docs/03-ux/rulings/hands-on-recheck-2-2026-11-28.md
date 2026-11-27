# UX hands-on re-check, pass 2: #789 (page heads), #807 (no-shift toolbar), #800 (Lead's read-only inputs) and DEF-133 (phone drawer)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-26 (file dated 28 Nov as asked) |
| Asked by | The coordinator, through the main session (DL-423). Pass 1 is `hands-on-recheck-1-2026-11-27.md` |
| **What was built and checked (read this first)** | **#789 and #807 are merged; I checked them on `origin/master` d5e352f9.** **#800 and #812 (DEF-133) were not merged when I ran**, so I checked each **pull-request head** on its own: #800 at `6aa4dfbd` (it already contains master d5e352f9) and #812 at `0a6e7d30` (master plus DEF-133 only). The two heads were not combined (the coordinator's merge of #800 and #812 touches `part-fields.tsx` in both). What I say about #800 and DEF-133 is therefore about those heads. If either changes before it merges, the changed part needs a quick re-look |
| How | As pass 1: a production build for each commit, a throwaway PostgreSQL 17 container with the project's migrations and registry, invented estimates (a Draft with a five-kind tree and blanks, a Prepared one, an Approved one, a Quoted one, an Ignored one, an empty one), scripted Playwright in Chromium (not the MCP), widths 360 (touch), 768 (touch), 1366 (mouse). The pointer is Playwright's, not a hand: lane 2's hand-check is mirrored by a scripted slow sweep, not done by a person |
| Cleaned up | The container, the server, the scratch worktree and the invented passwords file are removed |
| Screenshots | `C:\Users\sanku\AppData\Local\Temp\claude\859e50c63dd2e28b\7796688b-a5ea-486d-ad8c-2c45e904009d\scratchpad\shots2\<w360 \| w768 \| w1366>\`. The scratchpad can be cleared by a reboot: copy what QA wants to keep |

## 1. #789: DEF-095, DEF-110, DEF-113 (master d5e352f9)

| Defect | Result | What I saw | Screenshot |
|---|---|---|---|
| **DEF-095** SCR-05 head | **Conforms** at 360 and 1366 (768 read in text only) | Breadcrumb `My tasks / <code>`; H1 `Estimate <code>` with the `Draft` badge beside it (under it at 360, where the long invented code fills the line); subtitle `Canary task · Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals.`; the due pill beneath it at 360 | `w360\head-scr05.png` |
| **DEF-110** SCR-06 head | **Conforms** at 360, 768, 1366 | Breadcrumb `Task queue / <code>`; H1 `Estimate <code>` with `Prepared` and `Not downloaded`; one meta line `Canary task · Subject: … · <customer> (<short name>) Change customer · Entered by … · Assigned by …`; the due pill, `Open folder` and `Copy path` | `w1366\head-scr06.png`, `w768\ro-chosen-row.png` |
| **DEF-113** SCR-07 head, column and box | **Conforms for what the defect names, with three Minor differences** | Present: breadcrumb `Task queue / <code> / Cost details 1.1.1`; the description `Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.`; the heading `COST DETAILS FOR ONE ROW` over `1.1.1 · Corner gusset`; the box `This row, on screen and in the Excel row` with BG, dollars and euros and the rounding sentence; a Parts tree column at 1366. Differences, filed as N-4 and N-5 below. The stage-number sliver of DEF-114 is **still there** (it was reopened in pass 1) | `w1366\head-scr07.png`, `w768\head-scr07.png`, `w360\head-scr07.png` |

## 2. #807: DEF-129 and DEF-132, the toolbar that moves no row (master d5e352f9; checks TS-1 to TS-17)

Mouse checks at 1366 by 768, a tree of eight rows (one at level 4); touch checks at 360 and 768.

| ID | Result | Evidence |
|---|---|---|
| TS-1 hover each row and each button: no row moves | **Pass** | 31 steps, every row top identical to the baseline (0 px) |
| TS-2 sweep from the first to the fifth row, 20 steps and one jump | **Pass** | No row moved at any step |
| TS-3 hover row N, move down onto row N+1's link, click: opens N+1, adds nothing | **Pass** | All 7 neighbouring pairs: the next row got `aria-current`, no add, move or delete request, no dialog, same row count. (The first run flagged the last pair; the row was below the 768 px viewport, a fault of my script. Re-run after scrolling: pass) |
| TS-4 CLS from hover is 0 | **Pass** | `layout-shift` entries summed 0 while the pointer swept every row and Tab walked 24 stops |
| TS-5 the toolbar sits in its slot | **Pass** | Slot 40 px; toolbar 2 px below its top, 38 px high; buttons 36 by 36; wholly inside the slot, below its own row, covering no other row |
| TS-6 a hidden toolbar takes no press | **Pass** | Probes at three points of an idle slot returned the slot, never a button; a click on an empty slot changed nothing and sent nothing |
| TS-7 keyboard | **Pass** | Tab onto a link showed that row's toolbar only; no row moved, including while Tab was on its buttons |
| TS-8 touch | **Pass** | At 360 and 768: only the selected row has a slot (48 px, buttons 44 by 44); the other seven rows have none; tapping another row moved the toolbar to it |
| TS-9 focus not obscured | **Pass** | All 22 toolbar buttons focused: each wholly in the viewport and the topmost element at its centre |
| TS-10 target size | **Pass** | 36 by 36 for a mouse, 44 by 44 on touch |
| TS-11 idle pitch | **Pass** | Rows 76 px apart (92 where a branch adds its own gap) |
| TS-12 the 1024 px column, level 4, the 240 and 400 px extremes | **Not run** | The level-4 row exists in the data; I did not measure it at 1024 or the resize extremes |
| TS-13 drag reorder | **Not run** | |
| TS-14 pressing outside an open "+" menu | **Pass** | The menu closed; the row pressed was not selected; no request was sent |
| TS-15 the existing E2E specs | **Not run** | CI's, not this pass |
| TS-16 axe with the toolbar in view and a menu open | **Not run** | (axe ran on the Lead's page, section 3) |
| TS-17 the Lead's tree | **n/a** | The Lead's tree has no toolbar until stage 2T |

Lane 2's hand check (slow pointer down five rows, no row moves, no misclick) is TS-2 and TS-3 together: **pass as scripted**. A person's hand on a real mouse was not part of this pass.
**DEF-129 and DEF-132: conform on every check that was run.**

## 3. #800: DEF-131 Stage 1, the Lead's read-only inputs (PR head `6aa4dfbd`, not merged; checks RO-1 to RO-18)

| ID | Result | Evidence |
|---|---|---|
| RO-1 default row, block, order | **Pass** | Seven tree rows are links; the first is `aria-current`; the block reads `1 · Control cabinet assembly`, eyebrow `Main Assembly · level 1`, then the eight cards `01 Part Details` … `08 Other Costs and Remarks` with their range tags and `4 of 4` |
| RO-2 choose a row | **Pass** at 360, 768, 1366 | Address `?row=1.1.1#row-inputs`; the page did not reload (a marker set before the press survived); title `1.1.1 · Corner gusset`; focus on the form title; the status `Showing the inputs of 1.1.1 Corner gusset. Read-only.`; no add, save or other write sent. Under 1024 px the tree folded and its summary read `Parts tree · 1.1.1 Corner gusset` |
| RO-3 values equal the stored ones | **Pass for the fields I read**, not field by field | Sl. No `1.1.1`, Part No. `XP-1101`, Description `Corner gusset`, QTY `8`, Length and the other numbers `12.50`, the material and treatment choices, the `Other` text. I did not compare all 23 against the database |
| RO-4 empty field | **Pass** | An empty row (the second Main Assembly of the Draft) showed 22 `Not entered` and `No picture`; the placeholders read `Not entered` |
| RO-5 labels, tags, units, order equal the Engineer's | **Pass** | The 23 labels (with `Excel column <letter>`) are in the same order as the Engineer's form; the one difference is `Surface treatments`, drawn as a chip block in the Lead's view, as ruled |
| RO-6 no edit control | **Pass** | Every field is `readonly` or `aria-readonly`; the block holds no button; typing `zzz` into a field changed nothing and sent no request |
| RO-7 picture | **Pass** for the empty case | `No picture`. A part with a picture was not seeded, so the shown picture is **not checked** |
| RO-8 surface treatments | **Pass** for the empty case | `None selected`. A part with chosen treatments was not seeded, so the **chips are not checked** |
| RO-9 the five notices | **Pass** | Draft, Prepared, Approved, Quoted and Ignored each read exactly the words of 3.5 (`Read-only. … The Engineer may still be changing them: reload the page to see the latest.`, `Read-only. These are the values saved for this part.`, `Read-only while approved. These are the values the price was approved with.`, `… while quoted. …`, `Read-only while this RFQ is ignored.`); Ignored wins over the status |
| RO-10 the row line | **Pass** for current and not calculated | Prepared: `This row: ₹ 1,08,09,477.17 (BG) · $ — · € — · count 8 nos` and `View cost details` (the dollars and euros are dashes because the throwaway database has no exchange rates); Draft: `This row: — · count 1 nos`. The cleared state was not driven |
| RO-11 no intro, hints only for QTY | **Pass** | No `Every field is needed to Calculate`; the only hint under a field is the QTY per Assy sentence; each card's `n of m complete` and the part's `21 of 21 inputs complete` show |
| RO-12 the Engineer is unchanged | **Pass** | The Engineer's page has no review tree and no `This row:` line, 19 editable inputs and a Calculate button. The bundle contents and the confidentiality scan were not checked here (CI's) |
| RO-13 keyboard | **Pass** | From the form title, Tab went through the section strip's eight links and then the read-only fields (`INPUT(ro)`, `SELECT(ro)`), each focusable |
| RO-14 screen reader | **Not run** | |
| RO-15 widths | **Pass** | No horizontal scroll at 360, 768, 1366. 1366: the tree a 320 px left column and the block 710 px beside it; 360 and 768: stacked, the tree folded after a choice. The number of card columns was read from screenshots (three fields across a card at 1366), not measured |
| RO-16 unknown row, empty tree | **Pass** | `?row=999` opened the first row with no error; an estimate with no rows drew no block |
| RO-17 axe | **Pass** | No violation at 360, 768 and 1366 (Prepared, row 1.1.1). Other states and rows were not scanned |
| RO-18 `View inputs` link on SCR-07; "How the total is built" above the two columns | **Deviates in part** | "How the total is built" is above the columns at every width. **SCR-07 has no `View inputs` link**: it is not in master d5e352f9 and I found no occurrence in #800's head (`git grep` of `src` and `tests`); a source search, not a browser look |

**Minor differences seen in the read-only view (not RO failures):** the read-only **drop-down** (Treatment / Color) is drawn white with a chevron, unlike the shaded dashed read-only boxes beside it, so it looks editable (N-6); at 768 a nine-digit total wraps the rupee sign onto its own line in the BL tile (data-dependent, with an invented 9-digit total).

## 4. DEF-133: a press on a row in the phone drawer closes it (#812 head `0a6e7d30`, not merged, 360 px)

| Check | Result | Evidence |
|---|---|---|
| A tap on a row closes the drawer and shows that row | **Conforms** | After the tap the drawer was not visible, the button read `Parts tree 1.1 Base frame`, the form title read `1.1 · Base frame`, and focus was on the form title |
| The selected row's toolbar is reachable | **Conforms** | Reopening the drawer showed only `Actions for 1.1 Base frame` in view |
| Adding from the drawer keeps it open | **Conforms** | "+" on 1.1 opened its menu; choosing an item added a row (8 rows to 9), the drawer stayed open, and the status read `Added 1.1.4 Sub-part. Type a Description to name it.` (this also shows DEF-090's add announcement) |
| Enter on a row's link still opens the form | **Conforms** | Enter closed the drawer |
| N-1 of pass 1 | **Fixed on this head** | The drawer no longer stays open after a tap |

## 5. New findings for QA to file (Sev as proposed by the pass 1 rule)

| ID | Where | Finding | Grade | Screenshot |
|---|---|---|---|---|
| N-4 | SCR-07, 1366 | The tree's rows run the Sl. No into the name (`1Control cabinet assembly`, `1.1Base frame`) and carry no count or figure line (the mock-up has `2 nos 0.00` under each row). The box and the six stages sit side by side after the tree, so the stage cards are squeezed to about 360 px and their formulas wrap; the mock-up stacks the box above the stages in one wide column | Minor (Sev-4) | `w1366\head-scr07.png`, `w1366\mock-SCR-07.png` of pass 1 |
| N-5 | SCR-07, 360 and 768 | The Parts tree is a foldable panel **at the foot of the page, after the six stage cards** (about 3,100 px down at 768); the SCR-06 layout puts it above | Minor (Sev-4) | `w768\head-scr07.png` (no tree in view) |
| N-6 | SCR-06 read-only view | A read-only drop-down is drawn white with a chevron (looks editable) | Minor (Sev-4) | `w1366\ro-chosen-row.png` |
| N-7 | SCR-07 | No `View inputs` link (RO-18, ruling 3.1) | Major (Sev-3), the named control is missing | (source search) |

## 6. What QA can do with this

- **Close** DEF-095, DEF-110 and DEF-113 (with N-4 and N-5 filed), and DEF-129 and DEF-132 (on every check run; TS-12, TS-13, TS-15 and TS-16 stay QA's or CI's).
- **#800 (DEF-131 view):** every RO check I ran passes except RO-18's `View inputs` link (N-7). RO-7, RO-8, RO-14 and parts of RO-3 and RO-10 were not run; QA should cover them on the merged build. I would not close DEF-131 Stage 1 until N-7 is decided (build it, or the product-owner defers it).
- **DEF-133:** conforms on its head; close it once #812 merges, on the merged build.
- **Pass 3** (after #806, #811 and #813 merge, if the coordinator asks): Stage 2 editing and the Lead's tree controls (ED-1 to ED-37), and DEF-096's compact task card.
