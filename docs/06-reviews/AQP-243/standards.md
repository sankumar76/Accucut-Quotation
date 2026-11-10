# Review Report — AQP-243 (STORY-10.19) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-243-ci-setup-cut` (051c0b5…c24fe22), PR #152 |
| Commit reviewed | c24fe22 (six commits: 9c6ec85, e6bf684, 9c3c9a7, 48ab9cb, eebd05a, c24fe22) |
| Date | 2026-11-10 |
| **Verdict** | **REQUEST CHANGES** (one Major: a swallowed error in the summary script; no Blocker or Critical) |

## Summary

This is a careful change. Workflow hygiene is in good order: every new `uses:` is pinned to a commit SHA that matches the SHA already used
in the file (`actions/cache` 55cc834, `checkout` 3d3c42e, `setup-node` 949feb2), the trigger is still `pull_request` and never
`pull_request_target`, the fan-in job holds exactly `actions: read` and `contents: read` (AC-5 allows both), the token reaches only
the script step as `github.token`, the checkout has `persist-credentials: false`, and the script reports only an HTTP status on
failure, never a body or the token. The cache key follows the architect's ruling (runner OS and architecture, `ImageOS`, `NODE_VERSION`,
`NPM_VERSION`, one hash of lockfile, `package.json` and `.npmrc`) and has no `restore-keys`. The integrity script has
`set -euo pipefail`, quotes every expansion and is bounded by `timeout`. The six changed or narrowed guard assertions are all
declared in the PR body under "Assertions removed or weakened (G12 rule)", with reason, and they match the diff one for one.

The one Major (STD-01) is a rule in two places of the standards: `main()` in `scripts/lib/ci-run-summary.ts` swallows any
rejection with no output. The fix is three lines and keeps exit 0. The Minors are a missing step timeout on the summary steps
(STD-02, which is the one way left for the summary to turn the required check red), unclear failure messages in the integrity script
(STD-03), unnamed numbers (STD-04), the `v1` literal written in four places with no documented way to bump it (STD-05) and two README gaps (STD-06).

**On the literal `v1`:** the architect should record it (STD-07). It is sound, but it is not in the ruled key and the guard test pins it.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 5 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff scope | `gh pr diff 152`, `git diff --stat` | 10 files, +1,435 / -18 in the PR: `ci.yml`, `README.md`, `scripts/ci/node-modules-integrity.sh`, `scripts/lib/ci-run-summary.ts`, `tests/support/ci-run-jobs.ts` and five test files. No `src/**`, no dependency, no lockfile, no `.gitleaks*`, no repository-settings file |
| Lint (changed TS files) | `node node_modules/eslint/bin/eslint.js --no-cache <7 changed .ts files>` in the developer's worktree at c24fe22, read-only | exit 0, no output |
| Type-check (whole repo) | `node node_modules/typescript/bin/tsc --noEmit --incremental false` in the same worktree | exit 0 |
| Format check | none configured (`package.json` has no formatter; the Dev Record says the same) | n/a |
| Secret scan | `gitleaks` and `shellcheck` are not installed on this machine, so I could not run them | Gap. I read all 1,599 lines of the diff: no credential-like text (the only token values are `invented-token-value` in tests). CI stage 2 (Gitleaks, full history) is inside `Stages 1 to 11b`, which is `success` on c24fe22 (check run 129662112323) |
| CI on the head | `pull_request_read get_check_runs` | 5 of 5 `success` for run 42763746916 (`Stages 1 to 11`, `Stages 1 to 11b`, shards 1 to 3) |
| Script hygiene | read in full | `set -euo pipefail`, quoted expansions, `timeout` on the listing, `mktemp` plus `mv -f` for the record, LF only (no CR), mode 100644 like its siblings in `scripts/ci/` |
| Actions pinned | `grep uses:` on the head `ci.yml` | 14 `uses:` lines, all `@<40-hex> # vX.Y.Z`; the three new `cache/restore`, `cache/save` and the summary `checkout`, `setup-node` reuse the SHAs already in the file |
| Guard assertions changed | diff of `ci-workflow.test.ts` (4 hunks) and `aqp-27-scaffold.test.ts` (1 hunk) against the PR body table | 6 changed or narrowed, 6 declared, none undeclared |
| File sizes | `wc -l` at the head | `ci-run-summary.ts` 329; `ci-run-summary.test.ts` 287; `ci-setup-cut.test.ts` 235; `node-modules-integrity.test.ts` 190; `ci-workflow.test.ts` 388 → 396; `aqp-27-scaffold.test.ts` 434 → 442 (over 400, pre-existing); `ci.yml` 584 (configuration) |

### Workflow hygiene

| Item | Result | Evidence |
|------|--------|----------|
| Top-level permissions | Pass | `permissions: contents: read` (ci.yml:36-37) unchanged; `verify` and `e2e` inherit it. The cache actions need no extra scope |
| Fan-in job permissions | Pass | `required` (ci.yml:535-538) holds exactly `actions: read` and `contents: read`, no write scope; the replacement test pins the pair. Matches AC-5 ("`contents: read`, `actions: read` only") and the architect's "at job level only" |
| Token handling | Pass | `GITHUB_TOKEN: ${{ github.token }}` only in the script step; the verdict step has no `uses:` or token (asserted); `persist-credentials: false` on the summary checkout; the script sends the token in one `authorization` header and reports `HTTP <status>` only (tested with a body of "secret body") |
| Trigger | Pass | `pull_request` and `push` to `master`; never `pull_request_target`. A fork's pull request gets a read-only token |
| Cache key | Pass with STD-05 | `key=node-modules-v1-${RUNNER_OS}-${RUNNER_ARCH}-${ImageOS}-node${NODE_VERSION}-npm${NPM_VERSION}-${INPUT_HASH}`, `INPUT_HASH` = `hashFiles('package-lock.json', 'package.json', '.npmrc')`; the key is built in the shell because `ImageOS` is not in the `env` expression context (correct). No `restore-keys` on this cache (the two remaining ones are the Next.js build caches; asserted) |
| Order | Pass | pinned npm → key → restore → check → `npm ci` (miss) → `npm ci` (fallback) → save → `prisma generate` → build; asserted for both jobs, including that nothing writes to `node_modules` between the record and the save |
| Save condition | Pass | `cache-hit != 'true' && nminstall.outputs.recorded == 'true'`, no status function, so a failed `npm ci` or record saves nothing; the fallback never saves |
| Logs | Pass | The fallback warning prints the key and `gh cache delete`; no secret in any step; the host step prints `nproc` and the CPU model only |
| Summary steps cannot change the result | Pass with STD-02 | three `continue-on-error: true` steps with `if: always()`, none on the job or the verdict step (asserted three ways); the gap is the missing step timeout |
| Version control | Pass | Branch `feat/AQP-243-ci-setup-cut`; commits `ci(setup)`, `ci(summary)`, `ci`, `ci`, `test(ci)`, `docs(readme)`, every one ends `[AQP-243]`; PR title `AQP-243: STORY-10.19: CI set-up cut and set-up summary`; labels `ai-delivery`, `feature`; no generated file or secret committed |
| G12 declaration | Pass | Six rows in the PR body: STD-04 test replaced, fan-in `continue-on-error`, "nothing passes between jobs", the `uses:` set, the CACHE_EPOCH test, `aqp-27-scaffold` AC-4. Each states before, after and why. The CACHE_EPOCH row is a narrowing (whole-file ban → two named steps) and is labelled so |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `scripts/lib/ci-run-summary.ts:320-327` | Coding Standards §1, §10 TypeScript ("never swallow errors silently") | Both handlers of `main().then(...)` set `process.exitCode = 0` and print nothing. A failed `appendFileSync` or any rejection from `main()` disappears; the first handler is redundant | The summary page is missing on that run and nobody can tell why. The AC asks for exit 0 on an API or data problem, which `summariseRun` already reports with a reason; this path has none | Keep exit 0, print a token-free `::warning::` with `error.name`; add a test with an unwritable `GITHUB_STEP_SUMMARY` |
| STD-02 | Minor | `.github/workflows/ci.yml:563`, `572`, `579` | Workflow hygiene (timeouts); AC-5 ("changes no job result") | The three `Summary:` steps have no `timeout-minutes`; only the job has one (5 min, line 539) | A stalled checkout, `setup-node` or script ends in a job timeout, which `continue-on-error` does not absorb, so the required check goes red after the verdict passed | `timeout-minutes: 1` on each step; extend the `ci-setup-cut.test.ts` guard |
| STD-03 | Minor | `scripts/ci/node-modules-integrity.sh:44`, `57`, `70` | Coding Standards §1, §4 | `record` fails silently when `find` or `timeout` fails; `check` reports every listing failure as "could not be listed within N s" | A misleading or missing reason on the path an operator reads when the cache falls back | Report the status inside `fingerprint` (124 = time limit, other = `find` failed); add a failing-`find` case to the test |
| STD-04 | Minor | `scripts/lib/ci-run-summary.ts:137`, `:282`; `scripts/ci/node-modules-integrity.sh:57` | Coding Standards §1 (no magic numbers) | `1_000` and `2_000` sort ranks, `per_page=100`, and `fingerprint 120` are unnamed | Intent is not readable; the rest of the file names its numbers | Named constants, see the notes |
| STD-05 | Minor | `.github/workflows/ci.yml:130`, `:377`; `scripts/ci/node-modules-integrity.sh:19-20`; README section | Coding Standards §1 (no magic strings, DRY at two copies), §8 | `v1` is written in four places and pinned as an exact string in a test; the existing convention is the `CACHE_EPOCH` env entry. The README gives two ways to replace a bad Playwright entry but only one for `node_modules` | A bump is a four-file edit; the token-free way to start a new key is undocumented | One `NODE_MODULES_CACHE_FORMAT` env entry; add the "start a new key" bullet to the README |
| STD-06 | Minor | `README.md:275-280` | Coding Standards §8 | The README omits the `--ref refs/pull/<n>/merge` note that the PR body gives for `gh cache delete`, and does not mention the per-job host line. Some lines run to 190 columns | The operator note lives only in a PR body | Two sentences, see the notes |
| STD-07 | Info | `scripts/ci/node-modules-integrity.sh:19-20`; `ci.yml:130` | CLAUDE.md rule 5/6; test strategy 10.5 item 7 | The `v1` prefix is not in the ruled key | **Architect should record it** (answer to the developer's question) | See the notes |
| STD-08 | Info | `scripts/ci/node-modules-integrity.sh:32`, `:44`, `:81`; `tests/unit/node-modules-integrity.test.ts:21` | Coding Standards §8 | Needs GNU `find -printf` and `timeout`, not stated; exit codes are 1 (missing argument) and 2 (unknown mode) but 0 and 1 are documented | None for this team (Ubuntu runner, Git Bash) | One header line |
| STD-09 | Info | `scripts/ci/node-modules-integrity.sh:1` | Coding Standards §9 | No `.gitattributes`, so CRLF checkout would break the script | None today (LF in the blob; local runs pass) | `*.sh text eol=lf`, separate change |
| STD-10 | Info | `tests/acceptance/aqp-27-scaffold.test.ts:160`; `tests/unit/ci-workflow.test.ts` | Coding Standards §1 (400 lines), §9 | `aqp-27-scaffold.test.ts` 442 lines (+8, over the limit before); `ci-workflow.test.ts` 396. Commits `9c3c9a7` and `eebd05a` each hold more than one concern | None after squash merge | Next addition starts a new file; no history rewrite |
| STD-11 | Info | `tests/unit/ci-run-summary.test.ts:227` | Coding Standards §6 | A loopback HTTP server and a child process in a unit test | Accepted: no external traffic, and it proves the no-install run | None |

Good practice noted: the step names that the summary script reads are declared an interface in both the workflow comment and the
script, and `ci-setup-cut.test.ts` checks that the fixtures use names that exist in `ci.yml`; the unit tests use invented tokens
and one asserts the token never reaches the output; `fetchRunJobs` validates `repository`, `runId` and `attempt` with allow-list
patterns before building the URL and bounds the request with `AbortSignal.timeout`; every number in the Dev Record has a run ID;
the corrupt-cache and lockfile controls were run on throwaway PRs and closed unmerged; a failed record is a warning that stops the
save instead of saving an entry that could only fall back.

<details><summary>Detailed notes and code suggestions</summary>

### STD-01
**Current** (`scripts/lib/ci-run-summary.ts:320-327`)
```ts
main().then(
  () => { process.exitCode = 0; },
  () => {
    // The summary must never fail the job: a failed write is the only thing that gets here.
    process.exitCode = 0;
  },
);
```
**Suggested**
```ts
main().catch((error: unknown) => {
  // Exit 0 stays (AC-5: the summary never fails the job), but the reason must be visible in the log.
  process.stderr.write(`::warning::The run summary could not be written (${error instanceof Error ? error.name : 'unknown error'}).\n`);
});
```
`error.name` only, so a path or a token can never be echoed. Test: run the script with `GITHUB_STEP_SUMMARY` set to a path in a
missing directory; expect exit 0 and the warning on standard error.

### STD-02
Add `timeout-minutes: 1` to the three steps. The script already bounds its request at 15 s; the checkout and `setup-node` take
1 to 3 s in the logs. Guard: in the `ci-setup-cut.test.ts` summary test, next to `continue-on-error` and `always()`, expect
`/^\s+timeout-minutes: \d+$/m` in each of the three steps.

### STD-03
```bash
fingerprint() {
  local bound="$1" list status=0
  list="$(cd "${dir}" && timeout "${bound}" find . \( -type f -o -type l \) ! -path "./${record_name}" -printf '%p %s\n' | LC_ALL=C sort)" || status=$?
  if [ "${status}" -eq 124 ]; then echo "listing ${dir} stopped after ${bound} s" >&2; return 1; fi
  if [ "${status}" -ne 0 ]; then echo "listing ${dir} failed (exit ${status})" >&2; return 1; fi
  if [ -z "${list}" ]; then echo "the directory ${dir} holds no file" >&2; return 1; fi
  ...
```
With `pipefail` the pipeline status is the last non-zero one, so `timeout`'s 124 survives `sort`. In `check`, drop "within ${limit} s" from the
fixed message; `fingerprint` now says the cause.

### STD-04
```ts
const FAN_IN_RANK = 1_000; // after verify (0) and the shards (their index), before any other job
const OTHER_RANK = 2_000;
const JOBS_PER_PAGE = 100; // a run has six jobs, so one page is enough
```
```bash
record_bound=120   # seconds: generous, because `record` runs once per cache entry, never on a hit
current="$(fingerprint "${record_bound}")"
```

### STD-05
```yaml
env:
  ...
  # Format of the integrity record kept inside the node_modules cache entry (scripts/ci/node-modules-integrity.sh).
  # Raise it with any change to what `record` writes, or to start a new key when an entry is bad and cannot be deleted.
  NODE_MODULES_CACHE_FORMAT: '1'
```
Use `node-modules-v${NODE_MODULES_CACHE_FORMAT}-...` in both key steps and make the guard test assert the env entry and the
`${NODE_MODULES_CACHE_FORMAT}` text. The name deliberately does not contain `CACHE_EPOCH:` so the one-epoch test in
`ci-workflow.test.ts` is untouched. README bullet to add: "**Start a new key.** Raise `NODE_MODULES_CACHE_FORMAT` by one in a
reviewed pull request, when the entry cannot be deleted."

### STD-06
Add to "A key never changes after it is saved...": "`gh cache delete <key>` removes the entry in every ref; add `--ref
refs/pull/<n>/merge` to remove one pull request's copy." and "Each install job also writes its CPU count and model to its own job
summary." I confirmed `-r, --ref` in `gh cache delete --help`.

### STD-07 (for the solution-architect)
Record in test strategy §10.5 item 7 and architecture §9.2 (the AC-8 amendment is the natural place): "The key starts with
`node-modules-v<N>`, where N is the format of the integrity record inside the entry. N is raised with any change to what
`scripts/ci/node-modules-integrity.sh record` writes, or to start a new key when an entry is bad and cannot be deleted." Reason it
is sound: the record travels inside the entry, so its format is part of the key; without it an old entry would fail the new check and
fall back on every run until deleted. No AC, figure or estimate changes.

</details>

## Issues for other roles

- **solution-architect:** STD-07, record the `v1` format number in §10.5 item 7 and §9.2 at the AC-8 amendment.
- **reviewer-quality:** STD-01 needs a test for the unwritable summary path; STD-02's guard extension belongs in `ci-setup-cut.test.ts`.
- **developer (environment):** the developer's worktree `scratchpad/dev-243` showed ` M .github/workflows/ci.yml` after my read-only eslint and tsc runs. I did not change it (eslint `--no-cache`, tsc `--incremental false`, nothing else); it was clean when I first looked.

## Re-review

First review; nothing to verify yet. On a re-review I will check STD-01 to STD-06 against the new diff only.

## Hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-243/standards.md` (branch `docs/AQP-243-review-standards`)
- Jira / GitHub updates: PR #152 review (COMMENT, 11 inline comments), label `review:standards-changes-requested`, hand-off comment on AQP-243
- Open questions: STD-07 (architect: record `v1`)
- Risks raised: none new
- Recommended next agent: developer — fix STD-01 (Major) and, ideally, STD-02 to STD-06 in one push; then reviewer-standards re-review
