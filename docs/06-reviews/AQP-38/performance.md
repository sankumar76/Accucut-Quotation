# Review Report — AQP-38 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-38-sign-in-sign-out` (PR #58) |
| Commit reviewed | 4d9b2e2 (base 529d576) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
Sign-in and sign-out keep every route under the NFR-009 budget of 200,000 bytes gzip first-load JavaScript. I verified the developer's figures with my own Turbopack production build. The margin is now very small, though: `/queue` has 1.8 KB left and `/` 2.9 KB, and the next portal UI story will add content to both. The server side is light. Each portal page does one primary-key read of `users` (shared between the layout and the page), and the moves to dynamic rendering and to per-request role checks cost a few milliseconds. On a development laptop, argon2id at the configured cost takes about 350 ms per verify, above the 250 ms target, so it needs timing on the host (#59). `login_throttles` growth is bounded by the clean-up job in #60.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Production build (Turbopack) | `next build` in a throwaway detached worktree `.claude/worktrees/perf-aqp38-head` at 4d9b2e2. To make it build there: `turbopack.root` set to the repository folder and `typescript.ignoreBuildErrors` in that worktree's config only, and the worktree's lockfile set aside. Nothing was committed or pushed | Built; `/`, `/queue`, `/sign-in`, `/design-system` dynamic (`ƒ`), proxy present |
| First-load JS and CSS per route | Scratch script: `build-manifest.json` `rootMainFiles` (no polyfills, which are `nomodule`) plus every `entryJSFiles` chunk of the route in `page_client-reference-manifest.js`, deduplicated, gzip level 9 | `/` 197,138 B (11 files); `/queue` 198,249 B (12); `/sign-in` 160,502 B (9). CSS 7,476 B gzip on all three |
| Chunk breakdown, `/queue` | Same script, per chunk | React DOM 71.7 KB, Next client runtime 46.3 KB, Radix about 43 KB (3 chunks), lucide and tailwind-merge about 19 KB (2 chunks), the rest under 8 KB each |
| argon2id cost | `@node-rs/argon2` `verify` at 64 MiB, t=3, p=1 on an i7-10510U laptop (8 threads), with other builds running | 1 verify 350 ms median, 425 ms max; 4 / 8 / 16 concurrent 0.7 / 1.2 / 2.2 s; peak RSS about 370 MiB; up to 73 ms event-loop lag during 8 |
| Code read | session, resolve-session-user, options (callbacks), composition, prisma-client singleton, proxy, user and throttle repositories, auth-service, migrations | See findings |
| CI | Run on 4d9b2e2 | Green, merge state CLEAN (not rerun) |

**Method note.** The developer measured signed-in HTML from a running server (script and preload URLs). I read the same chunk sets from the build manifests. My totals are 20 to 27 B higher on every route. That fits the longer module paths of my worktree being embedded in the chunks, so the two methods agree.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `src/app/(portal)/layout.tsx:44` | NFR-009 (200,000 B per route), RISK-020, DL-059 | First-load JS verified: `/` 197,138 B (+3.2 KB over the 193,907 baseline), `/queue` 198,249 B, `/sign-in` 160,502 B. All pass, but `/queue` has 1,751 B (0.9 %) and `/` 2,862 B (1.4 %) left | The next portal UI story (queue content) is likely to cross the budget on every portal route | Before that story, load the account-menu dropdown and the mobile drawer only when opened (`next/dynamic` or `React.lazy` behind the trigger). Both are Radix and closed at first paint; an estimated 10 to 25 KB is freed per portal route. Master to restate RISK-020 (probability up) |
| PRF-02 | Info | `src/server/auth/session.ts:31` | NFR-010 (p95 ≤ 500 ms at 25 users), R4 pool | One `users` read by primary key per request, shared by React `cache` between the layout and the page; the next-auth callbacks read nothing; the proxy has no database access. `connection()` makes every portal route dynamic | Under 1 ms in the database plus a round trip (estimate); a few ms of server render per page; no static-cache loss that matters under the `no-store` rule | None. Watch the prefetch reads if `loading.tsx` is added to portal routes |
| PRF-03 | Info | `src/server/auth/password-hasher.ts:15` | Architecture §8 (about 250 ms), #59, NFR-011 | argon2id about 350 ms per verify on a laptop. Verifies share libuv's 4-thread pool with file, DNS and zlib work, and each holds 64 MiB | A burst of sign-ins queues (16 at once take 2.2 s) and can delay other pool users; sign-in path only | Time it on the host (#59). If the `app` container is small, cap concurrent verifies (a semaphore of 2) or lower `memoryCost` |
| PRF-04 | Info | `src/server/repositories/throttle-repository.ts:72` | NFR-003, NFR-013 (disk), #60 | All access by primary key. Growth is one row per distinct key (about 150 B plus index), at most about 2,900 account keys a day per address. `clear` writes on every successful sign-in, even with nothing to clear | Bounded by the #60 clean-up; a few dead row versions per sign-in | Filter `clear` to rows with `failures > 0` or `blocked_until` not null; schedule the #60 job with the worker |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS | Medium: all pass, 0.9 to 1.4 % headroom on portal routes | PRF-01 |
| NFR-009 LCP / TBT | Low: CSS unchanged in size (7.5 KB gzip); 3.2 KB more JS on portal routes | PRF-01 |
| NFR-010 server p95 | Low: one indexed read per page | PRF-02 |
| NFR-011 capacity | Low: sign-in bursts bounded by the thread pool and memory | PRF-03 |
| NFR-003 / NFR-013 | Low: bounded growth with #60 | PRF-04 |

## Previous Findings (re-review only)
n/a (first round).
