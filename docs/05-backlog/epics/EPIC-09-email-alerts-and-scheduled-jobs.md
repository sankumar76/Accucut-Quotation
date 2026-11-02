# EPIC-09: E-mail alerts and scheduled jobs

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-24](https://sankumar76.atlassian.net/browse/AQP-24) (labels `ai-delivery`, `aiid-EPIC-09`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-04) |
| Release | R2 (built after the R1 core, one hand-over under scope A) |
| Priority | Medium. PRD value 3. Effort 10.5 to 15.5 h (estimate, release plan v0.11), including 1.5 to 2.5 h for FR-006 and FR-040 which belong to EPIC-01 and EPIC-04, and the Settings page frame that story 02.09 builds in the R1 core (CR-26, CR-27) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. Scope unchanged except that the Settings page already exists from the R1 core. The Jira epic was edited for that dependency |

## Goal & User Value
Late work reaches people by e-mail (GOAL-05) and a forgotten password can be reset by an e-mailed link. Release 2, built after the R1 core as one hand-over (scope A).

## Requirements Covered
- Functional: FR-003 (Should), FR-019, FR-081 to FR-084 (Must), all R2. 6 FRs.
- Non-functional: NFR-014 (e-mail reliability), NFR-024 (every job run logged), NFR-015 (11:00 IST).
- Business rules: BR-040 to 044; D-15.

## Scope
**In:** the alert switch, sender name and address and the test e-mail on the Settings page (SCR-15) that EPIC-02 builds with the Last backup line; the worker and Postgres outbox; the Microsoft Outlook transport (SMTP, and the designed OAuth client-credentials mode, ADR-011, because SMTP with a password cannot be relied on); assignment e-mail with Cc; overdue e-mail within 5 minutes; digest at 11:00 IST; no duplicates, every send and failure logged, up to 3 retries; password reset by a single-use link.
**Out:** the mailbox itself (Accucut IT); the Last backup line (FR-105, EPIC-02); FR-006 and FR-040 (owned by EPIC-01 and EPIC-04, effort carried here).

## UX & Architecture References
- Screens / journeys: SCR-02, SCR-15, SCR-22; UJ-13, UJ-14.
- Components: `server/jobs`, `worker`, `server/mail`, `server/settings`; architecture sections 4.7, 9.5; ADR-011.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-09.01 | Mail outbox and transport (enabler) | Worker, outbox table, capturing server in test, SMTP and OAuth modes behind `FEATURE_EMAIL`, off until the facts arrive (ADR-011) | Enabler, justified: every mail story needs it | 10.04 | Draft |
| 2 | STORY-09.02 | Settings: switch, sender, test e-mail | Alerts ON or OFF; sender; test to the Admin's own address; sender refusal message; added to the Settings page built in 02.09 (FR-019) | CRUD (update) | 09.01, 02.09 | Draft; OQ-ARCH-11 |
| 3 | STORY-09.03 | Assignment e-mail | On assignment, with details, folder path and IST deadline, Cc the assigner, only when ON (FR-081) | Happy path | 09.02, 04.01 | Draft |
| 4 | STORY-09.04 | Overdue e-mail within 5 minutes | One-minute scan; sent once per overdue event (FR-082) | Workflow step | 09.03, 04.03 | Draft |
| 5 | STORY-09.05 | Daily digest at 11:00 IST | One per Engineer with overdue tasks, Cc the assigning Leads; none when nothing is overdue; catch-up at start (FR-083) | Data variation | 09.04 | Draft |
| 6 | STORY-09.06 | No duplicates, logged, retried | Unique key per event; every send and failure logged; 3 retries (FR-084, NFR-014) | Non-functional | 09.03 | Draft |
| 7 | STORY-09.07 | Reset a password by e-mailed link | Single-use hashed token; a second use refused; new password meets FR-098 (FR-003) | Happy path, then unhappy path | 09.01, 01.05 | Draft |
| 8 | STORY-09.08 | One real send on the real mailbox | Before alerts go live; recorded at G8 (gate record condition 16) | Verification | 09.02, OQ-ARCH-11 | Draft; waits for IT |

## Epic Acceptance Criteria
- [ ] SPEC 14.11 passes against a capturing mail server with a controlled clock: e-mails only when alerts are ON; the overdue e-mail within 5 minutes; the digest at 11:00 IST and none when nothing is overdue.
- [ ] Re-running a job sends 0 duplicates; every send and failure is logged; failed sends are retried.
- [ ] A reset link works once; a second use is refused.
- [ ] The test e-mail arrives at the signed-in Admin's address only.
- [ ] One real send on the real mailbox is made before alerts go live and recorded at G8.

## Dependencies & Risks
- Depends on: EPIC-04 (tasks and overdue state), EPIC-01 (auth for reset), EPIC-02 story 02.09 (the Settings page), EPIC-10 story 10.04 (Compose with the worker).
- Open inputs: OQ-ARCH-11 (type of Microsoft account, administrator and Security Defaults, a dedicated mailbox and address, port 587): before the mail stories reach Ready beyond the capturing-server tests; Q-18 sender address and web address. The "Last backup" question that v0.1 listed here is answered (FR-105 firm, D-33).
- Risks: RISK-014 (OAuth unproven; about half a day of code if the organisation refuses SMTP AUTH, +4 h in the release plan sensitivity); dates in alerts follow IST, stored in UTC.
