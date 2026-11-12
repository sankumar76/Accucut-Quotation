# Review Report — AQP-142 (STORY-02.02: Customers) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-142-customers` (PR #297; merged base b710741; `master` now 6b1883f) |
| Commit reviewed | efcf768e3148386167c42da0017d7439e2651ea9 (efcf768) |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** (no code change asked; one Major is about the CI path and is routed to the orchestrator, architect and product-manager) |

## Summary
The customer data path is clean. Every query is set-based: a customer's rates load in one query, the list counts the rates that differ in the same single query, a new customer's rates are one `INSERT ... SELECT`, a save writes all changed rates in one `UPDATE ... FROM unnest`, and the Process Master add and delete sync are one statement each in the item's own transaction. There is no N+1, no per-rate write, no `SELECT *`, and every audit entry uses the change's transaction. The migration creates two empty tables, so it locks nothing that exists. First-load JS is 176,675 B and 177,269 B gzip against 200,000.

The open point is time in CI, not the code. This PR's first attempt took **6:37**, above the 5:30 that starts a median of five (test strategy 10.5 item 5, item 9 AC-5). About 19 to 28 s of the 82 s above `master`'s push run is this story's 53 new test instances (estimate); the rest is a slower host draw (the 799 tests common to both runs ran 13.0 % slower) and a `next build` that restored its cache by prefix (about 14 s, which any source-changing PR pays). One run proves nothing, but the level of `master` (5:15 on the push, 5:16 on AQP-89's head) plus this story's share puts a `master` head after the merge at about 5:40 (estimate). RISK-023 stays at 8; the fourth-shard step is, in all likelihood, due. See "RISK-023 and CI time".

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (PRF-01, CI path; no change to this PR) |
| Minor | 1 (PRF-02, customer volume not stated; owner product-manager) |
| Info | 3 (PRF-03, PRF-04, PRF-05) |

## Checks Run
No `npm ci`, no local build or database (by instruction: none provided). The review worked from the diff at efcf768 (`git diff b710741 efcf768`, 36 files under `src/`, `prisma/`, `scripts/`), the CI job logs and the jobs API. Query plans were **not** run; the figures for the list query are estimates and are labelled so.

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff read in full: repository, service, migration, schema, routes, list and edit screens, hooks, JS-budget scripts, E2E set-up | `git show efcf768:<path>` | No loop around a query, no per-row write, no unbounded write; list read is unbounded (PRF-02) |
| PR run, jobs | `gh run view 43170187169 --json jobs` | Start 06:43:56Z (`Stages 1 to 11b`), fan-in end 06:50:33Z: **6:37**. Shards 6:12 / 6:26 / 6:11 (06:43:57Z to 06:50:09Z / :23Z / :08Z). `Stages 1 to 11b` 4:14. Fan-in starts 3 s after the last shard |
| Base run, jobs | `gh run view 43169697211 --json jobs` | 06:39:51Z to 06:45:05Z: **5:14**. Shards 5:00 / 4:24 / 5:05. `Stages 1 to 11b` 3:49 |
| Slack (item 11) | slowest shard end minus end of `Stages 1 to 11b` | PR 133 s (06:50:23Z minus 06:48:10Z); base 75 s. Over 20 s: the main job is not the next lever |
| Cache state | `Cache restored` / `Cache not found` lines of the six E2E jobs | Hit in every job; `node_modules` and Playwright caches hit; Next.js build cache: exact key on the push, **restore-key (prefix) on the PR** |
| Step times per shard | job logs 131021354875 / -922 / -148 (PR), 131019773129 / -193 / 772837 (base) | E2E step 298.4 / 285.2 / 293.3 s on the PR, 249.2 / 211.4 / 252.9 s on the base: mean +54.5 s, slowest shard +45 s. `next build` 21.6 / 21.7 / 22.7 s against 7.1 / 6.3 / 8.1 s. Set-up project (route warm-up incl. `warmCustomerRoutes`) 10.8 / 11.2 / 12.8 s against 10.8 / 8.6 / 11.9 s: no visible cost |
| Per-test times | `list` reporter lines, parsed by file | PR: 852 timed instances, 2,909 s summed; base: 799, 2,377 s. The 799 common instances: 2,685 s against 2,377 s (**+13.0 %**). The 53 new ones: 224 s summed (`customers` 24 / 139.6 s, `customers-focus` 12 / 38.8 s, `masters-table-actions` 11 / 36.1 s, `canary-scan` 6 / 9.4 s), 4.2 s each on average against 3.0 s for the suite |
| `Stages 1 to 11b` detail | job 131021354766 against 131019773140 | Stage 6 unit 45.1 against 42.9 s; Stage 9 build 22.8 against 9.1 s (same cache effect); Stage 11 integration 108.1 against 102.5 s for +237 Vitest tests |
| Stage 11b (JS budget), the Decision 6 cost | same two jobs | 3.2 s in both runs (11 rows against 9, with the sign-in and the POST in the PR): not measurable (PRF-04) |
| First-load JS | stage 11b rows, both runs | `/masters/customers` 176,675 B, `/masters/customers/[id]` 177,269 B (headroom 23,325 and 22,731). Existing routes rose by 72 to 238 B (`/` +72, `/audit` +238, `/masters/materials` +183 to 187,607 with headroom 12,393, `/masters/process` +185, `/users` +232); the shared `form-field.tsx` change is the likely cause (hypothesis). All 11 rows within 200,000 |
| Nightly | `gh run list --event schedule` | Latest is 42981687193 on 225a1c9 (2026-11-11 07:44Z), with 11 runs in its window (fewer than 13): median 4:41, p95 5:09. None yet on b3403e3 or later at 07:08Z |
| Reruns of the PR workflow | not done | Test strategy 10.5 item 5 gives the median of five to the orchestrator; a reviewer does not run it (see below) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Major | `tests/e2e/customers.spec.ts:212` (the reset tests); CI path | NFR-009 (CI feedback, 10 min agreed; 6 min early warning); RISK-023; test strategy 10.5 items 5, 9, 11; DL-151 | This PR's first attempt took 6:37, 82 s above `master`'s push (5:14) and above the 5:30 that starts a median of five. The 53 new instances sum to 224 s (about 19 to 28 s of path, estimate). The other ~55 s is not this code: common tests ran 13.0 % slower (about 26 to 38 s) and `next build` took ~14 s longer on a prefix cache hit | One draw (sd 26 to 42 s on unchanged code) proves nothing alone, but the level of `master` (5:15, 5:16) plus the story's ~25 s gives about 5:40 on a `master` head after the merge (estimate), at or over 5:30. Not an NFR breach: 6:37 is well inside the 10-minute target. Over the 6-minute early warning on this one run | No change to this PR. The orchestrator runs the four full re-runs of efcf768 and posts the five paths with slowest shard and slack. The two reset tests are the heaviest in the run (6 instances of 10.6 to 11.8 s, 66 s summed, 29 % of the story's test time); trim them first if a trim is wanted |
| PRF-02 | Minor | `src/server/repositories/customer-repository.ts:179-191` | NFR-011 (capacity); NFR-010; NFR-009 | The PRD states no customer count (NFR-011 gives users and nodes only). The list is unbounded: no limit, whole list in the first paint, filtered in the browser. The query is one statement | Assumption used: 500 customers x 50 items = 25,000 rate rows, ~15 to 40 ms, ~125 KB raw / 15 to 20 KB gzip in the page (estimates). Inside NFR-010 and NFR-009. No issue at a few hundred | Owner **product-manager**: state the expected and maximum customer and item counts in NFR-011. If the maximum is above ~500, add `limit`/`offset` and a server-side name search before release |
| PRF-03 | Info | `src/server/services/customer-service.ts:177, 193, 220` | Architecture section 6 (lock order); AC-4 | Every customer create, edit and reset takes `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE` first, including a no-op save and a reset of 0 | Admin-only, a few statements, a few ms; reads are not blocked. Not measurable at 50 users | None now. For any later bulk path (import, script), take the lock once per batch |
| PRF-04 | Info | `scripts/lib/js-budget-records.ts:54-62`; `scripts/check-js-budget.ts:78` | Test strategy 10.1; NFR-009 | Decision 6's CI cost, measured: stage 11b 3.2 s with it and 3.2 s without | Below the log's resolution (~0.1 s); each request bounded at 30 s | None for performance. `--base-url` write: STD-03 (standards) |
| PRF-05 | Info | `prisma/migrations/20261111120000_customers/migration.sql:44` | Architecture section 4.9 (indexes) | `idx_customer_rates_customer_id` duplicates the leading column of the unique index at line 50 | One extra index write per rate row; not measurable at this size | None required; drop it if the story's index list is reopened |

### The customer data path (no finding)
- **Queries (N+1 and writes).** `ratesOf` is one join of `customer_rates` and `process_items` per customer. `listCustomers` is one `LEFT JOIN ... GROUP BY` with the differing-rate count (`count(*) FILTER (...)`), so no per-customer query. `insertCustomer` is the insert, one `INSERT ... SELECT` for all rates, and one read of the rates (three statements). `setRates` writes every changed rate in one `UPDATE ... FROM unnest(...)` and checks the row count. `addProcessItemToCustomers` and `removeProcessItemFromCustomers` are one statement each. A save is about 8 statements and 5 to 8 round trips: lock, customer `FOR UPDATE` (two reads), details update, rates update, audit. At a few ms each on one host that is well inside NFR-010 (p95 500 ms at 25 concurrent) even if every statement were 20 ms (estimate).
- **Transaction scope and AQP-237's audit rule.** All three `audit.record` calls take the change's `tx`; the lock order (Process Master table lock, then the customer row) is the same in all three paths and in the Process Master's add and delete, so there is no deadlock cycle and no long wait. The lock is held only for the statements above (PRF-03).
- **Indexes and migration.** `uq_customers_name_lower` (case-insensitive name, also the race backstop), `uq_customer_rates_customer_id_process_item_id` (serves the rates read and the update), `idx_customer_rates_process_item_id` (serves the AC-4 delete and the foreign key). `ORDER BY lower(name)` sorts a small table; no index is needed at the assumed size. The migration is additive on empty tables; the previous image keeps running. No query filters or sorts on an unindexed column that matters.
- **List size handling.** First paint carries the list (RSC), the search is client-side, the Add dialog and the reset dialog are fetched on first press (NFR-009). See PRF-02 for the missing bound.
- **Client re-reads (`useMasterList`).** One `GET /api/v1/customers` after an add (latest read wins, so overlapping reads are dropped), none after an edit or reset on the edit page (the PATCH and the reset answer with the whole customer), and a fresh server render when the person comes back to the list. No poll, no timer, no repeated read. The rates table re-renders its 15 to 50 rows on each keystroke (a state map in one hook); that is a few ms and not worth a finding.
- **`/api/v1/options/customers`.** One query of ID and name, no rates; fine for a drop-down. It is not cached, which is right while the Admin can add a customer at any time.
- **Process Master item sync (AC-4).** `INSERT ... SELECT c.id, pi.id, pi.default_value FROM customers c CROSS JOIN process_items pi WHERE pi.id = $1` is O(customers) in one statement; at 500 customers it writes 500 rows and three index entries each, a few tens of ms (estimate), once per item added. It includes soft-deleted customers on purpose (they can come back).

### RISK-023 and CI time
**Reading.** Run 43170187169, first attempt, merge ref of efcf768 into the PR base: 6:37 path (slowest shard 6:26), 3 s from the last shard to the fan-in. `master` push run 43169697211 (6b1883f): 5:14. The PR's measure is "first job start to end of `Stages 1 to 11`", as in DL-151.

**Where the 82 s came from (estimates from the job logs; not a controlled measurement).**

| Part | Path effect | Basis |
|------|-------------|-------|
| This story's 53 new instances | about +19 to +28 s | 224 s summed, divided by 12 workers (3 shards x 4), up to 1.5 times for wall against summed time (test strategy 10.5 item 9). The story's own plan was +40 to +55 instances; the count was +53 |
| Host draw on the same tests | about +26 to +38 s | 799 common instances: 2,685 s against 2,377 s (+13.0 %); the per-shard E2E step rose by 54.5 s on average of which the new tests explain ~25 to 37 s. The CPU model is in the job summary, not in the log, so the host line was not read |
| `next build` on a prefix cache hit | about +14 s | 21.6 to 22.7 s against 6.3 to 8.1 s. The push restored the exact `nextjs-` key; the PR restored by restore-key because its sources changed. Every source-changing PR pays this; the comparison base (a push) does not |
| Set-up per shard (Node, Stage 12a) on the slowest shard | about +20 s (shard 2 only) | `Set up Node.js` 12.3 against 3.2 s, Stage 12a 12.8 against 3.0 s; noise of the draw |

The first three parts add up to ~60 to 80 s, which matches the 82 s observed. **A fair base for a PR is another PR run, not a push**: the AQP-89 head ran 5:16 (DL-166) and #235 5:22 (DL-150), both PR runs (their cache state was not read here).

**What the rules say, and who acts.**
- Test strategy 10.5 item 5 (PR trigger, as sharpened by item 9 AC-5): a story's first attempt of 5:30 or more starts it, with **four full re-runs of the head**, and the **median of five** decides; each run with a `miss` or `fallback` is replaced under DL-128 (4). The re-runs are the **orchestrator's**, not a reviewer's. I did not re-run the workflow. **The median of five is needed; the orchestrator runs it** on efcf768 (or on the head after any fix push), posts the five paths, each run's slowest shard and host line, and the slack of item 11.
- Fourth-shard gate (item 9): (a) a median of five on a `master` head over 5:00, and (b) the next nightly median over 5:00 (at least 13 runs). (a) is very probably met already without this story: `master` read 5:34 as a median of five at b3403e3 (DL-151), and single reads since are 5:15 and 5:16 (estimates of the level, not a median of five). (b) is open: the latest nightly (42981687193) covers only 11 runs with a median of 4:41, below the 13 needed and on older code; today's nightly is expected 07:00 to 08:30Z and is the orchestrator's to post.
- DL-151 (4): "the enabler merges before AQP-142's G6" was a recommendation to the product-manager, not a hold. No fourth-shard story exists or has merged, so that order has not been kept. A hold is not warranted now (DL-125, DL-142 (1)): the story's own share is ~25 s, the code has no performance defect, and the enabler cannot merge before this G6.

**Consequence and recommendation (for master).**
1. **RISK-023 stays at 8** (P 4 x I 2). Do not raise it: impact stays 2 because the 10-minute target of NFR-009 is not near (6:37 worst single run). The estimated level of a `master` head after AQP-142 merges is about **5:40** (estimate), so the "trigger as ruled" (a median of five on a head at 5:30 or more) is likely to be met by the orchestrator's median of five, and the register's "raise again to 8" rule needs nothing more because it is already 8.
2. **Do not hold AQP-142 at G6 for this.** No Blocker or Critical; the only Major is a CI-time fact with no fix in the PR.
3. **The fourth-shard step should be treated as due, in order:** the orchestrator posts the median of five on this head and today's nightly; if the nightly median over at least 13 runs is over 5:00, the **architect applies the fourth-shard rule** (guard figure at most 1.30 times the billed minutes, the `ci-workflow` pin to `[1, 2, 3, 4]`) and the **product-manager places the EPIC-10 enabler with the scrum-master to merge before the next E2E-adding story after AQP-142**, not before this G6. The expected gain of 35 to 50 s of path (test strategy 10.5 item 9) is about 1.5 to 2 stories of this size, so it should be followed by the architect's next lever, not left as the end of the line.
4. If the nightly median is 5:00 or less, the architect records why the step waits (DL-151 (3)), and the median of five on this head still decides whether the "next step is due" trigger fires.
5. Ask the developer for nothing on CI time in this PR. The `@one-width` route would save at most ~3 s of path for the 12 `customers-focus` instances (estimate) and needs an architect ruling; not worth it.

### What was not done
- Query plans and timings of the list query: no local or test database was given, so the 15 to 40 ms figure is an estimate.
- No re-run of the workflow, no local build: reruns are the orchestrator's (item 5) and the disk is limited by instruction.
- Lighthouse (LCP, TBT) of the new pages: the nightly Lighthouse runs on the existing routes only; the JS budget is the check available at G6 (NFR-009).
- Host line of each job (CPU model is in the job summary page, not in the log).

## NFR impact
| NFR ID | Risk | Finding IDs |
|--------|------|-------------|
| NFR-009 (pages: first-load JS 200,000 B gzip; LCP/TBT) | Low: 176,675 / 177,269 B, headroom 22.7 to 23.3 KB; existing routes +72 to +238 B (`/masters/materials` headroom 12,393 B, the tightest) | — |
| NFR-009 (CI feedback, 10 min agreed, 6 min early warning, RISK-023) | Medium: single run 6:37, estimated level ~5:40 on `master` after merge; 10-minute target not near | PRF-01 |
| NFR-010 (server p95 500 ms at 25 concurrent) | Low: set-based statements, ~5 to 8 round trips per write, one query per read | PRF-03 |
| NFR-011 (capacity: 50 users, 25 concurrent, 500 nodes) | Low, unquantified for customers | PRF-02 |
| NFR-002 (confidentiality) | Out of scope here (cross-reference: standards/quality; the options route returns IDs and names only) | — |

## Previous Findings (re-review only)
Not applicable (round 1).

## Issues for other roles
- **product-manager:** NFR-011 has no customer count or Process Master item count (PRF-02). Place the fourth-shard enabler if the architect's rule fires (PRF-01).
- **solution-architect:** apply item 9's fourth-shard rule if tonight's nightly median is over 5:00; the PR/push base difference from the `nextjs-` prefix cache (about 14 s per source-changing PR) belongs in the reading rule of item 9 so PR runs are compared with PR runs.
- **orchestrator:** the median of five on efcf768 (four full re-runs, `miss` and `fallback` replaced) and today's nightly; DL-151's note that the enabler should precede this G6 was not met and should be recorded as such.
- **reviewer-standards:** STD-03 (`--base-url` writes a customer) is the only side effect of the JS-budget deviation; performance has no objection to the deviation itself (PRF-04).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-142/performance.md` (uncommitted, on `docs/AQP-1-records-sprint1-j`); PR #297 review (COMMENT, verdict in the body); label `review:performance-approved`
- Jira / GitHub updates: PR #297 review with inline PRF-01 to PRF-05; Jira AQP-142 hand-off comment (see the run summary)
- Open questions: customer and item counts (PRF-02, product-manager)
- Risks raised: RISK-023 stays at 8 (recommendation above); no new risk
- Recommended next agent: orchestrator — median of five on efcf768 and today's nightly; then master — G6 with standards and quality; solution-architect and product-manager if the nightly is over 5:00
