# Review Report — AQP-227 (STORY-10.17) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-227-three-shards` (base 3695f90) |
| Commit reviewed | fe520d2 |
| Date | 2026-11-08 |
| **Verdict** | **REQUEST CHANGES** (2 Major) |

## Summary
The change is small and correct: `matrix.shard: [1, 2, 3]` sits in one place, the fan-in job is unchanged, and every figure in the PR matches my own recomputation from the Actions API (path median 4:37, billed 1.20 times, queue wait 2 to 4 s). The live controls turn `Stages 1 to 11` red, naming the job and the result. Two guards are weaker than the ACs claim. **QLT-01:** the 10 % balance assertion does not catch `fullyParallel: false` (163 / 156 / 148, 4.9 %), and no test anywhere asserts `fullyParallel: true`. **QLT-02:** the AC-1 pin can be bypassed by a matrix `exclude:` (a silent return to two shards) or `include:` (a silent fourth shard), and all 36 tests stay green. Both fixes are cheap, and I proved them on the plants.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 3 |
| Info | 1 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| CI unit guards at head (warm Playwright cache) | `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/e2e-shards.test.ts tests/unit/ci-fan-in.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/one-width-tag.test.ts` (run as `node node_modules/vitest/vitest.mjs run …` in a scratch worktree at fe520d2) | 5 files, **77 passed** (2 of 2 runs) |
| Same, cold Playwright transform cache (`PWTEST_CACHE_DIR` fresh) | as above; also `e2e-shards.test.ts` alone | **Failed 3 of 3** at head and **3 of 3 at base 3695f90**: union test (QLT-04, pre-existing) |
| Shard lists | `npx playwright test --list --shard=<i>/3`, with `fullyParallel` true and false | true: 156 / 156 / 155 width tests; false: **163 / 156 / 148** (matches the developer) |
| Planted faults (scratch worktree, reverted with `git checkout`, never committed) | see the plant table | 4 of 8 plants are **not** caught |
| Proposed fixes as a probe test (deleted after) | `tests/unit/zz-qlt-probe.test.ts` (scratch only) | passes at head; fails on `fullyParallel: false`, `exclude: shard 3`, `include: shard 4` and a job-level `continue-on-error` |
| CI figures | `gh api repos/…/actions/runs/<id>/attempts/<n>/jobs` for 42493817041 (1-3), 42513656141 (1-5), 42514331234, 42513957102, 42513902330 | every path, raw, billed and queue figure in the PR reproduces exactly |
| Control logs | `gh run view <id> --job <job> --log`, grep | (a) only shard 3 fails (`zz-control-shard-3-fails.spec.ts`, desktop); fan-in `RESULT_VERIFY: success`, `RESULT_E2E: failure`, `E2E finished as 'failure'`. (b) all four jobs cancelled 26 s into shard 3's E2E step; fan-in ran and failed: `VERIFY/E2E finished as 'cancelled'`. 42513902330: `playwright test --list` failed in every job (`First argument must use the object destructuring pattern`), so it is correctly not counted as evidence |
| Branch protection (read-only) | `gh api …/branches/master/protection/required_status_checks`; `…/rules/branches/master`; `…/rulesets` | `contexts ["Stages 1 to 11"]`, `strict true`; 0 rules; 0 rulesets. Matches AC-3 |
| Throwaway branches | `git ls-remote origin 'refs/heads/ci-control/*'` | none left (deleted); the control commits change only the throwaway spec, or nothing (8ded430 is empty) |
| Lint, type-check, build | not run by me | CI `Stages 1 to 11b` green on all five head attempts |

### Plant table (adversarial checks)
| # | Plant | Caught? | By |
|---|-------|---------|----|
| P1 | `shard: [1, 2]` | yes | AQP-227 AC-1 test |
| P2 | fan-in `needs: [verify]` (shards dropped) | yes | 3 tests (STORY-10.02 AC-8, AQP-208 AC-4, STORY-10.10 AC-5) |
| P3 | `fullyParallel: false` | **no** | (QLT-01) |
| P4 | `matrix.exclude: [{shard: 3}]`: two shards at run time, `job-total` 2 | **no** | (QLT-02) |
| P5 | job-level `continue-on-error: true` on `e2e` | **no** | (QLT-03, pre-existing) |
| P6 | `matrix.include: [{shard: 4}]`: a fourth shard | **no** | (QLT-02) |
| P7 | `max-parallel: 1` between `fail-fast` and `matrix` | yes | AQP-208 AC-4 strategy regex (only by position) |
| P8 | `shard: [3, 2, 1]` | yes | AQP-227 AC-1 test |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `tests/unit/e2e-shards.test.ts:83-96` | AC-2 ("it fails if the split ever becomes per file, for example if `fullyParallel` is switched off"); NFR-009; test strategy 10.5 §2 | The assertion is the one AC-2 asks for, but it does not give the protection AC-2 states. A per-file split gives 4.9 % and passes. No test in the repository asserts `fullyParallel: true` (grep of `tests/`), so the property the whole design rests on (10.5 §1: "with `fullyParallel: true` it divides the tests") has no guard. At 10 % of the mean (about 15.6 tests), only a gross imbalance trips it | A switch to `fullyParallel: false` merges green. Shards then split by file, and the time spread (already 34 to 85 s) grows unseen. The test comment tells the next reader the opposite (the wording is STD-01; this finding is the guard design) | Assert the cause and the exact effect, both deterministic today: `expect(CONFIG).toMatch(/^ {2}fullyParallel: true,$/m)` (read `playwright.config.ts` in this file, since `one-width-tag.test.ts` is not to be touched), and `max − min ≤ 1` over the width counts (156 / 156 / 155 today; 163 / 156 / 148 fails). The 10 % line can stay as a gross-imbalance backstop or be replaced. Proved on the plant. **Test strategy 10.5 §2 should change** (solution-architect): it should name these two assertions and drop the claim that 10 % catches a per-file split |
| QLT-02 | Major | `tests/unit/ci-workflow.test.ts:179-188` (and the claim at `ci.yml:236-239`) | AC-1 ("a silent return to two shards fails it, and a fourth shard needs test strategy 10.5 first") | The pin reads only the `shard: [...]` line. A matrix `exclude: - shard: 3` makes `strategy.job-total` 2 (two shards at run time). An `include: - shard: 4` adds a fourth. Both pass all 36 tests of the three guard files. `e2e-shards.test.ts` then still lists three shards from the same line, so it checks a split CI does not run | AC-1's stated property ("any list other than `[1, 2, 3]` fails", `ci.yml:239`) is false for two one-line edits. The cost guard (AC-6) and the 10.5 order (no fourth shard without the architect) can be bypassed silently | Anchor the whole strategy block, so nothing else can sit in it: `expect(jobText('e2e')).toMatch(/^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}shard: \[1, 2, 3\]\n\n/m)`, or assert that the job has no `include:`, `exclude:` or `max-parallel:` key. Proved on P4 and P6 |
| QLT-03 | Minor (pre-existing, AQP-208) | `.github/workflows/ci.yml:250-254` (e2e job header) | AQP-208 AC-4 (the fan-in "cannot be merged past") | The guards forbid `continue-on-error` in the Stage 12 step and in the fan-in job, but not at the `e2e` job level. P5 passes every test. Per GitHub's documentation, a job with `continue-on-error: true` does not fail the run. I did not verify how `needs.e2e.result` reports it (no live run: DL-091, DL-105) | If `needs.e2e.result` reports `success`, a failing shard merges past the required check | One assertion: `expect(jobText('e2e')).not.toMatch(/^ {4}continue-on-error:/m)`. Proved on P5. It can go in this PR's guard push, or a `tech-debt` issue if master defers it |
| QLT-04 | Minor (pre-existing, AQP-208; this PR adds a fourth concurrent listing) | `tests/unit/e2e-shards.test.ts:49-56` (outside the diff) | Test determinism (checklist 7) | With a cold Playwright transform cache, the union test failed 3 of 3 at head and 3 of 3 at base 3695f90 on this Windows machine, and passed warm. The whole listing reports compiled line numbers (for example `audit.spec.ts:153` for the test at line 129) while the shard listings report source lines. So the `file:line` keys differ. The listings run in parallel on one shared cache, which points to a race (cause inferred, not traced) | A false red on a fresh checkout or a cleared cache. Linux CI has been green (5 of 5 head attempts) | List the whole suite first (it warms the cache), then the shards in parallel, or key entries by `file + title path + project` without the line. Follow-up issue, not this PR's scope |
| QLT-05 | Minor (evidence deviation, disclosed) | n/a (AC-4 (b), run 42513957102) | AC-4 (b) "shard 3 is cancelled while it runs" | The whole run was cancelled, so `VERIFY` was cancelled too and the fan-in would be red even if `E2E` were mishandled. The log shows `E2E finished as 'cancelled'` as its own error, and `ci-fan-in.test.ts` runs the script for each result, so the gap is small. An isolated control was possible on the throwaway branch (a `sleep` step in shard 3 only, cancelled once `Stages 1 to 11b` and shards 1 and 2 had succeeded) | Weaker evidence than AC-4 (b) asks for; no product risk | Accept it as is, with master recording the deviation in the G6 record, or repeat (b) isolated on a new throwaway PR. My recommendation: accept |
| QLT-06 | Info | n/a | AC-3, AC-5 to AC-7 | Every figure reproduces from the jobs API (table below). Billed minutes are medians per metric across attempts (18 / 15 = 1.20). Taking the billed minutes of the path-median runs gives 17 / 15 = 1.13. Either reading meets 1.60. The head's 3-sample spread is 13 s (4:26 to 4:39); the margin is 8 s | none | none |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`e2e-shards.test.ts:87-96`): each shard's width-test count within 10 % of the mean.
**Suggested** (added beside it, verified on the plant):
```ts
const CONFIG = readFileSync(fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');

it('the split is per test: fullyParallel stays on and the shards differ by at most one test', () => {
  expect(CONFIG).toMatch(/^ {2}fullyParallel: true,$/m);
  const counts = shards.map((shard) => widthTests(shard).length);
  expect(Math.max(...counts) - Math.min(...counts), counts.join(' / ')).toBeLessThanOrEqual(1);
});
```
Note: a future `test.describe.serial` group would become one unit for the split and could break the "at most one" bound. That is a deliberate signal; the architect can choose "at most the largest serial group" instead.

### QLT-02
**Current** (`ci-workflow.test.ts:180-184`): reads only `/^ {8}shard: \[([\d, ]+)\]$/m`.
**Suggested**:
```ts
// The strategy block holds fail-fast and the list and nothing else, so `include`, `exclude` or `max-parallel`
// cannot change the shard count at run time.
expect(jobText('e2e')).toMatch(/^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}shard: \[1, 2, 3\]\n\n/m);
```

### QLT-03
```ts
expect(jobText('e2e')).not.toMatch(/^ {4}continue-on-error:/m);
```
</details>

## Reviewer-specific tables

### AC conformance
| AC | Implemented in | Tested by / evidence | Result |
|----|----------------|----------------------|--------|
| AC-1 N = 3 in one place; guard pinned | `ci.yml:254`; comments `ci.yml:13-14, 236-239, 335` | `ci-workflow.test.ts:179-188`; P1 and P8 caught | **Partly met.** The list is pinned, but `exclude` or `include` bypass it (QLT-02). `fail-fast` off, no literal N, fan-in name and sole `needs` unchanged: met |
| AC-2 every test once; balance within 10 % | `e2e-shards.test.ts:87-96` | the union, no-duplicate and setup tests unchanged (diff shows no edit); counts 156 / 156 / 155 (I reproduced them) | **Met as an assertion; its stated purpose is not met** (QLT-01). Retries 1, `forbidOnly`, pins and timeouts unchanged (not in the diff) |
| AC-3 branch protection read back | none (read-only) | my GET: `["Stages 1 to 11"]`, 0 rulesets | **Met** |
| AC-4 live controls | throwaway PRs #125, #126, closed; branches deleted | (a) run 42514331234: shard 3 alone fails, fan-in `E2E finished as 'failure'`; (b) run 42513957102: fan-in `E2E finished as 'cancelled'`; 42513902330 rightly excluded | **Met, with a deviation in (b)** (QLT-05). `ci-fan-in.test.ts` and `ci-feedback-time.ts` unchanged |
| AC-5 median of three at most 4:45 | none (measure) | head 4:37 / 4:26 / 4:39, **median 4:37**; base 6:30 / 3:53 / 5:36; stage 12a hit in every shard (per PR and reviewer-performance) | **Met** (8 s margin) |
| AC-6 billed at most 1.60 times | none | billed 18 / 15 = **1.20** (or 1.13 by path-median runs); raw 1.19 | **Met** |
| AC-7 queue wait recorded | PR body | 2 to 4 s in all 37 jobs (I reproduced it) | **Met** |
| AC-8 0 flaky in five runs | none | PR, and reviewer-performance read the 15 shard logs; I did not re-read the head shard logs myself | **Met (by others' evidence)** |

## Previous Findings (re-review only)
n/a (round 1).

## Cross-references (not duplicated)
- STD-01 (reviewer-standards): the wording of the 10 % comment. QLT-01 covers what the guard should assert.
- PRF-01 to PRF-05 (reviewer-performance): headroom, spread and the next trigger. I agree; nothing to add.

## Issues for other roles
- **solution-architect:** change test strategy 10.5 §2 (the `e2e-shards.test.ts` row) to say that `fullyParallel: true` is asserted and the shards differ by at most one test, and to drop the claim that 10 % catches a per-file split. Also add to the `ci-workflow.test.ts` row that the strategy block is anchored (no `include` or `exclude`).
- **master:** record the AC-4 (b) deviation (QLT-05) at G6. Decide whether QLT-03 is fixed in this push or deferred as `tech-debt`.
- **developer:** QLT-01 and QLT-02 in one test-only push, plus QLT-03 if master agrees; re-run the five guard files.
