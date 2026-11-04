# Review Report — AQP-183 (DEF-008) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...docs/AQP-183-pressed-state` (PR #56) |
| Commit reviewed | 64bef0dceabd314377849801be0057bf577c057d |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The pressed state is implemented exactly as UX spec v0.9 §7.3.1 states. The class strings match the spec's developer line, the `--shadow-pressed` value is right, and every pressed text/fill pair meets its contrast target (recomputed from the tokens). `disabled:active` wins by specificity, and loading buttons are disabled, so they are covered too. The unit test reads the CSS that Tailwind actually builds, and mutation probes show it catches 5 of 6 planted faults. The one gap is that no test presses by **touch on WebKit**, which is how the defect was found, so the iPhone check of rule 8 has to be G7 evidence.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Unit tests (scratch copy of 64bef0d via `git archive`; no working tree touched) | `npx vitest run tests/unit/button-pressed.test.ts tests/unit/cn.test.ts` | 31 of 31 passed |
| Mutation probes (same scratch copy) | 6 single-line edits to `button.tsx`, the same two test files | 5 killed, 1 survived (see QLT-31) |
| Contrast of pressed pairs | WCAG relative luminance from the `globals.css` hex values | primary 5.97, secondary 12.71, ghost 10.41 (red text would be 3.80), danger 8.96; matches the spec table |
| E2E | not run locally | CI run 41831621385, stages 1 to 12 including `tests/e2e/button-pressed.spec.ts`: success; merge state CLEAN |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-29 | Minor | `tests/e2e/button-pressed.spec.ts` (`pointerDownOn`) | DEF-008 (tap on iPhone, WebKit); UX 7.3.1 rule 8 | The E2E presses with `page.mouse` in Chromium only. No touch input, no WebKit. A mouse-down sets `:active` in every engine, so the spec cannot fail on the touch-specific cause (WebKit bug 138816) the PR itself leaves open. | G6 and CI can pass while the reporting iPhone still shows nothing. | Add a CDP `Input.dispatchTouchEvent` touch-hold case on the touch-capable mobile project. Make the rule 8 device check an explicit G7 step. Optionally add a WebKit project for this spec. |
| QLT-30 | Info | `src/components/ui/button.tsx:21` | UX 7.3.1 rule 4 | `disabled:active:*` compiles to `:disabled:active` (0,3,0) and beats every `active:*` (0,2,0), and loading sets `disabled`. Correct. The E2E disabled cases probably cannot fail in Chromium (a disabled button does not normally enter `:active`); the unit test guards them. | None; evidence note. | None needed. |
| QLT-31 | Info | `tests/unit/button-pressed.test.ts` | UX 7.3.1 rules 5, 6, 7 | Survivor: `active:scale-95` on primary passes the unit test (the E2E size check should catch it). For primary and danger the pressed fill equals the hover fill, so on desktop only the shadow assertion proves `:active`; it does. Rule 6 (focus ring with pressed) is untested, but the ring is an `outline`, so it is safe by design. | Low. | Optional unit check that no `active:` class sets `scale`, `translate` or `transform`. |

## Reviewer-specific tables
**Quality: AC conformance** (DEF-008 has no AC IDs; the acceptance is UX spec 7.3.1)

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| Token `--shadow-pressed` = `inset 0 2px 4px rgba(23, 24, 28, 0.28)`; `shadow-pressed` utility; known to tailwind-merge | `globals.css`, `cn.ts` | `tokens.test.ts`, `cn.test.ts`, E2E | Met |
| Primary: `--primary-hover` + `--on-fill` + inset | `button.tsx` | unit, E2E | Met (5.97:1) |
| Secondary: `--border` + `--ink` + inset; edge stays `--border-strong` | `button.tsx` | unit, E2E | Met (12.71:1) |
| Ghost: `--primary-line` + `--ink` (not red) + inset | `button.tsx` | unit (probe killed), E2E | Met (10.41:1) |
| Danger: `--danger-ink` + `--on-fill` + inset | `button.tsx` | unit, E2E | Met (8.96:1) |
| Icon 44 px / row icon 36 px carry the variant's look; size unchanged | `button.tsx` | unit, E2E | Met |
| Rule 1: pressed outside the hover query, and wins over hover | `button.tsx` | unit (probe killed) | Met |
| Rule 4: disabled and loading show nothing | `button.tsx` base | unit (probe killed); E2E weak (QLT-30) | Met |
| Rules 5 and 7: no motion, no size change | `button.tsx` | E2E size check (QLT-31) | Met |
| Rule 6: focus ring stays visible | `globals.css` `:focus-visible` outline | not tested | Met by design |
| Rule 8: works on the reporting iPhone (WebKit touch) | possible `touchstart` listener (solution-architect) | not tested (QLT-29) | **Open, G7 device check** |

**G7 steps recommended to qa-engineer**
1. On the iPhone that found DEF-008 (Chrome/WebKit), at `/design-system` section 05:
   - hold each of Calculate, Add part, Cancel, Delete and both pencils for about a second, and see the pressed fill and the inset;
   - tap each quickly and see a brief flash;
   - tap a disabled and a loading button and see nothing.
2. If step 1 shows nothing, record it on AQP-183 for the solution-architect's `touchstart` decision.
3. Run `npx playwright test tests/e2e/button-pressed.spec.ts --retries=0` on the three projects, with 0 failures.

## Previous Findings (re-review only)
n/a (first quality review of this PR).
