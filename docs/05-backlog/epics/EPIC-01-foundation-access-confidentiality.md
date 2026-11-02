# EPIC-01: Foundation, access and confidentiality

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-16](https://sankumar76.atlassian.net/browse/AQP-16) (labels `ai-delivery`, `aiid-EPIC-01`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-006 is R2) |
| Priority | Highest. PRD value 5, effort 5.75 to 9.5 h (estimate). Rank 2 in `backlog.md`, after the two EPIC-10 enabler stories |
| Status | Draft (no story exists yet). Re-issued 2026-11-02 against SPEC v1.11, PRD v0.10, UX v0.5, architecture v0.9; scope unchanged, so the Jira epic was not edited |

## Goal & User Value
People sign in and reach only what their role allows. Engineers never receive a cost, a rate or a formula (the main promise, GOAL-02). Passwords and sessions follow the delivery lead's rule (D-19). The Admin can read the audit record.

## Requirements Covered
- Functional: FR-001, 002, 004, 005, 007, 008, 009, 010, 011, 098, 099 (R1 core); FR-006 (R2, Should). 12 FRs.
- Non-functional: NFR-001, 002, 003, 007 primary; NFR-004 for the hand-over step (six step-up actions in all: cancel approval and remove price in EPIC-06 at R1, formula save, field delete and revert in EPIC-08, this hand-over; the step-up primitive is built first in STORY-06.12 and reused here); NFR-017, 018 apply to every screen story here.
- Business rules: BR-001, 003, 004, 005, 049, 050; D-05, D-18, D-19.

## Scope
**In:** sign in and out; own password change; users (create, edit, deactivate, role, reset) with a temporary Admin-set password; one active Admin; role enforcement on every route and API; the Engineer projection (ADR-008); header, navigation per role, account menu; About page; password rule; 12-hour session; the append-only audit service and the Admin audit screen SCR-16 (PROPOSED, accepted by DL-016); Admin hand-over (R2).
**Out:** reset by e-mailed link (FR-003, EPIC-09); scaffold, CI, design tokens and app shell (EPIC-10 enabler stories 10.01, 10.02, scheduled first); the audit events raised by masters, approval, unlock and configuration (the owning epics carry them as acceptance criteria).

## UX & Architecture References
- Screens / journeys: SCR-01, 14, 16, 23, 24, 25, 26; UJ-01, UJ-11, UJ-14.
- Components: `server/auth`, `server/users`, `server/audit`, `server/views`, `server/http` route manifest. Architecture sections 4.1, 7, 8, 12; ADR-008, 009, 010. Test strategy sections 6, 7.

## Stories (ordered)
Candidate stories, provisional IDs. The scrum-master creates them in Jira; the product-owner validates each against the DoR.

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-01.01 | Sign in and sign out | Valid credentials open my home page; wrong ones are refused without saying which part; sign-out ends the session (FR-001, NFR-003) | Happy path first (unhappy paths in 01.05, 01.06) | 10.01, 10.02 | Draft |
| 2 | STORY-01.02 | Role enforcement and navigation per role | Each role reaches only its routes; header, role navigation and account menu (FR-007, 009) | Business-rule variation by role | 01.01 | Draft |
| 3 | STORY-01.03 | Engineer sees no cost: projection and scan | Server-side role projection plus the automated Engineer scan on every build (FR-008, NFR-002) | Business rule (confidentiality) as a vertical slice on the first Engineer page | 01.02 | Draft |
| 4 | STORY-01.04 | Admin creates and deactivates users; one Admin | User list, add, edit, deactivate, role; a second active Admin refused (FR-004, 005) | CRUD operations | 01.02 | Draft |
| 5 | STORY-01.05 | Password rule and change own password | One shared rule (10 to 128 characters, number, symbol, not the e-mail, not common) names the failing part; Admin-set password forces a change at next sign-in (FR-002, 098, 004) | Business-rule variation | 01.01, 01.04 | Draft |
| 6 | STORY-01.06 | 12-hour session | Session ends 12 hours after sign-in; "Session ended" page (FR-099) | Business rule | 01.01 | Draft |
| 7 | STORY-01.07 | Audit service and audit screen | Append-only entries (who, when, object, before and after); Admin lists and filters them; the event list is open to the later epics (approvals, unlocks, overrides, master edits, acknowledged quantity warnings, cancelled approvals and removed prices, FR-011, NFR-007) | Workflow step: service first, screen on top | 01.02 | Draft |
| 8 | STORY-01.08 | About page | Exact SPEC section 9 description, "Version No: 1.0" and copyright (FR-010) | Single read-only screen | 10.02 | Draft |
| 9 | STORY-01.09 | Admin hand-over (R2) | One confirmed step that asks for the Admin's password; exactly one Admin after (FR-006, NFR-004). Effort is carried in EPIC-09's row (release plan 3.1) | Workflow step | 01.04, 01.05, 01.07, 06.12 (step-up) | Draft |

Splitting note: 01.01 to 01.08 are vertical (UI, API, data). 01.07's service is the only layer-shaped item and is justified because masters, approval and configuration all emit into it; its screen ships in the same story so it is not a bare enabler.

## Epic Acceptance Criteria
- [ ] A role-matrix test calls every route and API as each role and finds 0 differences from SPEC section 3.
- [ ] An automated scan of every Engineer-reachable page, API response and file finds 0 cost, rate or formula values, on every build (SPEC 14.1).
- [ ] Valid sign-in opens the role's home page; a wrong password is refused without naming the wrong part; a session ends 12 hours after sign-in (controlled-clock test); a password that breaks FR-098 is refused with the failing part named.
- [ ] A second active Admin is refused (SPEC 14.14, including direct SQL); an Admin-set password is temporary.
- [ ] Each audit event type creates exactly one entry; no role can edit or delete entries; the Admin can filter by type, user and date.

## Dependencies & Risks
- Depends on: EPIC-10 stories 10.01 and 10.02 (nothing else).
- Blocks: every other epic (EPIC-02, 03, 04 start after the shell and sign-in exist).
- Open inputs: none for stories 01.01 to 01.09. FR-089's sign-in `noindex` and the hand-over's password step are product-manager decisions, recorded by the master (DL-019, items 2 and 8), and the UX spec v0.5 now agrees with them.
- DoR watch-points: none carried from v0.1 (CR-08 is closed). PRD v0.10 still calls the audit screen "PROPOSED" in FR-011's fit criterion although DL-016 accepted it (CR-29).
- Risks: ARCH-R2 (leak through a new route), TD-02 (next-auth 4 behind `session.ts`), RISK-001 (assistant-drafted wording reaching Jira).
- First UI story note: the first story to ship a built page carries the real-phone, screen-reader and Windows high-contrast checks at its G7 (DL-017). That is 01.01 unless the scrum-master orders otherwise.
