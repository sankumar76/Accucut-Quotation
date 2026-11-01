# Project Brief — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 (Draft, Discovery Pass 1) |
| Author | business-analyst |
| Date | 2026-10-31 |
| Status | In Review (G1, awaiting delivery lead answers to the Q-NN list) |
| Intake issue | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

## 1. Executive Summary
Accucut Lasers Pvt Ltd prepares manufacturing cost estimates (quotations) in an Excel worksheet with columns A to BO. The Admin, Leads and Engineers need a role-based web portal that does the same job: Admin or a Lead assigns the estimate to an Engineer, the Engineer enters part data without ever seeing a cost, the portal calculates every cost column from master data, a Lead or Admin approves and locks a price, and the result is exported to Excel in the worksheet's layout. The Admin must also be able to change fields and formulas in the portal, with Excel-style re-lettering and an audit trail. Why now: the sponsor has supplied a full requirements specification, a worksheet sample and a UI sample, and wants delivery to start (no deadline or budget is stated; see Q-01). Sources: SPEC §1, DOCX §1.

## 2. Problem Statement
- **Who is affected:** Admin (one), Leads (many) who assign and approve estimates, and Engineers (many) who prepare them (SPEC §3). Indirectly, Accucut's customers who receive the quoted price.
- **Current situation:** Estimates are prepared in one Excel worksheet with columns A to BO; one row per item, part or sub-part; formulas calculate the costs (SPEC §1; XLSX structure). The inputs do not describe how work is assigned, tracked or approved today (Q-28).
- **Pain / impact (inferred from the design of the requested solution, not evidenced):** a worksheet gives every holder of the file access to all rates and formulas, so an Engineer cannot be kept from seeing cost (the requirement "Engineers never see any cost" implies this); formulas, rates and material data are typed into cells (the sample worksheet hard-codes the rates in every formula); there is no assignment, deadline tracking, review step, lock or audit trail inside the file itself. None of this is quantified: no baseline for time, error rate or volume was provided (Q-24).
- **Evidence:** SPEC §1, §3, §8; DOCX §1; XLSX (formulas contain hard-coded constants; the second sheet holds three text labels only). No complaints, audit findings or metrics were supplied.

## 3. Business Objectives (SMART)
Baselines marked "not measured" are open until Q-24 and Q-28 are answered. No figure here is invented; targets come from the SPEC's acceptance criteria.

| ID | Objective | Metric | Baseline | Target | By when |
|----|-----------|--------|----------|--------|---------|
| GOAL-01 | Move estimation from the worksheet to the portal | Share of new estimation tasks created and approved in the portal after cut-over | 0 % (all work is in Excel; DOCX §1) | 100 % of new tasks | Go-live date plus the parallel-run period; dates open (Q-01, Q-25) |
| GOAL-02 | Keep costs, rates and formulas hidden from Engineers | Cost, rate or formula values found in any Engineer page, API response or file in the automated test | Not applicable to a shared worksheet; no control exists (inferred) | 0 found, test run on every build | Before go-live (SPEC §14.1) |
| GOAL-03 | Calculate exactly as the worksheet does | Share of the SPEC §7.4 outputs matching a hand-calculated worksheet to 2 decimals on the acceptance tree (nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5) | Not applicable | 100 % | Before go-live (SPEC §14.2) |
| GOAL-04 | Export in the worksheet layout | Share of the export checks passed (A to BO layout, original widths, centre/middle alignment, currency formats, embedded images, BL2 and BO2 filled) | Not applicable | 100 % | Before go-live (SPEC §14.12) |
| GOAL-05 | Make late work visible and acted on | (a) Overdue e-mail sent within 5 minutes of a task becoming overdue when alerts are ON; (b) 11:00 AM IST digest sent every day when overdue tasks exist; (c) duplicates sent | Not measured; no tracking exists (inferred) | (a) 100 %, (b) 100 %, (c) 0 | Before go-live (SPEC §5.4, §14.11) |
| GOAL-06 | Control approved prices and configuration | (a) Approved estimates with an Approved Quote Price, approver and time recorded; (b) configuration, master, approval, unlock and price-override events logged with who, when and before → after | Not measured | (a) 100 %, (b) 100 % | Before go-live (SPEC §12) |
| GOAL-07 | Work on all screen sizes with a consistent professional design | Screens that work with no horizontal page scroll and every action reachable at 360, 768 and 1366 px; design-system review passed | Not applicable | 100 % of screens | Before go-live (SPEC §14.13, §17) |

Business outcome measures such as estimate turnaround time cannot be set until the baseline is provided (Q-24).

## 4. Stakeholders & Personas
Summary here; full detail in `stakeholder-map.md`.

| Stakeholder / Persona | Role | Primary need | Influence | Interest |
|-----------------------|------|--------------|-----------|----------|
| Santhosh / MD | Sponsor and delivery lead (one person or two: Q-02) | A trusted quoting tool delivered to a date and budget | High | High |
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
- Estimate workspace: customer choice, product tree to any depth, guided form with column letters, image attachment, conditional fields, validation, save and autosave, Calculate (UR-012 to UR-024, UR-040).
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
- The "Not needed for this part" switch, until the delivery lead decides (DEC-05, Q-15).
- Import of past Excel estimates (ASSUMPTION-25, unless Q-25 changes it).
- Customer-facing quote documents, customer log-in, invoicing, ordering or ERP integration (not in any input).
- Estimate data in checkpoints (checkpoints cover configuration only; SPEC §8.3).

**Future consideration**
- Drawing display beside the form, then data reading from drawings (SPEC §17.5).
- A sharper logo original replaces the current file (Q-16).
- "Not needed for this part" switch if confirmed (Q-15).
- UI-sample ideas not in the SPEC (review-queue counts, global search, workload counts) for the product manager to rank (finding F-16).

## 6. Key Requirements Summary
Full list in `requirements-catalog.md`.
- Business: BRQ-001 (replace the worksheet), BRQ-002 (no cost to Engineers), BRQ-003 (review, approve, lock), BRQ-004 (matching calculations), BRQ-005 (Excel layout), BRQ-006 (Admin-configurable worksheet), BRQ-007 and BRQ-008 (audit, pinned approved estimates).
- User: UR-004 (assign), UR-013 and UR-014 (tree and numbering), UR-016 to UR-023 (guided entry and Calculate), UR-025 to UR-029 (review, approve, lock, unlock), UR-033 to UR-036 (formulas, fields, checkpoints).
- Rules: BR-003 (server-side hiding), BR-007 (Calculate validation), BR-015 to BR-023 (all calculations), BR-031 (master synchronisation), BR-035 (re-lettering).
- Decided input (2026-10-31): guided form with column letters; "Red Leads" brand; "Copy from part" and "Apply to selected" rejected; drawing input deferred with room left for it (DEC-01 to DEC-04). Details are in the catalogue and already appear in SPEC §17.

## 7. Constraints
- CONSTRAINT-01 Technology stack (SPEC §2, `CLAUDE.md`).
- CONSTRAINT-02 No `eval` in the formula engine.
- CONSTRAINT-03 IST display and scheduling, UTC storage.
- CONSTRAINT-04 Exactly one active Admin.
- CONSTRAINT-05 Logo file is 200 × 200 px until replaced.
- CONSTRAINT-06 Human approval at G1, G3, G8; code PRs merged by a human.
- CONSTRAINT-07 Budget and target date not stated (Q-01).
- CONSTRAINT-08 Part images below 200 KB.

## 8. Assumptions
The full list (ASSUMPTION-01 to 44) is in the catalogue. The ones that most change the result:

| ID | Assumption | Impact if false | Validation owner |
|----|------------|-----------------|------------------|
| ASSUMPTION-02 | "Santhosh / MD" is one person | Sign-off route changes | Santhosh |
| ASSUMPTION-03 | AMADA-20261006.xlsx is the sample worksheet, used for structure only | Export fidelity wrong | Santhosh |
| ASSUMPTION-04 | One product and one total per estimate | Data model, approval, export | Santhosh |
| ASSUMPTION-05 | Engineer enters Tool Cost (BM) on every part | Engineer form and visibility rule | Santhosh |
| ASSUMPTION-07 | Estimates keep a snapshot of master values at each calculation | Approved prices could change silently | Santhosh |
| ASSUMPTION-08 | BL sums all nodes; a parent holds only its own cost | Wrong prices | Santhosh |
| ASSUMPTION-09 | Client supplies starting master data before UAT | Testing delayed | Santhosh |
| ASSUMPTION-17 | Meta and Open Graph tags on all pages with generic text; authenticated pages "do not index" | Leakage or rework | Santhosh |
| ASSUMPTION-18 | Server reachable from office network or VPN; not public | Security design changes | Santhosh |
| ASSUMPTION-21 | All SPEC `[DEFAULT]` items stand | Policy changes | Santhosh |

## 9. Dependencies
| Dependency | Type (internal/3rd party/data) | Owner | Status |
|------------|-------------------------------|-------|--------|
| Cleaned sample worksheet at `docs/reference/sample-estimate.xlsx` | Data | Santhosh | Open (Q-03) |
| Starting master data: process rates, materials, exchange rates, customers, treatments, users | Data | Santhosh / Accucut | Open (Q-09) |
| E-mail (SMTP) service and sender address | 3rd party | Accucut IT | Open (Q-18) |
| Hosting server and web address | Internal / 3rd party | Accucut IT | Open (Q-18) |
| Answers to Q-01 to Q-09 | Internal | Santhosh | Open |
| Sharper logo original | Data | Santhosh | Open (Q-16) |
| Engineers and Leads available for the process walk-through and parallel run | Internal | Santhosh | Open (Q-25, Q-28) |

## 10. Business Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Parent and child costs are double counted in the total (SPEC §15.2) | Medium | High (wrong quotes) | Q-08 before G2; test with worked examples |
| Estimate-level versus item-level totals are misunderstood (sample shows per-item totals) | Medium | High | Q-04 before G2 |
| Cost leaks to an Engineer through an API, page or export | Low | High | Server-side filtering and automated test (BR-003, GOAL-02) |
| Master or rate changes alter approved prices | Medium | High | Snapshot of master values (Q-07) |
| Starting master data is late or wrong | Medium | High | Q-09 early; parallel run (TR-004) |
| Export does not match the sample in Excel (headers, formats, subtotal row) | Medium | Medium | Q-03, Q-10; compare file to sample |
| Single Admin is absent or leaves | Medium | Medium | Hand-over step (Q-23) |
| Engineers cannot Calculate because every field is mandatory on assembly parents | High | Medium | Q-06, Q-15 |
| Brand red and status colours are confused; red on white barely meets contrast | Medium | Medium | Q-27; contrast checks (NFR-018) |
| Browsers block network-folder links | High | Low | Copy-path button (SPEC §5.1) |
| No budget or date, so scope cannot be sized | Medium | Medium | Q-01 by G2 |
| Customer or part data from the sample worksheet is exposed in the repository | Low | High | Structure only; clean copy before any commit (Q-03) |

## 11. Compliance & Regulatory Considerations
Assessed from general knowledge; no web research was done, so none of this has been verified against current law. The company's legal adviser should confirm (Q-26).
- **Personal data:** the portal holds user names and e-mails and customer contact details (name, phone, e-mail, address). India's Digital Personal Data Protection Act, 2023 and the IT Act 2000 rules may apply. Measures already in the SPEC: role-based access, password hashing, audit log. Retention period and policy are open (Q-26).
- **GDPR:** EUR pricing suggests EU customers, but only business contact data is held; considered unlikely to apply. Confirm in Q-26.
- **Commercial confidentiality:** rates, prices and formulas are commercially sensitive; this is treated as a business requirement (BRQ-002), not a regulation.
- **Customer data in test material:** the sample worksheet holds real-looking part and customer data. It must not be copied into artefacts, Jira, GitHub, tests or fixtures (NFR-023).
- **Accessibility:** WCAG 2.1 AA is an SPEC requirement, not a legal finding.
- **Tax (GST) and e-invoicing:** not in any input; no requirement identified.
- No sector regulation (for example PCI-DSS, HIPAA, SOX) was identified from the inputs.

## 12. Open Questions
Blocking questions are in bold and each has its own Jira issue. The full text, the assumption used and the answer line for every question are in `requirements-questions.md`.

| ID | Question | Owner | Needed by |
|----|----------|-------|-----------|
| **Q-01** | Budget and target date (AQP-2) | Santhosh | G2 |
| **Q-02** | "Santhosh / MD" one person or two (AQP-3) | Santhosh | G2 |
| **Q-03** | Is AMADA-20261006.xlsx the sample worksheet (AQP-4) | Santhosh | G3 |
| **Q-04** | One total per estimate or per top-level item (AQP-5) | Santhosh | G2 |
| **Q-05** | Tool Cost (BM): who enters it (AQP-6) | Santhosh | G2 |
| **Q-06** | Assembly parents under "all inputs mandatory" (AQP-7) | Santhosh | G2 |
| **Q-07** | Master changes after approval (AQP-8) | Santhosh | G2 |
| **Q-08** | Parent versus child cost (AQP-9) | Santhosh | G2 |
| **Q-09** | Starting master data (AQP-10) | Santhosh | G4 |
| Q-10 to Q-17 | Export details; SPEC §15 items 1, 4 to 8; SEO/Open Graph | Santhosh | G3 to G8 |
| **Q-18** | Hosting and access (AQP-11) | Santhosh | G3 |
| Q-19 to Q-28 | Workflow gaps, `[DEFAULT]` confirmation, IDs, succession, baseline, cut-over, retention, colours, as-is walk-through | Santhosh | G2 to G4 |

**Findings from comparing the SPEC, the Draft v5 document, the sample worksheet and the UI sample** (F-01 to F-21) are in `requirements-questions.md` section 3. The most important: the sample has two top-level items each with its own total (F-01); Tool Cost sits in different places in the SPEC, the sample and the UI (F-02); the parent row has no material (F-08); SPEC §17 already holds the 2026-10-31 decisions (F-20).

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
| Total Unit Production Price (BL) | Sum of BG over all nodes of the estimate. |
| Tool Cost (BM) | Cost of tooling for the product. |
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

## 14. Sources
- `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0 (SPEC), all sections including §15 and §17.
- `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx` (DOCX).
- `AMADA-20261006.xlsx` (XLSX): read for structure only (sheet layout, headers, formulas, widths, formats); no cell data is reproduced.
- `Accucut Quotation Portal UI-UX.html` (UI): design system and 14 screens, read for structure and behaviour; names in it are samples and are not used.
- `docs/project-state.md`, `docs/00-governance/gate-log.md` (G0 record and carry-forward items), `CLAUDE.md`.
- Delivery lead decisions of 2026-10-31 and standing website standards (from the delegation brief).
- No web sources were used.
