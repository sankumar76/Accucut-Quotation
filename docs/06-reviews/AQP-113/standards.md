# Review Report — AQP-113 (STORY-02.01 Process master) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `origin/master...origin/feat/AQP-113-process-master` (PR #107; branch is behind master by the docs-only commit 86ffb16, no conflict) |
| Commit reviewed | 62267afd7979ba65d1159be0d644060bee748ed8 |
| Date | 2026-11-06 |
| **Verdict** | **REQUEST CHANGES** (one Major, STD-01; everything else is Minor or Info) |

## Summary
The change follows the rule-book closely where it matters most: rates are carried as decimal text and never as a JavaScript number, every body, parameter and answer is a strict zod object, the role check runs before any lookup, each change and its audit entry share one transaction, the database backs the name and sign rules, no `any`, no assertion casts, no `console`, no new dependency, and a repository-wide secret scan is recorded. The one item that should be fixed before merge is the size of `ProcessScreen` (192 lines against the 40-line limit of §1, with no inline justification). The remaining findings are cheap consistency points (names, a duplicated currency symbol, import order, example values in comments that should follow the `n.37` pattern, the place of two error codes). Several architecture and standards documents need small updates; those are listed as Info for their owners.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | CI stage 4, `eslint .` (`npm run lint`) | Green for head 62267af: check run "Stages 1 to 11b" success (run 42316869370). Not re-run locally, see Tooling gaps |
| Type-check | CI stage 5, `tsc --noEmit` | Green, same job |
| Format-check | none configured (no Prettier or EditorConfig in the repo; Dev Record says the same) | n/a. For information: 8 added lines in `src/` are longer than 150 characters (longest 175); no `max-len` rule exists, so this is not a violation |
| Build, tests, coverage, JS budget, drift check | CI stages 9 to 11b | Green; E2E shards 1 and 2 green |
| Secret scan | Gitleaks per Dev Record; CI stage 2 | No leaks reported. My own scan of the added lines found no secret, token, e-mail address or non-local URL |
| Debug and suppression markers | search of added lines for `console.`, `TODO`, `FIXME`, `debugger`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any` | None in code. One `as unknown` in an integration test (`process-items.test.ts`, narrowing a rejection reason), accepted; `as const` only in `src/` |
| Casts and non-null assertions in `src/` | search of added lines | None (§10 TypeScript) |
| Column letters in `src/` | search of added lines for two-letter literals | None. Letters are derived by `fieldLetter` (§10); literals appear only in tests |
| Dependencies | `package.json` and lockfile not in the diff | No new dependency (§5) |
| Commits | `git log origin/master..origin/feat/AQP-113-process-master` | 10 commits, all Conventional Commits with `[AQP-113]`; branch name `feat/AQP-113-process-master` correct |
| File size | line counts at the head | All files within 400 lines (largest: `process-items.test.ts` 316, `process-master.spec.ts` 270, `process-screen.tsx` 265) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `src/components/features/masters/process-screen.tsx:74-265` | Coding Standards §1 (functions ≤ 40 lines, justify exceptions inline) | `ProcessScreen` is one function of 192 lines holding 13 state and ref hooks, two effects and seven inner functions (`openDialog`, `onRowAction`, `onCloseAutoFocus`, `refresh`, `onSaved`, `clearFilters`, `results`). No inline justification. | Hard to read and to change safely; the focus-return and first-open logic cannot be tested apart from the markup. Tooling does not catch it (no `max-lines-per-function` rule), so only review can. | Move state and handlers into a hook (for example `useProcessMaster(initialItems)` in `process-state.ts`) and the card body (`results()`) into a `ProcessResults` component; the screen then only lays out. If master prefers to defer: add the one-line justification §1 asks for and open a `tech-debt` issue. `AuditScreen` on master (`audit-screen.tsx:57-206`, 150 lines) is the same pattern, so a joint follow-up is reasonable. |
| STD-02 | Minor | `src/components/features/masters/process-form-dialog.tsx:99-212`; `src/components/features/masters/process-list.tsx:73-124` | Coding Standards §1 | `ProcessForm` is 114 lines and `ProcessList` 52 lines. | Same as STD-01, smaller scale. | Split `ProcessForm` into `useProcessForm` (values, errors, submit) and the markup; move the table and the card list in `ProcessList` into `ProcessTable` and `ProcessCards`. Can go with STD-01. |
| STD-03 | Minor | `src/server/services/masters-service.ts:135-170` | Coding Standards §1 (cyclomatic complexity ≤ 10) | The transaction callback of `updateProcessItem` has complexity 11: three `&&`-plus-ternary pairs that compute which fields changed, four `if`s, and the name check. | Over the limit by one, and the "what changed" rule is buried in the transaction, so it cannot be unit-tested alone. | Extract `changesFrom(before, changes): ProcessItemChanges` (pure, same file or `lib/masters`) and call it: `const next = changesFrom(before, changes);`. The callback drops to about 6. (`createMastersService`, lines 87-191, is 105 lines but is a factory of four methods that are each 36 lines or less; acceptable.) |
| STD-04 | Minor | `src/lib/masters/process-items-client.ts:68`; `src/components/features/masters/process-screen.tsx:69`, `:89`; `src/components/features/masters/process-form-dialog.tsx:109` | Coding Standards §2 (names reveal intent; functions are verbs; constants `UPPER_SNAKE_CASE`, types `PascalCase`, per architecture §10) | `DONE` is a function but is spelled as a constant (`const DONE = (): true => true`). `matching()` is not a verb. `first` names the first-open loader (`first.pending`, `first.shown`, `first.Overlay`), which says nothing about it. `set` (curried field setter) is too general. | Misleading at the call site; `first.pending` reads like "the first item is pending". | `const readNothing = (): true => true;` (or `markDone`); `filterByName(...)`; `const dialogsLoader = useFirstOpen(...)`; `const setField = ...`. |
| STD-05 | Minor | `src/components/features/masters/process-form-dialog.tsx:55` and `:192`; `src/lib/masters/process-items.ts:22-26` | Coding Standards §1 (DRY, one fact in one place) | The rupee sign is declared twice (`RUPEE` in both files), and the form repeats the rule "a `%` rate shows `%`, any other shows the rupee sign" that `unitLabel` already holds. | If the symbol or the rule changes, the two copies drift. | Export one helper from `process-items.ts`, for example `valueSymbol(unit: string): string` (returns `%` or `₹`), and use it in the form and in `unitLabel`. |
| STD-06 | Minor | `src/components/features/masters/process-screen.tsx:7-8` and `:16-17`; `src/components/features/masters/process-delete-dialogs.tsx:6-7` | Coding Standards §1 (readability); consistency with the other screens | Imports are out of the order used elsewhere (shared, then `ui`, then `lib`, each alphabetical): `@/components/ui/label` sits between two `shared` imports, `@/lib/ui/reveal` comes before `@/lib/masters/...`, and `Notice` comes before `ColumnTag`. | Noise in later diffs; no lint rule keeps it. | Reorder: `shared/column-tag` before `shared/notice`; `ui/label` with the other `ui` imports; `@/lib/masters/...` before `@/lib/ui/reveal`. |
| STD-07 | Minor | `src/server/services/audit-events.ts:78`; `src/server/repositories/master-repository.ts:11`, `:28`, `:92`; `src/lib/masters/process-items-client.ts:19` | Coding Standards §5 and `CLAUDE.md` §6 rule 7 (no real data); ADR-014 (invented values follow the `n.37` pattern) | The doc comments give example values for rates, and some of them are not in the invented `n.37` pattern while one sits next to a real seed rate name (`audit-events.ts:78`). I did not compare them with the source workbook (not permitted), and I am not saying they are real. | In a public repository a reader cannot tell an example from a real rate. If any one is real, this becomes a Blocker. | The author confirms in the PR that none is real, and changes the examples to the pattern used in the tests (`1.37`, `21.37`, `0.37`). Same for the formatting examples in the `trimDecimalText` comment. |
| STD-08 | Minor | `src/server/services/masters-service.ts:35-36` | Coding Standards §4 and §10 (use the project's error types; typed errors in one place) | `NAME_TAKEN_CODE` and `NAME_REFUSED_CODE` are exported from the service, while the third code of this story, `PROCESS_ITEM_IN_USE_CODE`, is in `src/lib/errors.ts:84`. Tests import two of them from the service. | Three codes of one feature in two places; a client cannot import the service's (server-only) module. | Move both into `src/lib/errors.ts` next to `PROCESS_ITEM_IN_USE_CODE` and import them in the service and tests. |
| STD-09 | Info | `prisma/migrations/20261107090000_process_items/` | Coding Standards §10 SQL (Prisma Migrate) | The folder is stamped 2026-11-07 09:00:00, a day after it was written (first commit 2026-11-06 13:22 -05:00). Prisma applies by name, so a migration created tomorrow before 09:00 on another branch would sort before this one. | Low. Order is still correct today. | If cheap, rename the folder to the real creation time before merge (nothing outside CI has applied it). Not needed otherwise. |
| STD-10 | Info | `tests/e2e/process-master.spec.ts:20-21` | Coding Standards §8 (comments explain why) | The header says the three tests "are proposed for the one-width tag in the hand-off of AQP-113 and are NOT tagged here". It describes a pending decision, not the code. | Goes stale as soon as the architect rules. | Replace with a one-line pointer to test-strategy §10.5 once the ruling is written, or delete it. |
| STD-11 | Info | `src/lib/masters/process-items.ts:16`; `src/lib/api-client.ts:34`; `src/server/repositories/master-repository.ts:120` | Coding Standards §8 (public functions have doc comments) | `isProcessUnit`, `isRecord` and `createMasterRepository` have no doc comment. The rest of the new public surface is documented, which is good. | Small. | One line each. |
| STD-12 | Info | architecture §10 (documents) | Architecture §10 "Layering rules", §9.2 | Three places where the document no longer matches the code, none caused by this PR alone: (1) `src/lib` is described as "Pure code: no I/O", but `lib/api-client.ts`, `lib/masters/process-items-client.ts` (and `audit-client.ts`, `users-client.ts` before them) call `fetch`; (2) the raw-SQL row lists `FOR UPDATE`, the throttle upsert and `SKIP LOCKED`, not `LOCK TABLE ... SHARE ROW EXCLUSIVE` (`master-repository.ts:131`), which fits its rule "where Prisma has no API"; (3) the CI stage list has no line for the new "configuration version 1" step (`ci.yml:195`, `:327`). | Documents mislead the next story. | Owner solution-architect: amend (1) to say that browser-side API clients live in `lib` and import nothing server-side, add `LOCK TABLE` to (2), add the step to §9.2 and test-strategy §10. No code change. |
| STD-13 | Info | `docs/standards/coding-standards.md:95` | Coding Standards §10 SQL | The last bullet stops mid-sentence: "Cost, rate and formula fields must never be". The rule cannot be read as written. I applied it as "never sent to an Engineer", as architecture §5.3 says. | A reviewer or developer cannot cite it. | Owner master: complete the sentence. |
| STD-14 | Info | PR #107 (version control) | Coding Standards §9 (one logical change per commit; no unrelated changes) | Branch is behind master (86ffb16, docs only). Two small items go beyond the story: the move of `use-after-delay.ts` to `components/shared` (reuse, one import changed) and two ordering fixes in `audit-database.test.ts` (CI failed on them twice). Both are named in the Dev Record (decisions 9 and 10) with their reasons. | None; accepted. | Update the branch from master before the merge. No change to the scope. |

<details><summary>Detailed notes and code suggestions</summary>

### STD-01 / STD-02
Sketch of the split (names are suggestions):
```ts
// process-state.ts
export function useProcessMaster(initialItems: ReadonlyArray<ProcessItemRow>) {
  // items, status, query, open, target, formItem, blockedBy, saved, pressed + the refs
  // returns: { view, shown, actions: { openDialog, onRowAction, onSaved, refresh, clearFilters, onCloseAutoFocus } }
}
// process-screen.tsx
export function ProcessScreen({ initialItems }: ProcessScreenProps) {
  const state = useProcessMaster(initialItems);
  return (<> <PageHeader .../> <ProcessResults {...state.view} /> <Dialogs .../> </>);
}
```

### STD-03
```ts
// Current (masters-service.ts:143-151): three conditional spreads and an emptiness test inside the transaction
// Suggested
function changesFrom(before: ProcessItemRecord, changes: ProcessItemChanges): ProcessItemChanges {
  const defaultValue = changes.defaultValue === undefined ? undefined : normaliseDefaultValue(changes.defaultValue);
  return {
    ...(changes.name !== undefined && changes.name !== before.name ? { name: changes.name } : {}),
    ...(changes.unit !== undefined && changes.unit !== before.unit ? { unit: changes.unit } : {}),
    ...(defaultValue !== undefined && defaultValue !== before.defaultValue ? { defaultValue } : {}),
  };
}
```
This also removes the double `normaliseDefaultValue` call.

### STD-05
```ts
// process-items.ts
const RUPEE = '₹';
export const valueSymbol = (unit: string): string => (unit === PERCENT_UNIT ? PERCENT_UNIT : RUPEE);
export const unitLabel = (unit: string): string => (unit === PERCENT_UNIT ? unit : `${valueSymbol(unit)} ${unit}`);
// process-form-dialog.tsx:192
unit={valueSymbol(values.unit)}
```

### Positive practice worth keeping (Info)
- Decimal text end to end (`DEFAULT_VALUE_PATTERN`, `trimDecimalText`, `Decimal(18,4)`); no floating point in `src/`.
- Strict zod schemas on every body, parameter and answer; the 409 problem body is projected field by field (`problem.ts`), so nothing extra can leak.
- Audit entry written with the same `tx`; `objectType` accepted only for the generic master events and checked against an allow-list pattern (`audit-service.ts:107-113`).
- The database enforces what the code checks (`uq_process_items_name_lower`, the two CHECKs, no `TRUNCATE`), and a test reads the migration against `seed-ids.ts`.
- Test values follow `n.37`, and the canary values are invented and distinctive.
- README states the first-use duty and a unit test pins the sentence.
- `follow-up` issues #108 and #109 are opened for the two things left out.
</details>

## Developer questions that touch standards (Jira comment 11134)
| Question | Standards answer |
|----------|------------------|
| Interim confidential-canary test (`tests/security/process-master-confidential.test.ts`, `tests/support/process-master-canary.ts`) | Acceptable for G6 as an interim check. File places fit the source tree (`tests/security`, `tests/support`), values are invented, and the Dev Record states AC-6 is interim. Conditions: keep `process-master-canary.ts` as the single definition; put a comment on AQP-57 so story 01.03 imports it instead of copying; do not call AC-6 fully met until 01.03 runs the full scan. The ruling on AC-6 belongs to the architect and product-owner. |
| `master.created` / `master.edited` / `master.deleted` with `objectType: 'process_item'` | Conforms to architecture §8 (lines 1010-1012: `master.edited` confirmed, a masters story may add `master.created` and `master.deleted`, and `object_type` names the master) and to the naming rules (lower-case dotted event, lower snake-case type). Recommend the story's AC text (`master.process_item.*`) be corrected to match the code, not the other way round. Architect to confirm. |
| CI change running `scripts/ensure-seed-version.ts` | Acceptable. It is the same command the `migrate` one-shot and the README run, with the `react-server` condition architecture §10 requires; it runs after the migrations against a throwaway database; it loads structure and no master data (ADR-014); both steps carry a comment saying why. Documentation of the new step is STD-12. |
| Three proposed `@one-width` tests | No standards objection; the ruling is the architect's. Against the §10.5 definition and the earlier rulings they fit: (a) "changes the name and the default value…" is a server rule plus a client rule with the same result at every width ("no request is sent"), as for the AQP-65 rulings; (b) "adds a rate… refuses… letter case or column letter" asserts server rules and message text, and its `:visible` count (`toHaveCount(1)`) has a subject the representation does not change, with the representations covered at three widths by the list and 44 px tests (the AQP-74 condition); (c) "filters by name… Clear filters" matches `audit.spec.ts` "the empty kind with Clear filters" and moves focus to one named element, the same at every width. Procedure: write the row in test-strategy §10.5 first, then tag, then change `one-width-tag.test.ts` (47 to 50 tests, nine to ten files, titles copied exactly) in the same change. This PR correctly does not tag them. |

## Reviewer-specific tables
Not used for the standards review.

## Previous Findings (re-review only)
Not applicable (round 1).

## Issues for other roles
- solution-architect: STD-12 (architecture §10, §9.2, test-strategy §10); rulings on the event names and the `@one-width` list.
- master: STD-13 (truncated standards bullet).
- product-owner: AC text `master.process_item.*` against the ruling.
- reviewer-quality (cross-reference only): `deleteProcessItem` reads the configuration before it opens the transaction (`masters-service.ts:172-175`); whether a formula can start using a rate between the read and the delete is a design question for that lens.

## Tooling gaps
I did not re-run lint or type-check locally. The main working folder is on a different commit (`feat/AQP-28-tokens-and-shell`), and type-checking this head needs a regenerated Prisma client, which would change `node_modules`; the review is read-only. Evidence for both gates is the CI check run for exactly this head SHA (success). No Semgrep, CodeQL or Snyk configuration was found in the repository; Gitleaks results are taken from the Dev Record and CI.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-113/standards.md` (not committed)
- Jira / GitHub updates: PR #107 COMMENT review with inline comments; summary comment on AQP-113 (see the final message for links)
- Open questions: none
- Risks raised: STD-07 would become a Blocker if any example value turns out to be a real rate
- Recommended next agent: developer, to fix STD-01 (and ideally STD-02 to STD-08) and update the branch from master; then reviewer-standards for the re-review of the new diff only

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 |
| Diff reviewed | `62267af..66ae511` (the developer's fix push, 4 commits: 7bec601, bc09fac, f2e9fe1, 66ae511). The merge of master on top (a4d4d57) was checked and changes only files under `docs/` |
| Date | 2026-11-06 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical, Major or Minor open; three Info points) |

## Summary
Every finding I raised for which the developer owns the fix is resolved: STD-01 to STD-11 and STD-14. The screen, form and list are split into small units (`use-process-master.ts`, `process-results.tsx`, `RateFields`, `ProcessTable`, `ProcessCards`), the "what changed" rule is one shared pure function, the names are fixed, the error codes sit with the others, the migration folder carries the real creation time, and the example values in comments are now `n.37` values with the PR statement I asked for. The push also does a lot more than my findings (whole-set name check, 404 handling, plain-text refusal, lock order); I read all of it for standards and found nothing above Info. STD-12 and STD-13 belong to the solution-architect and master and stay open for them.

| Severity (new in round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 (STD-15 to STD-17) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Lint, type-check, tests, build, JS budget | CI stages 4, 5, 9, 11, 11b; also run locally by the developer (PR body) | Run 42326697243 on 66ae511 reported green by the coordinator and the PR body. When I looked, the run for the merge commit a4d4d57 (42327412105) was still in progress; the merge adds only `docs/` files. I did not re-run lint or type-check locally (same reason as round 1) |
| Function size | script over every top-level `function` in the changed `src` files at 66ae511 | Only two exceed 40 lines: `createMastersService` (83) and `createMasterRepository` (69). Each carries the inline justification §1 asks for (`masters-service.ts:100`, `master-repository.ts:121`). `ProcessScreen`, `ProcessForm`, `useProcessForm` and `ProcessList` are all 40 lines or fewer |
| Complexity | reading `changeInTransaction`, `addInTransaction`, `removeInTransaction` | Callbacks are now about 5 decision points each (limit 10) |
| File size | line counts | Largest changed file is `tests/e2e/process-master.spec.ts` at 358 lines (limit 400) |
| Debug and suppression markers | search of the new diff | None. No `console`, `any`, `@ts-*`, `eslint-disable`, casts or non-null assertions in `src` |
| Layering | `src/lib/masters/process-form.ts` and `changesFrom` | Pure, no I/O, no framework import; the server and the form share `changesFrom`. Good |
| New dependency | `package.json` not in the diff | None |
| Commits | `git log 62267af..66ae511` | Four Conventional Commits, each with `[AQP-113]`; each is one logical change |
| Merge a4d4d57 | `git diff --name-only 66ae511..a4d4d57` filtered to non-docs | Empty: docs only |

## Previous Findings (re-review)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Major | **Fixed** | `ProcessScreen` is about 30 lines; state and handlers are in `useProcessMaster` (small hooks and helpers of 10 to 25 lines each), the card body is `ProcessResults`. The Dev Record's AST count agrees with my own count |
| STD-02 | Minor | **Fixed** | `ProcessForm` is split into `useProcessForm`, `useFocusFirstError`, `RateFields`; `ProcessList` into `ProcessTable` and `ProcessCards`; checks moved to pure `lib/masters/process-form.ts` |
| STD-03 | Minor | **Fixed** | `changesFrom` in `lib/masters/process-items.ts` is shared by server and form; the transaction callbacks are `addInTransaction`, `changeInTransaction`, `removeInTransaction` |
| STD-04 | Minor | **Fixed** | `readNothing`, `filterByName`, `loader`, `setField` |
| STD-05 | Minor | **Fixed** | `valueSymbol(unit)` is the one place of the rule; the form's copy of `RUPEE` is gone |
| STD-06 | Minor | **Fixed** | Imports reordered in `process-screen.tsx` and `process-delete-dialogs.tsx`; the new files follow the same order |
| STD-07 | Minor | **Fixed**, on the author's statement | No example value outside the `n.37` pattern is left in `src` (a search for the old ones returns nothing); the PR body now carries the statement that none came from a real source and that the source workbook was never opened. I cannot check that and do not need to: the values are gone. A few formatting-example values remain in tests, see STD-17 |
| STD-08 | Minor | **Fixed** | `NAME_TAKEN_CODE` and `NAME_REFUSED_CODE` are in `src/lib/errors.ts` beside `PROCESS_ITEM_IN_USE_CODE`; the service and tests import them from there |
| STD-09 | Info | **Fixed** | Folder is now `20261106182200_process_items` (the UTC time of the first commit), after `20261106090000_audit_log`; content unchanged (a pure rename); no reference to the old name remains in the repository |
| STD-10 | Info | **Fixed** | The spec header now points to test strategy §10.5 and `one-width-tag.test.ts`, and says nothing is tagged until ruled |
| STD-11 | Info | **Fixed** | `isProcessUnit`, `isRecord` and `createMasterRepository` have doc comments |
| STD-12 | Info | Open, for solution-architect | Architecture §10 and §9.2, test-strategy; not a code matter |
| STD-13 | Info | Open, for master | `coding-standards.md:95` is still cut off |
| STD-14 | Info | **Fixed** | Branch updated from master (a4d4d57); docs-only merge, no conflict |

## New findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-15 | Info | `src/components/features/masters/use-process-master.ts:105`, `:126` | Coding Standards §2 (names reveal intent) | `useOpeners` and `useOutcomes` are named like React hooks but call no hook; they only define functions. | A reader (and the hooks lint rule) treats them as hooks, so a later edit that calls one conditionally would fail for a reason that has nothing to do with state. | Rename to `openersFor(dialogs, setNotice)` and `outcomesFor(...)`, or leave as is. |
| STD-16 | Info | `src/components/features/masters/process-delete-dialogs.tsx:80`, `:160`; `process-form-dialog.tsx:164`; `process-screen.tsx:77` | Coding Standards §1 (DRY; rule of three) | The arbitrary class `[overflow-wrap:anywhere]` is typed four times. | If the wrapping rule changes, four places change. | Name it once (for example `BREAK_LONG_NAMES` in `process-texts.ts`, or a shared utility class) and use the name. |
| STD-17 | Info | `tests/unit/master-repository.test.ts:14-17`; `tests/unit/masters-service.test.ts:173`; `tests/unit/process-items-lib.test.ts:66-68`; comment at `src/server/repositories/master-repository.ts:121` | Coding Standards §6 (test data), ADR-014 | Some formatting-example values in tests are not in the `n.37` pattern; they fall under the PR statement but a reader cannot tell. Also the comment on `createMasterRepository` says each method is "under 20 lines", while `updateProcessItem` has 22. | Consistency only. | Optional: use `n.37` values in those cases and say "about 20 lines". |

## Points still open from the developer's questions
No change to round 1. The `@one-width` tests stay untagged until the architect writes the §10.5 row; this push correctly leaves them so.

## Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-113/standards.md` (Round 2 section appended; not committed)
- Jira / GitHub updates: PR #107 COMMENT review (round 2), label switched to `review:standards-approved`, Jira comment "reviewer-standards — G6 round 2"
- Open questions: none
- Risks raised: none
- Recommended next agent: master for the G6 decision across the three reviews (quality's label is still changes-requested); solution-architect for STD-12 and the `@one-width` ruling; master for STD-13
