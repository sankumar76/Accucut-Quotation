# Test Report — AQP-97 (STORY-03.01): Field registry seed and column letters

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `5f197ae` on `feat/AQP-97-field-registry-seed` (PR #32, `sankumar76/Accucut-Quotation`), plus the QA acceptance tests committed with this report |
| CI | Run 41622866181 on `5f197ae`: job "Stages 1 to 11" success. Stages 1 to 11 all success (secret scan, data-file check, lint, type-check, unit tests, audit, licences, build, roles, migrations plus drift check, integration tests, changed-code coverage); stages 12 and 13 skipped by design. CI is the reference run |
| Environment | Windows 11; Node v24.19.0, npm 11.17.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17 from `compose.dev.yml`, run as a throwaway Compose project `qa97` on host port 55497 with invented passwords (the developer database on 55432 was not touched), removed with its volume afterwards; Chromium via Playwright. The machine was loaded (other containers and sessions), so see "Known load-sensitive failure" |
| Date | 2026-11-03 |
| **Recommendation** | **ACCEPT.** All 7 acceptance criteria verified with evidence. No new defect. Open Sev-1 0, Sev-2 0, Sev-3 1 (DEF-003 / AQP-168 / #24, known, type Test, not counted against this story), Sev-4 0. Eight observations for routing (none blocks) |

## Summary

All seven ACs hold. I checked them against an oracle I built from the SPEC itself rather than from the implementation: the tables of SPEC 7.1, 7.4 and 4.1 are parsed in the test and every one of the 67 seed fields, 8 sections, 6 stages, 31 formulas and 15 Process Master IDs is compared with its SPEC row, using a column-letter odometer written for the test (no arithmetic shared with `columns.ts`). The immutability and concurrency checks ran against real PostgreSQL 17 as both roles. Eight deliberate faults put into the seed, the repository and the migration (one at a time, then reverted) were each caught by the new tests, so the tests can fail. The full regression is green except one test that is known to time out on this machine only (DEF-003 class).

203 QA acceptance tests are added in three files under `tests/acceptance/`. They are not repeats of the developer's tests: they add the SPEC-derived oracle, 14 statement shapes against the immutable table for each of the two roles, real concurrency (12 callers and 4 real processes), a corrupt row written by SQL, the pool ceiling, and the production timeouts with no override.

## AC Verification Matrix

Test IDs are titles beginning `[AQP-97 AC-n]` in `tests/acceptance/aqp-97-columns.test.ts` (C), `aqp-97-registry.test.ts` (R) and `aqp-97-config-versions.test.ts` (V), or the developer's files named. Techniques: BVA boundary-value analysis, EP equivalence partitioning, DT decision table, EG error guessing, ST state transition.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | C: 52 tests | BVA, EP, EG | ✅ Pass | 1=A, 26=Z, 27=AA, 52=AZ, 53=BA, 67=BO and the inverse of each. Further boundaries 676 YZ, 677 ZA, 702 ZZ, 703 AAA, 16,384 XFD, 18,278 ZZZ, 18,279 AAAA. Agrees with an independent odometer for every position 1 to 60,000 in both directions. Round trip for 1 to 1,000 and for 5,000 seeded random positions up to 100 million. Throws `ColumnReferenceError` (`COLUMN_REFERENCE_INVALID`, HTTP 422) for 0, -1, -0, 0.5, 1.5, NaN, ±Infinity, 2^53, a number as text, null, undefined, true, a bigint, an array, an object; and for empty, lower case, mixed case, digits, spaces, trailing and leading newline, tab, zero-width space, a Cyrillic capital A, a full-width A, an accented capital, `$A`, `A:B`, `A-B`, 11 letters and 1,000 letters. The message does not echo the input. 10 letters (the limit) converts to an exact integer and back. See OBS-1 and OBS-2 |
| AC-2 | R: 9 tests; developer `tests/unit/fields/seed-config.test.ts`, `schema.test.ts` | EP, DT | ✅ Pass | 67 fields (35 inputs and auto, 32 outputs; auto fields are A, F, I), positions 1 to 67 in list order. Every field's position, label, kind and data type equal its SPEC 7.1 or 7.4 row. `mandatory` follows SPEC 7.3 for all 35 (every input except C and the eight flags). No key matching letter or column anywhere in the stored JSON, and no letter-shaped value outside label, name, hint and group. A `letter` or `column` property is refused at the top, in a section, in a stage and in five fields of all three kinds. Width in 0 to 255, number format present, row scope valid, key kebab-case and unique |
| AC-3 | R: 9 tests | DT, BVA, EG | ✅ Pass | `systemRole` on A, H, BG, BL, BM, BO and nowhere else. `engineerVisible` true for exactly 33 fields (32 inputs and F); false for A, I, BH, BI and all 32 outputs. The schema refuses `engineerVisible: true` on each of the other 34 fields one at a time, and names the rule. A hidden input is accepted. C is not mandatory; S defaults to "None"; T and U carry `visibleWhen` S not-in ['None',''] (displayed as `S not in ['None','']`) and are hidden for "None", blank and absent, shown for a value; no other field has a rule. The seven treatment outputs hide on Z, AA, AB, AC, AE, AF, AG; no other output has `hideWhenZero`; the Plating flag (AD) hides nothing. Section 8 form order is AP, AU, BM, AJ (not letter order); every section's form order equals the SPEC row order. BL, BN, BO are product scope and nothing else is. Roles cannot be removed, doubled, moved to the wrong kind, or given a formula (BO) |
| AC-4 | R: 7 tests | DT, EP | ✅ Pass | Eight sections numbered 1 to 8 with the SPEC names; only section 7 is `multi-select`. Column range derived from the fields: `A–D, G, H` / `E, F, I–L, N` / `P, Q` / `R` / `S–U` / `V–Y` / `Z–AG` / `AJ, AP, AU, BM`, checked also against a second range algorithm in the test and with F and I hidden (`E, J–L, N`). Six stages with the SPEC names; stage 3 sub-headings Cutting, Bending, Welding, Surface Treatment, Entered directly, Process Total. Every output sits in the SPEC's stage and sub-heading; AP and AU sit in stage 3 "Entered directly". Stage totals: stage 1 none, stage 3 = AY, stage 5 = BC to BF; a total naming a missing field is refused |
| AC-5 | R: 13 tests; developer `formula-references.test.ts` | DT, EG | ✅ Pass | Every SPEC 7.4 formula's stored text, rebuilt to display form by a converter written in the test, equals the SPEC text (31 outputs; BO has none). The stored text contains only `{{f:}}`, `{{rate:}}`, `{{mat:}}`, `{{fx:}}`: no letter, rate name or material name left. O = `IF(Material-Specific-Gravity > 0, M - N, 0)`, BC = `0`, BB = `BA * H` with H an operand in BB only, BL = `SUM(BG)`, BN = `BL / SUM(BM)`, BH and BI `{{fx:USD}}` and `{{fx:EUR}}`. Planted references to a missing field, a rate that is not an ID, a bad material, a bad currency, an unknown prefix and an unclosed reference are each refused. **15 fixed Process Master IDs (D-38):** the 15 names and units equal the SPEC 4.1 table in the SPEC order (parsed in the test); Plating-rate-per-sqin is ninth, per sq in; Soft-Anodize-rate-per-sqin is per sq in; IDs are 15 distinct valid UUIDs, pinned to `00000000-0000-4000-8000-0004000000NN` for NN 01 to 15 so a change is noticed by 02.01's comparison; none collides with the 67 + 8 + 6 field, section and stage IDs; every `{{rate:}}` in the seed is one of the 15; the Plating rate is used by no formula (D-40) and each of the other 14 is used by at least one |
| AC-6 (negative) | V: 38 immutability tests (14 statement shapes x 2 roles, plus 10 on transactions, messages, DDL, grants, triggers, table shape and version 1), 4 read-side tests, 7 concurrency and failure tests; R: 52 document-rejection tests; developer `immutability.test.ts` | DT, EG, ST | ✅ Pass | **Both roles, 14 statement shapes each** (UPDATE of created_by, created_at, id, every column, UPDATE ... FROM, UPDATE ... RETURNING, DELETE by number, DELETE ... RETURNING, DELETE ... USING, TRUNCATE ONLY, TRUNCATE RESTART IDENTITY CASCADE, upsert `ON CONFLICT DO UPDATE`, MERGE with UPDATE, MERGE with DELETE). The runtime role is refused with 42501 (missing grant); the owner with 23000 (trigger). A digest of the table is unchanged after each. A refused statement aborts its transaction (25P02) and a rollback leaves the row. The message is `Table "config_versions" is immutable: UPDATE is not allowed.` and does not echo the row. An owner UPDATE or DELETE that matches no row changes nothing. The runtime role cannot disable or drop either trigger, drop or rename the table, replace the trigger function, create a table, or set `session_replication_role`; `GRANT` by the runtime role has no effect. The owner is not a superuser and cannot set `session_replication_role`. Grants: SELECT and INSERT only, on the table and on every column, PUBLIC none (grantees are `accucut_app` and `accucut_owner`). Both triggers are enabled, BEFORE, row (UPDATE, DELETE) and statement (TRUNCATE); the function pins `search_path = pg_catalog`. Columns and types match the AC; unique number; no `updated_at` (DL-052). **Version 1:** exists after `ensure-seed-version` (real script run twice on the migrated database: "created", then "nothing changed", exit 0 both, one row, 67 fields, 8 sections, 6 stages, `created_by` null). **Concurrency:** 12 callers each with its own pool, 3 rounds on fresh databases: exactly one `created: true`, eleven `false`, one row. 6 callers with 6 different documents: one row, whole, equal to the winner's. 4 real processes started together: all exit 0, exactly one prints "created", three print "nothing changed", one row, no stderr. **Failure of the step:** with no `config_versions` table, and with a wrong password: exit 1, "ensure-seed-version failed", neither the password nor the URL printed, no row. **Invalid documents:** 44 faults refused with `ConfigDocumentError` (unknown or missing kind, duplicate key, id, form order, section number or stage id, `engineerVisible` on an output, a position gap, text position, bad id, bad key (capitals, space, trailing hyphen, 61 characters), empty or 201-character label, widths 0, -5, 256, NaN, a data type that does not exist or does not fit the kind, a formula on an input, a default on an output, empty and 2,001-character formulas, `hideWhenZero` naming no field or itself, `visibleWhen` naming no field, with a bad operator or no values, unknown section, stage or group, product scope on an input, multiline on a number, empty options, unknown display mode, an extra property, no fields, no sections) and six values that are not documents; a `__proto__` key is refused and pollutes nothing. The error names paths and rules and never a value: a sentinel planted in eight properties, none in the message. **Read side:** a version written straight into the table by SQL that breaks a rule (`engineerVisible` on an output) is refused by `getCurrentVersion` and is not cached, and the last good version is not served in its place. The latest version is chosen by number as a number (10 after 3 and 2), not by time. A version added by another process is seen on the next call. The served version is deep-frozen and its time is ISO text |
| AC-7 | R: 4 tests; `scripts/check-data-files.ts`, `check-licences.ts`; CI stage 3 and stage 2; count-only workbook scan | DT | ✅ Pass | The only numbers in the stored document sit under the keys `position`, `formOrder`, `number`, `width`. The only defaults are "None" (S) and "0" (the eight flags); no field has options (no master list is seeded). The numeric literals in formulas are exactly 0, 2, 144, 645, 1000000, all printed in SPEC 7.4. The seed is deep-frozen (a write throws `TypeError`). `check-data-files` and `check-licences` pass; CI stage 2 (Gitleaks, full history, baseline) and stage 3 pass on `5f197ae`. **Workbook leak scan** (throwaway script, counts only, nothing printed or kept): the sample workbook's 864 cells gave 148 distinct significant numbers (non-integers with 2 or more decimals, or whole numbers of 100 or more) and 85 distinct strings of 4 or more characters; the 24 non-test, non-docs files the branch adds or changes hold 0 of the numbers and 0 of the strings that are absent from the SPEC. I did not record, copy or print any workbook value |

## Pool and timeouts (architecture rulings R4 and R5; PRF-01, PRF-02, issue #18) and DATABASE_BUSY

| Check | Result | Evidence |
|-------|--------|----------|
| Constants equal the architect's table (comment 10699) | ✅ | `POOL_SETTINGS` deep-equals the table: app 10, worker 3, script 2 connections; connect timeout 5,000 ms; idle 30,000 / 10,000 / 10,000; statement 10,000 / 30,000 / 30,000; idle-in-transaction 30,000; names `accucut-app`, `accucut-worker`, `accucut-script`. `poolConfigFor` maps them to the `pg` names and nothing else |
| No override from production code (STD-15) | ✅ | `poolConfigFor.length` and `createPrismaClient.length` are 2; the only way to shorten a limit is `tests/support/test-prisma-client.ts` |
| Pool ceiling | ✅ | 25 concurrent 1.5 s queries on an `app` client: peak connections seen by the same role is above 1 and at most 10. 6 on a `script` client: at most 2 |
| Statement timeout, production value, no override | ✅ | `SELECT ... FROM pg_sleep(14)` on an `app` client is cancelled at about 10 s (measured between 9 and 13 s) and becomes `DatabaseBusyError`: code `DATABASE_BUSY`, HTTP 503, message "The service is busy. Try again in a moment."; the driver error is kept as `cause`; `JSON.stringify` of the error holds neither the SQL nor the password |
| Acquire timeout, production value, no override | ✅ | With 10 connections held by 8 s queries, the 11th request (`findLatestRef`) fails after about 5 s (measured between 4 and 7.5 s) with `DATABASE_BUSY` 503, before the holders finish; afterwards the same request succeeds |
| Non-timeout errors pass through | ✅ | A plain error is rethrown as the same object; a permission error from the database is not turned into DATABASE_BUSY |
| Developer's R4 tests | ✅ | `database-timeouts.test.ts`, `prisma-pool-settings.test.ts`, `database-errors.test.ts` pass in the full run |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| New QA acceptance tests (3 files) | `npx vitest run tests/acceptance/aqp-97-columns.test.ts tests/acceptance/aqp-97-registry.test.ts tests/acceptance/aqp-97-config-versions.test.ts` (own throwaway Postgres, port 55497) | 203 | 203 | 0 | 0 | 50.6 s |
| Full regression, run 1 | `npx vitest run` | 1,071 (41 files) | 1,070 | 1 (known, below) | 0 | 81 s |
| Full regression, run 2 | `npx vitest run --coverage` | 1,071 (41 files) | 1,070 | 1 (the same test) | 0 | 92 s |
| The failing file alone | `npx vitest run tests/unit/lint/layer-rules.test.ts` | 67 | 67 | 0 | 0 | 9.7 s |
| Lint | `npx eslint .` (includes the new tests) | | exit 0 | | | |
| Type-check | `npx tsc --noEmit` (includes the new tests) | | exit 0 | | | |
| Build | `npx prisma generate && npx next build` | | exit 0 | | | routes `/` and `/_not-found` |
| End to end | `npx playwright test` | 3 | 3 | 0 | 0 | 45.6 s (mobile, tablet, desktop) |
| Migration | `npx prisma migrate deploy` on the empty throwaway database | 1 migration | applied | | | then `migrate status`: up to date; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: "No difference detected" |
| Repository checks | `npx tsx scripts/check-data-files.ts`; `npx tsx scripts/check-licences.ts` | | both pass | | | |
| CI | run 41622866181 on `5f197ae` | | success | | | stages 1 to 11 success, 12 and 13 skipped by design |

**Known load-sensitive failure (not a new defect).** In both full runs the only failure is `tests/unit/lint/layer-rules.test.ts > ESLint layer rules (AC-6) > static import fails lint: src/lib imports src/server (alias)`, `Test timed out in 30000ms` (the case took 42.6 s and 62.7 s here). It passes alone (67 of 67, 9.7 s) and in CI. This is DEF-003 (AQP-168, #24), whose scope the master widened (DL-057) to the class. I recorded it as known and raised nothing new. The other load-sensitive items in the master's list (10 s integration hooks, the registry-index 100 ms bound) did not fail in either run; my own tests set 60 s hook limits and wide timing bounds.

## Mutation checks (do the new tests fail when the product is wrong?)

Each fault was made in the working tree, the relevant tests run, and the file restored with `git checkout`; `git status` shows no production file changed.

| # | Fault | Caught by |
|---|-------|-----------|
| M1 | BB formula `BA * H` changed to `BA * 1` | 4 tests (formula text, H used only in BB, the named formulas, formula literals) |
| M2 | Shot Blasting Cost hides on the Primer flag instead of the Shot Blasting flag | 1 (hideWhenZero pairs) |
| M3 | Part Model made mandatory | 2 (mandatory per SPEC 7.3; C optional) |
| M4 | Seed ID list: `Plating-rate-per-sqin` renamed `...-sqft` | 3 (names and units vs SPEC 4.1; ninth item; Plating unused) |
| M5 | Stage 5 total drops Transportation (BF) | 1 (stage totals) |
| M6 | `ON CONFLICT (number) DO NOTHING` removed from the repository | 5 (three 12-caller rounds, the different-document race, the 4-process run) |
| M7 | `REVOKE UPDATE, DELETE, TRUNCATE` removed from the migration | 14 (the runtime role would be stopped by the trigger instead of the grant) |
| M8 | Trigger function made to return before it raises | 14 (the owner's attacks succeed) |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Immutability of versions | NFR-026 | AC-6 above, both roles, 14 statement shapes, DDL and bypass attempts | ✅ Pass. Residual: the owner can switch the trigger off with DDL (OBS-4) |
| No cost leak through the registry | NFR-002, ADR-008 | `engineerVisible` allow-list: 33 true, 34 refused one by one; read-side validation refuses a bad row written by SQL | ✅ Pass |
| No real data in the repository | NFR-006, ADR-014 | AC-7 above: structure-only assertions, data-file and licence checks, count-only workbook scan, CI Gitleaks | ✅ Pass |
| Performance | NFR-008 | The registry document is parsed once per version per process (R5). The developer's `registry-index.test.ts` 100 ms bound and cache tests pass. I did not time a request path: no route exists yet | ✅ for what exists; the NFR is checked again when a route reads the registry |
| Security smoke | | Error text never carries a value (document errors, column errors, DATABASE_BUSY, the step's output); no SQL or password in `JSON.stringify` of the busy error; `__proto__` in a document is refused and pollutes nothing; all SQL in the repository is parameterised | ✅ Pass |
| Accessibility | | Not applicable: no screen in this story | n/a |

## Exploratory Testing

**Charter 1 (30 min):** attack the immutable table as a developer who wants to "just fix a typo" in version 1, and as someone with only the runtime credentials. Areas: statement shapes, DDL, role escalation, session settings. Result: nothing changed a row. Found: a role without the grant option that runs `GRANT` gets a warning, not an error (checked by effect: nothing granted). The owner can `ALTER TABLE ... DISABLE TRIGGER ALL` and then UPDATE (the migration's own comment says the owner can drop the trigger with DDL; see OBS-4). The table has no CHECK on `number` or `reason` (OBS-5).

**Charter 2 (20 min):** break the seed step. Areas: concurrency, missing table, wrong password, different documents at once. Result: no double insert and no partial row in 3 x 12 racing callers and 4 racing processes; failures exit 1 with no secret. 

**Charter 3 (20 min):** hostile input to the letter functions and the visibility rule. Found OBS-1, OBS-2 and OBS-3.

**Charter 4 (10 min):** pool behaviour at the ceiling and at the timeouts with production values; an idle-in-transaction session killed at 0.5 s (test override) surfaces as a plain driver error ("Client has encountered a connection error and is not queryable"), not DATABASE_BUSY (OBS-6).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| none new | | | | |
| DEF-003 ([AQP-168](https://sankumar76.atlassian.net/browse/AQP-168), [#24](https://github.com/sankumar76/Accucut-Quotation/issues/24)) | Layer-rules unit test times out when the machine is busy (class widened by DL-057) | Sev-3, type Test | Known, open; seen twice on this machine; passes alone and in CI. Not counted against AQP-97 | regression only |

Open by severity: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-003), Sev-4 0. No defect record, Jira Bug or GitHub issue was created by this run; observations are below for the master to route.

## Observations (not defects; for the master to route)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | `indexToColumnLetter` accepts any safe integer, but `columnLetterToIndex` refuses more than 10 letters. A position above 146,813,779,479,510 gives an 11 or 12 letter string that the inverse rejects (`MAX_SAFE_INTEGER` gives `BKTXHSOGHKKE`). The AC (1 to 1,000) and Excel's own limit (16,384 = XFD) are far inside the range, so nothing reachable fails | Developer, Sev-4 backlog: reject the same range in both directions |
| OBS-2 | `columnLetterToIndex(['A'])` returns 1 (the regex coerces an array), and an object whose `toString` returns letters throws a `TypeError`, not the typed error. Reachable only by bypassing the types | Developer, Sev-4; the HTTP boundary validates with zod anyway |
| OBS-3 | The rule `S not in ['None','']` is case and space sensitive: "none", "NONE", " None", "None " and a single space make Fasteners Qty (T) and Fasteners Cost (U) visible and, when visible, mandatory. This follows the SPEC text literally; the SPEC does not say whether to trim or ignore case, and S is free text | product-owner and ux-expert: decide before the Engineer form story (EPIC-05) |
| OBS-4 | The README says the table "cannot be updated or deleted, even by the owner". True for UPDATE, DELETE and TRUNCATE (trigger). The owner can still remove the trigger with DDL (`ALTER TABLE ... DISABLE TRIGGER`, `DROP TABLE`), as the migration's own comment states. The owner role is used by `migrate` only | Standards reviewer or developer: add "by a data statement" to the README sentence |
| OBS-5 | No CHECK on `number` (the table accepts -5) or `reason` (it accepts an empty string); the runtime role may INSERT. The snapshot is guarded on read, the metadata is not | Developer, with deferred #34 (harden validation before the first edit path) |
| OBS-6 | A session killed by `idle_in_transaction_session_timeout` surfaces as a generic driver error, not DATABASE_BUSY. R4 asks only for the statement and acquire timeouts | Covered in spirit by deferred #38 (database errors at the HTTP edge) |
| OBS-7 | `POOL_SETTINGS` is typed read-only (`as const`) but not frozen at run time | Developer, Sev-4 |
| OBS-8 | The QA acceptance file for the database adds about 35 s to the suite because two tests wait for the real 10 s statement timeout and the real 5 s acquire timeout, on purpose (production values with no override). If the master wants a faster suite, the developer's override-based tests already cover the mapping | Master, accept or ask QA to drop the two real-time tests |

## Residual Risks / Notes

- The tests are written from the SPEC and the AC text, but after I had read the developer's tests and the implementation, so the independence is of oracle, not of first reading. I say so rather than claim otherwise.
- Not tested: the `migrate` one-shot in the Compose file (story 10.04) and `app` and `worker` not starting when it fails (only the script's exit code is tested); a superuser (`postgres`) can bypass any trigger and is out of scope; the final column widths and number formats are defaults pending OQ-ARCH-13 (not an AC of this story).
- The deferred issues #29, #30, #31, #34, #35 and #38 remain open and are owned by later stories.
- The throwaway database project `qa97` and its volume were removed. Scratch outputs are in the session's temporary folder, outside the repository. A temporary probe folder `.qa-scratch/` (one emptied file) is left untracked in the worktree because this session was not permitted to delete files; it is not committed and can be deleted.
- Test plan: no change made here. Owed when convenient: add to the 03.01 row the SPEC-derived oracle, the owner/runtime statement matrix, the concurrency run (threads and processes) and the production-timeout checks.

## Artefacts

Committed with this report: `docs/07-qa/AQP-97-test-report.md`, `tests/acceptance/aqp-97-columns.test.ts`, `tests/acceptance/aqp-97-registry.test.ts`, `tests/acceptance/aqp-97-config-versions.test.ts`.

## Hand-off
- Status: COMPLETE
- Recommendation (G7): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 1 known DEF-003, Sev-4 0); 8 observations
- Jira / GitHub: summary comment on AQP-97 and on PR #32; no Bug or issue created
- Story status: not changed by QA
