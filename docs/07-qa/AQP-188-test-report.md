# Test Report — AQP-188 (STORY-10.13): First-load JS headroom: account menu and mobile drawer load on first open; early taps kept (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer, with the delivery lead for the iPhone session |
| Build / commit | `2e0fac6` on `feat/AQP-188-lazy-account-menu-and-drawer` (PR #75, after the update from `master` that brings in #56 and #76) |
| CI | Run 41981104405 on `2e0fac6`: green. Stage 11b passed, and stage 12 E2E gave 301 passed, 21 skipped (viewport-specific), 0 failed |
| Environment | **Local E2E:** Windows 11, Node 22, Chromium (Playwright 1.64.1). The code was an isolated `git archive` copy of `2e0fac6`, so no shared worktree was used. It ran on the production build (`next build`, then `next start` on port 3189; dev server on 3188) against a throwaway Postgres 17 database (Compose `qa188`, port 55688, since removed). **Phone:** the delivery lead's iPhone 17 Pro Max, iOS 27.0.1, Chrome 155, office Wi-Fi. The page was served by `npx next dev -H 0.0.0.0 -p 3000` from `C:\Users\sanku\Documents\Accucut-AQP-183-phone`, detached at `2e0fac6`. It used the development server because the production build sets Secure cookies, which a phone will not keep over plain `http` on the LAN |
| Date | 2026-11-05 |
| Evidence list | master's G6 CONDITIONAL GO, Jira 10928 (DL-091), closed in 10931 |
| **Recommendation** | **ACCEPT** |

## Summary

Every signed-in route now loads about 36.6 KB less JavaScript: `/` is 160,642 B and `/queue` 161,755 B, against the 190,000 B floor. Before, they were 197,229 B and 198,342 B. The account menu and the drawer behave as before on every check, and a tap made before the page is interactive is kept.

- **(a)** Every AC has evidence on the final head.
- **(b)** The two first-open specs ran 10 times at three widths with no retries: **842 passed, 0 failed**, so there was nothing to classify (DL-089).
- **(c)** QLT-55 and QLT-56 behave as fixed when checked by hand.
- **(d)** On the delivery lead's iPhone, all nine answers are as expected:
  - the account trigger shows its pressed look, with no selection or callout;
  - Calculate is clearly darker after a full reload, so the **DL-090 re-check passed**;
  - "Open menu" and the account trigger each opened **on the first tap, three times out of three**, right after a full reload of `/queue` (DEF-013).

No defects were found. DEF-013 (AQP-197, #69) is ready to close on master's G7 GO.

## (a) AC Verification Matrix

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 (every signed-in route ≤ 190,000 B) | CI stage 11b (`scripts/check-js-budget.ts`) | CI log on the final head | ✅ Pass | Run 41981104405: `/` 160,642 B (headroom 39,358 against 200,000; **29,358 under the 190,000 floor**) and `/queue` 161,755 B (**28,245 under**). `/design-system` answers 404 as required. Not-found is 135,547 B |
| AC-2 (same method before and after; `/sign-in` control ≤ +500 B) | PR #75 Dev Record tables; CI stage 11b | Read the PR's before/after table (recovered from the description's edit history; see Notes) and compared it with the final head | ✅ Pass | **Before** (`master` f5af00a, CI 41965160705): `/` 197,229, `/queue` 198,342, `/sign-in` 160,597. **After** (final head): `/` 160,642, `/queue` 161,755, `/sign-in` 160,674. The saving is 36,587 B on both routes. **`/sign-in` grew 77 B, within the 500 B allowance.** The before figures differ from the story's starting figures (197,247 / 198,360) by 18 B, within 1,000 B |
| AC-3 (nothing requested or preloaded before first open; each open requests its own code once; no drawer code at 1366 px) | `shell-lazy-load.spec.ts` AC-3, on `/` and `/queue` | E2E, 10 repeats, three widths (b) | ✅ Pass | Every repeat at every width passed |
| AC-4 (account menu unchanged; keyboard parity; ARIA before first open) | `shell-lazy-load.spec.ts` AC-4 (three tests); `sign-in.spec.ts` unchanged (CI) | E2E (b) plus the hand check (c) | ✅ Pass | Enter, Space and ArrowDown put focus on the first enabled item ("Sign out"; "Change password" is disabled). Escape returns focus to the trigger. A pointer open leaves focus on the menu. Not modal |
| AC-5 (drawer unchanged) | `shell-lazy-load.spec.ts` AC-5 (three tests); `shell.spec.ts` unchanged (CI) | E2E (b) | ✅ Pass | Focus returns on Escape, on the close button and when the current page is chosen. Choosing another page focuses its title. Widening closes the drawer. The `data-slot` names stay |
| AC-6 (axe 0 with each overlay closed and open; reduced motion) | `shell-lazy-load.spec.ts` AC-6 (two tests) | E2E (b) | ✅ Pass | No axe violations at any width or repeat |
| AC-7 (no layout shift, pending and failed states included) | `shell-lazy-load.spec.ts` AC-7; the failed-request test in `shell-first-open.spec.ts` | E2E (b) | ✅ Pass | |
| AC-8 (slow and failed first open; Escape; retry; one loader) | `shell-first-open.spec.ts` (four tests); `tests/unit/first-open.test.ts` (CI stage 6) | E2E (b), unit tests in CI | ✅ Pass | |
| AC-9 (nothing else changes; BR-003) | `tests/unit/portal-frame-props.test.ts`; `auth-session.test.ts`; `shell.spec.ts`; `sign-in.spec.ts` | CI stages 4 to 6, 11 and 12 | ✅ Pass | Lint, type-check and unit tests are green. The props test asserts that `id` and `mustChangePassword` are absent. The existing specs pass unchanged; the only change to them is the allowed first-open wait |
| AC-10 (early tap kept; DEF-013) | `shell-first-open.spec.ts`, "a tap before the page is interactive" (seven tests; four at 1366 px); `tests/unit/early-intent.test.ts` | E2E (b), plus the iPhone (d) | ✅ Pass | **70/70 on mobile, 70/70 on tablet, 40/40 on desktop** across 10 repeats. On the iPhone, both controls opened on the first tap after a full reload, 3/3 each |

## (b) Repeat series (`--repeat-each=10 --retries=0`, mobile, tablet, desktop)

| Spec | Time | Passed | Failed | Skipped | Load (CPU average / peak, lowest free memory) |
|------|------|--------|--------|---------|-------|
| `tests/e2e/shell-first-open.spec.ts` (AC-8, AC-10, QLT-56, QLT-57) | 01:41 to 01:55 (14.0 min) | **341** | **0** | 50 (drawer tests at 1366 px) | 60 % / 100 %, 0.27 GB |
| `tests/e2e/shell-lazy-load.spec.ts` (AC-3 to AC-7, QLT-55) | 01:56 to 02:12 (16.6 min) | **501** | **0** | 40 (tests for below 1024 px, at 1366 px) | 75 % / 100 %, 0.21 GB |

- **Time-outs:** none, so there was no stall or lost click to classify under DL-089.
- **Machine:** no other workload ran. The load came from the runs themselves: two workers plus two servers on a PC with 7.8 GB RAM.
- **Server log:** the production server logged no errors.

## (c) QLT-55 and QLT-56 by hand

The checks used a QA probe script outside the suite, on the production build at `2e0fac6`, signed in as the invented Lead on `/queue`.

| Finding | Steps | Observed | Result |
|---|---|---|---|
| QLT-55 (first-item focus only on the open that mounted the menu, by keyboard) | At 1366 px, focus the account trigger, press Enter, then Escape. Then open with the pointer twice | **Enter:** focus on the menu item "Sign out". **Escape:** focus back on "Account menu, E2E Lead, Lead". **Pointer opens 1 and 2:** focus on the menu container, not on an item | ✅ Fixed |
| QLT-56 (widening while the drawer is pending cancels the open) | At 768 px, hold the lazy chunks back by 3 s and press "Open menu". Widen to 1366 px before the code arrives, then wait for it | **On the press:** `aria-busy="true"`. **After the code arrived:** 0 dialogs open and the side menu visible. **After narrowing to 768 px and pressing again:** the drawer opens | ✅ Fixed |

## (d) iPhone session with the delivery lead

The answers below were typed by the delivery lead to each question as QA worded it, and relayed by the orchestrator. "Full reload" meant closing the tab and opening the address again, clearing cached files first where Chrome offered it.

| # | Question | Expected | Answer | Result |
|---|---|---|---|---|
| 1 | On `/queue`, hold the account button for about a second: does it turn a clearly darker colour? | Yes | "yes" | ✅ |
| 2 | Holding it about two seconds: is text selected, or does a copy menu or magnifier appear? | No | "No" | ✅ |
| 3 | **DL-090:** after a full reload of `/design-system`, hold Calculate: is it a clearly darker red? | Yes | "yes" | ✅ The DL-090 re-check passed; DEF-010 stays closed |
| 4 | **DEF-013:** full reload of `/queue`, tap "Open menu" as soon as it appears: does it open on that one tap? | Yes | "yes" | ✅ |
| 5 | Repeat of 4 | Yes | "yes" | ✅ |
| 6 | Repeat of 4 | Yes | "yes" | ✅ |
| 7 | **DEF-013:** full reload of `/queue`, tap the account button as soon as it appears: does it open on that one tap? | Yes | "yes" | ✅ |
| 8 | Repeat of 7 | Yes | "yes" | ✅ |
| 9 | Repeat of 7 | Yes | "yes" | ✅ |

**Result:** 9 of 9. The development server hydrates more slowly than the production build, which gives a wider window for an early tap, so this is a demanding setting for DEF-013.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| First-open and early tap, ×10 | `npx playwright test tests/e2e/shell-first-open.spec.ts --repeat-each=10 --retries=0` | 391 | 341 | 0 | 50 | 14.0 min |
| Lazy load, ×10 | `npx playwright test tests/e2e/shell-lazy-load.spec.ts --repeat-each=10 --retries=0` | 541 | 501 | 0 | 40 | 16.6 min |
| Full regression (CI) | Run 41981104405, stages 1 to 12 on `2e0fac6` | all stages | ✅ | 0 | stage 13 (disabled) | about 5 m 47 s |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| First-load JS ≤ 190,000 B per signed-in route (200,000 B limit) | NFR-009 | CI stage 11b | ✅ `/` 160,642 B, `/queue` 161,755 B |
| Accessibility (axe; keyboard; focus) | NFR-018 | `shell-lazy-load.spec.ts` AC-4 to AC-6 (b); hand check (c) | ✅ No violations |
| Three widths | NFR-016, NFR-017 | Playwright projects at 360, 768 and 1366 px | ✅ |
| Security (BR-003: no user id or flags in client props; sign-out still a CSRF POST) | BR-003, NFR-001, NFR-002 | `portal-frame-props.test.ts` (CI); the sign-out tests unchanged | ✅ |

## Exploratory Testing

The hand checks (c) and the phone session (d) are above. **Watched while running (b):** the production server log showed no errors, and every first open requested its chunk once.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-013 ([AQP-197](https://sankumar76.atlassian.net/browse/AQP-197), [#69](https://github.com/sankumar76/Accucut-Quotation/issues/69)) | A tap on "Open menu" or the account menu before the page is interactive is lost | Sev-3 (Product) | **Fixed and verified: (b) 0 failures, and on the iPhone 3/3 first-tap opens per control.** QA closes it on master's G7 GO | AC-10 |

New defects: none. Open after this story: Sev-1 0, Sev-2 0, Sev-3 0 once DEF-013 closes, Sev-4 0.

## Residual Risks / Notes

- **PR #75's description was overwritten.** At 2026-11-05 06:24 UTC, PR #75's description was replaced with the text of the docs PR #76 ("SCR-25 first-open state mock-ups"). The developer's Dev Record and AC-2 tables are now only in the description's edit history, where QA read them. Developer or orchestrator: restore them.
- **QLT-61 (Info, from G6):** the `onOpenAutoFocus` spread passes a private Radix prop without type checking. Only the E2E guards it; a typed prop is the follow-up.
- **CSP (DL-091 condition 2):** the early-tap inline script must be allowed by its hash in the CSP story (architecture section 10). That is not part of this story.
- **Risks:** RISK-020 falls and RISK-022 closes when PR #75 merges (master, DL-091).
