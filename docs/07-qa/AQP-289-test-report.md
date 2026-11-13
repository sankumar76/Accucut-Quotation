# Test Report — AQP-289 (DEF-035, Sev-2): The Process "No match" empty-state title wraps a long search

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **H2 = `43182d9`** on `fix/AQP-289-empty-state-title-wrap` (PR #361, `sankumar76/Accucut-Quotation`). H2 has one parent, H1 `b7fbad8` (the fix), whose parent is `b6b38c5`. This report is the one commit on top of H2 (H3, docs only). Tested as checked out: `master` was not taken into the branch |
| CI evidence | See "Where the browser checks ran". Control PR #366 (draft, closed unmerged), run **43374926854** on `9e4839b`, 5 of 5 `success`; early Q-12 control PR #367 (draft, closed unmerged), run **43374170593**, 5 of 5 `success`; G7 regression run **43274032611** on H2 against push run **43261705805** |
| Environment | CI only (`ubuntu-latest`, 4 workers per shard, the `next dev` server on port 3100, throwaway PostgreSQL, Playwright Chromium). **No local server, build, database or Playwright** (the machine had about 0.9 GB free; the orchestrator's method change, Jira 11780). Invented data only |
| Date | 2026-11-13 |
| Governing rulings | DL-199 (6) (QA scope), DL-202 (V and C met; Q-12), DL-196 (10)(f). Requirements: NFR-016 (no sideways page scroll), NFR-018 (axe, five tags), FR-085, ux-spec 6.0 "Names wrap" |
| **Recommendation** | **ACCEPT** |

## Summary

DEF-035 is fixed. With a 100-character search of `W` (a wide letter with no break point), the SCR-11 Process master "No rate matches" title and the SCR-13 Materials "No material matches" title wrap inside the window at 360, 768, 1024 and 1366 px: page overflow is 0 in all 24 readings, the title box is inside the viewport, the full search text is in the title, and the title has 3 to 8 lines (never fewer than 3, so no reading is vacuous). axe finds 0 violations with the five NFR-018 tags. The fixed empty-state titles are unchanged. Regression is +7 / +7 / +3 / +0 against the base run with 0 base names missing and 0 flaky. **No new defect. Open defects: Sev-1 0, Sev-2 0** (DEF-035 itself is verified), Sev-3 1 (DEF-036, not this story's, named below).

## Where the browser checks ran (method)

1. **Control PR #366** (draft, `control/AQP-289-qa-g7`, closed unmerged): H2 plus **one** added file, `tests/e2e/aqp-289-qa.spec.ts` (186 lines, no product file). Each test sets its own viewport with `test.use({ viewport })`, so the four widths, 1024 px included (it is not a CI project), run in one project. It uses the repo's helpers (`expectNoAxeViolations` with `AXE_TAGS` = `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; `horizontalOverflow`; `waitUntilHydrated`; `ADMIN_STATE`). It carries no `@one-width` tag and no desktop-only skip, so `tests/unit/one-width-tag.test.ts` and `own-width-files.test.ts` accept it unchanged (their "every other test runs in all three projects" rule applies): each case therefore runs once in each of the three projects (3 x 18 = 54 passes), which is redundant but harmless. The control's unit stage passed (Vitest 169 files / 3,340 and 231 / 5,825).
2. **Control run 43373958568** (head `756a289`, first spec version): the 24 DEF-035 readings passed; 18 instances of my own "fixed titles" cases failed (`No rates yet`, `No materials yet`, the audit screen, 6 cases x 3 projects, plus their retries). **Test defects of the control, not product defects:** both master screens read their first paint on the server, so my route stub before `goto` never applied. The fix is the screens' own method (stub the next read, then a Save makes the screen read again), in head `9e4839b`. The red run is kept here for honesty, not hidden.
3. **Control run 43374926854** (head `9e4839b`, the spec as read in this report): 5 of 5 `success`. The merge ref in every job is `2a8e43b` = `9e4839b` into `master` `e76b513`, so the control tree is H2's product files plus `master`'s newer code (#297 Customers and the rest). `master` changed none of #361's six product and test files (DL-202 (6)), so the DEF-035 readings on this tree are the readings of H2's product change.
4. Output lines start with `QA289` in the job logs (read with `gh api ... --allow-escape-sequences`, ANSI codes stripped; no log kept whole).
5. **Field maximum: n/a.** `master-search-box.tsx` sets no `maxLength`, so the search accepts any length; the 100 characters are the form maximum of a master name (`MASTER_NAME_MAX_LENGTH = 100`), the length DL-199 fixed.

## AC Verification Matrix (DL-199 (6) (a) to (g))

DEF-035 has no numbered ACs; its expected result is "the title wraps inside the window like every other name (ux-spec 6.0) and the page does not scroll sideways (NFR-016, FR-085)". The rows are DL-199 (6)'s items.

| Item | Test | Technique | Result | Evidence |
|------|------|-----------|--------|----------|
| (a) SCR-11 No match, 100 `W`, 360 / 768 / 1024 / 1366 px: overflow <= 0, title inside the window, full text, 3 or more lines | `aqp-289-qa.spec.ts` "SCR-11 Process master ..." x 4 widths x 3 projects | Boundary (the form maximum), equivalence (4 widths) | ✅ Pass | Run 43374926854. Each width read 3 times with identical results (table below) |
| (b) SCR-13 Materials No match, same series and widths | same file, "SCR-13 Materials ..." | same | ✅ Pass | same run, identical to SCR-11 (the shared rule) |
| (c) axe, five NFR-018 tags | `expectNoAxeViolations` at the end of each (a) and (b) case, 24 scans | Rule-based scan | ✅ Pass, 0 violations | The 24 cases passed. CI's own scans, by name on H2 run 43274032611: DEF-035 case (`process-master.spec.ts:339`) ✓ at mobile, tablet and desktop; `materials.spec.ts:327` ✓ at three widths |
| (d) Static titles unchanged at 360 and 1366 px | "fixed empty-state titles" cases x 2 widths x 3 projects | Regression by example | ✅ Pass | Table below: text equal, one line, inside the window |
| (e) Field maximum | n/a | Code read | n/a | No `maxLength` in `master-search-box.tsx` |
| (f) Regression by name, +7 / +7 / +3 / +0, every base name present, 0 flaky | run 43274032611 vs 43261705805 | Diff of sorted name sets | ✅ Pass | Section "Regression" |
| (g) Report is one commit, H3 = H2 + this file alone | `git diff --stat 43182d9 H3` | Inspection | ✅ | One file |

**Readings (a) and (b), 100 `W`, from the logs of run 43374926854** (`lines` = title height / line height; `left` and `right` are the box edges; overflow = `scrollWidth - clientWidth`):

| Width | Lines | Left | Right | Page overflow | Before the fix (DEF-035 file, 8f66157) |
|---|---|---|---|---|---|
| 360 | 8 | 41 | 319 (<= 360) | 0 | 304 px, title left edge at -304 |
| 768 | 4 | 49 | 719 (<= 768) | 0 | 100 px |
| 1024 | 4 | 305 | 967 (<= 1024) | 0 | 96 px |
| 1366 | 3 | 305 | 1309 (<= 1366) | 0 | not measured in the DEF-035 file; the old CI case passed with the fault at this width (DL-199 (3)) |

SCR-11 and SCR-13 read exactly the same at every width. The 1366 px row has 3 lines, the minimum that proves the search text itself was broken (line 1 is "No rate matches"; without the wrap rule the title breaks only at its spaces, into two). The heading is found by its accessible name `No rate matches "<100 W>"` / `No material matches "<100 W>"` with both quotes (Playwright matches a string name as a case-insensitive substring, so this is the full quoted query plus the prefix), and `innerText` contains the 100 characters.

**Fixed titles (d)**, `QA289 FIXED` lines, all 1 line, text equal to the name, inside the window, identical in all three projects:

| Title (screen) | 360 px (left to right) | 1366 px (left to right) |
|---|---|---|
| No rates yet (SCR-11) | 130 to 230 | 757 to 857 |
| No materials yet (SCR-13) | 112 to 248 | 739 to 875 |
| No open tasks (queue page, Admin) | 121 to 239 | 748 to 866 |
| No entries yet / No entries match (SCR-16 audit) | 122 to 238 / 108.5 to 251.5 | 749 to 865 / 735.5 to 878.5 |
| Nothing here yet (design-system feedback sections, h3) | 110.5 to 249.5 | 737.5 to 876.5 |

The text is the same and each is one line. I could not compare the line breaks with `master` b6b38c5 in the same run (the control tree is H2's), but a one-line title at about 100 to 143 px in a box of about 300 px or more cannot differ from `master`'s one line; the rule changes only `overflow-wrap`, which acts only when a word is wider than the box.

## Automated Test Results

| Suite | Command / run | Total | Passed | Failed | Skipped | Duration |
|-------|---------------|-------|--------|--------|---------|----------|
| New QA control (not committed to the PR) | Run 43374926854, `aqp-289-qa.spec.ts` | 54 | 54 | 0 | 0 | part of the E2E shards |
| Full regression of the G7 head, E2E (3 shards) | Run 43274032611 on H2 | 849 | 825 | 0 | 24 | shards 3.6 to 4.5 min |
| Vitest unit / full | same run | 3,207 / 5,571 | all | 0 | 0 | 160 / 220 files |
| Control tree (H2 into `master` e76b513) | Run 43374926854 | E2E 935 (+54 control), Vitest 3,340 / 5,825 | all | 0 | 24 | 5 of 5 `success` |
| Early Q-12 control (SCR-12) | Run 43374170593 | 893 E2E (the 3 DEF-035 cases and 12 control passes on 878), Vitest 3,340 / 5,825 | all | 0 | 24 | 5 of 5 `success` |

**Reviewer-quality's plant P (not repeated by QA):** the unchanged `plant289.sh` on H2 (#365, run 43371572437) made exactly the 21 expected E2E instances (7 / 7 / 7) and 6 unit tests red, nothing else, so the DEF-035 case is shown able to fail at 360, 768 and 1366 px.

### Regression (item (f)): run 43274032611 (H2) against push run 43261705805 (`b6b38c5`)

| | Base 43261705805 | H2 run 43274032611 | Difference |
|--|--|--|--|
| Vitest unit | 159 files, 3,200 passed | 160 files, 3,207 passed | **+1 file, +7** |
| Vitest full | 219 files, 5,564 passed | 220 files, 5,571 passed | **+1 file, +7** |
| E2E shard 1 / 2 / 3 passed | 279 / 278 / 265 | 280 / 279 / 266 | +1 / +1 / +1 |
| E2E total | 822 passed, 24 skipped | **825** passed, 24 skipped | **+3**, skipped **+0** |

Jobs API: 5 of 5 `success` in both runs; the merge ref in every job of the H2 run is `18bf683` = H2 into `b6b38c5`; Gitleaks 765 commits, "no leaks found". Names (line:col and timings stripped, `comm` on the sorted sets): **0 of 816 distinct base E2E names missing**; the only 3 names H2 adds are the DEF-035 case at mobile, tablet and desktop, each `✓`. 0 `✘`, 0 `retry #`, 0 flaky in any shard. The same comparison for the control tree against the `master` push run 43342511688 (`e76b513`: Vitest 3,333 / 5,818, E2E 878 passed, 24 skipped): +7 / +7 unit, +57 E2E (the 3 DEF-035 cases and the 54 control passes), 24 skipped (+0), **0 of 872 base names missing**.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| No sideways page scroll | NFR-016 | 24 readings (SCR-11 and SCR-13, 4 widths, 3 projects each) | ✅ overflow 0 in all |
| Accessibility | NFR-018 | axe, `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, 24 scans in the control plus CI's own scans by name on H2 | ✅ 0 violations |
| Performance | none for this story | no data path (DL-196 (10)(e)) | n/a |
| Security smoke | none | The fix is a CSS class on a heading. The title text is React-escaped (`innerText` equals the typed characters); no new input, route or response | n/a, no finding |

## Exploratory Testing

Charter: find any caller of the shared `EmptyState` whose title still overflows or whose layout the new `overflow-wrap` changed. Time-box: no separate timed session; the readings of the control runs. Areas: the two callers that print typed text (SCR-11, SCR-13), the five static callers (queue, audit x2, rates empty, materials empty, design-system), and SCR-12 (below). Observations: none negative. SCR-11 and SCR-13 read identically, which shows the shared rule, not the Materials class, is doing the work. **Not tested:** 1024 px for the static titles (not asked), mobile device emulation beyond the viewport width (the three projects run the same readings: `hasTouch` projects give identical numbers), a real keyboard on the title (not interactive).

### SCR-12 Customers "No customer matches" (early evidence for Q-12, DL-202 (9)(d))

H2's own tree has no Customers code (#297 reached `master` after `b6b38c5`), so this cannot be read on H2. **Early evidence on a tree equal to H4 in content:** control PR #367 (draft, `control/AQP-289-qa-q12`, closed unmerged) is `master` `e76b513` plus #361's two commits cherry-picked (no merge), plus `aqp-289-qa-q12.spec.ts`. Run **43374170593**, 5 of 5 `success`. SCR-12 with 100 `W`, three projects each, all `✓`:

| Width | Lines | Left | Right | Page overflow |
|---|---|---|---|---|
| 360 | 8 | 41 | 319 | 0 |
| 768 | 4 | 49 | 719 | 0 |
| 1024 | 4 | 305 | 967 | 0 |
| 1366 | 3 | 305 | 1309 | 0 |

The same as SCR-11. axe 0 violations in all 12. The heading is found by `No customer matches "<100 W>"` (substring match, both quotes) and its text contains the 100 characters. **This does not close Q-12:** DL-202 requires the check on the final-update head **H4** after its CI and before the squash, and the check on H4 has to be repeated (a by-hand or QA-only-script check with no commit). Because the early tree is content-equal to H4 (the same two #361 commits on `e76b513`), I expect H4 to read the same, but it has to be read.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-035 | Process "No rates match" title does not wrap a long unbroken search | Sev-2 | **Verified by this report** (the fix is on H2; the status and routing go in the next records PR, DL-196 (10)(h)) | NFR-016, FR-085 |
| DEF-036 | `customers.spec.ts:175` flaky on the E2E dev server (ECONNRESET beside "The destination stream errored while writing data", digest 3305231884) | Sev-3, Test | Open (AQP-290, GitHub issue 364), **not this story's and not counted** | none |
| (none new) | | | | |

**DEF-036 sightings in this work, named and not counted:** the server-side line `Error: The destination stream errored while writing data.` with digest 3305231884 appears in the control run 43374926854 (shards 1 and 2, once each) and in the Q-12 control run 43374170593 (9 lines), and in neither the H2 run 43274032611 nor the base run. No `customers.spec.ts` test failed or retried in any of these runs (0 `✘`, 0 `retry #`), so there is no client ECONNRESET to name. I note it as further evidence for AQP-290's investigation: the server half occurs without a test failure, in runs of a tree that contains #297.

## Residual Risks / Notes

- **Q-12 (SCR-12) is open until H4.** `master` is `e76b513`, #361 is behind, so H4 is required; the check above is early evidence only. Result to be posted on AQP-289 and PR #361; no squash if it fails.
- **My control used the merge ref against `master` e76b513, not b6b38c5.** The 24 DEF-035 readings are of H2's product change on the newer tree. The H2 CI run (43274032611) on `b6b38c5` is the regression evidence for G7.
- The control spec is run only in CI and is not committed to #361 (QLT-03: no new E2E for 1024 px). The 1024 px readings therefore have no permanent guard; the 360, 768 and 1366 px DEF-035 case is guarded by the committed test and by P.
- **Process note for the test strategy** (already recommended in DL-199 (8)): a layout test for a long value must use text with no break point, wider than the box at the widest CI width, and assert that the value itself wrapped. My own first control version showed a second lesson: a stub set before `goto` does not apply to a screen whose first paint is read on the server.
- RISK-028 is unchanged (DL-202 (10)).

## Hand-off note

Recommendation **ACCEPT**. AQP-289 is not moved to Done by QA now: that waits for master's G7 decision (DL-199 (7)), H3's CI (5 of 5 at the same counts) and, before the squash, H4 and Q-12.
