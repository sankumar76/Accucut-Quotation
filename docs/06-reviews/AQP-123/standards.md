# Review Report — AQP-123 (STORY-02.04 Exchange Rate Master) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `origin/master...origin/feat/AQP-123-exchange-rate-master` (PR #151; base 051c0b5, 6 commits, 45 files, +2386 / -60) |
| Commit reviewed | 939f32fb4de117dfb4d1f17027b4e087b6f21d05 |
| Date | 2026-11-10 |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/151#pullrequestreview-5837425748 (13 inline comments, submitted as COMMENT, `REVIEW_IDENTITY = single-token`) |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; nine Minor and four Info) |

## Summary
The change follows the rule-book where it matters most. Body and answer of the new route are strict zod objects, the role comes from the manifest (`ADMIN_ONLY`), the two raw SQL statements have no interpolated input, rates are decimal text with `Decimal(18,4)`, the clock is injected through `lib/time`, the audit entry is written with the change's own `tx`, and the columns of the hints are worked out before the transaction opens. There is no new dependency, `any`, cast, non-null assertion, `console`, TODO or lint suppression in any added line. The new fixtures follow the `n.37` pattern. The nine Minor findings are small. Three of them (STD-02, STD-03, STD-04) are items master deferred on GitHub #119 that this PR either touches or passes; STD-07 asks that a deliberate departure from the SQL rules, which architecture §5.1 prescribes, be written down.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 9 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `node node_modules/eslint/bin/eslint.js .` at 939f32f in a detached scratch worktree (installed packages linked in) | exit 0, 0 problems |
| Type-check | `node node_modules/typescript/bin/tsc --noEmit` at 939f32f, after `prisma generate` in the scratch worktree | exit 0, 0 errors |
| Format-check | none configured (no Prettier or EditorConfig; `CLAUDE.md` lists none) | n/a |
| CI | `pull_request_read get_check_runs` | 5 of 5 jobs success on run 42761745140 (Stages 1 to 11, Stage 12 shards 1 to 3, Stages 1 to 11b) |
| Function length (§1, 40 lines) | TypeScript-compiler script over every changed `.ts`/`.tsx`, compared with the same files on master | New in `src/`: `useExchangeRates` 63 lines (STD-01). Older, justified inline: `createMasterRepository` 72, `createMastersService` 88. In `tests/`: `describe` containers (accepted); `createFakeMasterRepository` 63 to 70 and `createSessionHarness` 57 to 61, both already over; `validCallFor` 40 or less to 44 (a `switch` of recipes), noted under STD-01 |
| File length (§1, 400 lines) | `wc -l` on changed files | Largest `src/` file `master-repository.ts` 358 (was 360). `role-matrix.test.ts` held at exactly 400. `aqp-122-qa.spec.ts` 496 (was 495), already over, one line added |
| Complexity (§1, ≤ 10) | read of every new function with branching | Highest about 6 (`change`, `submit`); none over 10 |
| Casts, `any`, markers | search of all added lines for `any`, ` as X`, `!.`, `console.`, `TODO`, `FIXME`, `eslint-disable`, `@ts-`, `debugger`, `.only`, `.skip`, `waitForTimeout` | None (only `as const`) |
| Fixture numbers (ADR-014, `n.37`) | grep of decimal literals in the new test files and in doc comments | Follow `n.37`; the other values (`83.50`, `0.5`, `81.30`, `83.371`, `123456789012.99`) test the format and are fine |
| Dependencies, generated files | file list | No `package.json`, lockfile, `.env*`, data file or generated file; only `src/`, `tests/`, `prisma/` |
| Commits and branch | `git log origin/master..HEAD` | 6 commits, all Conventional with `[AQP-123]` (and sub-task keys); branch `feat/AQP-123-exchange-rate-master`; PR title `AQP-123: STORY-02.04: Exchange Rate Master`; labels `ai-delivery`, `feature`. `1fb8031` (test-only `@one-width` tags) is the commit the story's Dev Context asks for, so it is in scope |
| Secret scan | `gitleaks` not installed on this machine | Not re-run (tooling gap). CI stage 2 (full history) is inside the green "Stages 1 to 11" job. I read the migration, the canary file and the fixtures: no secret-like text |
| Migration | read of `20261110040000_exchange_rates` against the other migrations | Additive, rollback note, CHECKs named `ck_<table>_<rule>`, FK `fk_<table>_<column>`, `REVOKE DELETE, TRUNCATE` then `GRANT SELECT, INSERT, UPDATE`: same shape as `materials`. See STD-07 for the naming departures |

## Focus checks (from the brief)
| Focus | Result |
|-------|--------|
| Layering and source tree | Right: route (`withRoute`) to `masters-service` to `exchange-rate-service` to `exchange-rate-repository`; pure rules in `src/lib/masters/exchange-rates.ts` shared by screen, schema and service (one sentence, one check); the browser file imports no zod (NFR-009). `exchange-rate-repository.ts` is a new file so `master-repository.ts` stays small. No business rule in the panel |
| Security hygiene (§5) | Strict body and answer; `ADMIN_ONLY` row in the manifest, which drives the role, CSRF and strict-schema tests; the two raw statements have no parameter or interpolation; no new library; the three new server files are in the Engineer import rule's blocked lists; canary values have one definition. No finding |
| Error handling (§4, §10) | `FieldValidationError` for a bad value (422 naming the field); damaged configuration fails before any write. One silent branch (STD-06) and a plain `Error` (STD-10) |
| Logging | None added. Nothing to review |
| Dates (§10) | `Clock` from `lib/time`, stored as UTC, shown with `formatIst`; no bare `toLocaleString` |
| Money and rates (§10) | Decimal text, `Decimal(18,4)`, `toFixed(4)`; no JavaScript number holds a rate |
| Column letters (§10) | Derived with `columnOfKey` / `fieldLetter`; two doc comments print "BH" and "BJ" as examples (STD-09) |
| Documentation (§8) | Doc comments on the service, repository, schema, route and hook say why. Architecture §6 needs one phrase (STD-12, architect) |
| Tests (conventions) | Names start with the AC ID and say the behaviour; arrange-act-assert; shared late-failure runner used (no local runner); fixtures invented. Adequacy is reviewer-quality's |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/components/features/masters/use-exchange-rates.ts:99-161` | Coding Standards §1 (functions ≤ 40 lines; justify exceptions inline) | `useExchangeRates` is 63 lines with no inline justification. It holds the typed text and errors, the save flow (`finish`, `submit`) and the wiring of the read. The sibling hooks stay under 40 by splitting. Tests: `tests/support/route-calls.ts` `validCallFor` went from 40 or less to 44 lines (a `switch` of recipes); `createFakeMasterRepository` from 63 to 70 and `createSessionHarness` from 57 to 61 (both already over). | The only new function in `src/` over the limit; the over-long ones in `tests/support` grow by a story each. | Split into `useRateForm()` (typed, errors, `setField`) and `useSaveRates(...)` (`finish`, `submit`), or add the one-line "Over 40 lines on purpose" comment. For the support files, move the exchange recipe and the canary seeding into small helpers (`exchangeRateRecipe()`, `seedCanaryExchangeRates(masters)`). |
| STD-02 | Minor | `src/server/services/audit-events.ts:139-147` | Coding Standards §5 (deny by default); master's R2-01 on #119 (DL-116) | This PR adds an entry to `MASTER_WORDS` and leaves `MASTER_WORDS[objectType]` a plain-object read. R2-01 says to fix it "when the file is next touched". | A stored `object_type` of `toString` or `constructor` returns an inherited function. No input reaches it today. | `Object.hasOwn(MASTER_WORDS, objectType) ? MASTER_WORDS[objectType] : undefined`, or a `Map`; one unit test with `'toString'` expecting `NO_DETAIL`. |
| STD-03 | Minor | `src/server/repositories/master-repository.ts:266-290`; `use-material-master.ts:27`, `materials-client.ts:18`, `options.ts:15` | Coding Standards §1, §3; master's STD-09 on #119 (DL-115, "before STORY-02.04") | The material methods were to be split into `material-repository.ts` before this story, and the three exports used only inside their own file dropped. Neither was done and the Dev Record does not say so. The exchange-rate file was split out instead, which is good. | `master-repository.ts` is 358 lines and 02.02 adds methods again; unsupported exports widen the surface. | Do the split now (the `exchange-rate-repository.ts` shape is the template) and drop the three `export`s, or have master move the due point to 02.02 in #119. |
| STD-04 | Minor | `src/lib/masters/exchange-rates.ts:2,40,44,49`; `src/server/views/schemas/exchange-rates.ts:2,12`; `exchange-rates-panel.tsx:25`; `use-exchange-rates.ts:18-19`; `exchange-rates-slot.tsx:12` | Coding Standards §2 (names reveal intent); AQP-122 STD-04, master's #119 item "due before STORY-02.02" | A rate in rupees is validated with `DEFAULT_VALUE_PATTERN`, `DEFAULT_VALUE_MESSAGE` and `normaliseDefaultValue`, and the tab imports `process-texts` and `process-opener`. This is the third consumer of the process-item names. | The later rename touches more files with each master. | Add the neutral names as aliases in `process-items.ts` (`DECIMAL_TEXT_PATTERN`, `DECIMAL_TEXT_MESSAGE`, `normaliseDecimalText`) and import them here; or add the PR's files to the #119 list. |
| STD-05 | Minor | `src/components/features/masters/exchange-rates-slot.tsx:27-39`; `exchange-rates-panel.tsx:106-119`; `use-exchange-rates.ts:71-96` | Coding Standards §1 (DRY, rule of three) | The load-error block (`ErrorState`, `focusOnMount`, "Try again") exists in `process-results.tsx`, `material-results.tsx`, the panel and the slot. The "read again, then return focus" effect (`wantsFocus`) is in all three master hooks. The slot must not import the panel (NFR-009), so the two copies in this PR cannot share each other, but both can share a tiny component. | A change to the DEF-020 focus rule has to be made four times. | Add `master-load-error.tsx` (`<MasterLoadError title onRetry />`) with no heavy import; use it in slot and panel now; add the hook effect to the #119 extraction list. |
| STD-06 | Minor | `src/server/repositories/exchange-rate-repository.ts:97-102` vs `66-74, 106-114` | Coding Standards §1, §10 (never swallow errors; fail loudly) | `readRows` returns `[]` for a row whose currency is neither USD nor EUR; `selectForUpdate` throws on the same row through `LOCKED_ROWS`. | If the table were damaged, `GET` would show a partial pair while the next `PUT` fails with a `ZodError` 500. The CHECK makes it unlikely, so this is consistency. | Throw a plain `Error` without the value in the message (the rate is Restricted), as `toMaterialRecord` does; or parse both reads with the same schema. |
| STD-07 | Minor | `prisma/schema.prisma:157-171`; `prisma/migrations/20261110040000_exchange_rates/migration.sql:1-15` | Coding Standards §10 SQL (PK `id` UUID; FK `<entity>_id`; `created_at` on every table) | PK is `currency`, FK is `updated_by`, no `created_at`. The columns are those of architecture §5.1, so the design is the architect's; the model comment and migration header do not name the exception. | The next reader "fixes" it or copies it as the pattern. | One sentence in both places: "keyed by currency (two fixed rows); the stamp is `updated_by` / `updated_at`; no `created_at` because the table is created empty and changed in place (architecture 5.1)". Ask the architect to note the exception under §10 SQL. |
| STD-08 | Minor | `src/server/services/masters-service.ts:24`; `tests/support/session-harness.ts:12` | Coding Standards §2 (consistency) | `import type { Clock } from '../../lib/time'` follows the `../repositories` imports; in this file all other `../../lib` imports come first. No ESLint import-order rule exists. In `session-harness.ts`, `./exchange-rate-canary` follows `./fake-masters`. | Noise in the next diff of the block. | Move each line into its group. |
| STD-09 | Minor | `src/lib/fields/lookup.ts:24`; comments at `lookup.ts:5` and `exchange-rates.ts:80` | Coding Standards §1 (unused exports); §10 (column letters) | `letterOfKey` has no caller in `src/`, only `tests/unit/exchange-rates-lib.test.ts:81-95`. Two doc comments print "BH" and "BJ". | A second way to get a letter beside `columnOfKey`; the comments are examples, not code. | Delete `letterOfKey` and read `columnOfKey(...)?.letter` in the tests, or name its first caller in the comment. Write "<rate letter>" in the comments. |
| STD-10 | Info | `src/server/services/exchange-rate-service.ts:80` | Coding Standards §10 (typed errors) | A registry with no field for a hint's key throws a plain `Error`. | None: 500 either way; `toMaterialRecord` and `throttle-repository.ts` do the same. The message names the key and no rate, and the check is before the transaction. | If damaged-configuration faults should carry a code, widen the doc of `ConfigurationError` (`src/lib/errors.ts:113`) and use it. |
| STD-11 | Info | `src/server/services/exchange-rate-service.ts:129`; `src/lib/masters/exchange-rates.ts:31` | Architecture §8 (audit rulings of AQP-74) | **Question 1.** Accept `master.edited` with `object_type` `exchange_rate`: the rule is `<object>.<past participle>`, `master.edited` is confirmed, `object_type` names the master, AQP-122 took the same reading. The AC's `master.exchange_rate.updated` has three parts and "updated" is not in the registry. The fixed `object_id` is the case §8 sends to the architect. | The log is append-only: entries are not renamed later. | Master decides now; the product-owner corrects the wording of AC-4 in Jira; the architect records the fixed ID. |
| STD-12 | Info | `src/server/views/schemas/exchange-rates.ts:39` | Coding Standards §8; Architecture §6 | **Question 2.** `columns` is acceptable: strict output schema (extra keys fail closed), registry letters and labels only (nothing Restricted), Admin-only route, every key checked by the browser reader. Architecture §6 (line 885) says "Rates, stamp". | The contract text is behind the code by one phrase. | Architect: "Rates, stamp, and the registry columns for the hints (letter and name of each rate column and of the price column it feeds)". No code change. |
| STD-13 | Info | `src/components/features/masters/exchange-rate-texts.ts:8-9,15,26-29`; `audit-events.ts:117` | Coding Standards §1 (no magic strings) | **Question 3.** The five sentences meet the conventions: one file, none inside a component, titles without a full stop, same pattern as SCR-11 and Materials; the body text is imported. Wording is the ux-expert's. Two nits: the header calls the state "Nothing to save", the constant says "Nothing was changed" and the Dev Record "Nothing changed"; "Not set yet" is written in `NOT_SET_YET` (client) and `NOT_SET_WORDS` (server). | A rewording of one could miss the other. | Pick one name for the state; add a comment at both literals, or export one from `src/lib/masters/exchange-rates.ts`. |

## Good practice noted (not findings)
- Strict zod body and answer, with the role, CSRF and strict-schema tests picking the route up from the manifest.
- One audit entry in the change's own `tx`; table lock before row lock; the late-failure shared runner used and plants A3 and A4 shown in the PR.
- Columns of the hints worked out before the transaction (QLT-05), found by the developer's own unit test.
- Canary rates have one definition used by the scan, the loader, the in-memory repository and the manifest recipe.
- `auth.setup.ts` got `warmExchangeRatesRoutes` as a helper instead of growing the callback (AQP-122 STD-01 applied).
- The migration copies the `materials` shape and adds a rollback note and two CHECKs that mirror the code.
- Parameterised SQL in the E2E canary loader.

## Issues for other roles
- **master:** decide the event name and the fixed `object_id` (STD-11); rule whether STD-02, STD-03 and STD-04 are done here or moved on #119.
- **product-owner:** correct the event name in AC-4 on AQP-123.
- **solution-architect:** architecture §6 row "Exchange rates" (STD-12); the fixed object ID (STD-11); the §10 SQL exception for a table keyed by a code (STD-07).
- **ux-expert:** the five sentences (STD-13).

## Tooling gaps
`gitleaks` is not installed on this machine, so the secret scan was not repeated (CI stage 2 is the evidence). No format-check command exists.
