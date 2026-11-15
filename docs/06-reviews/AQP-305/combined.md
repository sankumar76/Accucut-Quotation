# Review Report — AQP-305 (STORY-02.06, "Not applicable" system entries) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review; `critical-review`: a database trigger on master tables, data integrity, and NFR-002 on Engineer-reachable options) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-305-not-applicable` (PR #404) |
| Commit reviewed | 354a718 (two commits: b277560, 354a718; base 7ac923f). The GitHub merge commit from master that follows was **not** reviewed, as the orchestrator asked |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS**. No Blocker, Critical or Major findings |
| PR review | Submitted as COMMENT (single-token) with 5 inline comments; link in the hand-off |
| PR label | `review:quality-approved` |

## Summary
The migration adds the two hidden rows (fixed IDs, `ON CONFLICT DO NOTHING`), renames any existing entry that would clash instead of deleting it, swaps in the `\S` CHECK, and creates `refuse_system_row_change()` as architecture §5.1 specifies. The function raises for a system or hidden old row, for any DELETE of one, and for a flag change on UPDATE. It covers the runtime role and the owner, uses `SET search_path = pg_catalog`, and its message names only the table. The rows go in before the trigger, so the migration never trips its own guard. The rollback note is actually executed by a test, and so is a re-run over existing data.

Reading the hidden rows is limited to the two repositories. The new option readers select the fixed ID AND `is_hidden`, and read only ID, name and Material Considered. The options responses keep their strict 3-key and 2-key shapes. PATCH and DELETE on a hidden ID return 404 in the same words as an unknown ID and write no audit entry, which matches #390's material guard. The reserved-name check runs after the lookup on a rename and does not echo the name.

The tests are strong. They would fail if the trigger were dropped, narrowed to `is_hidden` only, or lost its flag-change branch. They would also fail if an option carried a number.

Three Minor findings are worth fixing cheaply or in the hardening window:
- the in-memory fake offers the hidden material but cannot lock or calculate it;
- there is no `BEFORE TRUNCATE` guard (A-3);
- a doc comment miscounts the hidden-row readers.

No finding at or above Major.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 5 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Diff read | GitHub MCP `pull_request_read get`, `get_files` (30 files), `get_commits` | Read in full: the migration, every `src/` change, the 3 new integration tests, the new helper, the 2 new unit tests, and every hunk of the 10 changed existing test files and of `canary-scan.spec.ts` |
| Context at 354a718 | `get_file_contents`: `material-repository.ts`, `treatment-service.ts`, `database-errors.ts`, `fake-masters.ts`, `engineer-import-rule.test.ts`, `master-rules.ts`, `lib/masters/treatments.ts`, migrations `20261108100000_materials` and `20261110120000_treatments`, `prisma/seed/`, architecture §4.9 / §5.1 / §6, coding standards (SQL section) | Read |
| Prior reviews | `docs/06-reviews/AQP-306/combined.md`, `combined-pr390.md` (material guard, hidden row 404, SQR-13), `AQP-303/combined.md` | Consistent (see SQR-01 for SQR-13 of #390) |
| Jira | AQP-305 description (AC-1 to AC-8) | Read |
| CI | `get_check_runs` on 354a718: run 43654091740 | **6 of 6 success** (Stages 1 to 11, 1 to 11b, E2E shards 1 to 4), 23:36 to 23:43 UTC |
| Local test run | not run | Per the brief: GitHub MCP only, no git, and heavy suites run in CI (§9 item 5). CI on 354a718 is the evidence |
| Cross-PR | #403 `get_files` (all patches scanned for `DELETE FROM` / `TRUNCATE` / `UPDATE` on `materials` / `treatments`, and for shared files) | See "Issues for other roles" |

## AC conformance
| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 rows by migration, fixed IDs, values 0, `material_considered` null, not by the seed | `migration.sql` step 2; `system-entries.ts` | `not-applicable-trigger.test.ts` AC-1 block (exact row incl. `deleted_at`; IDs in code equal IDs in migration; seed folder names neither ID nor the flag) | Met |
| AC-2 guard, runtime role and owner; ordinary rename/delete pass; INSERT unguarded | `migration.sql` step 4 | 13 statements × 2 roles with a before/after snapshot; flag flip on an ordinary row; ordinary rename/delete for both roles; INSERT with flags; `pg_trigger` metadata (BEFORE, ROW, UPDATE+DELETE, not INSERT, enabled); guard back after a re-run | Met |
| AC-3 `CHECK (name ~ '\S')`, every stored name passes | `migration.sql` step 3 | Definition contains `'\S'` and no `btrim`; tab, line break, spaces, empty refused for both roles; stored names pass | Met (see SQR-04, Info) |
| AC-4 hidden in no list; PATCH/DELETE on a hidden ID is 404 like an unknown one | existing default filter; new readers by fixed ID only | `not-applicable-options.test.ts` (same message as an unknown ID, no audit entry, row unchanged); `aqp-130` and `material-delete` now use the migration's real row | Met |
| AC-5 options include the entry (materials with null `materialConsidered`); no number for an Engineer | `findNotApplicable*Option`, `list*Options` | integration (keys, order, canary numbers absent, lookalike hidden row not offered); unit; route tests; `aqp-122` strict keys; e2e canary scan for the Engineer, both lists | Met |
| AC-6 reserved name, any case or spacing, 422 `NAME_RESERVED`, no echo | `assertMaterialNameNotReserved` + `isNotApplicableName`; treatments already did this (02.05) | unit (6 spellings incl. full-width, add before the transaction, rename after the lookup, 404 first); routes POST and PATCH; integration on a real database; the unique index as backstop for both roles | Met |
| AC-7 calc: AK, O, M = 0; F and I blank; costs operands; words stored | already in place from 03.03 | `not-applicable-calc.test.ts` (lib level: M, O, AK = 0, labour unchanged); `row-outputs.test.ts` (real row) | Met at lib level, per the story's Dev Context and A-4. The on-screen, export and costs-route parts are not built yet (SQR-07, Info) |
| AC-8 G stored `{id, text}`; no formula reads it | no formula reads G | `not-applicable-calc.test.ts` walks every seed formula | Partly. The "no formula reads it" half is met. The stored `{id, text}` belongs to 05.06 (AQP-314), which this story blocks (SQR-07) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| SQR-01 | Minor | `tests/support/fake-masters.ts:89` (also `:90-93`, `:131`) | Test fidelity; SQR-13 of #390 | The fake now **offers** the hidden material (`findNotApplicableMaterialOption`), but its `lockMaterialForUse` and `findMaterialForCalculation` look only in `materials[]`, so for `NOT_APPLICABLE_MATERIAL_ID` they return `false` / `null`. PostgreSQL returns `true` and the zero row | A unit test of the part save (05.03/05.06) or of Calculate (#403) that picks the option the fake offers will be refused in the fake but accepted on the real database. That steers developers wrong exactly where 05.06 starts | Teach both fake methods the fixed hidden row: `lockMaterialForUse: (id) => Promise.resolve(isNotApplicable(id) \|\| indexOf(id) !== -1)`, and return `{ id, materialInDrawing: NOT_APPLICABLE_NAME, materialConsidered: null, pricePerKg: '0.00', specificGravity: '0.00', scrapRate: '0.00' }` from `findMaterialForCalculation`. Add a unit test that saves a part with the option the fake lists |
| SQR-02 | Minor (follow-up, hardening window) | `prisma/migrations/20261114140000_not_applicable_entries/migration.sql:76-82` | Integrity; A-3 | No `BEFORE TRUNCATE` guard. The runtime role cannot TRUNCATE either table (both earlier migrations revoke it), so the realistic risk is only an owner-role mistake: an ops script, a future migration, or a test reset run against a shared database. No FK references `treatments` (and `materials` is referenced only from JSON), so `TRUNCATE treatments` would succeed and silently remove "Other" and "Not applicable". No TRUNCATE exists in the code today | Low likelihood but silent. Parts would lose their "Not applicable" choice, the form would lose "Other", and only a migration can put them back | Accept A-3 for this PR. Raise a `tech-debt` issue for the next migration: one statement-level trigger per table, `BEFORE TRUNCATE ... FOR EACH STATEMENT EXECUTE FUNCTION refuse_system_table_truncate()` raising `integrity_constraint_violation`, plus an owner-role test. Architect to confirm, since §5.1 names only UPDATE/DELETE |
| SQR-03 | Minor | `src/server/repositories/material-repository.ts:18-20` | Doc accuracy; architecture §4.9 ("a separately named method … used only by the two below") | The header says the hidden row "has two readers" (the options reader and `findMaterialForCalculation`). `lockMaterialForUse` (`FOR SHARE … deleted_at IS NULL`, from #390/#391) also finds it, on purpose, so the part save can store the choice | A later reader may trust the comment and add a hidden-row filter to `lockMaterialForUse`. That would break saving "Not applicable" on a part without any 02.06 test failing (only `material-delete.test.ts` asserts it) | Say "three readers: options, the part save's lock (`lockMaterialForUse`), and the calculation". #403 renames the calculation reader, so update this line during that rebase |
| SQR-04 | Info | `migration.sql:30` and `:50`; `system-entries.ts:27` | AC-3, AC-6 | The SQL side uses PostgreSQL `\s` (`[[:space:]]`, locale-dependent) and no NFKC. The service uses JS `\s` (which includes U+00A0 and U+3000) after NFKC. So the step-1 rename can miss a pre-existing full-width or NBSP spelling, and the `\S` CHECK may accept a name made only of NBSP | Bounded: the service already refuses both cases (trim plus NFKC), and the database is pre-release (G8 not passed). The CHECK is a backstop, not the rule | None needed now. If wanted, widen the CHECK to `name ~ '[^[:space:]  -​　]'` in a later migration |
| SQR-05 | Info | `material-repository.ts` `readMaterialValues` / `shareMaterialRow` (unchanged) | Defence in depth | The new options reader pins the fixed ID, but the calculation reader and the part-save lock accept **any** hidden row by ID. INSERT is unguarded by design, so a hidden row added by direct SQL with non-zero numbers would be calculable | Only by direct SQL as the runtime role, which can already change an ordinary material's price, so this adds no real exposure | Optional: pin these readers to `NOT_APPLICABLE_MATERIAL_ID` when `is_hidden` is true (fits naturally into #403's batched reader) |
| SQR-06 | Info | `migration.sql:27-35` | A-2; NFR-007 | The step-1 rename writes no audit row | Acceptable. Nothing is deleted, the ID is kept in the new name, the Dev Record names it, and no production database exists yet (pre-G8) | None. If a release ever runs it over real data, the release notes should name it |
| SQR-07 | Info | story scope (A-4) | AC-7, AC-8 | The lib-level proof is what the story's Dev Context asks for. Three things remain open: F and I blank on screen and in the export, the `GET /nodes/{nodeId}/costs` operand rule, and G stored as `{id, text}` | Untested until 05.06 and the costs-route story | Make sure AQP-314 (05.06) and the costs-route story carry these as ACs, and that the final full review/QA re-runs AC-7 end to end (§9 item 3) |
| SQR-08 | Info | `prisma/migrations/20261110120000_treatments/migration.sql` header (not in the diff) | Doc | That header still says the 02.06 trigger "does not cover" "Other". The ruling of 2026-11-10 (v0.35) changed that, and this PR implements the change | Mild confusion for a reader. An applied migration must not be edited (coding standards, SQL) | None. The new migration's header and architecture §5.1 are the record |

Good practice noted: the migration test runs the rollback statements straight from the migration file's own header, so the note cannot drift from the code. A lookalike hidden row is shown not to pass for the entry. The trigger tests compare a before/after snapshot of every system row for both roles. The test helper disables the trigger inside one transaction, in a throwaway database, using only constant identifiers.

## Security checklist (critical-review)
| Point | Result |
|-------|--------|
| Migration over existing data: rename, no data lost | Pass. Clashing names are renamed to `left(name,80) || ' (renamed <8 hex>)'`, at most 99 characters against a limit of 100. Nothing is deleted, and the ID is unchanged, so parts keep their choice. Tested with case and double-space clashes |
| Audit gap A-2 | Acceptable (SQR-06) |
| Fixed IDs; idempotent re-run; rollback note executed | Pass. The IDs are asserted equal between code and migration. The re-run after the rollback note neither duplicates nor renames anything, and the guard comes back |
| Trigger: both roles; UPDATE/DELETE of system or hidden rows; flag flips; ordinary rows unaffected; INSERT unguarded | Pass. All tested. A runtime DELETE on `materials` is refused earlier, by the missing grant, which is also asserted |
| No `BEFORE TRUNCATE` (A-3) | Accepted for this PR; follow-up recommended (SQR-02) |
| Message names only the table | Pass. Exact text asserted; `TG_TABLE_NAME` only; SQLSTATE 23000 passes through `withDatabaseErrors` and becomes the logged 500 that architecture §5.1 specifies |
| `\S` CHECK; all stored names pass | Pass (SQR-04 Info) |
| Only the two repositories name `is_hidden` | Pass for the diff (`isHidden` appears only in `material-repository.ts` and `treatment-repository.ts`; `system-entries.ts` holds IDs and words only) |
| Hidden-row readers read no number | Pass for options (3 / 2 columns selected; integration asserts keys). The calculation reader reads numbers by design (A-17) |
| Options strict shapes; hidden entry last (A-1); no rate/price/gravity/scrap for an Engineer | Pass. Schemas unchanged (null was already allowed), and A-1 is acceptable. The e2e canary scan covers the Engineer's options for both lists |
| PATCH/DELETE on a hidden ID is 404 like an unknown one; consistent with #390 | Pass. Same words and no audit, as for the material delete of #390 |
| Reserved-name order; no echo | Pass. Materials: the add checks before the transaction; the rename checks after the 404 lookup. Treatments keep 404 → 409 → 422 |
| New files classed in `engineer-import-rule` | Not needed. No new file in `src/server/repositories` or `src/server/services`; `src/lib/masters/system-entries.ts` holds no number |

## Test adequacy (quality)
- **The 10 changed existing files were not weakened.** A plain `DELETE` becomes `clearMaterials` / `clearTreatments`, which delete the same rows except the migration's system rows. Expectations gain the trailing hidden entry. The `rows()` helpers exclude only the hidden ID, and its own tests assert the exact table contents. `aqp-130` keeps every assertion about the hidden row: on no Admin list, the Admin response does not contain "applicable", PATCH and DELETE are 404 in the same words as an unknown ID, the row is unchanged, and there is no audit entry. Only "absent from options" became "last in options", which is the new requirement. `aqp-122` allows `null` only on the hidden ID. `material-delete` and `row-outputs` now use the real row, which is both `is_system` and `is_hidden`, so they are stronger than the earlier planted row that was hidden only.
- **If the trigger were dropped,** the AC-2, migration-test and metadata tests would fail.
- **If an Engineer saw a rate,** the strict schemas (500), the integration key assertions, the canary number scans (unit and integration) and the e2e canary scan would fail.

## Issues for other roles
- **developer (AQP-317, PR #403), on rebase after #404 merges.** No `DELETE FROM materials/treatments` or `TRUNCATE` was found in #403's added lines, and its `UPDATE materials` targets only an ordinary row. What will break or conflict:
  1. **Textual conflicts** in five files both PRs change: `tests/support/fake-masters.ts` (keep `deletedMaterials` **and** add `findNotApplicableMaterialOption` to the type union and the object), `tests/integration/calc/row-outputs.test.ts`, `tests/integration/masters/material-delete.test.ts`, `src/server/repositories/material-repository.ts`, `src/lib/errors.ts` (and `tests/e2e/canary-scan.spec.ts`).
  2. **Compile break.** #403 replaces `findMaterialForCalculation` with `findMaterialsForCalculation`. #404's `not-applicable-options.test.ts` and `row-outputs.test.ts` call the old name, so whichever PR merges second must port them, or `tsc` fails.
  3. **Trigger break.** #403's `row-outputs.test.ts` plants its own hidden row (`'Hidden-entry-for-test'`, `is_hidden` true). After #404, a plain `DELETE FROM materials` in `afterEach` raises on that row, so keep `clearMaterials(db.owner)` (as #404 has it). Better, assert against `NOT_APPLICABLE_MATERIAL_ID`.
  4. **The batched reader must still find the fixed hidden row** (A-17). Update the header comment naming the readers (SQR-03).
  5. Any **new** test that cleans `materials` or `treatments` as the owner must use `tests/support/system-rows.ts`.
- **solution-architect.** Rule on SQR-02 (a `BEFORE TRUNCATE` guard: add it to §5.1 or not).
- **scrum-master / product-owner.** Check that the open parts of AC-7 and AC-8 (SQR-07) are carried as ACs in AQP-314 and the costs-route story.

## Previous Findings
n/a (round 1).
