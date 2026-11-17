> Copied from the scratchpad on the delivery lead's standing rule, 2026-11-16 (DL-226). Text unchanged from the reviewer's file.

# Combined security-and-quality review: AQP-331 (STORY-07.01 "Download the worksheet layout")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/441 |
| Head reviewed | `ec740bcde543a310cf27d0bfcee80dfbb5386721` (base `master` e808579) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`. This is the first Excel export: the file will carry costs, rates and formulas (NFR-002), and typed text must never become a formula (NFR-027, #394) |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-16 |
| **Verdict** | **APPROVE WITH COMMENTS.** No Blocker or Critical, so §9 item 2 allows the merge. The two Majors are raised as GitHub issues, and QS-01 is recommended for this PR |
| Counts | Blocker 0 · Critical 0 · Major 2 · Minor 3 · Info 6 |

## How I read it

- **The diff:** all 59 files (`git diff e808579..ec740bcd`) and the PR description, including "Points for the reviewer", Assumptions 1 to 6 and the Dev Record.
- **Full files at the head:**
  - Export code: `build-workbook.ts`, `export-model.ts`, `export-columns.ts`, `thread-protocol.ts`, `thread-runner.ts`, `src/worker/export-thread.ts`, `scripts/lib/export-worker-bundle.ts`, `scripts/build-export-worker.ts`.
  - Service and routes: `export-service.ts`, `export-repository.ts`, `views/schemas/export.ts`, both routes and the page.
  - Screen and client: `estimate-export.tsx`, `download-button.tsx`, `export-texts.ts`, `lib/export/download-client.ts`, `lib/export/file-name.ts`, `lib/time.ts`.
  - HTTP and wiring: `http/file-response.ts`, `with-route.ts` (the `download` path and `describeFailure`), `composition.ts`, `route-manifest.ts`.
  - Packaging: `scripts/package-windows.ps1` (`New-EsbuildBundle`) and `deploy/windows/services/AccucutApp.xml` (the working directory).
  - Canary and support: the canary-scan diff and `tests/e2e/support/canary-scan.ts` (how a body is read).
  - Library: ExcelJS 4.4.0 `lib/utils/utils.js` (`xmlEncode`).
- **Jira AQP-331:** AC-1 to AC-7, Dev Context and Testing notes.
- **Architecture v0.49:** §4.5 and line 490 (seed widths and formats, #30 item 1), §4.6 (export, worker thread, the "one at a time" gate, line 522), §7 NFR-011.
- **Records:** decision log DL-217 and risk register RISK-010.
- **GitHub:** #394, #431 and #440. `docs/06-reviews/AQP-320/combined.md` for format and continuity.
- **Tests I ran** (`vitest run` at the head): `tests/unit/export/*` (build-workbook, file-name, thread, thread-protocol), `export-route`, `export-service`, `export-page`, `export-screen`, `export-download-client`, `tests/security/engineer-import-rule` and `tests/security/role-matrix`. **11 of 11 files, 1,729 of 1,729 tests pass.** That includes the real thread run from a freshly made bundle, and the 2,000 × 67 build.
- **Probe** (scratch script in my scratchpad only, not in the PR): memory and time of N threads at once, through `createThreadBuilder` and the real bundle (QS-01).
- **Not run** (memory): Playwright, `next build` and Docker. CI run 43801805488 at the head: **all 6 required checks SUCCESS** (Stages 1 to 11, 1 to 11b, E2E shards 1 to 4), and Stage 13 Windows package SUCCESS (run 43801805499). PR is `clean`.

## Security scope: results

| # | Check | Result |
|---|---|---|
| 1a | Engineer on the two API routes | **Verified.** Both manifest rows are `ADMIN_AND_LEAD`. `withRoute` runs `allowsRole` before `params` is parsed (`with-route.ts:207-210`), so an Engineer gets the fixed 403 for a real, an unknown and a non-UUID ID alike. There is no status or timing oracle, because nothing is read. The service refuses again by name (`export-service.ts:52-62`, closed by `assertNever`) before `findHeader`. Route tests use repository spies to prove that nothing is read. |
| 1b | Engineer on the page | **Verified.** `authorizePage('/estimates/[code]/export')` is the first statement (`page.tsx:27`), before `params` is awaited. `metadata` is static. There is no `loading.tsx`, so no 200 is streamed before `forbidden()`. The page test asserts "no read is made". |
| 1c | Signed out | **Verified.** 401 from `requireUser`, and the page redirects to sign-in. Unit and e2e tests. |
| 1d | Canary scan | **Covers all three addresses.** In the Engineer journey after Calculate (`canary-scan.spec.ts:591-601`), both routes must be the fixed 403 with no `Content-Disposition` and no `PK` bytes, and the page must be 403. The xlsx MIME contains "xml", so `bodyIsReadable` reads such a body as text, and the `^PK` check is meaningful. **How the scan reads a zip:** it does not unzip. A workbook's parts are deflated, so a canary inside a file would be invisible to the text scan. Today this does not matter: the file has no figure, and an Engineer's 200 would fail on status and `PK` first. For 07.02, see QS-07. |
| 1e | Figures only through `figure-state.ts`, only when current | **Not applicable to 07.01, and confirmed.** The service reads the header (`code`, customer `name`), the current configuration and `listNodes` (inputs only, for the summary's name and typed count). No calculation record is read and no figure is in either answer. Refusal until a calculation is current is 07.04 (Assumption 3). Ordering risk for 07.02: see "Issues for other roles". |
| 1f | Restricted layering | **Verified.** `export-service` and `export-repository` are in the blocked lists of `engineer-import-rule.test.ts`. `schemas/export` has its own ESLint group with three spellings planted. `layer-rules.test.ts` has fault cases. ExcelJS is imported only by `build-workbook.ts`, which only the thread bundle and the tests reach (`thread-runner.ts` has a type-only import of the protocol), so ExcelJS never enters the Next.js server bundle. |
| 2a | Formula injection (#394) | **Verified.** `ExportCell` is `string \| number \| null`, so the model has no formula variant and the thread's strict schema refuses any extra key. A string is assigned as `cell.value = string`, which ExcelJS writes as a shared string (`t="s"`), never `<f>`. Tests: each of `= + - @` × 4 payloads, including `cmd\|' /C calc'!A0` and `=HYPERLINK(...)`, read back as `ValueType.String` with no formula, plus the XML-level checks "no `<f>`" and "`t="s"`". The Admin-typed header labels take the same path, with their own test. Tab and CR prefixes are safe, because they are plain strings (ExcelJS keeps 0x09 and 0x0D and drops other C0 controls), but they are **not tested** (QS-05). |
| 2b | Deliberate formulas only from configuration | **Not applicable yet, and confirmed.** The app writes no formula cell at all. Design note for later stories: QS-10. |
| 2c | Hyperlink or external-reference injection | **None.** No hyperlink object, no defined name, no external link part. `=HYPERLINK(...)` is stored as text (test). |
| 3a | Bundle built safely | **Verified.** The entry is the constant `src/worker/export-thread.ts`, bundled at build time by esbuild's JS API (no new dependency; esbuild is already in the lockfile). At run time the path is `join(process.cwd(), '.next', 'export-worker.mjs')`. No request value reaches it, there is no `eval`, and in production the folder is the service's own app folder (`AccucutApp.xml` `workingdirectory`). A person who can write there can already replace `server.js`. **Two different recipes** make the shipped file and the tested file: QS-03. |
| 3b | Memory and time bounded for 2,000 parts | **Time: yes.** A 120 s timeout terminates the thread. The 2,000 × 67 build takes 1.2 s in a thread (probe). **Memory: no.** There is no cap on threads at once and no `resourceLimits`, and each thread costs about 40 to 55 MB before it does any work. Probe: 10 header-only exports at once add 405 MB; 4 × 2,000 rows add 1,037 MB. See **QS-01 (Major, #442)**. |
| 3c | Errors leak nothing | **Verified.** The thread posts only `errorName`. The runner turns every failure into `ExportThreadError(reason)` with fixed words. `withRoute` logs only `errorName` and `errorCode`, and the body is the fixed 500 with the request ID. Tests plant "a secret typed by a person" and assert it is absent. Side effect: the reason is also lost from the log (QS-04). |
| 3d | Worker cleaned up | **Verified.** It is terminated after the message (success or failure) and on timeout. `error` and `exit` settle once (`settled` flag), the timer is cleared in `settle`, and the transferred buffer is a fresh, owned `Uint8Array` copy. A cancelled download does not stop its thread (QS-06, Info). |
| 4 | Response headers | **Verified.** `Content-Disposition: attachment; filename="…"` holds only `[A-Za-z0-9_-]` plus `.xlsx`, enforced three times: `file-name.ts` builds it that way and cleans the task code too, `exportFileSchema` uses a regex, and `fileResponse`'s `SAFE_FILE_NAME` throws. The browser re-checks the name before using it (`download-client.ts:24`). `Content-Type` is the `XLSX_MIME` literal. Other headers: `Cache-Control: private, no-store`, `nosniff`, `CSP: default-src 'none'; sandbox`, `CORP: same-origin`. Tests cover CR/LF, quotes, `filename=evil.exe` and emoji. |
| 5 | No master dump | **Verified.** `findHeader` selects exactly `t.code` and `c.name` by one estimate ID, through a strict zod row. The file is the header row only. The summary is counts, the file name, the first and last letter, and Sl. No, name and typed count per part, through `strictObject`. No rate, contact, material or other estimate. |
| 6 | `formatFigure` reused, no second formatter | **Verified.** The export writes numbers at full precision and lets Excel format them through `numFmt`, which is correct for a spreadsheet: the number stays a number. The screen's Qty uses the existing `formatCount` (`lib/money`). The counts in `PARTS`/`PICTURES` use `toLocaleString('en-US')` on an integer, which is not a money formatter. The currency symbols and DL-223 grouping in the **file** are registry data: QS-02 / #440. |

## AC conformance

| AC | Implemented in | Tests | Result |
|---|---|---|---|
| AC-1 Header row A to BO from the registry, widths, centring, formats, full precision | `export-columns.ts`, `build-workbook.ts` | `build-workbook.test.ts` (67 labels as text, width per letter, centring of header and body, re-lettering moves columns, INR/USD/EUR formats as given, full precision), `layout.test.ts` (CI, real DB), e2e | **Partial.** Pass in code. The **shipped registry** still has default widths and a plain `#,##0.00`, so the downloaded file has neither the SPEC §7.5 widths nor ₹/$/€ (QS-02, #440 / #30 item 1) |
| AC-2 File name, attachment, no-store, MIME | `file-name.ts`, `istIsoDateOf`, `file-response.ts`, route | `file-name.test.ts` (spaces, removal, 60, fallback, IST midnight, injection), `export-route.test.ts`, e2e `suggestedFilename` | **Pass** (Assumption 1 accepted) |
| AC-3 Engineer 403 fixed body / 401; summary refuses; SCR-26; role matrix and canary | Manifest rows, `withRoute`, `authorizePage`, service guard | Route, page, service, role-matrix, refused-before-lookup, strict-schema, csrf, canary journey, `export.spec.ts` | **Pass** |
| AC-4 Opens with no repair; text only | `build-workbook.ts` | Read back with ExcelJS, zip and part check (`xlsx-parts.ts`), `<f>` and `t="s"` checks, `= + - @` | **Pass** (the manual open in Excel is still due before G8, as the AC says; tab/CR untested, QS-05) |
| AC-5 Worker thread; build callable in process; entry holds no logic | `thread-runner.ts`, `thread-protocol.ts`, `export-thread.ts` (one line), bundle script | `thread.test.ts` (real thread from a real bundle; failed, exited, missing, timeout), `thread-protocol.test.ts` | **Pass** (images in batches are 07.02). Memory not bounded: QS-01 |
| AC-6 File card, rows card, Building, Error with reference, Empty | `estimate-export.tsx`, `download-button.tsx`, `download-client.ts` | `export-screen.test.ts`, `export-page.test.ts`, `export-download-client.test.ts`, e2e Building and Error | **Pass** (Assumptions 2 and 4 accepted) |
| AC-7 360 / 768 / 1366, region, stacking, axe 0 | Same components (`Table regionLabel`, `w-full md:w-auto`) | `export.spec.ts` (CI green) | **Pass** |

## Assumptions 1 to 6

| Assumption | Judgement |
|---|---|
| 1 "At most 60" limits the customer part | Accepted. The AC lists it among the customer-name rules, and the other parts are fixed length. The schema still caps the whole name at 200. |
| 2 Header row only; rows card shows inputs | Accepted. This is the story's scope. The BG and Tool Cost columns of the UX card are figures and come with 07.02 to 07.04. |
| 3 No state check yet | Accepted for 07.01, because no figure is read. **Ordering condition:** see "Issues for other roles". |
| 4 Empty state on the page; route still answers a header-only file | Accepted. Harmless, with no data. |
| 5 `private, no-store` satisfies "no-store" | Accepted. |
| 6 Summary route has no browser caller yet | Accepted. It is Lead/Admin only, strict, and in the manifest, role matrix and canary. |

## Findings

| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|---|---|---|---|---|---|---|
| QS-01 | **Major** | `src/server/export/thread-runner.ts:44-51` | Each download starts a new thread with no cap on threads at once and no `resourceLimits`, and each thread re-parses the ExcelJS bundle. **Measured** on the laptop, real bundle: header-only 1 thread +55 MB; **10 at once +405 MB**; 2,000 × 67 rows 1 thread +128 MB; **4 at once +1,037 MB**. Architecture §4.6 asks for a gate. #440 moves it to 07.02, so today nothing bounds memory (brief item 3, DL-217, RISK-010). | 25 concurrent users (NFR-011), several tabs or direct API calls can push the app process past 1 GB on the single Windows host, which also runs PostgreSQL. With pictures (07.02, about 100 MB per file), one burst can take the portal down for everyone. | (1) A module-level counter in `createThreadBuilder` (`maxThreads`, suggested 2). When it is full, reject with `ExportBusyError extends AppError` (503 `EXPORT_BUSY`, fixed words, `Retry-After`), following the `DatabaseBusyError` pattern, and decrement it in `settle`. (2) `new Worker(entry, { workerData: model, resourceLimits: { maxOldGenerationSizeMb: 512 } })`, so an oversized build ends only its own thread (`ERR_WORKER_OUT_OF_MEMORY` goes to `error`, then `failed`). About 20 to 30 lines. **GitHub #442. Recommended in this PR.** At the latest it must land before 07.02 merges. | `thread.test.ts`: a `hang.mjs` entry with `maxThreads: 1`, where the second call is `EXPORT_BUSY` and a third call succeeds after the timeout; and an entry that allocates without limit, which ends `failed` while the test process survives. |
| QS-02 | **Major** | `src/server/export/export-columns.ts:18` (reads the registry); the data is in `prisma/seed/config/seed-config.ts` (`widthOf`, `numFmtOf`, about lines 230-255) | AC-1 asks for SPEC §7.5 widths per letter and ₹/$/€ formats. The code passes each field's `width` and `numFmt` faithfully, but the seed still holds defaults and a plain `#,##0.00`, so the file a Lead downloads has neither. Strictly read, AC-1 is "implemented differently" in its output. I rate it Major, not Critical, because the AC places the data "in the registry", the gap is the existing #30 item 1, and the architecture already makes it a before-first-install action (§4.5, line 490). | The file does not yet look like the business's worksheet: column widths are wrong and there is no currency symbol. If version 1 is installed without the fix, it can only be corrected later by a configuration edit. | Close #30 item 1 / #440 before the first install, and make it a G8 condition. Add a test that reads every seed format back through `buildWorkbook` (₹ on INR, $ on BJ, € on BK, §7.5 width per letter). INR lakh grouping needs a conditional Excel format; check it in real Excel. **Tracked in #440** (labelled `tech-debt`, comment added). **Not for this PR** (the seed belongs to #30). | The seed read-back test above. It fails today. |
| QS-03 | Minor | `scripts/package-windows.ps1:188` vs `scripts/lib/export-worker-bundle.ts:26-35` | The shipped thread file (Windows package) is built by a **different recipe** from the one CI and `thread.test.ts` exercise. The PS1 adds `--conditions=react-server` and `--external:pg-native`; the TS API has neither. `npm run build` (which the package script requires first) already writes `.next/export-worker.mjs`, which is then rebuilt differently. The PS1 comment says "same banner", but the options differ. | If the thread's import graph ever reaches a package with a `react-server` export condition or `server-only`, the tested bundle and the shipped bundle behave differently, and only the untested one goes to production. Today the graph (`thread-protocol`, `build-workbook`, `columns`, `zod`, `exceljs`) is unaffected. | One recipe: in the PS1, `Copy-Item` the `.next\export-worker.mjs` that `npm run build` made (or run `npx tsx scripts/build-export-worker.ts` with an out path). Also note in the README that `next dev` keeps a stale bundle until the script is re-run (already mentioned; consider a `predev` check of modification times). | A Stage 13 assertion that the packaged `export-worker.mjs` has the same SHA-256 as `.next/export-worker.mjs`. |
| QS-04 | Minor | `src/server/export/thread-runner.ts:22-28`, `:64`; `src/server/http/with-route.ts:133-136` | `ExportThreadError.reason` (`missing` / `timeout` / `failed` / `exited`) and the thread's own `errorName` (`InvalidModel`, `RangeError`) are dropped. `describeFailure` logs only `errorName: "ExportThreadError"`, because it is not an `AppError`. The code comment says a missing bundle is "a plain error (a 500 with fixed words, logged)", but the log cannot tell it from a timeout or a crash. | An install that lacks the bundle (QS-03) or a build that times out looks identical in `C:\Accucut\logs`, so diagnosis needs a code read. | Make `ExportThreadError` an `AppError` (500, `code: EXPORT_THREAD_${reason.toUpperCase()}`, fixed message) so `errorCode` carries the reason, and keep the thread's `errorName` (a class name, never text) on the error for the log. | `thread.test.ts`: the `missing` case has `code === 'EXPORT_THREAD_MISSING'`. A `with-route` test shows the code in the logged fields. |
| QS-05 | Minor | `tests/unit/export/build-workbook.test.ts:17` | `FORMULA_STARTS` covers `= + - @` (the #394 minimum) but not a leading tab (0x09) or CR (0x0D), which OWASP lists for spreadsheet injection and the brief asked for. They are safe today (ExcelJS keeps them in a shared string), but nothing pins it. | A future change (a `quotePrefix` or "smart" cell typing, or a library swap behind TD-01) could treat them differently unnoticed. | Add `'\t='` and `'\r='` payloads (and `'\n='`) to the same `it.each` and XML checks. 07.02 brings the first typed part text, so pin it before then. | The extended test. |
| QS-06 | Info | `src/app/api/v1/estimates/[id]/export/route.ts:18`; `thread-runner.ts:44` | A download the browser cancels (a closed tab, a second press after the page reloads) keeps its thread running to completion or until the 120 s timeout. | It holds a slot and memory with nobody waiting. Minor alone; it matters once QS-01's cap exists. | Pass `request.signal` into `build`, and terminate the thread on `abort`. | Unit test with an aborted `AbortController` and `hang.mjs`: settles at once and the thread is terminated. |
| QS-07 | Info | `tests/e2e/canary-scan.spec.ts:591-601`; `tests/e2e/support/canary-scan.ts:139` | The scan reads an xlsx body as text but does not inflate it, so a canary inside a workbook part is invisible to the value scan. Today the status, attachment-header and `^PK` assertions are the real barrier, and they are sufficient. | From 07.02 the file carries figures. Defence in depth would want the value scan to see inside a workbook. | For 07.02: in `recordFetched`, when the body starts with `PK` and the type is the xlsx MIME, append the text of `readXlsxParts(bytes)` (the helper exists) to the scanned body. Add a **Lead positive control** that finds a seeded figure inside the downloaded file. | The Lead control: it fails if the file is empty or unscanned. |
| QS-08 | Info | `tests/e2e/navigation.spec.ts:237` | The same fragility as AQP-320 SQR-05: the example moved from `/estimates/…/export` to `/config/checkpoints`, which breaks again when that page ships. | A false red later. | Pick the example from `ROUTE_MANIFEST` (`status === 'planned' && kind === 'page'`), or skip when none is left. | n/a |
| QS-09 | Info | `scripts/lib/export-worker-bundle.ts:34` | With `logLevel: 'warning'`, esbuild prints `X [ERROR] Could not resolve …` to stderr even when the error is caught and rethrown. The negative test "esbuild cannot run" makes every `vitest` run show an alarming red line. | Noise that trains people to ignore real errors in the output. | `logLevel: 'silent'`. The thrown `error.message`'s first line already says why, and `build-export-worker.ts` prints it. | n/a |
| QS-10 | Info | `src/server/export/export-model.ts:26` | Design note for 07.02 and 07.03. Keep `ExportCell` free of formulas. If a story ever needs a live formula (SPEC §10 asks for values, so I expect none), add a separate tagged variant whose text comes only from the configuration version, and turn the "no `<f>`" test into an allow-list of configured cells. Excel also decodes `_xHHHH_` escapes in shared strings for display (`_x003D_` shows as `=`). That is still text and never evaluated, so no action is needed. | Keeps the #394 guarantee structural rather than a matter of convention. | n/a (guidance) | n/a |
| QS-11 | Info | whole PR | **Praise.** Allow-list guards at three levels (manifest; `withRoute` and `authorizePage`; a service `switch` closed by `assertNever`), with spies proving nothing is read. A header name sanitised at source, checked by schema and asserted at the sink. A model with no formula type, plus XML-level proof with a dependency-free zip reader. The thread entry is one line, the protocol is measured in process, **and** the real thread runs from a real bundle in the unit suite (missing, failed, exited, timeout). Failures carry a kind and never a message. Strict schemas on both answers. The download client loads on the first press. The JS budget is measured for the new route (164,973 B, headroom 35,027). | n/a | n/a | n/a |

**Majors raised as GitHub issues** (CLAUDE.md §9, `tech-debt`, `ai-delivery`):
- **QS-01 → #442.** Cheap, recommended in this PR, and it must land before 07.02 at the latest.
- **QS-02 → #440.** The existing issue, now labelled `tech-debt`, with the finding added. Not for this PR; a G8 condition.

## Test adequacy (would the tests fail?)

| Fault | Caught by |
|---|---|
| An Engineer reaches a route or the page | Route and page tests (403, spies show no read), role matrix and refused-before-lookup (manifest-driven), service second guard, canary journey, e2e |
| A header-injecting customer name or task code | `file-name.test.ts`, `exportFileSchema` and `fileResponse` regexes (three layers) |
| Typed `= + - @` text becomes a formula | `build-workbook.test.ts` (ExcelJS cell type and XML `<f>` / `t="s"`) |
| Typed tab- or CR-prefixed text becomes a formula | **Not tested** (QS-05) |
| Thread crash, exit, hang or missing bundle; error text leaking | `thread.test.ts` (real threads), `thread-protocol.test.ts` |
| Many exports at once exhaust memory | **Not tested and not prevented** (QS-01) |
| The shipped bundle differs from the tested one | **Not tested** (QS-03) |
| Seed formats and widths are not SPEC §7.5 | **Not tested.** The builder writes whatever it is given (QS-02) |
| The file stops opening (corrupt zip or XML) | `xlsx-parts.ts` part check and ExcelJS read-back, at unit, integration and e2e level |

## Issues for other roles

- **orchestrator / scrum-master (ordering):** AQP-332 (07.02) adds figures to the file, but the "only when current" refusal is 07.04. 07.02 must either read figures through `figure-state.ts` (`readFiguresWhenCurrent`) from its first commit, or not merge before 07.04. Otherwise a file could carry out-of-date figures. Also put QS-01 (#442), the size gate (#440) and QS-07 into 07.02's Dev Context.
- **developer:** QS-01 in this PR if possible. Then QS-03, QS-04, QS-05 and QS-09, each a few lines, in this PR or the hardening window.
- **solution-architect:** QS-01's numbers for RISK-010 (thread start cost about 40 to 55 MB, independent of size). The test-strategy §11 row for `src/worker/export-thread.ts` (already in #440).
- **product-owner / master:** QS-02 as a G8 condition (#30 item 1 / #440), and the manual Excel open of AC-4 before G8.
- **reviewer-performance (final review):** the QS-01 probe figures, and the per-download ExcelJS parse (about 1 s of the 1.06 s header-only time).

## Recommendation

There are no Blocker or Critical findings, so the critical-review condition of CLAUDE.md §9 item 2 is met at `ec740bcd`. NFR-002 holds: an Engineer cannot obtain the file, the summary or the page through any address, status difference, timing, error or log. #394 holds for `= + - @`: typed text is stored only as shared strings, and no formula, hyperlink or external reference is written.

- **Recommended in this PR:** QS-01 (#442), the thread cap and `resourceLimits` (about 20 to 30 lines with tests). QS-05 and QS-09 are one-liners.
- **Before 07.02 merges:** QS-01 if not done here, the size gate (#440) and QS-07.
- **Hardening window:** QS-03 and QS-04.
- **G8 condition:** QS-02 (#440 / #30 item 1) and the manual Excel open (AC-4).
- **Info:** QS-06, QS-08, QS-10 and QS-11.

Mergeable once CI is green on any fix-up head. A re-review is needed only if the fix-up touches more than `thread-runner.ts`, its test, `lib/errors.ts`, `build-workbook.test.ts` and `export-worker-bundle.ts`.


## Addendum 1: re-review of the fix-up `ec740bcd..36393715` (2026-11-16)

| Item | Value |
|---|---|
| Head reviewed | `363937150746f6dbe5176e5a58d43ef95f9dd9a2` (CI run 43805468614, 6 of 6 green as reported) |
| Scope | Only `git diff ec740bcd 36393715`: 8 files, +129 / −14 (`thread-runner.ts`, `lib/errors.ts`, `http/problem.ts`, `http/with-route.ts`, `export-worker-bundle.ts` and three test files) |
| **Verdict** | **APPROVE WITH COMMENTS.** Still **no Blocker or Critical**, so the §9 item 2 condition is met. New: Major 1 (QS-12), Minor 1 (QS-13), Info 1 (QS-14) |
| Totals now open | Blocker 0 · Critical 0 · Major 2 (QS-02, QS-12) · Minor 2 (QS-03, QS-13) · Info 6 (QS-06, QS-07, QS-08, QS-10, QS-11, QS-14) |

### Prior findings

| ID | Status at 36393715 |
|---|---|
| QS-01 Major | **Partly fixed.** `maxThreads` (default 2), `ExportBusyError` (503 `EXPORT_BUSY`, fixed words, `Retry-After: 10`) and `resourceLimits.maxOldGenerationSizeMb` (default 512) are in, with tests. The slot leaks when the constructor throws: QS-12 |
| QS-02 Major | Open as planned (#440 / #30 item 1, G8 condition) |
| QS-03 Minor | Open (hardening window) |
| QS-04 Minor | **Fixed.** `ExportThreadError` is an `AppError` (500) with code `EXPORT_THREAD_<REASON>`; the body keeps the internal title |
| QS-05 Minor | **Fixed.** `\t`, `\r` and `\n` before each of `= + - @` are checked at the ExcelJS level (String type, exact text, no formula) and the XML level (no `<f>`, `t="s"`) |
| QS-06, QS-07, QS-08, QS-10 Info | Open, as noted |
| QS-09 Info | **Fixed** (`logLevel: 'silent'`; no stderr noise in the vitest run) |

### The three checks asked for

1. **Can the cap leak a slot?** On every asynchronous path it cannot. `settle` runs exactly once (`settled` flag) on `message`, `error`, `exit` and timeout, and it decrements the count and clears the timer. The busy and missing paths return before the increment. **It does leak on one path:** `running += 1` (line 69) comes before `new Worker(...)` (line 70), so a synchronous throw from the constructor rejects the promise without decrementing the count (QS-12). Reproduced at this head with the scratch probe `slot-leak.ts`: with `maxThreads: 1`, a model that structured clone refuses gave `DataCloneError`, and the next valid call was `ExportBusyError EXPORT_BUSY`.
2. **Do the `with-route.ts` and `problem.ts` changes alter other routes or leak text?** No.
   - `problemResponse(body, extraHeaders = {})`: the only non-default caller is the `ExportBusyError` branch in `withRoute`, so every other answer's headers are byte-for-byte unchanged. The extra headers spread after the fixed ones, but only `Retry-After` is ever passed.
   - `problemFromAppError` adds only an `ExportBusyError` exception to the "500 and above gets the internal title" rule. Its message is a fixed sentence, the same pattern as `DatabaseBusyError`.
   - `ExportThreadError` gets the internal title. Its `code` (`EXPORT_THREAD_*`) appears in the body, as for every other `AppError`, and it holds no typed text, figure or path.
   - `describeFailure` logs `errorName` plus `errorCode`, never the message.
   - `http-problem.test.ts`, `engineer-refused-before-lookup` and `strict-schema` pass.
3. **Can the new tests fail?**
   - **Busy test:** yes. It fails without the cap (the second call would start a thread and time out) and if the slot is not returned (the third call would be busy).
   - **QS-04 test:** yes; the four codes and the exact 500 body are pinned.
   - **QS-05 test:** yes; the cell type, the exact text and the XML are pinned for all 12 payloads.
   - **Heap test:** no, it cannot prove the limit (QS-13). Without `resourceLimits`, Node still ends the thread with `ERR_WORKER_OUT_OF_MEMORY` at the default heap limit, so the test would pass more slowly and with more memory.

### New findings

| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|---|---|---|---|---|---|---|
| QS-12 | **Major** | `src/server/export/thread-runner.ts:69-70` | The count is incremented before `new Worker(...)`, and nothing decrements it when the constructor throws synchronously: `DataCloneError` on `workerData`, or `ERR_WORKER_INIT_FAILED` when memory or file handles run out. Reproduced at 36393715. | After `maxThreads` (2) such failures, every export is refused 503 until the service restarts. The likeliest trigger, memory pressure, is the case the cap was added for. No data or confidentiality impact. | `running += 1; let thread: Worker; try { thread = new Worker(entry, { workerData: model, resourceLimits: { maxOldGenerationSizeMb: heapLimitMb } }); } catch { running -= 1; reject(new ExportThreadError('failed')); return; }`. Tracked on **#442**. **Recommended in this PR** (3 lines). | `thread.test.ts`: with `maxThreads: 1`, `build({ ...model, hook: () => 1 } as never)` rejects with `ExportThreadError('failed')`, and the next `build(model)` with a good entry returns a file. Fails today. |
| QS-13 | Minor | `tests/unit/export/thread.test.ts:106-109` | The heap test passes with or without `resourceLimits`, because Node also ends a thread at the default heap limit, only later and with far more memory. The 64 MB is not pinned. | A later edit that drops `resourceLimits` would go unnoticed and reopen QS-01's memory risk. | Add a time bound (`expect(elapsed).toBeLessThan(10_000)`), or inject the `Worker` constructor (default `Worker`) and assert `resourceLimits.maxOldGenerationSizeMb === heapLimitMb`. | The amended test. |
| QS-14 | Info | `src/server/export/thread-runner.ts:79-81` (and the `message` path) | The slot is freed in `settle` before `thread.terminate()` resolves, so `maxThreads + 1` threads can be alive for a moment. | Negligible at a cap of 2. | If needed, decrement in the `exit` handler, which always fires once the thread is gone, and keep settling as it is. | n/a |

### Checks run

- `vitest run` at 36393715: `tests/unit/export/*`, `export-route`, `export-service`, `http-problem`, `engineer-refused-before-lookup`, `strict-schema`. **12 of 12 files, 265 of 265 tests pass.**
- Probe `slot-leak.ts` (scratchpad only) reproduces QS-12.
- Not run: Playwright, `next build`, Docker.

### Recommendation

Still **no Blocker or Critical**: the merge condition of CLAUDE.md §9 item 2 holds at 36393715. **Fix QS-12 in this PR** (three lines plus one test), because it defeats the cap under exactly the conditions the cap is for. QS-13 can go with it. A further re-review is needed only if that fix-up touches more than `thread-runner.ts` and `thread.test.ts`.
