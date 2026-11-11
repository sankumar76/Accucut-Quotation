# Review Report — AQP-237 (STORY-10.18) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-237-audit-tx-static-checks` (PR #250) |
| Commit reviewed | 87465b68f888344df48a108a24912ca161b6b2f6 |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE** (two Info notes, no change requested) |

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

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE. Counts: Blocker 0, Critical 0, Major 0, Minor 0, Info 2.
- Artefacts written/updated: `docs/06-reviews/AQP-237/performance.md` (branch `docs/AQP-237-review-performance`)
- Jira / GitHub updates: PR #250 review (COMMENT, verdict in body) with 2 inline Info comments; label `review:performance-approved`; Jira AQP-237 hand-off comment
- Open questions: none
- Risks raised: none new. RISK-023 unchanged at 8 (DL-151)
- Recommended next agent: master (G6 decision once the standards and quality reviews are in)
