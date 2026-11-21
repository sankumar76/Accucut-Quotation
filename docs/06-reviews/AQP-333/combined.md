# Combined security-and-quality review: AQP-333 (STORY-07.03 "One total and the total Tool Cost")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/504 |
| Head reviewed | `5b30de46` on `feat/AQP-333-export-totals`. Merge base `230bd77a` (#487, 07.02). `master` is still at `230bd77a` (GitHub compare: 0 commits ahead), so the branch is not behind today |
| CI | Run 44363654526 on `5b30de46`: **all 6 checks green** ("Stages 1 to 11", "Stages 1 to 11b", E2E shards 1 to 4). The E2E shards include the new `export-totals.spec.ts` and the extended canary positive control at 360, 768 and 1366 |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`: the file now holds cost figures (BL2, BN2, the total Tool Cost) and the approved price (BO2). NFR-002, NFR-026, NFR-027, FR-069, FR-103, FR-107, FR-108; architecture §4.6 and §4.10 |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-18 |
| **Verdict** | **APPROVE WITH COMMENTS.** There is no Blocker, Critical or Major finding. Each focus point of the brief holds. Two Minors go to a follow-up issue, and four Info notes go to other roles |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 2 · Info 5 |

## How I read it

- **The whole diff**, `git diff 230bd77a...5b30de46`: 26 files, +1,717 / −50, and the PR body (Dev Record, decisions 1 to 7, flags (a) to (c)).
- **Product files at the head, in full:**
  - Export: `product-cells.ts` (new), `summary-figures.ts` (new), `export-model.ts`, `build-workbook.ts` (`writeFooter`, `writable`), `rows.ts`.
  - Service and data: `export-service.ts`, `composition.ts`, and the `findExportFigures` change in `calculation-repository.ts` (`productValues` parsed by the strict `productValuesSchema`).
  - View: `views/schemas/export.ts`.
  - SCR-10: `estimate-export.tsx` and `export-texts.ts`.
- **Callers and callees:**
  - `approval-repository.ts` `findLatestApproval`: latest row by `approvedAt desc, id desc`, and `null` when that row's `removedAt` is set.
  - `lib/estimate/figure-state.ts`; the summary route and `export/page.tsx`; `with-route.ts` (`no-store`).
  - `lib/money.ts` (`toTwoPlaces`, `formatFigure`, `formatRupees`).
  - `lib/fields/types.ts` and `document-rules.ts` (system roles and their kinds).
  - The seed registry `prisma/seed/config/seed-config.ts:207-217`.
  - `estimate-review-service.ts:94`, which also requires the BN key.
- **Requirements:**
  - Jira AQP-333: AC-1 to AC-9 and the Dev Context.
  - SPEC §10 (line 456), §14.12 and §18 D-05, D-16, D-29.
  - PRD FR-069, FR-075, NFR-002 and NFR-010.
  - Architecture §4.5 (role table), §4.6, §4.10 and §6 "Export summary".
  - UX spec SCR-10 "Layout".
  - The predecessor reviews `docs/06-reviews/AQP-332/combined.md` and `docs/06-reviews/AQP-326/combined.md` (SQR-01).
- **Tests run locally** in the read-only worktree at `5b30de46` (`npx vitest run tests/unit/export tests/unit/export-service.test.ts tests/unit/export-route.test.ts tests/unit/export-screen.test.ts tests/unit/estimate-review-architecture.test.ts tests/security/engineer-import-rule.test.ts --maxWorkers=1`): **17 of 17 files and 1,608 of 1,608 tests passed** (145 s).
- **Not run locally:** the PostgreSQL integration and acceptance tests, and Playwright, because the PC is short of memory (§9 item 5). For those I rely on CI run 44363654526 (above). I read every one of those test files in full.

## Security and data-integrity scope: results

| # | Check | Result |
|---|---|---|
| 1a | **NFR-002: the Engineer gets no cost from the file, the summary or the screen** | **Verified.** Both export routes and the page are still `ADMIN_AND_LEAD`, and `withRoute` / `authorizePage` refuse before anything is read. `assertMayExport` is still the first line of `getSummary` and `getFile`, and it is closed by `assertNever`. The summary's new `figures` are behind the same refusal. Tests: the unit "refuses an Engineer before anything is read" now also asserts `findLatestApproval` is not called; integration AC-8 "an Engineer, who owns the estimate, is refused the summary and the file"; the canary Engineer journey (403, no `PK`, no attachment, on `export` and `export-summary`); and `engineer-import-rule` (passed locally) |
| 1b | **The canary Lead positive control truly finds BL2, BN2 and the footer inside the file** (`canary-scan.spec.ts:650-663`) | **Verified, and not trivial.** It reads `product_values` from the database and asserts that the inflated sheet XML holds `<c r="BL2" …><v>{BL}</v></c>` and `<c r="BM4" …><v>{total Tool Cost}</v></c>`, plus the label. It also asserts either `BN2` with the stored BN, or (with no Tool Cost) no `<v>` in BN2. The figures are matched as cell values at fixed addresses, so the check fails if the totals were left out, put in the wrong cell, or the file was not inflated. This adds to the 07.02 scan control, which is unchanged |
| 2 | **AC-5: the approval reason never reaches the file; the screen renders it safely** | **Verified.** `product-cells.ts` is given only `approvedPrice` and `cancel`; `ProductFigures` has no reason field. The reason reaches only the summary JSON (Lead/Admin), where it is a `z.string().nullable()` in a strict object. On SCR-10 it is a React text child (`boReasonGiven(reason)`), and the export folder has no `dangerouslySetInnerHTML`. Tests: unit (the model JSON does not contain the reason); integration AC-5 (every XML part of a real approved file, one sheet, no cell notes); screen test `<img src=x onerror=alert(1)>` renders as text; a 500-character unbroken reason wraps (`[overflow-wrap:anywhere]`) |
| 3 | **AC-2: totals equal SCR-06 to the paisa; divide by zero gives an empty cell** | **Verified.** BL2, BN2 and the footer are `calculations.product_values`, read in the same `findExportFigures` call as the rows, so they are the very values SCR-06 shows. Integration compares the file with `review.getCosts` for CE-1 (30), CE-2 A (840), CE-3 (5, two top-level items) and CE-12 D (1000), and "at full precision" with the real rates (equal as a double and at two decimals; BG column = BL2 at two decimals). A `null` BN is `null` in the model, and the cell is empty. Integration AC-6 asserts this, and that the sheet XML has no `Infinity`, `NaN` or `#DIV`. A non-decimal stored figure throws a fixed error, and the place is given back (unit) |
| 4 | **AC-4: BO2 after approve, unlock, cancel and removal** | **Verified, through `findLatestApproval` only** (architecture §4.10, v0.52 ruling). `approvedPriceOf` returns `null` for no row, and for a cancelled row. `findLatestApproval` already returns `null` for a removed latest row, and no earlier row stands in for it. An unlocked row keeps its price. Both `getFile` and `getSummary` use the same `approvedPriceOf`, so the page and the file cannot disagree. Integration tests cover approve (29.99), unlock (29.99), cancel (empty), removal (empty), never approved (empty), and "the latest row wins" (an earlier unlocked 29.99 does not come back after a later 777.77 is cancelled and removed; neither figure is in any XML part). The summary is also tested: its approval is `null` after a cancel, and the 600.00 price is not in the JSON |
| 5 | **The strict schema** | **Verified.** `exportFiguresSchema` and every nested object are `z.strictObject`. Figures are `^-?\d+(\.\d+)?$` text, cell addresses are `^[A-Z]{1,10}[0-9]+$`, and `state` is an enum. The approval exposes no approver, unlocker, canceller or Engineer name, although `ApprovalRecord` carries them. The route's `output` is the same schema |
| 6 | **Formula injection stays impossible** | **Verified.** `ExportCell` is still `string \| number \| null`, and `cellSchema` is the same union. The footer holds one constant label (written as a string, `@` format) and one number. Row-2 cells are numbers from `numberOf` (decimal regex). `build-workbook.test.ts` adds a footer label that starts like a formula (stays text) and a non-finite footer number (refused). The model schema refuses a footer on a node row or on the header |
| 7 | **Figures only through `figure-state`** | **Verified.** The one `findExportFigures(` call is inside `figuresOf` → `readFiguresWhenCurrent`, which is shared by both methods. `estimate-review-architecture.test.ts` still requires exactly one call, and it passed locally. In `getSummary`, `none` and `out-of-date` read no figures, no approval and no `byId`; the unit test checks this with spies. BO is deliberately not behind the figure state (it is not a calculated figure), as §4.10 and the approval repository both say |
| 8 | **Tests are not weakened** | **Verified.** The three 07.02 row-count assertions (`export.spec.ts:66`, `layout.test.ts:89`, `rows-and-pictures.test.ts:133,170`) each go up by exactly 1 for the footer, with a comment. `integration/export/totals.test.ts` pins the footer's place separately: the row is empty between, and the last row is the footer. The 07.01 test "reads no calculated figure" now says "reads no picture bytes", because AC-8 requires the summary to read figures while current. Its old guarantee (no figure in other states) is now a stricter `it.each` over `none` and `out-of-date`. #478 SQR-01 is properly closed: `exportCellsOf` builds the real file through the export service and reads every cell back. It is part of `approvedValuesOf`, so every equality in `aqp-approved-immutable.test.ts` now compares the file. The new "EXPORT" test proves the file is not a constant (5 rows, the header, BL2 = SCR-06's total, BO2 = 4321.5, the footer label and value) |

## AC conformance

| AC | Code | Test(s) | Result |
|---|---|---|---|
| AC-1 BL2, BN2, BO2 once in row 2, following their columns; no per-item totals | `product-cells.ts` `productLetters` (roles `total`, `approved-price`; key `price-per-tool-cost`), `withProductCells` (row index 0 only) | `product-cells.test.ts` (incl. letters move); `export-service.test.ts`; integration AC-1 (BL/BN/BO empty on rows 3-4; only the footer below the parts); e2e | **Met.** The AC text names `unit-price` for BL. That is a slip (see SQR-03 and flag (a)) |
| AC-2 BG column adds up to BL2 (CE-1 30, CE-2 840, CE-12 D 1000, two top-level items) | stored `product_values` via `findExportFigures` | integration AC-2 (four cases through the real chain, equal to `getCosts`); full-precision case | **Met** |
| AC-3 Footer at `lastNodeRow + 2`, label to the left; no BM replaced; BN2 = 6 (CE-7); no Tool Cost → 0 and empty BN2 | `footerOf`, `ExportFooter` + schema refinement, `writeFooter` | `product-cells.test.ts`; `build-workbook.test.ts`; integration AC-3 (CE-7 row 6 = 5; 10 parts → row 13, row 12 empty; CE-1 → 0, BN2 empty) | **Met** |
| AC-4 BO2: approved, after unlock, after cancel, after removal | `approvedPriceOf`; `approvals.findLatestApproval` in both methods | unit, integration AC-4 (five cases incl. latest row wins) | **Met** |
| AC-5 Reason in no cell and no sheet | the reason is never passed to the model | unit (model JSON); integration AC-5 (every XML part, one sheet, no notes) | **Met** |
| AC-6 Numbers at full precision, 2-decimal format; `null` empty | `figureCell` / `numberOf`; registry `numFmt` | `product-cells.test.ts`; integration AC-6 (number type, `toBe(Number(stored))`, `0.00`; BN2 null, no Infinity/NaN) | **Met** |
| AC-7 Approved file identical after a master change | `exportCellsOf` in `approvedValuesOf` | `aqp-approved-immutable.test.ts` (every equality plus "EXPORT") | **Met** (and #478 SQR-01 closed) |
| AC-8 Summary: name, counts, state, approved price's difference and reason, per row H / BG / BM as the file holds them, total Tool Cost, reconciliation; only while current; strict; Lead/Admin | `summary-figures.ts` (read back from the file's own cells), `getSummary`, `exportSummarySchema` (`state`, `figures`) | `export-service.test.ts` (state cases, figures, reconciliation incl. the "lines as shown" case, approval/unlock/cancel); integration AC-8 (equal to the file's cells; Lead and Admin; out-of-date; Engineer 403); `export-route.test.ts`; e2e | **Met** (performance note SQR-02) |
| AC-9 SCR-10 cards and the final row "BG column added up: BL2, the same as the total on screen" | `estimate-export.tsx` (`FigureRowsCard`, `HowCard`, `HoldsCard`, `ApprovalLines`), `export-texts.ts` | `export-screen.test.ts`; e2e (page figures equal the downloaded file's cells; no overflow; axe; never-calculated shows no figure and no ₹) | **Met.** The order follows UX spec SCR-10 "Layout" (the Total Tool Cost row comes after the sum row) |

## Findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| SQR-01 | Minor | `src/app/api/v1/estimates/[id]/export-summary/route.ts:9`; `src/app/(portal)/estimates/[code]/export/page.tsx:24`; `src/components/features/estimate-export/estimate-export.tsx:68` | **Three doc comments still say the summary "holds no figure".** Since this PR it holds BL2, BN2, BO2, each row's BG and BM, and the approval reason (while current). On a Restricted surface, a comment that states the old safety property misleads the next reviewer or developer. For example, it suggests the page would be harmless if the manifest row were widened. `estimate-export.tsx:68` now contradicts its own next paragraph (`:71`). | Reword all three: "holds the file's figures (`figures`) only while the calculation is current, for the Lead and the Admin only; `null` otherwise". No test needed (comment only); the role tests already pin the restriction. |
| SQR-02 | Minor (performance note; for reviewer-performance) | `src/server/services/export-service.ts:137-156` | **Flag (b): every SCR-10 view now does the work of a file without the workbook.** While current, `getSummary` runs 7 queries in 4 sequential steps: header; basis; then `byId`, `listNodes`, `findExportFigures` and `findLatestApproval` in parallel; then `findMimes`. Before this PR it ran 4. `findExportFigures` reads every row's `inputs` and `outputs` JSON and the whole `masterSnapshot`, and parses them with zod. Then `exportRowsOf` builds every cell (up to 2,000 × 67), on the **event loop**: ADR-012 moved only the workbook build to a thread. Lead/Admin traffic is small, and the cost is bounded by the 2,000-part limit. But it is unmeasured against NFR-010's PROPOSED "page-data requests within 500 ms at 25 concurrent users". NFR-011 says 500 nodes, while validation allows 2,000. The design choice is right: the summary reads its figures back from the very cells the file holds, so the page cannot say what the file does not. That choice should be kept. | In the hardening window, time `getSummary` at 500 and 2,000 parts (no pictures; main-thread CPU and wall time). If it exceeds the budget, keep one derivation but make it cheaper: (i) a `findExportFigures` variant that skips `masterSnapshot` when the summary does not need materials, and parse only the H, BG and BM values; or (ii) have `exportRowsOf` take an optional column filter. Either way, keep `readFiguresWhenCurrent` and the "read back from the cells" rule. Test: a perf test like `tests/perf/export-memory.test.ts`, with a recorded figure. |
| SQR-03 | Info | Jira AQP-333 AC-1 | **Flag (a): the developer's reading is correct, and the AC should be corrected.** The AC says BL2 goes "in the cells of the `unit-price`, BN and BO system fields". But `unit-price` is **BG** (row scope, `seed-config.ts:207`; architecture §4.5 role table: "`unit-price` (BG), `total` (BL)"). BL is the field with the `total` role and `scope: 'product'` (`seed-config.ts:213`; SPEC §10: "BL2 = Total Unit Production Price (§7.4 BL)"). Putting BL2 in the `unit-price` column would write it into BG2, the first part's own price. That would break AC-2 (the BG column would no longer add up to BL2) and D-16. The slip probably comes from BL's label, "Total **Unit Production Price**". The AC also calls BN a "system field", but BN has no system role. It is found by its key `price-per-tool-cost`, as `estimate-review-service.ts:94` does. | **scrum-master:** change AC-1 to "in the cells of the `total` (BL) and `approved-price` (BO) system fields and the `price-per-tool-cost` field (BN, found by key), so they follow their columns if letters move". No code change. |
| SQR-04 | Info | architecture §6 "Export summary" (line 985) and §4.6 (line 510) | **Flag (c), and one more.** (1) §6 describes the summary in prose but does not name `state` or `figures`, or the shape: `rows`, `totals`, `letters`, `cells`, `approval` with `earlier` and `approvedAt`, and `reconciliation` with `linesAsShown` and `matches`. It also lists "the quantity warnings with who went ahead and when", which this story leaves to 07.06 (Jira: "Not in scope … the warning notice (07.06)"). (2) §4.6 says "the state is read in the same repeatable-read transaction that builds the file". Since 07.02, the reads are separate statements, and 07.03 adds the approval read. The effect is benign: the calculation record is immutable, an approved estimate's inputs are locked, and a cancel or removal that commits during a download gives a file that is correct for one side of that instant. Still, the text promises more than the code does. | **solution-architect:** in §6, name `state` (`none` / `current` / `out-of-date`) and `figures` (`null` unless `current`) with its members, and mark the warnings as 07.06. In §4.6, either describe the separate reads and why they are safe, or record the transaction as a follow-up. |
| SQR-05 | Info | `src/server/export/summary-figures.ts:52`, `:96` | **SCR-10 rounds the file's double; SCR-06 rounds the stored decimal text.** For a stored figure within about 1e-12 of a half-paisa tie (for example `0.0049999999999999999`), `Number()` rounds to `0.005`. SCR-10 would then show 0.01, while SCR-06 shows 0.00. This is theoretical, and showing what the file holds is the right rule for this page. | None. Noted so that a future "SCR-10 ≠ SCR-06 by one paisa" report is recognised at once. |
| SQR-06 | Info | `src/server/export/product-cells.ts:29` and `src/components/features/estimate-export/export-texts.ts:58`; `product-cells.ts:63` and `summary-figures.ts:43` | **Small duplication.** The label "Total Tool Cost" is defined twice: once for the file's cell and once for the screen. If one changes, SCR-10's "What the file holds" no longer describes the file. The `required(field, what)` helper is also copied in two export files. | Optional: export the label and the helper once (for example from `product-cells.ts`), and let `summary-figures.ts` and the screen words use them. The e2e test already asserts the literal in both places. |
| SQR-07 | Info (praise) | whole change | **A careful change to the most sensitive file.** There is one module that decides row 2 and the footer, found by role and tested for moved letters. BO comes through the one shared reader, with "latest row wins" proved against PostgreSQL. The summary is read back from the model's cells, so the page and the file cannot drift. The footer's place is enforced by the model schema, not only by the writer. The reason is kept out of the file by construction (it is never passed), not by filtering. #478 SQR-01 is closed with a hook that can now fail. The CE cases are worked by hand and run through the real Calculate. | None |

## Test adequacy (would the tests fail?)

| Fault | Caught by |
|---|---|
| BL2/BN2/BO2 written on a row other than 2, or repeated | `product-cells.test.ts` AC-1; integration AC-1 (rows 3-4 empty; nothing between the parts and the footer) |
| A product cell found by a fixed letter | `product-cells.test.ts` "letters move" |
| BL2 not equal to SCR-06, or BG column ≠ BL2 | integration AC-2 (four CE cases + full precision vs `getCosts`) |
| Footer in the wrong row, on a node row, or replacing a part's BM | `product-cells.test.ts`, model schema refinement test, `build-workbook.test.ts`, integration AC-3 (row 13 for 10 parts; BM2..4 = 0, 2, 3) |
| A cancelled or removed price, or an earlier row's price, in BO2 | unit and integration AC-4 (including "latest row wins", with a scan of every XML part) |
| The reason in the file | unit (model JSON), integration AC-5 (every XML part, notes) |
| Infinity/NaN/`#DIV` instead of an empty cell | integration AC-6 |
| Figures in the summary while not current, or approval read then | unit `it.each` (`none`, `out-of-date`, spies) and integration out-of-date |
| An Engineer gets the summary's figures | unit, route, integration AC-8, `role-matrix`, canary Engineer journey |
| The file's totals missing while the scan still "passes" | canary positive control (BL2, BN2/empty, BM footer, label) |
| The page says a figure the file does not | e2e AC-9 (page figures equal the downloaded file's cells); integration AC-8 (summary equals the cells) |
| The reason rendered as markup, or overflowing | `export-screen.test.ts` |
| An approved file changes after a master change | `aqp-approved-immutable.test.ts` (whole-file equality, non-constant) |
| SCR-10 too slow at 2,000 parts | **Not tested** (SQR-02, follow-up) |

## Issues for other roles

- **scrum-master:** SQR-03. Correct the wording of AC-1 in Jira AQP-333. No code change.
- **solution-architect:** SQR-04. Add `state` and `figures` to architecture §6 "Export summary", and mark the warnings as 07.06. In §4.6, reconcile "the same repeatable-read transaction" with the separate reads. #478 SQR-03 (which names are live on an approved estimate) is still open: this story writes no customer-name cell in the file.
- **reviewer-performance (final review):** SQR-02. Time `getSummary` at 500 and 2,000 parts.
- **orchestrator:** follow-up issue for SQR-01 and SQR-02 (hardening window, §9 item 3). #478 stays open for SQR-02 and SQR-04 of that review, as the PR says. The branch is level with `master` today. A clean branch update before merge needs no re-review.

## Verdict

**APPROVE WITH COMMENTS.** The security and data-integrity scope of this critical story holds at `5b30de46`:

- **NFR-002:** the Engineer is refused first, on both routes and the page. The new figures sit behind the same refusal, and the Lead positive control proves BL2, BN2 and the footer are inside the file at their addresses.
- **AC-5:** the reason is never given to the file's builder. On SCR-10 it is plain React text that wraps.
- **AC-2 and AC-6:** the totals are SCR-06's stored values. A division by zero is an empty cell.
- **AC-4:** BO2 is right after approve, unlock, cancel and removal, through `findLatestApproval` alone.
- **The schema** is strict, and **formulas** stay impossible.
- **Tests:** none is weakened, and #478 SQR-01 is closed.

The two Minors, SQR-01 (stale comments) and SQR-02 (unmeasured summary cost), go to the follow-up issue. SQR-03 to SQR-07 are notes. On flag (a), the developer is right, and the AC wording should be corrected.
