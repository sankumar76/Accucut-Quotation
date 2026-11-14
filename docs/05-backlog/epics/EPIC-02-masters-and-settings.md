# EPIC-02: Masters and settings

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-17](https://sankumar76.atlassian.net/browse/AQP-17) (labels `ai-delivery`, `aiid-EPIC-02`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-014 is R1+ stretch) |
| Priority | High. PRD value 4. Effort 5.75 to 9.5 h core plus 2 to 3 h stretch (estimate, release plan v0.11) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. Scope changed (FR-105 added; "Not applicable" narrowed), so the Jira epic was edited |

## Goal & User Value
The Admin holds the rates and lists that drive every calculation, so a Lead gets prices that follow Accucut's own rates and an Engineer picks customers and materials without ever seeing a rate. The Admin can also see on Settings that the weekly backup ran.

## Requirements Covered
- Functional: FR-012, 013, 015, 016, 017, 018, 105 (R1 core); FR-014 (R1+ stretch). 8 FRs. FR-019 (the alert switch on Settings) is EPIC-09.
- Non-functional: NFR-001 (Admin-only), NFR-006 (invented placeholders only), NFR-007 (master edits audited), NFR-013 (the Last backup line is how the Admin checks).
- Business rules: BR-003 and BR-004 (Admin-only masters; no rate reaches an Engineer; asserted by every master story's role and scan criteria), BR-028 to BR-033, BR-048; D-17, D-27, D-33, D-36.

## Scope
**In:** Process Master (named rate, unit, default; used-by check); Customers (name only required, rates, Reset to Defaults, delete guard); Material Master (unique Material in Drawing, Specific Gravity above 0, delete guard); Exchange Rate Master; Treatment / Color list ("Other" always present); system-created "Not applicable" entries: offered to anyone who edits a part, the words show on a part to everyone, no master list or Admin page holds them, zero values and the Material Considered and Material Rate fields stay hidden or blank (D-27); propagation prompt when a default changes (stretch); **the Settings page frame with the read-only Last backup line, the "Backup late" notice after 8 days and the "Disk nearly full" notice below 20 percent free (FR-105, firm, R1 core)**.
**Out:** the alert switch, sender and test e-mail on Settings (FR-019, EPIC-09, which fills the frame this epic builds); the backup job and the restore command (EPIC-10); real master data (the Admin types it at first use, D-23, ADR-014); entry of rates beyond 2 decimals (D-24: no).

## UX & Architecture References
- Screens / journeys: SCR-11, 12, 13, 15 (staged R1 core for the Last backup line and R2 for the alert controls since UX v0.6, CR-26 closed); UJ-10, UJ-13.
- Components: `server/masters`, `server/settings`, `lib/fields`; architecture sections 4.9, 5.1, 5.5, 9.5; ADR-002, ADR-014.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-02.01 | Process Master list and edit | Admin adds, updates and deletes rates; a used item cannot be deleted and the formulas are listed (FR-012) | CRUD operations | 01.04, 03.01 (the used-by index) | Draft |
| 2 | STORY-02.02 | Customers with default rates and Reset to Defaults | Name-only customer, one value per Process Master item, reload defaults after confirmation (FR-013) | CRUD (create, edit, reset) | 02.01 | Draft |
| 3 | STORY-02.03 | Material Master | Unique Material in Drawing, price per kg, Specific Gravity above 0, Material-Scrap-Rate per kg (FR-015) | CRUD | 01.04 | Draft |
| 4 | STORY-02.04 | Exchange Rate Master | 1 USD and 1 EUR in INR with last updated by and at (FR-016) | Data variation (two rates) | 01.04 | Draft |
| 5 | STORY-02.05 | Treatment / Color list | CRUD with "Other" locked (FR-017) | CRUD | 01.04 | Draft |
| 6 | STORY-02.06 | "Not applicable" system entries | Created at install in Material and Treatment, values 0, not editable or deletable, in no list; offered in the drop-down to Engineer, Lead and Admin; the words show on a part to everyone; material cost only skipped (FR-018, D-27) | Business-rule variation | 02.03, 02.05, 03.03 | Ready for Dev (AQP-305, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 7 | STORY-02.07 | Delete customer or material with guard | Refused while a Draft or Submitted estimate uses it, estimates named; calculated estimates keep their figures (FR-013, 015) | CRUD (delete) | 02.02, 02.03, 04.01 | Ready for Dev (AQP-306, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 8 | STORY-02.08 | Propagate a changed default (R1+) | Customers equal to the old default update; others get apply or keep, with apply-all and keep-all (FR-014) | Workflow step | 02.02 | Draft |
| 9 | STORY-02.09 | Settings page frame and the Last backup line | Admin-only Settings page with the date of the last good backup, "Backup late" after 8 days, "Disk nearly full" below 20 percent free from the newest free-space reading in `job_runs` (weekly `backup` row or daily `backup-watch` row, so it is at most a day old on Windows); read-only, no control that starts, restores or deletes a backup; an Engineer or Lead cannot open it (FR-105, NFR-013, DL-211) | Workflow step (read) | 01.02, 01.04 (creates the `job_runs` table; 10.05 only writes rows) | Ready for Dev (AQP-307, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |

Splitting note: 02.09 is the page frame that EPIC-09 later fills (STORY-09.02). Its hours are in EPIC-09's row, not here (release plan 3.1, CR-27).

## Epic Acceptance Criteria
- [ ] A new customer's rates equal the current defaults; reset after confirmation restores them.
- [ ] A used Process Master item cannot be deleted and the formulas using it are listed; a duplicate Material in Drawing is refused.
- [ ] "Not applicable" exists after install with all values 0, cannot be edited or deleted, appears on no list or Admin page, is offered to Engineer, Lead and Admin in the two drop-downs, and shows as text on a part to everyone.
- [ ] Deleting a customer or material used by a Draft or Submitted estimate is refused and names the estimates.
- [ ] In a controlled-clock test a last good backup 7 days old shows its date and no notice, one 9 days old shows "Backup late", and a free-space reading below the threshold shows "Disk nearly full"; the lines have no control that starts, restores or deletes a backup.
- [ ] Each master edit creates exactly one audit entry (FR-011); no rate reaches an Engineer response.
- [ ] A rate whose unit is "%" follows the same entry rule as every other rate on SCR-11 and SCR-12: 0 or more, up to 2 decimals (D-24). Typed as 12 it means 12 %, typed as 12.5 it means 12.5 %; the formulas use 0.12 and 0.125 (FR-028).

## Product-owner rulings (AQP-142 G6, DL-172; 2026-11-12)

**Ruling 1: percent rates take decimals (QLT-07). AC change, in AQP-142 only.**
- **Question.** The Process Master (STORY-02.01, AQP-113 AC-2) accepts a "%" default with up to 2 decimals. AQP-142 AC-2 said "percent rates are whole numbers", so a customer rate could not be typed as 12.5, and a Reset could set a value the Admin could not type back (reviewer-quality QLT-07).
- **Ruling.** Decimals are intended. A customer's percent rate is a number of 0 or more with up to 2 decimals, the same rule as every other rate. AQP-142 AC-2 is amended (Jira AQP-142, change note of 2026-11-12). AQP-113 is not changed: its AC-2 already says this, and it is merged.
- **Why (read in this order).** (1) SPEC §18 D-24 (Q-40, the delivery lead's answer): rates "are entered with 2 digits after the decimal point, and the entry screens (SCR-11 to 13) keep that limit". It names no exception for "%" rates, and SCR-12 is inside that range. (2) SPEC §7.3, the validation default for numbers: 0 or more, max 2 decimal places. (3) The word "whole" is not in the SPEC. SPEC §7.4 says a "%" rate is "entered as a percentage (e.g. 12 = 12%) and evaluated as a fraction (0.12)". "Whole" first appears in PRD FR-028 ("a whole percentage (12 means 12 %)") and in the UX hint "typed as whole percentages: 12 means 12%". In both it sits beside the example 12 and describes the scale (12, not 0.12). The same words are on SCR-11, where decimals are accepted and merged. ASSUMPTION-39 has no "whole". (4) The formula engine already takes decimals: AQP-106 QA report AC-2, "OH Profit % typed 12 gives 0.12, 12.5 gives 0.125". (5) The database allows it (`customer_rates.value` is DECIMAL(18,4), CHECK value >= 0; no migration). (6) The risks are not equal. A refused 2.5 % makes the Admin round a rate, and every quote for that customer is then priced wrongly with no message. An accepted 12.5 harms nothing.
- **Assumption (CLAUDE.md §6 rule 4).** No document states, in the delivery lead's own words, that a percent rate may carry decimals; the ruling is read from D-24 and the engine. If the delivery lead says percent rates must be whole numbers, AQP-113 AC-2 and AQP-142 AC-2 both change the other way. Owner: Santhosh (delivery lead). Needed by: before G8. It does not hold AQP-142's merge.
- **Effect on code.** AQP-142 (developer, fix round F1 or the alignment commit; re-review covers it): a percent rate is judged by `DECIMAL_TEXT_PATTERN` and `DECIMAL_TEXT_MESSAGE` like any other (remove the `WHOLE_NUMBER_*` branch of `rateProblem` in `src/lib/masters/customers.ts`; the server uses the same function); `RATES_HINT` and `startingText` in `customer-form.ts` follow; the unit, integration and E2E tests that expect "Enter a whole number, 0 or more." change (`customers-lib.test.ts` lines 95 to 132, `customers.test.ts` line 212, `RATE_WHOLE` in `tests/e2e/support/customers.ts`, used at `customers.spec.ts` 197 and 208 and `customers-focus.spec.ts` 72 and 81). A refusal test keeps a value that is still wrong (for example `12.555` or `abc`). `customers-focus.spec.ts` must still go red under controls A1 (`:131`) and A2 (`:105`) at three widths. AC-2 needs two new cases: `12.5` accepted and saved on a percent rate; `12.555` refused with "Enter a number, 0 or more, with up to 2 decimals.". The "untouched stored value is not re-judged" rule stays (it is still right for any value that became invalid later). AQP-113: no change.
- **Wording for other roles.** ux-expert: SCR-12 "Percent rates use whole numbers." and the hint `RATES_HINT` ("Percent rates are whole numbers: 11 means 11%"), and the SCR-11 hint "typed as whole percentages", should say "typed as percentages: 12 means 12 %" (suggested; the words are the ux-expert's). product-manager: FR-028 "a whole percentage" should read "a percentage (12 means 12 %, 12.5 means 12.5 %)". Neither holds the merge; the developer needs the ux-expert's hint sentence before F1 closes.

**Ruling 2: unsaved typed rates and the Reset dialog (ux-expert flag, SCR-12 v0.24). Not an AC change. A small content requirement; does not hold AQP-142's merge.**
- **Facts (read from `use-customer-edit.ts`, `customer-texts.ts`, `customer-reset-dialog.tsx` on `origin/feat/AQP-142-customers`).** After a confirmed Reset the page adopts the server's customer: every rate input returns to the default, so a rate value typed and not yet saved is dropped. Typed details (name, phone, e-mail, address) stay. The dialog lists only the saved values that differ from the default.
- **AC-3 is met as written.** It asks that the dialog names the rates that will be replaced, that after a confirm every rate equals the default, and that a cancel changes nothing. All three hold. Dropping an unsaved typed rate follows from "every rate equals the default"; the person pressed Reset to defaults on purpose, after a confirm dialog. No AC changes.
- **What is still wrong is two sentences, under the rule of ux-spec 0.22 ("a sentence is used only if it is true in every case it can appear in").** When the customer's saved rates all equal the defaults but the Admin has typed a different value in a rate box, the dialog says "All N rates already equal the current Process master values, so nothing will be replaced." and, after the confirm, the notice says "Every rate equals its current default, so nothing was replaced." The typed value was replaced. This case is plausible: the Admin types something, then presses Reset to start again.
- **Requirement (testable).** In every case the Reset dialog says that rate values typed on the page and not yet saved are replaced too, and says nothing about the details being dropped (they are kept). In the case of no saved difference, neither the dialog sentence nor the notice may say "nothing will be replaced" or "nothing was replaced" while a typed rate exists. Owner of the words: ux-expert (a v0.25 line under SCR-12 "final words"). Owner of the build: developer, as a constant in `customer-texts.ts` and one test per case; no new dialog prop is needed if the added sentence is shown in every case (a sentence that is true when no rate was typed too). The notice for the zero case can read from the saved count only if its words say "saved".
- **Priority and timing.** Should. It is not in AQP-142's ACs, so QA does not fail the story on it. Fold it into F1 if the ux-expert's words arrive before F1 closes; otherwise open a `follow-up` issue (developer) due before G8.

## Dependencies & Risks
- Depends on: EPIC-01. 02.07 needs EPIC-04 (estimates exist). 02.06's skip of material cost is exercised through EPIC-03. 02.09 needs the backup job's `job_runs` rows (STORY-10.05).
- **No open question holds a story.** Q-36 is answered (D-27), Q-40 is answered (D-24: 2 decimals on entry stands), and OQ-ARCH-12's key-holder part is answered (D-36). OQ-UX-07 (units beside inputs) stays with the Admin and is confirmed when the master data is typed in; it holds no story.
- Reading carried: D-27 narrows "do not show this anywhere" to "the text shows on a part; zero values and master lists stay hidden" (the orchestrator's reading, SPEC §18 D-27). Story 02.06 states it in Dev Context.
- Risks: RISK-006 (real data reaching the public repository): the stories use invented placeholders and the CI scan of story 10.01 applies. ARCH-R7 (a full disk on the same server) is shown to the Admin by 02.09.
