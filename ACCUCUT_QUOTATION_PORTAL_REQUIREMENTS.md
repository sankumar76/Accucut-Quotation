# Accucut Quotation Portal — Software Requirements Specification

**Client:** Accucut Lasers Pvt Ltd
**Source:** Requirement Understanding Document, Draft v5
**Audience:** Claude Code (implementation agent) and the development team
**Spec version:** 1.10 (version 1.9 plus the delivery lead's answers of 2026-11-02, relayed verbatim from the chat by the orchestrator (DL-007 (2); the session-log check is the master's), in AQP-1 comments 10542 to 10555 and AQP-15 comment 10543; none is in their own words on Jira. A parent shows only its own row's figures (Q-35 (b), D-25). The Warn on a 0 in QTY per Assy is kept for every 0 (Q-41, D-26). "Not applicable" is offered to a Lead or Admin and shows as text on a part to everyone (Q-36, D-27). Every cost figure clears on any input change, the Excel download is refused until a calculation is current, and the earlier approved price stays until approved again or removed by the Admin, who alone cancels an approval (Q-37, D-28 to D-30). The Part Model picture is optional (D-31). A rate-change notice goes to the Lead at approval (D-32). Settings shows a "Last backup" line, the Admin only checks that backups ran, and copies stay on the same server (D-33). QTY per Assy keeps its name with a hint below it (D-34). No holidays or days away to 9 December (D-35). §6.5 ("download at any status") is corrected, and the superseded ROLLUP text is removed from §7.4, §8.2 and §16. ASSUMPTION-52, 54, 55, 59 and 60 end. No requirement is dropped other than the superseded ROLLUP function text.) Version 1.9 (version 1.8 plus the quantity rule the delivery lead settled on 2026-11-02, in their answers on AQP-26 (comments 10533, 10535, 10536 and 10537), relayed verbatim from the chat: QTY per Assy (H) is the count of the part for the whole order, typed on every row, and BL is the sum of BG over every row, with no multiplying down the tree (§7.1 H, §7.4 BL, §8.2, §14.2, §18 D-08, D-12, D-21, §18.5). It replaces the every-level rule of version 1.4 and matches the worksheet. ASSUMPTION-57 is retired and Q-39 is answered; ASSUMPTION-52 is replaced by ASSUMPTION-59 and Q-35 (b) is reworded; Q-41 is new: the premise of the Warn on a 0 in H changed (D-22), and the decision stays as recorded until the product-manager and the delivery lead rule on it. No requirement is dropped.) Version 1.8 (version 1.7 plus two answers of the delivery lead, 2026-11-02, relayed verbatim from the chat: Q-38 "Yes" (AQP-15 comment 10527; AQP-1 comment 10528), so a 0 in QTY per Assy warns on any part, with or without parts below it (§7.1 H, §7.3, §18 D-22; ASSUMPTION-58 retired); and Q-40 "No" (AQP-1 comment 10528), so no real rate needs more than 2 digits after the decimal point (§18 D-24; OQ-ARCH-05 closed). No requirement is dropped.) Version 1.7 (version 1.6 plus the master's rulings of 2026-11-02, DL-018 to DL-026, for the business analyst: §4 is aligned with the limit on deleting customers and materials (PRD v0.7 decision, DL-019 item 6); Q-39 is added for an item that has its own cost and parts below it (§18.2; ASSUMPTION-57; Jira AQP-26); Q-37 is reworded to name the single-piece row (§18.2); Q-40 is added, the rates-beyond-2-decimals question, with no values asked (DL-025). No requirement is dropped.) Version 1.6 (version 1.5 plus three answers of the delivery lead, 2026-11-01, relayed verbatim from the chat: Q-35 (a) on AQP-14 comment 10510, OQ-ARCH-10 on AQP-15 comment 10511 and the master data questions (Q-09, HOLD-01) on AQP-10 comment 10512. The item's own row counts its quantity once (§7.4 BL, §18 D-21); a 0 in QTY per Assy on a part with parts below it warns, with no minimum and no block (§7.1 H, §7.3, §18 D-22); the Admin holds the master data and types it in at first use (§18 D-09, D-23). Q-38 is new (§18.2). No requirement is dropped.) Version 1.5 (version 1.4 plus the text alignment required by gate record G3 conditions 3 and 10, 2026-11-01: ROLLUP and comparisons inside IF (§8.2); dark mode out of scope A and WCAG 2.2 AA (§11); header wording (§9); the pending minimum for H (§7.1); the zero rule for H (§7.3); the Scrap Weight guard (§7.4); what a cleared total clears (§6.3, Q-37); and the Q-35 (a) wording, with its Jira open-question issue [AQP-14](https://sankumar76.atlassian.net/browse/AQP-14) (§18.2). No decision of the delivery lead is changed.) Version 1.4 (1.0 plus the delivery lead's answers in §18: added in Discovery Pass 2, 2026-11-01, and confirmed, corrected or qualified by them in Pass 3, 2026-11-01: some items in their own words, five on the orchestrator's list wording; see the status rule in §18). Items they have confirmed replace the SPEC text they were holding back; the details still open are listed in §18.2. Version 1.3 (2026-11-01): Q-32 is answered (§18 D-12; at that version the confirmation of (a) in their own words was still requested, and it was given in version 1.4) and the repository decision is recorded (§18 D-13). **Version 1.4 (2026-11-01, after G3 approval, AQP-1 comment 10491):** the delivery lead defined QTY per Assy in their own words (AQP-13 comment 10487) and counted 24 lids in the nested example (relayed, AQP-1 comment 10490), so **every level's quantity applies**; this reverses the rule "the quantity multiplies once, at the top item" of version 1.3 (§7.4 BL, §18 D-12, §18.5). Also recorded: scope A (Q-34, AQP-12 comment 10488), hosting details in part (Q-18), one export total with the total Tool Cost shown (Q-31), the handling of "Not applicable" (Q-33), no "Not needed" switch, an optional reason on a changed price, the password rule and 12-hour session, stale totals, the About wording and Engineers seeing status (§18 D-14 to D-20). New open questions: Q-35 (the item's own row and what a parent shows) Q-36 (where "Not applicable" is shown) and Q-37 (what a cleared total means for the export).

> **How to use this document (for Claude Code):** Build the application described below as a production-ready, fully responsive web application (mobile, tablet, laptop/desktop). Treat every **MUST** as a hard requirement and every acceptance criterion as a test to pass. Items marked **[DEFAULT]** are implementation decisions taken on the client's behalf; follow them unless the repository's `CLAUDE.md` or the client says otherwise. Items in **§15 Open Items** are unresolved; implement the stated interim behaviour and keep it easy to change.

---

## 1. Product Summary

Accucut currently prepares manufacturing cost estimates (quotations) in an Excel worksheet with columns **A to BO**. The portal replaces that worksheet with a web application that:

1. Lets **Admin/Lead** assign estimation tasks to **Engineers**, with a network-folder link to the requirement documents and a deadline (IST).
2. Lets **Engineers** enter part-level data for a product (a tree of items → parts → sub-parts …) through a modern, guided form — **never seeing any cost**.
3. Calculates every cost column using formulas and master data (customer rates, material data, exchange rates).
4. Lets **Lead/Admin** review costs, set an **Approved Quote Price**, approve and lock the estimate, or unlock it for re-estimation.
5. Exports the estimate to an **Excel file that replicates the original worksheet layout** exactly.
6. Lets the **Admin** reconfigure the "worksheet" itself — insert/delete fields, edit formulas — with Excel-style automatic re-lettering, checkpoints and an audit trail.

The portal is a **faithful replica of the Excel worksheet**: every field is identified by its Excel column letter, and letters always follow the Excel sequence (A…Z, AA…AZ, BA…BZ, …).

---

## 2. Technology Stack **[DEFAULT]**

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui (Radix) components; lucide-react icons |
| Forms/validation | react-hook-form + zod (shared schemas client/server) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js (credentials provider: email + password, bcrypt/argon2 hashing), session-based |
| Formula engine | Custom parser/evaluator (see §8). **MUST NOT** use `eval`/`new Function`. |
| Excel export | ExcelJS |
| Email | Nodemailer over SMTP (settings via environment variables). **Update (§18 D-15):** the delivery lead's e-mail service is Microsoft Outlook; the sender address is not decided. Whether that account allows the SMTP route named here is for the solution architect to check; the e-mail rules in §5.4 do not change |
| Scheduled jobs | A job runner inside the app (e.g. node-cron in a separate worker process) or OS cron hitting a protected endpoint |
| File storage | Part-model images stored in the database (bytea) or local volume; max 200 KB each |
| Testing | Vitest (unit), Playwright (E2E, incl. mobile/tablet viewports) |
| Deployment | Docker Compose (app, worker, Postgres); `.env.example` provided. Release 1 is hosted on the internet; offline use is for the next release (§18 D-10, confirmed: AQP-11 comment 10444 and AQP-1 comment 10441 (e)). Hosting details answered in part on 2026-11-01 (§18 D-15): e-mail service Microsoft Outlook; backup once a week, kept 2 years, copies on the same server, the Admin only checks that they ran (§18 D-15, D-33); updates installed by the delivery lead's IT person. Still open: web address and sender address (Q-18) |

Time zone: **all deadlines, schedules and timestamps are displayed and scheduled in IST (Asia/Kolkata)**; store timestamps in UTC.

Currency: INR (₹), USD ($), EUR (€). Inputs accept up to **2 decimal places**; store calculated values at full precision and display them to 2 decimals.

---

## 3. Roles and Permissions

Every user has **Name, Email ID** (login), password, role, active flag.

| Capability | Admin (exactly one) | Lead (many) | Engineer (many) |
|---|:-:|:-:|:-:|
| Manage users **[DEFAULT: Admin creates/deactivates users and resets passwords]** | ✅ | — | — |
| Manage all masters & settings (incl. email alerts ON/OFF) | ✅ | — | — |
| View / edit formulas | ✅ edit | 👁 view only | — |
| Insert / delete fields, checkpoints | ✅ | — | — |
| Assign tasks, track queues | ✅ | ✅ | own queue only |
| Enter / edit input fields | ✅ | ✅ | ✅ (own tasks, while unlocked) |
| View costs, calculated/output fields | ✅ | ✅ | **NEVER** |
| "View Cost Details" button | ✅ | ✅ | **hidden** |
| Approve & lock, unlock, set Approved Quote Price | ✅ | ✅ | — |
| Cancel an approval and remove the earlier approved price (§6.3; §18 D-29) | ✅ | — | — |

**Security MUST:** Cost/output data is filtered **on the server**. API responses and server-rendered pages for an Engineer **MUST NOT contain** any calculated/output field values, material rates (column I), exchange rates, customer rates or formulas — hiding them only in the UI is not acceptable. Add automated tests that assert this.

The system MUST enforce that only one active Admin exists.

**Engineers and status (§18 D-18, their words relayed, AQP-1 comment 10490: "Show the status, no price"):** an Engineer sees the status of their own task and estimate (for example Submitted, Approved, Closed) and never a price. A status is not a cost value, so the server-side rule above is unchanged.

---

## 4. Master Data (Admin only — add / update / delete, with the limits below)

> **Limit on deleting (PRD v0.7 decision, recorded as DL-019 item 6, 2026-11-02; the delivery lead can reverse it).** Earlier versions of this heading said "at any time". Adding and updating master data stays open at any time. Deleting is limited: a **Customer** or a **Material** cannot be deleted while an estimate that is not yet approved uses it; the portal refuses and names the estimates (PRD FR-013, FR-015). One that is used only by approved estimates can be deleted, and those estimates keep their figures, and their screens and exports do not change. A Process Master item cannot be deleted while a formula uses it (rule 5 in §4.2). The system-created "Not applicable" entries cannot be deleted at all (§18 D-17). This note changes the delete rule for Customers and Materials only; the other master lists are unchanged. The limit is a product-manager decision (OQ-UX-14), not a statement by the delivery lead.

### 4.1 Process Master (default rates)
A list of named rates. Seed items:

`Cutting-Rate-per-Sec`, `Bending-Rate-per-stroke`, `Drilling-Tapping-Rate`, `Welding-rate-per-kg`, `Dip-Galvanizing-Cost-per-kg`, `Primer-rate-per-sqft`, `Shot-Blasting-rate-per-kg`, `Polishing-rate-per-sqin`, `Powder-rate-per-sqft`, `Foam Cost`, `Soft-Anodize-rate-per-sqin`, `OH Profit %`, `Transport %`, `Inspection & Packing %`

The Admin can add new rate items; they become available in formulas by name.

### 4.2 Customer Master
Fields: **Customer Name, Phone, Email, Address**, plus one value for **every** Process Master item (customer-specific rates).

Synchronisation rules (MUST):
1. Creating a customer copies all current Process Master values into the customer's rates.
2. **"Reset to Defaults"** on a customer reloads all rates from the Process Master (with confirmation).
3. Adding a Process Master item adds it to every customer with the default value.
4. Updating a Process Master value propagates to all customers, **except** where a customer's current value ≠ the Process Master's *previous* value (a manual override). For those, show the Admin a prompt listing the affected customers with options: **apply new value** / **keep existing value** (per customer, plus "apply to all" / "keep all").
5. Deleting a Process Master item removes it from all customers (blocked if any formula references it — show which formulas).

### 4.3 Material Master
Each row: **Material in Drawing** (unique, shown in drop-down) → **Material-Considered** (mapping), **Material-Price-per-kg**, **Material-Specific-Gravity**, **Material-Scrap-Rate**.

> **Pass 3 (§18 D-06, confirmed, AQP-1 comment 10441 (b)):** the Material Master includes a **"Not applicable"** option for parts, including parent assemblies, that need no material. **Answered 2026-11-01 (§18 D-17; their words, relayed verbatim in AQP-1 comment 10490):** its rate values are 0 ("You may consider 0 as you mentioned"); the system creates it; it cannot be edited or deleted ("Okay, but do not show then anywhere in the portal, even for admin"); and it is not shown anywhere in the portal, Admin pages included ("Do not show this anywhere in the portal, even for admin"). A part that has it skips the **material cost only** (Material Cost, AK, is 0); the labour and other costs on that row still count ("skip material cost only"). The reading that the words stay as a choice in the Material in Drawing drop-down for Engineers and appear nowhere else was put to them and they did not object, but they did not state it. **Answered 2026-11-02 (§18 D-27; Q-36; their words relayed verbatim from the chat by the orchestrator, AQP-1 comment 10544):** the choice is offered to a Lead or Admin who edits a part ("a) Yes"), and "Everyone can see the fields with "Not Applicable" text": the text "Not applicable" shows in the Material in Drawing field of a part that has it, to Engineer, Lead and Admin. This narrows "do not show this anywhere in the portal": the text shows on parts; the zero values and any master-list or Admin-page entry stay hidden (the orchestrator's reading). Material Considered (F) and Material Rate (I) stay blank for such a part (the wording of ASSUMPTION-54, not their words).

### 4.4 Exchange Rate Master
**1 USD → INR**, **1 EUR → INR**.

### 4.5 Treatment / Color List
List of options for column G. The estimate form also offers **"Other"** with a free-text entry. **Pass 3 (§18 D-06, confirmed, AQP-1 comment 10441 (b)):** the list also contains **"Not applicable"** for parts that need no treatment. **Answered 2026-11-01 (§18 D-17):** their answer on the "Not applicable" entries covers this one too: the system creates it, it cannot be edited or deleted, and it is not shown in any list or Admin page; it appears as the choice in the drop-down and as the text "Not applicable" on a part that has it, to everyone (§18 D-27, their words relayed, AQP-1 comment 10544). No cost formula uses Treatment / Color (G), so the "material cost only" wording does not apply to it and there is nothing to skip; it is not extended to treatment.

### 4.6 Settings
- **Email alerts ON/OFF** (global).
- SMTP sender display name/address (credentials via env vars).
- **"Last backup" line** (§18 D-33; their word relayed, AQP-1 comment 10549, asked whether Settings should show it: "Yes"): Settings shows when the last backup ran, so the Admin can check that backups run. What the line shows exactly is design.

---

## 5. Work Assignment and Tracking

### 5.1 Assign task (Admin/Lead)
Form fields: **Engineer** (select), **Network folder path** (text, e.g. `\\server\share\RFQ-123`), **Deadline** (date + time picker, IST), optional title/notes **[DEFAULT]**.

- The network path is displayed as a **clickable hyperlink** (`file:///` URL generated from the UNC path). **Note:** modern browsers often block `file://` links from web pages. Also provide a **"Copy path"** button next to the link, and show a tooltip explaining how to open it.
- Creating a task creates an empty **Estimate** linked to it.

### 5.2 Queues
Three tabs, each sorted by **deadline ascending**:
- **Open** — tasks not yet closed.
- **Closed** — tasks whose estimate is approved **[DEFAULT: a task closes when its estimate is approved; it reopens if the estimate is unlocked]**.
- **Overdue** — open tasks past deadline (they also remain in **Open**).

Visibility: Engineers see only their own tasks. Admin sees all. Leads see all tasks with a default filter of "Assigned by me" **[DEFAULT]**.

Overdue rows are visually highlighted (colour + icon + "Overdue by X" text — not colour alone).

### 5.3 Notification bell
Header bell icon with a badge showing the count of the current user's relevant overdue tasks (Engineer: own; Lead: assigned by them; Admin: all). Clicking it opens the **Overdue** tab.

### 5.4 Email alerts (only when Email alerts = ON)
| Trigger | To | Cc | Content |
|---|---|---|---|
| New task assigned | Engineer | Assigning Lead/Admin | Task details, network folder path/link, deadline (IST) |
| Task becomes overdue (send immediately — check at least every 5 minutes) | Engineer | Assigning Lead/Admin | Overdue task details |
| Daily at **11:00 AM IST** | Each Engineer with overdue tasks | The Lead(s) who assigned those tasks | List of that Engineer's overdue tasks |

Emails MUST be idempotent (no duplicates when the job reruns) and logged (sent/failed).

---

## 6. Estimate Structure and Workflow

### 6.1 Product tree
- An estimate holds a **product** made of one or more **items**; each item may have **parts**; each part may have parts, to **unlimited depth**.
- Shown as a **tree view**. Users can add a child/sibling, reorder, and delete nodes, either building the depth up front or as they go.
- **Sl. No (column A)** is generated automatically from the tree position: `1`, `1.1`, `1.1.1`, `1.1.2`, `1.2`, `2`, … and renumbers on reorder/delete.
- **Every node has the same set of fields**; each node's costs are calculated individually.
- Each node in the tree is a link that opens that node's full detail (inputs, plus costs for Admin/Lead).

Example (from the sample sheet): Item 1 has parts 1.1–1.5; part 1.1 has sub-parts 1.1.1 and 1.1.2.

> **Pass 3 note (§18 D-04, D-08), rewritten at version 1.9:** one estimate holds exactly one complete product (confirmed, D-04). Each node's own costs (BG) are calculated individually, as in the worksheet, and the estimate's total (BL) is the sum of BG over every row (§7.4 BL; §18 D-08, D-12). QTY per Assy (H) is the count of the part for the whole order, on every row: the Engineer types 2 frames, 6 pipes and 24 lids, not 2, 3 and 4, and the portal multiplies no row by another row's H. Two earlier readings are superseded by their answers of 2026-11-02 (AQP-26 comments 10533 to 10537): the wording of D-08 ("the sum of costs of all children multiplied by item quantity", AQP-9 comment 10442 and AQP-13 comment 10445), which fits when the item quantity is 1, and the every-level reading of version 1.4 (24 lids as 2 x 3 x 4 worked out by the portal). Check against the sample: §18.5.

### 6.2 Customer selection
Before any data entry, the Engineer **MUST** choose the **customer** from a drop-down of all customers. That customer's rates drive every formula for the estimate. Changing the customer later requires confirmation and triggers recalculation.

### 6.3 Status lifecycle
`DRAFT` → (Engineer clicks **Calculate**) → `SUBMITTED` → (Lead/Admin **Approve & Lock**) → `APPROVED` (locked) → (Lead/Admin **Unlock**) → `DRAFT`/`SUBMITTED` (editable again). The Admin alone can cancel an approval and remove the earlier approved price (§6.3, §18 D-29).

- **Save** stores inputs at any time (drafts may be incomplete).
- **Calculate (Engineer):** validates that all mandatory inputs are filled (§7.3) for every node; on failure, shows errors and highlights the offending nodes and fields in the tree. On success, it calculates and stores costs, sets status to `SUBMITTED`, and shows only this message:
  > "Cost will be calculated based on the input fields and sent for review/approval."
- **Recalculate (Admin/Lead):** available whenever inputs change after a calculation.
- **Totals after an input changes (§18 D-20 and D-28; their words relayed, AQP-1 comment 10490: "clear the total cost when any input is updated. So, the user will be forced to press calculate or recalculate to see the total cost"; Q-37, AQP-1 comment 10545):** when any input of the estimate is updated, every cost figure is cleared and stays cleared until Calculate (Engineer) or Recalculate (Lead/Admin) is pressed: the total (BL), BN, the Approved Quote Price pre-fill, the total Tool Cost and each row's own cost figures (BG, BJ, BK and the other calculated values). "Any input" is applied as written, so it includes inputs that have no effect on cost (for example Remarks). Their answers to the three parts of Q-37, relayed verbatim: (a) should each row's own cost clear too? "Yes"; (b) block the download, or allow it marked? "Yes, block the portal when the total is not calculated or recalculated"; (c) does the earlier approved price stay on record? "It should stay until it's approved again or be removed." **Readings, not their words:** the orchestrator reads (b) as: the Excel download is refused while the figures are cleared (§6.5); their words say "block the portal", and anything the block covers beyond the download and approval is not stated. "Removed" in (c) was answered further in D-29. The out-of-date file, its markers and its confirmation dialog, which the earlier working assumption (ASSUMPTION-55) described, are not built; ASSUMPTION-55 ends.
- **Approve & Lock:** Lead/Admin enter the **Approved Quote Price** (pre-filled with the calculated Total Unit Production Price, BL; editable to override). All inputs become read-only. **Approval is blocked** while the totals are out of date (an input changed after the last calculation) or the estimate has never been calculated (§18 D-20, their words relayed: "Block approval."). A price that differs from the calculated total may be given with a reason; **the reason is optional** (§18 D-18, "Reason optional"); the override is logged either way (§12). **Rate-change notice (§18 D-32; their words relayed, AQP-1 comment 10548, asked whether a Lead should be told that rates changed after the last Calculate and before approval: "Tell the Lead"):** when the rates (the master values of §8.4, the analyst's reading of "rates") have changed after the last Calculate or Recalculate and before approval, a notice tells the Lead; approval is not blocked. Whether the notice also reaches an Admin who approves (§3) is not stated. Changes to the field and formula configuration are not covered by the answer.
- **Unlock:** Lead/Admin can unlock an approved estimate for re-estimation (logged with reason **[DEFAULT]**).
- **Cancel approval and remove the earlier approved price (§18 D-29; their words relayed, AQP-1 comments 10545 (c), 10552, 10553):** after an unlock, the price approved before stays on record, labelled as the earlier approved price, until the estimate is approved again or the price is removed. It may be removed by hand; their words: "Removable. May be "only IF POSSIBLE" shall have a button to cancel the approval before removing. So that will be a safeguard." Who may do it: "Admin only". **Readings, not their words:** the cancel-approval step comes before the removal; "only IF POSSIBLE" is recorded as given and leaves it to the design and sizing (solution-architect, ux-expert, product-manager) whether the removal is built in Release 1; how the cancel step relates to Unlock is design.

### 6.4 Viewing costs (Admin/Lead)
- By default they see the **input fields and the final cost** for each node.
- A **"View Cost Details"** button on each node reveals all calculated fields, grouped by stage (§7.4), each with its **formula displayed next to it**.
- Engineers never see this button or any cost.

### 6.5 Downloading
Admin/Lead can download the Excel export (§10) only while a calculation is current: the estimate has been calculated at least once and no input has changed since the last Calculate or Recalculate. Otherwise the download is refused, at any status, `DRAFT` included (§18 D-28 and D-30; their words relayed, AQP-1 comment 10545 (b), "Yes, block the portal when the total is not calculated or recalculated", and comment 10554, asked whether a never-calculated estimate may be downloaded: "Refuse it"). The SPEC 1.0 text "at any status" is replaced. Engineers cannot download **[DEFAULT — the export contains costs]**.

---

## 7. Field Definitions (initial configuration)

The worksheet is defined by a **field registry** (§8). The seed configuration below MUST be loaded on first install. "Letter" is the initial column letter.

### 7.1 Input sections — the Engineer's form, in this order
Each section is a card with a header (number, name, column range). Every field shows its **column letter** as a small badge (e.g. Machining Cost shows **AP**). Fields filled automatically from masters are read-only and visually shaded.

| # | Section | Letter | Field | Type | Notes |
|---|---|---|---|---|---|
| 01 | Part Details | A | Sl. No | auto | Tree numbering |
| | | B | Part No. | text | |
| | | C | Part Model | image | Paste (Ctrl+V), drag-and-drop, or file picker; PNG/JPG/GIF/WebP; **< 200 KB** (reject larger with a clear message); preview + replace/remove. **Optional (§18 D-31; their words relayed, AQP-1 comment 10546: "we shall keep that optional"):** Calculate does not require a picture on any part |
| | | D | Description | text | |
| | | G | Treatment / Color | select + other | Options from Treatment/Color List; "Other" reveals free text. The list includes "Not applicable" (§18 D-06, confirmed, AQP-1 comment 10441 (b); handling §4.5, §18 D-17, D-27; the text shows on a part that has it, to everyone) |
| | | H | QTY per Assy | number(2dp) | The count of this part for the **whole order**, typed on every row at every level. The Engineer enters the details of one piece and types here how many of that piece the whole order needs. 2 frames, 3 pipes on each frame and 4 lids on each pipe are typed 2, 6 and 24 (their words, relayed from the chat: "Engineer should typ 24", AQP-26 comment 10537; "So the user will enter 4 frames and 12 brackets", comment 10535). The portal multiplies a row by no other row's H. The same applies to a top-level item (their examples type 2 frames and 4 frames at the top). **Field name and hint (§18 D-34; their words relayed, AQP-1 comment 10551: "Keep QTY per Assy for now with a hint below it"):** the label stays QTY per Assy, as does the Excel header, and a hint below the field says it is the count for the whole order; "for now" leaves a later rename open. A long pipe with a lid at each end is typed 2 on the lid row when the order has one such pipe (AQP-13 comment 10487); for 5 such pipes the Engineer types 10. §7.4 BL, §18 D-12. **Minimum: none (answered, §18 D-22).** There is no minimum above 0 and Calculate does not refuse a 0 (§7.3: numbers ≥ 0). A 0 here means zero pieces, not "no effect" (§7.3): the row's own cost is 0. **Version 1.9:** it affects that row only; before the whole-order rule a 0 on a part with parts below it also made everything below it count 0 times, and that effect no longer exists. **Rule (the delivery lead's decision, relayed from the chat: the word "Warn" for a part that has parts below it, AQP-15 comment 10511; "Yes" to the same warning for a part with nothing below it, AQP-15 comment 10527 and AQP-1 comment 10528; OQ-ARCH-10, the same question as OQ-PM-07, and Q-38):** when Calculate runs and any part has a 0 in H, with or without parts below it, the portal shows a warning that names the part and says that the part's own cost counts as 0, and the Engineer can go ahead. They gave no reason. How the warning reads, whether it must be acknowledged before Calculate goes through, and where the Lead or Admin sees it are design for the ux-expert and solution-architect; no design or size has been given. The block fallback of DL-013 no longer applies. **Answered (Q-38, 2026-11-02, §18 D-22):** the warning covers a 0 in H on a part with nothing below it as well. ASSUMPTION-58 (no message there) is retired. **Premise changed at version 1.9 and answered (Q-41, §18 D-26; their words relayed, AQP-15 comment 10543: "Q-41: Keep warning"):** both earlier answers were given when a 0 could make a part and everything below it count 0 times. Under the whole-order rule a 0 touches its own row only, and they kept the warning for every 0 in QTY per Assy. The warning names the row and says that row will cost 0 (the orchestrator's note on the wording; the wording is design). ASSUMPTION-60 ends. The question and the answer say "part"; a top-level item is the same kind of row, and whether the warning also covers a 0 on a top-level item is for the solution-architect to state in the design; if it reads otherwise, a question is raised |
| 02 | Material and Dimensions | E | Material in Drawing | select | From Material Master. The list includes "Not applicable" (§18 D-06, confirmed, AQP-1 comment 10441 (b); skips the material cost only, §4.3, §18 D-17, D-27; the text shows on a part that has it, to everyone) |
| | | F | Material Considered | auto | Material-Considered for E |
| | | I | Material Rate / Kg | auto | Material-Price-per-kg for E; **hidden from Engineer** |
| | | J | Length | number(2dp) | |
| | | K | Width | number(2dp) | |
| | | L | Thickness | number(2dp) | |
| | | N | Part Weight | number(2dp) | |
| 03 | Cutting Process | P | Cutting Time | number(2dp) | |
| | | Q | Cutting Length | number(2dp) | |
| 04 | Bending | R | No. of Bend | number(2dp) | |
| 05 | Fasteners | S | Fasteners | text | Default **"None"** |
| | | T | Fasteners Qty | number(2dp) | **Visible only when S is not "None" and not blank**; otherwise hidden and set to **0** |
| | | U | Fasteners Cost | number(2dp) | Same rule as T |
| 06 | Welding | V | Weld | number(2dp) | |
| | | W | Drilling | number(2dp) | |
| | | X | Tapping | number(2dp) | |
| | | Y | CSK | number(2dp) | |
| 07 | Surface Treatment | Z | Hot Dip Galvanizing | flag 1/0 | All eight shown as **one multi-select drop-down**; selected = 1, not selected = 0 |
| | | AA | Primer | flag 1/0 | |
| | | AB | Shot Blasting | flag 1/0 | |
| | | AC | Polishing | flag 1/0 | |
| | | AD | Plating | flag 1/0 | |
| | | AE | Powder Coating | flag 1/0 | |
| | | AF | Foam | flag 1/0 | |
| | | AG | Soft Anodize | flag 1/0 | |
| 08 | Other Costs and Remarks | AP | Machining Cost | number(2dp) | |
| | | AU | Plating Cost | number(2dp) | |
| | | BM | Tool Cost | number(2dp) | Engineer input like every other field (§18 D-05, confirmed); enter 0 where the part has none (§18 D-06, confirmed) |
| | | AJ | Remarks | text (multiline) | |

### 7.2 Display rules
- Card grid: **1 column on mobile, 2 on tablet, 3 on laptop/desktop**.
- The section order above is the on-screen order; the Excel export uses column-letter order.

### 7.3 Validation
- **All visible input fields are mandatory** when the user clicks **Calculate**. A blank field produces an inline error, and the node is flagged in the tree. **Exception:** Part Model (C) is optional (§18 D-31).
- Conditionally hidden fields (T, U when S = "None"/blank) are not required and take the value **0**.
- Numbers: ≥ 0 **[DEFAULT]**, max 2 decimal places.
- Surface Treatment: selecting none is valid (all eight = 0) **[DEFAULT]**.
- **Pass 3 (§18 D-06, confirmed):** where a part does not need a number field, including a parent (assembly) node, the user enters **0** (AQP-7), so the mandatory rule above still applies to every node and the calculations are not affected. **Exception, QTY per Assy (H) (gate record G3 condition 10; DL-013):** a 0 in H is not "no effect". H is the number of pieces (§7.1), so 0 means zero pieces: the row's own cost is 0 (version 1.9: no other row is affected; before the whole-order rule, everything below the row counted 0 times as well). "The calculations are not affected" holds for every number field except H. On any part, with or without parts below it, a 0 in H produces a warning at Calculate and is not refused: no minimum and no block (§7.1; §18 D-22; OQ-ARCH-10, answered "Warn"; Q-38, answered "Yes" on 2026-11-02). Premise changed at version 1.9 and the Warn kept (Q-41, §18 D-26). For Material in Drawing (E) and Treatment / Color (G) the user chooses **"Not applicable"** (AQP-1 comment 10441 (b)), which closes the assembly-row problem (finding F-08).

### 7.4 Calculated fields (Admin/Lead only), grouped into six stages
Formulas refer to columns **in the same row (node)** unless stated. Rate names come from the **selected customer's** rates; `Material-*` values come from the Material Master row for column E.

| Stage | Letter | Output | Formula |
|---|---|---|---|
| 1 · Weights & Areas | M | Blank Weight | `(L * K * J * Material-Specific-Gravity) / 1000000` |
| | O | Scrap Weight | `IF(Material-Specific-Gravity > 0, M - N, 0)`. **Changed at version 1.5 from the SPEC 1.0 text `M - N`** (gate record G3 condition 10; architecture §4.9). Reason: a part with the "Not applicable" material has all material values at 0 (§18 D-17), so M is 0 and `M - N` would show a negative Scrap Weight equal to minus the Part Weight. With the guard, O is 0 on such a row, and every row with a real material gives exactly `M - N`, including a Part Weight above the Blank Weight. No price effect: Material Cost (AK) is 0 on that row either way. A real material whose Specific Gravity is 0 would also take the guard; whether the Material Master should refuse a Specific Gravity of 0 is raised as UX-37 and is not decided here. |
| | AH | Area in Sq. in | `(J * K * 2) / 645` |
| | AI | Area in Sq. ft | `AH / 144` |
| 2 · Material Cost | AK | Material Cost | `(M * I) - (O * Material-Scrap-Rate)` |
| 3 · Process Costs — Cutting | AL | Cutting Cost | `P * Cutting-Rate-per-Sec` |
| Bending | AM | Bending Cost | `R * Bending-Rate-per-stroke` |
| Welding | AN | Drilling / Tapping Cost | `(W + X + Y) * Drilling-Tapping-Rate` |
| | AO | Welding Cost | `N * Welding-rate-per-kg * V` |
| Surface Treatment | AQ | Hot Dip Galvanizing Cost | `(N * Dip-Galvanizing-Cost-per-kg) * Z` |
| | AR | Primer Cost | `(AI * Primer-rate-per-sqft) * AA` |
| | AS | Shot Blasting Cost | `(N * Shot-Blasting-rate-per-kg) * AB` |
| | AT | Polishing Cost | `AC * ((AH / 2) * Polishing-rate-per-sqin)` |
| | AV | Powder Coating Cost | `AE * (AI * Powder-rate-per-sqft)` |
| | AW | Foam Cost | `AF * AI * Foam Cost` |
| | AX | Soft Anodize Cost | `AG * (AH * Soft-Anodize-rate-per-sqin)` |
| Entered directly | AP, AU | Machining Cost, Plating Cost | inputs (section 08) |
| Process Total | AY | Total Process Cost | `AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX` |
| 4 · Sub Total | AZ | BO Cost / Fasteners | `T * U` |
| | BA | Material Cost + Total Process Cost + Others | `AK + AY + AZ` |
| | BB | Sub Total 1 | `BA * H` |
| 5 · Rejection, Overheads & Logistics | BC | Rejection | **To be confirmed** — seed as `0` (see §15) |
| | BD | OH Profit | `BB * OH Profit %` |
| | BE | Inspection & Packing | `BB * Inspection & Packing %` |
| | BF | Transportation | `BB * Transport %` |
| 6 · Pricing | BG | Unit Production Price (INR) | `BB + BC + BD + BE + BF` |
| | BH | Exchange Rate USD | Exchange Rate Master (1 USD → INR) |
| | BI | Exchange Rate EUR | Exchange Rate Master (1 EUR → INR) |
| | BJ | Unit Production Price (USD) | `BG / BH` |
| | BK | Unit Production Price (EUR) | `BG / BI` |
| | BL | Total Unit Production Price (INR) | Product-level value, **shown in row 2 only**; seeded as `SUM(BG)` (§8.2). **Rule in force (§18 D-08, details D-12; rewritten 2026-11-02 at version 1.9 by the delivery lead's answers on AQP-26, comments 10533 to 10537, relayed verbatim from the chat; it replaces the every-level rule of version 1.4):** QTY per Assy (H) is the count of the part for the whole order, typed on every row. Each row's BG already carries that count (`BB = BA * H`), so BG is the count times the cost of one piece, with the percentage additions of stages 5 and 6 (BC is seeded 0, §15). BL is the sum of column BG over every row of the estimate. No row is multiplied by the H of any other row, and no sum is multiplied by an item quantity. 2 frames, 3 pipes on each frame and 4 lids on each pipe are typed 2, 6 and 24. Invented examples: 4 frames at 150 rupees a frame, with 3 brackets on each frame at 20 rupees a bracket, are typed 4 and 12, so BG is 600 and 240 and BL is 840 (the figures 600 and 240 and the typing are theirs, AQP-26 comment 10535; the 840 is their two figures added, not a number they stated); one single piece typed 5 at 200 rupees a piece gives BL 1000 (their number, AQP-14 comment 10510, §18 D-21). Column BG only; Tool Cost (BM) entries are totalled as typed (§18 D-05). Points: (a) the count is typed for the whole order at every level; the portal does not derive it from the rows above, check it against them, or rescale it when another row changes; (b1) a parent's own BG counts together with its descendants' (their own words, AQP-13 comment 10464: "parent's own cost counts"); (b2) a non-zero value typed on a parent is not ignored, refused or warned about; (b3) on screen a row shows its own BG, BJ and BK and the export shows each row's own values; a parent shows only its own row's figures, with no sum of the rows below it (§18 D-25; their words relayed, AQP-1 comment 10542: "Q-35(b) - no, not required"); (c) the item's own row is a row like any other, with or without parts below it: answered for a single piece (§18 D-21, 1000) and for an item with a part below it (AQP-26: typed 4 and 12, BL 840; Q-39 answered; ASSUMPTION-57 retired); (d) several top-level items add up, because BL adds every row; (e) the item's own row is inside the range and only column BG is added (list wording, AQP-13 comment 10462). This is the worksheet's own rule, `SUM(BG)` over the rows (§18.5), so the portal no longer differs from the worksheet on this point, at any quantity. |
| | BN | Total Unit Production Price (INR) / Tool Cost (INR) | `BL / SUM(BM)`, where `SUM(BM)` is the total of the Tool Cost entries of all nodes of the estimate; calculated when that total is above 0; shows "—" when it is 0; **shown in row 2** (§18 D-05, confirmed, AQP-1 comment 10441 (a)). One total only, with the total Tool Cost shown in the export (§18 D-16; Q-31 answered). |
| | BO | Approved Quote Price | Entered by Admin/Lead at approval (calculated BL or an override); **product-level, row 2 only** |

> **Status (§18, updated 2026-11-02, version 1.9):** (1) BN = BL / total of all BM entries (D-05) is confirmed and replaces the earlier row-2 BM divisor. (2) The cost rule: H is the count for the whole order on every row and BL is the sum of BG over every row (D-12, rewritten at version 1.9 by AQP-26 comments 10533 to 10537). It replaces the every-level rule of version 1.4 and the multiply-once rule of version 1.3, both withdrawn. The worksheet's own formula is the sum of BG, so the portal and the worksheet agree at any quantity. (3) The item's own row has no special rule: answered for a single piece (Q-35 (a), D-21: 1000) and for an item with a part below it (Q-39 answered: typed 4 and 12, BL 840). ASSUMPTION-51 and ASSUMPTION-57 are retired. A parent shows only its own row's figures (Q-35 (b) answered, §18 D-25; ASSUMPTION-59 ends). (4) The wording of assistant-drafted comment 10415 ("child cost x parent quantity", 2 x 3 = 6) was withdrawn on 2026-11-01 as written and is not the authority for the rule. Worked check and constructed example: §18.5.

**Percent rates:** a rate named `… %` is entered as a percentage (e.g. `12` = 12%) and evaluated as a fraction (0.12) **[DEFAULT]**.

**Hide zero treatment lines (MUST):** In the cost view, an output whose value depends on an unselected Surface Treatment flag is **hidden** (AQ↔Z, AR↔AA, AS↔AB, AT↔AC, AV↔AE, AW↔AF, AX↔AG). Implement this generically: each output field may have a `hideWhenZero: fieldId` property. Hidden outputs are **still calculated and still exported** as 0.

**Division by zero:** shows "—" on screen and exports an empty cell **[DEFAULT]**. It never crashes a calculation.

---

## 8. Field Registry and Formula Engine (Admin configuration)

This is the core of the system. Design it carefully.

### 8.1 Data model
- `FieldDefinition`: `id` (stable UUID), `key`, `label`, `kind` (`input` | `auto` | `output`), `dataType` (`number` | `text` | `select` | `select_other` | `flag` | `image` | `auto_lookup`), `sectionId` (nullable), `position` (integer order), `formula` (for outputs; stored in **internal form**), `hideWhenZero` (nullable fieldId), `visibleWhen` (nullable condition, e.g. `S not in ['None','']`), `defaultValue`, `mandatory`, `rowScope` (`row` | `product` — product-level fields like BL and BO), Excel `width` and `numFmt`.
- **Column letters are DERIVED from `position`**, never stored. Use a helper `indexToColumnLetter(n)` (A…Z, AA…AZ, BA…; Excel algorithm) and its inverse.
- **Formulas are stored using stable field IDs** (e.g. `{{f:uuid}} * {{rate:Cutting-Rate-per-Sec}}`). They are **displayed and edited using column letters** (e.g. `P * Cutting-Rate-per-Sec`). Converting between the two forms makes **re-lettering automatic**: inserting or deleting a field changes positions, and every displayed formula updates without being rewritten.

### 8.2 Formula language
- Operands: column letters (same row), rate names from the Process/Customer Master, `Material-*` fields, `ExchangeRate-USD`/`ExchangeRate-EUR`, numeric literals.
- Operators: `+ - * / ( )`. Functions: `SUM(column)` (across all nodes; for product-level fields) **[DEFAULT: also MIN, MAX, ROUND, IF(cond, a, b)]**. **Added at version 1.5 (gate record G3 condition 10; design in architecture §4.9):** comparison operators `>`, `>=`, `<`, `<=`, `=` and `<>`, valid only as the condition of `IF`; the seed formula for Scrap Weight (O, §7.4) uses one. BL is seeded as `SUM(BG)` and BN as `BL / SUM(BM)` (§7.4).
- Names containing spaces or `%` (e.g. `Foam Cost`, `OH Profit %`) are resolved by exact match against the rate list. The editor offers autocomplete for letters and rate names.
- Implement with a tokenizer → parser (AST) → evaluator. **No `eval`.**
- Calculation order is determined by a **dependency graph** (topological sort). **Circular references are rejected** on save, with the cycle shown.
- Validation on save: unknown column letters or rate names, syntax errors and cycles block the save, with a clear message.

### 8.3 Admin capabilities
| Capability | Requirement |
|---|---|
| View formulas | Admin and Lead see each output's formula next to its value (Lead read-only). |
| Edit formula | Admin edits in a formula editor with autocomplete, live validation and a preview against a sample node. **Saving requires password re-entry** (step-up authentication). |
| Insert input field | Admin chooses **position** ("insert after column __") and **group** (existing section such as Surface Treatment, a new section, or none), plus label, data type, options, default and visibility rule. |
| Insert output field | Admin chooses position, label, formula, stage and optional `hideWhenZero`. A new output is included in a total only when the Admin edits that total's formula. |
| Insert input with cost column | In one guided step, the Admin adds an input and its linked cost output, choosing each column's position and giving the formula. A preview shows the letter changes before saving. Later columns shift right and other formulas keep working, as under "Automatic re-lettering". |
| Delete field | The portal lists every formula that references the field; deletion is **blocked until those references are removed**. Requires password re-entry. |
| Automatic re-lettering | Inserting at a position gives the new field that letter; all later fields shift **+1**. Deleting shifts later fields **−1**. All formulas display the new letters automatically. *Example:* inserting after AX makes the new field AY; Total Process Cost moves AY→AZ, and every formula that showed AY now shows AZ. |
| Fixed cells move | Product-level cells move with their columns (e.g. inserting before BL moves the total from BL2 to BM2; deleting a column before BL moves it to BK2). |
| Checkpoints | Admin can **save a named checkpoint** of the whole field/formula configuration (fields, sections, formulas) at any time, list checkpoints, and **revert** to any checkpoint (with confirmation and password re-entry). Checkpoints cover configuration only — **never estimate data**. Reverting is itself logged and can be undone by reverting to another checkpoint. |
| Change history | Every configuration change (field insert/delete/edit, formula edit, revert) is logged: who, when, old value → new value. Viewable and filterable by the Admin. |

### 8.4 Configuration versioning (MUST)
- Every configuration change creates a new immutable **ConfigVersion** (snapshot of all field definitions and formulas).
- Each estimate records the **ConfigVersion** it was last calculated with.
- **Approved estimates are pinned to their ConfigVersion** and are never affected by later changes. They keep the fields, formulas and values they were approved with, and their export uses that version's layout.
- **New and unlocked estimates** use the **latest** ConfigVersion when (re)calculated. When an estimate is unlocked, show a notice if the configuration changed since approval.
- **Pass 3 (§18 D-07, confirmed):** the same protection covers **master values** (customer rates, material price, specific gravity and scrap rate, exchange rates): an approved estimate is not affected by any later change (AQP-8). Each Calculate or Recalculate keeps a record of the master values it used. Recalculating after an unlock uses the **current** rates and shows a notice if the configuration or any rate has changed since approval (AQP-1 comment 10441 (c)).
- New input fields follow existing rules: mandatory and visible to Engineers. New outputs are hidden from Engineers.

---

## 9. Screens

| Screen | Roles | Key content |
|---|---|---|
| Login / Forgot password | all | Email + password; password reset via emailed link **[DEFAULT]** |
| Dashboard / Task queues | all | Open / Closed / Overdue tabs; counts; search & filter by engineer, customer, date |
| Assign task | Admin, Lead | §5.1 form |
| Estimate workspace | all (role-filtered) | Customer selector; tree panel; node editor with section cards; Save / Calculate / Recalculate / Approve & Lock / Unlock / Cancel approval (Admin only) / Download (only while a calculation is current); status badge |
| Cost details (per node) | Admin, Lead | Stage-grouped outputs with formulas; hidden-zero rule applied |
| Masters (Process, Customer, Material, Exchange Rate, Treatment/Color) | Admin | CRUD tables with search; sync prompt (§4.2) |
| Field & Formula configuration | Admin (Lead read-only view of formulas) | Worksheet-style column list (letter, label, section, type, formula); insert/delete; formula editor; checkpoints; change history |
| Users | Admin | Create / edit / deactivate users; assign role |
| Settings | Admin | Email alerts ON/OFF; email test button; "Last backup" line (§18 D-33) |
| About | all | Site description, **Version No: 1.0**, "© Accucut Lasers Pvt Ltd. All rights reserved." The description wording stays as reviewed on screen SCR-24, including the word "cost" (§18 D-18, their words relayed: "The wording is fine."): "The Accucut Quotation Portal helps Accucut Lasers prepare, review and approve manufacturing cost estimates. Engineers enter part details, the portal does the calculation, and a Lead or Admin reviews and approves the estimate." The word is descriptive text, not a cost value |

Global header: the logo, the name "ACCUCUT LASERS" in the logo red (§17.2) with "Quotation Portal" beneath it, notification bell (§5.3), user menu (profile: name, email, change password, logout). *Header wording, version 1.5:* the SPEC 1.0 text was "logo/name 'Accucut Quotation Portal'". The wording above is the product manager's proposal, accepted as the working baseline (DL-016): it follows §17.2 and the screens the delivery lead reviewed. It is not a decision of theirs, and they may reverse it.

---

## 10. Excel Export (MUST)

- An `.xlsx` that **replicates the client's sample worksheet**: the same fixed header row (row 1), columns **A–BO** in letter order with the **same column widths**, and **all cells horizontally and vertically centred**. All cell formats are preserved, including **currency formats** (₹ for INR columns, $ for USD, € for EUR).
- The sample worksheet is the reference. **Place it at `docs/reference/sample-estimate.xlsx`** and read column widths, header text and number formats from it when seeding the field registry. *(The sample is not yet in the repository — ask the client for it; until then, use sensible widths and formats and keep them configurable per field.)* **Correction (G2 remediation, 2026-11-01):** the original workbook `AMADA-20261006.xlsx` is already tracked in the repository on `origin/master` since commit c7576f0, and the repository is public. The statement above is the SPEC v1.0 text and is no longer true. The delivery lead decided on 2026-11-01 (AQP-1 comment 10465, §18 D-13) to keep the repository public and states that the workbook has no real data; that is their statement and the analyst has not verified it. Whether a cleaned copy is still wanted at that path stays Q-30. No sample cell values are copied into documents (cat. NFR-023).
- Rows: row 1 = headers; from row 2, one row per tree node in **depth-first order** (1, 1.1, 1.1.1, 1.1.2, 1.2, …, 2, …). Column A contains the Sl. No text.
- Column C embeds the part-model image, scaled to fit the cell.
- **Every column is exported**, including outputs hidden on screen because they are zero (exported as 0) and hidden Fasteners Qty/Cost (0).
- Product-level values: **BL2** = Total Unit Production Price (§7.4 BL), **BO2** = Approved Quote Price, **BN2 = BL2 / total of all BM entries** (§18 D-05, confirmed, AQP-1 comment 10441 (a)). **One total only (§18 D-16; their words relayed, AQP-1 comment 10490: "One total only"):** BL, BN and BO appear once, in row 2 (the row-2 position is this section's existing rule, not a sentence of theirs), and the export has no per-item totals. **The total Tool Cost is shown in the export** ("yes he Total Tool cost should be shown", as written). Its exact position is for the ux-expert and solution-architect; it must not replace any node's own Tool Cost entry in column BM. **The export now knowingly differs from the sample on this point** (the sample shows totals per top-level item): acceptance test 12 and BRQ-005 are read with this exception. Where the exported BG column is added up by hand, it equals BL only when every quantity above a row is 1 (§7.4 BL).
- **Pass 2 (§18 D-03):** the sample worksheet is `AMADA-20261006.xlsx`. Placing a cleaned copy at `docs/reference/sample-estimate.xlsx` is still open (Q-30); note that the original is already tracked (see the correction in §10). If columns are inserted or deleted, these cells move with their columns.
- Inserted or deleted fields are reflected in the export in **Excel letter sequence**; new columns use their configured width and format.
- File name: `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx` **[DEFAULT]**.

---

## 11. Responsive Design and UX (MUST)

Target viewports: **mobile 360–767 px, tablet 768–1023 px, laptop/desktop ≥ 1024 px**. Test at 360×800, 768×1024, 1024×768, 1366×768 and 1920×1080 (portrait and landscape).

| Area | Mobile | Tablet | Laptop/Desktop |
|---|---|---|---|
| Navigation | Bottom/hamburger nav; bell always visible | Collapsible side nav | Persistent side nav |
| Task queues | Card list (one task per card) | Table with priority columns | Full table |
| Estimate tree | Slide-over drawer opened by a "Parts tree" button; breadcrumb of the current node | Collapsible left panel | Persistent left panel (resizable) |
| Section cards | 1 column | 2 columns | 3 columns |
| Cost details | Accordion per stage | Accordion | Side panel or expandable rows |
| Master/config tables | Stacked cards with key fields; horizontal scroll only inside the table container | Table | Table |
| Action buttons | Sticky bottom action bar (Save / Calculate / …) | Sticky footer | Toolbar |

General UX:
- Modern, professional look following **§17 UI Direction**. Light mode only in the first release: **dark mode is outside scope A** (§18 D-14; scope A, their own words, AQP-12 comment 10488, is defined without dark mode). The earlier **[DEFAULT]** of light and dark mode (ASSUMPTION-43) is kept for a later release.
- Touch targets ≥ 44 px. No horizontal page scrolling at any breakpoint.
- Image input: on mobile, the file picker allows the camera/gallery; paste and drag-drop also work on desktop.
- Numeric fields use `inputmode="decimal"`.
- Date-time picker shows IST explicitly.
- Unsaved-changes warning on navigation. Autosave drafts every 30 s **[DEFAULT]**.
- Accessibility: **WCAG 2.2 AA** (version 1.5; the SPEC 1.0 text was 2.1 AA. The product manager's proposal, accepted as the working baseline, DL-016: 2.2 AA includes everything in 2.1 AA, the design already meets it, and the delivery lead may revert to 2.1 AA) — labels on every input, keyboard-navigable tree (arrow keys), visible focus, status conveyed by more than colour.
- Clear loading, empty and error states; toast confirmations for saves.

---

## 12. Non-functional Requirements

- **Security:** server-side RBAC on every route and API; CSRF protection; secure, HttpOnly cookies; rate-limited login; step-up re-authentication for formula edits, field deletion and checkpoint revert; input sanitisation; image type validated by content (magic bytes), not by extension.
- **Passwords and sessions (§18 D-19):** a password has 10 to 128 characters, at least one number and at least one symbol, is not the user's e-mail address and is not a common password. A session lasts 12 hours. Source: the 10-to-128, e-mail and common-password parts and the 12 hours were proposed by the ux-expert and solution-architect; the delivery lead added the number and the symbol and said "Rest looks good" (their words, relayed, AQP-1 comment 10490: "Need atleast one number and a symbol in the password. Rest looks good"). Which symbols count, and whether the 12 hours run from sign-in or from the last activity, are not stated; that is design detail for the solution-architect (ASSUMPTION-56).
- **Audit:** log configuration changes, approvals, unlocks, Approved Quote Price overrides (with the reason when one is given; the reason is optional, §18 D-18) and master-data edits (who, when, before → after).
- **Performance:** an estimate with 500 nodes recalculates in under 2 s; pages are interactive within 2 s on a mid-range mobile on 4G.
- **Reliability:** database backup once a week, each backup kept for 2 years, with the copies kept on the same server and the Admin only checking that they ran, using the "Last backup" line in Settings (§18 D-15, D-33; their words relayed: "Weekly once backup is good. It should be kept for 2 years. Admin looks after them"; "Yes only Admin only checks"; "Backup on the same server", AQP-1 comment 10550). The guidance and restore steps are in the README; restores are not an Admin task, and who restores is not stated. Copies on the same server mean a server or disk failure loses the live data and every backup together; they were told this (comment 10550). This replaces the "daily" guidance of version 1.3. A weekly backup can lose up to a week of work; the orchestrator told them so (AQP-1 comment 10490) and weekly stands unless they change it. Email failures are retried and logged.
- **Data integrity:** calculations run on the server (the client may show a live preview to Admin/Lead only). Stored results are recomputed on Calculate/Recalculate.

---

## 13. Suggested Build Order

1. Project scaffold, auth, users and roles, layout shell (responsive nav, bell placeholder, About page).
2. Masters (Process, Customer with sync rules, Material, Exchange Rate, Treatment/Color), plus Settings.
3. Field registry + seed configuration + formula engine (parser, dependency graph, evaluator), with an exhaustive unit-test suite.
4. Tasks: assignment, queues, overdue logic, bell.
5. Estimate workspace: tree, section cards, validation, conditional fields, Save/Calculate.
6. Cost view (Admin/Lead), approval / lock / unlock, Approved Quote Price.
7. Excel export.
8. Admin configuration UI: insert/delete fields, formula editor, re-lettering, ConfigVersions, checkpoints, change history.
9. Email alerts + scheduled jobs.
10. Responsive polish, accessibility pass, E2E tests across the viewports in §11, Docker deployment and README.

---

## 14. Acceptance Criteria (minimum)

1. An Engineer cannot obtain any cost, rate or formula value through any page, API response or export (automated test).
2. With a known set of inputs and rates, every output in §7.4 matches a hand-calculated worksheet to 2 decimals (unit tests per formula, plus one end-to-end tree with 1, 1.1, 1.1.1, 1.1.2, 1.2–1.5). **Version 1.9:** BL is the sum of BG over every row (§7.4 BL; §18.5), which is the worksheet's own `SUM(BG)`, so the match holds at any quantity and not only when every quantity is 1. The sample has Qty / Assy = 1 on every row, so it does not exercise a count above 1: the test plan needs a constructed example with counts above 1 on several rows, typed as whole-order counts, and with two top-level items (§18.5). Tests may assert BL = 1000 for the invented single piece (typed 5, 200 rupees a piece; their number, §18 D-21), BL = 840 for the invented frames and brackets (typed 4 and 12, at 150 and 20 rupees; AQP-26, §18 D-12; no labelled assumption behind it), and the invented 2, 6 and 24 of §18.5. Expected values are computed by hand from these definitions before the test is run.
3. Sl. No renumbers correctly after add, reorder and delete at any depth.
4. Clicking Calculate with any visible input blank shows errors and does not submit (Part Model, C, is optional and never an error, §18 D-31); with Fasteners = "None", T and U are hidden, not required, and stored/exported as 0.
5. Unselected Surface Treatment outputs are hidden in the cost view but present (0) in the export.
6. Inserting a field after AX produces a new AY; former AY…BO shift by one; all formulas display the updated letters and still calculate the same results; the BL/BO product cells move to BM2/BP2.
7. Deleting a referenced field is blocked with a list of the referencing formulas; deleting an unreferenced field shifts later letters back by one.
8. Reverting to a checkpoint restores the exact earlier configuration; approved estimates still show and export their original values and layout.
9. Formula save, field delete and checkpoint revert all require password re-entry; a cyclic or invalid formula cannot be saved.
10. Process Master updates propagate to customers; manually overridden customer values trigger the keep/apply prompt; Reset to Defaults works.
11. The assignment email, the immediate overdue email and the 11:00 IST daily digest are sent with the correct To/Cc only when alerts are ON, without duplicates.
12. The export opens in Excel with the A–BO layout, the original column widths, centre/middle alignment, currency formats, embedded images, and BL2/BO2 populated. **Exception (§18 D-16, their decision):** the export has one total only (no per-item totals as in the sample) and shows the total Tool Cost.
13. All screens work without horizontal page scroll, and with all actions reachable, at 360 px, 768 px and 1366 px widths (Playwright).
14. Only one active Admin can exist.
15. The Excel download is refused while no calculation is current: for an estimate never calculated, and after any input changes until Calculate or Recalculate is pressed; with a current calculation a Lead or Admin can download (§6.5; §18 D-28, D-30).
16. Only the Admin can cancel an approval and remove the earlier approved price; a Lead cannot (§6.3; §18 D-29). Whether the removal is built in Release 1 follows the design and sizing ("only IF POSSIBLE").
17. When rates have changed after the last calculation, approval shows a notice to the Lead and is not blocked (§6.3; §18 D-32).

---

## 15. Open Items (implement the interim behaviour; keep it configurable)

| # | Item | Interim behaviour |
|---|---|---|
| 1 | **Rejection (BC)** formula not defined | Seeded formula `0`; the Admin can set it later through the formula editor (e.g. `BB * Rejection %` after adding a `Rejection %` rate). |
| 2 | **Parent vs. child cost:** BL sums BG of *all* nodes, so a parent node's own cost and its children's costs are both included | **Pass 3 (§18 D-08), revised at version 1.9:** answered by the delivery lead: a parent's own cost and its children's costs are both included, and the estimate's total is the sum of BG over every row (§7.4 BL). The sample worksheet agrees (§18.5). **Details answered (Q-32, §18 D-12; settled 2026-11-02, AQP-26 comments 10533 to 10537):** QTY per Assy is the count for the whole order on every row (2 frames, 6 pipes, 24 lids) and no row is multiplied by another row's quantity; a parent's own cost counts; several top-level items add up. The item's own row is a row like any other (§18 D-21; Q-39 answered). A parent shows only its own row's figures (§18 D-25). |
| 3 | **Sample worksheet** not yet provided | Use placeholder widths/formats; replace them once `docs/reference/sample-estimate.xlsx` is supplied. **Pass 2 update (§18 D-03):** the sample is `AMADA-20261006.xlsx`; the cleaned copy for the repository is open (Q-30). **Correction (2026-11-01):** the original is already tracked on `origin/master` since commit c7576f0 (RISK-006). **Decision (2026-11-01, §18 D-13):** the delivery lead keeps the repository public and states that the workbook has no real data (their statement, not verified by the analyst). |
| 4 | **Network folder links** may be blocked by browsers | `file:///` link + "Copy path" button (§5.1). |
| 5 | **Remarks (AJ)** is mandatory under the "all inputs mandatory" rule | Mandatory as specified; can be switched off per field in configuration. |
| 6 | **Plating flag (AD)** is not used in any formula; Plating Cost (AU) is entered manually | Implement as specified. |
| 7 | **"Not needed for this part" switch** (proposed): one click on a section sets its fields to 0 and collapses it, to speed up entry; zeros still export | **Closed (§18 D-06, AQP-1 comment 10441 (f)); also in their own words, relayed (§18 D-18, AQP-1 comment 10490: "No switch"):** not built, and the question is not reopened. The Engineer enters 0 (AQP-7) and chooses "Not applicable" in the Material and Treatment lists. |
| 8 | **Logo source file:** the supplied logo is only 200 × 200 px and may look soft on large screens | Use `docs/03-ux/assets/accucut-logo.jpg`; replace it when a sharper original (SVG, AI or large PNG) is supplied. |

---

## 16. Glossary

- **Item / Part / Sub-part:** nodes in the product tree; all share the same fields.
- **Node row:** one row of the worksheet, i.e. one node of the tree.
- **Column letter:** Excel-style identifier of a field (A, B, …, AA, …), derived from its position.
- **ConfigVersion:** immutable snapshot of the field/formula configuration.
- **Checkpoint:** a named ConfigVersion the Admin can revert to.
- **Approved Quote Price:** final price set by Lead/Admin at approval (formerly "Final-Final Estimate").
- **QTY per Assy (H):** the count of a part for the whole order. The Engineer enters the details of one piece and types here how many of that piece the whole order needs (their words, relayed, AQP-26 comments 10535 and 10537; the definition of 2026-11-01, AQP-13 comment 10487, fits when the parent's count is 1). 2 frames, 3 pipes on each frame and 4 lids on each pipe are typed 2, 6 and 24. No row is multiplied by another row's H.
- **Not applicable:** a system-created entry in the Material in Drawing and Treatment / Color lists for a part that needs none (§4.3, §4.5, §18 D-17).

---

## 17. UI Direction (client decisions, 2026-10-31)

These decisions override earlier sections and the sample where they differ.

### 17.1 Baseline
`Accucut Quotation Portal UI-UX.html` is a high-level sample. Keep its structure, including its type scale, spacing scale, button set and field grids, and make it more advanced, easier to use and flexible enough to take more features later. Replace its colours as below.

### 17.2 Brand
| Element | Decision |
|---|---|
| Logo | Use the real logo file (`docs/03-ux/assets/accucut-logo.jpg`) exactly; never redraw it. Its black lettering needs a light background, so the top bar is white. |
| Company name | "ACCUCUT LASERS" in the logo red, in a bold serif matching the company board (`docs/03-ux/assets/accucut-company-board.png`). Tinos Bold is the closest match found so far. |
| Colour direction | **"Red Leads":** logo red (about **#DE3030**) for main buttons and active markers; dark graphite side menu (about #17181C); white and light grey surfaces. Replaces navy #1F3864 and the sample's blue. |
| Errors | Red is used widely, so errors must never rely on colour: use an icon, a thick border and a written message. Use a separate, darker error red (about #B3261E). |

All text and control colours must still meet the WCAG contrast requirements in §11.

### 17.3 Design system
- One font size each for main headings, subheadings, body text and small labels.
- One spacing scale for all padding and margins, so sections feel balanced and even.
- One button style set, used everywhere, and one colour palette.
- Every section should feel professionally designed by the same hand.

### 17.4 Data entry
- Engineers use the **guided form**: one part at a time, section by section, with the parts tree beside it. A spreadsheet-style grid is not used.
- Every field shows its Excel column letter, and every section shows its column range. Letters update automatically when columns change.
- Parts in the tree that have missing data are flagged with an icon as well as colour.
- Keyboard entry must be fast: Enter moves to the next field.
- **Excluded:** "Copy from part" and "Apply to selected". Two parts very rarely share the same data.

### 17.5 Next release (not in this version)
Reading data from drawings is deferred. Drawings are not standard and vary by customer, and no drawing file is provided to the portal in this version. The estimate screen must leave room to show a drawing beside the form later, without a redesign.

### 17.6 SEO and social sharing
- Every page has a proper title and meta description.
- Pages have an Open Graph title and description, so a shared link looks good on social media.
- These tags must never contain cost, rate or customer data.

---

## 18. Delivery Lead Answers (Discovery Pass 2, added 2026-11-01; updated in Pass 3, 2026-11-01)

The delivery lead (Santhosh - MD) answered the discovery questions on Jira on 2026-10-31 and, on 2026-11-01, confirmed, corrected or qualified the items that had rested on assistant-drafted wording (AQP-1 comments 10415 and 10417). Some of that confirmation is in their own words and some is a blanket confirmation of the orchestrator's list wording; the status rule below says which. The full question text, the assumption used and the source comment for each answer are in `docs/01-discovery/requirements-questions.md`.

**Status rule (one rule for the whole document).** Every answer below has one of these statuses.

- **Confirmed:** their own words on Jira support it; the comment ID is shown. It is their decision. Where it changes SPEC text, the note in that section says so.
- **Confirmed on list wording:** they confirmed it by their sentence "I confirm the below items that I answered already" (AQP-1 comment 10441) above a list whose wording is the orchestrator's (comment 10426, repeated word for word). It is confirmed by them and stands, but it is **not their own words** (decision DL-001, gate log G2). Items (a), (b), (c), (f) and (g) of that comment have this status. They can change any of them later. The same standard applies to the replies on AQP-13 comment 10462 for Q-32 (a), (b2) consequence, (b3), (c), (d), (e1), (e2) and the closing "Okay": the delivery lead answered bullet by bullet against the labelled ASSUMPTION-48 list, the orchestrator stated that reading to them (comment 10463) and they did not object (comment 10464). These are theirs and stand, but they are not their own words (D-12).
- **Confirmed as corrected / qualified:** they confirmed it only after correcting or qualifying it. The corrected or qualified text applies, not the earlier wording.
- **Their own words, relayed (added in version 1.4):** their answers to the G3 questions were given in the Claude Code chat and posted verbatim by the orchestrator in AQP-1 comment 10490, with the orchestrator's own readings kept outside the quotation marks. Under decision DL-007 (2) a relayed reply counts as theirs if it is labelled, verbatim and confirmed by the session log. The analyst did not read any session log; the log check is the master's. Their "APPROVED" on AQP-1 (comment 10491) follows the relay and is the G3 reply; it is not read as a separate confirmation of each answer. Statuses below say "relayed" for these. Where a reading was put to them and they did not object, it is recorded as that and not as their statement.
- **Open detail:** a confirmed answer that leaves a detail unclear, or that conflicts with the sample worksheet, is not guessed. A new or revised question (Q-nn) records it, and the labelled assumption named there applies until they answer.

**History.** In Pass 2 (before they replied), content that rested only on AQP-1 comment 10415 (2026-10-31, 23:39) or 10417 (23:53) was marked UNCONFIRMED (UNC-a to UNC-h) and did not replace SPEC text, because that wording was an assistant draft, not their. In Pass 3 they replied. In their own words: AQP-1 comment 10443 (a correction to (d)), AQP-9 comment 10442 and AQP-13 comment 10445 (the corrected cost rule, same text), AQP-11 comment 10444 (offline use in the next release) and AQP-12 comment 10446 (what the date means). Items (a), (b), (c), (f) and (g) of AQP-1 comment 10441 were confirmed on the orchestrator's list wording (see "Confirmed on list wording" above). The labels UNC-a to UNC-h stay as identifiers; none is unconfirmed now. The register is in `requirements-questions.md` section 4. On 2026-11-01 the delivery lead also answered Q-32 (AQP-13 comments 10462 and 10464) and decided the repository question (AQP-1 comment 10465). **G3 answers (2026-11-01, after the reconciliation of UX and architecture).** In their own words on Jira: AQP-13 comment 10487 (the definition of QTY per Assy), AQP-12 comment 10488 (scope A) and AQP-1 comment 10491 ("APPROVED"). In their own words, relayed from the chat: the rest of AQP-1 comment 10490 (D-14 to D-20, and the count of 24 lids). The count of 24 and the definition together reverse the working rule of D-12 (a) (the quantity multiplies once, at the top item), which had been accepted on list wording only (DL-006). **Later answers (2026-11-01, relayed verbatim from the chat by the orchestrator under the same standard):** AQP-14 comment 10510 (Q-35 (a), D-21), AQP-15 comment 10511 (OQ-ARCH-10, D-22) and AQP-10 comment 10512 (the holder of the master data, D-23); the session-log check is the master's. **Answers of 2026-11-02 (D-25 to D-35):** relayed verbatim from the chat by the orchestrator in AQP-1 comments 10542 to 10555 and AQP-15 comment 10543, under the same standard (DL-007 (2)); none is in their own words on Jira. Where the orchestrator read a short answer, the reading is marked as a reading and is not their statement.

### 18.1 Decisions

| ID | Decision | Status | Question and source | Sections affected |
|----|----------|--------|---------------------|-------------------|
| D-01 | Budget: no limit. Start 2026-11-02. Target: 10 working days at 8 hours a day, Monday to Friday, ending 2026-11-13. The date is for completing development and handing that version to their customer for testing, acceptance and new change requests, after which the next steps are decided. | Confirmed as a **target, not a fixed constraint** (UNC-h). Start date and 10 working days: AQP-2. Monday-to-Friday week ending 2026-11-13: AQP-1 comment 10441 (h). Qualified by AQP-12 comment 10446: they ask for a realistic development completion date and says the date is not a blocker. | Q-01, Q-29; AQP-2, AQP-1 (10441), AQP-12 (10446) | none in the SPEC; release plan |
| D-02 | The sponsor is one person: "Santhosh - MD". | Confirmed | Q-02; AQP-3 | none |
| D-03 | `AMADA-20261006.xlsx` is the sample worksheet and contains only a couple of items. Engineers enter inputs; Admin and Leads view all cost calculations; export to Excel is needed. | Confirmed | Q-03; AQP-4 | §10, §15 item 3 |
| D-04 | One estimate holds one complete product, which may have multiple items, parts, sub-parts and sub-sub-parts, and so on. | Confirmed | Q-04; AQP-5 | §6.1 |
| D-05 | Tool Cost (BM) is an input entered by the Engineer with all other inputs. BN = BL / total of all Tool Cost entries (UNC-a). | Engineer enters Tool Cost: confirmed, their own words (AQP-6). BN = BL / total of all Tool Cost entries: **confirmed on list wording** (AQP-1 comment 10441 (a)), not their own words. Where totals appear in the export, and the total Tool Cost: answered, D-16. | Q-05, Q-31; AQP-6, AQP-1 (10441, 10490) | §7.1 (08), §7.4 BN, §10 |
| D-06 | Where a part is not required the Engineer enters 0, so calculations are not affected. "Not applicable" is a choice in the Material (E) and Treatment (G) lists (UNC-b). The "Not needed for this part" switch is not built; Q-15 is closed (UNC-f). | Enter 0: confirmed, their own words (AQP-7). "Not applicable" in the lists and Q-15 closed: **confirmed on list wording** (AQP-1 comment 10441 (b) and (f)), not their own words. The rate values and handling of the "Not applicable" entries: answered, D-17. The "Not needed" switch: "No switch" in their own words, relayed (D-18, AQP-1 comment 10490). | Q-06, Q-15, Q-33; AQP-7, AQP-1 (10441, 10490) | §4.3, §4.5, §7.1, §7.3, §15 item 7 |
| D-07 | Approved estimates are not affected by any change (configuration, rates, masters). Recalculating after an unlock uses the current rates and shows a notice if they changed (UNC-c). | Approved estimates unaffected: confirmed, their own words (AQP-8). Recalculation with current rates and a notice: **confirmed on list wording** (AQP-1 comment 10441 (c)), not their own words | Q-07; AQP-8, AQP-1 (10441) | §8.4 |
| D-08 | **Rewritten 2026-11-02 (version 1.9): the multiplication by the item quantity is superseded. The estimate's cost is the sum of BG over every row, each BG carrying the whole-order count typed on its row (D-12).** *Text as it stood (version 1.4 to 1.8):* The cost is the sum of the costs of all children (grandchildren and deeper included) multiplied by the item quantity. Their words (AQP-9 comment 10442, AQP-13 comment 10445): "The cost should be sum of costs of all children multiplied by item quantity. In the sample provided, item 1 (Row#1) has children, grand-children rows from 2 to 11. So, the parent's cost (BL2) is calculated as sum of the cells BG2 to BL11 and the result is multiplied by no. of the main (parent) item." (UNC-d). *Correction, 2026-11-01:* an earlier version of this row restated their sentence as "item 1 (row 2) has children and grandchildren in rows 3 to 11". That was the analyst's paraphrase, not their wording. In the sample file as saved, row 1 is the header, item 1 is in row 2 and its descendants are in rows 3 to 11, which differs from their "Row#1 ... rows from 2 to 11"; the reading was settled as Q-32 (e1): the item's own row is inside the range (D-12). | **Confirmed as corrected, in their own words.** AQP-1 comment 10441 (d) was confirmed only as corrected in AQP-1 comment 10443 (see AQP-9); the corrected text is AQP-9 comment 10442 and AQP-13 comment 10445. The earlier "child cost x parent quantity, 2 x 3 = 6" (comment 10415) is withdrawn as written. Details answered on 2026-11-01 (Q-32, D-12) and revised the same day: their sentence "multiplied by item quantity" describes a two-level sample, and their later definition of QTY per Assy (AQP-13 comment 10487) and count of 24 lids (AQP-1 comment 10490) extended the multiplication to every level (version 1.4). **Both readings are superseded at version 1.9 (2026-11-02):** their answers on AQP-26 (comments 10533 to 10537, relayed) show that the portal multiplies nothing; the Engineer types the whole-order count on each row and the cost is the sum of BG. The sentence "multiplied by item quantity" and the two-level sample fit when the item quantity is 1. Worked check and constructed example in §18.5. | Q-08, Q-32; AQP-9 (10403, 10442), AQP-13 (10445), AQP-1 (10441, 10443) | §6.1, §7.4 BL, §14.2, §15 item 2 |
| D-09 | Master data values are entered when the app is first used, and the delivery lead will also provide defaults. After the UX is reviewed and finalised (G3 approval) and before development starts, work stops and the delivery lead is asked for the master data defaults. **Answered later, 2026-11-01 (D-23): the Admin holds and loads the values and types them in at first use; the stop was met (HOLD-01).** | Confirmed (AQP-10 comment 10404, their own words); the holder, the storage and the loading: D-23 | Q-09; AQP-10 (10404, 10512), AQP-1 | none in the SPEC; delivery process |
| D-10 | Release 1 is hosted on the internet. Offline use ("like running a website locally") comes in the next release (UNC-e). | Confirmed: AQP-1 comment 10441 (e); AQP-11 comment 10444 ("we shall implement the offline release in next release"). This closes the conflict with AQP-11 comment 10405 for Release 1. Hosting details: answered in part on 2026-11-01 (D-15); the web address and the sender address are open (Q-18). | Q-18; AQP-11, AQP-1 (10441) | §2 Deployment |
| D-11 | The stated assumptions stay for Q-10 to Q-14, Q-16, Q-17 and Q-19 to Q-28 (UNC-g). | **Confirmed on list wording** (AQP-1 comment 10441 (g)), not their own words. They remain labelled assumptions; they can change any of them later. | AQP-1 (10441) | none |
| D-12 | Details of the cost rule D-08 (Q-32). **Rewritten 2026-11-02 (version 1.9): the whole-order rule replaces the every-level rule of version 1.4, and the multiply-once rule of version 1.3 before it.** Rule now in force: **(a)** QTY per Assy (H) is the count of the part for the whole order, typed on every row (the Engineer enters the details of one piece and the count the whole order needs). 2 frames, 3 pipes on each frame and 4 lids on each pipe are typed 2, 6 and 24. Each row's BG carries its own H (`BB = BA * H`); BL is the sum of BG over every row (§7.4 BL). Nothing is multiplied by the H of another row, and no sum is multiplied by an item quantity. **(b1)** A parent's own cost counts. **(b2)** A non-zero value typed on a parent is not ignored, refused or warned about. **(b3)** The export shows each row's own values; on screen a row shows its own BG, BJ and BK; a parent shows only its own row's figures, with no sum of the rows below it (D-25; ASSUMPTION-59 ends). The multiplied-down parent figure of ASSUMPTION-52 no longer exists and ASSUMPTION-52 is retired. **(c)** The item's own row is a row like any other, with or without parts below it (D-21; Q-39 answered; ASSUMPTION-57 retired). **(d)** BL adds every row, so several top-level items add up with no separate step. **(e1)** The item's own row is inside the range (file rows 2 to 11 for item 1). **(e2)** Only column BG is added; Tool Cost (BM) entries are not multiplied. **Their count of 9 sub-parts** in AQP-13 comment 10487 (rows 1.1, 1.1.1, 1.1.2, 1.2, 1.3, 1.4, 1.4.1, 1.5, 1.5.1 of the sample) **counts rows**: all nine descendant rows of the item, parents included. It is not a count of lowest-level rows (there are six, although their sentence says "the number of last subparts") and not a count of pieces. On the sample every H is 1, so rows and pieces are the same; nothing in the rule depends on that count. The parallel run and acceptance test 2 compare with the worksheet's own formula, the sum of BG; the portal and the worksheet agree at any quantity, and with every H = 1 the result equals the sample's stored total exactly. | **(a): their own words, relayed from the chat (AQP-26 comments 10533, 10535, 10536 and 10537, verbatim; DL-007 (2), the session-log check is the master's).** 10533: "4 frames with 3 brackets each will make 12 brackets in total". 10535: "four frames 150\*4 = 600 / total brackets = 3 \* 4 = 12. Total price of brackets = 12 \*20 = 240 / So the user will enter 4 frames and 12 brackets". 10536, asked what to type for 2 frames, 3 pipes on each frame and 4 lids on each pipe: "Frame = 2 / Pipe = 6 / Lids = 12". 10537: "sorry my bad, yes, this has 24 lids. Engineer should typ 24". The rule fits all of these and the earlier numbers: 12 brackets typed with 600 and 240; their 1000 (AQP-14 comment 10510, 5 x 200); 2, 6 and 24; and the worksheet's sum of BG. **Provenance, stated plainly.** (1) The sentence "H is the count for the whole order and BL is the sum of BG over every row" is the delivery team's statement of what produces their numbers; they did not write it in words. (2) The 840 is their figures 600 and 240 added; they did not state it. (3) Their first reply on AQP-26 (comment 10530: parts 20\*3 = 60, items 150\*4 = 600, total 660) is read as 3 brackets typed for the whole order; they did not say so, and they corrected the count to 12 in comments 10533 and 10535. Comment 10531 gave no number. (4) Their first lid count (12, comment 10536) was the count for one frame; they corrected it to 24 (comment 10537). Both slips are evidence for the risk that Engineers must work out whole-order counts themselves. **Superseded by these answers:** the AQP-9 comment 10442 and AQP-13 comment 10445 wording "sum of costs of all children multiplied by item quantity" (fits when the item quantity is 1); the every-level reading of the 24 lids (AQP-1 comment 10490, "numner of lids is 24 here", as 2 x 3 x 4 worked out by the portal; the count 24 stands but is typed on the lid row); and the definition "in one of its parent" read as a per-parent count (AQP-13 comment 10487, whose example, a long pipe with a lid at each end typed 2, fits when the order has one pipe). **(b1)** "parent's own cost counts": their own words, AQP-13 comment 10464, unchanged. **(b2) consequence, (e1), (e2) and the closing "Okay":** list wording as before (AQP-13 comment 10462); (d) is now implied by the sum. **(b3)** answered 2026-11-02: Q-35 (b), D-25 (their words relayed). **(c)** answered: a single piece, 1000 (D-21); an item with a part below it, 840 (AQP-26). Their examples type the top-level item too (4 frames, 2 frames), so the extension of H to a top-level item is covered by their words. Whether these answers meet the own-words condition of DL-006 is the master's decision. | Q-08, Q-32, Q-35, Q-39; AQP-13 (10462, 10463, 10464, 10487), AQP-26 (10530, 10531, 10533, 10535, 10536, 10537), AQP-1 (10490), AQP-9 (10403, 10442), AQP-14 (10510) | §6.1, §7.1 H, §7.4 BL, §8.2, §14.2, §15 item 2, §18.5 |
| D-13 | The repository stays public. The delivery lead states that the sample workbook "doesnt have real data" and that "the formulas are not self explanatory". The rule that no sample cell values are copied into documents, Jira or GitHub stays (cat. NFR-023, ASSUMPTION-46) unless the delivery lead changes it. | **Decision, their words** (AQP-1 comment 10465, relayed verbatim). That the workbook holds no real data is their statement; the analyst has not verified it. | Q-03, Q-30; AQP-1 (10465) | §10, §15 item 3 |
| D-14 | Scope A for the first development hand-over: the whole SPEC except offline use, dark mode and the UI-sample extras (the product manager's definition, release plan section 2). | **Their own words, Jira:** "I prefer the scope A for the intial release." (AQP-12 comment 10488, spelling as written). The reply says "prefer" and does not mention the dates; the dates are the product manager's estimates (AQP-12 comment 10478) and are the product manager's to re-issue or adopt. | Q-34; AQP-12 (10478, 10488) | none in the SPEC; release plan, PRD, cat. NFR-015 (the discovery catalogue's NFR-015, dark mode; the PRD's NFR-015 is localisation) and ASSUMPTION-43 (dark mode) |
| D-15 | Hosting details. E-mail service: Microsoft Outlook; sender address not decided. Web address not decided. Backup: once a week, each kept 2 years, copies on the same server, the Admin only checks that they ran (D-33). Updates: installed by their IT person. | **Their own words, relayed (AQP-1 comment 10490):** "Not decided yet." (web address); "microsoft outlook, not decided yet on the sender address"; "Weekly once backup is good. It should be kept for 2 years. Admin looks after them"; "My IT person". **Open:** web address, sender address, which Outlook account will send, and who restores a backup. **Answered 2026-11-02 (D-33):** what "Admin looks after them" means: the Admin only checks that backups ran; ASSUMPTION-53 ends. The orchestrator told them a weekly backup can lose up to a week of work (comment 10490); no reply changes it, so weekly stands. | Q-18; AQP-1 (10490), AQP-11 | §2 (Email, Deployment), §12 Reliability, TR-008, cat. NFR-007, ASSUMPTION-18 |
| D-16 | The export has one total only: BL, BN and BO once, in row 2, and no per-item totals. The total Tool Cost is shown in the export. Its position is for the ux-expert and solution-architect. | **Their own words, relayed (AQP-1 comment 10490):** "One total only"; "yes he Total Tool cost should be shown" (as written). The row-2 position is the SPEC §10 rule, not a sentence of theirs. They did not say whether the total Tool Cost also shows on screen. The export now knowingly differs from the sample on this point (acceptance test 12, BRQ-005). | Q-31; AQP-1 (10490) | §7.4 BN, §10, §14.12; ASSUMPTION-47; BRQ-005 |
| D-17 | "Not applicable" in the Material list: its values are 0; the system creates it; it cannot be edited or deleted; it is not shown anywhere in the portal, Admin pages included (**narrowed 2026-11-02, D-27:** it shows as the choice in the drop-down and as text on a part that has it, to everyone; the zero values and any master-list or Admin-page entry stay hidden). A part that has it skips the material cost only; labour and other costs on that row still count; a parent's own cost rule stands. The Treatment / Color entry is covered by the same answer on creation, deletion and visibility; no cost formula uses G, so the "material cost only" wording is not extended to it. | **Their own words, relayed (AQP-1 comment 10490):** "when it is not applicable, ignore the cost calculation for that particuler row (can be an item, part, subpart or any. You may consider 0 as you mentioned, but do not show them in the portal (even for admin)"; follow-up "skip material cost only"; "Okay, but do not show then anywhere in the portal, even for admin"; "Do not show this anywhere in the portal, even for admin". Their first sentence says the whole row's cost calculation; their answer to the follow-up narrows it to the material cost, and that later answer rules. **Reading put to them, not objected to, not stated by them:** the words stay as a choice in the drop-down for Engineers and nowhere else. **Answered 2026-11-02 (D-27, Q-36):** the choice is offered to Lead and Admin and the text "Not applicable" shows on parts to everyone; this narrows "shown nowhere" to the master lists, the Admin pages and the zero values. | Q-33; AQP-1 (10490) | §4.3, §4.5, §7.1 (E, G), §7.3; BR-048, DR-008, DR-010; ASSUMPTION-49 |
| D-18 | Four screen decisions. (1) No "Not needed for this part" switch: FR-095, §15 item 7 and D-06 stay closed. (2) A reason for a price that differs from the calculated total is optional. (3) The About wording stays, including the word "cost". (4) Engineers see the status of their task and estimate and never a price. | **Their own words, relayed (AQP-1 comment 10490):** "No switch" (OQ-UX-01); "Reason optional" (OQ-UX-02); "The wording is fine." (OQ-UX-10); "Show the status, no price" (OQ-UX-12). The ux-spec note that the About sentence has no cost word is wrong (the orchestrator says so in comment 10490); the sentence reviewed on screen SCR-24 contains "manufacturing cost estimates". | OQ-UX-01, 02, 10, 12; Q-15; AQP-1 (10490) | §3, §6.3, §9 About, §12 Audit, §15 item 7; UR-028, BR-011; FR-095 |
| D-19 | Password: 10 to 128 characters, at least one number and at least one symbol, not the user's e-mail address, not a common password. Session: 12 hours. | **Their own words, relayed (AQP-1 comment 10490):** "Need atleast one number and a symbol in the password. Rest looks good". The remaining parts of the rule and the 12 hours were the ux-expert's and solution-architect's proposal (OQ-UX-05, OQ-ARCH-03), which "Rest looks good" accepts. Which symbols count, and whether 12 hours run from sign-in or from the last activity: design detail, working ASSUMPTION-56. | OQ-UX-05, OQ-ARCH-03; AQP-1 (10490) | §12 Security; UR-001; BR-049, BR-050 |
| D-20 | Approval is blocked while the totals are out of date or the estimate has never been calculated. The total is cleared when any input is updated, so the user must press Calculate or Recalculate to see it. | **Their own words, relayed (AQP-1 comment 10490):** "Block approval. And clear the total cost when any input is updated. So, the user will be forced to press calculate or recalculate to see the total cost." "Total cost" is read as the estimate total (BL); "any input" is applied as written. **Answered 2026-11-02 (D-28 to D-30, Q-37):** every cost figure clears, the download is refused until a calculation is current, and the earlier price stays until approved again or removed by the Admin. | OQ-UX-06; AQP-1 (10490) | §6.3, §10; UR-027, UR-028; BR-051 |
| D-21 | The item's own row counts its own quantity once (Q-35 (a)). On the invented example in AQP-14 (QTY per Assy 5; 200 rupees to make one piece with overheads, inspection and packing, and transport all included; nothing below the item) the Total Unit Production Price (BL) is **1000 rupees**. That is 5 x 200: the quantity counts once, not a second time through the item quantity (which would give 5 x 5 x 200 = 5000). ASSUMPTION-51 is retired as answered. **Version 1.9 (2026-11-02):** the number stands and the whole-order rule of D-12 explains it: the 5 typed is the count for the whole order, and the row's cost is 5 x 200 = 1000. The item's own row has no special rule. The case the example did not test, an item that also has a part below it, was asked as Q-39 (AQP-26) and is answered by their numbers there: 4 frames at 150 rupees and 3 brackets on each frame at 20 rupees are typed 4 and 12, BG is 600 and 240, BL is 840 (AQP-26 comment 10535; the 840 is their two figures added, not stated by them). ASSUMPTION-57 is retired. 840 is also the number ASSUMPTION-57 gave on typed 4 and 3; what changed is the entry, 12 and not 3. | **Their own words, relayed (AQP-14 comment 10510, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "It should be 500 x 2 = 1000 rupees". **The working does not match the example:** it reads 500 x 2, where the example has QTY per Assy 5 and 200 rupees a piece (5 x 200). The number, 1000, equals 5 x 200; the 500 and the 2 are not figures in the question and they did not say where they come from. The analyst takes the number as the answer and reads no meaning into the working. That the quantity counts once is the analyst's reading of what produces 1000 from the question's figures; they did not state the rule in words. Version 1.9: D-12 states it now, on their examples of 2026-11-02. **Put to them, not stated by them:** the orchestrator told them in chat that 1000 was taken as the answer, and they did not object (stated by the orchestrator when it delegated this update; AQP-14 comment 10510 does not record it). | Q-35 (a); AQP-14 (10510) | §7.4 BL (c), §14.2, §18 D-12 (c), §18.5; BR-047; ASSUMPTION-51 (retired), 57 (retired) |
| D-22 | A QTY per Assy (H) of 0 on any part, with or without parts below it: **Warn**. There is no minimum above 0 and no block. At Calculate the portal warns, naming the part and saying what counts as 0 (the part and everything below it, or, for a part with nothing below it, the part's own cost), and the Engineer can go ahead. The DL-013 block fallback no longer applies to this case. **Version 1.9:** what counts as 0 is now always the row's own cost, because a 0 no longer touches the rows below it. The premise of the decision changed; they kept the Warn (Q-41, D-26). | **Their own word, relayed (AQP-15 comment 10511, verbatim from the chat):** "Warn". They chose it from block, warn or no rule, as set out in AQP-15 (the options, costs and trade-offs there are the delivery team's wording, not theirs); they gave no reason. **Q-38 answered 2026-11-02:** the rule also covers a 0 in H on a part with nothing below it. **Their word, relayed (AQP-15 comment 10527, verbatim from the chat, and AQP-1 comment 10528; the session-log check is the master's, DL-007 (2)):** "Yes". No reason was given. ASSUMPTION-58 (no message there) is retired and A-25 ends. The question and the answer say "part"; whether a top-level item is covered is for the solution-architect to state. **Premise changed, 2026-11-02 (version 1.9; Q-41, ASSUMPTION-60):** "Warn" was chosen from block, warn or no rule on the description in AQP-15, which said a 0 on a part with parts below it made that part and everything below it count 0 times. Under the whole-order rule (D-12) a 0 touches only its own row, as a 0 in another number field does (those give no warning, §7.3). **Answered 2026-11-02 (Q-41, D-26): they kept the Warn.** **Not designed or sized:** how the warning reads, whether it must be acknowledged, and where the Lead or Admin sees it (ux-expert, solution-architect; the product-manager sizes it). | OQ-ARCH-10 (OQ-PM-07), Q-38, Q-41; AQP-15 (10511, 10527); AQP-1 (10528) | §7.1 H, §7.3; BR-048; ASSUMPTION-58 (retired) |
| D-23 | Master data (Q-09; HOLD-01): the Admin holds the values and loads them. Until first use they are kept in storage that Accucut controls, passed directly to the Admin, and not in this repository, Jira or GitHub. The Admin types them into the portal at first use. No import file or import screen is needed for first use. No values were asked for or given; development and tests use invented placeholder values only. Revises D-09. | **Their words, relayed (AQP-10 comment 10512, verbatim from the chat):** (1) "The Admin" (who holds and loads the values); (2) "I am okay with your suggestion", which agrees with the orchestrator's proposal of storage that Accucut controls, passed directly to that person (the storage wording is the orchestrator's, not theirs); (3) "Admin types into the portal at first use". **Their earlier sentence (AQP-10 comment 10404, 2026-10-31, own words):** "I shall also provide you the defaults." The new answers do not say whether they still mean to send defaults to the team; the orchestrator's reading is that none are needed (no values were asked for or given), and HOLD-01 is met. Nothing here depends on it: the Admin types the values in either way. Which place counts as "storage Accucut controls" is not named. | Q-09; AQP-10 (10404, 10512) | none in the SPEC; delivery process; TR-002, TR-009, DR-006 to DR-010 |
| D-24 | Rates beyond 2 digits (Q-40; OQ-ARCH-05): **no**. Rates, material prices and exchange rates are entered with 2 digits after the decimal point, and the entry screens (SCR-11 to 13) keep that limit. OQ-ARCH-05 is closed. | **Their word, relayed (AQP-1 comment 10528, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "Q-40: No". The question asked yes or no with no values; no rate was named and no value was sent. It is their statement about the real rates and is not verified. If the Admin meets a rate that needs a third digit when typing the master data, only the entry limit changes; storage allows 4 digits (architecture OQ-ARCH-05). | Q-40; OQ-ARCH-05 (DL-025); AQP-1 (10528) | §4; DR-006 to DR-010 |
| D-25 | Q-35 (b): a parent shows only its own row's figures (BG, BJ, BK), the same on screen and in the file. No sum of the rows below it is shown. ASSUMPTION-59 ends. | **Their words, relayed (AQP-1 comment 10542, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "Q-35(b) - no, not required". The question asked whether a parent should also show the plain sum of the rows below it, for the whole order. That a parent then shows only its own row is the orchestrator's reading. | Q-35 (b); AQP-1 (10542) | §6.1, §7.4 BL (b3), §18.5; BR-046; ASSUMPTION-52 (ended), 59 (ended) |
| D-26 | Q-41: the Warn on a QTY per Assy (H) of 0 stays, for every 0, with no minimum and no block. The warning names the row and says that row will cost 0. ASSUMPTION-60 ends. | **Their words, relayed (AQP-1 comment 10543, on AQP-15, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "Q-41: Keep warning". They gave no reason. Whether it covers a top-level item's own 0, and the wording, are design (the architect reads a top-level item as covered). | Q-41; D-22; AQP-15 (10543) | §7.1 H, §7.3; BR-048; FR-104 |
| D-27 | Q-36: "Not applicable" is offered in the Material in Drawing and Treatment / Color lists to anyone who edits a part (Engineer, Lead, Admin), and the text "Not applicable" shows on a part that has it, to everyone. The zero values and any master-list or Admin-page entry stay hidden. This narrows D-17. ASSUMPTION-54 becomes the rule. | **Their words, relayed (AQP-1 comment 10544, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "a) Yes / b) Everyone can see the fields with "Not Applicable" text". **Readings, not their words:** the zero values and master-list entries stay hidden (the orchestrator's note); Material Considered (F) and Material Rate (I) are blank for such a part (the wording of ASSUMPTION-54). | Q-36; AQP-1 (10544) | §4.3, §4.5, §7.1 (E, G); BR-048, DR-008, DR-010; D-17 |
| D-28 | Q-37: on any input change every cost figure clears, each row's own cost included, until Calculate or Recalculate is pressed. The Excel download is refused while the figures are cleared. The out-of-date file, its markers and its dialog are not built. ASSUMPTION-55 ends. | **Their words, relayed (AQP-1 comment 10545, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** (a) "Yes"; (b) "Yes, block the portal when the total is not calculated or recalculated"; (c) see D-29. **Reading, not their words:** that (b) means the download is refused; their words are "block the portal". | Q-37; AQP-1 (10545) | §6.3, §6.5, §10, §14.15; BR-051, UR-027, UR-030 |
| D-29 | The price approved before an unlock stays on record, labelled as the earlier approved price, until the estimate is approved again or the price is removed. It may be removed by hand, after a cancel-approval step, "only IF POSSIBLE". Only the Admin can cancel an approval and remove the price. | **Their words, relayed (AQP-1 comment 10545 (c), 10552, 10553, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** (c) "It should stay until it's approved again or be removed."; "Removable. May be "only IF POSSIBLE" shall have a button to cancel the approval before removing. So that will be a safeguard."; "Admin only". **Readings, not their words:** the cancel step comes before the removal; "only IF POSSIBLE" leaves it to the design and sizing whether the removal is built in Release 1. | Q-37 (c); A-30; AQP-1 (10545, 10552, 10553) | §3, §6.3, §9, §14.16; BR-051, BR-054 |
| D-30 | A never-calculated estimate cannot be downloaded: no Excel download exists until a calculation is current. | **Their words, relayed (AQP-1 comment 10554, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** asked whether a never-calculated estimate may be downloaded (A-32): "Refuse it". | A-32; AQP-1 (10554) | §6.5, §10, §14.15; BR-055, UR-030 |
| D-31 | The Part Model picture (C) is optional. Calculate does not require a picture on any part and no missing-picture message is shown. | **Their words, relayed (AQP-1 comment 10546, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** asked whether every part must have a picture: "we shall keep that optional". | OQ-UX-13, OQ-ARCH-04; AQP-1 (10546) | §7.1 C, §7.3, §14.4; BR-007, UR-017 |
| D-32 | When rates have changed after the last Calculate and before approval, a notice tells the Lead. Approval is not blocked. | **Their words, relayed (AQP-1 comment 10548, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** asked whether a Lead should be told: "Tell the Lead". **Readings, not their words:** "rates" is read as the master values of §8.4; whether an approving Admin is told, and whether configuration changes count, are not stated. | OQ-UX-16, OQ-ARCH-06; AQP-1 (10548) | §6.3, §8.4, §14.17; BR-056 |
| D-33 | Settings shows a "Last backup" line. The Admin only checks that backups ran; restores are not an Admin task. Backup copies stay on the same server. ASSUMPTION-53 ends. | **Their words, relayed (AQP-1 comment 10549, 10550, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "Yes" (the Last backup line); "Yes only Admin only checks"; "Backup on the same server". **Readings, not their words:** "Yes only Admin only checks" is read as: the Admin's job is to check that backups ran; who restores is not stated (their IT person installs updates). A server or disk failure loses the live data and every backup together; they were told this (comment 10550); RISK-011 is for the master. | OQ-ARCH-12, FR-105; AQP-1 (10549, 10550) | §2, §4.6, §9, §12; D-15; TR-008, cat. NFR-007; ASSUMPTION-53 (ended) |
| D-34 | QTY per Assy keeps its name and its Excel header. A hint below the field says it is the count for the whole order. | **Their words, relayed (AQP-1 comment 10551, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** "Keep QTY per Assy for now with a hint below it". "For now" leaves a later rename open. | UX-52; AQP-1 (10551) | §7.1 H, §16 |
| D-35 | No holidays or days away between 2026-11-02 and 2026-12-09. | **Their words, relayed (AQP-1 comment 10555, verbatim from the chat; the session-log check is the master's, DL-007 (2)):** OQ-PM-02, holidays and days away to 9 December: "none". For the product-manager's dates. | OQ-PM-02; AQP-1 (10555) | release plan |

### 18.2 Questions raised by the answers: status after Pass 3

| ID | Subject | Blocking | Status |
|----|---------|----------|--------|
| Q-29 | What the 2026-11-13 date delivers | Was yes | **Answered** (AQP-12 comment 10446, D-01). They ask for a realistic development completion date; the product manager supplies it. |
| Q-30 | Cleaned copy of the sample for the repository; blank company template | No | Open. The repository stays public by the delivery lead's decision, and they state the workbook has no real data (D-13; their statement, not verified) |
| Q-31 | The sample shows totals per top-level item; the answers give one total per estimate | No | **Answered 2026-11-01** (D-16; their words relayed, AQP-1 comment 10490): one total only; the total Tool Cost is shown in the export. The export now knowingly differs from the sample. Position of the Tool Cost total: ux-expert and solution-architect |
| Q-32 | Roll-up details left after the corrected cost rule (D-08) | Was yes (decided price correctness) | **Answered; revised 2026-11-01** (D-12). (a) is now in their own words: the definition (AQP-13 comment 10487) and the count of 24 lids (AQP-1 comment 10490, relayed). Every level's quantity applied (version 1.4); **rewritten at version 1.9: H is the count for the whole order and BL is the sum of BG (D-12, AQP-26 comments 10533 to 10537)**; the version 1.3 rule (multiply once, at the top) is withdrawn. (b1), (b2) own words (10464); (d), (e1), (e2) list wording (10462). **(b3) answered 2026-11-02 (Q-35 (b), D-25); (c) answered (D-21, Q-39).** Whether DL-006 is met is the master's decision |
| Q-33 | Rate values and handling of the "Not applicable" Material row | No | **Answered 2026-11-01** (D-17; their words relayed): values 0, system-created, not editable or deletable, shown nowhere in the portal; material cost only is skipped. The reading "drop-down for Engineers and nowhere else" was put to them and not objected to; not stated. What Lead and Admin see: Q-36 |
| Q-34 | Which scope the realistic development completion date covers | No | **Answered 2026-11-01** (D-14; their own words, AQP-12 comment 10488): scope A. The dates are the product manager's |
| Q-18 | Hosting details | No (no longer holds G3: they approved G3, AQP-1 comment 10491; the gate decision is the master's) | **Answered in part 2026-11-01** (D-15; their words relayed): e-mail service Microsoft Outlook; weekly backup, kept 2 years, Admin looks after them; updates by their IT person. **Answered 2026-11-02 (D-33):** the Admin only checks that backups ran; copies stay on the same server; Settings shows a "Last backup" line. **Open:** web address, sender address, which Outlook account, and who restores a backup. Needed before the first deployment |
| Q-35 | The item's own row, and what a parent below the top shows, under the whole-order rule | (a) Was yes, at G4 (DL-012; gate record G3 condition 3). (b) No (display only) | **Answered.** (a) 2026-11-01 (D-21): 1000 rupees on the invented example; the number holds under the whole-order rule of version 1.9 (5 typed for the whole order x 200). (b) 2026-11-02 (D-25; their words relayed, AQP-1 comment 10542): "Q-35(b) - no, not required", so a parent shows only its own row's figures. ASSUMPTION-51, 52, 57 and 59 are retired or ended |
| Q-36 | Where "Not applicable" is shown to Lead and Admin | No (display only) | **Answered 2026-11-02** (D-27; their words relayed, AQP-1 comment 10544): offered to Lead and Admin; the text shows on a part to everyone. ASSUMPTION-54 becomes the rule |
| Q-37 | What a cleared total means for the figures that show it, each row's cost, the export and a price approved before an unlock | No price effect through approval (approval is blocked while stale) | **Answered 2026-11-02** (D-28 to D-30; their words relayed, AQP-1 comments 10545, 10552 to 10554): every cost figure clears; the download is refused until a calculation is current; the earlier price stays until approved again or removed by the Admin. ASSUMPTION-55 ends |
| Q-38 | Whether the "Warn" on a QTY per Assy of 0 also covers a part with nothing below it | No for the roll-up story (DL-022) | **Answered 2026-11-02:** "Yes" (AQP-15 comment 10527; AQP-1 comment 10528, relayed verbatim from the chat). The warning covers a 0 on any part. ASSUMPTION-58 retired (§18 D-22). **Premise changed at version 1.9: a 0 now touches only its own row; Q-41.** |
| Q-39 | The item's own row when the item also has a part below it, at a QTY per Assy above 1 (the case Q-35 (a) did not test) | Was yes, for the acceptance (G7) of the roll-up story only (DL-024) | **Answered 2026-11-02 (version 1.9).** Asked for one number on an invented example in [AQP-26](https://sankumar76.atlassian.net/browse/AQP-26). Answered by their numbers there, relayed verbatim from the chat (comments 10533, 10535, 10537): 4 frames at 150 rupees and 3 brackets on each frame at 20 rupees are typed 4 and 12, which gives 600 and 240 and BL 840 (the 840 is their two figures added; they did not state it). The item's own row is a row like any other, with or without parts below it. ASSUMPTION-57 is retired. Their first reply (comment 10530, total 660) is read as 3 brackets typed for the whole order; they did not say so, and they corrected the count to 12. The roll-up story's expected value no longer rests on a labelled assumption |
| Q-40 | Whether any real rate, material price or exchange rate needs more than 2 digits after the decimal point (OQ-ARCH-05, DL-025) | No | **Answered 2026-11-02:** "No" (AQP-1 comment 10528, relayed verbatim from the chat). Closed with OQ-ARCH-05 (§18 D-24) |
| Q-41 | Whether the Warn on a QTY per Assy of 0 (D-22) is still wanted, now that a 0 affects only its own row | No | **Answered 2026-11-02** (D-26; their words relayed, AQP-15 comment 10543): "Q-41: Keep warning". ASSUMPTION-60 ends |

### 18.3 Release 1 scope note

Offline use ("running locally when there is no internet") is **not** part of Release 1. It is planned for the next release (D-10, confirmed). What "offline" means (a full copy running on a local PC, or an entry form that works without a connection and sends later) is settled when that release is planned. If offline use were brought into Release 1, the architecture, data-storage and synchronisation scope would change and §2 would be reopened.

### 18.4 Items formerly unconfirmed (UNC-a to UNC-h): resolution and SPEC text now in force

| ID | Resolution | SPEC text now in force | Place |
|----|------------|------------------------|-------|
| UNC-a | Confirmed on list wording (comment 10441 (a)), not their own words | BN = BL / total of all Tool Cost entries; "—" when the total is 0 | §7.4 BN, §10 |
| UNC-b | Confirmed on list wording (comment 10441 (b)), not their own words | "Not applicable" is in the Material and Treatment lists; its values and handling: answered, D-17 | §4.3, §4.5, §7.1, §7.3 |
| UNC-c | Confirmed on list wording (comment 10441 (c)), not their own words | Recalculation after unlock uses current rates, with a notice | §8.4 |
| UNC-d | Confirmed as corrected, in their own words (comments 10443, 10442, 10445) | BL = the sum of BG over every row, each BG carrying the whole-order count typed on its row (§7.4; version 1.9); the 10415 per-level wording is not the authority; details revised 2026-11-01 and again 2026-11-02 (Q-32, D-12: H is the count for the whole order; the multiplication by the item quantity is superseded) | §6.1, §7.4, §14.2, §15 item 2 |
| UNC-e | Confirmed, restated in their own words (AQP-11 comment 10444; comment 10441 (e)) | Release 1 internet-hosted; offline in the next release | §2 |
| UNC-f | Confirmed on list wording (comment 10441 (f)), not their own words | Q-15 closed; the switch is not built; also "No switch" in their own words, relayed (D-18) | §15 item 7 |
| UNC-g | Confirmed on list wording (comment 10441 (g)), not their own words | The stated assumptions stand | none |
| UNC-h | Confirmed as a target (comment 10441 (h)), qualified in their own words (comment 10446) | No SPEC text; the date is a target for completing development and handing over for testing and acceptance, not a fixed constraint | release plan |

### 18.5 Parent cost rule checked against the sample worksheet (G1 condition 2)

Method: the business analyst opened `AMADA-20261006.xlsx` (first worksheet, formulas and stored results) and re-added the cells. In line with ASSUMPTION-46 and cat. NFR-023, no cell value is written in this repository; results are given as agreement or ratios.

1. **Which cells.** The worksheet formula in BL2 is `SUM(BG2:BG11)`. Re-adding BG2 to BG11 gives the stored BL2 exactly. Reading "BG2 to BL11" as a rectangle (columns BG to BL, rows 2 to 11) would also add the exchange-rate columns BH and BI, the USD and EUR price columns BJ and BK, and BL itself (a circular reference); that sum is about 16 % higher than the stored BL2. The delivery lead's words are "item 1 (Row#1) has children, grand-children rows from 2 to 11" and "the sum of the cells BG2 to BL11". In the file as saved, row 1 is the header, item 1 is in row 2 and its descendants are in rows 3 to 11. **Confirmed 2026-11-01 (Q-32 (e1), (e2); AQP-13 comment 10462, on list wording):** the item's own row is inside the range (file rows 2 to 11 for item 1) and only column BG is added, which is the range the worksheet supports. On the sample the row part makes no difference, because item 1 carries no values of its own.
2. **Levels.** Rows 2 to 11 hold item 1, its children (1.1 to 1.5) and its grandchildren (1.1.1, 1.1.2, 1.4.1, 1.5.1). The worksheet adds the BG of every one of those rows, grandchildren included. This agrees with their sentence ("sum of costs of all children ... children, grand-children rows from 2 to 11").
3. **Parents with inputs of their own.** Item 1 and part 1.1 carry zero inputs, so counting their BG changes nothing. Parts 1.4 and 1.5 are parents (each has one child) and carry non-zero inputs of their own; the worksheet counts their own BG as well as their child's. Counting children only (the literal AQP-9 comment 10403 wording) would give a BL2 about 59 % lower (58.6 %); the two parents' own BG make up the whole difference. **Confirmed 2026-11-01 (Q-32 (b1), (b2)):** a parent's own cost counts (AQP-13 comment 10464, their words: "b2) yes, parent's own cost counts" and "b1) The latest wording the right one", the latest wording being read as AQP-9 comment 10442). The worksheet, the sample total and the delivery lead's sentence therefore agree, and the children-only reading is rejected. The sentence "a parent has no cost of its own" (assistant-drafted comment 10415, never theirs) is not part of the rule. This is the one point the sample can test: a parent's own BG must be inside the total.
4. **Quantity.** Qty / Assy (H) is 1 on every row of the sample, so the sample cannot show a count above 1. The worksheet multiplies each row by its own H only (`BB = BA * H`) and adds BG over the rows (`SUM(BG)`), with no multiplier for the rows above. **Version 1.9 (2026-11-02):** the delivery lead's answers (AQP-26 comments 10533 to 10537, relayed) show that the Engineer types the count for the whole order on every row, so the portal's rule is the worksheet's rule and the portal no longer differs from the worksheet on this point. This replaces the every-level rule of version 1.4 (AQP-13 comment 10487 read as a per-parent count, and the 24 lids of AQP-1 comment 10490 read as 2 x 3 x 4 worked out by the portal) and the multiply-once rule of version 1.3 (AQP-13 comment 10462, list wording). The test plan needs the constructed example below, not the sample.
5. **Other top-level items.** Item 2 (row 13) has its own BL, equal to its own BG, and its own Tool Cost. **Confirmed 2026-11-01 (Q-32 (d); AQP-13 comment 10462, on list wording):** the estimate's BL is the sum over the top-level items, (version 1.9: BL is the sum of BG over every row, so this is implied). **Answered 2026-11-01 (Q-31, D-16):** one total only, row 2 once, with the total Tool Cost shown in the export; the sample's per-item totals are not reproduced.

**Rule the worksheet supports, and the rule in force since version 1.9:** BL = the sum of BG over every row of the estimate, where each BG already carries its own row's count. On the sample (every H = 1) this reproduces the stored BL2 exactly for item 1, and the worksheet applies the same rule at any quantity.

**Rule in force (D-08, details D-12 as rewritten at version 1.9; replaces ASSUMPTION-48):** each row's BG carries its own row's count (H, the count for the whole order, typed by the Engineer). The estimate's BL is the sum of BG over every row. Nothing is multiplied by the H of another row and no sum is multiplied by an item quantity. Column BG only. A parent's own BG counts; nothing typed on a parent is ignored, refused or warned about. The export shows each row's own values. On screen a row shows its own values; a parent shows only its own row's figures (D-25). The item's own row is a row like any other (D-21; Q-39 answered). The parallel run (TR-004) and acceptance test 2 (§14.2) compare with the worksheet's own formula; with every H = 1 this equals the sample's stored total exactly, and at any other quantity the portal and the worksheet agree because both add BG.

**Conflicts, closed on 2026-11-01 and 2026-11-02:** (i) the 10415 sentence "a parent has no cost of its own" and the literal AQP-9 comment 10403 wording against the worksheet's treatment of parts 1.4 and 1.5: the delivery lead chose the worksheet's treatment (a parent's own cost counts, D-12 (b1)); (ii) a count above 1 on a part between the item and a lowest-level part: version 1.3 said it does not multiply the parts under it; version 1.4 said it does (24 lids as 2 x 3 x 4 worked out by the portal); **version 1.9 settles it differently from both: the Engineer types each row's count for the whole order (2, 6, 24) and the portal multiplies nothing down the tree** (D-12 (a)); (iii) the item's own row multiplied twice by the item quantity: withdrawn in version 1.4; at version 1.9 the item's own row is a row like any other, with or without parts below it (D-21; Q-39 answered); (iv) which rows and columns "Row#1 ... rows from 2 to 11" and "BG2 to BL11" mean: the item's own row and column BG only (D-12 (e1), (e2)).

**History (correction of 2026-11-01, G2 remediation).** An earlier version of this paragraph said that none of the open points changes the result on the sample. That was false for (i): a children-only reading gives a sample total **58.6 % lower** than counting the parents' own cost (item 3 above), and reading "BG2 to BL11" as a rectangle of columns gives a total about **16 % higher** (item 1 above). Only the quantity points (ii) and (iii) give the same result on the sample, because every quantity in it is 1. Those two readings were rejected by the answers of 2026-11-01 (D-12); the figures show the size of the readings that were not chosen. For (d) the sample has a second top-level item, so the answer changes the estimate total there; that ratio has not been measured. **Version 1.4 (2026-11-01, after G3 approval).** Points (ii) and (iii) were rejected by the answers of 2026-11-01 (D-12, version 1.3) and are now reversed or withdrawn as described above. Neither changes the sample total, because every quantity in the sample is 1; they change the constructed example and any estimate with a quantity above 1 above a row. **Version 1.9 (2026-11-02).** Points (ii) and (iii) are settled as described above. Again neither changes the sample total, because every quantity in the sample is 1; they change what the Engineer types and the constructed example.

**Constructed example for the test plan (invented counts and per-piece costs, not taken from the sample).** The sample cannot test counts above 1, so the test plan needs a tree built for the purpose, with counts typed for the whole order. Item I (frames) has child part P (pipes), which has child sub-part S (lids). The order has 2 frames, 3 pipes on each frame and 4 lids on each pipe; the Engineer types 2 on I, 6 on P and 24 on S. Let uI, uP and uS be the per-piece costs of the three rows (the BG of one piece). Then BG(I) = 2 x uI, BG(P) = 6 x uP, BG(S) = 24 x uS, and BL = BG(I) + BG(P) + BG(S) = 2 x uI + 6 x uP + 24 x uS. **So S counts 24 times its per-piece cost, P 6 times and the item's own row 2 times.** Invented numbers: uP = 1, uS = 1 and nothing on the item's own row (uI = 0) give BL = 6 + 24 = 30; with uI = 10 the item's own row adds 20 and BL is 50. The sums equal those of the rule of version 1.4; what changed is what is typed (6 and 24, not 3 and 4). Frames and brackets (invented, AQP-26): the item typed 4 at 150 rupees a piece and the bracket row typed 12 at 20 rupees a piece give BG 600 and 240 and BL 840. Single piece (invented, AQP-14): typed 5 at 200 rupees a piece gives BL 1000. Screen display (D-25): P shows its own BG = 6 x uP and no sum of the rows below it. Two top-level items typed 2 and 3, each with one child typed 2 and 3 respectively at a per-piece cost of 1 and nothing on the item rows: BL is 5. A parent with children and inputs of its own, as parts 1.4 and 1.5 of the sample have: its own BG is inside the total (D-12 (b1)). Expected values are computed by hand from these definitions before the test is run.
