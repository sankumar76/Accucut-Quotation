# Review Report — AQP-65 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...` (PR #87, STORY-01.04: Admin creates and deactivates users; one Admin) |
| Commit reviewed | d1a0109 (branch updated from master; CI figures from run 42070657561 at 6ec2575) |
| Date | 2026-11-05 |
| **Verdict** | REQUEST CHANGES (CI time only; product code approved) |

## Summary
The product code is efficient:
- **List:** the Users list is one 5-column query over a table bounded at fewer than 50 users.
- **One-Admin rule:** enforced by the existing partial unique index without a transaction or lock; the pre-check only names the current Admin.
- **Hashing:** argon2id costs about 0.35 s per create or reset (laptop figure), on a rare Admin-only path.
- **First-load JS:** the dialogs load on first open, so `/users` is 170,772 B instead of 216,123 B. Other routes grow by 266 to 435 B.

The one problem is CI time. The new E2E specs add 52 tests and about 164 s to stage 12: 499 s against 335 s on the latest master run. That takes this PR's job to **11 min 12 s, over the 10-minute target**, while the CI p95 trigger has already fired (DL-099) and RISK-023 stands at 8. I raise it as **Major**. AQP-199's speed-up may absorb it, or the specs can be trimmed. Master decides at the held G6.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 0 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 87`; `git diff 975dda0 d1a0109` (read-only, nothing merged) | 28 source files: users page and API, users screen, list and lazy dialogs, Radix `Dialog` and `AlertDialog` wrappers, `user-service.ts`, `user-repository.ts`, error classes, route manifest. No migration |
| First-load JS | CI stage 11b (as given) | See table |
| Stage 12 and job time | `gh api .../jobs`; Playwright summary from `gh run view --log` | PR 42070657561: 425 tests, 499 s, job 11 min 12 s. Master 42069287105 (975dda0): 373 tests, 335 s, job 8 min 19 s. Master 42038018967: 361 tests, 294 s, job 7 min 21 s |
| New specs | Counted in `tests/e2e/users.spec.ts` (12 tests) and `users-production.spec.ts` (3 tests) | 15 tests run in each of the 3 projects; +52 in the run, including set-up |
| argon2id | Earlier measurement (AQP-38 review, i7-10510U laptop): 64 MiB, t=3, p=1 | About 350 ms median per hash; 4-thread pool |
| Local build | n/a | Not run: low memory; CI figures suffice. Per-route attribution is an estimate |

**First-load JS, gzip (CI stage 11b)**

| Route | PR | Master | Change | Left under 200,000 |
|---|---|---|---|---|
| `/` | 163,566 | 163,294 | +272 | 36,434 (18.2 %) |
| `/queue` | 164,700 | 164,428 | +272 | 35,300 (17.7 %) |
| `/sign-in` | 163,287 | 162,852 | +435 | 36,713 (18.4 %) |
| not-found | 156,598 | 156,332 | +266 | 43,402 (21.7 %) |
| `/users` (new) | 170,772 | n/a | n/a | 29,228 (14.6 %) |

All routes are below the 190,000 B target floor.
- **Shared change, estimate:** no shared client module changed, so the near-equal rise on every route (about 270 B) is most likely the Turbopack runtime's chunk table growing with the new route and async chunks. The extra on `/sign-in` probably comes from a shared chunk that moved.
- **`/users`:** about 7.2 KB above `/` (screen, list, client calls, table).
- **Dialogs:** loaded on first open. The static version cost about 45 KB more, so a first open fetches roughly that amount: about 0.1 to 0.2 s on the Wi-Fi profile (estimate).

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | **Major** | `tests/e2e/users.spec.ts:17` | Test strategy 10.3 (CI p95 ≤ 10 min); DL-099; RISK-023 | 15 new tests in each of 3 projects. They add, edit, reset and deactivate through the UI, so each pays a server render, a lazy dialog load and, for create and reset, a real argon2id hash | Stage 12 +164 s (+49 %), 335 → 499 s; job 8 min 19 s → **11 min 12 s**, over the 10-minute target. About 3 s of wall time per added test on 2 workers | Either let AQP-199 land first and re-measure, or trim before merge: run the data-changing describes (add, edit, reset, deactivate) in the desktop project only and keep one narrow-width check of the list layout. That cuts about two-thirds of the added time (estimate). Make the list's set-up users through the API or SQL, not the dialogs |
| PRF-02 | Info | `src/server/repositories/user-repository.ts:173` | NFR-010; coding standards §7 (pagination) | `list()` reads every user: 5 columns, `ORDER BY is_active DESC, role, name, email`, no `LIMIT` | Bounded by NFR-011 (fewer than 50 users): a sequential scan and sort of ≤ 50 rows, well under 1 ms. No index needed. Still fine at a few hundred rows | None now. Add pagination only if the user count ever passes a few hundred |
| PRF-03 | Info | `src/server/services/user-service.ts:93` | Architecture §8 (argon2id about 250 ms) | `create` hashes before the insert, so a taken e-mail is refused only after a full hash; `resetPassword` is read, hash, update, throttle clear | About 0.35 s (laptop) and 64 MiB per create or reset; Admin-only and rare. A duplicate e-mail wastes one hash | Optional: check the e-mail with the existing unique index lookup before hashing; the insert stays the guard |
| PRF-04 | Info | `src/server/services/user-service.ts:91` | AC-3; concurrency | One-Admin rule: a pre-read (`findActiveAdmin`, served by `uq_users_single_active_admin`), then the write; the partial unique index decides a race | No transaction or advisory lock; a racing insert waits only for the other statement's autocommit (milliseconds); the loser costs one extra indexed read for the message. Update is 2 to 3 indexed statements; deactivation raises `session_version` in the same statement | None |
| PRF-05 | Info | `src/components/features/users/users-screen.tsx:46` | NFR-009; AQP-188 pattern | Dialogs fetched on first open through `useFirstOpen` | `/users` 170,772 B instead of 216,123 B; the first open fetches about 45 KB (estimate). `users-screen` imports `ADMIN_ALREADY_ACTIVE_CODE` from `lib/errors` (one constant from a module of classes); small, but a constants-only module would keep error classes out of the client | None required |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR / target | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS | Low: `/users` 14.6 % headroom; other routes about 18 to 22 % | PRF-05 |
| NFR-010 server p95 | Low: indexed or bounded queries; hashing only on rare Admin actions | PRF-02, PRF-03, PRF-04 |
| NFR-011 capacity | Low: the list is bounded by the user count | PRF-02 |
| CI feedback time (p95 ≤ 10 min; DL-099; RISK-023) | **High for this PR**: job 11 min 12 s; stage 12 +164 s | PRF-01 |

**RISK-023.** This PR alone takes the job past 10 minutes. Stage 12 is now 8 min 19 s for 425 tests on 2 workers, about 1.2 s of wall time per test. Without AQP-199 (sharding or more workers), every new E2E story adds minutes. I recommend that master keep G6 held until AQP-199 merges, then re-measure this PR's job. If it is still over 10 minutes, apply the PRF-01 trim.

## Previous Findings (re-review only)
n/a (first round).

---

# Round 2 — head 5231947 (includes master d5eb4b6, AQP-199), narrow: PRF-01

| Field | Value |
|-------|-------|
| Review round | 2 |
| Commit reviewed | 5231947 (CI run 42145959641, attempts 1 to 3; developer's figures in Jira 11031) |
| Date | 2026-11-06 |
| **Verdict** | APPROVE |

## Summary (round 2)
With AQP-199 merged (4 workers) and the architect's one-width ruling on 12 tests, the PR adds 31 E2E instances instead of 52. Both clean attempts are under the 10-minute limit: jobs of 5 min 52 s and 8 min 15 s. **PRF-01 is fixed.**

One correction to the evidence: attempt 3 (909 s) is an **apt install stall**, not a GitHub-side outlier. Its install ran about 498 s, with gaps of 83, 124, 67 and 171 s between single downloads, the DEF-015 pattern. By the 120 s rule and DL-100 it is recorded as Environment and re-run, not counted.

The failed run 42144997474 on 0a8a6f0 does not matter. Every step succeeded, and the job was marked cancelled 24 minutes after its last step, on a superseded commit, and the nightly measure excludes it.

| Severity | Open after round 2 |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 4 (PRF-02 to PRF-05, unchanged) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Attempt timings | `gh api .../runs/42145959641/attempts/{1,2,3}/jobs` | 1: job 352 s, stage 12 206 s. 2: 495 s, 291 s. 3: 909 s, 725 s. Each job started 3 s after it was created (no runner queue wait) |
| Stage 12 split | Job logs 127661870454, 127664040871, 127667117776 (install command → `Running N tests`; Playwright summary) | Install: about 12, 20 and **498** s. Test run: 3.3, 4.6 and 3.9 m. 360 tests (339 passed, 21 skipped), 4 workers, 0 flaky. Attempt 3's install has apt gaps of 83, 124, 67 and 171 s (`azure.archive.ubuntu.com`). "502" strings occur in all three logs, so they are not a signal |
| Master baseline | Run 42144959526 (d5eb4b6, AQP-199 merged) | Job 477 s, stage 12 261 s, 329 tests, test run 4.2 m |
| Failed run 42144997474 | `gh api .../runs/42144997474` and its jobs and steps | Head 0a8a6f0, attempt 1. Every step `success`; stage 12 01:40:13 → 01:45:03 (job work 8 min 11 s, 363 passed). Job `cancelled`, completed at 02:09:19 |
| Local build, tests | n/a | Not run |

**Clean attempts against the limit**

| | Job | Stage 12 | Under 10 min? |
|---|---|---|---|
| Attempt 1 | 5 min 52 s | 206 s | yes |
| Attempt 2 | 8 min 15 s | 291 s | yes |
| Attempt 3 | not counted (install stall) | n/a | n/a |

Added stage 12 against master: about +23 s (31 instances at 1.37 tests per second, an estimate), inside the 206 to 291 s run-to-run spread.

## Findings (round 2)
No new finding.

## Previous Findings (round 1)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Major | **Fixed** | Clean jobs 5:52 and 8:15, under 10 min; 31 added instances instead of 52. Attempt 3 is to be recorded as an install stall and re-run, not counted as a GitHub-side outlier. Thread resolved |
| PRF-02 | Info | Holds | Unchanged |
| PRF-03 | Info | Holds | Unchanged |
| PRF-04 | Info | Holds | Unchanged |
| PRF-05 | Info | Holds | Unchanged |

**Run 42144997474 ("failure").** All work succeeded by 01:45:04. The job's cancelled status at 02:09:19 is GitHub-side, most likely the overnight service trouble or supersession by the 5231947 push. It is not a test, a timeout or this PR's code. It is on a superseded commit, and the nightly CI-time step counts only `success` jobs, so its 32-minute recorded span does not distort the p95.

**RISK-023.** Stage 12 is still dominated by apt stalls in the tail (attempt 3) and by CPU in the median. AQP-206 (cache the system packages) and the shard step remain the levers.
