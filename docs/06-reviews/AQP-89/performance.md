# Review Report — AQP-89 (STORY-01.06: 12-hour session) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253; base b3403e3) |
| Commit reviewed | c4055f7461f0fa4d5ce116fede6c4264556b1afc |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The per-request path is clean. `resolveSession` adds no database query: a session inside its 12 hours still costs the one `findAccountById` read it cost in 01.01, and an ended or unreadable session costs none (the ended check runs before the read, as the old `isWithinSession` check did). The other per-request additions (one zod `safeParse` in `jwt.encode`, one header set or delete in the proxy) are microseconds, so NFR-010 (p95 ≤ 500 ms at 25 concurrent users) is not put at risk. The new E2E spec adds about 12 s of test time, and the required path read 4:49 against 4:44 for the base run, so RISK-023 is not moved.

One thing needs an explanation before G7: the first-load JavaScript of every measured route rose by about 4.5 to 5.0 KB gzip in the CI budget check (PRF-01). Nothing breaches the 200,000 B budget, but the increase is about four times what the diff's client code can account for, and it takes 40 % of the headroom of the tightest route (`/masters/materials`, 12,434 B to 7,481 B). It is a Major, not a gate blocker (G6 blocks only Blocker and Critical).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 0 |
| Info | 1 |

## Checks Run
No `npm ci` and no local build (the disk is nearly full, by instruction). The review worked from the diff, the CI logs and the jobs API.

| Check | Command | Result |
|-------|---------|--------|
| Diff read in full (server, proxy, client, tests) | `git diff origin/master...FETCH_HEAD` (32 files, +1,334 / -79) | Read; no query, loop, I/O call or cache added on a request path |
| First-load JS, head | `gh api .../actions/jobs/130585901569/logs` (run 43039133074, `check-js-budget.ts`) | 8 routes measured, all PASS; table below |
| First-load JS, base | job 130479606221 (push run 43004280872 on b3403e3, the PR's base) and four earlier master push runs | Same eight routes. The four earlier runs differ from each other by 0 to 451 B per route; a 4.5 KB step is not noise |
| E2E timing of the new spec | E2E job logs 130585902004 / 130585902179 / 130585902185 | 9 instances, 994 ms to 1.8 s each, about 11.7 s summed |
| CI path, head and base | job start and end times of run 43039133074 and run 43004280872 | Head 14:30:36 to 14:35:25 = 4:49; base 10:56:47 to 11:01:31 = 4:44 (one run each) |
| Slowest shard, head and base | same | Head 4:39 (shard 1); base 4:35 (shard 3) |
| New-test cost in the unit and integration stages | `list` reporter lines in the job log | `session-expiry.test.ts` 9 tests, 2.3 s (real PostgreSQL); the new and extended unit files 15 to 176 ms each |
| Query-plan inspection | not run | No query is added or changed; `findAccountById` is the 01.01 primary-key read |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Major | `src/app/unauthorized.tsx:18` (suspected trigger; not confirmed) | NFR-009 JS budget (200,000 B gzip per route); test strategy 10.1 | First-load JS rose by 4,551 to 5,006 B gzip on seven of eight measured routes and fell by 4,052 B on `/sign-in`. The three routes that import none of the three changed clients (`/`, `/queue`, `not-found`) rose by an identical 4,551 to 4,553 B, so the step is in the shared shell, not in `session-ended.ts` (which explains only the extra ~400 B on `/audit`, `/users`, `/masters/*`). The diff's client code should add about 0.5 to 1 KB (estimate): `session-ended.ts` and `return-path`, `FocusMainHeading`, one `Clock` icon. | Budget not breached. `/masters/materials` headroom 12,434 B to 7,481 B (-40 %); every route loses about 2.3 % of its budget to a change nobody has attributed. Recent master pushes moved a route by at most 451 B, so each later story starts from a smaller margin. | Attribute it: diff `.next/static/chunks` (or the build's chunk manifest) of the head against b3403e3 in a local `next build`, name the chunk that grew and the module in it. Likely suspects (hypothesis): a root `app/unauthorized.tsx` is part of every route's payload, so a client module it references (`FocusMainHeading`) and whatever the bundler groups with it loads everywhere; or a chunk regrouping, which the `/sign-in` fall suggests. If one small client module drags a larger chunk along, move it or give it its own import point. If it is a stable regrouping, say so in the Dev Record and accept it as the new baseline. |
| PRF-02 | Info | `src/server/auth/session-token.ts:26` | NFR-010; NFR-011 | The cookie now outlives the token by 7 days (`SESSION_ENDED_NOTICE_DAYS`). For that time a browser that returns sends a dead token on every request that reaches `getServerSession`; next-auth decrypts it, finds it expired and logs `JWT_SESSION_ERROR` with a stack (#255, STD-05). | Estimate: about 0.2 to 0.5 ms CPU and one log line of about 1 to 2 KB per such request. Bounded: the first 401 of an API call or the SCR-26 page sends the person to sign in, which replaces the cookie, so a polling tab stops after one request. At 50 users this is below anything measurable. | No change for performance. When #255 is fixed, lower the log level (see STD-05) so the volume does not hide real errors. |

<details><summary>Detailed notes & measurements</summary>

### PRF-01: first-load JS per route (gzip bytes, `scripts/check-js-budget.ts`)
Base is push run 43004280872 on b3403e3 (the PR's base). Head is CI run 43039133074 on c4055f7. Limit 200,000 for every row.

| Route | Base | Head | Change | Headroom at head |
|-------|-----:|-----:|-------:|-----------------:|
| `/` | 162,504 | 167,055 | +4,551 | 32,945 |
| `/audit` | 172,076 | 177,082 | +5,006 | 22,918 |
| `/masters/materials` | 187,566 | 192,519 | +4,953 | 7,481 |
| `/masters/process` | 173,856 | 178,793 | +4,937 | 21,207 |
| `/queue` | 163,663 | 168,214 | +4,551 | 31,786 |
| `/sign-in` | 166,327 | 162,275 | -4,052 | 37,725 |
| `/users` | 170,120 | 175,090 | +4,970 | 24,910 |
| `not-found` | 155,829 | 160,382 | +4,553 | 39,618 |
| `/design-system` | not measured (404 in production, as required) | same | n/a | n/a |

What the numbers say:
- `/`, `/queue` and `not-found` do not load `api-client`, `users-client` or `audit-client`, and they moved by 4,551 to 4,553 B. So about 4.55 KB is common to every route.
- The routes that do load a changed client moved by about 400 B more (4,937 to 5,006 B). That is the size of `session-ended.ts` plus `return-path.ts` in the client, which is the part the diff explains.
- `/sign-in` fell by 4,052 B although the page gained a `FocusMainHeading` import and a `Notice` import. A move in both directions is what a chunk regrouping looks like, and it is why attribution is asked for rather than a revert.
- SCR-26 "Session ended" (the 401 page) has no row of its own. It is the same shell as the `not-found` row (160,382 B), so it is covered by that row for budget purposes; no row is requested.

Projection (estimate): recent master pushes moved `/masters/materials` by 0 to 451 B per merge. At that rate 7,481 B of headroom is more than ten stories, so this is not a near-term breach. The concern is that the margin was spent without a reason on record, and EPIC-02 stories will keep adding to that route.

### Per-request path, as read (no finding)
| Path | Before | After | Cost change |
|------|--------|-------|-------------|
| Session inside 12 h | `getServerSession` then `findAccountById` (1 read by primary key) | same | none |
| Session at or past 12 h | `isWithinSession` false, no read | `hasSessionEnded` true, no read | none |
| Dead token, cookie sent | `getServerSession` null, no read | same, plus one `headers()` read (request-scoped, in memory) | negligible |
| `jwt.encode` (next-auth writes the token on each session read) | default encode | `sessionTokenSchema.safeParse` (3 fields) and `clock.now()`, then the same `encode` | microseconds (estimate) |
| `proxy.ts` | `getAll()` once, header clone when cookie or API | `getAll()` once, same clone, one `set` or `delete` | microseconds |
| State per request | `cache()` around `getCurrentUser` | `cache()` around `readSessionState`; `getCurrentUser`, `requireUser`, `requireUserOrRedirect` read the same cached state | one read per request, as before |

`requireUser()` in a route handler is not memoised by React `cache()` outside a render. That was true before this PR and `withRoute` calls it once, so it is not a regression.

### RISK-023 and CI time
- Required path: head 4:49 (one run, first attempt), base run b3403e3 4:44 (one run). The difference of 5 s is inside run-to-run variance, so no effect is claimed from it.
- Cost of the 9 new instances: 994 ms to 1.8 s each, about 11.7 s summed. That is below the test strategy 10.5 planning figure of 2.6 to 2.8 s per active test (about 24 s for nine). Spread over three shards of four workers, the path effect is an estimate of 1 to 8 s.
- DL-151 reading rule: a first attempt of 5:30 or more starts a median of five. This first attempt is 4:49, so no median of five is due from this PR. Master's reading of record for b3403e3 (median of five 5:34) is master's to apply; this review does not restate it.
- `Stages 1 to 11b` took 3:40 here and 2:42 on the base run. Both runs hit the npm, `node_modules` and Next caches, and `next build` compiled in 823 ms against 548 ms. The new unit and integration tests account for about 3 s, so the rest is host variance, not the PR (estimate; one run each).
- No `@one-width` tag, no own-width file and no pinned list changed, as the Dev Record says.

### E2E spec design (no finding)
`session-ended.spec.ts` writes a cookie with the E2E secret instead of waiting, so no test sleeps. The third test creates one disposable user and signs in once per width (argon2 verify), about 1.0 to 1.4 s. Nothing in it polls with long timeouts.
</details>

## NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200,000 B gzip per route | Medium: all routes pass; tightest route (`/masters/materials`) has 7,481 B left after an unattributed +4,953 B | PRF-01 |
| NFR-009 CI feedback (10 min; RISK-023 trigger at 5:30 for a first attempt) | Low: path 4:49 against 4:44 base; the new spec adds about 12 s of test time | none |
| NFR-010 page-data and save p95 ≤ 500 ms at 25 concurrent users | Low: no query, I/O call or loop added; the session read is the one 01.01 already made | PRF-02 (Info, log volume only) |
| NFR-011 capacity (50 users, 25 concurrent) | Low | PRF-02 (Info) |
| NFR-003 12-hour session (FR-099) | Not a performance concern; checked only for cost | none |

**Assumptions used.** NFR-010 is PROPOSED and gives no per-step budget for session resolution, so the latency judgement rests on the absence of any new query or I/O and on estimates of microseconds for the added CPU work (not measured; no benchmark exists for this path). No measurement of the real cost of `jwt.encode` was possible without a build, and none is needed at this scale. The load test of NFR-010 runs in staging and is outside this PR.

## Previous Findings (re-review only)
First review. None.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS
- Finding counts: Blocker 0, Critical 0, Major 1, Minor 0, Info 1
- Recommended next agent: developer — attribute the +4.5 KB first-load step (PRF-01) in the Dev Record or fix it, before G7; master — G6 decision across the three reviews.
