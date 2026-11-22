# Review Report — FINAL (whole product) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 (the one full review of the whole product, CLAUDE.md section 9 item 3, hardening window) |
| Base…branch | whole tree at `master` (detached read-only worktree `final-review`) |
| Commit reviewed | `242c21f7` (PR #564 was the last build story) |
| Date | 2026-11-21 |
| Jira | AQP-1 (Intake); AQP-371 and AQP-370 ACs folded in by DL-249 |
| Updated | 2026-11-21: G8-C-NFR9 figures recorded and PRF-F-02 and PRF-F-03 re-graded on them (DL-281); see "G8-C-NFR9 measurement (2026-11-21)" |
| **Verdict** | **REQUEST CHANGES** (four Major findings still open, all to be fixed, or accepted by the delivery lead in writing, before G8; no Blocker, no Critical). First issued with six Major; PRF-F-02 is resolved by measurement and PRF-F-03 is now Minor (2026-11-21) |

## Summary

The code is sound for the stated planning volumes on the paths I could read: every hot read and write is indexed or keyed, results are bounded or keyset-paged, the audit and outbox statements are single round trips, transactions are short and use one connection, the pool and statement limits are explicit, the export runs on a capped worker thread behind a gate, and the first-load JavaScript passes the 200 KB guard on every route (largest 189 KB, shell 163.8 KB). I found no N+1 on a user-facing path and no missing index on a hot query.

What is wrong is mostly **evidence and structural costs**. NFR-010 and NFR-011 have never been measured at 25 users or at the 500-customer volume (STORY-10.09's load ACs are not built), and the 500-node export (about 1 GB, 14 to 67 s) has no accepted figure for the target host. As first issued, this review also found that NFR-009's LCP and TBT had never been measured on any of the five key screens (`KEY_SCREENS` was empty) and that the Customers list, which draws every customer twice, was likely over TBT at 500 customers (an estimate). **Both were settled on 2026-11-21 by the G8-C-NFR9 measurement (PR #584, Nightly run 44908595359): all five key screens meet NFR-009 with wide margin, and the Customers list at 500 customers has a TBT median of 40 ms.** Two items remain likely to breach an NFR at the planning figures: default propagation at 500 customers (known, #568) and the 500-node export on a modest host (#575). One resource-exhaustion path is also open: every `/api` request may be buffered up to 10 MB before any cap (#410).

This review ran nothing (no database, no perf suite, no workflow, as instructed). Figures are therefore of three kinds, labelled in each finding: **measured by others** (DL-271, AQP-365, the CI log of stage 11b and the nightly Lighthouse job, which I read), **read from code**, and **estimate**.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 4 open (PRF-F-01, 04, 05, 06: #573, #575, #568, #410). First issued as 6: PRF-F-02 (#485) is resolved by measurement and PRF-F-03 (#574) is downgraded to Minor, both on 2026-11-21 |
| Minor | 7 (PRF-F-03 joins the six first issued) |
| Info | 2 |

## Checks Run

| Check | Command or source | Result |
|-------|-------------------|--------|
| Read of code at 242c21f7 | `src/server/{repositories,services,jobs,export}`, `src/worker`, `prisma/schema.prisma` and the 24 migrations, `src/components/features/{estimate-workspace,masters}`, `next.config.ts`, `src/proxy.ts`, deploy service files | Findings below |
| Index review | every `@@index` and `CREATE INDEX` against the queue, audit, estimate tree, calculation, outbox, overdue and digest statements | No missing index on a hot query (see "Verified, no finding") |
| First-load JS per route | CI "Stages 1 to 11b", run 44892640890 (green, master 877baffd, two commits before 242c21f7; the run for 242c21f7, 44899114212, had not finished when read) | 21 routes PASS; smallest headroom 10,766 B (`/masters/materials`) |
| Lighthouse | nightly run 44884087674 (2026-11-21) | Only `/` measured: LCP median 187 ms and TBT 0 ms (first table), 627 ms and 0 ms (second) |
| Lighthouse, key screens (added 2026-11-21) | Nightly run 44908595359, job 136859353597, PR #584 head `00115c09`, read from the PR body and the comments on #485 and #574 (not run by me) | All five key screens meet NFR-009; see the measurement section below |
| Existing perf evidence | DL-271 (export, AQP-335), AQP-365 combined review (propagation), architecture sections 4.6 and 7 | Quoted where used |
| Tests, load, Lighthouse, EXPLAIN | not run by this review | n/a: read-only, no database, no runs (instruction) |

## Findings

| ID | Severity | File:line (242c21f7) | NFR | Issue | Evidence | Suggested fix | GitHub |
|----|----------|----------------------|-----|-------|----------|---------------|--------|
| PRF-F-01 | **Major** | `tests/perf/` (no load script); `.github/workflows/nightly.yml` (no capacity job) | NFR-010, NFR-011 | The 25-user latency line, the 25 and 50 user capacity run, the page-latency-during-export run and the 500 x 50 master-data volume run have never been run. STORY-10.09 AC-1 to AC-4 and AC-9 are not built; #330 is not built. | `tests/perf` holds only `calc-500-nodes`, `export-500`, `export-50x50`, `export-concurrency`, `export-memory`. AQP-371 is To Do. Architecture section 7 NFR-010 row: "the 500 ms target is unmeasured". Estimate: a hot read is a primary-key session read plus 1 to 4 indexed statements, about 10 to 40 ms against a pool of 10 (`prisma-client.ts:43`), so headroom looks large; it is unproved. | Build the Node load script of test strategy 8.1 and 8.2 (closed loop, 1 s think time, warm-up dropped, nearest-rank p95), the AC-4 case, the #330 volume check and the own-password line, as a non-required nightly job; the qa-engineer runs and records it. | #573 (new) |
| PRF-F-02 | ~~Major~~ **Resolved by measurement (2026-11-21)** | `lighthouserc.cjs:32` `const KEY_SCREENS = [];` | NFR-009 | LCP <= 2 s and TBT <= 200 ms are unverified on all five key screens (G8-C-NFR9, DL-251). The 200 KB guard is not evidence of TBT. | Only `/` is in the nightly Lighthouse table (187 ms and 0 ms). Guard figures (gzip, limit 200,000): `/queue` 187,484; `/assign` 178,357; `/masters/customers` 179,427; `/masters/materials` 189,234; `/estimates/[code]` 185,564; costs view 167,895; shell `/` 163,790. The earlier shell-only reading (184.6 KB, TBT 0.4 to 0.5 s on the old Slow 4G profile) says more script costs processor time. This review could not measure: reviewers write only docs and no workflow may be run by me. | Developer adds the five screens (with invented data for the dynamic routes and a 500-customer fixture for `/masters/customers`) to `KEY_SCREENS`; the nightly job runs; the reviewer reads median LCP and TBT of 5 per screen and the run IDs. A miss on a screen is at least Major (DL-251). | #485 (commented) |
| PRF-F-03 | ~~Major (estimate)~~ **Minor (measured, 2026-11-21; watch on document size)** | `src/components/features/masters/customer-list.tsx:141-146` | NFR-011, NFR-009 | `CustomerList` draws the table and the phone cards for the same items; CSS hides one, but both are created and hydrated (`'use client'`). At 500 customers that is about 13,500 DOM elements and about 20,000 fibers in one task. | Per row about 15 elements in the table plus about 12 in a card. Estimate (not measured): 0.05 to 0.1 ms per element, 4x on the NFR-009 profile = 300 ms to 1.3 s of main-thread work against TBT <= 200 ms. The same pair exists in `material-list.tsx`, `process-list.tsx`, `treatment-list.tsx` (200, 50, 50 rows). DEF-053 measured the same pattern on the Users list: about 17,000 DOM nodes at 650 people. | Draw one layout: a single table that stacks into cards by CSS below 768 px (preferred), or choose the layout with a media-query hook and render only that one; then run #330 (c). | #574 (new) |
| PRF-F-04 | **Major** | `src/server/export/build-workbook.ts:117,145`; `src/server/export/thread-runner.ts:57,61`; `src/server/http/file-response.ts:31` | NFR-010 (500-node case unstated), NFR-011, NFR-012 | 500-node export: about 1 GB resident, 14.3 to 67.4 s (DL-271), the file built in memory twice and answered as one body; the thread is killed at 120 s; the target host is unmeasured; the Windows service sets no memory limit. RISK-010 (4) and G8-C-NFR10. | DL-271 measurements on the delivery PC (24 GB): file 97.5 MB, 0.8 to 1.05 GB, median about 22 s. 120 s is 1.8x the slowest run, taken on a shared PC. ADR-015 planning table: 8 GB of RAM. Estimate: a host 2x slower reaches the timeout for the largest estimates. `AccucutApp.xml` sets no heap or memory limit. | Architect chooses: accept after re-reading AC-1 and AC-2 on the target host and set the timeout from that reading; or cap by pictures or size; or stream (ExcelJS `WorkbookWriter`). | #575 (new, labelled `architecture`) |
| PRF-F-05 | **Major** | `src/server/services/default-propagation-service.ts:151`; `src/server/repositories/master-repository.ts:121` | NFR-010 | Default propagation at 500 customers writes one audit INSERT per customer in a loop, inside the transaction that holds `LOCK TABLE process_items ... SHARE ROW EXCLUSIVE`: 1.5 to 1.8 s. | AQP-365 SQR-01: about 3 ms per entry, 500 customers, measured on local Docker (`process-propagation-volume.test.ts`). Confirmed in code at 242c21f7. The 10 s limit (`transaction.ts:50`) would roll back whole at very large counts (no data risk). | `recordMany` (as the architecture says) or, cheaper, keep per-entry validation and write the validated rows with one multi-row INSERT; re-measure at 500. If the architect rules otherwise, an NFR-010 exception by the product-manager. | #568 (existing, commented) |
| PRF-F-06 | **Major (estimate)** | `next.config.ts` (no `proxyClientMaxBodySize`); `src/proxy.ts:77` | NFR-012, NFR-010 | Every `/api` request, signed in or not, can make the app buffer up to 10 MB before any route cap. 100 concurrent requests are about 1 GB on a process with no heap limit. | Read from code: matcher covers all but sign-in, reset pages, `api/auth`, static files; no body cap configured. Open as #410 (security review SQR-01, Major) since AQP-315. | Set `proxyClientMaxBodySize` above the picture cap (256 KB) and the largest legitimate JSON body, plus a limit in the reverse proxy the installer writes. | #410 (existing, commented) |
| PRF-F-07 | Minor | `src/components/features/estimate-workspace/tree-panel.tsx:132`; `tree-node.tsx:35` | NFR-009 (INP not an NFR figure) | `TreeNode` is not memoised and `onFocus` calls `tree.select`, so each selection re-renders every row (500 typical, 2,000 at the cap). | About 6 elements and 3 components per row: about 3,000 elements at 500 parts; estimate 30 ms desktop, about 120 ms on the profile, per arrow key; 4x that at 2,000 parts. | `React.memo(TreeNode)` with a stable `onFocusPart`, and compare `selected` and `missing` only. | none (Minor) |
| PRF-F-08 | Minor | `src/server/services/audit-service.ts:172-173`; `src/server/repositories/audit-repository.ts:154`; `prisma/schema.prisma:140-141` | NFR-010 | Each audit page request, including "load more", also runs `count(filter)`; the event-category filter (`event IN (...)`) has no index, so a rare category walks the `created_at` index to the end and the count scans the table. | Read from code. Estimate: tens of ms at 100,000 rows, over 500 ms only beyond about 1 million rows; propagation writes 500 rows a save, so growth is bursty. | Count only on the first page (no cursor); add `(event, created_at DESC, id DESC)` if the volume check shows a slow category. | none |
| PRF-F-09 | Minor | `src/server/repositories/task-repository.ts:384-399`; `src/app/(portal)/layout.tsx:22` | NFR-010, NFR-011 | The queue's three counts and the bell's overdue count scan every task ever made (the Admin scope has no narrowing; the closed tab is all approved tasks). Cost grows with history, which has no archive. PRD gives no task volume. | Read from code. Estimate: a few ms at 10,000 tasks, tens of ms at 50,000, per page render. | Measure in the #573 run at 50,000 seeded tasks; if needed add a partial index on `estimates (task_id) WHERE status <> 'APPROVED'` or cache the bell count for a minute. **PRD gap (owner: product-manager):** state tasks per year. | none |
| PRF-F-10 | Minor | `src/server/http/file-response.ts:37`; `src/app/api/v1/images/[id]/route.ts` | NFR-009, NFR-010 | A picture is immutable under its ID but is served `Cache-Control: no-store`, so every part view re-downloads up to 200 KB and re-runs the ownership and bytes reads. | Read from code. 50 views of 100 KB pictures = 5 MB per estimate walk. | `private, max-age=86400, immutable` for the picture route only (the picture is not Restricted); keep the ownership check on every request. | none |
| PRF-F-11 | Minor | `prisma/schema.prisma:381,406,512`; `src/server/repositories/calculation-repository.ts:235-266` | NFR-013 | Growth is dominated by data nothing prunes: pictures as `bytea` (a replaced picture is never removed), a full copy of the tree on every Calculate (500 rows with inputs and outputs), and outbox rows with bodies (no DELETE grant). The backup capacity model uses invented rates of 0.02 to 0.5 GB a week. | Estimate: 50 pictures of 200 KB is 10 MB an estimate; 20 estimates a day is about 1 GB a week, above the model's top row (2 years of weekly copies fit only while data stays under about 0.5 GB). Real counts unknown. | Product-manager asks for estimates per week and the mean picture size (the PRD has neither, OQ-PM-08 style); architect re-runs the 9.9 table; release notes state the "Disk nearly full" action. Becomes Major if the weekly volume is above about 0.25 GB. | none |
| PRF-F-12 | Minor | `src/server/repositories/calculation-repository.ts:359-389`; `src/server/services/export-service.ts:162-203` | NFR-010 | The export summary page reads every row's `inputs` and `outputs` JSON and parses each twice (zod) to show a count and totals; the file path does the same. At 500 nodes that is about 2.5 MB per page view (estimate). | Read from code. Lead and Admin only, one page. | Select only the columns the summary needs; keep the full read for the file. | none |
| PRF-F-13 | Info | `src/server/services/calculation-service.ts:301-312` | NFR-008 | The calculation (engine p95 136 to 153 ms at 500 nodes, architecture 7) and the tree builders run on the main event loop, so they block other requests for their duration; at the 2,000-part cap the engine is about 4x that (estimate). Acceptable: Calculate is excluded from NFR-010 and rare. | Architecture section 7; `MAX_PARTS_PER_ESTIMATE`. | None now; if the load run shows Calculate delaying reads, move it to a worker thread as the export is. | none |
| PRF-F-14 | Info | `src/server/export/thread-runner.ts:106-107,143`; `src/server/composition.ts:501`; `src/server/repositories/prisma-client.ts:107-111` | NFR-010 | The export gate counters live in a module closure. The repository's own note says Next bundles each route separately. The gate is right while exactly one route (`/api/v1/estimates/[id]/export`) calls `getFile`; a second caller would get its own counters and the limit of one large build would not hold. The concurrency test is at service level, not HTTP. | Read from code. | A comment at `getExportService` and a route-manifest test that only one route calls `getFile`; or keep the counters on `globalThis` as the Prisma client does. | none |

## NFR Impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-008 (500 nodes under 2 s) | Low. Engine 136 to 153 ms measured by others; full path timed on demand (`calc-500-nodes.test.ts`, not in CI); event-loop cost noted. | PRF-F-13 |
| NFR-009 (LCP, TBT, 200 KB) | **Low (was High, unverified; re-graded 2026-11-21).** Guard met on every route; LCP and TBT measured on all five key screens at the planning volume, all met (worst median LCP 312 ms, worst median TBT 70 ms; worst single TBT 154 ms). The Customers list is met at 500 customers. Residual: the 3.4 MB document at 500 customers and a TBT spread of 10 to 154 ms on that page. | PRF-F-02 (resolved), PRF-F-03 (Minor, watch), PRF-F-07, PRF-F-10 |
| NFR-010 (p95 500 ms at 25 users; export 50 nodes 10 s) | **Medium.** Export 50 nodes met (p95 2.85 s). Reads and saves look comfortable by code but were never run; propagation save breaches 500 ms at 500 customers; unbounded body buffering. | PRF-F-01, PRF-F-04, PRF-F-05, PRF-F-06, PRF-F-08, PRF-F-09, PRF-F-12, PRF-F-14 |
| NFR-011 (50 users, 500 nodes, 500 x 50 masters) | **Medium.** Server load not run at the volume; export at 500 nodes. The page-render half is now measured: the Customers list at 500 customers and 25,000 rates meets NFR-009 (the NFR's own check, "the Customers list screen meets NFR-009"). | PRF-F-01, PRF-F-03 (Minor), PRF-F-04, PRF-F-09 |
| NFR-012 (99 % availability) | Low to medium: memory pressure from the export and from body buffering. | PRF-F-04, PRF-F-06 |
| NFR-013 (backup retention) | Medium (planning gap): growth inputs invented. | PRF-F-11 |
| NFR-024 (observability) | Low: error line has request ID and user ID, `onRequestError` exists, jobs use one wrapper, health reads the heartbeat (read, not run). | none |

## G8-C-NFR9 measurement (2026-11-21)

Added on master's DL-281 (4): the condition is met when this report records the figures and #574 is re-graded on them. **I did not run anything.** The figures are read from PR #584's body (and the developer's comments on #485 and #574); the run is the workflow's, not mine. Where I judge, I say so.

**Run of record.** Nightly run 44908595359, job "Lighthouse reference run" 136859353597, PR #584 head `00115c09`, Chromium 158.0.0.0, benchmarkIndex 2847 (9.7 % from B0 2595: comparable). Profile (read from `lighthouserc.cjs` on the PR branch): Lighthouse mobile form factor, 360 x 800 viewport, simulated throttling, Wi-Fi `rttMs` 40, `throughputKbps` 10,240, `cpuSlowdownMultiplier` 4; targets LCP at most 2,000 ms and TBT at most 200 ms, median of 5 (NFR-009). The Wi-Fi step passed its assertions. The PR head has since moved to `7b84ee4d` (it brings in #571); the figures stay those of the run on `00115c09`, as DL-281 (4) allows ("#584's measurement run or the first nightly run on `master` after the merge").

| Key screen | Address, role | Data it reads | LCP median (min to max), ms | TBT median (min to max), ms | NFR-009 |
|---|---|---|---|---|---|
| Task queue | `/queue`, Admin | 300 tasks over 25 Engineers, 500 customers as filter options | 312 (293 to 321) | 0 (0 to 7) | met |
| Assign | `/assign`, Admin | 25 Engineers | 194 (191 to 218) | 0 (0 to 112) | met |
| Masters (Customers list) | `/masters/customers`, Admin | 500 customers, 25,000 rates | 290 (290 to 291) | 40 (10 to 154) | met |
| Workspace | `/estimates/Q-2099-0001`, Engineer (owner) | one Draft estimate of 500 parts | 189 (187 to 276) | 70 (18 to 150) | met |
| Cost view | `/estimates/Q-2099-0002/costs/1`, Admin | one calculated estimate of 500 parts | 242 (240 to 252) | 0 (0 to 27) | met |
| Shell (reported only) | `/`, Admin | | 188 | 0 | not asserted |

Slow 4G (report only, does not decide): LCP 627 to 1,100 ms, TBT 0 to 92 ms (queue 967 / 1, assign 630 / 0, customers 1,100 / 92, workspace 629 / 26, cost view 803 / 0, shell 627 / 0). Customers page HTML: 3,360 KB, 82 KB gzipped.

**Margins.** Worst median LCP 312 ms is 16 % of the 2,000 ms limit; worst median TBT 70 ms (workspace) is 35 % of the 200 ms limit. The closest single runs are TBT 154 ms (customers) and 150 ms (workspace), 77 % and 75 % of the limit. No run of any screen is over a limit.

**Assumptions (labelled; master accepted them in DL-281 (4)).**
1. **Workspace measured as the owning Engineer.** The workspace (SCR-05) is the Engineer's screen; a Lead or Admin who opens the same address gets the review (SCR-06), which is not in the key-screen list and is **not measured**. The Lead's and Admin's view of costs is the cost view, measured separately.
2. **Queue at 300 tasks over 25 Engineers.** No stated task volume exists (PRD NFR-011 gives users and nodes only; PRF-F-09 already asks the product-manager for tasks per year). 300 tasks is about 12 open per Engineer, and 25 Engineers is half of NFR-011's 50-user ceiling. It is the developer's figure, not a fact about Accucut.
3. **Both estimates at 500 parts**, the NFR-011 node count, not a typical size. The cost view is one part's cost details read from a calculated 500-row estimate.
4. **Planning volume of NFR-011** for the Customers list: 500 customers and 25,000 rates, invented values. That is above the 400-customer revisit trigger, so the reading is taken at the ceiling.
5. The profile is the NFR's simulated one (4x processor slowdown on a CI runner of benchmarkIndex 2847). It is not a real phone. NFR-009 itself names "a recent phone, at most 3 years old" as an assumption (not benchmarked).

**Not covered by this measurement.** The review screen (SCR-06) as Lead or Admin; the Customers edit page (one customer's 50 rates) and the Materials, Process and Treatment lists (smaller, 200 / 50 / 50 rows, same table-and-cards pattern); `/masters/materials` (first-load JS headroom 10,766 B, the smallest); pages at the 2,000-part cap; the effect of real network or a real phone.

### Re-grade of PRF-F-02 (#485): resolved by measurement

The finding was "LCP and TBT unverified on all five key screens" (G8-C-NFR9, DL-251). They are now measured on all five, at the NFR-011 planning volume, on the pass/fail profile, and all meet NFR-009 with wide margin. **PRF-F-02 is resolved on the evidence.** What stays outside it is housekeeping: PR #584 is still open (it merges on its next green run), so `KEY_SCREENS` on `master` is empty until then, and the issue should close with the merge, not before. After the merge the nightly job asserts the five screens every night (Wi-Fi step, median of 5), which is the standing guard; the first nightly on `master` after the merge is the confirming reading, if master wants it for the record. **I leave #485 open for master's G8 list** (condition met on master's closing of G8-C-NFR9; no code change needed from me).

### Re-grade of PRF-F-03 (#574): Major (estimate) to Minor (measured), watch on document size

The finding was an estimate: both layouts drawn, about 13,500 DOM elements and about 20,000 fibers at 500 customers, "300 ms to 1.3 s of main-thread work against TBT <= 200 ms". **The measurement contradicts the estimate.** At 500 customers and 25,000 rates the page has TBT 40 ms (five runs: 10, 18, 40, 96, 154) and LCP 290 ms on the pass/fail profile, with the 4x slowdown I assumed. My per-element cost was too high, and the measurement supersedes it. The NFR-011 check ("the Customers list screen meets NFR-009; a failure at 500 customers goes to the product-manager as a paging proposal") is **met**, so the likely-breach basis for Major is gone and no scope-change proposal arises.

Why Minor and not closed: the structural cost is unchanged (`customer-list.tsx:141-146` still draws table and cards; the page HTML is 3,360 KB, 82 KB gzipped, with 2x DOM), and the measured TBT spread is wide (10 to 154 ms; the worst of five is 77 % of the limit). On a slower real phone or a larger list the page would be the first key screen to cross. A Minor watch costs nothing and keeps that visible.

- **Watch condition (PROPOSED, for master and the product-manager):** re-measure `/masters/customers` when the Admin's list passes the 400-customer trigger of NFR-011, or when the median TBT reading in the nightly report (the page is a key screen, so it is read every night) passes 100 ms, or when the document passes 4 MB (about 600 customers at the measured 6.7 KB per customer). Any of these reopens it as Major with the new figures.
- **Fix, when it is touched:** unchanged (one table that stacks into cards by CSS, or a media-query hook that draws one layout). It is not needed for NFR-009 now, so it is not a pre-G8 item.
- **#574 stays open** (labelled `tech-debt`, Minor, watch), because the cost remains; it is not resolved fully. Master may close it at G8 as an accepted watch.

## Verified, no finding

- **Indexes.** Task queue: `idx_tasks_engineer_id_deadline_at`, `idx_tasks_assigned_by_deadline_at`, `idx_tasks_deadline_at`, `idx_estimates_status`, `idx_estimates_customer_id` serve the scope, deadline order and customer filter; the result is keyset-paged with `take: limit`. Audit: keyset on `(created_at DESC, id DESC)` with `idx_audit_log_created_at` and `idx_audit_log_actor_id`. Estimate tree: `idx_estimate_nodes_estimate_id`, `idx_estimate_nodes_parent_id`; one read per request; `placeNodes` is one `UPDATE ... FROM unnest(...)`. Calculation rows: unique `(calculation_id, node_id)` and `(calculation_id, sort_index)`, inserted 1,000 per `createMany`. Outbox claim: `idx_email_outbox_status_next_attempt_at`, one statement with `FOR UPDATE SKIP LOCKED`, `LIMIT 25`; no row held in a transaction during SMTP. Overdue scan and digest: range on `idx_tasks_deadline_at`, `NOT EXISTS` on the unique idempotency key.
- **Locks and transactions.** Estimate row lock per estimate only; master table locks are held by Admin writes only (and the propagation case in PRF-F-05); `task_sequences` upsert is one row per year and short; calculation, approval, unlock and cancel run under one connection with master reads inside the transaction (the AQP-293 SQR-01 fix is in; #382 remains open only for its minor items). Transaction limit 10 s, wait 5 s, statement 10 s (app), idle-in-transaction 30 s.
- **Pool.** App 10, worker 3, script 2 (`prisma-client.ts:41-60`); one shared client on `globalThis`; 25 users x one request a second at 10 to 40 ms is about 0.25 to 1 busy connection (estimate); PostgreSQL's default of 100 connections is far above 15.
- **Algorithms.** `buildTree`, `insertNode`, `moveNode`, `removeNodes`, `descendantIds` are O(n log n) or O(n) with n at most 2,000; `canMove` is O(n) per move; field re-lettering is over about 65 fields. No quadratic path at the planning figures.
- **Caching and memory.** Configuration versions (16) and compiled plans are bounded; latest version costs one indexed read per request; heartbeat rows are pruned at 7 days by a bounded SQL function; pictures are read in batches of `READ_MANY_LIMIT` and the buffers handed to the thread.
- **Worker jobs.** Overdue scan every minute, idle cost is two small statements; empty runs write no `job_runs` row; the outbox lease is 5 minutes (the lease versus send time item stays #505).
- **Front end.** 200 KB guard passes on every route; no `next/image`, fonts self-hosted, logo cached 1 day; Next compresses the standalone server's responses.

## STORY-10.09 (AQP-371) AC check (DL-249, DL-275 A8)

| AC | Result | Note |
|----|--------|------|
| AC-1 latency at 25 users | **Not built** | PRF-F-01 |
| AC-2 own-password line | **Not measured** | 515 ms for two argon2id operations is AQP-81's figure; no script; host reading is OQ-3 |
| AC-3 capacity at 25 and 50 | **Not built** | PRF-F-01 |
| AC-4 page latency during an export | **Partly evidenced** | DL-271 AC-3: 66 probes (database round trip plus event-loop lag), slowest 32 ms, at service level and 120 nodes; not 25-user p95 reads |
| AC-5 errors logged with user ID | Met by reading | `with-route.ts:139-149,218` (`userId`), `instrumentation.ts:38` (`onRequestError`); `tests/unit/observability-faults.test.ts` exists; not run |
| AC-6 job runs and one wrapper | Met by reading | `run-job.ts`; `tests/unit/job-wrapper.test.ts` exists |
| AC-7 health sees a dead worker | Met by reading | `src/app/api/health/route.ts`, 3-minute window in `lib/health/heartbeat.ts:18`; `health-route.test.ts`, `health-heartbeat.test.ts` exist |
| AC-8 "Uptime monitor" section in the Windows README | **Not found** | `deploy/windows/README.md` has no such section (a documentation gap, not a Done gate per AC-8); developer or architect |
| AC-9 nightly "Capacity and latency" job | **Not built** | PRF-F-01 |
| AC-10 no real data or secret | Not applicable until the script exists | |

## Areas covered and not covered

**Covered (read):** repositories and services for tasks, estimates, calculation, approvals, masters, audit, outbox, overdue, digest, export, images; worker jobs and wiring; pool and transaction settings; schema and migrations (indexes); Next config and proxy matcher; masters list and estimate workspace tree components; deploy service files; CI logs for the JS budget and Lighthouse; DL-249, DL-251, DL-271, DL-275, risk RISK-010 and RISK-020, test plan section 7, issues #330, #418, #485, #568, #410, #563.

**Not covered, and why:** no run of any kind (instruction), so no EXPLAIN plan, no timing of the 25-user, 50-user, 500-customer or 500-node cases, no Lighthouse on the key screens (as first issued; the figures were added on 2026-11-21 from run 44908595359, read not run), no heap profile; the 242c21f7 CI run was unfinished, so the JS figures are from the run two commits earlier; the configuration editor screens (EPIC-08) and the Admin hand-over and restore scripts were read for locks and loops only, not for runtime cost; the e-mail transport timeouts (the lease item stays #505); Windows host CPU and disk speed (unknown, OQ-ARCH-14 and Q-18); the real mailbox send (STORY-09.08). Items the product-manager must supply: tasks per year, estimates per week, mean picture size (PRF-F-09, PRF-F-11).

## Previous Findings

**Re-grade of 2026-11-21 (DL-281):** PRF-F-02 resolved by measurement; PRF-F-03 Major (estimate) to Minor (measured, watch). The other eleven findings are unchanged. First final review; findings carried in from other records, not re-judged: #568 (PRF-F-05), #410 (PRF-F-06), #485 (PRF-F-02), RISK-010 and G8-C-NFR10 (PRF-F-04). Other open items I looked at and left where they are: #563 (nightly `test:perf`, after G8), #545, #559 (SQR-04 unbounded checkpoint list, Minor), #524, #505, #506, #418 (headroom now 14,436 B on `/estimates/[code]`, rule of 10,000 B met), #61, #60 (unbounded `login_throttles` rows), #330 (see PRF-F-01 and PRF-F-03).

## Issues for other roles

- product-manager: tasks per year, estimates per week, mean picture size and an NFR-011 statement for task and audit volume (PRF-F-09, PRF-F-11); the NFR-010 treatment of a propagation save if the architect keeps the loop (PRF-F-05); OQ-PM-05 for the 500-node export (PRF-F-04).
- solution-architect: PRF-F-04 choice (accept with a derived timeout, cap or stream); PRF-F-05 `recordMany` or batched insert; PRF-F-06 limit in the reverse proxy file; re-run the capacity table of 9.9 with real volumes.
- developer (hardening window): PRF-F-01 load script and jobs, PRF-F-05 and PRF-F-06 fixes, README "Uptime monitor" section. (PRF-F-02 `KEY_SCREENS` is done in #584, merge pending; PRF-F-03 single layout is no longer needed before G8.)
- product-manager (added 2026-11-21): the PRF-F-03 watch condition (400 customers, TBT median over 100 ms, or a 4 MB document) and the queue's task volume (PRF-F-09), which the 300-task assumption stands in for.
- qa-engineer: run and record the load, volume and 500-node timings (PRF-F-01, PRF-F-04) with machine and run IDs; re-read the export AC-1 and AC-2 on the target host (G8-C-NFR10).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final/performance.md`
- Jira / GitHub updates: issues #573 (PRF-F-01), #574 (PRF-F-03), #575 (PRF-F-04); comments on #485 (PRF-F-02), #568 (PRF-F-05), #410 (PRF-F-06); AQP-1 comment. 2026-11-21 re-grade: comments on #485 and #574, AQP-1 comment
- Open questions: none new (OQ-PM-05 and OQ-3 stay open)
- Risks raised: none new; RISK-010 (PRF-F-04) and RISK-020 (PRF-F-02) evidence added; 2026-11-21: the NFR-009 evidence on RISK-020 is now measured (all five key screens met), for master to re-grade
- Recommended next agent: developer, for the hardening-window fixes (PRF-F-01, 05, 06), with solution-architect first on PRF-F-04 and PRF-F-05; then qa-engineer for the measurements. master: close G8-C-NFR9 when #584 merges
