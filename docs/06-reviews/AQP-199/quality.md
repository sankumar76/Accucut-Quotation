# Review Report: AQP-199 (STORY-10.14), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-199-ci-time` (PR #86) |
| Commit reviewed | 03ad8527ef586315c61c3d11d0ead9be11c546f9 |
| Date | 2026-11-05 |
| Reviewed against | restated ACs (Jira 11006: AC-1 has no number; AC-2 needs stage 12 at least 15 % shorter; the 5:00 check is withdrawn); architect 10968 and 10976; test strategy §10.3 and §10.5; DL-100 |
| **Verdict** | CHANGES REQUESTED, on evidence only (QLT-75); the code is sound |

## Summary
**The code is right.**
- 4 workers in CI.
- A warm-up of three routes.
- `@one-width` on exactly the 22 ruled tests, in the four ruled files; everything that reads layout, Tab order or touch size, or runs axe per width, stays at three widths.
- The nightly 9-minute notice: exact text, strictly over 540 s, from fewer than 20 runs, re-runs excluded, oldest and newest named. It is tested well (8 of 8 planted faults caught).

**Two gaps.**
- **AC-2 evidence (Major).** The stalled "before" attempt 3 is counted, although DL-100 says a stalled run is repeated and not counted. This was applied to the "after" stalls but not to this one. Without it, AC-2 passes only if a repeat lands at 293 s or more.
- **The allow-list (Minor).** It does not catch a tag on a single test inside a kept block.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 1 |
| Info | 1 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-86` (12 files); PR description tables; Jira comments 10968, 10976, 10985, 10986, 11003, 11004, 11006 | see Findings |
| Unit tests (a `git archive` copy of 03ad852) | `npx vitest run tests/unit/one-width-tag.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/ci-workflow.test.ts` | 56 of 56 passed |
| Planted-fault probe | 15 edits: 7 to specs and config (allow-list), 8 to `ci-feedback-time.ts` (nightly) | 14 caught. Survived: a tag on one test inside "SCR-01 at this width (AC-8)" (QLT-76) |
| Measurement check | Actions API: `runs/{id}/attempts/{n}/jobs`, duration of "Stages 1 to 11" and of the "Stage 12" step, for 42061753504/1-3 and 42070716328/1-7 | Every figure matches the PR; the medians are arithmetically right; the treatment of the stalled runs is not consistent (QLT-75) |
| Tag count | Read every tagged `test` and `test.describe` | 22 = 2 + 5 + 12 + 3, as ruled |
| E2E | not run locally | CI 42070716328 green; negative control 42073527588 failed the required check |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-75 | Major | PR description, "Measurements" (AC-2 evidence) | AC-2; DL-100 | "Before" uses attempts 1-3 (stage 12: 313, 264, **842** s), but attempt 3 is the 9.5-minute apt stall that DL-100 says is "repeated, not counted". After /4 and /5 were excluded and repeated, before /3 was not. On valid runs, before = median{264, 313, x}. AC-2 (≥ 15 % against 249 s) holds only if x ≥ 293 s. The result ranges from -5.7 % to -20.4 %, and is 13.7 % on the two valid runs alone. The PR's line "does not change if … replaced by any value of 264 s or more" is wrong (it is 313 s or more). | AC-2 is the merge criterion, and the evidence shown does not follow master's own rule. | Re-run 42061753504 once more (a re-run keeps the original merge commit), report the median of attempts 1, 2 and the new one, and correct the sentence. If it lands between 264 and 293 s, the product-manager or master decides. |
| QLT-76 | Minor | `tests/unit/one-width-tag.test.ts:57` | AC-3, NFR-016 | The guard checks files, spelling, `grepInvert` and four opening lines. A tag on one test inside a kept describe (planted on "AC-8: the page does not scroll sideways, and every control is at least 44 px") passes all 56 tests. | A layout test in a ruled file can drop to one width unnoticed. | Pin the exact ruled set (the 22 titles, or per-file counts) and fail on any difference, or fail on any tagged `test(` inside a kept describe. |
| QLT-77 | Info | `.github/workflows/ci.yml:231` | AC-2 definition; test strategy §10.3 | Stage 12 includes `playwright install --with-deps` (13 to 18 s clean, 6 to 10 min on a stall). AQP-206 will split it into stage 12a. | Later stage 12 figures are not comparable with these unless 12a is added back. | Note the definition in §10.3 or in the AQP-206 evidence. |

## Reviewer-specific tables
**Quality: AC conformance (restated ACs)**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 (no number; nightly recorded) | `ci-feedback-time.ts` reports the count and the oldest and newest runs | `ci-feedback-time.test.ts` | Met |
| AC-2 (stage 12 at least 15 % shorter, median of three) | config, set-up, four specs | PR measurements (verified against the API) | **Not shown under DL-100** (QLT-75) |
| AC-3 (coverage kept; tag only in four files) | `@one-width` on 22 tests; `grepInvert` on mobile and tablet | `one-width-tag.test.ts` | Met as built; guard partial (QLT-76) |
| AC-4 (one job, same name; negative control) | `ci.yml` | `ci-workflow.test.ts`; run 42073527588 failed | Met |
| AC-5 (no new flakiness; no timeout widened) | 4 workers | 5 valid runs, 0 flaky; config checks | Met |
| AC-6 (least privilege; runner minutes) | `ci.yml` | `ci-workflow.test.ts`; 7 minutes against 8, 7, 17 | Met |
| AC-7 (the 9-minute line, exact) | `NINE_MINUTE_NOTICE`, `ciTimeReport`, `ciTimeSummary` | 540 and 541 s, fewer than 20 runs, re-run excluded, oldest and newest; probe 8 of 8 | Met |

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: re-review of 03ad852..3808560

| Field | Value |
|-------|-------|
| Commit reviewed | 380856001a789974f50051f836c76a224383e819 |
| Scope | My own items QLT-75 and QLT-76, plus the diff (1 file: `tests/unit/one-width-tag.test.ts`) |
| CI | 42141321692 green |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 0 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-75 | Major | **Fixed** | The Actions API, re-read for each attempt. Before, run 42061753504 attempts 1 / 2 / 4 (head `423fafe`): job 468 / 396 / 509 s, stage 12 313 / 264 / 308 s; attempt 3 (842 s, the stall) is excluded. After, run 42070716328 attempts 1 / 2 / 3: stage 12 249 / 254 / 245 s. Medians: 308 s → 249 s = **-19.2 %, so AC-2 (at least 15 %) is met**; the job 468 s → 411 s = -12.2 %. Both sides use one stall rule (install over 120 s). The wrong sensitivity sentence is withdrawn in the PR |
| QLT-76 | Minor | **Fixed** | The 22 tests are pinned by `file > blocks > title` from `playwright test --list --reporter=json`. Tagged tests run in desktop only; all others run at three widths; the 14 kept tests are untagged. Planted faults: 5 of 5 caught, including the round-1 survivor (a tag inside "SCR-01 at this width"), a tag on the AQP-38 locked block, the tag removed from a ruled test, the tag in an unlisted file, and the tag put in a title |
| QLT-77 | Info | Unchanged | Not in scope for this round |

**Regression check.** Only the unit test changed. It spawns Playwright's CLI with `process.execPath`, has a 90 s timeout, parses the JSON with zod, and fails loudly on a non-zero exit. No source, config, spec or workflow changed, so the round-1 verification of coverage and of the nightly step stands. Its cost (the config is loaded once in the unit stage; no browser is needed) is the performance reviewer's call.

**Checks run (round 2)**

| Check | Result |
|-------|--------|
| Actions API: job and stage 12 durations, 42061753504 attempts 1-4 | 468/313, 396/264, 992/842 (stall), 509/308; all on `423fafe` |
| `npx vitest run tests/unit/one-width-tag.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/ci-workflow.test.ts` (scratch copy of 3808560) | 57 of 57 passed |
| Planted-fault probe (5 faults) | 5 of 5 caught |
| E2E | Not run locally; CI green |
