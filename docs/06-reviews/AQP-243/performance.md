# Review Report — AQP-243 (STORY-10.19, CI set-up cut and set-up summary) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master` (051c0b5) `...feat/AQP-243-ci-setup-cut`, PR #152 |
| Commit reviewed | c24fe2222c78cd36fd67aa917b0f7c439fa62ed7 |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (single token, so submitted as COMMENT): https://github.com/sankumar76/Accucut-Quotation/pull/152 (review by sankumar76, label `review:performance-approved`).

## Summary
The story's acceptance is a measured CI-time cut, and the cut is real. I rebuilt every AC-4 and AC-7 figure from the GitHub jobs API (9 attempts plus the miss run) and they match the PR: pooled set-up median 71.5 s → 7 s, every job lower, path median 5:38 → 4:46, fan-in job 3 s → 8 s, billed minutes 22 → 19. Cache eviction is unlikely to hurt the hit path, and a miss costs about the old install, never a red run. Two Minor items (a missing step timeout on the summary steps; cache-budget housekeeping in a repository that is already over its 10 GB) and three Info items (what the summary costs, a redundant `setup-node` npm cache, how to read the first runs after merge) do not hold the merge.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 3 |

## Checks Run
Read-only. No `npm ci`, no worktree with `node_modules` (disk), no local test run; CI at head is green (5 of 5 jobs, run 42763746916 attempt 5). Nothing was re-run.

| Check | Command | Result |
|-------|---------|--------|
| Diff read | `gh pr diff 152` (1,599 lines, 10 files) | read in full: `ci.yml`, `node-modules-integrity.sh`, `ci-run-summary.ts`, README, tests |
| Jobs and step timings, base | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/42757450173/attempts/{1,2,3}/jobs` | 5 jobs each, all success, `run_attempt` = n for every job (full re-runs) |
| Jobs and step timings, head | same, run 42763746916 attempts 1 to 5 | 5 jobs each, all success, full re-runs |
| Miss run | same, run 42761884488 attempt 1 (head 48ab9cb, first run on the PR ref) | all four installs missed; `Stages 1 to 11b` red for the scaffold guard, not the cache |
| Recompute | Node script over the saved JSON (set-up, durations, queue, path, billed, raw) | tables below |
| Cache usage | `gh api repos/.../actions/cache/usage` and `actions/caches?per_page=100` | 10,891,286,327 bytes, 76 entries; inventory below |
| Docs of record | test strategy v0.28 10.5 items 5 to 8, Jira AQP-243 (ACs, Dev Context), risk register RISK-023, DL-123 (d), DL-125, DL-126 | used as the definitions |

## AC-4 and AC-7, recomputed

**Definition of set-up.** Test strategy 10.5 item 7 and AC-2: "every step from the end of `Set up Node.js` to the start of the build: the restore, the integrity check, any `npm ci`, any save, and `prisma generate`". The developer measured the enumerated list (key, restore, check, `npm ci` on a miss or fallback, save, `prisma generate`) from the first start to the last end, skipped steps excluded. I did the same, and also summed the step durations (identical: there are no gaps between these steps) and added `Use the pinned npm` (the literal reading; it does not change the result). Read to the letter for `Stages 1 to 11b`, "to the start of the build" would take in the secret scan, lint, type-check and unit tests, which are not set-up, so the enumerated list governs.

**Which 12 job runs count.** AC-4 uses attempt 1 plus two "Re-run all jobs": base attempts 1 to 3 of 42757450173, head attempts 1 to 3 of 42763746916. Head attempts 4 and 5 are extra. Every job in each attempt has `run_attempt` equal to that attempt, so they are full re-runs, not "Re-run failed jobs".

| Set-up per job run (s) | 11b | shard 1 | shard 2 | shard 3 |
|---|---|---|---|---|
| Base attempts 1, 2, 3 | 71, 59, 47 | 45, 72, 73 | 72, 57, 72 | 73, 74, 43 |
| Head attempts 1, 2, 3 | 9, 6, 7 | 7, 9, 6 | 5, 9, 8 | 7, 6, 10 |
| Head attempts 4, 5 (extra) | 7, 8 | 9, 10 | 8, 9 | 7, 9 |

| Result | Base | Head (attempts 1 to 3) | Head (attempts 1 to 5) |
|---|---|---|---|
| Per-job medians 11b / s1 / s2 / s3 | 59 / 72 / 72 / 73 | **7 / 7 / 8 / 7** | 7 / 9 / 8 / 7 |
| Pooled median | **71.5** (12 runs) | **7** (12 runs); **64.5 s lower**, need 20 | 8 (20 runs); 63.5 s lower |
| With `Use the pinned npm` added | 73.5 | 9; 64.5 s lower | 10; 63.5 s lower |
| Largest head job run / smallest base job run | | 10 s / 43 s | 10 s / 43 s |

Pass line (10.5 item 7): pooled median at least 20 s lower **met**; every job's median lower than its own base median **met** (7 < 59, 7 < 72, 8 < 72, 7 < 73). AC-2 (each job at most 50 % of base) **met** (12 %, 10 %, 11 %, 10 %). Extra attempts 4 and 5 do not change the result; no job run of the head (at most 10 s) overlaps any job run of the base (at least 43 s).

| Path and job times | Base | Head (1 to 3) | Head (1 to 5) |
|---|---|---|---|
| NFR-009 path per attempt (first job start to end of `Stages 1 to 11`, queue excluded) | 5:38, 5:55, 5:29 | 4:46, 4:45, 4:53 | + 4:54, 5:02 |
| Median (spread) | **5:38** (26 s) | **4:46** (8 s) | 4:53 (17 s), worst 5:02 |
| Job duration median 11b / s1 / s2 / s3 | 3:45 / 5:18 / 5:09 / 5:32 | 2:56 / 3:47 / 4:30 / 4:34 | |
| Fan-in `Stages 1 to 11` own duration | 3, 3, 2 s (median 3) | 8, 9, 7 s (median 8) | 8, 9, 7, 7, 8 (median 8) |
| Queue wait, all jobs | 3 to 4 s | 2 to 4 s | 2 to 4 s |
| Cache state | none | hit in all 12 | hit in all 20 |
| Billed minutes (each job rounded up, summed) | 22, 22, 21 → **22** | 19, 19, 18 → **19** | 19, 19, 18, 18, 19 → 19 |
| Raw job minutes | 18.57, 19.32, 17.52 → 18.57 | 15.22, 16.27, 16.03 → 16.03 | median 16.03 |
| Ratio head / base | | **0.864 billed, 0.864 raw** | |

Path: 52 s lower, against the 20 to 30 s expected, and well inside the "more than 30 s above base goes to the architect" line. The fan-in job's 5 s (3 → 8 s) is already inside the 4:46. Cost: AC-7 (head at most base) met; the 1.30 times billed guard of 10.5 item 8 is not near. The repository is public, so billed minutes are not a money cost; they bound runner concurrency.

**Where the path went.** Pre-test set-up per shard (first job start to the start of the test step, medians): base 115 / 109 / 111 s, head 58 / 53 / 46 s. The test step itself did not change (shard 3: 219 s base, 226 s head). Shard 3 is the slowest job in 5 of 5 head attempts and in 2 of 3 base attempts.

| Test step per shard (s) | Shard 1 | Shard 2 | Shard 3 |
|---|---|---|---|
| Base, 3 attempts (median) | 135, 200, 199 (199) | 197, 160, 198 (197) | 219, 234, 146 (219) |
| Head, 5 attempts (median) | 146, 207, 171, 157, 164 (164) | 199, 198, 215, 196, 208 (199) | 226, 224, 220, 235, 227 (226) |

At head, shard 3's test step is 30 s above the shard mean (196 s) and 62 s above shard 1. That meets the AQP-244 trigger (25 s or more above the mean) and is what now sets the path.

## Cache cost and eviction

**Entry:** `node-modules-v1-Linux-X64-ubuntu26-node22-npm11.17.0-<hash>`, 233.49 MiB (244,834,862 bytes; 58,972 files). Restore costs 3 to 7 s and the integrity check 0 to 2 s on a hit (head, 20 job runs); a save costs 3 to 4 s on a miss.

**Repository cache at head (read-only, 2026-11-10 about 06:30Z):** 76 entries, 10,891,286,327 bytes (10.89 GB) against the 10 GB limit, so the repository is already over it.

| Kind | Entries | MiB | Share |
|---|---|---|---|
| Next.js build cache (one per PR ref and push) | 37 | 3,838 | 37 % |
| Playwright browsers | 9 | 2,529 | 24 % |
| `setup-node` npm cache (about 258 MiB each) | 9 | 2,310 | 22 % |
| **`node-modules-v1-…` (this story)** | **6** | **1,401** | **13.5 %** |
| Playwright apt packages | 15 | 308 | 3 % |

The six new entries are all from this story's own runs: #152 x1, #153 x1, #154 x4 (a new key for each `package.json`, `.npmrc` or lockfile plant). Without them the repository stood at about 9.49 GB, 95 % of the limit.

**Is eviction thrash likely?** No, for the path that matters.
- GitHub evicts the least recently *accessed* entry first. The oldest-accessed 1,754 MiB are dead entries of PR 27 and 28 from 4 and 5 November. `master`'s entries were all accessed within the hour (Playwright 06:09, npm cache 06:06, Next 06:04), and every PR run refreshes them: the `master` Playwright entry's last access (06:09) is after the last `master` push run, which shows PR runs restoring `master`'s caches, as the documentation says.
- After merge, a PR ref restores `master`'s `node_modules` entry and saves nothing, so a normal PR adds no 233 MiB copy. Only a change to the lockfile, `package.json`, `.npmrc`, npm, Node or the runner image does. The current three copies (#152, #153, #154) exist because `master` had no entry yet.
- Writes are 0.3 to 3.8 GB a day (3.8 GB so far on 10 November, 1.4 GB of it this story's controls). Entries idle for a few days go first.
- What does cost: a lockfile-changing PR (the five Dependabot PRs #146 to #150 each wrote a 258 MiB npm cache and a 73 MiB Next.js entry at 03:38 to 03:40 on 10 November) now adds a third entry, about +70 % for that ref, about 1.17 GB for a batch of five. See PRF-02.
- A miss is bounded and equals the old behaviour: run 42761884488 had set-up 79, 63, 76, 62 s (base 43 to 74 s) and a path of 5:23 even with a red `verify` job; a fallback after a corrupt entry (control run 42764765280) 86, 79, 47, 73 s, all green.

## RISK-023 fall-back (DL-126, risk register)
Condition: after AQP-243 merges, a median of three full runs on a `master` head at most 5:30. **Reachable.** Attempt 1 of the first `master` run is a miss (`master` cannot see PR-ref entries and there is no `restore-keys`): expect about 5:20 to 5:40 (the miss run read 5:23). The two re-runs are hits at 4:46 to 4:53, so the median of three is a hit, 37 to 44 s under 5:30. Two cautions: a lone first-attempt `master` or PR run after any key change can read over 5:30 with no code change (PRF-05); and 37 s is about one E2E-adding story at the ledger's +33 s (estimate; AQP-123 is next), so the fall-back is not durable. The head's five paths (median 4:53, worst 5:02) already sit inside AQP-244's AC-3 line (median at most 5:00, slowest at most 5:30) on the PR ref; whether that counts for the "falls to 3" rule is master's call.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `.github/workflows/ci.yml:563-579` (job bound at 539) | AC-5 "changes no job result"; NFR-009 | The three `Summary:` steps have `continue-on-error` and `if: always()` but no step `timeout-minutes`; the only bound is the job's `timeout-minutes: 5` | A stalled `actions/checkout` or `setup-node` holds `Stages 1 to 11`, the only required check and the end of the path, for up to 5 min and then ends it red. `continue-on-error` does not cover a job timeout. Normal cost is 2 s + 1 s + about 0 s (measured), so this is a tail risk | `timeout-minutes: 1` on each of the three steps; pin it in `ci-setup-cut.test.ts` beside the existing `continue-on-error` and `if: always()` checks |
| PRF-02 | Minor | `README.md:279-280` | AC-7 (storage against the quota) | "One entry per lockfile is a small share" understates the budget; the repository is at 10.89 GB of 10 GB and 1.40 GB of that is this story's six entries (1,167 MiB in closed throwaway PRs #153 and #154, which are not removed on close) | A lockfile-changing PR ref gets +233 MiB on top of 258 + 73 MiB (+70 %); each `package.json` or `.npmrc` state adds another. Pressure raises the chance that an idle PR's entry is evicted and costs it one miss (about base + 4 s) | After G7, delete the #153 and #154 entries (`gh cache delete`, needs `actions: write`: orchestrator or delivery lead); reword the sentence to per key per ref, name the two sibling entries, state usage at merge |
| PRF-03 | Info | `ci.yml:572` | AC-4 (fan-in duration), A-1 | Summary costs +5 s on every run: fan-in 3 → 8 s (head 8, 9, 7, 7, 8; base 3, 3, 2). Checkout 2 s, setup-node 1 s, script about 0, post steps 1 s | 5 s of about 57 s gross saving (9 %). Cannot move to a later job (AC-6) | None; confirmed as AC-4 requires |
| PRF-04 | Info | `ci.yml:134` (the `cache: npm` lines 108, 367 are unchanged) | Dev Context, 10.5 item 7 | `setup-node` still restores a 258 MiB npm cache in each job although nothing reads it on a hit; its key (lockfile hash) misses together with the `node_modules` key on a lockfile change | `Set up Node.js` is 3 to 5 s per job (the cache part is not separable from the API; estimate); 9 entries = 2,310 MiB (22 % of the repository's cache). It helps only on a `package.json`, `.npmrc`, npm or Node change, or a fallback | Input for the architect's AC-8 or AQP-244: run once without `cache: npm`; drop it if `Set up Node.js` falls by 2 s or more on the binding shard |
| PRF-05 | Info | `ci.yml:138` (and `:385`) | NFR-009; RISK-023; DL-123 (d) | First `master` run after merge, and the first run after any change to the lockfile, `package.json`, `.npmrc`, npm, Node or runner image, is a miss at about base path (run 42761884488: 5:23) | A lone first-attempt run can read 5:20 to 5:40 and trip the "first attempt 5:30 or more" rule with no code change. Headroom to 5:30 is 37 s (five-run median 4:53) | Architect's AC-8: extend the Stage 12a rule of 10.5 item 3 so that a run whose summary shows `miss` or `fallback` in any job is replaced by one more full re-run before it is read against 5:30 |

<details><summary>Detailed notes</summary>

### PRF-01
**Current** (`ci.yml`, summary steps)
```
      - name: "Summary: check out the script"
        if: ${{ always() }}
        continue-on-error: true
        uses: actions/checkout@3d3c42e5…
```
**Suggested**
```
      - name: "Summary: check out the script"
        if: ${{ always() }}
        continue-on-error: true
        timeout-minutes: 1
        uses: actions/checkout@3d3c42e5…
```
(the same line on the setup-node and script steps). The script is already bounded by `AbortSignal.timeout(15_000)`; checkout and setup-node are not.

### Considered and not flagged
- **Integrity check bound (5 s):** observed 0 to 2 s over 20 job runs (the PR says 1 s or less), a 2.5x margin at worst; the files were just extracted, so the directory entries are cached. A timeout falls back to `npm ci`, never red.
- **Four jobs saving the same key:** the losers' tar work (3 to 4 s) runs in parallel with the winner, off the path; no write conflict is a failure.
- **Summary script:** one API call (`per_page=100` for 5 jobs), 15 s abort, exits 0; no pagination needed at 5 jobs (it would be at 100).
- **Stage 6 unit tests:** 23 → 25 s median on `Stages 1 to 11b` (22 new summary tests that spawn Node, 9 integrity tests that spawn bash). `Stages 1 to 11b` is not the binding job (2:56 against shard 3's 4:34), so no path effect.
- **Fourth shard:** no longer needed for set-up. Moving set-up out of every job shrank the fixed cost a fourth shard would repeat; the remaining variance is shard 3's imbalance (+30 s), which is AQP-244's cut and is cheaper than a shard (15 to 25 s for about 22 % more runner time, 10.5 item 5). Architect's call at AC-8.
</details>

## Reviewer-specific tables
**NFR impact**

| NFR / item | Risk after this PR | Findings |
|-----|------|----------|
| NFR-009 CI feedback (p95 at most 10 min; 6:00 median warning; 5:30 RISK-023 trigger) | Lowered: median path 5:38 → 4:46 on hits. Residual: shard 3 imbalance, 37 s of headroom, misses at base path | PRF-01, PRF-03, PRF-05 |
| AC-7 / 10.5 item 8 runner cost (head at most base; at most 1.30 times billed) | None: 0.86 times | none |
| Repository cache quota (10 GB, least recently accessed evicted) | Hit path low; housekeeping needed, already over the limit | PRF-02, PRF-04 |
| RISK-023 (score 8) | Fall-back reachable at merge, not durable beyond about one story | PRF-05 |

## Issues for other roles
- **solution-architect (AC-8, test strategy 10.5):** record PRF-05's reading rule for miss runs; consider PRF-04; note that the head's five paths already meet AQP-244 AC-3's numbers and that shard 3 is +30 s above the shard mean (AQP-244 AC-2 trigger).
- **orchestrator / delivery lead:** after G7, delete the throwaway PR caches (PRF-02); keep AQP-123 from merging between the `master` runs that RISK-023's fall-back reads, or state its added E2E instances.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-243/performance.md` (branch `docs/AQP-243-review-performance`, no PR)
- Jira / GitHub updates: PR #152 review (COMMENT, 5 inline comments), label `review:performance-approved`; hand-off comment on AQP-243
- Open questions: none
- Risks raised: none new; RISK-023 reading in PRF-05
- Recommended next agent: master (G6 decision once the standards and quality reviews are in); solution-architect at AC-8
