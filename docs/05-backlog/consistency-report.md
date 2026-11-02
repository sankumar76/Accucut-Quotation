# Cross-Artefact Consistency Report: Accucut Quotation Portal (G4 input)

| Field | Value |
|-------|-------|
| Version | 0.2 (re-issue of 0.1, written 2026-11-01 against SPEC v1.5, PRD v0.7, UX v0.3, architecture v0.4) |
| Owner | product-owner |
| Date | 2026-11-02 |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10, 101 FRs. EPIC-11, EPIC-12 and FR-093 to 096 are outside it |
| Compared | SPEC v1.11 (committed d6ce1cc; the coordinator named v1.10), PRD v0.10 (commit 1257745, which landed while this report was being written), release plan v0.10, UX spec v0.5 and `screens/` (41 pages), architecture v0.9, test strategy v0.9, ADR-001 to 014; decision log DL-001 to DL-026; gate log G3; Jira AQP-1 comments 10542 to 10564, AQP-14, AQP-15, AQP-26 |
| Result | **0 Critical.** 6 Major open (CR-09, 20, 22, 23, 24, 30), 9 Minor open, 1 Minor fixed in this re-issue and CR-21 closed by PRD v0.10. FR and NFR coverage is complete. Every Held mark of v0.1 is cleared |

## 0. Method and limits

- **Scripted** (Node, over the working tree): the 108 FR rows of PRD section 4 with priority and release; the FR to epic map; the architecture coverage matrix (section 12); the UX section 9 table; the 30 NFR rows; the text of all 41 screen pages (scripts removed, tags stripped) searched for stale terms and for the new states.
- **Read**: PRD v0.9 sections 1 to 13 (the long header paragraphs only in part), then the v0.10 text of FR-091, FR-105, R-5 and the header; release plan 1, 3.1, 5, 6.1 and the v0.9 to v0.10 diff; SPEC header, 1, 3 to 12, 14 to 16 and the §18 decisions D-21 to D-37, §18.2 and §18.5; all 14 ADRs; architecture header, 4.3, 4.4, 4.8, 4.10, 9.5, 12, 14, 15, 16.11, 16.14; test strategy header, 5, 12; UX spec header, 0.8, 5, 9, 11; gate log; decision log in full; Jira comments named above.
- **Not done**: the SPEC §2, §17 and §18.1 D-01 to D-20 were not re-read in full; the requirements catalogue and questions file, the risk register and the GitHub issues #11 and #12 were not read; the screens were not rendered and no browser was run (the 41 pages were read by script, not by eye); **the screen generator was not read, and I did not check it or the screens for sample-workbook values**. The sample workbook was not opened. This report and the epics contain no sample value; the numbers 24, 30, 840, 1000 and the CE cases are the PRD and test strategy's invented examples, cited by name.
- PRD v0.10 landed (commit 1257745) while this report was being written. I re-ran the FR script on it (108 FRs, the map unchanged) and re-read FR-091, FR-105 and R-5: it now follows SPEC v1.11 D-36, so CR-21 is closed. I did not re-read the rest of v0.10 line by line.

## 1. Summary of the seven checks

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Every Must FR covered by an epic | **Pass.** 90 of 90 Must FRs are in EPIC-01 to EPIC-10 | none |
| 2 | Every user-facing FR has a UX screen | **Pass in substance, three gaps in the table.** FR-106, 107, 108 are absent from UX section 9 and from the screen inventory (105 of 108 mapped), though SCR-06, 08 and 16 carry them; SCR-15 is labelled R2 | CR-22, CR-26 |
| 3 | Every FR and NFR in the architecture coverage matrix | **Gap:** 105 of 108 FRs (FR-106, 107, 108 have text in sections 4.8 and 4.10 but no matrix row); 30 of 30 NFRs | CR-22 |
| 4 | Terminology consistent | Minor conflicts | CR-17 |
| 5 | UX and architecture agree | **Agree on every rule re-checked** (Warn, cleared figures, no file until current, cancel and remove, rate notice, optional picture, Last backup, one figure per row). Stale statements remain in both | CR-22, CR-26, CR-29 |
| 6 | Sequencing: enablers before dependents | Source documents mostly agree now; five gaps found and fixed in this backlog, one new rule added | CR-25 |
| 7 | NFRs allocated | **Pass.** 30 of 30 allocated (section 7) | none |

## 2. Check 1: FR to epic map (exactly one epic each)

Script result: 108 FR rows in the PRD, 0 duplicates, 0 unmapped, 0 mapped to an ID not in the PRD. Scope A is 101 FRs (R1 core 78, R1+ 6, R2 17; Must 90, Should 11), equal to PRD 6.2 and the release plan.

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

Rulings behind the map (CR-13): FR-003 and FR-019 to EPIC-09; FR-006 to EPIC-01 and FR-040 to EPIC-04 (effort in EPIC-09); FR-090 to EPIC-11; FR-104 to EPIC-05 with its work shared by 06.10 and 07.06; FR-105 to EPIC-02 (PRD section 7); FR-106 to 108 to EPIC-06.

## 3. Check 2: FR to UX screen

| Gap | FRs | Detail | Owner |
|-----|-----|--------|-------|
| Not in `ux-spec.md` section 9 or the section 5 inventory | FR-106, 107, 108 | UX v0.5 was written against PRD v0.8, which had no FR numbers for the rate notice, Cancel approval and Remove price. The screens carry them: `SCR-06.html` states Rates changed, Cancel approval, Approval cancelled, Remove price and Price removed; `SCR-08.html` carries the rate line; SCR-16 the events. The review bars of SCR-06, 08 and 16 do not list the FRs | ux-expert (CR-22) |
| Release label | FR-105 (R1 core) | `SCR-15.html` and the inventory label SCR-15 "R2" with FR-019, 105; the PRD builds the Settings frame and the Last backup line in the core | ux-expert, product-manager (CR-26) |
| Closed since v0.1 | FR-098 to 105, FR-060 | Section 9 now has FR-001 to FR-105 (105 rows); FR-060 maps to SCR-07 in Release 1 | |
| No screen, by reason | FR-090, 091, 092, 093 to 097 | Section 9 states "none" with reasons. FR-091 is documentation, but its restore script is a command, not a screen (10.11) | none |

## 4. Check 3: architecture coverage

Scripted: section 12 has rows for FR-001 to FR-105 and NFR-001 to NFR-030; FR-106, FR-107 and FR-108 have no row. Two matrix notes are stale: the FR-063 row says "The notice before approval has no FR yet" and the FR-105 row says "Cancel approval and remove price have no FR yet" (CR-22, CR-29). The matrix names components, not epics; the epic references in section 14 all resolve (EPIC-12 is outside scope A).

## 5. Check 4: terminology

| Term | Conflict | Rating |
|------|----------|--------|
| QTY per Assy | The field name says "per assembly" and now means the count for the whole order. Kept "for now" with a hint under it (D-34); the architect records the risk (ARCH-R6). The Excel header keeps the old name | Minor, accepted by the delivery lead |
| "Calculate" for a Lead | UX SCR-06 labels the Lead's first-time button "Calculate" (A-08); PRD FR-061 and FR-064 say "Recalculate"; the route is `/recalculate` | Minor |
| item, part, sub-part, node, row | PRD FR-043 "items, parts and sub-parts"; FR-044 "node"; UX and architecture "row"; the new rule says "every row" | Minor |
| estimate, quotation, task | PRD "estimate" and "task"; SPEC and the Jira question wordings "quotation" | Minor |
| Release names | "Release 1", "R1 core", "initial release" (scope A includes R2). Stories use the build-stage labels R1 core, R1+, R2 | Minor |
| Glossary | PRD and architecture carry none; the SPEC §16 defines QTY per Assy and "Not applicable" | Minor |
| NFR-015 | Settled with the "(cat. NFR-nnn)" convention; unchanged since v0.1 | closed |

All are CR-17.

## 6. Check 5: UX against architecture and the PRD

Re-checked by script on the 41 pages and by reading UX 0.8 and 11 against architecture 4.3, 4.4, 4.6, 4.8, 4.10:

| Rule | Architecture v0.9 | UX v0.5 / screens | State |
|------|-------------------|--------------------|-------|
| BL is the sum of BG; a parent shows only its own row | 4.3, ADR-006 | One box per row, no Σ, no item total; 0 hits for ROLLUP, Σ, "every level", "times the item quantity", "pieces counted" on all 41 pages | Agree |
| Warn on every 0, two presses, Lead asked again | 4.3 | SCR-05 two states; SCR-06 dialog; SCR-08 one line; SCR-10 notice; SCR-16 entry. The Lead-side notices are labelled "wording preview" because the sample has no row with a 0 | Agree (CR-28) |
| Every figure clears; no file until current; BO stays | 4.8, 4.6 | SCR-06 Total cleared; SCR-07 "Cleared. Press Recalculate"; SCR-10 no file card; "out of date" appears on SCR-10 only to say the file is gone | Agree |
| Cancel approval, then Remove price, Admin only | 4.10 | SCR-06 states and dialogs, SCR-16 | Agree; FR numbers missing (CR-22) |
| Rate notice, counts only | 4.8 | SCR-06 Rates changed; SCR-08 line | Agree |
| Picture optional; "Not applicable" to everyone | 4.9, 15.2 | SCR-05 "Optional"; no missing-picture message | Agree |
| UX-40 (BM system field), UX-41 (Scrap Weight formula), UX-43 (SCR-08 500 characters, 409 state) | 16.9 | Present in `SCR-17.html`, `SCR-07.html`, `SCR-08.html` | Agree (closed) |
| Last backup, Backup late, Disk nearly full | 9.5 | SCR-15 shows all three | Agree on content, **not on stage** (SCR-15 "R2", CR-26) |
| Who restores | 9.5, 16.14: the Admin | UX 11.1 item 1 still asks who holds the key and who restores | Stale (CR-29) |

## 7. Check 6: sequencing

Found in this pass, with the ruling taken in the backlog (CR-25, fixed here):

1. **Calculate needs the calculation record.** v0.1 put 03.05 after 05.09. Now 03.05 is rank 20, before 05.09 (rank 35).
2. **The step-up primitive is needed in R1.** Cancel approval and Remove price (FR-107, 108) ask for the Admin's password at R1, while FR-080 was R2. STORY-06.12 builds it; 01.09 and 08.02 to 08.06 reuse it.
3. **The Settings page frame comes before the alert switch.** FR-105 (R1 core) needs the Settings page; FR-019 (R2) fills it. STORY-02.09 builds the frame, 09.02 follows it.
4. **The Last backup line reads what the backup job writes.** 02.09 depends on 10.05 (`job_runs`); the restore (10.11) depends on 10.05 and 10.04.
5. **The Warn runs across four stories.** 05.12 (Calculate, needs 05.09, 03.05, 01.07), 06.10 (Lead's screens), 07.06 (export preview).
6. Confirmed from v0.1 and now in the PRD: scaffold, CI, tokens and shell first (10.01, 10.02); EPIC-03 depends on EPIC-02; the FR-064 transition (06.01) before Calculate; FR-087 (10.06) after the form (05.03); delete guards (02.07) after estimates (04.01); task close and reopen (04.05) last in EPIC-04; R2 order EPIC-08 before EPIC-09.

## 8. Check 7: NFR allocation (30 of 30)

| NFR | Allocated to | Story or enabler |
|-----|--------------|------------------|
| NFR-001 | EPIC-01 | 01.02 role matrix test |
| NFR-002 | EPIC-01 | 01.03 projection and scan; every Engineer-page story, 05.12 included, repeats it |
| NFR-003 | EPIC-01 | 01.01, 01.05, 01.06 |
| NFR-004 | EPIC-06, EPIC-08, EPIC-01 | 06.12, 06.13 (two at R1); 08.02, 08.04, 08.06; 01.09 |
| NFR-005 | EPIC-05 | 05.07 |
| NFR-006 | EPIC-10 | 10.01 secret and repository scan (enabler) |
| NFR-007 | EPIC-01 | 01.07; 06.07, 06.08, 06.10, 06.12, 06.13 and 05.12 each carry their event |
| NFR-008 | EPIC-03 | 03.06 |
| NFR-009 | EPIC-10 | 10.09 |
| NFR-010 | EPIC-10, EPIC-07 | 10.09 (load); 07.05 (export) |
| NFR-011 | EPIC-10 | 10.09 |
| NFR-012 | EPIC-10 | 10.09 (needs the web address, Q-18) |
| NFR-013 | EPIC-10, EPIC-02 | 10.05, 10.11 (restore on a healthy server); 02.09 (the line the Admin checks) |
| NFR-014 | EPIC-09 | 09.06 |
| NFR-015 | EPIC-04, EPIC-09 | 04.03 (23:30 IST case); 09.05 |
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
| NFR-028 | EPIC-10 | 10.10 (Q-26 open) |
| NFR-029 | EPIC-10 | 10.10 |
| NFR-030 | EPIC-10 | 10.04 |

NFR-016, 017 and 018 are written into every UI story's acceptance criteria. Ten NFRs still carry PROPOSED values (PRD section 5); stories may use them.

## 9. Issues

Rating: **Critical** blocks G4 for the stories named; **Major** weakens a Ready story or a gate input; **Minor** is wording or tidiness. Owner is the agent (or person) who changes the artefact.

### 9.1 Status of the v0.1 issues (CR-01 to CR-20)

| ID | v0.1 issue | Status now | Evidence |
|----|-----------|-----------|----------|
| CR-01 | Q-35 (a) unanswered, holds the roll-up story (Critical) | **Closed.** Answered 1000 (D-21, DL-024); Q-39 answered (AQP-26 10535, 10537); the roll-up no longer exists. Jira AQP-14 and AQP-26 still read To Do (CR-31) | SPEC §18 D-12, D-21; ADR-006 |
| CR-02 | OQ-ARCH-10 unanswered | **Closed.** Warn (D-22), Q-38 Yes, Q-41 keep (D-26); FR-104; stories 05.12, 06.10, 07.06 | AQP-15 10511, 10527, 10543; DL-023 |
| CR-03 | A-18 extension unruled | **Closed and overtaken.** DL-018 accepted it; Q-37 then cleared every figure (D-28), so a single-piece product is no special case | architecture 4.8 |
| CR-04 | PRD 13.2 decisions unrecorded | **Partly closed.** 13.2 (DL-019) and 13.3 (DL-020) recorded; 13.4 and D-25 to D-37 are not (now CR-23) | decision log |
| CR-05 | UX §9 lacks FR-098 to 103 | **Closed** (FR-001 to 105). New gap FR-106 to 108 (CR-22) | UX §9 script |
| CR-06 | UX-38, UX-39, UX-36 scope | **Closed.** UX-38 and 39 overtaken; UX-36 done | UX 0.7, 0.8 |
| CR-07 | UX-40, 41, 43 | **Closed**, verified in the three screens | scripted |
| CR-08 | Stale UX text ("narrow case", SCR-18 sentence) | **Closed**: 0 hits in the spec and on 41 pages. Smaller stale rows remain (CR-29) | scripted |
| CR-09 | Screen generator untracked and unchecked | **Open (Major).** `docs/03-ux/generator/` has a README and check scripts but is still untracked (`git status`). The ux-expert reports ten generator numbers that also occur in the sample workbook and asks Santhosh whether to replace them. Condition 13, due G4 | comment 10564; DL-017, DL-026 |
| CR-10 | FR-060 mapped to an R2 screen | **Closed** | UX §9 |
| CR-11 | No home for scaffold, CI, tokens, shell | **Closed.** Confirmed by the architect (16.11) and the product-manager (PRD 12.2, DL-020 item 4); the hours were never itemised | architecture 16.11 |
| CR-12 | Missing dependencies | **Closed** in PRD section 7; own rulings extended (CR-25) | PRD §7 |
| CR-13 | Double placement in the PRD | **Open (Minor).** FR-019 (§4.2 under EPIC-02, §7 EPIC-09; §11 GOAL-05 lists EPIC-02), FR-003 (§4.1, §7), FR-006 and FR-040 (hours in EPIC-09), FR-090 (§4.10 under EPIC-10, §7 EPIC-11) | PRD §4, §7, §11 |
| CR-14 | "Last backup" line has no FR | **Closed.** FR-105 firm (AQP-1 10549). Staging issue is CR-26 | PRD FR-105 |
| CR-15 | Q-37 omits the single-piece row | **Closed** (Q-37 answered; no special row) | D-28 |
| CR-16 | Stale version references | **Open (Minor), extended**: PRD header says Source brief v0.8, SPEC v1.4, Date 2026-11-01 and a Status line from v0.7; architecture Inputs cite PRD v0.8, release plan v0.8, UX v0.3; test strategy Inputs cite PRD v0.8 and SPEC v1.10; UX Inputs cite PRD v0.8 | file headers |
| CR-17 | Terminology | **Open (Minor)**, section 5 | |
| CR-18 | PROPOSED NFR values; G4 questions | **Open (Minor)**: OQ-PM-03, 04, 05 stand as PROPOSED. OQ-ARCH-03 is now CR-30 | PRD §12 |
| CR-19 | Open assumptions shaping story text | **Closed.** Q-35 (b), Q-36, Q-37, OQ-UX-13, OQ-UX-16 all answered | SPEC §18 |
| CR-20 | Usability test undecided; checks unowned; no test plan | **Open (Major), reduced.** Participants decided (2 Engineers, 2 Leads, 1 Admin, no names; AQP-1 10556), test after the hand-over; the phone, screen-reader and high-contrast checks are in 10.02. **No test plan exists** (`docs/07-qa/` holds only `defects/`); qa-engineer owes it by G4 (DL-026) | |

### 9.2 New issues

| ID | Rating | Issue | Evidence | Owner | Action and status |
|----|--------|-------|----------|-------|-------------------|
| CR-21 | ~~Major~~ **Closed** | PRD v0.9 said the Admin only checks backups and that the key holder and restorer were not stated (FR-091, FR-105, NFR-013, R-5). **PRD v0.10 (commit 1257745) takes the restore hours and the backup roles:** FR-091 and FR-105 say the Admin holds the key, has server access and runs the restore, and R-5 records the Admin's limited account (A-35). Story 10.11 matches | PRD v0.10 FR-091, FR-105, R-5; SPEC D-36; architecture 16.14 | product-manager | Closed 2026-11-02 |
| CR-22 | Major | **FR-106, FR-107, FR-108 are missing from the architecture coverage matrix, from UX section 9 and from the UX screen inventory**, and two matrix notes say they have no FR yet. Both documents were written against PRD v0.8 | scripts; architecture FR-063 and FR-105 rows | solution-architect (matrix and notes); ux-expert (section 5, 9, review bars) | Open. The screens and the architecture text already cover the behaviour |
| CR-23 | Major | **The master has not recorded** the whole-order rule (it reverses what G3 accepted and DL-011, DL-024 rested on), D-25 to D-37, PRD 13.4 (8 items) and the readings R-1 to R-5, nor restated RISK-002, 011, 012, 013 or registered ARCH-R6, R7, R8; the decision log ends at DL-026. The master also has not said whether "their two figures added" (840, SPEC §7.4) meets DL-024's "a number" for the G7 control. `docs/project-state.md` still shows Q-38, Q-39 and BLK-03 as open | decision log; project state | master; orchestrator (project-state) | Open |
| CR-24 | Major | **SPEC §10 contradicts the rule**: "Where the exported BG column is added up by hand, it equals BL only when every quantity above a row is 1." SPEC §7.4, §14.2, PRD FR-069 and ADR-012 say the sum of the exported BG column equals BL2 at any quantity | SPEC line 356 | business-analyst | Open. Story 07.03 follows FR-069 |
| CR-25 | Minor | Sequencing slips in v0.1 and gaps for the new FRs (section 7) | | product-owner | **Fixed in this backlog** |
| CR-26 | Minor | **Settings page staging.** FR-105 is R1 core (EPIC-02) but SCR-15 is "R2" in the UX spec and the screen's review bar, and the page frame's hours stay in EPIC-09's row, so the R1 core hours (59.5 to 91.25) leave the frame out although the core must ship it (checkpoint C interim hand-over) | PRD 12.2 CR-14 row; release plan 3.1; `SCR-15.html` | product-manager (hours); ux-expert (label) | Story 02.09 builds the frame; open |
| CR-27 | Minor | **Hours and stories do not line up by epic.** Warn's hours are split over EPIC-03, 05, 06, 07 while the stories are vertical (05.12, 06.10, 07.06); FR-006 and FR-040 hours sit in EPIC-09; the frame hours (CR-26). Checkpoint burn-down by epic will not match epic totals | PRD §7; release plan 3.1 | product-manager; scrum-master | Open |
| CR-28 | Minor | The Warn notice states on SCR-06, 08 and 10 are labelled wording previews with example rows, since the sample has no row with a 0. Real data states appear only on built pages | comment 10564; ux-spec 0.8 | ux-expert | Accepted for the DoR; check on built pages |
| CR-29 | Minor | **Stale text inside current documents:** UX section 9 rows FR-029 ("with the BG, BJ and BK sums") and FR-100 ("an item with nothing below it, UX-38", "Unlocked and changed"), UX 11 OQ-ARCH-01 (A-05 open) and 11.1 item 1 (key holder); ADR-007 Context ("Export is allowed at any status") and ADR-012's "Added at UX reconciliation" paragraph (a never-calculated estimate exports inputs), both replaced by the later paragraphs; PRD FR-011 "audit screen PROPOSED" (accepted, DL-016) | | ux-expert; solution-architect; product-manager | Open |
| CR-30 | Major | **OQ-ARCH-03: the 40 GB VM disk is too small for about 105 full copies on the same server** (about 6 months at an invented 0.1 GB of new data a week; Q-24 gives no volume). A full disk stops PostgreSQL. Due G4, Accucut IT. The free-space check (10.05) and the Disk nearly full line (02.09) are design; the size is IT's | architecture 9.5, ARCH-R7; PRD §12 | Accucut IT; Santhosh | Open. Does not hold a story |
| CR-31 | Minor | **Jira hygiene.** AQP-14, AQP-15, AQP-26 and AQP-10 read To Do although answered; AQP-14 and AQP-15 keep a "blocks AQP-18" link which DL-022 and DL-024 say no longer holds. No Jira tool here removes a link; the AQP-18 description now says so | Jira search 2026-11-02 | orchestrator; master | Open |

Counts: Critical 0. Major open 6 (CR-09, 20, 22, 23, 24, 30); CR-21 closed. Minor open 9 (CR-13, 16, 17, 18, 26, 27, 28, 29, 31); CR-25 fixed here.

## 10. Items the coordinator asked to be reported

| Item | Report |
|------|--------|
| ux-expert work | Conditions 12 and 13 and UX-38 to UX-65: reported done by the ux-expert (comments 10539, 10564) and consistent with what I scripted on the 41 pages. Open: the generator is untracked, with the sample-number question for Santhosh (CR-09); FR-106 to 108 and SCR-15's label (CR-22, CR-26); stale rows (CR-29) |
| Master | Has not decided G4 (DL-026) and has not recorded the later answers (CR-23) |
| AQP-14, AQP-15, AQP-26 | Answered in SPEC §18; Jira status and links stale (CR-31); no story is held by them |
| FR-104 to FR-108 | Stories 05.12, 06.10, 07.06; 02.09; 06.11, 06.12, 06.13; plus 10.11 for D-36 |

## 11. Open inputs and what they gate

| Input | Reference | Gates | Fallback |
|-------|-----------|-------|----------|
| Master's G4 decision and rulings | DL-026, CR-23 | Start of any story branch (no story exists yet) | none |
| Test plan | qa-engineer, condition 15 | G4 | none |
| Generator committed and checked; sample-number decision | CR-09 | G4 (condition 13) | none |
| VM disk size | OQ-ARCH-03 (Accucut IT) | 10.04, 10.05 reach "ready to deploy", not Ready | the free-space check |
| Container image source | OQ-ARCH-02 (Accucut IT) | 10.04 deployment | none needed to build |
| The Admin's limited server account | A-35 (Accucut IT) | 10.11 rehearsal | full access, which widens ARCH-R8 |
| Mail account facts | OQ-ARCH-11 (Accucut IT) | 09.02 onward, 09.08 | capturing server; `FEATURE_EMAIL` off |
| Web address, sender address, Outlook account | Q-18 | 10.09 uptime check, 09.x | none |
| Largest realistic estimate with images | OQ-PM-05 | 07.05 limit decision | PROPOSED values |

## 12. For G4

The check has **no Critical item**. The Major items are about other roles' documents and the master's record, not about the backlog: CR-22 and CR-24 are alignment fixes for the solution-architect, ux-expert and business-analyst; CR-23 is the master's; CR-09 and CR-20 are DL-026's remaining G4 inputs; CR-30 is Accucut IT's. Epic-level DoR cannot be validated yet because no story exists: the "PO Validation" section of each story is written when the scrum-master drafts it. Ranks 1 to 18 of `backlog.md` have no open input.
