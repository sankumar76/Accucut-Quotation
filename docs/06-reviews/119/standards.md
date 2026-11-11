# Review Report — #119 (tech-debt: master screen pieces and material repository split) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...tech-debt/119-shared-master-pieces` (PR #235; base ffc280b, master is now b3403e3; 7 commits, 52 files, +596 / -586) |
| Commit reviewed | b2741ca6f1d3811166ec7e340901cd2b8e68c1a5 |
| Date | 2026-11-11 |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/235#pullrequestreview-5857568408 (7 inline comments, submitted as COMMENT, `REVIEW_IDENTITY = single-token`); PR label `review:standards-approved` |
| Rulings | DL-115, DL-116, DL-129 (5), DL-142 (3), DL-144 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; four Minor and five Info) |

## Summary
Every item of #119 is done, and nothing outside the list changed: 52 files, all under `src/` and `tests/`, with no dependency, lockfile, Prisma schema, migration, route handler, audit call or CI change. The refactor is behaviour-preserving as far as a standards review can show: the moved repository code is verbatim, and a diff of every added and removed string and template literal in `src/` finds no copy text appearing or disappearing. The remaining findings are small: one more copy of a status union beside the new shared hook, comments that still say "Process Master" after the rename, a boolean option name, and two test files that keep their old module names. `master-constraints.ts` as a third file is the right placement (my view for master is in "Decision 1" below).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `eslint` over `src/components/features/masters`, `src/lib/masters`, `src/server/repositories`, `src/server/services`, `src/server/views`, `src/app/(portal)/masters` and the six changed test files (run read-only from the review worktree, tooling from the parent checkout's `node_modules`) | Clean, no output |
| Type-check | CI `tsc --noEmit` in "Stages 1 to 11b", run 43002218101 | Success. Local `tsc --noEmit --incremental false` is **not a gate here**: the generated Prisma client (`src/generated/prisma`, gitignored) is not in the worktree, so it reports only TS2307 and the implicit-any errors that follow (also in unchanged files such as `exchange-rate-repository.ts:97`, `transaction.ts:60`). Nothing in the changed logic. `prisma generate` writes files, so I did not run it |
| Format-check | none configured (`CLAUDE.md` lists none) | n/a |
| CI | `pull_request_read get_check_runs` | 5 of 5 success on run 43002218101 (Stages 1 to 11, 11b, E2E shards 1 to 3) |
| Scope | `git diff --stat ffc280b...b2741ca` | 52 files, all `src/` and `tests/`; no `package.json`, lockfile, `prisma/`, `.github/`, route file, `audit-events.ts` |
| Behaviour (strings) | node script over `src.diff`: string and template literals on added vs removed code lines (comments and imports excluded) | Added only: `'use client'` x2, `'whenFailed'` (a type key), and the `NAME_TOO_LONG_MESSAGE` template now reading `MASTER_NAME_MAX_LENGTH` (same value 100, same output). Removed only: `P2025` x2 and `'code'`/`'object'` x2 (the two local `isRecordNotFound`), the `MaterialMethodName` union (now the `MaterialMethods` interface), `'ready'`/`'loading'`/`'opener'` (the removed copies of the effect) |
| Behaviour (moved code) | node script: lines of `material-repository.ts` and `master-constraints.ts` not present in the old `master-repository.ts` (comments excluded) | Only the import lines, `MaterialMethods`, `createMaterialMethods(db)` and `export` on `enforcingConstraints` are new text; the rest is verbatim |
| Old names | `grep` for `PROCESS_ITEM_NAME_MAX_LENGTH`, `DEFAULT_VALUE_*`, `normaliseDefaultValue`, `process-opener`, `useTreatmentActions`, `LoadError` in `src`, `tests`, `scripts`, `.github`, `docs` (not reviews) | None left, except `docs/03-ux/ux-spec.md:853` (`process-texts.ts`) and `docs/07-qa/AQP-234-test-report.md` (historical) |
| Dropped exports | `grep` for `filterMaterials`, `toMaterialRow`, `materialOptionSchema` in `src`, `tests` | Used only inside their own file or its module; none by a test |
| File and function size (§1) | `wc -l`; read of every new function | New files 44, 64, 28, 40, 46, 179 lines; `master-repository.ts` 362 to 162; no file near 400. `createMasterRepository` is still over 40 lines, with its justification comment kept and rewritten for the new spread |
| Test diff (G12, test-strategy §10) | full read of `git diff -- tests` | 6 files, 30 insertions, 31 deletions; five files change imports, order and identifiers only; `engineer-import-rule.test.ts` adds `master-constraints` and `material-repository` to `blocked` (no assertion removed, no exemption added) |
| Commits and branch | `git log ffc280b..b2741ca` | 7 Conventional Commits `refactor(masters): ... [#119]`, one logical change each; branch and title: see STD-08 |
| Secrets | Gitleaks in CI (green); no env or config file in the diff | No finding |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `src/components/features/masters/use-read-again.ts:13`; `use-treatments.ts:40` | Coding Standards §1 (DRY, rule of three); #119 STD-05 | `ReadStatus` is a fifth copy of `'loading' \| 'ready' \| 'error'`: `ListStatus` (`use-process-master.ts:23`), `MaterialListStatus` (`use-material-master.ts:22`), `TreatmentListStatus` (`use-treatments.ts:29`), `ExchangeRatesStatus` (`use-exchange-rates.ts:32`) stay as they were. `OpenerRef` (line 16) is written out inline as `{ readonly current: Opener \| null }` at `use-treatments.ts:40` | The PR removes copies of the read-again code but adds a shared type next to four identical ones; a state added in one place does not reach the others | Make the four existing names aliases of `ReadStatus` (importers do not change) and type `useTreatmentList(opener: OpenerRef)` |
| STD-02 | Minor | `src/lib/masters/master-rules.ts:10`; `materials.ts:10-11`, `:14-15`; `exchange-rates.ts:12` | Coding Standards §8 (comments explain why, and stay true); #119 STD-04 | Comments still send the reader to the Process Master after the rename: `materials.ts:10-11` and `exchange-rates.ts:12` say the text "follows the Process Master's default value" (now `DECIMAL_TEXT_PATTERN` in `master-rules.ts`); `materials.ts:14` says the limit is "the same as a rate's name (SCR-11)" over a separate literal `MATERIAL_TEXT_MAX_LENGTH = 100`; the JSDoc of `MASTER_NAME_MAX_LENGTH` says "a rate or a treatment" while its message is also shown for materials | The point of STD-04 is names that no longer describe their use; the number the message quotes and the number the check uses can drift for materials | Reword the three comments; `export const MATERIAL_TEXT_MAX_LENGTH = MASTER_NAME_MAX_LENGTH;` as `TREATMENT_NAME_MAX_LENGTH` does (value 100, no behaviour change) |
| STD-03 | Minor | `src/components/features/masters/use-read-again.ts:27` (used at `:34`, `:41`, `:42`, `:49`; `use-exchange-rates.ts:67`) | Coding Standards §2 (booleans read as predicates), §10 (`exactOptionalPropertyTypes`) | `whenFailed?: boolean` is not a predicate name (`whenFailed: true` reads as a time) and is typed `?: boolean` while `MasterLoadErrorProps.description?: string \| undefined` (`master-load-error.tsx:27`) allows an explicit `undefined` | Naming and typing inconsistent inside the PR's own new files | `readonly shouldFocusWhenFailed?: boolean \| undefined;` and update the five uses |
| STD-04 | Minor | `tests/unit/process-opener.test.ts:3`; `tests/unit/process-items-lib.test.ts:4-12, 40-70` | Coding Standards §6 / the repo's `<module>.test.ts` naming | The test of `master-opener.ts` is still `process-opener.test.ts`; the tests of `master-rules.ts` (`nameProblem`, `normaliseDecimalText`, `MASTER_NAME_MAX_LENGTH`) sit in `process-items-lib.test.ts` | A reader looking for the module's test by name does not find it | `git mv tests/unit/process-opener.test.ts tests/unit/master-opener.test.ts` (counts unchanged, outside G12 scope); optionally a `master-rules.test.ts`. May ride a later tech-debt PR; not held |
| STD-05 | Info | PR body "Closes #119"; issue #119 opening text | #119 scope; Coding Standards §1 | The issue's opening text also proposed a generic `useMasterList`, the Process screen using `MasterSearchBox`, and the first-open loader wiring. DL-142 (3) and DL-144 do not list them and the PR does not say they are dropped. `RUPEE` stays in `process-items.ts` and is imported from there by `exchange-rates-panel.tsx`, `material-form-dialog.tsx`, `material-texts.ts`, `exchange-rates.ts` (developer's decision 6); the Users screen keeps its own `opener.ts` and `texts.ts` | Merging closes #119 and the leftovers have no owner | Master records them as out of scope in the G6 decision, or the developer opens one `tech-debt` issue before the merge |
| STD-06 | Info | `tests/security/engineer-import-rule.test.ts:58`, `:87`, `:18` | Test-strategy §10 (G12) | G12 check passed (see Checks). `FUTURE_IMPORTS` (line 87) and the header (line 18) still call `material-repository` a file that does not exist yet. It does now and is covered by `blocked` | A duplicate case with a false label | Master rules: delete the entry in a later G12-scoped change (the assertion stays through `blocked`), or keep it. Not changed in this PR |
| STD-07 | Info | `src/server/repositories/material-repository.ts:13`; architecture §6 table row "Only `master-repository` may read `is_hidden` rows"; §4.9 | Coding Standards §3; architecture §4.9, §6 | The `isHidden: false` filter now lives in `material-repository.ts` (and `treatment-repository.ts`, as before). No architecture test for the rule exists yet (none found in `tests/`), so nothing is red, but as worded it would fail on both files | Doc and code drift | solution-architect: word the rule as "the master repositories (`master-repository` and the files it includes)" at the next architecture change |
| STD-08 | Info | branch `tech-debt/119-shared-master-pieces`; PR title `#119: ...` | Coding Standards §9; `CLAUDE.md` §7.3 | `tech-debt/` and the `#119:` title are not in the listed patterns (`feat/`, `fix/`, `docs/`; `<JIRA-KEY>:`). They follow merged PR #139 (`tech-debt/130-...`) | None | master: add `tech-debt/<issue>-<slug>` to §9 at the next edit; link the PR from AQP-142 so Jira shows it |
| STD-09 | Info | `src/server/repositories/master-constraints.ts:5` | Coding Standards §3, §8 | Good practice, and my view on decision 1: the leaf file with a header that says why it exists ("so neither imports the other"); facade re-exports in `master-repository.ts:77-82` are used by `masters-service.ts`, `fake-masters.ts` and two integration tests | None | None; see "Decision 1" |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
// use-read-again.ts
export type ReadStatus = 'loading' | 'ready' | 'error';
// use-treatments.ts
export type TreatmentListStatus = 'loading' | 'ready' | 'error';
function useTreatmentList(opener: { readonly current: Opener | null }) {
```
**Suggested**
```ts
// use-treatments.ts
import { useFocusAfterRead, type OpenerRef, type ReadStatus } from './use-read-again';
export type TreatmentListStatus = ReadStatus;
function useTreatmentList(opener: OpenerRef) {
```
The same alias in `use-process-master.ts` (`ListStatus`), `use-material-master.ts` (`MaterialListStatus`) and `use-exchange-rates.ts` (`ExchangeRatesStatus`).

### STD-03
**Current**
```ts
readonly whenFailed?: boolean;
...
const askForFocus = useFocusAfterRead({ status, result: row, opener: SAVE_BUTTON, whenFailed: true });
```
**Suggested**
```ts
readonly shouldFocusWhenFailed?: boolean | undefined;
...
const askForFocus = useFocusAfterRead({ status, result: row, opener: SAVE_BUTTON, shouldFocusWhenFailed: true });
```

### STD-02 (c)
**Suggested**
```ts
/** The longest name of any master's entry (rate, material, treatment). The formula engine states the same limit for a rate's name (`MAX_RATE_NAME_LENGTH`); a test keeps the two equal. */
export const MASTER_NAME_MAX_LENGTH = 100;
// materials.ts
/** The longest Material in Drawing and Material Considered: every master's name limit (`master-rules.ts`). */
export const MATERIAL_TEXT_MAX_LENGTH = MASTER_NAME_MAX_LENGTH;
```
</details>

## Decision 1 for master: where `MasterConstraintError` lives
Keep `master-constraints.ts` as a third file (as built). (1) It is a leaf beside `database-errors.ts`, `decimal-text.ts` and `transaction.ts`, which this folder already uses for what several repositories share. (2) Both repositories depend on it and neither on the other, so the dependency direction is clean (Coding Standards §3). (3) Folding it into `material-repository.ts` would make the Process methods in `master-repository.ts` import a Material file for an error about both. (4) Leaving it in `master-repository.ts` is the cycle the developer found. (5) The cost, 20 more generated `blocked` cases in `engineer-import-rule.test.ts` (Vitest 5,231 to 5,271), strengthens the Engineer rule and is not a standards cost; test-strategy only needs its total updated. If Customers (02.02) adds a unique-name rule, this file's union and name lists grow; `treatment-repository.ts` keeps its own `TreatmentNameTakenError`, so one home for all name errors is a later, optional decision.

## Reviewer-specific tables
Issues for other roles:
- **ux-expert:** `docs/03-ux/ux-spec.md:853` names `process-texts.ts` for `TRY_AGAIN_BODY`; it is now `master-texts.ts`.
- **solution-architect:** STD-07 (hidden-row rule wording, architecture §6 and §4.9); test-strategy Vitest total 5,231 to 5,271; the architecture source tree (line 1353) names the `repositories/` folder only, so no tree change was found.
- **reviewer-quality:** `use-read-again.ts` and `MasterLoadError` have no unit test of their own; the plants #236 to #238 are the regression. The effect's dependency list changed to `[status, result, opener, whenFailed]` (developer's decision 3). Both are quality's lane.
- **master:** STD-05 (leftovers when #119 closes), STD-06 (G12-scope list entry), STD-08 (branch pattern in §9).

## Previous Findings (re-review only)
n/a (round 1). Prior #119 items checked against the diff:

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| AQP-122 STD-04 | Minor | Fixed | `DECIMAL_TEXT_*`, `master-texts.ts`, `master-opener.ts`; see STD-02 for leftover comments |
| AQP-122 STD-09 / DL-129 (5) | Info | Fixed | `material-repository.ts`; three exports dropped |
| AQP-123 STD-02 | Minor | Fixed | both `isRecordNotFound` copies removed |
| AQP-123 STD-04, STD-05 | Minor | Fixed | neutral names; one `MasterLoadError`, one `useReadAgain` / `useFocusAfterRead` |
| AQP-130 STD-03, STD-04 | Minor | Fixed | `master-rules.ts`; shared load error and effect |
| AQP-130 STD-17, STD-18 | Info | Fixed | order slips; `treatmentActions`, `TreatmentListState`, `TreatmentDialogState` |

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS; Blocker 0, Critical 0, Major 0, Minor 4, Info 5
