# Sprint 01 Plan

| Field | Value |
|-------|-------|
| Version | 0.2 (refreshed 2026-11-02 after the product-owner's Definition of Ready validation, `backlog.md` section 7, and consistency report CR-34 and CR-35; v0.1 was written before that validation) |
| Dates | Not adopted. No date model is adopted (project state; DL-014). The Jira sprint "AQP Sprint 1" (id 37, state future) holds the 18 stories and is not started. No story branch starts before G4, which is the master's decision; the delivery lead starts the sprint after it. Dates are set then |
| Sprint goal | By the end of the sprint a person can sign in to a responsive Red Leads portal, an Admin can manage users, read the audit record and keep the rate, material, customer and exchange-rate masters, a Lead can assign a task, and the formula engine and field registry are ready for the calculation, all built under the secret scan and the cost-confidentiality scan |
| Capacity assumption | **Assumed 55 points for the committed set (53 points, ranks 1 to 12); 20 points of stretch (ranks 13 to 18); 73 points planned in all.** There is no velocity: this is the first sprint. The number is a calibration, not a forecast. The basis is the dependency chain (10.01, then 10.02, then the sign-in chain is serial), the largest items (10.01 and 03.02 at 8 points each) and the architect's warning that the scaffold hours are not shown to be enough (architecture 16.11). The sprint review sets the real velocity |
| Facilitator | scrum-master |
| Inputs | `backlog.md` v0.3 (ranks 1 to 18 and section 7), `consistency-report.md` v0.3 (CR-34, CR-35), epics EPIC-01 to 04 and 10, PRD v0.11, architecture v0.10, UX spec v0.6, test strategy v0.9, test plan v0.1 (`docs/07-qa/test-plan.md`), SPEC v1.12, Definition of Ready |
| System of record | Jira project AQP (CLAUDE.md §7). **No story Markdown files exist for these stories.** This file is the plan; the stories are the Jira issues below |

## Definition of Ready status (product-owner, 2026-11-02)

The product-owner validated all 18 stories (16 DoR items each, `backlog.md` section 7). **Nine passed** (ranks 2 to 8, 11 and 12). **Nine needed one correction each (CR-34), now made:** 10.01 gained AC-10 (the database guard the test plan asks for, and sub-task T10, AQP-164); eight stories gained the missing "is blocked by" links (13 links, listed below). The product-owner re-validates the nine. **Every story stays Draft in Jira until the master decides G4**, then Ready.

## Jira stories (all Draft, label `sprint-01`)

Estimates are Fibonacci story points in the Jira field "Story point estimate". Every story has sub-tasks (one per top-level task, AC IDs in the summary) and "is blocked by" links. The "Blocked by" column shows the 28 links of v0.1 plus the 13 added for CR-34 (marked +).

| Rank | Story | Jira | Epic | Points | Sub-tasks | Blocked by | PO validation |
|------|-------|------|------|--------|-----------|------------|---------------|
| 1 | 10.01 Scaffold, CI and repository hygiene (enabler) | [AQP-27](https://sankumar76.atlassian.net/browse/AQP-27) | AQP-25 | 8 | 10 (AQP-29 to 37, AQP-164) | none | Corrected (AC-10) |
| 2 | 10.02 Design tokens and responsive app shell (enabler) | [AQP-28](https://sankumar76.atlassian.net/browse/AQP-28) | AQP-25 | 5 | 9 (AQP-39 to 47) | AQP-27 | Pass |
| 3 | 01.01 Sign in and sign out | [AQP-38](https://sankumar76.atlassian.net/browse/AQP-38) | AQP-16 | 5 | 8 (AQP-49 to 56) | AQP-27, AQP-28 | Pass |
| 4 | 01.02 Role enforcement and navigation per role | [AQP-48](https://sankumar76.atlassian.net/browse/AQP-48) | AQP-16 | 5 | 7 (AQP-58 to 64) | AQP-38 | Pass |
| 5 | 01.03 Engineer sees no cost: projection and scan | [AQP-57](https://sankumar76.atlassian.net/browse/AQP-57) | AQP-16 | 5 | 8 (AQP-66 to 73) | AQP-48 | Pass |
| 6 | 01.04 Admin creates and deactivates users; one Admin | [AQP-65](https://sankumar76.atlassian.net/browse/AQP-65) | AQP-16 | 3 | 6 (AQP-75 to 80) | AQP-48 | Pass |
| 7 | 01.07 Audit service and audit screen | [AQP-74](https://sankumar76.atlassian.net/browse/AQP-74) | AQP-16 | 5 | 7 (AQP-82 to 88) | AQP-48, AQP-65 | Pass |
| 8 | 01.05 Password rule and change own password | [AQP-81](https://sankumar76.atlassian.net/browse/AQP-81) | AQP-16 | 3 | 6 (AQP-91 to 96) | AQP-38, AQP-65 | Pass |
| 9 | 01.06 12-hour session | [AQP-89](https://sankumar76.atlassian.net/browse/AQP-89) | AQP-16 | 2 | 5 (AQP-98 to 102) | AQP-38, +AQP-48 | Corrected (link) |
| 10 | 01.08 About page | [AQP-90](https://sankumar76.atlassian.net/browse/AQP-90) | AQP-16 | 1 | 3 (AQP-103 to 105) | AQP-28, AQP-48, +AQP-57 | Corrected (link) |
| 11 | 03.01 Field registry seed and column letters | [AQP-97](https://sankumar76.atlassian.net/browse/AQP-97) | AQP-18 | 3 | 6 (AQP-107 to 112) | AQP-27 | Pass |
| 12 | 03.02 Formula engine | [AQP-106](https://sankumar76.atlassian.net/browse/AQP-106) | AQP-18 | 8 | 8 (AQP-114 to 121) | AQP-97 | Pass |
| 13 | 02.01 Process Master list and edit | [AQP-113](https://sankumar76.atlassian.net/browse/AQP-113) | AQP-17 | 3 | 6 (AQP-124 to 129) | AQP-65, AQP-74, AQP-97, +AQP-57 | Corrected (link) |
| 14 | 02.03 Material Master | [AQP-122](https://sankumar76.atlassian.net/browse/AQP-122) | AQP-17 | 3 | 6 (AQP-131 to 136) | AQP-65, AQP-74, +AQP-113, +AQP-57 | Corrected (links) |
| 15 | 02.04 Exchange Rate Master | [AQP-123](https://sankumar76.atlassian.net/browse/AQP-123) | AQP-17 | 2 | 5 (AQP-137 to 141) | AQP-65, AQP-74, AQP-97, +AQP-113, +AQP-122, +AQP-57 | Corrected (links) |
| 16 | 02.05 Treatment / Color list | [AQP-130](https://sankumar76.atlassian.net/browse/AQP-130) | AQP-17 | 2 | 5 (AQP-143 to 147) | AQP-65, AQP-74, +AQP-113, +AQP-122, +AQP-57 | Corrected (links) |
| 17 | 02.02 Customers with default rates and Reset to Defaults | [AQP-142](https://sankumar76.atlassian.net/browse/AQP-142) | AQP-17 | 5 | 7 (AQP-149 to 155) | AQP-113, +AQP-57 | Corrected (link) |
| 18 | 04.01 Assign a task | [AQP-148](https://sankumar76.atlassian.net/browse/AQP-148) | AQP-19 | 5 | 8 (AQP-156 to 163) | AQP-65, AQP-48, +AQP-57 | Corrected (link) |
| | **Total** | | | **73** | **120** | 41 links | 9 pass, 9 corrected |

Sprint assignment: all 18 are in the Jira sprint "AQP Sprint 1" (id 37) and carry the label `sprint-01`.

**The 13 added links (CR-34), all present in Jira:** AQP-48 blocks AQP-89; AQP-57 blocks AQP-90, AQP-113, AQP-122, AQP-123, AQP-130, AQP-142 and AQP-148; AQP-113 blocks AQP-122, AQP-123 and AQP-130; AQP-122 blocks AQP-123 and AQP-130. The "Depends on" line inside the eight stories' description text was not rewritten; each of the eight carries a Jira comment recording the added dependency, and the links are the structured record.

## Committed stories (in execution order)

| # | Story | Points | Depends on | Critical path | Status |
|---|-------|--------|-----------|---------------|--------|
| 1 | 10.01 AQP-27 | 8 | none | Yes | Draft |
| 2 | 10.02 AQP-28 | 5 | 10.01 | Yes | Draft |
| 3 | 01.01 AQP-38 | 5 | 10.01, 10.02 | Yes | Draft |
| 4 | 01.02 AQP-48 | 5 | 01.01 | Yes | Draft |
| 5 | 01.03 AQP-57 | 5 | 01.02 | No (but the scan must exist before any cost-bearing view, and seven later stories use it) | Draft |
| 6 | 01.04 AQP-65 | 3 | 01.02 | Yes | Draft |
| 7 | 01.07 AQP-74 | 5 | 01.02, 01.04 | Yes | Draft |
| 8 | 01.05 AQP-81 | 3 | 01.01, 01.04 | No | Draft |
| 9 | 01.06 AQP-89 | 2 | 01.01, 01.02 | No | Draft |
| 10 | 01.08 AQP-90 | 1 | 10.02, 01.02, 01.03 | No | Draft |
| 11 | 03.01 AQP-97 | 3 | 10.01 | Engine chain | Draft |
| 12 | 03.02 AQP-106 | 8 | 03.01 | Engine chain | Draft |

**Total committed:** 53 points / assumed capacity 55 points.

## Stretch stories (taken in this order if the committed set is on track at the mid-sprint review)

| # | Story | Points | Depends on | Why this order |
|---|-------|--------|-----------|----------------|
| 13 | 02.01 AQP-113 | 3 | 01.04, 01.07, 01.03, 03.01 | Feeds the first calculation (03.03); creates the master repository and service the next three extend |
| 14 | 02.03 AQP-122 | 3 | 01.04, 01.07, 01.03, 02.01 | Builds the SCR-13 tab shell the next two use |
| 15 | 02.04 AQP-123 | 2 | 01.04, 01.07, 01.03, 03.01, 02.01, 02.03 | Same |
| 16 | 02.05 AQP-130 | 2 | 01.04, 01.07, 01.03, 02.01, 02.03 | Same |
| 17 | 02.02 AQP-142 | 5 | 02.01, 01.03 | Largest master; needs the Process Master |
| 18 | 04.01 AQP-148 | 5 | 01.04, 01.02, 01.03 | First step of the workflow; independent of the masters |

**Total stretch:** 20 points. **Planned in all:** 73 points. Not in this sprint: 03.03 (the backlog lists it after the masters exist) and every rank above 18.

## Dependency order and critical path

```
10.01 ──▶ 10.02 ──▶ 01.01 ──▶ 01.02 ──▶ 01.04 ──▶ 01.07 ──▶ 02.01 ──▶ 02.03 ──▶ 02.04, 02.05
   │                   │         │ │        │                    └──▶ 02.02
   │                   │         │ ├──▶ 01.03 ──▶ 01.08, 02.01 to 02.05, 02.02, 04.01 (the scan)
   │                   │         │ └──▶ 01.06 (also needs 01.01)
   │                   │         └──▶ 04.01 (needs 01.04, 01.02, 01.03)
   │                   └──▶ 01.05 (also needs 01.04)       01.08 (needs 10.02, 01.02, 01.03)
   └──▶ 03.01 ──▶ 03.02          03.01 also feeds 02.01 and 02.04
```

Critical path: **10.01, 10.02, 01.01, 01.02, 01.04, 01.07, 02.01, 02.03, 02.04** (with 02.05 and 02.02 beside it). The engine chain (10.01, 03.01, 03.02) does not depend on the UI chain, so a second development stream could run it in parallel from the end of 10.01 and put the highest-uncertainty item of R1 in front of checkpoint A earlier. With one stream, keep the order above.

Dependencies the epics did not list and the stories added, **confirmed by the product-owner and present in Jira:** 01.07 after 01.04 (user events are wired into its service); 01.08 after 01.02 (manifest row); 02.01, 02.03, 02.04 and 02.05 after 01.07 (each master edit writes an audit entry); 02.04 after 03.01 (hint letters come from the registry, UX-23). **Added by the product-owner (CR-34):** 01.06 after 01.02; 01.03 before 01.08, 02.01 to 02.05 and 04.01 (the `canaryMasters` file and the scan they extend or run); 02.01 before 02.03, 02.04, 02.05 (the master repository and service); 02.03 before 02.04, 02.05 (the SCR-13 tab shell).

## Risks to the sprint goal

| Risk | Mitigation | Owner |
|------|------------|-------|
| **G4 is not yet decided.** DL-026 held it for G3 conditions 12, 13 and 15; the consistency report v0.3 says they are met in substance (UX closed in v0.4 and v0.6, the generator committed in 89a9c00 with the delivery lead's acceptance in comment 10576, the test plan committed in 5b46e00). BLK-03 can clear; the master decides, and has not yet recorded the whole-order rule, D-25 to D-37 or PRD 13.4 (CR-23). No story branch starts before the decision | The master records CR-23 and decides G4; stories turn Ready after it | master |
| The scaffold, CI and tokens are not shown to be enough hours (architecture 16.11); 10.01 (now with AC-10) and 10.02 sit on the critical path | They are first; checkpoint A reads their actual size; the committed set is 53 against 55, with no slack for a second overrun, so the stretch stories are the first to go | scrum-master; developer |
| 03.02 (8 points) is the highest-uncertainty item and the largest | The split line is named in the story (graph and internal-form tasks as 03.02b); the product-owner agrees the split, it is not taken silently (backlog section 7) | scrum-master; product-owner |
| A first Gitleaks run over history reports a finding in public history | Do not suppress; report BLOCKED. Removing anything from public history needs the delivery lead's explicit authorisation (ADR-014) | developer; Santhosh |
| The DL-017 evidence for 10.02 (real phone, screen reader, high-contrast) | The delivery lead has supplied the devices (comment 10573). Phone on the same Wi-Fi with `npx next dev -H 0.0.0.0`; the checklist is sub-task T9. If a check cannot be done G7 returns NO-GO for 10.02 | qa-engineer; Santhosh |
| The seed Process Master items need stable IDs and a production loader for the seed configuration; "Other" needs a creation step; the architecture states neither (assumption A-1 in 03.01, 02.01, 02.05) | Open with the solution-architect (IMP-S1-02); the stories carry the assumption; no AC depends on it | solution-architect |
| Real values reaching the public repository (RISK-006) | 10.01 secret scan, data-file check and the `n.37` pattern test; all fixtures invented | developer; reviewer-standards |
| The scan proves the mechanism only: few Engineer routes exist in sprint 1 (ARCH-R2) | Each master story adds its values to `canaryMasters` as an AC; the scan iterates the manifest | developer |
| A test run against a live database | 10.01 AC-10: the global test set-up refuses a non-local connection and `NODE_ENV=production` | developer; qa-engineer |

## Impediments

Proposed for the ledger (the orchestrator records them).

| ID | Description | Impact | Owner | Action | Target date | Status |
|----|-------------|--------|-------|--------|-------------|--------|
| BLK-03 (existing) | The ux-expert was stopped from the delivery lead's side. Conditions 12, 13 and 15 are met in substance (consistency report v0.3), so the blocker can clear | G4 waits for the master's decision | master; Santhosh | The master decides G4 and records CR-23 | Before sprint start | Open, can clear |
| IMP-S1-01 | The test plan (G3 condition 15) was absent | None now | qa-engineer | `docs/07-qa/test-plan.md` exists (5b46e00) | n/a | **Closed** |
| IMP-S1-02 | The seed Process Master IDs, the production loader of the seed configuration and the creation of "Other" are not stated in the architecture (A-1) | 03.01, 02.01 and 02.05 carry an assumption | solution-architect | Confirm or replace the assumption in the architecture | Before 03.01 starts | Open |
| IMP-S1-03 | A real phone, a screen reader and Windows high-contrast mode are needed for 10.02 at its G7 (DL-017) | 10.02 cannot be accepted without them | qa-engineer; Santhosh | The delivery lead has supplied the devices (comment 10573); agree how the phone reaches the dev server | Before 10.02 reaches G7 | **Answered**; the check itself is done at G7 |

## Sequencing note from the coordinator (architecture v0.10)

The password step-up check ships in Release 1 with FR-107 and FR-108. **Answered by the product-owner: STORY-06.14 (the step-up check, enabler, EPIC-06) is its own story, ranked before 06.12 (cancel approval) and 06.13 (remove price)** (`backlog.md` rank 47). It is not in this sprint. One preparation stays useful: 01.01 builds the argon2 verification and throttling and 01.05 the password-change throttle on its own key; the step-up needs a third key (architecture §6) and gives 422 `STEP_UP_FAILED`, not 401. The developer should keep password verification in one shared function so 06.14 reuses it. This is a recommendation, not an acceptance criterion of any story here.

## Pick-up notes from the product-owner's validation (not DoR items)

| Story | Note |
|-------|------|
| 10.02 AQP-28 | The risk text names the untracked generator and BLK-03, both closed; the devices for AC-9 are supplied (comment 10573) |
| 01.01 AQP-38 | AC-2 needs a stated timing tolerance in the test; SCR-01 and UJ-01 differ on whether the password field is cleared (CR-32) |
| 01.02 AQP-48 | State once whether an Engineer on a Lead or Admin route gets 403 or the uniform 404 (CR-33) |
| 01.04 AQP-65 | BR-005 belongs to the hand-over and step-up; this story's rule is BR-001 |
| 01.05 AQP-81 | Add 10 and 128 characters as accepted cases to AC-1 (test strategy 7 lists them) |
| 03.01 AQP-97 | The solution-architect confirms assumption A-1 first (IMP-S1-02); it changes no AC |
| 03.02 AQP-106 | The split line (03.02b) is agreed with the product-owner, not taken silently |

## Rules that apply to every story in this sprint

1. **Definition of Ready.** Ready only after the product-owner validates and the master decides G4. Nine stories passed validation and nine were corrected (above); all 18 stay Draft until G4.
2. **Direct commands.** Testing notes use `npx vitest run`, `npx eslint .`, `npx tsc --noEmit`, `npx prisma generate`, `npx prisma migrate deploy`, `npx next build`, `npx next dev`, `npx playwright test`, `docker compose -f compose.dev.yml …`, `npm ci` and `npm audit`. They never use `npm run`. CLAUDE.md §1 and test-strategy §10 still name the `npm run` forms; `package.json` may keep them as aliases.
3. **Every story that adds a Restricted table or an Engineer-reachable route** adds its values to `canaryMasters` and its route to the manifest, and the canary scan must still find 0 (stories 01.03, 02.x, 04.01).
4. **Every UI story** carries NFR-016, 017 and 018 as one acceptance criterion and a Playwright spec at 360×800, 768×1024 and 1366×768 with axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) and a keyboard-only run.
5. **The delivery lead sees each page as it is built.** Story 10.02 gives the exact commands to run the portal locally (note and acceptance criterion AC-10 on AQP-28). Every later UI story's hand-off states the page URL to open and any new command.
6. **Every master edit, user change and later approval event writes one audit entry** in the caller's transaction (01.07).
7. **Test data is invented** and follows the `n.37` pattern for numbers. No cell value from the sample workbook is read into code, tests, fixtures or documents. No real e-mail, name or secret appears anywhere.
8. Branches are `feat/<JIRA-KEY>-<slug>`; commits carry the key; nothing is committed or pushed by this role.

## Issues for other roles

| Owner | Issue |
|-------|-------|
| product-owner | Re-validate the nine corrected stories (10.01 AC-10 and sub-task AQP-164; the 13 links). The "Depends on" text inside the eight link-corrected descriptions was not rewritten (a Jira comment records it); say if the description text should be rewritten too |
| solution-architect | (1) Fixed IDs and a production loader for the 14 seed Process Master items and for the seed configuration (A-1 in 03.01, 02.01). (2) How "Other" is created (A-1 in 02.05). (3) What a draft estimate shows when its treatment is deleted, since `treatments` has no `deleted_at` (before story 05.06). (4) Whether sign-out should also raise `session_version`. (5) Name the two database roles and who creates them on a production install (10.01 A-1). (6) State once what an Engineer gets on a Lead or Admin route, 403 or the uniform 404 (CR-33) |
| ux-expert | SCR-01 "clears nothing else" against UJ-01 "field values kept except the password" (CR-32) |
| product-manager | FR-011's fit criterion still calls the audit screen PROPOSED (CR-29). The `npm run` forms in CLAUDE.md §1 and test-strategy §10 differ from the direct commands used here |
| master | Record CR-23 and decide G4. The stories are written, validated in part and wait |

## Not Ready, and why

None of the 18 is Ready; all are **Draft** because Ready follows the master's G4 decision. Where they stand:
- **Passed the DoR (9):** 10.02, 01.01, 01.02, 01.03, 01.04, 01.07, 01.05, 03.01, 03.02.
- **Corrected, awaiting re-validation (9):** 10.01, 01.06, 01.08, 02.01, 02.03, 02.04, 02.05, 02.02, 04.01.
- **03.01, 02.01 and 02.05** carry labelled assumptions (A-1) the solution-architect should confirm; none changes an acceptance criterion.
- No story is held by an open question: the open ones (Q-38, Q-39, OQ-ARCH-02, 03, 11, 12, Q-18) do not touch ranks 1 to 18.

---
# Sprint 01 Review & Retrospective  _(completed at sprint close)_
## Outcome
Planned vs completed, sprint goal met? (Y/N + why) — to be written at sprint close.
## Metrics
| Metric | Value |
|--------|-------|
| Velocity | |
| Avg cycle time per story | |
| Avg review loops per story | |
| Findings by severity (review) | |
| Defects found in QA (by severity) | |
| Escaped defects | |
## Demo Notes
## Retrospective
| Went well | To improve | Action (owner, due) |
|-----------|-----------|---------------------|
**Improvements to agents / templates / standards:** to be written at sprint close.
