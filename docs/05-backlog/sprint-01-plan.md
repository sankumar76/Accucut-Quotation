# Sprint 01 Plan

| Field | Value |
|-------|-------|
| Version | 0.8 (2026-11-05, DL-099: the DL-095 trigger fired (nightly CI-time p95 15 min 05 s, over the 9-minute limit), so STORY-10.14 (AQP-199, 3 points) moves from the stretch to the committed set and STORY-01.06 (AQP-89, 2 points) steps out to the head of the stretch; committed 55 of 55, slack 0; stretch 31; planned 86; AQP-65's G6 is held until AQP-199 merges, its development and reviews continue; DEF-015 (Jira AQP-206, GitHub #88, re-scoped by DL-100: type Environment, Sev-3, the unbounded `playwright install --with-deps` download that slowed one run; fixed as its own defect PR after AQP-199 merges, in the first idle merge wait, chain work first, due before sprint 1 ends; a Bug with no points, label `sprint-01`; product-manager, AQP-199 comment 10996); RISK-023 is 8); 0.7 (2026-11-05: STORY-10.14 (AQP-199, 3 points, the CI-time enabler: DL-095, RISK-023, PRF-02) is added as the first story of the stretch, rank 12c; committed stays 54 of 55, stretch 32, planned 86, 21 stories, 144 sub-tasks, 57 links; if the nightly p95 passes 9 minutes before it merges it moves to committed and AQP-89 steps out); 0.6 (2026-11-04: the #61 enabler STORY-10.13 (AQP-188, 5 points) is added and committed, and STORY-10.10 (AQP-169) moves from the stretch to the committed set, because both are predecessors of committed stories (AQP-169 blocks AQP-188; AQP-188 blocks AQP-48, 65, 74, 81 and 89), on the master's DL-080 and the product-manager's DL-081 (PRD v0.14 13.9, release plan v0.15 3.8); AQP-57 (5), AQP-81 (3) and AQP-90 (1) move to the head of the stretch; committed 54 of 55, stretch 29, planned 83; the sprint goal is reworded so the cost-confidentiality scan arrives with 01.03; see "Change of 2026-11-04" below); 0.5 (2026-11-03: the NFR-009 enabler STORY-10.10 (AQP-169, 5 points) is added at the head of the stretch set, on the solution-architect's test strategy v0.13 section 10.4 and the master's G6 decision on AQP-28 (DL-053, RISK-020); the committed set is unchanged at 53 of 55; AQP-169 was validated READY, 17 of 17, and moved to Ready for Dev the same day; see "Change of 2026-11-03" below); 0.4 (2026-11-02: G4 CONDITIONAL GO, attempt 2 (AQP-1 comment 10643); conditions 1 and 3 done: the 18 stories read Ready for Dev and the way of working is named below; 0.3 applied architecture v0.11 section 16.15, see "Changes from architecture v0.11"; 0.2 refreshed the plan after the product-owner's Definition of Ready validation, `backlog.md` section 7, and consistency report CR-34 and CR-35; 0.1 was written before that validation) |
| Dates | Not adopted. No date model is adopted (project state; DL-014). The Jira sprint "AQP Sprint 1" (id 37, state future) holds the 20 stories (the 18 of G4 attempt 2, AQP-169, and AQP-188 since 2026-11-04) and is not started. No story branch starts before G4, which is the master's decision; the delivery lead starts the sprint after it. Dates are set then |
| Sprint goal | By the end of the sprint a person can sign in to a responsive Red Leads portal whose pages stay inside the first-load JavaScript budget, an Admin can manage users and read the audit record, and the formula engine and field registry are ready for the calculation, all built under the secret scan; if the stretch is reached, the cost-confidentiality scan arrives with 01.03 (first in the stretch), followed by change password and the About page, then the masters and Assign a task (reworded 2026-11-04, DL-081) |
| Capacity assumption | **Assumed 55 points for the committed set (55 points, 11 stories; v0.8, DL-099); 31 points of stretch (10 stories); 86 points planned in all.** There is no velocity: this is the first sprint. The number is a calibration, not a forecast. The basis is the dependency chain (10.01, then 10.02, then the sign-in chain is serial), the largest items (10.01 and 03.02 at 8 points each) and the architect's warning that the scaffold hours are not shown to be enough (architecture 16.11). The sprint review sets the real velocity. **2026-11-03:** STORY-10.10 (5 points) is stretch, so the committed 53 of 55 is unchanged and the planned total is 78 points. **2026-11-04:** STORY-10.10 and STORY-10.13 (AQP-188, 5 points) are predecessors of committed stories, so both are committed (63 of 55), and AQP-57, AQP-81 and AQP-90 (9 points) move to the head of the stretch: committed 54 of 55, slack 1, stretch 29, planned 83 (DL-081) |
| Facilitator | scrum-master |
| Inputs | `backlog.md` v0.3 (ranks 1 to 18 and section 7), `consistency-report.md` v0.3 (CR-34, CR-35), epics EPIC-01 to 04 and 10, PRD v0.11, architecture v0.10, UX spec v0.6, test strategy v0.9 (section 10 of v0.13 for 10.10), test plan v0.1 (`docs/07-qa/test-plan.md`), SPEC v1.12, Definition of Ready |
| System of record | Jira project AQP (CLAUDE.md §7). **No story Markdown files exist for these stories.** This file is the plan; the stories are the Jira issues below |

## Definition of Ready status (product-owner, 2026-11-02)

The product-owner validated all 18 stories, first on 16 DoR items (`backlog.md` section 7) and then, in remediation 2, on all 17: **READY, 17 of 17, on all 18** (comment 10641). Nine had needed one correction each (CR-34): 10.01 gained AC-10 (the database guard the test plan asks for, and sub-task T10, AQP-164); eight stories gained the missing "is blocked by" links (13 links, listed below).

**G4 was decided CONDITIONAL GO on 2026-11-02 (attempt 2, comment 10643).** Under its conditions 1 and 3 the scrum-master moved **all 18 stories to Ready for Dev** (checked by search: 18 read Ready for Dev, 0 do not) and confirmed the 11 Trace lines below. **2026-11-03:** AQP-169 (10.10) was added. The product-owner validated it READY, 17 of 17 (AQP-169 comment 10726, AQP-1 10728), with wording corrections to AC-1, AC-2 and the Dev Context and no change to its estimate, links or dependencies, and the scrum-master moved it to Ready for Dev. That makes **19 of 19 validated and 19 Ready for Dev.** The master's G4 position for a story added after attempt 2 is the master's call. **2026-11-04:** AQP-188 (10.13) is added as **Draft**. The solution-architect settled its ACs and design (AQP-188 comments 10862, 10863, 10870, 10871) and the product-manager confirmed its target and accepted it into sprint 1 (10867, 10868; DL-081), but the **product-owner has not yet validated it**, so it is not Ready for Dev. That makes 20 stories: 19 Ready for Dev, 1 Draft.

**Trace lines the product-owner corrected (DL-039), confirmed by the scrum-master:** AQP-48 (BR-002, 003, 004), AQP-57 (BR-003, 004), AQP-65 (BR-001, 004), AQP-90 (BR-003), AQP-97 (BR-003, 008, 023, 026, 027, 034, 036, 047), AQP-106 (FR-027 and BR-025 added to BR-021, 024, 036, 037), AQP-113 (FR-011; BR-003, 004, 021, 030, 032), AQP-122 (FR-011; BR-003, 004, 033), AQP-130 (FR-011; BR-003, 004), AQP-142 (FR-011; BR-003, 004, 028, 029, 030, 032), AQP-148 (BR-002, 004, 045, 052). Each line was read against the story's acceptance criteria and the business-rule catalogue (BR-001 to 005, 008, 021, 023, 025 to 036, 045, 047, 052); every added ID is asserted by an AC and none is invented. **No disagreement to raise.** One tidy-up: the scrum-master's own "DoR self-check" paragraph inside several stories still names the shorter BR list; the Trace line and the PO Validation section are the record.

## Way of working assumed (condition 3 of G4 attempt 2; release plan v0.12 section 3.3, DL-041)

**Until the delivery lead chooses another way, this plan assumes way 1: one pull request per story, and the delivery lead merges each within half a working day.**

- Each story has its own branch `feat/<JIRA-KEY>-<slug>` from `master` and its own PR. A story that depends on another starts its branch **after** the earlier one is merged (no stacked branches, no bundled PRs).
- Code PRs are merged by a human (`MERGE_POLICY`: docs-auto, code-human). The orchestrator does not merge code after G7 (that is way 5, which needs the delivery lead's explicit word).
- Why this matters: sprint 1's longest chain is 8 to 9 stories, so it has 7 to 8 merge waits. The product-manager's model puts sprint 1 at about 5.85 days for 2.4 days of work at a half-day merge, and the merge turnaround is the largest input to every date (release plan v0.12). From 2026-11-04 the two enablers (AQP-169, AQP-188) stand in series before AQP-48, so the chain has two more merge waits; the product-manager's upper-bound arithmetic puts the central date at Fri 2026-11-27 and the high end at Wed 2026-12-16 (release plan v0.15 3.8; model not re-run). **No date is adopted.** The 54-point commitment (53 until 2026-11-04) and the 55-point capacity are stated without a velocity (above) and do not allow for a slower merge than half a day.
- The other ways, for the delivery lead to choose by name (release plan 3.3): 2 fixed merge times twice a day; 3 stacked branches; 4 bundled PRs; 5 the orchestrator merges after G7 GO. If they name one, or a different turnaround (for example a whole day), this section and the capacity row change at the next sprint plan; silence leaves way 1 at half a day and is not a stop (condition 2, orchestrator).
- The ceiling on backup copies (A-36, about 5 to 6 GB of data) is for the orchestrator to tell them; it does not touch these stories.

## Jira stories (21; AQP-199 is Draft until the product-owner validates it; the other 20 were Ready for Dev or validated as of v0.6; label `sprint-01`)

Estimates are Fibonacci story points in the Jira field "Story point estimate". Every story has sub-tasks (one per top-level task, AC IDs in the summary) and "is blocked by" links. The "Blocked by" column shows the 28 links of v0.1 plus the 13 added for CR-34 (marked +), the 2 of AQP-169, and from 2026-11-04 the 12 added for AQP-188 (marked ++).

| Rank | Story | Jira | Epic | Points | Sub-tasks | Blocked by | PO validation |
|------|-------|------|------|--------|-----------|------------|---------------|
| 1 | 10.01 Scaffold, CI and repository hygiene (enabler) | [AQP-27](https://sankumar76.atlassian.net/browse/AQP-27) | AQP-25 | 8 | 10 (AQP-29 to 37, AQP-164) | none | Corrected (AC-10) |
| 2 | 10.02 Design tokens and responsive app shell (enabler) | [AQP-28](https://sankumar76.atlassian.net/browse/AQP-28) | AQP-25 | 5 | 9 (AQP-39 to 47) | AQP-27 | Pass |
| 3 | 01.01 Sign in and sign out | [AQP-38](https://sankumar76.atlassian.net/browse/AQP-38) | AQP-16 | 5 | 8 (AQP-49 to 56) | AQP-27, AQP-28 | Pass |
| 4 | 01.02 Role enforcement and navigation per role | [AQP-48](https://sankumar76.atlassian.net/browse/AQP-48) | AQP-16 | 5 | 7 (AQP-58 to 64) | AQP-38, ++AQP-188 | Pass |
| 5 | 01.03 Engineer sees no cost: projection and scan | [AQP-57](https://sankumar76.atlassian.net/browse/AQP-57) | AQP-16 | 5 | 8 (AQP-66 to 73) | AQP-48 | Pass |
| 6 | 01.04 Admin creates and deactivates users; one Admin | [AQP-65](https://sankumar76.atlassian.net/browse/AQP-65) | AQP-16 | 3 | 6 (AQP-75 to 80) | AQP-48, ++AQP-188 | Pass |
| 7 | 01.07 Audit service and audit screen | [AQP-74](https://sankumar76.atlassian.net/browse/AQP-74) | AQP-16 | 5 | 7 (AQP-82 to 88) | AQP-48, AQP-65, ++AQP-188 | Pass |
| 8 | 01.05 Password rule and change own password | [AQP-81](https://sankumar76.atlassian.net/browse/AQP-81) | AQP-16 | 3 | 6 (AQP-91 to 96) | AQP-38, AQP-65, ++AQP-188 | Pass |
| 9 | 01.06 12-hour session | [AQP-89](https://sankumar76.atlassian.net/browse/AQP-89) | AQP-16 | 2 | 5 (AQP-98 to 102) | AQP-38, +AQP-48, ++AQP-188 | Corrected (link) |
| 10 | 01.08 About page | [AQP-90](https://sankumar76.atlassian.net/browse/AQP-90) | AQP-16 | 1 | 3 (AQP-103 to 105) | AQP-28, AQP-48, +AQP-57 | Corrected (link) |
| 11 | 03.01 Field registry seed and column letters | [AQP-97](https://sankumar76.atlassian.net/browse/AQP-97) | AQP-18 | 3 | 6 (AQP-107 to 112) | AQP-27 | Pass |
| 12 | 03.02 Formula engine | [AQP-106](https://sankumar76.atlassian.net/browse/AQP-106) | AQP-18 | 8 | 8 (AQP-114 to 121) | AQP-97 | Pass |
| 12a | 10.10 NFR-009 guards: JS budget check and Lighthouse reference run (enabler) | [AQP-169](https://sankumar76.atlassian.net/browse/AQP-169) | AQP-25 | 5 | 9 (AQP-170 to 178) | AQP-38 (and it blocks AQP-113 and, ++, AQP-188) | Pass (wording of AC-1, AC-2 corrected) |
| 12b | 10.13 First-load JS headroom: account menu and drawer load on first open; early tap kept (enabler) | [AQP-188](https://sankumar76.atlassian.net/browse/AQP-188) | AQP-25 | 5 | 8 (AQP-189 to 196) | ++AQP-169 | **Pending** (Draft; ACs settled by the solution-architect, target confirmed by the product-manager, DoR not yet validated) |
| 12c | 10.14 Cut CI feedback time: E2E stage 12 faster without losing coverage (enabler) | [AQP-199](https://sankumar76.atlassian.net/browse/AQP-199) | AQP-25 | 3 | 6 (AQP-200 to 205) | none (relates to AQP-169, AQP-198) | Ready for Dev (READY 17 of 17, AQP-199 comment 10978; committed since 2026-11-05, DL-099) |
| 13 | 02.01 Process Master list and edit | [AQP-113](https://sankumar76.atlassian.net/browse/AQP-113) | AQP-17 | 3 | 7 (AQP-124 to 129, AQP-165) | AQP-65, AQP-74, AQP-97, +AQP-57, +AQP-169 (before G6), ++AQP-188 (before development starts) | Corrected (link) |
| 14 | 02.03 Material Master | [AQP-122](https://sankumar76.atlassian.net/browse/AQP-122) | AQP-17 | 3 | 6 (AQP-131 to 136) | AQP-65, AQP-74, +AQP-113, +AQP-57, ++AQP-188 | Corrected (links) |
| 15 | 02.04 Exchange Rate Master | [AQP-123](https://sankumar76.atlassian.net/browse/AQP-123) | AQP-17 | 2 | 5 (AQP-137 to 141) | AQP-65, AQP-74, AQP-97, +AQP-113, +AQP-122, +AQP-57, ++AQP-188 | Corrected (links) |
| 16 | 02.05 Treatment / Color list | [AQP-130](https://sankumar76.atlassian.net/browse/AQP-130) | AQP-17 | 2 | 5 (AQP-143 to 147) | AQP-65, AQP-74, +AQP-113, +AQP-122, +AQP-57, ++AQP-188 | Corrected (links) |
| 17 | 02.02 Customers with default rates and Reset to Defaults | [AQP-142](https://sankumar76.atlassian.net/browse/AQP-142) | AQP-17 | 5 | 7 (AQP-149 to 155) | AQP-113, +AQP-57, ++AQP-188 | Corrected (link) |
| 18 | 04.01 Assign a task | [AQP-148](https://sankumar76.atlassian.net/browse/AQP-148) | AQP-19 | 5 | 8 (AQP-156 to 163) | AQP-65, AQP-48, +AQP-57, ++AQP-188 | Corrected (link) |
| | **Total** | | | **86** | **144** | 57 links | 10 pass, 9 corrected, 2 added and validated READY (AQP-188, AQP-199) |

Sprint assignment: all 20 (the 18, AQP-169 and AQP-188) are in the Jira sprint "AQP Sprint 1" (id 37) and carry the label `sprint-01`. The Status column below is as written in each plan version; the live board is `docs/project-state.md` (AQP-27, 28, 38, 97 and 106 are already Done).

**The 13 added links (CR-34), all present in Jira:** AQP-48 blocks AQP-89; AQP-57 blocks AQP-90, AQP-113, AQP-122, AQP-123, AQP-130, AQP-142 and AQP-148; AQP-113 blocks AQP-122, AQP-123 and AQP-130; AQP-122 blocks AQP-123 and AQP-130. The "Depends on" line inside the eight stories' description text was not rewritten; each of the eight carries a Jira comment recording the added dependency, and the links are the structured record.

**The 12 links added on 2026-11-04 (DL-080), all present in Jira:** AQP-169 blocks AQP-188; AQP-188 blocks AQP-48, 65, 74, 81, 89, 113, 122, 123, 130, 142 and 148. Not linked, by the solution-architect's ruling (AQP-188 comment 10863): AQP-57 (no screen: server views, tests and a test-only route) and AQP-90 (a server-rendered page with no client JavaScript of its own). The link to AQP-48 stays (comment 10871: it adds an app-level client error boundary and edits the header, navigation and account menu files that AQP-188 rewrites). AQP-188 also blocks the bug AQP-197 (DEF-013), which another role linked.

## Committed stories (in execution order)

| # (backlog rank) | Story | Points | Depends on | Critical path | Status (as written) |
|---|-------|--------|-----------|---------------|--------|
| 1 | 10.01 AQP-27 | 8 | none | Yes | Ready for Dev |
| 2 | 10.02 AQP-28 | 5 | 10.01 | Yes | Ready for Dev |
| 3 | 01.01 AQP-38 | 5 | 10.01, 10.02 | Yes | Ready for Dev |
| 12a | 10.10 AQP-169 | 5 | 01.01 (soft: 01.02, 01.04) | Yes, in series before 10.13 (since 2026-11-04) | Ready for Dev |
| 12b | 10.13 AQP-188 | 5 | 10.10 | Yes: blocks 01.02, 01.04, 01.07, 01.06 and every later portal story | Draft (awaiting the product-owner's validation) |
| 12c | 10.14 AQP-199 | 3 | none | No (a CI-time enabler; the DL-095 trigger fired, DL-099; AQP-65's G6 waits for its merge) | Ready for Dev |
| 4 | 01.02 AQP-48 | 5 | 01.01, 10.13 | Yes | Ready for Dev |
| 6 | 01.04 AQP-65 | 3 | 01.02, 10.13 | Yes | Ready for Dev |
| 7 | 01.07 AQP-74 | 5 | 01.02, 01.04, 10.13 | Yes | Ready for Dev |
| 11 | 03.01 AQP-97 | 3 | 10.01 | Engine chain | Ready for Dev |
| 12 | 03.02 AQP-106 | 8 | 03.01 | Engine chain | Ready for Dev |

**Total committed:** 55 points (11 stories) / assumed capacity 55 points; slack 0 (v0.8, DL-099; 54 with slack 1 in v0.6 and v0.7). Moved out on 2026-11-04: 01.03 AQP-57 (5), 01.05 AQP-81 (3), 01.08 AQP-90 (1); moved out on 2026-11-05: 01.06 AQP-89 (2), to the head of the stretch, because AQP-199 came in.

## Stretch stories (taken in this order if the committed set is on track at the mid-sprint review)

| # (backlog rank) | Story | Points | Depends on | Why this order |
|---|-------|--------|-----------|----------------|
| 9 | 01.06 AQP-89 | 2 | 01.01, 01.02, 10.13 | First, moved out of the committed set on 2026-11-05 (DL-099) when the DL-095 trigger fired and AQP-199 came in (55 of 55). It is not a predecessor of any committed story. It is still blocked by AQP-48 and AQP-188 |
| 5 | 01.03 AQP-57 | 5 | 01.02 | Next. Moved from the committed set on 2026-11-04 (DL-081). It is not a predecessor of any committed story. It must be Done before any cost-bearing story starts, and the Jira links enforce that: it blocks 01.08, 02.01 to 02.05 and 04.01. The cost-confidentiality scan arrives with it |
| 8 | 01.05 AQP-81 | 3 | 01.01, 01.04, 10.13 | Second. Moved on 2026-11-04. Nothing committed depends on it |
| 10 | 01.08 AQP-90 | 1 | 10.02, 01.02, 01.03 | Third. Moved on 2026-11-04. It needs 01.03, so it follows it |
| 13 | 02.01 AQP-113 | 3 | 01.04, 01.07, 01.03, 03.01, 10.13 | Feeds the first calculation (03.03); creates the master repository and service the next three extend. It cannot start development before 10.13 merges (DL-080) |
| 14 | 02.03 AQP-122 | 3 | 01.04, 01.07, 01.03, 02.01, 10.13 | Builds the SCR-13 tab shell the next two use |
| 15 | 02.04 AQP-123 | 2 | 01.04, 01.07, 01.03, 03.01, 02.01, 02.03, 10.13 | Same |
| 16 | 02.05 AQP-130 | 2 | 01.04, 01.07, 01.03, 02.01, 02.03, 10.13 | Same |
| 17 | 02.02 AQP-142 | 5 | 02.01, 01.03, 10.13 | Largest master; needs the Process Master |
| 18 | 04.01 AQP-148 | 5 | 01.04, 01.02, 01.03, 10.13 | First step of the workflow; independent of the masters |

**Total stretch:** 31 points, 10 stories (32 in v0.7; 29 in v0.6). **Planned in all:** 86 points, 21 stories. Not in this sprint: 03.03 (the backlog lists it after the masters exist) and every rank above 18.

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

Critical path (from 2026-11-04): **10.01, 10.02, 01.01, 10.10, 10.13, 01.02, 01.04, 01.07, 02.01, 02.03, 02.04** (with 02.05 and 02.02 beside it). 10.10 and 10.13 are not drawn above; see the paragraph below. The engine chain (10.01, 03.01, 03.02) does not depend on the UI chain, so a second development stream could run it in parallel from the end of 10.01 and put the highest-uncertainty item of R1 in front of checkpoint A earlier. With one stream, keep the order above.

**STORY-10.10 (AQP-169) and STORY-10.13 (AQP-188)** stand in series between 01.01 and 01.02 since 2026-11-04. AQP-38 blocks AQP-169; AQP-169 blocks AQP-188; AQP-188 blocks 01.02, 01.04, 01.07, 01.05, 01.06 and every master and assign story. DL-080: no story that adds client JavaScript to the portal frame or a signed-in route starts development before AQP-188 merges. So both are on the critical path and both merge waits count (the product-manager's dates, release plan v0.15 3.8). AQP-169 can start once 01.01 has merged; it measures the Admin only until the route manifest (01.02) and the user service (01.04) exist, so it does not wait for them. Before 2026-11-04 AQP-169 was a stretch story that only had to be Done before 02.01 reached G6; 02.01 now cannot start development before AQP-188 merges. Settled by the solution-architect (comment 10871): the AQP-48 link stays. If the product-manager wants back about 0.5 day, AQP-48's server-only tasks (T1, the manifest and `GET /api/v1/me` of T2, T3, T4) could start before AQP-188 merges, with T5 to T7 waiting; that reads DL-080 per task, not per story, and is the master's decision. It is not taken here. Jira links: AQP-38 blocks AQP-169; AQP-169 blocks AQP-113 and AQP-188.

Dependencies the epics did not list and the stories added, **confirmed by the product-owner and present in Jira:** 01.07 after 01.04 (user events are wired into its service); 01.08 after 01.02 (manifest row); 02.01, 02.03, 02.04 and 02.05 after 01.07 (each master edit writes an audit entry); 02.04 after 03.01 (hint letters come from the registry, UX-23). **Added by the product-owner (CR-34):** 01.06 after 01.02; 01.03 before 01.08, 02.01 to 02.05 and 04.01 (the `canaryMasters` file and the scan they extend or run); 02.01 before 02.03, 02.04, 02.05 (the master repository and service); 02.03 before 02.04, 02.05 (the SCR-13 tab shell).

## Risks to the sprint goal

| Risk | Mitigation | Owner |
|------|------------|-------|
| **G4 is not yet decided.** DL-026 held it for G3 conditions 12, 13 and 15; the consistency report v0.3 says they are met in substance (UX closed in v0.4 and v0.6, the generator committed in 89a9c00 with the delivery lead's acceptance in comment 10576, the test plan committed in 5b46e00). BLK-03 can clear; the master decides, and has not yet recorded the whole-order rule, D-25 to D-37 or PRD 13.4 (CR-23). No story branch starts before the decision | The master records CR-23 and decides G4; stories turn Ready after it | master |
| The scaffold, CI and tokens are not shown to be enough hours (architecture 16.11); 10.01 (now with AC-10) and 10.02 sit on the critical path | They are first; checkpoint A reads their actual size; the committed set is 54 against 55 (53 until 2026-11-04), with 1 point of slack and no room for a second overrun, so the stretch stories are the first to go | scrum-master; developer |
| 03.02 (8 points) is the highest-uncertainty item and the largest | The split line is named in the story (graph and internal-form tasks as 03.02b); the product-owner agrees the split, it is not taken silently (backlog section 7) | scrum-master; product-owner |
| A first Gitleaks run over history reports a finding in public history | Do not suppress; report BLOCKED. Removing anything from public history needs the delivery lead's explicit authorisation (ADR-014) | developer; Santhosh |
| The DL-017 evidence for 10.02 (real phone, screen reader, high-contrast) | The delivery lead has supplied the devices (comment 10573). Phone on the same Wi-Fi with `npx next dev -H 0.0.0.0`; the checklist is sub-task T9. If a check cannot be done G7 returns NO-GO for 10.02 | qa-engineer; Santhosh |
| The seed Process Master items need stable IDs and a production loader for the seed configuration; "Other" needs a creation step (assumption A-1 in 03.01, 02.01, 02.05) | **Closed:** architecture v0.11 section 5.6 confirms it (`seed-ids.ts` in 03.01, the 15 rows in 02.01's migration, `ensure-seed-version` in `migrate`, "Other" in 02.05's migration). One limit stays: a rate left at 0 prices a process at 0 with no message, so 02.01 AC-9 puts "enter all 15 rates" in the README first-use steps | solution-architect; developer |
| Real values reaching the public repository (RISK-006) | 10.01 secret scan, data-file check and the `n.37` pattern test; all fixtures invented | developer; reviewer-standards |
| The scan proves the mechanism only: few Engineer routes exist in sprint 1 (ARCH-R2) | Each master story adds its values to `canaryMasters` as an AC; the scan iterates the manifest | developer |
| A test run against a live database | 10.01 AC-10: the global test set-up refuses a non-local connection and `NODE_ENV=production` | developer; qa-engineer |
| Two enablers (STORY-10.10, STORY-10.13) stand in series before 01.02 on the critical path, so the delivery lead's merge turnaround on their two pull requests is now the largest input to the sprint 1 date (product-manager, DL-081; a risk number is for the master, AQP-188 comment 10868). Replaces the v0.5 row "STORY-10.10 starts late because it is stretch" | Start AQP-169 as soon as 01.01 merges; both are committed, not stretch. The way-of-working choice names the turnaround. If AQP-48's server-only tasks may start before AQP-188 merges (master's decision, per DL-080), about 0.5 day returns | scrum-master; product-manager; master |
| STORY-10.10's baseline cannot be dispatched before its merge: GitHub offers `workflow_dispatch` only for a workflow file on the default branch | The story adds a `pull_request` trigger limited to the Lighthouse files (assumption A-2 of AQP-169); the solution-architect confirms it or chooses another route | solution-architect |
| STORY-10.10's calibration differs from 184.6 and 135.1 KB, or the baseline on `/` misses the targets | AC-4 stops the merge and reports to the product-manager; AC-9 reports a miss as it is and RISK-020 stays at 9 | developer; qa-engineer; product-manager |
| STORY-10.13's lazy loading saves less than the 8,360 B on `/queue` and 7,247 B on `/` that the 190,000 B floor needs (the 10 to 25 KB is an unmeasured estimate) | AC-1's last sentence stops the story and reports the saving of each cut; the product-manager lowers the floor on the evidence or adds a story for the next #61 candidate. No shortfall is accepted in advance (DL-081). RISK-020 stays 12 until it lands | developer; solution-architect; product-manager |
| STORY-10.13 rewrites the portal frame (a swapped account trigger, an explicit focus return, an inline early-tap script): a keyboard, focus or axe regression, or a bundler that caches a failed chunk and defeats the retry | AC-4, AC-5, AC-6 and AC-8 keep the existing tests unchanged and add lazy-load tests at three widths; AC-10 repeats the early tap 20 of 20 per width with no retry; a cached failed chunk is reported BLOCKED to the architect | developer; reviewer-quality; qa-engineer |

## Impediments

Proposed for the ledger (the orchestrator records them).

| ID | Description | Impact | Owner | Action | Target date | Status |
|----|-------------|--------|-------|--------|-------------|--------|
| BLK-03 (existing) | The ux-expert was stopped from the delivery lead's side. Conditions 12, 13 and 15 are met in substance (consistency report v0.3), so the blocker can clear | None now: G4 is decided (CONDITIONAL GO, attempt 2) | master; Santhosh | Master to clear it on the record | Before sprint start | Can clear |
| IMP-S1-01 | The test plan (G3 condition 15) was absent | None now | qa-engineer | `docs/07-qa/test-plan.md` exists (5b46e00) | n/a | **Closed** |
| IMP-S1-02 | The seed Process Master IDs, the production loader of the seed configuration and the creation of "Other" were not stated in the architecture (A-1) | None now | solution-architect | Confirmed in architecture v0.11 section 5.6; A-1 marked confirmed in 03.01, 02.01 and 02.05 | n/a | **Closed** |
| IMP-S1-03 | A real phone, a screen reader and Windows high-contrast mode are needed for 10.02 at its G7 (DL-017) | 10.02 cannot be accepted without them | qa-engineer; Santhosh | The delivery lead has supplied the devices (comment 10573); agree how the phone reaches the dev server | Before 10.02 reaches G7 | **Answered**; the check itself is done at G7 |

## Sequencing note from the coordinator (architecture v0.10)

The password step-up check ships in Release 1 with FR-107 and FR-108. **Answered by the product-owner: STORY-06.14 (the step-up check, enabler, EPIC-06) is its own story, ranked before 06.12 (cancel approval) and 06.13 (remove price)** (`backlog.md` rank 47). It is not in this sprint. One preparation stays useful: 01.01 builds the argon2 verification and throttling and 01.05 the password-change throttle on its own key; the step-up needs a third key (architecture §6) and gives 422 `STEP_UP_FAILED`, not 401. The developer should keep password verification in one shared function so 06.14 reuses it. This is a recommendation, not an acceptance criterion of any story here.

## Changes from architecture v0.11 (section 16.15, 2026-11-02)

| Change | Where applied |
|--------|---------------|
| **CR-33: one rule for a refused role.** `withRoute` checks the role first, before any lookup; a Lead or Engineer on a route the manifest does not list for them gets 403 with a fixed `problem+json` body and no data; the uniform 404 stays only on an Engineer's own routes (a missing estimate, or another Engineer's) | AQP-48 AC-4 (the words "or the uniform 404 where the manifest says so" are removed); AQP-57 AC-5 (was "403 or 404"); AQP-65 AC-6; AQP-74 AC-7 (its test asserts 403 for an Engineer on audit); AQP-113 AC-6; AQP-130 AC-7. AQP-122, 123, 142 and 148 already read 403; a comment on each records the check |
| **A-1 confirmed** (IMP-S1-02): `seed-ids.ts` holds the 15 fixed IDs (added by 03.01; 14 until the 2026-11-03 correction that adds `Plating-rate-per-sqin`, requirements v1.13 D-38); 02.01's migration inserts the 15 rows at default 0 and owns them; `ensure-seed-version` runs in `migrate` only if no version exists; "Other" is inserted by 02.05's migration | AQP-97, AQP-113, AQP-130 (Dev Context, tasks, AC-5 and AC-6 of 03.01) |
| **First-use steps:** enter all 15 rates before any estimate is calculated (a rate left at 0 is valid and prices that process at 0 with no message; no check is designed) | AQP-113 AC-9 and new sub-task T7 (AQP-165): a "First use" section in `README.md`, which 10.02 starts and 10.04 extends |
| **Story 10.05 (`clear-copies.sh`)** gains the script and its `sudo` rule; "2-year pruning" stays as written | **Not in Jira yet and not in this sprint.** I did not edit `backlog.md`; the note goes to the product-owner, who owns it, to place on the 10.05 row |

## Change of 2026-11-03: STORY-10.10, the NFR-009 guards (AQP-169)

**Source.** The master's G6 decision on AQP-28 (Jira comment 10710, DL-053, RISK-020, GitHub issue #36); the product-manager's PRD NFR-009 row (AQP-1 comments 10712 to 10714; the 10-minute CI target is agreed by the delivery lead, chat 2026-11-03); the solution-architect's test strategy v0.13 section 10 and comment 10716, which proposed this story, about 3 points, carved out of 10.09. 10.09 keeps NFR-010 to 012 and NFR-024. The product-owner validated it READY, 17 of 17, on 2026-11-03 (comment 10726), and it is Ready for Dev. Jira: AQP-169 with sub-tasks AQP-170 to AQP-178; AQP-38 blocks it; it blocks AQP-113.

**Placement: the stretch set, first (rank 12a).** It must be Done before 02.01 (AQP-113) reaches G6, and 02.01 is itself a stretch story, so the rule is met inside the stretch order. No committed story is a key screen. Recommended start: the first idle merge wait after 01.01 (AQP-38) is merged, not the mid-sprint review.

**Estimate: 5 points, not the architect's 3.** The reasoning is in the story (Sizing): 9 sub-tasks, which in this backlog goes with 5 points, and untried surfaces (a signed-in Lighthouse run on a hosted runner, the GitHub API, a calibration that can stop the merge, a new dev dependency through the licence and install-script gates). If the product-owner and architect prefer 3, change one field; the table below changes by 2.

| Measure | Before | After |
|---------|--------|-------|
| Committed stories and points | 12 stories, 53 of 55 | 12 stories, 53 of 55 (unchanged) |
| Committed slack | 2 points | 2 points |
| Stretch | 6 stories, 20 points | 7 stories, 25 points |
| Planned in all | 18 stories, 73 points | 19 stories, 78 points |
| Sub-tasks and links | 121 and 41 | 130 and 43 |

**What it pushes out: nothing from the committed set. In the stretch, the tail.** The stretch is taken in order as far as the sprint reaches, and 10.10 now takes the first 5 points of that reach. At the old full reach of 20 points, 04.01 (AQP-148, 5 points) no longer fits; at a reach of 15 points, 02.02 (AQP-142, 5 points) no longer fits. At a given reach, about the last 5 points of the old stretch are the ones lost. Nothing was ever inside the 55 points beyond the committed 53, so this is a change to the stretch reach, not to the commitment.

**The alternative, not taken.** Putting 10.10 in the committed set makes 58 of 55. To stay at 55, 01.06 (AQP-89, 2 points) and 01.08 (AQP-90, 1 point), both off the critical path, would move to the stretch, leaving no slack. That would move two Must stories out of the commitment for a guard that no committed story needs, so it is for the delivery lead and the product-manager to choose, not taken here.

**Release plan (v0.13), by the plan's own proxy. This is arithmetic, not a re-run of the simulation: the throwaway script is not kept, and the product-manager re-runs the model at each sprint (release plan 3.2).**
- Effort: the plan puts sprint 1's 73 points at 2.4 working days (19.2 h), about 0.26 h a point. 5 points are about 1.3 h, 0.16 working day. That is an upper bound: part of it may already sit in EPIC-10's 8 to 12.5 h through 10.09, and the product-manager says how much. Scope A would be at most 89.8 / 111.8 / 133.8 h against 88.5 / 110.5 / 132.5 h.
- Dates: the central case is 18.31 working days to Thu 2026-11-26 (day 19); +0.16 makes 18.47, so the date holds. Low 13.24 becomes 13.40 (Thu 2026-11-19 holds); high 29.63 becomes 29.79 (Fri 2026-12-11 holds). All three stay inside the plan's own noise of about 0.3 day. None of the dates is adopted.
- Sprint 1 elapsed: 5.85 working days at a half-day merge. 10.10 fills an idle merge wait (2.95 idle days), so it adds 0 to 0.16 day. The committed milestone (12 stories, Mon 2026-11-09) does not move, because 10.10 is not committed.
- Merges: it is one more pull request for the delivery lead to merge (19 in the sprint). It is not on the critical chain, but 02.01's G6 waits for its merge.
- CI: step 11b is to add under 60 seconds to a job that takes 2 m 34 s; the 10-minute target is untouched.

**Scope addition, flagged under rule 6; ruled by the master as an enabler (DL-056).** What it adds: 5 more points in sprint 1, one more story (90 candidates), and three pieces that 10.09 as written did not contain (the JS budget check, the nightly workflow with both Lighthouse profiles, and the CI feedback-time monitor). No FR is added, and scope A does not change. The master's DL-056 (comment 10721, written at about 3 points) records the story as an enabler for the existing NFR-009, not new product scope; the product-manager takes its 5 points into the date model. Also for the master: the G6 note on AQP-28 says QA records a Lighthouse baseline of `/` at AQP-28's G7, while test strategy 10.4 says no reference run exists then and moves it to 10.10's G7.

**ID change.** 10.10 was the provisional ID of the privacy story (NFR-028, 029). The architect's documents and the coordinator's instruction name the NFR-009 story 10.10, so the privacy story is renumbered 10.12 in `backlog.md` and EPIC-10 (not in Jira). The product-owner confirms.

## Change of 2026-11-04: STORY-10.13 (AQP-188), the #61 first-load JS cut, and the committed set

**Source.** The master's DL-080 (GitHub #61, comment 6637573224): create an enabler story for #61, lazy-load the account menu and the mobile drawer on first open, then measure; AQP-169 first, then this story; no story that adds client JavaScript to the portal frame or a signed-in route starts development before it merges. The solution-architect's final ACs and design (AQP-188 comments 10862 and 10863), the DEF-013 ruling (10870, DL-083) and the AQP-48 link (10871). The product-manager's confirmation of the target and the sprint decision (10867, 10868; DL-081; PRD v0.14 13.9; release plan v0.15 3.8). Jira: AQP-188 under AQP-25, sub-tasks AQP-189 to AQP-196, label `sprint-01`, Jira sprint "AQP Sprint 1".

**Estimate: 5 points.** The scrum-master's draft said 3. The solution-architect set 5 (two patterns, a reusable loader with failure and retry, new network and layout-shift tests) and kept it after DEF-013 (the early-tap script is small and goes in T4 and T5). The product-manager takes 5.

**Placement: committed.** AQP-188 blocks AQP-48, 65, 74, 81 and 89, and AQP-169 blocks AQP-188, so both enablers are predecessors of committed stories (DL-080). Both therefore count in the commitment: 53 + 10 = 63 of 55. To return under 55, three stories that no committed story depends on move to the head of the stretch, in this order: 01.03 AQP-57 (5), 01.05 AQP-81 (3), 01.08 AQP-90 (1). All three stay Must in R1; each can be built in an idle merge wait. AQP-57 must still be Done before any cost-bearing story starts, which its Jira links enforce.

| Measure | v0.5 (2026-11-03) | v0.6 (2026-11-04) |
|---------|--------|--------|
| Committed stories and points | 12 stories, 53 of 55 | 11 stories, 54 of 55 |
| Committed slack | 2 points | 1 point |
| Stretch | 7 stories, 25 points | 9 stories, 29 points |
| Planned in all | 19 stories, 78 points | 20 stories, 83 points |
| Sub-tasks and links | 130 and 43 | 138 and 55 |

**Sprint goal.** Reworded so that it no longer promises the cost-confidentiality scan, which now arrives with 01.03 in the stretch. The committed goal adds the budget: pages stay inside the first-load JavaScript budget.

**What it pushes out.** Of the committed set, 01.03, 01.05 and 01.08 (9 points). In the stretch, the tail: at a given reach, about the last 9 points of the v0.5 stretch are lost (at the old reach of 25 points, 04.01 and 02.02 no longer fit).

**Dates (the product-manager's upper-bound arithmetic; the model is not re-run; none is adopted).** The two enablers stand in series before the chain, so both merge waits count: central case Fri 2026-11-27 (was Thu 2026-11-26, 0.13 day from the boundary), high end Wed 2026-12-16 (was Fri 2026-12-11), outside the stated range by up to three working days, so the delivery lead should be told (orchestrator). Effort +2.0 to +3.0 h in EPIC-10 (scope A 92.0 to 138.0 h, central 115.0 h). A lifted AQP-48 link would return about 0.5 day (see the critical path paragraph).

**Scope addition, flagged under rule 6; ruled as an enabler, not product scope (DL-056, DL-080).** What it adds: 5 points in sprint 1 and one story (91 candidates). No FR, NFR, priority, release or MVP change; scope A stands. DL-081 is written for the master to ratify.

**DEF-013 (AQP-197, Sev-3, Product).** Fixed inside this story (AC-10: an inline early-tap capture script, replayed at hydration; 20 of 20 runs per width); it closes when AQP-188 passes G7. The DEF-011 test and DEF-012 test-only fixes (#67, #68) are a separate PR, due before AQP-169's G7 (DL-083).

## Change of 2026-11-05 (DL-099): the CI-time trigger fired; AQP-199 committed, AQP-89 out

**Source.** The master's DL-099 (AQP-199 comment 10983, AQP-1 comment 10984). The nightly CI-time step reported a **p95 of 15 min 05 s** over the last 20 runs, above the 9-minute trigger of DL-095 and the 10-minute NFR-009 limit. Master applied the trigger as written, although outliers set the figure (one stage-12 run was slowed by an unbounded apt download in `playwright install --with-deps`; no test hung, DL-100) and recent runs took about 6 to 9 min 21 s. The product-manager had set the rule (comment 10969, DL-097).

**What changes.** AQP-199 (10.14, 3 points, Ready for Dev) moves from the head of the stretch to the committed set. AQP-89 (01.06, 2 points) steps out to the head of the stretch. Committed is **55 of 55**, slack 0; stretch 31 points; planned 86 points, 21 stories. AQP-89 is not a predecessor of any committed story. Jira: both stories keep the label `sprint-01` and stay in "AQP Sprint 1"; the label does not say committed or stretch, so no label changed, and the notes are on AQP-199, AQP-89 and AQP-65.

**Related rulings (DL-099).** (1) **AQP-65 (01.04) is held at G6 until AQP-199 merges;** its development and reviews continue. (2) **DEF-015 (Jira AQP-206, GitHub #88; corrected by DL-100):** no test hung. In run 42061753504, attempt 3, stage 12 spent about 9.5 min in `npx playwright install --with-deps chromium` (apt fetched 20.5 MB at 35.9 kB/s, single packages stalled for up to 170 s) and then 340 tests passed in 4.3 min. DEF-015 is a **CI-infrastructure defect, type Environment, Sev-3**: the browser system packages are downloaded without a bound on every run. **The solution-architect chooses the fix** (cache `~/.cache/ms-playwright` plus the system packages, the official Playwright image pinned by digest, or another bounded option), the developer builds it, QA writes the record, and **the product-manager decides whether it goes into AQP-199 or a follow-up story** after the architect's estimate; it is due before sprint 1 ends either way. **Placement (product-manager, AQP-199 comment 10996): it is fixed as its own defect PR under AQP-206 after AQP-199 merges,** not added to AQP-199 as a seventh task (that would change what AC-2 measures and would delay AQP-65's G6). Order: after AQP-199, in the first idle merge wait, with chain work first, and due before sprint 1 ends. AQP-206 stays a Bug with no story points (the architect's estimate is about 2 points, comment 10992, and is not added to the 55); it carries the label `sprint-01` and is in "AQP Sprint 1". AQP-199's scope and 3 points are unchanged. (3) AQP-199's G7: **a run slowed by a mirror stall is recorded as Environment and repeated, not counted.** (4) RISK-023 is raised to 8.

**Effect on the sprint.** There is no slack left: a second overrun in a committed story has no room, and the stretch (AQP-89, then AQP-57, AQP-81, AQP-90 and the rest) is the first to go. The chain 10.13, 01.02, 01.04, 01.07 is unchanged; AQP-65's G6 now waits on a story that has no dependency on it, so AQP-199 should be built next. The product-manager's dates are unchanged (release plan v0.16 3.9, upper bound; none adopted); the orchestrator reports the swap to the delivery lead (DL-010).

## Pick-up notes from the product-owner's validation (not DoR items)

| Story | Note |
|-------|------|
| 10.02 AQP-28 | The risk text names the untracked generator and BLK-03, both closed; the devices for AC-9 are supplied (comment 10573) |
| 01.01 AQP-38 | AC-2 needs a stated timing tolerance in the test; SCR-01 and UJ-01 differ on whether the password field is cleared (CR-32) |
| 01.02 AQP-48 | CR-33 is settled by architecture v0.11 section 6: 403 for a refused role; AC-4 now says so |
| 01.04 AQP-65 | BR-005 belongs to the hand-over and step-up; this story's rule is BR-001 |
| 01.05 AQP-81 | Add 10 and 128 characters as accepted cases to AC-1 (test strategy 7 lists them) |
| 03.01 AQP-97 | Assumption A-1 is confirmed (architecture v0.11 section 5.6); the story adds `seed-ids.ts` |
| 03.02 AQP-106 | The split line (03.02b) is agreed with the product-owner, not taken silently |

## Rules that apply to every story in this sprint

1. **Definition of Ready.** Ready only after the product-owner validates and the master decides G4. Both are done for 19 stories: they read Ready for Dev (AQP-169 since 2026-11-03; for it the master's G4 position is still the master's call). AQP-188 (added 2026-11-04) is Draft: the product-owner validates it first. A change to a story's acceptance criteria after this point goes back to the product-owner.
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
| product-owner | Done: `clear-copies.sh` is on the 10.05 row of `backlog.md` v0.4 (story 10.05 is not in Jira; the scrum-master creates it when due); all 18 re-validated 17 of 17. Going forward the product-owner names a Trace correction and the scrum-master writes it (DL-039) |
| solution-architect | Answered in architecture v0.11: the seed IDs and loader, "Other" (A-1), and what an Engineer gets on a Lead or Admin route (CR-33: 403). Still open: (3) what a draft estimate shows when its treatment is deleted, since `treatments` has no `deleted_at` (before story 05.06); (4) whether sign-out should also raise `session_version`; (5) the names of the two database roles and who creates them on a production install (10.01 A-1) |
| ux-expert | SCR-01 "clears nothing else" against UJ-01 "field values kept except the password" (CR-32) |
| product-manager | FR-011's fit criterion still calls the audit screen PROPOSED (CR-29). The `npm run` forms in CLAUDE.md §1 and test-strategy §10 differ from the direct commands used here |
| master | Done: CR-23 recorded and G4 decided (CONDITIONAL GO, attempt 2). Open on the master's list: the conditions above |
| product-manager | The scope addition of 2026-11-03 (rule 6): STORY-10.10, 5 points, carved out of 10.09 (see "Change of 2026-11-03"). Confirm or refuse it; re-run the merge model with it; say how much of its hours was already inside EPIC-10's 8 to 12.5 h. The PRD NFR-009 row still puts the baseline "at the G7 of AQP-28"; test strategy 10.4 puts it at 10.10's G7. DL-056 and comment 10716 say about 3 points; the story is 5, so use 5 in the date model |
| master | DL-056 (comment 10721) already records the story as an enabler for the existing NFR-009 at about 3 points; note that it is 5. Give the G4 position for a story added after attempt 2. Acknowledge that the Lighthouse baseline of `/` moves from AQP-28's G7 (your G6 note, comment 10710) to AQP-169's G7. RISK-020 stays at 9 until that run |
| product-owner | Done 2026-11-03: AQP-169 validated READY, 17 of 17 (comment 10726), and `consistency-report.md` rows NFR-009, NFR-028 and NFR-029 corrected (10.10 and 10.12). Still open, optional: consider, for 02.01 (AQP-113), 04.01 (AQP-148) and the later key-screen stories, a line that the pull request links an on-demand Wi-Fi Lighthouse run at G6 (test strategy 10.4), and a Jira link AQP-169 blocks AQP-148 (04.01 is a key screen and the dependency graph lets it come before 02.01). Not done here: it changes their acceptance criteria and dependencies |
| solution-architect | Rule on assumption A-2 of AQP-169: `workflow_dispatch` needs the workflow file on the default branch, so a baseline before the merge needs a path-limited `pull_request` trigger or another route. Confirm 5 points against your 3. Also from the product-owner (AQP-1 10728): test strategy 10.1 should say the not-found page must answer 404, as AC-2 now does; and the licences of the `@lhci/cli` dependencies are yours to rule on under AC-6 |
| product-owner | **Validate AQP-188 (10.13) against the Definition of Ready (17 of 17) and confirm rank 12b.** Its ACs are settled by the solution-architect (10862, 10870), the target is confirmed (10867) and it has 10 ACs, the limit. Add the row to `backlog.md` (rank 12b, after 12a, with the stretch order of this plan). Confirm that the links to AQP-48 and AQP-89 are right. Any later change to its ACs returns to you (rule 1) |
| ux-expert | AQP-188: the failure line may be reworded before G6 (AC-8). One visual check before G6: the held pressed look of the menu button and the account trigger is visible on the delivery lead's iPhone (DEF-010 showed some pressed states are not) |
| master | Ratify DL-081 and number the new risk (two enablers in series on the sprint 1 chain; AQP-188 comment 10868). Decide whether DL-080 is read per task for AQP-48 (comment 10871), which would return about 0.5 day. RISK-020 stays 12 until AQP-188 restores at least 10,000 B |
| orchestrator | Tell the delivery lead that the high end of the date range moves to Wed 2026-12-16 (outside the stated range by up to three working days; release plan v0.15 3.8), and that AQP-57, AQP-81 and AQP-90 are now at the head of the stretch |
| qa-engineer | Done 2026-11-03: `docs/07-qa/test-plan.md` v0.2.1 uses 10.12 for privacy and 10.10 for NFR-009 (AQP-1 10725). It keeps a reference run of `/` at AQP-28's G7 if possible (10710); the baseline that decides RISK-020 is yours at AQP-169's G7 (AC-9) |

## Not Ready, and why

**One of the 20 is not Ready: AQP-188 (10.13), Draft since 2026-11-04.** It waits for the product-owner's Definition of Ready validation (its ACs are settled by the solution-architect and its target is confirmed by the product-manager). It is committed and sits on the critical path, so the validation is the next step of the sprint. The other 19 are **Ready for Dev**: 18 since G4 CONDITIONAL GO, attempt 2, and AQP-169 (10.10) since 2026-11-03 after the product-owner's READY, 17 of 17. The master's G4 position for a story added after attempt 2 is still the master's call. AQP-169 holds no other story, but 02.01 cannot reach G6 until it is Done. What is still open, none of it holding a story:
- **Before a given story reaches its gate (master's conditions):** sign-out and `session_version` before AQP-38 reaches G5 (solution-architect); the test plan's 403 rows before AQP-48 reaches G7 (qa-engineer); a deleted treatment on a draft before 05.06 is Ready; SCR-15 wording before 02.09; the SPEC retention and picture-size wording before 10.05 and 05.07.
- **Before sprint 1 starts:** the delivery lead's choice of way of working and turnaround (orchestrator, condition 2); this plan assumes way 1.
- **03.01, 02.01 and 02.05:** assumption A-1 is now confirmed by architecture v0.11.
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
