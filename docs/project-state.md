# Project State Ledger

> Single source of truth for where the project stands. Maintained by `orchestrator`
> (progress) and `master` (gate decisions). Every agent reads this first.

## Summary

| Field              | Value                    |
|--------------------|--------------------------|
| Project            | Accucut Quotation Portal |
| Current phase      | G2 Product Definition    |
| Last gate passed   | G1 Discovery (CONDITIONAL GO) |
| Next gate          | G2 Product Definition    |
| Current sprint     | —                        |
| Overall health     | 🔴 Red (RISK-006 needs the delivery lead's decision now; G2 NO-GO on Q-32 (a), (b); BLK-01) |
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
| G2 Product Definition   | ❌ NO-GO (attempt 1) | 2026-11-01 | docs/00-governance/gate-log.md § G2 – Product Definition — 2026-11-01 |
| G3 Solution Design      | ⏳ Pending | | |
| G4 Backlog Ready        | ⏳ Pending | | |
| G8 Release Readiness    | ⏳ Pending | | |

## Story Board (current sprint)

| Story ID | Title | Status | Owner agent | G5 | G6 | G7 | Notes |
|----------|-------|--------|-------------|----|----|----|-------|

## Open Questions

| ID | Question | Raised by | Owner | Needed by | Status |
|----|----------|-----------|-------|-----------|--------|
| Q-01 to Q-33 | Full list with assumptions in docs/01-discovery/requirements-questions.md | business-analyst | Santhosh | G2 to G8, per question | See file |
| Q-18 | Offline decided: next release (AQP-11 comment 10444). Hosting details remain | business-analyst | Santhosh | G3 | Open in part |
| Q-29 | Answered on AQP-12 comment 10446: 2026-11-13 is a target for customer hand-over, not a blocker | business-analyst | Santhosh | G2 | Answered |
| Q-34 | Which scope the realistic date covers: A (whole SPEC except offline, dark mode and UI-sample extras) or B (R1 core only) | business-analyst | Santhosh | G3 approval (DL-004) | Open; does not hold G2 |
| Q-32 | Parent cost rule answered on AQP-13 in part. (a), (b) hold G2; (c), (d), (e) due G3 (DL-005). The revised question is on AQP-13 | business-analyst | Santhosh | (a), (b): G2 attempt 2; (c) to (e): G3 | Open in part |
| G1 condition 1 | Items (a) to (h) confirmed, (d) as corrected (AQP-1 comments 10441, 10443) | master | Santhosh | G2 | Met in substance (DL-001) |
| G1 condition 2 | Q-32 answered in part; no assumption accepted | master | Santhosh | G2 attempt 2 | Not met |
| G1 condition 3 | Q-29 answered (AQP-12 comment 10446) | master | Santhosh | G2 | Met |

## Blockers

| ID | Description | Since | Owner | Action |
|----|-------------|-------|-------|--------|
| BLK-01 | CLEARED 2026-11-01: draft PR #1 created with the new token. History: draft PR for docs/AQP-1-inception could not be created: GitHub MCP create_pull_request returns 403 "Resource not accessible by personal access token" (tried twice on 2026-10-31, again on 2026-11-01). Branch push works. On 2026-11-01 the GitHub MCP server also failed to connect (HTTP 401, token rejected). Needed before the G4 merge. | 2026-10-31 | Santhosh | Grant the MCP token Pull requests: write on the repository, or open the PR by hand. |
| BLK-02 | RISK-006: the sample workbook and draft requirements document are on the default branch of a repository readable without sign-in, against Q-03, Q-30 and ASSUMPTION-46. Agents do not change repository visibility or history. | 2026-11-01 | Santhosh Decided 2026-11-01: repository stays public, content not real (AQP-1, relayed verbatim). Pushing resumed. Master to close at G2 attempt 2. |
| HOLD-02 | G2 NO-GO attempt 1: ux-expert and solution-architect do not start until G2 attempt 2 returns GO or CONDITIONAL GO, or the delivery lead logs an override. | 2026-11-01 | Santhosh; orchestrator Remediation 2 to 5 done. Q-32 answers on AQP-13 (comment 10462 and the relayed reply to 10463): next run applies them, then master re-gates G2. Business-analyst to change the Q-34 and ASSUMPTION-50 due date to G3 approval (DL-004) on the next pass. |
| HOLD-01 | TR-009 stop: after G3 approval and before development, stop and ask Santhosh for master data defaults (AQP-10). Not in CLAUDE.md, so kept here. | 2026-11-01 | orchestrator | Stop the run at that point. |

## Activity Log (newest first)

| Date | Agent | Action | Artefacts |
|------|-------|--------|-----------|
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
