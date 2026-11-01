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
| Overall health     | 🟡 Amber (BLK-01; G1 conditions 1 to 3 answered, G2 with master) |
| Last updated       | 2026-11-01 by orchestrator |
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
| G2 Product Definition   | ⏳ Pending | | |
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
| Q-34 | Which scope the realistic date covers: A (whole SPEC except offline, dark mode and UI-sample extras) or B (R1 core only) | business-analyst | Santhosh | G2 | Open |
| Q-32 | Parent cost rule answered on AQP-13; details (a) to (e) remain, carried by ASSUMPTION-48 | business-analyst | Santhosh | G2 or G3, master decides | Open in part |
| G1 condition 1 | Items (a) to (h) confirmed, (d) as corrected (AQP-1 comments 10441, 10443) | master | Santhosh | G2 | Answered, master to verify |

## Blockers

| ID | Description | Since | Owner | Action |
|----|-------------|-------|-------|--------|
| BLK-01 | Draft PR for docs/AQP-1-inception cannot be created: GitHub MCP create_pull_request returns 403 "Resource not accessible by personal access token" (tried twice on 2026-10-31, again on 2026-11-01). Branch push works. On 2026-11-01 the GitHub MCP server also failed to connect (HTTP 401, token rejected). Needed before the G4 merge. | 2026-10-31 | Santhosh | Grant the MCP token Pull requests: write on the repository, or open the PR by hand. |
| HOLD-01 | TR-009 stop: after G3 approval and before development, stop and ask Santhosh for master data defaults (AQP-10). Not in CLAUDE.md, so kept here. | 2026-11-01 | orchestrator | Stop the run at that point. |

## Activity Log (newest first)

| Date | Agent | Action | Artefacts |
|------|-------|--------|-----------|
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
