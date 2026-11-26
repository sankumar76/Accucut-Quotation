# Review Report — PR #800 (AQP-488 / DEF-131 Stage 1: the Lead's and the Admin's read-only view of a row's inputs on SCR-06) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: Engineer cost visibility, NFR-002), on a **draft** under DL-438 |
| Review round | 1 |
| Base…branch | `master...fix/AQP-488-lead-view-inputs` (PR [#800](https://github.com/sankumar76/Accucut-Quotation/pull/800), draft), based on `5a496d16`; **without #789** (DL-438: the run of record is the one after #789 is merged in, at 0 behind) |
| Commits reviewed | `d8863ab7`, `4542c2f3`, the merge `f1f5942f`, then **`37a3a1a7`** (six unit tests changed after CI failed; the breakpoint from the tokens). The verdict is given at `37a3a1a7` |
| Date | 2026-11-26 |
| Reviewed against | Jira AQP-488; UX ruling `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md` rev 2 (`6f5f3788`), checks RO-1 to RO-17 (RO-18 waits for #789); architect's note `docs/04-architecture/lead-admin-input-edit-2026-11-27.md` (`55d90dc5`); QA's DEF-131 Row V table; DL-422, DL-424, DL-438; `docs/standards/coding-standards.md` §1, §3, §5, §6 |
| **Verdict (at `37a3a1a7`)** | **REQUEST CHANGES — merge stop.** One **Critical** (QLT-800-07): Stage 11b of run 45846714002 puts `/estimates/[code]` at **192,895 B**, **+733 B against master** (192,162 B) and **395 B over the DL-424 ceiling** of 192,500 B. #789 brings about −154 B, so the run of record would still be about 192,740 B, over the ceiling. **NFR-002, read-only and access control hold** |

## Summary

**NFR-002 holds.**

- **The Engineer's page is unchanged.** `page.tsx` reads `?row=` only on the Lead's and the Admin's branch (`rowOf` is awaited inside `case 'LEAD': case 'ADMIN':`). The Engineer's branch still renders SCR-05 and never loads the review.
- **The client island holds no figure data.** `ReviewInputs` gets the rows mapped down to `id`, `parentId`, `slNo`, `nodeKind` and `label` (completeness `EMPTY`, revision 0), plus two strings and two elements.
- **The only figures near the island are server-rendered markup.** The row line (`This row: ₹ … (BG) · $ … · € …`) is drawn on the server by `ReviewRowLine` and handed in as an element. So its rendered text is in the island's part of the RSC payload, but only on the Lead's and the Admin's page, which already draws the same figures in the tree and the table. No figure is in the island's props as data, in its code, or in any fetch it makes.
- **The form's data carries no figure.** It comes from the same routes the Engineer uses: `GET /form`, `GET /nodes/{id}`, `GET /options/materials`, `GET /options/treatments` and `GET /images/{id}`. They return the form definition, the typed inputs, IDs and names, and the stored file.

**Read-only holds.**

- The block reuses the Engineer's `PartForm` with `editable={false}` and one `review` prop. There is no second copy of the form (UD-1).
- `EstimateWorkspace`, which owns `Autosave`, the save gate's Calculate and the tree controls, is not used. So there is no autosave and no save bar.
- Every field is `readOnly` / `aria-readonly`. The picture uses its existing read-only branch, and the surface treatments are chips.
- The block has no buttons (E2E). Typing into Length changes nothing and sends no non-GET request to `/api/v1/` (E2E).

**Access control holds.**

- Every read the island makes is checked on the server: `getForm` and `getNode` go through `openForRead`, and `getPicture` through `mayOpen`. `mayOpen` lets every non-Engineer role open any estimate, so an Admin sees exactly what a Lead sees, and an Engineer only their own.
- `?row=` is only compared with the Sl. Nos of **this** estimate's server-held rows (`selectedRow`). An unknown, repeated or empty value opens the first row. A Sl. No that belongs to another estimate just names this estimate's row of that number, if there is one. The node ID the island reads is always taken from this estimate's server view.

**Findings.**

| ID | Severity | Summary |
|----|----------|---------|
| QLT-800-07 | **Critical** | `/estimates/[code]` first load is 192,895 B: +733 B against master and 395 B over the DL-424 ceiling. The island is not lazy |
| QLT-800-01 | Minor | The new architecture-test exception for the island has no companion guard, although its comment says "(the next test)". Nothing pins the island figure-free, or `estimate-review.tsx` as its only importer. It lives outside the review folder, so the existing "nothing outside the review imports it" scan does not cover it either (RO-12) |
| QLT-800-02 | Minor | `37a3a1a7` made two "no figure" checks in `estimate-review-screen.test.ts` blind to attribute values (probe below) |
| QLT-800-03 | Minor | An empty number field with a unit loses `rounded-r-none` in the review look: `UnitInput` lets a caller's `className` replace its own |
| QLT-800-04 | Minor | RO-3's comparison by field ID is not in the E2E |
| QLT-800-05 | Info | The "Quantity 0" count is now adaptive; the row line's own count can be pinned to 1 |
| QLT-800-06 | Info | A test comment points to an E2E file that does not exist |
| SEC-800-01 | Info | No figure reaches an Engineer; the island holds no figure data |
| SEC-800-02 | Info | No write path from the view |
| SEC-800-03 | Info | A conflict with #789 in `estimate-review.tsx` is certain; re-review the resolution |

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 0 |
| Minor | 4 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 5a496d16 37a3a1a7`; full files read for the page, `review-page.tsx`, the island, `estimate-review.tsx`, `review-row-line.tsx`, `selected-row.ts`, `review-tree.tsx`, `review-texts.ts`, `part-form.tsx`, `part-fields.tsx`, `field-renderer.tsx`, `surface-treatments.tsx`, `treatment-select.tsx`, `review-look*.ts`, `unit-input.tsx`, `part-head.tsx` | 24 files at `f1f5942f`, plus 2 in `37a3a1a7` |
| Client boundary | `use client` lines of every module the review folder now imports | The island is the one new client file. `part-head.tsx` (imported by `estimate-review.tsx` for the block's head) is **not** a client module. `review-row-line.tsx` and `selected-row.ts` are server-side, in the review folder |
| Server checks on the island's reads | `route-manifest.ts:196`, `:204`, `:260`, `:263`, `:269`; `estimate-inputs.ts:197` (`getForm` → `openForRead`); `estimate-service.ts` `getNode` (`openForRead`); `image-service.ts:129` (`getPicture` → `mayOpen`) | All `ALL_ROLES` in the manifest, each with the viewer checked on the server; Lead and Admin identical; Engineer limited to their own (unchanged) |
| Unit and security tests at `f1f5942f` | `npx vitest run` over 20 files (the four new review-look and block files, architecture, tree column, page, cost-details page, the security tests and every unit file that names `PartForm`, `PartFields`, `FieldRenderer`, `SurfaceTreatments`, `TreatmentSelect`, `EstimateReview` or `ReviewTree`), temporary scratchpad worktree with the dependencies linked, removed afterwards | 5 failed in `estimate-review-screen.test.ts`, the same failures as CI's draft run 45845543964; `37a3a1a7` changes those tests |
| The same at `37a3a1a7`, plus `source-conventions.test.ts` | as above, 21 files | **21 files, 791 passed** |
| The six changed unit tests (`37a3a1a7`) | read; node probe of the new "no figure" expression | See QLT-800-02 and QLT-800-05. The tree-summary regex (optional span), the skeleton count (sliced before the columns: still the tiles' 3) and the breakpoint (`PERSISTENT_MENU_MIN_WIDTH`, 1024 in `design-tokens.ts:9`) keep their strength |
| E2E (`tests/e2e/estimate-review.spec.ts`) | read the diff; `grep` for width tags; count of person-making calls on master and at the head | Choosing a second row is in the AC-6 case, which has **no single-width tag**, so it runs at 360, 768 and 1366 px. It asserts the address, `aria-current`, focus on `#part-form-title`, one `Showing the inputs of 2 … Read-only.` status, the fold below 1024 px, no sideways scroll and **axe** after the choice. The AC-9 axe scans run with the block open. The new Engineer assertions are present (with and without `?row=1`: no `#row-inputs`, no `This row:`, no notice words, no `row=` link). The Admin case sees the block. The write-path check covers typing into Length. **Person-making calls 13 = 13: +0** (the second row is a `POST …/nodes` by the existing Engineer, not a person). Nothing is added after `users.spec.ts` |
| CI | draft run 45845543964 at `f1f5942f` | failed at the unit tests (the five above); not the run of record |
| CI | run 45846714002 at `37a3a1a7` | Stages 1 to 11b **success** (unit, integration, build, Stage 11b green against CI's own 200,000 B limit). The E2E shards were still running when this review was published; they cannot change the verdict |
| Stage 11b `/estimates/[code]` (DL-424 ceiling 192,500 B; master 192,162 B) | Stage 11b log of run 45846714002 | `PASS /estimates/[code] gzip 192,895 (192.9 KB) limit 200,000 headroom 7,105` (job 140002427129): **+733 B against master** (192,162 B, run 45842343024 at `5a496d16`, the merge base) and **395 B over the DL-424 ceiling** (QLT-800-07). `/estimates/[code]/costs/[slNo]` 168,611 B; `/sign-in` 165,519 B; `/account` 171,308 B |
| DL-438 | PR body | A draft; the run of record is after #789 is merged in, at 0 behind, with Stage 11b read again. Both PRs edit `estimate-review.tsx` (#789: `WorkspaceHeader` → `ReviewHead`), so a merge conflict is certain there (SEC-800-03) |
| Secrets | diff | none; invented names |

## Findings

| ID | Severity | File:line | Rule / check | Issue | Why (impact) | Fix |
|----|----------|-----------|--------------|-------|--------------|-----|
| QLT-800-07 | **Critical** | `src/components/features/estimate-review/estimate-review.tsx` (the static import of `ReviewInputs`); `src/components/features/estimate-review-inputs/review-inputs.tsx`; `src/components/features/estimate-workspace/part-form.tsx` | DL-424 (3) (PRD 0.58 ceiling, 192,500 B); NFR-009; the brief ("the island must be lazy") | **Stage 11b of run 45846714002: `/estimates/[code]` 192,895 B gzip, +733 B against master (192,162 B) and 395 B over the ceiling.** The island is a client component that the server review imports statically, so its code is a client reference of the route and counts in the first load, together with the `review?.head` paths added to `PartForm`'s first-load file. The rest of the review look (`field-renderer.tsx`, `surface-treatments.tsx`, `treatment-select.tsx`, `review-look*.ts`) is in the part fields' lazy chunk, as the PR says. #789 brings about −154 B, so the run of record would be about 192,740 B, still over; #791's about +150 B would add to it. The PR body expected the island to be "small"; it is not small enough. The `design-tokens` import of `37a3a1a7` is not the cause: `button.tsx` already brings that module into the client graph | DL-424 (3): a PR on this route does not merge above 192,500 B, and anything above comes to master and the product-manager before the squash. DL-438 makes the run of record the one after #789 is merged in, and on present figures that run is over too | **Make the island lazy**, with the pattern the page already uses (`useLazyComponent` in `PartForm`, `useFirstOpen` for the dialogs): keep `review-inputs.tsx` as a thin client shell that renders the server-drawn `head` and the skeleton at first paint (ruling 3.6 still holds), and load its body (the `PartForm` wiring, the fold and the focus logic) with a bare `import()` on mount. Then measure Stage 11b on this branch, and again on the run of record with #789 in, at or under 192,500 B. **Or** bring the figure to master and the product-manager before the squash. **Test:** Stage 11b in the run of record, stated in the PR body; an architecture assertion that `estimate-review.tsx` imports no client body of the island statically, only the shell |
| QLT-800-01 | Minor | `tests/unit/estimate-review-architecture.test.ts:123` (and `:145`) | NFR-002, ADR-016; RO-12; the precedent of #789's `folder-path` guard (`e99a7571`) | **The island's exception has no guard.** `INPUTS_ISLAND` is deleted from the set of client files the review folder may not reach, and the comment says it "is imported by the review alone (the next test)". No such test exists: `review-inputs.tsx` appears in tests only as this exemption. Nothing asserts that the island imports no schema, review service, `@/server/` module or figure code, nor that `estimate-review.tsx` is its only importer. The island lives in `estimate-review-inputs/`, **outside** the review folder, so the existing scan "nothing outside the review imports a file of its folder" does not cover it either. | Today the island is clean: its imports are React, `createSaveGate`, the `PartItem` type and `PartForm`. But it is the largest client surface on the Lead's page, it wraps the whole Engineer form with its fetches, and RO-12 asks that the Engineer's page never carry it. A later import of `review-inputs.tsx` from the Engineer's workspace, or of a costs type into it, would fail nothing | Add a test beside the nine sibling exceptions: strip the comments from `review-inputs.tsx`; `expect(code).not.toMatch(/schemas\/|estimate-review\/|@\/server\/|calculation-|row-outputs|product-totals|figure-state|costs/)`; and `expect(ALL.filter((f) => f.path !== INPUTS_ISLAND && /estimate-review-inputs\//.test(f.text)).map((f) => f.path)).toEqual(['src/components/features/estimate-review/estimate-review.tsx'])`. Fix the comment to name the test |
| QLT-800-02 | Minor | `tests/unit/estimate-review-screen.test.ts:217`, `:251` (`37a3a1a7`) | §6 (assertions that can fail); architecture 4.8 (figures only while current); brief: "confirm none is weakened" | **The "no figure" checks of the not-calculated and cleared states no longer see attribute values.** `withoutIcons(html).replace(/<[^>]*>/g, ' ')` removes every tag with all its attributes, to avoid the false positive from `tracking-[0.06em]`. A figure leaked into `aria-label`, `title` or a `data-*` attribute without `₹` now passes. Node probe: for `<span aria-label="BG 618.37">` the new check reports **no match**, while stripping only `class` attributes reports a match and has **no** false positive on `tracking-[0.06em]`. The check still fails for a figure in visible text, which covers the island's server-drawn row line and the tree. | A narrow weakening, but of the kind that matters: an accessible name is what a screen reader reads, so a figure there is shown to the person. These two tests guard the rule that no figure of the record is drawn while the figures are not current. (They render the Lead's review, so this is that rule, not Engineer visibility.) | `expect(withoutIcons(html).replace(/\sclass="[^"]*"/g, '')).not.toMatch(/\d+\.\d\d/)`, which removes the class names only and keeps every other attribute checked. **Test:** the same two cases; optionally a control that plants `aria-label="618.37"` and sees it caught |
| QLT-800-03 | Minor | `src/components/features/estimate-workspace/field-renderer.tsx:174` (with `src/components/shared/unit-input.tsx:14`) | RO-4, RO-15 (the look of an empty field) | **An empty number field with a unit loses its square right edge in the review look.** `UnitInput` renders `<Input className="rounded-r-none" {...props} />`, so a caller's `className` replaces `rounded-r-none` rather than joining it. The review look passes `className: NOT_ENTERED_LOOK` exactly when the field is empty, so Length (mm), Part Weight (kg), Cutting Time (sec) and the like get rounded right corners where they meet the unit box. | Cosmetic, but on precisely the fields the ruling is about ("Not entered"), on every empty unit field of every row | In `unit-input.tsx`: `export function UnitInput({ unit, className, ...props }: UnitInputProps) { … <Input className={cn('rounded-r-none', className)} {...props} /> … }`. **Test:** `review-look-field.test.ts`, an empty number field with a unit keeps `rounded-r-none` and gains `placeholder:italic` |
| QLT-800-04 | Minor | `tests/e2e/estimate-review.spec.ts` (the AC-2 row case) | RO-3 ("Compare by field ID in E2E") | **RO-3's browser check is not there.** Stored values are compared in unit tests (`review-look-field`, `review-look-part-fields`). The PR body calls the E2E by field ID "a follow-up if the case time allows". | RO-3 is the core promise of Stage 1 (what the Lead reads is what was saved), and it is the one RO check the ruling asks to be made in a browser by field ID | In the existing AC-2 case, which already has a calculated estimate: for each field the Engineer's fixture filled, `await expect(form.locator('#' + controlIdFor(fieldId))).toHaveValue(stored)`. No new case and no new person (DL-422). Or record the deferral with the ux-expert and QA |
| QLT-800-05 | Info | `tests/unit/estimate-review-screen.test.ts:770-772` (`37a3a1a7`) | §6 | The "Quantity 0" count is now `2 + countOf(row, …)`, so it would also pass if the row line lost its mark. In this fixture the open row is the warned item, so the row line's count is known. | A weaker check than it could be | `expect(countOf(row, 'Quantity 0')).toBe(1);` and keep `toBe(3)` for the page |
| QLT-800-06 | Info | `tests/unit/review-inputs-block.test.ts:20` | docs accuracy | The comment points to `tests/e2e/estimate-review-inputs.spec.ts`, which does not exist; the browser checks are in `estimate-review.spec.ts`. | Misleading for whoever looks for them | Correct the path |
| SEC-800-01 | Info | `page.tsx:30-34`, `:75`; `estimate-review.tsx` (`partItems`, `rowLine`); `review-row-line.tsx` | NFR-002, brief point 1 | **No figure reaches an Engineer, and the island holds no figure data.** Detail in the Summary. The row line's rendered text is in the island's RSC slot on the Lead's and the Admin's page only. | none | none |
| SEC-800-02 | Info | `review-inputs.tsx`; `part-fields.tsx`; E2E AC-2 row case | brief point 2 | **No write path from the view.** `editable={false}`, no `EstimateWorkspace` (so no `Autosave`), no buttons in the block, read-only fields, and typing sends nothing (E2E). The server's `PUT` / `PATCH` / `DELETE` routes and their editability rules are unchanged. | none | none |
| SEC-800-03 | Info | `estimate-review.tsx` | DL-438 | **A conflict with #789 is certain.** Both PRs change `estimate-review.tsx`: #789 replaces `WorkspaceHeader` with the server `ReviewHead`. On merging #789 in, keep `ReviewHead` and add the inputs block, then re-run the review architecture test, this PR's tests and Stage 11b. A short re-review of the resolution is worth it, because the merge touches the NFR-002 boundary | — | — |

## Security notes (the brief's points)

| Point | Result | Evidence |
|-------|--------|----------|
| 1. NFR-002: an Engineer gets nothing new on any screen or payload; the island gets no figure (RSC and props); the row line is from the server for Lead and Admin only | **Yes** | SEC-800-01; E2E Engineer case with and without `?row=` |
| 2. Read-only: no autosave, no save bar, no picture controls, no PATCH or POST reachable from the island | **Yes** | SEC-800-02 |
| 3. Access: server role checks on `/form`, `/nodes/{id}`, the options and the picture read; Admin = Lead; `?row=` foreign or unknown leaks nothing and falls back to the first row | **Yes** | Checks Run row "Server checks"; `selected-row.ts`; `review-inputs-block.test.ts` (unknown `row`, no rows) |
| 4. Reuse: `PartForm` with `editable=false` and `review`, no second form; the architecture test lists the island correctly | **Reuse yes; the listing has no guard** (QLT-800-01) | `review-inputs.tsx`; `review-look.ts` (one prop); `estimate-review-architecture.test.ts:123`, `:145` |
| 5. Tests: second-row E2E at three widths with axe; the Engineer assertions; DL-422 +0, nothing after `users.spec.ts` | **Yes** (QLT-800-04 for RO-3) | E2E section in Checks Run |
| 6. First load: Stage 11b against 192,500 B; the island lazy | **No: 192,895 B, 395 B over** (QLT-800-07). **The island is not lazy:** it is a static client reference of the server review | Run 45846714002, Stage 11b job 140002427129; `estimate-review.tsx` imports `ReviewInputs` statically. `design-tokens` (the `37a3a1a7` import) is not the cause: `button.tsx` already brings it into the client graph |
| 7. Quality, focus and announcement, "Not entered" | **Yes, with findings** | Focus moves to `#part-form-title` (`tabIndex -1`) only after a choice (not on first paint), once the form is ready. One polite status `Showing the inputs of … Read-only.` (`sr-only`), empty on first paint. Below 1024 px the tree folds and its summary carries `· <row>`. "Not entered" is the placeholder (italic, `--ink-2`), or the empty option of a select, and also a hidden description joined to `aria-describedby`; derived fields are left as they are. QLT-800-03 for the unit fields |

## Reviewer-specific tables

### RO conformance (ruling rev 2 → code → test)

| RO | Code | Test(s) | Status |
|----|------|---------|--------|
| RO-1 links, first row open, title, cards | `review-tree.tsx` (`Link`, `aria-current="true"`), `selected-row.ts` | `review-inputs-block.test.ts`; E2E AC-2 | Met |
| RO-2 choice: address, no jump, `aria-current`, focus, one status | `review-tree.tsx` (`scroll={false}`, `prefetch={false}`); `review-inputs.tsx`; `part-fields.tsx` focus effect | E2E AC-6 at three widths | Met |
| RO-3 stored values equal, by field ID in E2E | the same `FieldRenderer` | unit only | **Partly** (QLT-800-04) |
| RO-4 `Not entered`, `0`, `None` | `field-renderer.tsx`, `review-look-texts.ts` | `review-look-field.test.ts` | Met (QLT-800-03 look) |
| RO-5 labels, letters, units, order equal | one renderer; `reviewField` changes only the hint | `review-look-part-fields.test.ts` | Met |
| RO-6 no edit control, nothing sent | `editable=false`; no `EstimateWorkspace` | unit; E2E (no buttons, no non-GET) | Met |
| RO-7 picture with no controls, `No picture` | `PictureSlot` read-only branch | existing tests | Met |
| RO-8 chips, `None selected` | `surface-treatments.tsx` `review` branch | `review-look-surface.test.ts` | Met |
| RO-9 notice by status, Ignored first | `inputsNotice` | `review-inputs-block.test.ts` | Met |
| RO-10 row line, `Cleared`, dash | `review-row-line.tsx` | unit; E2E (current and not calculated) | Met |
| RO-11 no intro, hints except QTY, no `Enter this value.` | `reviewField`; `missing` empty | `review-look-part-fields.test.ts` | Met |
| RO-12 Engineer unchanged; the island not in the Engineer's page | page branch; island imported by the review only | E2E Engineer; architecture test | **Met today, not pinned** (QLT-800-01) |
| RO-13, RO-14 keyboard and reader | read-only fields stay focusable; the form is named by its title; unit as description | E2E (focus); unit | Met |
| RO-15 widths, fold, summary `Parts tree · <row>`, 44 px | `review-tree.tsx`; island fold | E2E three widths | Met |
| RO-16 unknown `row`, no rows, failure, skeleton status | `selectedRow`; `PartForm` failure and loading | `review-inputs-block.test.ts` | Met |
| RO-17 axe with the block open, Lead and Admin, three widths | — | E2E AC-9 and the AC-6 choice | Met |
| RO-18 SCR-07 `View inputs` | — | — | After #789 (stated) |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-800-07 | `estimate-review.tsx` static import; `review-inputs.tsx` | Stage 11b at or under 192,500 B on the run of record |
| QLT-800-01 | architecture test `:123` | island figure-free and imported by the review alone |
| QLT-800-02 | screen test `:217`, `:251` | class-only strip; a planted `aria-label` figure is caught |
| QLT-800-03 | `unit-input.tsx:14` via `field-renderer.tsx:174` | an empty unit field keeps `rounded-r-none` |
| QLT-800-04 | E2E AC-2 | values compared by field ID |
| QLT-800-05, -06, SEC-800-01 to -03 | as listed | optional or n/a |

## Issues for other roles

- **developer:** **QLT-800-07 first** (a lazy island, then Stage 11b at or under 192,500 B). Then QLT-800-01, -02 and -03 are a few lines each, and QLT-800-04 is one loop in an existing case. All are before merge preferably, and none blocks. On merging #789 in, resolve `estimate-review.tsx` around `ReviewHead` (SEC-800-03).
- **orchestrator:** no squash above 192,500 B (DL-424); read Stage 11b again on the run of record (#789 in, 0 behind) under DL-424. Ask for a short re-review of the `estimate-review.tsx` merge resolution.
- **ux-expert and QA:** if QLT-800-04 is deferred, record it against RO-3.

## Previous Findings (re-review only)

n/a (round 1).

## Round 2 (re-review of `37a3a1a7..984bf245`, 2026-11-26) — REQUEST CHANGES, merge stop at this head

**Scope.**
- `c4870eee`: the island is removed. The server review renders the Engineer's `PartForm` directly. The callbacks, `missing` and `gate` become optional, with defaults inside the lazy `PartFields`. The chosen-row state is in `PartForm`.
- `150b24b0`: the review findings.
- The merge `984bf245` of `master` (`d2b58f04`, #799), which brings only export and instrumentation files.
- #789 has **not** merged yet, so the `estimate-review.tsx` merge resolution is still to be checked (`git show --cc` when it lands).
- PR review [6076962764](https://github.com/sankumar76/Accucut-Quotation/pull/800#pullrequestreview-6076962764); a reply in each of the seven round-1 threads.

**Checks run.**
- 19 test files at `984bf245` in a temporary scratchpad worktree, since removed: **765 passed**. They cover the architecture, screen, `part-form-lazy`, `overlay-imports`, `source-conventions`, security, review-look and block tests, and every unit file that names `PartForm`, `PartFields`, `FieldRenderer`, `UnitInput` or `EstimateWorkspace`.
- CI run 45849387544: Stages 1 to 11b **success**; the E2E shards were still running when this was published.

| Finding | Round-2 status | Evidence |
|---------|----------------|----------|
| QLT-800-07 (Critical) | **Not fixed at this head** | **Stage 11b, job 140012963068: `/estimates/[code]` 192,538 B**, which is **+376 B against master** (192,162 B at `d2b58f04`, run 45848190569, job 140007246749) and **38 B over the DL-424 ceiling**. Removing the island halved the growth (from +733 B). #789 is still open. Projected run of record: about 192,384 B with #789 in (under), or about 192,534 B if #791 (~+150 B) lands first (over). **It closes when the run of record (#789 in, 0 behind) reads at or under 192,500 B.** A trim of ~40 B, better ~200 B, would make that robust (QLT-800-08 names a candidate); or master and the product-manager decide |
| QLT-800-01 (Minor) | **Not fixed** | The exemption is now `part-form.tsx`: narrow (one file) and justified (already in the first load, figure-free today), but the test diff is only a rename. `part-form-lazy.test.ts` (unchanged) pins only the lazy import of `PartFields`. The suggested guard: `part-form.tsx` imports nothing restricted; the review's `<PartForm` props are exactly `estimateId`, `part`, `editable`, `nodes`, `review`; and `partItems` is built only from `id`, `parentId`, `slNo`, `nodeKind` and `name` |
| QLT-800-02 | **Fixed** | Only `class` attributes are stripped, so other attributes are checked again |
| QLT-800-03 | **Fixed** | `cn('rounded-r-none', className)` in `UnitInput`, with a unit test |
| QLT-800-04 | **Fixed** | The AC-2 E2E compares every input and textarea by `controlIdFor(fieldId)` with what the part holds (read as the Lead), and asserts `status === 200` and more than 3 compared |
| QLT-800-05, QLT-800-06 | **Fixed** | Counts pinned to 1 and 3; the path is corrected |
| SEC-800-01, -02, -03 | Info, stand | SEC-800-03 (the #789 conflict) is still to be checked when #789 merges |

**New in round 2**

| ID | Severity | File:line | Note |
|----|----------|-----------|------|
| SEC-800-04 | Info | `src/components/features/estimate-review/estimate-review.tsx:196` | **The new NFR-002 boundary is verified.** The server review passes `PartForm` an id, `part` `{id, slNo, revision: 0}`, `editable={false}`, `nodes` mapped to `id`, `parentId`, `slNo`, `nodeKind` and `label`, and `review` with two strings and two server elements: no function and no figure data. The row line's figures are server markup on the Lead's and the Admin's page only. **The Engineer's path is unchanged:** `EstimateWorkspace` still passes every callback, `missing` and `gate`; `chosen` reaches the fields only through `review`, which the Engineer never has; and the fold, focus and announcement effects are no-ops without it |
| QLT-800-08 | Info | `src/components/features/estimate-workspace/part-form.tsx:57` | The render-phase `seen` / `chosen` state runs for the Engineer too: one extra render when the selected part changes, and an unused `ownGate` per `PartFields` mount. There is no change of behaviour, but it is first-load code. Moving the "chosen after first paint" logic into the lazy `PartFields`, and creating the fallback gate only when `gate` is absent, is one way to find QLT-800-07's bytes |

**Open after round 2:** Blocker 0, **Critical 1** (QLT-800-07, conditional on the run of record), Major 0, Minor 1 (QLT-800-01), Info 5 (SEC-800-01 to -04, QLT-800-08). **Verdict at `984bf245`: REQUEST CHANGES — merge stop at this head.** DL-422: +0.

## Round 3 (re-review of `984bf245..46e03a1a`, 2026-11-26) — APPROVE WITH COMMENTS, one condition before merge

**Scope.**
- Lane 3's commits `e628a1f8`, `5ca14db0` and `3242e62f`. A lazy shell was tried, then removed: lane 3's local build with the client-reference manifest showed that every client module of the route, including those behind `import()`, sits in the same 7 route chunks, so a wrapper only added code.
- They net out to three changes: `PartForm` is drawn directly; the row's `PartHead` and row line are server markup **above** it; `FieldRenderer` is trimmed. There is also a new guard test.
- The merge `46e03a1a` of master `c30b349f` (#791). The branch is **0 behind**.
- **The ceiling is now 193,500 B:** PRD v0.65 (2026-11-27, the product-manager's ruling, time-limited to G8; read in `docs/02-product/prd.md:5`, `:209`, `:764`).
- PR review [6077675216](https://github.com/sankumar76/Accucut-Quotation/pull/800#pullrequestreview-6077675216); replies in the QLT-800-07 thread and the three round-2 threads; label `review:quality-approved`.

**Checks run.**
- 20 test files at `46e03a1a` in a temporary scratchpad worktree, since removed: **777 passed**. They include the architecture test with the new guard, screen, review-look, block, `part-form-lazy`, `overlay-imports`, `source-conventions` and the security tests.
- A node probe of the guard's expression: it catches a planted `@/server/views/schemas/costs` import and ignores a mention in a comment.
- CI run 45859281146: Stages 1 to 11b **success**; the E2E shards were still running when this was published.

| Point / finding | Round-3 status | Evidence |
|-----------------|----------------|----------|
| NFR-002 at the boundary (SEC-800-04) | **Holds, narrower** | `estimate-review.tsx` draws `PartHead` and `rowLine` on the server above `PartForm`, so `review` is `{ notice, showing }`, two strings. `PartForm` gets ids, `editable={false}` and the mapped `nodes`: no element, no function, no figure. The Engineer's path is unchanged: `PartFields` draws its own `PartHead` with the ref when `review` is absent; `titleElement()` uses the ref first; the `FieldRenderer` refactor gives the Engineer the same DOM (the hidden span is review-only); and `EstimateWorkspace` passes every callback, `missing` and `gate`. Pinning the `<PartForm` props and the `partItems` keys stays optional: that boundary exists only on the Lead's and Admin's page |
| QLT-800-01 | **Fixed** | `estimate-review-architecture.test.ts`: `part-form.tsx`, `part-fields.tsx`, `review-look.ts` and `review-look-texts.ts`, comments stripped, do not match `schemas/`, `estimate-review/`, `@/server/`, `calculation-`, `row-outputs`, `product-totals`, `figure-state` or `costs`. These are the modules every Engineer downloads, so this is the NFR-002 guard. The importer pin no longer applies (no island; `PartForm` is shared by design) |
| QLT-800-02 to -06 | **Still hold** | No change to the class-only strip, the counts or the path. `UnitInput`'s `cn` stays, and the review look still passes its class. The RO-3 E2E is unchanged except that the title is read from `#row-inputs` |
| QLT-800-07 | **Fixed (PRD v0.65)** | **Stage 11b, job 140045762982: `/estimates/[code]` 192,656 B**, which is **+365 B against master** (192,291 B at `c30b349f`, run 45854831021, job 140030342539, #791 in) and **844 B under 193,500 B**. With #789's ~−154 B the run of record should be about 192,500 B |
| QLT-800-08 | Info, **accepted** | Moving the state would not reduce the first load (lane 3's chunk measurement). No behaviour change for the Engineer |
| QLT-800-09 (new) | Info | `field-renderer.tsx:64`: uneven indentation inside `draw`. No behaviour change; cross-reference for reviewer-standards |

**Condition before merge (DL-438).** #789 is still open. After it merges and lane 3 merges it in:
- `git show --cc` of `estimate-review.tsx` (SEC-800-03), because it sits on the NFR-002 boundary.
- Stage 11b of that run of record must read at or under 193,500 B, stated in the PR body.

**Open after round 3:** Blocker 0, Critical 0, Major 0, Minor 0, Info 6 (SEC-800-01 to -04, QLT-800-08, QLT-800-09). **Verdict at `46e03a1a`: APPROVE WITH COMMENTS**, subject to the condition above. DL-422: +0.

## Hand-off
- Status: COMPLETE
- GitHub: PR review [6076703907](https://github.com/sankumar76/Accucut-Quotation/pull/800#pullrequestreview-6076703907) (COMMENT, 7 inline comments, at `37a3a1a7`); label `review:quality-changes-requested`
- Verdict at `37a3a1a7`: REQUEST CHANGES, **merge stop** (Blocker 0, Critical 1, Major 0, Minor 4, Info 5). QLT-800-07 (DL-424): 192,895 B is 395 B over the ceiling, and still over with #789 in. NFR-002, read-only and access control hold
- **Round 2 (`984bf245`):** REQUEST CHANGES, merge stop at this head (Blocker 0, Critical 1, Major 0, Minor 1, Info 5). Stage 11b is 192,538 B: +376 B against master and 38 B over. QLT-800-01's guard is still missing. #789's `estimate-review.tsx` resolution is to be checked when #789 merges.
- **Round 3 (`46e03a1a`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 0, Info 6). Stage 11b is 192,656 B: +365 B against master and 844 B under PRD v0.65's 193,500 B. Before merge: #789 merged in, my `git show --cc` check of `estimate-review.tsx`, and the run of record's Stage 11b at or under 193,500 B.
- Recommended next agent: developer (QLT-800-07, then QLT-800-01 to -04), then the merge of #789 in and the run of record, then a short re-review of that resolution, then orchestrator: mark ready and merge on fully green CI with Stage 11b at or under 192,500 B.
