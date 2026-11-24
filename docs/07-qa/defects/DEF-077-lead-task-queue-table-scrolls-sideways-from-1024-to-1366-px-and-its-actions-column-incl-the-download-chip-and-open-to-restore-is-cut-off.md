# DEF-077: The Lead's and Admin's task queue table is wider than its region from 1024 to 1366 px; the Actions column (Reassign or change, the Downloaded chip of 7E, "Open to restore" of 7D) is not sticky and is cut off at the right edge (type Product, layout; OQ-UX-20 is the open question behind it; found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.7E (AQP-402, FR-111: the chip "shows on the Closed tab"), STORY-CR01.7D (AQP-401 AC-3: "Open to restore" in the Actions cell), and the older SCR-03 table. UX spec section 6.0 "Tables and cards" (a table with a row-actions column follows "Masters tables") and its pass line "every row's action buttons are visible without scrolling the table, at every viewport width from 768 to 1440 px" (DL-121; serves FR-085, NFR-016, GOAL-07 "every action reachable"). **OQ-UX-20 (open since v0.19) asks whether that rule applies to the Lead's queue; the spec's own stated assumption is "yes".** |
| Severity | **Sev-2 Major from 2026-11-24 (DL-357 trigger met by the keyboard focus check below; was Sev-3 Moderate)** (original grade: Sev-3 Moderate (qa-engineer, 2026-11-24; test plan section 6: a layout defect at a range of widths that leaves every action reachable, by scrolling inside the table's own region). Master may regrade it to Sev-2 if the pass line of section 6.0 is ruled to bind the queue (an AC that fails with a workaround). |
| Priority | P3 (Jira Medium, label `sev-3`). Sev-3: fixed before G8 or accepted in writing by master (section 6). |
| Type | **Product (layout)**, with a **Requirement** question for the product-owner (OQ-UX-20: does section 6.0's pass line bind SCR-03?) |
| Status | **Open** (new, 2026-11-24) |
| Jira / GitHub | [AQP-420](https://sankumar76.atlassian.net/browse/AQP-420) / [#670](https://github.com/sankumar76/Accucut-Quotation/issues/670) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-077, agent-qa-engineer). Relates to AQP-402, AQP-401, AQP-1 |
| Found by / date | qa-engineer, 2026-11-24, while looking at the Closed tab chip at 1366 px (the final review) |
| Build / commit | `master` `1fe1581b` (H) |
| Environment | Chromium 1.65 on Windows 11, `next dev`, throwaway Postgres 17, invented data; Lead and Engineer renamed to realistic short names ("Kiran Bose", "Priya Nair") so the table is not widened by test names; the side menu (248 px) is shown from 1024 px. |

## Steps to Reproduce
1. Sign in as a Lead. Have one task in each of Open, Closed (Quoted, downloaded once) and Ignored.
2. Open `/queue` at 1366 x 768, then 1280 x 800, then 1024 x 768, each tab in turn.
3. Read the Actions column (the last one).

## Expected Result
Every row's action (Reassign or change, the Downloaded chip with its last person and time, "Open to restore") is visible without scrolling the table (section 6.0 pass line), or the Actions column stays at the right edge (sticky) while the rest scrolls.

## Actual Result
The table region scrolls sideways and the Actions column scrolls away with it (`position: static` on the `th` and `td`). Measured (scroll width minus client width of the table's region; the page itself never scrolls sideways):

| Tab | 1366 px | 1280 px | 1024 px | What is cut off |
|---|---|---|---|---|
| Open | 112 px | 198 px | 454 px | "Reassign or change" button spans x 1186 to 1405, the region ends at 1309 (1366 px): 96 px of a 219 px button is hidden |
| Closed | 18 to 27 px | 104 to 113 px | 360 to 369 px | the Downloaded chip ends at 1311 against the region edge 1309 (1366 px) and is mostly out of view at 1280 px (screenshots `closed-real-1280.png`: "Clos", a chip stub and "Last / Kiran / 2026") |
| Ignored | 43 px | 129 px | 385 px | "Open to restore" spans 1202 to 1336 against 1309 |

At 768 px and 360 px the table becomes the shorter table and the cards, and the chip is whole (`chipClipped: false`). The Open-tab overflow is older than CR-01 (the 8-column table, `git show 242c21f7:src/components/features/queues/queue-list.tsx`); CR-01 adds a wider Actions cell on Closed (7E chip with person and time) and a new "Open to restore" link on Ignored (7D), so the marker the customer asked for (CR-01 item 7c, "shows on the Closed tab") is the part a Lead on a 1280 px laptop does not see until they scroll the table.

## Evidence
`tests/e2e-qa/closed.qa.ts` (QA's throwaway file in the final-qa worktree, not committed), output lines `CLOSED chip at <w>px` and `TAB <tab> at <w>px`; screenshots `qa-out/closed-real-1366.png`, `-1280.png`, `-1024.png` in the final-qa worktree. An earlier QA measurement of the same table is in `docs/07-qa/AQP-123-evidence/` ("the other delivered tables, measured, for #134 and OQ-UX-20").

## Suspected Area
`src/components/features/queues/queue-list.tsx` (the table, the Actions column), `src/components/features/queues/overdue-marker.tsx`; the masters-table pattern (`sticky right-0` on the Actions cells, wrapping headings) that DEF-021 / AQP-234 applied to the masters and Users. Design is the ux-expert's: the options are the masters pattern (sticky Actions, wrapping headings), dropping a column below 1440 px (the Folder column already drops below 1024 px), or putting the chip under the task code.

## Keyboard focus check for DL-357 (qa-engineer, 2026-11-24; H 1fe1581b, Chromium, `tests/e2e-qa/focus.qa.ts` in a second throwaway worktree)
Tab from the row's task link through each row's controls in the Open, Closed and Ignored tabs as the Admin (realistic names), reading 800 ms after each Tab; the browser's own focus scroll counts and nothing was scrolled by hand. Whole means inside the table region and the viewport.

| Width | Open: Reassign or change deadline | Ignored: Open to restore | Closed |
|---|---|---|---|
| 1366 px | **FAIL**: region not scrolled (scrollLeft 0); control x 1186 to 1405, region edge 1309; 96 of 219 px hidden | **FAIL**: x 1202 to 1336; 27 of 134 px hidden | n/a |
| 1280 px | **FAIL**: region edge 1223; 182 px hidden (37 px visible) | **FAIL**: 113 px hidden (21 px visible) | n/a |
| 1024 px | PASS: the browser scrolled the region (scrollLeft 454), whole | PASS: scrollLeft 385, whole | n/a |

Closed tab: no row action is focusable (the Downloaded chip is text, not a control), so focus-not-obscured does not apply to it; its clipping is the layout point above. Cause: Chromium scrolls the region on focus only when the control is entirely outside it; at 1366 and 1280 px the control starts inside the region, is partly visible, and the browser does not scroll. **Result against DL-357: the focused action is still partly hidden at the region's edge at 1366 and 1280 px, so the trigger is met and the defect becomes Sev-2 the same day (master's rule).** Nuance for master: WCAG 2.2 SC 2.4.11 (AA) strictly fails only when the focused control is entirely hidden; "partly hidden" is 2.4.12 (AAA). Output: `docs/07-qa/final-review-cr01-evidence/output/focus-queue.txt`.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| OQ-UX-20 answered | product-owner | | |
| Design | ux-expert | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-420; GitHub issue #670.
