# Consolidated review: AQP-142 (STORY-02.02 Customers), PR #297

| Field | Value |
|---|---|
| Story | AQP-142 (STORY-02.02), Jira In Review |
| PR / head | #297 at efcf768 (`feat/AQP-142-customers`; took `master` b710741 by GitHub merge commit a3521c7) |
| Route | Full three-reviewer route |
| CI (G5) | 43170187169, 5 of 5; against `master` 6b1883f push run 43169697211: unit 3,302 (+117), full 5,786 (+237), E2E 292 + 291 + 278 = 861 (+53), skipped 24 (+0); JS `/masters/customers` 176,675, `/masters/customers/[id]` 177,269; path 6:37 |
| Pending outside the reviews | Overlap step after #222 merges (master's ruling in the DL-168 hand-off): `tests/e2e/masters-table-actions.spec.ts` and the `engineer-import-rule.test.ts` header |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-standards | REQUEST CHANGES | 0 | 0 | 1 | 8 | 2 | `standards.md`, Jira 11597 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 1 | 4 | 3 | `quality.md`, review 5870698558, Jira 11608 |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 1 | 1 | 3 | `performance.md`, Jira 11600 |
| **Total (before de-duplication)** | | **0** | **0** | **3** | **13** | **8** | |

After de-duplication (STD-03 = QLT-05, with PRF-04 as its cost reading): **0 Blocker, 0 Critical, 3 Major, 12 Minor, 8 Info.**

## Findings (de-duplicated, sorted by severity)

| ID | Severity | Where | Finding | Proposed fix / owner |
|---|---|---|---|---|
| QLT-01 | **Major** | `tests/e2e/customers-focus.spec.ts:131` | The failed-read focus test does not catch control A1 (focus returned to the opener). On SCR-12 the opener "Add customer" stays visible, so A1 is invisible to the current assertion. Plants: #314 A1 green (not caught), #315 A2 red; stricter assertion #322 green, and under A1 #323 red at 3 widths | Developer: adopt the tested stricter assertion (hold the failing read until the dialog closes; only the error title takes focus afterwards); prove with A1 re-planted |
| STD-01 | **Major** | `use-customer-edit.ts:82-169` | `useCustomerEdit` is 88 lines with no inline justification (Coding Standards §1, §10) | Developer: split, or justify inline |
| PRF-01 | **Major** | CI path | 6:37 on the first attempt vs 5:14 / 5:15 on `master`; about +19 to +28 s from the 53 new E2E instances, the rest host draw and build cache. A median of five is needed (test strategy §10.5 item 5, orchestrator). After merge `master` is estimated at about 5:40, over 5:30. DL-151 (4)'s order (enabler before AQP-142's G6) was not kept | Master: rule on holding vs proceeding; the median runs on the merging head; the nightly reading (DL-151) and the fourth-shard step (solution-architect, product-manager) |
| STD-03 / QLT-05 | Minor | `scripts/check-js-budget.ts:78` | With `--base-url`, the size check now writes a customer and an audit entry against any host, and the usage text does not say so. Cost in CI is nil (PRF-04: stage 11b 3.2 s either way) | Developer: document it in the usage text, or restrict it |
| STD-02 | Minor | `customer-repository.ts:177` | `createCustomerMethods` is 68 lines, no justification | Developer |
| STD-04 | Minor | `customer-form-dialog.tsx:117` | `onClose` passed to `CustomerForm` but never used | Developer |
| STD-05 | Minor | `customer-texts.ts:13` | Comment leaves SCR-12 sentences "for the ux-expert to rule on". ux-spec v0.23 §6.0 has since ruled (SCR-12 uses the saved-but-not-shown sentence) | Developer: update the comment to cite v0.23 |
| STD-06 | Minor | `customers.test.ts:114` and others | Audit JSON read through `as` casts | Developer: zod helper |
| STD-07 | Minor | `customers-client.ts:74` | `String()` coercion where `typeof` narrowing would do | Developer |
| STD-08 | Minor | `customers.ts:73` and others | Six exported functions without doc comments | Developer |
| STD-09 | Minor | `master-repository.ts:5`, `session-harness.ts:9-11` | Import order | Developer |
| QLT-02 | Minor | edit page | Browser Back after a save can show the pre-save page (documented Next.js behaviour, not reproduced); `router.refresh()` after save/reset | Developer |
| QLT-03 | Minor | edit page | `?added=1` path never reached; a hand-typed `?added=1` shows a false "was added" notice | Developer |
| QLT-04 | Minor | API vs form | API checks the 100-character limit on the raw text, the form on the cleaned name that is stored | Developer: validate the stored (cleaned) form in both |
| PRF-02 | Minor | NFR-011 | PRD gives no customer count; list unbounded (assumed 500 customers, 50 items: fine) | Product-manager |
| STD-10 | Info | `use-customers.ts:30` | `filterCustomersByName` duplicates Process's filter; extract at the third copy | None now |
| STD-11 | Info | `customer-service.ts:181` | Praise: audit in the change's transaction | None |
| QLT-06 | Info | `tests/security/engineer-import-rule.test.ts` header | "a customer reader" stale (also STD planned item); not a weakening | Overlap step after #222 |
| QLT-07 | Info | rates | Process percent defaults allow decimals; customer percent rates must be whole | Open question: product-owner |
| QLT-08 | Info | | Good practice noted | None |
| PRF-03 | Info | customer writes | Every write takes the `process_items` table lock, including no-op saves; harmless at one Admin | None |
| PRF-04 | Info | JS-budget record maker | No measurable CI cost | None (see STD-03 / QLT-05) |
| PRF-05 | Info | migration | One redundant index on `customer_rates(customer_id)` | Developer, optional |

## Cross-cutting
- Rules met by all three reviewers' reading: DL-153 (shared `useMasterList`), DL-155 (`customer` audit shape), DL-165 (AQP-237 transaction rule), DL-169 / ux-spec v0.23 (no QLT-01 copy on SCR-12).
- Follow-up suggested by reviewer-quality: the shared failed-read focus checks on other master screens (#244's slow-read tests, `expectErrorTitleHoldsFocus`) have the same blind spot for dialogs opened by an "Add" button.
- Control branches kept (delivery lead deletes before G8): `control/AQP-142-qlt-*` (#314, #315, #317, #318, #322, #323).
