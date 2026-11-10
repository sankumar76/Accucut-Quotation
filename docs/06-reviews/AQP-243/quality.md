# Review Report — AQP-243 (STORY-10.19) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-243-ci-setup-cut` (base 051c0b5) |
| Commit reviewed | c24fe22 |
| Date | 2026-11-10 |
| **Verdict** | **REQUEST CHANGES** (2 Major) |

## Summary
The cache design is sound and fails safe: exact key, no `restore-keys`, the integrity record travels inside the entry, a failed check deletes `node_modules` and runs a clean `npm ci` without saving, and a miss saves only after `npm ci` and the record both succeeded. The live controls prove it (corrupt entry: 4 of 4 jobs fell back, run green; changed lockfile, `package.json`, `.npmrc`: each a miss and the installed `path-key` equals the lockfile). The summary cannot turn the fan-in job green, and in practice cannot turn it red. Two things need fixing before merge. First, two of the six narrowed guards do not hold up under a planted fault (G12): a cache hand-over between jobs, and a second save of the Playwright browsers under another key, both pass all 160 guard tests. Second, the summary reports a fallback whose `npm ci` failed as `hit`, and AC-5 names the fallback state explicitly.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 2 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Story and CI-guard tests at c24fe22 | `npx vitest run tests/unit/ci-setup-cut.test.ts tests/unit/ci-workflow.test.ts tests/acceptance/aqp-27-scaffold.test.ts tests/unit/ci-run-summary.test.ts tests/unit/node-modules-integrity.test.ts tests/unit/ci-workflow-shards.test.ts tests/unit/ci-fan-in.test.ts tests/unit/e2e-shards.test.ts tests/unit/nightly-workflow.test.ts` (dev-243 worktree) | 9 files, **229 passed**, 0 failed |
| Planted faults on the narrowed guards (8 plants, each alone, diff printed, file restored with `git checkout`; reviewer tool kept outside the repo) | plant applied, then `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-setup-cut.test.ts tests/acceptance/aqp-27-scaffold.test.ts` | 6 caught, **2 survived** (P3, P5): see the table below |
| Summary edge cases | `node --experimental-strip-types` probe importing `scripts/lib/ci-run-summary.ts` | failed fallback gives `hit`; cancelled fallback gives `hit` (QLT-01) |
| Partial re-run shape of the jobs API | `gh api .../runs/42463553178/attempts/5/jobs` | attempt 5 lists both shards started 09:24:21, before the attempt started at 09:32:41 (QLT-03) |
| Live controls read back | `gh run view <id> --log` for 42764108840, 42764765280, 42764861618; `gh pr view 153/154` | as stated in the PR; both control PRs CLOSED |
| Branch protection | `gh api .../branches/master/protection/required_status_checks` | `["Stages 1 to 11"]` |
| Lint, type-check, coverage | not re-run (disk); CI stages 1 to 11b green on c24fe22; changed-line coverage 94.0 % per CI | taken from CI |

### Planted faults (G12 rule, test strategy section 10)
| Plant | Guard it tests | Diff (summary) | Result |
|-------|----------------|----------------|--------|
| P1 | STD-04 replacement | fan-in job gets `pull-requests: read` | caught: `ci-workflow` "AQP-243 AC-5 (replaces AQP-208 STD-04)" |
| P1b | STD-04 replacement | `GITHUB_TOKEN: ${{ github.token }}` on the verdict step | caught: 3 tests (`ci-workflow` STD-04 replacement, `ci-setup-cut` verdict-first and token tests) |
| P2 | fan-in `continue-on-error` | `continue-on-error: true` on the verdict step | caught: 4 tests (`ci-workflow` AQP-208 AC-4, `ci-setup-cut` two, `aqp-27-scaffold` AC-4) |
| P3 | "nothing passes between jobs" | `verify` saves `.next` with `actions/cache/save` under `handover-${{ github.run_id }}`; `e2e` restores it with `actions/cache/restore` (both at the pinned SHA) | **survived: 160 of 160 passed** (QLT-02) |
| P4 | set of `uses:` | a new `actions/cache/restore@v6` step (unpinned) | caught: 2 SHA-pin tests (`ci-workflow`, `aqp-27-scaffold`) |
| P5 | CACHE_EPOCH "not saved a second time under another key" | new step saving `~/.cache/ms-playwright` with `actions/cache/save` under `browsers-other-${{ github.sha }}` | **survived: 160 of 160 passed** (QLT-02) |
| P6 | `aqp-27-scaffold` AC-4 | `continue-on-error` moved from `Summary: show the time of this run` to stage 3 (count stays 3) | caught: 2 tests (`aqp-27-scaffold` AC-4, `ci-setup-cut` summary-steps test) |
| P7 | summary `always()` | `if: ${{ always() }}` removed from the last summary step | caught: `ci-setup-cut` "lets only the three summary steps continue on error ... and always runs them" |

The developer's own plants (PR body) were not repeated; my plants target the cases the declared replacements must cover.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `scripts/lib/ci-run-summary.ts:115-120` | AC-5 ("a job that took the integrity fallback is marked as fallback") | `cacheState` returns `fallback` or `miss` only when that `npm ci` step **succeeded**. A fallback whose `npm ci` fails or is cancelled falls through to the check step, which always succeeds, so the job is shown as `hit`. A miss whose `npm ci` fails shows `n/a`. | In exactly the run where someone reads the summary (a red job after a corrupt entry, e.g. a registry outage during the fallback), it says the cache hit. That points the reader away from the corrupt entry the story says the summary must make visible. | Decide by "the step ran" (`conclusion` not `skipped` and not null), not by `success`. Add a test: `installSteps('Shard', 'fallback')` with the fallback step at `failure` gives `fallback`; the miss step at `failure` gives `miss`. |
| QLT-02 | Major | `tests/unit/ci-workflow.test.ts:214`, `:325-326`; `tests/unit/ci-setup-cut.test.ts:157-164` | G12 review rule (test strategy section 10); DL-117 precedent | Two of the six declared narrowings are not fully replaced. The old guards banned `actions/cache/(save\|restore)` anywhere. The new ones check only the node_modules steps and the two named Playwright steps. Plants P3 (a cache hand-over between `verify` and `e2e`) and P5 (Playwright browsers saved again under another key) pass all 160 guard tests. | The guarded behaviour (jobs stay independent; the Playwright caches are saved once under one key) can come back silently. The PR body says the cache bans "moved to the exact checks of `ci-setup-cut.test.ts`", but those checks are not exact. | In `ci-setup-cut.test.ts` "the whole workflow": every step that uses `actions/cache/save` or `actions/cache/restore` is one of the four `install, restore/save node_modules` steps, with `path: node_modules` and `key: ${{ steps.nmkey.outputs.key }}`; the workflow has exactly 4 such `uses:` lines. Re-run P3 and P5. |
| QLT-03 | Minor | `scripts/lib/ci-run-summary.ts:178-185` (and `slowestShard`, `:163-175`) | AC-5 (path) | After "Re-run failed jobs", the attempt's job list still includes the jobs that were not re-run, with their **old** times (seen on run 42463553178 attempt 5). The path then runs from the old attempt's start, and the slowest shard may come from the old attempt. Nothing in the summary says so. | A partial re-run reports a path inflated by the gap between attempts, which reads as a RISK-023 trigger. AC-4 measures only full re-runs, so the pass line is not affected. | Read the attempt's `run_started_at` (`GET /runs/{id}/attempts/{n}`, same `actions: read`). Leave out of the path and the slowest shard any job that started before it, and mark its row "(earlier attempt)". Add a test with a carried-over shard. |
| QLT-04 | Minor | `.github/workflows/ci.yml:564-584` | AC-5 ("changes no job result") | `continue-on-error` covers a step failure, not the job's `timeout-minutes: 5`. The summary steps have no step-level `timeout-minutes`, so a hung checkout or Node set-up would time out the whole fan-in job after a passing verdict. The fetch itself is already bounded at 15 s. | The required check `Stages 1 to 11` turns red after a green verdict. Unlikely, but it is the one way left for the summary to change the result. | `timeout-minutes: 1` on each of the three `Summary:` steps (a step timeout counts as a step failure, which `continue-on-error` absorbs). Pin it in `ci-setup-cut.test.ts`. |
| QLT-05 | Info | `.github/workflows/ci.yml:130`, `:378` | Architect question (the literal `v1`) | **Sound.** The record is inside the entry, so its format is part of what the key names. Forgetting to raise `v1` fails safe: the key still fixes the inputs, so no stale install is possible. Every hit fails its check and falls back (time only) until the entry is deleted. Alternative: add `scripts/ci/node-modules-integrity.sh` to `hashFiles(...)` so a format change raises the key by itself (cost: a miss after any edit to the script, comments included). Either is acceptable. | none | Architect to confirm `v1` (or choose the hash). |
| QLT-06 | Info | `scripts/lib/ci-run-summary.ts:35`; PR "Decisions" | AC-2 definition | "Install plus generate" leaves out `Use the pinned npm`. AC-2 literally counts from the end of `Set up Node.js`, which includes it. This is disclosed, and the result holds either way (10, 10, 11, 10 s against 61, 75, 74, 75 s). The summary column uses the same narrower window. | none | Architect notes the window in the AC-8 record. |
| QLT-07 | Info | `scripts/ci/node-modules-integrity.sh:40-50` | AC-3 (b) | Good choice, with a stated limit. Names and sizes catch a missing or truncated file in 0.5 to 1 s for 58,972 files. A same-size byte change is not seen, but the exact key and the cache action's archive check cover that. Every failure mode of the check (no record, empty directory, timeout, missing script) leads to the clean-install fallback, never to a red run or a stale install. | none | none |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01
**Current**
```ts
if (installStep(steps, FALLBACK_STEP)?.conclusion === 'success') return 'fallback';
if (installStep(steps, MISS_STEP)?.conclusion === 'success') return 'miss';
return installStep(steps, CHECK_STEP)?.conclusion === 'success' ? 'hit' : NOT_AVAILABLE;
```
**Suggested**
```ts
const ran = (part: string): boolean => {
  const conclusion = installStep(steps, part)?.conclusion;
  return conclusion !== undefined && conclusion !== null && conclusion !== 'skipped';
};
if (ran(FALLBACK_STEP)) return 'fallback';
if (ran(MISS_STEP)) return 'miss';
return installStep(steps, CHECK_STEP)?.conclusion === 'success' ? 'hit' : NOT_AVAILABLE;
```
Probe (reviewer, outside the repo): restore `success`, check `success`, miss `skipped`, fallback `failure` gives `hit`. Fallback `cancelled` also gives `hit`.

### QLT-02
**Suggested** (in `ci-setup-cut.test.ts`, "the whole workflow"):
```ts
it('uses the split cache action only for the node_modules restore and save', () => {
  const split = LINES.filter((line) => /uses: actions\/cache\/(save|restore)@/.test(line));
  expect(split).toHaveLength(4);
  for (const job of ['verify', 'e2e']) {
    for (const [name, body] of stepsOf(jobText(job))) {
      if (!/actions\/cache\/(save|restore)@/.test(body)) continue;
      expect(name).toMatch(/: install, (restore|save) node_modules$/);
      expect(body).toContain('path: node_modules');
      expect(body).toContain('key: ${{ steps.nmkey.outputs.key }}');
    }
  }
});
```
This restores both lost bans (P3 and P5) and keeps the deliberate split.

### QLT-03
On run 42463553178, attempt 5 started at 09:32:41Z, but `attempts/5/jobs` lists `Stage 12: E2E (shard 1 of 2)` and `(shard 2 of 2)` with `started_at` 09:24:21Z. Those jobs came from the earlier attempt. `pathSeconds` would take 09:24:21 as the first start.
</details>

## Reviewer-specific tables

### AC conformance
| AC | Implemented in | Tested by / evidence | Result |
|----|----------------|----------------------|--------|
| AC-1 Time first | PR measurement table (base run 42757450173, attempts 1 to 3) | PR body; figures are reviewer-performance's to verify | Met |
| AC-2 The cut | `ci.yml` install steps of `verify` and `e2e` (key, restore, check, miss `npm ci`, fallback `npm ci`, save, generate) | `ci-setup-cut.test.ts` (order, conditions, no `restore-keys`, pins); head medians 7 / 7 / 8 / 7 s against 59 / 72 / 72 / 73 s | Met (window note QLT-06) |
| AC-3 (a) changed lockfile, `package.json`, `.npmrc` | exact key, no `restore-keys` | run 42764861618: miss in 4 of 4 jobs, `installed path-key=3.1.0 lockfile path-key=3.1.0` in all 4; 42765568476 and 42766448677: miss; PR #154 CLOSED | Met |
| AC-3 (b) corrupt cache | `node-modules-integrity.sh`, fallback step | `node-modules-integrity.test.ts` (truncated, missing, extra, no record, timeout); run 42764108840 truncates a LICENSE after the record; run 42764765280: check failed in 4 of 4 jobs, fallback ran, all green, summary `fallback` 4 of 4; PR #153 CLOSED | Met |
| AC-3 (c) PR-written cache | documentation quote with read date | PR body quotes GitHub "Dependency caching reference", read 2026-11-10 | Met |
| AC-4 Measured | PR AC-4 table | figures are reviewer-performance's to verify | Met (per PR) |
| AC-5 Per-run summary | `ci-run-summary.ts`, three `Summary:` steps, host step in both jobs | `ci-run-summary.test.ts` (22 tests incl. shard 2 slowest, n/a never zero, script run under type stripping); real output on 42761884488 (miss) and 42764765280 (fallback); permissions exactly `actions: read`, `contents: read` (P1 caught) | **Partly**: QLT-01 (failed fallback shown as hit), QLT-03 (partial re-run) |
| AC-6 Topology and tests unchanged | no change to `needs`, matrix or names | `ci-workflow-shards`, `ci-fan-in`, `e2e-shards` unchanged and green locally; required checks read back `["Stages 1 to 11"]` | Met (G12 gaps in QLT-02 concern guards, not topology) |
| AC-7 Cost | PR AC-7 table | reviewer-performance to verify | Met (per PR) |
| AC-8 Record | architect, after merge | n/a | Not in this PR |

### Can the summary turn the fan-in job red or green wrongly?
- **Green wrongly: no.** The verdict step runs first. It has no `continue-on-error` (P2 caught by 4 tests), and a failed step fails the job whatever the later steps do.
- **Red wrongly: only through the job timeout (QLT-04).** Each summary step has `continue-on-error: true`. The script catches every API and data error, bounds the request at 15 s and sets exit code 0 on any rejection.
- **Cancelled jobs.** A cancelled needed job is still a red verdict, as before. Its rows show the times it has and `n/a` for the rest, never a zero.

## Previous Findings (re-review only)
n/a (round 1).
