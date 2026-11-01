# Product Requirements Document — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.4 (Draft for G2 attempt 2; Q-32 closed and ASSUMPTION-48 retired: FR-024, 025, 029, 030, GOAL-03 and sections 6.3, 9, 10 and 12 carry the rule of SPEC §18 D-12; the FR-030 example has one expected value (SPEC §18.5); the repository decision (D-13) is reflected in ASSUMPTION-46 and RISK-006; BLK-01 cleared, draft PR #1 exists; the delivery lead is referred to as "the delivery lead" or "they". No FR, priority, release or scope changed) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | Draft. G2 attempt 1 was NO-GO (`docs/00-governance/gate-log.md`). The scope for the completion date (Q-34, due at G3 approval, DL-004) is the delivery lead's choice and **no scope is adopted**; both dates in the release plan are unadopted estimates. Every release move marked PROPOSED in section 6.3 is a proposal unless section 6.3 cites a decision |
| Source brief | `docs/01-discovery/project-brief.md` v0.6; `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.3 (SPEC); `docs/01-discovery/requirements-questions.md` v0.6 |
| Companion | `docs/02-product/release-plan.md` (realistic completion date, fit analysis, calendar, cut order) |

**How to read the labels in this document.**
- **Confirmed in their own words** = typed by the delivery lead on Jira: AQP-1 comment 10443 (their correction of item (d)), 10444 and 10446 (their restatement of (e) and (h)), AQP-1 10465 (the repository decision), AQP-9 10442, AQP-13 10445, AQP-13 10464 for Q-32 (b1) and (b2) ("parent's own cost counts"), AQP-11 10444, AQP-12 10446, and their other replies on AQP-2 to AQP-13 (comment IDs are in the catalogue). Comments 10415 and 10441 are not in this class.
- **Confirmed on list wording** (DL-001) = items (a), (b), (c), (f), (g) of AQP-1 comment 10441. The comment repeats the orchestrator's list from comment 10426 word for word under one sentence of theirs ("I confirm the below items that I answered already"). The master ruled G1 condition 1 met in substance, because they corrected item (d) after reading the list; the five items are **not** "their own words". The same standard applies to the Q-32 replies on AQP-13 comment 10462 for (a), the consequence of (b2), (b3), (c), (d), (e1), (e2) and the closing "Okay" (D-12): answered bullet by bullet against the ASSUMPTION-48 list, the reading stated in comment 10463, no objection in comment 10464. They can change any of them later.
- **Labelled assumption** = still open. Only these remain: ASSUMPTION-49 (Q-33), ASSUMPTION-47 (Q-31), ASSUMPTION-46 (Q-30; the repository question is decided, D-13), ASSUMPTION-50 (Q-34, due G3 approval, DL-004) and hosting details (Q-18). **Q-32 is closed (AQP-13 comments 10462 and 10464; SPEC §18 D-12) and ASSUMPTION-48 is retired; the rule is stated in FR-024, 025, 029 and 030.** Section 9.1 states which FRs change if each remaining assumption is rejected.
- **Kept assumptions** (Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28, UNC-g) are confirmed on list wording (10441 (g)) as the working rule; the delivery lead can change any later. They carry their ASSUMPTION ID in the Source column and no label.
- **PROPOSED** = a number, rule or release move the product manager sets because no source gives one; the owner named must confirm it.
- **Estimate** = product-manager judgement of relative size converted to hours. No velocity has been measured for this team on this stack.

## 1. Vision

For Accucut Lasers' Admin, Leads and Engineers, who today prepare manufacturing cost estimates in one Excel worksheet (columns A to BO) that gives every holder of the file every rate and formula, the Accucut Quotation Portal is a role-based web application in which a Lead or Admin assigns an estimate, an Engineer enters part data through a guided form without ever seeing a cost, the portal calculates every cost column from master data exactly as the worksheet does, a Lead or Admin approves and locks a price, and the result exports to Excel in the worksheet's own layout. Later, the Admin can change fields and formulas in the portal with Excel-style re-lettering and an audit trail. It is valuable because it keeps pricing confidential, makes approval and late work visible, and removes dependence on a single spreadsheet and on a developer for each pricing change.

## 2. Target Users & Personas

| Persona | Description | Key jobs-to-be-done | Frequency of use |
|---------|-------------|---------------------|------------------|
| Santhosh - MD (sponsor, delivery lead) | One person; final approver at G1, G3, G8; owns business-rule decisions | Receive a trusted quoting tool to a date; decide scope questions | Per gate; not a daily user |
| Admin (exactly one) | Owns masters, users, settings, formulas, fields | Keep rates and masters current; change pricing rules safely; manage users | Weekly (estimate; no data) |
| Lead (many) | Assigns, reviews, approves, locks and unlocks estimates | Assign work with a deadline; check the arithmetic; set the Approved Quote Price | Daily (estimate) |
| Engineer (many) | Enters part data; never sees cost | Open assigned task, build the part tree, fill inputs quickly, press Calculate | Daily (estimate) |
| Accucut IT contact (not yet named) | Hosts, backs up and updates the system | A deployable, supportable system | At install and on incidents |
| Accucut's customers | Receive quotes; not portal users | Accurate, timely quotes | Indirect |

Frequencies are not evidenced (Q-24 keeps the stated volume assumptions, confirmed as the working rule).

## 3. Outcomes & Success Metrics

Goal IDs are from the brief (section 3). Baselines the brief marks "not measured" stay open until Q-24 and Q-28 are answered; no figure here is invented.

| Goal (brief) | Metric | Type | Baseline | Target | Measurement method |
|--------------|--------|------|----------|--------|--------------------|
| GOAL-01 Move estimation to the portal | Share of new estimation tasks created and approved in the portal after cut-over | Lagging | 0 % (all work in Excel) | 100 % of new tasks | Count tasks created in the portal versus tasks reported by the Lead after cut-over; leading check: end-to-end test (assign, enter, calculate, approve, export) green on every build |
| GOAL-02 Hide costs from Engineers | Cost, rate or formula values found in any Engineer page, API response or file | Leading | No control exists (inferred) | 0 found | Automated test over every Engineer-reachable route, run on every build (SPEC §14.1) |
| GOAL-03 Calculate as the worksheet does | Share of SPEC §7.4 outputs matching a hand-calculated worksheet to 2 decimals on the acceptance tree | Leading | Not applicable | 100 % | Unit test per formula plus the tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 (SPEC §14.2) and the constructed quantity example of FR-030 (SPEC §18.5). **The oracle is the stated rule (SPEC §7.4 BL, §18 D-08 and D-12; Q-32 closed 2026-11-01):** for each top-level item, BL = item quantity x the sum of BG over the item's own row and every descendant row, column BG only, each BG carrying its own row's quantity; a parent's own BG counts; the estimate's BL is the sum over its top-level items. The main rule is in their own words (AQP-9 10442, AQP-13 10445; "parent's own cost counts", AQP-13 10464); the quantity, display and range details are confirmed on list wording (AQP-13 10462), not in their own words. The parallel run and acceptance test 2 compare with a worksheet calculated the same way; at item quantity 1 this equals the sample's stored total. The sample has quantity 1 on every row, so the quantity rules are tested with the constructed example, not the sample |
| GOAL-04 Export in the worksheet layout | Share of export checks passed (A to BO, widths, centre/middle, currency formats, images, BL2 and BO2) | Leading | Not applicable | 100 % | Export checklist run on a generated file; opened in Excel desktop (SPEC §14.12) |
| GOAL-05 Make late work visible | (a) Overdue e-mail within 5 minutes of becoming overdue; (b) 11:00 IST digest sent daily when overdue tasks exist; (c) duplicates | Leading | Not measured | (a) 100 %, (b) 100 %, (c) 0 | Job tests with a controlled clock and a capturing mail server; e-mail log counts. **Release 1 gives the in-portal part only (bell, Overdue tab); (a) to (c) arrive in Release 2** |
| GOAL-06 Control prices and configuration | (a) Approved estimates carrying price, approver and time; (b) configuration, master, approval, unlock and price-override events logged with who, when, before → after | Leading | Not measured | (a) 100 %, (b) 100 % | Test per event type; database check of approved estimates. **Release 1 covers master, approval, unlock and price-override events; configuration events arrive in Release 2** |
| GOAL-07 Work on all screen sizes, consistent design | Screens with no horizontal page scroll and every action reachable at 360, 768 and 1366 px; design-system review passed | Leading | Not applicable | 100 % of screens | Playwright at the three widths; design-system review checklist |

Business outcome measures such as estimate turnaround cannot be set until the baseline is supplied (Q-24, Q-28).

## 4. Functional Requirements

**Columns.** Pri = MoSCoW priority of the product (exactly one per FR; Must = the SPEC says MUST or it has a SPEC §14 test; Should = stated without MUST or a `[DEFAULT]`; Could = optional; Won't = excluded). Rel = proposed release: **R1** Release 1 core; **R1+** Release 1 stretch (pulled in only if the core is on track); **R2**, **R3** later; **R-OFF** the "next release" in which offline use is implemented (confirmed, AQP-11 comment 10444; what offline means is open); **-** not planned. Under scope A in the release plan, R1, R1+ and R2 are built as one hand-over and the labels give build order only. Goal = brief goal served. Tags such as [Q-33] mark a requirement written on a still-open labelled assumption. Source IDs are from `docs/01-discovery/requirements-catalog.md`. Priority is independent of release: a Must in R2 is required before the product is complete, not before Release 1.

### 4.1 Access, accounts and confidentiality (EPIC-01)
| ID | Requirement (user point of view) | Pri | Rel | Goal | Source | Fit criterion |
|----|----------------------------------|-----|-----|------|--------|---------------|
| FR-001 | As any user, I sign in with e-mail and password and sign out. | Must | R1 | GOAL-01 | UR-001, BR-001 | Valid credentials open my role's home page; a wrong password is refused without saying which part was wrong; sign-out ends the session. |
| FR-002 | As any user, I change my own password. | Must | R1 | GOAL-02 | UR-001 | After the change the old password is refused and the new one accepted. |
| FR-003 | As any user, I reset a forgotten password through an e-mailed single-use link. | Should | R2 | GOAL-02 | UR-001, ASSUMPTION-31 | The link works once; a second use is refused. Until R2 the Admin resets passwords (FR-004). |
| FR-004 | As Admin, I create, edit and deactivate users, set their role and reset their passwords. | Must | R1 | GOAL-01 | UR-002, BR-001, TR-003 | User list shows name, e-mail, role, active flag; a deactivated user cannot sign in. |
| FR-005 | As Admin, I am the only active Admin at any time. | Must | R1 | GOAL-06 | UR-003, BR-001, CONSTRAINT-04 | Creating or activating a second Admin is refused (SPEC §14.14). |
| FR-006 | As Admin, I hand the role to another active user in one confirmed step. | Should | R2 | GOAL-06 | ASSUMPTION-23 | After the step exactly one active Admin exists and the change is logged. |
| FR-007 | As any user, I can reach only what my role allows; every route and API enforces SPEC §3 on the server. | Must | R1 | GOAL-02 | BR-004, SPEC §3, §12 | Role-matrix test calls each route and API as each role; 0 results differ from SPEC §3. |
| FR-008 | As an Engineer, I never receive any calculated value, material rate (I), exchange rate, customer rate or formula in any page, API response or file; I see only the values I typed (including Machining, Plating and Tool Cost). | Must | R1 | GOAL-02 | BRQ-002, BR-003, UR-021, D-05 | Automated test (SPEC §14.1) over every Engineer-reachable route finds 0 such values, run on every build. |
| FR-009 | As any user, I see a header (logo and name, notification bell, user menu with name, e-mail, change password, sign out) and navigation listing only the screens my role may open. | Must | R1 | GOAL-07 | SPEC §9, BR-004, BRQ-010 | Navigation per role matches the SPEC §9 table. |
| FR-010 | As any user, I open an About page with the site description, "Version No: 1.0" and "© Accucut Lasers Pvt Ltd. All rights reserved." | Must | R1 | GOAL-07 | UR-039 | Text matches exactly. |
| FR-011 | As Admin, I can rely on a record of approvals, unlocks, Approved Quote Price overrides and master-data edits (Release 1) and configuration changes (Release 2, FR-079): who, when, object, before → after. | Must | R1 | GOAL-06 | BRQ-007, DR-012, SPEC §12 | Performing each event type creates exactly one entry with all four parts; no role can edit or delete entries. |

### 4.2 Masters and settings (EPIC-02)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-012 | As Admin, I add, update and delete Process Master items (named rate, unit, default value); a new item is added to every customer with the default and can be used in formulas by name; an item used by a formula cannot be deleted and the formulas are listed. | Must | R1 | GOAL-03 | UR-031, BR-030, BR-032, DR-006 | CRUD with search; deletion of a used item refused with the formula list; new item present on all customers. |
| FR-013 | As Admin, I manage Customers (name, phone, e-mail, address, one value per Process Master item); a new customer starts with the current defaults; "Reset to Defaults" reloads them after confirmation. | Must | R1 | GOAL-03 | UR-031, UR-032, BR-028, BR-029, DR-007 | New customer rates equal defaults; reset after confirmation restores them (part of SPEC §14.10). |
| FR-014 | As Admin, when I change a Process Master default, customers whose value equalled the old default update, and for each customer whose value differs I choose apply or keep, with apply-all and keep-all. | Must | R1+ | GOAL-03 | UR-032, BR-031, SPEC §14.10 | SPEC §14.10 passes. If not reached in R1, the Admin edits customer rates by hand until R2 (risk: stale rates). |
| FR-015 | As Admin, I manage the Material Master (Material in Drawing unique; Material Considered, price per kg, specific gravity, scrap rate). | Must | R1 | GOAL-03 | UR-031, BR-033, DR-008 | Duplicate Material in Drawing refused; choosing a material fills Material Considered; rates never reach an Engineer. |
| FR-016 | As Admin, I maintain the Exchange Rate Master (1 USD and 1 EUR in INR) with last updated by and at. | Must | R1 | GOAL-03 | UR-031, DR-009 | Values drive BH and BI; update stamp shown. |
| FR-017 | As Admin, I maintain the Treatment / Color list; "Other" is always available. | Must | R1 | GOAL-03 | UR-031, UR-020, DR-010 | CRUD; "Other" cannot be removed. |
| FR-018 | As an Engineer, I can choose "Not applicable" in Material in Drawing and Treatment / Color for a part that needs none (confirmed on list wording, AQP-1 10441 (b)); the system creates both entries (Material rates all 0), and the Admin cannot delete or rename them. [Q-33, ASSUMPTION-49 for the values and the lock] | Must | R1 | GOAL-01 | UR-043, BR-048, DR-008, DR-010, SPEC §7.3 | Entries exist after install; a part using them adds 0 cost; an assembly parent can be completed with no real material. |
| FR-019 | As Admin, I turn e-mail alerts on or off, set the sender name and address, and send a test e-mail. | Must | R2 | GOAL-05 | UR-037, DR-014 | Setting changes behaviour of FR-081 to FR-084; test e-mail arrives. |

### 4.3 Field registry and calculation (EPIC-03)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-020 | As Admin, on first install the portal holds the field registry and sections defined in SPEC §7 (and the sample's header texts, widths and formats). | Must | R1 | GOAL-04 | TR-001, DR-011, SPEC §7 | Registry holds every SPEC §7 field in order, each with letter, section, type, width and format. |
| FR-021 | As any user, I see Excel-style column letters derived from field position, never stored. | Must | R1 | GOAL-03 | BR-034, SPEC §8.1 | Unit tests: position 1 = A, 26 = Z, 27 = AA, 52 = AZ, 53 = BA, 67 = BO, and the inverse. |
| FR-022 | As the business, calculations run in a formula engine that reads operands (letters, rate names, Material-\* fields, exchange-rate names, numbers), + − × ÷ and brackets, and SUM over all nodes, without `eval`. Also MIN, MAX, ROUND, IF (ASSUMPTION-41). | Must | R1 | GOAL-03 | BR-036, CONSTRAINT-02 | Unit tests per operator and function; coverage of the formula module ≥ 95 %; code search finds 0 uses of `eval` or `new Function`. |
| FR-023 | As the business, formulas evaluate in dependency order, and a configuration with an unknown name, a syntax error or a cycle is rejected with the cycle shown. | Must | R1 | GOAL-03 | BR-037, SPEC §8.2 | A test configuration with a cycle fails validation and names the cycle; the seed configuration passes. |
| FR-024 | As Lead or Admin, every output in SPEC §7.4 is calculated per BR-015 to BR-022 from the customer's rates, material data and exchange rates; the roll-up outputs (BL and what a parent shows) follow the rule stated in FR-029 and FR-030 (SPEC §7.4 BL, §18 D-12). | Must | R1 | GOAL-03 | BRQ-004, BR-015 to BR-022, SPEC §14.2, D-12 | Every output matches a hand-calculated value to 2 decimals on known inputs, plus the end-to-end tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 and the constructed example in FR-030. The oracle is SPEC §7.4 v1.3 with D-12. Row-level outputs do not depend on the roll-up rule; at item quantity 1 the roll-up equals the sample's stored total. |
| FR-025 | As Lead or Admin, I see the product-level values once per estimate: BL (Total Unit Production Price), BN and BO. In force (SPEC §7.4 v1.3): BL as in FR-030; BN = BL / total of all Tool Cost (BM) entries of the estimate, "—" when that total is 0 (confirmed on list wording, AQP-1 10441 (a)); BO = Approved Quote Price. BN inherits any change to BL. | Must | R1 | GOAL-03 | BR-023, D-04, D-05, D-12 | BL, BN, BO each appear once; values match hand calculation; with two nodes carrying Tool Cost entries BN uses their sum; with a total of 0 BN shows "—". |
| FR-026 | As a user, division by zero shows "—" on screen and an empty cell in the export and never stops a calculation. | Must | R1 | GOAL-03 | BR-024 | A node with a zero divisor calculates; the other outputs are present. |
| FR-027 | As the business, calculations run on the server; results are stored at full precision, displayed to 2 decimals, and recomputed on Calculate and Recalculate; inputs accept up to 2 decimals. | Must | R1 | GOAL-03 | BR-025, NFR-022 (cat.) | A stored value differs from the displayed one only by rounding; Engineer responses contain no preview. |
| FR-028 | As the business, a rate named with "%" is typed as a whole percentage (12 means 12 %) and used as 0.12 (ASSUMPTION-39). | Must | R1 | GOAL-03 | BR-021 | OH Profit % typed 12 gives BD = BB × 0.12. |
| FR-029 | As Lead or Admin, the cost of an item or part is the sum of the costs of its own row and of the children, grandchildren and deeper rows below it, column BG only, each BG carrying its own row's quantity, and every row's BG is counted once (main rule in their own words as corrected: AQP-9 10442, AQP-13 10445; D-08; details D-12). A parent's own cost counts (their own words, "parent's own cost counts", AQP-13 10464; D-12 (b1), (b2)); a non-zero value typed on a parent is therefore not ignored, refused or warned about (list wording, D-12 (b2) consequence). A parent shows on screen (BG, BJ, BK) the sum of its own row and everything below it, not multiplied again by its own quantity; the export shows each row's own values (list wording, D-12 (b3)). A node whose number inputs are all 0 adds no cost of its own (D-06; AQP-7). The sentence "a parent has no cost of its own" is assistant-drafted 10415 wording, never theirs, and is not used. | Must | R1 | GOAL-03 | BR-046, D-06, D-08, D-12 | Part-1 with sub-part-1 and sub-part-2 and parent inputs at 0 shows the sum of the two. A parent with children and non-zero inputs of its own (as the sample's parts 1.4 and 1.5): its own BG is inside the total, the screen shows its own row plus everything below it (not multiplied again by its own quantity), and its export row shows its own values. The sample can test that a parent's own BG is inside the total and that only column BG is added; it cannot test quantities (all 1), which the constructed example in FR-030 covers. |
| FR-030 | As Lead or Admin, an item's cost is the item quantity times the sum in FR-029, and the estimate's BL is the sum over its top-level items, each times its own quantity (main rule in their own words as corrected: AQP-9 10442, AQP-13 10445; D-08; details D-12). The item quantity multiplies once, at the top item; each row keeps its own quantity inside its BG, so the quantity of a part between the item and a lowest-level part multiplies only that part's own row (list wording, D-12 (a)). The per-level rule of assistant-drafted 10415 ("child cost x parent quantity" at every level) is withdrawn; they replaced it in their own words. The item's own row gets no special handling: where it has values of its own and the quantity is above 1 it counts the quantity twice (list wording, D-12 (c); normally the row holds 0, D-06). The item's own row is inside the range and only column BG is added (list wording, D-12 (e1), (e2)). Several top-level items add up, each times its own quantity (list wording, D-12 (d)). | Must | R1 | GOAL-03 | BR-023, BR-047, D-08, D-12 | At item quantity 1 the total equals the worksheet's sum of BG over the item's rows (SPEC §18.5). Constructed example (SPEC §18.5; invented values, expected value computed by hand before the test): item quantity 2 with 0 on the item's own row; part 1.4 quantity 3, own cost 1 per unit; sub-part 1.4.1 quantity 4, cost 1 per unit. **Expected BL = 2 x (3 x 1 + 4 x 1) = 14**: the sub-part counts 2 x 4 = 8 times its per-unit cost and the part 2 x 3 = 6 times; part 1.4 shows 3 + 4 = 7 on screen, not multiplied again by 3. Second case (D-12 (d)): two top-level items with quantities 2 and 3, each with one child of quantity 1 and cost 1 per unit and nothing on the item rows: the estimate's BL is 2 + 3 = 5. |
| FR-031 | As the business, each Calculate and Recalculate records the configuration version and every master value used (customer rates, material values, exchange rates). | Must | R1 | GOAL-06 | BRQ-008, BR-012, BR-039, DR-003, D-07 | After any master changes, a previously calculated estimate's stored values are unchanged (regression test). |

### 4.4 Task assignment and queues (EPIC-04)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-032 | As Admin or Lead, I assign a task to an Engineer with a network folder path, a deadline (date and time, IST) and an optional title and notes; this creates an empty estimate. | Must | R1 | GOAL-01 | UR-004, BRQ-009, SPEC §5.1 | The task appears in the Engineer's Open queue; the estimate exists in DRAFT. |
| FR-033 | As any user, I see the folder path as a link and a "Copy path" button with a tooltip. | Must | R1 | GOAL-01 | UR-005, ASSUMPTION-12 (Q-12) | Copy places the exact path on the clipboard; tooltip explains blocked links. |
| FR-034 | As any user, I see Open, Closed and Overdue tabs sorted by deadline ascending; an overdue task also stays in Open; an Engineer sees only own tasks, the Admin all, a Lead all. | Must | R1 | GOAL-05 | UR-006, BR-002, BR-045 | Tab membership and order correct on seeded tasks; an Engineer cannot open another's task. |
| FR-035 | As a Lead, the queue opens filtered to "Assigned by me" and I can change it. | Should | R1+ | GOAL-05 | UR-007 | Default filter applied on opening. |
| FR-036 | As any user, I see overdue rows marked by colour, icon and the text "Overdue by X". | Must | R1 | GOAL-05 | UR-008, SPEC §11 | All three cues present on every overdue row. |
| FR-037 | As any user, I see a bell with the count of my relevant overdue tasks (Engineer own; Lead assigned by me; Admin all) that opens the Overdue tab; it stays visible on mobile. | Must | R1 | GOAL-05 | UR-009 | Counts correct per role; click opens Overdue. |
| FR-038 | As the business, a task closes when its estimate is approved and returns to Open when unlocked. | Must | R1 | GOAL-05 | BR-045 | Approve moves the task to Closed; unlock returns it to Open. |
| FR-039 | As Admin or Lead, I search and filter tasks by Engineer, customer and date. | Should | R1+ | GOAL-05 | UR-010 | Filters narrow the list. |
| FR-040 | As Admin or Lead, I reassign a task or change its deadline, logged; cancel is not provided. | Should | R2 | GOAL-05 | ASSUMPTION-20 | Change logged with who, when, old → new. |
| FR-041 | As any user, I refer to a task or estimate by an ID in the form Q-<year>-<4-digit running number>. | Should | R1 | GOAL-04 | ASSUMPTION-22, SPEC §10 | IDs are unique and appear on screens and in the export file name. |

### 4.5 Estimate workspace (EPIC-05)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-042 | As an Engineer, I choose the customer before any data entry and confirm any later change. | Must | R1 | GOAL-03 | UR-012, BR-010 | Entry blocked until a customer is chosen; a change shows a confirmation; the new customer's rates apply at the next calculation. |
| FR-043 | As an Engineer, I build a product tree of items, parts and sub-parts to any depth: add child or sibling, reorder, delete, either up front or as I go; each node opens its details. | Must | R1 | GOAL-01 | UR-013, UR-015, D-04 | SPEC §14.3. |
| FR-044 | As an Engineer, I see Sl. No (A) generated from the tree position and renumbered after add, reorder or delete. | Must | R1 | GOAL-03 | UR-014, BR-013 | 1, 1.1, 1.1.1, 1.1.2, 1.2 … correct after each operation (SPEC §14.3). |
| FR-045 | As an Engineer, I enter one part at a time in the eight sections of SPEC §7.1, in that order, with the parts tree beside the form; every field shows its column letter and every section its column range. | Must | R1 | GOAL-01 | UR-016, DEC-01, D-05 | Every SPEC §7.1 field present with its letter badge; Tool Cost, Machining Cost and Plating Cost are entered with the other inputs. |
| FR-046 | As an Engineer, I press Enter to move to the next field. | Must | R1 | GOAL-01 | UR-040, DEC-06 | Enter moves focus in field order. |
| FR-047 | As an Engineer, I add a part picture (C) by paste, drag and drop or file choice (camera or gallery on a phone), preview it, and replace or remove it. | Must | R1 | GOAL-04 | UR-017, BR-014, CONSTRAINT-08 | A 199 KB PNG is accepted; a 201 KB file and a text file renamed .png are refused with a clear message. |
| FR-048 | As an Engineer, Fasteners Qty (T) and Cost (U) show only when Fasteners (S) is not "None" or blank; otherwise they are hidden, not required, and stored as 0; S defaults to "None". | Must | R1 | GOAL-03 | UR-018, BR-008 | SPEC §14.4. |
| FR-049 | As an Engineer, I choose Surface Treatments in one multi-select (selected = 1, not selected = 0) and may select none (ASSUMPTION-38). | Must | R1 | GOAL-03 | UR-019 | Eight flags Z to AG set correctly. |
| FR-050 | As an Engineer, I choose a Treatment / Color or "Other" and type free text. | Must | R1 | GOAL-04 | UR-020 | "Other" reveals a text box; the text is stored and exported. |
| FR-051 | As an Engineer, auto-filled fields (F) are read-only and shaded, and Material Rate (I) is absent from my screen and responses. | Must | R1 | GOAL-02 | UR-021 | F shown read-only; I never present (covered by FR-008). |
| FR-052 | As an Engineer, number inputs accept up to 2 decimals, no negatives, and show the decimal keyboard on phones (ASSUMPTION-37). | Must | R1 | GOAL-03 | BR-009, NFR-012 (cat.) | A negative or 3-decimal entry is refused with a message. |
| FR-053 | As an Engineer, I save at any time including incomplete data, and I am warned before leaving with unsaved changes. | Must | R1 | GOAL-01 | UR-022 | A draft saves with blanks; the warning appears. |
| FR-054 | As an Engineer, my draft saves automatically every 30 seconds (ASSUMPTION-42). | Should | R1+ | GOAL-01 | UR-022 | Edit, wait 30 s, reload: the edit is present. |
| FR-055 | As an Engineer, I press Calculate and, if any visible input of any node is blank (Remarks included, Q-13), I am told which nodes and fields, the nodes are flagged in the tree, and nothing is submitted; on success the status becomes SUBMITTED and I see only "Cost will be calculated based on the input fields and sent for review/approval." | Must | R1 | GOAL-02 | UR-023, BR-006, BR-007, SPEC §14.4 | Blank input blocks submit with errors; success shows the single message and no cost. |
| FR-056 | As an Engineer, I enter 0 in a number field a part (including a parent assembly) does not need; Calculate accepts it and the part adds no cost (confirmed, AQP-7). | Must | R1 | GOAL-01 | UR-043, BR-048, D-06 | A tree whose parent has 0 in every number field passes Calculate; BL equals the sum of the children. |
| FR-057 | As an Engineer, I see how many inputs are complete for the current part and which tree nodes have missing data (icon as well as colour). | Should | R1+ | GOAL-01 | UR-024 | Count and icon correct on seeded data. |

### 4.6 Cost review and approval (EPIC-06)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-058 | As Lead or Admin, I see each node's inputs and final cost by default, and a "View Cost Details" button that shows all calculated fields in six stages, each with its formula; Engineers never see the button. | Must | R1 | GOAL-03 | UR-025, SPEC §6.4 | Button absent for Engineers; every stage and formula shown for Lead and Admin. |
| FR-059 | As Lead or Admin, I do not see cost lines for unselected Surface Treatments (AQ↔Z, AR↔AA, AS↔AB, AT↔AC, AV↔AE, AW↔AF, AX↔AG); they are still calculated and exported as 0. | Must | R1 | GOAL-04 | UR-026, BR-026, BR-027 | SPEC §14.5. |
| FR-060 | As a Lead, I view formulas read-only. | Must | R1 | GOAL-06 | UR-038 | No edit controls shown to a Lead. |
| FR-061 | As Lead or Admin, I recalculate whenever inputs changed after a calculation. | Must | R1 | GOAL-03 | UR-027 | Recalculate is offered after a change and updates the stored results. |
| FR-062 | As Lead or Admin, I approve and lock by entering an Approved Quote Price, pre-filled with BL and editable; inputs become read-only; approver and time are recorded; an override is logged. | Must | R1 | GOAL-06 | UR-028, BR-011, BRQ-001, BRQ-003 | Inputs read-only after approval; override entry exists. |
| FR-063 | As Lead or Admin, I unlock an approved estimate with a reason; I see a notice if the configuration changed since approval; recalculating afterwards uses the current master values and the notice also says if rates changed (confirmed on list wording, AQP-1 10441 (c); ASSUMPTION-35 for the reason entry). | Must | R1 | GOAL-06 | UR-029, BR-012 | Unlock logged with reason; notices shown; recalculation after unlock uses the current master values. |
| FR-064 | As the business, the status runs DRAFT → SUBMITTED → APPROVED → unlock → DRAFT; the Engineer's inputs are read-only once SUBMITTED; there is no return-to-Engineer action. | Must | R1 | GOAL-06 | BR-006, ASSUMPTION-19 | Engineer edit refused after SUBMITTED; Lead and Admin can edit and recalculate. |
| FR-065 | As the business, an approved estimate keeps the fields, formulas, rates, master values and results it was approved with, whatever changes later (confirmed, AQP-8). | Must | R1 | GOAL-06 | BRQ-008, D-07, SPEC §8.4 | After approval, change a process rate, a material price and an exchange rate: the approved estimate's screen and export are identical. |

### 4.7 Excel export (EPIC-07)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-066 | As Lead or Admin, I download an .xlsx that replicates the worksheet: header row 1, columns A to BO in order, same widths, all cells centred horizontally and vertically, ₹ / $ / € formats. | Must | R1 | GOAL-04 | UR-030, BRQ-005, SPEC §10 | SPEC §14.12 checklist passes. |
| FR-067 | As Lead or Admin, the export has one row per tree node in depth-first order, Sl. No as text, and the part image embedded in column C scaled to fit. | Must | R1 | GOAL-04 | SPEC §10 | Order 1, 1.1, 1.1.1, 1.1.2, 1.2 …; "1.10" keeps its zero; image visible. |
| FR-068 | As Lead or Admin, every column is exported, including cost lines hidden on screen (as 0) and hidden Fasteners fields (0); a divide-by-zero cell is empty. | Must | R1 | GOAL-04 | SPEC §10, BR-024, BR-026 | Cell-by-cell check on a seeded estimate. |
| FR-069 | As Lead or Admin, BL2, BN2 and BO2 are populated once, in row 2; no per-item totals and no separate Tool Cost total column. [Q-31, ASSUMPTION-47: the sample shows totals per top-level item; open] | Must | R1 | GOAL-04 | BR-023, SPEC §10 | BL2, BN2 and BO2 populated (SPEC §14.12). If the delivery lead asks for per-item totals as in the sample, this FR changes. |
| FR-070 | As the business, Lead and Admin can download at any status; Engineers cannot. | Must | R1 | GOAL-02 | UR-030, ASSUMPTION-36 | An Engineer request for the export is refused. |
| FR-071 | As Lead or Admin, the file is named Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx. | Should | R1 | GOAL-04 | ASSUMPTION-44 | File name matches the pattern. |

### 4.8 Admin configuration of fields and formulas (EPIC-08)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-072 | As Admin, I see the worksheet as a column list (letter, label, section, type, formula); a Lead sees formulas read-only. | Must | R2 | GOAL-06 | UR-033, SPEC §9 | List matches the registry. |
| FR-073 | As Admin, I edit a formula in an editor with autocomplete, live check and a preview against a sample node; a formula with an unknown letter or rate name, a syntax error or a cycle cannot be saved. | Must | R2 | GOAL-06 | UR-033, BR-037 | SPEC §14.9. |
| FR-074 | As Admin, I insert an input, an output, or an input with its cost column in one step, choosing position and group, with a preview of letter changes; new inputs are mandatory and visible to Engineers, new outputs are hidden from them, and a new output joins a total only when I edit that total's formula. | Must | R2 | GOAL-06 | UR-034, BR-038 | SPEC §14.6. |
| FR-075 | As Admin, inserting or deleting a field re-letters later fields automatically, all displayed formulas keep calculating the same results, and the BL, BN and BO cells move with their columns. | Must | R2 | GOAL-06 | BR-035, SPEC §14.6 | Insert after AX gives AY; former AY to BO shift one; BL2 and BO2 move to BM2 and BP2. |
| FR-076 | As Admin, I delete a field only after every formula using it has changed; otherwise the referencing formulas are listed. | Must | R2 | GOAL-06 | UR-035 | SPEC §14.7. |
| FR-077 | As the business, every configuration change creates an immutable version; each estimate records its version; approved estimates are pinned; new and unlocked estimates use the latest. | Must | R2 | GOAL-06 | BR-039, BR-012, BRQ-006, BRQ-008 | Changing a formula leaves an approved estimate's values and layout unchanged. |
| FR-078 | As Admin, I save named checkpoints, list them and revert to one; reverting is logged and can be undone; checkpoints never touch estimate data. | Must | R2 | GOAL-06 | UR-036, SPEC §14.8 | SPEC §14.8. |
| FR-079 | As Admin, I view and filter the change history (who, when, old → new) of fields, formulas and reverts. | Must | R2 | GOAL-06 | UR-036, BRQ-007 | Each change appears with all parts; filter by user and date works. |
| FR-080 | As Admin, formula save, field delete and checkpoint revert each require my password again. | Must | R2 | GOAL-06 | BR-005, SPEC §14.9 | The three actions fail without a correct password. |

### 4.9 E-mail alerts and scheduled jobs (EPIC-09)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-081 | As an Engineer, when a task is assigned I receive an e-mail (Cc the assigner) with details, folder path and deadline in IST, only when alerts are ON. | Must | R2 | GOAL-05 | UR-011, BR-040, BR-041 | SPEC §14.11. |
| FR-082 | As an Engineer, when my task becomes overdue I receive an e-mail (Cc the assigner) within 5 minutes. | Must | R2 | GOAL-05 | BR-042 | Sent within 5 minutes in a controlled-clock test. |
| FR-083 | As an Engineer with overdue tasks, I receive a daily digest at 11:00 AM IST (Cc the assigning Leads) listing them. [DOCX says "each Engineer", F-13, Q-21] | Must | R2 | GOAL-05 | BR-043 | Sent at 11:00 IST; none when no overdue task. |
| FR-084 | As the business, no e-mail is sent twice for one event, every send and failure is logged, and failed sends are retried. | Must | R2 | GOAL-05 | BR-044, DR-013 | Re-running a job sends 0 duplicates; log shows retries. |

### 4.10 Experience, brand and delivery (EPIC-10)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-085 | As any user, every screen adapts to mobile, tablet and desktop as in the SPEC §11 table (queues as cards on mobile; tree in a drawer on mobile, collapsible panel on tablet, persistent panel on desktop; section cards in 1, 2 and 3 columns; sticky action bar on mobile and tablet; tables scroll only inside their container). | Must | R1 | GOAL-07 | BRQ-010, NFR-010, NFR-011 (cat.) | SPEC §14.13 and NFR-016. |
| FR-086 | As any user, I see the "Red Leads" brand: real logo unaltered on a white top bar, "ACCUCUT LASERS" in logo red in a bold serif, graphite side menu, red main buttons and markers, one design system; errors use an icon, a thick border and text. | Must | R1 | GOAL-07 | BRQ-011, DEC-02, NFR-016 to NFR-018, NFR-021 (cat.) | Design-system review passes (NFR-020, NFR-021). |
| FR-087 | As a future user, the estimate screen leaves room to show a drawing beside the form without a redesign (no drawing function now). | Must | R1 | GOAL-07 | BRQ-012, DEC-04, NFR-019 (cat.) | UX review confirms a reserved region at 1024 px and wider. |
| FR-088 | As any user, I see clear loading, empty and error states and a confirmation after each save. | Should | R1+ | GOAL-07 | NFR-014 (cat.) | Each screen shows the three states. |
| FR-089 | As the business, every page has a title, meta description and Open Graph title and description with generic wording; pages behind sign-in are marked "do not index". | Must | R1 | GOAL-07 | NFR-020 (cat.), SPEC §17.6 | Tag check passes on every route (NFR-022). |
| FR-090 | As any user, I can choose light or dark mode. | Could | R3 | GOAL-07 | NFR-015 (cat.) | Both modes meet NFR-018. |
| FR-091 | As Accucut IT, I install the system with Docker Compose (app, worker, database), an `.env.example`, and a README with daily-backup guidance and restore steps. | Must | R1 | GOAL-01 | TR-008, SPEC §2, §12 | Following the README on a clean machine yields a running system; a restore is rehearsed once (NFR-013). |

### 4.11 Excluded or later (Won't in Release 1)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-092 | Offline use: the portal can be used without internet, "like running a website locally" (AQP-11 comment 10405). Implemented in the next release (confirmed, AQP-11 comment 10444; AQP-1 10441 (e)). What offline means (a full local copy or an entry form that sends later), hosting and the effect on cost confidentiality (BRQ-002) are open and are settled when that release is planned (Q-18). Not estimated. | Won't (this release) | R-OFF | GOAL-01 | BRQ-014 | No offline function in Release 1; room for it is not reserved beyond what the architect judges free. |
| FR-093 | Show a drawing beside the form and read data from drawings. | Won't | - | - | UR-042, DEC-04 | Absent; room reserved by FR-087. |
| FR-094 | "Copy from part" and "Apply to selected" actions (rejected). | Won't | - | - | UR-041, DEC-03 | Absent. |
| FR-095 | "Not needed for this part" switch; the Engineer enters 0 (FR-056). Q-15 closed (confirmed on list wording, AQP-1 10441 (f)). | Won't | - | - | DEC-05, SPEC §15 item 7 | Absent. |
| FR-096 | Import of past Excel estimates (ASSUMPTION-25). | Won't | - | - | TR-006 | Absent. |
| FR-097 | UI-sample extras not in the SPEC (finding F-16), ranked by the product manager: (1) "Awaiting review" count for Leads; (2) per-Engineer open-task counts on the assign screen; (3) global search; (4) "Closed this month" tile. | Could | R3 | GOAL-05 | F-16, SPEC §17.1 | Ranking only; no commitment. |

Transition work with no software requirement (TR-002 to TR-005, TR-007, BRQ-013) is carried in section 9.3 and in the release plan.

## 5. Non-Functional Requirements (quantified)

"(cat.)" = the catalogue NFR ID. PROPOSED values are the product manager's, with the owner who must confirm them.

| ID | Category | Requirement | Target / threshold | Measurement method |
|----|----------|-------------|--------------------|--------------------|
| NFR-001 | Security (authorisation) | Every route and API enforces role permissions on the server (cat. NFR-001) | 100 % of routes; 0 mismatches in the role-matrix test | Role-matrix test on every build |
| NFR-002 | Security (confidentiality) | No calculated value, material rate, exchange rate, customer rate or formula reaches an Engineer (cat. NFR-022; SPEC §14.1) | 0 occurrences across every Engineer-reachable page, API response and file | Automated crawl and response-scan test on every build |
| NFR-003 | Security (authentication) | Passwords stored as one-way hashes; CSRF protection on state-changing requests; secure HttpOnly session cookies; login attempts rate-limited (cat. NFR-002). PROPOSED: after 5 consecutive failed sign-ins for one account, further attempts are blocked for 15 minutes | 100 % of state-changing requests protected; threshold as proposed (owner Santhosh) | Security tests; inspection of cookie flags |
| NFR-004 | Security (step-up) | Password re-entry for formula save, field delete, checkpoint revert (Release 2) | 3 of 3 actions | Test per action |
| NFR-005 | Security (input) | Images accepted only if PNG, JPG, GIF or WebP by content and under 200 KB; text inputs sanitised (cat. NFR-003) | 0 wrong-type files accepted | Test with a renamed text file and a 201 KB image |
| NFR-006 | Security (hygiene) | No secrets, real personal data or real customer data in code, tests, fixtures, documents, Jira or GitHub (cat. NFR-023) | 0 findings | Secret scan and repository scan on every pull request |
| NFR-007 | Audit | Defined events logged with who, when, before → after (cat. NFR-004) | 100 % of event types; 0 editable entries | One test per event type |
| NFR-008 | Performance (calculation) | An estimate of 500 nodes recalculates in under 2 seconds (cat. NFR-005) | p95 < 2 s over 20 runs | Timed test on a 500-node fixture; the machine specification is recorded in the result |
| NFR-009 | Performance (pages) | Pages become interactive within 2 seconds on a mid-range phone on 4G (cat. NFR-006, Should) | ≤ 2 s on the five key screens (queue, workspace, cost view, masters, assign) | Lighthouse mobile profile; device definition set in the test strategy |
| NFR-010 | Performance (server) | PROPOSED: page-data and save requests respond within 500 ms at 25 concurrent users, excluding 500-node calculation and export. PROPOSED: Excel export of a 50-node estimate with 50 images within 10 s | p95 ≤ 500 ms; p95 ≤ 10 s (owner Santhosh; architect to confirm feasibility) | Load test in the staging environment |
| NFR-011 | Capacity | Supports fewer than 50 users and 500 nodes per estimate (ASSUMPTION-24, kept). Growth is not stated; PROPOSED headroom 2 × users without change | 50 named users, 25 concurrent; 500 nodes | Load test at the stated numbers |
| NFR-012 | Availability | PROPOSED: 99.0 % per month (about 7 h 18 min downtime). Hosting is undecided (Q-18) | 99.0 % monthly (owner Santhosh and the IT contact) | External uptime check every 5 minutes (tool chosen at G3) |
| NFR-013 | Backup and recovery | Daily database backup guidance and restore steps in the README (cat. NFR-007, TR-008). PROPOSED: recovery point ≤ 24 h; restore time ≤ 4 h | RPO ≤ 24 h; RTO ≤ 4 h; 1 restore rehearsal before go-live | Rehearsal log |
| NFR-014 | Reliability (e-mail, Release 2) | Alerts only when ON; overdue e-mail within 5 minutes; digest at 11:00 IST; no duplicates; failures retried and logged. PROPOSED: up to 3 retries | 100 % sent, 0 duplicates | Controlled-clock job tests with a capturing mail server |
| NFR-015 | Localisation (time, currency) | All times shown and scheduled in IST, stored in UTC; INR ₹, USD $, EUR €; 2 decimals displayed (cat. NFR-008, NFR-009) | 100 % of displayed times in IST | Unit and end-to-end tests including a deadline of 23:30 IST |
| NFR-016 | Responsive | Works at 360×800, 768×1024, 1024×768, 1366×768, 1920×1080, portrait and landscape; no horizontal page scroll; every action reachable (cat. NFR-010) | 0 failures at the 3 test widths in SPEC §14.13 and the 5 sizes in the plan | Playwright on mobile, tablet and desktop projects |
| NFR-017 | Touch | Touch targets at least 44 px (cat. NFR-012) | 100 % of interactive controls on touch layouts | Automated bounding-box check |
| NFR-018 | Accessibility | WCAG 2.1 AA (SPEC §11 states 2.1; 2.2 is not required) (cat. NFR-013, NFR-018) | 0 AA violations on every delivered screen; contrast ≥ 4.5:1 normal text, ≥ 3:1 large text and controls; key flows completed by keyboard only | axe at 3 widths plus a manual keyboard run |
| NFR-019 | Compatibility | PROPOSED: latest stable and previous major version of Chrome, Edge, Firefox and Safari on desktop; Safari on iOS and Chrome on Android on phones (ASSUMPTION-12 names the four browsers) | 0 blocking defects on the listed set | Playwright on chromium, firefox and webkit plus one real phone check |
| NFR-020 | Design system | One size each for headings, subheadings, body, small labels; one spacing scale; one button set; one palette (cat. NFR-016) | 100 % of screens; 0 hard-coded colours or sizes outside the tokens | Design-system review checklist; code search |
| NFR-021 | Brand | Logo file unaltered; ACCUCUT LASERS in logo red in a bold serif; errors never by colour alone; brand red (about #DE3030, about 4.6:1 on white) only where contrast holds (cat. NFR-017, NFR-018) | 100 % of states | Hash check of the logo file; contrast check of every state |
| NFR-022 | SEO and sharing | Title, meta description, Open Graph title and description on every page; no cost, rate or customer data in them; pages behind sign-in marked "do not index" (cat. NFR-020). PROPOSED lengths: title ≤ 60 and description ≤ 160 characters | 100 % of routes | Automated tag check |
| NFR-023 | Extensibility | The estimate screen reserves room for a drawing (cat. NFR-019) | 1 reserved region at 1024 px and wider | UX review |
| NFR-024 | Observability | PROPOSED: every unhandled server error logged with time, request ID and user ID and no secrets; every scheduled-job run logged; logs kept 30 days | 100 % of injected faults logged | Fault-injection test |
| NFR-025 | Maintainability | TypeScript strict; lint and type-check clean; coverage ≥ 80 % on changed code and package, ≥ 95 % on the formula module; functions ≤ 40 lines, files ≤ 400 lines (`docs/standards/coding-standards.md`) | 0 errors; thresholds as stated | CI on every pull request |
| NFR-026 | Data integrity | Approved estimates are unaffected by later master or configuration changes (confirmed, AQP-8); calculations are server-side only | 0 differing values in the regression test | Regression test: approve, change masters, compare screen and export |
| NFR-027 | Export fidelity | Export matches the worksheet layout | 100 % of the SPEC §14.12 checklist; file opens in Excel desktop without a repair prompt | Checklist plus manual open in Excel |
| NFR-028 | Privacy and compliance | Personal data limited to user name and e-mail and customer business contact details; no deletion or retention rule in Release 1 until Q-26 is answered (ASSUMPTION-26, kept); legal adviser to confirm DPDP Act 2023 applicability (not verified) | 0 real personal data in tests (NFR-006) | Repository scan; Q-26 answer |
| NFR-029 | Localisation (language) | English only | 1 language | Inspection |
| NFR-030 | Deployability | Single `docker compose up` after copying `.env.example`; every environment variable listed. PROPOSED: a clean machine reaches a working sign-in page within 30 minutes by the README | ≤ 30 min | Timed walk-through by someone who did not write the README |

## 6. Scope

**Proposal, not agreed.** "MVP" here means the R1 core. Q-29 is answered (AQP-12 10446): 2026-11-13 is a target to finish development and hand the version to the customer for testing, acceptance and change requests. The remaining decision is Q-34, which scope the realistic completion date covers. **The scope is the delivery lead's choice (ASSUMPTION-50). Per DL-004 Q-34 does not hold G2 and is due at G3 approval; until they answer, no FR moves, both dates are unadopted estimates, UX and architecture cover every FR through R2, and the build starts with the R1 core.** The R1 core and every MoSCoW priority are the same under scope A and scope B. Contents, dates and reasoning are in `docs/02-product/release-plan.md`.

| Build stage | Must | Should | Could | Won't (this release) |
|-------------|------|--------|-------|----------------------|
| **R1 core: assign, enter, calculate, approve, export** | FR-001, 002, 004, 005, 007 to 013, 015 to 018, 020 to 029, 030, 031 to 034, 036 to 038, 042 to 053, 055, 056, 058 to 070, 085 to 087, 089, 091 (65 FRs) | FR-041, 071 | none | none |
| R1+ stretch (built after the core) | FR-014 | FR-035, 039, 054, 057, 088 | none | none |
| R2: Admin control and alerts | FR-019, 072 to 084 (14 FRs) | FR-003, 006, 040 | none | none |
| R3: later | none | none | FR-090, 097 | none |
| R-OFF: the next release (confirmed) | none | none | none | FR-092 offline use (definition open, not estimated) |
| Not planned | none | none | none | FR-093 to 096 |

**Two scopes for the completion date (Q-34).** Scope A = R1 core + R1+ + R2 (the whole SPEC except offline, dark mode and the UI-sample extras). Scope B = R1 core only (the first-release proposal of AQP-12 comment 10433, now with FR-030 and FR-018). The product manager's proposed answer is scope A, with the end of the R1 core kept as an interim hand-over point; the reasoning and both dates are in the release plan, section 2. The proposal is input to their choice, not a decision, and the master did not choose (DL-004). Nothing is moved until they answer.

NFRs apply to the build stage that delivers the behaviour they measure; NFR-004 and NFR-014 apply from R2.

### 6.1 Justification of each Must group in Release 1 ("what happens if we don't build it?")

| Group | If not built |
|-------|--------------|
| Sign-in, users, one Admin, role enforcement (FR-001 to 011) | No one can use the system safely; Engineers could reach costs (GOAL-02 fails) |
| Masters (FR-012, 013, 015 to 018) | Nothing can be calculated: rates, materials, exchange rates and customers feed every formula; without FR-018 an assembly parent cannot be completed with a real material (finding F-08) |
| Registry, engine, calculation, records (FR-020 to 031) | No quote; GOAL-03 cannot be tested; without FR-030 the total does not follow the confirmed cost rule (D-08) |
| Tasks and queues (FR-032 to 034, 036 to 038) | No assignment and no bell: late work stays invisible (GOAL-05) |
| Workspace (FR-042 to 053, 055, 056) | Engineers cannot enter data |
| Cost review and approval (FR-058 to 065) | No approved price: GOAL-01 and GOAL-06 fail |
| Export (FR-066 to 070) | The delivery lead stated the export is needed (AQP-4); GOAL-04 fails |
| Responsive, brand, tags, deployment (FR-085 to 087, 089, 091) | Not usable on the shop floor; not installable; SPEC MUST items unmet |

R2 Musts are deferred under scope B and built last under scope A; they are not dropped. If FR-072 to 080 are not built, the Admin cannot change the worksheet without a developer (BRQ-006 unmet) and a developer changes the seed configuration in the meantime. If FR-081 to 084 are not built, late work is visible only in the portal.

### 6.2 Counts (checked by script against section 4)

| Build stage | Must | Should | Could | Won't | Total |
|-------------|------|--------|-------|-------|-------|
| R1 core | 65 | 2 | 0 | 0 | 67 |
| R1+ stretch | 1 | 5 | 0 | 0 | 6 |
| R2 | 14 | 3 | 0 | 0 | 17 |
| R3 | 0 | 0 | 2 | 0 | 2 |
| R-OFF (next release) | 0 | 0 | 0 | 1 | 1 |
| Not planned | 0 | 0 | 0 | 4 | 4 |
| **Total** | 80 | 10 | 2 | 5 | 97 |

**The "Must at most about 60 % of MVP effort" rule is still not met, now measured on effort share, not on a fixed 80 h window.** The date is a target and not a blocker (AQP-12 10446), so the capacity comparison used in v0.1 (Musts about 99 % of 47 to 59 h) is withdrawn. On effort, the R1 core (scope B) is estimated at 46 to 67 h, of which only FR-041 and FR-071 (about 1 to 2 h, estimate) are Should, so Musts are about 96 to 98 % of the effort. Scope A is estimated at 71.5 to 103 h with about 7.5 to 12 h of Should (FR-041, 071, 035, 039, 054, 057, 088, 003, 006, 040), so Musts are about 88 to 90 %. The rule cannot be met without removing SPEC MUST items (Must = the SPEC says MUST or it has a SPEC §14 test), and the cut ladder in the release plan only moves Musts to a later stage. The deviation is not hidden: `master` accepted it as a recorded deviation with compensating controls (DL-002), and the delivery lead can still weigh in. What protects delivery confidence in its place: the completion date is a range with stated assumptions, it is re-issued at the first completed epic, and the build order puts the R1 core first so that an earlier hand-over stays possible.

### 6.3 Changes since v0.1 (PROPOSED unless a decision is cited)

Recorded by `master` at G2 attempt 1: items 1 and 2 are acceptable as proposals and are the working baseline (DL-003; the open details of FR-030 were closed later by Q-32, D-12); items 3 and 6 are text alignment; item 4 is their decision (AQP-11 10444); item 5 is their choice and neither accepted nor rejected (DL-003, DL-004). They may reverse any move.

| # | Change | From | To | Why |
|---|--------|------|----|-----|
| 1 | FR-030 (quantity roll-up) | R1\*, built only if UNC-d confirmed | R1 core, Must | UNC-d confirmed as corrected; the rule is SPEC §7.4 v1.3 with D-12. Adds 2.5 to 4 h to EPIC-03 (estimate; v0.1 said 2 to 3 h for the older per-level rule) |
| 2 | FR-018 ("Not applicable") | R1\*, Should | R1 core, Must | UNC-b confirmed; without it an assembly parent cannot be completed (F-08). Adds 0.5 to 1 h. Q-33 values stay an assumption |
| 3 | FR-025, FR-029, FR-030, FR-024 text | SPEC §7.4 v1.0 rule (BL = sum of BG over all nodes; BN divisor = row-2 BM) | SPEC §7.4 v1.3 (BL = item quantity x sum of BG, summed over top-level items; BN divisor = total of all BM) | Confirmed answers D-05, D-08, D-12 (Q-32 closed) |
| 4 | FR-092 offline | Won't, "not planned" | Won't this release, R-OFF (the next release) | Confirmed AQP-11 10444; not estimated |
| 5 | Scope for the completion date | Not stated | Scope A proposed (Q-34), scope B dated as the alternative | Release plan section 2 |
| 6 | Section 9.1 rejection paths | Listed for UNC-a to UNC-h | Removed; resolved items are listed in 9.1a | Confirmed items are no longer assumptions |

Open ordering question OQ-PM-06: under scope B the delivery lead's "next release" for offline (AQP-11 10444) and the proposed R2 (Admin screens and alerts) both come after the first hand-over. Under scope A there is no conflict, because R2 is built before the hand-over.

## 7. Epics (outline — detailed by product-owner)

Size: S ≤ 4 h, M 4 to 8 h, L 8 to 12 h, XL over 12 h (estimate; development, three reviews and QA included, human merge wait excluded). Hours are estimates, not measurements.

| Epic | Goal / user value | FRs | Release | Rough size (estimate) | Dependencies |
|------|-------------------|-----|---------|-----------------------|--------------|
| EPIC-01 Foundation, access and confidentiality | People sign in and only reach what their role allows; Engineers never see cost | FR-001, 002, 004, 005, 007 to 011 (FR-003, 006 in Release 2) | R1 | M, 4 to 6 h | None |
| EPIC-02 Masters and settings | The Admin holds the rates and lists that drive every calculation | FR-012, 013, 015 to 018 core; FR-014 stretch; FR-019 in EPIC-09 | R1 | M, 4.5 to 7 h core (incl. FR-018, 0.5 to 1 h); +2 to 3 h stretch (FR-014) | EPIC-01 |
| EPIC-03 Field registry and calculation engine | The portal calculates as the worksheet does | FR-020 to 031 | R1 | L, 9.5 to 14 h (incl. FR-030, 2.5 to 4 h) | EPIC-01; roll-up design by the architect (rule fixed, D-12) |
| EPIC-04 Task assignment and queues | Work is assigned, tracked and late work is visible | FR-032 to 034, 036 to 038, 041 core; FR-035, 039 stretch; FR-040 R2 | R1 | S to M, 3 to 5 h core; +1.5 to 2.5 h stretch | EPIC-01 |
| EPIC-05 Estimate workspace | Engineers enter a product tree quickly with no cost shown | FR-042 to 053, 055, 056 core; FR-054, 057 stretch | R1 | XL, 10 to 14 h core; +1.5 to 2.5 h stretch | EPIC-02, 03, 04 |
| EPIC-06 Cost review and approval | Leads check the arithmetic, set the price and lock it | FR-058 to 065 | R1 | M, 5 to 7 h | EPIC-03, 05 |
| EPIC-07 Excel export | The estimate leaves in the worksheet's layout | FR-066 to 071 | R1 | M, 5 to 7 h | EPIC-05, 06 |
| EPIC-10 Experience, brand and delivery | Usable on every screen, branded, installable, tested | FR-085 to 087, 089, 091 core; FR-088 stretch; FR-090 R3 | R1 | M, 5 to 7 h core; +1 to 1.5 h stretch | Runs alongside all epics |
| EPIC-08 Admin configuration | The Admin changes fields and formulas without a developer | FR-072 to 080 | R2 | XL, 12 to 16 h | EPIC-03 |
| EPIC-09 E-mail alerts and scheduled jobs | Late work reaches people by e-mail | FR-003, 019, 081 to 084; FR-006, 040 with EPIC-01 and 04 | R2 | M, 6 to 8 h (+1.5 to 2.5 h for FR-006, 040) | EPIC-04; SMTP details (Q-18) to test against a real server; a capturing mail server is used until then |
| EPIC-11 Later | Dark mode, UI-sample extras; drawings only if scheduled | FR-090, 097 (FR-093 excluded) | R3 | Not estimated | R2 done |
| EPIC-12 Offline use (new, outline only) | Use the portal without internet (confirmed for the next release, AQP-11 10444) | FR-092 | R-OFF | Not estimated: what offline means is open | Hosting design (Q-18, G3); cost confidentiality (BRQ-002); roll-up and calculation stable |

## 8. Prioritisation Rationale

RICE needs reach, impact and confidence data that do not exist here (all three roles use every flow; no usage data). The product manager scores **value** (1 to 5, contribution to the primary outcome: estimates assigned, entered, calculated, approved and exported with no cost shown to Engineers) against **effort** (midpoint of the estimate range). Dependencies override the ratio.

| Epic | Value (1 to 5) | Effort, midpoint (h) | Value / effort | Order set by |
|------|----------------|----------------------|----------------|--------------|
| EPIC-01 | 5 | 5 | 1.00 | Prerequisite for all |
| EPIC-02 | 4 | 5.75 | 0.70 | Needed before calculation can be tried |
| EPIC-03 | 5 | 11.75 | 0.43 | Needed before workspace and approval |
| EPIC-04 | 4 | 4 | 1.00 | Creates the estimate the workspace opens |
| EPIC-05 | 5 | 12 | 0.42 | Largest; the primary user flow |
| EPIC-06 | 5 | 6 | 0.83 | Delivers the approved price |
| EPIC-07 | 4 | 6 | 0.67 | Stated need (AQP-4) |
| EPIC-10 | 4 | 6 | 0.67 | Cross-cutting; runs alongside |
| EPIC-09 | 3 | 7 | 0.43 | Needs SMTP details that do not exist yet; the bell covers late work in the portal |
| EPIC-08 | 3 | 14 | 0.21 | Seeded configuration covers today's worksheet; changes are infrequent (estimate) |

R2 order: EPIC-09 before EPIC-08 on value/effort, but EPIC-08 closes a SPEC MUST (BRQ-006) and is the largest and riskiest block, so building it first gives more time to recalibrate; the delivery lead may reverse the order. The scores are judgement and are open to challenge.

## 9. Assumptions, Constraints, Dependencies

### 9.1 Labelled assumptions still open: what changes if each is rejected (G1 condition 6)

None of these is a decision. The SPEC §18 status rule applies: an open detail is not guessed; the labelled assumption applies until the delivery lead answers. **Q-32 is closed (D-12) and ASSUMPTION-48 is retired, so it has no row below.**

**Q-32 and build effort.** With the rule fixed, the contingency "0 to about 2 h of build effort if an answer differs" is removed from this plan. FR-030 and EPIC-03 (2.5 to 4 h inside 9.5 to 14 h) were sized on the interim reading that the answers confirmed (item quantity once at the top, a parent's own cost counted, a parent shows its own row plus everything below, column BG only), so the effort figures do not change. The price ratios that made (a) and (b) hold G2 (a factor of 3 in the FR-030 example under multiply-at-every-level, 58.6 % lower on the sample under children-only, about 16 % higher under the column rectangle) describe readings that were not chosen; they stay in SPEC §18.5.

| ID | Assumption carried | FRs written on it | If rejected or changed | If confirmed |
|----|--------------------|-------------------|------------------------|--------------|
| ASSUMPTION-49 / Q-33 | "Not applicable" is system-created in the Material Master with price, specific gravity and scrap rate all 0, and in the Treatment / Color list; the Admin cannot delete or rename either | FR-018 | Other values or an editable entry: FR-018 text and the seed data change; a non-zero value would put a cost on a part that has none | FR-018 as written |
| ASSUMPTION-47 / Q-31 | BL, BN and BO appear in row 2 of the export only; no per-item totals; no Tool Cost total column | FR-067, FR-069 | Per-item totals as in the sample: FR-069 and the export checklist (SPEC §14.12) change; about 1 to 2 h (estimate) | FR-069 as written |
| ASSUMPTION-46 / Q-30 (updated for D-13) | **The original sample workbook is tracked in the repository** (on `origin/master` since commit c7576f0), and **the repository stays public by the delivery lead's decision** (D-13; AQP-1 comment 10465, their words). They state that the workbook "doesnt have real data" and that "the formulas are not self explanatory"; **that the workbook holds no real data is their statement and has not been verified.** Export widths, headers and formats are read from the original (structure only). The rule stays: no sample cell value is copied into any artefact, Jira or GitHub unless the delivery lead changes it (NFR-006, catalogue NFR-023, unchanged). Agents do not change repository visibility, history or the tracked files | FR-020, FR-066 to 069; NFR-006 | A cleaned copy is supplied at `docs/reference/sample-estimate.xlsx` (Q-30, open, not blocking): export checks become repeatable from a file known to be safe; no FR change. If they decide the content must come out of the repository, that is a history rewrite needing their explicit authorisation | No FR change |
| ASSUMPTION-50 / Q-34 (due G3 approval, DL-004) | The product manager states dates for both scopes; **the scope is the delivery lead's choice**. Until they answer: no FR moves, both dates are unadopted estimates, UX and architecture cover every FR through R2, and the build starts with the R1 core | none (scope only) | They choose scope B: R2 moves after the first hand-over (OQ-PM-06); they choose scope A: no move | Chosen scope stands; `product-manager` then updates the plan and `master` logs it |
| ASSUMPTION-18 (hosting part) / Q-18 | Internet-hosted (confirmed); address, e-mail service and sender, backups and who updates are still assumed (Docker Compose, SMTP supplied later) | FR-091, FR-019, FR-081 to 084; NFR-012, NFR-013, NFR-030 | Different hosting or e-mail service: deployment and mail settings change; tests with a capturing mail server are unaffected | Settles at G3 |

### 9.1a Resolved items (2026-11-01): status label and where each applies

Status uses the label key at the top (DL-001). No rejection path is kept for these. If they later change one, the change goes through the change log (section 13) and the decision log.

| ID | Status | Resolution | Applied in |
|----|--------|------------|-----------|
| UNC-a | Confirmed on list wording | BN = BL / total of all Tool Cost entries; "—" when that total is 0 (AQP-1 10441 (a)) | FR-025, FR-069 |
| UNC-b | Confirmed on list wording | "Not applicable" in the Material and Treatment lists (10441 (b)); values are Q-33 | FR-018, FR-056 |
| UNC-c | Confirmed on list wording | Recalculation after unlock uses current values with a notice (10441 (c)) | FR-063 |
| UNC-d | Confirmed in their own words, as corrected (10443; AQP-9 10442; AQP-13 10445) | Main rule: cost = sum of the costs of all children x item quantity. The per-level rule of 10415 is withdrawn. Details closed on 2026-11-01 (Q-32, D-12): see the Q-32 row below | FR-024, FR-029, FR-030 |
| UNC-e | Confirmed in their own words (AQP-11 10444); also 10441 (e) | Release 1 internet-hosted; offline in the next release | FR-092, section 6 |
| UNC-f | Confirmed on list wording | Q-15 closed; no "Not needed" switch (10441 (f)) | FR-095, FR-056 |
| UNC-g | Confirmed on list wording | Kept assumptions for Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 (10441 (g)). If they change one, only its FR changes: Q-10 export details FR-066 to 069; Q-11 the BC formula in FR-024; Q-13 FR-055 | FR-003, 004, 006, 022, 026, 028, 033, 035, 038, 040, 041, 049, 052, 054, 064, 070, 071, 089, 090, 096 |
| UNC-h | Confirmed in their own words as a target, not a fixed constraint (AQP-12 10446); also 10441 (h) | The end date 2026-11-13 | Release plan |
| Q-29 | Answered in their own words (AQP-12 10446) | The date is the target to complete development and hand over for testing, acceptance and change requests; a realistic date is requested. Production go-live, training and the parallel run follow and are not in the dates | Release plan |
| Q-32 / D-12 | (b1), (b2) "parent's own cost counts": confirmed in their own words (AQP-13 10464). (a), the consequence of (b2), (b3), (c), (d), (e1), (e2) and the closing "Okay": confirmed on list wording (AQP-13 10462; reading stated in 10463; no objection in 10464), not their own words | ASSUMPTION-48 is retired. Rule: BL = item quantity x the sum of BG over the item's own row and every descendant row, column BG only; a parent's own cost counts; a parent shows its own row plus everything below; the estimate's BL is the sum over top-level items | FR-024, FR-025, FR-029, FR-030; GOAL-03 |
| D-13 | Decision in their words (AQP-1 10465). That the sample workbook holds no real data is their statement, not verified | The repository stays public; no sample cell value is copied into any artefact, Jira or GitHub (NFR-006 / catalogue NFR-023, unchanged) | ASSUMPTION-46, RISK-006 |

### 9.2 Constraints
- Stack (CONSTRAINT-01, 02, 03): `CLAUDE.md` §1 and SPEC §2; no `eval`; IST display, UTC storage.
- Exactly one active Admin (CONSTRAINT-04). Logo 200 × 200 px until replaced (CONSTRAINT-05). Part images under 200 KB (CONSTRAINT-08).
- Governance (CONSTRAINT-06): human approval at G1, G3, G8; code pull requests merged by a human; stop for master data defaults after G3 approval and before development (TR-009, held in `docs/project-state.md` HOLD-01).
- Budget: no limit (confirmed, AQP-2). Start 2026-11-02 and 10 working days at 8 hours a day (confirmed, AQP-2); the end date 2026-11-13 is a target, not a fixed constraint (confirmed, AQP-1 10441 (h); AQP-12 10446). The realistic completion date is in the release plan; human waits at G3, the master data stop, code pull request merges and G8 are inside its elapsed time (OQ-PM-01); the Q-32 reply has arrived and adds no wait.

### 9.3 Dependencies and transition work
| Dependency | Needed for | Owner | Status |
|------------|-----------|-------|--------|
| Master's G2 attempt 2 decision (Q-32 closed, ASSUMPTION-48 retired) | UX and architecture start | master | Pending; no input from the delivery lead is needed for it |
| Delivery lead's answer to Q-34 (scope for the date; DL-004) | G3 approval; the hand-over boundary and the date, not any FR | Santhosh | Open; does not hold G2 |
| Delivery lead's answer to Q-31 (export totals per item or row 2 only) | G3 (export design) | Santhosh | Open |
| Decision on the repository and the two tracked files | NFR-006; whether a cleaned sample is needed | Santhosh | Decided: the repository stays public (D-13; AQP-1 10465). That the workbook has no real data is their statement, not verified. Agents do not change visibility or history |
| Master data defaults (TR-002, TR-009) | Meaningful tests and go-live | Santhosh | Stop after G3 approval; invented placeholders until then (NFR-006) |
| Cleaned sample worksheet at `docs/reference/sample-estimate.xlsx` (TR-007, Q-30) | FR-020, FR-066 to 069 | Santhosh | Open, not blocking. The original is tracked on `origin/master` since c7576f0 in a repository that stays public (D-13); structure only is read from it |
| E-mail (SMTP) service and sender (Q-18) | FR-003, 019, 081 to 084 (R2; a real server is needed to test them end to end, a capturing mail server before that) | Accucut IT | Open |
| Hosting, web address, backups, IT contact (Q-18) | FR-091, NFR-012, NFR-013 | Accucut IT | Open; details due G3 |
| Docs pull request (BLK-01) | G4 merge, then story branches | orchestrator | Cleared: draft PR #1 (`docs/AQP-1-inception`) exists. The orchestrator merges it after G4 GO (`MERGE_POLICY` docs-auto); story branches start after the merge |
| Customer testing and acceptance, change requests (AQP-12 10446); first users (TR-003); training (TR-005); parallel run of real past estimates (TR-004, BRQ-013) | After the development completion date | Santhosh / Accucut | Follow the hand-over; not in the dates |
| Sharper logo (Q-16) | Brand | Santhosh | Assumption kept (UNC-g) |

## 10. Risks

P and I are Low, Medium or High. Register IDs are `docs/00-governance/risk-register.md`; "proposed" risks are for `master` to record.

| Risk | P | I | Mitigation | Owner |
|------|---|---|------------|-------|
| RISK-003 (restated): the 2026-11-13 target is missed. Estimates, neither adopted (DL-004): scope B ends Fri 2026-11-20 (range Mon 11-16 to Mon 11-30), scope A ends Thu 2026-11-26 (range Thu 11-19 to Mon 12-07). The delivery lead has said the date is not a blocker (AQP-12 10446), so the impact falls from High to Medium: the risk is now a wrong forecast, not a missed deadline | High (the target is missed in every case modelled) | Medium | Dates are a range with stated assumptions; re-issued at the first completed epic and at each checkpoint; interim hand-over at the end of the R1 core stays possible | Santhosh, product-manager |
| RISK-002 (reduced; proposed re-rating for `master` to record): the roll-up rule (Q-32, D-12) differs from the delivery lead's intent in a case the sample cannot show. The sample has quantity 1 on every row, so the quantity rules ((a), (c), (d)) are tested with a constructed example, not the sample; (a), (b3), (c), (d), (e1), (e2) are confirmed on list wording, not in their own words | Low (was Medium) | High | Rule fixed (D-12); constructed example in the test plan (FR-030, SPEC §18.5); the parallel run compares with a worksheet calculated the same way; they can change any point later through the change log | Santhosh |
| RISK-001: assistant-drafted answers posted unedited | Low (reduced) | High | G1 condition 1 met in substance (DL-001): 10441 items (a), (b), (c), (f), (g) stand as confirmed on list wording, not as their own words; they corrected (d) in their own words (10443). They can change any item | master |
| RISK-006 (decided; residual risk proposed for `master` to record): the sample workbook and the draft requirements document are tracked on `origin/master` (since c7576f0) in a public repository. The delivery lead decided that the repository stays public (D-13; AQP-1 10465) and states the workbook "doesnt have real data"; that statement is theirs and has not been verified | Medium (the statement is unverified) | High | Their decision stands; agents do not change visibility or history. The rule that no sample cell value is copied into any artefact, Jira or GitHub stays (NFR-006), so new documents add no exposure. If the content turns out to be real, they decide the next step (a history rewrite needs their explicit authorisation) | Santhosh |
| RISK-004: offline use kept in Release 1 | Low (reduced) | High | Decided: offline is the next release (AQP-11 10444). Residual risk: what offline means is open and may conflict with cost confidentiality (BRQ-002) | Santhosh |
| RISK-005 / BLK-01 (cleared): the docs PR could not be created | Closed | Medium | Draft PR #1 (`docs/AQP-1-inception`) exists; the orchestrator merges it after G4 GO (docs-auto); story branches start after the merge | orchestrator |
| RISK-007: effort estimates are not calibrated; no velocity exists. The dates rest on 46 to 67 h (scope B) and 71.5 to 103 h (scope A) of relative-size estimates | High | High | Recalibrate on the first completed epic; the release plan gives the formula to re-issue the date | product-manager, scrum-master |
| RISK-008: human waits (G3 review, master data defaults, G8; the Q-32 reply has arrived) and one human merge per story are modelled at 0.5 to 1.5 working days per wait and 0.25 to 1 day per dependency stage; the delivery lead is the only human | High | Medium | Release plan section 3 shows the effect of each; faster answers move the date earlier by the stated amounts | Santhosh |
| RISK-009 (merged with the earlier unverified-calendar row): holidays and their unavailable days are unknown (OQ-PM-02, not verified); each lost weekday between 2026-11-02 and 2026-12-09, including any in 2 to 13 November that reduce the 10 days, moves every later date by one weekday | Medium | Medium | Dates assume none; the release plan gives the shift for 3 lost weekdays | Santhosh |
| RISK-010 (proposed): Excel export size. 500 nodes with images up to 200 KB each could exceed 100 MB | Low | Medium | Architect sets a limit or an export strategy; NFR-010 is set on 50 nodes | solution-architect |

Removed in v0.3: the row on parent non-zero inputs (stale: it said they are "not counted under ASSUMPTION-48", which now counts them; the topic is part of RISK-002 above) and the duplicate calendar row (merged into RISK-009). The two rows formerly marked "Proposed" for effort and for human waits are now labelled with their registered IDs, RISK-007 and RISK-008. Changed in v0.4: RISK-002, RISK-005 and RISK-006 restated for Q-32 closed, BLK-01 cleared and D-13; RISK-003 dates re-issued (release plan v0.4).

## 11. Traceability Matrix

Every brief goal reaches at least one FR; every FR in section 4 carries a goal and a catalogue source; every BRQ and UR below is covered. BRQ-013 (checked cut-over) has no software FR: it is transition work TR-004, tested by FR-024.

| Goal | BRQ / UR | FR | Epic |
|------|----------|----|------|
| GOAL-01 Move to the portal | BRQ-001 (FR-062 and the whole flow), BRQ-013; UR-002, UR-004, UR-005, UR-013, UR-016, UR-022, UR-040, UR-043 | FR-001, 004, 018, 032, 033, 043, 045, 046, 053, 054, 056, 057, 091 | EPIC-01, 02, 04, 05, 10 |
| GOAL-02 Hide costs from Engineers | BRQ-002; UR-021, UR-023, UR-030 | FR-002, 003, 007, 008, 051, 055, 070 | EPIC-01, 05, 07, 09 |
| GOAL-03 Calculate as the worksheet | BRQ-004; UR-012, UR-014, UR-018, UR-019, UR-025, UR-027, UR-031, UR-032 | FR-012 to 017, 021 to 031, 042, 044, 048, 049, 052, 058, 061 | EPIC-02, 03, 05, 06 |
| GOAL-04 Export in the worksheet layout | BRQ-005; UR-017, UR-020, UR-026, UR-030 | FR-020, 041, 047, 050, 059, 066 to 069, 071 | EPIC-03, 04, 05, 06, 07 |
| GOAL-05 Late work visible | BRQ-009; UR-006 to UR-011, UR-037 | FR-019, 034 to 040, 081 to 084, 097 | EPIC-04, 09, 02, 11 |
| GOAL-06 Control prices and configuration | BRQ-003, BRQ-006, BRQ-007, BRQ-008; UR-003, UR-028, UR-029, UR-033 to UR-036, UR-038 | FR-005, 006, 011, 031, 060, 062 to 065, 072 to 080 | EPIC-01, 03, 06, 08 |
| GOAL-07 All screens, consistent design | BRQ-010, BRQ-011, BRQ-012; UR-039 | FR-009, 010, 085 to 090 | EPIC-01, 10, 11 |
| Next release / not planned | BRQ-014; UR-041, UR-042 | FR-092 (R-OFF, EPIC-12); FR-093 to 096 (not planned) | EPIC-12; none |

Business rules map to FRs through the Source column of section 4 (BR-001 to BR-048 each appear at least once).

## 12. Open Questions

| ID | Question | Owner | Needed by |
|----|----------|-------|-----------|
| Q-32 (all points) | Closed 2026-11-01 (AQP-13 10462, 10464; D-12). No open question remains on the roll-up rule. ASSUMPTION-48 is retired | - | closed |
| Q-34 (DL-004) | Which scope the realistic completion date covers: scope A (R1 + R1+ + R2) or scope B (R1 core). Their choice. Proposed answer, as input only: scope A, with the end of the R1 core as an interim hand-over point (release plan section 2). Does not hold G2 | Santhosh | G3 approval |
| Q-18 (AQP-11) | Hosting details: web address, e-mail service and sender, backups, who updates; whether the site is open beyond the sign-in page. Offline is decided (next release); its meaning is settled when that release is planned | Santhosh, Accucut IT | G3 |
| Q-30, Q-31, Q-33 | Cleaned sample copy (non-blocking; the repository stays public by the delivery lead's decision, D-13); export totals per item or row 2 only; values and lock of the "Not applicable" entries | Santhosh | G3 |
| OQ-PM-01 | Does the delivery lead's availability follow a working-day pattern (the dates assume they answer each human point within 0.5 to 1.5 working days)? | Santhosh | G2 |
| OQ-PM-02 | Any Accucut or public holiday, and any days they are unavailable, between 2026-11-02 and 2026-12-09? (not verified) | Santhosh | G2 |
| OQ-PM-03 | Availability target and support hours; PROPOSED 99.0 % monthly (NFR-012) | Santhosh, IT contact | G3 |
| OQ-PM-04 | Supported browsers and versions; PROPOSED set in NFR-019 | Santhosh | G3 |
| OQ-PM-05 | Largest realistic estimate with images, for the export limit (NFR-010) | Santhosh; solution-architect | G3 |
| OQ-PM-06 | Under scope B only: does "the next release" for offline (AQP-11 10444) come before or after the Admin screens and alerts (R2)? Arises only if they choose scope B in Q-34 | Santhosh | G3 approval, with Q-34 |
| Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | Kept assumptions, confirmed on list wording (10441 (g)); they can change any later | Santhosh | G2 to G8 |

## 13. Change Log

| Version | Date | Change | Reason | Decision ref |
|---------|------|--------|--------|--------------|
| 0.1 | 2026-11-01 | First draft: FR-001 to 097, NFR-001 to 030, epics, assumptions register, release proposal | G2 input; G1 condition 6 | `docs/00-governance/gate-log.md` G1 |
| 0.2 | 2026-11-01 | Pass 3 applied. Unconfirmed labels and the section 9.1 rejection paths removed for UNC-a to UNC-h; cost roll-up FRs (FR-024, 025, 029, 030) aligned with SPEC v1.2 and revised ASSUMPTION-48; FR-092 set to R-OFF; completion date and two scopes added (Q-34); fit analysis and Must share restated; risks and open questions refreshed. Release moves are PROPOSED (section 6.3): FR-030 and FR-018 to the R1 core, FR-018 to Must | Delivery lead's own-words replies (AQP-1 10441, 10443; AQP-9 10442; AQP-13 10445; AQP-11 10444; AQP-12 10446); hand-off AQP-1 10448 | Proposal: to be recorded by `master` once the delivery lead answers Q-34 |
| 0.3 | 2026-11-01 | G2 NO-GO remediation 4 and 5 (product-manager part). FR-030: the per-level rule is withdrawn "as written" and stays open as Q-32 (a); the earlier line that a multiply-at-every-level rule "is withdrawn" contradicted section 9.1 and is replaced. FR-024, 025, 029, 030 and GOAL-03 labelled against ASSUMPTION-48 and the open sub-points, interim readings (b3) and (e1) named; no Q-32 answer applied because none exists. Section 9.1 states that the "0 to about 2 h" is build effort, not price, and lists the price ratios. Section 10: stale row on parent non-zero inputs and duplicate calendar row removed, RISK-006 added, rows carry registered IDs. Label key and section 9.1a: items (a), (b), (c), (f), (g) of AQP-1 10441 are "confirmed on list wording" (DL-001). ASSUMPTION-46 and section 9.3: the sample is tracked on `origin/master` since c7576f0 in a public repository (RISK-006). DL-004 and ASSUMPTION-50 reflected: scope is their choice, Q-34 due G3 approval, both dates unadopted. Q-32 split in section 12 per DL-005. No FR, priority, release or date changed | `docs/00-governance/gate-log.md` G2 attempt 1, remediation 4 and 5; DL-001 to DL-005 | DL-001, DL-004, DL-005 |
| 0.4 | 2026-11-01 | Q-32 closed and ASSUMPTION-48 retired (AQP-13 comments 10462 and 10464; SPEC §18 D-12): the assumption labels and open Q-32 wording are replaced by the stated rule in GOAL-03, FR-024, 025, 029, 030 and sections 6.3, 7, 9.1, 9.1a, 9.3, 10 and 12; the difference between their own words ((b1), (b2) "parent's own cost counts"; the main rule) and list wording ((a), (b2) consequence, (b3), (c), (d), (e1), (e2)) is kept. FR-030 has one expected value (14), per SPEC §18.5. Repository decision D-13 reflected in ASSUMPTION-46, RISK-006 and section 9.3 ("no real data" is the delivery lead's statement, not verified; NFR-006 unchanged). BLK-01 cleared (draft PR #1 exists); RISK-005 closed. Build effort unchanged; the Q-32 reply wait leaves the release-plan model, which moves the dates (release plan v0.4, RISK-003). "he/his" replaced by "the delivery lead" or "they". No FR, priority, release or scope changed | AQP-13 10462, 10464; AQP-1 10465; `docs/00-governance/decision-log.md`; SPEC v1.3 | D-12, D-13 |
