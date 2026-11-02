# Project State Ledger

> Single source of truth for where the project stands. Maintained by `orchestrator`
> (progress) and `master` (gate decisions). Every agent reads this first.

## Summary

| Field              | Value                    |
|--------------------|--------------------------|
| Project            | Accucut Quotation Portal |
| Current phase      | G4 Backlog Ready; HOLD-01 stop first (master data defaults) |
| Last gate passed   | G3 Solution Design (CONDITIONAL GO, attempt 1) |
| Next gate          | G4 Backlog Ready. No human approval stop (DL-010); Q-35 (a) and OQ-ARCH-10 needed before the roll-up story reaches Ready |
| Current sprint     | —                        |
| Overall health     | 🟡 Amber (G3 CONDITIONAL GO, 16 conditions; no red risk; RISK-006, 007 and 013 at 12; Q-35 (a) and OQ-ARCH-10 are open price rules; no date adopted) |
| Last updated       | 2026-11-01 by master |
| Jira Intake issue  | [AQP-1](https://sankumar76.atlassian.net/browse/AQP-1) |

## Request (G0 Intake)

- **Problem statement:** Accucut Lasers prepares manufacturing cost estimates in an Excel worksheet (columns A to BO); Admin, Leads and Engineers need a role-based web portal that replicates it, hides costs from Engineers and controls approval.
- **Sponsor:** Santhosh / MD
- **Desired outcome:** Estimates are assigned, entered, calculated, approved and exported through the portal, with Excel output matching the worksheet layout (acceptance tests in spec section 14).
- **Known constraints:** Stack per spec section 2 and CLAUDE.md; fully responsive; IST display with UTC storage. Budget and deadline not stated.
- **Inputs provided:** ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md; Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx; AMADA-20261006.xlsx; Accucut Quotation Portal UI-UX.html; docs/03-ux/assets/

## Phase Progress

| Gate | Status       | Date | Decision ref |
|------|--------------|------|--------------|
| G0 Intake               | ✅ GO | 2026-10-31 | docs/00-governance/gate-log.md § G0 – Intake — 2026-10-31 |
| G1 Discovery            | ⚠️ CONDITIONAL GO | 2026-11-01 | docs/00-governance/gate-log.md § G1 – Discovery — 2026-11-01 |
| G2 Product Definition   | ⚠️ CONDITIONAL GO (attempt 2; attempt 1 NO-GO) | 2026-11-01 | docs/00-governance/gate-log.md § G2 – Product Definition — 2026-11-01 (attempt 2) |
| G3 Solution Design      | ⚠️ CONDITIONAL GO (attempt 1; APPROVED AQP-1 10491; override DL-010) | 2026-11-01 | docs/00-governance/gate-log.md § G3 – Solution Design — 2026-11-01 |
| G4 Backlog Ready        | ⏳ Pending | | |
| G8 Release Readiness    | ⏳ Pending | | |

## Story Board (current sprint)

| Story ID | Title | Status | Owner agent | G5 | G6 | G7 | Notes |
|----------|-------|--------|-------------|----|----|----|-------|

## Open Questions

| ID | Question | Raised by | Owner | Needed by | Status |
|----|----------|-----------|-------|-----------|--------|
| Q-01 to Q-33 | Full list with assumptions in docs/01-discovery/requirements-questions.md | business-analyst | Santhosh | G2 to G8, per question | See file |
| Q-18 | Offline decided: next release (AQP-11 comment 10444). Hosting answered in chat 2026-11-01 (AQP-1 10490): e-mail service Microsoft Outlook, weekly backup kept 2 years by Admin, updates by their IT person. Open: web address, sender address, what "Admin looks after them" means, where copies are kept | business-analyst | Santhosh, Accucut IT | Before first deployment; checked at G8 | Open in part |
| Q-35 (a) | The item's own row (ASSUMPTION-51). Not narrow: any single-piece product is such a row (DL-012). Becomes a Jira open-question issue; asks for a number | business-analyst | Santhosh | G4, before the roll-up story reaches Ready | Open, blocks that story |
| OQ-ARCH-10 / OQ-PM-07 | QTY per Assy of 0 on a part with parts below it. If no reply, a block at Calculate is the labelled fallback (DL-013) | solution-architect, product-manager | Santhosh | G4, before the roll-up story reaches Ready | Open |
| Q-35 (b), Q-36, Q-37 | What a part shows; "Not applicable" for Lead and Admin; what a cleared total means. Labelled assumptions run if unanswered | business-analyst | Santhosh | G4 | Open |
| OQ-UX-19, OQ-UX-03 | Override reason in the file; sign-in indexing (overdue, was G3) | ux-expert | product-manager | G4 | Open |
| OQ-ARCH-11 | Mail account facts | solution-architect | Accucut IT, Santhosh | Before the e-mail story reaches Ready | Open |
| OQ-ARCH-12 | Backup duties; whether Settings shows "Last backup" | solution-architect | Santhosh | Before first deployment; checked at G8 | Open |
| OQ-PM-02 | Holidays and unavailable days in the date range | product-manager | Santhosh | G4 | Open |
| Q-29 | Answered on AQP-12 comment 10446: 2026-11-13 is a target for customer hand-over, not a blocker | business-analyst | Santhosh | G2 | Answered |
| Q-34 | Which scope the realistic date covers: A (whole SPEC except offline, dark mode and UI-sample extras) or B (R1 core only) | business-analyst | Santhosh | G3 approval (DL-004) | Answered: scope A (AQP-12 comment 10488) |
| G3 answers | Q-31, Q-33, OQ-UX-01, 02, 05, 06, 10, 12 and OQ-ARCH-03 answered in chat 2026-11-01 (AQP-1 10490); recorded as D-14 to D-20 (DL-015) | business-analyst, product-manager, ux-expert, solution-architect | orchestrator | G3 | Answered and applied |
| Q-32 | Closed. (a) in their own words: QTY per Assy on AQP-13 10487; 24 lids (2 x 3 x 4), relayed in AQP-1 10490, log checked. DL-006 met (DL-011). D-12 revised: every level's quantity applies. (b3) and (c) did not carry over: Q-35 | business-analyst | Santhosh | G3 approval | Closed |
| G1 condition 1 | Items (a) to (h) confirmed, (d) as corrected (AQP-1 comments 10441, 10443) | master | Santhosh | G2 | Met in substance (DL-001) |
| G1 condition 2 | Q-32 answered or accepted; (b) in their own words (gate log, G2 attempt 2) | master | Santhosh | G2 attempt 2 | Met |
| G1 condition 3 | Q-29 answered (AQP-12 comment 10446) | master | Santhosh | G2 | Met |

## Blockers

| ID | Description | Since | Owner | Action |
|----|-------------|-------|-------|--------|
| BLK-01 | CLEARED 2026-11-01: draft PR #1 created with the new token; verified at G2 attempt 2; RISK-005 closed. History: GitHub MCP create_pull_request returned 403, later HTTP 401 | 2026-10-31 | Santhosh | None |
| BLK-02 | CLOSED 2026-11-01 at G2 attempt 2: the delivery lead decided the repository stays public (AQP-1 10465; DL-008). That the content is not real is their statement, not verified; RISK-006 stays open, restated | 2026-11-01 | Santhosh | None |
| HOLD-02 | RELEASED 2026-11-01: G2 attempt 2 returned CONDITIONAL GO. ux-expert and solution-architect may start now, in parallel | 2026-11-01 | Santhosh; orchestrator | Start both, with conditions 5 and 6 of the gate record |
| HOLD-01 | **In force now; confirmed by G3 despite AQP-1 10495 (DL-010):** a data input, not an approval. TR-009 stop: before development, ask Santhosh for master data defaults (AQP-10). Not in CLAUDE.md, so kept here. State that the repository is public and ask where the defaults may be held (DL-008). Ask the G3 open inputs in the same request (gate record condition 2), so there is no extra stop. Backlog and G4 work may run during the wait; development may not start | 2026-11-01 | orchestrator | Stop the run for the defaults after condition 1 and 2 are done |

## Activity Log (newest first)

| Date | Agent | Action | Artefacts |
|------|-------|--------|-----------|
| 2026-11-01 | master | G3 Solution Design: CONDITIONAL GO, attempt 1, 16 conditions. APPROVED stands (DL-009); 10495 logged as an override, G8 treatment set, HOLD-01 stands (DL-010); DL-006 met (DL-011); Q-35 (a) not narrow, holds G4 for the roll-up story (DL-012); OQ-ARCH-10 goes to the delivery lead, block as fallback (DL-013); scope A stands, no date adopted (DL-014); DL-015 to DL-017; RISK-011 to 015 new; RISK-001 raised, 008 and 010 reduced | docs/00-governance/ |
| 2026-11-01 | ux-expert | UX spec v0.3 and screens: 9 answer items and UX-28 to UX-35, UX-37 applied; UX-36 held for OQ-ARCH-10; 41 pages and 146 states checked at 360, 768 and 1280 px, axe 0 violations; OQ-UX-19 raised | docs/03-ux/ |
| 2026-11-01 | solution-architect | Architecture and test strategy v0.3: every-level roll-up (24 lids), weekly backup, OAuth mail design, password, cleared totals, override reason; adds 7.5 to 13 h (estimate); ARCH-R5 proposed; UX-28 to UX-37 listed | docs/04-architecture/ |
| 2026-11-01 | product-manager | PRD and release plan v0.6: new quantity rule, scope A adopted, FR-098 to 103 added, weekly backup; central date Wed 2026-11-25 (estimate, unadopted); OQ-PM-07 raised | docs/02-product/ |
| 2026-11-01 | orchestrator | Delivery lead instruction, in chat: "dont ask me for any approvals except for git merge. But I need to view the result after each iteration (and gate reviews if required)". Remaining human approval stops lifted, except code PR merges; results reported after each iteration and gate. HOLD-01 stays: it is a data input, not an approval. Master to log it | AQP-1 |
| 2026-11-01 | master | G2 Product Definition: CONDITIONAL GO, attempt 2. G1 condition 2 met; Q-32 (a) own-words confirmation due G3 approval (DL-006); list-wording and relay standards (DL-007); repository decision recorded (DL-008); BLK-02 and RISK-005 closed; RISK-006 restated at 12, RISK-002 at 10; HOLD-02 released | docs/00-governance/ |
| 2026-11-01 | business-analyst | G3 answers applied, SPEC v1.4; D-12 revised (every level's quantity applies); ASSUMPTION-51, 52; Q-35, 36, 37 raised; run interrupted by a Claude Code exit and resumed | ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md, docs/01-discovery/ |
| 2026-11-01 | orchestrator | Delivery lead replied APPROVED (AQP-1 10491). Answers to be applied before master G3 | AQP-1 |
| 2026-11-01 | orchestrator | Delivery lead's answers to the G3 questions collected in chat and relayed on AQP-1; Q-32 (a) reverses the quantity rule (24, not 8). Still awaiting APPROVED or CHANGES | AQP-1 |
| 2026-11-01 | orchestrator | G3 approval requested on AQP-1; run stopped. For the next pass: product-manager and business-analyst to align ROLLUP (FR-022, SPEC 8.2), NFR-018 to WCAG 2.2 AA, SCR-16 audit log, and the brand, header, dark mode and "Not needed" switch wording flagged in ux-spec section 0.2 | AQP-1 |
| 2026-11-01 | ux-expert | UX spec v0.2 and screens: UX-01 to UX-27 applied, re-checked at 360, 768 and 1280 px | docs/03-ux/ |
| 2026-11-01 | solution-architect | Architecture v0.2, ADR-001 to 014, test strategy v0.2; all 27 screens reconciled | docs/04-architecture/ |
| 2026-11-01 | product-manager | PRD and release plan v0.4: Q-32 rule applied, central dates re-issued (unadopted) | docs/02-product/ |
| 2026-11-01 | business-analyst | Q-32 closed, ASSUMPTION-48 retired; repository decision recorded as D-13 | docs/01-discovery/, ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md |
| 2026-11-01 | orchestrator | Run resumed; GitHub MCP connected; draft PR #1 created; repository labels set up | PR #1 |
| 2026-11-01 | orchestrator | Delivery lead decisions recorded: repository stays public; Q-32 (b1), (b2) clarified; held commits pushed | AQP-1, AQP-13 |
| 2026-11-01 | orchestrator | Run stopped for Q-32 (a), (b) and the RISK-006 decision; commits held locally, pushing paused | AQP-1, AQP-13 |
| 2026-11-01 | product-manager | G2 remediation 4 and 5: PRD and release plan v0.3 | docs/02-product/ |
| 2026-11-01 | business-analyst | G2 remediation 2, 3 and 5: AQP-13 rewritten, discovery files corrected | AQP-13, docs/01-discovery/, ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md |
| 2026-11-01 | master | G2 Product Definition: NO-GO, attempt 1 (G1 condition 2 not met; conditions 1 and 3 met); RISK-001 to 005 restated, RISK-006 to 010 added; DL-001 to DL-005 | docs/00-governance/ |
| 2026-11-01 | product-manager | PRD and release plan v0.2; realistic date estimated, scope A proposed (Q-34), not agreed | docs/02-product/ |
| 2026-11-01 | business-analyst | Pass 3: delivery lead confirmations applied, parent cost rule checked against the sample; Q-34 raised | docs/01-discovery/, ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md |
| 2026-11-01 | orchestrator | Run resumed; delivery lead replies found on AQP-1, AQP-9, AQP-11, AQP-12, AQP-13 | AQP-1 |
| 2026-11-01 | orchestrator | Run stopped; G2 held for G1 conditions 1 to 3 (AQP-1, AQP-12, AQP-13) | AQP-1 |
| 2026-11-01 | product-manager | PRD and release plan v0.1 drafted; first-release proposal posted, not agreed | docs/02-product/ |
| 2026-11-01 | business-analyst | G1 conditions 4 and 5 applied; UNC-a to UNC-h registered | docs/01-discovery/, ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md |
| 2026-11-01 | master | G1 Discovery: CONDITIONAL GO; RISK-001 to RISK-005 raised | docs/00-governance/gate-log.md, risk-register.md |
| 2026-11-01 | business-analyst | Discovery Pass 2 complete; Q-29 to Q-33 raised (AQP-12, AQP-13) | docs/01-discovery/, ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md |
| 2026-10-31 | orchestrator | G1 approval requested on AQP-1; run stopped for delivery lead | AQP-1 |
| 2026-10-31 | business-analyst | Discovery Pass 1 complete; 28 questions, 10 blocking (AQP-2 to AQP-11) | docs/01-discovery/ |
| 2026-10-31 | master | G0 Intake: GO | docs/00-governance/gate-log.md |
| 2026-10-31 | orchestrator | Preflight passed; Intake AQP-1 created; request recorded | docs/project-state.md |
