# Requirements Catalogue — Accucut Quotation Portal

> Owner: business-analyst. Version 0.3 (Discovery Pass 2, G1 conditions 4 and 5 applied), 2026-11-01. Every requirement is unambiguous, testable, necessary, traceable and solution-agnostic. Priority uses MoSCoW.
> **Source key:** `SPEC §n` = `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0; `DOCX §n` = `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx`; `XLSX` = `AMADA-20261006.xlsx` (structure only); `UI` = `Accucut Quotation Portal UI-UX.html`; `DEC-nn` = delivery-lead decision (section "Decided input"); `STD` = standing website standards from the delivery lead; `D-nn` = delivery lead answer recorded in SPEC §18 (Discovery Pass 2); `UNC-a` to `UNC-h` = content that rests only on AQP-1 comment 10415 or 10417 and is UNCONFIRMED (register in `requirements-questions.md` section 4).
> **Status rule (G1 condition 5, same as SPEC §18):** an item marked UNCONFIRMED is a proposed amendment, carried as a labelled assumption. It does not replace SPEC text until the delivery lead confirms it in his own words. Where a rule below carries both, the SPEC rule is in force and the proposal is shown beside it. **Provenance (G1 condition 4):** comment 10415 is an assistant recommendation adopted unedited, likely by the delivery lead but not confirmed; his own words are on AQP-2 to AQP-10 only. See `requirements-questions.md` section 4.
> **Priority rule used:** Must = the SPEC says MUST or the item has a SPEC §14 acceptance criterion; Should = the SPEC states it without MUST and without a §14 test, or it is a `[DEFAULT]`; Could = optional; Won't = excluded for this release.
> **Solution-agnostic note:** Items that name technology are marked `CONSTRAINT` and come from SPEC §2 or `CLAUDE.md`.
> **Letters:** column letters (A to BO) in rules refer to the initial configuration of the field registry (SPEC §7, §8); the portal derives letters from field position.

## Decided input (delivery lead, 2026-10-31)

Decisions made while reviewing the UI sample. SPEC §17 and §15 already hold them (finding F-20); Pass 2 only checks consistency.

| ID | Decision | Where it already is | Requirements derived |
|----|----------|---------------------|----------------------|
| DEC-01 | Engineers enter data in a **guided form** (one part at a time, section by section, parts tree beside it); no spreadsheet-style grid. Every field shows its Excel column letter; every section shows its column range. | SPEC §17.4 | UR-016, UR-040 |
| DEC-02 | **"Red Leads" brand:** white top bar with the real AccuCut logo image (never redrawn); company name "ACCUCUT LASERS" in logo red (about #DE3030) in a bold serif like the company board; dark graphite side menu (about #17181C); red main buttons and active markers; white and light-grey surfaces; separate darker error red (about #B3261E). Replaces the sample's blue and the navy #1F3864. | SPEC §17.2 | NFR-017, NFR-018 |
| DEC-03 | **"Copy from part" and "Apply to selected" are rejected** (parts very rarely share data). | SPEC §17.4 | UR-041; scope list in the brief |
| DEC-04 | **Drawing input is deferred** to the next release; the estimate screen must leave room to show a drawing beside the form later without a redesign. | SPEC §17.5 | NFR-019, UR-042; Future list in the brief |
| DEC-05 | **"Not needed for this part" switch: not built.** The Engineer enters 0 instead (his own words, AQP-7). The formal closure of Q-15 and the "Not applicable" choice are UNCONFIRMED (UNC-f, UNC-b). | SPEC §15 item 7, §18 D-06 | UR-043; BR-048; ASSUMPTION-15 retired |
| DEC-06 | Keyboard entry must be fast: Enter moves to the next field. Parts with missing data are flagged by icon as well as colour. | SPEC §17.4 | UR-024, UR-040 |

### Answers recorded in Pass 2 (SPEC §18) and their status

Answers given on Jira on 2026-10-31. Full text, sources and the status of every question are in `requirements-questions.md`. "Confirmed" means his own words on the question's Jira issue; "UNCONFIRMED" means the status rule above applies.

| ID | Answer | Question | Requirements derived or changed |
|----|--------|----------|---------------------------------|
| D-01 | Budget: no limit. Start 2026-11-02; 10 working days x 8 h (confirmed). End 2026-11-13, Monday to Friday: **UNCONFIRMED (UNC-h)**. | Q-01 | CONSTRAINT-07; ASSUMPTION-45 (Q-29) |
| D-02 | Sponsor is one person: Santhosh - MD. | Q-02 | Brief, stakeholder map |
| D-03 | AMADA-20261006.xlsx is the sample; Engineers enter inputs; Admin and Leads view all costs; Excel export needed. | Q-03 | BRQ-005; TR-007; Q-30 |
| D-04 | One estimate = one complete product (items, parts, sub-parts, and so on). | Q-04 | BR-023; DR-003; Q-31 |
| D-05 | Tool Cost (BM) is an Engineer input (confirmed). BN = BL / total of all Tool Cost entries: **UNCONFIRMED (UNC-a)**. | Q-05 | BR-003; BR-023 |
| D-06 | Engineer enters 0 if a part is not required (confirmed). "Not applicable" added to the Material and Treatment lists: **UNCONFIRMED (UNC-b)**. No "Not needed" switch, formal closure of Q-15: **UNCONFIRMED (UNC-f)**. | Q-06, Q-15 | UR-043; BR-007; BR-048; DR-008; DR-010; DEC-05 |
| D-07 | Approved estimates unaffected by any change (confirmed). Recalculation after unlock uses current rates and shows a notice if they changed: **UNCONFIRMED (UNC-c)**. | Q-07 | BRQ-008; BR-012; UR-029; DR-003 |
| D-08 | Only children's costs counted; parent = sum of children (confirmed; equals the SPEC total when parent inputs are 0). Child cost x parent quantity (2 x 3 = 6): **UNCONFIRMED (UNC-d)**. | Q-08 | BR-023; BR-046; BR-047; Q-32 |
| D-09 | Master data entered at first use; defaults from the delivery lead; ask after G3 approval, before development (confirmed, AQP-10). | Q-09 | TR-002; TR-009 |
| D-10 | **UNCONFIRMED (UNC-e), conflict:** Release 1 internet-hosted; offline later. Offline decision due G2, hosting details G3. | Q-18 | ASSUMPTION-18; BRQ-014 |
| D-11 | Keep the stated assumptions for all other questions: **UNCONFIRMED (UNC-g)**. | Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | none |

---

## Business Requirements (BRQ)

| ID | Requirement | Rationale | Source | Priority | Goal |
|----|-------------|-----------|--------|----------|------|
| BRQ-001 | Accucut must prepare, review, approve and export manufacturing cost estimates in one controlled system that replaces the Excel worksheet with columns A to BO. | Removes dependence on a single spreadsheet and its manual handling. | SPEC §1; DOCX §1 | Must | GOAL-01 |
| BRQ-002 | Calculated costs, material rates, exchange rates, customer rates and formulas must never be visible to an Engineer, on any screen, response or file. | Protects commercially sensitive pricing; the Engineer's job is to supply technical data only. | SPEC §1.2, §3; DOCX §2 | Must | GOAL-02 |
| BRQ-003 | A Lead or Admin must review every estimate and set an Approved Quote Price before it is final; an approved estimate must be locked until a Lead or Admin unlocks it. | Gives management control over the price that goes to the customer. | SPEC §1.4, §6.3; DOCX §5 | Must | GOAL-06 |
| BRQ-004 | Costs calculated by the portal must equal what the existing worksheet formulas give for the same inputs and rates, to 2 decimals. **Open (Q-32):** if the delivery lead confirms the quantity multiplication (UNC-d), the worksheet arithmetic differs from the new rule whenever a parent's quantity is above 1, and the comparison basis must be settled before this requirement can be tested. Until then the SPEC §7.4 arithmetic is the oracle (interim definition in ASSUMPTION-48 (d)). | Estimators and customers must be able to trust the new system on day one. | SPEC §7.4, §14.2; Q-32 | Must | GOAL-03 |
| BRQ-005 | The portal must produce an Excel file whose layout (header row, columns A to BO, widths, alignment, currency formats, images) replicates the client's worksheet. | Downstream users and customers keep working with the format they know. | SPEC §1.5, §10; DOCX §7 | Must | GOAL-04 |
| BRQ-006 | The Admin must be able to change the worksheet (add or remove fields, change formulas) without software changes, with Excel-style automatic re-lettering. | Pricing rules change over time; the company must not depend on a developer for each change. | SPEC §1.6, §8; DOCX §6.3 | Must | GOAL-06 |
| BRQ-007 | Changes to fields, formulas, masters, approvals, unlocks and Approved Quote Price overrides must be traceable to a person and time, with old and new values. | Accountability for pricing decisions. | SPEC §8.3, §12 | Must | GOAL-06 |
| BRQ-008 | An approved estimate must keep the fields, formulas, rates, master values and results it was approved with, even after later configuration, rate or master-value changes (answered, D-07). | Approved prices must not change silently. | SPEC §8.4; DOCX §6.3; D-07 | Must | GOAL-06 |
| BRQ-009 | Estimation work must be assigned with a requirement-folder reference and a deadline, tracked in queues, and escalated when overdue. | Work gets done on time and managers see late work. | SPEC §5; DOCX §4 | Must | GOAL-05 |
| BRQ-010 | The portal must be usable on mobile, tablet and desktop screens. | People work on the shop floor and in the office. | SPEC §11; STD | Must | GOAL-07 |
| BRQ-011 | The portal must look modern and professional and carry the Accucut brand consistently. | Credibility with staff and the company's identity. | SPEC §17; STD; DEC-02 | Must | GOAL-07 |
| BRQ-012 | The portal's design must allow later features (for example reading data from drawings) without redesign. | The delivery lead wants a base that can take more features. | SPEC §17.1, §17.5; DEC-04 | Should | GOAL-07 |
| BRQ-013 | The company must be able to move from the spreadsheet to the portal with checked, matching results. | A safe switch-over protects live quotations. | SPEC §14.2; Q-25 | Should | GOAL-01 |
| BRQ-014 | The portal can be used without an internet connection, running locally like a website on the user's own computer. **Unresolved conflict (Q-18):** requested in AQP-11; the later AQP-1 comment 10415 moves it to a later release (UNC-e, UNCONFIRMED). The decision is needed at G2 because it sets Release 1 scope. | Work may continue when there is no internet access. | AQP-11; AQP-1 (10415); D-10 | Won't (Release 1, assumed; UNCONFIRMED UNC-e, decide at G2) | — |

## Stakeholder / User Requirements (UR)

### Access and accounts
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-001 | User (any role) | sign in with my e-mail and password, sign out, change my password and reset a forgotten one by e-mailed link | only I can use my account | SPEC §9, §3 (`[DEFAULT]` reset) | Must | Valid login works; wrong password is refused; reset link works once |
| UR-002 | Admin | create, edit, deactivate users, set their role and reset passwords | the right people have the right access | SPEC §3 (`[DEFAULT]`), §9 | Must | User list shows name, e-mail, role, active flag |
| UR-003 | Admin | have exactly one active Admin at any time | there is a single accountable owner | SPEC §3, §14.14 | Must | Creating or activating a second Admin is refused |

### Work assignment and tracking
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-004 | Admin or Lead | assign a task to an Engineer with a network folder path, a deadline (date and time, IST) and optional title/notes | the Engineer knows what to estimate and by when | SPEC §5.1; DOCX §4 | Must | Task appears in the Engineer's Open queue; empty estimate exists |
| UR-005 | Engineer, Lead, Admin | open the folder from a clickable link and copy the path with one click | I can reach the requirement documents even if the browser blocks the link | SPEC §5.1, §15.4 | Must | Link and "Copy path" button shown with explanatory tooltip |
| UR-006 | Engineer, Lead, Admin | see tasks in Open, Closed and Overdue tabs sorted by deadline ascending, an overdue task also staying in Open | I work in the right order | SPEC §5.2; DOCX §4 | Must | Tab membership and order match the rules; Engineer sees own tasks only |
| UR-007 | Lead | see all tasks with a default filter "Assigned by me" and be able to change it | I can focus on my own assignments | SPEC §5.2 (`[DEFAULT]`) | Should | Default filter applied on opening |
| UR-008 | Engineer, Lead, Admin | see overdue rows marked by colour, icon and the text "Overdue by X" | status is clear without relying on colour | SPEC §5.2, §11 | Must | All three cues present |
| UR-009 | Engineer, Lead, Admin | see a bell with the count of my relevant overdue tasks (Engineer: own; Lead: assigned by me; Admin: all) that opens the Overdue tab | I notice late work at once | SPEC §5.3; DOCX §4 | Must | Count correct per role; click opens Overdue |
| UR-010 | Admin or Lead | search and filter tasks by Engineer, customer and date | I can find a task quickly | SPEC §9 | Should | Filters narrow the list |
| UR-011 | Engineer, Lead, Admin | receive e-mail for a new task, an overdue task and a daily 11:00 AM IST digest, only when alerts are ON | I am told without checking the portal | SPEC §5.4; DOCX §4 | Must | See BR-040 to BR-044; SPEC §14.11 |

### Estimate entry (Engineer, Lead, Admin)
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-012 | Engineer | choose the customer from a list before any data entry, and be asked to confirm if I change it later | the right customer's rates apply | SPEC §6.2; DOCX §6.1 | Must | Data entry is blocked until a customer is chosen; change asks for confirmation and recalculates |
| UR-013 | Engineer | build a product tree of items, parts and sub-parts to any depth, adding children and siblings, reordering and deleting nodes, either up front or as I go | the estimate mirrors the real product | SPEC §6.1; DOCX §5 | Must | SPEC §14.3 |
| UR-014 | Engineer | see Sl. No (A) generated from the tree position and renumbered after add, reorder or delete | numbering is never wrong | SPEC §6.1, §14.3 | Must | 1, 1.1, 1.1.1, 1.1.2, 1.2 … after each operation |
| UR-015 | Engineer | open any node from the tree to see its full details | I can edit one part at a time | SPEC §6.1 | Must | Each node is a link |
| UR-016 | Engineer | enter inputs in the eight sections of SPEC §7.1, in that order, each field with its column letter | I follow the same structure as the worksheet | SPEC §7.1; DOCX §6.1; DEC-01 | Must | Every field in §7.1 present with its letter badge |
| UR-017 | Engineer | add a part picture (C) by paste, drag and drop or file choice (camera or gallery on a phone), see a preview, and replace or remove it | the part is identified visually | SPEC §7.1, §11 | Must | Images over 200 KB are refused with a clear message; PNG, JPG, GIF, WebP accepted |
| UR-018 | Engineer | see Fasteners Qty (T) and Cost (U) only when Fasteners (S) is not "None" and not blank, otherwise have them set to 0 | I don't fill what doesn't apply | SPEC §7.1; DOCX §6.1 | Must | SPEC §14.4 |
| UR-019 | Engineer | choose Surface Treatments in one multi-select (selected = 1, not selected = 0) | entry is quick | SPEC §7.1; DOCX §6.1 | Must | Eight flags Z to AG set correctly |
| UR-020 | Engineer | choose a Treatment/Color from the list or "Other" and type free text | uncommon finishes can be recorded | SPEC §4.5, §7.1 | Must | "Other" reveals a text box |
| UR-021 | Engineer | see auto-filled fields (F, I-lookup) as read-only and shaded, with Material Rate (I) hidden from me | I cannot change or see master data | SPEC §7.1, §3 | Must | F shown; I absent from the Engineer's screen and responses |
| UR-022 | Engineer | save my work at any time, including incomplete data, with autosave and a warning before I leave unsaved changes | I never lose work | SPEC §6.3, §11 | Must (save) / Should (autosave 30 s) | Draft saved with blanks; warning appears |
| UR-023 | Engineer | click Calculate and be told which nodes and fields are incomplete, with nodes flagged in the tree; on success see only the message "Cost will be calculated based on the input fields and sent for review/approval." | I know what to fix and the estimate goes for review | SPEC §6.3, §7.3; DOCX §2 | Must | SPEC §14.4; no cost shown to Engineer |
| UR-024 | Engineer | see how many inputs are complete for the current part and which tree nodes have missing data | I can finish without hunting | SPEC §17.4; UI | Should | Icon plus colour on incomplete nodes |

### Review and approval (Lead, Admin)
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-025 | Lead or Admin | see each node's inputs and its final cost by default, and a "View Cost Details" button showing all calculated fields grouped in six stages, each with its formula | I can check the arithmetic | SPEC §6.4; DOCX §5 | Must | Button absent for Engineers |
| UR-026 | Lead or Admin | not see cost lines for unselected Surface Treatments (AQ↔Z, AR↔AA, AS↔AB, AT↔AC, AV↔AE, AW↔AF, AX↔AG) | the view stays short | SPEC §7.4; DOCX §6.2 | Must | SPEC §14.5; hidden lines still exported as 0 |
| UR-027 | Lead or Admin | recalculate whenever inputs change after a calculation | costs stay current | SPEC §6.3 | Must | Recalculate available when inputs changed |
| UR-028 | Lead or Admin | approve and lock an estimate by entering an Approved Quote Price (pre-filled with the calculated total, editable) | the final price is recorded and inputs freeze | SPEC §6.3; DOCX §5 | Must | Inputs read-only after approval; override logged |
| UR-029 | Lead or Admin | unlock an approved estimate for re-estimation, giving a reason; I see a notice if the configuration changed since approval. **Proposed, UNCONFIRMED (UNC-c):** recalculation then uses the current rates and the notice also covers rate changes | I can reopen work with full information | SPEC §6.3, §8.4; D-07 | Must | Unlock logged with reason; notice shown for configuration changes (rate changes: UNC-c) |
| UR-030 | Lead or Admin | download the Excel export at any status | I can share or archive the estimate | SPEC §6.5 | Must | Engineers cannot download (ASSUMPTION-36) |

### Masters and configuration (Admin)
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-031 | Admin | add, update and delete Process Master items, Customers, Materials, Exchange Rates and the Treatment/Color list at any time | masters stay current | SPEC §4; DOCX §3 | Must | CRUD with search for each master |
| UR-032 | Admin | have new customers start with the Process Master values, reset a customer to defaults after confirmation, and be asked per customer to apply or keep overridden values when a default changes | rates stay consistent but customer deals are protected | SPEC §4.2; DOCX §3 | Must | SPEC §14.10 |
| UR-033 | Admin | edit formulas in an editor with autocomplete, live check and preview against a sample node, confirming with my password | pricing changes are safe | SPEC §8.2, §8.3; DOCX §6.3 | Must | Invalid or circular formulas cannot be saved |
| UR-034 | Admin | insert input fields, output fields, or an input with its cost column in one step, choosing position and group, with a preview of letter changes | the worksheet can grow | SPEC §8.3; DOCX §6.3 | Must | SPEC §14.6 |
| UR-035 | Admin | delete a field only after every formula using it has been changed, confirming with my password | no formula is left broken | SPEC §8.3 | Must | SPEC §14.7 |
| UR-036 | Admin | save named checkpoints of the field and formula configuration, list them, and revert to one after confirming with my password; and view the change history of who changed what and when | mistakes can be undone and changes are accountable | SPEC §8.3; DOCX §6.3 | Must | SPEC §14.8, §14.9 |
| UR-037 | Admin | turn e-mail alerts on or off, set the sender display name/address and send a test e-mail | alerts can be controlled | SPEC §4.6, §9 | Must | Setting changes behaviour of BR-040 to BR-044 |
| UR-038 | Lead | view formulas read-only | I can explain a price | SPEC §3, §8.3 | Must | No edit controls shown |
| UR-039 | Any user | open an About page showing the site description, Version No. 1.0 and "© Accucut Lasers Pvt Ltd. All rights reserved." | the product is identifiable | SPEC §9; DOCX §7 | Must | Text matches exactly |

### Usability decisions
| ID | As a… | I need to… | So that… | Source | Priority | Acceptance hint |
|----|-------|------------|----------|--------|----------|-----------------|
| UR-040 | Engineer | move to the next field with the Enter key and see only one part's form at a time with the tree beside it | entry is fast | SPEC §17.4; DEC-01, DEC-06 | Must | Enter moves focus to the next field |
| UR-041 | Engineer | not have "Copy from part" or "Apply to selected" actions | the form stays simple (parts rarely share data) | SPEC §17.4; DEC-03 | Won't | Actions absent |
| UR-042 | Engineer | (future) see a drawing beside the form | I can enter from the drawing without switching windows | SPEC §17.5; DEC-04 | Won't (this release) | Layout has room; no drawing function |
| UR-043 | Engineer | enter 0 in a number field for a part (including a parent assembly) that does not need it (confirmed); **proposed, UNCONFIRMED (UNC-b):** also choose "Not applicable" in Material in Drawing and Treatment / Color | the mandatory-field rule is met and the calculations are not affected | SPEC §18 D-06 (Q-06) | Must (0); proposal for "Not applicable" | Calculate accepts 0 on every node and the part adds no cost; "Not applicable" is accepted only if UNC-b is confirmed |

## Business Rules (BR)

### Authorisation and visibility
| ID | Rule (precise, incl. formulas/thresholds) | Type | Source | Exceptions |
|----|-------------------------------------------|------|--------|------------|
| BR-001 | Roles are Admin (exactly one active), Lead (many), Engineer (many). Each user has Name, Email ID (login), password, role and an active flag. | authorisation | SPEC §3 | none |
| BR-002 | Engineers see only their own tasks and queue; Admin sees all; Lead sees all with default filter "Assigned by me". | authorisation | SPEC §5.2 | none |
| BR-003 | Cost or output values, material rates (I), exchange rates, customer rates and formulas are removed on the server for Engineers; an Engineer's responses and pages must contain none of them, and an automated test must assert this. | authorisation | SPEC §3, §14.1 | Engineer enters Machining Cost (AP), Plating Cost (AU) and Tool Cost (BM) as inputs (Q-05 answered, D-05) and sees only the values typed, never BL, BN or any calculated value |
| BR-004 | Only Admin manages masters, settings, users, formulas, fields and checkpoints; Lead may view formulas read-only; both Admin and Lead may assign tasks, enter and edit inputs, view costs, approve, lock, unlock, set the Approved Quote Price and download. | authorisation | SPEC §3 | none |
| BR-005 | Formula edit, field deletion and checkpoint revert each require the Admin to re-enter their password. | authorisation | SPEC §8.3; DOCX §6.3 | none |

### Estimate workflow
| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-006 | Status lifecycle: DRAFT → (Engineer Calculate) → SUBMITTED → (Lead/Admin Approve & Lock) → APPROVED → (Lead/Admin Unlock) → editable again. | policy | SPEC §6.3 | Return path and unlock target open (Q-19) |
| BR-007 | Calculate requires every visible input of every node to be filled; on failure it shows errors and flags the nodes and fields; it does not submit. | validation | SPEC §7.3, §14.4 | Hidden T and U are not required and take 0; Surface Treatment may be empty; a part or parent that needs nothing gets 0 (BR-048, Q-06 answered in part); "Not applicable" only if UNC-b is confirmed |
| BR-008 | When Fasteners (S) is "None" or blank, T and U are hidden and stored and exported as 0. S defaults to "None". | validation | SPEC §7.1, §14.4 | none |
| BR-009 | Numeric inputs accept up to 2 decimal places and are not negative. | validation | SPEC §2, §7.3 (`[DEFAULT]` ≥ 0) | none |
| BR-010 | A customer must be chosen before data entry; changing it needs confirmation and triggers recalculation. | validation | SPEC §6.2 | none |
| BR-011 | The Approved Quote Price is pre-filled with the calculated Total Unit Production Price (BL) and may be overridden by Lead/Admin; every override is logged. | policy | SPEC §6.3, §12 | none |
| BR-012 | Approved estimates are read-only and pinned to the configuration version they were approved with; they keep their fields, formulas and values. New and unlocked estimates use the latest configuration version when (re)calculated; unlock shows a notice if the configuration changed. Master values are covered too (D-07, confirmed): an approved estimate keeps the master values it was approved with. **Proposed, UNCONFIRMED (UNC-c):** recalculation after unlock uses the current values and shows a notice if rates changed. | policy | SPEC §8.4; D-07 | Recalculation rule: UNC-c |
| BR-013 | Sl. No (A) is derived from tree position and renumbers after add, reorder or delete. | calculation | SPEC §6.1 | none |
| BR-014 | An image is accepted only if PNG, JPG, GIF or WebP by content (not by file extension) and smaller than 200 KB. | validation | SPEC §7.1, §12 | none |

### Calculations (initial configuration; letters refer to the same row unless stated)
| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-015 | Stage 1: M = (L × K × J × Material-Specific-Gravity) / 1,000,000; O = M − N; AH = (J × K × 2) / 645; AI = AH / 144. | calculation | SPEC §7.4; DOCX §6.2; XLSX | none |
| BR-016 | Stage 2: AK = (M × I) − (O × Material-Scrap-Rate). | calculation | SPEC §7.4 | none |
| BR-017 | Stage 3 process costs: AL = P × Cutting-Rate-per-Sec; AM = R × Bending-Rate-per-stroke; AN = (W + X + Y) × Drilling-Tapping-Rate; AO = N × Welding-rate-per-kg × V. | calculation | SPEC §7.4 | none |
| BR-018 | Stage 3 surface treatments: AQ = (N × Dip-Galvanizing-Cost-per-kg) × Z; AR = (AI × Primer-rate-per-sqft) × AA; AS = (N × Shot-Blasting-rate-per-kg) × AB; AT = AC × ((AH / 2) × Polishing-rate-per-sqin); AV = AE × (AI × Powder-rate-per-sqft); AW = AF × AI × Foam Cost; AX = AG × (AH × Soft-Anodize-rate-per-sqin). | calculation | SPEC §7.4 | AD (Plating flag) has no formula (Q-14) |
| BR-019 | AP (Machining Cost) and AU (Plating Cost) are entered directly. AY = AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX. | calculation | SPEC §7.4 | none |
| BR-020 | Stage 4: AZ = T × U; BA = AK + AY + AZ; BB = BA × H. | calculation | SPEC §7.4 | none |
| BR-021 | Stage 5: BC (Rejection) = 0 until defined (Q-11); BD = BB × OH Profit %; BE = BB × Inspection & Packing %; BF = BB × Transport %. A rate named "… %" is typed as a percentage (12 means 12%) and used as a fraction (0.12). | calculation | SPEC §7.4, §15.1 | Q-11 |
| BR-022 | Stage 6: BG = BB + BC + BD + BE + BF; BH = 1 USD in INR; BI = 1 EUR in INR; BJ = BG / BH; BK = BG / BI. | calculation | SPEC §7.4 | none |
| BR-023 | **In force (SPEC §7.4):** BL = sum of BG over all nodes, shown once (row 2); BN = BL / BM (the row-2 value), shown as "—" when BM is 0; BO = Approved Quote Price, once (row 2). One estimate = one product = one BL, BN and BO (Q-04 confirmed). **Proposed, UNCONFIRMED:** BL counts each part once under BR-046 and BR-047 (UNC-d); BN = BL / total of all Tool Cost (BM) entries of the estimate whenever that total is above 0, "—" when it is 0 (UNC-a). | calculation | SPEC §7.4; §18 D-04, D-05, D-08; DOCX §6.2 | Placement in the export versus the sample: Q-31. Roll-up details: Q-32 |
| BR-024 | Division by zero shows "—" on screen and an empty cell in the export; it never stops a calculation. | validation | SPEC §7.4 (`[DEFAULT]`) | none |
| BR-025 | Calculated values are stored at full precision and displayed to 2 decimals; calculations run on the server; stored results are recomputed on Calculate and Recalculate. | calculation | SPEC §2, §12 | none |
| BR-026 | Cost lines that depend on an unselected Surface Treatment flag are hidden in the cost view only; they are still calculated and exported (as 0). | policy | SPEC §7.4, §14.5 | none |
| BR-027 | The hidden-line behaviour is generic: any output field can name the flag field whose zero value hides it. | policy | SPEC §7.4, §8.1 | none |

### Masters and synchronisation
| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-028 | Creating a customer copies all current Process Master values into the customer's rates. | policy | SPEC §4.2 | none |
| BR-029 | "Reset to Defaults" on a customer reloads every rate from the Process Master after confirmation. | policy | SPEC §4.2 | none |
| BR-030 | Adding a Process Master item adds it to every customer with the default value; it becomes usable in formulas by name. | policy | SPEC §4.1, §4.2 | none |
| BR-031 | Updating a Process Master value updates every customer whose current value equals the previous default; for each customer whose value differs, the Admin chooses apply or keep (per customer, with apply-all and keep-all). | policy | SPEC §4.2; DOCX §3 | none |
| BR-032 | A Process Master item cannot be deleted while a formula uses it; the portal lists the formulas. Otherwise deletion removes it from all customers. | validation | SPEC §4.2 | none |
| BR-033 | A Material in Drawing value is unique; it maps to Material-Considered, Material-Price-per-kg, Material-Specific-Gravity and Material-Scrap-Rate. | validation | SPEC §4.3 | none |

### Field registry and formulas
| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-034 | Column letters follow Excel order (A…Z, AA…AZ, BA…BZ …) and are derived from field position, never stored. | policy | SPEC §1, §8.1; DOCX §6.3 | none |
| BR-035 | Inserting a field at a position gives it that letter and moves later fields one letter on; deleting moves later fields one letter back; every displayed formula and every fixed cell (BL, BN, BO) moves with its column. | calculation | SPEC §8.3, §14.6 | none |
| BR-036 | Formulas are saved in a letter-independent form and shown by column letter; operands are same-row letters, rate names, Material-* fields, exchange-rate names and numbers; operators + − × ÷ and brackets; SUM over all nodes for product-level fields. | policy | SPEC §8.1, §8.2 | Extra functions `[DEFAULT]` (ASSUMPTION-41) |
| BR-037 | A formula is refused on save if it has an unknown letter or rate name, a syntax error or a circular reference (the cycle is shown). Formulas are evaluated in dependency order. | validation | SPEC §8.2, §14.9 | none |
| BR-038 | A new output is included in a total only when the Admin edits that total's formula. New input fields are mandatory and visible to Engineers; new outputs are hidden from Engineers. | policy | SPEC §8.3, §8.4; DOCX §6.3 | none |
| BR-039 | Every configuration change creates an immutable version; each estimate records the version it was last calculated with; a checkpoint is a named version; reverting is itself logged and can be undone. Checkpoints never affect estimate data. | policy | SPEC §8.3, §8.4 | none |

### Notifications
| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-040 | E-mails are sent only when Email alerts = ON. | policy | SPEC §5.4; DOCX §4 | none |
| BR-041 | New task: To the Engineer, Cc the assigning Lead/Admin, with task details, folder path/link and deadline in IST. | policy | SPEC §5.4 | none |
| BR-042 | Task becomes overdue: To the Engineer, Cc the assigning Lead/Admin, sent immediately (the overdue check runs at least every 5 minutes). | policy | SPEC §5.4 | none |
| BR-043 | Daily at 11:00 AM IST: each Engineer with overdue tasks gets a list of their overdue tasks, Cc the Lead(s) who assigned them. | policy | SPEC §5.4 | DOCX says "each Engineer" (F-13, Q-21) |
| BR-044 | E-mails are never sent twice for the same event and every send or failure is logged; failed sends are retried. | policy | SPEC §5.4, §12 | none |
| BR-045 | A task is Closed when its estimate is approved and returns to Open if the estimate is unlocked; an Open task past its deadline is Overdue and also stays in Open. All times are in IST. | policy | SPEC §5.2 (`[DEFAULT]`); DOCX §4 | none |

### Cost counting and zero entry (added in Pass 2)

| ID | Rule | Type | Source | Exceptions |
|----|------|------|--------|------------|
| BR-046 | Only the cost of children is counted: a parent node (one with children) takes its cost from the sum of its children's costs, so no cost is counted twice in BL. Confirmed in the delivery lead's words (AQP-9); equals the SPEC total when parent inputs are 0, and replaces ASSUMPTION-08 in part. Whether the parent "has no cost of its own" when non-zero inputs are entered is open (Q-32 (c)). | calculation | SPEC §18 D-08 (Q-08, AQP-9) | Treatment of non-zero cost inputs on a parent: Q-32 (c); ASSUMPTION-48 |
| BR-047 | **Proposed, UNCONFIRMED (UNC-d), comment 10415 only:** a child's cost is multiplied by its parent's quantity (example: parent quantity 2 x child quantity 3 = 6 of the child). It does not replace SPEC §7.4 BB or BL until confirmed. | calculation | SPEC §18 D-08 (Q-08, comment 10415) | Pass-through over several levels, and whether a parent's displayed cost includes its own quantity: Q-32 (a), (b); ASSUMPTION-48. Differs from the worksheet when a parent's quantity is above 1: Q-32 (d) |
| BR-048 | Where a part does not need a number field, the Engineer enters 0 (confirmed, AQP-7). This applies to every node, including parents. A zero entry must not change any calculation. **Proposed, UNCONFIRMED (UNC-b):** the Engineer also chooses "Not applicable" in Material in Drawing and Treatment / Color. | validation | SPEC §18 D-06 (Q-06, Q-15) | Values of the "Not applicable" Material row: Q-33; ASSUMPTION-49 |

## Data Requirements (DR)

| ID | Entity / data | Key attributes | Owner | Sensitivity | Retention | Source of truth |
|----|---------------|----------------|-------|-------------|-----------|-----------------|
| DR-001 | User | Name, Email ID, role, active flag, password (stored only as a one-way hash) | Admin | Confidential (personal data) | Q-26 | Portal |
| DR-002 | Task | Engineer, assigning user, network folder path, deadline, optional title/notes, status, estimate link | Lead/Admin | Internal | Q-26 | Portal |
| DR-003 | Estimate | Customer, status, configuration version used, per-calculation record of the master values used (confirmed, D-07), Approved Quote Price, approver, timestamps | Lead/Admin | Restricted (commercial prices) | Q-26 | Portal |
| DR-004 | Estimate node | Tree position, Sl. No, all input field values, calculated values (not visible to Engineers) | Engineer, Lead/Admin | Restricted for calculated values; Confidential for inputs | Q-26 | Portal |
| DR-005 | Part image | One image per node, PNG/JPG/GIF/WebP, below 200 KB | Engineer | Confidential (may show customer part) | Q-26 | Portal |
| DR-006 | Process Master | Named rates, with unit and default value | Admin | Restricted | Q-26 | Portal; entered by the Admin at first use; defaults from the delivery lead (Q-09) |
| DR-007 | Customer | Name, Phone, Email, Address, one value per Process Master item | Admin | Confidential (business contact data) | Q-26 | Portal; entered by the Admin at first use; defaults from the delivery lead (Q-09) |
| DR-008 | Material Master | Material in Drawing (unique), Material-Considered, price per kg, specific gravity, scrap rate; may include a "Not applicable" row if UNC-b is confirmed (Q-33) | Admin | Restricted | Q-26 | Portal; entered by the Admin at first use; defaults from the delivery lead (Q-09) |
| DR-009 | Exchange rates | 1 USD in INR, 1 EUR in INR, last updated by/at | Admin | Restricted | Q-26 | Portal |
| DR-010 | Treatment/Color list | Option names (plus fixed "Other"; "Not applicable" if UNC-b is confirmed) | Admin | Internal | Q-26 | Portal |
| DR-011 | Field registry and configuration versions | Field definitions (kind, type, section, position, formula, hide rule, visibility rule, default, mandatory, row/product scope, Excel width and format), sections, versions, checkpoints | Admin | Restricted (formulas) | Versions of approved estimates: for as long as those estimates | Portal; initial values from SPEC §7 and the sample (Q-03) |
| DR-012 | Audit log | Who, when, object, before → after for configuration changes, approvals, unlocks, price overrides, master edits | System | Confidential | Q-26 | Portal |
| DR-013 | E-mail log | Event, recipients, time, result (sent/failed), retry count | System | Internal | Q-26 | Portal |
| DR-014 | Settings | Email alerts ON/OFF, SMTP sender name and address (credentials only via environment, never in data) | Admin | Internal | Current value | Portal and environment |

## Transition Requirements (TR)

| ID | Requirement | Owner | Priority |
|----|-------------|-------|----------|
| TR-001 | Load the initial field registry and sections from SPEC §7 and the sample worksheet on first installation. | Delivery team | Must |
| TR-002 | The Admin enters master data (Process Master values, materials, exchange rates, customers, Treatment/Color list) when the app is first used; the delivery lead provides the defaults (Q-09 answered, D-09). Until the defaults arrive, development and tests use invented placeholder values only. | Santhosh / Admin | Must |
| TR-003 | Create the first users (one Admin, Leads, Engineers) before go-live. | Santhosh / Admin | Must |
| TR-004 | Before go-live, run a set of real past estimates through the portal and the worksheet and compare every output to 2 decimals (parallel run); the number of estimates is open (Q-25). | Accucut estimating lead / QA | Should |
| TR-005 | Train Admin, Leads and Engineers on their role's screens; the Engineer session must make clear that costs are not shown by design. Who trains is open (Q-25). | Delivery team | Should |
| TR-006 | Past Excel estimates are not imported in this release unless Q-25 says otherwise. | Santhosh | Won't (assumed) |
| TR-007 | Obtain a cleaned copy of the sample worksheet at `docs/reference/sample-estimate.xlsx` and, if available, a sharper logo original (Q-30, Q-16). The sample is AMADA-20261006.xlsx (Q-03 answered). | Santhosh | Must |
| TR-008 | Document daily database backup guidance and restore steps in the README for the Accucut IT contact. | Delivery team | Must |
| TR-009 | After G3 approval and before development starts, the delivery process stops and asks the delivery lead for the master data defaults (Q-09 answered, D-09). | Orchestrator / Santhosh | Must |

## Non-functional Requirements (NFR)

| ID | Requirement | Source | Priority | Acceptance hint |
|----|-------------|--------|----------|-----------------|
| NFR-001 | Every route and API enforces role permissions on the server. | SPEC §12 | Must | Role matrix test per route |
| NFR-002 | Sign-in is protected by cross-site request forgery protection, secure HTTP-only session cookies and rate limiting of login attempts. | SPEC §12 | Must | Security tests |
| NFR-003 | Inputs are sanitised; images are checked by content, not file extension. | SPEC §12 | Must | Wrong-type file renamed to .png is refused |
| NFR-004 | Configuration changes, approvals, unlocks, Approved Quote Price overrides and master-data edits are logged with who, when and before → after. | SPEC §12 | Must | Log entries exist per event |
| NFR-005 | An estimate of 500 nodes recalculates in under 2 seconds. | SPEC §12 | Must | Timed test on 500 nodes |
| NFR-006 | Pages become interactive within 2 seconds on a mid-range phone on a 4G connection. | SPEC §12 | Should | Measured test (method to be set in the test strategy) |
| NFR-007 | Failed e-mails are retried and logged. Daily database backup guidance is in the README. | SPEC §12 | Must | Log shows retries |
| NFR-008 | All dates and times are shown and scheduled in IST (Asia/Kolkata) and stored in UTC; date-time pickers show IST explicitly. | SPEC §2, §11 | Must | `CONSTRAINT` Time zone |
| NFR-009 | Money values use INR (₹), USD ($) and EUR (€); inputs accept 2 decimals; stored at full precision; displayed to 2 decimals. | SPEC §2 | Must | Display test |
| NFR-010 | Screens work at 360×800, 768×1024, 1024×768, 1366×768 and 1920×1080 (portrait and landscape) with no horizontal page scrolling and every action reachable. | SPEC §11, §14.13 | Must | Automated viewport tests |
| NFR-011 | Layout by screen size follows SPEC §11: queues as cards on mobile; tree in a drawer on mobile, collapsible panel on tablet, persistent panel on desktop; section cards 1/2/3 columns; sticky action bar on mobile and tablet; tables scroll only inside their container. | SPEC §11 | Must | Viewport tests |
| NFR-012 | Touch targets are at least 44 px; numeric fields use the decimal keyboard on phones. | SPEC §11 | Must | Inspection |
| NFR-013 | The portal meets WCAG 2.1 AA: labels on every input, keyboard-navigable tree, visible focus, status shown by more than colour. | SPEC §11 | Must | Accessibility checks |
| NFR-014 | There are clear loading, empty and error states, and confirmation messages after saves. | SPEC §11 | Should | Inspection |
| NFR-015 | Light and dark mode are available. | SPEC §11 (`[DEFAULT]`, ASSUMPTION-43) | Could | Inspection |
| NFR-016 | One typographic scale (one size each for main headings, subheadings, body text, small labels), one spacing scale for all padding and margins, one button style set and one colour palette are used on every page; they are defined once and reused. | SPEC §17.3; STD | Must | Design-system review |
| NFR-017 | Brand: real logo file used unaltered; "ACCUCUT LASERS" in logo red in a bold serif like the company board; colours per DEC-02; errors use an icon, a thick border and written text, never colour alone. | SPEC §17.2; DEC-02 | Must | UX review |
| NFR-018 | All text and control colours meet WCAG contrast; the brand red (about #DE3030) on white is about 4.6 to 1, so it is used for large text, buttons and markers with checked states (see finding F-18). | SPEC §11, §17.2 | Must | Contrast check of every state |
| NFR-019 | The estimate screen leaves room to show a drawing beside the form later without a redesign. | SPEC §17.5; DEC-04 | Must | UX review |
| NFR-020 | Every page has a proper title and meta description, and an Open Graph title and description. These contain no cost, rate or customer data. For a login-only portal the tags are kept, with generic wording; authenticated pages are marked "do not index" (Q-17). | SPEC §17.6; STD | Must | Tag check on every page |
| NFR-021 | The portal looks modern and professional and every section reads as designed by the same hand. | STD; SPEC §17.1 | Must | UX review |
| NFR-022 | Calculations are done on the server; the client may show a live preview to Admin/Lead only. | SPEC §12 | Must | Engineer-side responses contain no preview |
| NFR-023 | No secrets or real personal or customer data appear in code, tests, fixtures, documents, Jira or GitHub. | CLAUDE.md §6.7 | Must | Repository scan |

## Constraints

| ID | Constraint | Source |
|----|------------|--------|
| CONSTRAINT-01 | Technology: TypeScript (strict), Node 22 LTS, Next.js (App Router), Tailwind CSS with shadcn/ui, PostgreSQL with Prisma, Auth.js, ExcelJS, Nodemailer, Docker Compose (SPEC §2 is marked `[DEFAULT]` but `CLAUDE.md` §1 fixes it for delivery). | SPEC §2; CLAUDE.md §1 |
| CONSTRAINT-02 | The formula engine must not use `eval` or `new Function`. | SPEC §2 |
| CONSTRAINT-03 | Time zone: IST for display and scheduling, UTC for storage. | SPEC §2 |
| CONSTRAINT-04 | Exactly one active Admin. | SPEC §3 |
| CONSTRAINT-05 | The supplied logo is 200 × 200 px (JPG) until a sharper original arrives. | SPEC §15.8 |
| CONSTRAINT-06 | Human approval at G1, G3 and G8; code pull requests wait for a human to merge. | CLAUDE.md §1a |
| CONSTRAINT-07 | Budget: no limit. Start 2026-11-02; target 10 working days at 8 hours a day (confirmed). End date 2026-11-13, Monday to Friday: UNCONFIRMED (UNC-h). What the date delivers and whether the full SPEC fits: Q-29. | Q-01 (AQP-2; AQP-1 comment 10417) |
| CONSTRAINT-08 | Part images are limited to 200 KB each. | SPEC §7.1 |

## Assumptions

| ID | Assumption | Impact if false | Owner |
|----|------------|-----------------|-------|
| ASSUMPTION-01 | **Replaced by answer (D-01), end date UNCONFIRMED (UNC-h):** budget no limit; start 2026-11-02; 10 working days x 8 h; end 2026-11-13. What the date delivers: ASSUMPTION-45 (Q-29) | Release plan must be re-cut | Santhosh |
| ASSUMPTION-02 | **Confirmed (D-02):** "Santhosh - MD" is one person (Q-02) | Sign-off route changes | Santhosh |
| ASSUMPTION-03 | **Confirmed (D-03):** AMADA-20261006.xlsx is the sample worksheet, used for structure only; cleaned copy still open (Q-30) | Export fidelity may be wrong | Santhosh |
| ASSUMPTION-04 | **Confirmed (D-04):** one product and one total per estimate (Q-04); sample difference: Q-31 | Data model, approval and export change | Santhosh |
| ASSUMPTION-05 | **Confirmed in part (D-05):** Engineer enters Tool Cost (BM) on every part (Q-05, AQP-6). **UNCONFIRMED (UNC-a):** BN divisor is the total of all BM entries; until confirmed the SPEC divisor (BM, row 2) stands | Engineer form and visibility rule change | Santhosh |
| ASSUMPTION-06 | **Replaced in part (D-06):** every node still needs every field; where a part needs nothing the Engineer enters 0 (confirmed, AQP-7). **UNCONFIRMED (UNC-b):** and chooses "Not applicable" in the Material and Treatment lists (Q-06) | Calculate blocked for assemblies | Santhosh |
| ASSUMPTION-07 | **Confirmed in part (D-07):** estimates keep the master values used at each calculation (AQP-8). **UNCONFIRMED (UNC-c):** recalculation after unlock uses current values with a notice (Q-07) | Approved prices could change silently | Santhosh |
| ASSUMPTION-08 | **Replaced in part (D-08):** only children's costs are counted and a parent's cost is the sum of its children (AQP-9). **UNCONFIRMED (UNC-d):** a child's cost is multiplied by its parent's quantity (Q-08). Details: ASSUMPTION-48 | Prices double counted or understated | Santhosh |
| ASSUMPTION-09 | **Replaced by answer (D-09):** the Admin enters master data at first use; the delivery lead provides defaults when asked after G3 approval and before development (Q-09) | Testing and go-live delayed | Santhosh |
| ASSUMPTION-10 | Export details as stated in Q-10 | Export differs from the sample | Santhosh |
| ASSUMPTION-11 | BC = 0 until defined (Q-11) | Prices under-quoted | Santhosh |
| ASSUMPTION-12 | `file:///` link plus Copy path (Q-12); current versions of Chrome, Edge, Firefox and Safari | Task start slowed; unsupported browser | Santhosh |
| ASSUMPTION-13 | Remarks stays mandatory (Q-13) | Filler text | Santhosh |
| ASSUMPTION-14 | AD is informational; AU is typed (Q-14) | Hidden-line rule incomplete | Santhosh |
| ASSUMPTION-15 | **Retired in practice (D-06):** the "Not needed" switch is not built; 0 is entered instead. Formal closure of Q-15 UNCONFIRMED (UNC-f) | Slower entry | Santhosh |
| ASSUMPTION-16 | Current logo file is used (Q-16) | Blurry brand | Santhosh |
| ASSUMPTION-17 | Meta and Open Graph tags on every page, generic wording, authenticated pages "do not index" (Q-17) | Rework of tags or leakage | Santhosh |
| ASSUMPTION-18 | **UNCONFIRMED (UNC-e), conflict (Q-18, D-10):** Release 1 is internet-hosted; offline use ("running locally") is a later release. AQP-11 asked for both; the later AQP-1 comment 10415 says internet only. Docker Compose per SPEC §2. Replaces "office network or VPN, not public". Offline decision needed at G2; hosting details at G3 | Security and delivery design change; offline scope added | Santhosh |
| ASSUMPTION-19 | Engineer read-only after SUBMITTED; no return action; unlock returns to DRAFT (Q-19) | Status model changes | Santhosh |
| ASSUMPTION-20 | Reassign and deadline change allowed and logged; cancel not provided (Q-20) | Task handling gaps | Santhosh |
| ASSUMPTION-21 | All `[DEFAULT]` items stand (Q-21) | Several policies change | Santhosh |
| ASSUMPTION-22 | ID format `Q-<year>-<4 digits>` (Q-22) | Rework of IDs and file names | Santhosh |
| ASSUMPTION-23 | Admin can hand over the role in one confirmed step (Q-23) | Lock-out risk | Santhosh |
| ASSUMPTION-24 | Fewer than 50 users, at most 500 nodes per estimate (Q-24) | Sizing wrong | Santhosh |
| ASSUMPTION-25 | No import of past estimates; short parallel run (Q-25) | Extra work or no safety check | Santhosh |
| ASSUMPTION-26 | Keep data until a policy exists; business contact data only (Q-26) | Compliance gap | Santhosh |
| ASSUMPTION-27 | Overdue is orange-amber plus icon plus text; mobile navigation per SPEC §11 (Q-27) | Confusing status colours | Santhosh |
| ASSUMPTION-28 | As-is process is inferred from the documents (Q-28) | Wrong baseline | Santhosh |
| ASSUMPTION-29 | SPEC v1.0 is the baseline; where the SPEC and DOCX agree no further confirmation is sought | Hidden disagreement | Santhosh |
| ASSUMPTION-30 | Admin creates and deactivates users and resets passwords (`[DEFAULT]`, SPEC §3) | Different user process | Santhosh |
| ASSUMPTION-31 | Password reset by e-mailed link (SPEC §9) | Different reset process | Santhosh |
| ASSUMPTION-32 | Lead's default task filter is "Assigned by me" (SPEC §5.2) | Different default view | Santhosh |
| ASSUMPTION-33 | Tasks may carry an optional title and notes (SPEC §5.1) | Extra field | Santhosh |
| ASSUMPTION-34 | A task closes when its estimate is approved and reopens on unlock (SPEC §5.2) | Different queue behaviour | Santhosh |
| ASSUMPTION-35 | Unlock requires a logged reason (SPEC §6.3) | Different audit | Santhosh |
| ASSUMPTION-36 | Engineers cannot download the export (SPEC §6.5) | Engineer would see costs | Santhosh |
| ASSUMPTION-37 | Numeric inputs are not negative (SPEC §7.3) | Credits not possible | Santhosh |
| ASSUMPTION-38 | Selecting no Surface Treatment is valid (SPEC §7.3) | Extra validation | Santhosh |
| ASSUMPTION-39 | A "…%" rate is typed as 12 meaning 12% (SPEC §7.4) | Wrong percentages | Santhosh |
| ASSUMPTION-40 | Division by zero shows "—" and exports an empty cell (SPEC §7.4) | Different error display | Santhosh |
| ASSUMPTION-41 | Formulas also allow MIN, MAX, ROUND and IF (SPEC §8.2) | Smaller function set | Santhosh |
| ASSUMPTION-42 | Drafts autosave every 30 seconds (SPEC §11) | Different interval | Santhosh |
| ASSUMPTION-43 | Light and dark mode offered (SPEC §11) | Scope change | Santhosh |
| ASSUMPTION-44 | Export file name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx` (SPEC §10) | Different name | Santhosh |
| ASSUMPTION-45 | The 2026-11-13 date (UNCONFIRMED, UNC-h) is the Release 1 delivery date; go-live, training and the parallel run follow; the product manager proposes a first release at G2 if the SPEC does not fit (Q-29) | Release plan wrong | Santhosh |
| ASSUMPTION-46 | The original sample is not committed; structure only; no cell data in any artefact (Q-30) | Customer data exposed, or export fidelity wrong | Santhosh |
| ASSUMPTION-47 | BL, BN and BO appear in row 2 only in the export; no per-item totals (Q-31) | Export differs from the sample | Santhosh |
| ASSUMPTION-48 | (Depends on UNC-d; falls away in part if the multiplication is rejected.) Quantities pass through every level; a leaf's BG is as in the SPEC; a parent's BG = its quantity x the sum of its children's BG; BL = sum of BG of the top-level nodes; non-zero cost inputs on a parent are stored but not counted; the parallel run compares with a worksheet calculated the same way (Q-32) | Wrong prices | Santhosh |
| ASSUMPTION-49 | (Depends on UNC-b.) System-created "Not applicable" rows in the Material Master (all rates 0) and the Treatment / Color list; the Admin cannot delete or rename them (Q-33) | Cost on a part that has none, or Engineers blocked | Santhosh |

Status of the other assumptions: ASSUMPTION-10 to 14, 16, 17, 19 to 44 stand as labelled assumptions. The statement that the delivery lead kept them rests only on AQP-1 comment 10415 (D-11, UNC-g: UNCONFIRMED).

## Open Questions

Full text, assumptions and answer lines are in `requirements-questions.md`. Blocking questions are in bold.

| ID | Question | Affects | Owner | Needed by | Status |
|----|----------|---------|-------|-----------|--------|
| Q-01 | Budget and target date | CONSTRAINT-07, release plan | Santhosh | G2 | Answered in part (AQP-2); end date UNCONFIRMED (UNC-h); see Q-29 |
| Q-02 | One person or two | sign-off | Santhosh | G2 | Answered: one person (AQP-3) |
| Q-03 | Is AMADA-20261006.xlsx the sample | BRQ-005, TR-007 | Santhosh | G3 | Answered in part (AQP-4); remainder Q-30 |
| Q-04 | One total per estimate or per top-level item | BR-023, DR-003 | Santhosh | G2 | Answered: one product (AQP-5); see Q-31 |
| Q-05 | Tool Cost (BM) entry | BR-003, BR-023 | Santhosh | G2 | **Answered in part:** Engineer enters (AQP-6); BN divisor UNCONFIRMED (UNC-a) |
| Q-06 | Assembly parents and mandatory inputs | BR-007, UR-043, BR-048 | Santhosh | G2 | **Answered in part:** enter 0 (AQP-7); "Not applicable" UNCONFIRMED (UNC-b); see Q-33 |
| Q-07 | Master changes after approval | BR-012, DR-003 | Santhosh | G2 | **Answered in part** (AQP-8); recalculation rule UNCONFIRMED (UNC-c) |
| Q-08 | Parent vs child cost | BR-023, BR-046, BR-047 | Santhosh | G2 | **Answered in part** (AQP-9); multiplication UNCONFIRMED (UNC-d); see Q-32 |
| Q-09 | Starting master data | TR-002, TR-009, DR-006 to DR-010 | Santhosh | After G3 approval, before development | Answered (AQP-10) |
| Q-10 | Export presentation details | BRQ-005 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-11 | Rejection (BC) | BR-021 | Santhosh | G4 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-12 | Network-folder links, browsers | UR-005 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-13 | Remarks mandatory | BR-007 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-14 | Plating flag unused | BR-018 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-15 | "Not needed" switch | DEC-05, BR-007 | Santhosh | G3 | Closed: not needed; closure UNCONFIRMED (UNC-f) |
| Q-16 | Sharper logo | CONSTRAINT-05 | Santhosh | G8 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-17 | SEO and Open Graph on a login-only portal | NFR-020 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| **Q-18** | Hosting and access (internet-hosted vs offline conflict) | BRQ-014, NFR, architecture | Santhosh | Offline decision G2; hosting details G3 | **Open** (AQP-11); ASSUMPTION-18 UNCONFIRMED (UNC-e) |
| Q-19 | Engineer edits after Calculate; return path | BR-006 | Santhosh | G2 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-20 | Task reassign, deadline change, cancel | UR-004 | Santhosh | G2 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-21 | Confirm `[DEFAULT]` items | ASSUMPTION-30 to 44 | Santhosh | G2 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-22 | ID format | UR-004, export | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-23 | Admin succession | CONSTRAINT-04 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-24 | Volumes, users, turnaround baseline | GOAL-01, NFR-005 | Santhosh | G2 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-25 | Past estimates, cut-over, parallel run | TR-004 to TR-006 | Santhosh | G4 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-26 | Retention and personal data | DR retention | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-27 | Overdue colour; mobile navigation | NFR-011, NFR-017 | Santhosh | G3 | Assumption kept, UNCONFIRMED (UNC-g) |
| Q-28 | Walk-through of today's process | process-as-is-to-be | Santhosh | G2 | Assumption kept, UNCONFIRMED (UNC-g) |
| **Q-29** | What 2026-11-13 delivers; does the full SPEC fit | CONSTRAINT-07, release plan | Santhosh | G2 | **New, open** (AQP-12) |
| Q-30 | Cleaned sample copy; blank template | BRQ-005, TR-007 | Santhosh | G3 | New, open |
| Q-31 | Per-item totals in the sample vs one total | BR-023, BRQ-005 | Santhosh | G3 | New, open |
| **Q-32** | Quantity roll-up details; worksheet difference | BR-023, BR-046, BR-047, BRQ-004 | Santhosh | G2 | **New, open** (AQP-13) |
| Q-33 | "Not applicable" Material row values | BR-048, DR-008 | Santhosh | G3 | New, open |

## Traceability summary

| SPEC section | Catalogue items |
|--------------|-----------------|
| §1 Product summary | BRQ-001 to BRQ-006 |
| §2 Stack, time zone, currency | CONSTRAINT-01 to 03, NFR-008, NFR-009, BR-009, BR-025 |
| §3 Roles | UR-001 to UR-003, BR-001 to BR-005, BR-003, UR-038 |
| §4 Master data | UR-031, UR-032, BR-028 to BR-033, DR-006 to DR-010, UR-020 |
| §5 Assignment and tracking | UR-004 to UR-011, BR-040 to BR-045, BR-002 |
| §6 Estimate structure and workflow | UR-012 to UR-015, UR-022, UR-023, UR-025 to UR-030, BR-006, BR-007, BR-010 to BR-013 |
| §7 Field definitions | UR-016 to UR-021, UR-026, BR-007 to BR-009, BR-014 to BR-027 |
| §8 Registry and formula engine | BRQ-006, UR-033 to UR-036, BR-034 to BR-039, DR-011 |
| §9 Screens | UR-001, UR-004, UR-010, UR-031 to UR-039 |
| §10 Excel export | BRQ-005, UR-030, TR-001, TR-007, Q-10 |
| §11 Responsive design and UX | BRQ-010, NFR-010 to NFR-015, UR-022 |
| §12 Non-functional | NFR-001 to NFR-007, NFR-022, BRQ-007 |
| §13 Build order | Input to the product manager (not a requirement) |
| §14 Acceptance criteria | Acceptance hints in UR and BR rows (criteria 1 to 14) |
| §15 Open items | Q-08, Q-03, Q-11, Q-12, Q-13, Q-14, Q-15, Q-16 |
| §16 Glossary | Brief section 13 |
| §17 UI direction | DEC-01 to DEC-06, NFR-016 to NFR-021, UR-040 to UR-042 |
| §18 Delivery lead answers (Pass 2; status rule and UNC-a to UNC-h) | D-01 to D-11: CONSTRAINT-07, BRQ-008, BRQ-014, UR-029, UR-043, BR-003, BR-007, BR-012, BR-023, BR-046 to BR-048, DR-003, DR-008, DR-010, TR-002, TR-007, TR-009, ASSUMPTION-01 to 09, 15, 18, 45 to 49 |
