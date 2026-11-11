# Review Report — #119 (tech-debt refactor, PR #235) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...tech-debt/119-shared-master-pieces` (base `ffc280b`) |
| Commit reviewed | `b2741ca` |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/235#pullrequestreview-5857625090

## Summary
This refactor preserves behaviour. Each of the four read-again effects and the five load-error blocks matches the shared `useFocusAfterRead` / `useReadAgain` and `MasterLoadError` on every point checked: the guard, the branch, the focus target, `listFailed`, the dependency list, callback identity, effect order, title, description and retry. The material code moved into `material-repository.ts` byte for byte, including the locks, the constraint mapping and the not-found mapping. No import cycle results. The main finding is in test adequacy, not correctness (QLT-01). My plants on the shared hook are caught only on the exchange-rates and treatment screens. No test on SCR-11 or the Materials tab detects a change to either branch of the shared effect, so the regression net that DL-142 (3) relies on covers those two screens less than assumed. The fix belongs in a follow-up, because this PR must keep its tests unchanged (DL-129 (5)).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| CI on the PR head | run 43002218101 (job list read) | 5 of 5 green: E2E 778, unit 2,908, full Vitest 5,271 |
| Lint (touched scope) | `npx eslint src/components/features/masters src/server/repositories src/lib/masters src/server/services/masters-service.ts tests/unit tests/security` | clean (exit 0) |
| Type-check | `npx tsc --noEmit` (local) | not a valid local run: this worktree has no generated Prisma client (`src/generated/prisma` is gitignored), so it reports only TS2307 and the implicit-any errors that follow. CI Stages 1 to 11b (tsc, lint, build) were green on b2741ca and on plants A1, A2 and B3 |
| Unit tests | `npx vitest run tests/unit` (local) | 144 of 150 files pass. The 6 that fail are environment-only: no generated Prisma client, no local database, `global-setup-wiring` environment, `playwright-system-deps` hook timeout. CI is the reference (DL-057) |
| Test-file diff (G12) | `git diff -U0 ffc280b b2741ca -- tests` | 13 assertion lines removed and 13 added, each an identifier rename. No `it`/`test` was added or removed. The security files change only in order and classification |
| Import graph | read of every import in the new and moved modules | no cycle on the server or the client side |
| Plants | 5 control PRs from b2741ca (below) | 4 red and 1 probe green, as predicted |

## Plants (DL-142 (3), DL-091)
Each plant is a control PR from `b2741ca`, with its diff printed in the PR body. All were closed unmerged. CI runs on the merge with the current `master` (`b3403e3`), so the Vitest total is 5,277.

| Plant | Diff | PR, run | Result | Caught by |
|---|---|---|---|---|
| **A1** shared effect: on a failed read, focus the opener without `listFailed` on every screen (the DEF-020 class) | `use-read-again.ts:41` `else if (whenFailed) focusOpener(opener.current, true);` → `else focusOpener(opener.current);` | #239, 43005409673 | **red, 9** | `exchange-rates.spec.ts:383` and `treatments-focus.spec.ts:181,197`, at three widths each. **`process-master.spec.ts:396`, `aqp-122-qa.spec.ts:327` and every `aqp-234-qa.spec.ts` G7-5 case for SCR-11 and SCR-13 ran and passed** |
| **A2** shared effect: after a successful read, focus goes to the heading and not the opener (the focus target) | `use-read-again.ts:40` `focusOpener(opener.current)` → `focusOpener(null)` | #240, 43005425768 | **red, 9** | `exchange-rates.spec.ts:171,370,383` at three widths each. **The focus-return tests for Process, Material and Treatment passed** |
| **B1** material split: `updateMaterial` loses its constraint mapping | `material-repository.ts:177` drop `enforcingConstraints(…)` | #241, 43005446106 | **red, 3** | `materials.test.ts` "turns a repeated name … into MasterConstraintError"; `materials.test.ts` "refuses a rename to another material's name" (500, not 422); `aqp-122-materials-rules.test.ts` AC-2 "an edit onto another material's name" |
| **B2** material split: both locks dropped | `material-repository.ts:136` drop `FOR UPDATE`; `:170` `LOCK TABLE …` → `SELECT 1` | #242, 43005457649 | **red, 2** | `materials.test.ts` "two changes to one material wait for each other"; `aqp-122-materials-audit.test.ts` AC-5 "two edits of one material at once … in a chain" |
| **B3** (probe) row lock only | `material-repository.ts:136` drop `FOR UPDATE` | #243, 43005479763 | green, 5 of 5 (as predicted) | none. The self-conflicting `SHARE ROW EXCLUSIVE` table lock, always taken first, masks it. Same as AQP-130 #213 and #214 (DL-144 (1)) |

The permission system refused deletion of branches `control/119-qlt-plant-{a1-failed-read-focus,a2-focus-target,b1-constraint-map,b2-no-locks,b3-no-row-lock}`, both remote and local. They are left for the orchestrator or a human to delete.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `src/components/features/masters/use-read-again.ts:40-41` | DL-142 (3); DEF-020; DEF-024 to DEF-026 focus class; test adequacy | No test on SCR-11 or Materials pins either branch of the shared effect, and none on Treatments pins the ready branch (plants A1 and A2 stayed green there) | A later change to the one shared hook can break DEF-020 or the return of focus to Edit on Process or Materials (and on Customers, once AQP-142 uses it) with CI green. The people affected are keyboard and screen-reader users when the re-read settles after the dialog has closed, as on a slow network | Follow-up, not this PR: one slow-read E2E per dialog screen at three widths. Hold the list GET after a save until the dialog is gone, then assert focus on Edit for a read that succeeds and on the error title for one that fails. A1 and A2 are the controls |
| QLT-02 | Minor | PR body ("Closes #119"); `use-material-master.ts:35-50` vs `use-process-master.ts:35-50`; `process-screen.tsx:88` | Traceability (CLAUDE.md §6.3) | Three items of #119's original proposal are neither done nor named as out of scope: `useMasterList`, the first-open dialog-loader wiring, and Process using `MasterSearchBox` | Merging closes the only record of them, and AQP-142 would make the third copy of the list hook | `Refs #119`, or one line under "Decisions" naming them as out of scope per DL-142 (3) with a follow-up issue. Master decides before AQP-142 G5. This agrees with STD-05 |
| QLT-03 | Info | `src/server/repositories/master-constraints.ts:38` | master's open decision 1 | Recommend keeping the third file. It breaks the cycle, Process does not depend on the Material file, the code moved verbatim, and the mapping is guarded (B1 red, 3) | `enforcingConstraints` gains `export`. That is acceptable: it is repository-internal, and the Engineer import rule blocks it | none |
| QLT-04 | Info | `src/server/repositories/material-repository.ts:136` | PRF-01 lock order; AQP-122 AC-5 | The locks, `withDatabaseErrors(enforcingConstraints(…))` and `isRecordNotFound` are identical after the split, and transactions and audit stay in the service. B2 is red. B3 (row lock alone) is green because the table lock always comes first | The row lock is defence in depth that no test isolates. This is pre-existing and unchanged | none in this PR. Noted for the architect |
| QLT-05 | Info | `src/components/features/masters/use-exchange-rates.ts:67` | Dev Record decision 3 | The dependency list went from `[status]` to `[status, row, SAVE_BUTTON, true]`, which is harmless: `read(true)` is only reached after `loading`, and `row` and `status` settle in one batch. `SAVE_BUTTON` is a module constant, `askForFocus` is stable, and the effect keeps its place | none | none (good practice) |
| QLT-06 | Info | `tests/security/engineer-import-rule.test.ts:56-58` | G12 review rule (DL-114) | The test changes are renames and order only, and the two new files are classed as `blocked`, not exempted | none | none. The stale `FUTURE_IMPORTS` note goes to reviewer-standards (STD-06) |

<details><summary>Detailed notes & code suggestions</summary>

### Hook equivalence, one copy at a time
| Copy (ffc280b) | Old guard / body | Old dependencies | New call | Same? |
|---|---|---|---|---|
| `use-process-master.ts` local `useReadAgain` | `status==='loading' \|\| !wants` return; `ready` → `focusOpener(opener.current)` | effect `[status, items, opener]`; callback `[refresh]` | `useReadAgain({status, result: items, opener: dialogs.opener, refresh})`; whenFailed false | yes. The callback dependencies add `askForFocus`, which is stable (`useCallback(…, [])`) |
| `use-material-master.ts` local `useReadAgain` | same | same | same | yes |
| `use-treatments.ts` inline effect | same; `wantsFocus` set inside `read` before the `newest` guard | `[status, items, opener]`; `read` `[]` | `askForFocus(returnFocus)` at the same point; `read` `[askForFocus]` | yes. The effect is still after `useAfterDelay` and before `useTreatments`' mount effect |
| `use-exchange-rates.ts` inline effect | `focusOpener(SAVE_BUTTON, status === 'error')` for ready and error | `[status]` | `whenFailed: true` → ready `focusOpener(op)` (default `false`), error `focusOpener(op, true)` | yes. The added dependencies are harmless (QLT-05) |

### QLT-01: suggested follow-up test (sketch)
```ts
let release!: () => void;
const gate = new Promise<void>((resolve) => (release = resolve));
await page.route('**/api/v1/materials', async (route) => {
  if (route.request().method() === 'GET') await gate;
  return route.fallback();
});
// open Edit, change a field, Save
await expect(page.getByRole('dialog')).toHaveCount(0);
release();
await expect(rowOf(page, name).getByRole('button', { name: `Edit ${name}` })).toBeFocused({ timeout: 3000 });
// failing variant: fulfil the held GET with 503 and expect the error title focused
```
The controls are the A1 and A2 diffs above: both must turn the new tests red on SCR-11 and Materials. The repo has no React Testing Library, so a `renderHook` unit test would need a new dev dependency. The E2E route needs none.
</details>

## Reviewer-specific tables
**Conformance with the #119 items** (a tech-debt PR has no ACs, so these items stand in for them)

| Item | Implemented in | Tested by | Result |
|---|---|---|---|
| Neutral names (AQP-122 STD-04, AQP-123 STD-04, AQP-130 STD-03) | `src/lib/masters/master-rules.ts`, `master-texts.ts`, `master-opener.ts` (git mv) | existing unit tests (identifiers renamed only), tsc, E2E 778 | Met |
| Shared load-error block (5 copies) | `master-load-error.tsx` | load-error E2E tests on the four screens and the lazy slot | Met |
| Shared read-again-then-focus effect (4 copies) | `use-read-again.ts` | exchange rates: both branches (A2, #236); treatments: failed branch (A1, #237); process and material: neither (QLT-01) | Met; regression net partial |
| Material-repository split, dropped exports (STD-09, DL-129 (5)) | `material-repository.ts`, `master-constraints.ts` | B1 red 3, B2 red 2 | Met |
| `isRecordNotFound` unified (STD-02) | `database-errors.ts` | equivalence by reading; `materials.test.ts` "answers null for a change to a material that is not there" | Met |
| STD-17, STD-18 (DL-144) | treatments files, `role-matrix.test.ts`, `treatments-lib.test.ts` | n/a (order and naming) | Met |

## Issues for other roles
- **master:** route QLT-01, a follow-up `tech-debt` issue for slow-read focus tests on SCR-11 and Materials, due before AQP-142's G6 (Customers will be the fifth user of the hook). Decide QLT-02 together with STD-05. Decide on `master-constraints.ts` (QLT-03: keep it).
- **orchestrator or a human:** delete the five `control/119-qlt-plant-*` branches. The permission system refused the deletion.
- **solution-architect:** QLT-04 (the row lock is not isolated by any test) for the PRF-01 lock notes, if wanted.
