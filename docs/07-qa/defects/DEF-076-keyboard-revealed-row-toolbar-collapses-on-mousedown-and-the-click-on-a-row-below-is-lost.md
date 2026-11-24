# DEF-076: After a row of the parts tree gets keyboard focus (its toolbar shows under the name), the first mouse click on a row below it is lost: the toolbar collapses on mouse-down, the rows move up 42 px, and the click never reaches the link (type Product, client layout; found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.3C / 3D layout as redesigned by DEF-075 (AQP-418, PR #662): UX comment 12939 sections 1 to 3 ("hidden is the `sr-only` clip, the toolbar shows on the open row and on a row with visible focus", "hovering a row changes no row height"). FR-043 ("each action is reachable by mouse, keyboard and touch at 360, 768 and 1366 px, and a press on a row's name never triggers one"). **No AC is shown to fail**: the press does nothing (it does not trigger an action) and every action stays reachable; the person has to click again. |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6: a layout defect that leaves every action reachable; the same class and grade as DEF-075, the defect this design came from). Not a G8 blocker as Sev-3 (fixed before G8 or accepted in writing by master, section 6). |
| Priority | P3 (Jira Medium, label `sev-3`) |
| Type | **Product (client layout)** |
| Status | **Open** (new, 2026-11-24) |
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
| Design (ux-expert) | ux-expert | | |
| Fixed | developer | | |
| Regression test added (an E2E case that gives row 1 keyboard focus, then clicks row 2: expected, row 2 is open; added to an existing tree case while the count freeze binds) | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-419; GitHub issue #667.
