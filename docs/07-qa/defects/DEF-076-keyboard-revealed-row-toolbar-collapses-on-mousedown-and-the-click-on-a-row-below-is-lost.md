# DEF-076: After a row of the parts tree gets keyboard focus (its toolbar shows under the name), the first mouse click on a row below it is lost: the toolbar collapses on mouse-down, the rows move up 42 px, and the click never reaches the link (type Product, client layout; found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.3C / 3D layout as redesigned by DEF-075 (AQP-418, PR #662): UX comment 12939 sections 1 to 3 ("hidden is the `sr-only` clip, the toolbar shows on the open row and on a row with visible focus", "hovering a row changes no row height"). FR-043 ("each action is reachable by mouse, keyboard and touch at 360, 768 and 1366 px, and a press on a row's name never triggers one"). **No AC is shown to fail**: the press does nothing (it does not trigger an action) and every action stays reachable; the person has to click again. |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6: a layout defect that leaves every action reachable; the same class and grade as DEF-075, the defect this design came from). Not a G8 blocker as Sev-3 (fixed before G8 or accepted in writing by master, section 6). |
| Priority | P3 (Jira Medium, label `sev-3`) |
| Type | **Product (client layout)** |
| Status | **CLOSED 2026-11-24 (qa-engineer): fixed by PR #673, `master` 7029f697 (rule P and guard P2); the closing proof is met (section "Verification on the fix" below).** Was: Open (new, 2026-11-24) |
| Jira / GitHub | [AQP-419](https://sankumar76.atlassian.net/browse/AQP-419) / [#667](https://github.com/sankumar76/Accucut-Quotation/issues/667) (labels: bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-076, agent-qa-engineer). Relates to AQP-418 (DEF-075), AQP-405 (3C), AQP-1 |
| Found by / date | qa-engineer, 2026-11-24 (the final review, DL-354 (1), by-hand check of the DEF-075 gaps, a click that timed out in Firefox and WebKit and then reproduced in Chromium) |
| Build / commit | `master` `1fe1581b` (H; the DEF-075 fix `ab3f45a7` is in it) |
| Environment | Playwright 1.65 on Windows 11 with Chromium, Firefox 1572 and WebKit 2388, `next dev` on a throwaway Postgres 17; invented data; 1366 x 768 with a mouse, and 768 x 1024, 360 x 800, 320 x 568 and 320 x 256 (400 % of 1280) with the same pointer events. Not a real phone. |

## Steps to Reproduce
1. Sign in as an Engineer; open an estimate in Draft with three Main Assemblies (use "Add main assembly" twice), rows 1, 2 and 3. At 360 px open the "Parts tree" drawer first.
2. Click row 3's name (it is the open row, its toolbar is under it).
3. Press the keyboard: Tab or Shift+Tab until the **link of row 1** has the keyboard focus ring (a row that is not open; its toolbar now shows under the name and every row below it has moved down by one toolbar line, 42 px at 1366 px).
4. With the mouse, press and release on the name of row 2 (a normal click; a 150 ms hold gives the same result).

## Expected Result
Row 2 becomes the open row (`aria-current="true"`), its toolbar shows under it, row 1's toolbar goes away.

## Actual Result
Nothing happens: row 3 stays open. On the mouse-down the focus moves to the link of row 2, the focus ring leaves row 1, row 1's toolbar goes back to the `sr-only` clip, and row 2 moves up 42 px (observed y 428 to 386 at 1366 px). The mouse-up is then over another element, so the browser sends no `click` to row 2's link. A second click, with no keyboard focus in the tree, works. No action is triggered, nothing is lost, and no message is shown.

## Evidence
`tests/e2e-qa/ff.qa.ts` (QA's throwaway file in the final-qa worktree, not committed; the steps above, run 2026-11-24):

```
chromium  KEYBOARD then human click on row 2 (hold 150 ms): row1 toolbar SHOWN | row 2 y before/after 428 386 | open row now: 3 (expected 2)   (x2)
chromium  KEYBOARD then fast click on row 2: open row now: 3 (expected 2)
firefox   KEYBOARD then human click on row 2 (hold 150 ms): row1 toolbar SHOWN | row 2 y before/after 428 386 | open row now: 3 (expected 2)   (x2)
firefox   KEYBOARD then fast click on row 2: open row now: 3 (expected 2)
CONTROL (mouse only, no keyboard focus): open row 2, then 3, as expected, in both
webkit    the short script did not reach the keyboard-revealed state (Tab moved the focus to a button, row 1 toolbar hidden), so it passed and proves nothing; the loss was seen once in WebKit in the longer script (row 2 `aria-current` null, its "+" still clipped)
```

The same loss was seen at 768, 360, 320 and 320 x 256 (400 % zoom) in Chromium (the "+" of the next row stayed in the clipped state: `aria-current` of row 2 `null`, `elementFromPoint` at its centre is the row's arrow cell). Intermittent in the long script (a click on a row after Tab presses), deterministic in the short one above.

## Suspected Area
`src/components/features/estimate-workspace/row-actions.tsx:42` (`HIDDEN_UNTIL_NEEDED`: `group-has-[:focus-visible]/row:not-sr-only`) with `src/components/shared/parts-tree-list.tsx:96` (`TOOLBAR_SLOT`, a grid row that takes 42 px only while the toolbar shows). The reveal is tied to the focus ring, so a pointer press that moves the focus changes the layout before the mouse-up. Not a test fault: the same thing happens with a hold of 150 ms.

**For the ux-expert (design is theirs).** Options: keep the keyboard-revealed toolbar's 42 px reserved while a pointer is down (for example reveal on `:focus-visible` only while no pointer press is in progress, or remove the toolbar from the layout flow when it shows because of focus alone and let it overlay the next row's top gap), or reveal it on the row's `focus-within` only after a key press and hide it on `pointerdown` on another row without moving layout until the `click`. The rule to state: a pointer press on a row's name is never lost because another row's toolbar went away.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Design (ux-expert) | ux-expert | 2026-11-24 | AQP-419 comment 13032 (rule P, rule P2, acceptance checks 1 to 10) |
| Fixed | developer | 2026-11-24 | PR #673, squash `master` 7029f697 (head of record `1a4ae9ea`, run of record 45342651664) |
| Regression test added (an E2E case that gives row 1 keyboard focus, then clicks row 2: expected, row 2 is open; added to an existing tree case while the count freeze binds) | developer | 2026-11-24 | `tests/e2e/estimate-tree.spec.ts` inside the existing case "AQP-405 AC-4 (AQP-418)" (:677), plus `tests/unit/press-hold.test.ts` (29 tests) |
| Verified | qa-engineer | 2026-11-24 | Closing proof met; this file, "Verification on the fix"; push runs 45346776822 (CI) and 45346776855 (Windows package) `success` |

## Verification on the fix (qa-engineer, 2026-11-24)
Read, not re-run: the PR #673 body (Dev Record, plants, check-4 measurement), the spec on `origin/master` 7029f697, and the job logs of the two push runs on 7029f697 (ANSI stripped). The run of record 45342651664 is taken as the PR body reports it. By-hand look: not required by this file's proof and not done.

| Proof item | Result | Evidence |
|---|---|---|
| The E2E case gives row 1 the keyboard focus, then presses a row below it (1.1, with 1.2 open); that row opens | **Met** | `estimate-tree.spec.ts`, AQP-405 AC-4 case: `keyboardOnRow1` asserts the start state (row 1's toolbar taller than 1 px), then `pressWithoutShift` at 0 ms and 150 ms (link), handle and keyboard-opened menu; `settled` asserts `aria-current` on the pressed row, row 1's toolbar back to the clip, no menu |
| Rule P: no layout change between pointer-down and pointer-up | **Met** | `pressWithoutShift` compares the row's top at down and at up (check 1); plant A (the `useEffect` in `tree-panel.tsx` removed) fails the block at `row 1.1 does not move at the pointer-down` (PR body) |
| Checks 5 and 7 (drag-off; the keyboard holds nothing) | **Met** | same case (drag-off release; Tab from row 1's link to 1.1 collapses row 1 at once); unit tests of every release path and the 5 s ceiling |
| Check 4 and rule P2 (double click below the open row) | **Met** | same case: no `POST .../nodes`, no menu, no dialog, 1.1 stays open; plant B (`ROW_OPEN_SETTLE_MS = 0`) fails the case; PR body measurement: 10 of 15 second presses fell on a toolbar button without the guard, three did something |
| Three widths in CI | **Met** | AC-4 case passed on push 45346776822 at mobile 21.6 s, desktop 20.5 s, tablet 24.1 s, attempt 1, no retry line (and on the run of record at the three widths, per the PR body) |
| Push runs after the squash fully green | **Met** | CI 45346776822 `success` (all six jobs); Windows package 45346776855 `success`; both on 7029f697; 0 flaky lines and 0 failed in the CI log; E2E shards 1 to 4 `572 / 570 / 573 / 555 passed` (5 / 7 / 4 / 21 skipped); Stage 11 `669 files, 16,957 tests`; `/estimates/[code]` first load 190,089 B, headroom 9,911 B |

**Result: DEF-076 is closed.** No new defect.

Residual limits (not gaps in this file's proof; no ruling asked):
- CI runs Chromium only; the loss was first seen in Firefox and WebKit too. The fix is capture-phase pointer listeners and a CSS mark with no engine-specific branch, but no Firefox or WebKit reading of the fix was taken.
- Check 8 (touch) is covered by the same code path (primary pointer, button 0) and a unit test with a touch pointer; no touch viewport run and no real phone.
- Check 6 (handle drag) has no separate test, by design. Check 9 (#652) is untouched and covered by the existing tests.

## Records
Jira Bug AQP-419 (Done 2026-11-24); GitHub issue #667 (closed as completed 2026-11-24).
