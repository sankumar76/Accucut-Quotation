# Review Report — AQP-123 (STORY-02.04 Exchange Rate Master) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-123-exchange-rate-master` (PR #151; branched from 023e17d; master is 051c0b5 and has moved by docs-only PRs) |
| Commit reviewed | 939f32fb4de117dfb4d1f17027b4e087b6f21d05 |
| CI run | 42761745140 (success, first attempt, 5 of 5) |
| Date | 2026-11-10 |
| **Verdict** | APPROVE |

PR review (COMMENT, single-token) with 6 inline comments: https://github.com/sankumar76/Accucut-Quotation/pull/151#pullrequestreview-5837406015. Label applied: `review:performance-approved`.

## Summary
Nothing in this PR threatens an NFR. The panel is lazy (`/masters/materials` +308 B, tripwire +1,500 B). The database work is a two-row table, a handful of statements per request and a transaction of tens of milliseconds. The extra `columns` field is 254 B. The story's own addition to the CI path is about 12 s (3 %), which is proportionate; most of the 6:17 is runner variance on a baseline that already sits at 5:28. All six findings are Info.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 6 (PRF-01 to PRF-06) |

## Figures verified

### 1. First-load JavaScript (NFR-009, PRF-01 of #121)
Source: stage 11b output, base run 42745778069 (push 023e17d) and head run 42761745140 (PR head 939f32f). gzip bytes, limit 200,000.

| Route | Base 023e17d | Head 939f32f | Delta | Headroom now |
|---|---|---|---|---|
| `/` | 162,513 | 162,513 | 0 | 37,487 |
| `/audit` | 172,061 | 172,085 | +24 | 27,915 |
| `/masters/materials` | 186,731 | 187,039 | **+308** | 12,961 |
| `/masters/process` | 173,855 | 173,881 | +26 | 26,119 |
| `/queue` | 163,672 | 163,672 | 0 | 36,328 |
| `/sign-in` | 166,336 | 166,336 | 0 | 33,664 |
| `/users` | 170,136 | 170,136 | 0 | 29,864 |
| not-found | 155,838 | 155,838 | 0 | 44,162 |

- The tripwire of the Dev Context (more than +1,500 B over the story's base means the panel is not lazy) is **not** met: +308 B is 21 % of it. The Dev Record's figures match the logs to the byte.
- Static imports read from the first-load files: `masters-screen.tsx` imports the panel by `import type` only (erased) and by a bare `import()` in `loadExchangeRatesPanel`; `exchange-rates-slot.tsx` imports shared pieces (`states`, `Button`, `Icon`, `process-texts`) and `exchange-rate-texts`; the hook, the browser client, the rules, `UnitInput` and `FormField` are reachable only through the `import()`. `TabsContent` has no `forceMount`, so a tab that is not active is not mounted.
- The Radix Tabs bar was already in the route (AQP-122), so the 308 B is a tab trigger, the slot and a text constant. An eager panel would have been about 2 to 4 KB (estimate from AQP-122 PRF-01).
- `/audit` +24 B and `/masters/process` +26 B: chunk packing in shared code (the same behaviour as AQP-122 PRF-07). Immaterial.
- First activation costs two serial requests: the chunk (`import()`), then `GET /api/v1/exchange-rates`. About 100 to 150 ms on office Wi-Fi (estimate), under the 300 ms skeleton delay. The chunk's own size is not in the budget output (estimate 4 to 7 KB gzip; not measured: I did not build the branch).

### 2. CI time (NFR-009 CI; RISK-023)
Path = first job start to end of `Stages 1 to 11` (test strategy 10.3). Source: `gh api .../actions/runs/<id>/jobs` and the Playwright list lines of the six shard logs (3 base, 3 head), summed per spec with a script in the scratchpad.

**Path of the head and of the base**

| | Base push 023e17d (42745778069) | Head 939f32f (42761745140) | Delta |
|---|---|---|---|
| Path | 5:49 (02:53:17 to 02:59:06) | 6:17 (05:22:41 to 05:28:58) | +28 s |
| Slowest shard job (shard 3) | 5:44 | 6:12 | +28 s |
| Shard 3 before the E2E step (install, build, caches) | 112 s | 123 s | +11 s (install 73 -> 76 s) |
| Shard 3 E2E step | 227 s | 243 s | +16 s |
| E2E steps, shards 1, 2, 3 | 158, 209, 227 s | 182, 193, 243 s | sum +24 s |
| Stages 1 to 11b job | 4:02 | 4:20 | +18 s (off the critical path) |
| Tests run (3 shards) | 252 + 252 + 251 = 755 | 263 + 262 + 262 = 787 | +32 |

**Worker time by spec** (sum over the three shards, passed tests, seconds)

| Spec | Base n, s | Head n, s | Delta s |
|---|---|---|---|
| `exchange-rates.spec.ts` (new) | 0, 0.0 | 39, 94.1 | +94.1 |
| `canary-scan.spec.ts` (+1 Admin control, +1 loader call) | 24, 44.4 | 27, 58.3 | +13.9 |
| `process-master.spec.ts` (3 tests now one width) | 45, 192.7 | 39, 166.5 | -26.2 |
| `materials.spec.ts` (2 tests now one width) | 48, 159.9 | 44, 158.5 | -1.4 |
| `auth.setup.ts` (warm-up) | 9, 86.4 | 9, 92.5 | +6.1 |
| All other specs, unchanged count | 1,640.8 | 1,633.8 | **-7.0 (-0.4 %)** |
| Total | 2,037.8 | 2,111.2 | +73.4 |

- **The story's own worker time** is the new spec +94.1, canary +13.9, tags -27.6 = **+80 s (+3.9 %)**. Spread over 12 worker lanes (3 shards x 4) that is +6.7 s per lane. Observed E2E step: +24 s summed over the shards, +8 s per shard.
- **On the slowest shard (3):** new spec 35.7 s and canary +4.3 s = 40 s / 4 workers = **10 s**, plus about 1.6 s of serial set-up (PRF-03) = **about 12 s of the +16 s**; the other 4 s is how the tests fell on the shards (Playwright splits by test index).
- **Per added instance:** 29 net instances for about 12 s = 0.4 s per instance, against 0.7 s in the AQP-122 trend. Proportionate.
- **Unchanged specs moved -0.4 %**, so the run was not a slow runner for the tests themselves. The extra seconds on shard 3 are mostly in its set-up (+11 s: install +3 s, container, Node and cache steps).

**Variance on identical code.** The same E2E set (252 + 252 + 251 tests, no code in the E2E path changed) ran on docs-only PRs and pushes:

| Run | Event | Path | Slowest shard E2E step |
|---|---|---|---|
| 42742355524 (ae16906) | PR | 345 s | not read |
| 42743611267 (39eb096) | push | 301 s | not read |
| 42744806381 (3ff314d) | PR | 347 s | not read |
| 42745778069 (023e17d) | push | 349 s | 227 s |
| 42747229258 (dae58dd) | PR | 351 s | not read |
| 42755110021 (c91fd64) | PR | 323 s | not read |
| 42756737686 (8bc0dbf) | PR | 281 s | 176 s |
| 42757450173 (051c0b5) | push | 329 s | 199 s |

Mean 328 s (5:28), range 281 to 351 s, standard deviation about 26 s. Shard E2E steps on that same code ranged 146 to 227 s. Dependabot runs and the AQP-243 run (set-up cut) are left out because their code or CI differs. This agrees with master's reading in RISK-023 (b02955b ran 5:57, 6:17 and 5:05 on three attempts).

**Attribution of the 377 s head against the 328 s mean (+49 s):** about 12 s is the story, about 37 s is the runner draw of this run (shard 3 set-up +11 s over the base, and the rest in the test step). **Expected first attempt for this story: about 5:40, range 5:13 to 6:03 (estimate: mean + 12 s, +/- the observed range).** The baseline is already at the 5:30 line of DL-123 (d), so any story that adds E2E tests crosses it; that is RISK-023 and AQP-243 / AQP-244, not this PR.

**DL-123 (d) rule (orchestrator's):** a path of 5:30 or more means the head plus two full re-runs and the median. My estimate for that median is 5:30 to 5:50. I cannot re-run CI.

**The two `@one-width` candidates** the developer offers ("a save with the values that are already stored sends nothing", 5.3 s over 3 widths; "a save that fails says so in a notice", 5.8 s): tagging both saves 2 x ~1.9 s = about 7.4 s of worker time, about 0.6 s of path. It is not a lever, and the ruling belongs to the architect.

### 3. Database
- **Migration `20261110040000_exchange_rates`:** a new empty table; primary key on `currency` (implicit index); CHECK that the currency is USD or EUR, so the table holds at most two rows; CHECK that a rate is 0 or more. No secondary index is useful (every read is the whole table). The foreign key on `updated_by` has no index; this matters only for a delete or key change of a `users` row, which does not happen (users are deactivated) and would scan two rows. `ADD FOREIGN KEY` takes a brief SHARE ROW EXCLUSIVE lock on `users` (under 50 rows). Additive, with a rollback note. Grants: SELECT, INSERT, UPDATE.
- **Round trips.** `GET`: the session read, `findLatestRef` (the existing cached-parse pattern for the registry) and one `findMany` of two rows, run with `Promise.all` for the last two: about 3 to 4 statements. `PUT` that changes a rate: `findLatestRef`, then BEGIN, `LOCK TABLE`, `SELECT ... FOR UPDATE`, two upserts, a read-back, the audit INSERT, COMMIT: about 10 to 11 statements. `PUT` that changes nothing: BEGIN, LOCK, SELECT, COMMIT. The screen's save is `PUT` then `GET`: about 15 statements, around 45 ms at 3 ms each (estimate), against NFR-010's p95 of 500 ms (PROPOSED).
- **Transaction and lock.** `SHARE ROW EXCLUSIVE` blocks writers, not `SELECT`. The transaction holds no external call: the configuration is read before it opens, and the audit append is one INSERT. A waiting save is bounded by `statement_timeout` (10 s) and answers 503 `DATABASE_BUSY`. One Admin means no contention. The lock order (table, rows, audit insert) is the Materials master's, so no deadlock. The table lock already excludes other writers, so `FOR UPDATE` is redundant for exclusion; it is harmless on two rows and returns the stamp.
- **No N+1, no unbounded result, no `SELECT *`.** The columns selected are named. `LOCKED_ROWS.parse` and `columnOfKey` (a linear scan of the registry, four keys) are microseconds.

### 4. Payload
`GET` and `PUT` answer: 351 B JSON with the registry's real labels, of which `columns` is 254 B (72 %). Sent once per tab open and once per save. The alternative (derive letters in the browser) would put the registry and `fieldLetter` in the lazy chunk, far more than 254 B per read, with a second source of letters.

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `gh pr view 151`; detached worktree at 939f32f (files read: migration, repository, service, route, schema, panel, slot, hook, masters-screen, page, composition, audit-events, `lookup.ts`, `auth.setup.ts`, `canary-scan.spec.ts`, the new spec's list of tests) | Done |
| CI jobs and step times | `gh api repos/.../actions/runs/<id>/jobs` for 42761745140, 42745778069 and 8 docs-only runs | Figures above |
| Shard logs | `gh run view --repo ... --job <id> --log`, colours stripped, Playwright list lines summed per spec and per shard (Node script in the scratchpad) | Figures above |
| Stage 11b | the "PASS ... gzip" lines of the 11b job logs, base and head | Table 1 |
| NFR and rules | PRD NFR-009 to NFR-011; architecture pool and timeouts (pool 10, `statement_timeout` 10 s); test strategy 10.3 and 10.5; RISK-023; DL-123 (d), DL-125, DL-126; AQP-122 performance report | Read |
| Not run | A build of the branch (no installed dependencies or database in my worktree), Lighthouse, local query plans, local Playwright or database suites (as instructed), a CI re-run | Stated, not claimed |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `src/components/features/masters/masters-screen.tsx:33` | NFR-009 JS 200 KB; #121 PRF-01 | The panel is lazy; `/masters/materials` +308 B (186,731 to 187,039 B); tripwire +1,500 B not met; headroom 12,961 B | Closes #121 for 02.04; 02.05 should follow the same shape | None |
| PRF-02 | Info | `tests/e2e/exchange-rates.spec.ts:18` | NFR-009 CI; RISK-023; DL-123 (d) | Story's own cost about +12 s of the 6:17 (+80 s worker time, 0.4 s per added instance); 328 s is the mean of identical-code runs, range 281 to 351 s | Proportionate. Expected first attempt about 5:40 (5:13 to 6:03) | None in this PR. Orchestrator: DL-123 (d) re-run median (my estimate 5:30 to 5:50) |
| PRF-03 | Info | `tests/e2e/auth.setup.ts:104` | NFR-009 CI | `warmExchangeRatesRoutes` repeats the `goto`, heading and hydration wait of `warmMaterialsRoutes` inside the serial set-up test: Admin set-up test +1.6 s mean per shard (13.6/18.0/17.0 to 16.6/17.6/19.2 s; within noise) | About 1 s of path per shard (estimate) | Optional: reuse the page already open |
| PRF-04 | Info | `prisma/migrations/20261110040000_exchange_rates/migration.sql:12` | NFR-010, NFR-011 | Database review: two-row table, primary key only, no index needed; GET 3 to 4 statements, PUT 10 to 11 (4 when unchanged); lock blocks writers only; transaction tens of ms | About 45 ms per screen save (estimate), well under 500 ms | None |
| PRF-05 | Info | `src/components/features/masters/use-exchange-rates.ts:134` | NFR-010 | A save is followed by a `GET` though the `PUT` answer carries the same view; each return to the tab reads again (unmounted `TabsContent`) | One extra cheap request per save (a few a year) | None requested |
| PRF-06 | Info | `src/server/views/schemas/exchange-rates.ts:39` | NFR-009, NFR-010 | `columns` is 254 B of a 351 B answer; cheaper than deriving letters in the browser | Immaterial | None. Whether architecture section 6 lists it is the architect's |

## Reviewer-specific tables

### NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS, 200 KB gzip | Low: +308 B, 12,961 B left on the heaviest route | PRF-01 |
| NFR-009 CI, p95 at most 10 min, 6 min median warning | Low for the story (+12 s); this run's 6:17 is a slow draw on a 5:28 identical-code mean; RISK-023 stays with AQP-243 / AQP-244 | PRF-02, PRF-03 |
| NFR-009 pages (LCP, TBT) | Not affected beyond +308 B on one route; Lighthouse not run (no change to the key screens' first load) | PRF-01 |
| NFR-010 server p95 500 ms at 25 users (PROPOSED) | Low: about 45 ms per save, 3 to 4 statements per read (estimates) | PRF-04, PRF-05, PRF-06 |
| NFR-011 capacity | Low: the table is fixed at two rows by CHECK; the open master-row volume question (AQP-122 PRF-06) is not affected | PRF-04 |
| NFR-002 confidentiality (cross-reference, not my lens) | `columns` carries letters and labels only, no value; the route is Admin only | none |
| NFR-008 calculation, NFR-024 observability | Not affected: no calculation; the save is not a critical path that needs a timing metric | none |

### Answers to the developer's questions (performance view)
1. **Audit event name** (`master.edited` + `object_type` `exchange_rate` or the AC's `master.exchange_rate.updated`): no performance effect. An entry is written only by a save that changes a rate (a handful a year); `audit_log` has indexes on `created_at` and `actor_id` only, none on the event name or the object type.
2. **The `columns` field:** acceptable and the cheaper design (PRF-06). The architecture section 6 wording is the architect's.
3. **The five state sentences:** no performance effect (a few hundred bytes in the lazy chunk, not in the first load).

## Previous Findings (re-review only)
Not applicable (round 1). The prior items that touch this story: #121 PRF-01 (lazy panel and the +1,500 B tripwire) is met; PRF-06 of AQP-122 (master-row volume in NFR-011) is still open with the product-manager and is not made worse here.

## Issues for other roles
- **orchestrator:** the DL-123 (d) re-run (head plus two full re-runs, median) applies to the 6:17; I cannot re-run. Do not read the 6:17 as the story's cost.
- **solution-architect (optional):** whether section 6 lists `columns`; whether the two named tests become `@one-width` (about 0.6 s of path; not a CI-time lever).
- **developer (optional, PRF-03):** reuse the open page in the set-up warm-up.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-123/performance.md` on branch `docs/AQP-123-review-performance`
- Jira / GitHub updates: PR #151 COMMENT review 5837406015 with 6 inline comments (PRF-01 to PRF-06) and the summary with the NFR impact table; label `review:performance-approved`; Jira AQP-123 hand-off comment
- Open questions: none
- Risks raised: none new; RISK-023 noted (baseline mean 5:28 on identical code; the story adds about 12 s)
- Recommended next agent: orchestrator — consolidate the three G6 reviews and run the DL-123 (d) re-runs; then master for G6
