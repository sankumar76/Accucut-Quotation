# Accucut Quotation Portal — Software Requirements Specification

**Client:** Accucut Lasers Pvt Ltd
**Source:** Requirement Understanding Document, Draft v5
**Audience:** Claude Code (implementation agent) and the development team
**Spec version:** 1.2 (1.0 plus the delivery lead's answers in §18: added in Discovery Pass 2, 2026-11-01, and confirmed, corrected or qualified by him in Pass 3, 2026-11-01: some items in his own words, five on the orchestrator's list wording; see the status rule in §18). Items he has confirmed replace the SPEC text they were holding back; the details still open are listed in §18.2.

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
| Email | Nodemailer over SMTP (settings via environment variables) |
| Scheduled jobs | A job runner inside the app (e.g. node-cron in a separate worker process) or OS cron hitting a protected endpoint |
| File storage | Part-model images stored in the database (bytea) or local volume; max 200 KB each |
| Testing | Vitest (unit), Playwright (E2E, incl. mobile/tablet viewports) |
| Deployment | Docker Compose (app, worker, Postgres); `.env.example` provided. Release 1 is hosted on the internet; offline use is for the next release (§18 D-10, confirmed: AQP-11 comment 10444 and AQP-1 comment 10441 (e)). Hosting details (web address, e-mail service, backups, who updates) are still open (Q-18, G3) |

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

**Security MUST:** Cost/output data is filtered **on the server**. API responses and server-rendered pages for an Engineer **MUST NOT contain** any calculated/output field values, material rates (column I), exchange rates, customer rates or formulas — hiding them only in the UI is not acceptable. Add automated tests that assert this.

The system MUST enforce that only one active Admin exists.

---

## 4. Master Data (Admin only — add / update / delete at any time)

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

> **Pass 3 (§18 D-06, confirmed, AQP-1 comment 10441 (b)):** the Material Master includes a **"Not applicable"** option for parts, including parent assemblies, that need no material. The values of its rate fields and whether the Admin may edit or delete it are open (Q-33; interim ASSUMPTION-49: all rate values 0, system-created, cannot be deleted or renamed).

### 4.4 Exchange Rate Master
**1 USD → INR**, **1 EUR → INR**.

### 4.5 Treatment / Color List
List of options for column G. The estimate form also offers **"Other"** with a free-text entry. **Pass 3 (§18 D-06, confirmed, AQP-1 comment 10441 (b)):** the list also contains **"Not applicable"** for parts that need no treatment. Whether the Admin may delete it is open (Q-33).

### 4.6 Settings
- **Email alerts ON/OFF** (global).
- SMTP sender display name/address (credentials via env vars).

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

> **Pass 3 note (§18 D-04, D-08):** one estimate holds exactly one complete product (confirmed, D-04). The cost of a parent is built from its descendants: the sum of the costs of all children (grandchildren and deeper included), multiplied by the item quantity (§7.4 BL; §18 D-08, AQP-9 comment 10442 and AQP-13 comment 10445). Each node's own costs (BG) are still calculated individually, as in the worksheet. Details still open: Q-32. Check against the sample: §18.5.

### 6.2 Customer selection
Before any data entry, the Engineer **MUST** choose the **customer** from a drop-down of all customers. That customer's rates drive every formula for the estimate. Changing the customer later requires confirmation and triggers recalculation.

### 6.3 Status lifecycle
`DRAFT` → (Engineer clicks **Calculate**) → `SUBMITTED` → (Lead/Admin **Approve & Lock**) → `APPROVED` (locked) → (Lead/Admin **Unlock**) → `DRAFT`/`SUBMITTED` (editable again).

- **Save** stores inputs at any time (drafts may be incomplete).
- **Calculate (Engineer):** validates that all mandatory inputs are filled (§7.3) for every node; on failure, shows errors and highlights the offending nodes and fields in the tree. On success, it calculates and stores costs, sets status to `SUBMITTED`, and shows only this message:
  > "Cost will be calculated based on the input fields and sent for review/approval."
- **Recalculate (Admin/Lead):** available whenever inputs change after a calculation.
- **Approve & Lock:** Lead/Admin enter the **Approved Quote Price** (pre-filled with the calculated Total Unit Production Price, BL; editable to override). All inputs become read-only.
- **Unlock:** Lead/Admin can unlock an approved estimate for re-estimation (logged with reason **[DEFAULT]**).

### 6.4 Viewing costs (Admin/Lead)
- By default they see the **input fields and the final cost** for each node.
- A **"View Cost Details"** button on each node reveals all calculated fields, grouped by stage (§7.4), each with its **formula displayed next to it**.
- Engineers never see this button or any cost.

### 6.5 Downloading
Admin/Lead can download the Excel export (§10) at any status. Engineers cannot download **[DEFAULT — the export contains costs]**.

---

## 7. Field Definitions (initial configuration)

The worksheet is defined by a **field registry** (§8). The seed configuration below MUST be loaded on first install. "Letter" is the initial column letter.

### 7.1 Input sections — the Engineer's form, in this order
Each section is a card with a header (number, name, column range). Every field shows its **column letter** as a small badge (e.g. Machining Cost shows **AP**). Fields filled automatically from masters are read-only and visually shaded.

| # | Section | Letter | Field | Type | Notes |
|---|---|---|---|---|---|
| 01 | Part Details | A | Sl. No | auto | Tree numbering |
| | | B | Part No. | text | |
| | | C | Part Model | image | Paste (Ctrl+V), drag-and-drop, or file picker; PNG/JPG/GIF/WebP; **< 200 KB** (reject larger with a clear message); preview + replace/remove |
| | | D | Description | text | |
| | | G | Treatment / Color | select + other | Options from Treatment/Color List; "Other" reveals free text. The list includes "Not applicable" (§18 D-06, confirmed, AQP-1 comment 10441 (b); values: Q-33) |
| | | H | QTY per Assy | number(2dp) | |
| 02 | Material and Dimensions | E | Material in Drawing | select | From Material Master. The list includes "Not applicable" (§18 D-06, confirmed, AQP-1 comment 10441 (b); values: Q-33) |
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
- **All visible input fields are mandatory** when the user clicks **Calculate**. A blank field produces an inline error, and the node is flagged in the tree.
- Conditionally hidden fields (T, U when S = "None"/blank) are not required and take the value **0**.
- Numbers: ≥ 0 **[DEFAULT]**, max 2 decimal places.
- Surface Treatment: selecting none is valid (all eight = 0) **[DEFAULT]**.
- **Pass 3 (§18 D-06, confirmed):** where a part does not need a number field, including a parent (assembly) node, the user enters **0** (AQP-7), so the mandatory rule above still applies to every node and the calculations are not affected. For Material in Drawing (E) and Treatment / Color (G) the user chooses **"Not applicable"** (AQP-1 comment 10441 (b)), which closes the assembly-row problem (finding F-08).

### 7.4 Calculated fields (Admin/Lead only), grouped into six stages
Formulas refer to columns **in the same row (node)** unless stated. Rate names come from the **selected customer's** rates; `Material-*` values come from the Material Master row for column E.

| Stage | Letter | Output | Formula |
|---|---|---|---|
| 1 · Weights & Areas | M | Blank Weight | `(L * K * J * Material-Specific-Gravity) / 1000000` |
| | O | Scrap Weight | `M - N` |
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
| | BL | Total Unit Production Price (INR) | Product-level value, **shown in row 2 only**. For each top-level item: `H(item) * SUM(BG)` over the item's own row and all its descendant rows (children, grandchildren and deeper). The estimate's BL is the sum over its top-level items (ASSUMPTION-48 (d)). Each BG keeps its own row's quantity (`BB = BA * H`). **§18 D-08, confirmed as corrected (AQP-9 comment 10442, AQP-13 comment 10445); checked against the sample in §18.5.** With quantity 1 on the top-level item this equals the earlier `SUM(BG)` over all nodes. Open details (Q-32): whether the quantity of a part between the item and a lowest-level part also multiplies; whether a parent with non-zero inputs of its own counts its own BG (the worksheet counts it); the item quantity applied again to the item's own row. |
| | BN | Total Unit Production Price (INR) / Tool Cost (INR) | `BL / SUM(BM)`, where `SUM(BM)` is the total of the Tool Cost entries of all nodes of the estimate; calculated when that total is above 0; shows "—" when it is 0; **shown in row 2** (§18 D-05, confirmed, AQP-1 comment 10441 (a)). Where BN appears in the export compared with the sample: Q-31. |
| | BO | Approved Quote Price | Entered by Admin/Lead at approval (calculated BL or an override); **product-level, row 2 only** |

> **Pass 3 status (§18):** (1) BN = BL / total of all BM entries (D-05) is confirmed and replaces the earlier row-2 BM divisor. (2) The children-only wording and the quantity rule are confirmed as corrected by the delivery lead (D-08, AQP-9 comment 10442, AQP-13 comment 10445): the BL row above replaces `SUM(BG)` over all nodes; the BB row (`BA * H`, own-row quantity) is unchanged. (3) The earlier per-level reading "a child's cost multiplied by its parent's quantity, 2 x 3 = 6" (comment 10415) is withdrawn as written; whether intermediate quantities also multiply is Q-32 (a). Worked check: §18.5.

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
- Operators: `+ - * / ( )`. Functions: `SUM(column)` (across all nodes; for product-level fields) **[DEFAULT: also MIN, MAX, ROUND, IF(cond, a, b)]**.
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
| Estimate workspace | all (role-filtered) | Customer selector; tree panel; node editor with section cards; Save / Calculate / Recalculate / Approve & Lock / Unlock / Download; status badge |
| Cost details (per node) | Admin, Lead | Stage-grouped outputs with formulas; hidden-zero rule applied |
| Masters (Process, Customer, Material, Exchange Rate, Treatment/Color) | Admin | CRUD tables with search; sync prompt (§4.2) |
| Field & Formula configuration | Admin (Lead read-only view of formulas) | Worksheet-style column list (letter, label, section, type, formula); insert/delete; formula editor; checkpoints; change history |
| Users | Admin | Create / edit / deactivate users; assign role |
| Settings | Admin | Email alerts ON/OFF; email test button |
| About | all | Site description, **Version No: 1.0**, "© Accucut Lasers Pvt Ltd. All rights reserved." |

Global header: logo/name "Accucut Quotation Portal", notification bell (§5.3), user menu (profile: name, email, change password, logout).

---

## 10. Excel Export (MUST)

- An `.xlsx` that **replicates the client's sample worksheet**: the same fixed header row (row 1), columns **A–BO** in letter order with the **same column widths**, and **all cells horizontally and vertically centred**. All cell formats are preserved, including **currency formats** (₹ for INR columns, $ for USD, € for EUR).
- The sample worksheet is the reference. **Place it at `docs/reference/sample-estimate.xlsx`** and read column widths, header text and number formats from it when seeding the field registry. *(The sample is not yet in the repository — ask the client for it; until then, use sensible widths and formats and keep them configurable per field.)* **Correction (G2 remediation, 2026-11-01):** the original workbook `AMADA-20261006.xlsx` is already tracked in the repository on `origin/master` since commit c7576f0, and the repository is readable without sign-in (RISK-006). The statement above is the SPEC v1.0 text and is no longer true. What to do with the file and the repository is the delivery lead's decision (Q-30; gate log G2, remediation 6).
- Rows: row 1 = headers; from row 2, one row per tree node in **depth-first order** (1, 1.1, 1.1.1, 1.1.2, 1.2, …, 2, …). Column A contains the Sl. No text.
- Column C embeds the part-model image, scaled to fit the cell.
- **Every column is exported**, including outputs hidden on screen because they are zero (exported as 0) and hidden Fasteners Qty/Cost (0).
- Product-level values: **BL2** = Total Unit Production Price (§7.4 BL), **BO2** = Approved Quote Price, **BN2 = BL2 / total of all BM entries** (§18 D-05, confirmed, AQP-1 comment 10441 (a)). Whether the sample's per-item totals must also appear is open (Q-31).
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
- Modern, professional look following **§17 UI Direction**. Light and dark mode **[DEFAULT]**.
- Touch targets ≥ 44 px. No horizontal page scrolling at any breakpoint.
- Image input: on mobile, the file picker allows the camera/gallery; paste and drag-drop also work on desktop.
- Numeric fields use `inputmode="decimal"`.
- Date-time picker shows IST explicitly.
- Unsaved-changes warning on navigation. Autosave drafts every 30 s **[DEFAULT]**.
- Accessibility: WCAG 2.1 AA — labels on every input, keyboard-navigable tree (arrow keys), visible focus, status conveyed by more than colour.
- Clear loading, empty and error states; toast confirmations for saves.

---

## 12. Non-functional Requirements

- **Security:** server-side RBAC on every route and API; CSRF protection; secure, HttpOnly cookies; rate-limited login; step-up re-authentication for formula edits, field deletion and checkpoint revert; input sanitisation; image type validated by content (magic bytes), not by extension.
- **Audit:** log configuration changes, approvals, unlocks, Approved Quote Price overrides and master-data edits (who, when, before → after).
- **Performance:** an estimate with 500 nodes recalculates in under 2 s; pages are interactive within 2 s on a mid-range mobile on 4G.
- **Reliability:** daily database backup guidance in the README; email failures retried and logged.
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
2. With a known set of inputs and rates, every output in §7.4 matches a hand-calculated worksheet to 2 decimals (unit tests per formula, plus one end-to-end tree with 1, 1.1, 1.1.1, 1.1.2, 1.2–1.5). **Pass 3:** BL is checked as `H(item) * SUM(BG)` over the item's rows (§7.4, §18.5), which equals the worksheet's BL when the item quantity is 1; Q-32 lists the roll-up details still open.
3. Sl. No renumbers correctly after add, reorder and delete at any depth.
4. Clicking Calculate with any visible input blank shows errors and does not submit; with Fasteners = "None", T and U are hidden, not required, and stored/exported as 0.
5. Unselected Surface Treatment outputs are hidden in the cost view but present (0) in the export.
6. Inserting a field after AX produces a new AY; former AY…BO shift by one; all formulas display the updated letters and still calculate the same results; the BL/BO product cells move to BM2/BP2.
7. Deleting a referenced field is blocked with a list of the referencing formulas; deleting an unreferenced field shifts later letters back by one.
8. Reverting to a checkpoint restores the exact earlier configuration; approved estimates still show and export their original values and layout.
9. Formula save, field delete and checkpoint revert all require password re-entry; a cyclic or invalid formula cannot be saved.
10. Process Master updates propagate to customers; manually overridden customer values trigger the keep/apply prompt; Reset to Defaults works.
11. The assignment email, the immediate overdue email and the 11:00 IST daily digest are sent with the correct To/Cc only when alerts are ON, without duplicates.
12. The export opens in Excel with the A–BO layout, the original column widths, centre/middle alignment, currency formats, embedded images, and BL2/BO2 populated.
13. All screens work without horizontal page scroll, and with all actions reachable, at 360 px, 768 px and 1366 px widths (Playwright).
14. Only one active Admin can exist.

---

## 15. Open Items (implement the interim behaviour; keep it configurable)

| # | Item | Interim behaviour |
|---|---|---|
| 1 | **Rejection (BC)** formula not defined | Seeded formula `0`; the Admin can set it later through the formula editor (e.g. `BB * Rejection %` after adding a `Rejection %` rate). |
| 2 | **Parent vs. child cost:** BL sums BG of *all* nodes, so a parent node's own cost and its children's costs are both included | **Pass 3 (§18 D-08):** answered by the delivery lead: the cost is the sum of the costs of all children multiplied by the item quantity (§7.4 BL). The sample worksheet agrees at quantity 1 (§18.5). Still open: Q-32 (quantity of intermediate parts; a parent with non-zero inputs of its own; the item's own row; several top-level items). |
| 3 | **Sample worksheet** not yet provided | Use placeholder widths/formats; replace them once `docs/reference/sample-estimate.xlsx` is supplied. **Pass 2 update (§18 D-03):** the sample is `AMADA-20261006.xlsx`; the cleaned copy for the repository is open (Q-30). **Correction (2026-11-01):** the original is already tracked on `origin/master` since commit c7576f0 (RISK-006). |
| 4 | **Network folder links** may be blocked by browsers | `file:///` link + "Copy path" button (§5.1). |
| 5 | **Remarks (AJ)** is mandatory under the "all inputs mandatory" rule | Mandatory as specified; can be switched off per field in configuration. |
| 6 | **Plating flag (AD)** is not used in any formula; Plating Cost (AU) is entered manually | Implement as specified. |
| 7 | **"Not needed for this part" switch** (proposed): one click on a section sets its fields to 0 and collapses it, to speed up entry; zeros still export | **Closed (§18 D-06, AQP-1 comment 10441 (f)):** not built. The Engineer enters 0 (AQP-7) and chooses "Not applicable" in the Material and Treatment lists. |
| 8 | **Logo source file:** the supplied logo is only 200 × 200 px and may look soft on large screens | Use `docs/03-ux/assets/accucut-logo.jpg`; replace it when a sharper original (SVG, AI or large PNG) is supplied. |

---

## 16. Glossary

- **Item / Part / Sub-part:** nodes in the product tree; all share the same fields.
- **Node row:** one row of the worksheet, i.e. one node of the tree.
- **Column letter:** Excel-style identifier of a field (A, B, …, AA, …), derived from its position.
- **ConfigVersion:** immutable snapshot of the field/formula configuration.
- **Checkpoint:** a named ConfigVersion the Admin can revert to.
- **Approved Quote Price:** final price set by Lead/Admin at approval (formerly "Final-Final Estimate").

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

The delivery lead (Santhosh - MD) answered the discovery questions on Jira on 2026-10-31 and, on 2026-11-01, confirmed, corrected or qualified the items that had rested on assistant-drafted wording (AQP-1 comments 10415 and 10417). Some of that confirmation is in his own words and some is a blanket confirmation of the orchestrator's list wording; the status rule below says which. The full question text, the assumption used and the source comment for each answer are in `docs/01-discovery/requirements-questions.md`.

**Status rule (one rule for the whole document).** Every answer below has one of these statuses.

- **Confirmed:** his own words on Jira support it; the comment ID is shown. It is his decision. Where it changes SPEC text, the note in that section says so.
- **Confirmed on list wording:** he confirmed it by his sentence "I confirm the below items that I answered already" (AQP-1 comment 10441) above a list whose wording is the orchestrator's (comment 10426, repeated word for word). It is confirmed by him and stands, but it is **not his own words** (decision DL-001, gate log G2). Items (a), (b), (c), (f) and (g) of that comment have this status. He can change any of them later.
- **Confirmed as corrected / qualified:** he confirmed it only after correcting or qualifying it. The corrected or qualified text applies, not the earlier wording.
- **Open detail:** a confirmed answer that leaves a detail unclear, or that conflicts with the sample worksheet, is not guessed. A new or revised question (Q-nn) records it, and the labelled assumption named there applies until he answers.

**History.** In Pass 2 (before he replied), content that rested only on AQP-1 comment 10415 (2026-10-31, 23:39) or 10417 (23:53) was marked UNCONFIRMED (UNC-a to UNC-h) and did not replace SPEC text, because that wording was an assistant draft, not his. In Pass 3 he replied. In his own words: AQP-1 comment 10443 (a correction to (d)), AQP-9 comment 10442 and AQP-13 comment 10445 (the corrected cost rule, same text), AQP-11 comment 10444 (offline use in the next release) and AQP-12 comment 10446 (what the date means). Items (a), (b), (c), (f) and (g) of AQP-1 comment 10441 were confirmed on the orchestrator's list wording (see "Confirmed on list wording" above). The labels UNC-a to UNC-h stay as identifiers; none is unconfirmed now. The register is in `requirements-questions.md` section 4.

### 18.1 Decisions

| ID | Decision | Status | Question and source | Sections affected |
|----|----------|--------|---------------------|-------------------|
| D-01 | Budget: no limit. Start 2026-11-02. Target: 10 working days at 8 hours a day, Monday to Friday, ending 2026-11-13. The date is for completing development and handing that version to his customer for testing, acceptance and new change requests, after which the next steps are decided. | Confirmed as a **target, not a fixed constraint** (UNC-h). Start date and 10 working days: AQP-2. Monday-to-Friday week ending 2026-11-13: AQP-1 comment 10441 (h). Qualified by AQP-12 comment 10446: he asks for a realistic development completion date and says the date is not a blocker. | Q-01, Q-29; AQP-2, AQP-1 (10441), AQP-12 (10446) | none in the SPEC; release plan |
| D-02 | The sponsor is one person: "Santhosh - MD". | Confirmed | Q-02; AQP-3 | none |
| D-03 | `AMADA-20261006.xlsx` is the sample worksheet and contains only a couple of items. Engineers enter inputs; Admin and Leads view all cost calculations; export to Excel is needed. | Confirmed | Q-03; AQP-4 | §10, §15 item 3 |
| D-04 | One estimate holds one complete product, which may have multiple items, parts, sub-parts and sub-sub-parts, and so on. | Confirmed | Q-04; AQP-5 | §6.1 |
| D-05 | Tool Cost (BM) is an input entered by the Engineer with all other inputs. BN = BL / total of all Tool Cost entries (UNC-a). | Engineer enters Tool Cost: confirmed, his own words (AQP-6). BN = BL / total of all Tool Cost entries: **confirmed on list wording** (AQP-1 comment 10441 (a)), not his own words. Where BN appears in the export compared with the sample is open (Q-31). | Q-05; AQP-6, AQP-1 (10441) | §7.1 (08), §7.4 BN, §10 |
| D-06 | Where a part is not required the Engineer enters 0, so calculations are not affected. "Not applicable" is a choice in the Material (E) and Treatment (G) lists (UNC-b). The "Not needed for this part" switch is not built; Q-15 is closed (UNC-f). | Enter 0: confirmed, his own words (AQP-7). "Not applicable" in the lists and Q-15 closed: **confirmed on list wording** (AQP-1 comment 10441 (b) and (f)), not his own words. Open detail: the rate values and handling of the "Not applicable" Material row (Q-33). | Q-06, Q-15; AQP-7, AQP-1 (10441) | §4.3, §4.5, §7.1, §7.3, §15 item 7 |
| D-07 | Approved estimates are not affected by any change (configuration, rates, masters). Recalculating after an unlock uses the current rates and shows a notice if they changed (UNC-c). | Approved estimates unaffected: confirmed, his own words (AQP-8). Recalculation with current rates and a notice: **confirmed on list wording** (AQP-1 comment 10441 (c)), not his own words | Q-07; AQP-8, AQP-1 (10441) | §8.4 |
| D-08 | The cost is the sum of the costs of all children (grandchildren and deeper included) multiplied by the item quantity. His words (AQP-9 comment 10442, AQP-13 comment 10445): "The cost should be sum of costs of all children multiplied by item quantity. In the sample provided, item 1 (Row#1) has children, grand-children rows from 2 to 11. So, the parent's cost (BL2) is calculated as sum of the cells BG2 to BL11 and the result is multiplied by no. of the main (parent) item." (UNC-d). *Correction, 2026-11-01:* an earlier version of this row restated his sentence as "item 1 (row 2) has children and grandchildren in rows 3 to 11". That was the analyst's paraphrase, not his wording. In the sample file as saved, row 1 is the header, item 1 is in row 2 and its descendants are in rows 3 to 11, which differs from his "Row#1 ... rows from 2 to 11"; the reading is open as Q-32 (e). | **Confirmed as corrected, in his own words.** AQP-1 comment 10441 (d) was confirmed only as corrected in AQP-1 comment 10443 (see AQP-9); the corrected text is AQP-9 comment 10442 and AQP-13 comment 10445. The earlier "child cost x parent quantity, 2 x 3 = 6" (comment 10415) is withdrawn as written. Open details: the cell range reading, quantity of intermediate parts, parents with their own inputs, several top-level items (Q-32; worked check §18.5). | Q-08, Q-32; AQP-9 (10403, 10442), AQP-13 (10445), AQP-1 (10441, 10443) | §6.1, §7.4 BL, §14.2, §15 item 2 |
| D-09 | Master data values are entered when the app is first used, and the delivery lead will also provide defaults. After the UX is reviewed and finalised (G3 approval) and before development starts, work stops and the delivery lead is asked for the master data defaults. | Confirmed (AQP-10) | Q-09; AQP-10, AQP-1 | none in the SPEC; delivery process |
| D-10 | Release 1 is hosted on the internet. Offline use ("like running a website locally") comes in the next release (UNC-e). | Confirmed: AQP-1 comment 10441 (e); AQP-11 comment 10444 ("we shall implement the offline release in next release"). This closes the conflict with AQP-11 comment 10405 for Release 1. Hosting details are still open (Q-18, G3). | Q-18; AQP-11, AQP-1 (10441) | §2 Deployment |
| D-11 | The stated assumptions stay for Q-10 to Q-14, Q-16, Q-17 and Q-19 to Q-28 (UNC-g). | **Confirmed on list wording** (AQP-1 comment 10441 (g)), not his own words. They remain labelled assumptions; he can change any of them later. | AQP-1 (10441) | none |

### 18.2 Questions raised by the answers: status after Pass 3

| ID | Subject | Blocking | Status |
|----|---------|----------|--------|
| Q-29 | What the 2026-11-13 date delivers | Was yes | **Answered** (AQP-12 comment 10446, D-01). He asks for a realistic development completion date; the product manager supplies it. |
| Q-30 | Cleaned copy of the sample for the repository; blank company template | No | Open |
| Q-31 | The sample shows totals per top-level item; the answers give one total per estimate | No | Open |
| Q-32 | Roll-up details left after the corrected cost rule (D-08) | Yes by definition (decides price correctness); (a) and (b) due **G2** and hold it, (c) to (e) due **G3** (master decision DL-005) | **Open, restated for G2 remediation (2026-11-01):** (a), (b1) to (b3), (c), (d), (e1), (e2); revised text and ASSUMPTION-48 on AQP-13 |
| Q-33 | Rate values and handling of the "Not applicable" Material row | No | Open |
| Q-34 | Which scope the realistic development completion date covers | No | **New** |

### 18.3 Release 1 scope note

Offline use ("running locally when there is no internet") is **not** part of Release 1. It is planned for the next release (D-10, confirmed). What "offline" means (a full copy running on a local PC, or an entry form that works without a connection and sends later) is settled when that release is planned. If offline use were brought into Release 1, the architecture, data-storage and synchronisation scope would change and §2 would be reopened.

### 18.4 Items formerly unconfirmed (UNC-a to UNC-h): resolution and SPEC text now in force

| ID | Resolution | SPEC text now in force | Place |
|----|------------|------------------------|-------|
| UNC-a | Confirmed on list wording (comment 10441 (a)), not his own words | BN = BL / total of all Tool Cost entries; "—" when the total is 0 | §7.4 BN, §10 |
| UNC-b | Confirmed on list wording (comment 10441 (b)), not his own words | "Not applicable" is in the Material and Treatment lists; its values: Q-33 | §4.3, §4.5, §7.1, §7.3 |
| UNC-c | Confirmed on list wording (comment 10441 (c)), not his own words | Recalculation after unlock uses current rates, with a notice | §8.4 |
| UNC-d | Confirmed as corrected, in his own words (comments 10443, 10442, 10445) | BL = item quantity x sum of BG over the item's rows (§7.4); per-level 2 x 3 = 6 withdrawn; details Q-32 | §6.1, §7.4, §14.2, §15 item 2 |
| UNC-e | Confirmed, restated in his own words (AQP-11 comment 10444; comment 10441 (e)) | Release 1 internet-hosted; offline in the next release | §2 |
| UNC-f | Confirmed on list wording (comment 10441 (f)), not his own words | Q-15 closed; the switch is not built | §15 item 7 |
| UNC-g | Confirmed on list wording (comment 10441 (g)), not his own words | The stated assumptions stand | none |
| UNC-h | Confirmed as a target (comment 10441 (h)), qualified in his own words (comment 10446) | No SPEC text; the date is a target for completing development and handing over for testing and acceptance, not a fixed constraint | release plan |

### 18.5 Parent cost rule checked against the sample worksheet (G1 condition 2)

Method: the business analyst opened `AMADA-20261006.xlsx` (first worksheet, formulas and stored results) and re-added the cells. In line with ASSUMPTION-46 and NFR-023, no cell value is written in this repository; results are given as agreement or ratios.

1. **Which cells.** The worksheet formula in BL2 is `SUM(BG2:BG11)`. Re-adding BG2 to BG11 gives the stored BL2 exactly. Reading "BG2 to BL11" as a rectangle (columns BG to BL, rows 2 to 11) would also add the exchange-rate columns BH and BI, the USD and EUR price columns BJ and BK, and BL itself (a circular reference); that sum is about 16 % higher than the stored BL2. So "BL" in his sentence reads as a loose reference, and the range supported by the worksheet is **BG2:BG11** (column BG only). This reading is the analyst's, checked against the worksheet; Q-32 (e) asks him to confirm it. His own wording is "item 1 (Row#1) has children, grand-children rows from 2 to 11" and "the sum of the cells BG2 to BL11". In the file as saved, row 1 is the header, item 1 is in row 2 and its descendants are in rows 3 to 11 (the worksheet's rows 2 to 11 hold item 1 and its descendants). His "Row#1 ... rows from 2 to 11" and the earlier D-08 paraphrase ("row 2 ... rows 3 to 11") are therefore not the same, and whether item 1's own row is inside his range is Q-32 (e1); on the sample it makes no difference, because item 1 carries no values of its own. Which columns are meant is Q-32 (e2).
2. **Levels.** Rows 2 to 11 hold item 1, its children (1.1 to 1.5) and its grandchildren (1.1.1, 1.1.2, 1.4.1, 1.5.1). The worksheet adds the BG of every one of those rows, grandchildren included. This agrees with his sentence ("sum of costs of all children ... children, grand-children rows from 2 to 11").
3. **Parents with inputs of their own.** Item 1 and part 1.1 carry zero inputs, so counting their BG changes nothing. Parts 1.4 and 1.5 are parents (each has one child) and carry non-zero inputs of their own; the worksheet counts their own BG as well as their child's. If a parent counted only its children (AQP-9 comment 10403, taken literally), BL2 would equal the sum of the six lowest-level rows only, about 59 % lower than the stored BL2; the two parents' own BG make up the whole difference. His corrected sentence and the worksheet agree (all rows 2 to 11 are summed); the literal AQP-9 comment 10403 wording ("part-1's cost is the sum of its children") does not. The sentence "a parent has no cost of its own" is wording from the assistant-drafted comment 10415, **unconfirmed**; it is not in AQP-9 comment 10403 and not in the 10441 list, and it is not his. This is not settled: Q-32 (b).
4. **Quantity.** Qty / Assy (H) is 1 on every row of the sample. The sample therefore cannot show whether the multiplication happens once at the top item or at every level; every quantity rule, (a) and (c), gives the same result on it. (This holds for the quantity rules only; it does not hold for (b) or for the column reading in (e2), see the closing paragraph.) The worksheet itself multiplies each row by its own H only (`BB = BA * H`) and has no item-level multiplier, so "x item quantity" is a new step that changes nothing at quantity 1. Q-32 (a), (c).
5. **Other top-level items.** Item 2 (row 13) has its own BL, equal to its own BG, and its own Tool Cost. How the estimate's total combines top-level items is Q-32 (d) and Q-31.

**Rule the worksheet supports:** for an item, BL = H(item) x the sum of BG over the item's own row and every descendant row, where each BG already carries its own row's quantity. At item quantity 1 this reproduces the stored BL2 exactly.

**Rule in force until Q-32 is answered (ASSUMPTION-48):** the rule above; a parent's own BG counts (as in the worksheet); the item quantity multiplies once, at the top; the estimate's BL is the sum over its top-level items. The restated sub-points are (b2) nothing is ignored, refused or warned about because the parent's own cost counts, (b3) a parent shows the sum of its own row and everything below it, not multiplied again by its own quantity, and the export shows each row's own values, and (e1) the item's own row is included and (e2) column BG only. The full wording is Q-32 in `requirements-questions.md` and on AQP-13; it is the analyst's reading and is not accepted by the delivery lead.

**Conflicts kept open, not guessed:** (i) the 10415 sentence "a parent has no cost of its own" (unconfirmed, not his words) and the literal AQP-9 comment 10403 wording, against the worksheet's treatment of parents 1.4 and 1.5; (ii) whether a quantity above 1 on a part between the item and a lowest-level part also multiplies; (iii) whether the item's own row is multiplied twice by the item quantity; (iv) which rows and columns "Row#1 ... rows from 2 to 11" and "BG2 to BL11" mean.

**Correction, 2026-11-01 (G2 remediation).** An earlier version of this paragraph said that none of these changes the result on the sample, and the Q-32 text said that every reading gives the same result on the sample. That is false for (i): a children-only reading gives a sample total **58.6 % lower** than counting the parents' own cost (item 3 above says so), and reading "BG2 to BL11" as a rectangle of columns gives a total about **16 % higher** (item 1 above). Only the quantity points (ii) and (iii) give the same result on the sample, because every quantity in it is 1, and the row part of (iv) makes no difference because item 1 carries no values of its own. For the several-item question (Q-32 (d)) the sample has a second top-level item, so the answer changes the estimate total there; that ratio has not been measured. The sample therefore cannot choose between the readings of (i) or of the column part of (iv).
