# DEF-029: Process and Materials say "Nothing was changed." under "saved" when the list re-read after a successful save fails (QLT-01)

| Field | Value |
|-------|-------|
| Story / AC | AQP-113 (STORY-02.01 Process, PR #107) and AQP-122 (STORY-02.03 Materials, PR #120) / no AC fails; ux-spec section 6.0 "Error (load)" (rule added in v0.21, after both stories merged) |
| Severity | Sev-3 Moderate (test plan section 6; DL-094: the scale decides severity, who owns the code decides only the owner) |
| Priority | P3 |
| Type | Product |
| Status | Closed |
| Jira / GitHub | [AQP-274](https://sankumar76.atlassian.net/browse/AQP-274) / [#308](https://github.com/sankumar76/Accucut-Quotation/issues/308); relates to AQP-113, AQP-122, AQP-1. Related, separate: #307 (DL-131 condition K, failed writes) |
| Found by / date | reviewer-quality on PR #291 (QLT-01, probe N1 = control PR #304); routed by master in DL-169; reproduced and graded by qa-engineer, 2026-11-12 |
| Build / commit | `origin/master` 8f07c17 (code as of abdac01) |
| Environment | Control run 43162431792 (GitHub Actions, Playwright Chromium at mobile, tablet and desktop widths) |

## Steps to Reproduce
1. Sign in as Admin and open Process (SCR-11) or the Materials tab (SCR-13).
2. Add, Edit or Delete one row and let the write succeed. Make the list read that follows the save fail.
3. Read the page: the success notice and, below it, the load-error panel.

## Expected Result
The load-error panel says the saved sentence for that screen, as ux-expert confirms, in the pattern of `treatment-panel.tsx:63-65` ("The change was saved, but we could not show the list. Check your connection and try again."). ux-spec section 6.0: "Nothing was changed." is not said when the read follows a save that succeeded.

## Actual Result
"<name> saved. The change is in the audit log." then "We could not load the rates / Check your connection and try again. Nothing was changed." The second statement is false every time it appears.

## Evidence
Reproduced by code-path reading on `origin/master` plus control #304's failed-test list and log lines; no local run (`npm ci` not allowed for this task).
- `process-results.tsx:48` and `material-results.tsx:56` render `MasterLoadError` with no `description`; `master-load-error.tsx:24` passes none on, so `states.tsx:100` `DEFAULT_ERROR_DESCRIPTION` ("Check your connection and try again. Nothing was changed.") appears. `onSaved` sets the success notice and then `readAgain(true)` (`use-process-master.ts:89-90`, `use-material-master.ts:73-74`). `treatment-panel.tsx:63-65` and `exchange-rates-panel.tsx:110-112` pass the saved sentence when `notice?.tone === 'success'`.
- Run 43162431792 (#304, closed; 359b778 = master + one `not.toContainText('Nothing was changed.')` at `tests/e2e/support/masters.ts:140`): red only at `tests/e2e/masters-slow-read.spec.ts:76` (Process) and `:103` (Materials) at three widths = 6 failed (2 per shard); `:116` (Treatments) and the three ready tests green. Received: `...E2E-rate-mobile-r0-t0-eddbc2 saved. The change is in the audit log.SearchWe could not load the ratesCheck your connection and try again. Nothing was changed.Try again`.

## Grade (DL-094)
Sev-3: wrong wording that does not mislead about a price (scale example: "Message differs from the UX spec text"). Not Sev-2: no AC fails (the rule entered ux-spec v0.21, 073a9cf, after both screens merged), no task blocked (Try again reloads), no wrong server behaviour, no WCAG failure, and it needs a failed re-read right after a successful write (DEF-020, same trigger, is Sev-4). Not Sev-4: the sentence is false and contradicts the notice above it; an Admin may repeat an Add (refused as a duplicate) or doubt the audit log. Service level: fixed before G8 or accepted in writing by master (DL-167 (6)); does not hold #291 (DL-168). Both stories stay Done.

## Suspected Area
`process-results.tsx:48`, `material-results.tsx:56`: pass `description={notice?.tone === 'success' ? <sentence> : undefined}`, one constant per screen, wording from ux-expert (DL-169 (3b)). Regression test: N1's assertion in the two failed-read tests of `masters-slow-read.spec.ts` plus the positive sentence (E2E +0); a `master`-based control without `description` must turn both red at three widths.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-12 | PR #309 `fix/AQP-274-saved-not-shown`: `b22f735` (the sentence under a success notice on Process and Materials, one shared `SAVED_NOT_SHOWN_BODY`), `86d7108` (AQP-122 AC-8 load-error test) |
| Regression test added | developer | 2026-11-12 | `masters-slow-read.spec.ts` (`expectSavedNotShown`, two failed-read tests, DEF-029 in the titles); `tests/unit/masters-load-error-words.test.ts` (9 cases, H1 `e6e1c14`) |
| Verified | qa-engineer | 2026-11-12 | G7 on H1 `e6e1c14`: `docs/07-qa/AQP-274-test-report.md` (H2 `a7f1a2d`): CI run 43179008751 5 of 5 at +9 / +9 / +0 / +0; Process Add, Edit, Delete and Materials Add, Edit at 360, 768, 1366 px show the v0.23 sentence; the standard line after a deleted-elsewhere notice and a refused Delete; Treatment / Color unchanged; axe 0 |
| Closed | qa-engineer | 2026-11-12 | master G7 GO, DL-181; closes with the squash of #309 (`Closes #308`) |
