# Test Report — AQP-245 (STORY-10.21): Users list (SCR-14), the masters-table pattern so every row action stays visible

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **H1 = `03e21f2`** on `fix/AQP-245-users-table-actions` (PR #222, `sankumar76/Accucut-Quotation`). Parents `d59e8ea` and `master` `6b1883f`. The CI merge ref `025b1c0` has parents `6b1883f` (the `master` tip) and `03e21f2`. This report is the one commit on top of it (H2, docs only) |
| CI | Run **43175448561**, attempt 1 (the only attempt), 5 of 5 success (`Stages 1 to 11b`, E2E shards 1, 2, 3, `Stages 1 to 11`), path 5:20 (first job 07:27:56Z, last job 07:33:16Z), 0 failed, 0 flaky, 0 retried |
| Environment | CI as above. Local: Windows 11, Node v24.19.0, Playwright 1.65.0 Chromium, `next dev` (Turbopack) on port 3245, a throwaway PostgreSQL 17 container on port 55472 (roles from `docker/postgres-init`, `prisma migrate deploy`, `ensure-seed-version.ts`; removed after the run). The shared databases were not used. Local config `playwright.qa245.config.ts` and spec `tests/e2e/aqp-245-qa.spec.ts` are QA's own and are **not committed** (DL-170 (6)(d): this commit adds the report alone). Invented data only |
| Date | 2026-11-12 |
| **Recommendation** | **ACCEPT.** AC-1 to AC-6 pass. CI is 5 of 5 at the target counts with every base test name present. QA's own control is red in the forced modes. One new defect was found by exploration, **DEF-030 (Sev-3, pre-existing, not an AC of this story)**. Open defects: Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 0 |

## Summary

On H1 every row action of the Users table stays inside the region's visible box at the seven widths of ux-spec 6.0 with the longest values the form accepts (a 120-character name with no space and a 254-character e-mail). The table now fits as drawn at all seven widths (`scrollWidth - clientWidth = 0`), against 1603 px of content and 18 of 18 actions outside the region in the G7-2b baseline. Forced to scroll, from its start and at its end, 0 of 66 to 84 actions are outside or covered. The Activate row, a busy row, a real keyboard Tab across a non-own row, axe at 768, 1024 and 1366 px, and the 360 px cards all pass. `users.spec.ts` and `users-production.spec.ts` are unchanged and their 33 CI instances pass. QA's control (`TableActionsCell` replaced by `TableCell`) turns the 11 SCR-14 width cases red at "forced to scroll, at its start: action 0 ends inside the region" and leaves the other 35 cases of the file green. Exploration found one thing outside the story: a saved notice that repeats a 120-character name makes the page scroll sideways (DEF-030, raised, routed to master).

## N. CI of H1 (DL-170 (6)(b))

Run 43175448561, event `pull_request`, head `03e21f2`, attempt 1. Jobs API: `Stages 1 to 11b` success (07:27:56Z to 07:31:29Z), shard 1 success (to 07:32:39Z), shard 2 success (to 07:33:07Z), shard 3 success (to 07:33:01Z), `Stages 1 to 11` success (07:33:10Z to 07:33:16Z). The only skipped steps are the cache-hit install steps and the disabled stage 13. Reference: the push run of the `master` commit in the merge ref, **43169697211** (`6b1883f`, success), whose shard logs I read the same way.

| | Base 43169697211 (`6b1883f`) | H1 03e21f2 (run 43175448561) | Difference | Target |
|--|--|--|--|--|
| Vitest unit (`Test Files 157`) | 3,185 passed | 3,185 passed | 0 | +0 |
| Vitest full (`Test Files 217`) | 5,549 passed | 5,549 passed | 0 | +0 |
| E2E shard 1 | 275 passed, 3 skipped | **279** passed, 3 skipped | +4 | 279 |
| E2E shard 2 | 273 passed, 4 skipped | **277** passed, 4 skipped | +4 | 277 |
| E2E shard 3 | 260 passed, 17 skipped | **264** passed, 17 skipped | +4 | 264 |
| E2E total | 808 passed, 24 skipped | **820** passed, 24 skipped | **+12** | 820 / 24 |

Totals match exactly and so does the per-shard split, so there is nothing to explain. **Names:** I extracted every `✓` and `-` entry of the six shard logs, removed `:line:col` and the duration, and matched by title (a truncated title is matched as a prefix of more than 40 characters). Base: 832 entries (808 + 24), 826 distinct. **All base names are present in H1: 0 missing.** The 12 names that H1 adds are the 11 SCR-14 width cases (768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440 px, each titled "AC-1, AC-2, AC-3, AC-5: ...") and the AC-4 card case at 360 px. No `✘` entry, no `flaky`, no retry line in any shard. The script is `names.cjs` in the QA scratch folder (outside the repository).

## AC Verification Matrix

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 Actions visible at eleven widths | CI: the 11 SCR-14 cases of `tests/e2e/masters-table-actions.spec.ts` (768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440 px). QA: M1 (seven §6.0 widths), M3, M4 | Boundary values (the widths around the 1024 px drawer switch: 1023 / 1024; 1279 / 1280), state coverage (as drawn, forced, scrolled to the end), error guessing (120 + 254 characters) | ✅ Pass | CI: 11 of 11 passed in shard 3 of run 43175448561. QA M1: at 768, 1023, 1024, 1279, 1280, 1366 and 1440 px `scrollWidth - clientWidth` is **0** as drawn (G7-2b: 1603 px of content in a 710 to 1126 px region), **0 of 66 to 84 actions outside** the region (G7-2b: 18 of 18 outside), 0 covered, page overflow 0. Forced to scroll (1000 px, or region + 200 px): 0 outside and 0 covered at the start and at the end. Tables below |
| AC-2 The pattern, as built for SCR-11 and SCR-13 | Code read of `users-list.tsx`; QA M2 (computed styles) | Inspection + measurement | ✅ Pass | `users-list.tsx:121` `actionButtons={3}`; `:128` `TableActionsHead`; `:142` `TableActionsCell`; `:80` wrapper `flex flex-nowrap items-center justify-end gap-s-2`; `:134` name cell `BREAK_LONG_NAMES`. M2 at 1366 px: region `scroll-padding-inline-end` 156px and `--actions-w` 156px; Actions heading and cells `position: sticky`, `right: 0`, 156 px wide; wrapper `flex-wrap: nowrap`, `column-gap: 8px`; name cell `overflow-wrap: anywhere`; all headings `white-space: normal` |
| AC-3 Own row and disabled buttons | CI SCR-14 cases (own row checks); QA M2 (own row), M3 | Decision on the row type (own / other / deactivated) | ✅ Pass | M2: own row has 3 buttons in the same horizontal positions as another row (left edges 1193 / 1237 / 1281 in both); Edit enabled, Reset password and Deactivate `disabled` with the names `Reset password is not available for your own account. Use Change password in the account menu.` and `You cannot deactivate your own account`. No existing Users behaviour changed: `users.spec.ts` unchanged and 28 of 28 passed (see AC-6); M3 activates a person by keyboard and the row then shows Deactivate |
| AC-4 Cards below 768 px unchanged | CI AC-4 card case; QA M7 | Boundary values (320, 360, 767 | 768 px) | ✅ Pass | M7: table hidden and cards shown at 320, 360 and 767 px; table shown and cards hidden at 768 px. 36 cards and 108 buttons at each of the three widths: 0 outside the window, 0 icon-only, text labels `Edit`, `Reset password`, `Deactivate`, page overflow 0, the 120-character name wraps inside its card (card `scrollWidth` = `clientWidth`) |
| AC-5 Keyboard and focus | CI SCR-14 cases (Tab through the long-name row, axe at 768, 1024, 1366); QA M5, M6 | Real key presses, hit-testing, axe | ✅ Pass | M5 (1024 px, table forced to 1000 px, region scrolled): Tab and Shift+Tab across a non-own row reach Edit, Reset password, Deactivate in order; each is inside the region, hit-tested as the topmost element at its own centre (not covered by the sticky column), matches `:focus-visible` with a `solid 3px` outline, and the page did not move sideways (`scrollX` 0). The first Tab with the region at `scrollLeft` 0 scrolled it to 290 to bring the button into view. M6: axe `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` finds 0 violations (0 incomplete) at 768, 1024 and 1366 px, as drawn and forced |
| AC-6 Nothing else moves | Diff; CI run 43175448561; QA M1 to M8 | Regression | ✅ Pass | `git diff 6b1883f 03e21f2 --stat` lists exactly `users-list.tsx` (+9 / -9) and `masters-table-actions.spec.ts`; `git diff 6b1883f 03e21f2 -- tests/e2e/users.spec.ts tests/e2e/users-production.spec.ts` is empty. CI instances of those files, head against base: users mobile 7 / 7, tablet 7 / 7, desktop 14 / 14, users-production desktop 5 / 5, all passed (33 of 33). Vitest unchanged (3,185 / 5,549). No test dropped, skipped or given a longer timeout: 0 base names missing, skipped 24 = 24. The PR states 12 added instances, desktop only, not `@one-width` |

## QA measurements on H1 (SCR-14 Users, development server, Chromium)

Method: a 120-character name with no space and a 254-character e-mail are created through the Users API (one new person per test, so the list grows as the tests add people, from 22 rows at the first test of the final run to 31 at the last; every row after the first six is also a long-name row). The viewport is 6000 px high so that every row is hit-tested; the few buttons below the fold are counted in "not on screen" and are still checked by position. "Outside" means a button's box is not inside the region's box (0.01 px tolerance). "Covered" means `elementFromPoint` at the button's centre is not the button. "Forced" means the table's `min-width` is set to 1000 px, or the region width + 200 px when that is larger (the spec's method), because the baseline's "forced to 1000 px" figures were unreliable (React re-rendered the edited row). The baseline is G7-2b of AQP-234: content 1603 px at every width, 18 of 18 actions outside the region, region widths 718 / 973 / 710 / 965 / 966 / 1052 / 1126 px. The region widths below are the same, so the shell is unchanged.

### M1: seven widths, 120-character name, 254-character e-mail (all pass)

| Width | Region `clientWidth` | Table as drawn `scrollWidth` | `scrollWidth - clientWidth` | Actions | Outside | Covered (hit-tested / not on screen) | Forced to | Start: outside / covered | End: outside / covered | Page overflow |
|---|---|---|---|---|---|---|---|---|---|---|
| 768 | 718 | 718 | 0 | 66 | 0 | 0 / 0 | 1000 | 0 / 0 | 0 / 0 (scrollLeft 282) | 0 |
| 1023 | 973 | 973 | 0 | 69 | 0 | 0 / 0 | 1173 | 0 / 0 | 0 / 0 (scrollLeft 200) | 0 |
| 1024 | 710 | 710 | 0 | 72 | 0 | 0 / 6 | 1000 | 0 / 0 | 0 / 0 (scrollLeft 290) | 0 |
| 1279 | 965 | 965 | 0 | 75 | 0 | 0 / 0 | 1165 | 0 / 0 | 0 / 0 (scrollLeft 200) | 0 |
| 1280 | 966 | 966 | 0 | 78 | 0 | 0 / 0 | 1166 | 0 / 0 | 0 / 0 (scrollLeft 200) | 0 |
| 1366 | 1052 | 1052 | 0 | 81 | 0 | 0 / 0 | 1252 | 0 / 0 | 0 / 0 (scrollLeft 200) | 0 |
| 1440 | 1126 | 1126 | 0 | 84 | 0 | 0 / 0 | 1326 | 0 / 0 | 0 / 0 (scrollLeft 200) | 0 |

In every case the long row's three buttons are 36 x 36 px with 8 px between them. As drawn, the long name wraps in its column (the name cell is 135 to 355 px high depending on the width) and the table needs no scrolling, which is the intended behaviour of ux-spec 6.0 "Names wrap".

### M3: a deactivated person (Activate), long name and e-mail, 768, 1024 and 1366 px (pass)

The row has Edit, Reset password and Activate (`data-action="activate"`, accessible name `Activate <name>`, enabled, badge "Deactivated"). Buttons are 36 x 36 px with 8 px gaps, inside the region, none covered, as drawn and forced, at the start and at the end (90 actions, 0 outside; as drawn 24 of them below the fold at 768 and 1024 px, checked by position). Pressing Enter on Activate with the table forced at 1024 px shows "<name> can sign in again." and the row then shows Deactivate.

### M4: a busy row, 1024 px, table forced (pass)

The answer of `PATCH /api/v1/users/:id` was held. While it was pending the Activate button had `aria-busy="true"` and was disabled (2 elements under `main` carried `aria-busy="true"`; the second was not identified), and **nothing moved**: the three buttons stayed at 851 to 887, 895 to 931 and 939 to 975 px, 36 x 36 px, the table stayed 1000 px wide, 0 outside, 0 covered, page overflow 0. After the answer the row shows Deactivate in the same position. (The page overflow of 611 px that appears after the answer comes from the notice and is DEF-030, below.)

### M5: real keyboard, 1024 px, table forced to 1000 px, a non-own row

First row is the signed-in Admin (only Edit is enabled). Focus on that Edit, then four Tab and four Shift+Tab presses (Playwright `keyboard.press`), once with the region at its start and once at its end.

| Step | Focused | Left - right (px) | Inside region | Covered | `:focus-visible` (outline) | Region `scrollLeft` | Page `scrollX` |
|---|---|---|---|---|---|---|---|
| Tab 1 | Edit E2E Lead | 851 - 887 | yes | no | yes (solid 3px) | 290 | 0 |
| Tab 2 | Reset password for E2E Lead | 895 - 931 | yes | no | yes (solid 3px) | 290 | 0 |
| Tab 3 | Deactivate E2E Lead | 939 - 975 | yes | no | yes (solid 3px) | 290 | 0 |
| Tab 4 | Edit E2E Engineer (next row) | 851 - 887 | yes | no | yes (solid 3px) | 290 | 0 |
| Shift+Tab 1 to 4 | Deactivate E2E Lead, Reset password for E2E Lead, Edit E2E Lead, Edit E2E Admin | same columns | yes | no | yes | 290 | 0 |

The rows are identical when the region starts at `scrollLeft` 0 (Tab 1 scrolled it to 290) and when it starts at its end. The region's visible box is 281 to 991 px.

### M6: axe at three widths

| Width | Mode | Violations | Rules passed | Incomplete |
|---|---|---|---|---|
| 768 | as drawn / forced | 0 / 0 | 24 / 26 | 0 / 0 |
| 1024 | as drawn / forced | 0 / 0 | 26 / 28 | 0 / 0 |
| 1366 | as drawn / forced | 0 / 0 | 26 / 28 | 0 / 0 |

### M7: card list (AC-4)

| Width | Table | Cards | Buttons | Outside window | Icon-only | Page overflow | Card `clientWidth` / `scrollWidth` | Labels (button width px) |
|---|---|---|---|---|---|---|---|---|
| 320 | hidden | 36 | 108 | 0 | 0 | 0 | 286 / 286 | Edit 86, Reset password 163, Deactivate 130 |
| 360 | hidden | 36 | 108 | 0 | 0 | 0 | 326 / 326 | Edit 86, Reset password 163, Deactivate 130 |
| 767 | hidden | 36 | 108 | 0 | 0 | 0 | 733 / 733 | Edit 86, Reset password 163, Deactivate 130 |
| 768 | shown, cards hidden | | | | | | | |

## QA's own control: `TableActionsCell` replaced by `TableCell` on Users

Branch `control/AQP-245-qa-g7` (kept) from H1 with H1 as its only parent, draft PR **#324** (never merged, closed after reading). The edit was made by an anchor-once script that exits without writing unless each anchor occurs exactly once, and the diff was printed first (PR #324 body): the import loses `TableActionsCell`, and `<TableActionsCell>` / `</TableActionsCell>` become `<TableCell>` / `</TableCell>` (3 lines changed, 1 file). `TableActionsHead` and `actionButtons={3}` are untouched, so the control isolates the sticky body cell.

- **CI, run 43177111733 (cdc384e), attempt 1:** `Stages 1 to 11b` success, shard 1 success (279 passed, 3 skipped), shard 2 success (277 passed, 4 skipped), **shard 3 failure: 11 failed, 253 passed, 17 skipped** (253 = 264 - 11). The failed list is the 11 SCR-14 width cases of `masters-table-actions.spec.ts` (768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440 px), each failing on both attempts (22 error lines) at `expectActionsInside` with the message "**forced to scroll, at its start: action 0 ends inside the region**" (for example expected <= 743, received 921). The as-drawn step of the same cases passes, as it should: the table fits, so the sticky column matters only when the table scrolls. The other 35 cases of the file stay green: SCR-11 (11), SCR-13 Materials (11), SCR-13 Treatment / Color (11), the Treatment "(e)" test and the SCR-14 card case. `Stages 1 to 11` failure follows from shard 3. So the control is red in the forced modes and in no other.
- **Local run of the control:** attempted with QA's measurement spec on the control branch in a second worktree, but its development server (webpack, because Turbopack cannot resolve a linked `node_modules`) did not compile the set-up pages within the 180 s limit, so the set-up test failed and no measurement was taken. Nothing is claimed from it. The CI run above is the control evidence, as DL-147 (6) and the brief allow for QA-only runs on a throwaway PR.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| New acceptance tests of the story (SCR-14 cases in `masters-table-actions.spec.ts`) | CI stage 12, shard 3 of run 43175448561 (`playwright test --shard`) | 12 | 12 | 0 | 0 | within the 4.0 m shard |
| Full regression, Vitest | CI `Stages 1 to 11b` | 3,185 + 5,549 | all | 0 | 0 | |
| Full regression, E2E | CI shards 1, 2, 3 | 844 | 820 | 0 | 24 | 3.8 m / 4.3 m / 4.0 m |
| QA measurement spec (M1 to M8, not committed) | `npx playwright test -c playwright.qa245.config.ts tests/e2e/aqp-245-qa.spec.ts --project=desktop` | 18 + 2 set-up | 20 | 0 | 0 | 3.6 m |
| QA control, CI | PR #324, run 43177111733 | 35 + 11 (SCR-14) | 35 | 11 | | red as intended |

The first local run of the QA spec had two failures that were defects of QA's own measurement (M3 and M4 counted buttons below the fold as "covered" because `elementFromPoint` returns null off screen). I fixed the spec (a 6000 px viewport and a separate "not on screen" count) and ran the whole spec again; the table above is that second run. Nothing in the product changed between the two.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Layout at 768 to 1440 px | NFR-016, FR-085 | M1 above | Pass: no sideways scroll of the table or the page, every action reachable |
| Touch target | NFR-017 | Button boxes in M1, M3, M4 | 36 x 36 px row buttons in the table (the dense-table size of ux-spec 6.0), unchanged by this story; the cards keep full-size buttons |
| Accessibility | NFR-016 / WCAG 2.2 AA | axe (M6), keyboard walk (M5), accessible names (M2, M3) | Pass: 0 violations at 3 widths in 2 modes; focus ring 3 px; names unchanged |
| Performance timing | RISK-023 | CI path and per-case means from the shard 3 log | Path 5:20 (under the 5:30 line of DL-142 (1)). The 12 added instances cost 3.0 s per SCR-14 case on average (PR table; I did not re-measure) |
| Security smoke | | The change draws existing buttons only: no data path, route, input or message was added (2 files) | Not applicable to the diff; the own-row disabled buttons keep the server-side refusal untouched (STD-01) |

## Exploratory Testing

Charter: "Explore the Users table and its states with the longest values the form allows, at the widths where the layout changes, looking for any horizontal overflow, covered button or moved button" · time-box 60 minutes · areas: long name and e-mail, deactivated person, busy row, own row, keyboard, cards around 767 / 768 px, the notices that follow a change.

- The table fits as drawn at every width with the long values, so it never needs the sticky column in normal use; the sticky column is the guarantee when a name or width pushes the table wider (forced modes).
- The Name column wraps the 120-character name onto many lines at 768 and 1024 px (a row up to 355 px high). That is the ruled behaviour (names wrap), not a defect, but a list of such names is tall.
- **Found: DEF-030.** After pressing Activate on a person with a 120-character name, the saved notice "<name> can sign in again." does not wrap and the page scrolls sideways by 611 px (768 and 1024 px) and 1011 px (360 px); the page had no overflow before. The notice is the shared `Notice` and `users-screen.tsx:132`, neither in this story's diff, so this is pre-existing on `master` 6b1883f and not a regression. Raised as a defect, not held against the story.
- Not tested: the dialogs (Edit, Reset password, Deactivate) with a 120-character name; `users-production.spec.ts` against a local production build (CI ran it on the same head: 5 of 5 passed).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-030 | Users "can sign in again" notice does not wrap a 120-character name; the page scrolls sideways (611 px at 768 and 1024 px, 1011 px at 360 px). Pre-existing, found in exploration. Jira Bug [AQP-275](https://sankumar76.atlassian.net/browse/AQP-275), GitHub [#325](https://github.com/sankumar76/Accucut-Quotation/issues/325) | Sev-3 Moderate (test plan section 6: a layout defect that leaves every action reachable) | New | none (outside AC-1 to AC-6; related to the AC-4 intent of no sideways scroll) |

The defect's body is in the Jira Bug and the GitHub issue. I did not add `docs/07-qa/defects/DEF-030-*.md` to this commit because DL-170 (6)(d) wants H2 to be the report alone; the orchestrator or master can have it added with the next docs PR. Sev-3 is fixed before G8 or accepted by master in writing (test plan section 6); it does not hold G7.

## Residual Risks / Notes

- RISK-023 (CI path): 5:20 on this head, within the 5:30 line.
- The measurements are on the development server; the CI run covers the production build for `users-production.spec.ts`. The layout classes are the same in both.
- The M5 walk starts from the Admin's own row. The Admin's own Reset password and Deactivate are disabled and are not tab stops, so the walk reaches the second row's Edit first; this is expected and is what AC-3 describes.
- The control branch `control/AQP-245-qa-g7` is kept and PR #324 is closed unmerged after reading, per the brief. The delivery lead can delete the branch with the other control branches before G8.
- Merge prerequisites are the orchestrator's (DL-170 (7)): strict protection means a later `master` move needs another empty-diff update; the three files are then `users-list.tsx`, the spec and this report.
