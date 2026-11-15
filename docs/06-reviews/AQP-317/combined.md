# Review Report — AQP-317 (STORY-05.09 Calculate) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master (7ac923f)...feat/AQP-317-calculate-2` (PR #403) |
| Commit reviewed | b91185d |
| Date | 2026-11-14 |
| **Verdict** | **REQUEST CHANGES**: 0 Blocker, 0 Critical, 2 Major. Both Majors are small, so I recommend fixing them before merge (CLAUDE.md §9 items 2 and 3). |
| PR review | posted on PR #403 as a COMMENT (single-token) |

## Summary
The server side is sound and safe on NFR-002. The Engineer's Calculate runs in one `TransactionRunner.run`. Every step inside it takes the caller's `tx`: `transition`, `lockEstimate` (three times), `currentConfiguration`, `listNodes`, the customer with its rates, all materials in **one** `findMany`, the exchange rates, `insertCalculation` and `linkCalculation`. Nothing reads on a second pool connection, and no nested transaction is opened. The answer comes from two constants and passes a strict schema made of two literals. The 422 `parts` member is rebuilt field by field. No new log statement was added. Role, ownership and status come first, so a 422 tells only the owner of a draft anything. The lock order adds no cycle. Calculate locks only the estimate row, plus FK key-share locks, and reads masters without locks. setCustomer, saveInputs, deleteCustomer and deleteMaterial keep their own estimate→master or master→plain-read order.

The two Majors:
1. **SQR-01, client.** Pressing Calculate does not wait for the part form's queued saves. A value typed just before the press can be left out of the immutable record, while the screen keeps showing it.
2. **SQR-02, test.** The new canary journey does not add the calculation's own outputs to the forbidden list. So it cannot catch the main thing AC-6 asks about: "no number from the calculation anywhere".

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 5 |
| Info | 4 |

## Checks Run
| Check | Method | Result |
|-------|--------|--------|
| Diff read | GitHub MCP `pull_request_read get_files` (73 files, +3164/−228), read in full for `src/server/**`, `src/lib/**`, the route, the new UI files and every test changed | Read |
| Callers and callees at b91185d | `get_file_contents`: `estimate-service.ts` (`applyTransition`, `setCustomer`, `lockForChange`), `state-machine.ts`, `transaction.ts`, `customer-repository.ts`, `exchange-rate-repository.ts`, `form-fields.ts`, `validation.ts`, `visibility.ts`, `api-client.ts`, `use-part-form.ts`, `canary-scan.spec.ts` (head) | Read |
| Context | Jira AQP-317 (AC-1 to AC-9, Dev Context); PR body (Dev Record, A-1 to A-5, decisions 1 to 12); GitHub #382; `docs/06-reviews/AQP-293/combined.md` | Read |
| Tests, lint, type-check, build, E2E | CI run 43653733627 on b91185d (I did not run anything locally: the brief limited me to GitHub MCP, and no git or worktree was allowed) | 6/6 green. Unit 5,552; unit + integration + acceptance with coverage 8,954 passed; changed-code coverage 95.2 %; JS budget `/estimates/[code]` 198,489 of 200,000 B gzip; E2E 4 shards green (1 flaky retry in `estimate-tree.spec.ts`, which this PR does not touch) |
| `validateForCalculate` coverage (test-strategy §11, 95 %) | `vitest.config.ts` now holds `src/lib/estimate/calculate-check.ts` to `PURE_CODE_TARGET`; CI coverage stage green | Met (gate enforced) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | **Major** | `src/components/features/estimate-workspace/use-calculate.ts:43` (with `use-part-form.ts` `commit`/`queueRef`) | AC-2 (the record must hold the inputs the Engineer entered), NFR-026 | Leaving a field queues its save (`queueRef.current.then(send)`). Clicking Calculate blurs the field, so the commit runs, and then the click sends `POST /calculate` at once. Calculate never waits for that queue. If several fields were left in quick succession, saves 2..n have not even been sent when Calculate reaches the row lock. | Calculate can win the lock. The estimate is then SUBMITTED with the previous stored value, and the immutable record holds that value. The queued save gets 409 (not editable), but the form keeps showing the newly typed text, now read-only. The Engineer believes the record holds what they see, and the Lead reviews other inputs. A blank old value only gives a 422 (harmless); a non-blank old value is silent. Recoverable only when a Lead edits and Recalculates. | The workspace gets a "pending saves" handle from the part form, for example `PartForm` reports `queueRef.current` and whether a field shows an unsaved error. `useCalculate.calculate()` then does `await pendingSaves()` before `calculateEstimate`, and does not send while a field holds a value the rule refused (show "Fix the highlighted field first"). The bar shows "Calculating" while it waits. | E2E: type into the last field, press Enter, then Space on Calculate at once (or block the save route and release it after the click). Expect the stored record row to hold the typed value, or no POST before the save resolves. Unit (`use-calculate`): a pending-save promise that resolves later means no fetch until it does. |
| SQR-02 | **Major** | `tests/e2e/canary-scan.spec.ts:545` (journey 508-548; `forbidden` built at 105 before the press) | AC-6 / NFR-002, test-strategy §6 | `forbidden` is `forbiddenStrings(readFormulaTexts())`: the master canaries and the formula texts, read **before** Calculate. The calculation's own outputs (row outputs such as M…BK, `product_values` totalPrice/pricePerToolCost/toolCostTotal) are never added. The docblock (line 502) says "nor any calculated output", but nothing checks that. | The scan cannot detect a figure computed by Calculate that reaches the Engineer (on the page after Calculate, in `/form`, `/tree`, `/nodes`, `/tasks` or in the second-press 409), unless it happens to equal a master canary. I found no such leak today (no Engineer path reads `calculations`, and the import rule blocks it). But the one end-to-end guard for the critical path of this story does not test its main claim. | After the press, read the record from the database (`product_values` and each `calculation_rows.outputs` value of this estimate), turn each non-trivial value into the scan's forms (plain digits, 2-decimal form, Indian grouping, as `forbiddenStrings` does for masters), add them to `forbidden`, and scan everything recorded after the press. Skip values like `0`/`0.00`/`1` that also appear as ordinary text, or treat them in a documented way. | The fixed scan itself. As a control: temporarily put `totalPrice` into the `/tree` answer and confirm the journey fails (planted-leak control, like STORY-04.04's). |
| SQR-03 | Minor | `tests/support/calculation-database.ts:102` (its `currentConfiguration: () => Promise.resolve(...)`, line 101) | #382 SQR-01 (configuration read in `tx`), test adequacy | The integration service and the timing tests stub the configuration read, so the production wiring `getCurrentVersion(configurations, undefined, tx)` in `composition.ts:207-210` and `config-repository` `findLatestRef(tx)`/`findById(id, tx)` are never run on PostgreSQL inside a Calculate. The unit test checks only that the stub received `tx`. | If a later change drops `tx` in the composition or in `getCurrentVersion`, the configuration read goes back to the plain pool under the lock. The 12-at-once test still passes because it never touches that read. | Build the integration service's `currentConfiguration` the way the composition does: `getCurrentVersion(createConfigRepository(db.prisma), createConfigVersionCache(), tx)` with a fresh cache, so both reads run. Or share one factory between `composition.ts` and the harness. | The 12-at-once test with the real configuration read. |
| SQR-04 | Minor | `src/lib/estimate/calculate-check.ts:161` | AC-1 ("listing each node … and field") | When Material in Drawing has no value but the registry does not mark it `mandatory`, the part is blocked with `fields: []`. The client then drops parts with no field (`blockedPartsFrom`) and shows only the sentence. | With the seed (E mandatory) nothing happens. If an Admin turns off `mandatory` on E, Calculate refuses with nothing to link to. The person cannot tell what is missing. | When `material === null` and E is not already in `missing`, add `{ fieldId: materialId, label }` from the form field. | Unit: registry with E `mandatory: false`, blank E → the blocked part names Material in Drawing. |
| SQR-05 | Minor | `src/components/features/estimate-workspace/estimate-texts.ts:106` | D-34 / FR-029, STORY-05.12 | `MISSING_NUMBER_MESSAGE` ("Use 0 if the part does not need it") is shown under every blank number, QTY per Assy included. A 0 in QTY per Assy is the case 05.12 will warn about. | The screen tells the Engineer to do what the next story warns against. Words only. | Use the plain `MISSING_TEXT_MESSAGE` for the field with `systemRole === 'quantity'` (the form view knows it through its hint), or a QTY-specific sentence. | Unit or E2E: blank QTY per Assy shows no "Use 0". |
| SQR-06 | Minor | `src/components/features/estimate-workspace/estimate-workspace.tsx:59` | AC-9, UX (primary action always reachable) | The only Calculate button is lazy-loaded. If both fetches of its chunk fail (initial plus one retry, `use-lazy-component.ts`), the page has no Calculate and gives no message until a reload. Enter on the last field falls back to the heading without a word. The PR flags this (reviewer point 7). | Rare, but the person cannot submit and is not told why. | When `bar.failed`, render a minimal inline `Button` (or a Notice "Calculate could not load. Reload the page.") from the first-load bundle. `useLazyComponent` can expose `failed`. | Unit: `useLazyComponent` with a loader that always rejects → `failed` true, and the workspace shows the fallback. |
| SQR-07 | Minor | `src/server/services/calculation-service.ts:127` (also PR decision 6) | Maintainability | The `calculate` docblock says the machine answers "404 for … any other role". In fact a Lead or an Admin gets 403 (`ForbiddenError`, tested), and the manifest refuses them before the service. Decision 6 says the row is locked "twice": it is locked three times (`applyTransition`, `submit`, `store`). It is harmless (same connection), but the comment misleads. | A reader trusts the wrong status code. | Fix the comment: "404 for another Engineer's estimate, 403 for a Lead or an Admin". Optionally drop the `lockEstimate` in `submit` and read the estimate from what `transition`/`store` already lock. | n/a |
| SQR-08 | Info | `tests/integration/calc/calculate-timing.test.ts:49`; `tests/perf/calc-500-nodes.test.ts` (new block) | STORY-03.06 AC-4, NFR-008 | The perf test now times `calculation-service.calculate` on PostgreSQL. That is the full service path (nodes, check, masters in `tx`, 500 inserts, status), and it stays off the per-PR path (`tests/perf/` is excluded). AQP-294 is done. Two notes. (a) The per-PR integration test asserts `maxMs < 5 s`, which is a timing assertion on a shared runner, despite 03.06 AC-4. It is loose, but it can flake under load. (b) Both timings stub the configuration read and leave out the HTTP layer (session, CSRF, schema). | Small under-measure; flake risk. | Keep the print, and drop or widen the per-PR bound if it flakes. Use the real configuration read (SQR-03) in the perf path. | n/a |
| SQR-09 | Info | `src/lib/fields/visibility.ts` (pre-existing, used here) | AC-1 hidden rule | `isFieldShown` compares exactly: Fasteners "none" (lower case) shows Qty and Cost, so they become needed. It is consistent with the form's hint ('Type "None"') and with the 05.05 helper. Not a defect of this PR. | The person types "none" and gets two extra needed fields. | Product-owner: decide whether the match ignores case (05.05 or hardening). | n/a |
| SQR-10 | Info (praise) | whole server path | NFR-002, #382, AQP-299 | One transaction. The state machine decides first. The answer is two constants behind a two-literal strict schema. The 422 is rebuilt field by field. Deleted rows answer specific 409s under the lock. Materials are read in one `findMany`. The nested-transaction guard counts every `run`, and the 12-at-once PostgreSQL test fails if a second connection were taken. A link failure rolls back record, rows **and** status on PostgreSQL. The import rule classes `calculation-masters` as blocked. | — | — | — |
| SQR-11 | Info | GitHub #382 | Forward items | **#382 is not fully closed by this PR.** SQR-01 (the issue's title), SQR-02 and SQR-08 are closed here (SQR-03 remains as a minor test hardening). The issue body also tracks SQR-03 to SQR-07 and a flaky-test note for the hardening window. | — | Orchestrator: at merge, comment on #382 that SQR-01/02/08 are done by #403, and keep it open (or retitle it) for SQR-03 to SQR-07 and the flaky test. | — |

## Security scope verdicts
| Point | Result | Evidence |
|-------|--------|----------|
| One transaction, no second connection | Yes | `calculate` → `storage.transactions.run(submit)`. Every repository call in `submit`/`store`/`run`/`readMasters` takes `tx` (`clientFor(db, tx)` in `customer-repository` `readCustomerForCalculation` + `ratesOf`, `exchange-rate-repository` `readRows`, `material-repository` `readMaterialsForCalculation`, `config-repository` `findLatestRef`/`findById`). Transactions opened per Calculate: 1 (unit `opened() === 1`); connections: 1 (integration, 12 at once on pool 10) |
| Nested-transaction detection test | Yes | `countingRunner` in `calculation-record.test.ts` and the fixture runner in `calculate-service.test.ts` throw on a nested `run` |
| Lock order vs setCustomer, saveInputs, deleteMaterial, deleteCustomer | No cycle | Calculate: estimate `FOR UPDATE` (via `lockEstimate`), then lock-free reads, then FK key-share on `config_versions`/`users`. setCustomer/saveInputs: estimate → customer/material `FOR SHARE`. deleteCustomer: customer `FOR UPDATE` → plain read of estimates. deleteMaterial: `LOCK TABLE materials SHARE ROW EXCLUSIVE` → plain reads. Calculate takes no master lock |
| 422 writes nothing, names only Sl. No, part name, field IDs and labels | Yes | `CalculateBlockedError` thrown before any insert; `transition`'s status write is rolled back (unit `expectNothingWritten`, integration `expectNothingWritten`); `problem.ts` maps `{nodeId, slNo, name, fields:[{fieldId,label}]}` only |
| AC-5 order | Yes | role/owner/status → blanks (422) → customer (409) → masters (409/404). Unit and integration "blank beside a 0 in QTY" |
| AC-7 double press | Yes | client `inFlight` ref; server row lock + machine's `ESTIMATE_ALREADY_SUBMITTED`; unit and integration "two at once" → one record; E2E double click |
| Response exactly `{status, message}` | Yes | `calculateAnswerSchema` = strict object of two literals; `calculate-route.test.ts` refuses an extra key, another status and another message; canary journey `toEqual` |
| No calculated number in any Engineer response, page, log or error body | Yes by inspection; **scan gap SQR-02** | No Engineer route reads `calculations`. No new `logger`/`console` call in `src`. Error texts are fixed. `TRANSITION_REFUSALS` texts hold no figure |
| Canary journey + two master sets give identical bodies | Yes (journey); identical bodies asserted in unit, route, integration and E2E | `canary-scan.spec.ts` two new tests; `canary-scan-gate.test.ts` lists them |
| Deleted customer/material → specific 409 under the lock | Yes | `readMasters` inside `tx` after `transition`; `CUSTOMER_DELETED`/`MATERIAL_DELETED`; unit, route, integration |
| Unified 409 code does not weaken tests | Yes | only `ESTIMATE_APPROVED` → `ESTIMATE_APPROVED_IS_LOCKED` in `calculation-record` unit + integration; the assertions stay as strict; the material-delete integration assertion moved from `toBeNull` to `deleted: true` (it matches the new contract and is not weaker) |
| Manifest, role matrix, strict schema, CSRF, recipes, import rule | Yes | manifest row `roles: ['ENGINEER']`; `SPEC_ACCESS`, `route-loaders`, `route-calls` (422 recipe), composition mocks in the 4 security suites; `ENGINEER_ROUTES` updated; `calculation-masters` blocked. Strict-schema planted-key loop skips the success body (decision 12); the route test covers it instead |

## Quality: AC conformance
| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `validateForCalculate` (`calculate-check.ts`), `CalculateBlockedError`, `problem.ts` `parts`, `calculate-summary.tsx`, tree/card/strip/field markers | `calculate-validation.test.ts` (65), `calculate-service.test.ts`, `calculate-route.test.ts`, integration `calculate.test.ts`, E2E `estimate-calculate.spec.ts` | Pass (SQR-04 minor) |
| AC-2 | `calculation-service.calculate`/`submit`/`store`, `calculateAnswerSchema`, route | unit, route, integration (record, rows, link, status, revision), E2E, canary | Pass in server; **SQR-01** (client may submit stale inputs) |
| AC-3 | `readField` (zero is a value) | validation unit, service unit (all zeros) | Pass |
| AC-4 | `transition(…, 'CALCULATE', tx)`, `CUSTOMER_NOT_CHOSEN`, `NO_PARTS`, `CUSTOMER_DELETED`, `MATERIAL_DELETED` | unit, route, integration (each with nothing written; link failure rolls back status) | Pass |
| AC-5 | blanks checked before the customer and before any quantity rule | unit + integration | Pass |
| AC-6 | strict schema, fixed sentence, no Engineer path to `calculations`, page "Submitted", read-only | route test (no digit), unit, canary journey | Pass by inspection; **SQR-02** (scan does not include calculated outputs) |
| AC-7 | `useCalculate` in-flight ref; row lock; machine 409 | unit, integration (two at once), E2E double click | Pass |
| AC-8 | `tests/perf/calc-500-nodes.test.ts` full path (on demand); `calculate-timing.test.ts` (PR path, loose) | perf (not run per PR), integration timing printed | Pass (SQR-08 info) |
| AC-9 | `calculate-bar.tsx` (`data-sticky-bar`), `focusCalculate`, summary focus, `aria` labels | `estimate-calculate.spec.ts` (3 widths, axe 0 in blocked and submitted states, no sideways scroll, Enter), `estimate-form-sections.spec.ts` | Pass (SQR-06 minor) |

## Quality notes
- **Hidden fields, zeros, defaults.** Fasteners T/U go through the shared `isFieldShown`. They are not needed while S is blank or "None", and are read as `0.00` whatever is stored. Part Model C is never needed (it is not a typed field of the form). Zero is a value everywhere, QTY per Assy included (05.12 adds the warning). Defaults are read through the field's rule (AQP-304 SQR-03): all covered by unit tests, and the hidden-0 case also on PostgreSQL.
- **Would the tests fail if:** a cost leaked into the answer → yes (literal schema, route test, no-digit unit test). A calculated figure leaked onto a later page → **no** (SQR-02). A partial write happened → yes (rollback tests on fake and PostgreSQL, link failure after rows). A second connection were opened → yes for masters (12-at-once), unit-only for the configuration read (SQR-03). A nested transaction → yes (counting runner).
- **Design.** Moving `readMasters` into `calculation-masters.ts` and `validateForCalculate` into `calculate-check.ts` (to keep the browser bundle small) is justified and documented. The A-1 rule ("needed follows the form") is a sound way to keep the screen and the server in agreement.

## Forward items
| Item | Closed by this PR? |
|------|--------------------|
| #382 / AQP-293 SQR-01 (masters in caller's tx, materials in one query) | **Yes** (code). Test gap for the configuration read on PostgreSQL: SQR-03 (Minor) |
| AQP-293 SQR-02 (nested-transaction test) | **Yes** |
| AQP-293 SQR-08 (`createdById` = session user; one configuration read) | **Yes** |
| AQP-299: `transition(viewer, id, 'CALCULATE', tx)` in the same tx as the store | **Yes** |
| AQP-299 SQR-06: unify "approved" 409 on this path | **Yes** (`ESTIMATE_APPROVED_IS_LOCKED`; status enums of SQR-06 stay open) |
| AQP-294: perf test at the full path | **Yes** (service path on PostgreSQL; on demand, off the PR path; SQR-08 info) |
| AQP-304 SQR-03: defaults through the field's rule | **Yes** |
| AQP-306 / #390: deleted customer/material → specific 409 | **Yes** |
| 05.05 note: shared `isFieldShown` | **Yes** (applied directly; 05.05 not merged) |
| **#382 fully closed?** | **No.** It also tracks SQR-03 to SQR-07 and a flaky test for the hardening window. Comment at merge, keep it open. |

## Issues for other roles
- **developer:** fix SQR-01 and SQR-02 before merge (both small). SQR-03 to SQR-07 now or in the hardening window.
- **orchestrator:** after the fix, ask for a short re-review of the new diff only. At merge, comment on #382 (SQR-01/02/08 done) and keep it open.
- **product-owner:** SQR-09 (should the Fasteners "None" match ignore case?).
- **reviewer-performance (final review):** the triple `lockEstimate` and the per-part `findFieldByKey` in `nameOf` (SQR-07) are micro-costs. The timing coverage is in SQR-08.

## Hand-off
- Status: COMPLETE
- Verdict: REQUEST CHANGES (Blocker 0, Critical 0, Major 2, Minor 5, Info 4)
- Recommended next agent: developer (fix SQR-01, SQR-02), then reviewer-quality to re-review only the new diff

## Round 2: re-review of PR #406 (dba5372, DL-215 re-cut of #403; review fix a3b27b4 = bf2abd7), 2026-11-15
| Field | Value |
|---|---|
| Verdict | APPROVE WITH COMMENTS (no Blocker, Critical or Major open) |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/406#pullrequestreview-5908501620 |
| CI | run 43663902865, 6 of 6 green; 9,175 tests with coverage; changed-code coverage 95.7 %; JS 198,987 of 200,000 B |
| Method | GitHub MCP only: commit a3b27b4, the re-cut hunks (material-repository, fake-masters, row-outputs, not-applicable-options), and #406 compared file by file against #403 |

| Round-1 ID | Status | Evidence |
|---|---|---|
| SQR-01 Major | Verified | save-gate.ts (track, mark, forget, settle); use-part-form tracks queueRef and marks refused, unreadable and failed values; useCalculate waits for settle(); 8 unit tests; E2E held save and refused value |
| SQR-02 Major | Verified | readCalculatedValues + forbiddenCalculated; scan from the press on; list must not be empty; planted-leak control; 10 unit tests |
| SQR-03 Minor | Verified | harness reads the configuration in tx |
| SQR-04 Minor | Verified | blank E named once; 2 unit tests |
| SQR-05 Minor | Verified | quantity-hint.ts; E2E |
| SQR-06 Minor | Verified | useLazyComponent returns `failed`; notice shown |
| SQR-07 Minor | Verified | docblock 404/403; decision 6 corrected |
| SQR-09 Info | Open | product-owner question (Fasteners "None" case) |

New in round 2: SQR-12 Minor (canary has no rounded whole-rupee forms; add comma-grouped rounded forms for figures of 10,000 or more; hardening), SQR-13 Minor (settle() has no time limit; failed-save notice wording; hardening), SQR-14 Info (fake reader does not return the hidden "Not applicable" row; hardening).
Counts for round 2: Blocker 0, Critical 0, Major 0, Minor 2, Info 1. Merged as 292c850 (orchestrator, 2026-11-15). #382 stays open.
