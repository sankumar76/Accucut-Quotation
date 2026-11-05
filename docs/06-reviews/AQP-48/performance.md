# Review Report — AQP-48 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-48` (PR #79; head = b72ab88 plus the docs-only master merge #78) |
| Commit reviewed | 5208f6e (base 2c941c1) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
Role enforcement and per-role navigation (STORY-01.02) cost almost nothing on the server. A page still does one session decode and one `users` read per request. The manifest lookup takes under a microsecond, and the menu is built in microseconds on the server.

First-load JavaScript grows by about 4.7 KB on every route and by 22.9 KB on not-found. I verified CI's figures with my own Turbopack build. The cause is the new root `app/error.tsx`, a client boundary that is in every route's first load. It brings in the SCR-26 card and, through it, `Button`, `Card`, `BrandLockup`, `cn`/`tailwind-merge`, `cva`, Radix `Slot`, `next/link` and four lucide icons. On portal and sign-in pages, part of it duplicates code those pages already carry. Every route stays well under 200,000 B and the 190,000 B target, so this is a Minor finding with a cheap fix.

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
| Diff | `git diff 2c941c1 5208f6e` (the PR head was fetched read-only; no merge) | 25 source files: `src/server/http/*` (manifest, `withRoute`, `authorizePage`, navigation, problem), views, system pages, root `error.tsx` and `not-found.tsx`, proxy, session, `next.config.ts` (`authInterrupts`), budget script |
| Production build (Turbopack), one build | `next build` of 5208f6e in a throwaway detached worktree under `.claude/worktrees/`. To build there: that worktree's config only set `turbopack.root` to the repository, skipped type-checking and set `experimental.cpus` 1 (0.8 GB of RAM free); its lockfile was set aside. Then `git worktree remove --force` | Built in 156 s |
| First-load JS | Scratch script: `rootMainFiles` plus the route's `entryJSFiles`, gzip -9 | See table |
| Attribution | Entry chunk lists per segment; string search in the chunks | Root `src/app/error` entry: `0umf…` 3,516 (already loaded), `058ge…` 4,385, `436a…` 9,369, `2poij…` 9,248. The `Button` class string is in `058ge`, `1m7kg0` (portal layout) and `2zbtx` (sign-in); `ACCUCUT` in `058ge` and `1m7kg0` |
| Server code | Read `page-access.ts`, `with-route.ts`, `route-manifest.ts` (20 rows), `navigation.ts`, `me-view.ts`, `origin-check.ts`, `proxy.ts`, `session.ts`, `portal-frame-props.tsx` | See findings |
| Tests, Lighthouse | n/a | Not run |

**First-load JS, gzip -9 (bytes)**

| Route | CI (b72ab88) | Mine (5208f6e) | Master | Change | Left under 200,000 |
|---|---|---|---|---|---|
| `/` | 165,410 | 165,439 | 160,642 | +4,768 | 34,590 (17.3 %) |
| `/queue` | 166,544 | 166,576 | 161,755 | +4,789 | 33,456 (16.7 %) |
| `/sign-in` | 164,973 | 164,993 | 160,674 | +4,299 | 35,027 (17.5 %) |
| not-found | 158,453 | 158,476 | 135,547 | +22,906 | 41,547 (20.8 %) |

My figures are 20 to 32 B above CI's, from my worktree path embedded in the chunks, so the methods agree. Headroom uses CI's figures. All routes are below the 190,000 B target floor.

**Where the growth comes from.**
- **Portal routes and `/sign-in`:** they already loaded `436a…` and `2poij…`, so they pay only `058ge…` (about 4.4 KB). Part of that is a second copy of `Button` and `BrandLockup`.
- **not-found:** it used to load only the framework, so it now pays `058ge…` + `436a…` + `2poij…` ≈ 23.0 KB.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `src/app/error.tsx:5` | NFR-009 (first-load JS, LCP/TBT); coding standards §7 | The root error boundary is a client component in every first load. Through `system-page.tsx` it imports `HomeAction` (`Button asChild` plus `Link`), `Card` and lucide icons; through `system-page-frame.tsx` `BrandLockup`; and itself `Button` | +4.4 KB on every route (partly duplicated code), +22.9 KB on not-found. Within budget (about 17 % headroom) | Plain `<button>` with a literal class string for "Try again"; move `HomeAction` into its own module imported only by the server-rendered not-found and forbidden pages. Estimate: not-found back to about 136 to 140 KB, 1 to 2 KB less elsewhere. Can be a follow-up |
| PRF-02 | Info | `src/server/http/page-access.ts:23` | NFR-010 (p95 ≤ 500 ms); R4 pool | Layout and page both call `requireUserOrRedirect` | One JWT decode and one primary-key read per page (React `cache`). `findPage` under 1 µs over 20 rows. `withRoute` resolves its row at module load; an API call does one read with a cookie and none without; the proxy's per-request `Headers` copy costs microseconds | None |
| PRF-03 | Info | `src/app/(portal)/portal-frame-props.tsx:49` | Coding standards §7 | Menu built on every render | Filter, sort and group over 20 rows: microseconds, on the server. The 13 lucide icons are server-rendered SVG, not client JS | None (memoise per role only if the manifest grows into the hundreds) |
| PRF-04 | Info | `scripts/check-js-budget.ts:43` | Test strategy 10.1 | Pages come from the manifest; unlisted built pages fail; measured as the Admin only | Correct today: the scripts a route loads are the same for every role. Cost: milliseconds | When a page renders different client components per role, add invented Lead and Engineer measurement users |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS | Low: about 17 % headroom on portal routes; the error boundary's cost can be reclaimed | PRF-01 |
| NFR-009 LCP / TBT | Low: about 4.4 KB more JS on every page | PRF-01 |
| NFR-010 server p95 | None | PRF-02, PRF-03 |
| CI feedback time | None | PRF-04 |

**RISK-020.** Headroom on the portal routes falls from about 19 % (AQP-188) to about 17 %. Still comfortable, and stage 11b enforces it on every PR. Doing the PRF-01 fix would recover part of it.

## Previous Findings (re-review only)
n/a (first round).

---

# Round 2 — head 561f48e (CI run 42019269128), narrow: PRF-01 and every route (DL-093)

| Field | Value |
|-------|-------|
| Review round | 2 |
| Commit reviewed | 561f48e |
| Date | 2026-11-05 |
| **Verdict** | APPROVE |

## Summary (round 2)
The fix removes `Button` (`cva`, Radix `Slot`) and the home action from the root error boundary. `HomeAction` is now in its own `server-only` module, and the retry control is a plain `<button>` with `RETRY_BUTTON_CLASSES`. Every route drops by exactly 2,121 B, which is the duplicated `Button` code.

not-found is still 156,332 B, 20.8 KB above master. My round-1 estimate of 136 to 140 KB was wrong: it missed that the boundary's frame and card still bring in `cn`/`tailwind-merge`, `next/link`, `next/image` and lucide. About half of that is needed by the not-found page itself (its logo and its link home are client components). The rest, about 11 KB on one page with 21.8 % headroom, is accepted as PRF-05 (Info).

| Severity | Open after round 2 |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 4 (PRF-02, PRF-03, PRF-04, PRF-05) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 5208f6e 561f48e` (fetched read-only, no merge) | `error.tsx`, new `home-action.tsx` (`server-only`), new `retry-button-classes.ts`, `system-page.tsx` (no `Button`/`Link`), `not-found.tsx` and `forbidden.tsx` (role-named button through `readViewerRole`), `roles.ts`, `viewer-role.ts`, `with-route.ts` (log fields), tests |
| First-load JS | CI stage 11b, run 42019269128 (HTML method) | See table |
| Attribution of the not-found remainder | Import graph of `app/error.tsx` at 561f48e plus the round-1 chunk analysis (5208f6e build) | `SystemPageFrame` → `BrandLockup` (`next/link`, `next/image`, `cn`); `SystemPageCard` → `Card` (`cn`), `Icon` plus lucide icons. Estimates: about 9 KB `tailwind-merge`/`clsx`, about 9 KB `next/link` plus lucide runtime (the round-1 `2poij…` chunk, 9,248 B), about 2 to 3 KB `next/image` plus the card |
| Local build | n/a | Not run: low memory (coordinator); CI's figures and the chunk reading were enough |

**First-load JS, gzip -9 (bytes)**

| Route | 561f48e | 5208f6e | Master | Round 2 change | PR net change | Left under 200,000 |
|---|---|---|---|---|---|---|
| `/` | 163,289 | 165,410 | 160,642 | −2,121 | +2,647 | 36,711 (18.4 %) |
| `/queue` | 164,423 | 166,544 | 161,755 | −2,121 | +2,668 | 35,577 (17.8 %) |
| `/sign-in` | 162,852 | 164,973 | 160,674 | −2,121 | +2,178 | 37,148 (18.6 %) |
| not-found | 156,332 | 158,453 | 135,547 | −2,121 | +20,785 | 43,668 (21.8 %) |

All routes are below the 190,000 B target floor.

## Findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-05 | Info | `src/app/error.tsx:5` | NFR-009 first-load JS | The boundary still renders the shared frame and card, which keep `cn`/`tailwind-merge`, `next/link`, `next/image` and lucide in its graph. Portal routes and `/sign-in` load these anyway; not-found pays about 20.8 KB | About half is inherent to not-found (its own logo and link home). The avoidable about 11 KB falls on one rarely seen page with 21.8 % headroom, not a key screen | Accepted. If not-found ever needs it: a minimal boundary frame and card with literal class strings and an `<img>` |

## Previous Findings (round 1)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Minor | Fixed in part; remainder accepted as PRF-05 | `Button` and `HomeAction` are out of the boundary: −2,121 B on every route. My round-1 not-found estimate was too low; thread resolved with the explanation |
| PRF-02 | Info | Holds | `readViewerRole` reuses the cached `getCurrentUser`: still one read per request, with a `null` fallback and no extra query |
| PRF-03 | Info | Holds | Unchanged |
| PRF-04 | Info | Holds | Unchanged |

**RISK-020.** Portal routes have about 17.8 to 18.4 % of headroom (up from about 17 % at round 1).
