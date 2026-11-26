# UX conformance check, part 2: the running build against every SCR mock-up (DL-411)

| Field | Value |
|---|---|
| Author / date | ux-expert. Checked on 2026-11-26 (the file name carries the date the delivery lead set, 28 Nov) |
| Build checked | Production build (`next build`, `next start`) of `origin/master` `e3dc5b0b`, in a scratch worktree, with its own PostgreSQL container and invented data only. The demo database, the main checkout and every lane worktree were not touched. Container, server and scratch worktree are removed at the end |
| Roles | Admin, Lead, Engineer (invented people and a 12-row product tree). Browser: Chromium, locale en-IN, reduced motion |
| Widths | 360, 768 and 1366 px |
| Compared with | `docs/03-ux/screens/SCR-*.html` on `origin/master` (same widths, same state where the mock-up has one) and `ux-spec.md` |
| Severity | Major = proposed Sev-3 (the screen works but a designed structure, control or sentence is missing or wrong); Minor = proposed Sev-4 (copy, icon, spacing, order) |
| Accepted and not counted | Item 8 toolbar under the row as refined by DL-409 and my 26 Nov ruling; e-mail off at go-live (SCR-01 and SCR-02 "Ask the Admin", SCR-04 e-mail step, SCR-15 OFF wording); the 24 Nov ruling (tile icons, 320 px tree, "Tree width" button, status-legend words, legends); DEF-089 to DEF-092 (lanes 1 to 3) |
| Batches already with QA | Batches 1 and 2 (SCR-05, 01, 03, 04, 06, 07, 10 to 17, 19, 23) were relayed to QA by the coordinator; QA filed batch 2 as DEF-106 to DEF-119 (records-u `29a87670`). The IDs below (C-xx-nn) are this report's own and group the same findings; this file adds batch 3 (SCR-05 states, SCR-08, 18, 20, 26 and the 360 px passes) and the whole list in one place |

## How far the check went (read this before the tables)

* **Looked at in full at 1366 px, side by side with the mock-up:** SCR-01, 03 (Lead), 04, 05, 06, 07, 10, 11, 12, 13, 14, 15, 17, 18, 19, 23. **At 360 px:** SCR-05 (and its tree drawer and "+" menu), 03, 06. **At 768 px:** SCR-05, 03 (text and height only).
* **States driven by hand:** SCR-05 "+" menu (Main Assembly and Sub-Assembly rows), delete row, Calculate blocked, move menu, empty Draft, Prepared and Approved as Engineer, quantity warning; SCR-08 approval dialog; SCR-09 unlock dialog; SCR-20 delete field; SCR-25 account menu; SCR-26 404 and 403.
* **Checked by text diff and page height only** (data screens): SCR-16, 21, 24 and the 360 and 768 widths of SCR-04, 07, 10 to 15, 17, 19, 23. A layout fault that does not change the words or the height can be missed there. These are not listed as "no deviation".
* **Not exercised:** SCR-05 states Picture too large, Drag to reorder (a pointer drag), Loading, Unsaved changes dialog (the build opened the queue instead of the dialog when I clicked "My tasks", see C-05-17); SCR-06 states Total cleared, Rates changed, Unlocked; SCR-02 reset states (e-mail off); SCR-22 E-mail alerts (not a route in the build; e-mail is off at go-live, accepted).
* **Not judged:** the Indian digit grouping on SCR-06, 07 and 10 (`6,48,56,863.01`; the mock-up shows `12,951.53`). It follows my browser locale. QA should check the number-format rule once.
* Data differences (names, figures, dates, counts, "Overdue" rows) are not deviations.

## Global (every signed-in screen)

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-G-01 | all | Side nav of an Engineer: My tasks, About. Lead: Task queue, Assign task, Fields and formulas (View only tag), About | Extra "Home" item on every role; "Fields and formulas (view only)" wraps in the nav | Minor | `app-nav` items |
| C-G-02 | all | Footer of the nav: `Version 1.0` and `(c) Accucut Lasers Pvt Ltd` | Missing | Minor | nav footer |
| C-G-03 | all | Page head pattern on SCR-05, 06, 07, 10: breadcrumb (`My tasks / Q-...`, `Task queue / Q-... / Cost details 1.4`), H1 `Estimate <code>` with status badges beside it | No breadcrumb on those four screens (SCR-04 and SCR-19 have one); H1 is the bare code; badges sit on a row of their own | Major | page-head component |
| C-G-04 | 1366 | Narrow screens (SCR-01, 15, 23) sit in a centred column of about 480 px | Same screens are left aligned or full width | Minor | page container |

## SCR-01 Sign in

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-01-01 | 768, 1366 | Card in a centred column of about 480 px | Card spans the content width, left aligned | Major | sign-in layout |
| C-01-02 | all | Reveal-password icon inside the field; no placeholder | Separate square button beside the field; E-mail placeholder `name@company.com` | Minor | sign-in form |

## SCR-03 Task queue (Lead and Engineer)

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-03-01 | all | Tabs Open, Overdue, Closed, Ignored; tabs and filters in one card, tabs first | Open, Closed, Overdue, Ignored; filter card above a separate tab card | Major | queue tabs |
| C-03-02 | 768, 1366 | Columns TASK, ENGINEER, CUSTOMER (short name), FOLDER (path, Open folder, Copy path), DEADLINE, STATUS, ASSIGNED BY, edit icon; `Subject:` line | TASK, ENGINEER, DEADLINE, STATUS, ACTIONS; customer and folder inside the task cell; no Subject line, no Assigned by column | Major | queue table |
| C-03-03 | 360 | Card per task with a primary `Open` button and `Copy path`; tabs scroll in one row | No `Open` button (the code is the link); `Reassign or change deadline` button; extra lines `Engineer:` and `Assigned by:`; tabs wrap to two rows | Minor | queue card |
| C-03-04 | all | Row action is a pencil icon button | Text button `Reassign or change deadline` | Minor | |
| C-03-05 | all | Subtitle `All tasks. Filtered to the ones you assigned; remove the filter to see everyone's.`; `Filter: Assigned by me x`; labels Search, Deadline from, Deadline to | `All tasks assigned to Engineers.`; chip without `Filter:`; `Search tasks`, `Deadline from (IST)`; the "Your browser may block links" note sits above the table | Minor | |
| C-03-06 | all, Engineer | Engineer table shows Subject and Open folder | Same gaps as C-03-02 | Minor | |

## SCR-04 Assign task

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-04-01 | 768, 1366 | Pairs: Engineer + Customer Name, Title + Subject | One field per row | Minor | |
| C-04-02 | all | Hints: Customer Name `...Only a Lead or Admin can set or change it; the Engineer sees it read-only.`; Short name `Fills in when you choose the customer. It starts the Excel file name, for example MAS_Feed-hopper_17-11-2026.xlsx.`; Subject `Up to 80 characters. Used in the Excel file name and the e-mail subject.`; tag `From the Customer master` inside the Short name field; dark callout about blocked links | Shorter or different hints, no in-field tag, no callout; side panel step 3 says `customer and the subject` | Minor | |

## SCR-05 Estimate workspace (Engineer)

Known and in lanes (verified present, not re-filed): rows named `Part` and form title `Part 1` (DEF-089/090); toolbar visible under the open row (DEF-091); "+" menu without Sub-part, header and hints (DEF-092).

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-05-01 | 768 | Tree is a collapsible left panel beside the form; two columns | Tree stacks full width above the form under a `Hide parts tree` bar; one column | Major | `parts-tree-area.tsx`, breakpoints. No ruling found |
| C-05-02 | all | "+" menu opens in line under its row | Floating popover above the row, covering the tree head and the form (also at 360 inside the drawer) | Major | `add-node-menu-panel.tsx` (Radix content) |
| C-05-03 | all | Head: breadcrumb, `Estimate <code>` + Draft badge, subtitle `<title> . Every field is needed to Calculate...`, due pill | See C-G-03; the intro sentence is moved into the form column | Major | |
| C-05-04 | all | ONE compact card, three rows: TASK FOLDER (link, Copy path, note at the right); CUSTOMER `<name> (BWC)` + SUBJECT + lock line `Set by <Lead>. Only a Lead or Admin can change the customer.`; NOTES FROM `<Lead>`. Uppercase labels with icons | Two tall cards: `Customer Name / Customer Short Name / Subject (project name)`, then `Task folder` with the note in a bold-prefix sentence. Lock line missing. (CR-01 items 1 and 6, scheduled before G8: not accepted) | Major | `estimate-workspace.tsx` header |
| C-05-05 | all | Form head: eyebrow `SUB-ASSEMBLY . LEVEL 2, UNDER 1 CONTROL CABINET ASSEMBLY`, title `1.1 . Base frame`, short black bar `23 of 24 inputs complete` | `Parts and inputs`, `Part 1`, last-saved lines, full-width red bar `21 of 21 inputs complete` | Major | form head |
| C-05-06 | all | Section cards: green number tile; range tag and `4 of 4` on one line | Plain number; `4 of 4 complete` on its own line. **Corrected 2026-11-26 (later): the section NAMES are not a defect.** The build shows the stored names, which are SPEC 7.1's (`Part Details`, `Material and Dimensions`, `Cutting Process`, `Welding`, `Surface Treatment`, `Other Costs and Remarks`); the mock-up's sentence case and the long `Welding, drilling and tapping` were my drawing, not the requirement | Major for the structure only | registry section names, `section-card` |
| C-05-07 | all | Delete dialog `Delete 1.1 Base frame?` listing every row under it and `The remaining parts are renumbered.` | `Delete row 1.1?` with a count only | Major | delete confirmation |
| C-05-08 | all | Empty Draft points at `Add main assembly` | Form area says `add the first one with "New item"` (no such control) | Major | empty text in `estimate-texts.ts` |
| C-05-09 | all | Units: mm, nos, holes, kg, sec, Rs / pc | Only kg, sec and Rs are drawn (`seed-config.ts` seeds only kg and sec) | Minor | seed units; new registry version for existing databases |
| C-05-10 | all | Column badge after the label; Sl. No `1.1` with `Auto`; Material Considered with `Auto` | Badge before the label; `1`, no `Auto` | Minor | |
| C-05-11 | all | Hints with double quotes and full stops; `From the Material Master. ...`; Tool Cost `Enter 0 if this part has no tooling.`; Remarks `...Enter moves to the next field; Shift+Enter starts a new line.` | Single quotes, no full stop, no Material Master sentence; Tool Cost `Enter 0 if there is none.`; Remarks hint shorter | Minor | |
| C-05-12 | all | Surface treatments: label `Surface treatments Z to AG`, chips `Primer AA = 1`, hint `Selected = 1, not selected = 0. You can select none.` | Trigger `None selected`, hint `Choose every treatment this part needs. Choose none if it needs none.` | Minor | |
| C-05-13 | 360 | Two fields per row (compact); button `Parts tree 1.1 Base frame` with the branch icon | One field per row; `Parts tree, part 1` | Major | CR-01 item 1 |
| C-05-14 | all | Section strip: active pill black with mono number | Plain pills with ticks | Minor | |
| C-05-15 | all | Prepared (Engineer): notice `Prepared. Your inputs are now read-only. A Lead or Admin reviews them. If something has to change, ask them.` | On reload only `This estimate can no longer be changed.` (the Prepared notice shows only right after the press) | Minor | `estimate-workspace.tsx` |
| C-05-16 | all | Part Model empty state: dropzone with link `choose a file` | Dropzone with a `Choose a file` button (mock-up draws only the filled state) | Minor, no design for the empty state | |
| C-05-17 | desktop | Unsaved changes: dialog `Leave without saving?` | Clicking `My tasks` after typing in Description left the page with no dialog (the field commits on blur, so nothing was unsaved; not a defect unless the mock-up case is a value typed and not yet blurred) | Check | verify with QA |

## SCR-06 Estimate review (Lead), SCR-07, SCR-08, SCR-09, SCR-10

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-06-01 | 1366 | Parts tree in a column beside the row detail | Full-width card below the tiles, every row with its figures | Major | Recorded: ux-spec "SCR-06 parts tree (AQP-319 SQR-10 (1))", "not accepted from 1024 px, follow-up for the hardening window". Open |
| C-06-02 | all | Row detail (`This row, on screen and in the Excel row`), `View cost details`, and the Lead's `Inputs` form with sections 01 to 08 | Absent | Major | Story 06.04 (AQP-321) owns it; QA to check its status |
| C-06-03 | all | Head: see C-G-03; one meta line `... Brightwater Controls (BWC) Change customer . Entered by <Engineer> . Assigned by <Lead>`; `Open folder` and `Copy path` | `Change customer` button, a three-column customer card and a Task folder card | Major | |
| C-06-04 | all | Tiles `Total Unit Production Price (INR)`, `BL / total Tool Cost (INR)` with `Total Tool Cost <amount> from <n> parts. File cell BN2.`, BL helper `Whole estimate: the sum of every row's BG.` | `Total Unit Production Price`, `Price per Tool Cost` with `BL divided by the total Tool Cost`, BL helper `File cell BL2` | Minor | check D-16 wording first |
| C-06-05 | all | `How the total is built` is collapsed (`Show`) with the explanation, the 24-lids example and a per-row table | Always-open table headed `How the total is built (the BG of every row added up)` | Major | |
| C-06-06 | all | Status badge `Approved` | `Approved and locked` | Minor | |
| C-07-01 | all | Breadcrumb, description, parts tree column, heading `Cost details for one row 1.4 . Top cover`, the `This row, on screen and in the Excel row` box | None of them; a one-line strip and a `Unit Production Price` tile | Major | same cause as C-06-01 |
| C-07-02 | all | Stages are numbered collapsible cards `1 . Weights and areas` with chevron, letter tile, mono formula and substituted formula; capital sub-headings | Flat panels `1. Weights & Areas`, `Stage total: ...` | Major | |
| C-08-01 | desktop | Approval dialog: title `Approve and lock <code>`; lead-in `Set the Approved Quote Price. After you approve, inputs become read-only and the task moves to Closed.`; `Calculated total (BL)` and `Customer` rows; hint `Starts as the calculated total. Edit it to set a different price.` | Title `Approve and lock`; only the override sentence and the price field | Major | approve dialog |
| C-10-01 | all | Breadcrumb; intro `Download this estimate as an .xlsx file that follows the worksheet layout. The file is available once a calculation is current.`; card `File` with `Rows: 1 header row, then one row per part in tree order (12 rows), then one empty row and the Total Tool Cost row`, `Columns: A to BO, in the worksheet's order and widths`, file-name rule line | `Back to the estimate` button; no intro; card `The file`, `Rows in the file 12 parts`, `A to BO`, no rule line | Minor | |
| C-10-02 | all | Rows table with kind icons and indent by level | Plain Sl. No and name | Minor | |

SCR-09 Unlock dialog: words match the mock-up (only the hint under the reason differs in being present). No deviation.

## Masters, configuration, administration

| ID | Widths | Design | Build | Sev | Hint |
|---|---|---|---|---|---|
| C-11-01 | all | Row actions on SCR-11, 12, 13, 14: bordered ink icon buttons | SCR-11 and SCR-13 draw bare red icons; SCR-12 and SCR-14 draw bordered buttons | Minor | one shared icon-button |
| C-12-01 | all | Customer name is a red link | Plain bold text | Minor | |
| C-13-01 | all | Tabs, then `Add material` at the right, no search | Extra `Search materials` field; `Add material` above the table | Minor | no ruling found |
| C-14-01 | all | Icons: shield (Hand over Admin role), plus (Add user), X / check (deactivate / reactivate) | Arrows, person-plus, person icon | Minor | |
| C-15-01 | 1366 | One centred card; toggle at the right of `E-mail alerts: ON`; no extra sentence | Two wide left-aligned cards; extra sentence `Nothing on this page starts, restores or deletes a backup.` | Minor | OFF wording accepted |
| C-17-01 | all | Header buttons `Checkpoints`, `Insert field`; note `Configuration version 9, 67 columns, A to BO.`; Kind as pills with icons; Section as `Part Details`; icon buttons + and bin; Formula column shows the formula or lookup | None of the buttons or the note; plain text kinds and `Section 1: Part Details`; text buttons `Insert after`, `Delete`; `No formula` on auto rows | Major | check whether Insert field is reachable from this page |
| C-18-01 | 1366 | Breadcrumb; card head `Formula` with an `Output` tag; `Formula for AL`; intro `Type letters, rate names, numbers, + - * / and brackets...`; list of used names with `input` / `rate`; `Shows in the cost details as <formula>` | None of these; label `Formula M`; different intro | Minor (Major for the missing `Shows in the cost details as`) | |
| C-19-01 | 1366 | Stepper pills `1 What to add / 2 Details / 3 Preview and save`; three tiles side by side, none tinted | Numbered dots; vertical radio rows, the first tinted red; extra Cancel | Minor | |
| C-20-01 | desktop | `... moves every later field one letter to the left (AY becomes AX, and so on).` | Sentence stops before the bracket | Minor | |
| C-23-01 | all | No reveal buttons; centred card | Reveal buttons beside all three password fields; left aligned | Minor | |
| C-26-01 | desktop | 404: `The link may be old or mistyped. Use the menu to find what you need.` | `The link may be old or mistyped.` (button wording `Go to the task queue` is right for a Lead or Admin) | Minor | |

## Screens or states checked with no deviation found

SCR-02 (apart from the accepted e-mail-off page), SCR-09 (unlock dialog), SCR-25 account menu (same items), SCR-26 403 (same text), the SCR-05 quantity warning dialog (words match; only the DOM order of the two buttons differs from the mock-up), the SCR-05 tree drawer at 360 px (head, rows, legend, add main assembly), the SCR-05 move menu (`Move up`, `Move down`), the SCR-11 table layout and columns, the SCR-12 and SCR-14 table layouts, SCR-16 and SCR-21 (words only; data-dependent), SCR-24 (words only).

## Not in the build

SCR-22 E-mail alerts: no route (e-mail is off at go-live; accepted).

## Cleanup done

The server, the container `uxcheck-db`, the scratch worktree `ux-check` (a real copy of `node_modules`, no junction) and the scratch screenshots are removed after this file is committed.

## Note of 2026-11-26 (later): SCR-06 tree column and "How the total is built" for lane 3 (DEF-108 / AQP-465, DEF-112 / AQP-468)

Asked by the coordinator. DEF-109 is closed as accepted (DL-306: the Lead's input form and row detail wait until after G8), so the design's right-hand column has no row detail to hold. Ruling, both parts:

1. **Layout (DEF-108): confirmed, with one number corrected.** From 1024 px the tree card is a **left column of 320 px** (the SCR-05 token `--tree-w`, ruling 11 of 24 Nov; not 280, because each row also carries its count, its figure and the dollar and euro line, and the mock-up draws SCR-06 at 320 px), sticky, with its own scroll inside the viewport below the top bar. The three tiles stay full width above it. The right-hand column holds **"How the total is built"** for now. The figures and "View cost details" stay in the tree rows as built; **no "This row" box is added** (waived with DL-306). Below 1024 px the existing foldable panel stays (spec: 768 collapsible panel, 360 drawer). When the row detail ships after G8, it goes in that column and "How the total is built" moves back to full width above the two columns, which is where the mock-up draws it. No other rework.
2. **"How the total is built" (DEF-112): confirmed, heading corrected.** Closed by default, as built. The summary line is the whole control (keyboard and pointer), and carries at its right a **chevron and the word `Show` when closed and `Hide` when open** (the word is visible text, `aria-expanded` follows the state, and the chevron is decoration). **The heading is exactly `How the total is built`** (spec and mock-up). The build's suffix `(the BG of every row added up)` is dropped from the heading; the explanation paragraph inside already says it. Inside, keep the explanation, the worked example (2 frames, 6 pipes, 24 lids) and the per-row table with its total, as built. Tests: summary text is `How the total is built`; `Show` while closed, `Hide` while open; the table is not visible while closed.

## Note of 2026-11-26 (later): stored names are shown as stored (SCR-07 stages, DEF-114; SCR-05 sections, DEF-098)

One rule for both: **a name that is data (a section, a stage, a field, a rate) is shown exactly as stored, with no case or word rewriting in the page.** Option (A) for DEF-114: the stage head reads `1 · Weights & Areas` (number, a middle dot with a space each side, the stored name), and only the structure follows the design (numbered, collapsible card, stage total at the right). Reasons: the stored names come from SPEC 7.1 and the formula engine, the Admin can rename sections, and a display rule ("&" to "and", lower-casing) would mangle names that hold acronyms or a proper noun and would make the screen and the Excel file name the same thing differently. For DEF-098 the same answer: **the stored section names stand** (SPEC 7.1 is the requirement; the mock-up's sentence case and the long `Welding, drilling and tapping` were drawn by me), so C-05-06 above is withdrawn as to the names. The CR-01 session should redraw the section and stage names in SCR-05, 06 and 07 as stored. If the delivery lead wants sentence case, that is a change to the stored names (Admin or seed), not to the display.

## Note of 2026-11-26 (later): four questions from lane 3 (DEF-102 SCR-01, SCR-17, SCR-18)

1. **Reveal-password (DEF-102): build it, in the shared `PasswordInput`, in a follow-up PR.** Design (SCR-01 mock-up): the eye button sits **inside** the field at its right edge, `aria-label` `Show password` / `Hide password`, `aria-pressed`, `type="button"`. Size: it fills the field height minus the border (36 px on a fine pointer, 44 px on touch), so it clears WCAG 2.5.8 (24 px) and NFR-017 and no axe target-size finding can come from it; the field's right padding keeps typed text clear of it. One component change serves all ten forms; each form's E2E and axe run is the test. **Amendment to C-23-01:** the reveal control stays on SCR-23 and every other password field (the mock-up of SCR-23 simply did not draw it, and it helps people); only its place changes, from beside the field to inside it. The CR-01 session adds it to SCR-23's mock-up.
2. **SCR-17 Formula column on auto rows: build the words, as UI copy (not stored data).** A constant map keyed by field key in the SCR-17 text file, three entries, owner ux-expert: `sl-no` `From tree position`; `material-considered` `Material-Considered for E`; `material-rate-per-kg` `Material-Price-per-kg for E` (the mock-up's words, and SPEC 7.1's own notes for F and I). Any other auto field shows `No formula`. **Input rows show a faint dash `—`** (with `No formula` as `sr-only` text), as the mock-up draws, not the words `No formula`. Output rows show the formula as built.
3. **SCR-17 Kind badges (neutral badge, 12 px icon, stroke 2, `aria-hidden`, the word beside it):** Input `PenLine`; Auto `ArrowDownToLine`; Output `Calculator` (the same Output tag as the SCR-18 card head). These are the nearest lucide shapes to the mock-up's paths.
4. **SCR-18 `Shows in the cost details as`: confirmed as a read-only echo.** Label exactly `Shows in the cost details as`; the value in mono, right aligned, the editor's formula as typed (with `*`, as SCR-07 draws it), updating as the formula changes; while the formula is invalid it shows a faint `—`. It stores and sends nothing. Lane 3's other SCR-17 and SCR-18 plan (header buttons `Checkpoints` and `Insert field`, the version note, Kind badges, section name only, icon row actions with today's accessible names, breadcrumb, card head `Formula` with the Output tag, `Formula for <letter tag>`, intro words, used-names list) stands.

## Additions to the CR-01 UX session's change list (G8-C-UX05, DL-418), 2026-11-26 (later)

These join items 1 to 5 of "For the CR-01 session" in `parts-tree-scr05-conformance-2026-11-26.md`. The ux-expert did not edit `ux-spec.md`, the SCR HTML or the generator.

6. **Section and stage names as stored (ux-spec SCR-05 layout rule, line 637, and the SCR-05, SCR-06, SCR-07 mock-ups).** Line 637 lists the sections in sentence case (`01 Part details`, `06 Welding, drilling and tapping`, `07 Surface treatment`, `08 Other costs and remarks`). Replace the names with SPEC 7.1's, as stored: `Part Details`, `Material and Dimensions`, `Cutting Process`, `Bending`, `Fasteners`, `Welding`, `Surface Treatment`, `Other Costs and Remarks`. Add the rule: "A name that is data (section, stage, field, rate) is shown exactly as stored, with no case or word rewriting." Redraw the section cards and the section strip of SCR-05 (and the Lead's form on SCR-06) and the stage heads of SCR-07 with the stored names; the stage head reads `1 · Weights & Areas`, `5 · Rejection, Overheads & Logistics`. (Ruling of `09d54c70`.)
7. **SCR-03 content line (DEF-103).** The ux-spec SCR-03 line (inventory row 380 reads "Open, Closed, Overdue") and the SCR-03 content text name the tabs in **FR-034's order: Open, Overdue, Closed, Ignored**. Make the inventory row and every mention in the SCR-03 section say `Open, Overdue, Closed, Ignored`, and keep the mock-up's order.
