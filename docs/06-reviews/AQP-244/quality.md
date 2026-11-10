# Review Report — AQP-244 (STORY-10.20) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-244-ci-path-variance` (PR #166) |
| Commit reviewed | 953b8ca (base `master` 322cd8e) |
| Date | 2026-11-10 |
| **Verdict** | **REQUEST CHANGES** (one Major) |

## Summary
The cut is exactly the one ruled in test strategy v0.30/v0.31 10.5 item 9: one constant, `OWN_WIDTH_FILES`, in the `testIgnore` of `mobile` and `tablet`, with `desktop` unchanged. CI logs show every test still runs exactly once: 665 passed at base and at head, the 108 removed entries were all skipped ones (131 to 23), and the 54 own-width tests run once each in `desktop`. The guards catch the three plants the brief asked for, and the G12 relaxation still guards every other file (plant P5). **One gap (QLT-01, Major):** the relaxation and guard (a) work per *file*, but `masters-table-actions.spec.ts` skips non-desktop projects only inside its describes. A test added outside them now runs in `desktop` only, and every guard stays green (plant P4). Before this change, that test would have run at all three widths. The fix is cheap: put the skip at file level and pin that form.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 1 |
| Info | 3 |

## Checks Run
Nothing was run locally (machine limit in the brief). Every check is read from CI or from a throwaway control PR (DL-091, DL-105). Each plant's diff was printed before its result was read.

| Check | Source | Result |
|-------|--------|--------|
| Diff and changed files | `gh pr diff 166`; `git show 953b8ca:<file>` for the callers (`playwright-list.ts`, `e2e-shards.test.ts`, `one-width-tag.test.ts`, both own-width specs, `ci.yml`) | 4 files; no `src/`, `ci.yml` or product change |
| Head CI | run 42852486467, attempts 1 to 5 | success (all 5) on 953b8ca |
| Base CI | run 42850365032, attempts 1 to 5 | success (all 5) on 322cd8e |
| Each test runs once | `list` reporter summaries, head attempt 1 vs base attempt 1, all three shards | base 210 / 207 / 248 passed, 56 / 58 / 17 skipped; head 228 / 225 / 212 passed, 2 / 4 / 17 skipped. **Passed 665 = 665** (656 active + 9 set-up); skipped 131 to 23 (−108). Own-width lines at head: 0 in `[mobile]` / `[tablet]`; 32 + 22 = 54 in `[desktop]` |
| Branch protection (read-only) | `gh api …/branches/master/protection` | required checks exactly `Stages 1 to 11` |
| Plants P1 to P5 | control PRs #175 to #179 | see the plant table below |

### Plants (control PRs, each from 953b8ca plus one change, closed unmerged)
Each control PR was closed unmerged once `Stages 1 to 11b` reported, and its remaining E2E jobs were cancelled.

| Plant | PR / run | Diff (printed before the result) | Expected | `Stages 1 to 11b` | Failing tests |
|-------|----------|----------------------------------|----------|-------------------|---------------|
| P1 a third file in the list | #175 / 42862311362 | `OWN_WIDTH_FILES` += `'navigation.spec.ts'` | red | **fail** (1 of 2,791) | `own-width-files` "holds every spec that skips every non-desktop project, and only those" |
| P2 an own-width file dropped from `desktop` | #176 / 42862323696 | `desktop` `testIgnore` += `'**/masters-table-actions.spec.ts'` | red | **fail** (1) | `own-width-files` "lists the tests of each own-width file in desktop only, and each file has tests" (`masters-table-actions.spec.ts is listed: expected 0 to be greater than 0`) |
| P3 the list applied to `desktop` | #177 / 42862339575 | `desktop` `testIgnore` += `...OWN_WIDTH_FILES.map(...)` | red | **fail** (2) | "is added to the testIgnore of mobile and tablet, and of no other project"; "lists the tests of each own-width file in desktop only…" |
| P4 a test outside the skipping describe of an own-width file | #178 / 42862352785 | top-level `test('CONTROL plant…')` appended to `masters-table-actions.spec.ts` | red (the property item 9 relies on) | **pass**: gap, QLT-01 | none; the plant ran once, as `[desktop]` only (`masters-table-actions.spec.ts:144:1`, shard 3) |
| P5 a non-listed file hidden from `mobile` (G12 check) | #179 / 42862372215 | `mobile` `testIgnore` += `'**/navigation.spec.ts'` | red, including the relaxed assertion | **fail** (3) | **`one-width-tag` "run in the desktop project only, and every other test runs in all three width projects"** (`navigation.spec.ts > … expected [ 'desktop', 'tablet' ] to deeply equal [ 'desktop', 'mobile', 'tablet' ]`); `own-width-files` "is added to the testIgnore…" and "still lists every other spec file…" |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `tests/unit/own-width-files.test.ts:63`; `tests/unit/one-width-tag.test.ts:179`; `tests/e2e/masters-table-actions.spec.ts:93-95` | AC-2 ("each test still runs once, in desktop", DL-057), G12 | Guard (a) accepts a file if the skip pattern appears **anywhere** in it, and the G12 relaxation exempts **every** test of a listed file. `masters-table-actions.spec.ts` skips only inside its two `describe` blocks (describe-level `beforeEach`). | A test added to that file outside those describes, for example a mobile drawer check of the masters table, is listed and run in `desktop` only, and every guard stays green (plant P4, PR #178). Before the change, the same test ran at all three widths. It is a silent loss of width coverage, created by this change, in the file most likely to receive masters-table tests. | Move the skip to a file-level `test.beforeEach` in `masters-table-actions.spec.ts`, as `aqp-234-qa.spec.ts:23-25` already has. Behaviour does not change, because every test of the file is inside those describes today. Then pin that form for each list entry (snippet below). The test that catches it: P4 turns red. |
| QLT-02 | Minor | `tests/unit/own-width-files.test.ts:104-109` | AC-2 guard (b) | "still lists every other spec file in all three width projects" asserts nothing for a file listed in `desktop` only (`projects.some(...)` is false). It relies on `one-width-tag.test.ts` to catch untagged tests there. | The test name claims more than it checks. Today, `one-width-tag.test.ts:182` still catches it (P5 confirms that route), so this is a clarity and defence-in-depth issue, not a hole. | When a file's projects are `desktop` only, require it to be in the list or every listed test of the file to carry `@one-width`. Or rename the test to what it checks. |
| QLT-03 | Info | `tests/unit/own-width-files.test.ts:33` | AC-2 guard (a) | The scan knows two spellings, `project.name !== 'desktop'` and `!isDesktopProject(`. Other spellings escape it, for example `!=`, `=== 'mobile' \|\| … 'tablet'`, or a `test.skip(({ isMobile }) => …)` callback. | This fails safe for coverage: a file the scan misses keeps today's behaviour (listed three times, run once). Only the shard padding returns. | None needed now. If a third spelling appears, add it with a ruling, as the comment says. |
| QLT-04 | Info | PR #166 history | AC-2 ("guards written before the change") | The guards and the config change are one commit (953b8ca), so history cannot show that the guards came first. | The developer's plants and these independent plants (P1, P2, P3, P5 red) show the guards bite. | None. |
| QLT-05 | Info | `tests/support/own-width-files.ts` | Maintainability | Good: `projectBlock` moved to a shared module with an explicit error. `ownWidthFilesOf` reads the constant from the config text, so the guard and the relaxed assertion cannot drift from the config. The PR body reports the modelled AC-3 (c) miss openly, rather than hiding it. | — | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`tests/e2e/masters-table-actions.spec.ts:91-95`)
```ts
for (const screen of SCREENS) {
  test.describe(`${screen.label}: row actions are inside the table region (DEF-021)`, () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'the test sets its own widths, so one project runs it');
    });
```
**Suggested**: file-level skip in the spec (same line, same message), and in `own-width-files.test.ts`:
```ts
/** The file-level form: every test of the file, present and future, skips outside desktop. */
const FILE_LEVEL_DESKTOP_ONLY = /^test\.beforeEach\(\(\{\}, testInfo\) => \{\n {2}test\.skip\(testInfo\.project\.name !== 'desktop',/m;

it('each own-width file skips every non-desktop project at file level, so a new test in it cannot lose a width', () => {
  for (const file of OWN_WIDTH_FILES) expect(FILE_LEVEL_DESKTOP_ONLY.test(read(file)), file).toBe(true);
});
```
Plant to show it red: a top-level `test(...)` appended to `masters-table-actions.spec.ts` with no file-level skip (P4). With the file-level skip in place, the planted test is skipped outside desktop, which is the intended behaviour for an own-width file. Item 9 says the skip line "keeps the file at one project under any other configuration", and that holds only at file level.

</details>

## AC conformance (Jira AQP-244 as amended: 11342 for AC-2/3/5/6, 11367 for AC-3 (c))
| AC | Implemented in | Tested by / evidence | Result |
|----|----------------|----------------------|--------|
| AC-1 Attribute first | read-only, before the cut | Jira 11338 (52 of 81 s host speed in the test step; path sd 26 s over 8 hit runs; three limits) | Met (evidence read, not re-derived) |
| AC-2 The cut as ruled | `playwright.config.ts` 36-41, 87, 94 | `own-width-files.test.ts` (a), (b); `e2e-shards.test.ts` (c) unchanged; P1, P2, P3 red | **Met, with QLT-01:** the mechanism matches item 9 exactly and each test runs once today. One file's skip is not file-level, so the "each test runs once in desktop" property is not guarded for future tests |
| AC-3 (a) ceilings | — | head median 4:37 ≤ 5:00, slowest 4:52 ≤ 5:30 (run 42852486467 ×5, hit) | Met |
| AC-3 (b) difference reported | PR body | −4 s median, −25 s slowest, not judged | Met |
| AC-3 (c) per 11367 | PR body table | per shard listed / active / summed s / step s, median of five, base and head; summed max − mean **16 s ≤ 35 s**; modelled 68 s reported, not judged | Met (measured reading governs) |
| AC-3 (d) host-draw exit | — | not needed (head under 5:00) | n/a |
| AC-4 Exit for the outside cause | Jira 11338, 11342 | host-speed part recorded as outside the repository; in-repository part cut | Met |
| AC-5 Reading rule | PR body | median of five full hit runs per side, five paths posted | Met |
| AC-6 Guards | `ci.yml` unchanged | fan-in `Stages 1 to 11` and matrix `[1, 2, 3]` unchanged (not in diff); protection read back: exactly `Stages 1 to 11`; union test green in CI; 0 flaky (no flaky line in the logs read); billed 18 / 19 = 0.95 ≤ 1.30 | Met |

## Must-check answers
1. **Every test still runs exactly once (union of the three projects).** Yes, today. Passed 665 at base and at head; the 108 removed entries were all skipped; the 54 own-width tests run once each in `desktop`; the union test passes in CI. Gap for future tests: QLT-01.
2. **The guard catches the plants.** P1 (third list entry), P2 (file dropped from `desktop`) and P3 (list applied to `desktop`) are all red. See the plant table.
3. **The G12 relaxation is justified and still guards the other files.** Justified: before the change, both files' tests already ran only in `desktop` (they skipped elsewhere), so the relaxed expectation matches real behaviour. It still guards the other files: P5 (a non-listed file hidden from `mobile`) turns `one-width-tag.test.ts` red. It does not guard new tests in a listed file whose skip is not file-level (QLT-01).
4. **AC-1 to AC-6.** All met on the evidence; AC-2 carries QLT-01.

## Issues for other roles
- solution-architect: item 9 says the skip line "keeps the file at one project under any other configuration". That is true only when the skip is file-level. Consider stating "file-level" in item 9 when QLT-01 is fixed.

## Previous Findings (re-review only)
n/a (round 1).
