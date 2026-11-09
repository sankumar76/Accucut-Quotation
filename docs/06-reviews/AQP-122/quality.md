# Review Report — AQP-122 (STORY-02.03 Material Master) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-122-material-master` (PR #120; base 3695f90) |
| Commit reviewed | 40107d5 |
| Date | 2026-11-08 |
| **Verdict** | **REQUEST CHANGES** (2 Major; no Blocker or Critical) |

## Summary

The product code is correct and carefully built. Every change and its audit entry share the change's own transaction. The specific-gravity rule is checked in three places: the route schema, the service and a table CHECK. The options read never selects a number, and its strict schema is kept in a file of its own. The `is_hidden` / `deleted_at` filter is on every read and on the row lock. The lock order (table, then row) matches PRF-01. I planted 11 faults in a scratchpad worktree, and 10 of them were caught by the existing tests.

Two Major findings, both in the tests, not the product:

- **QLT-01.** The canary loader `ensureCanaryMaterials` says it is "safe when three screen sizes run it at once". It is not. Its upsert names only `(id)` as the arbiter, and the table has two more unique indexes on the name. A probe that ran three loaders at once on an empty table failed in **32 of 40 rounds** with `duplicate key … uq_materials_material_in_drawing`. The suggested fix failed in 0 of 40.
- **QLT-02.** Writing the **edit's** audit entry outside its transaction (plant P3u) passes all 140 material tests. Only the create path has the "a refused entry takes the change back" test (DEF-017). The missing update twin is given below: it fails on the plant and passes on the real code.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (QLT-01, QLT-02) |
| Minor | 3 (QLT-03 to QLT-05) |
| Info | 5 (QLT-06 to QLT-10) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| PR CI | GitHub check runs for 40107d5 (run 42500626525) | 4 of 4 green: Stages 1 to 11, Stages 1 to 11b, E2E shard 1, E2E shard 2 |
| Full Vitest suite, real PostgreSQL 17 (throwaway container, random role passwords, never printed; `.env*` not read) | `npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage --exclude tests/unit/playwright-system-deps.test.ts` | **180 files, 4421 passed, 0 failed** (second run). The first run had 2 timeouts in `tests/acceptance/aqp-38-sign-in.test.ts`, which this PR does not touch. They happened while my plant runs were loading the machine, and the file passed 42/42 when run alone. No timeout was raised (DL-057) |
| Changed-code coverage | `npx tsx scripts/check-changed-coverage.ts --base origin/master` | **92.9 %** (143 of 154 added lines), threshold 80 % |
| E2E `materials.spec.ts`, `canary-scan.spec.ts` | not run locally | CI shards green (45/45 and 27/27 per the Dev Record) |
| Fault plants (scratchpad worktree, detached at 40107d5, reverted after each, never committed) | the 6 material test files: service, routes, lib and audit-events unit tests, `integration/masters/materials.test.ts`, `security/strict-schema.test.ts` | 10 of 11 caught; table below |
| Probes (scratchpad only) | three concurrent canary loaders × 40 rounds; the two-edit race × 60 rounds; the suggested update test | Results under QLT-01, QLT-02 and QLT-03 |

### Fault plants

| # | Plant | Caught by | Result |
|---|-------|-----------|--------|
| P1 | Service no longer checks specific gravity (route schema kept) | 5 unit (`masters-service-materials`) + 4 integration | Caught (9) |
| P1c | Neither the service nor the schema refuses 0 | 4 route tests (POST 0, 0.00, all-fields, PATCH 0) | Caught |
| P2a | Options read selects `price_per_kg` and passes it on | integration "reads no number for the options" (and the strict schema would answer 500) | Caught |
| P2b | Service builds options from the full records **and** the options schema gains `pricePerKg` | 3 route tests (Admin, Lead, Engineer), 1 service test, 1 integration test | Caught (5) |
| P3 | Create: audit entry written in its own transaction after the change commits | integration "an entry the audit service refuses takes the change back" | Caught (1) |
| **P3u** | **Update: audit entry written in its own transaction after the change commits** | **none** | **Survived, QLT-02** |
| P4 | `is_hidden = false` removed from the default filter and the row lock | integration AC-1 hidden-row test (2 more failures are knock-on effects, QLT-05) | Caught |
| P5 | Row lock taken before the table lock | unit "takes the table lock before the row lock" | Caught |
| P6 | CHECK without the hidden-row exemption | 2 integration tests | Caught |
| P7 | No `.trim()` on Material in Drawing | 3 route tests | Caught |
| P8 | No `lower()` unique index | 4 integration tests (the race test included) | Caught |

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 list, search, `is_hidden = false` by default | `master-repository.ts:180` (`LISTED`), `:241` (row lock); `page.tsx`; `materials-panel.tsx`, `material-list.tsx`, `use-material-master.ts:27` (search) | integration AC-1 (hidden and deleted never listed or found; P4); E2E "tab shell and list", "search and states" | Met |
| AC-2 case-insensitive unique name, 0 or more with 2 decimals, SG above 0 refused by the server on POST and PATCH, `Decimal(18,4)` | `migration.sql:39` (lower index), CHECKs `:43-48`; `schemas/materials.ts`; `masters-service.ts:133,199-207`; `lib/masters/materials.ts:87` | route tests (13 POST, 5 PATCH refusals), service tests, integration AC-2 (storage, the 14-digit limit, both roles); P1, P1c, P6, P7, P8 | Met |
| AC-3 blank name, negative price, SG 0, three decimals: 422 with the field named, nothing stored | strict body schemas; `FieldValidationError` | `materials-routes.test.ts:109-131,170-183` | Met |
| AC-4 `/options/materials`: IDs, names and Material Considered only, no rate, strict schema | `options/materials/route.ts`, `schemas/options.ts`, `master-repository.ts:225-232` | route tests as all 3 roles (key set and text scan), `strict-schema.test.ts`, E2E options test; P2a, P2b | Met |
| AC-5 exactly one audit entry with who, when, object, before and after | `masters-service.ts:162-187`, `audit-events.ts` (`masterState`) | service, audit-event and integration tests (DEF-017 late failure on both paths; refused entry on **create only**) | Met; event name per architecture §8 (QLT-06); test gap on update (QLT-02) |
| AC-6 403 / SCR-26 / 401; canaryMasters; scan finds 0 | manifest rows; `canary-masters.ts`; `material-master-canary.ts`; `ensureCanaryMaterials` | `role-matrix.test.ts`, `engineer-refused-before-lookup.test.ts`, E2E scan (manifest-driven, 2 new tests) | Met; loader race (QLT-01) |
| AC-7 3 widths, no sideways scroll, 44 px, axe 0, keyboard | `material-list.tsx`, `material-form-dialog.tsx`, `tabs.tsx` | E2E `materials.spec.ts` (CI) | Met (CI evidence) |
| AC-8 the SCR-13 states and their wording | `material-results.tsx`, `material-form-dialog.tsx`, `material-texts.ts` | E2E states tests; wording checked against `SCR-13.html` ("Enter a value above 0.", "Must be above 0.", duplicate sentence, "We could not load the materials") | Met; proposed words (QLT-08) |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `tests/e2e/support/auth.ts:203-206` (claim at `:196-197`) | AC-6; test strategy §10 flaky-test policy (DEF-003 class); DL-057; RISK-023 | The upsert arbitrates on `(id)` only. In PostgreSQL, `ON CONFLICT (id)` does not cover the other unique indexes (`uq_materials_material_in_drawing`, `…_lower`). When two loaders insert the same new row at once, the second gets a unique violation on the name index instead of taking the `DO UPDATE` path. Probe: 3 loaders at once on an empty table, **32 of 40 rounds failed** | The 5 scan tests that load the canaries run at 3 widths with `fullyParallel` and 4 workers. On a fresh CI database, whichever two start together can fail on the first attempt. `retries: 1` hides it as "flaky", but each retry costs path time against the 6:00 warning (5:17 now) and adds noise to the flaky-test record. CI passed this time, but the comment's safety claim is false | `INSERT … ON CONFLICT DO NOTHING` (no target: every unique index arbitrates), then `UPDATE … WHERE id = $1`. Same probe: **0 of 40**. Or load the canaries once in `auth.setup.ts`. Correct the comment |
| QLT-02 | Major | `tests/integration/masters/materials.test.ts:276-281` | AC-5; NFR-007 ("audit row in the same transaction"); architecture §8 row lock and §6; DEF-017 regression | "An entry the audit service refuses takes the change back" exists for create only. Plant P3u (the edit's entry written in its own transaction after the change commits) passes all 140 material tests. The late-failure test (`:267`) cannot see it, because its runner fails the change's transaction first | A later refactor of `changeMaterial` (for example 02.07 adding delete beside it) could commit an edit with no entry, or with an entry the service refused, and no test would fail. NFR-007 requires 100 % | Add the update twin (below). Verified: it **fails on P3u** (`expected '9.3700' to be '3.3700'`) and **passes on 40107d5** |
| QLT-03 | Minor | `tests/integration/masters/materials.test.ts:303-307` | AQP-113 QLT-02 ruling; `process-items-names.test.ts:16` ("none of these tests orders anything by time"); DL-057 | The race test takes `[first, second]` from `ORDER BY created_at, id`. `created_at` is in milliseconds, and the tie-break is a random UUID | If the two edits land in the same millisecond, the order is random and `second.before == first.after` fails. Probe: 60 rounds, **0 ties, smallest gap 11 ms** on this machine, so the risk is low. CI is faster, and the project ruled this pattern out after AQP-113 | Make the assertion order-free: find the entry whose `before` is the created state, then expect the other entry's `before` to equal its `after` |
| QLT-04 | Minor | `prisma/migrations/20261108100000_materials/migration.sql:33,39` | Architecture §5.1, A-13 (soft delete); §4.9 | Both unique name indexes also cover soft-deleted and hidden rows | Not reachable yet. Once 02.07 soft-deletes a material, its name stays taken: re-adding "MS sheet" after deleting it gets "A material with this name already exists" for a material the Admin cannot see or restore | For 02.07 (solution-architect to rule): a partial index `WHERE deleted_at IS NULL`, with the hidden row's name guarded by 02.06's `NAME_RESERVED`. Or record that deleted names stay reserved and word the message to say so |
| QLT-05 | Minor | `tests/integration/masters/materials.test.ts:101,111,119` (also `:162`) | Test isolation | Each test's `DELETE FROM materials` cleanup is at the end of the test body. If the test fails, the cleanup is skipped and the leftover rows fail later tests | Plant P4 had 1 real failure and was reported as 3. Wrong failures cost diagnosis time | `try { … } finally { await db.owner.query('DELETE FROM materials') }`, or an `afterEach` for the AC-1 block |
| QLT-06 | Info | `src/server/services/audit-events.ts:188` | AC-5 vs architecture §8 (AQP-74 ruling, 2026-11-06) | `master.created` / `master.edited` with `object_type` `material`, not `master.material.*` | AC-5's substance is fully met. The AC (2026-11-02) predates the ruling, which names `material` as its example. **Agree with the developer.** The product-owner should correct AC-5's text before G7, as was done for AQP-113 | none in code |
| QLT-07 | Info | `src/lib/masters/materials.ts:42,87` | AC-2, AC-3; OQ-ARCH-05 / Q-40 | Specific gravity is limited to 2 decimals. AC-2 states 2 decimals only for the price and the scrap rate. Q-40 covered rates, prices and exchange rates, not specific gravity | Common metal values have 2 decimals (7.85, 2.70, 8.96), but some references give 3 (7.874, 2.699; some plastics 0.946). Storage is already `Decimal(18,4)`, and the edit form checks a number only when it changed, so widening later is a one-pattern change. **Accept as is** | business-analyst to confirm with the delivery lead (not blocking) |
| QLT-08 | Info | `src/lib/masters/materials.ts:35,42` | AC-8; ux-spec SCR-13 | The proposed words ("Enter the Material Considered.", "Enter a number above 0, with up to 2 decimals.", "Search materials", empty and no-match texts) are clear and in the house style | Material in Drawing says "Enter a name." while Material Considered says "Enter the Material Considered.", so the two required-field messages are not parallel | ux-expert to adopt the words, perhaps with "Enter the Material in Drawing." |
| QLT-09 | Info | `src/server/services/masters-service.ts:199-207` | Architecture §4.1 (service owns business rules) | The service checks specific gravity itself. The trim, the 2-decimal shape and the non-negative price and scrap rate rely on the route schema and the table CHECKs | Acceptable today, because every write enters through a route (ADR-010). A future non-route caller (an import, a 02.06 helper) passing `" X "` would store the spaces, which `lower()` does not fold | Note for 02.06 and any import story; no change now |
| QLT-10 | Info | whole PR | — | Good practice, proved by the plants: specific gravity defended in 3 places (P1, P1c, P6); options read with no number plus a separate strict schema (P2a, P2b); case-insensitive uniqueness at the database (P8); lock order (P5); default filter (P4); one transaction per change on create (P3) | — | Keep |

Cross-references (not repeated here): STD-05 (the `describeMaster` key test should be a discriminant); PRF-04 (the plain unique index is redundant beside the `lower()` one).

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`tests/e2e/support/auth.ts:203-206`)
```ts
INSERT INTO materials (id, …) VALUES ($1::uuid, …)
ON CONFLICT (id) DO UPDATE SET material_considered = EXCLUDED.material_considered, …
```
**Suggested**
```ts
await client.query(
  `INSERT INTO materials (id, material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate)
   VALUES ($1::uuid, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [id, materialInDrawing, materialConsidered, pricePerKg, specificGravity, scrapRate]);
await client.query(
  'UPDATE materials SET material_considered = $2, price_per_kg = $3, specific_gravity = $4, scrap_rate = $5 WHERE id = $1::uuid',
  [id, materialConsidered, pricePerKg, specificGravity, scrapRate]);
```
**Test that catches it:** three loaders started together on an empty `materials` table, many rounds, expect no rejection (the probe: 32/40 failing before, 0/40 after).

### QLT-02
**Suggested test** (beside `materials.test.ts:276`)
```ts
it('update: an entry the audit service refuses takes the change back', async () => {
  const created = await db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'Refused-edit' });
  const entries = await entryCount(db);
  await expect(db.mastersService.updateMaterial({ ...by(), actorLabel: '' }, created.id, { scrapRate: '9.37' }))
    .rejects.toMatchObject({ reason: 'shape' });
  expect((await byName('Refused-edit'))?.scrap_rate).toBe('22.3700');
  expect(await entryCount(db)).toBe(entries);
});
```

### QLT-03
**Suggested**
```ts
const original = { ...ADDED, materialInDrawing: 'Race-edit' };
const first = edits.find((entry) => isDeepStrictEqual(entry.before, original));
const second = edits.find((entry) => entry !== first);
expect(defined(second).before).toEqual(defined(first).after);
```
</details>

## Issues for other roles

- **product-owner:** correct AC-5's event wording (QLT-06).
- **ux-expert:** confirm the proposed words and add the Materials empty and no-match texts to SCR-13 (QLT-08).
- **business-analyst:** confirm with the delivery lead that 2 decimals is enough for specific gravity (QLT-07).
- **solution-architect:** before 02.07, rule on whether a soft-deleted material's name stays reserved (QLT-04).

## Previous Findings (re-review only)

n/a (round 1).

## Hand-off
- Status: COMPLETE
- Verdict: REQUEST CHANGES · Blocker 0 · Critical 0 · Major 2 · Minor 3 · Info 5
- Artefacts written/updated: `docs/06-reviews/AQP-122/quality.md` (main folder, not committed)
- Recommended next agent: developer, for QLT-01 and QLT-02 (both test-only, small), then a re-review of the new diff

---

# Round 2

| Field | Value |
|-------|-------|
| Review round | 2 (narrow, master's G6 ruling 5, DL-115, Jira 11186) |
| Range reviewed | `40107d5..b02955b` (59426c8 tests; b02955b product code and wording); developer hand-off Jira 11189 |
| Commit reviewed | b02955b |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** (new: Blocker 0 · Critical 0 · Major 0 · Minor 1 · Info 1; both Majors from round 1 fixed and proved) |

## Summary

Both round-1 Majors are fixed, and plants prove each fix. The committed canary loader fails **0 of 40** rounds of three simultaneous loaders. Putting the old `ON CONFLICT (id)` back makes the developer's new loader test fail. Writing the edit's audit entry outside its transaction (P3u) now fails the new update test. QLT-03 and QLT-05 are fixed: no assertion orders entries by time, cleanup runs in `afterEach`, and P4 now reports 1 failure instead of 3.

The overflow fix for a long search text is correct and its test is sound. The fix is local to one screen, though, and SCR-11 has the same fault (new Minor R2-QLT-11, for a follow-up).

## Checks run (round 2)

| Check | Command | Result |
|-------|---------|--------|
| PR CI | check runs for b02955b, run 42506525720 | First attempt green (the developer's hand-off, confirmed from the job logs by reviewer-standards and reviewer-performance). At my read, a **re-run attempt** of the same run was in progress, started 18:05 at reviewer-performance's request (PRF-08); I did not start it |
| Full Vitest suite at b02955b, throwaway PostgreSQL 17 (scratchpad worktree) | `npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage --exclude tests/unit/playwright-system-deps.test.ts` (+ my probes excluded) | First run: 4420 passed, 6 failed. **None of the six is in a file this range touches:** 3 load timeouts in the sign-in lock-out tests (DEF-003 class; each file passes alone: 42/42, 14/14); 1 `e2e-shards.test.ts`, caused by my own untracked probe spec in `tests/e2e` (passes once it was moved out); 2 `server-only-build.test.ts`, which runs a real Next build and fails in the scratch worktree both times (that worktree's `node_modules` is a junction; the file is untouched since master, passed in round 1 in a worktree with real `node_modules`, and CI stage 11 is green). **Second run, with that file excluded: 179 files, 4424 passed, 0 failed.** No timeout raised (DL-057) |
| Changed-code coverage | `npx tsx scripts/check-changed-coverage.ts --base origin/master` | **93.3 %** (153 of 164 added lines), threshold 80 % (matches the developer's figure) |
| E2E | not run locally (the Playwright web server builds with Turbopack in a worktree whose `node_modules` is a junction, the environment the `server-only-build` failure points at) | CI shards green; overflow fix judged with a headless-Chromium repro (below) |
| Lint, type-check | not re-run | reviewer-standards round 2: 0 and 0 at b02955b |

### Probes and plants (scratchpad worktree at b02955b, each reverted, nothing committed)

| # | Probe or plant | Expected | Result |
|---|---|---|---|
| Probe | 40 rounds, three connections run the **committed** `loadCanaryMaterials` at once on an empty table | 0 failures | **0 of 40** (round 1: 32 of 40 with the old statement) |
| P9 | The committed loader's insert put back to `ON CONFLICT (id) DO UPDATE` | the new loader test fails | **Caught** by "three loaders on three connections, each round on an empty table" (1 failure) |
| P3u | The edit's `master.edited` entry written in its own transaction after the change commits | a test fails | **Caught** by "update: an entry the audit service refuses takes the edit back" (1 failure; round 1: none) |
| P4 | `is_hidden = false` removed from the default filter and the row lock | a test fails, once | **Caught**, 1 failure (round 1: 1 real failure reported as 3) |
| P11 | Numbers no longer padded to two decimals (the move to `n.37` inputs could have removed this guard) | a test fails | **Caught** by 4 tests (route POST "every number to two decimals" and "0 → 0.00", two form tests) |

### Overflow fix (No match state, long search text)

| Width | Without the fix | With the fix |
|---|---|---|
| 360 × 800 | page overflow **429 px** | 0 px |
| 768 × 1024 | page overflow **225 px** | 0 px |
| 1366 × 768 | 0 px in my bare layout (the real page also has the navigation column; the developer measured overflow at all three widths) | 0 px |

The repro is a headless-Chromium page with the `EmptyState` layout (flex column, items centred) holding a 120-character title with no spaces. It uses the measure the new test uses (`documentElement.scrollWidth - clientWidth`). The fix is `className={BREAK_LONG_NAMES}` (`[overflow-wrap:anywhere]`) on the `EmptyState` wrapper (`material-results.tsx:57`). The property is inherited, and `anywhere` (unlike `break-word`) lowers the title's min-content width, so the centred flex item can shrink and wrap. **The fix is correct.** **The test** (`materials.spec.ts:291-297`) runs at all three widths, fills 120 `x`, waits for the status and asserts no page overflow plus axe. It discriminates at least at 360 and 768.

## Previous findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** | `tests/support/material-canary-loader.ts`: `ON CONFLICT DO NOTHING` then `UPDATE` by ID, no retry; one function shared by the E2E loader and a committed concurrency test (3 loaders × 12 rounds); probe 0/40; P9 caught. The comment no longer over-claims |
| QLT-02 | Major | **Fixed** | `materials.test.ts:294-301`, update twin of the refused-entry test; P3u caught |
| QLT-03 | Minor | **Fixed** | Race test picks the first edit by content (`isDeepStrictEqual(entry.before, original)`, `:328`), and the name-history assertion compares as a sorted set. No remaining assertion in the file takes order from `created_at` |
| QLT-04 | Minor | Routed | Solution-architect, before 02.07 reaches Ready (master, 11186; #122). No change expected in this PR |
| QLT-05 | Minor | **Fixed** | `afterEach(emptyTable)` in the AC-1, AC-2 and loader blocks; the gravity test makes its own row instead of reusing another test's; P4 now 1 failure |
| QLT-06 | Info | Closed | Product-owner corrected AC-5 (Jira 11187); code and tests already match |
| QLT-07 | Info | Routed | Business-analyst to the delivery lead; accepted as built meanwhile (master, 11186) |
| QLT-08 | Info | Closed | ux-expert's final words applied (Jira 11188), including "Enter the Material in Drawing." |
| QLT-09 | Info | Open note | No change expected; for 02.06 and import stories |
| QLT-10 | Info | n/a | Praise; still true |

## New findings (round 2)

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| R2-QLT-11 | Minor (follow-up, not in this PR) | `src/components/features/masters/material-results.tsx:57`; same pattern at `process-results.tsx:55` | NFR-016 (no horizontal scroll); UX spec 6.0; coding-standards reuse rule | The wrap is added at one call site. SCR-11's `No rate matches "<query>"` uses the same shared `EmptyState` with no wrap class, so it has the same fault: identical component and title pattern, and the repro's "without the fix" row is exactly that markup. The developer flagged it (11189) | An Admin who pastes a long code into the SCR-11 search gets a page that scrolls sideways (about 430 px at 360). Every future master screen with a no-match title (02.02 customers, 02.05 treatments) must remember the class | Put `[overflow-wrap:anywhere]` in `EmptyState` itself (title and description; it is harmless for short text), drop the per-call `className`, and add the SCR-11 twin of the new test. SCR-11 is outside this story, so a follow-up issue (orchestrator or master to route; I have not created one) |
| R2-QLT-12 | Info | `tests/e2e/materials.spec.ts:295` | Test adequacy | The test measures only page-level overflow. If a container between the page and the title ever gets `overflow: hidden` or `auto`, an unwrapped title would be clipped and the test would still pass. At 1366 the test only discriminates because of the navigation column | Low; the fix is right today | Optionally also assert the title fits its box, for example `expect(await title.evaluate((h) => h.scrollWidth <= h.clientWidth)).toBe(true)`, or that its bounding box lies within the viewport |

Cross-reference: R2-01 of reviewer-standards (`MASTER_WORDS` should use `Object.hasOwn`). I agree; it is not repeated here.

## Hand-off (round 2)
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS · new Blocker 0 · Critical 0 · Major 0 · Minor 1 · Info 1; QLT-01, 02, 03, 05 fixed; QLT-06, 08 closed; QLT-04, 07 routed; QLT-09 open note
- Artefacts written/updated: `docs/06-reviews/AQP-122/quality.md` (this section; main folder, not committed)
- Recommended next agent: master, for the G6 re-check; orchestrator, to raise the R2-QLT-11 follow-up (SCR-11 and a shared `EmptyState` wrap)
