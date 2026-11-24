# QA Final Review, CR-01 (product-wide pass of CLAUDE.md section 9 item 3; DL-354 (1))

| Field | Value |
|-------|-------|
| Owner | qa-engineer (a fresh session; the push-run ledger is kept by the other QA session and is not repeated here) |
| Date | 2026-11-24 (UTC; 23 Nov evening local) |
| Head reviewed | `master` **1fe1581bb611f1b250c6f0e9ea010b11cb08392b** (H, after #663). `git ls-remote origin master` read the same SHA at the end of the run. Open PRs against `master`: #664 (DEF-071), #632 and #476 (Next 16.4.6, held, DL-344); none is in the review. |
| Inputs read | DL-354, DL-312, DL-337, DL-346 (decision log); test plan 0.3.34 sections 6 and 7.1; PRD 0.47 (FR-009, 010, 011, 013, 032, 034, 038, 040, 041, 042, 043, 044, 064, 065, 070, 102, 107, 109, 110, 111; NFR-002, 017, 018, 031, 032); ux-spec section 0.9, 6.0, SCR-10; Jira design comments AQP-343 12880, AQP-406 12939, AQP-401 12944; the 15 story PRs of CR-01 and their AC tables |
| Result | **No Sev-1 or Sev-2 defect found.** Three new Sev-3 defects (DEF-076, DEF-077, DEF-078). The three by-hand items of DEF-075 pass. NFR-002 holds on every Engineer page and route read. axe finds 0 violations on every changed screen at 360, 768 and 1366 px. |

## 1. Summary

| Area | Result |
|---|---|
| CR-01 journeys across Engineer, Lead and Admin (assign, estimate, calculate, approve, mark as quoted, download, unlock, ignore, Engineer's read-only view, restore) | Pass at 360, 768 and 1366 px in Chromium, with two new defects in the screens around them (DEF-077, DEF-078) |
| Parts tree: add, naming, move, delete, toolbar under the name | Pass at 1366 and 768 px by hand; at 360, 320 and 320 x 256 build-up and the level-4 row pass, the move and delete flows were not run by hand at phone width. One new defect (DEF-076) |
| Test plan 7.1 F by-hand items (DEF-075 gaps 1 and 2, `:has()` in Firefox and WebKit) | **All three pass** (section 4.2) |
| Engineer cost confidentiality (NFR-002) | Pass: 0 leaks in 32 Engineer reads (pages and JSON) over Quoted and Ignored, and every cost, export and mutating route is 403 (section 4.3) |
| Accessibility (WCAG 2.2 AA) on the changed screens | axe 0 violations on 20 screen states at three widths; no sideways page scroll anywhere; focus and live regions as designed; open points in section 4.4 |
| Excel file name and Downloaded marker | Pass (section 4.5) |
| Traceability of the CR-01 ACs | Refreshed: 131 AC rows of 13 stories (and the DEF-075 and DEF-040 fixes), every named test file exists at H; the rows with no test file are named and have a CI gate or a by-hand check (section 6) |

**Defects: Sev-1 0, Sev-2 0, Sev-3 3 (DEF-076 AQP-419 #667; DEF-077 AQP-420 #670; DEF-078 AQP-421 #671), Sev-4 0 logged.** Observations that are not Bugs are in section 5.2 and the issues for other roles in section 7.

## 2. Scope and environment

**Scope.** Product-wide, by hand and exploratory, on the CR-01 journeys and how they meet the older ones; not a repeat of the 242c21f7 regression, and not a read of CI (the other QA session keeps the push ledger and the final regression on the frozen head will read CI job by job).

**Environment (all invented data; no secret or real personal data).** A new detached throwaway worktree of 1fe1581b, `C:\Users\sanku\Documents\Accucut - Quotation App\.claude\worktrees\final-qa`, with its own `npm ci`; a throwaway PostgreSQL 17 container (compose project `finalqa`, `finalqa-db-1`, 127.0.0.1:55432) migrated to the head (`prisma migrate deploy`, all migrations to `20261123160000_estimate_quoted_ignored`), the field registry seeded, the first Admin made by `bootstrap-admin`, then the E2E harness's invented users and canary masters; `next dev` 16.4.5 on port 3300 (a development server: timings here are not NFR evidence); Node 24.19.0 (the project asks for 22.12 or later; CI uses 22); Playwright 1.65.0 with Chromium, Firefox 1572 and WebKit 2388 (the last two installed for this run into the user's Playwright cache). Viewports: 360 x 800, 768 x 1024, 1366 x 768 (the three test widths), 320 x 568, and 320 x 256 as the CSS size of 400 % zoom of 1280 x 1024. Pointer events are Playwright's (mouse, touch emulation, keyboard); no real phone.

**How.** QA's throwaway Playwright scripts (not product tests, not for CI) use the project's E2E support helpers to make worlds and then drive and measure the pages. They, the config and the output lines are kept in `docs/07-qa/final-review-cr01-evidence/` (`scripts/`, `output/`, `screens/`).

## 3. Checks done and not done

| # | Check | Done | Where |
|---|---|---|---|
| 1 | Assign task (SCR-04): fields, error summary, 80 / 81 subject, short name read-out, create; Customers (SCR-12) short name 11 characters | Done at 360, 768, 1366 | 4.1 |
| 2 | Estimate workspace (SCR-05) as Engineer: customer, short name, subject read-only; compact layout; Prepared read-only | Done at 3 widths | 4.1 |
| 3 | Review (SCR-06) as Lead and Admin: Prepared, Approved, Quoted, Ignored; Change customer; read-only tree; SCR-07 cost details | Done at 3 widths | 4.1 |
| 4 | Mark as quoted, Unlock of a Quoted estimate, Cancel approval of a Quoted estimate (Admin) | Done | 4.1 |
| 5 | Ignore and Restore by the UI (Lead) and by the API (Admin: blank, 500, 501, hidden character, twice); Ignored tab for Lead and Engineer; Engineer's read-only page | Done | 4.1 |
| 6 | The Ignored freeze: 10 mutating routes by hand as Admin | Done (10 of 12) | 4.1 |
| 7 | Tree: add by kind, naming, move up, delete with confirmation, centre presses, keyboard | Done at 1366 and 768; partly at 360 / 320 / 320 x 256 | 4.2 |
| 8 | Test plan 7.1 F (a), (b), (c) | Done | 4.2 |
| 9 | Excel export: file name, header, saved file read back, marker after two downloads | Done at 3 widths | 4.5 |
| 10 | Engineer cost confidentiality, pages and JSON, Quoted and Ignored | Done | 4.3 |
| 11 | axe (tags wcag2a, wcag2aa, wcag21aa, wcag22aa), sideways scroll, small targets, focus, live regions | Done on the changed screens | 4.4 |
| 12 | Rename: "Quotation Portal" on 8 routes, titles, About sentence, sign-in tags | Done (desktop and phone) | 4.5 |
| 13 | Traceability refresh of CR-01 | Done | 6 |
| **Not done** | (a) Real phone, screen reader, Windows high contrast (human steps, test plan 12; G). (b) Excel desktop open of the downloaded file (human). (c) Cancel approval and Remove price on an Ignored RFQ with a valid step-up body (the manifest-driven test of 7D covers every route; QA's bodies were refused by the validator first). (d) Touch drag at 360 (covered by `estimate-tree.spec.ts:805` in CI, not repeated). (e) The tree's move and delete at 360 / 320 / 320 x 256 by hand. (f) A keyboard-only Ignore then Restore by hand (the E2E case of 7D does it at 3 widths). (g) Firefox and WebKit on the journeys (only the tree was run; the nightly matrix runs the rest). (h) Isolated check of the "menu open" `:has()` clause in WebKit. (i) First-load sizes and timings (development server; CI Stage 11b and the nightly own them). (j) The Windows package and install (not CR-01). | | |

## 4. Results

### 4.1 CR-01 journeys

**Assign (SCR-04, item 6).** Fields in order: Engineer, Customer Name, Customer Short Name (read-only output), Network folder path, Deadline date, Deadline time, Title, Subject (project name), Notes (optional). An empty submit gives "6 things need fixing before this task can be assigned" with one line per field and the focus on the first field. A subject of 81 characters gives "Keep the subject under 80 characters." (once in the summary, once under the field); 80 is accepted; the short name shows the master's value as soon as the customer is chosen. A valid task is created ("Task Q-2026-0001 assigned to ...", code in the FR-041 shape). Customers: the form has Customer name, Short name, Phone, E-mail, Address; 11 characters give "Keep the short name under 10 characters." No overflow, axe 0 at 360, 768 and 1366.

**Engineer's workspace (SCR-05).** Customer name, short name and subject are labelled text with no control; the Engineer's `PUT /estimates/{id}/customer` is 403 at all three widths. Compact layout: field height 36 px at 1366 px with a fine pointer and 44 px at 768 and 360 px; `.is-compact` is on the root. On a Prepared estimate all 21 inputs are read-only and the action bar shows no Save or Calculate; axe 0.

**Lead and Admin (SCR-06, SCR-07).** Actions by status, read from the page: Prepared: Download, Approve and lock, Ignore RFQ; Approved: Download, Unlock, Mark as quoted, Ignore RFQ (Admin adds Cancel approval); Quoted: Download, Unlock (Admin adds Cancel approval); Ignored: Restore RFQ only (and Copy path). The tree on SCR-06 and SCR-07 has no row toolbar (0 `[data-row-actions]`). The Change customer dialog opens with focus on "Keep Canary-Customer-Alpha", axe 0.

**Mark as quoted (7C).** The dialog reads "Mark Q-... as quoted? Do this once the quote has been sent to <customer>. The status becomes Quoted, with your name and the time. This cannot be undone, except by Unlock." with the chip "Not downloaded"; axe 0; after the press the notice "Quoted on <date>, <time> IST by <person>. The quote was sent to <customer>. This is the last status; the estimate stays locked at the approved figures." has the focus. A second press is 409 `ESTIMATE_ALREADY_QUOTED`; a Quoted estimate cannot be ignored (409 `ESTIMATE_QUOTED_IS_FINAL`). **Unlock of a Quoted estimate** returns Draft (chip stays "Downloaded 2×"). **Cancel approval by the Admin on a Quoted estimate** returns Draft, the task is reopened, "Remove price" appears, Mark as quoted is then refused 409 `ESTIMATE_NOT_APPROVED`.

**Download marker (7E).** SCR-10 before a download: "Not downloaded". After one press of Download and one API download the SCR-06 header chip reads "Downloaded 2× Last downloaded by <person>, <date>, <time> IST" at all three widths. The SCR-10 chip is not redrawn by the press itself ("Not downloaded" 2.5 s after the file arrived); the code says it shows "the next time the page is opened" (`estimate-export.tsx`, observation 5.2 (1)). On the Closed tab the chip is in the Actions cell; see DEF-077 for its fit at 1024 to 1366 px.

**Ignore and Restore (7D).** The Ignore dialog (axe 0) refuses empty remarks with "Enter remarks. They are kept in the audit log."; the API refuses blank (422), 501 characters (422) and a zero-width joiner (422, the shared rule's sentence), accepts exactly 500, and a second Ignore is 409 `ESTIMATE_ALREADY_IGNORED`. After Ignore the focus is on the h1 and the polite status reads exactly "Q-... ignored. It is now in the Ignored tab."; the Lead's notice shows who, when (IST), the remarks with the line break kept and `<b>x</b>` as typed, "It was Draft when it was ignored. Restore puts it back as Draft.", with only "Restore RFQ" left. The Lead's and the Engineer's Ignored tabs show the dashed Ignored badge and the remarks (Engineer: no Actions column; intro words as 12944; four tabs Open, Closed, Overdue, Ignored; no overflow, axe 0 at 3 widths). The Restore dialog reads "It goes back to Draft, the status it had when it was ignored, and returns to <Engineer>'s Open queue. Nothing in the estimate changes." with "Keep it ignored" and "Restore RFQ" (axe 0); afterwards "Q-... restored. It is back as Draft, in Open." and the focus is on the h1; a second Restore is 409 `ESTIMATE_NOT_IGNORED`.

**The Engineer's read-only page.** All 24 controls of the part form are read-only and focusable (0 disabled), the only buttons are Copy path and the treatment drop-down, there is no action bar, typing into a field changes nothing and sends no PATCH, and the remarks show as text. **But the page still draws the status banner of the status underneath: DEF-078.**

**The Ignored freeze (Admin, by hand).** With an ignored RFQ: recalculate, approve, unlock, mark as quoted, change customer, export, tree add, tree move, change deadline and reassign are all 409 `ESTIMATE_IGNORED`. Cancel approval and Remove price were refused with 422 and 400 by the validator before the Ignored check (not probed with valid step-up bodies; section 3 not-done (c)). The Admin's `calculate` is 403 for every status (Engineer-only, not an Ignored effect).

### 4.2 Parts tree and test plan 7.1 F

**Tree functions (1366 px Chromium; the same at 768 px).** "Add main assembly" adds a top-level row; "+" on a Main Assembly offers Sub-Assembly, Part, Fastener; on a Sub-Assembly Part and Fastener; on a Part or Sub-part it adds a Fastener at once; a Fastener has no "+". Two Parts under one parent are both "Sub-part" (icon name), and when one is deleted the other is "Part" again. Move up of 1.1.2 renumbers the pair, the Fastener goes with its Part, and the announcement reads "Part renumbered to 1.1.1"; on the last sibling "Move down" is `aria-disabled` (observed on 1.1.2). The delete confirmation names the row and the rows below it ("Delete row 1.1? This also deletes the 3 rows under it, and everything typed into them. This cannot be undone." with "Delete 4 rows"); Escape or Cancel changes nothing; confirming announces "4 rows deleted" and renumbers. No sideways scroll after each step.

**Centre presses (DEF-075 check 1).** At 1366 px a mouse press at the centre of each of 7 rows (Main Assembly, Sub-Assembly, Sub-parts, a Fastener, level 4) selected the row, opened no menu or dialog and sent no mutating request. At 768 px the first five rows passed; rows 1.2 and 2 were behind the sticky bars at that scroll position and were not reached (a script limit). Geometry (check 2): the toolbar box never intersects the link box; every non-open row's toolbar is 1 x 1 px; buttons 36 x 36 px at 1366 px and 44 x 44 px at 768 and 360 px (check 4).

**7.1 F (a): tall tree, Tab and Shift+Tab to the last row's toolbar buttons. PASS.** With five rows and the last row's buttons reached forward from its link and backward from the bottom bar, each of Move, Add and Delete is fully in the viewport and is the top element at its centre (the sticky bottom bar starts at y 698 of 768 at 1366 px, the buttons end at 690): Chromium 1366 and 768 px, Firefox 1366 px, WebKit 1366 px. In the drawer at 320 x 568 and 320 x 256 the same, hit test OK (my "obscured by" flags there are the drawer's own container).

**(b) 320 px, then 400 % zoom (320 x 256), a level-4 row open. PASS.** Open row 1.1.1.1 (Fastener, level 4) at 360, 320 and 320 x 256: `scrollWidth` 360 / 320 / 320 equals `clientWidth`; toolbar 137 / 131 / 131 px wide, inside the viewport (right edge 272 / 266 / 266). Screenshot `screens/level4-w320.png`.

**(c) `:has()` reveal in Firefox and WebKit. PASS** for the open row (only the open row's toolbar shows: `1.1:SHOWN`, all others hidden) and for keyboard focus (a row that is not open shows its toolbar when its link or a button has the focus ring). Firefox also shows the toolbar of the open row while its "+" menu is open. The isolated "menu open" clause was not tested in WebKit (the row was open anyway).

**New Bug found by this check: DEF-076 (Sev-3).** After the keyboard has put the focus ring on one row, the first mouse click on a row below it is lost: the press moves the focus, the first row's toolbar collapses, the rows below move up 42 px, and the mouse-up is over another element, so no click reaches the link. Reproduced 3 of 3 in Chromium and Firefox (a 150 ms hold and a fast click), also at 768, 360, 320 and 320 x 256 in Chromium; the mouse-only control passes. Nothing is triggered and nothing is lost.

### 4.3 Engineer cost confidentiality (NFR-002)

An Engineer with an estimate that a Lead had approved at 48271.37 (calculated total 16,889,808.07, calculation ID, the Lead's name and e-mail as search tokens) read 16 paths while Quoted and 16 while Ignored (7 pages: the estimate, `/queue` and its Closed, Ignored and Open tabs, the export page, a cost-detail page; 9 JSON routes: form, tree, costs, export-summary, unlock-preview, tasks, tasks closed, tasks ignored, nodes). **0 hits in the Quoted reads** (no figure, no calculation ID, no person, none of the words "Downloaded", "Not downloaded", "Changed since download", "Quoted on", "marked as quoted by"). In the Ignored reads the only hit is the Lead's name in the Ignored notice, which is the design (12944 section 4: "ignored on ... by <name>"). `/costs`, `/export`, `/export-summary`, `/unlock-preview`, `/costs/1` and the pages for the export and cost detail are 403 for the Engineer; mark quoted, ignore, restore and change customer are 403. The Engineer's `GET /nodes` is 405 (no such read). No marker chip is on any Engineer page.

### 4.4 Accessibility

| Item | Result |
|---|---|
| axe 4.14 tags wcag2a, wcag2aa, wcag21aa, wcag22aa | **0 violations** on: SCR-06 Approved, Quoted, Ignored, Prepared; the quote, ignore, restore and change-customer dialogs open; SCR-07; SCR-10; queue Closed (Lead), Ignored (Lead and Engineer); SCR-05 Prepared and Ignored (Engineer); SCR-04 empty and with errors; Customers list and the dialog with an error; sign-in. Three widths for each (the Closed tab and the Engineer's Ignored tab included) |
| Reflow (1.4.10) | `scrollWidth` not above `clientWidth` on every screen above at 360, 768 and 1366 px, and with a level-4 tree row open at 320 px and 400 % |
| Keyboard, focus visible, not obscured (2.4.7, 2.4.11) | Tree toolbar: pass (4.2). After Mark as quoted the focus is on the notice; after Ignore and Restore on the h1; the Change customer dialog opens on its safe choice. Not re-run by hand: the keyboard-only Ignore then Restore (7D's E2E case) |
| Live regions (4.1.3) | Polite statuses read exactly as designed after Ignore, Restore and a tree move ("Part renumbered to 1.1.1", "4 rows deleted"); the in-flight line "Updating the parts. This takes a moment." appears while a move is on its way |
| Target size (2.5.8, NFR-017) | axe `target-size` finds nothing. Measured controls under 24 px: inline links only: "View cost details for <row>" 94 x 16 px on SCR-06 (all widths), the task-code link of the phone card on the Closed tab 139 x 18 px, the folder path link 361 x 22 px at 768 and 1366 px. The tree toolbar, dialogs, tabs and form controls are 36 px (fine pointer, 1024 px and wider) or 44 px. See issue for other roles 7 (3) |
| Dragging alternative (2.5.7) | The Move menu (Move up, Move down) exists and works by keyboard and pointer |
| Not done | Screen reader, real phone, Windows high contrast (human, test plan 12) |

### 4.5 Rename, Excel file name, marker

**Rename (items 2, FR-009, 010, 089).** On `/about`, `/`, `/queue`, `/assign`, `/masters/customers`, `/users`, `/account` and `/sign-in` the string "Quotation Portal" occurs 0 times in the HTML and every title ends "· Accucut RFQ Portal"; the header lockup is "ACCUCUT LASERS" over "RFQ Portal"; the About sentence reads "The Accucut RFQ Portal helps Accucut Lasers prepare, review and approve manufacturing cost estimates. Engineers enter part details, the portal does the calculation, and a Lead or Admin reviews and approves the estimate." with "Version No: 1.0" and the copyright line unchanged; `/sign-in` has `robots: noindex, nofollow`, an `og:title` and no `og:image`. The worksheet in the downloaded file is still named "Quotation" (the customer's layout, NFR-027; not a product name).

**File name (item 9, FR-071).** For the customer short name `2ed51d80b3` (the canary's) and the subject `Frame / Base: plate "A" <1>|2*3?` the download is `2ed51d80b3_Frame---Base--plate--A---1--2-3-_24-11-2026.xlsx`: each reserved character and each space is a hyphen, nothing is cut, the date is the IST date (24 Nov IST while it was 23 Nov in UTC), the SCR-10 card shows the same name, and the header is `attachment; filename="..."; filename*=UTF-8''...` (identical). The saved file read back with ExcelJS: one sheet, columns A to BO (67), the first row of headings starts "Sl. No, Part No., Part Model, Description", no kind column, no Quoted, Ignored or Downloaded word in any cell.

**Marker.** "Not downloaded" before; "Downloaded 2×" with the last person and time after two downloads, on SCR-06; unchanged by Mark as quoted and by Unlock. The amber "Changed since download" after a new approval is covered by `download-marker.spec.ts` and was not re-run by hand.

## 5. Defects and observations

### 5.1 Defects (Jira Bug, GitHub issue and file; labels `bug`, `sev-3`, `ai-delivery`, `final-review`)

| ID | Sev | Type | Title | Jira | GitHub | File |
|---|---|---|---|---|---|---|
| DEF-076 | Sev-3 | Product (client layout) | After the keyboard focuses a tree row, its toolbar collapses on mouse-down and the first click on a row below is lost | AQP-419 | #667 | `docs/07-qa/defects/DEF-076-*.md` |
| DEF-077 | Sev-3 (master may regrade) | Product (layout) and OQ-UX-20 | The Lead's and Admin's queue table scrolls sideways from 1024 to 1366 px; the Actions column (Reassign, the Downloaded chip, "Open to restore") is cut off | AQP-420 | #670 | `docs/07-qa/defects/DEF-077-*.md` |
| DEF-078 | Sev-3 | Product | The Engineer's page for an Ignored task still shows the green banner of the status underneath: "Prepared ... sent for review/approval" or "Approved and locked ... the task has moved to Closed" (false) | AQP-421 | #671 | `docs/07-qa/defects/DEF-078-*.md` |

None blocks G8 as graded (test plan section 6: a Sev-3 is fixed before G8 or accepted in writing by master). DEF-077 is the one master may want to grade up: if the masters-table pass line of ux-spec 6.0 ("every row's action buttons are visible without scrolling the table from 768 to 1440 px") is ruled to bind the queue (OQ-UX-20, the spec's own assumption is "yes"), it is an AC that fails with a workaround, which section 6 grades Sev-2. The Jira Bugs are not yet linked to AQP-1, AQP-418, AQP-402 or AQP-401 by an issue link (the connector call for links was not used; each description names them).

### 5.2 Observations, not logged as Bugs

1. **SCR-10 chip not redrawn after a press of Download.** It reads "Not downloaded" until the page is opened again; `estimate-export.tsx` states this on purpose. A Lead who presses Download and looks at the chip may think nothing was recorded (two downloads were recorded). For the ux-expert to confirm that is intended.
2. **"under N" wording.** "Keep the subject under 80 characters." and "Keep the short name under 10 characters." are said for limits where N itself is accepted (80 and 10). The wording is the AC's text (AQP-390 AC-3); "at most N" would be exact.
3. **WebKit Tab order.** In the 1366 px WebKit run the fourth Tab stop after the last tree row (an unnamed control) sat at y 684 to 720 with the sticky bar from 698; it was partly covered (about 14 of 36 px visible), which still meets 2.4.11 AA (not entirely hidden). Not identified further.
4. **Intermittent hang of a click in the long Firefox script** was the same cause as DEF-076 (the row had not opened).
5. **The Engineer's Ignored tab and the Lead's Ignored tab** show the remarks as plain text and cut them at a word with "Read all remarks" (not exercised by hand beyond a 52-character remark; covered by 7D's unit test of the cut).

## 6. Traceability refresh (requirements to tests), CR-01

Source of the AC lists: each story's AC table in its PR body (the developer's AC to code to test mapping; AQP-390's was also compared with the 19 ACs in Jira, and 7D's and 3D's rows are AC-1 to AC-10 and AC-1 to AC-9 as in their stories). QA's check: every test file named in those tables exists at H (`git ls-files` at 1fe1581b; the only unmatched names are glob patterns such as `task-detail*.test`). The rows that name no file say "E2E", "markup test" or "CI"; for those the E2E spec carries the AC in its test title (`compact-layout.spec.ts` AC-1 and AC-5 to AC-7 and its describe titles for AC-8 and AC-9; `estimate-tree.spec.ts` AQP-404 AC-1, 4, 5; AQP-405 AC-1 to AC-4; AQP-406 AC-1, 2, 3, 5, 6, 8, 9; `ignore-restore.spec.ts`, `mark-quoted.spec.ts`, `download-marker.spec.ts`, `assign-task.spec.ts` AC-1 to AC-7, `estimate-customer.spec.ts` AC-5, 7, 9 to 13, 18), or the AC is a figure or a statement checked by a CI gate (first load under 200,000 B, Stage 11b; the grep guard of 389 AC-8) or by the PR text.

| Story | PR, merge | AC rows | Rows with a named, existing test file | Rows named only as E2E, markup test, CI or PR text | By-hand check by QA in this review |
|---|---|---|---|---|---|
| AQP-388 item 1 compact (NFR-031) | #600 `08394110` | 10 | 2 | AC-3 to AC-10 (compact-layout.spec.ts; AC-10 is CI) | Field heights 36 / 44 / 44 px, `.is-compact`, no overflow, axe 0 on SCR-05, 06, 07 (4.1) |
| AQP-389 item 2 rename | #599 `6087e8b8` | 10 | 8 | AC-9, AC-10 | 8 routes, About, sign-in tags, lockup (4.5) |
| AQP-390 item 6 assign | #601 `d119ae39` | 17 (AC-1 to AC-19) | 15 | AC-18 (E2E axe), AC-19 (PR text) | Assign form, errors, 80 / 81, short name, Customers 11, Engineer 403 on customer, Change customer dialog, Engineer read-only customer (4.1) |
| AQP-391 item 9 file name | #604 `8ff2fa06` | 12 (AC-4, AC-10 superseded by OQ-PM-11) | 10 | AC-11, AC-12 (PR text) | Name with reserved characters, IST date, header, file read back (4.5) |
| AQP-398 7A Prepared | #620 `59a885d8` | 8 | 5 | AC-6 (grep evidence), AC-7, AC-8 | "Prepared" on queue, badge, notices, Engineer page; no "Submitted" seen on any screen read |
| AQP-399 7B status machine | #624 `967e6337` | 9 | 8 | AC-9 (suites) | Every transition used in the journeys (4.1) |
| AQP-400 7C Mark as quoted | #649 `8ca2bb37` | 10 | 7 | AC-3 (409), AC-5, AC-10 (first-load figure) | Dialog, notice, 409, final status, Unlock, Cancel approval (4.1) |
| AQP-401 7D Ignore and Restore | #661 `56ea5cb8`, #663 `1fe1581b` | 10 | 8 | AC-4, AC-10 | Dialogs, notices, tabs, Engineer view, freeze routes (4.1); **DEF-078** |
| AQP-402 7E download log, marker | #622 `7a21de81` | 8 | 6 | AC-3, AC-8 | Marker after two downloads, Closed tab, Engineer none (4.1, 4.3); **DEF-077** (fit) |
| AQP-403 3A node kinds | #621 `5b006268` | 9 | 8 | AC-9 (export untouched, grep guard) | Kinds and allowed children by hand (4.2) |
| AQP-404 3B rows | #623 `5db39609` | 9 | 2 | AC-2 to AC-5, AC-7 to AC-9 (markup tests and E2E; AC-7 is a first-load figure) | Icons, legend, nested list, arrow (4.2) |
| AQP-405 3C row actions | #625 `444d10b7` | 10 | 3 | AC-2 to AC-5, AC-7, AC-9, AC-10 | "+" menu by kind, add at once for a Part, delete dialog, keyboard (4.2) |
| AQP-406 3D reorder | #656 `02460fbe` | 9 | 4 | AC-5 to AC-9 | Move menu and renumbering by hand; drag and touch drag not repeated (3 (d)) |
| AQP-418 DEF-075 toolbar | #662 `ab3f45a7` | 8 (PR table; the 11 checks are in comment 12939) | named in the PR | check 5 and the 320 / 400 % / `:has()` items | **Done by hand (4.2)**; checks 1 to 4 and 10 by hand at 1366 px; DEF-076 found |
| AQP-343 DEF-040 tree in-flight | #652 `1eae9353` | 5 (PR table; DL-340 (a) to (f)) | unit files named | no E2E case by design (DL-296) | "Updating the parts. This takes a moment." seen on a move |

**Gaps in the trace that QA records.** (1) FR-043's clause "the server refuses a row under a kind that may not hold it" and FR-109's "one test per route" are proven by integration and manifest-driven tests (reviewer-quality read the manifest by hand, 12998); QA did not read those files in this pass. (2) FR-111's amber "Changed since download" has an E2E case and no by-hand check here. (3) FR-064's waived clause (Lead or Admin edit of a Draft or Prepared estimate, DL-306) is correctly absent: SCR-06's tree has no toolbar and no input is editable (marked "Waived (DL-306)", not a failure). (4) FR-102's "Engineer sees the status of own estimates" is met on SCR-03 and SCR-05 for Draft, Prepared, Approved (closed), Quoted and Ignored. (5) No AC is without a test or a by-hand check.

## 7. Issues for other roles

1. **ux-expert:** (a) DEF-076 needs a design rule (above); (b) DEF-077 needs a pattern for the queue table; (c) the ux-spec SCR-10 "Content" paragraph still reads the old file name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx`, 60 characters, "Customer if nothing is left" (section 6, SCR-10), while section 0.9 row 9 and the build use `<Short Name>_<Subject>_<DD-MM-YYYY>.xlsx` and never cut; (d) confirm the SCR-10 chip may stay stale until the page is reopened (observation 1).
2. **product-owner:** OQ-UX-20 (does the masters-table pass line bind the Lead's queue?) decides DEF-077's grade and fix.
3. **product-owner and ux-expert:** NFR-017 says "100 % of interactive controls on touch layouts" are 44 px; text links ("View cost details for ...", the task code on the phone card, the folder path) are 16 to 22 px high. Are inline text links exempt? QA does not interpret it (axe's 24 px rule passes by its spacing exception).
4. **developer:** DEF-076, DEF-078 (each with a regression case in an existing spec while the count freeze binds), DEF-077 after the design.
5. **orchestrator:** the DEF-075 by-hand items in test plan 7.1 F are done; the final regression on the frozen head only needs to repeat them if a file of the tree, the queue or the Engineer's workspace changes before the freeze (DEF-076 and DEF-078 fixes will touch them).

## 8. Clean-up and limits

Stopped and removed at the end of the run: the `next dev` server on 3300, the Playwright processes, the `finalqa` Compose project (container `finalqa-db-1`, network and volume `finalqa_accucut-dev-db`); items that could not be deleted are in the hand-off. The other containers on the machine (`aqp401-db`, `aqp406-db`, `accucut-demo-db`) and the process on port 3200 were not touched. No file under the main checkout or under `aqp-398`, `aqp-402`, `aqp-403` was read or written; no commit was made.
