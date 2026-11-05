# Review Report — AQP-188 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-188-lazy-account-menu-and-drawer` (PR #75) |
| Commit reviewed | 3142157 (CI run 41975770162 green) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE |

## Summary
STORY-10.13 moves the Radix account menu and mobile drawer out of the first load. I repeated the test strategy 10.1 measurement with my own Turbopack build, and it confirms the developer's step 11b figures: every portal route drops by about 36.6 KB, and `/queue` now has 38.3 KB (19.1 %) of headroom instead of 1.7 KB (0.8 %).

The code arrives on the first press: 37.7 KB gzip for the account menu and 16.6 KB for the drawer. That is about 0.1 s on the Wi-Fi profile, by estimate, behind a pending look that paints at once. Nothing is preloaded or requested earlier, and the decision against prefetch holds. The inline early-tap script is 404 B gzipped, outside the budget by rule, and costs nothing measurable. There is no layout shift.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Production build (Turbopack), one build | `next build` of 3142157 in a throwaway detached worktree under `.claude/worktrees/`. To build there: that worktree's config only set `turbopack.root` to the repository, skipped type-checking and set `experimental.cpus` 1 (about 1 GB of RAM was free); its lockfile was set aside. Then `git worktree remove --force` | Built in 77 s |
| First-load JS and CSS | Scratch script: `build-manifest.json` `rootMainFiles` (no polyfills) plus the route's `entryJSFiles`, gzip -9 | See table |
| Lazy chunk sets | Read the async loader chunk lists in the first-load chunk that holds the two `import()`s | Account: 4 files, 37,715 B gzip, 123,935 raw. Drawer: 2 files, 16,623 B gzip, 52,694 raw (11,759 B shared with the account set) |
| Preload or early request | The lazy chunks against every route's `entryJSFiles`; the AC-3 E2E (`shell-lazy-load.spec.ts`: network log, HTML scripts and preload links, 3 widths) | Not in any first-load set; named only inside the loader. E2E not run here |
| Inline script | Rendered `EARLY_INTENT_SCRIPT` text | 740 B, 404 B gzip -9 |
| CLS | Code read (`AccountTrigger` shared, fixed `Sheet`, absolute failure line); AC-7 E2E (bounding boxes and `layout-shift` entries) | No shift by design. E2E not run here |
| Lighthouse, E2E | n/a | Not run: low memory; one build only |

**First-load JS, gzip -9 (bytes)**

| Route | Step 11b (developer) | Mine | Before (master) | Change | Left under 200,000 |
|---|---|---|---|---|---|
| `/` | 160,593 | 160,527 | 197,229 | −36,636 | 39,407 (19.7 %) |
| `/queue` | 161,706 | 161,638 | 198,342 | −36,636 | 38,294 (19.1 %) |
| `/sign-in` | 160,674 | 160,671 | 160,597 | +77 | 39,326 (19.7 %) |
| not-found | 135,547 | 135,545 | 135,547 | 0 | 64,453 (32.2 %) |

On the portal routes my count is about 67 B below step 11b; on `/sign-in` and not-found it agrees within 3 B. The likeliest cause is one tiny file that the signed-in HTML names and the manifests do not. The budget rule is the HTML count, so the step 11b figures stand. CSS is 7,860 → 8,104 B gzip (+244 B).

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `src/components/shared/use-first-open.ts:76` | NFR-009 (first-load JS), INP; AC-1 to AC-3 | Overlays loaded by a bare `import()` on the first press; no preload, no prefetch (settled) | First open, estimated: Wi-Fi (40 ms RTT, 10 Mbps, 4× CPU) account menu about 100 to 150 ms, drawer about 70 to 100 ms; Slow 4G about 0.45 s and 0.3 s. Later opens are free (stays mounted). INP unaffected: the pending look paints in the same interaction | None. Prefetch would bring back the bytes this story removed |
| PRF-02 | Info | `src/lib/ui/early-intent-script.ts:20` | NFR-009 (TBT); test strategy 10.1 (inline excluded) | Inline script in every portal page's HTML | 404 B gzip per page; parse well under 1 ms; 2 capture listeners until hydration; per click one `closest()` and one attribute write | None |
| PRF-03 | Info | `src/components/shared/account-menu.tsx:52` | CLS; AC-7 | Plain trigger swapped for the Radix trigger on the first open | Same `AccountTrigger` face, fixed-position `Sheet`, absolute failure line: no shift. CSS +244 B gzip | None |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200,000 B | Low: about 19 % headroom on every route | PRF-01 |
| NFR-009 LCP / TBT | Better: about 36.6 KB less JS to load and run on portal pages | PRF-01, PRF-02 |
| INP | None | PRF-01 |
| CLS | None | PRF-03 |

**RISK-020 (for master).** Headroom after this PR: `/` 39,407 B (19.7 %), `/queue` 38,294 B (19.1 %), `/sign-in` 39,326 B (19.7 %), not-found 64,453 B (32.2 %), down from 0.8 % on `/queue`. The cut asked for at AQP-38 (PRF-01) and AQP-183 (PRF-04) is done, and stage 11b enforces the limit on every PR. I recommend lowering RISK-020's probability. The LCP and TBT side still waits for the first key screen in `KEY_SCREENS` (AQP-169 PRF-04).

## Previous Findings (re-review only)
n/a (first round).
