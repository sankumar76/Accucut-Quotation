# Test Report — AQP-106 (STORY-03.02): Formula engine

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `5c2326d` on `feat/AQP-106-formula-engine` (PR #45, `sankumar76/Accucut-Quotation`), plus the QA acceptance tests and the DEF-006 record committed with this report |
| CI | Run 41648163968 on `5c2326d`: success (reference run). The run on the QA commit is recorded in the PR comment |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17 from `compose.dev.yml` as a throwaway Compose project `qa106` on host port 55506 with invented passwords, removed with its volume afterwards; Chromium via Playwright. The machine was loaded |
| Date | 2026-11-03 |
| **Recommendation** | **ACCEPT.** All 9 ACs verified with evidence. One new defect, **DEF-006 (AQP-181, #49), Sev-3**: the rate-name guard (QLT-05) accepts a name such as `Cost-Waste` that reads as two other rate names and a minus sign, after which a stored formula changes meaning in a display round trip. It is not reachable from any R1 screen. Open: Sev-1 0, Sev-2 0, Sev-3 2 (DEF-006 new; DEF-003 known), Sev-4 0. The master decides whether AC-6 ("the round trip is exact") is read to include DEF-006; if it is, this becomes REJECT |

## Summary

The engine does what the nine ACs say. I checked it against hand-worked values and BigInt arithmetic, never against its own output. Precedence, unary minus, 34-digit half-up decimals, ROUND ties away from zero, division by zero as "no figure" that spreads and never throws, IF that runs only its branch, the SUM rules, cycle messages in column letters, the converter and its round trip over all 31 seed formulas, the working trace, the plan cache, server-only, and the 4,000-character and nesting limits all hold. No formula text reaches an error, an issue or a validation result. Ten deliberate faults put into the engine one at a time were each caught by the new tests.

I found one real gap, in the QLT-05 guard that this story was asked to close (#35). It is raised as DEF-006, Sev-3. The full regression is green apart from the known load-sensitive `layer-rules` case (DEF-003 class).

134 QA acceptance tests are added in `tests/acceptance/aqp-106-formula-engine.test.ts`.

## AC Verification Matrix

Test IDs are titles beginning `[AQP-106 AC-n]` in `tests/acceptance/aqp-106-formula-engine.test.ts`, plus the developer's files named. Techniques: BVA boundary-value analysis, EP equivalence partitioning, DT decision table, EG error guessing, ST state (graph) analysis.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | 51 tests; developer `tokenizer`, `parser`, `evaluator` tests | EP, BVA, DT, EG | ✅ Pass | 19 precedence and associativity cases worked by hand, for example `2 + 3 * 4` = 14, `10 - 2 - 3` = 5, `24 / 4 / 2` = 3, `-2 * 3` = -6, `--2` = 2, `2 - -3` = 5, `-(2 + 3) * 2` = -10, with tabs and newlines as spacing. Column letters (A, Z, AA, BZ), rate names, three `Material-*` and two `ExchangeRate-*` operands resolve. Longest-first: `Foam Cost` is one operand even with a rate `Foam`; `Cutting-Rate-per-Sec` is one name; `OH Profit %` is the rate, not column OH. SUM, MIN, MAX, ROUND. IF with each of the six comparisons at equality, larger and smaller (18 cases). A comparison outside the IF condition is refused (`COMPARISON_OUTSIDE_IF`) in 7 positions, including `=` alone and `==`. 22 refusals with exact codes: `ROLLUP(A)`, `sum(A)`, `AVERAGE(A)`, IF with no comparison or with 2 or 4 arguments, SUM of an expression, number, rate or two columns, empty SUM and MIN, ROUND with one argument, a fractional or 21 places, or a column of places; unary plus; `1e5`; `A%`; `ExchangeRate-GBP`; part of a Material name; braces in display form |
| AC-2 | 6 tests; developer `decimal.test.ts`, `rates.test.ts` | BVA, EG | ✅ Pass | `Decimal` is a private clone with precision 34 and ROUND_HALF_UP, and the global decimal.js is unchanged (precision 20). `1/3`, `2/3` and `-2/3` give 34 digits, with the last digit rounded half-up. `0.1 + 0.2` = 0.3. 2,000 seeded random money amounts from -50,000,000.00 to 49,999,999.99 add up through SUM to exactly the BigInt-cents total, and 150 of them through `+`. ROUND: 2.5 gives 3, -2.5 gives -3, 1.005 gives 1.01, -1.005 gives -1.01, 0.125 gives 0.13, and 20 places are kept exactly. Percent: `OH Profit %` typed 12 gives 0.12, 12.5 gives 0.125, `Transport %` and `Inspection & Packing %` are divided once, and `Share%`, `Share % ` and `% Share` are not. No `parseFloat`, `Number(` or `Math.` appears in the evaluator, plan, rates, AST or `decimal.ts`. QLT-16: 1e-40 and 1e40 print as plain digits through `String` and `JSON` |
| AC-3 (negative) | 16 tests | EP, EG | ✅ Pass | `A / 0`, `0 / 0`, `A / (B - B)` and division by zero inside `+`, unary minus, `* 0`, MIN, MAX, ROUND and either side of an IF condition all give `null`; `0 / A` gives 0. SUM is `null` when any row has none, 0 over zero rows. IF runs only the branch it takes: `IF(A > 0, A, B / 0 + C)` gives A, and the resolver is never asked for B or C. In a compiled plan, one output with no figure (C = A / 0) leaves D and F present and E (which reads C) `null`. Nothing throws |
| AC-4 | 6 tests; developer `graph.test.ts`, `plan.test.ts` | ST, DT | ✅ Pass | Fields listed out of dependency order (B reads E, E reads F) are evaluated F, then E, then B. Row formulas come before product formulas. Values are checked by hand: B = 7, D = 20, G = 11. Refused: a row formula that reads a product field (with or without a formula, as BO has none), SUM in a row formula, a product formula that reads a row field without SUM, and SUM of a product field. In each case `compilePlan` throws |
| AC-5 (negative) | 16 tests; developer `validate.test.ts` | EP, EG, ST | ✅ Pass | 10 errors each give the right code and 1-based position and length: unknown column (CA, past the registry), unknown name, unknown function, two operators, missing operator, unclosed bracket, stray closing bracket, incomplete end, stray `#`, trailing point. The message ends `(character n)`. Empty and space-only formulas are refused. Cycles are named in letters: fields at positions 38 and 51 give exactly "These fields refer to each other in a loop: AL → AY → AL." Also tested: a field that reads itself (`B → B`), a three-field loop (`B → D → C → B`, reported once), and loops through IF and through SUM. **Seed:** `analyzeConfiguration(seedConfig.fields, { rateIds: 15 seed IDs })` gives 0 issues; 29 row and 2 product formulas, each row formula after those it reads. A seed with a planted cycle (AL reads AY) is refused by `parseConfigDocument` with `AL → AY → AL` in the message. An unknown rate ID is refused when the rates are known |
| AC-6 | 20 tests; developer `internal-form.test.ts`, `rate-names.test.ts` | DT, EG | ✅ Pass, with **DEF-006 (Sev-3)** | All 31 seed formulas round-trip exactly (internal → display → internal), with no `{{` left in display form. Display → internal → display is exact, spaces included, on 5 awkward texts. Re-lettering: inserting a field in front shows `A + Z * AA` as `B + AA * AB` and leaves the stored text unchanged. A stored reference to a missing field or rate is refused when shown. A rate cannot be named `A`, `Z`, `AB`, `BO`, `XFD`, `ZZZ`, `A-B`, `A B`, `AB 2`, `5`, `1.5`, `SUM`, `IF` or `ROUND`. The 15 seed names are accepted; operand names, duplicates and names with structural characters are refused. `formula-references.ts` is deleted; `prisma/seed/config/seed-config.ts`, `src/lib/fields/document-rules.ts` and `registry.ts` import from `src/lib/formula`, and no file still references the old module. **DEF-006:** `Cost-Waste` (with rates `Cost` and `Waste`) and `AB-Waste` are accepted, and a stored `{{rate:Cost}}-{{rate:Waste}}` then shows as `Cost-Waste` and converts back as the new rate (characterisation test "DEF-006 reproduction") |
| AC-7 | 2 tests; developer `evaluator.test.ts` | EP | ✅ Pass | The working lists each operand once, in order of first use, at stored precision: field 1.23456789012345, field 3, rate 0.12345678 (typed 12.345678, percent applied), and SUM with row count 2 and value 3.75. Recomputing from these operands gives exactly the result. The IF branch that did not run is not listed |
| AC-8 | Repository search; developer `server-only.test.ts`, `server-only-build.test.ts` (two real `next build` runs); lint | DT | ✅ Pass | No `eval(`, `new Function` or `Function(` anywhere in `src`, and `npx eslint .` exits 0. Every file in `src/lib/formula/` starts with `import 'server-only'` (checked file by file). The engine loaded in plain Node throws from `node_modules/server-only`; with `--conditions=react-server` it loads. The client-component fixture build fails naming `server-only` and the server-component control builds (the developer's test passed in both full runs) |
| AC-9 | 1 test; coverage | | ✅ Pass | `src/lib/formula/**` coverage from its unit tests: statements 99.82, branches 99.10, functions 100, lines 99.79 percent (target 95). Through `createPlanCache` with a counting compiler and parser, 50 reads of one version compile once and parse the 31 seed formulas once. A second version compiles once more (62 parses); the cache holds 2 |

## Checks named in the brief

| Check | Result | Evidence |
|-------|--------|----------|
| STD-01: no formula text in errors or logs, no `name` field | ✅ | 12 refused formulas carrying sentinel words (`Qwrtz`, `QQXZ`, `Zorbix`, `987654321`) in unknown names, columns, functions, numbers, places and a 4,000+-character text. `JSON.stringify` of the check result, the thrown error and its message contains none of them. An issue's keys are only `code`, `message`, `position`, `length`, `fieldId`, `cycle`. `FormulaConfigurationError` from `compilePlan` holds no formula text and no bad ID. The developer's logger test (pino line with the error, the issue and the check) passes |
| QLT-16 plain decimal strings | ✅ | See AC-2. Observation OBS-2 below (negative zero) |
| Input limits | ✅ | `MAX_FORMULA_LENGTH` is 4,000: 4,000 characters are read and 4,001 are refused as `TOO_LONG` before parsing. A chain of 2,000 additions (3,999 characters) parses and evaluates to 2000 in under a second, with no stack overflow. Nesting: 99 brackets are read and 100 are refused as `TOO_DEEP`; unary minus the same; 700 nested MIN calls are refused as `TOO_DEEP`, with no stack overflow. See OBS-1 on how the limit counts |
| `rateNameIssues` (QLT-05) | ⚠️ | Column letters, numbers, operators, function names, operand names and duplicates are refused. Combinations with other rate names are not (DEF-006) |
| The developer's change to my AQP-97 test (`--conditions=react-server`) | ✅ keeps what it checks | The diff is one line: the launch flag, with no assertion changed. With the flag, all 7 concurrency and failure tests pass against real PostgreSQL. With the flag removed (a mutation), the 4-process test and the missing-table test fail, because the script then dies at `import 'server-only'` before reaching its own error path. So the flag is needed, and the tests still exercise the real step. The real script with the flag gives "created", then "nothing changed"; without the flag it throws from `server-only` (the README and the script header now give the flagged command) |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| New QA acceptance tests | `npx vitest run tests/acceptance/aqp-106-formula-engine.test.ts` | 134 | 134 | 0 | 0 | about 1 s |
| Full regression, run 1 | `npx vitest run --coverage` (own throwaway Postgres, port 55506) | 1,631 (56 files) | 1,630 | 1 (known) | 0 | 109 s |
| Full regression, run 2 | `npx vitest run` | 1,631 | 1,630 | 1 (the same) | 0 | 102 s |
| The failing file alone | `npx vitest run tests/unit/lint/layer-rules.test.ts` | 67 | 67 | 0 | 0 | |
| Formula coverage | `npx vitest run tests/unit/formula tests/unit/decimal.test.ts --coverage` | 450 | 450 | 0 | 0 | 99.82 / 99.10 / 100 / 99.79 percent |
| Lint | `npx eslint .` (with the new test) | | exit 0 | | | |
| Type-check | `npx tsc --noEmit` (with the new test) | | exit 0 | | | |
| Build | `npx prisma generate && npx next build` | | exit 0 | | | routes `/`, `/_not-found` |
| End to end | `npx playwright test` | 3 | 3 | 0 | 0 | 24.4 s |
| Migrations | `npx prisma migrate deploy`; `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | | applied; exit 0 (no drift) | | | |
| Repository checks | `npx tsx scripts/check-data-files.ts`, `check-licences.ts` | | pass, pass | | | |

**Known load-sensitive failure (not new).** In both full runs the only failure is `tests/unit/lint/layer-rules.test.ts > ... src/lib imports src/server (alias)`, which timed out at 30 s (it took 57 s and 50 s here). It passes alone and in CI. This is DEF-003 (AQP-168, #24) as widened by DL-057. DEF-004 and DEF-005 did not show.

## Mutation checks

Each fault was made in `src`, my test file was run, and the file was restored with `git checkout -- src`. `git status` shows no production file changed.

| # | Fault | New tests failing |
|---|-------|-------------------|
| M1 | `*` and `/` bind as loosely as `+` | 2 |
| M2 | Decimal rounding half-even | 1 |
| M3 | ROUND half-even | 2 |
| M4 | IF evaluates both branches | 2 |
| M5 | Percent rates not divided by 100 | 3 |
| M6 | Row formula may read a product field | 2 |
| M7 | Cycles not reported | 3 |
| M8 | SUM skips a row with no figure | 1 |
| M9 | A comparison outside IF reported with another code | 7 |
| M10 | Nesting limit raised to 1,000 | 1 |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Formula text never reaches a client | NFR-002, CONSTRAINT-02 | server-only per file, plain-Node load, the real build fixture, no eval | ✅ |
| Exact money | FR-027, BR-025 | 34-digit Decimal, BigInt oracle over 2,000 amounts | ✅ |
| Coverage | NFR-025 | 99.8 percent on the formula module | ✅ |
| Performance | NFR-008 (feasibility only) | A 4,000-character formula parses and evaluates in under 1 s; the plan is compiled once per version. NFR-008 itself is story 03.06 | ✅ for this story |
| Security smoke | | No formula text in errors; input length and depth bounded; no stack overflow from 2,000 operators or 700 nested calls | ✅ |
| Accessibility | | No screen in this story | n/a |

## Exploratory Testing

**Charter 1 (30 min): break the name matcher.** Areas: names inside names, names next to letters and numbers, rate names that could be read as something else, and round trips after the rate list changes. **Found DEF-006.** With rates `Cost` and `Waste`, the name `Cost-Waste` passes the guard, and a stored subtraction then displays and converts back as that one rate. The adjacency cases that only appear without spaces (`{{f:A}}2` showing as `A2`) are not grammatical, so they cannot be stored.

**Charter 2 (20 min): hostile grammar.** Covered every refusal code with positions, deep nesting, long chains, `1.`, `.5`, `1e5`, `+A`, `2(A)`, and `IF(A > B > C, ...)`. Nothing else found.

**Charter 3 (15 min): decimals at the edges.** Covered 34-digit division, ties, very small and very large values, and JSON. Found OBS-2.

**Charter 4 (10 min): the seed step after the server-only change.** The README, the script header and both tests use the flag. Running the step without the flag throws from `server-only` (OBS-3).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-006 ([AQP-181](https://sankumar76.atlassian.net/browse/AQP-181), [#49](https://github.com/sankumar76/Accucut-Quotation/issues/49)) | Rate-name guard accepts a name that reads as other rate names and an operator, so a stored formula can change meaning | Sev-3, type Product | New (open) | AC-6; #35 QLT-05 |
| DEF-003 ([AQP-168](https://sankumar76.atlassian.net/browse/AQP-168), [#24](https://github.com/sankumar76/Accucut-Quotation/issues/24)) | Layer-rules test times out under load (class, DL-057) | Sev-3, type Test | Known, open; not counted | regression only |

Open by severity: Sev-1 0, Sev-2 0, Sev-3 2, Sev-4 0. AQP-181 is linked to AQP-106 ("relates to") with labels `ai-delivery`, `aiid-DEF-006`, `agent-qa-engineer`, `sev-3`. GitHub #49 has the labels `bug`, `sev-3`, `ai-delivery`, and the two are cross-linked. Record: `docs/07-qa/defects/DEF-006-rate-name-guard-ignores-other-rate-names.md`.

## Observations (not defects; for the master to route)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | The nesting limit counts the whole formula as one level and a function call as two. So the practical limits are 99 brackets, 99 unary minus signs, or 49 nested function calls. "Nesting 100" in the brief reads as 100 brackets. Both stop abuse; neither is reachable by a real formula | Developer, Sev-4: state the counting rule in `names.ts` or count one level per bracket or call |
| OBS-2 | `ROUND(-0.4, 0)` gives a negative zero. `String()` prints `0`, but `JSON.stringify` prints `"-0"`. A product of 0 and a negative number does the same. Inputs are at least 0, so this is rare in practice | Story 03.03 (storage and export of figures): normalise -0 to 0 |
| OBS-3 | The seed step now fails under plain `npx tsx` (it throws from `server-only`). The README and the script header give the flagged command. The `migrate` one-shot of story 10.04 must use it too | Story 10.04 (Compose `migrate` command); the solution-architect may wish to note it in architecture section 5.6 |
| OBS-4 | `rateNameIssues` accepts `a`, `Zz`, `A1`, `X%` and `Rate.5`. None of them reads as formula text today, so they are safe; noted for the 02.01 screen's wording | 02.01 |

Deferred items named in the brief were not raised: QLT-15, QLT-17 (#48), DeepReadonly (#46), hidden-as-0 (03.03, #48), and ROUND 0 to 20. On the last: negative places are refused today, which matches "0 to 20", and the product owner rules on it for R2.

## Residual Risks / Notes

- I wrote these tests after reading the implementation and the developer's tests. The independence is in the oracle (hand-worked values, BigInt, SPEC text), not in a first reading.
- The per-formula SPEC 7.4 values (SPEC 14 item 2) are story 03.03 and were not tested here.
- The throwaway database `qa106` and its volume were removed. A folder `.qa-scratch/` with emptied probe files is left untracked in the worktree, because this session could not delete files. It is not committed and can be deleted.

## Artefacts

Committed with this report: `docs/07-qa/AQP-106-test-report.md`, `docs/07-qa/defects/DEF-006-rate-name-guard-ignores-other-rate-names.md`, `tests/acceptance/aqp-106-formula-engine.test.ts`.

## Hand-off
- Status: COMPLETE
- Recommendation (G7): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 2 of which DEF-006 is new and DEF-003 known, Sev-4 0); becomes REJECT if master reads AC-6 to include DEF-006
- Jira / GitHub: AQP-181 and #49 created and cross-linked; summary on AQP-106 and PR #45
- Story status: not changed by QA
