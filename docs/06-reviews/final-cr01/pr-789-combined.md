# Review Report — PR #789 (AQP-452 / DEF-095, AQP-466 / DEF-110, AQP-469 / DEF-113: one shared page head for SCR-05, SCR-06 and SCR-07) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: Engineer cost visibility, NFR-002) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-452-page-head` (PR [#789](https://github.com/sankumar76/Accucut-Quotation/pull/789)), 4 commits (one a merge of `master`) |
| Commit reviewed | `85acffba`, then **`3464c629`** (the trim commit `0d3db28f` and a merge of `master`; see "Update at 3464c629", which holds the verdict) |
| Date | 2026-11-26 |
| Reviewed against | Jira AQP-452, AQP-466, AQP-469; DEF-095, DEF-110, DEF-113 (records-u); UX spec SCR-05, SCR-06, SCR-07 (`origin/master`); DEF-108's recorded ruling (foldable panel at 360 and 768 px); DL-422, DL-424; `docs/standards/coding-standards.md` §1, §3, §5, §6 |
| **Verdict (at `3464c629`)** | **REQUEST CHANGES — merge stop.** One **Critical** (QLT-789-07): Stage 11b of run 45823230341 puts `/estimates/[code]` at **192,793 B**, still 293 B over DL-424's 192,500 B ceiling (192,813 B at `85acffba`; the trim saved 20 B), and DL-424 says such a PR does not merge. One Major (QLT-789-01). **NFR-002 holds:** no rate, calculated figure or formula reaches an Engineer |

## Summary

**NFR-002 holds.** The SCR-07 route is unchanged: it is `ADMIN_AND_LEAD` in the manifest, `authorizePage` answers an Engineer with a 403 before any read, and `getCosts` refuses an Engineer again by role before it reads. The new tree column does not send its data to the browser. `CostDetails`, `CostTree`, `PartsTreeList`, `RowName`, `NodeKindIcon`, `Icon`, `PageHead` and the UI primitives are all server modules with no `'use client'` (each was checked). So `nodes`, and the `figures` in it, stay on the server and are never put into the RSC payload; only the drawn names, Sl. Nos, kinds and links are. On SCR-05 the Engineer's head has the title, the form's sentence, the status and the due date: no figure. The SCR-06 meta line, which is the Lead's and the Admin's page, holds names only. The security test's list is still an exact-equality assertion, so any other route that starts asking for the costs view still fails it. Authorisation on SCR-07 is unchanged.

**The Critical is the first-load ceiling (QLT-789-07).** Stage 11b of run 45818583228 gives `/estimates/[code]` **192,813 B** gzip: 796 B above master (192,017 B) and **313 B over DL-424's 192,500 B ceiling**. DL-424 (3) says a PR on this route "does not merge above 192,500 B", and anything above it comes to master and the product-manager before the squash. The PR body says the only new client code is `CopyPathButton`. In fact `estimate-workspace.tsx` is a client module that imports `WorkspaceHeader`, so the whole grown header ships in the route's JavaScript, including the SCR-06-only parts (`MetaLine`, `NotesCard`, Open folder, its icon and words) that SCR-05 never renders.

**The Major is a design point, not a leak.** To draw names and kinds, SCR-07 now runs the review's whole costs read on every page view: figures, approval, price removal and the rates-changed count with its masters read. A names-and-kinds read already exists: `getEstimateService().getTree`. Its `PartView` is documented as "no figure, so it is in every role's tree", and it uses the same name reader. With it, the security list would not need a fourth entry. The tree's component would not hold figures it must never draw. A fault in the figures or the masters would no longer make the whole cost-details page fail. And each row view would cost one `listNodes` instead of the costs pipeline.

**Minors:**

- **QLT-789-02:** the "no figure in the tree" guards cannot catch a figure. The E2E looks for `₹`, but `formatFigure` writes none, and every unit fixture has `figures: null`.
- **QLT-789-03:** `PageHead` puts SCR-06's meta line in a `<p>`. When the first open of Change customer fails, `FirstOpenFailure` draws a `<div role="alert">` inside it, which is invalid nesting.
- **QLT-789-04:** below 1024 px the SCR-07 tree is open and comes before the row's stages, so on a phone a Lead scrolls past the whole tree first.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 1 |
| Minor | 4 |
| Info | 5 |

(At `3464c629`; QLT-789-08 Minor and QLT-789-09 Info were added in "Update at 3464c629".)

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 789`; `git diff $(merge-base)..85acffba` for `src/` and the tests; full files read for the SCR-07 page, `cost-tree.tsx`, `page-head.tsx`, `workspace-header.tsx`, `change-customer-button.tsx`, `parts-tree-list.tsx`, the review service's `getCosts`, `costs.ts` and `node-costs.ts` schemas, `estimate-service.ts` (`getTree`, `openForRead`, `mayOpen`), `part-view.ts` | 37 files. `src`: 13 files. The rest are tests, mostly the h1 text `Estimate <code>` |
| Client boundary on the SCR-07 tree path | `git show 85acffba:<file> \| head -2 \| grep "use client"` for every module in `cost-details/` and every shared or UI module the tree and head use | Only `phone-stages.tsx` (pre-existing, not given `tree`) is a client module. `cost-tree.tsx`, `cost-details.tsx`, `parts-tree-list.tsx`, `row-name.tsx`, `node-kind-icon.tsx`, `icon.tsx`, `page-head.tsx`, `button.tsx`, `card.tsx` and `badge.tsx` are server modules. **No prop holding `nodes` or `figures` crosses into a client component** |
| SCR-07 authorisation | page source at the head; `route-manifest.ts:339`; `estimate-review-service.ts:144-155` | `authorizePage('/estimates/[code]/costs/[slNo]')` runs first, and the manifest row is `ADMIN_AND_LEAD` (unchanged). `getCosts` refuses `ENGINEER` by role before any read (`ForbiddenError`). Unchanged and pinned by `cost-details-page.test.ts` AC-8 ("before anything is read … no read is made") and `tests/security/role-matrix.test.ts` |
| Security test list change | `tests/security/rates-changed-restricted.test.ts:61-63` at the head | Still `toEqual` on the sorted list, so it is **not loosened**: one named page was added, and any other asker fails. The title's claim that the manifest holds no Engineer row is not asserted in this file, but `role-matrix.test.ts` pins it (SEC-789-02) |
| Unit and security tests at the head | `npx vitest run` on `page-head`, `cost-details-head`, `cost-details-tree`, `cost-details-page`, `cost-details-screen`, `security/rates-changed-restricted` and `security/role-matrix` (worktree `aqp-402` at `85acffba`, read-only; `git status` clean before and after) | **7 files, 546 tests passed** |
| E2E guard on the tree | `tests/e2e/cost-details.spec.ts:225`; `src/lib/money.ts:48-60` | The E2E asserts no `₹`, but `formatFigure` (SCR-06's tree figure) has no `₹` (QLT-789-02) |
| Change customer size | `change-customer-button.tsx:50`; `globals.css:43` (`--control-h-row: 36px`), `:280-283` (`fine-wide` = 1024 px and wider with a fine pointer) | 44 px on touch and below 1024 px, 36 px with a fine pointer from 1024 px, **as asked**. The E2E (`estimate-customer.spec.ts`) asserts at least 36 px from 1024 px and at least 44 px below |
| Tree column | `cost-tree.tsx`; `tree-column-panel.ts` | Names, Sl. Nos and kinds only. 320 px is `--tree-w` (E2E asserts the box width equals it from 1024 px). Sticky with its own scroll from 1024 px (the SCR-06 classes, moved unchanged). Exactly one row has `aria-current="page"` (E2E). Each href is `/estimates/<code>/costs/<slNo>` with both parts URL-encoded, for a row of this estimate. The target page authorises again on every load |
| CI at `85acffba` | `gh run view 45818583228`; job monitor | **success**: Stages 1 to 11, Stages 1 to 11b, E2E shards 1 to 4 all green. For the run at `3464c629`, see "Update at 3464c629" |
| Stage 11b `/estimates/[code]` first load (DL-424 ceiling 192,500 B; `master` 192,017 B) | `gh api --allow-escape-sequences …/actions/jobs/139904623639/logs` (Stage 11b step, success) | **`PASS /estimates/[code] gzip 192,813 (192.8 KB) limit 200,000 headroom 7,187`**: **+796 B** against master, **313 B over the DL-424 ceiling** (QLT-789-07). `/estimates/[code]/costs/[slNo]` is 168,611 B and `/export` 170,187 B, both inside the 190,000 B floor. CI enforces only 200,000 B, so the step is green |
| Why the route grew | `git grep` for importers of `workspace-header` at the head, with their `use client` lines | `estimate-workspace.tsx` (**client**) imports `WorkspaceHeader`; `estimate-review.tsx` and `review-page.tsx` (server) do too. So the header's SCR-06 branch is in the route's client bundle |
| DL-422 person count | PR body; diff | No E2E case added, removed or renamed. The new assertions sit inside existing cases. **+0** |
| Secrets | diff | none. The fixtures use invented names |

## Findings

| ID | Severity | File:line | Rule / check | Issue | Why (impact) | Fix |
|----|----------|-----------|--------------|-------|--------------|-----|
| QLT-789-07 | **Critical** | `src/components/features/estimate-workspace/workspace-header.tsx` (imported by the client `estimate-workspace.tsx`); `src/components/shared/page-head.tsx` | DL-424 (3) (PRD 0.58 ceiling, 192,500 B); NFR-009; DEF-113 proof line "first-load figure stated" | **`/estimates/[code]` first load is 192,813 B gzip, 313 B over the DL-424 ceiling** (+796 B against master's 192,017 B). `WorkspaceHeader` is imported by `estimate-workspace.tsx`, which is `'use client'`. So the header and everything it imports ship in the route's client JavaScript: `PageHead`, `Badge`, `Button`, the `FolderOpen` icon, `CopyPathButton`, and the SCR-06-only `MetaLine`, `NotesCard`, Open folder and their words. Only the server-rendered review (SCR-06) uses that branch; SCR-05 never renders it. The PR body says the only new client code is `CopyPathButton`, which is not the case. | DL-424 (3): a PR on this route "does not merge above 192,500 B", and anything above comes to master and the product-manager before the squash. This PR uses up the 483 B of room DL-424 left, plus 313 B more, for code the Engineer's page never runs. The other lanes still due on this route (DEF-099, SCR-05) would then have no room | **Trim before merge** (preferred): move SCR-06's head into a server-only module in the review folder, for example `estimate-review/review-head.tsx`, built from `PageHead` with `MetaLine`, `NotesCard`, Open folder and `CopyPathButton`, and used by `estimate-review.tsx`. That leaves `WorkspaceHeader` (SCR-05, client) with only what SCR-05 draws, and drops the `review` prop. Measure in Stage 11b: it must be at most 192,500 B, and ideally near or below 192,017 B. **Or** bring the figure to master and the product-manager before the squash, as DL-424 requires. **Test:** the Stage 11b row is at most 192,500 B in the run of record, and the PR body states the figure |
| QLT-789-01 | **Major** | `src/app/(portal)/estimates/[code]/costs/[slNo]/page.tsx:41-42`; `tests/security/rates-changed-restricted.test.ts:61-63`; `src/components/features/cost-details/cost-tree.tsx` (`CostNode`) | Data minimisation and least privilege in the NFR-002 area; coding standards §1 (single responsibility), §3 (shared modules); brief point 2 | **SCR-07 runs the review's whole costs read to draw names and kinds.** `getEstimateReviewService().getCosts()` reads the figure basis, the configuration, the nodes, the row figures, the approval and the price removal. While the figures are current it also computes `ratesChanged` (`ratesChangedSince`: masters, estimate access, master snapshot, count). The page uses only `nodes`, and the tree draws only `slNo`, `name` and `nodeKind`. `getEstimateService().getTree(viewer, estimateId)` already returns exactly `id`, `parentId`, `slNo`, `label` and `nodeKind`. `PartView` is documented as "no figure, so it is in every role's tree", it is built with the same name reader (`nameOf`: "the reader SCR-06 and SCR-07 use"), and `mayOpen` lets a Lead or an Admin open any estimate. | (1) **Security surface:** a fourth route now holds the Lead's Restricted costs view (including the rates-changed count), and the allow-list had to grow to admit it. The tree component is typed to receive `figures` it must never draw, and the only guards are weak (QLT-789-02). (2) **New failure mode:** a fault in the figures read (`'The calculation linked to the estimate could not be read.'`) or in the masters read now fails the whole cost-details page with a 500, where before only the row's own read could. (3) **Cost per view:** every press on a tree row is a full navigation that repeats the pipeline, and the cost-details service already reads the nodes once (cross-reference for reviewer-performance). | `const tree = await getEstimateService().getTree(viewer, workspace.estimateId);` and pass `tree`. In `cost-tree.tsx` type the rows as `PartView` (`PartsTree`) and draw `node.label`. **Revert** the security test list to its three entries. **Test that catches it:** the security test with three entries (a page that asks `getEstimateReviewService` again fails); `cost-details-tree.test.ts` builds `PartView` fixtures (the type then has no `figures` to leak); an assertion in `cost-details-page.test.ts` that SCR-07 makes no `getCosts` call. **When:** this PR (about ten lines plus tests). Not a Blocker or Critical, so it does not trigger the §9 item 2 stop; if it is deferred, master should record it and a `tech-debt` issue should be filed |
| QLT-789-02 | Minor | `tests/e2e/cost-details.spec.ts:225`; `tests/unit/cost-details-tree.test.ts:20` | §6 test adequacy (assertions that can fail) | **The "no figure in the tree" guards cannot catch a figure.** The E2E asserts `not.toContainText('₹')`, but `formatFigure`, the function SCR-06's tree uses for a row's BG, writes `1,23,456.78` with no `₹` (`money.ts:48-54`). Every unit fixture has `figures: null`, so a `CostTree` that drew `node.figures.unitPrice` would pass both. | The NFR-002-adjacent promise "names and kinds, no figure" rests on assertions that cannot fail for the likely regression | E2E: take the tree's text without its Sl. No cells (a Sl. No such as `1.10` would match a figure pattern) and assert no figure: `expect(await tree.evaluate((n) => { const c = n.cloneNode(true) as Element; c.querySelectorAll('[data-sl-no]').forEach((e) => e.remove()); return c.textContent; })).not.toMatch(/\d\.\d{2}/)`. Unit: one fixture with `figures: { unitPrice: '1234.56', … }`, asserting `1,234.56` is absent. After QLT-789-01 the type removes the risk, but keep the E2E check |
| QLT-789-03 | Minor | `src/components/shared/page-head.tsx:62` (with `change-customer-button.tsx`, `first-open-failure.tsx:21`) | HTML validity; a11y | **SCR-06's meta line is a `<p>` that can hold a `<div>`.** `PageHead` wraps `description` in `<p>`. On SCR-06 the description is `MetaLine`, which holds `ChangeCustomerButton`. When the dialog's first load fails, that button draws `FirstOpenFailure`, a `<div role="alert">`, inside the `<p>`. | It appears only on the client, so there is no hydration mismatch, but it is invalid nesting: React logs a nesting error in development, and validators and some assistive technology handle it oddly. `PageHead` is shared, so any later node in a description inherits the problem | Render the description in a `<div className="text-ink-2">` (or `as` a `div` when it is not a string). **Test:** `page-head.test.ts`, a node description is not inside a `p` |
| QLT-789-04 | Minor | `src/components/features/cost-details/cost-tree.tsx:51`; `cost-details.tsx` (`TREE_COLUMN_LAYOUT`) | UX, SCR-07 "Responsive" (phone: the stages are the content) | **Below 1024 px the SCR-07 tree is open and comes first.** It follows DEF-108's ruling for SCR-06 (a foldable panel at 360 and 768 px), and `open` is needed from 1024 px because the `::details-content` fallback relies on it. But on SCR-07 the tree is navigation, not content. A Lead on a phone scrolls past every row (44 px each, hundreds in a large estimate) before reaching the row's stages. | Reading cost details on a phone or tablet gets much slower as the estimate grows | Keep `open`, but put the tree after the content below 1024 px: `max-[1023px]:order-last` on the panel (the grid order from 1024 px is unchanged). Or ask the ux-expert for SCR-07's rule. **Test:** at 360 px the row heading's top is above the tree's top |
| QLT-789-05 | Info | `src/components/features/cost-details/cost-details.tsx:98-99` | robustness | The box's dollar and euro figures are the **first line whose unit is `$` / `€`**, not BJ and BK by their system keys. This is correct today: only the seeded `unit-price-usd` and `unit-price-eur` carry those units, and fields an Admin inserts get `displayUnit: null` (`field-insert.ts:177`, `:204`). | A later seeded field with `$` before BJ would put another figure in the sentence, labelled with its own letter | Optional: add `unitPriceUsd` and `unitPriceEur` to `NodeCostsView.letters` with `findSystemField` (as `letters.unitPrice` is built, `cost-details-service.ts:115`) and find the lines by letter |
| QLT-789-06 | Info | `src/components/shared/page-head.tsx:37-55` | a11y pattern | The breadcrumb is a `nav` of `span`s, not an ordered list. It is labelled, the current step has `aria-current="page"`, and the separators are `aria-hidden`, so it is usable. The common pattern (`ol` / `li`) also announces "list, 3 items". | Minor polish | Optional: `<ol>` / `<li>` with the same classes |
| SEC-789-01 | Info | as in "Checks Run" | NFR-002, brief points 1 and 3 | **No rate, calculated figure or formula reaches an Engineer.** SCR-07 is unreachable to an Engineer, by the page guard and the service guard, both unchanged and pinned. The tree's data does not cross a client boundary, so the RSC payload holds only drawn names, kinds and links. SCR-05's head draws the title, the form sentence, the status, the download marker and the due date. SCR-06's meta line (Lead and Admin) holds names. The Engineer's workspace folder still names nothing of the rates-changed count (security test green). | none | none |
| SEC-789-02 | Info | `tests/security/rates-changed-restricted.test.ts:61` | brief point 2 | The list change keeps the assertion as strict as it was (exact equality). The title's "the manifest holds no Engineer row for any of them" is a claim, not an assertion in this file; `role-matrix.test.ts` covers it. Becomes moot if QLT-789-01 reverts the list. | none | Optional: in this test, look up each asker's manifest row and assert `ENGINEER` is not in its roles |

## Security notes (the §9 item 2 focus: the brief's six points)

| Check | Result | Evidence |
|-------|--------|----------|
| 1. No rate, figure or formula reaches an Engineer through the tree column or the shared head (DOM, RSC payload, client fetch) | **Yes** | SEC-789-01. No client fetch is added: `CostTree` and `PageHead` have no script, and `CopyPathButton` copies a path the page already had |
| 2. The security list change keeps the restriction as strict | **Yes** (as strict); **unnecessary** (QLT-789-01) | Exact equality kept. The new entry is needed only because of the `getCosts` call |
| 3. Authorisation on SCR-07 unchanged | **Yes** | Manifest row, `authorizePage` first, service role check; AC-8 unit test and role matrix green |
| 4. The tree: names and kinds only; 320 px; sticky from 1024 px; open row marked; links only to cost details the user may see | **Yes** (QLT-789-02 for the guards; QLT-789-04 for the phone order) | `cost-tree.tsx`; E2E width equals `--tree-w`; one `aria-current`. Every link is a row of this estimate, and the target page re-authorises |
| 5. Quality, and Change customer 44 px on touch, 36 px with a fine pointer from 1024 px | **Yes** for the size; quality findings above | `h-(--control-h)` then `fine-wide:h-(--control-h-row)`; E2E at three widths |
| 6. Stage 11b `/estimates/[code]` against 192,500 B | **No: 192,813 B, 313 B over** (QLT-789-07, a merge stop under DL-424) | Run 45818583228, Stage 11b job 139904623639 |

## Reviewer-specific tables

### Acceptance conformance (DEF-095, DEF-110, DEF-113 → code → test)

| Criterion | Code | Test(s) | Status |
|-----------|------|---------|--------|
| DEF-095 SCR-05: breadcrumb "My tasks / code", h1 "Estimate code" with the status badge, title and form sentence under it, due pill | `workspace-header.tsx` (`PageHead`, `review` absent); `part-fields.tsx` (the form's intro line removed) | `page-head.test.ts`; E2E `estimate-customer.spec.ts` (crumbs, h1, sentence, due) | Met |
| DEF-110 SCR-06: breadcrumb "Task queue / code", one meta line (title, subject, customer with Change customer, entered by, assigned by), due pill, Open folder, Copy path; the customer and folder cards removed; notes kept | `workspace-header.tsx` (`MetaLine`, `NotesCard`, `CopyPathButton`); `estimate-review.tsx` (`review`, `inline`) | E2E `estimate-review.spec.ts`, `estimate-customer.spec.ts` | Met (QLT-789-03) |
| DEF-113 SCR-07: breadcrumb, description, row heading "Cost details for one row / Sl. No · name", the box "This row, on screen and in the Excel row", the parts tree column | `cost-details.tsx`, `cost-tree.tsx`, `cost-details-texts.ts`, page | `cost-details-head.test.ts`, `cost-details-tree.test.ts`, `cost-details-screen.test.ts`; E2E `cost-details.spec.ts` | Met (QLT-789-01, -02, -04) |
| No cost data on the Engineer view (DEF-113 proof line) | as SEC-789-01 | security tests; AC-8 | Met |
| First load stated if the estimate page changes | Stage 11b | run 45818583228 | **Not met**: 192,813 B is over the 192,500 B ceiling (QLT-789-07) |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-789-07 | `workspace-header.tsx` (client via `estimate-workspace.tsx`) | Stage 11b `/estimates/[code]` at most 192,500 B |
| QLT-789-01 | page `:41-42`; `cost-tree.tsx`; security test `:63` | security list of 3; `PartView` fixtures; page unit asserts no `getCosts` call |
| QLT-789-02 | `cost-details.spec.ts:225`; `cost-details-tree.test.ts:20` | E2E: tree text without the Sl. No cells has no `\d\.\d{2}`; unit fixture with figures |
| QLT-789-03 | `page-head.tsx:62` | `page-head.test.ts`: a node description is not in a `p` |
| QLT-789-04 | `cost-tree.tsx:51` | E2E at 360 px: the row heading is above the tree |
| QLT-789-05, -06, SEC-789-01, -02 | as listed | n/a or optional |

## Issues for other roles

- **developer:** **QLT-789-07 first** (move SCR-06's head out of the client `WorkspaceHeader`; Stage 11b at most 192,500 B), then QLT-789-01 (swap to `getTree`, revert the list), both in this PR. QLT-789-02 and QLT-789-03 are each a few lines. QLT-789-04 is one class, or wait for the ux-expert.
- **ux-expert:** the SCR-07 tree below 1024 px: after the stages, or folded (QLT-789-04)?
- **reviewer-performance:** after this PR, SCR-07 runs the costs pipeline on every row view (QLT-789-01 (3)); it goes away if the developer takes the fix.
- **master and product-manager:** if QLT-789-07 is not trimmed, the 192,813 B figure comes to you before the squash (DL-424 (3)). If QLT-789-01 is not fixed before merge, record the deferral and file a `tech-debt` issue.
- **orchestrator:** do not squash at 192,813 B (DL-424 (3)).

## Update at 3464c629 (before publishing; the verdict is given at this head)

Lane 3 moved the head while this review was being written: `0d3db28f` ("trim the estimate page's first load: copy-only FolderPath, server-only head words"), then a merge of `master` (`3464c629`). The merge brings only master's tree and delete-part files and their tests. The run of record is 45823230341.

| Check | Result |
|-------|--------|
| What `0d3db28f` changes | `CopyPathButton` and the `useCopyPath` hook are removed. `FolderPath` gains `copyOnly` (a button plus a status message), and SCR-06 uses it. `OPEN_FOLDER_LABEL` and `SUBJECT_META_PREFIX` move from `estimate-texts.ts` to the new `workspace-head-texts.ts`. `FORM_NO_PART` now reads "Add main assembly", **the same as `master`**: the branch had the older words, so this aligns it and is not a scope change. No `CopyPathButton` reference is left in `src` or `tests` |
| Can the "server-only" texts file reach the client bundle in a way that breaks? | **It cannot break:** it is a plain module of two string constants with no `server-only` import, so it builds in either graph. **But it is not server-only:** its one importer, `workspace-header.tsx`, is still imported by the client `estimate-workspace.tsx`, so the two words ship in the route's client JavaScript just as before. Its comment ("so they cost the first load of the estimate page nothing") is not right. If someone later adds `import 'server-only'` to it as the name suggests, the client build fails. The root cause of QLT-789-07 (SCR-06's head branch in a client module) is unchanged; the commit trims the bytes around it |
| Cost-visibility findings | **Hold unchanged.** Neither commit touches the SCR-07 page, `cost-details/`, `cost-tree.tsx`, `page-head.tsx`, the review service or the security test, so SEC-789-01, SEC-789-02 and QLT-789-01 to QLT-789-06 stand as written |
| Unit and security tests at `3464c629` (worktree `aqp-402`, read-only, `git status` clean) | The 7 files above: **546 passed**. Plus every unit or security file that names `FolderPath`, `folder-path`, `WorkspaceHeader` or `workspace-header` (10 files): **340 passed** |
| CI and Stage 11b | Run 45823230341 at `3464c629`: **Stages 1 to 11b success**; the E2E shards were still running when this review was published (they cannot change the verdict). **Stage 11b (job 139920619176): `PASS /estimates/[code] gzip 192,793 (192.8 KB) limit 200,000 headroom 7,207`**: the trim saved **20 B**. The route is still **293 B over the DL-424 ceiling**, and **+750 B** against current `master` (192,043 B, push run 45820387977, Stage 11b job 139910811489). `/estimates/[code]/costs/[slNo]` 168,611 B, `/sign-in` 165,519 B and `/account` 171,308 B are inside the 190,000 B floor. **QLT-789-07 is not fixed: Critical, merge stop under DL-424 (3)** |

**New finding at 3464c629**

| ID | Severity | File:line | Issue | Why | Fix |
|----|----------|-----------|-------|-----|-----|
| QLT-789-08 | Minor | `src/components/shared/folder-path.tsx:55-64` | **In `copyOnly` mode the copy result is invisible.** The status message is `sr-only`, and the removed `CopyPathButton`'s "Copied" label went with it. The full `FolderPath` shows the same message as visible text (`:85`). | On SCR-06 a sighted Lead who presses Copy path sees nothing, on success or on failure ("Path could not be copied" is read only by a screen reader), and may paste an old clipboard | Make the message visible: `<span role="status" className="text-label font-semibold text-ink">` in place of `sr-only` (no measurable bytes). **Test:** a unit test of `copyOnly`, where the message element has no `sr-only` class |
| QLT-789-09 | Info | `src/components/features/estimate-workspace/workspace-head-texts.ts:1-3` | The file's comment says the words "cost the first load of the estimate page nothing", but they still ship (see above). | Misleading for whoever trims next | Correct the comment, or move the words with SCR-06's head into the review folder (QLT-789-07's fix), which makes it true |

## Previous Findings (re-review only)

n/a (round 1).

## Round 2 (re-review of `3464c629..6f32bbda`, 2026-11-26) — APPROVE WITH COMMENTS

Scope: `6c26cf19` (the review findings), `e99a7571` (copy-only failure shows the path; figure-free guard for `folder-path`), `4ed75beb` (SCR-05's cards as a server module), `a1f093dd` and `6f32bbda` (tests only), and two merges of `master`. PR review [6076490159](https://github.com/sankumar76/Accucut-Quotation/pull/789#pullrequestreview-6076490159); a reply in each of the nine round-1 threads; label `review:quality-approved`.

**Checks run.**
- CI run **45841422295** at `6f32bbda`: all 6 jobs green.
- Nightly 45841422280: its only failure is "CI feedback time", a timing metric that also failed on `026352fe`; not code.
- 23 test files at `026352fe` in a temporary scratchpad worktree, since removed: **975 passed** (architecture, security, cost-details, page-head, review-head, part-fields). The developer worktree `aqp-402` had moved to another lane's branch, so a run there was discarded.
- The later commits `e99a7571` to `6f32bbda` are covered by the CI run of record.

| Finding | Round-2 status | Evidence |
|---------|----------------|----------|
| QLT-789-07 (Critical) | **Fixed** | SCR-06's head is `estimate-review/review-head.tsx` with `review-head-texts.ts`, and SCR-05's cards are `estimate-workspace/task-cards.tsx`. All three start with `import 'server-only'`, and their importers are server modules: `TaskCards` is drawn by the page and handed to the client workspace as an element. `WorkspaceHeader` is SCR-05's head alone. **Stage 11b, job 139983784630: `/estimates/[code]` 192,008 B**, 492 B under the DL-424 ceiling and **−154 B against master** (192,162 B both at the merge base `a6eb9809`, run 45832168454, and at `5a496d16`, run 45842343024; the one later master commit, #795, touches only queue files). With #791's about +150 B the route would be about 192,160 B |
| QLT-789-01 (Major) | **Fixed** | `getEstimateService().getTree`; `CostTree` is typed on `CostTreeNode` (`id`, `parentId`, `slNo`, `nodeKind`, `label`), which has no figures. The security list is back to three entries with exact equality |
| QLT-789-02 | **Fixed** | The E2E strips the `[data-sl-no]` cells and asserts no `\d\.\d{2}` (and no `₹`). A unit fixture with figures asserts none is drawn |
| QLT-789-03 | **Fixed** | The description is a `div` (`data-page-head-description`) |
| QLT-789-04 | **Fixed** | `max-[1023px]:order-last`. The E2E below 1024 px asserts the stages start above the tree |
| QLT-789-05 | Info, **accepted** | The seeded units only, as reasoned |
| QLT-789-06, SEC-789-01, SEC-789-02 | Info, stand | — |
| QLT-789-08 | **Fixed** | The message is visible text |
| QLT-789-09 | **Fixed** | `workspace-head-texts.ts` is removed; `review-head-texts.ts` is really server-only |
| QLT-789-10 (found in round 2, before posting; fixed in `e99a7571`) | **Fixed** | A failed copy in copy-only mode said "Select it" with no path on the page. `copyMessage` now adds the path (unit-tested). The path is the same folder path the Engineer sees on SCR-05, not Restricted |

**Round-2 notes**

| ID | Severity | File:line | Note |
|----|----------|-----------|------|
| QLT-789-11 | Info (accepted) | `tests/unit/estimate-review-architecture.test.ts:122` | **The new exception (`folder-path.tsx`) is narrow and justified, and does not weaken the rule.** It names one file, and any other client file the review folder imports still fails. The file is figure-free (imports `lucide-react`, React, `Button`, `cn` and shared helpers) and is already in the route's client bundle through SCR-05. `e99a7571` pins it, and `folder-path-texts.ts`, against schema, review, `@/server/`, calculation, figure-state, `estimates-client` and `fetch(`, as the nine sibling exceptions are pinned |
| QLT-789-12 | Info (accepted) | `tests/e2e/estimate-save.spec.ts:316` | The two-tab axe check now runs from the top of the page. Filling Length centred the field, leaving a parts-tree button half behind the sticky top bar at 768 px, which axe's target-size reads as small. The rules and the page are unchanged, and the 44 px cases still assert the buttons' size, so what is checked is not loosened |

**Master merge.** `part-fields.tsx` keeps master's `PartHead` and `PartProgress` and drops only the form's `FORM_INTRO` line, which DEF-095 moved into the head's description. The sentence appears once.

**Open after round 2:** Blocker 0, Critical 0, Major 0, Minor 0, Info 5 (QLT-789-05, -06, -11, -12; SEC-789-01, -02 count as notes). **Verdict at `6f32bbda`: APPROVE WITH COMMENTS.** DL-422: +0.

## Hand-off
- Status: COMPLETE
- GitHub: PR review [6074559283](https://github.com/sankumar76/Accucut-Quotation/pull/789#pullrequestreview-6074559283) (COMMENT, 9 inline comments, at `3464c629`); label `review:quality-changes-requested`
- Verdict at `3464c629`: REQUEST CHANGES, **merge stop** (Blocker 0, Critical 1, Major 1, Minor 4, Info 5). QLT-789-07: 192,793 B is still 293 B over the DL-424 ceiling, and must be trimmed (move SCR-06's head out of the client `WorkspaceHeader`) or decided by master and the product-manager before the squash. NFR-002 holds.
- Recommended next agent: developer (QLT-789-07, QLT-789-01, then -02, -03, -04), then a short re-review of the new diff, then orchestrator: merge on fully green CI with Stage 11b at most 192,500 B, by the end of Wed 2 Dec.
- **Round 2 (`6f32bbda`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 0, Info 5). Every round-1 finding is fixed or accepted. `/estimates/[code]` is 192,008 B (−154 B against master). Next: orchestrator merges on fully green CI, re-reading Stage 11b after updating the branch (DL-424).
