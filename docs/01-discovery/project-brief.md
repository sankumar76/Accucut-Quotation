# Project Brief — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.3 (Draft, Discovery Pass 2, G1 conditions 4 and 5 applied) |
| Author | business-analyst |
| Date | 2026-11-01 (Pass 1: 2026-10-31) |
| Status | G1 CONDITIONAL GO. Part of the delivery lead's answers is UNCONFIRMED (UNC-a to UNC-h, see section 8); Q-18 conflict and Q-29 to Q-33 open |
| Intake issue | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

## 1. Executive Summary
Accucut Lasers Pvt Ltd prepares manufacturing cost estimates (quotations) in an Excel worksheet with columns A to BO. The Admin, Leads and Engineers need a role-based web portal that does the same job: Admin or a Lead assigns the estimate to an Engineer, the Engineer enters part data without ever seeing a cost, the portal calculates every cost column from master data, a Lead or Admin approves and locks a price, and the result is exported to Excel in the worksheet's layout. The Admin must also be able to change fields and formulas in the portal, with Excel-style re-lettering and an audit trail. Why now: the sponsor has supplied a full requirements specification, a worksheet sample and a UI sample, and wants delivery to start. Budget: no limit. Start 2026-11-02; target 10 working days at 8 hours a day, ending 2026-11-13 (start date and 10 working days confirmed; the end date is UNCONFIRMED, UNC-h; what the date delivers is open, Q-29). Sources: SPEC §1, DOCX §1.

## 2. Problem Statement
- **Who is affected:** Admin (one), Leads (many) who assign and approve estimates, and Engineers (many) who prepare them (SPEC §3). Indirectly, Accucut's customers who receive the quoted price.
- **Current situation:** Estimates are prepared in one Excel worksheet with columns A to BO; one row per item, part or sub-part; formulas calculate the costs (SPEC §1; XLSX structure). The inputs do not describe how work is assigned, tracked or approved today (Q-28).
- **Pain / impact (inferred from the design of the requested solution, not evidenced):** a worksheet gives every holder of the file access to all rates and formulas, so an Engineer cannot be kept from seeing cost (the requirement "Engineers never see any cost" implies this); formulas, rates and material data are typed into cells (the sample worksheet hard-codes the rates in every formula); there is no assignment, deadline tracking, review step, lock or audit trail inside the file itself. None of this is quantified: no baseline for time, error rate or volume was provided (Q-24).
- **Evidence:** SPEC §1, §3, §8; DOCX §1; XLSX (formulas contain hard-coded constants; the second sheet holds three text labels only). No complaints, audit findings or metrics were supplied.

## 3. Business Objectives (SMART)
Baselines marked "not measured" are open until Q-24 and Q-28 are answered. No figure here is invented; targets come from the SPEC's acceptance criteria.

| ID | Objective | Metric | Baseline | Target | By when |
|----|-----------|--------|----------|--------|---------|
| GOAL-01 | Move estimation from the worksheet to the portal | Share of new estimation tasks created and approved in the portal after cut-over | 0 % (all work is in Excel; DOCX §1) | 100 % of new tasks | Release 1 delivery target 2026-11-13 (Q-01; end date UNCONFIRMED, UNC-h); go-live follows the parallel run, date open (Q-25, Q-29) |
| GOAL-02 | Keep costs, rates and formulas hidden from Engineers | Cost, rate or formula values found in any Engineer page, API response or file in the automated test | Not applicable to a shared worksheet; no control exists (inferred) | 0 found, test run on every build | Before go-live (SPEC §14.1) |
| GOAL-03 | Calculate exactly as the worksheet does | Share of the SPEC §7.4 outputs matching a hand-calculated worksheet to 2 decimals on the acceptance tree (nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5). **Depends on Q-32:** the worksheet is the test oracle, and if the delivery lead confirms the quantity multiplication (UNC-d) the worksheet arithmetic differs from the new rule whenever a parent's quantity is above 1. Until Q-32 is answered the oracle is the SPEC §7.4 arithmetic (ASSUMPTION-48 (d)) | Not applicable | 100 % | Before go-live (SPEC §14.2) |
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
- Estimate workspace: customer choice, product tree to any depth, guided form with column letters, image attachment, conditional fields, validation, save and autosave, Calculate (UR-012 to UR-024, UR-040). One estimate holds one complete product (D-04). The Engineer enters Tool Cost with all other inputs (confirmed), and enters 0 for anything a part does not need (UR-043; confirmed). Choosing "Not applicable" in the Material and Treatment lists is a proposal, UNCONFIRMED (UNC-b).
- Cost counting on the tree: only children's costs are counted and a parent's cost is the sum of its children (BR-046; confirmed). A child's cost multiplied by its parent's quantity is a proposal, UNCONFIRMED (UNC-d, BR-047); the SPEC arithmetic stands until confirmed (details open, Q-32).
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
- The "Not needed for this part" switch: not built, the Engineer enters 0 instead (DEC-05, Q-06); formal closure of Q-15 UNCONFIRMED (UNC-f).
- Offline use (running the portal locally without internet): assumed a later release; UNCONFIRMED (UNC-e) conflict between AQP-11 and AQP-1. The delivery lead's decision is needed at G2 because it sets Release 1 scope; hosting details follow at G3 (BRQ-014, Q-18).
- Import of past Excel estimates (ASSUMPTION-25, unless Q-25 changes it).
- Customer-facing quote documents, customer log-in, invoicing, ordering or ERP integration (not in any input).
- Estimate data in checkpoints (checkpoints cover configuration only; SPEC §8.3).

**Future consideration**
- Drawing display beside the form, then data reading from drawings (SPEC §17.5).
- A sharper logo original replaces the current file (Q-16).
- Offline use, if the delivery lead confirms it for a later release (BRQ-014, Q-18).
- UI-sample ideas not in the SPEC (review-queue counts, global search, workload counts) for the product manager to rank (finding F-16).

## 6. Key Requirements Summary
Full list in `requirements-catalog.md`.
- Business: BRQ-001 (replace the worksheet), BRQ-002 (no cost to Engineers), BRQ-003 (review, approve, lock), BRQ-004 (matching calculations), BRQ-005 (Excel layout), BRQ-006 (Admin-configurable worksheet), BRQ-007 and BRQ-008 (audit, pinned approved estimates).
- User: UR-004 (assign), UR-013 and UR-014 (tree and numbering), UR-016 to UR-023 (guided entry and Calculate), UR-025 to UR-029 (review, approve, lock, unlock), UR-033 to UR-036 (formulas, fields, checkpoints).
- Rules: BR-003 (server-side hiding), BR-007 (Calculate validation), BR-015 to BR-023 (all calculations), BR-031 (master synchronisation), BR-035 (re-lettering), BR-046 to BR-048 (parent and child cost, zero entry; added in Pass 2; BR-047 and part of BR-048 are UNCONFIRMED).
- Answers recorded in Pass 2 (SPEC §18, D-01 to D-11). Confirmed in his own words: Tool Cost entered by the Engineer; 0 for parts that need nothing; approved estimates unaffected by later changes; only children's costs counted; master data entered at first use. UNCONFIRMED (proposed, not replacing SPEC text): BN = BL / total of all Tool Cost entries; "Not applicable" in the lists; recalculation after unlock with current rates; child cost multiplied by the parent's quantity; Release 1 internet only; the end date; keeping the stated assumptions (UNC-a to UNC-h).
- Decided input (2026-10-31): guided form with column letters; "Red Leads" brand; "Copy from part" and "Apply to selected" rejected; drawing input deferred with room left for it (DEC-01 to DEC-04). Details are in the catalogue and already appear in SPEC §17.

## 7. Constraints
- CONSTRAINT-01 Technology stack (SPEC §2, `CLAUDE.md`).
- CONSTRAINT-02 No `eval` in the formula engine.
- CONSTRAINT-03 IST display and scheduling, UTC storage.
- CONSTRAINT-04 Exactly one active Admin.
- CONSTRAINT-05 Logo file is 200 × 200 px until replaced.
- CONSTRAINT-06 Human approval at G1, G3, G8; code PRs merged by a human.
- CONSTRAINT-07 Budget: no limit. Start 2026-11-02; target 10 working days at 8 hours a day (confirmed); end date 2026-11-13, Monday to Friday (UNCONFIRMED, UNC-h). Whether the full SPEC fits: Q-29.
- CONSTRAINT-08 Part images below 200 KB.

## 8. Assumptions
**Status rule (G1 condition 5, same as SPEC §18):** content marked UNCONFIRMED rests only on AQP-1 comment 10415 or 10417. It is a proposed amendment, carried as a labelled assumption, and does not replace SPEC text until the delivery lead confirms it in his own words. **Provenance (G1 condition 4):** comment 10415 is an assistant recommendation adopted unedited, likely by the delivery lead but not confirmed (origin findings and the register UNC-a to UNC-h: `requirements-questions.md` section 4). Nothing has been recorded or reversed yet because he has not replied.

The ones that most change the result are below.

| ID | Assumption | Impact if false | Validation owner |
|----|------------|-----------------|------------------|
| ASSUMPTION-18 | **UNCONFIRMED (UNC-e, conflict, Q-18):** Release 1 is internet-hosted; offline use is a later release. AQP-11 asked for both; the later AQP-1 comment says internet only. Offline decision needed at G2, hosting details at G3 | Security and delivery design change; offline scope added | Santhosh |
| ASSUMPTION-45 | The 2026-11-13 date (UNCONFIRMED, UNC-h) is the Release 1 delivery date; go-live, training and the parallel run follow it (Q-29) | Release plan wrong | Santhosh |
| ASSUMPTION-47 | BL, BN and BO appear in row 2 only in the export, as in the SPEC, although the sample shows totals per top-level item (Q-31) | Export differs from the sample | Santhosh |
| ASSUMPTION-48 | (Depends on UNC-d.) Quantities pass through every level of the tree; a parent's cost = its quantity x the sum of its children's costs; non-zero cost inputs on a parent are not counted (Q-32) | Wrong prices | Santhosh |
| ASSUMPTION-49 | (Depends on UNC-b.) System-created "Not applicable" Material and Treatment entries with all rates 0 (Q-33) | Cost on a part that has none | Santhosh |
| ASSUMPTION-17 | Meta and Open Graph tags on all pages with generic text; authenticated pages "do not index" (kept) | Leakage or rework | Santhosh |
| ASSUMPTION-21 | All SPEC `[DEFAULT]` items stand (kept; the keeping is UNCONFIRMED, UNC-g) | Policy changes | Santhosh |

Resolved by the delivery lead's own words (no longer assumptions to validate): ASSUMPTION-02 (one person, D-02), 03 (sample file, D-03), 04 (one product per estimate, D-04), 09 (master data entered at first use, D-09), and in part: 01 (start date and 10 working days, D-01), 05 (Engineer enters Tool Cost, D-05), 06 (enter 0, D-06), 07 (approved estimates unaffected, D-07), 08 (children-only cost, D-08). Still UNCONFIRMED parts: the end date (UNC-h), BN divisor (UNC-a), "Not applicable" (UNC-b), recalculation rule (UNC-c), quantity multiplication (UNC-d), switch closure (ASSUMPTION-15, UNC-f). The full list (ASSUMPTION-01 to 49) is in the catalogue.

## 9. Dependencies
| Dependency | Type (internal/3rd party/data) | Owner | Status |
|------------|-------------------------------|-------|--------|
| Cleaned sample worksheet at `docs/reference/sample-estimate.xlsx`; blank template if any | Data | Santhosh | Open (Q-30); the sample itself is confirmed (Q-03) |
| Master data defaults (process rates, materials, exchange rates, customers, treatments, users) | Data | Santhosh | Delivery lead to provide when asked after G3 approval and before development starts (Q-09 answered); the Admin enters values at first use |
| E-mail (SMTP) service and sender address | 3rd party | Accucut IT | Open (Q-18) |
| Hosting, web address and internet access (offline use unconfirmed) | Internal / 3rd party | Accucut IT | Open (Q-18) |
| Answers to Q-18, Q-29 and Q-32 (blocking) | Internal | Santhosh | Open |
| Sharper logo original | Data | Santhosh | Open (Q-16, assumption kept) |
| Engineers and Leads available for the process walk-through and parallel run | Internal | Santhosh | Open (Q-25, Q-28; fit with the 10-day timeline: Q-29) |

## 10. Business Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| The parent and child quantity rule (proposed, UNCONFIRMED, UNC-d) is adopted without his decision, or differs from the worksheet, giving wrong quotes | Medium | High (wrong quotes) | Q-32 and the UNC-d confirmation before G2; worked examples (for example 2 x 3 = 6) in the test plan |
| The export does not match the sample because the sample shows per-item totals and the answer is one total per estimate | Medium | Medium | Q-31 before G3 |
| Cost leaks to an Engineer through an API, page or export | Low | High | Server-side filtering and automated test (BR-003, GOAL-02) |
| Master or rate changes alter approved prices | Low (rule decided, D-07) | High | Record of master values at each calculation (DR-003) |
| Starting master data is late or wrong; the stop to ask for defaults after G3 uses calendar time in a 10-day plan | Medium | High | TR-009 stop point; placeholders in the meantime; parallel run (TR-004) |
| Export does not match the sample in Excel (headers, formats, subtotal row) | Medium | Medium | Q-03, Q-10; compare file to sample |
| Single Admin is absent or leaves | Medium | Medium | Hand-over step (Q-23) |
| Engineers cannot Calculate on assembly parents | Low (answered: enter 0, "Not applicable") | Low | UR-043; Q-33 for the Material row values |
| Brand red and status colours are confused; red on white barely meets contrast | Medium | Medium | Q-27; contrast checks (NFR-018) |
| Browsers block network-folder links | High | Low | Copy-path button (SPEC §5.1) |
| The whole SPEC may not fit in 10 working days (80 hours), with three human gates and the master data stop | High | High | Q-29 by G2; product manager proposes a first release from the SPEC §13 order. The analyst makes no effort estimate |
| Internet hosting exposes the sign-in page; network-folder paths cannot be opened from outside the office; the offline request is unresolved | Medium | Medium | Q-18: offline decision at G2, hosting details at G3; server-side security (NFR-001, NFR-002); Copy path button (Q-12) |
| Customer or part data from the sample worksheet is exposed in the repository | Low | High | Structure only; clean copy before any commit (Q-03) |

## 11. Compliance & Regulatory Considerations
Assessed from general knowledge; no web research was done, so none of this has been verified against current law. The company's legal adviser should confirm (Q-26).
- **Personal data:** the portal holds user names and e-mails and customer contact details (name, phone, e-mail, address). India's Digital Personal Data Protection Act, 2023 and the IT Act 2000 rules may apply. Measures already in the SPEC: role-based access, password hashing, audit log. Retention period and policy are open (Q-26).
- **GDPR:** EUR pricing suggests EU customers, but only business contact data is held; considered unlikely to apply. Confirm in Q-26.
- **Internet exposure (new in Pass 2):** if Release 1 is hosted on the internet (ASSUMPTION-18, unconfirmed), the sign-in page is reachable by anyone and login protection, encrypted connections and "do not index" settings matter more. No new law was identified; the security requirements (NFR-001, NFR-002, NFR-020) apply.
- **Commercial confidentiality:** rates, prices and formulas are commercially sensitive; this is treated as a business requirement (BRQ-002), not a regulation.
- **Customer data in test material:** the sample worksheet holds real-looking part and customer data. It must not be copied into artefacts, Jira, GitHub, tests or fixtures (NFR-023).
- **Accessibility:** WCAG 2.1 AA is an SPEC requirement, not a legal finding.
- **Tax (GST) and e-invoicing:** not in any input; no requirement identified.
- No sector regulation (for example PCI-DSS, HIPAA, SOX) was identified from the inputs.

## 12. Open Questions
Blocking questions are in bold and each has its own Jira issue. The full text, the assumption used and the answer line for every question are in `requirements-questions.md`.

| ID | Question | Owner | Needed by | Status |
|----|----------|-------|-----------|--------|
| Q-01 to Q-09 | Budget and date, one person, sample, one product, Tool Cost, zero entry, approved estimates, parent and child cost, master data | Santhosh | G2 to G4 | Q-02, Q-04, Q-09 **Answered**; Q-01, Q-03 and **Q-05 to Q-08 answered in part** (UNC-a to UNC-d, UNC-h unconfirmed); answers in SPEC §18 |
| Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | Export details, Rejection (BC), folder links, Remarks, Plating flag, logo, SEO, workflow gaps, `[DEFAULT]` confirmation, IDs, succession, baseline, cut-over, retention, colours, as-is walk-through | Santhosh | G2 to G8 | Assumption kept, UNCONFIRMED (UNC-g; AQP-1 comment 10415) |
| Q-15 | "Not needed" switch | Santhosh | G3 | Closed: not needed; closure UNCONFIRMED (UNC-f) |
| **Q-18** | Hosting and access: conflict between AQP-11 (internet and offline) and AQP-1 (internet only, offline later) | Santhosh | Offline decision G2; hosting details G3 | **Open** (AQP-11); ASSUMPTION-18 UNCONFIRMED (UNC-e) |
| **Q-29** | What 2026-11-13 delivers; does the full SPEC fit 10 working days | Santhosh | G2 | **New, open** |
| Q-30 | Cleaned sample copy; blank template | Santhosh | G3 | New, open |
| Q-31 | Sample shows totals per top-level item; answer is one total | Santhosh | G3 | New, open |
| **Q-32** | Quantity roll-up details; difference from the worksheet's arithmetic (also decides the GOAL-03 test oracle) | Santhosh | G2 | **New, open** |
| Q-33 | Values and handling of the "Not applicable" Material row | Santhosh | G3 | New, open |

**Findings from comparing the SPEC, the Draft v5 document, the sample worksheet and the UI sample** (F-01 to F-21) are in `requirements-questions.md` section 3. Findings F-22 to F-25 were added in Pass 2. The most important: the sample has two top-level items each with its own total, while the answer is one total per estimate (F-01, F-22); the quantity rule for parents and children differs from the SPEC and the worksheet arithmetic (F-23); the two hosting answers conflict (F-24); SPEC §17 already holds the 2026-10-31 decisions (F-20).

## 13. Glossary
| Term | Definition |
|------|------------|
| Estimate / quotation | The cost calculation for one product, held as a tree of nodes. |
| Product, item, part, sub-part | Levels of the tree; all share the same fields. |
| Node (row) | One row of the worksheet; one node of the tree. |
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
| Total Unit Production Price (BL) | Total cost of the estimate. In force (SPEC): sum of BG over all nodes. Proposed, UNCONFIRMED (UNC-d): counting each part once, as the sum of the lowest-level parts' costs, each multiplied by the quantities of its parents. |
| Tool Cost (BM) | Cost of tooling, entered by the Engineer on each part (0 where none). BN divides BL by BM (SPEC); proposed, UNCONFIRMED (UNC-a): by the total of all Tool Cost entries. |
| Parent / child node | A node with parts below it is a parent; the parts directly below it are its children. Only children's costs are counted; a parent's cost is the sum of its children (confirmed, AQP-9). |
| Not applicable | Proposed, UNCONFIRMED (UNC-b): a list option in Material in Drawing and Treatment / Color for a part that needs none, used with 0 in number fields. |
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
| UNCONFIRMED (UNC-a to UNC-h) | Content that rests only on AQP-1 comment 10415 or 10417 and that the delivery lead has not confirmed in his own words. It is a proposed amendment and does not replace SPEC text. |

## 14. Sources
- `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0 (SPEC), all sections including §15 and §17.
- `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx` (DOCX).
- `AMADA-20261006.xlsx` (XLSX): read for structure only (sheet layout, headers, formulas, widths, formats); no cell data is reproduced.
- `Accucut Quotation Portal UI-UX.html` (UI): design system and 14 screens, read for structure and behaviour; names in it are samples and are not used.
- `docs/project-state.md`, `docs/00-governance/gate-log.md` (G0 record and carry-forward items), `CLAUDE.md`.
- Delivery lead decisions of 2026-10-31 and standing website standards (from the delegation brief).
- Delivery lead answers on Jira AQP-1 and AQP-2 to AQP-11, 2026-10-31 (Pass 2); provenance note and the register UNC-a to UNC-h in `requirements-questions.md` section 4.
- `docs/00-governance/gate-log.md`, section G1 (2026-11-01): provenance findings and conditions 1, 4 and 5. The BA relied on the gate log and did not read any session log.
- No web sources were used.
