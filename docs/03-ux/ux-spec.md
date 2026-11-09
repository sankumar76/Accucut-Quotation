# UX Specification — Accucut Quotation Portal, Releases 1 and 2

| Field | Value |
|-------|-------|
| Version | 0.19 (AQP-234 / DEF-021, master G7 condition 1 on AQP-122, DL-121: new rule "Masters tables" in section 6.0, so that a row action is visible without scrolling the table at every width from 768 to 1440 px. Two parts: headings wrap, and the Actions column is sticky at the right edge of the table's region; the narrowest region is 710 px, at 1024 px with the side menu open. It applies to SCR-11 (the same fault, 8 px short today) and SCR-13 and to SCR-12, SCR-14 and the Treatment / Color list; SCR-03 and SCR-17 are flagged, not changed (OQ-UX-20). The mock-ups SCR-11, 12, 13 and 14 use it and SCR-00 gets section 11; no colour, token, page or state link changed); 0.18 (AQP-122, master G6 condition 4, DL-115: SCR-13 holds the final words of the Materials tab, the Empty and No match states, the Add and Edit dialogs and the interim page description that names only the tabs that exist; the two "required" messages are parallel; no colour, token, page or state link changed; the mock-up is not changed); 0.17 (AQP-113, master G6 condition 5: SCR-11 states the wording, tone, role, place and focus for a rate deleted elsewhere (QLT-06), and recommends plain text instead of the link to the planned Fields and formulas page until it is live (QLT-11); no colour, token or page changed); 0.16 (AQP-74, questions on the audit screen: every time is written with IST and the column header is "When"; the page description no longer says nobody can edit or delete an entry (ARCH-R8); two empty states, "No entries yet" and "No entries match"; the Release 2 kinds stay out of the Release 1 build; the six user-change entry texts including `user.renamed`; Who and Object show the name at the time; the SCR-16 mock-up shows them; no colour, token or page changed); 0.15 (AQP-65 STD-08: SCR-14 states the Admin's own row, the disabled Reset password button, its accessible name and where Change password is; the SCR-14 mock-up shows it; no colour, token, page or state link changed); 0.14 (AQP-65, three questions from the Users page build: the Edit user dialog is specified and drawn, the interim password hints are accepted until story 01.05, and a dialog that does not open shows a page notice, with the general rule in SCR-25; no colour, token or page changed; SCR-14 gets four states); 0.13 (DEF-014 / AQP-198: the account trigger's accessible name now contains the text it shows at every width, WCAG 2.5.3: `Account menu, <initials>, <name>, <role>`, one name for every width and state; section 8 Labels and names row; the mock-ups carry it on every page; no colour, token, page or state link changed); 0.12 (AQP-48: SCR-26 gets a rule for the button label on No access and Not found, role by role: "Go to my tasks" for an Engineer, "Go to the task queue" for a Lead or an Admin; no colour, token, page or state link changed); 0.11 (AQP-188, DoR gap on UX states: section 7.3.1 gets rule 11, the one exception to rule 7, so a control that opens an overlay for the first time stays enabled, is `aria-busy` and keeps the pressed look held, with the classes for it; SCR-25 now defines the first-open pending and failed states and the two failure lines; the account trigger gets a pressed state; no colour, token, page or state link added); 0.10 (DEF-010 and QA OBS-2: section 7.3.1 revised, a pressed fill the eye can see on the primary and danger buttons, two colour tokens added, `--primary-pressed` and `--danger-pressed`; pressed shows at once and fades out on release; button text cannot be selected and a real button shows no iOS copy callout; the `--shadow-pressed` token, the other variants, pages and state links are unchanged); 0.9 (pressed state of every button variant, DEF-008 and QA OBS-6: new section 7.3.1, one non-colour token `--shadow-pressed`, no colour, page or state link added; SCR-00 section 05 shows the pressed samples); 0.8 (master data names and units from SPEC v1.13: Plating-rate-per-sqin makes 15 rates on SCR-11 and SCR-12, the scrap column is Material-Scrap-Rate on SCR-13, the rate-unit half of OQ-UX-07 is closed; no page count or state link changed); 0.7 (CR-32 settled: a failed sign-in keeps both fields, the password too, in SCR-01 and UJ-01; 0.6: small fixes CR-22, CR-26 and CR-29 on top of 0.5: FR-106 to FR-108 in sections 5 and 9, SCR-15 staged R1 core for the Last backup line, stale rows cleared; architecture v0.8 and SPEC v1.10: the whole-order rule with a parent showing only its own row; Warn for a row that costs 0; every calculated figure cleared on any input change; no Excel file until a calculation is current; the approved price kept until a new approval or the Admin removes it; Cancel approval and Remove price for the Admin; the rate-change notice; the optional Part Model; the Last backup line. Changes since 0.4 are in section 0.8 and the change log) |
| Owner | ux-expert |
| Status | In Review (G3, human approval) |
| Inputs | PRD v0.10 (FR-001 to FR-108; it numbers the rate notice, Cancel approval and Remove price); SPEC v1.13 (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`, §6.3, §7.1 H, §7.4, §9, §10, §11, §17, §18 D-12, D-14 to D-22 and D-24, §18.5); `docs/04-architecture/architecture.md` v0.9 sections 4.8, 4.10, 16.8 to 16.14 (UX-28 to UX-65); `docs/05-backlog/consistency-report.md` (CR-06 to CR-08, CR-10, CR-22, CR-26, CR-29); decision log DL-018 to DL-026; AQP-26 (the quantity rule, settled: the Engineer types the count for the whole order on every row and BL is the sum of every row's BG); AQP-15 comments 10511 and 10527 (Warn; Q-38 "Yes"; held, see section 0.7); AQP-1 comments 10490 (their answers, relayed), 10491 (APPROVED) and 10493; `docs/04-architecture/architecture.md` v0.3 section 16.8 (UX-28 to UX-37); gate log; project brief v0.6; stakeholder map; gate log G2 attempt 2 (conditions 5, 6, 9); `docs/04-architecture/architecture.md` v0.2 section 16 (items UX-01 to UX-27) and section 15.2; the client's `Accucut Quotation Portal UI-UX.html` (15 screens, unpacked and read); `docs/03-ux/assets/` (logo, company board) |
| Review pages | [`screens/index.html`](screens/index.html): 27 screens on 29 pages (the Engineer and Lead variants are separate pages), 11 phone and tablet frames, 164 direct state links. Open by double-click; no server, build or sign-in. They are produced by [`generator/`](generator/README.md) |
| Scope | Every user-facing FR through Release 2 (scope A and scope B are both covered, as DL-004 requires). Not designed, by decision: see section 0.3 |

How to read this: the HTML screens are the visual reference; this file is the rule book for them. Where the two differ, this file wins and the screen is a defect. The screens are review mock-ups; developers rebuild them with shadcn/ui and Tailwind using the tokens in section 7. All data on the screens is invented.

---

## 0. Delivery lead decisions recorded here

### 0.1 UI decisions of 2026-10-31 (their decisions; recorded nowhere else in the repository before this file)

The delivery lead gave these directly. They are not assistant proposals. SPEC §17 and catalogue DEC-01 to DEC-06 carry most of them in the analyst's wording; this section is the UX record of what was built from them.

| # | Their decision | Where it is built |
|---|----------------|-------------------|
| UD-1 | Engineer data entry uses the **guided form**, with an Excel **column letter on every field** (and a column range on every section). No spreadsheet-style grid | SCR-05 (letter badge on every field, range tag on every section); SCR-06 reuses the same form for Lead and Admin |
| UD-2 | **Brand "Red Leads":** white top bar with the real AccuCut logo image; the company name in the logo red (about #DE3030) in a bold serif like the company board; dark graphite side menu; red main buttons. This replaces the sample's blue and the spec's navy #1F3864 | `screens/screens.css` tokens; SCR-00 section 01 and 02; every screen's top bar and menu |
| UD-3 | **Rejected:** "Copy from part" and "Apply to selected". Do not design them | Absent from SCR-05, SCR-06 and the tree. Section 0.3 |
| UD-4 | **Drawing input is deferred** to the next release, but the layout leaves room for it | SCR-05: a reserved grid track beside the form (section 6, SCR-05, and the review toggle on that screen) |
| UD-5 | **Decided: no switch.** A "Not needed for this part" switch per section that fills zeros: their answer is "No switch" (AQP-1 10490, relayed; OQ-UX-01 closed) | **Not built.** Engineers enter 0 and choose "Not applicable" in the Material in Drawing and Treatment / Color lists |

### 0.2 Conflicts found while applying the decisions (for the business-analyst)

| # | Conflict | Detail | Proposed resolution |
|---|----------|--------|---------------------|
| C-1 | **Navy #1F3864 survives in the Word draft.** SPEC §17.2 says "Red Leads" replaces navy #1F3864, but the only place that colour appears is `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx` (its heading and table-header styling, 42 uses). No Markdown artefact uses it. Anyone reading the draft as the brand source will take navy as the colour | Two sources disagree on the brand colour | Mark the Word draft's colours as superseded by SPEC §17.2 in the catalogue; no UX change |
| C-2 | **Header wording.** SPEC §9 and FR-009 say the header shows "logo/name 'Accucut Quotation Portal'". UD-2 puts "ACCUCUT LASERS" in logo red beside the logo | The lockup built is: logo, "ACCUCUT LASERS" (red serif), and "Quotation Portal" as a small line under it. Both names are present | Confirm wording; or amend SPEC §9 |
| C-3 | **"Not needed" switch.** Version 0.2 recorded a conflict: they called it undecided, while PRD FR-095 (Won't), SPEC §15 item 7 and D-06 record it as closed | **Resolved.** Their answer "No switch" (AQP-1 10490, relayed) agrees with the PRD and the SPEC. Nothing is built | None |
| C-4 | **WCAG level.** PRD NFR-018 and SPEC §11 say WCAG 2.1 AA and "2.2 is not required". This design meets 2.2 AA (a superset) because the UX standard for this team is 2.2 AA | Adds 2.4.11 focus not obscured, 2.5.7 dragging alternatives, 2.5.8 target size, 3.3.7 redundant entry, 3.3.8 accessible authentication | PM raises NFR-018 to 2.2 AA (no cost; the design already complies) |
| C-5 | **SPEC §11 "Light and dark mode [DEFAULT]"** against PRD FR-090 (Could, R3) and the current instruction that dark mode is out of scope | Not designed; tokens are named so a dark set can be added later | PM and BA align SPEC §11 |
| C-6 | **SPEC §9 lists no audit screen**, but FR-011 ("I can rely on a record") and FR-079 (view and filter the change history) need one | SCR-16 added | PM confirms |

### 0.3 Not designed, on purpose

| Item | Why | Trace |
|------|-----|-------|
| "Copy from part", "Apply to selected" | Rejected (UD-3) | FR-094 |
| Drawing viewer and reading data from drawings | Deferred (UD-4); only room is reserved | FR-093, FR-087 |
| "Not needed for this part" switch | Decided: no switch (UD-5, "No switch", AQP-1 10490); Engineers enter 0 | FR-095 |
| Offline use | Next release; meaning undecided (Q-18) | FR-092 |
| Dark mode | Out of scope now (FR-090, R3) | C-5 |
| UI-sample extras ("Awaiting review", "Closed this month", global search, per-Engineer workload counts, "Visible to Engineer" column, Tool Cost beside the total) | Out of scope now (FR-097, R3). The Tool Cost *input* and BN are in; a per-row "Visible to Engineer" column is not (the **Kind** column says the same thing: Input, Auto or Output) | FR-097 |
| Import of past estimates | FR-096 | |
| Installation (Docker, README) | Not a screen. FR-091 is a documentation and deployment deliverable | FR-091 |

### 0.4 Reconciliation with the architecture (architecture.md v0.2, section 16.6)

This table records version 0.2 as built. Where version 0.3 changed a result (UX-05 "Inputs changed", UX-18 password wording, UX-25 written-out sum, the About note), section 0.5 says so.

The solution-architect reviewed all 41 pages and listed 27 items for UX (UX-01 to UX-27). All 27 are applied in the screens and this spec. None was dropped. Where the architect left a choice, the choice made is stated; where a decision belongs to the delivery lead or the product-manager, it is in section 11.

| Item | Screen | Result |
|------|--------|--------|
| UX-01 | SCR-07 | **Done.** Working lines show calculated operands to 4 decimals (inputs and rates as typed), so repeating the arithmetic gives the printed result. A note says so. The generator throws if any line fails to reproduce its result within 0.005; it passed for AK, AV, BA, BB, BD, BE, BF, BG, BJ and BK |
| UX-02 | SCR-06, 07, 10 | **Done.** One sentence on each ("Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths"; version 0.3 changed "by 0.01", because the ten lines of the new row table can differ by 0.02). SCR-10 and SCR-06 also name the actual cases, now computed from the data (for example "Row 1.1: 1,791.99 + 2 × (160.16 + 107.38) as shown gives 2,327.07, but the portal works with the unrounded values and shows 2,327.08"); SCR-07 stage 5 explains 43.78 against 43.79. Usability task 4 includes it (section 10) |
| UX-03 | SCR-06 | **Done.** Draft state has a primary **Calculate** button; Approve is disabled with its reason |
| UX-04 | SCR-06 | **Done.** New state "Draft after unlock": notice with who, when and why; figures shown are the approval's; **Recalculate** is primary; Approve disabled until it is run; BO shows "Not set yet" and that the earlier price is in the audit log |
| UX-05 | SCR-10 | **Done.** New states "Not calculated" (file holds inputs, cost columns empty, link to calculate) and "Inputs changed" (file holds the figures of 10:42 IST, link to recalculate). Download stays available in both (A-05) |
| UX-06 | SCR-06, 07 | **Done.** A parent's screen box also shows the sums of BJ (USD) and BK (EUR); its Excel-row box shows its own BJ and BK. FR-029 is met as written; no change asked of the product-manager |
| UX-07 | SCR-05, 06 | **Done.** When the form is read-only (Submitted, Approved) the part actions, "New item", Replace, Remove, "choose a file" and the paste hint are not shown. The server refuses them regardless |
| UX-08 | SCR-17, 20 | **Done.** System fields A, H, BG, BL, BO show a "System" lock tag and no delete; Edit formula is not offered on A, F, I and BO |
| UX-09 | SCR-17, 18 | **Done.** BL is listed as `ROLLUP(BG)` with its explanation; SCR-18 names `ROLLUP(column)` in its function line, has a state for editing BL and a warning state when a formula stops using ROLLUP. Text-alignment issue for FR-022 and SPEC §8.2 is the architect's and the product-manager's |
| UX-10 | SCR-19 | **Done.** Input: unit, hint, Excel width and format, choices (for a list), and a visibility rule. Cost column: stage, hide-when-zero, width and format |
| UX-11 | SCR-18 | **Done.** "Sample rows come from the latest calculated estimate"; states for no sample row and for too many wrong passwords ("Too many wrong passwords. Try again in 15 minutes. Your formula is kept.") |
| UX-12 | SCR-02 | **Done.** `noindex, nofollow` (its address carries a token) |
| UX-13 | All | **Done, verified.** `fontkit` confirmed that none of the six shipped files had ₹, Σ, → or ←. Five Plex files from the open-licence Latin-extended subsets are added (about 76 KB, loaded only when a ₹ is on the page); Σ and the arrows are inline SVG icons with a text alternative. A browser check shows ₹ drawn by IBM Plex on SCR-05, 06, 10 and 16, and no Σ, → or ← remains in visible text |
| UX-14 | All sticky | **Done, verified.** `screens.js` measures the top bar, section strip and action bar with `ResizeObserver` and sets `--sticky-top` and `--sticky-bottom`; `scroll-padding` and the tree panel height use them. Measured: phone action bar 181 px, offset 189 px (fixed 96 px would have hidden fields). Keyboard run, tabbing every field on SCR-05 and SCR-06 at 360, 768 and 1280 px: 0 of about 290 focus stops under a bar. A real phone with its keyboard open is still needed (section 10) |
| UX-15 | SCR-05, 06 | **Done.** "Notes from Kiran Bose: …" shown under the task folder |
| UX-16 | SCR-12, 13 | **Done, needs confirmation.** Delete and a "cannot be deleted yet" state (names the open estimates) for customers and materials; delete confirmation says estimates already calculated keep their figures. Whether delete should exist is the product-manager's (SPEC §4 and FR-013 are silent for customers; OQ-UX-14) |
| UX-17 | SCR-23 | **Done.** State "Set a new password" (the portal redirects every page here; the side menu is not offered). Whether it also applies after any Admin-set or reset password is a decision (OQ-UX-15); the design works either way |
| UX-18 | SCR-02, 14, 23 | **Done.** Messages: "Use 128 characters or fewer.", "The password cannot be the same as your e-mail address." (Admin screens: "…the user's e-mail address."), "That password is too common. Choose a different one." Shown as states on SCR-23, SCR-14 and SCR-02; the first two are stated for all three screens in the table in section 6.0. The hint words "Proposed rule, to be confirmed" were removed in version 0.3, when their answer arrived (section 0.5 item 4) |
| UX-19 | SCR-16 | **Done.** Event filter gains "User change" and "Task change (Release 2)"; the revert row reads "Version 8 → Version 9 (from version 7)". Version numbers in SCR-09, 16, 17, 21 now tell one story |
| UX-20 | SCR-03 | **Done.** Closed rows show "Closed", no reassign |
| UX-21 | SCR-04, 14 | **Done.** The alerts notice carries a "Release 2" tag and is built only when e-mail alerts exist; the deactivate dialog no longer says tasks can be reassigned (that sentence is added from Release 2). Under scope A these are build order only |
| UX-22 | §4, SCR-26 | **Done.** For an Engineer a missing estimate and another Engineer's estimate give the same "no access" page |
| UX-23 | SCR-13, all | **Done.** The exchange-rate hints now say the rate (BH or BI) feeds the price (BJ or BK). Rule added to 6.0: letters and cell names in copy are filled from the field registry, never typed |
| UX-24 | SCR-05 | **Done.** "Choose the customer this estimate is for. Changing it later asks you to confirm." The no-customer notice and the change dialog no longer mention rates. A scan of every Engineer-reachable page and state finds no "rate", "price" or "formula" |
| UX-25 | SCR-06, 07 | **Done.** The written-out sum is the row's own figure plus the figure of each direct child, at most 4, then "+ n more rows below (see the Excel export for each)". The sum still adds up exactly: item 1 is 0.00 + 1,163.54 + 1,253.12 + 1,935.09 + 709.97 = 5,061.72 |
| UX-26 | Several | **Done.** SCR-06 section 02 tag reads "E, F, I, J–L, N" for Lead and Admin; SCR-17 lists BH and BI as Outputs; SCR-11's Unit list holds every unit used; SCR-03 Engineer "No match" text no longer names filters an Engineer lacks and "1 task is overdue" is singular; SCR-16 phone cards follow the filter |
| UX-27 | `screens.js`, SCR-20 | **Done.** Three `split(/s+/)` calls are `split(/\s+/)` (the Closed tab highlights; multi-state locks work); the SCR-20 label "Blocked by formulas" has no comma |

**Found by this re-check, not on the architect's list (fixed):** SCR-08 said an override of ₹ 10,300.00 was "₹ 302.91 lower"; the calculated total is ₹ 10,302.91, so it is ₹ 2.91 (now computed from the data). SCR-10 had no Download button in the Approved state. The parts-tree panel ran under the action bar. The About sentence said "approves the price"; it was reworded to "reviews and approves the estimate". **Corrected in version 0.3:** version 0.2 added that Engineer pages therefore hold no cost vocabulary at all. That was wrong: the sentence contains "manufacturing cost estimates", the delivery lead approved it as it is ("The wording is fine.", AQP-1 10490, D-18), and the wording is kept exactly. The Engineer-page check is about figures, not the word (section 12).

**Disagreements.** None. Two items carry a choice the architect left open, and both are logged in section 11: UX-17 (should "must change password" follow every Admin-set password, OQ-UX-15) and UX-16 (should delete exist, OQ-UX-14).

### 0.5 Changes in version 0.3 (requirements v1.4, the delivery lead's answers of 2026-11-01, architecture v0.3 section 16.8)

Their answers are in AQP-1 comment 10490 (relayed from the chat), approved with APPROVED in comment 10491; the business-analyst's reading is comment 10493. Items 1 to 9 are the orchestrator's list; items 10 to 18 are the architect's UX-28 to UX-37 (architecture section 16.8), which overlap with them.

| # | Change | Screens | Result |
|---|--------|---------|--------|
| 1 | **Quantity rule: every level's quantity applies** (D-12 (a); 24 lids for 2 frames, 3 pipes each, 4 lids per pipe). A row's own quantity is never applied twice | SCR-06, 07, 10; tree figures on SCR-06 and 07; SCR-17 and 18 wording | The row figure is T(row) = BG(row) + H(row) x the sum of T over its direct children. BL is the sum of T over the items, which equals the sum over all rows of BG x the quantities of the rows above. "Item quantity then counts this 2 times" is gone. SCR-06 "How the total is built" and SCR-10 "How BL2 is made" are now row-by-row tables (pieces counted, BG, rows above multiply by, counted in BL). The mock-up's Base frame (1.1) now has quantity 2, so the rule is visible below the top: 1.1.1 counts 2 x 2 x 4 = 16 pieces. BL is 12,629.99, BN 2.58, item 1 12,450.53, item 2 179.46, part 1.1 2,327.08. The architect's frames, pipes and lids case (each lid 1, each pipe 1, nothing on the frame) is printed as 4, 15 and 30 (UX-28) |
| 2 | **The total is cleared when any input changes; Approve stays blocked** (D-20) | SCR-06, 10 (and SCR-08 cannot open) | "Inputs changed" with a stale total is replaced by **Total cleared**: the BL tile reads "Cleared", BN is a dash, BO is "Not set yet"; Approve and lock is disabled and the notice says why; the primary button is Recalculate. Never-calculated shows no figure either. New state "Unlocked and changed". See the table in section 6 SCR-06. **Working assumption, not decided (Q-37, open):** what else is cleared and what the export holds, section 0.6 |
| 3 | **Optional reason on a different price** (D-18 "Reason optional") | SCR-08, 06, 10, 16 | A "Reason for the different price (Optional)" textarea in the approval dialog, shown only when the price differs from the calculated total, up to 500 characters (the limit is my proposal, like the other length limits). The reason is shown with the override on the estimate (BO tile), on SCR-10 and in the audit log; "No reason given" is shown when it is empty (UX-31) |
| 4 | **Password: at least one number and one symbol** (D-19; 12-hour session stands) | SCR-02, 14, 23 | New hint and messages in section 6.0. "Proposed rule, to be confirmed" and "no composition rule" are removed. New states "Needs number and symbol" on SCR-02, 14 (add and reset) and 23 (UX-32). The 12-hour session is worded on SCR-26 (UX-33) |
| 5 | **Export: one total only, plus the total Tool Cost** (D-16) | SCR-10 | BL, BN and BO once in row 2; no per-item totals. The total Tool Cost is in the **Tool Cost column of the row two below the last part (one empty row between), its label in the cell to its left**, so no part's own Tool Cost cell (including row 2) is hidden or replaced. This is the architect's footer row (architecture 4.6); I had proposed the same position independently, with the label in column A, and now follow the architect's label cell |
| 6 | **"Not applicable" is a drop-down choice only** in Material in Drawing and Treatment / Color, and on no Admin list (D-17) | SCR-13, 05, 06, 07 | Removed from the Materials and Treatment / Color tables and the phone cards on SCR-13 (which keeps "Other"). Kept in the two drop-downs, with a hint "Choose 'Not applicable' if this row has no material" (and treatment or colour). **Working assumption, not decided (Q-36, open):** Lead and Admin forms offer it too; it shows as the part's value; Material Rate and Material Considered stay blank for such a part; SCR-07 for such a part shows 0.00 for Blank Weight, Scrap Weight and Material Cost with no worked line (UX-34) |
| 7 | **"Not needed" switch closed** ("No switch") | Spec only | OQ-UX-01 closed. The reserved-slot note (a free area in every section header) is removed, because it served only the switch; the header keeps its normal layout |
| 8 | **About sentence** | SCR-24, spec | Wording unchanged and exact. The note that it holds no cost word is corrected (section 0.4). The Engineer-page check allows the sentence |
| 9 | **Open questions closed** | Section 11 | OQ-UX-01, 02, 05, 06, 10 and 12 closed with their words |
| 10 | UX-28 | SCR-06, 07, 10; SCR-17, 18 | As item 1. SCR-17 and 18 now describe ROLLUP(BG) as "each row's BG times the quantity of every row above it, added over all rows" |
| 11 | UX-29 | SCR-06 | Parent and item figures (the screen figure of a parent, the tree figure with the sum tag, the item's share) are **cleared too**, not only BL and BN, because an item's figure would otherwise show the total. A part's own figure stays as last calculated, marked out of date (italic, a clock note and "out of date" for screen readers). Never-calculated shows dashes. This extends ASSUMPTION-55, as the architect advises; Q-37 stays open |
| 12 | UX-30 | SCR-10 | New state **Confirm out-of-date download**: an alert dialog whose safe choice is "Recalculate first" and whose other button is "Download out-of-date file", showing the file name with _OUT-OF-DATE. While cleared, the file card shows that name, the sheet tab is described as OUT OF DATE and a notice row sits under the Total Tool Cost row. BL2, BN2, BO2 and the Total Tool Cost are empty. The preview shows no per-item totals and the Total Tool Cost row below the parts |
| 13 | UX-31 | SCR-08, 16 | As item 3 |
| 14 | UX-32 | SCR-02, 14, 23 | As item 4 |
| 15 | UX-33 | SCR-26 | "Session ended" now reads "Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there." |
| 16 | UX-34 | SCR-05, 07, 13 | As item 6 |
| 17 | UX-35 | SCR-15 | A read-only "Last backup" line (and a "Backup late" state: "No backup has finished for 8 days. Ask Accucut IT to check the weekly backup."), and a test-e-mail failure for a sender the mailbox does not allow ("The mail server did not accept this sender address for this mailbox..."). The sender stays editable. The "Last backup" line depends on OQ-ARCH-12 (who looks after the backups) and is proposed, not decided |
| 18 | UX-37 | SCR-13 | Specific gravity must be above 0: hint "Must be above 0." and the message "Enter a value above 0." (state "Specific gravity 0") |
| (not applied in 0.3; held in 0.4, section 0.7) | **UX-36** (message for QTY per Assy of 0 on a parent) | SCR-05 | **Not applied in version 0.3, with a reason. Version 0.4 holds the Warn design until the product manager confirms Warn's scope (section 0.7).** The architect made it conditional on OQ-ARCH-10 being answered yes, and it is open. No message is invented. The field keeps its present rule (0 or more, up to 2 decimals). If the answer is to block or warn, the message belongs on SCR-05 at Calculate, and the price risk (a quantity of 0 on a parent removes everything under it from the total) should be put to the delivery lead in plain words |

**Superseded in version 0.4.** The quantity rule in items 1, 10 and 11 above, in UX-02, UX-25 and UX-28 of section 0.4, and the figures they quote (row 1.1 at 2,327.08, row 1.4 at 709.97 and so on) are replaced by the whole-order rule of section 0.7. BL, BN and BO did not change.

### 0.6 Working assumptions on the screens

None remain. Q-35 (b), Q-36, Q-37, Q-38 and Q-41 are settled (section 0.8), and the earlier labels "working assumption, not decided" are removed from SCR-05, 06, 07, 10 and 13. What is still labelled on a screen is a **wording preview** (an example drawn because the sample estimate lacks the case): the quantity warning notice on SCR-06, 08 and 10.

### 0.7 Changes in version 0.4 (G3 conditions 12 and 13, architecture v0.5 section 16.9 and 16.10, consistency report CR-06 to CR-08, the settled quantity rule)

**Superseded in part by section 0.8:** the parent figures Σ, the single-item preview and the held Warn items described here are replaced; the whole-order rule and the other items stand.

**The quantity rule (AQP-26, settled by the delivery lead).** The Engineer types the count for the **whole order** on every row (2 frames, 6 pipes, 24 lids), and BL is the sum of every row's BG. Nothing is multiplied down the tree. Effects on the mock-ups, all made in the generator:

- The sample estimate's QTY per Assy values became whole-order counts (row 1 = 2, 1.1 = 4, 1.1.1 = 16, 1.1.2 = 8, 1.2 = 4, 1.3 = 2, 1.4 = 2, 1.4.1 = 12, item 2 = 3, 2.1 = 3). Because each new value is the old quantities multiplied down the path, **BL (12,629.99), BN (2.58), the override difference (29.99), item 1 (12,450.53) and item 2 (179.46) did not change.** What changed are the row BG values (for example row 1.4 from 309.19 to 618.37, row 1.1.1 from 160.16 to 640.66) and the parent figures Σ (row 1.1 from 2,327.08 to 4,654.17, row 1.4 from 709.97 to 1,419.94): a row's BG is now what it used to add to the total. The stage lines of row 1.4 on SCR-07 (BB, BD, BE, BF, BG, BJ and BK) double with its count.
- SCR-05: the QTY per Assy label reads "QTY per Assy for the whole order" and the hint "Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4."
- SCR-06: "How the total is built" is a table of Sl. No, part, count (H) and BG, ending with the total; the example reads "if one lid costs 1, one pipe costs 1 and the frame row holds nothing, the total is 24 + 6 + 0 = 30". The node boxes, the tree legend and the sum written out are sums of BG. The "Rows above multiply by" column and the sentence "counts it 2 times" are gone.
- SCR-07: the pair of figures follows SCR-06. SCR-10: "How BL2 is made" adds the file's BG column row by row; the "Rows above multiply by" column is gone.
- SCR-17: BL is listed as `SUM(BG)`. SCR-18: `ROLLUP` is gone from the function line, the BL state edits `SUM(BG)`, and the warning "This formula no longer uses ROLLUP" is removed. This is the ux-expert's reading of "BL is the sum of all rows' BG" with the engine's existing SUM; the architect confirms.

| Item | Screens | Result |
|------|---------|--------|
| UX-36 (replaced), UX-44 to UX-50 | SCR-05, 06, 08, 10, 16 | **Held in version 0.4, applied in version 0.5** (section 0.8) |
| UX-50 | text | **Done in the spec** (section 0.6, 11, 11.1). The screens' own Q-35 sentences are replaced by the whole-order rule |
| UX-38 | SCR-06, 07, 10 | **Overtaken in version 0.5.** A one-row estimate is no longer a special case (section 0.8) |
| UX-39 | SCR-07 | **Overtaken in version 0.5.** SCR-07 now shows "Cleared. Press Recalculate" in place of the stages (section 0.8) |
| UX-40 | SCR-17 | **Done.** BM (Tool Cost) is a System field with the lock tag and no delete |
| UX-41 | SCR-07, 17 | **Done.** Scrap Weight (O) shows `IF(Material-Specific-Gravity > 0, M - N, 0)`; its working line says the specific gravity is above 0 |
| UX-42 | text, SCR-01, SCR-14 | **Done.** Section 0.6 and 11.1 no longer say "narrow case" or "none of them stops G4"; UJ-10; the Q-32 row; SCR-01 is `noindex` in the page and in the text; SCR-14 hand-over asks for the Admin password (new state "Hand over: wrong password") and an Admin-set password leads to SCR-23; OQ-UX-03, 04, 11, 14, 15, 17, 18 and 19 are shown as decided in PRD v0.7 |
| UX-43 | SCR-08 | **Done.** "Use 500 characters or fewer." replaces "under 500". New state "Estimate changed while open" for 409 `TOTALS_OUT_OF_DATE`: "An input changed while this window was open. The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again." Approve is disabled; "Recalculate first" is the way on |
| CR-10 | section 5, 9 | **Done.** FR-060 is mapped to SCR-07 (Release 1) as well as SCR-17-lead (Release 2) |
| Condition 12 | section 9, Inputs, SCR-18 | **Done.** FR-098 to FR-105 are in the table (105 FRs); the Inputs line names PRD v0.8; the SCR-18 sentence "times the item quantity" is gone with ROLLUP; line 124 no longer says "narrow case" |
| Condition 13 | `generator/` | **Done.** The screen generator, its checks and run notes are in `docs/03-ux/generator/`; before the changes of this version it rebuilt the committed pages byte for byte |
| Not done | | The message for a missing Part Model picture (OQ-UX-13) was not in this pass. Replacing the 10 numbers that also occur in the sample workbook is the delivery lead's decision (`generator/README.md`). No usability task covers the Warn dialogs, which are held |

**Issues for other roles (they still describe the earlier rule).** PRD GOAL-03, FR-022 (`ROLLUP`), FR-024, FR-025, FR-029, FR-030, FR-056 and FR-100; SPEC §7.1 H, §7.4 BL, §8.2 and §18 D-12; architecture §4.3, ADR-006 and `rollup-copy.ts`; the test strategy cases CE-2, CE-9 and CE-12; and FR-104. Until they are aligned, a story that cites a screen follows this version where they differ and says so.


### 0.8 Changes in version 0.5 (architecture v0.8 sections 16.12 and 16.13, SPEC v1.10; the delivery lead's answers in AQP-1 comments 10538 to 10554)

**The rules now in force.** The Engineer types the count for the **whole order** on every row; BL is `SUM(BG)`; **a parent shows only its own row** (no Σ figure, no sum of the rows below, no item total, no second box). A **0 in QTY per Assy makes that row cost 0** and nothing else (Warn, Q-41). **Every calculated value on every row clears** on any input change (Q-37 (a)), with no figure marked "out of date". **No Excel file** exists until a calculation is current (Q-37 (b), A-32). The approved price **stays** until a new approval replaces it or the Admin removes it (Q-37 (c)). "Not applicable" shows to everyone on a part and on no master list (Q-36). No new sample-derived number was added: BL, BN, BO, the override difference and every row's figures are those of version 0.4.

| Item | Screens | Result |
|------|---------|--------|
| UX-36 (reworded) | SCR-05 | **Done.** States "Quantity warning" and "Warning with a new list": an AlertDialog after Calculate. One line per row, the row a link: "QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate." "Go back" (the safe choice, holds focus) and "Calculate anyway". No figure beyond that 0, and none of rate, price or formula (UX-24) |
| UX-44 | SCR-06 | **Done.** State "Quantity warning (Recalculate)": the same dialog for a Lead or Admin, plus "You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead" (A-26) |
| UX-45, UX-46 | SCR-06 | **Done as a wording preview.** State "Warning on this calculation": the notice above the tiles naming each row, who went ahead and when, and the row mark "Quantity 0" (icon and words), which no longer depends on the tree. The sample estimate has no row with 0 |
| UX-47 | SCR-10 | **Done as a wording preview.** The same notice and mark, and the checklist line "No warning cell" (A-24) |
| UX-48 | SCR-08 | **Done as a wording preview.** One info line naming the rows; no tick box, approval is not stopped |
| UX-49 | SCR-16 | **Done.** Entry "Quantity warning" (event `calculation.warning_acknowledged`) and a filter choice of the same name |
| UX-50 | text | **Done.** Sections 0.6, 11 and 11.1 follow the settled rules |
| UX-51 | | **Withdrawn** (Q-41: one wording). Not built |
| UX-52 | SCR-05, 06 | **Done.** The label stays "QTY per Assy" (AQP-1 10551). The hint reads "Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4." |
| UX-53 | SCR-06, 07 | **Done.** Every row has one box, "This row, on screen and in the Excel row", with BG, BJ, BK and the count. The Σ tag and legend, the pair of boxes, the sum written out and every per-item figure are gone, and so are "Not multiplied again", "counts it 2 times", "pieces counted" and "Rows above multiply by". The count (H) shows beside each row in the tree and in "How the total is built" |
| UX-54 | SCR-10 | **Done.** The "On screen: this row and below" column and the second table are gone. "How BL2 is made": add the BG column and you get BL2, at any quantity. The rounding sentence stays |
| UX-55 | SCR-17, 18 | **Done in version 0.4:** BL is `SUM(BG)`, ROLLUP is gone |
| UX-56 | SCR-06, 07, 10 data | **Done.** The typed counts follow the rule: the worked example (2 frames, 6 pipes, 24 lids) gives 0, 6 and 24, a total of 30 |
| UX-57 | SCR-06, 07 | **Done.** Total cleared: every calculated value on every row reads "Cleared", with no italic "out of date" figure and no legend for one. SCR-07 shows "Cleared. Press Recalculate" in place of the stages |
| UX-58 | SCR-10 | **Done.** The confirmation dialog, the `_OUT-OF-DATE` name, the sheet tab and the notice row are gone. While cleared the page says the download is off until Recalculate and shows no table and no file card |
| UX-59 | SCR-06, 08, 10 | **Done.** BO shows the latest approved price after an unlock and while cleared, labelled "Approved earlier", until a new approval replaces it. "Not set yet" and "Cleared by the unlock" are gone for such an estimate. SCR-08 has a state "After an unlock" and SCR-10 a state with BO2 filled |
| UX-60 | SCR-05, 06, 07, 13 | **Done.** The working-assumption labels for "Not applicable" are removed. The words show on a part to everyone; F and I stay blank; the master lists do not hold them |
| UX-61 | SCR-05 | **Done.** Part Model is optional: marked "Optional", not counted as a required input (the count reads "23 of 24"), and there is no missing-picture message |
| UX-62 | SCR-06, 08 | **Done.** State "Rates changed": a notice with counts only ("2 rates and 1 material price changed since this was calculated at 10:42 IST. Recalculate to use them. Approving is not blocked.") and a link to Recalculate; one line on SCR-08. No value is shown. The counts are invented |
| UX-63 | SCR-15 | **Done.** "Last good backup" is firm, with no "Proposed" label, plus "Backup late" and a new state "Disk nearly full" |
| UX-64 | SCR-06, 16 | **Done.** Admin only: "Cancel approval" (reason and password), then, on a cancelled approval, "Remove price" (password): two dialogs. BO reads "Approval cancelled", then "Not set yet". SCR-16 shows both events. A Lead sees the state and no button |
| UX-65 | SCR-10 | **Done.** "Not calculated": no file card; the page says the download is off until Calculate, with a link. BO2 is empty for a cancelled approval |
| Also | SCR-06 | The Download .xlsx button is disabled while the total is cleared or the estimate is not calculated (FR-070, A-32), with its reason |
| Overtaken | | UX-38 and UX-39 (a one-row estimate is not special) |

**Defect found and fixed in this pass.** The "Building the file" message on SCR-10 printed the text `${NODES.length}` instead of the row count in version 0.4. It is computed now. The state switcher also ignored an element that had both `data-show` and `data-hide`; it now shows such an element only when the first matches and the second does not.

**Issues for other roles.** PRD v0.8 had no FR for the rate notice, Cancel approval or Remove price; PRD v0.10 numbers them FR-106 to FR-108 and section 9 follows (version 0.6).

---

## 1. Design principles

1. **One part at a time, in worksheet order.** The Engineer sees one part's form with the tree beside it, eight sections in the SPEC §7.1 order, and every field carries the column letter it has in Excel. Nothing else competes for attention.
2. **Engineers never see cost, and the page never hints at it.** No cost, rate, formula, preview or empty cost placeholder is rendered for an Engineer. Wording avoids saying a hidden thing exists. After Calculate they see one sentence and nothing else.
3. **A number on screen always says what kind of number it is.** Every row shows its own figures and nothing else: a parent shows only its own row, and the total is the BG of every row added up. While the total is cleared, no calculated figure is shown on any row.
4. **State is stated in words, an icon and a shape, never colour alone.** Draft, Submitted, Approved, Overdue, Missing data and errors all carry text and an icon; the brand red is for actions, amber for time, error red for faults.
5. **Same hand everywhere.** Four type sizes, one 4-point spacing scale, one 44 px control height, one button set, one palette. A new screen is built from the same parts or the part is added to the design system (SCR-00).
6. **Fast with a keyboard, safe on a phone.** Enter moves to the next field; targets are 44 px; the tree is a drawer and the action bar is sticky on small screens; tables scroll only inside their own box.

---

## 2. Personas and key tasks

From PRD section 2. No persona is added.

| Persona | Top tasks | Context of use |
|---------|-----------|----------------|
| **Engineer** (many) | Open an assigned task; copy the folder path; choose the customer; build the parts tree; enter inputs section by section; press Calculate; fix missing data | Desktop at a workstation with drawings open elsewhere; also phone and tablet on the shop floor. Daily. Mouse and keyboard; fast entry matters |
| **Lead** (many) | Assign a task with a deadline; watch the queue and overdue work; review inputs and costs; recalculate; approve and lock with the Approved Quote Price; unlock; export | Desktop and tablet; some phone use for the queue and the bell. Daily |
| **Admin** (exactly one) | Keep masters and customer rates current; manage users; change fields and formulas safely (R2); read the audit log; set e-mail alerts (R2) | Desktop. Weekly. Careful, infrequent, high-consequence actions: confirmations and password re-entry |
| **Santhosh, MD** | Review these screens at G3 | Desktop, double-click, no sign-in |
| Accucut IT, customers | Not portal users of these screens | |

Frequencies are not evidenced (Q-24).

---

## 3. User journeys

Notation: **Happy path** then **Recovery**. Emotions are design intent, not research.

### UJ-01 Sign in and land on my work
- **Persona and trigger:** any user; opens the portal address.
- **Steps:** 1 Enter e-mail and password (SCR-01). 2 Land on the role's home: Engineer on "My tasks", Lead and Admin on "Task queue" (SCR-03). 3 See only the menu items the role may open (SCR-25).
- **Recovery:** wrong e-mail or password: one message that does not say which was wrong, both field values kept as typed, the password too (it stays masked, and the show/hide toggle lets the person check it; CR-32). Five failed attempts: blocked for 15 minutes with a message that says how long (NFR-003, proposed value). Session ended (12 hours after sign-in, their answer): SCR-26 or SCR-01 with "Your session ended" and return to the page they were on. Forgotten password: Admin resets it (R1, SCR-14); self-service link (R2, SCR-02). A typed address the role may not open: "You do not have access to this page" (SCR-26), which never reveals what the page holds.
- **Emotion:** brief, calm. **Success:** home page in under 5 seconds from submit.
- **FRs:** FR-001, 003, 007, 009.

### UJ-02 Lead assigns a task
- **Trigger:** a Lead has a new request folder on the network share.
- **Steps:** 1 "Assign task" (SCR-04). 2 Choose the Engineer, paste the network folder path, choose deadline date and time (IST shown). 3 Optional title and notes. 4 Assign. 5 Confirmation names the new task ID and links to the queue. The Engineer's Open queue now holds it; if alerts are ON the Engineer is e-mailed (R2).
- **Recovery:** validation on submit with an error summary that links to each field; path not starting with `\\`; deadline in the past. Alerts OFF: a notice says the Engineer will not be e-mailed. Wrong Engineer or deadline later: "Reassign or change deadline" (R2), logged; there is no cancel.
- **Success:** task exists in DRAFT with an empty estimate; **FRs:** FR-032, 033, 040, 081.

### UJ-03 Engineer finds the day's work
- **Steps:** 1 Open "My tasks" (SCR-03 Engineer). 2 Overdue rows stand out by amber bar, clock icon and "Overdue by …". 3 Copy the folder path or open the link. 4 Open the task (SCR-05).
- **Recovery:** link blocked by the browser: the tooltip text says so and **Copy path** always works. Bell badge opens the Overdue tab. No tasks: calm empty state. Load failure: retry without losing the page.
- **FRs:** FR-033, 034, 036, 037, 038, 041.

### UJ-04 Engineer builds the tree and enters a part
- **Steps:** 1 Choose the customer first (the form is held back until they do). 2 Optionally build the tree up front, or add parts as they go: sub-part, part beside, move, delete; Sl. No renumbers and is announced. 3 For each part, work through sections 01 to 08. Every field shows its letter; auto fields are shaded; Fasteners Qty and Cost appear only when Fasteners is not "None". 4 Enter moves to the next field. 5 The count "23 of 24 inputs complete" and the tree icons show what is left. 6 Auto-save every 30 seconds; Save draft at any time.
- **Recovery:** picture over 200 KB or wrong type: the message names the file, its size and the limit; the form is untouched. Leaving with unsaved changes: a dialog offers Save draft and leave. Customer changed late: a confirmation says the new rates apply at the next calculation. Number with three decimals or a minus sign: refused with the rule in words.
- **Emotion:** flow, no interruptions. **Success:** all inputs complete without touching the mouse between fields.
- **FRs:** FR-042 to 054, 056, 057, 087.

### UJ-05 Engineer calculates
- **Steps:** 1 Press Calculate. If any row has 0 in QTY per Assy, a dialog names each such row and says it will cost 0, and asks whether to go back or go ahead (SCR-05). 2 Success: status becomes Submitted; the screen shows only "Cost will be calculated based on the input fields and sent for review/approval." Inputs become read-only. No number appears.
- **Recovery:** any visible input blank on any part: nothing is submitted; a summary lists each part and its missing fields as links; those parts get a triangle icon in the tree; each missing field has an inline message ("Enter this value. Use 0 if the part does not need it."). The Engineer fixes them and presses Calculate again.
- **Success criterion:** no cost, rate or formula in the response (FR-008). **FRs:** FR-055, 056, 064, 008, 104.

### UJ-06 Lead reviews and approves
- **Steps:** 1 Open the estimate (SCR-06): the three totals BL, BN, BO once each, labelled with their letters; the tree with each row's figure. 2 Open a part; see inputs and the final cost; "View cost details" opens the six stages with formulas (SCR-07). 3 Approve and lock: the dialog (SCR-08) pre-fills BL as the Approved Quote Price. 4 Confirm. Inputs lock; the task moves to Closed; approver and time are recorded.
- **Recovery:** price invalid: message. Price different from BL: the dialog says the difference is recorded as an override and offers an optional reason (their answer: "Reason optional"). Total cleared or never calculated: Approve is disabled and says why, and Recalculate or Calculate is the main button (their answer: "Block approval").
- **FRs:** FR-058 to 062, 065, 011.

### UJ-07 Lead corrects an input and recalculates
- **Steps:** 1 Edit an input on SCR-06. 2 The total is cleared at once (BL, BN and every figure that adds up parts), and a notice says to press Recalculate; Approve is off. 3 Recalculate. 4 Totals appear; the "Calculated at" line changes. **FRs:** FR-061, 027, 031.

### UJ-08 Lead unlocks an approved estimate
- **Steps:** 1 Unlock (SCR-09). 2 Read the notices: configuration changed since approval (versions), rates changed (counts). 3 Type the reason. 4 Unlock; the estimate returns to Draft and the task to the Engineer's Open queue; recalculating later uses current values.
- **Recovery:** reason empty: message. **FRs:** FR-063, 038, 064, 011.

### UJ-09 Lead exports and reconciles
- **Steps:** 1 Open "Excel export" (SCR-10). 2 Read the file name and contents. 3 Compare "In the file" with "On screen" per row, and the row-by-row reconciliation of BL2 (the BG column added up). 4 Download.
- **Recovery:** generation error: message with a reference; retry. Total cleared or never calculated: there is no file, and the page says so and links to Recalculate or Calculate. Engineer opening the address: SCR-26. **FRs:** FR-066 to 071, 029, 030.

### UJ-10 Admin maintains masters
- **Steps:** 1 Process master: add or edit a rate (SCR-11). 2 If a default changes and customers hold their own values, the prompt lists them with apply or keep (R1+). 3 Customers: edit rates, "Reset to defaults" with confirmation (SCR-12). 4 Materials, exchange rates, treatment list (SCR-13).
- **Recovery:** delete of a used rate refused with the formulas listed; duplicate names refused; the system row "Other" is locked with a visible reason; "Not applicable" is on no Admin list (D-17). **FRs:** FR-012 to 018.

### UJ-11 Admin manages users
- **Steps:** add user, set role, reset password, deactivate (SCR-14); hand over the Admin role in one step (R2).
- **Recovery:** second Admin refused with the current Admin named; own account cannot be deactivated. **FRs:** FR-004, 005, 006.

### UJ-12 Admin changes a formula or inserts a field (Release 2)
- **Steps:** field list (SCR-17); edit a formula with live checking and a preview (SCR-18); insert a field with a preview of letter changes (SCR-19); delete only when nothing uses it (SCR-20); save a checkpoint before risky work and revert if needed (SCR-21); every change is in the audit log (SCR-16). Formula save, field delete and revert ask for the password.
- **Recovery:** unknown name, syntax error and loops are named in plain words and block the save; wrong password: message, dialog stays; revert can be undone by reverting again. **FRs:** FR-072 to 080.

### UJ-13 Late work becomes visible
- **Steps:** the bell shows a count and opens the Overdue tab; rows carry text, icon and bar; with alerts ON (R2) the Engineer is e-mailed within 5 minutes with the assigner copied, and a daily digest at 11:00 IST (SCR-22). **FRs:** FR-036, 037, 081 to 084, 019 (SCR-15).

### UJ-14 Change my password
- Account page (SCR-23) from the user menu. **FRs:** FR-002.

---

## 4. Information architecture

```
Signed out
  SCR-01 Sign in ── SCR-02 Forgot / reset password (R2)

Signed in (side menu; items per role)
  WORK
    Task queue / My tasks ........ SCR-03 (Open | Closed | Overdue)
      └ Estimate (by task) ........ SCR-05 Engineer workspace  |  SCR-06 Review (Lead, Admin)
            ├ Cost details ........ SCR-07 (Lead, Admin)
            ├ Approve and lock .... SCR-08 (dialog)
            ├ Unlock .............. SCR-09 (dialog)
            └ Excel export ........ SCR-10 (Lead, Admin)
    Assign task ................... SCR-04 (Lead, Admin) · reassign mode (R2)
  MASTERS (Admin)
    Process master ................ SCR-11
    Customers ..................... SCR-12
    Materials and lists ........... SCR-13 (Materials | Exchange rates | Treatment / Color)
  CONFIGURATION
    Fields and formulas ........... SCR-17 (Admin edit; Lead view only)
      ├ Edit formula .............. SCR-18
      ├ Insert field .............. SCR-19
      └ Delete field .............. SCR-20 (dialogs)
    Checkpoints ................... SCR-21 (Admin)
  ADMINISTRATION (Admin)
    Users ......................... SCR-14
    Settings (Last backup R1 core; e-mail alerts R2) ...... SCR-15  · E-mail previews SCR-22
    Audit log ..................... SCR-16
  HELP
    About ......................... SCR-24
Top bar (always): logo and name · bell (overdue count → SCR-03 Overdue tab) · account menu (name, e-mail, role, Change password SCR-23, Sign out)
System pages: SCR-26 (no access, not found, error, session ended)
Reference: SCR-00 Design system
```

**Navigation model.** Persistent graphite side menu at 1024 px and wider; a drawer opened from a menu button below that (tablet and phone). The bell and account menu stay in the top bar at every size (FR-037). A bottom bar was rejected because the sticky action bar already uses the bottom edge of the workspace (this resolves analyst finding F-17).

**Naming.** Terms follow PRD and SPEC glossary: Task queue, Estimate, Parts tree, Item, Part, Sub-part, Sl. No, Approved Quote Price, Unlock, Process master, Material Master, Exchange rates, Treatment / Color, Checkpoint, Configuration version. The words "BL", "BN", "BO" are shown only as column-letter tags beside plain names.

**Entry points and deep links.**
- A task or estimate has the ID `Q-YYYY-NNNN` (FR-041); the address is `/estimates/<ID>`. The same address opens SCR-05 for an Engineer and SCR-06 for a Lead or Admin; the server decides.
- `/queue?tab=overdue` is the bell's target. Filters live in the address so a filtered queue can be bookmarked.
- A deep link to a page the role may not open shows SCR-26 "no access"; to a missing page, "not found". **For an Engineer, an estimate address that is missing and one that belongs to another Engineer give the same "no access" page**, because task codes are sequential and could otherwise be probed (UX-22).
- Sign-in remembers the requested address and returns there.

**Role matrix:** shown as a table on SCR-25 and enforced by the server (FR-007).

---

## 5. Screen inventory

Release: R1 core unless noted. SCR-15 is R1 core for the Settings frame and the Last backup line (FR-105, CR-26) and R2 for the e-mail alert controls (FR-019). "Files" are in `docs/03-ux/screens/`.

| Screen | Name | Purpose | Persona | Journeys | FRs | Files |
|--------|------|---------|---------|----------|-----|-------|
| SCR-00 | Design system | Tokens, brand, components, state patterns, shadcn map | all (reference) | | 085, 086, 088 | SCR-00 |
| SCR-01 | Sign in | Authenticate | all | UJ-01 | 001 | SCR-01, -phone |
| SCR-02 | Forgot and reset password (R2) | Single-use link reset | all | UJ-01, 14 | 003, 098 | SCR-02 |
| SCR-03 | Task queue / My tasks | Open, Closed, Overdue; filters | Lead, Admin; Engineer | UJ-02, 03, 13 | 033 to 039, 041 | SCR-03, -engineer, -phone, -tablet |
| SCR-04 | Assign task; reassign (R2) | Create a task with folder and deadline | Lead, Admin | UJ-02 | 032, 033, 040 | SCR-04, -phone |
| SCR-05 | Estimate workspace, Engineer | Guided form with tree | Engineer | UJ-04, 05 | 042 to 057, 087, 102, 104 | SCR-05, -phone, -tablet |
| SCR-06 | Estimate review | Totals, tree with figures, inputs, actions; cleared-total states | Lead, Admin | UJ-06, 07, 08 | 058 to 065, 070, 100, 101, 104, 106 to 108 | SCR-06, -phone, -tablet |
| SCR-07 | Cost details | Six stages with formulas for one row | Lead, Admin | UJ-06 | 058, 059, 060, 026, 100 | SCR-07, -phone |
| SCR-08 | Approve and lock (dialog) | Set Approved Quote Price, lock | Lead, Admin | UJ-06 | 062, 101, 103, 104, 106 | SCR-08 |
| SCR-09 | Unlock (dialog) | Unlock with reason and notices | Lead, Admin | UJ-08 | 063 | SCR-09 |
| SCR-10 | Excel export | Download; screen figures against the file | Lead, Admin | UJ-09 | 066 to 071, 100, 104, 107 | SCR-10 |
| SCR-11 | Process master | Rates; change prompt | Admin | UJ-10 | 012, 014 | SCR-11, -tablet |
| SCR-12 | Customer master | Customers and rates; reset | Admin | UJ-10 | 013 | SCR-12 |
| SCR-13 | Materials, exchange rates, treatment list | Master lists | Admin | UJ-10 | 015 to 018 | SCR-13 |
| SCR-14 | Users | Users, roles, passwords, Admin hand-over (R2) | Admin | UJ-11 | 004 to 006, 098 | SCR-14 |
| SCR-15 | Settings: Last backup line (R1 core), e-mail alerts (R2) | Last good backup, Backup late, Disk nearly full (FR-105); e-mail alerts ON or OFF, sender, test (FR-019) | Admin | UJ-13 | 019, 105 | SCR-15 |
| SCR-16 | Audit log and change history | Permanent record | Admin | UJ-12 | 011, 079, 104, 107, 108 | SCR-16 |
| SCR-17 | Fields and formulas (R2) | Column list; Lead view only | Admin; Lead | UJ-12 | 072, 060 | SCR-17, -lead |
| SCR-18 | Formula editor (R2) | Edit with live check and preview | Admin | UJ-12 | 073, 022, 023, 080 | SCR-18 |
| SCR-19 | Insert field (R2) | Guided insert with letter preview | Admin | UJ-12 | 074, 075 | SCR-19 |
| SCR-20 | Delete field (R2) | Blocked list or confirm with password | Admin | UJ-12 | 076, 080 | SCR-20 |
| SCR-21 | Checkpoints and versions (R2) | Save, list, revert | Admin | UJ-12 | 077, 078, 080 | SCR-21 |
| SCR-22 | E-mail alert previews (R2) | The three messages | Engineer receives | UJ-13 | 081 to 084 | SCR-22 |
| SCR-23 | Account | Profile and change password | all | UJ-14 | 002, 004, 098 | SCR-23 |
| SCR-24 | About | Version and copyright | all | | 010 | SCR-24 |
| SCR-25 | Navigation and account menu | Role matrix, drawer, menu | all | UJ-01 | 007, 009 | SCR-25, -phone |
| SCR-26 | System pages | No access, not found, error, session ended | all | UJ-01 | 007, 088, 099 | SCR-26 |

---

## 6. Screen specifications

### 6.0 Patterns shared by every screen (stated once)

**Page frame.** Review bar (review only) → skip link → top bar (menu button below 1024 px, logo and name, bell, account menu) → side menu → `main` with breadcrumb, page title (the only `h1`), content. Sticky action bar at the bottom on workspace screens.

**States.** Every data screen defines these; a screen below lists only what differs.

| State | Rule |
|-------|------|
| Loading | Skeleton rows shaped like the content, shown after 300 ms; container `aria-busy="true"`; a visually hidden "Loading …" in a polite live region. No page-level spinner. Buttons that start work show a spinner icon, the verb in the present tense ("Approving") and are disabled. The one enabled control with `aria-busy` is the trigger of an overlay on its first open (section 7.3.1 rule 11, SCR-25) |
| Empty | Icon, one-line title, one sentence saying what is missing and what to do, one action if there is one |
| No match | Same pattern, title "No … matches …", action "Clear filters" |
| Error (load) | Icon, "We could not load …", "Check your connection and try again. Nothing was changed.", "Try again" button; focus moves to the heading |
| Error (action) | Inline notice with icon, thick left border and text (role `alert`); the form keeps what was typed |
| Success | Notice (role `status`) or a toast that is also announced in a live region; toasts last 5 seconds and never carry the only copy of an instruction |
| Disabled | Grey fill, grey text, `not-allowed`; always paired with visible text or `aria-describedby` that says why |
| Permission denied | SCR-26 "You do not have access to this page"; the server also refuses the request. The wording never says a hidden thing exists |
| **Cleared total** (their answer D-20; Q-37 settled) | When any input changes, every calculated figure on every row clears: BL, BN, the Total Tool Cost, each row's BG, BJ and BK and the stage values. Each shows "Cleared" or a dash with "Press Recalculate"; no figure is shown in italic as "out of date". Approve and lock and the Excel download are off, with a visible reason in the notice and a description on the button. The approved price stays (BO, "Approved earlier") until a new approval or the Admin's removal. Never-calculated shows dashes, not figures. Nothing is shown again until Calculate or Recalculate is pressed |

**Forms.** One label above each field; hint below in label size; errors below in error red with an alert icon. Validation timing: **format rules on blur** (number format, e-mail), **required rules on submit or Calculate**, never on first keystroke. On submit with errors, an error summary (`role="alert"`) lists each problem as a link to its field and focus moves to the summary; fields get `aria-invalid="true"` and `aria-describedby` pointing at their message. Typed values are kept. Autocomplete attributes are set on sign-in and password fields; paste is never blocked (WCAG 3.3.8).

**Dialogs.** Modal; focus moves to the first field or the safe button; focus is trapped; Escape closes (except while saving); focus returns to the trigger. Destructive and password dialogs use `alertdialog`. The default focus is the **safe** choice. Buttons are verbs ("Delete 3 parts", "Keep it"), never "OK".

**Tables and cards.** Tables have a caption (visually hidden), `th scope`, and scroll horizontally only inside their container. On phones, lists of records become cards; the card holds the same facts and the same actions. A table that lists records and has a row-actions column also follows "Masters tables" below.

**Masters tables (added in version 0.19; DEF-021 / AQP-234, master G7 condition 1 on AQP-122, DL-121).** A *masters table* is any table that lists records and has a row-actions column: Process master, Customers, Materials, Treatment / Color and Users. It is shown from 768 px; below that the list is cards (the rule above). **The pass line, set by master: every row's action buttons are visible without scrolling the table, at every viewport width from 768 to 1440 px.** It serves FR-085, NFR-016 and GOAL-07 ("every action reachable"), and it is checked in a browser, not by reading code.

*What went wrong.* The build kept every heading on one line, so the Materials table needed 968 px. The region it scrolls inside is 718 px wide at 768 px and 710 px at 1024 px, where the side menu appears. The Edit button, in the last column, lay beyond the right edge from 768 to 1022 px and from 1024 to about 1270 px. The page never scrolled sideways, so the words "no horizontal page scroll" (AC-7) were true and nothing said the buttons had to be visible. This rule says it.

**Widths to design for.** The region is the viewport, less the side menu (248 px from 1024 px up), less the page padding on both sides (24 px below 1024 px, 32 px from 1024 px), less 2 px of card border. QA measured 718, 973, 710, 966, 1052 and 1126 px in the build on 2026-11-09; 965 px at 1279 px follows from the same sum, and the mock-up gives the same numbers at every width.

| Viewport (px) | Side menu | Table region (px) |
|---------------|-----------|-------------------|
| 768 | drawer, closed | 718 |
| 1023 | drawer, closed | 973 |
| **1024** | **open** | **710 (the narrowest)** |
| 1279 | open | 965 |
| 1280 | open | 966 |
| 1366 | open | 1052 |
| 1440 | open | 1126 |

**A masters table must work in a 710 px region.** The region jumps down by 263 px when the side menu opens at 1024 px, so 710 and not 718 is the number to design for.

**The rule: two parts, a guarantee and a way to avoid needing it.**

1. **The last column is Actions.** Its header cell holds the visually hidden text "Actions". Every button in it is named for its row (`Edit <name>`). Actions are never moved into a "more" menu at these widths, and the column is never hidden.
2. **The Actions column is sticky (the guarantee).** The header cell and every body cell of that column stay at the right edge of the table's scroll region while the table scrolls: `position: sticky; right: 0` (Tailwind `sticky right-0`). The same rules in the mock-up are in `screens.css` under "Masters tables".
   - **Opaque.** The body cell has the card's surface fill (`--surface`) and the header cell the heading fill (`--surface-2`), so nothing that scrolls under it shows through. A row that has its own fill (hover, selected) repeats it on the sticky cell; masters rows have none today.
   - **A hairline on its left,** 1 px `--border`, drawn as an inset box shadow (`shadow-[inset_1px_0_0_var(--border)]`), **not a border**: in a table with collapsed borders the border of a sticky cell does not travel with it. In Windows high-contrast mode the shadow is not drawn; the fill is still opaque, so the column still hides what scrolls under it, and nothing is lost.
   - **Stacking.** `z-index: 1`, inside a stacking context made by the scroll region (`isolation: isolate`), so the column stays below the top bar, the drawer and dialogs.
   - **Width.** What its buttons need, and no less: 36 px per button, the gap between them, and 16 px of padding on each side (68 px for one button; 112 px for two with an 8 px gap; 156 px for three). The buttons stay on one line (`flex-wrap: nowrap`). Set `--actions-w` on the region to this width.
3. **Fit first (so the guarantee seldom has to act).**
   - **Headings wrap.** The base table keeps headings on one line (`whitespace-nowrap`); a masters table does not (`whitespace-normal`). A heading breaks at spaces and after hyphens, so "Price per kg (₹)" takes up to three lines and "Material-Scrap-Rate (₹ per kg)" breaks after "Material-". This is what shrinks the Materials table from 980 px to 602 px in the mock-up (968 px in the build, before).
   - **Names wrap.** A name or description cell breaks anywhere when it must (the build's `BREAK_LONG_NAMES`, `overflow-wrap: anywhere`), up to the 100 characters the form allows. A number never wraps and stays right-aligned.
   - **Expected, not required.** With these rules the narrowest width each masters table can shrink to, with the mock-ups' sample data, is: Process master 565 px (was 699), Materials 602 px (was 980), Customers 664 px (was 620) and Users 664 px (was 576). The last two grew because their buttons no longer wrap onto a second line inside the cell. All four are below 710 px, so none scrolls in the narrowest region. The build's numbers will differ with real data; **a table that still scrolls is allowed, because of part 2.** What is never allowed is an action outside the region.
4. **The region keeps its role.** It stays a focusable, named region (`role="region"`, `tabindex="0"`, name such as "Material Master, scrollable"), so a keyboard user can scroll it (axe `scrollable-region-focusable`). Add **`scroll-padding-inline-end` equal to the Actions column's width** (`scroll-pe-[68px]` for one button): when focus moves to a control that is under the sticky column, such as a name link in the first column, the browser then scrolls it clear of the column and WCAG 2.4.11 (Focus Not Obscured) holds. The page never scrolls sideways.
5. **No column is hidden to make a table fit.** The Admin keeps these lists to check the numbers; a width-dependent set of columns would show two Admins two different lists. The one existing use, the E-mail column of SCR-12 below 1024 px (`hide-md`), stays because the same value is on the edit page; it is not a tool for the tables listed here, and never for the identifying column, a number the list exists to show, or the Actions.

**What the person sees when a table does scroll.** The hairline and the column cut off at the edge say that there is more; the region's name says "scrollable". No arrows, no fade and no hint text are added: a fade that appears only when there is more to scroll needs a script, and a fade that is always there looks like a fault on the tables that fit.

**Why not the other ways.** All four were weighed against the pass line.

| Way | Verdict | Reason |
|-----|---------|--------|
| Headings wrap, nothing else | Part of the rule, not enough alone | It makes these tables fit today, but nothing guarantees it: a sixth value column, a longer unit or a wider font brings DEF-021 back silently. DEF-021 exists because nothing guaranteed the buttons |
| Hide lower-priority columns at the narrower widths | Rejected for these tables | Scrap rate and specific gravity are what the Admin opens Materials to check. Which columns are shown would depend on the window, and a number the Admin cannot see cannot be corrected |
| Stacked rows (cards) up to 1279 px | Rejected | Fifteen rates become a long list that cannot be scanned down a column; tablets and small laptops get the phone layout; SCR-11, which passes today, would change; a second layout would have to be tested at every width from 768 to 1279 |
| Put Edit in the first column (the QA suggestion) | Rejected | The action sits last everywhere else, including the card. A leading pencil before the name breaks that and does not help a table that gets a second action. A sticky last column gives the same guarantee with the action where people look for it |

**Where it applies.**

| Screen and table | Row actions | Actions column | Mock-up |
|------------------|-------------|----------------|---------|
| SCR-11 Process master, Rates | Edit, Delete | 112 px | Uses the rule |
| SCR-12 Customers, list | Edit, Delete | 112 px | Uses the rule |
| SCR-13 Materials | Edit now (Delete arrives with story 02.07) | 68 px now, 112 px with Delete | Uses the rule (drawn with both buttons) |
| SCR-13 Treatment / Color (story 02.05) | Rename, Delete (the "Other" row has none) | 112 px | Uses the rule |
| SCR-14 Users | Edit, Reset password, Deactivate | 156 px | Uses the rule (`--actions-w: 156px`) |
| SCR-13 Exchange rates (story 02.04) | none: it is a form of two fields | n/a | n/a |
| SCR-03 Task queue (Lead), SCR-17 Fields and formulas, and any later list with a row-actions column | row button or link | as built | **Not changed in 0.19.** At 1024 px the SCR-03 Lead queue needs 958 px, the SCR-03 Engineer list 764 px and SCR-17 760 px in a 710 px region, and a row button is partly outside the region (found by scanning every mock-up page at 768, 1024, 1280 and 1440 px). They are not masters tables and belong to other stories; the rule is written for "any table with a row-actions column", so it applies when they are built. Open question OQ-UX-20 |

SCR-00 section 11 shows the scrolling case on a deliberately narrow box.

**Build notes (a sketch; the developer picks the names).** One change in `src/components/ui/table.tsx` and the three list components. `Table` takes the Actions width (`actionsWidth`) and sets `scroll-pe-[...]` on the region; `TableHead` and `TableCell` get an `actions` option that adds `sticky right-0 z-1 bg-surface-2` (header) or `bg-surface` (cell) and the inset hairline; a masters `TableHead` drops `whitespace-nowrap`. The row-action wrapper is `flex flex-nowrap items-center justify-end gap-s-1`. No script is needed, so there is no feasibility question for the solution-architect. The change reaches SCR-11, SCR-13 and, later, SCR-12, SCR-14 and the Treatment / Color list from one place.

**Tests (developer and QA).** Use real Chromium. For SCR-11 and the SCR-13 Materials tab, with one row at least, at 768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366 and 1440 px wide:
- With the region at `scrollLeft = 0` and nothing pressed, the box of every row's action button lies inside the box of the region (left at or after the region's left, right at or before its right).
- The same with the region scrolled to its far end.
- The same again with the table forced to 1000 px wide (`min-width`), so the sticky column and not the fit is what is tested.
- The page does not scroll sideways (`documentElement.scrollWidth` equals the viewport width), and at 360 px the cards show Edit as before.
- Tab to the Edit button of the last row: it is not under the column and the page did not move sideways.
- The QA test of DEF-021 (`test.fail` at 768 px) now fails because the fault is gone, which is the signal to delete the `test.fail` line.

`generator/check-screens.cjs` does the first three for the mock-ups, at all eleven widths, in every state of every page that has a masters table.

**Money and numbers.** INR as "₹ 1,23,456.78" (Indian grouping), USD "$", EUR "€"; two decimals; right-aligned in tables; "—" for a divide by zero (the export cell is empty). Times are IST, written "06 Nov 2026, 17:00 IST".

**Column letters.** Shown as a dark tag (inputs) or a grey tag (outputs and auto fields) with a visually hidden "Excel column". **Letters and cell names in copy are never typed into screens.** Anything that names a column or a cell (AL, AY, BH, BL2, BN2, BO2 and so on) is filled from the field registry, so it stays right after an insert or delete re-letters the worksheet (UX-23, SPEC §17.4). The mock-ups show the seed letters.

**Rounded figures.** Money is shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths. Wherever a Lead is told to reconcile (SCR-06, 07, 10) that sentence is on the screen, and where the difference actually occurs the screen says so with the numbers (UX-02). Working lines on SCR-07 show calculated operands to 4 decimals.

**Password messages (SCR-02, 14, 23).** The rule is decided (their answer, AQP-1 10490, D-19): 10 to 128 characters, at least one number and at least one symbol, not the e-mail address, not a common password. A symbol is any character that is not a letter or a number (working assumption 56, design detail); the hint gives examples and promises no list. The session lasts 12 hours from sign-in. Messages, shown under the new-password field: "The new password must be at least 10 characters." · "Use 128 characters or fewer." · "Add at least one number and one symbol, such as ! # $ or %." (neither present) · "Add at least one number." (only the number missing) · "Add at least one symbol, such as ! # $ or %." (only the symbol missing) · "The password cannot be the same as your e-mail address." (on Admin screens "…the user's e-mail address.") · "That password is too common. Choose a different one." · on SCR-23 also "The two new passwords do not match." and "Your current password is not correct." The hint reads "At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %." Rules are checked on submit; the server names the part that failed.

---

### SCR-00 Design system
**Purpose.** The single reference for tokens, brand, components and state patterns; the review artefact for FR-086 and NFR-020.
**Wireframe.**
```
+--------------------------------------------------------------+
| top bar (logo, ACCUCUT LASERS, bell, account)                |
| 01 Brand · 02 Colour tokens (with contrast ratios)           |
| 03 Type scale | 04 Spacing | 05 Buttons | 06 Form controls   |
| 07 Badges and notices | 08 Node icons | 09 States | 10 Map   |
+--------------------------------------------------------------+
```
**Components.** Card, Badge, Button, Input, Select, Alert, Skeleton, Table. **States.** Static page; no data states. Section 05 also shows each button variant held down (pressed, section 7.3.1). **Responsive.** Cards stack; swatch grid reflows. **Accessibility.** Headings in order, every swatch states its ratio in text, all contrast pairs listed in section 7.

### SCR-01 Sign in
**Wireframe.**
```
+------------------------------------------+
| [logo] ACCUCUT LASERS  Quotation Portal  |
|                                          |
|        Sign in                           |
|        [notice: error / locked / ended]  |
|        +----------------------------+    |
|        | E-mail    [______________] |    |
|        | Password  [__________][eye]|    |
|        | [        Sign in         ] |    |
|        | Forgot your password?      |    |
|        +----------------------------+    |
|  © Accucut Lasers Pvt Ltd. All rights…   |
+------------------------------------------+
```
**Components.** Card, Input, Label, Button, Alert.
**Content.** Title "Sign in"; sub "Use the e-mail and password you were given."; button "Sign in" (loading "Signing in"). Link "Forgot your password?" (R2); in Release 1 plain text "Forgot your password? Ask the Admin to reset it."
**States.** Default · Loading (button disabled, spinner) · Error "E-mail or password is not correct. Check both and try again." (same text for wrong e-mail, wrong password and a deactivated account) · Locked "Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password." · Session ended "Your session ended. Sign in again to continue where you left off." · Permission denied: not applicable.
**Form fields.**

| Field | Type | Required | Validation | Error message |
|-------|------|----------|------------|---------------|
| E-mail | email, `autocomplete=username` | Yes | Present; looks like an address (on blur) | "Enter your e-mail address." / "Enter an e-mail address like name@company.com." |
| Password | password with show/hide, `autocomplete=current-password` | Yes | Present | "Enter your password." |

**Interactions.** Enter submits. Show/hide is a toggle button (`aria-pressed`, name changes). Failed attempt keeps both fields as typed, the password included, and clears nothing; focus moves to the notice. This is the rule for UJ-01 as well (CR-32, settled: the earlier "except the password" in UJ-01 is withdrawn); story 01.01 follows it. **Responsive.** Card is full width below 480 px; 44 px controls. **Accessibility.** Notice is `role="alert"`; the page title is the `h1`; the logo has alt text "AccuCut logo"; a decorative duplicate is never used. The page is marked "do not index" like every page behind it, keeps its title, description and Open Graph title and description, and carries no sharing image (FR-089; PRD v0.7 decision on OQ-UX-03).

### SCR-02 Forgot and reset password (R2)
Request (e-mail, "Send reset link") → "Check your e-mail. If that address is registered, a reset link is on its way. It can be used once." (always the same) → link opens New password and Repeat (the password rule in 6.0, including a number and a symbol; state "Needs number and symbol") → "Your password has been changed." Link used or expired: "This link has already been used or has expired. Ask for a new link." Errors: "The two passwords do not match." Accessibility as SCR-01.

### SCR-03 Task queue (Lead, Admin) and My tasks (Engineer)
**Wireframe (desktop).**
```
+--------+---------------------------------------------------------+
| menu   | Task queue                           [+ Assign task]    |
|        | +-----------------------------------------------------+ |
|        | | Open (5) | Closed (1) | ⏱ Overdue (2)                | |
|        | | [search] [Engineer v] [Customer v] [from] [to]       | |
|        | | chip: Assigned by me (x)    ↓ sorted by deadline     | |
|        | | Task | Engineer | Customer | Folder | Deadline IST | Status | By | ✎ |
|        | | ▌Q-2026-0311 … ⏱ Overdue by 1 d 18 h (amber bar)      | |
|        | +-----------------------------------------------------+ |
+--------+---------------------------------------------------------+
```
**Components.** Tabs, Table (Card list on phones), Input, Select, Badge, Button, Tooltip (folder path), Alert.
**Content.** Tabs "Open", "Closed", "Overdue" with counts. Sort note "Sorted by deadline, earliest first. Overdue tasks stay in Open as well." Customer shows "Not chosen yet" until the Engineer picks one (the assigner does not choose it). Overdue marker: clock icon, "Overdue by 1 d 18 h", amber left bar, tinted row; the three cues appear together (FR-036).
**States.** Default per tab · Loading skeleton · Empty (Lead "No open tasks. Assign a task to an Engineer and it appears here." + Assign task; Engineer "Nothing assigned to you right now. When a Lead assigns you a task it appears here, with its folder and deadline.") · No match · Error · Overdue tab adds a summary notice. Permission denied: an Engineer sees only own tasks; another's task address gives SCR-26.
**Differences by role.** Engineer: no Engineer or Customer column or filters, no Assign button, no row edit; "Assigned by" shown; the "No match" state says "No tasks match your search. Try a different task ID or part of the title." (it does not name filters an Engineer does not have). **Closed rows** show the word "Closed" instead of the reassign action (an approved task cannot be reassigned, A-14; UX-20). Lead: opens with the filter chip "Assigned by me" (removable, FR-035, R1+). Admin: no default filter.
**Filters (R1+, FR-039).** Search by task ID or title; Engineer; Customer; deadline from and to. Filters are in the address.
**Interactions.** Row action "Reassign or change deadline" (R2, open tasks only) opens SCR-04 in edit mode. Counts are worded in the singular where they are 1 ("1 task is overdue"). "Copy path" copies and announces "Path copied to the clipboard." The bell and the "Overdue" tab are the same destination.
**Responsive.** 360: one card per task (ID, status, title, due, overdue line, person, Copy path, Open); tabs share the row width. 768: table keeping Task, Engineer, Deadline, Status (Customer, Folder and Assigned by hide). 1280: full table.
**Accessibility.** Tabs use `role=tablist/tab/tabpanel`, arrow keys move between tabs; rows are not clickable as a whole (the ID is the link) so keyboard and screen readers see one link per row; overdue is also in text; count badges have text.

### SCR-04 Assign task; reassign (R2)
**Wireframe.**
```
Task queue / Assign task
Assign task
[error summary]
+-------------------------------------+  +-- What happens next --+
| Engineer      [Choose an Engineer v]|  | 1 Empty estimate …     |
| Network folder path [\\server\share ]|  | 2 Open queue …         |
| Deadline date [__]  time [__] IST    |  | 3 Customer chosen by   |
| Title (optional) / Notes (optional)  |  |   the Engineer …       |
| [Cancel]                [Assign task]|  | Folder link note       |
+-------------------------------------+  +------------------------+
```
**Components.** Card, Select, Input, Calendar and time input, Textarea, Button, Alert, Tooltip.
**Form fields.**

| Field | Type | Required | Validation | Error message |
|-------|------|----------|------------|---------------|
| Engineer | select of active Engineers | Yes | one chosen | "Choose an Engineer." |
| Network folder path | text | Yes | starts with `\\` (UNC) | "Enter the network folder path. It starts with two backslashes, like \\server\share\RFQ-123." |
| Deadline date | date | Yes | on or after today (IST) | "Choose a deadline later than now." |
| Deadline time | time with IST addon | Yes | with the date, later than now | "Choose a deadline later than now." |
| Title | text, up to 120 | No | length (proposed) | "Keep the title under 120 characters." |
| Notes | textarea, up to 1,000 | No | length (proposed) | "Keep the notes under 1,000 characters." |

**States.** Default · Validation errors (summary with links) · Submitting ("Assigning") · Success ("Task Q-2026-0324 assigned to Arjun Rao." + links) · Alerts OFF notice, tagged "Release 2" ("E-mail alerts are OFF. Arjun Rao will not be e-mailed about this task. It still appears in their queue."; built only when e-mail alerts exist, UX-21) · Edit mode (R2): only Engineer and deadline are editable, folder, title and notes show "Locked", notice "Changes are logged. The log records your name, the time, and the old and new values." Permission denied: Engineers get SCR-26.
**Interactions.** The folder path is shown as a link plus **Copy path** everywhere it appears; the tooltip text is "Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer." Validation on submit; the date-time is checked again on the server.
**Notes and title** are shown afterwards on SCR-05 and SCR-06 ("Notes from Kiran Bose: …", UX-15), so what is typed here reaches the Engineer.
**Responsive.** The side card moves below the form on phones. **Accessibility.** Date and time have visible labels and the "IST" addon is read with the field; the tooltip is also visible text, not hover-only.

### SCR-05 Estimate workspace (Engineer)
**Wireframe (desktop, 1280).**
```
+------+-------------------------------------------------------------------+
| menu | Q-2026-0318 Draft                          [Due 06 Nov 17:00 IST]  |
|      | Task folder \\fileserver\rfq\… [Copy path]  note on blocked links  |
|      | [alerts: Calculate blocked / Submitted …]                          |
|      | Customer [Brightwater Controls v]  note                            |
|      | +-Parts tree--+  1.1 · Base frame      [+Sub-part][+Beside][↑][↓][Delete]
|      | | ✓ 1 …       |  ▬▬▬▬ 24 of 25 inputs complete                      |
|      | | ✓ 1.1  ◄    |  [01][02][03][04][05][06][07][08]  section strip   |
|      | |   1.1.1 …   |  +-01 Part details-+ +-02 Material--+ +-03 Cutting+ |
|      | | ◐ 1.3       |  | A Sl. No  auto  | | E  F  J K L N | | P  Q    | |
|      | | △ 2.1 (miss)|  +-----------------+ +---------------+ +---------+ |
|      | | [+ New item]|  … sections 04 to 08 …        [reserved region →]  |
|      | +--handle-----+                                                     |
|      | ----------------------------------------------------------------- |
|      | Last saved 10:41 IST. Auto-save every 30 s   [Save draft][Calculate]|
+------+-------------------------------------------------------------------+
```
**Components.** Card, Select, Input, InputGroup (unit addon), Label, Badge (column letter), Popover with checkboxes (surface treatments), Textarea, Progress, Resizable panel, Sheet (tree on phones), Alert, AlertDialog, Button.
**Layout rules.**
- Three tracks: **tree** (288 px, resizable 240 to 400 by mouse or arrow keys), **form** (flexible), **reserved region** (0 px now; 340 px when a drawing viewer is added). The form's section cards sit in an auto-fit grid with columns of at least 232 px, so a 340 px region makes three columns become two with no redesign. The review toggle "Show reserved drawing region" demonstrates this. This satisfies FR-087 and NFR-023 at 1024 px and wider (UD-4).
- Section order is SPEC §7.1: 01 Part details (A to D, G, H), 02 Material and dimensions (E, F, J to L, N), 03 Cutting (P, Q), 04 Bending (R), 05 Fasteners (S to U), 06 Welding, drilling and tapping (V to Y), 07 Surface treatment (Z to AG), 08 Other costs and remarks (AJ, AP, AU, BM). Every card header: section number, name, column range tag, "n of m" complete.
- The section strip is a sticky row of 8 jump links with a check, a triangle (missing), or nothing.
- Cards per row follow the width: 1 column on phones, 2 on tablets, up to 3 on desktop (SPEC §7.2). At 1280 px with the tree, three columns fit; at 1024 px, two.
**Content and microcopy.** Intro line "Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals." Customer hint "Choose this first"; helper "Choose the customer this estimate is for. Changing it later asks you to confirm." (the screen never mentions rates, so it does not hint that any exist, UX-24). Under the task folder: **"Notes from Kiran Bose: …"** (the notes typed when the task was assigned, UX-15). Hints under fields as in the screen (Fasteners: "Type "None" if the part has no fasteners."; costs: "Enter 0 if there is none."; Remarks: "Write "None" if there is nothing to add. Enter moves to the next field; Shift+Enter starts a new line.").
**Fields (inputs only; none of these is a cost the Engineer can see computed).**

| Field (letter) | Type | Required | Validation | Error message |
|----------------|------|----------|------------|---------------|
| Part No. (B), Description (D) | text | On Calculate | present | "Enter this value. Use 0 if the part does not need it." for numbers; "Enter this value." for text |
| Part Model (C) | image: paste, drop, choose; camera or gallery on phones; labelled "Optional" | No: not counted as a required input (UX-61, OQ-ARCH-04 answered) | PNG, JPG, GIF or WebP by content; under 200 KB | "\"cabinet-photo.png\" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture." / "Only PNG, JPG, GIF or WebP pictures are accepted." |
| Treatment / Color (G) | select; "Other" reveals text; "Not applicable" listed (a choice in this drop-down only; on no Admin list). Hint: "Choose "Not applicable" if this row has no treatment or colour." | On Calculate | one chosen; text if Other | "Choose a treatment or colour." / "Type the treatment or colour." |
| QTY per Assy (H) | number; the label stays "QTY per Assy" (AQP-1 10551) with the hint "Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4." (UX-52) | On Calculate | 0 or more, 2 decimals | "Enter 0 or more, with up to 2 decimals." |
| Material in Drawing (E) | select; "Not applicable" listed (a choice in this drop-down only). Hint: "From the Material Master. Choose "Not applicable" if this row has no material." Skips the material cost only | On Calculate | one chosen | "Choose a material." |
| Material Considered (F) | auto, read-only, shaded | n/a | from E | n/a |
| Length, Width, Thickness (J, K, L), Part Weight (N) | number, unit addon | On Calculate | as H | as H |
| Cutting Time, Cutting Length (P, Q); No. of Bend (R) | number | On Calculate | as H | as H |
| Fasteners (S) | text, default "None" | On Calculate | present | "Enter this value. Type None if there are no fasteners." |
| Fasteners Qty (T), Cost (U) | number, **shown only when S is not "None" or blank**; otherwise hidden, not required, stored 0 | When shown | as H | as H |
| Weld, Drilling, Tapping, CSK (V to Y) | number | On Calculate | as H | as H |
| Surface treatments (Z to AG) | one multi-select; selected = 1, not selected = 0; none allowed | No | | |
| Machining Cost (AP), Plating Cost (AU), Tool Cost (BM) | number, ₹ addon | On Calculate | as H | as H |
| Remarks (AJ) | textarea | On Calculate | present ("None" is fine) | "Enter this value. Write None if there is nothing to add." |

Material Rate / Kg (I), the Engineer's view of costs, any preview, any total: **never rendered** for Engineers.
**States.**

| State | Behaviour |
|-------|-----------|
| Default | Part 1.1 open, 24 of 25 complete; no errors shown before Calculate |
| Saved | Notice "Draft saved at 10:42 IST."; auto-save line updates |
| Calculate blocked | Summary `alert`: "Nothing was submitted. 3 parts have missing inputs." with each part and its fields as links; triangle icons in the tree; sections and fields with errors turn error red with icon and text; a field with a wrong format shows the format message |
| Picture too large | Inline message in section 01 (see table) |
| No customer | Notice "Choose the customer to start. The form opens as soon as you pick one."; the form is disabled until chosen |
| Change customer | AlertDialog: "Change the customer? … Nothing you typed is lost. The new customer applies the next time the estimate is calculated." Buttons "Keep Brightwater Controls", "Change customer" |
| Unsaved changes | AlertDialog "Leave without saving?" with "Leave without saving" and "Save draft and leave" |
| Delete part | AlertDialog names the count: "This also deletes its 2 sub-parts … Delete 3 parts" |
| Loading | Skeleton cards |
| **Quantity warning** (UX-36 reworded; FR-104, D-22, Q-41) | After Calculate, if any row has 0 in QTY per Assy: an AlertDialog "Check the quantity on 2 rows". Text "You can go back and change the count, or go ahead." and one line per row, the row a link to its field: "QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate." Buttons "Go back" (the safe choice, holds focus) and "Calculate anyway" (runs the calculation). No figure beyond that 0, and none of the words rate, price or formula (UX-24). The field rule stays "0 or more" and the field has no message of its own |
| **Warning with a new list** | If the dialog opens again because something changed after Calculate was pressed, it shows the new list under "The list changed. Something changed after you pressed Calculate, so this is the new list. Check it again." |
| Submitted | Notice with the single message "Cost will be calculated based on the input fields and sent for review/approval."; badge Submitted; inputs read-only; action bar shows a disabled "Submitted"; **part actions (sub-part, part beside, move, delete), "New item", Replace, Remove, "choose a file" and the paste hint are not shown**, because they would refuse (UX-07); no number anywhere |
| Approved | "Approved and locked." read-only, with the same actions removed; **no price shown** |
| Permission denied | Another Engineer's task: SCR-26 |

**Interactions.**
- **Enter** moves to the next visible, editable field in order; in Remarks, Enter moves on and Shift+Enter inserts a line; on the last field Enter moves focus to **Calculate** (it never submits). Buttons and links keep their normal Enter behaviour. Mobile keyboards show a "next" key.
- Tree: add sub-part, add part beside, add item, move up, move down, delete. Reordering is by buttons (and arrow keys with Alt) so no dragging is required. After each change Sl. No renumbers and the change is announced ("Part renumbered to 1.2").
- Completion: "24 of 25 inputs complete" (progress bar with text); per-section counts; per-node icons: check, half circle, empty circle, triangle.
- Auto-save every 30 seconds (R1+, FR-054); Save draft is always available; leaving with unsaved changes asks first.
- Calculate checks every node, not only this part. A row with 0 in QTY per Assy does not stop Calculate: the quantity warning asks first.
- Copying data between parts is **not offered** (UD-3).
**Responsive.** 360: one column of cards; "Parts tree" button (shows the current node) opens the tree as a left drawer (`Sheet`) with a scrim; the sticky action bar stays; the stepper scrolls inside its own strip; Part Model offers camera or gallery. 768: tree is a collapsible left panel (240 px, "Parts tree" button toggles); 2 columns. 1024: tree persistent; 2 columns. 1280: 3 columns; the reserved region adds a track on the right.
**Accessibility.** Tree is `role="tree"` with `treeitem`, `aria-level`, `aria-selected`; arrow keys move, Enter opens; each node's missing-data state is text for screen readers. Every input has a visible label and its letter ("Excel column J" read first by screen readers). Section cards are labelled regions. Errors use icon, thick border and text. The sticky stepper and action bar do not hide a focused field (scroll padding, WCAG 2.4.11). The progress bar has a text equivalent. Dialogs follow 6.0. Part Model is operable without a mouse (choose a file button). **Part Model is optional** (UX-61): it is labelled "Optional", is not counted as a required input and has no missing-picture message.

### SCR-06 Estimate review (Lead, Admin)
**Wireframe.**
```
Task queue / Q-2026-0318
Estimate Q-2026-0318  [Submitted]      [Due …] [Open folder] [Copy path]
[cleared / not calculated / rates changed / warning / approved notices]
+--BL Total Unit Production Price--+ +--BN BL / total Tool Cost--+ +--BO Approved Quote Price--+
| ₹ 12,629.99  (Cleared when an    | | 2.58  (a dash when cleared)| | Not set yet, or the price  |
| input changed)                   | |                           | | labelled "Approved earlier"|
+----------------------------------+ +---------------------------+ +---------------------------+
▸ How the total is built (the BG of every row added up)
+-Parts tree--------------+  1.4 · Top cover                          [View cost details]
| 1       2 nos      0.00 |  +-THIS ROW, on screen and in the Excel row-+
| 1.4     2 nos    618.37 ◄ | ₹ 618.37   (BG, its count of 2 included)  |
| 1.4.1  12 nos    801.57 |  | $ 7.61 · € 6.97                           |
|                         |  +--------------------------------------------+
|                         |  Inputs: stepper + section cards (editable until locked)
-----------------------------------------------------------------------------
Calculated 05 Nov 10:42 IST · config v9     [Download .xlsx][Recalculate][Approve and lock]
```
**Components.** Card (stat), Badge, Tree, Details (how the total is built), Alert, AlertDialog, Button, plus SCR-05's form.
**The quantity rule on screen (settled, AQP-26 and Q-35 (b)).** The Engineer types the count for the whole order on every row (QTY per Assy, column H): 2 frames, 6 pipes and 24 lids in all. A row's BG already holds its own count (BB = BA × H). BL is the sum of every row's BG (`SUM(BG)`), at any quantity, and nothing is multiplied by the rows above. **A parent shows only its own row:** there is no Σ figure, no sum of the rows below, no item total and no second box. Example: with each lid 1, each pipe 1 and nothing on the frame, the lid row shows 24, the pipe row 6 and the frame row 0, and the total is 24 + 6 + 0 = 30. In the sample estimate row 1.1.1 has a count of 16 (2 cabinet assemblies, 2 base frames in each, 4 gussets on each frame).
**One box per row (UX-53).** Every row, parent or not, has one box, "This row, on screen and in the Excel row": its BG, then "In US dollars $ … , in euros € …" (its own BJ and BK), and one sentence on the rounding rule (6.0, UX-02). Its count is shown beside the row in the tree ("2 nos") and in the table below. The tree legend reads "Each figure is that row's own BG. The count for the whole order (QTY per Assy) is shown beside it and is already included. The estimate total adds every row's BG." The pairing with an export row is gone, because the two are the same figure. No row ever shows "Not multiplied again", "counts it 2 times", "pieces counted" or "Rows above multiply by".
**Content.** Tiles show the plain name with the letter tag (BL, BN, BO) and "File cell BL2, BN2, BO2". BN when Tool Cost totals 0: "—" with "No Tool Cost entered on any part, so there is nothing to divide by. File cell BN2 is left empty." BO before any approval: "Not set yet". BO when approved: the price, then "₹ 29.99 lower than the calculated total (₹ 12,629.99). Reason given: Rounded down to a whole hundred for the customer quote." or "No reason given." (the reason is optional). "How the total is built" is a table, one line per row: Sl. No, part, the count for the whole order (H), and the row's BG, ending with the total (the sum of the BG column), under the worked example of the rule and the rounding sentence.
**States.**

| State | Behaviour |
|-------|-----------|
| Default (Submitted) | Tiles, tree, one box per row; primary button "Approve and lock" |
| **Total cleared** (D-20, Q-37 (a)) | Notice "The total is cleared because an input changed." / "Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off." BL tile "Cleared"; BN a dash "Cleared with the total."; BO "Not set yet" ("You set it when you approve, after Recalculate."). "How the total is built" is hidden. In the tree every figure reads "Cleared" in italics (the count stays, it is an input) with the line "Every calculated figure is cleared because an input changed. Press Recalculate to see them again."; the node box reads "Cleared". **No figure is shown as "out of date"** and there is no legend for one. Primary button **Recalculate**; Approve and lock disabled (described by "Recalculate first. Approving is available once the figures have been calculated again."); Download .xlsx disabled (described by "Calculate or Recalculate first. There is no file until a calculation is current.") |
| Not calculated | Info "The Engineer has not calculated this estimate yet. You can enter or correct inputs. Press Calculate to see costs. Approve and lock and the Excel download stay off until then."; tiles show "Not calculated" and a dash for BN; the tree and node box show dashes; the primary button is **Calculate** (a Lead may calculate, A-08); Approve and Download disabled with their reasons |
| Draft after unlock | Notice "Unlocked on 05 Nov 2026, 12:05 IST by Kiran Bose. Reason: … The figures below are still the ones from the approval. As soon as you change an input every calculated figure is cleared. Recalculate to bring them up to date … The price approved earlier stays until a new approval replaces it. The task is back in Priya Nair's Open queue."; badge Draft; BO shows the price labelled **"Approved earlier"** ("Approved by Kiran Bose, 05 Nov 2026, 11:20 IST. It stays until a new approval replaces it. File cell BO2."); primary **Recalculate**; Approve disabled until then (UX-04, UX-59) |
| **Unlocked and changed** | The same notice with "An input has changed since, so every calculated figure is cleared." Tiles and tree as in Total cleared; BO still shows the price labelled "Approved earlier" |
| No Tool Cost | BN shows "—" |
| **Rates changed** (UX-62; OQ-ARCH-06 answered "Tell the Lead") | While the figures are current and the estimate is not approved: an info notice "Rates changed since this was calculated. 2 rates and 1 material price changed since this was calculated at 10:42 IST. Recalculate to use them. Approving is not blocked." with a link to Recalculate. Counts only, by kind; no old or new value. Not shown on an approved estimate (its figures stand) or while cleared |
| **Quantity warning (Recalculate)** (UX-44; A-08, A-26) | When a Lead or Admin presses Calculate or Recalculate and any row has 0 in QTY per Assy, the same dialog as on SCR-05 opens, with "You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead." Buttons "Go back" and "Recalculate anyway" ("Calculate anyway" on a Draft). Shown over the Total cleared state |
| **Warning on this calculation** (UX-45, UX-46) | Shown only while the figures are current: Submitted, Approved and Draft after unlock. A warn notice above the tiles: "Quantity warning on this calculation. Priya Nair went ahead on 05 Nov 2026, 10:42 IST with 0 in QTY per Assy on 2 rows: 2.2 Support arm and 2.3 Spacer. Each of these rows costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant." Each such row carries the tag "Quantity 0" (icon and words) in the tree and in "How the total is built". If a Lead recalculated, the notice names the Lead and that calculation's time (each calculation keeps its own record, A-26). **A wording preview** with example rows, labelled on the screen: the sample estimate has no row with 0 |
| Approved (Lead) | Notice with approver and time; inputs read-only; BO tile shows the price, the difference from the calculated total and the reason given (or "No reason given"); **Unlock** replaces Approve; "Locked. Values stay as approved even if rates change later."; "Only the Admin can cancel an approval." No Cancel button |
| **Approved (Admin)** (UX-64) | As Approved, and a danger button **Cancel approval** beside Unlock |
| **Cancel approval (Admin)** | AlertDialog "Cancel the approval of Q-2026-0318?": "The estimate goes back to Draft and the task returns to Priya Nair's Open queue, as it does when it is unlocked. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval, after a Recalculate, brings a price back." Fields: **Reason for cancelling** (required; "It is kept in the audit log.") and **Your password** ("We ask for your password again because this changes a price that was approved."). Buttons "Keep the approval" (safe, holds focus) and "Cancel approval" |
| **Approval cancelled (Admin)** | Notice "Approval cancelled on 05 Nov 2026, 12:05 IST by Meera Iyer. Reason: … The estimate is a Draft … The price stays on screen, marked "Approval cancelled", and is not in the Excel file."; BO tile "₹ 12,600.00, Approval cancelled"; a danger button **Remove price**; Recalculate primary; Approve disabled |
| **Approval cancelled (Lead)** | The same, with no Remove price button and "Only the Admin can remove it" |
| **Remove price (Admin)** | AlertDialog "Remove the approved price?": "The price ₹ 12,600.00 will be removed from every screen and from the Excel file. The audit log keeps it, and only you can read it. This cannot be undone. A new approval, after a Recalculate, is the way to set a price again." Field **Your password**. Buttons "Keep the price" (safe) and "Remove price". A separate dialog from cancelling: no single step does both |
| **Price removed** | Notice "The approved price was removed on 05 Nov 2026, 12:20 IST by Meera Iyer. The audit log keeps it. Approve again, after a Recalculate, to set a price."; BO reads "Not set yet" |
| Loading | Tile skeletons while recalculating |
| Error | "We could not calculate this estimate. Nothing was changed. Try again; … give the Admin this reference: req-7f3a91." |
| Permission denied | Engineers reach SCR-05 at this address, never this screen; a Lead who sends a cancel or remove request gets the no-access answer |

**Notes** from the task are shown above the status notices (UX-15). **Not applicable (Q-36, settled):** the Material and Treatment / Color drop-downs here offer "Not applicable" as they do for the Engineer; the part shows the words as its value; Material Rate and Material Considered are blank; the words are on no master list. **Interactions.** Recalculate runs on the server (up to 2 s for 500 nodes, NFR-008) and refreshes the figures; "View cost details" opens SCR-07; Download opens SCR-10 and is off unless the figures are current; the bar line "Calculated … configuration version 9" records FR-031.
**Responsive.** 360: tiles stack; tree is a drawer; the action bar wraps with full-width buttons. 768: tree collapsible. 1280: as the wireframe.
**Accessibility.** Tiles are a labelled group; each total is text in an `h`-free structure with its tag; the cleared, warning, rates-changed and approved notices are `role="status"`; the disabled Approve and Download have `aria-describedby` with the reason, which the notice also states in visible text. A cleared figure is the word "Cleared", not an empty box. The count beside a tree row has a visually hidden "Count for the whole order". The Admin dialogs are `alertdialog`, the safe button holds focus, the password field has a visible label and a hint, and both dialogs follow 6.0.

### SCR-07 Cost details
**Purpose.** FR-058, 059, 060 (a Lead reads every formula here in Release 1, PRD v0.7 decision on OQ-UX-18, with no edit control), 026, 100: all calculated fields for one row in six stages, each with its formula next to the value.
**Layout.** Row header and the one box of the row (see SCR-06), then six `details` panels: **1 Weights and areas** (M, O, AH, AI) · **2 Material cost** (I shown as reference, AK) · **3 Process costs** (Cutting AL; Bending AM; Welding, drilling, tapping AN, AO; Surface treatment AQ to AX; entered directly AP, AU; AY Total) · **4 Sub total** (AZ, BA, BB) · **5 Rejection, overheads and logistics** (BC, BD, BE, BF) · **6 Pricing** (BG highlighted dark, BH, BI, BJ, BK).
Each line: column tag, name, formula in letters (mono), the same formula with values (muted mono), value right-aligned. **The working uses the operands that were really used:** inputs and rates as typed, calculated values to 4 decimals (for example AK = (2.8260 × 58.00) − (0.4260 × 22.00) = 154.54), so a Lead who repeats the arithmetic gets the printed figure (FR-058, UX-01). A sentence under the stages says so and states the rounding rule; stage 5 explains when its total differs from its lines by a few hundredths ("The three lines above add to … as shown, and the stage total is …. The portal adds the unrounded values, then rounds once."); no sample row needs it after the whole-order change, and the page adds it when a row does.
**Rules.** Unselected treatment lines (AQ to AX; the seven that depend on a flag) are **hidden**, with a line "6 treatment lines are hidden because they are not selected for this part. They are still calculated and exported as 0." Divide by zero shows "—". Percent rates are shown as typed (11%). **A row whose material is "Not applicable"** (UX-34; Q-36 settled: the words show to everyone) shows Material Rate blank, 0.00 for Blank Weight, Scrap Weight and Material Cost, and no worked line for those three; the other stages work as usual and labour and other costs on the row still count. **Scrap Weight (O)** shows the seeded formula `IF(Material-Specific-Gravity > 0, M - N, 0)` and, in its working line, that the specific gravity is above 0 (UX-41; architecture 4.9, A-21), so a Lead who checks the printed formula sees what the portal runs.
**States.** Default · **Assembly row (Not applicable)** · **Total cleared** (UX-57: the row header stays; in place of the box and the six stages the page says "Cleared. Press Recalculate", "An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.", with a link to the estimate; the tree reads "Cleared" on every row) · Loading · Error. **Responsive.** Desktop: beside the inputs as a side panel at 1280 and wider, a full column below that. Tablet: accordion, all open. Phone: accordion, only stage 1 open, formulas wrap. **Accessibility.** `details/summary` are keyboard operable and announce expanded or collapsed; formulas are text not images; the total of each stage is in the summary.

### SCR-08 Approve and lock (dialog)
Fields: **Approved Quote Price (BO)**, ₹, pre-filled with BL, editable. Validation "Enter a price in rupees, 0 or more, with up to 2 decimals." **Reason for the different price (Optional)**, a textarea of up to 500 characters (the limit is my proposal), shown only when the price differs from the calculated total; hint "You can leave this empty. If you give one, it is kept with the override in the audit log and shown next to the Approved Quote Price. Up to 500 characters."; error on submit "Use 500 characters or fewer." (UX-43; "under 500" read as fewer than the 500 the hint allows); saved only when the price differs (UX-31; their answer "Reason optional"). The dialog cannot be reached while the total is cleared, because Approve is disabled. States: Default (info "If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.") · Price changed (warn "This price is ₹ 29.99 lower than the calculated total. A different price is recorded as an override with your name, the time, the calculated total, the price you set and your reason, if you give one.", the input shows ₹ 12,600.00 and the empty reason field) · Price changed with reason · Reason too long · Invalid · Saving ("Approving") · **Quantity warning on this calculation** (UX-48: one info line, "This calculation has a quantity warning. 2.2 Support arm and 2.3 Spacer cost 0 in this estimate … Approving is not stopped, and there is no box to tick."; example rows, wording preview) · **Rates changed** (UX-62: "Rates changed since this was calculated. 2 rates and 1 material price changed since this was calculated. Approving is not blocked. Close this window and Recalculate first if you want them used."; counts only, one line) · **After an unlock** (UX-59: "A price approved earlier is on the estimate. ₹ 12,600.00, approved 05 Nov 2026, 11:20 IST. Approving now replaces it."; the tile behind shows BO as "Approved earlier") · **Estimate changed while open** (UX-43, server answer 409 `TOTALS_OUT_OF_DATE`: danger alert "An input changed while this window was open. The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again."; Approve is disabled and "Recalculate first" replaces Cancel as the way on). Buttons "Cancel", "Approve and lock". After success: inputs read-only, task to Closed, audit entry (approval and, if different, override with the reason). The difference and reason are shown on the BO tile (SCR-06), on SCR-10 and in the audit log. Dialog is `dialog`, focus to the price field.

### SCR-09 Unlock (dialog)
Field: **Reason for unlocking** (required textarea): "Enter a reason. It is kept in the audit log." Notices: configuration changed (versions 7 → 9) and rates changed (counts; OQ-ARCH-06 asks whether a Lead should be told the same before approval), or "Nothing has changed … since approval." Text states that recalculating after unlock uses current values. Buttons "Keep it locked", "Unlock". States: Default · Changed · Reason missing · Saving. Effect: estimate to Draft; task reopens in the Engineer's Open queue.

### SCR-10 Excel export
**Layout.** When a calculation is current: a file card (file name, row count, A to BO, **Download .xlsx**); a card **"The rows in the file"**: Sl. No, Part, Qty (H) for the whole order, **In the file: BG** and **In the file: Tool Cost (BM)**, ending with a row "BG column added up: BL2, the same as the total on screen" and the **Total Tool Cost** row below the parts; a card **"How BL2 is made"**; and a checklist of what the file holds, with BL2, BN2, BO2 and the Total Tool Cost. There is no "On screen" column and no second table (UX-54): a parent shows only its own row.
**How BL2 is made (AQP-26).** Add the BG column and you get BL2, at any quantity. Each row's BG already holds the count for the whole order that the Engineer typed, so nothing is multiplied by the rows above. The page gives the example (2 frames, 6 pipes and 24 lids are typed as 2, 6 and 24) and keeps the rounding sentence.
**Totals in the file (their answer, D-16: "One total only", and "yes he Total Tool cost should be shown").** BL2, BN2 and BO2 appear once, in row 2. There are no totals per item. The **Total Tool Cost** (the plain sum of every part's Tool Cost entry, with no quantity applied) is in the Tool Cost column of the row two below the last part, so one empty row separates it from the parts, with its label "Total Tool Cost" in the cell to its left. It cannot go in row 2, because the Tool Cost cell of row 2 is the first part's own entry; no part's own Tool Cost cell is hidden or replaced. BN2 divides BL2 by this value. This matches architecture 4.6; the cell is found by role, so it follows its column when letters move (UX-23). The mock-up shows seed letters (file row 13).
**Content.** File name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx`: spaces in the customer name become underscores, other characters outside A-Z, a-z, 0-9, underscore and hyphen are removed, at most 60 characters, "Customer" if nothing is left, and the date is the IST date of download (the architect's answer to OQ-UX-08, proposed). Lead and Admin at any status; Engineers get SCR-26. The reconciliation ends with the rounding sentence and, where the ten lines differ, "The lines of the table above add to 12,630.01 as shown, and the total is 12,629.99" (UX-02).
**No file until a calculation is current (Q-37 (b), A-32; UX-58, UX-65).** The download is refused for a never-calculated estimate and while the total is cleared, with no way round it. Both states show the notice, an empty state with a link to the estimate ("Go to the estimate to Calculate" or "to Recalculate"), **no file card and no table**. There is no out-of-date file, no `_OUT-OF-DATE` name, no OUT OF DATE sheet tab, no notice row and no confirmation dialog any more. Not calculated: "There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current." Total cleared: "The total is cleared because an input changed. There is no file to download until you press Recalculate." / "The file would hold figures that no longer match the inputs, so the portal does not build one. After Recalculate the download comes back."
**States.** Default · Building ("Building the file. 10 parts, 1 picture. This usually takes a few seconds.", button disabled) · Error with reference · Empty ("Nothing to export yet": no parts) · Approved (BO2 shows the price; under it, how far it is from the calculated total and the reason given; "The reason is shown here, on the estimate and in the audit log. It is not written into the file", OQ-UX-19) · **After an unlock** (UX-59: BO2 holds the price approved earlier, "approved earlier on 05 Nov 2026, 11:20 IST. It stays until a new approval replaces it."; after the Admin cancels an approval BO2 is empty) · **Not calculated** · **Total cleared** · **Quantity warning on this calculation** (UX-47: the same notice as on SCR-06 above the tables with the same "Quantity 0" tag, and "The file holds no warning: it keeps the rows as they are, with H 0 and BG 0" (A-24); the checklist says "No warning cell"; a wording preview with example rows). **Limit:** a file downloaded while current can go out of date later on someone's disk; only the date in its name tells. **Responsive.** The tables scroll inside their own focusable, named region; the notice and the buttons stack at 360. **Accessibility.** The file name is real text; the empty states are `role="status"` regions with a link; each scrollable table is a focusable, named region.

### SCR-11 Process master
Table: Rate name · Unit · Default value · Used in (letters) · Customers with own value · actions. Add rate dialog fields: **Rate name** (unique; "Enter a name." / "A rate with this name already exists."), **Unit**, **Default value** (number, 0 or more, 2 decimals: "Enter a number, 0 or more, with up to 2 decimals."); hint "Names ending in % are typed as whole percentages: 12 means 12%." States: Default · Saved · Add · **Customers differ** (R1+: "17 customers had 0.47 and now have 0.52. 3 customers have a different value." per-customer Apply or Keep radios, "Keep all 3", "Apply to all 3", "Save choices") · **Delete blocked** ("Cutting-Rate-per-Sec cannot be deleted while a formula uses it" with the formula list; the link to Fields and formulas shows only once that page is live, see "The Delete blocked link while Fields and formulas is planned" below, 0.17) · **Rate deleted elsewhere (0.17)** · Loading · No match · Error. Phone: cards. The Unit list holds every unit used in the table (second, stroke, hole, kg, sq ft, sq in, %). The table lists 15 rates, with the names and units given by the delivery lead (SPEC section 4.1, D-38; AQP-1 comment 10672). **Plating-rate-per-sqin** (per sq in) is used by no formula, because Plating Cost (AU) stays typed in (Q-42), so its Used in cell reads "None yet" and no customer holds its own value. The Add rate example is Buffing-rate-per-sqin, not a seed name, and the No match example searches "buffing". Values on the screens are invented; none comes from the delivery lead's sheet (ADR-014). The rate-unit half of OQ-UX-07 is closed.

**A rate that was deleted elsewhere (added in version 0.17, AQP-113, QLT-06; master G6 condition 5).** The Admin has Edit rate or Delete rate open, and the rate was deleted after they loaded the list: in another tab or window (only one Admin is active in Release 1, so this is usually their own second tab). The save or the confirmation is answered "not found" (404). Trying again can never succeed, so the screen does not offer it.
- **Order.** (1) The dialog closes at once. It shows no error inside itself, and the values typed in Edit rate are dropped. (2) A page notice appears in the same slot as the "Saved" notice, under the page header and above the list, and replaces any notice already there. (3) The list is read again, and the rate is gone from it. (4) Focus moves to the page heading (below).
- **The words.** `<name>` is the rate's name as it was when the dialog opened, as in the Edit user dialog; it is never read again from the server. The notice has a bold first line and one sentence under it.

| Dialog | Tone and icon | Bold line | Sentence |
|--------|---------------|-----------|----------|
| Edit rate | Warning (amber, clock icon) | `<name> no longer exists.` | `It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add rate.` |
| Delete rate | Information (neutral, i icon) | `<name> was already deleted.` | `It was deleted after you opened this list, so there was nothing to delete.` |

Read as one text, the Edit notice is: "Pine-rate-per-sec no longer exists. It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add rate." (invented name). The warning tone is used for Edit because the Admin lost typed work; the information tone is used for Delete because what they wanted is already true and nothing was lost. The words do not say who deleted it (it may be the Admin's own other tab) and do not blame.
- **Role: `status` (polite), on both.** The shared `Notice` gives the warning and information tones no live role, so the build sets `role="status"` on these two. Not `alert`: nothing failed, no data is at risk, no decision is waiting, and an assertive message would cut off the announcement of where focus landed. `alert` stays for what is wrong and needs action now, such as "We could not save the changes."
- **Not a toast.** SCR-11 uses page notices (the "Saved" line, the "form did not open" line) and no toast. A toast that vanishes after 5 seconds would take the only explanation with it, while the Admin looks at a changed list. The notice has no timer. It clears on the next press of Add rate or of any row button (the same rule as "Saved") and on leaving the page. A list that fails to reload does not clear it; the Error (load) state shows below it and takes focus as section 6.0 says.
- **Not the "Try again" notice.** That one ("We could not save the changes. Check your connection and try again. Nothing was changed.") stays for network and server failures only. For a 404 it is wrong twice: it promises that a retry can work, and it says nothing was changed while the rate has gone.
- **Focus.** Focus goes to the page heading (the `h1`, which already has `tabindex="-1"`) as the dialog closes. It does not go to the row's button first: that button is about to disappear with the row, and focus would fall to the top of the document. It does not wait for the list to load. The heading is chosen over the Search field (a programmatic focus there opens the on-screen keyboard on a phone, over the notice) and over Add rate (a primary action that one Enter press would start). A screen reader says "Process master, heading level 1" and then reads the polite notice. A keyboard user's next Tab stops are Add rate and Search, in the page order.
- **The same rule for any dialog on this screen:** when the button that opened a dialog no longer exists once the list is read again, focus goes to the heading. A successful delete is the other case, because the deleted rate's row and button are gone as well; "focus returns to the trigger" (section 6.0, Dialogs) has no answer there without this line.
- **Responsive and accessibility.** At 360, 768 and 1280 px the notice is full width and wraps; a long rate name wraps inside the line (`overflow-wrap: anywhere`) and never scrolls the page sideways. Icon plus text, never colour alone; the tones use the existing notice tokens, so no colour is added. Tests (developer): for each of Edit and Delete, answer the request with 404 and assert that the dialog is closed, one role `status` holds exactly the strings above, the list was requested again, the row is gone, no `alert` is on the page, and `document.activeElement` is the `h1`.

**The Delete blocked link while Fields and formulas is planned (decision of version 0.17, AQP-113, QLT-11; recommendation to the product-owner, who amends AC-4 if it agrees).** The refusal's link goes to `/config/fields` (SCR-17), which the route manifest lists as `planned` for Release 2 and which answers "not found" today. Recommendation: **plain text until the page is live; the link appears by itself when it is.**
- **Release 1 wording (route `planned`).** The dialog keeps its title, **"This rate is used by a formula"**, and the formula list (Column, Field). The sentence under the title reads **"`<name>` cannot be deleted while a formula uses it. Formulas cannot be changed until Release 2, so this rate stays on the list."** The footer holds one button, **Close**, which takes the first focus. There is no link and no disabled button.
- **Live wording (route not `planned`).** As built: **"`<name>` cannot be deleted while a formula uses it. Change those formulas first."** and the footer buttons **Go to Fields and formulas** (link styled as a secondary button) and **Close**; Close still takes the first focus.
- **One switch.** The choice is read from the route manifest row of `/config/fields` (`status`), not from a date and not from a second flag, so the day Release 2 makes the route live both the link and the sentence change with no edit to the dialog. A test covers both states of that one value.
- **Why not keep the link.** It sends the Admin from a dialog that has just stopped them to a "page not found" screen, where they cannot do what the sentence told them to do. It is the one place in Release 1 where a link is certain to fail. In Release 1 the advice "Change those formulas first" is also something the Admin cannot do at all, because no formula editor exists yet; the Release 1 sentence says so and says what follows (the rate stays).
- **Why not a disabled link or button.** The Disabled rule (section 6.0) asks for a visible reason, and the sentence already gives it. A dead control in a dialog that the Admin reads once adds a stop for the keyboard and a name for the screen reader, and it offers nothing. The disabled "Change password" item (SCR-25) is a permanent part of the menu, which is a different case.
- **The mock-up.** `screens/SCR-11.html` shows the live wording (the final design). It is not changed in 0.17. It has no frame for "Rate deleted elsewhere" yet; add one when the delivery lead asks.

**The table from 768 px: the same rule applies (added in version 0.19; DEF-021 / AQP-234).** Yes. SCR-11 is a masters table, and it passes today only by luck.
- **Numbers.** QA measured the build's Process master table at 718 px with the headings on one line. The region is 718 px at 768 px and **710 px at 1024 px**, with the side menu open: 8 px short. The table then scrolls 8 px sideways. The Edit button is still seen only because the cell has 16 px of padding to its right of the button; a longer rate name, a longer unit or one more column would push it out as on SCR-13. At 768 px the content and the region are both 718 px, so there is no margin there either.
- **What changes.** The same two parts as SCR-13 (section 6.0): the headings wrap (the widest are "Customers with own value" and "Default value"), and the Actions column is sticky at the right edge. In the mock-up the table can then shrink to 565 px (was 699). The columns, the words, the states and the cards below 768 px do not change. The Actions column is 112 px: Edit and Delete.
- **One change, two screens.** The change is in the shared `Table` and its list components, so SCR-11 and SCR-13 are fixed by the same edit. Recommendation to the product-owner: make it in the fix for AQP-234, not as a second story, and add SCR-11 to that fix's tests (the 11 widths of section 6.0).
- **Mock-up.** `screens/SCR-11.html` uses the rule; at 1024 px it showed no fault before either, because its sample data is narrower than the build's.

### SCR-12 Customer master
List (name, phone, e-mail, rates that differ) → edit page: Details (name required and unique: "Enter the customer name." / "A customer with this name already exists."; phone, e-mail, address optional, e-mail format "Enter an e-mail address like name@company.com.") and a rates table (default, this customer, "Differs from default" tag). **Reset to defaults** opens an AlertDialog naming the rates that will be replaced. New customer starts with all defaults. **Delete** (UX-16): a trash button on each row opens an AlertDialog ("Marlow Agro Systems no longer appears in this list or in the customer choice on new estimates. Estimates that are already calculated keep their figures. You cannot undo this here."; buttons "Keep customer", "Delete customer"). While an open estimate uses the customer: "Brightwater Controls cannot be deleted yet" naming the estimate with a link, and "Approve it, or move it to another customer, and then delete this one." Deletion is soft (A-13). Whether delete should exist is OQ-UX-14. States: List · Edit · New · Reset dialog · Delete · Delete blocked · Loading · Empty · No match · Error. Percent rates use whole numbers.

### SCR-13 Materials, exchange rates, treatment list
Tabs. **Materials:** Material in Drawing (unique), Material Considered, Price per kg, Specific gravity (must be above 0: hint "Must be above 0.", message "Enter a value above 0.", UX-37), **Material-Scrap-Rate** (per kg; the column and the field in the Add material dialog carry this name; it is the parameter of Material Cost, AK; SPEC section 4.3, D-39). **"Not applicable" is not listed here or on any Admin list** (their answer, D-17: "Do not show this anywhere in the portal, even for admin"); the system holds it with all values 0 and offers it only as a choice in the estimate form's drop-downs. Duplicate: "A material with this name already exists. Names must be unique." **Exchange rates:** 1 USD in ₹, 1 EUR in ₹, saved together, "Last updated by Meera Iyer, 02 Nov 2026, 15:10 IST." Hints: "Converts prices to US dollars. The rate (BH) feeds Unit Production Price (USD), BJ." and the same for euros (BI, BK); the letters come from the registry (UX-23). **Treatment / Color:** rename, delete, add; "Other" is locked ("Always offered; the Engineer types the text"); "Not applicable" is not listed. Rates are never sent to Engineers. **Delete** on materials (UX-16): AlertDialog "This material no longer appears in the Material in Drawing list. Estimates that are already calculated keep their figures."; blocked while an open estimate uses it ("MS sheet, cold rolled cannot be deleted yet" with the estimate named). The "Other" row has no delete. States: Default · **Add · Edit · Saved** · Duplicate name · Specific gravity 0 · **Empty · No match** · Delete · Delete blocked · Loading · Error. The words of the Materials tab, including Add, Edit, Saved, Empty and No match, are fixed in "The Materials tab: final words" below (added in 0.18); Delete and Delete blocked are story 02.07's.

**The Materials tab: final words (added in version 0.18, AQP-122; master G6 condition 4, DL-115).** Story 02.03 built the Materials tab and proposed the words this section lacked (developer hand-off, Jira 11181). They are ruled here, and these are the words of the build. A sibling screen's pattern is used wherever one exists: SCR-11 for the list states, SCR-12 for "Enter the ...", SCR-14 for the dialog buttons. Two strings are amended; the rest are confirmed as built. The mock-up `screens/SCR-13.html` is not changed in 0.18; it shows all three tabs, which is the final design (see "The page description until Exchange rates and Treatment / Color exist").

| Where | Words | Ruling |
|-------|-------|--------|
| Page title | `Materials and lists` | Unchanged. It is the menu entry and stays through Release 2 |
| Page description | See the next heading | Amended for Release 1 |
| Tab bar | One tab, `Materials`; the tab list is named `Lists` | Confirmed (see the next heading) |
| Search label (visible) | `Search materials` | Confirmed. Longer than SCR-11's "Search" because this page will hold three tabs |
| Search placeholder | `Material in Drawing or Considered` | **Amended** from "Material in Drawing or Material Considered", which does not fit at 360 px: it measures 267 px in the product font at 14 px, and the text area of the field at 360 px is about 232 px (page padding 16, card and field borders, card padding 16, 48 px left for the icon, 12 px right), so the end is cut off. The new text measures 212 px. The search looks in both columns and ignores letter case |
| Add button, Add dialog title, Add dialog button | `Add material` ; while sending `Adding material` | As the mock-up and SCR-11's pattern |
| Edit button and its accessible name | Icon button in the table, text button `Edit` on a card; both named `Edit <Material in Drawing>` | Confirmed, as the mock-up. The name tells identical icons apart |
| Edit dialog title | `Edit <Material in Drawing>`, as it was when the dialog opened | Confirmed (SCR-14's pattern). Footer: `Cancel`, `Save`; while sending `Saving` |
| Field labels | `Material in Drawing` · `Material Considered` · `Price per kg` (unit ₹) · `Specific gravity` (hint `Must be above 0.`) · `Material-Scrap-Rate (per kg)` (unit ₹) | Confirmed |
| Column headings and card labels | `Material in Drawing` · `Material Considered` · `Price per kg (₹)` · `Specific gravity` · `Material-Scrap-Rate (₹ per kg)` | As the mock-up. The unit is in the heading, so a cell holds only the number |
| Page notice after Add | `<Material in Drawing> was added. The change is in the audit log.` | Confirmed (SCR-11's "Saved" pattern; `role="status"`, no timer) |
| Page notice after Edit | `<Material in Drawing> saved. The change is in the audit log.` | Confirmed, same pattern as SCR-11 |
| Failed Add or Edit | Danger notice at the top of the dialog: `We could not add the material.` or `We could not save the changes.`, then `Check your connection and try again. Nothing was changed.`; the typed values stay | Confirmed (SCR-14's "Failed") |
| Edit that changes nothing | The dialog closes, nothing is sent, no message | Confirmed (SCR-14's "Nothing changed"). The API's own sentence for this case is never shown on the screen |

**Messages under the fields.** Checked when Add or Save is pressed, not while typing. Each message clears when that field is edited, the typed values stay, and focus goes to the first field that has a message.

| Field | When | Message |
|-------|------|---------|
| Material in Drawing | Empty or spaces only | **`Enter the Material in Drawing.`** (amended: the build said "Enter a name.", which is SCR-11's and SCR-14's sentence for a field called Name) |
| Material in Drawing | More than 100 characters | `Use 100 characters or fewer.` |
| Material in Drawing | Another material has this name, ignoring letter case | `A material with this name already exists. Names must be unique.` |
| Material Considered | Empty or spaces only | `Enter the Material Considered.` (confirmed) |
| Material Considered | More than 100 characters | `Use 100 characters or fewer.` |
| Price per kg, Material-Scrap-Rate (per kg) | Empty, not a number, below 0 or more than 2 decimals | `Enter a number, 0 or more, with up to 2 decimals.` (SCR-11's sentence for a number) |
| Specific gravity | A number that is 0 or below | `Enter a value above 0.` (UX-37, unchanged) |
| Specific gravity | Empty, not a number, or more than 2 decimals | `Enter a number above 0, with up to 2 decimals.` (confirmed; the same shape as the sentence above it, with "above 0") |

*Why the two "required" messages changed together.* The two sat side by side in one dialog, one saying "Enter a name." and the other "Enter the Material Considered." (quality finding QLT-08). Both now follow SCR-12's "Enter the customer name.": "Enter the" followed by the field's label, spelled as the label is. A screen reader reads the label first and the message second, so the repeated words cost nothing and the message still makes sense on its own. *Specific gravity decimals:* the limit of 2 is accepted as built. The business-analyst is asking the delivery lead whether it is enough. If it is not, only the last row changes ("... with up to N decimals.") and the hint and the first row stay.

**Empty and No match (new states, Materials tab).** Both sit in the list area, below the search, in a `role="status"` region. **Add material is above the list at all times**, so neither state holds a second Add button.

| State | When | Content |
|-------|------|---------|
| **Empty** | No material exists (the search is not the reason) | Plus icon, title `No materials yet`, text **`Add the first material. A part's Material in Drawing is chosen from this list.`** No button. SCR-11's "No rates yet" is the model |
| **No match** | The list has materials, none contains the search text | Search-off icon, title `No material matches "<what was typed>"` (spaces at both ends removed, straight quotation marks as SCR-11 writes them), text `Check the spelling, or clear the search.`, secondary button `Clear filters`. The button empties the search and puts focus back in it |

*Why the Empty text changed.* The build said "The estimate form offers only the materials on this list." That is not quite true: the form's Material in Drawing drop-down also offers "Not applicable" (section 6, SCR-05 and SCR-06), which the delivery lead asked never to show on the Admin's screens (D-17). "Is chosen from this list" is true without naming it. *"Clear filters"* is SCR-11's label and is kept so the master screens match, although the search is the only filter here. *To check in the build:* a long search text with no spaces must wrap inside the No match title at 360 px and not widen the page (the names in the table already wrap this way); SCR-11's title is built the same way, so fix both together if it overflows.

**Loading and Error (load) of the Materials tab.** Loading: the rows are replaced by skeleton rows while the list is read again, and a polite status says `Loading the materials`. Error: title `We could not load the materials`, text `Check your connection and try again. Nothing was changed.`, button `Try again`; focus goes to the title.

**The Materials table from 768 px (added in version 0.19; DEF-021 / AQP-234, master G7 condition 1 on AQP-122).** The table follows "Masters tables" in section 6.0; this paragraph states what it means here, so the build and the test can be written from it.
- **Pass line.** At every viewport width from 768 to 1440 px, the Edit button of every row is visible without scrolling the table. The words of AC-7, "no horizontal page scroll", stay true and are not enough on their own.
- **Columns, in order.** Material in Drawing · Material Considered · Price per kg (₹) · Specific gravity · Material-Scrap-Rate (₹ per kg) · Actions. The headings are the words ruled in version 0.18; only their wrapping is new.
- **What wraps.** The headings wrap at spaces and after hyphens (three lines at the narrowest). The two name columns wrap, anywhere if they must, up to the 100 characters the form allows. The three number columns never wrap and stay right-aligned.
- **Actions column.** Edit only, as built, until story 02.07 adds Delete: **68 px** (one 36 px button and 16 px of padding on each side); **112 px** with Delete. It is the last column, sticky at the right edge of the region, with an opaque fill and a hairline on its left (section 6.0, part 2). The button's name stays `Edit <Material in Drawing>`.
- **Expected, not required.** With the sample data of the mock-up the table can shrink to 602 px, so in the narrowest region (710 px, at 1024 px) it does not scroll; before, it needed 980 px (968 px in the build). The developer measures the build with 100-character names. If the table still scrolls, the sticky column keeps Edit in view and nothing else changes.
- **Below 768 px.** Cards, unchanged: the Edit button is a full-size button on each card.
- **Treatment / Color tab (story 02.05).** Same pattern: Name, then Actions (Rename, Delete: 112 px). The "Other" row has no buttons.
- **Mock-up.** `screens/SCR-13.html`, Materials and Treatment / Color tabs, uses the rule. It draws Edit and Delete because Delete is the final design. SCR-00 section 11 shows a table that scrolls with its Actions column held in place.
- **Tests (developer).** The list in section 6.0, "Tests", on the Materials tab. The QA test of DEF-021 is the one that must go green.

**The page description until Exchange rates and Treatment / Color exist (decision of version 0.18; master G6 condition 4, standards finding).** The build's description, "Material prices, exchange rates and the treatment and colour list.", promises two tabs that do not exist until stories 02.04 and 02.05, and the page's description meta says the same. A person who reads it looks for the tabs and does not find them. **The rule: the page description and the description meta name only the tabs that are in the tab bar, in tab order. The story that adds a tab adds its words to both in the same change.**

| Tabs in the bar | Page description (under the title) | Description meta (search result, link preview) |
|-----------------|------------------------------------|-----------------------------------------------|
| Materials only (**Release 1 today, story 02.03**) | **`Material prices, specific gravity and scrap rates.`** | **`Manage the materials used in estimates.`** |
| Materials, Exchange rates (story 02.04 lands first) | `Material prices and exchange rates.` | `Manage materials and exchange rates used in estimates.` |
| Materials, Treatment / Color (story 02.05 lands first) | `Material prices and the treatment and colour list.` | `Manage materials and the treatment and colour list used in estimates.` |
| All three (final; the mock-up's words) | `Material prices, exchange rates and the treatment and colour list.` | `Manage materials, exchange rates and the treatment and colour list used in estimates.` |

- **One tab in the bar is correct.** The screen shows no tab it cannot open: no disabled tab and no "coming soon" tab. This is the rule of the Delete blocked link in SCR-11 (0.17): a dead control gives the Admin a stop and a name to read and offers nothing. The build's tab bar (one tab, named `Lists`) is accepted. The tab list keeps its name `Lists` so that it needs no edit when the other tabs join.
- **The title stays `Materials and lists`.** It names the page, not the tabs, and it is the menu entry (section 4).
- **Test (developer, 02.03 and each later story).** The description and the meta contain the name of no tab that is not in the tab bar: for the Materials-only page, neither contains "exchange" or "treatment".

### SCR-14 Users
Table (name, e-mail, role, status, actions: edit, reset password, deactivate). Add user: name, e-mail, role, first password (the rule in 6.0: 10 to 128 characters, a number and a symbol; the person must change it at their first sign-in, SCR-23). Password messages: see 6.0; states "Password too common" and "Needs number and symbol" (add user), "Password same as e-mail" and "Reset: needs number and symbol" (reset). A second Admin: "There is already an active Admin. Only one Admin can be active." with the Admin named in the page notice. Own row cannot be deactivated (disabled with an accessible name that says why). Reset password dialog; deactivate AlertDialog ("Arjun Rao can no longer sign in. Their tasks and estimates stay as they are. You can activate them again later."; from Release 2 it adds "You can reassign their open tasks.", UX-21). **Hand over Admin role** (R2) in one step with a user choice and a warning that the caller becomes a Lead and is signed out. States: Default · Add · Second Admin refused · **Edit · Edit own row · Edit with second Admin refused · Form did not open (added in 0.14)** · Password too common · Needs number and symbol · Reset · Password same as e-mail · Reset: needs number and symbol · Deactivate · Hand over · Hand over: wrong password · Loading · Error. The hand-over asks for the Admin's password again (FR-006, NFR-004; PM decision on OQ-UX-17): a field "Your password" with the hint "We ask for your password again because this is the biggest change in the portal." and, when wrong, "That password is not correct. Try again." (state "Hand over: wrong password"). A password the Admin sets or resets is temporary: that user is taken to "Set a new password" (SCR-23) at the next sign-in and reaches no other page until done (FR-004).


**Edit user (added in version 0.14, AQP-65; the first design left it undrawn).** The pencil button in a row (36 px in the table) and the Edit button on a phone card open it.
- **Title and context.** "Edit <name>", with the name as it was when the dialog opened (it does not change while the person types). Under the title, the person's e-mail as plain muted text: the e-mail is the sign-in name, so it is shown and **not editable**, and it is not a disabled field.
- **Fields.** Name (required) and Role (Engineer, Lead, Admin), in that order, with the same labels, sizes and messages as in Add user: "Enter a name." and "Use N characters or fewer." There is no e-mail field and no password field; the password is changed by Reset password.
- **Buttons.** Cancel (secondary) and Save (primary), in the order of Add user. While it works Save shows "Saving" with the spinner and is disabled. Escape and Cancel close it and send nothing; focus returns to the button that opened it.
- **Own row.** The Role field is disabled and its hint reads "You cannot change your own role." (the field's accessible description). The name can still be edited. The server refuses it as well (AQP-65 AC-4).
- **Second Admin.** Choosing Admin while another Admin is active is refused as in Add user: the dialog stays open with the typed values, "There is already an active Admin. Only one Admin can be active." sits under Role and takes focus, and the page notice names the Admin.
- **Nothing changed.** Save closes the dialog, sends nothing and shows no message, because nothing was saved.
- **Saved.** The dialog closes, the list is read again, and a success notice on the page says "<name> was saved." (the build's wording, confirmed).
- **Failed.** A danger notice at the top of the dialog: "We could not save the changes." and "Check your connection and try again. Nothing was changed." The typed values stay.
- **Accessibility.** The dialog is named by its title; focus starts on Name; the e-mail line is read after the title; Role's reason (own row) is read with the field.

**The Admin's own row (added in version 0.15, AQP-65, standards finding STD-08).** Three controls differ on the row of the signed-in Admin. **Edit** stays available (the name can change; the role cannot, see above). **Deactivate** is disabled, named "You cannot deactivate your own account" (AQP-65 AC-4). **Reset password** is disabled, and its accessible name is **"Reset password is not available for your own account. Use Change password in the account menu."** (the developer's wording, adopted, with its full stop).
- **Why the name starts with "Reset password".** On a phone card the button shows the words "Reset password", and the accessible name must contain what the button shows (WCAG 2.5.3, section 8). The table button is an icon with no visible text, so it takes the same name. Deactivate has no text button on a card, so its shorter name stands.
- **Why the Admin cannot reset their own password.** A reset sets a temporary password, ends the person's sessions and forces a change: done to oneself it signs the Admin out in the middle of the action. Change password asks for the current password and is the right path.
- **What the sighted person sees.** The disabled button looks disabled. On a phone card the reason is also text under the buttons: "To change your own password, use Change password in the account menu." The table shows no extra text (a disabled button cannot take focus or a tooltip); the name carries the reason for a screen reader.
- **Where "Change password" is.** It is the first action in the account menu (SCR-25, section 6.0: name, e-mail, role, **Change password**, Sign out) and opens SCR-23, where the Admin changes their own password with the current one. Today the item is shown disabled with a note, because its page arrives with story 01.05 (AQP-81). Until then the sentence points to an item that is present and says it is coming; that is accepted, and 01.05 makes it work. Nothing in the wording changes.

**The password hints before story 01.05 (decision of version 0.14).** The designed hints for First password and for Reset password begin with the rule: "At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %." Until story 01.05 applies the rule (FR-098) to those two paths, the page leaves that sentence out. **Accepted as an interim:** a hint must not promise a check that the page does not make, and a person who relies on it would be misled. The other sentences stay, because they say what the portal does now: "Tell the person in person or by phone; the portal does not e-mail it until Release 2. The person must change it at their first sign-in." and "The old password stops working straight away. The person must change it at their next sign-in." (the temporary flag is stored now; the forced "Set a new password" page arrives with 01.05, so a person who signs in before then is not yet stopped, and the sentence is a notice, not a promise of refusal). Story 01.05 puts the rule sentence back at the start of both hints and adds the four password-rule states in the list above. The mock-ups show the final text.

**A dialog that does not open (added in version 0.14).** Add user, Edit, Reset password and Deactivate load their code the first time any of them is pressed (section 7.3.1 rule 11; architecture section 10). If that fails, the pressed button goes back to rest (the held look and `aria-busy` are removed) and a **page notice** appears at the top of the page content, under the page header: danger style, `role="alert"`, title **"The form did not open."** (Add user, Edit, Reset password) or **"The confirmation did not open."** (Deactivate), text **"Check your connection and try again."** The text is the sentence of the SCR-25 lines. It clears on the next press of any of these buttons, on Escape and on a change of page; there is no timer. Focus stays on the pressed button, and the notice is brought into view if the page is scrolled so that it is off the screen (the nearest position, no smooth scrolling; the measured sticky offsets keep it clear of the top bar). A second press while the code loads is ignored (rule 11). **Why a page notice and not the line under the control of SCR-25:** that line exists for the two controls of the fixed top bar, which must not move. Here the controls are "Add user" in the page header and 36 px buttons in table rows and cards, inside a table that scrolls in its own box (which would clip a line placed under a button), and the same dialogs open from many rows. One notice for the page is simpler and is what this page already does for "Second Admin refused" and a failed save. The rule for the whole product is in SCR-25.

### SCR-15 Settings (Last backup line R1 core, e-mail alerts R2)
Switch **E-mail alerts: ON** (role `switch`, state written in words), sender name, sender e-mail, **Send test e-mail** (to the Admin's own address, OQ-UX-09). Mail server credentials are not here ("set on the server by Accucut IT"). A read-only **Last good backup** line ("Sunday 01 Nov 2026, 02:00 IST. Finished without errors."; FR-105, answered Yes, AQP-1 10549; UX-63) and a **Server disk** line. It is firm, not proposed: it shows the last good weekly backup, "Backup late" after 8 days without one (the architect's threshold) and "Disk nearly full" below 20 % free. It starts, restores and changes nothing, and only the Admin can open this screen. The page adds "Backups are kept on the same server." States: ON · OFF · Test sent · Test failed ("The mail server did not answer…") · **Sender not allowed** ("The mail server did not accept this sender address for this mailbox. Change the sender e-mail address to one the mailbox is allowed to send from, or ask Accucut IT."; the sender stays editable) · **Backup late** ("No backup has finished for 8 days. Ask Accucut IT to check the weekly backup.") · **Disk nearly full** ("Disk nearly full. Less than 20 % of the server disk is free. Backups are kept on the same server, so ask Accucut IT to free space or add disk.") · Save failed · Loading.

### SCR-16 Audit log and change history
Filters: Who, Event, From, To. Columns: When, Who, Event, Object, Before → after (the arrow is an icon with the text "to"). No edit or delete control anywhere. A **price override** entry reads "Calculated ₹ 12,629.99 to Approved ₹ 12,600.00. Reason: …" or "… No reason given" (the reason is optional, UX-31). An **Approval cancelled** entry reads "Approved at ₹ 4,750.00 to Cancelled. Reason: …" and a **Price removed** entry "Price ₹ 4,750.00 removed from the estimate. The audit log keeps it" (UX-64; only the Admin reads the log). A **quantity warning** entry (event `calculation.warning_acknowledged`, UX-49) reads "Went ahead after a warning for 0 in QTY per Assy on 2 rows: 2.2 Support arm, 2.3 Spacer"; every press that goes ahead, an Engineer's Calculate or a Lead's Recalculate, is one entry (A-26). Event filter: Approval, Unlock, Price override, **Approval cancelled**, **Price removed**, **Quantity warning**, Master data edit, **User change** (R1); **Task change** (R2, FR-040); Configuration change: Formula edit, Field insert or delete, Checkpoint revert (R2, FR-079). A revert reads "Version 8 → Version 9 (from version 7)": the version it made and the version it copied (UX-19). Lead edits to inputs are not logged (OQ-ARCH-07). States: All · Configuration (R2) · **No entries match · No entries yet (0.16)** · Loading · Error. Phone: cards that follow the chosen filter. Decisions of version 0.16 (AQP-74) follow.

**Time format (decision of version 0.16, AQP-74 AC-6).** Every time on this screen is written as section 6.0 says, **"06 Nov 2026, 17:00 IST"**, in the table, on the phone cards and inside entry texts (a deadline in a Task change entry reads "03 Nov 2026, 17:00 IST to 04 Nov 2026, 12:00 IST"). The earlier mock-up wrote the time bare under a column header "When (IST)"; that is withdrawn. A phone card has no column header, a row copied out of the table loses it, and one rule with one shared formatter is simpler than two. The column header is plain **"When"**. The time is shown to the minute, in the IST day, whatever the time zone of the browser.

**Page description (decision of version 0.16).** Release 1 text: "A record of approvals, unlocks, price overrides, cancelled approvals, removed prices, quantity warnings gone ahead on, master data and user changes. The portal has no way to edit or delete an entry." The page's own description meta reads "A record of approvals, unlocks, price overrides, master data and user changes." This replaces "A permanent record…" and "Nobody can edit or delete an entry", which claim more than the design gives. The portal and the database refuse to change or remove an entry (triggers; the runtime role has no update or delete right, AQP-74 AC-1), but whoever has access to the server can reach the database and its backups (ARCH-R8). The log is a record, not a control over the Admin, so the sentence says what the portal does and no more, and the page says nothing about who can or cannot tamper from outside it. The Release 2 stories that write task and configuration events add "task and configuration" to the list (the mock-up shows that final text).

**Event kinds by release (confirmed).** The Event filter and the description list only the kinds that can have entries in the release being built. Release 1: Approval, Unlock, Price override, Approval cancelled, Price removed, Quantity warning, Master data edit, User change. **Task change (FR-040) and Configuration change (FR-079: Formula edit, Field insert or delete, Checkpoint revert) are left out of the Release 1 build** and join the filter, the description and the event registry in the stories that write them. The mock-up labels them Release 2.

**Empty states (decision of version 0.16).** Two, and they are not the same.

| State | When | Content |
|-------|------|---------|
| **No entries yet** | No filter is set (Who "Everyone", Event "All events", From and To empty) and the log holds nothing | Shield icon, title "No entries yet", text "Changes to users, masters and approvals are recorded here as they happen." **No button:** there is nothing to clear and nothing to do |
| **No entries match** | At least one filter is set and nothing matches | Same icon, title "No entries match", text "Try a wider date range or another event type.", and the button **Clear filters** (secondary) |

The developer's "No entries yet" is confirmed as built. **Clear filters** sets all four filters back, reads the list again and moves focus to the Who filter (the button disappears, and focus must not fall back to the top of the page). Neither state shows the "Showing N of M entries" line. Each is a polite status when it appears, not an alert.

**User change entries (version 0.16).** One entry for each change, written in the same transaction as the change (AQP-74 AC-2). The Event column shows the category "User change". Object is the person's name after the change. Before → after is in words, with no "Name:" or "Role:" in front (the values say what they are), in the style of the existing entries:

| Event | Before → after |
|-------|----------------|
| `user.created` | Not added → Added as Engineer |
| `user.renamed` (PM decision, AQP-74 comment 11077) | Arjun Rai → Arjun Rao (the old name, then the new one) |
| `user.role_changed` | Engineer → Lead |
| `user.deactivated` | Active → Deactivated |
| `user.activated` | Deactivated → Active |
| `user.password_reset` | Earlier password → Temporary password set |

Each changed attribute makes its own entry: a save that changes the name and the role shows two lines with the same time, both with the new name as Object, and a save that changes nothing writes none. No password, hash or token appears in any text (AQP-74 AC-4). The wording of the five existing entries is the developer's, confirmed here.

**Who and Object: the name at the time (decision of version 0.16).** Both columns show the name **as it was when the entry was written**, so that a record reads the same for ever; for Object this was already the rule (AQP-74 AC-5, architecture 5.1). A rename, now audited, therefore does not change how earlier entries read: an entry written when the person was "Arjun Rai" says "Arjun Rai" in Who, and the rename entry joins the two names. Showing the current name would rewrite history on the screen, and an Admin who renames a person could make earlier entries read as someone else's. **The Who filter works by person, not by the text:** its list shows each person by the current name, and choosing "Arjun Rao" finds that person's entries, including those that read "Arjun Rai". **This needs the entry to keep the actor's name** when it is written (a column beside the actor id, which is all that architecture 5.1 lists today), so it is a change for the solution-architect and the developer; the table is new in this story and holds no data to carry over. If the architect finds that too much for this story, the fallback is the current name, with the rename entries as the trace, recorded as a known limit and not as the intended design.

### SCR-17 Fields and formulas (R2)
Table in column order: Column · Field · Section or stage · **Kind** (Input, Auto, Output; BH and BI are Outputs as in SPEC §7.4) · Formula · actions (Admin: edit formula, insert after, delete). **System fields** (A, H, BG, BL, BM, BO) show a lock tag "System" and no delete (BM, the Tool Cost, because the export total and BN depend on it, UX-40); **Edit formula** is not offered on A, F, I and BO, which have no formula to edit (UX-08). Scrap Weight (O) is listed with its seeded formula `IF(Material-Specific-Gravity > 0, M - N, 0)` (UX-41). BL is listed as `SUM(BG)` with one sentence: "The estimate total is the sum of every row's BG. Each row's count is typed for the whole order, so nothing is multiplied by the rows above." (UX-09; the formula and sentence replaced under AQP-26). **Lead view:** same table with no actions and a banner "View only. Formulas are shown so you can check the arithmetic." The side menu marks it "View only". States: Default · Loading · Error. Search by letter, name or formula; filter by kind. Phone: cards of key rows with search.

### SCR-18 Formula editor (R2)
Monospace editor, suggestion list (letters with field names, rate names), live check (300 ms pause) in a polite live region, preview against a chosen sample row ("Sample rows come from the latest calculated estimate, Q-2026-0318. The preview changes nothing."; with none: "There is no calculated estimate to try this on yet. The check above still works."), "Used by" list. The function line names `SUM(column)`, which adds a column over every row of the estimate. Messages: valid "The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY." · unknown `"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.` · syntax "The formula ends too soon. A number or name is missing after "+" (position 29)." · loop "This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references." Save is disabled until valid; saving opens the password step: "Confirm with your password"; wrong: "That password is not correct. Try again." Too many wrong passwords: "Too many wrong passwords. Try again in 15 minutes. Your formula is kept." (the same pattern applies to the password steps on SCR-20 and SCR-21). Success: "Formula saved as configuration version 10." **Editing BL:** the formula shows `SUM(BG)` and "SUM(BG) adds the BG of every row. Each row's BG already holds the count for the whole order, so nothing is multiplied by the rows above. BN and BO read from it." The earlier warning for a BL formula without ROLLUP is removed (ROLLUP is gone, AQP-26).

### SCR-19 Insert field (R2)
Three steps: 1 type (Input, Output, Input and its cost column); 2 details (**input:** label, type of value, default, **insert after column**, group, unit shown beside the input, hint, Excel column width, Excel number format, choices one per line for "Choice from a list", and a visibility rule "Always" or "Only when another field has a value"; **cost column:** label, position, formula, stage in cost details, "hide the line when this input is 0" (hide-when-zero), width and format; UX-10); 3 preview of letter changes ("AY → BA" and so on, including the product cells BL2 → BN2, BO2 → BQ2) and **Insert 2 fields**. Notices: new inputs are mandatory and visible to Engineers; new outputs are hidden from them and join a total only when that total's formula is edited; approved estimates keep their layout. Errors: "Enter a label."; unknown name in the formula as SCR-18. No password step (FR-080 lists only save, delete and revert).

### SCR-20 Delete field (R2)
Dialog over the list. **Blocked** (state label "Blocked by formulas"): "Cannot delete AL Cutting Cost yet. 1 formula uses this field." with the referencing formulas and an Edit link. **Confirm:** "No formula uses this field. Deleting it moves every later field one letter to the left." + password; "Delete field" (danger). Wrong password: message in the dialog.

### SCR-21 Checkpoints and versions (R2)
Current version card (version number, saved by and at, what uses it), **Save as a checkpoint** (name required: "Enter a name for this checkpoint."), checkpoint table (name, version, saved, by, **Revert**). Revert dialog: what happens (new version, estimate data untouched, approved estimates keep theirs, can be undone), password. After revert a success notice offers **Revert to the version from before** (undo). States: Default · Saved · Name missing · Revert · Wrong password · Reverted · Empty · Loading · Error. In the mock-up the history is one story: checkpoint "Before AY insert" is version 7 (01 Nov 17:00), a formula edit made version 8, the revert on 02 Nov 11:30 made version 9, which is the current configuration; a revert now would make version 10.

### SCR-22 E-mail alert previews (R2)
Three plain, branded messages: **Task assigned** (To Engineer, Cc assigner; task, folder, deadline IST, "Open the task"), **Task overdue** (same recipients; "This task is now overdue. It was due on …"), **Daily digest** at 11:00 IST (To Engineer with overdue tasks, Cc the Leads who assigned them; table of tasks and "Overdue by"). Alerts OFF: nothing is sent. No cost, rate or customer price in any message. Each e-mail also has a plain-text version with the same lines; links are full addresses.

### SCR-23 Account
Profile (name, e-mail, role: read-only) and Change password: Current, New (the rule in 6.0: 10 to 128 characters, a number and a symbol), Repeat. Errors: "Your current password is not correct." / "The new password must be at least 10 characters." / "Use 128 characters or fewer." / "Add at least one number and one symbol, such as ! # $ or %." (or the number-only and symbol-only versions) / "The password cannot be the same as your e-mail address." / "That password is too common. Choose a different one." / "The two new passwords do not match." Success: "Your password has been changed. Use the new one the next time you sign in."
**"Set a new password" state (UX-17).** Shown to the first Admin (the bootstrap command sets `must_change_password`) and to anyone whose password the Admin set or reset (FR-004; PM decision on OQ-UX-15). Heading "Set a new password"; notice "Choose a new password to continue. The password you were given is only for your first sign-in. Until you change it, every page opens this one. After that you go straight to your work."; no profile card and no side menu. States: Default · Errors · Too long · Needs number and symbol · Same as e-mail · Too common · Must change password · Success.

### SCR-24 About
Logo, "ACCUCUT LASERS · Quotation Portal", one description sentence, **kept exactly as the delivery lead approved it** ("The wording is fine.", AQP-1 10490, OQ-UX-10, SPEC §9): "The Accucut Quotation Portal helps Accucut Lasers prepare, review and approve manufacturing cost estimates. Engineers enter part details, the portal does the calculation, and a Lead or Admin reviews and approves the estimate." It contains the word "cost" and that is accepted: the word is descriptive text, not a cost value, and the Engineer-page check allows this sentence, **"Version No: 1.0"**, **"© Accucut Lasers Pvt Ltd. All rights reserved."** exactly (FR-010).

### SCR-25 Navigation and account menu
Table of what each role sees (section 4 as a matrix); how the menu behaves at each size; the open account menu. Phone frame shows the drawer.


**Account trigger: accessible name (added in version 0.13; DEF-014, WCAG 2.5.3 Label in Name).** The trigger shows text: the **initials** in the avatar at every width, and the **name** and the **role** from 768 px (the arrow is an icon). Its accessible name must contain that visible text, in the same order, at every width. Then a person who says what they see ("click MI") reaches the control, and a screen reader says what the screen shows. One name, the same at every width and in every state:

`Account menu, <initials>, <name>, <role>`, for example `Account menu, MI, Meera Iyer, Admin`.

| Width and state | Text the screen shows | Accessible name | Contains the visible text? |
|-----------------|-----------------------|-----------------|----------------------------|
| 360 to 767 px (avatar and arrow), closed | MI | `Account menu, MI, Meera Iyer, Admin` | Yes. The name and role are not shown here; they stay in the name so a screen-reader user still hears who is signed in |
| 768 px and wider, closed | MI, Meera Iyer, Admin | `Account menu, MI, Meera Iyer, Admin` | Yes, the whole shown text, in order |
| First open pending, First open failed, open | Unchanged | Unchanged | The state is carried by `aria-busy`, `aria-describedby` and `aria-expanded`, never by the name |
| The Radix trigger that replaces the plain button on the first open | Unchanged | Unchanged | The same face component gives the same name |

- **The parts are the drawn ones.** `<initials>` is the same value the avatar draws (one function for both, never a second string). `<name>` and `<role>` are the words the screen shows ("Admin", "Lead", "Engineer"). If a long name is cut with an ellipsis on screen, the full name stays in the accessible name.
- **A space between the parts in the markup.** The check reads the text of the control as the markup writes it. Initials, name and role are separate elements, and with nothing between them it reads "MIMeera IyerAdmin", which the name does not contain. So the markup has a real space between the initials and the name and between the name and the role (in React, `{' '}`); the space between flex items draws nothing. Tried with axe-core 4.14.0 on the build's structure (inline avatar, a block name wrapper with two block lines): with the new name but no spaces it fails at 768 px and wider; with a space between the initials, the name and the role it passes; at 360 px, where the name and role are not shown, it passes either way.
- **Commas** make a screen reader pause between the parts. The WCAG 2.5.3 match and axe ignore case and punctuation, so "MI, Meera Iyer, Admin" contains "MI Meera Iyer Admin".
- **One name, not one per width.** A name that changed with the window would need resize logic, could differ between the server render and the browser, and would change under a person who turns a tablet. The extra words at 360 px cost nothing.
- **"Account menu" stays first.** 2.5.3 asks that the name contain the visible text, not that it begin with it; starting with the purpose keeps the name a screen-reader user already knows. Starting with the visible text (`MI, Meera Iyer, Admin, account menu`) is the best practice WCAG mentions. If the check with Voice Control on the iPhone shows that "tap MI" fails with the current order, switch to that order and change nothing else.
- **The avatar stays `aria-hidden`.** The name is on the button, so the initials are not read twice. A screen reader may say "MI" as a word or as two letters; that is accepted.
- **Not affected:** the menu button (`Open menu`, an icon with no visible text), the bell, and the menu panel ("Account"). The mock-ups carry the same name on every page.
- **Tests (for the developer):** at 360, 768 and 1366 px the trigger's name equals the pattern, the name contains the text the trigger shows (read from the page, spaces collapsed, case ignored), and axe's `label-content-name-mismatch` passes at all three widths (the markup rule above is what makes it pass; it belongs to the WCAG 2.1 A tag, so `wcag21a` must be in the tags the shared axe helper runs). AQP-188 AC-4 names the old pattern, `Account menu, <name>, <role>`; it becomes `Account menu, <initials>, <name>, <role>`. A locator that starts `Account menu` still finds the control.

**Controls that load on first open (added in version 0.11; AQP-188, DEF-013).** The menu button (below 1024 px) and the account trigger do not carry their panel in the first load. The panel is fetched the first time the control is pressed (architecture section 10). The two controls look and sit exactly as before: same face, same place, same accessible name (`Open menu`; for the account trigger see "Account trigger: accessible name" below), `aria-haspopup="dialog"` and `"menu"`, `aria-expanded="false"`. Nothing moves when the page loads, when the code arrives, or when a state below appears (0 px, no layout shift).

| State | What the person sees | Attributes and behaviour |
|-------|----------------------|--------------------------|
| Closed (rest) | The control at rest: menu button = secondary icon square, 44 px; account trigger = white face, `--border` edge, avatar, name and role from 768 px, arrow | `aria-expanded="false"`. Pressing it (finger, mouse, Enter, Space, ArrowDown on the account trigger) starts the first open |
| **First open pending** (code loading, or the person pressed before the page was interactive) | The control keeps its **pressed look, held**: `--border` fill, `--ink` text, `--shadow-pressed`, from the first frame until the panel opens or the open is cancelled. No spinner, no new label, no size change | **Enabled**, `aria-busy="true"` (section 7.3.1 rule 11). A second press does nothing: no second request, no flicker. **Escape cancels** from anywhere on the page: the look and `aria-busy` go (200 ms fade), the panel stays closed even if the code arrives, focus stays. If the other first-open control is pressed meanwhile, the last press wins and the first returns to rest. When the code arrives the panel opens with focus as today (keyboard: first enabled item; menu button: into the drawer) |
| **First open failed** | The control returns to rest. **One failure line** appears directly under it (below). The page keeps working | `aria-busy` removed, control enabled. Focus stays on the control. The line has `role="alert"` and is named by the control's `aria-describedby` while it shows. Pressing the control again clears the line at once, shows the pending state and sends a new request; a later success opens the panel |
| Open | The drawer or the account menu, as today (focus trap and Escape for the drawer; not modal for the account menu) | `aria-expanded="true"`. Unchanged by this version |
| Disabled, empty, partial, loading skeleton, permission denied | Not applicable. Both controls are on every page for every signed-in role and are never disabled; what the menu lists per role is decided by the server (the matrix above). The pending state is the loading state | |

**Failure line.**

| Control | Text (exactly) |
|---------|----------------|
| Account trigger | The account menu did not open. Check your connection and try again. |
| Menu button | The menu did not open. Check your connection and try again. |

The wording of the solution-architect (AQP-188 AC-8) is confirmed as written: it says what happened, says what to do, and does not blame the person. The longer ending "…try again, or reload the page" is kept for the case the architect named (the bundler caches a failed chunk, which makes a retry useless); it is not used otherwise.

- **Look.** The notice pattern of section 7.4 in its error colours: `--danger-soft` fill, 1 px `--danger-line` edge, a 4 px `--danger` bar on the left, a 16 px alert icon (decorative) and the text in `--danger-ink`, 14 / 400, `--shadow-2` to lift it off the page. The text is 7.87:1 on the fill. The icon and the words carry the meaning, not the colour.
- **Place, without moving anything.** It is positioned absolutely under its control (4 px gap) inside a wrapper the size of the control, so it takes no room in the top bar and moves nothing (0 px, no `layout-shift` entry). Under the menu button it starts at the button's left edge; under the account trigger it ends at the trigger's right edge, so it never runs off the screen. Width fits the text up to 320 px and never more than the window less 16 px a side; at 360 px the text wraps to two lines, never more. It overlays the top of the page content until it is cleared.
- **How it clears.** Pressing the control again; Escape; moving to another page (the top bar stays on screen between pages, so the line must not follow the person); a success of either control. There is no timer: a message that vanishes by itself can be missed (WCAG 2.2.1). Only one failure line shows at a time; a failure of the other control replaces it.
- **Focus.** Stays on the control. It is not moved to the line: the alert is announced, and a person who tabs back to the control hears the line as its description.
- **Controls in the page content (added in version 0.14).** The line under the control is for the two controls of the fixed top bar. Any other control that opens an overlay on its first use (a button in a page header, an action in a table row or card) shows its failure as a **danger notice at the top of the page content**, `role="alert"`, in the same words ("The <thing> did not open. Check your connection and try again."), cleared by the next press, Escape or a change of page, with focus left on the control. The first user is SCR-14 (see there for the wording and the reasons).

**Accessibility (SCR-25, version 0.11).** The 44 px target and the 3 px focus ring are unchanged, and the ring shows together with the held look. Screen readers: `aria-busy` on a button is not announced by every screen reader, so the pending state is a visual cue first; the failure is announced by `role="alert"`. The action itself is unchanged for keyboard: Enter, Space (and ArrowDown on the account trigger) start the open, Escape cancels it, nothing traps focus. Contrast of the held look: `--ink` 12.71:1 on `--border`; on the account trigger the role line and the arrow (`--ink-2`) are 6.04:1 on the fill (3.39:1 only on the top pixel row of the inset, where no glyph sits: the name starts about 8 px down). With reduced motion nothing animates: the look is held without a fade, and the line appears without movement. **Responsive.** 360: the account trigger shows the avatar and the arrow only, its line ends at the right edge and wraps to two lines; the menu button's line starts at the left edge. 768: name and role appear in the trigger; both lines as at 360. 1024 and up: the menu button is hidden, so only the account trigger and its line exist.

### SCR-26 System pages
No access (403), not found (404), server error (reference `req-…`, never technical detail), session ended ("Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there.", UX-33). Each has one clear action. For an Engineer, an estimate address that is missing and one that belongs to someone else both show **No access**, with identical content and timing, so sequential task codes cannot be probed (UX-22). "Not found" is for other kinds of address and other roles.

**Action label on No access and Not found (added in version 0.12, AQP-48).** The one button goes to the person's own landing page and is named as the menu names it: an Engineer sees **"Go to my tasks"** (My tasks); a Lead or an Admin sees **"Go to the task queue"** (Task queue, SCR-03), as in UJ-01. "Go to your tasks" for every role is not used: for a Lead or an Admin it reads as "tasks assigned to me", and their landing page is the queue of everyone's tasks. The label depends on the viewer's role only, never on whether the address exists, so the identical content and timing of UX-22 are kept. If a build cannot read the role on that page, the role-neutral "Go to the task list" is an accepted interim wording (Minor), not "Go to your tasks". The other actions are unchanged: Session ended "Sign in", Server error "Try again".

---

## 7. Design tokens and system usage

Source of truth: `docs/03-ux/screens/screens.css` (`:root`). The names follow the client sample so nothing is renamed; values change for "Red Leads". In Tailwind and shadcn these become the theme variables of the same names (`--primary`, `--ink`, and so on). No token is hard-coded elsewhere (NFR-020).

### 7.1 Type (four sizes, as the sample)
| Role | Size / line | Weight | Used for |
|------|-------------|--------|----------|
| Heading | 28 / 36 (24 / 32 on phones) | 600 | Page title, key figures |
| Subheading | 18 / 26 | 600 | Card and section titles; the brand name (serif, 700) |
| Body | 14 / 22 | 400 | Text, inputs, buttons |
| Label | 12 / 16 | 500 or 600 | Field labels, hints, tags, table heads, column letters (mono) |

Fonts: IBM Plex Sans, IBM Plex Mono, and Tinos Bold for the company name, **self-hosted** from `screens/fonts/` (SIL OFL 1.1, copies of the licences included). This answers analyst finding F-19 (the sample loaded fonts from an external service). Fallbacks: system UI sans, Times New Roman (Tinos is metric-compatible with it).

**Glyph coverage (UX-13, checked with `fontkit` on the files, and in the browser).** The first set of six Latin files held none of ₹ (U+20B9), Σ (U+03A3), → (U+2192) or ← (U+2190), so those fell back to whatever the device had. Now: **₹** comes from five added files, the open-licence Latin-extended subsets of Plex Sans 400, 500, 600 and Plex Mono 400, 500 (about 76 KB), declared with `unicode-range` so a page without a ₹ does not load them; the production build keeps the same subset (architecture §11). **Σ and the arrows are inline SVG icons** with a text alternative (visually hidden "This row and everything below it", "to"), so they look the same everywhere and need no font. € $ × − — · © are in the base files. Tinos Bold carries only the ASCII name.

### 7.2 Spacing, shape, controls
4-point scale: 4, 8, 12, 16, 24, 32, 48. Radius 4, 8, 12. **One control height: 44 px** (above WCAG 2.5.8's 24 px and PRD NFR-017's 44 px). One button: 44 px, 16 px side padding, 14 / 600; four variants (primary red, secondary outline, ghost, danger) and an icon-only square. Row-level icon buttons in dense tables are 36 px. Every variant and both icon sizes have a pressed state on touch and mouse alike (section 7.3.1).

### 7.3 Colour ("Red Leads") and contrast
| Token | Hex | Use | Contrast |
|-------|-----|-----|----------|
| `--primary` | #DE3030 | Main buttons, active marker, brand name, progress | White text on it **4.59:1** (AA normal); on white 4.59:1; on graphite 3.86:1 (UI 3:1) |
| `--primary-hover` | #BF2626 | Primary button: hover on a device that can hover (section 7.3.1) | White on it 5.97:1 |
| `--primary-pressed` | #7F1616 | Primary button: pressed, on every device (section 7.3.1; added in 0.10) | White on it 10.35:1; 2.25:1 against the resting `--primary` |
| `--danger-pressed` | #520F09 | Danger button: pressed, on every device (section 7.3.1; added in 0.10) | White on it 14.67:1; 2.25:1 against the resting `--danger` |
| `--primary-ink` | #B52424 | Red as text or link | 6.48:1 on white; 5.67:1 on its tint |
| `--nav` / `--ink` | #17181C | Side menu, text, focus ring | 17.74:1 with white |
| `--ink-2` | #4A4D57 | Secondary text | 8.43:1 on white |
| `--ink-3` | #5E616C | Hints, placeholders (lowest grey) | 6.17:1 on white, 5.33:1 on the shaded fill |
| `--border-strong` | #85888F | Control edges | 3.55:1 on white, 3.23:1 on the page grey |
| `--nav-ink`, `--nav-muted` | #C9CBD2, #9A9DA8 | Menu text, menu group labels | 10.94:1, 6.56:1 on graphite |
| `--accent` / `--accent-ink` | #B45309 / #8A3F05 | Overdue and attention (amber, never red) | 5.02:1 on white; 6.92:1 on its tint |
| `--success` | #157F3B | Approved, complete | 5.08:1 on white |
| `--danger` | #B3261E | Errors and delete only | 6.54:1 on white; 5.74:1 on its tint |
| `--info-ink` | #333945 | Neutral notices, Submitted | 9.98:1 on its tint |

The brand red passes AA for normal text only narrowly (4.59:1), so it is used for **fills with white text, large text and non-text markers**, and the darker `--primary-ink` is used wherever red is text or a link. Overdue is amber and errors are the darker error red, so red never carries two meanings at once (finding F-18). Ratios were computed from the hex values with the WCAG formula.

### 7.3.1 Button states and touch behaviour: hover, pressed, disabled, text selection (DEF-008, DEF-010, QA OBS-6 and OBS-2; added in version 0.9, revised in versions 0.10 and 0.11)

A phone has no hover, so the pressed state is the only sign that a tap registered (the delivery lead found this at the AC-9 phone check of AQP-28). Version 0.9 stated the pressed state of every variant. On the delivery lead's iPhone 17 Pro Max (iOS 27.0.1, Chrome 155) the secondary, ghost and icon buttons passed, but the **primary (Calculate) and danger (Delete) buttons were "not very clear" held down and showed "no brief flash" on a quick tap** (DEF-010, AQP-185). The cause was the size of the step: their pressed fill was only 1.30:1 and 1.37:1 darker than rest, and a grey inset shadow hardly shows on a dark red. Version 0.10 fixes the two values and one timing rule, and decides the text-selection question (OBS-2). **Two colours were added**, both darker members of the family they belong to: `--primary-pressed` and `--danger-pressed` (section 7.3). `--shadow-pressed` is unchanged.

| Variant | Rest | Hover (only on a device that can hover) | **Pressed** (mouse, finger, pen) | Text on pressed | Contrast of that text: on the fill / at the darkest edge of the inset shadow |
|---------|------|------|------|------|------|
| Primary | `--primary` #DE3030 fill, `--on-fill` text | `--primary-hover` | **`--primary-pressed` #7F1616** fill + `--shadow-pressed` | `--on-fill` (white) | **10.35:1** / 12.69:1 |
| Secondary | `--surface` fill, `--border-strong` edge, `--ink` text | `--surface-2` | `--border` fill + `--shadow-pressed`; the edge stays `--border-strong` | `--ink` | **12.71:1** / 7.12:1 |
| Ghost | no fill, `--primary-ink` text | `--primary-soft`, text stays `--primary-ink` (5.67:1) | `--primary-line` fill + `--shadow-pressed` | **`--ink`**, not `--primary-ink`: red text on `--primary-line` is 3.80:1 and fails AA | **10.41:1** / 5.94:1 |
| Danger | `--danger` #B3261E fill, `--on-fill` text | `--danger-ink` | **`--danger-pressed` #520F09** fill + `--shadow-pressed` | `--on-fill` (white) | **14.67:1** / 15.94:1 |
| Icon-only square (44 px) and row icon button (36 px) | the variant it carries (secondary, or ghost for show and hide password) | that variant's | that variant's pressed look; the size changes nothing | that variant's | that variant's |

**How big the step from rest is** (the measure QA used: contrast of the rest fill against the pressed fill, and the distance between the two in RGB):

| Variant | Rest fill | Pressed fill | Version 0.9 | **Version 0.10** | On the iPhone |
|---------|-----------|--------------|-------------|------------------|---------------|
| Primary | #DE3030 | #7F1616 | 1.30:1, distance 34 | **2.25:1, distance 102** | 0.9 values: not clear |
| Danger | #B3261E | #520F09 | 1.37:1, distance 39 | **2.25:1, distance 102** | 0.9 values: not clear |
| Secondary | #FFFFFF | #D9DADF | 1.40:1, distance 62 | 1.40:1, distance 62 (unchanged) | good |
| Ghost | #FFFFFF | #F2B8B8 | 1.70:1, distance 101 | 1.70:1, distance 101 (unchanged) | good |

The bar was "at least as large as the variants that passed". The two red buttons now match the largest of them (the ghost button: 1.70:1 and distance 101) or better on both measures. Step from hover to pressed, for a mouse user: primary 1.74:1 (#BF2626 to #7F1616), danger 1.64:1 (#8F1C13 to #520F09). Each pressed fill also stands 10.35:1 and 14.67:1 against the white page, so the button edge is clear. The new fills are still red (primary a deep brick red, danger a dark maroon), so the brand reads the same; they are only darker. The new values were computed from the hex values with the WCAG formula. They have **not yet been looked at on the device**: that is the QA check in rule 10.

`--shadow-pressed` stays `inset 0 2px 4px rgba(23, 24, 28, 0.28)`, the graphite of `--shadow-1` and `--shadow-2` at a higher strength. The "darkest edge" figures assume the full 0.28 of graphite over the fill, which is the worst case; the shadow fades out within about 4 px of the top edge, well above the label. On a white text label a darker fill only raises the contrast, so the text ratios above are all well over 4.5:1.

**Rules**

1. **Pressed applies to every pointer.** It is the `:active` state and must not sit inside the "can hover" media query that the hover colours use. Hover stays limited to devices that can hover, because on a phone a hover colour would stay stuck after a tap. Where a button is both hovered and pressed, pressed wins (it comes after hover in the cascade). The delivery lead's test showed that `:active` does work on iOS WebKit, so no `touchstart` listener is needed.
2. **The fill carries the cue; the inset is a second cue (WCAG 1.4.1).** Every variant also gets the inset shadow, so the change is not colour alone. On the two red fills the inset can only help a little, whatever its strength: measured at the darkest edge against the fill it is 1.23:1 under the primary and 1.09:1 under the danger button, and a stronger shadow (0.5 instead of 0.28) would reach only 1.41:1 and 1.13:1, because there is little left to darken. So the cue on the red buttons is the new fill, and that is why the step from rest was raised. Pressed no longer equals hover for primary and danger, so a mouse user also sees pressed apart from hover.
3. **Decided: two new colours, `--primary-pressed` and `--danger-pressed`.** Version 0.9 (rule 3 there) rejected a new colour and said to revisit it if the phone check showed the cue was too weak. It did. No existing token was dark enough: the nearest, `--danger-ink` #8F1C13, is only 86 away from the rest primary and is the danger hover. A lighter pressed fill was not considered, because white text on a lighter red falls under 4.5:1.
4. **Pressed shows at once and fades out on release.** A quick tap on a phone lasts about a tenth of a second. A 150 ms fade into pressed means the fill has barely started to change when the finger lifts, so the flash is lost; that is the second half of DEF-010. So: **no transition into pressed** (`active:transition-none`: the fill and the inset appear on the first frame), and **a 200 ms ease-out fade back to rest or hover on release** (`duration-200 ease-out` on the base). A tap then shows a dark flash that fades for about a fifth of a second after the finger lifts. The inset shadow is not part of the fade; it goes when the pointer lifts. Hover colours on a mouse also fade at 200 ms instead of 150 ms; that is accepted. A test must not read the rest colour straight after release, because it is mid-fade (use a retrying assertion).
5. **Reduced motion.** Nothing moves: no scale, no shift, no animation, so the label and the layout stay put. The project-wide reduced-motion rule (section 8) removes the fade on release, so the button snaps back; pressed is still shown for as long as the pointer is down and still appears at once. A very quick tap on such a device shows pressed only for the length of the tap; with the larger step from rest it should still be visible, and it is accepted; the device check in rule 10 is run with reduced motion off. Pressed is a state, not an animation, so reduced motion does not turn it off.
6. **Rejected: scale or translate on press.** (a) The fingertip covers much of a 44 px button, so a shape change adds little that the fill does not. (b) A transform moves the button's edge: a press in the first pixel or two of the top edge could end up outside the moved button, and the click would go to the parent and be lost. That is a real risk on Approve and Delete. (c) The size check in `tests/e2e/button-pressed.spec.ts` measures the bounding box, so a scale would break rule 8 and change the test. (d) It needs a reduced-motion exception. Revisit only if the device check shows the new fill is still not enough; the contingency then is a light inner ring (`inset 0 0 0 2px rgba(255, 255, 255, 0.35)`), not a transform.
7. **Disabled and loading buttons show no pressed state.** They keep the disabled fill, the grey text and no shadow, even when a pointer is down on them (`disabled:active` resets the colours and sets `shadow-none`, as `disabled:hover` already does). A button that starts work (`loading`) is disabled with `aria-busy`, so a second tap while it works shows nothing and does nothing. **The one exception is the first open of an overlay: rule 11.**
8. **Targets and focus.** Size, padding, border width and label position do not change on press (the inset is a shadow, not a border), so the 44 px and 36 px targets and the layout are the same pressed or not. The 3 px graphite focus ring (section 8) is not replaced or hidden by pressed; a keyboard user who holds Space sees both.
9. **Button text is not selectable and a real button shows no copy callout (QA OBS-2).** On the iPhone, holding a disabled or a loading button selected its label and showed the "copy" bubble, which looks like a fault and is of no use: nobody copies "Calculate". Decided: **every variant and size, enabled, disabled and loading, gets `user-select: none`** (`select-none`; Tailwind writes the `-webkit-` form too). **A real `<button>` element also gets `-webkit-touch-callout: none`**, which stops the iOS bubble and magnifier. A **link** drawn as a button (`asChild`) gets `select-none` only: its link menu (open in a new tab, copy the link) is a feature of a link and stays. Not touched: fields, table cells, the calculated figures and the outputs (people copy those), plain text links, badges, and other button-like controls such as tabs, the select trigger and menu items; those are not drawn by `buttonVariants` and were not part of the finding. Do not set `-webkit-tap-highlight-color: transparent`: it is the system's own tap cue and helps on a red button. Accessibility: a screen reader and Voice Control use the button's accessible name, not a text selection, so they are unaffected. The one loss is iOS "Speak Selection" on a button label; "Speak Screen" and VoiceOver still read it. Accepted.
10. **To check on the device that found DEF-010** (iPhone 17 Pro Max, Chrome; QA, for Calculate and Delete only, plus the long press on all). (a) Hold Calculate for about a second: the fill is a clearly darker brick red, as dark as the delivery lead will accept, and stays so until release. (b) Tap Calculate quickly several times: a dark flash on the first frame, fading out after the finger lifts. (c) The same two for Delete (dark maroon). (d) Long-press Calculate, Delete, Approve and lock (disabled) and Calculating (loading): no text is selected and no copy bubble appears. (e) Long-press a button that is a link, if one is on the page: the link menu still appears. If (a) or (b) is still "not clear", report it as DEF-010 reopened with a photo or screen recording; do not tune the values on the phone.
11. **Exception to rule 7: the first-open pending state keeps the pressed look on an enabled control (AQP-188, added in version 0.11).** A control that opens an overlay by first loading its code through the shared first-open loader (architecture section 10) is the one case where a button with `aria-busy="true"` is **not** disabled. Today those are the menu button (`Open menu`, secondary icon square, below 1024 px) and the account trigger; every later overlay trigger that uses the loader follows the same rule. The rule holds while the code loads, and also when the person pressed before the page was interactive (DEF-013, the early tap).
    - **Enabled, pressed look held.** The control shows its variant's pressed look from the table above (secondary: `--border` fill, `--ink` text, `--shadow-pressed`) for as long as it is pending, not only while the finger is down. It appears on the first frame, with no fade in (the `enabled:aria-busy:transition-none` below).
    - **`aria-busy="true"`**, set in the same frame as the press. No `disabled`, no `aria-disabled`, no spinner, no new label, no change of size or position.
    - **A second press is ignored.** Click, tap, Enter, Space or ArrowDown (account trigger): no second request, no flicker, no other look.
    - **Escape cancels, from anywhere on the page.** The held look and `aria-busy` are removed (the 200 ms fade of rule 4), the panel stays closed even if the code arrives later, and focus stays where it was.
    - **Success.** When the code arrives the panel opens, the control leaves the pending state, and focus goes as in AQP-188 AC-4 and AC-5. If the other first-open control is pressed meanwhile, the last press wins and the first one returns to rest.
    - **Failure.** The held look and `aria-busy` are removed at once, the control is at rest and enabled, and the failure line of SCR-25 appears. Pressing the control again starts a new request.
    - **Why not disabled.** A disabled button asks for the tap to be repeated, which is DEF-013; it cannot be pressed again to retry; and in some browsers a focused button that becomes disabled drops focus or stops receiving keys, so a keyboard user loses their place. `Button`'s `loading` prop is unchanged (disabled, spinner, no pressed look, rule 7) and is **not** used for these controls: they set `aria-busy` themselves.
    - **Why a rule on the attribute.** The early-tap script runs before React. A style keyed to `aria-busy="true"` shows the look on the first frame, before the page is interactive; a style keyed to React state could not.
    - **Visible on the iPhone (DEF-010)?** *Menu button: yes, on evidence.* It is the secondary icon square at 44 px, the same variant and size as the "Edit part" pencil that the delivery lead rated good for the hold and the quick tap (AQP-183 test report, rows 9 and 10), and the held look is that same look (fill 1.40:1 from rest, RGB distance 62, plus the inset). It sits on the white top bar as the sample sits on a white card. It also lasts after the finger lifts, so it is easier to see than a tap flash. *Account trigger: not today, and then expected yes.* In the code at master it has a hover colour only (no `active:` rule, no `aria-busy` rule), so a press shows nothing on a phone. With the classes below it takes the same secondary look and the same step from rest. It has not been seen on the device, and on a phone it is a smaller light area (avatar and arrow only), so it is the one to look at first. The check is in rule 10's style: hold the trigger for about a second on the page that has it, at G6. If it is still "not clear", report it as a defect; do not tune the value on the phone.

For the developer, version 0.11. **Pending look in `buttonVariants`** (append to each variant's string; `enabled:` keeps `disabled` and `loading` buttons untouched, and the compound selector is more specific than `hover:`, so the held look wins over a hover colour):
- primary: `enabled:aria-busy:bg-primary-pressed enabled:aria-busy:text-on-fill enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none`
- secondary: `enabled:aria-busy:bg-border enabled:aria-busy:text-ink enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none`
- ghost: `enabled:aria-busy:bg-primary-line enabled:aria-busy:text-ink enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none`
- danger: `enabled:aria-busy:bg-danger-pressed enabled:aria-busy:text-on-fill enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none`

Check in the built CSS that Tailwind produced the `aria-busy` rules. The menu button is `Button variant="secondary" size="icon"`, so it gets them with no other change; it must not be given `loading`.

**Account trigger face** (the shared face component extracted in AQP-188; today a hand-styled Radix trigger with no pressed rule). Keep its current classes, including `hover:bg-surface-2`, and add: `select-none transition-colors duration-200 ease-out active:transition-none active:bg-border active:shadow-pressed enabled:aria-busy:bg-border enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none` and, on the `<button>` element, the same `[-webkit-touch-callout:none]` that `Button` uses. Building the face on `buttonVariants({ variant: 'secondary' })` with the size and edge overridden is equally fine if the look is the same. The Radix trigger that replaces it after the first open takes the same face, so nothing changes at that moment.

**Failure line** (a small shared component; Tailwind names as in `globals.css`): a `relative` wrapper around the control, and inside it `role="alert"` with `absolute top-full mt-s-1 z-(--z-popover) flex w-max max-w-[min(20rem,calc(100vw-2rem))] items-start gap-s-2 rounded-md border border-danger-line border-l-4 border-l-danger bg-danger-soft px-s-3 py-s-2 text-body text-danger-ink shadow-overlay`, `right-0` under the account trigger and `left-0` under the menu button, with a 16 px `CircleAlert` icon (`aria-hidden`) before the text. The control gets `aria-describedby` pointing at it while it shows. The texts are the two in SCR-25. **Tests:** E2E reads the computed fill of the held look equal to `--border` (secondary) during a held request, `aria-busy="true"` and `disabled` false, a second press sends no second request, Escape clears the look, and the failure line text, `role="alert"`, position (0 px shift) and clearing on the next press. Unit: the class strings above.

For the developer. **Tokens** in `src/app/globals.css`: in `:root`, `--primary-pressed: #7f1616;` next to `--primary-hover`, and `--danger-pressed: #520f09;` next to `--danger-ink`; in `@theme inline`, `--color-primary-pressed: var(--primary-pressed);` and `--color-danger-pressed: var(--danger-pressed);`. **`button.tsx`**, the exact class changes:

- base: replace `transition-colors` with `select-none transition-colors duration-200 ease-out active:transition-none`; everything else in the base string stays (including `disabled:active:bg-surface-2 disabled:active:text-ink-3 disabled:active:shadow-none`).
- primary: `bg-primary text-on-fill hover:bg-primary-hover hover:text-on-fill active:bg-primary-pressed active:text-on-fill active:shadow-pressed`
- danger: `bg-danger text-on-fill hover:bg-danger-ink hover:text-on-fill active:bg-danger-pressed active:text-on-fill active:shadow-pressed`
- secondary and ghost: unchanged (`active:bg-border active:text-ink active:shadow-pressed` and `active:bg-primary-line active:text-ink active:shadow-pressed`).
- the `<button>` branch only (not the `asChild` branch): add `[-webkit-touch-callout:none]`, for example `className={cn(classes, '[-webkit-touch-callout:none]')}`. Do not put it in the `buttonVariants` base, which links also use. Check that it reaches the built CSS.

**Tests.** `tests/e2e/button-pressed.spec.ts`: the primary sample's pressed fill is `--primary-pressed` and the danger sample's `--danger-pressed`; the shadow constant and the size check are unchanged (nothing is transformed). Assert `user-select` is `none` on every sample and every disabled sample (Chromium supports it). After release, read colours with a retrying assertion (the fade is 200 ms). `tests/unit/button-pressed.test.ts`: the class strings above, including `active:transition-none`, `select-none`, and that `[-webkit-touch-callout:none]` is on the `<button>` and absent from `buttonVariants` and the `asChild` link. Chromium does not implement `-webkit-touch-callout`, so only the phone check proves it.

**Mock-ups.** `screens/screens.css`: add `--primary-pressed: #7F1616; --danger-pressed: #520F09;` to the tokens; in `.btn` add `user-select: none; -webkit-user-select: none;`, change the transition to `.2s ease-out` and add `.btn:active, .btn.is-pressed { transition: none; }`; add `button.btn { -webkit-touch-callout: none; }`; `.btn-primary:active, .btn-primary.is-pressed` uses `var(--primary-pressed)` and `.btn-danger:active, .btn-danger.is-pressed` uses `var(--danger-pressed)`. Add the two colours and their text pairs to `generator/contrast.cjs`. SCR-00 section 05 keeps its held-down samples; they pick up the new fills from the same classes. These mock-up changes are listed in the hand-off for the branch of PR #56; they are not in this file.

### 7.4 Patterns added to the sample
Masters table (sticky Actions column, section 6.0); column-letter tag; section card with number, range and count; stepper strip; one figure box per row; stage panels; skeleton; empty and error blocks; review bar (review only). No new colours were added for them.

### 7.5 shadcn/ui map
Listed on SCR-00 section 10: Button, Input, Label, Select, Checkbox, Switch, Tabs, Table (the masters table adds a sticky Actions column, section 6.0), Card, Badge, Alert, Dialog, AlertDialog, Sheet, Popover with Command, Tooltip, Skeleton, Accordion, Progress, Resizable, Calendar, Sonner, Sidebar, Collapsible. The parts tree and the formula editor are custom components built on those primitives.

---

## 8. Accessibility requirements (WCAG 2.2 AA), project-wide

| Area | Rule |
|------|------|
| Structure | `lang="en-IN"`; one `h1` per page; landmarks (banner, navigation, main); a skip link first; page `title` unique per screen |
| Keyboard | Everything works without a mouse. Tab order follows reading order. Tabs and the tree use arrow keys; Escape closes drawers and dialogs; Enter moves to the next field on the guided form. No keyboard trap |
| Focus | Visible 3 px graphite ring with 2 px offset (white ring on the dark menu), contrast 17.7:1. Focus is never hidden by a sticky bar: the top bar, section strip and action bar are **measured** (not fixed) and feed `scroll-padding` and the height of the sticky tree panel. On a phone the action bar wraps to about 181 px, so the offset is about 189 px, not the 96 px a one-line bar needs (UX-14). Dialogs: focus in, trapped, returned. After a route change focus goes to the `h1`; after Calculate blocked, to the error summary |
| Labels and names | Every control has a visible label; icon-only buttons have an accessible name; column letters are read as "Excel column J". **Label in Name (WCAG 2.5.3):** where a control shows text, its accessible name contains that text, in the same order, at every width. The account trigger is the case that needs care (SCR-25, "Account trigger: accessible name") |
| Errors | Identified in text with an icon and a thick border, linked from a summary, `aria-invalid` and `aria-describedby`; instructions say how to fix; typed values are kept |
| Colour | Text 4.5:1, large text and UI 3:1 (section 7.3). Nothing is conveyed by colour alone: overdue, status, missing data and errors each have an icon and words |
| Target size | 44 px controls; the smallest interactive items (row icon buttons) are 36 px, above the 24 px minimum |
| Dragging | No feature needs dragging: the tree is reordered by buttons; the panel is resized with arrow keys |
| Redundant entry | The customer is chosen once; values are kept on error; nothing is asked twice in a flow |
| Authentication | Paste allowed; show or hide password; no puzzle or memory test; password manager attributes set |
| Dynamic content | Polite live region for saves, copy, formula checks and totals; `alert` for blocking errors (including a first-open failure line, SCR-25); skeleton regions use `aria-busy`, and so does a trigger that is opening an overlay for the first time (section 7.3.1 rule 11) |
| Motion | `prefers-reduced-motion` turns off shimmer, spin and slide transitions. The pressed state of a button (section 7.3.1) is a static colour and inset change with no movement and no fade in, so it stays on; the fade out on release is removed |
| Zoom and reflow | Works at 200 percent and at 320 px width without horizontal page scroll; tables scroll inside their container only; text spacing changes do not clip |
| Tables | Caption, `th scope`, no layout tables |
| Language of content | English only (NFR-029) |
| SEO and sharing (FR-089) | Every page has a title, a meta description, and Open Graph title and description with generic wording and no cost, rate or customer data. Pages behind sign-in carry `noindex, nofollow` |

Verification is in section 12.

---

## 9. FR → screen coverage

Every user-facing FR (all 108) is mapped; entries marked "none" say why. FR-098 to FR-105 were missing from versions 0.2 and 0.3 and are added in version 0.4 (G3 condition 12). FR-106 to FR-108, which PRD v0.10 numbers, are added in version 0.6 (CR-22).

| FR | Screens | Journeys |
|----|---------|----------|
| FR-001 | SCR-01 | UJ-01 |
| FR-002 | SCR-23 | UJ-14 |
| FR-003 | SCR-02, SCR-01 (link) | UJ-01, 14 |
| FR-004 | SCR-14 | UJ-11 |
| FR-005 | SCR-14 (second Admin refused) | UJ-11 |
| FR-006 | SCR-14 (Hand over, R2), SCR-16 (User change) | UJ-11 |
| FR-007 | SCR-26, SCR-25 | UJ-01 |
| FR-008 | SCR-05, SCR-03-engineer, SCR-23, SCR-24, SCR-22 (no cost anywhere in Engineer screens) | UJ-04, 05 |
| FR-009 | SCR-25, top bar of every screen | UJ-01 |
| FR-010 | SCR-24 | |
| FR-011 | SCR-16 (override with its reason), SCR-08, SCR-09 | UJ-06, 08, 12 |
| FR-012 | SCR-11 | UJ-10 |
| FR-013 | SCR-12 | UJ-10 |
| FR-014 | SCR-11 (Customers differ) | UJ-10 |
| FR-015 | SCR-13 | UJ-10 |
| FR-016 | SCR-13 | UJ-10 |
| FR-017 | SCR-13 | UJ-10 |
| FR-018 | SCR-05 and SCR-06 (the drop-down choice only; on no Admin list, so none on SCR-13) | UJ-04, 10 |
| FR-019 | SCR-15 | UJ-13 |
| FR-020 | SCR-17 (registry list) | UJ-12 |
| FR-021 | SCR-05 (letters on fields), SCR-17 | UJ-04, 12 |
| FR-022 | SCR-18 | UJ-12 |
| FR-023 | SCR-18 (unknown, syntax, loop messages) | UJ-12 |
| FR-024 | SCR-06, SCR-07 | UJ-06 |
| FR-025 | SCR-06 (BL, BN, BO tiles), SCR-10 | UJ-06, 09 |
| FR-026 | SCR-07, SCR-06 ("—") | UJ-06 |
| FR-027 | SCR-06 (Recalculate, 2 decimals), SCR-05 (no preview) | UJ-05, 07 |
| FR-028 | SCR-11, SCR-12 (whole percentages) | UJ-10 |
| FR-029 | SCR-06, SCR-07, SCR-10 (every row has one box with its own BG, BJ and BK; a parent shows only its own row, no sum of the rows below, AQP-26) | UJ-06, 09 |
| FR-030 | SCR-06 ("How the total is built"), SCR-10 (reconciliation) | UJ-06, 09 |
| FR-031 | SCR-06 (calculated at, configuration version), SCR-09 | UJ-07, 08 |
| FR-032 | SCR-04; task notes shown on SCR-05 and SCR-06 | UJ-02 |
| FR-033 | SCR-03, SCR-04, SCR-05, SCR-06 (link and Copy path) | UJ-02, 03 |
| FR-034 | SCR-03 | UJ-03 |
| FR-035 | SCR-03 (Lead chip, R1+) | UJ-03 |
| FR-036 | SCR-03 | UJ-03, 13 |
| FR-037 | top bar (every screen), SCR-03 Overdue tab | UJ-13 |
| FR-038 | SCR-03 (Closed), SCR-08, SCR-09 | UJ-06, 08 |
| FR-039 | SCR-03 (filters, R1+) | UJ-02 |
| FR-040 | SCR-04 (edit), SCR-03 (row action on open tasks), SCR-16 (Task change) | UJ-02 |
| FR-041 | SCR-03, SCR-05, SCR-06, SCR-10 (IDs, file name) | UJ-02, 09 |
| FR-042 | SCR-05 (customer first, change confirmation) | UJ-04 |
| FR-043 | SCR-05 (tree actions) | UJ-04 |
| FR-044 | SCR-05 (renumbering, announced) | UJ-04 |
| FR-045 | SCR-05 | UJ-04 |
| FR-046 | SCR-05 (Enter to next field, works in the mock-up) | UJ-04 |
| FR-047 | SCR-05 (picture field, errors) | UJ-04 |
| FR-048 | SCR-05 (section 05 shows or hides T and U) | UJ-04 |
| FR-049 | SCR-05 (multi-select in section 07) | UJ-04 |
| FR-050 | SCR-05 ("Other" reveals text) | UJ-04 |
| FR-051 | SCR-05 (auto fields shaded; I absent) | UJ-04 |
| FR-052 | SCR-05 (decimal keyboard, format message) | UJ-04 |
| FR-053 | SCR-05 (Save draft, unsaved-changes dialog) | UJ-04 |
| FR-054 | SCR-05 (auto-save line, R1+) | UJ-04 |
| FR-055 | SCR-05 (Calculate blocked, Submitted) | UJ-05 |
| FR-056 | SCR-05 (hints "Enter 0 …") | UJ-05 |
| FR-057 | SCR-05 (count, tree icons, section counts, R1+) | UJ-04 |
| FR-058 | SCR-06, SCR-07 | UJ-06 |
| FR-059 | SCR-07 (hidden zero lines) | UJ-06 |
| FR-060 | SCR-07 (Release 1: a Lead reads every formula there, no edit control; PRD v0.7 on OQ-UX-18), SCR-17-lead (Release 2, the full column list) | UJ-06, 12 |
| FR-061 | SCR-06 (total cleared, Recalculate) | UJ-07 |
| FR-062 | SCR-08 (optional reason) | UJ-06 |
| FR-063 | SCR-09 | UJ-08 |
| FR-064 | SCR-05 (Submitted, read-only), SCR-06 | UJ-05, 06 |
| FR-065 | SCR-06 (approved), SCR-09 (notices) | UJ-06, 08 |
| FR-066 | SCR-10 | UJ-09 |
| FR-067 | SCR-10 | UJ-09 |
| FR-068 | SCR-10 | UJ-09 |
| FR-069 | SCR-10 (BL2, BN2, BO2 once in row 2; Total Tool Cost below the parts; no per-item totals; Q-31 answered) | UJ-09 |
| FR-070 | SCR-10 (no file until a calculation is current: Not calculated and Total cleared), SCR-06 (Download off), SCR-26 | UJ-09 |
| FR-071 | SCR-10 (file name) | UJ-09 |
| FR-072 | SCR-17 | UJ-12 |
| FR-073 | SCR-18 | UJ-12 |
| FR-074 | SCR-19 | UJ-12 |
| FR-075 | SCR-19, SCR-20 (letter preview) | UJ-12 |
| FR-076 | SCR-20 | UJ-12 |
| FR-077 | SCR-21, SCR-16 | UJ-12 |
| FR-078 | SCR-21 | UJ-12 |
| FR-079 | SCR-16 (Configuration filter) | UJ-12 |
| FR-080 | SCR-18, SCR-20, SCR-21 (password step) | UJ-12 |
| FR-081 | SCR-22 (assigned), SCR-04 (alerts OFF notice) | UJ-02, 13 |
| FR-082 | SCR-22 (overdue) | UJ-13 |
| FR-083 | SCR-22 (digest) | UJ-13 |
| FR-084 | SCR-22 (note), SCR-15 | UJ-13 |
| FR-085 | every screen; phone and tablet frames for SCR-01, 03, 04, 05, 06, 07, 11, 25; masters tables at 768 to 1440 px: section 6.0, SCR-11, SCR-13 (DEF-021) | all |
| FR-086 | SCR-00 and every screen | all |
| FR-087 | SCR-05 (reserved region, toggle) | UJ-04 |
| FR-088 | state patterns in 6.0, SCR-00 section 09, every data screen | all |
| FR-089 | `<head>` of every page; section 8; every page is `noindex`, SCR-01 included (SCR-02 also because its address carries a token); no page carries a sharing image | all |
| FR-090 | none: dark mode is R3 and out of scope (C-5); tokens named to allow it | |
| FR-091 | none: installation is documentation, not a screen | |
| FR-092 | none: offline is the next release (Q-18) | |
| FR-093 | none: deferred; room reserved by FR-087 | |
| FR-094 | none: rejected (UD-3) | |
| FR-095 | none: not built, decided ("No switch", UD-5) | |
| FR-096 | none: not planned | |
| FR-097 | none: sample extras are out of scope | |
| FR-098 | SCR-02, SCR-14, SCR-23 (rule text and the failing-part messages, section 6.0) | UJ-11, 14 |
| FR-099 | SCR-26 (Session ended: "Sessions last 12 hours from the time you sign in") | UJ-01 |
| FR-100 | SCR-06, SCR-07, SCR-10 (Total cleared and Unlocked and changed: every calculated value on every row clears; SCR-10 has no file or table while cleared; BL is the sum of every row's BG, AQP-26) | UJ-07, 09 |
| FR-101 | SCR-06 (Approve and lock off, with the reason), SCR-08 (Estimate changed while open) | UJ-06, 07 |
| FR-102 | SCR-03 (Engineer), SCR-05 (status badge, Submitted, Approved): a status and never a price | UJ-03, 05 |
| FR-103 | SCR-08 (optional reason), SCR-06 (BO tile), SCR-10 (shown there, written into no cell), SCR-16 | UJ-06, 09 |
| FR-104 | SCR-05 (Quantity warning, Warning with a new list), SCR-06 (dialog; notice and mark), SCR-08 (one line), SCR-10 (notice; no warning in the file), SCR-16 (entry) | UJ-05, 06, 07 |
| FR-105 | SCR-15 (Last good backup, Backup late, Disk nearly full). Firm: answered Yes. R1 core, with the Settings frame (CR-26) | UJ-13 |
| FR-106 | SCR-06 (Rates changed: counts only, a link to Recalculate), SCR-08 (one line; approval is not blocked) | UJ-06 |
| FR-107 | SCR-06 (Approved (Admin), Cancel approval dialog, Approval cancelled (Admin and Lead): the price stays, labelled "Approval cancelled", and leaves the file), SCR-10 (BO2 empty), SCR-16 (Approval cancelled) | UJ-08 |
| FR-108 | SCR-06 (Remove price dialog, Price removed), SCR-16 (Price removed) | UJ-08 |

---

## 10. Usability risks and validation plan

| # | Assumption or risk | Why it matters | Test |
|---|--------------------|----------------|------|
| R-1 | Engineers will find the guided form faster than the worksheet | The product's main bet (UD-1) | Task 1 below. Measure time and errors per part against the same part entered in Excel |
| R-2 | A Lead can tell the screen figure from the export row | Prices rest on this (G2 condition 6) | Task 4 |
| R-3 | Engineers understand "enter 0 where a part needs nothing" with no switch | There is no switch (decided) | Task 2: count how many leave blanks or ask |
| R-4 | Enter-to-next works with the multi-select and the picture field in the way | Keyboard speed (FR-046) | Task 1 with keyboard only |
| R-5 | Brand red with white text at 4.59:1 stays legible on real screens, especially outdoors or on cheap phones | Narrow margin | Check on one low-end phone in daylight; if weak, darken the button red to #C42626 (6.0:1) with no other change |
| R-6 | "Parts tree" as a drawer on phones is discoverable | Shop-floor use | Task 5 on a phone |
| R-7 | Units beside inputs (mm, kg, sec) are right | They are inferred (OQ-UX-07, input half; the rate units are the delivery lead's list) | Ask two Engineers to read the screen aloud |
| R-8 | A cleared total with Approve disabled is understood: people know to press Recalculate, and do not think the figures were lost | Their answer D-20 forces a press; a blank total could look like an error | Task 4 and task 7 |
| R-12 | A Lead reads a row's count (H) as the count for the whole order and understands that the total is every row's BG added up (2 frames, 6 pipes, 24 lids) | The rule was settled late (AQP-26); a wrong reading changes a quoted price | Task 4, third part |
| R-14 | An Engineer types the count for the whole order, not the count per assembly (24 lids in all, not 4) | A wrong entry changes the price by a factor | Task 1, third part |
| R-13 | A Lead who presses Download while the total is cleared understands that there is no file until Recalculate | The download is off by design (Q-37 (b)) | Task 7 |
| R-9 | Admin understands the letter preview before inserting a field (R2) | Costly mistake | Task 6 |
| R-10 | On a phone with the keyboard open, the 189 px sticky offset still leaves the focused field visible | Measured in a desktop browser at 360 px only (UX-14); the keyboard takes more of the screen | Task 5 on one real phone, tabbing and typing through section 08 |
| R-11 | A Lead or Admin reads BL as SUM(BG): the total is every row's BG added up (R2) | It decides how every estimate is priced | Task 4 (Lead) and task 6 (Admin) |

**Suggested tasks (5 Engineers, 3 Leads, the Admin; think aloud).**
1. Engineer: enter a part with 25 inputs from a printed sheet. Success: complete without help; median under 4 minutes for a typical part (to be calibrated against Excel). Third part: a part with 4 lids on each of 6 pipes. Success: types 24 in QTY per Assy, the count for the whole order, not 4.
2. Engineer: a part that needs no welding, no bending and no fasteners. Success: enters 0, or "None", with no questions.
3. Engineer: press Calculate with two parts incomplete; fix them. Success: finds both parts and fields in under 30 seconds.
4. Lead: open an estimate, explain why part 1.4 shows ₹ 1,419.94 on screen but ₹ 618.37 in the file; explain why part 1.1.1 has a count of 16 and adds ₹ 640.66 to the total with nothing multiplied; explain why row 1.1 and the rows below it show ₹ 4,654.17 although 3,583.99 + 640.66 + 429.53 as shown is 4,654.18 (rounding, UX-02); approve at a different price, with and without a reason. Success: explains all three correctly; finds the override notice and the reason.
5. Engineer on a phone: open the task, copy the path, open the tree, change part. Success: no horizontal scrolling, finds the tree drawer.
6. Admin (R2): insert a field and say which letters change; then try to delete a used field. Success: reads the preview; understands why deletion is blocked.
7. Lead: change an input on a calculated estimate and try to approve; then try to download the Excel file. Success: says why Approve and Download are off and what to press; does not read the cleared figures as an error.

Targets: task success at least 90 percent without help; no critical errors on tasks 3 and 4; mean ease rating at least 4 of 5.

---

## 11. Open questions

Status words: **Open** = waiting for the owner. **Answered, proposed** = the architect proposed a value (architecture §16.2) and the delivery lead has not yet confirmed it. **Closed, their words** = the delivery lead answered in the chat; the answer is quoted from AQP-1 comment 10490 (relayed verbatim by the orchestrator, DL-007 (2)) and nothing is left to decide. **Closed** = nothing left to decide. **Working assumption** = designed and labelled on the screen, not decided.

| ID | Question | Owner | Needed by | Status and assumption used meanwhile |
|----|----------|-------|-----------|--------------------------------------|
| OQ-UX-01 | Do they want a "Not needed for this part" switch per section that fills zeros? | Santhosh | G3 approval | **Closed, their words: "No switch"** (AQP-1 10490). Not built. The note that a free slot is kept in each section header is removed, because it served only the switch. Engineers enter 0 and choose "Not applicable" in the two lists |
| OQ-UX-02 | Should a price that differs from BL need a reason? | Santhosh | G3 | **Closed, their words: "Reason optional"** (AQP-1 10490, D-18). Built on SCR-08 as an optional textarea (up to 500 characters, my proposed limit), shown with the override on SCR-06, 10 and 16 |
| OQ-UX-03 | Should the sign-in page be indexable, and should shared links carry an image (the logo)? | product-manager | G3 | **Closed, PM decision** (PRD v0.7 section 12.2, FR-089): the sign-in page is `noindex` like every page behind it, with its title, description and Open Graph text and no sharing image until Q-16 and Q-18 are answered. Built: SCR-01 carries `noindex, nofollow` |
| OQ-UX-04 | Which customer fields are required? | Santhosh | G4 | **Closed, PM decision** (FR-013): name only |
| OQ-UX-05 | Password rule? | Santhosh | G3 | **Closed, their words: "Need atleast one number and a symbol in the password. Rest looks good"** (AQP-1 10490, D-19). So: 10 to 128 characters, at least one number and one symbol, not the e-mail address, not a common password; session 12 hours from sign-in (OQ-ARCH-03, "Rest looks good"). What counts as a symbol is a design detail: any character that is not a letter or a number (working assumption 56) |
| OQ-UX-06 | May a Lead approve while totals are stale or before the first calculation? | Santhosh | G3 | **Closed, their words: "Block approval. And clear the total cost when any input is updated. So, the user will be forced to press calculate or recalculate to see the total cost."** (AQP-1 10490, D-20). Built as the Total cleared states. What else is cleared is Q-37 (open) |
| OQ-UX-07 | Units beside inputs and on rates are inferred from the formulas | Admin | HOLD-01 | **Rate half closed (2026-11-03):** the units on the 15 Process master rates are the delivery lead's list (SPEC section 4.1, D-38). **Input half open:** units beside inputs (mm, kg, sec) stay in the registry; the Admin confirms with the master data |
| OQ-UX-08 | File name: spaces and symbols | solution-architect | G4 | Closed (proposed): spaces to underscores, other symbols removed, 60 characters, IST date; there is no out-of-date file any more (Q-37 (b)) |
| OQ-UX-09 | Test e-mail recipient | Santhosh | R2 | Closed (proposed): the signed-in Admin's own address only |
| OQ-UX-10 | Wording of the About description | Santhosh | G3 | **Closed, their words: "The wording is fine."** (AQP-1 10490, D-18). The sentence stays exactly as in SPEC §9, including the word "cost" |
| OQ-UX-11 | Is the Engineer told when a Lead edits their inputs? And are Lead edits logged? | product-manager | G4 | **Closed, PM decision** (PRD v0.7): not an audit event in Release 1 and the Engineer is not told. Gap stated there: an edit with no later calculation leaves no record of who made it |
| OQ-UX-12 | Should Engineers see a task's status "Approved" (and Closed) without a price? | Santhosh | G3 | **Closed, their words: "Show the status, no price"** (AQP-1 10490, D-18). Built that way |
| OQ-UX-13 | Is a Part Model picture required on every part (Calculate refuses a blank), including assemblies? There is no "enter 0" for a picture. (OQ-ARCH-04) | Santhosh, via product-manager | G4 | **Closed:** the picture is optional (OQ-ARCH-04 answered; UX-61). Part Model is not counted as a required input and there is no missing-picture message |
| OQ-UX-14 | Should customers and materials be deletable (SCR-12, 13)? (UX-16) | product-manager | G4 | **Closed, PM decision** (FR-013, FR-015): yes, with one limit: not while an estimate that is not yet approved uses it. Built on SCR-12 and 13 |
| OQ-UX-15 | Should "Set a new password" also follow every password the Admin sets or resets? (UX-17; the architect recommends yes) | Santhosh | G4 | **Closed, PM decision** (FR-004): yes. Built: SCR-23 "Set a new password" and the SCR-14 texts |
| OQ-UX-16 | Should a Lead be told when rates changed after the last calculation but before approval? (OQ-ARCH-06) | Santhosh, via product-manager | G4 | **Closed, their words: "Tell the Lead"** (AQP-1 10548). Built as UX-62: a notice with counts only on SCR-06 and one line on SCR-08; approval stays on |
| OQ-UX-17 | Should Admin hand-over ask for the password? (OQ-ARCH-08) | product-manager | G4 | **Closed, PM decision** (FR-006, NFR-004): yes. Built: the SCR-14 hand-over has a password field and a wrong-password state |
| OQ-UX-18 | May a Lead read formulas in Release 1 on SCR-17, not only on SCR-07? (OQ-ARCH-09) | product-manager | G4 | **Closed, PM decision:** yes, on SCR-07 in Release 1 (FR-060); the full column list for a Lead (SCR-17) arrives with Release 2 |
| OQ-UX-19 (new) | Should the optional override reason also be written into the Excel file? (SPEC §10 lists no such cell) | product-manager | G4 | **Closed, PM decision** (FR-103): the reason is written into no cell. Built |
| OQ-ARCH-01 | Confirm A-05 (a never-calculated estimate exports inputs with empty costs) and A-08 (a Lead's Recalculate on a Draft sets Submitted); both shown on SCR-10 and SCR-06 | product-manager | G4 | **Closed:** A-05 is replaced by A-32 (no Excel file until a calculation is current, Q-37 (b); SCR-10 Not calculated and Total cleared); A-08 is confirmed (FR-064; SCR-06 Draft states) |
| OQ-ARCH-10 | QTY per Assy of 0 on a parent removes everything under it from the total: refuse, warn or leave? (UX-36) | Santhosh, via product-manager | G4, before the roll-up story | **Answered: "Warn"** (AQP-15 10511) and Q-38 "Yes" (10527); reworded for one rule, Q-41: the row costs 0. Built as UX-36 and UX-44 to UX-50 (section 0.8) |
| OQ-ARCH-12 | Backup duties and whether Settings may show "Last backup" (UX-35) | Santhosh | Before the first deployment | **Closed:** FR-105 is firm ("Yes", AQP-1 10549), and the Admin holds the backup key, has server access and runs the restore (architecture 16.14; AQP-1 10559 and 10560) |
| Q-16 | Sharper logo | Santhosh | open | Current 200 × 200 file |
| Q-18 | Hosting details | Santhosh, Accucut IT | Before the first deployment | Answered in part (Outlook; weekly backup kept 2 years, the Admin looks after them; updates by their IT person). Open: web address, sender address, which Outlook account, what "Admin looks after them" means |
| Q-31 | Per-item totals in the export; total Tool Cost | Santhosh | G3 | **Closed, their words: "One total only"; "yes he Total Tool cost should be shown"** (AQP-1 10490, D-16). BL2, BN2 and BO2 once in row 2; the total Tool Cost in the Tool Cost column two rows below the last part, label in the cell to its left (this design, matching architecture 4.6) |
| Q-32 (a) | What QTY per Assy means, and the count for the nested example | Santhosh | G3 approval | **Closed, their words: "numner of lids is 24 here"** (AQP-1 10490) with the definition on AQP-13 10487. **Replaced by AQP-26:** the Engineer types the count for the whole order on every row (24 lids) and BL is the sum of every row's BG; applied on SCR-05, 06, 07, 10, 17 and 18. (DL-006 was met under the earlier rule, DL-011) |
| Q-33 | Values and handling of "Not applicable" | Santhosh | G3 | **Closed, their words** ("do not show them in the portal (even for admin)", AQP-1 10490): on no Admin list; a drop-down choice for Engineers. What Lead and Admin see: Q-36 |
| Q-34 | Scope for the completion date | Santhosh | G3 approval (DL-004) | Closed, their words: "I prefer the scope A for the intial release." (AQP-12 10488). This design covers both scopes |
| Q-35 | The item's own row, and what a part below the top shows | Santhosh | G4 | **Closed** by AQP-26 (the whole-order count). Section 0.6 |
| Q-36 | Where "Not applicable" is shown to Lead and Admin | Santhosh | G4 | **Closed** (AQP-1 10538 to 10545): the words "Not applicable" show to everyone on a part, in the drop-downs, and on no master list. Built (UX-60) |
| Q-37 | What a cleared total means for part figures, BN, the export and a price approved before an unlock | Santhosh | G4 | **Closed** (AQP-1 10545): (a) every calculated value on every row clears; (b) the portal blocks the download until a calculation is current; (c) the earlier approved price stays until a new approval or the Admin's removal. Built (UX-57 to UX-59) |
| Q-38 | Does Warn also cover a 0 on a part with nothing below it? | Santhosh | before the Warn story | **Closed, their word: "Yes"** (AQP-15 10527; SPEC v1.8 D-22). Its screens (UX-51) are held with the rest of Warn, see OQ-ARCH-10 |
| Q-39 | What an item or part with its own cost and parts below it does at a quantity above 1 (ASSUMPTION-57) | Santhosh | before the roll-up story passes G7 | **Closed** by AQP-26: the Engineer types the whole-order count on every row and nothing is multiplied down the tree. The screens follow it (section 0.7) |
| Q-41 | Warn on a row with 0, one rule on every row | Santhosh | before the Warn story | **Closed** (architecture 16.12): the row costs 0; one wording. UX-51 withdrawn. Built (UX-36) |
| OQ-UX-20 (new) | Does the masters-table rule (section 6.0: the Actions column is sticky, headings wrap) also apply to the Lead's task queue (SCR-03) and to Fields and formulas (SCR-17)? Their mock-up tables need 958 px (Lead queue), 764 px (Engineer list) and 760 px (SCR-17) in the 710 px region at 1024 px, and a row button is partly outside it | product-owner, with the stories for those screens | Before the SCR-03 and SCR-17 stories are made Ready | **Open.** Assumption used meanwhile: yes, the rule is written for any table with a row-actions column, and the mock-ups are not changed in 0.19. The queue's overdue row fill (`is-overdue`) would have to be repeated on the sticky cell |

### 11.1 Questions that remain for the delivery lead

The G3 questions were answered. These are the ones still open that touch the screens. None needs a working assumption on a screen any more. What holds G4 is the master's decision (DL-026).

1. **Q-18:** who looks after the backups, the web address, the sender address and the Outlook account.
2. **PRD and SPEC alignment (other roles):** the screens follow architecture v0.9. Where a PRD or SPEC sentence still describes the earlier roll-up or an out-of-date file, the screens win until it is aligned.

---


## 12. Verification of the review screens

Run on 2026-11-02 (version 0.5) with Google Chrome driven by `playwright-core` 1.64.1 (headless) and axe-core 4.14.0, against the files in the working tree: all 41 HTML pages (29 screen pages, 11 device frames and the index). The Playwright browser tool and chrome-devtools of the session were not used (they failed to connect earlier in the session); the same library ran from the script `generator/check-screens.cjs`, with the packages installed outside the repository. The figures check `generator/check-figures.cjs` needs Node only. Both are described in `generator/README.md`. Results of earlier versions are replaced by these.

| Check | Method | Result |
|-------|--------|--------|
| Opens by double-click, no server, no external request | Pages loaded from file addresses; fonts are self-hosted in `screens/fonts/` | Pass; a failed request would show in the console errors below |
| No horizontal page scroll at **360 × 800, 768 × 1024 and 1280 × 800** | Every screen page and every state of it (164 state links), all three widths; device frames at 1280 | **Pass**: 599 page-state loads, no overflow. Tables scroll only inside their own container |
| Script and console errors | Captured on every load | **None** after one fix. The first run reported four "Blocked autofocusing on a button in a cross-origin subframe" errors in the phone and tablet frames of SCR-05 and SCR-06, from the `autofocus` attribute on the new dialog buttons. The safe button now takes focus by script, and not inside a frame |
| WCAG 2.0, 2.1 and 2.2 A and AA rules (axe-core) | Full run on every state of every screen page at all three widths | **0 violations.** axe cannot judge focus order, the meaning of text or speech, so the manual rules in section 8 still apply |
| **Figures** (`check-figures.cjs`) | Every number with 2 to 4 decimals on SCR-03, 05 to 10 and 16 is checked against the data model; a parent shows only its own row, so no sum of rows below is allowed on any page | Every figure comes from the model (SCR-16's ₹ 4,750.00 is invented for other estimates and reused, not new). Identities hold: BL = the sum of every row's BG = 12,629.99; BN = BL ÷ total Tool Cost 4,900.00 = 2.58; the override difference is 29.99; the constructed case (2 frames, 6 pipes, 24 lids, each lid 1, each pipe 1, nothing on the frame) gives 24 + 6 + 0 = 30; row 1.1.1 has a count of 16. Each working line on SCR-07 reproduces its result: the build throws otherwise, and it built. **No sample figure changed** from version 0.4: BL, BN, BO, the override difference and every row's BG, BJ and BK are the same |
| **Engineer pages show no amount, rate, formula, price or Σ** | Visible text of SCR-01, 02, 03 (Engineer), 05, 23, 24, 26 in every state (outside the review notes): an amount (₹, $ or € followed by a number), BG, BL, BN, BO, BJ, BK, "Material Rate", "exchange rate", "formula", "rate", "unit production", "screen figure", "Excel row", "price" | **None**, including the two new SCR-05 states (the quantity warning names rows and says each will cost 0, with no other figure). The rupee signs on SCR-05 are unit tags on the Engineer's own inputs |
| Contrast of every token pair | `generator/contrast.cjs` (section 7.3) | Pass up to version 0.9; no colour was added then. The pressed pairs of section 7.3.1 are in the same run (lowest 5.94:1, at the darkest edge of the shadow under a ghost button). **Version 0.10 added two colours** (`--primary-pressed`, `--danger-pressed`); their ratios in section 7.3.1 were computed with the WCAG formula by a scratch script, and are **not yet in `generator/contrast.cjs`** |
| Pressed state of every button variant (version 0.9) | Ratios from `contrast.cjs`; the look from SCR-00 section 05 (each variant shown held down, and live on `:active`); the generator built to a scratch folder and compared page by page | Ratios pass. Only SCR-00 changed among the pages. **Not yet looked at on a phone:** the held-down look on the iPhone that found DEF-008 is a QA check (section 7.3.1, rule 10). **Version 0.10:** the delivery lead's phone check found the primary and danger pressed fills too close to rest (1.30:1 and 1.37:1); the new fills are 2.25:1 from rest. Computed, **not yet looked at on the phone and not yet in the mock-ups** (`screens.css`, `contrast.cjs`) |
| First-open states and the pressed exception (version 0.11) | Ratios computed with the WCAG formula by a scratch script: `--ink` and `--ink-2` on the held `--border` fill, `--danger-ink` on `--danger-soft`; the existing code at `origin/master` read for the account trigger | Ratios pass (12.71:1, 6.04:1, 7.87:1; 3.39:1 only on the top pixel row of the inset, where no glyph sits). **Not done:** the states are not yet drawn in the SCR-25 mock-up pages, no page was built, nothing was looked at in a browser or on a phone |
| Build warnings | The build prints a warning for a title over 60 characters or a description over 160 | None |
| Looked at by eye | Screenshots at 1280 px of SCR-06 (Total cleared, Approval cancelled (Admin), Cancel approval dialog) and SCR-10 (Total cleared), and SCR-05 (Quantity warning) at 360 px | Looked right after the fixes below. **Not looked at by eye:** the other new states, SCR-07, 08 and 15, and any page at 768 px |
| Generator reproduces the pages | Built to a scratch folder and compared file by file with `docs/03-ux/screens/` | 41 pages identical; only `screens.css`, `screens.js` and `fonts/` are not generated |

**Version 0.19: masters tables (DEF-021).** Run on 2026-11-09 with Google Chrome driven by `playwright-core` (installed outside the repository, in the main working copy's `node_modules`, read only; the Playwright and chrome-devtools tools of the session were not used), against pages built by `generator/build.cjs` in a separate worktree of `origin/master` (861cac8).

| Check | Method | Result |
|-------|--------|--------|
| The mock-up shows the fault before the change | The unchanged generator built to a scratch folder; for `SCR-13.html`, the Edit and Delete buttons of the first row against the right edge of the table region at 768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366 and 1440 px | **Reproduced:** outside the region at 768, 900, 1000, 1024, 1180 and 1257 px (the table needs 980 px; the regions are 718, 850, 950, 710, 866 and 943 px); inside at 1023, 1279, 1280, 1366 and 1440 px. `SCR-11.html` was inside at every width. The build differs slightly (968 px, and the buttons stay out up to about 1270 px), as QA's report says |
| Every row action stays inside the region after the change | `generator/check-screens.cjs`: for every state of `SCR-00`, `11`, `12`, `13` and `14`, at the 11 widths of section 6.0, with the region scrolled to its start and to its end, and again with the table forced to 1000 px wide | **0 problems in 946 page-state loads.** The forced-width runs are what prove the sticky column, because the tables need 565 to 664 px and so do not scroll in the 710 px region by themselves |
| The check can fail | On `SCR-13.html` at 1024 px with the table forced to 1000 px, the sticky position of the Actions column was switched off by a script | The Edit button went outside the region (`false`); with the rule on, inside (`true`) |
| The page does not scroll sideways | `generator/check-screens.cjs` at 360, 768 and 1280 px on the five pages, every state | No overflow reported |
| Narrowest width each table can shrink to | `table.offsetWidth` with the width forced to 1 px, at 1440 px, before and after | Process master 699 to 565 px; Materials 980 to 602 px; Customers 620 to 664 px; Users 576 to 664 px. Customers and Users grew because their buttons no longer wrap inside the cell. All four are under 710 px |
| Other pages with the same fault | Every page of the screens folder (default state) at 768, 1024, 1280 and 1440 px, looking for a scrolling table whose first-row buttons are outside its region | `SCR-03.html` (958 px), `SCR-03-engineer.html` (764 px) and `SCR-17.html` (760 px), at 1024 px in a 710 px region, with a row button partly outside. `SCR-06`, `SCR-10` and `SCR-25` also scroll, but their tables hold no row buttons. Flagged as OQ-UX-20, not changed |
| Looked at by eye | Screenshots of `SCR-13` at 768 px, `SCR-14` and `SCR-11` at 1024 px, `SCR-11` before and after at 1024 px, `SCR-00` section 11 scrolled to its end | Looked right. Before the change the two buttons of `SCR-11` stacked above each other in a crowded cell; now they sit side by side and the rows are shorter |
| WCAG rules (axe-core), overflow and script errors on every page | `check-screens.cjs --skip-masters` on all pages | **0 problems on 41 pages in 626 page-state loads** at 360, 768 and 1280 px: no page overflow, no script error, no axe-core violation (WCAG 2.0 to 2.2 A and AA). One run, about 25 minutes |

**Not run in 0.19.** The real build (the mock-up's sample names are short; the developer measures 100-character names), a real tablet, a screen reader, the focus test of a control under the sticky column (the SCR-12 name link is the one case; the tables fit, so nothing scrolls under the column in the mock-up), and Windows high-contrast mode.

**Not run in this version.** The sticky-offset test (focused field under the top bar or action bar, UX-14) was not repeated: the new Admin dialogs and notices are not sticky, but the action bar of SCR-06 now holds up to five buttons and wraps to a second line at 1280 px, which was not measured. A real screen reader, a real phone, Windows high-contrast mode and a usability test were not run. The review screens do not validate or save anything.

Defects found and fixed during this verification, all found by looking at the screens or by the scripts: the state switcher gave a wrong answer for an element with both `data-show` and `data-hide` (two "Not set yet" tiles and a Remove price button appeared in the wrong states); a state label with a comma split into two buttons; the SCR-10 "Building the file" message printed `${NODES.length}` since version 0.4; and the console errors from `autofocus` above.

Known limits of the mock-ups. They do not validate or save anything. Enter-to-next-field, the multi-select, "Other" reveal, copy path, the drawers, the resizable tree, the measured sticky offsets and the state switcher work; most other buttons only link between screens. Hidden state variants on one page repeat element IDs, which a real build does not. A state that reuses another state's content (the dialogs, "Rates changed", "Approval cancelled (Lead)") does so through `data-bases` on the page. The Admin states of SCR-06 keep the Lead's name in the top bar. The quantity warning notice on SCR-06, 08 and 10 is a wording preview with example rows that are not in the sample tree.

---

## 13. Change log

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-11-01 | First G3 draft: 27 screens on 29 pages, 11 device frames, delivery lead UI decisions recorded, G2 condition 6 and condition 5 applied |
| 0.2 | 2026-11-01 | Reconciled with architecture.md v0.2 section 16: all 27 items UX-01 to UX-27 applied (table in section 0.4; no item dropped). New states: SCR-06 Draft with Calculate and Draft after unlock; SCR-10 Not calculated and Inputs changed; delete and blocked on SCR-12 and 13; password messages on SCR-02, 14 and 23; Set a new password on SCR-23; BL and ROLLUP warning, no sample row and too many attempts on SCR-18; User change and Task change on SCR-16. Worked lines on SCR-07 reproduce their results; rounding stated on SCR-06, 07, 10; parent figure box carries BJ and BK sums and a limited written-out sum. Fonts: rupee subset added, Σ and arrows are SVG icons. Sticky offsets measured. Corrected: SCR-08 override difference, SCR-10 Download in the Approved state, tree panel under the action bar, About wording. Open questions OQ-UX-13 to 18 added; section 11.1 lists the questions for G3. 134 state links |
| 0.3 | 2026-11-01 | Requirements v1.4 and the delivery lead's G3 answers (AQP-1 10490, 10491, 10493) and architecture v0.3 section 16.8 (UX-28 to UX-37, UX-36 not applied). **Quantity rule:** every level's quantity applies; rule text, tree and node figures, "How the total is built", SCR-10 "How BL2 is made", SCR-17 and 18 wording; Base frame (1.1) now has quantity 2, so BL is 12,629.99, BN 2.58. **Total cleared** replaces "Inputs changed" on SCR-06 and SCR-10; new states Unlocked and changed, Confirm out-of-date download. **Optional reason** on SCR-08, shown on SCR-06, 10 and 16. **Password** number and symbol on SCR-02, 14, 23; "proposed" removed. **Export:** one total; Total Tool Cost row below the parts, label in the cell to its left; out-of-date markers. **"Not applicable"** removed from SCR-13; Q-36 working assumption on SCR-06 and 07. **"Not needed" switch** closed and its reserved-slot note removed. **About** note corrected. SCR-15 Last backup and sender states, SCR-26 12-hour wording, SCR-13 specific gravity above 0. OQ-UX-01, 02, 05, 06, 10, 12 closed; OQ-UX-19 added; section 11.1 rewritten. Q-35, 36, 37 are labelled working assumptions (section 0.6). 146 state links |
| 0.4 | 2026-11-02 | G3 conditions 12 and 13; **the whole-order quantity rule (AQP-26)** on SCR-05, 06, 07, 10, 17 and 18 and in sections 0.5 to 0.7, 5, 6, 9 to 11 (BL, BN, BO, item totals and the override difference are unchanged; row BG values and parent figures changed; "Rows above multiply by" and ROLLUP are gone; BL is `SUM(BG)`); architecture v0.5 items UX-38 to UX-43, consistency items CR-06 to CR-08 and CR-10, PRD v0.8, SPEC v1.8. New states: SCR-07 Total cleared; SCR-08 Estimate changed while open; SCR-14 Hand over: wrong password. SCR-01 is noindex. SCR-17 lists BM as a System field and Scrap Weight with its guard. SCR-15 labels the backup line Proposed (FR-105). Section 9 gains FR-098 to FR-105 (105 FRs) and FR-060 is mapped to SCR-07. Section 11 follows PRD v0.7 and v0.8. The generator is filed in `generator/`. **Held:** UX-36 and UX-44 to UX-51 (Warn) until the product manager confirms its scope. |
| 0.5 | 2026-11-02 | Architecture v0.8 (sections 16.12 and 16.13) and SPEC v1.10. **Rules:** a parent shows only its own row (one box per row, the count beside it); a 0 makes the row cost 0 (Warn, Q-41); every calculated value clears on any input change; no Excel file until a calculation is current (no out-of-date file, name, tab, notice row or dialog); the approved price stays until a new approval or the Admin removes it; "Not applicable" shows to everyone on a part. **New or changed states:** SCR-05 Quantity warning and Warning with a new list, Part Model optional; SCR-06 Rates changed, Quantity warning (Recalculate), Warning on this calculation, Approved (Lead and Admin), Cancel approval, Approval cancelled (Admin and Lead), Remove price, Price removed; SCR-07 Total cleared reads "Cleared. Press Recalculate"; SCR-08 Quantity warning, Rates changed, After an unlock; SCR-10 After an unlock, Not calculated and Total cleared without a file card or table, Quantity warning; SCR-15 Disk nearly full and the firm Last good backup; SCR-16 Approval cancelled, Price removed and Quantity warning entries. UX-36, UX-44 to UX-50, UX-52 to UX-65 applied; UX-51 withdrawn; UX-38 and UX-39 overtaken. No sample figure changed. Fixed: the SCR-10 "Building the file" message printed `${NODES.length}`; the state switcher now handles an element with both `data-show` and `data-hide`. |
| 0.6 | 2026-11-02 | Small fixes from the consistency report. **CR-22:** FR-106 (rate notice), FR-107 (Cancel approval) and FR-108 (Remove price) are in sections 5 and 9 and in the review bars of SCR-06, 08, 10 and 16; the intro says 108 FRs. **CR-26:** SCR-15 is R1 core for the Settings frame and the Last backup line (FR-105) and R2 for the e-mail alert controls, in the page, the inventory, the information architecture and the index (the row moves to Masters and administration). **CR-29:** FR-029 and FR-100 rows no longer mention a parent figure, "an item with nothing below it" or the old Unlocked wording; OQ-ARCH-01 and OQ-ARCH-12 and section 11.1 are closed or updated (A-05 replaced by A-32; the Admin holds the backup key and runs the restore). No sample figure changed. |
| 0.7 | 2026-11-02 | G4 remediation 7, CR-32: SCR-01 and UJ-01 now agree. A failed sign-in keeps the e-mail and the password as typed and clears nothing; the password stays masked with the show/hide toggle. UJ-01's "except the password" is withdrawn. No page changed (the SCR-01 mock-up already keeps both values). |
| 0.8 | 2026-11-03 | Master data names and units, from the delivery lead's corrections recorded in SPEC v1.13 (sections 4.1 and 4.3, D-38, D-39; AQP-1 comment 10672; Q-42 answered: Plating Cost stays typed in). **SCR-11 and SCR-12:** the Process master has 15 rates, not 14. Plating-rate-per-sqin (per sq in) follows Polishing-rate-per-sqin; no formula uses it, so its Used in cell reads "None yet" and no customer holds its own value. SCR-12 lists it in the customer rate table and the reset dialog says "All 15 rates". The Add rate example is Buffing-rate-per-sqin (per sq in), which is not a seed name, and the No match example searches "buffing". **SCR-13:** the scrap column, in the table header and in both Add material dialogs (Duplicate name, Specific gravity 0), is Material-Scrap-Rate (per kg). **OQ-UX-07:** the rate-unit half is closed. Names and units only: no real rate value is on any screen or in the generator (ADR-014), and the invented example values are kept. Pages and state links are unchanged (29 screens, 164 state links). |
| 0.9 | 2026-11-04 | (Row added in 0.10; it was missing.) Pressed state of every button variant, DEF-008 and QA OBS-6: new section 7.3.1, one non-colour token `--shadow-pressed`, SCR-00 section 05 shows the pressed samples. |
| 0.10 | 2026-11-04 | DEF-010 (AQP-185, #64) and QA OBS-2, from the delivery lead's iPhone check of PR #56. **Section 7.3.1:** two colours added, `--primary-pressed` #7F1616 and `--danger-pressed` #520F09 (the step from rest is 2.25:1, was 1.30:1 and 1.37:1; white text 10.35:1 and 14.67:1); pressed shows on the first frame (`active:transition-none`) and fades out over 200 ms on release; scale, translate and a stronger inset shadow rejected with reasons; all buttons get `select-none`, a real `<button>` also `-webkit-touch-callout: none`. **Section 7.3:** two token rows, `--primary-hover` is hover only. **Section 8 and 12:** Motion row and verification rows updated. The secondary, ghost and icon values, `--shadow-pressed`, the pages and the state links are unchanged. The mock-ups (`screens.css`, `contrast.cjs`) are not yet changed. |
| 0.11 | 2026-11-04 | AQP-188 DoR gap 2 (product-owner, Jira 10878). **Section 7.3.1:** rule 7 now points to a new rule 11, the one exception: a control that opens an overlay on its first open (today the menu button and the account trigger) stays enabled, has `aria-busy="true"`, keeps its variant's pressed look held, ignores a second press and is cancelled by Escape; why it is not disabled; the visibility on the iPhone (menu button yes on evidence, account trigger has no pressed rule today and is expected yes once it has one); the `enabled:aria-busy:` classes for the four variants, the account trigger face classes, the failure line classes and the tests. **SCR-25:** states of the two controls (rest, first open pending, first open failed, open, not applicable), the two failure lines (the architect's wording confirmed), their look, place (0 px shift) and clearing, accessibility and responsive notes. **Section 7.3, 8 and 12:** Loading row, Dynamic content row and a verification row. No colour, token, page or state link added; the mock-up pages are not yet changed. |
| 0.12 | 2026-11-05 | AQP-48 (PR #79) asked which wording is right on the No access page: "Go to my tasks" (mock-up) or "Go to your tasks" (build, every role). **SCR-26:** the button names the person's own landing page as the menu does: Engineer "Go to my tasks", Lead and Admin "Go to the task queue"; "Go to your tasks" for all roles is not used; the label depends on the viewer's role only, so UX-22 holds; the role-neutral "Go to the task list" is an accepted interim (Minor). The SCR-26 mock-up gets a review note (it stays the Engineer view). No colour, token, page or state link changed. |
| 0.13 | 2026-11-05 | DEF-014 (AQP-198, GH #82, Sev-2 DL-094): the account trigger's name was `Account menu, <name>, <role>` while the screen shows the initials (360 px) or the initials, name and role (768 px and wider), so it failed 2.5.3 Label in Name. **SCR-25:** new paragraph "Account trigger: accessible name": the name is `Account menu, <initials>, <name>, <role>` at every width and in every state (pending, failed, open); the table by width, the rules, the rejected per-width name, the order contingency, the spaces the markup needs between the parts, the tests. **Section 8:** Labels and names row gains Label in Name. **Mock-ups:** every page's account trigger carries the same name (the generator `lib.cjs`). No colour, token, page or state link changed. |
| 0.14 | 2026-11-05 | AQP-65 (PR #87, SCR-14), three questions from the developer. **SCR-14:** (1) the Edit user dialog is specified: title "Edit <name>", the e-mail shown and not editable, fields Name and Role, Cancel and Save, own row with the Role disabled and the reason as its hint, second-Admin refusal as in Add, nothing-changed closes silently, saved and failed wording; states Edit, Edit own row, Edit with second Admin refused added. (2) The interim password hints are accepted: the rule sentence stays out of First password and Reset until story 01.05 applies FR-098; the notice sentences stay; 01.05 restores the sentence and the four password-rule states. (3) A dialog that does not open shows a page notice at the top of the content, "The form did not open." or "The confirmation did not open.", with "Check your connection and try again."; state Form did not open added. **SCR-25:** the general rule: the line under the control for the two top-bar controls, a page notice for controls in page content. The SCR-14 mock-up shows the four new states. No colour, token or page changed. |
| 0.15 | 2026-11-05 | AQP-65, standards finding STD-08 (master G6, Jira 11035). **SCR-14:** the own row: Reset password disabled with the accessible name "Reset password is not available for your own account. Use Change password in the account menu." (the developer's wording, adopted; it begins with the button's own name so the phone-card label is inside it, WCAG 2.5.3); a visible reason under the buttons on the phone card; why the Admin cannot reset their own password; Change password is in the account menu (SCR-23) and works from story 01.05 (AQP-81). The SCR-14 mock-up shows the own row and the card. No colour, token, page or state link changed. |
| 0.16 | 2026-11-06 | AQP-74 (PR #97, SCR-16), the developer's four questions and the PM's two. **SCR-16:** (1) time format: "06 Nov 2026, 17:00 IST" everywhere on the screen, header "When"; the bare time of the mock-up is withdrawn. (2) The description says "The portal has no way to edit or delete an entry", with no "permanent" and no "Nobody" (ARCH-R8). (3) Two empty states: "No entries yet" (no filter, no button) and "No entries match" (Clear filters, focus to Who). (4) Task change and Configuration change stay out of the Release 1 build. (5) Six user-change entry texts, including `user.renamed` "Old name → New name". (6) Who and Object show the name at the time; the Who filter works by person; the entry needs to keep the actor's name (architect). The SCR-16 mock-up shows the new times, description, both empty states and a rename entry (index 172 to 173 state links). No colour, token or page changed. |
| 0.17 | 2026-11-06 | AQP-113 (PR #107, SCR-11), master G6 condition 5, QLT-06 and QLT-11. **SCR-11:** (1) A rate deleted elsewhere: when Edit rate or Delete rate is answered "not found", the dialog closes at once, a page notice in the "Saved" slot says `<name> no longer exists.` (Edit, warning tone) or `<name> was already deleted.` (Delete, information tone) with one sentence, the list is read again, and focus goes to the page heading. Role `status`, not `alert`; no toast; no timer; the "Try again" notice stays for network and server failures only. The rule "when the opener no longer exists, focus goes to the heading" also covers a successful delete. (2) The Delete blocked link: recommended as plain text while `/config/fields` is `planned` (title and list kept, sentence "Formulas cannot be changed until Release 2, so this rate stays on the list.", Close only); the link and "Change those formulas first." return when the route manifest says the page is live, from the one manifest value. The product-owner amends AC-4 if it agrees. The SCR-11 mock-up is unchanged (no frame yet for the new state). No colour, token or page changed. |
| 0.18 | 2026-11-08 | AQP-122 (PR #120, SCR-13 Materials tab), master G6 condition 4 (Jira 11186, DL-115), QLT-08 and the standards note on the page description. **SCR-13:** (1) The developer's proposed words are ruled: "Enter the Material Considered.", "Enter a number above 0, with up to 2 decimals.", "Search materials", "No materials yet", "No material matches ..." with "Check the spelling, or clear the search." and "Clear filters" are confirmed. (2) Three amended: the Material in Drawing required message is "Enter the Material in Drawing." (was "Enter a name."), so the two required messages are parallel (SCR-12's "Enter the ..."); the search placeholder is "Material in Drawing or Considered" (the old one is cut off at 360 px); the Empty text is "Add the first material. A part's Material in Drawing is chosen from this list." (the old one said the form offers only the listed materials, but it also offers "Not applicable"). (3) The page description and the description meta name only the tabs that exist: Release 1 interim "Material prices, specific gravity and scrap rates." and "Manage the materials used in estimates."; the final words and the in-between stages are in the table; a one-tab bar is accepted. (4) States Add, Edit, Saved, Empty and No match added to the list, with every word of the Materials tab in one table. The SCR-13 mock-up is unchanged (it shows the final three-tab design); add Empty and No match frames when the delivery lead asks. No colour, token or page changed. |
| 0.19 | 2026-11-09 | DEF-021 (AQP-234, GH #127, Sev-3), master G7 condition 1 on AQP-122 (DL-121), from QA's report of 2026-11-09. **Section 6.0:** new "Masters tables": the pass line (every row action visible without scrolling the table at every width from 768 to 1440 px); the region widths (718, 973, **710**, 965, 966, 1052, 1126 px; design for 710); five parts (the last column is Actions; it is sticky at the right edge with an opaque fill, a hairline made with an inset shadow, `z-index` 1 in an isolated region and the width its buttons need; headings wrap and names wrap so tables seldom scroll; the region stays a focusable named region with `scroll-padding-inline-end` equal to the Actions width; no column is hidden to fit); what the person sees when a table scrolls; four other ways weighed and rejected with reasons (headings alone, hidden columns, cards up to 1279 px, Edit in the first column); where it applies; build notes; tests at eleven widths. **SCR-13:** the Materials table and the Treatment / Color table follow it; the Actions column is 68 px (Edit only) or 112 px. **SCR-11:** the rule applies; the build is 8 px short of the region at 1024 px and shows its pencil only because of cell padding; one change in the shared `Table` fixes both screens. **Mock-ups:** `SCR-11`, `12`, `13` and `14` use the rule; `SCR-00` gets section 11 (a narrow box that scrolls with its Actions column held); `generator/check-screens.cjs` gets a check of every row action at eleven widths, scrolled to the start and the end, and with the table forced to 1000 px; `screens.css` gets the `.is-master` and `.col-actions` rules. **Flagged, not changed:** SCR-03 (Lead and Engineer) and SCR-17 have the same fault at 1024 px (OQ-UX-20). No colour, token, page, state link or word on any screen changed. |
