# Cross-Artefact Consistency Report: Accucut Quotation Portal (G4 input)

| Field | Value |
|-------|-------|
| Version | 0.1 |
| Owner | product-owner |
| Date | 2026-11-01 |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10, 96 FRs. EPIC-11, EPIC-12 and FR-093 to 096 are outside it |
| Compared | PRD v0.7, release plan v0.7, UX spec v0.3 (and `screens/`), architecture v0.4, test strategy v0.4, SPEC v1.5; gate log G3 (comment 10501), decision log DL-009 to DL-017, Jira AQP-1 comments 10503 to 10509, AQP-14, AQP-15 |
| Result | 1 Critical (story-level hold, escalated), 11 Major, 8 Minor. Coverage of FRs and NFRs is complete. No inconsistency in FR to epic mapping remains after the rulings in section 2 |

## 0. Method and limits

- **Scripted** (Node, over the files in the working tree): FR rows of PRD section 4 (103, with priority and release), the FR to epic map in section 2, the architecture coverage matrix (section 12), the UX section 9 table, the NFR rows of PRD section 5 (30).
- **Read**: PRD v0.7 in full; release plan v0.7 in full; UX spec header, sections 0.5, 0.6, 5, 9, 11, SCR-06 text; architecture header, sections 12 to 15, 16.9; test strategy header, 5.6, 12; gate log in full; SPEC header, 7.4, 8.2; the Jira issues named above.
- **Not done**: the SPEC was not read in full; the ADR files, the catalogue and the screen HTML were not read (one text search of the screens for a stale phrase, section 5); no browser was run; the screen generator was not read. **I have not checked the generator or the screens for sample values.** No sample workbook value was read or used.
- The sample workbook was not opened. This report and the epics contain no sample value. Numbers such as 24 lids and the FR-030 cases are the PRD's invented examples and are cited by name only.

## 1. Summary of the seven checks

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Every Must FR covered by an epic | **Pass.** 85 of 85 Must FRs are in EPIC-01 to EPIC-10; 0 uncovered | none |
| 2 | Every user-facing FR has a UX screen | **Gaps in the table, none in substance.** FR-098 to FR-103 are absent from UX section 9 (97 of 103 mapped); FR-060 is mapped only to an R2 screen | CR-05, CR-10 |
| 3 | Every FR and NFR in the architecture coverage matrix | **Pass.** 103 of 103 FRs and 30 of 30 NFRs have a row naming a component | none |
| 4 | Terminology consistent | **Minor conflicts** | CR-17 |
| 5 | UX and architecture agree | **Open conflicts**: childless item (UX-38), SCR-07 cleared state (UX-39), stale UX text (UX-42), "Last backup" with no FR | CR-03, CR-06, CR-07, CR-08, CR-14 |
| 6 | Sequencing: enablers before dependents | **Gaps in the source documents, resolved in this backlog** | CR-11, CR-12 |
| 7 | NFRs allocated | **Pass.** 30 of 30 allocated (section 7) | none |

## 2. Check 1: FR to epic map (exactly one epic each)

Rulings that make the map exact (the sources disagree in four places, CR-13): FR-003 and FR-019 belong to EPIC-09 (PRD section 7, release plan section 5); FR-006 to EPIC-01 and FR-040 to EPIC-04 (PRD section 4 headings and section 7 "with EPIC-01 and 04"; their effort stays in EPIC-09, release plan 3.1); FR-090 to EPIC-11 (PRD section 7 and section 11; scope A excludes it).

| Epic | Jira | FRs | Count | Must | Should |
|------|------|-----|-------|------|--------|
| EPIC-01 Foundation, access, confidentiality | AQP-16 | 001, 002, 004, 005, 006, 007 to 011, 098, 099 | 12 | 11 | 1 (FR-006, R2) |
| EPIC-02 Masters and settings | AQP-17 | 012 to 018 | 7 | 7 | 0 (FR-014 is Must, R1+) |
| EPIC-03 Registry and calculation engine | AQP-18 | 020 to 031 | 12 | 12 | 0 |
| EPIC-04 Task assignment and queues | AQP-19 | 032 to 041, 102 | 11 | 7 | 4 (FR-035, 039, 040, 041) |
| EPIC-05 Estimate workspace | AQP-20 | 042 to 057 | 16 | 14 | 2 (FR-054, 057) |
| EPIC-06 Cost review and approval | AQP-21 | 058 to 065, 100, 101, 103 | 11 | 10 | 1 (FR-103) |
| EPIC-07 Excel export | AQP-22 | 066 to 071 | 6 | 5 | 1 (FR-071) |
| EPIC-08 Admin configuration | AQP-23 | 072 to 080 | 9 | 9 | 0 |
| EPIC-09 E-mail alerts and jobs | AQP-24 | 003, 019, 081 to 084 | 6 | 5 | 1 (FR-003) |
| EPIC-10 Experience, brand, delivery | AQP-25 | 085 to 089, 091 | 6 | 5 | 1 (FR-088) |
| **Scope A total** | | | **96** | **85** | **11** |
| EPIC-11 Later (no Jira epic, outside scope A) | none | 090, 097 | 2 | 0 Must (Could) | |
| EPIC-12 Offline (no Jira epic, outline only) | none | 092 | 1 | Won't (this release) | |
| Not planned | none | 093, 094, 095, 096 | 4 | Won't | |

Script result: 103 FR rows in the PRD, 0 duplicates, 0 unmapped, 0 mapped to an ID that is not in the PRD. The scope A count (96) and the Must count (85) equal PRD section 6.2 and release plan 2.2.

## 3. Check 2: FR to UX screen

| Gap | FRs | Detail | Owner |
|-----|-----|--------|-------|
| Missing from `ux-spec.md` section 9 | FR-098, 099, 100, 101, 102, 103 | The IDs appear nowhere in the file (0 occurrences each). The master verified the screens in substance at G3 (SCR-02, 14, 23; SCR-26; SCR-06, 10; SCR-03 Engineer and SCR-05; SCR-08, 06, 10, 16). Section 9 says "all 97" | ux-expert (CR-05) |
| Mapped to an R2 screen only | FR-060 (R1, Must) | Section 9 maps it to SCR-17-lead; PRD 12.2 (OQ-UX-18) says SCR-07 does it in R1. SCR-07's FR list in section 5 omits 060 | ux-expert (CR-10) |
| No screen, by reason | FR-090, 091, 092, 093 to 097 | Section 9 states "none" with reasons. FR-091 is documentation | none |
| Message undefined | FR-047/055 (picture required on every part, OQ-UX-13) | Working design has no message for an assembly with no picture | ux-expert, after the answer (CR-19) |

## 4. Check 3: architecture coverage

Scripted: section 12 has rows for FR-001 to FR-103 (0 missing) and NFR-001 to NFR-030. Each row names a component. The matrix has no epic column; epic references appear in section 14 only, and all of them resolve (EPIC-12 is outside scope A and is reported in section 9). No gap.

## 5. Check 4: terminology

| Term | Conflict | Rating |
|------|----------|--------|
| NFR-015 | PRD: localisation; catalogue: dark mode. PRD v0.7 uses "(cat. NFR-nnn)" where it could be misread. Verified in the PRD; SPEC 1.5 applies it per the business-analyst's hand-off 10507 (SPEC not read in full here) | closed |
| "Calculate" for a Lead | UX SCR-06 labels the Lead's button "Calculate" (a Lead may calculate, A-08); PRD FR-061 and FR-064 and the API say "Recalculate" (architecture 16.9 item 7: the button calls `/recalculate`) | Minor |
| item, part, sub-part, node, row | PRD FR-043 "items, parts and sub-parts"; FR-044 "node"; UX and architecture "row" and "node". "Top-level item" is consistent since DL-012 | Minor |
| estimate, quotation, task | PRD "estimate" and "task"; SPEC and AQP-14 "quotation" | Minor |
| Release names | "Release 1", "R1 core", "MVP", "initial release" (scope A includes R2). Stories must use the build-stage labels R1 core, R1+, R2 | Minor |
| Glossary | PRD and architecture carry none; the brief, the catalogue and the UX spec do. QTY per Assy is defined in PRD FR-029 only | Minor |

All six are CR-17.

## 6. Check 5: UX against architecture

| Point | Architecture v0.4 | UX spec v0.3 | State |
|-------|-------------------|--------------|-------|
| Footer row, markers, roll-up, password, session, reason | Section 16.9 | Agree | Agree |
| Childless top-level item while the total is cleared | Withheld on screen (A-18, third addition) | No page shows one (UX-38); item figures are cleared, a part's own figure stays | **Conflict**: CR-03, CR-06 |
| SCR-07 cleared state | API returns flagged values | SCR-07 has states default, assembly, loading, error only (UX-39) | **Conflict**: CR-06 |
| BM as a system field on SCR-17; Scrap Weight formula text | `systemRole: 'tool-cost'`; seeded `IF(...)` guard | Not shown (UX-40, UX-41) | CR-07 |
| SCR-08 wording and the 409 message | 500-character limit; `TOTALS_OUT_OF_DATE` | "under 500" and no message (UX-43) | CR-07 |
| QTY per Assy 0 message | Block at Calculate and Recalculate, two screens | Not applied, held (UX-36 scope: SCR-05 and SCR-06) | CR-02 |
| "Last backup" line on SCR-15 | Settings row proposed | Drawn, labelled a proposal; PRD has no FR, and ASSUMPTION-53 says no backup screen in Release 1 | CR-14 |
| Stale statements in the UX text | PRD v0.7 decisions | Line 124 "narrow case"; section 11.1 "none of them stops G4"; sign-in indexable; hand-over without password; "Not applicable" as a locked row in UJ-10; Q-32 row; eight OQ-UX rows decided in PRD 12.2 shown open (UX-42). A text search of the screens finds the old ROLLUP sentence "times the item quantity" still in `SCR-18.html` | CR-08 |

## 7. Check 6: sequencing

Findings, with the ruling taken in this backlog (details in the epic files and `backlog.md`):

1. **No home for the first enablers (CR-11).** PRD section 7 gives EPIC-01 no dependency and says EPIC-10 "runs alongside". Architecture section 14 places the scaffold (TD-05, RISK-006) in EPIC-10; release plan section 5 places "Scaffold, auth, users, roles, shell, About" in EPIC-01. Every UI story needs the scaffold, the gates, the secret scan, the tokens and the shell. Ruling: STORY-10.01 and STORY-10.02 are enablers, first in the backlog, before any EPIC-01 story.
2. EPIC-03 depends on EPIC-02 for master values (PRD section 8 says so; section 7 lists only EPIC-01). Ruling: Jira links and the epic file show both (CR-12).
3. FR-064's transitions are owned by EPIC-06 but EPIC-05's Calculate sets SUBMITTED, while EPIC-06 depends on EPIC-05. Ruling: STORY-06.01 (state machine) is scheduled before STORY-05.09 (CR-12).
4. FR-087 (EPIC-10) is built on the workspace of EPIC-05: STORY-10.06 follows 05.03. Delete guards (FR-013, 015) need estimates (EPIC-04): STORY-02.07 follows 04.01. FR-038 close and reopen needs approval and unlock: STORY-04.05 is last in EPIC-04. FR-011's events are emitted by EPIC-02, 06, 08: the audit service (STORY-01.07) comes first and the owning stories carry the event as an acceptance criterion (CR-12).
5. R2 order: PRD section 8 leaves EPIC-08 against EPIC-09 undecided. Ruling: EPIC-08 first (largest, riskiest, closes a SPEC MUST, matches SPEC section 13 order; EPIC-09 waits on mail facts) (CR-12).
6. The roll-up chain: STORY-03.04 gates 06.02 to 06.09 and 07.03, 07.04. If AQP-14 is unanswered when EPIC-05 finishes (central about Thu 2026-11-12, an estimate), EPIC-06 and EPIC-07 stall: 13.25 to 19.5 h of estimated effort (6.75 to 10 plus 6.5 to 9.5). This is the critical path (CR-01).

## 8. Check 7: NFR allocation (30 of 30)

| NFR | Allocated to | Story or enabler |
|-----|--------------|------------------|
| NFR-001 | EPIC-01 | 01.02 role matrix test |
| NFR-002 | EPIC-01 | 01.03 projection and scan; every Engineer-page story repeats it as an AC |
| NFR-003 | EPIC-01 | 01.01, 01.05, 01.06 |
| NFR-004 | EPIC-08, EPIC-01 | 08.02, 08.04, 08.06; 01.09 (fourth action) |
| NFR-005 | EPIC-05 | 05.07 |
| NFR-006 | EPIC-10 | 10.01 secret and repository scan (enabler) |
| NFR-007 | EPIC-01 | 01.07; each emitting story carries its event |
| NFR-008 | EPIC-03 | 03.06 |
| NFR-009 | EPIC-10 | 10.09 |
| NFR-010 | EPIC-10, EPIC-07 | 10.09 (load); 07.05 (export) |
| NFR-011 | EPIC-10 | 10.09 |
| NFR-012 | EPIC-10 | 10.09 (needs the web address, Q-18) |
| NFR-013 | EPIC-10 | 10.05 |
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

NFR-016, 017 and 018 are cross-cutting: they are written into the acceptance criteria of every UI story, so that the DoR item "non-functional criteria are explicit and measurable" is met per story, and verified in aggregate by 10.08. Ten NFRs still carry PROPOSED values (PRD section 5); stories may use them, and CR-18 lists the owners.

## 9. Issues

Rating: **Critical** blocks G4 (for the stories named); **Major** weakens a Ready story or a gate input; **Minor** is wording or tidiness. Owner is the agent (or person) who changes the artefact. "Fixed here" means the epic files already apply the ruling.

| ID | Rating | Issue | Evidence | Owner | Action and status |
|----|--------|-------|----------|-------|-------------------|
| CR-01 | **Critical** (story-level; escalated) | Q-35 (a) is unanswered. It asks for one number, silence does not close it and there is no fallback (DL-012). The roll-up story cannot reach Ready, and EPIC-06 and EPIC-07 depend on it. G4 can pass only if no roll-up story or dependent is in the Ready set | AQP-14 (To Do, assigned Santhosh); HOLD-01 request 10508 item 2; test strategy 5.6 | Santhosh (answer); business-analyst (record in SPEC section 18); orchestrator (chase through HOLD-01) | Dependency marked: Jira link AQP-14 blocks AQP-18; STORY-03.04 and its dependents marked Held. The roll-up story's acceptance criteria cite CE-2, CE-9 and CE-12 with values worked from the answer (test strategy 5.6, control 2), written when it arrives. Open |
| CR-02 | Major | OQ-ARCH-10 / OQ-PM-07 is unanswered. With no reply by G4 a block at Calculate and Recalculate applies as the labelled fallback (DL-013: the master's fail-safe, not the delivery lead's decision). Not covered by the options: a QTY per Assy of 0 on a part with no parts below it (the question mentions it, nobody has sized it). UX-36 is held and its scope is SCR-05 and SCR-06. SPEC 7.1 minimum for H still pending | AQP-15 (To Do, unassigned); architecture A-19; ux-spec 0.5 (not applied); BA hand-off 10507 | Santhosh (answer); master (adopt the fallback at G4 if silent); ux-expert (UX-36); business-analyst (SPEC 7.1) | Dependency marked: AQP-15 blocks AQP-18; ACs of 03.04 and 05.09 carry the check "per the answer or the block". Open |
| CR-03 | Major | The master has not ruled on the A-18 extension (a childless top-level item's BG, BJ, BK withheld on screen while the total is cleared). PRD FR-100 says "pending the master's ruling". The stories for the cleared state (06.04) and the out-of-date file (07.04) would rest on an unruled design, so the DoR item "no open question that would block implementation" fails for them | PRD FR-100, FR-069; architecture A-18, 16.9 item 3; DL-009 (APPROVED did not cover it) | master | Ruling needed before 06.04 and 07.04 reach Ready. 06.04 and 07.04 marked Held |
| CR-04 | Major | The 12 product-manager decisions of PRD section 13.2 are not recorded by the master (OQ-UX-03, 04, 11, 14, 15, 17, 18, 19; OQ-ARCH-01; FR-091 reading; the OQ-PM-07 withdrawal; the dates). Stories on FR-004, 006, 013, 015, 064, 070, 089, 103 carry them as "PM decision, unrecorded" | PRD 13.2; gate log G3 condition 7 | master | Record in `decision-log.md`. Until then the stories cite PRD v0.7 FR text and flag it. Open |
| CR-05 | Major | `ux-spec.md` section 9 has no rows for FR-098 to FR-103; the Inputs line still says PRD v0.4; section 9 says "all 97". Gate record condition 12. The UX expert was stopped by the delivery lead, so this is not done | Script over section 9; ux-spec line 8; gate log G3 condition 12 | ux-expert | Reported, not fixed. Stories for FR-098 to FR-103 link to the screens named in section 3 of this report |
| CR-06 | Major | UX-38 (no page shows a childless top-level item; its tree and node figures while cleared), UX-39 (SCR-07 has no Total cleared state) and the wider UX-36 scope are not applied | Architecture 16.9 | ux-expert | Reported, not fixed. Stories 06.02, 06.03, 06.04 cannot cite a state that has no screen until then |
| CR-07 | Minor | UX-40 (BM as a system field on SCR-17), UX-41 (Scrap Weight formula text on SCR-07 and 17), UX-43 (SCR-08 "under 500 characters"; no message for 409 `TOTALS_OUT_OF_DATE`) | Architecture 16.9 | ux-expert | Reported, not fixed |
| CR-08 | Major | UX-42 stale text: line 124 of `ux-spec.md` says "narrow case" for Q-35 (a), which DL-012 and the master called false at G3 (check 14); section 11.1 says none of the questions stops G4; sign-in indexable (FR-089 says `noindex`); hand-over without password (FR-006 says password); "Not applicable" as a locked list row in UJ-10 (D-17); Q-32 row; eight OQ-UX rows (03, 04, 11, 14, 15, 17, 18, 19) that PRD 12.2 decided still show Open or Answered, proposed. `SCR-18.html` still says ROLLUP is "times the item quantity" | ux-spec line 124; text search of the screens; architecture 16.9 UX-42 | ux-expert | Reported, not fixed. Until corrected, a story that cites a screen follows PRD v0.7 where they differ and says so |
| CR-09 | Major | The screen generator `docs/03-ux/generator/` (8 files) is untracked and unchecked: gate record condition 13 (G4 at the latest), DL-017, RISK-015. UX-36, Q-35 to Q-37 and the UX items will force screen edits, so the generator is the source of the pages | `git status`: `?? docs/03-ux/generator/`; gate log condition 13 | ux-expert (check for sample values, confirm it reproduces the committed pages); orchestrator (commit) | Reported, not fixed. I did not read the generator |
| CR-10 | Minor | FR-060 (Must, R1) is mapped in UX section 9 to SCR-17-lead (R2), and in section 5 SCR-07 does not list FR-060; PRD 12.2 says SCR-07 satisfies it | ux-spec lines 773, 289, 868 | ux-expert | Reported. Story 06.03 cites SCR-07 |
| CR-11 | Major | No home for the scaffold, CI, secret scan, tokens and shell: three documents disagree on whether it is EPIC-01 or EPIC-10 and whether EPIC-01 has a dependency | PRD section 7; architecture 14 (TD-05, RISK-006); release plan section 5 step 1 | product-owner (ruled); product-manager and solution-architect (confirm effort placement) | **Fixed here**: STORY-10.01 and 10.02 are enablers before EPIC-01. Confirmation requested |
| CR-12 | Minor | Dependencies missing or inconsistent in the PRD: EPIC-03 on EPIC-02; FR-064 transitions against EPIC-05; FR-087 on EPIC-05; delete guards on EPIC-04; FR-038 on EPIC-06; R2 order EPIC-08 or EPIC-09 | PRD sections 7, 8 | product-owner (ruled), product-manager (align PRD section 7) | **Fixed here** in the epic files and Jira links |
| CR-13 | Minor | Double placement in the PRD: FR-003 (section 4.1 EPIC-01 and section 7 EPIC-09), FR-019 (section 4.2 EPIC-02, section 7 EPIC-09, section 11 GOAL-05 lists EPIC-02), FR-006 and FR-040 ("with EPIC-01 and 04" but their hours are in EPIC-09), FR-090 (section 4.10 EPIC-10, section 7 EPIC-11) | PRD sections 4.1, 4.2, 4.10, 7, 11; release plan section 5 | product-manager | Ruling in section 2 above. PRD text to be aligned |
| CR-14 | Major | A read-only "Last backup" line and a "Backup late" state on SCR-15 (UX-35) has no FR, and PRD ASSUMPTION-53 says there is no backup screen in Release 1 while scope A ships R2 in the same hand-over. Depends on OQ-ARCH-12 | ux-spec 0.5 item 17; architecture 9.5; PRD 9.1 | product-manager (add an FR or drop it); Santhosh (OQ-ARCH-12) | Not in any story until decided. Open |
| CR-15 | Major | Q-37 as posted at HOLD-01 (item 7) asks about part costs, the export and a price approved before an unlock, but not about a single-piece product's own row on screen and in the file, which the architect asks it to cover | Comment 10508 item 7; architecture 16.9 issues for other roles | business-analyst | Reword Q-37 or add it to the A-18 ruling. Open |
| CR-16 | Minor | Stale references: PRD "Source brief" cites SPEC v1.4, brief v0.8, questions v0.8 (now SPEC v1.5 and 0.9 files); architecture Inputs cites SPEC v1.4; UX Inputs cites PRD v0.4 | Headers of the three files; BA hand-off 10507 | product-manager; solution-architect; ux-expert | Reported |
| CR-17 | Minor | Terminology: section 5 above | | product-manager (glossary), ux-expert (Lead button label) | Reported |
| CR-18 | Minor | Ten NFRs carry PROPOSED values and four G4 questions are open (OQ-PM-03 availability, OQ-PM-04 browsers, OQ-PM-05 export size, OQ-ARCH-02 and 03 registry access and VM size). The PROPOSED values stand for the DoR | PRD section 5, 12 | product-manager; Santhosh; Accucut IT | Reported |
| CR-19 | Minor | Open business questions with working assumptions that shape story text: Q-35 (b), Q-36, Q-37, OQ-UX-13 (picture required; no message), OQ-UX-16 (notice of changed rates). The assumptions run and are labelled | Comment 10508 items 5 to 8 | Santhosh; business-analyst; ux-expert | Stories state the assumption in Dev Context. Open |
| CR-20 | Major | Gate record condition 15 is not done: the usability test is not decided; the owners for the real phone, screen reader and high-contrast checks are not named. No test plan exists (`docs/07-qa/` holds only `defects/`) | Gate log G3 condition 15; DL-017 | product-manager and scrum-master (decide the usability test); qa-engineer (test plan) | The three checks are written into STORY-10.02 and EPIC-01's first-UI-story note. Decision open |

Counts: Critical 1 (CR-01), Major 11 (CR-02, 03, 04, 05, 06, 08, 09, 11, 14, 15, 20), Minor 8 (CR-07, 10, 12, 13, 16, 17, 18, 19). Of the Major items, CR-11 and CR-12 are fixed in this backlog; the rest need their owner.

## 10. Items the known state asked to be reported, not fixed

| Item | Where | Report |
|------|-------|--------|
| Gate conditions 12 and 13, UX-38 to UX-43 | ux-expert, stopped by the delivery lead | CR-05, CR-06, CR-07, CR-08, CR-09 |
| `ux-spec.md` line 124 "narrow case" | Section 0.6, row Q-35 | CR-08 |
| Master has not ruled on the A-18 extension (FR-100) or recorded PRD 13.2 | master | CR-03, CR-04 |
| Q-35 (a) = AQP-14 and OQ-ARCH-10 = AQP-15 hold the roll-up story | | CR-01, CR-02 |

## 11. Open inputs and the stories they gate

| Input | Jira or ID | Gates | Fallback |
|-------|-----------|-------|----------|
| Q-35 (a), one number | AQP-14 | 03.04, then 06.02 to 06.09, 07.03, 07.04 | none (DL-012) |
| QTY per Assy of 0 | AQP-15 | 03.04, the zero check in 05.09 and Recalculate in 06.04 | block at Calculate and Recalculate (DL-013), the master's fail-safe |
| Master data defaults, repository public, where they may be held | AQP-10 (HOLD-01) | start of development (not DoR) | invented placeholders in tests |
| A-18 ruling; Q-37 | master; Q-37 | 06.04, 07.04 | working assumption runs, story Held |
| Q-35 (b), Q-36 | | text of 06.02, 02.06 | working ASSUMPTION-52, 54 |
| OQ-ARCH-11 mail account facts | | 09.02 onward, 09.08 | capturing server; `FEATURE_EMAIL` off |
| OQ-ARCH-12; Q-18 | | 10.05, 10.09, the "Last backup" line (CR-14) | none needed to build |
| OQ-PM-02 holidays; OQ-PM-01 | | dates only | dates unadopted |
| OQ-UX-13, OQ-UX-16 | | 05.09 message; 06.06 notice | working design |

## 12. For G4

The consistency check has 1 Critical item (CR-01), which holds one story and its dependents and is escalated to Santhosh through AQP-14. If the master reads "zero Critical" strictly, G4 cannot pass until AQP-14 is answered; if it reads DL-012 as "holds G4 for the roll-up story", G4 can pass for every other story. That is the master's call. Epic-level DoR cannot be validated yet: no story exists, so the "PO Validation" section of each story is written when the scrum-master drafts it.
