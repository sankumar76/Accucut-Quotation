# Consolidated Review — AQP-123 (STORY-02.04: Exchange Rate Master)

| Field | Value |
|-------|-------|
| PR | [#151](https://github.com/sankumar76/Accucut-Quotation/pull/151), head `939f32f` |
| CI on head | Run 42761745140, attempts 1 to 3 green, 5 of 5 checks; NFR-009 path 6:17, 6:05, 5:40, median 6:05 (DL-123 (d), PR comment 6760474950) |
| Review route | Full three reviews (a feature story touching `src/`) |
| Reports | [standards.md](standards.md) (review 5837425748), [quality.md](quality.md) (review 5837957001), [performance.md](performance.md) (review 5837406015) |
| Consolidated by | orchestrator, 2026-11-10 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info |
|----------|---------|---------|----------|-------|-------|------|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 9 | 4 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 1 | 3 | 6 |
| reviewer-performance | APPROVE | 0 | 0 | 0 | 0 | 6 |
| **Distinct (after de-duplication)** | | **0** | **0** | **1** | **12** | **11** |

## Findings (de-duplicated, by severity)

| ID | Severity | Location | Finding | Raised by |
|----|----------|----------|---------|-----------|
| QLT-01 | Major | `src/components/features/masters/use-exchange-rates.ts:60-65, 122-125` | AC-7 (keyboard only), AC-3: `useFocusFirstError` re-runs on every new `errors` object and `setField` always builds a new one, so after a refusal naming both fields focus jumps from USD to EUR after the first keystroke. Typing `84.37` left USD `8` and EUR `88.3714.37` at 360, 768 and 1366 px. Reviewer's fix verified temporarily: new test passes, AC-3 focus tests still pass | quality |
| QLT-02 | Minor | `tests/e2e/canary-scan.spec.ts:93`; `tests/e2e/exchange-rates.spec.ts:163-191, 297-331` | The rates are a single pair: two E2E saves can overwrite the canary pair while the Engineer scan runs (AC-6, BR-003) | quality |
| QLT-03 | Minor | `tests/integration/masters/exchange-rates.test.ts:205-211` | The "midnight IST" test asserts UTC instants only, not the IST date shown | quality |
| QLT-10 | Minor | `tests/e2e/exchange-rates.spec.ts:53-56, 164, 298` | The two saving E2E tests cannot pass on a retry once the first attempt has saved (pair depends only on width) | quality |
| STD-01 | Minor | `use-exchange-rates.ts:99-161` | `useExchangeRates` is 63 lines with no inline justification (§1, 40 lines) | standards |
| STD-02 | Minor | `src/server/services/audit-events.ts:139-147` | `MASTER_WORDS[objectType]` still a plain-object read although this PR touches it (R2-01 on #119, DL-116: fix when next touched) | standards |
| STD-03 | Minor | `src/server/repositories/master-repository.ts:266-290` and callers | Material-repository split was due "before STORY-02.04" (STD-09 on #119, DL-115) and is not done | standards |
| STD-04 | Minor | `src/lib/masters/exchange-rates.ts`, schema, panel, hook, slot | Exchange rate reuses `DEFAULT_VALUE_*` / `process-*` names (§2) | standards |
| STD-05 | Minor | `exchange-rates-slot.tsx:27-39`; `exchange-rates-panel.tsx:106-119`; `use-exchange-rates.ts:71-96` | Load-error block now written four times (rule of three) | standards |
| STD-06 | Minor | `src/server/repositories/exchange-rate-repository.ts:97-102` | `readRows` silently drops a row that is neither USD nor EUR, while `selectForUpdate` throws on it (§10, fail loudly) | standards |
| STD-07 | Minor | `prisma/schema.prisma:157-171`; migration `20261110040000_exchange_rates` | Table departs from §10 SQL conventions (PK `currency`, FK `updated_by`, no `created_at`) as architecture §5.1 specifies; the exception is not written down | standards |
| STD-08 | Minor | `src/server/services/masters-service.ts:24`; `tests/support/session-harness.ts:12` | Import order | standards |
| STD-09 | Minor | `src/lib/fields/lookup.ts:24` | `letterOfKey` has no caller in `src/`; two comments print "BH"/"BJ" | standards |
| STD-11 = QLT-04 | Info | `exchange-rate-service.ts:129` | **Question 1:** keep `master.edited` with `object_type` `exchange_rate` (architecture §8, AQP-74 ruling); the product-owner amends AC-4's wording; the architect records the fixed `object_id` | standards, quality |
| STD-12 = QLT-05 = PRF-06 | Info | `src/server/views/schemas/exchange-rates.ts:39` | **Question 2:** `columns` is acceptable (strict schema, no Restricted data, 254 B of 351 B); the architect adds it to the architecture §6 row | all three |
| STD-13 = QLT-06 | Info | `exchange-rate-texts.ts` | **Question 3:** the five state sentences meet the conventions; two edge cases where a sentence can be untrue go to the ux-expert | standards, quality |
| QLT-07 = PRF-05 | Info | `use-exchange-rates.ts:128-135` | On a 200 the PUT answer is discarded and the pair re-read by GET (one cheap extra request per save) | quality, performance |
| STD-10 | Info | `exchange-rate-service.ts:80` | Plain `Error` for a missing registry field (500 either way; existing pattern) | standards |
| QLT-08 | Info | `tests/integration/masters/exchange-rates.test.ts:188, 213-218` | Test hygiene: a Lead named "Second Admin"; rename test residue | quality |
| QLT-09 | Info | service, repository, migration | Good practice: lock order, columns resolved before the transaction, one rule source with a DB CHECK | quality |
| PRF-01 | Info | `masters-screen.tsx:33` | Panel is lazy; `/masters/materials` +308 B, under the +1,500 B tripwire; closes #121 for 02.04 | performance |
| PRF-02 | Info | `tests/e2e/exchange-rates.spec.ts:18` | Story's own CI cost about +12 s (3 %) of the path; the rest is runner variance and the RISK-023 trend | performance |
| PRF-03 | Info | `tests/e2e/auth.setup.ts:104` | `warmExchangeRatesRoutes` adds about 1.6 s per shard to the serial set-up (within noise) | performance |
| PRF-04 | Info | migration | Two-row table, no index needed; GET 3-4 statements, PUT 10-11; lock blocks writers only | performance |

## Plants and checks (reviewer-quality, throwaway PostgreSQL)

- **A3** (audit entry in a second transaction, first save): fails the create test, 1 of 26. **A4** (later save): fails the edit test, 1 of 26. #130 instruction met.
- Table lock removed: the concurrency test fails 3 of 3. DEF-020 guard removed: the focus test fails at 360, 768 and 1366 px.
- Commit `1fb8031` (`@one-width`): tags exactly the five tests test strategy §10.5 lists; no assertion weakened.
- Integration 26 of 26; story unit, security and guard tests 1,090 of 1,090.

## For master (G6)

Zero Blocker and Critical; one Major open (QLT-01, keyboard entry broken after a two-field refusal). Routing questions: the three developer questions (answers above, for product-owner, architect and ux-expert), STD-02 and STD-03 (items master scheduled "before 02.04"), STD-07 (architect records the exception), and the CI path median 6:05 against RISK-023.
