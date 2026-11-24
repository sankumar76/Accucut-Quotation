# DEF-082: `ensureCanaryCustomers` (`tests/support/customer-canary-loader.ts:25`, the `INSERT_RATES` statement) fails with `fk_customer_rates_process_item_id` when another E2E case deletes a Process Master item in the same milliseconds; the case that called it fails attempt 1 at about 150 to 250 ms and the retry passes (type Test; DRAFT: Jira and GitHub items NOT yet created, PARTIAL)

| Field | Value |
|-------|-------|
| Story / AC | None. No AC fails: the failing cases are `queue-actions-visible.spec.ts:227` (DEF-077, AQP-420) and, on 22 Nov, `rates-changed.spec.ts:252`; the failure is in their shared set-up, before any assertion. The concurrent deleter is `process-propagation.spec.ts` (DEF-080, AQP-423). |
| Severity | **Sev-3 Moderate (proposed, qa-engineer, 2026-11-24; test plan section 6: a flaky test, type Test, that has not turned a required check red).** Both occurrences passed on retry and both runs ended `success`. |
| Priority | P3 (Jira Medium, label `sev-3`) when created |
| Type | **Test** (the loader's raw SQL has no lock against a concurrent delete). **Product excluded by a static read, not by a run:** the product's own `createCustomer` takes `lockProcessItems` (`LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`, `customer-service.ts:205`, `master-repository.ts:119`) before the same `INSERT ... SELECT FROM process_items`, and every Process Master change takes the same lock first, so the two serialise. The test loader does not take it. |
| Status | **DRAFT (PARTIAL).** Paused on the orchestrator's request before the Jira Bug and the GitHub issue were created. Next free DEF number checked: DEF-082 is free in Jira (JQL on `aiid-DEF-082`) and in `gh issue list`. Create per playbook 4.5 and 5.4, linked to AQP-420 (the case that failed) and AQP-423 (the deleter), relates to AQP-1. |
| Found by / date | qa-engineer, 2026-11-24, from the orchestrator's brief (PR #702 run 45433342408, shard 4 job 138584714448) |
| Environment | GitHub-hosted runner, Stage 12 shard 4, `[desktop]`, production build, 4 workers, one shared PostgreSQL 17 per shard job |

## Occurrences (job logs read, ANSI stripped; no re-run)
| # | Run (head, event) | Job | Case that failed attempt 1 | Deleter at that instant | Result |
|---|---|---|---|---|---|
| 1 | 44975646581 (16ff2a2a, PR `docs/AQP-1-cr01-ux`), 22 Nov 02:23:02.5Z | shard 3 job 137064822631 | `rates-changed.spec.ts:252` [tablet], no. 78, 155 ms | `process-propagation.spec.ts:109` [tablet] (the unsplit case), no. 74, passed and logged at 02:23:02.5247Z | retry no. 80 passed 3.5 s; run `success` |
| 2 | 45433342408 (b7bb6f6e, PR #702), 24 Nov 16:24:48.795 UTC (DB clock) | shard 4 job 138584714448 | `queue-actions-visible.spec.ts:227` [desktop], no. 371, **240 ms**, at `customer-canary-loader.ts:25` via `ensureCanaryCustomers` (`auth.ts:497`), `engineerWithEstimate`, `estimateInStatus` | `process-propagation.spec.ts:252` [desktop], no. 366 (new in #702), `cleanUp` `DELETE` of its rate at +8701 ms, logged 16:24:48.800Z, test line 16:24:48.833Z (8.7 s) | retry no. 373 passed 8.9 s; shard `1 flaky, 559 passed (13.2m)`; run `success` |

**Row 2 identification.** The PostgreSQL log in the job names the missing key: `Key (process_item_id)=(eedd82cd-68ac-4d29-9477-47b5b367af11) is not present in table "process_items"` at 16:24:48.795 UTC, statement `INSERT INTO customer_rates ... SELECT $1::uuid, id, default_value FROM process_items ON CONFLICT DO NOTHING`. The `[AQP-423 step timing]` lines show that id as the rate the `:252` case PATCHed (step ended at +5148 ms, log 16:24:45.249Z, so the test started about 16:24:40.10Z), and that same test's `cleanUp DELETE rate -> 204` is logged at 16:24:48.800Z, 5 ms after the database error. The other desktop propagation case (`:178`, no. 365) works on 7417524a-3651-4238-9a63-e7e185a3bf27 and ends at 16:24:55.7Z. Mechanism: under READ COMMITTED the `SELECT` takes its snapshot with item X in it; the `DELETE` of X commits; the foreign-key check at the insert then finds no X.

**Older than #702 and #700.** Row 1 (22 Nov) is the same signature on the unsplit case, before #700 (Promise.all, `c7faf76f`) and #702. The loader's header comment says it is safe with other specs that "added" items; deletes are not covered.

## Is #702 the cause?
**Not the cause; an exposure raised by one step.** The race needs a concurrent item delete, and the unsplit case already did one per width (row 1). #702 gives each width two such create-and-delete cycles instead of one, and the new `:252` case is short (8.7 s), so more deletes now land among the early `ensureCanaryCustomers` calls of other cases. A fix is not a #702 revert. QA does not rank how much #702 raised the rate: the scan of earlier runs (below) found one other occurrence only.

## Scan of earlier runs (PARTIAL)
`gh api .../actions/jobs/<id>/logs` for every completed non-cancelled `Stage 12: E2E` shard job (latest run attempt only) of the `ci.yml` runs created from 21 Nov 12:07Z (the 400 most recent runs), grep for `fk_customer_rates_process_item_id`. Read when paused: 1,001 of 1,212 jobs; **2 hits in total: row 1 and row 2** (the scan stopped counting at the pause; the remaining 211 jobs are not read). Earlier run attempts of re-run runs are not covered. The `Stages 1 to 11b` job logs carry deliberate foreign-key errors from the integration tests (21 on a15e60ce) and were not scanned for this.

## Binding and lane (proposal; master rules)
`tests/support/customer-canary-loader.ts` is a shared support file used by the E2E set-up (`tests/e2e/support/auth.ts:497`); the standing Test-Bug binding bars changes to support files without master first (DL-370 (5)). **Lead for the fix, not a finding:** run the loader's statements in one transaction that takes `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`, as the product does. No retry, wait, budget or assertion change. **Proof (proposed):** 0 hits of the error in the shard jobs of the fix PR's run of record and the first two `master` pushes. No lane is proposed before master rules on whether a Sev-3 with two occurrences in three days needs one.

## Records
Jira and GitHub: **not created (PARTIAL).** Related: AQP-420 (DEF-077), AQP-423 (DEF-080), AQP-1; PR #702 run 45433342408; RISK-031 not touched (PR run; the case passed on retry).
