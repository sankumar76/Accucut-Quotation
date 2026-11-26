# UX ruling: the Lead's and Admin's view of the Engineer's inputs on SCR-06, read-only first (Stage 1), then editable (Stage 2)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-26 (file dated 27 Nov as asked) |
| Asked by | Delivery lead, through the main session. First ask: "Lead should be able to see the input values so they can review the output fields accordingly" (read-only). **Widened the same day** (DEF-131): "Lead and admin should be able to view and also EDIT the input fields." This file replaces the planned `lead-read-only-inputs-2026-11-27.md`; no such file was ever written, so there is nothing to delete |
| Effect on earlier records | **DL-306 is overridden in full** (the delivery lead's word, relayed by the coordinator; master and the product-manager record it). That brings back UD-1 ("SCR-06 reuses the same form for Lead and Admin"), the Inputs block of the SCR-06 mock-up, and the clause of FR-064 that a Lead or Admin edits a DRAFT or PREPARED estimate. My 26 Nov note ("no 'This row' box is added", `conformance-check-2026-11-28.md`, last section) said the row detail would go in the right-hand column when it shipped. This ruling does that |
| Merge target | Stage 1 by end of Sun 29 Nov (customer sees the rebuilt demo Mon 30 Nov). Stage 2 as soon after as is safe (see "Staging") |
| Read from | `ux-spec.md` UD-1 (line 24), UJ-06 and UJ-07, SCR-05 (lines 614 to 695), SCR-06 (lines 696 to 784, wireframe "Inputs: stepper + section cards (editable until locked)"), SCR-07; `SCR-06.html` (the Inputs block, states `default` = Prepared and `approved`, `form-lock`), `SCR-05.html` (state `submitted` = Prepared, read-only); `rulings/conformance-check-2026-11-28.md` (C-06-01, C-06-02 and the note on DEF-108 / DEF-112), `rulings/parts-tree-scr05-conformance-2026-11-26.md`; `decision-log.md` DL-306, DL-318; `prd.md` FR-064, FR-058, FR-060, FR-100; and, on `origin/master` `a6eb9809`, `estimate-review/estimate-review.tsx`, `review-tree.tsx`, `build-table.tsx`, `estimate-workspace/part-form.tsx`, `part-fields.tsx`, `field-renderer.tsx`, `read-only-select.ts`, `part-head.tsx`, `estimate-texts.ts`, `src/app/(portal)/estimates/[code]/page.tsx`, `api/v1/estimates/[id]/form`, `nodes/[nodeId]` and `nodes/[nodeId]/inputs` routes, `state-machine.ts`, `estimate-service.ts` (`assertEditable`) |
| Not done | No browser (Playwright and Chrome DevTools servers did not connect). Nothing here was seen running. No code edited. The mock-ups and `ux-spec.md` are not edited by this ruling (lines in "For the next spec touch") |

## Answers in one screen

| # | Question | Answer |
|---|---|---|
| 1 | Is there an existing design? | **Yes. SCR-06 already draws it**: the right-hand column beside the parts tree is "row detail": the row's title and "View cost details", then **Inputs**, which is the SCR-05 form (stepper plus eight section cards). The mock-up shows it editable (`default`, Prepared) and read-only (`approved`, "Read-only while approved."). No new screen is drawn. This is the design to build |
| 2 | Where does a Lead or Admin open it? | On SCR-06 itself, at `/estimates/<code>`, from the queue as today. Pick a row in the parts tree; its inputs show beside (from 1024 px) or below (under 1024 px) the tree. There is no second page and no trip to SCR-05, so "back to review" is just the same page: the tiles and "How the total is built" stay above |
| 3 | What is built first? | **Stage 1 (Sun 29 Nov): every input, per row, read-only, for every status.** About one developer-day, no server change (the form and part reads already serve a Lead and an Admin). **Stage 2: editable in DRAFT and PREPARED** (about one and a half more days, needs the architect's rules). Picture editing and the Material Rate row are Stage 3 |
| 4 | What does the Engineer see? | Nothing changes. No new route, no new field, no figure. NFR-002 holds (section 5) |
| 5 | Does Sun 29 Nov hold? | **For Stage 1, yes from the design side**: it reuses built components and a drawn layout, and needs no new mock-up. It is the developer's day, plus a green three-width E2E. **Stage 2 does not fit Sun 29 Nov** with any safety: it must be merged only when the architect's status rules are in and a Lead's edit-then-Recalculate has been run end to end |

## 1. Where the view lives (cited)

| What | Existing design | Cited |
|---|---|---|
| Place | The right-hand column of SCR-06, beside the parts tree, under "How the total is built" | `SCR-06.html` (head `1.4 · Top cover`, `View cost details`, then `Inputs`); ux-spec SCR-06 wireframe line "Inputs: stepper + section cards (editable until locked)"; UD-1; UJ-06 step 2 ("Open a part; see inputs and the final cost"); my 26 Nov note: "When the row detail ships after G8, it goes in that column and 'How the total is built' moves back to full width above the two columns" |
| Contents | The SCR-05 form: part head, section strip, eight section cards in SPEC 7.1 order, each field with its label, Excel column tag, unit and value. Section and field **names are shown as stored** (ruling of 26 Nov, C-05-06) | SCR-05 "Fields" and layout rules; `part-fields.tsx` |
| Read-only look | The same cards with read-only fields (shaded, dashed border, `aria-readonly`) | `screens.css` `.input[readonly]`; `SCR-06.html` state `approved`; `field-renderer.tsx` (`readOnly`), `read-only-select.ts` |
| Page order | **Tiles, then "How the total is built" (a closed `details`, full width), then the two columns: tree and Inputs.** Under 1024 px the tree (a foldable `details`) sits above the Inputs | mock-up; 26 Nov note |

**Differences from the mock-up (all deliberate):**

1. **Read-only is `readonly` plus `aria-readonly`, not `fieldset disabled`.** The mock-up's `form-lock` disables every control. A disabled control leaves the keyboard path and, in most browsers, the screen reader's reading order, which is exactly what the Lead needs to read. The build already does this correctly for the Engineer (`readOnlySelectProps`, AQP-401). Use it.
2. **No "This row, on screen and in the Excel row" box is added.** The tree row already carries the row's BG, count, dollars and euros. A single line in the row head repeats them (section 3.3), so under 1024 px, where the tree is folded, the Lead still sees the figure beside the inputs.
3. **The mock-up's "Material Rate / Kg (I), Auto, Lead and Admin only" row is Stage 3.** The form definition has no I for any role (`form/route.ts`, FR-051); it needs a Lead-only read of the rate the calculation used. SCR-07 stage 2 already shows it. Until then section 02's range tag is whatever the registry gives, with no I.
4. **The "Review note" on SCR-05 and the section 0.9 CR-01 notes** are not repeated.

## 2. Staging

| Stage | What | Needs | Merge |
|---|---|---|---|
| **1. Read-only view** | Section 3 in full, for every status and both roles. No edit control anywhere. Notices of 3.5 | Nothing from the architect. Existing `GET /form`, `GET /nodes/{id}`, `GET /tree`, which already serve Lead and Admin | **Sun 29 Nov** |
| **2. Edit** | Section 4: editable for a Lead or Admin while the estimate is DRAFT or PREPARED (the rule the server already enforces, `canEditInputs`); autosave; figures cleared; Recalculate; conflict notice | The architect's status, audit and step-up answers (section 6) and a shared save gate between the Inputs and the Recalculate button | When safe: not before Mon's demo unless the architect answers by Fri 27 Nov and a second developer builds it in parallel |
| **2b. Optional** | "Last changed by" line and the audit entry; Part Model picture Replace and Remove for a Lead | Architect's audit answer; check the image route allows a Lead | After Stage 2 |
| **3. Later** | Material Rate / Kg (I) row; the "This row" box of the mock-up; Lead's tree-structure actions (add, delete, move) | Separate decision. **Not part of "edit the input fields"**: Stage 2 changes the values of rows that exist and never the tree | After G8 |

If Stage 2 is not ready for Mon 30 Nov, the demo shows Stage 1 and the notice in 3.5 says nothing about editing. Do not ship a Stage 2 control that is hidden behind a flag in the demo build.

## 3. Stage 1: the read-only view

### 3.1 How the Lead picks a row

- **The row is a link.** In the SCR-06 tree each row's first line (kind tile, Sl. No, name) becomes one link to `/estimates/<code>?row=<Sl. No>#row-inputs`, as SCR-05's rows are links. The second line (count, figure, "Quantity 0" tag, **Cost details** link) stays as built. Two links per row, each with its own accessible name: `1.4 Top cover` and `Cost details for 1.4 Top cover`.
- **Selection is in the address**, so the choice survives reload, can be sent to a colleague, and needs no script in the tree. Use a soft navigation (`next/link`, `scroll={false}`) so the tiles and the tree do not jump and the island's code is not read again.
- **The selected row** has `aria-current="true"` and the open-row look of SCR-05 (`--surface-2`, a start bar). No other change to the row.
- **Default.** No `row`, or a `row` that is not in the tree: the **first row** of the tree. No error page, no notice. An estimate with **no rows**: the Inputs block is not drawn and the tree's own empty line stays (`TREE_EMPTY`).
- **From SCR-07** the row header gets a link `View inputs` to `?row=<Sl. No>#row-inputs`; SCR-07's "Back to the estimate" breadcrumb is unchanged.
- **After a choice**: focus moves to the form title (`1.4 · Top cover`, `tabIndex -1`, as `PartHead` already has), and one polite status says `Showing the inputs of 1.4 Top cover. Read-only.` Under 1024 px the tree's `details` closes (so the inputs are in view) and its summary reads `Parts tree` plus the selected row, `1.4 Top cover`, so the way back to the tree is one press. From 1024 px the tree stays as it is.

### 3.2 The block (one column, top to bottom)

```
#row-inputs  (region, aria-labelledby = form title)
  Eyebrow   SUB-ASSEMBLY · LEVEL 2, UNDER 1 CONTROL CABINET ASSEMBLY      (PartHead, as SCR-05)
  Title     1.4 · Top cover                                                (h3, tabIndex -1)
  Row line  This row: ₹ 618.37 (BG) · $ 7.61 · € 6.97 · count 2 nos · View cost details     (Lead-only, 3.3)
  Progress  23 of 24 inputs complete                                       (PartProgress, as built)
  Status    Last saved 05 Nov 2026, 10:41 IST.                             (editable=false branch of saveStatusText)
  Notice    Read-only. ...                                                 (3.5)
  Strip     [01][02]...[08]  section jump links                            (SectionStrip, as built)
  Cards     01 Part Details ... 08 Other Costs and Remarks                 (SectionCard, auto-fit, min 232 px)
```

**Reuse, do not copy.** Draw it with the Engineer's `PartForm` and `PartFields` (UD-1) with `editable={false}`, plus one new prop that turns on the "review look" below (called `reviewView` here; the name is the developer's). Those files are `'use client'` and must stay out of `estimate-review/`, whose architecture test says no file in that folder is a client component and none is imported by the Engineer's page (`tests/unit/estimate-review-architecture.test.ts`). Put the island in its own folder and load it by dynamic `import()` on the Lead's branch only (NFR-009, NFR-002).

**What the review look changes** (and nothing else):

| Part of the Engineer form | In the Lead's view |
|---|---|
| Intro `Every field is needed to Calculate. Enter 0 where…` (`FORM_INTRO`) | Not drawn. It tells the Engineer what to type |
| Field **hints** | Not drawn, **except** the QTY per Assy hint (`QTY_PER_ASSY_HINT`: it says the count is for the whole order, which the Lead needs to read the figures) and the `Auto` mark on Sl. No and Material Considered |
| "Enter this value." messages and the missing-input triangles | Not drawn (no Calculate on this form). The count `23 of 24` and each card's `n of m` stay: they show the Lead what is blank |
| Empty value | `Not entered` (3.4) |
| `FORM_LOCKED` notice (`This estimate can no longer be changed.`) | Replaced by the Lead's notice (3.5) |
| Save bar, Save draft, Calculate, autosave, leave guard | None of them is drawn or started in Stage 1 |
| Labels, Excel column tags, units, **order**, section names, range tags | **As the Engineer's form, unchanged** (the build's tags before the label, as built; the mock-up's order after is a separate finding, C-05-10) |

### 3.3 Beside the output figures

The Lead reviews outputs against inputs, so the figures stay where they are and are never inside the form.

- **Tiles BL, BN, BO** stay full width at the top, as built, in every state.
- **The row's own figure is in the tree row** (as built) and **repeated once in the row line** under the title: `This row: ₹ 618.37 (BG) · $ 7.61 · € 6.97 · count 2 nos`, then the link `View cost details` (to SCR-07). It is built from the `CostNode` the page already has. States: figures current: as shown; **Cleared**: `This row: Cleared · count 2 nos`; **not calculated**: `This row: — · count 2 nos`. The count is an input and always shows. The `Quantity 0` tag shows when the tree row has it. **No other figure, rate or formula appears in or beside the form** (the row line is the only Lead-only output beside the inputs). Money format as SCR-06 (6.0, 2 decimals; Indian grouping is the separate open check).
- **At 1024 px and wider** the tree is the sticky left column (320 px), so the selected row's figure is on screen next to its inputs at the same time. Under 1024 px the row line does that job.
- Nothing is multiplied or summed; the "How the total is built" panel is unchanged.

### 3.4 What each field shows

| Field kind | Shows | Empty |
|---|---|---|
| Number (J, K, L, N, P, Q, R, V to Y, T, H, AP, AU, BM) | The value as stored, formatted as SCR-05 shows it after saving (`1.5`, not `1.50`), with its unit as the addon (mm, kg, sec, nos, holes, Rs / pc, ₹: the DL-420 list as built). `0` shows `0` | `Not entered` |
| Text (B, D, S, AJ) | The text as stored, one line; Remarks wraps and is never cut. `None` shows `None` | `Not entered` |
| Treatment / Color (G) | The chosen name, or `Not applicable`. With `Other`, **both** the choice and the text typed (second field, label as built) | `Not entered` |
| Material in Drawing (E) | The chosen material's name, or `Not applicable`. A material deleted since is shown by its stored name, as built (`unlisted` option) | `Not entered` |
| Sl. No (A), Material Considered (F) | As built, shaded, with `Auto` | Material Considered is blank when E is `Not applicable` or empty |
| Fasteners Qty and Cost (T, U) | Shown only when Fasteners (S) is not `None` or blank, as built; otherwise the card keeps its line `Not needed. Saved as 0.` | n/a |
| Surface treatments (Z to AG) | **The chosen ones as chips** always visible, `Powder Coating AE = 1`, in registry order, under the label `Surface treatments Z to AG`. No pop-over, no checkboxes | `None selected` |
| Part Model (C) | **The picture** as stored, at the form's picture size, with the file name and size line of the mock-up, and an accessible name `Picture of 1.4 Top cover`. **No** Replace, Remove, "choose a file", camera or paste hint | `No picture` (muted; it is optional and never counts as missing) |

**How `Not entered` is drawn.** In the box, in `--ink-2`, italic, so it is not mistaken for a typed value and passes 4.5:1 (8.4:1 on white, 7.3:1 on the shaded box). Because a placeholder is not reliably read, also give the field an `aria-describedby` to a visually hidden `Not entered` (or set the select's empty option text to it). The value is never `0` or `—` for an empty field: `0` is a value the Engineer typed, and `—` is for a figure.

### 3.5 Notices (the block's one `Notice`, `tone="info"`)

Constants go in `review-texts.ts` (the Lead's file). The Engineer's `FORM_LOCKED` is not changed.

| Estimate | Words (exact) |
|---|---|
| DRAFT | `Read-only. These are the values saved for this part. The Engineer may still be changing them: reload the page to see the latest.` |
| PREPARED | `Read-only. These are the values saved for this part.` |
| APPROVED | `Read-only while approved. These are the values the price was approved with.` |
| QUOTED | `Read-only while quoted. These are the values the price was approved with.` |
| Ignored (any status) | `Read-only while this RFQ is ignored.` |

Stage 2 replaces the first two rows and extends the last three (4.2). The Ignored layer wins over the status, as everywhere on this page.

### 3.6 Loading, empty, error

| State | Behaviour |
|---|---|
| Loading a row | The block's own skeleton (as built: `role="status"`, `aria-label` = `FORM_LOADING`); title and row line are already drawn (they come from the page, not the form). The tree and tiles do not wait |
| Row has no inputs yet | Every field `Not entered`; `0 of 24 inputs complete`. No special notice |
| Form or part could not be read | The built notice `We could not load this part` with **Try again** (`PART_LOAD_FAILED_TITLE`, `FAILED_BODY`) inside the block; the rest of the page is untouched |
| Choosing a row that was removed meanwhile | The read answers 404; the block falls back to the first row (as the unknown `row` rule) |
| Permission denied | Not a state here: an Engineer never gets this page, and another Engineer's estimate is a 404 as today |

### 3.7 Keyboard, screen reader, focus

- **Tab order**: tree row links and their Cost details links, in tree order; then the block's section strip; then the fields in form order. **Read-only fields stay in the tab order** (they are `readonly`, not `disabled`), so a keyboard or screen-reader user can read every value. A select takes focus and does not open (built).
- **Typing into a read-only field changes nothing and sends nothing.** A select ignores keys that would change it (built). Enter on a read-only field moves to the next field as on SCR-05 (built); on the last field it moves focus to the form title (there is no Calculate button in Stage 1).
- **Focus on choosing a row** is the form title (3.1). Focus never goes to the tree's top, and the page does not scroll back to the tiles. The sticky section strip and the action bar never hide a focused field (WCAG 2.4.11), as on SCR-05.
- **Names.** The block is a region named by its title (`1.4 · Top cover`). Each field keeps its label and `Excel column J` read first, its unit in its accessible **description** (`Length, millimetres`, DL-420 rule). The selected row link has `aria-current="true"`. The status line in 3.1 is `role="status"`, one message per choice.
- **Not colour alone**: a blank is the words `Not entered`; the shaded read-only look is never the only cue (the notice and `aria-readonly` say it).
- **Reduced motion**: no scroll animation (`behavior: auto`).

### 3.8 Widths

| Width | Layout |
|---|---|
| **360** | Tiles stacked. "How the total is built" closed. Tree `details` (open until a row is chosen, then closed). The block below: one column of cards, one field per row (as the build), section strip scrolling in its own row, `Parts tree · 1.4 Top cover` summary above to reopen the tree. Targets 44 px on touch. No horizontal page scroll |
| **768** | As 360 but cards in **two columns**; the tree is the full-width foldable panel above the block (the accepted layout below 1024 px, `ux-spec` "SCR-06 parts tree") |
| **1366** | Tree sticky at 320 px on the left, the block on the right (`min-[1024px]` grid already in `estimate-review.tsx`, with `--tree-w`), cards in as many columns as fit at 232 px minimum (two or three). The tiles and "How the total is built" above both. The tree and the block each scroll with the page; the tree keeps its own sticky scroll |

"How the total is built" moves **above** the two columns at every width (26 Nov note); it is already a closed `details`, so the move costs little height.

## 4. Stage 2: editing by a Lead or Admin

The same block, with `editable` true. **Reuse everything the Engineer's form does** (UD-1): the same cards and fields, validation and messages, Enter order, on-leave saving, 30 s autosave (FR-054), the revision conflict flow, the hidden-character rule, the Description-is-the-name rule. Only the differences below are new.

### 4.1 Who can edit, when

`editable` is **`canEditInputs(state, viewerRole)`**, the function the server already uses (`state-machine.ts`; the workspace hard-codes `'ENGINEER'` today). Never a role or status test written again in the component. By the code on `a6eb9809` and FR-064:

| Status | Lead, Admin | Engineer (unchanged) |
|---|---|---|
| DRAFT | Editable | Editable (own task) |
| PREPARED | Editable; stays PREPARED (`EDIT` is PREPARED to PREPARED) | Read-only |
| APPROVED, QUOTED | Read-only. Unlock first (SCR-09; unlocking returns it to DRAFT) | Read-only |
| IGNORED (any status) | Read-only. Restore first | Read-only |

The server refuses a write the screen should not have offered (409), as built. A refusal turns the block read-only with the built words `This estimate can no longer be changed.` and keeps what was typed visible.

### 4.2 Notices (replace 3.5 for these states)

| Estimate and figures | Words (exact) |
|---|---|
| DRAFT or PREPARED, figures current | `You can correct inputs. Any change clears every calculated figure; press Recalculate to see them again.` (the mock-up's sentence) |
| DRAFT or PREPARED, figures cleared | `You can correct inputs. Every calculated figure is already cleared; press Recalculate when you have finished.` |
| DRAFT or PREPARED, not calculated | `You can correct inputs.` |
| DRAFT, any | Append: ` The Engineer can change this estimate too.` |
| APPROVED | `Read-only while approved. Unlock the estimate to change an input.` |
| QUOTED | `Read-only while quoted. Unlock the estimate to change an input.` |
| Ignored | `Read-only while this RFQ is ignored. Restore it to change an input.` |

### 4.3 After an edit

1. A change is saved by the Engineer form's own rules: on leaving a field, and every 30 s while there is something unsaved. A value equal after normalisation (`1.50` and `1.5`) writes nothing and clears nothing (server rule, built).
2. A save that **changed** something while the figures were current clears every calculated figure on every row (FR-100, D-20). The island then asks the page to read again (`router.refresh()`), so the tiles, the tree figures, the row line and the notices show the **Total cleared** state of SCR-06 as drawn: tiles `Cleared`, tree `Cleared`, **Recalculate** primary, **Approve and lock** and **Download** disabled with their reasons. **Nothing moves focus**; the form is not reset, the cursor stays in the field. The refresh is debounced so a run of saves is one read.
3. One polite status, **once per change from current to cleared**, from the island: `Saved. Every calculated figure is cleared. Press Recalculate to see them again.` Other saves use the form's usual line (`Draft saved at 10:42 IST.` as built). The page's own cleared notice is not relied on to announce.
4. **Recalculate** is the existing button (STORY-06.04), unchanged in words and place. **It must not run while a field holds a value that is not saved or a save is in flight**: it saves first, then calculates, the way Calculate waits on the Engineer's `SaveGate`. This needs one save gate shared by the island and the action bar (a small client context at the review's root). If a recalculation is refused for blank inputs, the existing refusal text shows and the fields it names open on their row (`?row=<Sl. No>`), each with `Enter this value.` under it until it has a value (the SCR-05 rule); if 06.04 shows less than that today, the developer states what it shows and the minimum is the refusal text alone.
5. The quantity warning of FR-104 is the existing dialog on Recalculate, unchanged.
6. **Description** typed on a row renames it (the Description is the name, 26 Nov ruling); the tree row follows after the refresh.

### 4.4 Conflicts, leaving, the Engineer working at the same time

- In DRAFT the Engineer can edit the same part. A save made against an older revision gets the built conflict notice (`CONFLICT_TITLE`: keep mine or use the newer; nothing is sent until the person chooses). Nothing is overwritten silently.
- Leaving the page or choosing another row while a value is not saved: the field commits on leaving (as SCR-05), and a value that cannot be saved (invalid) asks first with the built "Leave without saving?" dialog.
- Choosing another row never loses a typed value: the commit happens before the link is followed.

### 4.5 Who changed it, the audit trail, approval, step-up (UX assumptions, pending the architect)

| Question | UX assumption (mirror the architect's answer when it arrives) |
|---|---|
| **Who last changed a value?** | The SCR-05 and SCR-06 designs show no such thing; the status line has only the time. **Assumption:** one added line in the status area, **only when the last write was a Lead's or Admin's**: `Last changed by Kiran Bose (Lead), 27 Nov 2026, 14:20 IST.` (time as 6.0). An Engineer's own writes show the existing line only. If the part's answer cannot carry the writer, the line is **omitted** and nothing else changes (Stage 2b) |
| **Audit** | **Assumption:** a Lead's or Admin's change of an input writes an SCR-16 entry, event `Input change`, Object `1.4 Top cover`, Before to after in words per field, e.g. `Length 450 to 480`. These are inputs, not figures or rates, so no NFR-002 issue, but the log's Release 1 event list (ux-spec SCR-16) would gain a kind, which the architect and product-manager must confirm. An Engineer's drafts are not logged (too noisy). The log is read by the Admin only, as today |
| **Approval** | Editing needs no approval. An edit clears the figures, so Approve is blocked until Recalculate (existing rule, UJ-07). An edit never touches an approved price. After Unlock the first edit shows the existing "Unlocked and changed" state |
| **Step-up** | **Assumption: none for an input edit.** Step-up and the password stay on Approve, Unlock, Cancel approval and Remove price (SCR-08, SCR-09, SCR-06 Admin dialogs), unchanged |
| **Autosave for a Lead** | Same 30 s autosave as the Engineer's form |
| **Status** | An edit never changes the status. A Lead's Recalculate on a DRAFT sets PREPARED (FR-064, A-08), as built |
| **Tree structure** | Not offered to a Lead in this release (Stage 3). The Lead's tree stays the read-only tree: no "+", no delete, no move |

### 4.6 Picture (Stage 2b)

Stage 2 keeps the Part Model picture read-only (3.4). Stage 2b may add Replace and Remove for a Lead with the SCR-05 words, once the image route is checked for a Lead's session.

## 5. What an Engineer sees

**Nothing changes.** The Engineer's `/estimates/<code>` is SCR-05 as built; the Engineer's bundle gains no code (the island loads on the Lead's branch only; the architecture test stays green). No new route, field or response. The form definition and the part read carry **no rate, cost or formula for any role** (`form/route.ts`: "Material Rate / Kg (I) and every calculated field are not on it"), so reusing them for a Lead puts no Lead-only value in the form and none can reach an Engineer through it (NFR-002, FR-051). **The only Lead-only output beside the inputs is the row line of 3.3** (BG, dollars, euros of the selected row) and the tiles and tree that were already on the page; all are server-drawn on the Lead's branch. An Engineer's Prepared estimate stays read-only as today (FR-064); a Lead's edit of a DRAFT or PREPARED part shows to the Engineer as a changed value on reload, never with a figure.

## 6. Open points for the solution-architect (through the coordinator)

| # | Point | UX assumption until answered |
|---|---|---|
| A-1 | Which statuses allow an edit | As 4.1 (the server already says so) |
| A-2 | Does the part read carry who last wrote a value and when | If not, the "Last changed by" line is dropped |
| A-3 | Is a Lead's or Admin's input change audited, and as which event | `Input change` on SCR-16, 4.5 |
| A-4 | A shared save gate for the Inputs and Recalculate | Needed for ED-7; if impossible, Recalculate is disabled with the reason `Saving your change. Recalculate is available in a moment.` while a save is pending |
| A-5 | What a Recalculate refused for blank inputs returns, and whether it names parts and fields | As 4.3 item 4 |
| A-6 | Whether an edit by a Lead on PREPARED needs any status event beyond `EDIT` | None: stays PREPARED |
| A-7 | `router.refresh()` after each cleared-figure save is acceptable for the page's read cost (NFR-008) | Debounced to one read per burst |

## 7. Build notes (developer; suggestions, not architecture)

- New island folder, e.g. `src/components/features/estimate-review-inputs/` (`'use client'`), loaded by `next/dynamic` or `import()` from `review-page.tsx`. It wraps `PartForm` with `part={{ id, slNo, revision }}`, `editable={false}` in Stage 1, `nodes` built from the page's `CostNode`s (id, parent, Sl. No, kind, name) or read from `GET /tree`, and no-ops for `onSaved`, `onChanged`, `onNamed`, `onServerIgnored`, an empty `missing` set and a no-op gate.
- Add the review look as one prop on `PartForm` / `PartFields` / `FieldRenderer` / `SurfaceTreatments` / `PictureSlot`, so no second form exists. The picture and surface chips are the two places that need a different read-only drawing.
- `review-tree.tsx` gets the link on the first line, `aria-current`, and the `?row` read in `review-page.tsx` (a server component), which also draws the row line. `estimate-review.tsx` moves `<BuildTable>` above the columns.
- Texts go in `review-texts.ts` (Lead only). Run the cost-confidentiality scan and the architecture test; E2E at the three widths in CI (heavy browsers run in CI, CLAUDE.md §9 item 5).
- Stage 2: `editable = canEditInputs({ status, ignored }, viewerRole)` computed once in `review-page.tsx` and passed in; the island calls `router.refresh()` on a save that reports cleared figures.

## 8. Acceptance checks

### Stage 1 (read-only), RO-n

| ID | Check |
|---|---|
| RO-1 | As a Lead, open `/estimates/<code>` of an estimate with three or more rows: the tree rows are links; the first row is selected (`aria-current="true"`); the block shows its title `1 · <name>` and eight cards in SPEC 7.1 order with the stored section names and range tags |
| RO-2 | Press a row (mouse, Enter, tap): the address becomes `?row=<Sl. No>#row-inputs`, the tiles and tree do not jump, `aria-current` moves, the block shows that row's values, focus is on the form title, and the status `Showing the inputs of 1.4 Top cover. Read-only.` is announced once |
| RO-3 | Seed a part with a value in every field; for each field the value shown equals the stored one (numbers as SCR-05 shows after saving; Treatment `Other` shows choice and text; chosen surface treatments listed; picture shown). Compare by field ID in E2E |
| RO-4 | An empty field shows `Not entered` (italic, 4.5:1 or better); a stored `0` shows `0`; `None` shows `None`; a screen reader reads `Not entered` after the label |
| RO-5 | Labels, Excel column tags, units and field order equal the Engineer's SCR-05 form for the same part (assert against the same `/form` answer); section names are as stored |
| RO-6 | There is no edit control: no Save draft, Calculate, Replace, Remove, "choose a file" or paste hint, no save bar, no autosave request. Typing into a text or number field changes nothing and sends no `PATCH`; a select does not open and does not change |
| RO-7 | Picture: present, it is shown with no controls; absent, the words `No picture` show and it is not counted as missing |
| RO-8 | Surface treatments show as chips; none chosen shows `None selected`; no pop-over opens |
| RO-9 | The notice words of 3.5 show exactly for DRAFT, PREPARED, APPROVED, QUOTED and Ignored; Ignored wins over the status |
| RO-10 | Beside the inputs: figures current show the row line `This row: ₹ … (BG) · $ … · € … · count n nos`; cleared shows `Cleared` with the count; not calculated shows a dash with the count. The form itself holds no figure, rate or formula |
| RO-11 | The intro sentence, field hints (except the QTY per Assy hint), `Enter this value.` messages and missing triangles are not drawn; the part's `n of m` and each card's count are |
| RO-12 | As an Engineer: `/estimates/<code>` is the unchanged SCR-05; the Engineer's page bundle does not contain the island; the cost-confidentiality scan and `estimate-review-architecture.test.ts` stay green; an Engineer asking for another Engineer's `/form`, `/nodes/<id>` or the Lead's page gets the same 404 or 403 as before |
| RO-13 | Keyboard only: Tab goes tree links, Cost details links, section strip, then every field in order; read-only fields take focus with a visible focus ring; no trap; Enter on a field moves to the next; on the last it moves to the form title |
| RO-14 | Screen reader: the block is a region named `1.4 · Top cover`; every field reads label, `Excel column <letter>`, value, and its unit as the description; the selected row reads as current |
| RO-15 | At 360, 768 and 1366 px: no horizontal page scroll; cards 1, 2, and 2 or 3 columns; at 1366 the tree is the sticky 320 px column and the selected row's tree figure and its inputs are on screen together; under 1024 px the tree closes after a choice and its summary reads `Parts tree · <row>`; touch targets 44 px, 24 px elsewhere; the sticky strip never hides the focused field |
| RO-16 | A `?row` that is not in the tree opens the first row with no error; an estimate with no rows draws no block; a failed read shows `We could not load this part` and **Try again**; the loading skeleton has `role="status"` |
| RO-17 | axe scan on SCR-06 with the block open, Lead and Admin, three widths: no serious or critical finding |
| RO-18 | SCR-07 has a `View inputs` link to `?row=<Sl. No>#row-inputs` for its row; "How the total is built" is above the two columns at every width |

### Stage 2 (edit), ED-n

| ID | Check |
|---|---|
| ED-1 | `editable` follows `canEditInputs`: a unit test over every status and role; Lead and Admin edit DRAFT and PREPARED; APPROVED, QUOTED and Ignored are read-only with the 4.2 words; the Engineer's rules do not change |
| ED-2 | Type a value and leave the field: a `PATCH` goes, the line reads `Draft saved at <time> IST.`, a reload shows it; with a value left unsaved, autosave writes it within 30 s |
| ED-3 | First change on current figures: tiles `Cleared`, tree `Cleared`, **Recalculate** primary, Approve and Download disabled with their reasons, focus still in the field, and the status `Saved. Every calculated figure is cleared. Press Recalculate to see them again.` is announced once |
| ED-4 | A value equal after normalisation (`1.50` to `1.5`) sends nothing, clears nothing |
| ED-5 | Validation words are SCR-05's: 2 decimals, no negatives, 100 characters, the hidden-character message; shown on leaving the field; the field keeps what was typed |
| ED-6 | Enter moves through fields in the SCR-05 order; on the last field it moves to **Recalculate** (never presses it), else to the title |
| ED-7 | Type in a field and press Recalculate without leaving it: the value is saved first, then calculated, and the new figures use it |
| ED-8 | In DRAFT, the Engineer saves a part after the Lead opened it, then the Lead edits it: the conflict notice appears with keep mine or use the newer; nothing is overwritten silently |
| ED-9 | Choosing another row with a typed value commits it first; an invalid value asks `Leave without saving?` |
| ED-10 | Editing Description renames the row in the tree (after the refresh); clearing it falls back to Part No., else the kind's name |
| ED-11 | A Lead's edit of a PREPARED estimate leaves it PREPARED; after Recalculate, Approve and lock is enabled; the approved price and audit of earlier approvals are untouched |
| ED-12 | The estimate is approved or ignored elsewhere while the page is open, then a save is tried: the 409 turns the block read-only with `This estimate can no longer be changed.` and the typed text stays visible |
| ED-13 | An Engineer opens the part after a Lead's edit: sees the new value, no figure; the Engineer's Prepared lock is unchanged; no request an Engineer can make reaches the Lead's island or a Lead-only value |
| ED-14 | **Conditional on the architect (A-3):** a Lead's input change writes one SCR-16 entry (`Input change`, Object, per-field before to after) with no rate or figure; the Engineer's drafts write none |
| ED-15 | **Conditional on A-2:** after a Lead edits, the status area reads `Last changed by <name> (<role>), <time> IST.`; after an Engineer's save it does not |
| ED-16 | The Lead's tree has no "+", delete or move control; the Part Model picture stays read-only (Stage 2) |
| ED-17 | axe at three widths with an editable block and a field error showing: no serious or critical finding; the error follows the built rules (icon, text, `aria-invalid`, `aria-describedby`) |

## For the next spec touch (not edited here)

- **ux-spec**: UD-1 restored in full (remove "post-G8" from the DL-306 marking); SCR-06 gets a "Row detail and Inputs" paragraph pointing here; SCR-06 states table gets "Inputs read-only (Stage 1)" and the words of 3.5 and 4.2; SCR-16 gets `Input change` once A-3 is answered; UJ-06 step 2 and UJ-07 stand as written.
- **SCR-06.html**: the default (Prepared) state is the editable Stage 2 look; add a state `readonly` with the 3.5 notice, `Not entered` samples and a chosen-chips surface treatment; move "How the total is built" above the columns (the mock-up already draws it there); drop the Material Rate row until Stage 3. SCR-07 gets the `View inputs` link.
- **Records** (master and product-manager): DL-306 and G8-C-FR064, the PRD FR-064 "waived" sentence, KG-1 and the release notes' workaround line.
