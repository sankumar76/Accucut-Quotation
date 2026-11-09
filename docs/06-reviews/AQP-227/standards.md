# Review Report — AQP-227 (STORY-10.17) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-227-three-shards` (3695f90…fe520d2), PR #124 |
| Commit reviewed | fe520d2 (two commits: bd3d673, fe520d2) |
| Date | 2026-11-08 |
| **Verdict** | **REQUEST CHANGES** (one Major, a comment that the developer's own measurement contradicts; no Blocker or Critical) |

## Summary

The change is small and correct in shape: `matrix.shard` goes to `[1, 2, 3]` at one place, the AC-1 test pins exactly that list,
and one named-constant balance test is added. Workflow hygiene is intact: permissions, SHA pins, job names, the fan-in job and
branch protection are all as they were, and no repository setting is changed. The one Major is STD-01: the comment above the new
balance test says it fails when `fullyParallel` is switched off, and the developer measured in the same PR that it does not
(163 / 156 / 148, 4.9 %). A guard that is documented as covering a case it does not cover gives false assurance. The Gitleaks
note (STD-04) is compliant with the purpose of DL-108 and not with its letter; I rate it Minor and ask master to settle the
wording. The rest are Minor and Info and cost a few lines.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| Info | 3 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff scope | `git fetch origin pull/124/head`, `git diff --stat master...pr-124` | 3 files, +30 / -10: `.github/workflows/ci.yml`, `tests/unit/ci-workflow.test.ts`, `tests/unit/e2e-shards.test.ts`. No `src/**`, no dependency, no lockfile, no `.gitleaks*`, no `playwright.config.ts`, no repository-settings file |
| Lint (changed test files) | `npx eslint --stdin --stdin-filename tests/unit/<file>` from the main folder (its config and `node_modules`), PR-head text on stdin | `e2e-shards.test.ts` exit 0; `ci-workflow.test.ts` exit 0 |
| Lint, type-check (whole repo) | not run by me: the review worktree has no `node_modules`, and I may not install | CI `Stages 1 to 11b` is `success` on fe520d2 (check run 128837059325); that job runs stage 4 `npx eslint .` and stage 5 `npx tsc --noEmit`. Developer reports eslint exit 0 and tsc clean |
| Format check | none exists: `package.json` has no prettier script or dependency and the head has no `.prettierrc` | n/a |
| Secret scan | `gitleaks` is not installed on this machine, so I could not repeat it | Gap, see STD-04. I read all 30 added lines of the diff: comments, a test, a constant, one matrix value; no credential-like text. CI stage 2 (`gitleaks git`, full history, baseline) is inside the green `Stages 1 to 11b` job |
| Baseline file list | `git show fe520d2:.gitleaks-baseline.json`, printing only `File` and `RuleID` | 7 entries: `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` ×3, `docs/01-discovery/requirements-catalog.md` ×3, `README.md` ×1, all `generic-api-key`. The developer's two whole-tree findings are in the first two files |
| Branch protection (read-only GET) | `gh api repos/sankumar76/Accucut-Quotation/branches/master/protection` | `contexts: ["Stages 1 to 11"]`, `strict: true`, `enforce_admins: true`; same as the developer's read-back |
| Stale "two shards" wording | `git grep -i -E "two shards\|of 2\b\|both shards\|\[1, 2\]"` on fe520d2 in `.github scripts tests README.md playwright.config.ts package.json` | No stale wording in the workflow or the README. `tests/unit/ci-feedback-time-sharded.test.ts:14` builds fixture job names `(shard ${index} of 2)`; that file is correctly untouched (it tests the measure code, not the live config) |
| File sizes | `wc -l` | `ci-workflow.test.ts` 387 → 386; `e2e-shards.test.ts` 79 → 97; `ci.yml` 418 → 421 |

### Workflow hygiene

| Item | Result | Evidence |
|------|--------|----------|
| Permissions | Pass | Top level `permissions: contents: read` (ci.yml:36-37) unchanged; the fan-in job has `permissions: {}` (ci.yml:402); `e2e` inherits read-only; both checkouts use `persist-credentials: false`; trigger is `pull_request` and `push` to master, never `pull_request_target`. The diff adds no scope |
| Matrix pinned to exactly `[1, 2, 3]` | Pass | ci.yml:254 `shard: [1, 2, 3]`; `ci-workflow.test.ts:184` `expect(shards).toEqual([1, 2, 3])`; `fail-fast: false` kept (ci.yml:252); `--shard` and `SHARD_TOTAL` still read `strategy.job-total` (ci.yml:384, 388); the two "no literal N" assertions stay (186-187) |
| Naming | Pass | Shard name template unchanged (ci.yml:248); the PR's check runs read `Stage 12: E2E (shard 1 of 3)` to `(shard 3 of 3)`; the fan-in is still `Stages 1 to 11` (ci.yml:398) |
| Fan-in stays success-only with `if: always()` | Pass | ci.yml:397-421 is not in the diff; `needs: [verify, e2e]` is the only `needs` in the file; `if: ${{ always() }}`; each result must be exactly `success`; `e2e` is one needed job whatever N is |
| Actions | Pass | All `uses:` still pinned to commit SHAs with a version comment; none added |
| Secrets | Pass | None added; the fixed bootstrap password and masked throwaway passwords are as before |
| No repository setting changed | Pass | No settings file in the diff; branch protection read back by me matches the developer's; throwaway PRs #125 and #126 are `closed`, `merged: false`; no `ci-control/*` branch in the remote branch list (listing is alphabetical, `chore/` is followed directly by `ctl/`) |
| Version control | Pass | Branch `feat/AQP-227-three-shards` (CLAUDE.md 7.3); `ci: ... [AQP-227]` and `test(ci): ... [AQP-227]`; one logical change per commit; PR title `AQP-227: ...`; labels `ai-delivery`, `ci` |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `tests/unit/e2e-shards.test.ts:83-86` | Coding Standards §8 (comments; accurate); AC-2 | The comment says a per-file split, "for example if `fullyParallel` were switched off", leaves a shard far from the mean "and this fails". The Dev Record measures the opposite: with `fullyParallel: false` the counts are 163 / 156 / 148 (largest deviation 4.9 %), so the test passes. The test catches a gross imbalance only | A guard documented as covering a case it does not cover. The next person who switches `fullyParallel` off reads this comment and believes the suite would say so | Reword to what is true, see the notes. Cross-reference: AC-2 and test strategy 10.5 item 2 carry the same claim (architect) |
| STD-02 | Minor | `tests/unit/e2e-shards.test.ts:87` (and header 8-17, describe 45) | Coding Standards §6 (structure), §8 | The new test sits in `describe('AQP-208 AC-3: the shards together run every E2E test once')`, and the file header describes only the union check. Balance is a different behaviour (AQP-227 AC-2) | The describe title and the header no longer describe the file; a reader looking for the balance rule will not find it by title | Add one sentence to the header and extend the describe title, for example `... run every E2E test once, in near-equal counts`. A second describe is not needed |
| STD-03 | Minor | `tests/unit/e2e-shards.test.ts:91-95` | Coding Standards §1 (readability) | One `expect(...)` call carries the arithmetic, a 100-character template-string message and the matcher, wrapped so that `BALANCE_TOLERANCE,` sits alone on a line (line 92 is 160 columns) | Hard to read; the deviation is computed inside the assertion | Name the two values, see the notes |
| STD-04 | Minor | PR #124 description, "Quality loop evidence", "Secret scan" row | DL-098 (b), DL-108 | The scan covered the changed files of each pushed commit, not each commit's whole tree as DL-108 words it. Disclosed in the PR. The "presumably" match of the two whole-tree findings to the baseline is not confirmed, and the row gives no commit SHAs or per-commit exit codes | See the judgement below. No exposure results, but the record cannot be audited from the PR | Developer: add one line per commit (SHA, command, paths, exit code). Master: record the reading of DL-108 below |
| STD-05 | Minor | `tests/unit/ci-workflow.test.ts:182-183`; also `.github/workflows/ci.yml:237`, `tests/unit/e2e-shards.test.ts:83` | Coding Standards §8; CLAUDE.md rule 3 (traceability) | Three comments cite "test strategy 10.5, 'Three shards'". That subsection is not on `master` or on fe520d2 (`git grep "Three shards"` finds nothing in either); it exists only as an uncommitted edit (v0.25) in the main working tree | Until the docs PR lands, the code points at text that is not in the repository | Orchestrator/architect: merge the test-strategy v0.25 docs change before this PR is merged. No code change needed |
| STD-06 | Info | `.github/workflows/ci.yml:236-239` | Coding Standards §8 | The re-wrapped comment leaves line 239 short (`first; tests/unit/ci-workflow.test.ts fails on any list other than [1, 2, 3]. With`) and joins "With `fullyParallel`..." onto it, so two sentences share a line break. "since AQP-227" is history, not the reason | Cosmetic | Start a new comment line before "With `fullyParallel`"; keep the reason ("a silent return to two shards fails the AC-1 test") and drop the story history if you wish |
| STD-07 | Info | `tests/unit/ci-workflow.test.ts` (386 lines), `.github/workflows/ci.yml` (421 lines), `e2e-shards.test.ts:45-97` | Coding Standards §1 (400-line file, 40-line function) | `ci-workflow.test.ts` has 14 lines of headroom under 400. `ci.yml` is above 400 before and after (418 → 421); it is configuration with long explanatory comments, not code. The `describe` callback in `e2e-shards.test.ts` grew from 35 to 53 lines; `describe` callbacks are treated as containers here (`describe('CI workflow')` is far longer) and I found no earlier finding on one | None now | No change in this PR. The next test added to `ci-workflow.test.ts` should start a second file, for example `ci-workflow-shards.test.ts` |
| STD-08 | Info | `tests/unit/ci-workflow.test.ts:180-181` | Coding Standards §6 (diagnostics) | If the matrix is ever written as a block list or at another indent, `list` is `undefined`, `shards` becomes `[0]`, and the failure reads `expected [0] to equal [1, 2, 3]` with no cause | A confusing failure for the person who reformats the YAML | Add a message to a presence check, see the notes |

Good practice noted: the 10 % limit is a named, documented constant (`BALANCE_TOLERANCE`, §1 no magic numbers); the pin test says
why it pins and what a fourth shard needs; the commit split (workflow plus pin, then the balance test) is one logical change
each; the developer disclosed the control that was invalid (run 42513902330), the cancel limitation and the Gitleaks scope
instead of hiding them.

<details><summary>Detailed notes and code suggestions</summary>

### STD-01
**Current** (`tests/unit/e2e-shards.test.ts:83-86`)
```ts
// AQP-227 AC-2 (test strategy 10.5, "Three shards"). Playwright divides the listed tests, with `fullyParallel`, into groups of
// near-equal count, so each shard is within a test or two of the mean. A split per file (for example if `fullyParallel` were
// switched off) would leave a shard with far more or far fewer, and this fails. It counts tests, not time: the time spread
// between shards is reported in the pull request and is not a pass line.
```
**Suggested**
```ts
// AQP-227 AC-2 (test strategy 10.5, "Three shards"). Playwright divides the listed tests, with `fullyParallel`, into groups of
// near-equal count, so each shard is within a test or two of the mean. This fails on a gross imbalance (one large serial group).
// It does NOT detect `fullyParallel: false` on today's suite: a split per file gives 163 / 156 / 148 tests, 4.9 % from the mean
// (AQP-227 pull request). It counts tests, not time: the time spread between shards is reported in the pull request and is not a
// pass line.
```
The wording of AC-2 and of test strategy 10.5 ("It fails if the split ever becomes per file, for example if `fullyParallel` is
switched off") is the architect's; the developer has already asked for it to be reviewed. The code comment should be true now,
whatever the architect rules. Whether 10 % is the right line, or whether the guard should also pin `fullyParallel: true`, is
reviewer-quality's and the architect's call, not mine.

### STD-02
Header sentence to add after line 13:
```ts
 * AQP-227 AC-2 adds a balance check: each shard holds a number of width tests within 10 % of the mean over the shards.
```

### STD-03
**Current**
```ts
counts.forEach((count, index) => {
  expect(Math.abs(count - mean) / mean, `shard ${index + 1} of ${counts.length} has ${count} tests, the mean is ${mean.toFixed(1)}`).toBeLessThanOrEqual(
    BALANCE_TOLERANCE,
  );
});
```
**Suggested**
```ts
counts.forEach((count, index) => {
  const deviation = Math.abs(count - mean) / mean;
  const detail = `shard ${index + 1} of ${counts.length} has ${count} tests, the mean is ${mean.toFixed(1)}`;
  expect(deviation, detail).toBeLessThanOrEqual(BALANCE_TOLERANCE);
});
```

### STD-04 Judgement: is "scans of the changed files only" compliant with DL-108?
**Rule.** DL-098 (b): a push runs only if the local scan exits 0. DL-108: if `gitleaks git` cannot run, "either push a single
commit, or run `gitleaks dir` on each commit's tree. Otherwise do not push; report BLOCKED." The reason given: `dir` reads only the
final tree, so a secret added in one commit and removed in the next would pass locally and still be public once pushed.

**What was done.** `gitleaks git` was refused in the developer's worktree. The PR has two commits (bd3d673, fe520d2). The
developer ran `gitleaks dir` on the changed files of each commit's tree (exit 0), and also a whole-tree `dir` that reports 2
findings, both in documentation files this PR does not touch. They pushed on the first and disclosed the second.

**Assessment: compliant in substance, not in the letter. I rate it Minor.**
1. *The risk DL-108 names is closed.* A commit can add bytes only to the files it changes. Scanning those files at every commit
   catches a secret added in commit A and removed in commit B, which is exactly the case a final-tree scan misses. Untouched files
   are byte-identical to the parent commit, already public, and under CI stage 2 and the baseline.
2. *The literal reading cannot be met on this repository.* A whole-tree `dir` exits non-zero because of the 7 accepted
   documentation findings; the baseline matches by commit, so it cannot apply in `dir` mode (developer's statement; I could not
   run `gitleaks`). DL-098 (b) requires exit 0, so the literal rule would block every push until the tree is scoped, and DL-108
   itself accepted `dir` "on the changed paths" for AQP-216 (for that push only).
3. *My own checks agree.* I read the whole 30-line diff (no credential-like text). The baseline holds exactly 7 entries in three
   documentation files, and the two whole-tree findings are in two of those files (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`,
   `docs/01-discovery/requirements-catalog.md`). That confirms the match at file and rule level, not by fingerprint. CI stage 2
   (`gitleaks git`, full history with the baseline) is inside the green `Stages 1 to 11b` job on the head.
4. *Why it is not a pass without comment.* The text says "tree", and the rule's last sentence says to report BLOCKED rather than
   narrow it. The developer narrowed it on their own judgement, and DL-108 is master's rule. A green CI stage 2 after the push is,
   by DL-108's own reasoning, a confirmation and not a substitute. And the PR gives no commit SHAs, command or per-commit exit
   codes, so a reader cannot audit it.

**Asked of others.** Master: record that, in a repository with accepted baseline findings, `gitleaks dir` on the paths each commit
changes meets DL-108, and that whole-tree findings in baseline files that the push does not touch are not a failure (or else say
what is required instead). Developer: one line per commit in the PR (SHA, command, paths, exit code). No re-push is needed.

### STD-05
Nothing to change in the code. The three references stay valid once `docs/04-architecture/test-strategy.md` v0.25 is merged. The
PR can still be reviewed and QA'd; the order of merge is what matters (MERGE_POLICY: the docs PR is auto-merged after GO, the code
PR waits for a human).

### STD-08
```ts
const list = /^ {8}shard: \[([\d, ]+)\]$/m.exec(jobText('e2e'))?.[1];
expect(list, 'e2e job: matrix.shard must stay a one-line list at 8 spaces').toBeDefined();
const shards = (list ?? '').split(',').map((entry) => Number(entry.trim()));
```
</details>

## Issues for other roles

- **solution-architect:** test strategy 10.5 item 2 and AC-2 say the 10 % assertion "fails if `fullyParallel` is switched off".
  The developer measured 4.9 % on this suite, so it does not. Reword, or add a guard that does what the sentence says. Also
  architecture 9.2 still says two shards (PO note 4).
- **orchestrator:** land the test-strategy v0.25 docs change before the code PR merges (STD-05).
- **master:** the DL-108 reading (STD-04).
- **reviewer-quality:** adequacy of the balance test, and whether the pin test should also check `fullyParallel`.

## Previous Findings (re-review only)

Not applicable: round 1.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-227/standards.md` (not committed)
- Jira / GitHub updates: COMMENT review on PR #124 with inline comments STD-01, 02, 03, 05, 06, 08; label `review:standards-changes-requested`; Jira summary on AQP-227
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer — fix STD-01 and the Minors in one push; master — DL-108 reading
