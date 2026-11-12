# Review Report — AQP-142 (STORY-02.02 Customers) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-142-customers` (PR #297; story's own changes read as `b710741..efcf768`, 71 files, +5,061 / -51; the branch took `master` b710741 by merge commit a3521c7, `master` is now 6b1883f and the PR is BEHIND) |
| Commit reviewed | efcf768e3148386167c42da0017d7439e2651ea9 |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (one Major). GitHub review submitted as COMMENT (`REVIEW_IDENTITY = single-token`); label `review:standards-changes-requested`. |

## Summary

The story is clean against the tooling gates (ESLint and `tsc` both exit 0) and follows the layering, the audit rules (DL-155, DL-165), the list-hook rule (DL-153) and the load-error wording (DL-169, ux-spec v0.23) closely. SQL is parameterised with explicit columns, schemas are strict, the Engineer-reachable route returns IDs and names only, and test data is invented. The one finding that must be fixed is a size-rule breach: `useCustomerEdit` is 88 lines with no inline justification (STD-01). Eight Minor items are cheap consistency, documentation and dead-code fixes; the deviation in the JS budget script is accepted, with one follow-up on its `--base-url` path (STD-03).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 8 |
| Info | 2 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint .` (developer worktree `agent-a0b3fcd9a9e09301f`, head efcf768) | exit 0, no problems |
| Type-check | `npx tsc --noEmit` (same worktree) | exit 0, no errors |
| Format check | none configured (no Prettier step in the repo; the PR says the same) | n/a |
| Tests | not re-run by this reviewer | G5 CI run 43170187169: 5 of 5; unit 3,302 (+117), full 5,786 (+237), E2E 861 (+53), skipped 24 |
| Risky-construct scan of added lines | grep for `any`, `!` assertions, `console.*`, `eslint-disable`, `@ts-*`, `debugger`, `.only`, `.skip`, TODO/FIXME, `waitForTimeout`, `setTimeout` | none in `src/` or `scripts/`; test-only `as` casts noted in STD-06 |
| Function and file size | awk scan of every new or changed file in `src/` and `scripts/` | two functions over 40 lines (STD-01, STD-02); none over 400 lines per file (largest: `customer-service.ts` 268) |
| Secrets and personal data | regex scan of added lines for e-mail addresses and phone numbers | invented only (`example.test`, `+99 555 …`, `name@company.com`, zero-prefixed UUIDs) |
| Version control | `git log b710741..efcf768` | Conventional Commits with `[AQP-142]`, branch `feat/AQP-142-customers`, PR title `AQP-142: STORY-02.02: Customers`; merge commit a3521c7 carries the default message; no generated files or secrets |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `src/components/features/masters/use-customer-edit.ts:82-169` | Coding Standards §1 (functions ≤ 40 lines, justify exceptions inline), §10 | `useCustomerEdit` is 88 lines with no "Over 40 lines on purpose" comment; it holds eight pieces of state, the save flow with three outcomes, the reset dialog wiring and the focus rules. The two over-40 functions already on `master` (`master-repository.ts:101`, `masters-service.ts:229`) both say why. | The hardest function of the story to review and to change; the size rule is the one the project enforces by review because ESLint has no `max-lines-per-function`. | Split along the existing seams: `useCustomerSave(...)` (save, `failure`, `submitting`, `saveFocusRequest`, the focus effect) and keep `useCustomerEdit` as the composition of fields, rates, save and `useResetDialog`. Or add the justification comment if it must stay whole. |
| STD-02 | Minor | `src/server/repositories/customer-repository.ts:177-244` | Coding Standards §1 | `createCustomerMethods` is 68 lines (flat object of eight methods) with no inline justification. | Same rule as STD-01; precedent shows the comment is how an accepted exception is recorded. | Add the one-line comment as in `master-repository.ts:101`, or lift the `listCustomers` statement and the `updateCustomerDetails` body into named functions like `ratesOf` and `setRates`. |
| STD-03 | Minor | `scripts/check-js-budget.ts:78` (Usage block, lines 13-17) | Coding Standards §8, §5; AQP-169 STD-05 | `makeRecordPaths` runs on every invocation including `--base-url`, so a check pointed at a running portal signs in with the measurement credentials and POSTs a customer; the Usage text still describes `--base-url` as "use a server that is already running" and does not say the check now writes. | A customer cannot be deleted by the runtime role and its audit entry is append-only, so a run against a shared portal leaves a permanent record. CI is unaffected (option unused). | Say in Usage that `--base-url` must be a throwaway portal; and skip the record (let the route fail with its reason) when `--base-url` is not loopback, or require an explicit flag. Raise to Major if anything outside CI ever passes `--base-url`. |
| STD-04 | Minor | `src/components/features/masters/customer-form-dialog.tsx:40, 117` | Dead code (checklist 11) | `onClose` is passed to `CustomerForm` and typed in `FormProps`, but neither `CustomerForm` nor `useCustomerForm({ onSaved })` reads it. | Suggests the form closes itself; misleads the next reader. | `type FormProps = Pick<CustomerFormDialogProps, 'onSaved'>;` and `<CustomerForm onSaved={onSaved} />`. |
| STD-05 | Minor | `src/components/features/masters/customer-texts.ts:13` | Coding Standards §8; checklist 11 (TODO without a ticket) | The header calls the add, save, reset and failed-write sentences "the developer's proposal ... for the ux-expert to rule on". No ruling found: ux-spec v0.23 has no SCR-12 "final words"; the Dev Record says "Follow-ups: none opened". | An open decision lives only in a comment and will read as settled after merge. | Cite the ruling, or open a `follow-up` GitHub issue (SCR-12 final words, ux-expert) and reference it here and in the Dev Record. No code change to the sentences. |
| STD-06 | Minor | `tests/integration/masters/customers.test.ts:114, 167, 257-263`; `tests/unit/customers-routes.test.ts:231`; `tests/unit/masters-service-customers.test.ts:90` | Coding Standards §10 (no `as` casts; zod for external data), §6 | Audit `before` / `after` read through `as { rates: ... }` and `as { contact: string[] }` casts. No other masters integration test does this. | A wrong shape surfaces as a vague property error, and the cast bypasses the strict shape that already exists. | One helper in `customers-support.ts`: `export const customerSide = (side: unknown) => MASTER_SHAPES.customer.parse(side);` and use `customerSide(entry.after).rates`. |
| STD-07 | Minor | `src/lib/masters/customers-client.ts:73-74` | Coding Standards §10 | `toRate` guards with `.some(typeof !== 'string')`, which does not narrow, then coerces each part with `String(...)`. Every other parser in the file narrows by `typeof`. | Harmless today; reads as if a non-string could reach it. | Narrow in place with `typeof` per part, then return the parts directly (snippet in the PR comment). |
| STD-08 | Minor | `src/lib/masters/customers.ts:73, 79, 86, 93`; `src/lib/masters/customers-client.ts:63, 77` | Coding Standards §8 | Exported `customerNameProblem`, `phoneProblem`, `emailProblem`, `addressProblem`, `toCustomerSummaryRow`, `toCustomerRow` have no doc comment. | These carry the AC-1 limits and the e-mail rule the server schema reuses. | One line each. |
| STD-09 | Minor | `src/server/repositories/master-repository.ts:5`; `tests/support/session-harness.ts:9-11` | Coding Standards §2 (consistency) | `./customer-repository` is inserted after `./decimal-text`; `./fake-customers` sits before `./fake-auth-repositories`. Surrounding imports are alphabetical; ESLint has no import-order rule. | Cosmetic. | Move the two import lines. |
| STD-10 | Info | `src/components/features/masters/use-customers.ts:30-33` | Coding Standards §1 (rule of three) | `filterCustomersByName` has the same body as `filterByName` in `use-process-master.ts:28-31`. | Two copies are acceptable (Materials filters two fields). | When a third master filters by `name` alone, extract `filterByName<T extends { readonly name: string }>` next to `useMasterList`. Praise: the list body is `useMasterList` (DL-153), held by `customers-source-rules.test.ts` with a planted copy that proves the guard can fail. |
| STD-11 | Info (praise) | `src/server/services/customer-service.ts:181, 204, 228` | DL-155, DL-165, AC-6 | All three `audit.record(tx, ...)` calls use the change's transaction; the lock order is documented; contact field names only, never values; no-op save and 0-rate reset return before any write. | n/a | None. |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`use-customer-edit.ts:82`)
```ts
export function useCustomerEdit(initial: CustomerRow, saveButton: RefObject<HTMLButtonElement | null>) {
  // ... 88 lines: 8 useState, adopt, setField, setRate, save (3 outcomes), onReset, onResetDone, onCloseAutoFocus
}
```
**Suggested**
```ts
function useCustomerSave(customer, values, inputs, adopt, showErrors, saveButton) { /* save, failure, submitting, saveFocusRequest + effect */ }
export function useCustomerEdit(initial, saveButton) { /* fields, rates, useCustomerSave(...), useResetDialog() */ }
```

### STD-07
**Current**
```ts
if ([processItemId, name, unit, defaultValue, own].some((part) => typeof part !== 'string')) return null;
return { processItemId: String(processItemId), name: String(name), unit: String(unit), defaultValue: String(defaultValue), value: String(own) };
```
**Suggested**
```ts
if (typeof processItemId !== 'string' || typeof name !== 'string' || typeof unit !== 'string' || typeof defaultValue !== 'string' || typeof own !== 'string') return null;
return { processItemId, name, unit, defaultValue, value: own };
```

### STD-06
**Suggested** (`tests/integration/masters/customers-support.ts`)
```ts
import { MASTER_SHAPES } from '@/server/services/audit-events';
export const customerSide = (side: unknown) => MASTER_SHAPES.customer.parse(side);
```
</details>

## Reviewer-specific tables

Rules the brief named, checked against the diff:

| Rule | Result | Evidence |
|------|--------|----------|
| DL-153 (list hook on shared `useMasterList`) | Met | `use-customers.ts:44` calls `useMasterList` once with `readList: listCustomers`; `useReadAgain` for focus; no own items, query, status, skeleton or refresh; `customers-source-rules.test.ts` holds it for every `customer-*` file |
| DL-155 (#218 `customer` audit shape) | Met | `MASTER_SHAPES.customer` strict `{ name, contact, rates }`; `MASTER_WORDS.customer` added with `satisfies`; `masterState` union extended; `customers-audit-events.test.ts` |
| DL-165 (audit in the change's transaction) | Met | `audit.record(tx, …)` at `customer-service.ts:181, 204, 228`; the item sync in `masters-service.ts` adds no entry of its own |
| DL-169 / ux-spec v0.23 | Met | `CUSTOMERS_SAVED_NOT_SHOWN_BODY` only while a success notice is on the page; `FAILED_WRITE_KEEPS_FORM_BODY` and `FAILED_WRITE_BODY` never say "Nothing was changed."; `customers-focus.spec.ts` asserts it |
| Layering (architecture §4.1, §4.9, §10) | Met | repository, service, `withRoute` routes, views schemas; `customer-repository.ts` imports no other method file; the shared files change by a few lines |
| SQL standards (§10) | Met | Prisma Migrate migration, `snake_case` plural tables, `uq_`/`idx_` names, `Decimal(18,4)`, `timestamptz` audit columns, explicit columns, bound parameters, grants stated |

## Previous Findings (re-review only)

Not applicable (round 1).

## Notes for other roles

- **Planned, not counted:** `tests/e2e/masters-table-actions.spec.ts` (header wording "UX spec v0.19" and the Customers entry) and the `tests/security/engineer-import-rule.test.ts` header ("a customer, material or exchange-rate reader" is now stale for customers) are to be re-committed after #222 merges, per master's overlap ruling.
- **For reviewer-quality / reviewer-performance (cross-reference only):** the `customer-rates-table.tsx` row header re-styles `TableHead` with a long class override to look like a cell; the Process Master lock taken by every customer change (PRF-01) serialises customer edits against item adds. Both are in those reviewers' lanes.
- **CI path:** 6:37 against the 5:30 median trigger is recorded in the PR as a measurement; not a standards matter.

---

## Round 2 — new diff `efcf768..b9f36fa` (31 files, +405 / -178)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 |
| Commit reviewed | b9f36fa03711fcec765159ee08f1129368d58ec2 (F1 fix round: 18ea370 JS budget, 580ba03 review round F1 and the amended AC-2, b9f36fa master's header line in `engineer-import-rule.test.ts`) |
| Date | 2026-11-12 |
| Basis | master's G6 CONDITIONAL GO (DL-172, PR comment 6818172998); DL-177 (AC-2 percent rates take up to 2 decimals); ux-spec v0.24 and v0.25 (read from the working copy at v0.25) |
| **Verdict** | **APPROVE WITH COMMENTS** (one new Minor). GitHub review 5872361768 submitted as COMMENT; label `review:standards-approved`. |

### Checks run

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint .` (developer worktree, head b9f36fa) | exit 0, no problems |
| Type-check | `npx tsc --noEmit` | exit 0, no errors |
| Risky-construct scan of the new diff | `any`, `!`, `console.*`, `eslint-disable`, `@ts-*`, TODO, `.only`, `waitForTimeout`, `as {` | none (grep hits were words inside comments and strings) |
| Function size | awk scan of the new or changed files | `ResetBody` 45 lines, unjustified (STD-12). `useCustomerEdit` 28, `useCustomerFields` 29, `useCustomerSave` 40. `createCustomerMethods` justified |
| CI (not re-run by me) | run 43191052265 | 5 of 5 per the brief |

### Previous Findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Major | **Fixed** | `use-customer-edit.ts`: `useCustomerEdit` 28 lines (166-193) over `useCustomerFields` (135-163) and `useCustomerSave` (89-128, exactly 40) with a documented `SaveContext`; behaviour unchanged in the diff |
| STD-02 | Minor | **Fixed** | "Over 40 lines on purpose" comment above `createCustomerMethods`, with reason (nine methods). Wording nit, no action: the `listCustomers` SQL is still inline |
| STD-03 | Minor | **Fixed** | `check-js-budget.ts`: records only when `given === undefined` or `--make-records`; header and Usage say it is the one writer and that the audit entry cannot be removed; `js-budget.test.ts` counts POSTs (1 with the flag, 0 without) and checks the failing dynamic row's reason |
| STD-04 | Minor | **Fixed** | `FormProps` is `Pick<..., 'onSaved'>`; `onClose` no longer passed |
| STD-05 | Minor | **Fixed** | `customer-texts.ts` header cites ux-spec v0.24 "The Customers words: final words"; unreachable `customerCreatedNotice` and `?added=1` removed, with `customers-error-pages.test.ts` guarding it |
| STD-06 | Minor | **Fixed** | `tests/support/customer-audit-side.ts` (`customerSide`, `MASTER_SHAPES.customer.parse`); no `as {` left in the three files |
| STD-07 | Minor | **Fixed** | `toRate` narrows with `typeof`, no `String()` |
| STD-08 | Minor | **Fixed** | doc comments on `customerNameProblem`, `phoneProblem`, `emailProblem`, `addressProblem`, `toCustomerSummaryRow`, `toCustomerRow`; the limits quoted match the constants |
| STD-09 | Minor | **Fixed** | `./customer-repository` first in `master-repository.ts`; `./fake-customers` after `./fake-audit` in `session-harness.ts` |
| STD-10 | Info | Acknowledged | no action |
| STD-11 | Info | Stands | |

### New findings

| ID | Severity | File:line | Rule | Issue | Suggested fix |
|----|----------|-----------|------|-------|---------------|
| STD-12 | Minor | `src/components/features/masters/customer-reset-dialog.tsx:68-112` | Coding Standards §1 | `ResetBody` is 45 lines (33 before the v0.25 paragraphs) with no inline justification | Lift the description block (first paragraph, `<ul>`, `RESET_TYPED_NOTE`) into a small `ResetDescription` component, or add the "Over 40 lines on purpose" comment |

### User-visible messages against ux-spec v0.24 and v0.25

Compared string by string with `customer-texts.ts`, `master-rules.ts` and the components. All match.

| Spec | Words | Code | Result |
|------|-------|------|--------|
| v0.24 load error, edit page | Title `We could not load this customer`, header `Customers`, standard sentence, own `error.tsx` under `[id]` | `CUSTOMER_PAGE_ERROR_TITLE`, `CustomerLoadError` (header `CUSTOMERS_TITLE`, `ErrorState` default sentence), `[id]/error.tsx` | Match; `customers-error-pages.test.ts` asserts title, sentence, Try again, and that the list title is absent |
| v0.24 load error, list | `We could not load customers` | unchanged | Match |
| v0.24 Added (edit page, `?added=1`) | remove if no flow sets it | removed (`customerCreatedNotice`, `useSearchParams`, `useForgetAddedFlag`) | Match |
| v0.25 hint | `Percent rates are typed as plain numbers: 12 means 12%, 12.5 means 12.5%` | `RATES_HINT`, identical, no full stop | Match |
| v0.25 rate message, any rate | `Enter a number, 0 or more, with up to 2 decimals.` | `DECIMAL_TEXT_MESSAGE`; `rateProblem(value)` has no unit branch; server schema uses the same constant | Match |
| v0.25 Reset paragraph 1, none differ | `All N rates already equal the current Process master values, so no saved value will be replaced.` | `resetDescription` | Match |
| v0.25 Reset paragraph 1, some differ | `All N rates return to the current Process master values. The M values this customer has now are replaced:` ("value ... is" for one) | `resetDescription` | Match |
| v0.25 Reset paragraph 2, always | `A rate value you have typed on this page and not yet saved is replaced too. The details (name, phone, e-mail, address) stay as typed.` | `RESET_TYPED_NOTE`, shown in every case, same `AlertDialogDescription` as paragraph 1 and the list | Match |
| v0.25 notice, none replaced | Title `<name> is already at the defaults.`, sentence `Every saved rate already equals its current default, so no saved value was replaced. The rate boxes show the defaults.` | `resetNotice(name, 0)` | Match |
| v0.25 notice, N replaced | `<name> was reset to the defaults. N rates were replaced.` | unchanged | Match |

Tests asserting them: `tests/unit/customers-texts.test.ts`, `tests/unit/customers-error-pages.test.ts`, `tests/e2e/customers.spec.ts` (accessible description, zero notice, typed rate replaced and phone kept).

### Notes

- **Planned, not counted:** at b9f36fa `tests/e2e/masters-table-actions.spec.ts` is master's version, so the Customers entry (AC-8, Jira Dev Context D) is absent until the post-#222 alignment commit. The same commit carries the `engineer-import-rule.test.ts` reword (QLT-06). The Customers table-actions entry must be back before G7 and the merge.
- **Process slip by this reviewer (corrected):** when applying `review:standards-approved` I replaced the PR's whole label set with a list that did not include `review:performance-approved` and `review:quality-changes-requested`, then re-applied both. If the quality reviewer changed its label in that window, check it.
- **For other lanes (cross-reference only):** PRF-06 (first-load JS of `/masters/customers/[id]` +3,471 B) is reviewer-performance's.
