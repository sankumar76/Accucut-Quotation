# Combined security-and-quality review: AQP-330 (STORY-06.13 "Remove the cancelled price, Admin only")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/495 |
| Head reviewed | `4960a4a31b2adb86d7595007a06000d91673466d` on `feat/AQP-330-remove-price` (base 534ff1b). The branch is behind `master` by 0feea64 (#492, AQP-308) and a44cb88 (#497, AQP-309). A `git merge-tree` is textually clean, and the one shared file (`tests/unit/one-width-tag.test.ts`) changes different lines on each side. Updating the branch waits on a delivery-lead decision, so this review is of the head as it is (see SQR-08) |
| CI | Run 44318744441 on 4960a4a: **all green**. "Stages 1 to 11b", "Stages 1 to 11" and E2E shards 1 to 4 passed. Per the Dev Record: 438 files / 11882 unit and integration tests, and `remove-price.spec.ts` 15 of 15 (5 tests at 3 widths). Two flaky retries were in other stories' specs |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`: a step-up action and an irreversible removal (FR-108, FR-107, D-29; NFR-001, NFR-002, NFR-004, NFR-007; architecture §4.10, §5.1, §6 "Remove price") |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-18 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 2 · Info 7 |

## How I read it

- **The whole diff**, `git diff 534ff1b...4960a4a`: 52 files, +2451 / -74. I read every product file in full at the head:
  - Server: `remove-price-service.ts`, the route, `schemas/remove-price.ts`, the `approval-repository.ts` changes (`findLatestForRemoval`, `markRemoved`, `findLatestRemoval`, and the changed `findLatestApproval` and `findLatestForCancel`), `audit-events.ts`, `estimate-review-service.ts`, `costs.ts`, `composition.ts` and `route-manifest.ts`.
  - Words and client: `remove-price-words.ts` and `remove-price-client.ts`.
  - UI: `remove-button.tsx`, `remove-dialog.tsx`, `remove-texts.ts`, `price-removed-notice.tsx`, `review-actions.tsx` (`removeOffer`), `estimate-review.tsx` and `review-texts.ts`.
- **Callers, callees and guards:**
  - `cancel-approval-service.ts`: it uses `findLatestForCancel`, whose rule changed.
  - Every reader of `approvals` in `src/` (grep). The only BO read is `findLatestApproval`, called once, by `estimate-review-service.ts` (`/costs` and SCR-06, both `ADMIN_AND_LEAD`). `findLiveApproval` (unlock, approve) already excludes removed rows. The export reads no approval yet (BO2 is 07.03).
  - The audit routes: `/audit` and `/api/v1/audit` are `ADMIN_ONLY` (`route-manifest.ts:147`, `:156`).
  - The `approvals` migrations: the column grants (`20261116120000_approvals:85`, no grant on `approved_price`), the write-once triggers (`:107`, `20261116140000_approvals_freeze_acts:46`), `ck_approvals_remove_by_and_at_together`, and `uq_approvals_one_live_per_estimate`, which excludes removed rows, so a new approval after a removal is allowed.
  - `engineer-import-rule.test.ts:123` and `spec-access.ts:66` (the remove-price service and route rows).
  - The fakes in `tests/support/fake-calculations.ts`, which follow the new rule.
- **Jira AQP-330:** AC-1 to AC-8, Dev Context and testing notes. **Architecture v0.51** (records branch): §4.8 line 614, §4.10, §5.1 `approvals` row (line 729) and §6 "Remove price" row (line 975). **UX spec** SCR-06 rows 704 to 707 and line 745, SCR-16 line 1127, and the mock-up `SCR-06.html:147`.
- **Tests I ran at the head** (read-only worktree `aqp-330`, `npx vitest run … --maxWorkers=1`): **19 files, 2438 tests passed.**
  - `remove-price-route`, `approval/remove-price`, `remove-price-texts`, `remove-price-client`
  - `estimate-review-screen`, `estimate-review-service`, `estimate-review-architecture`, `costs-schema`
  - `audit-events`, `audit-service`, `approved-read-architecture`, `cancel-approval-route`, `unlock-route`, `one-width-tag`
  - `security/role-matrix`, `engineer-import-rule`, `strict-schema`, `csrf`, `engineer-refused-before-lookup`
  - The worktree stayed clean (no file changed).
- **Not run locally, as briefed:** PostgreSQL integration (`remove-price.test.ts`, `approve.test.ts`, `cancel.test.ts`), Playwright and the build. For those I rely on CI run 44318744441 and on reading the tests.

## First focus: the BO rule (developer's decision 1)

**The rule.** BO used to be "the latest row that has not been removed". It is now "the latest row (`approved_at DESC, id DESC`); none when that row's price was removed".

- `findLatestApproval` (`approval-repository.ts:334-359`) now reads the latest row of any kind and returns `null` when `removedAt !== null`.
- `findLatestForCancel` (`:267-279`) does the same in SQL: a subquery takes `LIMIT 1` first, then `WHERE removed_at IS NULL`.
- `findLatestForRemoval` and `findLatestRemoval` use the same ordering.

**Verdict: correct, and it is the rule §4.10 requires.** §4.10 says "a price a later approval replaced is no longer shown", and AC-3 says "Not set yet on every screen". The old rule broke both. Removing the latest price would have brought back an earlier, replaced price. Under the old rule the cancel path could also act on a replaced approval (see SQR-01).

| Sequence | Rows after it | BO (new rule) | Remove / cancel | Proven by |
|---|---|---|---|---|
| approve A1 → cancel A1 → remove A1 | A1 cancelled + removed | `null`, notice shows who and when | A second removal gives 409 `PRICE_ALREADY_REMOVED`. A cancel gives 409 `NO_APPROVAL_TO_CANCEL` | integration `remove-price.test.ts:193`, `:328` |
| approve A1 → cancel A1 → re-approve A2 (after Recalculate) | A1 cancelled, A2 live | A2. `findLatestRemoval` is not read | Removing A1 gives 409 `APPROVAL_CHANGED`. Removing A2 before a cancel gives 409 `APPROVAL_NOT_CANCELLED` | integration `:314` |
| approve A1 → unlock A1 → re-approve A2 → cancel A2 → remove A2 | A1 unlocked, A2 cancelled + removed | `null`. **A1's price does not come back** (the old rule would have shown it) | none | integration `:208` (rows `[1000, 2000]`, removed `[false, true]`, BO `null`) |
| remove A1 → Recalculate → approve A2 | A1 removed, A2 live | A2. The notice is gone (`findLatestRemoval` is `null`) | the index allows A2 (it excludes removed rows) | integration `:225` |
| approve A1 → unlock A1 → cancel A1 (AC-10) → remove A1 | A1 unlocked + cancelled + removed | `null` | allowed: the latest row, cancelled | service logic (the `cancelledAt` test); the cancel-from-Draft path is AQP-329's |

**Ordering.** `approved_at` is the database's `now()` (the transaction's start). Approvals of one estimate are made one after another under its row lock, and a new one needs a Recalculate and a status change first, so ties do not happen in practice. `id DESC` is the tie-break, as before.

**The rewritten pinned test (`approve.test.ts:322-339`) is not weakened.** It still asserts:

- the later approval (600.00) is BO over the earlier one;
- the earlier row stays on record (`approvalCount === 2`).

The removed-row assertion is now stricter. `approval` is `null` (before, only the price was compared), `priceRemoved` has a name and no `600`, and the earlier 500.00 no longer stands in for it. The test still guards what it was written for: BO comes from the `approvals` row, the latest one, never through the figure state. It now also guards the new rule. One note: it sets `removed_at` on a row that was not cancelled, which the product cannot reach (`markRemoved` requires a cancel). That is acceptable for a BO-read test.

**No non-Admin read serves a removed price:**

- `/costs` and SCR-06 (Lead and Admin) carry `approval: null` and `priceRemoved: {at, byName}`. The schema is strict and has no price key (`costs.ts`, `costs-schema.test.ts`).
- The Engineer is refused before any approval read (`estimate-review-service.test.ts:275`), and the E2E shows the Engineer's page with no price.
- The route answers `{removedAt}` only (strict). The route-test canary scan covers every refusal and the good answer.
- The audit entry keeps the price, and the audit log is `ADMIN_ONLY`.
- The unlock page reads `findLiveApproval`, which excludes removed rows. The export reads no approval yet.
- One inaccuracy in the repository's doc: SQR-02.

## Security and data-integrity scope: results

| # | Check | Result |
|---|---|---|
| 1 | **Step-up in the same request, before the lock, own throttle key** (AC-3, AC-4, NFR-004) | **Verified.** The service runs `assertMayRemovePrice` first, then `verifyStepUp({ user: { id: viewer.id }, requestId }, request.password)`, then `transactions.run`. The person comes from the session (`route.ts`), never from the body. The step-up service's own `stepup` throttle key is reused, apart from sign-in. Integration AC-4 shows `transactionsOpened === 0` on a wrong password, and the right password then works in the same session. The route test shows five wrong passwords, then a 429 `STEP_UP_LOCKED` even with the right one (`remove-price-route.test.ts:315`). The unit test pins the order (`approval/remove-price.test.ts:71`) |
| 2 | **Password in no log, audit row, response or error** (AC-7) | **Verified.** It is read in one call only. `RemovePriceRequest.audit` is `{actorId, actorLabel, requestId}`. The audit shapes are strict (`{approvedPrice}` / `null`), and `audit-events.test.ts` refuses an extra `password` key. The body schema reuses `stepUpPasswordSchema`, and the answer schema is strict. The route test scans every response body and log call (`:357-405`), integration AC-7 scans the database's audit rows (`:383`), and E2E checks `passwordInAudit: false` |
| 3 | **Admin only** (AC-5, NFR-001) | **Verified.** The manifest row is `ADMIN_ONLY` (`route-manifest.ts:291`), and there are `spec-access.ts` and `role-matrix` rows. `withRoute` gives Lead and Engineer 403 before the ID is looked at, and a signed-out caller 401 (`remove-price-route.test.ts:333-355`, `engineer-refused-before-lookup`). In the service, `assertMayRemovePrice` refuses again, closed by `assertNever`. Integration AC-5 covers Lead and Engineer against PostgreSQL |
| 4 | **Exactly one removal under concurrency** (AC-5) | **Verified, with a real overlap.** `lockEstimate` (`FOR UPDATE`), then every check and write runs in that `tx`. The overlap test (`remove-price.test.ts:340`) holds the first removal uncommitted with `createHoldingRunner`. It starts the second, waits until `pg_locks` shows it waiting (`untilALockWaits`), and asserts it has not answered. Then it releases: 200 and 409 `PRICE_ALREADY_REMOVED`, one removed row and one audit entry. This closes AQP-329 SQR-05 for this story. There are three backstops: `markRemoved`'s `WHERE cancelled_at IS NOT NULL AND removed_at IS NULL`, the impossible-null guard (a 500 that rolls back), and the write-once trigger |
| 5 | **Every 409 path writes nothing** | **Verified.** The order is: 404, `NO_PRICE_TO_REMOVE`, `APPROVAL_CHANGED` (the cancel's code and sentence), `PRICE_ALREADY_REMOVED`, `APPROVAL_NOT_CANCELLED`. Each throws before `markRemoved` and the audit `record`, inside the transaction. Every integration 409 test asserts `storedOf(...)` deep-equal, no removal on any row, and no new audit entry. A failed audit write, or a failed store, rolls everything back (`:235`, `:245`). The answer about the request comes first: the removal reads no customer or material, so AQP-329 SQR-03 does not arise |
| 6 | **The audit entry keeps the price, Admin-only; `approved_price` unchanged** (AC-3, AC-6, NFR-007) | **Verified.** `approval.price_removed` is wired: before `{approvedPrice}`, after `null`. SCR-16 shows "Price ₹ 4,750.00" to "Removed from the estimate. The audit log keeps it". The audit routes are `ADMIN_ONLY`. `markRemoved` writes only `removed_by` and `removed_at`. The runtime role has no grant on an approve column, and the trigger refuses any change of one. Integration `:161` asserts the price, the calculation and the status are unchanged, and that the entry keeps the price. E2E reads the row and the entry. The registry scenario points at `remove-price.test.ts` (`audit-database.test.ts`) |
| 7 | **NFR-002 (the Engineer never sees a price)** | **Verified.** `remove-price-service` is in `engineer-import-rule.test.ts:123`. `priceRemoved` holds a time and a name, on `ADMIN_AND_LEAD` routes only. The route answer passes the canary scan. In E2E, the Engineer's page shows nothing of it. The dialog's price comes from the Admin's own page (`removeOffer`), never from the server answer |
| 8 | **The approved-read guard** | **Verified.** `approved-read-architecture.test.ts` is unchanged and passes. It scans `approval-repository.ts` whole, so it covers the new raw SQL (`FROM approvals`, `UPDATE approvals`, `LEFT JOIN users`) |
| 9 | **Separate dialog and request from the cancel** (AC-2) | **Verified.** A separate route, service, dialog file and client. `estimate-review-architecture.test.ts` shows the dialog is fetched on first press and is not in the first load |
| 10 | **#491 (AQP-329 SQR-01): `audit.spec.ts`** | **Intent kept, and stronger.** The empty-state test now pins the list as non-empty under Who = E2E Admin and Event = User change, before the window `2020-01-01` to `2020-01-02` empties it. It still asserts the heading, the text, no count line, Clear filters and focus. The keyboard test checks that the list follows each choice (the added person is hidden under the seven other kinds and shown under User change). It then reaches the empty state through a past To date and clears by keyboard, asserting Event and To are empty. Neither test now depends on which kinds other stories write. The `@one-width` allow-list title is updated |

## AC conformance

| AC | Code | Test(s) | Result |
|---|---|---|---|
| AC-1 Danger button for the Admin on a cancelled latest approval; none before a cancel or for an older one; Lead sees "Only the Admin can remove it" and no button | `removeOffer` (`review-actions.tsx`), `RemoveButton`, `CancelledNotice`; BO is the latest row, so an older one never has it | `estimate-review-screen.test.ts` (06.13 AC-1), route 403s, `role-matrix`, E2E AC-1 | **Met** (placement: SQR-05) |
| AC-2 AlertDialog with the spec's title and sentence, "Your password", "Keep the price" safe and focused; separate from the cancel | `remove-dialog.tsx`, `remove-texts.ts` | `remove-price-texts.test.ts`, `estimate-review-architecture.test.ts`, E2E AC-1 (focus, axe, Escape sends nothing) | **Met** |
| AC-3 `verifyStepUp` in the same request; under the row lock `removed_by/at`; BO "Not set yet"; audit keeps the price in the same transaction; notice | `remove-price-service.ts`, `markRemoved`, `findLatestApproval`, `findLatestRemoval`, `price-removed-notice.tsx` | integration AC-3 (7 tests, incl. lock wait and two rollbacks), route AC-3, review-service, screen, E2E AC-3 | **Met** (BO2 in the file is 07.03's, as the AC says) |
| AC-4 422 `STEP_UP_FAILED` / 429 `STEP_UP_LOCKED`; nothing changes | step-up before the transaction | integration AC-4, route AC-4 (5 + 1), unit order test, client test, E2E AC-4 | **Met** |
| AC-5 409 ×3 (not latest, not cancelled, already removed), 403, 403, 401; exactly one under concurrency | service order, `markRemoved` WHERE, row lock | integration AC-5 (incl. the `pg_locks` overlap), route AC-5, E2E "another window" | **Met** |
| AC-6 Row and calculation remain; `approved_price` unchanged; no route serves the removed price; only read is the Admin audit entry | grants and trigger; strict `costs` and answer schemas; `findLatestApproval` gives `null` | integration `:161`, `:193`; `costs-schema.test.ts`; route canary scan; E2E (page, `/costs`, row, entry) | **Met** (doc inaccuracy: SQR-02) |
| AC-7 Password nowhere | see check 2 | route AC-7 (every path), integration AC-7, unit, E2E | **Met** |
| AC-8 360/768/1366, keyboard, axe 0 | `remove-dialog.tsx` (Radix AlertDialog, shared fields) | `remove-price.spec.ts`, 5 tests × 3 widths, CI green | **Met** |

## Findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| SQR-01 | **Minor** | `src/server/repositories/approval-repository.ts:267-279` (`findLatestForCancel`); helpers `tests/integration/approval/cancel.test.ts:97` and `tests/e2e/support/approved-estimate.ts:73` (`latestApprovalIdOf`, now used by the new `removePriceThroughTheApi`) | **The new cancel rule is not pinned against PostgreSQL, and two test helpers still encode the old BO rule.** Under the old SQL, consider an estimate with A1 (unlocked, replaced) and A2 (cancelled, then removed). `findLatestForCancel` returned A1, so an Admin's direct `POST …/approval/cancel` naming A1 would have **cancelled a replaced approval** and written an audit entry with A1's price. The new SQL returns `null` (409 `NO_APPROVAL_TO_CANCEL`), which is right. But the only cancel-after-removal test (`remove-price.test.ts:193`) has a single approval, where both rules give `null`. So reverting the SQL would keep every test green; only the fake's TypeScript copy pins the rule. The two helpers pick "the latest row not removed": the page's ID under the old rule. They give the right ID in today's one-approval scenarios, but would silently pick a replaced approval in a multi-approval scenario. **Why:** a regression on an irreversible, Admin-only path would go unnoticed. | Add to `cancel.test.ts`: approve 500 → unlock → Recalculate → approve 600 → cancel → remove → cancel naming the first approval's ID, then expect 409 `NO_APPROVAL_TO_CANCEL`, rows and audit unchanged. Change both helpers to "the latest row" (drop `AND removed_at IS NULL`) and give `latestApprovalIdOf` a clear error when that row is removed. **Follow-up #499.** |
| SQR-02 | **Minor** | `approval-repository.ts:21` (header); `:334-359` (`findLatestApproval` selects `approvedPrice` with `removedAt`); also `review-texts.ts:152` | **The doc claims more than the code does.** The header says "No read that serves a screen selects the price of a removed row". But `findLatestApproval` does select `approved_price` of the latest row before it checks `removedAt` and returns `null`. The removed price is loaded into the server's memory on every SCR-06 read of such an estimate, then discarded. **Nothing leaks:** the value never leaves the function. The claim matters in a Restricted module whose comments the reviewers rely on. While there: `DOWNLOAD_NOT_CALCULATED_REASON ='Calculate…` lost its space before the quote. No formatter is configured, so lint did not catch it. | Reword the line to what is true: "no read that serves a screen **returns** the price of a removed row: `findLatestApproval` drops it and returns `null`". Or select the price in SQL only when `removed_at IS NULL`, as `findLatestRemoval` does. Restore the space. **Follow-up #499.** |
| SQR-03 | Info | Architecture §4.8 line 614 and §5.1 `approvals` row line 729 ("BO is the latest row not removed"); §6 "Remove price" row line 975; NFR-004 row / A-33 | **The architecture text is the old rule.** The code is right, per §4.10. §6 lists 403, 409 and 422. The route also answers 401, 404, 429 `STEP_UP_LOCKED`, 409 `NO_PRICE_TO_REMOVE` and 409 `PRICE_ALREADY_REMOVED`. NFR-004 names `approval-service`; the check is in `remove-price-service.ts`, as with the cancel (AQP-329 SQR-02). | **solution-architect** (ruling separately, per the brief): change §4.8 and §5.1 to "BO is the latest row; none when its price was removed", and update the §6 and NFR-004 rows. |
| SQR-04 | Info | `src/lib/estimate/remove-price-words.ts:12`, `:16`, `:20`; `remove-texts.ts` (`PASSWORD_HINT`, `REMOVE_UNCONFIRMED`); `audit-events.ts` `describeRemoved`; `review-texts.ts:151` | **Invented words, all true and figure-free.** These are the three 409 sentences, the password hint, the lost-answer sentence (the cancel's, with "removed"), and the SCR-16 split ("Price ₹ …" to "Removed from the estimate. The audit log keeps it"). I checked each against the cases where it can appear: `APPROVAL_CHANGED` is checked before `APPROVAL_NOT_CANCELLED`, so "Cancel the approval first" is never said about a stale page. The dialog's and the notice's "after a Recalculate" is the spec's own wording. It is not strictly true when the cancel left a Submitted estimate with current figures. UX v0.31 (line 745) dropped the phrase from the cancel dialog for that case. The developer flagged it (PR point 5). | **ux-expert:** confirm or replace the words, and rule on "after a Recalculate" for the remove dialog and the Price removed notice. |
| SQR-05 | Info | `review-actions.tsx` (button in the action bar); `remove-button.tsx:15`, `review-texts.ts:144`, `cancelled-notice.tsx:24` ("beside the BO tile" / "beside the cancelled BO") | **Placement versus AC-1's wording.** AC-1 says the button "shows beside the BO tile". It is drawn in the action bar, below the tree and the build table, next to Cancel approval. This **matches the mock-up** (`SCR-06.html:147`: the button is in `.actionbar`), and UX rows 704-705 do not place it, so I count AC-1 met. The code comments repeat the AC's "beside", which does not describe the layout. | Optional: reword the three comments to "in the action bar". **product-owner:** note the AC wording against the mock-up. |
| SQR-06 | Info | `src/server/services/estimate-review-service.ts:165`, `:170` | **Two reads, not one snapshot.** `findLatestApproval` runs, and when it gives `null`, `findLatestRemoval` runs as a separate statement. A new approval committed between the two gives one page with neither BO nor the notice, until the next load. It can never show a wrong or removed price. Not worth a transaction. | none |
| SQR-07 | Info | `tests/unit/audit-service.test.ts:113-131` | **The key-name secret scan is no longer exercised through `record()`.** The reserved event with a loose shape was the only way to reach it. Now every event is strict, so a key such as `passwordHash` is refused by the shape first. `findSecretPath` keeps its own test (`audit-secrets.test.ts`). The value scan is still tested through a cancel reason. That is adequate: the risk returns only when a story adds a loose (reserved) event again, and the comment at `audit-events.ts:331` tells that story what to add. | Optional: when the next reserved event is declared, restore the `record()` key-scan case. |
| SQR-08 | Info | branch versus `master` | **The merged result has not been through CI.** `master` gained #492 and #497, which add repository-wide scans (`english-only.test.ts`, `privacy-fixtures.test.ts`, `privacy-schema.test.ts`, `metadata-coverage.test.ts`, changes to `one-width-tag.test.ts`). These can read this PR's new files. The textual merge is clean, but the scans have not run on them. | **orchestrator:** after the delivery lead's decision, update the branch and merge only on a green run of the updated head (branch protection reports `behind`). |
| SQR-09 | Info (praise) | whole change | **A careful change for an irreversible action.** The developer found that the existing BO rule would bring a replaced price back, fixed it at the one read, and said so in the PR instead of working around it. The step-up comes before the lock. The checks are layered: manifest, service role, then the row's own WHERE and the trigger. Everything is in one transaction. The overlap test proves the two removals really overlap (AQP-329 SQR-05 taken up), and the rollback tests cover each failing step. The password scan covers every path. #491 is fixed so that it holds whatever later stories write. | none |

## Verdict

**APPROVE WITH COMMENTS.** There are no Blocker, Critical or Major findings, and all eight ACs are met.

- **The BO rule:** correct for every sequence checked: approve-cancel-remove, re-approve after a cancel, re-approve after an unlock, and a new approval after a removal. It matches §4.10. The rewritten `approve.test.ts` assertion is stricter, not weaker.
- **Step-up:** in the same request, before the lock, on its own throttle key. 422 and 429 are proven, and the password is in no log, audit row, response or error.
- **Authorisation:** Admin only at the manifest and in the service. Lead and Engineer get 403; signed out gets 401.
- **Data:** exactly one removal under a proven overlap. Every 409 writes nothing. `approved_price` is unchanged, and the audit entry keeps the price for the Admin alone.
- **NFR-002:** holds. No non-Admin read serves a removed price.
- **#491:** fixed, and its intent is kept.
- **CI:** green on 4960a4a (run 44318744441). The updated head must be green before the merge (SQR-08).

The two Minors (SQR-01, SQR-02) go to follow-up issue #499. SQR-03 goes to the solution-architect, SQR-04 to the ux-expert, and SQR-05 to the product-owner.
