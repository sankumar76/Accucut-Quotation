# Review Report — AQP-199 (STORY-10.14: cut CI time) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (d8cb223)...feat/AQP-199-ci-time` (PR #86; branch is `behind` master) |
| Commit reviewed | 03ad8527ef586315c61c3d11d0ead9be11c546f9 |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
Reviewed against the ACs as restated in Jira comment 11006: AC-1 has no numeric target, AC-2 requires stage 12 to be at least 15 % shorter (20 % was measured), the 5:00 check is withdrawn, and AC-3 to AC-7 are unchanged. The PR makes four changes:
- runs 4 Playwright workers in CI (2 locally);
- warms `/`, `/queue` and `/design-system` once in the set-up project;
- moves 22 tests that read no layout to the desktop project only (`@one-width`, four ruled files, with an allow-list unit test);
- makes the nightly CI-time step print master's 9-minute line and name the oldest and newest runs it used.

The workflow is just as secure as before:
- the trigger is `pull_request` plus `push`, never `pull_request_target`;
- permissions stay `contents: read`;
- no secret is used;
- every action is still pinned to a full SHA.

The required check is still a single job named `Stages 1 to 11`, and new tests guard that. No timeout was widened. The nightly script keeps the pure report logic separate from the I/O, and it validates `head_sha` before the value reaches the job summary.

There is one Minor finding (an `as` cast in a test) and no security impact.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | GitHub `get_diff` (12 files, +416 / −38); `git show 03ad852:<path>` for full files | Read in full |
| Commits | GitHub `get_commits` | 4 Conventional Commits, each with `[AQP-199]`. `423fafe` is an empty baseline commit (STD-05). Branch is `feat/AQP-199-ci-time` |
| CI | run 42070716328 | `Stages 1 to 11` green. The nightly "CI feedback time" job fails on the existing breaches (p95 15 m 05 s), not on this change. That job is not required |
| Workflow security | Reading `ci.yml` and `nightly.yml` at the head | `pull_request`/`push` triggers only. Top-level `contents: read` (nightly also has `actions: read`). No `secrets.` reference. All `uses:` pinned to 40-character SHAs, unchanged. The new `echo` reads only `nproc` and `/proc/meminfo` |
| Required check | `ci-workflow.test.ts` plus reading | One job, `verify`, named `Stages 1 to 11`. No `needs` or `strategy`. Stage 12 is a bare `npx playwright test` with no `continue-on-error` |
| Test strategy §10 / §10.5 | Reading `playwright.config.ts`, `auth.setup.ts`, the specs | `expect` timeout stays at 15 s. No test-level timeout. `retries: 1` and `forbidOnly: IN_CI` unchanged. Worker counts are named constants. The warm-up loop runs before `storageState` is saved |
| File size | `wc -l` at the head | Largest changed file 337 lines (`ci-feedback-time.test.ts`); all within 400 |
| Hygiene | Reading the added lines | No `console.*`, TODO, `eslint-disable`, `any` or secret. One `as` cast in a test (STD-01) |
| Local lint / type-check / tests | not run | The main folder holds another branch, and the rule is direct commands with no checkout; CI covers them |

## Security checklist
| Item | Result |
|------|--------|
| Trigger exposes secrets to forks (`pull_request_target`) | No |
| Token permissions widened | No (`contents: read`; nightly `actions: read`, unchanged) |
| Unpinned or newly added third-party action | No |
| Untrusted input interpolated into a shell `run:` | No |
| API data written to `$GITHUB_STEP_SUMMARY` unchecked | No. `head_sha` must match `^[0-9a-f]{40}$` (tested with an injected newline), `runId` is a number, `startedAt` is re-serialised with `toISOString()` |
| Token printed or echoed in errors | No (existing test kept) |
| Secrets or personal data in code, tests or the PR | No. Test commit ids are invented hex values |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/unit/one-width-tag.test.ts:40` (and `:18`) | No `as` casts (applied to tests as well) | `(RULED_FILES as ReadonlyArray<string>).includes(file)`. The cast exists only because `as const` narrows the list to literals | Hides a type mismatch instead of declaring the intended type | `const RULED_FILES: ReadonlyArray<string> = [...]` without `as const`, then drop the cast |
| STD-02 | Info | `scripts/lib/ci-feedback-time.ts:31` | Clarity of operator messages | The ruled notice says "before AQP-199 merges, stories … are held at G6". After this merge, that clause is history, yet every nightly report keeps printing it | Readers of later reports see an out-of-date instruction | Master's call: record a post-merge wording (DL-095 follow-up) and apply it in STORY-10.15 together with its test. No change in this PR |
| STD-03 | Info | `tests/unit/one-width-tag.test.ts:75-81`, `:57-69` | Test robustness | The guards parse the config and spec text (by indentation and exact test titles) | A reformat or a renamed test fails these guards loudly, never silently, so this is acceptable | Optional: import `playwright.config.ts` and assert `projects[].grepInvert` directly |
| STD-04 | Info | `tests/unit/ci-workflow.test.ts:116` | No duplication | Repeats the `pull_request_target` assertion already made at `:77`. The SHA-pin rule the PR body lists under AC-6 is the existing test at `:81` | None at run time; traceability is slightly blurred | Optional: drop the duplicate line, or name both ACs in the test titles |
| STD-05 | Info | PR #86 (no file) | Merge hygiene / traceability | The branch is `behind` master. `423fafe` is an empty baseline commit. The PR body's AC table still states the old AC-1 and AC-2 targets (5:00, −40 %) | The merged record would contradict the restated ACs | Update the branch and re-run `Stages 1 to 11` on the merge result. Squash-merge. Refresh the AC table to comment 11006 |

## Notes
- Good practice:
  - The 540 / 541 s boundary is strict and tested, and so is the case with fewer than 20 runs.
  - The notice is kept separate from the breaches and fails nothing.
  - Re-run attempts are excluded from both the figures and the named runs.
  - In the job summary, the notice is its own paragraph, so it is written as ruled.
  - The allow-list test first proves that it found the files it guards (no empty-loop pass).
- Out of my lane, recorded for others:
  - Whether 4 workers is the right number (CPU saturation) is a performance and architecture question; the architect answered it in 11004.
  - Whether coverage is kept at one width (AC-3) is for QA and reviewer-quality.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-199/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #86 COMMENT review 5789821487 (5 inline comments, 4 of them findings and 1 positive note, plus the summary); label `review:standards-approved` added (`ai-delivery` and `feature` kept); comment on Jira AQP-199
- Open questions: none
- Risks raised: none (RISK-023 is unchanged and owned elsewhere)
- Recommended next agent: master, for the G6 decision. The developer can fix STD-01 with a one-line change and refresh the PR body (STD-05) when updating the branch

---

## Round 2 — head 380856001a789974f50051f836c76a224383e819 (2026-11-06)

Narrow check of `03ad852..3808560`. The range has one commit, `test(e2e): pin the 22 @one-width tests by title and type RULED_FILES without a cast [AQP-199]`, and it touches only `tests/unit/one-width-tag.test.ts` (223 lines). CI run 42141321692 is green. **Verdict: APPROVE WITH COMMENTS (unchanged).**

| Item | Result |
|------|--------|
| STD-01 (Minor) | **Fixed.** `const RULED_FILES: ReadonlyArray<string>` (line 24) has no `as const`, and line 73 calls `RULED_FILES.includes(file)` with no cast. The file has no other type assertion; `as const` on `WIDTH_PROJECTS` is a const assertion and is allowed. Thread resolved |
| STD-05 (Info) | **Description fixed.** The headline and the AC table state the restated AC-2 (at least 15 %, Jira 11006) and no longer claim −40 % or 5:00. **Merge-time part still open:** the branch is `behind` master, so update it and run `Stages 1 to 11` on the result before merging, and squash-merge |
| STD-03 (Info) | Partly addressed. The three-widths and tagged-set checks now come from Playwright's own listing. The text slicing of the project config remains, and the per-test project assertions now largely cover it. Still Info |
| New child process | Meets the standards (STD-06 below) |

### Child-process check (`listTests`, lines 114-136)
- `spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json'], …)` uses no `shell` option, and every argument is a constant. No shell runs and no variable data reaches the command line, so shell injection is not possible.
- The CLI path is resolved from `import.meta.url`, not from `PATH` or input. `cwd` is the repository root.
- `--list` starts no web server and no browser. The child inherits the environment, as Vitest does, and prints nothing from it.
- `stdout` is parsed and validated with zod before use. The recursive schema is typed `z.ZodType<ListedSuite>`, without a cast. On a non-zero exit, the error carries at most 500 characters of Playwright's own stderr, which holds no secret.
- `beforeAll(…, 90_000)` follows test strategy §10 (line 409: heavy set-up in its own hook, with its own hook timeout). The spawn `timeout` bounds the child process; it is not a wall-clock assertion on the code under test.

### New finding
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-06 | Info | `tests/unit/one-width-tag.test.ts:115-121`, `:143` | Error clarity; no magic numbers | When the spawn times out, `status` is `null`, so the error reads "exited with null" and `result.error` and `signal` are not reported. `90_000` is written twice | A slow run would be harder to diagnose, and the two limits could drift apart | Add `result.error?.message ?? result.signal` to the message, and name a single `LIST_TIMEOUT_MILLISECONDS` constant (optional) |

Round 2 counts: 0 Blocker · 0 Critical · 0 Major · 0 Minor · 1 Info (new). Still open from round 1: STD-02, STD-03 and STD-04 (Info), and the merge-time part of STD-05.

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-199/standards.md` (main folder, uncommitted; Round 2 appended)
- Jira / GitHub updates: PR #86 round-2 COMMENT review (1 inline comment plus the summary); replies on STD-01 (Fixed, resolved) and STD-03; label `review:standards-approved` kept, other labels untouched; comment on Jira AQP-199
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision. Bring the branch up to date with master before merging
