# DEF-136: SCR-07 at 1366 px: the Parts tree rows run the Sl. No into the name and have no count or figure line; the stage cards are squeezed beside the tree and the box (conformance; Product; Sev-4 proposed; Jira AQP-493, GitHub #814)

| Field | Value |
|-------|-------|
| Story / AC | SCR-07 Cost details (DEF-113, AQP-469, which closes with this difference filed here); the SCR-07 mock-up. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation from the mock-up) |
| Status | **Open (new), 2026-11-27.** **Graded by master 2026-11-27 (DL-446, records-u 1cb3fcbc): Sev-4.** Goes into lane 3's polish PR if cheap; otherwise one G8 line for the delivery lead's explicit acceptance, with the fix in the first update. Owner lane: lane 3 for the polish PR, else the G8 acceptance line. |
| Jira / GitHub | [AQP-493](https://sankumar76.atlassian.net/browse/AQP-493) / [#814](https://github.com/sankumar76/Accucut-Quotation/issues/814) (labels bug, sev-4, ai-delivery, final-review; Jira also aiid-DEF-136, agent-qa-engineer). Relates to DEF-113, DEF-114, DEF-137, AQP-1. Searched first: JQL on `aiid-DEF-136` and a GitHub search for the same words: nothing earlier. |
| Found by / date | The ux-expert's hands-on re-check pass 2 (N-4) (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); logged by qa-engineer, 2026-11-27 |
| Build / commit | Production build of `master` `d5e352f9`, a throwaway database with invented estimates, scripted Playwright at 1366 px (the ux-expert's pass; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open SCR-07 (Cost details) for a row of a calculated estimate as a Lead, at 1366 px; read the Parts tree rows and the column layout of the box and the six stage cards.

## Expected Result
As the mock-up: the Sl. No and the name separated (the SCR-05 tree's row look); the count and figure line under each row (`2 nos 0.00` in the mock-up), for Lead and Admin only (NFR-002 unchanged); the box above the stages in one wide column.

## Actual Result
The tree's rows run the Sl. No into the name (`1Control cabinet assembly`, `1.1Base frame`) and carry no count or figure line. The box and the six stages sit side by side after the tree, so the stage cards are squeezed to about 360 px and their formulas wrap. Screenshots `w1366\head-scr07.png` (pass 2) and `w1366\mock-SCR-07.png` (pass 1).

## Binding and proof (proposed)
The three points read as the mock-up at 1366; the existing assertions kept; axe clean; first load stated against 193,500 B; the ux-expert's hands-on check repeated.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-493 and GitHub issue #814, created 2026-11-27 and cross-linked. Related: DEF-113, DEF-114, DEF-137, AQP-1; the ux-expert's pass 2 (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); test plan 0.3.102.

## The ux-expert's ruling mapped (qa-engineer, 2026-11-27; test plan 0.3.106)
Ruling: `docs/03-ux/rulings/scr07-layout-2026-11-28.md` (records-u 3d84ddba; ux-expert, checks L7-1 to L7-8); part 2. **The designed layout at 1366 px is two columns, not three:** the tree (the SCR-06 review tree, `ReviewTree` and `PartsTreeList`) is the **320 px** left column (the mock-up's inline `--tree-w: 328px` is withdrawn for the token); the right column (**710 px** at 1366, one card) holds from top to bottom the label and title, **the box above the stages, full width of the column**, then the six stage cards (about 678 px each, all open). From 1280 px the gap is 24 px, from 1024 to 1279 px it is 16 px (the stages then about 590 to 650 px wide). The tree card is sticky below the top bar with its own scroll, no resize handle, no toolbar.
**Each tree row:** first line arrow cell, 24 px kind tile, the Sl. No in mono 12 px, **an 8 px gap before the name**, the name (wraps, never cut); **second line, right-aligned under the name: the count for the whole order (muted) then the row's own BG in bold, two decimals, no currency sign (`2 nos  3,583.99`); `Cleared` in italic with the count kept while the figures are cleared; a dash while not calculated;** no dollars and euros line and no `View cost details` link on this screen. **The open row** (`aria-current="true"`): a `--surface` (white) fill on the `--surface-2` panel (**corrected 2026-11-27; the ruling first said `--surface-2`**), a 4 px `--primary` bar at its start, the name bold; the pink chip is withdrawn. Not drawn: the mock-up's status ticks, the resize handle, any toolbar. Head `Parts tree` with `12 rows` at the right; foot: the kinds legend and the SCR-06 sentence once.
**Staging (the ux-expert's, in #820 with DEF-137):** **2a (about 1 hour): two columns, the box moves above the stages, the 8 px gap after the Sl. No. 2b (1 to 3 hours): the second line, the `Cleared` and dash states, the open-row look.** **If 2b does not fit, it becomes ONE G8 line for the delivery lead's explicit acceptance (Sev-4, the figures are one click away on SCR-06): 'SCR-07's tree rows show no count and figure (the mock-up shows them); the Lead reads them on SCR-06.'** QA keeps that line in the G8 list if lane 3 reports 2b out.
**Checks mapped:**
| ID | What QA reads | Needs |
|----|---------------|-------|
| L7-3 | At 1366 the tree is a 320 px left column and the right column 710 px (±2 px at this window); the box is above the first stage card and as wide as the stage cards; no stage card is narrower than 600 px | 2a; an E2E case measuring the boxes at 1366 |
| L7-4 | At 1366 the Sl. No and the name of every tree row: the name's left edge at least 6 px right of the Sl. No's right edge | 2a |
| L7-5 | (if 2b is built) each row shows count and BG on a second line, right-aligned; cleared: `Cleared` in italic with the count; not calculated: a dash; no dollars, euros or `View cost details` in the tree | 2b |
| L7-6 | **(corrected 2026-11-27, ruling in records-u b088a074)** The open row has the `--surface` (white) fill on the `--surface-2` panel and the 4 px primary bar, the same as SCR-06's tree; no pink chip | 2b |
| L7-7 | At 1024 the two columns hold with a 16 px gap; the stages are at least 560 px wide | 2a |
| L7-8 | axe at 360, 768, 1366: no serious or critical finding; the cost-confidentiality scan green | existing stages |
**Proof (restated):** L7-3, L7-4 and L7-7 pass at attempt 1 (2a); L7-5 and L7-6 pass if 2b is built, otherwise the G8 line stands; the existing assertions kept; first load stated against 193,500 B (the ruling adds the figure line, so QA reads Stage 11b for `/estimates/[code]/costs/[slNo]` too); the ux-expert's hands-on check repeated; the DL-446 grade (Sev-4) stands for 2a done with 2b either way.

## Stage 2b left out of #820: the G8 line (qa-engineer, 2026-11-27; test plan 0.3.107)
Lane 3's #820 (head `9c7be482`) carries **DEF-137 (L7-1, L7-2) and DEF-136 stage 2a (L7-3, L7-4, and QA's measured L7-3 case)**. **Stage 2b (the count and BG second line, L7-5, and the open-row look, L7-6) is left out:** it would need a whole-estimate costs read on SCR-07 and would reverse QLT-789-01's guards (the orchestrator's account). Per the ux-expert's ruling (`scr07-layout-2026-11-28.md` section 3) it becomes **one G8 line, Sev-4, for the delivery lead's explicit acceptance:** **"SCR-07's tree rows show no count and figure (the mock-up shows them); the Lead reads them on SCR-06."** Registered in the test plan section 7.1 D as **G8-C-SCR07FIG**. Open: the ux-expert confirms the open row's fill (`--surface` against `--surface-2`); L7-6 is read against that answer. DEF-136 stays Sev-4 (DL-446); it closes on 2a's proof (L7-3, L7-4, L7-7 at attempt 1, the hands-on check) **plus the delivery lead's written acceptance of the line at G8**; if the delivery lead does not accept it, 2b is built before G8.

## L7-6 corrected; the line accepted by the ux-expert (qa-engineer, 2026-11-27; test plan 0.3.108)
The ux-expert confirmed the open row's fill: **`--surface` (white) with the 4 px primary bar, as #820 builds it and as SCR-06's accepted tree draws it**; the ruling and L7-6 are corrected in records-u b088a074. L7-6 is read as that. **The ux-expert also accepts G8-C-SCR07FIG as worded** ("SCR-07's tree rows show no count and figure (the mock-up shows them); the Lead reads them on SCR-06."); the delivery lead's written acceptance at G8 is still needed.
