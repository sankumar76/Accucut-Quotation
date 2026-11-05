# Test Report — AQP-198 (DEF-014, Sev-2): the account trigger's accessible name contains its visible text (WCAG 2.5.3 Label in Name)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `646ac60` on `fix/AQP-198-account-trigger-label-in-name` (PR #85) |
| CI | Run 42037474153 on `646ac60`: green. Stage 11b passed, and stage 12 E2E gave **352 passed**, 21 skipped (viewport-specific), 0 failed, every axe scan now including `wcag21a`. **CI is the reference for the full suite** (the PC is low on memory, and a second developer is working on it) |
| Environment | **Local, targeted checks only:** Windows 11, Node 22, Chromium (Playwright 1.64.1), @axe-core/playwright. The code was an isolated `git archive` copy of `646ac60`; no shared worktree and no `git merge` were used. Production build (`next start`, port 3198) and dev server (3197), against a throwaway Postgres 17 database (Compose `qa198`, port 55698, since removed). Users were invented: Admin `qa.admin@example.test`, Lead and Engineer (the E2E users) |
| Date | 2026-11-05 |
| Evidence list | master's G6 decision, Jira AQP-198 comment 10963 (DL-095); G6 closed in 10973 |
| **Recommendation** | **ACCEPT, and close DEF-014** |

## Summary

The trigger's accessible name is now `Account menu, <initials>, <name>, <role>`. At every width, for each role, it contains the visible text, which is "EL" alone on a phone and "EL E2E Lead Lead" from 768 px. axe with `wcag21a` finds 0 violations, with the menu closed and open. The new E2E spec passes 12 of 12 locally at three widths and in CI. A planted fault restoring the old name fails both the unit test and the E2E spec. The menu still opens by pointer and by keyboard, and Escape returns focus. Regression is green, including stage 11b.

## Evidence against master's list (10963)

| Item | Technique | Result | Evidence |
|---|---|---|---|
| Name contains visible text, three widths, each role, **axe with `wcag21a`** | Live probe on the production build (Admin, Lead, Engineer × 360, 768, 1366 px × `/queue` and `/`) | ✅ | **Admin:** name "Account menu, MA, Measurement Admin, Admin"; visible "MA" at 360 px, "MA Measurement Admin Admin" at 768 and 1366 px. **Lead:** "Account menu, EL, E2E Lead, Lead"; visible "EL" at 360 px, then "EL E2E Lead Lead". **Engineer:** "Account menu, EE, E2E Engineer, Engineer"; visible "EE", then "EE E2E Engineer Engineer". In all 18 page checks the name contains the visible text, and axe (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) finds **0 violations**. With the menu open, axe finds 0 at every width for every role |
| Name contains visible text, **new E2E spec** | `npx playwright test tests/e2e/account-trigger-name.spec.ts --retries=0` (local, production build) | ✅ | **12 passed** (mobile, tablet, desktop × closed, pending, failed, open/after the first open). CI 42037474153: the same 12 passed |
| Full suite: 0 violations with the new tags | CI 42037474153, stage 12 (every `expectNoAxeViolations` now uses `AXE_TAGS` with `wcag21a`) | ✅ | 352 passed, 0 failed |
| Planted fault (the old name) fails | In the scratch copy, the `aria-label` set back to `Account menu, ${user.name}, ${user.role}` | ✅ | **Unit test:** `button-pending.test.ts` has 4 failures, for example expected "Account menu, IP, Invented Person, Lead" and received "Account menu, Invented Person, Lead". Restored: 12 of 12 pass. **E2E (rebuilt, mobile):** the spec fails, for example `Expected pattern: /^Account menu, [A-Z]{1,2}, .+, .+$/`, received "Account menu, E2E Lead, Lead", and expected "Account menu, EL, E2E Lead, Lead". Two of the four planted tests failed earlier, at sign-in (the page stayed on `/sign-in` right after the rebuild), so they show nothing either way. The source was restored afterwards |
| The menu still opens by pointer and by keyboard | Live probe at three widths for each role; a focus re-check | ✅ | A pointer click opens the menu. Enter, Space and ArrowDown open it with focus on "Sign out", the first enabled item. Escape closes it. **Focus return:** the first probe read focus right as the menu closed and found 2 of 27 not yet on the trigger, both at 768 px. A re-check at 768 px, 20 rounds per key, found focus back on the trigger every time (59 of 60 immediately, 1 within 1 s), so those 2 readings were taken too early. CI covers focus return in the AQP-188 specs |
| Regression green, including 11b | CI 42037474153 | ✅ | Stage 11b: `/` 163,294, `/queue` 164,428, `/sign-in` 162,852, not-found 156,332 (all under 190,000 B; +5 B on `/` and `/queue`, as reviewer-performance reported). Job 7 m 31 s |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Unit (the trigger name) | `npx vitest run tests/unit/button-pending.test.ts` | 12 | 12 | 0 | 0 | seconds |
| New E2E spec (local, three widths) | `npx playwright test tests/e2e/account-trigger-name.spec.ts --no-deps --retries=0` | 12 | 12 | 0 | 0 | 35 s |
| Full regression (CI) | Run 42037474153 | all stages | ✅ (352 E2E) | 0 | 21 (viewport-specific) | 7 m 31 s |

**Local run notes (environment, not counted):**
- The first local spec run timed out in Playwright's own dev-server start, after 120 s.
- The second timed out in the set-up project while the dev server compiled `/design-system` under memory pressure.
- The counted run used `--no-deps`. The spec signs in on its own against the production server, and its invented users were already created.

## Exploratory Testing

**Charter:** check the trigger's name as a person using speech input or a screen reader would meet it, for each role and width, and that the menu is unchanged. **Time-box:** 30 min.
- **The name matches what is shown:** the initials come first, as drawn, followed by the name and role, which are visible from 768 px.
- **No touch-specific behaviour was found**, so no phone check is needed.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-014 ([AQP-198](https://sankumar76.atlassian.net/browse/AQP-198), [#82](https://github.com/sankumar76/Accucut-Quotation/issues/82)) | The account trigger's accessible name did not contain its visible text (WCAG 2.5.3); the E2E axe tags omitted `wcag21a` | Sev-2 | **Fixed and verified**; QA closes it | NFR-018 |

New defects: none.

## Residual Risks / Notes

- **PR #85 is behind `master`.** GitHub shows it as BEHIND `master` (`d8cb223`, newer than this head). Update it from `master` before the merge; stage 11b and E2E will then re-run.
- **QLT-67 and QLT-68 (Info):** the E2E `innerText` check cannot see the spaces, and the initials pattern is narrower than `initialsOf`. The unit tests and axe guard both, and no action is needed (DL-095).
- **DL-094:** once DEF-014 closes, other UI stories may pass G7 again.
