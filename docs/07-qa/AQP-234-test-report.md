# Test Report — AQP-234 (DEF-021) and AQP-235 (DEF-020): masters table actions and focus

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `04bec3e` on `fix/AQP-234-masters-table-actions` (PR #135; merge base `dd7e2f4`; `master` is at `9525a9f`, so the PR is behind). QA's own commit adds only `tests/e2e/aqp-234-qa.spec.ts`, this report and `docs/07-qa/AQP-234-evidence/`; nothing under `src/` |
| Environment | Windows 11, Node v24.19.0 (the project profile says Node 22 LTS; CI runs the project's own), Playwright 1.64.1 Chromium, development server (`next dev`, Turbopack) on port 3140, **throwaway PostgreSQL 17 container on port 55461** (migrated with `prisma migrate deploy`, seeded with `ensure-seed-version.ts`, removed after the run). The shared dev database on 55432 was not used. Local config `playwright.qa.config.ts` (dev server only, `retries: 0`, never committed). Invented data only |
| Date | 2026-11-09 |
| Gate | G7 for AQP-234 and AQP-235, with master's condition C of DL-122 |
| **Recommendation** | **ACCEPT** for both AQP-234 and AQP-235. No new defect. No open Sev-1 to Sev-4. Two items outside QA's lane are still open (section "Conditions A and B of DL-122") |

## Summary

All seven items of condition C pass on the exact head. On SCR-13 and SCR-11, at 768, 1023, 1024, 1279, 1280, 1366 and 1440 px, with a 100-character name, every row action is inside the region, not covered, with the table **not scrolled at all** (`scrollWidth` equals `clientWidth` at every width) and the page not scrolled sideways. With the table forced to scroll at 1024 px the row lines continue under the sticky Actions column (QLT-06: no break). Removing `sticky right-0` makes all 22 forced-scroll cases of the developer's spec fail, and putting it back restores them. DEF-020 holds on both screens, in the Edit, Add and Delete paths and in both paths of QLT-01, and QA's plants of the guard make the focus tests fail. The two former `test.fail` tests pass in all three projects. The regression run of the four named specs is 177 passed, 44 skipped, 0 failed, with no retry. CI on `04bec3e` is green, 5 of 5.

## Checks of condition C (DL-122)

| # | Check | Method | Result | Evidence |
|---|-------|--------|--------|----------|
| 1 | SCR-13 and SCR-11 at 768, 1023, 1024, 1279, 1280, 1366, 1440 px: every row action fully visible without scrolling the table; page never scrolls sideways; includes a 100-character name | `aqp-234-qa.spec.ts` G7-1 (14 cases): a 100-character name and an ordinary row, then in the browser each action's box against the region's box, `elementFromPoint` at the centre of each action (not covered), `scrollLeft` 0, `scrollWidth <= clientWidth`, `scrollX` 0, page overflow 0 | **Pass**, 14 of 14 | table 1; `AQP-234-evidence/g7-1-SCR-11.json`, `g7-1-SCR-13.json`; the developer's `masters-table-actions.spec.ts`, 24 of 24 passed in my run too (22 cases plus 2 set-up; 11 widths including 900, 1000, 1180 and 1257) |
| 2 | The other delivered tables | measured, see "Other tables" | **Measured**: SCR-14 Users still hides actions with a long name; none of the others has row actions to hide | table 2; `g7-2-other-tables.json`, `g7-2b-users-long-values.json` |
| 3 | QLT-06: row lines under the sticky column at 1024 px, table forced to scroll | G7-3: table forced to 1000 px in a 710 px region, three scroll positions (start, middle, far end), screenshot of each, then in a canvas the share of columns where a line is drawn at each row boundary, left of the Actions column and under it | **Pass**: 1.00 left of the column and 1.00 under it, at every row boundary of the whole list (13 on SCR-13, 28 on SCR-11), at all three positions. **No defect** | `qlt06-SCR-13-{start,middle,end}.png`, `qlt06-SCR-11-{start,middle,end}.png`, `g7-3-*.json` |
| 4 | Sticky plant | `sticky right-0` removed from `STICKY_ACTIONS` in `src/components/ui/table.tsx`, developer's spec run at all 11 widths, then restored with `git checkout`, never committed | **22 of 22 fail**, each at the same line: `forced to scroll, at its start: action 0 ends inside the region` (for example expected <= 743, received 965 at 768 px). The "as drawn" part passes on its own, which shows that the fit (headings and names wrap) and the guarantee (sticky) are separate and that the forced test is the one that carries the guarantee. After the restore `git status` shows only QA's new spec | `plant-sticky-right-0.diff`, `plant-sticky-right-0-output.txt`; the diff is below |
| 5 | DEF-020 on both screens | G7-5 (the four Edit/Add tests, the delete test and the blocked-path test) and the developer's two tests | **Pass**. See "DEF-020" | `qa-spec-aqp-234-qa-output.txt`, plants A and B |
| 6 | The two former `test.fail` tests | `aqp-122-qa.spec.ts` "DEF-020 ... focus is on the load error title" and "DEF-021 ... the Edit button of a row is inside the visible table area", plain, no `test.fail` left in the three spec files | **Pass in mobile, tablet and desktop** (6 of 6) | `regression-3-projects-output.txt` lines for tests 11, 12, 84, 85, 157, 158 |
| 7 | Keyboard and axe at 768 and 1024 px | G7-7 (8 tests): axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) as drawn and with the table forced to scroll and the region at its far end; keyboard with the table forced to scroll | **Pass**, 0 axe violations; Tab reaches Edit, Delete, Edit, Delete ... in row order (12 presses on each screen), every action shows `:focus-visible` with an outline or shadow, none is covered, `scrollX` stays 0, Enter opens the dialog and Escape returns focus to the same Edit button | `g7-7-*.json` |

### Item 4: the plant

```diff
--- a/src/components/ui/table.tsx
+++ b/src/components/ui/table.tsx
@@ -80,7 +80,7 @@ export function TableCell({ className, ...props }: ComponentProps<'td'>) {
 /** The classes of the Actions heading and its cells: ... */
-const STICKY_ACTIONS = 'sticky right-0 z-(--z-sticky-cell) w-(--actions-w) min-w-(--actions-w) shadow-[inset_1px_0_0_var(--border)]';
+const STICKY_ACTIONS = 'z-(--z-sticky-cell) w-(--actions-w) min-w-(--actions-w) shadow-[inset_1px_0_0_var(--border)]';
```

```
npx playwright test -c playwright.qa.config.ts --project=desktop tests/e2e/masters-table-actions.spec.ts --workers=2
  ✘ 22 [desktop] › masters-table-actions.spec.ts › SCR-11 / SCR-13 › at 768 ... 1440 px every row action is fully inside the region's visible box ...
    Error: forced to scroll, at its start: action 0 ends inside the region
    Expected: <= 743   Received: 965        (SCR-11, 768 px)
  22 failed, 2 passed (the two set-up tests)
```

Restored the same minute (`git checkout -- src/components/ui/table.tsx`); the restored file has the `sticky right-0` class again and the spec passes (24 of 24 in the regression run, which came after).

## DEF-020 (AQP-235), both screens

Method: the list read (`GET`) is made to answer 503 after the page has loaded, then a change is saved (the save itself goes through). Expected, from SCR-11 and SCR-13 "Error (load)": focus is on the error title, and stays there; from the error state, Add then Escape or Cancel returns focus to the Add button.

| Case | SCR-13 | SCR-11 |
|------|--------|--------|
| Edit, Save, re-read fails: focus on the error title, still there 600 ms later | Pass | Pass |
| Add, Save, re-read fails: same | Pass | Pass |
| From the error: Add, then Escape: focus on Add | Pass | Pass |
| From the error: Add, then Cancel: focus on Add | Pass | Pass |
| Delete confirmed, re-read fails: focus on the error title | n/a (no delete) | Pass |
| QLT-01 second path: a delete the server refuses (409 "in use"), its re-read fails while the refusal is open, Close: focus is not on `<body>` | n/a | Pass |
| The developer's tests (`aqp-122-qa` SCR-13, `process-master` SCR-11) | Pass x3 projects | Pass x3 projects |

There is no Close button on the Add dialog (only Cancel and Escape), so the "×" path does not exist.

**Negative controls (shown to fail).** Plant A, the guard in `focusOpener` removed (the pre-fix behaviour): 7 of 7 DEF-020 tests fail (`toBeFocused` on the title or on Add), including both of the developer's. Plant B, the round-1 guard `if (listFailed) return;` (the QLT-01 regression): QA's four Add-from-error tests, the developer's `process-master` test and QA's blocked-dialog test fail; the developer's `aqp-122-qa` SCR-13 test still passes, because it does not cover Add from the error state. Both plants restored; `process-opener.ts` is unchanged in the commit.

## Other tables (for #134 and OQ-UX-20; not a G7 blocker unless master says so)

Measured at the same seven widths, the table region being 718, 973, 710, 965, 966, 1052 and 1126 px.

| Screen | Row actions | Uses the masters pattern | Measured | Hides actions? |
|--------|-------------|--------------------------|----------|----------------|
| SCR-14 Users (`/users`) | 3 per row (Edit, Reset password, Deactivate) | **No**: plain `Table`, no sticky column | Seed data: never scrolls, 15 actions all inside at all seven widths. With the longest values the form allows (a 120-character name with no space, a 254-character e-mail, written into the first row in the browser) the table is **1603 px wide at every width**, so **all 18 actions are outside the region at all seven widths**; the page does not scroll sideways | **Yes, with a long name.** The Name cell has no `BREAK_LONG_NAMES` and there is no sticky column. Tracked by follow-up #134, which says the same |
| SCR-16 Audit (`/audit`) | none (the "Show more" button is below the table) | No (it has no row actions) | The table needs 2070 px with the long test names now in the database and scrolls inside its region at every width; the page does not scroll sideways | No action to hide. Columns do scroll. Not an action-visibility fault; noted as OBS-3 |
| SCR-03 Task queue (`/queue`) | none | n/a | A placeholder with the empty state, no table (story 04.02 builds the list). Zero tables at all seven widths | Not built |
| SCR-17 | n/a | n/a | No page: `src/app` has no fields-and-formulas route (only audit, design-system, masters/materials, masters/process, queue, users and the home page) | Not built |

The forced-scroll variant of the Users measurement is not used: React re-rendered the row and reset my edit in some widths, so only the "as drawn" numbers above are stated.

## AC verification matrix

DEF-021 and DEF-020 have no story ACs of their own; the "ACs" are the pass line of ux-spec v0.19 section 6.0, AQP-122 AC-7 and AC-8, and the two Jira bug records.

| Requirement | Test | Technique | Result | Evidence |
|-------------|------|-----------|--------|----------|
| 6.0 pass line: every row action visible without scrolling the table, 768 to 1440 px | G7-1 (7 widths x 2 screens), developer's 22 cases | boundary values at the region widths 718, 973, 710 (the narrowest), 965, 966, 1052, 1126; error guessing (100-character name) | Pass | item 1 |
| 6.0 part 2: sticky Actions column, opaque, hairline | developer's forced-scroll cases; QA's G7-3 pixel check; QA's plant | state/structure, mutation (plant) | Pass | items 3, 4 |
| 6.0 part 3: headings and names wrap | as drawn, `scrollWidth <= clientWidth` at all widths with a 100-character name | boundary | Pass | item 1 |
| 6.0 part 4: focusable named region, keyboard | G7-7 keyboard | state transitions | Pass (not covered by QA: the computed `scroll-padding-inline-end` value; the Tab test does not isolate it, as the developer said under QLT-03) | item 7 |
| 6.0 part 5: no column hidden | every column of both tables is present at 768 px (the 11-width spec and the layout measurement) | inspection | Pass | item 1 |
| AQP-122 AC-7 (DEF-021) | `aqp-122-qa` DEF-021 test, 3 projects | | Pass | item 6 |
| AQP-122 AC-8 (DEF-020): focus on the error title | `aqp-122-qa` DEF-020 test, `process-master` DEF-020 test, QA's G7-5 | state transitions, decision table (Edit, Add, Delete, blocked) | Pass | DEF-020 section |
| QLT-01: Add and Escape from the error state, and the blocked path | `process-master` test, QA's G7-5 | error guessing | Pass | DEF-020 section |
| QLT-06: row lines under the sticky column | G7-3 | pixel analysis | Pass | item 3 |

## Automated test results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| QA acceptance spec (committed) | `npx playwright test -c playwright.qa.config.ts --project=desktop tests/e2e/aqp-234-qa.spec.ts --workers=1` | 31 (2 set-up, 29 tests) + 2 measurement tests | 31 | 0 | 2 (the measurement tests, which run only with `QA234_MEASURE=1`) | 4.0 min |
| QA spec, blocked-dialog test added after that run | `... -g "second path" --workers=1` | 3 | 3 | 0 | 0 | 1.1 min |
| Developer's spec, QA run | `... --project=desktop tests/e2e/masters-table-actions.spec.ts --workers=2` | 24 | 24 | 0 | 0 | 5.0 min |
| **Regression**: materials, process-master, aqp-122-qa, masters-table-actions, 3 projects | `npx playwright test -c playwright.qa.config.ts tests/e2e/materials.spec.ts tests/e2e/process-master.spec.ts tests/e2e/aqp-122-qa.spec.ts tests/e2e/masters-table-actions.spec.ts --workers=2` on a fresh database | 221 | **177** | **0** | 44 (desktop-only and width-gated by design) | 13.3 min |
| Unit | `node node_modules/vitest/vitest.mjs run tests/unit/process-opener.test.ts tests/unit/source-conventions.test.ts tests/unit/one-width-tag.test.ts` | 20 | 20 | 0 | 0 | 7 s |
| CI-shape guards with the new spec in the tree | `vitest run tests/unit/e2e-shards.test.ts ci-workflow-shards.test.ts ci-feedback-time-sharded.test.ts early-intent.test.ts button-pending.test.ts button-pressed.test.ts canary-scan-gate.test.ts` | 73 | 73 | 0 | 0 | 20 s |
| Lint and types of the new spec | `eslint tests/e2e/aqp-234-qa.spec.ts`; `tsc --noEmit` (whole project) | | clean | | | |
| Full `vitest run`, lint of the whole tree, build | not run locally (low memory, brief) | | | | | CI run 42649224878 on `04bec3e`: success, 5 of 5 jobs (Stages 1 to 11, 1 to 11b, E2E shards 1, 2, 3) |

`retries` was 0 in every local run, so no pass hides a retry. The CI run is for the exact head `04bec3e` (PR #135 `head.sha`).

## Non-functional checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Accessibility | NFR-016, WCAG 2.2 AA | axe at 768 and 1024 px, as drawn and forced to scroll, both screens; keyboard walk; focus visible; focus not obscured (`elementFromPoint`) | Pass |
| Responsive | NFR-016 | 7 widths from 768 to 1440 px; no page-level horizontal scroll; the phone card layout (360 px) is covered by the regression run (mobile project) | Pass |
| Security smoke | n/a | No server code or route changed (the diff has no file under `src/server` or `src/app/api`); the 409 test uses a route mock only | Not applicable to this change |
| Performance | n/a | Layout and focus change only; no timing target | Not applicable |

## Exploratory notes (time-box 30 min, charter: break the sticky column and the focus rule)

- Tried the actions with the table forced wider than the region and the region scrolled to its far end: the Actions column stays at the right edge, opaque, with its hairline, and the row lines run under it (screenshots).
- Tried a 100-character name with no space on both screens at seven widths: no sideways scroll of the page or the table.
- Tried the Users table with the longest values the form allows: all actions leave the region at every width (follow-up #134, already tracked).
- Tried focus after a failed re-read through Edit, Add, Delete and a refused delete: focus is never left on `<body>`.

## Defects

None new. No Jira Bug and no GitHub issue were created.

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-021 / AQP-234 | Edit button outside the visible table area from 768 to about 1270 px | Sev-3 | Fixed in PR #135; verified here; ready for master's G7 | AQP-122 AC-7, ux-spec 6.0 |
| DEF-020 / AQP-235 | Focus ends on the page heading after a failed re-read | Sev-4 | Fixed in PR #135; verified here; ready for master's G7 | AQP-122 AC-8 |

Test defects of QA's own spec found and fixed before the final run (not product defects): the first "not covered" check read `elementFromPoint` for rows below the fold (null, so reported as covered), the Add dialog has no Close button, the label of the price field is "Price per kg", and the Add rate dialog needs a unit. The axe scans took 30 s and more with two workers on this machine, so the keyboard and axe checks are separate tests, and they pass in 7 to 10 s with one worker; this is the load effect the developer reported, not a product fault.

## Observations (no defect)

- **OBS-1 (test gap, closed here).** The developer's tests cover the Add-and-Escape-from-error path only on SCR-11, and the blocked-dialog path of QLT-01 only as a unit case. QA's `aqp-234-qa.spec.ts` adds both for SCR-13 and SCR-11, and Plant B shows they fail without the QLT-01 fix.
- **OBS-2 (follow-up #134).** SCR-14 Users hides all its actions with a 120-character name at every width from 768 to 1440 px. Already tracked; the measurement is posted on #134.
- **OBS-3.** The Audit table (SCR-16) needs 2070 px with long unbroken names in the data and scrolls inside its region at every width. It has no row actions. For the ux-expert if "Names wrap" is meant to reach this table too (OQ-UX-20).
- **OBS-4 (CI time).** QA's committed spec adds 30 desktop-only tests (G7-1 14, G7-3 2, G7-5 6, G7-7 8) to the pipeline, at about 6 s each with one worker. If master wants no new CI cost, `describe` blocks G7-1 and G7-7 can be dropped without losing a requirement, because the developer's 24 cases and `aqp-122-qa` cover the same ground; G7-3 (row lines) and G7-5 (focus, both screens, the blocked path) are the ones that add coverage.

## Conditions A and B of DL-122 (not QA's, noted for master)

- **A** (developer updates the PR Dev Record for round 2): the PR description now lists QLT-01 to QLT-04, commits `a698239` and `04bec3e` and `process-master.spec.ts`. Looks met.
- **B** (ux-expert changes the section 6.0 build note from `gap-s-1` to `gap-s-2`): **not yet done** on `origin/master` `9525a9f` (line 459 of `docs/03-ux/ux-spec.md` still says `gap-s-1`). The build uses `gap-s-2` (8 px), the Width rule's number, so no code change is needed. It is due before AQP-130 or #134 starts.
- The PR is behind `master`; per DL-121 the orchestrator updates it by a merge commit and CI must be green on the updated head before the squash.

## Residual risks

- Users (SCR-14) and later tables (Customers, Treatment / Color, SCR-03, SCR-17) will repeat DEF-021 unless they take `actionButtons` (#134, AQP-130).
- QLT-03's caveat stands: nothing isolates `scroll-padding-inline-end` from the sticky column (no table has a focusable control outside the Actions column yet).
- The local runs used Node 24 and the development server; CI's run on the same head used the project's Node and passed.

## Hand-off notes

Status of the issues is unchanged: AQP-234 and AQP-235 stay in *In QA* until master decides G7. Commit with this report: `tests/e2e/aqp-234-qa.spec.ts`, `docs/07-qa/AQP-234-test-report.md`, `docs/07-qa/AQP-234-evidence/`.
