# DEF-020: When the list cannot be read right after a successful save, focus ends on the page heading and not on the load error title

| Field | Value |
|-------|-------|
| Story / AC | AQP-122 (STORY-02.03) / AC-8; UX SCR-13 "Loading and Error (load)" |
| Severity | Sev-4 Minor |
| Priority | P3 |
| Type | Product |
| Status | New |
| Found by / date | qa-engineer, 2026-11-09 |
| Build / commit | `b02955bb07e176f834477aeb08dc3713d563bd37` on `feat/AQP-122-material-master` (PR #120) |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1) at 360, 768 and 1366 px, throwaway PostgreSQL 17, development server |
| Jira / GitHub | [AQP-235](https://sankumar76.atlassian.net/browse/AQP-235) / [#128](https://github.com/sankumar76/Accucut-Quotation/issues/128) |

## Steps to Reproduce
1. As the Admin open `/masters/materials` with one material.
2. Make `GET /api/v1/materials` answer 503 (a Playwright route in the QA test; a stopped database does the same).
3. Open Edit for the material, change the Material-Scrap-Rate and press Save.

## Expected Result
The save succeeds (the notice "<name> saved. The change is in the audit log."), the re-read of the list fails, and the load error is shown with focus on its title, "We could not load the materials". The UX spec says "focus goes to the title"; the code means it (`ErrorState` with `focusOnMount`, and the comment of `useReadAgain`: "If the list cannot be read, the error state takes focus instead").

## Actual Result
The error title, text and "Try again" show, but `document.activeElement` is `H1: Materials and lists`, the page heading, at all three widths. A screen reader user hears that the change was saved and is not told that the list failed to load.

## Evidence
`tests/e2e/aqp-122-qa.spec.ts`: "[AQP-122 AC-8] DEF-020: when the list cannot be read after a save, focus is on the load error title" (marked `test.fail`; reported as passed while the fault exists). Without the mark: `Expected: "H2: We could not load the materials"`, `Received: "H1: Materials and lists"`, 3 of 3 widths. The developer's error test in `materials.spec.ts` checks that the heading is visible, not that it has focus.

## Suspected Area
`src/components/features/masters/use-material-master.ts`: the dialog's `onCloseAutoFocus` calls `focusOpener`, which falls back to `focusHeading()` when the opener row is gone (the list is now the error state). It runs after the error title has taken focus. A guard such as "do nothing when the list is in the error state" would do. SCR-11's hook (`use-process-master.ts`) has the same shape and probably the same fault; it was not tested.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | The QA test above; remove its `test.fail` line |
| Verified | qa-engineer | | |
