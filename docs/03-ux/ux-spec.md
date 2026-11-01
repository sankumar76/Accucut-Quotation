# UX Specification — Accucut Quotation Portal, Releases 1 and 2

| Field | Value |
|-------|-------|
| Version | 0.1 (G3 draft) |
| Owner | ux-expert |
| Status | In Review (G3, human approval) |
| Inputs | PRD v0.4; SPEC v1.3 (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`, §7, §9, §11, §17, §18 D-12); project brief v0.6; stakeholder map; gate log G2 attempt 2 (conditions 5, 6, 9); the client's `Accucut Quotation Portal UI-UX.html` (15 screens, unpacked and read); `docs/03-ux/assets/` (logo, company board) |
| Review pages | [`screens/index.html`](screens/index.html): 27 screens on 29 pages (the Engineer and Lead variants are separate pages), 11 phone and tablet frames, 115 direct state links. Open by double-click; no server, build or sign-in |
| Scope | Every user-facing FR through Release 2 (scope A and scope B are both covered, as DL-004 requires). Not designed, by decision: see section 0.3 |

How to read this: the HTML screens are the visual reference; this file is the rule book for them. Where the two differ, this file wins and the screen is a defect. The screens are review mock-ups; developers rebuild them with shadcn/ui and Tailwind using the tokens in section 7. All data on the screens is invented.

---

## 0. Delivery lead decisions recorded here

### 0.1 UI decisions of 2026-10-31 (their decisions; recorded nowhere else in the repository before this file)

The delivery lead gave these directly. They are not assistant proposals. SPEC §17 and catalogue DEC-01 to DEC-06 carry most of them in the analyst's wording; this section is the UX record of what was built from them.

| # | Their decision | Where it is built |
|---|----------------|-------------------|
| UD-1 | Engineer data entry uses the **guided form**, with an Excel **column letter on every field** (and a column range on every section). No spreadsheet-style grid | SCR-05 (letter badge on every field, range tag on every section); SCR-06 reuses the same form for Lead and Admin |
| UD-2 | **Brand "Red Leads":** white top bar with the real AccuCut logo image; the company name in the logo red (about #DE3030) in a bold serif like the company board; dark graphite side menu; red main buttons. This replaces the sample's blue and the spec's navy #1F3864 | `screens/screens.css` tokens; SCR-00 section 01 and 02; every screen's top bar and menu |
| UD-3 | **Rejected:** "Copy from part" and "Apply to selected". Do not design them | Absent from SCR-05, SCR-06 and the tree. Section 0.3 |
| UD-4 | **Drawing input is deferred** to the next release, but the layout leaves room for it | SCR-05: a reserved grid track beside the form (section 6, SCR-05, and the review toggle on that screen) |
| UD-5 | **Undecided:** a "Not needed for this part" switch per section that fills zeros | **Not designed.** Open question OQ-UX-01. The section header keeps a free slot at its right so a control could be added without redesign |

### 0.2 Conflicts found while applying the decisions (for the business-analyst)

| # | Conflict | Detail | Proposed resolution |
|---|----------|--------|---------------------|
| C-1 | **Navy #1F3864 survives in the Word draft.** SPEC §17.2 says "Red Leads" replaces navy #1F3864, but the only place that colour appears is `Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx` (its heading and table-header styling, 42 uses). No Markdown artefact uses it. Anyone reading the draft as the brand source will take navy as the colour | Two sources disagree on the brand colour | Mark the Word draft's colours as superseded by SPEC §17.2 in the catalogue; no UX change |
| C-2 | **Header wording.** SPEC §9 and FR-009 say the header shows "logo/name 'Accucut Quotation Portal'". UD-2 puts "ACCUCUT LASERS" in logo red beside the logo | The lockup built is: logo, "ACCUCUT LASERS" (red serif), and "Quotation Portal" as a small line under it. Both names are present | Confirm wording; or amend SPEC §9 |
| C-3 | **"Not needed" switch.** They now call it undecided. PRD FR-095 (Won't), SPEC §15 item 7 and D-06 record it as closed (Q-15, confirmed on list wording, AQP-1 10441 (f)) | Not designed. See OQ-UX-01 | BA and PM reopen or reconfirm |
| C-4 | **WCAG level.** PRD NFR-018 and SPEC §11 say WCAG 2.1 AA and "2.2 is not required". This design meets 2.2 AA (a superset) because the UX standard for this team is 2.2 AA | Adds 2.4.11 focus not obscured, 2.5.7 dragging alternatives, 2.5.8 target size, 3.3.7 redundant entry, 3.3.8 accessible authentication | PM raises NFR-018 to 2.2 AA (no cost; the design already complies) |
| C-5 | **SPEC §11 "Light and dark mode [DEFAULT]"** against PRD FR-090 (Could, R3) and the current instruction that dark mode is out of scope | Not designed; tokens are named so a dark set can be added later | PM and BA align SPEC §11 |
| C-6 | **SPEC §9 lists no audit screen**, but FR-011 ("I can rely on a record") and FR-079 (view and filter the change history) need one | SCR-16 added | PM confirms |

### 0.3 Not designed, on purpose

| Item | Why | Trace |
|------|-----|-------|
| "Copy from part", "Apply to selected" | Rejected (UD-3) | FR-094 |
| Drawing viewer and reading data from drawings | Deferred (UD-4); only room is reserved | FR-093, FR-087 |
| "Not needed for this part" switch | Undecided (UD-5); Engineers enter 0 | FR-095, OQ-UX-01 |
| Offline use | Next release; meaning undecided (Q-18) | FR-092 |
| Dark mode | Out of scope now (FR-090, R3) | C-5 |
| UI-sample extras ("Awaiting review", "Closed this month", global search, per-Engineer workload counts, "Visible to Engineer" column, Tool Cost beside the total) | Out of scope now (FR-097, R3). The Tool Cost *input* and BN are in; a per-row "Visible to Engineer" column is not (the **Kind** column says the same thing: Input, Auto or Output) | FR-097 |
| Import of past estimates | FR-096 | |
| Installation (Docker, README) | Not a screen. FR-091 is a documentation and deployment deliverable | FR-091 |

---

## 1. Design principles

1. **One part at a time, in worksheet order.** The Engineer sees one part's form with the tree beside it, eight sections in the SPEC §7.1 order, and every field carries the column letter it has in Excel. Nothing else competes for attention.
2. **Engineers never see cost, and the page never hints at it.** No cost, rate, formula, preview or empty cost placeholder is rendered for an Engineer. Wording avoids saying a hidden thing exists. After Calculate they see one sentence and nothing else.
3. **A number on screen always says what kind of number it is.** A parent shows its own row plus everything below; the Excel file shows each row alone. Both are labelled wherever they appear, so nobody takes one for the other (G2 condition 6).
4. **State is stated in words, an icon and a shape, never colour alone.** Draft, Submitted, Approved, Overdue, Missing data and errors all carry text and an icon; the brand red is for actions, amber for time, error red for faults.
5. **Same hand everywhere.** Four type sizes, one 4-point spacing scale, one 44 px control height, one button set, one palette. A new screen is built from the same parts or the part is added to the design system (SCR-00).
6. **Fast with a keyboard, safe on a phone.** Enter moves to the next field; targets are 44 px; the tree is a drawer and the action bar is sticky on small screens; tables scroll only inside their own box.

---

## 2. Personas and key tasks

From PRD section 2. No persona is added.

| Persona | Top tasks | Context of use |
|---------|-----------|----------------|
| **Engineer** (many) | Open an assigned task; copy the folder path; choose the customer; build the parts tree; enter inputs section by section; press Calculate; fix missing data | Desktop at a workstation with drawings open elsewhere; also phone and tablet on the shop floor. Daily. Mouse and keyboard; fast entry matters |
| **Lead** (many) | Assign a task with a deadline; watch the queue and overdue work; review inputs and costs; recalculate; approve and lock with the Approved Quote Price; unlock; export | Desktop and tablet; some phone use for the queue and the bell. Daily |
| **Admin** (exactly one) | Keep masters and customer rates current; manage users; change fields and formulas safely (R2); read the audit log; set e-mail alerts (R2) | Desktop. Weekly. Careful, infrequent, high-consequence actions: confirmations and password re-entry |
| **Santhosh, MD** | Review these screens at G3 | Desktop, double-click, no sign-in |
| Accucut IT, customers | Not portal users of these screens | |

Frequencies are not evidenced (Q-24).

---

## 3. User journeys

Notation: **Happy path** then **Recovery**. Emotions are design intent, not research.

### UJ-01 Sign in and land on my work
- **Persona and trigger:** any user; opens the portal address.
- **Steps:** 1 Enter e-mail and password (SCR-01). 2 Land on the role's home: Engineer on "My tasks", Lead and Admin on "Task queue" (SCR-03). 3 See only the menu items the role may open (SCR-25).
- **Recovery:** wrong e-mail or password: one message that does not say which was wrong, field values kept except the password. Five failed attempts: blocked for 15 minutes with a message that says how long (NFR-003, proposed value). Session ended: SCR-26 or SCR-01 with "Your session ended" and return to the page they were on. Forgotten password: Admin resets it (R1, SCR-14); self-service link (R2, SCR-02). A typed address the role may not open: "You do not have access to this page" (SCR-26), which never reveals what the page holds.
- **Emotion:** brief, calm. **Success:** home page in under 5 seconds from submit.
- **FRs:** FR-001, 003, 007, 009.

### UJ-02 Lead assigns a task
- **Trigger:** a Lead has a new request folder on the network share.
- **Steps:** 1 "Assign task" (SCR-04). 2 Choose the Engineer, paste the network folder path, choose deadline date and time (IST shown). 3 Optional title and notes. 4 Assign. 5 Confirmation names the new task ID and links to the queue. The Engineer's Open queue now holds it; if alerts are ON the Engineer is e-mailed (R2).
- **Recovery:** validation on submit with an error summary that links to each field; path not starting with `\\`; deadline in the past. Alerts OFF: a notice says the Engineer will not be e-mailed. Wrong Engineer or deadline later: "Reassign or change deadline" (R2), logged; there is no cancel.
- **Success:** task exists in DRAFT with an empty estimate; **FRs:** FR-032, 033, 040, 081.

### UJ-03 Engineer finds the day's work
- **Steps:** 1 Open "My tasks" (SCR-03 Engineer). 2 Overdue rows stand out by amber bar, clock icon and "Overdue by …". 3 Copy the folder path or open the link. 4 Open the task (SCR-05).
- **Recovery:** link blocked by the browser: the tooltip text says so and **Copy path** always works. Bell badge opens the Overdue tab. No tasks: calm empty state. Load failure: retry without losing the page.
- **FRs:** FR-033, 034, 036, 037, 038, 041.

### UJ-04 Engineer builds the tree and enters a part
- **Steps:** 1 Choose the customer first (the form is held back until they do). 2 Optionally build the tree up front, or add parts as they go: sub-part, part beside, move, delete; Sl. No renumbers and is announced. 3 For each part, work through sections 01 to 08. Every field shows its letter; auto fields are shaded; Fasteners Qty and Cost appear only when Fasteners is not "None". 4 Enter moves to the next field. 5 The count "24 of 25 inputs complete" and the tree icons show what is left. 6 Auto-save every 30 seconds; Save draft at any time.
- **Recovery:** picture over 200 KB or wrong type: the message names the file, its size and the limit; the form is untouched. Leaving with unsaved changes: a dialog offers Save draft and leave. Customer changed late: a confirmation says the new rates apply at the next calculation. Number with three decimals or a minus sign: refused with the rule in words.
- **Emotion:** flow, no interruptions. **Success:** all inputs complete without touching the mouse between fields.
- **FRs:** FR-042 to 054, 056, 057, 087.

### UJ-05 Engineer calculates
- **Steps:** 1 Press Calculate. 2 Success: status becomes Submitted; the screen shows only "Cost will be calculated based on the input fields and sent for review/approval." Inputs become read-only. No number appears.
- **Recovery:** any visible input blank on any part: nothing is submitted; a summary lists each part and its missing fields as links; those parts get a triangle icon in the tree; each missing field has an inline message ("Enter this value. Use 0 if the part does not need it."). The Engineer fixes them and presses Calculate again.
- **Success criterion:** no cost, rate or formula in the response (FR-008). **FRs:** FR-055, 056, 064, 008.

### UJ-06 Lead reviews and approves
- **Steps:** 1 Open the estimate (SCR-06): the three totals BL, BN, BO once each, labelled with their letters; the tree with each row's figure. 2 Open a part; see inputs and the final cost; "View cost details" opens the six stages with formulas (SCR-07). 3 Approve and lock: the dialog (SCR-08) pre-fills BL as the Approved Quote Price. 4 Confirm. Inputs lock; the task moves to Closed; approver and time are recorded.
- **Recovery:** price invalid: message. Price different from BL: the dialog says the difference is recorded as an override. Totals stale: Approve is disabled and Recalculate is the main button (OQ-UX-06).
- **FRs:** FR-058 to 062, 065, 011.

### UJ-07 Lead corrects an input and recalculates
- **Steps:** 1 Edit an input on SCR-06. 2 A banner says the totals are out of date. 3 Recalculate. 4 Totals refresh; the "Calculated at" line changes. **FRs:** FR-061, 027, 031.

### UJ-08 Lead unlocks an approved estimate
- **Steps:** 1 Unlock (SCR-09). 2 Read the notices: configuration changed since approval (versions), rates changed (counts). 3 Type the reason. 4 Unlock; the estimate returns to Draft and the task to the Engineer's Open queue; recalculating later uses current values.
- **Recovery:** reason empty: message. **FRs:** FR-063, 038, 064, 011.

### UJ-09 Lead exports and reconciles
- **Steps:** 1 Open "Excel export" (SCR-10). 2 Read the file name and contents. 3 Compare "In the file" with "On screen" per row, and the reconciliation lines per item. 4 Download.
- **Recovery:** generation error: message with a reference; retry. Engineer opening the address: SCR-26. **FRs:** FR-066 to 071, 029, 030.

### UJ-10 Admin maintains masters
- **Steps:** 1 Process master: add or edit a rate (SCR-11). 2 If a default changes and customers hold their own values, the prompt lists them with apply or keep (R1+). 3 Customers: edit rates, "Reset to defaults" with confirmation (SCR-12). 4 Materials, exchange rates, treatment list (SCR-13).
- **Recovery:** delete of a used rate refused with the formulas listed; duplicate names refused; system rows ("Not applicable", "Other") are locked with a visible reason. **FRs:** FR-012 to 018.

### UJ-11 Admin manages users
- **Steps:** add user, set role, reset password, deactivate (SCR-14); hand over the Admin role in one step (R2).
- **Recovery:** second Admin refused with the current Admin named; own account cannot be deactivated. **FRs:** FR-004, 005, 006.

### UJ-12 Admin changes a formula or inserts a field (Release 2)
- **Steps:** field list (SCR-17); edit a formula with live checking and a preview (SCR-18); insert a field with a preview of letter changes (SCR-19); delete only when nothing uses it (SCR-20); save a checkpoint before risky work and revert if needed (SCR-21); every change is in the audit log (SCR-16). Formula save, field delete and revert ask for the password.
- **Recovery:** unknown name, syntax error and loops are named in plain words and block the save; wrong password: message, dialog stays; revert can be undone by reverting again. **FRs:** FR-072 to 080.

### UJ-13 Late work becomes visible
- **Steps:** the bell shows a count and opens the Overdue tab; rows carry text, icon and bar; with alerts ON (R2) the Engineer is e-mailed within 5 minutes with the assigner copied, and a daily digest at 11:00 IST (SCR-22). **FRs:** FR-036, 037, 081 to 084, 019 (SCR-15).

### UJ-14 Change my password
- Account page (SCR-23) from the user menu. **FRs:** FR-002.

---

## 4. Information architecture

```
Signed out
  SCR-01 Sign in ── SCR-02 Forgot / reset password (R2)

Signed in (side menu; items per role)
  WORK
    Task queue / My tasks ........ SCR-03 (Open | Closed | Overdue)
      └ Estimate (by task) ........ SCR-05 Engineer workspace  |  SCR-06 Review (Lead, Admin)
            ├ Cost details ........ SCR-07 (Lead, Admin)
            ├ Approve and lock .... SCR-08 (dialog)
            ├ Unlock .............. SCR-09 (dialog)
            └ Excel export ........ SCR-10 (Lead, Admin)
    Assign task ................... SCR-04 (Lead, Admin) · reassign mode (R2)
  MASTERS (Admin)
    Process master ................ SCR-11
    Customers ..................... SCR-12
    Materials and lists ........... SCR-13 (Materials | Exchange rates | Treatment / Color)
  CONFIGURATION
    Fields and formulas ........... SCR-17 (Admin edit; Lead view only)
      ├ Edit formula .............. SCR-18
      ├ Insert field .............. SCR-19
      └ Delete field .............. SCR-20 (dialogs)
    Checkpoints ................... SCR-21 (Admin)
  ADMINISTRATION (Admin)
    Users ......................... SCR-14
    Settings (e-mail alerts) ...... SCR-15 (R2)  · E-mail previews SCR-22
    Audit log ..................... SCR-16
  HELP
    About ......................... SCR-24
Top bar (always): logo and name · bell (overdue count → SCR-03 Overdue tab) · account menu (name, e-mail, role, Change password SCR-23, Sign out)
System pages: SCR-26 (no access, not found, error, session ended)
Reference: SCR-00 Design system
```

**Navigation model.** Persistent graphite side menu at 1024 px and wider; a drawer opened from a menu button below that (tablet and phone). The bell and account menu stay in the top bar at every size (FR-037). A bottom bar was rejected because the sticky action bar already uses the bottom edge of the workspace (this resolves analyst finding F-17).

**Naming.** Terms follow PRD and SPEC glossary: Task queue, Estimate, Parts tree, Item, Part, Sub-part, Sl. No, Approved Quote Price, Unlock, Process master, Material Master, Exchange rates, Treatment / Color, Checkpoint, Configuration version. The words "BL", "BN", "BO" are shown only as column-letter tags beside plain names.

**Entry points and deep links.**
- A task or estimate has the ID `Q-YYYY-NNNN` (FR-041); the address is `/estimates/<ID>`. The same address opens SCR-05 for an Engineer and SCR-06 for a Lead or Admin; the server decides.
- `/queue?tab=overdue` is the bell's target. Filters live in the address so a filtered queue can be bookmarked.
- A deep link to a page the role may not open shows SCR-26 "no access"; to a missing page, "not found". An Engineer opening another Engineer's task sees "no access".
- Sign-in remembers the requested address and returns there.

**Role matrix:** shown as a table on SCR-25 and enforced by the server (FR-007).

---

## 5. Screen inventory

Release: R1 core unless noted. "Files" are in `docs/03-ux/screens/`.

| Screen | Name | Purpose | Persona | Journeys | FRs | Files |
|--------|------|---------|---------|----------|-----|-------|
| SCR-00 | Design system | Tokens, brand, components, state patterns, shadcn map | all (reference) | | 085, 086, 088 | SCR-00 |
| SCR-01 | Sign in | Authenticate | all | UJ-01 | 001 | SCR-01, -phone |
| SCR-02 | Forgot and reset password (R2) | Single-use link reset | all | UJ-01, 14 | 003 | SCR-02 |
| SCR-03 | Task queue / My tasks | Open, Closed, Overdue; filters | Lead, Admin; Engineer | UJ-02, 03, 13 | 033 to 039, 041 | SCR-03, -engineer, -phone, -tablet |
| SCR-04 | Assign task; reassign (R2) | Create a task with folder and deadline | Lead, Admin | UJ-02 | 032, 033, 040 | SCR-04, -phone |
| SCR-05 | Estimate workspace, Engineer | Guided form with tree | Engineer | UJ-04, 05 | 042 to 057, 087 | SCR-05, -phone, -tablet |
| SCR-06 | Estimate review | Totals, tree with figures, inputs, actions | Lead, Admin | UJ-06, 07, 08 | 058 to 065, 070 | SCR-06, -phone, -tablet |
| SCR-07 | Cost details | Six stages with formulas for one row | Lead, Admin | UJ-06 | 058, 059, 026 | SCR-07, -phone |
| SCR-08 | Approve and lock (dialog) | Set Approved Quote Price, lock | Lead, Admin | UJ-06 | 062 | SCR-08 |
| SCR-09 | Unlock (dialog) | Unlock with reason and notices | Lead, Admin | UJ-08 | 063 | SCR-09 |
| SCR-10 | Excel export | Download; screen figures against the file | Lead, Admin | UJ-09 | 066 to 071 | SCR-10 |
| SCR-11 | Process master | Rates; change prompt | Admin | UJ-10 | 012, 014 | SCR-11, -tablet |
| SCR-12 | Customer master | Customers and rates; reset | Admin | UJ-10 | 013 | SCR-12 |
| SCR-13 | Materials, exchange rates, treatment list | Master lists | Admin | UJ-10 | 015 to 018 | SCR-13 |
| SCR-14 | Users | Users, roles, passwords, Admin hand-over (R2) | Admin | UJ-11 | 004 to 006 | SCR-14 |
| SCR-15 | Settings (R2) | E-mail alerts ON or OFF, sender, test | Admin | UJ-13 | 019 | SCR-15 |
| SCR-16 | Audit log and change history | Permanent record | Admin | UJ-12 | 011, 079 | SCR-16 |
| SCR-17 | Fields and formulas (R2) | Column list; Lead view only | Admin; Lead | UJ-12 | 072, 060 | SCR-17, -lead |
| SCR-18 | Formula editor (R2) | Edit with live check and preview | Admin | UJ-12 | 073, 022, 023, 080 | SCR-18 |
| SCR-19 | Insert field (R2) | Guided insert with letter preview | Admin | UJ-12 | 074, 075 | SCR-19 |
| SCR-20 | Delete field (R2) | Blocked list or confirm with password | Admin | UJ-12 | 076, 080 | SCR-20 |
| SCR-21 | Checkpoints and versions (R2) | Save, list, revert | Admin | UJ-12 | 077, 078, 080 | SCR-21 |
| SCR-22 | E-mail alert previews (R2) | The three messages | Engineer receives | UJ-13 | 081 to 084 | SCR-22 |
| SCR-23 | Account | Profile and change password | all | UJ-14 | 002 | SCR-23 |
| SCR-24 | About | Version and copyright | all | | 010 | SCR-24 |
| SCR-25 | Navigation and account menu | Role matrix, drawer, menu | all | UJ-01 | 007, 009 | SCR-25, -phone |
| SCR-26 | System pages | No access, not found, error, session ended | all | UJ-01 | 007, 088 | SCR-26 |

---

## 6. Screen specifications

### 6.0 Patterns shared by every screen (stated once)

**Page frame.** Review bar (review only) → skip link → top bar (menu button below 1024 px, logo and name, bell, account menu) → side menu → `main` with breadcrumb, page title (the only `h1`), content. Sticky action bar at the bottom on workspace screens.

**States.** Every data screen defines these; a screen below lists only what differs.

| State | Rule |
|-------|------|
| Loading | Skeleton rows shaped like the content, shown after 300 ms; container `aria-busy="true"`; a visually hidden "Loading …" in a polite live region. No page-level spinner. Buttons that start work show a spinner icon, the verb in the present tense ("Approving") and are disabled |
| Empty | Icon, one-line title, one sentence saying what is missing and what to do, one action if there is one |
| No match | Same pattern, title "No … matches …", action "Clear filters" |
| Error (load) | Icon, "We could not load …", "Check your connection and try again. Nothing was changed.", "Try again" button; focus moves to the heading |
| Error (action) | Inline notice with icon, thick left border and text (role `alert`); the form keeps what was typed |
| Success | Notice (role `status`) or a toast that is also announced in a live region; toasts last 5 seconds and never carry the only copy of an instruction |
| Disabled | Grey fill, grey text, `not-allowed`; always paired with visible text or `aria-describedby` that says why |
| Permission denied | SCR-26 "You do not have access to this page"; the server also refuses the request. The wording never says a hidden thing exists |

**Forms.** One label above each field; hint below in label size; errors below in error red with an alert icon. Validation timing: **format rules on blur** (number format, e-mail), **required rules on submit or Calculate**, never on first keystroke. On submit with errors, an error summary (`role="alert"`) lists each problem as a link to its field and focus moves to the summary; fields get `aria-invalid="true"` and `aria-describedby` pointing at their message. Typed values are kept. Autocomplete attributes are set on sign-in and password fields; paste is never blocked (WCAG 3.3.8).

**Dialogs.** Modal; focus moves to the first field or the safe button; focus is trapped; Escape closes (except while saving); focus returns to the trigger. Destructive and password dialogs use `alertdialog`. The default focus is the **safe** choice. Buttons are verbs ("Delete 3 parts", "Keep it"), never "OK".

**Tables and cards.** Tables have a caption (visually hidden), `th scope`, and scroll horizontally only inside their container. On phones, lists of records become cards; the card holds the same facts and the same actions.

**Money and numbers.** INR as "₹ 1,23,456.78" (Indian grouping), USD "$", EUR "€"; two decimals; right-aligned in tables; "—" for a divide by zero (the export cell is empty). Times are IST, written "06 Nov 2026, 17:00 IST".

**Column letters.** Shown as a dark tag (inputs) or a grey tag (outputs and auto fields) with a visually hidden "Excel column".

---

### SCR-00 Design system
**Purpose.** The single reference for tokens, brand, components and state patterns; the review artefact for FR-086 and NFR-020.
**Wireframe.**
```
+--------------------------------------------------------------+
| top bar (logo, ACCUCUT LASERS, bell, account)                |
| 01 Brand · 02 Colour tokens (with contrast ratios)           |
| 03 Type scale | 04 Spacing | 05 Buttons | 06 Form controls   |
| 07 Badges and notices | 08 Node icons | 09 States | 10 Map   |
+--------------------------------------------------------------+
```
**Components.** Card, Badge, Button, Input, Select, Alert, Skeleton, Table. **States.** Static page; no data states. **Responsive.** Cards stack; swatch grid reflows. **Accessibility.** Headings in order, every swatch states its ratio in text, all contrast pairs listed in section 7.

### SCR-01 Sign in
**Wireframe.**
```
+------------------------------------------+
| [logo] ACCUCUT LASERS  Quotation Portal  |
|                                          |
|        Sign in                           |
|        [notice: error / locked / ended]  |
|        +----------------------------+    |
|        | E-mail    [______________] |    |
|        | Password  [__________][eye]|    |
|        | [        Sign in         ] |    |
|        | Forgot your password?      |    |
|        +----------------------------+    |
|  © Accucut Lasers Pvt Ltd. All rights…   |
+------------------------------------------+
```
**Components.** Card, Input, Label, Button, Alert.
**Content.** Title "Sign in"; sub "Use the e-mail and password you were given."; button "Sign in" (loading "Signing in"). Link "Forgot your password?" (R2); in Release 1 plain text "Forgot your password? Ask the Admin to reset it."
**States.** Default · Loading (button disabled, spinner) · Error "E-mail or password is not correct. Check both and try again." (same text for wrong e-mail, wrong password and a deactivated account) · Locked "Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password." · Session ended "Your session ended. Sign in again to continue where you left off." · Permission denied: not applicable.
**Form fields.**

| Field | Type | Required | Validation | Error message |
|-------|------|----------|------------|---------------|
| E-mail | email, `autocomplete=username` | Yes | Present; looks like an address (on blur) | "Enter your e-mail address." / "Enter an e-mail address like name@company.com." |
| Password | password with show/hide, `autocomplete=current-password` | Yes | Present | "Enter your password." |

**Interactions.** Enter submits. Show/hide is a toggle button (`aria-pressed`, name changes). Failed attempt keeps the e-mail, clears nothing else, moves focus to the notice. **Responsive.** Card is full width below 480 px; 44 px controls. **Accessibility.** Notice is `role="alert"`; the page title is the `h1`; the logo has alt text "AccuCut logo"; a decorative duplicate is never used. Page is indexable with generic text (PRD FR-089); see OQ-UX-03.

### SCR-02 Forgot and reset password (R2)
Request (e-mail, "Send reset link") → "Check your e-mail. If that address is registered, a reset link is on its way. It can be used once." (always the same) → link opens New password and Repeat (min 10 characters, proposed; OQ-UX-05) → "Your password has been changed." Link used or expired: "This link has already been used or has expired. Ask for a new link." Errors: "The two passwords do not match." Accessibility as SCR-01.

### SCR-03 Task queue (Lead, Admin) and My tasks (Engineer)
**Wireframe (desktop).**
```
+--------+---------------------------------------------------------+
| menu   | Task queue                           [+ Assign task]    |
|        | +-----------------------------------------------------+ |
|        | | Open (5) | Closed (1) | ⏱ Overdue (2)                | |
|        | | [search] [Engineer v] [Customer v] [from] [to]       | |
|        | | chip: Assigned by me (x)    ↓ sorted by deadline     | |
|        | | Task | Engineer | Customer | Folder | Deadline IST | Status | By | ✎ |
|        | | ▌Q-2026-0311 … ⏱ Overdue by 1 d 18 h (amber bar)      | |
|        | +-----------------------------------------------------+ |
+--------+---------------------------------------------------------+
```
**Components.** Tabs, Table (Card list on phones), Input, Select, Badge, Button, Tooltip (folder path), Alert.
**Content.** Tabs "Open", "Closed", "Overdue" with counts. Sort note "Sorted by deadline, earliest first. Overdue tasks stay in Open as well." Customer shows "Not chosen yet" until the Engineer picks one (the assigner does not choose it). Overdue marker: clock icon, "Overdue by 1 d 18 h", amber left bar, tinted row; the three cues appear together (FR-036).
**States.** Default per tab · Loading skeleton · Empty (Lead "No open tasks. Assign a task to an Engineer and it appears here." + Assign task; Engineer "Nothing assigned to you right now. When a Lead assigns you a task it appears here, with its folder and deadline.") · No match · Error · Overdue tab adds a summary notice. Permission denied: an Engineer sees only own tasks; another's task address gives SCR-26.
**Differences by role.** Engineer: no Engineer or Customer column or filters, no Assign button, no row edit; "Assigned by" shown. Lead: opens with the filter chip "Assigned by me" (removable, FR-035, R1+). Admin: no default filter.
**Filters (R1+, FR-039).** Search by task ID or title; Engineer; Customer; deadline from and to. Filters are in the address.
**Interactions.** Row action "Reassign or change deadline" (R2) opens SCR-04 in edit mode. "Copy path" copies and announces "Path copied to the clipboard." The bell and the "Overdue" tab are the same destination.
**Responsive.** 360: one card per task (ID, status, title, due, overdue line, person, Copy path, Open); tabs share the row width. 768: table keeping Task, Engineer, Deadline, Status (Customer, Folder and Assigned by hide). 1280: full table.
**Accessibility.** Tabs use `role=tablist/tab/tabpanel`, arrow keys move between tabs; rows are not clickable as a whole (the ID is the link) so keyboard and screen readers see one link per row; overdue is also in text; count badges have text.

### SCR-04 Assign task; reassign (R2)
**Wireframe.**
```
Task queue / Assign task
Assign task
[error summary]
+-------------------------------------+  +-- What happens next --+
| Engineer      [Choose an Engineer v]|  | 1 Empty estimate …     |
| Network folder path [\\server\share ]|  | 2 Open queue …         |
| Deadline date [__]  time [__] IST    |  | 3 Customer chosen by   |
| Title (optional) / Notes (optional)  |  |   the Engineer …       |
| [Cancel]                [Assign task]|  | Folder link note       |
+-------------------------------------+  +------------------------+
```
**Components.** Card, Select, Input, Calendar and time input, Textarea, Button, Alert, Tooltip.
**Form fields.**

| Field | Type | Required | Validation | Error message |
|-------|------|----------|------------|---------------|
| Engineer | select of active Engineers | Yes | one chosen | "Choose an Engineer." |
| Network folder path | text | Yes | starts with `\\` (UNC) | "Enter the network folder path. It starts with two backslashes, like \\server\share\RFQ-123." |
| Deadline date | date | Yes | on or after today (IST) | "Choose a deadline later than now." |
| Deadline time | time with IST addon | Yes | with the date, later than now | "Choose a deadline later than now." |
| Title | text, up to 120 | No | length (proposed) | "Keep the title under 120 characters." |
| Notes | textarea, up to 1,000 | No | length (proposed) | "Keep the notes under 1,000 characters." |

**States.** Default · Validation errors (summary with links) · Submitting ("Assigning") · Success ("Task Q-2026-0324 assigned to Arjun Rao." + links) · Alerts OFF notice ("E-mail alerts are OFF. Arjun Rao will not be e-mailed about this task. It still appears in their queue.") · Edit mode (R2): only Engineer and deadline are editable, folder, title and notes show "Locked", notice "Changes are logged. The log records your name, the time, and the old and new values." Permission denied: Engineers get SCR-26.
**Interactions.** The folder path is shown as a link plus **Copy path** everywhere it appears; the tooltip text is "Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer." Validation on submit; the date-time is checked again on the server.
**Responsive.** The side card moves below the form on phones. **Accessibility.** Date and time have visible labels and the "IST" addon is read with the field; the tooltip is also visible text, not hover-only.

### SCR-05 Estimate workspace (Engineer)
**Wireframe (desktop, 1280).**
```
+------+-------------------------------------------------------------------+
| menu | Q-2026-0318 Draft                          [Due 06 Nov 17:00 IST]  |
|      | Task folder \\fileserver\rfq\… [Copy path]  note on blocked links  |
|      | [alerts: Calculate blocked / Submitted …]                          |
|      | Customer [Brightwater Controls v]  note                            |
|      | +-Parts tree--+  1.1 · Base frame      [+Sub-part][+Beside][↑][↓][Delete]
|      | | ✓ 1 …       |  ▬▬▬▬ 24 of 25 inputs complete                      |
|      | | ✓ 1.1  ◄    |  [01][02][03][04][05][06][07][08]  section strip   |
|      | |   1.1.1 …   |  +-01 Part details-+ +-02 Material--+ +-03 Cutting+ |
|      | | ◐ 1.3       |  | A Sl. No  auto  | | E  F  J K L N | | P  Q    | |
|      | | △ 2.1 (miss)|  +-----------------+ +---------------+ +---------+ |
|      | | [+ New item]|  … sections 04 to 08 …        [reserved region →]  |
|      | +--handle-----+                                                     |
|      | ----------------------------------------------------------------- |
|      | Last saved 10:41 IST. Auto-save every 30 s   [Save draft][Calculate]|
+------+-------------------------------------------------------------------+
```
**Components.** Card, Select, Input, InputGroup (unit addon), Label, Badge (column letter), Popover with checkboxes (surface treatments), Textarea, Progress, Resizable panel, Sheet (tree on phones), Alert, AlertDialog, Button.
**Layout rules.**
- Three tracks: **tree** (288 px, resizable 240 to 400 by mouse or arrow keys), **form** (flexible), **reserved region** (0 px now; 340 px when a drawing viewer is added). The form's section cards sit in an auto-fit grid with columns of at least 232 px, so a 340 px region makes three columns become two with no redesign. The review toggle "Show reserved drawing region" demonstrates this. This satisfies FR-087 and NFR-023 at 1024 px and wider (UD-4).
- Section order is SPEC §7.1: 01 Part details (A to D, G, H), 02 Material and dimensions (E, F, J to L, N), 03 Cutting (P, Q), 04 Bending (R), 05 Fasteners (S to U), 06 Welding, drilling and tapping (V to Y), 07 Surface treatment (Z to AG), 08 Other costs and remarks (AJ, AP, AU, BM). Every card header: section number, name, column range tag, "n of m" complete.
- The section strip is a sticky row of 8 jump links with a check, a triangle (missing), or nothing.
- Each section header has a free area to the right of the range tag (reserved, UD-5).
- Cards per row follow the width: 1 column on phones, 2 on tablets, up to 3 on desktop (SPEC §7.2). At 1280 px with the tree, three columns fit; at 1024 px, two.
**Content and microcopy.** Intro line "Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals." Customer hint "Choose this first"; helper "The customer's rates are used in every calculation for this estimate. You never see them. Changing the customer later asks you to confirm." Hints under fields as in the screen (Fasteners: "Type "None" if the part has no fasteners."; costs: "Enter 0 if there is none."; Remarks: "Write "None" if there is nothing to add. Enter moves to the next field; Shift+Enter starts a new line.").
**Fields (inputs only; none of these is a cost the Engineer can see computed).**

| Field (letter) | Type | Required | Validation | Error message |
|----------------|------|----------|------------|---------------|
| Part No. (B), Description (D) | text | On Calculate | present | "Enter this value. Use 0 if the part does not need it." for numbers; "Enter this value." for text |
| Part Model (C) | image: paste, drop, choose; camera or gallery on phones | On Calculate | PNG, JPG, GIF or WebP by content; under 200 KB | "\"cabinet-photo.png\" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture." / "Only PNG, JPG, GIF or WebP pictures are accepted." |
| Treatment / Color (G) | select; "Other" reveals text; "Not applicable" listed | On Calculate | one chosen; text if Other | "Choose a treatment or colour." / "Type the treatment or colour." |
| QTY per Assy (H) | number | On Calculate | 0 or more, 2 decimals | "Enter 0 or more, with up to 2 decimals." |
| Material in Drawing (E) | select; "Not applicable" listed | On Calculate | one chosen | "Choose a material." |
| Material Considered (F) | auto, read-only, shaded | n/a | from E | n/a |
| Length, Width, Thickness (J, K, L), Part Weight (N) | number, unit addon | On Calculate | as H | as H |
| Cutting Time, Cutting Length (P, Q); No. of Bend (R) | number | On Calculate | as H | as H |
| Fasteners (S) | text, default "None" | On Calculate | present | "Enter this value. Type None if there are no fasteners." |
| Fasteners Qty (T), Cost (U) | number, **shown only when S is not "None" or blank**; otherwise hidden, not required, stored 0 | When shown | as H | as H |
| Weld, Drilling, Tapping, CSK (V to Y) | number | On Calculate | as H | as H |
| Surface treatments (Z to AG) | one multi-select; selected = 1, not selected = 0; none allowed | No | | |
| Machining Cost (AP), Plating Cost (AU), Tool Cost (BM) | number, ₹ addon | On Calculate | as H | as H |
| Remarks (AJ) | textarea | On Calculate | present ("None" is fine) | "Enter this value. Write None if there is nothing to add." |

Material Rate / Kg (I), the Engineer's view of costs, any preview, any total: **never rendered** for Engineers.
**States.**

| State | Behaviour |
|-------|-----------|
| Default | Part 1.1 open, 24 of 25 complete; no errors shown before Calculate |
| Saved | Notice "Draft saved at 10:42 IST."; auto-save line updates |
| Calculate blocked | Summary `alert`: "Nothing was submitted. 3 parts have missing inputs." with each part and its fields as links; triangle icons in the tree; sections and fields with errors turn error red with icon and text; a field with a wrong format shows the format message |
| Picture too large | Inline message in section 01 (see table) |
| No customer | Notice "Choose the customer to start."; the form is disabled until chosen |
| Change customer | AlertDialog: "Change the customer? … Nothing you typed is lost. The new customer's rates apply the next time the estimate is calculated." Buttons "Keep Brightwater Controls", "Change customer" |
| Unsaved changes | AlertDialog "Leave without saving?" with "Leave without saving" and "Save draft and leave" |
| Delete part | AlertDialog names the count: "This also deletes its 2 sub-parts … Delete 3 parts" |
| Loading | Skeleton cards |
| Submitted | Notice with the single message "Cost will be calculated based on the input fields and sent for review/approval."; badge Submitted; inputs read-only; action bar shows a disabled "Submitted"; no number anywhere |
| Approved | "Approved and locked." read-only; **no price shown** |
| Permission denied | Another Engineer's task: SCR-26 |

**Interactions.**
- **Enter** moves to the next visible, editable field in order; in Remarks, Enter moves on and Shift+Enter inserts a line; on the last field Enter moves focus to **Calculate** (it never submits). Buttons and links keep their normal Enter behaviour. Mobile keyboards show a "next" key.
- Tree: add sub-part, add part beside, add item, move up, move down, delete. Reordering is by buttons (and arrow keys with Alt) so no dragging is required. After each change Sl. No renumbers and the change is announced ("Part renumbered to 1.2").
- Completion: "24 of 25 inputs complete" (progress bar with text); per-section counts; per-node icons: check, half circle, empty circle, triangle.
- Auto-save every 30 seconds (R1+, FR-054); Save draft is always available; leaving with unsaved changes asks first.
- Calculate checks every node, not only this part.
- Copying data between parts is **not offered** (UD-3).
**Responsive.** 360: one column of cards; "Parts tree" button (shows the current node) opens the tree as a left drawer (`Sheet`) with a scrim; the sticky action bar stays; the stepper scrolls inside its own strip; Part Model offers camera or gallery. 768: tree is a collapsible left panel (240 px, "Parts tree" button toggles); 2 columns. 1024: tree persistent; 2 columns. 1280: 3 columns; the reserved region adds a track on the right.
**Accessibility.** Tree is `role="tree"` with `treeitem`, `aria-level`, `aria-selected`; arrow keys move, Enter opens; each node's missing-data state is text for screen readers. Every input has a visible label and its letter ("Excel column J" read first by screen readers). Section cards are labelled regions. Errors use icon, thick border and text. The sticky stepper and action bar do not hide a focused field (scroll padding, WCAG 2.4.11). The progress bar has a text equivalent. Dialogs follow 6.0. Part Model is operable without a mouse (choose a file button).

### SCR-06 Estimate review (Lead, Admin)
**Wireframe.**
```
Task queue / Q-2026-0318
Estimate Q-2026-0318  [Submitted]      [Due …] [Open folder] [Copy path]
[stale / not calculated / approved notice]
+--BL Total Unit Production Price--+ +--BN BL / total Tool Cost--+ +--BO Approved Quote Price--+
| ₹ 10,302.91                      | | 2.10                      | | Not set yet               |
+----------------------------------+ +---------------------------+ +---------------------------+
▸ How the total is built (item × quantity × sum of BG)
+-Parts tree (Σ figures)+  1.4 · Top cover                          [View cost details]
| 1  Σ 5,061.72          |  +-SCREEN FIGURE Σ-----------+ +-EXCEL ROW 1.4 (own row)-+
| 1.4  Σ 709.97  ◄       |  | ₹ 709.97 = 309.19 + 400.78 | | ₹ 309.19                |
| 1.4.1  400.78          |  +----------------------------+ +-------------------------+
|                        |  Inputs: stepper + section cards (editable until locked)
-----------------------------------------------------------------------------
Calculated 05 Nov 10:42 IST · config v9     [Download .xlsx][Recalculate][Approve and lock]
```
**Components.** Card (stat), Badge, Tree, Details (how the total is built), Alert, Button, plus SCR-05's form.
**G2 condition 6 (parent figure against export row).** Everywhere a parent's figure appears on screen it is **labelled and paired**:
1. In the tree, a parent's figure is prefixed with the Σ tag and read as "Sum including parts below"; a legend line says "Σ = this row plus everything below it, as shown on screen. The Excel file holds each row's own value only."
2. In the node header, a parent shows two boxes side by side: **"Screen figure: this row and everything below"** (dark left bar, Σ tag, with the sum written out: ₹ 309.19 (row 1.4) + ₹ 400.78 (row 1.4.1)) and **"Excel row 1.4: this row only"** (green left bar, download icon). A top-level item adds the quantity line: "Item quantity 2 then counts this 2 times: ₹ 10,123.45 in the estimate total."
3. A part with nothing below shows one box: "On screen and in the Excel row" (the two figures are the same).
4. SCR-07 repeats the pair above the stages; SCR-10 shows both figures side by side for every row.
The pairing never relies on colour: each box has its own words and icon.
**Content.** Tiles show the plain name with the letter tag (BL, BN, BO) and "File cell BL2, BN2, BO2". BN when Tool Cost totals 0: "—" with "No Tool Cost entered on any part, so there is nothing to divide by. File cell BN2 is left empty." BO before approval: "Not set yet".
**States.**

| State | Behaviour |
|-------|-----------|
| Default (Submitted) | Tiles, tree, node; primary button "Approve and lock" |
| Inputs changed | Notice "Inputs changed after the last calculation. The totals below are from 10:42 IST and no longer match the inputs. Recalculate before you approve."; primary button becomes **Recalculate**; Approve is disabled and says why (OQ-UX-06) |
| Not calculated | Info "The Engineer has not calculated this estimate yet…"; tiles show "Not calculated"; Approve disabled |
| No Tool Cost | BN shows "—" |
| Approved | Notice with approver and time; inputs read-only; BO tile shows the price; **Unlock** replaces Approve; "Locked. Values stay as approved even if rates change later." |
| Loading | Tile skeletons while recalculating |
| Error | "We could not calculate this estimate. Nothing was changed. Try again; … give the Admin this reference: req-7f3a91." |
| Permission denied | Engineers reach SCR-05 at this address, never this screen |

**Interactions.** Recalculate runs on the server (up to 2 s for 500 nodes, NFR-008) and refreshes totals; "View cost details" opens SCR-07; Download opens SCR-10; the bar line "Calculated … configuration version 9" records FR-031.
**Responsive.** 360: tiles stack; tree is a drawer; the pair of boxes stacks; the action bar wraps with full-width buttons. 768: tree collapsible. 1280: as the wireframe.
**Accessibility.** Tiles are a labelled group; each total is text in an `h`-free structure with its tag; Σ has a text equivalent; stale and approved notices are `role="status"`; the disabled Approve has `aria-describedby` with the reason.

### SCR-07 Cost details
**Purpose.** FR-058, 059, 026: all calculated fields for one row in six stages, each with its formula next to the value.
**Layout.** Row header and the pair of figures (see SCR-06), then six `details` panels: **1 Weights and areas** (M, O, AH, AI) · **2 Material cost** (I shown as reference, AK) · **3 Process costs** (Cutting AL; Bending AM; Welding, drilling, tapping AN, AO; Surface treatment AQ to AX; entered directly AP, AU; AY Total) · **4 Sub total** (AZ, BA, BB) · **5 Rejection, overheads and logistics** (BC, BD, BE, BF) · **6 Pricing** (BG highlighted dark, BH, BI, BJ, BK).
Each line: column tag, name, formula in letters (mono), the same formula with values (muted mono), value right-aligned.
**Rules.** Unselected treatment lines (AQ to AX; the seven that depend on a flag) are **hidden**, with a line "6 treatment lines are hidden because they are not selected for this part. They are still calculated and exported as 0." Divide by zero shows "—". Percent rates are shown as typed (11%).
**States.** Default · Loading · Error. **Responsive.** Desktop: beside the inputs as a side panel at 1280 and wider, a full column below that. Tablet: accordion, all open. Phone: accordion, only stage 1 open, formulas wrap. **Accessibility.** `details/summary` are keyboard operable and announce expanded or collapsed; formulas are text not images; the total of each stage is in the summary.

### SCR-08 Approve and lock (dialog)
Fields: **Approved Quote Price (BO)**, ₹, pre-filled with BL, editable. Validation "Enter a price in rupees, 0 or more, with up to 2 decimals." States: Default (info "If you change the price, the difference is recorded as an override.") · Price changed (warn "This price is ₹ 302.91 lower than the calculated total. A different price is recorded as an override with your name, the time, the calculated total and the price you set.") · Invalid · Saving ("Approving"). Buttons "Cancel", "Approve and lock". After success: inputs read-only, task to Closed, audit entry (approval and, if different, override). No reason field (OQ-UX-02). Dialog is `dialog`, focus to the price field.

### SCR-09 Unlock (dialog)
Field: **Reason for unlocking** (required textarea): "Enter a reason. It is kept in the audit log." Notices: configuration changed (versions 7 → 9) and rates changed (counts), or "Nothing has changed … since approval." Text states that recalculating after unlock uses current values. Buttons "Keep it locked", "Unlock". States: Default · Changed · Reason missing · Saving. Effect: estimate to Draft; task reopens in the Engineer's Open queue.

### SCR-10 Excel export
**Layout.** File card (file name, row count, A to BO, **Download .xlsx**), then a full-width table **"Screen figures against the file"**: Sl. No, Part, Qty (H), **In the file: BG, this row only**, **On screen: this row and below** (Σ on parents), then a reconciliation box that writes out each item (quantity × sum of BG) and BL2 = the screen total, and a checklist of what the file holds, plus BL2, BN2, BO2.
**Content.** File name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx` (OQ-UX-08). Lead and Admin at any status; Engineers get SCR-26.
**States.** Default · Building ("Building the file. 10 parts, 1 picture. This usually takes a few seconds.", button disabled) · Error with reference · Empty ("Nothing to export yet") · Approved (BO2 shows the price). **Responsive.** The table scrolls inside its box; on phones the checklist stacks. **Accessibility.** The table has a caption and a visually hidden "Sum including parts below" on parent figures; progress is a polite live message. Per-item totals as in the sample are not shown (Q-31).

### SCR-11 Process master
Table: Rate name · Unit · Default value · Used in (letters) · Customers with own value · actions. Add rate dialog fields: **Rate name** (unique; "Enter a name." / "A rate with this name already exists."), **Unit**, **Default value** (number, 0 or more, 2 decimals: "Enter a number, 0 or more, with up to 2 decimals."); hint "Names ending in % are typed as whole percentages: 12 means 12%." States: Default · Saved · Add · **Customers differ** (R1+: "17 customers had 0.47 and now have 0.52. 3 customers have a different value." per-customer Apply or Keep radios, "Keep all 3", "Apply to all 3", "Save choices") · **Delete blocked** ("Cutting-Rate-per-Sec cannot be deleted while a formula uses it" with the formula list and a link) · Loading · No match · Error. Phone: cards. Units are inferred (OQ-UX-07).

### SCR-12 Customer master
List (name, phone, e-mail, rates that differ) → edit page: Details (name required and unique: "Enter the customer name." / "A customer with this name already exists."; phone, e-mail, address optional, e-mail format "Enter an e-mail address like name@company.com.") and a rates table (default, this customer, "Differs from default" tag). **Reset to defaults** opens an AlertDialog naming the rates that will be replaced. New customer starts with all defaults. States: List · Edit · New · Reset dialog · Loading · Empty · No match · Error. Percent rates use whole numbers.

### SCR-13 Materials, exchange rates, treatment list
Tabs. **Materials:** Material in Drawing (unique), Material Considered, Price per kg, Specific gravity, Scrap rate per kg; **"Not applicable"** row is system-created, locked (lock icon and the word "Locked"; tooltip text also visible), all rates 0 (Q-33). Duplicate: "A material with this name already exists. Names must be unique." **Exchange rates:** 1 USD in ₹, 1 EUR in ₹, "Last updated by Meera Iyer, 02 Nov 2026, 15:10 IST." **Treatment / Color:** rename, delete, add; "Not applicable" and "Other" are locked ("Always offered; the Engineer types the text"). Rates are never sent to Engineers.

### SCR-14 Users
Table (name, e-mail, role, status, actions: edit, reset password, deactivate). Add user: name, e-mail, role, first password (min 10, proposed). A second Admin: "There is already an active Admin. Only one Admin can be active." with the Admin named in the page notice. Own row cannot be deactivated (disabled with an accessible name that says why). Reset password dialog; deactivate AlertDialog ("can no longer sign in. Their tasks and estimates stay as they are"). **Hand over Admin role** (R2) in one step with a user choice and a warning that the caller becomes a Lead and is signed out. States: Default · Add · Second Admin refused · Reset · Deactivate · Hand over · Loading · Error.

### SCR-15 Settings (R2)
Switch **E-mail alerts: ON** (role `switch`, state written in words), sender name, sender e-mail, **Send test e-mail** (to the Admin's own address, OQ-UX-09). Mail server credentials are not here ("set on the server by Accucut IT"). States: ON · OFF · Test sent · Test failed ("The mail server did not answer…") · Save failed · Loading.

### SCR-16 Audit log and change history
Filters: Who, Event, From, To. Columns: When (IST), Who, Event, Object, Before → after. No edit or delete control anywhere. Events: Approval, Unlock, Price override, Master data edit (R1); Formula edit, Field insert or delete, Checkpoint revert (R2, FR-079). States: All · Configuration · Empty ("No entries match") · Loading · Error. Phone: cards.

### SCR-17 Fields and formulas (R2)
Table in column order: Column · Field · Section or stage · **Kind** (Input, Auto, Output) · Formula · actions (Admin: edit formula, insert after, delete). **Lead view:** same table with no actions and a banner "View only. Formulas are shown so you can check the arithmetic." The side menu marks it "View only". States: Default · Loading · Error. Search by letter, name or formula; filter by kind. Phone: cards of key rows with search.

### SCR-18 Formula editor (R2)
Monospace editor, suggestion list (letters with field names, rate names), live check (300 ms pause) in a polite live region, preview against a chosen sample row, "Used by" list. Messages: valid "The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY." · unknown `"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.` · syntax "The formula ends too soon. A number or name is missing after "+" (position 29)." · loop "This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references." Save is disabled until valid; saving opens the password step: "Confirm with your password"; wrong: "That password is not correct. Try again." Success: "Formula saved as configuration version 10."

### SCR-19 Insert field (R2)
Three steps: 1 type (Input, Output, Input and its cost column); 2 details (label, type, default, **insert after column**, group; for the cost column: label, position, formula); 3 preview of letter changes ("AY → BA" and so on, including the product cells BL2 → BN2, BO2 → BQ2) and **Insert 2 fields**. Notices: new inputs are mandatory and visible to Engineers; new outputs are hidden from them and join a total only when that total's formula is edited; approved estimates keep their layout. Errors: "Enter a label."; unknown name in the formula as SCR-18. No password step (FR-080 lists only save, delete and revert).

### SCR-20 Delete field (R2)
Dialog over the list. **Blocked:** "Cannot delete AL Cutting Cost yet. 1 formula uses this field." with the referencing formulas and an Edit link. **Confirm:** "No formula uses this field. Deleting it moves every later field one letter to the left." + password; "Delete field" (danger). Wrong password: message in the dialog.

### SCR-21 Checkpoints and versions (R2)
Current version card (version number, saved by and at, what uses it), **Save as a checkpoint** (name required: "Enter a name for this checkpoint."), checkpoint table (name, version, saved, by, **Revert**). Revert dialog: what happens (new version, estimate data untouched, approved estimates keep theirs, can be undone), password. After revert a success notice offers **Revert to the version from before** (undo). States: Default · Saved · Name missing · Revert · Wrong password · Reverted · Empty · Loading · Error.

### SCR-22 E-mail alert previews (R2)
Three plain, branded messages: **Task assigned** (To Engineer, Cc assigner; task, folder, deadline IST, "Open the task"), **Task overdue** (same recipients; "This task is now overdue. It was due on …"), **Daily digest** at 11:00 IST (To Engineer with overdue tasks, Cc the Leads who assigned them; table of tasks and "Overdue by"). Alerts OFF: nothing is sent. No cost, rate or customer price in any message. Each e-mail also has a plain-text version with the same lines; links are full addresses.

### SCR-23 Account
Profile (name, e-mail, role: read-only) and Change password: Current, New (min 10, proposed), Repeat. Errors: "Your current password is not correct." / "The new password must be at least 10 characters." / "The two new passwords do not match." Success: "Your password has been changed. Use the new one the next time you sign in."

### SCR-24 About
Logo, "ACCUCUT LASERS · Quotation Portal", one description sentence (OQ-UX-10), **"Version No: 1.0"**, **"© Accucut Lasers Pvt Ltd. All rights reserved."** exactly (FR-010).

### SCR-25 Navigation and account menu
Table of what each role sees (section 4 as a matrix); how the menu behaves at each size; the open account menu. Phone frame shows the drawer.

### SCR-26 System pages
No access (403), not found (404), server error (reference `req-…`, never technical detail), session ended. Each has one clear action.

---

## 7. Design tokens and system usage

Source of truth: `docs/03-ux/screens/screens.css` (`:root`). The names follow the client sample so nothing is renamed; values change for "Red Leads". In Tailwind and shadcn these become the theme variables of the same names (`--primary`, `--ink`, and so on). No token is hard-coded elsewhere (NFR-020).

### 7.1 Type (four sizes, as the sample)
| Role | Size / line | Weight | Used for |
|------|-------------|--------|----------|
| Heading | 28 / 36 (24 / 32 on phones) | 600 | Page title, key figures |
| Subheading | 18 / 26 | 600 | Card and section titles; the brand name (serif, 700) |
| Body | 14 / 22 | 400 | Text, inputs, buttons |
| Label | 12 / 16 | 500 or 600 | Field labels, hints, tags, table heads, column letters (mono) |

Fonts: IBM Plex Sans, IBM Plex Mono, and Tinos Bold for the company name, **self-hosted** from `screens/fonts/` (open licence, copies of the licences included). This answers analyst finding F-19 (the sample loaded fonts from an external service). Fallbacks: system UI sans, Times New Roman (Tinos is metric-compatible with it).

### 7.2 Spacing, shape, controls
4-point scale: 4, 8, 12, 16, 24, 32, 48. Radius 4, 8, 12. **One control height: 44 px** (above WCAG 2.5.8's 24 px and PRD NFR-017's 44 px). One button: 44 px, 16 px side padding, 14 / 600; four variants (primary red, secondary outline, ghost, danger) and an icon-only square. Row-level icon buttons in dense tables are 36 px.

### 7.3 Colour ("Red Leads") and contrast
| Token | Hex | Use | Contrast |
|-------|-----|-----|----------|
| `--primary` | #DE3030 | Main buttons, active marker, brand name, progress | White text on it **4.59:1** (AA normal); on white 4.59:1; on graphite 3.86:1 (UI 3:1) |
| `--primary-hover` | #BF2626 | Hover and pressed | White on it 5.97:1 |
| `--primary-ink` | #B52424 | Red as text or link | 6.48:1 on white; 5.67:1 on its tint |
| `--nav` / `--ink` | #17181C | Side menu, text, focus ring | 17.74:1 with white |
| `--ink-2` | #4A4D57 | Secondary text | 8.43:1 on white |
| `--ink-3` | #5E616C | Hints, placeholders (lowest grey) | 6.17:1 on white, 5.33:1 on the shaded fill |
| `--border-strong` | #85888F | Control edges | 3.55:1 on white, 3.23:1 on the page grey |
| `--nav-ink`, `--nav-muted` | #C9CBD2, #9A9DA8 | Menu text, menu group labels | 10.94:1, 6.56:1 on graphite |
| `--accent` / `--accent-ink` | #B45309 / #8A3F05 | Overdue and attention (amber, never red) | 5.02:1 on white; 6.92:1 on its tint |
| `--success` | #157F3B | Approved, complete | 5.08:1 on white |
| `--danger` | #B3261E | Errors and delete only | 6.54:1 on white; 5.74:1 on its tint |
| `--info-ink` | #333945 | Neutral notices, Submitted | 9.98:1 on its tint |

The brand red passes AA for normal text only narrowly (4.59:1), so it is used for **fills with white text, large text and non-text markers**, and the darker `--primary-ink` is used wherever red is text or a link. Overdue is amber and errors are the darker error red, so red never carries two meanings at once (finding F-18). Ratios were computed from the hex values with the WCAG formula.

### 7.4 Patterns added to the sample
Column-letter tag; section card with number, range and count; stepper strip; Σ tag and the paired figure boxes; stage panels; skeleton; empty and error blocks; review bar (review only). No new colours were added for them.

### 7.5 shadcn/ui map
Listed on SCR-00 section 10: Button, Input, Label, Select, Checkbox, Switch, Tabs, Table, Card, Badge, Alert, Dialog, AlertDialog, Sheet, Popover with Command, Tooltip, Skeleton, Accordion, Progress, Resizable, Calendar, Sonner, Sidebar, Collapsible. The parts tree and the formula editor are custom components built on those primitives.

---

## 8. Accessibility requirements (WCAG 2.2 AA), project-wide

| Area | Rule |
|------|------|
| Structure | `lang="en-IN"`; one `h1` per page; landmarks (banner, navigation, main); a skip link first; page `title` unique per screen |
| Keyboard | Everything works without a mouse. Tab order follows reading order. Tabs and the tree use arrow keys; Escape closes drawers and dialogs; Enter moves to the next field on the guided form. No keyboard trap |
| Focus | Visible 3 px graphite ring with 2 px offset (white ring on the dark menu), contrast 17.7:1. Focus is never hidden by a sticky bar (scroll padding). Dialogs: focus in, trapped, returned. After a route change focus goes to the `h1`; after Calculate blocked, to the error summary |
| Labels and names | Every control has a visible label; icon-only buttons have an accessible name; column letters are read as "Excel column J" |
| Errors | Identified in text with an icon and a thick border, linked from a summary, `aria-invalid` and `aria-describedby`; instructions say how to fix; typed values are kept |
| Colour | Text 4.5:1, large text and UI 3:1 (section 7.3). Nothing is conveyed by colour alone: overdue, status, missing data and errors each have an icon and words |
| Target size | 44 px controls; the smallest interactive items (row icon buttons) are 36 px, above the 24 px minimum |
| Dragging | No feature needs dragging: the tree is reordered by buttons; the panel is resized with arrow keys |
| Redundant entry | The customer is chosen once; values are kept on error; nothing is asked twice in a flow |
| Authentication | Paste allowed; show or hide password; no puzzle or memory test; password manager attributes set |
| Dynamic content | Polite live region for saves, copy, formula checks and totals; `alert` for blocking errors; skeleton regions use `aria-busy` |
| Motion | `prefers-reduced-motion` turns off shimmer, spin and slide transitions |
| Zoom and reflow | Works at 200 percent and at 320 px width without horizontal page scroll; tables scroll inside their container only; text spacing changes do not clip |
| Tables | Caption, `th scope`, no layout tables |
| Language of content | English only (NFR-029) |
| SEO and sharing (FR-089) | Every page has a title, a meta description, and Open Graph title and description with generic wording and no cost, rate or customer data. Pages behind sign-in carry `noindex, nofollow` |

Verification is in section 12.

---

## 9. FR → screen coverage

Every user-facing FR (all 97) is mapped; entries marked "none" say why.

| FR | Screens | Journeys |
|----|---------|----------|
| FR-001 | SCR-01 | UJ-01 |
| FR-002 | SCR-23 | UJ-14 |
| FR-003 | SCR-02, SCR-01 (link) | UJ-01, 14 |
| FR-004 | SCR-14 | UJ-11 |
| FR-005 | SCR-14 (second Admin refused) | UJ-11 |
| FR-006 | SCR-14 (Hand over, R2) | UJ-11 |
| FR-007 | SCR-26, SCR-25 | UJ-01 |
| FR-008 | SCR-05, SCR-03-engineer, SCR-23, SCR-24, SCR-22 (no cost anywhere in Engineer screens) | UJ-04, 05 |
| FR-009 | SCR-25, top bar of every screen | UJ-01 |
| FR-010 | SCR-24 | |
| FR-011 | SCR-16, SCR-08, SCR-09 | UJ-06, 08, 12 |
| FR-012 | SCR-11 | UJ-10 |
| FR-013 | SCR-12 | UJ-10 |
| FR-014 | SCR-11 (Customers differ) | UJ-10 |
| FR-015 | SCR-13 | UJ-10 |
| FR-016 | SCR-13 | UJ-10 |
| FR-017 | SCR-13 | UJ-10 |
| FR-018 | SCR-13 (locked row), SCR-05 (choice) | UJ-04, 10 |
| FR-019 | SCR-15 | UJ-13 |
| FR-020 | SCR-17 (registry list) | UJ-12 |
| FR-021 | SCR-05 (letters on fields), SCR-17 | UJ-04, 12 |
| FR-022 | SCR-18 | UJ-12 |
| FR-023 | SCR-18 (unknown, syntax, loop messages) | UJ-12 |
| FR-024 | SCR-06, SCR-07 | UJ-06 |
| FR-025 | SCR-06 (BL, BN, BO tiles), SCR-10 | UJ-06, 09 |
| FR-026 | SCR-07, SCR-06 ("—") | UJ-06 |
| FR-027 | SCR-06 (Recalculate, 2 decimals), SCR-05 (no preview) | UJ-05, 07 |
| FR-028 | SCR-11, SCR-12 (whole percentages) | UJ-10 |
| FR-029 | SCR-06, SCR-07, SCR-10 (parent figure labelled against export row) | UJ-06, 09 |
| FR-030 | SCR-06 ("How the total is built"), SCR-10 (reconciliation) | UJ-06, 09 |
| FR-031 | SCR-06 (calculated at, configuration version), SCR-09 | UJ-07, 08 |
| FR-032 | SCR-04 | UJ-02 |
| FR-033 | SCR-03, SCR-04, SCR-05, SCR-06 (link and Copy path) | UJ-02, 03 |
| FR-034 | SCR-03 | UJ-03 |
| FR-035 | SCR-03 (Lead chip, R1+) | UJ-03 |
| FR-036 | SCR-03 | UJ-03, 13 |
| FR-037 | top bar (every screen), SCR-03 Overdue tab | UJ-13 |
| FR-038 | SCR-03 (Closed), SCR-08, SCR-09 | UJ-06, 08 |
| FR-039 | SCR-03 (filters, R1+) | UJ-02 |
| FR-040 | SCR-04 (edit), SCR-03 (row action) | UJ-02 |
| FR-041 | SCR-03, SCR-05, SCR-06, SCR-10 (IDs, file name) | UJ-02, 09 |
| FR-042 | SCR-05 (customer first, change confirmation) | UJ-04 |
| FR-043 | SCR-05 (tree actions) | UJ-04 |
| FR-044 | SCR-05 (renumbering, announced) | UJ-04 |
| FR-045 | SCR-05 | UJ-04 |
| FR-046 | SCR-05 (Enter to next field, works in the mock-up) | UJ-04 |
| FR-047 | SCR-05 (picture field, errors) | UJ-04 |
| FR-048 | SCR-05 (section 05 shows or hides T and U) | UJ-04 |
| FR-049 | SCR-05 (multi-select in section 07) | UJ-04 |
| FR-050 | SCR-05 ("Other" reveals text) | UJ-04 |
| FR-051 | SCR-05 (auto fields shaded; I absent) | UJ-04 |
| FR-052 | SCR-05 (decimal keyboard, format message) | UJ-04 |
| FR-053 | SCR-05 (Save draft, unsaved-changes dialog) | UJ-04 |
| FR-054 | SCR-05 (auto-save line, R1+) | UJ-04 |
| FR-055 | SCR-05 (Calculate blocked, Submitted) | UJ-05 |
| FR-056 | SCR-05 (hints "Enter 0 …") | UJ-05 |
| FR-057 | SCR-05 (count, tree icons, section counts, R1+) | UJ-04 |
| FR-058 | SCR-06, SCR-07 | UJ-06 |
| FR-059 | SCR-07 (hidden zero lines) | UJ-06 |
| FR-060 | SCR-17-lead | UJ-12 |
| FR-061 | SCR-06 (stale, Recalculate) | UJ-07 |
| FR-062 | SCR-08 | UJ-06 |
| FR-063 | SCR-09 | UJ-08 |
| FR-064 | SCR-05 (Submitted, read-only), SCR-06 | UJ-05, 06 |
| FR-065 | SCR-06 (approved), SCR-09 (notices) | UJ-06, 08 |
| FR-066 | SCR-10 | UJ-09 |
| FR-067 | SCR-10 | UJ-09 |
| FR-068 | SCR-10 | UJ-09 |
| FR-069 | SCR-10 (BL2, BN2, BO2; Q-31 open) | UJ-09 |
| FR-070 | SCR-10, SCR-26 | UJ-09 |
| FR-071 | SCR-10 (file name) | UJ-09 |
| FR-072 | SCR-17 | UJ-12 |
| FR-073 | SCR-18 | UJ-12 |
| FR-074 | SCR-19 | UJ-12 |
| FR-075 | SCR-19, SCR-20 (letter preview) | UJ-12 |
| FR-076 | SCR-20 | UJ-12 |
| FR-077 | SCR-21, SCR-16 | UJ-12 |
| FR-078 | SCR-21 | UJ-12 |
| FR-079 | SCR-16 (Configuration filter) | UJ-12 |
| FR-080 | SCR-18, SCR-20, SCR-21 (password step) | UJ-12 |
| FR-081 | SCR-22 (assigned), SCR-04 (alerts OFF notice) | UJ-02, 13 |
| FR-082 | SCR-22 (overdue) | UJ-13 |
| FR-083 | SCR-22 (digest) | UJ-13 |
| FR-084 | SCR-22 (note), SCR-15 | UJ-13 |
| FR-085 | every screen; phone and tablet frames for SCR-01, 03, 04, 05, 06, 07, 11, 25 | all |
| FR-086 | SCR-00 and every screen | all |
| FR-087 | SCR-05 (reserved region, toggle) | UJ-04 |
| FR-088 | state patterns in 6.0, SCR-00 section 09, every data screen | all |
| FR-089 | `<head>` of every page; section 8 | all |
| FR-090 | none: dark mode is R3 and out of scope (C-5); tokens named to allow it | |
| FR-091 | none: installation is documentation, not a screen | |
| FR-092 | none: offline is the next release (Q-18) | |
| FR-093 | none: deferred; room reserved by FR-087 | |
| FR-094 | none: rejected (UD-3) | |
| FR-095 | none: undecided (UD-5, OQ-UX-01) | |
| FR-096 | none: not planned | |
| FR-097 | none: sample extras are out of scope | |

---

## 10. Usability risks and validation plan

| # | Assumption or risk | Why it matters | Test |
|---|--------------------|----------------|------|
| R-1 | Engineers will find the guided form faster than the worksheet | The product's main bet (UD-1) | Task 1 below. Measure time and errors per part against the same part entered in Excel |
| R-2 | A Lead can tell the screen figure from the export row | Prices rest on this (G2 condition 6) | Task 4 |
| R-3 | Engineers understand "enter 0 where a part needs nothing" with no switch | UD-5 is undecided | Task 2: count how many leave blanks or ask |
| R-4 | Enter-to-next works with the multi-select and the picture field in the way | Keyboard speed (FR-046) | Task 1 with keyboard only |
| R-5 | Brand red with white text at 4.59:1 stays legible on real screens, especially outdoors or on cheap phones | Narrow margin | Check on one low-end phone in daylight; if weak, darken the button red to #C42626 (6.0:1) with no other change |
| R-6 | "Parts tree" as a drawer on phones is discoverable | Shop-floor use | Task 5 on a phone |
| R-7 | Units beside inputs (mm, kg, sec) are right | They are inferred (OQ-UX-07) | Ask two Engineers to read the screen aloud |
| R-8 | Approve being disabled when stale is clearer than allowing it | OQ-UX-06 | Task 4 |
| R-9 | Admin understands the letter preview before inserting a field (R2) | Costly mistake | Task 6 |

**Suggested tasks (5 Engineers, 3 Leads, the Admin; think aloud).**
1. Engineer: enter a part with 25 inputs from a printed sheet. Success: complete without help; median under 4 minutes for a typical part (to be calibrated against Excel).
2. Engineer: a part that needs no welding, no bending and no fasteners. Success: enters 0, or "None", with no questions.
3. Engineer: press Calculate with two parts incomplete; fix them. Success: finds both parts and fields in under 30 seconds.
4. Lead: open an estimate, explain why part 1.4 shows ₹ 709.97 on screen but ₹ 309.19 in the file; approve at a different price. Success: explains it correctly; finds the override notice.
5. Engineer on a phone: open the task, copy the path, open the tree, change part. Success: no horizontal scrolling, finds the tree drawer.
6. Admin (R2): insert a field and say which letters change; then try to delete a used field. Success: reads the preview; understands why deletion is blocked.

Targets: task success at least 90 percent without help; no critical errors on tasks 3 and 4; mean ease rating at least 4 of 5.

---

## 11. Open questions

| ID | Question | Owner | Needed by | Assumption used meanwhile |
|----|----------|-------|-----------|---------------------------|
| OQ-UX-01 | Do they want a **"Not needed for this part" switch** per section that fills zeros? (They call it undecided; the PRD records it closed.) | Santhosh | G3 approval | Not designed; Engineers enter 0; a free slot is kept in each section header |
| OQ-UX-02 | Should a price that differs from BL require a **reason**? | Santhosh | G3 | No reason field; the difference is logged |
| OQ-UX-03 | Should the sign-in page be indexable, and should shared links carry an **image** (the logo)? | product-manager | G3 | Sign-in indexable with generic text; no image tag |
| OQ-UX-04 | Which customer fields are required? | Santhosh | G4 | Name only; phone, e-mail, address optional |
| OQ-UX-05 | **Password rule** (length, other rules)? | Santhosh, solution-architect | G3 | At least 10 characters |
| OQ-UX-06 | May a Lead approve while totals are stale or before the first calculation? | Santhosh | G3 | No: Approve is disabled and says why |
| OQ-UX-07 | **Units** beside inputs (mm, kg, sec, nos, holes, ₹, ₹ per piece) and on rates are inferred from formulas | Admin | G4 | As shown |
| OQ-UX-08 | How are spaces and symbols in the customer name written in the **file name**? | solution-architect | G4 | Spaces become underscores |
| OQ-UX-09 | Should the **test e-mail** go to the Admin's own address or a typed one? | Santhosh | R2 | Own address |
| OQ-UX-10 | Wording of the **About** description | Santhosh | G3 | One generic sentence |
| OQ-UX-11 | After a **Lead edits** an Engineer's inputs on a Submitted estimate, is the Engineer told? | Santhosh | G4 | Not told; the audit log is the record |
| OQ-UX-12 | Should **Engineers** see a task's status "Approved" (and Closed) without a price? | Santhosh | G3 | Yes, status only |
| Q-16 | Sharper logo | Santhosh | open | Current 200 × 200 file |
| Q-31 | Per-item totals in the export | Santhosh | G3 | Row 2 only |
| Q-33 | Values and lock of "Not applicable" | Santhosh | G3 | All 0, locked |
| Q-18 | Hosting details; offline meaning | Santhosh | G3 | Internet-hosted |

---

## 12. Verification of the review screens

Run on 2026-11-01 with Chrome (headless, Playwright) against the files in the working tree: all 41 HTML pages (29 screen pages, 11 device frames and the index).

| Check | Method | Result |
|-------|--------|--------|
| Opens by double-click, no server, no external request | Pages loaded from file addresses; fonts are self-hosted in `screens/fonts/` | Pass |
| No horizontal page scroll at **360 x 800, 768 x 1024 and 1280 x 800** | Every screen and **every state link** (115) at all three widths; device frames at 1280 | Pass after two fixes (below). Tables scroll only inside their own container |
| Script errors | Page and console errors captured on every load | None |
| WCAG 2.0, 2.1 and 2.2 A and AA rules (axe-core) | Full run at 1280 on every state of every screen; then a re-run on the first three states of every page after the fixes | The full run found three classes of defect, all fixed: the accessible names of the brand link, account menu and multi-select did not contain their visible text; contrast of the greyed backdrop behind dialogs; a scrollable table without keyboard focus. Re-run: **0 violations on 93 page-states**. axe cannot judge focus order, meaning of text or screen-reader speech, so the manual rules in section 8 still apply |
| Engineer screens show no cost, rate, formula or preview | Text search of SCR-03 (Engineer), SCR-05 (all widths), SCR-23, SCR-24, SCR-26 for amounts, BG, BL, BN, BO, the sigma tag, "Material Rate" and "formula", outside the review notes | None found. The only rupee signs are unit tags on the Machining, Plating and Tool Cost inputs, which are the Engineer's own entries |
| Meta tags | Script over all pages: title 60 characters or fewer, description 160 or fewer, og:title, og:description and robots present | Pass on all 41 |
| Contrast of every token pair | WCAG formula on the hex values (section 7.3) | Pass; the narrowest margin is white on the brand red at 4.59:1 |
| Looked at by eye | Desktop, tablet and phone for SCR-03, 04, 05, 06, 07 and 10 | Fixed: workspace grid, hamburger showing on desktop, brand name colliding with the bell at 360 px, tabs cut off at 360 px, export table clipped, a default-state field shown as an error |

Defects found and fixed during verification: (1) visually hidden labels inside scrolling tables escaped their container and caused 112 px (SCR-13 at 768) and 25 px (SCR-21 at 360) of page scroll; (2) a long file name forced 385 px of scroll on SCR-10 at 360.

Known limits of the mock-ups. They do not validate or save anything. Enter-to-next-field, the multi-select, "Other" reveal, copy path, the drawers, the resizable tree and the state switcher work; most other buttons only link between screens. Hidden state variants on one page repeat element IDs, which a real build does not. No real screen reader, real phone or Windows high-contrast mode was used; section 10 calls for one real phone check.


## 13. Change log

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-11-01 | First G3 draft: 27 screens on 29 pages, 11 device frames, delivery lead UI decisions recorded, G2 condition 6 and condition 5 applied |
