# Review Report — AQP-208 (STORY-10.15: CI shard step) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (93d3b8f)...feat/AQP-208-ci-shards` (PR #96) |
| Commit reviewed | 9c725e1b9adbfc5620bc4a571c5878bb50be9ca3 |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS (3 Minor test-code fixes requested) |

## Summary
The CI workflow now has three kinds of job:
- `verify`, renamed `Stages 1 to 11b`;
- a matrix job `Stage 12: E2E (shard i of N)` with N = 2, in which each shard builds itself, migrates its own throwaway database and runs stage 12a;
- a fan-in job `required`, named `Stages 1 to 11`, which has `needs: [verify, e2e]` and `if: always()` and fails unless every needed job's result is exactly `success`.

The nightly CI-time measure now spans a multi-job run, and the 9-minute line follows DL-103.

**Workflow security is unchanged:**
- triggers are `pull_request` and `push`;
- permissions are `contents: read`;
- no new action, all SHA-pinned;
- no secret;
- `${{ }}` values reach bash only through `env:`;
- no artifacts pass between jobs.

**The fan-in logic is correct.** It is proven by a bash-level unit test, and by three negative controls on PR #98, which ended with the required check failing after a failed shard, after skipped shards and after a cancelled run. The required check name `Stages 1 to 11` is unchanged and appears exactly once.

**The findings are in the test code:**
- an `as` cast;
- heavy set-up placed inside tests with widened timeouts;
- one test file over the 400-line limit.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 93d3b8f 9c725e1` (9 files, +618 / −108) | Read in full: workflow, scripts, tests, README |
| Commits | `git log` | 4 commits, each a Conventional `ci(e2e): … [AQP-208]`. 84f5d11 is an empty baseline commit, so squash-merge |
| CI | run 42173161146 (head 9c725e1) | `Stages 1 to 11b`, both shards and `Stages 1 to 11` green. `unstable` comes only from the non-required Nightly CI-time step |
| Workflow security | Reading `ci.yml` and `nightly.yml` at the head | See the security checklist |
| Fan-in | Reading plus `ci-workflow.test.ts` plus PR #98 evidence in the PR body | Correct (STD-04) |
| Required check name | `ci-workflow.test.ts` | `name: Stages 1 to 11` appears exactly once, on `required`. `Stages 1 to 11b` and the shard names are distinct |
| Test strategy §10 | Reading the tests | `e2e-shards.test.ts` does its heavy listing inside tests with 120 s test timeouts (STD-02). The other files are fine |
| File size | `wc -l` at the head | `ci-feedback-time.test.ts` 447 (STD-03). `ci-workflow.test.ts` 397, `ci.yml` 399, `ci-feedback-time.ts` 243 |
| Hygiene | Reading the added lines | One `as` cast in a test (STD-01). No `any`, TODO or secret |
| Local lint / type-check / tests | not run | The main folder holds another branch, and the rule is direct commands with no checkout; CI covers them |

## Security checklist
| Item | Result |
|------|--------|
| `pull_request_target` or another fork-exposed trigger | No |
| Permissions widened | No (top-level `contents: read`, no job-level grants) |
| Unpinned or new action | No |
| Expression injection into `run:` | No. `matrix.shard`, `strategy.job-total` and `needs.*.result` go through `env:` |
| Secrets | None. Database passwords are generated per job, masked before use, and exist only on the job's own service. `persist-credentials: false` in both checkouts |
| Data passed between jobs | None (no artifacts, no cache save/restore actions). Shared cache keys are scoped by ref, as reviewed in AQP-206 |
| Merge past a failed, skipped or cancelled shard | Not possible. `always()` plus exact `success` (a skipped required check would count as passed, which is why `!cancelled()` is rightly not used) |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/unit/e2e-shards.test.ts:49` | No `as` casts (applied to tests) | `(JSON.parse(stdout) as { suites: Suite[] })` | A change in Playwright's JSON shape is hidden, not reported | Parse with the zod schema already in `one-width-tag.test.ts`, moved with the spawn into `tests/support/playwright-list.ts` and shared by both |
| STD-02 | Minor | `tests/unit/e2e-shards.test.ts:93`, `:104` | Test strategy §10 (around line 409: heavy set-up in `beforeAll` with its own hook timeout) | Three `--list` runs start lazily inside the first test that needs them, and both tests widen their timeout to 120 s | Set-up time is billed to a test, and test timeouts are widened | Load in `beforeAll(…, LIST_TIMEOUT_MS)`, drop the per-test timeouts, use a named constant |
| STD-03 | Minor | `tests/unit/ci-feedback-time.test.ts` (new block at `:248`) | At most 400 lines per file | 337 → 447 lines | Harder to navigate; against the standard | Split the sharded-run cases into their own file, sharing the `job()` / `runsOf()` builders through `tests/support`. Info: `ci-workflow.test.ts` is at 397, so its helpers are a natural `tests/support/workflow-text.ts` |
| STD-04 | Info | `.github/workflows/ci.yml:377-384` | §5 | Positive: the fan-in logic, its tests and the negative controls | — | Optional `permissions: {}` on `required` (it needs no token) |
| STD-05 | Info | `.github/workflows/ci.yml:252` | No unguarded duplication | The PostgreSQL service (digest, options) and the roles step are copied into the shard job, kept in step only by a comment | `verify` and the shards could drift onto different database images unnoticed | A test that both service definitions are identical (or a YAML anchor) |
| STD-06 | Info | `scripts/lib/ci-feedback-time.ts:42` | — | Positive. The DL-103 notice no longer goes stale, which closes STD-02 of PR #86. The multi-job measure (earliest first-attempt start to the successful fan-in's end) is sound and tested for one-job, sharded, failed, cancelled, skipped or missing fan-in, re-run, queue wait and mixed shapes | — | — |

## Notes
- The PR body records the three negative controls on PR #98 (closed, unmerged). I relied on the PR body for those run results and did not open runs 42173935608, 42174577700 and 42175229469 myself.
- For other roles:
  - Shard balance (shard 1 holds all mobile tests) and CI time are reviewer-performance's call.
  - Follow-up #99 (stage 12a can still lose 8 minutes on a cache miss) belongs to the developer and architect.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-208/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #96 COMMENT review (6 inline comments: 3 Minor, 3 Info, plus the summary); label `review:standards-approved` added (`ai-delivery`, `feature` and `ci` kept); comment on Jira AQP-208
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision. The developer can fix STD-01 to STD-03 together (a shared `tests/support/playwright-list.ts`, a `beforeAll`, and a file split)
