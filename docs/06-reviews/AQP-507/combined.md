# Review Report — AQP-507 (DEF-150, PR #847) — Combined security and quality (CLAUDE.md §9 (2))

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (one combined security-and-quality review, DL-481 (4)) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-507-refresh-vs-navigation` (based on 51502650) |
| Commit reviewed | b365eedde0edc6071ce467f1141a16f9391c92ee |
| Date | 2026-11-28 |
| **Verdict** | **REQUEST CHANGES** (submitted as COMMENT, REVIEW_IDENTITY = single-token) |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/847#pullrequestreview-6096349554 |

## Summary
The fix records the address when a refresh is asked for and skips the refresh if the committed address has changed when the 300 ms timer fires. For a navigation that commits inside the quiet period it is small, clear and correct. It does not cover DEF-150's key case: a refresh **already sent** that lands after a later row change. The one test that holds a sent refresh failed on attempt 1 at mobile in the run of record. Two smaller gaps remain: the no-wait case does not observe the refresh, and the guard reads only *committed* navigations. There is no security regression.

| Severity | Count |
|----------|-------|
| Blocker | 1 |
| Critical | 0 |
| Major | 2 |
| Minor | 2 |
| Info | 2 |

## Must-checks (DL-481)

### (a) A no-wait case at three widths: PARTIAL
- `estimate-review-refresh-race.spec.ts:93` (a link pressed straight after the first save) ran and **passed on attempt 1 at all three widths** in run 46115274383: mobile #307 (10.7 s, shard 1), tablet #460 (14.8 s, shard 2), desktop #61 (17.2 s, shard 4). It does not wait out the 300 ms.
- It **does not observe the refresh**: it has no count of old-address `_rsc` requests and does not move time past the window. It could pass without the fix (QLT-03). The PR shows only the unit wiring test red before the fix. The branch has one CI run, so CI never ran the red commit `ed2659ff`.

### (b) History and Back/Forward: no regression from #847; the R1 check belongs on #845
- #847 makes no history call: there is no `replaceState`, `pushState` or `popstate` in the diff.
- `addressNow()` reads `window.location`. Next 16.4.5 writes that in `HistoryUpdater`, after commit (`node_modules/next/dist/client/components/app-router.js:102-110`). A popstate on an `__NA` entry is a soft `traverse` (`:61-71`).
- The guard's `pushState(win.history.state, '')` (`src/lib/estimates/leave-guard.ts:124`) keeps `__NA` and the same address, so a refresh still goes after the guard arms, which is correct.
- R1's `replaceState(null, '', address)` is in **#845 (open)**, not in this PR. From code reading, Next's patched `replaceState` copies `__NA` and the current router tree into the new entry (`copyNextJsInternalHistoryState`, `app-router.js:128-139`) and dispatches a restore. So Back and Forward through it stay soft. Note for #845's review: the copied tree is the previous address's tree.
- #847 has no Back/Forward test. Gap: QLT-04 (Minor).

### (c) A refresh already sent that lands after a later navigation: NOT COVERED (Blocker, QLT-01)
CI output for `estimate-review-refresh-race.spec.ts:44` (the sent refresh held with a route):

| Width | Result | Attempt |
|---|---|---|
| desktop | ✓ #60 (17.4 s), shard 4 | 1 |
| tablet | ✓ #459 (16.9 s), shard 2 | 1 |
| **mobile** | **✘ #306 (24.7 s), then ✓ #319 (20.7 s) on `retry #1`**. Shard 1 reports "1 flaky" | **retry only** |

Attempt-1 error at `:76`: `expect(page).toHaveURL(/row=1#row-inputs$/)` received `http://localhost:3100/estimates/Q-2026-0005?row=1.1` for the full 15 s. While the sent refresh was outstanding, the row change never committed. The test lets the refresh go (`:83`) only after asserting the navigation, so it cannot exercise "the refresh lands, then the pressed row and the typed text are still there" whenever the navigation waits behind it. The PR body itself says this case is not covered by the fix. The run uploads no trace, so the log cannot tell a product hold from a missed click.

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| PR and diff | `gh pr view 847`, `gh pr diff 847` | Three files: `review-form.tsx` +8, a new E2E spec (110 lines), a new unit wiring test (25 lines) |
| CI run of record | `gh run view 46115274383` (attempt 1) | All six jobs succeeded |
| Unit wiring test | log grep | ✓ 2 tests (Stage 6 and Stage 11) |
| Race spec | log grep for `refresh-race` | See (a) and (c). `:44` mobile flaky (retry only) |
| Other flaky cases | shard summaries | Shard 4: `estimate-form-choice:109/:126` and `estimate-form-sections:64/:96` [desktop], not related to this PR |
| Security pipeline | job step list | Stage 2 Gitleaks (full history), Stage 3 data-file allow-list, Stage 4 lint, Stage 5 type-check, Stage 7 audit, Stage 9 build, Stage 11 coverage of changed code, Stage 11b JS budget: job green |
| Next router internals | read `app-router-instance.js` `:39-160`, `refresh-reducer.js`, `sequential-router-queue.js`, `app-router.js` | A navigation discards a *pending* queued refresh. `window.location` is updated only after commit |
| Local build or E2E | none | Not run (constraint: the PC is short of memory; CI is the evidence) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Blocker | `tests/e2e/estimate-review-refresh-race.spec.ts:76` (with `:83`) | DL-481 (3), (4); DL-479 (5) | A refresh already sent and landing after a row change is not covered. The held-refresh case failed attempt 1 on mobile (URL stuck on `row=1.1`) and passed only on retry. The release comes after the navigation assert, so the landing step is never exercised when the navigation is held | A Lead may stay on, or return to, the earlier row while the refresh is in flight, and type there. Text survival (the Sev-1 question) is unproven | Release after the **navigation's own** `_rsc` request, assert the final state after both answers, and pass attempt 1 at three widths. If the navigation is held or reverted, give the product a rule for a sent refresh (for example, no whole-route `router.refresh()` for the cleared redraw, or a re-read at the new address after the late answer) |
| QLT-02 | Major | `src/components/features/estimate-workspace/review-form.tsx:26` (`:66`) | DL-481 (4) outcome | The address check sees only **committed** navigations (`window.location` is written in `HistoryUpdater`). A link pressed inside the window whose page arrives after 300 ms still lets the old-address refresh go | DEF-150's window stays open on a slower server. CI's fast server hides it | Cancel the pending timer when the navigation starts: the tree's `<Link onNavigate>`, the guard's `navigate` (`leave-guard.tsx:70`) and `popstate`. Keep the address check. Test: hold the navigation's `_rsc` request past 300 ms and assert that no row=1.1 `_rsc` request is sent |
| QLT-03 | Major | `tests/e2e/estimate-review-refresh-race.spec.ts:93-108` | DL-481 (2)(ii); coding-standards §6 | The no-wait case never observes the refresh: no request count and no clock advance. It can pass without the fix | The coverage #845's waits depend on is nominal | Count row=1.1 `_rsc` requests after the save. Use `page.clock.install()` and `runFor(300 + 50)`, assert 0 requests, and show it red on `ed2659ff` |
| QLT-04 | Minor | `review-form.tsx:66` | DL-481 (4) (`popstate`) | A Back or Forward inside the window skips the refresh. Next restores the entry from its cache, which only a refresh invalidates | The restored row may show the pre-save "figures current" look. Display only: the server still refuses approve and download | Still refresh after a traversal, or log a follow-up |
| QLT-05 | Minor | `tests/unit/review-form-refresh-wiring.test.ts:17-19` | coding-standards §6 | Pins the source text with regular expressions, not the behaviour | Brittle on a reformat and blind to a wrong rule. It is the project's existing pattern, so preference-level | A fake-timer vitest case on `ReviewForm` with a stubbed router |
| QLT-06 | Info | n/a | DL-481 (4) proof | The island menu case (#811) and #845's guard cases with their waits removed are not in this PR | Conditions for closing DEF-150, not for this merge | Track them on AQP-507 |
| QLT-07 | Info | n/a | §6 rule 7; NFR-002 | Security: no secrets or real data (names invented, person ledger +0). No auth, role, step-up or cost-visibility path touched. The client neither reads nor keeps figures | None | None |

## Reviewer-specific tables
**Quality: acceptance conformance** (AQP-507 has no formal ACs. The outcome and proof come from DL-481 (4) and the Jira ruling comment.)

| Requirement | Implemented in | Tested by | Result |
|---|---|---|---|
| A refresh never overwrites a navigation made after it was asked for | `review-form.tsx:60-68` | `:93`, `:44`, the wiring test | **Partly met.** A refresh already sent (QLT-01) and a navigation not yet committed (QLT-02) are open |
| Nothing typed in any row is lost | none for a refresh already sent | `:44` (flaky on mobile) | **Not proven** |
| A no-wait case with the person's timing at three widths | `:93` | CI, attempt 1 at all three widths | Runs, but does not observe the refresh (QLT-03) |
| No wait, budget or time-out change (DL-404) | `REFRESH_QUIET_MS = 300` unchanged | wiring test | Met |
| The island menu case, and #845's waits removed, still green | n/a | n/a | Open (QLT-06) |

## Previous Findings (re-review only)
n/a (round 1)
