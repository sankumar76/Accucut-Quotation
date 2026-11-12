# Review Report — AQP-142 (STORY-02.02 Customers) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-142-customers` (PR #297; the story's own diff is `b710741..efcf768`, 71 files, +5,061 / -51) |
| Commit reviewed | efcf768e3148386167c42da0017d7439e2651ea9 |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (1 Major) |

## Summary

The server side is correct and well built:
- **Schema and constraints.** The two tables, the case-insensitive unique index with the `customer-name` mapping placed before the bare `name`, the CHECKs and the grants all match architecture §5.1 and the story's section B.
- **One transaction per change.** Each create, edit and reset is a single transaction. It takes the Process Master table lock first and then the customer row (`FOR UPDATE`), and records its audit entry in the same `tx` (DL-165).
- **Audit shape.** The `{ name, contact, rates }` shape follows DL-155: contact field names only, only the changed rates in table order, and no entry for a change of nothing.
- **AC-4 sync.** The item add and delete reach every customer inside the item's own transaction, in one statement each.
- **Shared list body.** The list uses the shared `useMasterList` (DL-153). After a saved change, a failed re-read shows the ux-spec v0.23 sentence (DL-169).
- **Tests.** Unit, integration (late-failure runner, races), security and E2E tests cover every AC.

The one Major is test power. The story's Dev Context (D) requires its slow-read focus tests to go red under re-planted controls A1 and A2. A2 is caught at all three widths. **A1 is not.** The Customers DEF-020 guard (`customers-focus.spec.ts:131`) stays green under A1 at 360, 768 and 1366 px, whether the failing read is immediate or held until the dialog has closed. The test checks only that the heading (H1) never took focus and that the title has it last. Under A1, focus goes to the still-visible "Add customer" button, and the title then takes it back on its second StrictMode mount on the development server, so the test cannot see the move. The other findings are a stale page after browser Back, a dead `?added=1` path, a client/server mismatch on the name length, and a side effect of the JS budget deviation (all Minor), plus two notes (Info).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| Info | 3 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Customer unit and security tests (developer worktree at efcf768, read-only) | `npx vitest run` on the 11 files `customers-lib`, `customers-routes`, `customers-audit-events`, `customers-source-rules`, `master-constraints-customers`, `masters-service-customers`, `js-budget-records`, `masters-audit-events`, `canary-scan-gate`, `security/role-matrix`, `security/engineer-import-rule` | **11 files, 1,054 tests passed**, 47.8 s |
| Integration (database) and E2E | not run locally (no database credentials read; no `npm ci`) | taken from the G5 CI run 43170187169 at efcf768: 5 of 5, unit 3,302, full Vitest 5,786, E2E 861 passed, 24 skipped |
| Plant A1 (#314) | efcf768 + `use-read-again.ts`: a failed read moves focus to the opener on every screen. CI run 43173424055 | E2E red on #244's `masters-slow-read.spec.ts:76, :103`, `treatments-focus.spec.ts:181, :197` and `exchange-rates.spec.ts:383` at all three widths. **`customers-focus.spec.ts:131` passed at 360, 768 and 1366 px: not caught** |
| Plant A2 (#315) | efcf768 + `use-read-again.ts`: after a good read, focus goes to the heading. CI run 43173430261 | **`customers-focus.spec.ts:105` red at 360, 768 and 1366 px** (and its retry): caught |
| Probe SF-B (#317) | efcf768 + the failed read held until the Add dialog has closed (test-only). CI run 43174713969 | 5 of 5 green; `:131` passes at all three widths |
| Probe SF-A1 (#318) | A1 + the SF-B test. CI run 43174721188 | `:131` **still passes** at all three widths: holding the read is not the fix |
| Probe ST-B (#322) | SF-B + one assertion: after the failed read, only the error title takes focus | CI run 43176014661: 5 of 5 green; `:131` passes at 360, 768 and 1366 px (the stricter test holds on correct code) |
| Probe ST-A1 (#323) | A1 + the ST-B test | CI run 43176020141: **`:131` red at 360, 768 and 1366 px** (and each retry) on the new assertion; the received log after the read was `["BUTTON:Add customer"]` |
| Diff reading | `git diff b710741 efcf768`, full content of the changed server, client and test files, and their callers | see Findings |

Every control and probe branch is `control/AQP-142-qlt-*` from efcf768. Each diff was printed before its push, using an anchor script that refuses to edit unless the anchor occurs exactly once. Every PR is a draft, closed unmerged with its result in a comment, and every branch is kept.

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 create, name rules, optional contact, default rates | `customer-service.ts` `createCustomer`/`add`; `customer-repository.ts` `insertCustomer` (one `INSERT … SELECT` from `process_items`); `schemas/customers.ts`; migration (`uq_customers_name_lower`, CHECK); `customer-form-dialog.tsx` | `integration/masters/customers.test.ts` T1 and T2; `customers-routes.test.ts`; `customers-lib.test.ts`; `customers.spec.ts` add tests; `customers-sync.test.ts` race on one name | **Met.** QLT-04: the length check differs between screen and route in one edge case |
| AC-2 edit details and rates, rate rules, Differs tag, no-op saves | `change()` with `detailChangesFrom` and `ratesToWrite` (judged against the item's unit); `customer-form.ts` (only what changed is sent; an untouched stored value is never re-judged); `customer-rates-table.tsx` (tag with icon and text) | integration T2 (refusals, no-op, 409); `customers-routes.test.ts`; `customers-lib.test.ts`; `customers.spec.ts` edit tests | **Met.** QLT-07 (Info): percent defaults on the Process Master may carry decimals |
| AC-3 Reset with an alertdialog that names the rates; count; cancel changes nothing | `reset()` (only differing rates, count, idempotent); `customer-reset-dialog.tsx` (list of rates, focus on "Keep current rates") | integration T3 (count, idempotent, follows a changed default, 404); `customers.spec.ts` reset tests (keyboard, Escape, Keep) | **Met** |
| AC-4 item add or delete reaches every customer in one transaction | `masters-service.ts` +2 lines in the same `tx`; `addProcessItemToCustomers` / `removeProcessItemFromCustomers` (one statement each); FK with no cascade as a backstop | `customers-sync.test.ts` (100 customers, soft-deleted customer, late-failure rollback, concurrent add, edit against delete); `masters-service-customers.test.ts` | **Met** |
| AC-5 `/options/customers`: IDs and names only, strict | `options/customers/route.ts`; `customerOptionSchema` (strict); `listCustomerOptions` selects `id, name` | `customers-routes.test.ts`; `canary-scan.spec.ts` AC-5/AC-7 test; strict-schema suite | **Met** |
| AC-6 exactly one audit entry, `master.created` / `master.edited`, `customer` shape, no values of contact fields, none for no-op, none per customer on sync | `audit-events.ts` `MASTER_SHAPES.customer`, `MASTER_WORDS.customer`; `customer-service.ts` `auditState`/`changedRates` | `customers-audit-events.test.ts`; integration T2/T3 entry assertions; `customers-sync.test.ts` (item's own entry only, rollback); `audit-transaction-architecture.test.ts` (DL-165) | **Met** |
| AC-7 roles, scan, canary values | route manifest rows; `canary-masters.ts` takes `CUSTOMER_CANARY_VALUES` (same two values, not narrowed); `customer-canary*.ts`; `route-calls.ts` / `spec-access.ts` rows added only | `role-matrix.test.ts` (+ the CR-33 invented-ID case); `canary-scan.spec.ts` (two tests); `canary-scan-gate.test.ts` | **Met** |
| AC-8 widths, 44 px, axe, keyboard, focus on the safe choice | `customer-list.tsx` (masters table, Edit only, 68 px; cards on phones); `customer-edit-screen.tsx` | `customers.spec.ts` (three widths, axe, 44 px, keyboard paths); `masters-table-actions.spec.ts` Customers entry; `customers-focus.spec.ts` | **Met in the product. Test gap: QLT-01** (the DEF-020 guard does not catch plant A1) |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `tests/e2e/customers-focus.spec.ts:131-150` | Dev Context D (DL-150 (8)), DEF-020, AC-8 | The Customers failed-read guard stays green under re-planted control A1 at all three widths, immediate or held (#314, #318). It forbids only H1 and checks the last focus entry. Under A1, focus moves to the visible "Add customer" button and the title's second StrictMode mount takes it back, so the move goes unseen | A regression in the shared `use-read-again.ts` that moves focus after a failed re-read on SCR-12 would pass CI. The story's own control requirement ("must go red under each") is not met | Hold the failing read until the dialog has closed, mark the focus log there, and assert that only the error title takes focus after the read (probe ST-B / ST-A1 diff below). Re-run A1 |
| QLT-02 | Minor | `src/components/features/masters/use-customers.ts:22-23`; `use-customer-edit.ts:133-136` | correctness of what is shown | Browser Back after a save restores the list (or the edit page) from Next's back/forward cache; nothing calls `router.refresh()`. The comment's "read again when the person comes back" is true only for Link/push. From documented framework behaviour; not reproduced | A stale "N differ" count, name or rate right after a save. No data is lost | `router.refresh()` after a successful save and reset, or correct the comment. Test: save, `page.goBack()`, expect "1 differ" |
| QLT-03 | Minor | `src/components/features/masters/use-customer-edit.ts:73-89`, `customer-texts.ts:88-92` | maintainability | The `?added=1` flag, `useForgetAddedFlag` and `customerCreatedNotice` are never reached (Add stays on the list) and untested | Dead code; a hand-typed `?added=1` shows a false "was added" notice | Remove, or wire "open the new customer" deliberately (ux-expert) and test it |
| QLT-04 | Minor | `src/server/views/schemas/customers.ts:24` | AC-1, one rule in one place | The route checks max 100 on the trimmed raw name. The screen and the service check the canonical form (NFKC, spaces collapsed), which is what is stored | A name that fits once canonical (for example 101 raw with one double space) passes the form and is refused by the route | Transform with `canonicalCustomerName` before `.max`, or refine with `customerNameProblem` |
| QLT-05 | Minor | `scripts/check-js-budget.ts:78`, `scripts/lib/js-budget-records.ts:4-8` | Decision 6 (deviation) | The NFR-009 check now writes one customer and one append-only audit entry on every run, including `--base-url` runs against a server the script did not start. The Usage text does not say so | A hidden write in a check people treat as read-only; the audit entry cannot be removed | State it in Usage, or make records only when the script started its own server, or behind an explicit flag CI passes |
| QLT-06 | Info | `tests/security/engineer-import-rule.test.ts:18` | STD-06 kind | The header still calls a customer, material or exchange-rate reader "files that do not exist yet"; `FUTURE_IMPORTS` still lists `material-repository` | Stale words only; the rule is not weakened (both new classes are `blocked`) | As master ruled: reword at the overlap step after #222 merges |
| QLT-07 | Info | `src/lib/masters/customer-form.ts:45-48` | AC-2 vs STORY-02.01 | A Process Master percent default may have 2 decimals; a customer's percent rate must be whole. A reset can therefore set a value the Admin cannot type back | Handled: an untouched value is not re-judged (tested) | Product-owner question; no change asked here |
| QLT-08 | Info | `src/server/services/customer-service.ts`, `src/server/repositories/customer-repository.ts`, `tests/integration/masters/customers-sync.test.ts` | — | Good practice: lock order is documented and asserted (PRF-01); the database is the judge of uniqueness; the sync is one statement; late-failure rollback tests cover create, edit, reset, item add and item delete; the `rates.<index>` messages map back to the rate that was sent | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01: why the guard misses A1, and a fix that was probed

**Evidence.**
- **A1 (#314, run 43173424055).** `customers-focus.spec.ts:131` passed as tests 43, 76 and 33 (desktop, mobile, tablet). In the same run, the sibling DEF-020 tests failed on `focusLog.filter(H1)` with `["H1:Materials and lists"]`. Their opener (a row's button) is gone while the list is in error, so `focusOpener` falls back to the heading, which they forbid.
- **Why SCR-12 differs.** On SCR-12 the opener is the page header's "Add customer" (`findOpenerElement` scope `main`), which is still visible in the error state, so A1 focuses it. The E2E runs on the development server (spec header), where React StrictMode runs mount effects twice. `ErrorState`'s `focusOnMount` effect then takes focus back to the title, while `useFocusAfterRead`'s request is already spent. The log becomes `…, H2, BUTTON:Add customer, H2`, and every assertion of the test still holds. This is the mechanism the code implies; the CI result is the fact.
- **Holding the read is not the fix.** SF-A1 (#318, run 43174721188) is still green.

**Suggested.** This is the ST-B diff (#322), applied after the held read of SF-B (#317):

```ts
    const fail = await failListWhen(page, BUSY);
    fail.value = true;
    const gate = aGate();
    await page.route('**/api/v1/customers', async (route: Route) => {
      if (route.request().method() === 'GET') await gate.passed;
      return route.fallback();
    });
    const focusLog = await recordFocus(page);
    await addByKeyboard(page, name);
    await expect(page.getByRole('dialog', { name: ADD })).toHaveCount(0);
    await afterOneFrame(page);
    const fromTheRead = focusLog.length; // everything after this is the answer to the failed read
    gate.release();
    // … existing assertions …
    expect(focusLog.slice(fromTheRead).filter((entry) => entry !== `H2:${LOAD_ERROR_TITLE}`)).toEqual([]);
```

**The test that proves it.** Re-plant A1 (the one-line change in `use-read-again.ts` of #314) and confirm `:131` is red at the three widths. This was probed: ST-B (#322, run 43176014661) is green on efcf768. ST-A1 (#323, run 43176020141) is red at 360, 768 and 1366 px, and the focus log after the read was `["BUTTON:Add customer"]`. That confirms the mechanism above.

### QLT-02

```ts
// use-customer-edit.ts, after a successful save (and in onResetDone)
const router = useRouter();
// …
adopt(outcome.value);
router.refresh(); // invalidates the client cache, including back/forward, so Back shows what was saved
```

### QLT-04

```ts
const name = z
  .string({ error: CUSTOMER_NAME_REQUIRED_MESSAGE })
  .transform(canonicalCustomerName)
  .pipe(z.string().min(1, CUSTOMER_NAME_REQUIRED_MESSAGE).max(CUSTOMER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE));
```

</details>

## Issues for other roles

- **developer / orchestrator (#244 pattern, cross-screen).** `expectErrorTitleHoldsFocus` (treatments) and the `masters-slow-read.spec.ts` failure tests have the same blind spot as QLT-01 for any flow whose opener is still visible in the error state: an **Add** opened from the page header on SCR-11, SCR-13 Materials and Treatment / Color. They caught A1 here only through flows whose opener disappears (edit, rename, delete). Worth a follow-up issue: assert that only the title takes focus after the failed read.
- **ux-expert.** `customers/error.tsx` covers both the list and the edit page with the title "We could not load customers". On the edit page it is one customer. Wording only.
- **product-owner.** QLT-07 (percent defaults with decimals on the Process Master and whole-number customer rates).
- **reviewer-performance (cross-reference, not a quality finding).** Every customer create, edit and reset takes `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`, so all customer writes serialise with each other and with Process Master writes. It is correct and documented (PRF-01); its throughput is that reviewer's call.

## Reviewer-specific tables

See "AC conformance" above.

## Previous Findings (re-review only)

n/a (round 1).
