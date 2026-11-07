# Review Report — AQP-74 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...` (PR #97, STORY-01.07, audit service and audit screen) |
| Commit reviewed | 3aa50db (base 93d3b8f; CI run 42179402882 green) |
| Date | 2026-11-06 |
| **Verdict** | REQUEST CHANGES (`/sign-in` first-load JS only) |

## Summary
The audit code is efficient:
- **Audit list:** keyset paging on matching indexes, and the page limit is capped.
- **User changes:** each is one short transaction with a single primary-key row lock.

The problem is first-load JavaScript on pages this PR does not touch. `/sign-in` grows by 18,752 B to 182,039 B, which leaves 7,961 B under the 190,000 B floor, and not-found grows by 9,455 B. A Turbopack build of the head shows `next/image` and `next/link` client code loaded **three times** on `/sign-in` and **twice** on not-found, in chunks that come from the root error boundary (`BrandLockup`), the root not-found entry and the sign-in page. Adding the `/audit` route changed how Turbopack groups those shared modules.

**The cheap cut:**
- **`<img>` in `BrandLockup`:** a plain `<img>` instead of `next/image`. Images are configured `unoptimized`, so `next/image` contributes nothing but client code.
- **Optional, error boundary:** lighten the root error boundary too.

**Smaller findings:**
- **Password reset:** it hashes inside its transaction, holding a row lock and a pooled connection for about 350 ms (Minor).
- **Audit total:** it is counted on every page request, a cost that grows with the append-only table (Info).
- **E2E tests:** they add about 16 to 20 s to the sharded path (Info).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 93d3b8f 3aa50db -- src prisma` | 29 files: audit migration (table, two indexes, FK, immutability triggers), audit repository, service, events and cursor, transaction runner, user repository and service in transactions, `/audit` page, API, screen and client, `native-select`, `lib/time.ts` (IST formatting), route manifest. No change to the sign-in page, the root error or not-found boundaries, or `BrandLockup` |
| First-load JS | CI stage 11b rows, PR run 42179402882 against master run 42166143145 (93d3b8f) | See table |
| Build and chunk analysis | One Turbopack build of 3aa50db in a throwaway worktree under `.claude/worktrees/` (config only: Turbopack root, type-check skipped, `cpus: 1`, heap 2 GB). Compiled in 3.1 min; the page-data worker then died (0.2 GB RAM free), but the client chunks and manifests were complete. Measured with `rootMainFiles` plus the route's `entryJSFiles`, gzip -9; chunk contents searched for module markers. Worktree removed; `.next` output remains | `/sign-in` 181,364, not-found 166,077 (within 0.4 % of CI) |
| `next/image` users | `git grep next/image` | Only `components/shared/brand-lockup.tsx`; `next.config.ts` has `images: { unoptimized: true }` |
| Audit and user code | Read the repository, service, transaction and migration | See findings |
| CI time | `gh api .../runs/42179402882/jobs`, Playwright summary | Job 9 min 34 s; stage 12 348 s; 430 tests (409 passed, 21 skipped) against base 360 (339 passed) |

**First-load JS, gzip (CI stage 11b)**

| Route | Master (93d3b8f) | PR | Change | Left under 200,000 | Left under 190,000 |
|---|---|---|---|---|---|
| `/` | 163,566 | 164,336 | +770 | 35,664 | 25,664 |
| `/queue` | 164,700 | 165,495 | +795 | 34,505 | 24,505 |
| `/users` | 170,916 | 171,734 | +818 | 28,266 | 18,266 |
| **`/sign-in`** | 163,287 | **182,039** | **+18,752** | 17,961 | **7,961** |
| **not-found** | 156,598 | **166,053** | **+9,455** | 33,947 | 23,947 |
| `/audit` (new) | n/a | 173,647 | n/a | 26,353 | 16,353 |

**Chunks of `/sign-in` (gzip, from the build)**

| Chunk | Size | Loaded through | Contents |
|---|---|---|---|
| `0umf…` | 3,516 | every segment | app router glue |
| `1ee6051…` | 2,869 | root `error.tsx` | SCR-26 card, 4 lucide icons |
| `415u…` | 9,542 | root `error.tsx`, sign-in page | `tailwind-merge` |
| `1omq…` | 8,864 | root `error.tsx` (`SystemPageFrame` → `BrandLockup`) | brand lockup, skip link, **`next/image` and `next/link` client** |
| `2poij…` | 9,248 | root not-found | lucide runtime, **`next/image` and `next/link` client** |
| `0gpj…` | 15,287 | sign-in page | sign-in form, `Button` (`cva`, `Slot`), 8 icons, **`next/image` and `next/link` client** |

not-found loads the same chunks except `0gpj…`. The markers `useImageConfig`, `getImageBlurSvg`, `findClosestQuality` and `RouterContext` occur in each of `1omq…`, `2poij…` and `0gpj…`. Two extra copies on `/sign-in` and one on not-found, about 9 KB each, account for the growth.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | **Major** | `src/app/(portal)/audit/page.tsx:20` (the trigger; the fix is in `src/components/shared/brand-lockup.tsx`) | NFR-009 first-load JS (200,000; floor 190,000); RISK-020 | Adding `/audit` regrouped shared modules: `next/image` and `next/link` client code now appears in three chunks on `/sign-in` and two on not-found. `tailwind-merge` stays in the root error entry through `Card` and `BrandLockup` | `/sign-in` +18,752 B (7,961 B to the floor) on the page every user loads first; not-found +9,455 B. The next route could cross the floor with no sign-in change | (1) Replace `next/image` in `BrandLockup` with a plain `<img>` with `width` and `height` (no CLS); images are `unoptimized`, so nothing is lost. Estimate: −10 to −15 KB on `/sign-in`, −5 to −8 KB on not-found. (2) Optionally, a minimal root error frame and card without `BrandLockup` and `Card`/`cn` (AQP-48 PRF-05): about −9 KB on every route. Before merge or as the first follow-up; master decides |
| PRF-02 | Info | `src/server/services/audit-service.ts:146` | NFR-010; coding standards §7 | Keyset paging on `(created_at DESC, id DESC)` and `(actor_id, created_at DESC, id DESC)`; `take limit + 1`; limit 50 by default, at most 200. `count(filter)` on every request; no index on `event` | Audited events are Admin and Lead actions only (about 10k to 100k rows a year, estimate): count about 5 to 50 ms. Grows with the append-only table | Later: count on the first page only and carry it in the cursor, or cap it |
| PRF-03 | Minor | `src/server/services/user-service.ts:184` | NFR-010; R4 pool | A reset hashes (argon2id, about 350 ms, 64 MiB) **inside** the transaction, after `SELECT … FOR UPDATE` | The row lock and one of the 10 `app` connections are held for the hash. Other changes take a few ms (PK lock, update, audit insert) | Hash before `transactions.run`, as `create` does |
| PRF-04 | Info | `tests/e2e/audit.spec.ts` | Test strategy 10.3/10.5; DL-102 | +70 E2E instances; about +46 after the one-width ruling (Jira 11078) | Unsharded: job 9 min 34 s here. With AQP-208's 2 shards: about +16 to 20 s on the required path, median about 5:00 to 5:05 (estimate), inside 6:00 and 7:00 | Re-measure after the ruling and the rebase onto the sharded workflow |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR / target | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS | **Medium** on `/sign-in`; low elsewhere | PRF-01 |
| NFR-010 server p95 | Low | PRF-02, PRF-03 |
| CI time (DL-102) | Low after AQP-208 | PRF-04 |

**RISK-020.** The growth comes from bundler regrouping, not from code the pages use, and it can recur whenever a route is added. Removing `next/image` (PRF-01, fix 1) takes out the largest duplicated block for good. Stage 11b remains the guard.

## Previous Findings (re-review only)
n/a (first round).

---

# Round 2 — head c365f00 (merges master 4c12103, AQP-208; CI run 42204813440), full re-review (master 11096)

| Field | Value |
|-------|-------|
| Review round | 2 |
| Commit reviewed | c365f00 (round-2 commits 7167d4c and c365f00 plus the master merge ea12a6f) |
| Date | 2026-11-06 |
| **Verdict** | APPROVE |

## Summary (round 2)
**PRF-01 is fixed.** `BrandLockup` now uses a plain `<img>` (`width`/`height` 200, `fetchPriority="high"`), so no route ships `next/image`. Against round 1, `/sign-in` falls by 15,754 B and not-found by 10,261 B.

Against master at the PR's new base, 4c12103, every route is below master **except `/sign-in`, which is still 2,998 B above it** (166,285 against 163,287). The round-2 note said all routes were below master; that holds only against 3aa50db. With 23,715 B under the 190,000 floor, the residual is recorded as Info (PRF-07).

**PRF-03 is fixed:** a reset hashes before its transaction.

**New code:**
- **People list:** reuses the existing small `users.list()`.
- **`actor_label`:** removes a join from the audit list and adds no query on write.

**CI:** on the sharded run the required path is 267 s, with balanced shards. The +45 E2E instances show no added path time within the spread.

| Severity | Open after round 2 |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 5 (PRF-02, PRF-04, PRF-05, PRF-06, PRF-07) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 3aa50db c365f00 -- src prisma` | `brand-lockup.tsx` (`<img>`); `user-service.ts` (hash before the transaction; `user.renamed`); `audit_log.actor_label` (migration and schema); audit repository and service write and read `actorLabel` (join to `users` dropped); `views/audit-people.ts`; audit page, screen and filters |
| First-load JS | CI stage 11b, run 42204813440 (c365f00) and master run 42199934678 (4c12103) | See table |
| CI timings | `gh api .../runs/{id}/jobs`; Playwright summaries | See below |
| Local build | n/a | Not run (low memory); CI figures suffice |

**First-load JS, gzip (CI stage 11b)**

| Route | Master 4c12103 | 3aa50db (round 1) | **c365f00** | vs master | To 190,000 |
|---|---|---|---|---|---|
| `/sign-in` | 163,287 | 182,039 | **166,285** | **+2,998** | 23,715 |
| `/` | 163,566 | 164,336 | 162,443 | −1,123 | 27,557 |
| `/queue` | 164,700 | 165,495 | 163,602 | −1,098 | 26,398 |
| `/users` | 170,916 | 171,734 | 169,841 | −1,075 | 20,159 |
| not-found | 156,598 | 166,053 | 155,792 | −806 | 34,208 |
| `/audit` | n/a | 173,647 | 171,780 | n/a | 18,220 |

**CI, sharded**

| Run | `Stages 1 to 11b` | Shard 1 (E2E step) | Shard 2 (E2E step) | Fan-in | Required path | Tests (passed) |
|---|---|---|---|---|---|---|
| PR 42204813440 (c365f00) | 208 s | 261 s (148 s, 2.5 m) | 255 s (149 s, 2.5 m) | 3 s | **267 s (4:27)** | 411 (390) |
| master 42199934678 (4c12103) | 175 s | 282 s (2.8 m) | 256 s (2.2 m) | 3 s | 288 s (4:48) | 366 (345) |

## Findings (round 2)
| ID | Severity | File:line | Rule / NFR | Issue | Impact | Suggested fix |
|----|----------|-----------|------------|-------|--------|---------------|
| PRF-05 | Info | `src/server/views/audit-people.ts:15` | NFR-010 | Server-rendered Who list | The existing `users.list()` (≤ 50 rows); map and sort in microseconds; about 3 KB of RSC payload (HTML, not JS); no client fetch | None |
| PRF-06 | Info | `src/server/services/audit-service.ts:124` | NFR-010 | `actor_label` written per entry | No extra query (from `requireUser()`); one more text column; the list read drops its join to `users`; `user.renamed` adds at most one insert in the same short transaction | None |
| PRF-07 | Info | `src/components/shared/brand-lockup.tsx:25` | NFR-009; RISK-020 | `/sign-in` +2,998 B above master; the sign-in page's own share grew by about 3.8 KB (gap to not-found 6,689 → 10,493 B) | Probably leftover duplicated `next/link` or route-group code from the regrouping (estimate, no build); 23.7 KB to the floor | Optional later: check in a quiet build whether the sign-in page chunk still carries link or router code that the shared chunks hold |

## Previous Findings (round 1)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Major | **Fixed** | `<img>`; −15,754 B on `/sign-in`, −10,261 B on not-found against round 1; residual in PRF-07. Thread resolved |
| PRF-02 | Info | Holds | Count per page unchanged; the list now reads `audit_log` alone (no join) |
| PRF-03 | Minor | **Fixed** | Hash before `transactions.run`; one extra PK read outside it. Thread resolved |
| PRF-04 | Info | Confirmed | +45 instances; sharded path 267 s against master's 288 s; DL-102 met |

**RISK-020.** Headroom is 18 to 34 KB to the 190,000 floor on every route. Removing `next/image` takes the largest duplicated block out for good. Bundler regrouping on new routes stays the thing to watch in stage 11b.
