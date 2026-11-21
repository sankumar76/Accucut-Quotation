# Review Report — FINAL (whole product) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 (the one full review of the whole product, CLAUDE.md section 9 item 3, hardening window) |
| Base…branch | whole tree at `master` (detached read-only worktree `final-review`) |
| Commit reviewed | `242c21f7` (PR #564 was the last build story) |
| Date | 2026-11-21 |
| Jira | AQP-1 (Intake); AQP-371 and AQP-370 ACs folded in by DL-249 |
| **Verdict** | **REQUEST CHANGES** (six Major findings, all to be fixed, or accepted by the delivery lead in writing, before G8; no Blocker, no Critical) |

## Summary

The code is sound for the stated planning volumes on the paths I could read: every hot read and write is indexed or keyed, results are bounded or keyset-paged, the audit and outbox statements are single round trips, transactions are short and use one connection, the pool and statement limits are explicit, the export runs on a capped worker thread behind a gate, and the first-load JavaScript passes the 200 KB guard on every route (largest 189 KB, shell 163.8 KB). I found no N+1 on a user-facing path and no missing index on a hot query.

What is wrong is mostly **evidence and two structural costs**. NFR-010 and NFR-011 have never been measured at 25 users or at the 500-customer volume (STORY-10.09's load ACs are not built), NFR-009's LCP and TBT have never been measured on any of the five key screens (`KEY_SCREENS` is still empty), and the 500-node export (about 1 GB, 14 to 67 s) has no accepted figure for the target host. Two code costs are likely to breach an NFR at the planning figures: default propagation at 500 customers (known, #568) and the Customers list, which draws every customer twice (new, estimate). One resource-exhaustion path is also open: every `/api` request may be buffered up to 10 MB before any cap (#410).

This review ran nothing (no database, no perf suite, no workflow, as instructed). Figures are therefore of three kinds, labelled in each finding: **measured by others** (DL-271, AQP-365, the CI log of stage 11b and the nightly Lighthouse job, which I read), **read from code**, and **estimate**.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 6 (three new issues: #573, #574, #575; three existing issues commented: #485, #568, #410) |
| Minor | 6 |
| Info | 2 |

## Checks Run

| Check | Command or source | Result |
|-------|-------------------|--------|
| Read of code at 242c21f7 | `src/server/{repositories,services,jobs,export}`, `src/worker`, `prisma/schema.prisma` and the 24 migrations, `src/components/features/{estimate-workspace,masters}`, `next.config.ts`, `src/proxy.ts`, deploy service files | Findings below |
| Index review | every `@@index` and `CREATE INDEX` against the queue, audit, estimate tree, calculation, outbox, overdue and digest statements | No missing index on a hot query (see "Verified, no finding") |
| First-load JS per route | CI "Stages 1 to 11b", run 44892640890 (green, master 877baffd, two commits before 242c21f7; the run for 242c21f7, 44899114212, had not finished when read) | 21 routes PASS; smallest headroom 10,766 B (`/masters/materials`) |
| Lighthouse | nightly run 44884087674 (2026-11-21) | Only `/` measured: LCP median 187 ms and TBT 0 ms (first table), 627 ms and 0 ms (second) |
| Existing perf evidence | DL-271 (export, AQP-335), AQP-365 combined review (propagation), architecture sections 4.6 and 7 | Quoted where used |
| Tests, load, Lighthouse, EXPLAIN | not run by this review | n/a: read-only, no database, no runs (instruction) |

## Findings

| ID | Severity | File:line (242c21f7) | NFR | Issue | Evidence | Suggested fix | GitHub |
|----|----------|----------------------|-----|-------|----------|---------------|--------|
| PRF-F-01 | **Major** | `tests/perf/` (no load script); `.github/workflows/nightly.yml` (no capacity job) | NFR-010, NFR-011 | The 25-user latency line, the 25 and 50 user capacity run, the page-latency-during-export run and the 500 x 50 master-data volume run have never been run. STORY-10.09 AC-1 to AC-4 and AC-9 are not built; #330 is not built. | `tests/perf` holds only `calc-500-nodes`, `export-500`, `export-50x50`, `export-concurrency`, `export-memory`. AQP-371 is To Do. Architecture section 7 NFR-010 row: "the 500 ms target is unmeasured". Estimate: a hot read is a primary-key session read plus 1 to 4 indexed statements, about 10 to 40 ms against a pool of 10 (`prisma-client.ts:43`), so headroom looks large; it is unproved. | Build the Node load script of test strategy 8.1 and 8.2 (closed loop, 1 s think time, warm-up dropped, nearest-rank p95), the AC-4 case, the #330 volume check and the own-password line, as a non-required nightly job; the qa-engineer runs and records it. | #573 (new) |
| PRF-F-02 | **Major** | `lighthouserc.cjs:32` `const KEY_SCREENS = [];` | NFR-009 | LCP <= 2 s and TBT <= 200 ms are unverified on all five key screens (G8-C-NFR9, DL-251). The 200 KB guard is not evidence of TBT. | Only `/` is in the nightly Lighthouse table (187 ms and 0 ms). Guard figures (gzip, limit 200,000): `/queue` 187,484; `/assign` 178,357; `/masters/customers` 179,427; `/masters/materials` 189,234; `/estimates/[code]` 185,564; costs view 167,895; shell `/` 163,790. The earlier shell-only reading (184.6 KB, TBT 0.4 to 0.5 s on the old Slow 4G profile) says more script costs processor time. This review could not measure: reviewers write only docs and no workflow may be run by me. | Developer adds the five screens (with invented data for the dynamic routes and a 500-customer fixture for `/masters/customers`) to `KEY_SCREENS`; the nightly job runs; the reviewer reads median LCP and TBT of 5 per screen and the run IDs. A miss on a screen is at least Major (DL-251). | #485 (commented) |
| PRF-F-03 | **Major (estimate)** | `src/components/features/masters/customer-list.tsx:141-146` | NFR-011, NFR-009 | `CustomerList` draws the table and the phone cards for the same items; CSS hides one, but both are created and hydrated (`'use client'`). At 500 customers that is about 13,500 DOM elements and about 20,000 fibers in one task. | Per row about 15 elements in the table plus about 12 in a card. Estimate (not measured): 0.05 to 0.1 ms per element, 4x on the NFR-009 profile = 300 ms to 1.3 s of main-thread work against TBT <= 200 ms. The same pair exists in `material-list.tsx`, `process-list.tsx`, `treatment-list.tsx` (200, 50, 50 rows). DEF-053 measured the same pattern on the Users list: about 17,000 DOM nodes at 650 people. | Draw one layout: a single table that stacks into cards by CSS below 768 px (preferred), or choose the layout with a media-query hook and render only that one; then run #330 (c). | #574 (new) |
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
| NFR-009 (LCP, TBT, 200 KB) | **High (unverified).** Guard met on every route; LCP and TBT never measured on a key screen; the Customers list is likely over TBT at 500. | PRF-F-02, PRF-F-03, PRF-F-07, PRF-F-10 |
| NFR-010 (p95 500 ms at 25 users; export 50 nodes 10 s) | **Medium.** Export 50 nodes met (p95 2.85 s). Reads and saves look comfortable by code but were never run; propagation save breaches 500 ms at 500 customers; unbounded body buffering. | PRF-F-01, PRF-F-04, PRF-F-05, PRF-F-06, PRF-F-08, PRF-F-09, PRF-F-12, PRF-F-14 |
| NFR-011 (50 users, 500 nodes, 500 x 50 masters) | **Medium.** Not run at the volume; Customers list render cost; export at 500 nodes. | PRF-F-01, PRF-F-03, PRF-F-04, PRF-F-09 |
| NFR-012 (99 % availability) | Low to medium: memory pressure from the export and from body buffering. | PRF-F-04, PRF-F-06 |
| NFR-013 (backup retention) | Medium (planning gap): growth inputs invented. | PRF-F-11 |
| NFR-024 (observability) | Low: error line has request ID and user ID, `onRequestError` exists, jobs use one wrapper, health reads the heartbeat (read, not run). | none |

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

**Not covered, and why:** no run of any kind (instruction), so no EXPLAIN plan, no timing of the 25-user, 50-user, 500-customer or 500-node cases, no Lighthouse on the key screens, no heap profile; the 242c21f7 CI run was unfinished, so the JS figures are from the run two commits earlier; the configuration editor screens (EPIC-08) and the Admin hand-over and restore scripts were read for locks and loops only, not for runtime cost; the e-mail transport timeouts (the lease item stays #505); Windows host CPU and disk speed (unknown, OQ-ARCH-14 and Q-18); the real mailbox send (STORY-09.08). Items the product-manager must supply: tasks per year, estimates per week, mean picture size (PRF-F-09, PRF-F-11).

## Previous Findings

First final review. Findings carried in from other records, not re-judged: #568 (PRF-F-05), #410 (PRF-F-06), #485 (PRF-F-02), RISK-010 and G8-C-NFR10 (PRF-F-04). Other open items I looked at and left where they are: #563 (nightly `test:perf`, after G8), #545, #559 (SQR-04 unbounded checkpoint list, Minor), #524, #505, #506, #418 (headroom now 14,436 B on `/estimates/[code]`, rule of 10,000 B met), #61, #60 (unbounded `login_throttles` rows), #330 (see PRF-F-01 and PRF-F-03).

## Issues for other roles

- product-manager: tasks per year, estimates per week, mean picture size and an NFR-011 statement for task and audit volume (PRF-F-09, PRF-F-11); the NFR-010 treatment of a propagation save if the architect keeps the loop (PRF-F-05); OQ-PM-05 for the 500-node export (PRF-F-04).
- solution-architect: PRF-F-04 choice (accept with a derived timeout, cap or stream); PRF-F-05 `recordMany` or batched insert; PRF-F-06 limit in the reverse proxy file; re-run the capacity table of 9.9 with real volumes.
- developer (hardening window): PRF-F-01 load script and jobs, PRF-F-02 `KEY_SCREENS`, PRF-F-03 single layout, PRF-F-05 and PRF-F-06 fixes, README "Uptime monitor" section.
- qa-engineer: run and record the load, volume and 500-node timings (PRF-F-01, PRF-F-04) with machine and run IDs; re-read the export AC-1 and AC-2 on the target host (G8-C-NFR10).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final/performance.md`
- Jira / GitHub updates: issues #573 (PRF-F-01), #574 (PRF-F-03), #575 (PRF-F-04); comments on #485 (PRF-F-02), #568 (PRF-F-05), #410 (PRF-F-06); AQP-1 comment
- Open questions: none new (OQ-PM-05 and OQ-3 stay open)
- Risks raised: none new; RISK-010 (PRF-F-04) and RISK-020 (PRF-F-02) evidence added
- Recommended next agent: developer, for the hardening-window fixes (PRF-F-01, 02, 03, 05, 06), with solution-architect first on PRF-F-04 and PRF-F-05; then qa-engineer for the measurements
