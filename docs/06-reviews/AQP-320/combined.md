# Combined security-and-quality review: AQP-320 (STORY-06.03 "Cost details and Lead formula view")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/427 |
| Head reviewed | `73e7d077af93b0bf02fcfadcea779855efabe7d4` (base `master` 3e13b12) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review` (shows formulas, rates and per-row costs, NFR-002) |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-15 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 3 · Info 5 |

## How I read it

- Full diff of all 57 files (`gh pr diff 427`) and the PR description, including "Points for the reviewer" and A-1 to A-9. Full files at the head, from a detached worktree in my scratchpad: `cost-working.ts`, `cost-details-service.ts`, the route, the page, `node-costs.ts`, the four `features/cost-details` files, `calculation-repository.ts` (`findRowWorking`), `row-calculator.ts`, `evaluator.ts`, `lib/decimal.ts`, `calculation-service.ts` (how inputs and outputs are stored), `with-route.ts` (`describeFailure`), `app/error.tsx`, `js-budget-records.ts`, the canary-scan diff, `route-calls.ts`, `calculated-values.ts` and `canary-masters.ts` (`variantsOf`), the seed formulas (`prisma/seed/config/seed-config.ts`).
- Jira AQP-320: AC-1 to AC-9, Dev Context and Testing notes.
- Architecture (`origin/docs/AQP-1-records-r`): §4.9 (the "Not applicable" table, line 622), §6 "Cost details" row (line 941), §8 "one route, one schema" (line 805), UX-01 and UX-34. UX spec SCR-07 and the UX-01 and UX-02 notes. AQP-319 `combined.md` for continuity.
- **Tests run by me:** 20 targeted files, `vitest run` at the head (`cost-working`, service, route, page, screen, architecture, `node-costs-schema`, `internal-form`, `js-budget-records`, `js-budget-routes`, `layer-rules`, `canary-scan-gate`, the review architecture, route and page tests, and the security suites `engineer-import-rule`, `role-matrix`, `strict-schema`, `engineer-refused-before-lookup` and `csrf`). **20 of 20 files, 2,187 of 2,187 tests pass.**
- **Probes (scratch tests in my scratchpad worktree only, not in the PR):** (1) a "Not applicable" row whose formula reads a material operand in an `IF` branch that is not taken (SQR-01). (2) A hand repeat of every formula from operands rounded to 4 decimals, over 400 varied rows (SQR-02).
- I did not run Playwright, `next build` or Docker (memory). CI run 43723040710 at the head: **6 of 6 SUCCESS** (Stages 1 to 11, Stages 1 to 11b, E2E shards 1 to 4). PR is MERGEABLE.

## Security scope (NFR-002): results

| # | Check | Result |
|---|---|---|
| 1a | Engineer on the page | **Verified.** `authorizePage('/estimates/[code]/costs/[slNo]')` is the first statement (`page.tsx:175`), before `params` is awaited. The manifest row is `ADMIN_AND_LEAD`, so every Engineer address is SCR-26 with 403, real or invented. `metadata` is static, and there is no `loading.tsx` (pinned by the architecture test), so no 200 is streamed before `forbidden()`. Page test: "no read is made". |
| 1b | Engineer on the API | **Verified.** The manifest row is `ADMIN_AND_LEAD`. `withRoute` refuses before `params` is parsed. The service refuses again by name (`cost-details-service.ts:79-87`, closed by `assertNever`) before `findFigureBasis`. The role matrix, refused-before-lookup and strict-schema suites pick both rows up from the manifest. |
| 1c | 403 vs 404, and timing | **No oracle.** An Engineer gets the fixed 403 before any read for every ID pair, so neither status nor timing depends on whether the estimate or the part exists. |
| 1d | RSC payload and client bundle | **Verified.** Everything in `features/cost-details` is a server component except `phone-stages.tsx`, which takes no props, holds no text and imports only React. The hidden treatment lines are filtered out before render, so they are not in the flight data. The review tree's link is a plain `<a>` (no prefetch of an RSC payload). The Engineer's workspace has no link: page test "the Engineer's own page is the same with a stored row as without". |
| 1e | Error messages and logs | **Verified.** `WorkingMismatchError`, "no material", "no row" and `required()` all use fixed words with no figure or formula. `withRoute` logs only `errorName` and `errorCode` (`with-route.ts:133-136`). The page's error goes to `app/error.tsx`, which shows only the digest. |
| 1f | Another estimate's part | **Verified.** The part is looked up in `listNodes(estimateId)` only (`findPart`). Another estimate's node is the same 404 as an unknown one, and `findRowWorking` is keyed by this estimate's own calculation ID. Unit, route and PostgreSQL tests. |
| 1g | Out-of-date or never-calculated row | **Verified.** `readFiguresWhenCurrent` is the one read. In `none` and `out-of-date` the record is not read (spies at service, route, page and integration level). The schema's `refine` makes `details` non-null exactly when the state is `current`. |
| 1h | Lead or Admin on a draft | **As specified.** The role matrix (architecture §6) gives A and L at every status. A draft with no calculation is `none`. A draft after an unlock with an unchanged inputs revision is `current`, the same as SCR-06 (AQP-319). |
| 2a | Working from the record only | **Verified.** `buildCostWorking` reads the row's stored `inputs` and `outputs`, the calculation's `masterSnapshot` and the configuration version by `calculation.configVersionId`. The resolver mirrors `row-calculator.ts` field by field (typed and absent numbers as 0, I from the snapshot price, `columnValues: () => []`). The integration test changes a master after the calculation and the working does not change. |
| 2b | "Re-evaluate and compare, else fixed 500" | **Sound.** Outputs are stored as `Decimal.toString()` with `toExpNeg` and `toExpPos` at the limits (`lib/decimal.ts`), so they are never in exponent form and round-trip exactly. Typed inputs match `TYPED_NUMBER_PATTERN`, a subset of `DECIMAL_TEXT`. So exact `equals` is right, with no false 500 on an honest record. Tests: a changed output, a changed operand, a figure for a no-figure line, a missing output, a dearer snapshot price. Design note: SQR-07. |
| 2c | Rounding | **The working is correct, but the screen's claim is too strong:** see SQR-02. |
| 2d | Denial of service | **None.** The work is bounded by the configuration (about 30 row formulas, `MAX_FORMULA_LENGTH`), the plan is cached per version, and only a Lead or Admin can call it. `SL_NO` (`page.tsx:165`) is bounded and linear. |
| 3 | No master dump | **Verified.** `findRowWorking` selects one row's `inputs` and `outputs` and the snapshot. The answer is built only from `working.stages` and the row header, through `strictObject` at every level, and is parsed before it leaves. Tests show no customer name, no unused rate, no other material and no `masterSnapshot` key. The canary's Lead test proves the second canary material is absent from both the page and the API. |
| 4a | ESLint allow-list | **Verified.** `ROW_OUTPUTS_IMPORT` adds `cost-working`. `ENGINEER_VIEW_IMPORTS` adds a `schemas/node-costs` group. `engineer-import-rule.test.ts` plants three spellings of each, and `cost-details-service` is in `SERVICES.blocked`. |
| 4b | `figure-state.ts` the only reader | **Verified.** `READ_OF_FIGURES` now includes `findRowWorking`, and its single call site is pinned. The AQP-319 SQR-04 gap (relation selects and raw SQL) is unchanged and still in the hardening window. |
| 4c | Strict schema, route manifest, role matrix | **Verified.** The page row moves from `planned` to `implemented`, and the API row is added. Both are in `SPEC_ACCESS`, `route-calls.ts` (real-value recipes), `route-loaders.ts` and the composition mocks. The role matrix gains a per-segment fill for `[code]` and `[slNo]`. |
| 5 | Canary scan | **Covers both addresses.** In the Calculate journey (a current calculation exists), the Engineer's call to the API is the fixed 403 and the page is 403. Both are inside the recorded window, which is scanned for every master sentinel and every figure of the record in plain, 2-decimal and both grouped forms (the AQP-319 SQR-03 floors). The new Lead test is a positive control: the formula name and the row's own material are found on both, and the unused material is not. Optional hardening for the new 4-decimal form: SQR-06. |
| 6a | `js-budget-records.ts` | **Correct, with a measurement gap** (SQR-03). One estimate is made once and serves both pages, and a failure is reported per route. The costs page is measured in state `none`. |
| 6b | `navigation.spec.ts` | **Not weakened.** The assertion still compares a non-existent page with a planned page for an Engineer. Only the example moved from costs (now implemented, so 403) to export (still planned). Fragility note: SQR-05. |
| 7 | Accessibility | **Good.** `details` and `summary` are native, the stage total is in the summary, the formulas are text, the blank I has an `sr-only` label, the review link has an `sr-only` row name, and every notice is `role="status"`. With no script, every stage is open. axe at three widths is green in CI (Stage 12). |

## AC conformance

| AC | Implemented in | Tests | Result |
|---|---|---|---|
| AC-1 Six panels; tag, name, formula, working, value | `cost-working.ts`, service, `stage-panel.tsx`, `working-line.tsx` | `cost-working.test.ts` (stage membership by letter), service, screen, route, e2e | **Pass** |
| AC-2 Operands really used, 4 dp, rounding sentence | `operandTextOf`, `toWorkingForm` | `cost-working.test.ts` (AK hand-worked), `internal-form.test.ts` | **Pass**, but the sentence overclaims (SQR-02) |
| AC-3 Flag lines hidden, sentence, still 0 in the response | `hideWhenZero` → `hidden`, `hiddenLinesNote` | `cost-working.test.ts` (7 hidden with no flag), service, screen | **Pass** |
| AC-4 Divide by zero "—", percent as typed | `NO_FIGURE`, `isPercentRate` | `cost-working.test.ts` (BJ, 12%, 2.5%), integration | **Pass** |
| AC-5 "Not applicable": I blank, M/O/AK 0.00 with no worked line, no `Material-*` or I operand | `readsMaterial`, `lookup` line `blank` | `cost-working.test.ts`, service, integration | **Pass for the seed formulas.** Gap for a material operand in an `IF` branch not taken, and the test cannot fail (SQR-01) |
| AC-6 Read-only; O formula as seeded | No control in the folder; `toDisplayForm` | Architecture test (no form control), unit test (O printed as seeded) | **Pass** |
| AC-7 `out-of-date` / `none`: state alone, cleared text, link | `readFiguresWhenCurrent`, schema `refine`, `CLEARED_*` texts (UX wording) | Service, route, page, schema, integration | **Pass** ("Not calculated" wording is A-2, see SQR-07) |
| AC-8 Engineer: no button, 403 fixed body, other estimate 404, canary green | Manifest, `authorizePage`, `withRoute`, service guard, ESLint | Route, page, architecture, security suites, canary journey and Lead control | **Pass** |
| AC-9 360/768/1366, side panel at 1280+, phone stage 1 only, keyboard, axe 0 | `xl:grid`, `PhoneStages`, `details/summary` | `cost-details.spec.ts` (CI green) | **Pass** (A-3, A-4 accepted) |

## Assumptions A-1 to A-9

| Assumption | Judgement |
|---|---|
| A-1 Components in `features/cost-details/` | Accepted. It keeps the review folder free of client code, and the architecture test pins that only the costs page imports the folder. |
| A-2 "Not calculated" wording invented | Reasonable. **ux-expert** to confirm the words (SQR-07). |
| A-3 Phone closes stages 2 to 6 after load | Accepted. It is progressive: nothing is hidden with no script. |
| A-4 Side panel as a left column at 1280+ | Accepted. SCR-07 is its own page. |
| A-5 `*` as `×` in the working only | Accepted. It matches the AC-2 example, and the formula keeps the seeded text (AC-6). |
| A-6 I listed in the stage of its first reader | Accepted. It is derived, not hard-coded. |
| A-7 Singular sentence for 1 hidden line | Accepted. |
| A-8 Stage total from unrounded values; "lines above add to" only on a difference | Accepted. It matches UX-02. |
| A-9 Sl. No shape check, else 404 with no lookup | Accepted (`page.tsx:165`, bounded regex). |

## Findings

| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|---|---|---|---|---|---|---|
| SQR-01 | Minor | `src/lib/estimate/cost-working.ts:222-225`, `:256`; `tests/unit/estimate/cost-working.test.ts:225` | On a "Not applicable" row the worked line is dropped only when the **path taken** read a `Material-*` or I operand (`evaluation.operands`). But `toWorkingForm` replaces **every** reference in the formula, including the branch of an `IF` that did not run. Probe: with `AH = IF(N > 999999, Material-Price-per-kg, …)` on a Not-applicable row, the answer holds `IF(0.2 > 999999, 0, (200 × 100 × 2) / 645)`, which is the hidden entry's 0 served as a material operand. The seed formulas cannot reach this (only M, O and AK read the material, and each reads it on the path taken), so nothing is wrong today. The AC-5 test checks `workings.join(' ')` for `/Material-/`. A working never holds an operand's name, because every name is replaced by its value, so that test cannot fail. | Breaks architecture §4.9 / AC-5 ("leaves `Material-*` and I out of the operands on that row"; "never served") as soon as an Admin edits formulas (EPIC-08). No NFR-002 impact: the viewer is a Lead and the value is a system 0. | One line: decide on the formula, not on the path: `const skipWorking = notApplicable && extractReferences(field.formula).some((r) => r.kind === 'material' \|\| (r.kind === 'field' && r.id === lookup?.id));`. Or have `operandText` print nothing for a material or I reference when `notApplicable`. | Replace the `/Material-/` assertion with a probe like the one above (a configuration whose formula reads a material in a branch not taken). Assert that the line's `working` is `null`, or holds no material operand. |
| SQR-02 | Minor | `src/components/features/cost-details/cost-details-texts.ts:33` (`RULES_WORKING`) | The page says "calculated values to 4 decimals, so repeating the arithmetic gives the figure printed". A hand repeat from 4-decimal operands is 0.01 off the printed 2-decimal figure on about 0.2 % of lines. Probe: 27 of about 12,000 lines over 400 varied rows, including BG (the row's price), O, AV and BE. The UX generator itself allows 0.005 (UX-01), and `RULES_ROUNDING` covers only adding shown figures. | A Lead who checks a line by hand (FR-058's purpose) occasionally finds a cent's difference that the page says cannot happen, most visibly on BG. | Either (a) word it truthfully, for example "…gives the figure printed, or one hundredth from it where a 4-decimal value was rounded" (**ux-expert** owns the words), or (b) where the 4-decimal repeat does not round to the stored figure, print that line's calculated operands at more places (6 is enough in the probe). | A property test over varied rows: evaluate each formula with 4-decimal operands and assert that it equals the printed figure, or that the line is flagged or printed at more places. |
| SQR-03 | Minor | `scripts/lib/js-budget-records.ts:107-110`, `:125-130`; `scripts/check-js-budget.ts:10-12` | Stage 11b opens `/estimates/<code>/costs/1` for a part that was never calculated, so the page is measured in state `none`. The stages, the row box and `PhoneStages` (the page's only client component) are not rendered there. The same shared record now gives the workspace (`/estimates/[code]`) one part where it had none (the result is unchanged at 180,435 B). The script's header still says its only write is "one customer". | The 163,574 B figure is the cleared state, not what a Lead sees. A client component added later to the stage view (for example a copy button) would not be measured. Small today, because `PhoneStages` is a few hundred bytes. | Say in the record's comment and in the test strategy (§10.1) that the costs page is measured in `none`. Track making a calculated record for Stage 11b (it needs a customer, a material and inputs) in the hardening window. Update the header's list of writes. Cross-reference **reviewer-performance**. | `js-budget-records.test.ts`: assert the documented state. A later test can assert that the measured page holds `data-stage`. |
| SQR-04 | Info | `src/server/services/cost-details-service.ts:88-101` | The same three-read race as AQP-319 SQR-02 (basis, then live parts, then the record). If a part is added or the parts are re-numbered between `findFigureBasis` and `listNodes`, a Sl. No can name a node the calculation has no row for. That is the plain "holds no row" error, so a 500 instead of `out-of-date`. A re-numbered tree can also show the old row's working under the new name, for a moment. | Rare and transient. It fails closed. No confidentiality impact. | Fix with AQP-319 SQR-02 in the hardening window: while `current`, find the part by Sl. No among the calculation's own rows (they store `slNo`), or read the three in one `REPEATABLE READ` transaction. | Service test: basis at revision N, `listNodes` returns a part added at N+1. Expect `out-of-date`, not a 500. |
| SQR-05 | Info | `tests/e2e/navigation.spec.ts:237` | The test now relies on `/estimates/<code>/export` still being `planned`. It breaks again when SCR-10 ships, as it did here. | A false red later. | Choose the example from the manifest (`ROUTE_MANIFEST.find(r => r.status === 'planned' && r.kind === 'page')`), or skip when none is left. | n/a |
| SQR-06 | Info | `tests/support/canary-masters.ts:141-150` (`variantsOf`) | The new page prints calculated values at 4 decimals (`2.8260`), a form the scan does not list (plain, 2-decimal and both groupings only). It is not exposed: both addresses are 403 for an Engineer, and a leaked working line would still be caught by the rate and material sentinels it holds. | Defence in depth only. | Add a 4-decimal variant for calculated figures, subject to the SQR-03 (AQP-319) length floors. | `forbiddenCalculated([{a:'2.82604999'}])` lists `2.8260`. |
| SQR-07 | Info | `cost-working.ts:255`; `cost-details-texts.ts:53`, `:23-24` | (1) The rule "must reproduce exactly, else 500" is right and was asked for in Dev Context. Note that any later change to evaluator semantics (a function, a rounding mode or the Decimal precision) would turn every older record's cost details into a permanent 500, even for approved estimates. Worth one line in architecture §4.9 so that change is planned with a record migration or a versioned evaluator. (2) `NOT_APPLICABLE_NOTE` hard-codes "the three lines", which is true only for the seed formulas (see SQR-01). (3) The "Not calculated" wording (A-2) is the developer's. | Future maintenance and wording. | (1) **solution-architect**: note it. (2) Count the lines with no worked line, or say "the lines that read the material". (3) **ux-expert**: confirm A-2. | n/a |
| SQR-08 | Info | whole PR | **Praise.** Allow-list guards at three levels (manifest, `withRoute` and `authorizePage`, and a service `switch` closed by `assertNever`), with spies proving nothing is read. "Cleared" means *not read*, enforced by a schema `refine`. One reader of a figure, pinned by the architecture scan. A self-checking working that refuses a record it cannot explain, with fixed-word errors and logs that carry only the error's name. A strict schema at every level, parsed before it leaves. A canary with both an Engineer journey after Calculate and a Lead positive control. Server components only, with one prop-less client file. A shared hand-worked fixture (`stored-row.ts`) used by the working, service and screen tests. | n/a | n/a | n/a |

No Major findings, so no `tech-debt` issue is raised. SQR-01 to SQR-03 are recorded here for the final review if they are not fixed in this PR.

## Test adequacy (would the tests fail?)

| Fault | Caught by |
|---|---|
| An Engineer reaches the page or the API | Page and route tests (403, no read), role matrix and refused-before-lookup (manifest-driven), service second guard, canary journey after Calculate |
| A figure or working read while `none` or `out-of-date` | Spies at service, route, page and integration level; schema `refine` |
| An extra key or a master record in the answer | `node-costs-schema.test.ts` (plants at every level), service self-parse, unit and canary checks for no unused material, rate or customer |
| A working that does not reproduce its figure | `cost-working.test.ts` (five mismatch cases) |
| A material operand served on a "Not applicable" row | **Only for the seed formulas.** The `/Material-/` assertion cannot fail (SQR-01) |
| A hand repeat that is a cent off | Not tested (SQR-02) |

## Issues for other roles

- **ux-expert:** SQR-02 (the working sentence), SQR-07 (3) (the "Not calculated" wording, A-2).
- **solution-architect:** SQR-07 (1) (the evaluator-change note in §4.9).
- **reviewer-performance (final review):** SQR-03 (Stage 11b measures the costs page in `none`).
- **developer (hardening):** SQR-04 together with AQP-319 SQR-02.

## Recommendation

No Blocker, Critical or Major findings, so the critical-review condition of CLAUDE.md §9 item 2 is met at `73e7d07`. NFR-002 holds: an Engineer cannot reach any figure, rate or formula through the page, the API, the RSC payload, a client bundle, an error, a status difference or timing.

- **Recommended in this PR** (each is a few lines): SQR-01 (decide on the formula's references, and make the AC-5 test able to fail) and the wording half of SQR-02 if ux-expert agrees.
- **Hardening window:** SQR-02 (if not done here), SQR-03 and SQR-04.
- **Info:** SQR-05 to SQR-08.

Mergeable once CI is green on any fix-up head. A re-review is needed only if the fix touches more than `cost-working.ts`, its test and `cost-details-texts.ts`.
