# Review Report — AQP-276 (STORY-10.22) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-276-fourth-shard` (PR #336; base 3f22672, head 0c8b898, one commit) |
| Commit reviewed | 0c8b898376da360028b38edb8ddba53cd6edc2d5 |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The diff is exactly what the story asks for and nothing more: 3 files, 14 insertions, 14 deletions. `.github/workflows/ci.yml`, `tests/unit/ci-workflow.test.ts` and `tests/unit/ci-workflow-shards.test.ts` are the only files touched, so there is **no `src/` or runtime helper in the diff and the narrow route (DL-179 (2)) holds**. The matrix is `shard: [1, 2, 3, 4]` with `fail-fast: false` and nothing else, the "three" comments that meant shards were rewritten and the ones that mean widths were left, both pins follow, and `ci-workflow.test.ts` stays at 396 lines (no line added). One Minor finding (a test title that keeps the old story's AC ID) and three Info items; nothing blocks the merge on standards grounds.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
Read-only. The working copy is on `docs/AQP-1-records-sprint1-k`, not on the PR head, so file content was read with `git show 0c8b898:<path>` and `git diff 3f22672 0c8b898`. No CI run was started, re-run or cancelled.

| Check | Command | Result |
|-------|---------|--------|
| Lint (changed test files) | `git show 0c8b898:<file> \| npx eslint --stdin --stdin-filename <file>` for `tests/unit/ci-workflow.test.ts` and `tests/unit/ci-workflow-shards.test.ts` | Clean, no output |
| Lint, type-check, build, tests (head) | PR check runs on 0c8b898 (`get_check_runs`) | `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 4)` to `(shard 4 of 4)` and the fan-in `Stages 1 to 11` all `success` (run 43202416203). Local `tsc --noEmit` not run: it needs the head checked out, and the repo's working tree is on another branch. CI evidence used instead |
| Format-check | n/a | No Prettier config and no `prettier` entry in `package.json`; no format gate exists. The Dev Record says the same |
| Diff scope | `git diff --stat 3f22672 0c8b898` | 3 files, +14 / -14; no `src/`, `tests/e2e/`, `playwright.config.ts`, `docs/04-architecture/`, `e2e-shards.test.ts`, `one-width-tag.test.ts`, `own-width-files.test.ts` |
| Forbidden additions | `git diff 3f22672 0c8b898 \| grep PWTEST`; grep of the diff for `needs`, `job-total`, `SHARD_TOTAL`, `Stages 1 to 11`, workers | 0 `PWTEST`; no changed line touches `needs`, the job-name template, `job-total` or workers |
| File size (§1) | `git show 0c8b898:<file> \| wc -l` | `ci-workflow.test.ts` 396 (was 396), `ci-workflow-shards.test.ts` 57 |
| Remaining "three" in `ci.yml` | `grep -i three` at head | Lines 8 ("Three kinds of job"), 24 ("Third-party actions"), 120 ("the three files" of `npm ci`), 506, 511, 517 ("three widths"): none is about shards, all correctly left |
| Stale shard-count text outside docs/04 | `git grep` at head over code, scripts, `.github`, README | None. `ci-run-summary*.test.ts` `shard N of 3` strings are fixtures (story: leave) |
| Commit and PR conventions | `git log 3f22672..0c8b898`, PR #336 metadata | See "Conventions" below |
| Controls #337, #338 | `get` and `get_files` on both PRs | Closed, unmerged, draft, base `master`, label `ai-delivery`, heads `control/...`; patches hold the same 3-file change plus one invented spec; no secrets, tokens or personal data |
| Secret scanner | not configured / not run | Manual read of all three patches (#336, #337, #338): none found |

## AC-by-AC (standards reading only; AC adequacy is reviewer-quality's lane, live measures are AC-4 to AC-8 and are not yet taken)
| AC | Reading |
|----|---------|
| AC-1 | `strategy` block is `fail-fast: false` + `matrix.shard: [1, 2, 3, 4]` (ci.yml:327-330); no `include`/`exclude`/`max-parallel`; no literal N added; fan-in name and `needs` and the shard job-name template are not in the diff; comments rewritten at the header (lines 12-13) and the Stage 12 block (lines 311-313) |
| AC-2 | `ci-workflow.test.ts:191` `toEqual([1, 2, 3, 4])` and `ci-workflow-shards.test.ts:49` exact block string both follow; QLT-02 comment (shards test lines 40-42) and the pin comment (ci-workflow test lines 188-190) rewritten as the story worded them; `e2e-shards.test.ts` and `ci-fan-in.test.ts` not in the diff; 0 lines added to `ci-workflow.test.ts` |
| AC-3 | Both controls exist as `control/` PRs, closed unmerged; the NFR-009 window rule leaves them out |
| AC-6 (diff part) | No `PWTEST_*`; `tests/e2e/**`, `playwright.config.ts`, `@one-width` allow-list, `OWN_WIDTH_FILES`, `PARTLY_DESKTOP_ONLY` untouched |
| AC-9 | PR body states the hold (not before AQP-142 / #297, before AQP-81) and says AQP-142's merge commit is to be named at merge time. Correct for this stage |

## Conventions
| Item | Result |
|------|--------|
| Branch `feat/<KEY>-<slug>` (CS §9, playbook §7.3) | `feat/AQP-276-fourth-shard` OK |
| Commit: Conventional Commits with key (CS §9) | `ci(e2e): run the E2E suite in four shards [AQP-276]` OK; one logical change; body explains scope and what stayed untouched |
| PR title `<KEY>: <story title>` | `AQP-276: STORY-10.22: CI fourth shard` OK |
| PR body follows `.github/pull_request_template.md` | All sections present (What & why, AC coverage, Dev Record with baseline, files, decisions, quality loop, findings, follow-ups, DoD checklist, gates). AC-4 to AC-8 shown as "not yet taken" with the reason, which matches the orchestrator brief and DL-179 (2) for G5 scope |
| Labels | `ai-delivery`, `feature`, `ci` |
| No generated files, no secrets, no unrelated changes | OK |
| Dev Record claims I could verify | "3 files, 14 insertions, 14 deletions", "line 191" and "line 49" pins, "396 lines", controls closed/draft/`ai-delivery`/base `master`, branch protection statement (read-only, not re-read by me): all consistent with the repository |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `tests/unit/ci-workflow.test.ts:184` | Project CLAUDE.md §6 rule 3 (tests reference AC IDs); AQP-276 AC-2 | The test title still opens with `AQP-227 AC-1 (AQP-208 AC-1)`, but the `[1, 2, 3, 4]` pin it now asserts belongs to AQP-276 AC-2 (and test strategy 10.5 item 12). The comment two lines below already says "10.5 item 12" | A later reader following the title to AQP-227 AC-1 finds the three-shard pin, not the reason for four. Cheap to fix on the same line, no line added | Change the prefix to name the current owner and keep the history: `'AQP-276 AC-2 (AQP-227 AC-1, AQP-208 AC-1): the shard count is one constant, the length of the matrix, and it is exactly [1, 2, 3, 4]'`. Same line, so the 400-line limit is unaffected |
| STD-02 | Info (good practice) | `.github/workflows/ci.yml:330`; `tests/unit/ci-workflow-shards.test.ts:40-42`; `tests/unit/ci-workflow.test.ts:188-190` | Coding Standards §8 (comments explain why); AC-1, AC-2 | The one-line change is made, every comment that meant "shards" was rewritten and every comment that meant "widths" was left. The rewritten QLT-02 comment keeps its reasoning correct at four (`exclude` of shard 4 gives three jobs, `include` of shard 5 gives five). The stage 12 comment keeps the "a fifth shard needs section 10.5 first" rule that test strategy 10.5 item 12 line 802 still states | None; recorded as conformance | None needed |
| STD-03 | Info (cross-reference, architect's lane) | `docs/04-architecture/architecture.md:1169`; `docs/04-architecture/test-strategy.md:599, 677` | Coding Standards §8 (docs updated when behaviour changes); AC-8 | `architecture.md` section 9.2 still says "Stage 12 runs in **three** shard jobs ... (`matrix.shard: [1, 2, 3]`)" and test strategy 10.5's three-shard record (table row at line 677: "exactly `[1, 2, 3]`") describes the old pin. `docs/04-architecture/**` is deliberately not edited by this PR (Dev Context "Do not edit"; AC-8: the architect records the result) | After this PR merges, the architecture text and the pin row are stale until the architect's AC-8 record. Not a defect of this diff | Not for the developer. Architect: when recording AC-8, update architecture 9.2 and the 10.5 pin row to `[1, 2, 3, 4]` in the same document version |
| STD-04 | Info | origin branches `control/AQP-276-shard4-fails`, `control/AQP-276-shard4-cancelled` | Coding Standards §9 (no stale artefacts) | Both PRs are closed, but the two throwaway branches remain on origin; the Dev Record names them for the delivery lead to delete. They hold only an invented spec plus the story's own change | None for the merge. The `control/` prefix keeps them out of the NFR-009 window | Delivery lead: delete both origin branches after G7. Nothing to change in PR #336 |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
it('AQP-227 AC-1 (AQP-208 AC-1): the shard count is one constant, the length of the matrix, and it is exactly [1, 2, 3, 4]', () => {
```
**Suggested**
```ts
it('AQP-276 AC-2 (AQP-227 AC-1, AQP-208 AC-1): the shard count is one constant, the length of the matrix, and it is exactly [1, 2, 3, 4]', () => {
```
The rename changes one line and adds none (`ci-workflow.test.ts` stays at 396 of 400). The added line widths in this PR (up to 134 characters) match the files' existing style (existing maxima 154 and 130; no formatter or `max-len` rule is configured), so they are not a finding.

### Things deliberately not flagged
- `e2e-shards.test.ts:92` ("AQP-227 AC-2 ... Three shards") and the `ci-run-summary*` / `ci-feedback-time*` fixtures say three: they are historical attributions or fixture names; the story says they may be left.
- The second pin in `ci-workflow-shards.test.ts` was not named in item 12: the Dev Record flags it as a deviation for the architect to confirm, and the product-owner has already ruled it inside "anchored as before". Nothing for a standards reviewer to add.
- Direct commands (`npx ...`, no `npm run`) are used in the Dev Record, as the story's Standards bullet asks.
</details>

## Reviewer-specific tables
- **Quality:** not my lane (see reviewer-quality / the narrow route: performance and standards only).
- **Performance:** not my lane (reviewer-performance reviews the CI-path claims).

## Previous Findings (re-review only)
Round 1: none.

## Hand-off notes for the orchestrator
- Route: narrow route confirmed. No `src/` and no runtime helper in the diff, so no third reviewer is needed.
- G6 standards condition: none open at Blocker, Critical or Major.
- Merge hold stays as in the PR body (after AQP-142 / #297, before AQP-81); it is a process hold, not a standards finding.
