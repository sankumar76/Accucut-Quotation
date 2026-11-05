# Cross-Artefact Consistency Report: Accucut Quotation Portal (G4 input)

| Field | Value |
|-------|-------|
| Version | 0.4, G4 remediation 2 (v0.3 was the input to G4 attempt 1, which was NO-GO; v0.2 was issued earlier on 2026-11-02 against SPEC v1.11, PRD v0.9 to v0.10, UX v0.5, architecture v0.9; v0.1 on 2026-11-01) |
| Owner | product-owner |
| Date | 2026-11-02 |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10, 101 FRs. EPIC-11, EPIC-12 and FR-093 to 096 are outside it |
| Compared | SPEC v1.12, PRD v0.11 (PRD v0.12 and release plan v0.12 landed during this pass, AQP-1 10621: their changes are effort and scheduling, so the FR to epic map is unchanged), UX spec v0.7 and `screens/` (41 pages), architecture v0.11, test strategy v0.10, test plan v0.2 (`docs/07-qa/test-plan.md`), ADR-001 to 014, `sprint-01-plan.md` v0.3 and the 18 sprint 01 stories (Jira AQP-27 to AQP-148, read after the scrum-master's edits of 11:51 and 11:52, AQP-1 10620); decision log DL-001 to DL-038; Jira AQP-1 comments to 10621, AQP-14, AQP-15, AQP-26 |
| Result | **0 Critical. 0 Major open. 8 Minor open** (CR-13, 16, 17, 18, 27, 28, 31, 33 residual). Closed since v0.3: CR-23 (master, DL-027 to DL-038), CR-32, CR-34, CR-35, and CR-33 apart from one test-plan edit. FR and NFR coverage is complete. **Sprint 01 validation against all 17 DoR items: 18 of 18 stories READY** (`backlog.md` section 7). The v0.3 check counted 16 items and did not apply the business-rule item systematically (CR-36); 11 stories failed that item as found, and the product-owner corrected their Trace lines (CR-37, scrum-master to confirm) |

## 0. Method and limits

- **Scripted** (Node, working tree): the 108 FR rows of PRD section 4; the FR to epic map; the architecture coverage matrix; the UX section 9 table; the 30 NFR rows; the text of all 41 screen pages; the message strings quoted in the 18 stories against the UX spec and the screens.
- **Read**: all 18 sprint stories in Jira (description, acceptance criteria, Dev Context, sub-tasks, links, points); `sprint-01-plan.md` in full; `docs/standards/definition-of-ready.md`; test plan sections 1, 4, 5 and 9; the PRD, SPEC, architecture, UX and ADR content read for v0.2, with the changes after it checked by script and by grep (SPEC §10, UX section 5 and 9, SCR-15, architecture matrix, PRD FR-011 and headers).
- **Not done**: the SPEC §2, §17 and §18.1 D-01 to D-20 were not re-read in full; the requirements catalogue, questions file and risk register were not read; the screens were read as text and not rendered (no browser); the test plan sections 10 to 16 and the strategy beyond section 5 were not re-read; the generator was not read and I did not check it for sample values (the delivery lead accepts its ten numbers, comment 10576). The sample workbook was not opened. This report contains no sample value.
- The sprint stories carry sub-tasks (121 after AQP-164 and AQP-165), which I counted from the story lists but did not open one by one.
- **Definition of Ready: 17 items.** `docs/standards/definition-of-ready.md` has 17 checkboxes (business clarity 4, acceptance criteria 4, technical clarity 4, UX clarity 3, sizing 2). The v0.3 check and its Jira comments said "16 items". The item not counted was "Relevant business rules (BR-IDs) listed": it had been marked "n/a" for most stories instead of being checked (CR-36). **Rule used now (R-BR):** a story lists every BR-ID that one of its acceptance criteria asserts (including the Admin-only and role-refusal criteria and the Engineer scan), plus the BRs its epic assigns it; an enabler that asserts none says so in the Trace line.

## 1. Summary of the seven checks

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Every Must FR covered by an epic | **Pass.** 90 of 90 Must FRs are in EPIC-01 to EPIC-10 | none |
| 2 | Every user-facing FR has a UX screen | **Pass.** UX sections 5 and 9 now have FR-001 to FR-108 (108 of 108) | none |
| 3 | Every FR and NFR in the architecture coverage matrix | **Pass.** 108 of 108 FRs and 30 of 30 NFRs | none |
| 4 | Terminology consistent | Minor conflicts | CR-17 |
| 5 | UX and architecture agree | **Agree on every rule re-checked.** Both v0.3 differences are settled: sign-in keeps the e-mail only (UX v0.7); a refused role gets 403, role check first (architecture v0.11 section 6). One test-plan sentence still says 404 | CR-32 (closed), CR-33 (residual, qa-engineer) |
| 6 | Sequencing: enablers before dependents | Source documents agree. One story split out (06.14, the step-up check); the 13 added links are in Jira (41 links) and agree with the sprint order | CR-25 (fixed), CR-34 (closed) |
| 7 | NFRs allocated | **Pass.** 30 of 30 allocated (section 8) | none |

## 2. Check 1: FR to epic map (exactly one epic each)

Script result on PRD v0.11: 108 FR rows, 0 duplicates, 0 unmapped, 0 mapped to an ID not in the PRD. Scope A is 101 FRs (R1 core 78, R1+ 6, R2 17; Must 90, Should 11), equal to PRD 6.2 and the release plan.

| Epic | Jira | FRs | Count | Must | Should |
|------|------|-----|-------|------|--------|
| EPIC-01 | AQP-16 | 001, 002, 004, 005, 006, 007 to 011, 098, 099 | 12 | 11 | 1 (FR-006, R2) |
| EPIC-02 | AQP-17 | 012 to 018, 105 | 8 | 8 (FR-014 R1+) | 0 |
| EPIC-03 | AQP-18 | 020 to 031 | 12 | 12 | 0 |
| EPIC-04 | AQP-19 | 032 to 041, 102 | 11 | 7 | 4 (FR-035, 039, 040, 041) |
| EPIC-05 | AQP-20 | 042 to 057, 104 | 17 | 15 | 2 (FR-054, 057) |
| EPIC-06 | AQP-21 | 058 to 065, 100, 101, 103, 106, 107, 108 | 14 | 13 | 1 (FR-103) |
| EPIC-07 | AQP-22 | 066 to 071 | 6 | 5 | 1 (FR-071) |
| EPIC-08 | AQP-23 | 072 to 080 | 9 | 9 | 0 |
| EPIC-09 | AQP-24 | 003, 019, 081 to 084 | 6 | 5 | 1 (FR-003) |
| EPIC-10 | AQP-25 | 085 to 089, 091 | 6 | 5 | 1 (FR-088) |
| **Scope A** | | | **101** | **90** | **11** |
| EPIC-11 (no Jira epic) | | 090, 097 | 2 | 0 (Could) | |
| EPIC-12 (no Jira epic) | | 092 | 1 | Won't this release | |
| Not planned | | 093, 094, 095, 096 | 4 | Won't | |

Rulings behind the map (CR-13): FR-003 and FR-019 to EPIC-09; FR-006 to EPIC-01 and FR-040 to EPIC-04 (effort in EPIC-09); FR-090 to EPIC-11; FR-104 to EPIC-05 with its work shared by 06.10 and 07.06; FR-105 to EPIC-02; FR-106 to 108 to EPIC-06. The password step-up check (06.14) serves NFR-004 and has no FR of its own.

## 3. Checks 2 and 3: screens and architecture coverage

UX section 9 has 108 rows and section 5 lists FR-106, 107, 108 on SCR-06, 08 and 16. SCR-15 is staged "R1 core: Last backup (FR-105); R2: e-mail alerts (FR-019)" in the page and the inventory. The architecture matrix has 108 FR rows and 30 NFR rows; the stale notes on FR-063 and FR-105 are gone. No FR lacks a screen except by reason (FR-090 to 097; FR-091 is documentation, its restore script is a command).

## 4. Check 4: terminology

| Term | Conflict | Rating |
|------|----------|--------|
| QTY per Assy | The name says "per assembly" and now means the count for the whole order. Kept "for now" with a hint (D-34); the architect records the risk (ARCH-R6) | Minor, accepted by the delivery lead |
| "Calculate" for a Lead | UX SCR-06 labels the Lead's first-time button "Calculate" (A-08); PRD FR-061 and FR-064 and the route say "Recalculate" | Minor |
| item, part, sub-part, node, row | PRD FR-043 "items, parts and sub-parts"; FR-044 "node"; UX and architecture "row" | Minor |
| estimate, quotation, task | PRD "estimate" and "task"; SPEC and the Jira question wordings "quotation" | Minor |
| Release names | "Release 1", "R1 core", "initial release" (scope A includes R2). Stories use R1 core, R1+, R2 | Minor |
| Glossary | PRD and architecture carry none; SPEC §16 defines QTY per Assy and "Not applicable" | Minor |

All are CR-17.

## 5. Check 5: UX against architecture and the PRD

The rules re-checked in v0.2 still agree (BL as the sum of BG; Warn on every 0; every figure clears; no file until current; cancel then remove, Admin only; rate notice; optional picture; Last backup; one figure per row). Closed since: the Last backup line is staged R1 in the UX (CR-26); the restore is the Admin's in the UX 11.1 and in the PRD v0.10 (CR-21). The step-up check now has its own story (06.14). Two differences were open in v0.3 and are now settled:

- **CR-32, closed.** SCR-01 and UJ-01 disagreed on what a failed sign-in keeps. UX v0.7 (b451726) settles it; story 01.01 keeps the e-mail and leaves the password alone, as SCR-01.
- **CR-33, closed except one sentence.** Architecture v0.11 section 6 (AQP-1 10614) states the rule once: `withRoute` checks the role first, before any lookup, so a Lead or an Engineer on a route not listed for their role gets 403 with a fixed body and SCR-26; the uniform 404 stays only for an Engineer's own routes (a missing estimate or another Engineer's). Architecture 4.10 and the test strategy follow it. The scrum-master applied it to AQP-48 (the words "or the uniform 404 where the manifest says so" removed), 57, 65, 74, 113 and 130 and checked 122, 123, 142 and 148 (10620). **Residual:** test plan section 9 still gives the uniform 404 for audit and Settings; owner qa-engineer.

## 6. Check 6: sequencing

1. Fixed in v0.2 and still holding: 03.05 before 05.09; the Settings page frame (02.09) before the alert switch (09.02); 02.09 after the backup job (10.05); the Warn runs 05.12, 06.10, 07.06; scaffold and shell first (10.01, 10.02).
2. **New: the step-up check is its own story (06.14), ranked before 06.12 and 06.13.** It was an item inside 06.12. PRD v0.11 ships it in R1 for cancel approval and remove price, and 01.09, 08.02, 08.04, 08.06 reuse it (EPIC-08 depends on EPIC-06 for it). It depends on 01.01 and 01.05 (the one shared password-verification function and the throttle pattern). No hours move.
3. **New: nine dependencies the sprint stories need and do not state** (13 links, `backlog.md` section 7): 01.02 before 01.06; 01.03 before 01.08, 02.01, 02.02, 02.03, 02.04, 02.05, 04.01; 02.01 before 02.03, 02.04, 02.05; 02.03 before 02.04, 02.05. The four dependencies the scrum-master added (01.07 after 01.04, 01.08 after 01.02, 02.x after 01.07, 02.04 after 03.01) are correct and present in Jira; the 28 links equal the plan table. All 13 new ones agree with the execution order of the sprint plan, so no order changes (CR-34).

## 7. Check 7: NFR allocation (30 of 30)

| NFR | Allocated to | Story or enabler |
|-----|--------------|------------------|
| NFR-001 | EPIC-01 | 01.02 role matrix test |
| NFR-002 | EPIC-01 | 01.03 projection and scan; every Engineer-page story, 05.12 included, repeats it |
| NFR-003 | EPIC-01 | 01.01, 01.05, 01.06 |
| NFR-004 | EPIC-06, EPIC-08, EPIC-01 | **06.14 (the check)**; 06.12, 06.13 (two actions at R1); 08.02, 08.04, 08.06; 01.09 |
| NFR-005 | EPIC-05 | 05.07 |
| NFR-006 | EPIC-10 | 10.01 secret and repository scan (enabler) |
| NFR-007 | EPIC-01 | 01.07; 06.07, 06.08, 06.10, 06.12, 06.13 and 05.12 each carry their event |
| NFR-008 | EPIC-03 | 03.06 |
| NFR-009 | EPIC-10 | 10.10 (AQP-169, the NFR-009 guards; moved from 10.09 on 2026-11-03, DL-056) and 10.13 (AQP-188, the first-load headroom cut, an enabler added 2026-11-04, DL-080, DL-081) |
| NFR-010 | EPIC-10, EPIC-07 | 10.09 (load); 07.05 (export) |
| NFR-011 | EPIC-10 | 10.09 |
| NFR-012 | EPIC-10 | 10.09 (needs the web address, Q-18) |
| NFR-013 | EPIC-10, EPIC-02 | 10.05, 10.11; 02.09 |
| NFR-014 | EPIC-09 | 09.06 |
| NFR-015 | EPIC-04, EPIC-09 | 04.01 and 04.03 (23:30 IST case); 09.05 |
| NFR-016 | EPIC-10 | 10.02, 10.08; an AC of every UI story |
| NFR-017 | EPIC-10 | 10.02; an AC of every UI story |
| NFR-018 | EPIC-10 | 10.02, 10.08; an AC of every UI story |
| NFR-019 | EPIC-10 | 10.08 |
| NFR-020 | EPIC-10 | 10.02 |
| NFR-021 | EPIC-10 | 10.02 |
| NFR-022 | EPIC-10 | 10.03 |
| NFR-023 | EPIC-10 | 10.06 |
| NFR-024 | EPIC-10, EPIC-09 | 10.09; 09.06 |
| NFR-025 | EPIC-10, EPIC-03 | 10.01 (gates); 03.02 (formula module 95 percent) |
| NFR-026 | EPIC-06 | 06.09 |
| NFR-027 | EPIC-07 | 07.01 to 07.04 |
| NFR-028 | EPIC-10 | 10.12 (Q-26 open; renumbered from 10.10 on 2026-11-03) |
| NFR-029 | EPIC-10 | 10.12 (renumbered from 10.10 on 2026-11-03) |
| NFR-030 | EPIC-10 | 10.04 |

## 8. Sprint 01: Definition of Ready validation (summary)

The full table, the reason per story and the dependency list are in `backlog.md` section 7. All **17** DoR items were checked on each story, read from Jira after the scrum-master's edits (AQP-1 10611, 10620).

- **Result: 18 of 18 READY (17 of 17 items each).** The nine corrected stories (AQP-27, 89, 90, 113, 122, 123, 130, 142, 148) now state their dependencies in the text and in Jira, and AQP-27 has AC-10 and sub-task T10 (AQP-164). The seven stories changed after architecture v0.11 (AQP-48, 57, 65, 74, 97, 113, 130) were re-read; AQP-113 has a new AC-9 (the README first-use sentence) and sub-task T7 (AQP-165), and has 9 acceptance criteria.
- **Business-rule item (item 4), as found:** passed for AQP-38, 81, 89, 123 and (with an explicit "none asserted") 27, 28, 74. **Failed as found for 11:** AQP-48 (BR-002, BR-003 missing), 57 (BR-004), 65 (BR-004), 90 (BR-003), 97 (BR-003, 008, 023, 026, 027, 036, 047), 106 (BR-025, and FR-027 cited in AC-2 but not traced), 113 (BR-003, 004, 021), 122 (BR-003, 004), 130 (BR-003), 142 (BR-003, 004, 030, 032), 148 (BR-004). Five master stories (113, 122, 123, 130, 142) also cited FR-011 in an AC without tracing it.
- **Decision on the question asked for AQP-113, 122 and 142:** yes, they need BR-004, because their Admin-only criteria (a Lead, an Engineer or a signed-out caller is refused) assert it. They also need BR-003, because they add Restricted values to `canaryMasters` and assert that no rate reaches an Engineer. AQP-142 also asserts BR-030 and BR-032 in AC-4.
- **Who corrected:** these are Trace-line additions only (no AC, estimate or dependency changed). The product-owner made them while writing each PO Validation, and records each in the story ("Corrections made by the product-owner"). The scrum-master should confirm them; they do not gate G4.
- No status is changed in Jira before the master decides G4 attempt 2; only the scrum-master moves a story to Ready after it.
- **Added 2026-11-03, after v0.4: AQP-169 (STORY-10.10, NFR-009 guards) is READY, 17 of 17 items** (Jira AQP-169, PO Validation section). It is the nineteenth sprint 01 story (stretch, first). The product-owner added two clarifications to its text (the not-found page is measured and expected to answer 404; no data or API change). Counts above (18 of 18) are as of G4 attempt 2 and are not re-stated.
- **Added 2026-11-04, after v0.4: AQP-188 (STORY-10.13, first-load JS headroom) is READY, 17 of 17 items, on the third pass (15 of 17, then 16 of 17 twice)** (`backlog.md` section 7; CR-38, CR-39, CR-40 below). It is the twentieth sprint 01 story (committed). Checked against PRD v0.14 NFR-009 and 13.9, architecture v0.17 sections 7, 8 and 10, test strategy 10.1, UX spec sections 6, 7.3.1 and 8, the links in Jira and the defect AQP-197 (DEF-013). The 190,000 B figure, the 7,247 B and 8,360 B savings, the 200,000 B limit, the count rule (distinct script and preload URLs, gzip level 9, 1 KB = 1,000 B, inline scripts not counted), the CSP nonce, the overlay rule, the DEF-013 closing rule (AQP-188 passes G7) and the 12 links agree across all of them.

## 9. Issues

Rating: **Critical** blocks G4 for the stories named; **Major** weakens a Ready story or a gate input; **Minor** is wording or tidiness.

### 9.1 Status of the v0.1 and v0.2 issues

| ID | Issue | Status now | Evidence |
|----|-------|-----------|----------|
| CR-01 to CR-08, CR-10, CR-11, CR-12, CR-14, CR-15, CR-19, CR-21 | see v0.1 and v0.2 | **Closed** (unchanged since v0.2) | |
| CR-09 | Screen generator untracked | **Closed.** Committed (89a9c00) with README and checks; the delivery lead accepts the ten numbers that also occur in the sample workbook ("Yes", comment 10576). Unverified whether any is a real value (RISK-006): the master carries it | AQP-1 10576 |
| CR-20 | No test plan; usability test undecided | **Closed.** `docs/07-qa/test-plan.md` v0.1 exists (5b46e00); usability test decided (CR-20 earlier); the delivery lead supplies a real phone, a Windows PC with a screen reader and Excel desktop (10573) and sits with the testers (10574). The Admin and IT person are both them at the rehearsal, so it shows the steps work, not that the actual Admin can follow the README alone | test plan; AQP-1 10573, 10574 |
| CR-22 | FR-106 to 108 missing from architecture matrix and UX | **Closed** (108 of 108 in both, scripted) | architecture v0.10; UX v0.6 |
| CR-24 | SPEC §10 says the exported BG sum equals BL only at quantity 1 | **Closed.** SPEC v1.12 §10 says it equals BL at any quantity | SPEC 356 |
| CR-26 | Settings page staging (SCR-15 "R2") | **Closed.** SCR-15 is "R1 core: Last backup (FR-105); R2: e-mail alerts (FR-019)" in the page and the inventory. The hours of the frame stay in EPIC-09's row (now CR-27) | `SCR-15.html`; UX v0.6 |
| CR-29 | Stale text in current documents | **Closed.** UX rows (FR-029, FR-100, OQ-ARCH-01, 11.1) and ADR-007, ADR-012 corrected. One left-over, PRD FR-011's fit criterion still says the audit screen is PROPOSED although DL-016 accepted it, is carried under CR-16 | UX v0.6; architecture v0.10 |
| CR-30 | The 40 GB disk is too small for about 105 full copies | **Closed: accepted by the delivery lead** ("40 GB is good", comment 10576; told it conflicts with 2-year retention). Residual risk for the master: 2-year retention will not hold; "Disk nearly full" tells the Admin and old copies are cleared by hand, or the disk fills and the portal stops (ARCH-R7, OQ-ARCH-03) | AQP-1 10576 |
| CR-13 | Double placement in the PRD (FR-019, FR-003, FR-006, FR-040, FR-090; §11 lists EPIC-02 for GOAL-05) | **Open (Minor).** PRD §4.2 still lists FR-019 under EPIC-02; unchanged | PRD §4.2, §11 |
| CR-16 | Stale version references and wording | **Open (Minor).** PRD header: Source brief v0.8, SPEC v1.4, questions v0.8, Date 2026-11-01, a Status line from v0.7, and FR-011's "PROPOSED"; architecture Inputs: PRD v0.8, release plan v0.8, UX v0.3; test strategy Inputs: SPEC v1.10, PRD v0.8 | file headers |
| CR-17 | Terminology | **Open (Minor)**, section 4 | |
| CR-18 | PROPOSED NFR values | **Open (Minor).** OQ-PM-03, 04, 05 stand as PROPOSED; OQ-ARCH-03 is closed (CR-30) | PRD §12 |
| CR-23 | The master had not recorded the whole-order rule, D-25 to D-37, PRD 13.4 to 13.6, the readings R-1 to R-5, or restated RISK-002, 011, 012, 013 and registered ARCH-R6, R7, R8 | **Closed by the master** (DL-027 to DL-038 recorded; risk register updated, RISK-016 to 018 new; gate-log G4 attempt 1). Not re-read by me; I rely on the master's record | decision log; gate log |
| CR-25 | Sequencing slips | **Fixed here** (section 6) | |
| CR-27 | Hours and stories do not line up by epic (Warn split over four epics; FR-006 and FR-040 hours in EPIC-09; the Settings frame hours in EPIC-09 while the frame is built in the core) | **Open (Minor).** product-manager; scrum-master | release plan 3.1 |
| CR-28 | The Warn notice states on SCR-06, 08 and 10 are wording previews | **Open (Minor).** Accepted for the DoR; check on built pages | ux-spec 0.8 |
| CR-31 | Jira status of answered or finished items, widened by the master (DL-037): AQP-10, 14, 15, 26 still read To Do although answered; AQP-14 and AQP-15 keep a "blocks AQP-18" link that DL-022 and DL-024 say no longer holds (the Jira tools here cannot remove a link). Per DL-037 the master or orchestrator also moves AQP-2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15 and 26 to Done; AQP-4 and AQP-11 stay open | **Open (Minor).** orchestrator; master. I do not change those statuses | Jira search 2026-11-02; DL-037 |

### 9.2 Issues first raised in v0.3 and v0.4

| ID | Rating | Issue | Owner | Status now |
|----|--------|-------|-------|------------|
| CR-32 | Minor | SCR-01 "clears nothing else" against UJ-01 "field values kept except the password" | ux-expert | **Closed.** Settled in UX v0.7 (b451726); story 01.01 follows SCR-01 |
| CR-33 | Minor | What an Engineer gets on a Lead or Admin route is stated three ways (section 5) | solution-architect; scrum-master; qa-engineer | **Closed in architecture v0.11 section 6 and in the stories (10620).** Residual: test plan section 9 still says 404 for audit and Settings; qa-engineer. **Open (Minor)** until that edit |
| CR-34 | Major | Nine of the 18 sprint stories were not Ready (missing dependency text; 10.01 lacked the database guard) | scrum-master; product-owner | **Closed.** Scrum-master corrected them (10611); re-validated here: all nine pass |
| CR-35 | Minor | `sprint-01-plan.md` carried stale notes | scrum-master | **Closed.** Refreshed (v0.2, 10605; v0.3, 10620, 121 sub-tasks, IMP-S1-02 closed). Not re-read line by line by me |
| CR-36 | Minor | **My DoR check of 2026-11-02 counted 16 items; the standard has 17.** The item not counted was "Relevant business rules (BR-IDs) listed", marked n/a for most stories. The Jira comments 10577 to 10594 repeat the error | product-owner | **Closed.** All 18 re-checked on 17 items; new comments supersede the old ones |
| CR-37 | Minor | The BR item failed as found for 11 stories (section 8). Five master stories cited FR-011 and AQP-106 cited FR-027 without tracing them | product-owner (made); scrum-master (confirm) | **Closed here.** Trace lines corrected; no AC, estimate or link changed. EPIC-02 now lists BR-003 and BR-004 |

Counts: Critical 0. Major open 0. Minor open 8 (CR-13, 16, 17, 18, 27, 28, 31, 33 residual).

### 9.3 Issues first raised on 2026-11-04 (AQP-188)

| ID | Rating | Issue | Owner | Status now |
|----|--------|-------|-------|------------|
| CR-38 | Minor | AQP-188's Trace line says "BR: none asserted" and lists NFR-009, FR-009, FR-085. AC-9 asserts the Engineer canary scan (BR-003) and is headed NFR-001, NFR-002. The same finding as AQP-90 (CR-37) | scrum-master (writes, DL-039); product-owner (names) | **Closed 2026-11-04** (description revision 5, read back by the product-owner): BR-003, NFR-001, NFR-002, NFR-016 to 018 in the Trace line; rule 11 and SCR-25 cited. Comment 10881 had reported a save that had failed (CONTENT_LIMIT_EXCEEDED) |
| CR-39 | Major | **Closed on re-validation: ux-spec v0.11 (uncommitted) adds 7.3.1 rule 11 and the SCR-25 states; the docs PR lands it after PR #56.** UX spec against AQP-188 AC-8 and AC-10: section 7.3.1 rule 7 and the Loading row say a button with `aria-busy` is disabled and shows no pressed state; the ACs hold the pressed look with `aria-busy="true"` on an enabled control, and the shared `Button` disables on `loading`. The pending and failed first-open states (and the failure line) are in no UX screen. The master asked for a ux-expert step before the story reaches Ready (G7 AQP-182, condition 5) | ux-expert | Closed 2026-11-04 (ux-expert, 10883). Residual Minor: the SCR-25 mock-up pages do not draw the new states |
| CR-40 | Minor | Test strategy 10.1 and the test plan name none of AQP-188's new checks (network log with no preload, layout-shift observer, 20 of 20 early tap with `--retries=0`), and neither says the 190,000 B figure is checked once at G6 by reviewer-performance while the limit table stays at 200,000 B | solution-architect; qa-engineer | Open. Before AQP-188 reaches G6 |

| CR-41 | Major | AQP-188 AC-9 ends "The Engineer canary scan finds 0", but no canary scan exists at `master`: story 01.03 (AQP-57) builds it, 01.03 is now in the stretch after 01.02, and AQP-188 is not blocked by it (every other story that uses the scan is). The sentence cannot be verified at G7. The testing note's path `tests/security/canary-scan.spec.ts` exists nowhere. Raised by the product-owner, who passed it on the first two reads | solution-architect (wording); scrum-master (applies) | **Closed 2026-11-04** (revision 6): the solution-architect's option A (10887), a unit test of the layout props, with real test names; verified against `origin/master` 9d924a1 |

Counts after the third re-validation, 2026-11-04: Critical 0. Major open 0 (CR-39 and CR-41 closed). Minor open 9 (the 8 above and CR-40; CR-38 closed).

## 10. Open inputs and what they gate

| Input | Reference | Gates | Fallback |
|-------|-----------|-------|----------|
| The master's G4 decision, attempt 2 | gate log | Ready status and any story branch | none |
| The delivery lead's way of working and merge turnaround | PRD v0.12, release plan 3.3 (AQP-1 10621) | the sprint 1 plan, dates | today's way |
| Test plan section 9: 403, not 404, for audit and Settings | CR-33 residual; qa-engineer | the QA test for AQP-74 | the story's own assertion (403) |
| Open for the architect, none blocking: a deleted treatment on a draft estimate (before 05.06); sign-out and `session_version`; the two database roles | 10620 | none in sprint 1 | the stories' labelled assumptions |
| Container image source | OQ-ARCH-02 (Accucut IT) | 10.04 deployment | none needed to build |
| The Admin's limited server account | A-35 (Accucut IT) | 10.11 rehearsal | full access, which widens ARCH-R8 |
| Mail account facts | OQ-ARCH-11 (Accucut IT) | 09.02 onward, 09.08 | capturing server; `FEATURE_EMAIL` off |
| Web address, sender address, Outlook account | Q-18 | 10.09 uptime check, 09.x | none |
| Largest realistic estimate with images | OQ-PM-05 | 07.05 limit decision | PROPOSED values |
| Whether any generator number is a real value | CR-09 residual | RISK-006 | the master carries it |

## 11. For G4

**Zero Critical, zero Major.** CR-23 is closed by the master and CR-34 by the scrum-master's corrections and this re-validation. All 18 sprint 01 stories pass all 17 DoR items (section 8); 11 needed a Trace-line correction for the business-rule item, which I made and disclosed, so the scrum-master should confirm them. The remaining items are Minor and none gates G4. The first sprint's ranks 1 to 18 have no open question. The step-up check is its own story (06.14) ahead of cancel approval and remove price. The hours moved to scope A 88.5 to 132.5 h, central 110.5 h (architecture v0.11, PRD v0.12), from `clear-copies.sh` in EPIC-10 (10.05); no story estimate changed.
