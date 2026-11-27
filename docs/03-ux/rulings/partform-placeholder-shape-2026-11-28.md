# UX ruling: the shape of the part form's loading placeholder, so the page does not shift when the form arrives (DEF-145; master DL-465 (3))

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-27 (file dated 28 Nov as asked; due end of Sat 28 Nov) |
| Asked by | The coordinator, through the main session, for master's DL-465 (3). The developer (lane 2) builds it test-first in its own PR from `master`, due by the end of Wed 2 Dec; the ux-expert then checks the built page against this shape (DL-465 review line), not a combined review |
| Constraint (DL-465 (3), measured) | After first paint, the top of `#review-actions` moves **no more than 8 px** when the form replaces its placeholder, on Draft and Prepared, at 360, 768 and 1366 px. The Engineer's workspace (SCR-05) is "improved, not regressed". Rendering the real form without waiting for its chunk is allowed only if Stage 11b stays under 193,500 B (about 685 B of headroom); it is not the default |
| Fault | `PartForm` draws three `h-(--control-h)` bars (about 120 px) until the lazy fields chunk arrives, then the 8 section cards (several hundred to about 1,000 px). Since #827 the data is already on the page, so the swap lands inside the moment a person acts, and `#review-actions` (Recalculate, Approve and lock, the rest) drops by up to about 900 px |
| Read from | `ux-spec.md` States table, row "Loading" ("a skeleton holds the height of the content that replaces it", DL-294) and SCR-05 / SCR-06; `screens/SCR-05.html` line 187 (the mock-up's loading state: three generic cards); DL-465; DEF-145; `rulings/tree-toolbar-no-shift-2026-11-27.md` (form of this ruling); on `origin/master` (7aa23c44) `estimate-workspace/part-form.tsx`, `part-fields.tsx`, `section-card.tsx`, `field-renderer.tsx`, `part-head.tsx`, `section-strip.tsx`, `picture-slot.tsx` (`PictureSkeleton`, AQP-395), `use-form-definition.ts`, `use-parts-tree.ts`, `estimate-workspace.tsx`, `estimate-review/estimate-review.tsx`, `review-actions.tsx`, `shared/form-field.tsx`, `ui/{input,native-select,textarea,label,card,progress,skeleton}.tsx`, `lib/estimates/form-values.ts`, `lib/estimate/form-fields.ts`, `app/globals.css` |
| Not done | **No browser** (the Playwright server did not connect). Nothing here was seen running. Every pixel figure below is **read from the code's classes and tokens**, not measured; the developer's test (PF-14) is what proves them. No code edited; no mock-up or spec file changed (section 6) |

## Answer

**One placeholder, drawn as the form itself without its values (a "ghost"), from the form's own definition, by the server.** It has the same blocks, the same layout classes and the same words as the real form (section numbers and names, column ranges, field labels and hints, the read-only notice). Only the things a person's data or a control will fill are grey blocks. Because the browser lays it out with the form's own CSS, the number of cards, their widths, the wrapping of names and hints, and the height of every row come out the same at any width. **No height is computed or typed as a pixel constant.** The 8 px is then what is left over (value-dependent lines), not a number the ghost is fitted to.

Why not arithmetic ("N cards, about M px each") or a reserved minimum height: the form is not a fixed height. It depends on the width (cards per row follow each card's weight, `--n`), on hint and notice wrapping (a 100-character hint is one line at 1366 px and four in a 140 px column), on conditional fields (Fasteners Qty and Cost), on how many surface treatments are chosen, and on a definition the Admin may edit (STORY-08.08). A constant tuned to pass at three widths would pass the test and fail the person at 1024 px. The ghost cannot drift apart from the form because both are built from the same class strings (PF-4).

**Who draws it (PF-6).** The Lead's page and the Engineer's page already hand the client form server-drawn elements that add no first-load JavaScript (`cards`, `notice`; NFR-009 holds `/estimates/[code]` to 200 KB with about 1 KB left). The ghost is the same kind of element: drawn on the server, **zero client JS**, so Stage 11b is not touched by it and the 685 B of headroom is not spent.

## 1. Structure (what the ghost contains, top to bottom)

The ghost's root has the form's own flow: `is-compact flex min-w-0 flex-1 flex-col gap-s-4`. Its children are, in this order and with this spacing (16 px, `gap-s-4`):

| # | Block | Ghost draws | Same as the real form's | Resolves to (from the code) |
|---|---|---|---|---|
| 1 | **Head lines** | A completion row: a 160 px (`w-[10rem]`) bar of height `h-s-2` beside a text block `h-s-4`; then the status line, one block `h-s-4 w-1/3`; the two 4 px apart (`gap-s-1`). **Engineer only, above them:** the eyebrow line `h-s-4` (when the row is known) and the title line `h-s-6` (26 px line; draw it 26 px, not 32) | `PartProgress` row (16 px: the label line decides) + the status `<p role=status>` (16 px) inside `flex flex-col gap-s-1`; the Engineer's `PartHead` eyebrow (16) and `h3 text-sub` (26) | Lead 36 px. Engineer 36 plus 4 + 26 (title), plus 4 + 16 (eyebrow) when the row is known |
| 2 | **Read-only notice** | **The real `Notice`, tone info, with the real words**: the Lead's `inputsNotice(status, ignored)`; the Engineer's `FORM_LOCKED` when `editable` is false. Nothing when the form is editable | `editable ? null : <Notice tone="info">` | Exact, at any width (real text) |
| 3 | **Section strip** | The same `nav > ul > li` as `SectionStrip`, **not sticky**, the same classes except `sticky top-... z-... shadow-card`, `<span>` in place of the `<a>`, the real text of each item (`sectionLinkText(number, shortName)`), no icon | `SectionStrip`: `py-s-1` ul, `min-h-(--control-h)` items, 1 px border | 54 px (44 + 2 x 4 + 2 x 1), and the same horizontal overflow, so the same scrollbar where one shows (a classic scrollbar adds about 15 to 17 px at 360 and 768 px; drawing the real item texts reproduces it) |
| 4 | **Cards** | One ghost card per section of the definition, in order, inside a `flex flex-wrap gap-s-3` row | `data-part-grid` and `SectionCard` | see below |

**A ghost card** (all classes from the shared constants of PF-4: `CARD_SHARE`, `FIELDS`, the card and header classes):

- **Share of the row:** `style={{ '--n': sectionWeight(section) }}` with the same `CARD_SHARE`, so the cards break into rows exactly as the real ones do (one to a row below 768 px).
- **Header** (`px-s-3 py-s-2`, `border-b`): a number tile as a skeleton `size-s-6` (32 px), the **real section name** as text, the **real column range** in its chip (`rounded-sm bg-surface-2 px-s-1 font-mono text-label`), and a count skeleton `h-s-4 w-10` where "n of m" goes. 32 + 2 x 8 + 1 = 49 px when the name does not wrap; when it wraps, it wraps as the real one does, because it is the same text. The "n of m" count is **never** drawn as numbers.
- **Body** (`FIELDS`: `grid grid-cols-[repeat(auto-fill,minmax(var(--compact-column-min),1fr))] gap-s-3 p-s-3`): one **ghost field** per field that will be shown (PF-5), in order.

**A ghost field** is the real `FormField`'s three parts, 8 px apart (`gap-s-2`), each as the real one is:

| Part | Ghost draws | Height |
|---|---|---|
| Label line | `h-s-5` skeleton block, or the real label text in the real `Label` classes, whichever the developer finds simpler to keep within PF-3. The real line is 24 px because it holds the 24 px column tag | 24 px |
| Control | A `Skeleton` with the control's own height: **`h-(--control-h) compact-fine:h-(--compact-field-h)`** (44 px; 36 px from 1024 px with a fine pointer) for a number, a text, a choice, the material list and a read-only derived box; **`min-h-(--compact-textarea-min-h)`** for a multi-line text, read from the built box (the textarea's two default rows may make it 62 px, not 60: use what the built control measures, as `PictureSkeleton` did); the picture: **`PictureSkeleton`'s block as it is** (146 / 130 / 114 px at below 768 / 768 / 1024 px, held within 2 px by `estimate-picture.spec.ts`) | 44 / 36 px; 60 to 62 px; 146 / 130 / 114 px |
| Hint | If the field has a hint: **the real hint text** in the real classes (`text-label text-ink-3`), so it wraps as it will. A skeleton bar would not | 16 px a line |

**Surface treatments (card 07).** The real card has one multi-select, not eight boxes. The ghost draws **one** field: a label line and, in the Lead's review, the chosen ones as skeleton chips (`26 px` high: 2 x 4 padding, 16 px text, 2 px border; one chip per flag the part has on, at the width of its real name), or one `h-s-5` line where none is chosen ("None selected", 22 px line); in the Engineer's form, a label line and one control-height block. A card with one such field and one other is two blocks, never ten.

**Widths** (the same classes, so one rule, three readings):

| Width | What the person sees | Controls |
|---|---|---|
| 360 px | One card to a row (`max-md:flex-[1_1_100%]`), strip scrolls sideways inside its own 54 px bar, the parts tree is a drawer so the form has the full 328 px | 44 px |
| 768 px | Cards share rows by weight (each card wants `--n` x 150 px of the row); the tree is a collapsible panel (below 1024 px), the Lead's tree stacks above the form | 44 px (`compact-fine` needs 1024 px) |
| 1366 px | The tree is the 320 px column beside the form (Lead: `TREE_COLUMN_LAYOUT`; Engineer: `lg:flex-row`); the form column takes the rest and breaks into rows by weight | 36 px with a fine pointer, 44 px with a finger |

**Per state** (the ghost's content changes only in blocks 1 to 2; the cards are the same):

| Page and state | Block 1 | Block 2 (notice) | Notes |
|---|---|---|---|
| Lead / Admin, **Draft** | Lead head (36 px; the title is drawn on the server above the form and is not part of the ghost) | `INPUTS_NOTICE_DRAFT` | The measured case of DL-465 |
| Lead / Admin, **Prepared** | same | `INPUTS_NOTICE_PREPARED` | The measured case of DL-465 |
| Lead / Admin, Approved, Quoted | same | `INPUTS_NOTICE_APPROVED`, `INPUTS_NOTICE_QUOTED` | Locked: the real notice, so the height is the real one |
| Lead / Admin, Ignored | same | `INPUTS_NOTICE_IGNORED` | `#review-actions` is not drawn, so nothing below moves; the ghost is still the same shape |
| Engineer, Draft, editable | Engineer head | none | The Engineer's form has no notice |
| Engineer, Prepared, Approved, Quoted, Ignored | Engineer head | `FORM_LOCKED` | Read-only |
| Engineer, **tree not yet read** (`nodes === null`, no read failed) | Engineer head without the eyebrow | as the status says | Today `PartForm` says "Choose a part in the tree..." here, which is untrue while the tree loads. PF-7 |
| Engineer, tree read, **no rows** | no ghost | none | "Choose a part in the tree to fill in its form, or add the first one with 'Add main assembly'" stays (`FORM_NO_PART`) |
| Any page, **the form or its code failed to load** | no ghost | none | The existing danger notice with "Try again" replaces the ghost in place. A failure is not a layout-stability case (PF-11) |

## 2. The rules

**PF-1. One ghost for every loading state of the part form.** The shell's wait for the fields chunk, the Lead's wait, the Engineer's wait for the tree and the form's definition, and `PartFields`' own wait for the part's values (today `PartProgressSkeleton` and three bars, `part-fields.tsx:168-176`) all draw **the same ghost**. A ghost that is replaced by a ghost of a different height is a shift of its own. The three-bar placeholder (`part-form.tsx:95-101`) and the `PartProgressSkeleton` plus three bars are **removed**; no page may reach production with either.

**PF-2. The ghost has the form's structure, in the form's order and with the form's spacing (section 1).** Same number of blocks, same gaps (`gap-s-4` between blocks, `gap-s-3` between cards and between fields, `p-s-3` inside a card, `gap-s-2` inside a field).

**PF-3. Real words where the words are known; grey blocks where a person's data goes.** Real: the notice, the section strip's items, each card's name and column range, each field's hint, and (optional) each field's label. Grey (`Skeleton`): the number tile, the "n of m" count, the progress bar and its words, the status line, and every control. **The ghost never shows a value**: no part value, no count, no figure (NFR-002; the Engineer's ghost carries nothing the Engineer may not see, and nothing from the Lead's cost data enters either ghost).

**PF-4. One source for the numbers.** The class strings that decide a form's size (the card's share of the row `CARD_SHARE`, the card body grid `FIELDS`, the card header classes, the label line, the control height pair, the hint classes, the strip classes) move to **one small module of constants** that `SectionCard`, `FormField`, `SectionStrip` and the ghost all import. The ghost may not copy a class string. If someone changes the form's spacing, the ghost follows, and the test (PF-14) stays green. The module holds strings only and is imported by the lazy chunk and by the server, **never by the shell**.

**PF-5. Which fields a ghost card draws.** The ghost uses the form's own rules, from the pure functions already in `lib/estimates/form-values.ts`, so it draws the cards and fields the form will draw:
1. **Sections and fields come from the definition** (`FormView.sections`), in order, with `sectionWeight(section)` for the card's `--n`. Never a fixed "eight" and never a typed list.
2. **A field hidden by the definition's `visibleWhen`** is hidden in the ghost by `fieldVisibility(fields, texts)`, with `texts` = **the part's saved values** where the page holds them (the Lead's page: the seeded part, read on the server) and **the defaults** where it does not (the Engineer's ghost before a part is chosen, and while its values are read). A card the real form draws with two more fields because Fasteners is chosen is therefore right on the Lead's page and one field row short on a part of the Engineer's with Fasteners already set (PF-15 bounds it).
3. Where the definition has a `flag` rule, the flags of a section are **one field** (section 1, "Surface treatments"), as `sectionWeight` counts them.
4. A section with no fields is not drawn (the definition leaves it out).

**PF-6. The server draws it; the shell and the chunk add no JavaScript for it.**
- **Lead / Admin (SCR-06).** `EstimateReview`, a server component, draws the ghost from the definition and the part it already builds for the seed (`part-form-bodies.ts`) and hands it to `PartForm` as an element (`ghost`). It is drawn whether or not the seed attached, because it needs only the definition and the part's values, which the server has.
- **Engineer (SCR-05).** The Engineer's page hands `EstimateWorkspace` the ghost as an element, as it hands `cards` and `notice`, built from the same definition code. It has no part's values (the tree is read after hydration, so the selected part is not known on the server), so PF-5.2 uses defaults.
- **`PartFields`** (lazy chunk) draws the **same** ghost component from the `form` it holds while it reads the part's values, so the second wait has the same shape.
- **The ghost component has no hooks, no `'use client'`, imports no client component** (not Radix `Label`, not `Progress`, not `Popover`): plain elements with the shared classes, `Skeleton` (server-safe), `Notice` (server-safe; the Lead's page already draws it), `ColumnTag` if the label text is used. So the same function runs on the server for the page and in the lazy chunk, and the shell imports it **nowhere**.
- **Bytes.** Stage 11b's first-load JavaScript must show **0 B** from the ghost. The ghost's markup is in the document and in the page's server data; NFR-009 counts JavaScript. **If Stage 11b also counts document bytes** (a question for the solution-architect, not settled here), the developer reports the delta and the ghost stays within the ceiling; if it cannot, the first answer is to draw fewer real words (PF-3: labels as grey lines, hints kept), never to drop the card structure.

**PF-7. The Engineer's tree-reading window is in the ghost too.** While `nodes === null` and the tree's read has not failed, there is no selected part and `PartForm` today answers `FORM_NO_PART`, "Choose a part in the tree...", which is untrue and is a third swap (message, then bars, then form). The form area shows **the ghost** for that window and `FORM_NO_PART` only when the tree has been read and has **no rows**. If the tree's read **failed**, the tree's own notice carries it and the form area shows `FORM_NO_PART` as it does today. This needs `PartForm` to be told the tree is unread (it already gets `nodes`; `null` is "unread"; a read that failed needs one more prop or the workspace's `loadFailed`).

**PF-8. The swap.** The ghost is in the **first paint**. Nothing delays it: the Loading row's "shown after 300 ms" is for content that replaces something already on screen, and a 300 ms gap here would be a hole that then jumps. (It is a deliberate exception to that row; the spec's row gains one sentence at the next spec touch.) The form replaces the ghost in the same place with **no fade, no transition, no animation, no height animation**, and no `key` trick that mounts both at once (never the ghost and the form both in the flow, even for one frame). The form's own `scroll-mt`, anchors and tab order are unchanged. Nothing scrolls to compensate, and nothing sets `overflow-anchor`.

**PF-9. Accessibility (WCAG 2.2 AA).**
1. **The ghost is one busy region.** Its root is `<div role="status" aria-busy="true">`, holding **one** visually hidden line, `FORM_LOADING` ("Loading the form"), and the drawn blocks in a child `<div inert aria-hidden="true">`. The ghost is therefore not focusable, not read, and not a target of a click (`inert`), and the one line is the only thing a screen reader can meet.
2. **No announcement churn.** The words "Loading the form" are in the root **from the first render and never change**; there is no live text that counts, no "n of m", no progress. They are said once per load: a second ghost for the same part (PF-1: the shell's, then `PartFields`') is **silent** (`aria-busy`, no `role="status"`, no text), so a person does not hear it twice. **No "form loaded" message is added**: the form's own status lines are what they are today (the saving line, the announcer), and they mount with the form as they do now.
3. **`aria-busy` leaves with the ghost.** The form does not carry `aria-busy`. The ghost is removed, not toggled.
4. **The ghost has no `id`, `name`, `for`, `href`, `tabindex`, landmark role or heading element**, and none of the form's data attributes (`data-slot`, `data-part-form`, `data-part-grid`, `data-section-strip`, `data-part-eyebrow`, `data-picture-zone`). The ghost draws the picture's block with its own marker and takes only `PictureSkeleton`'s three heights, not its element. It uses `<div>` and `<span>`, and its own markers (`data-part-ghost`, `data-ghost-wide`, `data-ghost-picture`, `data-ghost-grid`), which the shared `FIELDS` constant matches for the full-row rules. Reason: the real form's ids (`part-section-<id>`, the field controls, `part-form-title`) are the targets of the section strip's links, of "jump to the first field" and of the tests; a duplicate id, or a locator such as `[data-slot=textarea]` that a test waits for, must not be satisfied by a ghost.
5. **Focus.** The ghost takes none and moves none. A fragment link followed before the swap (DL-465's keyboard case) lands where the target is, and the target does not move (PF-14). The focus the form takes after a row is chosen (RO-2) is unchanged.
6. **Contrast and targets.** The ghost's real words are `--ink-3` or darker (at least 4.5:1) and the skeleton blocks are decorative; there is no control to size (WCAG 2.5.8 does not apply, as nothing in it can be pressed).

**PF-10. Reduced motion.** The grey blocks use the existing `Skeleton` (`skeleton-shimmer`, `animate-shimmer`); the global rule for `prefers-reduced-motion: reduce` already sets `animation: none` and `transition: none`, so the blocks stand still as plain `--surface-2` fills. The ghost adds **no other animation and no transition** and nothing that the rule would not switch off. The shimmer is on the grey blocks only, never on the real words.

**PF-11. Failure and other states.** When the definition or the fields' code fails, the existing danger `Notice` with "Try again" replaces the ghost **in place**. That is an error, not a late shift: it is outside the 8 px bar, but it must still be one swap (no ghost, then bars, then notice). A permission-denied state does not exist here (the server refuses the page, SCR-26, before this form). Disabled, partial and empty: not applicable; the ghost is not a form.

**PF-12. A slow or refused read.** If the seed is not accepted by the readers (`parseForm` is `null`), the form reads from the server as ever; the server-drawn ghost stays until the read ends. A ghost that waits more than the form's own timeouts does not change shape or text.

**PF-13. What the developer must not do.**
1. **No pixel constant typed to pass the test** (a `min-h-[612px]`, a per-width table, a height read from one run). A reserved `min-height` is **not** the Lead's answer: it cannot hold 8 px across widths, hints and definitions. It is allowed on the Engineer's page only as the fallback in section 5.
2. **No hiding the symptom**: no `visibility: hidden`, `opacity: 0` or `content-visibility` on `#review-actions` or the form; no delaying the action block until the form is there (the Lead must be able to act on a Draft whose form is slow); no moving Recalculate, Approve or the rest; no making `#review-actions` sticky or absolute; no `scrollIntoView`, `scrollTo`, `overflow-anchor` rule or scroll compensation.
3. **No JavaScript sizing**: no `ResizeObserver`, no measure-then-set height, no "after hydration, set `min-height` from the first render".
4. **No second placeholder of another height** (PF-1), and **no 300 ms delay** before the ghost (PF-8).
5. **No client component, no hook, no `'use client'` in the ghost**, and no import of the ghost into the shell (PF-6). No new dependency.
6. **No value in the ghost** (PF-3), no cost, rate, formula or figure, and nothing from the Lead's costs view in the Engineer's page. The cost-confidentiality scan must stay green (NFR-002).
7. **No id, name, href, tabindex, heading, `data-slot` or form `data-*` marker in the ghost** (PF-9.4), and no `aria-live="assertive"`.
8. **No weakening of any test or budget**: no wait, time-out or budget change (DL-404); `rates-changed.spec.ts:263` is unchanged; the route that delays the chunk replaces a wait, it does not add one.
9. **No change to the form itself** beyond importing the shared constants (PF-4): same markup, same order, same ids, same words.

## 3. The checks (one assertion each; Chromium, fine pointer; 360, 768, 1366 px; Draft and Prepared on the Lead's page)

| ID | Check |
|---|---|
| PF-14 | **The bar (DL-465 (3) (i)).** Delay the fields chunk with a Playwright route (deterministic, no wait). With the ghost showing, record the top of `#review-actions`; release the chunk; wait for the form (`[data-part-form]` present and `[data-part-ghost]` absent); record the top again. **The difference is 8 px or less**, for Draft and Prepared, at all three widths. Then repeat with a fragment link to the Recalculate or Approve button followed with Enter before the release: the button is in the viewport after the swap. Red before the fix, green after |
| PF-14a | **Diagnostic, per card.** With the ghost showing, record each ghost card's top and height; after the swap, each real card's. The number of cards is **equal**; each card's **top is within 8 px** of its ghost's and its **width within 1 px**. A failure names the card |
| PF-14b | **Same rows at every width.** The number of cards in each row (cards sharing one top) is equal, ghost and form, at 360, 768 and 1366 px, and at 1024 px (where `compact-fine` and the strip change) |
| PF-14c | **No ghost left.** After the swap there is no `[data-part-ghost]`, no `aria-busy="true"` and no `[role=status]` reading "Loading the form" in the document; no id is duplicated at any moment |
| PF-14d | **Inert and silent.** With the ghost showing: no focusable element inside it (Tab from the page's last control before it reaches the first control after it), axe reports no serious or critical finding, and exactly one element reads "Loading the form" (a second ghost, where the Engineer has one, reads nothing) |
| PF-14e | **Reduced motion.** `prefers-reduced-motion: reduce`: every ghost block's computed `animation-name` is `none`; no element of the ghost has a transition longer than 0 |
| PF-14f | **Engineer's page (DL-465 (3) (ii)).** Same route-delay method on SCR-05 for a new part (no conditional field set): the height of `[data-form-area]` changes by **24 px or less** between the ghost and the form (PF-15), and the number of height changes between first paint and the form is **one** (the tree's own arrival is not counted), where today it is three or four. The same check for the Engineer's Prepared and Approved estimate (with the notice) |
| PF-14g | **NFR-002 and bytes.** The cost-confidentiality scan stays green on the Engineer's page; Stage 11b's first-load JavaScript differs by 0 B from `master` for the ghost (report the figure), and stays under 193,500 B. One Lighthouse CLS reading per state on a production build, before and after, **reported, not gated** (DL-465 (3) (iv)) |

**PF-15. The Engineer's bar (this ruling's own; DL-465 asks only "improved, not regressed").** The Engineer's ghost cannot know the part (the tree is read after hydration), so it draws a new part's shape (defaults). **24 px** is one wrapped status line (16 px) plus the 8 px of DL-465. It does not hold for a part with conditional fields already set (Fasteners chosen: one field row more in one card, up to about 90 px); that is one swap by about one field row, against today's about 900 px, and it is **improved, not regressed**. If the delivery lead wants it exact, the answer is to seed the Engineer's definition **and** part (a larger change to the Engineer's page, out of this fix); named, not recommended now.

## 4. What else was considered

| Option | Verdict |
|---|---|
| **A ghost of the form's real structure, drawn by the server** | **Chosen.** Meets the bar by construction, costs no first-load JavaScript, reuses the form's classes, keeps the Loading row's rule ("a skeleton holds the height of the content that replaces it") |
| A reserved `min-height` (master's second suggestion) | **Rejected for the Lead.** Cannot hold 8 px across widths, hints, conditional fields and an editable definition; a figure tuned to three test widths is test-fitting. Kept only as the Engineer's fallback (section 5) |
| Draw the real form on first paint without the chunk (read-only, server-rendered) | **Not the default**, as master set. It would give 0 px by construction and is the better product answer for a read-only page, but it costs first-load bytes against 685 B. Allowed only if Stage 11b stays under 193,500 B; if the developer shows that, it replaces the ghost on the Lead's page and PF-1 to PF-13 fall away there |
| A client-drawn ghost in the shell | Rejected: its code (cards, hints, the strip) is first-load JavaScript, with about 1 KB of room (NFR-009) |
| Three or four generic cards (the mock-up's loading state, `SCR-05.html` line 187) | Rejected as the build's shape: three cards of three 44 px bars is not the form's height at any width. The mock-up stays as a picture of "skeleton cards"; the build follows this ruling |
| A fade or cross-fade from ghost to form | Rejected: both would be in the flow for a moment, which is a shift; PF-8 |
| A 300 ms delay before the ghost | Rejected: a hole that then jumps; PF-8 |
| Hide `#review-actions` until the form is there | Rejected: removes the actions from a person who can act; PF-13.2 |

## 5. Fallback if the Engineer's page cannot hand the ghost in (a question for the solution-architect)

Feasibility question: can the Engineer's page server component build the ghost from the form definition with the code that builds the Lead's seed (`part-form-bodies.ts`) and pass it as an element, as it passes `cards`? I expect yes. **If it cannot be done in the window**, the Engineer's page gets, for the Engineer only: (a) PF-7 (the ghost, as the generic three-block shape, not `FORM_NO_PART`, while the tree is unread) and (b) a floor of `min-h-[calc(100dvh-var(--topbar-h))]` on the form area while a ghost shows. The Engineer's Calculate bar is `sticky bottom-0`, so with the area at least one viewport tall it is pinned at the bottom from first paint and does not move when the form arrives. This does **not** meet PF-14f's 24 px (the region's height still changes) and is **not** acceptable for the Lead; it is named so the Engineer's page is not left as it is if the main answer slips. The developer reports which one was built.

## 6. Changes to earlier documents and issues for other roles

- **ux-spec States table, row "Loading"**: add "A part form's skeleton is the form's own structure with grey blocks (UX ruling partform-placeholder-shape-2026-11-28, PF-1 to PF-13); it is drawn in the first paint, with no 300 ms delay." Not edited here: the main checkout's `ux-spec.md` and `screens/` carry another session's uncommitted work. The next spec touch applies it, with the version row.
- **SCR-05 and SCR-06 mock-ups** (`data-show="loading"`, `SCR-05.html` line 187): draw three generic cards. They are not changed here; the build follows this ruling, and the next screens pass redraws the loading state as the ghost (a section strip bar, a head, a card per section with real names and grey controls).
- **Issues for other roles.** (1) *product-owner / developer:* `PartForm` answers "Choose a part in the tree..." while the Engineer's tree is still being read (`part-form.tsx:73`, `use-parts-tree.ts`, `nodes === null`); the words are untrue then. PF-7 covers it in this fix; a separate defect is not needed if PF-7 is built. (2) *solution-architect:* the two questions in PF-6 (does Stage 11b count document bytes) and section 5 (can the Engineer's page hand the ghost in). (3) *qa-engineer:* DEF-145 is the key; PF-14 to PF-14g are the checks to cite; the ux-expert checks the built page against this shape after the PR, at 360, 768 and 1366 px, Draft and Prepared, Lead and Engineer.
