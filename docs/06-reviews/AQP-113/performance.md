# Review Report — AQP-113 (STORY-02.01 Process master) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-113-process-master` (PR #107; merge base `14c9493`, code-identical to master tip `86ffb16`, which only adds docs) |
| Commit reviewed | `62267afd7979ba65d1159be0d644060bee748ed8` |
| Date | 2026-11-07 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary

No finding reaches Major. The numbers the developer reported for the 11b JS budget match the CI log of run 42316869370 to the byte, and
the shared first load grew by only 35 to 49 B on every existing route against master (run 42263941881). `/masters/process` is now the
heaviest route at 172,551 B gzip, which leaves 17,449 B to the 190,000 B target and 27,449 B to the 200,000 B limit. Every query on the
new paths touches a table of about 15 rows or a primary key, so no index and no pagination is needed at the stated scale. Two Minor
findings remain: the delete path takes its locks in the opposite order to create and update (a deadlock window of a few milliseconds
that PostgreSQL would resolve with a 500), and the new E2E spec moves the CI critical path from about 4:51 to 5:11 against a 6:00 early
warning, so the `@one-width` proposal should be ruled on and the same split planned for the other masters stories.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 4 |

## Checks Run

All read-only. Nothing was checked out, built or run from the PR head in the main folder, so every cost below that is not a CI number
is an **estimate** from reading the code, and is labelled so.

| Check | Command / source | Result |
|-------|------------------|--------|
| PR metadata, commits, diff | `git fetch origin`; `gh pr view 107`; `git log origin/master..origin/feat/AQP-113-process-master`; `git diff origin/master...origin/feat/AQP-113-process-master -- .github prisma src` | 10 commits; 3,943 additions; new table, 3 routes, 1 page, 1 lib fix |
| CI of the head | `gh run view 42316869370` (jobs, steps, log) | All four jobs green; 5m11s from first job start to the end of `Stages 1 to 11` |
| 11b JS budget, PR | log of run 42316869370, step "Stage 11b" | 8 of 8 rows pass; figures in the table below match the hand-off exactly |
| 11b JS budget, master | log of run 42263941881 (master `86ffb16`) and 42261662851 (`14c9493`) | 7 rows, identical in both runs (the commits between them are docs) |
| E2E counts and per-test times | same logs, `process-master.spec.ts` lines | 30 tests (10 tests at 3 widths), 98.7 s of test time in total |
| Query plans | not run | No local or test database was given in the brief. Plans are reasoned from the SQL and the migration |
| Micro-benchmark of `rateNameIssues` | not run | Running PR code needs a checkout; no checkout was made. Cost is estimated from the algorithm |

### 11b first-load JavaScript, gzip (verified against the CI log)

| Route | Master (`86ffb16`) | PR (`62267af`) | Change | To 190,000 target | To 200,000 limit |
|-------|-------------------:|---------------:|-------:|------------------:|-----------------:|
| `/masters/process` | not a route | 172,551 | new | 17,449 | 27,449 |
| `/` | 162,464 | 162,499 | +35 | 27,501 | 37,501 |
| `/audit` | 171,801 | 171,846 | +45 | 18,154 | 28,154 |
| `/queue` | 163,623 | 163,658 | +35 | 26,342 | 36,342 |
| `/sign-in` | 166,296 | 166,339 | +43 | 23,661 | 33,661 |
| `/users` | 169,862 | 169,911 | +49 | 20,089 | 30,089 |
| not-found | 155,803 | 155,838 | +35 | 34,162 | 44,162 |

The PRD's floor of at least 10,000 B headroom to 190,000 B (PRD v0.14, AQP-188) holds on every row. The new page is 2,640 B above `/users`
and 705 B above `/audit`. A Radix dialog, alert dialog and the form together would cost far more than that, so the size is consistent with
the dialogs being outside the first load (`process-screen.tsx:66, 89`, `useFirstOpen`); this is an inference from the size, since the CI log
does not list chunks. The +35 to +49 B on the other rows is most likely the new "Process master" entry in the shared shell navigation
(`route-manifest.ts`); it is too small to matter, but it will repeat with each new nav entry.

### CI time

| Item | Master (`86ffb16`) | Master (`14c9493`) | PR head | Reading |
|------|-------------------:|-------------------:|--------:|---------|
| First job start to end of `Stages 1 to 11` | 4m51s | 5m01s | 5m11s | +10 to +20 s; inside run-to-run noise, but in the direction the new spec predicts |
| Job `Stages 1 to 11b` | 3m24s | 3m52s | 3m53s | No separable effect |
| E2E shard 1 job / Playwright | 4m40s / 2.8m (206 tests) | 4m52s / 2.9m | 4m04s / 2.6m (221 tests) | Shards split the new spec by test (20 and 10 of 30), so no shard is starved |
| E2E shard 2 job / Playwright | 4m19s / 2.6m (205 tests) | 4m31s / 2.5m | 5m02s / 3.1m (220 tests) | |
| Tests in E2E (both shards) | 411 | 411 | 441 | +30 = the new spec at 3 widths |
| `ensure-seed-version.ts` step | n/a | n/a | under 1 s in each of 3 jobs; 0.72 s by log timestamps in shard 2 | About 2 to 3 runner-seconds per run, about 1 s of wall time because the jobs run in parallel |

Per-test time of the new spec in CI: desktop 43.0 s, tablet 29.2 s, mobile 26.5 s, total 98.7 s of test time, about 25 s of wall time
at 4 workers across both shards (estimate). The test strategy (10.5) projected about 4:40 today and about 5:25 once AQP-65 adds its
tests, with a 6:00 early warning and a p95 line at 9:00; 5:11 is inside that projection.

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `src/server/services/masters-service.ts:175-176` (with `src/server/repositories/master-repository.ts:129-133`, `139-150`) | NFR-010; coding standards 7 (lock scope) | `deleteProcessItem` locks the row (`FOR UPDATE`) and then deletes (table lock `ROW EXCLUSIVE`). `createProcessItem` and `updateProcessItem` take the table lock `SHARE ROW EXCLUSIVE` first and the row second. The two orders can cross on one rate | Two requests on the same rate, a delete and an edit started within a few milliseconds, wait for each other. PostgreSQL ends the wait after `deadlock_timeout` (1 s by default) by aborting one with SQLSTATE 40P01. `translateDatabaseError` maps only 57014 and connection timeouts, so the caller gets a 500, not the retryable 503. Needs one Admin with two tabs open on the same rate, so it is rare, but it is a lock-order bug and the fix is one line | Call `await masters.lockProcessItems(tx)` as the first statement of the delete transaction, so all three changes take the table lock before the row lock. Optionally map 40P01 to `DatabaseBusyError` in `database-errors.ts` |
| PRF-02 | Minor | `tests/e2e/process-master.spec.ts:19-21, 135, 170, 237`; `.github/workflows/ci.yml` (stage 12) | NFR-009 CI feedback (6-minute early warning, 9-minute line, 10-minute p95 limit); test strategy 10.3 and 10.5 | The spec adds 30 E2E tests (98.7 s of test time) and lifts the critical path to 5:11, 49 s below the 6:00 early warning. The PRD lists more masters screens (customers, materials, exchange rates), each likely to add a spec of the same shape | At 10 to 20 s per masters story, about three more reach the early warning. The three tests the developer proposes for `@one-width` read no layout, follow the ruling's own precedent (`users.spec.ts`: "adds a person", "changes the name and the role" at one width; "refuses a wrong e-mail" at three) and save 16.1 s of test time (28.0 s to 11.9 s), about 4 s of wall time. Small, but free | Ask the solution-architect to rule on the three tests, add the file to the allow-list in `tests/unit/one-width-tag.test.ts` and the table in test strategy 10.5. Keep the empty-form and error-state tests at three widths (the position of a message and a notice). Plan the same split from the start in the next masters specs. Do not tag the other seven |
| PRF-03 | Info | `src/lib/fields/rate-usage.ts:31-41` | Coding standards 7 | `rateUsesOf` copies and sorts the fields and scans every output formula on each call. It runs on each page load, each mutation response and each refetch (two to three times per change) | Estimate: 60 fields with formulas up to 4,000 characters is at most 240,000 characters of regex scan, about 1 to 3 ms, and the common case is far below that. No effect on NFR-010 | None now. The document is frozen and cached per version, so a `WeakMap<ConfigDocument, ReadonlyMap>` would make it free if a later story calls it in a loop |
| PRF-04 | Info | `src/server/http/with-route.ts` (platform); `src/server/services/masters-service.ts:110-190` | NFR-010, NFR-024 | No request duration, lock wait or transaction time is logged or exposed anywhere in `src` (no `durationMs`, `performance.now`, `hrtime` or `Server-Timing`) | NFR-010 (p95 ≤ 500 ms at 25 concurrent users) is to be proven by a staging load test; in production nothing shows whether the table lock in create and update is ever waited on | Not this story's to fix. Recommend one duration line per request in `withRoute` (route, method, status, ms) when the load test is planned. Owner: solution-architect |
| PRF-05 | Info | `prisma/migrations/20261107090000_process_items/migration.sql:27, 34` | Coding standards 7 | `uq_process_items_name` (plain) and `uq_process_items_name_lower` (on `lower(name)`) are both unique. The second already implies the first | One extra B-tree to maintain on every write. At about 15 rows the cost is nil | Keep both: Prisma's `@@unique([name])` needs the first for the model, and `constraintOf` handles either name. Note it so nobody adds a third |
| PRF-06 | Info | `docs/02-product/prd.md` NFR-011 | NFR gap (owner: product-manager) | NFR-011 gives users (50, 25 concurrent) and 500 nodes per estimate, but no size for master data (rates, customers, materials) | The scale used for this review is an assumption | **Assumption used:** at most 100 rates (15 seeded). Every figure below holds with a wide margin up to 1,000. Please state a master-data volume in the PRD before the customers and materials stories |

<details><summary>Detailed notes and reasoning</summary>

### PRF-01 — the lock order

The transactions, with the table lock levels from the PostgreSQL manual:

| Step | Create | Update | Delete |
|------|--------|--------|--------|
| 1 | `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE` | same | (nothing) |
| 2 | `SELECT name` of all rates (ACCESS SHARE) | `SELECT ... WHERE id = $1 FOR UPDATE` (ROW SHARE, row lock) | `SELECT ... WHERE id = $1 FOR UPDATE` (ROW SHARE, row lock) |
| 3 | `INSERT` (ROW EXCLUSIVE, already covered by step 1) | `UPDATE` | `DELETE` (needs ROW EXCLUSIVE) |

`SHARE ROW EXCLUSIVE` conflicts with `ROW EXCLUSIVE`; `ROW SHARE` conflicts only with `EXCLUSIVE` and `ACCESS EXCLUSIVE`. Interleaving on
one rate X:

1. Delete D runs `FOR UPDATE` on X. It holds the row lock and `ROW SHARE`.
2. Update U runs `LOCK TABLE ... SHARE ROW EXCLUSIVE`. Granted, because D holds only `ROW SHARE`.
3. U runs `FOR UPDATE` on X and waits for D's row lock.
4. D runs `DELETE` and needs `ROW EXCLUSIVE`, which U's lock blocks. D waits for U. Deadlock.

The window is the time between D's step 2 and step 3, in the order of a millisecond, so the chance is negligible for one Admin on one tab. It
needs two tabs on the same rate and two presses within that window. A different rate in the update does not deadlock; D just waits for the
table lock and goes on. Waiting without a cycle is bounded by `statement_timeout` (10 s), which does map to a 503.

**Current** (`masters-service.ts:172-176`)
```ts
async deleteProcessItem(context, id) {
  const uses = await usesByRate();
  await transactions.run(async (tx) => {
    const before = await masters.findProcessItemForUpdate(id, tx);
```
**Suggested**
```ts
  await transactions.run(async (tx) => {
    await masters.lockProcessItems(tx); // same order as create and update: table first, then the row
    const before = await masters.findProcessItemForUpdate(id, tx);
```
The cost is that a delete waits for an in-flight create or update, which is what the `DELETE` already does at step 3.

### Database access, the rest of the checklist

| Path | Statements | Plan and cost at 15 to 100 rows (estimate) | Finding |
|------|-----------|---------------------------------------------|---------|
| Page `/masters/process` and `GET /api/v1/process-items` | 1. `SELECT id, name, unit, default_value FROM process_items ORDER BY created_at, id`. 2. `findLatestRef` (backward scan of `uq_config_versions_number`, one row in R1), in parallel with 1. The snapshot is read once per version per process (cache, bound 16) | Sequential scan and a sort of 15 rows; sub-millisecond. No N+1: usage by rate comes from the cached document, not from a query per rate | none |
| `POST` | `BEGIN`; `LOCK TABLE`; `SELECT id, name`; `INSERT`; audit `INSERT`; `COMMIT`; then `findLatestRef` | 6 to 7 round trips, about 10 to 25 ms on a local network (estimate). Table lock held for the three middle statements only | none |
| `PATCH` | `BEGIN`; `LOCK TABLE`; `SELECT ... FOR UPDATE`; `SELECT id, name` (only on a rename); `UPDATE`; audit `INSERT`; `COMMIT`; `findLatestRef` | 7 to 8 round trips, same order of cost. A no-op save writes nothing | none |
| `DELETE` | `findLatestRef`; `BEGIN`; `SELECT ... FOR UPDATE`; `DELETE`; audit `INSERT`; `COMMIT` | 6 round trips | PRF-01 |
| Migration | `CREATE TABLE`, two unique indexes, two CHECKs, one 15-row `INSERT`, `REVOKE`/`GRANT` | New table only: no rewrite or lock on an existing table; additive, so the previous image keeps running on rollback | none |

- **Indexes.** No filter, join or sort needs one: the list is unfiltered, the lookups are by primary key, and the name set is read whole.
  `ORDER BY created_at, id` has no index; at 100 rows a sort is below 1 ms. The seed rows share one `created_at` (one statement), so their
  order is by fixed ID, which is the SPEC order.
- **Unbounded result.** The list has no limit. At the assumed 100 rates that is about 15 KB of JSON; the screen filters client-side and
  needs the whole set. Acceptable; revisit if the PRD sets a master-data volume above about 1,000 (PRF-06).
- **Transaction scope.** The transaction contains only database statements and one in-memory name check; the configuration read is outside
  it in the delete path. In create and update the name check (`rateNameIssues`) runs inside the table lock; see the next section for why
  that is right and what it costs.
- **Pool.** The runtime pool is 10 connections (`prisma-client.ts`); a mutation holds one for the transaction. One Admin cannot exhaust it.

### Rate-name validation complexity (DEF-006 fix, `rate-names.ts:57-69, 75`)

`rateNameIssues(name, otherNames)` calls `tokenize(name, ...)` in display form with the other names as rates. With `n` other rates and 5 fixed
operands (3 `Material-*`, 2 `ExchangeRate-*`), `L ≤ 100` the name length (`MAX_RATE_NAME_LENGTH`):

- `namedOperands` builds and sorts `n + 5` entries, longest first, ties by `localeCompare`: O((n+5) log (n+5)).
- The scan reads at most `L` tokens (a name of single characters joined by `-`, since `+ * / ( ) , < > =` are refused before the tokenizer
  runs). At each token `matchNamedOperand` does `find` over the sorted list with `startsWith`: O(L · (n+5)) comparisons, each failing at
  the first differing character in practice.
- The duplicate check is O(n · L). The checks run once per create or rename, never on read.

At n = 15: about 20 names and at most 2,000 `startsWith` calls. At n = 100: about 105 names and at most 10,500 calls plus about 735 sort
comparisons. Estimate: well under 1 ms in both cases; it runs inside the table lock, so it adds that much to the lock hold time, and that is
correct, because the check must judge the set it is written against. Not measured (no checkout); if the master-data volume ever reaches
10,000 rates, the same code is about 50 ms and should be revisited, but nothing suggests that. Longest-first matching is also what
makes the DEF-006 reading equal to a formula's reading, so there is no cheaper correct order. Calling `fixedOperands()` twice per call
(once in `rateNameIssues`, once in `namedOperands`) allocates 5 small objects; not worth a finding.

### Caching and invalidation

`getCurrentVersion` caches per version ID (bound 16, frozen document): no TTL is needed, because a version never changes. A new version is
seen at once because `findLatestRef` runs on every call, so another process cannot serve a stale version. The snapshot read happens once
per version per process, so there is no stampede worth guarding. Nothing new is cached by this story.

### Front end

- The list is drawn twice, a table from 768 px and cards below it, one hidden by CSS (`process-list.tsx:77, 107`). At 15 to 100 rates that is
  at most about 40 KB of extra HTML before compression, about 5 KB after; not a finding. Revisit with a virtualised or paged list only if
  rates pass about 500.
- Search is a client-side filter over the loaded list on each keystroke, O(n) with `toLowerCase`; no debounce is needed below about 5,000.
- After each change the screen refetches the whole list (`process-screen.tsx:131-142`) although the mutation response already holds the
  changed row. That is one extra request of about 2 queries per change, chosen so the order and the "Used in" letters are the server's.
  Acceptable for a screen an Admin uses occasionally.
- The dialogs are a separate chunk fetched on first use through the shared first-open loader, with a pending state on the button. The first
  press therefore costs one chunk request; that is the cost the AQP-188 ruling accepted for the 190,000 B target.
- LCP, INP and CLS were not measured here (Lighthouse is a separate nightly and gate run under NFR-009). The first paint holds the list from
  the server, and there is no `loading.tsx` by design, so there is no skeleton-to-content shift on first load.

### CI — what was asked

- **`ensure-seed-version.ts` in `verify` and in each shard.** It costs under 1 s per job, about 3 runner-seconds and about 1 s of wall time per
  run. It is needed in both places: stage 11b opens the page, which reads the version, and each shard's E2E opens it again on its own
  database. It cannot be shared between jobs because each job migrates its own throwaway database. No change asked.
- **Three new E2E tests at three widths.** The spec is 10 tests, not 3, so 30 runs. See PRF-02 for the measured cost and the proposal. The
  proposed three are `tests/e2e/process-master.spec.ts:135` (add and its refusals), `:170` (edit) and `:237` (search). They assert text,
  a request count, and focus moving to one named element that is the same at every width, which the ruling in 10.5 allows. `rowOf`
  uses `:visible`, so it finds the row in the table or the card alike.

</details>

## Reviewer-specific tables

### NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 pages: JS budget 200,000 B limit, 190,000 B target (AQP-188) | Low. 17,449 B to target, 27,449 B to limit on the heaviest route; shared first load +35 to +49 B | none |
| NFR-009 pages: LCP ≤ 2 s, TBT ≤ 200 ms | Not measured in this review; no cause for concern in the code (server-rendered list, lazy dialogs) | none |
| NFR-009 CI feedback: p95 ≤ 10 min (9-minute line), early warning at a 6-minute median | Low now (5:11), rising by 10 to 20 s per masters story | PRF-02 |
| NFR-010 page-data and save requests p95 ≤ 500 ms at 25 concurrent users | Low. Estimated 10 to 25 ms per request on the database side; one Admin; the table lock is held for about 3 statements. Needs the staging load test to confirm | PRF-01, PRF-04 |
| NFR-011 capacity (50 users, 25 concurrent; master-data volume not stated) | Low at the assumed 100 rates | PRF-06 |
| NFR-024 observability | No performance signal on the new path | PRF-04 |

## Previous Findings (re-review only)
Not applicable: round 1.

## Issues for other roles

- **reviewer-quality / developer:** in `createProcessItem` and `updateProcessItem` the call `usesByRate()` runs after the transaction has
  committed (`masters-service.ts:132, 169`). If the configuration version is missing or unreadable at that moment the caller gets a 500
  although the change is saved and audited. The delete path reads it first, which is the safer order. Not a performance matter; flagged for
  the quality review.
- **solution-architect:** the ruling and the allow-list for PRF-02, and the duration line of PRF-04.
- **product-manager:** PRF-06.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-113/performance.md` (not committed)
- Jira / GitHub updates: see the final message of the run (PR #107 review, Jira AQP-113 comment)
- Open questions: none
- Risks raised: none new; PRF-02 is a trend on the existing CI-time risk (RISK-023)
- Recommended next agent: orchestrator — consolidate the three reviews; no Blocker or Critical from performance

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 2 (new diff only) |
| Diff reviewed | `62267af..66ae5117` (code: 29 files; the later merge `a4d4d57` adds docs only, and `git diff --stat 62267af a4d4d57` over `src prisma tests .github scripts` is identical to `62267af..66ae511`) |
| Commit reviewed | `66ae5117a40fd143941c34ea4e67c1f391f108d1` (CI run 42326697243, green) |
| Date | 2026-11-07 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary

PRF-01 is resolved in code and covered by tests. The whole-set name check the master asked about is O(n² log n) in the number of rates:
the developer's figures are consistent with that model and are fine at the assumed 100 rates (4.5 ms), but 223 ms at 1,000 rates would be
synchronous work inside the table lock, so I ask the product-manager to state the volume (PRF-06) and record a revisit trigger (PRF-07).
Stage 11b passes with `/masters/process` at 173,440 B, and the other routes moved by at most 4 B. The run took 5m15s, 45 s below the
6:00 early warning; the `@one-width` ruling is still pending and PRF-02 stays open.

| Severity (open after round 2) | Count |
|-------------------------------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (PRF-02) |
| Info | 5 (PRF-03 to PRF-07) |

## Previous findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Minor | **Fixed** | `removeInTransaction` (`masters-service.ts`, from `66ae511`) now calls `masters.lockProcessItems(tx)` first, then `findProcessItemForUpdate`, as `addInTransaction` and `changeInTransaction` do: table lock, then row, in all three. The module comment states the order. Tests: `tests/unit/masters-service-set.test.ts:130` asserts the lock count after a delete (1, then 2 across an update-then-delete sequence), and `tests/integration/masters/process-items-names.test.ts` runs a delete and an update of one rate at once, 6 rounds, against PostgreSQL, and asserts the delete succeeds and the update either succeeds or fails with `NotFoundError`, never a server error. The 40P01 mapping I offered as optional was not added, which is fine now that no code path crosses the lock order |
| PRF-02 | Minor | **Not fixed (open, awaiting the architect's ruling)** | See below |
| PRF-03 | Info | Open, unchanged | `rateUsesOf` is still computed once per request; it now runs before the transaction in create and update (QLT-05), which is the same one call as before |
| PRF-04 | Info | Open, unchanged | Platform item for the solution-architect |
| PRF-05 | Info | Open, unchanged | The migration folder was renamed (`7bec601`); the indexes are the same |
| PRF-06 | Info | Open, see PRF-07 | The developer's measurements test the 100-rate assumption; the PRD still states no master-data volume |

A note on the race test: it is a real two-connection race, not a deterministic replay of the old order, so by itself it would pass on the
old code most of the time. The deterministic proof of the fix is the lock-count unit test. Together they are enough; I do not ask for
more.

## Stage 11b from the CI log of run 42326697243

| Route | Round 1 (`62267af`) | Round 2 (`66ae511`) | Change | To 190,000 target | To 200,000 limit |
|-------|--------------------:|--------------------:|-------:|------------------:|-----------------:|
| `/masters/process` | 172,551 | 173,440 | +889 | 16,560 | 26,560 |
| `/` | 162,499 | 162,499 | 0 | 27,501 | 37,501 |
| `/audit` | 171,846 | 171,842 | -4 | 18,158 | 28,158 |
| `/queue` | 163,658 | 163,658 | 0 | 26,342 | 36,342 |
| `/sign-in` | 166,339 | 166,336 | -3 | 23,664 | 33,664 |
| `/users` | 169,911 | 169,914 | +3 | 20,086 | 30,086 |
| not-found | 155,838 | 155,838 | 0 | 34,162 | 44,162 |

The coordinator's figures are confirmed. The +889 B on the page comes with the split of the screen into a hook, a results component and
a form module (`use-process-master.ts`, `process-results.tsx`, `process-form.ts`), the "deleted elsewhere" handling and the plain-text
refusal. The floor of 10,000 B to the 190,000 B target holds (16,560 B). The ±4 B on the other routes is build noise (hashes and chunk
boundaries), not a code change in the shared first load.

## CI time of run 42326697243

| Item | Round 1 (42316869370) | Round 2 (42326697243) | Master (42263941881) |
|------|----------------------:|----------------------:|---------------------:|
| Run created to end of `Stages 1 to 11` | 5m11s | **5m15s** (01:56:44 to 02:01:59) | 4m51s |
| To the 6:00 early warning | 49 s | **45 s** | 69 s |
| Job `Stages 1 to 11b` | 3m53s | 3m06s | 3m24s |
| E2E shard 1 job / Playwright | 4m04s / 2.6m (221 tests) | 3m51s / 2.4m (227 tests) | 4m40s / 2.8m (206) |
| E2E shard 2 job / Playwright | 5m02s / 3.1m (220 tests) | 5m01s / 2.9m (226 tests) | 4m19s / 2.6m (205) |
| E2E tests in total | 441 | 453 | 411 |
| `process-master.spec.ts` | 30 runs, 98.7 s | **42 runs, 129.8 s** (desktop 56.0, tablet 37.5, mobile 36.3) | none |

The spec grew from 10 to 14 tests (the two "deleted elsewhere" tests, the skeleton test and the "No rates yet" test), so +31 s of test
time, about +8 s of wall time at 4 workers (estimate). The critical path moved by 4 s (inside run-to-run noise), and the path is set by shard
2 at about 5 minutes. The 45 s that remain are the same trend as PRF-02: this story takes the path from about 4:51 to 5:15 (+24 s), and
the next masters stories will each add a spec of this shape. Nothing is tagged `@one-width` yet; the PR leaves the three tests untagged until
the architect rules. The three tests are now at spec lines 135, 170 and 290 (search); measured saving is 27.3 s to 11.7 s of test time,
about 4 s of wall time. **PRF-02 stays Minor and open**; it does not block this PR, because the line is not crossed and the ruling belongs
to the architect.

## New finding

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-07 | Info | `src/lib/formula/rate-names.ts` `rateSetIssues` (called from `masters-service.ts` `assertNameUsable`) | NFR-010 (p95 ≤ 500 ms), NFR-011 (volume not stated) | The set check reads every name against all the others on each create and rename: n+1 tokenizations, each sorting n+5 names (`namedOperands`) and matching them. Cost O(n² log n), run synchronously inside the table lock | Developer's measurements on their PC: 0.31 ms at n = 15, 4.5 ms at n = 100, 223 ms at n = 1,000. See the analysis below | None required at the assumed 100 rates. State a master-data volume in the PRD (PRF-06). Add a revisit trigger at about 300 rates (extrapolated at roughly 30 to 40 ms) or a hard cap of 200 rates with a message. If it is ever needed, sort the operand list once and reuse it across the n+1 readings, which removes the log factor and most of the constant |

<details><summary>The whole-set name check at 100 rates (the master's question)</summary>

**Do the figures fit the algorithm?** `rateSetIssues(names)` makes one `readsAsFormulaText` call per name. Each call runs `tokenize` with the
other n names as rates, which builds and sorts n+5 operands (longest first, ties by `localeCompare`) and then reads the name. A typical name
that is not a compound stops at its first token (a word that is no column letter throws at once), so the per-name cost is dominated by
the sort, about n log n. The total is about n² log n. From the developer's numbers, the cost per name is 4.5 ms / 101 = 45 µs at n = 100 and
223 ms / 1,001 = 223 µs at n = 1,000: a factor of 5 for a factor of 10 in n, which is what a sort-dominated per-name cost predicts (n log
n would give 15). The plain `n²` model would have given a factor of 100 in total and the measured total factor is 50, so the measurements
are consistent with, and slightly kinder than, the model. I could not rerun them (no checkout), so they are the developer's numbers on
their machine, not mine; a shared CI runner or a small VM is commonly two to three times slower, so I read them as an upper-bound factor of
about 3 on the server.

**Against the NFRs.**

| n | Dev PC | Server (x3, estimate) | Share of the 500 ms p95 (NFR-010) | Verdict |
|---|-------:|----------------------:|----------------------------------:|---------|
| 15 (seed) | 0.31 ms | about 1 ms | 0.2 % | Nil |
| 100 (PRF-06 assumption) | 4.5 ms | about 14 ms | about 3 % | Acceptable. It runs only on a create or a rename, by one Admin, and the table lock it is held under blocks only other writers to the same table |
| 1,000 | 223 ms | about 670 ms | above 100 % | Would breach NFR-010, and as it is synchronous JavaScript it would also stall the Node event loop for every one of the 25 concurrent users while it runs |

The Process Master holds the named rates of the cost sheet (15 in the SPEC, with a handful the Admin may add), so 1,000 is far outside any
use I can see; but the PRD states no number (PRF-06), so the safe course is to write the limit down, not to assume it. Nothing in the
current NFRs is breached at 100. The check is correct to run inside the lock: it must judge the set the change is written against.

**Reading and listing are unaffected**: the set check runs on writes only; the page, the list and the usage map have no n² term.

</details>

## NFR impact (round 2)

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 pages: JS budget | Low. `/masters/process` 173,440 B: 16,560 B to the 190,000 target, 26,560 B to the 200,000 limit; other routes within 4 B | none |
| NFR-009 CI feedback | Low now (5m15s, 45 s to the 6:00 early warning); the trend is the risk | PRF-02 |
| NFR-010 save requests p95 ≤ 500 ms | Low at 100 rates (about 14 ms for the name check on a server, estimate); the table lock is now taken in the same order in all three changes | PRF-07 |
| NFR-011 capacity (master-data volume not stated) | Open: the assumption of at most 100 rates is supported by the measurement, not by the PRD | PRF-06, PRF-07 |
| NFR-024 observability | Unchanged | PRF-04 |

## Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-113/performance.md` (Round 2 section appended, not committed)
- Jira / GitHub updates: PR #107 COMMENT review (round 2), Jira AQP-113 comment "reviewer-performance — G6 round 2"; label `review:performance-approved` kept (own label only)
- Open questions: none
- Risks raised: none new; PRF-02 stays a trend on RISK-023
- Recommended next agent: orchestrator — consolidate round 2 (performance has no Blocker, Critical or Major). Solution-architect: rule on the three `@one-width` tests (PRF-02) and PRF-04. Product-manager: state a master-data volume in the PRD (PRF-06, PRF-07)
