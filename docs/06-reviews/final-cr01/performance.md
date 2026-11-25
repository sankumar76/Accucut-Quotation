# Review Report — FINAL DELTA (CR-01 and fixes since 242c21f7) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 of the delta review (CLAUDE.md section 9 item 3; master's DL-354) |
| Base…head | `242c21f7..1fe1581bb611f1b250c6f0e9ea010b11cb08392b` (H, master after #663); 246 files under `src/`, `prisma/`, `scripts/`, `.github/` |
| Date | 2026-11-23 |
| Jira | AQP-1 |
| Continuity | `docs/06-reviews/final/performance.md` (at 242c21f7) |
| **Verdict** | **REQUEST CHANGES** (one new Major, PRF-C-01, #665; the carried Major PRF-F-04 / #575 still waits for its target-host reading; no Blocker, no Critical) |

## Summary

The server side of the delta is sound. Every new statement is keyed by a primary key or an indexed column, transactions are short (Ignore, Restore and Mark as quoted are 4 to 5 statements under one estimate lock), the download log is append-only with a matching index, the audit batch fix for default propagation is in (PRF-F-05 fixed), and the body cap and export limits are in (PRF-F-06 fixed, PRF-F-04 half done). The CI "Capacity and latency" job now exists and its last scheduled reading passes every NFR-010 line at 25 users with wide margin. All the new dialogs, menus and drag code are loaded on first use behind type-only imports; none is in a first load.

**The one thing that is wrong is on the client, on the hottest screen.** AQP-406 (#656) made the parts tree work out Move up and Move down targets for every row with two full-list scans (`tree-panel.tsx:140`, `tree-moves.ts:11-19`). That is O(n²) on every render of the tree, and the tree re-renders on every selection and every saved part. I measured the two functions in isolation: about 40 ms at 500 parts and about 0.5 s at the 2,000-part cap, on a desktop. On the NFR-009 profile (4x CPU) that is an estimated 160 ms at 500 parts, which puts the Workspace key screen's TBT near its 200 ms limit. The last Lighthouse reading of that screen (34 ms) predates #656. The fix is about ten lines.

Second, first-load JavaScript headroom is now below DL-073's 10,000 B target on `/queue` (6,873 B) and `/masters/materials` (8,553 B), and `/estimates/[code]` is 753 B above it (10,753 B). No limit is breached (all 24 rows pass 200,000 B) and `/queue` measured LCP 294 ms and TBT 3 ms. I do **not** think a Major is warranted (PRF-C-02), but master should record the floor as missed.

One correction to my own first review: it quoted `/queue` at 187,484 B from run 44892640890 (877baffd, two commits before the head). The run for 242c21f7 itself (44899114212, job 136831039651) reads **190,164 B** (headroom 9,836 B). The floor was already missed by 164 B at the baseline; the delta since then is +2,963 B.

This review ran nothing against the product: no build, no test, no database, no workflow. One isolated micro-benchmark (a copy of two pure functions, in the scratchpad, not in any worktree) was run in Node. Figures are labelled: **CI** (read from a log), **measured here** (the micro-benchmark), **read** (from code) and **estimate**.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 new (PRF-C-01, #665); 1 carried and open (PRF-F-04, #575) |
| Minor | 2 new (PRF-C-02, PRF-C-03); carried: PRF-F-03, 07, 08, 09, 10, 11, 12 |
| Info | 4 new (PRF-C-04, 05, 06, 07); carried: PRF-F-13, 14 |

## Checks Run

| Check | Command or source | Result |
|-------|-------------------|--------|
| Delta read | `git diff 242c21f7 1fe1581b` over `src/server/{repositories,services,export,http}`, `src/proxy.ts`, `prisma/` (8 migrations, `schema.prisma`), `src/components/features/{estimate-workspace,estimate-ignore,estimate-quote,estimate-customer,queues,estimate-review}`, `src/components/shared`, `scripts/`, `.github/workflows/nightly.yml` | Findings below |
| First-load JS at H | CI run 45303206514 (push on H, all jobs green), job "Stages 1 to 11b" 138140580872 | 24 rows PASS; table below |
| First-load JS history | Stage 11b rows of runs 44892640890 (877baffd), 44899114212 (242c21f7), 44904394383 (7e42970c), 45030418570 (8ff2fa06), 45264337428 (02460fbe), 45273806439 (56ea5cb8), 45297038711 (ab3f45a7); PR bodies #622, #623, #625, #649, #652, #656, #661, #662, #663 | Attribution below |
| NFR-010/011 readings | Nightly run 45143360826 (schedule, master 06d5d56a), job "Capacity and latency (NFR-010, NFR-011)" 137586525455 | Every line passes; see "NFR readings" |
| NFR-009 readings | Same run, job "Lighthouse reference run" 137586525475 | Five key screens met; see "NFR readings" |
| Micro-benchmark | `siblingsOf` / `stepOf` copied from `tree-moves.ts` at H, UUID ids read back through `JSON.parse`, depth about 6, Node 24 on the delivery PC, median of 25 runs after 30 warm-ups, two separate sessions | 100 nodes 1.7 to 2.0 ms; 500 nodes 40 to 41 ms; 2,000 nodes 486 to 557 ms (PRF-C-01) |
| EXPLAIN, load run, Lighthouse by me | not run | no database in this review's brief; a reviewer may not run workflows |
| Open findings of the first final review | re-read against H | "Previous findings" |

## First-load JavaScript per route (CI, gzip, limit 200,000 B)

| Route | 242c21f7 | 8ff2fa06 (#604) | 02460fbe (#656; 3A to 3D in) | H 1fe1581b (run 45303206514) | Headroom at H | Change since 242c21f7 |
|---|---:|---:|---:|---:|---:|---:|
| `/` (shell) | 163,792 | 163,936 | 164,345 | 164,345 | 35,655 | +553 |
| `/queue` | 190,164 | 190,309 | 192,272 | **193,127** | **6,873** | +2,963 |
| `/estimates/[code]` | 185,567 | 182,206 | 188,452 | **189,247** | 10,753 | +3,680 |
| `/masters/materials` | 189,236 | 189,397 | 191,447 | **191,447** | **8,553** | +2,211 |
| `/assign` | 178,359 | 180,825 | 181,886 | 182,016 | 17,984 | +3,657 |
| `/masters/customers` | 179,429 | 181,046 | 181,523 | 181,523 | 18,477 | +2,094 |
| `/masters/customers/[id]` | 183,239 | not read | not read | 185,599 | 14,401 | +2,360 |

Where the bytes came from, from each PR's own Stage 11b row in its body. `/estimates/[code]` fell 3.4 KB in #604 (the customer picker left the page), then rose by +2,627 B (3B, #623), +648 B (3C, #625), +821 B (#652), about +925 B (3D, #656: 187,526 to 188,452) and +747 B (#661), and not since. `/queue` rose by about +1,021 B in #622 (download chip and marker client; the PR itself says "its headroom is now under 9 KB, which later queue work should watch"), +12 B in #649 and +855 B in #661 (fourth tab, remarks line, texts). `/masters/materials` rose by +2,050 B between #604 and #656 with no change to a materials file. I could not attribute it without a build (likely a shared-chunk regrouping; the architect should read the build's chunk report). Several intermediate master pushes had no readable 11b row, so the history is by checkpoints, not by every PR.

## Findings

| ID | Severity | File:line (H) | NFR | Issue | Evidence | Suggested fix | GitHub |
|----|----------|---------------|-----|-------|----------|---------------|--------|
| PRF-C-01 | **Major** | `src/components/features/estimate-workspace/tree-panel.tsx:140`; `src/lib/estimates/tree-moves.ts:11-19`; `src/components/shared/parts-tree-list.tsx:99-112`; `src/components/features/estimate-workspace/tree-node.tsx:41` | NFR-009 (Workspace key screen TBT); NFR-011 (500 nodes; 2,000-part cap, DL-217) | Each row's toolbar calls `stepOf(nodes, part, 'up')` and `stepOf(nodes, part, 'down')`, and each call filters the whole node list (`siblingsOf`) and allocates an array: two O(n) scans per row, O(n²) per render. `TreeNode` and `RowActions` are not memoised and the tree's state sits in `EstimateWorkspace`, so every selection, saved part (`markSaved`), change answer and `busy` toggle re-renders all rows. Introduced by #656; before it, `stepOf` ran once per render for the selected row. Row actions are drawn whenever the person may edit (an Engineer on a Draft, a Lead or Admin on a Draft or Prepared estimate). | **Measured here** (copy of the two functions, UUID ids, Node 24, desktop PC, median of 25): 100 nodes 1.7 to 2.0 ms; **500 nodes 40 to 41 ms**; **2,000 nodes 486 to 557 ms** per render, for these calls alone. **Estimate** on the NFR-009 profile (4x CPU; Lantern scales task time): about 160 ms at 500 parts and 2 s at 2,000, in one task. The Workspace reading of 34 ms TBT (nightly 45143360826, 500 parts, Engineer, Draft) was taken at 06d5d56a, before #656 (02460fbe). Estimated TBT after: about 160 to 230 ms against ≤ 200 ms. Each autosave adds one such render (about 40 ms desktop at 500 parts). No combined review read 3D: it is not a §9 item 2 story. | `BranchItem` already knows `siblings` and the row's index: pass `{ index, count }` as a third argument of `renderToolbar` and compute `upTo = index > 0 ? index - 1 : null`, `downTo = index < count - 1 ? index + 1 : null`; delete the two `stepOf` calls from `tree-panel.tsx`. Also `React.memo` on `TreeNode` and `RowActions` with stable handlers (this closes PRF-F-07). Add a unit test at 2,000 nodes that counts element visits (linear, not quadratic). Proof: the next Nightly Lighthouse reading of `/estimates/Q-2099-0001` (median of 5, TBT ≤ 200 ms). **If the reading on H already breaches 200 ms the finding is Critical (NFR-009 breached, measured).** | #665 |
| PRF-C-02 | Minor | CI rows for `/queue` and `/masters/materials` (stage 11b); `src/components/features/queues/queue-list.tsx:4,12,15,16` (static imports of the chip, texts, remarks cut) | NFR-009 (200,000 B met); DL-073, DL-081, PRD v0.14 row, AQP-188 AC-1 (floor 190,000 B) | The agreed headroom floor of 10,000 B is missed on `/queue` (6,873 B) and `/masters/materials` (8,553 B); `/estimates/[code]` is 753 B above it. Three queue PRs (#622, #649, #661) went under it; #622's body says so. No record waives the floor for these routes. The ADR-016 rule ("a PR that would leave less than 10,000 B first moves out what it adds") is written for `/estimates/[code]` only. | CI (table above). The hard gate holds on all 24 rows. Nightly at 06d5d56a: `/queue` LCP 294 ms and TBT 3 ms (Wi-Fi profile); Slow 4G LCP 953 ms, TBT 0. **Is a Major warranted? No.** No NFR figure is breached, the screen's measured LCP and TBT have a large margin, and 6.9 KB (3.4 % of the limit) cannot be consumed by a hardening fix of normal size. It becomes Major if a change before G8 would take `/queue`, `/masters/materials` or `/estimates/[code]` above 195,000 B, or if the nightly TBT of `/queue` passes 100 ms. | Cheapest cut for `/queue`: the download chip, its texts, three icons and the marker fetch are drawn only on the Closed tab for a Lead or Admin, so `DownloadMarker` can load on first use (`useLazyComponent`, as the workspace does). #622 measured chip plus marker client at about +1,021 B on `/queue`, so expect 0.7 to 1.0 KB back; that does not reach 10,000 B (3.1 KB needed) and I do not recommend a code change for it now. Cheapest cut for `/estimates/[code]` if ever needed: ADR-016 E3 (lazy `TreePanel`; the tree is fetched after mount anyway), estimated 3 to 5 KB now that rows carry icons, actions and legend. **Recommended action:** master records the floor as not met on these routes and accepts it with the hard gate unchanged (Minor, D7 list, DL-312); any hardening PR states the three figures before and after. Owner of the record: product-manager (AQP-188 AC-1 is theirs). | none (Minor; D7 list) |
| PRF-C-03 | Minor (read; plan not verified) | `src/server/repositories/download-repository.ts:84-96` (`factsOfRows`) | NFR-010 | One statement serves both lookups with `WHERE e.id = ANY(estimateIds) OR t.id = ANY(taskIds)`. An OR across two joined relations cannot use an index on either; unless PostgreSQL folds the empty array (not guaranteed with a bound parameter and a generic plan) it joins every estimate to every task and filters after. It runs on SCR-06's header, on each Closed-tab page for a Lead or Admin (first paint and each "Show more") and in the export summary's snapshot. Cost grows with the number of tasks ever made (the PRF-F-09 class). | Read from code. Estimate: a few ms at the 300 tasks of the load run, 30 to 80 ms at 50,000 tasks, per read. Not measured: the capacity run has no Closed-tab or marker line. | Two statements, or a `UNION ALL` of two selects (one keyed by `e.id`, one by `t.id`); then one EXPLAIN on a local database seeded with 50,000 tasks. | none (Minor) |
| PRF-C-04 | Info | `src/lib/tasks/download-markers-client.ts:28-31`; `src/server/views/schemas/download-marker.ts:38-42` | NFR-012 | The marker request puts the page's task IDs in the query string; URLSearchParams writes each comma as `%2C`, so a full page of 50 is 50 × 36 + 49 × 3 + 4 = 1,951 characters. IIS's default `maxQueryString` is 2,048 and the install guide's `requestFiltering` snippet (`deploy/windows/README.md:309-311`) does not raise it. Margin 97 characters. | Computed from the constants (`QUEUE_DEFAULT_LIMIT` = 50). A larger page size would make the marker call fail behind IIS (the rows then say "Download status unavailable", by design). | State the dependency beside `QUEUE_DEFAULT_LIMIT`, or send the IDs in chunks of 25. | none |
| PRF-C-05 | Info | `src/components/features/estimate-workspace/tree-reorder.ts:46-47,55-57,142` | NFR-009 (INP is not an NFR figure) | During a drag every pointer move reads `getBoundingClientRect` of every sibling twice (`dropIndexOf(host.siblings(), …)` and `dropLineY(host.siblings(), …)`), and twice more per frame while the panel auto-scrolls. Only the siblings of one parent are read. | Read. Siblings are typically under 50: negligible. At the worst case the data model allows (2,000 parts under one parent) it is 4,000 rect reads per move event, estimated 4 to 10 ms desktop. Listeners, the animation frame and the line are removed in `finish`; the one gap is an unmount in the middle of a drag (the handle holds the pointer, so practically impossible). | Read the boxes once per event and pass them to both functions. | none |
| PRF-C-06 | Info | `tests/perf/load-25-50.ts`; `.github/workflows/nightly.yml` (job `capacity`) | NFR-010 | The only capacity reading on record (06d5d56a) predates #656 (reorder), #649 (quoted), #661 (Ignore: a fourth queue count, new Open and Closed predicates) and #652. It has no line for `POST …/tree/move` (two tree reads, one UPDATE, an 89 KB answer at 500 parts) or for the Ignored tab. | Read. Estimate for a move at 500 parts: about 100 ms (a tree read is p95 32 ms in the run). The queue page is now one list, four counts and the bell's count, six statements from a pool of 10; at 300 tasks the queue line was p95 16 ms at 25 users and 32 ms at 50. | The first nightly after the freeze gives the confirming reading; add a move line to `tests/perf/load/plan.ts` if the load script is touched again. | none |
| PRF-C-07 | Info | `src/app/(portal)/queue/page.tsx:77`; `src/components/features/queues/queue-screen.tsx:179-182,246-254` | NFR-009 | The Closed tab for a Lead or Admin makes the markers a second round trip after the page: on the server `listQueue` is awaited and then the markers; in the browser `fetchQueuePage` is awaited and then `fetchDownloadMarkers`, on each tab change and each "Show more". The list does not show until both are in. | Read. One extra request and one statement (see PRF-C-03) per Closed page. | Start both together, or accept. | none |

## NFR Impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-008 (500 nodes under 2 s) | Low. Calculation path unchanged. | PRF-F-13 (carried) |
| NFR-009 (LCP, TBT, 200 KB) | **Medium on the Workspace key screen** (likely TBT regression from #656, unmeasured at H); low elsewhere. 200,000 B met on all 24 rows; five key screens met at 06d5d56a; the 10,000 B floor is missed on two routes. | PRF-C-01, PRF-C-02, PRF-F-03, PRF-F-07 |
| NFR-010 (p95 500 ms at 25 users; export 50 nodes 10 s) | **Low.** Every line passes at 25 users (queue p95 16 ms, tree 32, part form 7, cost details 18, part save 14); export of 500 parts with 50 pictures 1.1 s p50. Readings predate the last six merges. | PRF-C-03, PRF-C-06, PRF-F-08, PRF-F-09, PRF-F-12 |
| NFR-011 (50 users, 500 nodes, 500 x 50 masters) | **Low to medium.** The volume run passes (customers list p95 53 ms, one customer 78 ms); 50 users ran without error. The 2,000-part cap is not measured and PRF-C-01 is quadratic up to it. | PRF-C-01, PRF-F-03, PRF-F-04 |
| NFR-012 (99 % availability) | Low. Body cap (768 KB) and the app heap flag are in; the export memory reading on the rehearsal machine is pending. | PRF-F-04, PRF-C-04 |
| NFR-013 (backup retention) | Low. `estimate_downloads` adds about 100 B a download. | PRF-F-11 |
| NFR-024 (observability) | Low. New routes go through `withRoute`; marker faults are logged by kind only. | none |
| NFR-030 (deployability) | Not affected. Migrations are additive or one-statement renames (see below). | none |

## NFR readings in CI (read, not run by me)

**Capacity and latency**, Nightly run 45143360826 (2026-11-23 09:01Z, master 06d5d56a, AMD EPYC 9V74 × 4, 15.6 GB). Phases: volume 101 s, mixes 251 s and 253 s, export 34 s, password 2 s.

| Line | p50 / p95 ms | Limit ms | Result |
|---|---|---|---|
| queue, 25 users (300 tasks) | 6 / 16 | 500 | pass |
| tree (500 parts, 89.4 KB) | 18 / 32 | 500 | pass |
| part form | 4 / 7 | 500 | pass |
| cost details | 13 / 18 | 500 | pass |
| part save | 7 / 14 | 500 | pass |
| customers list (500 customers × 50 rates, 72.3 KB) | 30 / 53 | 500 | pass |
| one customer (158 KB) | 45 / 78 | 500 | pass |
| 25 users during a 500-part export: queue / tree / part form / cost details (p95) | 122 / 283 / 34 / 113 | 500 | pass |
| 500-part export (50 pictures, 10 MB), 24 in series | 1,144 / 1,240 | n/a | reported |
| own-password change, 20 in series | 87 / 91 | 1,000 | reported (CI is not the host, OQ-3) |
| 50 users (reported): queue / tree / part save (p95) | 32 / 45 / 28 | n/a | no errors in 2,000 requests a line |

This closes the evidence part of #573 (PRF-F-01): the 25-user line, the capacity run, the page-latency-during-export run and the 500 × 50 volume run exist and pass. The 500-picture worst case of DL-271 (97.5 MB) is not in the run (50 pictures, 10 MB).

**Lighthouse (Wi-Fi profile, median of 5)** at 06d5d56a, run 45143360826: `/` LCP 189 ms, TBT 0; `/assign` 292 / 0; **Workspace** `/estimates/Q-2099-0001` 194 / **34**; cost view 243 / 0; **Customers** (500 customers) 290 / **79** (G8-C-NFR9 reading was 40; the PRF-F-03 trigger is a median over 100 ms); `/queue` 294 / 3. These predate #656 and #661. **No scheduled nightly has run on H.** The next one (about 09:00Z on 2026-11-24, or a manual dispatch) is the reading that confirms or refutes PRF-C-01.

## Verified, no finding

- **Migrations (8).** All run once, on an install with no production data (A-CR01-A1). `estimate_status_prepared` and `estimate_status_quoted` are enum label changes (catalogue only). `customer_short_name` backfills in a PL/pgSQL loop that scans `customers` for each candidate (about 250,000 row comparisons at 500 customers: a second, once, before the unique index exists). `task_subject_title_required` and `estimate_node_kind` rewrite `tasks` and `estimate_nodes` once (the kind backfill is one recursive statement over the `parent_id` index, then `SET NOT NULL`); at tens of thousands of rows that is seconds under an ACCESS EXCLUSIVE lock, acceptable on a first install and not on a live database (each file says so and gives its expand-contract split). `estimate_downloads` is additive. `expire_unsent_assignment_mail` is one UPDATE on pending rows of one event, reached by `idx_email_outbox_status_next_attempt_at`. Each has a rollback note.
- **Indexes.** New hot reads are keyed: the queue by the existing `idx_tasks_*` and `idx_estimates_status`; the marker by `idx_estimate_downloads_estimate_id (estimate_id, downloaded_at DESC)` and `idx_approvals_estimate_id`; Ignore, Restore and Quote by the estimate's primary key. `estimates.ignored_at` has no index; the Ignored tab and the other counts read it through the join to the task scope (the PRF-F-09 class). `e.status::text NOT IN (...)` in `overdue-repository.ts` casts the column and cannot use `idx_estimates_status`, as the `<> 'APPROVED'` it replaced could not.
- **Transactions and locks.** Ignore, Restore and Mark as quoted: lock one estimate row, one conditional UPDATE, one marker read, one audit INSERT. The download record is written in its own short transaction after the build (`export-service.ts`, after `place.release()`), so no lock is held during a build. `findActiveCustomer … FOR SHARE` on assign and on change customer holds one customer row for one short transaction. No N+1 on a user-facing path; the marker read for a page is one statement for up to 200 tasks.
- **Default propagation (PRF-F-05, #568).** `recordMany` writes one multi-row INSERT per 1,000 rows; PR #589 measured the 500-customer save at a median of 374 ms and Save choices at 198 ms (target 500 ms). Fixed.
- **Request body cap (PRF-F-06, #410).** `experimental.proxyClientMaxBodySize` is 768 KB (PR #590, `request-body-cap.test.ts`). Fixed.
- **Export path.** The build, the thread, the gate and the 512 MB thread heap are unchanged. The file name now uses the short name and subject (`export-repository.ts`, one more column and one join); the response header comes from `content-disposition.ts`. The timeout is `EXPORT_TIMEOUT_SECONDS` (120 to 300, default 240) and `AccucutApp.xml` sets `--max-old-space-size=1024` (ADR-017). The bytes of a built file stay in memory for the length of one short insert after the gate is released (milliseconds).
- **Lazy-load boundaries.** The Ignore, Restore, Mark as quoted and Change customer dialogs, the "+" menu panel, the Move menu, the drag code (`tree-reorder.ts`) and the delete dialog are each behind a bare `import()` with a type-only import in the first-load file (`useFirstOpen` or `useLazyComponent`). The drag code is pre-fetched on hover and focus of a handle, and a gesture that starts before it arrives is replayed. `EngineerIgnoredNotice` is a server component; `DownloadChip` is a server component on SCR-06 and SCR-10. The 3B, 3C and 3D first-load additions are the plain row link, arrow, kind icons, legend and two plain buttons.
- **Timers and listeners.** `withinLimit` (#652) clears its timer in `finally` and the hook aborts open requests on unmount; the "slow" timer is cleared on the same path; `announce` (#663) holds one module timer, replaced by a second call, and one persistent node; `useFirstOpen` adds its Escape listener only while pending or failed and removes it; the paste listener in `part-picture.tsx` is removed in cleanup; `startDrag` and `attachReorder` remove their listeners and cancel the animation frame on every end (PRF-C-05 notes the one gap).
- **Per-row hooks.** Each row mounts one `useFirstOpen` (two for "+" rows). About 4,000 hook instances at 2,000 parts is a one-time mount cost of tens of ms and no listener: not a finding on its own.
- **Proxy and CSP.** `src/proxy.ts` now covers every page and route and adds one 16-byte nonce and five headers per request: microseconds. The nonce makes the public pages (sign-in, reset) render per request instead of being built ahead of time; they are 25-user pages and the cost is one small render.
- **Customers list.** `customer-list.tsx` gained a short-name column and a card line (+2 elements per customer, about +7 % DOM; estimated +100 KB of document at 500 customers, so about 3.46 MB against the 4 MB watch).
- **Pool.** Unchanged (10 / 3 / 2). The queue page issues six statements at once from a pool of 10; at 50 users the run shows p95 32 ms.

## Previous findings (first final review, `docs/06-reviews/final/performance.md`), re-checked against H

| ID | Was | At H | Note |
|----|-----|------|------|
| PRF-F-01 (#573) | Major | **Resolved by measurement** (nightly 45143360826). Residual: the reading predates six merges and has no move line (PRF-C-06). | Master may close #573. |
| PRF-F-02 (#485) | Resolved | Resolved (issue closed 2026-11-21). | |
| PRF-F-03 (#574) | Minor (watch) | **Still Minor.** TBT 79 ms at 06d5d56a (was 40; the watch line is a median over 100 ms); +1 column; document about 3.46 MB. | Not reopened. The nightly keeps reading it. |
| PRF-F-04 (#575) | Major | **Still Major, open.** The code half is in (#590): timeout is a bounded setting, the app heap flag is set. The target-host reading (G8-C-NFR10 (b), rehearsal machine per DL-311) is not recorded; the CI export (50 pictures, 10 MB, 1.1 s) is not the 97.5 MB worst case. | Closes when the reading is recorded and ADR-017's table applied, or on master's acceptance. |
| PRF-F-05 (#568) | Major | **Fixed** (#589; 374 ms median at 500 customers). | Issue still open: master may close. |
| PRF-F-06 (#410) | Major | **Fixed** (#590, 768 KB cap). | Issue still open: master may close. |
| PRF-F-07 | Minor | **Still present, and now part of PRF-C-01.** `TreeNode` is not memoised and each row does more work. | Fix together. |
| PRF-F-08 | Minor | Unchanged (`audit-service.ts` still counts on every page). | Carried. |
| PRF-F-09 | Minor | Carried, slightly larger: a fourth count (Ignored) and `ignored_at` predicates; Open and Closed now use `status NOT IN` / `IN (locked)` and `ignored_at IS NULL`; still no index on `ignored_at`; still no tasks-per-year figure (product-manager). | At 300 tasks the queue is p95 16 ms; measure at 50,000 after the freeze. |
| PRF-F-10 | Minor | Unchanged (`no-store` on pictures). | Carried. |
| PRF-F-11 | Minor | Unchanged; `estimate_downloads` adds negligible growth. | Carried. |
| PRF-F-12 | Minor | Unchanged; the export summary snapshot now also reads the marker (one statement). | Carried. |
| PRF-F-13, PRF-F-14 | Info | Unchanged. | Carried. |

## Areas covered and not covered

**Covered (read):** all changed files in the list above under `src/server`, the 8 migrations and `schema.prisma`, the workspace tree, row actions, move handle, drag code, the Ignore, Quote and Customer dialog buttons, the queue screen, list and page, the download chip and marker route, `src/proxy.ts` and the CSP helpers, `scripts/lib/js-budget-records.ts`, the nightly workflow, the Stage 11b logs of seven runs and the nightly capacity and Lighthouse jobs.

**Not covered:** any run of my own against the product (no browser trace of the tree, no EXPLAIN, no load); the configuration editor screens and the hand-over scripts (unchanged since the first review except where listed); the 2,000-part screens in a browser; the review screen (SCR-06) for a Lead or Admin in Lighthouse (not a key screen); a real phone or network; `deploy/` beyond the service file and the proxy snippet; e-mail transport timeouts.

## Issues for other roles

- developer (hardening window): PRF-C-01 (#665), with its proof (nightly TBT on the Workspace screen) and the test. Optional: PRF-C-03 (two statements), PRF-C-05, PRF-C-04.
- product-manager: record the 10,000 B floor as not met on `/queue` and `/masters/materials` (PRF-C-02); tasks per year (PRF-F-09); estimates per week and mean picture size (PRF-F-11).
- solution-architect: PRF-F-04 reading and ADR-017's table at the rehearsal; the chunk report for `/masters/materials` (+2.2 KB unattributed); ADR-016 E3 as the ready cut for `/estimates/[code]`.
- qa-engineer: the first nightly (or a dispatch) on H: Workspace, Customers and `/queue` Lighthouse medians; a 500-picture export on the rehearsal machine (G8-C-NFR10).
- orchestrator: GitHub #573, #568 and #410 look closable on the evidence above; master decides.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/performance.md` (not committed)
- Jira / GitHub updates: issue #665 (PRF-C-01, Major; labels tech-debt, ai-delivery, final-review); AQP-1 hand-off comment
- Open questions: none new
- Risks raised: RISK-020 (first-load headroom) evidence added: `/queue` 6,873 B, `/masters/materials` 8,553 B; PRF-C-01 is a possible NFR-009 breach for master to weigh until the first nightly on H is read
- Recommended next agent: developer — fix PRF-C-01 in the hardening window (about ten lines); then qa-engineer to read the nightly on the fix head
