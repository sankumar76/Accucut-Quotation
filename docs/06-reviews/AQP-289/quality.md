# Review Report — AQP-289 (DEF-035, PR #361) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1; then DL-199 / DL-202 condition P (plant on H2) and L, with no further review round |
| Base…branch | `master...fix/AQP-289-empty-state-title-wrap` (base b6b38c5) |
| Commit reviewed | Round 1: b7fbad84e4666c581e33c24d2a6e9e3670f9106e (H1). Conditions P and L: 43182d98a92d5d8a2c23cd470f33c7ac62b2ff23 (H2) |
| Date | 2026-11-12 (round 1); 2026-11-13 (conditions P and L) |
| **Verdict** | **APPROVE** on H2 (round 1 on H1: REQUEST CHANGES, one Major, test-only; fixed, see "Previous Findings") |

PR reviews: round 1, https://github.com/sankumar76/Accucut-Quotation/pull/361#pullrequestreview-5879225685; conditions P and L, https://github.com/sankumar76/Accucut-Quotation/pull/361#pullrequestreview-5886631651. Both were submitted as COMMENT because `REVIEW_IDENTITY = single-token`, with the verdict stated in the body. Label now `review:quality-approved`; `review:quality-changes-requested` is removed. Plants: H1, draft PR #362, run 43270642734; H2, draft PR #365, run 43371572437. Both were closed unmerged.

> **Update 2026-11-13 (H2).** QLT-01 and QLT-02 are fixed in H2, which master verified in DL-199 and DL-202 (conditions V and C). The plant, re-run unchanged on H2, now turns DEF-035 red at all three widths on the wrap assertion. See "Previous Findings" and "Condition P on H2". The round-1 text below is kept as it was written for H1.

## Summary
The production change is correct and is the ruled design (DL-196 (10)(b)). The shared `EmptyState` heading carries `BREAK_LONG_NAMES` (`overflow-wrap: anywhere`), so every caller gets the rule and none can drop it. Materials no longer adds the class itself. The plant shows that the shared rule now carries SCR-13 at all three widths, and that the unit test pins the class.

One test does not do what it says. The new SCR-11 E2E case **passes at desktop (1366 px) with the fix removed**: a 100-character `abcdefghij` title fits the desktop content area without wrapping. The PR's AC table and DL-196 (10)(c)/(d) both count 1366 as covered, so this is a Major (QLT-01). The fix is test-only and takes a few lines. One Minor: the case does not run axe, unlike the Materials case it copies (QLT-02).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Diff scope | `git diff --stat origin/master...b7fbad8` | 4 files, +86 / -4, exactly DL-196 (10)(b) and (d). `process-results.tsx` unchanged, as ruled |
| PR CI on b7fbad8 | run 43268411939, jobs API and job logs (`gh api --allow-escape-sequences`) | 5 of 5 `success`. Gitleaks: "757 commits scanned", "no leaks found". Vitest 3,207 (160 files) / 5,571 (220 files). E2E 280 + 279 + 266 = 825 passed, 3 + 4 + 17 = 24 skipped, 0 `✘`, 0 retry, 0 flaky |
| Delta against `master` push run 43261705805 | same | **+7 / +7 / +3 / +0**, as the Dev Record says |
| E2E names | `› file › title` sets of both runs, with line:col stripped | 0 of 846 base instances missing. 3 new: `process-master.spec.ts` "DEF-035 (AQP-289): …" at mobile, tablet and desktop |
| Vitest names | file lines of Stage 6 and Stage 11, both runs | 0 missing. The only new file is `tests/unit/empty-state-wraps-long-names.test.ts (7 tests)` in each stage |
| Plant P1 (DL-196 (10)(e)) | `control/AQP-289-qlt-heading-nowrap`, d7e3349 on b7fbad8, draft PR #362, run 43270642734 | See "Plant" below. Every expected name went red except the new SCR-11 case at desktop. Nothing else went red |
| Local test run | not run | The scratch worktree has no `node_modules`. CI runs and the plant run are the evidence |
| Other `EmptyState` callers | `git grep EmptyState b7fbad8 -- src` | queue page, `audit-screen.tsx`, `feedback-sections.tsx`, `process-results.tsx` (No rates yet), `material-results.tsx` (No materials yet): all static titles. With `overflow-wrap: anywhere` a title that fits keeps its size and line breaks, so these titles look the same. The plant's run kept every other E2E test green |

### Plant (run 43270642734, d7e3349, one parent b7fbad8)
Applied by the anchor-once script `plant289.sh` (each anchor must match exactly once). The diff was printed before the push:

```diff
-import { BREAK_LONG_NAMES } from './break-long-names';
...
-      <Heading className={cn('text-sub font-semibold text-ink', BREAK_LONG_NAMES)}>{title}</Heading>
+      <Heading className="text-sub font-semibold text-ink">{title}</Heading>
```

The import goes with the class so that lint and type-check stay green and the red comes only from the plant. The commit adds no literal (DL-188).

| Expected red (brief, DL-196) | Result |
|---|---|
| Lint (Stage 4) and type-check (Stage 5) | green, as intended |
| `empty-state-wraps-long-names.test.ts` | **red**: 6 of 7 (`expected [ 'text-sub', 'font-semibold', …(1) ] to include '[overflow-wrap:anywhere]'`). "keeps the title typography" stays green by design. No other Vitest file failed (3,201 passed) |
| `process-master.spec.ts:339` DEF-035, mobile | **red**: "the title starts inside the window", received -268 |
| same, tablet | **red**: received -64 |
| same, **desktop** | **green**. QLT-01 |
| `materials.spec.ts:327` at three widths | **red** at mobile, tablet and desktop |
| `aqp-122-qa.spec.ts:368` (five long texts) at three widths | **red**: 15 instances |
| Anything else | nothing. 20 E2E instances failed (7 + 7 + 6), all named above. Passed 268 + 272 + 265, with no test flaky |

PR #362 was closed unmerged and its branch kept. The reading was posted as a PR comment (6831230688).

## AC conformance
| AC (DEF-035, DL-196 (10)(c)) | Implemented in | Tested by | Result |
|---|---|---|---|
| SCR-11 No match, 100-character search with no space: page overflow <= 0 at 360 px | `states.tsx:85` | E2E :339 [mobile]; proven red without the fix | **Met** |
| same at 768 px | same | E2E :339 [tablet]; proven red without the fix | **Met** |
| same at 1366 px | same | E2E :339 [desktop]: **passes without the fix** | **Met in code, not proven by its test** (QLT-01) |
| same at 1024 px | same | not a CI project. QA checks it at G7, DL-196 (10)(f) | Deferred to G7 as ruled (QLT-03) |
| Title box inside the viewport (left >= 0, right <= width) | `states.tsx:85` | E2E :347-348 | Met at 360 and 768 px. At 1366 px it holds only because the text is short |
| Title text unchanged (the full query in quotes) | `process-results.tsx:34` (unchanged) | E2E :343 (accessible name with the full query); unit "prints a 100-character title in full" | Met |
| "with the search field's maximum, if it sets one" | n/a | `master-search-box.tsx` sets no `maxLength`. 100 is `MASTER_NAME_MAX_LENGTH`, a reasonable stand-in | n/a (QLT-03) |
| SCR-13 No match unchanged; `materials.spec.ts:327` and `aqp-122-qa.spec.ts:368` green by name | `material-results.tsx` (class dropped) | green in 43268411939; the plant makes both red at three widths, so they now depend on the shared rule | **Met** |
| Unit test that the heading carries the class (the `notice-wraps-long-names` precedent) | `states.tsx:85` | `empty-state-wraps-long-names.test.ts` (7); 6 go red under the plant | **Met** |
| One new E2E test in `process-master.spec.ts` at three widths, mirroring `materials.spec.ts:327` | :339 | untagged, so it runs in all three projects | Partly: no axe (QLT-02); vacuous at desktop (QLT-01) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | **Major** | `tests/e2e/process-master.spec.ts:341` (with 347-349) | NFR-016 (1366x768), DL-196 (10)(c)(d), checklist 7 (meaningful assertions) | The 100-character `abcdefghij` query is narrow enough that `No rate matches "<query>"` fits the 1366 px content area without wrapping. The desktop instance passed with the wrap class removed (plant run 43270642734). The other two widths went red | The PR's AC table and the DEF-035 file say the fix is proven at 1366 px, but at that width the regression test proves nothing. A desktop-only regression on SCR-11 would pass CI. If the font or layout changes, the same text could also stop overflowing at 768 px, and nothing would show it | Use a query that cannot fit at any project width, and assert that the title really wrapped, so the test fails loudly if the text ever becomes too short. See the snippet below. **Proof:** run this review's plant again on the fix head (`plant289.sh`, unchanged). The case must be red at mobile, tablet **and desktop** |
| QLT-02 | Minor | `tests/e2e/process-master.spec.ts:349` | DL-196 (10)(d) "mirroring `materials.spec.ts:327`"; test strategy NFR-018 (axe at three widths) | The model test ends with `expectNoAxeViolations(page)`; this one does not. No CI test runs axe on the SCR-11 No match state at any width: the filter test at :323 is `@one-width` and has no axe call | The state's accessibility depends on QA's manual G7 pass (DL-196 (10)(f)) and is not checked on every PR as the Materials state is | Add `await expectNoAxeViolations(page);` after line 349 (it is already imported) |
| QLT-03 | Info | — | DL-196 (10)(c) | 1024 px is not a CI project, and the search box sets no maximum length, so CI covers 360, 768 and 1366 px with 100 characters. 1024 px is QA's at G7 (10)(f). `overflow-wrap: anywhere` does not depend on length, so a longer pasted text needs no extra case | none | none. QA records 1024 px at G7 |
| QLT-04 | Info | `src/components/shared/states.tsx:85` | ux-spec 6.0 "Names wrap" | Good: the rule sits on the shared heading where no caller can remove it (the `Notice` pattern from #334). The plant shows the shared rule now carries SCR-13 at all three widths | — | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`process-master.spec.ts:341-349`)
```ts
const query = 'abcdefghij'.repeat(LONG_SEARCH_LENGTH / 10);
...
expect(await horizontalOverflow(page), 'the page does not scroll sideways').toBeLessThanOrEqual(0);
```
**Suggested**: a wide letter, still 100 characters with no space, plus a check that the title wrapped
```ts
/** A wide letter, so that 100 of them cannot fit on one line at any project width (1366 px included). */
const query = 'W'.repeat(LONG_SEARCH_LENGTH);
...
// The case proves the wrap only if the title needed it: more than one line of text at every width.
const lineHeight = await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).lineHeight));
expect(box?.height ?? 0, 'the title wrapped onto more than one line').toBeGreaterThan(lineHeight * 1.5);
```
The developer may pick another wide query, but it must keep the "wrapped onto more than one line" assertion. That assertion is what stops the case from passing without the fix. It also covers STD-02's unnamed `10`, because `repeat(LONG_SEARCH_LENGTH)` uses the named constant. Name the test's new text in the Dev Record if the title changes.

**Test that catches it:** the same plant (`plant289.sh` on the fix head), which must then be red at desktop too.

### QLT-02
After line 349:
```ts
await expectNoAxeViolations(page);
```
</details>

## Issues for other roles
- qa-engineer (G7, DL-196 (10)(f)): measure 1024 px (not a CI project) and 1366 px. Until QLT-01 is fixed, the 1366 px CI case is not evidence for DEF-035. *(2026-11-13: fixed on H2, so the 1366 px CI case is now evidence.)*
- reviewer-standards: STD-02 and the QLT-01 fix touch the same line, so one edit settles both.

## Previous Findings (re-check on H2 = 43182d9)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** (H2, verified by master DL-199, DL-202) | The query is `'W'.repeat(LONG_SEARCH_LENGTH)`. The first check is `box.height > lineHeight * 2.5`. Master corrected the threshold this report proposed (1.5) in DL-199 (3): without the rule, the title still breaks at its spaces into two lines ("No rate matches" / `"WWW…"`), so a check above 1.5 lines would pass without the fix. Only a third line shows that the search text itself was broken. The plant confirms it: without the rule, the height is 52 px (two lines) at every width, against the > 65 px threshold. Thread reply: https://github.com/sankumar76/Accucut-Quotation/pull/361#discussion_r4560005401 |
| QLT-02 | Minor | **Fixed** (H2, verified by master DL-199, DL-202) | `await expectNoAxeViolations(page);` is the last line of the case. Thread reply: https://github.com/sankumar76/Accucut-Quotation/pull/361#discussion_r4560005594 |
| QLT-03 | Info | No action | QA measures 1024 px at G7 (DL-199) |
| QLT-04 | Info | No action | — |

## Condition P on H2 (DL-199, DL-202): plant re-run unchanged
Branch `control/AQP-289-qlt-h2-heading-nowrap`, commit 9bd871d (one parent, H2 = 43182d9), draft PR #365, run 43371572437. The merge ref is fad8b24 = 9bd871d into `master` e76b513. `plant289.sh` was run without change and its diff printed before the push. It gives the same blob as #362 (`fea45a2`): the class and its import removed from `states.tsx`, nothing else. All 5 jobs `failure`, as planted.

| Expected red | Result |
|---|---|
| Lint, type-check | green, as intended |
| `empty-state-wraps-long-names.test.ts` | **red**: the six class tests. 3,334 of 3,340 pass, and 168 other files pass |
| DEF-035 `process-master.spec.ts:339` at mobile, tablet, desktop | **red at all three** on "the search text itself wrapped onto more than one line" (received 52, expected > 65) |
| `materials.spec.ts:327` at three widths | **red** at all three |
| `aqp-122-qa.spec.ts:368` (five long texts) at three widths | **red**: 15 instances |
| Total E2E | **21 failed, 7 / 7 / 7**, all named above. Passed 287 + 291 + 281 |
| Anything else | nothing red. One `1 flaky` line: `customers.spec.ts:175` [desktop], `apiRequestContext.post: read ECONNRESET` beside server `digest: '3305231884'`. That is **DEF-036**'s signature (AQP-290), named and not counted |

The reading is posted on #365 (comment 6845057809), and #365 is closed unmerged with its branch kept. No local tests were run; the CI job logs are the evidence.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-289/quality.md` (not committed; round 1 on `docs/AQP-1-records-sprint1-l`, the H2 update on `docs/AQP-1-records-sprint1-m`)
- Jira / GitHub updates: round 1: PR #361 review 5879225685, #362 (run 43270642734), Jira 11750. Conditions P and L: PR #361 review 5886631651 (COMMENT, verdict APPROVE); QLT-01 and QLT-02 thread replies; label `review:quality-changes-requested` replaced by `review:quality-approved`; #365 (run 43371572437) closed unmerged; Jira AQP-289 hand-off
- Open questions: none
- Risks raised: none new (RISK-028 unchanged; DEF-036 recurred once, named, not counted)
- Recommended next agent: orchestrator / master. P and L are met. Per DL-202, AQP-289 goes In QA, and H4 plus Q-12 are still due before the squash
