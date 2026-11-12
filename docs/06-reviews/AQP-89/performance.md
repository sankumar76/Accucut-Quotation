# Review Report — AQP-89 (STORY-01.06: 12-hour session) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 (below), 2 (appended after the round-1 hand-off: "Round 2") |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253; base b3403e3) |
| Commit reviewed | Round 1: c4055f7461f0fa4d5ce116fede6c4264556b1afc. Round 2: cf42f87b64f8dae3d00865d2ea1ab63da51ec5e9 (diff `e3cd1d4..cf42f87`) |
| Date | 2026-11-11 (round 1); 2026-11-12 (round 2) |
| **Verdict** | Round 1: **APPROVE WITH COMMENTS**. **Round 2: APPROVE** (PRF-01 and PRF-02 closed) |

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

## Hand-off (round 1)
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS
- Finding counts: Blocker 0, Critical 0, Major 1, Minor 0, Info 1
- Recommended next agent: developer — attribute the +4.5 KB first-load step (PRF-01) in the Dev Record or fix it, before G7; master — G6 decision across the three reviews.

---

# Round 2 — PRF-01 re-read after the code fix (DL-160 condition R)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 2 |
| Scope | `git diff e3cd1d4 cf42f87` (15 files, +360 / -31): re-read of PRF-01 because the fix changed code; PRF-02 because #255 changed the dead-cookie path. Everything else in the diff is the other reviewers' area. |
| Commit reviewed | cf42f87b64f8dae3d00865d2ea1ab63da51ec5e9 (PR #253 head) |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE** |

## Summary (round 2)
PRF-01 is **Fixed**. On the same Next.js version (16.4.5 in the CI log of both runs), the fix head is +334 to +970 B gzip per route against `master` 774eff8, where round 1 read +4,551 to +5,006 B against b3403e3. The fall from round 1 to round 2 is 4,023 to 4,219 B on all seven routes that rose, and it is the same size on routes of different composition (`/` and `/audit`, `/queue` and `/users`), which is the signature of one shared chunk leaving every route. The remaining +499 B on every portal route, and the extra +415 to +471 B on the routes that load the three changed clients, are the size of the story's own client code (0.5 to 1 KB, the estimate in round 1). The tightest route, `/masters/materials`, keeps 12,318 B of headroom (13,232 B on `master`), so the story now costs it 914 B (6.9 % of its headroom) and not 40 %.

PRF-02 is **Closed**. The #255 logger sends an expired token to `debug`, and the project's pino logger is at `info`, so the routine dead-cookie request now writes nothing, where next-auth's default wrote a stack of 1 to 2 KB (estimate). Reading the code, I found no new per-request cost.

One limit of this review: I could not confirm the chunk list itself (the 4,379 B shell chunk the developer names). The CI logs hold the route table only (no chunk names or sizes) and the jobs upload no build artefact. A local `next build` of the pair in the review worktree was not permitted in this session, so I did not run one. The attribution below therefore rests on the CI per-route figures, on the import graph read from source, and on the developer's own chunk comparison (Jira AQP-89 comment 11552, read as stated, not reproduced). That is enough to close the finding, because the finding is about what the routes load, and that is measured in CI.

| Severity | Count (open at the end of round 2) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 0 |

New findings in round 2: none. Closed in round 2: PRF-01 (Major), PRF-02 (Info).

## Checks Run (round 2)
No `npm ci`. No local build (see above). The review worked from the diff, the source at cf42f87, the CI logs and the jobs API.

| Check | Command | Result |
|-------|---------|--------|
| Fix diff read | `git diff e3cd1d4 cf42f87` (15 files) | `unauthorized.tsx` no longer imports `FocusMainHeading`; `SystemPageCard` renders it for `kind === 'session-ended'`; logger and `_log` guard in `options.ts` and the `[...nextauth]` route; the rest is constants, comments and tests |
| Remaining importers of `FocusMainHeading` | `git grep -n FocusMainHeading cf42f87 -- src` | Only `system-page.tsx:4,100` and `(public)/sign-in/page.tsx:6,49`. The root `unauthorized.tsx` has none |
| Which routes load `system-page.tsx` | `git grep SystemPageCard cf42f87 -- src` | `src/app/error.tsx` (a `'use client'` file at the app root), `not-found.tsx` (root and portal), `forbidden.tsx`, `unauthorized.tsx`. `system-page.tsx` has no `'use client'` of its own, so it is bundled wherever the client `error.tsx` is |
| First-load JS, fix head | `gh run view 43137162924 --job 130915155365 --log` (`check-js-budget.ts`) | 8 routes measured, all PASS, "all 9 rows are within their limit" |
| First-load JS, master | `gh run view 43135619452 --job 130910133983 --log` (push run on 774eff8) | Same 8 routes, all PASS |
| Same Next.js version | build banner in both logs | `Next.js 16.4.5 (Turbopack)` in both (the PR's merge ref contains 774eff8, so it carries DL-163's lockfile). The developer's local pair was 16.4.3 against 16.4.3, so the CI pair is the stronger comparison |
| CI path, slack, E2E counts | jobs API of runs 43137162924, 43135619452, 43132205395, 43039133074, 43004280872; E2E shard logs | Table in "RISK-023" below |
| Dead-cookie path | source of `buildNextAuthLogger` and `src/lib/logger.ts:77` | Level `info`; the expired-token line is `logger.debug`, so no write |

## Previous Findings (re-review)
| ID | Round 1 | Round 2 | Evidence |
|----|---------|---------|----------|
| PRF-01 | Major | **Fixed (closed)** | The shared-shell step is gone: first-load JS is +499 B on `/` and `/queue` (round 1: +4,551 B), and 12,318 B of headroom is left on `/masters/materials`. The residual is the size of the story's own client code (below). Replied in the original thread. |
| PRF-02 | Info | **Closed** | #255 is fixed in code: an expired token goes to `debug`, an unreadable one to `warn`, every other code keeps its level. Estimated cost per dead-cookie request is now two regex tests on strings under 64 characters and one level check, with no write. Replied in the original thread. |

## Findings (round 2)
None.

<details><summary>Detailed notes & measurements (round 2)</summary>

### PRF-01: first-load JS per route (gzip bytes, `scripts/check-js-budget.ts`, limit 200,000)
Base is the `master` push run 43135619452 on 774eff8 (Next.js 16.4.5). Head is the PR run 43137162924 on cf42f87 (merge ref over 774eff8, Next.js 16.4.5). "Round 1" is the change I reported against b3403e3 (run 43039133074 against run 43004280872, Next.js 16.4.3 on both sides).

| Route | Base 774eff8 | Head cf42f87 | Change | Headroom at head | Round 1 change | Fall since round 1 |
|-------|-----:|-----:|-------:|-----------------:|-------:|-------:|
| `/` | 162,318 | 162,817 | +499 | 37,183 | +4,551 | 4,052 |
| `/audit` | 171,883 | 172,853 | +970 | 27,147 | +5,006 | 4,036 |
| `/masters/materials` | 186,768 | 187,682 | +914 | 12,318 | +4,953 | 4,039 |
| `/masters/process` | 173,849 | 174,763 | +914 | 25,237 | +4,937 | 4,023 |
| `/queue` | 163,472 | 163,971 | +499 | 36,029 | +4,551 | 4,052 |
| `/sign-in` | 166,143 | 162,184 | -3,959 | 37,816 | -4,052 | (unchanged, see below) |
| `/users` | 169,943 | 170,879 | +936 | 29,121 | +4,970 | 4,034 |
| `not-found` | 155,628 | 155,962 | +334 | 44,038 | +4,553 | 4,219 |
| `/design-system` | not measured (404 in production, as required) | same | n/a | n/a | n/a | n/a |

These match the developer's figures in the brief on all eight rows.

**Is the duplicate chunk gone?** Three pieces of evidence, none of them a chunk list:
1. *The drop is one shared object.* Seven routes with different client trees (`/`, `/queue`, `/audit`, `/users`, two masters pages, `not-found`) each lost 4,023 to 4,219 B between round 1 and round 2. A per-route change would not be this uniform. The developer's chunk is 4,379 B in a local 16.4.3 build; the CI fall is about 340 B smaller, which fits the same code (`FocusMainHeading`, now inside the card module) being added back to a chunk that is already shared.
2. *The source has no second path to it.* The root `unauthorized.tsx` no longer imports `FocusMainHeading` (`git grep`, above). The only importers are `system-page.tsx` and the sign-in page.
3. *The developer's own chunk comparison* (comment 11552: a new shell chunk of 4,379 B carrying a second lucide `Icon` and `next/link` runtime, pulled in by the 170-byte `FocusMainHeading`; the `Clock` icon +174 B). I take this as the cause that the numbers above confirm; I did not reproduce it.

**What the residual +499 B is.** `src/app/error.tsx` is a client component at the app root and imports `SystemPageCard`. `system-page.tsx` has no `'use client'` of its own, so it is compiled into the client payload that every portal route carries. The PR adds to that file (diff `774eff8...cf42f87`): the `Clock` import and the `session-ended` case in `KindIcon` (174 B, the developer's measure), a title and a 130-character sentence (about 100 B gzip, estimate), the `FocusMainHeading` module with its `useEffect` (about 100 to 150 B, estimate), a fourth entry in the `TITLE` record and in two switches, and the `role` spread (about 50 B, estimate). The sum is about 420 to 480 B, against 499 B observed. That is the story's UI, in the one module that holds all the system pages, and it ships on every route because an error boundary is a root client component. It is the expected size, not waste. The one avoidable piece would be to split the session-ended card from `error.tsx`'s graph, which would save roughly 0.3 KB on every route and add a module; not worth it at 12 KB of headroom, and not asked for.

**What the extra +415 to +471 B is** on `/audit` (+471 over the shell step), `/users` (+437) and `/masters/*` (+415): `session-ended.ts` and `return-path.ts` pulled into `api-client`, `users-client` and `audit-client` (the diff adds 74 lines to `session-ended.ts` and 7 to 18 lines to each client). Round 1 estimated "about 400 B" for this; it is unchanged by the fix.

**Total of the story's client code:** 0.5 KB on the routes that load only the shell, 0.9 to 1.0 KB on the routes that load a changed client. That matches the 0.5 to 1 KB estimate of round 1.

**`not-found` +334 B and `/sign-in` -3,959 B.** `not-found` is lower than the +499 B of the portal routes (its first load is composed differently; I cannot say which piece accounts for the 165 B without a chunk list). `/sign-in` fell by 4,052 B in round 1 and by 3,959 B now, so its fall does not depend on the fixed chunk. The page gained a `FocusMainHeading` and a `Notice` import, which cannot lower its payload, so this is a Turbopack chunk regrouping that favours the page. It lowers a number that has 37,816 B of headroom, so it is no risk; I leave it unexplained and do not open a finding.

**Headroom and projection (estimate).** `/masters/materials` headroom is 12,318 B at head, against 13,232 B on `master`. The story costs it 914 B (6.9 %), against 40 % in round 1. Recent master merges moved a route by 0 to 451 B each, so 12,318 B is about 27 such merges at the worst rate seen.

### PRF-02: the dead-cookie path after #255
| Path | Round 1 (default next-auth logger) | Round 2 (`buildNextAuthLogger`) |
|------|------|------|
| Expired token (the routine case for up to 7 days after the 12 hours) | `console.error` of `JWT_SESSION_ERROR` with a stack, about 1 to 2 KB (estimate) | two `loggable()` regex tests, one object spread, `logger.debug`, a no-op at pino level `info` (`src/lib/logger.ts:77`) |
| Unreadable token (bad secret, truncated cookie) | the same stack | one `logger.warn` line with name and code only; pino redaction on a line with three plain fields is far below the 190 µs the logger's own comment measures for a line with every redacted key |
| Any other next-auth code | default | `logger.error` or `logger.warn` with the code, same cost class |
| `POST /api/auth/_log` | n/a (no `logger` set on `master`) | closed in the route (SEC-01): one `await context.params` and a string compare before `NextAuth(...)`; the route already built the options per request, so no new cost |

Net effect: a synchronous stderr write of a stack per dead-cookie request is removed. I read the code; I did not measure it, and at 50 users (NFR-011) the difference would be below measurement either way. No E2E shard log of the fix head contains `JWT_SESSION_ERROR` (0 lines in all three), but round 1's log had none either, so I do not offer that as evidence of the change.

### RISK-023 and CI time (reported, not held; DL-151, test strategy 10.5 items 9 and 11)
Path is the first job start to the end of `Stages 1 to 11`, from the jobs API. Slack is the item 11 definition: slowest shard job minus the `Stages 1 to 11b` job.

| Run | Commit | Path | Slowest shard job | Main job | Slack | E2E passed (s1 / s2 / s3) | Notes |
|-----|--------|-----:|------:|------:|------:|------|------|
| 43137162924 (PR, first attempt) | cf42f87 | **5:47** | 338 s (shard 2) | 247 s | +91 s | 268 / 266 / 253 = 787 | 5 cache restores per shard job, no miss |
| 43132205395 (PR, first attempt) | e3cd1d4 | 5:30 | 320 s (shard 2) | 208 s | +112 s | not read | merge commit before the fix push |
| 43039133074 (PR, round 1) | c4055f7 | 4:49 | 279 s (shard 1) | 220 s | +59 s | not read | |
| 43135619452 (`master` push) | 774eff8 | 4:53 | 283 s (shards 1, 3) | 250 s | +33 s | 265 / 263 / 250 = 778 | the shards show 2 `Cache not found` each (the lockfile changed in DL-163), so this is a miss run and not a clean base |
| 43004280872 (`master` push) | b3403e3 | 4:44 | 275 s (shard 3) | 162 s | +113 s | | round 1 base |

- **5:47 is a first attempt at 5:30 or more** (over by 17 s). Under item 9 that starts a median of five full runs of this head. That is the orchestrator's step; no hold is asked here. RISK-023 is already at 8 (DL-151), and the fourth-shard gate is the architect's and master's.
- **The cause on this run is the host, not the PR.** Shard 2's E2E step took 254 s against 168 s for shard 2 on 774eff8. The summed per-test seconds in the shard logs read 888 s against 597 s on the master shard (1.49 times); shard 1 read 692 against 626 (1.11 times) and shard 3 534 against 570 (0.94 times). The slowdown is spread over specs the PR does not touch (`button-pressed.spec.ts` 70 against 36 s, `aqp-122-qa.spec.ts` 88 against 55 s, `aqp-234-qa.spec.ts` 115 against 83 s, `shell.spec.ts` 50 against 27 s, `navigation.spec.ts` 42 against 25 s). The 9 `session-ended.spec.ts` instances sum to 11.5 s over the three shards (5.1, 3.2 and 3.2 s), the same as round 1's 11.7 s, so the QLT-03 assertion added nothing visible.
- **Counts:** E2E is 787 passed against 778 (+9 = the three tests at three widths) and 24 skipped on both, as the brief says.
- **Worth watching in the median of five:** shard 2 was the slowest shard on both PR runs since the merge from `master` (250 s and 254 s), against 163 to 194 s on earlier runs. The 888 s against 597 s reading says host speed on this run. I did not read the per-spec times of run 43132205395, so I cannot say whether the shard composition also moved; the five runs will show it.
- **Main job:** 247 s against 250 s on `master`; the unit step read 37 s and the integration step 96 s against 29 s and 76 s, which is the 104 / 113 added Vitest tests plus host variance (estimate; one run each).
- **Slack is positive on every run (+33 to +113 s)**, so a shard, not the main job, still sets the path, and item 11's 20 s line is not near.

### What was not done
- No chunk-level check (no chunk list in CI; local build not permitted in this session). If master wants the chunk named in the record, a `next build` of cf42f87 and of its merge-base listing `.next/static/chunks` by gzip size would show it in one table.
- No Lighthouse or runtime measurement; NFR-009's Lighthouse targets are outside this PR's diff.
- Query plans: not applicable; the diff since e3cd1d4 adds no query.
</details>

## NFR impact (round 2)
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200,000 B gzip per route | Low: all rows pass; the story costs +334 to +970 B per route; tightest route (`/masters/materials`) has 12,318 B left (was 7,481 B at round 1) | PRF-01 (Fixed) |
| NFR-009 CI feedback (10 min; RISK-023 trigger 5:30 on a first attempt) | Medium for the reading, Low for the PR: first attempt 5:47, host-driven (shard 2 at 1.49 times its master test seconds); the story adds 11.5 s of test time in total; a median of five is due under item 9 | none (reported) |
| NFR-010 page-data and save p95 ≤ 500 ms at 25 concurrent users | Low: no query, I/O call or loop added; the dead-cookie path now writes less | PRF-02 (Closed) |
| NFR-011 capacity (50 users, 25 concurrent) | Low | PRF-02 (Closed) |
| NFR-003 12-hour session (FR-099) | Not a performance concern | none |

**Assumptions used (round 2).** The CI merge ref of run 43137162924 carries 774eff8's lockfile (Next.js 16.4.5, Playwright 1.65.0, both read in the logs), so the head-against-`master` comparison is like for like. Sizes labelled "estimate" were derived from the diff, not measured. The chunk-level cause is the developer's, not mine.

## Issues for other roles
- **orchestrator:** the 5:47 first attempt starts the item 9 median of five on cf42f87; post each run's path, slowest shard, slack and host line. The `master` push run 43135619452 was a cache-miss run for the shards (2 `Cache not found` each), so as a base for a path comparison it is not clean under DL-128 (4).
- **developer:** none.

## Hand-off (round 2)
- Status: COMPLETE
- Verdict: APPROVE
- Finding counts (open): Blocker 0, Critical 0, Major 0, Minor 0, Info 0. Closed this round: PRF-01 (Major, Fixed), PRF-02 (Info, Closed). New: none.
- Evidence: CI run 43137162924 (fix head cf42f87, Stage 11b job 130915155365) against `master` push run 43135619452 (774eff8, job 130910133983), both Next.js 16.4.5.
- Recommended next agent: master — G6 decision (attempt 2) across the three round-2 reviews; orchestrator — the item 9 median of five for the 5:47 first attempt (report, no hold).
