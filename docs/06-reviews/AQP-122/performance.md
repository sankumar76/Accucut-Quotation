# Review Report — AQP-122 (STORY-02.03 Material Master) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-122-material-master` (PR #120; merge base 3695f90) |
| Commit reviewed | 40107d572027956e20be11f9f7878d9f97db1d86 |
| Date | 2026-11-08 |
| **Verdict** | APPROVE WITH COMMENTS |

PR review (COMMENT, single-token) with inline comments: PR #120. Label applied: `review:performance-approved`.

## Summary
No finding breaches an NFR today. The migration, the repository and the service are cheap and safe at the data sizes this product has: one read per list, no N+1, a table lock that never blocks readers and is bounded by the 10 s timeouts, and an options route that reads three columns. The two Minor findings are about headroom that the next two stories will use: the `/masters/materials` first-load JavaScript (185,555 B, of which about 9.7 KB is the Radix Tabs bar, estimate) and the required CI path (5:17, 43 s under the 6:00 warning, with the shard slack now spent). Good practice noted: the options list selects only the three safe columns, and the default filter is applied in one place to every read and to the row lock.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 (PRF-01, PRF-02) |
| Info | 4 (PRF-03 to PRF-06) |

## Figures verified

Source: `gh run view` on run 42500626525 (PR head 40107d5), run 42493344482 (AQP-57 head a6728b4, the last PR run before master), run 42493817041 (master push 3695f90), job logs for test counts, and the stage 11b output of the first two.

### Required CI path
| Measure | PR #120 (42500626525) | AQP-57 PR, a6728b4 (42493344482) | Master push 3695f90 (42493817041) |
|---|---|---|---|
| First job start to fan-in end | 5:17 (16:35:03 to 16:40:20) | 4:57 (15:09:19 to 15:14:16) | 6:29 (15:14:49 to 15:21:18) |
| Run wall clock | 5:21 | 5:00 | 6:33 |
| Shard 1 E2E step | 3:24 (reported 3.4 min) | 3:08 | 3:41 |
| Shard 2 E2E step | 3:07 (reported 3.1 min) | 2:17 | 2:23 |
| Shard 1 set-up (install to Playwright) | 1:43 | 1:39 | 2:39 (Playwright step 53 s, cold cache) |
| Stages 1 to 11b job | 3:43 (build 18 s) | 3:32 (build 8 s) | 3:15 |

- **5:17 is confirmed**, and 43 s is the margin to the 6:00 warning. The run was a first attempt, with no same-PR build cache (the build step is about 10 s longer than in the AQP-57 run, which re-used its own cache): part of the +20 s is cache state, not tests.
- **Shard counts confirmed:** shard 1 "Running 261 tests", 259 passed, 2 skipped, 3.4 min; shard 2 "Running 260 tests", 241 passed, 19 skipped, 3.1 min. Before: 235 passed (3.1 min) and 217 passed (2.3 min). Passed E2E instances 452 to 500 (+48, +10.6 %); the 21 skips are unchanged.
- **The master push is not a like-for-like baseline:** its Playwright browser step took 53 s against 3 s on the PR runs (cache miss). A cache miss costs about +50 s, which would put this PR at about 6:10 (estimate).
- Stage 6 (unit) 23 s and stage 11 (integration) 65 s are unchanged from AQP-57 (23 s, 66 s). The first job is not the critical path.

### Trend (PR runs, CI workflow)
| Story, last PR run | E2E instances run | Shard 1 / shard 2 test time | Run wall clock |
|---|---|---|---|
| AQP-216 80fab66 | 366 | 2.3 / 1.6 min | 4:15 |
| AQP-74 dcfa593 | 411 | 3.0 / 1.6 min | 5:01 |
| AQP-113 323d6f2 | 453 | 3.5 / 2.2 min | 5:35 |
| AQP-57 a6728b4 | 473 | 3.1 / 2.3 min | 5:00 |
| AQP-122 40107d5 | 521 | 3.4 / 3.1 min | 5:21 |

Last 20 successful CI runs (non-throwaway): median 5:07; sorted values 285, 285, 286, 292, 293, 295, 300, 301, 301, 303, 312, 315, 316, 321, 335, 335, 338, 349, 393, 3702 s; the 19th of 20 (nearest-rank p95) is 6:33. The 3702 s run (AQP-57 first attempt, 42463553178) shows jobs starting 49 to 57 minutes after the run was created, so it is runner queue wait, which the NFR-009 method excludes. Run wall clock includes queue wait, so these are upper bounds.

### 11b first-load JavaScript (gzip, bytes)
| Route | master 3695f90 | PR #120 | Delta | Headroom to 200,000 |
|---|---|---|---|---|
| `/` | 162,499 | 162,513 | +14 | 37,487 |
| `/audit` | 171,842 | 171,856 | +14 | 28,144 |
| `/masters/materials` | (new) | 185,555 | +11,966 over `/masters/process` | 14,445 |
| `/masters/process` | 173,446 | 173,589 | +143 | 26,411 |
| `/queue` | 163,658 | 163,672 | +14 | 36,328 |
| `/sign-in` | 166,336 | 166,336 | 0 | 33,664 |
| `/users` | 169,914 | 169,936 | +22 | 30,064 |
| not-found | 155,838 | 155,838 | 0 | 44,162 |

"Within a few bytes" holds for six rows (0 to 22 B). `/masters/process` is +143 B; no changed file touches its modules, so I attribute it to chunk grouping (an inference, immaterial). `/masters/materials` is the heaviest route, 11,966 B above `/masters/process`.

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `git fetch origin pull/120/head`; `git diff origin/master...origin/pr-120` (47 files, +3251 / -45) | Done, no checkout of the branch |
| CI timings | `gh run view <run> --json jobs`; `gh run list --workflow CI` | Figures above |
| CI test counts and stage 11b | `gh run view --job <id> --log` (filtered) | Figures above |
| NFR source | PRD NFR-009, NFR-010, NFR-011; architecture section 6 (pagination); test strategy 10.5; issues #116, #119 | Read |
| Gzip cost of Radix Tabs | esbuild API, `@radix-ui/react-tabs` 1.2.1 (radix-ui 1.8.1) minified and gzipped, with and without the Slot and Label code the process route has; run from the scratchpad, nothing installed or written in the repository | 10,954 B alone; 9,663 B net of Slot and Label (estimate: Next's own chunking will differ a little) |
| Not run | Local query plans (no local database), Lighthouse (no change to the five key screens), a build of the branch | Stated, not claimed |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `src/components/features/masters/masters-screen.tsx:33` | NFR-009 JS budget 200 KB | `/masters/materials` is 185,555 B. About 9.7 KB of the 11,966 B gap to `/masters/process` is the Radix Tabs bar (one tab today); the Materials panel, list, results, hook and texts add about 2.3 KB (estimates). The panel is a static import, and the other two tabs' panels will be too. The first-open dialog loader does not reduce it, because a tab's weight is its panel. | At 2 to 4 KB per eager panel the route reaches about 190 to 195 KB after 02.05, leaving 5 to 10 KB under the guard and nothing for 02.06 and 02.07. A breach fails the build (a blocked PR), not production. The 190,000 B floor of AQP-188 does not bind later routes (PRD v0.14, DL-081). | Load each non-default tab's panel on first activation (`next/dynamic` or the `useFirstOpen` loader), and read its data from its GET route on first activation rather than in `page.tsx`. Re-measure at 02.04; if panels stay eager, state the expected size in that PR. |
| PRF-02 | Minor | `tests/e2e/materials.spec.ts:20` | NFR-009 CI (p95 at most 10 min, early warning at a 6 min median); #116 PRF-01 | Path 5:17, 43 s to the warning. +48 instances cost +66 s of total shard time; the path rose only +20 s because shard 2 had about 0.8 min of slack, now spent (shards 3.4 and 3.1 min). Marginal cost about 0.7 s of path per added instance (estimate). The #116 trigger (head plus two re-runs with a median over 6:00) is not met. | If 02.04 and 02.05 add about 45 instances each: about 5:50 after 02.04 and 6:20 to 6:30 after 02.05 (estimate). A cache miss adds about 50 s. The median of 20 lags a single run, so the warning would trip two to three stories after a single run does. | Do not change the shard count in this PR. Before 02.05 starts, write the #116 trigger into 10.5 with a leading line: a first-attempt path of 5:45 or more in an E2E-adding story sets N = 3 in that PR. Estimate for N = 3: each shard about 1:43 set-up + 2.2 min of tests = about 4:00; path about 4:05 (bounded by the 3:46 first job); runner time +12 to 19 %, under the 2x guard. 10.5's 2.2x assumed 2.5 min of set-up; 1:43 is measured. |
| PRF-03 | Info | `tests/e2e/materials.spec.ts:233` (and :195) | Test strategy 10.5 rule 2 | `@one-width` candidates. "An edit that changes nothing closes without a request" qualifies, like the ruled AQP-65 test (request count and closed dialog, no layout). "State Duplicate name" does not as written: it runs `expectNoAxeViolations` on the error state and ends with a `[data-item-id]:visible` count, both of which 10.5 keeps at three widths. | Tagging both removes 4 instances, about 1.6 s of the 321 s path (0.5 %; estimate at 3.1 s per instance, 4 workers, 2 shards). | Tag the first only if the architect rules it; leave the second at three widths. Neither tag is in this PR, which is correct. Do not treat either as the answer to PRF-02. |
| PRF-04 | Info | `prisma/migrations/20261108100000_materials/migration.sql:39` (and :33) | NFR-010 | Database review, no change requested: additive migration on a new empty table; `uq_materials_material_in_drawing` (:33) is implied by the `lower()` index (:39) but is what Prisma's `@@unique` and the drift check match, as for `process_items`; reads filter `is_hidden = false AND deleted_at IS NULL ORDER BY created_at, id` over tens to low hundreds of rows, so a sequential scan and sort is well under 1 ms and no partial index is warranted below about 10^4 rows; `LOCK TABLE ... SHARE ROW EXCLUSIVE` (`master-repository.ts:275`) blocks writers, not `SELECT`; it is bounded by `statement_timeout` 10 s and the 10 s transaction timeout; the audit append takes no lock, so table lock then row then audit cannot deadlock; about 6 round trips per save; no N+1. | None at the assumed size. | Keep as is. |
| PRF-05 | Info | `src/app/api/v1/options/materials/route.ts:15` | NFR-010, NFR-011 | `GET /api/v1/options/materials`: 2 queries (session `users` read, then 3 columns of `materials`), strict zod parse, `private, no-store`, about 110 B per material (about 22 KB for 200). At 25 concurrent users the load is well under 1 request per second against a pool of 10. No cache recommended: invalidation on every Admin save, and the global `no-store` rule, for no measurable gain. | None now. A consumer that fetches this list per node row would make up to 500 calls and 1,000 queries per page. | For the estimate-form story: fetch once per page and share across rows. When 02.06 adds the hidden "Not applicable" entry, keep it inside the same single query. |
| PRF-06 | Info | `src/server/repositories/master-repository.ts:225` | NFR-011; architecture section 6 | NFR-011 states users, concurrency and nodes but no master-data volume; section 6 says master lists "return all rows, as they are small". Assumption used: up to 200 materials (Admin list about 38 KB of JSON, server-rendered into the HTML table as well as the page payload; a client-side search keystroke re-renders at most 200 rows). | None at this size; a later pagination decision has no figure to test against. | Owner: product-manager. Add a master-row volume to NFR-011 (for example up to 200 materials, 500 customers, 50 treatments or colours). |

<details><summary>Detailed notes</summary>

### PRF-01: where the 11,966 B comes from
The materials client graph is the process screen's graph with a table of five columns instead of four, plus `ui/tabs.tsx` (new, `radix-ui` Tabs). The imports of `material-list`, `material-results`, `master-search-box`, `use-material-master` and `materials-client` are the same shared pieces the process route already carries (`Button`, `Table`, `Input`, `Label`, `Notice`, `states`, `lucide-react` icons, `api-client`), and `lib/masters/materials.ts` has no zod. The one new dependency is Radix Tabs, which pulls in roving-focus, collection, presence and direction. Measured with esbuild (minify, gzip level 9, `react` external): Slot + Label 2,244 B; Slot + Label + Tabs 11,907 B; Tabs alone 10,954 B. Net 9,663 B. The remainder, 11,966 - 9,663 = about 2.3 KB, is the Materials feature code net of the process screen it replaces. These are estimates: the real chunking is Next's, and `check-js-budget` is the judge.

Projection for 02.04 and 02.05 with eager panels (estimates, not measured): 185.6 KB + 2 to 4 KB (exchange rates, one form) + 2 to 4 KB (treatment and colour, two lists) = about 190 to 194 KB. With first-activation loading the first load stays near 185.6 KB and the later panels download only when the tab is opened.

The tab bar is a prepayment: with one tab it has no function until 02.04. That is reasonable (the shell belongs to SCR-13), and I do not ask to remove it; it is why PRF-01 is about the panels.

### PRF-02: arithmetic
- Passed instances 452 to 500 (+48); sum of shard test times 5.4 to 6.5 min (+66 s). Per added instance, +1.4 s of shard time, split over two balanced shards: about 0.7 s of path.
- Critical path before: shard 1 job 4:51 (15:09:19 to 15:14:10). After: 5:11 (16:35:03 to 16:40:14). +20 s.
- If a story adds about 45 instances: +31 s. From 5:17: 5:48 (02.04), 6:19 (02.05). Hence "about 5:50" and "6:20 to 6:30".
- N = 3 estimate: total test time 6.5 min over 3 shards is 2.2 min each; set-up measured 1:43 per shard; teardown about 10 s; so about 4:00 per shard. The 3:43 first job and 3 s fan-in bound the path at about 4:05.
- Runner time now: 3:43 + 5:11 + 5:11 = 14.1 min. N = 3: 3:43 + 3 x 4:00 = 15.7 min (+12 %); rounded up per job as GitHub bills: 4 + 6 + 6 = 16 now, 4 + 3 x 5 = 19 (+19 %).

### PRF-03: why not the Duplicate-name test
Test strategy 10.5 (audit.spec ruling) keeps a test at three widths when it runs axe or counts `[data-item-id]:visible`, because the table and the phone cards are different render paths. The Duplicate-name test does both. The users.spec precedent "refuses an e-mail that is already used" is at one width; if the developer wants the same for Duplicate name, the axe call and the final `:visible` count must come out first, and the error state's look must be covered at three widths elsewhere.
</details>

## Reviewer-specific tables

### NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS, 200 KB gzip | Low now (14,445 B headroom); Medium by 02.05 if panels stay eager | PRF-01 |
| NFR-009 CI feedback, p95 at most 10 min, warning at a 6 min median | Low now (median 5:07, p95 6:33, this PR 5:17); Medium by 02.05 | PRF-02, PRF-03 |
| NFR-010 server, p95 at most 500 ms at 25 concurrent users | Low | PRF-04, PRF-05 |
| NFR-011 capacity | Open: no master-data volume stated | PRF-06 |
| NFR-002 confidentiality (cross-reference, not my lens) | `listMaterialOptions` selects no number column; the route schema is strict | none |
| NFR-008 calculation, NFR-024 observability | Not affected (no calculation; no new critical path needing timing metrics) | none |

## Previous Findings (re-review only)
Not applicable (round 1).

## Issues for other roles
- **product-manager:** PRF-06 (add a master-row volume to NFR-011).
- **solution-architect:** PRF-02 (write the earlier three-shard trigger into test strategy 10.5 before 02.05; #116) and PRF-03 (rule on `@one-width` for the "edit that changes nothing" test).
- **reviewer-quality (cross-reference, not a performance finding):** `lower(material_in_drawing)` follows the database's character classification; on a database created with the C locale, non-ASCII letters would not fold, so "É" and "é" would be two materials. The CI image's locale is not stated in what I read.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-122/performance.md` (main folder, not committed)
- Jira / GitHub updates: PR #120 COMMENT review with 6 inline comments (PRF-01 to PRF-06) and the summary with the NFR impact table; label `review:performance-approved` added; Jira summary on AQP-122 as "🤖 reviewer-performance — G6"
- Open questions: none
- Risks raised: none new; RISK-023 (CI time) noted at 5:17, 43 s margin (PRF-02); RISK-020 (JS budget) noted at 14,445 B headroom on the new route (PRF-01)
- Recommended next agent: orchestrator — consolidate the three G6 reviews; developer to take PRF-01 into the 02.04 plan; solution-architect to record the CI trigger in 10.5

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 2 (narrow: master's G6 ruling 5, DL-115; Jira 11186) |
| Range reviewed | `40107d5..b02955b` (24 files; two commits, `59426c8` tests and `b02955b` product and wording) |
| Commit reviewed | b02955bb07e176f834477aeb08dc3713d563bd37 |
| CI run | 42506525720 (success, first attempt) |
| Date | 2026-11-08 |
| **Verdict** | APPROVE WITH COMMENTS (no change requested in PR #120) |

Why a re-review: ruling 5 asked for one if stage 11b grew over 500 B or the path passed 6:00. The route grew 942 B, and the path is 5:57 by the first-job method (6:01 by wall clock), so the bundle condition is met and the path condition is met by 3 s on the wall clock.

| Severity (new in round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (PRF-08, PRF-02 restated) |
| Info | 1 (PRF-07) |

## 1. Bundle: `/masters/materials` +942 B

### Figures (stage 11b, run 42506525720 against run 42500626525)
| Route | Round 1 | Round 2 | Delta | Headroom now |
|---|---|---|---|---|
| `/` | 162,513 | 162,513 | 0 | 37,487 |
| `/audit` | 171,856 | 171,856 | 0 | 28,144 |
| `/masters/materials` | 185,555 | 186,497 | **+942** | 13,503 |
| `/masters/process` | 173,589 | 173,588 | -1 | 26,412 |
| `/queue` | 163,672 | 163,672 | 0 | 36,328 |
| `/sign-in` | 166,336 | 166,336 | 0 | 33,664 |
| `/users` | 169,936 | 169,936 | 0 | 30,064 |
| not-found | 155,838 | 155,838 | 0 | 44,162 |

"Every other route unchanged" is true to within 1 B (`/masters/process` -1 B).

### What changed in the first load (the code reachable from `masters-screen.tsx`, without the lazy dialog)
Files changed since round 1 that the first load reaches: `material-texts.ts`, `material-list.tsx`, `material-results.tsx`, `lib/masters/materials.ts`, `lib/masters/materials-client.ts` (comment only), `lib/masters/process-items.ts`. Server-only: `page.tsx` (metadata), `audit-events.ts`, `audit-service.ts`, `master-repository.ts` (comments). Lazy chunk only: `material-form-dialog.tsx`.

| Change | Effect on the first-load bytes |
|---|---|
| `MASTERS_DESCRIPTION` | 66 to 50 characters (-16) |
| `MATERIAL_SEARCH_PLACEHOLDER` | 42 to 33 (-9) |
| `MATERIALS_EMPTY_DESCRIPTION` | 82 to 78 (-4) |
| `MATERIAL_NAME_REQUIRED_MESSAGE` | was an alias of `Enter a name.`; now `Enter the Material in Drawing.` (+30; `Enter a name.` is no longer reached from this route) |
| `PRICE_HEADING`, `SCRAP_HEADING` | moved from `material-list.tsx` to `material-texts.ts`; now built from `RUPEE` |
| `RUPEE` | from a private `const` to an `export`, imported by `material-texts.ts` (first load), the lazy dialog and the audit words |
| `className={BREAK_LONG_NAMES}` on the no-match state | one prop; the constant was already imported by the panel |

Net string change: about zero or slightly shorter, so "longer strings" does not explain +942 B.

### Measurement (scratchpad; nothing installed; nothing written in the repository)
Both source trees were extracted with `git archive` and the route's client graph was bundled with esbuild (minify, gzip level 9, `react` and `next` external, the dialog import left out as the lazy chunk):

| | 40107d5 | b02955b | Delta |
|---|---|---|---|
| Entry graph, raw | 104,762 B | 104,757 B | -5 B |
| Entry graph, gzip | 30,579 B | 30,583 B | +4 B |
| Entry + shared chunk (dialog split), gzip | 5,241 + 39,528 = 44,769 B | 5,210 + 39,538 = 44,748 B | -21 B |
| Modules in the shared chunk | `process-items`, `materials`, `material-texts`, `process-texts`, `materials-client`, shared UI | same | none moved |

### Cause, and how sure I am
- **Source: ruled out** (change about 0 in raw and gzip; module placement unchanged in esbuild).
- **Packing by the production bundler: the remaining explanation, by elimination.** The budget script sums the gzip of each script the page names, so a change in how modules are grouped into files changes the sum with no change in the code (each file is compressed on its own).
- **Likely trigger (hypothesis, not proven):** the one new edge in the module graph is `RUPEE` being exported and reached from `material-texts.ts`, the lazy dialog and the audit words. The developer's three guesses: longer strings (rejected, net shorter), a `RUPEE` import (the likely trigger, as a graph change and not as bytes), and a different split of the shared chunks (the mechanism). What I could not do: build either commit, because that needs installed dependencies and a database, and the check script prints totals, not chunks. A developer who wants the exact answer can build both commits and list the scripts of `/masters/materials` from the HTML; I do not think 942 B is worth it.

### Judgment
- **Acceptable.** +942 B is 0.47 % of the 200,000 B guard; headroom 13,503 B; no growth in code; the single `RUPEE` is what STD-03 asked for. Do not revert it.
- **For 02.04 and 02.05 (PRF-01, #121):** the route can move about 1 KB on a push with no change in code size. Eager panels: 186.5 KB + 2 to 4 KB per panel = about 190.5 to 194.5 KB (estimate), so 5.5 to 9.5 KB left, plus or minus 1 KB per push. Lazy panels per #121: about 186.5 to 187.5 KB. Tripwire for 02.04's G6: if `/masters/materials` is more than 1,500 B above its base commit on CI, the panel is not lazy and I request changes. The product-manager may also wish to extend the 190,000 B floor of AQP-188 to this route (DL-081 left later routes at 200,000 B); that is their decision.

## 2. CI time: required path 5:57

### Figures (job timestamps, `gh run view`)
| Measure | Round 2, b02955b (42506525720) | Round 1, 40107d5 (42500626525) | AQP-57 last PR run (42493344482) |
|---|---|---|---|
| First job start to fan-in end | **5:57** (17:45:20 to 17:51:17) | 5:17 | 4:57 |
| Run wall clock | 6:01 (3 s queue) | 5:21 | 5:00 |
| Shard 1 job | 5:52 | 5:11 | 4:51 |
| Shard 1 E2E step | 4:03 (reported 4.0 min; 262 passed, 2 skipped) | 3:24 (3.4 min; 259 passed) | 3:08 |
| Shard 2 E2E step | 3:28 (3.4 min; 244 passed, 19 skipped) | 3:07 (3.1 min; 241 passed) | 2:17 |
| Set-up, shard 1 (start to Playwright step) | 1:45 | 1:43 | 1:39 |
| Stages 1 to 11b job | 2:47 | 3:43 | 3:32 |
| Passed E2E instances | 506 | 500 | 452 |

Confirmed: 5:57, 3 s under 6:00 (the wall clock, 6:01, is 1 s over; the NFR-009 method excludes the queue, so 5:57 is the figure). Passed instances +6. Shard 1 +0.6 min.

### Where the time went
- **New tests:** the description-meta test takes 1.7 to 1.9 s per width and the long-search test 3.2 s; together about 15 s of worker time, about 2 s of path.
- **Everything else is a slower runner.** Mean seconds per passed test, from the job logs:

| Run | Tests | Mean s per test |
|---|---|---|
| 42260819242 (AQP-74) | 390 | 2.44 |
| 42493344482 (AQP-57 last) | 452 | 2.50 |
| 42473467530 | 452 | 2.56 |
| 42416813742 (AQP-113) | 432 | 2.68 |
| 42500626525 (round 1) | 500 | 2.68 |
| 42427499733 (AQP-113 last) | 432 | 2.74 |
| 42474042206 | 452 | 2.77 |
| 42484736523 | 452 | 2.80 |
| **42506525720 (round 2)** | 506 | **3.05** |

Specs this push did not change, summed over both shards, round 1 to round 2: `button-pressed` 140.8 to 181.5 s (+29 %), `shell` +21 %, `users` +15 %, `audit` +15 %, `navigation` +14 %, `process-master` +12 %, `design-system` +9 %; the unchanged set-up tests +12 %. Test time of everything except `materials.spec.ts` rose +13 % (+162 s of worker time). The push touched `auth.setup.ts`, and set-up grew only +2 to +5 s per shard.

### Trend, with this run
Last 20 successful CI runs (non-throwaway): 285, 285, 286, 292, 293, 300, 301, 301, 303, 312, 315, 316, 321, 335, 335, 338, 349, 361, 393, 3702 s. **Median 5:13** (was 5:07); 19th of 20 (nearest rank, p95) 6:33. The 3702 s run is runner queue wait (jobs began 49 to 57 minutes after the run was created), which the NFR-009 method excludes. The spread of the others is 285 to 393 s, about 30 s standard deviation.

| Story, last PR run | E2E instances run | Run wall clock |
|---|---|---|
| AQP-216 | 366 | 4:15 |
| AQP-74 | 411 | 5:01 |
| AQP-113 | 453 | 5:35 |
| AQP-57 | 473 | 5:00 |
| AQP-122 round 1 | 521 | 5:21 |
| AQP-122 round 2 | 527 | 6:01 |

### One-off or trend?
- **Probably a one-off:** the 3.05 s per test is 3 standard deviations above the previous eight runs, on unchanged specs. I cannot re-run; the orchestrator should re-run b02955b twice (no code change), which is also what the #116 rule asks (head and two re-runs, median). If both re-runs are 5:30 or less, round 2 was a slow runner.
- **A trend underneath, independent of that result:** about +33 s of path per story of this size (0.7 s per added instance; shards are balanced now, so no slack is left to absorb it). The margin used to be 43 s; against a spread of about 30 s it has little meaning. With 02.04 projected near 5:50, the chance that its first attempt is above 6:00 is about 35 to 40 % on spread alone (rough, normal spread assumed). So the 3-shard decision should not wait for the formal trigger.

### Recommendation: 3 shards, as its own enabler story, before AQP-123 (02.04)
- **Bring it forward:** yes. Master's ruling 5 puts the written trigger before AQP-130 (02.05). On this data the first masters story to cross 6:00 on a first attempt is more likely 02.04 than 02.05, so the decision moves to before AQP-123 starts.
- **Do not hold PR #120 for it:** this PR's own code costs about 2 s of path, and its single-run path is under 6:00.
- **Estimate for N = 3 (from this run):** shard test time 4.0 + 3.4 = 7.4 min over 3 shards = 2.5 min each; plus 1:45 set-up; plus about 10 s teardown: about 4:25 to 4:30 per shard. The first job (2:47) does not bind. Path about 4:30, so about 1:30 shorter. Runner time: now 2:47 + 5:52 + 5:26 = 14:05; at N = 3, 2:47 + 3 x 4:27 = about 16:08, so +15 % (by GitHub's whole-minute rounding about +19 %). The 2x guard of AQP-199 AC-6 is not near; the 2.2x in test strategy 10.5 assumed 2.5 min of set-up, and 1:45 is measured, so the product-manager's call that 10.5 reserved for a third shard may not be needed.
- **Other levers, for completeness:** a duration-aware shard split gains about 15 s (shards 4.0 and 3.4 min); the two `@one-width` tags about 2 s (PRF-03); cache state matters (a miss is about +50 s). Only the third shard moves the path.
- **Why its own story, and not inside the 02.04 PR:**
  1. It changes `.github/workflows` and the required-check topology (the fan-in name `Stages 1 to 11` must stay), which a product PR should not carry.
  2. The 02.04 G6 needs a clean baseline: the 1,500 B bundle tripwire and the path are both measured against the base commit, and a shard change in the same PR confuses both.
  3. AQP-208 made N one constant, so it is small (1 to 2 points, estimate).
- **Suggested acceptance criteria:** (a) N = 3 set in one place, fan-in job name unchanged; (b) median of three first-attempt runs at 4:45 or less; (c) runner time at most 2x today's (AQP-199 AC-6); (d) shards within 10 % of each other in tests and 45 s in time; (e) the e2e-shards unit test and the `@one-width` pins unchanged; (f) 0 flaky tests in five runs; (g) test strategy 10.5 amended with the earlier trigger of #116 PRF-01 (a first-attempt path of 5:45 or more in an E2E-adding story sets N), and the 2.2x estimate corrected.
- **Fallback if master prefers no new story:** apply the #116 rule in 02.04's PR (N = 3 there), accepting the confusion in measurement in point 2.

## Findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-07 | Info | `src/components/features/masters/material-texts.ts:2` | NFR-009 JS 200 KB | `/masters/materials` +942 B (186,497 B); not source (esbuild -5 B raw, +4 B gzip); production-bundler packing; likely trigger the `RUPEE` export | 0.47 % of the guard; headroom 13,503 B; the route moves about 1 KB per push | Accept. Tripwire for 02.04: more than +1,500 B over base on CI means the panel is not lazy (#121) |
| PRF-08 | Minor | `tests/e2e/materials.spec.ts:291` | NFR-009 CI (6 min median warning); #116 | Path 5:57 (margin 3 s); 6 new tests cost about 2 s; the rest is a slow runner (3.05 s per test against 2.44 to 2.80); underlying trend about +33 s per story | A first attempt of 02.04 is over 6:00 about 35 to 40 % of the time on spread alone | Re-run b02955b twice; make N = 3 its own enabler story before AQP-123; amend 10.5 |

## Previous Findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Minor | Not fixed; deferred to #121 (master ruling 5) | Route now 186,497 B; tripwire added (PRF-07) |
| PRF-02 | Minor | Not fixed; restated as PRF-08 | Margin 3 s; action brought forward to before AQP-123 |
| PRF-03 | Info | No action needed | No `@one-width` tag was added; correct |
| PRF-04 | Info | No change | Server code in this push is comments plus `describeStored` by object type: a few zod parses of a 5-key object for each of at most 50 entries on a page, well under 5 ms |
| PRF-05 | Info | No change | For the estimate-form story |
| PRF-06 | Info | Open | Product-manager, before AQP-142 (master ruling 5) |

## NFR impact (round 2)
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS, 200 KB gzip | Low now (13,503 B left); Medium by 02.05 if panels stay eager | PRF-01, PRF-07 |
| NFR-009 CI, p95 at most 10 min, 6 min median warning | Median 5:13, p95 6:33: no breach of the NFR. Single-run margin 3 s: the early warning is close | PRF-08 |
| NFR-010, NFR-011 | Unchanged | PRF-04 to PRF-06 |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Diff since round 1 | `git fetch origin pull/120/head`; `git diff 40107d5 origin/pr-120` | 24 files, 323 insertions, 161 deletions |
| CI timing and counts | `gh run view 42506525720 --json jobs`; `gh run view --job <id> --log` (filtered) for shard counts and stage 11b | Figures above |
| Per-test timing | The Playwright list lines of 4 shard logs (rounds 1 and 2) and 7 earlier runs, summed with a script in the scratchpad | Mean seconds per test above |
| Bundle sizes | esbuild API on `git archive` copies of both source trees, in the scratchpad | Figures above |
| Not run | A Next production build (no installed dependencies or database for it), Lighthouse, a re-run of CI | Stated, not claimed |

## Issues for other roles (round 2)
- **orchestrator:** re-run b02955b twice and record the three paths; apply the #116 rule to them.
- **solution-architect:** amend test strategy 10.5 with the earlier trigger and correct the 2.2x estimate for a third shard; own the enabler story's design.
- **scrum-master:** the enabler story before AQP-123 (and #121 in the Dev Context of AQP-123 and AQP-130, already routed by master).
- **product-manager:** whether to extend the 190,000 B floor of AQP-188 to `/masters/materials`; PRF-06 before AQP-142.

## Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-122/performance.md` (Round 2 appended; main folder, not committed)
- Jira / GitHub updates: PR #120 COMMENT review at b02955b with 2 inline comments (PRF-07, PRF-08) and 2 thread replies (PRF-01, PRF-02); label `review:performance-approved` left as is; Jira AQP-122 "🤖 reviewer-performance — G6 round 2"
- Open questions: none
- Risks raised: RISK-023 (CI time): single-run margin 3 s, median 5:13, action brought forward; RISK-020 (JS budget): 13,503 B left, route moves about 1 KB per push
- Recommended next agent: orchestrator — re-run b02955b twice, then hand to master for the G6 re-check; scrum-master and solution-architect for the 3-shard enabler story before AQP-123
