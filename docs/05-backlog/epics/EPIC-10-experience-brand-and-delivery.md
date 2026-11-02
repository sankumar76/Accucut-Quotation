# EPIC-10: Experience, brand and delivery

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-25](https://sankumar76.atlassian.net/browse/AQP-25) (labels `ai-delivery`, `aiid-EPIC-10`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-088 R1+ stretch); repeated for R2 screens |
| Priority | High. PRD value 4, effort 6.5 to 10 h core plus 1 to 1.5 h stretch (estimate) |
| Status | Draft |

## Goal & User Value
Every screen is usable on a phone, a tablet and a desktop, branded as decided ("Red Leads", GOAL-07), accessible to WCAG 2.2 AA, installable by Accucut's IT person with Docker Compose, backed up weekly and tested end to end.

## Requirements Covered
- Functional: FR-085, 086, 087, 089, 091 (Must, R1); FR-088 (Should, R1+). 6 FRs. FR-090 (dark mode) is EPIC-11, outside scope A.
- Non-functional (allocated here, see the consistency report): NFR-006, 009, 010 (load part), 011, 012, 013, 016 to 025, 028, 029, 030.
- Business rules: none of its own; D-15 (backup), D-14 (light mode only).

## Sequencing ruling (product-owner)
The PRD says this epic "runs alongside" and gives EPIC-01 no dependency. The architecture puts the scaffold (TD-05, RISK-006) in this epic, and the release plan puts it in EPIC-01 (SPEC step 1). Every UI story needs the scaffold, the CI gates, the secret scan, the design tokens and the app shell. **Stories 10.01 and 10.02 are therefore enablers sequenced before every EPIC-01 story.** Each is justified: 10.01 carries the secret scan that protects a public repository (RISK-006, NFR-006) and the build gates every pull request needs (NFR-025); 10.02 gives every screen one design system (NFR-020) at three widths. The rest of the epic runs alongside the others. Effort placement is for the product-manager and solution-architect to confirm (CR-11).

## Scope
**In:** scaffold, CI pipeline (lint, type-check, tests, coverage thresholds, secret and repository scan), design tokens and responsive shell on shadcn/ui; per-page title, description and Open Graph tags with "do not index" behind sign-in and on the sign-in page, no sharing image; Docker Compose (app, worker, database), `.env.example`, README with install, update, backup and restore steps; weekly backup, backup-watch check, manifest and 2-year pruning; restore rehearsal; the reserved drawing region on the workspace; loading, empty and error states (stretch); accessibility, responsive, end-to-end, performance and observability suites.
**Out:** dark mode, UI-sample extras, offline use, drawing input.

## UX & Architecture References
- Screens / journeys: SCR-00 (design system), SCR-25, SCR-26, and the phone and tablet frames; every screen for the responsive and accessibility checks.
- Components: `src/components`, `src/app`, `Ops` (Compose, scripts, README), CI. Architecture sections 7, 9, 10, 11, 12; ADR-001, 002, 013, 014. Test strategy sections 8, 9, 10, 11.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-10.01 | Scaffold, CI and repository hygiene (enabler) | Next.js, Prisma, tooling; the pipeline gates; secret and repository scan; `.env.example` committed (TD-05); master data loaded from outside the repository (ADR-014) (NFR-006, 025) | Enabler, justified above | none (first story) | Draft |
| 2 | STORY-10.02 | Design tokens and responsive app shell (enabler) | One palette, type, spacing and button set; header, navigation frame, three widths with no horizontal scroll; the first built page carries the real-phone, screen-reader and high-contrast checks (FR-085, 086, NFR-016 to 018, 020, 021, DL-017) | Enabler, justified above | 10.01 | Draft |
| 3 | STORY-10.03 | Page metadata and indexing | Title, description and Open Graph tags on every route; "do not index" behind sign-in and on the sign-in page; no image tag (FR-089, NFR-022) | Business rule | 10.02, 01.01 | Draft |
| 4 | STORY-10.04 | Install and update with Docker Compose | One `docker compose up` after copying `.env.example`; README install and update; clean-machine sign-in page within 30 minutes (FR-091 part, NFR-030) | Workflow step | 10.01, 01.01 | Draft; OQ-ARCH-02, 03 |
| 5 | STORY-10.05 | Weekly backup, watch check and restore | Automatic weekly backup, a check that flags a missed week, a manifest, 2-year pruning, a restore rehearsal in the README (FR-091, NFR-013) | Workflow step | 10.04 | Draft; OQ-ARCH-12 |
| 6 | STORY-10.06 | Reserved drawing region | One reserved region at 1024 px and wider on the workspace (FR-087, NFR-023) | Single UX requirement | 05.03 | Draft |
| 7 | STORY-10.07 | Loading, empty and error states (R1+) | Three states and a save confirmation on each data screen (FR-088) | Data variation by screen | 10.02 | Draft |
| 8 | STORY-10.08 | End-to-end, responsive and accessibility suites | Playwright at 360, 768 and 1366 px, axe at the WCAG 2.2 AA rules, keyboard-only key flows, one run per delivered screen set (NFR-016, 018, 019); repeated for the R2 screens | Non-functional verification | 05.09, 06.06 | Draft |
| 9 | STORY-10.09 | Performance, capacity and observability | Page timings, 25 concurrent users, logging of errors and job runs, an uptime check when the web address exists (NFR-009, 010, 011, 012, 024) | Non-functional verification | 07.05 | Draft; Q-18 |
| 10 | STORY-10.10 | Privacy and data-handling checks | Repository scan for real personal data in fixtures; English-only inspection (NFR-028, 029) | Non-functional verification | 10.01 | Draft |

## Epic Acceptance Criteria
- [ ] Following the README on a clean machine reaches a working sign-in page within 30 minutes, and one restore is rehearsed.
- [ ] Playwright at 360, 768 and 1366 px finds 0 horizontal page scroll and every action reachable on every delivered screen; axe finds 0 WCAG 2.2 AA violations; the key flows complete by keyboard only.
- [ ] The pull request pipeline fails on a lint, type, test, coverage (80 percent of changed code, 95 percent of the formula module) or secret-scan finding.
- [ ] The tag check passes on every route, with "do not index" on the sign-in page and no sharing image.
- [ ] A backup runs every 7 days, each is kept 2 years, and a missed week is detected.
- [ ] At the G7 of the first built page: a real phone, a screen reader and Windows high-contrast checks are done and recorded (DL-017); the usability test is decided (G3 condition 15, CR-20).

## Dependencies & Risks
- Depends on: none for 10.01 and 10.02; the others follow their predecessors.
- Open inputs: OQ-ARCH-02 (where container images may be pulled from), OQ-ARCH-03 (VM size), Q-18 (web address), OQ-ARCH-12 (backup duties), OQ-PM-03, 04, 05 (PROPOSED availability, browsers, export size: the PROPOSED values stand for the DoR), Q-26 (retention, NFR-028), Q-16 (sharper logo).
- Risks: RISK-006 (real data in a public repository), RISK-011 (weekly backup, up to 7 days of work lost, 14 if one run fails unnoticed), RISK-015 (evidence limits), ARCH-R4 (Next.js, React and Prisma on recent majors).
