# UX ruling: the Lead's and Admin's view, edit and parts tree on SCR-06: read-only inputs first (Stage 1), then editable inputs (Stage 2), then the tree's add, move and delete (Stage 2T)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-26 (file dated 27 Nov as asked) |
| Asked by | Delivery lead, through the main session. First ask: "Lead should be able to see the input values so they can review the output fields accordingly" (read-only). **Widened the same day** (DEF-131): "Lead and admin should be able to view and also EDIT the input fields." **Widened again** (DEF-131): "Also the parts tree": a Lead and an Admin add, move and delete parts-tree rows as an Engineer does (FR-116, PRD 0.63, ED-AC-12 to 15). This file replaces the planned `lead-read-only-inputs-2026-11-27.md`; no such file was ever written, so there is nothing to delete. **Revision 2 (this version) adds section 4.7 (the tree), checks ED-18 to ED-37, and mirrors the architect's note v1.1 (`docs/04-architecture/lead-admin-input-edit-2026-11-27.md`, ec3711d0, sections 3.9 and 6a)** |
| Effect on earlier records | **DL-306 is overridden in full** (the delivery lead's word, relayed by the coordinator; master and the product-manager record it). That brings back UD-1 ("SCR-06 reuses the same form for Lead and Admin"), the Inputs block of the SCR-06 mock-up, and the clause of FR-064 that a Lead or Admin edits a DRAFT or PREPARED estimate. My 26 Nov note ("no 'This row' box is added", `conformance-check-2026-11-28.md`, last section) said the row detail would go in the right-hand column when it shipped. This ruling does that |
| Merge target | Stage 1 by end of Sun 29 Nov (customer sees the rebuilt demo Mon 30 Nov). Stage 2 (inputs) and Stage 2T (the tree, lane 2's PR 3) by the end of Wed 2 Dec at the latest (PRD ED-AC-11; architect 6.1) |
| Read from | `ux-spec.md` UD-1 (line 24), UJ-06 and UJ-07, SCR-05 (lines 614 to 695), SCR-06 (lines 696 to 784, wireframe "Inputs: stepper + section cards (editable until locked)"), SCR-07; `SCR-06.html` (the Inputs block, states `default` = Prepared and `approved`, `form-lock`), `SCR-05.html` (state `submitted` = Prepared, read-only); `rulings/conformance-check-2026-11-28.md` (C-06-01, C-06-02 and the note on DEF-108 / DEF-112), `rulings/parts-tree-scr05-conformance-2026-11-26.md`; `decision-log.md` DL-306, DL-318; `prd.md` FR-064, FR-058, FR-060, FR-100; and, on `origin/master` `a6eb9809`, `estimate-review/estimate-review.tsx`, `review-tree.tsx`, `build-table.tsx`, `estimate-workspace/part-form.tsx`, `part-fields.tsx`, `field-renderer.tsx`, `read-only-select.ts`, `part-head.tsx`, `estimate-texts.ts`, `src/app/(portal)/estimates/[code]/page.tsx`, `api/v1/estimates/[id]/form`, `nodes/[nodeId]` and `nodes/[nodeId]/inputs` routes, `state-machine.ts`, `estimate-service.ts` (`assertEditable`); for revision 2 also the architect's note v1.1 (sections 3.9, 6a), `prd.md` 0.63 (FR-116, ED-AC-12 to 15), and on `origin/master`: `estimate-workspace/tree-panel.tsx`, `tree-node.tsx`, `row-actions.tsx`, `parts-tree-area.tsx`, `use-parts-tree.ts`, `shared/parts-tree-list.tsx` (its `renderToolbar` slot), `lib/estimates/tree-actions.ts` (`treeActionsOffered`), `estimate-texts.ts`; `rulings/parts-tree-scr05-conformance-2026-11-26.md` items 3 and 4 |
| Not done | No browser (Playwright and Chrome DevTools servers did not connect). Nothing here was seen running. No code edited. The mock-ups and `ux-spec.md` are not edited by this ruling (lines in "For the next spec touch") |

## Answers in one screen

| # | Question | Answer |
|---|---|---|
| 1 | Is there an existing design? | **Yes. SCR-06 already draws it**: the right-hand column beside the parts tree is "row detail": the row's title and "View cost details", then **Inputs**, which is the SCR-05 form (stepper plus eight section cards). The mock-up shows it editable (`default`, Prepared) and read-only (`approved`, "Read-only while approved."). No new screen is drawn. This is the design to build |
| 2 | Where does a Lead or Admin open it? | On SCR-06 itself, at `/estimates/<code>`, from the queue as today. Pick a row in the parts tree; its inputs show beside (from 1024 px) or below (under 1024 px) the tree. There is no second page and no trip to SCR-05, so "back to review" is just the same page: the tiles and "How the total is built" stay above |
| 3 | What is built first? | **Stage 1 (Sun 29 Nov): every input, per row, read-only, for every status.** About one developer-day, no server change (the form and part reads already serve a Lead and an Admin). **Stage 2: inputs and the Part Model picture editable in DRAFT and PREPARED** (the architect's rules are in, note v1.1). **Stage 2T: the tree's add, move and delete** for a Lead and an Admin on the same two statuses (lane 2's PR 3). The Material Rate row is later |
| 4 | What does the Engineer see? | Nothing changes. No new route, no new field, no figure. NFR-002 holds (section 5) |
| 6 | Where do the tree controls go on SCR-06? | **On SCR-06's own review tree, which keeps each row's count, figure and Cost details link; the Engineer's toolbar (move handle, "+", "-") is added under each row, and "Add main assembly" at the foot.** The Engineer's tree is not swapped in: it has no figures (NFR-002), and PREPARED, the status a Lead reviews, needs them. Shown on DRAFT and PREPARED; **not drawn** on APPROVED, QUOTED and Ignored. Section 4.7 |
| 5 | Does Sun 29 Nov hold? | **For Stage 1, yes from the design side**: it reuses built components and a drawn layout, and needs no new mock-up. It is the developer's day, plus a green three-width E2E. **Stages 2 and 2T do not fit Sun 29 Nov** with any safety: the architect sizes the edit at 28.5 h and puts the end of Wed 2 Dec as the last merge, and only with lane 2 dedicated (v1.1, 6.1). Each merges only after a Lead's edit, Recalculate and approval have been run end to end |

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
3. **The mock-up's "Material Rate / Kg (I), Auto, Lead and Admin only" row is later (after G8).** The form definition has no I for any role (`form/route.ts`, FR-051); it needs a Lead-only read of the rate the calculation used. SCR-07 stage 2 already shows it. Until then section 02's range tag is whatever the registry gives, with no I.
4. **The "Review note" on SCR-05 and the section 0.9 CR-01 notes** are not repeated.

## 2. Staging

| Stage | What | Needs | Merge |
|---|---|---|---|
| **1. Read-only view** | Section 3 in full, for every status and both roles. No edit control anywhere. Notices of 3.5 | Nothing from the architect. Existing `GET /form`, `GET /nodes/{id}`, `GET /tree`, which already serve Lead and Admin | **Sun 29 Nov** |
| **2. Edit inputs** | Section 4 (4.1 to 4.6): editable for a Lead or Admin while the estimate is DRAFT or PREPARED (`canEditInputs`); autosave; the shared save gate with Recalculate; one refresh when the figures go from current to cleared; the conflict notice; the Part Model picture (Replace and Remove, audited) | The architect's note v1.1 (in): statuses, audit event `estimate.inputs_changed`, `SaveGate`, refresh rule | The end of Wed 2 Dec at the latest; open by the end of Mon 30 Nov (PRD ED-AC-11) |
| **2T. Edit the tree** | Section 4.7: the Engineer's tree actions on the review tree of DRAFT and PREPARED estimates; the audited tree writes of the architect's 3.9 | Stage 2's island (selection shared by tree and inputs, `SaveGate`, refresh). Server half: tree writes audited, the 403 of v1.0 removed | Lane 2's PR 3, the end of Wed 2 Dec at the latest |
| **Later** | Material Rate / Kg (I) row; the "This row" box of the mock-up | Separate decision | After G8 |

If Stage 2 or 2T is not ready for Mon 30 Nov, the demo shows Stage 1, and the notices of 3.5 say nothing about editing. Do not ship a Stage 2 or 2T control hidden behind a flag in the demo build. Stage 2T is not shipped without Stage 2: a Lead who can add a row must be able to fill it.

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
| APPROVED | `Read-only while approved. Unlock the estimate to change an input or the parts tree.` (before Stage 2T: `...to change an input.`) |
| QUOTED | `Read-only while quoted. Unlock the estimate to change an input or the parts tree.` |
| Ignored | `Read-only while this RFQ is ignored. Restore it to change an input or the parts tree.` |

### 4.3 After an edit

1. A change is saved by the Engineer form's own rules: on leaving a field, and every 30 s while there is something unsaved. A value equal after normalisation (`1.50` and `1.5`) writes nothing and clears nothing (server rule, built).
2. A save that **changed** something while the figures were current clears every calculated figure on every row (FR-100, D-20). The island then asks the page to read again (`router.refresh()`) **once, when the figure state goes from current to cleared** (the first real save after a calculation; architect 6a A-7: later saves change no figure on the page and do not refresh). The tiles, the tree figures, the row line and the notices then show the **Total cleared** state of SCR-06 as drawn: tiles `Cleared`, tree `Cleared`, **Recalculate** primary, **Approve and lock** and **Download** disabled with their reasons. **Nothing moves focus**; the form is not reset, the cursor stays in the field. After a Recalculate the page refreshes as built.
3. One polite status, **once per change from current to cleared**, from the island: `Saved. Every calculated figure is cleared. Press Recalculate to see them again.` Other saves use the form's usual line (`Draft saved at 10:42 IST.` as built). The page's own cleared notice is not relied on to announce.
4. **Recalculate** is the existing button (STORY-06.04), unchanged in words and place. **It must not run while a field holds a value that is not saved or a save is in flight**: it saves first, then calculates, the way Calculate waits on the Engineer's `SaveGate`. This needs one save gate shared by the island and the action bar (a small client context at the review's root). If a recalculation is refused for blank inputs (422 `CALCULATE_BLOCKED`, the same answer as Calculate: each part with its missing fields, architect 6a A-5), the page shows the SCR-05 Calculate-blocked summary in the words `Nothing was calculated. 2 parts have missing inputs.` (one part: `1 part has missing inputs.`; words proposed here, because 06.04's are not in the spec: if 06.04 already shows words, keep them), each part and its fields as links that open the row (`?row=<Sl. No>`) and focus the field; the field shows `Enter this value.` under it until it has a value, and the row shows the triangle and `TREE_MISSING_INPUTS` words as on SCR-05.
5. The quantity warning of FR-104 is the existing dialog on Recalculate, unchanged.
6. **Description** typed on a row renames it (the Description is the name, 26 Nov ruling); the tree row follows after the refresh.

### 4.4 Conflicts, leaving, the Engineer working at the same time

- In DRAFT the Engineer can edit the same part. A save made against an older revision gets the built conflict notice (`CONFLICT_TITLE`: keep mine or use the newer; nothing is sent until the person chooses). Nothing is overwritten silently.
- Leaving the page or choosing another row while a value is not saved: the field commits on leaving (as SCR-05), and a value that cannot be saved (invalid) asks first with the built "Leave without saving?" dialog.
- Choosing another row never loses a typed value: the commit happens before the link is followed.

### 4.5 Who changed it, the audit trail, approval, step-up (the architect's answers, note v1.1)

| Question | Answer |
|---|---|
| **Who last changed a value?** | **Dropped.** The part read carries no writer (architect 6a A-2). The form shows no "Last changed by" line, and ED-15 falls away. The audit entry is the record, and it is the Admin's alone |
| **Audit** | **Yes.** Every change a Lead or Admin makes (an input, the picture, and a tree add, move or delete) writes one SCR-16 entry in the category **Input change**, Object = the task code, written in the change's own transaction (architect 3.4, 3.9). The Engineer's changes are not logged. Nothing on SCR-06 shows the entry. Words for the three tree entries are in 4.7 (e) |
| **Approval** | Editing needs no approval. An edit or a tree change clears the figures, so Approve is blocked until Recalculate (`TOTALS_OUT_OF_DATE`, server-side). A change never touches an approved price. After Unlock the first change shows the existing "Unlocked and changed" state |
| **Step-up** | **None** for an input or tree change (architect 3.7, 3.9). The delete dialog's row count is the safeguard. Step-up and the password stay on Approve, Unlock, Cancel approval and Remove price, unchanged |
| **Autosave for a Lead** | Same 30 s autosave and save-on-leave as the Engineer's form |
| **Status** | A change never changes the status. A Lead's Recalculate on a DRAFT sets PREPARED (FR-064, A-08), as built |

### 4.6 Picture

In Stage 2 the Part Model picture is editable for a Lead and an Admin (the architect audits it, 3.2 (2)): the Engineer's Replace, Remove, "choose a file" and paste hint, the same words, the same 200 KB rule and messages, only while the block is editable. In Stage 1 and on locked statuses it has no controls (3.4). The Lead's own change shows no extra words.

### 4.7 The parts tree for a Lead or Admin (Stage 2T; FR-116, PRD ED-AC-12 to 15; architect 3.9)

**Decision: SCR-06 keeps its own review tree and gains the Engineer's tree actions. The Engineer's tree is not swapped in while editing.** Reasons: (1) a Lead reviews a PREPARED estimate, and the review tree's second line (count, the row's own BG, dollars and euros, "Quantity 0", the Cost details link) is what the review is for; the Engineer's tree has none of it and must not (NFR-002); (2) `PartsTreeList` already has the toolbar slot (`renderToolbar`) for this, and its own comment names "the review tree" as the case with no toolbar so far; (3) after the first change every figure reads `Cleared` anyway, so the second line costs nothing in the editing state and is complete in the reviewing state. The architect left the choice to me (3.9 "Screen").

**(a) Where each control appears** (reuse `RowActions`, `AddNodeMenu`, `MoveHandle`, `MoveMenu`, the delete dialog, `press-hold`, `tree-reorder`, `usePartsTree` and the announcements; write no second copy)

| Control | Place on SCR-06 |
|---|---|
| Row link (kind tile, Sl. No, name) | First line of the row, as Stage 1 (section 3.1); opens the row's inputs |
| Count, figure, dollars and euros, "Quantity 0" tag, Cost details link | Second line, as built |
| **Toolbar: move handle, "+", "-"** | **Third line, on its own line under the row**, in the column of the link, exactly as SCR-05 (DEF-075: never over a row). Names, tooltips, spoken names, the "+" menu per kind (Main Assembly: Sub-Assembly, Part or Sub-part, Fastener; Sub-Assembly: Part or Sub-part, Fastener; Part or Sub-part: a Fastener at once; Fastener: no "+"), the Sub-part wording and the menu header and hints are those of `parts-tree-scr05-conformance-2026-11-26.md` items 3 and 4, unchanged |
| **Add main assembly** | In the tree's foot, under a hairline, as SCR-05; then the kind legend. The figure legend stays at the top, as built |
| Tree width handle and "Tree width" button | **Not drawn.** The resizable panel is not required on the review screen (PRD ED-AC-15); the tree stays at `--tree-w` (320 px) from 1024 px, and the foldable panel below it |
| Completeness icons and the status legend of SCR-05 | Not drawn (the row has figures instead); the Inputs block's counts show what is blank. After a refused Recalculate, rows named in the refusal show the SCR-05 triangle (4.3 item 4) |

**When the toolbar is in view** is the 26 Nov rule (item 3), unchanged: a mouse, on the hovered row, on a row holding keyboard focus, and while a menu or the delete dialog of the row is open; **never** because a row is open or was just added; touch, on the selected row only; always in the tab order and the accessibility tree (clipped to 1 px, never `display: none`). The review tree is no taller than today until the person points at a row.

**(b) States of the tree controls**

| State | Behaviour |
|---|---|
| DRAFT or PREPARED, not ignored (Lead or Admin) | Drawn, from `treeActionsOffered(state, role)` (already role-aware), never from a test written in the component |
| APPROVED, QUOTED, Ignored | **Not drawn** (not disabled): no toolbar, no "Add main assembly". The server would refuse them (409 `ESTIMATE_APPROVED_IS_LOCKED`, `ESTIMATE_IGNORED`). The reason is in the Inputs notice (4.2), which now says "or the parts tree" |
| A change is on its way (`busy`) | The "+", "-" and move handle are `aria-disabled`, keep their focus and do nothing; the line `Updating the parts. This takes a moment.` (`TREE_CHANGING`) shows and is their `aria-describedby`, as SCR-05 (AQP-343) |
| A Recalculate is running | The same `aria-disabled` look, with the reason `Calculating. This takes a moment.` (assumption O-3: a tree write is serialised by the row lock anyway, so this is for the person's sake, not safety) |
| Tree loading | Skeleton rows, `role="status"`, `aria-label` = `TREE_LOADING`. The tiles and notices do not wait |
| Tree could not be read | `We could not load the parts` with **Try again** (`TREE_LOAD_FAILED_TITLE`), in the tree's place |
| No rows | `No parts yet. Choose "Add main assembly" to add the first one.` (`TREE_EMPTY` of the Engineer's tree) when editable; the Lead's own empty line when not. The Inputs block is not drawn |
| Engineer | Unchanged. Nothing is added to SCR-05 |

**(c) One island, shared selection.** The tree's actions need the Engineer's tree state, so on a DRAFT or PREPARED estimate the review tree, the row line and the Inputs block are **one client island** that holds the selected row, as `EstimateWorkspace` does for the Engineer. The server still draws everything above it (tiles, notices, "How the total is built", the action bar) and the island reads the page's `costs` nodes as props for the second line. Selection is mirrored into the address (`?row=<Sl. No>`) with `history.replaceState`, not a navigation, so a reload and a shared link still open the same row. On APPROVED, QUOTED and Ignored the Stage 1 server tree with its links stays. Both draw the row with **one** presentational component (no hooks, no `'use client'` of its own), so the two cannot drift. Figures reach the browser only on the Lead's branch (the cost-confidentiality scan and `estimate-review-architecture.test.ts` stay green). A new row has no figures yet: its second line reads a dash for the figure and the count until the next read.

**(d) What follows a tree change**

1. **The tree redraws from the server's answer** (as SCR-05): the new row is last under its parent, opens, is selected and takes focus on its link; a deleted row's neighbours renumber; a move shows the row in its new place and its handle takes focus. The announcements are the built ones (`Added 1.5 Part. Type a Description to name it.`, `Part renumbered to 1.2`, `Row deleted. 1.1 is now a Part.`).
2. **The figures clear.** Every add, move and delete raises the estimate's revision, so, **once**, when the figures were current, the island refreshes the page (the one read of 4.3 item 2). Tiles `Cleared`, every tree row `Cleared` (counts stay), **Recalculate** primary, **Approve and lock** and **Download** disabled with their reasons. One polite status, once per change from current to cleared: `The parts changed. Every calculated figure is cleared. Press Recalculate to see them again.` The status stays DRAFT or PREPARED.
3. **A new row has blank required inputs**, so Recalculate answers 422 `CALCULATE_BLOCKED` naming it: the refused-Recalculate summary of 4.3 item 4 opens it. The Lead fills it in the Inputs block first (Description names it, the 26 Nov rule).
4. **The tree changed under the Lead** (the Engineer or another Lead added, moved, deleted or typed since the Lead looked: 409 with the fresh tree). The tree is redrawn from the answer, nothing is applied, and a danger `Notice` above the tree reads the built `The parts were changed by someone else. The tree has been refreshed. Check it and try again.` (`TREE_CHANGED_NOTICE`); focus stays where it was. A **delete** that no longer matches (a row inside it changed) shows the delete dialog's existing conflict words, the tree reloads, and nothing is deleted. An **add** has no conflict: both adds succeed, last under the parent. If the open row was deleted by someone else, the Inputs block's next read answers 404, the tree is read again, the block falls back to the first row (the unknown `row` rule of 3.1) and one polite status says `1.4 was removed by someone else. Showing 1.1.`
5. **The answer is lost** (`unconfirmed`) or the change failed: the built notices (`The change was not made`), unchanged.
6. **Delete dialog** (reuse): title `Delete 1.1 Base frame?`, the count, up to ten rows named (then `and N more rows`), the buttons `Keep it` (the safe one, holds focus) and `Delete`; it asks no password (architect 3.9). Focus returns to the open row's link when it closes.
7. **The Inputs block** is not reset by a tree change. If the open row was moved, its title takes the new Sl. No after the redraw.

**(e) The audit trail and what the Admin reads** (the architect's events, 3.9; words ruled here for SCR-16, Category `Input change`, Object the task code): `Added Sub-Assembly 1.4 under 1 Frame` · `Moved 1.4 Top cover to 1.2` · `Deleted 1.4 Top cover and 3 rows under it` (`1 row under it` for one; a row with none: `Deleted 1.4 Top cover`). Kind names are the stored ones (`Main Assembly`, `Sub-Assembly`, `Part`, `Fastener`; Sub-part is not stored), written as the tree names them. The log shows no input value of a deleted row and no figure. A delete writes **one** entry, never one per row. Nothing is shown to the Lead on SCR-06.

**(f) Keyboard, screen reader, widths.** As SCR-05 and the 26 Nov ruling: Tab moves from a row's link to its arrow, its Cost details link and its toolbar buttons; no arrow-key tree navigation; the move handle's menu (Move up, Move down) is the way to reorder **without dragging** (WCAG 2.5.7), the drag is a pointer extra; every button's accessible name says which row it is for (`Add under 1.1 Sub-Assembly`, `Delete 1.1 Base frame`, `Move 1.1 Base frame`). Targets 44 px on touch, 24 px otherwise. At 360 px the tree is the `details` panel (`Parts tree · 1.4 Top cover`), its toolbar shows on the selected row, and choosing a row closes it. At 768 px the foldable panel above the block. At 1366 px the sticky 320 px column with its own scroll below the top bar; the "+" menu opens in line under its row so the column never clips it. Motion honours `prefers-reduced-motion` (no animated reorder).

## 5. What an Engineer sees

**Nothing changes.** The Engineer's `/estimates/<code>` is SCR-05 as built; the Engineer's bundle gains no code (the island loads on the Lead's branch only; the architecture test stays green). No new route, field or response. The form definition and the part read carry **no rate, cost or formula for any role** (`form/route.ts`: "Material Rate / Kg (I) and every calculated field are not on it"), so reusing them for a Lead puts no Lead-only value in the form and none can reach an Engineer through it (NFR-002, FR-051). **The only Lead-only output beside the inputs is the row line of 3.3** (BG, dollars, euros of the selected row) and the tiles and tree that were already on the page; all are server-drawn on the Lead's branch. An Engineer's Prepared estimate stays read-only as today (FR-064); a Lead's edit of a DRAFT or PREPARED part shows to the Engineer as a changed value on reload, never with a figure. **The tree (Stage 2T):** the Engineer's tree and its actions are not changed. A row a Lead added, moved or deleted in a DRAFT estimate appears for the Engineer on the next read of the tree, with no figure, and an Engineer who acts on a row that was deleted gets the built `The parts were changed by someone else...` notice. The tree's rows with figures exist only on the Lead's page.

## 6. The architect's answers (note v1.1, 6a and 3.9) and what is still open

| # | Point | Answer, and what it changed here |
|---|---|---|
| A-1 | Statuses that allow an edit | Draft and Prepared, not ignored. As 4.1 |
| A-2 | Who last wrote a value | **No such data.** The "Last changed by" line is dropped (4.5), ED-15 falls away |
| A-3 | Audit | Yes, `estimate.inputs_changed`, category **Input change** (inputs, picture) and the three tree events (4.7 (e)). The ux-spec's SCR-16 event list gains the kind (product-manager to confirm, ED-AC-6) |
| A-4 | Shared save gate | Yes, one client context at the review's root holding a `SaveGate`; Recalculate flushes it first (ED-7). The disabled-while-saving fallback only if the context cannot be built |
| A-5 | Recalculate refused for blank inputs | The same 422 as Calculate, with each part and field (4.3 item 4) |
| A-6 | Status event beyond `EDIT` | None; the status never changes by an edit |
| A-7 | Refresh | Once, when the figures go from current to cleared (4.3 item 2) |
| T-1 | Tree writes by a Lead or Admin | Allowed on Draft and Prepared, refused on Approved, Quoted and Ignored, audited, figures cleared, no step-up, concurrency as built (3.9). The v1.0 403 is withdrawn |
| **Still open** | | |
| O-1 | Whether the Engineer's tree state hook (`usePartsTree`) can serve the review's island with the review's rows (the second line comes from the page's `costs`, the rows from the tree read). If not, the island may use the page's nodes as its first state. The behaviour in 4.7 does not change | Developer and architect |
| O-2 | Whether 06.04's refused-Recalculate message already names parts and fields | If it does, keep its words and add only the links and the triangle |
| O-3 | `Calculating. This takes a moment.` as the reason the tree controls are unavailable during a Recalculate | UX assumption; drop if the Recalculate button already blocks the whole page |

## 7. Build notes (developer; suggestions, not architecture)

- New island folder, e.g. `src/components/features/estimate-review-inputs/` (`'use client'`), loaded by `next/dynamic` or `import()` from `review-page.tsx`. It wraps `PartForm` with `part={{ id, slNo, revision }}`, `editable={false}` in Stage 1, `nodes` built from the page's `CostNode`s (id, parent, Sl. No, kind, name) or read from `GET /tree`, and no-ops for `onSaved`, `onChanged`, `onNamed`, `onServerIgnored`, an empty `missing` set and a no-op gate.
- Add the review look as one prop on `PartForm` / `PartFields` / `FieldRenderer` / `SurfaceTreatments` / `PictureSlot`, so no second form exists. The picture and surface chips are the two places that need a different read-only drawing.
- `review-tree.tsx` gets the link on the first line, `aria-current`, and the `?row` read in `review-page.tsx` (a server component), which also draws the row line. `estimate-review.tsx` moves `<BuildTable>` above the columns.
- Texts go in `review-texts.ts` (Lead only). Run the cost-confidentiality scan and the architecture test; E2E at the three widths in CI (heavy browsers run in CI, CLAUDE.md §9 item 5).
- Stage 2: `editable = canEditInputs({ status, ignored }, viewerRole)` computed once in `review-page.tsx` and passed in; the island calls `router.refresh()` once, when the figures go from current to cleared. A shared `SaveGate` context at the review's root; the Recalculate button awaits it.
- Stage 2T: the tree actions come from `estimate-workspace/` by lazy import, only on DRAFT or PREPARED for this role (`treeActionsOffered(state, role)`). Pass `renderToolbar` to `PartsTreeList` with `RowActions` and `renderRow` with the review row (one shared presentational component for the island and the Stage 1 server tree). Reuse `usePartsTree` and `DeletePartDialog`, the announcements and `TREE_*` texts; add `Add main assembly` at the foot. Do not mount the resize handle or the width menu. Selection and the Inputs block share one state; mirror it to `?row` with `history.replaceState`. New texts (the two in 4.7 (d) 2 and 4, `Calculating. This takes a moment.`, the blocked summary) go in `review-texts.ts`.

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
| ED-14 | A Lead's or Admin's input change writes one SCR-16 entry (category `Input change`, Object the task code, the part and per-field before to after, a blank as `Not entered`) with no rate or figure; the Engineer's drafts write none; a save that changes nothing writes none |
| ED-15 | (Withdrawn: the "Last changed by" line is dropped, architect 6a A-2.) No part of the form shows who last changed a value |
| ED-16 | The Part Model picture of a DRAFT or PREPARED estimate has Replace, Remove and "choose a file" for a Lead and an Admin (the Engineer's words and 200 KB rule); each change writes an `Input change` entry that holds no bytes and no file name; on APPROVED, QUOTED and Ignored it has none |
| ED-17 | axe at three widths with an editable block and a field error showing: no serious or critical finding; the error follows the built rules (icon, text, `aria-invalid`, `aria-describedby`) |

### Stage 2T (the parts tree), ED-n

| ID | Check |
|---|---|
| ED-18 | DRAFT and PREPARED (not ignored), Lead and Admin: each row can show the move handle, "+" (Fastener row: no "+") and "-" on its own line under the row; "Add main assembly" is in the tree's foot. A unit test over every status, role and ignored flag against `treeActionsOffered` |
| ED-19 | APPROVED, QUOTED and Ignored: no toolbar and no "Add main assembly" in the DOM; the Inputs notice says `...change an input or the parts tree.`; a direct tree request is refused by the server (409) and writes nothing and no audit entry |
| ED-20 | The "+" menu offers exactly the kinds under that row (Main Assembly: Sub-Assembly, Part or Sub-part, Fastener; Sub-Assembly: Part or Sub-part, Fastener; Part: Fastener at once), with the `Sub-part` wording and hints of the 26 Nov ruling; adding past the allowed levels is refused by the server as for an Engineer |
| ED-21 | Add a row: it is last under its parent, selected, its link has focus, the status `Added 1.5 Part. Type a Description to name it.` is announced, its Inputs block shows empty fields, and its second line shows dashes |
| ED-22 | Move a row among rows with the same parent by drag and, separately, by the handle's Move up and Move down with the keyboard only; a move to another parent is refused as for an Engineer (`MOVE_ACROSS_PARENTS`); the row's handle keeps focus; `Part renumbered to 1.2` is announced |
| ED-23 | Delete a row that has rows below it: the dialog names the row and the count (and up to ten rows, then `and N more rows`), `Keep it` holds focus, no password is asked; Delete removes the row and every row under it in one step; focus returns to the open row |
| ED-24 | After any add, move or delete on a calculated estimate: tiles and tree figures read `Cleared`, Recalculate is primary, Approve and lock and Download are disabled with their reasons, exactly one page read follows, and the status `The parts changed. Every calculated figure is cleared. Press Recalculate to see them again.` is announced once |
| ED-25 | After adding a row and not filling it, Recalculate is refused with `Nothing was calculated. 1 part has missing inputs.`, the part is a link that opens its row and focuses the missing field, which shows `Enter this value.`; fill it and Recalculate works |
| ED-26 | Two sessions: the Engineer adds or types inside a subtree after the Lead opened the delete dialog; the Lead's Delete answers 409, nothing is deleted, the dialog shows its conflict words and the tree is reloaded; the same for a Move on a changed row, with `The parts were changed by someone else. The tree has been refreshed. Check it and try again.` above the tree |
| ED-27 | The Engineer deletes the row the Lead has open; the Lead's next read answers 404; the block falls back to the first row and says `1.4 was removed by someone else. Showing 1.1.`; nothing the Lead typed in another row is lost |
| ED-28 | The Engineer, in a DRAFT estimate, sees the Lead's added and moved rows on the next tree read, with no figure; an Engineer's own add, move and delete are unchanged (the existing E2E stays green) |
| ED-29 | Each Lead or Admin tree change writes exactly one SCR-16 entry in the words of 4.7 (e) (`Added Sub-Assembly 1.4 under 1 Frame`, `Moved 1.4 Top cover to 1.2`, `Deleted 1.4 Top cover and 3 rows under it`); a delete of a subtree writes one entry, not one per row; a move that changes nothing writes none; an Engineer's tree change writes none; no entry holds a figure or an input value |
| ED-30 | A tree change by a Lead on a PREPARED estimate leaves it PREPARED; after Recalculate, Approve and lock is enabled; a tree change on an approved-and-unlocked (DRAFT) estimate shows the "Unlocked and changed" state |
| ED-31 | While a change is on its way the "+", "-" and handle are `aria-disabled`, keep focus and do nothing, and `Updating the parts. This takes a moment.` is their description; while Recalculate runs the same, with its reason |
| ED-32 | Visibility of the toolbar follows the 26 Nov rule on SCR-06: none in view with the pointer outside the tree (including the open row and a just-added row); the hovered row's, the keyboard-focused row's, and a row with an open menu; touch shows the selected row's only; the toolbar is in the tab order when not in view. Moving the pointer slowly down five rows shows one toolbar at a time |
| ED-33 | No resize handle and no "Tree width" button on SCR-06 at any width; the tree is 320 px from 1024 px and the foldable panel below (PRD ED-AC-15) |
| ED-34 | At 360, 768 and 1366 px: no horizontal scroll; the "+" menu opens in line under its row and is not clipped by the sticky column; targets 44 px on touch; the tree closes after a row is chosen under 1024 px and its summary names the row |
| ED-35 | Keyboard only: reach every control, add a Part under a Sub-Assembly, move it up, delete it, with no drag and no mouse; names read `Add under 1.1 Sub-Assembly`, `Move 1.1 Base frame`, `Delete 1.1 Base frame` |
| ED-36 | The cost-confidentiality scan and `estimate-review-architecture.test.ts` are green; the Engineer's page bundle holds no review code; the tree island is loaded only on a Lead's or Admin's DRAFT or PREPARED page |
| ED-37 | axe at three widths with the toolbar in view, the "+" menu open, the delete dialog open and a conflict notice showing: no serious or critical finding |

## For the next spec touch (not edited here)

- **ux-spec**: UD-1 restored in full (remove "post-G8" from the DL-306 marking); SCR-06 gets a "Row detail and Inputs" paragraph pointing here; SCR-06 states table gets "Inputs read-only (Stage 1)" and the words of 3.5 and 4.2; SCR-16 gets `Input change` once A-3 is answered; UJ-06 step 2 and UJ-07 stand as written.
- **SCR-06.html**: the default (Prepared) state is the editable Stage 2 look; add a state `readonly` with the 3.5 notice, `Not entered` samples and a chosen-chips surface treatment; move "How the total is built" above the columns (the mock-up already draws it there); drop the Material Rate row until Stage 3. SCR-07 gets the `View inputs` link.
- **SCR-06.html (tree)**: the review tree draws a toolbar line on the hovered row (the SCR-05 mock-up's), `Add main assembly` in its foot, and a state `treeedit` with the conflict notice and the `The parts changed...` status; the Approved state draws no toolbar. **ux-spec**: SCR-06 gets the 4.7 paragraph and the "or the parts tree" notices; SCR-16 gets the Input change entries of 4.7 (e); UD-1 and the FR-064 coverage row change with it.
- **Records** (master and product-manager): DL-306 and G8-C-FR064, the PRD FR-064 "waived" sentence, KG-1 and the release notes' workaround line.
