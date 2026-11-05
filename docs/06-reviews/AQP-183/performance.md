# Review Report — AQP-183 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...docs/AQP-183-pressed-state` (PR #56) |
| Commit reviewed | 64bef0d (base 529d576) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE |

## Summary
The DEF-008 fix adds `:active` styles to the four button variants and one `--shadow-pressed` token. It adds 59 bytes gzip to the first-load JavaScript of `/`. On the recorded baseline of 193,907 bytes, `/` is estimated at about 193,966 bytes, about 6,034 bytes (3.0 %) under the NFR-009 limit of 200,000, so RISK-020 is unchanged. The CSS grows by 165 bytes gzip. The pressed look adds a short repaint of the pressed button only, with no layout change and no animation. No action is needed.

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
| Production build, base and head | `node node_modules/next/dist/bin/next build --webpack` in two scratch copies (`git archive` of 529d576 and 64bef0d), one after the other | Both built; `/` prerendered as static. Webpack, not Turbopack: see the method note |
| First-load JS and CSS of `/` | A scratch script reads `.next/server/app/index.html` and sums every `static/chunks/**` and `static/css/**` file it references (script tags and the inline flight payload, which names the `(portal)` layout and page chunks), gzip level 9 | JS: base 292,369 B → head 292,428 B (+59 B gzip, +339 B raw); 10 files on both sides, only `app/(portal)/layout-*.js` changed. CSS: 7,425 B → 7,590 B gzip (+165 B; +1,234 B raw) |
| Emitted CSS | Inspected the `:active` rules in the head stylesheet | 14 `:active` rules, all one class plus one pseudo-class. The inset shadow goes through Tailwind's existing `--tw-shadow` chain |
| CI | Run 41831621385 | Green, merge state CLEAN. CI has no JS budget step yet (AQP-169) |

**Method note.** I could not run Turbopack, the production bundler: it refuses a `node_modules` outside the project root, and the review copies had to live in the scratch area, not the repository. Webpack splits chunks differently, so its absolute 292 KB is not comparable with the recorded 193,907 bytes. The difference between base and head is what this review relies on. It comes from the same string literals, the new class names in `button.tsx` and `'pressed'` in `cn.ts`, so the Turbopack difference should be about the same, within some tens of bytes. The head figure for `/` is an estimate: **193,907 + 59 ≈ 193,966 bytes gzip**.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `src/components/ui/button.tsx:25` | NFR-009 first-load JS (200,000 B per route); RISK-020; DL-059 | The `active:` classes add about 340 raw bytes, 59 bytes gzip, to the `(portal)` layout chunk that every portal route loads | `/` ≈ 193,966 B (estimate), about 6.0 KB (3.0 %) headroom; not over the budget | None. The headroom is still about 3 %, so the next story that adds client JavaScript must be measured too (DL-059) |
| PRF-02 | Info | `src/app/globals.css:64` | NFR-009 (LCP, TBT), NFR-018 | CSS +165 B gzip (7.6 KB in all, one render-blocking file). An inset `box-shadow` and a background change only while a button is pressed | Download cost is negligible. The repaint covers one button's box only while it is held: no layout, no reflow, and no animated paint, because `transition-colors` does not animate `box-shadow` | None |
| PRF-03 | Info | `src/app/globals.css:214` | Coding standards §7 (no waste) | Tailwind also emits a plain `.shadow-pressed` utility and a `.ring,.shadow-pressed` selector, about 100 B raw, because it finds the class name in the comment in `button.tsx`. The `@theme` line `--shadow-pressed: var(--shadow-pressed)` is a self-reference in `@layer theme`. It works only because the unlayered `:root` value wins | About 100 B; no runtime effect. The self-reference is a correctness matter (reviewer-quality), not a performance one | None for performance. If wanted, keep the class name out of comments, or rely on Tailwind's `@source` exclusions |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200 KB gzip per route | Low: +59 B; `/` ≈ 193,966 B (estimate), 3.0 % headroom. RISK-020 restated, score unchanged | PRF-01 |
| NFR-009 LCP ≤ 2 s, TBT ≤ 200 ms | None: +165 B CSS; no new script work | PRF-02 |
| INP (responsiveness of a tap) | None: a pressed state is a style change with a paint-only cost; it improves feedback on touch | PRF-02 |
| CLS | None: an inset shadow does not change layout | PRF-02 |
| CI feedback time (test strategy 10.3) | Low: job 3 min 48 s (run 41831621385), with the new E2E spec inside stage 12 | n/a |

## Previous Findings (re-review only)
n/a (first round).

---

# Round 2 — DEF-010 (head 0cfaf78, base master 85c699f, which includes AQP-38)

| Field | Value |
|-------|-------|
| Review round | 2 |
| Commit reviewed | 0cfaf78 (CI run 41873955569 green) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary (round 2)
The DEF-010 round (darker pressed fills, an instant press, a 200 ms fade on release, `select-none`, no iOS callout) adds about 110 bytes gzip to every route's first-load JavaScript. I verified the developer's figures with a Turbopack production build: `/queue` is now 198,360 B by my count, leaving about 1.6 KB of the 200,000 budget. It passes, but headroom on portal routes is now under 1 %, so RISK-020 is restated below. The CSS grows by 384 B gzip. The paint cost of the press and of the release fade is limited to one button and involves no layout.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Production build (Turbopack), one build | `next build` in a throwaway detached worktree `.claude/worktrees/perf-aqp56-head` at 0cfaf78. To build there: that worktree's config only set `turbopack.root` to the repository and skipped type-checking, and its lockfile was set aside. Then `git worktree remove --force` | Built in 148 s; all portal routes and `/sign-in` dynamic |
| First-load JS and CSS | Scratch script: `rootMainFiles` (no polyfills) plus the route's `entryJSFiles` from `page_client-reference-manifest.js`, gzip level 9 (same method as the AQP-38 review) | See the table below |
| Baseline for the difference | My Turbopack build of 4d9b2e2 (AQP-38 review), from a worktree path of the same length. Master's changes since 4d9b2e2 are all server-side (8 files under `src/server`, `src/proxy.ts`, `src/lib/env.ts`, the auth route), so the client bundles are the same as master | `/` 197,138 B, `/queue` 198,249 B, `/sign-in` 160,502 B, CSS 7,476 B |
| Emitted CSS | Inspected the head stylesheet | New rules: `duration-200`, `ease-out`, `select-none`, `[-webkit-touch-callout:none]`, `active:transition-none`, `active:bg-primary-pressed`, `active:bg-danger-pressed`, `shadow-pressed` (16 `:active` rules in all). No rule comes only from the docs mock-ups |

**First-load JS, gzip -9 (bytes)**

| Route | Developer | Mine (head) | Master (mine, 4d9b2e2) | Change | Left under 200,000 |
|---|---|---|---|---|---|
| `/` | 197,229 | 197,247 | 197,138 | +109 | 2,753 (1.4 %) |
| `/queue` | 198,342 | 198,360 | 198,249 | +111 | **1,640 (0.8 %)** |
| `/sign-in` | n/a | 160,607 | 160,502 | +105 | 39,393 |

My figures are 18 B above the developer's on both routes, from the worktree path embedded in the chunks (as in the AQP-38 review), so the methods agree. The change is about +110 B on every route, which matches the developer's "+113 B over master". The CSS is 7,476 → 7,860 B gzip (+384 B; 31,605 → 34,248 B raw).

## Findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-04 | Minor | `src/components/ui/button.tsx:24` | NFR-009 first-load JS; RISK-020; DL-059 | +110 B on every route; `/queue` at 198,360 B (my figure) or 198,342 B (developer's), 0.8 % left | Passes. But the next portal UI story will cross 200,000 unless JavaScript is cut first. A 100-byte change now matters | Not for this PR. Before the next portal UI story, carry out the AQP-38 PRF-01 cut: load the Radix account menu and drawer only when opened (estimated 10 to 25 KB). This can't wait any longer |
| PRF-05 | Info | `src/components/ui/button.tsx:24` | NFR-009 (TBT, INP), CLS | The press is instant (`active:transition-none`); the release fades background, text and border over 200 ms (`transition-colors duration-200 ease-out`); the inset shadow is not transitioned and drops at once | Paint only, on one 44 px button, for 200 ms after release; no layout, no CLS, no main-thread work (the compositor and paint handle a colour transition). `select-none` and `-webkit-touch-callout` cost nothing at runtime. Also lengthens the hover fade from 150 to 200 ms on every button, which is harmless | None |
| PRF-06 | Info | `src/components/ui/button.tsx:94` | Coding standards §7 | `cn(classes, BUTTON_ONLY)` runs `tailwind-merge` a second time on every button render | `tailwind-merge` caches by input string, so after the first render of each variant this is a cache lookup (estimate: well under 10 us per button). Server-rendered buttons pay it on the server; no effect on a page's time | None. If many buttons ever render in a client list, pass `BUTTON_ONLY` into the first `cn` call instead |

## NFR impact (round 2)
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200,000 B per route | **Medium**: all pass; `/queue` 0.8 %, `/` 1.4 % left | PRF-04 |
| NFR-009 LCP / TBT; INP; CLS | None: +384 B CSS; paint-only press and release | PRF-05, PRF-06 |

**RISK-020 restated (for master).** `/queue` has about 1.6 KB (0.8 %) and `/` about 2.8 KB (1.4 %) of headroom after this PR (developer's figures 1,658 B and 2,771 B). Any portal UI story that adds more than about 1.6 KB of client JavaScript will breach NFR-009 on `/queue`. The likelihood should be scored higher than at AQP-38's G6. The cut in PRF-04 (also AQP-38 PRF-01) is the planned answer, and it needs an owner and a story before the next portal UI story starts. The AQP-169 budget check in CI would then catch the next breach automatically.

## Previous Findings (round 1)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Info | Superseded | Round 1 measured +59 B (webpack difference); the whole PR is now +110 B, measured with Turbopack (PRF-04) |
| PRF-02 | Info | Holds | CSS now +384 B gzip in all; paint cost re-checked for the instant press and the release fade (PRF-05) |
| PRF-03 | Info | Holds | The plain `.shadow-pressed` rule is still emitted (about 100 B), and the `@theme` self-reference is unchanged (reviewer-quality's area) |
