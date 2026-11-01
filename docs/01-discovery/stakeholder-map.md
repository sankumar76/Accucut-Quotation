# Stakeholder Map — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.3 (Discovery Pass 2, G1 conditions 4 and 5 applied) |
| Author | business-analyst |
| Date | 2026-11-01 (Pass 1: 2026-10-31) |

No interviews have taken place. Goals, pains and measures below are **derived from the documents** (SPEC, DOCX, UI sample) and `CLAUDE.md`; they are not quotations. Statements that are inferences are marked "(inferred)". The sample screens use made-up names, which are not used here.

## 1. Stakeholders and personas

| Stakeholder / persona | Role in the project | Goals | Pains (inferred unless cited) | Influence | Interest | How they measure success |
|-----------------------|---------------------|-------|-------------------------------|-----------|----------|--------------------------|
| **Santhosh - MD** (one person; Q-02 answered on AQP-3) | Business sponsor; delivery lead; final approver at every gate (`CLAUDE.md` §1) | A portal that replaces the worksheet, protects pricing, looks professional and carries the Accucut brand | Budget: no limit; target 10 working days from 2026-11-02 (confirmed; the end date 2026-11-13 is UNCONFIRMED, UNC-h), with the fit of the full SPEC open (Q-29); several design decisions still open | High | High | Acceptance tests in SPEC §14 pass; brand and UI direction (SPEC §17) delivered |
| **Admin** (exactly one; person not named in the inputs) | Owns users, masters, settings, fields and formulas; also can assign, review and approve | Change prices, fields and formulas without a developer and without breaking old estimates (SPEC §1.6, §8) | One person is a single point of failure (Q-23); formula mistakes are costly | High | High | Can insert a field, edit a formula and revert a checkpoint safely (SPEC §14.6 to §14.9) |
| **Leads** (many) | Assign tasks, track queues, review costs, approve and lock, unlock | See overdue work early; review costs and formulas quickly; set the Approved Quote Price with confidence | Cannot tell today who is late (inferred); parent and child cost: children-only wording confirmed (Q-08), quantity multiplication UNCONFIRMED (UNC-d), details open (Q-32) | Medium | High | Overdue tasks visible; estimates reach them calculated; approval takes a few steps |
| **Engineers** (many) | Enter part data for assigned tasks; never see costs | Clear task list, fast guided entry, little re-typing, knowing exactly what is missing (SPEC §6, §17.4) | Large part trees and many mandatory fields (eased: enter 0, Q-06; "Not applicable" is proposed and UNCONFIRMED, UNC-b); network-folder links blocked by browsers (SPEC §15.4) | Low | High | Complete a tree and Calculate without errors; keyboard-friendly entry |
| **Accucut's customers** (external, not users) | Receive the quoted price; their rates drive the estimate | Accurate, timely quotes at agreed rates | Rate overrides must be respected (SPEC §4.2) | Low | Medium | Quote matches their agreed rates (not measured by the project) |
| **Accucut IT contact** (to be named, Q-18) | Hosts the system, backups, e-mail service, network access | A supportable system with clear backup and update steps | Unknown | Medium | Medium | System runs, backups restore, e-mail delivers |
| **Accucut legal / data-protection adviser** (to be confirmed, Q-26) | Confirms personal-data duties and retention | Compliance with data-protection law | Unknown | Low | Low | Retention and access rules approved |
| **Delivery team** (AI agents; human delivery lead) | Builds and verifies | Clear, testable requirements | Blocking questions still open: Q-18, Q-29, Q-32 | Medium | High | Gates passed first time |

### Personas (role-based, from SPEC §3)
- **The Engineer** works on a task from a network folder of requirement documents, chooses the customer, builds the part tree, and fills the guided form on a laptop or tablet, sometimes on a phone. Success: never blocked by a rule that does not apply to the part.
- **The Lead** assigns and checks. Success: sees estimates "Awaiting review" and overdue work at a glance (the UI sample shows this; the SPEC does not, F-16).
- **The Admin** keeps the model correct. Success: can see exactly which formulas use a field before deleting it.

## 2. Power / interest grid

| | Low interest | High interest |
|---|--------------|---------------|
| **High influence** | — | Santhosh - MD, Admin (manage closely) |
| **Medium influence** | Accucut IT contact (keep informed; needed from G3), delivery team | Leads (involve; review UX at G3) |
| **Low influence** | Legal adviser (consult on Q-26) | Engineers (involve in UX testing and parallel run), customers (no direct involvement) |

## 3. RACI for key decisions

R = Responsible (does it), A = Accountable (decides), C = Consulted, I = Informed. "Santhosh" is the sponsor and delivery lead.

| Decision / activity | Santhosh | Admin | Lead | Engineer | IT contact | Delivery team |
|---------------------|:--------:|:-----:|:----:|:--------:|:----------:|:-------------:|
| Approve gates G1, G3 and G8 | A/R | C | I | I | I | R (prepare) |
| Answer open questions Q-01 to Q-28 | A/R | C | C | — | C (Q-18) | R (ask) |
| Project budget and target date | A/R | I | I | I | I | C |
| Scope changes (logged in decision log) | A | C | C | I | I | R (product manager) |
| Starting master data (rates, materials, customers, treatments): defaults supplied by Santhosh, entered by the Admin at first use | A | R | C | I | — | C |
| Business rules: parent versus child cost, Rejection (BC), Tool Cost | A | C | C | C | — | R (record) |
| Export layout sign-off (sample worksheet) | A | C | R (compare) | I | — | R (build) |
| Field and formula changes after go-live | I | A/R | C (view only) | — | — | — |
| Master data changes (rates, materials, customers) after go-live | I | A/R | C | — | — | — |
| Assign task and deadline | I | A/R | A/R | I (receives) | — | — |
| Approve and lock; set the Approved Quote Price | I | A/R | A/R | — | — | — |
| Unlock an approved estimate | I | A/R | A/R | I | — | — |
| Turn e-mail alerts on or off | I | A/R | I | I | — | — |
| User creation and role assignment | I | A/R | I | I | — | — |
| Hosting, backup and e-mail service | I | C | — | — | A/R | C |
| Data retention and personal-data policy | A | C | I | I | C | C (legal adviser consulted via Santhosh) |
| UI design and brand direction (SPEC §17) | A | C | C | C (usability) | — | R (ux-expert) |
| Parallel run and go-live decision | A | C | R | R | C | R |

## 4. Engagement plan (proposed)

| Stakeholder | When | How | Purpose |
|-------------|------|-----|---------|
| Santhosh | Now (G1) | Answers received on AQP-1 to AQP-11 (2026-10-31); confirm them, and decide Q-18, Q-29 and Q-32, on AQP-1 with `APPROVED` or `CHANGES: Q-nn …` | Approval and remaining answers |
| Santhosh | After G3 approval, before development | Orchestrator stops and asks for the master data defaults (Q-09, TR-009) | Defaults for the Admin to enter at first use |
| Admin, one Lead, one Engineer | Before G2 | 30-minute call each (Q-28) | Confirm the as-is and to-be process; baseline (Q-24) |
| Leads and Engineers | G3 | Review the HTML screens | Usability feedback |
| Accucut IT contact | Before G3 | One call (Q-18) | Hosting, network access, e-mail service, backup |
| Leads and Engineers | Before go-live | Parallel run (TR-004) | Compare worksheet and portal |
