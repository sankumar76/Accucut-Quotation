# Review Report — AQP-237 (STORY-10.18) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 (below), 2 (section "Round 2", after the Hand-off of round 1) |
| Base…branch | `master...feat/AQP-237-audit-record-tx-checks` (PR #250; round 1 read it under the earlier branch name `feat/AQP-237-audit-tx-static-checks`) |
| Commit reviewed | Round 1: 87465b68f888344df48a108a24912ca161b6b2f6. Round 2: 57acbae200ffca4befb99a757bd41aea557e8a22 (merge 2c543cd of `master` 2891457, then the fix commit) |
| Date | 2026-11-11 |
| **Verdict** | Round 1: **APPROVE** (two Info notes). **Round 2: APPROVE WITH COMMENTS** (PRF-03 Minor, optional; PRF-01 updated; PRF-02 closed). See "Round 2". |

## Summary
The PR adds only tests and lint configuration (5 files, no `src/`), so no runtime path, query, route, dependency or first-load JavaScript changes. The architecture test builds the TypeScript program **once**, in one `beforeAll` hook, and every case reuses it. Its cost is 5.2 s in Stage 6 and 4.1 s in Stage 11 (file durations from the CI job log, including the hook). That is about half of AC-5's 10 s report line. The CI-time effect is real but small and off the critical path: about +3 s in Stage 6 (one sample, inside `master`'s own spread) and nothing readable in Stage 11 or Stage 4. The path is set by the slowest E2E shard, which has at least 101 s of slack over the `Stages 1 to 11b` job on every run read. RISK-023 (8, DL-151) is not moved by this PR, and no hold is needed.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

## Checks Run
No `npm ci` (local disk nearly full, per the brief). The evidence is the diff, the CI jobs API and the CI job logs. Figures are measured unless marked *estimate*.

| Check | Command | Result |
|-------|---------|--------|
| Diff and files in full | `gh pr diff 250`; `git show pr250:<file>` | 5 files, +859 / -3: `eslint.config.mjs`, `tests/support/audit-transaction-check.ts` (280), `tests/unit/audit-transaction-architecture.test.ts` (442), `tests/unit/lint/transaction-handle-rule.test.ts` (93), `tests/security/engineer-import-rule.test.ts` (+17 / -1). No `src/`, no `package.json`, no workflow change. |
| PR CI run, steps | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/43027184210/jobs` | 5 of 5 `success`, attempt 1, head 87465b6. |
| Base runs, steps | `gh api .../runs/43004280872/attempts/{1..5}/jobs` (master b3403e3 push run) | 5 attempts, 5 of 5 each. Medians below. |
| Per-file test times | `gh api --allow-escape-sequences .../actions/jobs/<id>/logs`, PR job 130544744381 and the five base `Stages 1 to 11b` jobs | Vitest `Duration` lines and per-file lines read. |
| Program build count | Read `audit-transaction-architecture.test.ts` 387-442 | One `createServicesProgram` call, in `beforeAll` (line 395). All 29 cases call `checkAuditTransactions(program, …)` on that program. |
| Lint-rule cost | Read `eslint.config.mjs` diff; Stage 4 step times | One new config block, one added pattern per group. No typed linting (`project` / `projectService` absent). |

## CI-time effect (the brief's question)

**Base** is `master` push run 43004280872 on b3403e3, attempts 1 to 5 (the five runs DL-151 used for its median). **PR** is run 43027184210 on 87465b6, one attempt. A single PR attempt cannot carry the median-of-five reading rule (test strategy 10.5 item 9, DL-143), so the PR column is "a sample against a range", not a judged difference.

| Reading | Base attempts 1 to 5 | Base median | PR | PR − median |
|---|---|---|---|---|
| Stage 4 lint (step) | 15, 12, 13, 12, 11 s | 12 s | 11 s | -1 s |
| Stage 5 type-check (step) | 11, 9, 10, 9, 8 s | 9 s | 9 s | 0 |
| Stage 6 unit (step) | 37, 29, 31, 29, 25 s | 29 s | 32 s | +3 s |
| Stage 6 Vitest `Duration` | 36.03, 28.73, 30.53, 28.30, 25.31 s | 28.73 s | 32.00 s | +3.3 s (inside the 25.3 to 36.0 range) |
| Stage 11 (step) | 96, 80, 82, 79, 70 s | 80 s | 80 s | 0 |
| Stage 11 Vitest `Duration` | 95.04, 78.93, 81.53, 78.93, 68.85 s | 78.93 s | 78.66 s | -0.3 s |
| `Stages 1 to 11b` job | 220, 184, 196, 186, 162 s | 186 s | 190 s | +4 s |
| Slowest E2E shard job | 321, 310, 326, 325, 267 s | 321 s | 296 s | (not touched by this PR) |
| Path (first job start to `Stages 1 to 11` end) | 334, 323, 335, 334, 284 s (DL-151; attempt 1 re-derived: 10:31:11 to 10:36:45) | 334 s (5:34) | 308 s (5:08; 13:13:35 to 13:18:43) | not comparable (see below) |
| Slack: slowest shard minus `Stages 1 to 11b` job | 101, 126, 130, 139, 105 s | 126 s | 106 s | |
| Test files / Vitest cases, Stage 6 | 151 / 2,914 | | 153 / 3,054 | +2 / +140 |
| Test files / Vitest cases, Stage 11 | 210 / 5,237 | | 212 / 5,377 | +2 / +140 |

What the figures say:

1. **Direct cost of the new tests (PR job log, file lines).** The architecture test, 29 cases: 5,199 ms in Stage 6 and 4,068 ms in Stage 11. The rule test, 111 cases: 2,364 ms and 2,179 ms. Together 7.6 s of worker time in Stage 6 and 6.3 s in Stage 11, **13.9 s of runner time per CI run**, since `tests/unit` runs in both stages (by design: Stage 11 runs every level). Against the runner time of the five jobs (about 1,040 s: 190 + 263 + 296 + 291), that is about 1.3 % (estimate from job durations). It is nowhere near the 1.30 times runner-minutes guard of item 9, and no new job is added (AC-5).
2. **Wall effect in Stage 6 is about +3 s** (one sample: 32.00 s against a median of 28.73 s, in a base range of 10.7 s). Seven seconds of file time spread over several Vitest workers predicts roughly 2 to 3 s of wall time (estimate), so +3.3 s is consistent, but one sample does not prove it. In Stage 11 the same files show no readable change (78.66 s against 78.93 s), because the DB-bound integration tests set that stage's length.
3. **None of it is on the path.** The path is the slowest E2E shard plus the aggregate job. `Stages 1 to 11b` ends 101 to 139 s before the slowest shard on all five base attempts and 106 s before it on the PR run. So +3 to +5 s there moves the path by **0 s** unless the slack shrinks by a minute and a half, which no step of the CI path items 1 to 9 suggests. The PR's own path of 5:08 is set by shard 2 (296 s) and is E2E host speed. It does not show a gain, and I do not read it as one.
4. **RISK-023 and the fourth-shard gate.** This PR adds no E2E spec (778 unchanged), so it does not add the roughly +33 s per E2E-adding story that drives the risk (register, DL-125). DL-151's reading (median of five 5:34 on b3403e3, half the fourth-shard gate met) is unchanged by it. The second half of that gate, the first nightly after b3403e3, is not affected either, since the nightly path is also the slowest shard. I recommend no hold and no re-score.

## Does the check build the TypeScript program once or per test?
**Once.** `createServicesProgram` is called only in the `beforeAll` hook (test file line 395), with a 120,000 ms hook limit (the repository's own hook limit, DL-057). The hook also runs the whole-service check once (`today`) and the `audit-service.ts` check once (`definition`), which forces the lazy type-checker set-up (global symbol merge) there and not inside a case. The 29 cases then call `checkAuditTransactions(program, ROOT, [one fixture])` on the shared program. The fixtures are in-memory files added as extra root names; `serviceFilesUnder` reads the disk only, so the fixtures are not scanned as services. No case builds a second program.

The program roots are the service files plus fixtures. TypeScript still parses every file they import (the repositories and what they import, the generated Prisma client types, `lib.dom`, `lib.esnext`, `@types/*`). That is where most of the 4 to 5 s goes (estimate; I could not split build from check without a local install). Nothing is emitted (`noEmit`, `incremental: false`), and no diagnostics are requested.

Time-limit safety: the hook has 120 s against a 4 to 5 s run (more than 20 times), and the cases are table lookups on a warm checker, so the 5 s per-test default is not at risk even on a host 30 % slower (item 9 measured up to 29 %). The ESLint rule test warms the config in its own hook (180 s limit) and runs 111 `lintText` calls in 2.2 to 2.4 s, so it carries no timing risk either.

## Lint-time cost of the new rule
- **Stage 4 lint: 11 s on the PR against a base median of 12 s (range 11 to 15 s).** No regression is readable.
- **Why none is expected.** The new `accucut/transaction-handle-is-for-the-runner` block matches every code file but replaces the `no-restricted-imports` and `no-restricted-syntax` settings that the earlier blocks already set, so each file still runs those two rules once. The cost per file is one more `{ group, importNames }` entry (two globs and one regular expression) in options ESLint already builds per file: microseconds, about +1 pattern on about 5 to 8. `restrict()` now includes the entry for every group, so no file gets a second copy.
- **No typed linting.** `parserOptions.project` / `projectService` are absent from the configuration, so the rule adds no type-aware work. The three new TypeScript files (about 815 lines) are linted untyped.
- **Test side.** `transaction-handle-rule.test.ts` is the fourth test file that creates its own `ESLint` instance (with `aqp-27-scaffold`, `engineer-import-rule`, `layer-rules`), so it pays its own config load (the warm-up hook). That is inside the 2.2 to 2.4 s above. Sharing one instance across files would need a shared module and is not worth it for about 1 to 2 s of parallel worker time (estimate).

## Other checklist items (none apply or none found)
- **Algorithmic complexity.** The check is O(R × (B + F)) in record calls R, enclosing-function body size B and file size F in the worst case, with chain depth capped at `MAX_HELPER_STEPS` = 3 and cycles refused. At 15 calls over 7 services this is a small share of the 5.2 s (see PRF-02 for the one place that rescans a file).
- **I/O.** One `readdirSync` (recursive) of `src/server/services`, plus the compiler's own file reads. No network, no database.
- **Memory.** One program per test worker, held until the file ends. With `lib.dom`, `@types/*` and the Prisma client types it is probably in the low hundreds of MB (estimate, not measured); one worker, and the workers are separate processes or threads that are released after the file. No unbounded cache or leak is added. No finding.
- **Front end and runtime.** No `src/` change, so first-load JavaScript, Core Web Vitals and runtime latency are untouched. Stage 11b (JS budget) passed in 3 s.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `tests/unit/audit-transaction-architecture.test.ts:394-405` | AC-5 (10 s report line); NFR-009 | The 10 s line is a report line only: nothing fails or prints when the build nears it, and the hook limit is 120 s. The figures of record (5.2 s Stage 6, 4.1 s Stage 11, 29 cases) sit only in the Jira hand-off and the CI log. | Low. Growth is expected to be slow (estimate: most of the time is fixed cost, `lib.dom`, `@types/*` and the Prisma types; each new service adds only its own file and the few imports not already in the closure, so a few tenths of a second per EPIC). A slow drift would be seen only if a reviewer reads the per-file line. | No change to this PR. The solution-architect records 5.2 s / 4.1 s as the baseline beside the Vitest totals of record in test strategy section 10 at the next edit, so a later G6 compares against a number. If a later reading nears 8 s, measure first, then consider `types: []` (or a short list) in `createServicesProgram`, so `@types/*` that no service imports are not parsed. Not worth doing now. |
| PRF-02 | Info | `tests/support/audit-transaction-check.ts:208-223` (`usesOf`), called from `chainProblem` at 244 | AC-2 (a) | `usesOf` walks the whole source file and calls `getSymbolAtLocation` on every identifier, once per helper that holds a `record` call, and again for each caller on the chain (up to 3 levels). The result is not kept, so a helper with several `record` calls, or a file with many helper-held calls, rescans the file each time. | Cold path and small today: 5 helper-held calls, all in `masters-service.ts`, inside a 5.2 s file that is mostly program build. Estimate: a 1,000-line service has about 8,000 identifiers, so one scan is tens of milliseconds, and 30 helper-held calls in one file would be 1 to 3 s. Not measured. | No change now. If the check (not the build) ever shows in the file time, keep `usesOf` results in a `Map<ts.Symbol, ts.Identifier[]>` for the duration of one `checkAuditTransactions` call. The same holds for `callsAnotherRepository`, which re-walks a callback body once per `record` call in it. |

## NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 CI feedback time (p95 ≤ 10 min; 6-min early warning; RISK-023 trigger 5:30) | Low. Unit and Stage 11 gain about 14 s of runner time per run and about +3 s of wall time in Stage 6; both are off the critical path (slack of at least 101 s on every run read). No E2E spec added. RISK-023 stays at 8 on DL-151's reading. | PRF-01 |
| NFR-009 first-load JavaScript (200 KB gzip per route) | None. No `src/` change; Stage 11b passed. | none |
| Page and API latency NFRs (p95 targets in the PRD) | None. No runtime code, query, route or dependency changes. | none |
| Data volume and concurrency NFRs | None. No query, index, schema or migration change. | none |

## Issues for other roles
- **PRD / NFR numbers:** the PRD has the numbers needed (NFR-009's 10-minute p95 and the 6-minute early warning). No PRD finding. The "10 s report line" of AC-5 is a story figure, not an NFR.
- **solution-architect:** PRF-01 (record the baseline). Also for the architect and the other reviewers: the "step" counting question in the orchestrator's brief is a correctness question and is out of my area; I read `MAX_HELPER_STEPS` only as a bound on the work (it caps the chain walk at 3 levels, so the cost is bounded either way).
- **orchestrator:** a single PR attempt cannot be put through the median-of-five reading rule of item 9. If an exact effect on the path is ever wanted, it needs five full runs of the head against five of the base. I do not think it is worth the runner time: the effect is off the path.

## Previous Findings (re-review only)
Not applicable (round 1).

## Hand-off (round 1)
- Status: COMPLETE
- Verdict: APPROVE. Counts: Blocker 0, Critical 0, Major 0, Minor 0, Info 2.
- Artefacts written/updated: `docs/06-reviews/AQP-237/performance.md` (branch `docs/AQP-237-review-performance`)
- Jira / GitHub updates: PR #250 review (COMMENT, verdict in body) with 2 inline Info comments; label `review:performance-approved`; Jira AQP-237 hand-off comment
- Open questions: none
- Risks raised: none new. RISK-023 unchanged at 8 (DL-151)
- Recommended next agent: master (G6 decision once the standards and quality reviews are in)

---

# Round 2 (re-review of `87465b6..57acbae`)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Trigger | DL-156 (7): re-run because the stage 6 file time of the architecture test is over 8 s (10,515 ms on the fix head) |
| Scope | `87465b6..57acbae`: merge 2c543cd (`master` 2891457; read with `git show --cc`) and the fix commit 57acbae. 8 files in the fix commit (+996 / -605), all under `tests/` plus `eslint.config.mjs`; nothing under `src/`, no `package.json` or lockfile change |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Round 2 summary
The test reads slower on the fix head, and the numbers need care. Raw file time went from 5.2 s (round 1) to **10.5 s** in stage 6, and from 4.1 s to **10.6 s** in stage 11 of the same job. The code does not explain it: `createServicesProgram` is unchanged except for a renamed slash helper, the `beforeAll` hook makes the same calls (the only change is 29 fixtures becoming 41), and a local A/B of the whole hook shows no difference (old 5.3 s, new 5.5 s, medians of six interleaved runs). On CI, after dividing by how fast that runner was for other files, the same test still reads about 1.3 to 2.2 times its old cost, and I cannot assign that remainder to the diff. One schedule effect is visible: on the fix head the file ran **last** (stage 6 ended 0.5 s after it did), where it ran in the first wave on the two earlier heads. The cost is a test file and is off the CI critical path on every run read except one, where the slack was 8 s. RISK-023 does not move. AC-5's 10 s line is a report line for the program build, not a gate, and the developer has reported (Jira 11523). I record one optional Minor (PRF-03) with a measured, cheap fix that I do **not** ask for in this PR.

| Severity | Count (round 2 new) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (PRF-03, optional) |
| Info | 0 new; PRF-01 updated; PRF-02 closed |

## Round 2 checks run
No `npm ci`, no full local suite. Evidence is the CI jobs API, the CI job logs, and a single-file local timing outside the repository working copy.

| Check | Command or source | Result |
|-------|-------------------|--------|
| Diff | `git diff 2c543cd 57acbae`; `git show --cc 2c543cd`; the two files at both heads | The fix commit moves the cases into `tests/support/audit-transaction-cases.ts` and `audit-transaction-failing-cases.ts`, adds `lint-fixture.ts`, and rewrites the check (446 lines changed). The merge brings 71 files from `master`, none touching the check. |
| Program build unchanged | `diff` of `createServicesProgram` at 87465b6 and 57acbae | Identical apart from `slashes` renamed `toForwardSlashes`. Still one call, in `beforeAll`; `ts.createCompilerHost(options, true)`, `noEmit`, `incremental: false`. |
| CI jobs | `gh api .../actions/runs/{43056524392,43053441301,43027184210,43053208506,43056860151}/jobs`; logs of the `Stages 1 to 11b` jobs 130647322861, 130636473587, 130544744381, 130635632085, 130648512368 | Per-file Vitest lines, Vitest `Duration`, step times, shard times read. |
| Local single-file timing | Vitest 5.0.5 and TypeScript 5.9.3, one test file; `git archive` copies of 87465b6 and 57acbae in a scratch folder, with `node_modules` shared read-only from the main copy. Nothing in the repository, no `npm ci`, no git state change | Hook A/B and the split below. The machine was noisy (the same build read 3 s to 14 s over the session), so the local figures show shares and direction, not CI seconds. |

## Stage 6 file time: what it is, on which evidence

AC-5 asks that "if building the program takes more than 10 s in the unit stage, the developer reports it to the solution-architect". The CI figure is the **file** time (hook plus cases), which is an upper bound of the build.

| Run (head) | Test (Vitest cases) | Stage 6 file time | Stage 11 file time | Host factor, stage 6 / 11 (median of the other files over 1 s, against the `master` push run) | Normalised to `master`-host speed, stage 6 / 11 |
|---|---|---|---|---|---|
| 43027184210 (87465b6, round 1) | old (29) | 5,199 ms | 4,068 ms | 0.88 / 0.91 | 5.9 s / 4.5 s |
| 43053441301 (merge 2c543cd, old test on the new base) | old (29) | 4,355 ms | 3,393 ms | 0.70 / 0.72 | 6.2 s / 4.7 s |
| **43056524392 (57acbae, attempt 1)** | **new (45)** | **10,515 ms** | **10,561 ms** | 1.13 / 1.07 | **9.3 s / 9.9 s** |
| 43056860151 (control B, `master`-based plants, one case red on purpose) | new (45) | 7,685 ms | (not run) | 1.03 / n/a | 7.5 s |

The `master` push run 43053208506 (2891457) has no architecture test; it is the host reference. Its Vitest `Duration` is 32.98 s (stage 6) and 85.56 s (stage 11).

1. **Is AC-5's 10 s line breached? Not shown.** The over-10 s reading comes from **one run** (43056524392), read twice in the same job on the same runner (stage 6 and stage 11 are not independent samples). The one other host that ran the same code (control B) read 7.7 s. So the new code reads 7.7 to 10.6 s over two runs and three readings. The build is about 80 % of the hook (item 3), so the build on the 10.5 s run is about 8 to 8.5 s (estimate), under 10 s. No evidence reads the **build** above 10 s. The developer reported the file time anyway (11523), so the AC-5 duty is met either way. A median of five is not warranted for a test-file time.
2. **How much of the rise is the host?** About half. The other files read 1.13 times the `master` host on this run and 0.70 on the merge-head run, so those two runners differ by about 1.6 times: 4.4 s x 1.6 is 7 s. The rest (10.5 against 7) is a residue of 1.2 to 1.5 times that I cannot assign to the diff (item 3).
3. **What the diff can and cannot explain.**

| Part of the test | Local share of the hook (calm runs, 5 repeats) | Changed by the fix? | Reading |
|---|---|---|---|
| `createServicesProgram` (parse and resolve 445 files, 7.7 MB of text) | about 3.1 to 3.5 s of about 4.2 to 5.3 s: **about 80 %** | No (rename only) | The base cost. Of the 7.7 MB, 386 KB is `src`, 249 KB is zod (95 files, already in the program before the fix), 2.4 MB is TypeScript's `lib` files, 2.3 MB is `@types/node`, and about 1.5 MB is auto-included `@types/*` (csstype, lodash, d3, react, chai). |
| `beforeAll` set-up: `serviceFilesUnder` twice, `fixtureSources` | under 0.05 s | Fixtures 29 to 41 | Not measurable. A program with 41 fixtures against none: inside the noise (best of four 8.5 s against 7.7 s on the noisy machine). The new prelude imports `zod` and `AuditService`; zod was already loaded, so there is no extra parse. |
| First use of the type checker (global merge, then the 15 real calls) | 0.4 to 1.4 s (up to 2.7 s on the noisy machine) | Check rewritten | Similar to before. The `today` check re-run on a warm program is 0.13 to 0.27 s. |
| The 41 cases | 0.08 to 0.28 s for all of them | +12 cases, more checks per call | **Negligible** (2 % of the hook). |
| Rescans (`usesOf`, `callsAnotherRepository`) | inside the rows above | `usesOf` still rescans per helper step | **PRF-02 is closed**: the whole real-services check, warm, takes 0.13 to 0.27 s for 15 calls. |

   Whole-hook A/B, six interleaved runs each, same machine: **old 5.6, 4.9, 7.1, 6.4, 4.1, 5.0 s (median 5.3); new 4.7, 6.3, 6.8, 5.4, 5.6, 5.3 s (median 5.5)**. The difference (0.2 s) is inside the spread (3 s). So the fix does not make the work heavier on a quiet machine, and it is not a per-call or per-case cost.
4. **The schedule effect (observed; cause not proved).** Vitest runs the biggest files first when it has no timing cache (my reading of its default; I did not check the CI configuration). The test file shrank from 442 to 94 lines because the cases moved to `tests/support`. In the log it started **+32 s** into the 42.6 s stage 6 run on the fix head (16:17:16.99 to 16:17:27.50), against +1.4 s on the round-1 head and +1.7 s on the merge head. On the fix head it was the last substantial file: stage 6 ended 0.5 s after it. On the two earlier heads it ran in the first wave alongside other work. Had it run in the first wave at about 6 to 7 s (the normalised old cost plus a little), stage 6 would have ended about 9 s sooner on that run (estimate). Another run would confirm the order: the next run of this branch, or the `master` push after the squash.
5. **Wall effect on the stages (estimate, uncertainty stated).** Against the merge-head run (same base, old test) after normalising by the host factors: stage 6 about +1 s, stage 11 about +6 s. Against the `master` push run: stage 6 +5 s, stage 11 +12 s. The factors come from 34 and 9 files and are good to about 15 %, which is 5 to 15 s here, so the effect is **not readable from one run**. My estimate of what the PR adds to the main job is **+3 to +10 s**.

## CI path and RISK-023 (the brief's question)

| Run | Head | `Stages 1 to 11b` job | Stage 4 / 5 / 6 / 11 (steps) | Shards (1 / 2 / 3) | Slowest shard minus main job | Path (first job start to `Stages 1 to 11` end) |
|---|---|---|---|---|---|---|
| 43056524392 | 57acbae | **243 s** | 17 / 12 / 44 / 104 s | 251 / 242 / 209 s | **+8 s** | **262 s (4:22)** |
| 43053441301 | 2c543cd (old test) | 164 s | 10 / 6 / 27 / 66 s | 261 / 294 / 303 s | +139 s | 312 s (5:12) |
| 43027184210 | 87465b6 | 190 s | 11 / 9 / 32 / 80 s | 291 / 296 / 263 s | +106 s | 308 s (5:08) |
| 43053208506 (`master` push) | 2891457 | 212 s | 13 / 10 / 34 / 87 s | 234 / 211 / 335 s | +123 s | 346 s (5:46) |

1. **The 4:22 path is not a gain from this PR.** It comes from fast E2E hosts (209 to 251 s against 263 to 335 s elsewhere). I do not read it as evidence that the PR is cheap.
2. **This is the first run where the unit and integration job nearly sets the path** (slack 8 s; 101 to 139 s on the other eight runs I have read: the five base attempts of round 1, 87465b6, the merge head and 2891457). The job took 243 s because the runner was slow: stages 4, 5, 6 and 11 are all 1.2 to 1.6 times the other runs, including stages this PR does not touch (lint 17 s against 10 to 13 s, type-check 12 s against 6 to 10 s). The PR's own share of that job is the +3 to +10 s estimate above.
3. **Effect on the path: 0 s in expectation, at most about +10 s.** For the main job to set a path of 5:30 it would need about 315 s, which is 72 s more than the slow-runner run above. That is not this PR. The PR adds no E2E spec (778 unchanged), so it does not feed the +33 s per E2E-adding story that drives RISK-023 (DL-125, DL-151).
4. **RISK-023 stays at 8 on DL-151's reading.** I recommend no re-score and no hold. DL-151's 5:30 trigger is about the path; this PR touches the part of the path that has slack. What to watch is the slack itself: if more unit-heavy stories land and the runners are slow, the main job becomes the path. That is a note for the solution-architect's fourth-shard work, not a PR finding.
5. **No median of five is needed for this PR.** The fix-head path is below 5:30; DL-142 (1) and DL-143 apply as in round 1.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-03 | Minor (optional, not required for G6) | `tests/support/audit-transaction-check.ts:148` (`createServicesProgram`, the `options` object) | AC-5 (10 s report line); NFR-009 | The program parses 445 files (7.7 MB of text), of which about 4 MB is TypeScript `lib` files and auto-included `@types/*` that no service needs: `lib.dom`, and `@types/lodash`, `d3-*`, `chai`, `react`, `csstype`, which `tsconfig.json` pulls in because it sets no `types`. The build is about 80 % of the hook. | On CI the file read 10.5 s on one slow-runner run (7.7 s on another). Main-job cost about +3 to +10 s (estimate); off the path. Local, noisy machine, 5 interleaved repeats of build plus first use, medians: shipped 4.3 s; `types: ['node']` 4.0 s (-5 %); `lib: ['lib.esnext.d.ts']` 3.7 s (-13 %); both 2.9 s (-31 %). Files 445, 413, 443, 411. **The 15 real calls still pass under each variant** (0 findings). The direction is clear, the size is not. | **Not asked for in this PR.** It changes the type environment the check asks questions in, so the plants (P1 to P5, Q1 to Q3b, Q6) would have to be re-run by reviewer-quality on the new head: another round for a test-file saving. If the developer pushes for another reason, add `types: ['node']` and `lib: ['lib.esnext.d.ts']` to `options` (after `...parsed.options`), run the 15-call check and the plants, and read the file time again. Otherwise put it beside #259 as a follow-up (owner developer, due before G8), only if the next readings stay over 8 s. Do not touch the pool or isolation settings: they are shared with 210 other files (G12). |

## Previous findings (re-review)
| ID | Round 1 | Round 2 status |
|----|---------|----------------|
| PRF-01 (Info) | Record 5.2 s / 4.1 s as the baseline in test strategy section 10 | **Updated, still open for the solution-architect.** Record **a range, not one number**: round-1 head 5.2 / 4.1 s, merge head 4.4 / 3.4 s, fix head 10.5 / 10.6 s (one slow-runner run) and 7.7 s (control B). A later G6 compares against the range and the host factor, not against 5.2 s. DL-156 (8) already sends "the PRF-01 baseline from the fix-head run" to the architect; this is the content. |
| PRF-02 (Info, `usesOf` rescans) | Not measured | **Closed.** Measured: the whole real-services check, warm, is 0.13 to 0.27 s for 15 calls, and all 41 cases take 0.08 to 0.28 s. No memoisation needed. |

## Round 2 other checklist items (none apply or none found)
- **Algorithmic complexity.** Same shape. The new work in the check is a `getTypeAtLocation` on each `record` member access (`verdictOn`), skipped for any other name, and one `getNonNullableType`. Chain depth is still capped by `MAX_HELPER_STEPS` = 3, with cycles refused.
- **I/O.** Still one recursive `readdirSync` of `src/server/services`, now called twice per hook (once in `createServicesProgram`, once in `beforeAll`). A few milliseconds; no finding.
- **Memory.** One program per worker, as in round 1. The fixtures are in-memory strings. No change in kind.
- **Lint cost.** Stage 4 read 17 s on the slow runner (13 s on the `master` push run). Stage 5 (type-check, which the PR does not touch) read 12 s against 10 s, so the lint reading is the host. The `eslint.config.mjs` change (20 lines) adds patterns to option lists ESLint already builds per file; no typed linting. The rule test (111 cases) reads 3.4 s against 2.0 s on the merge head, which is 3.05 s against 2.8 s once normalised: unchanged.
- **Time-limit safety.** Hook limit 120 s against a 10.6 s worst reading (11 times). The cases are lookups on a warm checker, so the 5 s default per test is not at risk.
- **Front end and runtime.** No `src/` change in the fix commit; the merge brings `master`'s own `src/` changes, which are not this PR's. First-load JavaScript is judged by Stage 11b (3 s, passed on the fix head).

## NFR impact (round 2)
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 CI feedback time (p95 ≤ 10 min; 6-min early warning; RISK-023 trigger 5:30) | Low. The fix head's path is 4:22. The PR's share of the main job is about +3 to +10 s (estimate), and the main job has slack on every run read except one slow-runner run (8 s). No E2E spec added. RISK-023 stays at 8. | PRF-01 (baseline as a range), PRF-03 |
| NFR-009 first-load JavaScript (200 KB gzip per route) | None. Stage 11b passed. | none |
| Page and API latency NFRs | None. No runtime code. | none |
| Data volume and concurrency NFRs | None. No query, index, schema or migration change. | none |

## Issues for other roles (round 2)
- **solution-architect:** PRF-01 as a range (above). Also a slack figure beside the path in test strategy 10.5 (slowest shard minus `Stages 1 to 11b`: 101 to 139 s on eight runs, 8 s on 43056524392), so the day the main job becomes the path is seen before it happens. AC-5 says "building the program takes more than 10 s" but CI shows only a file time; say which one the line means.
- **orchestrator:** no extra CI run is needed for the time. Read the `audit-transaction-architecture` line in the `master` push run after the squash and in the first nightly, and send both to the architect with the host factor. If both read over 8 s, open the PRF-03 follow-up.
- **reviewer-quality:** if PRF-03 is ever applied, the re-run of the plants is yours.

## Hand-off (round 2)
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS. Counts: Blocker 0, Critical 0, Major 0, Minor 1 (PRF-03, optional), Info 0 new (PRF-01 updated, PRF-02 closed).
- Measured: architecture test file time on 57acbae, run 43056524392 attempt 1: **10,515 ms (stage 6) and 10,561 ms (stage 11)**; control B run 43056860151: 7,685 ms (stage 6). Earlier heads: 5,199 / 4,068 ms (run 43027184210) and 4,355 / 3,393 ms (run 43053441301). The `master` push run 43053208506 (2891457) has no such test (Vitest Duration 32.98 s stage 6, 85.56 s stage 11). Fix-head path 262 s (4:22); main job 243 s; slowest shard 251 s.
- Artefacts written/updated: `docs/06-reviews/AQP-237/performance.md` (round 2 added; round 1 kept)
- Jira / GitHub updates: PR #250 review (COMMENT, verdict in body) with one inline Minor on `tests/support/audit-transaction-check.ts:148`; label `review:performance-approved` (kept); Jira AQP-237 hand-off comment
- Open questions: none
- Risks raised: none new. RISK-023 unchanged at 8 (DL-151)
- Recommended next agent: master (G6 attempt 2, with the quality and standards round-2 reviews)
