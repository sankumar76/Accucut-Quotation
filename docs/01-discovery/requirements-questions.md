# Requirements Questions and Source Findings — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.4 (Pass 3: the delivery lead's own-words answers applied, G1 conditions 1 to 3) |
| Author | business-analyst |
| Date | 2026-11-01 (Pass 1: 2026-10-31) |
| Status | G1 conditions 1 to 3 answered in the delivery lead's own words on 2026-11-01 (AQP-1 comments 10441 and 10443; AQP-9 comment 10442; AQP-13 comment 10445; AQP-11 comment 10444; AQP-12 comment 10446). UNC-a to UNC-h are resolved (section 4). Open: Q-18 (hosting details, due G3), Q-30, Q-31, Q-32 (revised), Q-33, Q-34 (new). The master decides whether the conditions are met |
| Intake issue | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

**How to answer.** Reply on AQP-1 as `CHANGES: Q-01 <answer>; Q-04 <answer> …`, or write `APPROVED` to accept the stated assumptions for every question. Blocking questions also have their own Jira issue (key shown in the table). In Pass 2 the answers are copied into the Answer lines below and into `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` (new section 18, with pointer notes in the sections affected). Question status values: **Answered** (his own words on Jira; the comment IDs are shown), **Answered, with open details** (answered; a detail is carried as a new or revised question), **Assumption kept** (the stated assumption stands; confirmed in AQP-1 comment 10441 (g)), **Closed** (not needed), **Open** (still needs a decision). Content that rested only on AQP-1 comment 10415 (23:39) or 10417 (23:53) was UNCONFIRMED until he replied in his own words on 2026-11-01; it is now resolved (register in section 4, SPEC §18 status rule).

**Owner for every question** is Santhosh (delivery lead) unless the question names someone else. **Blocking** means the question decides scope, data model, price correctness or architecture, so delivery should not pass the "needed by" gate on the assumption alone without the delivery lead accepting it.

Source abbreviations: **SPEC** = `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0; **DOCX** = `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx`; **XLSX** = `AMADA-20261006.xlsx` (structure only; no cell data is reproduced here); **UI** = `Accucut Quotation Portal UI-UX.html`.

---

## 1. Question index

| ID | Question (short) | Blocking | Needed by | Jira | Status |
|----|------------------|----------|-----------|------|--------|
| Q-01 | Project budget and target date | **Yes** | G2 | [AQP-2](https://sankumar76.atlassian.net/browse/AQP-2) | Answered: start date and 10 working days (AQP-2); Monday-to-Friday week ending 2026-11-13 as a **target, not a fixed constraint** (AQP-1 10441 (h); AQP-12 10446); what the date delivers: Q-29, answered |
| Q-02 | "Santhosh / MD": one person or two | **Yes** | G2 | [AQP-3](https://sankumar76.atlassian.net/browse/AQP-3) | Answered (one person) |
| Q-03 | Is AMADA-20261006.xlsx the sample worksheet (SPEC §15.3)? | **Yes** | G3 | [AQP-4](https://sankumar76.atlassian.net/browse/AQP-4) | Answered in part; remainder is Q-30 |
| Q-04 | One product/total per estimate, or several top-level items each with a total? | **Yes** | G2 | [AQP-5](https://sankumar76.atlassian.net/browse/AQP-5) | Answered (one product); sample difference is Q-31 |
| Q-05 | Tool Cost (BM): who enters it, per part or per estimate? | **Yes** | G2 | [AQP-6](https://sankumar76.atlassian.net/browse/AQP-6) | **Answered**: Engineer enters Tool Cost (AQP-6); BN = BL / total of all Tool Cost entries (AQP-1 10441 (a), UNC-a confirmed) |
| Q-06 | Assembly (parent) parts under "all inputs mandatory" | **Yes** | G2 | [AQP-7](https://sankumar76.atlassian.net/browse/AQP-7) | **Answered**: enter 0 (AQP-7); "Not applicable" in the lists (AQP-1 10441 (b), UNC-b confirmed); its values are Q-33 |
| Q-07 | Master-value changes after approval (rate snapshot) | **Yes** | G2 | [AQP-8](https://sankumar76.atlassian.net/browse/AQP-8) | **Answered**: approved estimates unaffected (AQP-8); recalculation after unlock uses current rates with a notice (AQP-1 10441 (c), UNC-c confirmed) |
| Q-08 | Parent vs child cost (SPEC §15.2) | **Yes** | G2 | [AQP-9](https://sankumar76.atlassian.net/browse/AQP-9) | **Answered, with open details**: cost = sum of the costs of all children x item quantity (AQP-9 10442, AQP-13 10445; AQP-1 10443 corrects 10441 (d), UNC-d); details are Q-32 |
| Q-09 | Who supplies starting master data | **Yes** | After G3 approval, before development | [AQP-10](https://sankumar76.atlassian.net/browse/AQP-10) | Answered (entered at first use; defaults to follow; his own words on AQP-10) |
| Q-10 | Export presentation details versus the sample | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-11 | Rejection (BC) formula (SPEC §15.1) | No | G4 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-12 | Network-folder links (SPEC §15.4) | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) (see Pass 2 note) |
| Q-13 | Remarks (AJ) mandatory (SPEC §15.5) | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-14 | Plating flag (AD) unused (SPEC §15.6) | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-15 | "Not needed for this part" switch (SPEC §15.7) | No | G3 | — | Closed (not needed; 0 is entered); closure confirmed (AQP-1 10441 (f), UNC-f) |
| Q-16 | Sharper logo original (SPEC §15.8) | No | G8 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-17 | SEO and Open Graph on a login-only portal | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-18 | Hosting, access, web address, email service | **Yes** (hosting details, G3) | Hosting details G3 | [AQP-11](https://sankumar76.atlassian.net/browse/AQP-11) | **Offline decided**: Release 1 internet-hosted, offline in the next release (AQP-1 10441 (e); AQP-11 10444, UNC-e confirmed). **Hosting details still open**: web address, e-mail service and sender, backups, who updates; due G3 |
| Q-19 | After Calculate: can the Engineer still edit? Return path? | No | G2 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-20 | Task changes: reassign, change deadline, cancel | No | G2 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-21 | Confirm the `[DEFAULT]` decisions in the SPEC | No | G2 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-22 | Estimate / task ID format | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-23 | Admin succession and deactivated users with open tasks | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-24 | Volumes, user numbers and current turnaround (baseline) | No | G2 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-25 | Historical estimates, cut-over and parallel run | No | G4 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-26 | Data retention and personal-data obligations | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-27 | Overdue colour versus brand red; mobile navigation pattern | No | G3 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-28 | Walk-through of today's estimation process | No | G2 | — | Assumption kept (confirmed, AQP-1 10441 (g)) |
| Q-29 | What the 2026-11-13 date delivers | No (answered) | G2 | [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) | **Answered** (AQP-12 10446): target to complete development and hand over for testing and acceptance; he asks for a realistic date; scope behind it: Q-34 |
| Q-30 | Cleaned sample copy for the repository; blank template | No | G3 | — | **New, open** |
| Q-31 | Sample shows totals per top-level item; answer is one total per estimate | No | G3 | — | **New, open** |
| Q-32 | Roll-up details left after the corrected cost rule (D-08) | **Yes** by definition (BA view: due G3, not G2; master decides) | G3 (recommended) | [AQP-13](https://sankumar76.atlassian.net/browse/AQP-13) | **Open, revised in Pass 3**: his rule is in; the worksheet check is in SPEC §18.5; five details remain |
| Q-33 | Values and handling of the "Not applicable" Material row | No | G3 | — | **Open** (the "Not applicable" option itself is confirmed) |
| Q-34 | Which scope the realistic development completion date covers | No | G2 | — | **New, open** (Pass 3) |

---

## 2. Questions

### Q-01 — Project budget and target date  ·  BLOCKING [ANSWERED; end date is a target]
- **Question:** What is the project budget, and what is the target go-live date (or the date by which the spreadsheet should stop being used)?
- **Why it matters:** The release plan and MVP scope at G2 depend on both. The G0 decision carried this forward because neither was stated in the intake.
- **Assumption used until answered:** `ASSUMPTION-01` No fixed budget or date; scope is planned in the build order of SPEC §13 and sized later.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-2
- **Answer (2026-10-31, AQP-2 and AQP-1 comment of 23:53):** Budget: no limit. Start date 2026-11-02. Target: 10 working days at 8 hours a day, ending 2026-11-13 (Monday to Friday).
- **Applied:** `ASSUMPTION-01` is replaced (catalogue). CONSTRAINT-07 updated. SPEC §18 D-01. What the date delivers, and whether the full SPEC fits in 10 working days, was Q-29, answered in Pass 3 (a target; he asks for a realistic date). The scope behind that date is Q-34.
- **Status (Pass 3):** the start date 2026-11-02 and 10 working days are in his own words (AQP-2). The Monday-to-Friday week ending 2026-11-13 (UNC-h) is confirmed in AQP-1 comment 10441 (h). AQP-12 comment 10446 qualifies it: the date is a **target**, not a fixed constraint; development may finish later, and he asks for a realistic date. CONSTRAINT-07 is a target in the catalogue.

### Q-02 — "Santhosh / MD": one person or two  ·  BLOCKING [ANSWERED]
- **Question:** Is the sponsor "Santhosh / MD" one person, or are Santhosh (delivery lead) and a Managing Director two people? Who gives business sign-off at G8 and on pricing-policy decisions?
- **Why it matters:** It decides who the business approver is and who owns business-rule decisions (see Q-08, Q-11).
- **Assumption used until answered:** `ASSUMPTION-02` One person; Santhosh is both sponsor and sole approver.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-3
- **Answer (2026-10-31, AQP-3):** "Only one person. You can consider as Santhosh - MD."
- **Applied:** `ASSUMPTION-02` confirmed. Santhosh - MD is sponsor, delivery lead and sole business approver (brief, stakeholder map). SPEC §18 D-02.

### Q-03 — Is AMADA-20261006.xlsx the sample worksheet?  ·  BLOCKING [ANSWERED IN PART; remainder Q-30]
- **Question:** SPEC §15 item 3 says the sample worksheet is not yet provided and expects `docs/reference/sample-estimate.xlsx`, which does not exist. `AMADA-20261006.xlsx` is listed as an input. Is it the sample? If yes, may a cleaned copy (real customer and part data removed) be placed at `docs/reference/sample-estimate.xlsx`, and is it the layout the export must match? Is there a blank company template different from this filled example?
- **Why it matters:** The export is read from the sample (widths, headers, formats, SPEC §10). The file holds real-looking part and customer data, so it must not be committed as it is.
- **Assumption used until answered:** `ASSUMPTION-03` Yes, it is the reference for structure only. No cell data from it is copied into any artefact, Jira or GitHub.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** AQP-4
- **Answer (2026-10-31, AQP-4):** "Yes, that is just a sample with just couple of items. I need the webapp to get the inputs from the engineer(s) and let Admin and Lead(s) to view all the cost calculations as per the requirement and will need export to an excel spreadsheet as well."
- **Applied:** `AMADA-20261006.xlsx` is the sample worksheet (`ASSUMPTION-03` confirmed); roles and export need agree with SPEC §3 and §10. SPEC §18 D-03; SPEC §15 item 3 and §10 updated.
- **Not answered:** whether a cleaned copy (customer and part data removed) may be placed at `docs/reference/sample-estimate.xlsx`, and whether a blank company template exists. Carried to Q-30.

### Q-04 — One total per estimate, or per top-level item?  ·  BLOCKING [ANSWERED]
- **Question:** SPEC §6.1 and §7.4 describe one product per estimate: BL in row 2 sums BG of all nodes, and BN and BO are row-2 only. The sample worksheet has two top-level items (1 and 2). Item 1 has its own BL (a sum over only its own rows) and item 2 has its own BL, Tool Cost (BM) and BN on its first row. Is one estimate one product with one total and one Approved Quote Price, or can an estimate hold several top-level items each with its own total, Tool Cost and price?
- **Why it matters:** It changes the data model, the BL/BN/BO rules, approval (one price or many) and the export layout. See finding F-01.
- **Assumption used until answered:** `ASSUMPTION-04` SPEC as written: one product per estimate; "item 1, item 2 …" are the first-level nodes under it; BL, BN, BO in row 2 only.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-5
- **Answer (2026-10-31, AQP-5):** "One estimate will include one complete product, which may have multiple items/parts/subparts/sub-subparts/…"
- **Applied:** `ASSUMPTION-04` confirmed: one product, one total and one Approved Quote Price per estimate; the tree has any depth. SPEC §18 D-04.
- **Conflict flagged, not resolved:** the sample worksheet shows totals per top-level item (finding F-01). Where BL, BN and BO appear in the export is Q-31.

### Q-05 — Tool Cost (BM): who enters it, per part or per estimate?  ·  BLOCKING [ANSWERED]
- **Question:** SPEC §7.1 makes Tool Cost (BM) an Engineer input on every part (section 08), mandatory like all inputs. BN = BL / BM exists only in row 2. In the UI sample, Tool Cost sits beside the estimate total in the Lead/Admin approval view, and in the sample worksheet BM is filled on one row only. Should the Engineer enter Tool Cost on each part, or should the Lead/Admin enter one Tool Cost for the estimate?
- **Why it matters:** Tool Cost is a cost figure. If the Engineer enters it, the "Engineer never sees cost" rule must say clearly that entering a cost input is allowed but seeing calculated cost is not. It also decides whether every part needs a Tool Cost value. See finding F-02.
- **Assumption used until answered:** `ASSUMPTION-05` SPEC as written: the Engineer enters BM on each part (mandatory, 0 allowed); BN uses the row-2 value.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-6
- **Answer (2026-10-31, AQP-6; AQP-1 comment of 23:39):** "Yes, that is also an input field, to be entered by Engineer along with all the other input fields." And: BN = BL / total of all Tool Cost entries.
- **Applied:** Engineer enters Tool Cost (BM) on every part (`ASSUMPTION-05` confirmed; his own words on AQP-6). The Engineer sees only the Tool Cost values they type, never BL or BN. SPEC §7.1 and §18 D-05; BR-003 updated.
- **Confirmed (UNC-a, AQP-1 comment 10441 (a), 2026-11-01):** BN = BL / total of all Tool Cost (BM) entries of the estimate. When that total is 0, BN shows "—" under the SPEC division-by-zero rule (BR-024). SPEC §7.4 BN and §10 (BN2) are replaced; BR-023 updated.
- **Related:** where BN appears in the export (sample versus SPEC) is Q-31.

### Q-06 — Assembly (parent) parts under "all inputs mandatory"  ·  BLOCKING [ANSWERED; values Q-33]
- **Question:** In the sample worksheet the parent row (item 1) has no material, no treatment and zero dimensions. SPEC §7.3 requires every visible input, including Material in Drawing (E, a drop-down from the Material Master) and Treatment/Color (G), on every node. How should a container-only parent be entered: a placeholder option such as "Not applicable" in both lists, relaxed mandatory rules for nodes that have children, or the "Not needed for this part" switch (Q-15)?
- **Why it matters:** Without an answer an Engineer cannot Calculate an estimate that contains an assembly row, which would fail acceptance test 4 on real data. See finding F-08.
- **Assumption used until answered:** `ASSUMPTION-06` SPEC as written (every node needs every field). Recorded as a likely usability blocker.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-7
- **Answer (2026-10-31, AQP-7; AQP-1 comment of 23:39):** "Let them enter 0 if that part is not required. So the calculations are not affected." And: add "Not applicable" to the Material and Treatment lists.
- **Applied:** every node keeps every mandatory field; where a part needs nothing the Engineer enters 0 in number fields (his own words on AQP-7). `ASSUMPTION-06` partly replaced. SPEC §7.3 and §18 D-06; BR-007 updated.
- **Confirmed (UNC-b, AQP-1 comment 10441 (b), 2026-11-01):** "Not applicable" is a choice in Material in Drawing (E) and Treatment / Color (G). SPEC §4.3, §4.5, §7.1 and §7.3 are updated, which closes finding F-08 (an assembly row has no real material). BR-007, BR-048, DR-008 and DR-010 updated; the rate values and handling of the entry are Q-33 (ASSUMPTION-49).
- **Not answered:** the rate values behind the "Not applicable" Material row and whether the Admin can edit or delete it. Q-33.

### Q-07 — Master-value changes after approval  ·  BLOCKING [ANSWERED]
- **Question:** SPEC §8.4 pins an approved estimate to its configuration (fields, formulas). It says nothing about master values (customer rates, material price/gravity/scrap rate, exchange rates). If the Admin changes a rate after approval, must the approved estimate keep the rates it was approved with? When a Lead unlocks and recalculates, should the new calculation use current rates or the original ones?
- **Why it matters:** An approved price must not change silently, and an export re-generated later must match what was approved.
- **Assumption used until answered:** `ASSUMPTION-07` Each Calculate/Recalculate stores a snapshot of every master value it used; approved estimates keep their snapshot; recalculation after unlock uses current values (with a notice if they changed).
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-8
- **Answer (2026-10-31, AQP-8; AQP-1 comment of 23:39):** "No, Approved estimates will not be affected by any changes." And: recalculating after an unlock uses current rates and shows a notice if they changed.
- **Applied:** `ASSUMPTION-07` confirmed in part. Approved estimates keep every master value and configuration they were approved with (his own words on AQP-8). SPEC §8.4 and §18 D-07; BRQ-008, BR-012 and DR-003 updated.
- **Confirmed (UNC-c, AQP-1 comment 10441 (c), 2026-11-01):** recalculation after an unlock uses the current values and shows a notice if the configuration or any rate changed since approval. SPEC §8.4 is updated; BR-012, UR-029 updated.

### Q-08 — Parent versus child cost (SPEC §15 item 2)  ·  BLOCKING [ANSWERED, confirmed as corrected; details Q-32]
- **Question:** BL sums BG of all nodes (the sample does the same for item 1: its own row plus its children). Does a parent node carry only its own cost (for example assembly), so that the sum is right? Or may a parent also include its children, which would double count? Also, BG already multiplies by that node's own Qty per Assy (H): is a child's quantity "per final assembly" or "per parent"?
- **Why it matters:** It drives every quoted price.
- **Assumption used until answered:** `ASSUMPTION-08` Sum of all nodes as specified; a parent carries only its own cost; H is the quantity per final assembly for that node.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-9
- **Answer (2026-10-31, AQP-9; AQP-1 comment of 23:39):** "Count only all the child's cost. For example (part-1 has two sub-parts subpart-1 and subpart-2. The part-1's cost is the sum of its children subpart-1 and subpart-2." And: multiply a child's cost by its parent's quantity (2 x 3 = 6); a parent has no cost of its own.
- **Applied:** `ASSUMPTION-08` is replaced in part (it said a parent carries its own cost and BL sums all nodes). In his own words on AQP-9: only children's costs are counted and a parent's cost is the sum of its children. When parent inputs are 0 this equals the SPEC total. SPEC §6.1, §7.4 and §15 item 2 carry notes; SPEC §18 D-08; BR-023 and BR-046 in the catalogue.
- **Corrected and confirmed (UNC-d), 2026-11-01:** AQP-1 comment 10441 (d) repeated the 10415 wording (child cost x parent quantity) and he confirmed the list, but comment 10443 then corrected (d) and pointed to AQP-9. AQP-9 comment 10442 (same text on AQP-13, comment 10445): "The cost should be sum of costs of all children multiplied by item quantity. In the sample provided, item 1 (Row#1) has children, grand-children rows from 2 to 11. So, the parent's cost (BL2) is calculated as sum of the cells BG2 to BL11 and the result is multiplied by no. of the main (parent) item." The per-level "2 x 3 = 6" is withdrawn as written. The rule is applied in SPEC §6.1, §7.4 (BL), §14.2, §15 item 2 and §18 D-08; BR-023, BR-046 and BR-047 updated. The worked check against the sample is SPEC §18.5. Details still open: Q-32.

### Q-09 — Who supplies the starting master data  ·  BLOCKING [ANSWERED]
- **Question:** The SPEC names the Process Master items but gives no default values. The worksheet hard-codes a constant inside each formula and holds no lists of materials, customers or treatments (its second sheet holds only three text labels: customer master, material master, process master). Who will supply the starting data for: Process Master defaults, Material Master rows, exchange rates, customers and their rates, the Treatment/Color list, and the first users (Admin, Leads, Engineers)? In what form and by when?
- **Why it matters:** Acceptance test 2 (SPEC §14) needs known inputs and rates, and go-live needs real master data.
- **Assumption used until answered:** `ASSUMPTION-09` The client supplies these before UAT. Development and tests use invented placeholder values only. The constants in the worksheet formulas are the candidate Process Master defaults, subject to confirmation. See finding F-07.
- **Owner:** Santhosh  ·  **Needed by:** after G3 approval, before development starts (was G4)  ·  **Jira:** AQP-10
- **Answer (2026-10-31, AQP-10; AQP-1 comment of 23:39):** "The values will be entered while using the app for the first time. I shall also provide you the defaults. Ask me again after UX is reviewed and finalized and before starting the development."
- **Applied:** the Admin enters master data when the app is first used; the delivery lead will provide defaults. **Process stop:** after G3 approval and before development starts, the delivery lead is asked for the master data defaults. Until then development and tests use invented placeholder values only (NFR-023). `ASSUMPTION-09` replaced; TR-002 updated; new TR-009. SPEC §18 D-09.
- **Status:** the stop point is in his own words on AQP-10, so it is not part of the unconfirmed content.
- **For the orchestrator:** this stop point is not yet in `CLAUDE.md` or the approval-point list; the BA does not edit them.

### Q-10 — Export presentation details versus the sample [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** For the export, which of these apply: (a) use the sample's header texts word for word (for example "Part Number", "Qty / Assy", "Part Weight (if required)") or the SPEC's field labels; fix typos such as "Are in Sq.ft"; (b) header text for BL, BN and the empty BO header; (c) the sample's yellow header fill, Times New Roman 12, wrapped text, frozen header row, filter on the header row, and tall data rows for images; (d) number formats: the sample shows ₹ only on BG, BL and BM, $ on BJ, € on BK, one decimal on AV to BB, and General on BN and BO, whereas SPEC §2 says calculated values display to 2 decimals; (e) the sample's blank subtotal row (row 12) between item groups; (f) Fasteners (S) exported as "None" or 0 where there are none (the sample uses 0 in several rows).
- **Why it matters:** SPEC §10 says "replicate the sample exactly" but does not list these. Each is a testable export criterion. See findings F-03 to F-06, F-09, F-11.
- **Assumption used until answered:** `ASSUMPTION-10` (a) sample header texts verbatim for A to BN, typos corrected; BO header "Approved Quote Price"; (b) BL header "Total Unit Production Price (INR)", BN header "Total Unit Production Price (INR) / Tool Cost (INR)" as in SPEC; (c) replicate the sample's header style, wrap, frozen header row and filter; (d) ₹ on all INR money columns, $ on USD, € on EUR, 2 decimals; (e) no subtotal row; (f) "None".
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** — (non-blocking)
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-10` stands. No SPEC change.

### Q-11 — Rejection (BC) formula (SPEC §15 item 1) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** What is the rule for Rejection (BC)? The worksheet leaves BC empty in every row.
- **Why it matters:** Rejection allowance is part of every unit price.
- **Assumption used until answered:** `ASSUMPTION-11` Interim behaviour from SPEC: BC = 0, changeable by the Admin through the formula editor.
- **Owner:** Santhosh  ·  **Needed by:** G4  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-11` stands. No SPEC change.

### Q-12 — Network-folder links (SPEC §15 item 4) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Do users open the portal from office PCs that can reach the shared folders? Which browsers? Is a copy-path button acceptable if the browser blocks the `file:///` link?
- **Why it matters:** Browsers often block links from web pages to local files; the task is hard to start if the folder cannot be opened.
- **Assumption used until answered:** `ASSUMPTION-12` Interim behaviour from SPEC §5.1: `file:///` link plus "Copy path" button and a tooltip.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-12` stands. No SPEC change.
- **Pass 2 note:** if the portal is internet-hosted (Q-18), people outside the office network cannot open a shared-folder path, so the Copy path button matters more. The assumption is kept as instructed; the effect is for the delivery lead to weigh at G3.

### Q-13 — Remarks (AJ) mandatory (SPEC §15 item 5) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Must Remarks be filled on every part, even when there is nothing to say?
- **Why it matters:** A mandatory free-text field is often filled with filler text such as "NA".
- **Assumption used until answered:** `ASSUMPTION-13` Mandatory as specified; the Admin can switch it off per field.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-13` stands. No SPEC change.

### Q-14 — Plating flag (AD) unused in formulas (SPEC §15 item 6) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Confirm that the Plating flag (AD) is informational only and that Plating Cost (AU) is typed in by the Engineer. The worksheet matches this (AU has no formula).
- **Why it matters:** It affects the "hide zero treatment lines" rule: AD has no linked output to hide.
- **Assumption used until answered:** `ASSUMPTION-14` As specified: AD is stored and exported; AU is an input.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-14` stands. No SPEC change.

### Q-15 — "Not needed for this part" switch (SPEC §15 item 7) [CLOSED: not needed; closure confirmed]
- **Question:** Do you want a switch per section that sets the section's fields to 0 and collapses it? Should it also be the way to enter assembly parents (Q-06)? Which sections would it apply to?
- **Why it matters:** It speeds entry but changes the validation rule (blank versus zero) and the mandatory-field rule.
- **Assumption used until answered:** `ASSUMPTION-15` Not built in this release (still undecided as of 2026-10-31); the section layout leaves room to add it later.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39; closure confirmed in his own words in AQP-1 comment 10441 (f), UNC-f):** Not needed, because 0 is entered instead (Q-06). His own words on AQP-7 ("enter 0") support the reasoning.
- **Applied:** the switch is not built, which equals the SPEC interim behaviour. `ASSUMPTION-15` retired; DEC-05; SPEC §15 item 7 note; the switch is on the out-of-scope list in the brief. The formal closure is confirmed (AQP-1 comment 10441 (f)); SPEC §15 item 7 is marked closed.

### Q-16 — Sharper logo original (SPEC §15 item 8) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Can a sharper original of the logo (SVG, AI or a large PNG) be supplied, and by when?
- **Why it matters:** The supplied file is 200 × 200 px and may look soft on large screens and on the Excel/e-mail output.
- **Assumption used until answered:** `ASSUMPTION-16` Use `docs/03-ux/assets/accucut-logo.jpg` unchanged; replace when a better file arrives.
- **Owner:** Santhosh  ·  **Needed by:** G8  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-16` stands. No SPEC change.

### Q-17 — SEO and Open Graph on a login-only portal [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** The standing website standards ask for proper SEO meta tags and Open Graph title and description on every page, but the portal is login-only and internal. Search engines and social-media crawlers cannot see pages behind the login, so those tags give no search or sharing benefit on them. Which of these do you want: (a) tags on every page for consistency, with generic wording only and authenticated pages set to "do not index"; (b) full SEO only on the public sign-in page (and About, if public); (c) as (a) but the sign-in page may be indexed? Is a shared portal link ever pasted into chat or e-mail where a preview card would appear?
- **Why it matters:** Meta tags must never leak cost, rate or customer data (SPEC §17.6); wrongly indexed internal pages would be a confidentiality risk if the portal is reachable from the internet (Q-18). The requirement is kept, not dropped.
- **Assumption used until answered:** `ASSUMPTION-17` Option (a): every page has a title, meta description, Open Graph title and description with generic text; pages behind login are marked "do not index"; the sign-in page is not promoted for search.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-17` stands. No SPEC change.
- **Pass 2 note:** internet hosting (Q-18) makes the "do not index" setting on pages behind the sign-in more important.

### Q-18 — Hosting, access, web address, email service  ·  [OFFLINE DECIDED; hosting details OPEN, due G3]
- **Question:** Where will the portal run (office server, rented server, cloud), and from where will users open it (office network only, VPN, open internet)? What is the web address (the UI sample's About page shows a "[SITE URL]" placeholder)? Which e-mail service and sender address send the alerts? Who looks after backups and updates?
- **Why it matters:** It decides security controls, whether network-folder links work for users, e-mail delivery, whether SEO tags matter (Q-17) and the deployment design at G3. The UI sample also loads fonts from an external font service, which may not work on a restricted network.
- **Assumption used until answered:** `ASSUMPTION-18` Docker Compose deployment (SPEC §2) on a server reachable from the office network and, for remote users, by VPN; not public; SMTP details supplied by the client later; backups per the README guidance in SPEC §12.
- **Owner:** Santhosh (IT contact to be named)  ·  **Needed by:** the hosting details (web address, e-mail service and sender address, backups, who updates) at **G3**; the offline decision, due at G2, is made  ·  **Jira:** AQP-11
- **Answers on record:** AQP-11 comment 10405 (2026-10-31, 23:24): "It will be hosted on the internet. Should also be able to use as an offline app (like running a website locally) when there is no internet access." AQP-11 comment 10444 (2026-11-01): "we shall implement the offline release in next release". AQP-1 comment 10441 (e) (2026-11-01): Release 1 is internet only and offline comes later. The earlier AQP-1 comment 10415 said the same and is now confirmed.
- **Decision (UNC-e, confirmed):** Release 1 is hosted on the internet; offline use comes in the next release. `ASSUMPTION-18` is revised: the internet-hosting half is a decision, and the earlier assumption (office network or VPN, not public) stays withdrawn. The conflict between AQP-11 comment 10405 and the later comments is closed for Release 1.
- **Still open:** what "offline" will mean in the next release (a full copy running on a local PC, or an entry form that works without a connection and sends later; settle it when that release is planned), the web address, the e-mail service and sender address, who looks after backups and updates, and whether the site is open to anyone on the internet beyond the sign-in page. Internet exposure also raises Q-12 (network-folder links) and Q-17 (SEO and Open Graph).
- **Applied:** SPEC §2, §18 D-10 and §18.3; catalogue BRQ-014 (Won't for Release 1, confirmed) and ASSUMPTION-18; brief scope and risks. The offline part is closed; the question stays open for the hosting details (needed by G3, not blocking G2).

### Q-19 — After Calculate: can the Engineer still edit? Is there a return path? [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** After the Engineer clicks Calculate (status SUBMITTED), may the Engineer still change inputs? SPEC §3 allows Engineers to edit "while unlocked"; SPEC §6.3 offers Recalculate only to Lead/Admin; the DOCX says the Lead "edits or recalculates if needed". Should a Lead be able to send an estimate back to the Engineer with a comment? What status does an unlocked estimate return to (SPEC §6.3 says "DRAFT/SUBMITTED")?
- **Why it matters:** It defines the status model and who can edit when.
- **Assumption used until answered:** `ASSUMPTION-19` Engineer inputs become read-only once SUBMITTED; the Lead/Admin edit and recalculate; there is no "return to Engineer" action; unlock returns the estimate to DRAFT.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-19` stands. No SPEC change.

### Q-20 — Task changes: reassign, change deadline, cancel [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Can a Lead/Admin reassign a task to another Engineer, change its deadline, or cancel it? If yes, are those actions e-mailed and logged?
- **Why it matters:** SPEC §5 covers only creating tasks.
- **Assumption used until answered:** `ASSUMPTION-20` Reassign and deadline change are available to Lead/Admin and logged; cancel is not provided until confirmed.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-20` stands. No SPEC change.

### Q-21 — Confirm the `[DEFAULT]` decisions in the SPEC [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** The SPEC marks about 20 items `[DEFAULT]` ("implementation decisions taken on the client's behalf"). They are not in the DOCX (finding F-13). Please confirm, or change, as a group or individually. The list is in `requirements-catalog.md` under "Assumptions" (ASSUMPTION-30 onwards).
- **Why it matters:** Several are business policy, not technology: Engineers cannot download the export, Admin creates users, a task closes when approved, unlock needs a reason, numbers are not negative, a percentage is typed as 12 meaning 12%.
- **Assumption used until answered:** `ASSUMPTION-21` All `[DEFAULT]` items stand as written in the SPEC.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-21` stands. No SPEC change.

### Q-22 — Estimate / task ID format [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** The UI sample shows estimate IDs like "Q-2026-1042", and SPEC §10 uses `<TaskId>` in the file name without defining it. What format should estimate or task IDs have, and do they restart each year?
- **Why it matters:** The ID appears on screens, in e-mails and in file names and is how people refer to an estimate.
- **Assumption used until answered:** `ASSUMPTION-22` `Q-<year>-<4-digit running number>` as shown in the UI sample; one estimate per task, same ID.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-22` stands. No SPEC change.

### Q-23 — Admin succession and deactivated users [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** There is exactly one Admin. How is the Admin role handed over if that person leaves or is absent? What happens to open tasks of an Engineer who is deactivated?
- **Why it matters:** One Admin is a single point of failure for masters, formulas and users.
- **Assumption used until answered:** `ASSUMPTION-23` The Admin can transfer the role to another active user in one confirmed step (still exactly one active Admin); open tasks of a deactivated Engineer stay visible to Lead/Admin and can be reassigned (Q-20).
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-23` stands. No SPEC change.

### Q-24 — Volumes, user numbers and current turnaround (baseline) [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Roughly how many Admin, Lead and Engineer users; how many estimates a month; how many parts a typical and the largest estimate holds; and how long an estimate takes today from request to approved price?
- **Why it matters:** The inputs give no baseline, so the success measures in the brief cannot show improvement yet, and the 500-node performance figure in SPEC §12 is unverified against real use.
- **Assumption used until answered:** `ASSUMPTION-24` Fewer than 50 users and 500 parts at most per estimate (SPEC §12); no turnaround target is set until a baseline is given.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-24` stands. No SPEC change.
- **Pass 2 note:** the sample has only a couple of items (Q-03). The 500-node figure stays an unverified upper bound.

### Q-25 — Historical estimates, cut-over and parallel run [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** Do past Excel estimates need to be loaded into the portal, or only be kept as files? Will the spreadsheet and the portal run side by side for a period, and for how many estimates? Who trains the Engineers and Leads?
- **Why it matters:** An import is a separate piece of work; a parallel run needs a comparison method (the portal must match the worksheet).
- **Assumption used until answered:** `ASSUMPTION-25` No import of past estimates; new tasks go into the portal after a parallel run of a few estimates; training by the delivery team.
- **Owner:** Santhosh  ·  **Needed by:** G4  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-25` stands. No SPEC change.
- **Pass 2 note:** a parallel run and training follow the development date (Q-29 answered: the date is a hand-over for testing and acceptance, not go-live).

### Q-26 — Data retention and personal-data obligations [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** How long must estimates, audit logs and e-mail logs be kept? The portal stores user names and e-mails and customer contact details (name, phone, e-mail, address). Does Accucut have a data-protection or retention policy, and does any customer contract limit where their data may be stored?
- **Why it matters:** India's Digital Personal Data Protection Act, 2023 and the IT Act 2000 rules may apply to this contact data (assessed from general knowledge, not from web research; to be confirmed with the company's legal adviser). EU customers (EUR pricing) could add GDPR if their personal data is held, which is unlikely for business contact data alone.
- **Assumption used until answered:** `ASSUMPTION-26` Keep everything until the company states a policy; business contacts only; no personal data of customers' staff beyond name, phone, e-mail and address; no real personal data in tests or fixtures.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-26` stands. No SPEC change.

### Q-27 — Overdue colour versus brand red; mobile navigation pattern [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** With red as the brand colour, the UI sample's orange for "overdue" and red for errors become hard to tell apart. Confirm that overdue stays orange-amber with an icon and text, errors use the darker red with icon, thick border and text (SPEC §17.2), and that active markers use the brand red. For small screens SPEC §11 asks for a bottom or hamburger navigation, but the UI sample turns the side menu into a scrolling top bar below 860 px. Which pattern do you want?
- **Why it matters:** Status must never rely on colour alone (SPEC §11, §17.2), and the two sources conflict on navigation.
- **Assumption used until answered:** `ASSUMPTION-27` Overdue = orange-amber plus icon plus "Overdue by X" text; navigation as in SPEC §11 (it overrides the sample); the UX expert proposes the detail at G3.
- **Owner:** Santhosh (decision), ux-expert (proposal)  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-27` stands. No SPEC change.

### Q-28 — Walk-through of today's estimation process [ASSUMPTION KEPT, CONFIRMED 10441 (g)]
- **Question:** The inputs describe the target process but not today's. Could an Engineer and a Lead describe how an estimate is done now (who asks, where files live, how prices are approved, how often the sheet is wrong or late)? Even a 30-minute call is enough.
- **Why it matters:** Without it the "as-is" process in `process-as-is-to-be.md` is inferred, and pain points cannot be tied to evidence.
- **Assumption used until answered:** `ASSUMPTION-28` The as-is steps are inferred from the DOCX and the worksheet and are labelled as such.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer (AQP-1 comment 10415 of 23:39, confirmed in his own words in AQP-1 comment 10441 (g)):** assumption kept; `ASSUMPTION-28` stands. No SPEC change.

### Q-29 — What the 2026-11-13 date delivers  ·  [ANSWERED, 2026-11-01]
- **Question:** Q-01 gives 10 working days at 8 hours a day (80 hours in all), 2026-11-02 to 2026-11-13, with no budget limit. Does the date mean (a) Release 1 built, deployed and ready for your acceptance at G8; (b) production go-live, which also needs master data entry, training and the parallel run (TR-004, Q-25); or (c) a first usable part of the SPEC, with the rest later? The SPEC build order has 10 steps and 14 acceptance criteria; the process has human gates (G1, G3, G8); and Q-09 adds a stop for master data defaults after G3 approval. If all of it does not fit, should the product manager propose what comes first, using the SPEC §13 order?
- **Why it matters:** The release plan and MVP scope at G2 depend on it. The business analyst makes no estimate of effort; this question asks what the date means.
- **Assumption used until answered:** `ASSUMPTION-45` The date is the Release 1 delivery date (option a). Go-live, training and the parallel run follow it. If the SPEC does not fit, the product manager proposes a first release at G2 from the SPEC §13 order and the delivery lead decides.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12)
- **Answer (2026-11-01, AQP-12 comment 10446, his own words):** "The deadline is only to complete the development and give that version to my customer for testing and acceptance / propose new changes. So we come back and decide the next steps. Please provide the realistic date to complete development and continue with the next steps. Do not take this as a blocker if you think the development cannot be completed by the given date."
- **Applied:** the date is a **target** for completing development and handing that version to his customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live, and he asks for a realistic completion date and says the date is not a blocker. `ASSUMPTION-45` is replaced (catalogue); CONSTRAINT-07 becomes a target; SPEC §18 D-01. Supplying the realistic date is a product-manager and orchestrator action (release plan), not a business-analyst estimate. His reply does not say which scope the realistic date covers: Q-34.
- **Status:** Answered. No longer blocking G2.

### Q-30 — Cleaned sample copy for the repository; blank template  [NEW]
- **Question:** Q-03 confirmed `AMADA-20261006.xlsx` as the sample. May a cleaned copy (real customer and part data removed) be placed at `docs/reference/sample-estimate.xlsx`, and who prepares it? Is there a blank company template that differs from this filled example?
- **Why it matters:** SPEC §10 reads column widths, headers and formats from `docs/reference/sample-estimate.xlsx`. The original holds real-looking customer and part data and must not be committed (NFR-023).
- **Assumption used until answered:** `ASSUMPTION-46` The original is not committed and no cell data is copied into any artefact, Jira or GitHub. Header texts, widths and formats are taken from the structure findings (F-05, F-06, F-11), and the delivery team reads them from the original on the delivery lead's machine only.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** — (non-blocking)
- **Answer:**

### Q-31 — Sample shows totals per top-level item; the answers give one total per estimate  [NEW]
- **Question:** Q-04 and Q-05 say one estimate is one product with one total, and BN = BL / total of all Tool Cost entries (confirmed). The sample worksheet has two top-level items, each with its own BL, and BN beside the first row of its second item (findings F-01, F-02). In the Excel export, should BL, BN and BO appear only in row 2 (SPEC §10), or also for each top-level item as in the sample? Should the export also show a total of Tool Cost?
- **Why it matters:** BRQ-005 and acceptance test 12 require the export to match the sample; the answers and the sample differ. The SPEC text (row 2 only) is kept until you decide.
- **Assumption used until answered:** `ASSUMPTION-47` As the SPEC says: BL, BN and BO in row 2 only; no per-item totals; no separate Tool Cost total column.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** — (non-blocking)
- **Answer:**

### Q-32 — Roll-up details left after the corrected cost rule  ·  BLOCKING by definition (recommended due G3)  [OPEN, REVISED IN PASS 3]
- **What was asked first (Pass 2):** whether the multiplication passes through every level, whether a parent's displayed cost includes its own quantity, how a non-zero cost on a parent is treated, and whether the worksheet arithmetic is wrong when a parent's quantity is above 1.
- **Answer so far (2026-11-01, AQP-9 comment 10442 and AQP-13 comment 10445, same text; AQP-1 comment 10443 points to it):** "The cost should be sum of costs of all children multiplied by item quantity. In the sample provided, item 1 (Row#1) has children, grand-children rows from 2 to 11. So, the parent's cost (BL2) is calculated as sum of the cells BG2 to BL11 and the result is multiplied by no. of the main (parent) item." This replaces the earlier per-level idea (child cost x parent quantity, 2 x 3 = 6), which is withdrawn as written. The rule is in SPEC §7.4 (BL) and §18 D-08.
- **What the sample shows (worked check in SPEC §18.5; no cell values are written in the repository):** the worksheet's BL2 is `SUM(BG2:BG11)`, and re-adding BG2 to BG11 reproduces the stored value exactly. Reading "BG2 to BL11" as a rectangle (columns BG to BL) adds exchange rates and the USD and EUR columns and gives a total about 16 % higher, so the range is column BG only. Every Qty / Assy in the sample is 1, so the sample cannot show where the quantity multiplies. Parts 1.4 and 1.5 are parents with inputs of their own; the worksheet counts their own cost, and a "children only" reading would make the total about 59 % lower.
- **Questions remaining** (nothing below is resolved by guessing):
  (a) Does a quantity above 1 on a part between the item and a lowest-level part also multiply? Example: item quantity 2, part 1.4 quantity 3, sub-part 1.4.1 quantity 4. Multiplying once at the top, as his sentence and the worksheet read: the sub-part counts 2 x 4 = 8 and part 1.4's own cost counts 2 x 3 = 6. Multiplying at every level: the sub-part counts 2 x 3 x 4 = 24.
  (b) A parent that has children and also non-zero inputs of its own (the sample's parts 1.4 and 1.5): is its own cost counted (the worksheet counts it, and his cell range includes those rows) or only its children's (the literal wording of AQP-9 comment 10403, "part-1's cost is the sum of its children")?
  (c) The item's own row already includes the item's own quantity in BG. If that row has non-zero inputs and a quantity above 1, is the quantity applied twice (once in BG, once as the multiplier)? D-06 says an item that needs nothing gets 0, so this matters only if the item has inputs of its own.
  (d) An estimate with several top-level items (the sample has item 1 and item 2): is the estimate's BL the sum, over the top-level items, of each item's quantity x its rows? (Related: Q-31.)
  (e) Confirm the cell reading: "BG2 to BL11" means column BG, rows 2 to 11, the worksheet's `SUM(BG2:BG11)`.
- **Why it matters:** It decides every quoted price and the basis for the "matches the worksheet" requirement (BRQ-004) and GOAL-03, whose test oracle depends on it. The formula language (SPEC §8.2) has SUM over all nodes; the roll-up needs a design decision from the solution architect.
- **Assumption used until answered:** `ASSUMPTION-48` (revised in Pass 3) (a) multiply once, at the top item, with each row keeping its own quantity inside BG; (b) a parent's own BG counts, as in the worksheet; (c) the item quantity multiplies the sum once, with no special handling of the item's own row; (d) the estimate's BL is the sum over its top-level items; (e) column BG. The parallel run (TR-004) and acceptance test 2 (SPEC §14.2) compare with a worksheet calculated the same way; at item quantity 1 this equals the worksheet exactly.
- **Does it block G2? Business-analyst view: it should not.** The assumption reproduces the sample's stored total, every reading gives the same result on the sample, and the open points change the roll-up rule, not the product scope. They must be answered before the roll-up is designed (G3). The decision to hold or pass G2 is the master's.
- **Owner:** Santhosh  ·  **Needed by:** G3 (recommended; it was G2)  ·  **Jira:** [AQP-13](https://sankumar76.atlassian.net/browse/AQP-13)
- **Answer:**

### Q-33 — Values and handling of the "Not applicable" Material row  [OPEN]
- **Question:** Q-06 adds "Not applicable" to the Material list (confirmed). What should its Material-Considered, price per kg, specific gravity and scrap rate be (0?), may the Admin edit or delete it, and should the Treatment / Color "Not applicable" entry also be locked against deletion?
- **Why it matters:** Material cost (AK) uses these values; a wrong value would put a cost on a part that has none. A deleted entry would stop Engineers from completing assembly parents.
- **Assumption used until answered:** `ASSUMPTION-49` Both entries are created by the system at first install, with Material-Considered "Not applicable" and price, specific gravity and scrap rate all 0; the Admin cannot delete or rename them.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** — (non-blocking)
- **Answer:**

### Q-34 — Which scope the realistic development completion date covers  [NEW, Pass 3]
- **Question:** AQP-12 comment 10446 asks for a realistic date to complete development and says 2026-11-13 is not a blocker. Should that date cover (a) everything in the SPEC except offline use (next release, confirmed) and the items the SPEC itself defers, or (b) the first-release proposal in the release plan (sign-in and roles, masters, calculation engine, tasks and queues, estimate workspace, cost view with approval, Excel export), with the Admin screens for fields and formulas and the e-mail alerts in a later release?
- **Why it matters:** The realistic date depends on the scope. The first-release proposal was posted on AQP-12 (comment 10433) as a proposal only, not agreed, and his reply does not say whether to keep it.
- **Assumption used until answered:** `ASSUMPTION-50` The product manager states a realistic development completion date for both (a) and (b) from the release plan, and the delivery lead picks at G2. The business analyst makes no estimate.
- **Owner:** Santhosh (decision), product-manager (dates)  ·  **Needed by:** G2  ·  **Jira:** — (non-blocking)
- **Answer:**

---

## 3. Source comparison findings

The SPEC, the DOCX, the XLSX and the UI were compared. These are **reported, not resolved**; each links to the question that asks the delivery lead to decide. XLSX facts are about structure only.

### 3.1 SPEC against the XLSX (sample worksheet)

| ID | Finding | SPEC reference | Question |
|----|---------|----------------|----------|
| F-01 | The sheet has two top-level items. Item 1's BL is a sum over its own rows (parent plus children); item 2 has its own BL (equal to its own BG), BM and BN on its first row. SPEC has one BL, BN and BO, in row 2 only. | §6.1, §7.4, §10 | Q-04 |
| F-02 | BM (Tool Cost) is filled on one row only (item 2's first row), and BN = BL / BM sits on that row, not row 2. SPEC: BM is a per-part input; BN in row 2. UI sample shows BM beside the estimate total. | §7.1 (08), §7.4 | Q-05 |
| F-03 | The BO header cell is empty and no row has a BO value; the sheet has no Approved Quote Price column. SPEC, DOCX and UI add it as BO. The sheet's formatted area runs to column DF. | §7.4, §10 | Q-10 |
| F-04 | The sheet has a blank-Sl.-No subtotal row (row 12) with sums in BG, BJ and BK. SPEC says one row per tree node and does not mention a subtotal row. | §10 | Q-10 |
| F-05 | Header texts differ from SPEC labels, for example: "Part Number" (SPEC "Part No."), "Qty / Assy" (SPEC "QTY per Assy"), "Part Weight (if required)", "Scrap Weight (if required)", "Are in Sq.ft" (typo), "Welding " with a trailing space (SPEC "Weld"), BE and BF headers carry "%" though they hold amounts, BG "Unit Product Price in INR" (SPEC "Unit Production Price (INR)"), BL "Unit Product Price in INR" (SPEC "Total Unit Production Price (INR)"), BN "Unit Product Price + Tool Cost" (SPEC "… / Tool Cost (INR)"). Surface-treatment input and cost headers share names (Z and AQ, and so on). | §7.1, §7.4, §10 | Q-10 |
| F-06 | Number formats: ₹ on BG, BL, BM only; $ on BJ; € on BK; "0.0" (one decimal) on AV to BB; "0.00" on I, M, O, AH, AI, AK to AN, AT; General on most inputs, AO, AP, AQ to AS, AU, BN, BO; no currency on BH and BI. SPEC: ₹ for INR columns, 2 decimals for display. | §2, §10 | Q-10 |
| F-07 | Every output formula in the sheet matches the SPEC and DOCX (same terms in AY, BA, BB, BG, and so on). But the sheet hard-codes constants for every rate, specific gravity, scrap rate and the three percentages, types exchange rates per row (different USD values appear in different rows, EUR only on some rows), and leaves BC empty. SPEC moves all of these to masters and gives no default values. | §4, §7.4 | Q-09, Q-07, Q-11 |
| F-08 | The parent row (item 1) has no material or treatment and zeros for dimensions, but SPEC makes E and G mandatory on every node. | §7.1, §7.3 | Q-06 |
| F-09 | Fasteners (S) holds 0 in several rows and text in others; SPEC default is "None". Sl. No is stored as a number in some rows (for example 1.1) and as text in others (1.1.1), so a number like 1.10 would lose its zero; SPEC §10 says the export writes Sl. No as text. | §7.1, §10 | Q-10 |
| F-10 | The sample tree has parts 1.4.1 and 1.5.1 in addition to those in the SPEC and DOCX example (1.1 to 1.5, with 1.1.1 and 1.1.2). Informational: the tree depth example is a subset. | §6.1 | — |
| F-11 | Extra structure not in SPEC §10: header row in yellow fill, Times New Roman 12, wrapped; header height about 70 pt and data rows about 110 pt (room for images); frozen header row; a filter on the header row; three worksheets (second has three text labels, third is empty); a cell note on the Blank Weight header; formula-only rows below the data with no inputs. Six images are embedded in column C, each under about 90 KB, which is consistent with the 200 KB limit. | §10 | Q-10, Q-03 |
| F-12 | The sheet has no drop-down lists (no data validation) and no lists of materials, customers or treatments. | §4.3, §4.5 | Q-09 |

### 3.2 SPEC against the DOCX (Draft v5)

| ID | Finding | Question |
|----|---------|----------|
| F-13 | The SPEC adds decisions that are **not in the DOCX**, marked `[DEFAULT]` or stated plainly: Admin creates/deactivates users and resets passwords; password reset by e-mailed link; Engineers cannot download the export; Lead queue default "Assigned by me"; task title/notes; task closes on approval and reopens on unlock; unlock logs a reason; numbers are not negative; Surface Treatment may be empty; percent rates typed as 12 for 12%; division by zero shows "—" and exports empty; extra functions MIN, MAX, ROUND, IF; autosave every 30 s; light and dark mode; export file name; Process Master delete blocked while formulas use the item; the daily digest goes only to Engineers who have overdue tasks (DOCX says "each Engineer"); a formal ConfigVersion model; retry and log of failed e-mails; WCAG 2.1 AA; performance figures. | Q-21 |
| F-14 | The DOCX and SPEC agree on roles, masters, sync rules (SPEC adds rule 5 on deletion), queues, e-mail triggers, section layout, all formulas, re-lettering, checkpoints, change history, and the export rules. No conflict was found in formulas or column letters. | — |
| F-15 | The DOCX Lead column does not list entering input fields; SPEC §3 allows Lead to enter and edit inputs. The DOCX workflow says the Lead "edits or recalculates if needed", which supports the SPEC. | Q-19 |

### 3.3 SPEC against the UI sample, and the spec against itself

| ID | Finding | Question |
|----|---------|----------|
| F-16 | The UI sample shows items not in the SPEC: "Awaiting review" and "Closed this month" tiles, a global search box, per-Engineer open-task counts on the assign screen, estimate IDs like "Q-2026-1042", a "Visible to Engineer" attribute in the field configuration, and Tool Cost beside the estimate total. The delivery lead's direction (SPEC §17.1) is to keep its structure and make it more advanced, so these are candidates, not requirements, until the product manager decides. | Q-05, Q-22 |
| F-17 | Navigation on small screens: SPEC §11 says bottom or hamburger navigation; the UI sample turns the side menu into a scrolling top bar below 860 px. | Q-27 |
| F-18 | Colours: the UI sample uses blue (primary), navy navigation and orange for overdue; SPEC §17.2 replaces blue and navy with "Red Leads" and keeps a separate error red. Overdue orange and brand red need clear separation. The brand red (about #DE3030) on white gives a contrast ratio of about 4.6 to 1 (calculated by the analyst), which only just meets the 4.5 to 1 AA threshold for normal text, so hover, disabled and small-text uses may fail. | Q-27 |
| F-19 | The UI sample loads its fonts from an external service. This may not work on a restricted network and is a privacy and availability consideration. | Q-18 |
| F-20 | SPEC §17 already contains the delivery lead's decisions of 2026-10-31 (guided form with column letters, Red Leads brand, rejected copy features, drawing input deferred, SEO tags). The instruction to Pass 1 said they are not yet in the spec; they are. Pass 2 therefore needs only consistency edits (see catalogue DEC-01 to DEC-06) plus the answers to these questions. | — |
| F-21 | SPEC internal tension: all visible inputs are mandatory (§7.3) but Surface Treatment may be empty (§7.3) and Remarks is mandatory (§15.5); ConfigVersion pins formulas but not master values (§8.4, Q-07); BM is mandatory on each part but used once (§7.1, §7.4). | Q-05, Q-07, Q-13 |

### 3.4 Findings added in Pass 2 (answers compared with the SPEC and the sample)

| ID | Finding | Question |
|----|---------|----------|
| F-22 | The answers give one total per estimate (Q-04) and a BN divisor equal to the total of all Tool Cost entries (Q-05). The sample shows totals per top-level item and BN beside the first row of its second item. Numerically, a single Tool Cost entry gives the same BN under both rules; the placement differs. | Q-31 |
| F-23 | The Q-08 rule (count only children; a parent's cost is the sum of its children; a child's cost is multiplied by its parent's quantity) differs from SPEC §7.4 (BB = BA x own H; BL = sum of BG over all nodes), from SPEC §6.1 ("each node's costs are calculated individually") and from the worksheet formulas, which match the SPEC (F-07). Results differ whenever a parent's quantity is above 1. Acceptance test 2 and BRQ-004 compare with the worksheet. The SPEC text was kept in Pass 2. **Pass 3:** superseded by the delivery lead's corrected rule (AQP-9 comment 10442); on the sample it agrees with the worksheet (SPEC §18.5); the remaining differences are in Q-32. | Q-32 |
| F-24 | The two answers on hosting conflict: AQP-11 asks for internet hosting and offline use; the later AQP-1 comment moves offline use to a later release. Internet hosting also withdraws the earlier assumption of an office-network or VPN server (ASSUMPTION-18) and raises the importance of Q-12 (network-folder paths cannot be reached from outside the office) and Q-17. **Pass 3:** the conflict is closed for Release 1 (AQP-1 comment 10441 (e), AQP-11 comment 10444). | Q-18 |
| F-25 | Q-06 (enter 0; "Not applicable") and Q-08 (a parent has no cost of its own) overlap: a parent still needs every field filled, yet its own cost is not counted. How a non-zero value on a parent is treated is not stated. **Pass 3:** the sample's parts 1.4 and 1.5 have inputs of their own, which makes this a real case (SPEC §18.5). | Q-32 (b), Q-33 |

---

## 4. Answers log (Pass 2, updated in Pass 3 for the delivery lead's own-words replies of 2026-11-01)

| Q | Date | Answered by | Answer (short) | Source | Status | Spec / catalogue change |
|---|------|-------------|----------------|--------|--------|-------------------------|
| Q-01 | 2026-10-31; 2026-11-01 | Santhosh - MD | No budget limit; start 2026-11-02; 10 working days x 8 h; Monday-to-Friday week ending 2026-11-13 as a **target, not a fixed constraint** | AQP-2; AQP-1 (10417, 10441 (h)); AQP-12 (10446) | Answered | SPEC §18 D-01; CONSTRAINT-07 (target); ASSUMPTION-01 replaced; Q-29 answered |
| Q-02 | 2026-10-31 | Santhosh - MD | One person | AQP-3 | Answered | SPEC §18 D-02; ASSUMPTION-02 confirmed; brief, stakeholder map |
| Q-03 | 2026-10-31 | Santhosh - MD | Yes, the sample; Engineers enter inputs, Admin and Leads view costs, Excel export needed | AQP-4 | Answered in part (remainder Q-30) | SPEC §18 D-03, §10, §15.3; ASSUMPTION-03 confirmed; Q-30 raised |
| Q-04 | 2026-10-31 | Santhosh - MD | One estimate = one complete product with items, parts, sub-parts and so on | AQP-5 | Answered | SPEC §6.1 note, §18 D-04; ASSUMPTION-04 confirmed; Q-31 raised |
| Q-05 | 2026-10-31; 2026-11-01 | Santhosh - MD | Engineer enters Tool Cost (AQP-6). BN = BL / total of all Tool Cost entries (confirmed) | AQP-6; AQP-1 (10441 (a)) | **Answered** (UNC-a confirmed) | SPEC §7.4 BN, §10, §18 D-05 replaced; BR-023, BR-003; ASSUMPTION-05 confirmed |
| Q-06 | 2026-10-31; 2026-11-01 | Santhosh - MD | Enter 0 if not required (AQP-7). "Not applicable" in the Material and Treatment lists (confirmed) | AQP-7; AQP-1 (10441 (b)) | **Answered** (UNC-b confirmed); values: Q-33 | SPEC §4.3, §4.5, §7.1, §7.3, §18 D-06 replaced; BR-007, BR-048, DR-008, DR-010; ASSUMPTION-06 replaced |
| Q-07 | 2026-10-31; 2026-11-01 | Santhosh - MD | Approved estimates unaffected by any change (AQP-8). Recalculation after unlock uses current rates with a notice (confirmed) | AQP-8; AQP-1 (10441 (c)) | **Answered** (UNC-c confirmed) | SPEC §8.4, §18 D-07 replaced; BRQ-008, BR-012, UR-029, DR-003; ASSUMPTION-07 confirmed |
| Q-08 | 2026-10-31; 2026-11-01 | Santhosh - MD | Cost = sum of the costs of all children x item quantity; BL2 = sum of the cells "BG2 to BL11" x quantity of the main item | AQP-9 (10403, 10442); AQP-13 (10445); AQP-1 (10441 (d), 10443) | **Answered, confirmed as corrected** (UNC-d); open details: Q-32 | SPEC §6.1, §7.4 BL, §14.2, §15.2, §18 D-08 replaced; BR-023, BR-046, BR-047; ASSUMPTION-08 replaced, ASSUMPTION-48 revised |
| Q-09 | 2026-10-31 | Santhosh - MD | Entered at first use; defaults to be provided; ask again after UX final and before development | AQP-10 | Answered | SPEC §18 D-09; TR-002, TR-009; ASSUMPTION-09 replaced |
| Q-15 | 2026-10-31; 2026-11-01 | Santhosh - MD | Not needed; 0 is entered instead; Q-15 closed | AQP-1 (10415, 10441 (f)) | **Closed, confirmed** (UNC-f) | SPEC §15.7 closed, §18 D-06; DEC-05; ASSUMPTION-15 retired |
| Q-18 | 2026-10-31; 2026-11-01 | Santhosh - MD | Release 1 is internet-hosted; offline use in the next release | AQP-11 (10405, 10444); AQP-1 (10441 (e)) | **Offline decided** (UNC-e confirmed); hosting details open, due G3 | SPEC §2, §18 D-10, §18.3; ASSUMPTION-18 revised; BRQ-014 Won't (Release 1) |
| Q-29 | 2026-11-01 | Santhosh - MD | The date is the target to complete development and hand over for testing, acceptance and change requests; he asks for a realistic date and says it is not a blocker | AQP-12 (10446) | **Answered**; scope behind the date: Q-34 | SPEC §18 D-01; ASSUMPTION-45 replaced; CONSTRAINT-07 (target); Q-34 raised |
| Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | 2026-11-01 | Santhosh - MD | Keep the stated assumptions | AQP-1 (10441 (g); first stated in 10415) | Assumption kept, **confirmed** (UNC-g) | None; Pass 2 notes on Q-12, Q-17, Q-24, Q-25 stand |

**Provenance note (updated in Pass 3).** All comments on AQP-1 and AQP-2 to AQP-13 show one account name, so authorship cannot be told apart in Jira by name. The replies of 2026-11-01 are on the issues the questions sit on: AQP-1 (10441, 10443), AQP-9 (10442), AQP-13 (10445), AQP-11 (10444) and AQP-12 (10446). They are treated as the delivery lead's own words because they answer the orchestrator's request on AQP-1 (G1 condition 1) item by item and add his own corrections: comment 10443 corrects item (d), comment 10442 supplies a rule and a worked example from the sample in his own phrasing, and comment 10446 qualifies the date. Comment 10441 itself repeats the orchestrator's list, but it opens with his sentence "I confirm the below items that I answered already". The earlier comments 10415 and 10417 were assistant-drafted wording (origin findings below), and his later replies confirm the content of 10415 item by item except where noted.

Origin findings (from the G1 gate record, `docs/00-governance/gate-log.md`; the BA did not read any session log):
- Comment 10415 is text an assistant recommended to the delivery lead in a Claude Code session at 2026-11-01 03:37:45Z. The recommendation told him to change anything that did not match how he works, "especially Q-08". It reached Jira 1 minute 55 seconds later, unedited, with the instruction line ("Edit this and post it on AQP-1") included. No tool call in the session logs posted it, so he very probably pasted it himself. He then asked for autopilot to resume, and comment 10417 was posted and autopilot started 11 seconds apart.
- Conclusion of the gate record: **likely adopted, not confirmed.** The wording was not his, it was not edited, and nothing showed he decided each item. That is why G1 condition 1 asked him to confirm each item in his own words.
- The difference from the worksheet came entirely from the 10415 sentence on quantity (UNC-d). He has now replaced it with a rule of his own (AQP-9 comment 10442); on the sample it agrees with the worksheet (SPEC §18.5), and the questions that remain are in Q-32.
- Comment 10417 was also an assistant draft posted unchanged. The start date (2026-11-02) and 10 working days are his own words (AQP-2); the Monday-to-Friday week ending 2026-11-13 is confirmed in comment 10441 (h) and qualified by comment 10446.

**Register of formerly unconfirmed content (G1 condition 1, items (a) to (h)).** All eight items now have his reply. If he later changes any of them, reverse it in the SPEC, catalogue and brief and log the reason.

| ID | Condition 1 item | Question | Where it appears | Status | His reply (comment ID) |
|----|------------------|----------|------------------|--------|------------------------|
| UNC-a | BN = BL / total of all Tool Cost entries | Q-05 | SPEC §7.4, §10, §18 D-05; BR-023, ASSUMPTION-05 | **CONFIRMED** | AQP-1 10441 (a) |
| UNC-b | "Not applicable" in the Material and Treatment lists | Q-06, Q-33 | SPEC §4.3, §4.5, §7.1, §7.3, §18 D-06; BR-048, DR-008, DR-010, ASSUMPTION-49 | **CONFIRMED**; values: Q-33 | AQP-1 10441 (b) |
| UNC-c | Recalculation after unlock uses current rates, with a notice | Q-07 | SPEC §8.4, §18 D-07; BR-012, UR-029 | **CONFIRMED** | AQP-1 10441 (c) |
| UNC-d | Child cost x parent quantity (2 x 3 = 6) | Q-08, Q-32 | SPEC §6.1, §7.4, §14.2, §15 item 2, §18 D-08; BR-023, BR-046, BR-047, ASSUMPTION-48 | **CONFIRMED AS CORRECTED**: replaced by "sum of the costs of all children x item quantity"; details: Q-32 | AQP-1 10441 (d), 10443; AQP-9 10442; AQP-13 10445 |
| UNC-e | Release 1 internet only, offline later | Q-18 | SPEC §2, §18 D-10; BRQ-014, ASSUMPTION-18 | **CONFIRMED** (closes the conflict with AQP-11 comment 10405) | AQP-1 10441 (e); AQP-11 10444 |
| UNC-f | Q-15 closed ("Not needed" switch) | Q-15 | SPEC §15 item 7, §18 D-06; DEC-05, ASSUMPTION-15 | **CONFIRMED** | AQP-1 10441 (f) |
| UNC-g | Keep the stated assumptions for Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28 | those questions | SPEC §18 D-11; catalogue assumptions 10 to 44 | **CONFIRMED** | AQP-1 10441 (g) |
| UNC-h | Monday-to-Friday week, ending 2026-11-13 | Q-01, Q-29 | SPEC §18 D-01; CONSTRAINT-07, ASSUMPTION-45 | **CONFIRMED AS A TARGET, QUALIFIED**: not a fixed constraint | AQP-1 10441 (h); AQP-12 10446 |

G1 conditions: condition 1 is met by comments 10441 and 10443 (with (d) corrected and (h) qualified as shown). Condition 2 (AQP-13, Q-32) has an answer from him (comment 10445), which leaves the details in Q-32 open; he did not accept ASSUMPTION-48 explicitly, so it is revised and carried. Condition 3 (AQP-12, Q-29) is answered by comment 10446. Whether the conditions are met is the master's decision.
