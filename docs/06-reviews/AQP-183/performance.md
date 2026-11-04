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
