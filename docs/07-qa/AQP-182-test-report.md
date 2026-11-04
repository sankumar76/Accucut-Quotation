# Test Report — AQP-182: test reliability 2 (DEF-004, DEF-007)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `db768eb` on `fix/AQP-182-test-reliability-2` (PR #57): the developer's `420ba74` plus a merge of master `85c699f` (AQP-38), made through GitHub's update-branch |
| CI | Run 41868765137 on `db768eb`: success (stages 1 to 12) |
| Environment | Windows 11; Node v24.19.0; Chromium (Playwright 1.64.1). E2E: development server (3100) and production build (3101) against the throwaway Postgres `qa38` (port 55538, invented passwords) with the E2E users. Load for (b): `tsc`, `eslint` and `next build` looping in a second checkout (`agent-a8463f2dfd078bf1c`) |
| Date | 2026-11-04 |
| **Recommendation** | **ACCEPT for AQP-182's own scope (DEF-004 and DEF-007 are fixed), with two new type-Test defects outside that scope, DEF-011 and DEF-012.** Master's condition (a) as worded ("0 failures" in the drawer series) is **not** met. Every failure there is DEF-011, a click-before-hydration race in the shared `openDrawer` helper, not the DEF-004 width check. Master decides whether that holds G7. QA has not closed DEF-004 or DEF-007, because master's instruction was to close them "if all are green" |

## Summary

**DEF-004 (the drawer width tolerance):**
- The width check never failed: it passed every time the drawer opened, 59 of 59 across two 15-repeat series on mobile and tablet. Desktop has no drawer by design.
- A drawer planted 1 px wider was caught 6 of 6 times (288.99 to 289.0 px against the 288.5 px limit).

**DEF-007 (the process helper and the hook moves):**
- In ten loaded `tests/unit` runs, `env-example`, `server-only` and `data-files` never failed, and no `ProcessStartError` occurred.
- Git exit 128 now surfaces as an error: the developer's test passes, a live run with git broken errors instead of passing, and removing the fix makes the test fail.

**Two failures elsewhere, both the same load- and timing-sensitive class, neither in this PR's change:**
- **DEF-011:** the drawer suite's `openDrawer` clicks "Open menu" before React has hydrated the page, so the click is lost (9 of 362 drawer tests across two series). Shown by a probe.
- **DEF-012:** `tokens.test.ts`, which arrived with the master merge, re-reads every source file inside each scan test and timed out in 2 of 10 loaded runs.

## (a) DEF-004: drawer, 15 repeats per width, no retries, plus a planted 1 px fault

Command: `npx playwright test tests/e2e/shell.spec.ts -g "drawer" --repeat-each=15 --retries=0`. The drawer exists below 1024 px, so the desktop project skips these tests by design.

| Series | Machine | Passed | Failed | Skipped | DEF-004 width test (mobile + tablet) | The failures |
|---|---|---|---|---|---|---|
| 1 | loaded (18.5 min) | 178 | 3 | 90 (desktop) | 30 of 30 | All `openDrawer`: "Menu" dialog not visible after 15 s (DEF-011) |
| 2 | quiet (11.6 min) | 175 | 6 | 90 (desktop) | 29 of 30; the 1 failure was at `openDrawer`, before its width check | All `openDrawer` (DEF-011) |

**The width check itself:** 59 of 59 passed wherever the drawer opened.

**Planted fault:** `src/components/ui/sheet.tsx` was changed from `w-(--drawer-w)` to `w-[calc(var(--drawer-w)+1px)]`, and `-g "no wider than the drawer token" --repeat-each=3` was run: **6 of 6 failed** at the width assertion (received 288.99999 to 289.00000286 against a limit of 288.5). The source was restored with `git checkout`. The 0.5 px tolerance absorbs the sub-pixel noise and still catches a 1 px error.

**Why series 2 was not treated as overload.** Master's rule is that an overload failure is repeated, not counted. Series 2 ran on a quiet machine (4 node processes before it started) and failed more often than series 1. So the cause is not load. A probe on the mobile project then clicked "Open menu" as soon as it was visible:

| Probe | Hydrated when clicked | Drawer opened | Hydrated afterwards |
|---|---|---|---|
| No delay | false | false | true |
| JavaScript chunks delayed 4 s | false | false | true |

A click before hydration is lost and the drawer never opens. `openDrawer` clicks once, right after `goto`, which waits only for `load`. Raised as **DEF-011** ([AQP-186](https://sankumar76.atlassian.net/browse/AQP-186), [#67](https://github.com/sankumar76/Accucut-Quotation/issues/67)), Sev-3, type Test. The probe was added to `shell.spec.ts` temporarily and removed with `git checkout`.

## (b) DEF-007: ten `tests/unit` runs under the record's load

The load: `tsc`, `eslint` and `next build` looping together in a second checkout. **12 load rounds** ran alongside the ten unit runs.

| Run | Result | Time | `ProcessStartError` | Failure |
|---|---|---|---|---|
| 1 | 1,487 of 1,487 | 103 s | 0 | |
| 2 | 1,487 of 1,487 | 143 s | 0 | |
| 3 | 1,486 of 1,487 | 200 s | 0 | `tokens.test.ts` "finds 0 rgb(), hsl() ..." timed out at 5 s (5,360 ms) |
| 4 | 1,487 of 1,487 | 163 s | 0 | |
| 5 | 1,487 of 1,487 | 111 s | 0 | |
| 6 | 1,486 of 1,487 | 139 s | 0 | `tokens.test.ts` "finds 0 pixel font sizes ..." timed out at 5 s (6,530 ms) |
| 7 | 1,487 of 1,487 | 143 s | 0 | |
| 8 | 1,487 of 1,487 | 117 s | 0 | |
| 9 | 1,487 of 1,487 | 110 s | 0 | |
| 10 | 1,487 of 1,487 | 91 s | 0 | |

**What DEF-007 asked for** (reviewer-quality, 10798): 0 failures in `env-example`, `server-only` and `data-files`. **Met in all 10 runs**, with 0 `ProcessStartError`.

**The two failures** are a new member of the same class, in a test that is not in this PR's change: `tokens.test.ts` (from AQP-28) re-reads every file in `src` inside each of its three scan tests, under the 5 s limit. Raised as **DEF-012** ([AQP-187](https://sankumar76.atlassian.net/browse/AQP-187), [#68](https://github.com/sankumar76/Accucut-Quotation/issues/68)), Sev-3, type Test.

## (c) DEF-007: git exit 128 must be an error, not "not ignored"

| Check | Result |
|---|---|
| The developer's test, `npx vitest run tests/unit/process-helper.test.ts -t "QLT-25"` | 2 of 2 pass: a path outside the repository gives exit 128, and `checkIgnore` throws "git check-ignore failed with exit code 128" |
| **Live control:** git really broken, `GIT_DIR=C:/qa-no-such-git-dir npx vitest run tests/unit/env-example.test.ts` | The suite errors in `beforeAll` with "git check-ignore failed with exit code 128: fatal: not a git repository" and runs none of its 34 tests. No test passes on a broken git |
| **Fix undone:** the exit check in `tests/support/git-ignore.ts` removed, then restored with `git checkout` | The developer's QLT-25 test fails. With git broken, `env-example` then reports 10 failed and 24 passed, and some of those passes are false, which is exactly the outcome the fix prevents |

## Defects

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| DEF-004 ([AQP-179](https://sankumar76.atlassian.net/browse/AQP-179), #43) | Drawer width assertion fails on sub-pixel overshoot | Sev-3, Test | **Fix verified** (width check 59 of 59; a 1 px fault caught 6 of 6). Not closed by QA; for master's G7 |
| DEF-007 ([AQP-182](https://sankumar76.atlassian.net/browse/AQP-182), #52) | Unit tests time out at 5 s under load; a process that never started read as a result | Sev-3, Test | **Fix verified** for its named members: (b) 0 failures in them across 10 loaded runs, 0 `ProcessStartError`; (c) passes. Not closed by QA; for master's G7 |
| DEF-011 ([AQP-186](https://sankumar76.atlassian.net/browse/AQP-186), [#67](https://github.com/sankumar76/Accucut-Quotation/issues/67)) | Shell E2E clicks "Open menu" before hydration; the click is lost | Sev-3, Test | New. Origin AQP-28 |
| DEF-012 ([AQP-187](https://sankumar76.atlassian.net/browse/AQP-187), [#68](https://github.com/sankumar76/Accucut-Quotation/issues/68)) | `tokens.test.ts` re-reads files inside each scan test, times out at 5 s under load | Sev-3, Test | New. Origin AQP-28 |

Open: Sev-1 0, Sev-2 0, Sev-3 2 new (DEF-011, DEF-012, both type Test) plus DEF-004 and DEF-007 awaiting master. Sev-4 0.

## Notes

- **Product note** (in DEF-011): a person who taps "Open menu" before hydration also gets nothing. Whether the button should look inactive until the page is ready is for the ux-expert or solution-architect.
- **DEF-004 and DEF-007 records** (`docs/07-qa/defects/`) are left as they are; their status follows master's G7.
- **Housekeeping:** the probe and the planted fault were both reverted (`git status` shows no tracked change). The qa38 database is stopped after this run.

## Artefacts

Committed with this report: `docs/07-qa/AQP-182-test-report.md`, `docs/07-qa/defects/DEF-011-drawer-click-before-hydration.md`, `docs/07-qa/defects/DEF-012-tokens-test-reads-files-inside-each-test.md`.

## Hand-off
- Status: COMPLETE
- Recommendation (G7): ACCEPT for AQP-182's scope (DEF-004 and DEF-007 fixes verified). Condition (a) as worded not met, because of DEF-011 (outside this PR). Master decides
- Jira / GitHub: AQP-186 / #67 and AQP-187 / #68 created and linked to AQP-182; summaries on AQP-182 and PR #57
- Story status: not changed by QA
