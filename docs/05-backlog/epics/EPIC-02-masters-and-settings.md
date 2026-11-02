# EPIC-02: Masters and settings

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-17](https://sankumar76.atlassian.net/browse/AQP-17) (labels `ai-delivery`, `aiid-EPIC-02`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-014 is R1+ stretch) |
| Priority | High. PRD value 4, effort 5.5 to 9 h core plus 2 to 3 h stretch (estimate). Rank 3 |
| Status | Draft |

## Goal & User Value
The Admin holds the rates and lists that drive every calculation, so a Lead gets prices that follow Accucut's own rates and an Engineer picks customers and materials without ever seeing a rate.

## Requirements Covered
- Functional: FR-012, 013, 015, 016, 017, 018 (R1 core); FR-014 (R1+ stretch). 7 FRs. FR-019 (Settings) is EPIC-09.
- Non-functional: NFR-001 (Admin-only), NFR-006 (invented placeholders only), NFR-007 (master edits audited).
- Business rules: BR-028 to BR-033, BR-048; D-17.

## Scope
**In:** Process Master (named rate, unit, default; used-by check); Customers (name only required, rates, Reset to Defaults, delete guard); Material Master (unique Material in Drawing, Specific Gravity above 0, delete guard); Exchange Rate Master; Treatment / Color list ("Other" always present); system-created hidden "Not applicable" entries; propagation prompt when a default changes (stretch).
**Out:** Settings and e-mail (EPIC-09); real master data (loaded outside the repository after HOLD-01, ADR-014); the Admin's configuration of fields and formulas (EPIC-08).

## UX & Architecture References
- Screens / journeys: SCR-11, 12, 13; UJ-10.
- Components: `server/masters`, `lib/fields`; architecture sections 4.9, 5.1, 5.5; ADR-014.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-02.01 | Process Master list and edit | Admin adds, updates and deletes rates; a used item cannot be deleted and the formulas are listed; whole-percentage rule for "%" names (FR-012) | CRUD operations | 01.04, 03.01 (for the used-by index) | Draft |
| 2 | STORY-02.02 | Customers with default rates and Reset to Defaults | Name-only customer, one value per Process Master item, reload defaults after confirmation (FR-013) | CRUD (create, edit, reset) | 02.01 | Draft |
| 3 | STORY-02.03 | Material Master | Unique Material in Drawing, price per kg, Specific Gravity above 0, scrap rate (FR-015) | CRUD | 01.04 | Draft |
| 4 | STORY-02.04 | Exchange Rate Master | 1 USD and 1 EUR in INR with last updated by and at (FR-016) | Data variation (two rates) | 01.04 | Draft |
| 5 | STORY-02.05 | Treatment / Color list | CRUD with "Other" locked (FR-017) | CRUD | 01.04 | Draft |
| 6 | STORY-02.06 | "Not applicable" system entries | Created at install in Material and Treatment, values 0, not editable or deletable, listed nowhere, material cost only skipped (FR-018) | Business-rule variation | 02.03, 02.05, 03.03 | Draft |
| 7 | STORY-02.07 | Delete customer or material with guard | Refused while a Draft or Submitted estimate uses it, estimates named; calculated estimates keep their figures (FR-013, 015) | CRUD (delete) | 02.02, 02.03, 04.01 | Draft |
| 8 | STORY-02.08 | Propagate a changed default (R1+) | Customers equal to the old default update; others get apply or keep, with apply-all and keep-all (FR-014) | Workflow step | 02.02 | Draft |

## Epic Acceptance Criteria
- [ ] A new customer's rates equal the current defaults; reset after confirmation restores them.
- [ ] A used Process Master item cannot be deleted and the formulas using it are listed; a duplicate Material in Drawing is refused.
- [ ] "Not applicable" exists after install with all values 0, cannot be edited or deleted and appears on no Admin page or list.
- [ ] Deleting a customer or material used by a Draft or Submitted estimate is refused and names the estimates.
- [ ] Each master edit creates exactly one audit entry (FR-011); no rate reaches an Engineer response.

## Dependencies & Risks
- Depends on: EPIC-01. 02.07 needs EPIC-04 (estimates exist). 02.06's skip of material cost is exercised through EPIC-03.
- Open inputs: Q-36 (what Lead and Admin see for "Not applicable"; working ASSUMPTION-54 is built and labelled, so story 02.06 may reach Ready with it labelled); OQ-ARCH-05 (rates beyond 2 decimals, checked when the defaults arrive); HOLD-01 master data defaults (a data input, needed before development, not for DoR).
- Risks: RISK-006 (real data reaching the public repository): the stories use invented placeholders and the CI scan of story 10.01 applies.
