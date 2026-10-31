# Accucut Quotation Portal — Software Requirements Specification

**Client:** Accucut Lasers Pvt Ltd
**Source:** Requirement Understanding Document, Draft v5
**Audience:** Claude Code (implementation agent) and the development team
**Spec version:** 1.0

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
| Deployment | Docker Compose (app, worker, Postgres); `.env.example` provided |

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

### 4.4 Exchange Rate Master
**1 USD → INR**, **1 EUR → INR**.

### 4.5 Treatment / Color List
List of options for column G. The estimate form also offers **"Other"** with a free-text entry.

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
| | | G | Treatment / Color | select + other | Options from Treatment/Color List; "Other" reveals free text |
| | | H | QTY per Assy | number(2dp) | |
| 02 | Material and Dimensions | E | Material in Drawing | select | From Material Master |
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
| | | BM | Tool Cost | number(2dp) | |
| | | AJ | Remarks | text (multiline) | |

### 7.2 Display rules
- Card grid: **1 column on mobile, 2 on tablet, 3 on laptop/desktop**.
- The section order above is the on-screen order; the Excel export uses column-letter order.

### 7.3 Validation
- **All visible input fields are mandatory** when the user clicks **Calculate**. A blank field produces an inline error, and the node is flagged in the tree.
- Conditionally hidden fields (T, U when S = "None"/blank) are not required and take the value **0**.
- Numbers: ≥ 0 **[DEFAULT]**, max 2 decimal places.
- Surface Treatment: selecting none is valid (all eight = 0) **[DEFAULT]**.

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
| | BL | Total Unit Production Price (INR) | `SUM(BG)` over **all nodes** of the estimate; **product-level value, shown in row 2 only** |
| | BN | Total Unit Production Price (INR) / Tool Cost (INR) | `BL / BM`; calculated whenever both BL and BM have values (row 2 in the standard layout); show "—" when BM = 0 |
| | BO | Approved Quote Price | Entered by Admin/Lead at approval (calculated BL or an override); **product-level, row 2 only** |

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
- The sample worksheet is the reference. **Place it at `docs/reference/sample-estimate.xlsx`** and read column widths, header text and number formats from it when seeding the field registry. *(The sample is not yet in the repository — ask the client for it; until then, use sensible widths and formats and keep them configurable per field.)*
- Rows: row 1 = headers; from row 2, one row per tree node in **depth-first order** (1, 1.1, 1.1.1, 1.1.2, 1.2, …, 2, …). Column A contains the Sl. No text.
- Column C embeds the part-model image, scaled to fit the cell.
- **Every column is exported**, including outputs hidden on screen because they are zero (exported as 0) and hidden Fasteners Qty/Cost (0).
- Product-level values: **BL2** = Total Unit Production Price, **BO2** = Approved Quote Price, BN2 = BL/BM (standard layout). If columns are inserted or deleted, these cells move with their columns.
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
- Modern, clean look: neutral background, one brand accent (navy **#1F3864**), clear typography. Light and dark mode **[DEFAULT]**.
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
2. With a known set of inputs and rates, every output in §7.4 matches a hand-calculated worksheet to 2 decimals (unit tests per formula, plus one end-to-end tree with 1, 1.1, 1.1.1, 1.1.2, 1.2–1.5).
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
| 2 | **Parent vs. child cost:** BL sums BG of *all* nodes, so a parent node's own cost and its children's costs are both included | Implement as specified (sum of all nodes). Confirm with the client that a parent node carries only its own (e.g. assembly) cost. |
| 3 | **Sample worksheet** not yet provided | Use placeholder widths/formats; replace them once `docs/reference/sample-estimate.xlsx` is supplied. |
| 4 | **Network folder links** may be blocked by browsers | `file:///` link + "Copy path" button (§5.1). |
| 5 | **Remarks (AJ)** is mandatory under the "all inputs mandatory" rule | Mandatory as specified; can be switched off per field in configuration. |
| 6 | **Plating flag (AD)** is not used in any formula; Plating Cost (AU) is entered manually | Implement as specified. |

---

## 16. Glossary

- **Item / Part / Sub-part:** nodes in the product tree; all share the same fields.
- **Node row:** one row of the worksheet, i.e. one node of the tree.
- **Column letter:** Excel-style identifier of a field (A, B, …, AA, …), derived from its position.
- **ConfigVersion:** immutable snapshot of the field/formula configuration.
- **Checkpoint:** a named ConfigVersion the Admin can revert to.
- **Approved Quote Price:** final price set by Lead/Admin at approval (formerly "Final-Final Estimate").
