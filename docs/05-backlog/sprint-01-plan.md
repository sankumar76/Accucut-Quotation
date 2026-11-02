# Sprint 01 Plan

| Field | Value |
|-------|-------|
| Dates | Not adopted. No date model is adopted (project state; DL-014), and no story branch may start before G4, which is held by BLK-03 (DL-026). The Jira sprint "AQP Sprint 1" (id 37, state future) holds the 18 stories and is not started. Dates are set when G4 passes and the delivery lead starts the sprint |
| Sprint goal | By the end of the sprint a person can sign in to a responsive Red Leads portal, an Admin can manage users, read the audit record and keep the rate, material, customer and exchange-rate masters, a Lead can assign a task, and the formula engine and field registry are ready for the calculation, all built under the secret scan and the cost-confidentiality scan |
| Capacity assumption | **Assumed 55 points for the committed set; the sprint is planned at 73 points with 18 points of stretch above it.** There is no velocity: this is the first sprint. The number is a calibration, not a forecast. The basis is the dependency chain (10.01 then 10.02 then the sign-in chain is serial), the largest items (10.01 at 8, 03.02 at 8) and the architect's warning that the scaffold hours are not shown to be enough (architecture 16.11). The sprint review sets the real velocity |
| Facilitator | scrum-master |
| Inputs | `backlog.md` v0.2 (ranks 1 to 18), `consistency-report.md` v0.2, epics EPIC-01 to 04 and 10, PRD v0.10, architecture v0.10 (content unchanged since v0.9 for every section cited here), UX spec v0.6, test strategy v0.9, SPEC v1.12 (the task named v1.11; v1.12 only corrects §10 CR-24), Definition of Ready |
| System of record | Jira project AQP (CLAUDE.md §7). **No story Markdown files exist for these stories.** This file is the plan; the stories are the Jira issues below |

## Jira stories (all Draft, label `sprint-01`)

Estimates are Fibonacci story points, stored in the Jira field "Story point estimate". Every story has sub-tasks (one per top-level task, with AC IDs in the summary) and "is blocked by" links.

| Rank | Story | Jira | Epic | Points | Sub-tasks | Blocked by |
|------|-------|------|------|--------|-----------|------------|
| 1 | 10.01 Scaffold, CI and repository hygiene (enabler) | [AQP-27](https://sankumar76.atlassian.net/browse/AQP-27) | AQP-25 | 8 | 9 (AQP-29 to 37) | none |
| 2 | 10.02 Design tokens and responsive app shell (enabler) | [AQP-28](https://sankumar76.atlassian.net/browse/AQP-28) | AQP-25 | 5 | 9 (AQP-39 to 47) | AQP-27 |
| 3 | 01.01 Sign in and sign out | [AQP-38](https://sankumar76.atlassian.net/browse/AQP-38) | AQP-16 | 5 | 8 (AQP-49 to 56) | AQP-27, AQP-28 |
| 4 | 01.02 Role enforcement and navigation per role | [AQP-48](https://sankumar76.atlassian.net/browse/AQP-48) | AQP-16 | 5 | 7 (AQP-58 to 64) | AQP-38 |
| 5 | 01.03 Engineer sees no cost: projection and scan | [AQP-57](https://sankumar76.atlassian.net/browse/AQP-57) | AQP-16 | 5 | 8 (AQP-66 to 73) | AQP-48 |
| 6 | 01.04 Admin creates and deactivates users; one Admin | [AQP-65](https://sankumar76.atlassian.net/browse/AQP-65) | AQP-16 | 3 | 6 (AQP-75 to 80) | AQP-48 |
| 7 | 01.07 Audit service and audit screen | [AQP-74](https://sankumar76.atlassian.net/browse/AQP-74) | AQP-16 | 5 | 7 (AQP-82 to 88) | AQP-48, AQP-65 |
| 8 | 01.05 Password rule and change own password | [AQP-81](https://sankumar76.atlassian.net/browse/AQP-81) | AQP-16 | 3 | 6 (AQP-91 to 96) | AQP-38, AQP-65 |
| 9 | 01.06 12-hour session | [AQP-89](https://sankumar76.atlassian.net/browse/AQP-89) | AQP-16 | 2 | 5 (AQP-98 to 102) | AQP-38 |
| 10 | 01.08 About page | [AQP-90](https://sankumar76.atlassian.net/browse/AQP-90) | AQP-16 | 1 | 3 (AQP-103 to 105) | AQP-28, AQP-48 |
| 11 | 03.01 Field registry seed and column letters | [AQP-97](https://sankumar76.atlassian.net/browse/AQP-97) | AQP-18 | 3 | 6 (AQP-107 to 112) | AQP-27 |
| 12 | 03.02 Formula engine | [AQP-106](https://sankumar76.atlassian.net/browse/AQP-106) | AQP-18 | 8 | 8 (AQP-114 to 121) | AQP-97 |
| 13 | 02.01 Process Master list and edit | [AQP-113](https://sankumar76.atlassian.net/browse/AQP-113) | AQP-17 | 3 | 6 (AQP-124 to 129) | AQP-65, AQP-74, AQP-97 |
| 14 | 02.03 Material Master | [AQP-122](https://sankumar76.atlassian.net/browse/AQP-122) | AQP-17 | 3 | 6 (AQP-131 to 136) | AQP-65, AQP-74 |
| 15 | 02.04 Exchange Rate Master | [AQP-123](https://sankumar76.atlassian.net/browse/AQP-123) | AQP-17 | 2 | 5 (AQP-137 to 141) | AQP-65, AQP-74, AQP-97 |
| 16 | 02.05 Treatment / Color list | [AQP-130](https://sankumar76.atlassian.net/browse/AQP-130) | AQP-17 | 2 | 5 (AQP-143 to 147) | AQP-65, AQP-74 |
| 17 | 02.02 Customers with default rates and Reset to Defaults | [AQP-142](https://sankumar76.atlassian.net/browse/AQP-142) | AQP-17 | 5 | 7 (AQP-149 to 155) | AQP-113 |
| 18 | 04.01 Assign a task | [AQP-148](https://sankumar76.atlassian.net/browse/AQP-148) | AQP-19 | 5 | 8 (AQP-156 to 163) | AQP-65, AQP-48 |
| | **Total** | | | **73** | **119** | |

Sprint assignment: all 18 are in the Jira sprint "AQP Sprint 1" (id 37) and carry the label `sprint-01`.

## Committed stories (in execution order)

| # | Story | Points | Depends on | Critical path | Status |
|---|-------|--------|-----------|---------------|--------|
| 1 | 10.01 AQP-27 | 8 | none | Yes | Draft |
| 2 | 10.02 AQP-28 | 5 | 10.01 | Yes | Draft |
| 3 | 01.01 AQP-38 | 5 | 10.01, 10.02 | Yes | Draft |
| 4 | 01.02 AQP-48 | 5 | 01.01 | Yes | Draft |
| 5 | 01.03 AQP-57 | 5 | 01.02 | No (but the scan must exist before any cost-bearing view) | Draft |
| 6 | 01.04 AQP-65 | 3 | 01.02 | Yes | Draft |
| 7 | 01.07 AQP-74 | 5 | 01.02, 01.04 | Yes | Draft |
| 8 | 01.05 AQP-81 | 3 | 01.01, 01.04 | No | Draft |
| 9 | 01.06 AQP-89 | 2 | 01.01 | No | Draft |
| 10 | 01.08 AQP-90 | 1 | 10.02, 01.02 | No | Draft |
| 11 | 03.01 AQP-97 | 3 | 10.01 | Engine chain | Draft |
| 12 | 03.02 AQP-106 | 8 | 03.01 | Engine chain | Draft |

**Total committed:** 53 points / assumed capacity 55 points.

## Stretch stories (taken in this order if the committed set is on track at the mid-sprint review)

| # | Story | Points | Depends on | Why this order |
|---|-------|--------|-----------|----------------|
| 13 | 02.01 AQP-113 | 3 | 01.04, 01.07, 03.01 | Feeds the first calculation (03.03) |
| 14 | 02.03 AQP-122 | 3 | 01.04, 01.07 | Same |
| 15 | 02.04 AQP-123 | 2 | 01.04, 01.07, 03.01 | Same |
| 16 | 02.05 AQP-130 | 2 | 01.04, 01.07 | Same |
| 17 | 02.02 AQP-142 | 5 | 02.01 | Largest master; needs the Process Master |
| 18 | 04.01 AQP-148 | 5 | 01.04, 01.02 | First step of the workflow; independent of the masters |

**Total stretch:** 20 points. **Planned in all:** 73 points. Not in this sprint: 03.03 (the backlog lists it after the masters exist) and every rank above 18.

## Dependency order and critical path

```
10.01 ──▶ 10.02 ──▶ 01.01 ──▶ 01.02 ──▶ 01.04 ──▶ 01.07 ──▶ 02.01 ──▶ 02.02
   │                   │         │          │         └──────▶ 02.03, 02.04, 02.05
   │                   │         ├──▶ 01.03 └──▶ 01.05 (also needs 01.01)
   │                   ├──▶ 01.06           04.01 (needs 01.04, 01.02)
   │                   └──▶ 01.05          01.08 (needs 10.02, 01.02)
   └──▶ 03.01 ──▶ 03.02          03.01 also feeds 02.01 and 02.04
```

Critical path: **10.01, 10.02, 01.01, 01.02, 01.04, 01.07, 02.01, 02.02**. The engine chain (10.01, 03.01, 03.02) does not depend on the UI chain, so a second development stream could run it in parallel from the end of 10.01 and put the highest-uncertainty item of R1 in front of checkpoint A earlier. With one stream, keep the order above.

Dependencies that the epics did not list and the stories add (the product-owner confirms): 01.07 after 01.04 (user events are wired in); 01.08 after 01.02 (manifest row); 02.01, 02.03, 02.04, 02.05 after 01.07 (each master edit writes an audit entry, an epic acceptance criterion); 02.04 after 03.01 (hint letters come from the registry, UX-23).

## Risks to the sprint goal

| Risk | Mitigation | Owner |
|------|------------|-------|
| **G4 is not decided and cannot pass while G3 conditions 12 and 13 are open (BLK-03, DL-026):** no story branch may start | The stories are written and wait. Delivery lead says "restart UX", gives the reason, or overrides with a log entry; then the master decides G4. The sprint does not start before | Santhosh; master |
| The scaffold, CI and tokens are not shown to be enough hours (architecture 16.11); 10.01 and 10.02 sit on the critical path | They are first; checkpoint A reads their actual size; the committed set is 53 against 55, with no slack for a second overrun, so the stretch stories are the first to go | scrum-master; developer |
| 03.02 (8 points) is the highest-uncertainty item and the largest | Split line named in the story (graph and internal-form tasks as 03.02b) if the first half is not done at the mid-sprint review; the product-owner agrees the split, it is not done silently | scrum-master; product-owner |
| A first Gitleaks run over history reports a finding in public history | Do not suppress; report BLOCKED. Removing anything from public history needs the delivery lead's explicit authorisation (ADR-014) | developer; Santhosh |
| The DL-017 evidence for 10.02 (real phone, screen reader, high-contrast) needs a device and a way to reach the dev server; no staging exists until 10.04 and Q-18 | Phone on the same Wi-Fi with `npx next dev -H 0.0.0.0`; qa-engineer prepares the checklist during 10.02 (sub-task T9); if a check cannot be done, G7 returns NO-GO for 10.02 and the next UI stories wait | qa-engineer; Santhosh |
| The test plan (G3 condition 15) does not exist; `docs/07-qa/` holds only `defects/` | qa-engineer owes it by G4; 10.02 cannot reach G7 without it | qa-engineer |
| The seed Process Master items need stable IDs and a production loader for the seed configuration; the architecture does not state either (assumption A-1 in 03.01 and 02.01; A-1 in 02.05 for "Other") | Raised to the solution-architect below; stories carry the assumption; no AC depends on it | solution-architect |
| Real values reaching the public repository (RISK-006) | 10.01 secret scan, data-file check and the `n.37` pattern test; all fixtures invented | developer; reviewer-standards |
| The scan proves the mechanism only: few Engineer routes exist in sprint 1 (ARCH-R2) | Each master story adds its values to `canaryMasters` as an AC; the scan iterates the manifest | developer |

## Impediments

Proposed for the ledger (the orchestrator records them; none is a new blocker beyond BLK-03).

| ID | Description | Impact | Owner | Action | Target date | Status |
|----|-------------|--------|-------|--------|-------------|--------|
| BLK-03 (existing) | The ux-expert is stopped from the delivery lead's side; G3 conditions 12 and 13 stay open; G4 cannot pass (DL-026) | No story can start; sprint 01 cannot begin | Santhosh | Say "restart UX", give the reason, or override and have it logged | Before sprint start | Open |
| IMP-S1-01 | The test plan (G3 condition 15) is absent | 10.02 cannot reach G7; every story's QA step lacks its plan | qa-engineer | Write `docs/07-qa/test-plan.md` | G4 | Open |
| IMP-S1-02 | The seed Process Master IDs and the production loader of the seed configuration are not stated in the architecture (A-1) | 03.01, 02.01 and 02.05 carry an assumption | solution-architect | Confirm or replace the assumption in the architecture | Before 03.01 starts | Open |
| IMP-S1-03 | A real phone, a screen reader and Windows high-contrast mode are needed for 10.02 at its G7 (DL-017) | 10.02 cannot be accepted without them | qa-engineer; Santhosh (device) | Agree the device and the way the phone reaches the dev server | Before 10.02 reaches G7 | Open |

## Sequencing note from the coordinator (architecture v0.10)

The password step-up check now ships in Release 1 with FR-107 and FR-108 (cancel approval, remove price), and must be ordered **ahead of** the cancel and remove story. This sprint's ranks 1 to 18 are not affected. For the backlog: the step-up primitive is currently an item inside STORY-06.12 (cancel approval). It should be a story or a first task that precedes 06.12 and 06.13, and 01.09 and 08.02 to 08.06 reuse it. I did not change `backlog.md` or an epic file (the product-owner's artefacts); I propose this to the product-owner to rank. Two things in this sprint prepare it: 01.01 builds the argon2 verification and throttling, and 01.05 builds the password-change throttle on its own key. The step-up check needs a third, separate key (architecture §6: "Step-up has its own key, so a mistyped password in a dialog cannot lock an Admin out of signing in") and a wrong password gives 422 `STEP_UP_FAILED`, not 401. The developer should keep the password verification in one shared function so step-up reuses it; this is a recommendation and not an acceptance criterion of any story here.

## Rules that apply to every story in this sprint

1. **Definition of Ready.** No story is Ready until the product-owner validates it. All 18 are Draft.
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
| product-owner | Validate all 18 stories against the DoR; confirm the added dependencies (above); decide the step-up ordering for `backlog.md`; confirm that 01.07 wires the user events (the epic lists the audit events for later epics) and that the sign-in placeholder `/queue` (until 04.02) is acceptable; the epics list FR-012's "new item present on all customers" under 02.01 while the stories deliver it in 02.02, where `customer_rates` is created |
| solution-architect | (1) Fixed IDs and a production loader for the 14 seed Process Master items and for the seed configuration (A-1 in 03.01, 02.01). (2) How "Other" is created (A-1 in 02.05). (3) What a draft estimate shows when its treatment is deleted, since `treatments` has no `deleted_at` (before story 05.06). (4) Whether sign-out should also raise `session_version` (ADR-009 accepts the JWT; a copied cookie outlives sign-out). (5) Name the two database roles and who creates them on a production install (10.01 A-1) |
| ux-expert | SCR-01 says a failed attempt "clears nothing else"; UJ-01 says the password is cleared: the stories keep the e-mail and move focus to the notice and leave the password field alone; say which. CR-29 stale rows still stand |
| product-manager | FR-011's fit criterion still calls the audit screen PROPOSED (CR-29). The `npm run` forms in CLAUDE.md §1 and test-strategy §10 differ from the direct commands used here |
| qa-engineer | The test plan (IMP-S1-01); the DL-017 checklist for 10.02 |
| master | G4 (BLK-03). The stories are written and wait |

## Not Ready, and why

None of the 18 is Ready. All are **Draft** because the product-owner has not validated them (rule 1). In addition:
- **G4 is not decided** (BLK-03), so no story may start whatever its status.
- **03.01, 02.01 and 02.05** carry labelled assumptions (A-1) that the solution-architect should confirm; none changes an acceptance criterion, so they are not blocked.
- **02.01 to 02.05** are stretch; **10.02** cannot reach G7 until the test plan exists and the real-device checks are possible.
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
