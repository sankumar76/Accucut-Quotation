# Review Report — AQP-244 (STORY-10.20) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-244-ci-path-variance` (PR [#166](https://github.com/sankumar76/Accucut-Quotation/pull/166)) |
| Commit reviewed | 953b8cacbf294e3458f110738a0cbb74cdfc0b9e (base 322cd8e) |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The change is small, in scope (4 files) and clear. `OWN_WIDTH_FILES` is a named constant with a comment that cites the story, the ruling (test strategy v0.31 §10.5 item 9) and the "joins only after a ruling" rule. The guard checks the list in both directions, against the config text and against Playwright's own `--list`, and the one relaxed assertion is declared under G12 in the PR body, the commit message and a code comment, and limited to exactly the two files. Findings are all Minor: a mutable list, a comment rationale that later evidence contradicts, a stale test title, a helper module whose name does not say what it holds, a duplicate config reader, a quote-sensitive scan pattern, and the "needs a ruling" rule resting on a message instead of a pin.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 8 |
| Info | 1 |

## Checks Run
No local runs (machine limit, brief). Evidence is CI on 953b8ca.

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint .` (`ci.yml` line 130, job `Stages 1 to 11b`) | green in CI on 953b8ca; Dev Record also reports exit 0 |
| Type-check | `npx tsc --noEmit` (`ci.yml` line 133) | green in CI |
| Format-check | none configured (`package.json` has `lint` and `typecheck` only) | n/a |
| Unit tests | `npx vitest run tests/unit --coverage` (`ci.yml` line 143) | green in CI; fan-in `Stages 1 to 11` success |
| Secret / dependency scan | diff read for secrets, URLs, new imports and `package.json` / lockfile changes | none found; no dependency change |
| Version control | `get_commits`, PR title, branch, labels | one commit `ci(e2e): list the own-width specs in desktop only [AQP-244]`, session trailer present; branch `feat/AQP-244-ci-path-variance`; title `AQP-244: STORY-10.20: CI path variance` |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `playwright.config.ts:41` | Coding Standards §10 (readonly) | `OWN_WIDTH_FILES` is a mutable `string[]`; the sibling lists in the tests are `ReadonlyArray<string>` | A ruled list can be mutated at run time; inconsistent with the repo | `const OWN_WIDTH_FILES: ReadonlyArray<string> = [...]`; relax the regex in `tests/support/own-width-files.ts:27` to allow the annotation |
| STD-02 | Minor | `playwright.config.ts:36-40` | Coding Standards §8 (comments explain why) | The comment says shards 1 and 2 were filled "while shard 3 ... did it"; the PR's own data and ruling 11367 show shard 3 was already the lightest by step time, and the cut is kept for another reason | The comment misleads the next reader | State the durable reason: `--shard` divides listed tests, these files list three times and run once, so the count split balanced entries that never run, and a third such file would escape the `@one-width` guard (item 9; rulings 11342, 11367). Keep the ruling reference |
| STD-03 | Minor | `tests/support/own-width-files.ts:4-11` | Coding Standards §2, §3, §8 | Module is named for the story but two of three exports (`readConfig`, `projectBlock`) are general readers of `playwright.config.ts`; the `/** */` block (4-8) documents no declaration; exported `readConfig` has a `//` comment | Name does not reveal intent; doc comment orphaned | Rename to `tests/support/playwright-config.ts` (as `playwright-list.ts` is named for what it reads); attach the block to `readConfig` as a doc comment, keeping the DEF-002 note |
| STD-04 | Minor | `tests/unit/own-width-files.test.ts:13,17` | Coding Standards §8 | Header says "about 114 entries"; the ruling, commit and PR say 108 for these two files (114 is every skipped entry in shards 1 and 2). "Three guards, each red on its own plant (see the pull request)" depends on PR text, and guard (c) is the unchanged `e2e-shards.test.ts` | Wrong figure in a ruling-based comment; comment cannot be read without the PR | "about 108 entries"; say two guards in this file plus the unchanged union and count guards; name the three plants in one line |
| STD-05 | Minor | `tests/unit/own-width-files.test.ts:33` | Coding Standards §6 | `SKIPS_EVERY_NON_DESKTOP_PROJECT` matches only single-quoted `'desktop'` after `!==` (and `!isDesktopProject(`). A new spec with `"desktop"` or `=== 'mobile' or === 'tablet'` is not found, stays out of the list, and the guard is green | The guard fails open, the blind spot it exists to close | Accept both quotes (`/['"]desktop['"]/`); optional looser tripwire for any `test.skip(` mentioning `project.name`, with a named list for known other uses |
| STD-06 | Minor | `tests/unit/own-width-files.test.ts:64` (also `one-width-tag.test.ts:173`) | Test strategy §10.5 item 9 ("as for the `@one-width` allow-list"); the G12 review rule | The `@one-width` allow-list is pinned in a test (`RULED_FILES`, `ONE_WIDTH_TESTS`, length 52), so a change is a visible test edit. `OWN_WIDTH_FILES` lives in the config, the failure message says "add the file to OWN_WIDTH_FILES", and `one-width-tag.test.ts` reads the same list from the config, so a new entry plus a skip line turns every guard green and widens the relaxed assertion with no test edit. `PARTLY_DESKTOP_ONLY` is pinned in the test | The "needs a ruling" rule is by convention only | Pin the two ruled names in `own-width-files.test.ts` (`RULED_OWN_WIDTH_FILES`, `expect(OWN_WIDTH_FILES).toEqual(...)`) and word the message "add to OWN_WIDTH_FILES and to RULED_OWN_WIDTH_FILES after a ruling" |
| STD-07 | Minor | `tests/unit/one-width-tag.test.ts:169` | Coding Standards §6 (descriptive names); G12 declaration | Title still says "every other test runs in all three width projects"; the body now also expects `desktop` only for the own-width files | A failing run shows a title that is no longer true | Add "except the own-width files, which run in desktop only (AQP-244)" |
| STD-08 | Minor | `tests/unit/one-width-tag.test.ts:205` | Coding Standards §1 (DRY) | The file reads `playwright.config.ts` twice: `readConfig()` at 173 (new shared reader) and `read(fileURLToPath(...))` at 205. `projectBlock` was moved to the shared module but its twin reader was not | Two readers can drift (CRLF handling) | `const config = readConfig();` (once, if both describes need it) |
| STD-09 | Info | `tests/unit/own-width-files.test.ts:63` | cross-reference (reviewer-quality) | In `aqp-234-qa.spec.ts` the skip is a top-level `test.beforeEach` (line 23); in `masters-table-actions.spec.ts` it is the `beforeEach` of one `describe` (92-94). Both files are fully covered today, so nothing is dropped. A later test added outside that `describe`, meant for three widths, would run in `desktop` only; guard (b) pins no titles | Possible silent loss of mobile and tablet coverage later | Reviewer-quality to judge; cheap hardening: require the matched skip to be a file-level `test.beforeEach` |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
const OWN_WIDTH_FILES = ['aqp-234-qa.spec.ts', 'masters-table-actions.spec.ts'];
```
**Suggested**
```ts
const OWN_WIDTH_FILES: ReadonlyArray<string> = ['aqp-234-qa.spec.ts', 'masters-table-actions.spec.ts'];
```
and in `ownWidthFilesOf`: `/^const OWN_WIDTH_FILES(?:: ReadonlyArray<string>)? = \[([^\]]*)\];$/m`.

### STD-06
**Suggested** (in `own-width-files.test.ts`)
```ts
/** The files ruled in test strategy 10.5 item 9. A change here is a ruling, and shows in this file's diff (G12 review rule). */
const RULED_OWN_WIDTH_FILES: ReadonlyArray<string> = ['aqp-234-qa.spec.ts', 'masters-table-actions.spec.ts'];
// in the first test:
expect(OWN_WIDTH_FILES).toEqual(RULED_OWN_WIDTH_FILES);
```

### Good practice noted (Info, no action)
- Named constant with story, ruling and process reference in the comment; no `PWTEST_*` variable and no `ci.yml` change (architecture v0.34 §8).
- Guard (a) runs in both directions and has a named, checked exemption (`PARTLY_DESKTOP_ONLY`) with a rule for adding to it.
- Guard (b) uses Playwright's own listing, parsed with zod in the existing helper (no casts).
- G12 deviation declared in three places and bounded to exactly the two files; the same fact is asserted in guard (b), so no coverage is lost.
- Commit and PR hygiene: one logical change, Conventional Commit with the story key, trailer present, no generated files, no unrelated edits.
</details>

## Reviewer-specific tables
Not applicable to this review (quality and performance reviews are separate).

## Previous Findings (re-review only)
First round; none.

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 (new diff only) |
| Diff reviewed | `953b8ca..a4eab7f` (5 files); CI run 42867165582 green |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** (Info only) |

## Summary
All nine round-1 items are closed. The developer also fixed QLT-01 (the skip in `masters-table-actions.spec.ts` moved to file level and pinned by a column-0 regex) and QLT-02 (the listing check now covers every test outside the list). The new code follows the standards: `ReadonlyArray`, a module named for what it reads, the ruled names pinned in the test, one config reader, and a comment on the file-level hook that names its guard. Two optional Info points remain.

| Severity | New in round 2 | Open after round 2 |
|----------|----------------|--------------------|
| Blocker | 0 | 0 |
| Critical | 0 | 0 |
| Major | 0 | 0 |
| Minor | 0 | 0 |
| Info | 2 | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint, type-check, unit tests | `npx eslint .`, `npx tsc --noEmit`, `npx vitest run tests/unit --coverage` in `Stages 1 to 11b` | green in CI run 42867165582 on a4eab7f (nothing run locally) |
| Fan-in and shards | `Stages 1 to 11`, `Stage 12` shards 1 to 3 | success |
| Version control | `get_commits` | second commit `fix(e2e): file-level skip in masters-table-actions and pin the own-width list [AQP-244]`, story key and trailer present; no unrelated files |

## Previous Findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Minor | Fixed | `OWN_WIDTH_FILES: ReadonlyArray<string>`; `ownWidthFilesOf` regex and error message accept it |
| STD-02 | Minor | Fixed | Comment gives the durable reason (listed tests divided by `--shard`; a third file escaping the `@one-width` guard) with rulings 11342 and 11367 |
| STD-03 | Minor | Fixed | `tests/support/playwright-config.ts`; module comment attached to `readConfig`, DEF-002 note kept; both importers updated |
| STD-04 | Minor | Fixed | "about 108 entries"; guards named in the file; four plants named in the header |
| STD-05 | Minor | Fixed; optional tripwire Rebuttal accepted | Pattern takes either quote and `!=`/`!==`. A missed spelling fails safe (file stays listed three times) and listed files are now also pinned at file level |
| STD-06 | Minor | Fixed | `RULED_OWN_WIDTH_FILES` pin plus `expect(OWN_WIDTH_FILES).toEqual(...)` as the first test |
| STD-07 | Minor | Fixed | Title ends "except the own-width files, which run in desktop only (AQP-244)" |
| STD-08 | Minor | Fixed | `const config = readConfig();` |
| STD-09 | Info | Done | File-level `test.beforeEach` in `masters-table-actions.spec.ts`, pinned by `FILE_LEVEL_DESKTOP_ONLY` (QLT-01); behaviour unchanged, the file had one test, inside the old describe |

## New Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-10 | Info | `tests/unit/own-width-files.test.ts:13-14, 80` | Coding Standards §8 | The header still says shard 3 "got the work" (the clause STD-02 removed from the config; the measured result shows shard 3 was lightest). The scan test's message (line 80) names `OWN_WIDTH_FILES` alone, while the pin test names both constants | Config comment and test header differ; small wording gap | Optional: align the clause ("so the count split balanced entries that never run"); mention `RULED_OWN_WIDTH_FILES` in the line-80 message |
| STD-11 | Info | `tests/unit/own-width-files.test.ts:122, 135` | Coding Standards §1 (DRY, no magic strings) | The QLT-02 listing check repeats the rule of `one-width-tag.test.ts` (three projects, or desktop with `@one-width`) with its own listing walk and the literal `'one-width'` | Two copies change together if a project is added | None now (rule of three not reached). If a third caller appears, share `listTests()` from `tests/support/playwright-list.ts` with the tag as one constant |

## Notes on the new code (no action)
- `FILE_LEVEL_DESKTOP_ONLY` pins exact formatting (column 0, two-space indent, `({}, testInfo)`); a reformat fails loudly with a message that says what form is expected. That is the safe direction.
- The new hook in `masters-table-actions.spec.ts` uses the same skip message as `aqp-234-qa.spec.ts` and its comment names the guard that protects it.
