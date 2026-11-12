# Test Report — AQP-275 (DEF-030): saved notices wrap a long user-entered name, so the page no longer scrolls sideways

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **M head = `e438ed9`** on `fix/AQP-275-notice-wraps-long-name` (PR #334, `sankumar76/Accucut-Quotation`). `e438ed9` = `327955c` (delivery lead's merge of `master` 3f22672) + `cfb05a8` (condition M) + `e438ed9` (comment reword). This report is the one commit on top of it (H2, docs only) |
| CI of the M head | Run **43233600652**, attempt 1, `pull_request`, 5 of 5 success (`Stages 1 to 11b`, E2E shards 1, 2, 3, `Stages 1 to 11`), 14:05:28Z to 14:11:07Z = 5:39 path, 0 failed, 0 flaky. Baseline: the push run of `master` 3f22672, **43197966408** (5 of 5, 10:10:23Z to 10:16:03Z = 5:40) |
| Environment | CI as above. Local: Windows 11, Node v24.19.0, Playwright Chromium, a **production build** of `e438ed9` (`next build`, `next start` on port 3275), a throwaway PostgreSQL 17 container `qa-aqp275-g7-db` on port 55447 (roles from `docker/postgres-init`, `prisma migrate deploy`, `ensure-seed-version.ts`; removed after the run). Shared databases not used. QA's own config and spec (`playwright.aqp275.prod.config.ts`, `tests/e2e/aqp-275-qa.spec.ts`) are **not committed** (DL-183 (6): the report is one commit). Invented data only |
| Date | 2026-11-12 |
| **Recommendation** | **ACCEPT.** Every item of DL-183 (6) has evidence and passes. Regression by name: 0 base names missing, delta +6 / +6 / +2 / +0. axe: 0 violations at 360, 768 and 1024 px. The sweep found **one other overflow, outside every notice: DEF-034 (proposed Sev-2, pre-existing, the top-bar account trigger, AQP-288 / #347)**. It is not in #334's 8 files and does not hold AQP-275. Open defects after this run: Sev-1 0, Sev-2 1 (DEF-034, blocks G8, not G7 of this story), Sev-3 0, Sev-4 0 |

## Summary

On the M head, activating a person with a 120-character name (no space) shows "<name> can sign in again." inside the window at 360, 768 and 1024 px: the page overflow is 0 px before and 0 px after the notice (DEF-030: 1011 px at 360 and 611 px at 768 and 1024), and the name wraps onto 7, 4 and 4 lines. The Admin-name notice title "There is already an active Admin: <120-character name>." wraps onto 8, 4 and 4 lines and adds no sideways scroll at any of the three widths. Every one of the 18 notices that repeat a user-entered name, swept at 360 px on Users, Process master, Materials and Treatment / Color, stays inside the window with the rule `overflow-wrap: anywhere` on the notice and 0 axe violations. QA's control (the rule removed from the rendered notice in the same build) brings the sideways scroll back at every width, so the measurement can see the defect. The sweep also found a different overflow that no notice causes: a 120-character signed-in name makes the top bar's account trigger 1,637 px wide and the page scrolls sideways by 632 to 1,021 px at 768 px and wider (DEF-034).

## N. CI of the M head and the regression by name (DL-183 (5), (6))

Run 43233600652, event `pull_request`, head `e438ed9`, attempt 1. Jobs API: `Stages 1 to 11b` success (14:05:28Z to 14:08:21Z), shard 3 success (to 14:09:30Z), shard 1 success (to 14:10:07Z), shard 2 success (to 14:10:58Z), `Stages 1 to 11` success (14:11:00Z to 14:11:07Z). I read the job logs of both runs myself.

| | Base 43197966408 (`3f22672`) | M head 43233600652 | Difference | Target |
|--|--|--|--|--|
| Vitest unit (`Test Files`) | 158 / 3,194 passed | 159 / **3,200** passed | **+1 file / +6** | +6 |
| Vitest full | 218 / 5,558 passed | 219 / **5,564** passed | **+1 file / +6** | +6 |
| E2E shard 1 | 279 passed, 3 skipped | 279 passed, 3 skipped | +0 | |
| E2E shard 2 | 277 passed, 4 skipped | **278** passed, 4 skipped | +1 | |
| E2E shard 3 | 264 passed, 17 skipped | **265** passed, 17 skipped | +1 | |
| E2E total | 820 passed, 24 skipped | **822** passed, 24 skipped | **+2 passed, +0 skipped** | +2 / +0 |

**By name.** E2E: I took every `✓` and `-` entry of the three shard logs of each run, removed `:line:col` and the duration, and matched by title. Base 844 entries (838 distinct titles), head 846. **All base titles are present in the head with the same multiplicity: 0 missing.** The only addition is "SCR-14 Users: the "can sign in again" notice wraps a long name (AQP-275, DEF-030) › after Activate, the notice holds a 120-character name inside the window and the page does not scroll sideways at 360 px" and the same at 768 px (+2). No `✘` entry, no `flaky`, no retry line in any shard. Vitest: per-file counts of the two runs (unit and full) are identical for all 376 base file lines; the only addition is `tests/unit/notice-wraps-long-names.test.ts (6 tests)` in each run (+12 tests over both runs). Locally, `notice-wraps-long-names.test.ts` and `tokens.test.ts`: 2 files, 70 tests passed. Stage 2 (Gitleaks): "no leaks found" (DL-188 (4)). CI path 5:39 against 5:40 on the base push run: this change adds no time (RISK-023 is unchanged).

## Verification of DL-183 (6)

| # | Item of DL-183 (6) | Test ID(s) | Technique | Result | Evidence |
|---|---|---|---|---|---|
| 1 | AQP-275's expected result at 360, 768 and 1024 px: Activate a person with a 120-character name; no page overflow; the notice wraps | CI: the 2 SCR-14 cases (360, 768 px) of `masters-table-actions.spec.ts`. QA: A1 at 360, 768, 1024 px | Boundary values (the three widths, the 120-character limit), before / after measurement, error guessing (no space in the name) | ✅ Pass | Table A1 below. Page overflow 0 before and 0 after at every width. Notice inside the window (16 to 344, 24 to 744, 280 to 992 px), `scrollWidth` = `clientWidth` for the notice and its description, `overflow-wrap: anywhere`, text on 7 / 4 / 4 lines. The notice ends exactly at the right gutter of the page |
| 2 | The Admin-name notice title wraps | QA: B1 at 360, 768, 1024 px (the Admin renamed to 120 characters, a second Admin refused in the Add user dialog) | Decision on the refusal (one active Admin), state coverage | ✅ Pass | Table B1 below. Title on 8 / 4 / 4 lines, `scrollWidth` = `clientWidth`, notice inside the window. At 768 and 1024 px the page does scroll sideways (990 and 943 px), but the number is the same before the notice appears and is 0 with the top bar hidden: the source is the top bar (DEF-034), not the notice |
| 3 | Sweep, 360 px, every notice that repeats a user-entered name: Users, Process, Materials, Treatment / Color | QA: C-U1 to C-U4, C-P1 to C-P5, C-M1, C-M2, C-T1 to C-T5, plus A1 and B1 at 360 px (18 in all) | Equivalence partitioning of the notice kinds (added, saved, deleted, renamed, password set, deactivated, activated, "no longer exists", "was already deleted", Admin name) | ✅ Pass | Table C below: 18 of 18 inside the window, no outsider element in the page body, `overflow-wrap: anywhere`, name on 7 to 12 lines, 0 axe violations. Notices on the other screens do not repeat a name (code read, below) |
| 4 | Any other overflow is its own defect | QA: B1 outsiders, D1 | Error guessing, boundary values on the name length (40, 58, 120) | ⚠️ One found | **DEF-034** (AQP-288, GitHub #347). Nothing else: no element of the page body sat outside the window in any of the 22 measurements |
| 5 | axe at 3 widths | QA: A1 and B1 at 360, 768, 1024 px, with the notice on screen | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (the suite's tags), run from the top of the page | ✅ Pass | 0 violations at all six scans, and 0 at the other 16 scans of the sweep (360 px). See "Accessibility" |
| 6 | The regression, read by name | Section N | Name matching, both runs | ✅ Pass | 0 of 844 base E2E entries missing; 0 of 376 Vitest file lines missing; +2 / +6 / +6 / +0 |

## A1. Activate, 120-character name, no space (QA, production build)

The person is made through `POST /api/v1/users`, deactivated through `PATCH`, and Activate is pressed on the row (table at 768 and 1024 px, card at 360 px).

| Width | Page overflow before | Page overflow after | Notice left - right (px) | Notice `scrollWidth` / `clientWidth` | Description `scrollWidth` / `clientWidth` | `overflow-wrap` | Lines | Other elements outside the window | axe |
|---|---|---|---|---|---|---|---|---|---|
| 360 | 0 | **0** | 16 - 344 | 323 / 323 | 261 / 261 | anywhere | 7 | 0 | 0 |
| 768 | 0 | **0** | 24 - 744 | 715 / 715 | 653 / 653 | anywhere | 4 | 0 | 0 |
| 1024 | 0 | **0** | 280 - 992 | 707 / 707 | 645 / 645 | anywhere | 4 | 0 | 0 |

**Control inside the same build.** With the rule taken off the rendered notice (`overflow-wrap: normal`), the notice text needs 1,338 px (the description 1,292 px) and the page scrolls sideways by **998 px at 360 px and 598 px at 768 and 1024 px**. So the 0 above comes from the rule, and the measurement can see the defect. (DEF-030 measured 1011 and 611 px on `master`; these are a constant 13 px less, with a different name and build, which I did not investigate further.) The 2 CI cases of the PR measure the same with the notice's own box and the page overflow, and master's control #335 turned 5 of the 6 new unit cases and the 2 SCR-14 cases red (DL-183 (1)).

## B1. Admin-name notice title (120-character Admin name)

The E2E Admin is renamed to a 120-character name through the Users API (the throwaway database; the name is put back after each test), then an Add user dialog is submitted with the role Admin, which the server refuses with the current Admin's name; the dialog is closed with Escape, and the page notice shows.

| Width | Page overflow before the notice | After the notice | With the top bar hidden | Title `scrollWidth` / `clientWidth` | Title lines | Notice inside window (px) | Page-body elements outside | axe | Control (rule off, top bar hidden) |
|---|---|---|---|---|---|---|---|---|---|
| 360 | 0 | 0 | 0 | 261 / 261 | 8 | 16 - 344 | 0 | 0 | 1,082 px back |
| 768 | 990 | 990 (adds **0**) | **0** | 653 / 653 | 4 | 24 - 744 | 0 | 0 | 682 px back |
| 1024 | 943 | 943 (adds **0**) | **0** | 645 / 645 | 4 | 280 - 992 | 0 | 0 | 682 px back |

The 990 and 943 px at 768 and 1024 px are present before any notice is shown and vanish when the top bar is hidden; all seven outside elements are inside the top bar's account trigger. That is DEF-034 below, not this notice. At 360 px the trigger shows the initials only, so nothing overflows.

## C. 360 px sweep of every notice that repeats a user-entered name

Names: 120 characters for people (the form's limit), 100 for rates, materials and treatments (`MASTER_NAME_MAX_LENGTH`), all with no space. Each notice was made by the real screen flow (dialog, keyboard or click) against the production build, except the "deleted elsewhere" ones, where the row is deleted through the API after the list was read. For each: the page overflow, the notice's box against the window, `scrollWidth` against `clientWidth`, `overflow-wrap`, the lines of text, every page-body element beyond the window, and axe.

| ID | Screen and notice | Page overflow | Notice inside window (px) | `scrollWidth` / `clientWidth` | Title lines (if a title) | Text lines | axe |
|---|---|---|---|---|---|---|---|
| A1@360 | Users: "<name> can sign in again." | 0 | 16 - 344 | 323 / 323 | | 7 | 0 |
| C-U1 | Users: Add user, "<name> was added." | 0 | 16 - 344 | 323 / 323 | | 7 | 0 |
| C-U2 | Users: Edit, "<name> was saved." | 0 | 16 - 344 | 323 / 323 | | 7 | 0 |
| C-U3 | Users: Reset password, "Password set for <name>. They must choose a new one..." | 0 | 16 - 344 | 323 / 323 | | 8 | 0 |
| C-U4 | Users: Deactivate, "<name> was deactivated and can no longer sign in." | 0 | 16 - 344 | 323 / 323 | | 8 | 0 |
| B1@360 | Users: Admin-name notice, title "There is already an active Admin: <name>." | 0 | 16 - 344 | 323 / 323 | 8 | 10 | 0 |
| C-P1 | Process master: Add rate, "<name> was added. The change is in the audit log." | 0 | 16 - 344 | 323 / 323 | | 7 | 0 |
| C-P2 | Process master: Edit, "<name> saved. ..." | 0 | 16 - 344 | 323 / 323 | | 6 | 0 |
| C-P3 | Process master: Delete, "<name> was deleted. ..." | 0 | 16 - 344 | 323 / 323 | | 7 | 0 |
| C-P4 | Process master: edit of a rate deleted elsewhere, title "<name> no longer exists." (warn) | 0 | 16 - 344 | 323 / 323 | 6 | 10 | 0 |
| C-P5 | Process master: delete of a rate deleted elsewhere, title "<name> was already deleted." (info) | 0 | 16 - 344 | 323 / 323 | 6 | 9 | 0 |
| C-M1 | Materials: Add material, "<name> was added. ..." | 0 | 33 - 327 | 289 / 289 | | 7 | 0 |
| C-M2 | Materials: Edit, "<name> saved. ..." | 0 | 33 - 327 | 289 / 289 | | 7 | 0 |
| C-T1 | Treatment / Color: Add, "<name> was added. ..." | 0 | 33 - 327 | 289 / 289 | | 7 | 0 |
| C-T2 | Treatment / Color: Rename, "<old> was renamed to <new>." (two 100-character names) | 0 | 33 - 327 | 289 / 289 | | 12 | 0 |
| C-T3 | Treatment / Color: Delete, "<name> was deleted. ..." | 0 | 33 - 327 | 289 / 289 | | 7 | 0 |
| C-T4 | Treatment / Color: rename of a treatment deleted elsewhere, title "<name> no longer exists." | 0 | 33 - 327 | 289 / 289 | 7 | 12 | 0 |
| C-T5 | Treatment / Color: delete of a treatment deleted elsewhere, title "<name> was already deleted." | 0 | 33 - 327 | 289 / 289 | 7 | 10 | 0 |

All 18 have `overflow-wrap: anywhere` computed on the notice (the class is now applied by `Notice` itself, and the three masters screens no longer pass it) and 0 page-body elements outside the window. The 12 masters cases are the ones that the PR moved from a caller's class to `Notice`, so they show that moving the class lost no wrapping.

**Notices that do not repeat a user-entered name (code read, not measured).** `exchange-rates-panel.tsx` (static texts), `audit-screen.tsx` (the "show more failed" title), `sign-in-form.tsx` and the sign-in page (static), and every danger notice inside a dialog (`FAILED_ADD_MESSAGE` and the like: static). Not in scope: the SCR-11 / SCR-13 "No match" empty-state title, which prints the search text but is an empty state, not a notice (GitHub #123, and the AQP-122 CI case that covers it).

## DEF-030 against the story's result

| Step | Before (DEF-030, `master` 03e21f2 / 3f22672) | After (M head `e438ed9`) | Result |
|---|---|---|---|
| Activate, 120 characters, 360 px | page 0 to **1011 px** | 0 to **0 px** | ✅ |
| Activate, 120 characters, 768 px | 0 to **611 px** | 0 to **0 px** | ✅ |
| Activate, 120 characters, 1024 px | 0 to **611 px** | 0 to **0 px** | ✅ |
| Notice wraps like the names in the table and cards (ux-spec 6.0 "Names wrap") | no | yes, `anywhere`, 4 to 7 lines | ✅ |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| New tests of the PR | CI: `notice-wraps-long-names.test.ts` (6) in each Vitest run; 2 SCR-14 cases in `masters-table-actions.spec.ts` (shards 2 and 3) | 6 + 6 + 2 | all | 0 | 0 | |
| Same, local | `npx vitest run tests/unit/notice-wraps-long-names.test.ts tests/unit/tokens.test.ts` | 70 | 70 | 0 | 0 | 2.3 s |
| Full regression, Vitest | CI `Stages 1 to 11b` | 3,200 + 5,564 | all | 0 | 0 | |
| Full regression, E2E | CI shards 1, 2, 3 | 846 | 822 | 0 | 24 | 3.6 m / 4.4 m / 3.0 m |
| QA measurement spec (not committed) | `npx playwright test -c playwright.aqp275.prod.config.ts` (production build, 1 worker, no retry) | 25 + 1 set-up | 24 | 2 | 0 | 4.0 m |
| QA measurement spec, B1 re-run | the same with `-g B1` | 3 + 1 set-up | 4 | 0 | 0 | 55 s |

The two failures of the 4.0 m run were **test defects of QA's own spec** (type: test, no product fault): B1 at 768 and 1024 px asserted that the control (rule removed) raises the page overflow above the baseline, but the baseline was the top bar's 990 and 943 px, which already exceed the notice's own 682 px, so the assertion could not hold. I moved the control to a page with the top bar hidden, ran B1 again (4 of 4 passed, the numbers above are that run) and changed nothing in the product. An earlier run also had one failure of QA's own, C-M1 (my keyboard walk pressed Tab after the last field, so Enter pressed Cancel); fixed and run again, it passed. All 18 notice measurements above are from the 4.0 m run (all passed there) and the B1 re-run.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Layout at 360, 768, 1024 px | NFR-016, FR-085, SC 1.4.10 | A1, B1, C above | Pass for every notice. Fail for the top bar with a 120-character signed-in name (DEF-034, outside this PR) |
| Accessibility | NFR-016 / WCAG 2.2 AA | axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) from the top of the page, notice on screen: A1 at 360, 768, 1024; B1 at 360, 768, 1024; C at 360 | 0 violations at all 22 scans. Roles unchanged: the success notices are `role="status"` and the Admin-name notice `role="alert"`, as before |
| Performance | RISK-023 | CI path | 5:39 on the head against 5:40 on the base push run: no change from this PR. (The path is above the 5:30 line of DL-142 (1) in both runs, so it is the base's state, not this change's) |
| Security smoke | | The diff adds a CSS class and moves a constant; no data path, route, input or message | Not applicable to the diff. The QA spec's API calls send the same origin header as the screen |
| Dependency on text | | The class is a string constant in `break-long-names.ts`; `tokens.test.ts` (hex colours) passes with the `@deprecated` line | Pass |

## Exploratory Testing

Charter: "Explore every place a notice prints a name a person typed, at the widths where the layout changes, with the longest name the form allows and no space, looking for any element that reaches beyond the window" · time-box 60 minutes · areas: the 18 notices, the Admin-name title, the signed-in name in the top bar, the move of the class into `Notice`.

- Moving the class into `Notice` did not lose wrapping anywhere: the three masters screens no longer pass it and all their notices (with and without a title) still wrap.
- Both titles that carry a name wrap as well as the text: the warn / info title of a row deleted elsewhere (6 and 7 lines at 360 px) and the Admin-name title (8 lines).
- **Found: DEF-034.** While the signed-in Admin carries a 120-character name, the account trigger in the top bar is 1,637 px wide at 768 px and wider and the whole page scrolls sideways (1,021 px at 768, 974 at 1024, 632 at 1366). A 58-character name with spaces (517 px) and a 40-character one (382 px) do not overflow, so the limit is somewhere between 58 and 120 characters. The cause is in `account-trigger.tsx`: the name span has `truncate` but the button has no `min-w-0` or `max-w-full`, so nothing narrows it. It is in the shared shell, so every signed-in page is affected; I measured `/users`. Not caused by #334 (the PR's 8 files do not include it). Reported as its own defect as DL-183 (6) asks.
- Not tested: the dialogs' titles with a 120-character name (AQP-245 and AQP-122 CI cases cover Users and masters dialogs); a real mobile device; Firefox and WebKit (the project runs Chromium only).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-030 | Users "can sign in again" notice does not wrap a 120-character name (AQP-275, #325) | Sev-2 | **Fixed in #334, verified here** (pending master's G7 and the merge) | the story's expected result |
| DEF-034 | Top-bar account trigger does not truncate a long signed-in name; every page scrolls sideways at 768 px and wider (1,021 px at 768, 974 at 1024, 632 at 1366 with 120 characters). Jira Bug [AQP-288](https://sankumar76.atlassian.net/browse/AQP-288), GitHub [#347](https://github.com/sankumar76/Accucut-Quotation/issues/347), related to AQP-275 | **Proposed Sev-2 Major** (a WCAG 2.2 AA reflow failure on a shared component, the DEF-030 / DL-174 precedent; the likelihood is low because a name must be longer than about 60 characters, which master may weigh) | New | none (pre-existing, outside #334) |

The defect's body is in the Jira Bug and the GitHub issue. I did not add `docs/07-qa/defects/DEF-034-*.md` to this commit because DL-183 (6) wants H2 to be the report alone; it can be added with the next docs PR. DEF-034 does not hold G7 of this story (pre-existing and outside the PR's 8 files, DL-094); it blocks G8 as a Sev-2 unless master grades it lower. DEF-031 (AQP-285, #342, the customer page h1) is a separate defect in #297's code and is not logged again here.

## Residual Risks / Notes

- The measurements are on a production build of the M head, with the QA spec's browser at 900 px height; CI covers the production build for the two SCR-14 cases.
- `master-texts.ts` still re-exports `BREAK_LONG_NAMES` with a `@deprecated` note until #225 moves its importers; #297's two redundant `className` props are dropped by #225 (DL-183 (4), QLT-01). No behaviour risk.
- Merge prerequisites are the orchestrator's (DL-183 (7), DL-189 (5)): strict protection means a later `master` move needs another update with empty-diff checks; the files are then the PR's 8 plus this report.
- Throwaway container `qa-aqp275-g7-db` is removed after the run; other containers on the machine (`aqp275-db`, `aqp142-db` and the rest) were not touched.
