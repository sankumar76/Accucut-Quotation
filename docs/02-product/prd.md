# Product Requirements Document — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 (Draft for G2; revised after the delivery lead replies to G1 conditions 1 to 3) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | Draft. G2 cannot pass until G1 conditions 1 to 3 are met (`docs/00-governance/gate-log.md`, G1). The release split in section 6 is a **proposal, not agreed** |
| Source brief | `docs/01-discovery/project-brief.md` v0.3 |
| Companion | `docs/02-product/release-plan.md` (fit to 10 working days, calendar, cut order) |

**How to read the labels in this document.**
- **Confirmed** = in the delivery lead's own words on a Jira question issue (AQP-2 to AQP-10; AQP-11 for the offline request).
- **UNC-a to UNC-h, Q-18, Q-29, Q-32** = labelled assumptions, not decisions (G1 condition 6). Each rests on AQP-1 comment 10415 or 10417 or is open. Section 9.1 states, for each, which FRs change if it is rejected.
- **SPEC §7.4 stays in force** wherever UNC-d or Q-32 is unsettled.
- **PROPOSED** = a number or rule the product manager sets because no source gives one; the owner named must confirm it.
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

Frequencies are not evidenced (Q-24 keeps the stated volume assumptions; UNC-g).

## 3. Outcomes & Success Metrics

Goal IDs are from the brief (section 3). Baselines the brief marks "not measured" stay open until Q-24 and Q-28 are answered; no figure here is invented.

| Goal (brief) | Metric | Type | Baseline | Target | Measurement method |
|--------------|--------|------|----------|--------|--------------------|
| GOAL-01 Move estimation to the portal | Share of new estimation tasks created and approved in the portal after cut-over | Lagging | 0 % (all work in Excel) | 100 % of new tasks | Count tasks created in the portal versus tasks reported by the Lead after cut-over; leading check: end-to-end test (assign, enter, calculate, approve, export) green on every build |
| GOAL-02 Hide costs from Engineers | Cost, rate or formula values found in any Engineer page, API response or file | Leading | No control exists (inferred) | 0 found | Automated test over every Engineer-reachable route, run on every build (SPEC §14.1) |
| GOAL-03 Calculate as the worksheet does | Share of SPEC §7.4 outputs matching a hand-calculated worksheet to 2 decimals on the acceptance tree | Leading | Not applicable | 100 % | Unit test per formula plus the tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 (SPEC §14.2). Oracle is the SPEC §7.4 arithmetic until Q-32 is answered (ASSUMPTION-48 (d)) |
| GOAL-04 Export in the worksheet layout | Share of export checks passed (A to BO, widths, centre/middle, currency formats, images, BL2 and BO2) | Leading | Not applicable | 100 % | Export checklist run on a generated file; opened in Excel desktop (SPEC §14.12) |
| GOAL-05 Make late work visible | (a) Overdue e-mail within 5 minutes of becoming overdue; (b) 11:00 IST digest sent daily when overdue tasks exist; (c) duplicates | Leading | Not measured | (a) 100 %, (b) 100 %, (c) 0 | Job tests with a controlled clock and a capturing mail server; e-mail log counts. **Release 1 gives the in-portal part only (bell, Overdue tab); (a) to (c) arrive in Release 2** |
| GOAL-06 Control prices and configuration | (a) Approved estimates carrying price, approver and time; (b) configuration, master, approval, unlock and price-override events logged with who, when, before → after | Leading | Not measured | (a) 100 %, (b) 100 % | Test per event type; database check of approved estimates. **Release 1 covers master, approval, unlock and price-override events; configuration events arrive in Release 2** |
| GOAL-07 Work on all screen sizes, consistent design | Screens with no horizontal page scroll and every action reachable at 360, 768 and 1366 px; design-system review passed | Leading | Not applicable | 100 % of screens | Playwright at the three widths; design-system review checklist |

Business outcome measures such as estimate turnaround cannot be set until the baseline is supplied (Q-24, Q-28).

## 4. Functional Requirements

**Columns.** Pri = MoSCoW priority of the product (exactly one per FR; Must = the SPEC says MUST or it has a SPEC §14 test; Should = stated without MUST or a `[DEFAULT]`; Could = optional; Won't = excluded). Rel = proposed release: **R1** Release 1 core; **R1+** Release 1 stretch (pulled in only if the core is on track); **R1\*** in Release 1 only if the delivery lead confirms the assumption it rests on; **R2**, **R3** later; **-** not planned. Goal = brief goal served. Tags such as [UNC-b] mark a requirement written on a labelled assumption. Source IDs are from `docs/01-discovery/requirements-catalog.md`. Priority is independent of release: a Must in R2 is required before the product is complete, not before Release 1.

### 4.1 Access, accounts and confidentiality (EPIC-01)
| ID | Requirement (user point of view) | Pri | Rel | Goal | Source | Fit criterion |
|----|----------------------------------|-----|-----|------|--------|---------------|
| FR-001 | As any user, I sign in with e-mail and password and sign out. | Must | R1 | GOAL-01 | UR-001, BR-001 | Valid credentials open my role's home page; a wrong password is refused without saying which part was wrong; sign-out ends the session. |
| FR-002 | As any user, I change my own password. | Must | R1 | GOAL-02 | UR-001 | After the change the old password is refused and the new one accepted. |
| FR-003 | As any user, I reset a forgotten password through an e-mailed single-use link. [UNC-g, ASSUMPTION-31] | Should | R2 | GOAL-02 | UR-001, ASSUMPTION-31 | The link works once; a second use is refused. Until R2 the Admin resets passwords (FR-004). |
| FR-004 | As Admin, I create, edit and deactivate users, set their role and reset their passwords. [UNC-g, ASSUMPTION-30] | Must | R1 | GOAL-01 | UR-002, BR-001, TR-003 | User list shows name, e-mail, role, active flag; a deactivated user cannot sign in. |
| FR-005 | As Admin, I am the only active Admin at any time. | Must | R1 | GOAL-06 | UR-003, BR-001, CONSTRAINT-04 | Creating or activating a second Admin is refused (SPEC §14.14). |
| FR-006 | As Admin, I hand the role to another active user in one confirmed step. [UNC-g, ASSUMPTION-23, Q-23] | Should | R2 | GOAL-06 | ASSUMPTION-23 | After the step exactly one active Admin exists and the change is logged. |
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
| FR-018 | As an Engineer, I can choose "Not applicable" in Material in Drawing and Treatment / Color for a part that needs none; the system creates both entries (Material rates all 0), and the Admin cannot delete or rename them. [UNC-b, Q-33, ASSUMPTION-49] | Should | R1\* | GOAL-01 | UR-043, BR-048, DR-008, DR-010 | Entries exist after install; a part using them adds 0 cost. Built only if UNC-b is confirmed. |
| FR-019 | As Admin, I turn e-mail alerts on or off, set the sender name and address, and send a test e-mail. | Must | R2 | GOAL-05 | UR-037, DR-014 | Setting changes behaviour of FR-081 to FR-084; test e-mail arrives. |

### 4.3 Field registry and calculation (EPIC-03)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-020 | As Admin, on first install the portal holds the field registry and sections defined in SPEC §7 (and the sample's header texts, widths and formats). | Must | R1 | GOAL-04 | TR-001, DR-011, SPEC §7 | Registry holds every SPEC §7 field in order, each with letter, section, type, width and format. |
| FR-021 | As any user, I see Excel-style column letters derived from field position, never stored. | Must | R1 | GOAL-03 | BR-034, SPEC §8.1 | Unit tests: position 1 = A, 26 = Z, 27 = AA, 52 = AZ, 53 = BA, 67 = BO, and the inverse. |
| FR-022 | As the business, calculations run in a formula engine that reads operands (letters, rate names, Material-\* fields, exchange-rate names, numbers), + − × ÷ and brackets, and SUM over all nodes, without `eval`. Also MIN, MAX, ROUND, IF. [UNC-g, ASSUMPTION-41] | Must | R1 | GOAL-03 | BR-036, CONSTRAINT-02 | Unit tests per operator and function; coverage of the formula module ≥ 95 %; code search finds 0 uses of `eval` or `new Function`. |
| FR-023 | As the business, formulas evaluate in dependency order, and a configuration with an unknown name, a syntax error or a cycle is rejected with the cycle shown. | Must | R1 | GOAL-03 | BR-037, SPEC §8.2 | A test configuration with a cycle fails validation and names the cycle; the seed configuration passes. |
| FR-024 | As Lead or Admin, every output in SPEC §7.4 is calculated per BR-015 to BR-022 from the customer's rates, material data and exchange rates. | Must | R1 | GOAL-03 | BRQ-004, BR-015 to BR-022, SPEC §14.2 | Every output matches a hand-calculated value to 2 decimals on known inputs, plus the end-to-end tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5. The oracle is SPEC §7.4 until Q-32 is answered. |
| FR-025 | As Lead or Admin, I see the product-level values once per estimate: BL (Total Unit Production Price), BN and BO. In force (SPEC §7.4): BL = sum of BG over all nodes; BN = BL / BM (row-2 value), "—" when BM is 0; BO = Approved Quote Price. [UNC-a] | Must | R1 | GOAL-03 | BR-023, D-04, D-05 | BL, BN, BO each appear once; values match hand calculation. If UNC-a is confirmed the BN divisor becomes the total of all Tool Cost entries (same result when one Tool Cost entry exists, F-22). |
| FR-026 | As a user, division by zero shows "—" on screen and an empty cell in the export and never stops a calculation. [UNC-g] | Must | R1 | GOAL-03 | BR-024 | A node with a zero divisor calculates; the other outputs are present. |
| FR-027 | As the business, calculations run on the server; results are stored at full precision, displayed to 2 decimals, and recomputed on Calculate and Recalculate; inputs accept up to 2 decimals. | Must | R1 | GOAL-03 | BR-025, NFR-022 (cat.) | A stored value differs from the displayed one only by rounding; Engineer responses contain no preview. |
| FR-028 | As the business, a rate named with "%" is typed as a whole percentage (12 means 12 %) and used as 0.12. [UNC-g, ASSUMPTION-39] | Must | R1 | GOAL-03 | BR-021 | OH Profit % typed 12 gives BD = BB × 0.12. |
| FR-029 | As Lead or Admin, a parent's cost is the sum of its children's costs, and the total counts every lowest-level cost once (confirmed, AQP-9). | Must | R1 | GOAL-03 | BR-046, D-08 | Part-1 with sub-part-1 and sub-part-2 shows the sum of the two; with parent inputs at 0, BL equals the SPEC sum of BG over all nodes. |
| FR-030 | As Lead or Admin, a child's cost is multiplied by its parent's quantity, through every level; a parent's BG = its quantity × the sum of its children's BG; BL = the sum of the top-level nodes' BG. [UNC-d, Q-32, ASSUMPTION-48] | Must | R1\* | GOAL-03 | BR-047, ASSUMPTION-48 | Parent 2 × child 3 counts 6; item 2 × part 3 × sub-part 4 counts 24; worked examples in the test plan. **Not built unless confirmed; SPEC §7.4 stays in force.** |
| FR-031 | As the business, each Calculate and Recalculate records the configuration version and every master value used (customer rates, material values, exchange rates). | Must | R1 | GOAL-06 | BRQ-008, BR-012, BR-039, DR-003, D-07 | After any master changes, a previously calculated estimate's stored values are unchanged (regression test). |

### 4.4 Task assignment and queues (EPIC-04)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-032 | As Admin or Lead, I assign a task to an Engineer with a network folder path, a deadline (date and time, IST) and an optional title and notes; this creates an empty estimate. | Must | R1 | GOAL-01 | UR-004, BRQ-009, SPEC §5.1 | The task appears in the Engineer's Open queue; the estimate exists in DRAFT. |
| FR-033 | As any user, I see the folder path as a link and a "Copy path" button with a tooltip. [UNC-g, Q-12] | Must | R1 | GOAL-01 | UR-005, ASSUMPTION-12 | Copy places the exact path on the clipboard; tooltip explains blocked links. |
| FR-034 | As any user, I see Open, Closed and Overdue tabs sorted by deadline ascending; an overdue task also stays in Open; an Engineer sees only own tasks, the Admin all, a Lead all. | Must | R1 | GOAL-05 | UR-006, BR-002, BR-045 | Tab membership and order correct on seeded tasks; an Engineer cannot open another's task. |
| FR-035 | As a Lead, the queue opens filtered to "Assigned by me" and I can change it. [UNC-g, ASSUMPTION-32] | Should | R1+ | GOAL-05 | UR-007 | Default filter applied on opening. |
| FR-036 | As any user, I see overdue rows marked by colour, icon and the text "Overdue by X". | Must | R1 | GOAL-05 | UR-008, SPEC §11 | All three cues present on every overdue row. |
| FR-037 | As any user, I see a bell with the count of my relevant overdue tasks (Engineer own; Lead assigned by me; Admin all) that opens the Overdue tab; it stays visible on mobile. | Must | R1 | GOAL-05 | UR-009 | Counts correct per role; click opens Overdue. |
| FR-038 | As the business, a task closes when its estimate is approved and returns to Open when unlocked. [UNC-g, ASSUMPTION-34] | Must | R1 | GOAL-05 | BR-045 | Approve moves the task to Closed; unlock returns it to Open. |
| FR-039 | As Admin or Lead, I search and filter tasks by Engineer, customer and date. | Should | R1+ | GOAL-05 | UR-010 | Filters narrow the list. |
| FR-040 | As Admin or Lead, I reassign a task or change its deadline, logged; cancel is not provided. [UNC-g, ASSUMPTION-20, Q-20] | Should | R2 | GOAL-05 | ASSUMPTION-20 | Change logged with who, when, old → new. |
| FR-041 | As any user, I refer to a task or estimate by an ID in the form Q-<year>-<4-digit running number>. [UNC-g, ASSUMPTION-22, Q-22] | Should | R1 | GOAL-04 | ASSUMPTION-22, SPEC §10 | IDs are unique and appear on screens and in the export file name. |

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
| FR-049 | As an Engineer, I choose Surface Treatments in one multi-select (selected = 1, not selected = 0) and may select none. [UNC-g, ASSUMPTION-38] | Must | R1 | GOAL-03 | UR-019 | Eight flags Z to AG set correctly. |
| FR-050 | As an Engineer, I choose a Treatment / Color or "Other" and type free text. | Must | R1 | GOAL-04 | UR-020 | "Other" reveals a text box; the text is stored and exported. |
| FR-051 | As an Engineer, auto-filled fields (F) are read-only and shaded, and Material Rate (I) is absent from my screen and responses. | Must | R1 | GOAL-02 | UR-021 | F shown read-only; I never present (covered by FR-008). |
| FR-052 | As an Engineer, number inputs accept up to 2 decimals, no negatives, and show the decimal keyboard on phones. [UNC-g, ASSUMPTION-37] | Must | R1 | GOAL-03 | BR-009, NFR-012 (cat.) | A negative or 3-decimal entry is refused with a message. |
| FR-053 | As an Engineer, I save at any time including incomplete data, and I am warned before leaving with unsaved changes. | Must | R1 | GOAL-01 | UR-022 | A draft saves with blanks; the warning appears. |
| FR-054 | As an Engineer, my draft saves automatically every 30 seconds. [UNC-g, ASSUMPTION-42] | Should | R1+ | GOAL-01 | UR-022 | Edit, wait 30 s, reload: the edit is present. |
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
| FR-063 | As Lead or Admin, I unlock an approved estimate with a reason; I see a notice if the configuration changed since approval; recalculating afterwards uses the current master values and the notice also says if rates changed. [UNC-c, ASSUMPTION-35] | Must | R1 | GOAL-06 | UR-029, BR-012 | Unlock logged with reason; notices shown. The master-value rule is a working assumption (SPEC §8.4 is silent). |
| FR-064 | As the business, the status runs DRAFT → SUBMITTED → APPROVED → unlock → DRAFT; the Engineer's inputs are read-only once SUBMITTED; there is no return-to-Engineer action. [UNC-g, ASSUMPTION-19, Q-19] | Must | R1 | GOAL-06 | BR-006, ASSUMPTION-19 | Engineer edit refused after SUBMITTED; Lead and Admin can edit and recalculate. |
| FR-065 | As the business, an approved estimate keeps the fields, formulas, rates, master values and results it was approved with, whatever changes later (confirmed, AQP-8). | Must | R1 | GOAL-06 | BRQ-008, D-07, SPEC §8.4 | After approval, change a process rate, a material price and an exchange rate: the approved estimate's screen and export are identical. |

### 4.7 Excel export (EPIC-07)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-066 | As Lead or Admin, I download an .xlsx that replicates the worksheet: header row 1, columns A to BO in order, same widths, all cells centred horizontally and vertically, ₹ / $ / € formats. | Must | R1 | GOAL-04 | UR-030, BRQ-005, SPEC §10 | SPEC §14.12 checklist passes. |
| FR-067 | As Lead or Admin, the export has one row per tree node in depth-first order, Sl. No as text, and the part image embedded in column C scaled to fit. | Must | R1 | GOAL-04 | SPEC §10 | Order 1, 1.1, 1.1.1, 1.1.2, 1.2 …; "1.10" keeps its zero; image visible. |
| FR-068 | As Lead or Admin, every column is exported, including cost lines hidden on screen (as 0) and hidden Fasteners fields (0); a divide-by-zero cell is empty. | Must | R1 | GOAL-04 | SPEC §10, BR-024, BR-026 | Cell-by-cell check on a seeded estimate. |
| FR-069 | As Lead or Admin, BL2, BN2 and BO2 are populated once, in row 2; no per-item totals and no separate Tool Cost total column. [UNC-a, Q-31, ASSUMPTION-47] | Must | R1 | GOAL-04 | BR-023, SPEC §10 | BL2 and BO2 populated (SPEC §14.12). If the delivery lead asks for per-item totals as in the sample, this FR changes. |
| FR-070 | As the business, Lead and Admin can download at any status; Engineers cannot. [UNC-g, ASSUMPTION-36] | Must | R1 | GOAL-02 | UR-030, ASSUMPTION-36 | An Engineer request for the export is refused. |
| FR-071 | As Lead or Admin, the file is named Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx. [UNC-g, ASSUMPTION-44] | Should | R1 | GOAL-04 | ASSUMPTION-44 | File name matches the pattern. |

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
| FR-089 | As the business, every page has a title, meta description and Open Graph title and description with generic wording; pages behind sign-in are marked "do not index". [UNC-g, Q-17] | Must | R1 | GOAL-07 | NFR-020 (cat.), SPEC §17.6 | Tag check passes on every route (NFR-022). |
| FR-090 | As any user, I can choose light or dark mode. [UNC-g, ASSUMPTION-43] | Could | R3 | GOAL-07 | NFR-015 (cat.) | Both modes meet NFR-018. |
| FR-091 | As Accucut IT, I install the system with Docker Compose (app, worker, database), an `.env.example`, and a README with daily-backup guidance and restore steps. | Must | R1 | GOAL-01 | TR-008, SPEC §2, §12 | Following the README on a clean machine yields a running system; a restore is rehearsed once (NFR-013). |

### 4.11 Excluded or later (Won't in Release 1)
| ID | Requirement | Pri | Rel | Goal | Source | Fit criterion |
|----|-------------|-----|-----|------|--------|---------------|
| FR-092 | Offline use: the portal runs locally without internet. [UNC-e, Q-18] Conflict: requested in AQP-11 (his words), deferred in comment 10415. | Won't | - | - | BRQ-014 | No offline function in Release 1. Decision needed at G2. |
| FR-093 | Show a drawing beside the form and read data from drawings. | Won't | - | - | UR-042, DEC-04 | Absent; room reserved by FR-087. |
| FR-094 | "Copy from part" and "Apply to selected" actions (rejected). | Won't | - | - | UR-041, DEC-03 | Absent. |
| FR-095 | "Not needed for this part" switch; the Engineer enters 0 (FR-056). Formal closure of Q-15. [UNC-f] | Won't | - | - | DEC-05, SPEC §15 item 7 | Absent. |
| FR-096 | Import of past Excel estimates. [UNC-g, ASSUMPTION-25, TR-006] | Won't | - | - | TR-006 | Absent. |
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
| NFR-011 | Capacity | Supports fewer than 50 users and 500 nodes per estimate (ASSUMPTION-24, UNC-g). Growth is not stated; PROPOSED headroom 2 × users without change | 50 named users, 25 concurrent; 500 nodes | Load test at the stated numbers |
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
| NFR-028 | Privacy and compliance | Personal data limited to user name and e-mail and customer business contact details; no deletion or retention rule in Release 1 until Q-26 is answered (ASSUMPTION-26, UNC-g); legal adviser to confirm DPDP Act 2023 applicability (not verified) | 0 real personal data in tests (NFR-006) | Repository scan; Q-26 answer |
| NFR-029 | Localisation (language) | English only | 1 language | Inspection |
| NFR-030 | Deployability | Single `docker compose up` after copying `.env.example`; every environment variable listed. PROPOSED: a clean machine reaches a working sign-in page within 30 minutes by the README | ≤ 30 min | Timed walk-through by someone who did not write the README |

## 6. Scope

**Proposal, not agreed.** "MVP" here means Release 1. Contents and reasoning are in `docs/02-product/release-plan.md`. The delivery lead answers Q-29 (AQP-12).

| Release | Must | Should | Could | Won't (this release) |
|---------|------|--------|-------|----------------------|
| **Release 1 (MVP, proposal): assign, enter, calculate, approve, export** | FR-001, 002, 004, 005, 007 to 013, 015 to 017, 020 to 029, 031 to 034, 036 to 038, 042 to 053, 055, 056, 058 to 070, 085 to 087, 089, 091 (63 FRs) | Core: FR-041, 071. Stretch (R1+): FR-014 (a Must pulled in only if time allows), 035, 039, 054, 057, 088 | none | FR-003, 006, 019, 040, 072 to 084 (Release 2); FR-090, 097 (Release 3); FR-092 to 096 (not planned) |
| Release 1 conditional (R1\*) | FR-030 (Must): only if UNC-d is confirmed | FR-018: only if UNC-b is confirmed | - | - |
| Release 2: Admin control and alerts | FR-019, 072 to 084 (14 FRs) | FR-003, 006, 040 | - | - |

| Release 3: later | - | - | FR-090, 097 | Offline use, drawings only if the delivery lead schedules them |

NFRs apply to the release that delivers the behaviour they measure; NFR-004 and NFR-014 apply from Release 2.

### 6.1 Justification of each Must group in Release 1 ("what happens if we don't build it?")

| Group | If not built |
|-------|--------------|
| Sign-in, users, one Admin, role enforcement (FR-001 to 011) | No one can use the system safely; Engineers could reach costs (GOAL-02 fails) |
| Masters (FR-012, 013, 015 to 017) | Nothing can be calculated: rates, materials, exchange rates and customers feed every formula |
| Registry, engine, calculation, records (FR-020 to 029, 031) | No quote; GOAL-03 cannot be tested |
| Tasks and queues (FR-032 to 034, 036 to 038) | No assignment and no bell: late work stays invisible (GOAL-05) |
| Workspace (FR-042 to 053, 055, 056) | Engineers cannot enter data |
| Cost review and approval (FR-058 to 065) | No approved price: GOAL-01 and GOAL-06 fail |
| Export (FR-066 to 070) | The delivery lead stated the export is needed (AQP-4); GOAL-04 fails |
| Responsive, brand, tags, deployment (FR-085 to 087, 089, 091) | Not usable on the shop floor; not installable; SPEC MUST items unmet |

Release 2 Musts are deferred, not dropped. If FR-072 to 080 are not built in Release 1, the Admin cannot change the worksheet without a developer (BRQ-006 unmet until Release 2) and a developer changes the seed configuration in the meantime. If FR-081 to 084 are not built, late work is visible only in the portal.

### 6.2 Counts (checked by script against section 4)

| Release | Must | Should | Could | Won't | Total |
|---------|------|--------|-------|-------|-------|
| R1 core | 63 | 2 | 0 | 0 | 65 |
| R1+ stretch | 1 | 5 | 0 | 0 | 6 |
| R1\* conditional | 1 | 1 | 0 | 0 | 2 |
| R2 | 14 | 3 | 0 | 0 | 17 |
| R3 | 0 | 0 | 2 | 0 | 2 |
| Not planned | 0 | 0 | 0 | 5 | 5 |
| **Total** | 79 | 11 | 2 | 5 | 97 |

**The "Must at most about 60 % of MVP effort" rule is not met by this proposal.** The Release 1 core is estimated at 43 to 62 hours against about 47 to 59 development hours available (release plan, section 3), so Musts take about 99 % of the development capacity at the midpoint (73 to 132 % across the ranges). The core cannot be made smaller without losing a step of the primary outcome (assign, enter, calculate, approve, export). This is a deviation for `master` and the delivery lead to weigh, not a hidden one; the release plan shows the cut order if the estimate proves optimistic.

## 7. Epics (outline — detailed by product-owner)

Size: S ≤ 4 h, M 4 to 8 h, L 8 to 12 h, XL over 12 h (estimate; development, three reviews and QA included, human merge wait excluded). Hours are estimates, not measurements.

| Epic | Goal / user value | FRs | Release | Rough size (estimate) | Dependencies |
|------|-------------------|-----|---------|-----------------------|--------------|
| EPIC-01 Foundation, access and confidentiality | People sign in and only reach what their role allows; Engineers never see cost | FR-001, 002, 004, 005, 007 to 011 (FR-003, 006 in Release 2) | R1 | M, 4 to 6 h | None |
| EPIC-02 Masters and settings | The Admin holds the rates and lists that drive every calculation | FR-012, 013, 015, 016, 017 core; FR-014, 018 stretch or conditional; FR-019 in EPIC-09 | R1 | M, 4 to 6 h core; +2.5 to 4 h stretch | EPIC-01 |
| EPIC-03 Field registry and calculation engine | The portal calculates as the worksheet does | FR-020 to 029, 031; FR-030 conditional | R1 | L, 7 to 10 h; FR-030 adds 2 to 3 h | EPIC-01 |
| EPIC-04 Task assignment and queues | Work is assigned, tracked and late work is visible | FR-032 to 034, 036 to 038, 041 core; FR-035, 039 stretch; FR-040 R2 | R1 | S to M, 3 to 5 h core; +1.5 to 2.5 h stretch | EPIC-01 |
| EPIC-05 Estimate workspace | Engineers enter a product tree quickly with no cost shown | FR-042 to 053, 055, 056 core; FR-054, 057 stretch | R1 | XL, 10 to 14 h core; +1.5 to 2.5 h stretch | EPIC-02, 03, 04 |
| EPIC-06 Cost review and approval | Leads check the arithmetic, set the price and lock it | FR-058 to 065 | R1 | M, 5 to 7 h | EPIC-03, 05 |
| EPIC-07 Excel export | The estimate leaves in the worksheet's layout | FR-066 to 071 | R1 | M, 5 to 7 h | EPIC-05, 06 |
| EPIC-10 Experience, brand and delivery | Usable on every screen, branded, installable, tested | FR-085 to 087, 089, 091 core; FR-088 stretch; FR-090 R3 | R1 | M, 5 to 7 h core; +1 to 1.5 h stretch | Runs alongside all epics |
| EPIC-08 Admin configuration | The Admin changes fields and formulas without a developer | FR-072 to 080 | R2 | XL, 12 to 16 h | EPIC-03; Release 1 live |
| EPIC-09 E-mail alerts and scheduled jobs | Late work reaches people by e-mail | FR-003, 019, 081 to 084; FR-006, 040 with EPIC-01 and 04 | R2 | M, 6 to 8 h (+1.5 to 2.5 h for FR-006, 040) | EPIC-04; SMTP details (Q-18) |
| EPIC-11 Later | Dark mode, UI-sample extras; offline and drawings only if scheduled | FR-090, 097 (FR-092, 093 excluded) | R3 | Not estimated | Release 2 live |

## 8. Prioritisation Rationale

RICE needs reach, impact and confidence data that do not exist here (all three roles use every flow; no usage data). The product manager scores **value** (1 to 5, contribution to the primary outcome: estimates assigned, entered, calculated, approved and exported with no cost shown to Engineers) against **effort** (midpoint of the estimate range). Dependencies override the ratio.

| Epic | Value (1 to 5) | Effort, midpoint (h) | Value / effort | Order set by |
|------|----------------|----------------------|----------------|--------------|
| EPIC-01 | 5 | 5 | 1.00 | Prerequisite for all |
| EPIC-02 | 4 | 5 | 0.80 | Needed before calculation can be tried |
| EPIC-03 | 5 | 8.5 | 0.59 | Needed before workspace and approval |
| EPIC-04 | 4 | 4 | 1.00 | Creates the estimate the workspace opens |
| EPIC-05 | 5 | 12 | 0.42 | Largest; the primary user flow |
| EPIC-06 | 5 | 6 | 0.83 | Delivers the approved price |
| EPIC-07 | 4 | 6 | 0.67 | Stated need (AQP-4) |
| EPIC-10 | 4 | 6 | 0.67 | Cross-cutting; runs alongside |
| EPIC-09 | 3 | 7 | 0.43 | Needs SMTP details that do not exist yet; the bell covers late work in the portal |
| EPIC-08 | 3 | 14 | 0.21 | Seeded configuration covers today's worksheet; changes are infrequent (estimate) |

Release 2 order: EPIC-09 before EPIC-08 on value/effort, but EPIC-08 closes a SPEC MUST (BRQ-006); the delivery lead may reverse the order. The scores are judgement and are open to challenge.

## 9. Assumptions, Constraints, Dependencies

### 9.1 Labelled assumptions: what changes if each is rejected (G1 condition 6)

None of these is a decision. The status rule of SPEC §18 applies: the SPEC text stays in force until the delivery lead confirms in his own words.

| ID | Assumption carried | FRs written on it | If rejected | If confirmed |
|----|--------------------|-------------------|-------------|--------------|
| UNC-a | BN = BL / total of all Tool Cost entries (Q-05) | FR-025, FR-069 (written on the SPEC rule; the proposal is noted) | No FR text changes, but **the SPEC rule is not complete**: the Engineer enters Tool Cost on every part (confirmed), so "the row-2 value" is the first node's entry and is likely 0 for an assembly, giving "—" always. A replacement rule is needed (issue for the business analyst) | FR-025 divisor changes; FR-069 unchanged in position |
| UNC-b | "Not applicable" in the Material and Treatment lists (Q-06, Q-33) | FR-018 (R1\*); notes in FR-056 | FR-018 withdrawn. Engineers complete E and G on a parent with a real list value; with all dimensions 0 the material cost is 0 (analysis from BR-015 and BR-016, to be verified by test). Finding F-08 stays open | FR-018 built; Q-33 values settle |
| UNC-c | After unlock, recalculation uses current master values with a notice (Q-07) | FR-063 | FR-063 follows the replacement rule he gives (for example keep original values); FR-031 and FR-065 unchanged | FR-063 as written |
| UNC-d | A child's cost is multiplied by its parent's quantity (Q-08) | FR-030 (R1\*); oracle wording in FR-024 and in the GOAL-03 metric | FR-030 withdrawn; SPEC §7.4 and the worksheet stay the oracle; Q-32 (a), (b), (d) fall away, (c) remains in part; FR-029 and the totals unchanged when parent inputs are 0 | FR-030 built (+2 to 3 h); FR-024 oracle, the parallel run, the test plan and FR-067 parent rows compare against a worksheet calculated the same way; BRQ-004 wording changes |
| UNC-e / Q-18 | Release 1 is internet-hosted; offline use is a later release | FR-092 (Won't); NFR-012, NFR-019, NFR-030; FR-091 | Offline enters Release 1: new epic, architecture and data-storage changes, and a local copy would hold rates (conflicts with BRQ-002). **Release 1 cannot then fit 10 working days** | FR-092 stays Won't; hosting details settle at G3 |
| UNC-f | Q-15 closed: no "Not needed" switch | FR-095 (Won't), FR-056 | Switch returns as a Could in EPIC-05; FR-056 stays valid | No change |
| UNC-g | Keep the stated assumptions for Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | FR-003, 004, 006, 022, 026, 028, 033, 035, 038, 040, 041, 049, 052, 054, 063 (reason), 064, 070, 071, 089, 090, 096 | Only the FR for the rejected item changes, one by one; Q-10 export details change FR-066 to 069; Q-11 changes the BC formula in FR-024; Q-13 changes FR-055 | No change |
| UNC-h | End date 2026-11-13, Monday to Friday week | None | The release plan's capacity (10 days × 8 h = 80 h) rescales; no FR changes | Plan stands |
| Q-29 / ASSUMPTION-45 | The date is the Release 1 delivery date (option a); go-live, training and parallel run follow | None (release split only) | Option (b), production go-live by the date, adds master-data entry, user creation, training and the parallel run (TR-003 to TR-005) to the window and shrinks Release 1 further; option (c) matches the proposal | Proposal stands |
| Q-32 | (a) multiplication through every level; (b) a parent's displayed cost includes its own quantity; (c) non-zero cost inputs on a parent are stored but not counted; (d) the new rule applies and the parallel run compares the same way | FR-030, FR-029, FR-024 oracle, FR-067 | Each item settles one detail of FR-030; if UNC-d is rejected see UNC-d. (c) matters even then: under SPEC §7.4 a non-zero value on a parent is counted | As written |

### 9.2 Constraints
- Stack (CONSTRAINT-01, 02, 03): `CLAUDE.md` §1 and SPEC §2; no `eval`; IST display, UTC storage.
- Exactly one active Admin (CONSTRAINT-04). Logo 200 × 200 px until replaced (CONSTRAINT-05). Part images under 200 KB (CONSTRAINT-08).
- Governance (CONSTRAINT-06): human approval at G1, G3, G8; code pull requests merged by a human; stop for master data defaults after G3 approval and before development (TR-009, held in `docs/project-state.md` HOLD-01).
- Budget: no limit (confirmed, AQP-2). Start 2026-11-02 and 10 working days at 8 hours a day (confirmed). End date 2026-11-13 unconfirmed (UNC-h). The 10-day length is not assumed to pause at human gates (OQ-PM-01).

### 9.3 Dependencies and transition work
| Dependency | Needed for | Owner | Status |
|------------|-----------|-------|--------|
| Delivery lead's reply to G1 conditions 1 to 3 | G2, then UX and architecture | Santhosh | Open |
| Master data defaults (TR-002, TR-009) | Meaningful tests and go-live | Santhosh | Stop after G3 approval; invented placeholders until then (NFR-006) |
| Cleaned sample worksheet at `docs/reference/sample-estimate.xlsx` (TR-007, Q-30) | FR-020, FR-066 to 069 | Santhosh | Open; structure read from the original on his machine |
| E-mail (SMTP) service and sender (Q-18) | FR-003, 019, 081 to 084 (Release 2) | Accucut IT | Open |
| Hosting, web address, backups, IT contact (Q-18) | FR-091, NFR-012, NFR-013 | Accucut IT | Open; details due G3 |
| Docs pull request (BLK-01, 403) | G4 merge, then story branches | Santhosh | Open |
| First users (TR-003); training (TR-005); parallel run of real past estimates (TR-004, BRQ-013) | Go-live (Q-29 option b) | Santhosh / Accucut | Not in Release 1 under the proposal |
| Sharper logo (Q-16) | Brand | Santhosh | Assumption kept (UNC-g) |

## 10. Risks

P and I are Low, Medium or High. Register IDs are `docs/00-governance/risk-register.md`; "proposed" risks are for `master` to record.

| Risk | P | I | Mitigation | Owner |
|------|---|---|------------|-------|
| RISK-003: the full SPEC does not fit 10 working days; the minimum end-to-end slice alone is estimated at 8.0 to 11.9 days | High | High | Release 1 core with a cut order and two checkpoints (release plan); Q-29 | Santhosh |
| RISK-002: the quantity rule (UNC-d) differs from the worksheet when a parent's quantity is above 1 | Medium | High | Q-32 before G2; FR-030 built only on confirmation; SPEC §7.4 stays in force | Santhosh |
| RISK-001: assistant-drafted answers posted unedited | Medium | High | G1 condition 1 reply in his own words | Santhosh |
| RISK-004: offline use kept in Release 1 | Medium | High | Decision at G2 | Santhosh |
| RISK-005 / BLK-01: docs PR cannot be created | Medium | Medium | Fix token or open PR by hand | Santhosh |
| Proposed: effort estimates are not calibrated; no velocity exists | High | High | Recalibrate on the first completed epic (day 5 checkpoint, release plan) | product-manager, scrum-master |
| Proposed: one pull request per story needs a human merge each; merge latency adds elapsed time inside six development days | High | Medium | Product-owner and scrum-master size stories to limit PR count; delivery lead sets merge windows (process decision for `master`) | master, Santhosh |
| Proposed: Excel export size. 500 nodes with images up to 200 KB each could exceed 100 MB | Low | Medium | Architect sets a limit or an export strategy; NFR-010 is set on 50 nodes | solution-architect |
| Proposed: unverified working calendar; any holiday in 2 to 13 November reduces the 10 days | Medium | Medium | OQ-PM-02 | Santhosh |
| Proposed: parent non-zero cost inputs are counted under SPEC §7.4 (double count) and not counted under ASSUMPTION-48 | Medium | High | Q-32 (c) | Santhosh |

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
| Not planned | BRQ-014; UR-041, UR-042 | FR-092 to 096 | none |

Business rules map to FRs through the Source column of section 4 (BR-001 to BR-048 each appear at least once).

## 12. Open Questions

| ID | Question | Owner | Needed by |
|----|----------|-------|-----------|
| G1 condition 1 (a) to (h) | Delivery lead confirms or corrects UNC-a to UNC-h in his own words | Santhosh | G2 |
| Q-29 (AQP-12) | What 2026-11-13 delivers; whether the full SPEC fits (see release plan) | Santhosh | G2 |
| Q-32 (AQP-13) | Quantity roll-up details (a) to (d), or accept ASSUMPTION-48 | Santhosh | G2 |
| Q-18 (AQP-11) | Offline use in Release 1 (G2); hosting details (G3) | Santhosh | G2 / G3 |
| OQ-PM-01 | Does the 10-day clock keep running while a human gate waits (G3 review, master-data stop, code PR merges)? Plan assumes yes | Santhosh | G2 |
| OQ-PM-02 | Any Accucut or public holiday between 2026-11-02 and 2026-11-13? (not verified) | Santhosh | G2 |
| OQ-PM-03 | Availability target and support hours; PROPOSED 99.0 % monthly (NFR-012) | Santhosh, IT contact | G3 |
| OQ-PM-04 | Supported browsers and versions; PROPOSED set in NFR-019 | Santhosh | G3 |
| OQ-PM-05 | Largest realistic estimate with images, for the export limit (NFR-010) | Santhosh; solution-architect | G3 |
| Q-31, Q-33, Q-30 | Export totals, "Not applicable" row, cleaned sample | Santhosh | G3 |
| Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | Kept as UNC-g | Santhosh | G2 to G8 |

## 13. Change Log

| Version | Date | Change | Reason | Decision ref |
|---------|------|--------|--------|--------------|
| 0.1 | 2026-11-01 | First draft: FR-001 to 097, NFR-001 to 030, epics, assumptions register, release proposal | G2 input; G1 condition 6 | `docs/00-governance/gate-log.md` G1 |
