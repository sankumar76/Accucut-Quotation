# Review Report — AQP-81 (STORY-01.05) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-81-password-rule-2` (PR #341; base 3f22672, three shards) |
| Commit reviewed | c4517e65d5c57715036e448a02bb2fb8f8f4f559 (CI run 43235390390, merge ref of c4517e6 into 3f22672) |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary

The password rule, the common-password lookup and the change route are cheap where they should be and expensive only where they must be. The rule is O(n) on at most 128 code points and runs before any hash, so a weak, over-long or throttled request costs no argon2 work. The 10,001-entry list is a server-only `Set` that builds in about 2 to 3 ms and answers in 1 to 3 µs. The change route holds no transaction or pool connection across a hash. First-load JS is within budget on all 10 rows (`/account` 169,341, headroom 30,659; the largest growth on an existing row is +825 B on `/users`), which also shows the 75 KB list is not in any client chunk. No Blocker, Critical or Major finding.

Three Minor findings and one Info. **PRF-01** is a PRD gap, not a code defect: a change takes two argon2id operations (about 515 ms measured on a development machine), so one request sits above NFR-010's 500 ms line, and the PRD does not say whether password routes are in that line. **PRF-02** is the cheapest CI-time saving in the PR: the AC-6 block test reads no layout and runs at three widths. **PRF-03** is the RISK-023 measurement condition: the first attempt read **6:08**, at or above 5:30, so **a median of five is needed** (test strategy 10.5 items 5 and 9). It holds nothing (DL-173 (3)). PRF-04 is Info.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 (PRF-01, PRF-02, PRF-03) |
| Info | 1 (PRF-04) |

## Checks Run

Read-only. I did not run the project's test suites locally: the evidence for tests, lint, type-check and build is CI run 43235390390 (5 of 5 green), read from the Actions API and the attempt-1 job logs. Local measurements were made with scripts in the scratchpad that read a copy of the changed files (`git show origin/feat/AQP-81-password-rule-2:<path>`), not the working tree.

| Check | Command | Result |
|-------|---------|--------|
| Diff read in full for the server, schema, route, repository, composition, frame and form files; list header and tail of `common-passwords.ts`; `account.spec.ts` in full | `git diff 3f22672...origin/feat/AQP-81-password-rule-2`, `git show` | 75 files, +12,752 / -118. The list is 10,046 of the added lines. No `package.json`, lockfile, workflow, Playwright or Vitest config change |
| Jobs of the PR run and of the base push run (attempt 1) | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/{43235390390,43197966408}/attempts/1/jobs`, and the job logs | Section "RISK-023 and CI time" |
| Cache state | `Cache hit for:` lines in all five PR jobs and all four base jobs | node_modules key a hit in every job on both runs; the PR's `.next/cache` restored on the exact key, the base's on the restore-key. No `Cache not found`, no `miss` or `fallback` line. The playwright and debs caches hit |
| E2E counts and per-test seconds | `list` reporter lines in the three shard logs | PR 284 / 282 / 269 = 835 passed, 3 / 4 / 17 skipped, 0 flaky; base 279 / 277 / 264 = 820, same skipped. +15 instances |
| JS budget | `JS budget` table in `Stages 1 to 11b` of both runs | PR: 10 rows within 200,000. Base: 9 rows. Per-row changes below |
| List build and lookup | Node 24.19 script over the list as it is on the branch (`new Set(text.trim().split('\n'))`, `isCommonPassword`, `checkPasswordRule`) | Build 1.8 to 2.9 ms (five runs, 10,001 entries). With the TypeScript module import in Node the whole import is 39 ms, an upper bound. `isCommonPassword`: 0.9 µs (10 to 23 chars), 2.0 µs (122), 2.8 µs (127). Full rule check of a 104-character password: 10.4 µs. Heap retained: under 1 MB |
| Argon2id at the production cost | `@node-rs/argon2` from the repository's `node_modules`, `ARGON2_COST` (64 MiB, 3 passes, 1 lane), Node 24.19, Windows, 8 logical cores, default libuv pool of 4 | hash median 263 ms (227 to 325, 8 runs); verify median 258 ms (216 to 303); **verify then hash, one after the other: 515 ms**. Four changes at once: 1,975 ms wall for the batch. Eight at once: 2,627 ms. A development machine, not the production host (Q-18) |
| Strip regex growth | `'!'.repeat(n) + 'a' + '!'` through `/^[^\p{L}]+\|[^\p{L}]+$/gu` | 128: 1.8 ms (first call, JIT warm-up); 1,024: 0.04 ms; 65,536: 0.59 ms. Not quadratic in practice, and the rule's 128 cap comes first anyway |
| Local lint, type-check, tests, build | not run | Read-only role; CI results used |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor (PRD gap; owner product-manager, with solution-architect) | `src/server/services/account-service.ts:87-94` | NFR-010 (PROPOSED: page-data and save requests p95 ≤ 500 ms at 25 concurrent users); architecture section 8 (hash "about 250 ms"); AC-3 | A change verifies the current password and hashes the new one: two argon2id operations in series, then six short statements (user read in `requireUser`, `findAccountById`, throttle reserve, `findCredentialsById`, throttle clear, the update). Measured 515 ms for the two operations alone (verify 258 + hash 263), so a lone request is about 550 to 700 ms with the database round trips (estimate; the production host is unknown). NFR-010 does not say whether a password route is inside the 500 ms line. Sign-in (one verify) and the Admin's add and reset (one hash) fit; this is the only route that does not | One request over the proposed line, on a cold path (a person's first sign-in, then rarely). At 25 users with 4 changes at once the same four requests take about 2 s each and hold all four libuv threads and 256 MiB (measured on the development machine), which delays a sign-in made at that moment. Not an NFR breach at the stated volumes: 50 named users change once | No code change. The product-manager and the solution-architect state in NFR-010 (or in the k6 mix of test strategy 8) that password routes are judged on their own line, for example two hash costs plus 100 ms, or are outside the mix. The k6 run before release should include one change per virtual user at start-up, with `UV_THREADPOOL_SIZE` read from the host. If the production hash is slower than the 250 ms the architecture assumes, the line moves with it |
| PRF-02 | Minor | `tests/e2e/account.spec.ts:218` | Test strategy 10.5 item 2 (`@one-width` definition) and item 5 "standing practice"; RISK-023; AC-6 | "five wrong current passwords block the form for 15 minutes, and the person can still sign in" reads server behaviour only: a throttle count, message text and a sign-in. It reads no size, position, breakpoint, focus order or touch input. It runs at three widths, and the story added no `@one-width` tag (Dev Record). Its mobile and tablet instances are 9.6 s and 7.2 s, both on the slowest shard | 16.8 s of test time that adds no coverage; about 5 s of path on the slowest shard (16.8 s × the measured 0.285 of wall per test second; estimate). Small, but this PR's first attempt is above 5:30 and the three-shard level is about 5:18 (DL-179), so every second counts toward the median of five | Tag this one test `@one-width`. This needs a ruling row in test strategy 10.5 (solution-architect) and the allow-list in `tests/unit/one-width-tag.test.ts` (developer), so it travels with the fix round for STD-01. Keep the other three account tests at three widths: they read the account menu, 44 px targets, overflow, axe and the side menu. `users.spec.ts:157` stays at three widths: its subject is a message under a field, which 10.5 rules three widths for |
| PRF-03 | Minor (measurement condition; no hold) | PR run 43235390390; `tests/e2e/account.spec.ts:99` (heaviest new test, 9.5 to 13.2 s) | NFR-009 (CI feedback, 10 min agreed, 6 min early warning); RISK-023; test strategy 10.5 items 5, 9, 11; DL-173, DL-179, DL-180 | First attempt: **6:08** (368 s), at three shards, merge ref of c4517e6 into 3f22672. The base push run on 3f22672 (43197966408) read **5:40** (340 s), also at three shards. The delta is +28 s. The 15 new instances sum to 128.9 s of test time (8.6 s each, 3.2 times the 2.7 s of an average test, because each makes several argon2 sign-ins and a disposable user), of which 88.7 s (9 instances) sit on shard 1, the slowest shard. At the measured 0.285 of wall per test second that is 12 s (spread evenly) to 25 s (all on the slowest shard) of path (estimate). The rest of the 28 s is inside the spread of one draw (sd 26 to 42 s) | 6:08 is over the 5:30 that starts a median of five, and over the 6:00 early warning on this one run. It is not an NFR breach (10 minutes is not near), and the story's share is small. The level of `master` is already 5:18 (n = 20, DL-179), so the story takes it to about 5:30 to 5:45 at three shards (estimate). After AQP-276 (#336) the expected head medians are 4:50 to 5:15 (test strategy v0.37 item 12), which covers this story | No change to this PR for time. A **median of five is needed** under 10.5 items 5 and 9; the orchestrator runs it. How, on which head, against which base and at how many shards: see "RISK-023 and CI time". Reported, not judged: PRF-02's saving of about 5 s is the only reduction available inside this PR |
| PRF-04 | Info | `src/app/api/v1/account/password/route.ts:20` | Review checklist 8 (observability for performance); NFR-010 | `withRoute` logs a refusal or a failure but never a duration, so the only record of what the two hashes cost on the real host is a k6 run. The hasher's own header says the production host sets the final cost (follow-up recorded in an earlier story) | The 250 ms planning figure cannot be checked from production logs, and PRF-01's line cannot be re-read after release | Not for this PR. When the follow-up on the production cost is picked up, log `durationMs` for the two argon2 routes (sign-in and this one) at `info`, with the route name only. No password, hash or e-mail in the entry |

<details><summary>Detailed notes</summary>

### PRF-01: where the 515 ms goes

```
requireUser (1 read) -> findAccountById (1 read) -> assertPasswordRule (10 us, no I/O)
-> reserveAttempt (1 upsert) -> findCredentialsById (1 read)
-> verify current (~258 ms, libuv thread, 64 MiB)
-> throttles.clear (1 update) -> hash new (~263 ms, libuv thread, 64 MiB)
-> changeOwnPassword (1 update, WHERE id AND password_hash = expected) -> encode cookie
```

Good design to keep: the rule is the first step, so a weak password costs no hash and no attempt; a throttled request (the sixth and later) is refused before the verify, so a stolen session cannot make the server spend argon2 time after five wrong tries (each later attempt costs one upsert and the two reads); no transaction and no pooled connection is held across either hash (the update is one statement, matched on the expected hash, so a reset made meanwhile is not overwritten). Merging `findAccountById` and `findCredentialsById` into one read would save one round trip of about 1 to 3 ms out of more than 500: not worth a finding.

The numbers are from a development machine with 8 logical cores. A 4-vCPU container will be slower for four concurrent changes and about the same for one. Treat 515 ms as the floor, not the p95.

### PRF-02: the five new tests and which read layout

| Test (account.spec.ts) | Reads layout? | Width run | Measured per instance (mobile / tablet / desktop) |
|---|---|---|---|
| :99 change, wrong current, mismatch, other device out | Opens the account menu and reads the page; menu presentation differs by width | three | 11.7 / 13.2 / 9.5 s |
| :154 rule, hint, paste, toggle, overflow, 44 px, axe | Yes | three | 7.5 / 6.5 / 5.9 s |
| :218 block (AC-6) | **No**: throttle count, message, sign-in | three (**could be one**) | 9.6 / 7.2 / 7.1 s |
| :241 "Set a new password" | Yes: `aside` count, overflow, axe | three | 14.2 / 12.2 / 9.4 s |
| users.spec.ts:157 T7 | Message under a field with focus on it (ruled three widths for the same shape) | three | 6.6 / 4.3 / 4.0 s |

Total 128.9 s over the 15 instances.

### What the per-shard test seconds say (reported, not judged; item 9, v0.32)

| | Shard 1 | Shard 2 | Shard 3 | All |
|---|---|---|---|---|
| Base 3f22672, sum of per-test seconds | 764 | 959 | 570 | 2,293 |
| Base E2E step | 216 s | 271 s | 165 s | 652 s |
| PR c4517e6, sum of per-test seconds | 1,064 | 766 | 665 | 2,495 |
| PR E2E step | 301 s | 216 s | 194 s | 711 s |
| Wall per test second (PR / base) | 0.283 / 0.283 | 0.282 / 0.283 | 0.292 / 0.289 | |

The sum rose 202 s (+8.8 %): 128.9 s is the new tests and about 73 s is host draw and the changed list (the split is by count, so tests move between shards). A shard's sum has a standard deviation of 72 to 121 s between runs, so the 232 s by which shard 1 exceeds the shard mean (base: 195 s on shard 2) is not a balance finding. Balance stays reported only.

</details>

## RISK-023 and CI time

**Reading (DL-179: base commit and shard count stated).** Path = earliest job start to the end of `Stages 1 to 11`, attempt 1, queue wait excluded, from the jobs API.

| | PR run 43235390390 | Base push run 43197966408 |
|---|---|---|
| Commit | c4517e6 (merge ref into 3f22672) | 3f22672 on `master` |
| Shards | **three** | **three** |
| First job start | 14:16:01Z | 10:10:23Z |
| `Stages 1 to 11b` | 14:16:01 to 14:19:19Z = 198 s (3:18) | 10:10:23 to 10:14:02Z = 219 s (3:39) |
| Shard 1 / 2 / 3 (job) | 359 s (5:59) / 276 s (4:36) / 257 s (4:17) | 270 s (4:30) / 329 s (5:29) / 218 s (3:38) |
| Slowest shard | 1 | 2 |
| `Stages 1 to 11` ends | 14:22:09Z | 10:16:03Z |
| **Path** | **368 s = 6:08** | **340 s = 5:40** |
| Slack, item 11 (slowest shard minus main job) | **161 s** (a shard sets the path) | 110 s |
| Cache states | node_modules hit in every job; `.next/cache` exact hit; playwright and debs hit | node_modules hit; `.next/cache` restore-key hit; others hit |
| E2E passed / skipped / flaky | 835 / 24 / 0 | 820 / 24 / 0 |
| Stage 6 / Stage 11 | 35 s / 88 s | 40 s / 96 s |

The delta is +28 s on one draw each. The unit and integration stages are not slower (the +156 unit tests and +200 all-level tests do not show), so the added time is E2E. The host line (CPU model) is printed in the job summary, which the job logs do not carry; the orchestrator posts it with the five runs, as item 9 asks.

**Is a median of five needed? Yes.** Test strategy 10.5 item 5, as sharpened by item 9 (AC-5 of AQP-244): a story's first-attempt path of 5:30 or more starts the pull-request trigger, with four full re-runs and the median of five deciding. 6:08 is over 5:30. The base's own single run was 5:40, so the base is not a clean comparator either. This does not hold G6, G7 or the merge (DL-173 (3), DL-125, DL-142 (1)). A median of five of 5:30 or more is recorded as a RISK-023 reading: it stays at 8 (DL-179 (4)) and it makes the next CI-time step due, which is already placed (AQP-276).

**Recommendation to the orchestrator (I do not start runs).**

1. **Head.** Not c4517e6. It will change: STD-01 (Major, standards) needs a licence file, and PRF-02 changes `account.spec.ts` and the allow-list test if taken. Read the median of five on the head QA will test, as DL-173 (2) did for AQP-142 (H1, after the fix round and any alignment commit).
2. **Runs.** Four full "Re-run all jobs" re-runs of that head plus attempt 1, replacing any run with a `miss` or `fallback` (DL-128 (4); the `.next/cache` key is not a miss when it restores by prefix, as on every source-changing PR). Post the five paths, each run's slowest shard and host line, and the five slacks with their median (item 11).
3. **Base and shard count: state both, and do not mix them.** Today's 6:08 is c4517e6 into 3f22672, three shards. The order is AQP-142, then AQP-276, then this story (DL-180 (2)), and master is still at 3f22672 (PR #297 and #336 open). Two cases:
   - If the head is **updated onto a `master` that already holds AQP-276** before the five runs, they are at **four shards**. Compare them with a same-day set of runs of that `master` head at four shards, and read the expected 4:50 to 5:15 of test strategy v0.37 item 12; a median of 5:30 or more there would be a surprise worth a look at the main job (slack).
   - If the five runs are taken **before** that update, they are at **three shards** against 3f22672 or the then-current head, with a same-day push comparator. Say so in the post. Judge neither case against the 5:40 single run above.
4. **Expected (estimate).** Three shards: `master` level 5:18 (n = 20, DL-179) plus 12 to 25 s, so a median of about 5:30 to 5:45. Four shards: about 10 s on top of the 4:50 to 5:15 expected for the post-AQP-142 suite.
5. **Nothing here moves RISK-023.** It stays at 8 until DL-151 (5) (a median of five on a `master` head, or a window of at least 13 nightly runs, at 5:00 or less after the enabler merges).

## NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009, pages (first-load JS ≤ 200,000 gzip per route; LCP ≤ 2 s) | **Low.** `/account` is new at 169,341 (headroom 30,659); `/` +108, `/audit` +268, `/masters/materials` +265 (tightest row: 187,746, headroom 12,254), `/masters/process` +265, `/queue` +108, `/sign-in` +165, `/users` +825 (the rule in `validation.ts`), `not-found` +72. The shared-frame growth is 0.1 to 0.3 KB, as the Dev Record says. The list is server-only: a 75 KB source file would add about 28 KB gzip to a row, and none grew by more than 0.83 KB. `/account` is a server component with one client form; the form checks on submit only, so no per-keystroke work | none (STD-03, `server-only` on the list, protects this; I support it) |
| NFR-009, CI feedback (10 min agreed; 6 min warning; 5:30 trigger) | **Medium on one run** (6:08 at three shards, base 5:40); estimated level 5:30 to 5:45 at three shards; the 10-minute target is not near | PRF-03, PRF-02 |
| NFR-010 (save requests p95 ≤ 500 ms at 25 users, PROPOSED) | **Low to Medium for this route only:** two argon2id operations, 515 ms measured before I/O; every other route in the PR is one hash or none | PRF-01, PRF-04 |
| NFR-011 (fewer than 50 users; 500 nodes; master data) | **Low.** The throttle adds at most one `login_throttles` row per person (key `password-change`, primary-key access, about 50 rows at the stated volume); no purge exists for the table, and none is needed at this size. The list is one process-wide `Set` under 1 MB, built once on first import (about 2 to 3 ms) | none |
| NFR-003 (authentication) as it touches performance | The throttle bounds argon2 work: after five wrong current passwords every later attempt is refused before the verify. A correct current password clears the count, so a signed-in person who loops on correct changes is limited only by argon2 itself (about two operations a request); with at most 50 named internal people this is Info | covered in PRF-01 |

## Also checked, no finding

- **Algorithmic cost.** `checkPasswordRule`: length (`Array.from`, O(n)), then e-mail equality, two `\p{}` tests, then the list. n is at most 128 code points on every path that reaches the list, because the length check is first. `isCommonPassword`: lower-case, two substring tests for the two product words, two `Set` lookups, one strip. All O(n) with n at most 128: 1 to 3 µs measured. The request ceiling of 1,024 UTF-16 units (`PASSWORD_INPUT_CEILING`) reaches only `Array.from` and the length test before the 422, so the old 128 ceiling's job (no huge input into argon2) is kept by the rule's own order.
- **Where the list loads.** `common-passwords.ts` is imported only by `password-policy.ts`, which is imported by the user, account and bootstrap services. The `Set` is built on first import in a server process (or in `npx tsx scripts/bootstrap-admin.ts`), about 2 to 3 ms and under 1 MB; if the bundler copies the module into several route chunks (`/api/v1/users`, the reset route, the account route) it is a few MB at most. No lazy load is worth its code.
- **Database.** No N+1, no loop of queries, no unbounded result set, no new table or index, no migration (the Dev Record says none; the diff has none). Every new statement is a primary-key or unique-key lookup. `changeOwnPassword` is a single `UPDATE ... WHERE id AND password_hash = expected`, which is also the lost-update guard. The throttle upsert is the existing `reserveAttempt` statement.
- **Hash placement.** The Admin's add and reset still hash outside any transaction (`user-service.ts`, the earlier PRF-03 comment is kept). The new rule call comes before the hash in create, reset and bootstrap, so a refused password costs no argon2 work.
- **Throttle growth.** One row per person who opens the form and submits; on success `clear` writes the row once more. No growth in time. The sign-in `ip` keys are not this PR's.
- **Memory and leaks.** The cookie issuer and the account service are lazy singletons in `composition.ts`; no timers or listeners. The form holds three strings in state and clears them on success.
- **Front-end.** No new dependency (no `package.json` or lockfile change). The form uses shared `FormField`, `PasswordInput`, `Notice`, shadcn `Card` and `Button`. Success for a person who had to change goes by `window.location.assign`, a full load, on purpose.
- **Regex.** `/^[^\p{L}]+|[^\p{L}]+$/gu` looks quadratic on a long run of symbols but measured flat (0.04 ms at 1,024; 0.59 ms at 65,536), and the length check keeps n at 128 anyway.

## Previous Findings (re-review only)

Round 1. None.

## Issues for other roles

- **product-manager, solution-architect:** PRF-01. NFR-010 has no statement on password routes (the PRD gives no numbers for them). I used the assumption "a route that makes two argon2id hashes is judged on two hash costs, not 500 ms". If the PRD wants 500 ms for a change, it cannot be met with 64 MiB and 3 passes: the verify and the hash are both needed and already run in series with nothing else heavy between them.
- **solution-architect:** PRF-02. A ruling row for `account.spec.ts` in 10.5 if the developer takes it.
- **reviewer-quality (and developer):** not performance. `user-service.ts:213` lifts the Admin-reset person's sign-in block (`accountThrottleKey`) but not their `password-change` key (`passwordChangeThrottleKey`). A person who was blocked on SCR-23 (five wrong current passwords) and then has their password reset by the Admin lands on "Set a new password" and may be refused for up to 15 minutes, with only the temporary password to use. AC-5 says they can use nothing else until they set one. A one-line `clear` of the second key in the same place would close it. I have not tried it.
- **reviewer-standards:** the 1,024 limit now exists twice: `MAX_PASSWORD_LENGTH` in `src/server/auth/options.ts:34` and the new `PASSWORD_INPUT_CEILING` in `src/lib/users/validation.ts`. Sign-in and the new routes should read one constant. (The account schema's comment already says "sign-in reads up to the same ceiling".)

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-81/performance.md` (not committed; the orchestrator commits reports)
- Jira / GitHub updates: PR #341 review (COMMENT, verdict in the body, inline PRF-01 to PRF-04) and label `review:performance-approved`; Jira AQP-81 hand-off comment
- Open questions: none new
- Risks raised: none new. RISK-023 stays at 8; PRF-03 is a measurement condition under DL-173 (3)
- Recommended next agent: orchestrator. Schedule the median of five on the post-fix head, stating the base commit and shard count (PRF-03). reviewer-quality for the throttle-key point above
