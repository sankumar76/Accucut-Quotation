# Review Report — AQP-216 (STORY-10.16: warm the Playwright package cache and bound the download) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (4c12103)...` PR #100 (closes #93 and #99) |
| Commit reviewed | 7bda9e0db983077f9b820c3c55277a2fcff3466b |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS (2 Minor test-code fixes requested) |

## Summary
The PR makes four changes:
- **Package list:** stage 12a now reads its package list from `playwright install-deps --dry-run`, using a new parser (`playwright-deps-packages.sh`).
- **Bounded download:** the download runs under `timeout`, in up to three tries (45 s update, 90 s download). Tries 2 and 3 fall back to `archive.ubuntu.com`. After a successful download the packages are installed offline.
- **Nightly warm-up:** a new nightly job, `warm-playwright-cache`, saves the stage 12a keys from `master`.
- **Lighthouse:** the Lighthouse job uses the same bounded script instead of `--with-deps`.

**Security**
- Triggers, permissions, pins and secrets are unchanged and sound.
- apt signature checks still apply on the fallback mirror.
- The parser keeps option-shaped input away from apt.
- The cache-trust model holds.
- The required check is untouched: `ci.yml` is not in the diff.

**Findings:** two Minor findings, both in test code: six `as` casts, and an assertion that cannot fail.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 4c12103 7bda9e0` (8 files, +730 / −45) | Read both scripts in full, plus the `nightly.yml`, README and test diffs |
| Commits | `git log` | 2 commits, `feat(ci): … [AQP-216]` |
| CI | run 42204070612 | Green. The evidence runs were on throwaway PR #101 (DL-105). I relied on the PR body and Jira 11107 and did not open those runs |
| Workflow security | Reading `nightly.yml` plus `nightly-workflow.test.ts` | `schedule`, `workflow_dispatch` and path-limited `pull_request` triggers; never `pull_request_target`. `contents: read` and `actions: read` only. No secret. No new action, SHA-pinned. `persist-credentials: false`. Expressions passed through `env:` |
| Required check | `git diff --stat` on `ci.yml` | `ci.yml` unchanged, so `Stages 1 to 11` is unchanged |
| apt trust | Reading `use_fallback_mirror` and a grep for insecure options | Only the URI is rewritten. No `trusted=yes`, `--allow-unauthenticated` or `AllowInsecureRepositories` |
| Shell quality | Reading both scripts | `set -euo pipefail`, quoted throughout, narrow `sudo`, `trap EXIT` cleanup, `124` handled |
| Hygiene and size | grep and `wc -l` | 6 `as` casts in tests (STD-01). Largest file is `ci-workflow.test.ts` at 379 lines |
| Local tests | Not run | Memory is low on this machine, and the coordinator asked for light local work. CI covers the tests |

## Security checklist
| Item | Result |
|------|--------|
| Fork-exposed trigger | No |
| Permissions widened | No |
| New or unpinned action | No |
| Expression injection into `run:` | No |
| apt verification on the fallback mirror | Kept. `sed` changes only the URI, so `Signed-By` and the keyrings apply, `InRelease` and the package hashes are verified, and `--no-download` installs only what was verified. `http://` reveals package names only, as the runner's own mirror already does |
| Option injection into apt | Prevented. Names must match `^[a-z0-9][a-z0-9+.-]*(:arch)?(=version)?$` and are passed as quoted `"$@"`. Tested with `--allow-unauthenticated` in both input shapes |
| Cache poisoning | Acceptable. Scheduled runs use the default branch, so entries every branch reads are written by reviewed `master` code. Pull-request saves stay scoped to that pull request |
| Other repositories on the runner | Untouched (tested) |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/unit/playwright-system-deps.test.ts:98, 208, 342, 372`; `tests/unit/playwright-deps-packages.test.ts:52, 55` | No `as` casts (applied to tests) | `{} as Record<…>` and `Object.keys(…) as …[]` | The record claims every key exists before any is filled, so a skipped scenario would read `undefined` as a result | An `as const` tuple of names, a derived type, a `Map` built from the tuple, and `defined()` on read |
| STD-02 | Minor | `tests/unit/ci-workflow.test.ts:348` | A test must be able to fail | `expect(3 * (45 + 90)).toBeLessThan(8 * 60)` compares literals | The rule that the tries fit inside the step cap is unguarded | Read `update_timeout`, `download_timeout` and `max_tries` from the script, and `timeout-minutes` from `ci.yml` and both `nightly.yml` steps |
| STD-03 | Info | `scripts/ci/playwright-system-deps.sh:82-90` | §5 | Positive: apt signatures, option guard and cache trust (see the security checklist) | — | — |
| STD-04 | Info | `scripts/ci/playwright-system-deps.sh:104-113` | Script quality | Positive. `trap EXIT` and the key-naming warning close STD-04 and STD-03 of AQP-206. `timeout` sends SIGTERM only | A process that ignored SIGTERM would run until the 8-minute step cap | Optional `timeout --kill-after=10`. Then 3 × (45 + 90 + 20) = 465 s, still under 480 s |

## Notes
- **For reviewer-performance:** the browser download (`npx playwright install chromium`) on a browser-cache miss is not inside the per-try bounds. Only the 8-minute step cap limits it.
- The `nightly.yml` copy of the stage 12a steps is guarded word for word by a test, and so is `CACHE_EPOCH`. That is a good pattern, and it is what I asked for in AQP-208 STD-05.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-216/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #100 COMMENT review (4 inline comments: 2 Minor, 2 Info, plus the summary); label `review:standards-approved` added (other labels kept); comment on Jira AQP-216
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision. The developer can fix STD-01 and STD-02 in the tests
