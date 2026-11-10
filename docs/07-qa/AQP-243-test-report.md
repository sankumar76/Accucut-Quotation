# Test Report — AQP-243 (STORY-10.19): CI set-up cut and per-run set-up summary (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `6bdbb77` on `feat/AQP-243-ci-setup-cut` (PR #152, `sankumar76/Accucut-Quotation`), plus this report and DEF-023 committed with it (docs only; the CI run on that commit is posted on the PR) |
| CI | Run 42802757357, attempt 1, on `6bdbb77`: 5 of 5 jobs success, path 5:05, cache `hit` in 4 of 4 jobs |
| Environment | Windows 11, Node v24.19.0 (CI uses Node 22). Local unit tests only, in the developer's worktree; the Actions API, job logs and cache list were read with `gh` (read only). No Playwright or database suite was run locally, no `npm ci`. A local fake GitHub API on `127.0.0.1` (ephemeral port) served real job data to the summary script. Disk and machine load limited further local runs: after the plants the worktree's `node_modules` junction was gone, so no local Vitest run was possible after that point |
| Date | 2026-11-10 |
| **Recommendation** | **ACCEPT, with one condition for master's G7 ruling.** AC-1 to AC-5 and AC-7 pass; AC-6 passes on topology, union and "no test changed" but **its clause "0 flaky tests in five full runs" is not met as written**: shard 3 reports `1 flaky` in every CI run I read (9 of 9: 3 on the base, 5 on `c24fe22`, 1 on `6bdbb77`). It is the same test on the base (`aqp-234-qa.spec.ts:446`), the story touches no E2E file, and retry #1 passes, so this is a pre-existing test defect, **DEF-023 (AQP-268, #159), Sev-3, type Test**, not a defect of this story. The PR body's "0 flaky" sentence is wrong. **Master's call:** read AC-6's flaky clause against the base (ACCEPT), or hold for DEF-023's fix, which is outside this PR. Open defects: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-023 new), Sev-4 0 |

## Summary

The change does what the ACs say. `node_modules` now comes from an exact-key cache with an integrity check and a clean-install fallback; every run writes a time summary from the fan-in job. I rebuilt every CI figure from the Actions API and they match the PR body to the second: pooled set-up median 71.5 s on the base against 7 s on the head, path median 5:38 against 4:46, billed minutes 22 against 19. The five DL-130 plants and probes behave as claimed: P3, P5 and P3b are each caught, the failed and cancelled fallback still read `fallback`, an unwritable summary path exits 0 with a token-free warning, a removed step timeout on any of the three Summary steps is caught, and the re-run-failed-jobs run 42463553178 attempt 5 gives a 4:00 path instead of 12:24. The one finding is a flaky test that the story did not cause and that the PR body misreports.

## AC Verification Matrix

| AC | Test ID(s) / method | Technique | Result | Evidence |
|----|---------------------|-----------|--------|----------|
| AC-1 Time first | Actions API `.../runs/42757450173/attempts/1..3/jobs`, step medians of the pre-test steps | Measurement | ✅ Pass | QA medians (s), 11b / s1 / s2 / s3: **install (`npm ci` + `prisma generate`) 59 / 72 / 72 / 73**; Set up Node.js 3 / 5 / 3 / 3; pinned npm 2 / 3 / 2 / 2; build 8 each (+ Next cache 2 / 2 / 2 / 1); roles + migrations + config version 3 / 2 / 2 / 1; Stage 12a 4 + 1 + 4 / 3 + 1 + 3 / 3 + 1 + 3 in the shards; Initialize containers 13 / 12 / 12 / 12 (not controllable). The install is at least four times any other set-up step, so the cut targets it, as the PR says |
| AC-2 The cut | `ci-setup-cut.test.ts` (21 tests); head runs 42763746916 attempts 1 to 3 | Measurement, boundary (50 %) | ✅ Pass | Window = `Stage 1: install, ...` / `Shard: install, ...` steps that ran (v0.29 reading, no `Use the pinned npm`). Head medians over the three hit runs: **7 / 7 / 8 / 7 s** (11b / s1 / s2 / s3) against base 59 / 72 / 72 / 73 s = 11.9 %, 9.7 %, 11.1 %, 9.6 %, each at most 50 %. Final head 6bdbb77, run 42802757357: 7 / 7 / 7 / 8 s, all `hit`. Head hit-run steps on 6bdbb77: key 0, restore 5 to 6, check 1, `prisma generate` 1 |
| AC-3 Safe on a miss, bad cache, changed lockfile | `node-modules-integrity.test.ts` (11 tests, run in bash); live controls #153 and #154 re-read, **not repeated** (DL-130) | Negative path, error guessing | ✅ Pass | #153 and #154 are CLOSED, `merged: null`. (b) corrupt cache, run 42764765280: **`fallback` in 4 of 4 jobs, all 5 jobs success**, set-up 86 / 79 / 47 / 73 s (only slower). (a) lockfile-only change, run 42764861618: **`miss` in 4 of 4, success**; `package.json`-only run 42765568476 and `.npmrc`-only run 42766448677: `miss` in 4 of 4, success. The workflow diff `c24fe22..6bdbb77` is only the `NODE_MODULES_CACHE_FORMAT` env entry, the key expression (text unchanged), a warning text and three `timeout-minutes`, and `8b587be..6bdbb77` touches no `ci.yml` line, so the controls still describe the live wiring. (c) the PR quotes GitHub's "Dependency caching reference", section "Restrictions for accessing a cache", read 2026-11-10 (the page shows no date); QA did not re-fetch it. Consistent with it: `gh cache list` shows the same key as separate entries on `refs/pull/152/merge`, `153`, `154` and none on `master` |
| AC-4 Measured on the NFR-009 path | Base run 42757450173 and head run 42763746916, attempts 1 to 3 each, jobs API | Measurement | ✅ Pass | **Pooled set-up median (12 job runs): base 71.5 s, head 7 s, 64.5 s lower (needed 20 s)**. Every job lower than its own base median (7 < 59, 7 < 72, 8 < 72, 7 < 73). Path: base 5:38, 5:55, 5:29 (**median 5:38**); head 4:46, 4:45, 4:53 (**median 4:46**), 52 s lower, not above the base, no referral. Five head runs: 4:46, 4:45, 4:53, 4:54, 5:02 (median 4:53); `8b587be` 4:23; `6bdbb77` 5:05. Fan-in job `Stages 1 to 11`: base 3, 3, 2 s; head 8, 9, 7 s (+5 s); `6bdbb77` 8 s. Queue wait 2 to 4 s in every job of every run. Cache state: `hit` in all 12 head job runs. Miss run 42761884488 (first run on the PR ref): `miss` in 4 of 4, set-up 79 / 63 / 76 / 62 s |
| AC-5 Per-run summary | `ci-run-summary.test.ts` (23 tests), `ci-run-summary-attempts.test.ts` (12), `ci-setup-cut.test.ts`; QA probes (below) | Decision table, error guessing | ✅ Pass | The script run on real job data of 6bdbb77 (probe D, below) gives path 5 m 05 s (equal to the Actions-API path 5:05), each job's duration, queue wait, install time and cache state, and `Slowest shard: shard 3, 4 m 53 s in all: set-up 0 m 54 s, tests 3 m 55 s; it ended 1 m 39 s after Stages 1 to 11b`. Test `names shard 2 when shard 2 is the slowest` and `shows n/a for the gap and for the split when the data is missing, and never a zero` pass. Fan-in job permissions: `actions: read`, `contents: read`, no write scope; `GITHUB_TOKEN` only in the script step. The `Host: CPU count and model (job summary)` step succeeded in all four jobs of run 42802757357; **the job-summary page itself is not readable through the API, so the text it wrote (`CPUs (nproc)`, `CPU model`) was verified from the step's command, not from its output**. The three `Summary:` steps succeeded and changed no job result |
| AC-6 Topology and tests unchanged | Branch protection read back; PR file list; guard files; shard logs | Inspection, measurement | ⚠️ Partial: topology ✅, "0 flaky" ❌ (pre-existing, DEF-023) | `gh api .../branches/master/protection`: required checks exactly `["Stages 1 to 11"]`, `strict: true`, force pushes off. `gh pr view 152 --json files`: 11 files, none under `src/`, `tests/e2e/` or `playwright.config.ts`, so no test dropped, moved, retried or given a longer limit. `Stages 1 to 11` is the only job with `needs`, matrix `[1, 2, 3]` (guards pass). The union test passes (`e2e-shards.test.ts` is in the 146 local tests above; stages 6 and 11 on CI). Every shard of every head run: `196 / 194 / 233 passed`, 623 tests, no `failed` line. **But shard 3 prints `1 flaky` in 9 of 9 runs (3 base, 5 head, 1 final head)**: see DEF-023. Not caused by this story; the AC text cannot be met by this PR |
| AC-7 Cost | Same runs, jobs API | Measurement | ✅ Pass | Billed minutes (each job rounded up, fan-in included): base 22, 22, 21 (**median 22**), head 19, 19, 18 (**median 19**), ratio 0.86, needs at most 1.00. Raw minutes: base 18.57, 19.32, 17.52 (18.57), head 15.22, 16.27, 16.03 (16.03), ratio 0.86. Storage added: **244,834,862 bytes (233.49 MiB) per key per ref**, from `gh cache list`. Repository cache usage read today: 10.70 GB in 75 entries, over the default 10 GB limit (documentation-based, not a setting I verified); least recently used entries are evicted |
| AC-8 Record | n/a | | n/a | The architect's, after the merge (AC-8 is not this PR) |

## DL-130 Evidence (final head `6bdbb77`)

### Plants (guard checks; nothing committed)

Each plant was applied alone to `.github/workflows/ci.yml` of a clean worktree at `6bdbb77`, the diff printed, the five workflow guard files run (`ci-workflow`, `ci-workflow-shards`, `ci-fan-in`, `ci-setup-cut` and `tests/acceptance/aqp-27-scaffold`: **169 tests, 169 pass before any plant**), and the file restored with `git checkout -- .github/workflows/ci.yml`; `git status` was clean after each.

| Plant | Diff (changed lines) | Result |
|-------|----------------------|--------|
| **P3** cache hand-over between jobs | +6 lines in `verify`: `actions/cache/save@<pinned SHA>`, `path: .next`, `key: handover-${{ github.run_id }}`; +6 lines in `e2e`: `actions/cache/restore@<same SHA>`, same path and key | **Fails 1 of 169**: `uses the split cache action only for the node_modules restore and save` (`expected [ ...(6) ] to have a length of 4 but got 6`) |
| **P5** second save of the browsers under another key | +5 lines: step `PLANT: Shard: browsers again`, `actions/cache/save@<pinned SHA>`, `path: ~/.cache/ms-playwright`, `key: browsers-other-${{ github.sha }}` | **Fails 1 of 169**: the same test (`... length of 4 but got 5`) |
| **P3b** run-scoped suffix on the key | 4 lines changed: each `key: ${{ steps.nmkey.outputs.key }}` becomes `key: ${{ steps.nmkey.outputs.key }}-${{ github.run_id }}` | **Fails 3 of 169**: `keys the cache on the runner, Node, npm and the three files...` (verify and e2e) and `uses the split cache action only...` |
| QA variant: suffix in the key-building shell line | 2 lines changed: `...-${INPUT_HASH}` becomes `...-${INPUT_HASH}-${GITHUB_RUN_ID}` in both `echo "key=node-modules-v..."` lines | **Fails 2 of 169**: the same key test in verify and e2e |
| Step timeout removed from `Summary: check out the script` | 1 line removed: `timeout-minutes: 1` | **Fails 1 of 169**: `lets only the three summary steps continue on error, so the summary cannot change the job result, and always runs them` |
| Same, `Summary: set up Node.js` | 1 line removed | **Fails 1 of 169**: the same test |
| Same, `Summary: show the time of this run` | 1 line removed | **Fails 1 of 169**: the same test |

### Probes of the summary script (a local fake API serving real job data; script run as a process, `node --experimental-strip-types`)

| Probe | Result |
|-------|--------|
| Failed / cancelled fallback (steps built by hand, not with the developer's helpers) | `cacheState`: fallback success `fallback`; **fallback failed `fallback`; fallback cancelled `fallback`**; miss success `miss`; **miss failed `miss`; miss cancelled `miss`**; plain hit `hit`; restore did not succeed `n/a`. 0 mismatches of 8 |
| Unwritable summary path | `GITHUB_STEP_SUMMARY` in a directory that does not exist, and a path that is a directory: **exit 0**, stdout ends `::warning::The run summary could not be written (Error).`, stderr empty; the token (a sentinel value), the path and any API body text do **not** appear in the output |
| API unreachable | exit 0; `Path so far: n/a. The jobs of this run could not be read (fetch failed); no figure is shown.`; no token in the output |
| Run **42463553178 attempt 5** (re-run of failed jobs; shards carried over from attempt 4; `run_started_at` 2026-11-08T09:32:41Z) | With the attempt start readable: **`Path so far: 4 m 00 s`** (the carried-over shards are listed as `(earlier attempt)` and left out), `Slowest shard: n/a (no shard job has a start and an end)`, and the line `Jobs marked (earlier attempt) were not run again in this attempt; they are left out of the path and the slowest shard.` Counting all jobs would give 12 m 24 s |
| Same run, attempt start **not** readable (HTTP 500 body containing `boom`) | exit 0; path 12 m 24 s and `Slowest shard: shard 1, 5 m 17 s ...` as before; the output ends with exactly one fixed line, **`Attempt start could not be read, so jobs from earlier attempts are counted.`** (STD-12); no token, no status code and no body text |
| Attempt 1, attempt start not readable | exit 0, **no** STD-12 line (no earlier attempt can exist) |

### Same key and `hit` on the final head

Run 42802757357 attempt 1 (`6bdbb77`): `Cache restored from key: node-modules-v1-Linux-X64-ubuntu26-node22-npm11.17.0-a8164c523dc997b3d74d4af42f4e66d16d6f534d9949efaf1db377ed386dbbc9` in **4 of 4 jobs** (verify and the three shards); zero `failed its integrity check` or fallback lines; the `npm ci (cache miss)` and `(cache fallback)` steps skipped. The same key string, byte for byte, was restored in 4 of 4 jobs of run 42776699570 on `8b587be`, and the AC-4 set-up figures for `c24fe22` are on the same entry. The key did not change across the three heads.

### Integrity tests not skipped on CI

CI log of run 42802757357, `Stages 1 to 11b`: `tests/unit/node-modules-integrity.test.ts (11 tests)` passed in stage 6 (1,411 ms) and in stage 11 (1,566 ms): 11 tests, shown with ✓ and a runtime of seconds, no `skipped` marker. The 11th is the new CI guard (`is not skipped on CI: bash and GNU find are available there`). Stage 6: `Test Files 140 passed (140)`; stage 11: `Test Files 194 passed (194)`. I could not simulate "CI without bash" locally (see Environment).

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Nine CI guard and summary files (local) | `node node_modules/vitest/vitest.mjs run tests/unit/ci-workflow.test.ts ci-workflow-shards ci-fan-in ci-setup-cut ci-run-summary ci-run-summary-attempts node-modules-integrity nightly-workflow e2e-shards` | 146 | 146 | 0 | 0 | 58 s |
| Five workflow guard files (baseline for the plants) | `vitest run` on `ci-workflow`, `ci-workflow-shards`, `ci-fan-in`, `ci-setup-cut` and `tests/acceptance/aqp-27-scaffold` | 169 | 169 | 0 | 0 | |
| CI stage 6 and stage 11, head | run 42802757357 | 140 and 194 files | all | 0 | | |
| CI E2E, head | run 42802757357, shards 1, 2, 3 | 196, 194, 233 (623) | 623 | 0 failed; **1 flaky** (shard 3, DEF-023) | 56, 58, 17 skipped by the tests | |
| Lint / type-check / build | CI stages 4, 5, 9 | | green | | | run 42802757357 |
| Full local unit run, E2E, database suites | not run by QA | | | | | CI is the evidence; agreed with the AQP-123 stream, and `node_modules` was gone from the worktree after the plants |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Required-path time | NFR-009, RISK-023 | AC-4, recomputed from the Actions API | ✅ head median 4:46 (five-run view 4:53, worst 5:02), under the 5:30 trigger, 52 s below the base. Read under DL-128 (4): all figures used are `hit` runs; the one `miss` run is reported, not used |
| Cost | NFR-025 | AC-7 | ✅ 0.86 billed and raw. Storage 233.49 MiB per entry per ref; the repository cache is at 10.70 GB of a default 10 GB (residual risk below) |
| Security smoke of the workflow | NFR-002 context, architecture section 8 | Read of the `ci.yml` diff and the script | ✅ no secret added; `permissions` of the fan-in job exactly `actions: read` and `contents: read`; workflow level `contents: read`; the token reaches only the script step; every `uses:` pinned to a SHA; `restore-keys` absent from the `node_modules` cache; the allow-list files (`package.json`, `.npmrc`) are in the key; summary errors print the error name only, never the message, a path or the token (probes E, B, F) |
| Accessibility | NFR-018 | n/a (no screen) | n/a |

## Exploratory Testing

Charter: break the claim that "the cache can only cost time and the summary can never change a result". Time-boxed to one session. Areas: the key text built in two places, the steps that decide the cache state, a split cache action used somewhere else, a stalled summary step, the summary script against a partial re-run, an unwritable summary file, an unreachable API. Findings: (1) every plant that changes what the guards read as text is caught, including the key suffix written in the shell line, which the developer did not plant; (2) **OBS-1 (Sev-4, not raised as a defect):** for a partial re-run in which no shard ran again, the summary says `Slowest shard: n/a (no shard job has a start and an end)`, which reads as missing data although the shards exist and were left out on purpose; the sentence below the table does explain it, so the figure is right and only the wording is blunt; (3) the old 2-shard run 42463553178 shows `n/a` in the install and cache columns because its step names pre-date this story, which is correct; (4) **the flaky line in shard 3 (DEF-023)** was found only by reading the shard logs, because the retry hides it from every status check; it is the reason the PR body's "0 flaky" sentence is wrong.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-023 ([AQP-268](https://sankumar76.atlassian.net/browse/AQP-268), [#159](https://github.com/sankumar76/Accucut-Quotation/issues/159)) | `aqp-234-qa.spec.ts` "G7-7 SCR-13 at 768 px: keyboard" fails its first attempt in shard 3 of every CI run and passes on retry #1 (1 flaky in 9 of 9 runs, base and head) | Sev-3, type Test, pre-existing | New | AC-6 (the "0 flaky" clause) |

## Residual Risks / Notes

* **AC-6 reading (master's call).** Literal reading: not met, and nothing in this PR can meet it. Reading it against the base (what the AC is for: "the story adds no flake"): met, the base prints the same line 3 of 3. DEF-023's fix is a test-only change that GitHub #137 already proposes (delete the 768 px G7-7 tests); it is QA's own file and a separate change, not a hold on the cache.
* **PR body correction.** "0 flaky in five full runs ... no `flaky` or `failed` line" should read "1 flaky in shard 3 in every run, the same test as on the base (DEF-023)". I did not edit the PR body (the developer's).
* **Repository cache at 10.70 GB of a default 10 GB, 75 entries.** The three closed control PRs hold five `node_modules` entries (about 1.17 GB); deletion needs the delivery lead's approval (DL-128 (5)). Eviction is least recently accessed first. The first `master` run after the merge is a miss by design (DL-128 (4)): replace it with a full re-run before reading it against 5:30.
* **Fan-in job +5 s** on every run (3 s to 8 s): the price of the summary, inside the 52 s gain.
* **Not independently verified:** the text of each job's host line (job summary not readable through the API); GitHub's cache-scope documentation (quoted by the developer); the 10 GB quota (documentation-based). **Not run:** local Playwright and database suites; a local simulation of CI without bash for the new CI guard.
* **Tooling.** Two `gh`/`git` calls that named `origin/master` were refused by the permission layer and not worked around; the base commit was read by its SHA (`051c0b5`) and the PR's file list through `gh pr view`.
* The branch carries one docs-only QA commit (this report, DEF-023); the head moves from `6bdbb77`. No workflow, script or test file changes in it.
