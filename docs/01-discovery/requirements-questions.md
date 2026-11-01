# Requirements Questions and Source Findings — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 (Discovery Pass 1) |
| Author | business-analyst |
| Date | 2026-10-31 |
| Status | Awaiting delivery lead answers (G1) |
| Intake issue | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

**How to answer.** Reply on AQP-1 as `CHANGES: Q-01 <answer>; Q-04 <answer> …`, or write `APPROVED` to accept the stated assumptions for every question. Blocking questions also have their own Jira issue (key shown in the table). In Pass 2 the answers are copied into the Answer lines below and into `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`.

**Owner for every question** is Santhosh (delivery lead) unless the question names someone else. **Blocking** means the question decides scope, data model, price correctness or architecture, so delivery should not pass the "needed by" gate on the assumption alone without the delivery lead accepting it.

Source abbreviations: **SPEC** = `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0; **DOCX** = `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx`; **XLSX** = `AMADA-20261006.xlsx` (structure only; no cell data is reproduced here); **UI** = `Accucut Quotation Portal UI-UX.html`.

---

## 1. Question index

| ID | Question (short) | Blocking | Needed by | Jira |
|----|------------------|----------|-----------|------|
| Q-01 | Project budget and target date | **Yes** | G2 | [AQP-2](https://sankumar76.atlassian.net/browse/AQP-2) |
| Q-02 | "Santhosh / MD": one person or two | **Yes** | G2 | [AQP-3](https://sankumar76.atlassian.net/browse/AQP-3) |
| Q-03 | Is AMADA-20261006.xlsx the sample worksheet (SPEC §15.3)? | **Yes** | G3 | [AQP-4](https://sankumar76.atlassian.net/browse/AQP-4) |
| Q-04 | One product/total per estimate, or several top-level items each with a total? | **Yes** | G2 | [AQP-5](https://sankumar76.atlassian.net/browse/AQP-5) |
| Q-05 | Tool Cost (BM): who enters it, per part or per estimate? | **Yes** | G2 | [AQP-6](https://sankumar76.atlassian.net/browse/AQP-6) |
| Q-06 | Assembly (parent) parts under "all inputs mandatory" | **Yes** | G2 | [AQP-7](https://sankumar76.atlassian.net/browse/AQP-7) |
| Q-07 | Master-value changes after approval (rate snapshot) | **Yes** | G2 | [AQP-8](https://sankumar76.atlassian.net/browse/AQP-8) |
| Q-08 | Parent vs child cost (SPEC §15.2) | **Yes** | G2 | [AQP-9](https://sankumar76.atlassian.net/browse/AQP-9) |
| Q-09 | Who supplies starting master data | **Yes** | G4 | [AQP-10](https://sankumar76.atlassian.net/browse/AQP-10) |
| Q-10 | Export presentation details versus the sample | No | G3 | — |
| Q-11 | Rejection (BC) formula (SPEC §15.1) | No | G4 | — |
| Q-12 | Network-folder links (SPEC §15.4) | No | G3 | — |
| Q-13 | Remarks (AJ) mandatory (SPEC §15.5) | No | G3 | — |
| Q-14 | Plating flag (AD) unused (SPEC §15.6) | No | G3 | — |
| Q-15 | "Not needed for this part" switch (SPEC §15.7) | No | G3 | — |
| Q-16 | Sharper logo original (SPEC §15.8) | No | G8 | — |
| Q-17 | SEO and Open Graph on a login-only portal | No | G3 | — |
| Q-18 | Hosting, access, web address, email service | **Yes** | G3 | [AQP-11](https://sankumar76.atlassian.net/browse/AQP-11) |
| Q-19 | After Calculate: can the Engineer still edit? Return path? | No | G2 | — |
| Q-20 | Task changes: reassign, change deadline, cancel | No | G2 | — |
| Q-21 | Confirm the `[DEFAULT]` decisions in the SPEC | No | G2 | — |
| Q-22 | Estimate / task ID format | No | G3 | — |
| Q-23 | Admin succession and deactivated users with open tasks | No | G3 | — |
| Q-24 | Volumes, user numbers and current turnaround (baseline) | No | G2 | — |
| Q-25 | Historical estimates, cut-over and parallel run | No | G4 | — |
| Q-26 | Data retention and personal-data obligations | No | G3 | — |
| Q-27 | Overdue colour versus brand red; mobile navigation pattern | No | G3 | — |
| Q-28 | Walk-through of today's estimation process | No | G2 | — |

---

## 2. Questions

### Q-01 — Project budget and target date  ·  BLOCKING
- **Question:** What is the project budget, and what is the target go-live date (or the date by which the spreadsheet should stop being used)?
- **Why it matters:** The release plan and MVP scope at G2 depend on both. The G0 decision carried this forward because neither was stated in the intake.
- **Assumption used until answered:** `ASSUMPTION-01` No fixed budget or date; scope is planned in the build order of SPEC §13 and sized later.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-2
- **Answer:**

### Q-02 — "Santhosh / MD": one person or two  ·  BLOCKING
- **Question:** Is the sponsor "Santhosh / MD" one person, or are Santhosh (delivery lead) and a Managing Director two people? Who gives business sign-off at G8 and on pricing-policy decisions?
- **Why it matters:** It decides who the business approver is and who owns business-rule decisions (see Q-08, Q-11).
- **Assumption used until answered:** `ASSUMPTION-02` One person; Santhosh is both sponsor and sole approver.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-3
- **Answer:**

### Q-03 — Is AMADA-20261006.xlsx the sample worksheet?  ·  BLOCKING
- **Question:** SPEC §15 item 3 says the sample worksheet is not yet provided and expects `docs/reference/sample-estimate.xlsx`, which does not exist. `AMADA-20261006.xlsx` is listed as an input. Is it the sample? If yes, may a cleaned copy (real customer and part data removed) be placed at `docs/reference/sample-estimate.xlsx`, and is it the layout the export must match? Is there a blank company template different from this filled example?
- **Why it matters:** The export is read from the sample (widths, headers, formats, SPEC §10). The file holds real-looking part and customer data, so it must not be committed as it is.
- **Assumption used until answered:** `ASSUMPTION-03` Yes, it is the reference for structure only. No cell data from it is copied into any artefact, Jira or GitHub.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** AQP-4
- **Answer:**

### Q-04 — One total per estimate, or per top-level item?  ·  BLOCKING
- **Question:** SPEC §6.1 and §7.4 describe one product per estimate: BL in row 2 sums BG of all nodes, and BN and BO are row-2 only. The sample worksheet has two top-level items (1 and 2). Item 1 has its own BL (a sum over only its own rows) and item 2 has its own BL, Tool Cost (BM) and BN on its first row. Is one estimate one product with one total and one Approved Quote Price, or can an estimate hold several top-level items each with its own total, Tool Cost and price?
- **Why it matters:** It changes the data model, the BL/BN/BO rules, approval (one price or many) and the export layout. See finding F-01.
- **Assumption used until answered:** `ASSUMPTION-04` SPEC as written: one product per estimate; "item 1, item 2 …" are the first-level nodes under it; BL, BN, BO in row 2 only.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-5
- **Answer:**

### Q-05 — Tool Cost (BM): who enters it, per part or per estimate?  ·  BLOCKING
- **Question:** SPEC §7.1 makes Tool Cost (BM) an Engineer input on every part (section 08), mandatory like all inputs. BN = BL / BM exists only in row 2. In the UI sample, Tool Cost sits beside the estimate total in the Lead/Admin approval view, and in the sample worksheet BM is filled on one row only. Should the Engineer enter Tool Cost on each part, or should the Lead/Admin enter one Tool Cost for the estimate?
- **Why it matters:** Tool Cost is a cost figure. If the Engineer enters it, the "Engineer never sees cost" rule must say clearly that entering a cost input is allowed but seeing calculated cost is not. It also decides whether every part needs a Tool Cost value. See finding F-02.
- **Assumption used until answered:** `ASSUMPTION-05` SPEC as written: the Engineer enters BM on each part (mandatory, 0 allowed); BN uses the row-2 value.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-6
- **Answer:**

### Q-06 — Assembly (parent) parts under "all inputs mandatory"  ·  BLOCKING
- **Question:** In the sample worksheet the parent row (item 1) has no material, no treatment and zero dimensions. SPEC §7.3 requires every visible input, including Material in Drawing (E, a drop-down from the Material Master) and Treatment/Color (G), on every node. How should a container-only parent be entered: a placeholder option such as "Not applicable" in both lists, relaxed mandatory rules for nodes that have children, or the "Not needed for this part" switch (Q-15)?
- **Why it matters:** Without an answer an Engineer cannot Calculate an estimate that contains an assembly row, which would fail acceptance test 4 on real data. See finding F-08.
- **Assumption used until answered:** `ASSUMPTION-06` SPEC as written (every node needs every field). Recorded as a likely usability blocker.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-7
- **Answer:**

### Q-07 — Master-value changes after approval  ·  BLOCKING
- **Question:** SPEC §8.4 pins an approved estimate to its configuration (fields, formulas). It says nothing about master values (customer rates, material price/gravity/scrap rate, exchange rates). If the Admin changes a rate after approval, must the approved estimate keep the rates it was approved with? When a Lead unlocks and recalculates, should the new calculation use current rates or the original ones?
- **Why it matters:** An approved price must not change silently, and an export re-generated later must match what was approved.
- **Assumption used until answered:** `ASSUMPTION-07` Each Calculate/Recalculate stores a snapshot of every master value it used; approved estimates keep their snapshot; recalculation after unlock uses current values (with a notice if they changed).
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-8
- **Answer:**

### Q-08 — Parent versus child cost (SPEC §15 item 2)  ·  BLOCKING
- **Question:** BL sums BG of all nodes (the sample does the same for item 1: its own row plus its children). Does a parent node carry only its own cost (for example assembly), so that the sum is right? Or may a parent also include its children, which would double count? Also, BG already multiplies by that node's own Qty per Assy (H): is a child's quantity "per final assembly" or "per parent"?
- **Why it matters:** It drives every quoted price.
- **Assumption used until answered:** `ASSUMPTION-08` Sum of all nodes as specified; a parent carries only its own cost; H is the quantity per final assembly for that node.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** AQP-9
- **Answer:**

### Q-09 — Who supplies the starting master data  ·  BLOCKING
- **Question:** The SPEC names the Process Master items but gives no default values. The worksheet hard-codes a constant inside each formula and holds no lists of materials, customers or treatments (its second sheet holds only three text labels: customer master, material master, process master). Who will supply the starting data for: Process Master defaults, Material Master rows, exchange rates, customers and their rates, the Treatment/Color list, and the first users (Admin, Leads, Engineers)? In what form and by when?
- **Why it matters:** Acceptance test 2 (SPEC §14) needs known inputs and rates, and go-live needs real master data.
- **Assumption used until answered:** `ASSUMPTION-09` The client supplies these before UAT. Development and tests use invented placeholder values only. The constants in the worksheet formulas are the candidate Process Master defaults, subject to confirmation. See finding F-07.
- **Owner:** Santhosh  ·  **Needed by:** G4  ·  **Jira:** AQP-10
- **Answer:**

### Q-10 — Export presentation details versus the sample
- **Question:** For the export, which of these apply: (a) use the sample's header texts word for word (for example "Part Number", "Qty / Assy", "Part Weight (if required)") or the SPEC's field labels; fix typos such as "Are in Sq.ft"; (b) header text for BL, BN and the empty BO header; (c) the sample's yellow header fill, Times New Roman 12, wrapped text, frozen header row, filter on the header row, and tall data rows for images; (d) number formats: the sample shows ₹ only on BG, BL and BM, $ on BJ, € on BK, one decimal on AV to BB, and General on BN and BO, whereas SPEC §2 says calculated values display to 2 decimals; (e) the sample's blank subtotal row (row 12) between item groups; (f) Fasteners (S) exported as "None" or 0 where there are none (the sample uses 0 in several rows).
- **Why it matters:** SPEC §10 says "replicate the sample exactly" but does not list these. Each is a testable export criterion. See findings F-03 to F-06, F-09, F-11.
- **Assumption used until answered:** `ASSUMPTION-10` (a) sample header texts verbatim for A to BN, typos corrected; BO header "Approved Quote Price"; (b) BL header "Total Unit Production Price (INR)", BN header "Total Unit Production Price (INR) / Tool Cost (INR)" as in SPEC; (c) replicate the sample's header style, wrap, frozen header row and filter; (d) ₹ on all INR money columns, $ on USD, € on EUR, 2 decimals; (e) no subtotal row; (f) "None".
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** — (non-blocking)
- **Answer:**

### Q-11 — Rejection (BC) formula (SPEC §15 item 1)
- **Question:** What is the rule for Rejection (BC)? The worksheet leaves BC empty in every row.
- **Why it matters:** Rejection allowance is part of every unit price.
- **Assumption used until answered:** `ASSUMPTION-11` Interim behaviour from SPEC: BC = 0, changeable by the Admin through the formula editor.
- **Owner:** Santhosh  ·  **Needed by:** G4  ·  **Jira:** —
- **Answer:**

### Q-12 — Network-folder links (SPEC §15 item 4)
- **Question:** Do users open the portal from office PCs that can reach the shared folders? Which browsers? Is a copy-path button acceptable if the browser blocks the `file:///` link?
- **Why it matters:** Browsers often block links from web pages to local files; the task is hard to start if the folder cannot be opened.
- **Assumption used until answered:** `ASSUMPTION-12` Interim behaviour from SPEC §5.1: `file:///` link plus "Copy path" button and a tooltip.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-13 — Remarks (AJ) mandatory (SPEC §15 item 5)
- **Question:** Must Remarks be filled on every part, even when there is nothing to say?
- **Why it matters:** A mandatory free-text field is often filled with filler text such as "NA".
- **Assumption used until answered:** `ASSUMPTION-13` Mandatory as specified; the Admin can switch it off per field.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-14 — Plating flag (AD) unused in formulas (SPEC §15 item 6)
- **Question:** Confirm that the Plating flag (AD) is informational only and that Plating Cost (AU) is typed in by the Engineer. The worksheet matches this (AU has no formula).
- **Why it matters:** It affects the "hide zero treatment lines" rule: AD has no linked output to hide.
- **Assumption used until answered:** `ASSUMPTION-14` As specified: AD is stored and exported; AU is an input.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-15 — "Not needed for this part" switch (SPEC §15 item 7)
- **Question:** Do you want a switch per section that sets the section's fields to 0 and collapses it? Should it also be the way to enter assembly parents (Q-06)? Which sections would it apply to?
- **Why it matters:** It speeds entry but changes the validation rule (blank versus zero) and the mandatory-field rule.
- **Assumption used until answered:** `ASSUMPTION-15` Not built in this release (still undecided as of 2026-10-31); the section layout leaves room to add it later.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-16 — Sharper logo original (SPEC §15 item 8)
- **Question:** Can a sharper original of the logo (SVG, AI or a large PNG) be supplied, and by when?
- **Why it matters:** The supplied file is 200 × 200 px and may look soft on large screens and on the Excel/e-mail output.
- **Assumption used until answered:** `ASSUMPTION-16` Use `docs/03-ux/assets/accucut-logo.jpg` unchanged; replace when a better file arrives.
- **Owner:** Santhosh  ·  **Needed by:** G8  ·  **Jira:** —
- **Answer:**

### Q-17 — SEO and Open Graph on a login-only portal
- **Question:** The standing website standards ask for proper SEO meta tags and Open Graph title and description on every page, but the portal is login-only and internal. Search engines and social-media crawlers cannot see pages behind the login, so those tags give no search or sharing benefit on them. Which of these do you want: (a) tags on every page for consistency, with generic wording only and authenticated pages set to "do not index"; (b) full SEO only on the public sign-in page (and About, if public); (c) as (a) but the sign-in page may be indexed? Is a shared portal link ever pasted into chat or e-mail where a preview card would appear?
- **Why it matters:** Meta tags must never leak cost, rate or customer data (SPEC §17.6); wrongly indexed internal pages would be a confidentiality risk if the portal is reachable from the internet (Q-18). The requirement is kept, not dropped.
- **Assumption used until answered:** `ASSUMPTION-17` Option (a): every page has a title, meta description, Open Graph title and description with generic text; pages behind login are marked "do not index"; the sign-in page is not promoted for search.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-18 — Hosting, access, web address, email service  ·  BLOCKING
- **Question:** Where will the portal run (office server, rented server, cloud), and from where will users open it (office network only, VPN, open internet)? What is the web address (the UI sample's About page shows a "[SITE URL]" placeholder)? Which e-mail service and sender address send the alerts? Who looks after backups and updates?
- **Why it matters:** It decides security controls, whether network-folder links work for users, e-mail delivery, whether SEO tags matter (Q-17) and the deployment design at G3. The UI sample also loads fonts from an external font service, which may not work on a restricted network.
- **Assumption used until answered:** `ASSUMPTION-18` Docker Compose deployment (SPEC §2) on a server reachable from the office network and, for remote users, by VPN; not public; SMTP details supplied by the client later; backups per the README guidance in SPEC §12.
- **Owner:** Santhosh (IT contact to be named)  ·  **Needed by:** G3  ·  **Jira:** AQP-11
- **Answer:**

### Q-19 — After Calculate: can the Engineer still edit? Is there a return path?
- **Question:** After the Engineer clicks Calculate (status SUBMITTED), may the Engineer still change inputs? SPEC §3 allows Engineers to edit "while unlocked"; SPEC §6.3 offers Recalculate only to Lead/Admin; the DOCX says the Lead "edits or recalculates if needed". Should a Lead be able to send an estimate back to the Engineer with a comment? What status does an unlocked estimate return to (SPEC §6.3 says "DRAFT/SUBMITTED")?
- **Why it matters:** It defines the status model and who can edit when.
- **Assumption used until answered:** `ASSUMPTION-19` Engineer inputs become read-only once SUBMITTED; the Lead/Admin edit and recalculate; there is no "return to Engineer" action; unlock returns the estimate to DRAFT.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer:**

### Q-20 — Task changes: reassign, change deadline, cancel
- **Question:** Can a Lead/Admin reassign a task to another Engineer, change its deadline, or cancel it? If yes, are those actions e-mailed and logged?
- **Why it matters:** SPEC §5 covers only creating tasks.
- **Assumption used until answered:** `ASSUMPTION-20` Reassign and deadline change are available to Lead/Admin and logged; cancel is not provided until confirmed.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer:**

### Q-21 — Confirm the `[DEFAULT]` decisions in the SPEC
- **Question:** The SPEC marks about 20 items `[DEFAULT]` ("implementation decisions taken on the client's behalf"). They are not in the DOCX (finding F-13). Please confirm, or change, as a group or individually. The list is in `requirements-catalog.md` under "Assumptions" (ASSUMPTION-30 onwards).
- **Why it matters:** Several are business policy, not technology: Engineers cannot download the export, Admin creates users, a task closes when approved, unlock needs a reason, numbers are not negative, a percentage is typed as 12 meaning 12%.
- **Assumption used until answered:** `ASSUMPTION-21` All `[DEFAULT]` items stand as written in the SPEC.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer:**

### Q-22 — Estimate / task ID format
- **Question:** The UI sample shows estimate IDs like "Q-2026-1042", and SPEC §10 uses `<TaskId>` in the file name without defining it. What format should estimate or task IDs have, and do they restart each year?
- **Why it matters:** The ID appears on screens, in e-mails and in file names and is how people refer to an estimate.
- **Assumption used until answered:** `ASSUMPTION-22` `Q-<year>-<4-digit running number>` as shown in the UI sample; one estimate per task, same ID.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-23 — Admin succession and deactivated users
- **Question:** There is exactly one Admin. How is the Admin role handed over if that person leaves or is absent? What happens to open tasks of an Engineer who is deactivated?
- **Why it matters:** One Admin is a single point of failure for masters, formulas and users.
- **Assumption used until answered:** `ASSUMPTION-23` The Admin can transfer the role to another active user in one confirmed step (still exactly one active Admin); open tasks of a deactivated Engineer stay visible to Lead/Admin and can be reassigned (Q-20).
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-24 — Volumes, user numbers and current turnaround (baseline)
- **Question:** Roughly how many Admin, Lead and Engineer users; how many estimates a month; how many parts a typical and the largest estimate holds; and how long an estimate takes today from request to approved price?
- **Why it matters:** The inputs give no baseline, so the success measures in the brief cannot show improvement yet, and the 500-node performance figure in SPEC §12 is unverified against real use.
- **Assumption used until answered:** `ASSUMPTION-24` Fewer than 50 users and 500 parts at most per estimate (SPEC §12); no turnaround target is set until a baseline is given.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
- **Answer:**

### Q-25 — Historical estimates, cut-over and parallel run
- **Question:** Do past Excel estimates need to be loaded into the portal, or only be kept as files? Will the spreadsheet and the portal run side by side for a period, and for how many estimates? Who trains the Engineers and Leads?
- **Why it matters:** An import is a separate piece of work; a parallel run needs a comparison method (the portal must match the worksheet).
- **Assumption used until answered:** `ASSUMPTION-25` No import of past estimates; new tasks go into the portal after a parallel run of a few estimates; training by the delivery team.
- **Owner:** Santhosh  ·  **Needed by:** G4  ·  **Jira:** —
- **Answer:**

### Q-26 — Data retention and personal-data obligations
- **Question:** How long must estimates, audit logs and e-mail logs be kept? The portal stores user names and e-mails and customer contact details (name, phone, e-mail, address). Does Accucut have a data-protection or retention policy, and does any customer contract limit where their data may be stored?
- **Why it matters:** India's Digital Personal Data Protection Act, 2023 and the IT Act 2000 rules may apply to this contact data (assessed from general knowledge, not from web research; to be confirmed with the company's legal adviser). EU customers (EUR pricing) could add GDPR if their personal data is held, which is unlikely for business contact data alone.
- **Assumption used until answered:** `ASSUMPTION-26` Keep everything until the company states a policy; business contacts only; no personal data of customers' staff beyond name, phone, e-mail and address; no real personal data in tests or fixtures.
- **Owner:** Santhosh  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-27 — Overdue colour versus brand red; mobile navigation pattern
- **Question:** With red as the brand colour, the UI sample's orange for "overdue" and red for errors become hard to tell apart. Confirm that overdue stays orange-amber with an icon and text, errors use the darker red with icon, thick border and text (SPEC §17.2), and that active markers use the brand red. For small screens SPEC §11 asks for a bottom or hamburger navigation, but the UI sample turns the side menu into a scrolling top bar below 860 px. Which pattern do you want?
- **Why it matters:** Status must never rely on colour alone (SPEC §11, §17.2), and the two sources conflict on navigation.
- **Assumption used until answered:** `ASSUMPTION-27` Overdue = orange-amber plus icon plus "Overdue by X" text; navigation as in SPEC §11 (it overrides the sample); the UX expert proposes the detail at G3.
- **Owner:** Santhosh (decision), ux-expert (proposal)  ·  **Needed by:** G3  ·  **Jira:** —
- **Answer:**

### Q-28 — Walk-through of today's estimation process
- **Question:** The inputs describe the target process but not today's. Could an Engineer and a Lead describe how an estimate is done now (who asks, where files live, how prices are approved, how often the sheet is wrong or late)? Even a 30-minute call is enough.
- **Why it matters:** Without it the "as-is" process in `process-as-is-to-be.md` is inferred, and pain points cannot be tied to evidence.
- **Assumption used until answered:** `ASSUMPTION-28` The as-is steps are inferred from the DOCX and the worksheet and are labelled as such.
- **Owner:** Santhosh  ·  **Needed by:** G2  ·  **Jira:** —
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

---

## 4. Answers log (filled in Pass 2)

| Q | Date | Answered by | Answer | Spec / catalogue change |
|---|------|-------------|--------|-------------------------|
| | | | | |
