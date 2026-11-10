# Review Report — AQP-130 (STORY-02.05 Treatment / Color list) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `origin/master...origin/feat/AQP-130-treatment-color-list` (PR #195; base 41848eb, 5 commits, 50 files, +3375 / -80) |
| Commit reviewed | 67febe3adda3945b67a7650447d0d2458a4e5905 |
| Date | 2026-11-10 |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/195#pullrequestreview-5848269835 (14 inline comments, submitted as COMMENT, `REVIEW_IDENTITY = single-token`); PR label `review:standards-approved` |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; eight Minor and six Info) |

## Summary
The change follows the rule-book where it matters most. The treatment methods are a new repository file on the `exchange-rate-repository.ts` shape, the service writes each change and its audit entry in one transaction with the table lock before the row lock, bodies and answers are strict zod objects, the role comes from the manifest (`ADMIN_ONLY`, options `ALL_ROLES`), the two raw statements take a bound ID or no input, and the reserved-name check runs before a transaction opens and names neither entry. The new form uses the shared `useFocusOnRefusal`; nothing in the added code is keyed on `errors`. There is no new dependency, `any`, cast, non-null assertion, `console`, TODO or lint suppression in any added `src/` line. The eight Minor findings are small. Three of them (STD-02, STD-03, STD-04) are the count of a duplication that master already holds on #119; this PR is the point at which each reached its rule-of-three limit or grew. STD-05 is about the UX words (#201): placement is right, and four literals escape it.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 8 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | not run locally (machine memory limit; brief) | CI `eslint .` is inside "Stages 1 to 11b", run 42881974487, success |
| Type-check | not run locally | CI `tsc --noEmit`, same run, success |
| Format-check | none configured (`CLAUDE.md` lists none) | n/a |
| CI | `pull_request_read get_check_runs` | 5 of 5 jobs success on run 42881974487 (Stages 1 to 11, 11b, Stage 12 shards 1 to 3); changed-code coverage 99.2% per the Dev Record |
| Function length (§1, 40 lines) | awk brace-matching over every changed `src/` file, and over `tests/support` files, compared with master | New in `src/`: `useTreatments` 56 lines (STD-01). Others at or under 39 (`useTreatmentForm` 39, `TreatmentForm` 36, `createTreatmentMethods` 31). Tests: `createFakeMasterRepository` 70 to 78, `validCallFor` 44 to 54 (STD-08); `createSessionHarness` 61 unchanged |
| File length (§1, 400 lines) | `git show 67febe3:<path> \| wc -l` | Largest new `src/` file `treatment-service.ts` 171; `master-repository.ts` 358 to 362; `masters-service.ts` 307 to 312. `role-matrix.test.ts` held at exactly 400 by merging rows (STD-06). `aqp-122-qa.spec.ts` 500, already over, unchanged |
| Complexity (§1, ≤ 10) | read of every new function with branching | Highest about 6 (`finish`, `change`); none over 10 |
| Casts, `any`, markers | search of all added lines for `console.`, `TODO`, `FIXME`, `eslint-disable`, `@ts-`, `debugger`, `.only`, `.skip`, `waitForTimeout`, `any`, `!.`, `as unknown` | None. Two `test.skip(condition, reason)` calls in `treatments-focus.spec.ts` (width guards with a stated reason, the pattern of the other specs); `as const` only |
| Unused exports | script over every added `export` in `src/`, searching `src/` and `tests/` | Only types (prop interfaces) and exports used by tests (`toTreatmentRow`, `isReservedTreatmentName`); `treatmentOptionSchema` has no other user (same as `materialOptionSchema`, #119 STD-09). No finding |
| Dependencies, generated files | file list | No `package.json`, lockfile, `.env*`, data file or generated file; only `src/`, `tests/`, `prisma/` |
| Commits and branch | `git log origin/master..67febe3` | 5 commits, all Conventional with `[AQP-130]`; branch `feat/AQP-130-treatment-color-list`; PR title `AQP-130: STORY-02.05: Treatment / Color list`; labels `ai-delivery`, `feature` |
| Secret scan | `gitleaks` not installed on this machine | Not run (tooling gap). CI stage 2 (full history) is inside the green "Stages 1 to 11" job. I read the migration, the canary file, the E2E support file and the fixtures: invented names only (`Canary-Treatment-Alpha`, `E2E-treatment-...`) |
| Migration | read of `20261110120000_treatments` against `materials` and `process_items` | Additive, rollback note, `ck_treatments_name_not_blank`, `uq_treatments_name_lower`, `REVOKE TRUNCATE` then explicit `GRANT`; same shape as `process_items` (hard delete) and `materials` (index pair). See STD-13 |

## Focus checks (from the brief)
| Focus | Result |
|-------|--------|
| Layering and source tree | Right: route (`withRoute`) to `masters-service` to `treatment-service` to `treatment-repository`; pure rules in `src/lib/masters/treatments.ts` shared by screen, schema and service; the browser file imports no zod (NFR-009). The new service and repository are in the Engineer import rule's blocked lists. No business rule in the panel, list or dialogs |
| Security hygiene (§5) | Strict body, params and answer; UUID check before the row lock; role check first (manifest rows, `engineer-refused-before-lookup`); no new library; no Restricted value added. No finding |
| Error handling (§4, §10) | `FieldValidationError` for a bad name, `ConflictError` with a code for "Other", `NotFoundError` for an unknown ID; the repository turns the unique violation into a typed error; nothing swallowed. One helper written a third time (STD-02) |
| Logging | None added |
| Dates, money, column letters (§10) | Not touched by this story |
| Documentation (§8) | Doc comments on the service, repository, schema, routes, hook and dialogs say why. One stale comment (STD-09); architecture §6 needs one phrase (STD-12). Words are pending the ux-expert (#201) |
| Tests (conventions) | Names start with the AC ID and say the behaviour; arrange-act-assert; shared late-failure runner used (no local runner); fixtures invented; the E2E support file writes the UX words out on purpose |
| Version control | Clean: no unrelated source change. Test edits to existing files are the page description (ux-spec v0.18 last row), the tab list, and one audit example whose shape became valid; `role-matrix.test.ts` also changed the Materials rows (STD-06) |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/components/features/masters/use-treatments.ts:95-150` | Coding Standards §1 (functions ≤ 40 lines; justify exceptions inline) | `useTreatments` is 56 lines with no inline justification. | The only new function in `src/` over the limit. AQP-123 STD-01 was the same for `useExchangeRates` (63 lines), and master verified its split in DL-131. | Move `onAdd`, `onRowAction`, `onSaved`, `onGone`, `onCloseAutoFocus` into `useTreatmentDialog` or a `useTreatmentActions(dialog, list, setNotice)`; or add the one-line "Over 40 lines on purpose" comment. |
| STD-02 | Minor | `src/server/repositories/treatment-repository.ts:61,74-76` (also `master-repository.ts:128-136`, `user-repository.ts:126-146`) | Coding Standards §1 (DRY, rule of three); §3 (shared modules) | `RECORD_NOT_FOUND = 'P2025'` and `isRecordNotFound` exist in two repositories; this PR writes the third. | A change to how Prisma reports a missing row is made in three files. `database-errors.ts` already holds the sibling helpers. | Export `isRecordNotFound` from `database-errors.ts` and import it; the new file should not add a copy. |
| STD-03 | Minor | `src/lib/masters/treatments.ts:1,14`; `views/schemas/treatments.ts:7`; `treatment-texts.ts:1`; `use-treatments.ts:9-10`; `treatment-panel.tsx:10`; `treatment-list.tsx:12`; `treatment-form-dialog.tsx:24`; `treatment-delete-dialog.tsx:18`; `lazy-tab-slot.tsx:10` | Coding Standards §2 (names reveal intent); #119 AQP-122 STD-04 and AQP-123 STD-04 ("due before STORY-02.02") | A treatment name is validated with `nameProblem`, `PROCESS_ITEM_NAME_MAX_LENGTH`, `NAME_REQUIRED_MESSAGE`; the tab imports `PageNotice`, `BREAK_LONG_NAMES`, `ERROR_RETRY` from `process-texts` and `focusOpener`, `Opener` from `process-opener`. | Fourth master on the Process-master names; the later rename touches seven more files. AQP-130 was built before the due story (AQP-142), so the item is still open and grew. | Master adds this PR's files to the #119 list (as DL-129 did for AQP-123) and keeps the due point at AQP-142; or do the rename now with `master-texts.ts`, `master-opener.ts` and neutral constants. |
| STD-04 | Minor | `src/components/features/masters/treatment-panel.tsx:56-71`; `use-treatments.ts:39-69` | Coding Standards §1 (DRY, rule of three); #119 (extract at the third screen of this shape; AQP-123 STD-05) | `LoadError` is the fifth copy of the load-error block (`process-results`, `material-results`, `exchange-rates-panel`, `lazy-tab-slot`, here). The "read again, then return focus" effect (`wantsFocus`) is the fourth copy. | The DEF-020 focus rule is changed in five places for the block and four for the effect; DEF-024 to DEF-026 came from such a copy. | Master rules whether the extraction (`<MasterLoadError>`, `useMasterList` / `useReadAgain`) belongs here or is due by AQP-142's G6. The component can already be shared by this panel and `lazy-tab-slot.tsx`. |
| STD-05 | Minor | `treatment-form-dialog.tsx:147,150`; `treatment-list.tsx:75,78`; `src/lib/masters/treatments.ts:25`; `masters-screen.tsx` (`skeletonRows={4}`); `treatment-texts.ts:39-40` | Coding Standards §1 (no magic numbers or strings); issue #201 | Words written inside components while `treatment-texts.ts` exists to hold them: `Cancel`, `Save`, `'Rename'`, `'Delete'`. `OTHER_LOCKED_REASON` is in `lib/` though only the list reads it (the test repeats the literal). `4` appears twice (`SKELETON_ROWS`). `renameTreatmentTitle` and `renameTreatmentLabel` have the same body. | A ruling on #201 would miss four literals; Material and Process dialogs show the pattern being copied. | Add `CANCEL_TREATMENT`, `SAVE_TREATMENT`, `RENAME_ACTION`, `DELETE_ACTION`; move `OTHER_LOCKED_REASON` into `treatment-texts.ts` and test the export; one exported skeleton-row constant; define one rename function as the other. |
| STD-06 | Minor | `tests/security/role-matrix.test.ts:71-73` | Coding Standards §1 (files ≤ 400 lines); §9 (no unrelated changes) | The file is held at exactly 400 by putting two routes on one line, and the Materials rows (another story's) are edited to do it. | The table was at 400 after AQP-123 too; the next story has nowhere to go. | Move `SPEC_ACCESS` to `tests/support/spec-access.ts`, restore one route per line, add the treatment routes. |
| STD-07 | Minor | `masters-screen.tsx:14-15`; `tests/support/session-harness.ts:14`; `views/schemas/treatments.ts:3-8` | Coding Standards §2 (consistency) | Import order: `./treatment-texts` before `./treatment-panel`; `./treatment-canary` before `./seed-config` and `./defined`; `lib/masters/treatments` before `lib/masters/process-items`. | No ESLint import-order rule exists, so noise lands in the next diff of the block (AQP-123 STD-08). | Move each line into its group. |
| STD-08 | Minor | `tests/support/fake-masters.ts:189`; `tests/support/route-calls.ts:65` | Coding Standards §1 (functions ≤ 40 lines) | `createFakeMasterRepository` 70 to 78 lines; `validCallFor` 44 to 54 (a `switch` of recipes). Both were already over. The new treatment methods were split out (`createFakeTreatmentMethods`), which is right. | Each story adds to two functions past the limit (AQP-123 STD-01 noted the same two). | A `createLockCounters()` helper for the four `let ...Locks`; a `treatmentCall(method, path)` the `default` delegates to; or the inline justification. |
| STD-09 | Info | `src/lib/errors.ts:83` | Coding Standards §8 | The comment on `NAME_TAKEN_CODE` says "(a rate or a material)"; it is now used for a treatment (`treatment-service.ts:100`). | A stale comment. | "(a rate, a material or a treatment)"; add "STORY-02.05 AC-2". |
| STD-10 | Info | `src/server/repositories/master-repository.ts:294` | #119 AQP-122 STD-09 / master DL-129 (5) | Status of the material-repository split (due before AQP-142 adds anything, at the latest by AQP-142's G6). This PR adds a spread, an import and two re-exports (358 to 362) and no method; the treatment methods are a new file. Not due yet. | The due point stays AQP-142's G6. | None here; AQP-142's Dev Context names the item. |
| STD-11 | Info | `src/server/services/treatment-service.ts:36-39` | Architecture §8 (AQP-74 rulings) | **Question 1.** Accept `master.created` / `master.edited` / `master.deleted` with `object_type` `treatment`. §8: `<object>.<past participle>`; "a masters story may add `master.created` and `master.deleted` ... `object_type` then names the master". `master.treatment.created` has three parts and the log is append-only. Same reading as AQP-122 and AQP-123. | AC-6 text is behind the code. | Product-owner amends AC-6 in Jira. The object has a real UUID, so no fixed-ID case. |
| STD-12 | Info | `src/lib/errors.ts:89-90` | Coding Standards §10 (typed errors mapped in one place) | **Question 2.** Accept 409 `TREATMENT_LOCKED`: a typed `ConflictError` with a code, thrown in one place; the constant sits with the other codes; the sentence beside the other treatment words; architecture §6 lists 409 for Treatments. Specific by design: "Other" is the only locked row a caller can reach. | The §6 "Codes used" line does not name it (nor `NAME_TAKEN`). | Architect adds both to the 409 and 422 lines. No code change. |
| STD-13 | Info | `prisma/migrations/20261110120000_treatments/migration.sql:27` | Architecture §5.1 (departures list); Coding Standards §10 SQL | **Question 4.** No departure needs recording: `treatments` follows the naming rules (§5.1: "a table that is not listed follows the rule"). Three notes, none a departure: hard `DELETE` and no `deleted_at` (as `process_items`); `uq_treatments_name` is implied by `uq_treatments_name_lower` and mirrors the Prisma `@@unique` (as `materials`); `is_hidden` has no guard trigger until 02.06 (header says so; #202). | The next reader may drop the wrong index. | One sentence in the `Treatment` model comment in `schema.prisma` (comment only; the migration is not edited). |
| STD-14 | Info | `src/server/services/audit-events.ts:134` | Cross-reference to reviewer-quality | `masterState` is the storage check for every master event; `{ name }` is now valid for any master `object_type` (the reason `masters-audit-events.test.ts` changed an example). Words are chosen by `object_type`, so display is safe. | Design question, not standards. | reviewer-quality to judge whether storage should check the state against the entry's own `object_type`. |

## Good practice noted (not findings)
- A new repository file for the treatment methods instead of growing `master-repository.ts`; `Object.hasOwn` guard from AQP-123 STD-02 kept.
- One audit entry in the change's own `tx`; table lock before row lock; shared late-failure runner used, with plants A3 and A4 shown in control PRs.
- Reserved-name check before any transaction (NFKC, trim, collapsed spaces, any case); the message names neither entry.
- Focus only from the shared `useFocusOnRefusal`; a source test holds the files to it; the one-field deviation from DL-135 is stated in the Dev Record for the reviewers to rule.
- The `lazy-tab-slot.tsx` rename (`git mv`) removes a copy instead of adding one.
- The migration: rollback note, explicit grants, the fixed `Other` ID compared to the test constant; additive only.
- E2E loader and fixtures use invented names and a random part per test.

## Issues for other roles
- **master:** rule whether STD-03 and STD-04 are done here or stay on #119 with this PR's files added (due AQP-142); STD-02 and STD-01 are small enough for one push if a fix round happens.
- **product-owner:** amend AC-6's event name on AQP-130 (STD-11).
- **solution-architect:** §6 codes line, `TREATMENT_LOCKED` and `NAME_TAKEN` (STD-12); #202.
- **ux-expert:** the words of #201 (placement in STD-05).
- **reviewer-quality:** STD-14.

## Tooling gaps
No local lint, type-check or tests (machine memory limit; CI run 42881974487 is the evidence). `gitleaks` is not installed on this machine, so the secret scan was not repeated (CI stage 2 is the evidence). No format-check command exists.
