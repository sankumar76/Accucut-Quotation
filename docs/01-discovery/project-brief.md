# Project Brief — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.7 (Draft, G2 attempt 2, condition 2: Q-32 (a) shown as confirmation requested in their own words; Q-32 answered and ASSUMPTION-48 retired; repository decision recorded; Q-34 and ASSUMPTION-50 due at G3 approval, DL-004) |
| Author | business-analyst |
| Date | 2026-11-01 (Pass 1: 2026-10-31) |
| Status | G1 conditions 1 to 3 answered on 2026-11-01, partly in their own words and partly by confirming the orchestrator's list wording (items (a), (b), (c), (f), (g) of AQP-1 comment 10441: DL-001); UNC-a to UNC-h resolved (see section 8). Answered 2026-11-01: Q-32 (AQP-13 comments 10462, 10464; SPEC §18 D-12), with (a) accepted on list wording and their own-words confirmation requested (DL-006, due G3 approval). Open: Q-18 (hosting details, G3), Q-30, Q-31, Q-33, Q-34 (due G3 approval: DL-004). The master decides whether the conditions are met |
| Intake issue | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

## 1. Executive Summary
Accucut Lasers Pvt Ltd prepares manufacturing cost estimates (quotations) in an Excel worksheet with columns A to BO. The Admin, Leads and Engineers need a role-based web portal that does the same job: Admin or a Lead assigns the estimate to an Engineer, the Engineer enters part data without ever seeing a cost, the portal calculates every cost column from master data, a Lead or Admin approves and locks a price, and the result is exported to Excel in the worksheet's layout. The Admin must also be able to change fields and formulas in the portal, with Excel-style re-lettering and an audit trail. Why now: the sponsor has supplied a full requirements specification, a worksheet sample and a UI sample, and wants delivery to start. Budget: no limit. Start 2026-11-02; target 10 working days at 8 hours a day, ending 2026-11-13 (confirmed as a target, not a fixed constraint: it is the date to complete development and hand the version to their customer for testing and acceptance, and they ask for a realistic date, AQP-12 comment 10446; the scope behind that date is Q-34). Sources: SPEC §1, DOCX §1.

## 2. Problem Statement
- **Who is affected:** Admin (one), Leads (many) who assign and approve estimates, and Engineers (many) who prepare them (SPEC §3). Indirectly, Accucut's customers who receive the quoted price.
- **Current situation:** Estimates are prepared in one Excel worksheet with columns A to BO; one row per item, part or sub-part; formulas calculate the costs (SPEC §1; XLSX structure). The inputs do not describe how work is assigned, tracked or approved today (Q-28).
- **Pain / impact (inferred from the design of the requested solution, not evidenced):** a worksheet gives every holder of the file access to all rates and formulas, so an Engineer cannot be kept from seeing cost (the requirement "Engineers never see any cost" implies this); formulas, rates and material data are typed into cells (the sample worksheet hard-codes the rates in every formula); there is no assignment, deadline tracking, review step, lock or audit trail inside the file itself. None of this is quantified: no baseline for time, error rate or volume was provided (Q-24).
- **Evidence:** SPEC §1, §3, §8; DOCX §1; XLSX (formulas contain hard-coded constants; the second sheet holds three text labels only). No complaints, audit findings or metrics were supplied.

## 3. Business Objectives (SMART)
Baselines marked "not measured" are open until Q-24 and Q-28 are answered. No figure here is invented; targets come from the SPEC's acceptance criteria.

| ID | Objective | Metric | Baseline | Target | By when |
|----|-----------|--------|----------|--------|---------|
| GOAL-01 | Move estimation from the worksheet to the portal | Share of new estimation tasks created and approved in the portal after cut-over | 0 % (all work is in Excel; DOCX §1) | 100 % of new tasks | Development-complete target 2026-11-13, a target and not a fixed date (Q-01, Q-29 answered); a realistic date is requested (AQP-12); go-live follows the customer's testing and the parallel run, date open (Q-25) |
| GOAL-02 | Keep costs, rates and formulas hidden from Engineers | Cost, rate or formula values found in any Engineer page, API response or file in the automated test | Not applicable to a shared worksheet; no control exists (inferred) | 0 found, test run on every build | Before go-live (SPEC §14.1) |
| GOAL-03 | Calculate exactly as the worksheet does | Share of the SPEC §7.4 outputs matching a hand-calculated worksheet to 2 decimals on the acceptance tree (nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5). **Test oracle:** the worksheet, with the delivery lead's cost rule (BL = item quantity x the sum of BG over the item's rows, D-08). At item quantity 1 this equals the worksheet exactly (checked on the sample, SPEC §18.5). The roll-up details were answered on 2026-11-01 (Q-32, D-12; (a) own-words confirmation requested, DL-006): a parent's own cost counts (the children-only reading, 58.6 % lower on the sample, was rejected). The sample cannot test the quantity rules, so their oracle is a constructed example (SPEC §18.5) | Not applicable | 100 % | Before go-live (SPEC §14.2) |
| GOAL-04 | Export in the worksheet layout | Share of the export checks passed (A to BO layout, original widths, centre/middle alignment, currency formats, embedded images, BL2 and BO2 filled) | Not applicable | 100 % | Before go-live (SPEC §14.12) |
| GOAL-05 | Make late work visible and acted on | (a) Overdue e-mail sent within 5 minutes of a task becoming overdue when alerts are ON; (b) 11:00 AM IST digest sent every day when overdue tasks exist; (c) duplicates sent | Not measured; no tracking exists (inferred) | (a) 100 %, (b) 100 %, (c) 0 | Before go-live (SPEC §5.4, §14.11) |
| GOAL-06 | Control approved prices and configuration | (a) Approved estimates with an Approved Quote Price, approver and time recorded; (b) configuration, master, approval, unlock and price-override events logged with who, when and before → after | Not measured | (a) 100 %, (b) 100 % | Before go-live (SPEC §12) |
| GOAL-07 | Work on all screen sizes with a consistent professional design | Screens that work with no horizontal page scroll and every action reachable at 360, 768 and 1366 px; design-system review passed | Not applicable | 100 % of screens | Before go-live (SPEC §14.13, §17) |

Business outcome measures such as estimate turnaround time cannot be set until the baseline is provided (Q-24).

## 4. Stakeholders & Personas
Summary here; full detail in `stakeholder-map.md`.

| Stakeholder / Persona | Role | Primary need | Influence | Interest |
|-----------------------|------|--------------|-----------|----------|
| Santhosh - MD | Sponsor and delivery lead (one person; Q-02 answered) | A trusted quoting tool delivered to a date and budget | High | High |
| Admin (exactly one) | Owns masters, formulas, fields, users, settings | Change pricing rules safely without a developer | High | High |
| Lead (many) | Assigns, reviews, approves and locks estimates | Fast review and a defensible price | Medium | High |
| Engineer (many) | Enters part data | Quick, guided entry; clear tasks | Low | High |
| Accucut's customers | Receive quotes (not portal users) | Accurate, timely quotes | Low | Medium |
| Accucut IT contact (to be named) | Hosts and backs up the system | A deployable, supportable system | Medium | Medium |

## 5. Scope
**In scope** (sources in the catalogue)
- Sign-in, users and roles; exactly one Admin (UR-001 to UR-003).
- Masters: Process, Customer (with synchronisation rules), Material, Exchange Rate, Treatment/Color, and Settings (UR-031, UR-032, UR-037).
- Task assignment with network folder path and IST deadline; Open, Closed and Overdue queues; notification bell; e-mail alerts and a daily 11:00 AM IST digest (UR-004 to UR-011).
- Estimate workspace: customer choice, product tree to any depth, guided form with column letters, image attachment, conditional fields, validation, save and autosave, Calculate (UR-012 to UR-024, UR-040). One estimate holds one complete product (D-04). The Engineer enters Tool Cost with all other inputs (confirmed), and enters 0 for anything a part does not need (UR-043; confirmed). The Engineer also chooses "Not applicable" in the Material and Treatment lists (confirmed; its values: Q-33).
- Cost counting on the tree: the cost is the sum of the costs of all children multiplied by the item quantity (BR-046, BR-047; confirmed as corrected, AQP-9 comment 10442). The sample agrees at item quantity 1 (SPEC §18.5); roll-up details are answered (Q-32, D-12); (a), the quantity of a part in between, awaits their own-words confirmation (DL-006).
- Cost view with formulas for Lead and Admin; recalculate; approve and lock with Approved Quote Price; unlock (UR-025 to UR-029).
- Excel export that replicates the worksheet layout (UR-030, BRQ-005).
- Admin configuration of fields and formulas with re-lettering, configuration versions, checkpoints and change history (UR-033 to UR-036).
- Audit trail, server-side access control, and the design, brand, responsive, accessibility and SEO/Open Graph standards (NFR-001 to NFR-023).
- About page, version 1.0.

**Out of scope** (explicitly excluded)
- "Copy from part" and "Apply to selected" actions (DEC-03).
- A spreadsheet-style entry grid for Engineers (DEC-01).
- Reading data from drawings; no drawing file goes into the portal in this version (DEC-04).
- Engineers seeing or downloading any cost or export (BR-003, ASSUMPTION-36).
- The "Not needed for this part" switch: not built, the Engineer enters 0 instead (DEC-05, Q-06); Q-15 closed (confirmed, AQP-1 comment 10441 (f)).
- Offline use (running the portal locally without internet): the next release (confirmed, AQP-11 comment 10444 and AQP-1 comment 10441 (e)); not in Release 1 (BRQ-014, Q-18). Hosting details follow at G3.
- Import of past Excel estimates (ASSUMPTION-25, unless Q-25 changes it).
- Customer-facing quote documents, customer log-in, invoicing, ordering or ERP integration (not in any input).
- Estimate data in checkpoints (checkpoints cover configuration only; SPEC §8.3).

**Future consideration**
- Drawing display beside the form, then data reading from drawings (SPEC §17.5).
- A sharper logo original replaces the current file (Q-16).
- Offline use in the next release (confirmed; BRQ-014, Q-18).
- UI-sample ideas not in the SPEC (review-queue counts, global search, workload counts) for the product manager to rank (finding F-16).

## 6. Key Requirements Summary
Full list in `requirements-catalog.md`.
- Business: BRQ-001 (replace the worksheet), BRQ-002 (no cost to Engineers), BRQ-003 (review, approve, lock), BRQ-004 (matching calculations), BRQ-005 (Excel layout), BRQ-006 (Admin-configurable worksheet), BRQ-007 and BRQ-008 (audit, pinned approved estimates).
- User: UR-004 (assign), UR-013 and UR-014 (tree and numbering), UR-016 to UR-023 (guided entry and Calculate), UR-025 to UR-029 (review, approve, lock, unlock), UR-033 to UR-036 (formulas, fields, checkpoints).
- Rules: BR-003 (server-side hiding), BR-007 (Calculate validation), BR-015 to BR-023 (all calculations), BR-031 (master synchronisation), BR-035 (re-lettering), BR-046 to BR-048 (parent and child cost, zero entry; added in Pass 2, updated in Pass 3).
- Answers recorded in SPEC §18 (D-01 to D-11). Tool Cost entered by the Engineer, enter 0, approved estimates unaffected, master data at first use, the corrected cost rule, the offline decision and the date target are in their own words on Jira; the BN divisor, "Not applicable", recalculation with current rates, Q-15 closed and the kept assumptions are confirmed on the orchestrator's list wording (AQP-1 comment 10441, DL-001), not in their own words. The answers are: Tool Cost entered by the Engineer and BN = BL / total of all Tool Cost entries; 0 for parts that need nothing and "Not applicable" in the Material and Treatment lists; approved estimates unaffected by later changes, and recalculation after unlock with current rates and a notice; the cost of a parent = the sum of the costs of all children x the item quantity (corrected, AQP-9 comment 10442); master data entered at first use; Release 1 internet-hosted and offline use in the next release; the stated assumptions kept; 2026-11-13 a target, not a fixed constraint.
- Decided input (2026-10-31): guided form with column letters; "Red Leads" brand; "Copy from part" and "Apply to selected" rejected; drawing input deferred with room left for it (DEC-01 to DEC-04). Details are in the catalogue and already appear in SPEC §17.

## 7. Constraints
- CONSTRAINT-01 Technology stack (SPEC §2, `CLAUDE.md`).
- CONSTRAINT-02 No `eval` in the formula engine.
- CONSTRAINT-03 IST display and scheduling, UTC storage.
- CONSTRAINT-04 Exactly one active Admin.
- CONSTRAINT-05 Logo file is 200 × 200 px until replaced.
- CONSTRAINT-06 Human approval at G1, G3, G8; code PRs merged by a human.
- CONSTRAINT-07 Budget: no limit. Start 2026-11-02; target 10 working days at 8 hours a day, Monday to Friday, ending 2026-11-13. A target, not a fixed constraint (AQP-1 comment 10441 (h); AQP-12 comment 10446); a realistic completion date is requested. Scope behind the date: Q-34.
- CONSTRAINT-08 Part images below 200 KB.

## 8. Assumptions
**Status rule (same as SPEC §18):** an item is Confirmed when the delivery lead's own words on Jira support it (comment IDs shown), and Confirmed as corrected or qualified when they changed it first. A detail that is still unclear is not guessed: a question records it and a labelled assumption applies until they answer. **Provenance:** comment 10415 was an assistant recommendation adopted unedited; on 2026-11-01 they confirmed, corrected or qualified each of its items. In their own words: AQP-1 comment 10443, AQP-9 comment 10442, AQP-13 comment 10445, AQP-11 comment 10444, AQP-12 comment 10446, and the sentence that opens AQP-1 comment 10441. Items (a), (b), (c), (f) and (g) of comment 10441 repeat the orchestrator's list wording and are **confirmed on list wording**, not in their own words (DL-001). Register UNC-a to UNC-h: `requirements-questions.md` section 4.

The ones that most change the result are below.

| ID | Assumption | Impact if false | Validation owner |
|----|------------|-----------------|------------------|
| ASSUMPTION-18 | **Revised (D-10, confirmed):** Release 1 is internet-hosted; offline use is the next release. Hosting details (address, e-mail service, backups, who updates) stay an assumption until G3 (Q-18) | Security and delivery design change | Santhosh |
| ASSUMPTION-45 | **Replaced by answer (D-01):** 2026-11-13 is a target to complete development and hand the version to the customer for testing and acceptance; go-live, training and the parallel run follow later (Q-29 answered) | Release plan wrong | Santhosh |
| ASSUMPTION-47 | BL, BN and BO appear in row 2 only in the export, as in the SPEC, although the sample shows totals per top-level item (Q-31) | Export differs from the sample | Santhosh |
| ASSUMPTION-48 | **Retired 2026-11-01 (Q-32 closed; SPEC §18 D-12).** Rule now in force: BL = item quantity x the sum of BG over the item's own row and all descendant rows, column BG only; a parent's own cost counts and nothing typed on a parent is ignored, refused or warned about; the quantity multiplies once, at the top; the estimate's BL is the sum over its top-level items. Equals the sample's stored total at item quantity 1 (SPEC §18.5). A parent's own cost counts: their own words (AQP-13 10464); the other points are confirmed on list wording (AQP-13 10462) | Wrong prices if the list-wording confirmation does not reflect their intent | Santhosh |
| ASSUMPTION-49 | System-created "Not applicable" Material and Treatment entries with all rates 0 (the option itself is confirmed; the values are Q-33) | Cost on a part that has none | Santhosh |
| ASSUMPTION-50 | The product manager gives a realistic development completion date for both the full SPEC and the first-release proposal; the delivery lead chooses by G3 approval (DL-004; Q-34) | Wrong scope behind the date | Santhosh |
| ASSUMPTION-17 | Meta and Open Graph tags on all pages with generic text; authenticated pages "do not index" (kept) | Leakage or rework | Santhosh |
| ASSUMPTION-21 | All SPEC `[DEFAULT]` items stand (kept; confirmed on list wording, AQP-1 comment 10441 (g)) | Policy changes | Santhosh |

Resolved by the delivery lead (no longer assumptions to validate; 05 BN divisor, 06 "Not applicable", 07 recalculation and 15 are confirmed on the orchestrator's list wording, the others in their own words): ASSUMPTION-02 (one person, D-02), 03 (sample file, D-03), 04 (one product per estimate, D-04), 05 (Engineer enters Tool Cost; BN divisor, D-05), 06 (enter 0; "Not applicable", D-06), 07 (approved estimates unaffected; recalculation with current rates, D-07), 08 (cost rule, D-08, corrected), 48 (roll-up details, D-12, retired), 09 (master data entered at first use, D-09), 15 (switch not built, D-06), 01 and 45 (start date, 10 working days and the 2026-11-13 target, D-01), and the Release 1 hosting half of 18 (D-10). Still labelled assumptions: 49 (Q-33), 50 (Q-34), the hosting details in 18 (Q-18, G3), and the others kept by their confirmation (UNC-g). The full list (ASSUMPTION-01 to 50) is in the catalogue.

## 9. Dependencies
| Dependency | Type (internal/3rd party/data) | Owner | Status |
|------------|-------------------------------|-------|--------|
| Cleaned sample worksheet at `docs/reference/sample-estimate.xlsx`; blank template if any | Data | Santhosh | Open (Q-30); the sample itself is confirmed (Q-03) |
| Master data defaults (process rates, materials, exchange rates, customers, treatments, users) | Data | Santhosh | Delivery lead to provide when asked after G3 approval and before development starts (Q-09 answered); the Admin enters values at first use |
| E-mail (SMTP) service and sender address | 3rd party | Accucut IT | Open (Q-18) |
| Hosting, web address and internet access (offline use is the next release) | Internal / 3rd party | Accucut IT | Open (Q-18) |
| Answers to Q-18 (hosting details, G3) and Q-34 (scope behind the date, G3 approval, DL-004); Q-32 (a) in their own words (G3 approval, DL-006) | Internal | Santhosh | Open |
| Sharper logo original | Data | Santhosh | Open (Q-16, assumption kept) |
| Engineers and Leads available for the process walk-through and parallel run | Internal | Santhosh | Open (Q-25, Q-28) |

## 10. Business Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| The roll-up details of the cost rule were confirmed mostly against the assumption-list wording (AQP-13 comment 10462, not the delivery lead's own words) and differ from what they intend, giving wrong quotes | Low | High (wrong quotes) | Q-32 answered 2026-11-01 (D-12), with (a) in their own words requested (DL-006, due G3 approval); a parent's own cost counts in their own words (AQP-13 10464); a constructed example with quantities above 1 at and below the item and two top-level items is in the test plan (SPEC §18.5), because the sample cannot test the quantity rules; the delivery lead can change any point later |
| The export does not match the sample because the sample shows per-item totals and the answer is one total per estimate | Medium | Medium | Q-31 before G3 |
| Cost leaks to an Engineer through an API, page or export | Low | High | Server-side filtering and automated test (BR-003, GOAL-02) |
| Master or rate changes alter approved prices | Low (rule decided, D-07) | High | Record of master values at each calculation (DR-003) |
| Starting master data is late or wrong; the stop to ask for defaults after G3 uses calendar time in a 10-day plan | Medium | High | TR-009 stop point; placeholders in the meantime; parallel run (TR-004) |
| Export does not match the sample in Excel (headers, formats, subtotal row) | Medium | Medium | Q-03, Q-10; compare file to sample |
| Single Admin is absent or leaves | Medium | Medium | Hand-over step (Q-23) |
| Engineers cannot Calculate on assembly parents | Low (answered: enter 0, "Not applicable") | Low | UR-043; Q-33 for the Material row values |
| Brand red and status colours are confused; red on white barely meets contrast | Medium | Medium | Q-27; contrast checks (NFR-018) |
| Browsers block network-folder links | High | Low | Copy-path button (SPEC §5.1) |
| Development is not complete by the target date 2026-11-13 (the full SPEC may not fit 10 working days with three human gates and the master data stop) | High | Medium (they treat the date as a target and not a blocker, AQP-12) | The product manager supplies a realistic completion date (Q-29 answered; scope: Q-34). The analyst makes no effort estimate |
| Internet hosting exposes the sign-in page; network-folder paths cannot be opened from outside the office; offline use is deferred to the next release | Medium | Medium | Q-18: hosting details at G3; server-side security (NFR-001, NFR-002); Copy path button (Q-12) |
| The sample worksheet is in a public repository and turns out to hold real customer or price data | Not assessed by the analyst. The delivery lead decided to keep the repository public (AQP-1 comment 10465) and states the workbook has no real data and the formulas are not self-explanatory; their statement, not verified | High only if the statement is wrong | No sample cell values are copied into documents (NFR-023, ASSUMPTION-46); structure only; the delivery lead can change the rule or the visibility at any time; the register entry RISK-006 is the master's (Q-03, Q-30) |

## 11. Compliance & Regulatory Considerations
Assessed from general knowledge; no web research was done, so none of this has been verified against current law. The company's legal adviser should confirm (Q-26).
- **Personal data:** the portal holds user names and e-mails and customer contact details (name, phone, e-mail, address). India's Digital Personal Data Protection Act, 2023 and the IT Act 2000 rules may apply. Measures already in the SPEC: role-based access, password hashing, audit log. Retention period and policy are open (Q-26).
- **GDPR:** EUR pricing suggests EU customers, but only business contact data is held; considered unlikely to apply. Confirm in Q-26.
- **Internet exposure (new in Pass 2):** if Release 1 is hosted on the internet (ASSUMPTION-18, confirmed in part: D-10), the sign-in page is reachable by anyone and login protection, encrypted connections and "do not index" settings matter more. No new law was identified; the security requirements (NFR-001, NFR-002, NFR-020) apply.
- **Commercial confidentiality:** rates, prices and formulas are commercially sensitive; this is treated as a business requirement (BRQ-002), not a regulation.
- **Customer data in test material:** the delivery lead states that the sample worksheet has no real data (AQP-1 comment 10465; their statement, not verified by the analyst). The rule stays: sample cell values must not be copied into artefacts, Jira, GitHub, tests or fixtures (NFR-023) unless the delivery lead changes it.
- **Accessibility:** WCAG 2.1 AA is an SPEC requirement, not a legal finding.
- **Tax (GST) and e-invoicing:** not in any input; no requirement identified.
- No sector regulation (for example PCI-DSS, HIPAA, SOX) was identified from the inputs.

## 12. Open Questions
Blocking questions are in bold and each has its own Jira issue. The full text, the assumption used and the answer line for every question are in `requirements-questions.md`.

| ID | Question | Owner | Needed by | Status |
|----|----------|-------|-----------|--------|
| Q-01 to Q-09 | Budget and date, one person, sample, one product, Tool Cost, zero entry, approved estimates, parent and child cost, master data | Santhosh | G2 to G4 | Q-01, Q-02, Q-04 to Q-09 **Answered** (Q-08 details closed in Q-32); Q-03 answered in part (remainder Q-30); answers in SPEC §18 |
| Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | Export details, Rejection (BC), folder links, Remarks, Plating flag, logo, SEO, workflow gaps, `[DEFAULT]` confirmation, IDs, succession, baseline, cut-over, retention, colours, as-is walk-through | Santhosh | G2 to G8 | Assumption kept (confirmed on list wording, AQP-1 comment 10441 (g)) |
| Q-15 | "Not needed" switch | Santhosh | G3 | Closed: not needed (confirmed, AQP-1 comment 10441 (f)) |
| **Q-18** | Hosting and access | Santhosh | Hosting details G3 | **Offline decided** (next release); hosting details open (AQP-11) |
| Q-29 | What 2026-11-13 delivers | Santhosh | G2 | **Answered** (AQP-12 comment 10446): a target to complete development and hand over for testing and acceptance |
| Q-30 | Cleaned sample copy; blank template | Santhosh | G3 | Open in part; repository decision recorded (AQP-1 comment 10465); cleaned copy and blank template still asked |
| Q-31 | Sample shows totals per top-level item; answer is one total | Santhosh | G3 | New, open |
| Q-32 | Roll-up details left after the corrected cost rule | Santhosh | (a), (b) G2; (c) to (e) G3 (DL-005) | **Answered 2026-11-01** (AQP-13 comments 10462, 10464); rule in SPEC §18 D-12. **(a): own-words confirmation requested (DL-006), due G3 approval** |
| Q-33 | Values and handling of the "Not applicable" Material row | Santhosh | G3 | Open |
| Q-34 | Which scope the realistic development completion date covers | Santhosh / product-manager | G3 approval (DL-004) | New, open |

**Findings from comparing the SPEC, the Draft v5 document, the sample worksheet and the UI sample** (F-01 to F-21) are in `requirements-questions.md` section 3. Findings F-22 to F-25 were added in Pass 2. The most important: the sample has two top-level items each with its own total, while the answer is one total per estimate (F-01, F-22); the delivery lead's corrected cost rule agrees with the worksheet at item quantity 1 and its roll-up details are answered, (a) awaiting their own-words confirmation (F-23, SPEC §18.5, Q-32); the two hosting answers conflicted and are resolved for Release 1 (F-24); SPEC §17 already holds the 2026-10-31 decisions (F-20).

## 13. Glossary
| Term | Definition |
|------|------------|
| Estimate / quotation | The cost calculation for one product, held as a tree of nodes. |
| Product, item, part, sub-part | Levels of the tree; all share the same fields. |
| Node (row) | One row of the worksheet; one node of the tree. |
| QTY per Assy (H) | **Definition pending.** The column is named in SPEC §7.1, but what the number counts for a part under a part is not defined; their own words are requested (Q-32 (a), DL-006) and the definition is added after the reply. |
| Sl. No (A) | Automatic number from the tree position: 1, 1.1, 1.1.1 … |
| Column letter | Excel-style identifier (A, B … AA …) of a field, derived from its position. |
| Input field | A field an Engineer, Lead or Admin types or selects. |
| Auto field | A field filled from a master (for example Material Considered). |
| Output (calculated) field | A field the system calculates; hidden from Engineers. |
| Process Master | List of default named rates (for example Cutting-Rate-per-Sec, OH Profit %). |
| Customer Master | Customers with contact details and one value for each Process Master rate. |
| Material Master | Table mapping Material in Drawing to Material-Considered, price per kg, specific gravity and scrap rate. |
| Exchange Rate Master | 1 USD in INR and 1 EUR in INR. |
| Treatment / Color list | Options for column G, plus "Other" with free text. |
| Override (manual) | A customer rate that differs from the previous Process Master default. |
| Task | An assignment of an estimate to an Engineer with a folder path and a deadline. |
| Queue (Open / Closed / Overdue) | Task lists by state; an overdue task stays in Open. |
| Overdue | An open task past its deadline (IST). |
| Calculate | Engineer action that checks inputs, calculates costs and submits for review. |
| Recalculate | Lead/Admin action that recalculates after changes. |
| Approve & Lock | Lead/Admin action that records the Approved Quote Price and makes inputs read-only. |
| Unlock | Lead/Admin action that reopens an approved estimate. |
| Approved Quote Price (BO) | Final price set by Lead/Admin at approval (formerly "Final-Final Estimate"). |
| Unit Production Price (BG) | A node's price in INR before totalling. |
| Total Unit Production Price (BL) | Total cost of the estimate. For each top-level item: the item quantity x the sum of BG over the item's own row and all its descendant rows (D-08, confirmed as corrected); the estimate's BL is the sum over its top-level items (D-12). |
| Tool Cost (BM) | Cost of tooling, entered by the Engineer on each part (0 where none). BN divides BL by the total of all Tool Cost entries (D-05, confirmed). |
| Parent / child node | A node with parts below it is a parent; the parts directly below it are its children. The cost of a parent is built from the costs of all its children (grandchildren and deeper included), multiplied by the item quantity at the top (confirmed, AQP-9 comment 10442). |
| Not applicable | A list option in Material in Drawing and Treatment / Color for a part that needs none, used with 0 in number fields (confirmed, D-06). |
| Field registry | The list of fields, sections and formulas that defines the worksheet. |
| Formula engine | The part of the portal that reads and calculates formulas safely. |
| ConfigVersion | An unchangeable snapshot of the field and formula configuration. |
| Checkpoint | A named ConfigVersion the Admin can revert to. |
| Re-lettering | Automatic shifting of column letters when a field is inserted or deleted. |
| Step-up authentication | Asking the Admin for their password again before a sensitive change. |
| IST | Indian Standard Time (Asia/Kolkata). |
| UTC | Coordinated Universal Time; used for storing times. |
| MoSCoW | Must, Should, Could, Won't (priority scale). |
| SEO | Search-engine optimisation: page titles and descriptions that help search engines. |
| Open Graph | Page tags that set the title and description shown when a link is shared on social media or chat. |
| Red Leads | The chosen brand direction: logo red for buttons and markers, white top bar, graphite side menu. |
| Guided form | One part at a time, section by section, with the parts tree beside it. |
| Gate (G0 to G8) | Quality checkpoints in the delivery process. |
| UNC-a to UNC-h | Identifiers for the eight items first proposed in AQP-1 comment 10415 or 10417 (an assistant draft) and confirmed, corrected or qualified by the delivery lead on 2026-11-01; register in `requirements-questions.md` section 4. |

## 14. Sources
- `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0 (SPEC), all sections including §15 and §17.
- `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx` (DOCX).
- `AMADA-20261006.xlsx` (XLSX): read for structure only (sheet layout, headers, formulas, widths, formats); no cell data is reproduced.
- `Accucut Quotation Portal UI-UX.html` (UI): design system and 14 screens, read for structure and behaviour; names in it are samples and are not used.
- `docs/project-state.md`, `docs/00-governance/gate-log.md` (G0 record and carry-forward items), `CLAUDE.md`.
- Delivery lead decisions of 2026-10-31 and standing website standards (from the delegation brief).
- Delivery lead answers on Jira AQP-1 and AQP-2 to AQP-11, 2026-10-31 (Pass 2), and their replies of 2026-11-01 (Pass 3): AQP-1 comments 10441 and 10443, AQP-9 comment 10442, AQP-13 comment 10445, AQP-11 comment 10444, AQP-12 comment 10446; register UNC-a to UNC-h in `requirements-questions.md` section 4.
- `AMADA-20261006.xlsx` was opened again in Pass 3 for the parent cost check (SPEC §18.5); formulas and totals only, no cell value is reproduced.
- `docs/00-governance/gate-log.md`, section G1 (2026-11-01): provenance findings and conditions 1, 4 and 5. The BA relied on the gate log and did not read any session log.
- No web sources were used.
