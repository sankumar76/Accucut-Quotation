# Project State Ledger

> Single source of truth for where the project stands. Maintained by `orchestrator`
> (progress) and `master` (gate decisions). Every agent reads this first.

## Summary

| Field              | Value                    |
|--------------------|--------------------------|
| Project            | Accucut Quotation Portal |
| Current phase      | G1 Discovery             |
| Last gate passed   | G0 Intake                |
| Next gate          | G1 Discovery (human approval) |
| Current sprint     | —                        |
| Overall health     | 🟡 Amber (BLK-01; awaiting G1 approval) |
| Last updated       | 2026-10-31 by orchestrator |
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
| G1 Discovery            | ⏳ Pending | | |
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
| Q-01 to Q-28 | Full list with assumptions in docs/01-discovery/requirements-questions.md; blocking ones are Q-01 to Q-09 and Q-18 (AQP-2 to AQP-11) | business-analyst | Santhosh | G2 to G8, per question | Open |

## Blockers

| ID | Description | Since | Owner | Action |
|----|-------------|-------|-------|--------|
| BLK-01 | Draft PR for docs/AQP-1-inception cannot be created: GitHub MCP create_pull_request returns 403 "Resource not accessible by personal access token" (tried twice). Branch push works. | 2026-10-31 | Santhosh | Grant the token Pull requests: write on the repository, or open the PR by hand. |

## Activity Log (newest first)

| Date | Agent | Action | Artefacts |
|------|-------|--------|-----------|
| 2026-10-31 | orchestrator | G1 approval requested on AQP-1; run stopped for delivery lead | AQP-1 |
| 2026-10-31 | business-analyst | Discovery Pass 1 complete; 28 questions, 10 blocking (AQP-2 to AQP-11) | docs/01-discovery/ |
| 2026-10-31 | master | G0 Intake: GO | docs/00-governance/gate-log.md |
| 2026-10-31 | orchestrator | Preflight passed; Intake AQP-1 created; request recorded | docs/project-state.md |
