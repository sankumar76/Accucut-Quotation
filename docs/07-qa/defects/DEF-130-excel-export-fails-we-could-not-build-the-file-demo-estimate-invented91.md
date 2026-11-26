# DEF-130: "Download .xlsx" fails with "We could not build the file ... Reference: req-da945569" on the demo estimate INVENTED91 (4 parts, columns A to BK) on the production build of master e3dc5b0b (cause found 2026-11-27: the demo build lacked the export-worker bundle, a build and packaging defect; Sev-2 proposed after the cause step, Sev-1 as first filed; Jira AQP-487, GitHub #797; fix due end of Sun 29 Nov 2026 for the demo on Mon 30 Nov)

| Field | Value |
|-------|-------|
| Story / AC | STORY-07.x (EPIC-07, the Excel export; FR-071 family: the workbook in the customer's layout) and the export read-back checks of the test plan (sections 7 and 9.5). The AC that fails is "an approved or calculated estimate downloads as the workbook"; QA has not run it: this is the delivery lead's report. |
| Severity | **Sev-1 Critical, proposed by QA at the orchestrator's request: the export is a critical, customer-facing path and the customer is shown the demo on Mon 30 Nov. It drops to Sev-2 if lane 1 shows that only this estimate's shape is affected; master grades.** |
| Priority | P1 until graded (Jira Highest); date: **fixed and verified by the end of Sun 29 Nov 2026** (the customer gets a rebuilt demo on Mon 30 Nov). |
| Type | **Build / packaging (cause found by lane 1, relayed by the orchestrator, 2026-11-27; QA did not reproduce it): the demo build lacked `.next/export-worker.mjs`.** The product's export code and the data are fine on lane 1's reading. First filed as 'Product, cause not yet known'. Test not applicable. |
| Status | **Open, cause found 2026-11-27 (see 'Cause found').** Owner: **lane 1**. **Proposed regrade: build / packaging defect, Sev-2; it stays Sev-1 only if lane 1 finds that the Windows package can ship without the bundle; master grades.** Fix PR (lane 1) and the demo-folder fix pending; QA's verification pending. |
| Jira / GitHub | [AQP-487](https://sankumar76.atlassian.net/browse/AQP-487) / [#797](https://github.com/sankumar76/Accucut-Quotation/issues/797) (labels bug, sev-1, ai-delivery, final-review, demo-2026-11-30; Jira also aiid-DEF-130, agent-qa-engineer). Relates to AQP-1 and the EPIC-07 export stories. Searched first: JQL on `aiid-DEF-130`, 'req-da945569', 'could not build the file' and a GitHub search: nothing (DEF-084's and QLT-F-04's hits are other topics). |
| Found by / date | The delivery lead, testing the demo; relayed by the orchestrator, 2026-11-27 |
| Build / commit | Production build of `master` `e3dc5b0b` (the demo build) |
| Environment | The delivery lead's demo install (production build). Not CI. |

## Steps to Reproduce
1. Open estimate **INVENTED91** in the demo database: 4 parts, columns A to BK.
2. Press **Download .xlsx**.
3. Reproduction for the developer: **a local dump of the demo database, held off-repo** (not described or referenced here; no path or content in Jira or GitHub).

## Expected Result
The workbook builds and downloads, named `INVENTED91_<customer>_26-11-2026.xlsx` (the file name the page offered), with the figures and layout the export read-back checks.

## Actual Result
The page shows the title **"We could not build the file"** (`export-texts.ts:29`, `ERROR_TITLE`) with **"Reference: req-da945569"**. No file is downloaded. **The server log lines for that request ID are not available to the team**, so the cause is not read.

## Evidence
- The delivery lead's report (relayed). The message above is the product's own, with the request ID the server logged.
- QA ran nothing: no browser, no log, no reproduction.

## Cause found (lane 1, relayed by the orchestrator, 2026-11-27; QA read the code facts named, and ran nothing)
**The fault.** The demo build lacked `.next/export-worker.mjs`. A `next build` run on its own on 26 Nov emptied `.next`, and the bundle step (`tsx scripts/build-export-worker.ts`, which `npm run build` runs after `next build`) never ran. Without the bundle every export fails with the thread-missing error (relayed as `EXPORT_THREAD_MISSING`; in `src/server/export/thread-runner.ts` the build rejects with `ExportThreadError('missing')` when the thread's entry file does not exist), which the route turns into the 500 with the fixed words 'We could not build the file' and the request reference. **The export code and the data are fine:** lane 1 reproduced it against a restored copy of the demo database in a throwaway container: with the bundle, the 4-part estimate exports at 35 KB and a 500-node estimate at 238 KB (relayed figures). The dump stays off-repo and is not described further.
**Code facts QA read (`origin/master`):** the header of `thread-runner.ts` says the thread's file is a bundle made by `scripts/build-export-worker.ts` (architecture section 4.6, ADR-012 'a thread entry file must be built and shipped') and that `npm run build`, the Playwright dev server and `scripts/package-windows.ps1` each make it at `.next/export-worker.mjs`; `package.json` has `build` = `prisma generate && next build && tsx scripts/build-export-worker.ts` and `dev` running the bundle first; `.github/workflows/ci.yml` runs the bundle step in two places. So a bare `next build` is the only path QA saw that skips it.
**The fix PR (lane 1), as relayed:** (a) a production start-up check that logs the missing bundle; (b) a test that every build path, including the Windows package and Docker, makes the bundle; (c) a README note. **The demo fix:** run the bundle step in the demo folder.
**Why Sev-2 (proposed):** a packaging fault with a one-command fix, and no sign that a released package lacks the bundle; **it stays Sev-1 if lane 1 finds that the Windows package (or the Docker build) can ship without it**, because every customer export would then fail.

## Suspected Area (first filing; superseded by 'Cause found')
The export route `src/app/api/v1/estimates/[id]/export/` and `src/server/export/` (`build-workbook.ts`, `export-columns.ts`, `product-cells.ts`, `rows.ts`, `summary-figures.ts`, `image-batches.ts`, `thread-runner.ts`, `thread-protocol.ts`): the build runs in a worker thread, so a thrown error there reaches the user as this generic title. First question: what the server logged for `req-da945569`, or what a local run with the dump throws. Second: whether it is this shape (4 parts, columns A to BK, pictures, a long value or an unusual character) or any estimate; the CI export tests use invented fixtures, so a shape they do not cover is possible.

## Binding and proof (proposed; master sets it)
1. **Cause step first (lane 1):** reproduce with the local dump and state the thrown error; say in the PR whether any other estimate shape is affected. **If only this shape fails, the Sev drops to Sev-2** (the orchestrator's condition); if any calculated estimate fails, it stays Sev-1.
2. **Fix test-first:** a regression test of the failing shape (a fixture with the same shape: 4 parts, columns A to BK, and whatever the cause step finds), plus the export read-back. No test is weakened, skipped or quarantined.
3. **Proof (QA reads) (updated 2026-11-27):** the PR run of record green, with the new start-up check and the every-build-path test passing; **on the rebuilt demo, the export works for INVENTED91 and for one other estimate (QA downloads each, opens it, and runs the read-back)**; **test plan 14.9 gains a rehearsal step P4a: after the install, export one estimate** (so a package without the bundle is caught at the install rehearsal); the estimate INVENTED91 downloads on the rebuilt demo with the file name above, opens, and the cell-by-cell read-back of the test plan section 7 passes; the Windows package run; the final regression's export checks. **Due by the end of Sun 29 Nov 2026.** Any other export path (an estimate with pictures, 500 parts) is re-run at the final regression.
4. **Record:** the dump stays off-repo and is not attached to Jira or GitHub.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Cause found (the thrown error) | developer (lane 1) | 2026-11-27 | the missing `.next/export-worker.mjs` (relayed) |
| Fixed: the demo folder (run the bundle step) | developer (lane 1) | | |
| Fixed: the PR (start-up check, every-build-path test, README) | developer (lane 1) | | |
| Regression test (every build path makes the bundle) | developer (lane 1) | | |
| Verified on the rebuilt demo (INVENTED91 and one other estimate) | qa-engineer | | |
| Rehearsal step P4a added (test plan 14.9) | qa-engineer | 2026-11-27 | test plan 0.3.79 |

## Records
Jira Bug AQP-487 and GitHub issue #797, created 2026-11-27 and cross-linked. Related: EPIC-07 export stories, AQP-1; the demo of Mon 30 Nov; test plan 0.3.78.
