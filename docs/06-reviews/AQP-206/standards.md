# Review Report — AQP-206 (DEF-015: bound and cache the Playwright system packages in CI) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (d5eb4b6)...fix/AQP-206-playwright-deps-cache` (PR #92; `mergeable_state: clean`) |
| Commit reviewed | 71ebe79625131ef27758c66f1c2c8dfe4e163506 |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
Stage 12a is split out of stage 12 and installs the browser's system packages without the unbounded `playwright install --with-deps`:
- **Packages cached:** the `.deb` packages are cached by runner image and Playwright version.
- **Cache hit:** the packages are installed with `dpkg -i`, with no network.
- **Cache miss, or a failed cached install:** apt runs bounded (20 s timeout, 3 retries) inside an 8-minute step.
- **Browser cache:** keyed on the Playwright version.

The PR also folds in STD-06 from PR #86. This follows the architect's design (test strategy §10.6, architecture §9.2).

The workflow is just as secure as before:
- the triggers are unchanged (`pull_request`, `push`);
- permissions are unchanged (`contents: read`);
- no new action;
- no secret;
- `${{ }}` values reach the shell only through `env:`.

The required check is still one job named `Stages 1 to 11`. The script is well written. The cache trust model is acceptable, but the workflow comment that explains it should state the property that actually protects the cache (STD-01). Everything else is Info.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff d5eb4b6 71ebe79` (5 files, +297 / −16); `git show` of each commit | Read in full. 57d9ea0 and its revert 71ebe79 cancel out |
| Commits | `git log` | 4 commits, each carrying `[AQP-206]`: `test(e2e)`, `fix(ci)`, the temporary `ci:` negative control and its `Revert`. Squash merge drops the last two. Branch is `fix/AQP-206-playwright-deps-cache` |
| CI | run 42151550488 (head 71ebe79) | `Stages 1 to 11` green |
| Workflow security | Reading `ci.yml` at the head | Triggers are `pull_request` and `push` (never `pull_request_target`). Top-level `contents: read`, no job-level grants. No `secrets.` reference. Actions are still `actions/cache`, `actions/checkout` and `actions/setup-node`, SHA-pinned (tested). `${{ }}` only in `with:` and `env:`, never in `run:` |
| Required check | `ci-workflow.test.ts` plus reading | One job, `verify`, named `Stages 1 to 11`. No `needs` or `strategy`. Stage 12a has no `if:` and no `continue-on-error` |
| Script quality | Reading `scripts/ci/playwright-system-deps.sh` (62 lines) | `set -euo pipefail`. Every expansion quoted. `${1:?usage}`, `compgen -G` guard, `cp --`. `sudo` only for `dpkg` and `tee`. A failure inside the `if` condition is handled deliberately (fallback) |
| Test strategy §10 / §10.6 | Reading the tests | The script test uses fake `sudo`, `dpkg` and `npx`, with set-up and teardown in hooks and no timeout or wall-clock check. It covers hit, miss, bad cache, empty cache and real failure |
| Hygiene | Reading the added lines | No `as` cast, `any`, TODO or secret. No new dependency |
| Local lint / type-check / tests | not run | The main folder holds another branch, and the rule is direct commands with no checkout; CI covers them |

## Security checklist
| Item | Result |
|------|--------|
| Trigger exposes secrets to forks (`pull_request_target`) | No |
| Token permissions widened | No |
| Unpinned or new third-party action | No (a test asserts the set of actions is unchanged) |
| Untrusted input interpolated into `run:` | No (cache hit flag and directory passed through `env:`) |
| Cache poisoning | Acceptable (STD-02). Entries are scoped by ref. Default-branch entries are written only by `push` runs on `master`. A pull request's entries reach only that pull request. Keys include the image and the Playwright version. Only `.deb` files this run downloaded (apt-verified) are cached |
| Privilege use | `sudo` limited to `dpkg -i`, `dpkg --configure -a` and `tee` of the apt bounds file |
| Secrets or personal data | None |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `.github/workflows/ci.yml:224` | Accuracy of security-relevant comments | The comment says "a fork's pull request can read, not write". As far as I know a fork's `pull_request` run can save a cache, scoped to its merge ref. I could not check GitHub's documentation in this session | Whoever next changes the cache would reason from a property that may not hold | State the property that holds: "caches are scoped by ref; only `push` runs on `master` write entries other branches read; a pull request's entries reach that pull request only" (and the same in §10.6 if it repeats the claim) |
| STD-02 | Info | `scripts/ci/playwright-system-deps.sh:30` | §5 | Positive. `dpkg -i` checks no signature, so integrity rests on ref scoping and on apt's verification at download. Acceptable, and the script quality is good | — | — |
| STD-03 | Info | `scripts/ci/playwright-system-deps.sh:55` | Operability / docs | Every fallback run restores the bad entry first, which counts as use. So the "7 days unused" eviction in the PR body does not happen while CI runs, and the entry stays until the image or Playwright version changes | Each run pays a bounded apt install, with a warning, possibly for weeks | Document the remedy: `gh cache delete playwright-debs-<image>-<version>` (a maintainer, `actions: write`) |
| STD-04 | Info | `scripts/ci/playwright-system-deps.sh:40-46` | Tidiness | The `mktemp` file is left behind when `install-deps` fails under `set -e` | None on an ephemeral runner | Optional `trap 'rm -f "${before}"' RETURN` |
| STD-05 | Info | `tests/unit/ci-workflow.test.ts:172` | Comment accuracy | The comment says "one of the four already pinned", but three are listed (`upload-artifact` is in `nightly.yml`) | Confusing to a reader | "three" |
| STD-06 | Info | `tests/unit/one-width-tag.test.ts:114-130` | — | Positive: STD-06 from PR #86 is fixed. The message names `result.error` or the signal, `stderr ?? ''`, and `LIST_TIMEOUT_MS` is used for both the spawn and the hook | — | — |
| STD-07 | Info | PR #92 (no file) | Merge hygiene | 57d9ea0 (temporary negative control) and 71ebe79 (revert) are on the branch | Kept by a merge commit | Squash-merge. The control wrote into the restored directory only and a hit is not saved again, so no poisoned entry exists. `describe.skipIf(!BASH_AVAILABLE)` skips only where bash is missing; CI has bash |

## Notes
- For other roles:
  - The nightly workflow still uses `--with-deps` (follow-up #93, developer).
  - Whether the cache saves time is reviewer-performance's call. The PR says the point of the change is the bound, not a faster median.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-206/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #92 COMMENT review 5795093885 (6 inline comments, 4 of them findings and 2 positive notes, plus the summary); label `review:standards-approved` added (`bug`, `ai-delivery` and `ci` kept); comment on Jira AQP-206
- Open questions: none (STD-01 asks the developer to reword a comment, and the facts behind it are worth confirming against GitHub's cache documentation)
- Risks raised: none
- Recommended next agent: master, for the G6 decision. The developer can make the STD-01 and STD-05 comment edits in a minute
