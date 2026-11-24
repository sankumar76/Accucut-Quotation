# DEF-077: The Lead's and Admin's task queue table is wider than its region from 1024 to 1366 px; the Actions column (Reassign or change, the Downloaded chip of 7E, "Open to restore" of 7D) is not sticky and is cut off at the right edge (type Product, layout; OQ-UX-20 is the open question behind it; found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.7E (AQP-402, FR-111: the chip "shows on the Closed tab"), STORY-CR01.7D (AQP-401 AC-3: "Open to restore" in the Actions cell), and the older SCR-03 table. UX spec section 6.0 "Tables and cards" (a table with a row-actions column follows "Masters tables") and its pass line "every row's action buttons are visible without scrolling the table, at every viewport width from 768 to 1440 px" (DL-121; serves FR-085, NFR-016, GOAL-07 "every action reachable"). **OQ-UX-20 (open since v0.19) asks whether that rule applies to the Lead's queue; the spec's own stated assumption is "yes".** |
| Severity | **Sev-2 Major from 2026-11-24 (DL-357 trigger met by the keyboard focus check below; was Sev-3 Moderate)** (original grade: Sev-3 Moderate (qa-engineer, 2026-11-24; test plan section 6: a layout defect at a range of widths that leaves every action reachable, by scrolling inside the table's own region). Master may regrade it to Sev-2 if the pass line of section 6.0 is ruled to bind the queue (an AC that fails with a workaround). |
| Priority | **P2 (Jira High, labels `sev-2` on #670), per master DL-358 (A)** (was P3, Jira Medium, `sev-3`). A **G8 blocker** with lane priority over every Sev-3 and Minor item (DL-358 (C)); if it cannot merge by the freeze, master brings it to the delivery lead with options (DL-358 (4)). |
| Type | **Product (layout)**, with a **Requirement** question for the product-owner (OQ-UX-20: does section 6.0's pass line bind SCR-03?) |
| Status | **CLOSED 2026-11-24 (qa-engineer): fixed by PR #680, `master` efc6d7e2; DL-358 (5) (a) to (e) all met (section "Verification on the fix" below).** Was: Open, Sev-2 from 2026-11-24 (master DL-358); fix in lane 3 (`fix/AQP-420-queue-actions-visible`) to the ux-expert's design (AQP-420 comment 13044). Proof (a) to (e) of DL-358 (D). OQ-UX-20 closed "yes" (DL-357 (A)). **Scope check of 2026-11-24 (below): SCR-17 and the Engineer's list pass and do not join; the queue's Open tab also fails at 1440 px (22 px hidden).** |
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

## Corrected keyboard-focus check and scope check (qa-engineer, 2026-11-24; DL-358 (D); `origin/master` `1ab13781`)
Method as in the section above (real Tab presses, a reading 500 ms after each, nothing scrolled by hand, Chromium, `next dev` on Next 16.4.5 = DL-344, throwaway PostgreSQL 17, invented data, realistic names), with the hit test corrected. Per control: its box against the table region's edge and the viewport, the pixels hidden, and the hit test. A control is **whole** when its box lies inside the region and the viewport and the element at the centre of **every client rect** of the control is the control or inside it (`control.contains(elementFromPoint(...))`). The probe is `docs/07-qa/final-review-cr01-evidence/scripts/focus2.qa.ts`; the raw output is `docs/07-qa/final-review-cr01-evidence/output/focus-queue-scr17-engineer.txt` (770 lines).

**What was wrong with the first probe, stated exactly (DL-358 (3)(d)).** The first probe already tested `el.contains(top)`, but at the centre of the control's bounding box and with the point clamped into the viewport. (i) The task link `Q-9999-...` wraps onto two lines (two client rects), so the centre of its bounding box falls between the two line boxes and the hit test read false for it at every width, whole or not (`hitIsSelf` false on every TAB 1 line). The corrected probe tests the centre of each client rect: the task link reads `hitAllRects` true at every width, and the box-centre reading is kept in the output (`hitCentre`) only to show the artefact. (ii) **The two "another element at the centre" readings at 1280 px are withdrawn as evidence of overlap.** For "Reassign or change deadline" the centre (x about 1296) lies outside both the region (edge 1223) and the 1280 px viewport, so there is nothing to hit (the corrected probe reports `outside-viewport`). For "Open to restore" the centre (x 1269) lies outside the region (edge 1223) but inside the viewport: what is there is the page under the region, because the region clips the control. That is the same fault as everywhere else (the region clips the control), not another element covering it. **The partly-hidden readings themselves (box against region edge, pixels hidden) do not depend on the hit test and stand.**

### SCR-03 (the queue), Admin, one row per tab, on `1ab13781` (Chromium; scrollLeft 0 unless stated)
| Width | Region overflow (Open / Closed / Ignored) | Open: Reassign or change deadline (219 px) | Ignored: Open to restore (135 px) | Closed |
|---|---|---|---|---|
| 1440 | 38 / 0 / 0 px | **FAIL (new reading)**: box 1186 to 1405, region edge 1383, **22 px hidden**; the browser did not scroll (scrollLeft 0); hit true at the centre | PASS: 1232 to 1367 inside the edge 1383 | n/a (no focusable action) |
| 1366 | 112 / 27 / 43 px | **FAIL**: 1186 to 1405, edge 1309, **96 px hidden**, scrollLeft 0; hit true at the centre (1296, inside the region) | **FAIL**: 1202 to 1336, edge 1309, **27 px hidden** | n/a |
| 1280 | 198 / 113 / 129 px | **FAIL**: 1186 to 1405, edge 1223, **182 px hidden** (37 visible); centre outside the viewport | **FAIL**: 1202 to 1336, edge 1223, **113 px hidden** (22 visible); centre clipped by the region | n/a |
| 1024 | 454 / 369 / 385 px | PASS: the browser scrolled the region (scrollLeft 454); 732 to 951 inside the edge 967 | PASS: scrollLeft 385; 817 to 951 inside 967 | n/a |

The task link, the folder link and Copy path of the row are whole at all four widths on all three tabs (the first three stops of every row; no sticky column exists on the base, so nothing covers them). 5 of the 12 width and tab readings fail (1440 Open, 1366 Open and Ignored, 1280 Open and Ignored); 1024 passes only because Chromium scrolls the region when a control is wholly outside it, which is why DL-358 (D)(a) asks for the assertion at 1366 and 1280 and not at 1024. The Closed tab has no focusable row action (the Downloaded chip is text), so only its layout clipping (the section above) applies.

**New for DEF-077's scope (the orchestrator will pass it to lane 3):** the Open tab's "Reassign or change deadline" is also partly hidden at **1440 px** (22 px of 219; region overflow 38 px, scrollLeft 0). UX spec section 6.0's pass line runs 768 to 1440 px, and DL-357 (4) names 1440 for QA's by-hand reading. The fix's E2E at 1366 and 1280 (DL-358 (D)(a)) does not cover 1440, so a fix that cleared 1366 and 1280 only just would not be seen failing at 1440 there. Recommendation: the by-hand reading at 1440 stays as DL-358 (D)(d) says, and the E2E case also asserts at 1440 x 800 if the developer can add it within the same case. This is inside the same file and the same table (`queue-list.tsx`); it is the same defect, not a new Bug.

### SCR-17 (Fields and formulas), Admin: does not join DEF-077
67 rows (the seeded registry). Its row actions ("Edit formula for ...", "Insert after ...", "Delete ...") sit in the Formula cell, not in an Actions column. Tab from the region through every control until focus left the table: **151 stops (67 Insert after, 53 Delete, 31 Edit formula) at each of 1024, 1280, 1366 and 1440 px; all 151 are whole at every width** (box inside the region and the viewport, hit test true at the centre of every client rect, 0 px hidden; the nearest a control comes to the region's right edge is 42 px at 1366, 86 at 1280, 83 at 1024, 76 at 1440). The region does not scroll sideways at any of the four widths (overflow 0 px). **PASS at 1024, 1280, 1366 and 1440. SCR-17 does not join DEF-077.**

### The Engineer's task list (SCR-03, Engineer role), each tab as the Engineer who owns the task: does not join DEF-077
The Engineer has no Actions column (the manager columns, including Actions, are drawn for a Lead and an Admin only), so the row's controls are the task link, the folder link and Copy path: 3 stops per row, all **whole at 1024, 1280, 1366 and 1440 px on the Open, Closed and Ignored tabs** (12 readings, 0 px hidden, hit test true at every client rect; the nearest control is 16 px from the region's edge). Region overflow is 0 px at 1280, 1366 and 1440; at **1024 px it is 6 / 18 / 21 px (Open / Closed / Ignored)**: some cell content is a few pixels wider than the region, and no control is cut off. Observation only, for the ux-expert (section 6.0's pass line concerns row actions, which this list has none of); not a finding against DEF-077 and no Bug. **PASS at all widths on all tabs. The Engineer's list does not join DEF-077.**

### Result for the orchestrator and lane 3
- DEF-077 priority row changed to P2 (this file); Jira AQP-420 and #670 already carry High and `sev-2`.
- Scope: **no addition from SCR-17 or the Engineer's list**; **one addition inside the queue table: the Open tab at 1440 px** (22 px hidden, keyboard focus).
- Tell lane 3 before the fix PR's run of record (DL-358 (D)): the case should be able to fail at 1366 and 1280 on the base (it does: 96 and 182 px for Reassign, 27 and 113 px for Open to restore) and 1440 for Open (22 px).
- For the by-hand reading after the fix, QA reuses `focus2.qa.ts` unchanged (it reads every focusable control of the row, SCR-17 and the Engineer's list as well, at 1024, 1280, 1366 and 1440 on the three tabs).

## Verification on the fix (qa-engineer, 2026-11-24; DL-358 (5) (a) to (e))
Fix: PR #680, squash `efc6d7e2` on `master` (head of record `40302a14`, run of record 45336871656). Code read in the squash: `queue-list.tsx` `ManagerTable` (five columns; Customer, Folder and "Assigned by" are lines inside the Task and Engineer cells), `ui/table.tsx` (`actionButtons="wide"`, `--actions-w: 200px`, read by the sticky Actions column and by `scroll-padding-inline-end`; `TableActionsHead` may carry a visible word), `overdue-marker.tsx` (`OVERDUE_TINT_CLASS`, so the opaque cell repeats the row's tint). `git diff 40302a14 efc6d7e2` is empty: the squash has the head's tree. Against its parent `9697d6a5` the squash changes 7 files (560 insertions, 46 deletions).

| Part | Requirement (DL-358 (5)) | Result | Evidence |
|---|---|---|---|
| (a) | The focus assertion runs in the desktop project and, inside the same case, at 1280 | **Met** | `tests/e2e/queue-actions-visible.spec.ts`: the desktop project reads 1024, 1280, 1366 and 1440 px in one case per tab (`WIDTHS`); the tablet project reads 768 and the mobile project the 360 px card. The base fails at 1366 and 1280 (the plant, below, fails there). *Note:* the spec's window is 1300 px high (so that no step needs a page scroll), where DL-358 (a) names 1366 x 768 and 1280 x 800. The failure guarded is horizontal, so the height does not change what a width can show; QA's own reading below ran at 800 px high. Not a defect. |
| (b) | Tabs through every focusable control of a row on the Open and Ignored tabs; each inside the region and the window; `control.contains(hit)` at the centre of its box | **Met** | `expectEveryControlShown` (task link, folder link, Copy path, action: at least 4 controls, the action among them), used by the Open case, the Ignored case and the forced-wide case; the hit test is `coveredBy` at the centre of each client rect, with `contains`. 11 passes in the run of record (mobile 3, tablet 4, desktop 4; the forced-wide case is skipped on the 360 px card, as its code says). |
| (c) | Red before, green after, by a plant of the sticky and scroll-padding CSS (a script that throws unless each anchor occurs once) | **Met** | PR #680 body "Red then green": the base (tests of `24e08580` on the base source) fails with a right edge of 1410.875 against a limit of 967.5 (1024) and 1223.5 (1280), the chip and "Open to restore" outside the region, "the Actions cell is sticky: Expected sticky, Received static", and the Tab walk's hit test. The plant (revert `sticky right-0` in `STICKY_ACTIONS` and `scroll-pe-(--actions-w)` in `Table`) fails **4 of 4** cases on the final head with the assertions printed per width (1024 / 1280 / 1366 / 1440): the Actions column not at the region's edge (1738 and 1482 px), "Reassign or change deadline" right edge 2693 against 967.5 / 1223.5 / 1309.5 / 1383.5, "nothing covers the action" (nothing at 2605,802 and 2605,634), "the Actions cell is sticky" and "the Actions heading is sticky" (12 each). The plant is not in any commit. |
| (d) | QA's by-hand reading on the fix head at 1024, 1280, 1366 and 1440 px, Open, Closed, Ignored, `contains` hit test | **Met** | Below. |
| (e) | The rest of DL-357 (4): the pass line 768 to 1440 px on the three tabs with scrollLeft 0 (else sticky and opaque); axe clean; `/queue` first load before and after; the fix PR's run of record and the first `master` push all fully green | **Met** | The spec passes at 768 (tablet), 1024, 1280, 1366, 1440 (desktop) and 360 (mobile card) in the run of record, axe clean at each project's own width. First load `/queue` 193,348 B (base, push 45319179466) to **193,674 B** (headroom 6,326 B of 200,000; +326 B); `/estimates/[code]` 189,452 to 189,479 B. Run of record 45336871656: `success`, `run_attempt` 1, shards 572 / 570 / 573 / 555 passed (5 / 7 / 4 / 21 skipped), **0 flaky, 0 failed**, Stage 6 11,115 passed. **First `master` push after the merge: CI 45341274136 `success` (attempt 1; shards 572 / 570 / 573 / 555 passed, 5 / 7 / 4 / 21 skipped, 0 flaky, 0 failed; Stage 6 11,115 and Stage 11 16,928 passed; `/queue` 193,674 B) and Windows package 45341274129 `success` (attempt 1).** |

### (d) The by-hand reading
Conditions: `efc6d7e2`, Chromium 1.65 on Windows 11, `next dev` (port 3377), throwaway Postgres 17, invented data; Lead and Engineer renamed to short names ("Kiran Bose", "Priya Nair", "Arun Rao", "Meena Iyer") as in the base reading; the Open task's deadline moved into the past (so the sticky cell carries the overdue tint); window 800 px high; region `scrollLeft` 0, set before each reading; nothing scrolled by hand in the 24 natural readings. Probe `docs/07-qa/def077-verification-evidence/scripts/verify.qa.ts` (output `output/verify-queue.txt`). For each role, width and tab it reads (1) every control of the row, the whole Actions cell, the Downloaded chip and the word "Closed" against the region's inner edges, with the `contains` hit test at the centre of every client rect; (2) the Actions cell and heading: `position` and an opaque background; (3) any focusable control outside the Actions cell that reaches under it; (4) axe (the suite's own tags); (5) a Tab walk from the region, 500 ms after each press, each control inside the region and the window with the hit test true at every client rect.

| Width (px) | Tab | Admin | Lead |
|---|---|---|---|
| 1024 | Open | overflow 0, 0 outside, 0 covered, sticky and opaque, 4 Tab stops whole, axe clean | same |
| 1024 | Closed | same (the chip and "Closed" inside; 3 Tab stops whole, none is a row action) | same |
| 1024 | Ignored | same (4 stops whole, "Open to restore" last) | same |
| 1280 | Open, Closed, Ignored | same as 1024 on each tab | same |
| 1366 | Open, Closed, Ignored | same as 1024 on each tab | same |
| 1440 | Open, Closed, Ignored | same as 1024 on each tab | same |

**24 of 24 readings (2 roles x 4 widths x 3 tabs) pass.** The region's overflow is 0 px; every row action and the whole Downloaded chip lie inside the region with scrollLeft 0; the Actions cell and heading are sticky and opaque; nothing to their left reaches under the Actions column; all 88 Tab stops (11 for each of the 8 role and width pairs: 4 + 3 + 4) are whole with the hit test true; axe is clean in all 24. On the base the same rows read 112 / 198 / 454 px of overflow (Open) and 96 and 182 px of "Reassign or change deadline" hidden at 1366 and 1280 px (this file, above): the fix removes the symptom at every width, not only at the ones the spec reads.

**Forced-wide table** (the sticky guarantee: a long name widens the table; `min-width: 2400px` on the table; Admin; Open and Ignored tabs; 4 widths = 8 readings): region overflow 1322 to 1738 px; the Actions cell ends at the region's right edge (within 0.5 px) at scrollLeft 0 and again at the region's end; it is opaque; the action is whole and nothing covers it; the Tab walk (4 stops) is whole at every width, with the browser's own focus scroll only. **8 of 8 pass.**

**Masters table spot-check (UX spec 6.0, the `ui/table.tsx` change):** SCR-14 Users, Admin, at 1024, 1280, 1366 and 1440 (`masters.qa.ts`, `output/verify-masters.txt`): 8 rows, 24 row actions, 0 outside the region, 8 of 8 cells sticky and opaque, heading "Actions" **156 px wide** (the 3-button width, as before), ending at the region's right edge, region overflow 0, 22 Tab stops whole, axe clean: **4 of 4 pass, no regression.** SCR-17 (Fields and formulas, 67 rows): region overflow 0 and the first 24 Tab stops whole at the four widths (its last column is "Formula", not a sticky Actions column, as on the base). The suite's own masters guards also passed: `masters-table-actions.spec.ts` 62 of 62 and `aqp-234-qa.spec.ts` 30 of 30 in the run of record, and `masters-table-actions.spec.ts` 62 of 62 on the push.

**Result: DL-358 (5) (a) to (e) are all met. DEF-077 is closed.** No new defect. Observation (not a defect): the pass line is read with short names; with a long name the queue scrolls inside its own region and the Actions column stays at the right edge (the forced-wide readings), which is the design.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| OQ-UX-20 answered | product-owner | 2026-11-24 | closed "yes" (DL-357 (A)) |
| Design | ux-expert | 2026-11-24 | AQP-420 comment 13044 |
| Fixed | developer | 2026-11-24 | PR #680, `master` efc6d7e2 |
| Regression test added | developer | 2026-11-24 | `tests/e2e/queue-actions-visible.spec.ts`, `tests/unit/tasks/queue-actions-column.test.ts` |
| Verified | qa-engineer | 2026-11-24 | DL-358 (5) (a) to (e) met; this file, "Verification on the fix"; push runs 45341274136 and 45341274129 `success` |

## Records
Jira Bug AQP-420; GitHub issue #670.
