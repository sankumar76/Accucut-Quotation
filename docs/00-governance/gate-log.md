# Gate Log

> Append-only record of every quality-gate decision. Written by `master`.
> Format: one entry per decision, newest at the bottom, using `docs/templates/gate-record.md`.

---

## G0 – Intake — 2026-10-31

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** `docs/project-state.md` (Request section, working copy 2026-10-31); `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.0 §1–3, §15 (commit 8f60e39); Jira AQP-1 (description and brief comment 10383); `CLAUDE.md` §1, §3

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Problem statement present | ✱ | ✅ | `docs/project-state.md` Request, "Problem statement"; spec §1 (Excel worksheet A to BO replaced by a role-based portal); AQP-1 description, "Problem" |
| 2 | Sponsor named | ✱ | ✅ | `docs/project-state.md` Request, "Sponsor" (Santhosh / MD); `CLAUDE.md` §1 "Business sponsor", "Delivery lead"; AQP-1 description |
| 3 | Rough scope present | ✱ | ✅ | Spec §1 items 1–6 (assign, enter, calculate, approve, export, reconfigure); spec §3 roles; `docs/project-state.md` Request, "Desired outcome" |
| 4 | Desired outcome stated | | ✅ | `docs/project-state.md` Request, "Desired outcome" (acceptance tests in spec §14) |
| 5 | Known constraints stated | | ✅ | `docs/project-state.md` Request, "Known constraints" (stack, responsive, IST/UTC); budget and deadline recorded as not stated, see Rationale |
| 6 | Inputs listed and available | | ✅ | All five inputs exist, are non-empty and are tracked in Git at 8f60e39, which equals `origin/master`; contents of the .docx, .xlsx and .html not reviewed at this gate |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| — | — | — | None. | — |

**Risks registered:** none
**Rationale:** The three G0 criteria in `CLAUDE.md` §3 are met with evidence in the repository and in Jira. The missing budget and deadline do not block G0: they are not G0 criteria, and they do not change whether there is enough to start discovery. The intake states the gap openly rather than hiding it, so it is recorded here as a carry-forward and not a condition. The numbers are the sponsor's to give, and a project deadline must be known by G2, where the release plan depends on it.

**Carry-forward to G1 (business-analyst; not conditions on this decision)**
- Log project budget and target date as an open question, owner Santhosh, needed by G2.
- Confirm whether "Santhosh / MD" is one person or two; it decides who the business sign-off is.
- Spec §15 item 3 says the sample worksheet is not yet provided and expects `docs/reference/sample-estimate.xlsx`, which does not exist, yet `AMADA-20261006.xlsx` is listed as an input. Confirm whether that file is the sample, then update §15.

---

## G1 – Discovery — 2026-11-01

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** at commit be86080 (equals `origin/docs/AQP-1-inception`): `docs/01-discovery/project-brief.md` v0.2, `requirements-catalog.md` v0.2, `stakeholder-map.md` v0.2, `requirements-questions.md` v0.2 (including the §4 provenance note), `process-as-is-to-be.md` v0.2; `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` §6.1, §7.4, §14, §15, §18. Jira: all 11 comments on AQP-1, the answers on AQP-2 to AQP-11, AQP-12 and AQP-13 (no comments). GitHub: PR list (empty). Local session logs for this project, read only, for the origin of comment 10415.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Goals are SMART | ✱ | ✅ | Brief §3, GOAL-01 to GOAL-07 each have metric, baseline, target and by-when. Two limits are accepted, see Rationale: six goals are dated "before go-live", which has no date yet (Q-29), and GOAL-03's test oracle depends on Q-32 (interim definition in ASSUMPTION-48 (d)) |
| 2 | In and out of scope stated | ✱ | ✅ | Brief §5 lists both. The offline boundary is stated and labelled unconfirmed (Q-18) |
| 3 | Stakeholders and personas identified | ✱ | ✅ | Brief §4; `stakeholder-map.md` §1 to §3. All roles identified; the Admin and the IT contact are not yet named people (Q-18). No interviews took place (map, line 9) |
| 4 | Requirements catalogue has IDs and sources | ✱ | ✅ | Scripted check: BRQ 14, UR 43, BR 48, NFR 23, CONSTRAINT 8 have no duplicate ID, gap or empty Source cell. DR 14 and TR 9 have no Source column, and neither does `docs/templates/requirements-catalog.md`. No dangling ID across the five discovery files. Presence of a source is checked here; reliability of one source is check 7 |
| 5 | Business rules captured | | ⚠️ | BR-001 to BR-048 captured. Content of BR-023 (BN divisor), BR-047, BR-048 ("Not applicable") and BR-012 (recalculation) comes only from comment 10415 |
| 6 | Open questions have owners | | ⚠️ | Q-01 to Q-33 have owner and needed-by. Gaps: the provenance confirmation has no question ID, and the offline decision in Q-18 is due G3 although G2 must state MVP scope |
| 7 | Assumptions labelled | | ⚠️ | 49 assumptions labelled, and D-10 is correctly marked unconfirmed. But content that rests only on 10415 is presented as settled: SPEC §18 D-05 to D-08 and D-11; catalogue "Confirmed" or "Replaced by answer" on ASSUMPTION-05 to 08; Q-05 to Q-08 "Answered". The catalogue has no provenance note |

**Provenance findings (exception 4, re-examined)**
- Sole-source claim verified: AQP-6, AQP-7, AQP-8, AQP-9 and AQP-11 do not contain the BN rule, the "Not applicable" lists, the recalculation rule, the 2 x 3 rule or the release split. The Q-09 stop is not in question: AQP-10 states it in the delivery lead's own words.
- Origin of 10415: the text is an assistant's recommendation given to the delivery lead in a Claude Code session at 2026-11-01 03:37:45Z, which said to change anything that did not match how he works, "especially Q-08". It reached Jira 1 minute 55 seconds later, unedited, instruction line included. No tool call in the session logs posted it, so he very probably pasted it himself. He then asked for autopilot to resume, and posted 10417 and tried to run autopilot 11 seconds apart.
- Conclusion: **likely adopted, not confirmed.** The wording is not his, it was not edited, and nothing shows he decided each item. His message of 03:42:50Z says "Internet hosting - okay", but that answers a note about folder links, not the offline decision. These logs are evidence, not approval.
- Two points the exception list did not state. (a) The difference from the worksheet comes entirely from the 10415 sentence: AQP-9 says only that a parent's cost is the sum of its children, which equals the SPEC total when parent inputs are 0, as in the sample (F-08). If the delivery lead rejects the multiplication, most of Q-32 falls away. (b) Comment 10417 is also an assistant draft posted unchanged. The start date (2026-11-02) and 10 working days are his own words; the end date 2026-11-13 rests on the draft's Monday-to-Friday assumption.

**Decision on starting G2 (asked by the orchestrator)**
- **product-manager may start G2 now**, before Q-29, Q-32 and the provenance confirmation are answered. The PRD is a reversible document, the 10-day clock starts 2026-11-02, and the product manager's first-release proposal is the input the delivery lead needs to answer Q-29 (ASSUMPTION-45).
- **G2 may not pass until conditions 1 to 3 are met.** No G2 GO or CONDITIONAL GO on assumptions alone. Each item needs the delivery lead's answer or his explicit acceptance of the stated assumption. No UX or architecture work starts before that.
- Open questions do not block G1: all three are logged with an owner, a needed-by gate and a labelled assumption, and none is due at G1. This matches the G0 decision on budget and date.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | Santhosh (delivery lead); orchestrator requests it on AQP-1 | AQP-1 reply | Confirm or correct each, in his own words: (a) BN = BL / total Tool Cost; (b) "Not applicable" in the Material and Treatment lists; (c) recalculation after unlock uses current rates with a notice; (d) child cost x parent quantity, 2 x 3 = 6; (e) Release 1 internet only, offline later; (f) Q-15 closed; (g) keep the stated assumptions for Q-10 to Q-14, Q-16, Q-17, Q-19 to Q-28; (h) Monday-to-Friday week, ending 2026-11-13. The orchestrator must not supply pre-written reply text | G2 |
| 2 | Santhosh | AQP-13 (Q-32) | Answer (a) to (d), or accept ASSUMPTION-48 explicitly | G2 |
| 3 | Santhosh | AQP-12 (Q-29) | Answer after seeing the product manager's proposal, or accept ASSUMPTION-45 explicitly | G2 |
| 4 | business-analyst | Catalogue, brief, `requirements-questions.md`, SPEC §18 | Mark the condition 1 content unconfirmed until answered, then record the answer and its comment ID; set Q-05 to Q-08 to "Answered in part"; add the origin findings above to the provenance note; reverse any item the delivery lead rejects | G2 |
| 5 | business-analyst | SPEC §18, §7.4; brief §3; catalogue BRQ-004; Q-18 | Resolve the SPEC contradiction: §18 opens with "override earlier sections" and then "the SPEC text above is kept", and §7.4 says BL and BB are "replaced" while Q-32 says they are kept. Add Q-32 to GOAL-03 and BRQ-004. Move the offline decision in Q-18 to G2; hosting details stay G3 | G2 |
| 6 | product-manager | `docs/02-product/prd.md`, release plan | Carry the condition 1 items as labelled assumptions, not decisions; propose a first release from the SPEC §13 order for Q-29 | G2 |
| 7 | orchestrator | Run plan; `docs/project-state.md` | Keep the TR-009 stop after G3 approval in the run, as it is not in `CLAUDE.md`; refresh the stale Open Questions row (still "Q-01 to Q-28") | G3 |
| 8 | orchestrator; Santhosh | BLK-01 | Resolve the 403 or open the docs PR by hand. Not a G1 item: the artefacts are pushed and readable, and no PR exists yet (PR list empty). Needed before the G4 merge | G4 |

**Risks registered:** RISK-001, RISK-002, RISK-003, RISK-004, RISK-005
**Rationale:** All four mandatory checks pass on evidence, and the three warnings are non-mandatory, so the checklist gives CONDITIONAL GO. Two mandatory passes were judgement calls. A NO-GO on GOAL-03 was considered and rejected: the goal has a defined metric and a labelled interim oracle, and blocking it would treat Q-32 as due at G1 when it is due at G2. Undated "before go-live" goals follow the G0 position that the date must be known by G2. A hold on product-manager was also considered and rejected, because the delivery lead most likely posted 10415 and started the run, and the first checkpoint where a wrong rule could do harm is G2, which is held. The delivery lead may override either call.

---

## G2 – Product Definition — 2026-11-01

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** at commit cb41c61 (equals `origin/docs/AQP-1-inception`): `docs/02-product/prd.md` v0.2, `docs/02-product/release-plan.md` v0.2, `docs/01-discovery/requirements-questions.md` v0.4, `docs/01-discovery/project-brief.md` v0.4 (§3, §5), `docs/01-discovery/requirements-catalog.md` (BR-023, BR-046, BR-047, ASSUMPTION-46), `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` §7.3, §7.4, §18, §18.5; G1 wording of Q-32 at be86080. Jira: all 25 comments on AQP-1 (10441, 10443, 10448, 10451 read in full), AQP-9 (10403, 10442), AQP-13 (description and 10445), AQP-11 (10405, 10444), AQP-12 (10433, 10446, 10450). GitHub: PR list via `gh` (empty); the GitHub MCP server failed to connect (HTTP 401). Local session logs, read only, for the origin of the replies. Sample workbook, read only, ratios only.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | G1 condition 1 met (precondition set at G1) | ✱ | ✅ | AQP-1 10441, 10443; AQP-9 10442; AQP-13 10445; AQP-11 10444; AQP-12 10446. Met in substance; see Provenance ruling and DL-001 |
| 2 | G1 condition 2 met (precondition set at G1) | ✱ | ❌ | AQP-13 10445 answers the main rule, not all of (a) to (d), and accepts no assumption. See Condition 2 ruling |
| 3 | G1 condition 3 met (precondition set at G1) | ✱ | ✅ | AQP-12 10446 answers Q-29 in his own words, after the proposal in 10433 |
| 4 | Every FR traces to a brief goal | ✱ | ✅ | Scripted check of PRD §4: 97 FRs, no gap or duplicate, every source and fit criterion filled; 93 carry a GOAL. FR-093 to FR-096 are Won't exclusions with a catalogue source, listed out of scope in brief §5 |
| 5 | NFRs quantified | ✱ | ✅ | PRD §5: 30 of 30 have a numeric target and a measurement method. 10 carry PROPOSED values, to be confirmed by their owners; quantified is the test here, agreed is not |
| 6 | MVP scope explicit with MoSCoW | ✱ | ✅ | PRD §6 and §6.2: exactly one priority per FR; R1 core list equals section 4 (65 Must, 2 Should, scripted). The R1 core is the same under scope A and B, so Q-34 does not change it |
| 7 | Success metrics defined | ✱ | ✅ | PRD §3: seven goals with metric, baseline, target and method. GOAL-03's oracle depends on Q-32; that gap is counted once, at check 2 |
| 8 | Epics outlined | | ✅ | PRD §7: 12 epics with FRs, stage, size and dependencies |
| 9 | Release plan present | | ✅ | `release-plan.md`. All six elapsed-time cases, their dates and the Must shares recomputed and match. Every date is an estimate with no velocity behind it, and that is stated |
| 10 | No contradiction with the brief | | ⚠️ | Brief §5 agrees with PRD §4 and §6. Internal defects: FR-030 says the per-level rule "is withdrawn" while PRD §9.1 and Q-32 (a) keep it open; PRD §10 has a stale row (parent inputs "not counted under ASSUMPTION-48", which now counts them) and a duplicate calendar row; PRD §9.1 and catalogue ASSUMPTION-46 say the sample is not committed, which is false (see Finding outside the checklist) |
| 11 | Traceability sample | | ✅ | GOAL-03 → FR-030 → BR-047 → SPEC §7.4, §14.2; GOAL-02 → FR-008 → BRQ-002 → §14.1; GOAL-05 → FR-082 → BR-042. BR-001 to 048 and UR-001 to 043 all appear in a Source cell; BRQ-013 has no FR and PRD §11 says so (TR-004). No stories exist yet |
| 12 | Q-34 (scope for the date) | | ⚠️ | Unanswered, and asked only on AQP-12 10450, one minute before this gate was briefed. Does not hold G2 (DL-004) |
| 13 | "Must at most about 60 %" (product-manager rule, not a gate item) | | ⚠️ | Not met: about 96 to 98 % (B), 88 to 90 % (A). Accepted as a recorded deviation (DL-002) |

G1 conditions 4 to 6 are done (AQP-1 10427, 10448, 10451), with one correction carried below. Conditions 7 and 8 stay open, due G3 and G4.

**Provenance ruling (G1 condition 1)**
- Comment 10441 is the orchestrator's list from 10426, word for word, including its explanatory sentences, under one sentence of his: "I confirm the below items that I answered already". So "in his own words" is literally true of that sentence and not of the items.
- The condition is **met in substance**, because its purpose was to show he decided item by item, and the evidence now does: (1) "that I answered already" claims the earlier answers as his, which closes the G1 status "likely adopted, not confirmed"; (2) he corrected (d) in 10443 five minutes later, so he read the list and did not wave it through; (3) (e) and (h) are restated independently in his own words (10444, 10446).
- The later replies look like his: typing slips, curly apostrophes, and 10442 and 10446 edited after posting. A search of this project's session logs on this machine found no assistant draft of 10441, 10442, 10445 or 10446; each first appears as a tool result reading Jira, after it was posted. This differs from 10415. Limit: a draft made on a phone or in another tool would not show. The logs are evidence, not approval.
- Residual: items (a), (b), (c), (f) and (g) rest on a blanket confirmation only. Accepted, because the correction of (d) shows discrimination, and he can change any of them later. The artefacts must not call these "his own words" (remediation 5).
- The sentence "A parent has no cost of its own" comes from assistant-drafted 10415, not AQP-9 10403 as the G2 brief says. It is not in the 10441 list. His own words are "Count only all the child's cost" (10403). The reading stands on those words; the drafted sentence is unconfirmed.

**Condition 2 ruling: not met**
- As set at G1: answer (a) to (d), or accept ASSUMPTION-48 explicitly. Against that wording (be86080): (a) answered in part, the quantity is that of "the main (parent) item", intermediate quantities are not addressed; (b) a parent's displayed cost, not answered; (c) a non-zero value on a parent, not answered; (d) answered in effect, his rule adds a multiplier the worksheet lacks. No assumption was accepted, and his rule rejects the G1 version of ASSUMPTION-48.
- **He has not been asked the revised question.** AQP-13's description still shows the old (a) to (d), the old assumption and "a parent has no cost of its own". Revised Q-32 (a) to (e) and revised ASSUMPTION-48 exist only in the repository and in hand-off 10448. The assumption reversed on two price-bearing points after his reply: at G1 "(a) yes, through every level" and "(c) stored but not counted"; now "once at the top" and "a parent's own BG counts". That is a reasoned reading, but it is the analyst's, not his.
- **The price effect is not small.** Re-added independently from the sample (ratios only): BG2:BG11 equals stored BL2 exactly; a children-only reading gives a total 58.6 % lower; all quantities are 1. In the PRD's own FR-030 example, (a) changes the count by a factor of 3 (8 or 24). The "0 to about 2 h" in PRD §9.1 is effort, not price.
- **The business-analyst reason is partly wrong.** `requirements-questions.md` Q-32 says every reading gives the same result on the sample, and SPEC §18.5 closes with the same claim. SPEC §18.5 item 3 contradicts both: reading (b) differs by 58.6 %. ASSUMPTION-48 (b) also prefers the worksheet over his literal sentence. Only he can choose between them.
- **What holds and what moves (DL-005).** Q-32 (a) and (b) hold G2: they decide what GOAL-03 and FR-029, FR-030 mean, and the sample cannot settle them. Q-32 (c), (d) and (e) move to G3, and G3 cannot pass without them: (c) applies only where an item row has inputs of its own and a quantity above 1, against D-06; (d) goes with Q-31, already due G3; (e) is backed by an exact re-add.

**Why NO-GO and not CONDITIONAL GO.** A CONDITIONAL GO moving all of Q-32 to G3 was considered and rejected, though there is a real case for it: ux-expert and most of solution-architect's work do not depend on the answer, and G3 would catch it before code. Four things decide against it. (1) The G1 record says "No G2 GO or CONDITIONAL GO on assumptions alone", and the same record declined a GOAL-03 NO-GO at G1 because Q-32 was due at G2; it is now due. (2) A condition that was not asked in its current form should be asked, not waived. (3) The release plan central case already has G2 on Monday 2026-11-02 and UX starting after it, with one wait W for this point, so an answer on Monday costs nothing against the plan. (4) He must be contacted now anyway (RISK-006). His "Do not take this as a blocker" (AQP-12 10446) concerns the date; it is not read as accepting a price assumption. **He may override this decision;** the override and reason are logged.

**Finding outside the checklist: RISK-006.** The sample workbook and the draft requirements document are tracked at c7576f0 and on `origin/master`, and the repository is readable without sign-in (`gh api` visibility; anonymous HTTP 200). Q-03, Q-30 and ASSUMPTION-46 state that the original must not be and is not committed; PRD §9.1 repeats it. CLAUDE.md §6 rule 7 and NFR-006 apply. Whether the content is real is not verified. A pattern scan of tracked files on master and on this branch found no credential formats, and `.mcp.json` has one auth line and one environment reference (not printed). The G0 record listed the file as tracked at `origin/master` and I did not draw this conclusion at G0 or G1; that is my miss. Not a G2 checklist item and not a reason for this NO-GO, but it needs his decision now.

**Decisions on the brief's other questions:** Q-34 does not hold G2 (DL-004). The Must-share deviation is accepted (DL-002). PRD §6.3 moves are acceptable as proposals, with item 5 left to him and item 4 already his decision (DL-003).

**May ux-expert and solution-architect start?** **No, neither, not yet.** Both start in parallel when G2 attempt 2 returns GO or CONDITIONAL GO, or on a logged override by the delivery lead. business-analyst and product-manager may do remediation 2 to 5 now.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | Santhosh; orchestrator requests it | AQP-13 | Answer Q-32 (a) and (b), or accept revised ASSUMPTION-48 explicitly, in his own words. The orchestrator must not supply pre-written reply text | G2 attempt 2 |
| 2 | business-analyst | AQP-13; `requirements-questions.md` Q-32 | Put revised Q-32 (a) to (e) and revised ASSUMPTION-48 on AQP-13, replacing or clearly superseding the old text, marking what he answered in 10445. Restore the two G1 points dropped in the revision: a parent's displayed cost, and whether a non-zero parent value is ignored, refused or warned. In (e), include his "Row#1 ... rows from 2 to 11" against D-08 "row 2 ... rows 3 to 11". State that (a) and (b) hold G2 | Before condition 1 is requested |
| 3 | business-analyst | `requirements-questions.md` Q-32; SPEC §18.5 closing line; D-08 | Correct "every reading gives the same result on the sample" and "None of these changes the result on the sample": reading (b) is 58.6 % lower. Mark "a parent has no cost of its own" as 10415 wording, unconfirmed | G2 attempt 2 |
| 4 | product-manager | `prd.md`; `release-plan.md` §9 | FR-030: per-level rule is withdrawn "as written" and remains open as Q-32 (a). Remove the stale and duplicate rows in §10. State in §9.1 and release plan §9 that the 0 to 2 h is effort and the price effect is separate. Apply the Q-32 answer to FR-024, 025, 029, 030 and to GOAL-03. Keep Q-34 as a proposal | G2 attempt 2 |
| 5 | business-analyst; product-manager | SPEC §18, `requirements-questions.md`, catalogue, `prd.md` label key | Correct "his own words" for 10441 items (a), (b), (c), (f), (g): confirmed by him on the orchestrator's list wording. Correct ASSUMPTION-46 and PRD §9.1, which say the sample is not committed | G2 attempt 2 |
| 6 | Santhosh; orchestrator requests it now | Repository settings; sample files | RISK-006: say whether the content is real and decide what to do with the repository and the two files. Rewriting history needs his explicit authorisation. Agents do not change repository visibility or history | Now; G3 at the latest |
| 7 | Santhosh | Q-34 on AQP-12 | Choose the scope for the date. product-manager then updates the plan and logs it in `decision-log.md` | G3 approval (DL-004) |
| 8 | Santhosh | AQP-13 | Answer Q-32 (c), (d), (e), or accept them explicitly. G3 cannot pass without this | G3 |
| 9 | ux-expert; solution-architect | G3 artefacts | On starting: cover every FR through R2 whichever way Q-34 goes (G3 checklist); keep the roll-up design open until condition 8 is met | G3 |

**Risks registered:** RISK-001 to RISK-005 restated; RISK-006 to RISK-010 new. Proposed risks merged, not registered: parent non-zero inputs (into RISK-002), unverified calendar (into RISK-009).
**Rationale:** The PRD and release plan pass all four mandatory G2 checks, and the document is sound work; what fails is a precondition this gate set at G1. The rule on which quoted prices rest still has two open points that change a price, one by 58.6 % on his own sample, and the revised version has not been put to him where he answers. Two precise questions cost no time against the release plan, while passing on an assumption that overrides his own sentence would repeat the failure G1 was set to stop.

---

## G2 – Product Definition — 2026-11-01 (attempt 2)

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2
- **Artefacts evaluated:** at commit 8c8ca2a (equals `origin/docs/AQP-1-inception`): `docs/02-product/prd.md` v0.4, `docs/02-product/release-plan.md` v0.4, `docs/01-discovery/requirements-questions.md` v0.6 (Q-03, Q-30, Q-32), `docs/01-discovery/requirements-catalog.md` v0.6 (BRQ-004, BR-046, BR-047, ASSUMPTION-46, D-13), `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` v1.3 §6.1, §7.1, §7.4, §14 item 2, §16, §18 (D-12, D-13), §18.5. Jira: AQP-13 description, change history and all six comments; AQP-9 10403, 10442; AQP-1 latest 20 of 39 comments, including 10465, 10468, 10470, 10471; AQP-4 10398; AQP-10 10404; AQP-12 all three comments. GitHub: PR #1 through the GitHub MCP server; repository visibility through `gh`; anonymous HTTP check. Local session log, read only, for the origin of 10462, 10464 and 10465. The sample workbook was not opened at this attempt.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | G1 condition 1 met | ✱ | ✅ | Unchanged from attempt 1 (DL-001) |
| 2 | G1 condition 2 met | ✱ | ✅ | **Met.** (b) in their own words: AQP-13 10464, relay verified. (a), (c), (d), (e) answered or accepted: 10462 read against ASSUMPTION-48. See rulings. Own-words depth on (a) is check 12 |
| 3 | G1 condition 3 met | ✱ | ✅ | Unchanged from attempt 1 (AQP-12 10446) |
| 4 | Every FR traces to a brief goal | ✱ | ✅ | Scripted, PRD §4: 97 FRs, no gap or duplicate; 93 carry a GOAL; FR-093 to 096 are Won't exclusions |
| 5 | NFRs quantified | ✱ | ✅ | PRD §5: 30 of 30. 10 still carry PROPOSED values; quantified is the test here |
| 6 | MVP scope explicit with MoSCoW | ✱ | ✅ | Scripted: Must 80, Should 10, Could 2, Won't 5; R1 67, R1+ 6, R2 17, R3 2, R-OFF 1, none 4. Equals PRD §6.2 |
| 7 | Success metrics defined | ✱ | ✅ | PRD §3. GOAL-03 now has one stated oracle (SPEC §7.4 BL, D-12) |
| 8 | Epics outlined | | ✅ | PRD §7: 12 epics |
| 9 | Release plan present | | ✅ | All six v0.4 cases recomputed and match (B 10.05, 14.56, 20.12; A 13.49, 18.91, 25.62); the v0.3 dates also reproduce with the removed wait added back. No effort or scope moved. Every date stays an unadopted estimate |
| 10 | No contradiction with the brief | | ⚠️ | Brief agrees. Three defects: FR-056 fit says BL equals the sum of the children, true only at item quantity 1; `requirements-questions.md` Q-32 "No point is left ambiguous in a way that changes the rule" conflicts with its own row (a); OQ-PM-01 and 02 are still marked needed by G2 and are unanswered |
| 11 | Traceability sample | | ✅ | GOAL-03 → FR-030 → BR-047 → SPEC §7.4 BL, §14 item 2 → constructed example. FR-030 example recomputed: 2 x (3 + 4) = 14; part shows 7; two-item case 2 + 3 = 5. SPEC §18.5 algebra recomputed: 4 cI + 6 cP + 8 cS. No stories yet |
| 12 | Q-32 (a) stated in their own words | | ⚠️ | Accepted on list wording only; question sentence reads the other way; a factor of 3 in the example; no later test can catch it. See ruling |
| 13 | Q-34 (scope for the date) | | ⚠️ | Open, due G3 approval (DL-004). The dates they were last given are superseded: AQP-12 10450 still shows v0.2 |
| 14 | "Must at most about 60 %" | | ⚠️ | Not met; recorded deviation stands (DL-002) |
| 15 | Attempt 1 remediation 1 to 5 | | ✅ | See below |

**Ruling on Q-32 (a): accepted, and a one-line confirmation in their own words is needed.**

Evidence that "(a) Yes, that is correct" accepts the list bullet "Multiply once, at the top item":
1. Shape. Comment 10462 has eight bullets, matching the eight of the ASSUMPTION-48 list, including its unlabelled closing bullet ("Okay") and its single bullet for (e1) and (e2) ("(e1) and (e2) Yes."). The questions section has no closing bullet and keeps (e1) and (e2) apart.
2. The (b3) reply repeats a sentence that exists only in the list.
3. "Yes" cannot answer the either/or questions (e1) and (e2), so the reply was not written against the questions.
4. New: at 11:30:37Z in the session they called it "my answers/acceotance in AQP-13". Acceptance is what 10460 offered for the list.
5. New: the worksheet's formulas (`BB = BA * H`, `BL = SUM(BG)`) equal multiply-once at item quantity 1 for any intermediate quantity, and multiply-at-every-level does not. This is formula structure, not a sample value, and it fits BRQ-004.
6. Their main rule names one multiplier, "the main (parent) item". Attempt 1 ruled that this does not address intermediate quantities, so it is consistent but not decisive.

Evidence against treating it as settled:
1. The question sentence ("Does the quantity of a part in between also multiply the parts under it?") reads the opposite way, and "Yes" is its natural answer.
2. Comment 10463 and the chat message of 11:32:04Z gave labels only. Neither said "multiply once" or 8 rather than 24. So "no objection in 10464" carries little weight, and this ruling does not rest on it.
3. The same batch needed correcting at (b1), so it was not a careful statement on every bullet.
4. New: column H is named "QTY per Assy" (SPEC §7.1) and no artefact defines it; the glossary is silent. If it means per parent assembly, the sub-part in the example physically occurs 24 times and the rule counts 8. If Engineers type the total per item, the rule is right. Nobody has asked, and every quantity in the sample is 1.
5. New: no later test catches an error. The FR-030 example and the parallel run ("a worksheet calculated the same way") both encode the rule, so a wrong rule passes them. Only the delivery lead can catch it.

Why it does not hold G2. G1 barred a pass "on assumptions alone"; this is a reply on a question put to them in its current form, which answers both reasons of attempt 1 for not waiving. Condition 2 asks for an answer or explicit acceptance, and the weight of evidence shows acceptance, so check 2 is ✅ and the depth of that answer is check 12. Nothing irreversible happens before G3 approval: UX does not depend on it, architecture can isolate one multiplier, and no code starts before G3 approval and HOLD-01. G3 is already a human stop, so the due point adds no stop. A hold would cost one wait W (0.5 to 1.5 working days) with no less risk than asking now.

A stricter reading was considered: attempt 1 remediation 1 said "in his own words", which would make check 2 ❌ and this a NO-GO. Rejected, because "Yes, that is correct" is their own acceptance of a stated line, and the shortfall is the depth of a confirmation already given, not the absence of one. This is a judgement call and **they may override it**. The rule in D-12 stays the working baseline; G3 cannot pass until condition 1 below is met (DL-006).

**Ruling on list wording (DL-007).** A list-wording reply stands where the question and the list give the same result, or independent evidence decides the point, or no price depends on it.

| Point | Result | Why |
|-------|--------|-----|
| (a) | Needs own words | Question and list diverge; evidence does not settle what H means; a factor of 3 |
| (b2) consequence | Stands | Follows from their own words in 10464 |
| (b3) | Stands | Display only; the issue states it does not change the item's total. Their sentence covers the total; the display part rests on the list |
| (c) | Stands | Same result both ways: "Yes" to applying the quantity twice and "no special handling" are the same arithmetic. Narrow under D-06 |
| (d) | Stands | Question and bullet state the same rule |
| (e1) | Stands | No effect on the sample; equals the worksheet's range |
| (e2) | Stands | Worksheet formula and the exact re-add of attempt 1; the other reading is circular |
| Closing "Okay" | Stands | Follows from the rule |

Attempt 1 remediation 8 is therefore met early. G3 no longer waits on (c), (d) or (e).

**Ruling on the relay (DL-007).** Comments 10464 and 10465 were not typed in Jira, and that does not reduce their weight. The session log holds both as one message typed by the person at 11:37:49Z, with typing slips ("documnet", "doesnt", "enow"). The orchestrator posted them 12 and 15 seconds later; the quoted words match, and the interpretation of "the latest wording" is outside the quote and labelled. This is the first occurrence of those words in any log for this project, so no assistant draft precedes them. A session message is better evidence than a comment under the one shared Jira account. Comment 10462 likewise has no earlier draft; it first appears as a tool result, two minutes after it was posted. Limit: logs are evidence, not approval, and a draft made elsewhere would not show. "The latest wording" as 10442 is the orchestrator's reading; accepted because 10463 named the two comments and "parent's own cost counts" settles the substance. (b) is settled.

**G1 condition 2: met.** (b) in their own words; (c), (d), (e) on list wording under the test above; (a) accepted, with confirmation due as condition 1.

**Attempt 1 remediation**
| # | State | Evidence |
|---|-------|----------|
| 1 | Closed for (b); (a) carried as condition 1 | 10462, 10464 |
| 2 | Closed | AQP-13 change history 2026-11-01T02:23:06-0500, before the answers; 10460 asked for them |
| 3 | Closed | `requirements-questions.md` Q-32 Correction; SPEC §18.5 History; "a parent has no cost of its own" marked as 10415 wording |
| 4 | Closed | FR-024, 025, 029, 030, GOAL-03 carry D-12; PRD §10 stale and duplicate rows gone; §9.1 separates effort from price. Removing the effort contingency is early, see condition 3 |
| 5 | Closed | PRD label key; SPEC §18 status rule; ASSUMPTION-46 in PRD §9.1 and the catalogue |
| 6 | Closed | Decided, AQP-1 10465 (DL-008) |
| 7 | Open, due G3 approval | Q-34. Carried as condition 7 |
| 8 | Closed early | See list-wording ruling |
| 9 | Open, due G3 | First half stands; "keep the roll-up design open" is replaced by condition 5 |

**Repository (DL-008).** Recorded as their decision and not reopened. BLK-02 is closed: the question was answered, so nothing is blocked. RISK-006 is restated, not closed: a decision is not a verification, and it rests on "no real data", which does not cover the master data defaults they will supply (AQP-10 10404). Current state checked: public, anonymous HTTP 200, the two input files still tracked. A credential pattern scan of tracked text files at HEAD found nothing.

**Proposed risk changes.** RISK-005 and BLK-01: closed. PR #1 exists, is draft and mergeable, and its 12 files are all under `docs/` or the SPEC, so it qualifies for docs-auto at G4. RISK-002 reduced to 10, not to the Low proposed: that waits for condition 1. RISK-003 dates accepted as re-issued, score unchanged. The product manager's offer to keep the removed wait as slack is not taken up: the model is a stated estimate and the dates stay unadopted.

**May ux-expert and solution-architect start?** **Yes, both, now and in parallel.** HOLD-02 is released; no human approval is needed, as G2 is not in `HUMAN_APPROVAL_POINTS`. They work to D-12 as the baseline, cover every FR through R2 whichever way Q-34 goes, and apply conditions 5 and 6. Development does not start: G3 approval, condition 1 and HOLD-01 all come first.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | Santhosh; business-analyst words the question, orchestrator posts it now | AQP-13 | State Q-32 (a) in their own words: the count for the example, and what an Engineer types in QTY per Assy for a part under a part. The request must call for a number or a sentence, not yes or no, must not offer a reading to accept, and must carry no pre-written reply text. A reply relayed from a session counts if labelled and verbatim. Silence does not close it. If the reply differs from D-12, business-analyst and product-manager change BR-047, SPEC §7.4 BL, FR-030 and GOAL-03 | **G3 approval; G3 cannot pass without it** |
| 2 | business-analyst | `requirements-questions.md` Q-32; SPEC §18 D-12, §18.2; catalogue line for Q-32; AQP-13 description | Show (a) as accepted on list wording with own-words confirmation requested (DL-006). Replace "No point is left ambiguous". Define QTY per Assy once answered. Remove the stale "not pushed while RISK-006 is open" note | G3 |
| 3 | product-manager | `prd.md` §4, §9.1, §10, §12; `release-plan.md` §9 | Restore the effect of a change to (a) on FRs and effort until condition 1 is met; FR-056 fit: at item quantity 1, or times item quantity; re-date or ask OQ-PM-01 and 02; align the RISK-002 and RISK-006 rows with the register | G3 |
| 4 | product-manager | AQP-12 | Post the v0.4 dates and say 10450 is superseded, before Q-34 is asked | Before the Q-34 request |
| 5 | solution-architect | `architecture.md`, `test-strategy.md` | Put the quantity step in one named place so that (a) can change without a redesign. Keep the stored row BG apart from the rolled-up figure shown for a parent, so a parent is not counted twice. Carry the FR-030 constructed example into the test strategy. Real master data must not enter the repository: state where it is loaded from | G3 |
| 6 | ux-expert | `ux-spec.md`, `screens/` | A parent's screen figure (own row plus everything below) differs from its export row (own values): label it so a Lead can reconcile them | G3 |
| 7 | Santhosh | Q-34 on AQP-12 | Choose the scope for the date; product-manager then updates the plan and `master` logs it (DL-004) | G3 approval |
| 8 | orchestrator | HOLD-01 stop | At the TR-009 stop, state that the repository is public and ask where the defaults may be held | HOLD-01 |

**Risks registered:** RISK-001, 002, 003, 006, 008 restated; RISK-005 closed. No new ID: the undefined QTY per Assy and the test blind spot are merged into RISK-002.
**Rationale:** All mandatory checks pass on evidence and the warnings are non-mandatory, so the checklist gives CONDITIONAL GO. The G1 bar is respected: nothing here passes on an assumption alone. (a) is the one point where the question and the list part ways, it carries a factor of 3, and no test can catch an error in it, so it gets one line in their own words, and that line can be asked now at no cost to the plan.

---

## G3 – Solution Design — 2026-11-01

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** Santhosh: `HUMAN_APPROVAL_POINTS` G3 and G8 lifted by their instruction (AQP-1 10495, DL-010); `CLAUDE.md` not edited. Human reply on G3: APPROVED (AQP-1 10491, DL-009)
- **Attempt:** 1
- **Artefacts evaluated:** at commit bc2d3c9 (equals `origin/docs/AQP-1-inception` and PR #1 head): `docs/03-ux/ux-spec.md` v0.3 (§0.5, §0.6, §9, §11, §12), `docs/03-ux/screens/` (41 pages, index read), `docs/04-architecture/architecture.md` v0.3 (§4.3, §4.6, §9.5, §12, §14, §15, §16.8), `docs/04-architecture/test-strategy.md` v0.3, `docs/04-architecture/adr/` ADR-001 to 014, `docs/02-product/prd.md` v0.6, `docs/02-product/release-plan.md` v0.6, SPEC v1.4 (§7, §8.2, §9, §11, §18), `requirements-questions.md` v0.8, catalogue v0.8. Jira: AQP-1 latest 25 of 62 comments, including 10490, 10491, 10493, 10495, 10496, 10498, 10499; AQP-13 all 8; AQP-12 all 6. GitHub: PR #1 (draft, mergeable, no checks reported), open issues #2 to #10, repository visibility. Session log, read only, by role. Sample workbook, structure only: no cell value printed or copied.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Architecture addresses every FR and NFR | ✱ | ✅ | Scripted, `architecture.md` §12 against PRD v0.6: 103 of 103 FRs, 30 of 30 NFRs, each row names a component; PRD has no FR gap. Spot read of notes. §12 is the coverage table |
| 2 | ADRs for significant decisions, alternatives considered | ✱ | ✅ | ADR-001 to 014 all have an alternatives section (scripted). All still Proposed; see condition 14 |
| 3 | Security and data protection defined | ✱ | ✅ | `architecture.md` §8, §5.3, §5.5; ADR-008, 009, 014; test strategy §6, §7. Real master data stays out of the repository (G2 condition 5) |
| 4 | UX spec covers every user-facing FR with all states | ✱ | ✅ | **In substance, verified by me for the six FRs missing from the table (check 7):** FR-098 hint and "Needs number and symbol" on SCR-02, 14, 23; FR-099 SCR-26; FR-100, 101 Total cleared and Unlocked and changed on SCR-06, 10; FR-102 status on SCR-03 (Engineer) and SCR-05; FR-103 SCR-08, 06, 10, 16. All other FRs are in §9; FR-090, 091, 092, 095, 097 are stated "none" with reasons. 41 pages and 146 state links counted, equal to the hand-off |
| 5 | Accessibility target stated | ✱ | ✅ | `ux-spec.md` §8 WCAG 2.2 AA; PRD NFR-018 (DL-016). SPEC §11 still says 2.1 (condition 10) |
| 6 | G3 preconditions from G2 | ✱ | ✅ | Condition 1 met (DL-011). Conditions 2 to 7 met; condition 8 falls due at HOLD-01. Q-34 answered (AQP-12 10488). Q-31, Q-33 answered (10490). DL-005's "G3 cannot pass" items are answered or carried as Q-35 |
| 7 | FR → screen table complete | | ⚠️ | `ux-spec.md` §9 has no row for FR-098 to 103, and the IDs appear nowhere in the file; its Inputs line still says PRD v0.4. The UX pass worked from SPEC v1.4, not PRD v0.6. Traceability defect, not a coverage gap |
| 8 | Technical risks logged | | ✅ | `architecture.md` §14, GitHub issues #2 to #10 exist; register updated below |
| 9 | Test strategy present | | ✅ | v0.3 §5: CE-1 gives 30 and 24 lids, recomputed. CE-2 is pending (316 against 326, recomputed) |
| 10 | UX ↔ architecture conflicts resolved | | ⚠️ | No open conflict except UX-36 (DL-013). Limit: §16.8 was written against UX v0.2, so the two v0.3 files were not checked against each other by their authors. My sample: footer row, cleared states, markers and reason agree. One stale line: SCR-18 still says ROLLUP adds a column "times the item quantity" |
| 11 | Cost confidentiality on Engineer screens | | ✅ | My scan of SCR-01, 03 (Engineer), 05, 23, 24 and the device frames of SCR-05: 0 amounts, 0 BL, 0 BN; SCR-03 has one word "price", in a review note. Rupee tags on SCR-05 are input units. Server enforcement is proved only by tests |
| 12 | Old rule removed | | ⚠️ | Scripted over all artefacts: every remaining "multiply once" is labelled history, except SCR-18 (check 10). "nightly" in PRD and release plan is history or test scheduling. SPEC §8.2, §7.4 O still lack ROLLUP and the guard (condition 10) |
| 13 | Screen figures | | ✅ | BN, the override difference, T(1.1), T(item 1) and BL recomputed; the two rounding notes hold, and the page says 12,450.52 as shown against 12,450.53. Page checks at 360, 768 and 1280 px were not re-run: Playwright refuses `file:` addresses, and I did not work around that |
| 14 | Q-35 (a) "narrow case" claim (added at this gate, not a checklist item) | | ⚠️ | False as worded. See ruling 3; corrected by conditions 2 and 3 |
| 15 | SPEC agrees with design | | ⚠️ | Five SPEC items and an ID clash open (condition 10) |
| 16 | Dates reflect the design | | ⚠️ | 7.5 to 13 h and the G8 wait are not in release plan v0.6 (DL-014). No date is adopted |

**Rulings on the known points**

1. **APPROVED and the override.** APPROVED stands, for what it covered (DL-009). It came 31 seconds after they were told the screens did not yet show their answers, with four differences named. It does not cover Q-35 to Q-37, which did not exist. No re-approval is asked. Their later instruction is logged as an override of `HUMAN_APPROVAL_POINTS` (DL-010). **G8:** master evaluates the whole checklist as usual; the run does not wait for a separate sign-off; a NO-GO still stops it; deployment and code merges stay human. The G8 record cites DL-010 as the human authority, and the orchestrator says at G8 that no separate sign-off was requested.
2. **DL-006 is met** (DL-011). 10487 gives the meaning of H; "numner of lids is 24 here" gives the count. One departure from G2 condition 1 is recorded: the chat question listed 8 and 24. It does not void the answer, because they chose against the existing design. The requirement earned its place: it reversed a factor of 3 that no test could catch.
3. **Q-35 (a) stays non-blocking at G3, but it is not narrow, and it holds G4 for the roll-up story** (DL-012). The artefacts say the item's own row "normally holds 0". The sample shows otherwise: one of its two top-level items has no rows below it and a non-zero own BG. Every single-piece product looks like that. The effect is a factor of the item quantity on that row.
4. **OQ-ARCH-10 / OQ-PM-07: the delivery lead answers, due G4 before the roll-up story reaches Ready** (DL-013). Options go to them with reasons at HOLD-01. If there is no reply by then, a block at Calculate is the labelled fallback, since it cannot produce a wrong price and is undone in about 1 h. UX-36 stays held. RISK-013.
5. **Open inputs:** conditions 4 to 9. These are business inputs, not approvals, so DL-010 does not stop them being asked. They go in one request, at HOLD-01, with no extra stop.
6. **Risks:** below.
7. **SPEC alignment and logging:** condition 10; D-14 to D-20 are DL-015; product-manager proposals are DL-016; scope A is DL-014.
8. **Effort:** 83.75 to 125.75 h with the architecture's hours. "They preferred scope A" stands as the working scope. No date is adopted (DL-014).
9. **Evidence limits** (DL-017). None holds G3, because the mock-ups are rebuilt: the checks belong on built pages, and they now have owners and due gates. **The generator does matter:** UX-36 and Q-35 to Q-37 will force screen edits, the figure checks live in the generator, and the scratchpad is not kept. It enters the repository, after a check for sample values, before the next screen edit.
10. **HOLD-01 stands despite 10495.** The defaults are a data input that only they hold, and development waits for them (AQP-10). They were told so at 19:34:19Z and did not object. The stop also carries G2 condition 8: say the repository is public and ask where the defaults may be held.
11. **Decision log wording:** "his/he" replaced in DL-001, 003, 004 and 005. DL-006 and DL-007 held none (grep). No verbatim quote was changed.

**Finding outside the brief.** The portal now deliberately differs from their worksheet wherever a quantity above 1 sits above a row: the worksheet multiplies each row by its own H only (SPEC §18.5 item 4). Their answer of 24 requires this, but neither the comments read for this gate nor the chat since 18:00Z say it to them. GOAL-03 is titled "Calculate as the worksheet". A parallel run with real nested estimates will show the difference, and past quotes may be lower. It is a fact to tell them, not a question (condition 1).

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | orchestrator | Chat; AQP-1 | Report this result, as they asked to view it. Link the v0.3 screens. List what changed beyond the four named differences, the worksheet difference, the 7 and 14-day recovery point and the key. No approval requested and no reply text | Now |
| 2 | orchestrator; business-analyst words the price questions | AQP-10 or AQP-1; Jira open-question issues | One HOLD-01 request: master data defaults, repository public and where they may be held (G2 condition 8), Q-35, Q-36, Q-37, OQ-ARCH-10, OQ-ARCH-12, Q-18 remainder, OQ-PM-02. Q-35 (a) and OQ-ARCH-10 become Jira open-question issues (playbook §4.2). Q-35 (a) asks for a number, includes a single-piece item, and sets out no reading to accept. No reply text | At HOLD-01 |
| 3 | business-analyst | `requirements-questions.md` Q-35; catalogue ASSUMPTION-51 and Q-35 row; SPEC §18.2; `architecture.md` A-20 via solution-architect | Remove "narrow" and "normally holds 0"; state the single-row item case without sample values; class Q-35 (a) as blocking at G4 | Before the request is posted |
| 4 | Santhosh | Q-35 (a) | Give the number. Silence does not close it | G4, before the roll-up story reaches Ready |
| 5 | Santhosh; product-manager words the options | OQ-ARCH-10 | Answer with reasons shown. If none, a block applies as labelled fallback (DL-013). ux-expert then applies UX-36, business-analyst states the minimum for H | G4, before the roll-up story reaches Ready |
| 6 | Santhosh | Q-35 (b), Q-36, Q-37 | Business input. No price effect through approval, so labelled assumptions may run if unanswered. Q-36 must be asked, since ASSUMPTION-54 stretches "do not show this anywhere" | G4 |
| 7 | product-manager | OQ-UX-19, OQ-UX-03, OQ-ARCH-01 and the other G4 items in `ux-spec.md` §11 | Decide, or take to Santhosh. OQ-UX-03 was due G3 and is overdue | G4 |
| 8 | Accucut IT, Santhosh; orchestrator asks | OQ-ARCH-11 | Mail account facts. `FEATURE_EMAIL` stays off until they arrive | Before the e-mail story reaches Ready |
| 9 | Santhosh, Accucut IT | OQ-ARCH-12; Q-18 web address, sender address, what "Admin looks after them" means, where copies are kept | Business input. Whether Settings shows "Last backup" is needed earlier, for the Settings story | Before first deployment; checked at G8 |
| 10 | business-analyst | SPEC; catalogue | §8.2 add ROLLUP and comparisons inside IF. §11 dark mode out of scope (D-14) and WCAG 2.2 AA (DL-016). §9 header wording (DL-016). §7.1 minimum for H (after condition 5). §7.4 O Scrap Weight guard. BR-048 and §7.3: a zero in H is not "no effect". ASSUMPTION-55 and Q-37 to match what the design clears (A-18). NFR-015 means localisation in the PRD and dark mode in the catalogue: write catalogue IDs as "cat. NFR-nnn" where they could be misread | G4 |
| 11 | product-manager | `prd.md`; `release-plan.md` | Re-issue dates with the 7.5 to 13 h and without the G8 wait; change the §2.1 definition, which rests on a G8 sign-off (DL-010). FR-100, FR-069 to name what the design clears. FR-091 "runs and keeps". GOAL-03 to state the worksheet difference. Dates stay unadopted | G4 |
| 12 | ux-expert | `ux-spec.md` §9, Inputs line; SCR-18 | Add FR-098 to 103 to §9. Update the Inputs line to PRD v0.6. Correct the SCR-18 ROLLUP sentence | G4 |
| 13 | ux-expert | `docs/03-ux/` | Put the screen generator and its checks in the repository, after checking it holds no sample values, and confirm it reproduces the committed pages | Before the next screen edit; G4 at the latest |
| 14 | solution-architect | ADRs; `architecture.md`; `test-strategy.md` | Move ADRs to Accepted, noting those resting on assumptions (ADR-002, 011). Add §16.9 reconciling v0.3 against UX v0.3. Replace A-19 with DL-013. Add a case for a childless top-level item at quantity above 1. CE-2 is asserted once Q-35 (a) is answered; the roll-up story cannot pass G7 with it pending | G4 |
| 15 | product-manager; scrum-master; qa-engineer | Backlog; test plan | Real phone, screen reader and high-contrast checks on built pages at the G7 of the first UI story. Decide the usability test at G4 (DL-017) | G4 to plan; G7 to run |
| 16 | developer | E-mail story | One real send on the real mailbox before alerts go live; G8 records it | G8 |

**Risks registered:** RISK-011 (weekly backup), RISK-012 (out-of-date export), RISK-013 (ARCH-R5), RISK-014 (ARCH-R3), RISK-015 (evidence limits) new. RISK-001 raised to 10; RISK-002 restated, score unchanged at 10; RISK-003, 006, 007 restated; RISK-008 reduced to 9; RISK-010 reduced to 3, not closed. ARCH-R1 merged into RISK-011; ARCH-R2, R4 and TD-01 to 05 stay in `architecture.md` §14 with their GitHub issues.
**Rationale:** Every mandatory item passes on evidence I checked, including the six FRs the UX table omits, so the checklist gives CONDITIONAL GO. The largest open item from G2 closed in their own words and reversed the rule, which shows the check was worth holding. What remains cannot produce a wrong price before G4: nothing is built, and the two price questions now hold the roll-up story. Development does not start until HOLD-01 and G4.

---

## G4 – Backlog Ready — 2026-11-02

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none. No human stop at this gate (DL-010)
- **Attempt:** 1
- **Artefacts evaluated:** at commit 97d8a1f: `docs/05-backlog/consistency-report.md` v0.3, `backlog.md` v0.3 (sections 3 to 7), `sprint-01-plan.md` v0.1 and the header of v0.2, `docs/07-qa/test-plan.md` v0.1 (sections 12, 13, 14, 18), `docs/standards/definition-of-ready.md`, PRD v0.11 (9.1, 12, 13.3 to 13.6), release plan v0.11 (3.2, 3.3, 6.2), architecture v0.10 (9.5, 16.12 to 16.14, A-27 to A-35), ADR-006, SPEC v1.12 §18, `docs/03-ux/generator/README.md`. Jira: AQP-1 latest 100 of 125 comments, AQP-26 and AQP-15 all, all 18 story descriptions, links on the 8 corrected stories and AQP-89, validation comments on AQP-38, 74, 123, sub-tasks of AQP-27, all 15 open-question issues. GitHub: PR #1, issues #11, #12, repository visibility. Session log, read only, by role. **Not done:** generator rebuild not re-run (my shell call was denied, no retry); epic files not re-read; the other 15 stories' validation comments not opened. Sample workbook not opened; this record holds no value from it.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | PO consistency report shows no Critical | ✱ | ✅ | v0.3: 0 Critical; FR and NFR coverage complete (scripted by the product-owner). Written before the corrections, so CR-23 and CR-34 need re-issuing (remediation 2) |
| 2 | Every sprint-1 story meets DoR 100 % | ✱ | ❌ | **Done and verified by me:** 13 links read in Jira (AQP-48 to 89; AQP-57 to 90, 113, 122, 123, 130, 142, 148; AQP-113 to 122, 123, 130; AQP-122 to 123, 130); AQP-27 has AC-10 and sub-task AQP-164. **Missing:** (a) product-owner re-validation of the nine (10605 asks for it; AQP-27's text says "Pending re-validation"); (b) the "Depends on" lines on the eight stories, which `backlog.md` section 7 asked for along with the link: AQP-90 still reads 10.02 and 01.02; (c) the validation counted 16 items and the DoR has 17 checkboxes; section 8's list of what was checked names no BR-ID item. AQP-123 and AQP-130 list no BR, though BR-004 (only the Admin manages masters) applies to both, and AQP-123 also touches BR-003 |
| 3 | Stories trace to FRs and epics | ✱ | ✅ | Scripted: 18 of 18 have a Trace line and the right parent epic (AQP-16, 17, 18, 19, 25) |
| 4 | G3 conditions 12, 13, 15 and the DL-026 inputs | ✱ | ✅ | Condition 12: DL-036. Condition 13: met by acceptance, DL-033. Condition 15: test plan present |
| 5 | AC form and sizing | | ✅ | Scripted: 18 of 18 have story form, 5 to 10 ACs, every AC row Given/When/Then, Dev Context, UX, Tasks, Testing notes and points. 53 + 20 = 73 points. Sub-tasks 120 |
| 6 | Dependencies sequenced | | ✅ | All 13 new links run earlier to later in the plan's order; 41 links (10605). The text gap is under check 2 |
| 7 | Sprint goal stated | | ✅ | `sprint-01-plan.md` v0.2 |
| 8 | Capacity plausible | | ⚠️ | 53 committed against an assumed 55: a stated calibration with no velocity, and the sprint has no length. Merge model not recalibrated (release plan 6.2): 7 merge waits on sprint 1's critical path against 2 stage waits. DL-038, RISK-008 |
| 9 | No open question blocks a sprint-1 story | | ⚠️ | None held by a business question: Q-38, Q-39, Q-41 are closed. To settle first: CR-33 (a 403 or the uniform 404, story AC defers it), A-1 (IMP-S1-02), CR-32 |
| 10 | Master's record (CR-23) | | ✅ | Done here: DL-027 to DL-038; register updated; CR-23 closes on this record |
| 11 | Docs PR qualifies for docs-auto | | ✅ | Every changed file is under `docs/` or the SPEC (checked with git). PR #1 stays draft until GO; its gate list is stale |
| 12 | Backlog internally consistent | | ⚠️ | `backlog.md` section 4 "top 10" ranks 03.01, 03.02 and 02.01 at 8, 9, 10; section 5 ranks them 11, 12, 13. The execution order is section 5's. Remediation 2 |

**Rulings on the known points**

1. **Can G4 pass with CR-34 in progress? No.** DoR 100 % is mandatory, and a mandatory item cannot be carried as a condition. The corrections landed at 15:41Z, after the brief; that removes most of the gap and not all of it.
2. **Quantity rule:** recorded, DL-027. Their words meet the own-words standard for what is typed and how each row is costed. The sentence is the team's. The answer given before any reading was offered is "So the user will enter 4 frames and 12 brackets". 2, 6 and 24 are weaker: the rule had been put to them. No question is added.
3. **The error:** the orchestrator's question and my acceptance of it, DL-028.
4. **Generator:** condition 13 is met by acceptance, not by the check. RISK-006 stays at 12, DL-033.
5. **Disk:** they accepted 40 GB, so 2-year retention will not hold, and both stand. New: under A-35 nobody has the rights to clear old copies, DL-034.
6. **Admin and IT at validation:** the rehearsal with the actual Admin is still owed, DL-035.
7. **Reviews:** three stay, DL-032. **Readings and assumptions:** DL-031. **CR-31:** DL-037.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | scrum-master | Jira AQP-89, 90, 113, 122, 123, 130, 142, 148 | Add the new dependencies to each "Depends on" line, as the correction specified. Add BR-004 to AQP-123 and AQP-130, BR-003 to AQP-123, and any other relevant BR the product-owner names | G4 attempt 2 |
| 2 | product-owner | Jira; `consistency-report.md`; `backlog.md` | Re-validate the nine with a comment each. Check all 18 against all 17 DoR items, and say which item was not counted. Fill the PO Validation section, which reads Pending on 17 stories. Issue report v0.4: CR-23 closed, CR-34 and CR-35 status, CR-31 widened. Align `backlog.md` section 4 ranks | G4 attempt 2 |
| 3 | master | `gate-log.md` | Attempt 2 reads remediation 1 and 2 only; every check marked ✅ stands unless changed | G4 attempt 2 |
| 4 | product-manager | `release-plan.md` 3.3, 6.2 | Recalibrate the merge model from the story count and dependencies. Set out the ways to work (merge cadence, stacked branches, batched PRs) for them to choose. No date adopted | Before sprint 1 starts |
| 5 | solution-architect | Architecture manifest rule | State once what an Engineer gets on a Lead or Admin route (CR-33); stories follow | Before AQP-48 starts |
| 6 | solution-architect | Architecture | Confirm or replace A-1 (IMP-S1-02) | Before AQP-97 starts |
| 7 | ux-expert | `ux-spec.md` | CR-32: say whether a failed sign-in clears the password field | Before AQP-38 starts |
| 8 | solution-architect | Architecture 9.5; README | Who clears old copies, and how, given A-35 (DL-034) | Before 10.05 reaches Ready |
| 9 | product-manager; business-analyst | `prd.md`; SPEC | State the retention limit: 2 years is not a guarantee on 40 GB | Before 10.05 reaches Ready |
| 10 | qa-engineer | `test-plan.md` 13, 14, 18 | Apply 10573, 10574, DL-035; section 14.2 for one person in both roles at validation; a rehearsal with the actual Admin at hand-over | Before 10.02 reaches G7 |
| 11 | orchestrator | AQP-2 to 15, AQP-26; PR #1 | Transitions per DL-037; refresh the PR gate list. Report this result, as they asked to see it, including RISK-016 to 018, the DL-031 list and the 7 merge waits. No approval requested and no reply text | Now |
| 12 | Owners in the report | CR-13, 16, 17, 18, 27, 28 | Minor; carried | G8 |

G3 conditions 8, 9 (Q-18 remainder) and 16 stay open and are not yet due.

**Risks registered:** RISK-016 (ARCH-R6 and the whole-order count, one risk, 16 🔴), RISK-017 (ARCH-R7, 12), RISK-018 (ARCH-R8, 10) new. RISK-002 reduced to 5; RISK-013 reduced to 6; RISK-011 raised to 10; RISK-008 raised to 12; RISK-012 and RISK-009 closed; RISK-001, 003, 006, 007, 015 restated.
**Rationale:** The backlog is close: 0 Critical, full trace, and every link and acceptance criterion I checked is there. But the mandatory DoR item lacks the product-owner's re-validation, a correction was left half done, and the checklist was counted short, so the procedure gives NO-GO and attempt 1 of G2 sets the precedent. It costs one short loop with no human wait. The bigger finding for the delivery lead is not the gate: a typed count can now misprice an order with nothing to flag it (RISK-016).

---

## G4 – Backlog Ready — 2026-11-02 (attempt 2)

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. No human stop at this gate (DL-010)
- **Attempt:** 2
- **Artefacts evaluated:** at commit d3f8aef: `consistency-report.md` v0.4 in full, `backlog.md` v0.4 (section 7 through the report), `sprint-01-plan.md` v0.3 header, PRD v0.12 13.7, release plan v0.12 (2, 3.2, 3.3, 6), architecture v0.11 (6, 9.5, 16.15, A-35, A-36), `ux-spec.md` v0.7 (CR-32 lines), test plan v0.2 (section 9 rows, 11, 14). Jira: AQP-1 latest 30 of 137 comments, including 10608 to 10612, 10614, 10620, 10621, 10641, 10642; AQP-11; all 18 story descriptions compared with the attempt 1 snapshot; PO Validation on all 18; sub-tasks of AQP-113; links on AQP-142; validation comments on AQP-97; all 15 open-question issues. Session log, read only, by role. **Not done:** the simulation could not be re-run, as it is not in the repository; links on the other stories not re-read since attempt 1 (10611 and 10620 report no link change); `backlog.md` not re-read line by line. Sample workbook not opened; this record holds no value from it.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | PO consistency report shows no Critical | ✱ | ✅ | v0.4: 0 Critical, 0 Major, 8 Minor. One wording error (check 10) |
| 2 | Every sprint-1 story meets DoR 100 % | ✱ | ✅ | PO Validation reads READY, 17 of 17, on all 18. **Verified by me:** scripted, 18 of 18 have 5 to 10 ACs in Given/When/Then, a Trace line and unchanged points; all 8 "Depends on" lines name every required story; every added BR ID exists in the catalogue; BR-004 on AQP-123, AQP-130; BR-003 on AQP-123; sampled fits (DL-039); AQP-165 exists |
| 3 | Stories trace to FRs and epics | ✱ | ✅ | Stands from attempt 1; Trace lines now fuller; parent epics unchanged |
| 4 | G3 conditions 12, 13, 15 and DL-026 inputs | ✱ | ✅ | Stands from attempt 1 |
| 5 | AC form and sizing | | ✅ | As check 2. Sub-tasks 121 |
| 6 | Dependencies sequenced | | ✅ | Stands; the text now matches the links |
| 7 | Sprint goal stated | | ✅ | Unchanged in sprint plan v0.3 |
| 8 | Capacity plausible | | ⚠️ | 53 of an assumed 55. Recalibrated: sprint 1 is 5.85 days for 2.4 days of work at a half-day merge. The way of working is not chosen; way 1 at half a day stands until it is (DL-041) |
| 9 | No open question blocks a sprint-1 story | | ⚠️ | CR-33 and A-1 settled in architecture v0.11; CR-32 in UX v0.7. Open, labelled in stories, non-blocking: sign-out and `session_version` for AQP-38; the two database roles |
| 10 | Report and test plan agree with the sources | | ⚠️ | Test plan: 5 rows, the scan paragraph and a `sudo -l` precondition are stale; QA-OQ-08 is answered (DL-042). Report section 1 says "keeps the e-mail only"; UX v0.7 keeps both fields. SPEC still says "kept 2 years" and "< 200 KB" (DL-040) |
| 11 | Trace lines written outside the owner's lane | | ⚠️ | They stand; recorded; scrum-master confirms at Ready (DL-039) |
| 12 | Backlog internally consistent | | ✅ | Section 4 ranks aligned (10641; report section 8) |
| 13 | Docs PR qualifies for docs-auto | | ✅ | Every changed file on the branch is under `docs/` or the SPEC (git) |
| 14 | Attempt 1 conditions | | ✅ | 1, 2 and 3 done here. 4 met, choice open. 5 and 6 done. 7 done. 8 done by design. 9 PRD half done, SPEC half carried. 10 done, new residual carried. 11 done: 13 issues Done, AQP-4 and AQP-11 open as ruled |

**Rulings on the points asked**

1. **Trace lines (DL-039):** they stand. It was a step outside the lane, disclosed, with one real cost: the product-owner validated their own text. I gave those lines the missing check. The scrum-master confirms as each story moves to Ready. From here the product-owner names and the scrum-master writes.
2. **PRD 13.7 and A-36 (DL-040):** recorded. A-36 is a labelled proposal, and they are to be told what 4 copies means.
3. **Merge recalibration (DL-041):** accepted as an estimate, no date adopted. The way of working is theirs; way 1 stands until they choose; way 5 needs their explicit word. My attempt 1 figure overstated the effect on the end date, and that is corrected.
4. **Test plan (DL-042):** carried as a condition. It is wider than audit and Settings.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | scrum-master | Jira, 18 stories | Confirm the Trace corrections on the 11 as they move; raise any disagreement with the product-owner; move the 18 to Ready for Dev | Before the first story branch |
| 2 | orchestrator | Chat; AQP-1 | Get the way of working and turnaround **by name, not number** (DL-041). Tell them A-36 and the ceiling at about 5 to 6 GB. No reply text. Silence leaves way 1 at half a day and is not a stop | Before sprint 1 starts |
| 3 | scrum-master | `sprint-01-plan.md` | Name the way of working assumed | Before sprint 1 starts |
| 4 | qa-engineer | `test-plan.md` 9, 11, 14, 18 | 403 on rows 01.02, 01.07, 02.09, 06.06, 06.12 and the scan paragraph; `sudo -l` shows two scripts, and the rehearsal covers `clear-copies.sh`; QA-OQ-08 answered "refuse it" | Before AQP-48 reaches G7 |
| 5 | business-analyst | SPEC §7.1, §12, §18; catalogue | Retention "up to 2 years, as the disk allows"; picture under 204,800 bytes; Q-18 and OQ-ARCH-11 answers (10610, 10613, 10615) | Retention before 10.05 reaches Ready; picture before 05.07 reaches Ready |
| 6 | solution-architect | Architecture | Sign-out and `session_version`; a deleted treatment on a draft | Before AQP-38 reaches G5; before 05.06 reaches Ready |
| 7 | ux-expert | SCR-15 | "Disk nearly full" points to the README section (16.15) | Before 02.09 reaches Ready |
| 8 | product-owner | `consistency-report.md` | Correct the CR-32 wording; close CR-31 (13 Done, 2 open as ruled) | Next issue |
| 9 | product-manager | `release-plan.md` | Re-run the model when each sprint is written and at checkpoint A, with the real merge wait | Checkpoint A |
| 10 | orchestrator | PR #1; AQP-1 | Commit the records; refresh the gate list; mark ready; docs-auto merge if checks pass; report this result | Now |
| 11 | Owners in the report | CR-13, 16, 17, 18, 27, 28 | Minor; carried | G8 |

G3 conditions 8, 9 (Q-18 remainder) and 16 stay open and are not yet due. **G8 must state:** RISK-016's earliest evidence comes after the date; rehearsal run A or B (DL-035); whether the real send was done.

**Risks registered:** none new. RISK-003, RISK-008 restated, scores unchanged (10, 12). RISK-007, 014, 017, 018 restated, scores unchanged.
**Rationale:** All four mandatory items pass on evidence I checked myself, not on the summary. The three gaps from attempt 1 are closed, and the one irregularity, the Trace lines, was disclosed and now has the second check it lacked. What remains is non-mandatory, owned and dated, and none of it touches a price or a sprint-1 acceptance criterion. Red RISK-016 does not hold this gate: its field is story 05.03, but it is the risk the delivery lead most needs to keep in view.

---

## G6 – Peer Review — AQP-27 (STORY-10.01) — 2026-11-02

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none. No human stop at this gate; one repository setting is theirs to apply (QLT-04)
- **Attempt:** 1
- **Artefacts evaluated:** PR #16 at head 11c57e6: all three reviews (5745972528, 5745993780, 5746060549), every inline thread, the three PR comments, check run "Stages 1 to 11" (run 41559671485, success). Jira AQP-27: description and all 12 comments, including 10649, 10651, 10654 to 10656. Code at 11c57e6: `eslint.config.mjs`, `vitest.config.ts`, `.github/workflows/ci.yml`, `scripts/check-changed-coverage.ts`, `scripts/lib/changed-coverage.ts`, `scripts/make-gitleaks-baseline.ts`, `tests/unit/lint/layer-rules.test.ts`, `README.md`, `.gitleaks-baseline.json` (locations and commits). Design: architecture 4.1, 10; ADR-008; test strategy 10, 11. Repository settings read through the API. Session log, read only, by role. **Not done:** Gitleaks not re-run by me (no binary available to me, and a search for one was denied, no retry), so QLT-08's scan result rests on the reviewer's run and on the baseline's own entries; two later shell checks were denied, no retry; `.env.example` not opened locally; sample workbook not opened, and this record holds no value from it.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All three submitted on 11c57e6. Counts recomputed from the threads: STD 11 Minor, 9 Info (corrected by a PR comment); PRF 3 Minor, 6 Info; QLT 2 Critical, 4 Major, 11 Minor, 1 Info |
| 2 | Zero open Blocker or Critical | ✱ | ❌ | QLT-01 and QLT-04, both verified and upheld below |
| 3 | Major fixed or explicitly accepted | | ⚠️ | None fixed. All four verified and upheld; none accepted here |
| 4 | Findings cite file:line | | ✅ | Every Minor and above is inline; STD-16, STD-20 and QLT-18 are Info, in the summaries |
| 5 | Reviewed head is green | | ✅ | Check run success on 11c57e6; reviews all name that commit |
| 6 | Acceptance of the baseline and the template | | ✅ | Session log: three questions at 00:58:15Z, 01:05:33Z and 01:19:15Z, each answered by selection (DL-045) |
| 7 | `.env.example` holds placeholders only | | ✅ | Blob 711cbab equals the hash of the reviewed comment text, byte for byte (DL-045) |
| 8 | RISK-006 review | | ✅ | Public; both input files tracked; no new exposure in this PR (DL-046) |

**Critical and Major, verified**

| ID | Reviewer | Ruling | What I ran or read |
|----|----------|--------|--------------------|
| QLT-01 | Critical | **Upheld, and wider than reported** | Linted a cost-repository import through the PR config: `(portal)/engineer/page.tsx` fails; `(portal)/queue/page.tsx` and `(portal)/estimates/[code]/page.tsx` are clean, also for `lib/formula`. New: `src/components/features/x.tsx` is clean too. No Engineer page path exists in the design, and ADR-008 says Engineer and Lead views share one address. AC-6 and NFR-002 are not met where they matter |
| QLT-04 | Critical | **Upheld. Not a code defect, and the developer cannot close it** | `branches/master/protection` returns 404, `rulesets` returns an empty list, `protected` is false, `allow_rebase_merge` is true. The shared scale makes an AC partly met at least Critical. The `ci.yml` half of AC-4 is done |
| QLT-02 | Major | **Upheld** | A literal `import()` of a cost repository and of `lib/formula` from an Engineer view, of `@prisma/client` from a service, and of `next/headers` from `src/lib` all lint clean; the same static import fails |
| QLT-05 | Major | **Upheld, as latent** | `coverage.include` is `src/**` and excludes only `src/app`, generated code and `ui`. `src/instrumentation.ts`, which no test loads, shows zero hits in lcov. Architecture 10 tests services by integration. So `src/server/**` will count as uncovered at stage 6. No false failure today, and it fires loudly on the next story |
| QLT-06 | Major | **Upheld** | Real lcov 97.4 %, exit 0; zero hits 0.0 %, exit 1; zero hits with `./` paths **100.0 % (0 of 0), exit 0**. Also `--threshold abc` on zero coverage gives exit 0 (STD-07) |
| QLT-08 | Major | **Upheld, with one narrowing** | The baseline proves the mechanism: the same SPEC line is held for c7576f0, 338ce9a and 09f3963, the last being the squash of PR #1, and each `Fingerprint` starts with the commit. It fires only when an edit keeps text the rule still flags; an edit that clears the pattern adds no finding. Recovery does not deadlock: the follow-up PR passes on its own baseline |

**Rulings**

1. **QLT-04 stays Critical and holds G6.** A mandatory item cannot be carried as a condition, and the same rule held G4 attempt 1. It is an action for the delivery lead, not a question and not an approval, and it does not wait for the developer. Agents do not change repository settings. If it is not on at attempt 2, only they can waive it, as a logged override (`CLAUDE.md` section 3); AC-4 would then stay partly met at G7.
2. **QLT-01: the solution-architect is not needed before the fix.** Architecture 4.1 already has presentation reach services and views only, and 10 says `src/app` is thin, so a ban across `src/app` and `src/components` applies the design and asks no new question. The architect adds one line to section 10 saying why, in the same brief as ruling 3, and does not hold the developer. A later narrowing is theirs to propose.
3. **QLT-05: the solution-architect is needed before the fix.** It changes test strategy 10 and 11, which is theirs, and the choice sets how every later story is measured. It is one ruling with no human wait. It must say where the gate decision sits, keep unit and integration lines counted together for `src/server/**`, and not exclude `src/server`. The reviewer's second option keeps the stage order and looks the smaller change; the choice is the architect's.
4. **QLT-08: the procedure is the fix. The `gitleaks:allow` question waits** (DL-046).
5. **STD-14 note 2 and STD-16 are closed; STD-15 needs no question** (DL-045, DL-046).
6. **Minor split:** a Minor goes to the developer now if it shares a line or file with a must-fix, makes a control of this story fail open or miss what it claims, breaches a cheap security standard, or is a document that is wrong today. The rest wait for the story that gives them something to fix. No fix adds an AC, so the 10-AC limit is untouched. A Minor that proves more than cheap is listed in the Dev Record for me to defer, and does not grow the round.

**Fix list, developer, before G6 passes**

| Group | IDs | Required |
|-------|-----|----------|
| Layer rules | QLT-01, QLT-02, QLT-03 | Engineer rule covers `src/server/views/engineer-*.{ts,tsx}`, all of `src/app` and all of `src/components`. Literal `import()` is caught for every restricted path, composed per file group. Extensions widened. Fixtures at `(portal)/queue/page.tsx`, `(portal)/estimates/[code]/page.tsx` and a `src/components/features/` file, for the repository and for `lib/formula`, plus one `import()` fixture per layer rule. Keep the route-handler clean fixture |
| Coverage gates | QLT-05 (after the ruling), QLT-06, QLT-07, STD-07 | Implement the ruling. Fail closed when code was added and nothing matched, with `isExcluded` in step with `coverage.exclude`, and keep passing a PR that touches only excluded code. Run the script as a child process for both failure cases. Fix the diff parser. Validate `--threshold`; name the buffer size |
| Baseline documents and test | QLT-08, QLT-10, QLT-11 | README: first try wording that clears the pattern; otherwise the two-step route (branch entry, then a follow-up PR naming the squash commit), who agrees each step, and that `master` is red until then. All-refs behaviour; squash only, never rebase. Compare `Fingerprint`, not location. Say only what the control shows |
| Guards | QLT-12, QLT-13, QLT-14, QLT-15, STD-06 | `getAll('host')`; a child-process test for the `globalSetup` wiring; `runIf`, a wider option pattern and a directory-walk test; a test for `register()`; the guard and the tests see the same settings as `.env`, stated in the Dev Record |
| Secrets and data | STD-02, STD-03, STD-04, STD-05, STD-08, STD-09, QLT-16 item 1 | `\getenv` in the roles script, after confirming the runner's `psql`; database name as a variable; redaction of this project's own variable names, with tests; every `.env.example` value empty, a placeholder or a named safe literal; `MAX_TCP_PORT`; append key and certificate patterns; wider data-file list |
| CI | STD-01, STD-12 / PRF-03 | `BASE_REF` through `env`. `cancel-in-progress` on pull requests only (Info, taken because the line is one and the first `master` run matters) |

**Deferred (tech-debt, DL-044):** #17 PRF-01, PRF-02, QLT-17; #18 PRF-04; #19 QLT-16 item 2; #20 STD-10. **QLT-09** closes with the setting. **STD-11** goes to the solution-architect. Other Info items need no action; PRF-07, PRF-09 and STD-13 are noted in those issues.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | Santhosh (delivery lead); orchestrator tells them now, no reply text | GitHub, Settings, Branches | Rule for `master`: tick "Require a pull request before merging" and leave "Require approvals" unticked; tick "Require status checks to pass before merging" and "Require branches to be up to date before merging", and select `Stages 1 to 11`; tick "Do not allow bypassing the above settings"; leave force pushes and deletions unticked | G6 attempt 2 |
| 2 | Santhosh | GitHub, Settings, General, Pull Requests | Untick "Allow rebase merging"; keep "Allow squash merging" | G6 attempt 2 |
| 3 | solution-architect | `test-strategy.md` 10, 11; `architecture.md` 10, 11 | Rule on QLT-05 (ruling 3). One line in 10 for ruling 2. Record `@types/pg` and any other unnamed tool in 11 (STD-11) | Before the developer starts QLT-05 |
| 4 | developer | PR #16 | The fix list; reply in each thread; update the Dev Record | G6 attempt 2 |
| 5 | reviewer-quality, reviewer-standards; reviewer-performance for the CI change and the longer redaction list only | PR #16 | Re-review the new diff only (playbook 5.3) | G6 attempt 2 |
| 6 | master | Repository settings | Read the protection API: required context `Stages 1 to 11`, strict on, `enforce_admins` on, force pushes off; `allow_rebase_merge` false | G6 attempt 2 |
| 7 | orchestrator | `master` after the merge | Squash only. Check that the first push run on `master` is green: the reviewer's squash result came from scans, not a real squash | After the human merge |
| 8 | product-manager | PRD | NFR-009 has no JS budget and no CI time target exists (PRF findings); state them or say none is wanted. Not a hold | G8 |

**Risks registered:** RISK-019 new. RISK-006 reviewed, score unchanged.
**Rationale:** The story's work is careful and most controls are real, but the rule that guards the product's main promise does not reach a single page the design defines, and nothing yet stops a merge past a red run. Both are confirmed by my own reads, and one fail-open gate and one latent gate sit with them. The loop is small and needs no human wait except the two settings, which take minutes and are needed before any code merge anyway.

---

## G6 – Peer Review — AQP-27 (STORY-10.01) — 2026-11-02 (attempt 2)

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2
- **Artefacts evaluated:** PR #16 at head 3a01fdc (commits c4c5eee, d3ba026, 96ab2a9, 41d5dab, 3a01fdc): re-reviews 5747098132 (standards), 5747104660 (performance), 5747127322 (quality); all 52 review threads (25 unresolved, all Minor or Info); PR body and Dev Record; check run "Stages 1 to 11" (run 41574395485, success). Jira AQP-27 10659 to 10664. Code at 3a01fdc: `eslint.config.mjs`, `scripts/lib/coverage-scope.ts`, `.github/workflows/ci.yml` stages 6 and 11, `scripts/check-changed-coverage.ts`, `tests/support/env-example.ts`, `src/lib/logger.ts`, `scripts/lib/data-files.ts`. Working copy, uncommitted: `test-strategy.md` v0.11 section 11, `architecture.md` v0.12, ADR-008 (diff read for the exclusions only). Repository settings through the API. **Not done:** stage 11 not run locally (no database), so integration coverage rests on CI and the developer's one-time probe; Gitleaks not run by me; `.env.example` not opened.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Re-reviews on 3a01fdc, new diff only (playbook 5.3); attempt 1 reports stand for the rest |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | QLT-01 fixed, QLT-04 closed; both checked by me (below) |
| 3 | Major fixed or explicitly accepted | | ✅ | QLT-02, 05, 06, 08 fixed and checked by me; none accepted |
| 4 | Findings cite file:line | | ✅ | QLT-18, 19, 20, STD-21 to 23, PRF-10 all inline |
| 5 | Reviewed head is green | | ✅ | Run 41574395485 on 3a01fdc; branch up to date with `master` |
| 6 | Open Minors | | ⚠️ | QLT-16 (`.sql`, `.yaml`), QLT-18, QLT-19 / STD-21: conditions 1 and 2 |
| 7 | Architect's documents in the repository | | ⚠️ | The ruling the code implements is in Jira 10660 and an uncommitted working copy: condition 3 |

**Attempt 1 findings, checked by me at 3a01fdc**

| ID | Result | What I ran or read |
|----|--------|--------------------|
| QLT-01 | Fixed | My attempt 1 probes repeated: a cost-repository import now fails at `(portal)/queue/page.tsx`, `(portal)/estimates/[code]/page.tsx` and `src/components/features/`, and so does `lib/formula` on the queue page and an `engineer-*.tsx` view. A service importing a cost repository and the health route importing a service stay clean |
| QLT-02 | Fixed | Literal `import()` fails for an Engineer view (repository, formula), a component (any repository), a service (Prisma) and `src/lib` (`next/headers`) |
| QLT-04, QLT-09 | Closed | Protection API: required check `Stages 1 to 11`, strict, `enforce_admins` true, 0 approvals, no code owners, force pushes and deletions off; rulesets none; `allow_rebase_merge` false, squash on. Merge commits stay allowed; that was optional |
| QLT-05 | Fixed, per the ruling | Stage 6's exact command, reports in my scratchpad: exit 0, 9 `SF:` entries, none under `src/server` or `src/instrumentation.ts`. Stage 11 command read in `ci.yml`; the changed-code step now runs there with `BASE_REF` |
| QLT-06 | Fixed | My attempt 1 input, zero hits with `./` paths: now exit 1 (was 100 %, exit 0). `--threshold abc`: exit 2 (was 0) |
| QLT-08 | Fixed (documentation) | README procedure per the fix list, as the quality reviewer confirms. No squash rehearsal was possible |

**Rulings**

1. **Architect's extra exclusions, `src/components/**` and `src/worker/main.ts`: accepted.** They match the ruling (10660) and test strategy v0.11 section 11 word for word. `src/server` is excluded nowhere, and a test asserts it. Reasons: no component test library exists, so those files could only ever show 0 % and push someone to weaken the gate; architecture 10 allows no logic in components, and the new presentation rule now enforces their imports; job logic stays in `src/server/jobs`, which is measured. The cost: logic placed in a component is caught only by review. So a non-trivial function in `src/components/**` is a review finding from AQP-28 onward (QLT-20).
2. **QLT-16 `.yaml`: deferred to #19.** Master data is unlikely to arrive as YAML, and the three tracked YAML files would need a path rule. **QLT-16 `.sql`: not deferred, fixed now** (condition 1). No `.sql` file is tracked yet, and the first migration story will add some, so the path rule is cheapest before then. A plain-text dump is the likeliest accidental route for a real table.
3. **STD-13 part 2: deferred to #20**, as Info. Both digests are equal today, and the comment added in d3ba026 tells a maintainer to change both.
4. **QLT-19 / STD-21, QLT-18 and the PRF-05 sentence: fixed now, not deferred.** It is the attempt 1 test: QLT-19 makes the `.env.example` control miss what its own header claims, and QLT-18 lets the changed-code gate measure fewer lines than were added, the QLT-06 class for one file. PRF-05 has been asked twice and is one sentence. STD-23 is taken too, because it touches the same lines as STD-04 and keeps a person's address out of a public log. STD-22 and PRF-10 need no action (PRF-10 is a trigger, noted in #20).
5. **No further re-review. I verify the follow-up commit myself** (condition 1), because each fix is small, test-backed and specified by its reviewer. The verification has stated limits: if the follow-up touches any file outside the list, or CI is not green, it goes back to the reviewers for the new diff.
6. **Labels:** the standards reviewer's brief removal and restoring of PR labels is disclosed and changed nothing; the three labels read approved.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #16, one follow-up commit | **QLT-19 / STD-21:** a value is a placeholder only if it starts with `CHANGE_ME`; a URL needs a `CHANGE_ME` password and host `localhost` or `127.0.0.1`; add the reviewers' real-host control rows; the sibling assertion at `env-example.test.ts:47` too. **QLT-18:** `globToRegExp` throws on syntax it does not support, with a test; the changed-code check prints a notice for each scoped changed file with no report entry, and does not fail on it. **QLT-16 `.sql`:** listed, allowed only at `prisma/migrations/*/migration.sql`, with planted tests either side. **PRF-05:** one sentence in `logger.ts`, no per-node or per-row logging at `info`. **STD-23:** `ADMIN_EMAIL` and `SMTP_USER` redacted, with test rows. Nothing else | Before G7 starts |
| 2 | master | Same commit | Verify: the diff touches only `tests/support/env-example.ts`, `scripts/lib/coverage-scope.ts`, `scripts/check-changed-coverage.ts` or `scripts/lib/changed-coverage.ts`, `scripts/lib/data-files.ts`, `src/lib/logger.ts`, `src/lib/env.ts` and their tests; CI green on the new head; baseline unchanged at 7; the named tests and my own planted inputs fail as they should. A comment on AQP-27 and the PR records the result. Outside that list, the reviewers re-review the new diff | Before G7 starts |
| 3 | orchestrator | Docs PR | Commit `architecture.md` v0.12, `test-strategy.md` v0.11 and the ADR-008 edit, and this record, through a docs PR, not PR #16; docs-auto applies | Before PR #16 is merged |
| 4 | orchestrator | `master` after the merge | Squash only. The first push run on `master` must be green (carried from attempt 1) | After the human merge |
| 5 | product-manager | PRD | Attempt 1 condition 8 stands: NFR-009 JS budget and a CI time target, or say none is wanted | G8 |

**Risks registered:** RISK-019 restated: mitigation applied (bypass disabled), score unchanged. BLK-04 cleared.
**Rationale:** Every mandatory item passes on evidence I re-ran myself, not on the reviewers' word, and AC-4 and AC-6 are now met where they matter. What remains is Minor and cheap, and two of the items are controls that miss what they claim. So they are fixed before QA, under a verification with stated limits, instead of becoming debt. No human wait is involved, and merging remains the delivery lead's act.

**Condition 2 verified — 2026-11-03 (master).** Commit 5390559, the PR #16 head; check run "Stages 1 to 11" success (run 41583743245). Developer hand-off: AQP-27 10666. **Result: met. Conditions 1 and 2 are closed, and the story may go to G7.**

| Check | Result | Evidence |
|-------|--------|----------|
| Diff within the named list | ✅ | `git diff --name-status 3a01fdc 5390559`: 11 files, all modified, none added: `scripts/check-changed-coverage.ts`, `scripts/lib/changed-coverage.ts`, `scripts/lib/coverage-scope.ts`, `scripts/lib/data-files.ts`, `src/lib/logger.ts`, `tests/support/env-example.ts` and five unit test files for them. `src/lib/env.ts` was not needed: STD-23 lives in `logger.ts`. Diff read in full; nothing beyond the five fixes |
| CI green | ✅ | Run 41583743245 on 5390559 |
| Baseline still exactly 7 | ✅ | `.gitleaks-baseline.json`, `.gitleaks.toml` and `.env.example` unchanged since 3a01fdc; 7 fingerprints |
| QLT-19 / STD-21 | ✅ | My planted inputs: a URL with an invented remote host and a placeholder password is flagged; a local URL with a non-placeholder password is flagged; a host with `CHANGE_ME` appended is flagged; an invented tenant ID is flagged; a local placeholder URL and a prefixed placeholder pass |
| QLT-18 | ✅ | `globToRegExp` throws on `?(…)`, `[ab]`, `(a\|b)` and `!(…)`, and accepts `{ts,tsx}`. `filesMissingFromReport` names a scoped `src/server` file with no report entry, and leaves out excluded, measured and non-code files |
| QLT-16 `.sql` | ✅ | `prisma/migrations/<one folder>/migration.sql` passes; a second file in a migration folder, a nested folder, a migration file at the top, a root dump and an upper-case `.SQL` elsewhere are all refused; `.yml` untouched (#19). The repository's own check passes |
| PRF-05 | ✅ | `logger.ts` line 13 carries the rule |
| STD-23 | ✅ | A logged object with `ADMIN_EMAIL` at top level and `SMTP_USER` and the two OAuth IDs nested prints `[Redacted]` for each and keeps an ordinary key |
| Local checks | ✅ | The six named test files 170 of 170; `npx eslint scripts src tests` and `npx tsc --noEmit` exit 0; working tree left clean |

**Not done:** stage 11 and Gitleaks not run by me (CI evidence); the planted inputs called the functions directly, not the CI scripts end to end. **Housekeeping, not a hold:** the PR body's CI line still names run 41574395485; the developer refreshes it to 41583743245.

---

## G7 – QA Acceptance — AQP-27 (STORY-10.01) — 2026-11-03

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** `docs/07-qa/AQP-27-test-report.md` at 2bbeaa7, read in full; `docs/07-qa/defects/DEF-001-…`, `DEF-002-…`; `tests/acceptance/aqp-27-scaffold.test.ts` and `aqp-27-database-roles.test.ts`, read in full (6ea8497); `src/instrumentation.ts`; `README.md`; test plan severity table and service levels; coding standards section 1. Jira AQP-27 10670. Check runs: 41588354487 on 2bbeaa7 (per the brief), 41588796386 on 6ea8497, success (read by me). **Not done:** I did not re-run the built-server start-up or a CRLF clone; I read QA's evidence and the code. The QA throwaway database is removed (brief).

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report AC matrix: 10 of 10 with test IDs, technique and evidence. AC-3's result changes under ruling 1, but it is verified, with evidence |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ❌ | DEF-001 (AQP-166, #21) is Sev-2 under ruling 1 |
| 3 | Regression recorded and green | ✱ | ✅ | 377 tests on 5390559 and 503 with QA's tests, 0 failed, 0 skipped; Playwright 3 of 3; lint, tsc, build exit 0; CI 41588796386 green on 6ea8497 |
| 4 | Exploratory testing notes present | | ✅ | Report "Exploratory Testing": charter, 8 areas in risk order, what was not covered |
| 5 | Accessibility checks for UI stories | | ✅ | Not a UI story: placeholder home page only; checks are due at 10.02 (DL-035) |
| 6 | No secret, real rate or workbook value added | | ✅ | Report non-functional table; QA's two test files hold invented values only (read by me) |
| 7 | Changes after G6 | | ✅ | 2bbeaa7 and 6ea8497 add QA files only (ruling 3) |

**Rulings**

1. **AC-3 "fails fast" means the process stops at start-up with a non-zero exit. So DEF-001 is Sev-2, and G7 cannot pass until it is fixed.** The project's own text decides the reading, not a dictionary. `src/instrumentation.ts` says a bad setting "stops the server here"; the README says "The app refuses to start"; coding standards section 1 says "fail fast and loudly at boundaries". Today none of these holds: the process stays up and every request gets 500. The test plan's severity table puts "an AC fails with a workaround" at Sev-2, and that is this case: the log names the variables, so an operator can find the cause. This is consistent with G6, where an AC met only in part was held as Critical (QLT-04). Proportion: it fails closed, so no data or price is at risk. But a process left running looks up to `docker compose ps` and to a restart policy, which is what 10.04 builds on, and the fix is a few lines. QA's reading, "fails at start-up, not at first use", is a fair reading of the AC sentence alone. It is not the reading the code and README promise.
2. **DEF-002 is fixed in the same loop, not deferred.** It is Sev-3, and the test plan lets Sev-3 wait until G8 with written acceptance. But the delivery lead works on Windows and would see a red suite on a fresh clone, the fix is one line in a test, and a loop is open anyway.
3. **QA's files added after G6 (2bbeaa7, 6ea8497) need no peer re-review.** They are QA's G7 artefacts, which this gate judges: two test files, two defect records and the report, with no production code, configuration or dependency changed. I read both test files in full. Every value is invented; temporary folders are removed; the database tests run behind the global guard, and both run green on CI 41588796386. Note: the AC-9 test asks the runtime role to drop the database and expects a refusal. That is correct as a negative control, and it can only do harm where the role is already wrongly privileged.
4. **Observations:** OBS-1 to #19; OBS-2, OBS-3 and OBS-5, plus the Office lock files seen untracked in this working tree, to #23; OBS-4 is G6 condition 4 (unticking "Allow merge commits" stays optional for the delivery lead); OBS-6 is #13; OBS-7 is QA's for 03.04. None holds G7.

**Fix, developer, one commit (DEF-001 and DEF-002 only)**

| Defect | File | Required |
|--------|------|----------|
| DEF-001 | `src/instrumentation.ts` | In the Node.js runtime, outside the build phase, when `loadAppEnv()` throws `EnvValidationError`: write its message, which holds names only and never a value, to stderr in one line, then `process.exit(1)`. Keep the build-phase and Edge early returns. Rethrow any other error unchanged. Update the doc comment only if wording changes |
| DEF-001 | `tests/unit/instrumentation.test.ts` | With `process.exit` and stderr stubbed: an invalid environment calls `exit(1)` once, the output names the variables, and a sentinel value placed in a variable is absent; both early returns still call neither |
| DEF-002 | `tests/unit/ci-workflow.test.ts` | Normalise `\r\n` to `\n` when the workflow file is read, or match `\r?\n`. No `.gitattributes` change: renormalising would touch most files in this PR |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #16 | The commit above, touching only those three files | G7 attempt 2 |
| 2 | master | Same commit | Verify, as at G6 condition 2: the file list, CI green, baseline still 7, and my own planted input (an invalid environment exits 1 with names and no value). Outside the list, the reviewers re-review the new diff | G7 attempt 2 |
| 3 | qa-engineer | AQP-166, AQP-167, #21, #22; test report | Record DEF-001 as Sev-2 under this ruling. Then re-run the DEF-001 steps on the built server (exit non-zero, names only) and a CRLF clone for DEF-002, close both, and update the report. Make the test plan updates the report owes | G7 attempt 2 |
| 4 | qa-engineer | Jira | Move AQP-27 to Rejected (`CLAUDE.md` section 4) | Now |
| 5 | orchestrator | Docs PR; `master` | G6 conditions 3 and 4 still stand: architect documents before the merge; squash only; first `master` run green | Before and after the human merge |

**Risks registered:** none new. RISK-006 unchanged: QA reports it reduced by these controls, not removed (OBS-1, OBS-3).
**Rationale:** QA's work is thorough: every AC was attacked, not just run. But the one gap it found is that the server does not do what its own README says, and the test plan grades that Sev-2. The fix is a few lines, with a test and a re-check by QA, so the cost of holding is one short loop with no human wait, and AC-3 then means what the repository claims.

**Condition 2 verified — 2026-11-03 (master).** Commit 60eeb67, the PR #16 head; check run "Stages 1 to 11" success (run 41591216308). Developer hand-off: AQP-27 10673. **Result: met.** G7 attempt 2 waits only for QA's re-test (condition 3).

| Check | Result | Evidence |
|-------|--------|----------|
| Only the three named files | ✅ | Commit read through the GitHub API, in full: `src/instrumentation.ts`, `tests/unit/instrumentation.test.ts`, `tests/unit/ci-workflow.test.ts`. The `process.env.NEXT_RUNTIME` dot access is in the named file and only changes how Next.js strips the Edge bundle; the runtime test still behaves as before (rows 4 and 5 below) |
| CI green | ✅ | Run 41591216308 on 60eeb67 |
| Baseline still 7 | ✅ | The baseline is not in the commit; 7 fingerprints at the local head (60eeb67) |
| Invalid environment exits 1, names only | ✅ | My own run, `register()` in a real child process with a clean environment: exit 1; one stderr line naming `AUTH_SECRET (invalid)`, `APP_ORIGIN (missing)` and `SMTP_AUTH_MODE (missing)`; my planted value, placed in two settings, printed 0 times; nothing after the exit ran |
| Skips and the valid case | ✅ | Same probe: build phase and Edge return with exit 0 and no output; a complete invented environment returns with exit 0 and no output |
| Other errors re-thrown | ✅ | Read in the code; the unit test covers it |
| DEF-002 | ✅ | The test now turns CRLF into LF on read; `.gitattributes` unchanged |
| Local checks | ✅ | The two test files 15 of 15; eslint exit 0 on the three files |

**Not done by me:** the built standalone server (the developer reports exit 1; QA re-tests it under condition 3) and a CRLF clone (QA). The developer's report of one load-related timeout in `layer-rules.test.ts` is noted; it passed in CI and on re-run, and a longer timeout can join #23.

**For the orchestrator, outside this PR:** `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` is modified in the working tree by someone other than the developer (28 lines added at lines 6, 86, 121 and 584). It does not touch line 35, the accepted baseline line. It belongs in a docs PR, never PR #16, and stage 2 scans it there.

---

## G7 – QA Acceptance — AQP-27 (STORY-10.01) — 2026-11-03 (attempt 2)

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. Merging PR #16 stays the delivery lead's act
- **Attempt:** 2
- **Artefacts evaluated:** PR #16 at f1bb796 (head); QA comment AQP-27 10687; commits 5ba52c2 (report and DEF-001, DEF-002 records) and f1bb796 (DEF-003 record), both read through the GitHub API and both under `docs/07-qa/` only; the DEF-003 record in full; my condition 2 verification of 60eeb67 (above). Check runs read by me: 41591216308 on 60eeb67, 41593748430 on 5ba52c2 (per QA), and 41594298884 on f1bb796, all success. **Not done:** I did not re-run QA's built-server or CRLF-clone checks; the product code is unchanged since my verification of 60eeb67.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | 10 of 10 (attempt 1 matrix). AC-3 now also passes on the strict reading: QA's built server exits 1 with names only, and my child-process run agrees |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | DEF-001 (Sev-2) fixed in 60eeb67, re-tested by QA, AQP-166 Done, #21 closed. DEF-002 fixed, AQP-167 Done, #22 closed |
| 3 | Regression recorded and green | ✱ | ✅ | 506 of 506 twice on an idle machine; Playwright 3 of 3; changed-code 100 %; Gitleaks 98 commits, baseline 7; CI green on f1bb796 with no retry. DEF-003, ruling 1 |
| 4 | Exploratory notes | | ✅ | Attempt 1 report section; re-test notes in the updated report |
| 5 | Accessibility | | ✅ | Not a UI story (attempt 1) |
| 6 | Open Sev-3 | | ⚠️ | DEF-003 (AQP-168, #24): condition 1 |

**Rulings**

1. **DEF-003 does not count against G7.** The authoritative regression run is CI, where the suite is green with retries off, and it is also green twice locally on an idle machine. The failure is a 30-second budget that includes loading the ESLint configuration on a busy machine, not an assertion about a layer rule; the file passes alone. "Green only when idle" is enough for G7 because the failure tells nothing about the product, and QA's own acceptance lint cases, with a longer budget, did not fail under the same load. It is still a real defect, so it is fixed before G8: warm ESLint in a `beforeAll` with its own hook timeout, as the record suggests. It is not fixed now, because a further commit would reopen verification for no product gain. Under the flaky-test policy (test strategy 10) it is not quarantined, since it does not fail on CI.
2. **QA's commits after attempt 1 need no review.** They are QA's own G7 records, all under `docs/07-qa/`, and CI is green on each head.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer; qa-engineer verifies | `tests/unit/lint/layer-rules.test.ts` (#24, AQP-168) | Warm the ESLint instance in a `beforeAll` with its own hook timeout. Do not raise the per-test limit only, and do not quarantine | Before G8 |
| 2 | orchestrator | Docs PR | G6 condition 3: commit the architect's documents, these governance records and the other roles' uncommitted docs through a docs PR, merged before PR #16. Stage files by name: not the Office lock files `~$…`, and not PR #16's files | Before PR #16 is merged |
| 3 | Santhosh (merge); orchestrator checks | PR #16; `master` | G6 condition 4: squash merge only; the first push run on `master` after the merge must be green, and the orchestrator reports it | At and after the human merge |
| 4 | qa-engineer | Jira AQP-27 | Move the story to Done on this decision (`CLAUDE.md` section 4). The merge is separate and human | Now |
| 5 | orchestrator | Chat | DL-049: at the next contact, ask one open question with no reading offered: did the plating message continue, and who adds the plating calculation, and where | Next contact; not a hold |

**Risks registered:** none new. RISK-006 unchanged; review at G8.
**Rationale:** Both blocking items from attempt 1 are fixed, verified by me and re-tested by QA on the built server and a CRLF clone. Every mandatory item passes. What remains is one load-sensitive test with an owner and a G8 due date, and the merge steps, which are the delivery lead's.


---

## G6 – Peer Review — AQP-97 (STORY-03.01) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #32 at head f7d8cb7 (base b66c684): the three reviews (5749080444 standards, 5749059748 quality, 5749040114 performance), all 29 review threads, the quality addendum and the solution-architect's rulings (PR comments 6598858452 and 6598912712; Jira 10695, 10699), the PR body and Dev Record; Jira AQP-97, all 11 comments. Check run "Stages 1 to 11" success (run 41601423738). Code read at f7d8cb7 through `git show`, without switching branches: `src/server/repositories/prisma-client.ts`, `src/server/services/config-service.ts`, `src/lib/fields/field-schema.ts` header, and the size and header of `prisma/seed/config/seed-config.ts`. **Not done:** no test run of my own (the working folder holds another story's branch); I read the code behind each Major and rely on CI and the reviewers' runs for the rest.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All three on f7d8cb7; counts recomputed from the threads: STD 1 Major, 8 Minor, 5 Info; QLT 1 Major, 6 Minor, 4 Info (QLT-02 lowered to Info by the reviewer's addendum after ruling R1); PRF 2 Major, 2 Minor, 1 Info |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | None raised. The quality review's AC table: 7 of 7 met |
| 3 | Major fixed or explicitly accepted | | ⚠️ | Four open and upheld (below); none accepted. Conditions 1 and 3 |
| 4 | Findings cite file:line | | ✅ | All inline |
| 5 | Reviewed head green | | ✅ | Run 41601423738 |

**Major findings, checked by me in the code**

| ID | Ruling | Evidence |
|----|--------|----------|
| STD-01 | Upheld | `seed-config.ts` is 428 lines with no inline justification; coding standards 1 allows an exception only when justified inline |
| QLT-01 | Upheld | `field-schema.ts` lines 8 to 10: every schema is strict and "optional values are `null`, never absent"; `getCurrentVersion` re-parses the stored snapshot on every read. A property added later the way the header says would make every stored version unreadable, and stored versions can never be changed. It must be settled before any version is stored on a real install, which is now |
| PRF-01 | Upheld; the trigger of #18 is met | `createPrismaClient` passes only a connection string, so pg defaults apply: no connect timeout, no statement timeout, the same pool size everywhere |
| PRF-02 | Upheld | `getCurrentVersion` reads the snapshot and runs `parseConfigDocument` on every call, with no cache; architecture 4.2 assumes a cache by version id |

**Rulings**

1. **CONDITIONAL GO, not NO-GO, and G7 waits.** Every mandatory item passes, so the procedure gives CONDITIONAL GO; AQP-27 attempt 1 was NO-GO only because it had Criticals. But the Major fixes add production code (pool settings, a cache, a schema rule) and integration tests, so they are re-reviewed, not only verified by me. The story goes back to Changes Requested and does not enter QA until conditions 1 to 4 are met.
2. **The solution-architect's rulings are accepted as the fix specification:** R2 `multiline` (optional, absent means false, only on text inputs); R4 pool and timeouts as fixed constants per kind, 503 `DATABASE_BUSY` on timeout, two integration tests, the singleton with the first app caller; R5 cache by version id, 16 entries, deep-frozen, latest id checked on every call. R1 (`config_checkpoints` to STORY-08.06; the `created_by` key added by whichever of AQP-97 and AQP-38 merges second) and the seed-content confirmations are accepted. QLT-02's carried test ("v1 exists, no checkpoint → exactly one after the migration") goes into 08.06 when the scrum-master writes it.
3. **QLT-01 is closed together with R2.** `multiline` is added as `.optional()`. The header becomes the rule: a property added after version 1 must parse when absent, because stored versions are immutable. A guard test pins the set of required keys, so adding a required key fails it.
4. **#18 is satisfied in this PR** by R4, apart from the `globalThis` singleton, which comes with the first app or worker caller (expected AQP-38). #18 closes when PR #32 merges.
5. **No `updated_at` on `config_versions` is accepted as a standing rule** (DL-052, STD-10). Reviewers do not raise it on immutable or append-only tables.
6. **Minor split, on the AQP-27 test** (the finding is in a file the Majors touch; it makes a control fail open or claim more than it shows; it is a cheap security point; or a document is wrong today). **Now:** PRF-04 (field and letter maps built once per cached version, R5), QLT-03 (force the overlap in the concurrency test), QLT-07 (deep-freeze `seedConfig`), QLT-08, STD-02, STD-03, STD-04 (a throwing default), STD-06 (`assertNever` names the description only, value as `cause`), STD-07, STD-08, STD-09, and Info STD-11 (one doc line, same file as PRF-02). **Closed by another fix:** PRF-03 (by R4). **Deferred:** QLT-04 and QLT-06 to #34; QLT-05 and STD-05 to #35, with #31. Info items need no action; STD-13 (no formatter) is a project-level suggestion the orchestrator can raise with the product-manager.
7. **QLT-09 reading accepted:** AC-2's "each with … `defaultValue`" is met by inputs carrying it, since outputs cannot hold a default under the discriminated union. QA reads AC-2 the same way.
8. **OQ-ARCH-13** (may the business-analyst read only column widths and number formats from the sample workbook?) is the delivery lead's. The orchestrator asks it before story 07.01 enters a sprint, and before the first production install in any case. It does not hold this story.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #32 | STD-01 (move sections and stages to their own module, or justify inline); QLT-01 with R2 (ruling 3); PRF-01 per R4; PRF-02 per R5; and the Minors marked "now" in ruling 6. Reply in each thread; update the Dev Record. Nothing else | Before G7 |
| 2 | reviewer-standards, reviewer-quality; reviewer-performance for R4, R5 and PRF-04 only | PR #32 | Re-review the new diff only (playbook 5.3); each reviewer changes only their own label | Before G7 |
| 3 | master | Gate log | Record that conditions 1 and 2 are met: no new Blocker or Critical, and the four Majors fixed. A new Critical reopens G6 | Before G7 |
| 4 | orchestrator | Jira AQP-97 | Move the story to Changes Requested now; In QA only after condition 3 | Now |
| 5 | orchestrator | Docs PR | Architecture v0.14 (13 edits), the R1 text correction, and these governance records | Before PR #32 is merged |
| 6 | orchestrator | Chat | OQ-ARCH-13 to the delivery lead, worded without a preferred answer | Before 07.01 enters a sprint |

**Risks registered:** none new. ARCH-R2 (Engineer leak through document data) is carried by #34 until the first edit path exists.
**Rationale:** The work meets all seven ACs, and its immutability and column logic are tested well. The four Majors are real: two are performance contracts the architecture assumed and #18 was waiting for, one is a size rule, and one would make the first stored version unreadable after an ordinary later change. That last one costs almost nothing now and cannot be fixed once a real install holds version 1, so the fixes go in before QA.

---

## G6 – Peer Review — AQP-28 (STORY-10.02) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. Browser testing in CI stays on, as the delivery lead confirmed in chat on 2026-11-03 (relayed by the orchestrator)
- **Attempt:** 1
- **Artefacts evaluated:** PR #33 at head 6f66b97 (base b66c684): the three reviews (5749252523 standards, 5749332280 performance, 5749351525 quality), all 32 review threads, the PR file list; Jira AQP-28 10702 to 10708, including the solution-architect's rulings (10705). Check run "Stages 1 to 11" success (run 41603405672), stage 12 included. Code read at 6f66b97 with `git show`: `src/lib/cn.ts`, `src/components/ui/button.tsx`, the README CI section, the `ci.yml` stage 12 step, `playwright.config.ts`. **Not done:** no test or browser run of my own; QLT-01 rests on the code and the reviewer's browser check, PRF-01 on the reviewer's measurements.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All on 6f66b97: STD 2 Major, 11 Minor, 4 Info; QLT 1 Major, 8 Minor, 4 Info; PRF 1 Major, 4 Minor, 4 Info |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | None. ACs 1 to 8 and 10 met; AC-9 is QA's at G7 |
| 3 | Major fixed or explicitly accepted | | ⚠️ | STD-01 closed by approval; STD-02 and QLT-01 to fix; PRF-01 accepted (ruling 2) |
| 4 | Findings cite file:line | | ✅ | All inline |
| 5 | Reviewed head green, stage 12 on | | ✅ | Run 41603405672 |

**Majors**

| ID | Ruling | Evidence |
|----|--------|----------|
| STD-01 | Closed by the architect's approval (10705 item 1); no code change | `@axe-core/playwright` 4.14.0, dev only. The architecture section 11 text goes in the docs PR |
| STD-02 | Upheld; fix | README "Continuous integration" still says stages 1 to 11 run and 12 is disabled; stage 12 now runs and blocks merge |
| QLT-01 | Upheld; fix with the architect's item 2 | `cn.ts` only joins names and "does not resolve two conflicting utilities", so the base `border-transparent` can beat the secondary variant's border; the reviewer confirmed it in the browser |
| PRF-01 | **Explicitly accepted for this story** (ruling 2) | No JS budget exists in NFR-009 to fail. The shell is the common cost every page carries |

**Rulings**

1. **CONDITIONAL GO, and QA waits for a re-review of the new diff.** No mandatory item fails. The fix round replaces the button and component variants with `cva` and a configured `tailwind-merge` across `src/components/ui`, and adds three dependencies. That is production code, so it is re-reviewed (DL-051). The story goes back to Changes Requested.
2. **PRF-01 accepted, and the budget is the product-manager's to set,** with the solution-architect for the check. It does not hold this story: the measurable NFR-009 targets apply to the five key screens, none of which exists, and no budget number exists to fail. The reviewer's shell-only figures (LCP about 2.7 s, TBT 0.4 to 0.5 s under Slow 4G and 4x CPU) are not a Lighthouse score on reference hardware, but they say the targets are at risk, so RISK-020 is registered. The budget and the check are due before the first of those screens reaches G6 (#36). That brings forward AQP-27 G6 condition 8, which was due at G8. QA records a Lighthouse mobile run of `/` on the production build in the G7 evidence as a baseline, not as pass or fail.
3. **#17 is split.** Trigger met, as with #18 at AQP-97 (DL-051). CI caching (`.next/cache`, Playwright browsers) is done in this PR. E2E against the production build is re-deferred to the first story with a production page: `/design-system`, the only page here, is hidden in every production build by the architect's ruling, so there would be nothing to test. The database URL item is re-deferred to the first story whose E2E page reads the database. Both are expected at AQP-38 (comment on #17).
4. **Architect rulings accepted:** `@axe-core/playwright`; `class-variance-authority` 0.7.1, `clsx` 2.1.1 and `tailwind-merge` 3.7.0, with `cva` variants, `cn` on `extendTailwindMerge` (registering the theme's text sizes and spacing, with unit tests) and `components.json`, all in this PR; the route under `(portal)`; hidden whenever `NODE_ENV=production`. The product-owner rewords AC-7's first sentence to "any non-production build (local, CI)".
5. **Minor split, on the AQP-27 test.** This story sets the patterns every page story copies, so shared-pattern Minors are cheaper now than after 30 pages. **Now:** STD-03 to STD-13, Info STD-16 (one README sentence, in the same file as STD-02), QLT-02 to QLT-09, and PRF-02 (cache header for the logo). **Deferred:** PRF-03 and PRF-04, with Info PRF-08 and PRF-09, to #36; STD-17 to #37 (security headers have no story). **Notes:** STD-15, removing `PREVIEW_USER`, goes to the scrum-master for AQP-38 (01.01). STD-14 (no formatter) stays with the orchestrator for the product-manager, as at AQP-97. PRF-06 and PRF-07 need no action. A Minor that proves more than cheap is listed in the Dev Record for me to defer.
6. **The AQP-27 acceptance-test edit is accepted** (QLT-12): it switches the stage 12 assertion from off to on, which is what this story's AC-8 does, and stage 13 is still asserted off.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #33 | STD-02; QLT-01 with ruling 4 (and a computed-border E2E check); #17 caching; the Minors marked "now" in ruling 5. Reply in each thread; update the Dev Record | Before G7 |
| 2 | reviewer-standards, reviewer-quality; reviewer-performance for the CI caching and PRF-02 only | PR #33 | Re-review the new diff only; each reviewer changes only their own label | Before G7 |
| 3 | master | Gate log | Record that conditions 1 and 2 are met: no new Blocker or Critical, and the Majors fixed | Before G7 |
| 4 | orchestrator | Jira AQP-28 | Changes Requested now; In QA after condition 3 | Now |
| 5 | product-owner | AQP-28 AC-7 | Reword the first sentence per ruling 4 | Before G7 |
| 6 | qa-engineer | G7 evidence | A Lighthouse mobile run of `/` on the production build, recorded as a baseline (ruling 2); AC-9 checks as planned | G7 |
| 7 | product-manager; solution-architect | #36 | The NFR-009 budget, or a statement that none is wanted, and the check in test strategy 10 | Before the first NFR-009 screen reaches G6 |
| 8 | orchestrator | Docs PR | Architecture v0.14 items 14 to 18, including section 11 for the four packages | Before PR #33 is merged |

**Risks registered:** RISK-020 (NFR-009 targets at risk on phones), new.
**Rationale:** The shell is careful work and every AC in scope is met, but the secondary button is visibly wrong and is fixed by the approved component pattern, which is new code and gets a re-review. The JS budget gap is real and is not this story's to close. It goes to the role that owns NFR-009, with a date before the screens it governs, and the measured risk is registered so it is not lost.

---

## G6 – Peer Review — AQP-97 (STORY-03.01) — 2026-11-03: conditions 1 to 3 (re-review)

**Recorded by master.** Re-review of PR #32 at e8e6858 (diff f7d8cb7..e8e6858). Check run "Stages 1 to 11" success (run 41609909530). Reviews 5749718669 (performance), 5749726222 (quality) and 5749760792 (standards), all APPROVE WITH COMMENTS; Jira AQP-97 10717 to 10719. **Result: conditions 1 and 2 are met: no Blocker, Critical or Major is open, and no new Critical appeared. G6 does not reopen.** One small follow-up commit comes before G7 (below).

| Check | Result | Evidence |
|-------|--------|----------|
| Four Majors fixed | ✅ | Re-reviews, and my own read at e8e6858: `seed-config.ts` 379 lines, with sections and stages moved out (STD-01); the evolution rule in the `field-schema.ts` header, `multiline` optional, and the required keys pinned by `schema-evolution.test.ts` (QLT-01); constants per kind exactly as ruling R4 sets them (PRF-01); a cache by id with `findLatestRef` and deep-freeze, 16 entries (PRF-02) |
| Minors taken at attempt 1 | ✅ | All fixed per the re-reviews; STD-05 stays deferred (#35) |
| New findings | Minor 5, Info 4 | QLT-12 and STD-16 (one fix); QLT-13; STD-15; STD-17; Info QLT-14, STD-18, STD-19, PRF-06 |
| Labels | ✅ | Three approved labels, each reviewer's own |

**Rulings on the new findings**
1. **Fixed now, in one commit, and verified by me, as at AQP-27 condition 2** (small, test-specified): **QLT-12 and STD-16** (`deepFreeze` also descends into a parent that is already frozen; the cached `createdAt` is no longer a mutable `Date`, for example a frozen copy or an ISO string, with a test that a cached version cannot be changed); **STD-15** (the production signatures `createPrismaClient` and `poolConfigFor` take no overrides; tests reach a separate test-only factory, or overrides are limited so they can only lower a limit, with a test); **STD-17** (the spacing slip). Their own control or claim ("deep-frozen", "fixed constants") is otherwise not true, and each is a few lines. Nothing else goes in the commit.
2. **QLT-13 is deferred to #38**, with Info STD-19. PR #32's production code opens no interactive transaction (only `database-timeouts.test.ts` does), and no route exists. The P2028 mapping and `cause` handling belong to `withRoute` (01.02); the transaction values belong to the first story with an interactive transaction in production code.
3. **Info notes:** STD-18 (`DeepReadonly` at boundaries) to #35, for 03.02. PRF-06 (shared in-flight load) to #34. QLT-14 needs no action. For the scrum-master and story 10.04: the `migrate` one-shot must wait on the database health check (performance note).
4. **AQP-97 may go to G7 once I have verified that commit** (file list, CI green, baseline 7, planted inputs). The orchestrator moves the story to In QA after my verification comment, not before.

**AQP-97 G6, follow-up commit verified — 2026-11-03 (master).** Commit 5f197ae, the PR #32 head; check run "Stages 1 to 11" success (run 41622866181). Developer hand-off: AQP-97 10730. **Result: met. AQP-97 may go to G7.** Verified read-only in the story's own worktree, without switching any branch.

| Check | Result | Evidence |
|-------|--------|----------|
| Only the named fixes | ✅ | 9 files, diff read in full: `deep-freeze.ts` (QLT-12), `config-service.ts` (STD-16, `createdAt` as ISO text), `prisma-client.ts` (STD-15, no overrides in either production signature), `formula-references.ts:52` (STD-17), the new test-only `tests/support/test-prisma-client.ts`, and four test files. No production call passes a third argument |
| `database-timeouts.test.ts` | ✅ within the check | It had to change, because it used the override STD-15 removed. The wider timings (1 s limit, 3 s hold, a warm-up query, 60 s hooks) still discriminate: a pool that waited for the holder would take about 2.7 s and fail the 2.5 s bound, so the test cannot pass wrongly. Test-only; no production code beyond the list |
| CI green | ✅ | Run 41622866181 on 5f197ae |
| Baseline still 7 | ✅ | Not in the commit; 7 fingerprints at the head |
| My own run | ✅ | `seed-frozen`, `config-service` and `prisma-pool-settings` tests 26 of 26 (a shallow-frozen parent's children frozen; a cycle ends; `createdAt` cannot be changed through the cache; an extra argument to `poolConfigFor` leaves `statement_timeout` at 10,000 and `max` at 10); eslint on the 9 files and `tsc --noEmit` exit 0 |

**Not done:** integration tests not run by me (CI evidence). One shell call was denied and not retried; the baseline was counted with a file search instead.

**AQP-28 G6, condition 6 amended — 2026-11-03 (master).** The Lighthouse baseline of `/` moves from AQP-28's G7 to AQP-169's G7 (STORY-10.10 AC-9). No reference-hardware run exists until 10.10 builds it, and a local run would not be comparable, which is what DL-053 asked the baseline for. AQP-28's G7 keeps its AC-9 checks and no longer owes a Lighthouse figure. RISK-020's "falls to 6" trigger is the AQP-169 G7 run (DL-058).

---

## G6 – Peer Review — AQP-28 (STORY-10.02) — 2026-11-03: conditions 1 to 3 (re-review)

**Recorded by master.** Re-review of PR #33 at f4739bc (diff 6f66b97..f4739bc). The first run of "Stages 1 to 11" on f4739bc (run 41624033120) was green, including stage 12 (61 passed, 11 skipped by layout), the new caches and the stage 9 production-route check. A second attempt was requested only to measure the warm-cache saving. Reviews: 5751259008 standards (APPROVE WITH COMMENTS), 5751322281 performance (APPROVE), 5751362012 quality (APPROVE); Jira AQP-28 10735 to 10737. **Result: conditions 1 and 2 are met; no Blocker, Critical or Major is open, and no new Critical appeared. G6 does not reopen.** One small commit comes before G7 (ruling 1).

| Check | Result | Evidence |
|-------|--------|----------|
| Majors fixed | ✅ | QLT-01: reviewer-quality checked it in the browser at three widths, and an E2E test compares the border with the token. My own read at f4739bc: `cn` is `clsx` plus `extendTailwindMerge`, with the theme's text sizes and spacing registered. STD-02: README now says stages 1 to 12 |
| Minors taken at attempt 1 | ✅ | STD-03 to STD-13, STD-16, QLT-02 to QLT-09 (QLT-10 too), PRF-02 and #17 caching fixed. STD-14 rebuttal accepted (a formatter is a new dependency) |
| Additions beyond the list | ✅ accepted | `scripts/check-production-routes.ts` (stage 9 requires `/design-system` to be 404) strengthens STD-05; `workers: 2` for slow machines. Standards raised no finding on either |
| G6 condition 5 | ✅ | AC-7 reworded by the product-owner (10727) |
| New findings | Minor 2, Info 10 | STD-18, STD-19; Info STD-20 to 24, QLT-14, QLT-15, PRF-10 to 12 |

**Rulings**
1. **STD-18 and STD-19 are fixed now, in one commit, and I verify it myself** (DL-047, DL-054). STD-18: extract two hooks so `AppShell` is within 40 lines. STD-19: split `design-system.spec.ts` by concern, each file within 400 lines. They are the same size rule held at AQP-97 (STD-01, STD-02), in the files every page story will copy, and both are mechanical and behaviour-preserving. **My check:** the diff touches only `app-shell.tsx`, new hook files under `src/components/shared/`, and the E2E spec files; CI is green including stage 12, with the same count of E2E tests run and skipped (61 and 11) unless a difference is explained; lint and type-check are clean; both line counts are within the limits. Anything else goes back to the reviewers.
2. **Interim JS budget rule (PRF-12):** `/` is 193,907 bytes gzip, about 6.1 KB (3 %) under 200,000, and nothing enforces it until AQP-169 lands. Until then, reviewer-performance measures first-load JS of every changed route at the G6 of any story that adds client JavaScript, against 200,000 bytes per route, and a route over it is a Major. RISK-020 is restated.
3. **Info needs no action:** STD-20 to 24, QLT-14 and QLT-15 (forward-looking, for later form flows); PRF-10 and PRF-11. The Playwright cache stays only if the warm re-run shows a saving of 5 s or more; the orchestrator reports the figure, and if it is under 5 s the cache comes out with the next CI change.
4. **AQP-28 goes to G7 after my verification comment.** The G7 evidence: AC-9 by QA on a real phone, a screen reader and Windows high contrast, with the delivery lead sitting with the testers (10573, 10574; DL-035); device, OS, browser and versions recorded (test plan section 12). The Lighthouse baseline is not owed here (amended condition 6, DL-058). Condition 8 (the docs PR before the merge) still stands.

**AQP-28 G6, STD-18/19 commit verified — 2026-11-03 (master).** Commit f903d48, the PR #33 head; check run "Stages 1 to 11" success (run 41629593078). Developer hand-off: AQP-28 10741. **Result: met. AQP-28 may go to G7.** Verified in the main folder, which is on this branch, with no branch switch.

| Check | Result | Evidence |
|-------|--------|----------|
| Only the named files | ✅ | 6 files: `app-shell.tsx`, two new hooks in `src/components/shared/`, `design-system.spec.ts`, new `shell.spec.ts`, and new `tests/e2e/support/design-system.ts` |
| `tests/e2e/support/design-system.ts` | ✅ within the check | Test-only. It holds the helpers the two spec files now share, which the STD-19 split made necessary, the same reasoning as `database-timeouts.test.ts` at AQP-97 (DL-057) |
| Behaviour preserved | ✅ | Diff read: markup and classes unchanged. The drawer-close and focus-after-navigation effects moved to hooks; the QLT-02 race fix (flag cleared in `onCloseAutoFocus`) is identical. Skip link, menu button and drawer are now small components in the same file |
| Limits met | ✅ | `AppShell` 29 lines; specs 177 and 208 lines; support 76 |
| E2E counts | ✅ | CI log: 61 passed, 11 skipped, as before; 27 test definitions before and after |
| CI, lint, types | ✅ | Run 41629593078 green; eslint on the 6 files and `tsc --noEmit` exit 0 |

**Not done:** E2E not run locally (CI evidence).

**Cache measurement (DL-059 ruling 3).** Run 41624033120, attempt 1 (cold) against attempt 2 (warm), step by step. Next.js build cache: stage 9 went from 14 s to 7 s with a 1 s restore, so it stays. Playwright browser cache: stage 12 went from 70 s to 65 s with a 2 s restore, a net 3 s, plus 5 s to save it on a miss. That is under the 5 s bar, so it comes out with the next CI change; no commit is needed in PR #33. The run totals (3 m 52 s against 3 m 06 s) are mostly npm install (75 s against 49 s), which these caches do not drive. The orchestrator's "caches stay" (PR comment 6602693103) is corrected for the Playwright cache only.

---

## G7 – QA Acceptance — AQP-97 (STORY-03.01) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. Merging PR #32 is the delivery lead's act
- **Attempt:** 1
- **Artefacts evaluated:** `docs/07-qa/AQP-97-test-report.md` at da654ce (sections read: AC matrix, pool and timeouts, mutation checks, non-functional, exploratory, defects, observations); QA commit da654ce file list (report and three files under `tests/acceptance/`); Jira AQP-97 10743; PR comment 6603217717. Check run "Stages 1 to 11" success on da654ce (run 41631686706), read by me. **Not done:** I did not re-run QA's tests.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | 7 of 7, with test IDs, techniques and evidence; eight deliberate faults each caught (mutation checks) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | None. Open: DEF-003 (Sev-3, #24), the known load-sensitive test class |
| 3 | Regression recorded and green | ✱ | ✅ | CI green on da654ce with the 203 new tests. Locally 1,070 of 1,071; the one failure is DEF-003's layer-rules first case, and CI is the reference run (DL-050) |
| 4 | Exploratory notes | | ✅ | Four charters with findings |
| 5 | Accessibility | | ✅ | Not a UI story |
| 6 | No real data | | ✅ | Structure-only assertions; data-file and secret checks pass. QA's workbook scan was count-only and the report prints no value, the same kind of check as mine at G3 (RISK-006) |

**Rulings**
1. **QA's files after G6 need no peer review,** as at AQP-27 (DL-050). da654ce adds the report and three test files under `tests/acceptance/`, changes no production code, and CI is green on it. The two tests that wait for the real 10 s and 5 s limits (about 35 s, OBS-8) stay: they are the only proof with production values, and the suite is well inside the 10-minute target (DL-055).
2. **Observations routed:** OBS-3 (the Fasteners rule is case and space sensitive) to #40, product-owner and ux-expert before the first EPIC-05 form story with S, T and U reaches Ready. OBS-1, OBS-2 and OBS-7 (Sev-4) to #41. OBS-5 (no CHECK on `number` or `reason`) to #34. OBS-6 (idle-in-transaction kill not mapped) to #38. OBS-8: no action.
3. **OBS-4 is fixed before the merge.** The README says `config_versions` cannot be changed "even by the owner", but the owner can disable the trigger with DDL, as the migration's own comment says. It is a security claim that is false today, and it costs one sentence. A docs-only commit needs no QA re-test; I verify it.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | `README.md` (PR #32) | OBS-4: say the trigger refuses UPDATE, DELETE and TRUNCATE for every role, and that the owner role can still remove it with DDL, so the owner credentials are kept to the migrate step. Nothing else in the commit | Before the human merge |
| 2 | master | Same commit | Verify: README only, CI green | Before the human merge |
| 3 | qa-engineer | Jira AQP-97 | Move to Done on this decision | Now |
| 4 | orchestrator | Docs PR | G6 condition 5 stands: architecture v0.14 and the governance records merge before PR #32 | Before the human merge |
| 5 | developer; qa-engineer | #24 (DEF-003) | As DL-057: before sprint 1 ends | Before sprint 1 ends |

**Risks registered:** none new.
**Rationale:** QA attacked every acceptance criterion and the immutability guard from both roles, and each deliberate fault was caught. Nothing open touches a price or a role. The README sentence matters because it states a security property, so it is corrected before the code reaches `master`.

**AQP-97 G7, condition 2 verified — 2026-11-03 (master).** Commit eede13f on PR #32 (CI run 41633028254 green); developer hand-off AQP-97 10745. **Result: met.** Then PR #32 was brought up to date with `master` f0d5a16 (docs PR #42) by merge commit d564175.

| Check | Result | Evidence |
|-------|--------|----------|
| README only | ✅ | `git show --stat eede13f`: `README.md` only, 4 lines in, 2 out |
| Wording correct | ✅ | It now says the runtime role has no UPDATE or DELETE grant, that the trigger refuses update, delete and truncate for every role, the owner's included, and that the owner can still disable the trigger with DDL, so protection against the owner depends on reviewed migrations. This matches the migration's own comment and OBS-4 |
| CI | ✅ | Run 41633028254 on eede13f |
| Merge from `master` | ✅ | `compare eede13f...d564175`: only the files of docs PR #42 (the SPEC and `docs/`), with no change of the developer's own. The PR's diff against `master` still contains no `docs/` file outside `docs/07-qa/` |
| CI on d564175 | ✅ | Run 41633378091 success; GitHub reports the merge state CLEAN |

**PR #32 is ready for the delivery lead's squash merge.** G6 condition 5 (docs PR first) is met by #42. After the merge, the orchestrator checks that the first push run on `master` is green, and closes #18 noting that the singleton moved to AQP-38.

**AQP-28 G7, interim rulings before the AC-9 results — 2026-11-03 (master). G7 is not decided here.** QA's interim result: AQP-28 10749; report `docs/07-qa/AQP-28-test-report.md` at 90b1dd4 (CI 41638736886 green). AC-1 to AC-8 and AC-10 are verified; AC-9 is pending with the delivery lead.

1. **Windows Narrator is accepted** as the Windows screen reader for AC-9, which says "NVDA or equivalent on Windows". Narrator is Windows' own screen reader and covers what this page asks: landmarks, headings, button names, the drawer's focus trap and Escape. The report names it with its version and the browser. The test plan's NVDA assumption (rows 143 and 497) becomes "NVDA or Narrator, named in the report"; QA updates it. NVDA is used later only if it is on the machine; it is not required.
2. **The phone screen reader is not optional.** AC-9 names it ("VoiceOver or TalkBack on the phone"), and so does the test plan (row 497). It is built into the phone already being used, so it costs time, not equipment. Phones are the Engineers' main device (DL-055), and the drawer is the shell's phone-only part. Only the platform not available stays listed at G8 as not run (QA-OQ-04: one phone, so iPhone or Android, whichever it is not). A basic pass is enough: open the drawer, move through it, hear the page title after navigation, hear every button's name. If it cannot be done, AC-9 says G7 returns NO-GO.
3. **DEF-004 (AQP-179, #43) and DEF-005 (AQP-180, #44) join DEF-003's fix** (#24, DL-057), due before sprint 1 ends. The scope becomes "a green local suite on a machine set up by the README": load-sensitive timing, the drawer-width assertion that compares floating-point pixels exactly (use a tolerance; the Playwright retry hid it), and `tests/unit/env.test.ts` reading the developer's real `.env` (isolate the test's environment). DEF-005 matters most, because the README's own set-up produces the failure. None of these holds G7: all are Sev-3, type Test, and CI is green.

---

## G6 – Peer Review — AQP-106 (STORY-03.02) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #45 at head 4ca5b61; check run "Stages 1 to 11" success (run 41644630495); Jira AQP-106 10761 (developer), 10763 (performance), 10764 (standards), 10765 (quality); labels all approved. Code read at 4ca5b61 with `git grep` and `git diff` (no branch switch): `src/lib/formula/errors.ts` (`issueAt`, `errorAt` carry an optional `name`), `rate-names.ts`, `evaluator.ts` (ROUND), and the one-line change to `tests/acceptance/aqp-97-config-versions.test.ts`. **Not done:** no test run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Performance APPROVE (Info 4); standards APPROVE WITH COMMENTS (Minor 1, Info 7); quality APPROVE WITH COMMENTS (Minor 2, Info 3) |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | None; quality's 20 planted bugs all caught |
| 3 | Major fixed or accepted | | ✅ | None raised |
| 4 | Findings cite file:line | | ✅ | Per the reviews |
| 5 | Reviewed head green | | ✅ | Run 41644630495; 500-node calculation about 74 ms median, 146 ms p95 (NFR-008: 2 s) |

**Rulings**
1. **STD-01 and QLT-16 are fixed now, in one commit I verify myself** (DL-047, DL-054). STD-01: an issue's `name` is formula text (Restricted, architecture 5.1) on a thrown error, and the logger does not redact it; drop it from thrown errors, or rename it and add it to the redaction list, with a logger test that a formula word never reaches a log line. QLT-16: set Decimal's exponent settings so values are written as plain decimal strings, with a test, because 03.03 stores decimal strings and a value written as `1e-7` would be stored that way. Both are a few lines in this story's own module. **My check:** only `src/lib/formula/**`, `src/lib/logger.ts` and their tests change; CI green; my planted inputs (a thrown formula issue logged; a very small and a very large Decimal written) behave.
2. **QLT-15 is deferred to #48** (the 02.01 rate-name check): it matters only once the Admin can add rates (02.01). Due at 02.01's G6. QLT-17 (percentage-by-name) goes with it.
3. **ROUND's literal 0 to 20 rule goes to the product-owner, not the delivery lead,** before the R2 formula editor story reaches Ready. No R1 formula is affected, and no price moves: it only limits what an Admin may type later. If the product-owner judges that users would notice the difference from Excel, they take it to the delivery lead then. The other three SPEC-default readings match the SPEC and stand.
4. **QA's acceptance-test line is accepted.** The seed step now imports the server-only formula engine, so the test must run it with `--conditions=react-server`, exactly as production runs it (AC-8; architecture section 10). The intent of QA's test is unchanged. QA confirms at G7; the file stays QA's.
5. **DeepReadonly (#46) is a start condition of 03.03:** done before the 03.03 branch is cut, as quality recommends, since 03.03 is the first consumer of the cached document in a calculation path.
6. **STD-05 versus AC-5:** the developer's reading stands; standards agrees. **Info:** QLT-18 (grammar may only widen) and QLT-19 (IF equality at 34 digits against Excel's 15) go to #48 as notes for 03.03, where equality against the worksheet is tested; the performance notes (one plan cache per process, `evaluateWithWorking` only on demand, a timed 500-node test) also go there. The rest need no action.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #45 | STD-01 and QLT-16 per ruling 1, one commit | Before G7 |
| 2 | master | Same commit | Verify per ruling 1 | Before G7 |
| 3 | product-owner | R2 formula editor story | ROUND literal range, ruling 3 | Before that story reaches Ready |
| 4 | developer | #46 | DeepReadonly | Before the 03.03 branch is cut |

**Risks registered:** none new.
**Rationale:** The engine meets every AC, is fast against NFR-008, and its tests caught every planted bug. One Minor leaks Restricted formula text toward logs and one would store numbers in the wrong form in the next story, so both are taken now while they are a few lines; the rest belong to the stories that make them reachable.

**AQP-106 G6, follow-up commit verified — 2026-11-03 (master).** Commit 5c2326d on PR #45 (check run "Stages 1 to 11" success, run 41648163968); hand-off AQP-106 10767. **Result: met. AQP-106 may go to G7.**

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | 10 files: `src/lib/decimal.ts`, `src/lib/formula/{errors,tokenizer,validate}.ts`, six unit test files. `src/lib/logger.ts` unchanged |
| `src/lib/decimal.ts` | ✅ within the check | The only Decimal configuration and the place QLT-16 lives; my list named the module, not the file. The change adds two settings and nothing else |
| STD-01 | ✅ | Diff read: `name` removed from `FormulaIssue`, `issueAt` and `errorAt`; all three tokenizer calls stop passing the word; no other field holds formula text. `logger.test.ts` logs refused formulas three ways with invented words and checks none appears |
| QLT-16 | ✅ | `toExpNeg` and `toExpPos` set to decimal.js's limits. My own run with the same settings: `1e-12`, `-0.00000005`, `1e30` and a 24-digit integer all print and serialise as plain decimal strings |
| CI | ✅ | Run 41648163968 on 5c2326d |

**Not done:** the PR's own unit suite was not run by me (the working folder is another branch); CI is the evidence. **Note for the UX of SCR-18:** the editor now quotes the unknown word from the text it holds, using `position` and `length`, which is what the error doc comment says.

---

## G7 – QA Acceptance — AQP-106 (STORY-03.02) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. Merging PR #45 is the delivery lead's act
- **Attempt:** 1
- **Artefacts evaluated:** QA hand-off AQP-106 10770, PR comment 6606177091; QA commit 5c8b6f8 (report, DEF-006 record, one acceptance test file; read through the GitHub API); AQP-106 AC-1 to AC-9 as written; check run "Stages 1 to 11" success on 5c8b6f8 (run 41651772219), read by me. **Not done:** QA's tests not re-run by me.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | 9 of 9 against hand-worked and BigInt oracles; ten planted faults each caught |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | DEF-006 is Sev-3 (ruling 1); DEF-003 class (#24) known |
| 3 | Regression green | ✱ | ✅ | CI green on 5c8b6f8 |
| 4 | Exploratory notes | | ✅ | In the report |
| 5 | Accessibility | | ✅ | No UI |

**Rulings**
1. **AC-6 does not cover DEF-006, so it is not a REJECT.** AC-6's round trip is the conversion between internal and display form for a given rate list, and its only name rule is "a rate name cannot be a valid column letter (refused)", which holds. DEF-006 is a different property: whether a new rate name can collide with a combination of existing names (`Cost-Waste` beside `Cost` and `Waste`). That is a rule on the rate list, reachable only once rates can be created (02.01) or formulas re-saved (R2). It is the same defect as QLT-15, deferred at G6 to #48 (DL-062), and the same evidence gives the same decision. **Because a re-save can silently change a price, it is bound harder than a Sev-3 usually is:** DEF-006 (AQP-181, #49) is fixed in 02.01 (AQP-113), and **02.01 cannot pass G7 while it is open**. This record is the written acceptance the test plan requires for a Sev-3 at G7.
2. **QA's commit 5c8b6f8 needs no peer review** (report, defect record, one acceptance test; DL-050). QA confirmed that the developer's `--conditions=react-server` line in the AQP-97 acceptance test keeps what it checks (two cases fail without the flag), which closes the point left from G6.
3. **Observations:** the nesting limit counts a call as two levels (Sev-4) and `ROUND(-0.4, 0)` serialises as `-0` both go to #48 as notes for 03.03, which stores and displays values; the `migrate` flag for 10.04 is already #47.

**Before the delivery lead's merge:** QA moves AQP-106 to Done; PR #45 is brought up to date with `master` (branch protection) with CI green on the new head; any architecture or governance text for this story is in a docs PR merged first; squash only; the orchestrator checks the first `master` run afterwards.

**Risks registered:** none new.
**Rationale:** The engine is verified against independent oracles, and every planted fault was caught. The one new defect is real but outside what AC-6 asked for, and unreachable until 02.01, so it binds 02.01's G7 instead of this one.

---

## G6 – Peer Review — AQP-168 (DEF-003 class: test reliability) — 2026-11-03

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #51 at head 395f4eb; 7 files, all test or test configuration (`vitest.config.ts`, `tests/support/scratch-database.ts`, five test files); check run "Stages 1 to 11" success (run 41669446603); Jira AQP-168 10773 (developer), 10777 (standards), 10778 (performance), 10779 (quality). **Not done:** no test run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All approve: standards (Minor 2, Info 5), quality (Minor 1, Info 4), performance (Info 3) |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | None. Quality's probes show the changed tests still fail on their bugs |
| 3 | Major | | ✅ | None |
| 4 | CI | | ✅ | Green; job time unchanged (1 m 59 s); every wait bounded |

**Rulings**
1. **STD-01, STD-02 and QLT-20 are fixed now, in one commit I verify** (test-only, a few lines each). STD-01: use `HOLD_SECONDS` in the `pg_sleep` call. STD-02: the warm-up retries only on the connection error it waits for and rethrows anything else, so a real fault is not retried away. QLT-20: delete the remaining under-10 s assertion in the statement-timeout test; an upper bound there is the kind of load-sensitive check this defect removes, and the lower bound and the error code still prove the timeout. **My check:** only the files named in those findings change; CI green.
2. **Evidence under load is required, and it is the G7 evidence.** The defect is "fails under load", so a green CI run cannot show it is fixed. QA runs the two integration files and `layer-rules.test.ts` ten times in a row under the load described in the DEF-003 record, and records the result on AQP-168. All ten green passes; any failure returns it.
3. **The QA acceptance tests in `aqp-97-config-versions.test.ts` are fixed by QA in this PR,** before G7, as a QA commit (no peer review, DL-050): poll and keep the maximum for the connection count; move set-up to `beforeEach` and connect once before the race for the 12-caller round; and replace the timing windows ("9 to 13 s", "about 5 s") with a lower bound plus a bound that fails only on a hang, as at AQP-97 (DL-057). They are in the same class, and the defect's scope is a green local suite on a machine set up by the README (DL-061). They are covered by the same ten-run evidence.
4. **This gets a short G7.** DEF-003 and DEF-005 are QA's defects, so QA re-tests and closes them (test plan). G7 needs the ten-run evidence, the CI result, and AQP-168 and AQP-180 closed. **DEF-004 (AQP-179)** stays open until AQP-28 merges, then a small follow-up on `shell.spec.ts`; its due date stays "before sprint 1 ends".
5. **Merge:** a code PR, so the delivery lead merges it by squash after G7; it needs no docs PR.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #51 | STD-01, STD-02, QLT-20 in one commit | Before G7 |
| 2 | master | Same commit | Verify | Before G7 |
| 3 | qa-engineer | PR #51 | The QA acceptance-test fixes, ruling 3 | Before G7 |
| 4 | qa-engineer | AQP-168 | Ten consecutive runs under load, recorded; close AQP-168 and AQP-180 if green | G7 |
| 5 | developer; qa-engineer | `shell.spec.ts` (AQP-179) | After AQP-28 merges | Before sprint 1 ends |

**Risks registered:** none.

**AQP-168 G6, minor-fixes commit verified — 2026-11-03 (master).** Commit fcc9fa1 on PR #51 (check run success, run 41672629287); hand-off AQP-168 10781. **Result: met.** QA may now add its acceptance-test fixes and run the ten-run evidence (DL-064).

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | One file, `tests/integration/config/database-timeouts.test.ts`; diff read in full |
| STD-01 | ✅ | `pg_sleep(${HOLD_SECONDS}::double precision)`, a bound parameter; the literal and its comment are gone |
| STD-02 | ✅ | The warm-up retries only when `isConnectTimeout` is true (the error or its cause chain, depth-limited); anything else is rethrown at once |
| QLT-20 | ✅ | The under-10 s assertion is removed. A hang is still caught: an uncancelled statement never settles, so the describe's 60 s timeout fails the test |
| CI | ✅ | Green on fcc9fa1 |

**Rulings on the two points asked**
1. **The copied timeout messages are acceptable.** A test that keeps its own expectation is independent of the code it checks, which is the right direction for a test. If `pg` changes a message, the copy stops matching, the warm-up stops retrying and the test fails loudly under load: it fails closed, never open.
2. **The unexercised retry path is acceptable.** It is a few lines of test support, and every way it can be wrong ends in a rethrow and a red test, not a false pass. The ten runs under load will exercise it in practice; if QA's runs show the retry firing, record that on AQP-168.

**AQP-168: PR #51 merged before G7, by a merge commit — recorded 2026-11-04 (master).**

| Fact | Evidence |
|------|----------|
| Merged | PR #51 closed and merged at 2026-11-04T00:07:32Z through the shared `sankumar76` account; merge commit 83eb6de, message "Merge pull request #51 …", so an ordinary merge, not a squash. The orchestrator states it did not merge it; the shared account cannot show who did (RISK-019) |
| Order | Before G7. G6 was CONDITIONAL GO (DL-064), and master had verified the minor-fixes commit fcc9fa1. QA's ten-run evidence and G7 had not happened |
| Head merged | 5933605, not fcc9fa1. The three later commits (cb3faa3, 1c09b6f, 5933605) change only `tests/acceptance/aqp-97-config-versions.test.ts`: QA's own acceptance-test fixes, which DL-064 ruling 3 put in this PR with no peer review |
| CI | "Stages 1 to 11" success on 5933605 and on 83eb6de, read by me |
| Branch protection | Not bypassed: the required check passed, and merge commits are still allowed by the repository settings. Squash was a gate condition, not a setting |

**Ruling (DL-065).** Code merges are the delivery lead's act, so this is recorded as a merge made ahead of the gate, not as an agent's breach and not as an override of a NO-GO. It changes nothing in what G7 must show: G7 is decided on QA's ten-run evidence, run on `master` at or after 83eb6de, since that is now the code. If G7 fails, the fix is a new `fix/AQP-168-…` PR on `master`; nothing is reverted unless QA finds the merged tests wrong rather than flaky. **The merge commit is accepted:** the merged commits are test-only, the secret scan passed on them, and history keeps seven small commits instead of one. That is harmless, but it is the second time squash-only has depended on the person merging (OBS-4 at AQP-27), so **master recommends the delivery lead untick "Allow merge commits"** in the repository settings, which makes squash the only method offered. Agents do not change settings.

---

## G7 – QA Acceptance — AQP-168 (DEF-003 class: test reliability) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. The code is already on `master` (83eb6de, DL-065)
- **Attempt:** 1
- **Artefacts evaluated:** QA hand-off AQP-168 10786; the merge record and DL-065 above; QA's report and the DEF-003 and DEF-007 records as described there (in docs PR #53, CI green per the hand-off). **Not done:** I did not re-run the load runs or read PR #53's files.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | The defects' expected results verified | ✱ | ✅ | Ten consecutive runs under a repeated full unit-run load on `master` 83eb6de: 153 of 153 each (also 10 of 10 on 5933605). The warm-up retry never fired. Twelve planted faults caught |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | None. Open: DEF-007 (Sev-3, new), DEF-004 (Sev-3, waits on AQP-28) |
| 3 | Regression green | ✱ | ✅ | CI green on 83eb6de |
| 4 | Defects closed by QA | | ✅ | DEF-003 (#24) and DEF-005 (AQP-180, #44) verified and closed |

**Rulings**
1. **CONDITIONAL GO.** The ten-run evidence asked for in DL-064 is met on the code as merged. **QA moves AQP-168 to Done** (status changes are QA's, `CLAUDE.md` section 4).
2. **DEF-007 (AQP-182, #52) joins DEF-004 (AQP-179) in one follow-up fix,** once AQP-28 merges, **due before sprint 1 ends**. It is the same class: three unit tests whose default 5 s limit includes machine load, fixed the same way (warm-up or a set-up hook; no wall-clock bound). The Windows out-of-memory spawn failure is an environment fault, not a test design fault. Record it as type Environment, and have it reported as an error, not as a test result.
3. **Docs PR #53 may carry master's pending governance records** (`docs/00-governance/gate-log.md` and `decision-log.md`), staged by name, because both are documentation and both must land before the next code merge. If adding them would force #53 through review again, keep them for a separate docs PR, merged before the next code PR.

---

## G7 – QA Acceptance — AQP-28 (STORY-10.02) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none. Merging PR #33 is the delivery lead's act
- **Attempt:** 1
- **Artefacts evaluated:** QA hand-off AQP-28 10788 (report commit e66b0ab, CI green per the hand-off); the interim rulings above and DL-061; the session log, read by role, for the delivery lead's own words on 2026-11-04. **Not done:** I did not read the report file itself or re-run any check.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | AC-1 to AC-8 and AC-10 at G6 and in the report. **AC-9:** all 22 steps PASS, B4 with an observation. Typed by the delivery lead at 07:33:22Z ("Except B4 … all other scenarios are PASS"); devices typed at 07:30:51Z (iPhone 17 Pro Max, iOS 27.0.1, Chrome 155.0.8059.37; Windows 11 Pro, Chrome 156.0.8078.80). Phone screen reader VoiceOver; Windows screen reader Narrator; contrast theme Desert (the first theme used is not named, and one named theme meets AC-9) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | None. Open: DEF-008 (Sev-3 Product), DEF-004 (Sev-3 Test) |
| 3 | Regression green | ✱ | ✅ | CI green on the report commit |
| 4 | Exploratory notes, accessibility | | ✅ | AC-9 is this story's accessibility check |

**Rulings**
1. **The Narrator ruling is closed.** DL-061 accepted Narrator as "NVDA or equivalent" on 2026-11-03, before the results; it is not reopened. The Windows build number (25H2, 26200.9711) is in the report, but not in the delivery lead's own typed words, which say "Windows 11 Pro". That is enough for AC-9's "device, OS, browser and version", since the browser version is in their words.
2. **DEF-008 (no pressed style on touch, AQP-183, #54) does not hold PR #33.** AC-5 names variants, not states. Hover works, and a tap still acts; there is just no visual feedback. But the UX spec names a pressed colour, and the shell's button is the pattern every page copies, so it is **fixed before the first story with a real action on a phone reaches G7: 01.01 sign-in (AQP-38),** not 05.09. Sign-in is a tap on a primary button on a phone. OBS-6 (pressed colours for the other variants) goes to the ux-expert first, so the fix is made once for all variants.
3. **Checks not run** (Android, Safari on iPhone, NVDA, a low-end phone) are listed for G8, as the test plan says (QA-OQ-04; DL-035).

**Before the delivery lead's merge**
1. QA moves AQP-28 to Done.
2. PR #33 is brought up to date with `master`. That brings in #51 (DEF-005's fix) and the AQP-97 and AQP-106 work. CI must be green on the new head, including stage 12, and that run is DEF-005's re-verification on this branch.
3. The docs PR carrying master's pending governance records (#53, or a separate one) merges first. Architecture v0.14 is already on `master` through #42.
4. Squash merge only; the first push run on `master` afterwards is checked.
5. Then the DEF-004 and DEF-007 follow-up (DL-066), before sprint 1 ends.

---

## G6 – Peer Review — AQP-182 (test reliability 2: DEF-007, DEF-004) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #57 at head 893ef66, test-only; check run success including stage 12 (run 41802738061); Jira AQP-182 10795 (developer), 10797 (standards), 10798 (quality), 10799 (performance). **Not done:** no test run of my own. The developer could not run the loaded series locally (an out-of-memory reinstall), so CI is the only evidence so far.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All approve with comments |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | None |
| 3 | Major | | ✅ | None |
| 4 | CI | | ✅ | Green, stage 12 included; CI time unchanged |

**Rulings**
1. **Fixed now, in one commit I verify:**
   - **QLT-25:** `checkIgnore` treats git's exit 128 as "not ignored", so four tests pass while git is broken. A control that fails open is the attempt-1 test for "now" (DL-047). Exit 0 and 1 are the only answers; anything else throws, with a negative-control test.
   - **PRF-01:** `runProcess` gets a default timeout (60 s, overridable per call), so a hung child fails the test instead of holding the job for 30 minutes.
   - **QLT-28 with it:** a timeout or `maxBuffer` kill gets its own message, distinct from "did not start", so the new timeout is readable.
   - **STD-01:** the code row 3221225495 is 0xC0000017, a duplicate of line 24; correct the label or remove the duplicate.

   **My check:** only `tests/support/` and the helper's tests change; CI green.
2. **Info** (STD-02 to 04, QLT-26, QLT-27, PRF-02): no action. QLT-26's duplicate code row goes with STD-01.
3. **G7 evidence set, confirmed** (DL-064 pattern):
   - **(a)** the drawer test with `--repeat-each=15 --retries=0` at all three widths, all green, plus a planted 1 px fault that fails;
   - **(b)** `npx vitest run tests/unit` ten times in a row under the DEF-003 load (`tsc`, `eslint`, `next build` together), all green;
   - **(c)** the git exit-128 negative control failing as it should after QLT-25.

   An out-of-memory or spawn failure on the test machine is recorded as type Environment and the run repeated. It is not counted as a pass. If the local machine cannot carry the load at all, QA says so and proposes another loaded runner before G7; the evidence is not waived.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #57 | QLT-25, PRF-01 with QLT-28, STD-01, one commit | Before G7 |
| 2 | master | Same commit | Verify | Before G7 |
| 3 | qa-engineer | AQP-182 | Evidence (a) to (c), recorded; close DEF-004 and DEF-007 if green | G7 |

**AQP-182 G6, minor-fixes commit verified — 2026-11-04 (master).** Commit 420ba74, the PR #57 head (check run success including stage 12, run 41811921893); hand-off AQP-182 10801. **Result: met.**

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | Three files: `tests/support/git-ignore.ts`, `tests/support/process.ts`, `tests/unit/process-helper.test.ts`; full patch read through the GitHub API |
| QLT-25 | ✅ | `checkIgnore` throws unless git exits 0 or 1. The test asks for a path outside the repository and expects "failed with exit code 128". Exit 0 and 1 keep their tested meaning |
| PRF-01 | ✅ | `timeout: 60_000` is the default and is spread before `options`, so a call can override it; a 300 ms override stops a hanging child in the test |
| QLT-28 | ✅ | ETIMEDOUT and ENOBUFS get their own messages; each test also asserts the message is not "did not start" |
| STD-01, QLT-26 | ✅ | 3221225495 labelled 0xC0000017 STATUS_NO_MEMORY; 0xC0000142 added as its own row; a test for a process with no exit status and no signal |
| CI | ✅ | Green on 420ba74 |

**For G7.** Evidence (c), the exit-128 negative control, now exists as a unit test that is green in CI; QA confirms it behaves the same in the loaded series. Evidence (a) and (b) need a machine that is not already overloaded: this PC is running three agents' builds at once, and a dev server has crashed on a resource error. Run them when the other agents are idle, or on another loaded runner (DL-068). A failure caused by that overload is type Environment and the run is repeated; it is not a pass and not a defect of this fix.

---

## G6 – Peer Review — AQP-183 (DEF-008: pressed state for every button variant) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #56, `docs/AQP-183-pressed-state` at head 64bef0d, base `master` 529d576; 12 files (code `button.tsx`, `globals.css`, `cn.ts`; 4 test files; 5 ux-expert files under `docs/03-ux/`). Check run "Stages 1 to 11" success on 64bef0d (run 41831621385), steps read through `gh run view`: stages 1 to 12 success, stage 12 is "E2E (Chromium at three widths, axe)", stage 13 skipped (disabled). Merge state clean. Reviews 5768535838 (standards), 5768625699 (quality), 5768823644 (performance), all COMMENT on 64bef0d (single-token); labels `review:standards-approved`, `review:quality-approved`, `review:performance-approved`. Reports `docs/06-reviews/AQP-183/standards.md`, `quality.md`, `performance.md` (main folder, uncommitted). Jira AQP-183 10793 (ux-expert), 10803 (orchestrator, G5), 10804 (developer), 10805 to 10807 (reviewers). **My own checks:** the `src/` patch read in full; `tests/unit/button-pressed.test.ts` line 43 and `vitest.config.ts` lines 34 to 37 at 64bef0d read; the E2E spec presses with `page.mouse` only (lines 61, 62). **Not done:** no test or build run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE WITH COMMENTS, quality APPROVE WITH COMMENTS, performance APPROVE; each reviewed 64bef0d |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in all three |
| 3 | Major fixed or accepted | | ✅ | None |
| 4 | Findings cite file:line | | ✅ | All but two PR-level items (STD-01, STD-05), which name the file |
| 5 | CI | | ✅ | Green including stage 12; the stage 6 tokens test that failed on the first commit now passes |
| 6 | Fix matches its source | | ✅ | The class strings in `button.tsx` equal the ux-expert's developer line (10793) and UX spec v0.9 7.3.1; `disabled:active:*` in the base covers loading, which sets `disabled` (QLT-30) |
| 7 | Evidence for the reported cause | | ⚠️ | Nothing in CI presses by touch on WebKit, the condition DEF-008 was found under (QLT-29). Carried to G7 as condition 3 |
| 8 | NFR-009 first-load JS of `/` | | ✅ | Developer, production bundler, test strategy 10.1 method: **194,179 B**, +272 B. Reviewer, webpack base-to-head difference: +59 B, estimate 193,966 B. The two differ in method; I take the larger, measured figure: 5,821 B (2.9 %) headroom. RISK-020 restated, score unchanged |

**Rulings**
1. **STD-01 (code on a `docs/` branch): closed by record, DL-069.** PR #56 is a code PR and is merged by the delivery lead under `MERGE_POLICY` code-human, whatever its branch prefix. The branch is not renamed: renaming an open PR's head closes it.
2. **STD-02, first half: fixed before G7, raised from Info.** `tests/unit/button-pressed.test.ts:43` passes `60_000` to `beforeAll`, below the shared `hookTimeout` of 120 s. The repository's own `vitest.config.ts` states "One hook limit for every level, set here and not per file (test strategy section 10, DL-057; DEF-003)". A Tailwind compile on this loaded PC is the DEF-003 class (DEF-004, DEF-007 since), and a tighter limit here would bring it back. Remove the argument; rename `d` to `declaration` in the same commit (the second half). One test-only commit, verified by master within that one file (DL-047). No re-review.
3. **QLT-29: G7 condition, DL-070.** The delivery lead's iPhone hold check is the evidence. A CDP touch case in Chromium is not required: Chromium already sets `:active` on touch, so it could not fail on the WebKit cause either. A WebKit project stays optional.
4. **Info, no action:** STD-03 (self-referencing `@theme inline` line, the radius pattern of QLT-10; the E2E shows the shadow paints), STD-04, STD-05, QLT-30, QLT-31, PRF-01 to PRF-03. The `docs/03-ux/` files are the ux-expert's (10793) and travel with the code PR; reviewers read them for consistency only.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #56, `tests/unit/button-pressed.test.ts` only | Remove the `60_000` hook limit (line 43); rename `d` to `declaration`. One commit, CI green | Before G7 |
| 2 | master | Same commit | Verify: one file, no limit argument, CI green | Before G7 |
| 3 | qa-engineer, with the delivery lead | AQP-183; `docs/07-qa/AQP-183-test-report.md` | On the iPhone that found DEF-008 (Chrome, so WebKit), at `/design-system` section 05: hold each variant for about a second (Calculate, Add part, Cancel, Delete, the 44 px pencil, the 36 px row pencil) and see the pressed fill and the inset; tap each quickly and see a brief flash; tap a disabled and a loading button and see **nothing**. Results are the delivery lead's own typed words per button, not a drafted reply (DL-007). Also `npx playwright test tests/e2e/button-pressed.spec.ts --retries=0` on the three projects, 0 failures | G7 |
| 4 | solution-architect | AQP-183; PR #56 | **Only if condition 3 fails:** decide on a passive no-op `touchstart` listener (`{ passive: true }`, in a small client component). If added, it is new production code: a re-review of that diff by all three reviewers (performance included, as `/` has 2.9 % headroom), then condition 3 is repeated (DL-051) | G7 |

**Risks registered:** none new. RISK-020 restated, score unchanged (`/` at 194,179 B measured).
**Rationale:** No Blocker, Critical or Major. The fix is exactly what UX 7.3.1 specifies and is tested against the CSS Tailwind builds. What CI cannot show is the one thing the defect was about, a pressed look on an iPhone, so that check is the G7 evidence, owned by the person who found it. The hook limit is fixed now because the repository's own rule forbids it and the class it would cause has recurred three times.

**AQP-183 G6, condition 2 (STD-02 commit) verified — 2026-11-04 (master).** Commit a13f194 "test(ui): use shared hook limit in pressed-state test [AQP-183]", the PR #56 head, a fast-forward from 64bef0d (one commit ahead, its parent is 64bef0d). **Result: met.**

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | `gh api compare 64bef0d...a13f194`: one file, `tests/unit/button-pressed.test.ts`, +3 / −3; full patch read |
| Hook limit removed | ✅ | Line 43 `}, 60_000);` becomes `});`, so the shared `hookTimeout` of 120 s applies (DL-057). No `_000` is left in the file at a13f194 |
| `d` renamed | ✅ | Both `.find((d) => d.value…)` callbacks (lines 52, 83) now use `declaration`; no `d` left. Assertions unchanged, so the test proves the same thing |
| CI | ✅ | Run 41836397047, pull_request on a13f194: success, stages 1 to 12 (stage 12 E2E), stage 13 skipped (disabled); merge state clean |

**For G7.** Conditions 1 and 2 are met; PR #56 may go to G7 at a13f194. Condition 3 (the delivery lead's iPhone hold check, typed by them) and the E2E spec with `--retries=0` are the G7 evidence; condition 4 applies only if the phone check fails. No re-review: a test-only change within the named file (DL-047).

---

## G6 – Peer Review — AQP-38 (STORY-01.01: sign in and sign out) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #58, `feat/AQP-38-sign-in-sign-out` at head 4d9b2e2, base 529d576; 61 files, +4,226 / −80. Check run "Stages 1 to 11" success on 4d9b2e2 (run 41839712722). Steps read with `gh run view`: stages 9 to 12 success (stage 12 E2E), stage 13 skipped (disabled). Merge state clean.
  - **Reviews:** 5769379433 (standards), 5769421142 (quality), 5769485037 (performance), all COMMENT on 4d9b2e2. Labels `review:standards-approved`, `review:quality-changes-requested`, `review:performance-approved`. Reports `docs/06-reviews/AQP-38/standards.md`, `quality.md`, `performance.md` (main folder, uncommitted).
  - **Jira AQP-38:** 10819 (developer), 10820 (orchestrator, G5), 10821, 10822 and 10824 (reviewers), 10823 (solution-architect).
  - **Architecture:** ADR-009 amendment 1, architecture v0.16 and test strategy v0.15 (main folder, uncommitted). GitHub #59, #60, #61.
  - **My own checks, by reading 4d9b2e2:**
    - `src/server/services/auth-service.ts`: the throttle `find` comes before `hasher.verify`, and `recordFailure` after it. `dummyHash ??=` keeps a rejected promise.
    - `src/server/repositories/user-repository.ts:100-103`: `raiseSessionVersion` increments with `where: { id }` only.
    - `src/server/auth/options.ts`: an `unavailable` error leaves next-auth as 401.
    - `src/server/auth/locked-response.ts`: maps `locked` to 429 only.
    - `src/proxy.ts:40`: `process.env.APP_ORIGIN || request.url`. `src/lib/env.ts` validates `APP_ORIGIN`.
    - The migration: `login_throttles` has a `key_hash` primary key and no `created_at`.
  - **Not done:** I ran no probe or test. QLT-32 and QLT-33 rest on reviewer-quality's scratch probes and on my reading of the code, which shows the same sequence.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE WITH COMMENTS, quality REQUEST CHANGES, performance APPROVE WITH COMMENTS; all on 4d9b2e2 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in all three. I checked whether QLT-32 is Critical. Sequential guessing still hits the limit, the block applies once the burst ends, and argon2id caps how many checks a burst gets through. It is a Major |
| 3 | Majors fixed or accepted | | ❌ | QLT-32 upheld; fixed in this PR (condition 1) |
| 4 | Architect's required change | | ❌ | ADR-009 amendment 1 rule 1 makes compare and increment "Required in PR #58 before G6 closes, with one test". It is not in 4d9b2e2 (condition 2) |
| 5 | Findings cite file:line | | ✅ | All |
| 6 | CI | | ✅ | Green on all stages; 2,007 unit and integration tests; changed-code coverage 95.0 %; 125 E2E passed |
| 7 | NFR-009 first-load JS (DL-059) | | ✅ | Turbopack build; both methods agree within 27 B. `/` 197,138 B, `/queue` 198,249 B, `/sign-in` 160,502 B. All under 200,000; headroom 0.9 % on `/queue`. RISK-020 raised |
| 8 | G4 condition 6, sign-out half | | ✅ | Answered at G6 by ADR-009 amendment 1, not before G5 as set. Late but harmless: the option chosen is the one that was built. Met once condition 2 lands |

**Rulings**
1. **QLT-32 (Major) is upheld and is fixed in this PR.** AC-3's limit is a security control (NFR-003). As built, a burst of parallel attempts gets one password check per request before the first failure is recorded, and the per-address limit has the same shape. Required behaviour, whatever the mechanism:
   - (a) One account key: at most 5 password checks can start between blocks, however many requests arrive at once. One address: at most 30 per window.
   - (b) The decision uses a count the database returns from the same statement that changes it (for example `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`), never a read followed by a later write.
   - (c) **A successful sign-in does not use up the per-address allowance.** The office signs in from one address, so an attempt reserved before the check is given back on success. A correct password still clears the account key.
   - (d) The same statement closes the lost count in `restartWindow` (QLT-35).
   - (e) Tests:
     - A parallel unit test: 50 attempts at once on one account give at most 5 hash checks, and the rest are `locked`. The same for 31 or more on one address with distinct accounts.
     - An integration test against PostgreSQL with parallel attempts.
   - If (a) to (c) cannot be met with one atomic statement per key, the developer asks the solution-architect before coding further.
2. **Compare and increment (ADR-009 amendment 1 rule 1) goes in this PR.** `raiseSessionVersion` takes the token's version and updates only `where: { id, sessionVersion }`. One test: a sign-out with an out-of-date token leaves the version unchanged, and the current session still works. Sign-out on every device (option A) stands; cookie-only is rejected. The `/design-system` check in `production-routes.spec.ts` is accepted, as the architect ruled.
3. **All Minors are fixed now, in the same round.** The round is needed anyway for rulings 1 and 2, the re-review covers them, each is small, and three of them enforce a security or architecture rule:
   - **STD-01 = QLT-33:** clear the cached dummy hash when it fails, or build it at start-up. Test: a hasher whose first `hash` rejects; an unknown e-mail then answers as a known one would. Reason: AC-2's own promise that unknown e-mails cannot be told apart.
   - **QLT-34:** extend `withThrottledStatus`, or add a function beside it, so that a 401 with `error=unavailable` becomes 503 (`Retry-After` optional). Test it in the handler. Reason: architecture ruling R4, and the mapper already exists.
   - **STD-03:** `src/proxy.ts` uses the validated `APP_ORIGIN`. The `request.url` fallback either stays only outside production or goes. Test the production case. Reason: the Host header must never choose where people are sent.
   - **STD-02:** add `created_at` to `login_throttles`, by amending the unmerged migration or adding a new one; the drift check stays green. The `key_hash` natural primary key is **accepted and recorded** (DL-072), not changed.
4. **Info: no change in this PR.**
   - To #59: STD-04, STD-05, PRF-03, and QLT-35's shared `unknown` counter.
   - To #60: PRF-04, the `clear` filter. It may be folded into ruling 1 if the new statement makes it free.
   - No action: STD-06, STD-07 (as ruled in the ADR), STD-08, STD-09, QLT-36, PRF-02. STD-08 gets no issue because one role list belongs naturally in 01.04.
5. **PRF-01 is not fixed in this PR (DL-073).** Every route passes. Lazy-loading the account menu and drawer changes the portal frame, which is outside this story's ACs. It goes to #61 and AQP-169 on the architect's plan (AQP-38 10823). The DL-059 rule continues: a route over 200,000 B holds that story's G6. The fix round adds no client code, so performance re-measures only if a client file changes.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #58: `auth-service.ts`, `throttle-repository.ts`, tests | QLT-32 as in ruling 1 (a) to (e) | Before G7 |
| 2 | developer | PR #58: `user-repository.ts`, `auth-service.ts`, `options.ts`, tests | Compare and increment, with its test (ruling 2) | Before G7 |
| 3 | developer | PR #58 | STD-01/QLT-33, QLT-34, STD-03 and STD-02, with tests (ruling 3); CI green | Before G7 |
| 4 | reviewer-quality, reviewer-standards | PR #58, new diff only | Re-review the fix diff. Quality: 1, 2 and QLT-34. Standards: STD-01 to 03, and the security of 1 and 2. Performance only if a client file changes; otherwise it confirms the file list | Before G7; QA holds until it is done (DL-051) |
| 5 | master | Gate log | Check 1 to 4 against this record; G7 may then start | Before G7 |
| 6 | ux-expert | SCR-26 wording (ADR-009 amendment 1) | A second message for a session ended by a sign-out elsewhere or by a password change | Before AQP-89 reaches G5 |
| 7 | orchestrator | Sequencing | After PR #58 merges: AQP-169 first, then #61's headroom work, before any story that adds client JavaScript to the portal frame starts. 1.8 KB of headroom will not carry one | After the merge |

**Risks registered:** RISK-020 raised to P 4, score 12 (🟡). RISK-021 is new, score 8 (🟡): the per-address limit depends on the proxy header.
**Rationale:** There is no Blocker or Critical. But under concurrency, the brute-force limit that AC-3 exists to provide does not hold, and the architect made compare and increment a condition of this gate. Both are production code, so the new diff is re-reviewed before QA. The Minors cost little in a round that happens anyway, and three of them enforce a security or architecture rule, so none is deferred.

**AQP-38 G6, conditions 1 to 4 verified — 2026-11-04 (master).** Commit ea8dc6b, the PR #58 head. It is a fast-forward from 4d9b2e2: one commit ahead, with 4d9b2e2 as its parent. **Result: met.**
- **CI:** run 41845931376, pull_request on ea8dc6b. Success on stages 1 to 12, stage 13 skipped (disabled). 2,039 tests, 95.2 % changed-code coverage, 125 E2E passed. Merge state clean.
- **Re-reviews:** standards (Jira 10828) and quality (10829) review submissions are on ea8dc6b. All three labels are approved.
- **My check:** I read the full source diff `4d9b2e2..ea8dc6b` with `git diff` after a fetch, and the added test names and assertions. I ran no test of my own; quality re-ran its probe (50 parallel attempts now give 5 verifies, 45 `locked`).

| Condition | Result | Evidence |
|-----------|--------|----------|
| 1 (a), (b) QLT-32 | ✅ | `throttle-repository.ts` `reserveStatement`: one `INSERT ... ON CONFLICT (key_hash) DO UPDATE ... RETURNING failures`, with every value a bound parameter. `auth-service.ts` reserves the address and then the account before `passwordIsRight`, and refuses when `attempts > limit` |
| 1 (c) Give-back | ✅ | Success: `clear(accountKey)` and `releaseAttempt(ipKey)`. A refusal on the account gives back the address. A fault of ours gives back both. `releaseAttempt` uses `GREATEST(failures - 1, 0)` |
| 1 (d) QLT-35 lost count | ✅ | Restart, block end and block start are inside the same statement; `restartWindow` is gone |
| 1 (e) Tests | ✅ | `tests/unit/auth-service-concurrency.test.ts`: 50 at once on one account give 5 checks and 45 `locked`; 45 at once on one address give 30 checks and 15 `locked`; 40 correct sign-ins from one office address are all accepted. `tests/integration/auth/throttle-reservation.test.ts` (PostgreSQL): 50 parallel reservations get exactly 1 to 50, plus the same bursts at service level |
| 2 Compare and increment | ✅ | `user-repository.ts`: `updateMany({ where: { id, sessionVersion: expectedVersion } })` returns `count === 1`. `options.ts` passes the token's `sv`. Tests in the unit, repository and handler suites: an out-of-date token leaves the version unchanged and `resolveSessionUser` still accepts the current session; 10 sign-outs at once raise it once. **G4 condition 6, sign-out half: met** |
| 3 STD-01/QLT-33 | ✅ | `dummyHash` is cleared in `.catch`. Test: after a failed first hash, an unknown e-mail answers `invalid` |
| 3 QLT-34 | ✅ | `withSignInStatus` maps `locked` to 429 and `unavailable` to 503 through a `Map`, so `constructor` finds nothing. Handler test: a busy database gives 503, with no cause in the body |
| 3 STD-03 | ✅ | `proxy.ts` `portalOrigin` uses `loadOriginEnv()`. In production a missing or bad origin throws; no Host fallback. Tests: an evil Host header yields the validated origin, and a missing origin throws `APP_ORIGIN` |
| 3 STD-02 | ✅ | New migration `20261104120000_login_throttles_created_at`: additive, with a rollback note, citing DL-072. The schema is updated and the drift check is green. Test: `created_at` and `updated_at` are filled in |
| 4 Re-review | ✅ | Standards: APPROVE WITH COMMENTS, STD-01 to 03 fixed, Info STD-10 to 13. Quality: APPROVE WITH COMMENTS, QLT-32 to 35 fixed, Info QLT-37 and QLT-38. Performance not re-run: no client file is in the 20-file list (server, proxy, migration and tests only); first-load JS is unchanged at `/` 197,116 B and `/queue` 198,229 B |

**New Info, no change in this PR:**
- No action: STD-10 (comment the raw SQL), STD-11, STD-13.
- QLT-37 (a give-back can lower a later run, which is bounded) and QLT-38 (the block is set when the limit-th attempt is reserved).
- STD-12 (a block set by a successful 30th attempt does not refuse; refusal is by count).
- My own reading of `reserveStatement`: while an address block is set, its window does not restart by time, so an address can count for up to its block's end (at most window plus block). This only happens once 30 reservations have been reached, and it errs on the strict side.
- These four are as-built semantics, not defects. **Follow-up, not a condition of this gate:** the solution-architect states them in architecture section 6 (NFR-003), before G8.

**For G7.** PR #58 may go to G7 at ea8dc6b. QA tests AC-3 sequentially, as written, and may cite the parallel tests as added evidence.

---

## G7 – QA Acceptance — AQP-38 (STORY-01.01: sign in and sign out) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #62, `feat/AQP-38-sign-in` at head a2b2997, superseding PR #58 (closed 15:03:24Z, branch deleted from origin; only `feat/AQP-38-sign-in` remains, read with `git ls-remote`). Check run "Stages 1 to 11" success on a2b2997 (run 41858738190). Steps read with `gh run view`: stages 1 to 12 success, stage 2 secret scan included; stage 12 log "155 passed", "11 skipped", no flaky or retried line. Merge state clean; all three review labels approved.
  - **Product code unchanged since G6:** `gh api compare ea8dc6b...a2b2997` shows 5 commits ahead, 0 behind, and 4 added files only: `docs/07-qa/AQP-38-test-report.md`, `docs/07-qa/defects/DEF-009-...md`, `tests/acceptance/aqp-38-sign-in.test.ts`, `tests/e2e/aqp-38-qa.spec.ts`. The product diff is the one checked at G6 (conditions 1 to 4 met at ea8dc6b). QA's own test files after G6 need no re-review (DL-048).
  - **QA:** `docs/07-qa/AQP-38-test-report.md` at a2b2997 (recommends ACCEPT); DEF-009 record; Jira AQP-38 10831, 10832, 10833 (corrected), 10835; AQP-184, #63.
  - **Decision provenance:** session log, read by role. The coordinator chose option C, a new branch from ea8dc6b, citing the standing rule against force-push. The force-push was not put to the delivery lead. The delivery lead was asked one question (14:58:02Z): delete the old branch and close #58, or add an 8th baseline entry. They selected "Delete it, close #58 (Recommended)" at 15:03:07Z.
  - **Not done:** no test run of my own; I did not read the two QA test files line by line.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | Report matrix: AC-1 to AC-8 Pass, each with tests and technique. AC-3 tested one attempt at a time, to the millisecond on a controlled clock, as written; the developer's parallel tests are extra evidence. AC-7 run against a real database; the password is printed 0 times |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | Sev-1 0, Sev-2 0. DEF-009 is Sev-3, type Test (the developer's axe E2E scans mid-fade); no product defect |
| 3 | Regression recorded and green | ✱ | ✅ | Run 41858738190 on a2b2997, stages 1 to 12, 155 E2E passed, 0 flaky, read in the log. **But the report's CI row, recommendation note and hand-off still describe b69a50a (1 flaky) and a red stage 2 with PR #58 kept.** The facts are green; the record is stale (condition 1) |
| 4 | Exploratory notes | | ✅ | Seven named areas, including a real busy database (a table lock with a 700 ms limit gives 503, nothing counted) and two browsers for sign-out |
| 5 | Accessibility (UI story) | | ✅ | axe 0 in five states at three widths, a keyboard-only run with no scripted focus, the skip link, and the accessibility tree. No human screen-reader session; AC-8 does not ask for one |
| 6 | Test strength | | ✅ | 9 of 10 planted faults caught; M6 explained (a redundant guard behind the WHATWG parser) |
| 7 | Report accuracy | | ⚠️ | QA's first 10833 said "155 passed, 0 flaky" before reading the log; corrected in the same comment and in 10835, before any gate relied on it. Same weakness as condition 1 |

**Rulings**
1. **PR #58 → PR #62, recorded (DL-074).** The new branch was the coordinator's choice, not the delivery lead's; they were not asked about a force-push. Their decision was the branch deletion, by selecting the recommended option. It stands under DL-007 (1): no price depends on it, and it changes no product code. It is irreversible only for the branch name; PR #58 with its reviews stays readable. The G6 record and condition check carry over to PR #62 unchanged, because the product diff is the same commit, ea8dc6b. The invented key is still reachable through GitHub's read-only `refs/pull/58/head`. CI fetches branches, not pull refs, so stage 2 is green; this would return only if CI began to fetch pull refs.
2. **DEF-009 does not hold G7.** It is Sev-3, type Test, in the developer's helper. It is fixed by the developer in one small PR that waits for no running animation inside `expectNoAxeViolations`, so every axe scan settles. Due before the next story with an axe E2E reaches G6 (AQP-169 is next). A retry that hides it is not a fix. AQP-183's pressed state also uses `transition-colors`, so it is the same class.
3. **OBS-1 (iOS may zoom on the 14 px fields) is a follow-up, not a condition.** No AC asks for it, and the 14 px size is the ux-expert's decision for every form. G7 is decided against the story's ACs. Do it in the same iPhone session as AQP-183's G7 condition 3: tap the e-mail field on `/sign-in` and say whether the page zooms. If it does, QA raises a product defect for the ux-expert covering all forms, before 01.05's G7.
4. **QA's misreport, recorded.** Counts are read from the log before they are reported. It was caught and corrected in time; no other action.
5. **OBS-2 to OBS-4:** as QA suggests. OBS-2 goes to the ux-expert for the UX spec, with no change in this story.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | qa-engineer | `docs/07-qa/AQP-38-test-report.md`; PR #62 description | Name run 41858738190 on a2b2997 (155 passed, 0 flaky) as the regression reference. Mark the 1-flaky run as history (DEF-009). Replace the stage 2 notes ("stays red", "coordinator asked that PR #58's branch be kept") with the outcome: PR #58 closed and its branch deleted by the delivery lead's decision, stage 2 green. Docs-only, one commit, CI green | Before the merge |
| 2 | master | Same commit | Verify: one docs file plus the PR text, no product or test change, CI green | Before the merge |
| 3 | developer | `tests/e2e` axe helper (DEF-009, AQP-184, #63) | Wait for animations to finish before each axe scan; no retry | Before the next story with an axe E2E reaches G6 |
| 4 | qa-engineer, with the delivery lead | AQP-38 (OBS-1) | Zoom check on `/sign-in`, in the AQP-183 iPhone session | Follow-up, before 01.05 reaches G7 |
| 5 | solution-architect | Architecture section 6 | As-built throttle semantics (G6 condition check) | Before G8 |

QA moves AQP-38 to Done on this decision. The delivery lead merges PR #62 after condition 2 (`MERGE_POLICY` code-human); then the orchestrator starts AQP-169 (DL-073).

**Risks registered:** none new. RISK-020 is unchanged at 12. PR #62 adds no client code; when AQP-183 also merges, `/` is about 197,388 B.
**Rationale:** Every AC is shown by independent oracles, with the lock-out timed to the millisecond and the regression green at the head. The product code is the commit G6 cleared. What is wrong is the report's account of CI, which will be merged into `master` as the record, so it is corrected first. The flaky axe test and the iPhone zoom are real, but neither is an AC of this story.

**AQP-38 G7, condition 1 (report correction) verified — 2026-11-04 (master).** Commit 46483e2 "docs(qa): AQP-38 report names CI run 41858738190 as the reference and records PR #58 closed (G7 condition 1)", the PR #62 head. It is a fast-forward from a2b2997 (one commit, parent a2b2997). **Result: met.**

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | `gh api compare a2b2997...46483e2`: only `docs/07-qa/AQP-38-test-report.md`, +5 / −5; full patch read. No product or test file |
| Content | ✅ | CI row, recommendation, full-regression row and hand-off name run 41858738190 on a2b2997 (stage 2 green, 155 E2E, 0 flaky) as the reference. The 1-flaky run is listed as earlier. The stage 2 section now says the delivery lead chose to close PR #58 and delete its branch, instead of an eighth baseline entry; it keeps "option C, the coordinator's decision" for the new branch, which matches DL-074. No stale "stays red" or "branch kept" text is left |
| PR #62 description | ✅ | States PR #58 closed and its branch deleted (the delivery lead's choice), and run 41858738190 as the reference |
| CI | ✅ | Run 41860370753 on 46483e2: stages 1 to 12 success, stage 13 skipped (disabled); stage 12 log "155 passed", "11 skipped"; merge state clean |

**PR #62 is ready for the delivery lead's squash merge** (`MERGE_POLICY` code-human). Open after the merge, none of which holds it: DEF-009 (developer, before AQP-169's G6), OBS-1 (AQP-183 iPhone session), and the throttle semantics in architecture section 6 (before G8). The orchestrator starts AQP-169 next (DL-073).

---

## G6 – Peer Review — AQP-184 (DEF-009: axe scans wait for transitions) — 2026-11-04

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #65, `fix/AQP-184-axe-wait` at head 09f8022, base 85c699f (current `master`, after PR #62's merge). Two files: `tests/e2e/support/design-system.ts` (+33 / −2) and `tests/e2e/axe-helper.spec.ts` (+105, new). Test code only. Check run "Stages 1 to 11" success on 09f8022 (run 41868171176, attempt 1). Stage 12 log: "170 passed", "11 skipped". Merge state clean. Labels: standards and quality approved; no performance label.
  - **Reviews:** `docs/06-reviews/AQP-184/standards.md` and `quality.md` (main folder, uncommitted), both on d6a441f; Jira AQP-184 10844, 10845, 10846. **No performance report.**
  - **My own checks:**
    - The full PR patch, and `gh api compare d6a441f...09f8022`: one commit, parent d6a441f, two files.
    - The stage 12 log on 09f8022: all five `axe-helper.spec.ts` tests show ✓ on mobile, tablet and desktop. The control test (line 93) **passed, not skipped**, at all three widths (QLT-41).
  - **Not done:** no local run.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ❌ | Standards and quality only. The orchestrator ruled performance "not needed, no client code changed". DL-032 records the delivery lead's own words, "all 3 reviews ... are done", and the G6 checklist has no exception for test-only changes. AQP-182 (test-only) had all three |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in both reports |
| 3 | Majors fixed or accepted | | ✅ | None |
| 4 | Minors and fix commit | | ✅ | **09f8022 verified by master.** STD-01: `AXE_TAGS` is exported and the control uses it. QLT-39: `startTransition` returns the start colour from the same `evaluate` that starts the transition, so no time can pass between the two. QLT-40: the wait is a named `test.step` in `expectNoAxeViolations` and in the test. Assertions are unchanged otherwise |
| 5 | CI | | ✅ | Green; the control ran at all three widths |
| 6 | Helper design | | ✅ | `waitForAnimationsToFinish` waits on `Animation.finished` for running or pending finite animations, loops for chained ones, skips infinite and paused ones, and has no retry or timeout of its own (DL-057). A transition that starts after it returns is not seen (inherent, QLT-40) |

**Remediation (the only one)**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | reviewer-performance | `docs/06-reviews/AQP-184/performance.md`; PR #65 COMMENT review and label | A short review at 09f8022. Confirm no client or product file. Measure CI feedback time against test strategy 10.3: stage 12 wall time before and after, and the worst case added per axe scan (the wait equals the longest running finite transition). Check the 2.1 s helper tests | Attempt 2 |

If the report has no Blocker or Critical, attempt 2 is GO on this record: no other reviewer re-runs, and no new code round. **Recommendation, not a change:** if the delivery lead wants a performance review to be optional for test-only diffs, they say so and the G6 checklist is amended. Until then, three reports are required (DL-076).

**G7 evidence for this test-only defect (DL-077).** I agree with the orchestrator's proposal, with these specifics:
- **(a)** CI green on the final head, with the `axe-helper.spec.ts` control ✓ (not skipped) on all three projects, read in the log.
- **(b)** A QA confirmation on AQP-184. Because the defect is a flaky test, this is a repeated run: `npx playwright test tests/e2e/sign-in.spec.ts --repeat-each=10 --retries=0` on the three projects against the production build, 0 failures. An environment failure on the shared PC is recorded and repeated, never counted (DL-068).
- **(c)** QA closes DEF-009 (AQP-184, #63).

No test-report file and no full QA cycle are needed. The Jira comment is the report, as at AQP-168 (DL-066).

**Risks registered:** none.
**Rationale:** The fix is right and the follow-up commit is verified. But a mandatory item fails, and the delivery lead decided in their own words that all three reviews are done. That is theirs to relax, not mine. The missing review has a real subject: every axe scan in the suite now waits.

---

## G7 – QA Acceptance — AQP-183 (DEF-008: pressed state) — 2026-11-04

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR:** #56, `docs/AQP-183-pressed-state`; code at a13f194 (G6 condition check); head 0a5b10d (QA report and the DEF-010 record). Behind `master` since PR #62 merged.
  - **QA:** Jira AQP-183 10842 (REJECT); AQP-185 (DEF-010, #64); `docs/07-qa/AQP-183-test-report.md` at 0a5b10d (not read line by line).
  - **Provenance:** the delivery lead's device results checked in the session log. "not very clear" (15:43:10Z) and "do not see brief flash" (15:52:53Z) are typed user text, with no earlier assistant draft. The OBS-1 answer "tap opened the keyboard" was typed at 16:02:53Z.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ❌ | G6 condition 3 (DL-070) is the acceptance of this defect fix. It fails for **Calculate (primary)** and **Delete (danger)**, held and tapped, in the delivery lead's own words. It passes for secondary, ghost, both pencils, disabled and loading. Calculate is the button DEF-008 named |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | DEF-010 is Sev-3. Its severity is not what holds this gate. The fix does not do what DEF-008 asked for the button DEF-008 named |
| 3 | Regression | ✱ | ✅ | CI 41836397047 green; E2E `button-pressed.spec.ts` 45 of 45 with no retries |

**Rulings**
1. **QA's REJECT is upheld.** The code applies UX 7.3.1 as written, so the cause is the spec's values (rest to pressed contrast 1.30:1 for primary and 1.37:1 for danger, against 1.40 and 1.70 for the variants that pass). The fix starts with the ux-expert. DEF-008 stays open with DEF-010.
2. **G6 condition 4 (the `touchstart` listener) is closed, not needed.** `:active` applies on iOS WebKit: secondary, ghost and the pencils show on the device.
3. **OBS-1 of AQP-38 (iOS zoom) is closed.** No zoom on a 14 px field ("Length field ... tap opened the keyboard"). It was a different field from `/sign-in`'s e-mail field, but it uses the same body size, which is what the question was. No defect.
4. **OBS-2 (a long press selects button text and shows the copy callout)** goes to the ux-expert with 1. It is not a condition here.

**Remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | ux-expert | UX spec §7.3.1 | Pressed values for primary and danger that a person can see on a phone. A pressed fill clearly apart from rest, or a non-colour cue that shows on dark red. Text contrast stays at least 4.5:1. Decide OBS-2 | Before the developer starts |
| 2 | developer | PR #56: `button.tsx`, the tokens, E2E expected values | Implement 1. Bring the branch up to date with `master` (PR #62 merged) | Attempt 2 |
| 3 | reviewer-standards, reviewer-quality, reviewer-performance | PR #56, new diff | Re-review (production code, DL-051). **Performance re-measures first-load JS of `/` and `/queue` on the updated branch.** `/queue` was 198,229 B with 1,771 B left, and PR #56 adds about 272 B (DL-059) | Before G7 attempt 2 |
| 4 | master | PR #56 | G6 check of 2 and 3 | Before G7 attempt 2 |
| 5 | qa-engineer, with the delivery lead | AQP-183 | Repeat the iPhone hold and tap for **Calculate and Delete only**, in their own typed words, plus the E2E spec with `--retries=0` | G7 attempt 2 |

**Risks registered:** none new. RISK-020 is watched through remediation 3.
**Rationale:** The phone check was set at G6 as the one piece of evidence CI could not give, and it failed for the button the defect was about. A Sev-3 rating does not turn a fix that does not fix into an accepted one. The cause is design values, so the change starts with the ux-expert.

### G6 – Peer Review — AQP-184 (DEF-009) — attempt 2 — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:** PR #65 at head 09f8022, unchanged since attempt 1 (`gh api pulls/65`). Check run "Stages 1 to 11" success on 09f8022. Merge state clean. Labels: all three `review:*-approved`. Performance review 5772151363 (COMMENT, on 09f8022); `docs/06-reviews/AQP-184/performance.md` (main folder, uncommitted); Jira AQP-184 10851.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards and quality (attempt 1); performance APPROVE on 09f8022 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in all three |
| 3 | Majors | | ✅ | None |
| 4 | Fix commit | | ✅ | 09f8022 verified at attempt 1; head unchanged |
| 5 | CI time (test strategy 10.3) | | ✅ | PRF-01 (Info): the wait is at most about 200 ms per scan (0 under reduced motion), about 4.5 s of wall time at most across about 45 scans, bounded by the 30 s test timeout. PRF-02 (Info): the new tests add about 10 s of wall time, by design. Stage 12 within runner noise, plus about 10 to 15 s. No JS budget effect |

**Rulings.** PRF-01 and PRF-02: no action. Attempt 1's only remediation is met, so GO on that record (DL-076).

**DL-076's question is closed with no new question.** The orchestrator confirms that DL-032's words ("keep the reviews as is today, so all 3 reviews") already answer it. Test-only PRs do not skip the performance review, and no checklist amendment is needed. The miss came from the brief, not from a gap in the rule.

**For G7:** the DL-077 evidence. (a) CI green on the final head with the control test ✓ on all three projects; already shown on 09f8022, run 41868171176. (b) QA's `sign-in.spec.ts --repeat-each=10 --retries=0` on three projects, 0 failures, posted on AQP-184. (c) QA closes DEF-009. Merging is by the delivery lead after G7 (a test-only code PR, `MERGE_POLICY` code-human).

**Risks registered:** none.

---

## G6 – Peer Review — AQP-183 (DEF-008 with DEF-010), re-check after the G7 NO-GO — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (G7 attempt 1 was NO-GO, DL-078; this is its remediation step 4)
- **Artefacts evaluated:**
  - **PR and CI:** PR #56, `docs/AQP-183-pressed-state` at head 0cfaf78. Commits since a13f194: 0a5b10d (QA report), d01352c (merge from `master` 85c699f), 1a5a607 (UX spec v0.10 and mock-ups), 0cfaf78 (code). Check run success on 0cfaf78 (run 41873955569): stages 1 to 12 success, stage 12 log "200 passed", "11 skipped". Merge state **behind** (docs PR #66 merged as 15cd9cb). Labels: all three approved.
  - **Reviews:** Jira 10855 (standards), 10856 (quality), 10857 (performance); UX values from AQP-185 10849.
  - **My own check:** `git diff 1a5a607 0cfaf78` (five files: `globals.css`, `button.tsx`, `design-tokens.ts`, the two button tests), source read in full.
  - **Not done:** no local run; the UX spec v0.10 text was not read line by line (quality matched it character for character).

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE WITH COMMENTS, quality APPROVE WITH COMMENTS (Info only), performance APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 |
| 3 | Majors | | ✅ | None |
| 4 | Fix matches its source | | ✅ | `--primary-pressed` #7f1616 and `--danger-pressed` #520f09, mapped to Tailwind colours. `active:bg-primary-pressed` and `active:bg-danger-pressed` replace the hover colours. `active:transition-none` with `duration-200 ease-out`: the press shows on the first frame and fades out on release. `select-none` is in the base. `-webkit-touch-callout:none` is on a real `<button>` only, so a link drawn as a button keeps its menu. White text 10.35:1 and 14.67:1; rest-to-pressed step 2.25:1 (quality, recomputed). Planted faults 9 of 10 caught |
| 5 | CI | | ✅ | Green on 0cfaf78, 200 E2E passed |
| 6 | NFR-009 (DL-059) | | ✅ | `/` 197,247 B, `/queue` 198,360 B: under 200,000, but 1,640 B (0.8 %) left. RISK-020 restated, score unchanged at 12 |

**Rulings**
1. **STD-06 (Minor), fixed now.** Rename `BUTTON_ONLY` to `NO_TOUCH_CALLOUT` in `button.tsx`. The branch must be updated from `master` before G7 anyway, so the rename costs one commit and no extra wait. Behaviour does not change, so master verifies it within that one file, with no re-review (DL-047). QA's phone check then runs on the final head.
2. **STD-01: unchanged.** PR #56 is a code PR, merged by the delivery lead whatever its prefix (DL-069).
3. **PRF-04 (Minor): not in this PR; the #61 cut is assigned (DL-080).**
4. **Merge order: PR #65 (DEF-009) before PR #56 (DL-079).** PR #56 lengthens every button's fade to 200 ms. Without #65's wait, the sign-in axe test's mid-fade window gets wider and DEF-009 comes back.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #56: `src/components/ui/button.tsx` | Rename `BUTTON_ONLY` to `NO_TOUCH_CALLOUT` (STD-06), one commit. Update the branch from `master` (15cd9cb or later). CI green | Before G7 attempt 2 |
| 2 | master | Same | Verify: the rename touches only that file and is name-only; the update from `master` brings no product change into this PR's own diff; CI green | Before G7 attempt 2 |
| 3 | qa-engineer, with the delivery lead | AQP-183; `docs/07-qa/AQP-183-test-report.md` | G7 evidence on the final head, below | G7 attempt 2 |

**G7 attempt 2 evidence (all mandatory for the GO).** The delivery lead's own typed words for each item; no drafted reply (DL-007). The same iPhone that found DEF-008 and DEF-010, `/design-system` section 05, served from the final head:
- **(a) Hold** Calculate (primary) and Delete (danger) for about a second each: the darker pressed fill is clearly visible.
- **(b) Quick tap** Calculate and Delete: a visible brief flash.
- **(c) Long press** (about 2 seconds) on Calculate, on Delete, on a disabled button and on a loading button: **no text selection and no copy callout or magnifier**, and the disabled and loading buttons still show no pressed state.
- **(d)** `npx playwright test tests/e2e/button-pressed.spec.ts --retries=0` on the three projects, 0 failures; and the CI run on the final head green through stage 12.

Not required: re-checking secondary, ghost or the pencils, which passed at attempt 1 and are unchanged. A failure in (a) to (c) goes back to the ux-expert, as at DL-078. Then the delivery lead merges, after PR #65.

**Risks registered:** RISK-020 restated, score unchanged at 12.
**Rationale:** No Blocker, Critical or Major. The new values are the ux-expert's, implemented exactly, with contrast that leaves no doubt. What only the phone can show is shown at G7 by the person who found the defect. The one Minor costs nothing in a branch update that has to happen anyway.

---

## G7 – QA Acceptance — AQP-182 (test reliability 2: DEF-004, DEF-007) — 2026-11-04

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR:** #57, `fix/AQP-182-test-reliability-2` at head 094b599. The PR diff against `master` 85c699f, read with `gh api compare`, is 10 files:
    - tests: `tests/e2e/shell.spec.ts`, `tests/support/git-ignore.ts`, `tests/support/process.ts`, four unit test files;
    - QA: the report and the DEF-011 and DEF-012 records.
    - No `src/` file.
  - **CI:** run 41879256111 on 094b599, success. Run 41868765137 on db768eb (the update from 85c699f), success. Merge state **behind** (PR #66, docs only).
  - **QA:** `docs/07-qa/AQP-182-test-report.md` at 094b599, read in full; DEF-011 record (AQP-186, #67); DEF-012 (AQP-187, #68). G6 evidence set: DL-068.
  - **Not done:** no test run of my own; the probe results are QA's.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every item verified with evidence | ✱ | ✅ | DEF-004 and DEF-007 have no ACs; the G6 evidence set (a) to (c) stands in. See rulings 1 to 3 for (a) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | None. DEF-011 and DEF-012 are Sev-3 |
| 3 | Regression recorded and green | ✱ | ✅ | CI green on 094b599 and on db768eb |
| 4 | Exploratory and controls | | ✅ | A planted 1 px drawer fault failed 6 of 6. With git broken live, the suite errors and no test passes; with the fix undone, QLT-25 fails |

**Rulings**
1. **Condition (a) is met in purpose, not in its wording, and that does not hold G7.**
   - (a) existed to show that the DEF-004 width check is reliable and still catches a real fault. It does: 59 of 59 where the drawer opened, and the 1 px fault was caught 6 of 6.
   - The 9 failures, 3 and 6 across the two series, are all one other cause in `openDrawer`. It happens before the width check runs.
   - It is not overload: series 2 was on a quiet machine and failed more often. A probe shows it: a click before hydration is lost.
   - Same treatment as DEF-006 at AQP-106 (DL-063): a real defect outside what the evidence was for gets its own record and owner instead of holding this gate.
2. **(b) is met.** `env-example`, `server-only` and `data-files` had 0 failures in 10 loaded runs, and there was no `ProcessStartError`. The two `tokens.test.ts` time-outs are DEF-012, in a file this PR does not touch.
3. **(c) is met.**
4. **DEF-004 (AQP-179, #43) and DEF-007 (AQP-182, #52) close.** QA closes them on this decision.
5. **DEF-011 is split (DL-083).**
   - **The test part stays DEF-011:** Sev-3, type Test. `openDrawer` clicks once after `load`, so the suite fails about once in 30 to 60 drawer tests and hides evidence.
   - **The product part is new, DEF-013:** Sev-3, type Product, origin AQP-28, raised by QA. A real person who taps "Open menu" before hydration gets nothing and must tap again. That is "a state that does not mislead about a price, every action reachable", which is Sev-3 on the test-plan scale, not Sev-4.
   - The hydration gap grows with JavaScript size and slow phones (RISK-020, the LCP baseline), and the #61 lazy-load also changes what a first tap does. So the solution-architect decides the pattern for every client-only trigger together with the #61 story's ACs, and the ux-expert words any "not ready" state.
6. **DEF-011 (test part) and DEF-012 are one class and one fix (DL-057).** The developer fixes both in one test-only PR:
   - wait for the page to be interactive before the first click, with no longer time limit and no retry;
   - read the files once in `beforeAll` in `tokens.test.ts`, under the shared hook limit.

   G6 needs all three reviews (DL-032). G7 uses the DL-077 evidence: CI green, plus `shell.spec.ts -g "drawer" --repeat-each=15 --retries=0` with 0 failures, plus ten loaded `tests/unit` runs with 0 `tokens.test.ts` failures. Due before sprint 1 ends, and not after AQP-169's G7, whose evidence includes E2E runs on the same shell.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | orchestrator | PR #57 | Update from `master` (15cd9cb, docs only) through GitHub; CI green on the new head. No re-check by master unless the update brings a conflict or a non-docs change into this PR's own diff | Before the merge |
| 2 | qa-engineer | AQP-179, AQP-182; #43, #52 | Close DEF-004 and DEF-007; move AQP-182 to Done | Now |
| 3 | qa-engineer | New DEF-013 (Jira Bug, GitHub `bug`, `sev-3`), linked to AQP-28 and AQP-186 | The product part of ruling 5, type Product | Now |
| 4 | developer | One test-only PR | DEF-011 (test) and DEF-012, as in ruling 6 | Before sprint 1 ends; before AQP-169's G7 |
| 5 | solution-architect, then ux-expert | DEF-013; the #61 story's ACs | Pattern for a tap before hydration on client-only triggers (drawer, account menu), decided with the lazy-load design | Before the #61 story reaches Ready; fixed before G8 (test plan service level) |

The delivery lead merges PR #57 after condition 1 (test code, `MERGE_POLICY` code-human).

**Risks registered:** none new. RISK-020 is linked to DEF-013: more JavaScript means a longer window in which taps are lost.
**Rationale:** Both defects this PR fixes are shown fixed by controls that fail when the fix is undone. The one unmet wording comes from a third defect that the evidence uncovered. It is real and now owned, and a quiet-machine probe proved it is not overload. Holding this PR for it would keep two verified fixes off `master`, and gain nothing.

**AQP-183 G6 re-check, condition 2 (STD-06 rename) verified — 2026-11-04 (master).** Commit 001e521 "refactor(ui): name the button-only touch callout class NO_TOUCH_CALLOUT [AQP-183]". It is a fast-forward from 0cfaf78: one commit ahead, with 0cfaf78 as its parent. **Result: met for the rename; the branch update is still pending.**

| Check | Result | Evidence |
|-------|--------|----------|
| File list | ✅ | `gh api compare 0cfaf78...001e521`: only `src/components/ui/button.tsx`, +2 / −2; full patch read |
| Name only | ✅ | The declaration and its one use change from `BUTTON_ONLY` to `NO_TOUCH_CALLOUT`; the value `'[-webkit-touch-callout:none]'` is unchanged; no `BUTTON_ONLY` is left in the file at 001e521. One cosmetic slip: there is no space before `=` on the declaration. No formatter is configured and lint is green, so no action |
| CI | ✅ | Run 41879322672 on 001e521: stages 1 to 12 success, stage 13 skipped (disabled); stage 12 "200 passed" |
| Branch update from `master` | ⏳ | Not yet done; merge state "behind". By order (DL-079), PR #65 merges first, then the orchestrator updates PR #56 through GitHub. Master then checks that the new head's own diff against `master` is unchanged apart from the merge, and that CI is green. **G7 attempt 2 (the iPhone check) runs on that final head, not on 001e521** |

---

## G7 – QA Acceptance — AQP-184 (DEF-009: axe scans wait for transitions) — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **QA evidence:** Jira AQP-184 10880 and PR #65 comment 6642745959, both on 09f8022.
  - **CI:** run 41868171176 on 09f8022, green, with the `axe-helper.spec.ts` control ✓ at all three widths, read at G6 attempt 1.
  - **PR #65 now:** head 1530089 is a merge of `master` into the branch. Its diff against `master` is still the same two files, `tests/e2e/axe-helper.spec.ts` (+105) and `tests/e2e/support/design-system.ts` (+33 / −2). CI on 1530089 was in progress when this was recorded.
  - **Defect:** #63 is closed as completed, and AQP-184 is Done.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | DL-077 (a): CI green with the control ✓ on every project | ✱ | ✅ | Run 41868171176 |
| 2 | DL-077 (b): repeated run, no retries, 0 failures | ✱ | ✅ | 10 counted runs of `sign-in.spec.ts` on the production build at three widths, `--retries=0`: 580 passed, 0 failed, 0 flaky. `sign-in.spec.ts:54` (axe) 10 of 10 per width, with no `color-contrast` violation |
| 3 | DL-077 (c): defect closed | ✱ | ✅ | #63 closed; AQP-184 Done |
| 4 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **Ten separate runs replace `--repeat-each=10`, accepted as meeting DL-077 (b).** The number of executions is the same. Each run's set-up clears `login_throttles`, so each repeat starts as a real first run, the same isolation the specified form would have had if the spec were repeat-safe. Under `--repeat-each`, the AC-2 and axe tests reuse fixed accounts and reach the 5-failure lock-out from repeat 6. That is the product working as AQP-38 AC-3 requires, not a fault of this fix: 49 of the first attempt's 51 failures were that, and the run was also contaminated by another agent's servers on the same ports. Repeats 1 to 5 of the axe test passed at every width in that attempt too.
2. **The overload runs were repeated, not counted (DL-068).** Runs 1 to 3 (set-up time-out; `DATABASE_BUSY` during two slow runs) were repeated; the 10 counted runs logged no server errors. Running on an isolated copy with moved ports changes nothing under test.
3. **The `--repeat-each` limitation is a follow-up, not a defect.** `sign-in.spec.ts` is not repeat-safe, because it uses fixed accounts for wrong-password cases. The developer gives each repeat its own disposable account, in the DEF-011 and DEF-012 test-reliability PR (DL-083), so `--repeat-each` can be used as the flakiness check the test plan expects. Until then, separate runs are the accepted form for this spec.

**Merge:** PR #65 may be merged by the delivery lead once CI is green on the updated head (1530089 or later). No further master check is needed unless the update changes this PR's own two-file diff. Then PR #56 is updated from `master`, as DL-079 orders.

**Risks registered:** none.
**Rationale:** The flaky scan's own test now passes 30 of 30 across widths with no retries, and the control shows the wait is what makes it pass. The one change of method keeps the same number of runs with clean isolation, and the failures it avoided were the lock-out doing its job.

**AQP-183 G6 re-check, branch update verified — 2026-11-04 (master). Head 1a785db; G6 conditions 1 and 2 are complete.** 1a785db is a merge commit (parents 001e521 and `master` 9d924a1), made through GitHub.

| Check | Result | Evidence |
|-------|--------|----------|
| The merge brings in only `master` | ✅ | `git diff 001e521 1a785db` has the same patch-id set as `git diff 85c699f 9d924a1` (PRs #66, #57 and #65), so the merge resolved nothing by hand and added nothing of its own |
| PR's own diff unchanged | ✅ | `gh api pulls/56/files`: the same 16 files and line counts as at 0cfaf78, with the 001e521 rename inside `button.tsx` |
| CI | ✅ | Run 41921509846 on 1a785db: stages 1 to 12 success, stage 13 skipped (disabled); stage 12 "215 passed". It now includes PR #65's axe wait (DL-079 order kept). Merge state clean |

**For G7 attempt 2:** 1a785db is the head for the delivery lead's iPhone check, items (a) to (d) of DL-079. A new commit on the branch before that check means the check runs on the new head.

---

## G6 – Peer Review — AQP-169 (STORY-10.10: NFR-009 guards) — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #70, `feat/AQP-169-nfr-009-guards` at head 6ae0c2f, base 9d924a1; 38 files. Merge state clean; all three review labels approved.
    - CI run 41933808548 on 6ae0c2f: success, including stage 11b. Its log shows `/` 197,116 B, `/queue` 198,229 B (headroom 1,771), `/sign-in` 160,490 B, `not-found` 135,547 B, and `/design-system` answering 404 as required.
    - Nightly run 41933808592 on 6ae0c2f: success.
  - **Reviews:** `docs/06-reviews/AQP-169/standards.md`, `quality.md` and `performance.md` (main folder, uncommitted), reviewed at 51b0954 and 4ffc016. Jira AQP-169 10893 (standards), 10894 (performance), 10895 (quality), 10898 (developer, fix round).
  - **My own check of the fix commit:** `gh api compare 4ffc016...6ae0c2f` shows one commit, parent 4ffc016, nine files. I read the full diff of the scripts, the workflow, the two hook lines and the new gzip test, and the test names in `tests/unit/measurement-user.test.ts`.
  - **Not done:** no local run.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards and quality APPROVE WITH COMMENTS, performance APPROVE |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 |
| 3 | Majors | | ✅ | None |
| 4 | Minors fixed (verified by master) | | ✅ | **STD-01:** `scripts/lib/measurement-user.ts` `assertThrowawayDatabase` allows only `localhost`, `127.0.0.1`, `::1`, `db` and `postgres`, checks every libpq `host=` override, ignores `STAGING_DB_HOST`, refuses `NODE_ENV=production`, and never prints the URL; unit tests cover a staging host, an internet host, a host override and production mode. **STD-02:** the script no longer imports `tests/support`; it uses `src/` repositories and the production hasher at a small cost for this throwaway user. **STD-03:** the header now names `*.report.json`. **QLT-45:** `hasAnyAdmin` is checked first, with a message that says what to do, and nothing changes (tested). **QLT-46:** a deterministic sample whose level 6 and level 9 sizes are asserted to differ, then `gzipBytes` equals level 9 and not level 6. **STD-06 (Info) done:** both per-file `120_000` hook limits removed |
| 5 | CI and nightly | | ✅ | Both green on 6ae0c2f |
| 6 | Calibration (AC-4) | | ✅ | Performance: figures match its hand measurement; calibration at 6f66b97 within 3 B |
| 7 | NFR-009 | | ✅ | All routes under 200,000 B; RISK-020's "no check" cause is closed |

**Rulings**
1. **My own check is enough for the fix commit; no re-review (DL-047).**
   - The commit changes CI tooling and tests, not code that ships in the product: `scripts/`, one workflow path filter (it adds the new `scripts/lib/measurement-user.ts` to the nightly trigger list, so a change to it runs the nightly), the README, and tests.
   - Each Minor's fix is specific, tested, and read in full by me.
   - DL-051 requires a re-review when fixes add product code; this adds none.
   - The one security-relevant piece, the database guard, is stricter than the test guard it replaces.
2. **Residual note on STD-01, for 10.04 (deployment).** `db` and `postgres` are also likely Compose service names on a deployed host. The guard still refuses there only because `next start` runs with `NODE_ENV=production`. So 10.04 must keep `NODE_ENV=production` in every deployed container and leave dev tooling out of the image (PRF-03: `npm ci --omit=dev` or prune). The scrum-master adds both to 10.04's Dev Context. This is not a finding against this PR.
3. **PRF-04 (empty key-screen list) is by design (AC-6) and becomes a follow-up.** The scrum-master adds "`/queue` added to `KEY_SCREENS` in `lighthouserc.cjs`, with the Wi-Fi assertions passing on the nightly" to the queue story's ACs, and the same for each later key screen (test strategy §10.4).
4. **The remaining Info items need no action:** STD-04, STD-05, STD-07 to STD-09, QLT-47 to QLT-49, PRF-01, PRF-02. QLT-49 is already covered by keeping CI as the reference.
5. **The developer followed the story's ACs (Lighthouse, nightly, CI time) beyond the orchestrator's narrower brief, which was right.** The Jira story is the specification (CLAUDE.md §1); a brief cannot narrow it.

**G7 evidence (a full QA cycle; this is a story, not a test-only defect):**
- **AC-1, AC-3:** the stage 11b table on the final head, with every route measured, and the limit-table unit test.
- **AC-2, negative:** the integration test cases (a lowered limit, a non-200 answer, `not-found` on 200 fails), plus one QA probe of each kind against the real script.
- **AC-4:** the calibration figures recorded in the PR, checked against 184.6 KB and 135.1 KB (within 1 KB).
- **AC-5:**
  - the negative-control run link (a lowered limit fails at 11b, never merged);
  - the job time of this PR against the last green `master` run, with the difference under 60 s;
  - `ci-workflow.test.ts` green.
- **AC-6:** the configuration test, the licence check, and `allowScripts` green.
- **AC-7:**
  - the nightly run's artefact (30 days) and its summary table;
  - the permissions are `contents: read` and `actions: read` only;
  - every action is pinned to a SHA, and the log holds no secret;
  - the 25 % rule's unit test.
- **AC-8:** the CI-time step output (p95, median, number of runs).
- **AC-9:** QA runs the Lighthouse job on the reference runner against `/`, signed in, on the Wi-Fi profile with 5 runs, and records the median LCP, median TBT, B0, the Chromium version and the run link. This goes to the product-manager and master for RISK-020 (falls to 6 if the targets are met, DL-058). A miss is reported, not failed.
- **Setting B0:** `LIGHTHOUSE_B0` is a repository variable. QA records the value; an agent does not set repository settings, so the delivery lead sets it (Settings → Secrets and variables → Actions → Variables, name `LIGHTHOUSE_B0`, value the median `benchmarkIndex` from AC-9). That is due before the first key screen's G6, not before this G7.
- **Exploratory:** the README's local path against a database that already has the bootstrap Admin gives the QLT-45 message.
- **Regression:** CI green on the final head.

**Risks registered:** none new. RISK-020 is restated: its "no check" cause is closed; headroom is still 1,771 B on `/queue` (`master`), about 1,640 B after PR #56. AC-9 decides the score.
**Rationale:** Every Minor is fixed in a commit I read in full, and none of it ships in the product. The check measures what NFR-009 says, calibrated within 3 B. What only G7 can show is the baseline on the reference runner, and QA owns it.

---

## G7 – QA Acceptance — AQP-169 (STORY-10.10: NFR-009 guards) — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #70 at head 1cebaaa, one commit after 6ae0c2f (G6), adding only `docs/07-qa/AQP-169-test-report.md` (`gh api compare`). Merge state clean. CI run 41936010911 on 1cebaaa: success.
  - **QA:** Jira AQP-169 10906; the report, read for AC-4, AC-5 and AC-9.
  - **Nightly:** run 41933808592, attempt 2 (on 6ae0c2f). Its log summary shows `/` Wi-Fi 5 runs, median LCP 235 ms, TBT 19 ms, median `benchmarkIndex` 1994 as rounded in the summary (QA reads 1993.5 from the report files), Chromium 156.0.0.0. Slow 4G (report only): LCP 673 ms, TBT 19 ms.
  - **Not done:** no run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | AC-1 to AC-8 pass in the report. AC-5: negative control run 41927422200 fails at 11b; the step adds about 2 s against `master` CI 41921471225. AC-9 reported as specified (not asserted) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | No defects |
| 3 | Regression recorded and green | ✱ | ✅ | CI 41936010911 on the final head |
| 4 | Exploratory | | ✅ | The README's local path with an existing Admin gives the QLT-45 message |

**Rulings**
1. **AC-4 not re-run by QA: accepted.** Two independent measurements, the developer's and reviewer-performance's by a different method (10894), agree within 3 B, well inside the AC's 1 KB. A third local Turbopack build of an old commit on the shared PC would add load and no information.
2. **`LIGHTHOUSE_B0` is a post-merge task for the delivery lead, not a merge prerequisite.** Until it is set, each nightly run reports itself as a baseline run and no "not comparable" mark is made; nothing fails and no pull request is blocked. Due before the first key screen's G6, as set at G6 (DL-086). Value: **1993.5**, QA's median from the report files. `parseBaseline` accepts a decimal. The summary's rounded 1994 would do equally well, since the rule is a 25 % band.
3. **RISK-020 falls to 6 (P 2 × I 3), by its own pre-stated rule** ("falls to 6 once a Lighthouse run on reference hardware meets the targets for the shell", DL-058). The shell on `/` measured LCP 235 ms against 2,000 and TBT 19 ms against 200, on the Wi-Fi profile with 5 runs.
   - **Limits, stated:** simulated throttling on a GitHub-hosted runner, not a phone; `/` only; no key screen is asserted yet (PRF-04).
   - **What remains is headroom, not speed.** `/queue` has 1,771 B, and stage 11b now stops a breach at the pull request, so it is found early. The schedule side is RISK-022 and AQP-188.
   - **For the product-manager:** the PRD says the 200 KB budget is reviewed after this baseline. The margin is large (LCP about 12 % of the target), so a raised limit is a legitimate question for them under AC-3's rule (a recorded decision on a Lighthouse run that met the targets). It would not replace AQP-188's floor, which DL-081 set. Master does not propose a figure.

The delivery lead merges PR #70 (code-human). After the merge, AQP-188 may start (DL-080, DL-081).

**Risks registered:** RISK-020 restated, 12 → 6.
**Rationale:** Every AC is shown, the check is calibrated by two independent methods, and the baseline sits far inside the targets. B0 only labels later runs, so it is a setting to make soon, not a reason to hold the merge.

---

## G6 – Peer Review — AQP-186 and AQP-187 (DEF-011 test part, DEF-012) — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #71, `fix/AQP-186-187-test-timing` at head b3f38ad, base 9d924a1. Eight files, all under `tests/`. CI run 41935989250 on b3f38ad: success. The log shows the late-scripts test `shell.spec.ts:115` ✓ on mobile and tablet and skipped on desktop, which has no drawer. Labels: all three approved. The base is behind `master` 908459b (#70).
  - **Reviews:** `docs/06-reviews/AQP-186/standards.md`, `quality.md`, `performance.md` (main folder, uncommitted), reviewed at fb472a3 and 1d9285c; Jira 10899, 10901, 10903; developer 10908.
  - **My own check of the fix commit:** `git diff 1d9285c b3f38ad`, five test files, read in full.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards and quality APPROVE WITH COMMENTS, performance APPROVE |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 |
| 3 | Minors fixed (verified by master, b3f38ad) | | ✅ | **STD-01:** the doc comment moves to `ensureE2eUsers`, and `connectToTestDatabase` gets its own. **QLT-51:** `waitUntilHydrated(page, selector, handler)` now takes the prop to wait for. `signInThroughThePage` waits for the form's `onSubmit`, and the new `waitUntilAccountMenuIsLive` waits for the Radix trigger's `onPointerDown` before each account-menu click (`design-system.spec.ts`, `sign-in.spec.ts` twice, `aqp-38-qa.spec.ts`). **QLT-50:** a comment names the React private-key dependency and what to re-check on a React upgrade. No retries or longer limits are added |
| 4 | DEF-012 | | ✅ | `tokens.test.ts` reads its files once in `beforeAll` under the shared hook limit, with a guard against an empty scan (QLT-53) |
| 5 | DL-085 follow-up | | ✅ | f17378a: a throwaway account and address per run, so `sign-in.spec.ts` is repeat-safe (QLT-54) |
| 6 | CI | | ✅ | Green; about 2 s added (PRF-01) |

**Rulings**
1. **My own check is enough for b3f38ad; no re-review (DL-047).** It is test-only, five files, read in full, and it applies the same wait the reviewers already approved to the other first-click sites.
2. **`aqp-38-qa.spec.ts` is QA's spec.** The developer added one wait before its account-menu click. QA confirms at G7 that the test's intent is unchanged.
3. **QLT-50 and STD-03 (React's private key):** accepted. It fails loudly, never falsely. The product-side signal is the architect's under DEF-013.
4. **Remaining Info items need no action:** STD-02, STD-04, STD-05, QLT-52 to QLT-54, PRF-01 to PRF-03. QLT-52's missing negative control is covered at G7 by a planted fault (below).

**G7 evidence (DL-077, for test-only defects; DL-088):**
- **(a) CI green on the final head**, after the update from `master` (908459b or later, so stage 11b runs too). The late-scripts test `shell.spec.ts:115` must be ✓ on mobile and tablet, read in the log.
- **(b) `npx playwright test tests/e2e/shell.spec.ts --repeat-each=10 --retries=0`** at all three widths on an **unloaded** machine against the production build: **0 failures.**
  - Every time-out is classified, as reviewer-quality advises. A **stall** is a time-out inside the hydration wait; a **lost click** is a time-out on the drawer after the click.
  - A lost click fails the evidence.
  - A stall on an unloaded machine also fails it, because it would mean hydration did not come.
  - A stall during recorded load is Environment, and the run is repeated (DL-068).
- **(c) Planted fault:** remove the `waitUntilHydrated` call from `openDrawer` and run `shell.spec.ts:115` on mobile; it must fail. Then restore it. This is QLT-52's missing control.
- **(d) `npx playwright test tests/e2e/sign-in.spec.ts --repeat-each=10 --retries=0`** at three widths with 0 failures. This shows the spec is now repeat-safe (DL-085) and that QLT-51's form wait holds.
- **(e) Ten loaded `npx vitest run tests/unit` runs** under the DEF-003 load (`tsc`, `eslint` and `next build` looping) with **0 `tokens.test.ts` failures**. Any other failure is classified and recorded. Environment failures are repeated, not counted.
- **(f)** QA confirms `aqp-38-qa.spec.ts` keeps its intent, then closes DEF-011 (AQP-186, #67) and DEF-012 (AQP-187, #68). DEF-013 (Product) stays open with the solution-architect.

These go as a Jira comment on AQP-186, with no test-report file. The delivery lead merges after G7 (test code, code-human).

**Risks registered:** none.
**Rationale:** Both defects are fixed at their cause, with no longer limits and no retries. The same fault is closed at every first-click site the quality review found, and the sign-in spec is now repeat-safe. G7 has to show it under repetition and with a planted fault, because these defects appear only by chance.

---

## G7 – QA Acceptance — AQP-186 and AQP-187 (DEF-011 test part, DEF-012) — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #71 at head 5680936, a merge of `master` 908459b into b3f38ad (`gh api compare b3f38ad...5680936`: #70 and the merge only). Still 8 files, all under `tests/`. CI run 41955225750 on 5680936: success. Merge state clean.
  - **QA:** Jira AQP-186 comment 10912, read in full. #67 and #68 closed on 2026-11-05 03:25 to 03:26Z.
  - **Not done:** no run of my own.

| # | DL-088 item | Mandatory | Result | Evidence |
|---|-------------|-----------|--------|----------|
| 1 | (a) CI with the late-scripts test ✓ | ✱ | ✅ | 41955225750: stage 11b green; stage 12 172 passed, 0 flaky; `shell.spec.ts:115` ✓ on mobile and tablet |
| 2 | (b) `shell.spec.ts` ×10, three widths, 0 lost clicks | ✱ | ✅ | 270 passed, 1 failed; lost clicks 0. Ruling 1 covers the one failure |
| 3 | (c) Planted fault | ✱ | ✅ | With the hydration wait removed, `:115` fails at the drawer check ("not found"), which is a lost click; with it restored, it passes |
| 4 | (d) `sign-in.spec.ts` ×10 | ✱ | ✅ | 571 passed, 0 failed, 0 flaky; the same command on 09f8022 locked out from repeat 6 |
| 5 | (e) Ten loaded unit runs | ✱ | ✅ | 1,643 of 1,643 each; `tokens.test.ts` 64 of 64 in all ten, at an average CPU of 94 % |
| 6 | (f) Spec intent and closure | ✱ | ✅ | `aqp-38-qa.spec.ts`: one wait plus its import, intent unchanged. DEF-011 and DEF-012 closed |
| 7 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **The one failure in (b) is Environment, repeated, not counted.** It was at tablet `:176`, repeat 6, at the second `openDrawer`.
   - It is neither of DL-088's two kinds. The hydration wait had passed, and `locator.click` timed out at "locator resolved", before any click was attempted. A page that does not answer an action is not a lost click, which would have failed later at the drawer check.
   - It happened at recorded CPU 100 % with 0.78 GB of 7.8 GB free. That is the test run's own load on a PC whose memory is always tight. No other workload ran, so the machine was "unloaded" in the sense DL-088 meant.
   - Its 10-repeat retest passed 10 of 10.
   - DL-088's purpose was to tell a lost click (this defect) from a machine stall. There were 0 lost clicks, and (c) shows the series would have caught one. **Standard from now on:** a time-out after the hydration wait but before the click is attempted counts as a stall.
2. **QA closing DEF-011 and DEF-012 before this decision is ratified, with nothing reversed.** DL-077 (c) and DL-088 (f) make the closure part of the G7 evidence itself, as at AQP-184. Had this decision been NO-GO, QA would have reopened them.
3. **The repeated (e) series is accepted.** The first series failed in three files because QA's archive copy had no `.git`. That is Environment caused by the set-up, and the whole series was repeated after `git init`. Even that first series had 0 `tokens.test.ts` failures.

The delivery lead merges PR #71 (test code, code-human). DEF-013 (AQP-197, #69, Product) stays open with the solution-architect and is fixed before G8.

**Risks registered:** none. One observation goes into the shared-PC limit already recorded at DL-068: this PC's free memory, 0.4 to 1.4 GB of 7.8 GB with no other workload, is the main source of Environment failures in local evidence. CI remains the reference.
**Rationale:** Every item of the evidence set is met. A planted fault shows the series catches the defect, and the one failure has a recorded cause that is not this defect. Both test defects close with their causes removed, not with retries or longer limits.

---

## G7 – QA Acceptance — AQP-183 (DEF-008, DEF-010: pressed state) — attempt 2 — 2026-11-04

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (attempt 1 NO-GO, DL-078)
- **Artefacts evaluated:**
  - **PR and CI:** PR #56 at head c4d0d65, one commit on 1a785db (cleared at the G6 re-check) adding only `docs/07-qa/AQP-183-test-report.md` (`gh api compare`). CI 41963075513 on c4d0d65: success. PR #56 is behind `master` (now 8be2b24).
  - **QA:** Jira AQP-183 10915; the report's attempt 2 section, read for the environment and OBS-4.
  - **Provenance:** checked in the session log by role. Every device answer is typed user text with no earlier draft: "same behavior as last time" (23:10:06Z), "yes, I did get the sign-in page first" (23:11:39Z), "looks good now" (03:34:27Z), "clearly darker color" (03:35:00Z), "brief flash when I tap" (03:35:25Z), "doesn't get selected" (03:38:16Z).
  - **Not done:** no run of my own.

| # | Check (DL-079 (a) to (d)) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | (a) Hold Calculate and Delete: clearly darker | ✱ | ✅ | Later session: "yes, it turns a clearly darker color as expected when I hold it" |
| 2 | (b) Quick tap: brief flash | ✱ | ✅ | "yes, I see a brief flash when I tap" |
| 3 | (c) Long press on Calculate, Delete, a disabled and a loading button: no selection or callout, no pressed look on the last two | ✱ | ✅ | "The text doesn't get selected or highlighted, as expected - No - No, it doesn't" (Approve and lock, Calculating) |
| 4 | (d) E2E `--retries=0`, three widths; CI | ✱ | ✅ | 45 of 45 on 1a785db; CI green on 1a785db and c4d0d65 |
| 5 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **OBS-4 does not hold G7, and no extra evidence is required before the merge.**
   - In the first session (23:10Z) the delivery lead saw the old look on Calculate and Delete. At the same moment the PC showed the new colour from the same development server, so the server was serving the new code. They confirmed they reached the page through sign-in, which the old version did not have.
   - The diagnostic that would have separated a stale page from a WebKit fault (hold Add part) was not answered in that session. In the later session, with no code or server change in between, everything passed. That fits a stale copy on the phone from the attempt-1 session on the same port, but it is **not confirmed**.
   - Why GO: the acceptance check passed in their own words on the commit under test, and the E2E proves the values are applied. DEF-010 is Sev-3. And the alternative cause, `:active` sometimes not applying on iOS, would show again in normal use, where it is cheap to catch.
2. **Follow-up, not a condition:** a one-line check at the next scheduled phone session. That is DEF-013's verification, or the first deployed build under 10.04, whichever comes first. QA opens `/design-system` (or the first real screen with a primary button) on the iPhone after a full reload and holds Calculate. If the old look appears again, DEF-010 reopens, and the solution-architect decides on G6 condition 4's passive `touchstart` listener (WebKit bug 138816), which DL-078 closed as not needed.
3. **DEF-008 (#54) and DEF-010 (AQP-185, #64) close on this decision; QA closes both.** DEF-008 was reopened at attempt 1, and DEF-010 is its design-level cause.

**Before the merge:** update PR #56 from `master` (8be2b24 or later) through GitHub, with CI green, including stage 11b. `/queue` was 198,229 B on `master`, and this PR adds about 131 B. The check now enforces the 200,000 B limit itself. No master re-check is needed unless the update changes this PR's own diff. Then the delivery lead merges (code PR, DL-069).

**Risks registered:** none new.
**Rationale:** The defect is about what a person sees when they press. The person who found it now sees it on the commit under test, and the automated test shows the values are applied. One earlier contrary report has a plausible, unconfirmed cause. It is recorded, given a cheap re-check at a session that will happen anyway, and tied to a decision path if it recurs.

---

## G6 – Peer Review — AQP-188 (STORY-10.13: lazy account menu and drawer; DEF-013 early tap) — 2026-11-05

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #75 at head 6030585, base f5af00a, 24 files. Merge state clean; all three review labels approved.
    - CI 41978784135 on 6030585: success. Stage 11b, read in the log: `/` 160,642 B, `/queue` 161,755 B (headroom 38,245), `/sign-in` 160,674 B, `not-found` 135,547 B.
    - AC-10 evidence: run 41974232482 on 2b10890 (the code at 7327fd7 plus a temporary CI edit, reverted in 3142157), 20 runs per width, success.
  - **Reviews:** `docs/06-reviews/AQP-188/*.md` (main folder, uncommitted), reviewed at 3142157; Jira 10923 to 10925; developer 10927; ux-expert glance 10926.
  - **My own check:** `git diff 3142157 6030585`. Source: `account-menu-panel.tsx`, `app-shell.tsx`, `use-first-open.ts` (+29 / −5), read in full. Tests: the E2E spec split into `shell-lazy-load.spec.ts` and `shell-first-open.spec.ts`.
  - **Not done:** no local run.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards and quality APPROVE WITH COMMENTS, performance APPROVE |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | Minors fixed | | ⚠️ | **STD-02:** the 447-line spec is split in two (test code, verified). **QLT-55:** the keyboard first-item focus applies to the mounting open only (`openedByKeyboard` held in a ref). **QLT-56:** closing the drawer, including on widening to 1024 px, also cancels a pending first open (new `cancel` on `useFirstOpen`). Both are product-code changes with E2E tests, so the finding owner confirms them (condition 1) |
| 4 | AQP-188 AC-1 floor (190,000 B, DL-081) | | ✅ | `/queue` 161,755 B; every signed-in route under 190,000 B |
| 5 | Planted faults | | ✅ | 17 of 17 caught (QLT-59) |
| 6 | CI | | ✅ | Green, 301 E2E tests passed |

**Rulings**
1. **QLT-55 and QLT-56 changed behaviour in product code, so a narrow re-review applies (DL-051), not master's check alone.** It is narrow because the change is about 30 lines and each fix has a test:
   - reviewer-quality confirms both fixes in `3142157..6030585`;
   - standards and performance do not re-run. No `.github` file changed, and first-load JS moved by about 115 B.
   - **One point for quality to look at:** `onOpenAutoFocus` is now passed by spreading an object, to get past Radix's public types. The code comment says the AC-4 E2E fails if a Radix upgrade stops forwarding it.
2. **QLT-58 is recorded under AC-9 as not weakened.**
   - `waitUntilAccountMenuIsLive` now waits for `onClick` on the first-load button, which is correct before the first open only.
   - `design-system-route.test.ts` now names `portal-frame-props.tsx`, where the production gate moved. That is a relocation, not a weakened test.
3. **STD-01 is a follow-up for the CSP story.** The early-intent inline script must be allowed by a nonce or a SHA-256 hash, **never `'unsafe-inline'`**. The solution-architect writes this into architecture §10 before any CSP work. STD-03, STD-04 and STD-05: no action.
4. **STD-06: squash merge.** The delivery lead squash-merges, as policy already says, so the temporary CI edit (2b10890) and its revert (3142157) leave no trace on `master`. For future evidence runs, use `workflow_dispatch` or a throwaway PR, never an edit to the required workflow on a story branch.
5. **The DoR's iPhone hold check of the account trigger moves from "before G6" to G7, together with DL-090's Calculate re-check and DEF-013's real-device tap, in one session.**
   - Nothing in code review depended on it. Its result can only change the trigger's pressed look or callout, which is a G7-level fix.
   - Holding G6 for a phone session would cost the delivery lead an extra session for no review value.
   - This deviation from the DoR is recorded here.
6. **UX-01 to UX-03 (ux-expert, minor) and the SCR-25 mock-ups in docs PR #76 do not hold G6.** The ux-expert routes the three items.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | reviewer-quality | PR #75, `3142157..6030585` | Confirm QLT-55 and QLT-56 fixed, as a COMMENT review plus Jira note. A new Blocker, Critical or Major goes back to master | Before G7 |
| 2 | solution-architect | Architecture §10 | STD-01: the CSP allows the early-intent script by nonce or hash, never `'unsafe-inline'` | Before the CSP story reaches Ready |

**G7 evidence (a full QA cycle; DL-091):**
- **(a)** Every AC with evidence on the final head; CI green, including stage 11b, with every signed-in route ≤ 190,000 B (AC-1).
- **(b) AC-10 again on the final head.** The 20-run evidence predates the fix round's source change. QA runs the early-tap and first-open specs with `--repeat-each=10 --retries=0` at three widths against the production build: 0 failures, each time-out classified as in DL-089. Overload is repeated, not counted.
- **(c)** QLT-55 and QLT-56 by hand: a keyboard first open, then a pointer open (focus stays on the menu); and a slow first drawer open, then a widen to 1024 px (no drawer, focus not lost).
- **(d) One iPhone session with the delivery lead,** answers in their own typed words:
  - hold the account trigger: the pressed look shows, with no text selection or callout (the DoR item);
  - after a full reload of `/design-system`, hold Calculate: the darker pressed look (DL-090);
  - DEF-013: after a full reload of `/queue`, tap "Open menu", then (after another reload) the account trigger, as soon as each appears, three tries each. The drawer or menu opens with no second tap. This is best effort on a fast network; the E2E early-tap tests remain the main evidence.
- **(e)** QA closes DEF-013 (AQP-197, #69) if (b) and (d) pass.

**Risks registered:**
- **RISK-020** restated: it falls from 6 to 3 (P 1) when PR #75 merges and stage 11b on `master` shows the headroom.
- **RISK-022** restated: it closes when PR #75 merges, because both enablers in series will then be done.

**Rationale:** The cut meets its target, about 38 KB of headroom against the 10 KB floor, with no Blocker, Critical or Major. The two behaviour fixes are small but are product code, so the reviewer who found them confirms them. Everything that needs a phone goes into one G7 session.

**AQP-188 G6 conditions verified — 2026-11-05 (master). Result: met; G6 is closed and the story may go to G7.** The head is unchanged at 6030585.

| Condition | Result | Evidence |
|-----------|--------|----------|
| 1 reviewer-quality confirms QLT-55 and QLT-56 | ✅ | Review 5780745896 on 6030585; Jira 10930. Both fixed, each with a test that fails on the old code; QLT-57 closed. New items are Info only: QLT-60 (the QLT-56 test's final check is sound) and QLT-61 (below) |
| 2 STD-01 rule in architecture §10 | ✅ | Architecture v0.18 (main folder, uncommitted; line 1275 and the change log). The CSP allows `EARLY_INTENT_SCRIPT` by SHA-256 hash, never `'unsafe-inline'`. Four points for the CSP story: the hash computed in code; the rendered text equal to the constant; a header test with no `'unsafe-inline'`; AC-10 green with the policy on (Jira 10929). The scrum-master carries them into the CSP story |

**QLT-61 is tracked as GitHub #77** (follow-up, ai-delivery): a typed `onOpenAutoFocus` prop on the shadcn `DropdownMenuContent` wrapper. It is due with the next change to that wrapper or before the next Radix upgrade, and holds no gate.
**Before the merge:** PR #75 is behind `master` (PR #56 was merged as 8976997; docs PR #76 as 4bfe836). Update it through GitHub, with CI green including stage 11b, before the squash merge after G7. The G7 evidence set in DL-091 is unchanged. DL-090's Calculate re-check now runs on merged code, which is the intent.

---

## G7 – QA Acceptance — AQP-188 (STORY-10.13: lazy account menu and drawer; DEF-013) — 2026-11-05

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #75 at head fb96b29, merge state clean. Since G6 (6030585) there are two commits:
    - 2e0fac6 merges `master` 4bfe836. It brings in exactly that commit's nine `docs/03-ux/` files (docs PR #76), compared file by file with `gh api`.
    - fb96b29 adds only `docs/07-qa/AQP-188-test-report.md`.
    - Product code is unchanged since the G6 check. CI 41995977635 on fb96b29: success.
  - **QA:** Jira AQP-188 10932; the report.
  - **Provenance:** the iPhone answers, checked in the session log by role, are nine typed replies between 08:29:29Z and 08:36:42Z (eight "yes", one "No"). They are answers to closed questions, so they are list-wording replies. They stand under DL-007 (1): no price depends on them, and the E2E evidence decides the same points independently.
  - **Not done:** no run of my own.

| # | DL-091 item | Mandatory | Result | Evidence |
|---|-------------|-----------|--------|----------|
| 1 | (a) Every AC on the final head | ✱ | ✅ | AC-1 to AC-10 pass; `/` 160,642 B, `/queue` 161,755 B, `/sign-in` +77 B; CI green with stage 11b |
| 2 | (b) AC-10 again on the final code, ×10, no retries | ✱ | ✅ | First-open 341 of 341 and lazy-load 501 of 501, with no time-outs to classify |
| 3 | (c) QLT-55 and QLT-56 by hand | ✱ | ✅ | Both verified |
| 4 | (d) iPhone session | ✱ | ✅ | All 9 answers as expected. Account trigger held: darker, with no selection or callout (the DoR item). After a full reload, Calculate clearly darker (**DL-090's re-check passes; OBS-4 closed; DEF-010 stays closed**). DEF-013: "Open menu" and the account trigger each opened on the first tap, 3 of 3 |
| 5 | (e) DEF-013 | ✱ | ✅ | Closes on this decision (AQP-197, #69) |
| 6 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **DEF-013 (AQP-197, #69) closes, and QA closes it.** The automated early-tap tests are the main evidence. The phone taps confirm the behaviour on a real device.
2. **DL-090's follow-up is done.** OBS-4 is closed as a stale page, because the darker look held after a full reload. The `touchstart` question stays closed.
3. **RISK-020 lowered to 3 and RISK-022 closed now, at G7 GO, not at the merge.** Only the delivery lead's squash merge remains, CI on fb96b29 already measures the headroom, and nothing in the PR can change before the merge. **If PR #75 is not merged by the sprint 1 review, both are restored.**
4. **The PR description restore is recorded.** PR #75's description had been overwritten with PR #76's text at 06:24 UTC. The orchestrator restored the 05:50 version and added a review-round note. A PR description is the Dev Record (CLAUDE.md §7.1), so the delivery lead should read the restored version before merging.

**Merge:** the delivery lead squash-merges PR #75 (STD-06). After it, stage 11b on `master` should show `/queue` near 161,755 B.

**Risks registered:** RISK-020 12 → 6 → 3 (P 1); RISK-022 closed.
**Rationale:** Every evidence item set at G6 is met on code that has not changed since review. The repeat series ran with no time-outs, and the phone confirmed both the early tap and the earlier unexplained pressed-state report. The JS headroom target is met with room to spare.

---

## G6 – Peer Review — AQP-48 (STORY-01.02: role enforcement and navigation per role) — 2026-11-05

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #79 at head 5208f6e (b72ab88 plus docs-only `master` merge #78), base 2c941c1, 46 files. Merge state clean; all three review labels approved. CI on 5208f6e: run 42015140696, attempt 1, success.
  - **Reviews:** `docs/06-reviews/AQP-48/standards.md`, `quality.md` and `performance.md` (main folder, uncommitted), all reviewed at 5208f6e; Jira 10941 to 10943.
  - **Other roles:** architect, Jira 10940 (architecture v0.19 §6, TD-06, #80); ux-expert, Jira 10939 (ux-spec v0.12, SCR-26 button wording).
  - **Story:** AQP-48 ACs read on Jira.
  - **Not done:** no local run; I did not read the code diff myself. The rulings rest on the cited file and line references.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | Minors | | ⚠️ | STD-01, PRF-01 and QLT-62 are fixed in this PR (rulings 1 to 3) |
| 4 | NFR-009 (stage 11b; AQP-188 floor of 190,000 B, DL-081) | | ✅ | Largest route `/queue` 166,544 B; every route under 190,000 B |
| 5 | UX conformance | | ⚠️ | The SCR-26 button says "Go to your tasks"; ux-spec v0.12 says otherwise (ruling 4) |
| 6 | CI | | ✅ | Green on 5208f6e |

**Rulings**
1. **STD-01 is fixed now.** `withRoute` (`src/server/http/with-route.ts:155, :161`) logs the whole error. The message, stack and cause can carry query values, such as an e-mail, from a Prisma message, and redaction by key cannot scrub message text. Coding standards §4 forbids personal data in logs, and PR #58's STD-19 policy (name and code only) already applies to sign-in. Every API route goes through this wrapper, so the leak would reach every future route.
   - **Fix:** log `errorName` and `errorCode` only.
   - **Test:** an error whose message contains an invented e-mail must not have the e-mail appear in the log line.
2. **QLT-62 is fixed now.** Without `experimental.authInterrupts`, `forbidden()` throws on every role-refused page. Deleting the flag passes every test today, because all of them mock `forbidden`. A control that cannot fail is fixed at once (DL-047). Add an assertion in `next-config.test.ts`. The architect's guardrail 4 (an E2E 403 on the production build in the first story with a role-refused page) stays as the run-time proof, and tracking stays on #80 and TD-06. STD-04 is answered there.
3. **PRF-01 is fixed now, in the same round.** The root `error.tsx` is a client component on every route's first load (+4.4 to 4.7 KB everywhere, about 23 KB on not-found). It erodes the headroom AQP-188 has just won, on every route, for a page that is almost never shown.
   - **Fix:** a plain `<button>` in the boundary styled with the button classes, and `HomeAction` moved to a server-only module.
   - **Check:** performance re-measures. The fix is cheap, and the round is needed anyway for rulings 1, 2 and 4.
4. **The SCR-26 action wording follows ux-spec v0.12.** "Go to your tasks" matches neither of the spec's wordings. AC-8 asks that "for any role the 'no access' page has identical content and timing whatever page was requested". That fixes the content per role, across the pages requested, so role-aware wording is consistent with AC-8.
   - The developer uses "Go to my tasks" for an Engineer and "Go to the task queue" for a Lead or Admin, wherever the role is read.
   - Where the role cannot be read, it uses the spec's accepted interim wording, "Go to the task list".
   - The E2E tests assert the strings used. This settles QLT-65.
5. **Info items:**
   - **STD-06** (test clock reads the real time and is fractional): fixed in the same round. It is one line, and it belongs to the DL-057 class.
   - **QLT-63, QLT-64, QLT-66, PRF-04** go to one follow-up issue, GitHub #81.
     - **QLT-64 matters most:** the per-route CSRF and 403 loops iterate over nothing today, which is the "0 of 0 passes" pattern. The first story that adds a state-changing route or a Lead-only data route must make those loops non-empty, and add a guard that fails when a loop has nothing to iterate.
   - **STD-02, STD-03, STD-05, PRF-02, PRF-03:** no action.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #79 | STD-01, QLT-62, PRF-01, the SCR-26 wording (ruling 4) and STD-06, each with its test; CI green with stage 11b | Before G7 |
| 2 | reviewer-standards, reviewer-quality, reviewer-performance | PR #79, new diff only | A narrow re-review (DL-051, DL-091): standards checks STD-01 and STD-06; quality checks QLT-62 and the wording tests; performance re-measures every route after PRF-01 | Before G7 |
| 3 | master | Gate log | Check 1 and 2 against this record | Before G7 |

**G7 evidence (full QA cycle):**
- every AC-1 to AC-9 with evidence on the final head;
- the role matrix and manifest-completeness tests;
- AC-4's 403 and 404 behaviour, including invented and real IDs;
- SCR-26 at three widths, with axe and keyboard, and the wording per role;
- a log check: an induced API error carrying an invented e-mail leaves no e-mail in the log;
- a planted fault: removing `authInterrupts` fails the config test;
- regression green, including stage 11b.

**Risks registered:** none new. ARCH-R2 (a leak through a new route) is the reason QLT-64's guard is tied to the first story with a state-changing route.
**Rationale:** There is no Blocker, Critical or Major, but three Minors cannot wait: one is personal data reaching logs on every API route, one is a test that cannot fail, and one costs every route about 4.5 KB. All are small, so one round with a narrow re-review fixes them before QA starts.

**AQP-48 G6 conditions (DL-093) verified — 2026-11-05 (master). Result: met; G6 is closed and the story may go to G7.**
- **Head and CI:** 561f48e, one commit on 5208f6e (`gh api compare`), 18 files: 10 under `src/`, 8 tests. CI 42019269128 on 561f48e: success. Merge state clean; all three labels approved.
- **Re-reviews:** standards APPROVE (Jira 10946), quality APPROVE WITH COMMENTS with no new findings (10948), performance APPROVE (10947).
- **My own check:** the file list, plus `src/server/auth/viewer-role.ts` read in full. It reads the session role for the SCR-26 wording, returns `null` (the neutral wording) on any failure, re-throws Next's control-flow errors, and logs name and code only.

| Condition | Result | Evidence |
|-----------|--------|----------|
| STD-01: log name and code only | ✅ | Standards 10946: no cast. Tests put an invented e-mail in the message and in the cause, and neither reaches the log (`tests/unit/http-with-route.test.ts`) |
| QLT-62: flag asserted | ✅ | `tests/unit/next-config.test.ts`; quality's probe that removes the flag now fails |
| PRF-01: light error boundary | ✅ met in purpose | The required change is made: a plain button (`retry-button-classes.ts`) and `HomeAction` split out. Every route is 2,121 B lighter: `/` 163,289, `/queue` 164,423, `/sign-in` 162,852. Ruling 1 covers the remainder |
| SCR-26 wording (ux-spec v0.12) | ✅ | Quality 10948: the wording follows v0.12 for every role, all three labels go to `/queue`, and the neutral text appears when the role cannot be read; E2E and unit tests assert it |
| STD-06: fixed clock | ✅ | `SESSION_NOW` with `Math.floor` (`tests/support/session-harness.ts`) |
| Re-review | ✅ | All three done; quality caught 9 of 9 planted faults and 184 of 184 tests pass in the affected files |

**Rulings**
1. **PRF-01 is met; the remainder is accepted as PRF-05 (Info) and tracked on #81.**
   - DL-093 asked for a specific change and a re-measure, and both are done. Round 1's estimate for `not-found` (136 to 140 KB) was wrong: it measures 156,332 B, about 20.8 KB over `master`'s 135,547 B. The cause is the shared page frame (brand logo with `next/link` and `next/image`) and the card (`cn`, `tailwind-merge`, lucide), and about half of that the page needs anyway.
   - Why it is accepted: `not-found` is rarely seen, is not a key screen, and has 21.8 % headroom. Every route is under the 190,000 B floor (DL-081). Stage 11b would stop any breach.
   - Recorded so the next frame change can recover it: #81 item 5.
2. **Standards' note on `unstable_rethrow` (pinned Next.js) goes with STD-04 to TD-06 / #80.** It is checked at each Next.js upgrade, together with `authInterrupts`.

**G7 evidence (full QA cycle; unchanged from DL-093, with the wording now fixed):**
- AC-1 to AC-9 with evidence on the final head; the role-matrix and manifest-completeness tests.
- AC-4: 403 with a fixed body for a Lead or Engineer on a route not listed for them, the same answer for an invented and a real ID, 401 or the redirect when signed out, and the uniform 404 for an Engineer.
- AC-5: a foreign Origin refused and `APP_ORIGIN` accepted.
- SCR-26 "no access", "not found" and "error" at three widths, with axe 0 and keyboard. The button text per role: Engineer "Go to my tasks", Lead and Admin "Go to the task queue", signed out or unreadable "Go to the task list"; each goes to `/queue`. The "no access" content is identical for one role whatever page was requested.
- The log check: an API error whose message and cause carry an invented e-mail leaves no e-mail in the log.
- A planted fault: removing `experimental.authInterrupts` fails `next-config.test.ts`.
- Regression green, including stage 11b, with every route under 190,000 B.

---

## G7 – QA Acceptance — AQP-48 (STORY-01.02: role enforcement and navigation per role) — 2026-11-05

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #79 at head fb67aec, one commit on 561f48e (the G6 check) adding only `docs/07-qa/AQP-48-test-report.md` and the DEF-014 record (`gh api compare`). CI 42022565539 on fb67aec: success.
  - **QA:** Jira AQP-48 10950; PR comment 6657431748; the DEF-014 record read in full (AQP-198, #82).
  - **Not done:** no run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | AC-1 to AC-3: 280 of 280; role matrix 0 differences; completeness fails on planted faults. AC-4: fixed 403 bodies, the same for real and invented IDs; 401 or the same-origin redirect; uniform 404 (on a local build, with routes restricted in a scratch copy only). AC-5: by test (ruling 3). AC-6 to AC-9: SCR-26 at three widths with axe 0 (project tags) and keyboard; wording per role, with signed-out wording by unit test |
| 2 | No open Sev-1 or Sev-2 against this story | ✱ | ✅ | DEF-014 is Sev-2 (ruling 1), but its origin is the frame's account trigger from AQP-38 and AQP-188, which this PR does not change |
| 3 | Regression recorded and green | ✱ | ✅ | CI green; largest route `/queue` 164,423 B |
| 4 | DL-093 G7 items | | ✅ | The log check shows the invented e-mail 0 times; the planted `authInterrupts` fault is caught |

**Rulings**
1. **DEF-014 is Sev-2, not Sev-3.**
   - **Why Sev-2:** the test plan's scale lists "a WCAG 2.2 AA violation on a delivered screen" as Major. WCAG 2.5.3 (Label in Name, Level A) is inside NFR-018's WCAG 2.2 AA, and the account trigger is on every delivered portal page. QA's reason for Sev-3, that the code wasn't changed in this PR, is about where the defect came from, not how severe it is.
   - **It does not hold AQP-48's G7.** The defect came from AQP-38 and AQP-188, and AQP-48 neither introduced nor changed it, so it is bound elsewhere, as with DEF-006 (DL-063). A Sev-2 found after its origin story's G7 does not reopen that story; only a Sev-1 would (test plan §7).
   - **It is bound hard instead:** **no further story with a UI passes G7 while DEF-014 is open**, and it blocks G8.
2. **`wcag21a` joins the axe tags.** `AXE_TAGS` leaves out a WCAG level that NFR-018 requires, so no WCAG 2.1 Level A rule has ever run in the suite. That is a control that fails open, and it affects every UI story so far. One PR fixes both:
   - add `wcag21a` to `AXE_TAGS` (`tests/e2e/support/design-system.ts`);
   - make the trigger's accessible name contain its visible text at every width ("EL" alone at 360 px, "EL E2E Lead Lead" at 1366 px). The ux-expert gives the wording first;
   - QA records any other violation the wider tag set finds as its own defect, and fixes or severities follow the scale.
   - **Owner:** developer, after the ux-expert's wording. **Due:** before the next UI story reaches G7. **Evidence:** the full E2E suite with the new tags, 0 violations.
3. **AC-5 (CSRF on every state-changing route) is accepted by test.** No state-changing route exists yet. The loop and its guard against iterating nothing are bound to AQP-65 under QLT-64 (#81), which QA has moved there. Signed-out SCR-26 wording by unit test only: accepted, because the page renders the same component with no role.
4. **Process slip (fb67aec pushed before a local Gitleaks scan):** recorded, no further action on this commit. The scan straight after found no leaks, CI stage 2 (full history) is green, and the slip was disclosed. **Rule (from DL-074):** on this public repository, a local Gitleaks scan runs before every push. If the binary is missing, QA or the developer does not push and reports BLOCKED. QA restores the binary now.

The delivery lead merges PR #79 (squash, code-human).

**Risks registered:** none new. DEF-014 and the tag gap are tracked as a defect, with the hard bind in ruling 1.
**Rationale:** Every AC of this story is shown with independent evidence, including AC-4's role-first refusal. The accessibility defect QA found is real and more severe than filed, but it belongs to the shared frame, so it is bound to the next UI gate rather than holding a story that did not cause it. The tag gap is fixed at the same time, so the suite can see Level A rules from now on.

---

## G6 – Peer Review — AQP-198 (DEF-014, Sev-2: account trigger label in name; `wcag21a`) — 2026-11-05

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #85 at head 2d1e2f3. Five files: `src/components/shared/account-trigger.tsx` (+10 / −4) and four test files. CI 42032666310 on 2d1e2f3: success. All three review labels approved. The PR is behind `master`.
  - **Reviews:** `docs/06-reviews/AQP-198/standards.md`, `quality.md` and `performance.md` (main folder, uncommitted); Jira 10960 to 10962.
  - **Not done:** no local run; the diff was not read by me (the file list only).

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | DEF-014 fixed and the tag added | | ✅ | `wcag21a` adds exactly `label-content-name-mismatch` in axe 4.14.0. The suite with the wider tags shows no other violation (352 passed). 7 of 7 planted faults caught |
| 4 | Minors | | ⚠️ | STD-01 is fixed before G7 (ruling 1); PRF-02 is not caused by this PR (ruling 2) |
| 5 | CI | | ✅ | Green; runtime cost +5 B (PRF-01) |

**Rulings**
1. **STD-01 is fixed before G7.** `tests/e2e/account-trigger-name.spec.ts:40` uses `(element as HTMLElement).innerText`, a type assertion that coding standards §10 forbids. The fix is an `instanceof HTMLElement` check that throws otherwise.
   - It is test code and one line, so it goes in the same round as the branch update from `master`.
   - **Master verifies it within that file, with no re-review (DL-047).**
   - STD-02 (the duplicated normalise helper) may go in the same commit; it is optional.
2. **PRF-02 (CI time) is a follow-up enabler story, not a condition of this PR.**
   - **Figures:** over the last 20 PR runs the median is 6 min 02 s, past test strategy §10.3's 6-minute early warning. p95 is 8 min 01 s, still under the 10-minute target the delivery lead agreed. The latest `master` run took 8 min 24 s. The growth is in stage 12 (E2E at three widths).
   - **Owners:**
     - the **solution-architect** chooses the approach: parallel jobs per project, more workers, or layout-independent specs at one width (any change to what runs at which width is the architect's to rule, so coverage is not lost silently);
     - the **scrum-master** writes the enabler story now, under EPIC-10, as for STORY-10.10 (DL-056: an enabler, not scope);
     - the **developer** builds it.
   - **Timing:** Ready before the sprint 1 review.
   - **Trigger (DL-095):** if the nightly CI-time step reports a **p95 over 9 minutes**, the next story that adds E2E specs cannot reach G6 until the enabler merges.
   - **Risk:** RISK-023 is new.
3. **QLT-67, QLT-68 and STD-02 need no action.** The missing-space case is caught by the unit tests and axe; the narrow initials regex matches the UX rule as written.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #85, `tests/e2e/account-trigger-name.spec.ts` | STD-01: an `instanceof` check instead of the assertion; update the branch from `master`; CI green | Before G7 |
| 2 | master | Same commit | Verify: test file only, no assertion left, CI green | Before G7 |
| 3 | scrum-master, solution-architect | New enabler story (EPIC-10) | PRF-02: the CI-time speed-up, with the approach chosen by the architect | Ready before the sprint 1 review |

**G7 evidence (a full QA cycle; the defect is product-visible):**
- The account trigger's accessible name contains its visible text at 360, 768 and 1366 px, for each role, from the axe run with `wcag21a` and from the new E2E test.
- The full E2E suite with the new tags shows 0 violations.
- A planted fault (the old name back) fails the test.
- The trigger still opens the menu by pointer and keyboard (AC-4 of AQP-188 unchanged).
- Regression green, including stage 11b.
- QA closes DEF-014 if all pass. **No further UI story passes G7 until it does (DL-094).**

**Risks registered:** RISK-023 (new, 6).
**Rationale:** The fix is small and caught 7 of 7 planted faults. Widening the tags found nothing else, so the gap DL-094 feared was empty this time. The one Minor is a one-line rule breach in a test, verified by master. CI time is a real slope, but under the agreed target; it gets an owner and a story now, and a hard trigger before it turns into a missed target.

**AQP-198 G6 condition (STD-01) verified — 2026-11-05 (master). Result: met; G6 is closed and G7 may start.**
- **Head:** 646ac60, on d8765ca. d8765ca is GitHub's update-branch merge of `master` f698984 (docs PR #83).
- **The STD-01 commit:** one file, `tests/e2e/account-trigger-name.spec.ts`, +1 / −1, read in full (`gh api compare d8765ca...646ac60`). `(element as HTMLElement).innerText` becomes `element instanceof HTMLElement ? element.innerText : ''`.
  - **The `''` fallback is not vacuous.** `expectLabelInName` then requires the visible text to equal "el" or "el e2e lead lead", so a non-HTML element fails the test rather than passing it. My G6 wording said "throws otherwise"; failing at the next assertion meets the same purpose.
- **CI:** run 42037474153 on 646ac60, success; 352 E2E passed, stage 11b unchanged.
- **STD-02 (Info, the duplicated `normalise` helper):** not done, and accepted. The two copies run under different runners (Vitest and Playwright), and DL-095 made STD-02 optional. No follow-up issue is needed.
- **G7** may start on the evidence set in the AQP-198 G6 record. QA verifies on the final head.

---

## G7 – QA Acceptance — AQP-198 (DEF-014, Sev-2: account trigger label in name; `wcag21a`) — 2026-11-05

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #85 at head 8d76040, one commit on 646ac60 (the G6 check) adding only `docs/07-qa/AQP-198-test-report.md` (`gh api compare`). CI 42063801778 on 8d76040: success. The PR now shows 87b7308, the update-branch from `master` d8cb223 (docs only), with CI running.
  - **QA:** Jira AQP-198 10980; PR comment 6663550331. #82 closed at 16:38:50Z.
  - **Not done:** no run of my own.

| # | Check (G6 evidence, 10963) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Name contains the visible text, three widths, each role | ✱ | ✅ | 18 of 18, live, for Admin, Lead and Engineer at 360, 768 and 1366 px; axe with `wcag21a` 0 violations, menu closed and open |
| 2 | Full suite with the new tags | ✱ | ✅ | 352 passed, 0 failed; new spec 12 of 12 locally and in CI |
| 3 | Planted fault (the old name) fails | ✱ | ✅ | 4 unit tests and 2 E2E tests fail; the other 2 E2E tests were stuck at sign-in after the rebuild (Environment, inconclusive, not counted). With the fault removed, everything passes. Six failing tests are enough to show the fault is caught |
| 4 | Pointer and keyboard open | ✱ | ✅ | Both open; Escape returns focus in 60 of 60 tries |
| 5 | Regression; no open Sev-1 or Sev-2 | ✱ | ✅ | Green; stage 11b under 190,000 B; DEF-014 fixed |

**Rulings**
1. **DEF-014 (AQP-198, #82) is closed. The DL-094 hold on UI stories at G7 is lifted.**
2. **(a) QA closing before this decision is ratified, and the wording is clarified so it does not happen again.** My G6 evidence list said "QA then closes DEF-014", which invited closing before the decision, as at DL-089. **From now on:** CLAUDE.md §4 governs, and QA moves a story or defect to Done only after master's G7 decision is posted. Where master's evidence list says "QA closes", it means after the GO. The early closure is not reversed, because the GO stands.
3. **(b) The local Gitleaks exit code was masked by a pipe.** The scan ran before the push and its output showed no leaks; CI stage 2 is green. But a scan whose exit code does not gate the push only works if someone reads its output. This is the second slip of this kind after DL-094.
   - **Rule (DL-098):** the push runs only if the scan exits 0. Use `gitleaks ... && git push`, or `set -o pipefail` before any pipe. A scan in a pipe without `pipefail` does not count.
   - **Recommendation to the solution-architect and the delivery lead:** a versioned pre-push hook that runs Gitleaks, so that the rule is enforced by tooling, not memory. Not a condition.

**Merge:** after the update-branch (87b7308 or later), CI green including stage 11b. The update is docs only, so master re-checks nothing unless this PR's own diff changes. Then the delivery lead squash-merges.

**Risks registered:** none.
**Rationale:** The Sev-2 defect is fixed and proved at every width and role by both axe and a dedicated test, and a planted fault is caught. The wider tag set is now in force for every later UI story. The two process slips caused no harm, but each weakened a control, so both rules are tightened in writing.

---

## G6 – Peer Review — AQP-199 (STORY-10.14: CI time) — 2026-11-05

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1 (judged on the ACs restated in DL-102; product-owner READY 11015)
- **Artefacts evaluated:**
  - **PR and CI:** PR #86 at head 3808560, 12 files: `ci.yml` (+8), `playwright.config.ts`, two `scripts/` files, five E2E specs (tags only) and three unit test files. CI 42141321692 on 3808560: success; job 332 s, stage 12 184 s, no stall. All three review labels approved. Behind `master`.
  - **Reviews:** standards 11009 and 11023; quality 11014 and 11025; performance 11013 and 11024.
  - **AC-2 evidence:** developer 11022.
  - **Not done:** no run or code read of my own; I recomputed the AC-2 medians from the figures given.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE, quality APPROVE WITH COMMENTS, performance APPROVE |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major. Round-1 findings fixed: STD-01, the STD-05 description, QLT-75, QLT-76 (the 22 tests pinned through `playwright --list`, 5 of 5 planted faults caught), PRF-01 |
| 3 | AC-2 (restated: stage 12 at least 15 % shorter, median of three) | | ✅ | Before 313, 264, 308 s → median 308 s; after 249, 254, 245 s → median 249 s; **−19.2 %**, recomputed. The same stall rule (install over 120 s) excludes stalled attempts on both sides. The job went 468 → 411 s (−12.2 %) |
| 4 | Security of the new call | | ✅ | `playwright --list` runs through `spawnSync`, with no shell, fixed arguments and zod-validated output (standards) |
| 5 | Required check and coverage | | ✅ | Name unchanged; the negative control (run 42073527588, PR #89, closed) failed the check; 0 flaky; runner minutes at or below before |
| 6 | CI | | ✅ | Green |

**Rulings**
1. **AC-2 is met against its restated figure.** The 15 % was set after 20 % was measured (DL-102, recorded openly). The recomputed −19.2 % uses the same stall rule on both sides; the developer stated that rule before excluding any attempt, and it removes stalled runs from both "before" and "after", so it does not favour the result. Performance corrected its own round-1 figure (288.5 s was a mean of 2 runs), and the medians above supersede it.
2. **Info, no action:** STD-02, STD-03, STD-04, STD-06 (a timeout message and a repeated `90_000` constant; both may go in AQP-206's PR, which touches the same file area). QLT-77: stage 12 still includes the install step, which AQP-206 splits out. PRF-02: 4 workers give about +14 % on a CPU-bound runner, and the shard step (AQP-208) is the next lever.
3. **The AC-7 line keeps its current text in this PR.** It is replaced by DL-103's wording in AQP-208, which owns that change.

**G7 evidence (full QA cycle on the restated ACs):**
- **AC-2:** QA recomputes the before and after stage-12 medians from the run logs (42061753504 and 42070716328), applying the stated stall rule on both sides, and confirms −15 % or better. The comparison is not re-run on the updated head: `master` has added tests since, so a new "after" would not be like for like.
- **AC-3:** the 22 `@one-width` tests listed by `playwright --list` run in `desktop` only and nowhere else are skipped. A planted `@one-width` tag in an unlisted file fails `one-width-tag.test.ts`.
- **AC-4:** the required check is still one job named `Stages 1 to 11`; the negative-control run link; `ci-workflow.test.ts` green.
- **AC-5:** 0 flaky on the final head with 4 workers, and no test timeout widened (diff check).
- **AC-6:** runner minutes per run at or below before.
- **AC-1 and AC-7:** the nightly CI-time output on the final head is recorded, with no numeric target (AC-1). The 9-minute line prints as currently worded.
- **Regression:** CI green on the updated head, including stage 11b. A run that stalls in the install step is recorded as Environment and repeated (DL-100).
- **Closure:** QA moves the story to Done only after master's G7 decision is posted (DL-098).

**After the merge:** AQP-65's G6 hold lifts (DL-099), and AQP-206 (DEF-015) starts (DL-101).

**Risks registered:** none (RISK-023 stays at 8 until AQP-206 and the nightly p95 report).
**Rationale:** All round-1 findings are fixed. The restated AC-2 is met on a recomputed figure, with stalls excluded by a rule applied the same way to both sides. The change is CI configuration and tests guarded by their own unit tests, and it keeps coverage and the required check intact.

---

## G7 – QA Acceptance — AQP-199 (STORY-10.14: CI time) — 2026-11-05

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1 (on the ACs restated in DL-102)
- **Artefacts evaluated:**
  - **PR and CI:** PR #86 at head 6f7cf1a. 34e3ad0 merges `master` b240ba4 (#85, #90) into 3808560. 6f7cf1a adds the QA report. The PR's own files are the same 12 as at G6 plus the report, 13 in all. CI 42143781720 on 6f7cf1a: success, 0 flaky.
  - **QA:** Jira 11027; PR comment 6674358274; `docs/07-qa/AQP-199-test-report.md`.
  - **Not done:** no run of my own.

| # | Check (G6 list, 11026) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | AC-2, recomputed from logs | ✱ | ✅ | Stage 12 median 308 → 249 s, −19.2 %; job 468 → 411 s, −12.2 %; one stall rule on both sides; matches the developer and both reviewers to the second |
| 2 | AC-3 | ✱ | ✅ | All 22 `@one-width` tests ran on desktop only, none skipped; a tag planted in `shell.spec.ts` fails the allow-list test |
| 3 | AC-4 | ✱ | ✅ | One job named `Stages 1 to 11`; negative control 42073527588 failed it; `ci-workflow.test.ts` green |
| 4 | AC-5 | ✱ | ✅ | 0 flaky at 4 workers; no timeout widened |
| 5 | AC-6 | ✱ | ✅ | Runner minutes 8, 7, 9 before; 7, 7, 7 after; 7 on the final head |
| 6 | AC-1, AC-7 | ✱ | ✅ | Nightly 42142769100 recorded: p95 15:05, median 8:01 over 15 runs; the line printed exactly |
| 7 | Regression; no open Sev-1 or Sev-2 | ✱ | ✅ | Green on 34e3ad0 and 6f7cf1a, including stage 11b; no stall; no new defects |

**Rulings**
1. **AQP-199 is accepted.** QA moves it to Done now that this decision is posted (DL-098). The delivery lead merges.
2. **The nightly p95 of 15:05 is expected, and recorded, not acted on.** The window still holds the stalled runs; DEF-015 (AQP-206) is the fix. DL-102's fallback G6 hold is armed only after AQP-206 merges.
3. **QA's process:** Gitleaks exited 0 before the push, which meets DL-098.

**After the merge:** AQP-65's G6 hold lifts (DL-099), and AQP-206 starts in the first idle merge wait (DL-101).

**Risks registered:** none (RISK-023 stays at 8 until AQP-206 and a later nightly report).
**Rationale:** Every item set at G6 is met on a final head whose own change is unchanged since review. The key figure was recomputed independently from the logs, with the stall rule applied the same way to both sides.

---

## G6 – Peer Review — AQP-65 (STORY-01.04: Users) — 2026-11-05

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1. The DL-099 hold ended when AQP-199 merged.
- **Artefacts evaluated:**
  - **PR and CI:** PR #87 at head 5231947, 60 files. Labels: all three approved. CI run 42145959641 on 5231947 is green on earlier attempts; attempt 4 (the clean re-run for the median of three) was in progress when this was recorded.
  - **Reviews:** `docs/06-reviews/AQP-65/*.md` (main folder, uncommitted); Jira 10997 and 11033 (standards), 11001 and 11034 (quality), 10998 and 11032 (performance).
  - **My own check:** `tests/support/security-loops.ts` at 5231947 read for QLT-64 (DL-093, #81 item 1). `nonEmpty` throws `EmptyLoopError` when no implemented state-changing or protected route exists, and `expectEveryCallRan` fails if a loop ran zero times or a different number of times; `tests/unit/security-loops.test.ts` tests both. This is the first story with state-changing routes, so the guard was due here, and it is met.
  - **Not done:** no local run; the rest of the diff was not read.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE, quality APPROVE WITH COMMENTS, performance APPROVE (round 2) |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0. **Security fixes confirmed by standards:** STD-01 (an Admin resetting their own password is refused with 409 before any hash or write, and Reset is disabled on the Admin's own row); the UUID-case bypass, fixed at two layers (the schema lower-cases the ID, and the guards compare with the row the database returns), with upper and mixed case tested on PostgreSQL |
| 3 | Quality findings | | ✅ | QLT-69, QLT-70 and QLT-72 fixed, each catching its planted fault; the 12 `@one-width` tags match the architect's ruling exactly (pinned list now 34) |
| 4 | CI time and budget | | ✅ | Clean runs: job 352 s and 495 s, under 10 minutes; one-width cut the added stage-12 time to about +23 s. Attempt 3 (909 s) was a package-install stall of about 498 s, excluded under DL-100. Run 42144997474's "failure" was a GitHub-side cancellation after every step passed |
| 5 | QLT-64 guard (DL-093) | | ✅ | Above |

**Rulings**
1. **STD-06 (Minor) and QLT-78 (Info) are fixed before G7 in the developer's planned single push.**
   - STD-06: the mixed-case unit test must use an ID that contains hex letters, otherwise mixed case proves nothing.
   - QLT-78: tests for v0.14's "no-change Edit" and "notice scrolls into view".
   - It is test-only, so **master verifies it within the test files, with no re-review (DL-047)**, CI green.
2. **STD-08 is recorded, and routed as documentation follow-ups.**
   - The ux-expert adds the disabled-Reset wording to SCR-14.
   - The architect adds the own-reset 409 to architecture §6.
   - Both are due before the sprint 1 review. They are not G7 conditions, because the code and tests already define the behaviour; the documents must catch up.
3. **The median-of-three clean run** is the developer's record for NFR-009, not a G6 item. Performance has approved.
4. **The standards reviewer's correction** of their own claim about the `master` merges, and the `auth.setup.ts` conflict resolution, are accepted as reviewed.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #87, test files only | STD-06 with an ID that contains hex letters; QLT-78 tests; CI green | Before G7 |
| 2 | master | Same push | Verify: test files only, and both items present | Before G7 |
| 3 | ux-expert; solution-architect | SCR-14; architecture §6 | STD-08 documentation | Before the sprint 1 review |

**G7 evidence (full QA cycle):**
- Every AC of AQP-65 with evidence on the final head.
- **Role matrix:** the `/users` page and API are Admin-only. A Lead or Engineer gets the fixed 403, the same for a real and an invented ID; a signed-out caller gets 401 or the redirect.
- **CSRF:** the per-route loop runs over every new state-changing route (non-empty), and a foreign Origin is refused. A planted empty manifest throws `EmptyLoopError`.
- **Own-row and single-Admin guards:**
  - an Admin cannot reset their own password (409, no write);
  - an Admin cannot deactivate or demote themselves;
  - a second active Admin is refused;
  - each with an **upper-case and a mixed-case ID containing hex letters**, so case cannot bypass a guard.
- **SCR-14 at three widths** for the layout-reading tests: axe 0 with `wcag21a`, dialogs by keyboard (Escape and focus return), 44 px targets, the v0.14 behaviours (QLT-78).
- **Logs:** a user-route error carrying an invented e-mail leaves no e-mail in the log.
- **Regression:** green, including stage 11b, with every route under 190,000 B. A stalled install is Environment, repeated (DL-100).
- **Closure:** QA moves the story to Done only after the posted G7 decision (DL-098).

**Risks registered:** none.
**Rationale:** This is the first story with state-changing and Admin-only data routes, and its security points were found and fixed in review: the self-reset, and the case bypass at two layers. The empty-loop guard DL-093 required is in place and tested. The one Minor left is a test that would not catch what it names, so it is fixed in a test-only push before QA.

---

## G6 – Peer Review — AQP-206 (DEF-015: browser system packages bounded and cached) — 2026-11-05

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #92 at head 71ebe79, five files: `ci.yml` (+38 / −10), `scripts/ci/playwright-system-deps.sh` (new) and three unit test files. CI 42151550488: success. Merge state clean; all three labels approved.
  - **Reviews:** `docs/06-reviews/AQP-206/*.md` (main folder, uncommitted); Jira 11039 (standards), 11041 (performance), 11042 (quality).
  - **Not done:** no run or code read of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | DL-101 evidence | | ✅ | Quality verified a cold-cache run, two hits and a negative control. Performance: a hit downloads no apt packages (3 to 6 s); a miss takes 16 s; a slow trickle is capped at 8 minutes, so the worst case is a red job at about 11 minutes instead of a silent stall |
| 4 | Workflow security | | ✅ | Standards: no new action; the cache-trust model and the script are acceptable |
| 5 | Minors | | ⚠️ | Rulings 1 to 3 |

**Rulings**
1. **Fixed before G7, in one push:**
   - **STD-01:** the `ci.yml:224` comment must state the real protection, which is that caches are scoped by ref. A wrong comment about a security boundary invites a wrong change later.
   - **QLT-79:** the "a failed install turns the step red" test still passes with `set -e` removed, so it cannot fail. Make the fake fail only on the system-package install, so the test fails without `set -e`.
   - **QLT-80:** the script test timed out once in 4 runs on Windows (6.3 s against a 5 s limit). This is the DL-057 load-sensitive class. Spawn the process in `beforeAll` under the shared hook limit, or test the logic without a process. No longer per-test limit and no retry.
   - **Cheap Info items in the same push:** STD-04 (remove the `mktemp` file) and STD-05 (the comment's count).
2. **PRF-03 against QLT-81 (the immutable cache key).** Both reviewers are partly right, so both are adopted.
   - **Keep the key immutable, and add a `CACHE_EPOCH` constant to it** (PRF-03's manual bump). A bad or partial entry can then be replaced deliberately by a one-line change, with no automatic re-save under a fresh key on every fallback. Automatic re-saves would add entries to a store that is already over its limit (PRF-02).
   - **The fallback warning prints the key and the exact `gh cache delete` command** (QLT-81), and the README notes both recovery routes, which closes STD-03.
   - If the solution-architect sees a reason against this within test strategy §10.6, they say so before the push. Otherwise it stands.
3. **PRF-02 (the cache store is at 10.49 GB, over GitHub's 10 GB): a post-merge task, not a merge prerequisite.** Deleting caches cannot be undone, so it needs the delivery lead's approval, as you said.
   - After the merge, the developer lists the stale entries without deleting anything: old npm caches, 10 dead browser-cache entries, and Next build caches, with sizes and last use.
   - The orchestrator asks the delivery lead.
   - Entries are deleted only on their word.
   - Until then, least-recently-used eviction may drop the new package cache. The worst case is a bounded miss (16 s, cap 8 minutes), not a stall.
4. **QLT-83:** whichever of PR #87 and PR #92 merges second updates from `master` and re-runs CI before its merge. **QLT-82 (#93) and QLT-84:** no action.
5. **Re-review is narrow (DL-091):** quality confirms QLT-79 and QLT-80, and performance confirms the `CACHE_EPOCH` handling. Master checks STD-01, STD-04 and STD-05 and the warning text.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #92 | Rulings 1 and 2, in one push; CI green | Before G7 |
| 2 | reviewer-quality, reviewer-performance; master | PR #92, new diff | Ruling 5 | Before G7 |
| 3 | developer, then orchestrator | Cache list; request to the delivery lead | PRF-02: a dry list, then deletion only on the delivery lead's word | After the merge |

**G7 evidence (DL-077 and DL-101):**
- **(a)** CI green on the final head.
- **(b)** A cold run (a new `CACHE_EPOCH`) misses, finishes within the cap, and saves.
- **(c)** Two following runs hit with zero apt downloads, shown by run logs.
- **(d)** The negative control: an install failure turns the step red, and the QLT-79 test now fails without `set -e`.
- **(e)** A fallback run prints the key and the `gh cache delete` command.
- **(f)** Job time and stage 11b unchanged or better.
- **(g)** QA closes DEF-015 only after the posted G7 decision (DL-098).
- After the merge, the nightly p95 is recorded against DL-102's 9:00 (expected about 8:00 to 8:20, PRF-04). If it is still over 9:00, DL-102's fallback hold arms.

**Risks registered:** none new. RISK-023 is reviewed against the first nightly report after the merge.
**Rationale:** The fix bounds the step that caused the 15-minute runs, and it was proved cold, warm and negative. Three Minors are cheap and two of them are controls that could not fail, so they are fixed before QA. The disagreement over the cache key is settled by keeping both safeguards. The irreversible cache cleanup waits for the delivery lead.

**AQP-65 G6 condition (the test push, DL-047) verified — 2026-11-05 (master). Result: met; G6 is closed and G7 may start.**
- **Head and CI:** 3e2a695, one commit on 5231947, six files. CI 42154016256: success. Merge state clean.
- **My own check:** the full `src/` diff (`git diff 5231947 3e2a695 -- src/`), read in full.
  - The push also touches product code. `changesOf` moved out of `user-form-dialog.tsx` into `src/lib/users/edit-submit.ts` (`editChanges`, `submitEdit`), and the `scrollIntoView` call into `src/lib/ui/reveal.ts` (`revealNearest` with `REVEAL_OPTIONS`).
  - Read side by side, **the behaviour is unchanged.**
    - With no change, the dialog closes without a request and without setting "submitting".
    - With a change, "submitting" is set just before the request (inside the `save` callback), and the outcome is shown as before.
    - Create sets "submitting" explicitly.
    - The options stay `{ block: 'nearest', behavior: 'auto' }`.
  - **This is an extraction for testability, not new behaviour**, so master's check stands in for a re-review (DL-047). It is unlike DL-091, where the fix changed behaviour.

| Item | Result | Evidence |
|------|--------|----------|
| STD-06 | ✅ | `users-schemas.test.ts` uses IDs with hex letters in lower, upper and mixed case; with the schema's lower-casing removed, 1 test fails |
| QLT-78 (a): no-change Edit | ✅ | `tests/unit/users-edit-submit.test.ts`: a spy shows no request for no change or whitespace only; a planted "always send the name" fails 4 of 8 |
| QLT-78 (b): notice reveal | ✅ | The options are pinned; planted `smooth` and `center` each fail 2 of 8 |
| CI time (PRF-01, corrected) | ✅ | Attempts 3 and 4 were apt stalls and are excluded (DL-100); the clean median of attempts 1, 2 and 5 is a 5:52 job and a 3:26 stage 12 |

**Ruling on the untested wiring.** Vitest has no DOM, so two lines are not unit-tested: the dialog closing on `unchanged`, and the effect calling `revealNearest`. **QA covers them at G7 with E2E, in QA's own spec; the developer adds nothing now.**
- **"Edit with no change closes the dialog and sends no request":** one width. It reads no layout, so it gets the `@one-width` tag, which the architect adds to the allow-list ruling first, or else it runs at three widths.
- **"A failure notice off-screen is scrolled into view":** three widths, because scrolling depends on the viewport, and the default in test strategy §10.5 applies.
- This is cheaper than a developer round, and it covers what the unit tests cannot.

**G7 evidence: the list in 11035 stands, plus the two wiring tests above.** Every AC; the role matrix; the CSRF loop non-empty, with a planted empty manifest that fails; the own-row and single-Admin guards with upper- and mixed-case hex IDs; SCR-14 at three widths with axe (`wcag21a`), keyboard and 44 px; the log check; regression with stage 11b; Done only after the posted G7 (DL-098). QLT-83: if PR #92 merges first, this PR updates from `master` and re-runs CI before its merge.

*Addendum (master, same day), on ux-expert AQP-65 11038:*
- **The self-reset API question** is answered by STD-01's fix (409 before any hash or write), so the disabled Reset button is backed by the server.
- **ux-spec v0.15 adds a visible reason line under the buttons on phone cards.** It is not required for AQP-65's G7: it points to Change password, which arrives in 01.05, so **AQP-81 adds it**, and the scrum-master notes it there.
- **AQP-65's G7 checks the own-row Reset button's accessible name exactly as the ux-expert gave it:** "Reset password is not available for your own account. Use Change password in the account menu."

**AQP-206 G6 conditions verified — 2026-11-05 (master). Result: met; G6 is closed and G7 may start.**
- **Head and CI:** a330eb0. **Its tree is identical to the fix push 762f1ea** (`be5af21…` for both; `git rev-parse <commit>^{tree}`). The two temporary negative-control commits (85cdf25, 785e4df) are reverted exactly (8647c38, a330eb0). CI 42160587281 on a330eb0: success.
- **Re-reviews:** quality APPROVE with no findings (11049): QLT-79 removing `set -e` fails exactly one test; QLT-80 4 of 4 green on Windows. Performance APPROVE (11048): PRF-03, the key carries `playwright-debs-e<CACHE_EPOCH>-…` with no automatic re-save; job median 378 s; 12a plus 12 median 208 s; stage 11b identical.
- **My own check:** `git diff 71ebe79 a330eb0` for `ci.yml`, the script and `ci-workflow.test.ts`.

| Item | Result | Evidence |
|------|--------|----------|
| STD-01: the cache-trust comment | ✅ | `ci.yml` now says that caches are scoped by ref: a PR's run restores from its own ref or `master`, its saves are visible to that PR only, and the shared entries are written only by `push` runs on `master`. The same correction is made to the stage 9 comment |
| STD-04: the `mktemp` leak | ✅ | `before` is declared at the top, with `trap 'rm -f -- "${before}"' EXIT`, so it is removed on every exit, including a failed install |
| STD-05: the comment count | ✅ | "four" → "three" in `tests/unit/ci-workflow.test.ts` |
| Warning text (QLT-81 with PRF-03) | ✅ | The fallback warning names the cache key and the command `gh cache delete <key>`. `CACHE_EPOCH: '1'` is at the top of `ci.yml`, commented to be raised only in a reviewed change. README, "Playwright install cache" |

**Process note: a repeat of STD-06 from AQP-188 (DL-091 ruling 4).** The negative controls were again run as temporary commits on the story branch that edit the required workflow, then reverted. No harm: the trees match and a squash merge leaves no trace. **But the DL-091 rule was "use `workflow_dispatch` or a throwaway PR for evidence runs", and it was not followed.**
- **The delivery lead must squash-merge PR #92.**
- **The orchestrator tells the developer that the next evidence run on a story branch is a finding.**

**G7 evidence (the AQP-206 G6 record, confirmed):**
- **(a)** CI green on the final head.
- **(b)** Cold run on the new key: 42154546800 attempt 1, a miss, 12a 9 s, saved.
- **(c)** Two hits: attempts 2 and 3, 12a 3 s, 0 apt `Get:` lines.
- **(d)** Negative control: 42160257283, an unreachable proxy makes 12a fail in 5 s and the job red; plus the QLT-79 test.
- **(e)** Fallback: 42159562776 prints the key and the delete command.
- **(f)** Time and stage 11b unchanged.
- **(g)** QA closes DEF-015 only after the posted G7 decision.

QA reads each run log for itself rather than relying on the developer's summary. The nightly p95 after the merge is recorded against DL-102's 9:00.

**PRF-02:** the cache-store cleanup waits for the delivery lead's word. Rows 1 to 3 (about 7 GB) are proposed now; row 4 waits until after the merge.

---

## G7 – QA Acceptance — AQP-65 (STORY-01.04: Users) — 2026-11-06

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #87 at head 9d231fd, which adds four QA files on 3e2a695 (the G6 check): the report, the DEF-016 record, `tests/e2e/aqp-65-qa.spec.ts`, and the allow-list in `tests/unit/one-width-tag.test.ts` (`gh api compare`). CI 42161601204 on 9d231fd: success, 343 passed, 0 flaky, no stall.
  - **QA:** Jira 11051; PR comment 6676884897; `docs/07-qa/AQP-65-test-report.md`.
  - **Not done:** no run of my own.

| # | Check (11035, 11045) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC with evidence | ✱ | ✅ | All met; integration 18 of 18 on PostgreSQL, including direct-SQL refusal of a second Admin |
| 2 | Role matrix | ✱ | ✅ | A Lead or Engineer gets 403 and the no-access page; all six users API calls give the same fixed 403 for real and invented IDs; signed out gets the redirect or 401 |
| 3 | CSRF loop and guard | ✱ | ✅ | Runs over the new routes; a planted "planned" manifest throws `EmptyLoopError` |
| 4 | Own-row and single-Admin guards | ✱ | ✅ | Own reset, deactivate and demote give 409 for lower, upper and mixed-case IDs, with the row unchanged; a second Admin is refused on create, promote and reactivate |
| 5 | SCR-14 at three widths | ✱ | ✅ | Axe with `wcag21a` 0; no sideways scroll; own-row Reset 44 px on the card and 36 px in the table |
| 6 | Wiring tests (11045) | ✱ | ✅ | (a) a no-change Edit makes 0 write requests (one width); (b) the notice scrolls into view at three widths; each fails with its planted fault |
| 7 | Log check; regression | ✱ | ✅ | 0 e-mails in the log; CI green, including stage 11b (`/users` 170,909 B, under 190,000) |
| 8 | No open Sev-1 or Sev-2 | ✱ | ✅ | DEF-016 is Sev-4 |

**Rulings**
1. **DEF-016 (AQP-215, #95, Sev-4) is fixed before the merge, in this PR, not forward.** The own-row Reset accessible name lacks the final full stop of the ux-expert's agreed wording (11038), and the existing E2E checks only the prefix.
   - The test plan sends a Sev-4 to the backlog, but here a fix-forward costs another PR and another merge by the delivery lead, for one character.
   - The fix is one commit: the full stop, plus an **exact-match** assertion on the whole name, so the next drift fails.
   - **Master verifies it** (DL-047): one string and one assertion, CI green. No re-review and no further QA run beyond that test.
   - QA closes DEF-016 after the check is posted.
2. **The `@one-width` tag on QA's no-change Edit test needs the solution-architect's confirmation before the merge.** Test strategy §10.5 makes the architect the only one who adds to the allow-list, and 11045 made this test's one width depend on that ruling. QA added it, and the test reads no layout, so a one-line confirmation on AQP-65 is enough. If the architect declines, the tag comes out and the test runs at three widths.
3. **QLT-83:** if PR #92 merges first, PR #87 is updated from `master` and CI re-run before its merge.

**Before the merge:** the DEF-016 commit verified by master; the architect's one-line confirmation; CI green. Then the delivery lead squash-merges. QA moves AQP-65 to Done once this decision is posted (DL-098).

**Risks registered:** none.
**Rationale:** Every evidence item set at G6 is met, including the guards with case variants, the empty-loop guard, and the wiring tests QA added. The one defect is cosmetic and a single character, so it is fixed now rather than costing the delivery lead another merge.

*Correction (master, same record):* ruling 2 above (the architect's confirmation of QA's `@one-width` tag) is **already met**. The solution-architect ruled one width for that exact test, file and title in AQP-65 comment 11046, before QA added it (test strategy v0.20 §10.5). The only pre-merge item left is the DEF-016 commit, verified by master, plus QLT-83 if #92 merges first. The PR #87 comment still lists the confirmation; this record and Jira 11054 are authoritative.

---

## G7 – QA Acceptance — AQP-206 (DEF-015: browser system packages bounded and cached) — 2026-11-06

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #92 at head d409aa1, which adds only `docs/07-qa/AQP-206-test-report.md` on a330eb0 (`gh api compare`). CI 42163105380 on d409aa1: success, a cache hit.
  - **QA:** Jira 11055; PR comment 6677102151. QA read each run log themselves, as 11050 asked.
  - **Not done:** no run of my own.

| # | Check (11050) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | (a) Final head green | ✱ | ✅ | 42160587281 on a330eb0: a cache hit, 12a 3 s, 0 apt `Get:` lines, 308 E2E passed. The tree equals 762f1ea, so the temporary commits are fully reverted. 42163105380 on d409aa1 is also green, also a hit |
| 2 | (b) Cold run saves | ✱ | ✅ | 42154546800 attempt 1: a miss, apt fetched 21.9 MB, 9 packages cached, key saved |
| 3 | (c) Two hits | ✱ | ✅ | Attempts 2 and 3: 3 s each, 0 apt lines, not re-saved |
| 4 | (d) Negative control | ✱ | ✅ | 42160257283, an unreachable mirror: 12a fails in 5 s, stage 12 skipped, job red. Locally, removing `set -e` fails exactly the QLT-79 test (1 of 8) |
| 5 | (e) Fallback message | ✱ | ✅ | 42159562776: the warning names the key and `gh cache delete <key>`, or `CACHE_EPOCH`; the fallback is bounded and the run green |
| 6 | (f) Time and budget | ✱ | ✅ | Job median 378 s and 12a plus 12 median 208 s, against `master` 396 and 477 s and 217 and 261 s; stage 11b identical |
| 7 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **DEF-015 (AQP-206) is accepted. QA closes it now that this decision is posted (DL-098).**
2. **The first `master` run after the merge misses once, by design,** and saves the entry every branch then reads. It is not a regression. The orchestrator notes its time so the nightly window reads clearly.
3. **After the merge:**
   - the nightly p95 is recorded against DL-102's 9:00. If it is still over 9:00, DL-102's fallback G6 hold arms;
   - RISK-023 is reviewed at that report;
   - PRF-02 row 4 (`master`'s old playwright-Linux entry) may be deleted once #92 and #87 have merged, under the delivery lead's earlier word (DL-104), limited to that entry.
4. **Merge:** update from `master`, CI green, then the delivery lead **squash-merges** (DL-091; a330eb0's history holds temporary commits). Whichever of #87 and #92 merges second updates and re-runs first (QLT-83).

**Risks registered:** none (RISK-023 is reviewed at the first nightly report after the merge).
**Rationale:** The defect is a stall in an unbounded network step. The fix is proved cold, warm, negative and on fallback, each read from the run logs by QA, and it costs nothing in job time.

**AQP-65 DEF-016 commit verified — 2026-11-06 (master; DL-104 ruling 1). Result: met. QA may close DEF-016 (AQP-215, #95) and move AQP-65 to Done.**
- **Head and CI:** b742efa, one commit on 9d231fd, four files. CI 42163418172: success.
- **My own check:** the full patch, read through the GitHub API.

| Check | Result | Evidence |
|-------|--------|----------|
| The name matches 11038 exactly | ✅ | `OWN_PASSWORD_NAME` in `src/components/features/users/texts.ts` is "Reset password is not available for your own account. Use Change password in the account menu.", identical to the ux-expert's wording, full stop included. `users-list.tsx` imports it; that line is the only product change |
| Exact-match tests | ✅ | `tests/unit/users-texts.test.ts`: `toBe` on the whole sentence, plus a starts-with check for WCAG 2.5.3. `tests/e2e/users.spec.ts`: `toHaveAccessibleName` with the sentence **written out, not imported**, so a change to the constant also fails the E2E |
| Planted fault | ✅ | Removing the full stop fails the unit test (developer, 11056) |
| CI | ✅ | Green |

**Merge:** the delivery lead squash-merges PR #87. If #92 merges first, #87 updates from `master` and re-runs CI first (QLT-83).

---

## G6 – Peer Review — AQP-208 (STORY-10.15: CI shard step) — 2026-11-06

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and checks:** PR #96 at head 9c725e1, nine files (`ci.yml` +160 / −39, `nightly.yml`, README, two `scripts/` files, four test files). On 9c725e1, `Stages 1 to 11b`, both shard jobs and the fan-in `Stages 1 to 11` succeeded.
  - **The non-required "CI feedback time" check failed.** I read its log (run 42173161019): over 16 runs, p95 was 8 min 59 s and the median 6 min 22 s, over the 6-minute early warning. Those are the old single-job runs this PR replaces. The check is report-only, so this is expected and is not held against the PR. **It is also the first reading after AQP-206: p95 8:59 is under DL-102's 9:00, so DL-102's fallback hold does not arm.**
  - **Branch history:** no temporary commits on the branch. The negative controls ran on throwaway PR #98, as DL-091 requires.
  - **Reviews:** `docs/06-reviews/AQP-208/*.md` (main folder, uncommitted); Jira 11068 (standards), 11069 (performance), 11070 (quality); developer 11066.
  - **Not done:** no code read of my own beyond the file list.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | AC-2 (required path ≤ 6:00) | | ✅ | Recomputed by quality and performance from the API: median 503 s → 285 s (4:45, −43 %). One "before" attempt hit the 12a 8-minute cap and was repeated (DL-100). 5 green runs, 0 flaky |
| 4 | AC-3 coverage | | ✅ | The union across shards is 362 tests, none missing or duplicated; setup runs per shard; planted faults caught |
| 5 | AC-4 required check | | ✅ | Three negative controls on PR #98 (failed, skipped, cancelled): `Stages 1 to 11` failed each time, and the logs name the cause; `if: always()` with success-only is correct; fan-in faults caught |
| 6 | AC-6 runner minutes | | ✅ | 1.36× raw and 1.56× billed, under the 2× guard |
| 7 | AC-7 line | | ✅ | DL-103's wording, word for word and pinned; the multi-job measure is tested |

**Rulings**
1. **Fixed before G7, in one push, verified by master (DL-047; tests plus one workflow line):**
   - **STD-01:** replace the `as` cast at `e2e-shards.test.ts:49` with the zod parser through a `tests/support` helper.
   - **STD-02:** move the slow `playwright --list` calls into `beforeAll` under the shared hook limit, and remove the widened 120 s per-test limits (§10; DL-057).
   - **QLT-85:** the fan-in test spawns bash 12 times in one test and timed out 3 of 3 times on Windows. Apply the QLT-80 fix: spawn in `beforeAll`, or test the logic without processes. No longer limit, no retry.
   - **STD-03:** split `ci-feedback-time.test.ts` (447 lines) under the 400-line limit.
   - **QLT-86 (raised from Info):** the shard-coverage test is a guard and failed 2 of 15 local probes with no captured cause. A guard that fails by chance gets ignored. Log Playwright's stderr on failure in the same push. STD-02 may remove the cause; G7 shows it.
   - **The optional `permissions: {}` on the fan-in job:** take it. Least privilege costs one line.
2. **PRF-03 (#99) stays a follow-up, not this PR.**
   - **Owner:** the solution-architect chooses between warming the keys on `master` from the nightly run and bounding slow downloads; the developer builds it.
   - **Due:** before the sprint 1 review, the same family as DL-101.
   - **Why not here:** the cost of the miss is bounded (12a caps at 8 minutes; usually about 16 s), the window lasts only until the next `master` push saves the new key, and folding it in would change what AC-2 measures.
   - RISK-023 records it.
3. **QLT-87 (shard imbalance, 167 s against 107 s):** no action now. The solution-architect revisits it before any third shard (DL-102 pre-authorisation). The postgres-copies test: optional, no.

**G7 evidence (full QA cycle):**
- **AC-2:** QA recomputes the required-path median from the API (first job's start to the fan-in's end), before against after, with a capped run repeated. Target ≤ 6:00.
- **AC-3:** the union is 362 tests, none missing or duplicated; a planted fault in `e2e-shards.test.ts` fails.
- **AC-4:** the three negative-control runs on PR #98, by link, each showing `Stages 1 to 11` red with its cause.
- **AC-6:** runner minutes under 2×.
- **AC-7:** the line exact.
- **QLT-86:** the shard-coverage test run 20 times locally with no failure, or each failure classified from the captured stderr.
- **QLT-85 and STD-02:** the fixed tests green on Windows, 4 of 4.
- **Regression:** green on the final head.
- **Evidence runs** use `workflow_dispatch` or a throwaway PR only (DL-091).
- **Closure:** Done only after the posted G7 (DL-098).

**Risks registered:** RISK-023 restated (below).
**Rationale:** The shard step meets its target with margin, −43 % to 4:45, and keeps coverage and the required check intact. That was proved by three kinds of negative control on a throwaway PR, which was the process DL-091 asked for. The Minors are test hygiene in the DL-057 class, and a guard that flakes, so they are fixed before QA in one push that master checks.

**AQP-208 G6 conditions verified — 2026-11-06 (master). Result: met; G6 is closed and G7 may start.**
- **Head and CI:** 47722b1, one commit on 9c725e1, nine files: `ci.yml` +2 and the rest tests or `tests/support`. CI 42196055291: success, with a required path of 272 s. Developer notes: 11090 and PR comment 6681872433.
- **My own check:** the file list; the `ci.yml` diff (only `permissions: {}` on the fan-in, with its comment); `e2e-shards.test.ts` and `tests/support/playwright-list.ts` at 47722b1, read for the hook, the cast and the failure detail.

| Item | Result | Evidence |
|------|--------|----------|
| STD-01: the cast | ✅ | No `as` cast; a shared zod parser in `tests/support/playwright-list.ts`, used by `e2e-shards.test.ts` and `one-width-tag.test.ts` |
| STD-02: listings in a hook | ✅ | The listings run once in `beforeAll` (line 46) under the shared hook limit; the per-test timeouts are gone |
| QLT-85: bash spawns | ✅ | `tests/unit/ci-fan-in.test.ts` runs the script once per combination in `beforeAll`; no limit raised, no retry; Windows 4 of 4 on the light files |
| STD-03: file size | ✅ | 326 lines, with the sharded cases in a 109-line file and fixtures in `tests/support/ci-feedback-records.ts` |
| QLT-86: failure detail | ✅ | A failed listing reports its exit status, signal, timeout flag and the tails of stderr and stdout (lines 59 to 86) |
| `permissions: {}` | ✅ | On the fan-in job, with a test |

**Ruling on the 20 local runs (18 passed, 2 failed): the classifications meet the evidence rule, and the sequential-listings change is not required now.**
1. **Run 11 is Environment.** The host suspended for 96 minutes mid-run, and the hook timer fired on the clock jump. Not counted (DL-068).
2. **Run 14 is classified Environment-probable and recorded as such.** A listing hung and was killed at 100 s with empty output. At the same minute, a Git Bash on the host failed to fork with `0xC000012D` (a commit-limit failure: the host ran out of memory). The new capture did its job: it shows a killed process with no output, not a test fault. The cause is not proven, so it is recorded as probable, not certain.
3. **Why not take the sequential change now.** The three listings run in parallel (`Promise.all`, line 47), each with a 100 s limit inside the shared 120 s hook. Run one after another, they could approach the hook limit under load, which would trade a rare suspected memory hang for the DL-057 time-limit class. That choice needs a measured hook time, not a guess.
4. **Trigger:** if at G7, or in any CI run, a listing fails with empty output and no host event to explain it, it becomes a Test defect. The developer then chooses sequential listings or a lower peak, with the hook time measured before and after. Never a retry.

**G7 evidence (the 11071 list, confirmed):**
- AC-2 recomputed by QA from the API;
- AC-3 with a planted fault;
- the three PR #98 negative-control links (AC-4);
- AC-6 and AC-7;
- **QA's own 20-run series of the shard-coverage test on the final head**, each failure classified from the captured output, with Environment failures repeated, not counted;
- the fixed tests 4 of 4 on Windows;
- regression green;
- evidence runs only by `workflow_dispatch` or a throwaway PR;
- Done only after the posted G7.

---

## G6 – Peer Review — AQP-74 — scope of the fix push, ruled during the DL-106 hold — 2026-11-06

- **Status:** no G6 decision yet. It stays held until PR #96 (AQP-208) merges (DL-106). This record rules the scope of one fix push on PR #97 (head 3aa50db), so that the wait is used.
- **Inputs:** `docs/06-reviews/AQP-74/standards.md`; quality, Jira 11095; performance, 11083 (REQUEST CHANGES); PM 11077; architect 11078, 11087, 11091; ux-expert 11084; product-owner READY 11093.

**Rulings**
1. **PRF-01 (Major) is fixed in this PR.** This PR causes it: `/sign-in` grows to 182,039 B (+18.8 KB) and `not-found` to 166,053 B (+9.5 KB), because the bundler duplicates `next/image` and `next/link` when `BrandLockup` is pulled in through the root error page, `not-found` and sign-in. That leaves 7,961 B under DL-081's 190,000 B floor. A Major is fixed or explicitly accepted, and accepting a 19 KB regression that has a cheap cure would spend the headroom AQP-188 paid for.
   - **Fix:** a plain `<img>` with explicit `width`, `height` and the existing `alt` in `BrandLockup`, which is the only `next/image` user, and images are unoptimised. Slimming the root error page is optional.
   - **Constraint:** if `@next/next/no-img-element` fires, there is **no inline `eslint-disable`**. The solution-architect rules a file-scoped override in the ESLint config, with its reason, or another cure.
   - **Proof:** performance re-measures every route, and the target is to return close to the pre-PR figures.
2. **All Minors are fixed in this push.** They are small, and the round happens anyway:
   - **STD-01:** the two `as` casts in `audit-database.test.ts` (coding standards §10).
   - **STD-02:** remove the per-file 120 s `beforeAll` limit and the 30 s per-test limit (DL-057).
   - **STD-03:** split `user-service.test.ts` (432 lines) under 400.
   - **QLT-88:** the `FOR UPDATE` test caught the lock's removal only 2 times in 5, so it is a control that fails by chance. Replace it with a deterministic test: a second transaction holds the lock, and the test shows the first one waits.
   - **QLT-89 (product behaviour):** when From is after To, the screen must not keep the old list or offer "Show more" that leads to a false error. The behaviour follows ux-spec v0.16, and a test covers it.
   - **PRF-03:** hash the reset password before the transaction, so no row lock is held for about 350 ms during argon2id.
3. **The already-decided changes go in the same push:**
   - `user.renamed` (PM 11077, AC-3);
   - `actor_label`, with the Who filter by `actor_id` and the people list rendered on the server (architect 11087 and 11091; AC-1, AC-6);
   - ux-spec v0.16 strings and empty states (11084; AC-6, AC-8);
   - the 12 `@one-width` pins, with the "a Engineer" title fixed (11078);
   - the stale `user-service` comment;
   - AQP-84.
4. **Re-review: all three reviewers, on the new diff only (DL-051), not narrowly.** The push adds product behaviour (a new audit event, a new column and filter, server rendering, screen states) as well as the fixes.
   - **Standards:** STD-01 to 03, plus the security of `actor_label` and the server-rendered list (no personal data beyond what the spec shows; the role check first).
   - **Quality:** QLT-88 and QLT-89, plus the new ACs' tests, with planted faults.
   - **Performance:** PRF-01 and PRF-03, re-measuring every route.
5. **Then G6, once PR #96 has merged:** master checks the push against this record, with the three re-reviews and CI green.

**Risks registered:** none. RISK-020 stays at 3 if PRF-01's cut lands; otherwise it is restated at G6.

---

## G7 – QA Acceptance — AQP-208 (STORY-10.15: CI shard step) — 2026-11-06

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #96 at head 4cb7fff, which adds only `docs/07-qa/AQP-208-test-report.md` on 47722b1 (`gh api compare`). CI 42198996118: success on all four jobs. The merge state "unstable" comes from the non-required CI-feedback-time report on the old window (DL-106), not from a required check.
  - **QA:** Jira 11097; PR comment 6682271674.
  - **Not done:** no run of my own.

| # | Check (11071, 11092) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | AC-2 recomputed from the API | ✱ | ✅ | Before 507, 499, 503 s (median 503); after 291, 238, 285 s (median 285); −43 %, against the 6:00 target; the capped "before" attempt repeated (DL-100) |
| 2 | AC-3 | ✱ | ✅ | Union 362, none missing or duplicated; setup per shard; planted "missing" and "duplicate" faults each fail `e2e-shards.test.ts` |
| 3 | AC-4 | ✱ | ✅ | All three PR #98 controls turned `Stages 1 to 11` red, and each log names the cause |
| 4 | AC-5 / AC-6 / AC-7 | ✱ | ✅ | 5 runs, 0 flaky; minutes 1.36× raw and 1.56× billed; the line exact, pinned and seen live |
| 5 | QA's 20-run series | ✱ | ✅ | 20 of 20 on the final head; the Test-defect trigger set in the G6 condition check did not fire |
| 6 | Windows; regression | ✱ | ✅ | Fixed files 4 of 4; CI green; stage 11b all 6 routes within the limit |
| 7 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **AQP-208 is accepted. QA moves it to Done now that this decision is posted (DL-098).** The delivery lead squash-merges PR #96.
2. **The merge lifts DL-106's hold on AQP-74.** AQP-74's G6 then proceeds on its fix push and re-reviews (the scope ruling above), and AQP-216 is unblocked.
3. **RISK-023:** it falls to 6 when a nightly window after the merge shows a median ≤ 6:00 and a p95 ≤ 7:00 (DL-102). The orchestrator reports the first such window. STORY-10.16 (DL-105) follows.

**Risks registered:** none.
**Rationale:** The shard step cuts the required path by 43 % with coverage and the required check intact. This was proved by recomputed timings, planted coverage faults, three kinds of negative control on a throwaway PR, and a 20-of-20 series of the guard that had flaked.

---

## G6 – Peer Review — AQP-74 (audit log) — decision — 2026-11-06

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1. The DL-106 hold lifted when AQP-208 merged. Judged against the fix-push scope ruled earlier (gate log, AQP-74 fix-push scope; Jira 11096).
- **Artefacts evaluated:**
  - **PR and CI:** PR #97 at head 7e0f287, which is c365f00 plus the lint commit from architect ruling 11102. Merge state clean, base 4c12103. CI 42206449038: success on all four jobs.
  - **Re-reviews:** round 2, of the full new diff: standards 11104, quality 11105, performance 11103.
  - **My own check:** the lint commit (`gh api compare c365f00...7e0f287`, two files, read in full).
  - **Not done:** no local run.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE (3 Info), quality APPROVE WITH COMMENTS (1 Info), performance APPROVE (5 Info) |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0. PRF-01 (Major) is fixed |
| 3 | Scope ruling met | | ✅ | **PRF-01:** `/sign-in` 166,285 B, 23,715 B under the floor, and every other route below `master`. **PRF-03:** the hash happens before the transaction. **STD-01, 02, 03** fixed. **QLT-88:** deterministic, as removing the lock fails 5 of 5. **QLT-89** fixed. The decided changes are present: `user.renamed`, `actor_label` (from `requireUser` only), the people list as `{id, name}` after the Admin check, the v0.16 strings, the 12 pins, and AQP-84. Quality caught each of these with planted faults |
| 4 | **Lint commit (STD-10, checked by master)** | | ✅ | `eslint.config.mjs`: `NEXT_IMAGE_IMPORT` is banned as an **error** through `no-restricted-imports`, and through `no-restricted-syntax` for `import()`. It is added to **every file group** as well as the general block, because a group's setting replaces the general one. `@next/next/no-img-element` is off repo-wide, with a comment citing architecture §10 and PRF-01. There is no inline `eslint-disable`. `brand-lockup.tsx` gains `decoding="async"`. This matches the architect's ruling (11102, architecture v0.28 §10) and replaces the rule with a stronger one rather than switching a rule off |
| 5 | CI time | | ✅ | Required path 4:27, against `master`'s 4:48 |

**Rulings**
1. **G6 is GO, with no conditions.** Every item in the scope ruling is met, and the lint change is sound.
2. **Info, no action:**
   - **PRF-07:** `/sign-in` is still 2,998 B above `master`, with ample headroom.
   - **QLT-92:** "No entries yet", the description and the meta text have no test. G7 covers them.
   - The rest of the standards and performance Info items need no action.
3. **Standing rule recorded (standards):** the migration edited in this PR was never merged, so editing it was acceptable. **Once merged, it is never edited again**; a later change is a new migration.

**G7 evidence (full QA cycle):**
- Every AC with evidence on the final head.
- **The audit trail:**
  - each audited change and its audit row are written in one transaction, and a planted bypass fails;
  - the runtime role cannot UPDATE or DELETE audit rows;
  - `user.renamed` is written with a strict payload and no secrets.
- **`actor_label`:** it comes from the session only, and the Who filter works by `actor_id`. The people list is `{id, name}`, served only after the Admin check. A Lead or Engineer gets the fixed 403.
- **The From and To behaviour (QLT-89):** From after To shows no stale list and no false "Show more".
- **The v0.16 strings and empty states**, including "No entries yet", the description and the meta text (QLT-92), checked against ux-spec v0.16.
- **The lock test:** QA confirms that removing the lock fails it.
- **PRF-03:** the reset hash happens before the transaction.
- **Lint:** a planted `import Image from 'next/image'` (static and `import()`) fails `eslint` in `src/` and in a group file, and a plain `<img>` passes.
- **The 12 `@one-width` pins** match the architect's list.
- **The audit screen at three widths:** axe with `wcag21a` 0, keyboard, 44 px.
- **A log check:** no e-mails in the log.
- **Regression:** green, including stage 11b, every route under 190,000 B.
- **Closure:** Done only after the posted G7 (DL-098). Evidence runs only by `workflow_dispatch` or a throwaway PR (DL-091).

**Risks registered:** none (RISK-020 stays at 3).
**Rationale:** The one Major is fixed at its cause, and the size budget is better than `master` on every route but one. The lock test is now deterministic, and the lint change strengthens the rule rather than switching it off. All the decided product changes passed a full re-review with planted faults.

---

## G7 – QA Acceptance — AQP-74 (audit log) — 2026-11-06

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #97 at head 2843d13, which adds only `docs/07-qa/AQP-74-test-report.md` on 7e0f287 (`gh api compare`). CI 42224314965: success on all four jobs.
  - **QA:** Jira 11111; PR comment 6685852514.
  - **My own check:** `git grep` at 2843d13 finds no `logger` call in the audit services, the audit repositories, the audit API routes or `user-service.ts`.
  - **Not done:** no run of my own.

| # | Check (11106) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | **Audit atomicity, with a planted bypass** | ✱ | ❌ | QA-F1 (below) |
| 2 | Append-only | ✱ | ✅ | The runtime role is denied UPDATE, DELETE and TRUNCATE; the trigger refuses even the owner |
| 3 | `user.renamed`, `actor_label`, Who filter, people list, 403 | ✱ | ✅ | Integration 64 of 64; the fixed 403 in CI |
| 4 | From after To, lock test, PRF-03 | ✱ | ✅ | All hold. The planted lock fault was not re-run (low memory); QLT-88's 5 of 5 at G6 stands |
| 5 | Lint ban | ✱ | ✅ | A `next/image` import is an error, both static and dynamic; a plain `<img>` passes |
| 6 | 12 pins; v0.16 strings | ✱ | ✅ | The pins match exactly; the strings are verbatim in the source. QLT-92's three untested strings are checked by reading |
| 7 | Log check | ✱ | ✅ | Static, accepted (ruling 3) |
| 8 | Layout at three widths; regression | ✱ | ✅ | CI; `/audit` 171,801 B |

**Rulings**
1. **QA-F1 is upheld, and the atomicity evidence is not met.** QA moved one audit entry into its own transaction in a scratch copy, so that the entry would survive a rollback of the user change:
   - **role change:** caught by 3 unit tests;
   - **activation: not caught at all**, with 64 integration and 183 unit tests green;
   - **rename:** caught only by accident (a self-rename lock timeout); an ordinary rename passes everything;
   - **deactivate, create and reset:** not checked, because the disk was full.

   Atomicity of the audit trail is this story's core promise. A control that passes while it is broken fails open (the AQP-27 and DL-093 pattern), so it cannot be accepted as evidence. This also corrects quality's round-1 claim that "planted bypasses fail the integration tests": that was true for some events, not all. **The product code is not shown to be wrong. The tests cannot show that it is right.**
2. **QA-F1 is recorded as a defect: type Test, Sev-3.** QA raises it (DEF-017), linked to AQP-74. It holds this gate because a mandatory evidence item is unmet, not because of its severity. **It is fixed in this PR before the merge, not as a follow-up**, because a merged audit trail whose atomicity is untested for some events is the risk this story exists to remove.
3. **The static log check is accepted.** Master's own `git grep` finds no `logger` call in the audit services, repositories or routes, or in `user-service.ts`. Every route logs only through `withRoute`, whose name-and-code-only logging is tested with an invented e-mail in the message and the cause (AQP-48, STD-01). A live check is welcome at attempt 2 if the disk allows, but it is not required.

**Remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #97, tests only | **For every audited event (create, rename, role change, activate, deactivate, password reset), one integration test where a step fails *after* the audit entry is written, inside the same unit of work**, and asserts there is no audit entry and no change. Example: a name-plus-role save where the second entry is refused, then no rename entry. One shared helper, no retries, no longer limits | Attempt 2 |
| 2 | master | Same push | Verify: tests only, all six events covered (DL-047) | Attempt 2 |
| 3 | qa-engineer | AQP-74; DEF-017 | **A planted bypass per event**, six in all, each moving that event's audit write into its own transaction, each failing at least one test. Then close DEF-017 after the posted G7 | Attempt 2 |

**Also:** the low memory and disk space on the shared PC limited the evidence (the planted lock fault, the live log check, three events). The orchestrator has asked the delivery lead for a disk clean-up; attempt 2 needs at least enough space for the six planted bypasses.

**Risks registered:** none new.
**Rationale:** The append-only design, the access rules and the screen pass. But the one property an audit log exists for, that an entry exists exactly when the change happened, is tested for one event in six with any certainty. That is fixed with tests before the merge, not trusted.

---

## G6 – Peer Review — AQP-216 (STORY-10.16: cache warm-up and bounded install) — 2026-11-06

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #100 at head 7bda9e0, eight files: `nightly.yml` +102 / −6, README, two scripts under `scripts/ci/`, four unit test files. CI 42204070612: success. The merge state "unstable" comes from the non-required CI-time report. No temporary commits are on the branch: the evidence ran on throwaway PR #101, closed unmerged, as DL-105 and DL-091 require.
  - **Labels:** the PR carries only the three review labels. Its `ai-delivery` and `feature` labels are missing, which the playbook requires (§2.2); the orchestrator adds them.
  - **Reviews:** `docs/06-reviews/AQP-216/*.md` (main folder, uncommitted); Jira 11110 (standards), 11113 (quality), 11109 (performance).
  - **Not done:** no code read or run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | All APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0, and no Major |
| 3 | Security | | ✅ | The nightly workflow is acceptable; apt signatures still apply on the fallback mirror; the parser rejects names that look like options; cache trust is rooted in `master`; the required check is unchanged |
| 4 | Evidence quality | | ✅ | Quality read the evidence logs, which match, and caught 14 of 15 planted faults. Performance verified everything from the API. A natural stall in run 42205780147 showed the 90 s limit working live, with recovery in 118 s |
| 5 | Minors | | ⚠️ | Ruling 1 |

**Rulings**
1. **Fixed before G7, in one push:**
   - **STD-01:** remove the six `as` casts in `playwright-system-deps.test.ts` and `playwright-deps-packages.test.ts` (coding standards §10).
   - **STD-02:** `ci-workflow.test.ts:348` compares constants (`3*(45+90) < 480`), so it can never fail. It must read the limits from the script and the workflows, so that a change to either is checked.
   - **QLT-93:** the line that rewrites the runner's `mirror+file:` sources to `archive.ubuntu.com` has no test. Deleting it passes everything, yet it is what makes the fallback work on the real runner. Add a test that fails when that rewrite is removed.

   Those three are test code, so **master verifies them (DL-047)**.
2. **QLT-95 (`apt-get update --error-on=any`) goes to the solution-architect for a ruling before the push.** On the real runner a dead mirror's `update` exits 0, which bears directly on whether the fallback triggers. The flag might also turn harmless warnings red. If the architect adopts it, it goes in the same push with a test, and **reviewer-quality confirms that one script change narrowly (DL-091)**.
3. **Info, no action:** the optional `timeout --kill-after=10` (the developer's choice), QLT-94 and QLT-96.
4. **RISK-023:** lowered when the orchestrator reports the first full sharded nightly window. Performance recommends about 4. Until then it stays at 8.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #100 | STD-01, STD-02 and QLT-93 tests, plus QLT-95 if the architect adopts it; CI green | Before G7 |
| 2 | solution-architect | AQP-216 | QLT-95 ruling | Before the push |
| 3 | master; reviewer-quality (only if QLT-95 is adopted) | Same push | Verify | Before G7 |
| 4 | orchestrator | PR #100 | Add the `ai-delivery` and `feature` labels | Now |

**G7 evidence (DL-105, with its three additions):**
- **(a)** A branch run saves under the warmed key, then a run hits it.
- **(b)** An unreachable-mirror control stays within the bound and fails or falls back as designed.
- **(c)** The planted faults: removing the sources rewrite fails a test (QLT-93); changing a limit in the script or a workflow fails the STD-02 test.
- **(d)** Regression green on the final head, including stage 11b.
- **(e)** The `master`-scope proof is recorded after the merge without holding Done (DL-105): the first nightly warm-up, and the next PR run that restores from that `master` key. If it fails, QA raises a Sev-3 defect against STORY-10.16, to be fixed before G8.
- **(f)** Evidence runs only on a throwaway PR or by `workflow_dispatch`.
- **(g)** Done only after the posted G7.
- **Local-heavy runs wait until the delivery lead has cleared disk space.**

**Risks registered:** none (RISK-023 stays at 8 until the first sharded window).
**Rationale:** The design is sound and its evidence was taken the right way this time, on a throwaway PR. Two of the tests cannot fail on what they claim to check: one compares constants, and the other leaves the line that makes the fallback work untested. Those controls fail open, so they are fixed before QA in a push that master checks.

**AQP-74 DEF-017 test push checked — 2026-11-06 (master; DL-107 remediation 2). Result: sound for the main bypass form; one addition is required before QA attempt 2.**
- **Head and CI:** 6d53a86, one commit on 2843d13, three test files only: `tests/integration/audit/audit-atomicity.test.ts` (+159), `tests/support/late-failure.ts` (+67), and a one-line change in `tests/support/audit-database.ts`. CI 42226719888: success, with the new file 7 of 7.
- **My own check:** `late-failure.ts` read in full, the test titles and modes, and the transaction shape of every event in `src/server/services/user-service.ts` at 6d53a86. Each event's change and its `audit.record(tx, …)` share one `transactions.run`, so the product is atomic as written.

**How the helper catches a bypass, by form:**
- **Mode `after-the-last-step`:** the wrapper throws after the work of every *outermost* `transactions.run`, and a nested run (depth > 0) goes through.
  - **A bypass that writes the entry in its own transaction *inside* the change's unit of work** (a nested run on another connection, the natural form, and QA's attempt-1 plant) commits before the outer failure, so the entry survives and the test fails. **Caught.**
  - **A bypass that writes the entry in a sibling transaction *after* the change:** the change's run throws first, the entry is never written, and "no entry, no change" passes. **Not caught by this mode.**
  - **A sibling transaction *before* the change:** the wrapper also throws on that run, because it is outermost, so the entry is rolled back. **Not caught**, and masked by the wrapper itself.
- **Mode `refuse-entry`**, used today only in the name-plus-role test: if the entry is refused in a sibling transaction after a committed change, the change persists, so "no change" fails. **That catches the sibling-after form.**
- The paired positive check (the same change through the ordinary service gives exactly one entry) correctly stops "no entry" from passing on a change that never happened.

**Ruling**
1. **The design is accepted for the nested form, and one addition is required before QA attempt 2:** for each of the six events, a second test in **`refuse-entry` mode** (refuse that event's entry), asserting no change and no entry. Six small tests on the same helper. That covers the sibling-after form. **Test-only; master verifies (DL-047).**
2. **The sibling-before form is a stated limit, not a requirement.** An entry committed *before* its change in a separate transaction cannot be told apart, by any later failure, from an entry that should be there, without changing the product. The helper's comment states this limit. A code-review rule covers it instead: `audit.record` is always called with the transaction of the change it records. The solution-architect adds that sentence to architecture §6 with the audit design.
3. **The developer's self-check is not required before QA. QA's attempt-2 plants are the evidence**, and they become **twelve**: for each of the six events, (a) the entry moved into its own transaction **inside** the change's unit of work (the attempt-1 form), and (b) the entry moved into a sibling transaction **after** the change. Each plant must fail at least one test. That avoids running the same Docker-heavy series twice on a nearly full disk, and it waits for the clean-up.

**AQP-74 DEF-017 follow-up push verified — 2026-11-06 (master; ruling in 11117). Result: met. QA may run G7 attempt 2 with the twelve plants once disk space is clear.**
- **Head and CI:** c5e4e41, one commit on 6d53a86, two test files: `audit-atomicity.test.ts` (+93) and `tests/support/late-failure.ts` (+8 / −1). CI 42228339693: success; the atomicity file passes 13 of 13.
- **My own check:** the new block at c5e4e41 and the helper diff.

| Item | Result | Evidence |
|------|--------|----------|
| A `refuse-entry` test per event | ✅ | A new `describe` uses `refusesTheEntry` (`kind: 'refuse-entry', number: 1`, a fresh failing service per test, so the entry refused is the event's own). It covers `user.created` explicitly, and `user.renamed`, `role_changed`, `deactivated`, `activated` and `password_reset` through `it.each(SCENARIOS)`, where each scenario prepares the person through the ordinary service. Six events: 7 + 6 = 13 tests |
| Assertions | ✅ | The person and the log are exactly as before (`kindsAfter` compared sorted), then the same change through the ordinary service gives both the entry and the real change, so the test cannot pass trivially |
| Stated limit | ✅ | The helper comment names the before-the-change sibling form, and why neither mode can catch it, and cites 11117 |
| Review rule | ✅ | Architecture v0.29 §6 (architect 11118), with static checks to follow in GH #104 |

**QA G7 attempt 2:** the full 11106 list as before, plus **twelve plants**: for each of the six events, (a) the entry moved into its own transaction inside the change's unit of work, and (b) the entry moved into a sibling transaction after the change. Each must fail at least one test. DEF-017 is closed only after the posted G7 decision. The run waits for the disk clean-up.

**AQP-216 G6 conditions verified — 2026-11-06 (master; 11114). Result: met; G6 is closed and G7 may start.**
- **Head and runs:** ebd83be, two commits on 7bda9e0 (ab1d6a2, ebd83be), five files: README, `scripts/ci/playwright-system-deps.sh`, and three unit test files. CI 42234917024 and Nightly 42234917054 on ebd83be: success. Labels: `ai-delivery` and `feature` are now present. Throwaway PR #105 is closed unmerged, and there are no evidence commits on the story branch.
- **Re-review:** quality's narrow round 2 (11122) APPROVEs QLT-93 and QLT-95. A dead mirror's update fails with status 100 after 17 s, and try 2 on `archive.ubuntu.com` succeeds; isolation and signatures are confirmed; 10 of 10 planted faults are caught.
- **My own check:** the script diff for ebd83be and the key lines at ebd83be.

| Item | Result | Evidence |
|------|--------|----------|
| STD-01 | ✅ | The six casts are replaced by an `as const` list and a `Map` (developer 11121; quality's round 2) |
| STD-02 | ✅ | `ci-workflow.test.ts` reads 45 s, 90 s and 3 tries from the script, and 8 minutes from `ci.yml`, expecting `[45, 90, 3, 8]`. Changing 45 to 60 on #105 (42234600018) fails exactly that test |
| QLT-93 | ✅ | Each try gets its own apt view, with `Signed-By` kept and `/etc/apt` sources read only (lines 22 to 52). Removing the rewrite fails 6 script tests (42233860764) |
| QLT-95 (adopted per architect 11115) | ✅ | `apt-get update … --error-on=any` on the update only (line 121) |
| A real defect found by the evidence | ✅ | apt runs as root and leaves root-owned files in the view, so the plain `rm -rf` failed after a good install. Now `sudo rm -rf -- "${view}"`, with `|| true` in the EXIT trap (line 66), so a cleanup problem cannot turn a good install red; a regression test covers it. Quality's round 2 confirms the sudo cleanup is safely scoped |
| `--kill-after` | n/a | Optional, and not taken: three tries already use 405 of the 480 s cap |

**Ruling on the local secret scan (DL-098):**
- `gitleaks git` was refused by the worktree guard, so the developer ran `gitleaks dir` (8.30.1, its SHA checked against `ci.yml`) on the changed paths, and it found nothing. **For this push it is accepted**, because CI stage 2's full-history scan on ebd83be is green and covers both commits.
- **The rule stands, clarified:** `gitleaks dir` scans only the final tree, so with two or more commits a secret added in one commit and removed in the next would pass. When `gitleaks git` is unavailable, either push a single commit, or scan each commit's tree with `gitleaks dir`. Otherwise do not push; report BLOCKED. The solution-architect may add a worktree-safe form of `gitleaks git` (for example, a `--log-opts` range) to the README.

**G7 evidence (DL-105, the 11114 list, confirmed):**
- **(a)** Save then hit: 42230394633 (a 21 / 20 s save), then 42231271036 (6 / 3 s, no download).
- **(b)** Dead-mirror control: 42232188426 and 42233000524. Try 1's update fails with status 100 after 16 to 17 s, try 2 completes, and 12a takes 40 to 54 s, within the bound.
- **(c)** Planted faults: the rewrite removed fails (42233860764); a limit changed fails STD-02 (42234600018).
- **(d)** Regression green on the head, including stage 11b, with 12a at 3 s on a hit.
- **(e)** The `master`-scope proof is recorded after the merge without holding Done: the first nightly warm-up, then the next PR run restoring from the `master` key.
- **(f)** Evidence only on a throwaway PR or by `workflow_dispatch`.
- **(g)** Done only after the posted G7.

QA reads each run log itself.

---

## G7 – QA Acceptance — AQP-216 (STORY-10.16: cache warm-up and bounded install) — 2026-11-06

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #100 at head 80fab66, which adds only `docs/07-qa/AQP-216-test-report.md` on ebd83be (`gh api compare`). It was pushed as a single commit after `gitleaks git` exited 0, which meets DL-098 and DL-108. CI 42239381940: success on all four jobs.
  - **QA:** Jira 11124; PR comment 6688048994. QA read every log through the API.
  - **Not done:** no run of my own.

| # | Check (11114, 11123) | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | (a) Save, then hit | ✱ | ✅ | 42230394633 missed in both shards within the bounds and cached 9 packages. The key was saved by the Nightly warm-up on the same commit (42230394560), and the shards' own saves lost that race harmlessly. 42231271036 then hit in both shards with no download (6 s and 3 s) |
| 2 | (b) Dead-mirror control | ✱ | ✅ | In every shard that missed, try 1's update failed with status 100 after 16 to 17 s, with nothing downloaded; try 2 on `archive.ubuntu.com` succeeded; 12a 40 to 54 s against a 4-minute bound. Both control runs were red only at the unit stage, by design: each changed only `ci.yml`, and the nightly-parity test caught that |
| 3 | (c) Planted faults | ✱ | ✅ | The rewrite removed fails 6 script tests; the limit changed fails exactly the STD-02 test |
| 4 | (d) Regression | ✱ | ✅ | Green on the head: 2071 unit and 2864 stage-11 tests, E2E 0 failures, both shards and the Nightly warm-up hit, 11b within the limit |
| 5 | (f) Evidence location | ✱ | ✅ | Throwaway PRs #101 and #105 are closed and unmerged; all four commits on PR #100 are feature or fix commits |
| 6 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **AQP-216 is accepted. QA moves it to Done now that this decision is posted (DL-098).** The delivery lead squash-merges.
2. **(e) The `master`-scope proof is recorded after the merge without holding Done (DL-105):** the first nightly warm-up on `master`, then the next PR run restoring from that `master` key. If it fails, QA raises a Sev-3 defect against STORY-10.16, to be fixed before G8.
3. **RISK-023** is lowered when the orchestrator reports the first full sharded nightly window (performance recommends about 4).

**Risks registered:** none.
**Rationale:** The warm-up and the bounded fallback are proved by save then hit, by a real dead-mirror control that falls back within the bound, and by planted faults that fail the tests they should. The evidence stayed off the story branch, and the final push was scanned as the rule requires.

---

## G7 – QA Acceptance — AQP-74 (audit log) — attempt 2 — 2026-11-07

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (attempt 1 NO-GO, DL-107)
- **Artefacts evaluated:**
  - **PR and CI:** PR #97 at head 1a4cdae, which adds only the attempt-2 section of `docs/07-qa/AQP-74-test-report.md` on c5e4e41 (`gh api compare`). It was pushed as a single commit after `gitleaks git` exited 0 (DL-108). CI 42259699913: success. Product code is unchanged since the attempt-1 evidence, so those results stand.
  - **QA:** Jira 11128; PR comment 6690919453.
  - **Not done:** no run of my own.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | **Audit atomicity: twelve planted bypasses (11117, 11120)** | ✱ | ✅ | For each of the six events: *inside* (the entry in its own transaction inside the change) fails that event's late-failure test, and *sibling-after* (a separate transaction after the change) fails that event's `refuse-entry` test. **12 of 12 caught.** Activation and rename, the attempt-1 gaps, are now caught by real assertions. Clean baseline 260 of 260; the file was restored after every plant. The "before" form stays the stated limit, covered by the architecture v0.29 §6 review rule |
| 2 | QLT-92 strings | ✱ | ✅ | Live, on an empty database: "No entries yet", its text, the page description and the meta all match exactly; no "Showing N of M" and no button. Only the description has an automated test, so QLT-92 stays Info |
| 3 | Live log check | ✱ | ✅ | Invented e-mails sent through refused users and audit requests never reach the application log. The production server prints no request lines |
| 4 | Rest of the 11106 list | ✱ | ✅ | Stands from attempt 1 (append-only, events, `actor_label`, Who filter, people list, 403, From/To, lock, PRF-03, lint ban, pins, three widths); `/audit` 171,801 B |
| 5 | No open Sev-1 or Sev-2 | ✱ | ✅ | None |

**Rulings**
1. **DEF-017 is closed. QA closes it, and moves AQP-74 to Done, now that this decision is posted (DL-098).**
2. **The one failure under parallel database files is Environment**, repeated and not counted (DL-068). It passed alone and in the sequential baseline, and CI is green. The disk clean-up during the run had deleted QA's scratch folders, and QA reinstalled and re-ran all twelve plants from scratch, which is the right handling. **If the same test fails on CI**, it becomes a Test defect.
3. **The development server prints request URLs with their query strings.** This is development-only and not a defect: the production server prints no request lines, and the Who filter goes by `actor_id`, not by e-mail. Noted for 10.04, so that the deployed image runs `next start` (production) only, in line with DL-086.
4. **Merge:** AQP-216 has merged, so PR #97 updates from `master` through GitHub and waits for green CI, including stage 11b. Master re-checks only if the update changes this PR's own diff. Then the delivery lead squash-merges.

**Risks registered:** none.
**Rationale:** The gap that failed attempt 1 is closed with evidence of the right kind: two bypass forms per event, each caught by an assertion built for it. The one form that cannot be caught is stated, and covered by a written review rule.

---

## G6 – Peer Review — AQP-113 (STORY-02.01: Process master, with the DEF-006 fix) — 2026-11-06

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #107 at head 62267af (`origin/feat/AQP-113-process-master` read back at that SHA). CI 42316869370: success on all four jobs (Stages 1 to 11, Stages 1 to 11b, E2E shards 1 and 2), read through the check-runs API. Merge state "behind" (docs-only 86ffb16 on `master`).
  - **Reviews:** `docs/06-reviews/AQP-113/standards.md`, `quality.md`, `performance.md` (main folder, not committed); PR reviews 5808860041 (standards), 5808899305 (quality), 5808878362 (performance); Jira AQP-113 11136, 11138, 11137; developer hand-off 11134; brief 11135.
  - **My own checks:** (1) QLT-01 reproduced with my own throwaway unit test in the scratchpad worktree at 62267af (invented names, not in the repository): the forward order is refused; compound first and then both parts is accepted at each step; the rename path is accepted; and a stored `{{rate:A}}-{{rate:B}}` comes back from display form as the compound rate. 4 of 4 assertions held, so the defect is real. (2) QLT-02 read at `process-items.test.ts:281-298`: the order comes from `ORDER BY created_at, id`, with a millisecond `created_at` and a random UUID `id`. A tie between the compound and the second part reorders them, and line 295 then fails on a correct run. (3) The service code read at `masters-service.ts:80-85`, `110-190`: only the new name is judged; delete takes no table lock; `usesByRate()` runs after the commit in create and update. (4) STD-07: I read only the decimal parts of the five comment examples. None ends in `.37`, so the comments do not follow the ADR-014 invented pattern. I did not compare them with any source, and that is not permitted. (5) `ProcessScreen` starts at line 74 of a 265-line file, matching STD-01.
  - **Not done:** no DB-backed or E2E run of my own (CI is the reference run); no comparison of values with the workbook.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards REQUEST CHANGES (Major 1, Minor 7, Info 6); quality REQUEST CHANGES (Major 2, Minor 6, Info 6); performance APPROVE WITH COMMENTS (Minor 2, Info 4). All three are on head 62267af |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in every report. STD-07 is held Minor on the condition below, and would become a Blocker if any example value is real |
| 3 | Majors fixed or explicitly accepted | | ⚠️ | STD-01, QLT-01 and QLT-02 are upheld and must be fixed before G7. None is accepted (rulings 1 to 3) |
| 4 | Findings cite file:line | | ✅ | Every finding in the three reports, and the inline comments on the PR |
| 5 | Precondition from #35 (due at 02.01's G6) and #48 item 2 | | ✅ | `rateNameIssues` refuses column letters, numbers, operators, operand names and duplicates. It is called on create and rename, its messages carry no name, and it has its own tests (`rate-names.test.ts`, `masters-service.test.ts`). The DEF-006 part of the same class is QLT-01 |
| 6 | Blocking dependency AQP-169 (10722) | | ✅ | Merged (PR #70); stage 11b ran on this head: `/masters/process` 172,551 B, 17,449 B under the 190,000 B target |
| 7 | AQP-57 dependency (CR-34) | | ⚠️ | Not merged. The interim canary scan is accepted (ruling 5) |

**Rulings**
1. **QLT-01 (Major) is upheld and fixed in this PR.** This PR exists to fix DEF-006, and DEF-006 can still be reached through this story's own screen (reproduced above). The result is a stored formula that prices a different rate after a display round trip, with no error, which is a correctness risk to a price.
   - **Behaviour required:** on create and on rename, the whole resulting set of names is judged. The change is refused if the new name reads as other names and operators. It is also refused if any existing name would read that way once the new name joins.
   - **Placement:** the rule lives in the formula engine (`src/lib/formula/rate-names.ts`, for example `rateSetIssues(names)`), so the service and any later formula editor share it.
   - **Message:** the refusal names no rate (the STD-05 rule).
   - **What it could break:** the 15 seed names must still form a safe set, with a test that says so. A rename that changes only letter case must still pass.
   - **Tests:** unit tests for compound-then-parts (the second part refused), the rename path (the second rename refused) and the forward order (still refused). The same three cases as integration tests against PostgreSQL.
2. **QLT-02 (Major) is upheld and fixed in this PR.** The race test belongs to the load- and timing-sensitive class (DL-057), where retries are off, and the developer fixed the same tie elsewhere in this PR. After QLT-01 the outcome is the same in every order. The test asserts that **exactly two of the three creations succeed and the third is refused with `RATE_NAME_REFUSED`**, with no ordering query. Two deterministic sequential tests are added: parts then compound, and compound then parts.
3. **STD-01 (Major) is fixed in this PR, not deferred, and STD-02 goes with it.** The 40-line rule (Coding Standards §1) was held the same way at AQP-97 (STD-01, STD-02) and AQP-28 (STD-18): in the files that later stories copy. `ProcessScreen` is the first masters screen, and the customers, materials and exchange-rate screens will copy it. A production-code round with re-review is already required for QLT-01, so the split adds no extra round.
   - **Scope:** `ProcessScreen`, `ProcessForm` and `ProcessList` each come within 40 lines, or carry a one-line inline justification that reviewer-standards accepts.
   - **`AuditScreen` on `master`** (`audit-screen.tsx:57-206`) is outside this PR. It is **deferred to tech-debt #110** (developer; the next story that changes the audit screen, or before the sprint 1 review).
4. **Every Minor is fixed in the same push.** They are cheap, and one re-review covers them.
   - **QLT-03 = PRF-01:** `lockProcessItems` is the first statement of the delete transaction. Test: a delete and an update of one rate raced, and neither ends in a 500. Mapping 40P01 to `DatabaseBusyError` is optional; if it is added, it gets a test.
   - **QLT-05:** read the uses before `transactions.run` in create and update. Test: a failed configuration read writes no row and no audit entry.
   - **QLT-06:** a 404 in the edit or delete dialog closes the dialog, refreshes the list and says the rate no longer exists. The wording comes from the ux-expert (condition 5). Test it.
   - **QLT-08:** tests for the skeleton after 300 ms (with `aria-busy`) and for the empty state with "Add rate" visible.
   - **STD-03 to STD-06, STD-08:** as each reviewer suggests.
   - **STD-07:** every example value in the five comments, and in the `trimDecimalText` comment, changes to the `n.37` pattern. The developer states in the PR that none came from the workbook or any other real source. **If any did, the developer stops and reports BLOCKED; the finding becomes a Blocker.** The branch is already public, so only the delivery lead can decide on its history (RISK-006); agents do not rewrite it.
   - **Cheap Info in the same push:**
     - STD-09: rename the migration folder to its real creation time. It has never been merged, so a rename is allowed.
     - STD-10 and STD-11.
     - QLT-12: check the default value only when it changed, with a test.
     - STD-14: update the branch from `master`.
   - **Before the push:** Gitleaks as DL-108 sets out (one commit, or `gitleaks dir` per commit). Stage files by name.
5. **AC-6, interim canary (QLT-07): accepted for G6 and G7.** At G7, AC-6 is judged on the interim scan, `tests/security/process-master-confidential.test.ts`, which checks every Engineer route and the Process master's routes and page. The `canaryMasters` part moves to AQP-57: 01.03 imports `PROCESS_MASTER_CANARIES` from `tests/support/process-master-canary.ts` rather than copying it. The product-owner records this on AQP-57. This is a move between stories, not a product scope change.
6. **Routed, not fixed here:**
   - **QLT-04** goes to tech-debt #111: the config-publish story, with the architect's rule in its Dev Context before Ready.
   - **PRF-02 and the `@one-width` list:** the architect rules. If the ruling comes before the push, the §10.5 row is written first and the tags go in the push. Otherwise the ruling holds nothing.
   - **PRF-03 and PRF-05:** no action.
   - **PRF-04:** the architect, when the load test is planned.
   - **PRF-06:** the product-manager.
   - **STD-12, QLT-09, QLT-13:** the solution-architect.
   - **QLT-10:** the product-owner.
   - **QLT-11:** the ux-expert and the product-owner.
   - **STD-13:** the wording is below, to be applied in the governance docs PR.
7. **Re-review: all three reviewers, on the new diff only, before QA** (DL-051; the AQP-74 fix-push precedent). The push adds a new name rule, a lock change, error paths and a component split. All three are production code, so master's own verification is not enough.
   - **Quality:** QLT-01 with **one planted fault per case** (remove the new-name check; remove the existing-name check; skip the check on rename), each failing a test. QLT-02 with no ordering dependency. QLT-03, 05, 06, 08 and 12.
   - **Standards:** STD-01 to STD-08, and the STD-07 statement is present in the PR.
   - **Performance:** the cost of the set check inside the table lock at n = 15 and n = 100 (it grows to about n² · L), and stage 11b after the split.
   - **Then:** master checks the push against this record, with CI green on the final head. That check is not a new G6 attempt.
8. **DEF-006 (AQP-181, #49) is not closed on 8d15405.** QA closes it at G7, on the final head, after a planted-fault check of each direction and the rename path.

**STD-13 wording (Coding Standards §10 SQL, last bullet), to be applied in the governance docs PR:** "Cost, rate and formula fields must never be sent to an Engineer, or written to a log line, an e-mail, a Jira issue or the repository (architecture §5.3, Restricted)."

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #107 | One push with rulings 1 to 4: QLT-01, QLT-02, STD-01, STD-02, QLT-03, QLT-05, QLT-06, QLT-08, STD-03 to STD-08, the STD-07 statement in the PR, STD-09 to STD-11, QLT-12, the branch updated from `master`, and Gitleaks per DL-108 | Before the re-review |
| 2 | reviewer-standards, reviewer-quality, reviewer-performance | `docs/06-reviews/AQP-113/*.md` (round 2), PR reviews | Re-review the new diff only, as ruling 7 sets out; each reviewer changes only their own PR label | Before G7 |
| 3 | master | gate log | Check the push against this record; CI green on the final head | Before G7 |
| 4 | product-owner | AQP-113 AC-5; AQP-57 | AC-5 text to `master.created` / `master.edited` / `master.deleted` with `object_type` `process_item` (architecture §8). A note on AQP-57 that 01.03 imports `PROCESS_MASTER_CANARIES` (ruling 5) | AC-5 before G7; AQP-57 before it starts |
| 5 | ux-expert; product-owner | ux-spec SCR-11; AQP-113 AC-4 | The wording for a rate deleted elsewhere (QLT-06). Whether the refusal links to the planned `/config/fields` or shows the label as text while the route is planned (QLT-11); if it changes, the product-owner amends AC-4 | QLT-06 wording before the push; QLT-11 before G7 |
| 6 | solution-architect | test strategy §10.5; architecture §5.1, §5.6, §9.2, §10; test strategy §10 | Rule on the three `@one-width` tests (PRF-02). STD-12 (1) to (3); the line for same-transaction audit entries compared as a set (QLT-09); 14 to 15 rates (QLT-13). Rule for #111 in the config-publish story | `@one-width` before the push if possible, otherwise no hold; documents before the sprint 1 review |
| 7 | product-manager | PRD NFR-011 | A master-data volume (rates, customers, materials) (PRF-06) | Before the customers and materials stories reach Ready |
| 8 | orchestrator | `docs/standards/coding-standards.md:95` | Apply the STD-13 wording above in the governance docs PR | Next governance docs PR |
| 9 | qa-engineer | DEF-006 (AQP-181, #49) | Do not close it on 8d15405; close it at G7 on the final head (ruling 8) | G7 |
| 10 | developer | #110 | `AuditScreen` split | The next audit-screen story, or the sprint 1 review |

**G7 evidence (full QA cycle, on the final head):**
- **Each AC with evidence.** AC-5 is read against the corrected text. AC-6 is judged on the interim scan (ruling 5).
- **DEF-006:** compound-then-parts, parts-then-compound and the rename path are each refused through the API, and a planted fault for each case fails a test.
- **Audit trail (AQP-74 rule):** for each of the three events (`master.created`, `master.edited`, `master.deleted`), one entry is written in the change's transaction, and a planted bypass fails a test. A refused change writes no entry.
- **Locks:** a delete and an update of one rate raced end without a 500.
- **Error paths:**
  - a failed configuration read writes nothing (QLT-05);
  - a rate deleted elsewhere is handled as QLT-06 sets out;
  - the skeleton and the empty state (AC-8).
- **Screens:** three widths, axe with `wcag21a` 0, keyboard, 44 px.
- **Stage 11b:** every route under 190,000 B.
- **Regression:** green.
- **Closure:** Done only after the posted G7 (DL-098). Evidence runs only by `workflow_dispatch` or a throwaway PR (DL-091).

**Risks registered:** none new. RISK-006 reviewed, score unchanged (STD-07, ruling 4).
**Rationale:** No Blocker or Critical is open, so G6 can pass by the procedure, but three Majors are upheld. The DEF-006 fix, which this PR exists to make, still lets the defect through in the reverse order and on rename (reproduced). A new test can fail at random. The first masters screen breaks the size rule that later screens will copy. All three are fixed in one push with the cheap Minors, then re-reviewed by all three lenses before QA, because the push is production code.

---

## G6 – Peer Review — AQP-113 (STORY-02.01) — round 2: check of the fix push against the record, and QLT-15 — 2026-11-06

- **Status:** the decision stays **CONDITIONAL GO** (attempt 1, record above). The conditions are **not yet all met**: condition 1 is met for every item it named, but QLT-15 (new Major) adds one more push before G7. This is a conditions check, not a new attempt.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR and CI:** PR #107 at a4d4d57. This is 66ae511 (fix commits 7bec601, bc09fac, f2e9fe1, 66ae511) plus a merge of `master` 86ffb16. By `git diff --name-only 66ae511 a4d4d57`, the merge changes nothing outside `docs/`. CI 42326697243 on 66ae511 and 42327412105 on a4d4d57: success on all four jobs (check-runs API).
  - **Re-reviews (round 2, new diff only):**
    - standards APPROVE WITH COMMENTS (11146; `standards.md` Round 2);
    - performance APPROVE WITH COMMENTS (11145; `performance.md` Round 2);
    - quality REQUEST CHANGES (11147; `quality.md` Round 2).
  - **Other inputs:** developer 11144; product-owner 11142 (AC-4, AC-5; AQP-57 note 11141); ux-expert 11143 (ux-spec v0.17, SCR-11).
  - **My own checks:**
    - I read `rateSetIssues` and `assertNameUsable` at 66ae511.
    - I reproduced QLT-15 with my own throwaway unit test in the scratchpad worktree at 66ae511, with invented names (not in the repository). **(a) Prefix shadow:** the set `Pa`, `Qb-Rc`, `Pa-Qb`, `Pa-Qb-Rc` passes `rateNameIssues` and `rateSetIssues` in three different add orders. A stored `{{rate:Pa}}-{{rate:Qb-Rc}}` then comes back as the single rate `Pa-Qb-Rc`. **(b) Overlap:** the set `Pa`, `Qb-Rc`, `Pa-Qb`, `Rc` passes in two orders, and the same formula comes back as `{{rate:Pa-Qb}}-{{rate:Rc}}`. **Control:** with spaces round the operator, the formula round-trips exactly in set (b).
  - **Not done:** no PostgreSQL or E2E run of my own (CI is the reference); I did not repeat the planted faults (quality's table is the evidence).

| # | Check against the round-1 record | Result | Evidence |
|---|-------|--------|----------|
| 1 | QLT-01 (whole set judged on create and rename) | ✅ for the cases named | `rateSetIssues([...others, name])` in `assertNameUsable`; 15 seed names tested as a safe set; planted faults F1 to F4 each fail tests (quality, Round 2) |
| 2 | QLT-02 | ✅ | `process-items-names.test.ts:104-120`: 2 fulfilled and 1 `RATE_NAME_REFUSED`, 6 rounds, no ordering query |
| 3 | STD-01, STD-02 | ✅ | `ProcessScreen` about 30 lines; form and list split; only the two factories exceed 40 lines, each with an inline justification |
| 4 | Minors (QLT-03 = PRF-01, QLT-05, QLT-06, QLT-08; STD-03 to 06, STD-08) | ✅ | Each reported fixed with tests. QLT-06 uses the 11143 wording word for word |
| 5 | STD-07 statement | ✅ | Statement in the PR body and in 11144: none came from a real source, and the workbook was never opened. No old value is left in `src`. RISK-006 trigger not met |
| 6 | Info (STD-09 to 11, QLT-12, STD-14) | ✅ | Migration folder `20261106182200_process_items` (a pure rename); branch updated |
| 7 | AC-4, AC-5 text (product-owner) | ✅ | 11142: plain text, Close only; `master.created/edited/deleted` |
| 8 | Re-review by all three, planted fault per DEF-006 case | ✅ | All three Round 2 sections; four faults, each caught |
| 9 | Stage 11b and CI time | ✅ | `/masters/process` 173,440 B (16,560 B to the target); required path 5m15s |
| 10 | No new Blocker or Critical | ✅ | 0 in all three |
| 11 | New Major | ❌ | QLT-15, reproduced by master |

**Rulings**
1. **QLT-15 (Major) is upheld. The R1 half is fixed in this PR now. The R2 half is split off to #112 with its reason.** Whether a name is ambiguous depends on how the display form is read, not on the names alone. So no check on names alone can be both complete and free of false refusals. The safe property is about the stored formulas: **every stored formula round-trips unchanged under the current names.** In R1, the only write that can break this is a create or rename of a rate; no screen writes a formula from display form. That half is cheap and exact, and it belongs to this story, which exists to fix DEF-006. The other write paths (formula edit, re-lettering, publish, revert) do not exist until EPIC-08, so they cannot be built or tested here. They go to #112, with owners and a due point, rather than holding this story.
   - **Behaviour required (`assertNameUsable`, create and rename):** refuse with `RATE_NAME_REFUSED` unless, for every formula the current configuration stores, `toInternalForm(toDisplayForm(f, next), next) === f`. Here `next` is the rate set the change would leave, with the configuration's own fields.
     - **Configuration read:** the configuration already read before the transaction (QLT-05) is used; nothing new is read inside the lock.
     - **Delete:** needs no check. Removing an unused name cannot change a greedy reading.
   - **Message:** it names no rate and no formula: "This name would change how an existing formula reads, so it cannot be used." The ux-expert may refine it in the spec later; the push does not wait for that.
   - **Keep `rateNameIssues` and `rateSetIssues` as guards** for formulas not yet written. **QLT-17 is fixed in the same push:** report only set issues that the change introduces (the set before against the set after), so that an already-unsafe stored set does not refuse every add and rename.
   - **Tests:**
     - **Service unit tests, with an injected configuration that holds a formula `{{rate:A}}-{{rate:B}}`:** both probe shapes (a) and (b) are refused at the step that would break the formula, both for adds in every order that reaches them and for renames.
     - **What it could break:** the seed names with the seed configuration are still accepted. A rename that changes only letter case is accepted where it breaks no formula. A name that makes the set unsafe but breaks no stored formula is decided by the guards as before.
     - **Integration:** one PostgreSQL test, if the harness can hold such a configuration version; otherwise the Dev Record says why not.
   - **Cost:** the developer reports the timing at n = 15 and n = 100 with the seed configuration in the Dev Record. Performance does not re-review unless the figure at n = 100 is over 50 ms.
2. **DEF-006 (AQP-181, #49):** it closes at G7 on the head with this fix, if QA's DEF-006 checks pass: probes (a) and (b) through the API, plus the round-1 cases. Closure is for the R1 defect; #112 carries the R2 write paths as new work, not as DEF-006.
3. **Cheap Info in the same push**, since a production-code push is required anyway:
   - **QLT-16:** hold the route on a promise the test releases, not a fixed 1.5 s (DL-057 class);
   - **STD-15:** rename `useOpeners` and `useOutcomes`;
   - **STD-16:** name `[overflow-wrap:anywhere]` once;
   - **STD-17:** `n.37` test values; "about 20 lines".
4. **Re-review: narrow, by the finding's owner (DL-091).** reviewer-quality re-reviews QLT-15, QLT-16 and QLT-17 on the new diff, with **a planted fault for each case**: the round-trip check removed (both probe shapes, create and rename), and the before/after comparison removed (QLT-17). Each must fail a test. Master then checks STD-15 to STD-17 within the named files and CI green on the final head. G7 follows.
5. **Routed:**
   - **PRF-07** goes to the product-manager with PRF-06: state the master-data volume, with a revisit trigger at about 300 rates in the PRD, before the customers and materials stories reach Ready.
   - **PRF-02 (`@one-width`)** stays with the architect, with no hold.
   - **STD-12** stays with the architect, and **STD-13** with the governance docs PR (condition 8).

**Conditions / remediation (round 2)**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| R2-1 | developer | PR #107 | One push: QLT-15 R1 half and QLT-17 (ruling 1); QLT-16, STD-15 to STD-17 (ruling 3); the timing figures; Gitleaks per DL-108; stage files by name | Before the narrow re-review |
| R2-2 | reviewer-quality | `quality.md` Round 3; PR review | Narrow re-review with the planted faults of ruling 4; change only their own label | Before G7 |
| R2-3 | master | gate log | Check STD-15 to STD-17 within the named files; CI green on the final head | Before G7 |
| R2-4 | solution-architect; product-owner | architecture; ADR-005; STORY-08.02, 08.03, 08.05, 08.06 | #112: the invariant at every formula write path, and the display-form choice; the matching AC lines | Before STORY-08.02 reaches Ready |
| R2-5 | qa-engineer | DEF-006 verification | Add probes (a) and (b), through the API | G7 |
| R2-6 | product-manager | PRD NFR-011 | Master-data volume and the 300-rate revisit trigger (PRF-06, PRF-07) | Before the customers and materials stories reach Ready |

Round-1 conditions 4 to 7 and 10 stand as recorded. Condition 9 is amended by ruling 2.

**G7 evidence:** as in the round-1 record, plus:
- probes (a) and (b) refused through the API;
- a refusal that names no rate or formula;
- the seed set and the seed configuration still accepted;
- QLT-17 (an existing unsafe set does not block an unrelated rename).

**Risks registered:** RISK-024 (new, 8): ambiguous display form in the R2 formula write paths (#112).
**Rationale:** The fix push meets every item the record named, and the reviews found nothing Blocker or Critical. But the defect it fixes is still reachable by two shapes that I reproduced. A rule on names alone cannot close it, so the check moves to what must stay true: stored formulas round-trip. In R1 that is enforced at the only write path that exists. The R2 write paths are split to #112 with owners, because they cannot be built in this story.

---

## G6 – Peer Review — AQP-113 (STORY-02.01) — final check against the round-2 record — 2026-11-07

- **Decision:** the round-2 conditions are **met**, and G6 is **closed**. The CONDITIONAL GO (attempt 1) stands with no open developer condition. AQP-113 may go to G7.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR and CI:** PR #107 at c262853 (`gh pr view`: head `c2628534…`, merge state CLEAN). The commits after a4d4d57 are 5182720 (QLT-15 R1 half, QLT-17, STD-17) and c262853 (QLT-16, STD-15, STD-16). CI 42330556486 (event `pull_request`, head c262853): success on all four jobs (`gh api …/commits/c262853/check-runs`).
  - **Reviews:** quality Round 3, narrow (Jira 11151; `quality.md` Round 3): APPROVE WITH COMMENTS, Info QLT-18 and QLT-19. Labels: standards, quality and performance all approved.
  - **Developer:** Jira 11150. Timing about 20 ms at n = 100, under the 50 ms line, so performance has no re-review (DL-110 ruling 1).
  - **My own checks:**
    - `git diff 5182720 c262853 -- src tests/e2e` (6 files) read in full.
    - The STD-17 hunks of 5182720 read (5 test-value hunks and 1 comment).
    - `rate-name-rules.ts` and `formula-round-trip.ts` read at c262853.
  - **Not done:** I did not repeat the planted faults or the PostgreSQL and E2E suites (quality's table and CI are the evidence). The Atlassian and GitHub MCP servers were unreachable this session. GitHub was read and written with `gh`, and the Jira texts were handed to the orchestrator to post.

| # | Check against the round-2 record | Result | Evidence |
|---|-------|--------|----------|
| 1 | R2-1 QLT-15, R1 half | ✅ | `assertNameUsable` (`rate-name-rules.ts`) is called on add and on a name change. Its last question is `fieldsBrokenByChange`, which tests `toInternalForm(toDisplayForm(f, after), after) === f` for every output formula. Only output fields hold a formula (`rate-usage.ts` says the same). It uses the document read before the transaction. `removeInTransaction` has no name check. The message is exactly `ROUND_TRIP_MESSAGE`, as ruled, and names no rate or formula |
| 2 | R2-1 QLT-17 | ✅ | The ambiguity guard and the round trip both compare after with before (`wasAmbiguous`; `alreadyBroken`) |
| 3 | R2-1 QLT-16 | ✅ | `process-master.spec.ts:306-328`: the GET is held on a promise and released after the skeleton and `aria-busy` are asserted. No fixed delay, no timeout raised, no retry (DL-057) |
| 4 | **R2-3 STD-15 (checked by master)** | ✅ | `useOpeners` is now `openersFor` and `useOutcomes` is now `outcomesFor` (`use-process-master.ts:105, 126, 158`). The renames only: no `use` prefix is left on a function that calls no hook, and the callers changed with them |
| 5 | **R2-3 STD-16 (checked by master)** | ✅ | `BREAK_LONG_NAMES = '[overflow-wrap:anywhere]'` once, in `process-texts.ts`, with a comment that Tailwind finds the class there. All four uses are replaced (delete dialog twice, form title, page notice). `git grep` at c262853 finds the literal nowhere else in `src`, and neither old hook name remains in `src` or `tests`. One cosmetic point: in `process-delete-dialogs.tsx` the new name is imported between `BLOCKED_CLOSE` and `BLOCKED_TITLE`, not in alphabetical order. It needs no action, since there is no lint rule and STD-06 is about module order |
| 6 | **R2-3 STD-17 (checked by master)** | ✅ | The test values in `master-repository.test.ts`, `process-items-lib.test.ts` and `masters-service.test.ts` now follow the `n.37` pattern; the integer-padding cases use whole numbers. The comment at `master-repository.ts:121` reads "about 20 lines or fewer". No other change in those files |
| 7 | R2-1 timing | ✅ | About 20 ms at n = 100 (11150), under 50 ms. Performance's PRF-07 and the PRD volume stay with the product-manager (R2-6) |
| 8 | R2-2 narrow re-review with planted faults | ✅ | G1 (round trip off), G1a (add only), G1b (rename only), G2 (round-trip before/after off), G3 (guard before/after off): 6, 4, 2, 2 and 3 tests failed. Restored, nothing committed |
| 9 | Beyond the ruling | ✅ | Quality's own sets are refused: a column letter plus hyphen, spaced operators, and the renamed rate inside the formula. The first two are caught only by the round trip, which confirms the ruling's reason |
| 10 | CI and merge state | ✅ | 42330556486 green on c262853; CLEAN against `master` 86ffb16 |
| 11 | No new Blocker, Critical, Major or Minor | ✅ | QLT-18 and QLT-19 are Info |

**Rulings**
1. **G6 is closed. AQP-113 goes to G7 on c262853.** If the head changes before G7 (for example a branch update), the G7 evidence is gathered on the final head.
2. **QLT-18 (Info):** no action needed. The test title overstates its body, but the "a change that breaks a healthy formula is refused" half is proved by the set (a) and (b) tests and by fault G1. If the developer touches that file again before the merge, they shorten the title or add the assertion. That edit is test-only and needs no re-review.
3. **QLT-19 (Info):** recorded on #112. Older versions (revert), and a version published while a rename waits (#111), are part of the R2 write-path invariant. This needs no action in R1.
4. **Round-1 conditions for other roles:**
   - **Met:** 4 (product-owner 11141, 11142) and 5 (ux-expert 11143, product-owner 11142).
   - **Still open, holding nothing:** 6 (solution-architect: `@one-width`, STD-12, QLT-09, QLT-13), 7 and R2-6 (product-manager: PRF-06, PRF-07), 8 (STD-13 wording in the governance docs PR), 10 (#110), R2-4 (#112).
   - **At G7:** 9 and R2-5 (qa-engineer).

**G7 evidence:** the round-1 and round-2 lists stand. QA adds:
- probes (a) and (b) through the API;
- one of quality's extra shapes (a column letter plus hyphen) through the API;
- a check that every refusal message names no rate and no formula.

DEF-006 closes at G7 for R1 on that evidence (DL-110). Done only after the posted G7 (DL-098). Evidence runs only by `workflow_dispatch` or a throwaway PR (DL-091).

**Risks registered:** none new. RISK-024 unchanged (8).
**Rationale:** Every item of the round-2 record is in the code at c262853, and I checked the three standards items myself. Each planted fault, on each path, fails a test. The round trip also catches shapes the name rules never saw, which is why the ruling put the check on the formulas, not on the names.

---

## G7 – QA Acceptance — AQP-113 (STORY-02.01: Process master, with DEF-006) — 2026-11-07

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR:** PR #107 at e66e74b. It is c262853 plus the QA commit, which changes only `docs/07-qa/AQP-113-test-report.md` and `docs/07-qa/defects/DEF-006-…md` (`git diff --name-only c262853 e66e74b`).
  - **CI:** the reference run is 42330556486 on c262853: success on all four jobs. The run on e66e74b was still in progress when read (`gh api …/commits/e66e74b/check-runs`).
  - **QA:** the report (ACCEPT); PR comment 6713349197.
  - **QA's uncommitted files**, read in the scratchpad worktree `qa113`: `tests/acceptance/aqp-113-process-master.test.ts` (1,336 lines, 169 tests) and `tests/e2e/zz-qa-aqp113.spec.ts` (97 lines).
  - **Not done:** I did not run the suites or plant faults myself; QA's tables and CI are the evidence. Jira was unreachable for QA, the orchestrator and me.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report matrix: AC-1 to AC-9 pass, through the real route handlers over PostgreSQL and in the browser at 360, 768 and 1366 px. AC-4 and AC-5 are judged on the corrected text (product-owner 11142, quoted in the round-1 G6 record and the PR). AC-6 is judged on the interim scan (G6 ruling 5) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | No new defect at any severity. DEF-006 is verified for R1 |
| 3 | Regression recorded and green | ✱ | ✅ | CI 42330556486 green. Local: vitest 3,415 of 3,415 on the clean head; full browser suite 439 passed, 21 self-skipped by viewport, retries off. Two Windows load failures pass alone (DL-057 class, outside the PR, OBS-7) |
| 4 | Exploratory testing notes | | ✅ | Three charters (name rules, races and failures, hostile input) |
| 5 | Accessibility for the UI | | ✅ | axe with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`: 0 at three widths; keyboard; 44 px and 36 px targets |
| 6 | G6 evidence lists (rounds 1, 2 and final) | | ✅ | DEF-006: every case, including probes (a) and (b), the column letter plus hyphen, and spaced operators, refused through the API, with faults caught. Planted bypass per audit event: 9 of 9 caught by QA's file. Locks: 12 races, no 500. QLT-05, QLT-06, skeleton and empty state; stage 11b 173,446 B. Refusal messages: 83 bodies, 6 sentences, none naming a rate or formula |
| 7 | The audit-bypass protection is in the repository | | ⚠️ | OBS-1. The developer's committed suites miss 3 of the 9 bypass faults: `master.deleted` in a nested transaction, and `master.edited` and `master.deleted` written after the commit. QA's file catches all 9, but it is not committed |
| 8 | AC text confirmed against Jira | | ⚠️ | QA took the AC wording from the PR, the reviews, ux-spec v0.17 and the gate log. Jira, the system of record, was not read |

**Rulings**
1. **AQP-113 is accepted on conditions 1 and 2, both before the Done transition and the merge.** Every mandatory item passes. The two open items concern the evidence's persistence and its source, not the product, so this is a CONDITIONAL GO.
2. **OBS-1: QA's tests are committed before the merge (qa-engineer, `tests/**` lane). No separate defect is opened.** The core promise of this story is one audit entry per change in the change's own transaction. AQP-74 set the rule that this is shown per event by a planted fault (DL-107). Here the evidence exists, unlike AQP-74's G7, where no test caught the bypass and the result was a NO-GO and DEF-017. What is missing is the protection after the merge. That is why this is a pre-merge condition and not a NO-GO.
   - **Scope:** at minimum, every test that catches one of the 9 bypasses goes into the repository. The rest of the 169 may go in too, at QA's choice, under the same rules.
   - **Rules for the committed files:**
     - every file within 400 lines (Coding Standards §1), split by concern (for example audit, names and DEF-006, roles and errors);
     - the `QA_NOTES` file-writing helper removed (debug code);
     - the canary taken from `tests/support/process-master-canary.ts`, the single definition (G6 ruling 5), not a local value;
     - invented values only, no timing waits, no raised limits (DL-057).
   - **`tests/e2e/zz-qa-aqp113.spec.ts`:** not required. The developer's spec covers the same states at three widths, and stage 12 time is a watched trend (PRF-02).
   - **Proof in the PR comment:** QA re-plants the three bypasses the developer's suites missed. Each must make the committed files fail, with the test names given.
   - **Re-run:** yes. The commit changes `tests/`, so CI runs on the new head, and that run must be green on all four jobs before the merge. Master verifies the commit (file list under `tests/` only, nothing in `src/`, the line counts, the three planted results, CI green). QA files after G6 need no peer review (DL-050, DL-060).
3. **AC text: the agent that moves AQP-113 to Done reads the Jira description first, the orchestrator or qa-engineer.** Done is a Jira transition, so it waits for Jira anyway. Before it, they compare the nine ACs in AQP-113's description with the report's AC column. If any wording differs in a way that could change a result (a number, a rule, a label), QA re-judges that AC and reports to master before Done. Otherwise the Done comment states "AC text checked against Jira: no difference".
4. **DEF-006 (AQP-181, #49)** closes, with AQP-113 moving to Done, after this decision is posted on Jira (DL-098) and conditions 1 to 3 are met. The R2 write paths stay with #112 and RISK-024.
5. **Observations routed. None holds the merge:**
   - **OBS-2 and OBS-4** go to #113: the product-owner decides on lookalike names (NFC, zero-width), and the ux-expert decides on a hint line, before the customers master story, or any story reusing the name rules, reaches Ready.
   - **OBS-3, OBS-5 and OBS-7** go to #114 (solution-architect, before the sprint 1 review).
   - **OBS-6:** no action. The 409's title names the rate the Admin chose, as AC-4 requires.
6. **Merge order:** the e66e74b run completes; QA's test commit is pushed; CI is green on that head; master verifies; the branch is updated from `master` if it has moved, with CI green again; then the delivery lead squash-merges (MERGE_POLICY code-human). The governance logs go in a docs PR.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | qa-engineer | `tests/acceptance/` on PR #107 | Commit the bypass-catching tests (ruling 2): files within 400 lines, no `QA_NOTES` writer, shared canary; re-plant the 3 missed bypasses and post the result; Gitleaks per DL-108; stage files by name | Before the merge |
| 2 | master | gate log | Verify condition 1 and CI green on the new head | Before the merge |
| 3 | orchestrator or qa-engineer | Jira AQP-113 | Compare the Jira AC text with the report before the Done transition (ruling 3); post this G7 decision on Jira first | Before Done |
| 4 | product-owner; ux-expert | #113 | OBS-2, OBS-4 decisions | Before the next name-rule story reaches Ready |
| 5 | solution-architect | #114 | OBS-3, OBS-5, OBS-7 decisions | Sprint 1 review |

**Risks registered:** none new. RISK-024 unchanged (8).
**Rationale:** QA proved every AC and every G6 evidence item through the real stack, with 21 planted faults caught and no defect found. DEF-006 is closed for R1 by the round-trip invariant. Two things are left: the audit-bypass tests that prove the story's core promise must live in the repository, not in a scratch folder, and the AC wording must be checked against Jira once it is reachable. Both are cheap, and both come before the merge.

**AQP-113 G7, condition 1 verified — 2026-11-07 (master).** The commit is 323d6f2, the head of PR #107 (`gh pr view`: merge state CLEAN, base 86ffb16). QA hand-off: PR comment 6714792972. **Result: met.** Conditions 1 and 2 are closed; condition 3 is open.
- **Files:** `git diff --name-status e66e74b 323d6f2` shows 8 added files, all under `tests/`, and nothing in `src/`.
- **Line counts:** `tests/support/process-master-api.ts` 267; `aqp-113-add` 158, `-audit` 215, `-def006-names` 144, `-def006-probes` 217, `-list-edit-delete` 212, `-races` 77, `-roles-and-errors` 155. Every file is within 400.
- **Content:** `git grep` at 323d6f2 over the 8 files finds no `QA_NOTES`, no `appendFileSync` or `writeFileSync`, no `console.`, `.only`, `.skip`, `setTimeout` or raised timeout. The only hit for "retry" is a test title. The local canary value is gone, and `aqp-113-roles-and-errors.test.ts` imports `PROCESS_MASTER_CANARIES` from `tests/support/process-master-canary.ts`.
- **CI:** run 42427499733 (event `pull_request`, head 323d6f2): success on all four jobs. In its log, stage 11 (integration against PostgreSQL) ran the seven new files with 58, 12, 25, 15, 16, 30 and 9 tests, 165 in all. The stage passed: 3,579 tests and 168 files passed.
- **Re-plants:** QA's account, not repeated by me. The three bypasses the developer's suites missed each fail one named test in `aqp-113-audit.test.ts`, and nine of nine are caught against the committed files.
- **Ruling on the merge:** condition 3 (the Jira AC comparison) gates the **Done transition, not the merge**, as recorded, so the squash merge may proceed now (delivery lead, MERGE_POLICY code-human). Stated consequence: if the comparison later finds a wording difference that changes a result, QA re-judges that AC, Done waits, and any gap is a defect against AQP-113, fixed forward on `master`. Recommendation: if Jira is back before the delivery lead merges, do the comparison first, because it is cheap. If `master` moves before the merge, update the branch and wait for CI green.
- **Not done:** no suite run of my own.

---

## G6 – Peer Review — AQP-57 (STORY-01.03: Engineer sees no cost: projection and scan) — 2026-11-08

- **Decision:** NO-GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:** PR #115 at ff9d9a3 (`gh pr view`: head `ff9d9a3d…`, OPEN, not draft, merge state CLEAN against `master` e466c3b). CI 42463553178: success on all four check runs on ff9d9a3 ("Stages 1 to 11", "Stages 1 to 11b", "Stage 12: E2E (shard 1 of 2)", "Stage 12: E2E (shard 2 of 2)"), read through the check-runs API. It went green on attempt 5, after two Gitleaks-download 504s. Attempts 3 to 5 reused attempt 3's shard results (performance report).
  - **Reviews:** `docs/06-reviews/AQP-57/standards.md`, `quality.md`, `performance.md` (main folder, not committed). PR reviews 5817422301 (standards), 5817439148 (performance), 5817456299 (quality), all COMMENT on ff9d9a3 (single-token), with 37 inline comments. Labels: `review:standards-changes-requested`, `review:quality-changes-requested`, `review:performance-approved`.
  - **Jira AQP-57:** the description (AC-1 to AC-8, Dev Context, Files list); developer hand-off 11161; brief 11162; reviews 11163 (standards), 11164 (performance), 11165 (quality); product-owner note 11141.
  - **My own checks, read-only, at ff9d9a3:**
    - **QLT-01:** `grep` for "canary" and "Restricted" in `docs/templates/story.md` and `.github/pull_request_template.md` finds nothing. Neither file has changed since c7576f0. The rule is only in `README.md` and `sprint-01-plan.md:269` (cross-cutting rule 3).
    - **STD-01 (c) = QLT-12:** `eslint.config.mjs:79-100` restricts repository prefixes and `services/(masters-service|calculation-|approval-)` only. `src/server/composition.ts` exports `getAuditService` (line 57) and `getMastersService` (line 82), and no Engineer-view pattern names `composition`.
    - **QLT-02:** `canary-scan.spec.ts:77-91` fills pages with an invented value and APIs with `INVENTED_ID`, and checks only `status < 500`.
    - **QLT-04:** the `scripts` filter at `:105` has no `body !== null` term.
    - **STD-02:** `node_modules/next/dist/bin/next:80` (16.4.3) is `process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv`.
    - **PRF-06:** `canary-scan-gate.test.ts:84-86` asserts that all five scan tests run in the mobile, tablet and desktop projects.
    - **RISK-023:** nightly 42458228143 (2026-11-08) reports "only 13 runs: p95 5 m 45 s, median 4 m 59 s". PR #96 (AQP-208) merged 2026-11-06.
  - **Not done:** no suite run, no planted fault and no build of my own. Quality's 14 faults and CI are the evidence. No workbook and no `.env*` file was opened.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards REQUEST CHANGES (Major 2, Minor 9, Info 5). Quality REQUEST CHANGES (Critical 1, Major 3, Minor 6, Info 5). Performance APPROVE WITH COMMENTS (Minor 3, Info 6). All three are on ff9d9a3 |
| 2 | Zero open Blocker or Critical | ✱ | ❌ | **QLT-01, Critical, is upheld and open.** The reviewer-quality scale says "Critical = AC not met". AC-6's last clause, "A rule in the story template checklist states this", is not delivered in any template (my check above). Blocker 0 |
| 3 | Majors fixed or explicitly accepted | | ❌ | STD-01, STD-02, QLT-02, QLT-03 and QLT-04 are all upheld. None is accepted (rulings 2 and 3) |
| 4 | Findings cite file:line | | ✅ | Every finding in the three reports, and the 37 inline comments |
| 5 | The developer's departures (11161) | | ⚠️ | (1) The AQP-113 interim test is retired: verified (QLT-14). (2) The spec location is accepted; the documents are corrected (ruling 5). (3) The AC-4 reading is accepted as to outcome; the stated reason is wrong (ruling 4). (4) The widened rule is accepted in direction, with gaps (STD-01). (5) `@one-width` is not applied, which is correct (ruling 6) |
| 6 | Product runtime and NFR-009 budget | | ✅ | Stage 11b is byte-identical to `master` (worst `/masters/process` 173,446 B). The strict parse costs 4.9 us on `/me` (PRF-05) |
| 7 | CI time (RISK-023) | | ✅ | Required path 5:47 and 5:22, under the 6:00 warning. Nightly median 4:59, p95 5:45 |
| 8 | AQP-113 AC-6 retirement | | ✅ | QLT-14: every assertion of `process-master-confidential.test.ts` is kept or widened. `PROCESS_MASTER_CANARIES` is imported, not copied (11141) |

**Rulings**
1. **QLT-01 (Critical) is upheld, so G6 cannot pass at this attempt.** This story's business value is that "every later story is born under the scan". AC-6 depends on later stories adding their Restricted values. The template rule is what prompts them, so it is not decoration. The fix is two lines, made by two owners. Both land on PR #115, so that G7 can judge AC-6 on one head.
   - **(a) `.github/pull_request_template.md`: the developer, in the fix push.** Add one line at the end of the "Checklist (Definition of Done — developer)" list. Change no existing line (the file is append-only). Exact text:
     `- [ ] Cost confidentiality (STORY-01.03 AC-6): every new Restricted value is in \`tests/support/canary-masters.ts\` with its loader; every new route or page is in the route manifest, with a real-value recipe in \`tests/support/route-calls.ts\` for a dynamic segment; the canary scan still finds 0 (or: "none added")`
   - **(b) `docs/templates/story.md`: the orchestrator.** No agent's write area covers `docs/templates/`. The scrum-master's guard allows only `docs/05-backlog/`, and agents do not change guards. The orchestrator already applies master's wording to project-wide process files (DL-109 condition 8). Add this line directly under the "Testing Notes" line (line 49), and change no existing line. Testing Notes is one of the sections the scrum-master copies into every Jira story description (playbook §4.4), so the rule reaches story authors in this mode. The DoD block at line 78 does not reach Jira. Exact text:
     `- **Cost confidentiality checklist (STORY-01.03 AC-6; sprint plan cross-cutting rule 3):** ☐ every new Restricted value (rate, price, specific gravity, scrap rate, exchange rate, formula text, calculated output) is added to \`tests/support/canary-masters.ts\` with its loader; ☐ every new route or page is in the route manifest, and a dynamic one has a real-value recipe in \`tests/support/route-calls.ts\`; ☐ the canary scan still finds 0. Write "none added" if the story adds neither.`
     - **Placement:** its own docs-only commit on `feat/AQP-57-engineer-projection-scan`, after the developer's push and before the re-review. Master verifies it: one file, one added line, the wording verbatim.
     - **Why not the governance docs PR:** there, AC-6 would depend on an unrelated merge, and G7 could not see the line on PR #115's head.
   - **(c) The scrum-master needs to do nothing new.** The seven stories that extend `canaryMasters` already carry it as an AC (CR-34; sprint plan §7). The new line applies to stories written from now on.
   - **Recommended, not a condition:** the same line in `docs/standards/definition-of-done.md` (Developer), in the next governance docs PR. The orchestrator adds it with the STD-13 wording that is still owed (DL-109 condition 8; STD-16 confirms that the file still ends mid-sentence).
2. **The five Majors are upheld. Each is fixed in the fix push, with a test that can fail.**
   - **STD-01 (= QLT-12, F10):** both the Process Master audit entries (`defaultValue` before and after) and the configuration snapshots (formula text) are Restricted under architecture §5.3. Deny by default (Coding Standards §5):
     - add `audit-*` and `config-*` to the repository and service patterns, and to `COST_IMPORTS`;
     - forbid `@/server/composition` and `**/server/composition` in `engineer-*` views, with a planted-fault case. Views receive data; they do not fetch it;
     - add an exhaustive classification test over `src/server/services` beside the repository test, and move `audit-repository` and `config-repository` out of `NOT_COST`;
     - correct the rule comment and the test title so they claim only what the rule enforces.
     A future Engineer form that needs field labels gets a narrow, differently named reader (ruling 5).
   - **STD-02:**
     - Correct the four comments (`negative-control-gate.ts:4-5`, `leak/route.ts:7-10`, `README.md:167-168`, `playwright.config.ts:46-48`) and the PR description to give the real reason. The guard is the build-time replacement of the dot-access `process.env.NODE_ENV` default, so keep it in that form.
     - **Pin it with one check that fails on a planted fault.** I prefer a build-output assertion in `scripts/check-production-routes.ts`: the compiled chunk that reads `CANARY_NEGATIVE_CONTROL` contains no runtime `process.env.NODE_ENV` read. A unit test on the gate's source form is acceptable if the build route cannot be done in this push; the Dev Record says which was chosen. The planted fault is a destructured or bracketed read, and it must fail the check.
   - **QLT-02:**
     - **Engineer API calls:** assert the recipe's status, not `< 500`.
     - **Implemented, non-hidden Engineer pages:** require 200, and require that `new URL(document.url).pathname` equals the path, so a lost session that lands on sign-in fails.
     - **A dynamic segment with no real-value recipe** fails with "add a real-value recipe for <route> (AC-6)".
   - **QLT-03:** record the bodies of the responses the browser itself fetches (fetch, XHR, RSC prefetch) during the journeys, by interception in the Engineer context (`context.route` → `route.fetch()` → record → `route.fulfill`). The live negative control is extended with a sentinel planted in a browser-initiated response, which must be found. If a response type cannot be intercepted (for example a stream), the Dev Record names it and says why. reviewer-quality then rules whether that is acceptable. The developer does not exempt it silently.
   - **QLT-04:**
     - The "scripts scanned" guard counts only records with `body !== null`, and asserts `referenced > 0`.
     - The AC-3 procedure moves into one helper (for example `scanAsEngineer`). The planted-chunk negative control calls that same helper with the default `ScanRecorder()`.
     - **This is the condition on which the AC-4 reading is accepted (ruling 4).**
3. **The Minors and the cheap Info items are fixed in the same push.** Only the items listed below are deferred. One re-review covers the whole push (DL-109 ruling 4).
   - **STD-03:** a note on why `CANARY_NEGATIVE_CONTROL` stays outside `env.ts`, and the variable named in the README scan section.
   - **STD-04:** correct the pointer to `tests/security/scanner.test.ts`.
   - **STD-05 with PRF-07:** `engineer-*` views and `/api/v1/me` import `schemas/me` directly. The barrel is removed from the Engineer allowed imports, a restricted pattern for it is added with a planted fault, and the barrel gets `import 'server-only'`.
   - **STD-06:** one sentence at the top of `engineer-me.ts` on what `engineer-*` means.
   - **STD-07:** `expect(recorder.unreadable).toEqual([])` in the AC-3 and AC-5 tests, and in the control tests where the planted response must be readable.
   - **STD-08:** items (a) to (e).
   - **STD-09:** every test body within 40 lines, or with a one-line justification (the QLT-04 helper should achieve this); `SETUP_TIMEOUT` named once.
   - **STD-10:** wrap the lines over 160 characters in the new files. The format gate is deferred (ruling 6).
   - **STD-11:** the PR body carries the squash message, which names the retirement of `process-master-confidential.test.ts`. The PR is squash-merged.
   - **QLT-05:** keep every stored formula that contains `{{`, and add each one's display form (skip one-token forms).
   - **QLT-06:** the walker flags every `type: object` without `additionalProperties: false` (records included) and every empty `{}` schema, both added to the "walker can fail" control.
   - **QLT-07:** collisions are compared on the printed forms, both ways, with a can-fail case.
   - **QLT-08:** a dynamic Lead or Admin row asserts that its real ID is not `invented-id`.
   - **QLT-09:** every response to a request that carried the session cookie is held to `private, no-store`, except `/_next/static/**`. If the next-auth session route fails this, the developer reports it in the PR and does not add an exemption. The solution-architect decides on a header or an ADR-008 note before attempt 2.
   - **QLT-10 (F14):** the gate rejects an early exit in `canary-scan.spec.ts`: a `process.env` condition, or a bare `return` before the first `expect`. Alternatively, each scan test ends with a count the gate can see. Either way, the re-planted F14 must fail.
   - **PRF-03:** fetch referenced files in batches of 6 to 8 with `Promise.all`, and record the scan's elapsed time as a test annotation. Splitting AC-3 into several tests is not required, because it would multiply sign-ins at three widths.
   - **No change:** STD-12 (the guard stays at exactly two routes), STD-13 to STD-15, QLT-11, QLT-14 and QLT-15, and PRF-04, PRF-05 and PRF-08.
   - **Process:** Gitleaks before the push (DL-098, DL-108); stage files by name; planted-fault evidence never committed (DL-091).
4. **The AC-4 reading is accepted for G6 and G7, conditionally.** AC-4 is judged on three things, provided STD-02 and QLT-04 are met:
   - the in-process route, on only under `NODE_ENV=test`;
   - the production build answering 404 with the sentinel supplied, plus the STD-02 pin, which shows that the gate is a constant in that build;
   - the live negative controls (real data sent to the Admin; sentinels planted in a header, an RSC payload, a browser-initiated response and a chunk, all through the same pipeline as the Engineer scan).
   The developer's stated reason ("`next start` forces production") is rejected (STD-02, QLT-11). This record is the reading QA uses. The solution-architect writes it into test strategy §6 (ruling 5).
5. **For the solution-architect. Documents only, none holds the fix push or attempt 2, due before the sprint 1 review:**
   - **Test strategy §6:** the AC-4 reading of ruling 4, with the correct reason.
   - **Spec location:** the scan spec stays at `tests/e2e/canary-scan.spec.ts` (Playwright `testDir`; the shard and one-width guards key by it). The architect corrects every test-strategy reference to `tests/security/canary-scan.spec.ts`. The scrum-master corrects the AQP-57 Jira Files list and the Testing Notes command (STD-14).
   - **ADR-008 / architecture §10:** audit and config modules are not Engineer-importable (STD-01); the narrow-reader pattern for an Engineer form that needs field labels, written before the first Engineer form story reaches Ready; the `engineer-*` naming convention (STD-06); "build fails" means the CI build, because `next build` runs no ESLint (QLT-13).
   - **QLT-09:** if the developer reports that next-auth's session route fails the no-store check, the architect decides before attempt 2.
   - **The CI items** are in ruling 6 and tech-debt #116.
6. **Three shards and `@one-width` stay out of this PR. Both go to the architect through tech-debt #116.**
   - **Three shards:** no trigger has fired. Test strategy §10.5 names the 9-minute nightly line as the trigger, and the nightly shows p95 5:45. This PR's two runs have a median of 5:34. A CI-topology change would also distort the re-review's measurement of this PR. PRF-01's proposal (an earlier trigger: an E2E-adding story whose head and two re-runs have a median over 6:00 sets N = 3, already pre-authorised by AQP-208 AC-1) is the architect's to write into §10.5. If the fix push's head goes over 6:00, it is reported in the re-review. It does not hold G6, because 6:00 is an early warning, not a hold (DL-102, DL-103).
   - **`@one-width` for the scan:** not in this PR, for three reasons. Section 10.5 needs a ruling before any new file is tagged. It edits an AC-8 guard (`canary-scan-gate.test.ts:84-86`) that this push is strengthening (QLT-10). And it saves about 4 s today.
     - **The question the architect must answer first:** the scan reads no layout, but after QLT-03 it records every response the browser fetches, and client code can fetch differently at different widths (lazily loaded menus and drawers, phone-only variants). Does one width still see every response an Engineer can receive?
     - **If they tag it:** the scan still runs on every PR in `desktop`, and is never skipped or narrowed otherwise. The allow-list and the gate test change in the same follow-up PR. That PR is reviewed by reviewer-quality with a planted narrowing fault.
   - **Also deferred to #116:**
     - PRF-02 (count-based shard balance);
     - PRF-09 (retries and time-outs on the Gitleaks download), which cost this PR two attempts;
     - the format gate of STD-10.
7. **Re-review: all three reviewers, on the new diff only, before attempt 2** (DL-051, DL-109). The push changes ESLint rules, two product files (`/api/v1/me`, the gate) and the scan pipeline, which sets CI time. Each reviewer changes only their own label.
   - **Quality, with a planted fault per item, each failing a test:**
     - F10 and F14 re-planted;
     - a dynamic Engineer row with no recipe;
     - a session cleared mid-scan;
     - a sentinel in a browser-initiated response;
     - `fetchReferencedFiles` fetching nothing;
     - a sentinel in a chunk, through the shared helper;
     - a `z.record` in a strict schema;
     - QLT-05 to QLT-09 as fixed.
     Quality also confirms that both template lines are present.
   - **Standards:**
     - STD-01: planted `audit-*`, `config-*` and `composition` imports, and an unclassified service, each failing lint or the test;
     - STD-02: the pin fails on a destructured read;
     - STD-03 to STD-11.
   - **Performance, narrow:**
     - the required path of the new head (its first attempt, and one re-run if that is over 6:00);
     - the scan tests' durations with interception and batching;
     - PRF-03 and PRF-07.
   - **Then attempt 2:** master verifies the orchestrator's template commit. Master takes the G6 decision at attempt 2 on the final head, with CI green on all four jobs.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #115 | One push: the PR-template line (ruling 1a); STD-01, STD-02, QLT-02, QLT-03, QLT-04 (ruling 2); the Minors and the cheap Info of ruling 3; the PR description corrected (STD-02) with the squash message (STD-11); Gitleaks per DL-098 and DL-108 | Before the re-review |
| 2 | orchestrator | `docs/templates/story.md` on PR #115 | The Testing Notes line of ruling 1b, verbatim, in its own docs-only commit, with no existing line changed | After condition 1, before the re-review |
| 3 | reviewer-standards, reviewer-quality, reviewer-performance | `docs/06-reviews/AQP-57/*.md` (round 2); PR reviews | Re-review the new diff only, as ruling 7 sets out | Before G6 attempt 2 |
| 4 | master | gate log | Verify condition 2; G6 attempt 2 on the final head, with CI green | G6 attempt 2 |
| 5 | solution-architect | test strategy §6, §10.5 and the scan path; ADR-008 or architecture §10 | Ruling 5 (AC-4 reading, spec path, audit and config, narrow reader, `engineer-*`, QLT-13); QLT-09 only if reported | QLT-09 before attempt 2; the rest before the sprint 1 review (the narrow reader before the first Engineer form story reaches Ready) |
| 6 | scrum-master | Jira AQP-57 description | Files list and Testing Notes: `tests/e2e/canary-scan.spec.ts` (STD-14) | Before G7 |
| 7 | solution-architect | #116 | Three-shard trigger and `@one-width` question (ruling 6), PRF-02, PRF-09, the format gate | Sprint 1 review |
| 8 | orchestrator | Jira and PR | Post this decision; labels `gate:g6-changes`; Jira story to Changes Requested (In Progress) | Now |

**Risks registered:** none new. **RISK-023 is lowered from 8 to 6 by its own stated rule (DL-102):** AQP-208 merged, and nightly 42458228143 shows median 4:59 and p95 5:45. It stays open on PRF-01's trend.
**Rationale:** AC-6 promises that later stories keep the scan's depth growing. One of its clauses, the template rule, is not delivered, which is Critical under the review scale, so the gate fails at attempt 1. The five Majors share one theme. The safety net is sound for today's few routes, but it can stay green while missing a future leak: an import through `composition`, a dynamic route scanned only on its 404, a browser-fetched body never read, or a chunk crawl that reads nothing. They are cheap to close now, while no cost-bearing view exists, and costly to discover later. The product itself leaks nothing today, and performance has no objection.
**Posted:** Jira AQP-57 comment 11166; PR #115 comment 6720217885; the risk update on AQP-1, comment 11167; tech-debt #116 created.

---

## G6 – Peer Review — AQP-57 (STORY-01.03: Engineer sees no cost: projection and scan) — 2026-11-08 (attempt 2)

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (attempt 1 NO-GO, record above, DL-112)
- **Artefacts evaluated:**
  - **PR and CI:** PR #115 at c162eee (`gh pr view`: head `c162eee3…`, merge state CLEAN). There are five commits after ff9d9a3:
    - 8dcb4c2: the PR-template line;
    - e617f6d: the import allow-list;
    - d9f50aa: the STD-02 reason and pin;
    - 539bded: the scan pipeline and the early-exit bypass;
    - c162eee: the orchestrator's template line.
    CI 42473467530 on 539bded and CI 42474042206 on c162eee: success on all four check runs each, read through the check-runs API. `git diff --name-only 539bded c162eee` is `docs/templates/story.md` only.
  - **Re-reviews (round 2, `ff9d9a3..c162eee`):**
    - standards APPROVE WITH COMMENTS (Jira 11170; `standards.md` "Round 2");
    - quality APPROVE WITH COMMENTS (11171; `quality.md` "Round 2");
    - performance APPROVE WITH COMMENTS (11169; `performance.md` "Round 2").
    Labels: `review:standards-approved`, `review:quality-approved`, `review:performance-approved`.
  - **Developer:** hand-off 11168 and the round-2 Dev Record in the PR description.
  - **My own checks:**
    - **Condition 2 (template commit):**
      - c162eee changes one file, `docs/templates/story.md`, with one added line (line 50, under "Testing Notes") and no other change. Its line ending matches its neighbours (LF).
      - The line equals ruling 1b character for character, compared with `grep -x` against the text I posted on the PR.
      - The PR-template line from 8dcb4c2 (`pull_request_template.md:45`) also equals ruling 1a, character for character, as one insertion.
      - **Condition 2 is met.**
    - **The three new findings**, each read at c162eee:
      - QLT-16: `canary-scan.ts:360-363`, where `withType` filters by content type only;
      - QLT-17: `canary-scan-gate.test.ts:85`, where `earlyExits` reads only `SCAN_SPEC`;
      - STD-17: `negative-control-gate.ts:12`, which names `tests/security/scanner.test.ts`.
    - The full list of files changed since ff9d9a3 is within the story's scope (31 paths: `src/` security files, `scripts/` production-routes check, `tests/`, ESLint, Playwright config, README, the two templates).
  - **Not done:** no suite run, no planted fault and no build of my own. The reviewers' planted-fault tables (standards 22 specifiers; quality F10, F14 and N1 to N12) and CI are the evidence.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Round 2 of all three, each on `ff9d9a3..c162eee`, each APPROVE WITH COMMENTS |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | QLT-01 is fixed: both template lines are verbatim, checked by master, standards and quality. Blocker 0 and Critical 0 open in all three reports |
| 3 | Majors fixed or explicitly accepted | | ✅ | Each round-1 Major is fixed, and each fix was caught by a planted fault:<br>• STD-01: 18 of 18 real-case specifiers refused; F10 caught.<br>• STD-02: the stage-9 pin fails on an un-inlined, destructured or bracketed read.<br>• QLT-02: N1 and N2 caught.<br>• QLT-03: N3 caught.<br>• QLT-04: N4 and N5 caught |
| 4 | Findings cite file:line | | ✅ | All new findings and all thread replies |
| 5 | Ruling-1 template lines | | ✅ | Condition 2 above |
| 6 | AC-4 reading conditions (ruling 4) | | ✅ | QLT-04 (quality) and STD-02 (standards) are both met |
| 7 | QLT-09 | | ✅ | next-auth's session route carries `private, no-store`, so nothing goes to the architect. The developer exempts `/_next/static/**` and `public/` files. **Accepted:** `public/` files are static, the same for every viewer, carry no session data, and the logo is cacheable on purpose |
| 8 | CI and runtime | | ✅ | Required path 5:11 (539bded) and 4:50 (c162eee), under the 6:00 warning. Stage 11b is identical to `master`. `src/` changes are one import path, a `server-only` marker and comments (performance, round 2) |
| 9 | New findings | | ⚠️ | Minor: QLT-16, QLT-17, STD-17. Info: QLT-18, STD-18 to STD-20; PRF-03 lowered to Info. Ruling 1 |

**Rulings**
1. **QLT-16, QLT-17 and STD-17 are fixed in this PR, in one small push before QA, and master verifies the push. They are not routed to a follow-up.**
   - **Why now:**
     - QLT-16 and QLT-17 are the same fail-open class as round-1 QLT-04 and QLT-10, which this story exists to close. Each is one line of code away from a scan that stays green while reading less.
     - The scan helper is the file that seven later stories extend (AC-6), so a hole left in it is copied forward.
     - A follow-up would trail behind those stories: the STD-13 wording has waited since DL-109.
     - The fixes are test-only, plus one comment, so the cost is one CI run of about 5 minutes. It holds nothing else, because QA can prepare in parallel.
   - **QLT-16:**
     - `withType` counts only records with `body !== null`;
     - `openEngineerPages` returns the addresses it opened, and `expectScanSawEnough` requires a read body for each `GET <address> (page)` label.
   - **QLT-17:** `earlyExits` also checks the bodies of `scanAsEngineer`, `openEngineerPages`, `callEngineerRoutes` and `expectScanSawEnough` in `tests/e2e/support/canary-scan.ts`. It checks those function bodies, not the whole file, because the listener's bare `return;` at `:73` is legitimate. The test proves itself on a planted helper body.
   - **STD-17:** the pointer becomes `tests/unit/production-routes.test.ts`.
   - **Cheap Info in the same push** (test, lint or comment only):
     - **STD-18:** rename the "computed read" fixture, or drop its `/* NODE_ENV */` comment, and add one line to the check's doc saying it cannot see a key built at run time.
     - **STD-19:** refuse the bare directory specifiers `@/server/repositories` and `@/server/services` in Engineer views, with planted-fault cases.
     - **Optional:** PRF-03's one `console.log` of the scan's elapsed time.
   - **Proof in the PR:**
     - the developer re-plants N11 (the body of `GET / (page)` never read) and N12 (`if (process.env.CI) return;` at the top of `expectScanSawEnough`), and both now fail named tests;
     - all plants are reverted and never committed;
     - Gitleaks runs per DL-098 and DL-108, and files are staged by name.
   - **Master verifies before G7:**
     - the file list (no `src/` change other than the STD-17 comment);
     - the four items above;
     - the N11 and N12 results;
     - CI green on all four jobs of the new head.
   - **No reviewer re-review**, because the fixes are test-only (DL-047, DL-086, DL-088). If the push changes anything in `src/` other than that comment, it needs reviewer-quality's narrow re-review instead.
2. **No action now:**
   - **STD-20:** fix when the file is next touched.
   - **PRF-01, PRF-02 and PRF-06:** these stay in #116.
3. **QLT-18 is routed, not fixed here.** The first story that implements a dynamic Lead or Admin page (planned `/estimates/[code]/costs/[slNo]`, `/export`) opens it with its `PAGE_RECIPES` value and with an invented one, and compares the two answers (AC-5's real-ID versus invented-ID promise). The scrum-master writes this into that story's Testing Notes before it reaches Ready.
4. **Round-1 conditions:**
   - **Met:** 1 (developer), 2 (template commit), 3 (re-reviews), 4 (master).
   - **Still open, holding nothing:**
     - 5 (solution-architect documents; QLT-09 needs no decision);
     - 7 (#116);
     - the STD-13 and STD-16 wording in the governance docs PR (DL-109 condition 8, orchestrator).
   - **At G7:** condition 6 (scrum-master: the AQP-57 Jira Files list and the Testing Notes path become `tests/e2e/canary-scan.spec.ts`), due before G7.
   - **Now:** condition 8 (orchestrator: labels and the Jira transition, after this decision).

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| A2-1 | developer | PR #115 | One push: QLT-16, QLT-17, STD-17, STD-18, STD-19 (ruling 1); N11 and N12 re-planted, with results in the PR; Gitleaks per DL-098 and DL-108; stage files by name | Before G7 |
| A2-2 | master | gate log | Verify A2-1 and CI green on the new head | Before G7 |
| A2-3 | scrum-master | Jira AQP-57 description; the first dynamic Lead or Admin page story | Spec path (round-1 condition 6); the QLT-18 line in that story's Testing Notes | Before G7; before that story reaches Ready |
| A2-4 | orchestrator | PR and Jira | Post this decision; labels `gate:g6-pass` once A2-2 is met (`gate:g6-changes` until then); Jira to In QA after A2-2 | After A2-2 |

**G7 evidence (QA, on the final head):**
- **Each AC with evidence.** AC-4 is judged on the reading accepted in ruling 4 of attempt 1. AC-6 on both template lines and the manifest-driven loops.
- **The scan, at three widths, on the production build:** 0 found, and every non-vacuity count met with read bodies.
- **Planted faults, one per guard, each failing a test:**
  - a sentinel in a page, an RSC payload, a JSON answer, a header, a browser-initiated response and a chunk;
  - an import of `audit-*`, `config-*` or `composition` in an Engineer view;
  - a dynamic Engineer row with no recipe;
  - an early exit in the spec and in the helper.
  Evidence runs only by `workflow_dispatch` or a throwaway PR (DL-091); nothing planted is committed.
- **AC-5:** 403 with the fixed body for every Lead and Admin row, and the same answer for a real and an invented ID on API rows.
- **AC-8:** the gate shows the scan unquarantined at three widths.
- **AQP-113 AC-6:** fully met with this PR (QLT-14).
- **Regression:** green.
- **Closure:** Done only after the posted G7 (DL-098). Squash merge with the PR body's squash message (STD-11); the merge is the delivery lead's (code-human).

**Risks registered:** none new. RISK-023 unchanged at 6: the paths are 5:11 and 4:50, and the window median is 4:59 with p95 5:47 (performance, round 2).
**Rationale:** Every mandatory item now passes. The Critical and all five Majors are fixed, and each fix is proven by a planted fault that fails a test. The template lines are verbatim, checked by me and by two reviewers. What remains are three Minors. Two of them are narrower forms of the fail-open class this story exists to close, so they are fixed now in a test-only push that master verifies, rather than left for the stories that will copy the helper.
**Posted:** Jira AQP-57 comment 11172; PR #115 comment 6721909577.

**AQP-57 G6 attempt 2, condition A2-2: verified — 2026-11-08 (master).** **Result: met.** A2-1 and A2-2 are closed, and G6 is closed. AQP-57 may go to G7 on 64a1678.
- **Artefacts:**
  - **PR:** PR #115 at 64a1678 (`gh pr view`: head `64a16780…`, merge state CLEAN). The commits after c162eee are 5e8bfd8 (QLT-16, QLT-17) and 64a1678 (STD-17, STD-18, STD-19).
  - **CI:** run 42484736523, success on all four check runs on 64a1678, first attempt (check-runs API). In its log, `tests/security/engineer-import-rule.test.ts` ran 554 tests, `tests/unit/canary-scan-gate.test.ts` 16 tests and `tests/unit/production-routes.test.ts` 18 tests, all passed; the shards passed 235 and 217 tests.
  - **Developer:** hand-off 11173.
- **File list:** `git diff --stat c162eee 64a1678` shows 7 files:
  - `eslint.config.mjs` +6;
  - `scripts/lib/production-routes.ts` +5 (doc comment);
  - `src/lib/negative-control-gate.ts` 1 line;
  - `tests/e2e/support/canary-scan.ts`;
  - `tests/security/engineer-import-rule.test.ts` +4;
  - `tests/unit/canary-scan-gate.test.ts` +56;
  - `tests/unit/production-routes.test.ts`.
  **The only `src/` change is the STD-17 comment line**, so the re-review trigger of ruling 1 is not met.
- **Each item, read in the diff:**
  - **QLT-16:**
    - `expectScanSawEnough` now counts only records with `body !== null` ("HTML pages read", "RSC payloads read", "JSON answers read").
    - `openEngineerPages` returns every address it opened, hidden review pages included.
    - Every address must have its `(page)` and `(RSC)` records present, each with a read body.
    - Developer's N11 re-plant (the body of `GET /` never read): the AC-3 scan test fails with "HTML pages read".
  - **QLT-17:**
    - The gate reads `tests/e2e/support/canary-scan.ts` for the quarantine markers.
    - It applies `earlyExits` to the bodies of five helper functions (the four named plus `fetchReferencedFiles`), using `functionBody`. That function returns `undefined` for a renamed or missing helper, which fails the test, so a rename cannot escape the check.
    - Two self-tests prove it can fail: a planted N12 helper body, and a signature that wraps over several lines.
    - A further test requires that `expectScanSawEnough` asserts and that `scanAsEngineer` calls the three steps.
    - Developer's N12 re-plant: the named QLT-17 test fails.
  - **STD-17:** the pointer now reads `tests/unit/production-routes.test.ts`.
  - **STD-18:** the fixture is renamed "a read through a variable named NODE_ENV", so its name now matches what it proves. The check's doc states both limits: a key built at run time, and `GATE_WINDOW`.
  - **STD-19:** one `staticRegex` and `regex` entry, `(repositories|services)/?$`. It follows the same pattern as the schemas-barrel entry that standards reviewed in round 2. Four planted specifiers are added (`@/server/repositories`, `@/server/services`, `../repositories`, `../services/`), and all pass the refusal tests in CI.
  - **PRF-03:** the optional `console.log` was not added, which I accept, because `no-console` applies and the elapsed time is already a test annotation.
- **Ruling: the `eslint.config.mjs` change does not trigger the narrow reviewer-quality re-review. My check is enough.**
  - The trigger was a change to `src/` beyond the STD-17 comment, because that is product code. `eslint.config.mjs` is not product code, and STD-19 was ruled into this push by name, "with planted-fault cases".
  - The change only adds a refusal; it removes or relaxes nothing. It can fail in only two ways:
    - **It refuses too little.** The four planted specifiers would then pass lint and fail the test, but the test is green in CI.
    - **It refuses too much.** `eslint . --max-warnings=0` on the whole tree would then fail stage 1, but stage 1 is green.
  - STD-19 is a standards finding, and its owner's round-2 review already covered this mechanism. This is consistent with DL-047, DL-086 and DL-088.
- **Not done:** I did not re-plant N11 or N12 myself. The developer's results and the self-tests in the gate are the evidence.
- **CI time:** the required path was 5:35, the developer's figure, under the 6:00 warning. RISK-023 stays at 6.
- **Next:**
  - The orchestrator switches `gate:g6-changes` to `gate:g6-pass` and moves AQP-57 to In QA. The qa-engineer then runs G7 on the G7 evidence list of attempt 2.
  - Before G7, the scrum-master corrects the spec path in the Jira Files list and Testing Notes (A2-3).
  - If the head moves before G7 (for example, a branch update from `master`), the G7 evidence is gathered on the final head.

---

## G7 – QA Acceptance — AQP-57 (STORY-01.03: Engineer sees no cost: projection and scan) — 2026-11-08

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR:** PR #115 at a6728b4 (`gh pr view`: head `a6728b49…`; merge state BLOCKED while CI runs). a6728b4 is 64a1678 plus the QA commit. `git diff --name-status 64a1678 a6728b4` shows three added files, all under `docs/07-qa/`: the test report, DEF-018 and DEF-019. No planted file and no `src/` or `tests/` change.
  - **CI:** the reference run is 42484736523 on 64a1678: success on all four jobs, first attempt. Run 42493344482 on a6728b4 was **in progress** on all three of its jobs when read (check-runs API).
  - **QA:**
    - the report `docs/07-qa/AQP-57-test-report.md` (ACCEPT), tested on 64a1678;
    - Jira 11176; PR comment 6723151711;
    - DEF-018 (AQP-225, #117, Sev-3, Test) and DEF-019 (AQP-226, #118, Sev-4, Test or Environment).
  - **Jira AQP-57 description**, read by master: AC-1 to AC-8 match the report's AC column. The Files list and the Testing Notes now name `tests/e2e/canary-scan.spec.ts` and `npx playwright test canary-scan`.
  - **Backlog:** `docs/05-backlog/backlog.md` row 38 (06.03), uncommitted in the main folder.
  - **Route manifest at 64a1678:** the planned dynamic Lead or Admin pages are `/estimates/[code]/costs/[slNo]` (SCR-07) and `/estimates/[code]/export` (SCR-10).
  - **Not done:** no suite run, plant or build of my own. QA's tables and CI are the evidence.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Each AC was tested on the production build, real PostgreSQL and a real browser at 360, 768 and 1366 px, and every guard was shown to catch a planted fault:<br>• **AC-1:** 8 lint errors on planted imports (D1, D2); a client import of `lib/formula` fails `next build` (D3); 13 of 13 formula modules are `server-only`.<br>• **AC-2:** a non-strict schema fails 3 tests.<br>• **AC-3:** 21 of 21 pass; a plant on each of the six surfaces (P1 to P6) is reported by place and value at three widths.<br>• **AC-4:** on master's accepted reading. V1: the production build with `NODE_ENV=test` and the sentinel answers 404. V2 and V3: a planted run-time read builds cleanly, so `next build` alone does not catch it, but the stage-9 pin exits 1. This confirms the corrected reason.<br>• **AC-5:** 49 calls, one 403 body, `private, no-store` on every response; a route with no role check fails the live scan and the manifest test (C2).<br>• **AC-6:** both template lines verbatim; a new manifest route is scanned with no scanner change (C1); a dynamic route with no recipe is named (C3).<br>• **AC-7:** 0 collisions, and 2 builder mutations caught.<br>• **AC-8:** wired into the required check; 11 of 12 quarantine attempts fail a named gate test (ruling 2 covers the twelfth) |
| 2 | No open Sev-1 or Sev-2 | ✱ | ✅ | No product defect. Open: DEF-018 Sev-3 and DEF-019 Sev-4, both Test or Environment, both pre-existing, neither caused by this PR (ruling 5) |
| 3 | Regression recorded and green | ✱ | ✅ | CI 42484736523 is green on the tested head; the local run failed only for DEF-018 and DEF-019:<br>• Lint, `tsc`, build and the stage-9 pin are clean.<br>• Vitest: 4,255 passed. The one red suite is DEF-018; it passes alone, 25 of 25.<br>• E2E: 445 of 470. The 2 failures and 2 flaky tests are DEF-019, all Users or Audit at tablet width with about 200 accumulated users; 67 of 67 pass after the clean-up.<br>• Retries are as configured, and no timeout was raised (DL-057).<br>The a6728b4 run is a merge precondition (ruling 4), not a G7 item |
| 4 | Exploratory testing notes | | ✅ | Charter C1 (finding a cost as an Engineer): 12 transformed forms, error cards, RSC, source maps, size against rates (byte-identical), bookmarked Lead URLs. The ideas not run (sign-out cache, print, Warn, e-mail) are stated with their reason |
| 5 | Accessibility for the UI | | ✅ n/a | No screen in this story (stated). The existing axe suite ran in the full E2E run |
| 6 | G6 attempt-2 evidence list | | ✅ | Every item on the list is covered:<br>• the scan at three widths with read bodies;<br>• a plant per guard: six surfaces; `audit-*`, `config-*` and `composition` imports (D1, D2, plus standards' 22 specifiers); a dynamic Engineer row with no recipe (C3); early exits in the spec and the helper (G6, G7, G8);<br>• AC-5 real against invented ID on API rows;<br>• AC-8 at three widths;<br>• AQP-113 AC-6 (QLT-14).<br>Nothing planted was committed (DL-091) |
| 7 | A2-3 (scrum-master) | | ✅ | Ruling 6 |

**Rulings**
1. **The "two routes missing from the manifest" are not a finding.** They are `/api/qa-plant` and `/api/v1/qa-new`, which QA itself added in the planted-fault worktree as the independent pass's negative control. On the clean head, the file system, the build's `app-paths-manifest.json` and the manifest's implemented rows are identical (16 routes, QA-INV).
   - The live scan iterates the manifest by design, so an unlisted route is outside its sight. Two other layers close that gap:
     - `manifest-completeness.test.ts` (CI stage 11) fails a route file with no row;
     - `withRoute` refuses at build time a path that is not in the manifest.
   - The independent pass agrees with both. No action is needed.
2. **The twelfth quarantine attempt (G12, one `expect` removed from a test that has several) is a stated limit, not a defect of AC-8.**
   - **Why it is not a quarantine:** AC-8 is about switching the scan off or narrowing it (skip, filter, early exit, width, retries), and the gate stops all eleven of those. Weakening an assertion is a change in the diff. No static gate can judge its strength, and the same holds for any test in the repository.
   - **The control is a review rule**, as at DL-107 for the sibling-before audit limit. Any PR that removes or weakens an assertion in any of the following must state it in the PR body with its reason:
     - `tests/e2e/canary-scan.spec.ts`;
     - `tests/e2e/support/canary-scan.ts`;
     - `tests/unit/canary-scan-gate.test.ts`;
     - `tests/security/**`.
   - reviewer-quality then shows, with a planted fault, that what the removed assertion guarded still fails a test. An unstated removal is a Major finding at G6.
   - The solution-architect writes the limit and the rule into test strategy §10, with OBS-3 (which build-time layers exist), before the sprint 1 review. Until then, this record is the rule.
3. **No throwaway-PR quarantine demonstration is required.**
   - The gate test is the same code that CI stage 11 runs, inside the required check. QA confirmed the wiring: the required job `needs: [verify, e2e]`, and `master` protection requires that check, strict, with admins enforced.
   - DL-091 and DL-105 say where planted runs may go; they do not ask for them. A planted fault in a remote commit on this public repository has a cost and adds nothing that the stage-11 result does not already show.
4. **CI on a6728b4 must finish green on all four jobs before the merge. It does not hold this G7 decision.**
   - **Why it does not hold G7:** the diff from the tested head is three QA documents. Branch protection already blocks the merge until the required check passes (merge state BLOCKED now).
   - **If any job fails:**
     - do not re-run it blind, and do not merge;
     - the orchestrator reports the failing job and test to master;
     - a failure in a test is classified before any re-run (DL-057, DL-089), because a docs-only diff cannot cause a product failure;
     - a pure infrastructure failure (for example, the Gitleaks download 504 seen at G6, PRF-09) may be re-run once, with the reason recorded on the PR.
   - If `master` moves before the merge, update the branch and wait for CI green again.
5. **DEF-018 (Sev-3) and DEF-019 (Sev-4) hold neither G7 nor the merge.**
   - **Why:** both are test or environment defects, both are pre-existing, CI is green on the tested head, and both pass in a clean setting.
   - **Owner and due:** the developer, in their own defect PRs (the DEF-003 family, DL-057: no raised timeouts, no retries), before the sprint 1 review.
   - **DEF-019:** the developer states whether the tablet-width time-out at about 200 users comes from the test (for example, a selector over a long list) or from the Users page. If it comes from the page, QA reclassifies it, and the product-manager decides whether a Users list of that size is in scope: NFR-011 states 50 users. It is not a product defect until that is shown.
6. **A2-3 is met.**
   - **(a) Spec path:** the AQP-57 Jira description now lists `tests/e2e/canary-scan.spec.ts` in Files and `npx playwright test canary-scan` in Testing Notes (read by master).
   - **(b) QLT-18:** `backlog.md` row 38 (06.03, `/estimates/<code>/costs/<slNo>`) carries the line, and 07.01 (`/estimates/<code>/export`) is named as the second carrier.
     - These are the only two planned dynamic Lead or Admin pages in the manifest, and 06.03's is the first.
     - **What remains due:** the scrum-master writes the line into the Testing Notes of each Jira story before that story reaches Ready.
     - **If another dynamic Lead or Admin page is planned earlier,** the line moves to that story.
     - The `backlog.md` edit is uncommitted, so it goes in the next docs PR.
7. **Observations:**
   - **OBS-1** (the scan finds only known sentinels) is ARCH-R2's stated residual. Its control is AC-6's template lines, now in place. No action.
   - **OBS-2** is ruling 2.
   - **OBS-3** goes to the solution-architect with ruling 2.
   - **OBS-4** (refused pages differ in size by route) is carried by QLT-18 at 06.03.
8. **Closure and merge:**
   - **Done:** QA moves AQP-57 to Done after this decision is posted on Jira (DL-098).
   - **AQP-113:** its AC-6 is fully met when PR #115 merges (QLT-14).
   - **Merge:** the delivery lead squash-merges (MERGE_POLICY code-human) after ruling 4, using the squash message in the PR body (STD-11).
   - **Governance logs** go in a docs PR.
   - **Still open, holding nothing:**
     - the solution-architect's documents (attempt 1 ruling 5, and ruling 2 here);
     - #116;
     - the STD-13 and STD-16 wording in the governance docs PR (DL-109 condition 8).

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | orchestrator | PR #115 | CI green on all four jobs on the final head before the merge; a failure goes to master as in ruling 4 | Before the merge |
| 2 | qa-engineer | Jira AQP-57 | Done after this decision is posted (DL-098) | Now |
| 3 | developer | DEF-018 (#117), DEF-019 (#118) | Defect PRs per DL-057; DEF-019 states its cause (ruling 5) | Sprint 1 review |
| 4 | solution-architect | test strategy §6, §10; ADR-008 or architecture §10 | Ruling 2 (the G12 limit and the review rule, OBS-3) and attempt-1 ruling 5 | Sprint 1 review |
| 5 | scrum-master | 06.03 and 07.01 in Jira; `backlog.md` | The QLT-18 line in Testing Notes before Ready; the backlog edit in the next docs PR | Before 06.03 reaches Ready |

**Risks registered:** none new. RISK-023 unchanged at 6. The required path on the tested head was 5:34, 26 s under the warning; the three-shard trigger is with the architect (#116).
**Rationale:** QA proved every AC on the production stack, and showed that every guard this story adds catches a planted fault at three widths, including a leak on each of the six surfaces the AC names. An independent pass that does not use the developer's scanner found nothing. No product defect is open. What remains are a merge precondition that branch protection already enforces, two pre-existing test defects with owners, and one limit no static gate can close, now covered by a review rule.
**Posted:** Jira AQP-57 comment 11177; PR #115 comment 6723194751. When posted, run 42493344482 on a6728b4 showed "Stages 1 to 11b" and shard 2 green, with shard 1 still in progress. Ruling 4 stands until all four jobs are green.

---

## G6 – Peer Review — AQP-122 (STORY-02.03: Material Master) — 2026-11-08

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #120 at 40107d5 (`gh pr view`: head `40107d57…`, merge state CLEAN; base `master` 3695f90; 3 commits: 255cc75, 18ddf2d, 40107d5).
    - CI 42500626525: success on all four check runs (check-runs API). Required path 5:17 (performance, verified).
  - **Reviews:**
    - `docs/06-reviews/AQP-122/standards.md`, `quality.md` and `performance.md` (main folder, not committed);
    - PR reviews 5818746909 (standards), 5818796649 (quality) and 5818736845 (performance), all COMMENT on 40107d5;
    - labels `review:standards-approved`, `review:quality-changes-requested` and `review:performance-approved`.
  - **Jira AQP-122:** developer hand-off 11181; brief 11182; reviews 11184 (standards), 11185 (quality) and 11183 (performance).
  - **My own checks, read-only, at 40107d5:**
    - **QLT-01:** `tests/e2e/support/auth.ts:196-206`. The comment claims the loader is "safe when three screen sizes run it at once", but the statement is `ON CONFLICT (id) DO UPDATE`, which arbitrates on the ID only.
    - **QLT-02:** `tests/integration/masters/materials.test.ts` has the refused-entry test at `:276` for create only. No twin for update exists in the file's test list.
    - **STD-02:** `src/server/services/audit-events.ts:97` reads "MS sheet, Mild steel, Price per kg ₹ 58.00, Specific gravity 7.85, Material-Scrap-Rate (per kg) ₹ 22.00", in production source of a public repository. I compared nothing with any source; that is not permitted.
    - **Follow-up #119** (shared master hooks) is open.
  - **Not done:** no suite run, plant, probe or build of my own. Quality's 11 plants and 3 probes, and CI, are the evidence.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards APPROVE WITH COMMENTS (Minor 8, Info 4); quality REQUEST CHANGES (Major 2, Minor 3, Info 5); performance APPROVE WITH COMMENTS (Minor 2, Info 4). All three are on 40107d5 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in every report. STD-02 is held Minor on the condition of ruling 3, and becomes a Blocker if any value is real |
| 3 | Majors fixed or explicitly accepted | | ⚠️ | QLT-01 and QLT-02 are upheld and must be fixed before G7. Neither is accepted (rulings 1 and 2) |
| 4 | Findings cite file:line | | ✅ | All reports and the inline comments |
| 5 | Product code against AC-1 to AC-8 | | ✅ | Quality's AC table: all met. 10 of 11 plants were caught (P1 to P8; P3u survived, which is QLT-02) |
| 6 | NFR-009 budget and CI | | ✅ | Stage 11b: every route under 200,000 B. `/masters/materials` is 185,555 B (14,445 B headroom, PRF-01). Path 5:17, under 6:00 (PRF-02) |
| 7 | AQP-57 AC-6 rule (PR-template line) | | ✅ | Filled in and matching the diff (standards, focus checks). Canary values come from one definition, `material-master-canary.ts` |

**Rulings**
1. **QLT-01 (Major) is upheld and fixed in this PR.**
   - **Why Major:** a loader that the comment calls safe fails 32 of 40 rounds when three widths load at once. CI's single retry would hide it as "flaky", so it would cost path time against RISK-023 and pollute the flaky record. This is the DEF-003 class (DL-057). Fixing it with a retry or a longer wait is not allowed.
   - **Behaviour required:** `INSERT … ON CONFLICT DO NOTHING` (no target, so every unique index arbitrates), then `UPDATE … WHERE id = $1`. Alternatively, load the canaries once in `auth.setup.ts`. Correct the comment.
   - **Evidence:** if the loader can run in CI stage 11, add a committed integration test that runs three loaders at once on an empty `materials` table, over at least 10 rounds, with no rejection. Otherwise the Dev Record says why not, and the reviewer's 40-round probe is the evidence.
   - **The same pattern elsewhere:** the developer checks `ensureCanaryProcessRates` (AQP-57) for the same flaw and fixes it the same way if it has one (`process_items` has a name index too).
2. **QLT-02 (Major) is upheld and fixed in this PR.**
   - **Why Major:** NFR-007 needs an audit entry in the change's transaction on every change, and DL-107 set the rule that this is shown per event by a planted fault. An edit whose entry is written outside its transaction passes all 140 tests.
   - **Fix:** add the update twin of "an entry the audit service refuses takes the change back" (quality's suggested test).
   - **Proof:** plant P3u must fail it.
3. **STD-02 (Minor) is held Minor on one condition, the same ruling as AQP-113 STD-07 (DL-109).**
   - **The statement:** the developer states in the PR body that none of `7.85`, `58.00`, `22.00`, `58.5`, `59.50`, `214.5`, `95`, `19.32`, `2.70` or `30.5` came from Accucut's list, the workbook or any other real price source. **If any did, the developer stops, reports BLOCKED, and the finding becomes a Blocker.** The branch is public, so only the delivery lead decides on its history (RISK-006); agents do not rewrite it.
   - **Then every stored or shown value moves to the `n.37` pattern:**
     - specific gravity `7.37`;
     - the `audit-events.ts:97` example gets invented names and `.37` values;
     - `214.5` and the like become `n.37`.
   - **Exception:** format-edge inputs that cannot be `.37` (`58.123`, `0.01`, `1e3`) stay.
   - **Spec headers:** the two headers say "invented, `n.37`, except inputs that test the format".
   - **Why this matters even for a physical constant:** `7.85` is the textbook gravity of steel, so it is likely to match the real list as well. That is exactly why the pattern exists: a pasted real value must stand out.
4. **The other Minors are fixed in the same push, except where a destination is named:**
   - **STD-01:** two warm-up helpers, so the `auth.setup.ts` callback is within 40 lines.
   - **STD-03:** one exported `RUPEE`, used in all six places; the two headings go in `material-texts.ts`.
   - **STD-05:** choose the describer by the entry's `objectType` (`process_item`, `material`), not by key presence. Planted fault: a material state described as a rate fails a test.
   - **STD-06:** both comments corrected.
   - **STD-07:** shorten the comment so `role-matrix.test.ts` is within 400 lines. The split goes in the next story that touches the file.
   - **STD-08:** the PR body's DL-108 row says why `gitleaks git` was unavailable, gives the exact `dir` command, and states that the files left out by the scratch config are untouched by the diff.
   - **QLT-03:** the race assertion is order-free (no `ORDER BY created_at`).
   - **QLT-05:** cleanup in `finally` or `afterEach`. Proof: re-plant P4, which then reports one failure, not three.
   - **STD-04: not in this PR.** It is added to #119 (neutral names `DECIMAL_TEXT_*`, `master-texts.ts`, `master-opener.ts`) before 02.02 starts. Renaming 02.01 files here would be churn.
   - **Process:** Gitleaks per DL-098 and DL-108, and files staged by name.
5. **Re-review: narrow, by the finding owners, on the new diff only (DL-091, DL-109 ruling 7).**
   - **reviewer-quality:**
     - QLT-01: re-run the three-loader probe, 40 rounds, 0 failures;
     - QLT-02: re-plant P3u, which must fail the update twin;
     - QLT-03;
     - QLT-05: re-plant P4, one failure reported.
   - **reviewer-standards:**
     - STD-01 to STD-03, STD-05 to STD-08, and the STD-02 statement present in the PR;
     - STD-03 and STD-05 change product code, which is why they are re-reviewed.
   - **reviewer-performance does not re-review,** unless stage 11b on the new head grows any route by more than 500 B, or the required path goes over 6:00. Master reads both from CI.
   - **Then:** master checks the push against this record, with CI green on the final head.
6. **Routed. None holds the push or G7 unless stated:**
   - **AC-5 wording (QLT-06):** the product-owner changes AC-5 to `master.created` and `master.edited`, with `object_type` `material` (architecture §8, as for AQP-113), **before G7**. QA judges AC-5 on the corrected text.
   - **Wording (QLT-08, and the standards note on the page description):**
     - the ux-expert adopts or amends the proposed words (with "Enter the Material in Drawing." for parallelism) and adds the Materials empty and no-match texts to SCR-13, **before G7**;
     - they also decide whether the page description may name tabs that do not exist until 02.04 and 02.05;
     - if a word changes, it goes in the developer's push or in one text-only commit, verified by master before G7.
   - **Specific-gravity decimals (QLT-07):** the business-analyst asks the delivery lead whether 2 decimals is enough (some references give 3, for example 7.874), and records the answer as a question with an owner.
     - **Accepted as built for now:** storage is `Decimal(18,4)`, so widening is a one-pattern change.
     - **Due:** before the first estimate story that uses specific gravity in a calculation reaches Ready. It holds neither G7 nor the merge.
   - **Soft-deleted names (QLT-04), with the locale note:** the solution-architect rules before STORY-02.07 reaches Ready (tech-debt #122).
   - **PRF-01 (lazy tab panels):** tech-debt #121. The scrum-master puts first-activation loading of each non-default tab panel into the Dev Context of AQP-123 (02.04) and AQP-130 (02.05) **before each starts**. 02.04's PR states the route's size before and after.
   - **PRF-02 (CI trend):** the solution-architect writes the earlier three-shard trigger into test strategy 10.5 **before AQP-130 (02.05) starts**. This is brought forward from "sprint 1 review" in #116. The proposal: a first-attempt required path of 5:45 or more in an E2E-adding story sets N = 3 in that PR. Nothing changes in this PR.
   - **PRF-03:** the solution-architect rules on `@one-width` for "an edit that changes nothing" (10.5). "Duplicate name" stays at three widths (axe and the `:visible` count). No hold.
   - **PRF-05:** the scrum-master adds "fetch `/options/materials` once per page, not per row" to the Dev Context of the first estimate-form story that uses it.
   - **PRF-06:** the product-manager adds a master-data volume to NFR-011. This was owed at AQP-113 (round-1 condition 7, R2-6) "before the customers and materials stories reach Ready"; the materials half has slipped. **Now due before AQP-142 (02.02, customers) starts.**
   - **STD-09:** added to #119 (split the material methods into their own repository before 02.04).
   - **STD-10:** the format and `max-len` decision is in #116.
   - **STD-12 / STD-13:** the coding-standards §10 SQL sentence is still truncated (DL-109 condition 8, orchestrator). **Due in the next governance docs PR, and no later than the sprint 1 review.**
   - **STD-08 (tooling):** the solution-architect documents a worktree-safe `gitleaks git --log-opts` form (#116).
   - **QLT-09:** in #122.
   - **QLT-10, STD-11, PRF-04:** no action.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | PR #120 | One push: QLT-01 (and the `ensureCanaryProcessRates` check), QLT-02, QLT-03, QLT-05; STD-01, STD-02 with the statement in the PR, STD-03, STD-05 to STD-08; Gitleaks per DL-098 and DL-108; stage files by name | Before the re-review |
| 2 | reviewer-quality; reviewer-standards | `docs/06-reviews/AQP-122/` (round 2); PR reviews | Narrow re-review per ruling 5, with the probe and the re-plants | Before G7 |
| 3 | master | gate log | Check the push against this record; CI green on the final head; 11b and the path within ruling 5's lines | Before G7 |
| 4 | product-owner | AQP-122 AC-5 | Event wording per architecture §8 | Before G7 |
| 5 | ux-expert | ux-spec SCR-13 | Adopt or amend the proposed words; the empty and no-match texts; the page description | Before G7 |
| 6 | business-analyst | requirements questions; delivery lead | Specific-gravity decimals (QLT-07) | Before the first estimate story using specific gravity reaches Ready |
| 7 | solution-architect | #122; test strategy 10.5 (#116) | QLT-04 and locale; the earlier three-shard trigger; PRF-03; the `gitleaks git` form | #122 before 02.07 reaches Ready; trigger before AQP-130 starts; the rest by the sprint 1 review |
| 8 | scrum-master | AQP-123, AQP-130, the first estimate-form story | PRF-01 (#121) and PRF-05 in Dev Context | Before each starts |
| 9 | product-manager | PRD NFR-011 | Master-data volume (PRF-06) | Before AQP-142 starts |
| 10 | developer | #119 | STD-04 and STD-09 noted there; done before 02.02 and 02.04 respectively | 02.02 / 02.04 |

**G7 evidence (QA, on the final head):**
- **Each AC with evidence.** AC-5 is judged on the corrected text and AC-8 on the ux-expert's words.
- **Audit (DL-107):** for `master.created` and `master.edited` with `object_type` `material`, one entry in the change's transaction. A planted bypass per event fails a test, including P3u. A refused change writes no entry.
- **Specific gravity:** 0 and below are refused with 422 on POST and PATCH, through the API, and the hidden-row exemption holds.
- **`/options/materials`:** exactly `id`, `name`, `materialConsidered` for all three roles, with no number.
- **The cost scan:** finds the canary materials for the Admin and 0 for an Engineer, at three widths.
- **The canary loader under concurrency:** QA repeats the scan specs with `--repeat-each=5 --retries=0` at three widths, with 0 failures.
- **Screens:** three widths, axe with `wcag21a` 0, keyboard, 44 px.
- **Stage 11b:** every route under 200,000 B.
- **Regression:** green.
- **Closure:** Done only after the posted G7 (DL-098). Evidence runs only by `workflow_dispatch` or a throwaway PR (DL-091).

**Risks registered:** none new.
- **RISK-006 reviewed, score unchanged:** STD-02 and ruling 3 hold it, as at AQP-113.
- **RISK-020 unchanged at 3:** `/masters/materials` is 185,555 B. The trigger is "any portal route above 198,000 B", which is not met. #121 is the mitigation.
- **RISK-023 unchanged at 6:** path 5:17. The nightly trigger is not met. The earlier 10.5 trigger is brought forward (ruling 6).

**Rationale:** No Blocker or Critical is open, and the product code meets every AC under 10 of 11 plants, so G6 can pass. Two Majors are upheld, both in tests:
- a loader whose safety claim is false and would surface as hidden flakiness;
- a missing audit-rollback test that leaves the edit path's core promise unguarded.
Both are cheap and are fixed with the Minors in one push, re-reviewed by the finding owners, because two of the Minors touch product code. The off-pattern figures are held Minor only on the developer's statement, as at AQP-113.
**Posted:** Jira AQP-122 comment 11186; PR #120 comment 6724545847. Tech-debt #121 (PRF-01) and #122 (QLT-04, locale, QLT-09) were created. Comments were added on #116 (the trigger brought forward, PRF-03, STD-08, STD-10) and on #119 (STD-04, STD-09).

---

## G6 – Peer Review — AQP-122 (STORY-02.03) — check of the fix push against the DL-115 record — 2026-11-08

- **Decision:** the DL-115 conditions are **met**, and G6 is **closed**. The CONDITIONAL GO (attempt 1) stands with no open developer condition. **AQP-122 may go to G7 now, on b02955b.**
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR:** PR #120 at b02955b (`gh pr view`: head `b02955bb…`, merge state CLEAN). The commits after 40107d5 are 59426c8 (tests) and b02955b (product and wording). `git diff --stat 40107d5 b02955b` lists 24 files, all within the story: `src/` masters, errors, audit events and the materials page; `tests/`.
  - **CI:** run 42506525720 on b02955b, success on all four check runs, with `run_attempt` 3. Per-attempt job timestamps, read by master through the attempts API (first job start to the end of `Stages 1 to 11`):
    - attempt 1: 17:45:20 to 17:51:17, **5:57**;
    - attempt 2: 18:05:54 to 18:12:11, **6:17** (shard 1, 6:12);
    - attempt 3: 18:12:22 to 18:17:27, **5:05**.
  - **Round-2 reviews** (`docs/06-reviews/AQP-122/*.md`, "Round 2"):
    - standards APPROVE (Jira 11190);
    - quality APPROVE WITH COMMENTS (11192);
    - performance APPROVE WITH COMMENTS (11191).
    The labels are all `review:*-approved`.
  - **Other inputs:** developer 11189; product-owner 11187 (AC-5); ux-expert 11188 (ux-spec v0.18, SCR-13 final words); follow-up #123 (open).
  - **My own checks:**
    - **AC-5 in the Jira description** now reads `master.created` on an add and `master.edited` on an update, with `object_type` `material` (architecture §8).
    - **The STD-02 statement** is in the PR body (line 64). `git grep` at b02955b over `src` and `tests` finds no `7.85`, `58.00` or `22.00`. The remaining "MS sheet" and "Mild steel" hits are material names in a test and in the design-system page, not values.
    - The attempt timings above.
  - **Not done:** no suite run, probe or plant of my own. The reviewers' plant results and CI are the evidence.

| # | Check against DL-115 | Result | Evidence |
|---|-------|--------|----------|
| 1 | QLT-01 loader | ✅ | `INSERT … ON CONFLICT DO NOTHING`, then `UPDATE` by ID, in `tests/support/material-canary-loader.ts`; no retry.<br>• The committed integration test runs 3 loaders × 12 rounds, and planting the old `ON CONFLICT (id)` fails it.<br>• Quality's probe failed 0 of 40 (round 1: 32 of 40).<br>• `ensureCanaryProcessRates` was probed 40 × 3 with 0 rejections, so it needs no change |
| 2 | QLT-02 update rollback twin | ✅ | P3u re-planted, and the new test fails (quality and developer) |
| 3 | STD-02 statement and `n.37` | ✅ | The statement is in the PR; every stored or shown value is `n.37`; format inputs are excepted (standards). RISK-006 trigger not met |
| 4 | STD-01, 03, 05 to 08; QLT-03, QLT-05 | ✅ | All resolved:<br>• STD-01: the set-up callback is under 40 lines.<br>• STD-03: one exported `RUPEE`.<br>• STD-05: describer chosen by object type, tested both ways.<br>• STD-07: `role-matrix.test.ts` is 400 lines.<br>• STD-08: the DL-108 row is complete.<br>• QLT-03: order-free.<br>• QLT-05: P4 reports 1 failure, not 3 |
| 5 | Narrow re-review (ruling 5) | ✅ | Quality and standards done. Performance re-reviewed because 11b grew by +942 B, over the 500 B line, and the path was near 6:00 |
| 6 | 11b | ✅ | `/masters/materials` 186,497 B (+942 B; headroom 13,503 B). Performance: bundler packing, not code (esbuild graph +4 B gzip). Accepted |
| 7 | Condition 4: AC-5 text (product-owner) | ✅ | 11187; the description was read by master |
| 8 | Condition 5: words (ux-expert) | ✅ | 11188: five strings, all applied exactly (standards). Of the five tests named, all are updated, plus the one-tab test. The build check found a 416 px overflow on a long search in No match; it is fixed and tested |
| 9 | No new Blocker, Critical or Major | ✅ | New: R2-QLT-11 (Minor, outside the story, #123); R2-QLT-12, R2-01, R2-02 and PRF-07 (Info); PRF-08 (Minor, restates PRF-02) |

**Rulings**
1. **G6 is closed. AQP-122 goes to G7 on b02955b.** The G7 evidence list of the DL-115 record stands, plus:
   - the five ux-expert strings and the one-tab description test;
   - the long-search overflow test at three widths;
   - **the canary loader under concurrency:** `--repeat-each=5 --retries=0` on the scan and materials specs at three widths, with 0 failures. This was already listed, and it matters more now that the loader changed.
   If the head moves (for example, a branch update from `master`), the evidence is gathered on the final head.
2. **The other findings:**
   - **R2-QLT-11 (Minor, SCR-11 No-match overflow, AQP-113's delivered screen):** follow-up #123. The developer fixes it once in the shared `EmptyState`, with an SCR-11 test, **before STORY-02.02 starts**, because 02.02 is the next screen to reuse `EmptyState`. It holds neither G7 nor the merge of PR #120. If QA sees it at AQP-122's G7 on SCR-11, it is not a defect against this story.
   - **R2-01 (Info, `MASTER_WORDS` resolves inherited keys such as `toString`):** goes to #119, fixed when the file is next touched (`Object.hasOwn` or a `Map`). Object types come from the server's own constant set, so no input reaches it today.
   - **R2-02 and R2-QLT-12 (Info):** fix when next touched.
   - **PRF-07 (Info):** the +1,500 B tripwire at 02.04's G6 is adopted into #121. More than +1,500 B over 02.04's base on CI means the panel is not lazy.
   - **Testing Notes:** the AQP-122 Jira Testing Notes still name `tests/security/canary-scan.spec.ts`. The scrum-master corrects it to `npx playwright test canary-scan` before G7 (the AQP-57 A2-3 pattern). This holds nothing.
3. **RISK-023 (the CI-time risk): score and trigger unchanged, restated.**
   - **Why unchanged:** its rule (DL-112) raises it to 8 only if **a nightly window** shows a median over 6:00 or a p95 over 7:00. One attempt at 6:17 on unchanged code does not meet that rule. The same code ran 5:05 to 6:17, a spread of 72 s, so the 6:17 is runner variance, not this PR's cost. The three-run median is 5:57, under 6:00.
   - **The 6:00 line stays an early warning, not a hold** (DL-102, DL-103). The only G6 hold on CI time is still the nightly p95 over 9:00.
   - **What is new:** the margin to 6:00 is now inside the run-to-run noise. The last-20 median is 5:13, and the estimated trend is about +33 s per E2E-adding story, so the next story's first attempts will cross 6:00 often. That is the evidence for ruling 4.
   - **Lowered:** when the shard enabler merges and a nightly window shows a median of 5:00 or less.
4. **The three-shard enabler is created now, as its own story. It is not held to PR #120, and it creates no new G6 hold.**
   - **Is it a scope change? No. It is an enabler** (DL-056), with an established route (DL-084), followed for AQP-199, AQP-208 and AQP-216 (DL-097, DL-102, DL-105). Its resource cost is already pre-authorised by the product-manager (AQP-208 AC-1: three shards as a one-line change of N, under the 2.5× guard; performance estimates +15 to +19 % of runner time). So **no delivery-lead decision is needed.** The orchestrator reports it in the next result report (DL-010).
   - **Roles, in order:**
     - **product-manager:** places it through the DL-084 route. That means a PRD §13 scope note and a release-plan entry, with effort (1 to 2 points; performance estimate), committed or stretch, and the date effect. No date is adopted. Master ratifies the governance parts in the decision log, as before.
     - **solution-architect, before it reaches Ready:** writes test strategy 10.5:
       - (a) N = 3 as the current step;
       - (b) the earlier trigger for the step after three (#116 PRF-01, PRF-08);
       - (c) the measure: head plus two re-runs, and the union of the shard lists equal to the single list;
       - (d) the resource guard.
       This replaces the "before AQP-130" due date in DL-115 ruling 6 with "before the enabler reaches Ready".
     - **scrum-master:** creates the Jira story in EPIC-10 (the next free number, presumably STORY-10.17). They search `aiid-STORY-10.17` first. The ACs come from the performance report, round 2, and 10.5.
     - **product-owner:** validates DoR.
     - **developer:** builds it. It passes G5 to G7 like AQP-208.
   - **Order (master's recommendation; the placement is the product-manager's):**
     - build it in the merge and QA wait of PR #120, merged **before AQP-123 (02.04) reaches G6**;
     - AQP-123 may start before it merges, and updates from `master` before its G6, so that 02.04 is measured on three shards;
     - starting AQP-123 is not held, because a hold on a warning would contradict DL-102 and DL-103.
   - **#116** is updated to point to the new story. Its other items (PRF-03, STD-08, STD-10) stay.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | orchestrator | Jira and PR #120 | `gate:g6-pass`; AQP-122 to In QA; start QA | Now |
| 2 | qa-engineer | `docs/07-qa/AQP-122-test-report.md` | G7 on the DL-115 list plus ruling 1 | G7 |
| 3 | scrum-master | AQP-122 Testing Notes | Correct the scan spec path | Before G7 |
| 4 | developer | #123 | `EmptyState` wrap with an SCR-11 test | Before 02.02 starts |
| 5 | product-manager → solution-architect → scrum-master → product-owner | PRD §13, release plan; test strategy 10.5; Jira EPIC-10 | The three-shard enabler (ruling 4) | Placed now; merged before AQP-123's G6 (recommended) |

**Risks registered:** none new. RISK-023 is restated, with its score (6) and trigger unchanged (ruling 3). RISK-020 is unchanged at 3: `/masters/materials` is 186,497 B, and the trigger is 198,000 B.
**Rationale:** Every item of DL-115 is in the code at b02955b, checked by the finding owners with plants and probes. The two pre-G7 conditions for other roles are also met. The one over-6:00 run is runner variance on unchanged code, so the risk rule written for it does not fire. But it shows that the margin is gone, and that is why the shard enabler is started now as its own story, through the route the last three CI enablers took, without holding this PR or the next story's start.
**Posted:** Jira AQP-122 comment 11193; PR #120 comment 6725274827. Issue comments: #116 (the enabler and its route), #119 (R2-01), #121 (the tripwire), #123 (owner and due date).

---

## G6 – Peer Review — AQP-227 (STORY-10.17: Three E2E shards in CI) — 2026-11-09

- **Decision:** CONDITIONAL GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #124 at fe520d2 (`pull_request_read get`: base `master` 3695f90, 2 commits bd3d673 and fe520d2, 3 files, +30 / -10, mergeable state clean, labels `review:standards-changes-requested`, `review:quality-changes-requested`, `review:performance-approved`).
    - Check runs on fe520d2 (run 42513656141): `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 3)`, `(shard 2 of 3)`, `(shard 3 of 3)` and `Stages 1 to 11`, all success.
  - **Reviews:**
    - `docs/06-reviews/AQP-227/standards.md`, `quality.md` and `performance.md` (main folder, not committed);
    - PR reviews 5819390752 (standards), 5819871409 (quality) and 5819405981 (performance), all COMMENT on fe520d2, verdict in the body.
  - **Jira AQP-227** (status In Review): developer hand-off 11213; brief 11214; reviews 11215 (standards), 11216 (performance) and 11217 (quality). Story description revision 2 (AC-1 to AC-8), PO READY 11203.
  - **Governance:** DL-047, DL-051, DL-057, DL-091, DL-098, DL-105, DL-108, DL-113, DL-116; test strategy v0.25 10.5 (main folder, uncommitted).
  - **My own checks, in a scratch worktree at fe520d2 (reverted with `git checkout`, nothing committed or pushed):**
    - Guard files at head (`vitest run` of `ci-workflow`, `e2e-shards`, `ci-fan-in`, `ci-feedback-time`, `one-width-tag`): 77 passed, warm cache.
    - **QLT-01 reproduced:** top-level `fullyParallel: false` gives width-test counts 163 / 156 / 148 by `playwright test --list --shard=i/3`, and all 43 tests of `e2e-shards`, `one-width-tag` and `ci-workflow` pass. Also tried: `fullyParallel: false` on the `mobile` project only gives 156 / 156 / 155 (no effect on today's split).
    - **QLT-02 reproduced:** `matrix.exclude: [{shard: 3}]` and `matrix.include: [{shard: 4}]`, each alone: 77 of 77 guard tests pass.
    - **QLT-03 reproduced:** job-level `continue-on-error: true` on `e2e` only: `ci-workflow` and `ci-fan-in` 32 of 32 pass; on `verify` and `e2e` together: 77 of 77 pass.
    - **QLT-04 reproduced:** `e2e-shards.test.ts` with a fresh `PWTEST_CACHE_DIR`: the union test fails (1 of 1); the same file warm: 4 of 4 pass. My first run in the new worktree also had 1 failure.
    - **STD-01:** the comment at `tests/unit/e2e-shards.test.ts:83-86` says the test fails if `fullyParallel` is switched off; the QLT-01 reproduction shows it passes.
    - **STD-05:** `git grep "Three shards"` finds nothing on `origin/master`; test strategy v0.25 is only in the main folder, and no docs PR is open (`gh pr list`).
  - **Not done by me:** the CI timing figures (AC-5 to AC-8) were not recomputed; reviewer-performance and reviewer-quality each recomputed them from the jobs API and agree with the PR. No Gitleaks run (not installed). No probe of the proposed fixes; reviewer-quality proved them on the plants.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | Standards REQUEST CHANGES (Major 1, Minor 4, Info 3); quality REQUEST CHANGES (Major 2, Minor 3, Info 1); performance APPROVE WITH COMMENTS (Minor 2, Info 3). All on fe520d2 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in every report; my reproductions raise none (rulings 1 and 2 explain why the Majors are not Critical) |
| 3 | Majors fixed or explicitly accepted | | ⚠️ | STD-01, QLT-01 and QLT-02 upheld, none accepted; fixed in this PR before G7 (rulings 1 to 3) |
| 4 | Findings cite file:line | | ✅ | All three reports and the inline comments; QLT-05 and PRF-05 are evidence items with run IDs |
| 5 | The change against AC-1 to AC-8 | | ⚠️ | AC-3 to AC-8 met on reviewers' recomputed evidence. AC-1's "a silent return to two shards fails it" and AC-2's "it fails if `fullyParallel` is switched off" are not delivered by the guards (QLT-02, QLT-01) |
| 6 | NFR-009 and the runner-minutes guard | | ✅ | Median path 4:37 (limit 4:45), worst of five 4:44; billed 1.20 (limit 1.60), 1.25 by means; queue wait 2 to 4 s in 37 of 37 jobs; 0 flaky in five runs (performance, quality) |
| 7 | Workflow hygiene and repository settings | | ✅ | Permissions, SHA pins, fan-in and branch protection unchanged; branch protection `["Stages 1 to 11"]` read back by two reviewers; #125 and #126 closed unmerged; no `ci-control/*` branch left |
| 8 | Pre-push secret scan (DL-098 b, DL-108) | | ⚠️ | Changed-paths `dir` per commit, disclosed; per-commit record missing (ruling 4) |

**Rulings**
1. **QLT-01 (Major) is upheld, with STD-01 (Major) as its wording half. Fixed in this PR.**
   - **Why Major and not Minor:** AC-2 states the purpose of the assertion ("it fails if the split ever becomes per file, for example if `fullyParallel` is switched off"), and the delivered assertion does not do it on today's suite (163 / 156 / 148, 4.9 %, reproduced). Nothing in `tests/` asserts `fullyParallel: true`, although test strategy 10.5's whole design rests on it. The comment then tells the next reader the opposite. A control that looks complete and is not is the AQP-27 and AQP-57 class (DL-047, DL-113).
   - **Why not Critical:** today's split is correct (156 / 156 / 155), so nothing runs wrong now; the gap is a missing guard.
   - **Behaviour required:** a guard that **fails** with top-level `fullyParallel: false` (plant P3) and on a gross imbalance (the developer's 400-test serial group), and **passes** on today's suite. It asserts the cause (`fullyParallel: true` in `playwright.config.ts`, read from `e2e-shards.test.ts`; `playwright.config.ts` and `one-width-tag.test.ts` stay untouched) and the effect: shard width-test counts differ by at most one (reviewer-quality's bound). If the developer prefers a looser effect bound, it must still fail P3; say which bound and why in the Dev Record. A project-level `fullyParallel: false` is not required to be caught: it does not change today's split (my plant, 156 / 156 / 155), and the effect bound catches it once it does.
   - **The 10 % assertion stays** as AC-2 literally asks; the new assertions sit beside it. AC-2's "one assertion is added" is read as "at least the 10 % assertion". **STD-01:** the comment says what each assertion catches and what it does not, with no claim the reproduction contradicts.
2. **QLT-02 (Major) is upheld. Fixed in this PR.**
   - **Why Major:** AC-1 and `ci.yml:239` state that any list other than `[1, 2, 3]` fails. A one-line `exclude` (two shards at run time) or `include` (a fourth shard, which 10.5 says needs the architect first) passes all 77 tests (reproduced). That bypasses the AC-6 cost guard and the 10.5 order silently. Why not Critical: the head runs three shards correctly.
   - **Behaviour required:** the AC-1 test fails when the `e2e` job's `strategy` holds anything that can change the shard set or its concurrency at run time: `include`, `exclude` or `max-parallel`, anywhere in the block, not only by position. Plants P4 (`exclude` shard 3) and P6 (`include` shard 4) must fail; P1, P7 and P8 must still fail. Reviewer-quality's anchored-block regex is one way.
3. **The Minors and Infos in the same push (one test-and-comment push, the files of this PR only).**
   - **QLT-03 (Minor, pre-existing, AQP-208):** one assertion that no job the fan-in needs (`verify`, `e2e`) has a job-level `continue-on-error`. Cheap, the same file, and how GitHub reports `needs.<job>.result` for such a job was not verified by anyone, so the guard is the safe side. Plant P5 on `e2e`, and the same on `verify`, must fail.
   - **QLT-04 (Minor, pre-existing, reproduced by me):** the union test fails on a cold Playwright cache. Fixed now, because the same file is being edited and QA's G7 run in a fresh worktree would hit it. **Behaviour required:** with a fresh `PWTEST_CACHE_DIR` each time, `e2e-shards.test.ts` passes 3 of 3 on Windows. Keys must stay unique per test (two tests with the same title path in one file must not collapse into one key), so prefer listing the whole suite before the shard listings over dropping the line from the key. If the cause cannot be fixed in this push, the developer says so in the Dev Record and opens a `tech-debt` issue; master then decides at the verification.
   - **STD-02, STD-03 (Minor), STD-06, STD-08 (Info):** fixed as suggested in the standards report.
   - **STD-07 (Info):** no change. The next test added to `ci-workflow.test.ts` starts a second file, so the QLT-02 and QLT-03 assertions may go to a new `ci-workflow-shards.test.ts` if the 400-line limit would be passed (386 now).
4. **STD-04 (Minor): the DL-108 reading. The scan done is accepted for bd3d673 and fe520d2, and DL-108 is clarified (DL-117).**
   - **The reading:** when `gitleaks git` cannot run, `gitleaks dir` over the paths each pushed commit adds or modifies (`git diff-tree --no-commit-id --name-only -r --diff-filter=AMR <commit>`), with each file's content taken at that commit, meets DL-108. A commit can add bytes only to those paths, so the add-then-remove case DL-108 names is caught. Findings from a whole-tree `dir` that lie only in files no pushed commit touches, and that are listed in `.gitleaks-baseline.json`, are not a failure. Any finding in a path the push changes still stops the push (DL-098 b).
   - **Why accept after the fact and not NO-GO:** the substance of DL-108 was met, the developer disclosed the narrowing instead of hiding it, and CI stage 2 (full history, baseline) is green on the head. The narrowing should have been asked, not chosen; that is now settled for everyone.
   - **Required:** the PR body gives one line per pushed commit (bd3d673, fe520d2 and each fix commit): SHA, command, path count, exit code.
5. **QLT-05 (Minor): AC-4 (b)'s deviation is accepted and recorded.** GitHub cannot cancel one job of a run, so control (b) cancelled the whole run and `VERIFY` was cancelled too. The fan-in log still names `E2E finished as 'cancelled'` as its own error, and `ci-fan-in.test.ts` runs the fan-in script for each result. An isolated repeat (a sleep in shard 3 on a throwaway PR) would add little. No repeat is required.
6. **STD-05 (Minor): merge order.** The code cites test strategy 10.5 "Three shards", which is not on `master`. **The docs change (test strategy v0.25 plus the architect's corrections in ruling 7, and architecture 9.2) merges before PR #124 merges.** It does not hold QA.
7. **Routed, holding neither G7 nor the merge unless said:**
   - **solution-architect (test strategy 10.5, in the docs change of ruling 6):** §2 names the assertions that now exist (`fullyParallel: true`, the effect bound, the 10 % backstop, the strategy-block anchor, no job-level `continue-on-error`) and drops the claim that 10 % alone catches a per-file split. Restate the planning figure as the slowest shard (path 4:37, about 53 s and two stories to the 5:30 trigger; PRF-01), the fourth-shard figures (`Stages 1 to 11b` now 2:47 to 4:08; a fourth shard gains about 15 to 25 s; PRF-03), and "steadier, not 1:30 shorter" (PRF-05). Architecture 9.2: three shards (PO note 4).
   - **scrum-master:** a note under AC-2 and AC-1 in AQP-227 that records rulings 1 and 2 (the assertions added, "one assertion" read as at least one), before G7, so QA reads the same text.
   - **product-manager, then scrum-master (DL-084 enabler route, no hold):** the set-up-cut enabler (test strategy 10.5's next step) is placed and Ready before AQP-142 (02.02) starts (PRF-01, PRF-03). PRF-04 (per-shard times in the job summary) goes into that story's Dev Context.
   - **orchestrator:** AQP-123's G6 path is measured against a fresh `master` run at N = 3, with the base commit and shard count stated (PRF-05; already in AQP-123's Dev Context). The order "AQP-227 merges before AQP-123's G6" (DL-116) stands.
   - **PRF-02 (Info):** no duration-aware split; the architect's no-weighting ruling stands.
8. **Verification before G7 (DL-047, DL-113): master verifies the fix push, with no reviewer re-review, on these conditions.**
   - The diff from fe520d2 touches only `tests/unit/ci-workflow.test.ts`, `tests/unit/e2e-shards.test.ts`, optionally a new `tests/unit/ci-workflow-shards.test.ts`, and comment lines of `.github/workflows/ci.yml`.
   - In a scratch worktree at the new head: plants P3, P4, P5 (on `e2e`, and on `verify`) and P6 each fail at least one test; P1, P7 and P8 still fail; the head passes the five guard files; `e2e-shards.test.ts` passes 3 of 3 with a fresh `PWTEST_CACHE_DIR`.
   - All five check runs are green on the new head. The AC-5 to AC-8 evidence from fe520d2 stands, because a comment-only `ci.yml` change and unit tests do not change what stage 12 runs (evidence is repeated only when the code under test changed, as at AQP-188 AC-10, DL-091).
   - **If any non-comment `ci.yml` line, any `src/` file, `playwright.config.ts` or any other file changes,** reviewer-quality (and reviewer-standards for `ci.yml`) re-review the new diff narrowly instead, and AC-5 is re-measured if stage 12's work changed.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| 1 | developer | `tests/unit/e2e-shards.test.ts` | QLT-01 guard (cause and effect), STD-01 comment, STD-02, STD-03 (rulings 1, 3) | Before G7 |
| 2 | developer | `tests/unit/ci-workflow.test.ts` (or a new `ci-workflow-shards.test.ts`) | QLT-02 strategy-block guard, QLT-03 job-level `continue-on-error` guard, STD-08 message (rulings 2, 3) | Before G7 |
| 3 | developer | `tests/unit/e2e-shards.test.ts` | QLT-04: cold-cache union test 3 of 3 (ruling 3) | Before G7 |
| 4 | developer | `.github/workflows/ci.yml` comments; PR #124 body | STD-06; the claim at `ci.yml:239` matches the new guard; per-commit Gitleaks lines (ruling 4); the Dev Record lists the plants run | Before G7 |
| 5 | master | gate log | Verify the fix push (ruling 8) | Before G7 |
| 6 | scrum-master | AQP-227 description | Note under AC-1 and AC-2 (ruling 7) | Before G7 |
| 7 | solution-architect, then orchestrator | `test-strategy.md` 10.5, `architecture.md` 9.2; docs PR | Ruling 7 text; docs PR merged | Before PR #124 merges |
| 8 | product-manager, then scrum-master | PRD §13, release plan; Jira EPIC-10 | Set-up-cut enabler placed and Ready, with PRF-04 in its Dev Context | Before AQP-142 starts |
| 9 | orchestrator | PR #124, Jira AQP-227 | `Changes Requested` until condition 5 is met, then `In QA` | Now |

**Risks registered:** none new. RISK-023 restated, score 6 and trigger unchanged: at N = 3 the median path is 4:37 with about 53 s to the 5:30 trigger, which 02.02 (AQP-142) is expected to reach (performance estimate); mitigation: condition 8.
**Rationale:** The change itself is correct and every figure reproduces, but two guards that the ACs describe as protecting the design do not, and I reproduced both bypasses and the cold-cache failure. No Blocker or Critical, so by the procedure this is CONDITIONAL GO, as at AQP-113, AQP-57 and AQP-122. All fixes are test lines in the PR's own files with plants already specified, so master verifies them rather than a re-review round (DL-047, DL-113), with a re-review trigger if the push reaches further.
**Posted:** Jira AQP-227 comment 11219; PR #124 comment 6735462704. No `tech-debt` issue: nothing is deferred (QLT-04 opens one only if its cause cannot be fixed in the push).

---

## G6 – Peer Review — AQP-227 (STORY-10.17) — check of the fix push against the DL-117 record — 2026-11-09

- **Decision:** condition 5 is **met**. The fix push 0147c3e stays within ruling 8's file list, so no re-review is needed, and G6 is **closed**. The CONDITIONAL GO (attempt 1) stands with no open developer condition. **AQP-227 may go to In QA now, on 0147c3e.**
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #124 at 0147c3e (`gh pr view`: commits bd3d673, fe520d2 and 0147c3e; 4 files; merge state CLEAN; labels `review:standards-changes-requested`, `review:quality-changes-requested`, `review:performance-approved`).
    - Check runs on 0147c3e (run 42588037093, `gh api …/commits/0147c3e…/check-runs`): `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 3)`, `(shard 2 of 3)`, `(shard 3 of 3)` and `Stages 1 to 11`, all success.
  - **Developer:** PR comment 6735939136; Jira AQP-227 11221; the PR body's Dev Record section "G6 attempt 1: fixes" and its per-commit secret scan table.
  - **Other conditions:**
    - Jira AQP-227 description: the note under AC-1 and AC-2 (condition 6).
    - solution-architect 11220; `test-strategy.md` v0.26 10.5 and `architecture.md` v0.30 9.2 (main folder, uncommitted; condition 7).
  - **My own checks.** I ran them in the scratch worktree `m227` with 0147c3e checked out detached. Plants were restored with `git checkout`; nothing was committed or pushed.
    - **Scope:** `git diff --stat fe520d2 0147c3e` lists 4 files, +107 / -20: `tests/unit/e2e-shards.test.ts` (52 lines), `tests/unit/ci-workflow.test.ts` (4 lines, now 388 lines long), the new `tests/unit/ci-workflow-shards.test.ts` (57 lines) and `.github/workflows/ci.yml` (14 lines). I filtered the `ci.yml` diff (`git diff -U0`) for changed lines that are not comments, and it returned none. The test diff was read in full.
    - **Guards at head:** `vitest run` of `ci-workflow`, `ci-workflow-shards`, `e2e-shards`, `ci-fan-in`, `ci-feedback-time` and `one-width-tag`: 6 files, 83 of 83 passed. That is the 77 from attempt 1 plus 2 new tests in `e2e-shards` and 4 in the new file.
    - **Plants:** each was applied alone and run against the same six files (table below). My first P4 and P6 attempt did not apply: the pattern was escaped wrongly and the diff was empty. I re-ran both with a literal match and confirmed the diff before the test run.
    - **Cold cache:** I ran `e2e-shards.test.ts` three times. Each run used a new `PWTEST_CACHE_DIR` that did not exist before the run. All 6 tests passed each time (3 of 3).
    - **Gitleaks:** the pinned image `zricethezav/gitleaks:v8.30.1` (local Docker), run on a scratch clone at 0147c3e. Command: `gitleaks git --redact --no-banner --config .gitleaks.toml --log-opts="-1 <sha>"` for bd3d673, fe520d2 and 0147c3e. Result: no leaks, exit 0 for each. `git diff-tree` path counts are 2, 1 and 4, which match the PR table.
  - **Not done by me:**
    - The CI timings were not re-measured. Ruling 8 says the AC-5 to AC-8 evidence from fe520d2 stands, because stage 12's work did not change.
    - The whole-history Gitleaks scan with the baseline was not repeated; CI stage 2 is green on the head.
    - The developer's full unit run (129 files) was not repeated; CI is green.
    - The old listing order was not re-run cold on this head. I reproduced that failure at fe520d2 (attempt 1 record), and the developer's probe found it in 4 of 4 runs.

**Plants at 0147c3e** (failures out of 83 tests, six guard files)
| # | Plant | Fails | Caught by |
|---|-------|-------|-----------|
| P1 | `shard: [1, 2]` | 2 | AQP-227 AC-1 list test; strategy block equality |
| P3 | top-level `fullyParallel: false` | 2 | `fullyParallel stays on`; `the shards differ by at most one` (the 10 % test passes, as the comment says) |
| P4 | `exclude: - shard: 3` under `matrix` | 2 | no `include`/`exclude`/`max-parallel`; strategy block equality |
| P5 | job-level `continue-on-error: true` on `e2e` | 1 | `the e2e job does not continue on error` |
| P5 | the same on `verify` | 1 | `the verify job does not continue on error` |
| P6 | `include: - shard: 4` under `matrix` | 2 | as P4 |
| P7 | `max-parallel: 1` between `fail-fast` and `matrix` | 3 | as P4, plus the AQP-208 AC-4 strategy test |
| P8 | `shard: [3, 2, 1]` | 2 | as P1 |

| # | Check against ruling 8 and conditions 1 to 4 | Result | Evidence |
|---|-------|--------|----------|
| 1 | File scope (ruling 8, first item) | ✅ | Only the four named files changed; `ci.yml` comment lines only; no `src/`, `playwright.config.ts` or other file. The re-review trigger (last item of ruling 8) is not met |
| 2 | QLT-01 with STD-01 (ruling 1) | ✅ | **Cause:** `e2e-shards.test.ts` reads `playwright.config.ts` and asserts `^ {2}fullyParallel: true,$`. It also asserts no `fullyParallel: false` anywhere, which covers the project-level form the ruling did not require. **Effect:** width-test counts differ by at most one. **The 10 % test is kept.** The new comment says 10 % does not detect a per-file split (4.9 %), which matches my reproduction. P3 fails. Today's split passes |
| 3 | QLT-02 (ruling 2) | ✅ | The new file strips comment lines from the `e2e` strategy block. It asserts no `include`, `exclude` or `max-parallel`, and that the block is exactly `fail-fast: false`, `matrix:`, `shard: [1, 2, 3]`. That catches a sibling key in any position, and an inline strategy fails closed. P4, P6 and P7 fail, and P1 and P8 still fail |
| 4 | QLT-03 (ruling 3) | ✅ | No job-level `continue-on-error` on `verify` or `e2e`. P5 fails on each |
| 5 | QLT-04 (ruling 3) | ✅ | The whole suite is listed first, then the shards together. Keys stay `file:line` per test, as the ruling preferred. 3 of 3 cold. The cause the developer found (concurrent listings racing on a cold compile cache) is stated in the comment. No `tech-debt` issue is needed |
| 6 | STD-02, STD-03, STD-06, STD-08 | ✅ | In the diff: the header sentence and the describe title; the named `deviation` and `detail`; the `ci.yml` comment rewritten (the old line 239 now names both guards, and "since AQP-227" is gone); `expect(list, …).toBeDefined()` |
| 7 | STD-07 | ✅ | `ci-workflow.test.ts` has 388 lines; the new assertions went to a second file, as the ruling allowed |
| 8 | Ruling 4: per-commit scan lines | ✅ | The PR body gives SHA, command, path count and exit code for each of the three commits, from `gitleaks git` (DL-108's own form, run on a clone). Reproduced by me (above) |
| 9 | Condition 4: Dev Record lists the plants | ✅ | The PR body's fixes table names P1 and P3 to P8 with counts that match mine |
| 10 | CI on the new head | ✅ | 42588037093, 5 of 5 success |
| 11 | Condition 6 (scrum-master) | ✅ | The AQP-227 description carries "Note under AC-1 and AC-2: master's G6 rulings 1 and 2" (ACs unchanged; "one assertion" read as at least one) |
| 12 | Condition 7 (solution-architect half) | ✅ | Test strategy v0.26: 10.5 is headed "corrected for DL-117"; the version line names the assertions, 53 s of headroom and the fourth-shard figures. Architecture v0.30: 9.2. Both are in the main folder, uncommitted. **The docs PR merge is still owed before PR #124 merges** |
| 13 | No new finding | ✅ | None at Minor or above from my reading or my plants |

**Rulings**
1. **G6 is closed. AQP-227 goes to In QA on 0147c3e.** If the head changes before G7 (for example a branch update from `master`), the G7 evidence is gathered on the final head.
2. **Labels.** `review:standards-changes-requested` and `review:quality-changes-requested` describe fe520d2. Ruling 8 replaced their re-review with this check, and all three reviews were submitted as COMMENT, so no review request is outstanding. Before the merge, reviewer-standards and reviewer-quality each switch only their own label to approved, citing this record (no re-review). This does not hold QA.
3. **G7 evidence (qa-engineer):**
   - The AC-1 and AC-2 rulings as noted in the description.
   - The six guard files in a fresh worktree with a fresh `PWTEST_CACHE_DIR` (the QLT-04 case).
   - One local plant per guard: P1, P3, P4, P6, P7, and P5 on `e2e` and on `verify`. Never committed.
   - AC-5 to AC-8 stand on fe520d2's figures unless stage 12's work changes.
   - Any live control only by throwaway PR or `workflow_dispatch` (DL-091).
4. **Merge.**
   - Condition 7: the docs PR carrying test strategy v0.26 and architecture v0.30 merges **before** PR #124 (STD-05, ruling 6).
   - From today the orchestrator merges code PRs after master's G7 GO (CLAUDE.md §8, DL-118). §8 makes "the docs PR it depends on has merged" a precondition, so condition 7 is now checked by the orchestrator at the merge.
   - Condition 8 (the set-up-cut enabler, Ready before AQP-142 starts) stays open and holds neither G7 nor the merge.

**Risks registered:** none new. RISK-023 unchanged (6).
**Rationale:** Every item of ruling 8 is in the code at 0147c3e. The diff reaches no file beyond the list and no non-comment workflow line. Each planted fault fails a guard: the two bypasses and the `fullyParallel` gap I reproduced at attempt 1, and the job-level `continue-on-error` gap. The cold-cache failure no longer occurs. Master's verification therefore stands in for the re-review, as at AQP-113 and AQP-122 (DL-047, DL-113).
**Posted:** Jira AQP-227 comment 11222; PR #124 comment 6736165461. No `tech-debt` issue: nothing is deferred.

---

## G7 – QA Acceptance — AQP-227 (STORY-10.17: Three E2E shards in CI) — 2026-11-09

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #124 at f9d65c8 (`gh pr view`, `gh api …/pulls/124`): commits bd3d673, fe520d2, 0147c3e and f9d65c8; 6 files; `mergeable: true`, `mergeable_state: blocked` (the required check is missing on the head); labels `ai-delivery`, `ci`, `review:standards-changes-requested`, `review:quality-changes-requested`, `review:performance-approved`.
    - **CI on f9d65c8: none.** `gh api …/commits/f9d65c8…/check-runs` returns 0 check runs, the combined status is `pending` with 0 contexts, and `actions/runs?head_sha=f9d65c8…` returns 0 runs. Checked at 09:49Z, 09:53Z and 09:59Z. The commit is dated 09:46:40Z and QA's PR comment was posted at 09:47:09Z, so the push came before that. For comparison, 0147c3e's run started 8 minutes after its commit time. The last runs on the branch are 42588037093 (0147c3e, 5 of 5 success) and 42513656141 (fe520d2).
    - `git diff --stat 0147c3e f9d65c8`: 2 files, both new, +144 lines: `docs/07-qa/AQP-227-test-report.md` and `docs/07-qa/defects/DEF-022-cold-cache-listing-race-between-guard-files.md`. No test, script, workflow or `src/` file. No unit test reads `docs/07-qa` (`git grep` over `tests`, `scripts`, `.github`).
    - Branch protection (`gh api …/branches/master/protection`): `strict: true`, contexts `["Stages 1 to 11"]`, `required_approving_review_count: 0`.
  - **QA:** test report and DEF-022 at f9d65c8 (read in full); PR comment 6737001200; Jira AQP-227 11225; Jira AQP-236 (DEF-022, Bug, Sev-3, label `aiid-DEF-022`, relates to AQP-227) with QA's count correction 11224; GitHub #129.
  - **Governance:** G6 attempt 1 and the condition-5 check of 2026-11-09 (this log), DL-057, DL-091, DL-117, DL-118 (§8 and its point 3), test plan §6 (severity, service levels) and §7 (flaky tests).
  - **My own checks:**
    - **DEF-022 reproduced,** in the scratch worktree `m227` at 0147c3e (nothing changed or committed). I ran only the two files that race, `e2e-shards.test.ts` and `one-width-tag.test.ts`, together, 10 times, each on a new `PWTEST_CACHE_DIR`. Runs 5 and 6 failed (2 of 10); the other 8 passed 16 of 16. Each failure is the union test, `expected [ …(467) ] to deeply equal [ …(467) ]`. `e2e-shards.test.ts` alone on a new cache: 5 of 5 passed.
    - **Pre-existing at base:** at 3695f90 both `one-width-tag.test.ts` (line 136) and `e2e-shards.test.ts` (lines 48 to 49) call `listPlaywrightSuites()`, which has been in `tests/support/playwright-list.ts` since AQP-208 (4c12103). The race therefore predates this story. I did not run the base.
    - **Gitleaks on the QA commit:** pinned image `zricethezav/gitleaks:v8.30.1`, `gitleaks git --redact --no-banner --config .gitleaks.toml --log-opts="-1 f9d65c8…"` on the scratch clone: 1 commit scanned, no leaks, exit 0. This is the one CI stage that reads the new files.
    - **Labels and reviews:** all three reviews on PR #124 are COMMENT; none is REQUEST_CHANGES.
  - **Not done by me:** AC-1 to AC-8 were not re-tested; QA's figures match the G6 records to the second (path 4:37, 4:26, 4:39; billed 1.20). The 19 plants were not re-run; master's own plants at 0147c3e (G6 check) gave the same counts. The full unit run was not repeated.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report matrix AC-1 to AC-8, each with run IDs, commands or API reads. AC-1: only `[1, 2]` to `[1, 2, 3]` is executable; plants P1, P2, P4, P6 to P13, P16 fail. AC-2: 156 / 156 / 155, union 467, P3 fails 2. AC-3: protection read. AC-4: controls #125, #126 re-read; no repeat, because no non-comment workflow line changed (as G6 ruled). AC-5: median 4:37 (limit 4:45). AC-6: 1.20 (limit 1.60). AC-7: at most 4 s. AC-8: no `failed` or `flaky` in 18 shard logs |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | Open: DEF-022, Sev-3, type Test, pre-existing (ruling 1), and DEF-018 as at AQP-57. DEF-022's severity holds on the test-plan scale. It is a false red that never lets a fault through: every plant still fails its guard, and no AC fails, so "an AC fails with a workaround" (Sev-2) does not apply |
| 3 | Regression result recorded and green | ✱ | ✅ | CI run 42588037093 on 0147c3e: 5 of 5. f9d65c8 adds two Markdown files that no test reads, so the code under test is unchanged and the result stands (DL-091). eslint and tsc exit 0. The local unit run has one known load-sensitive hook timeout (DEF-018, green alone; CI is the reference run, DL-057). DEF-022 fails the union test in 3 of 10 six-file cold runs (QA) and 2 of 10 two-file cold runs (master), and has never failed in CI. **No CI run exists yet on f9d65c8** (ruling 2) |
| 4 | Exploratory testing notes | | ✅ | Charter on bypassing the required check; P14 gap noted (covered by `ci-feedback-time-sharded.test.ts`, which runs in CI); DEF-022 found |
| 5 | Accessibility checks for UI stories | | n/a | No screen |
| 6 | G6 conditions | | ✅ | Conditions 1 to 6 met (G6 check of 2026-11-09). Condition 7: the docs PR has not merged (`master` is still 3695f90); it is a pre-merge condition (ruling 4). Condition 8 is open and holds neither G7 nor the merge |

**Rulings**
1. **DEF-022 is not covered by DL-117, and it does not hold G7.** QA's question is answered here.
   - **What DL-117 required.** G6 attempt 1, ruling 3 (finding QLT-04; QA's report calls it "G6 ruling 4") set the behaviour as "`e2e-shards.test.ts` passes 3 of 3 on a fresh cache". I verified it that way at 0147c3e, and QA has it at 10 of 10. That condition is met and stays closed. The G6 check's ruling 3 asked QA to gather evidence by running the six files on a fresh cache. That was an evidence step, not a new pass line.
   - **What DEF-022 is.** The same cause one file wider: two cold `playwright test --list` processes on one cache, now in two test files instead of inside one. The 0147c3e fix ordered the listings inside `e2e-shards.test.ts` only. My G6 check ran the single file cold and the six files warm, so it could not see this. That was my miss: the check should have run the six files cold, as I later asked QA to.
   - **Why it does not hold G7.** It fails closed: a red local run, never a green one over a real fault. Every plant still fails its guard. It predates the story: both callers are on `master` since AQP-208. It has not appeared in CI, the reference run (DL-057). The fix belongs in `tests/support/playwright-list.ts` or the Vitest set-up, which is shared by other tests and outside PR #124's files. Adding it here would trigger the re-review that ruling 8 reserves for files beyond the list, for a defect this story did not cause. Under test plan §6, a Sev-3 is fixed before G8 or accepted in writing.
   - **Required (condition 1).**
     - The fix is its own test-only PR (`fix/AQP-236-…`): each listing gets its own cache, or the cache is warmed once in `globalSetup`. No retry and no raised limit (DL-057).
     - **Due before the sprint 1 review,** with DEF-018 in the same family (DL-057), as ruled for DEF-018 at AQP-57 G7. At the latest G8 (test plan §6).
     - QA verifies it with the six-file cold loop (10 of 10) and the two-file pair (10 of 10).
     - Review: reviewer-quality only, narrowly (DL-091). The fix is in test support.
   - **Not quarantined.** The test plan §7 quarantine rule is for tests that flake in the reference run. Quarantining this test would switch off the AC-2 guard, which CI runs green.
   - **Until the fix.** In a local cold run, a failure of exactly this union test with equal counts is recorded against DEF-022 and is not charged to the story under test. Running `npx playwright test --list` once before Vitest warms the cache. That is a set-up step, not a retry.
   - DEF-022 joins the DL-057 class of environment-sensitive tests, with DEF-018.
2. **CI on f9d65c8.**
   - No run has been created for the head. The new commit holds two Markdown files, and the pinned Gitleaks run on it is clean. So G7 is judged on 0147c3e's code with f9d65c8's records, and no QA evidence is repeated.
   - The merge still needs green checks on the head that merges (DL-118 point 3; strict branch protection).
   - Because protection is strict, the docs PR merging first (ruling 4) leaves PR #124 behind `master`. The branch update then makes a new head, and CI runs on that head. So no separate trigger for f9d65c8 is needed.
   - If the orchestrator wants a run on f9d65c8 before that, it may close and reopen PR #124, which fires `pull_request: reopened`. It must not push an empty commit.
3. **The reviewers' labels (G6 check, ruling 2) are recorded differently. Switching them is no longer a merge precondition.**
   - **Why.** Master's condition-5 check replaced the standards and quality re-review (ruling 8), so that record is their verdict on the final code. All three reviews are COMMENT, so no REQUEST_CHANGES is outstanding (playbook 5.5). Protection needs no approval. All roles share one token, so a label says nothing about who set it.
   - **But a stale label misleads.** `changes-requested` on a merged PR would mislead anyone auditing it later.
   - **What the orchestrator does at the merge.**
     - It removes `review:standards-changes-requested` and `review:quality-changes-requested` **by name**. It does not replace the label set, so `review:performance-approved`, `ai-delivery` and `ci` stay.
     - Its merge comment says that the standards and quality findings were closed by master's G6 check of 2026-11-09 (PR comment 6736165461), with no re-review.
     - It adds no `-approved` label on their behalf, because no reviewer re-reviewed.
   - If either reviewer runs on PR #124 before the merge for another reason, they may switch their own label as first ruled. Either form satisfies the record.
4. **Merge (CLAUDE.md §8, DL-118). The orchestrator merges when items (a) to (e) are all true; it does not need another master decision.**
   - **(a)** The docs PR has merged to `master`. It holds test strategy v0.26, architecture v0.30 and the governance records up to and including this record and DL-120 (G6 condition 7, STD-05).
   - **(b)** PR #124 is updated from `master` by a merge, never by a rebase or force-push.
   - **(c)** The update changes none of PR #124's six files. That is, the merge needs no conflict resolution in them. If it does, the head goes back to master before the merge.
   - **(d)** All five checks are green on the updated head. If the update brings in a code PR merged meanwhile, green CI on the updated head covers the integration. AC-5 is not re-measured: it is this story's own measure against its base.
   - **(e)** Before merging, the orchestrator posts on PR #124 the updated head SHA, its run ID and the commits taken from `master`. That is "master is told" under DL-118 point 3, so it need not wait for a reply.
   - **Then:** squash-merge, and the label step of ruling 3. QA moves AQP-227 to Done once this decision is posted (DL-098, CLAUDE.md §4). The merge does not wait for that, and Done does not wait for the merge.
   - Condition 8 (the set-up-cut enabler, Ready before AQP-142 starts) stays open and holds nothing here.
5. **Report wording.** QA's report names QLT-04 "G6 ruling 4" and the docs-PR merge "condition 8". In this log they are ruling 3 (condition 3) and condition 7. The report is merged as written: the finding ID and the content are unambiguous, and this record carries the correct references. No docs fix is required.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer, then reviewer-quality (narrow), then qa-engineer | `tests/support/playwright-list.ts` or Vitest `globalSetup`; own PR for AQP-236 (DEF-022, #129) | No two listings share a cold cache; no retry, no raised limit; six-file and two-file cold loops 10 of 10 (ruling 1) | Before the sprint 1 review (with DEF-018); at the latest G8 |
| 2 | orchestrator | docs PR, then PR #124 | Ruling 4 (a) to (e): docs PR first; update by merge; six files unchanged; 5 of 5 green on the updated head; head and run posted | Before PR #124 merges |
| 3 | orchestrator | PR #124 labels and merge comment | Ruling 3 | At the merge |
| 4 | qa-engineer | Jira AQP-227, AQP-236 | AQP-227 to Done (DL-098); AQP-236 stays open for condition 1 | Now |
| 5 | product-manager, then scrum-master | G6 condition 8 (unchanged) | Set-up-cut enabler Ready | Before AQP-142 starts |

**Risks registered:** none new. RISK-023 unchanged (6): the median path is 4:37, 53 s under the 5:30 trigger. DEF-022 is a defect with a due point, not a risk.
**Rationale:** Every mandatory item passes. Every AC is verified with evidence I can trace to run IDs and API reads, and the figures match the G6 records. There is no Sev-1 or Sev-2 defect, and the regression run is green on the story's code. The one new defect is a pre-existing false red in local cold runs. It sits in shared test support outside this PR, and I reproduced it. At AQP-57 the same kind of defect (DEF-018: Test type, pre-existing, green in CI) gave a GO with an owner and a due date. The same evidence gives the same decision here. Rulings 2 to 4 set how the merge happens, and they bind the merge under DL-118.
**Posted:** Jira AQP-227 comment 11226; Jira AQP-236 comment 11227; PR #124 comment 6737232233. No `tech-debt` issue: DEF-022 is already tracked as AQP-236 and #129, and nothing else is deferred.

---

## G7 – QA Acceptance — AQP-122 (STORY-02.03: Material Master) — 2026-11-09

- **Decision:** GO
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR and CI:**
    - PR #120 at fd853ac (`gh pr view`: head `fd853ac7…`, `mergeable` MERGEABLE, merge state BLOCKED at 10:51Z, while the required check was still running; labels `ai-delivery`, `feature`, `review:standards-approved`, `review:quality-approved`, `review:performance-approved`, `gate:g6-pass`). Reviews: 17, all COMMENT, none REQUEST_CHANGES. Base `master` 3695f90.
    - `git diff --stat b02955b fd853ac`: 10 files, +1,834, nothing deleted, **nothing under `src/`**. Four QA acceptance files, one QA browser spec, one support file (`tests/support/material-master-qa-api.ts`, new), the report, DEF-020, DEF-021, and one test-plan version row (0.2.2).
    - **CI run 42604122075 on fd853ac** (`pull_request`, attempt 1): success on all four check runs. `Stages 1 to 11b` 10:50:12 to 10:54:33Z; shard 1 to 10:54:57Z; shard 2 to 10:55:22Z; `Stages 1 to 11` 10:55:25 to 10:55:29Z. **Required path 5:17.** Shard logs: shard 1, 294 tests, 292 passed and 2 skipped (3.4 m); shard 2, 293 tests, 274 passed and 19 skipped (3.1 m). No failed, flaky or retried test. QA spec lines: 40 + 20 = 60, so every QA browser test ran.
    - Stage 11 runs `tests/acceptance`, so QA's 112 API tests are in CI. Stage 2 runs Gitleaks over the full history, so the QA commit is scanned.
    - Branch protection: `strict: true`, contexts `["Stages 1 to 11"]`.
  - **QA:** `docs/07-qa/AQP-122-test-report.md`, DEF-020 and DEF-021 at fd853ac (read in full); Jira AQP-122 11228 (and 11218, the paused run); PR #120 comment 6738177723; Jira AQP-234 (DEF-021, Sev-3) and AQP-235 (DEF-020, Sev-4); GitHub #127, #128.
  - **Governance:** G6 attempt 1 and its close (this log), DL-091, DL-094, DL-098, DL-107, DL-111, DL-115, DL-116, DL-118, DL-120; test plan §6 (service levels); ux-spec §6.0 ("Tables and cards": tables scroll horizontally only inside their container).
  - **My own checks:**
    - **The QA spec and the AQP-227 guards.** `tests/unit/e2e-shards.test.ts` at 0147c3e asserts proportions, not counts: the union equals the whole list, shards differ by at most one test, and each is within 10 % of the mean. "156 / 156 / 155" appears only in comments. `one-width-tag.test.ts` pins an allow-list of 47 tagged tests, and the QA spec has no `@one-width` tag. So the 60 new tests change no guard's pass line.
    - **File overlap.** PR #124 changes `ci.yml`, three `tests/unit` guard files and two QA records. PR #120 changes none of them. The main folder's pending docs do not touch `docs/07-qa/test-plan.md`.
    - **ux-spec v0.18** (SCR-13 final words, on which AC-8 was judged) is only in the main folder's uncommitted copy. It is on neither `master` nor the branch, and no docs PR is open.
    - **OBS-1 mechanism read in the code.** The developer's `failingAfterTheLastStep()` (`tests/integration/masters/materials.test.ts:259`, and `process-items.test.ts:221` from AQP-113) throws after every `run`, nested ones too. So a second transaction inside the change is rolled back by the test itself. QA's `lateFailingRunner()` (`aqp-122-materials-audit.test.ts:164`) fails only the outermost transaction. `tests/support/late-failure.ts` (DEF-017) has the depth rule, but it builds a user service, so it could not be imported here.
    - **DEF-021 against the spec.** ux-spec §6.0 lets tables scroll inside their container, and the measurements show no page scroll at any width and keyboard focus reaching Edit.
    - **CI cost of the 60 tests:** the logged durations sum to 183.5 s, about 23 s of wall time per shard on two shards (4 workers) and about 15 s on three.
  - **Not done by me:** no AC re-test, no plant, no local suite run, no browser probe. QA's 13 plants, the 363-test loader repeat and the local regression are QA's evidence. CI on fd853ac is the reference run.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report matrix AC-1 to AC-8 with test IDs, techniques and evidence. AC-5 on the corrected text (11187), AC-8 on ux-spec v0.18 words written out in the spec. DL-115 evidence list complete: audit per event with a plant each, including P3u (8 audit plants, 5 others); gravity 422 on POST and PATCH; options exactly three keys for three roles; cost scan at three widths; loader `--repeat-each=5 --retries=0` 363 of 363; the five strings; the overflow test; axe with `wcag21a`; 11b 186,497 B |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | Open: DEF-021 Sev-3 and DEF-020 Sev-4 (new), DEF-018 and DEF-022 (Test, pre-existing). DEF-021's severity holds on the test-plan scale (ruling 1): no AC fails as worded, no WCAG 2.2 AA criterion fails, and no task is blocked |
| 3 | Regression result recorded and green | ✱ | ✅ | CI 42604122075 on fd853ac: 4 of 4, 566 browser tests passed, 0 flaky. Local: Vitest 4,539 passed with the one DEF-018 file (green alone, green in CI; DL-057); Playwright `--retries=0` 563 passed, 0 failed |
| 4 | Exploratory testing notes | | ✅ | Charter, nine areas, DEF-020 and DEF-021 found, OBS-3 (axe and the sticky bar) |
| 5 | Accessibility checks for UI stories | | ✅ | axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) 0 on every state at three widths; keyboard-only add and edit; 44 px dialog targets. No real device or screen reader: planned for G8 (test plan 12) |
| 6 | G6 conditions | | ✅ | DL-115 and DL-116 conditions met or not due. #123 is before 02.02 starts. The Testing Notes path was corrected (11194) |

**Rulings**
1. **DEF-021 (Sev-3) does not hold G7 or the merge. It goes to the ux-expert before AQP-123 starts, and its fix lands before AQP-123's G6.**
   - **Why the severity holds.**
     - The build does what ux-spec §6.0 says: a table scrolls only inside its own container. So the defect is in the design, not the build.
     - The page never scrolls sideways, so AC-7 as worded holds.
     - Keyboard focus scrolls the region to Edit, and nothing is lost. Reflow (1.4.10) exempts tables, so no WCAG 2.2 AA criterion fails, and the DL-094 Sev-2 rule does not apply.
     - A sighted touch user on an iPad, or on a 1024 to 1279 px laptop, still has to discover a sideways scroll to find the row's only action. That is a real cost, and Sev-3 states it.
   - **Why not hold the merge.**
     - The fix needs a design choice first: wrap the headings, move Edit to the first column, or show cards up to 1280 px.
     - Holding the merge would put that choice, a product change, a re-review and a new QA run into PR #120, for a Sev-3 that test plan §6 lets wait until G8.
     - What matters is that 02.04 and 02.05 do not copy the gap. Ordering the work prevents that at no cost to this PR. This is the R2-QLT-11 route (#123: fixed once, before the next screen that reuses it).
     - Contrast with AQP-113's in-PR function-size rule. That fix was cheap and needed no decision.
   - **Route.**
     - **ux-expert, before AQP-123 starts:** chooses the pattern and writes it into ux-spec §6.0 "Tables and cards" as the rule for every master table, with SCR-13 per width. **Pass line:** the row's actions are visible without scrolling the table at every width from 768 to 1440 px, with the side menu open from 1024 px.
     - **scrum-master, before AQP-123 starts:** puts the rule into the Dev Context of AQP-123 and AQP-130.
     - **developer:** one fix PR, `fix/AQP-234-…`, that also carries DEF-020 (ruling 2). It removes both `test.fail` lines.
     - **Review:** narrow, by reviewer-quality (DL-091). The ux-expert confirms the result against the rule.
     - **qa-engineer:** verifies SCR-13 and SCR-11 at 360, 768, 1000, 1024, 1180, 1280 and 1366 px. SCR-11's region at 1024 px (710 px with the side menu) is narrower than its 718 px content at 768 px, so it may have the same fault there. QA also measures every other delivered table at those widths and logs any finding against its own story.
     - **Due:** merged before AQP-123 reaches G6, so that 02.04 updates from `master` and builds on it. If it has not merged by then, AQP-123's G6 checks that 02.04's own table follows the rule, and DEF-021 stays due by the sprint 1 review, at the latest G8.
2. **DEF-020 (Sev-4) is fixed in the same PR, not left in the backlog.** By test plan §6 a Sev-4 goes to the backlog. But the faulty shape (`focusOpener` falling back to the heading after the list turned into the error state) is in the master hook that 02.04 and 02.05 will copy (#119), and SCR-11's hook probably has it too (OBS-4). So the fix costs one guard and saves two copies. The developer checks `use-process-master.ts` in the same PR. QA's DEF-020 test is the regression test once its `test.fail` line is removed.
3. **The developer test gap (OBS-1) goes to tech-debt #130. It does not hold G7 or the merge.**
   - **Why no hold.** The bypass is caught by QA's committed `aqp-122-materials-audit.test.ts`, which CI stage 11 runs. So the protection exists after the merge. This is the DL-111 case (QA's file catches every bypass), not the DL-107 case (nothing catches it).
   - **Why it still needs fixing.** The developer's runner masks the very form it should expose, which is the DEF-017 class. The same weak runner is already on `master` in `process-items.test.ts`, and 02.04 would copy it a third time.
   - **Fix (#130):** one service-independent outermost-only runner in `tests/support/`, used by the materials and process-items integration tests and by every new audited master. Plants A3 and A4 must then fail the developer's file. Done in AQP-123's PR or earlier. reviewer-quality re-plants at AQP-123's G6. **Due before AQP-123's G6.**
   - **#104** (the static check that `audit.record` takes the change's transaction) is the structural guard for this class. It is also the only guard for the "entry committed before the change" form. It has had no story since 2026-11-06. The scrum-master places it with an owner and a due point at the next sprint-plan update (DL-080: a mitigation with no story never gets scheduled).
4. **CI time of the 60 new browser tests: measured, within the noise, no hold and no tagging required.**
   - **The run on fd853ac** took a 5:17 path, under the 6:00 warning. b02955b ran 5:57, 6:17 and 5:05, so the four-run median is 5:37.
   - **The 60 tests** sum to 183.5 s, about 23 s per shard on two shards. That is well inside the 72 s run-to-run spread recorded at DL-116.
   - **RISK-023** is not re-scored: its rule (a nightly median over 6:00 or a p95 over 7:00) is not met. It is restated.
   - **QA's OBS-2.** Tagging the two role tests `@one-width` would save four test runs of about 2 s each, and it would need a 10.5 ruling and a change to the allow-list guard. It is not required. It goes to #116 as an option for the architect's next 10.5 review.
   - **After PR #124 merges,** the three shards rebalance by themselves: the guards are proportional, and the QA spec adds about 15 s per shard. The figures 156 / 156 / 155 in `e2e-shards.test.ts` are comments, not assertions, so nothing fails when they go stale. They need no edit in this PR.
5. **`test.fail` markers.** A test marked `test.fail(true)` passes on **any** failure, including a timeout or a broken page, so it is a known-defect marker, not evidence. That is acceptable only while the fix is due. Both lines come out in the ruling-1 fix PR, and QA's test-plan 0.2.2 habit says so. The DEF-021 marker is limited to 768 px, and the test passes at 360 and 1366 px.
6. **Merge order: the docs PR first, then PR #124, then PR #120.**
   - **The docs PR is a dependency for both.** DL-120 (a) requires it for #124. For #120, ux-spec v0.18 holds the SCR-13 words that AC-8 was judged on, and it is not on `master`. Under DL-118 point 2, the story depends on that docs PR, so merging the code first would leave the spec behind the screen.
   - **#124 before #120 is a preference, not a dependency.** Reasons:
     - #124 has its G7 GO and pre-ruled conditions already.
     - DL-116 meant 02.0x stories to be measured on three shards.
     - #120's branch update will then run #124's guards over the larger suite, an integration check at no extra cost.
     - The two PRs share no file, so either order merges cleanly.
   - **If #124 cannot merge** (for example, a check fails on its updated head), #120 is not held by it. #120 merges under ruling 7 on its own, and #124 follows under DL-120.
7. **Merge (CLAUDE.md §8, DL-118). The orchestrator merges PR #120 when items (a) to (f) are all true; it needs no further master decision.**
   - **(a)** The docs PR has merged to `master`. It holds ux-spec v0.18 and the governance records up to and including this record and DL-121, besides DL-120 (a)'s contents. If it was opened before this record, the orchestrator adds this record to it. No second docs PR is needed.
   - **(b)** PR #124 has merged first, or ruling 6's fallback applies, and the PR comment says which.
   - **(c)** PR #120 is updated from `master` by a merge commit, never by a rebase or force-push.
   - **(d)** The update changes none of PR #120's files, so no conflict was resolved in them. If one was, the head comes back to master before the merge.
   - **(e)** Every check is green on the updated head: `Stages 1 to 11b`, each E2E shard and `Stages 1 to 11`, with the AQP-227 guards over the new suite. If a check is re-run to green, the failing test's name is posted, and a failure that is not DEF-022's exact union test comes back to master.
   - **(f)** Before merging, the orchestrator posts on PR #120 the updated head SHA, the run ID, the commits taken from `master` and the path time (first job start to the end of `Stages 1 to 11`). That is "master is told" under DL-118 point 3, so it need not wait for a reply.
   - **Then:** squash-merge. The labels are already correct (all three `review:*-approved`). QA moves AQP-122 to Done once this decision is posted (DL-098). The merge does not wait for Done, and Done does not wait for the merge. AQP-234, AQP-235 and #130 stay open.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | ux-expert | ux-spec §6.0 "Tables and cards", SCR-13 | DEF-021 pattern; row actions visible without table scroll from 768 to 1440 px, side menu open from 1024 (ruling 1) | Before AQP-123 starts |
| 2 | scrum-master | AQP-123, AQP-130 Dev Context; sprint plan | The ruling-1 rule, the DEF-020 guard and #130's runner; place #104 with an owner and a due point | Before AQP-123 starts; #104 at the next sprint-plan update |
| 3 | developer, then reviewer-quality (narrow), then qa-engineer | `fix/AQP-234-…` (AQP-234, AQP-235; #127, #128) | DEF-021 and DEF-020 fixed, SCR-11 hook checked, both `test.fail` lines removed; QA measures the delivered tables (ruling 1) | Merged before AQP-123's G6; otherwise by the sprint 1 review, at the latest G8 |
| 4 | developer; reviewer-quality at AQP-123 G6 | #130 | Shared outermost-only late-failure runner; A3 and A4 fail the developer's files (ruling 3) | Before AQP-123's G6 |
| 5 | orchestrator | docs PR, PR #124, PR #120 | Rulings 6 and 7 (a) to (f) | Before PR #120 merges |
| 6 | qa-engineer | Jira AQP-122 | Done (DL-098) | Now |

**Risks registered:** none new. RISK-023 restated, score 6 unchanged: path 5:17 on fd853ac, about 23 s per shard of new test time on two shards (ruling 4). RISK-020 unchanged at 3: `/masters/materials` 186,497 B, trigger 198,000 B. DEF-021 is a defect with an owner and a due point, not a risk.
**Rationale:** Every mandatory item passes. Each AC has traceable evidence, a planted fault was caught for every audited event, there is no Sev-1 or Sev-2 defect, and CI is green on the exact head with QA's tests inside it. The two new defects are design and focus gaps that the spec and the ACs did not forbid. Their real cost is being copied into 02.04 and 02.05, so they are ordered ahead of those stories rather than held against this one. The test gap is closed by QA's committed file, as at AQP-113 (DL-111), and its root, a runner that masks the fault it should expose, gets an owner before the next audited master. The CI cost of QA's tests was measured on the head, not estimated, and it is inside the noise. The same evidence pattern gave GO at AQP-57 and AQP-227, so it gives GO here.
**Posted:** Jira AQP-122 comment 11231; Jira AQP-234 comment 11232 (DEF-021 routing); PR #120 comment 6738380800; #104 comment 6738386309. Tech-debt issue created: #130 (OBS-1). DEF-020 and DEF-021 are already tracked as AQP-235 / #128 and AQP-234 / #127.

## G6 – Peer Review — AQP-234 / AQP-235 (DEF-021 and DEF-020: masters table actions and focus, PR #135) — 2026-11-09 (attempt 1)

- **Decision:** **CONDITIONAL GO.** The narrow route of DL-121 is met. reviewer-quality's round 2 approves with comments, nothing above Info is open, and CI is green on the exact head 04bec3e. The two conditions (DL-122) are a PR description and a spec line, and neither holds In QA. **AQP-234 and AQP-235 may go to In QA now, on 04bec3e.**
- **Decided by:** master  ·  **Human override:** none
- **Review route (checked against DL-121 itself, not taken from the brief):** DL-121 ruling 1 says the developer fixes DEF-021 in `fix/AQP-234-…`, "reviewed narrowly by reviewer-quality", and that "QA verifies SCR-13 and SCR-11 at seven widths and measures the other delivered tables". Ruling 2 puts DEF-020 in the same PR "with the SCR-11 hook checked" and both `test.fail` lines removed. Condition 3 of the AQP-122 G7 record reads "developer, then reviewer-quality (narrow), then qa-engineer". One quality report is therefore the full G6 evidence for this PR. Standards and performance reports are not required, and their absence is not a gap.
- **Artefacts evaluated:**
  - **PR #135** at 04bec3e (`gh pr view 135`): open, not draft, merge state CLEAN. Labels `bug`, `ai-delivery`, `review:quality-approved`. Commits 8fdeca8 (AQP-235), 51c3092 (AQP-234), a698239 (AQP-235, QLT-01 and QLT-04) and 04bec3e (AQP-234, QLT-02 and QLT-03). The PR body's Dev Record: files, quality loop, negative control, findings table, follow-up #134.
  - **CI run 42649224878** on 04bec3e (`gh api …/commits/04bec3e…/check-runs`): `Stages 1 to 11`, `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 3)`, `(shard 2 of 3)` and `(shard 3 of 3)`, 5 of 5 success.
  - **Quality review** `docs/06-reviews/AQP-234/quality.md` (branch `docs/AQP-234-review-quality`, 9b82dd7; brought into this docs PR). PR reviews 5828317828 (round 1, REQUEST CHANGES submitted as COMMENT, at 51c3092) and 5828643475 (round 2, APPROVE WITH COMMENTS submitted as COMMENT, at 04bec3e). The eight reviews with no body between them (5828532190 to 5828640635) are thread replies.
  - **Spec:** ux-spec v0.19 §6.0 "Masters tables" on `master`: the widths table, the Width rule, the Build notes and the Tests list.
  - **My own checks** (worktree `master-g6-234`; nothing was run against the app):
    - **Scope:** `git log --stat origin/master..04bec3e` lists 11 files, +335 / -37. Ten are the Dev Record's list: `table.tsx`, `globals.css`, `material-list.tsx`, `process-list.tsx`, `process-opener.ts`, `use-material-master.ts`, `use-process-master.ts`, `masters-table-actions.spec.ts`, `aqp-122-qa.spec.ts` and `process-opener.test.ts`. The eleventh, `tests/e2e/process-master.spec.ts` (+24, a698239), is the QLT-04 twin test. The round-2 commits touch only `process-opener.ts` and three test files. Nothing outside the masters UI, the shared `Table` and their tests is changed.
    - **Secrets:** `git diff origin/master...04bec3e` piped to `zricethezav/gitleaks:v8.30.1 stdin --redact` (local Docker): about 32 KB scanned, no leaks, exit 0. No env, config or fixture file is touched.
    - **ux-spec §6.0 build note:** line 459 gives the row-action wrapper as `gap-s-1` (4 px). The Width rule (line 426) says the gap is 8 px and derives 112 and 156 px from it. The build uses `gap-s-2` (8 px), which matches the rule. Confirmed: the spec line is wrong, not the code.
  - **Not done by me:** no e2e run (the machine is low on memory), and no re-run of the unit plant (reviewer-quality ran it: 2 of 5 fail with `if (listFailed) return;` restored). The sticky negative control (the forced cases fail at 1024 px without `sticky right-0`) is the developer's run, reported on the PR thread and not reproduced by anyone independent. It is handed to QA (condition C).

**Checklist**
| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1* | Review reports present (DL-121 route: reviewer-quality, narrow) | ✅ | `quality.md` rounds 1 and 2; PR reviews 5828317828 and 5828643475 |
| 2* | Zero open Blocker or Critical findings | ✅ | Round 2 table: 0 Blocker, 0 Critical, 0 Major, 0 Minor |
| 3 | Major findings fixed or accepted | ✅ | QLT-01 fixed in a698239 (`listFailed && focusIsOnPage()`); the unit plant fails 2 of 5. QLT-02 fixed in 04bec3e (forced width `max(1000, region + 200)`; start, Tab and far end; asserts `scrollWidth > clientWidth`) |
| 4 | Minor findings fixed or accepted | ✅ | QLT-03 fixed in 04bec3e (region inside the viewport; Tab case). QLT-04 fixed in a698239 (`process-master.spec.ts:365`, 3 projects) |
| 5 | Findings cite file:line | ✅ | Every QLT row has a file:line |
| 6 | DL-121 specifics | ✅ | Both `test.fail` markers removed from `aqp-122-qa.spec.ts`, and both tests pass plainly in 3 projects. The SCR-11 hook is now guarded by an e2e (QLT-04). The pass line, 768 to 1440 px, is covered by 11 widths on 2 screens: 22 cases, green |
| 7 | CI green on the exact head | ✅ | Run 42649224878, 5 of 5. Shards 196, 196 and 202 passed, 0 failed, 0 flaky (from the reviewer's reading of the logs) |
| 8 | Scope and secrets | ✅ | The 10 Dev Record files plus 1 follow-up test file; Gitleaks clean |
| 9 | Dev Record current | ⚠️ | The PR body still describes round 1 only. It has no row for QLT-01 to QLT-04 or for commits a698239 and 04bec3e, and `process-master.spec.ts` is missing from "Files changed" (condition A) |
| 10 | Spec consistent with the build | ⚠️ | ux-spec §6.0 build note says `gap-s-1`; the Width rule needs 8 px (condition B) |

**Info findings accepted (no tech-debt issue, since none is Major or Minor):**
- QLT-05: the actions cells rely on the parent `Table` having `actionButtons`. This is documented in the JSDoc, and the forced-width test now catches a missing prop on these two screens. Later callers (#134, story 02.05) carry the risk.
- QLT-07: the local axe timeout is a data-volume effect; the test passed first try in CI.
- QLT-08: the baseline run is blank; CI covers it.
- QLT-09: praise.
- QLT-10: a rare SCR-11 path lands on the page `h1`, not the error title. Focus is on a named element, not lost. The ux-expert may ask for the title; no change is required.
- QLT-11: the Tab check does not isolate `scroll-padding-inline-end`. No focusable control sits under the column today.
- QLT-06 (row lines under the sticky column) is a QA visual check: condition C.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #135 body, Dev Record | Add QLT-01 to QLT-04 to "Findings / defects addressed" with commits a698239 and 04bec3e and their tests. Add `tests/e2e/process-master.spec.ts` to "Files changed". Note that the round-2 evidence is CI run 42649224878 | Before G7 is decided |
| B | ux-expert | ux-spec §6.0 "Masters tables", Build notes (line 459) | Change the row-action wrapper from `gap-s-1` to `gap-s-2` (8 px), so it matches the Width rule and the build. Bump the version line | Next docs PR, and before AQP-130 (story 02.05) or #134 starts, whichever is first |
| C | qa-engineer | `docs/07-qa/AQP-234-test-report.md` (G7) | (1) DL-121: SCR-13 and SCR-11 at the seven widths of §6.0 (768, 1023, 1024, 1279, 1280, 1366 and 1440 px; side menu open from 1024), with every row action fully visible without table scroll and no sideways page scroll. (2) Measure the other delivered tables (SCR-14 users, SCR-16 audit, SCR-03, SCR-17) and record which still hide actions, against #134 and the §6.0 "Not changed in 0.19" row. (3) QLT-06: at 1024 px with the table forced to scroll, check on both screens that the row separators continue under the Actions column. A break is a defect (Sev-4 unless it hides content). (4) Reproduce the sticky plant: remove `sticky right-0` from `STICKY_ACTIONS`, show that the forced cases fail, post the plant diff, then restore. (5) DEF-020 on both screens: a saved change whose re-read fails leaves focus on the error title; error state, then Add, then Escape leaves focus on Add. (6) Both former `test.fail` tests pass plainly in all 3 projects. (7) Keyboard and axe checks on both screens at 768 and 1024 px | G7 |

**Risks registered:** none new. RISK-020 and RISK-023 are unchanged. The new e2e cases add about 2 to 3 s each on SCR-11, inside the shard spread (from the reviewer's reading of the logs).
**Rationale:** DL-121 set this fix's G6 as a narrow quality check, and that check ran twice. Round 1 found two real Majors: a focus regression that the fix itself introduced, and a test that could not fail on the property DEF-021 depends on. Round 2 closed both, with tests shown to fail under a plant. CI is green on the exact head, the scope is the stated files, and the diff has no secrets. What remains is a stale PR description and a wrong spec line. They would mislead the next reader but carry no user risk, so they are conditions, not holds. The sticky plant rests only on the developer's report, so QA reproduces it rather than G6 accepting it. The evidence pattern matches the AQP-227 fix-push check (DL-117): narrow scope, CI on the head, and my own scope and Gitleaks checks. So the decision matches too.
**Posted:** PR #135 comment 6744869314; Jira AQP-234 comment 11247. No tech-debt issue created (no Major or Minor deferred).

## G7 – QA Acceptance — AQP-234 / AQP-235 (DEF-021 and DEF-020: masters table actions and focus, PR #135) — 2026-11-09 (attempt 1)

- **Decision:** **GO** for AQP-234 and AQP-235. Every mandatory item passes, judged on the exact head 02cb00c. QA's recommendation (ACCEPT) is confirmed. Four rulings are in DL-123: (a) the CI cost of QA's spec, (b) DL-122 condition B, (c) the SCR-14 measurement, and (d) the merge. None holds the gate. QA moves AQP-234 and AQP-235 to Done on this decision (DL-098).
- **Decided by:** master  ·  **Human override:** none. G7 is not a human approval point (§1a), and under §8 (`MERGE_POLICY` all-auto) the orchestrator squash-merges once the conditions in ruling (d) are met.
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-234-test-report.md`, read in full, with the evidence folder `docs/07-qa/AQP-234-evidence/` (15 files: `measurements.md`, two plant diffs, three plant outputs, the QA-spec and regression outputs, six QLT-06 screenshots). Both are on `origin/fix/AQP-234-masters-table-actions` at 02cb00c. Jira AQP-234 comment 11248 (QA hand-off, ACCEPT).
  - **PR #135** at 02cb00c (`gh pr view 135`): open, not draft, merge state BEHIND. Labels `bug`, `ai-delivery`, `review:quality-approved`. QA's commits are d9c352e (spec, report, evidence) and 02cb00c (the ten `.json` evidence files replaced by `measurements.md`).
  - **CI run 42670055074** on 02cb00c (`gh api …/actions/runs/42670055074/jobs`): `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 3)`, `(shard 2 of 3)`, `(shard 3 of 3)` and the required `Stages 1 to 11`, 5 of 5 success. **The required job was still in progress at 18:09Z, when the run already showed "completed".** It finished at 18:06:32Z (it had queued 52 s for a runner) and was read as success at 18:11Z. The shard summaries give 196, 194 and 233 passed, 0 failed, and no flaky line. QA's 30 tests ran (24 in shard 3, 6 in shard 2). Run 42668714330 on d9c352e failed at Stage 3, the data-file check (ADR-014). Its three shards passed.
  - **My own checks** (worktree `master-g7-234`; nothing was run against the app):
    - **`src/` unchanged since G6:** `git diff --quiet 04bec3e 02cb00c -- src` exits 0. QA's commits add 17 files (+1,968): the spec, the report and the evidence folder.
    - **Sticky plant (condition C4), diff printed before reading the result:** `plant-sticky-right-0.diff` removes exactly `sticky right-0` from `STICKY_ACTIONS`. Its `index d0c4574` is the blob of `src/components/ui/table.tsx` at 02cb00c, so the plant was applied to the judged code. The output file ends "22 failed, 2 passed" (the 2 are set-up tests).
    - **Secrets:** `git diff 04bec3e 02cb00c` (the PNGs excluded), piped to `zricethezav/gitleaks:v8.30.1 stdin --redact`: about 194 KB scanned, no leaks. My first attempt scanned 0 bytes because of a bad flag. I re-ran it and checked the byte count before reading the result.
    - **Condition A of DL-122 (Dev Record):** the PR body now has rows QLT-01 to QLT-04 with commits a698239 and 04bec3e, `process-master.spec.ts` in "Files changed", and run 42649224878. **Met.**
    - **Condition B of DL-122:** `docs/03-ux/ux-spec.md` line 459 on `master` 9525a9f still reads `gap-s-1`. Jira AQP-130 is *Ready for Dev* (not started). #134 is open with no PR. **Not yet due** (ruling b).
    - **Branch update:** `master` has one commit since the merge base dd7e2f4: 9525a9f (#136, docs only). No file overlaps PR #135's files.
    - **CI cost of QA's spec (OBS-4)**, from the shard logs of run 42670055074: 81.5 s of logged test time. G7-1 is 21.9 s (14 tests), G7-3 7.1 s (2), G7-5 23.8 s (6) and G7-7 28.7 s (8), about 2.7 s per test, not the 6 s QA measured locally. That is about 7 s per shard on average (81.5 / 4 workers / 3 shards). In this run shard 3 carried 59.7 s (about 15 s), shard 2 24.0 s, and shard 1, the slowest, none.
    - **Required path (test strategy 10.3: first job's start to the end of `Stages 1 to 11`):** 04bec3e **5:49** (before QA's tests), d9c352e 5:58 (failed), 02cb00c **6:11**, of which the slowest shard ends at 5:16 and the fan-in waits 52 s for a runner.
  - **Not done by me:** no e2e or unit run, and no re-run of the DEF-020 plants or the QLT-06 pixel check (the machine is low on memory). Those rest on QA's committed evidence and the CI run.

**Checklist**
| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1* | Every AC has a verification result with evidence | ✅ | Report "AC verification matrix": the §6.0 pass line and parts 2 to 5, AQP-122 AC-7 and AC-8, QLT-01 and QLT-06, each Pass with a named test and evidence file. Condition C items 1 to 7 are all reported, with method and evidence |
| 2* | No open Sev-1 or Sev-2 defects | ✅ | Report "Defects": none new. DEF-021 (Sev-3) and DEF-020 (Sev-4) fixed and verified. No other open defect is tied to these issues |
| 3* | Regression suite result recorded and green | ✅ | Local: 177 passed, 0 failed, 44 skipped by design, `retries: 0` (`regression-3-projects-output.txt`). CI 42670055074 on 02cb00c: 5 of 5, shards 196, 194 and 233 passed, 0 failed |
| 4 | Exploratory testing notes present | ✅ | Report "Exploratory notes", a 30 min charter (break the sticky column and the focus rule) |
| 5 | Accessibility checks for UI stories | ✅ | G7-7: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), 0 violations, as drawn and forced to scroll, at 768 and 1024 px. Keyboard walk with focus visible and not covered |
| 6 | Condition C of DL-122 | ✅ | C1 14 of 14; C2 measured (table 2); C3 no break, 1.00 under the column at all row boundaries; C4 22 of 22 fail under the plant (diff checked above); C5 Pass on both screens, plants A (7 of 7 fail) and B; C6 6 of 6 in 3 projects; C7 Pass |
| 7 | Conditions A and B of DL-122 | ✅ / not due | A met. B open, due before AQP-130 or #134 starts (ruling b) |
| 8 | Scope and secrets of QA's commits | ✅ | `src/` identical to 04bec3e; Gitleaks clean on the text diff |
| 9 | CI green on the judged head | ✅ | Run 42670055074, 5 of 5, on 02cb00c (the required job confirmed complete, as above) |

**Rulings (DL-123):**
- **(a) OBS-4, QA's 30 CI tests.** They are kept in this PR, and part of them is trimmed later. G7-3 (QLT-06) and G7-5 (DEF-020, both screens, the blocked path) stay for good. They are the only automated cover for those properties, and plant B shows G7-5 fails without the QLT-01 fix. G7-1 (14) goes, because the developer's 22 cases at 11 widths and `aqp-122-qa` AC-7 cover it. The 768 px half of G7-7 (4) goes, because the as-drawn axe scans in `aqp-122-qa`, `materials` and `process-master` cover it. The 1024 px forced-scroll axe and keyboard tests stay, since no other spec scans that state with axe. **Owner:** qa-engineer, as tech-debt **#137** (test-only, one file, deletions only). Master checks the diff and CI with no review round (DL-047 pattern). **Due:** with QA's next committed test change, or before the sprint 1 review, whichever is first; at the latest G8. Not now: a commit on the judged head would break ruling (d)'s "PR files unchanged" and need a second G7 look, all to save about 3 s per shard.
- **RISK-023 reading.** The trigger reading of test strategy 10.5 is met, and it was met before QA's tests: 5:49 on 04bec3e, 6:11 on 02cb00c. QA's tests did not lengthen this run's path, since the slowest shard carried none. So the cause is the suite and the fan-in queue, not this PR, and a trim does not change the outcome. The procedure applies to the head that merges (ruling d6). No hold: 6:00 stays a warning (DL-102, DL-103).
- **(b) DL-122 condition B does not hold this G7.** It was set "before AQP-130 or #134 starts", and neither has started. It is a spec line, and the build already uses the Width rule's 8 px. The orchestrator checks it before delegating AQP-130 or #134. Owner: ux-expert.
- **(c) SCR-14 Users stays with follow-up #134 and does not block.** SCR-14 is outside DEF-021's scope (SCR-13 and SCR-11; DL-121 ruling 1 asked only that the other tables be measured). The fault appears only with a 120-character unbroken name; seed data shows all 15 actions. The page never scrolls sideways, the table scrolls inside its region, and no WCAG AA criterion is shown to fail, so DL-094's Sev-2 rule does not apply (the same reasoning as DEF-021 under DL-121). #134 had no owner or due point. **Owner:** scrum-master places it; the developer fixes it. **Due:** before the sprint 1 review, at the latest G8, and in any case before a Users story or AQP-130 copies the plain table. QA's G7-2b measurement (1,603 px at every width, 18 of 18 actions outside the region) is #134's acceptance baseline.
- **(d) Merge (DL-120, DL-121 pattern):** see the conditions table.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| d1 | orchestrator | this docs PR (G7 record, DL-123) | Merge it first (docs-only, after this GO) | Before PR #135 is updated |
| d2 | orchestrator | PR #135 | Update from `master` by a merge commit (no rebase, no force-push). The update leaves PR #135's files unchanged; any conflict resolution in them comes back to master | Before the squash |
| d3 | orchestrator | PR #135 | All 5 checks green on the updated head. A re-run to green names its failing test; anything other than DEF-022's union test comes back to master | Before the squash |
| d4 | orchestrator | PR #135 comment | Post the head SHA, the run ID, the commits taken from `master` and the path time before the squash | Before the squash |
| d5 | qa-engineer | Jira AQP-234, AQP-235 | Transition to Done on this decision (DL-098). Done does not wait for the merge, and the merge does not wait for Done | Now |
| d6 | orchestrator, then product-manager | PR #135 runs, Intake comment | If the updated head's path is 5:30 or more, run two full re-runs of that head and post the median of the three. If it is 5:30 or more, the product-manager places the next EPIC-10 enabler (DL-084 and DL-116 route). The squash does not wait for the re-runs | Same day as the merge |
| a | qa-engineer | `tests/e2e/aqp-234-qa.spec.ts` (#137) | Ruling (a) trim | Next QA test change or the sprint 1 review; latest G8 |
| b | ux-expert | ux-spec §6.0 build note | `gap-s-1` → `gap-s-2` (DL-122 B, unchanged) | Before AQP-130 or #134 starts |
| c | scrum-master, developer | #134 | Place and fix (ruling c) | Sprint 1 review; latest G8 |

**Risks registered:** none new. RISK-023 is not re-scored here, since the brief does not name the register. Its trigger reading is met (5:49, 6:11), and the procedure is condition d6. The solution-architect restates the headroom figure in test strategy 10.5 at the next docs change.
**Rationale:** QA verified every item of condition C on the exact code that G6 judged. QA reproduced the sticky plant independently, which closes the one point G6 rested on the developer's word alone. CI is green on the head that carries QA's tests, so the spec is shown to run in the pipeline. The open items are a spec line not yet due, a follow-up outside this defect's scope, and a CI cost that is real but small and not what caused the path reading. Each now has an owner and a due point. None is a risk to users or correctness on the screens this PR changes. The same evidence pattern gave GO at AQP-122 (DL-121) and AQP-227 (DL-120).
**Posted:** PR #135 comment 6747841591; Jira AQP-234 comment 11250, AQP-235 comment 11251. Tech-debt issue created: #137 (ruling a).

## G6 – Peer Review — tech-debt #130 (shared late-failure runner, PR #139) — 2026-11-09 (attempt 1)

- **Decision:** **CONDITIONAL GO.** The narrow route (DL-124 ruling 1) is met. reviewer-quality's round 2 approves with comments, the round-2 Minor and Info are fixed in a879d61 (checked by master), and CI is green on a879d61. The one condition is the PR description, which does not hold G7.
- **Decided by:** master  ·  **Human override:** none
- **Review route:** #130 names reviewer-quality as the reviewer ("reviewer-quality re-plants A3 and A4"). DL-121 and DL-122 set the narrow route for a fix with one surface. PR #139 changes 7 files, all under `tests/` (`tests/support/late-failure-runner.ts`, `tests/support/late-failure.ts`, 2 masters integration files, 1 audit integration file, 2 unit files), with no `src/`, config, dependency or workflow change. So one quality report is the full G6 evidence. The standards hygiene items are checked by master below; the performance surface is CI time, measured by the path rule. The G6 checklist item "three reports present" is not met as written; this is a recorded exception (DL-124).
- **Artefacts evaluated:**
  - **PR #139** at a879d61 (`gh pr view 139`): open, MERGEABLE, labels `ai-delivery`, `tech-debt`, `review:quality-approved`, body "Closes #130". Commits b165c2c, a0db6c2, 9254510, a879d61. `origin/master` (eed733b) has no commit missing from the head.
  - **Quality review** `docs/06-reviews/130/quality.md` (branch `docs/130-review-quality`, be99f56; brought into this docs PR). PR reviews 5834954712 (round 1, REQUEST CHANGES as COMMENT: QLT-01 Major, QLT-02 Minor, 6 Info) and 5835041397 (round 2, APPROVE WITH COMMENTS as COMMENT: both fixed; new QLT-09 Minor, QLT-10 Info). The reviewer re-planted A3 and A4 on a throwaway PostgreSQL 17, with each diff printed: masked by the old local runners (all AC-5 tests pass), caught by the shared runner (A3 fails both create tests, A4 both update tests). QLT-02 confirmed by mutation (a shared depth counter fails both concurrency tests).
  - **My own checks** (worktree `master-139`; no tests run locally, the machine is low on memory):
    - **a879d61, unreviewed:** `git diff 9254510 a879d61` is 1 file, `tests/unit/late-failure-runner-use.test.ts`, +29 / -4. It adds `ts.isPropertyDeclaration` to `isNamedMember`, adds `isAssignmentTo` (an `=` whose left side is `x.run` or `x['run']`), and calls it in `visit`. This is the reviewer's suggested code for QLT-09. It adds 4 refused-form rows (class field, property assignment, quoted assignment, assignment onto a shared runner), each with the shared helper also imported and called. The header now names the QLT-10 limits (`Object.defineProperty`, a runner imported from another file) and the A3/A4 re-plant that covers them. No production path, no new dependency. Compound assignments (`||=`) are not caught; that is contrived and also covered by the re-plant, so no finding.
    - **Scope:** `git diff --stat origin/master...a879d61`: 7 files, +534 / -38, all under `tests/`.
    - **Secrets:** that diff piped to `zricethezav/gitleaks:v8.30.1 stdin --redact` (local Docker): about 32.7 KB scanned, no leaks, exit 0.
    - **CI:** run 42730771190 on 9254510 green, 5 of 5. Run 42731951221 on a879d61: green, 5 of 5 (`Stages 1 to 11b` 00:55:17 to 00:58:13Z, so the guard unit tests ran green; E2E shards 1, 2 and 3; `Stages 1 to 11` ended 01:01:14Z). Path 5:57 (first job start to the end of `Stages 1 to 11`); the slowest shard ended at 5:50. The diff adds no E2E test, so this reading is the suite, not this PR (RISK-023, DL-123 reading).
    - **PR description:** the Dev Record still gives the guard file as "(20)" tests and has no row for QLT-09 / QLT-10 or a879d61 (now 24 guard tests, 35 unit tests across the 2 unit files, per the developer).

**Checklist**
| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1* | Review reports present for the route | ✅ (narrow route) | `docs/06-reviews/130/quality.md`, rounds 1 and 2; DL-124 ruling 1 |
| 2* | Zero open Blocker / Critical | ✅ | Round 1: 0 / 0; round 2: 0 / 0 |
| 3 | Major fixed or accepted | ✅ | QLT-01 fixed in 9254510 (reviewer-verified, round 2) |
| 4 | Minor / Info | ✅ | QLT-02 fixed (mutation-verified); QLT-09 and QLT-10 fixed in a879d61 (master-verified); QLT-03, -04, -06, -07 Info accepted, no tech-debt issue |
| 5 | Findings cite file:line | ✅ | Every finding row has file:line |
| 6 | Scope and secrets | ✅ | 7 files under `tests/`; Gitleaks clean |
| 7 | CI green on the judged head | ✅ | Run 42731951221 on a879d61 (above) |
| 8 | PR description matches the head | ⚠️ | Guard count 20 (now 24); no a879d61 row. Condition 1 |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #139 description (Dev Record) | Add a QLT-09 / QLT-10 row with a879d61; guard count 20 → 24; 35 unit tests; CI run 42731951221 | Before the squash (merge condition d) |

**Risks registered:** none new. The residual (a runner defined outside the masters folder or by `Object.defineProperty`) is covered by #130's re-plant of A3 and A4 at each audited master's G6 (AQP-123, 02.05, 02.02).
**Rationale:** the risk in a test-only PR is a test that passes over a fault. The reviewer showed, by plant and by mutation, that the new runner and guard catch what the old ones masked. The one unreviewed commit is the reviewer's own suggested fix, which master read line by line.
**Posted:** PR #139 comment 6755851518 (G6 and G7 together); Jira AQP-123 comment 11258. No tech-debt issue created (no finding deferred).

## G7 – QA Acceptance — tech-debt #130 (shared late-failure runner, PR #139) — 2026-11-09 (attempt 1)

- **Decision:** **GO.** Decided now, without a QA run (DL-124 ruling 3). The orchestrator may squash-merge PR #139 under CLAUDE.md §8 once the merge conditions below are met.
- **Decided by:** master  ·  **Human override:** none
- **Acceptance items:** #130's three "Required" points, which the PR body maps under "Acceptance criteria coverage". There is no Jira story to move; #130 closes on the merge.

**Checklist**
| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1* | Every acceptance item has a result with evidence | ✅ | (1) One shared outermost-only runner, no retry or raised limit: `tests/support/late-failure-runner.ts`; unit tests incl. overlapping-and-nested calls; reviewer mutation. (2) Masters tests moved, guard in place: `materials.test.ts` and `process-items.test.ts` use `createLateFailingRunner`; AST guard with 24 cases; reviewer probes. (3) A3 and A4 fail both masters files with the shared runner and pass with the old ones: reviewer re-plant, diffs printed (`quality.md`, "The plants") |
| 2* | No open Sev-1 / Sev-2 defects | ✅ | None raised against PR #139 |
| 3* | Regression recorded and green | ✅ | CI 42731951221 on a879d61 (G6 entry above) |
| 4 | Exploratory notes | n/a | Test-only change, no user-facing behaviour |
| 5 | Accessibility checks | n/a | No UI |

**Merge conditions (DL-124 ruling 4)**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | orchestrator | this docs PR | Merge it first (docs-only, after this GO) | Before PR #139 is updated |
| b | orchestrator | PR #139 | Update from `master` by a merge commit (no rebase, no force-push), its 7 files unchanged; a conflict in them comes back to master | Before the squash |
| c | orchestrator | PR #139 | 5 of 5 checks green on the updated head. A re-run to green names its failing test; anything but DEF-022's union test comes back to master | Before the squash |
| d | developer, checked by orchestrator | PR #139 description | G6 condition 1 met | Before the squash |
| e | orchestrator | PR #139 comment | Head SHA, run ID, commits taken from `master`, path time. If the path is 5:30 or more, DL-123 (d) applies; the squash does not wait for the re-runs | Before the squash |
| f | orchestrator | GitHub #130 | Confirm the merge closed it; if not, close it as completed with the merge commit | After the squash |
| g | reviewer-quality | AQP-123 G6 | Re-plant A3 and A4 on AQP-123's new integration file (#130), and the same at 02.05 and 02.02 | Each audited master's G6 |

**Risks registered:** none new.
**Rationale:** each acceptance item has evidence from someone other than the developer, and the regression is green on the exact head. A QA run would repeat the reviewer's plants and has no user-facing behaviour to check.
**Posted:** PR #139 comment 6755851518 (G6 and G7 together); Jira AQP-123 comment 11258. No tech-debt issue created (no finding deferred).

## Docs PR merge — #144 (sprint 1 refinement: plan v0.14, four enablers Ready, DL-122 condition B) — 2026-11-10 (attempt 1)

- **Decision:** **GO.** The orchestrator may squash-merge PR #144 (docs only) once master's four governance files are committed to it and CI is green on that head (DL-126).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #144** at c91fd64 (`gh pr view 144`): open, not draft, MERGEABLE, CLEAN, labels `documentation` and `ai-delivery`. It has five commits (dae58dd, 7452dae, 3242b0e, fef5993, c91fd64), and its merge base is `origin/master` 023e17d. The six files are `docs/05-backlog/sprint-01-plan.md` v0.14, `docs/02-product/prd.md` and `release-plan.md` v0.22, `docs/03-ux/ux-spec.md` v0.20, and `docs/04-architecture/architecture.md` v0.32 and `test-strategy.md` v0.28. CI on c91fd64 is green, 5 of 5.
  - **Jira:** AQP-1 comments 11259 to 11282; the product-owner's results on the stories (AQP-243 11268, AQP-237 11269, AQP-244 11270, AQP-245 11271); the architect's rulings (AQP-243 11278, AQP-244 11279); the ux-expert on AQP-245 (11277). Statuses read by JQL: AQP-237, AQP-243, AQP-244 and AQP-245 are Ready for Dev; AQP-123 is In Progress; AQP-234 and AQP-235 are Done.
  - **My own checks** (worktree `sm-wave2`, read-only apart from these records):
    - `git diff --name-only origin/master...HEAD`: six paths, all under `docs/`.
    - That diff piped to `zricethezav/gitleaks:v8.30.1 stdin --redact`: about 183 KB scanned, no leaks, exit 0.
    - `git grep '\.record(' 023e17d -- src/server/services`: 11 call sites (5 in `masters-service.ts`, 6 in `user-service.ts`), as architecture v0.32 section 6 and AQP-237 AC-4 now say.
    - Condition B on the build: on `origin/master`, `process-list.tsx` line 63 and `material-list.tsx` line 80 use `flex flex-nowrap items-center justify-end gap-s-2`. The arithmetic of the Width rule (ux-spec line 426) is 2 × 36 + 8 + 32 = 112 and 3 × 36 + 16 + 32 = 156. `USER_NAME_MAX_LENGTH = 120` (`src/lib/users/validation.ts` line 16); the process-item and material limits are 100.
    - Nothing was run beyond these: no test or build, as the PR has no code.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | The PR touches only `docs/` | ✱ | ✅ | Six paths, listed above; `gh pr view 144 --json files` agrees |
| 2 | CI green on the judged head | ✱ | ✅ | 5 of 5 on c91fd64 (`Stages 1 to 11b`, three shards, `Stages 1 to 11`) |
| 3 | No secrets | ✱ | ✅ | Gitleaks over the diff, no leaks |
| 4 | The four Ready moves rest on product-owner validation | ✱ | ✅ | READY, 17 of 17 on each (11268 to 11271), posted 23:07 to 23:09; the scrum-master's moves (11281) came at 23:18; Jira reads Ready for Dev |
| 5 | DL-122 condition B written as ruled | ✱ | ✅ | ux-spec v0.20 line 459 reads `gap-s-2`, matching the Width rule and the delivered build; the Version row and change-log row 0.20 record it |
| 6 | Corrections consistent across documents | | ✅ | AQP-243 AC-4 reads "lower than its own base median, by any amount" in test strategy 10.5 item 7, PRD 13.16 item 6, release plan 3.14 (both places) and sprint plan v0.14; the `record` count is 11 in architecture section 6 and the plan; AQP-244 AC-1 takes its timing from `list` reporter log lines (test strategy 10.5 item 8) |
| 7 | No scope change hidden in the PR | | ✅ | PRD and release plan v0.22 change wording only (no FR, NFR, priority, effort or date change); the counts stay 55 of 55 committed, 104 planned |
| 8 | Plan text current | | ⚠️ | "Not Ready, and why" still says AQP-188 is Draft and that the plan assumes way 1, with no history marker. Minor, scrum-master, next plan version |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | orchestrator | PR #144 | Commit only `docs/00-governance/decision-log.md`, `risk-register.md`, `gate-log.md` and `docs/project-state.md`; CI green on the new head; if `master` has moved, update the branch by a merge commit, docs only; squash | Before the merge |
| b | orchestrator | `origin/master` after the merge | `git grep -n "justify-end gap-s-1" origin/master -- docs/03-ux/ux-spec.md` returns nothing and line ~459 reads `gap-s-2` (DL-122 condition B met); then ask the scrum-master to close AQP-245's Gates line | Before delegating AQP-130 or AQP-245 |
| c | orchestrator | Dependabot #145 | Close it unmerged with the DL-127 reason and `@dependabot ignore this major version`; list it in the next results report | Now (it does not hold #144) |
| d | scrum-master | `sprint-01-plan.md` | Refresh or mark as history the stale "Not Ready, and why" lines | Next plan version |
| e | solution-architect | GitHub #143 | Decide whether the #143 PR also adds a semver-major `ignore` for `postgres` to the `docker-compose` entry (DL-127 (3)) | With #143 |

**Risks registered:** RISK-023 re-scored, P 3 → 4, score 6 → 8 🟡 (DL-125); no new risk.
**Rationale:** the PR is documentation only, every Ready move has the product-owner's READY before it, and condition B's line now matches the rule and the delivered build, so merging the PR is what meets the condition. The one gap is history text in the plan that still reads as current, with no effect on any story's start.
**Records:** DL-125 (placement of AQP-243 and AQP-244, corrections, RISK-023), DL-126 (this merge, condition B, G4 condition 3), DL-127 (Dependabot #145 and database majors; #148 noted).
**Posted:** Jira AQP-1 comment 11283; PR #144 comment 6759069406. No tech-debt issue created (no finding deferred).

## G6 – Peer Review — AQP-243 (STORY-10.19, CI set-up cut and set-up summary, PR #152) — 2026-11-10 (attempt 1)

- **Decision:** **CONDITIONAL GO.** Zero Blocker and zero Critical across the three reviews. The three Majors (QLT-01, QLT-02, STD-01) are upheld and are fixed in one push, together with the Minors named below. reviewer-quality and reviewer-standards re-review the new diff only, and master closes G6 on the fix head before AQP-243 goes to In QA (DL-128).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #152** at c24fe22 (`gh pr view 152`): open, not draft, MERGEABLE, CLEAN; 10 files, +1,435 / -18 (`ci.yml`, `README.md`, `scripts/ci/node-modules-integrity.sh`, `scripts/lib/ci-run-summary.ts`, `tests/support/ci-run-jobs.ts` and five test files); nothing under `src/`, no dependency or lockfile change. Six commits on base 051c0b5. The PR body's Dev Record, measurement tables, safety checks and the "Assertions removed or weakened (G12 rule)" table (six rows) were read.
  - **Reviews:** standards 5837789330 (REQUEST CHANGES: 1 Major, 5 Minor, 5 Info), performance 5837827119 (APPROVE WITH COMMENTS: 2 Minor, 3 Info), quality 5837890079 (REQUEST CHANGES: 2 Major, 2 Minor, 3 Info); the reports `docs/06-reviews/AQP-243/{standards,quality,performance,consolidated}.md`.
  - **Jira AQP-243:** architect 11261 and 11278 (the ruled key), product-owner 11268 (restated ACs, READY 17 of 17), developer 11290, reviewer hand-offs 11292 to 11294, brief 11295.
  - **Governance:** test strategy v0.28 section 10 (the G12 rule) and 10.5 item 7; DL-117, DL-121 to DL-127; RISK-023.
  - **My own checks** (dev-243 worktree at c24fe22, read-only; plants restored with `git checkout`, `git status` clean afterwards; probe files kept in the scratchpad, outside the repository):
    - **QLT-01 reproduced.** A Node type-stripping probe importing `cacheState`: fallback `success` gives `fallback`; fallback `failure` gives `hit`; fallback `cancelled` gives `hit`. The workflow confirms why: the check step always succeeds (it only writes `intact`), so a failed fallback falls through to `hit`.
    - **QLT-02 reproduced.** P3 (a `.next` hand-over: `actions/cache/save` in `verify`, `actions/cache/restore` in `e2e`, same run key, pinned SHA; diff printed, 12 lines) and P5 (a second save of `~/.cache/ms-playwright` under another key; diff printed, 6 lines) each leave `ci-workflow`, `ci-setup-cut` and `aqp-27-scaffold` at 3 files, 160 of 160 passed. My first two attempts did not apply (no Python; CRLF anchors in this worktree); the plant script stopped on the anchor count, and no result from those attempts is used.
    - **STD-01 confirmed by reading:** `ci-run-summary.ts` lines 320 to 327, both handlers set exit code 0 and print nothing.
    - **Paths recomputed** from the jobs API (first job start to the end of `Stages 1 to 11`): base 42757450173 attempts 1 to 3 = 5:38, 5:55, 5:29 (median 5:38); head 42763746916 attempts 1 to 3 = 4:46, 4:45, 4:53 (median 4:46). These match the PR and reviewer-performance. The set-up medians were not recomputed by me (reviewer-performance did so from the API).
    - **CI on c24fe22:** 5 of 5 check runs `success` (`Stages 1 to 11` completed 06:07:45Z).
    - **Gitleaks** v8.30.1 (Docker) over `git diff 051c0b5 c24fe22`: about 87 KB scanned, no leaks.
    - **Cache entries** read: six `node-modules-v1-…` entries (#152 one, #153 one, #154 four), as reviewer-performance listed.
    - Not re-run: lint, type-check and the full unit suite (CI stages green on the head; reviewer-standards ran eslint and `tsc` read-only).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present (standards, quality, performance) | ✱ | ✅ | `docs/06-reviews/AQP-243/`; PR reviews 5837789330, 5837890079, 5837827119 |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | 0 and 0 in each report; consolidated table |
| 3 | Major findings fixed or explicitly accepted | | ⚠️ | QLT-01, QLT-02, STD-01 open on c24fe22, each reproduced or confirmed by master; fix push required (conditions A to C) |
| 4 | Findings cite file:line | | ✅ | every finding in the three reports carries a path and line |
| 5 | G12: changed guard assertions declared and still guarding | | ⚠️ | six of six declared in the PR body (reviewer-standards matched them to the diff); two of the six are not fully replaced (P3, P5 survive) |
| 6 | Scope and hygiene | | ✅ | 10 files, nothing under `src/`; every `uses:` pinned to a SHA already in the file; fan-in job holds `actions: read` and `contents: read` only; Gitleaks clean |
| 7 | CI green on the judged head | | ✅ | 5 of 5 on c24fe22 |
| 8 | Story's measured promise (AC-4, AC-7) | | ✅ | pooled set-up 71.5 → 7 s, every job lower (reviewer-performance, from the API); path 5:38 → 4:46 (recomputed by master); billed 22 → 19 min |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #152, one push | **QLT-01:** the cache state is decided by "the step ran" (conclusion neither `skipped` nor absent), so a failed or cancelled fallback reads `fallback` and a failed miss reads `miss`; unit tests for fallback `failure`, fallback `cancelled` and miss `failure`. **QLT-02:** a whole-workflow test that every `actions/cache/save` and `actions/cache/restore` step is one of the four `install, restore/save node_modules` steps, with `path: node_modules` and the `nmkey` key, and that there are exactly four such `uses:` lines. **STD-01:** keep exit 0 and write a `::warning::` naming only the error's class; test with an unwritable summary path. **Minors in the same push:** STD-02 = QLT-04 = PRF-01 (`timeout-minutes: 1` on each of the three `Summary:` steps, pinned in `ci-setup-cut.test.ts`); QLT-03 (jobs that started before the attempt are left out of the path and the slowest shard and marked "earlier attempt"; test with a carried-over shard); STD-03; STD-04; STD-05 (one env entry for the format number, with the **resolved key string unchanged**, so the existing entry still hits); STD-06 with PRF-02's wording (per key per ref, the two sibling caches, usage at merge); STD-08 (header line). **Dev Record** updated for round 2: a row per finding with its commit, the new test count, the plants re-run, and the CI run on the new head | Before the re-review |
| B | reviewer-quality; reviewer-standards | PR #152, new diff only | reviewer-quality: QLT-01 to QLT-04, and re-plants P3 and P5 itself plus one variant (a split cache step with `path: node_modules` under another key), each diff printed. reviewer-standards: STD-01 to STD-06 and STD-08. reviewer-performance is **not** required, unless the push changes an install step other than the key expression, or adds a step outside the three `Summary:` steps; then it re-reviews those lines only | After A |
| C | master | gate log | G6 close on the fix head: both re-reviews with no open Major; CI 5 of 5; diff limited to the PR's 10 files; master re-runs P3, P5 and the QLT-01 probe; the run log shows the same resolved key and `hit` in all four jobs. Then the orchestrator moves AQP-243 to In QA | After B |
| D | qa-engineer | `docs/07-qa/AQP-243-test-report.md` | G7 evidence: (1) P3 and P5 re-planted on the final head, each caught, diffs posted; (2) a failed-fallback probe (fallback `failure` and `cancelled` give `fallback`; miss `failure` gives `miss`); (3) the script run with an unwritable `GITHUB_STEP_SUMMARY`: exit 0 and one `::warning::` with no path or credential text; (4) removing one `Summary:` step's `timeout-minutes` is caught by a named test; (5) the carried-over-shard case (unit test, read against run 42463553178 attempt 5); (6) the final head's summary shows `hit` in all four jobs with the same resolved key as c24fe22, and the head's path; (7) AC-1 to AC-7 each with evidence, citing the reviewers' recomputed AC-4 and AC-7 figures; the corrupt-cache and lockfile controls (#153, #154) are not repeated unless the install steps changed beyond the key expression | G7 |
| E | solution-architect | test strategy 10.5 item 7, architecture 9.2 (AC-8 amendment) | Record the format number in the key (STD-07, QLT-05: accepted at G6, fails safe); the AC-2 window note (QLT-06); PRF-04 (a trial without `setup-node`'s `cache: npm`); PRF-05 as a standing reading rule (DL-128 (4)); whether a fourth shard is still due | After the merge, before AQP-244's G6 |
| F | orchestrator | PR #152 merge | Merge conditions in DL-128 (6) | After G7 GO |
| G | orchestrator | results report | List the #153 and #154 cache entries (five keys, about 1,167 MiB) for the delivery lead. Master does not authorise deleting them (DL-128 (5)) | Next results report |

**Accepted with no tech-debt issue:** STD-09 (`.gitattributes`, a separate change if wanted), STD-10, STD-11, QLT-06, QLT-07, PRF-03 (Info). STD-07 / QLT-05, PRF-04 and PRF-05 go to the architect (E). No Major or Minor is deferred.
**Risks registered:** RISK-023 restated, score 8 unchanged: the reading rule for cache-miss runs (DL-128 (4)). No new risk.
**Rationale:** the change works today and is measured: the set-up cut is real (64.5 s off the pooled median, every job lower) and the cache fails safe in both live controls. The Majors are a summary that misreports the one state it exists to show, two guards that look complete and are not, and a silent error path. They are the DL-117 class (missing guards, fixed before QA). Because the push changes the summary script, a narrow re-review is required (DL-051, DL-091), not master verification alone.
**Brief correction:** DL-117 (8) requires AQP-243 to be **Ready** before AQP-142 starts (met); merging before AQP-142's G6 is the risk register's preference, not a gate rule.
**Posted:** Jira AQP-243 comment 11298; PR #152 comment 6761367568. No tech-debt issue created (no Major or Minor deferred).

## G6 – Peer Review — AQP-123 (STORY-02.04 Exchange Rate Master, PR #151) — 2026-11-10 (attempt 1)

- **Decision:** **CONDITIONAL GO.** Zero Blocker and Critical across the three reviews. QLT-01 (Major) is upheld and fixed in one push with the Minors named below. reviewer-quality re-reviews the new diff. Master closes G6 on the fix head before AQP-123 goes to In QA (DL-129).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #151** at 939f32f (`gh pr view 151`): open, not draft, MERGEABLE, **BEHIND** `master` by one docs-only commit (051c0b5, PR #144: ten files under `docs/`). 45 files, six commits on merge base 023e17d. Labels `review:standards-approved`, `review:quality-changes-requested`, `review:performance-approved`.
  - **Reviews:** standards 5837425748 (APPROVE WITH COMMENTS: 9 Minor, 4 Info), quality 5837957001 (REQUEST CHANGES: 1 Major, 3 Minor, 6 Info), performance 5837406015 (APPROVE: 6 Info); reports `docs/06-reviews/AQP-123/{standards,quality,performance,consolidated}.md`.
  - **Jira AQP-123:** developer 11286 (Dev Record summary, three questions), reviewer hand-offs 11288, 11289, 11296, briefs 11287 and 11297; GitHub #119 (STD-09 "before STORY-02.04"; R2-01 "when the file is next touched").
  - **Governance:** DL-115, DL-116 (the #119 items), DL-123 (d), DL-124 (#130 re-plant instruction), RISK-023 (escalation clause), test plan severity scale.
  - **My own checks** (read-only, from the g6-docs worktree's object store; no checkout of the story branch):
    - **QLT-01 confirmed by reading** `use-exchange-rates.ts` at 939f32f. `useFocusFirstError` runs on every new `errors` object (lines 60 to 65). `setField` always builds a new object with `Object.fromEntries` (lines 122 to 125). Clearing the first field's message therefore moves focus to the next field that has one. The reviewer's browser reproduction at 360, 768 and 1366 px was not re-run by master (it needs a database and a dev server, and the disk is nearly full).
    - **The same pattern is on `master`** in three delivered dialogs: `material-form-dialog.tsx:82-86`, `process-form-dialog.tsx:69-73` and `user-form-dialog.tsx:129`. Each has a focus effect keyed on `[errors]`, and each removal helper (`withoutMaterialError`, `withoutError`) builds a new object every time. This is not reproduced in a browser; it goes to QA (condition F).
    - **Path recomputed** from the jobs API for run 42761745140 (first job start to the end of `Stages 1 to 11`): 6:17, 6:05 and 5:40, median **6:05**.
    - **CI on 939f32f:** 5 of 5 `success`.
    - `gh api compare 939f32f...master`: one commit ahead, docs only.
    - **Not run:** Gitleaks over the diff (the command was denied in this session; CI stage 2, full history, is green on the head); lint, type-check and tests (CI green; reviewer-standards ran `eslint .` and `tsc`; reviewer-quality ran 26 integration and 1,090 unit, security and guard tests and the plants).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | `docs/06-reviews/AQP-123/`; reviews 5837425748, 5837957001, 5837406015 |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | 0 and 0 in each report |
| 3 | Major findings fixed or explicitly accepted | | ⚠️ | QLT-01 open (AC-7 keyboard-only, AC-3); confirmed by master from the code |
| 4 | Findings cite file:line | | ✅ | every finding carries a path and line |
| 5 | #130 instruction: A3 and A4 re-planted by reviewer-quality on the new integration file | | ✅ | A3 fails the create test, A4 the edit test (1 of 26 each); lock removal fails 3 of 3; DEF-020 guard removal fails at three widths |
| 6 | G12 (scan spec, gate, `tests/security/**`) | | ✅ | no weakening (reviewer-quality, read line by line); `@one-width` commit 1fb8031 tags exactly the five §10.5 tests |
| 7 | CI green on the judged head | | ✅ | 5 of 5 on 939f32f |
| 8 | Earlier master instructions for this story honoured | | ⚠️ | R2-01 (STD-02) applies, because the PR touches `audit-events.ts`, and it is not done. STD-09 (STD-03) was due "before STORY-02.04" with no owner; it is not done, and the Dev Record does not say so |
| 9 | NFR-009 first-load JS | | ✅ | `/masters/materials` +308 B, under the +1,500 B tripwire (stage 11b) |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #151, one push | **QLT-01:** focus moves to the first refused field only when a save is refused (by the screen or by a 422); typing in a field never moves focus. Add the reviewer's regression test at three widths, plus the mirror case (fix EUR first while USD is refused). A shared hook is welcome, because three delivered dialogs carry the same pattern (F). **In the same push:** STD-01 (split `useExchangeRates`, or justify it inline; it holds the QLT-01 state, so a split is preferred); STD-02 (R2-01: `Object.hasOwn` or a `Map`, plus a `'toString'` unit test); STD-06 (`readRows` throws on an unknown currency, with no value in the message); STD-07 (one sentence in the `schema.prisma` model comment only; **do not edit the migration file**, whose checksum is recorded); STD-08; STD-09; QLT-02 (see DL-129 (3)); QLT-03; QLT-10. QLT-08 is optional. Update the Dev Record for round 2 | Before the re-review |
| B | reviewer-quality | PR #151, new diff only | QLT-01 (regression test fails on the old effect: the reviewer plants it back and prints the diff), QLT-02, QLT-03, QLT-10, and the code of STD-01, STD-02 and STD-06. reviewer-standards is not re-engaged (approved, no blocking finding). reviewer-performance re-reviews only if stage 11b shows `/masters/materials` over +1,500 B against base | After A |
| C | master | gate log | G6 close on the fix head: B approves with no open Major; CI 5 of 5; the diff stays within the PR's files plus any new test file; master reads the STD-02, STD-06, STD-07, STD-08 and STD-09 changes in the diff; the first-load figure is posted. Then the orchestrator moves AQP-123 to In QA | After B |
| D | qa-engineer | `docs/07-qa/AQP-123-test-report.md` | G7 evidence on the final head: (1) a keyboard-only run at 360, 768 and 1366 px of a two-field refusal, fixing USD first and then EUR first, and of a server 422 naming both, where focus and text stay in the field typed; (2) the QLT-01 regression test shown failing with the old effect planted back, diff posted; (3) A3 and A4 re-planted on the final head (`audit-events.ts` and the repository change in the push); (4) the DEF-020 guard plant on the final head (the hook changes); (5) the QLT-02 protection shown working: a pair other than the canary saved during the Engineer scan cannot leave the scan passing; (6) the QLT-10 retry case (a failure planted after the PUT, `--retries=1`, the retry sends a PUT); (7) AC-1 to AC-7 with evidence, AC-4 read against the amended text (E); axe 0 and 44 px at three widths; (8) CI 5 of 5 and the path | G7 |
| E | product-owner | Jira AQP-123 AC-4 | Amend the text to `master.edited` with `object_type` `exchange_rate` (DL-129 (4)) | Before G7 |
| F | qa-engineer | Jira Bug(s), GitHub `bug` | Reproduce the focus jump in the Material, Process and Users dialogs on `master` (two-field refusal, then type in the first field). If it reproduces, raise a defect with severity from the test plan scale (a WCAG 2.2 AA violation on a delivered screen is Sev-2; QA states the success criterion it applies). It binds to the stories that delivered those screens, not to AQP-123; owner developer, due before G8 | Before AQP-123's G7 |
| G | solution-architect | architecture §6, §8, §10 SQL | §6 row "Exchange rates": add the registry columns for the hints (STD-12, QLT-05, PRF-06); §8: the fixed `object_id` of the single pair (STD-11, QLT-04); §10 SQL: the exception for a table keyed by a code (STD-07) | Before AQP-142's G6 |
| H | ux-expert | ux-spec (SCR-13 Exchange rates) | Rule on the two edge cases of question 3 (QLT-06 (a) "saved … in the audit log" when no entry is written; (b) the shared "Nothing was changed" after a lost response) and the state name (STD-13). If the ruling arrives before A is pushed, any wording change rides that push; otherwise the sentences stand as built and the ruling is applied to every master later | Before A where possible; otherwise before AQP-142's G6 |
| I | developer; scrum-master | GitHub #119; AQP-142 Dev Context | STD-03 (the material-repository split, which was due before 02.04 and missed) is re-routed: as its own commit with tests unchanged, before AQP-142 adds anything to `master-repository.ts`, at the latest by AQP-142's G6. STD-04 and STD-05 are added to the #119 lists (neutral names; the load-error block and the read-again effect). The scrum-master puts the split into AQP-142's Dev Context | Before AQP-142's G5 |
| J | product-manager | Jira AQP-1 | RISK-023 escalation (DL-129 (6)): whether AQP-243 merges ahead of AQP-123 when both are ready | Before either merges |

**Accepted with no tech-debt issue:** STD-10, STD-13 (with H), QLT-07, QLT-09 and PRF-01 to PRF-06 (Info). The developer's three questions are answered in DL-129 (4). No Major or Minor is deferred to a tech-debt issue: STD-03, STD-04 and STD-05 go to the existing #119, with an owner and a due point.
**Risks registered:** RISK-023 restated, score 8: its escalation clause is met (a median of three of 6:05 before AQP-243 merges). No new risk.
**Rationale:** the server side is the best-built master so far, and every audit and lock plant is caught. The one Major is a keyboard data-entry fault that can put a rate into the wrong currency. That is a correctness risk on the two divisors of every USD and EUR price, so it is fixed and re-reviewed before QA. Because the fix changes `src/`, a narrow re-review is required (DL-051, DL-091). The cheap Minors ride the same push (the AQP-38 rule). The refactors that were scheduled against other code move to #119 with owners, rather than widening this PR.
**Posted:** Jira AQP-123 comment 11299; PR #151 comment 6761458791; GitHub #119 comment 6761461742 (STD-03 owner and due point, STD-04, STD-05); RISK-023 on Jira AQP-1 comment 11300 (both G6 decisions). No new tech-debt issue (the re-routed Minors go to the existing #119).

## G6 – Peer Review (close) — AQP-243 (STORY-10.19, CI set-up cut and set-up summary, PR #152) — 2026-11-10 (attempt 1, closed at 8b587be)

- **Decision:** **G6 closed at 8b587be. Every DL-128 condition for G6 (A, B, C) is met.** AQP-243 goes to In QA now. Before QA gathers evidence, the developer pushes one small follow-up commit with QLT-10 and STD-12. That commit is limited to a named file list, has no re-review round, and is read by master at G7 (DL-130).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #152** at 8b587be: three commits on c24fe22 (a740788 fix(summary), 5f38af9 fix(setup), 8b587be ci); 9 files, +337 / -83. Eight of them are among the PR's 10 files. The ninth is the new `tests/unit/ci-run-summary-attempts.test.ts`, which holds the QLT-01 and QLT-03 tests DL-128 asked for. That is accepted as within condition A. The Round 2 Dev Record in the PR body has a row per finding with its commit and test, ten plants of the developer's, and the quality loop on 8b587be.
  - **Re-reviews:** reviewer-standards round 2 (review 5838422397, APPROVE WITH COMMENTS): STD-01 to STD-06 and STD-08 fixed; STD-07 closed (architect v0.33 §9.2, Jira 11309); STD-09 rebuttal accepted (#157); new STD-12 (Minor) and STD-13 (Info). reviewer-quality round 2 (review 5838466379, APPROVE WITH COMMENTS): QLT-01 to QLT-04 fixed and verified; P3, P5 and P5b caught; P3b survives (new QLT-10, Minor); QLT-08 and QLT-09 (Info). The reports are the round 2 sections of `docs/06-reviews/AQP-243/standards.md` and `quality.md`.
  - **Jira AQP-243:** developer 11311.
  - **My own checks** (dev-243 worktree at 8b587be, read-only; each plant applied by a Node script that stops when an anchor does not occur exactly once; the diff printed before the result; restored with `git checkout`; `git status` clean afterwards):
    - **P3** (`.next` hand-over between `verify` and `e2e`, +12 lines): **caught**. 1 failed, 161 passed: `ci-setup-cut` "uses the split cache action only for the node_modules restore and save".
    - **P5** (a second save of `~/.cache/ms-playwright` under another key, +6 lines): **caught** by the same test (1 failed, 161 passed).
    - **P3b** (a `-${{ github.run_id }}` suffix on the four node_modules key lines): **survives**, 162 of 162 passed (QLT-10 reproduced).
    - **QLT-01 probe** importing the new `cacheState`: fallback `success`, `failure` and `cancelled` all give `fallback`; miss `success`, `failure` and `cancelled` all give `miss`; a hit gives `hit`.
    - **STD-12 read:** at `ci-run-summary.ts` lines 321 to 336, `fetchAttemptStart` returns `undefined` on a non-200 or a throw. The summary then counts every job as current, with no sign in the output.
    - **CI 42776699570** on 8b587be: 5 of 5 `success`. Path 4:23, recomputed from the jobs API (first job start to the end of `Stages 1 to 11`). The run log shows `Cache restored from key: node-modules-v1-Linux-X64-ubuntu26-node22-npm11.17.0-<hash>` in all four install jobs, with the same hash as c24fe22's run 42763746916. The resolved key is unchanged.
    - `compare 8b587be...master`: one commit ahead (PR #155), docs only.
    - Not re-run: lint, type-check and the full unit suite (CI green; both reviewers ran the CI test files, 245 passed).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | round 1 reports, plus round 2 sections for standards and quality; performance not required (no install step changed beyond the key expression) |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | round 2: 0 and 0 in both re-reviews |
| 3 | Majors fixed or explicitly accepted | | ✅ | QLT-01 (probe, master and reviewer), QLT-02 (P3 and P5 caught, master and reviewer), STD-01 (reviewer's test with an unwritable path) |
| 4 | DL-128 condition A (scope, Minors, key unchanged, Dev Record) | | ✅ | the named Minors fixed; key text identical and `hit` in 4 of 4; Round 2 Dev Record complete |
| 5 | G12 | | ✅ | two `expect` lines replaced by equal or stronger ones (reviewer-quality round 2 statement); the new skip condition is declared (QLT-08) |
| 6 | New findings | | ⚠️ | QLT-10 (Minor: a key suffix passes the guards) and STD-12 (Minor: a silent fallback when the attempt start cannot be read); both go into the follow-up commit (condition A2) |
| 7 | CI green on the judged head | | ✅ | 5 of 5 on 8b587be; path 4:23 |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A2 | developer | PR #152, one commit | **QLT-10:** anchor the node_modules key line in the three places of `ci-setup-cut.test.ts` (an exact line, so a suffix fails), and show P3b caught. **STD-12:** when `GITHUB_RUN_ATTEMPT` is above 1 and the attempt start cannot be read, write one fixed line saying so (no response body, no credential), with one test. Optional in the same commit: QLT-08 (on CI the integrity suite may not skip) and QLT-09 (the wording when every shard is carried over). **Files:** `tests/unit/ci-setup-cut.test.ts`, `scripts/lib/ci-run-summary.ts`, `tests/unit/ci-run-summary-attempts.test.ts` or `ci-run-summary.test.ts`, `tests/unit/node-modules-integrity.test.ts`; a Dev Record row. Any other file comes back to master. CI 5 of 5 on the new head | Before QA gathers G7 evidence |
| D2 | qa-engineer | `docs/07-qa/AQP-243-test-report.md` | G7 evidence on the final head (DL-128 condition D, adjusted): (1) P3, P5 and P3b re-planted, each caught, diffs posted; (2) the failed-fallback probe (fallback `failure` and `cancelled` give `fallback`; miss `failure` gives `miss`); (3) an unwritable `GITHUB_STEP_SUMMARY` gives exit 0 and one `::warning::` naming only the error class; (4) removing one `Summary:` step's `timeout-minutes` is caught; (5) run 42463553178 attempt 5 through `renderSummary`: carried-over shards marked and left out (the reviewer read 4:00), plus the STD-12 line when the attempt start cannot be read; (6) final-head CI 5 of 5, the same resolved key, `hit` in all four jobs, and the path; (7) the node-modules-integrity unit tests ran on CI, not skipped (job log); (8) AC-1 to AC-7, each with evidence, citing the reviewers' recomputed AC-4 and AC-7 figures. **The live #153 and #154 controls are not repeated:** `git diff c24fe22 <final> -- .github/workflows/ci.yml` shows only the env entry, the key expression, the fallback warning text and the step timeouts (QA confirms this), and the changed integrity script runs for real in CI's unit tests | G7 |
| E | solution-architect | test strategy 10.5, architecture 9.2 | Remaining from DL-128 (E): QLT-06, PRF-04, the DL-128 (4) reading rule and the fourth-shard question. The format number is done (v0.33, 11309) | After the merge, before AQP-244's G6 |
| F | orchestrator | PR #152 merge | DL-128 (6), unchanged. The PR is BEHIND by the docs-only #155, so it is updated by a merge commit at merge time. The docs PR carrying these records merges first | After G7 GO |

**Accepted:** STD-13 and QLT-08 / QLT-09 (Info; QLT-08 and QLT-09 optional in A2). #157 (`.gitattributes`, STD-09) gets owner developer and is due before G8.
**Risks registered:** none new. RISK-023 is unchanged; the fix head's path is 4:23 on a hit.
**Rationale:** both re-reviewers approve, and my own plants and probe pass on the fix head. The two new Minors are cheap and sit in the story's own guard and new code. QLT-10 would let a key suffix silently remove the whole cut (AC-2); STD-12 is the STD-01 class (a silent error path). QA has not started, so one commit now costs a CI run and no QA rework. DL-047 sets the route: cheap Minors in one commit, read by master within a named file list, with no further review round.
**Posted:** Jira AQP-243 comment 11318; PR #152 comment 6765302066; GitHub #157 (owner and due point). No tech-debt issue created (QLT-10 and STD-12 are fixed before G7).

## G6 – Peer Review (close) — AQP-123 (STORY-02.04 Exchange Rate Master, PR #151) — 2026-11-10 (attempt 1, closed at e72e8f2)

- **Decision:** **G6 closed at e72e8f2. Every DL-129 condition for G6 (A, B, C) is met.** AQP-123 goes to In QA now (DL-131).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #151** at e72e8f2: three commits on 939f32f (7950c4c, 4f59298, e72e8f2); 16 files, +266 / -90, all among the PR's files or their tests. No migration file is changed. The PR is BEHIND `master` by docs only. The round-2 Dev Record in the PR body has a row per finding with its fix and test, the QLT-01 and DEF-020 re-plants, and CI.
  - **Re-review:** reviewer-quality round 2 (review 5840818277, Jira 11321; `docs/06-reviews/AQP-123/quality.md`, section "Round 2"): APPROVE WITH COMMENTS. QLT-01, QLT-02, QLT-03 and QLT-10 are fixed. The QLT-01 re-plant fails 9 of 9. `exchange-rates.spec.ts` passes 49 of 49, and unit, integration and security tests 1,133 of 1,133. G12: three assertions added, none weakened. New QLT-11 (Info).
  - **Routing done:** AC-4 amended (product-owner, AQP-1 11304); architecture v0.33 §5.1, §6, §8 and §10 (architect 11308, 11310); ux-spec v0.21 sentences (ux-expert 11306, 11307), applied in the build word for word (reviewer-quality's table); merge order (product-manager, AQP-1 11305).
  - **My own checks** (read-only, from the g6c-docs object store):
    - **Standards Minors, read in `git diff 939f32f e72e8f2`:**
      - STD-02: `Object.hasOwn` in `describeMasterChange`, with a test for `toString`, `constructor`, `__proto__` and `hasOwnProperty`.
      - STD-06: `readRows` throws on a currency that is neither USD nor EUR, with no value in the message.
      - STD-07: three lines in the `schema.prisma` model comment, with the migration untouched.
      - STD-08: both imports moved into their groups.
      - STD-09: `letterOfKey` deleted, and the comment letters replaced with `<its letter>`.
      - STD-01: every function in `use-exchange-rates.ts` at e72e8f2 is 40 lines or fewer (longest `useSaveRates`, 39).
      - All six verified.
    - **CI 42780235188** on e72e8f2: 5 of 5 `success`. Path **6:10**, recomputed (370 s, first job start to the end of `Stages 1 to 11`). The first-load JS of `/masters/materials` is 187,115 B, +384 B against base, under the +1,500 B tripwire (Dev Record, stage 11b).
    - **Not re-run by master:** the browser tests and the plants (reviewer-quality ran them on a throwaway database, with diffs printed); Gitleaks (CI stage 2, full history, green).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | round 1 reports, plus reviewer-quality round 2; standards and performance not re-engaged by DL-129 (7) |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | round 2: 0 Blocker, Critical, Major or Minor open |
| 3 | Major fixed | | ✅ | QLT-01: three E2E tests at three widths fail 9 of 9 under the re-plant and pass on the code |
| 4 | Minors of DL-129 (2) fixed | | ✅ | QLT-02, QLT-03 and QLT-10 (reviewer); STD-01, 02, 06, 07, 08 and 09 (master, from the diff) |
| 5 | G12 | | ✅ | `canary-scan.spec.ts` gains three post-scan checks; nothing removed or weakened |
| 6 | CI green; first-load within the tripwire | | ✅ | 5 of 5; +384 B |
| 7 | New finding | | ⚠️ | QLT-11 (Info): no E2E test drives a save that changes a stored rate; covered at G7 by QA's own run (D3, item 7) |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| D3 | qa-engineer | `docs/07-qa/AQP-123-test-report.md` | G7 evidence on the final head (DL-129 D, adjusted): (1) a keyboard-only run at 360, 768 and 1366 px: a two-field refusal, fixing USD first, then EUR first, and a server 422 naming both, where focus and text stay in the field typed; (2) the QLT-01 tests failing with the old focus behaviour planted back, diff posted; (3) A3 and A4 re-planted on the final head; (4) the DEF-020 guard plant on the final head; (5) the QLT-02 post-scan check shown failing when the stored pair is not the canary pair (a planted write or a planted expected value, diff posted); (6) the QLT-10 retry case: a second pass of the saving tests on the same database; (7) **QLT-11:** in QA's own run (not CI, with no Engineer scan running), a keyboard-only save of a pair other than the canary pair. It must store both values with one stamp and write one `master.edited` entry with `object_type` `exchange_rate` and the fixed `object_id`. QA then restores the canary pair; (8) the five sentences match ux-spec v0.21; (9) AC-1 to AC-7 at three widths, axe 0, 44 px, with AC-4 read against the amended text; (10) CI 5 of 5 and the path | G7 |
| F | qa-engineer | Jira Bug(s), GitHub `bug` | Unchanged from DL-129 (8): reproduce the `[errors]`-keyed focus jump in the **Material, Process and Users** dialogs on `master` and grade it on the test plan scale. It does not bind this PR (the Dev Record names only two dialogs; all three are in scope) | Before AQP-123's G7 |
| K | developer | GitHub `follow-up` issue | The ux-expert's shared rule (ux-spec v0.21 §6.0: a failed write never says "Nothing was changed"), applied to SCR-11, the SCR-13 Materials tab and SCR-14 with one shared constant per module and tests (AQP-1 11307). It may be one fix with any defects F raises on the same dialogs | Before G8 |
| M | orchestrator | PR #151 merge | Merge per DL-131 (4) | After G7 GO |

**Accepted:** QLT-07, QLT-08 and QLT-11 (Info; QLT-11 is covered by D3 item 7). STD-03, STD-04 and STD-05 stay on #119, as DL-129 (5) routed them.
**Risks:** none new. RISK-023 is not restated in the register. This head's single attempt is 6:10 (6:05 median of three at 939f32f); reviewer-performance's identical-code mean is 5:28, plus about 12 s for the story. The escalation was answered by the product-manager (11305). A path of 5:30 or more on the updated head is reported, not held.
**Rationale:** the Major is fixed and proven by a re-plant. Every Minor routed into the push is fixed, the quality ones checked by the reviewer and the standards ones by master from the diff, as DL-129 (7) set. The one new item is a coverage gap the integration tests already close for the write path, and QA's own run closes it for the screen.
**Posted:** Jira AQP-123 comment 11323; PR #151 comment 6765772392. No tech-debt issue created (QLT-11 is covered at G7; STD-03 to STD-05 stay on #119).

## G7 – QA Acceptance — AQP-243 (STORY-10.19, CI set-up cut and set-up summary, PR #152) — 2026-11-10 (attempt 1)

- **Decision:** **GO.** QA's report and DEF-023 (Sev-3, Test, pre-existing) were judged at 350c9d0; the code is at 6bdbb77. AQP-243 moves to Done. The PR merges under the conditions of DL-132 (4).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-243-test-report.md` and `docs/07-qa/defects/DEF-023-g7-7-keyboard-768-test-flaky-in-shard-3.md`, committed as 350c9d0 (2 files, docs only, on top of 6bdbb77). QA hand-off Jira AQP-243 11330. Recommendation ACCEPT, with the AC-6 reading left to master.
  - **DEF-023:** Jira AQP-268, GitHub #159. Sev-3, Test, pre-existing.
  - **GitHub #137** (owner qa-engineer; trims the G7-7 768 px tests that DEF-023 names).
  - **My own checks:**
    - **`git diff 8b587be 6bdbb77`**, the follow-up commit DL-130 (2) said master would read at G7. It has 4 files, all in the named list (`ci-run-summary.ts`, `ci-run-summary-attempts.test.ts`, `ci-setup-cut.test.ts`, `node-modules-integrity.test.ts`), +41 / -6.
      - **QLT-10:** `KEY_LINE` anchors the whole `key:` line in the three places.
      - **STD-12:** `ATTEMPT_START_UNKNOWN` is added only when the start is unknown and the attempt is above 1, with two tests (one checks that no status code or credential leaks).
      - **QLT-08:** on CI the integrity suite can no longer be skipped.
      - One assertion was narrowed: `not.toContain('earlier attempt')` became `not.toContain('(earlier attempt)')`. The new STD-12 line itself contains those words, and the same test now also asserts that the line is present. Accepted.
    - **CI 42815039602** on 350c9d0: 5 of 5 `success`. Path 4:09, recomputed (249 s).
    - **Shard 3 logs:** `1 flaky` on base run 42757450173 and on 42815039602, as DEF-023 states.
    - **Not re-run by master:** QA's plants and probes. QA ran them on 6bdbb77 with diffs printed, and the code is the same at 350c9d0. My own P3, P5 and P3b runs at 8b587be are in the G6 close.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | AC-1 to AC-7 in the matrix, each with run IDs or tests; AC-6 is reported as Partial, and is read against its purpose in DL-132 (1); AC-8 is the architect's, after the merge |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | open: Sev-3 DEF-023 only, pre-existing at base 051c0b5 |
| 3 | Regression suite result recorded and green | ✱ | ✅ | CI 42815039602, 5 of 5; QA's run on 6bdbb77 (42802757357): stages 6 and 11 green, 623 E2E passed |
| 4 | Exploratory testing notes present | | ✅ | charter "break the claim that the cache can only cost time"; OBS-1 (Sev-4 wording, the same as QLT-09) |
| 5 | Accessibility checks for UI stories | | n/a | no screen |
| 6 | DL-130 evidence (D2) | | ✅ | P3, P5 and P3b caught, plus a QA variant in the shell key line; the failed or cancelled fallback reads `fallback`; an unwritable path gives exit 0 and a name-only warning; each removed step timeout is caught; run 42463553178 attempt 5 reads 4:00, with the STD-12 line when the start is unknown; same key and `hit` 4 of 4; the integrity tests ran (11) in stages 6 and 11 |
| 7 | Follow-up commit within the named files | | ✅ | read by master (above) |
| 8 | Records match the CI run | | ⚠️ | the PR body's "0 flaky in five full runs" is contradicted by the shard 3 logs; corrected before the squash (condition b) |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | qa-engineer | `tests/e2e/aqp-234-qa.spec.ts` (DEF-023 with #137) | Remove the flake: #137's deletion of the 768 px G7-7 tests, deletions only, in its own test-only PR. Or, if the test is kept, it creates its own rows. No retry increase and no wider limit (DL-057). Verified by no `flaky` line in shard 3 over five full runs. Master checks the diff and CI per #137's rule | Before AQP-244's head measurement runs, at the latest before AQP-244's G6 |
| b | developer | PR #152 body | Replace the "0 flaky" sentence with what the logs show: one flaky test in shard 3 in every run, the same as on the base (DEF-023). Editing the description does not change the head | Before the squash |
| c | orchestrator | PR #152 merge | DL-132 (4) | After this GO |
| d | orchestrator; master | RISK-023 | The fall-back reading after the merge, DL-132 (5) | After the squash |

**Not verified, accepted:** the text of the host line on a job's summary page. The API does not expose that page. The step succeeded in 4 of 4 jobs, and its command is pinned by the guard tests.
**Risks registered:** none new. RISK-023 is unchanged until the reading in DL-132 (5).
**Rationale:** every AC that this story can affect is verified with independent evidence, and every DL-130 item is evidenced on the final code. AC-6's "0 flaky" exists to show that the story adds no flake. The same test flakes 3 of 3 on the base, the story touches no E2E file, and the defect is a cross-test dependency in QA's own spec. So AC-6 is met in substance. A pre-existing Sev-3 Test defect that fails closed (a second failure would turn the run red) and is green in CI gives GO with an owner and a due point, as at DL-120.
**Posted:** Jira AQP-243 comment 11332; PR #152 comment 6767387622. No tech-debt issue created (DEF-023 has its own Bug and issue, #159, with an owner and a due point).

## G6 + G7 (narrow route) — DEF-023 fix, PR #160 (AQP-268, #159; `tests/e2e/aqp-234-qa.spec.ts`) — 2026-11-10 (attempt 1)

- **Decision:** **GO to merge, after two more full re-runs show no flake (DL-133).** This is the DL-124 narrow route for a test-only fix: one file under `tests/e2e/`, nothing under `src/`, no config, dependency or CI change. Master decides G6 and G7 together, with no review round. DEF-023 closes when the PR merges.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #160** at 8dca9df (`fix/AQP-268-flaky-g7-7`): one commit, one file, +10 / -2, CLEAN. The PR body has the root cause, the G12-style assertion table and the CI evidence.
  - **QA hand-off:** Jira AQP-268 11340.
  - **My own checks:**
    - **Diff** (`pull_request_read get_diff`): two constants (`TAB_PRESSES = 12`; `ACTIONS_PER_ROW`, with SCR-13 at 1 and SCR-11 at 2). A new `total` (visible row actions in the table) must be at least two rows' worth. The loop uses `TAB_PRESSES`. The final bound changes from `seen.length >= 4` to `seen.length >= min(total, 12)`.
    - **Is it weaker? Not in what it guards.** On SCR-11, two rows already give 4 actions, so the bound is at least 4 and grows to 12 on a full table, which is stronger. On SCR-13, the old bound of 4 could only be met with rows from other tests (one action per row, two own rows). That cross-test dependency was the defect. The new bound requires every visible action, up to 12. The per-button checks (not covered, focus visible, no sideways scroll, in view, `seen[0]` an Edit, Enter and Escape) are unchanged.
    - **CI run 42825009199** on 8dca9df: attempts 1 to 3 (attempt 1 plus two "Re-run all jobs") are each 5 of 5 `success`. The latest attempt's logs read shard 3 `234 passed`, shard 2 `194 passed` and shard 1 `196 passed`, with no `flaky` or `failed` line. Before the fix, shard 3 read `233 passed` and `1 flaky`.
    - **Not done:** a planted fault against the new bound. The file is outside G12 scope, and the logic above was read line by line. My fetch of the branch into the records worktree was denied by the permission layer; the diff was read through the GitHub API.

**Checklist (narrow route)**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Scope: test-only, named file | ✱ | ✅ | 1 file, `tests/e2e/aqp-234-qa.spec.ts` |
| 2 | Root cause named and fixed, not masked | ✱ | ✅ | a fixed count that needed rows from other tests; the test now uses its own rows. No retry, timeout, skip or one-width change (DL-057) |
| 3 | No assertion weakened in what it guards | ✱ | ✅ | analysis above; the PR body declares the change |
| 4 | Verification as DL-132 and #137 state it: no `flaky` line in shard 3 over **five** full runs | | ⚠️ | 3 of 5 done, each clean, with the test passing first time in the slot that failed 9 of 9. Two more full re-runs are required before the merge (condition a) |
| 5 | CI green | | ✅ | 5 of 5 in 3 of 3 attempts |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | orchestrator | run 42825009199 | Two more "Re-run all jobs" (attempts 4 and 5). Each must be 5 of 5 green, with no `flaky` or `failed` line in any shard. Post both on PR #160. A flake or failure comes back to master | Before the merge |
| b | orchestrator | PR #160 merge | Squash after (a). If the records docs PR merges first, update #160 by a merge commit only, with its file unchanged, and require 5 of 5 green on the updated head. Either order is allowed | After (a) |
| c | qa-engineer | DEF-023 (AQP-268, #159) | Fill in the Fix & Verification rows (8dca9df, run 42825009199 attempts 1 to 5), move AQP-268 to Done and close #159 as completed with the merge commit | On the merge |
| d | qa-engineer | GitHub #137 | Stays open, for CI time only. Its due point goes back to "before the sprint 1 review, at the latest G8". The DL-132 pull-forward is withdrawn, because the flake it was meant to remove is fixed here for every G7-7 width | Before the sprint 1 review |

**Risks:** RISK-023 lowered to 6 (DL-134); the retry this fix removes is named there.
**Rationale:** the root cause was a cross-test dependency, and it is fixed at the source, for every width the loop runs. Three clean runs in the exact slot that failed 9 of 9 are strong evidence. Five is the bar my own DL-132 and #137 wording set, and two more re-runs cost no head change, so the bar is kept rather than waived.

## RISK-023 re-score after AQP-243's merge — 2026-11-10

- **Decision:** **RISK-023 lowered, P 4 → 3, score 8 → 6 🟢, by the register's rule (DL-134).**
- **Evidence:**
  - Merge record: PR #152 comment 6767785599 (updated head 4b5ba82, run 42818504016 green, path 4:30) and comment 6768315003; AQP-1 11335.
  - Master read the push run 42819300261 on ce9c02c:
    - Attempt 1: 5:45. The `node_modules` cache missed in 4 of 4 jobs (`Cache not found for input keys`) and was saved once. Replaced under DL-128 (4).
    - Attempts 2 to 4: hit in 4 of 4 jobs each (`Cache restored from key`), at 5:05, 4:03 and 5:09. **The median is 5:05, at most 5:30.**
  - Context, not used for the rule: Jira AQP-244 11338 reads a post-merge hit-run median of 4:32 over 8 runs, with an sd of 26 s.
- **Reading rule:** the architect's median of five (test strategy v0.30 §10.5 item 9; AQP-244 11342) applies from its merge. This reading was taken under the median-of-three rule then in force, and it holds under the new one: with 4:03, 5:05 and 5:09 already in, no two further runs can lift a median of five above 5:09. So no further runs are asked for.
- **Next thresholds:** the register now states them (falls to 3 on AQP-244's AC-3 or a nightly median at most 5:00; back to 8 on a `master` reading, or a nightly median, over 5:30).
**Posted:** Jira AQP-268 comment 11345; PR #160 comment 6769247675; RISK-023 on Jira AQP-1 comment 11346. No tech-debt issue created.

## G7 – QA Acceptance — AQP-123 (STORY-02.04 Exchange Rate Master, PR #151) — 2026-11-10 (attempt 1)

- **Decision:** **GO.** QA records are at b14f5c1, and the code is at e72e8f2, unchanged since the G6 close. AQP-123 moves to Done, and PR #151 merges under DL-135 (4). The three dialog defects that condition F found (DEF-024 to DEF-026) bind the stories that delivered those screens, not this one. They are scheduled in DL-135 (2).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-123-test-report.md`, and the evidence folder `docs/07-qa/AQP-123-evidence/` (46 text files: plant diffs and outputs, probe sources stored as `.txt`, run outputs).
  - **Defects:** DEF-024, DEF-025 and DEF-026 (Jira AQP-269 to AQP-271, GitHub #161 to #163).
  - **Other QA files:** `tests/acceptance/aqp-123-exchange-rates.test.ts` (60 Vitest tests) and the test plan change log 0.2.3.
  - **QA hand-off:** Jira AQP-123 11349; PR #151 comment 6771445125.
  - **My own checks:**
    - **Scope** (`compare e72e8f2...b14f5c1`): 3 commits and 52 files, all added under `docs/07-qa/` or `tests/acceptance/`, plus one line in `test-plan.md`. Nothing under `src/`, `prisma/`, `.github/`, `package*.json` or `playwright.config.ts`.
    - **Gitleaks** v8.30.1 over `git diff e72e8f2 b14f5c1` (about 281 KB): no leaks.
    - **Local and personal data:** a grep of the added lines for local paths, connection strings and e-mail addresses finds only invented test values (`x`, `y`, E2E user names).
    - **CI 42843822420** on b14f5c1: 5 of 5 `success`, path **4:39**, recomputed (279 s). Shards: 210, 207 and 248 passed, with no `flaky` or `failed` line. The acceptance file ran in CI (`aqp-123-exchange-rates.test.ts (60 tests)`).
    - **Not re-run by master:** QA's browser probes and plants. Their diffs and outputs are committed in the evidence folder.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | AC-1 to AC-7 pass at 360, 768 and 1366 px; AC-4 is read on the amended text; 60 acceptance tests in CI and browser probes with outputs |
| 2 | No open Sev-1 or Sev-2 defect against the story | ✱ | ✅ | none against AQP-123; DEF-024 to DEF-026 bind AQP-122, AQP-113 and AQP-65 |
| 3 | Regression recorded and green | ✱ | ✅ | CI 5 of 5 on b14f5c1. QA's local load failures (six timeouts that pass alone; one count that included uncommitted probes; a grown local database) are read under DL-057, where CI is the reference run |
| 4 | Exploratory notes present | | ✅ | condition F and the E-probes |
| 5 | Accessibility checks for UI stories | | ✅ | axe (`wcag2a` to `wcag22aa`) 0 at three widths in four states; 44 px; keyboard only; `inputmode="decimal"` |
| 6 | DL-131 D3 items 1 to 10 | | ✅ | all ten, including QLT-11 (QA's own keyboard save of another pair: one stamp, one entry with the fixed `object_id`, then the canary pair restored) |
| 7 | Planted faults | | ✅ | 11 plants caught (A3, A4, Q1 to Q5, QLT-01 9 of 9, DEF-020 3 of 3, QLT-02 in two ways), each diff committed |
| 8 | Condition F graded on the test plan scale | | ⚠️ | DEF-024 and DEF-025 are Sev-2, as QA graded them. **DEF-026 is raised to Sev-2** (DL-135 (2)) |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | qa-engineer | DEF-026 (AQP-271, #163) | Restate it as Sev-2: Jira priority High, GitHub label `sev-2`, and the severity row in the defect file | With the next QA commit or Jira update; it does not hold the merge |
| b | developer | DEF-024, DEF-025, DEF-026 | One fix for the three dialogs: focus moves only when a submit is refused, never on typing, as AQP-123's `useFocusOnRefusal` does, preferably as one shared hook. One browser regression test per dialog at three widths, from QA's `F-a` and `F-b` probes, shown failing with the old effect planted back. It may carry DL-131 K (the shared failed-write sentence on the same screens) | **Before AQP-130 starts G5, and at the latest before G8** |
| c | scrum-master | AQP-130 Dev Context | Name the rule: no focus effect keyed on an errors object, and the shared hook from (b) once it exists. Reviewers at AQP-130's G6 check it | Before AQP-130 is delegated |
| d | orchestrator | PR #151 merge | DL-135 (4) | After this GO |
| e | orchestrator | RISK-023 reading after the merge | DL-135 (5) | After the squash |

**Accepted:** the evidence folder goes into the squash, as `AQP-234-evidence` did. It is text only, about 197 KB, with no secret or personal data, and it holds the only copy of the plant diffs and probe sources. Keeping the probes as `.txt`, out of CI, is accepted for RISK-023. Folder naming drift: the test plan's evidence section names `docs/07-qa/evidence/<story-id>/`, but the last two stories used `docs/07-qa/<KEY>-evidence/`. QA aligns the test plan wording at its next change. This is not a condition.
**Risks:** none new. RISK-023 stays at 6.
**Rationale:** every AC is verified with independent evidence on the exact code that passed G6. Every DL-131 item is done, including the screen side of a changing save that CI cannot cover. The defects found are on other stories' screens, are already graded, and are now scheduled before the next story that would copy the pattern.
**Posted:** Jira AQP-123 comment 11351; PR #151 comment 6771797276. No tech-debt issue created (DEF-024 to DEF-026 have their own Bugs and issues, with an owner and a due point).

## G6 – Peer Review — AQP-269 / AQP-270 / AQP-271 (DEF-024, DEF-025, DEF-026: dialog focus jump while typing, PR #167) — 2026-11-10 (attempt 1)

- **Decision:** **CONDITIONAL GO.** Zero Blocker, Critical and Major across three reviews. QLT-01 to QLT-03 are fixed in this PR by one test-only push, which master reads with no review round. The standards Minors STD-01, STD-02 and STD-04 are deferred to tech-debt #171. G7 takes a QA verification route with control PRs in CI (DL-136).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #167** at 69805d1: 7 files, CLEAN. The new shared hook `src/components/shared/use-focus-on-refusal.ts` (30 lines), the three dialogs, and one keyboard E2E test per dialog.
  - **Reviews:** `docs/06-reviews/AQP-269/{standards,quality,performance,consolidated}.md`. Standards: APPROVE WITH COMMENTS, 3 Minor. Quality: APPROVE WITH COMMENTS, review 5845771350, 3 Minor. Performance: APPROVE, 1 Info.
  - **Jira:** developer AQP-269 11358; quality 11362.
  - **Control PRs:** #168, #169 and #170.
  - **Context:** AQP-244's runs finished at 16:39 UTC, so the merge hold is lifted.
  - **My own checks** (GitHub API and CI logs only; nothing run locally because of machine memory):
    - **Diff, read in full:** every refusal path in the three dialogs (local submit, server refusal, Second Admin) now calls `showErrors`, and the only remaining `setErrors` calls clear one field while typing. The hook asks for focus with a new object per refusal and uses `useEffectEvent` correctly. The DEF-020 guard and Exchange rates are untouched.
    - **CI 42852617579** on 69805d1: success, path 5:05, recomputed (305 s).
    - **Plant run 42852695987** (`plant/AQP-269-old-focus`, the old effect restored): fails the DEF-024, DEF-025 and DEF-026 tests at mobile and tablet in the shard logs read (and desktop per the developer: 9 in all).
    - **Control 42856414166** (server-refusal focus dropped): fails only Material tests (`materials.spec.ts:231` and `aqp-122-qa.spec.ts:199`). This confirms QLT-03.
    - **Control 42856570620** (focus request kept as a field name): success. This confirms QLT-02.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | standards, quality, performance |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | 0 and 0 in each |
| 3 | Majors fixed or accepted | | ✅ | none raised |
| 4 | Findings cite file:line | | ✅ | all |
| 5 | DL-135 (b): regression tests from QA's F-a **and** F-b probes, one per dialog at 3 widths, failing with the old effect | | ⚠️ | F-a is covered in all three dialogs. F-b (type into a later refused field while an earlier one is still refused) is covered only in Process. The plant shows failures, but stops at the first focus check (QLT-01) |
| 6 | Mutation coverage of the new hook and its call sites | | ⚠️ | QLT-02 and QLT-03 plants survive (controls #169 and #170) |
| 7 | CI green; first-load JS | | ✅ | 5 of 5; 0, -2 and +3 B |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #167, one test-only push (`materials.spec.ts`, `users.spec.ts`, `process-master.spec.ts`) | **QLT-01:** the F-b step in the Material and Users tests: Tab to the second refused field while the first is still refused, type, and assert that focus and value stay and that the first is still empty (reviewer's snippet). **QLT-02:** in one dialog's existing empty-refusal test, submit again without typing and assert focus is back on the first field. **QLT-03:** `toBeFocused` on the named field in the existing server-refusal tests: Process duplicate name (`process-master.spec.ts:185`, Rate name), Users e-mail in use (`users.spec.ts:168`, E-mail) and Second Admin (`users.spec.ts:181`, Role). No file under `src/` changes. Add a Dev Record row and the CI run on the new head | Before G7 |
| B | master | PR #167 diff | Read the push: test files only, assertions as specified. No review round (DL-047). Any `src/` change brings a narrow reviewer-quality re-review instead | With G7 |
| C | qa-engineer | `docs/07-qa/AQP-269-test-report.md`; defect files | G7 verification, using CI because of machine memory. **Three throwaway control PRs, each planted alone and closed unmerged:** (i) the old `[errors]` effect restored in the three dialogs must fail both the F-a and F-b assertions in all three dialogs at three widths; (ii) the hook's request stored as a field name must fail the QLT-02 assertion; (iii) `setErrors` at the server-refusal sites must fail the Process and both Users focus assertions. Each diff and failing test list is posted. Then the final-head CI is 5 of 5. QA reads QA's own F-a and F-b probes (`docs/07-qa/AQP-123-evidence/aqp-123-focus-jump.spec.ts.txt`) against the committed tests, and fills in each defect's Fix & Verification rows. It also corrects **DEF-026's file to Sev-2** (DL-135 (a), still open). Optional: one Edit-mode keyboard check (QLT-05) | G7 |
| D | developer | #171 | STD-01, STD-02, STD-04 | Next change to those files, or G8 |
| E | orchestrator | merge | DL-136 (5) | After G7 GO |

**Accepted (Info):** STD-03, STD-05, QLT-04 (`showErrors` is not stable; it is only called from handlers), QLT-05, QLT-06, and PRF-01 (about 2.5 s on the path).
**Risks:** none new. RISK-023 stays at 6; this PR adds about 2.5 s.
**Rationale:** the fix is correct and shared, as DL-135 asked. The gaps are in its proof. The F-b sequence is the one DL-135 named, and two plants pass the whole suite. Each gap is closed by a few test lines the reviewer has already written, so a test-only push read by master is proportionate. The standards Minors would widen a test-only push into production code across another story's screen, so they go to #171 with an owner and a due point.
**Posted:** Jira AQP-269 comment 11366; PR #167 comment 6773602588; tech-debt GitHub #171 created (STD-01, STD-02, STD-04).

## G6 – Peer Review — AQP-244 (STORY-10.20, CI path variance, PR #166) — 2026-11-10 (attempt 1)

- **Decision:** **CONDITIONAL GO.** There is no Blocker or Critical. QLT-01 (Major) is upheld and fixed in one push, together with the named Minors. reviewer-quality and reviewer-standards re-review the new diff only. Master closes G6 on the fix head before In QA. The cut is kept, and PRF-01 goes to the architect. RISK-023 is read at G7 (DL-137).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #166** at 953b8ca: 4 files. `OWN_WIDTH_FILES` (`aqp-234-qa.spec.ts`, `masters-table-actions.spec.ts`) goes into `testIgnore` of `mobile` and `tablet` in `playwright.config.ts`, with the new `tests/support/own-width-files.ts` and `tests/unit/own-width-files.test.ts`. One assertion in `tests/unit/one-width-tag.test.ts` is relaxed for the two files and declared under G12.
  - **Reports:** `docs/06-reviews/AQP-244/{standards,quality,performance,consolidated}.md`.
    - standards: APPROVE WITH COMMENTS, 8 Minor and 1 Info (Jira 11372);
    - quality: REQUEST CHANGES (review 5846162115, Jira 11373), 1 Major, 1 Minor and 3 Info; plants P1, P2, P3 and P5 caught (control PRs #175, #176, #177, #179), P4 survives (#178);
    - performance: APPROVE WITH COMMENTS (Jira 11374), with every figure recomputed from the API and 30 shard logs.
  - **Rulings:** architect 11342 (the cut) and 11367 (the measured reading governs AC-3 (c)); test strategy v0.31 §10.5 item 9; AC-3 (c) replaced by the product-owner (AQP-1 11370) and aligned by the scrum-master (11371).
  - **Developer:** AQP-244 11364.
  - **My own checks:** nothing was run locally (machine memory). I read the findings tables of all three reports against the consolidated record. The figures and plants are taken from the reviewers' recomputation and the control PRs, and were not re-run by master.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | standards, quality, performance |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | 0 and 0 in each |
| 3 | Majors fixed or accepted | | ⚠️ | QLT-01 open. The skip in `masters-table-actions.spec.ts` sits inside two describe blocks, so a test added outside them runs in desktop only with every guard green (P4, #178) |
| 4 | G12: the relaxed assertion is declared and still guarding | | ⚠️ | Declared. But STD-06: adding a file to `OWN_WIDTH_FILES` in the config widens the relaxation with no test edit, so "needs a ruling" is a convention only |
| 5 | Each test runs once | | ✅ | 665 passed at base and head; skipped 131 → 23 |
| 6 | Measured ACs | | ✅ | AC-3 base 4:41 / 5:17 against head 4:37 / 4:52 (five runs each, 40 of 40 hits, 0 flaky, billed 0.95x); AC-3 (c) 16 s against 35 s by ruling 11367 |
| 7 | Time effect of the cut | | ⚠️ | PRF-01: -4 s against a standard error of about 15 s. Not measurable; routed to the architect (DL-137 (3)) |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #166, one push | **QLT-01:** a file-level `test.beforeEach` skip in `masters-table-actions.spec.ts`, plus a guard that accepts a listed file only when its skip is file-level (P4 must fail). **STD-06:** pin the two ruled file names in a test, as `RULED_FILES` is pinned, so that a new entry is a visible test edit under G12. **In the same push:** QLT-02 (assert, or rename to what the test checks); STD-01 (`ReadonlyArray`); STD-02 (the durable reason in the config comment); STD-03 (module name and doc comment); STD-04 (108, not 114, and say which guards exist); STD-05 (accept both quote styles); STD-07 (title); STD-08 (one config reader). **The runtime test set must not change:** the fix head's CI must show the same passed and skipped counts per shard as 953b8ca; if not, it comes back to master. Update the Dev Record | Before the re-review |
| B | reviewer-quality; reviewer-standards | PR #166, new diff only | reviewer-quality: QLT-01 and QLT-02, and P4 re-planted by a control PR (closed unmerged) that must fail. reviewer-standards: STD-01 to STD-08. reviewer-performance is not required while the counts per shard are unchanged | After A |
| C | master | gate log | G6 close on the fix head: both re-reviews with no open Major; CI 5 of 5 with unchanged counts per shard; the diff limited to the PR's files plus any new test file. Then In QA | After B |
| D | qa-engineer | `docs/07-qa/AQP-244-test-report.md` | G7 through the API and CI (no local runs): AC-1 to AC-6, each with evidence; AC-3 recomputed from base run 42850365032 and head run 42852486467 (medians, slowest, hit 40 of 40, 0 flaky); counts per shard on the final head; P4 and one other plant (P1 or P5) re-planted by QA's own control PRs; the G12 relaxation read against the pinned list | G7 |
| E | solution-architect | test strategy §10.5 item 9 | PRF-01: say whether the 35 s balance line (AC-3 (c)) stays as a reading line, given that it sits below the noise of its own statistic (29 s on means, 46 s host-free, 68 s modelled), and state what a future balance reading uses. This does not hold AQP-244 | Before the next CI-time decision (fourth shard or nightly review), at the latest before the sprint 1 review |
| F | orchestrator | merge | DL-137 (5) | After G7 GO |

**Accepted (Info):** STD-09 (covered by QLT-01), QLT-03 (fails safe for coverage), QLT-04, QLT-05, and the performance Infos.
**Risks:** RISK-023 is not re-scored now. The fall rule's target is corrected to 4 (P 2 × I 2), and it is read at G7 (DL-137 (4)).
**Rationale:** the change is small and measured, and four of five plants are caught. The Major is a coverage hole that the change itself creates, in the file most likely to get new masters-table tests, so it is fixed before QA. The Minors are in the same four files, so they ride the same push (the AQP-38 rule).
**Posted:** Jira AQP-244 comment 11376; PR #166 comment 6774316410. No tech-debt issue created (every Minor is in the push; PRF-01 goes to the architect with a due point).

## G6 – Peer Review (close) — AQP-269 / AQP-270 / AQP-271 (DEF-024 to DEF-026, PR #167) — 2026-11-10 (attempt 1, closed at cde1b29)

- **Decision:** **G6 closed at cde1b29. DL-136 conditions A and B are met.** The stories go to In QA. G7 follows DL-136 (4), unchanged. A newly seen flake is logged as DEF-027 and must be fixed before #167 is squashed (DL-138).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #167** at cde1b29: two commits on 69805d1 (db1319a, cde1b29). Developer hand-off: Jira AQP-269 11377.
  - **Controls:** the developer's control PRs #180, #181 and #182 (closed unmerged).
  - **My own checks:**
    - **The push** (`compare 69805d1...cde1b29`, GitHub API): 3 files, all spec files (`materials.spec.ts` +18 / -5, `process-master.spec.ts` +3, `users.spec.ts` +17 / -2), with no `src/` change.
      - **QLT-01:** the F-b step is added to the Material and Users tests. It Tabs to the later refused field while the first is still refused, types, asserts focus and value, and asserts the first is still empty, then Shift+Tab.
      - **QLT-02:** a second click of Add on the empty-refusal test, then `toBeFocused` on Material in Drawing.
      - **QLT-03:** `toBeFocused` on Rate name (both server refusals), on E-mail (e-mail in use) and on the Role combobox (Second Admin).
      - Two value assertions were replaced, not dropped, because the new F-b step puts text in those fields first.
      - Every point matches DL-136 (2).
    - **CI 42862491463** on cde1b29: 5 of 5 `success`. The shard 2 log shows `1 flaky`: `aqp-122-qa.spec.ts:439` on tablet failed its first attempt at line 443 (`expect(body.options.length).toBeGreaterThan(0)`, received 0) and passed on retry #1.
    - **Developer's plants:** control runs 42863792922 (C, the old effect) and 42863743797 (B, server sites) show the same flaky line. Run 42863675866 (A) shows none in the log read.
    - **The flake is new on #167's heads.** It is absent from 42852617579 (69805d1), from AQP-244's five-run head and base runs (42852486467, 42850365032), and from `master` 322cd8e.

**Checklist (close)**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Zero open Blocker or Critical findings | ✱ | ✅ | none |
| 2 | DL-136 (2): the test-only push as specified | | ✅ | read by master, above |
| 3 | No `src/` change; no review round needed | | ✅ | 3 spec files |
| 4 | CI green on the judged head | | ✅ | 5 of 5 (one retry, DEF-027) |
| 5 | Plants shown failing named tests | | ✅ | the developer's #180 to #182: C fails the DEF-024 and DEF-026 sequence tests at 3 widths; A fails `materials.spec:166` at 3 widths and `process-master:163` at desktop; B fails the Material, Process and Users server-refusal tests. QA reproduces them at G7 (DL-136 (4)) |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| G | qa-engineer | DEF-027 (Jira Bug and GitHub `bug`) | Log it: `aqp-122-qa.spec.ts:439` "[AQP-122 AC-4] the browser fetch of /api/v1/options/materials …" asserts `options.length > 0`. That needs materials made by other tests, so it fails when the test runs first in a shard on an empty database. #167's added tests moved it there. Sev-3, type Test, latent since AQP-122's QA spec. Fix it with its own row, as DEF-023 did: the test creates the material it reads. No retry or timeout change. While there, check QA's specs for other assertions that need rows they did not create, and list any found in the defect | **Before PR #167 is squashed** |
| H | qa-engineer | `docs/07-qa/AQP-269-test-report.md` | G7 as DL-136 (4): QA's own three control PRs (old effect; request as a field name; `setErrors` at the server sites), each failing named tests at the stated widths; the F-a and F-b probes read against the committed tests; the Fix & Verification rows of DEF-024 to DEF-026; DEF-026's file corrected to Sev-2; CI on the final head with no `flaky` line once DEF-027 is fixed | G7 |

**Risks:** none new. While #167 is unmerged, DEF-027 affects no RISK-023 or AQP-244 reading: AQP-244's five-run head and base runs show no flaky line, and `master` does not yet carry #167's tests.
**Rationale:** the push is exactly what DL-136 asked, and the plants show each new assertion bites. The flake is a latent cross-test dependency of the same kind as DEF-023, and this PR is what exposes it on `master`. So it is fixed before #167 is squashed, and every later run, including AQP-244's merge-commit run, stays clean.
**Posted:** Jira AQP-269 comment 11381; PR #167 comment 6774479569. DEF-027 is to be logged by qa-engineer (Jira Bug and GitHub `bug`).

## G7 – QA Acceptance — AQP-269 / AQP-270 / AQP-271 (DEF-024, DEF-025, DEF-026, PR #167) — 2026-11-10 (attempt 1)

- **Decision:** **GO.** QA records are at 552b497; the code is cde1b29, unchanged since the G6 close. AQP-269, AQP-270 and AQP-271 move to Done, and #161 to #163 close. PR #167 merges under DL-139 (3), after the DEF-027 fix.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA files:** `docs/07-qa/AQP-269-test-report.md`; `docs/07-qa/AQP-269-evidence/` (three plant diffs, four control results and the probe source as `.txt`); the Fix & Verification rows of DEF-024 to DEF-026, with DEF-026 now Sev-2.
  - **QA hand-off:** Jira AQP-269 11386; PR #167 comment 6775062894.
  - **QA's control PRs** #185 to #188.
  - **My own checks** (API and CI logs only):
    - **Scope** (`compare cde1b29...552b4976`): 1 commit, 12 files, all under `docs/07-qa/`.
    - **CI 42869671189** on 552b497: 5 of 5 `success`. Path **5:11**, recomputed (311 s). Shards 213, 210 and 251 passed, with no `flaky` or `failed` line.
    - **QA's controls:** c0 (no fault) `success`; c1 (old effect), c2 (typing asks the hook) and c3 (the last refused field targeted) each `failure`. Master read the diffs of c2 and c3: c2 makes each dialog's typing handler call `showErrors`; c3 reverses the field search in the hook.
    - **The developer's controls for QLT-02 and QLT-03,** read by master because QA substituted other classes (see below):
      - A (QLT-02, run 42863675866) fails `materials.spec.ts:166` at 3 widths and `process-master.spec.ts:163` at desktop.
      - B (QLT-03, run 42863743797) fails Material's duplicate name (`materials.spec.ts:244`, `aqp-122-qa.spec.ts:199`), Process's duplicate name (`process-master.spec.ts:163`), the Users e-mail in use (`users.spec.ts:179`) and the Second Admin (`users.spec.ts:194`).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every acceptance item verified with evidence | ✱ | ✅ | each defect's expected behaviour checked: F-a and F-b at 3 widths in all three dialogs (QA's 18-test probe passes on the fix, c0); Fix & Verification rows filled in |
| 2 | No open Sev-1 or Sev-2 defect against these items | ✱ | ✅ | DEF-024 to DEF-026 verified fixed; DEF-027 (Sev-3) is separate |
| 3 | Regression recorded and green | ✱ | ✅ | CI 5 of 5 on 552b497; in each control, only the named tests fail |
| 4 | Exploratory notes | | ✅ | OBS-1 to OBS-4 |
| 5 | Accessibility | | ✅ | keyboard-only focus behaviour is the subject of the fix, at 3 widths |
| 6 | DL-136 (4) and DL-138 (2): QA's own three controls | | ⚠️ | QA ran c1 (the old effect) as named, but substituted c2 (typing asks the hook) and c3 (wrong target) for the field-name and server-site plants. The substitution is accepted, because master read the developer's A and B runs above and both bite. Together the five classes (typing, wrong target, old effect, second refusal, server refusal) are covered |
| 7 | DEF-026 record at Sev-2 | | ✅ | corrected in this commit |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| a | orchestrator | PR #189 (DEF-027) | Merges first, after master's check (DL-133 route; brought by the orchestrator when its runs report) | Before #167 is squashed |
| b | orchestrator | PR #167 merge | DL-139 (3) | After (a) |

**Accepted:** OBS-1 (no Edit-mode typing test): Edit uses the same component and the same hook as Add, so the Add tests and plants cover the code path; no issue. OBS-2 is already #171 (STD-01). OBS-3 and OBS-4 are noted.
**Risks:** none new. RISK-023 is unchanged (#167 adds about 2.5 s).
**Rationale:** each defect's fault is shown fixed by QA's probe and by tests that five independent fault classes break. The one deviation from the ruled controls is covered by evidence master read directly.
**Posted:** Jira AQP-269 comment 11388; PR #167 comment 6775129363. No tech-debt issue created.

## G6 + G7 (narrow route) — DEF-027 fix, PR #189 (AQP-272, #184; `tests/e2e/aqp-122-qa.spec.ts`) — 2026-11-10 (attempt 1)

- **Decision:** **GO to merge (DL-140).** This is the DL-133 narrow route for a test-only fix: one file, +4 / -1, no `src/`, config, dependency or CI change. G6 and G7 are decided together with no review round. DEF-027 closes on the merge.
- **Decided by:** master  ·  **Human override:** none
- **Evidence read by master** (API and CI logs):
  - **Diff:** the test now makes its own material (`newName`, `makeMaterial`) and asserts that the material is listed. The existing assertions stay (`options.length > 0`, three keys per entry, `no-store`). No retry, timeout, skip or tag was added (DL-057).
  - **PR #189** at aff4791 is CLEAN. Run 42867881487, attempts 1 to 3, is 5 of 5 each.
  - **Control PR #190** (#167's head cde1b29 plus the fix, closed unmerged). Run 42868028432, attempts 1 and 2, is 5 of 5 each.
  - **Latest attempt of each run:** the tablet test passes first time in shard 2 (slot 5), with no `flaky` or `failed` line. Without the fix, the same slot failed and needed retry #1 (42862491463). That makes five clean full runs, two of them on #167's test set.
  - **QA's audit** of the four QA specs found no other assertion that depends on rows the test did not create (QA hand-off on AQP-272).
- **Conditions:**
  - (a) Either order with the records docs PR #194. Whichever merges second is updated by a merge commit only, with its files unchanged, and needs 5 of 5 green.
  - (b) The PR body has no "Closes #184", so the orchestrator closes #184 as completed with the merge commit.
  - (c) QA moves AQP-272 to Done and fills in DEF-027's Fix & Verification rows (aff4791, the two runs).
  - (d) PR #167 then merges under DL-139 (3).
**Posted:** Jira AQP-272 comment 11393; PR #189 comment 6775228086.

## G6 – Peer Review (close) — AQP-244 (STORY-10.20, CI path variance, PR #166) — 2026-11-10 (attempt 1, closed at a4eab7f)

- **Decision:** **G6 closed at a4eab7f. DL-137 conditions A to C are met.** AQP-244 goes to In QA. QLT-06 (Minor) goes to tech-debt #203 (DL-141).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **Fix head a4eab7f:** one commit on 953b8ca, 5 files (`playwright.config.ts` +6 / -6; `masters-table-actions.spec.ts` +6 / -4; `tests/support/playwright-config.ts`, renamed from `own-width-files.ts`; `one-width-tag.test.ts` +3 / -3; `own-width-files.test.ts` +63 / -23). No `src/` change.
  - **Developer:** Jira AQP-244 11384.
  - **Re-reviews:** standards round 2 (11385): APPROVE WITH COMMENTS, Info only. Quality round 2 (review 5848133647, 11404): APPROVE WITH COMMENTS, 1 Minor (QLT-06). Reports: `docs/06-reviews/AQP-244/standards.md` and `quality.md`, round 2.
  - **Control PRs:** #183 (P4 re-planted, red), #191 (P6, green), #192 (P7, green), #193 (P8, red).
  - **My own checks** (API and CI logs only):
    - **Runtime diff:** the config change is a `ReadonlyArray` annotation and a rewritten comment, with the list unchanged. In the spec, the `desktop` skip moves from the describe's `beforeEach` to a file-level `test.beforeEach`, with the same condition.
    - **CI 42867165582** on a4eab7f: `success`, with no `flaky` or `failed` line. Per shard: 228 / 225 / 212 passed and 2 / 4 / 17 skipped. That is **identical to the measured head 953b8ca** (run 42852486467, latest attempt), so DL-137's condition holds and AC-3 is not re-measured.

**Checklist (close)**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Zero open Blocker or Critical findings | ✱ | ✅ | both re-reviews |
| 2 | QLT-01 fixed | | ✅ | file-level skip; the guard pins it; P4 re-planted (#183, run 42867966691) is red |
| 3 | STD-06 and the named Minors | | ✅ | two ruled names pinned in a test; QLT-02, STD-01 to STD-05, STD-07 and STD-08 per standards round 2 |
| 4 | Runtime test set unchanged | | ✅ | counts per shard identical to 953b8ca |
| 5 | G12 | | ✅ | nothing weakened (quality round 2) |
| 6 | Residual guard gap | | ⚠️ | QLT-06: the pin reads source text, so P6 (the hook only in a block comment) and P7 (an unindented describe) stay green. These are unusual edits, and P8 (a third file) is caught. Goes to #203 |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| D | qa-engineer | `docs/07-qa/AQP-244-test-report.md` | DL-137 (D), with the architect's v0.32 (AC-3 (c) reported only): AC-1 to AC-6 with evidence; AC-3 recomputed from base run 42850365032 and head run 42852486467 (median of five, slowest, hits, 0 flaky); counts per shard on the final head; P4 and one other plant (P1 or P5) re-planted by QA's own control PRs; the G12 relaxation read against the pinned names | G7 |
| E | developer | #203 | QLT-06: a syntax-based pin; P6 and P7 must fail | Before any change to `OWN_WIDTH_FILES` or either file's skip line; at the latest G8 |
| F | orchestrator | merge | DL-141 (4) | After G7 GO |

**Accepted:** STD-10 and STD-11 (Info, optional).
**Risks:** RISK-023 stays 6 until G7; the reading at G7 is set in DL-141 (3).
**Rationale:** the Major is fixed and its plant is red, and the runtime is provably unchanged. The remaining gap needs a deliberately odd edit. It gets an owner and a due point tied to the only change that could exploit it.
**Posted:** Jira AQP-244 comment 11406; PR #166 comment 6777366036; tech-debt GitHub #203 created (QLT-06).

## G6 – Peer Review — AQP-130 (STORY-02.05 Treatment / Color list, PR #195) — 2026-11-10 (attempt 1)

- **Decision:** **CONDITIONAL GO.** There are zero Blocker and Critical findings. PRF-01 is ruled a measurement condition, not a code defect: a median of five is read on the final head. QLT-01 to QLT-04 and the named standards Minors are fixed in one push. reviewer-quality and reviewer-standards re-review the new diff, and master closes G6 on the fix head with the median of five (DL-142).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #195** at 67febe3: 50 files, CLEAN. Developer hand-off: Jira AQP-130 11403.
  - **Reviews** (`docs/06-reviews/AQP-130/{standards,quality,performance,consolidated}.md`):
    - standards: APPROVE WITH COMMENTS, review 5848269835 (Jira 11409);
    - quality: APPROVE WITH COMMENTS (Jira 11410);
    - performance: APPROVE WITH COMMENTS (Jira 11408).
  - **Control PRs:** the developer's #196 to #200, and reviewer-quality's #204 to #206.
  - **Test strategy v0.32** §10.5 item 9 (the reading rule and the RISK-023 trigger).
  - **My own checks** (API only; nothing run locally):
    - CI 42881974487 on 67febe3: success. Path 5:51, recomputed (351 s).
    - Read item 9: a pull-request first attempt of 5:30 or more starts a median of five full runs. A median of five of 5:30 or more makes the next CI-time step due and is a RISK-023 trigger. It is not a merge hold.
    - Read the findings tables of the standards and quality reports.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | standards, quality, performance |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | 0 and 0 in each |
| 3 | Majors fixed or accepted | | ⚠️ | PRF-01 is re-ruled from Major to a measurement condition (DL-142 (1)). No code Major |
| 4 | Plants | | ⚠️ | A3 and A4 are caught (developer #196, #197; quality #204, #205), and so are the focus and DEF-020 plants (#198, #200). **Locks removed (#206) stay green: QLT-03.** #199 (old effect) is caught only by the source guard, which is accepted (QLT-05: one field) |
| 5 | Correctness | | ⚠️ | QLT-01 (canonical name vs reserved check), QLT-02 (422 before 409/404), QLT-04 (stale first read) |
| 6 | Standards | | ⚠️ | STD-01, 02, 05, 06, 07 and 08 in the push; STD-03 and STD-04 to the #119 refactor (DL-142 (3)) |
| 7 | CI | | ✅ | green; coverage 99.2 % |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #195, one push | **QLT-01:** the stored name is canonical (NFKC, trimmed, inner whitespace collapsed), checked against the reserved names and against duplicates on that form, with integration tests for a double space and for full-width letters. **QLT-02:** the shape check runs before the transaction, then the lookup and lock (404 / 409), then the reserved-name check (422), with route and unit tests. **QLT-03:** one integration test of two simultaneous renames of one treatment, asserting the second `master.edited` entry's `before` equals the first entry's `after`. It must fail with both locks removed (re-run of #206). **QLT-04:** the latest read wins (a ticket check), with a test. **STD-01** (split or justify), **STD-02** (`isRecordNotFound` from `database-errors.ts`), **STD-05** (words into `treatment-texts.ts`), **STD-06** (`SPEC_ACCESS` to a support file; another story's rows restored), **STD-07**, **STD-08**. Update the Dev Record | Before the re-review |
| B | reviewer-quality; reviewer-standards | PR #195, new diff only | quality: QLT-01 to QLT-04, with a locks-removed control PR that must now fail, and STD-14 judged. standards: their Minors | After A |
| C | orchestrator, then master | final head | **The median of five** (test strategy v0.32 §10.5 item 9) on the fix head: five full runs, `hit` in every job, misses replaced. Post the five paths, each slowest shard and its host line. Master closes G6 on the re-reviews and this reading | After B |
| D | product-owner | Jira AQP-130 AC-6 | Event names `master.created`, `master.edited` and `master.deleted` with `object_type` `treatment` (as DL-129 did for AQP-123) | Before G7 |
| E | solution-architect | architecture §6; #202; the 05.06 open question | Add 409 `TREATMENT_LOCKED` and the 422 codes to the §6 codes line (STD-12). Rule on #202 (a database guard for system rows). Take QLT-09 (deleting a treatment an estimate uses: restrict with 409, soft delete, or a copied name) into the 05.06 open question | §6 before G7; #202 and QLT-09 before 05.06 is Ready |
| F | ux-expert | #201 | Rule the words. If ruled before A is pushed, they ride the push; otherwise the words stand as built and #201 stays open | Before G7 where possible |
| G | product-manager | PRF-06 | State a maximum number of treatments (the list has no paging) | Before 05.06 is Ready |
| H | developer | #119 refactor PR | DL-142 (3) | Before AQP-142 starts G5 |

**Accepted (Info):** QLT-05 (the one-field replacement for DL-135's two-field test), STD-09 (fixed with the push if touched), STD-10, STD-13, and the remaining Infos. PRF-02 (desktop pinning, about 6 s per shard) is not taken: v0.32 says balance work below 80 s host-free is not due.
**Risks:** none new. RISK-023 stays at 6 until the median of five is read (DL-142 (1)).
**Rationale:** the story is sound, and its guards bite except one. The concurrency test that passes with no lock is the DL-117 class, so it is fixed now. The three correctness Minors sit in the code being pushed anyway. The cross-screen refactor of #119 is better as its own reviewed change than inside a 50-file feature PR.
**Posted:** Jira AQP-130 comment 11412; PR #195 comment 6777713030; GitHub #119 (one refactor PR, with an owner and a due point).

## G7 – QA Acceptance — AQP-244 (STORY-10.20, CI path variance, PR #166) — 2026-11-10 (attempt 1)

- **Decision:** **GO.** The QA record is at 50425f5; the code is a4eab7f, unchanged since the G6 close. AQP-244 moves to Done. **RISK-023 falls from 6 to 4** (P 2 × I 2) by the register's rule, as DL-141 (3) pre-ruled. PR #166 merges under DL-143 (3).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-244-test-report.md`: ACCEPT, no defects.
  - **QA plants:** #207 (P4) and #208 (P9), each failing 1 of 2,793 on the file-level skip guard; both closed unmerged.
  - **Ruling:** test strategy v0.32 §10.5 item 9 (AC-3 (c) is reported only).
  - **My own checks** (API and CI logs only):
    - **Scope** (`compare a4eab7f...50425f5`): 1 file, the QA report.
    - **CI 42890394439** on 50425f5 (the merge ref): 5 of 5 `success`, path **4:44**, recomputed (284 s). 231 / 228 / 215 passed and 2 / 4 / 17 skipped, with no `flaky` or `failed` line. The 9 extra passed tests are #167's, carried by the merge ref; the skipped counts are unchanged.
    - **AC-3 recomputed** from the jobs API, first job start to the end of `Stages 1 to 11`:
      - head run 42852486467, attempts 1 to 5: 250, 292, 268, 277 and 280 s, so the **median is 4:37 and the slowest 4:52**;
      - base run 42850365032: 296, 266, 281, 317 and 270 s, so the median is 4:41 and the slowest 5:17.
      - Both match QA and the reviewers.
    - **Not re-run by master:** QA's count comparison (665 passed entries equal in 5 of 5 pairs; the 108 skipped own-width entries gone) and the host-free fit.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | AC-1 to AC-6 in QA's report. AC-3: median of five at most 5:00 (4:37) and the slowest at most 5:30 (4:52), with 20 of 20 jobs hit and 0 flaky. AC-3 (c) is reported only (50 s → 27 s host-free) |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | none |
| 3 | Regression recorded and green | ✱ | ✅ | CI 42890394439, 5 of 5, no flaky line |
| 4 | Each test still runs once | | ✅ | passed entries equal the base in 5 of 5 pairs; only the skipped own-width entries drop |
| 5 | QA plants | | ✅ | P4 and P9 each red on the file-level guard |
| 6 | Exploratory and method notes | | ✅ | QA's note that `gh run view --job` returns the latest attempt; DEF-023's evidence re-read per attempt, and it stands |

**Risks:** **RISK-023 falls from 6 to 4 (P 2 × I 2)** (DL-143 (2); register updated). A pending input is noted: AQP-130's single PR reading of 5:51 awaits its median of five (DL-142 (1)), and a median of 5:30 or more on a PR or `master` head raises it to 8 again.
**Rationale:** every AC has independent evidence on the code that passed G6. The figures master recomputed match QA's. The fall rule names AC-3, and AC-3 holds.
**Posted:** Jira AQP-244 comment 11421; PR #166 comment 6777948136; RISK-023 on Jira AQP-1 comment 11422.

## G6 – Peer Review (close) — AQP-130 (STORY-02.05 Treatment / Color list, PR #195) — 2026-11-11 (attempt 1, closed at 1f978b2)

- **Decision:** **CONDITIONAL GO. G6 closes at 1f978b2, and there is no further G6 round.** All DL-142 conditions A to C are met, and D and E (the items due before G7) are met too. AQP-130 goes to In QA. STD-15 (Minor) is fixed in one test-only commit before QA gathers evidence, and master reads it at G7 (DL-047). QLT-11 (Minor) goes to tech-debt #218. STD-17 and STD-18 go to the #119 refactor PR. QLT-13 goes to the architect. **RISK-023 stays at 4:** the median of five is 5:24, under the 5:30 trigger (DL-144).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **Fix head 1f978b2:** one commit on 67febe3, 27 files, +511 / -134. The PR now has 54 files. Developer: Jira AQP-130 11424. The Dev Record (round 2) is in the PR body and has a row for every fixed finding, plus the control PRs #210 and #211.
  - **Re-reviews:**
    - quality round 2 (review 5848801283, Jira 11426): APPROVE WITH COMMENTS. QLT-01 to QLT-05 are fixed. New: QLT-11 (Minor) and QLT-12, QLT-13 (Info).
    - standards round 2 (review 5848733217, Jira 11425): APPROVE WITH COMMENTS. STD-01, 02, 05 to 09 and 13 are fixed. New: STD-15 (Minor) and STD-16 to 18 (Info).
    - Reports: `docs/06-reviews/AQP-130/{quality,standards,consolidated}.md`, round 2.
  - **Pre-G7 routing:**
    - AC-6 is amended in the Jira description to `master.created`, `master.edited` and `master.deleted` with `object_type` `treatment` (product-owner 11431; read by master).
    - Architecture v0.35 §6, on `master`, has 409 `TREATMENT_LOCKED`, the 422 codes and the refusal order (solution-architect 11417).
    - The #201 words are applied in the push (ux-spec v0.22).
  - **My own checks** (API and CI logs only; nothing run locally):
    - **Median of five, recomputed** from `actions/runs/42891948697/attempts/1..5/jobs` (head 1f978b2; path from the first job start to the end of `Stages 1 to 11`). Paths: 326, 308, 337, 312 and 324 s, so **the median is 324 s (5:24) and the slowest is 337 s (5:37)**. Every attempt is 5 of 5 `success`.
    - **Logs of all five attempts:** no `flaky` line and no `N failed` line. A `Cache hit for: node-modules-v1-…` line appears and no `Cache not found` line. Grepping for "miss" finds only the `fail-on-cache-miss: false` input lines. Each attempt has the same counts: E2E passed 243 / 241 / 294 and skipped 69 / 70 / 17; Vitest 2,894 and 5,111 passed.
    - **Shard balance** (report only, v0.32): the slowest shard is 1, 2, 3, 3 and 3 across the five attempts. The median job times are 278 / 235 / 302 s, so shard 3 is about 30 s of raw job time over the mean. That is far under the 80 s host-free line, so no balance work is due.
    - **Control PRs:** each one is a single commit on 1f978b2, and I read every plant's diff.
      - #212, both locks removed (cc1756a, run 42894187597): `Stages 1 to 11b` is red with exactly 2 failed out of 5,111, both in `treatments-serialisation.test.ts`, each `expected { name: 'Chain-start' } to deeply equal { name: 'Chain-first' }`.
      - #213, only `FOR UPDATE` removed (fe50f0c), and #214, only `LOCK TABLE` removed (3a588ba): `Stages 1 to 11b` is green.
      - #210 (843ed42, both locks removed): red. #211 (112f169, latest-read guard removed): all three E2E shards red.
    - The `password authentication failed` line in #212's log also appears in the head run's attempts 1 and 5, so the plant did not cause it.
    - **Merge preview** (for the §8 conditions):
      - Since the PR's base 41848eb, `master` changed 20 files. Only one of them is in the PR: `tests/e2e/masters-table-actions.spec.ts`. AQP-244 moved the skip hook to file level at base lines 88 to 99, and the PR's hunks sit at lines 7 to 63 and 103 onward.
      - E2E passed totals: base run 42874256994 has 674, and `master` 1d37902's run 42945910485 also has 674. The Vitest totals rise by 8 in each run (2,785 to 2,793 and 4,903 to 4,911).
    - **DEF-028:** `tests/acceptance/aqp-123-exchange-rates.test.ts` lines 400 and 417 are present on 1f978b2. Fix PR #216 (7df86ad, open) changes 5 files, none of them in #195.

**Checklist (close)**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | round 1: standards, quality, performance; round 2: standards and quality on the new diff; performance's reading is item 7 |
| 2 | Zero open Blocker or Critical findings | ✱ | ✅ | both round-2 verdicts; consolidated round 2: 0 Blocker / Critical / Major |
| 3 | QLT-01 to QLT-04 fixed (DL-142 A) | | ✅ | quality round 2; QLT-03 bites only with both locks removed (#212 red; #213 and #214 green: either lock alone serialises, QLT-12) |
| 4 | QLT-04 control | | ✅ | #211 red at 3 widths. Only the developer ran it, so QA reproduces it at G7 |
| 5 | Named standards Minors (DL-142 A) | | ✅ | STD-01, 02, 05 to 08 fixed (plus 09 and 13); STD-03 and STD-04 stay on #119 |
| 6 | G12 | | ✅ | nothing removed or weakened; `SPEC_ACCESS` moved 25 of 25 entries unchanged (quality round 2). The new location is outside the G12 scope list (QLT-13) |
| 7 | Median of five (DL-142 C; v0.32 item 9) | | ✅ | 5:24 median, recomputed; under 5:30; all hits; 0 flaky |
| 8 | Dev Record current | | ✅ | round 2 rows for every fixed finding and #210, #211 |
| 9 | Traceability of test names | | ⚠️ | STD-15: describe names cite review IDs (QLT-01 to QLT-04), not AC or NFR IDs (`CLAUDE.md` §6 rule 3). Fixed in one test-only commit before G7 |
| 10 | Audit writer shape check | | ⚠️ | QLT-11: `masterState` is a union, so a partial state under another `object_type` is stored. The gap predates this PR. Goes to #218 |
| 11 | Pre-G7 routing (DL-142 D, E) | | ✅ | AC-6 in Jira (11431); §6 codes in architecture v0.35 on `master` (11417) |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #195, one test-only commit | **STD-15:** describe and test names cite the AC or NFR (for example `AC-6, NFR-007` for the serialisation test, `AC-2` for the canonical-name tests, `AC-3` for the refusal order). Review IDs and "control PR 206" stay in header comments only. The files are `tests/integration/masters/treatments-serialisation.test.ts`, `tests/integration/masters/treatments.test.ts`, `tests/unit/masters-service-treatments.test.ts` and `tests/e2e/treatments-focus.spec.ts`. STD-16 (`defined(...)` in place of `?.id ?? ''`) may ride in the same file. Before renaming, grep each old title: a title pinned elsewhere (the one-width allow-list, a guard) is left unchanged. Add a Dev Record row. **No other file. The counts stay the same:** E2E 243 / 241 / 294 passed and 69 / 70 / 17 skipped; Vitest 2,894 and 5,111 passed; no `flaky` or `failed` line. Master reads the commit at G7 with no re-review (DL-047). Anything beyond these files or counts comes back to master | Before QA gathers evidence |
| B | qa-engineer | `docs/07-qa/AQP-130-test-report.md` | The G7 route in DL-144 (5) | G7 |
| C | developer | #218 | QLT-11: a per-type shape check in its own small PR (behaviour change, so not part of #119), narrow reviewer-quality review, with a control that reverts to the union | Before AQP-142 reaches G6; at the latest G8 |
| D | developer | #119 refactor PR | DL-142 (3), plus STD-17 and STD-18 (comment 6785713900) | Before AQP-142 starts G5 (unchanged) |
| E | solution-architect | test strategy §10 (G12 scope) | QLT-13: add `tests/support/spec-access.ts` and `tests/support/route-calls.ts` to the G12 scope list. Reviewers treat both files as in scope until then | The next change of the test strategy; at the latest before the #119 refactor PR's G6 |
| F | product-manager | PRF-06 | A maximum treatment count (carried from DL-142 G) | Before 05.06 is Ready |
| G | orchestrator | merge | DL-144 (6) | After G7 GO |

**Accepted (Info):** QLT-12, which records that the test proves "at least one lock", the property that protects the audit `before`; the two notes in quality round 2 on the rename notice; and STD-16 if it is not taken in A.
**Risks:** RISK-023 stays at 4 🟢. This reading resolves the input that DL-143 left pending. No new risk.
**Rationale:**
- Every DL-142 condition holds, with evidence master read directly. The serialisation guard now bites exactly when serialisation is lost. The median of five on the code that will merge sits under the line.
- STD-15 is a cheap traceability Minor that falls before QA starts, so it gets one named-file commit, as at DL-047 and DL-130, and not an issue.
- QLT-11 changes behaviour across every master and predates this PR. It gets its own owned PR, timed before the next audited story is reviewed.
**Posted:** Jira AQP-130 comment 11436; PR #195 comment 6785764449; tech-debt GitHub #218 created (QLT-11); #119 comment 6785713900 (STD-17, STD-18).

## G6 + G7 (narrow route) — DEF-028 fix, PR #216 (AQP-273, #215; no-rate scans that read a random request ID or UUID) — 2026-11-11 (attempt 1)

- **Decision:** **GO to merge (DL-145).** This is the DL-133 narrow route for a test-only fix: 5 files (4 under `tests/`, +104 / -3, and the QA record `docs/07-qa/defects/DEF-028-*.md`, +55), with no `src/`, config, dependency or CI change. G6 and G7 are decided together with no review round. DEF-028 closes on the merge.
- **Decided by:** master  ·  **Human override:** none
- **Evidence read by master** (diff, source, API and CI logs):
  - **Root cause confirmed at the source.** `src/server/http/problem.ts:29-30` (`newRequestId`) makes `req-` plus `randomBytes(4)` in lower-case hex, and never takes it from the request. The failed body in `master` run 42873078338 held `req-0839e75b`. QA's odds recompute: 6 three-digit windows times 2 patterns over 4,096 gives about 0.29 % per body. The 6 bodies at line 400 give 1.74 % and the 2 at line 417 give 0.58 %, about 2.3 % per run. At `materials.test.ts:129`, 22 windows times 3 over 4,096 gives about 1.6 %.
  - **Diff.** Lines 400 and 417 now scan `withoutRequestId(answer.text)`, and line 129 scans `withoutUuids(...)`. Each helper removes one strict shape only: the first `"requestId":"req-[0-9a-f]{8}"` member, or a free-standing lower-case 8-4-4-4-12 UUID. Every other character is still scanned, and no retry, timeout, skip or removal was added (DL-057). The helpers fail closed: a value they do not recognise stays in the scanned text, so the worst case is a red, never a hidden leak. A rate cannot sit inside either shape, because every canary value has a point and the ID is made by the server.
  - **G12.** These files are outside the test strategy §10 G12 scope. The change still narrows a no-rate scan, so master read it as G12 would: the narrowing is stated in the PR body, and planted faults prove it (control #217 and the unit plants).
  - **Plants.** Control PR #217 (ca8c4ec plus `"rate":"1.23"` in every 403/401 body of the test double, closed unmerged), run 42948309072: `Tests 1 failed | 4916 passed (4917)`. The one failure is exactly `[AQP-123 AC-6] decision table`, an AssertionError on the line-400 pattern. That plant does not reach line 417, which makes the same call. `tests/unit/random-members.test.ts` covers line 417 and the UUID path: the Origin body (`originRefusedProblem`); planted rates still found (`"rate":"1.23"`, `usd 839.73`, `917.37` beside a UUID); six odd ID shapes and a second member kept; and 2,000 real `newRequestId()` values giving one stripped body. At line 129, the exact-key `toEqual` above the scan also refuses any extra member.
  - **Audit.** Master's own `git grep` of `tests/` on the PR head, for negative scans of a hex-only literal or alternative of 3 or more characters, returns exactly QA's rows. Those are the three fixed lines, the unit test, and the decimal-point, `192.0.2.` and fixed-input scans that QA set aside. PR #195 (AQP-130) adds no scan of that shape: its 10 added negative assertions read fixed constants, names or IDs. The residual at `aqp-38-sign-in.test.ts:370` (`57014`, about 6 in 100,000 runs) is accepted as Info, with no issue.
  - **CI.** There are five full runs: run 42948234269 (ca8c4ec) and run 42949108117 (7df86ad) attempts 1 to 4. Each is 5 of 5 jobs success, including the fan-in `Stages 1 to 11` (read per attempt from the jobs API). Every run has Vitest 2,799 and 4,917 passed of the same totals, and E2E 231 / 228 / 215 passed with 2 / 4 / 17 skipped. In each log, the only `flaky` matches are two branch names in a `git fetch` listing. The only `failed` matches are names of passing tests, the workflow's `failed=` script and one expected Postgres authentication line. No test failed or was retried. Against `master` push run 42945910485 (1d37902: Vitest 2,793 and 4,911, E2E the same), the PR adds 6 to each Vitest run and 0 to E2E. The second Vitest run includes `tests/unit` by design, so every test still runs once per run. Paths (first job start to fan-in end) are 4:58, then 4:53, 4:36, 4:25 and 4:56. No E2E tests were added, so RISK-023 is not affected. Gitleaks, lint and type-check ran green in stages 1 to 11b.
  - **Route.** `tests/support/random-members.ts` is a new shared test helper, not a runtime helper: two regular expressions, read in full and covered by six unit tests. It does not end the route (DL-124 (1)). Commit 7df86ad adds only the record's Verified row.
- **Conditions:**
  - (a) **Order with records PR #219:** either order (DL-133 (4), DL-140). Whichever merges second is updated by a merge commit only, with its files unchanged. If #216 is the one updated, it needs 5 of 5 green with no failed or retried test, each Vitest run's passed count equal to the new `master` push run's plus 6, and E2E equal. Any red comes back to master and is not re-run: DEF-028 can no longer explain a red on #216's head.
  - (b) **After the squash,** the orchestrator posts the `master` push run (run, counts, path) on PR #216 and AQP-273. A red comes back to master and is not re-run away.
  - (c) The PR body has no "Closes #215", so the orchestrator closes #215 as completed with the merge commit.
  - (d) QA moves AQP-273 to Done after the merge. QA records the merge commit and push run in DEF-028's record in the next records PR, not in #216, whose files stay unchanged.
  - (e) **Then #195, under DL-144 (6) (c) to (g).** #195 is updated only after #216 has merged. If only #219 and #216 have merged since 1d37902, the updated head must show **778 E2E and 2,908 and 5,125 Vitest** passed (DL-144's 2,902 and 5,119, each plus 6). If any other PR (for example #220) merges first, recompute with DL-144 (6) (e) from the `master` push run actually taken. The DEF-028 clause of DL-144 (5) covers only QA runs on heads without #216. Once #195 contains #216, a red at those lines is a finding.
**Posted:** Jira AQP-273 comment 11448; PR #216 comment 6786997086.

## G6 – Peer Review (narrow route) — AQP-236 (DEF-022 fix, PR #220: each Playwright listing gets its own cache folder) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-146).** This is the DL-120 narrow route: one reviewer-quality report is the full G6 evidence. There are no Blocker, Critical or Major findings. QLT-01 and QLT-02 (Minor) and QLT-03, QLT-04 and QLT-05 (Info) are fixed in one named-file commit before QA gathers evidence. Master reads that commit at G7, with no re-review round (DL-047), and QA reproduces the plant on it. AQP-236 goes to In QA.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #220, head ddf6191:** one commit on 1d37902, 3 files, all under `tests/`. `tests/support/playwright-list.ts` is +45 / -8, `tests/unit/e2e-shards.test.ts` is +9 / -8 (only `beforeAll`), and `tests/unit/playwright-list.test.ts` is new (+140, 6 tests). There is no `src/`, config, dependency or CI change. Master read the whole diff (`gh pr diff 220`). Developer hand-off: Jira AQP-236 11439. The Dev Record is in the PR body.
  - **Review:** reviewer-quality, PR review 5854937641 (Jira 11451), APPROVE WITH COMMENTS. The report is `docs/06-reviews/AQP-236/quality.md` (records branch, 39d4ad3).
  - **Control:** PR #221 (997eebd, closed unmerged), CI run 42958806182.
  - **CI on ddf6191:** run 42951199191, attempt 1, read from the jobs API and the log by master.
  - **`master` now:** 225a1c9 (#216). Push run 42975598629 is 5 of 5 green, with a path of 4:58.

**Checklist (narrow route, DL-120 / DL-124 (1))**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review evidence present for the route | * | ✅ | DL-120 (1) names reviewer-quality alone. The diff has no runtime path, data, config, dependency or CI change. `tests/support/playwright-list.ts` is shared test support for four guard files, not a runtime helper, so the route holds (DL-124 (1), as for `random-members.ts` at DL-145 (1)) |
| 2 | Zero open Blocker / Critical | * | ✅ | 0 / 0 / 0 Major (report, severity table) |
| 3 | Findings cite file:line | * | ✅ | QLT-01 `playwright-list.test.ts:83-102`, QLT-02 `:114`, QLT-03 `playwright-list.ts:19-24`, QLT-04 `:90-92`, QLT-05 `:59,68`, QLT-06 `:109`, QLT-07 `e2e-shards.test.ts:53-65` |
| 4 | Root cause fixed at the source, no DL-057 shortcut | * | ✅ | `withPrivateListCache` gives each listing a new `mkdtemp` folder under `tmpdir()`, passed as `PWTEST_CACHE_DIR` and removed in `finally`. `LIST_TIMEOUT_MS`, `hookTimeout`, retries and skips are unchanged (diff). The mechanism is confirmed in Playwright 1.64.1's source by the reviewer (QLT-03): the `.map` source map has no hash check and is deleted or rewritten by a concurrent compile |
| 5 | No guard weakened (G12) | * | ✅ | The six `e2e-shards` test bodies are byte-identical, and only `beforeAll` changed. The whole-suite-first order existed only to fill a shared cache. `canary-scan-gate.test.ts` (G12 scope) is unchanged and still lists the same suite. Master's `git grep` on ddf6191 finds exactly the four callers the PR names (`playwright-config.ts` names the helper only in a comment) |
| 6 | CI green on the judged head | * | ✅ | Run 42951199191: 5 of 5, including the fan-in `Stages 1 to 11` (03:17:13Z to 03:17:19Z). Path 4:44 (03:12:35Z to 03:17:19Z). Vitest 2,799 and 4,917 passed, E2E 231 / 228 / 215 passed with 2 / 4 / 17 skipped. Against `master` 1d37902 (push run 42945910485: 2,793 and 4,911) that is +6 per Vitest run, the 6 new unit tests in both runs, and 0 E2E. The only `flaky` matches are two branch names in the `git fetch` listing. The only `failed` matches are passing test titles, the `failed=` script and the expected Postgres authentication line |
| 7 | Plant shows the fix is what matters | * | ✅ | #221 restores one fixed shared folder. Locally cold on Windows, the DL-120 pair failed 6 of 10 (5 with the DEF-022 signature, 1 `EPERM` on a shared `.map`, plus 3 inconclusive load timeouts). The head passed 10 of 10 in the same loop. In CI stage 6, the new unit test failed on the plant. These are the reviewer's runs, not the developer's |
| 8 | New unit test proves what its names say | | ⚠️ | QLT-01 and QLT-02 (below). The concurrency test catches the plant in every order, so the guard is not empty |
| 9 | Comments accurate | | ⚠️ | QLT-04: "which the system clears" is not true of `%TEMP%` on Windows. QLT-03: the header says "half-written entry"; precisely, it is the source map |
| 10 | Cost | | ✅ | Reviewer's stage 11 reading: the four listing files sum to 9.46 s on `master` (warm) and 9.63 s on the head (cold), about +0.2 s. The developer measured +4 s locally on the six-file set. Both are far from the 100 s listing limit and the 120 s hook limit. No E2E change, so RISK-023 is not affected |
| 11 | Dev Record | | ✅ | Files, deviations, before and after loops and the quality loop are present for ddf6191. It needs a row for the fix commit (condition A) |

**What master checked beyond the report**
- **QLT-02's suggested code would pass on the plant.** #221's fixed folder is `join(tmpdir(), 'accucut-playwright-list-shared-control')`. It starts with the helper's prefix and sits in `tmpdir()`, so "starts with `accucut-playwright-list-`" plus "`dirname` is `tmpdir()`" both hold for it. The ruled form below anchors the `mkdtemp` shape. A scratch probe on this machine matched 500 of 500 real `mkdtemp` folders against `^accucut-playwright-list-[A-Za-z0-9]{6}$` and rejected the plant's name.
- **QLT-01's suggested code fails on the plant in every order.** Alone, nothing creates the fixed folder, so "existed during the listing" is false. Beside a real listing in another worker, the folder exists but is never removed, so "gone after" is false.
- **Loop shape.** DEF-022's record names six files. Since then, `own-width-files.test.ts` (AQP-244) and `canary-scan-gate.test.ts` also list the suite. A race fix is verified in the run shape that holds every racing caller together (the AQP-227 G7 lesson), so QA's loop covers all of them (condition B).
- **The update from `master`.** #216 changed 5 paths, and #220 changes 3. None overlap. Records PR #219 is docs-only and does not touch #220's files or QA's report path.

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #220, one test-only commit | Only two files. **`tests/unit/playwright-list.test.ts`:** (QLT-01) in both "removes the folder" tests, record `existsSync(folder)` inside the fake listing and assert it is `true` before asserting removal (the reviewer's code). (QLT-02) the caller-override test asserts all four of these: the folder is not the caller's value; its basename matches `^accucut-playwright-list-[A-Za-z0-9]{6}$` (anchored); it existed during the listing; and it is gone after. A prefix check plus `dirname` alone is not accepted, because the #221 folder passes it. (QLT-05) rename `bothStarted` to `allStarted`. Prefix the second describe title with `AQP-236 (DEF-022): ` (`CLAUDE.md` §6 rule 3). **`tests/support/playwright-list.ts`, comment lines only:** (QLT-04) drop "which the system clears"; (QLT-03) say that the source map (`.map`) is deleted or rewritten by a concurrent compile, while the compiled `.js` has a hash check. **No code line in the helper changes, and no `it` is added or removed.** On the new head (still on 1d37902), CI is 5 of 5 including `Stages 1 to 11`, with Vitest 2,799 and 4,917 and E2E 231 / 228 / 215 passed (2 / 4 / 17 skipped), and no failed or retried test. **Dev Record:** add a row for the commit, run the #221 plant on the fixed test file (print the plant's diff first), and record the result. Expected: 4 failed (the concurrency test, both removal tests, the caller-override test) and 2 passed (the `withPrivateListCache` pair), alone and beside the four listing files. Change the Gates line to the condition B loop. Anything beyond these files or lines comes back to master | Before QA gathers evidence |
| B | qa-engineer | `docs/07-qa/AQP-236-test-report.md` (committed to PR #220) | The G7 route in DL-146 (3) | G7 |
| C | orchestrator | Jira AQP-236 | AQP-236 is still at In Progress. Bring it through In Review to In QA by transitions (the developer and orchestrator moves in `CLAUDE.md` §4) | Now |
| D | orchestrator → delivery lead | branch `control/AQP-236-shared-cache` | Deleting it was refused by permissions. Ask the delivery lead to delete it with "Delete branch" on PR #221, which GitHub can restore. Nobody reopens #221. It holds neither G7 nor the merge. The security review's flag (a fixed shared temp path) is the plant itself: accepted, with no issue | Before G8 |
| E | orchestrator | merge | DL-146 (4) | After G7 GO |

**Accepted (Info):** QLT-06, which is a note for QA and is built into condition B. QLT-07 records that nothing is weakened.
**Risks:** none new. RISK-023 is unaffected: there is no E2E change, and the path is 4:44. Each listing is now always cold. That is in the DL-057 load-sensitive class, and condition B records the per-run time so the margin to the 100 s limit is measured, not assumed.
**Rationale:**
- Every mandatory item passes on ddf6191 with evidence master read directly. The two Minors are test-quality gaps in a guard whose core test already catches the plant. That is CONDITIONAL GO, not NO-GO.
- The Minors are cheap and fall before QA starts, so they get one named-file commit, read by master at G7 (DL-047, DL-130, DL-144). They do not go into an issue.
- QLT-02 is ruled as the behaviour needed (the test must fail on the #221 plant), not as the reviewer's code, because that code passes on the plant. The plant is run by QA independently of the developer.
**Posted:** Jira AQP-236 comment 11453; PR #220 comment 6789524581.

## G6 – Peer Review (narrow route) — AQP-245 (STORY-10.21 Users list table actions, PR #222) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-147).** This is the narrow reviewer-quality route set in the story's Dev Context (DL-122 (1), DL-124 (1)). There are no Blocker or Critical findings. QLT-01 (Major) and QLT-02 to QLT-04 (Minor) are fixed in one test-only round. reviewer-quality then re-reviews once, on the head that also holds the merge of `master` after #195. AQP-245 goes to Changes Requested. **PR #195 (AQP-130) merges first.**
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **PR #222, head 72d92e9,** on 1d37902, with three commits: 85e9d61 (test first, run 42959350855 red on the 11 SCR-14 cases), fbfb968 (fix) and 72d92e9 (computed-style assertions after plant #223 survived and #224 was caught). Two files: `src/components/features/users/users-list.tsx` (+9 / -9) and `tests/e2e/masters-table-actions.spec.ts`. Master read the product diff in full, and the spec's helpers and test body. Developer hand-off: Jira AQP-245 11457.
  - **Review:** reviewer-quality round 1, PR review 5855399377 (Jira 11459), REQUEST CHANGES. The report is `docs/06-reviews/AQP-245/quality.md` (records branch `docs/AQP-1-g6-close-aqp-130`, cdeb446). Orchestrator brief: 11460.
  - **Plants:** #226 P-GAP (66d2009, run 42980084449) and #227 P-WRAP (c86b424, run 42980091871). Master read both diffs from the compare API: one commit each, exactly as reported. Both runs are green.
  - **CI on 72d92e9:** run 42978577848, read from the jobs API and the log by master.
  - **PR #195:** head 6dd89b7, labels `gate:g6-pass`, G7 in progress (DL-144 (5)). Its diff to the shared spec was read by master.

**Checklist (narrow route, DL-122 (1) / DL-124 (1))**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review evidence present for the route | * | ✅ | The Dev Context names reviewer-quality narrowly. The diff is UI layout and focus in the Users component plus one E2E spec. There is no data path, no `src/` outside `features/users`, and no config, `package.json` or CI change |
| 2 | Zero open Blocker / Critical | * | ✅ | 0 / 0. One Major (QLT-01), 3 Minor, 4 Info (report, severity table) |
| 3 | Findings cite file:line | * | ✅ | QLT-01 `masters-table-actions.spec.ts:250-251`, QLT-02 `:206-224`, QLT-03 `:168-176` and `users-list.tsx:80`, QLT-04 `:104-108, 256, 269, 288`, QLT-06 `aqp-234-qa.spec.ts:140-170`, QLT-07 `users-list.tsx:15, 80` |
| 4 | Product code meets the ACs | * | ✅ | `actionButtons={3}`, `TableActionsHead`, `TableActionsCell`, the wrapper `flex flex-nowrap items-center justify-end gap-s-2`, and `BREAK_LONG_NAMES` on the name cell. The e-mail cell keeps `break-all`. `RowActions`, the own-row names and the `md:hidden` cards are untouched (diff) |
| 5 | CI green on the judged head | * | ✅ | Run 42978577848 is 5 of 5, including `Stages 1 to 11` (07:23:26Z to 07:23:32Z). The path is 4:41 (07:18:51Z to 07:23:32Z). Vitest 2,799 and 4,917 are equal to `master` 225a1c9's push run, because PR CI runs the merge ref, so 0 are added. E2E is 235 / 232 / 219 passed = 686 = 674 + 12, with 2 / 4 / 17 skipped (unchanged) |
| 6 | Secrets hygiene | * | ✅ | Master ran Gitleaks v8.30.1 (Docker, `stdin --redact`) on the PR diff: no leaks. The test password is an invented literal |
| 7 | Tests prove what they claim | | ❌ (Major) | QLT-01: the fit is not tested. P-WRAP survived. Confirmed below |
| 8 | Keyboard reach (AC-5) | | ⚠️ | QLT-02: only the own row's Edit is ever tabbed to |
| 9 | Gap rule (AC-2, DL-122 condition B) | | ⚠️ | QLT-03: P-GAP survived. The 156 px width check reads 156 whatever the prop |
| 10 | Cost (RISK-023) | | ⚠️ | QLT-04: SCR-14 cases are about 2.1 times SCR-11's (5.13 s against 2.40 s on the head run). Of the excess, about 10 s per run is axe (required) and about 20 s is avoidable. DL-144 left 6 s of margin to the item 9 line |
| 11 | Test names cite AC IDs (`CLAUDE.md` §6 rule 3) | | ⚠️ | The 11 SCR-14 width cases inherit the describe title "… (DEF-021)" and cite no AQP-245 AC. The card case cites AC-4. Master's hygiene check on the narrow route; it is not in the report |
| 12 | Merge path clear | | ❌ | QLT-05, confirmed below: a real conflict with #195 |

**What master checked beyond the report**
- **QLT-01 is real.** Line 251 is `expect(scrollLeft).toBe(0)`, the only step 1 fit assertion. `longName` builds a name of exactly 120 letters with no space. Without `[overflow-wrap:anywhere]`, the name column grows and the table overflows. The sticky Actions column still keeps every button inside the region, and `horizontalOverflow` reads the page, not the region. So nothing fails, as run 42980091871 shows.
- **QLT-02 is real.** `user-repository.ts:217` orders by `isActive desc, role asc, …`. With one Admin, the own row is always first, so `enabled` is 1.
- **QLT-05 is a real conflict.** #195's hunks in the spec (`@@ -4`, `-28`, `-57`, `-103`, `-127`, `-140`) overlap #222's (`@@ -2`, `-20`, `-35`, `-48`, `-57`, `-98`, `-108`, `-123`). #222 makes `rowSelector`, `nameLength` and `firstAction` required on `Screen`, and #195's Treatment / Color entry has none of them, so the merged file would fail type-check. #195 also changes `expectActionsInside`'s call shape and the Tab pattern (`rename`).
- **The fit check should cover every screen.** QA's G7-1 (`aqp-234-qa.spec.ts:158`) is the only `scrollWidth <= clientWidth` check for SCR-11 and SCR-13, and #137 step 1 would delete it.

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #222, the same two files (spec changes only, unless a test exposes a real defect, which comes back to master) | **QLT-01:** in step 1, for every screen, assert `scrollWidth - clientWidth <= 0` as drawn, with no tolerance. **QLT-02:** the Tab loop runs on the long-name row, asserts it has 3 enabled buttons, and reaches Edit, Reset password and Deactivate in that order, with today's four checks each. **QLT-03:** as drawn, the gap between adjacent row buttons is 8 px (within 0.5 px) on every screen whose rows have two or more buttons. The 156 px check stays, relabelled to what it proves. **QLT-04:** filler users only for the number missing to reach six, inside each test (no shared state, no order dependence). The own row's DOM checks run as drawn only, and its position checks stay at all three points. axe stays at 768, 1024 and 1366 px. The instance count stays 12. Post the SCR-14 and SCR-11 per-case means from the shard-3 log. **Titles:** the SCR-14 cases cite AQP-245 AC IDs, in #195's STD-15 form. **Dev Record:** round-2 rows | Before the re-review |
| B | orchestrator → developer | PR #222, merge commit | After #195 is squashed and its push run is green: update #222 from `master` by a merge commit (no rebase, no force-push), resolving the spec by hand as DL-147 (4)(b) says. Counts as DL-147 (4)(d) | Before the re-review |
| C | reviewer-quality | PR review and `docs/06-reviews/AQP-245/quality.md` round 2 | Re-review the new diff only (A plus the merge resolution), with plants P-WRAP (Users and SCR-11), P-GAP and P-TAB red as DL-147 (5) says. The #224 form only if `expectThreeButtonColumn` changed | After A and B |
| D | qa-engineer | `docs/07-qa/AQP-245-test-report.md` in PR #222 | The G7 route in DL-147 (6) | G7 |
| E | orchestrator | Jira AQP-245, PR #222 | Move AQP-245 to Changes Requested (In Progress) by transition. Swap the PR label to the G6 changes state. Merge as DL-147 (7) after G7 GO | Now / after G7 |
| F | qa-engineer | GitHub #137 | Step 1 (deleting G7-1) waits until #222 has merged with the per-screen fit check. If #222 has not merged by G8, G7-1 stays | Before #137's PR |
| G | orchestrator → delivery lead | branches `plant/AQP-245-no-action-buttons` and `-2` | Delete them with "Delete branch" on #223 and #224 (GitHub can restore them). They hold neither G7 nor the merge | Before G8 |

**Merge order:** **#195 first, then #222.** #195's route is unchanged (DL-144 (6), DL-145 (4)(e), DL-146 (4)(h)). `master` holds none of #222's changes, so #195 merges with its files unchanged. #222 takes the conflict inside the round it needs anyway. The developer resolves it, reviewer-quality reads it in the re-review, and master reads it again at G7. If #195's G7 is NO-GO, or it has not merged when #222 is otherwise ready, the orchestrator comes back to master. The order is not swapped without a ruling.
**Accepted (Info):** QLT-07 (`#225` joins the #119 refactor PR at #119's due point, owner developer), QLT-08.
**Risks:** none new. RISK-023: the 12 instances are stated (AC-6). The final head's path is posted, and a reading of 5:30 or more starts an item 9 median of five on that head (not a hold, DL-142 (1)).
**Rationale:**
- Every mandatory item passes on 72d92e9, and the product code is correct. The Major is a test that cannot fail, which master reproduced from the plant run. Under the procedure that is CONDITIONAL GO with a fix round, not NO-GO (DL-142).
- The Minors are bundled into the round that is already required (DL-130, DL-144).
- #195 goes first because its judged head must merge unchanged, while #222 needs a new head anyway.
**Posted:** Jira AQP-245 comment 11462; PR #222 comment 6790381689.

## G7 – QA Acceptance — AQP-130 (STORY-02.05 Treatment / Color list, PR #195) — 2026-11-11 (attempt 1)

- **Decision:** **GO.** The code is 6dd89b7 (G6 head 1f978b2 plus two test-only commits read by master), and the QA records are at 1528f7a. AQP-130 moves to Done (qa-engineer). PR #195 merges under `CLAUDE.md` §8 on the DL-148 (4) steps, which replace the count targets of DL-144 (6)(e), DL-145 (4)(e) and DL-146 (4)(h).
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-130-test-report.md` (1528f7a): ACCEPT, AC-1 to AC-8 pass, 0 defects. Evidence `docs/07-qa/AQP-130-evidence/` (12 text files, 74,519 bytes, measured with `git ls-tree -r -l`). Acceptance file `tests/acceptance/aqp-130-treatments.test.ts` (106 tests, run in CI stage 11). `docs/07-qa/test-plan.md` 0.2.4 (the evidence path wording, as DL-135 (1) asked).
  - **Commits after G6, read in full (DL-047, DL-144 (3); test strategy v0.33 §10.5 item 10, architect comment 11446):**
    - eb61fa0: the four named test files only. Describe and test titles cite AC and NFR IDs, the finding IDs move to header comments, and `defined()` replaces `?.id ?? ''` (STD-16). No `it` is added or removed.
    - 6dd89b7: the three ruled files only. I extracted the 22 removed lines of the "(e)" test from `treatments-focus.spec.ts` and the 22 added lines in `masters-table-actions.spec.ts`, and they are identical. `actionsOf` moved verbatim into `support/treatments.ts`. The one extra change, the unused `Locator` import, is needed for lint and is recorded as a deviation in the round-3 Dev Record, which also names the move.
    - CI 42951532964 on eb61fa0 was red only at `own-width-files.test.ts:80` (AQP-244's guard, once the merge ref took 1d37902). 6dd89b7 is the ruled fix, and the guard is green from there on.
  - **My own checks** (CI logs and the jobs API, git, Gitleaks):
    - **CI 42983928247** on 1528f7a, merge ref 3f0c129 (1528f7a into 225a1c9): 5 of 5 `success`, with `Stages 1 to 11` read from the jobs API; path **4:51** (08:02:48Z to 08:07:39Z). Vitest **2,908** and **5,231**; E2E **265 / 263 / 250 = 778** passed, 3 / 4 / 17 skipped. I read all 34 `flaky` / `failed` / retry matches: passing test titles that contain "failed", the two known branch names, the expected Postgres auth line and the `failed=` fan-in script. No `✘` and no retry line.
    - **Counts against each run's own `master`:**

      | Head (`master` in the merge ref) | Vitest stage 6 | Vitest stage 11 | E2E passed | E2E skipped |
      |---|---|---|---|---|
      | 1f978b2 (41848eb, push run 42874256994: 2,785 / 4,903 / 674 / 131) | +109 | +208 | +104 | +25 |
      | eb61fa0 (1d37902, push run 42945910485: 2,793 / 4,911 / 674 / 23) | (stage 6 red on the guard) | n/a | +104 | +3 |
      | 6dd89b7 (225a1c9, push run 42975598629: 2,799 / 4,917 / 674 / 23) | +109 | +208 | +104 | +1 |
      | 1528f7a (225a1c9) | +109 | **+314** (208 + 106) | +104 | +1 |

      The passed counts do not change across the two commits. The move removed exactly the two non-desktop skip entries, as the architect said. The earlier +25 fell with AQP-244's own-width listing. QA's file adds exactly 106 to stage 11.
    - **Scope:** 1f978b2..1528f7a has 21 files. After 6dd89b7, everything is under `docs/07-qa/` except the acceptance test. Nothing under `src/`, `tests/e2e`, `prisma/`, `.github/` or the package files changed after G6. The PR holds 69 files in all (GitHub and `git diff --name-only origin/master...1528f7a` agree), 29 of them under `src/` or `prisma/`.
    - **Gitleaks v8.30.1** on `git diff 1f978b2 1528f7a`: no leaks. A grep of the evidence for local paths and personal data finds none (the repository name, and a note that a master-data file was *not* opened, are the only matches).
    - **Controls:** I printed each plant diff (one line each, against 195eecf) and read each failed list from CI:
      - #228: `if (mine !== newest.current) return;` removed. Exactly `treatments-focus.spec.ts:213` "the latest read wins (AC-1, AC-8)" fails at mobile, tablet and desktop, 1 failed per shard (264 / 262 / 249 passed).
      - #229, #230 and #231 each skip one audit write behind `if (Date.now() < 0)`. They fail 2, 3 and 3 unit tests (stage 6 stops before stage 11), each only about its own event.
      - QA's committed local outputs show its acceptance file failing 3, 3 and 2 tests under the same plants (9, 8 and 7 of 173 with the developer's files). The clean control is 173 of 173.
    - **Not re-run by master:** QA's local acceptance runs and the browser probe (#232, run 42982426395, 33 of 33). I read the probe only through QA's committed output.
  - **Jira:** QA hand-off 11464, orchestrator brief 11467, architect ruling 11446, developer hand-offs 11440 and 11454. PR #195 body: Dev Record round 3. PR #195 QA comment 6790641898.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC verified with evidence | ✱ | ✅ | QA report matrix AC-1 to AC-8. AC-6 is verified on the amended text (one entry per add, rename and delete; none for a refusal, a same-canonical rename, a read, a refused caller or a late failure). DL-144 (5) checklist 11 of 11 |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | none against AQP-130. DEF-028 closed with #216 (225a1c9) |
| 3 | Regression recorded and green | ✱ | ✅ | CI 42983928247, 5 of 5, path 4:51, counts above |
| 4 | Exploratory testing notes | | ✅ | a 90-minute charter, with areas and findings in the report |
| 5 | Accessibility checks for the UI | | ✅ | axe (wcag2a to wcag22aa) 0 at 3 widths in every state; 44 px; keyboard add, rename and delete; the alertdialog focus cycle |
| 6 | Post-G6 commits within the named files, test-only, counts unchanged | | ✅ | eb61fa0 (4 files), 6dd89b7 (3 files, move identical); table above |
| 7 | One planted fault per promised case (DL-107) | | ✅ | the latest-read guard, plus each of the three audit events |
| 8 | NFR-009 first-load JS | | ✅ | `/masters/materials` 187,566 B of 200,000 B (+451 B against AQP-123, under the +1,500 B tripwire) |
| 9 | Evidence fit to commit | | ✅ | text only, no secret, local path or personal data |

**Observations routed**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| OBS-1 | scrum-master | STORY-02.06 Dev Context (backlog row 31; no Jira story yet) | `listTreatmentOptions` returns the hidden "Not applicable" entry, as architecture v0.35 §6 (Safe options) states. AQP-130's options tests (QA's AC-1 and AC-5 cases, the developer's AC-5 test and the route comment) change in the same PR to expect it | before 02.06 is Ready |
| OBS-1 | solution-architect | `architecture.md` §6 | one sentence: the hidden entry joins the options route in STORY-02.06 | next architecture change |
| OBS-2 | developer (scrum-master names it in the Dev Context) | GitHub #202 (database guard on "Other") | the trigger of architecture v0.35 §5.1 | STORY-02.06's G6. If 02.06 is not in the release G8 judges, #202 is listed as open at that G8 |
| OBS-3 | developer | #218 (QLT-11) | unchanged (DL-144 (3)) | before AQP-142's G6, at the latest G8 |

**Merge (orchestrator, §8), DL-148 (4):**
- (a) The records docs PR holding DL-148 merges first. #216 has merged (225a1c9), so DL-144 (6)(c) is met. #222 must not merge before #195 (DL-147 (4)). #220 may merge before or after.
- (b) #195 is updated from `master` by a merge commit only (no rebase, no force-push). None of the PR's 69 files changes against 1528f7a. A conflict comes back to master.
- (c) **Invariant:** each count on the updated head = run 42983928247 − push run 42975598629 (225a1c9) + the `master` push run taken. That is Vitest +109 and +314, E2E passed +104 and skipped +1 over the push run taken.
  - With only docs PRs merged since 225a1c9: **Vitest 2,908 and 5,231; E2E 778 passed, 24 skipped.**
  - With #220 merged first (DL-146 predicts 2,805 and 4,923 Vitest and 674 E2E at its push run): **Vitest 2,914 and 5,237; E2E 778 passed**; skipped is that push run's + 1. If the push run differs from the prediction, the target is recomputed from it and the arithmetic is posted.
  - Per-shard splits are reported only. Any other code PR in between comes back to master.
- (d) 5 of 5, with `Stages 1 to 11` read from the jobs API and no failed or retried test (read the matched lines). DEF-028 is closed, so any red is a finding. A red comes back to master and is not re-run.
- (e) Head, run, commits taken, counts with the arithmetic, and path are posted on #195 and AQP-130 before the squash. A path of 5:30 or more is an item 9 reading, not a hold (DL-142 (1)).
- (f) Squash, with the QA evidence and the acceptance test (DL-135 (1)).
- (g) Then DL-144 (4) applies (the first `master` push run's path on AQP-1; a first attempt of 5:30 or more starts a median of five; a red comes back to master). Then #222 per DL-147 (4)(b).

**Branches:** `control/AQP-130-g7-*` (five: no-latest-read-guard, no-audit-created, no-audit-edited, no-audit-deleted, qa-probe; PRs #228 to #232, closed unmerged). The delivery lead deletes them with "Delete branch" on each PR, which GitHub can restore, as at DL-146 (5). The plant diffs, the outputs and the probe source are committed in the evidence, so the branches hold neither G7 nor the merge.

**Risks:** none new. RISK-023 is unchanged at 4: the G7 run reads 4:51, and the G6 median of five was 5:24 (DL-144 (2)). RISK-015's residual (no real phone or screen reader) stands for G8.
**Rationale:**
- Every mandatory item holds on the code that passed G6, plus two test-only commits that I read line by line.
- Each promised audit case has its own plant that fails only its own tests, and the latest-read guard bites at three widths.
- The new targets are needed because QA's file adds 106 to stage 11, and the G7 run's merge ref already holds 225a1c9. The base to subtract is therefore 225a1c9's push run (DL-147: a PR run counts the current `master`).
**Posted:** Jira AQP-130 comment 11469; PR #195 comment 6790872246; GitHub #202 comment 6790874154 (owner and due point).

## G7 – QA Acceptance (narrow route) — AQP-236 (DEF-022 fix, PR #220: each Playwright listing gets its own cache folder) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-149).** The code is 5ebe3b2 (G6 head ddf6191 plus the condition A commit, read by master with no review round under DL-047), and the QA records are at bdd9a7d. Every mandatory item passes. The open items are record gaps only: the Dev Record does not yet show condition A's plant row in full, and its Gates line names the old loop (condition 1), and DEF-022's record still needs its rows (condition 2). AQP-236 moves to Done (qa-engineer). PR #220 merges under `CLAUDE.md` §8 on the DL-149 (4) steps, which confirm DL-146 (4)(c) for the current `master` and add the order with #195.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-236-test-report.md` and `docs/07-qa/AQP-236-evidence/` (8 text files, 32,649 bytes measured with `git ls-tree -r -l`), commit bdd9a7d: ACCEPT. bdd9a7d changes only `docs/07-qa/` (checked with `git diff --name-only 5ebe3b2 bdd9a7d`). QA hand-off: Jira 11471, PR #220 comment 6791506329.
  - **Condition A commit 5ebe3b2, read in full (DL-146 (2)):** 2 files, +35 / -16.
    - `tests/unit/playwright-list.test.ts`: QLT-01 (both removal tests record `existsSync` inside the fake listing and assert `true` before asserting removal). QLT-02 (the caller-override test asserts all four things that were ruled: not the caller's folder; `basename` matches `^accucut-playwright-list-[A-Za-z0-9]{6}$`, anchored; existed during the listing; gone after). QLT-05 (`allStarted`). The second describe title gets the `AQP-236 (DEF-022): ` prefix. The two removal tests also get a title suffix, "(it existed while the listing ran)". That is a rename, not a new test, and it states what QLT-01 added. No `it` is added or removed. The removed `expect(folder).not.toBe('')` is covered, because `existsSync('')` is false.
    - `tests/support/playwright-list.ts`: only lines inside the header block comment and the `finally` comment change. QLT-03 now names the unchecked `.map` source map, and says the compiled `.js` has a SHA-1 header. QLT-04 drops "which the system clears". No code line changes.
  - **Developer hand-off:** Jira 11461. Dev Record in the PR #220 body.
  - **My own checks** (jobs API, CI logs, git):
    - **Every run on the branch** (`gh run list --branch fix/AQP-236-list-cache-race`): three runs. 42951199191 (ddf6191, G6). 42978771784 (5ebe3b2). 42990074348 (bdd9a7d).
    - **42978771784 on 5ebe3b2:** I read all five attempts in the attempts API. Each attempt is 5 of 5 `success` on merge ref 3082557 (5ebe3b2 into 225a1c9). Attempts 2 to 5 re-ran a green run, so no red was re-run away. The paths are 4:00, 4:53, 4:58, 5:19 and 5:13 (median 4:58). In attempts 1 and 5, Vitest is 2,805 and 4,923, and E2E is 231 / 228 / 215 passed with 2 / 4 / 17 skipped.
    - **42990074348 on bdd9a7d (the G7 run):** merge ref 1fd502b (bdd9a7d into 225a1c9). It is 5 of 5 `success`, including `Stages 1 to 11` (08:53:11Z to 08:53:20Z), with a path of **3:58** (08:49:22Z to 08:53:20Z). Vitest is **2,805** and **4,923**. E2E is **231 / 228 / 215 = 674** passed, with 2 / 4 / 17 = 23 skipped. Gitleaks 8.30.1 in stage 2 scanned 604 commits: "no leaks found", and the secret-scan control passed.
    - **Matched lines:** I read every `flaky` / `failed` / retry / `✘` match in both the G7 run and attempt 5. They are the two known branch names in the fetch listing, the expected Postgres auth line, the `failed=` fan-in script, and passing test titles that contain "failed". There is no `✘` and no retry line.
    - **Counts against each run's own `master`:** ddf6191 against 1d37902 (push run 42945910485: 2,793 and 4,911) is +6 and +6. 5ebe3b2 and bdd9a7d against 225a1c9 (push run 42975598629: 2,799 and 4,917, 674 passed, 23 skipped) are +6, +6, +0 and +0. So condition A's "same counts" holds against the `master` in the merge ref. The absolute rise to 2,805 is #216's six `random-members` tests, as the developer explained (DL-147: a PR run counts the current `master`).
    - **QA's figures recomputed** from the committed loop lines. Pair: wall median 21.7 s; slowest `beforeAll` median 15.1 s, max 19.5 s. Nine files: wall median 31.4 s; slowest `beforeAll` median 22.5 s, max 26.9 s. Baseline: 9 of 10 runs exit 1, wall median 22.7 s, slowest `beforeAll` median 15.8 s. All match the report. Every head run shows 16 of 16 or 113 of 113 tests and `leftover-after 0`.
    - **Plant:** `plant-diff.txt` is #221's change applied to the fixed head (index a365d67, which is 5ebe3b2's helper). Alone, it fails the four named tests with the expected messages, and the caller-override test fails on `'accucut-playwright-list-shared-control'` against the anchored pattern. Beside the four listing files, the same four fail, and the real union test fails with the DEF-022 signature (`[ …(688) ]`): 5 failed, 41 passed.
    - **Callers** (`git grep` for the helper and `--list`) on `master` 35531d5, on #195's head 78c44fc and on bdd9a7d: the same four guard files, plus `playwright-config.ts` (comment only), plus the PR's own unit test. No new caller has arrived since G6.
    - **Overlap:** #220's 12 files share no path with `git diff --name-only 1d37902 35531d5` (15 paths) or with #195's 69 files at 78c44fc. Everything on `master` since 225a1c9 is under `docs/`.
    - **`master` 35531d5** (#219, docs only): push run 42990715803 is 5 of 5, with a path of 4:54. Vitest is 2,799 and 4,917, E2E 674 passed, 23 skipped, with no failure marker. Those are the same counts as 225a1c9.
    - **Hygiene:** a grep of the evidence and report for local paths, e-mail addresses, passwords and tokens finds only the repository name. QA ran Gitleaks in Docker on `docs/07-qa`, and CI stage 2 ran it on the merge ref.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every check verified with evidence (DEF-022 has no ACs; the bar is DL-120 and DL-146 (3) (a) to (e)) | ✱ | ✅ | (a) the head is 5ebe3b2, and QA adds only `docs/07-qa/`. (b) The plant fails 4 and passes 2 alone and beside the listing files, and the union test is also red. (c) The pair is 10 of 10 and the nine-file set is 10 of 10, with the same test count every run and 0 folders before or after. (d) The baseline fails 9 of 10, so the probe was not needed. (e) The rows are routed to the records PR. The DEF-022 repro set (six files) is inside the nine |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | none. DEF-022 (Sev-3) is fixed by this PR |
| 3 | Regression recorded and green | ✱ | ✅ | CI 42990074348, 5 of 5, path 3:58, counts above. The code head's run 42978771784 is green in all five attempts |
| 4 | Exploratory notes | | ✅ | the report's charter: plant fidelity, with the anchor check biting on CRLF, the real guard under the plant, and the QLT-06 variable. One forced stop was observed, with no folder left |
| 5 | Accessibility checks | | n/a | test support only, no UI |
| 6 | Condition A commit within the named files and lines | | ✅ | 2 files, the ruled assertions, comment-only helper lines, no `it` added (diff above) |
| 7 | Condition A Dev Record row | | ⚠️ | The PR body's plant row gives 4 failed and 2 passed for the file alone, without the printed diff and without the run beside the four listing files. The Gates G7 line still says "six-file cold loop". QA's independent plant covers the substance (diff printed, alone and beside), so this is a record gap: condition 1 |
| 8 | Runs counted honestly | | ✅ | QA discarded every run from the overlap period (all green) and the two smoke runs, and redid the 30 counted runs on a quiet machine. No failure was re-run away. The 9 baseline failures are all reported |
| 9 | Cost within limits (DL-057 class) | | ✅ | The worst `beforeAll` is 26.9 s against 100 s (listing) and 120 s (hook). Cold per listing adds about 7 s at the median on this host. E2E is unchanged, so RISK-023 is not affected |
| 10 | Evidence fit to commit | | ✅ | text only. The scratch path is replaced by `<qa-scratch>`. No secret or personal data |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #220 body (Dev Record) | The Gates G7 line names the condition B loops: pair 10 of 10, nine-file set 10 of 10, baseline 9 of 10 failed. The plant row adds that QA's plant was run alone and beside the four listing files, with the diff printed, and links `docs/07-qa/AQP-236-evidence/plant-diff.txt` and `plant-beside-results.txt`. Body text only, with no commit. The orchestrator checks it as merge step (a) | Before the squash |
| 2 | qa-engineer | `docs/07-qa/defects/DEF-022-cold-cache-listing-race-between-guard-files.md` on records branch `docs/AQP-1-records-sprint1-d` | Fill the Fix & Verification rows with the three rows in the report's "Defects" section, and set the status to match. Add the merge commit row after the squash. Master's write area does not include `docs/07-qa/`, so master does not paste them | This records PR, or the next one if it has merged first |
| 3 | orchestrator → delivery lead | branch `control/AQP-236-shared-cache` | Unchanged from DL-146 (5) / condition D: "Delete branch" on #221. It holds neither G7 nor the merge | Before G8 |

**Merge (orchestrator, §8), DL-149 (4)** (confirms DL-146 (4)(c) for `master` 35531d5 and adds the order with #195):
- (a) Condition 1 is done. The records docs PR holding DL-149 may merge before or after #220 (no shared files). #195 and #220 may merge in either order (no shared files; DL-148 (4)(a)). #222 is not merged before #195 (DL-147 (4)).
- (b) #220 is updated from `master` by a merge commit only (no rebase, no force-push). None of its 12 files changes against bdd9a7d. A conflict comes back to master.
- (c) **Invariant:** each count on the updated head = run 42990074348 − push run 42975598629 (225a1c9) + the `master` push run taken. That is Vitest +6 and +6, E2E passed +0 and skipped +0, over the push run taken.
  - **#220 first** (`master` 35531d5, push run 42990715803: 2,799 / 4,917 / 674 / 23): **Vitest 2,805 and 4,923; E2E 674 passed (231 / 228 / 215 expected, reported only), 23 skipped.**
  - **#195 first** (DL-148 (4)(c) predicts 2,908 / 5,231 / 778 / 24 at its push run): **Vitest 2,914 and 5,237; E2E 778 passed, 24 skipped.** If #195's push run differs from that prediction, the target is recomputed from it and the arithmetic is posted.
  - Either order ends with the second push run at **2,914 / 5,237 / 778 passed / 24 skipped**, which matches DL-148 (4)(c) for the other order.
  - Per-shard splits are reported only. Any other code PR in between comes back to master.
- (d) 5 of 5, with `Stages 1 to 11` read from the jobs API and no failed or retried test (read the matched lines). Any red, including a listing or hook timeout, comes back to master and is not re-run.
- (e) Head, run, commits taken, counts with the arithmetic, and path are posted on #220 and AQP-236 before the squash. A path of 5:30 or more is a test strategy item 9 reading, not a hold (DL-142 (1)).
- (f) Squash, with the QA report and evidence. There is no "Closes #129", so the orchestrator closes #129 as completed with the merge commit (DL-146 (4)(f)).
- (g) The `master` push run after the squash is posted on #220 and AQP-236. A red comes back to master.

**Risks:** none new. RISK-023 is unaffected: there is no E2E change, the G7 run reads 3:58, and the five code-head attempts have a median of 4:58. Residuals carried to G8: CI cannot show the race (the evidence is the Windows loops plus the plant-red unit test), and a force-killed listing can leave a `%TEMP%` folder (QLT-04, accepted at DL-146).
**Rationale:**
- Every mandatory item holds on the head that passed G6 plus one commit that I read line by line. The plant is independent of the developer and bites both in the unit test and in the real guard. The before/after loops (9 of 10 failed against 0 of 20) show that the loop can see the race and that the fix removes it.
- CONDITIONAL GO, not GO, because the Dev Record (the system of record for the fix, §7.1) misstates the loop and leaves out the "beside" plant run that DL-146 (2) asked for. Correcting it is a body edit before the squash, with no user risk. That puts it in the procedure's CONDITIONAL GO class, not NO-GO.
- The DEF-022 rows stay QA's to write (DL-146 (3)(e), write areas). They are not pasted by master.
**Posted:** Jira AQP-236 comment 11473; PR #220 comment 6791687199.

## G6 – Peer Review (two-review route, DL-142 (3)) — tech-debt #119 (PR #235: shared master screen pieces and the material-repository split) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-150).** Both reviews approve with comments, with no Blocker, Critical or Major. One push of three Minors (STD-01 to STD-03, 8 named files, no test file) is re-read by reviewer-standards. QLT-01, STD-04 and STD-06 go to #244. The #119 leftovers (QLT-02 / STD-05) go to #245, and "Closes #119" stays. G7 is decided by master with no QA run, after condition A. AQP-142 may start now outside #235's 52 files, and does not reach G5 before #235 merges.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - PR #235 at b2741ca (7 commits, 52 files, +596 / -586, base ffc280b), body and Dev Record; developer hand-off on #119 (comment 6793392756).
  - `docs/06-reviews/119/standards.md` (review 5857568408), `quality.md` (review 5857625090), `consolidated.md` (records branch 1f5395c).
  - **My own checks** (git, jobs API, CI logs):
    - **Scope:** `git diff --stat ffc280b b2741ca`: 52 files, all under `src/` and `tests/`. No `package.json`, lockfile, `prisma/`, `.github/`, route or audit file.
    - **Read in full:** `use-read-again.ts` and `master-constraints.ts` at b2741ca, and the `engineer-import-rule.test.ts` diff (+2 lines in `REPOSITORIES.blocked`; `FUTURE_IMPORTS` still lists `material-repository`, as STD-06 says).
    - **Every run on the branch** (`gh run list --branch tech-debt/119-shared-master-pieces`): one, 43002218101, on merge ref 352e161 (b2741ca into ffc280b). 5 of 5; path **5:22** (322 s); 18 cache hits. Vitest **2,908** and **5,271**; E2E **265 / 263 / 250** passed, skipped 3 / 4 / 17. No flaky or failed summary line.
    - **Counts against base push run 42996054107 (ffc280b):** unit +0, full Vitest +40, E2E +0, skipped +0. The 40 are the generated cases for the two new repository files.
    - **First-load JS** (`check-js-budget` lines in the CI log): `/masters/materials` 186,909, `/masters/process` 174,030, the rest unchanged, all within 200,000.
    - **Plants A1 and A2:** each control head compared with b2741ca (`compare` API). A1 changes only `use-read-again.ts:41` and A2 only line 40, as described. Failed lists from `--log-failed`: A1 is red only in `exchange-rates.spec.ts:383` and `treatments-focus.spec.ts:181,197`; A2 only in `exchange-rates.spec.ts:171,370,383`, 9 each. QLT-01 is confirmed.
    - **Overlap:** `git diff --name-only ffc280b origin/master` (b3403e3) lists 12 paths (`docs/07-qa/`, `tests/support/playwright-list.ts`, two unit tests). None is in #235.
    - **`master` b3403e3:** push run 43004280872, attempt 1: Vitest 2,914 and 5,237, E2E 778 passed, 24 skipped.
  - **Not re-run by me:** the developer's local loop and plants #236 to #238 (read from the Dev Record), reviewer-quality's B1 and B2 runs (read from the report), and reviewer-standards' string-literal script.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present | ✱ | ✅ | Standards and quality, as DL-142 (3) set for this refactor. reviewer-performance is not required: no route, query, schema, dependency or CI change; JS and path measured above. A recorded exception to "three reports", as at DL-124 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in both reports and in the consolidated table |
| 3 | Major findings fixed or accepted | | ✅ | none raised |
| 4 | Findings cite file:line | | ✅ | every STD and QLT row |
| 5 | Behaviour preserved | | ✅ | Strings unchanged (standards script). Moved code verbatim. Four hook copies equivalent (quality table). Counts unchanged apart from the explained +40. Plants #236 to #238, A1, A2, B1 and B2 red |
| 6 | Regression net covers the shared hook on every screen | | ⚠️ | No: Process and Materials both branches, Treatments ready branch (QLT-01, A1 and A2 confirmed by me) → #244 |
| 7 | #119 items done, or leftovers owned | | ⚠️ | DL-142 (3) items done. Leftovers unowned (QLT-02, STD-05) → #245 and a PR body line |
| 8 | New shared files follow the standards | | ⚠️ | STD-01 to STD-03 → condition A |
| 9 | Other-role documents | | ⚠️ | STD-07, the test-strategy total, QLT-13 (missed due point, re-set) → architect; ux-spec:853 → ux-expert |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer, then reviewer-standards | PR #235: one commit, 8 named files | STD-01, STD-02, STD-03 as in DL-150 (3). Same count deltas. Round-2 Dev Record row. reviewer-standards re-reads the push diff only; reviewer-quality also reads if the push leaves the stated scope | Before master's G7 |
| B | developer | PR #235 body | The out-of-scope line naming #245, #244 under Follow-ups (DL-150 (5)) | Before the squash |
| C | developer, reviewer-quality | #244 | Slow-read focus tests with A1 and A2 re-planted by the reviewer; STD-04; STD-06 | Before AQP-142's G6, at the latest G8 |
| D | developer | #245 | `useMasterList`, loader wiring, `MasterSearchBox` on Process, `RUPEE`, Users copies; no copy of a list hook meanwhile | Before G8, or the G5 of the first story that would copy a list hook |
| E | solution-architect | architecture §4.9, §6; test strategy §10 | STD-07 wording; the Vitest total; QLT-13 scope (DL-144 (3)) | Next change, at the latest before AQP-142's G6 |
| F | ux-expert | `ux-spec.md:853` | `process-texts.ts` → `master-texts.ts` | Next change, at the latest before AQP-142's G6 |
| G | scrum-master (with the solution-architect) | Jira AQP-142 Dev Context | The DL-150 (8) items, including where Customers' repository methods live | Before AQP-142's T1 |
| H | orchestrator → delivery lead | branches `control/119-qlt-plant-*` (5) | Delete | Before G8; does not hold the merge |

**G7 route and merge:** DL-150 (7) and (9). Invariant for `master` b3403e3: Vitest **2,914** and **5,277**, E2E **778** passed and **24** skipped; for another `master`, its push run plus +0 / +40 / +0 / +0.
**Risks:** none new from this PR. RISK-023 is re-scored separately (DL-151), and #235 is not its cause (+0 E2E, path 5:22).
**Rationale:** every mandatory item holds, and the open items are Minor. STD-01 to STD-03 are fixed before AQP-142 copies the new shared hook. QLT-01 cannot go in a PR that must keep its tests unchanged. Its tests, written after the merge, still detect a regression from #235 before AQP-142's G6. Until #244 merges, focus return on Process and Materials rests on reviewer-quality's equivalence table.
**Posted:** PR #235 comment 6794325811; GitHub #119 comment 6794328843; Jira AQP-142 comment 11483. Issues created: #244, #245.

## Risk re-score — RISK-023 (CI path), `master` b3403e3 — 2026-11-11

- **Decision:** **RISK-023 rises, P 2 → 4, score 4 → 8 🟡, by the register's rule (DL-151).**
- **Decided by:** master  ·  **Human override:** none
- **Evidence (recomputed by master):** run 43004280872, attempts 1 to 5, from the attempts API: paths 334, 323, 335, 334 and 284 s. **Median 5:34**, slowest 5:35. Each attempt: 5 of 5 `success`, 18 cache restores and no miss, no flaky or failed summary line, E2E 265 / 263 / 250 passed.
- **Rule:** DL-143 (2): rises to 8 when a median of five on a `master` head is 5:30 or more.
- **Next step:** the fourth-shard gate (a `master` median of five and the next nightly median both over 5:00) is half met. The orchestrator posts the next nightly; the solution-architect and the product-manager act as in DL-151 (3). Not a hold. Master recommends the enabler before AQP-142's G6.
- **Posted:** Jira AQP-1 comment 11484.

## G6 – Peer Review (close) — tech-debt #119 (PR #235: shared master screen pieces and the material-repository split) — 2026-11-11 (attempt 1, closed at 07b47b7)

- **Decision:** **CONDITIONAL GO, closed with no further round (DL-152).** Condition A is met in one commit, 07b47b7, which touches the 8 named files and no test file. reviewer-standards re-read the push diff only and approves, with no new finding. The trigger for a reviewer-quality read is not met. Condition B is met in substance, and one contradicting body bullet is carried to G7 as a pre-squash condition.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - PR #235 at 07b47b7 (8 commits, 52 files against ffc280b, +605 / -595). Developer hand-off: #119 comment 6794560477, Jira AQP-142 comment 11488.
  - `docs/06-reviews/119/standards.md` "Round 2" (records branch 93f35d5). PR review 5858014815: APPROVE, STD-01 to STD-03 Fixed, STD-04 deferred to #244 (DL-150 (4)), no new finding. Thread replies are in reviews 5857963760 to 5858012438. No review requests changes. Labels: `review:standards-approved`, `review:quality-approved`.
  - **My own checks** (git, jobs API, CI log):
    - **Diff `b2741ca..07b47b7`, read in full:** 1 commit, 8 files, +21 / -21, exactly the files DL-150 (3) named. No file under `tests/`.
      - STD-01: the four status unions are `= ReadStatus`, and `useTreatmentList(opener: OpenerRef)`.
      - STD-02: three comments are reworded, and `MATERIAL_TEXT_MAX_LENGTH = MASTER_NAME_MAX_LENGTH` (both 100; its users are `materials.ts:68` and `schemas/materials.ts:30,36`).
      - STD-03: `shouldFocusWhenFailed?: boolean | undefined`.
    - **Scope trigger for reviewer-quality:** I mapped `shouldFocusWhenFailed` back to `whenFailed` in `use-read-again.ts` at 07b47b7 and compared the result with b2741ca: they are identical. `git grep whenFailed` at 07b47b7 finds no leftover. The only changed runtime expression in the push is the alias. So the trigger is not met, and the plants (#236 to #238; A1, A2, B1, B2) stand on unchanged logic.
  - **Not re-run by me:** reviewer-standards' local ESLint on the 8 files (CI stages 1 to 11b lint and type-check are green).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present | ✱ | ✅ | Standards rounds 1 and 2, quality round 1 (DL-142 (3) route; DL-150 (3) asked only for standards on the push) |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | Round 2 reports 0 new findings. Round 1 had none |
| 3 | Major findings fixed or accepted | | ✅ | none raised |
| 4 | Condition A within the named files and lines | | ✅ | 8 files, no test file. Reverse-rename check identical |
| 5 | Condition B (PR body) | | ⚠️ | "Closes #119" is on line 5. The out-of-scope line naming #245 is on line 10, under "What & why", not under "Decisions & deviations". I accept that placement because it is read first. #244 is under Follow-ups. One Follow-ups bullet still says the Users copies "belong with PR #222 or a later tech-debt item", which is against DL-150 (5) → G7 condition 1 |
| 6 | Round-2 Dev Record row | | ✅ | Body rows for STD-01, STD-02 and STD-03 with 07b47b7, plus the "exactly 8 files" line |

**Conditions:** none new at G6. B's remaining bullet is G7 condition 1.
**Risks:** none new.
**Rationale:** the push is the ruled fix, in the ruled files, re-read by the ruled reviewer, and the quality trigger is shown not to be met by a mechanical check. A further round would add nothing.
**Posted:** with the G7 record below.

## G7 – QA Acceptance (master, no QA run; DL-150 (7), DL-124 pattern) — tech-debt #119 (PR #235 at 07b47b7) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-152).** All three G7 tests in DL-150 (7) hold on evidence I read. The open item is one PR-body bullet, which is edited before the squash without a commit. #235 merges under `CLAUDE.md` §8 on the DL-152 (6) steps. The invariant on b3403e3 is **2,914 / 5,277 / 778 passed / 24 skipped**.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:** the G6 close evidence above; PR #235 body; CI run 43011060504 (jobs API and full log); `master` push run 43004280872; Jira JQL for open Bugs.
  - **Every run on the branch** (`gh run list --branch tech-debt/119-shared-master-pieces`): 43002218101 (b2741ca, G6) and **43011060504** (07b47b7), each with one attempt.
  - **43011060504:** merge ref **5235dc8** (07b47b7 into b3403e3, read in every job's "HEAD is now at" line), tree 7eda7ef.
    - 5 of 5 `success`. `Stages 1 to 11` ran from 11:25:23Z to 11:25:34Z (jobs API).
    - Path **5:33** (333 s from 11:20:01Z). The slowest shard is 3 (ended 11:25:20Z).
    - Unit: 151 files, **2,914**. Full Vitest: 210 files, **5,277**.
    - E2E: **265 / 263 / 250 = 778** passed, with skipped 3 / 4 / 17 = **24**.
    - 18 `Cache restored from key` lines and no `Cache not found`.
    - Gitleaks 8.30.1 scanned 629 commits and found no leaks.
    - First-load JS: `/masters/materials` 186,951 and `/masters/process` 174,037, both within 200,000.
  - **Matched lines read:**
    - Branch names in the fetch listing: `fix/AQP-268-flaky-g7-7`, `fix/AQP-272-flaky-aqp-122-qa-tablet` and `control/119-qlt-plant-a1-failed-read-focus`.
    - The expected Postgres auth line.
    - The `failed=` fan-in script.
    - Three `Failed to save: Unable to reserve cache` lines. These are a cache key that another shard had already saved, not a test result.
    - Passing (`✓`) titles that contain "failed".
    - There is no `✘`, no retry line and no flaky or failed summary.
  - **Counts against the `master` in the merge ref** (push run 43004280872 on b3403e3: 2,914 / 5,237 / 778 / 24): unit +0, full Vitest +40, E2E passed +0, skipped +0. That is exactly DL-150 (3).
  - **Overlap:** `git diff --name-only ffc280b b3403e3` gives 12 paths. None is among #235's 52 files. `origin/master` is still b3403e3.
  - **Defects:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every acceptance item verified with evidence (no AC; the bar is DL-150 (7) (a) to (c)) | ✱ | ✅ | (a) Condition A is in the 8 files, and the standards re-read has no Blocker, Critical or Major. (b) CI 43011060504 is 5 of 5 with the ruled deltas, and the matched lines are read. (c) The plants stand, because `use-read-again.ts` logic is identical and no test changed |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | JQL: none |
| 3 | Regression recorded and green | ✱ | ✅ | 43011060504 as above |
| 4 | Exploratory notes | | n/a | No user-visible change by design (DL-150, "Why no QA G7") |
| 5 | Accessibility checks | | ✅ | The axe checks inside the E2E suite are green at three widths. No markup change in the push |
| 6 | CI path | | ✅ | 5:33 is an item 9 reading, not a hold (DL-142 (1)). No median of five is ordered: +0 E2E on the `master` already measured at 5:34 (DL-151), and its consequences are already in force |
| 7 | PR body (Dev Record of record, §7.1) | | ⚠️ | The Follow-ups bullet on the Users copies contradicts DL-150 (5) → condition 1 |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| 1 | developer | PR #235 body, "Follow-ups and issues for other roles" | The bullet "A Users-screen copy of `opener.ts` and the Users load-error remain; they belong with PR #222 or a later tech-debt item" says instead that they moved to #245 (item 5). Body text only, no commit. The orchestrator checks it as merge step (a) | Before the squash |

The DL-150 conditions C (#244), D (#245), E and F (committed at b84b9b4 and 0c628dc), G (Q3 now ruled, DL-153) and H are unchanged. STD-02's cosmetic double parentheses (`materials.ts:10-11`) are accepted. They are fixed at the next change to that file, with no issue opened.

**Merge (orchestrator, `CLAUDE.md` §8), DL-152 (6), final:**
- (a) The records docs PR from `docs/AQP-1-records-sprint1-d` (DL-150 to DL-153; not yet opened) merges first, and condition 1 is done.
- (b) #235 is updated from `master` by a merge commit only. GitHub "Update branch" is fine.
  - None of its 52 files changes against 07b47b7.
  - If `master` is still b3403e3, the new head's tree should be **7eda7ef**, which CI already ran.
  - If another PR merges first, the orchestrator re-checks the overlap, and a conflict in a #235 file comes back to master.
- (c) **Invariant:** each count on the updated head = the push run of the `master` it takes, plus unit +0, full Vitest +40, E2E passed +0 and skipped +0.
  - On b3403e3 (43004280872) that is **2,914 / 5,277 / 778 passed / 24 skipped**.
  - On any other `master`, it is recomputed and the arithmetic is posted.
- (d) 5 of 5, with `Stages 1 to 11` read from the jobs API and no failed, flaky or retried test (matched lines read). A red comes back to master and is not re-run.
- (e) The head, run, commits taken, counts with the arithmetic, and path are posted on PR #235 and AQP-142 before the squash. A path of 5:30 or more is reported, not held.
- (f) Squash, after the delivery lead's click on the merge prompt. #119 closes through "Closes #119". If it does not, the orchestrator closes it as completed with the merge commit.
- (g) The `master` push run after the squash is posted. A red comes back to master.
- **Order:** #235 before #218's PR; #222 in either order (no shared files).

**Risks:** none new. RISK-023 stays at 8 (DL-151). This run's 5:33 is consistent with the 5:34 median on the same `master`, and #235 adds no E2E test.
**Rationale:**
- DL-150 (7) set the route and its three tests in advance, and each one is met on evidence I read myself.
- A QA run would execute the same suite on the same tree, with no AC to verify.
- I chose CONDITIONAL GO over GO for one reason, as at DL-149: the PR body is the system of record, and one bullet points the Users copies away from #245.
**Posted:** PR #235 comment 6794781032; GitHub #119 comment 6794781647; Jira AQP-142 comment 11494 (with the DL-153 Q3 ruling); GitHub #245 comment 6794788810 (DL-153).

## G6 – Peer Review (narrow route, DL-144 (3)) — tech-debt #218 (QLT-11, PR #247: the audit writer checks each master state against its own `object_type`) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-154).** reviewer-quality approves with comments and raises no Blocker, Critical or Major. QLT-01 and QLT-02 (Minor) are fixed in this PR in one push to two named files (condition A). reviewer-quality re-reads that push and re-plants P1 to P3. QLT-03 is accepted: refusing an unknown or unnamed master type is a correct behaviour change, not a G12 weakening. The architect adds one sentence to §8. After condition A, G6 closes and master decides G7 with no QA run.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - PR #247 at d833f47 (1 commit, 3 files, +162 / -17, base b3403e3), its body and Dev Record. Developer hand-off: #218 comment 6795158226.
  - `docs/06-reviews/218/quality.md` (records branch d282d4f) and PR review 5858735404 (COMMENTED, verdict APPROVE WITH COMMENTS). Label `review:quality-approved`. reviewer-quality hand-off: #218 comment 6795968912 and Jira AQP-142 11501. Orchestrator brief: Jira AQP-142 11497.
  - **My own checks** (git, compare API, jobs API, CI logs):
    - **Diff `b3403e3..d833f47`, read in full.**
      - `audit-events.ts`: `MASTER_SHAPES` (4 masters), a `Map` lookup, `schemasFor` and `forMasterShape` on `master.created`, `master.edited` and `master.deleted`, and `StoredShape = z.ZodType<JsonValue>`.
      - `audit-service.ts`: `record` uses `schemasFor(objectType)`, and null refuses with `shape` at `objectType`. The shape is still checked before the secret scan, as before.
      - Test: 7 new tests, plus one changed test (the unnamed type).
    - **Scope:** no config, `package.json`, lockfile, `prisma/`, `.github/` or route file. No `#nnn` in the `src/` comments.
    - **QLT-01 confirmed by reading:** `describeMasterChange` returns `NO_DETAIL` when `MASTER_WORDS` has no own key, so `.not.toBeNull()` cannot fail. `MASTER_WORDS` is typed `Record<string, …>`, so type-check cannot catch it either.
    - **QLT-02 confirmed by reading:** `schemasFor` falls back to the event's union schemas whenever `forMasterShape` is absent.
    - **Every run on the branch** (`gh run list --branch fix/218-audit-master-shapes`): one, **43015245028**, attempt 1, on merge ref **316760f** (d833f47 into b3403e3; every job's "HEAD is now at" line).
      - 5 of 5 `success`. `Stages 1 to 11` ran from 11:55:34Z to 11:55:39Z, so the path is **5:16** (316 s from 11:50:23Z).
      - Unit: 151 files, **2,921**. Full Vitest: 210 files, **5,244**.
      - E2E: **265 / 263 / 250 = 778** passed, with **3 / 4 / 17 = 24** skipped. Shard 1's step log was missing from `gh run view --log`, so I read it from the job logs API.
      - Against b3403e3's push run 43004280872 (2,914 / 5,237 / 778 / 24), that is **+7 / +7 / +0 / +0**.
      - 18 cache restores and no miss. Gitleaks: no leaks. First-load JS: `/masters/materials` 187,566 and `/masters/process` 173,856, both within 200,000.
      - **Matched lines read:** three branch names in the fetch listing, the Postgres auth line, the `failed=` fan-in script, three `Failed to save: Unable to reserve cache` lines, and passing (`✓`) titles. There is no `✘` and no retry.
    - **Controls:**
      - #248 (developer): its base was the PR branch, so it had no Actions run. It counts as local evidence only.
      - #249 (reviewer-quality), base `master`, head 8cdbab6, 1 commit ahead. The compare API shows one file, `audit-service.ts` +3 / -5, with the writer back on `definition.before` / `definition.after` (the union).
      - Run 43019917793: `Stages 1 to 11b` and `Stages 1 to 11` failed, and the three E2E shards passed. `--log-failed` shows `Test Files 1 failed | 150 passed (151)` and **exactly 5** failed tests, all in `masters-audit-events.test.ts`: both required tests, the cross-master matrix, deny by default, and the changed unnamed test. #249 is closed unmerged.
    - **Callers:** `masters-service.ts:115,136`, `treatment-service.ts:77` and `exchange-rate-service.ts:131` all pass `objectType` (`git grep` at d833f47). These helpers serve all 8 `master.*` calls.
    - **Overlap:** `origin/master` is still b3403e3. Neither #235's 52 files nor #222's files include any of #247's 3 files.
  - **Not re-run by me:** reviewer-quality's local plants (a) and (b) (read from the report, and confirmed by reading the code), the developer's local loop, and the local Gitleaks run (CI stage 2 is green).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present | ✱ | ✅ | reviewer-quality, as #218 and DL-144 (3) set the route. A recorded exception to "three reports", as at DL-124. The hygiene items were checked by master above: scope, Gitleaks, lint and type-check. There is no performance surface beyond one `Map` lookup per audit write |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 in the report and in review 5858735404 |
| 3 | Major findings fixed or accepted | | ✅ | none raised |
| 4 | Findings cite file:line | | ✅ | QLT-01 to QLT-04 |
| 5 | #218's required tests exist and fail without the change | | ✅ | Both are red on #249 in CI, along with 3 more. The integration assertions are green in stage 11 (5,244) |
| 6 | The "one table" pin can fail | | ⚠️ | No: QLT-01 → condition A |
| 7 | A later `master.*` event cannot reopen the hole silently | | ⚠️ | No: QLT-02 → condition A |
| 8 | Changed existing test (unnamed type) | | ✅ | QLT-03 is accepted. It is outside G12's scope (test strategy v0.34 §10), it tightens behaviour, no `expect` was removed, and it is red on #249 |
| 9 | Other-role documents | | ⚠️ | Architecture §8 has no sentence on the refusal → solution-architect (condition B) |

**Conditions**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer, then reviewer-quality | PR #247: one commit, `src/server/services/audit-events.ts` and `tests/unit/masters-audit-events.test.ts` only | QLT-01: the `.not.toEqual(NO_DETAIL)` assertion **and** a type-check of `MASTER_WORDS` against the keys of `MASTER_SHAPES`, with no type assertion. QLT-02: the refusal when `objectType` is `master` and `forMasterShape` is missing, plus a test over every registered `master` event. No existing #218 `expect` is removed or loosened. The Dev Record gets a round-2 row (commit, n new tests, CI run) and a line saying #248 ran locally only and #249 is the CI control. reviewer-quality reads the push diff only and re-plants P1, P2 and P3 as DL-154 (5) sets them, printing each diff first | Before master's G7 |
| B | solution-architect | `docs/04-architecture/architecture.md` §8 | The QLT-03 sentence: a generic master event is written only for an `object_type` with a shape in `MASTER_SHAPES` and is checked against that master's own shape, never the union. An unknown or missing type is refused with `shape` at `objectType` | Next architecture change, at the latest before AQP-142's G6. Does not hold #247 |

**G7 route (DL-154 (7)):** master decides, with no QA run, on the fix head. (a) Condition A stays within its files, and the re-read has no Blocker, Critical or Major. (b) P1 and P2 are red in the unit file and at `tsc`, and P3 is red in the new test. (c) CI is 5 of 5 with the invariant below. (d) No Sev-1 or Sev-2 Bug is open.
**Merge (orchestrator, `CLAUDE.md` §8), DL-154 (8):**
- The records PR with DL-154 merges first, then G7 GO.
- #235 merges before #247. #247 is then updated by a merge commit only, with its files unchanged against the G7 head, and the overlap is re-checked.
- **Invariant:** the push run of the `master` taken, plus unit 7 + n, full Vitest 7 + n, E2E +0 and skipped +0. That is **2,921 + n / 5,244 + n / 778 / 24** on b3403e3, and **2,921 + n / 5,284 + n / 778 / 24** after #235 as ruled. Otherwise it is recomputed and posted.
- 5 of 5 with matched lines read. A red comes back to master and is not re-run.
- Posts on PR #247 and AQP-142 before the squash. A path of 5:30 or more is reported, not held.
- Squash after the delivery lead's click, with "Closes #218".
- The `master` push run is posted after the squash.
- #247 merges before AQP-142's G6 review starts.

**Risks:** none new. RISK-023 stays at 8 (DL-151). This PR adds no E2E test, and its path is 5:16.
**Rationale:**
- Every mandatory item holds.
- The two Minors are the exact gap that AQP-142's `customer` would fall into, and each costs a few lines in the PR's own files, so they are fixed now rather than deferred.
- QLT-02 is production code, so the finding's owner re-reads it (DL-051, DL-091).
- P3 registers an event the matrix test does not name, because with the three current events the refusal branch changes nothing that the matrix does not already catch.
**Posted:** PR #247 comment 6796477521; GitHub #218 comment 6796478519; Jira AQP-142 comment 11502.

## G6 – Peer Review (close) — tech-debt #218 (QLT-11, PR #247: the audit writer checks each master state against its own `object_type`) — 2026-11-11 (attempt 1, closed at 9e98dca)

- **Decision:** **CONDITIONAL GO, closed with no further round (DL-155).** Condition A is met in one commit, 9e98dca, in the two named files. reviewer-quality re-read the push diff only, approves, and re-planted P1 to P3 as DL-154 (5) set them, plus an extra P3b. Condition B is met: architecture v0.38 §8 is on `master` (c6b9074). The one new finding, QLT-05, is Info.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - PR #247 at 9e98dca (2 commits, 3 files against b3403e3: `audit-events.ts` +75 / -18, `audit-service.ts` +5 / -2, `masters-audit-events.test.ts` +127 / -4). Its body and Dev Record. Developer hand-off: #218, Jira AQP-142 11504.
  - `docs/06-reviews/218/quality.md` "Round 2" (records branch `docs/AQP-1-records-sprint1-e`, 0715490). PR review 5859759729 (COMMENTED, verdict APPROVE), with thread replies in reviews 5859754243 (QLT-01) and 5859755706 (QLT-02), and the developer's replies in 5859472628 and 5859476650. No review requests changes. Label `review:quality-approved`. reviewer-quality hand-off: #218 comment 6797657297 and Jira AQP-142 11507. That comment names `docs/218-review-quality-r2` as the report's branch. Its file (171d2cc) is identical to 0715490 (`git diff` empty), and the records branch copy is the one of record.
  - **My own checks** (git, jobs API, job logs, `tsc`):
    - **Diff `d833f47..9e98dca`, read in full:** 1 commit, 2 files, +48 / -10, exactly the files DL-154 (4) named.
      - QLT-01: `MASTER_WORDS` is `{ … } as const satisfies { readonly [K in keyof typeof MASTER_SHAPES]: … }`, with no type assertion. `describeMasterChange` reads `MASTER_WORDS_BY_TYPE`, a `Map` built from it, so `toString` and `constructor` still find nothing. The agreement test adds `.not.toEqual(NO_DETAIL)` beside the existing `.not.toBeNull()`.
      - QLT-02: `schemasFor` returns null when `forMasterShape` is absent and `objectType` is `GENERIC_MASTER_TYPE` (`'master'`, now used by the three events). New test `[QLT-02]` loops over `auditEventNames()` filtered to `objectType === 'master'`: null for `quotation`, `master` and `constructor`, and for each master and each state side, its own state accepted and every other master's refused.
      - **No #218 `expect` removed or loosened.** The only removed test line is the import, replaced by one that adds `auditEventNames`. Every other test change is an addition. n = 1 new test.
    - **Both directions of the key check, probed:** a scratch file with the same `as const satisfies` mapped-type form, under the repository's TypeScript 5.9.3. An extra key gives TS2353 and a missing key gives TS1360; the matching literal gives no error. reviewer-quality's P1 and P2 cover the missing-key direction in the real file.
    - **Condition B:** `origin/master:docs/04-architecture/architecture.md` is v0.38, and the §8 masters line has the sentence (line 1045; §17 row 0.38).
  - **Not re-run by me:** reviewer-quality's local plants P1, P2, P3 and P3b (read from the report and the two thread replies). The developer's local lint, type-check and Gitleaks (CI stages 1 to 11b are green).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present | ✱ | ✅ | reviewer-quality rounds 1 and 2, the narrow route of DL-144 (3) and DL-154 (1). A recorded exception to "three reports", as at DL-124 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | Round 2: 0 Blocker, 0 Critical, 0 Major, 0 Minor, 1 Info. Round 1 had none |
| 3 | Major findings fixed or accepted | | ✅ | none raised |
| 4 | Condition A within the named files | | ✅ | 1 commit, `audit-events.ts` and `masters-audit-events.test.ts` only |
| 5 | QLT-01 fixed, both parts | | ✅ | `.not.toEqual(NO_DETAIL)`; `satisfies` mapped type with no assertion. P1 and P2 red in the unit file and at `tsc` (TS1360 at `audit-events.ts:199` and `:201`); extra-key direction TS2353 in my probe |
| 6 | QLT-02 fixed | | ✅ | Refusal branch plus the `[QLT-02]` test. P3 (refusal removed, `master.planted` registered) and P3b (refusal kept, `master.planted` only) both red in that test |
| 7 | Round-2 Dev Record row | | ✅ | Rows for QLT-01 and QLT-02 with 9e98dca, n = 1, run 43028036603, and the line "#248 ran locally only (no Actions run); #249 is the CI control" |
| 8 | Condition B | | ✅ | Architecture v0.38 §8 on `master` |

**Conditions:** none.
**QLT-05 (Info), routed:** `GENERIC_MASTER_TYPE` is declared privately in `audit-events.ts:38` and `audit-service.ts:108`. Accepted as Info. No issue is opened and no commit is made on the judged head (it would break the "files unchanged" merge rule). The developer may export it from `audit-events.ts` and import it in `audit-service.ts` at the next change to either file (AQP-142 edits `audit-events.ts` to add `customer`). That is optional and not tracked. If the "make `objectType` required for `master.*`" candidate from QLT-03 is ever opened, QLT-05 rides in it.
**Risks:** none new.
**Rationale:** the push is the ruled fix, in the ruled files, re-read by the ruled reviewer, and each plant is the one DL-154 (5) set. A further round would add nothing.
**Posted:** with the G7 record below.

## G7 – QA Acceptance (master, no QA run; DL-154 (7), DL-124 pattern) — tech-debt #218 (QLT-11, PR #247 at 9e98dca) — 2026-11-11 (attempt 1)

- **Decision:** **GO (DL-155).** All four G7 tests in DL-154 (7) hold on evidence I read. There is no pre-squash body condition. #247 merges under `CLAUDE.md` §8 on the DL-155 (4) steps. After #235 as ruled, the invariant is **2,922 / 5,285 / 778 passed / 24 skipped**.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - The G6 close above.
  - **Every run on the branch** (`gh run list --branch fix/218-audit-master-shapes`): 43015245028 on d833f47 (judged at G6) and **43028036603** on 9e98dca, the only run since. Attempt 1.
    - Merge ref **998dc45** (9e98dca into b3403e3; the "HEAD is now at" line in all four job logs).
    - 5 of 5 `success`. `Stages 1 to 11` ran from 13:24:28Z to 13:24:35Z (jobs API). The path is **5:27** (327 s from the run start, 13:19:08Z; 5:24 from the first job start).
    - Unit 151 files, **2,922** passed. Full Vitest 210 files, **5,245** passed. E2E **265 / 263 / 250 = 778** passed, skipped **3 / 4 / 17 = 24**.
    - Against b3403e3's push run 43004280872 (2,914 / 5,237 / 778 / 24): **+8 / +8 / +0 / +0**, which is DL-154 (8) (d)'s 7 + n with n = 1.
    - Cache: 3 + 5 + 5 + 5 = 18 `Cache restored from key`, no `Cache not found`.
    - **Matched lines read** (`flaky`, `failed`, `retry`, `✘`, `×` in each job log): a control branch name and the two `fix/AQP-268-flaky…` / `fix/AQP-272-flaky…` names in the fetch listing, the Postgres auth line, three `Failed to save: Unable to reserve cache` lines, and passing (`✓`) titles. There is no `✘` and no retry.
    - Gitleaks (stage 2): 645 commits scanned, no leaks found.
  - **Jira:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none (2026-11-11).
  - **Overlap** (`gh pr view --json files`): none of #247's 3 files is in #235 (52 files), #222, #250 (5 files; it adds `tests/support/audit-transaction-check.ts` and `tests/unit/audit-transaction-architecture.test.ts`) or #253 (32 files; it touches `src/lib/audit/audit-client.ts`, not the server files). `origin/master` since b3403e3 (c6b9074) changes `docs/` only.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every acceptance item has a result with evidence | ✱ | ✅ | #218's required items: round 1 conformance table (control #249 red on both required tests) plus round 2's P1 to P3b on the fix head. DL-154 (7) (a) and (b) met |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | JQL above, empty |
| 3 | Regression recorded and green | ✱ | ✅ | 43028036603: 5 of 5, +8 / +8 / +0 / +0, no failed, flaky or retried test |
| 4 | Exploratory notes | | n/a | No QA run by route (DL-154 (7)); no user-visible change |
| 5 | Accessibility for UI stories | | n/a | No UI change |

**Conditions:** none. Merge steps are in DL-155 (4).
**Merge (orchestrator, `CLAUDE.md` §8), DL-155 (4), final; replaces DL-154 (8) (c) to (h):**
- **Order:** #235 squashes first, on its own DL-152 (6) steps. Then the records PR from `docs/AQP-1-records-sprint1-e` (DL-155, quality round 2) merges, before #247 is updated, so #247 is updated once. Then #247.
- **Update:** by merge commit only ("Update branch" is fine). `git diff 9e98dca <new head> --` the 3 files is empty. The overlap with everything merged since b3403e3 is re-checked and posted. A conflict in a #247 file, or a red in a test that a newly merged PR added over the audit files (for example #250's), comes back to master.
- **Invariant:** each count = the push run of the `master` commit in the run's merge ref ("HEAD is now at … into <sha>"), plus unit **+8**, full Vitest **+8**, E2E passed **+0**, skipped **+0**. With #235 squashed as ruled (b3403e3 + 0 / +40 / +0 / +0) and the docs-only records PR, that is **2,922 / 5,285 / 778 / 24**. On any other `master` it is recomputed from that push run and the arithmetic is posted.
- 5 of 5, `Stages 1 to 11` read from the jobs API, every attempt read, no failed, flaky or retried test (matched lines read). A red comes back to master and is not re-run.
- Head, run, commits taken, counts with the arithmetic and path are posted on PR #247 and AQP-142 before the squash. A path of 5:30 or more is reported, not held (DL-142 (1)). With +0 E2E, no median of five is ordered.
- Squash after the delivery lead's click. "Closes #218" is on body line 5. If #218 does not close, the orchestrator closes it as completed with the merge commit.
- The `master` push run after the squash is posted. A red comes back to master.
- #247 merges before AQP-142's G6 review starts (DL-144, unchanged).
- **Housekeeping:** `docs/218-review-quality` and `docs/218-review-quality-r2` (duplicate review branches; the copy of record is on the records branch) are deleted by the delivery lead before G8, with the control branches. This does not hold the merge.

**Risks:** none new. RISK-023 stays at 8 (DL-151). #247 adds no E2E test, and its path is 5:27.
**Rationale:**
- Each of DL-154 (7)'s four tests holds on evidence I read: the diff, the jobs API, every job log, and Jira.
- The independence a QA run would add is already there: reviewer-quality's CI control (#249) and plants on the fix head, with each diff printed first.
- There is no AC, no user-visible change and no change to a production caller's write.
- GO and not CONDITIONAL GO: the PR body is accurate for round 2, and nothing is left to do before the merge steps.
**Posted:** PR #247 comment 6798679111; GitHub #218 comment 6798681892; Jira AQP-142 comment 11509.

## G6 – Peer Review — AQP-237 (STORY-10.18: static checks that `audit.record` uses the change's transaction; PR #250 at 87465b6) — 2026-11-11 (attempt 1)

- **Decision:** **NO-GO (DL-156).** There is one open Critical, QLT-01. AC-2 (a) is implemented differently from its text: the check accepts a `tx` that is a parameter of *any* enclosing function, not of the function F that holds the call. So a `record` inside `forEach(async () => …)` in the callback passes, and that entry is written after the callback returned. QLT-02 (Major) and STD-01 (Major) are fixed in the same round. Every Minor is fixed now except QLT-04 (code) and STD-05 (older files), which go to tech-debt #259. reviewer-quality and reviewer-standards re-read the round-2 diff, then attempt 2 follows.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - PR #250 at 87465b6: 2 commits (c6ade88, 87465b6) and 5 files, +859 / -3. Nothing under `src/`, no `package.json`, no workflow file. Read its body, its Dev Record and Decisions 1 to 4.
  - Jira AQP-237: the description (AC-1 to AC-5, Dev Context, T1 to T6), and its 8 comments as summarised in the reports.
  - `docs/06-reviews/AQP-237/standards.md`, `quality.md`, `performance.md` and `consolidated.md` on the records branch. The side branches `docs/AQP-237-review-{standards,quality,performance}` are identical to those copies (`git diff --stat` is empty for each), so the records branch is the copy of record.
  - PR review 5860664620 (quality); Jira 11510, 11511, 11513.
  - **My own checks:**
    - **The check source, read in full** (`git show origin/feat/AQP-237-audit-record-tx-checks:tests/support/audit-transaction-check.ts`, 280 lines).
      - `parameterOf` (136-144) returns `declaration.parent` for any parameter. `problemWithRecord` (259-263) never compares that function with the one that lexically holds the call. **QLT-01 is confirmed by reading.**
      - `checkAuditTransactions` spans 129-280 and holds ten inner functions, with no justification comment. **STD-01 is confirmed.**
      - Record calls are selected by member name only (270). **QLT-03 is confirmed.**
      - Nothing reads whether a call is awaited. **QLT-02 is confirmed.**
      - The PASSING table holds "a record inside a nested arrow function in the callback" (`Promise.all([...].map((event) => audit.record(tx, …)))`). That is the developer's Decision 4 ("it is inside F"), and no architect or product-owner ruling backs it.
    - **Reviewer control #257:** run 43042052703, head 4f5e9b0, attempt 1, failure.
      - I printed the `user-service.ts` diff first. Q1 is `void audit.record`, Q1b a missing `await`, Q2 `['a','b'].forEach(async () => { await audit.record(tx, …) })`, and Q3 and Q3b `.call` and `.bind` on a kept handle.
      - `--log-failed`: the AC-4 test fails only on `audit-events.ts:298: the transaction passed to record is not a parameter of a function around the call` (Q6, the `z.record` false positive). The probe prints `checked: 21` with that one finding. So Q1, Q1b, Q2, Q4 and Q5 pass and Q3 and Q3b are not visited, as reported.
    - **Real calls on `origin/master` 8ae01ef** (`git grep`), 15 in all: exchange-rate 1, masters 5, treatment 3, user 6.
      - Every `record` is `await`ed and sits in the function whose parameter it uses.
      - Every helper is called as the arrow body of its `.run(` callback: `(tx) => helper(…, tx, …)`.
      - So the lexical rule at the call and at each helper step, plus "awaited or returned", passes all 15. This confirms reviewer-quality's probe for the call and extends it to the steps.
    - **CI on the branch** (`gh run list --branch feat/AQP-237-audit-record-tx-checks`): one run, 43027184210, attempt 1, 5 of 5. Unit 3,054, full 5,377, E2E 778, each +140 / +140 / +0 against base b3403e3. I took the per-file times from the performance report and did not re-read them.
    - **Overlap with `master`:** #235 (8ae01ef) touched `tests/security/engineer-import-rule.test.ts` at `@@ -53` only, and PR #250 touches it at `@@ -114` and `@@ -169`. The hunks do not overlap. reviewer-quality merged #235 and #247 locally: 15 calls, 0 findings.
    - **PR labels:** `review:quality-changes-requested` and `review:performance-approved` are present. **`review:standards-changes-requested` is missing** (single-token overwrite).
  - **Not re-run by me:** the developer's plants #251 and #252 (read from the reports), the local lint mutation (QLT-05), and Gitleaks (CI stage 2 is green).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present (standards, quality, performance) | ✱ | ✅ | The `docs/06-reviews/AQP-237/` files and `consolidated.md`; review 5860664620 |
| 2 | Zero open Blocker or Critical | ✱ | ❌ | **QLT-01 Critical, upheld.** AC-2 (a): "the function F that holds the call qualifies if `record`'s `tx` argument resolves to a parameter P of F". The code resolves P to any enclosing function (`audit-transaction-check.ts:136-144, 259-263`). The reviewer-quality scale says "an AC implemented differently is at least Critical", and Q2 is the third form section 6 forbids. The reviewer's plant and my reading of the code both confirm it |
| 3 | Major findings fixed or accepted | | ❌ | QLT-02 (un-awaited `record` passes; Q1 and Q1b red only with the fix) and STD-01 (152-line function, Coding Standards §1) → condition A |
| 4 | Findings cite file:line | | ✅ | All 23 findings do |
| 5 | AC-3 plants proven red with diffs printed | | ✅ | #251 (P4, lint), #252 (P1, P2, P3, P3b and P5: five findings), as both reviewers report |
| 6 | AC-4: no allow-list, no `eslint-disable`; count stated | | ✅ | 15 calls, explained in the PR as 11 at 023e17d plus AQP-123 and AQP-130. AC-4 itself says "any other number is explained", so no AC change is needed |
| 7 | AC-5: no new job; time stated; header limits | | ⚠️ | 5.2 s in stage 6 and 4.1 s in stage 11, under the 10 s line. The header list is incomplete (QLT-06) → condition A |
| 8 | G12-scope test change (`engineer-import-rule.test.ts`) | | ✅ | STD-10: stricter, not weaker, and disclosed. The "types only" wording overstates what is enforced (STD-08) → condition A |
| 9 | CI time | | ✅ | Off the path. Slack is 106 s or more on every run read; RISK-023 stays at 8 (PRF, DL-151) |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| U | developer | PR #250 | **Update from `master` first:** one merge commit from the current `origin/master` (8ae01ef or newer; take #247 too if it has squashed by then). No rebase and no force-push. A conflict outside `engineer-import-rule.test.ts` comes back to master | Before condition A's commits |
| A | developer | PR #250: the 5 PR files, plus new `tests/support/audit-transaction-cases.ts` and `tests/support/lint-fixture.ts` | **QLT-01:** the function that lexically holds `record` must own the `tx` parameter. The same lexical rule applies at each helper step: the call to F must sit in the function whose parameter it passes. The nested `Promise.all(… .map(…))` case moves to FAILING, and a step-level case (`forEach(async () => { await helper(tx) })`) is added. **QLT-02:** the `record` call and every helper call on the chain must be awaited, returned, or an arrow body. **QLT-03:** visit `record` by the receiver's type (`AuditService`, declared in `audit-service.ts`), so `z.record` is no longer flagged. Report any use of `AuditService`'s `record` that is not the callee of a direct call (`.call`, `.bind`, alias). **QLT-05 + STD-07:** the lint tests also assert that the message names `createTransactionHandle`, and the `import()` message says the whole module is refused. **QLT-06:** both headers list every form still open (Q4 cross-file helper, Q5 dead closure → #259, destructuring, a chain over 3, a callback not typed as `TransactionRunner`, no write or order required). **STD-01 + STD-02:** lift the helpers to module level with a context, so the top function is ≤ 40 lines and complexity ≤ 10 everywhere. **STD-03:** move the case tables to `tests/support/audit-transaction-cases.ts`, so each file is ≤ 400 lines. **STD-04:** `PROGRAM_BUILD_TIMEOUT`. **STD-05:** use `tests/support/lint-fixture.ts` in the new lint test only. **STD-06:** the true comment, plus "this block must stay above the group blocks". **STD-08:** state what is enforced, rename to `NAMED_IMPORTS_ONLY`, and add one `import { clientFor }` control that expects `[]`. **STD-09:** the names. If any real call fails the stricter rules, stop and report it to the solution-architect (AC-4). Do not suppress it | Before attempt 2 |
| A2 | developer | PR #250 body | A Dev Record round-2 row per finding, the commit SHAs, the counts n_u and n_s, and Decision 4 rewritten to the ruled rule. Add the line "Closes #104" (otherwise the orchestrator closes #104 as completed with the merge commit). Follow-ups: #259 | With A |
| P | developer, then reviewer-quality | Control PRs **based on `master`**, each diff printed before its result (DL-091) | On the fix head, **red:** P1, P2, P3, P3b, P4, P5 (developer) and Q1, Q1b, Q2, Q2b (new: the step-level `forEach`), Q3, Q3b (reviewer-quality). **Green, with no finding:** Q6 (`z.record`). **Pass, and listed in the header:** Q4 and Q5. **Lint mutation** (`restrict()` without the entry): every lib, page and feature-component row that stayed green (22 of 27) now fails | Before attempt 2 |
| C | developer, read by master | CI on the fix head | 5 of 5, every attempt read. Counts = the push run of the `master` commit in the run's merge ref + unit (140 + n_u) and full Vitest (140 + n_u + n_s), E2E +0, skipped +0. Here n_u counts the new tests under `tests/unit` and n_s those under `tests/security`. The architecture test's stage 6 file time is reported (> 10 s → architect, AC-5) | Before attempt 2 |
| R | reviewer-quality and reviewer-standards | PR #250 reviews, round 2 | Both read `87465b6..<fix head>` only, with the merge commit read by `git show --cc`. reviewer-quality covers QLT-01 to QLT-06 and the plants; reviewer-standards covers STD-01 to STD-09. reviewer-performance does not re-run, unless `createServicesProgram` or the `beforeAll` set-up changes beyond moving code, or the stage 6 file time is over 8 s. Each reviewer changes only their own PR label. reviewer-standards restores `review:standards-changes-requested` now | After A, C, P |
| Q1 | product-owner | Jira AQP-237 | Step count: confirm "the callback is not a step; 3 calls below pass, 4 fail" (header lines 20-21; matches §6 "at most three steps from the callback"). If you read it otherwise, the constant changes in condition A | Before A's push; at the latest before G7 |
| Q2 | product-owner | Jira AQP-237 description | AC-4 count: a change note that 15 at b3403e3 is the explained number (AC-4 permits it). Leave the AC text unchanged | Before G7. Does not hold attempt 2 |
| D | solution-architect | `architecture.md` §6 "The two checks as built"; `test-strategy.md` §10 | Record the rules as built after A: lexical holder at each step, awaited or returned, receiver type `AuditService`, a non-callee use refused, and the count 15 instead of "eight" or 11. Record the real meaning of the Engineer allow-list entry `transaction` (STD-08). Add PRF-01 (the architecture test's stage 6 and stage 11 times from the fix-head run as the baseline) and the Vitest totals of record after the merge | Docs PR merged before #250's squash. Does not hold attempt 2 |
| H | delivery lead | Remote branches | Delete `chore/AQP-237-plants-control`, `-b`, `chore/AQP-237-qlt-plants-control`, the round-2 control branches, and `docs/AQP-237-review-{standards,quality,performance}` (identical to the records branch) | Before G8. Does not hold the merge |

**Deferred (tech-debt #259, created by master):** QLT-04 code (count a repository call in a nested function only when that function is awaited or returned) and STD-05 for `layer-rules.test.ts` and `engineer-import-rule.test.ts`. Owner: developer, on the narrow reviewer-quality route. Due before G8, and before any story whose callback passes `tx` into a nested function. **Accepted (Info), no issue:** QLT-07, STD-10, STD-11, STD-12 (→ H), PRF-02. PRF-01 → D.
**G7 route:** decided at attempt 2.
**Risks registered:** none new. RISK-023 stays at 8. Until #250 merges, reviewers keep checking each `record` call against section 6 by eye. AQP-142 edits `audit-events.ts`, so a `z.record` there would trip the unfixed check; QLT-03 now closes that.
**Rationale:**
- **NO-GO.** The procedure gives NO-GO for any open Critical. QLT-01 is an AC implemented differently, in the story's main purpose, and Decision 4 widened it without the ruling AC-4 asks for ("report to the solution-architect, do not suppress").
- **No architect ruling is needed.** The fix restores the AC text, and the only form it removes, `Promise.all(map)`, is used by no real call. The step-level rule is the same defect one level down.
- **Why the Minors now.** They sit in the same three files being rewritten, cost one push, and QLT-03 would otherwise trip AQP-142.
- **Why two deferrals.** QLT-04 needs a design (when a nested function counts) and is a deliberate-dead-code form. STD-05 touches a G12 file outside the story.
- **Why update from `master` first.** The control plants and counts should run on the `master` that will be merged, and #235's change to the shared G12 file is merged once, read with `--cc`.
**Posted:** Jira AQP-237 comment 11516; PR #250 comment 6800369342; tech-debt #259 (created by master).

## G6 – Peer Review — AQP-89 (STORY-01.06: 12-hour session; PR #253 at c4055f7) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-160).** No Blocker or Critical. The two Majors are both dealt with. **STD-01 = QLT-01 is closed by documentation:** the delivery lead's KEEP (DL-157), ADR-009 amendment 2 and architecture v0.39. That closure holds only once records PR #271 merges, and #271 must merge before #253 is updated and squashed. **PRF-01 is a measurement condition:** the developer attributes the +4.5 KB before the re-review. One fix push covers the Minors STD-02 to STD-07, STD-14, QLT-02 and QLT-03. **#255 (STD-05) is fixed in this round, not deferred.** reviewer-standards and reviewer-quality re-read only the fix diff. reviewer-performance re-reads only if PRF-01 changes code. Master then closes G6, and QA decides G7. AQP-89 goes to Changes Requested (orchestrator).
- **Decided by:** master  ·  **Human override:** none. The KEEP is the delivery lead's own decision (DL-157). This gate only applies it.
- **Attempt:** 1
- **Artefacts evaluated:**
  - **PR #253 at c4055f7:** 3 commits, 32 files, +1,334 / -79. I read the body (AC table, Dev Record, Decisions 1 to 8). Labels: `review:standards-changes-requested`, `review:quality-changes-requested`, `review:performance-approved`. Reviews: 5861392935 (standards), 5861534914 (performance), 5861690717 (quality), all COMMENT (single-token).
  - **Reports:** `docs/06-reviews/AQP-89/standards.md`, `quality.md`, `performance.md` and `consolidated.md` on the records branch (56a6e80). The side branches `docs/AQP-89-review-{standards,quality,performance}` match those copies exactly (`git diff --stat` is empty for each). The records branch is therefore the copy of record.
  - **Jira AQP-89:** the description (AC-1 to AC-6, Dev Context, T1 to T5), plus comments 11520 (question), 11522 (quality), 11526 (decision), 11529 and 11534 (architect) and 11535 (brief).
  - **DL-157:** the KEEP, the delivery lead's selection, already verified and recorded by master.
  - **ADR-009 amendment 2 and architecture v0.39:** commit 5c50671 on `docs/AQP-1-records-sprint1-g`. Draft PR #271 contains it, and CI 43126085927 on 5c50671 is green.
  - **GitHub #255 and #256.**
  - **My own checks:**
    - **STD-01 = QLT-01 against the amendment.** Amendment 2 records the following, and gives "Reversal is one line":
      - Option A as built, with B and C as the alternatives.
      - The three lifetimes: the token's `exp`, `resolveSession`, and the cookie.
      - The no-replay and no-disclosure reasoning, with sign-out unchanged.
      - The consequences: #255, QLT-04, QLT-06, QLT-07 and STD-08.

      I grepped the current architecture and ADR text. "Cookie that lasts 12 hours", `SESSION_LIFETIME_HOURS`, `session-ended.tsx` and "the one place" no longer appear as statements; they survive only in the v0.39 change-log line. A-23, the Session helper row, the FR-099 row, the §8 rotation note (QLT-04) and the §10 `lib` browser clients (STD-11) all match c4055f7. **STD-10 is closed. QLT-04's runbook note is done.**
    - **AC-2 "`requireUser()` is the one place … (one check, one constant)".** I ran `git grep` over c4055f7 `src`:
      - `hasSessionEnded` and `isWithinSession` are called only in `resolveSession` (`resolve-session-user.ts:51,53`).
      - `resolveSession` is called once in production, from the cached `readSessionState` (`session.ts:57`). `requireUser`, `requireUserOrRedirect` and `getCurrentUser` all read that state.
      - `SESSION_HOURS = 12` is the one constant (`session-token.ts:17`).

      So the AC's stated purpose (one check, one constant) is met. Only the name of the function differs, and it differs to the function that `requireUser` reaches. This is not the AQP-237 Decision 4 case (DL-156 (1)), which admitted a form the AC forbids: here no form is widened. **I rule it met, with a product-owner change note (condition Q).**
    - **QLT-02 by reading.** `session.ts:52-55` builds the claims only when `userId`, `sessionVersion` and `signedAt` are all present. The `session` callback in `options.ts` returns all three or only `expires`. P2 (`signedAt ?? now`) is therefore test-only today, as reported.
    - **STD-02 and STD-03 by `git grep`.** Two `SESSION_ENDED_TITLE` exports hold different strings (`problem.ts:57`, `system-page.tsx:29`). A literal `401` appears at `session-ended.ts:43` and `audit-client.ts:71`. Both are confirmed. (`errors.ts:48` also has a literal 401, but it predates this PR and is outside it.)
    - **PRF-01 numbers.** In the stage 11b log of PR run 43039133074, the merge ref was 84484ed (c4055f7 into c6b9074, docs-only on b3403e3). Its JS lines match the review table: `/` 167,055, `/masters/materials` 192,519, `/sign-in` 162,275, `not-found` 160,382. On `master` cdb5dec (push run 43124410896), the shared routes are unchanged from b3403e3 (`/` 162,504, `not-found` 155,829). `/masters/materials` is 186,951 there, after #235. **The step is real against today's `master` and is still not attributed.** No route breaches its budget.
    - **#255's line.** Each of the three E2E shard logs of 43039133074 has exactly one `[WebServer] [next-auth][error][JWT_SESSION_ERROR]` line. `master` cdb5dec's three shard logs have none. This gives an end-to-end check for the fix (condition L).
    - **Counts.**
      - Run 43039133074 has one attempt, 5 of 5 green: unit 3,005, full Vitest 5,337, E2E 268 + 266 + 253 = 787 passed, skipped 3 + 4 + 17 = 24. Against c6b9074 (= b3403e3 counts: 2,914 / 5,237 / 778 / 24), the PR adds **unit +91, full +100, E2E +9, skipped +0**.
      - `master` cdb5dec, push run 43124410896, is 5 of 5 green: unit 2,922, full 5,285, E2E 265 + 263 + 250 = 778, skipped 24. `Stages 1 to 11` ran 00:03:16Z to 00:08:22Z, so the path is 5:06.
    - **Overlap.**
      - The 32 PR files share no path with the 76 files changed from b3403e3 to the records branch head 5c50671 (that range includes #235, #247, the records and #271).
      - The files of open PRs #250 (8), #265 (16) and #222 (2) share no path with #253 either.
  - **Not re-run by me:** the developer's plants #254 and reviewer-quality's P1 to P3 (#260 to #262). I read these from the reports, and the result counts are consistent with the runs named. Also not re-run: gitleaks, because CI stage 2 is green and the Dev Record has the `gitleaks dir` result. I ran no local build.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present (standards, quality, performance) | ✱ | ✅ | `docs/06-reviews/AQP-89/*` (records branch); reviews 5861392935, 5861534914, 5861690717 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 / 0 in all three reports and in `consolidated.md`. AC-2's naming is checked above and is not an "AC implemented differently" |
| 3 | Major findings fixed or explicitly accepted | | ⚠️ | STD-01 = QLT-01: accepted by the delivery lead (DL-157) and documented (amendment 2, v0.39). It closes when #271 merges (condition M). PRF-01: open until attributed (condition P) |
| 4 | Findings cite file:line | | ✅ | All findings do, except STD-13 (PR-level) and PRF-02, which cite the constant |
| 5 | Plants: every core promise has a fault that is caught | | ⚠️ | 12-hour boundary (P1, #254), renewal, lost code, open redirect (P3, #254), 401 body, deactivation, `session_version` and proxy header: all red. **P2 (no `signedAt`) green** → QLT-02 (condition A, re-plant in L) |
| 6 | AC coverage | | ⚠️ | AC-1, AC-3, AC-5 and AC-6 are met. AC-2 is met in substance (condition Q). AC-4 is met in code but only tested link by link (QLT-03 → condition A; QA covers the browser hop) |
| 7 | CI on the judged head | | ✅ | 43039133074: attempt 1, 5 of 5, path 4:49, deltas +91 / +100 / +9 / +0 as above |
| 8 | Branch current with `master` | | ⚠️ | Behind (base b3403e3; `master` is cdb5dec). No path overlap → condition U |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| M | orchestrator | Records PR #271 (`docs/AQP-1-records-sprint1-g`, with this record and DL-160 committed) | Mark it ready and merge it under docs-auto. It carries ADR-009 amendment 2 and architecture v0.39, and STD-01 = QLT-01 is closed only when it is on `master`. **#271 merges before #253 is updated (U), and in any case before #253's squash.** If #271 cannot merge, #253 does not squash, and the matter comes back to master | Before U |
| U | orchestrator (GitHub "Update branch") or developer (local merge, if the permission system allows it) | PR #253 | Update from `origin/master` with **one merge commit** after #271 has merged. No rebase and no force-push. Before the update, post the overlap of the 32 PR files with `b3403e3..origin/master` (none today). A conflict comes back to master. Preferred before condition A, so the fix push, the re-review and QA all judge the head that merges. If the developer cannot take a server-side update locally without a denied command, push A first and run U after A and before R starts. Either way, `git diff <pre-update head> <post-update head>` over the PR's files must be empty, and that check is posted | After M; before R |
| A | developer | PR #253: the PR's 32 files only (name any further file in the Dev Record, with its reason) | One fix push. **STD-02:** rename the problem constant `SESSION_ENDED_PROBLEM_TITLE`. **STD-03:** export `HTTP_UNAUTHORIZED = 401` from `src/lib/auth/session-ended.ts`, and use it at `session-ended.ts:43` and `audit-client.ts:71`. **STD-04:** a doc line on `resolveSessionUser`: "kept for tests that need only the user; production uses `resolveSession`" (no deletion). **STD-06:** one sentence in both `x-session-cookie` comments: the header is trusted only on paths inside the proxy matcher. **STD-07:** the one-line comment on the `encode` fallback. **STD-14:** remove the four test `as` casts (narrow and throw, zod-parse the body, typed hoisted mocks). **QLT-02:** the `auth-session.test.ts` case (user and version but no `signedAt` is nobody, and with the cookie it has ended); the `session`-callback case in `auth-options.test.ts` is optional. **QLT-03:** in `session-ended.spec.ts`, an API call carrying an ended session (`addEndedSession(context, 'expired-token')`) answers 401, `application/problem+json`, `cache-control: private, no-store`, `code: SESSION_ENDED`, with no data. Prefer adding it to test 2 (E2E +0); a new test at three widths (+3) is acceptable. No `@one-width` tag (that needs a §10.5 ruling). The browser hop to SCR-01 is optional here, and QA covers it (G7). **#255 (STD-05), fixed now:** `buildAuthOptions` gets a next-auth `logger`, with this behaviour: (i) `JWT_SESSION_ERROR` for an **expired** token goes to pino at `debug`; (ii) any other `JWT_SESSION_ERROR` (a token that cannot be decrypted or parsed) goes to `warn`; (iii) every other next-auth code keeps its level and is never dropped; (iv) only the error name and code are logged, never the message, stack, token or claims. Unit tests pin (i) to (iv) in `auth-options.test.ts`. STD-12 (the AC ID on the first `describe` of `auth-session-ended.test.ts`) is optional | Before R |
| L | developer, then reviewer-quality | Control PRs **based on `master`**, each diff printed before its result (DL-091), closed unmerged; plus the fix-head E2E logs | **Red on the fix head:** L1, every next-auth code sent to `debug` (a non-JWT code must stay at its level); L2, an expired token logged at `error`; L3, the message or stack logged; **P2** (`signedAt ?? now`, re-planted by reviewer-quality). **The fix-head E2E shard logs** hold no `[next-auth][error][JWT_SESSION_ERROR]` line (today there is one per shard), and the session-ended tests still pass | With A; read at R |
| P | developer (reviewer-performance if code changes) | PR #253 Dev Record | **PRF-01 attribution:** compare the chunk output of a local `next build` at the fix head with the `master` in its merge ref. Name the chunk that grew and the module that pulls it into the shared shell. If one small client module drags a chunk in (for example through the root `unauthorized.tsx`), fix it, and reviewer-performance re-reads that change. If it is a stable regrouping, say so and record the new baseline per route from the fix-head CI log. Use the existing worktree's `node_modules`, with no `npm ci`. If no local build can run, report that to the orchestrator for master; do not skip the step | Before R |
| C | developer, read by master | CI on the final head | 5 of 5. Read every attempt, and take `Stages 1 to 11` from the jobs API. **Counts** = the push run of the `master` commit in the run's merge ref, plus unit (91 + n_u), full Vitest (100 + n_u + n_i), E2E passed (9 + e) and skipped +0. Here n_u is the number of new unit tests (they count in both Vitest runs), n_i the new integration tests, and e is 0 or 3 (QLT-03). For cdb5dec (43124410896: 2,922 / 5,285 / 778 / 24) the targets are **3,013 + n_u, 5,385 + n_u + n_i, 787 + e and 24**. For any other `master`, recompute and post the arithmetic. Explain any other difference by test name. Post the JS figures per route, with the delta against that `master`. A path of 5:30 or more is reported, not held (DL-151 reading rule). Read every `failed` / `flaky` match | With A |
| B | developer | PR #253 body | Round-2 Dev Record rows for each finding, with the commit SHAs, n_u, n_i and e, and the PRF-01 attribution. Decision 1 cites ADR-009 amendment 2 and DL-157. Decision 8 is updated to show how U was done. Add "Closes #255". Follow-ups: #256 (ux half only) | With A |
| R | reviewer-standards and reviewer-quality (reviewer-performance only per P) | PR #253 reviews, round 2 | Both read `c4055f7..<fix head>` only, and confirm U's empty diff over the PR files. If the update was not clean, they read it with `git show --cc`. **reviewer-standards:** STD-02 to STD-07, STD-14, the #255 code. **reviewer-quality:** QLT-02, QLT-03, the logger's behaviour (i) to (iv), and the L plants. reviewer-performance re-reads only if P changes code, or if any route's fix-head figure exceeds the `master` figure plus c4055f7's step. Then master decides G6 attempt 2 (the close) | After A, L, P, C, B |
| Q | product-owner | Jira AQP-89 (change note; the AC text is unchanged) | AC-2's "`requireUser()` is the one place" is read as: the one check is `resolveSession`, reached only through `session.ts` (`requireUser`, `requireUserOrRedirect`, `getCurrentUser`), over the one constant `SESSION_HOURS` (architecture v0.39 §8, A-23). Also correct the Dev Context names: `SESSION_HOURS`, not `SESSION_LIFETIME_HOURS`; no `system-pages/session-ended.tsx`; the kind is in `system-page.tsx`. This is the Jira half of STD-10, which the architect left to the story owners in 11534 | Before G7 starts. Does not hold R |
| X | ux-expert | GitHub #256 (UX half); ux-spec, `SCR-26.html`, `SCR-01.html` | (a) Align the spec and mock-ups with the built AC wording: "Sign in again", and `role="alert"` on the SCR-01 notice (STD-09). (b) **STD-08:** either the second SCR-26 wording (sign-out elsewhere, Admin reset), or a recorded "the plain sign-in page stays", with the reason. Also decide whether an unreadable cookie after a secret rotation needs neutral words (QLT-04). **Waived for AQP-89's own gates:** no AQP-89 AC asks for it, and AC-5 keeps 01.01's behaviour. If (b) produces wording, the product-owner places the build as a story | **Before G8**, and before any story that adds a self-service password change |
| H | delivery lead | Remote branches | Delete `control/AQP-89-plants`, `control/AQP-89-qlt-p1-boundary`, `-p2-no-signedat`, `-p3-scr26-return`, the round-2 L control branches, and `docs/AQP-89-review-{standards,quality,performance}` (identical to the records branch) | Before G8. Does not hold the merge |

**Accepted (Info), no issue:** STD-09, which goes to the ux-expert under X. STD-11 and STD-10, done in v0.39 (STD-10's Jira half is condition Q). STD-13 (condition U; the branches go under H). QLT-04, done in the §8 note (the ux half is in X). QLT-05: the optional classifier is not required. QLT-06: amendment 2 sets the trigger, "before any scale-out". QLT-07 (X). QLT-08 and PRF-02, closed by the #255 fix in A. QLT-10.
**G7 route:** qa-engineer, on the head after R and master's G6 close. QA does the following:
- (1) Verifies AC-1 to AC-6 against the AC text, read with Q's note.
- (2) Runs the AC-4 browser hop by hand: a signed-in client screen, then the cookie swapped for an ended one, then a fetch. The expected result is SCR-01 "Session ended", with a same-origin return address, and a successful return after sign-in. QA does this own-run check as well if test 2 automates only the API.
- (3) Checks that a deliberate sign-out never shows SCR-26 (amendment 2).
- (4) Checks that a request with a dead cookie writes no error-level `JWT_SESSION_ERROR` (#255).
- (5) **QLT-09:** checks the announcement of SCR-26 and of the SCR-01 alert with the tools QA has (accessibility tree; whether the alert text is present at first render or inserted after it), and writes screen-reader steps for the delivery lead's device session, before G8. A silent alert found there is a defect, graded by the test plan (NFR-018; DL-094), and bound to AQP-89.

**Merge (orchestrator, `CLAUDE.md` §8), pre-ruled:** after QA's G7 GO, if `master` has moved past the judged head, update by merge commit only. The PR's files must be unchanged (posted), C's count rule must be recomputed from the new merge ref's push run and posted, the run must be 5 of 5 with every attempt read, and the head must be posted on PR #253 and AQP-89 before the squash. A red run comes back to master and is not re-run.
**Risks registered:** none new.
- RISK-023 stays at 8: the PR adds 9 E2E instances (12 at most), and its path was 4:49.
- PRF-01 bears on RISK-020 (shell weight). Its attribution goes to that risk's owner at the next register review; the register is not restated here.
**Rationale:**
- **Why CONDITIONAL GO.** By the procedure, G6 with Majors but no Blocker or Critical is CONDITIONAL GO. STD-01 = QLT-01 is a missing record, not a code fault. The delivery lead decided it (DL-157), the architect wrote it into the ADR, and its closure is tied to #271 merging first.
- **Why #255 now.** The KEEP is what makes the log noise last 7 days. Amendment 2 says it "must be fixed before production". The change sits in `options.ts`, which the fix push and reviewer-standards' re-read already touch, so bundling it costs a few lines and tests in files already under review, rather than another PR and review cycle.
- **Why the logger split, with warn for an undecryptable token.** An undecryptable token is not the routine case, so it stays visible.
- **Why update first, if possible.** Strict branch protection forces an update after #271 anyway, so taking it first lets one head be judged by the fix, the re-review and QA.
- **Why the AC-2 note and not a NO-GO.** The AC's own parenthesis states the invariant ("one check, one constant"), and the code meets it exactly.
**Posted:** Jira AQP-89 comment 11538; PR #253 comment 6810726727; GitHub #255 comment 6810729259; GitHub #256 comment 6810730874.

## G6 – Peer Review — AQP-237 (STORY-10.18: static checks that `audit.record` uses the change's transaction; PR #250 at 57acbae) — 2026-11-11 (attempt 2)

- **Decision:** **CONDITIONAL GO (DL-161).** All three round-2 reviews approve with comments, and there is no open Blocker, Critical or Major. QLT-01 (Critical) and QLT-02 and STD-01 (Major) are fixed, with every plant DL-156 (6) set red on `master`-based controls. One new Minor, STD-13, is fixed in this PR as condition A, together with three cheap Info items. Master checks commit A from its diff, with no further review round (DL-047, DL-124). Condition D (the solution-architect's docs PR) stays a pre-squash condition from DL-156 (8). **G7 is by qa-engineer.** Jira: the orchestrator moves AQP-237 to Changes Requested for A, and to In QA once master's check of A is posted.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (attempt 1: NO-GO, DL-156)
- **Artefacts evaluated:**
  - PR #250 at **57acbae**: the fix commit on the merge commit **2c543cd** (`master` 2891457 into 87465b6). I ran `git show --cc 2c543cd`: no combined hunk, so the merge is clean. `git diff --stat 2c543cd 57acbae`: 8 files, +996 / -605, all under `tests/` plus `eslint.config.mjs`. Nothing under `src/`, no dependency, no workflow file. In the PR body, line 5 is "Closes #104", and there is a round-2 Dev Record (n_u 16, n_s 0) and a "15 uses" paragraph.
  - `docs/06-reviews/AQP-237/consolidated-round2.md`; the round-2 sections of `quality.md`, `standards.md` and `performance.md` (on `master` 46f56d6, from #271); reviews 5867152081 (quality) and 5867143180 (standards). Jira 11536, 11537, 11539 (round-2 hand-offs), 11523 (developer), 11521 (product-owner), 11541 (brief).
  - **Jira AQP-237 description:** I read the product-owner's change note of 2026-11-11 under the AC table. Q1 (the callback is not a step: 3 below pass, 4 fail) and Q2 (15 is the explained AC-4 count at b3403e3) are both there, and the AC text is unchanged. Q1 (11521, 11:02 -05:00) came before the fix push (11523, 11:31). **So DL-156 (8)'s two product-owner items are done.**
  - **CI** (`gh run list --branch feat/AQP-237-audit-record-tx-checks`): three runs, each attempt 1. 43027184210 is the round-1 head, 43053441301 the merge head 2c543cd, and **43056524392** the fix head. The jobs API shows 5 of 5 `success`. `Stages 1 to 11` ran from 16:19:49Z to 16:19:57Z, so the path is **4:25** from the run start (4:22 from the first job). The merge ref is **d928c6a** (57acbae into 2891457, from the "HEAD is now at" line).
    - Counts: unit 153 files, **3,078**; full Vitest 212 files, **5,441**; E2E **265 / 263 / 250 = 778**, skipped **3 / 4 / 17 = 24**.
    - Against 2891457's push run 43053208506 (2,922 / 5,285 / 778 / 24), that is **+156 / +156 / +0 / +0** = 140 + n_u 16 (n_s 0), as DL-156 (6) set.
    - 18 cache restores, no `Cache not found`. Gitleaks: 673 commits, no leaks.
    - Matched `flaky` / `failed` / retry / `✘` lines read in all four logs: the two `fix/AQP-268-flaky…` and `fix/AQP-272-flaky…` branch names, a workflow comment, and passing test titles. No retry.
    - Architecture test: `(45 tests) 10515ms` in stage 6 and `10561ms` in stage 11, read from the log.
  - **Control PRs** (read from the reports; not re-run by me):
    - developer #263 (run 43056860151): 11 findings at the stated lines. #264 (run 43056963948): P4 lint red.
    - reviewer-quality #272 (run 43126285285): Q1, Q1b, Q2, Q2b, Q3 and Q3b red with exactly 6 findings and `checked: 24`. Q6 has no finding; Q4 and Q5 pass and are listed. Its `tokens.test.ts` failure came from the plant's own comment.
    - `restrict()` mutation (reviewer-quality, local): 81 of 81 refusal rows fail.
  - **`record` count** (`git grep -c "\.record(" -- src/server/services`): 15 on `origin/master` 46f56d6, on #265, on #253 and on 57acbae (1 + 5 + 3 + 6). #222's older base has 12, and it adds none.
  - **Overlap:** `master` since 2891457 is docs only (14 files). #265 (16 files under `src/`) shares no file with #250. Its one services file, `audit-events.ts`, changes an import line only, with no `record` call.
  - **STD-13 and STD-14 by reading.** `lint-fixture.ts:31-32` returns `[]` for a missing result and drops every message whose `ruleId` is null, so STD-13 is confirmed. `git grep "new ESLint"` finds a copy at `tests/acceptance/aqp-27-scaffold.test.ts:273` as well as `layer-rules` and `engineer-import-rule`. So the comment's "three" is right, and #259 named only two.
  - **Jira:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none (2026-11-11).
  - **Not re-run by me:** the plants, the mutation, and the local ESLint complexity measurement (all from the reports).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present (standards, quality, performance) | ✱ | ✅ | Round-2 sections of the three files; reviews 5867152081 and 5867143180; Jira 11536, 11537, 11539 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | QLT-01 **Fixed**: `holderOf(call) === parameter.fn` at the call and at each helper step (`audit-transaction-check.ts:189-194, 300-315`); Q2 and Q2b red on #272 |
| 3 | Major findings fixed or accepted | | ✅ | QLT-02 Fixed (Q1, Q1b red). STD-01 Fixed (longest function 21 lines, complexity at most 10, measured) |
| 4 | Findings cite file:line | | ✅ | STD-13 to STD-15, QLT-08 and PRF-03 all do |
| 5 | DL-156 conditions U, A, A2, P, C, R | | ✅ | U: 2c543cd, clean. A: every finding Fixed, or deferred to #259 by DL-156 (4). A2: body. P: #263, #264, #272. C: 43056524392 = +156 / +156 / +0 / +0. R: three round-2 reviews |
| 6 | DL-156 (8): product-owner step count and AC-4 note | | ✅ | AQP-237 description change note (11521), before the fix push |
| 7 | AC-4: 15 calls, no allow-list, no suppression | | ✅ | `git grep` 15 on every open head; pinned "at least 15" |
| 8 | AC-5: no new job; time stated; header limits | | ⚠️ | No new job. The 10.5 s file time is over the 10 s report line on one slow-runner run. The developer reported it (11523), which is the AC's duty, and reviewer-performance estimates the build at 8 to 8.5 s on that run. QLT-08's accepted form is missing from the header → condition A. The range goes to the architect under D |
| 9 | New Minor STD-13 | | ⚠️ | The helper that the header tells the next lint test to use hides a non-parsing or ignored fixture → condition A |
| 10 | Condition D (architect docs PR) | | ⚠️ | Not done: architecture §6 still reads "11 call sites" (v0.32 text). A pre-squash condition, as DL-156 (8) set |
| 11 | CI time, RISK-023 | | ✅ | Path 4:25; no E2E added; RISK-023 stays at 8 (reviewer-performance round 2) |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #250. One commit in these 4 files only: `tests/support/lint-fixture.ts`, `tests/unit/lint/transaction-handle-rule.test.ts`, `tests/support/audit-transaction-check.ts` (comments only), `tests/support/audit-transaction-cases.ts` | **STD-13 (behaviour):** `messagesFor` throws, naming the path and ESLint's text, when the fixture does not parse (a `fatal` message), when the path is one ESLint ignores (for example, check `eslint.isPathIgnored` first), and when ESLint returns no result. Other `ruleId: null` messages are dropped as today. Add 2 tests to `transaction-handle-rule.test.ts`: a source with a syntax error rejects, and a path under an ignore pattern rejects. Show both red against the old `messagesFor` in a local run, with the diff printed, in the Dev Record. If an existing row now throws, fix the fixture, not the helper, and list it. **QLT-08:** one ACCEPTED header line ("a `record` whose error is caught and not rethrown inside the callback; error handling is outside this check") and one `OPEN_LIMITS` case with reviewer-quality's X1 body. This keeps QLT-06's rule that every ACCEPTED form is pinned. **STD-15 (2):** the one-line comment on the `forEachChild(...) \|\| undefined` idiom (line 232). No other line of `audit-transaction-check.ts` changes. **No change for STD-14:** the comment is correct, and #259 now names the third file. **Counts:** unit and full Vitest +k over 57acbae's figures (k = new tests, expected 3), E2E +0, skipped +0, against the merge-ref `master` push run. Dev Record: a round-3 row per item, k, and the commit | Before QA starts G7 |
| A-check | master | PR #250, AQP-237 | Read commit A's diff. Confirm it is within the 4 files, that every changed line in `audit-transaction-check.ts` is a comment, and that the CI run is 5 of 5 with the counts above, every attempt read. Post the check on both. **No further review round.** If A changes anything else, reviewer-standards re-reads that part | After A |
| D | solution-architect | Architecture §6 and test strategy §10, in a docs PR (or on the orchestrator's records branch, as v0.39 rode in #271) | Unchanged from DL-156 (8), with the content now known. §6 "The two checks as built": the lexical holder at the call and at each step; the awaited / returned / arrow-body chain; selection by receiver type `AuditService`; a non-callee use refused; `z.record` not visited; the product-owner's step count; the count 15; the ACCEPTED forms (Q4, Q5 / #259, QLT-08). The Engineer `transaction` entry's real meaning (STD-08). The PRF-01 baseline **as a range with a host factor**: 5.2 / 4.1 s round 1, 4.4 / 3.4 s merge head, 10.5 / 10.6 s fix head (slow runner), 7.7 s control B. The §10 Vitest totals from the merged figures | On `master` before #250's final update and squash |
| H | delivery lead | Remote branches | DL-156 (8)'s branches plus `chore/AQP-237-r3-qlt-plants` (#272) | Before G8. Does not hold the merge |

**Rulings on the brief's questions:**
- **STD-13 goes in this PR, not to tech-debt.** The helper is the template: its header tells the next lint test to use it, and #259 moves three more files onto it. A no-op "allows" test is the kind of silent pass the whole story exists to stop. The fix is the reviewer's own code plus two tests.
- **QLT-08 and STD-15 (2)** are one-line comments, plus one pinned case, in the same commit. **STD-14:** no PR change; #259 is widened instead (comment 6811493411). **STD-15 (1)** waits for the next change to `parameterOf`.
- **PRF-03:** no change in this PR. It goes to #259 as a conditional item, because #259 changes the same file and re-runs the same plants. The trigger: stage 6 over 8 s on both QA's G7 run and the first `master` push run after the squash. The orchestrator posts both readings on #259.

**G7 route:** qa-engineer, on the head after the A-check. DL-124's master-only route does not apply: this is a story with five ACs, and it changes `eslint.config.mjs`. QA writes `docs/07-qa/AQP-237-test-report.md` in the PR, with each AC checked against its text, read with the product-owner note. QA reads AC-4's count and AC-5's stage 6 time on the G7 run, and checks the header lists (including QLT-08). QA also runs **own plants** on one `master`-based control PR, each diff printed first, using forms nobody has planted yet:
- (i) AC-1: `createTransactionHandle` imported in a real file under `src/app/` or `src/components/`. Lint must be red.
- (ii) AC-2 (a): a `record` in an IIFE, or in a `.then(` callback, inside a `.run(` callback. It must be red.
- (iii) AC-2 (b): a callback whose only other repository call passes a transaction that is not its parameter. It must be red.

Regression: CI 5 of 5 on the G7 head. No open Sev-1 or Sev-2.

**Merge (orchestrator, `CLAUDE.md` §8), pre-ruled:**
- (a) Done first: the A-check, D on `master`, the records PR with DL-161 and DL-162 on `master`, and QA's G7 GO.
- (b) #250 is updated from `master` by a merge commit only ("Update branch" is fine). `git diff <G7 head> <new head>` over the PR's files must be empty, and it is posted. The overlap with everything merged since is re-checked and posted. A conflict, or a new `.record(` call that fails the check, comes back to master.
- (c) **Invariant:** each count = the push run of the `master` commit in the run's merge ref + unit (156 + k), full Vitest (156 + k), E2E +0, skipped +0.
  - On 46f56d6 (docs only since 2891457), if its push run 43132175656 reads 2,922 / 5,285 / 778 / 24, the targets are **3,078 + k, 5,441 + k, 778 and 24**.
  - On any other `master`, it is recomputed and the arithmetic is posted. #265 adds +0.
- (d) 5 of 5, with `Stages 1 to 11` read from the jobs API, every attempt read, and the matched lines read. The architecture test's stage 6 time is posted. A red comes back to master and is not re-run.
- (e) The head, run, commits taken, counts with the arithmetic, and path are posted on PR #250 and AQP-237 before the squash. A path of 5:30 or more is reported, not held (DL-151).
- (f) Squash. #104 closes through "Closes #104". If it does not, the orchestrator closes it as completed with the merge commit.
- (g) The `master` push run after the squash is posted with the architecture test's stage 6 time (the PRF-03 trigger). A red comes back to master.
- **Order with #265:** they share no file, so either may squash first. The docs PRs (records and D) merge before the second one's update, so it is updated once (DL-155 (2)).

**Risks registered:** none new. RISK-023 stays at 8 (path 4:25, no E2E added).
**Rationale:**
- **Why CONDITIONAL GO.** Every mandatory item passes, and every DL-156 condition the developer and reviewers owned is met on evidence I read (CI, the jobs API, the merge's `--cc`, the Jira description, `git grep`). What is left is one new Minor and a docs condition that DL-156 already placed before the squash.
- **Why no review round for A.** A is test-only and confined to named files. It is the reviewer's suggested code, plus comments and one pinned case, and I verify it from the diff (DL-047, DL-124).
- **Why QA for G7.** The story has ACs and a config change, and QA's plants add forms that neither the developer nor the reviewer tried.

Alternatives considered:
- GO with STD-13 deferred to #259. Rejected: #259 copies the helper into three more files, so the gap should close at the template.
- A reviewer-standards re-read of A. Rejected: master reads it, and any line outside the named scope brings the reviewer back.
- G7 by master. Rejected: the DL-124 preconditions are not met.
- PRF-03 now. Rejected: it would cost a plant round to save test-file time, so it is set on a trigger in #259 instead.

**Posted:** Jira AQP-237 comment 11542; PR #250 comment 6811556723; GitHub #259 comment 6811493411.

## G6 – Peer Review — AQP-237 (STORY-10.18) — A-check: condition A of DL-161 against commit d447e18, and condition D — 2026-11-11

- **Decision:** **condition A is MET.** Commit d447e18 stays inside the four named files, its two lines in `audit-transaction-check.ts` are comments, and both CI runs read the DL-161 (7)(c) invariant with k = 3. No line goes beyond the named scope, so reviewer-standards does not re-read. **G6 is closed. The CONDITIONAL GO (DL-161) stands with no open developer condition. AQP-237 may go to In QA now, for G7 by qa-engineer on head ea9aaab.** **Condition D is MET in content** (architecture v0.40 §6 and test strategy v0.35 §10 match DL-161 (5) item by item). **Its due point is still open:** b28c1b2 is on the records branch, which has no PR yet, and D must be on `master` before #250's final update and squash (DL-161 (7)(a)). D does not hold G7.
- **Decided by:** master  ·  **Human override:** none
- **Artefacts evaluated:**
  - **Commit A** (`git show d447e18`, read in full). Its parent is 57acbae. 4 files, +36 / -2: `tests/support/lint-fixture.ts` (+9 / -2), `tests/unit/lint/transaction-handle-rule.test.ts` (+10), `tests/support/audit-transaction-check.ts` (+2), `tests/support/audit-transaction-cases.ts` (+15). Nothing under `src/`, and no change to `eslint.config.mjs`, a workflow or a dependency.
  - **Head ea9aaab** (`git log -1 --format=%P`): a merge of 774eff8 into d447e18. `git show --cc ea9aaab` has no combined hunk. `git diff d447e18 ea9aaab` over the PR's 8 files is empty. What the merge brings is `master`'s 5b4e6e9..774eff8: `package.json` and `package-lock.json` only (#150, next 16.4.5).
  - **CI on d447e18:** run **43135521817**, attempt 1, the only run on that head. Its merge ref is **f171796** (d447e18 into `master` **5b4e6e9**), read from "HEAD is now at" in all five jobs. Jobs API: 5 of 5 `success`.
  - **CI on ea9aaab:** run **43136706441**, attempt 1, the only run on that head. Its merge ref is **4909bca** (ea9aaab into `master` **774eff8**). Jobs API: 5 of 5 `success`.
  - **Base runs:** push run **43134732280** on 5b4e6e9, whose log I read for this check, and push run **43135619452** on 774eff8 (read for DL-163). Each reads unit 2,922, full 5,285, E2E 265 / 263 / 250 = 778, skipped 3 / 4 / 17 = 24.
  - **Developer:** PR #250 comment 6811921021; Jira 11549; the PR body's round-3 section (lines 62 to 85). The orchestrator's brief: Jira 11550.
  - **Condition D:** `git show b28c1b2`. In architecture v0.40 I read §6 "The two checks as built", the §10 rows and the change-log row. In test strategy v0.35 I read the §10 totals, the time range, and §10.5 item 11. solution-architect's hand-off is Jira 11547. `git ls-remote`: `docs/AQP-1-records-sprint1-h` is at dca1e78 (it holds b28c1b2) and `master` is at 774eff8. `gh pr list --head docs/AQP-1-records-sprint1-h`: no PR.
  - **Not re-run by me:** the developer's local STD-13 control (2 failed of 113 against the old helper, PR body line 72), and the local `tsc` and ESLint runs. CI stages 4, 5 and 6 are green on both heads.

**Checks of condition A** (DL-161 condition A and the A-check row)
| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | One commit, the 4 named files only | ✅ | `git show --stat d447e18`: 4 files, +36 / -2. The commit before it is 57acbae. There is no other commit between 57acbae and ea9aaab except the merge, which leaves the PR's files unchanged |
| 2 | Every changed line in `audit-transaction-check.ts` is a comment | ✅ | Two added lines. `:38` is a JSDoc header line: "ACCEPTED: a `record` whose error is caught and not rethrown inside the callback; error handling is outside this check (X1, QLT-08)". `:233` is a `//` comment on the `forEachChild(...) \|\| undefined` idiom (STD-15 (2)). Nothing is deleted |
| 3 | STD-13 behaviour | ✅ | `lint-fixture.ts:30-40`. `messagesFor` checks `eslint.isPathIgnored` first and throws "`<path>`: ESLint ignores this path…". It throws "…returned no result" when `result` is undefined. On a `fatal` message it throws "…the fixture does not parse: `<ESLint's message>`". Other `ruleId: null` messages are still dropped. The comment above it names STD-13 |
| 4 | Two new tests, shown red against the old helper | ✅ | `transaction-handle-rule.test.ts:103-111`: a syntax error (`export const = ;`) rejects, and `src/generated/example.ts` rejects. `src/generated/**` is in `globalIgnores` (`eslint.config.mjs:189`), so the second test does reach the ignore branch. The red control is the developer's local run, with the diff shown (PR body line 72). I did not re-run it. The "no result" branch has no test, and DL-161 did not ask for one |
| 5 | If an existing row throws, the fixture is fixed, not the helper | ✅ | `transaction-handle-rule.test.ts` is the only user of `createLintFixture` (`git grep` at d447e18). It reads 113 of 113 green on both runs (111 earlier rows plus 2), so no row threw and no fixture changed |
| 6 | QLT-08: the header line and one pinned `OPEN_LIMITS` case | ✅ | `audit-transaction-cases.ts:251-264`, X1: `try { await audit.record(tx, entry) } catch { }` after `things.add('a', tx)`, with `records: 1` and `findings: []`. It runs through `it.each(OPEN_LIMITS)` (`audit-transaction-architecture.test.ts:88`), and the file reads 46 tests where it read 45. So QLT-06's rule that every ACCEPTED form is pinned still holds |
| 7 | STD-14, STD-15 (1) and PRF-03 unchanged | ✅ | No change to `parameterOf`. No `tsconfig` or program-option change. `aqp-27-scaffold.test.ts` is untouched |
| 8 | CI 43135521817 (d447e18 on 5b4e6e9) | ✅ | 5 of 5, attempt 1. Unit **3,081**, full **5,444**, E2E **265 / 263 / 250 = 778**, skipped **24**. That is 43134732280 **+159 / +159 / +0 / +0** = (156 + k), with **k = 3** (2 lint-fixture tests and 1 `OPEN_LIMITS` case, which counts against the diff). 18 cache restores, no `Cache not found`. Gitleaks: 699 commits, no leaks. Path **4:52**: first job at 01:35:19Z, `Stages 1 to 11` ended 01:40:11Z, and the fan-in waited 3 s. Slack +43 s (shard 3, 283 s, minus `Stages 1 to 11b`, 240 s) |
| 9 | CI 43136706441 (ea9aaab on 774eff8) | ✅ | 5 of 5, attempt 1. **3,081 / 5,444 / 778 / 24** = 43135619452 **+159 / +159 / +0 / +0**, so the invariant holds on the new base too. Playwright 1.65.0 moves no E2E count on this branch (DL-163 (4)(b)). 18 cache restores, no miss. Gitleaks: 702 commits, no leaks. Slack +83 s (shard 2, 314 s, minus 231 s). **Path 8:17:** the slowest shard ended at 5:15, and then `Stages 1 to 11` waited **2:54 in the queue** (01:50:57Z to 01:53:51Z) before running for 8 s. That wait is runner queue, not the PR's work. It is reported, not held (DL-151), and it is not a RISK-023 reading |
| 10 | Matched lines read, every attempt | ✅ | One attempt on each head. The `flaky` matches are the `fix/AQP-268-flaky…` and `fix/AQP-272-flaky…` branch names in the fetch output. `failed=1` at line 5955 is the fan-in script's source text, which the log echoes. The one `FATAL: password authentication failed for user "accucut_owner"` line in the container log is also in base run 43134732280, so it was there before this PR. No retry and no `✘` |
| 11 | Overlap since 57acbae | ✅ | `master` 5b4e6e9..774eff8 is `package.json` and the lockfile only. #250 changes neither file |

**Condition D** (DL-161 (5); DL-156 (8))
| Item DL-161 (5) names | Result | Where in v0.40 / v0.35 |
|---|---|---|
| The lexical holder at the call and at each step | ✅ | §6 "The lexical holder…" |
| The awaited / returned / arrow-body chain | ✅ | §6 "Awaited, returned or an arrow body" |
| Receiver type `AuditService`; a non-callee use refused; `z.record` not visited | ✅ | §6 "Check 2, which calls it visits" |
| The product-owner's step count | ✅ | §6 "The step count": 3 calls below the callback pass, 4 fail |
| The count 15 | ✅ | §6 "The count (AC-4)": 5 + 6 + 3 + 1, with "at least 15" pinned |
| The ACCEPTED forms | ✅ | §6 L1 to L5. L2 is Q5 / QLT-04 → #259, and L5 is QLT-08, now true at d447e18 |
| STD-08, the Engineer `transaction` entry | ✅ | §6 "What the Engineer allow-list entry `transaction` means", plus the §10 row |
| The PRF-01 baseline as a range with a host factor | ✅ | Test strategy §10: 5.2 / 4.1, 4.4 / 3.4, 10.5 / 10.6 and 7.7 s, with a host factor and a normalised value for each |
| The §10 Vitest totals | ✅ | Test strategy §10, "Vitest totals of record" (57acbae, plus k from condition A) |
| **On `master` before #250's final update and squash** | ⏳ open | Records branch only (b28c1b2 under dca1e78). There is no PR, and `master` is 774eff8 |

One sentence in D is out of date, and it does not need a fix before the squash. Test strategy v0.35 §10 says "`master` has since moved to 8ebe529… read for the update". `master` is now 774eff8, and DL-163 (4)(a) governs which base is read. The architect corrects it at the next edit of §10, together with the readings below.

**Rulings**
1. **A is met, and G6 is closed.** The orchestrator moves AQP-237 to In QA (DL-161 (8)). No review round and no reviewer re-read are needed. **The G7 head is ea9aaab**, and its run is 43136706441. If the head changes before G7, QA gathers the evidence on the new head, and the invariant is recomputed against that merge ref's `master` push run.
2. **X1 is missing from the test file's header** (`tests/unit/audit-transaction-architecture.test.ts:19-21`, which the developer raised). **No change in #250, and no defect.** That header is a summary, marked "in short". It names `audit-transaction-check.ts` as the file that holds "the list of what it does not see" (lines 15-16), and that list does carry X1 (line 38). The rule that every ACCEPTED form is pinned is met by the `OPEN_LIMITS` case. The file was outside A's four files by my own condition, so the developer was right to leave it. **It goes to #259 as one line:** the next change to that header adds X1, or replaces the short list with a pointer to the full one. #259 already reopens the same file for QLT-04 (L2). Master posts this on #259.
3. **PRF-03 trigger.** The trigger is stage 6 **over 8 s**, not 10 s, on **both** QA's G7 run and the first `master` push run after the squash (DL-161 (4); test strategy v0.35 §10). If the G7 head stays ea9aaab, QA's G7 run is 43136706441, and its stage 6 reads **9,863 ms**. That is over 8 s, so the trigger then depends on the post-squash `master` push run alone. The orchestrator posts both readings on #259, as DL-161 (7)(g) already says.
4. **Time readings for the record** (host factor = the median, over the other stage files over 1 s, of their time against reference run 43053208506, by the test strategy §10 definition; computed by me from the logs). On d447e18 (43135521817): stage 6 **10,579 ms**, factor 1.07, normalised 9.9 s; stage 11 **10,373 ms**, factor 1.14, normalised 9.1 s. On ea9aaab (43136706441): stage 6 **9,863 ms**, factor 1.06, normalised 9.3 s; stage 11 **13,825 ms**, factor 1.10, **normalised 12.6 s**. The stage 6 readings are inside the normalised range of 4.5 to 9.9 s. **Stage 11 on ea9aaab is above it.** AC-5's line is the unit stage, so this is not an AC-5 report. It is an observation: QA reads stage 11 again on the G7 run, and the architect adds all four readings to the §10 range at the next edit. A new high is evidence for #259's PRF-03 item, not a finding against #250. The test keeps its 120 s hook limit (DL-057).
5. **The merge pre-rulings of DL-161 (7) are unchanged**, with DL-163 (4)(a) for the base. ea9aaab is an update by merge commit, which (7)(b) allows. The "final update" before the squash is the one after the records PR, which carries D, DL-161, DL-162, DL-163 and this record, has merged.

**G7 brief points for qa-engineer** (adding to DL-161 (6)):
- **Head and run:** ea9aaab, run 43136706441 (merge ref 4909bca on 774eff8), 5 of 5.
- **Count invariant on ea9aaab:** unit **3,081**, full **5,444**, E2E **778** (265 / 263 / 250), skipped **24** (3 / 4 / 17). That is 774eff8's push run 43135619452 + (156 + 3) / (156 + 3) / +0 / +0. A different head is recomputed against its own merge ref's `master` push run.
- **AC-4:** "at least 15" with `checked` read on the G7 run, and `git grep -c "\.record(" -- src/server/services` = 15 at ea9aaab.
- **AC-5:** the stage 6 file time on the G7 run is 9,863 ms with host factor 1.06. That is under the 10 s report line and over the PRF-03 8 s line, which you state. Stage 11 reads 13,825 ms (normalised 12.6 s), which you note. QA reports the readings and does not rule on PRF-03.
- **Header lists:** QLT-08 / X1 must be in `audit-transaction-check.ts:38` and pinned in `OPEN_LIMITS`. The missing X1 in the test file's header summary (`:19-21`) is ruled in ruling 2 above: #259, not a defect.
- **STD-13:** if your plants use the lint fixture, an ignored path or a fixture that does not parse now throws. Read a throw as the fixture refusing an unread file, not as a rule finding.
- **Plants (i) to (iii) of DL-161 (6)** go on one `master`-based control PR (from 774eff8 or later), with each diff printed first. Your plants on that PR run in CI. If you run anything locally on ea9aaab, the lockfile changed when the branch took `master`, so DL-163 (4)(d) applies: check free disk first, run `npm install` (never `npm ci`) only in that worktree, and report a full disk as a blocker.
- **Path:** 8:17 on 43136706441, of which 2:54 was the fan-in waiting in the queue. Report the path, the queue wait and the slack together, and do not hold on them (DL-151). If you need a reading for RISK-023, use a run with no queue wait.
- **Regression:** CI 5 of 5 on the G7 head. JQL for open Sev-1 or Sev-2 Bugs.

**Risks registered:** none new. RISK-023 stays at 8: the 8:17 path is queue time, not work.
**Rationale:** Commit A matches its condition line by line: the four files, comments only in the check, the reviewer's behaviour for STD-13 with two tests, and the pinned X1 case. The count delta is exactly what the diff predicts (k = 3) on two different bases, and on the second base the merge leaves the PR's files unchanged. Master's reading therefore stands in for a re-review, as DL-047 and DL-124 allow and as at AQP-227 (2026-11-09). D's text matches every item DL-161 (5) named. Only its route to `master` is outstanding, and that is a pre-squash item, not a G7 one.

**Posted:** Jira AQP-237 comment 11551; PR #250 comment 6812109459; GitHub #259 comment 6812110618.

## G6 – Peer Review — tech-debt #245 (`useMasterList`, the shared dialog opener, Process on `MasterSearchBox`, `RUPEE` in `master-rules.ts`; PR #265 at dcdad49) — 2026-11-11 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-162)**, on the two-review route of DL-153 (2) (reviewer-standards and reviewer-quality).
  - Both reviews approve with comments, with 0 Blocker, Critical or Major.
  - **Latest-read-wins is ruled IN** for Process, Materials and Treatment / Color.
  - Condition A is one push in `use-master-list.ts` and the PR body: STD-01, STD-02 and QLT-02.
  - Condition R: reviewer-quality re-reads the push and re-plants P1 and P3.
  - QLT-01 goes to new issue #277.
  - **G7 is decided by master with no QA run** (DL-124 pattern), after A and R.
  - The squash says "Refs #245", and #245 stays open for item 5.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - PR #265 at **dcdad49**: 5 commits (9f08d56, 0411da8, ccda23c, 5c98b89, dcdad49), 16 files (+205 / -165), all under `src/`, and `git diff --stat origin/master...` shows no test file.
    - Body read in full: the items table, the "differences" table, decisions 1 to 8, the Dev Record, and the controls #268 / #269.
    - Closing keywords (`close`, `fix`, `resolve` followed by `#N`) in the title and body: **none**. "Refs #245" is on line 3.
  - `docs/06-reviews/245/standards.md`, `quality.md`, `consolidated.md`; reviews 5867110166 and 5867213193; #245 comments 6810555942 and 6810768969; brief PR comment 6811357128.
  - **The hook source at dcdad49, read in full** (`use-master-list.ts`, 87 lines).
    - Line 75 (`if (mine !== newest.current) return;`) drops every read that is not the newest when it answers, while lines 24-25 say "it only matters when ... the older one answers last". **STD-01 is confirmed.**
    - `read` is `useCallback(..., [readList])`, and `use-treatments.ts` starts its first read in an effect on `read`. **QLT-02 is confirmed:** an inline `readList` would read in a loop.
  - **Other diffs read:** `master-rules.ts`, `process-items.ts`, `exchange-rates.ts`, `material-texts.ts` and `audit-events.ts`. These are the `RUPEE` move plus import lines. `audit-events.ts` changes one import and no `record` call, so #250's check still counts 15.
  - **CI** (`gh run list --branch tech-debt/245-use-master-list`): 43057465219 on 5c98b89 is `cancelled` in the API (the body calls it the red `tokens.test.ts` run; moot after dcdad49). **43058209908** on dcdad49 is attempt 1 and the only run on the head. The jobs API shows 5 of 5 `success`.
    - `Stages 1 to 11` ran from 16:30:48Z to 16:30:54Z: path **5:17** from the run start (16:25:37Z), and **4:45** from the first job start, which is the body's figure. Merge ref **2ea4570** (dcdad49 into 2891457).
    - Unit 151 files **2,922**; full 210 files **5,285**; E2E **265 / 263 / 250 = 778**, skipped **24**. That is 2891457's push run 43053208506 **+0 / +0 / +0 / +0**.
    - 18 cache restores, no miss. Gitleaks: 681 commits, no leaks.
    - Matched lines read: the two `flaky` branch names, a workflow comment, and passing titles.
    - First-load JS from the 11b log: `/masters/materials` 186,678 and `/masters/process` 174,325, both within 200,000.
  - **Plants** (read from the reports and the body):
    - reviewer-quality: #273 P1 red 3 (`treatments-focus.spec.ts:213` at three widths), #275 P3 red 9, #274 P2 green, #276 P4 green.
    - developer: #268 A1 and #269 A2. Their failed lists equal DL-150 (1)'s for #235's plants, so the move changed nothing the suite can see. The Process and Materials gap is #244's.
  - **Overlap:** #265's 16 files share no path with #250 (8 files), #253 (32) or #222. `master` since 2891457 is docs only.
  - **Jira:** no open Sev-1 or Sev-2 Bug (the same JQL, 2026-11-11).
  - reviewer-performance was not required (DL-150 (1)): there is no route, query, schema, dependency or CI change, and the JS figures above are the performance surface.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Reports present (route of DL-153 (2): standards, quality) | ✱ | ✅ | `docs/06-reviews/245/`; reviews 5867110166, 5867213193 |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | Both reports: 0 |
| 3 | Major findings fixed or accepted | | ✅ | None |
| 4 | Findings cite file:line | | ✅ | STD-01 to STD-06, QLT-01 to QLT-07 |
| 5 | #245 items 1 to 4 done; item 5 held with a recorded reason | | ✅ | Both conformance tables; decision 7 checked by STD-04 and QLT-06 |
| 6 | DL-153 (2): differences between the three copies stated | | ✅ | Body table; latest-read-wins declared → ruling below |
| 7 | Behaviour preserved, apart from the declared change | | ✅ | QLT-04 tables; P3 red 9; A1 and A2 lists = DL-150 (1) |
| 8 | Shared hook safe for its next caller (AQP-142) | | ⚠️ | QLT-02 (identity tied to `readList`); STD-01 and STD-02 (the contract text) → condition A |
| 9 | Regression net on the new shared dialog pieces | | ⚠️ | P2 and P4 green (QLT-01) → #277 |
| 10 | CI, counts, JS | | ✅ | 43058209908: 5 of 5, +0 / +0 / +0 / +0, JS within budget, path 5:17 |

**Ruling: latest-read-wins is IN.**
- **What it fixes.** Before, on Process and Materials, an older read that answered last could replace a newer list. The just-saved row then went missing under its "saved" notice. Or it could replace a good list with a load error that takes focus (the DEF-020 path). Now both are ignored.
- **What is visible.** The end state of a correct run is unchanged. The one new visible difference is that the status stays `loading` (skeleton after 300 ms, `aria-busy`) until the newest read answers. If the older read succeeds and the newest fails, the rows stay as they were before both reads, with the load error.
- **Why it is in.** Treatment / Color and Exchange rates already behave this way. DL-153 (2) asked the PR to state how it treats exactly this difference, and it did. The shared line is pinned at three widths (P1).
- **Not a scope change.** No AC, FR, UX or architecture text changes, so nothing is escalated.

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due |
|---|-------------|----------|-----------------|-----|
| A | developer | PR #265: `src/components/features/masters/use-master-list.ts` and the PR body only | **STD-01:** the comment at :24-25 states the rule as built, using the ruling's words above (any read that answers after a newer one started is ignored, whichever answers first; `loading` until the newest answers; the older-success / newest-failure case). Fix the body's "Treatments' latest-read-wins" row to match. **STD-02:** a doc comment on `useMasterList` (`initialItems` as a list or `null`, then `read()` once; a failed read sets `error` and keeps the rows; nothing throws). **QLT-02 (behaviour):** `read` and `refresh` keep their identity whatever function the caller passes as `readList`, and always call the latest one. For a module import, nothing changes. Reviewer-quality's ref sketch meets this. Reword the option's "must be the same function" sentence and decision 2 to match. No test file and no other file changes. Counts against the merge-ref `master` push run: +0 / +0 / +0 / +0. Dev Record: a round-2 row. "Refs #245" stays, with no closing keyword | Now |
| R | reviewer-quality | PR #265 review, round 2; one `master`-based control PR | Read the push diff only (QLT-02 changes runtime code, DL-091). Re-plant **P1** and **P3** on the fix head, each diff printed. Both must be red as before: P1 in `treatments-focus.spec.ts:213` at three widths, P3 red 9. If the push changes anything in `use-master-list.ts` beyond the comments, the latest-function mechanism and `read`'s dependency list, reviewer-standards reads it too. Otherwise master checks STD-01 and STD-02's text at G7 (DL-047) | After A |
| T | developer (reviewer-quality controls) | GitHub **#277** (created by master) | QLT-01: E2E for the press guard and the failed-dialog title on Process and Materials, at three widths, with P2 and P4 re-planted red. Branch after #265 merges; narrow reviewer-quality route | Before the G6 of #245 item 5's PR; at the latest G8 |
| H | delivery lead | Remote branches | `control/245-qlt-*` (#273 to #276), and any plant branch left from #266 to #269 | Before G8. Does not hold the merge |

**Other rulings:**
- **#244** branches from `master` after #265 merges (QLT-07), so its A1 and A2 controls plant the code AQP-142 composes. Its due point is unchanged: before AQP-142's G6. This replaces DL-150 (4)'s "after #235 merges".
- **QLT-01 goes to #277, not #244, by default.** #244 holds AQP-142's G6, and SCR-12's edit is a page of its own (QLT-05; AQP-142 Dev Context), so the dialog tests need not hold AQP-142. It may ride with #244 if that does not move #244's due point.
- **Info, no action and no issue:** STD-03 (DL-150 (6)'s recommendation stands), STD-04 and QLT-06 (item 5 held; #245 stays open, due G8 per DL-150 (5)), STD-05 (moot after the squash), STD-06 (#277 and P3 cover it), QLT-03 (the ruling above), QLT-04, QLT-05 and QLT-07.
- **AQP-142:** DL-153 (2) is unchanged. AQP-142 does not reach G5 before #265 merges and its branch takes it by a merge from `master`. QLT-02 is fixed in the hook, so no Dev Context line is needed.

**G7 route: master, no QA run, after A and R.** G7 rests on:
- (a) A's diff read by master, within the named file and the body;
- (b) reviewer-quality's round 2 with no Blocker, Critical or Major, and P1 and P3 red;
- (c) CI on that head 5 of 5, from the jobs API, every attempt read, with counts = the merge-ref `master` push run +0 / +0 / +0 / +0, matched lines read, and JS within 200,000;
- (d) no open Sev-1 or Sev-2.

**Merge (orchestrator, `CLAUDE.md` §8), pre-ruled:**
- (a) Done first: master's G7 GO, and the records PR with DL-162 on `master` (before this PR's final update if it squashes second).
- (b) #265 is updated by a merge commit only. `git diff <G7 head> <new head>` over the 16 files must be empty, and it is posted. The overlap is re-checked.
- (c) **Invariant:** counts = the push run of the `master` commit in the merge ref +0 / +0 / +0 / +0. If #250 merged first, it moves `master` by +156 + k.
- (d) 5 of 5 with every attempt read. The JS figures are posted. A red comes back to master and is not re-run.
- (e) The head, run, counts and path are posted on PR #265 and #245 before the squash.
- (f) **The squash message says "Refs #245" and contains no "Closes", "Fixes" or "Resolves #245".** If #245 closes anyway, the orchestrator reopens it with a comment (item 5 is open).
- (g) The `master` push run after the squash is posted. A red comes back to master.
- **Order:** no file is shared with #250, so either order works. #265 is expected first, because it gates AQP-142's G5 and #244's branch point.

**Risks registered:** none new.
**Rationale:**
- **Why CONDITIONAL GO.** No Blocker, Critical or Major. The open Minors sit in the one shared file that AQP-142 composes next. The AQP-113 rule applies: fix the first instance that others copy, while the push is cheap.
- **Why QLT-02 in this PR and not as an AQP-142 Dev Context line.** A Dev Context line protects one caller. The hook protects every caller, at the cost of a narrow re-read.
- **Why master decides G7.** There is no AC. The one behaviour change is pinned on its shared line at three widths, and it only shows under overlapping reads that a manual run cannot produce reliably. The plants are a reviewer's (DL-124).

Alternatives considered:
- Rule latest-read-wins out (a flag keeping the old race). Rejected: it keeps a known stale-list and false-error path, behind a second code path nobody tests.
- STD-01 and STD-02 as body-only fixes, with GO on dcdad49. Rejected: the comment is the contract that AQP-142 reads (Coding Standards §8).
- QLT-01 inside this PR. Rejected: a refactor keeps its tests unchanged (DL-129 (5)).
- QLT-01 into #244. Not the default, because it would load AQP-142's G6 with tests SCR-12 does not need.

**Posted:** Jira AQP-1 comment 11543; PR #265 comment 6811563571; GitHub #277 (created); #244 comment 6811566605.

## G7 – QA Acceptance — tech-debt #245 (`useMasterList` and the shared master pieces; PR #265 at aad53e9) — 2026-11-11 (attempt 1)

- **Decision:** **GO (DL-164)**, decided by master with no QA run, as DL-162 (8) set (DL-124 pattern).
  - Condition A (65af06b) and condition R (reviewer-quality round 2) are met.
  - Master checked STD-01 and STD-02's text itself (DL-047, DL-162 (4)): both state the ruled rule.
  - The merge is pre-ruled below. It needs an update by merge commit after records PR #285 merges.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **Condition A, read in full by master:** `git diff dcdad49 65af06b` is 1 file, `use-master-list.ts`, +20 / -7, and no test file.
    - STD-01: the module comment (:24-27) says any read that is not the newest when it answers is dropped, whichever answers first; the status stays `loading` until the newest answers; if the older read succeeds and the newest fails, the older rows are not applied and the status is `error`. A single read, or two that do not overlap, behave as before. This is DL-162 (2) word for word in substance.
    - STD-02: a doc comment on `useMasterList` (:61-65) covers `initialItems` or `null` then `read()` once, stable `read` / `refresh`, a failed read keeping the rows, and nothing thrown.
    - QLT-02: `readListRef` (:77) is updated by a no-deps effect (:80-82), and `read` is `useCallback(…, [])` calling `readListRef.current()`. The option doc (:35-36) is reworded. The guard (`if (mine !== newest.current) return;`), the setters and `refresh`'s `loading` step are unchanged.
  - **Branch update:** aad53e9 has parents 65af06b and 774eff8. `git show --cc aad53e9` prints no hunks. `git diff --name-only 774eff8 aad53e9` lists the same 16 files, and `git diff 65af06b aad53e9` over those 16 files is empty. Tree bbddcdd.
  - **PR body:** no closing keyword (`close`, `fix`, `resolve` + `#N`) in the title, body or the six commit messages. "Refs #245" is on line 5. The Dev Record has the round-2 table (STD-01, STD-02, QLT-02 at 65af06b; QLT-01 routed to #277).
  - **Review:** `docs/06-reviews/245/quality.md` Round 2; review 5867836989, APPROVE WITH COMMENTS. Blocker, Critical, Major and Minor open on the PR: 0. QLT-02 Fixed. QLT-08 (Info) is new. reviewer-standards was not needed: the push stays within the comments, the latest-function mechanism and `read`'s dependency list.
  - **Plants, read by master:** both control PRs are based on `master`, from aad53e9, and closed unmerged.
    - #278 (6526213): `:88` `mine !== newest.current` became `mine > newest.current`. Run 43137195323 is red only in `treatments-focus.spec.ts:213` at mobile, tablet and desktop (3, each with its retry). Stages 1 to 11b green.
    - #279 (0ac0f46): `:94` `setStatus('loading');` removed. Run 43137205416 is red only in `process-master.spec.ts:337`, `materials.spec.ts:335` and `aqp-122-qa.spec.ts:277`, each at three widths (9).
    - Both lists equal round 1's (#273, #275). Master printed both diffs against aad53e9 before reading the results.
  - **CI** (`gh run list --branch tech-debt/245-use-master-list`): 43135407890 on 65af06b is `success`, attempt 1 (superseded head). **43136387943 on aad53e9** is attempt 1 and the only run on the head.
    - Jobs API: 5 of 5 `success`. Merge ref **3c18dcd** (aad53e9 into **774eff8**), read from "HEAD is now at" in every job.
    - Unit 151 files **2,922**; full 210 files **5,285**; E2E **265 / 263 / 250 = 778**, skipped **3 / 4 / 17 = 24**. That equals 774eff8's push run 43135619452 (DL-163 (3)) **+0 / +0 / +0 / +0**, per shard as well (DL-163 (4)(b)).
    - 18 cache restores, 0 "Cache not found". Gitleaks: 701 commits, no leaks.
    - Matched lines read: three `Unable to reserve cache` saves, the `failed=` fan-in script, the expected Postgres auth line, four branch names in the fetch listing and passing titles. No `✘`, no retry.
    - JS (11b, gzip): `/masters/materials` **186,501**, `/masters/process` **174,153**, both within 200,000.
    - **Path 5:38** from the run start (01:42:49Z to the end of `Stages 1 to 11` at 01:48:27Z), 5:35 from the first job. The fan-in waited 2 s; the longest job, shard 2, took 5:23.
  - **Jira:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none (2026-11-11).
  - **Brief:** PR #265 comment 6812243534. Its figures match what master read.

**Checklist** (DL-162 (8); there is no AC)
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | (a) A's diff within `use-master-list.ts` and the body | ✱ | ✅ | `git diff dcdad49 65af06b`: 1 file, +20 / -7 |
| 2 | STD-01 and STD-02 text states the ruled rule (DL-047) | ✱ | ✅ | `use-master-list.ts:24-27`, `:61-65` against DL-162 (2) |
| 3 | QLT-02: `read` / `refresh` stable for any `readList`, latest one called | ✱ | ✅ | `:77`, `:80-82`, `:84-91`; quality.md round 2 |
| 4 | (b) Round 2 with no Blocker, Critical or Major | ✱ | ✅ | Review 5867836989 |
| 5 | (b) P1 and P3 red as before | ✱ | ✅ | #278 red 3, #279 red 9; diffs printed by master |
| 6 | (c) CI 5 of 5, every attempt read, +0 / +0 / +0 / +0 against the merge-ref push run | ✱ | ✅ | 43136387943 against 43135619452 |
| 7 | (c) Matched lines read; JS within 200,000 | ✱ | ✅ | Above |
| 8 | (d) No open Sev-1 or Sev-2 | ✱ | ✅ | JQL: none |
| 9 | Branch update clean, 16 files unchanged | ✱ | ✅ | `--cc` empty; diff over 16 files empty |
| 10 | No closing keyword; "Refs #245" | | ✅ | Body line 5; title and commits clean |
| 11 | Path | | ⚠️ (reported) | 5:38; not held (below) |

**Rulings:**
- **Path 5:38.** It is a reading (0 cache misses) of 5:30 or more, so it is reported, not held (DL-142 (1), DL-151). No median of five is ordered: the PR adds no test, so the run measures `master`'s suite. RISK-023 at 8 and the half-triggered next step are already in force (DL-152 (3)).
- **QLT-08 (Info): no action.** The passive-effect ref is the house pattern (`use-first-open.ts`). It matters only for a caller that passes an inline `readList` over changing props and starts a read from a layout effect or a child's mount effect. AQP-142's Dev Context does not change (DL-162 (7)). reviewer-quality reads AQP-142's `useMasterList` call against QLT-08 at its G6.
- **PR body, Info:** the DoD line "Docs / config updated … (none: behaviour-preserving)" calls the PR behaviour-preserving, though it declares latest-read-wins. "None" is right (DL-162 (2): no AC, FR, UX or architecture text changes), and the change is declared in the body's table. The developer may correct the words; it is not required.

**Merge prerequisites (orchestrator, `CLAUDE.md` §8), restated from DL-162 (9) for aad53e9:**
- (a) **Done first:** this GO; and records PR #285 (with DL-162) squashed onto `master`. #285 is behind `master` by the three Dependabot commits, so it is updated first; it moves `master` by docs files only. DL-164 rides on #285 if the orchestrator can commit it there before #285 merges, otherwise on the next records PR. It does not hold #265.
- (b) **Update #265 by merge commit only** if `master` has moved from 774eff8 ("Update branch" is fine; no rebase, no force-push). `git show --cc <new head>` must print no hunks, and `git diff aad53e9 <new head>` over the 16 files must be empty. Both are posted. If #250, #253 or #222 has merged in the meantime, the overlap with the 16 files is re-checked; a shared path comes back to master.
- (c) **Invariant:** the run on the new head reads its merge ref ("HEAD is now at <ref> Merge <head> into <master sha>"). Its counts are that `master` commit's push run **+0 / +0 / +0 / +0** (unit, full Vitest, E2E passed, skipped), per shard too. On #285's squash over 774eff8, if its push run reads 2,922 / 5,285 / 265 / 263 / 250 / 3 / 4 / 17, the target is exactly that. A per-shard difference is reported with its cause before the squash (DL-163 (4)(b)).
- (d) 5 of 5 from the jobs API, `Stages 1 to 11` read, every attempt read, matched lines read. `/masters/materials` and `/masters/process` JS posted, within 200,000. A path of 5:30 or more is reported, not held. **A red comes back to master and is not re-run.**
- (e) **Before the squash**, the head, run, merge-ref `master` and its push run, the counts with the arithmetic, JS and path are posted on PR #265 and on #245.
- (f) **Squash message: "Refs #245", with no "Closes", "Fixes" or "Resolves"** in the title or body. The orchestrator writes the body itself rather than keeping the default commit list. If #245 closes anyway, the orchestrator reopens it with a comment: item 5 is open.
- (g) The `master` push run after the squash is posted. A red comes back to master.

**What may start once #265 is on `master`:**
- **#244** (developer; DL-150 (4), DL-162 (6)): branch from `master` after the squash. Slow-read focus E2E for Process and Materials (both branches) and Treatments (ready branch), at three widths, with STD-04 and STD-06 riding. reviewer-quality re-plants A1 and A2 on a `master`-based control. Narrow reviewer-quality route. Due before AQP-142's G6, at the latest G8. A new test that is red on `master` is a regression defect.
- **#277** (developer; DL-162 (5)): branch after the squash. Press guard and failed-dialog title on Process and Materials at three widths, with P2 and P4 re-planted red. It may ride with #244 if #244's due point does not move. Due before the G6 of #245 item 5's PR, at the latest G8.
- **AQP-142** (DL-153 (2), DL-162 (7)): its branch takes `master` by a merge commit (no rebase or force-push). Its Customers list calls `useMasterList` and composes the shared pieces; an inline `readList` is now safe. Then it may reach G5. Its G6 still waits for #244 (DL-150 (4)).
- **#245** stays open for item 5 (the Users copies, after #222 and #171), due G8 (DL-150 (5)).
- **H (delivery lead, before G8, does not hold the merge):** delete `control/245-qlt-*` (#273 to #276) and the round-2 `control/245-qlt-r2-p1-no-latest-read-wins` (#278) and `control/245-qlt-r2-p3-refresh-no-loading` (#279), plus any branch left from #266 to #269.

**Risks registered:** none new. RISK-023 stays at 8 (the 5:38 path is reported under DL-151).
**Rationale:**
- **Why GO.** Every test DL-162 (8) set holds on evidence master read itself: the diff, the merge commit, the plant diffs and their failed lists, the jobs API, the logs and JQL. There is no open condition on the head. The remaining duties are merge mechanics that DL-162 (9) already ruled.
- **Why no QA run.** DL-162 (8) still applies: there is no AC; the one behaviour change only shows under overlapping reads; and it is pinned at three widths by a reviewer's plants that were re-run on this head.
- **Why DL-164 does not hold the merge.** The decision is posted on PR #265 and AQP-1 (the systems of record, §7.1). Holding #265 for another records PR would force a second update and CI run with nothing new to judge (DL-155 (2)).

Alternatives considered:
- CONDITIONAL GO with a body edit for the DoD wording. Rejected: the wording misroutes nothing, and "none" is correct.
- A reviewer-standards read of 65af06b. Rejected: its trigger in DL-162 (4) is not met, and master read STD-01 and STD-02 itself.
- A median of five for the 5:38 path. Rejected: +0 E2E, and the consequences are in force (DL-152 (3)).

**Posted:** PR #265 comment 6812355814; Jira AQP-1 comment 11555.

## G7 – QA Acceptance — AQP-237 (STORY-10.18: static checks that `audit.record` uses the change's transaction; PR #250 at 531fa7d) — 2026-11-11 (attempt 1)

- **Decision:** **GO (DL-165).** qa-engineer recommends ACCEPT, and master checked the evidence itself. AC-1 to AC-5 pass against their text and the product-owner's change notes. QA's three plants are red in CI, each at the expected stage with the expected finding. The count invariant is exact on two runs. There is no defect and no open Sev-1 or Sev-2 Bug. Condition D is on `master` (8536f6c). The merge is pre-ruled below; the only step left before the squash is the update by merge commit from 8536f6c, which is docs only.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-237-test-report.md` at 531fa7d (`git show origin/feat/AQP-237-audit-record-tx-checks:…`), read in full. QA hand-off: Jira AQP-237 comment 11559; PR #250 comment 6812682725. Orchestrator brief: 11560.
  - **Head 531fa7d** = ea9aaab + the report. `git diff --stat ea9aaab 531fa7d` is that one file, +111. The PR now has **9 files**: the 8 judged at G6 plus the report. Nothing is under `src/`.
  - **CI on ea9aaab** (QA's named G7 run): 43136706441, read at the A-check. 5 of 5, merge ref 4909bca on 774eff8, 3,081 / 5,444 / 778 / 24.
  - **CI on 531fa7d:** run **43141712018**, attempt 1, the only run on that head. The merge ref is **c0795cd** (531fa7d into **774eff8**), read from "HEAD is now at" in all five jobs. Jobs API: 5 of 5 `success`.
    - Unit 153 files **3,081**; full 212 files **5,444**; E2E **265 / 263 / 250 = 778**; skipped **3 / 4 / 17 = 24**. That is 774eff8's push run 43135619452 **+159 / +159 / +0 / +0**, per shard too.
    - 18 "Cache restored successfully" lines, 0 "Cache not found". Gitleaks: 720 commits, no leaks.
    - Matched lines read: `flaky` matches only the branch names `fix/AQP-268-flaky-g7-7` and `fix/AQP-272-flaky-aqp-122-qa-tablet` in the fetch listing. No `✘`, no retry.
    - **Path 4:30** from the first job (02:29:00Z) to the end of `Stages 1 to 11` (02:33:30Z); 4:33 from the run start. The fan-in waited 4 s. Slack: shard 1 254 s minus `Stages 1 to 11b` 199 s = **+55 s**.
    - Architecture test file time: stage 6 **7,482 ms**, stage 11 **10,631 ms**. My host factor (median over the other files above 1 s in both runs, against reference run 43053208506): stage 6 0.91 (10 files), normalised **8.2 s**; stage 11 0.95 (31 files), normalised **11.3 s**. The same script gives 1.05 to 1.08 and 9.2 to 9.4 s for ea9aaab, which matches the A-check and QA within 0.01.
  - **QA plants, read by master.** Control PR #288 (`control/AQP-237-qa-plants`, base `master`, closed unmerged). The three plant commits are linear by parent, but each one's tree is ea9aaab plus one plant only: `git diff ea9aaab a20fbb4` and `git diff ea9aaab a6ab04f` each show only `user-service.ts`, so plant (i) is undone in the later commits. The report's "each commit starts from ea9aaab" is true of the trees, not the parents. I printed each diff before reading its result.
    - (i) 49a1b76, run 43140272909: stage 4 red, 4 errors. The story's message is at `route.ts` 3:10 and `master-opener.ts` 6:28, beside the older presentation ban at 3:1 and 6:1.
    - (ii) a20fbb4, run 43140750258: stage 6 red, 1 failed / 3,080, `AC-4: today's services pass…`. Findings `user-service.ts:167` and `:175`: "the record call sits in a nested function".
    - (iii) a6ab04f, run 43141092412: stage 6 red, 1 failed / 3,080, the same test. Findings `:170`, "the transaction passed to record is not a parameter of the function that holds the call", and `:177`, "sits in a nested function". The inner `run(async (inner) => …)` that records with the outer `tx` is refused.
    - All three runs are `cancelled` in the API after their red job (QA cancelled the remaining jobs). The red job's own conclusion is `failure` in each.
  - **AC-4:** `git grep -c "\.record(" 531fa7d -- src/server/services` = 1 + 5 + 3 + 6 = **15**.
  - **Condition D:** `origin/master` 8536f6c carries architecture **v0.40** (§6 "The two checks as built") and test strategy **v0.35** (records PR #285).
  - **PR body and commits:** "Closes #104" on body line 5. No other closing keyword in the body or in any commit message. #104 is open.
  - **Jira:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none (2026-11-11).
  - **`master` since 774eff8:** 8536f6c (#285) changes `docs/` only. None of the 9 PR files is touched.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report AC matrix: AC-1 (113-test lint file, `npx eslint .`, plant (i)); AC-2 (a) (46 tests, plants (ii) and (iii)); AC-2 (b); AC-3 (named plants as failing cases plus QA's three); AC-4 (15, "at least 15" pinned, no allow-list); AC-5 (no workflow or dependency change; times reported) |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | JQL: none. QA logged no defect |
| 3 | Regression suite recorded and green | ✱ | ✅ | 43136706441 and 43141712018, 5 of 5 each, +159 / +159 / +0 / +0 on 774eff8 |
| 4 | Exploratory testing notes present | | ✅ | 45-minute charter; OBS-1 to OBS-5 |
| 5 | Accessibility checks for UI stories | | n/a | No screen |
| 6 | QA's plants (DL-161 (6)) on a `master`-based control, diffs printed | ✱ | ✅ | #288; three runs read by master |
| 7 | Condition D on `master` (pre-squash, DL-161 (7)(a)) | | ✅ | 8536f6c |
| 8 | "Closes #104" | | ✅ | Body line 5 |

**Rulings**
1. **PRF-03 trigger (DL-161 (4), A-check ruling 3).** "QA's G7 run" is **43136706441 on ea9aaab**. QA named it in its report, and the A-check named it before any later reading existed. Its stage 6 time is **9,863 ms**, over 8 s. The 531fa7d run reads **7,482 ms** (normalised 8.2 s) on the same test code: the only difference is a docs commit. It is recorded, but it does not replace the named run. Swapping in a lower reading after seeing it would choose the reading by its result. **The trigger therefore rests on the first `master` push run after the squash alone.** If its stage 6 time is over 8 s, PRF-03 becomes a required item of #259. If it is 8 s or less, PRF-03 stays optional. The orchestrator posts that reading on #259, with its host factor. The spread of 7.5 to 10.6 s across four runs of the same code (d447e18, ea9aaab, 531fa7d, and the plant runs at 7.4 and 10.4 s) shows the time is mostly the host. That is why the rule asks for two readings.
2. **Time readings for the record.** The solution-architect adds them to the test strategy §10 range at its next edit, with the A-check's four: 531fa7d stage 6 7,482 ms (factor 0.91, normalised 8.2 s) and stage 11 10,631 ms (factor 0.95, normalised 11.3 s). Stage 11 is again above the 4.5 to 9.9 s normalised range. AC-5's line is the unit stage, so this is not a finding.
3. **QA observations.**
   - **OBS-1, OBS-3 and OBS-4: no action.** OBS-4 (the test name says "AC-4" for an AC-2 cause) goes to #259 as a naming point, with the X1 header line.
   - **OBS-2: no change.** Architecture §6 already says the message assertion carries the proof.
   - **OBS-5 → #259.** The check reads only `src/server/services`, and `AuditService` is also referenced in `src/server/composition.ts` and `src/app/api/v1/audit/route.ts`. Today there is no `.record(` call outside the services, so AC-2's scope is met. #259's next edit adds one line to the header's "what it does not see" list, together with X1's pointer (A-check ruling 2). This does not hold the merge. Master posts this on #259.
4. **AQP-237 → Done.** qa-engineer moves it on this GO (`CLAUDE.md` §4). The merge follows under §8.

**Merge prerequisites (orchestrator, `CLAUDE.md` §8), restating DL-161 (7) for 531fa7d:**
- (a) **Already done:** this GO; condition D on `master` (8536f6c). DL-165 and DL-166 ride on the next records PR. **They do not hold #250** (DL-164 (2)): the decision is posted on PR #250 and AQP-237.
- (b) **Update #250 by merge commit only** from the current `origin/master` (8536f6c or later). "Update branch" is fine; no rebase and no force-push. `git show --cc <new head>` must print no hunks, and `git diff 531fa7d <new head>` over the **9** PR files must be empty. Both are posted. If #253 or #222 merged first, the overlap with the 9 files is re-checked; today there is none.
- (c) **Invariant:** the new run's counts = the push run of the `master` commit in its merge ref **+159 / +159 / +0 / +0** (unit, full Vitest, E2E passed, skipped), per shard too. On 8536f6c, push run **43143731269** (5 of 5, 18 restores, 0 misses) reads 2,922 / 5,285 / 265 + 263 + 250 / 3 + 4 + 17. **Target: 3,081 / 5,444 / 265 / 263 / 250 / 24.** A per-shard difference is reported with its cause before the squash (DL-163 (4)(b)).
- (d) 5 of 5 from the jobs API, every attempt read, matched lines read. The stage 6 file time is posted with its host factor. A path of 5:30 or more is reported, not held. **A red comes back to master and is not re-run.**
- (e) **Before the squash**, post on PR #250 and AQP-237: the head, the run, the merge-ref `master` and its push run, the counts with the arithmetic, and the path.
- (f) **Squash.** The orchestrator writes the body itself and keeps "Closes #104". No commit carries another closing keyword. If #104 does not close, the orchestrator closes it as completed.
- (g) **Post-squash `master` push run:** 5 of 5, and counts = the base's push run + 159 / + 159 / + 0 / + 0. Its stage 6 time for `audit-transaction-architecture.test.ts`, with the host factor, goes on #259 (ruling 1). A red comes back to master.
- **Order with #253:** #250 merges first. AQP-89 has two items to finish before QA starts (DL-166). #253's next update takes #250's squash, and its invariant is recomputed then (DL-166).
- **H (delivery lead, before G8; does not hold the merge):** also delete `control/AQP-237-qa-plants` (#288).

**Risks registered:** none new. RISK-023 stays at 8. The 4:30 path is under 5:30 and adds no E2E.
**Rationale:**
- **Why GO.** Every mandatory G7 item passes on evidence master read directly: the report, the jobs API and logs of two head runs and three plant runs, the plant diffs, `git grep`, the PR body and JQL. QA went beyond the plants the developer and reviewers ran: a real presentation file, an IIFE, a `.then(`, an alias and an outer handle. Each is caught with a finding that names the line.
- **Why the PRF-03 run stays the named one.** Readings are chosen before the result is known. The rule already guards against one slow host by asking for two readings.
- **Why the records do not hold the merge.** Holding #250 for a records PR would force another update and CI run with nothing new to judge (DL-155 (2), DL-164 (2)).

Alternatives considered:
- CONDITIONAL GO for OBS-5. Rejected: it is outside the AC's scope and no code is affected today.
- Using 531fa7d's 7,482 ms as QA's G7 run, which would close PRF-03 now. Rejected, per ruling 1.

**Posted:** Jira AQP-237 comment 11562; PR #250 comment 6813057397; GitHub #259 comment 6813060055 (OBS-5, OBS-4, PRF-03).

## G6 – Peer Review (close) — AQP-89 (STORY-01.06: 12-hour session; PR #253 at e84c073 = cf42f87 + `master` 8536f6c by merge commit) — 2026-11-11 (attempt 2)

- **Decision:** **G6 is closed (DL-166). The CONDITIONAL GO of DL-160 stands, now with no open Blocker, Critical or Major. G7 is by qa-engineer.** Two things come before QA starts:
  - **Q:** the product-owner's AC-2 change note. It is still not on AQP-89.
  - **S:** a two-line E2E pin for SEC-01 (QLT-11). This is a cheap Minor found at the close, so it goes into one named-file commit before QA starts (DL-130 pattern).
  - Separately, the item 9 median of five runs on e84c073. It does not hold G7.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (the close; attempt 1 was DL-160)
- **Artefacts evaluated:**
  - **Round-2 reports** (records branch d528db9):
    - `docs/06-reviews/AQP-89/standards.md`: APPROVE WITH COMMENTS, 0 Minor, Info STD-15 to STD-18. Review 5867962518; Jira 11556.
    - `quality.md`: APPROVE WITH COMMENTS, 1 Minor (QLT-11), Info QLT-12 to QLT-14. Review 5868016435; Jira 11558.
    - `performance.md`: APPROVE, 0 open. PRF-01 Fixed and PRF-02 Closed. Review 5867990052; Jira 11557.
    - `consolidated.md`: the SEC-01 row.
  - **Developer:** Jira 11552 (fix round). PR #253 body: "Closes #255" at lines 5 and 93; line 93 names the two extra files. SEC-01 is at lines 126, 142 and 153.
  - **Orchestrator:** SEC-01 brief 11545; close brief 11561.
  - **Branch, read by master:**
    - `gh pr view 253`: 7 commits, **34 files**.
    - e84c073 has parents cf42f87 and 8536f6c. `git show --cc e84c073` has no combined hunk.
    - `git diff cf42f87 e84c073` over the 34 files is empty.
    - The merge brings `master` 46f56d6..8536f6c: `package.json`, `package-lock.json` and docs only.
  - **SEC-01 code:** `src/app/api/auth/[...nextauth]/route.ts` at e84c073, read in full (30 lines). The guard is the first statement of `handle`, which is exported as both GET and POST, and it runs before `NextAuth(getAuthOptions())`.
  - **Plants, failed lists read by master** (all three controls are based on `master` and closed unmerged):
    - #284 (SEC-01 guard no longer matches), run 43137322016: `auth-log-route.test.ts`, 4 failed / 3,022 (three POST cases and GET).
    - #286 (E1: the proxy forwards no session-cookie header on API paths), run 43139690868: only `session-ended.spec.ts:53` is red, at mobile, tablet and desktop, with its retries. Vitest is green.
    - #287 (P2 re-plant), run 43139857014: `auth-session.test.ts` "QLT-02 …", 1 failed / 3,025.
    - #280 to #283 (L1 to L3, P2): taken from the reports, not re-read.
  - **CI on cf42f87:** 43137162924, read by the reviewers. Merge ref b9bdec6 on 774eff8, 3,026 / 5,398 / 787 / 24 = 774eff8 + 104 / + 113 / + 9 / + 0. Path 5:47 (hit run).
  - **CI on e84c073:** run **43143807315**, attempt 1, the only run on the head. Jobs API: 5 of 5 `success`. Merge ref **916c2d3** (e84c073 into **8536f6c**), read from "HEAD is now at".
    - Unit **3,026**; full **5,398**; E2E **268 / 266 / 253 = 787**; skipped **3 / 4 / 17 = 24**.
    - Base: `master` 8536f6c's push run **43143731269** (attempt 1, 5 of 5, 18 restores, 0 misses) reads 2,922 / 5,285 / 265 / 263 / 250 / 24. The difference is **+104 / +113 / +9 (+3 per shard) / +0**, which is DL-160 (7) with n_u 13, n_i 0 and e 0.
    - 18 cache restores, 0 misses. Gitleaks: 722 commits, no leaks.
    - **0 `JWT_SESSION_ERROR` and 0 `[next-auth][` lines** in the run's log.
    - `flaky` matches only the two branch names. No `✘`, no retry.
    - JS (stage 11b): `/` 162,817, `/masters/materials` 187,682 (headroom 12,318), `not-found` 155,962. These are cf42f87's figures (same code), +499, +914 and +334 on 8536f6c.
    - **Path 5:16** from the first job (02:47:29Z) to the end of `Stages 1 to 11` (02:52:45Z); 5:18 from the run start. The fan-in waited 3 s. Slack: shard 1 306 s minus `Stages 1 to 11b` 218 s = **+88 s**.
  - **Jira AQP-89 description, read 2026-11-11:** no product-owner change note. The Dev Context still names `SESSION_LIFETIME_HOURS` and `system-pages/session-ended.tsx`. No product-owner comment after DL-160. **Condition Q is open.**
  - **JQL:** no open Sev-1 or Sev-2 Bug. #255 is open (it closes with the squash). #256 has no closing keyword in the PR body or commits.

**Checklist** (G6 close; DL-160 (8))
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three round-2 reports present | ✱ | ✅ | `docs/06-reviews/AQP-89/*` round 2; three reviews |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 / 0 in all three |
| 3 | Majors fixed or accepted | | ✅ | STD-01 = QLT-01: documentation on `master` (ADR-009 amendment 2 in 46f56d6, condition M). PRF-01: fixed in code (+334 to +970 B left). SEC-01: fixed (ruling 1) |
| 4 | Findings cite file:line | | ✅ | All round-2 findings do |
| 5 | DL-160 U, A, L, P, C, B, R | | ✅ | U: e3cd1d4, then e84c073; both `--cc` empty and the PR files unchanged. A and B: the body and the reviews. L: L1 to L3 and P2 red, and 0 `JWT_SESSION_ERROR` lines. P: fixed, re-read. C: on both heads. R: three reviews |
| 6 | Q (product-owner) before G7 | | ⏳ open | Not on AQP-89 |
| 7 | Branch current with `master` | | ✅ | e84c073 contains 8536f6c |

**Rulings**
1. **SEC-01 (Major, security) is closed, and its two files are accepted into AQP-89's scope.**
   - **Origin.** SEC-01 was raised after DL-160 by the automated commit security review in the delivery lead's session, confirmed by the main session and the orchestrator, and recorded by the orchestrator (`consolidated.md`; Jira 11545). Master records it here for the first time.
   - **Why the two files are in scope.** The exposure is caused by condition A itself: the #255 `logger` that DL-160 (4) ordered switches on next-auth's `_log` relay. The logger cannot merge without the closure. The route is the only place the action can be refused before next-auth runs.
   - **Was the scope rule kept?** DL-160 (4) said "the PR's 32 files only (name any further file in the Dev Record, with its reason)". The body names both files at line 93.
   - **Verification.** Both reviewers read both files: the action is read from the same `nextauth[0]` next-auth uses, both exported methods are covered, `logger` is read nowhere else, and the variants were checked. Plant #284 is red on 4 cases.
   - **"Closed before G7" is met.**
2. **QLT-11 (Minor) is fixed now, as condition S, before QA starts.**
   - **Why.** The unit test drives next-auth's core through a stand-in adapter, so a next-auth release that derives the action differently would reopen `_log` with every test green. next-auth updates arrive as Dependabot PRs that stay with the delivery lead (DL-159, DL-163 (4)(e)), and their CI is the only check, so the pin must be in CI.
   - **Why it is cheap now.** The fix is two requests in an existing E2E test (e = 0). QA has not started (Q is open), and #253 needs another merge-commit update after #250's squash anyway.
   - **What S is.** One developer commit in `tests/e2e/session-ended.spec.ts` only. At the end of E2E test 2:
     - `POST /api/auth/_log` with form `{ level: 'error', code: 'SEC01_E2E_PROBE' }` answers **404**;
     - `POST /api/auth/_log/x` answers **404**.

     The commit may also carry STD-18 (1), the comment at `route.ts:19-20` reading "Both exported methods get the same plain 404." Nothing else.
   - **Counts:** +0 everywhere.
   - **Who reads it.** Master reads the diff at G7 (DL-047), and QA proves it with a plant (G7 point 6). Dev Record round-3 row.
3. **Q is still open and binds the start of G7** (DL-160 (2), (8)). The product-owner posts the change note on AQP-89, with the AC text unchanged:
   - "AC-2's '`requireUser()` is the one place' is read as: the one check is `resolveSession`, reached only through `session.ts` (`requireUser`, `requireUserOrRedirect`, `getCurrentUser`), over the one constant `SESSION_HOURS`."
   - It cites architecture §8 and A-23 (v0.39) and DL-160 (2).
   - It corrects the Dev Context names: `SESSION_HOURS`; no `system-pages/session-ended.tsx`, because the kind is in `system-page.tsx`.

   The orchestrator briefs QA only once Q and S are both done.
4. **Item 9 median of five (test strategy §10.5, the AC-5 reading rule).**
   - **Which head.** The trigger fired on cf42f87's first attempt: 5:47 on a hit run, over 5:30 by 17 s. e3cd1d4 read 5:30. AQP-89 adds 9 E2E instances, so DL-152 (3)'s exemption for +0 E2E does not apply. **It is read on e84c073**, because it is the current head and holds the same 34 files on the current `master`. I fixed the head before considering any of its readings. Its first attempt (**5:16**) is lower than cf42f87's, and it is attempt 1 of the five.
   - **Who runs it.** The **orchestrator** runs **attempts 2 to 5 of run 43143807315** with "Re-run all jobs". Re-runs keep the merge ref 916c2d3.
   - **How each attempt is read.** From the attempts API (`/actions/runs/43143807315/attempts/<n>` and its jobs): hit in every job, path (first job start to the end of `Stages 1 to 11`), slowest shard and its host line, fan-in queue, and slack. A miss or fallback attempt is replaced by one more re-run, at most two (DL-128 (4)). **A red attempt comes back to master and is not counted away.**
   - **Where it is posted.** The five paths and the median go on PR #253, AQP-89 and AQP-1 (RISK-023).
   - **Not a hold.** It does not hold G7 or QA. It must be complete and posted **before AQP-89's squash**.
   - **What the result changes.** RISK-023 is already 8 (DL-151), and the step is already due. The fourth shard waits on a `master` median plus the nightly, so neither outcome changes the score or that gate. The reading gives the level after AQP-89's +9 E2E, for the architect's fourth-shard sizing.
   - **No further medians.** Later first attempts of AQP-89 (the S head, the final update) add no E2E instance. They are reported and do not start another median (DL-152 (3)).
5. **Info items.**
   - **STD-15:** the `_log` closure is a security invariant written only in code. The solution-architect adds one sentence to architecture §6 or §8 (and ADR-009's consequences) at the next revision, **before G8**. It does not hold the merge.
   - **STD-16 and QLT-12** (`debug` supplied makes next-auth's debug lines reach pino, which runs at `info`): no action. An optional comment line may ride in S.
   - **STD-17:** no action (the PR is squashed).
   - **STD-18:** (1) may ride in S; (2) `errors.ts:48` is outside the PR, with no action.
   - **QLT-13:** accepted. **QLT-14:** praise.
   - **PRF-01:** the residual +334 to +970 B per route is the story's own client code and is accepted. e84c073's figures are the new per-route baseline. `/masters/materials` has 12,318 B of headroom.
   - **PRF-02:** closed. **QLT-04 to QLT-07:** as in DL-160 (X: #256, ux-expert, due G8).
6. **Jira:** the orchestrator moves AQP-89 to In QA when it briefs QA, after Q and S.

**G7 brief points for qa-engineer** (adding to DL-160 (10)):
1. **Head:** the S head and its CI run, 5 of 5. **Invariant:** the push run of the `master` commit in the run's merge ref **+104 / +113 / +9 (+3 per shard) / +0**.
   - On 8536f6c (43143731269): **3,026 / 5,398 / 268 / 266 / 253 / 24**.
   - If #250 has squashed onto 8536f6c and its push run reads 3,081 / 5,444 / 265 / 263 / 250 / 24: **3,185 / 5,557 / 268 / 266 / 253 / 24**.
   - Any other `master`: recompute and post the arithmetic.
2. **AC-1 to AC-6** against their text, read with Q's note.
3. **AC-4 browser hop by your own run:** the API part is automated (E1 is red only there). The browser hop is yours: `handleSessionEnded` → SCR-01 "Session ended", a same-origin return, and a successful return after sign-in.
4. A deliberate sign-out never shows SCR-26 (amendment 2).
5. **#255:** 0 `JWT_SESSION_ERROR` and 0 `[next-auth][` lines in the G7 head's E2E shard logs (e84c073: 0 and 0).
6. **SEC-01 verification:**
   - (a) S's two requests pass at three widths.
   - (b) **Your own plant** on a `master`-based control from the S head, diff printed first: the guard line in `route.ts` removed. E2E test 2 must be red at three widths on the S requests, and `auth-log-route.test.ts` must be red. The plant run's E2E log should hold the forged `SEC01_E2E_PROBE` line, and the G7 head's must not. That shows the relay is real and that the 404 closes it.
   - (c) Sign-in and sign-out E2E are green on the head, so `/api/auth/*` still works.
   - You may rely on the reviewers' source reading for the other variants (trailing slash, case, encoding, query, HEAD).
7. **QLT-09:** check what you can (the accessibility tree; whether the SCR-26 and SCR-01 alert text is present at first render or inserted after it). Write screen-reader steps for the delivery lead's device session **before G8**. A silent alert found there is a defect graded by the test plan (NFR-018, DL-094) and bound to AQP-89. It does not hold G7.
8. **Regression:** CI 5 of 5 with every attempt read, the matched lines read, and JQL for open Sev-1 or Sev-2. Report the path and slack, but do not hold on them. The median of five is the orchestrator's (ruling 4).
9. **Report:** `docs/07-qa/AQP-89-test-report.md` on the PR branch. Local runs follow DL-163 (4)(d).

**Merge (orchestrator, `CLAUDE.md` §8), restating DL-160 (11):** after QA's G7 GO and master's decision:
- Update by merge commit only. `--cc` prints no hunks, and the PR files are unchanged (posted).
- The invariant is recomputed from the new merge ref's `master` push run: + 104 / + 113 / + 9 / + 0.
- 5 of 5, every attempt read. A red comes back to master.
- The median of five is posted.
- The head and counts are posted on PR #253 and AQP-89 before the squash.
- The squash body keeps "Closes #255", and nothing closes #256.
- **H:** before G8, the delivery lead also deletes `control/AQP-89-qlt-r2-e2e-api` and `control/AQP-89-qlt-r2-p2` (#286, #287), the `control/AQP-89-r2-*` branches (#280 to #284) and QA's G7 control.

**Risks registered:** none new. RISK-023 stays at 8 (ruling 4). PRF-01 is closed, so no shell-weight attribution goes to RISK-020.
**Rationale:**
- **Why close G6.** Every Major is now fixed on evidence master read: the merge commits, the route code, the plant failed lists, the counts and the log lines. The one Minor is a two-line test pin.
- **Why S now, not an issue.** The gap is in a security control, the trigger for it (a next-auth bump) is outside the agents' hands, and the cost is one commit before a QA run that has not started.
- **Why Q binds G7.** DL-160 set it "before G7 starts", and the AC text QA tests against needs it.

Alternatives considered:
- QLT-11 to a follow-up issue. Rejected: Dependabot next-auth bumps are not watched by an agent.
- A median of five on cf42f87. Rejected: that head never merges; e84c073 is the same code on the current `master`.
- Waiving the median. Rejected: the story adds E2E, so DL-152 (3) does not apply.

**Posted:** Jira AQP-89 comment 11563; PR #253 comment 6813067748.

## G7 – QA Acceptance — AQP-89 (STORY-01.06: 12-hour session; PR #253 at 12cadd9 = cbbb61b + the QA report) — 2026-11-12 (attempt 1)

- **Decision:** **GO (DL-167).** qa-engineer recommends ACCEPT, and master checked the evidence itself.
  - AC-1 to AC-6 pass against their text, with AC-2 read with the product-owner's note (condition Q).
  - The AC-4 browser hop passes in QA's own run.
  - QA's three SEC-01 plants are red where they should be, and green where the exact-path plant should leave the unit test green.
  - The count invariant is exact on two runs.
  - No defect was found, and there is no open Sev-1 or Sev-2 Bug.
  - QLT-09 (whether a screen reader speaks the alerts) goes to the delivery lead's device session before G8, as DL-166 (7) set.
  - The merge is pre-ruled below. `master` is still abdac01, the base of the final head's run, so no update is needed today.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-89-test-report.md`, read in full at 12cadd9 (`git show origin/feat/AQP-89-twelve-hour-session:…`), plus the evidence folder `docs/07-qa/AQP-89-evidence/` (file list read). QA hand-off: Jira AQP-89 comment 11572; PR #253 comment 6815085560. Orchestrator brief: 11573.
  - **Condition Q:** the AQP-89 description, read 2026-11-12, has "Change note (product-owner, 2026-11-11): AC-2 'one place' and Dev Context names (DL-160 Q)" under the AC table. The AC text is unchanged. The Dev Context names are corrected (`SESSION_HOURS`; `system-page.tsx` through `unauthorized.tsx`; the v0.39 A-23 and §8 wording). Hand-off: 11567.
  - **Condition S (DL-047), read by master:** 81ba5ec (parent e84c073) changes two files:
    - `tests/e2e/session-ended.spec.ts` +10: two constants, plus the two requests at the end of E2E test 2 (`_log` with form `{ level: 'error', code: 'SEC01_E2E_PROBE' }`, and `_log/x`), each expecting 404.
    - `route.ts` +1 / -1: the STD-18 (1) comment, "Both exported methods get the same plain 404."

    This is what DL-166 ruling 2 allowed, and nothing else. There is a Dev Record round-3 row in the PR body (line 162). Hand-off: 11569.
  - **Branch, read by master:**
    - cbbb61b has parents 81ba5ec and abdac01, and `git show --cc cbbb61b` prints no hunk.
    - `git diff 81ba5ec cbbb61b` over the 34 PR files is 0 lines.
    - 12cadd9 = cbbb61b + 10 files under `docs/07-qa/` (+616). No other path.
    - The PR now has **44 files** (34 + 10).
  - **CI runs on the head branch since DL-166** (`gh run list`; all of them read):
    - 43146266250 on 81ba5ec. Attempt 1 is `cancelled`: its four main jobs were cancelled at 03:10:3x, and the fan-in therefore shows `failure`. That was when the median re-run took the PR's concurrency group (developer, 11569). It was not a red test. Attempt 2 is 5 of 5 `success`.
    - 43150655651 on cbbb61b: attempt 1, `success` (QA's G7 run).
    - 43157645758 on 12cadd9: attempt 1, `success`.
  - **CI on 12cadd9:** run **43157645758**. The merge ref is **7c04bb1** (12cadd9 into **abdac01**), read from "HEAD is now at" in all five jobs. Jobs API: 5 of 5 `success`.
    - Unit 157 files **3,185**; full 217 files **5,557**; E2E **268 / 266 / 253**; skipped **3 / 4 / 17**.
    - Base: `master` abdac01's push run **43148695027** (attempt 1, 5 of 5, 18 restores, 0 misses), read by master, reads 3,081 / 5,444 / 265 / 263 / 250 / 24. The difference is **+104 / +113 / +3 per shard / +0**, which is DL-166 (7)'s target exactly.
    - 18 cache restores, 0 misses. Gitleaks: 681 commits, no leaks. The count follows the refs fetched; the earlier runs read 720 to 726.
    - Log lines:
      - **0 `JWT_SESSION_ERROR`, 0 `[next-auth][`, 0 `SEC01_E2E_PROBE` lines.**
      - `flaky` matches only the two branch names in the fetch listing.
      - No `✘` and no `retry #`.
      - 1 `FATAL` line, the expected Postgres authentication line.
    - JS (stage 11b): every route is equal to QA's reading on cbbb61b. `/masters/materials` is 187,424 (headroom 12,576), and all 9 rows are within 200,000.
    - **Path 5:15** from the first job (04:52:54Z) to the end of `Stages 1 to 11` (04:58:09Z); 5:18 from the run start. The fan-in waited 3 s. Slack: shard 2 took 305 s and `Stages 1 to 11b` 202 s, so **+103 s**.
  - **QA plants, read by master.** All three are control PRs based on `master` and closed unmerged.
    - **Parents.** Each plant commit's parent is cbbb61b. I printed `git diff cbbb61b <plant>` before reading each result.
    - **#289** (94b3ee9, run 43152934264): the guard line and its two constants removed from `route.ts`.
      - Stage 6: `auth-log-route.test.ts`, **4 failed / 3,185** (three POST cases and GET).
      - E2E test 2 (`session-ended.spec.ts:55`) is red on its first attempt and on its retry in all three shards, at `:94:28` (the `_log` request). Shard counts: 267 / 265 / 252 passed.
      - 0 probe lines.
    - **#290** (e783b2b, run 43153090153): the same plant, plus `stdout: 'pipe'` on the production server in `playwright.config.ts`.
      - The same reds.
      - **6 `[WebServer]` lines** `{"level":50,…,"authCode":"SEC01_E2E_PROBE","msg":"next-auth reported an error."}`, two per shard.
    - **#298** (827c0f2, run 43155581613): the guard changed to `nextauth.join('/') === '_log'`, an exact-path match.
      - Stages 1 to 11b are green, with 3,185 and 5,557 passed.
      - E2E test 2 is red at three widths at `:96:39`, the `_log/x` request.
      - This shows that condition S's second request catches a gap the unit test leaves.
  - **QA's browser control #292** (a12872d = cbbb61b + `tests/e2e/aqp-89-qa.spec.ts` + `stdout: 'pipe'`; run 43155026763):
    - 5 of 5 `success`; 3,185 / 5,557; E2E **274 / 272 / 259** = the head + 6 per shard. 18 `aqp-89-qa.spec.ts` passes, and no `retry #`.
    - Piped log: 0 `SEC01_E2E_PROBE`, 0 `JWT_SESSION_ERROR`, 0 `[next-auth][`.
    - All 121 `[WebServer]` level-40 lines are `route refused` with status 403.
    - The run has 7 level-50 lines, but all are in stage 11 (integration tests of `DatabaseBusyError`, "Sign-in could not be checked."), not `[WebServer]`. QA's "0 level-50" holds for the server log, which is what it measured.
  - **Median of five on e84c073** (DL-166 ruling 4), read by master from the attempts API of 43143807315. Every job was `success` in every attempt:

    | Attempt | Path |
    |---|---|
    | 1 | 5:16 |
    | 2 | `cancelled` (concurrency), replaced by 6 |
    | 3 | 5:17 |
    | 4 | 4:28 |
    | 5 | 4:54 |
    | 6 | 5:55 |

    **Median 5:16.** It is posted on PR #253 (orchestrator, 6813809345) and in the AQP-89 brief 11570. **It is not yet on AQP-1** (the last AQP-1 comment is 11555).
  - **PR body and commits:**
    - "Closes #255" on lines 5 and 93.
    - #256 is mentioned only as "Follow-ups", with no closing keyword.
    - None of the 10 commits in `origin/master..` carries a closing keyword.
    - Body line 56 still says the stale Dev Context was "all corrected in #256", but the product-owner corrected it under Q. The squash body must not repeat that line (prerequisite (f)).
  - **Jira:** JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` returns none (2026-11-12). AQP-89 is In QA.
  - **Overlap:** the 44 PR files share no path with open PRs #291 (5 files) or #222. #297 is a draft.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a verification result with evidence | ✱ | ✅ | Report AC matrix. AC-1: boundary tests and QA's `>=`→`>` mutation. AC-2: `git grep` with Q's note, and the renewal mutation. AC-3: E2E tests 1 and 3, plus QA's `/audit` return. AC-4: E2E test 2 plus #292, both kinds of ended session, three widths. AC-5: unit, integration and a real sign-out. AC-6: axe, 44 px, overflow, focus, keyboard |
| 2 | No open Sev-1 or Sev-2 defect | ✱ | ✅ | JQL: none; QA logged no defect |
| 3 | Regression suite recorded and green | ✱ | ✅ | 43150655651 (cbbb61b) and 43157645758 (12cadd9), 5 of 5 each, +104 / +113 / +9 / +0 on abdac01 |
| 4 | Exploratory testing notes present | | ✅ | 45-minute charter; OBS-1 to OBS-5 |
| 5 | Accessibility checks for UI stories | | ✅ | axe (WCAG 2.0 to 2.2 A and AA) 0, 44 px, no sideways scroll and keyboard only, at three widths. Both notices are live regions (`assertive`, `atomic`). Whether a screen reader actually speaks them (QLT-09) is for the device session before G8 (test plan §12; same footing as AQP-122's G7, gate log line 4012) |
| 6 | SEC-01 plant of DL-166 (7), diff printed | ✱ | ✅ | #289 and #290 red as ruled; #298 adds the exact-path form |
| 7 | Condition S read by master (DL-047) | | ✅ | 81ba5ec, two files, as ruled |
| 8 | Condition Q before G7 | | ✅ | Jira description note; 11567 |
| 9 | Sign-out never shows SCR-26 | | ✅ | #292: plain `/sign-in`, no alert; stale cookie 401 `UNAUTHORIZED` |
| 10 | Median of five posted before the squash | | ⏳ pre-squash | PR and AQP-89 done; AQP-1 to come (prerequisite (e)) |

**Rulings**
1. **OBS-1: what the log-line readings showed.**
   - **The finding is right.** Playwright drops a web server's stdout unless the config says `stdout: 'pipe'`. Pino writes to stdout. next-auth's own default logger wrote `[next-auth][error]` to stderr, which Playwright does show.
   - **The earlier readings.** So the c4055f7 reading (1 line per shard, DL-160 (5)) was real. But every "0 `JWT_SESSION_ERROR`" reading since #255 covers stderr only: DL-160 (5) on the fix head, DL-166 (1), and both G7 heads. Those readings show that next-auth's own error line is gone. They could not show what pino wrote.
   - **The gap is closed.** Piped control #292 runs the head's product code unchanged, and its piped log has 0 `JWT_SESSION_ERROR`, 0 probe lines and 0 `[WebServer]` error lines. Piped plant #290 shows the probe line. So #255 (no warn or error line for an expired cookie) and SEC-01 (the relay reaches a log line when open, and is closed on the head) are both shown end to end.
   - **No AQP-89 change.**
   - **From now on.** A master condition that relies on pino log lines names a run with piped stdout (a control is enough).
   - **Owner of the config question.** Whether `playwright.config.ts` pipes stdout permanently goes to the **solution-architect**, at the next test strategy edit and before G8. The trade-off is log volume (121 warn lines per run on #292) against log assertions that mean something. No issue is opened; it is an Info item.
2. **QLT-09** stays open until the delivery lead's device session before G8, using the report's NVDA, VoiceOver and TalkBack steps. QA records what was spoken. If a notice is silent, QA raises a Product defect bound to AQP-89 and grades it by the test plan (§6, §12; DL-094). QA's provisional reading is Sev-3 if the heading is spoken, and Sev-2 if nothing is. OBS-2 and OBS-3 (SCR-26 drawn by script; two alert mechanisms) go to the ux-expert with #256.
3. **OBS-4** (dev-server hydration warnings in `MaterialsPanel`) is outside AQP-89. The ux-expert or the developer of the next masters story may look at it. There is no action here.
   **OBS-5:** no action.
   **The PO's leftovers** (the description header still says "Status: Draft", and T1 says "in `requireUser()`") go to the scrum-master as cosmetic. The note already gives T1's reading, so they do not hold anything.
4. **AQP-89 → Done.** qa-engineer moves it on this GO (`CLAUDE.md` §4). The merge follows under §8.
5. **Not for this gate: #244 / PR #291's observation.** The developer of PR #291 reported that on Process and Materials, a load error after a successful save shows "Nothing was changed." under the "Saved" notice, against ux-spec §6.0. That PR is not AQP-89's, so it does not touch this decision. Reviewer-quality confirms the behaviour on #291.
   - **What `origin/master` shows.** The code there fits the report: `process-results.tsx:48` and `material-results.tsx:56` render `MasterLoadError` with no `description`. `treatment-panel.tsx:65` and `exchange-rates-panel.tsx:112` pass the "saved, not shown" line that `master-load-error.tsx:24` exists for. So if it is confirmed, it is a defect in delivered code, not a #291 finding.
   - **Routing if confirmed.** QA reproduces it on `master` and grades it by the test plan (DL-094). It is bound to the stories that delivered those two screens, it is fixed before G8, and AQP-142 (#297, Customers) does not copy the gap. Master rules on it when reviewer-quality reports.

**Merge prerequisites (orchestrator, `CLAUDE.md` §8), restating DL-160 (11) and DL-166 (8) for 12cadd9:**
- (a) **Already done:**
  - this GO;
  - Q and S;
  - condition M (ADR-009 amendment 2 on `master` 46f56d6);
  - the median of five, read and posted on #253.
- (b) **Update only if `master` moved.**
  - **If `origin/master` is still abdac01 at the squash:** no update is needed, and 43157645758 is the run of record.
  - **If it moved:**
    - Update by merge commit only ("Update branch" is fine; no rebase and no force-push).
    - `git show --cc <new head>` prints no hunks, and `git diff 12cadd9 <new head>` over the **44** PR files is empty. Both are posted.
    - Re-check the overlap with whatever merged; today there is none with #291 or #222.
- (c) **Invariant** for any new run: its counts = the push run of the `master` commit in its merge ref **+104 / +113 / +9 (+3 per shard) / +0**.
  - On abdac01 (43148695027): **3,185 / 5,557 / 268 / 266 / 253 / 24**.
  - On any other `master`, recompute the target and post the arithmetic.
  - A per-shard difference that the PR's tests do not explain is reported with its cause before the squash (DL-163 (4)(b)).
- (d) **CI checks:**
  - 5 of 5 from the jobs API, with every attempt read and the matched lines read.
  - 0 `JWT_SESSION_ERROR` and 0 `[next-auth][` lines.
  - The path is reported, not held. No new median is needed (DL-166 ruling 4). A cache-miss run after a lockfile change on `master` must still be green; it is just not a RISK-023 reading (DL-163 (5)).
  - **A red comes back to master and is not re-run.**
- (e) **Before the squash:**
  - Post the head, the run, the merge-ref `master` and its push run, the counts with the arithmetic, and the path on PR #253 and AQP-89.
  - **Post the median of five (5:16, the five paths and the replaced attempt) on AQP-1 for RISK-023.** DL-166 ruling 4 asks for it, and it is not there yet.
- (f) **Squash body.** The orchestrator writes it itself; the pre-filled commit list is not used.
  - It keeps "Closes #255". #256 appears only as "Refs #256", with no closing keyword. No commit message carries a closing keyword.
  - It does not repeat body line 56's "corrected in #256".
  - If #255 does not close, the orchestrator closes it as completed. #256 stays open (ux-expert, due G8).
- (g) **Post-squash `master` push run:** 5 of 5, with counts = the base's push run +104 / +113 / +9 / +0. It is posted on AQP-89 and #253. A red comes back to master.
- (h) **Order.**
  - **The records PR does not merge first.** Nothing the squash depends on sits in it: M is on `master`, and DL-165 to DL-167 and the round-2 reports are records. Merging it first would force another update and CI run with nothing to judge (DL-155 (2), DL-164 (2)).
  - #253 squashes before the records PR and before #291 and #222, because its judged head can merge as it is now. The records PR (`docs/AQP-1-records-sprint1-i`) follows, and the next story PRs take `master` after it.
- **H (delivery lead, before G8; does not hold the merge):** also delete `control/AQP-89-qa-sec01` (#289), `control/AQP-89-qa-sec01-logs` (#290), `control/AQP-89-qa-browser` (#292) and `control/AQP-89-qa-sec01-segment` (#298), with the branches DL-160 (12) and DL-166 (8) listed.

**Outstanding before G8 (none holds the merge):**
- STD-15: solution-architect, the `_log` sentence in architecture §6 or §8 and ADR-009 (DL-166 (6)).
- #256 / X: ux-expert, with OBS-2 and OBS-3.
- QLT-09: device session.
- OBS-1: solution-architect.
- H: branch deletions.

**Risks registered:** none new.
- RISK-023 stays at 8. The median of 5:16 is under 5:30, and 12cadd9's 5:15 adds no E2E.
- SEC-01 needs no risk: it is closed and pinned in CI by both the unit test and the E2E test.

**Rationale:**
- **Why GO.** Every mandatory G7 item passes on evidence master read directly:
  - the report and the Jira description;
  - the S diff;
  - the merge commit and the file lists;
  - the jobs API and logs of the head runs, the base push run, three plant runs and the browser control;
  - the attempts API of the median run;
  - the PR body, the commits and JQL.

  QA's #298 went beyond the ruled plant. It shows that each of S's two requests is needed.
- **Why QLT-09 does not hold G7.** AC-6's own test of "announced" is `role="alert"`, and that passes. DL-160 (10) and DL-166 (7) placed the spoken check before G8, on the device the delivery lead holds. The same footing was used at AQP-122's G7 (gate log line 4012).
- **Why OBS-1 is a ruling and not a condition.** The evidence that was missing (a piped run of the head's code) already exists in #292. The only open question is whether CI should always pipe stdout, and that is a test strategy choice.

Alternatives considered:
- CONDITIONAL GO on QLT-09. Rejected: the AC's check passes, the device step was ruled for G8 before QA ran, and a condition would hold nothing that G8 does not already hold.
- Asking for a new head with `stdout: 'pipe'` in the config. Rejected: it changes CI behaviour for every story, so it is the architect's choice, and #292 already gives the evidence.
- Merging the records PR first. Rejected, per (h).

**Posted:** Jira AQP-89 comment 11574; PR #253 comment 6815326942.

## G6 – Peer Review — tech-debt #244 + #277 (slow-read focus tests and first-open tests for the shared dialog opener; PR #291 at 41e5fd4) — 2026-11-12 (attempt 1)

- **Decision:** **GO (DL-168)** on the narrow reviewer-quality route (DL-124; set for #244 by DL-150 (4) and for #277 by DL-162 (5)).
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **Scope:** `git diff --stat abdac01...41e5fd4` = 5 files, +396 / -2, all under `tests/`: `tests/e2e/masters-slow-read.spec.ts` (new), `tests/e2e/masters-dialog-opener.spec.ts` (new), `tests/e2e/support/masters.ts` (new), `tests/security/engineer-import-rule.test.ts` (STD-06: one `FUTURE_IMPORTS` entry and the header line), `tests/unit/process-opener.test.ts` → `master-opener.test.ts` (100 %). No `src/`, config, `package.json` or CI workflow, so the narrow route holds.
  - **Review:** `docs/06-reviews/244/quality.md`; PR review 5869724916, APPROVE WITH COMMENTS; 0 Blocker, 0 Critical, 0 Major, 2 Minor (QLT-01, QLT-02), 4 Info (QLT-03 to QLT-06). Inline comments cite file:line.
  - **Standards items checked by master** (no reviewer-standards on this route): scope above; Gitleaks "no leaks found" (stage 2); lint and type-check green (CI); grep of the three new files for sleeps, `.only`, `.skip`, disable comments, `@ts-` directives, TODO and credentials: none.
  - **Plants, diffs printed by master against 41e5fd4 and failed lists read in the run logs** (all `master`-based, closed unmerged, Stages 1 to 11b green):

| Control | Diff (one line) | Run | Red | Failed list |
|---|---|---|---|---|
| A1 #300 | `use-read-again.ts`: `else if (shouldFocusWhenFailed) focusOpener(opener.current, true)` → `else focusOpener(opener.current)` | 43161026597 | 15 | new `masters-slow-read.spec.ts:76, :103`; old `exchange-rates.spec.ts:383`, `treatments-focus.spec.ts:181, :197`; each at three widths |
| A2 #301 | `use-read-again.ts`: `focusOpener(opener.current)` → `focusOpener(null)` | 43161038044 | 18 | new `:62, :89, :116`; old `exchange-rates.spec.ts:171, :370, :383`; each at three widths |
| P2 #303 | `use-dialog-opener.ts`: `if (loader.pending) return false;` removed | 43162387883 | 6 | `masters-dialog-opener.spec.ts:82, :107` at three widths |
| P4 #302 | `process-screen.tsx`: the two failed-dialog titles swapped | 43162250858 | 3 | `masters-dialog-opener.spec.ts:82` at three widths |
| N1 #304 (probe) | `support/masters.ts`: `not.toContainText('Nothing was changed.')` added to `expectLoadErrorHoldsFocus` | 43162431792 | 6 | `masters-slow-read.spec.ts:76, :103` at three widths only (QLT-01, DL-169) |

  - **CI 43155701604** (`gh run list --commit 41e5fd4`: the only run, attempt 1): jobs API 5 of 5 `success`; merge ref **43d96e2** (41e5fd4 into abdac01), read from "HEAD is now at" in every job. Unit 153 files **3,081**; full 212 files **5,436**; E2E **272 / 270 / 257 = 799**, skipped **3 / 4 / 17**. Against abdac01's push run 43148695027 (3,081 / 5,444 / 265 / 263 / 250 / 3 / 4 / 17, read by master): **+0 / -8 / +7 / +7 / +7 / +0**. 0 "Cache not found"; Gitleaks no leaks; matched lines read (the Postgres `password authentication failed` init line, the `failed=` fan-in script, passing titles containing "failed"); no `✘`, no retry. JS: `/masters/materials` 186,501, `/masters/process` 174,153 (limit 200,000).
  - **Path:** 5:41 from run start (04:34:36Z to 04:40:17Z), 5:38 from the first job; fan-in queue 2 s (shard 2 ended 04:40:08Z, `Stages 1 to 11` started 04:40:10Z).

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ (recorded exception) | Narrow route, DL-124 (1): test-only, no `src/`, config, deps or CI; reviewer-quality report present; standards items checked by master |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | Review 5869724916 |
| 3 | Major findings fixed or accepted | | ✅ | None raised |
| 4 | Findings cite file:line | | ✅ | `quality.md` Findings table |
| 5 | Plants red on every screen the tests cover | ✱ | ✅ | A1 15, A2 18, P2 6, P4 3 (table above) |
| 6 | STD-06 weakens no assertion | ✱ | ✅ | -8 = duplicate cases; 646 distinct names before and after (`quality.md` Checks) |
| 7 | CI green, deltas as stated | ✱ | ✅ | 43155701604 against 43148695027 |
| 8 | Path | | ⚠️ (reported) | 5:41 / 5:38; not held (DL-142 (1), DL-151 (4)) |

**Rulings:**
- **QLT-01 (Minor): not this PR.** It is on `master` before #291 and outside the diff; a fix needs `src/`. Ruled as a delivered-code defect in DL-169.
- **QLT-02 (Minor): accepted here, deferred to #306** (created by master; developer; narrow reviewer-quality route; branched after #291 merges; due G8; it does not ride the QLT-01 fix PR). Master confirmed `support/masters.ts:81-84` is `support/treatments.ts:72-75` verbatim.
- **QLT-03 (Info):** the "no script was requested twice" line (`masters-dialog-opener.spec.ts:69-70`) cannot fail. #277 item 1 is met in substance by the pending-look and target checks, which P2 turns red at `:67`. Its rewording rides #306 item 2.
- **QLT-04 to QLT-06 (Info):** accepted, no issue.
- **Dev Record (Info):** "7 files" (body line 28) is 5, and P4's line is `:82`, not `:81`. Not a condition; the orchestrator's squash body says 5 files.

**Risks registered:** none from this gate. RISK-023 stays at 8 (the 5:41 / 5:38 path is reported under DL-151). RISK-026 is registered with DL-169.

**Posted:** see the G7 record below (one decision comment covers G6 and G7).

## G7 – QA Acceptance — tech-debt #244 + #277 (PR #291 at 41e5fd4) — 2026-11-12 (attempt 1)

- **Decision:** **GO (DL-168)**, decided by master with no QA run (DL-124 pattern). The merge is pre-ruled below; it needs an update by merge commit onto `master` 8f07c17 (#253 and #305 are already squashed).
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** the G6 evidence above; issues #244 and #277 ("Required" items, read in full with their comments); `quality.md` "Conformance with the issues' Required items"; PR #291 body and its four commit messages; JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)` = none (2026-11-12).

**Checklist** (the issues' "Required" items stand in for ACs)
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | #244 (1): slow-read E2E, Process and Materials ready + failed, Treatments ready, three widths, from the ux-spec | ✱ | ✅ | `masters-slow-read.spec.ts:62, 76, 89, 103, 116`; A2 red 9 and A1 red 6 on them. Deleted-row heading branch left to `process-master.spec.ts` (QLT-04, accepted) |
| 2 | #244 (2): reviewer re-plants A1 and A2 | ✱ | ✅ | #300, #301 by reviewer-quality, not the developer |
| 3 | #244 (3) STD-04 rename only; (4) STD-06 with the delta stated | ✱ | ✅ | 100 % similarity; -8 explained, nothing weakened |
| 4 | #244 (5): E2E entries stated | ✱ | ✅ | PR body: 7 tests × 3 widths = 21, mean 3.79 s |
| 5 | #277 (1) and (2): press guard and failed-dialog titles, Process and Materials, three widths | ✱ | ✅ | `masters-dialog-opener.spec.ts:82, :107`; P2 red 6, P4 red 3 |
| 6 | #277 controls re-planted by the reviewer | ✱ | ✅ | #303, #302 |
| 7 | Regression suite green | ✱ | ✅ | CI 43155701604, 5 of 5 |
| 8 | No open Sev-1 / Sev-2 defects | ✱ | ✅ | JQL: none. QLT-01's Bug is bound to AQP-113 and AQP-122, not to #291 (DL-169) |
| 9 | Exploratory notes | | ✅ | Probe N1 is the exploratory check; it found QLT-01 |
| 10 | Accessibility checks for UI changes | | n/a | No UI code changes; the tests themselves assert focus at three widths |
| 11 | "Closes" lines match the issues | | ✅ | Body lines 5 and 6; nothing in #244 or #277 is left without an owner (#244's AQP-142 clause stays with AQP-142, DL-150 (8)) |

**Merge prerequisites (orchestrator, `CLAUDE.md` §8):**
- (a) **Order.** Done before this record was written: #253 squashed as b710741 and records PR #305 as 8f07c17, whose push run 43166263631 is 5 of 5 at 3,185 / 5,557 / 268 / 266 / 253 / 3 + 4 + 17 (read by master). DL-168 and DL-169 ride the next records PR, which does not hold #291.
- (b) **Update #291 by a GitHub merge commit only** ("Update branch"; DL-163 (4)(a)); no rebase, no force-push. `git show --cc <new head>` must print no hunks, and `git diff 41e5fd4 <new head>` over the 5 files must be empty; post both. Overlap checked by master: none of #253's 44 files or #305's docs is one of the 5.
- (c) **Invariant.** Read the merge ref in the new run ("HEAD is now at <ref> Merge <head> into <sha>"). Counts = that `master` commit's push run **+0 unit / -8 full Vitest / +21 E2E passed (+7 per shard) / +0 skipped**. On 8f07c17 (push run 43166263631: 3,185 / 5,557 / 268 / 266 / 253 / 3 + 4 + 17) the target is **3,185 / 5,549 / 275 / 273 / 260 / 3 + 4 + 17**. Totals must match exactly. A different per-shard split with the right totals is reported with its cause before the squash (DL-163 (4)(b)). A different unit or full Vitest delta comes back to master.
- (d) **CI.** 5 of 5 from the jobs API, every attempt read, matched lines read, `/masters/materials` and `/masters/process` JS posted (within 200,000). The path is reported, not held; no median is ordered. **A red comes back to master and is not re-run.**
- (e) **Before the squash**, post the head, run, merge-ref `master` and its push run, the counts with the arithmetic, JS and path on #291 and #244.
- (f) **Squash body, written by the orchestrator:** title as the PR; body says 5 files; "Closes #244" and "Closes #277"; "Refs #306", and "Refs #<QA's GitHub bug>" for QLT-01 if it exists by then, with no closing keyword on the Refs lines. No commit message carries a closing keyword (grepped by master). If #244 or #277 stays open, the orchestrator closes it as completed with the merge commit.
- (g) **After the squash**, the `master` push run is 5 of 5 at base +0 / -8 / +21 / +0 and is posted on #244, #277 and AQP-1. A red comes back to master.

**After the merge:**
- AQP-142's G6 no longer waits for #244 (DL-150 (4)). Its SCR-12 slow-read test uses `support/masters.ts` with A1 and A2 as controls (DL-150 (8)), adds no helper copy (#306), and does not copy QLT-01 or the K sentence (DL-169 (3)(d)).
- QLT-01 routing (DL-169): qa-engineer reproduces, grades and files the Jira Bug + GitHub issue bound to AQP-113 and AQP-122; ux-expert confirms the two sentences; a developer fixes it in a small `src/` PR branched after #291 merges, with N1's assertion as the regression test; due before G8. #307 (condition K, Process and Materials part) may ride it.
- **H (delivery lead, before G8; does not hold the merge):** delete `control/244-*` (#293 to #296, #299) and `control/244-qlt-*` (#300 to #304).

**Risks registered:** RISK-026 (DL-169), the lost-condition pattern. RISK-023 unchanged at 8.

**Rationale:**
- **Why GO.** Every mandatory item holds on evidence master read directly: the diff, the plant diffs and their failed lists, the jobs API and logs of the head run, the base push run and five control runs, the issue texts, the PR body and commits, and JQL.
- **Why no QA run.** There is no AC and no user-facing change. Each acceptance item is pinned by a plant that the reviewer, not the developer, made and ran, and CI is the regression. A QA run would add no independence (DL-124 (3)).
- **Why QLT-01 does not hold this gate.** It is on `master` before #291, in code #291 does not touch; #291 is the test that found it.

Alternatives considered:
- CONDITIONAL GO for the Dev Record's file count. Rejected: it misroutes nothing, and the squash body carries the right count.
- QLT-02 fixed in #291. Rejected: a CI and review cycle for no behaviour, on a head that must be updated anyway.
- A median of five on 41e5fd4. Rejected: not the head that merges, and no outcome can change RISK-023 or the half-triggered step (DL-151 (3)).

**Posted:** PR #291 comment 6816323255 (G6 and G7) and addendum 6816409367 (base 8f07c17, target restated); Jira AQP-1 comment 11584.

## G6 – Peer Review (narrow route) — AQP-245 (STORY-10.21 Users list table actions, PR #222 at d59e8ea = c9c8de7 + `master` b710741 by merge commit) — 2026-11-12 (attempt 2)

- **Decision:** **GO (DL-170).** This closes DL-147's CONDITIONAL GO. Conditions A, B and C are met. AQP-245 goes to **In QA** (orchestrator). The one-line `users-list.tsx` import repoint in merge commit d59e8ea is **confirmed**. Before QA starts, #222 takes the `master` tip (6b1883f or newer) by a GitHub merge-commit update, and G7 is judged on that head.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2 (attempt 1 was DL-147)
- **Artefacts evaluated:**
  - **Review:** reviewer-quality round 2, PR review 5870559816 (Jira 11598): APPROVE WITH COMMENTS, 0 Blocker, 0 Critical, 0 Major, 1 Minor (QLT-09), 2 Info (QLT-10, QLT-11). Report `docs/06-reviews/AQP-245/quality-round2.md`, on the records branch `docs/AQP-1-records-sprint1-j` (61f8140).
  - **Developer:** Jira 11592; PR #222 body (Dev Record round-2 rows; "Closes #134" at line 3). **Orchestrator:** briefs 11594 and 11599.
  - **Branch, read by master:**
    - The commits since b710741 are 85e9d61, fbfb968, 72d92e9, c9c8de7 (the fix round: `git diff --stat 72d92e9 c9c8de7` is the spec only, +88 / -50) and d59e8ea (the merge, with parents c9c8de7 and b710741).
    - `git show --cc --name-only d59e8ea` lists the 2 files. `git diff --stat b710741 d59e8ea` shows the same 2 files, +262 / -37. The narrow route holds.
    - `git show --cc d59e8ea -- users-list.tsx` has exactly one `++` line, the `master-texts` import. `git diff c9c8de7 d59e8ea` on the file is that line alone. `process-texts.ts` at b710741 no longer exports `BREAK_LONG_NAMES`. `master-texts.ts:12` has the same value.
    - `git diff --stat b710741 6b1883f` touches none of the 2 files.
  - **Plants (d59e8ea + 1 commit; master printed each diff and read each failing assertion):**
    - #310 P-WRAP / 43172313584: 22 + 7 failed at the fit.
    - #311 P-GAP / 43172326922: 11 failed at the 8 px gap.
    - #312 P-TAB / 43172342852: 11 failed at "Tab 3 reaches deactivate".
    - #313 P-PROP / 43172353984: 11 failed at the scroll padding.
    - All four are closed unmerged.
  - **CI on d59e8ea:** run **43169604615**, attempt 1, 5 of 5 (jobs API), path 4:42. The merge ref is on 8f07c17; its push run 43166263631 is the reference.
    - Vitest 3,185 / 5,557, equal to the base.
    - E2E passed 272 + 270 + 257 = **799 = 787 + 12**; skipped 24, equal to the base.
    - All 805 distinct base names are present, and the 12 new names are the 11 SCR-14 width cases and the AC-4 card case (master's own extraction from the shard logs).
    - Per-case means (shard 3): SCR-14 3.01 s against 5.13 s, and SCR-11 2.07 s against 2.40 s.
  - **`master` 6b1883f:** push run **43169697211**, 5 of 5, at 3,185 / 5,549 / 275 + 273 + 260 = 808 / 24 (read by master). #222 is MERGEABLE and BEHIND. Branch protection: `strict: true`.

**Checklist** (G6, narrow route; DL-147 (5))
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review evidence present (narrow route: reviewer-quality alone) | ✱ | ✅ | Review 5870559816; `quality-round2.md`. The route exception is DL-147 (1) and DL-124. Scope is 2 files |
| 2 | Zero open Blocker or Critical | ✱ | ✅ | 0 / 0 |
| 3 | Majors fixed or accepted | | ✅ | QLT-01 is fixed (line 311); P-WRAP is red |
| 4 | Findings cite file:line | | ✅ | QLT-09 :304, QLT-10 (file), QLT-11 :121-124 |
| 5 | Condition A (QLT-01 to QLT-04, AC IDs in titles, Dev Record) | | ✅ | c9c8de7, spec only. P-WRAP, P-GAP and P-TAB are red. Means 3.01 s and 2.07 s. Round-2 rows in the PR body |
| 6 | Condition B (merge commit, hand resolution, #195 kept) | | ✅ | d59e8ea. The `--cc` shows 2 files, #195 is kept, and Treatment runs the fit and the gap |
| 7 | `users-list.tsx` repoint: only the import line in `--cc` | | ✅ | One `++` line. The value is identical |
| 8 | Condition C (plants, and the #224 form if `expectThreeButtonColumn` was touched) | | ✅ | 4 of 4 red at their own assertions. P-PROP ran because the docblock and message were touched |
| 9 | Counts per DL-147 (4)(d) and the name list | | ✅ | +0 / +0 / +12 / +0 against 43166263631. 805 of 805 names are present |
| 10 | Branch current with `master` | | ⏳ | It is BEHIND 6b1883f. This is G7 step U below (DL-170 (6)(a)) and does not hold G6 |

**Findings disposition**
- **QLT-09 (Minor)** is accepted and deferred to **#319** (`tech-debt`, created by master). Owner: developer, in the next PR that touches the spec, by G8.
- **QLT-10 (Info)** rides #319.
- **QLT-11 (Info)** is accepted as sound.
- **Dev Record (Info):** the reference run should be 43166263631 (8f07c17), not 43165366576 (b710741). The counts are the same, so this is not a condition.

**G7 route (qa-engineer; DL-170 (6))**
| Step | Owner | What | Pass |
|------|-------|------|------|
| U | orchestrator | Update #222 from the `master` tip by GitHub's update-branch, merge method. No rebase, force-push or local `git merge` | H1's parents are d59e8ea and the tip. `git show --cc H1` prints no hunk. `git diff d59e8ea H1` over the 2 files is empty. `git diff --stat <tip> H1` is exactly the 2 files. All are posted on #222. A conflict comes back to master |
| N | qa-engineer (in the report) | Counts on H1's CI run | 5 of 5 (jobs API). Counts = the merge-ref `master` push run +0 / +0 / +12 / +0. On 6b1883f: **3,185 / 5,549 / 820 (279 / 277 / 264) / 24**. Every base name is present, and the 12 new names are as before. A different split is reported with its cause. A red or any other delta comes back to master |
| Q | qa-engineer | DL-147 (6) on H1 | AC-1 to AC-6 with evidence. QA's own SCR-14 measurements at the seven §6.0 widths (120-character name, as drawn and forced at 1024 px) against G7-2b. Activate and a busy row. A real Tab across a non-own row at 1024 px forced. axe at 3 widths. 360 px cards. `users.spec.ts` and `users-production.spec.ts` unchanged and green. QA's control (`TableActionsCell` → `TableCell`, from H1, anchor-once, diff printed, closed unmerged) red in the forced modes. QA does not repeat the reviewer's four plants |
| R | qa-engineer | `docs/07-qa/AQP-245-test-report.md` | One commit adding only that file, giving H2. `git diff --stat H1 H2` is the report alone |

**Merge prerequisites (DL-147 (7) as refined by DL-170 (7); orchestrator, after G7 GO)**
- **Update:** strict protection means another merge-commit update if `master` has moved since H2, with the U checks over the 3 files. A move that is docs-only, or that does not touch the 3 files, needs no new G7. A conflict, or a change to any of the 3 files, comes back to master.
- **CI:** 5 of 5 from the jobs API, every attempt read, no failed or retried test, and counts per N against that head's merge-ref `master`. A path of 5:30 or more is reported, not held.
- **Post before the squash,** on #222 and AQP-245: the head, the run, the base push run, the counts with the arithmetic, and the path.
- **Squash:** title "AQP-245: STORY-10.21: Users list table actions". The body says 3 files and contains "Closes #134" and "Refs #319", with no closing keyword on the Refs line.
- **After the squash:** the `master` push run is 5 of 5 at base +0 / +0 / +12 / +0 and is posted on AQP-245. A red comes back to master.

**After the merge:**
- **#137 step 1** (QLT-06): may proceed (qa-engineer).
- **#307 Users part:** unblocked (developer, by G8).
- **#225 (QLT-07):** the developer checks what remains after #265's move, then closes or keeps it.
- **#245 item 5:** the orchestrator re-checks the hold.
- **H (delivery lead, before G8; does not hold G7 or the merge):** delete the branches of #223, #224, #233, #234 and #310 to #313.

**Risks:** none new. RISK-023 is unchanged at 8. Path 4:42 is not a reading of 5:30 or more.

**Rationale:**
- **Why GO.** Every mandatory item holds on evidence master read itself. The only Minor is deferred with an issue (the DL-168 pattern). The update and the QA route belong to the next gate.
- **Why the repoint is confirmed.** Without it the merged tree does not compile. It is value-identical, in scope, and inside the merge commit as DL-158 (2) requires. P-WRAP proves the class still reaches the cell.
- **Why the update comes before QA.** DL-163 (4)(a) requires it, and strict protection forces it before the squash anyway. With the update first, QA tests the code that merges.

Alternatives considered:
- QA on d59e8ea, with the update afterwards. Rejected: two baselines, and it breaks DL-163 (4)(a).
- QLT-09 fixed in #222. Rejected: it changes the spec after the plants were read against it, for a missing space.
- The repoint as a separate commit. Rejected: the merge commit would not compile.
**Posted:** PR #222 comment 6817488784; Jira AQP-245 comment 11603. Tech-debt issue #319 created by master.

## G6 – Peer Review — AQP-274 (DEF-029, GitHub #308: saved-but-not-shown sentence on Process and Materials; PR #309 at 356e9d6) — 2026-11-12 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-171)** on the two-reviewer route of DL-169 (3)(c) (reviewer-quality and reviewer-standards; no performance review). QLT-01, STD-01 and STD-02 are fixed in this PR, in one test-only commit (H1), before QA starts. AQP-274 goes to **Changes Requested** (orchestrator), and to **In QA** when conditions A and B are posted. The one shared `SAVED_NOT_SHOWN_BODY` (QLT-03) is accepted and amends DL-169 (3)(c).
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **Reviews:** reviewer-standards, PR review 5870688497 (Jira 11605), `docs/06-reviews/AQP-274/standards.md`: APPROVE WITH COMMENTS, 0 / 0 / 0, 2 Minor (STD-01, STD-02), 3 Info. reviewer-quality, PR review 5870753553 (Jira 11606), `quality.md`: APPROVE WITH COMMENTS, 0 / 0 / 0, 1 Minor (QLT-01), 2 Info. `consolidated.md` (orchestrator). All three on the records branch (f61ce78, draft PR #321). Both reviews are on 356e9d6.
  - **Developer:** Jira 11601; PR #309 body (Dev Record; "Closes #308" at line 3). **Orchestrator:** G5 11602, brief 11607.
  - **Diff, read by master:** `git diff --stat origin/master...356e9d6` = 8 files, +40 / -11, base 6b1883f (the `master` tip; #309 CLEAN). `src/`: the two results components choose `SAVED_NOT_SHOWN_BODY` while `master.notice?.tone === 'success'`; `master-texts.ts:35` holds it; Treatment imports it. The removed and the added literal are identical, and both equal ux-spec v0.23 (lines 388, 756, 834) and `support/treatments.ts:22`.
  - **Controls, diffs printed by master:**

| Control | Diff | Run | Result |
|---|---|---|---|
| #316 (developer; 813af2d on 86d7108, a tree-identical rebuild of 356e9d6) | `description` removed in both results files, nothing else | 43173789224 | 9 failed (4 + 3 + 2): `masters-slow-read.spec.ts:77`, `:105`, `aqp-122-qa.spec.ts:278` × 3 widths, at "the load error says the change was saved"; 799 passed |
| #320 (reviewer-quality; 0fe6e11 on 356e9d6) | `saved = master.notice !== null` in both files | 43175410045 | 5 of 5 green: the non-success half is untested (QLT-01) |

  - **CI 43173595283:** attempt 1, jobs API 5 of 5; merge ref a2a6f91 (356e9d6 into 6b1883f) in every job. Vitest 157 / 3,185 and 217 / 5,549; E2E 275 + 273 + 260 = 808 passed, 3 + 4 + 17 = 24 skipped. Against 6b1883f's push run 43169697211 (read by master, same figures): **+0 / +0 / +0 / +0**. No `✘`, no retry; Gitleaks "no leaks found". JS process 175,119 (+58), materials 187,481 (+57). Path 5:23 from the first job.

**Checklist** (G6; route DL-169 (3)(c))
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present | ✱ | ✅ (recorded route) | Two reports, as DL-169 (3)(c) routed; performance not needed (no route, query, dependency or CI change; JS +58 / +57) |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | 5870688497, 5870753553 |
| 3 | Majors fixed or accepted | | ✅ | None raised |
| 4 | Findings cite file:line | | ✅ | `standards.md`, `quality.md` Findings tables |
| 5 | Words match ux-spec v0.23 | ✱ | ✅ | Literal compared by master; both reviewers |
| 6 | Regression test red without the fix | ✱ | ✅ | #316 red at exactly 9 |
| 7 | The other half (standard line) pinned by a test | | ⚠️ | #320 green: QLT-01, condition A |
| 8 | CI green, deltas as stated | ✱ | ✅ | 43173595283 against 43169697211, +0 across |
| 9 | Test titles carry the defect ID; no magic strings | | ⚠️ | STD-01, STD-02: condition A |
| 10 | Branch current with `master` | | ✅ | Base 6b1883f = tip; CLEAN |

**Findings disposition**
- **QLT-01 (Minor): fixed in this PR** (A(i)), proven by B.
- **STD-01, STD-02 (Minor): fixed in this PR** (A(ii), A(iii)); master checks them in the H1 diff at G7.
- **QLT-03 (Info): accepted;** DL-169 (3)(c) amended to one shared constant (ux-spec v0.23 SCR-11 permits it).
- **QLT-02 (Info):** accepted; Add and Delete are covered by QA in G7 step Q.
- **STD-03, STD-04 (Info):** accepted, no issue.
- **STD-05 (Info):** accepted. The fourth caller is SCR-12 in #297; the orchestrator adds to reviewer-quality's AQP-142 G6 brief that #297 uses the shared constant, and whether the choice moves into `MasterLoadError` is that review's call.
- **#316's parent (Info):** 86d7108, not 356e9d6, but `git diff 356e9d6 813af2d` is the plant alone.
- No tech-debt issue: nothing is deferred.

**Conditions (due before QA starts; checked by master at G7)**
| # | Owner | Artefact | Required change | Due |
|---|-------|----------|-----------------|-----|
| A | developer | PR #309, one commit, `tests/` only (H1) | (i) node Vitest `renderToStaticMarkup` test, one assertion per row: `ProcessResults` in error with `null`, `goneNotice(…,'edit')`, `goneNotice(…,'delete')` → standard line; `savedNotice(…)` → saved sentence and no "Nothing was changed."; `MaterialResults` with `null` → standard line, `materialSavedNotice(…)` → saved sentence; strings written out; E2E +0. (ii) Both `masters-slow-read.spec.ts` failed-read titles carry DEF-029. (iii) The two helper literals become file-local constants. (iv) Dev Record rows per finding, the "no component-test setup" and "NOT included" lines corrected, QLT-03 cited as DL-171, the H1 run. `git diff --stat 356e9d6 H1` is `tests/` only; any `src/` change returns #309 to G6 | Before QA |
| B | reviewer-quality | Control PR from H1 | Saved sentence made unconditional in both results files (lint- and type-clean form), anchor-once, diff printed, closed unmerged: red at the four non-success unit rows and nowhere else in Vitest; any E2E red read and reported. "Fixed" reply in thread r4547581271 | Before QA |
| C | orchestrator | #309, AQP-274 | Post A, B and the H1 run (5 of 5; merge-ref `master` push run +k / +k / +0 / +0, Vitest files +1 in both jobs; all base E2E names present except the 2 renamed titles × 3 widths, present under their new titles); then AQP-274 to In QA | Before QA |

**G7 route (qa-engineer; DL-171 (6))**
| Step | Owner | What | Pass |
|------|-------|------|------|
| N | qa-engineer (report) | H1 run and counts as in C | Exact; a red or other delta comes back to master |
| Q | qa-engineer | Running app, Admin, 3 widths, list re-read forced to fail | Process Add / Edit / Delete and Materials Add / Edit: notice stays, right title, saved sentence, no "Nothing was changed.", focus on title, Try again behaves. Standard line after a deleted-elsewhere notice (warn / info) and after a refused Delete (notice cleared); a failed first read recorded as not reachable if so. Treatment and Exchange rates unchanged. axe 0 on the Process error at 3 widths |
| R | qa-engineer | Regression by name in the H1 run | `masters-slow-read`, `aqp-122-qa`, `treatments-focus`, `exchange-rates` specs green; #316 and B read, no QA control needed; #307's failed writes are not a finding |
| S | qa-engineer | `docs/07-qa/AQP-274-test-report.md` | One commit adding only that file (H2), naming H1; `git diff --stat H1 H2` is the report alone |

**Merge prerequisites (orchestrator, `CLAUDE.md` §8, after G7 GO)**
- **Order:** #222 next; #321 after #222; #309 only after #321 has merged (ux-spec v0.23 and DEF-029 are not on `master`, which has ux-spec v0.22).
- **Update (strict protection):** GitHub update-branch, merge method, to the tip after #321. On H3: parents H2 and the tip; `git show --cc H3` no hunk; `git diff H2 H3` over #309's files empty; `git diff --stat <tip> H3` = exactly #309's files (8 + unit test + report). Moves not touching them need no new G7. A conflict, or a move touching any of them (for example #297 referencing `TREATMENT_SAVED_NOT_SHOWN_BODY`, which #309 removes, or editing a masters file of #309), comes back to master.
- **CI on H3:** 5 of 5 (jobs API), every attempt read, no failed or retried test, counts = merge-ref `master` push run +k / +k / +0 / +0; 5:30 or more is reported, not held.
- **Post before the squash** on #309 and AQP-274: head, run, base push run, arithmetic, path.
- **Squash:** "AQP-274: DEF-029: saved-but-not-shown sentence on Process and Materials"; body lists the files and contains "Closes #308"; #307 with no closing keyword.
- **After:** `master` push run 5 of 5 at base +k / +k / +0 / +0 posted on AQP-274; #308 closed (else closed as completed with the merge commit); AQP-274 to Done by qa-engineer on G7 GO.
- **H (delivery lead, before G8; holds nothing):** delete `control/AQP-274-plant`, `control/AQP-274-qlt-always` and B's branch.

**Risks:** none new. RISK-023 unchanged (5:23 is not a reading). RISK-026: nothing deferred, so no new tracked item.

**Rationale:** see DL-171. In short: all mandatory items hold on evidence master read itself; QLT-01 is fixed now because ux-spec SCR-11 tests (2) and (3) require the standard line, the warn / info path is live on Process today, a regression there repeats DEF-029's class, and the fix is one unit file with no `src/` change.

Alternatives considered:
- GO with QLT-01 as a follow-up due with STORY-02.07. Rejected: the path is live now, and follow-ups get lost (RISK-026).
- NO-GO. Rejected: no mandatory item fails; the code is correct on every traced path.
- An E2E for the deleted-elsewhere path. Rejected: E2E +1 against DL-169, and a render test pins the branch more cheaply.

**Posted:** PR #309 comment 6817883568; Jira AQP-274 comment 11609. No tech-debt issue (nothing deferred).

## G6 – Peer Review — AQP-142 (STORY-02.02 Customers, PR #297 at efcf768 = story commits + `master` b710741 by merge commit a3521c7) — 2026-11-12 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-172; PRF-01 ruled in DL-173)** on the full three-reviewer route. Majors QLT-01 and STD-01 are upheld and fixed in fix round F1. PRF-01 is a measurement condition, not a hold. AQP-142 goes to **Changes Requested** (orchestrator). G6 closes (attempt 2) on H1, the head QA will test, after F1, its re-review and the alignment commit taken once #222 and #309 have merged.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **Reviews** (`docs/06-reviews/AQP-142/`, f38c929): standards REQUEST CHANGES (Jira 11597; 1 Major, 8 Minor, 2 Info); quality REQUEST CHANGES (5870698558, Jira 11608; 1 Major, 4 Minor, 3 Info); performance APPROVE WITH COMMENTS (Jira 11600; 1 Major, 1 Minor, 3 Info); `consolidated.md` (orchestrator). De-duplicated: 0 Blocker, 0 Critical, 3 Major, 12 Minor, 8 Info.
  - **Developer:** Jira 11595; PR #297 Dev Record. **Orchestrator:** G5 11596.
  - **Scope:** `git diff --stat b710741 efcf768` = 71 files, +5,061 / -51. Overlap with #222: `tests/e2e/masters-table-actions.spec.ts` (#297 +9 / -2; #222's files are `users-list.tsx` and that spec).
  - **CI 43170187169**, the only run on efcf768, attempt 1, jobs API 5 of 5; merge ref dc50970 (efcf768 into 6b1883f) in every job; 18 cache restores; Gitleaks no leaks. Vitest 164 / **3,302** and 226 / **5,786**; E2E **292 + 291 + 278 = 861**; skipped 3 + 4 + 17 = 24. Against 6b1883f's push run 43169697211: **+117 / +237 / +53 / +0**. JS 176,675 and 177,269. Path **6:37** (06:43:56Z to 06:50:33Z).
  - **Controls, diffs printed by master:**

| Control | Diff | Run | Result |
|---|---|---|---|
| #314 A1 (279578f on efcf768) | `use-read-again.ts`: `else focusOpener(opener.current);` | 43173424055 | Red at `masters-slow-read.spec.ts:76, :103`, `exchange-rates.spec.ts:383`, `treatments-focus.spec.ts:181, :197` × 3 widths; **`customers-focus.spec.ts:131` green** |
| #315 A2 | (reviewer's report) | 43173430261 | `customers-focus.spec.ts:105` red × 3 widths |
| #322 probe (fdaafd5 = efcf768 + 2 test-only commits, 1 file) | the read held until the dialog closes; only the title takes focus after the read | 43176014661 | 5 of 5 green |
| #323 probe under A1 (54d2d21; the same A1 line) | #322's test + A1 | 43176020141 | **`customers-focus.spec.ts:131` red at mobile, tablet and desktop**, plus the five A1 tests above |

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present | ✱ | ✅ | standards, quality, performance |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | All three reviews |
| 3 | Majors fixed or accepted | | ❌ → condition | QLT-01 and STD-01 upheld (F1). PRF-01 accepted as a measurement condition (DL-173) |
| 4 | Findings cite file:line | | ✅ | Findings tables in the three reports |
| 5 | ACs met in the product | | ✅ | Quality AC table, AC-1 to AC-8. AC-8's test power is QLT-01 |
| 6 | Controls red where the story requires (Dev Context D) | | ❌ → condition | A1 not caught (#314); the fix is probed (#322 / #323) |
| 7 | CI green, deltas stated | ✱ | ✅ | +117 / +237 / +53 / +0 against 43169697211 |
| 8 | Path | | ⚠️ | 6:37: median of five on H1 (DL-173) |
| 9 | Branch current with `master` | | ⏳ | BEHIND 6b1883f. The update is step (8)(a) of DL-172 |

**Fix round F1 (developer; DL-172 (4))**
| Finding | Severity | Required change |
|---|---|---|
| QLT-01 | Major | `customers-focus.spec.ts:131` in #322's probed form (held read, focus log marked when the dialog closes, only the error title after the read) |
| STD-01 | Major | Split `useCustomerEdit` along its seams, or justify inline why it stays whole |
| STD-02 | Minor | Justify or split `createCustomerMethods` |
| STD-03 = QLT-05 | Minor | The record is made only when the script started its own server, or behind a flag that CI passes. Usage says it writes one customer and one audit entry |
| STD-04, STD-07, STD-08, STD-09 | Minor | As the reviewer suggested |
| STD-05 | Minor | The header cites v0.23 §6.0 for the load-error sentence, and the ux-expert's ruling for the other sentences |
| STD-06 | Minor | One `customerSide` zod helper, no `as` casts |
| QLT-02 | Minor | `router.refresh()` after save and reset. A test that fails without it only if Back reproduces in Playwright; otherwise cite the probe and correct the comment |
| QLT-03 | Minor | Remove the `?added=1` path, `useForgetAddedFlag` and `customerCreatedNotice` |
| QLT-04 | Minor | The route schema validates the canonical name. Unit row: 101 raw characters that fit once canonical |
| QLT-06 | Info | Header reworded now (#291 merged) |
| Overlap | — | `masters-table-actions.spec.ts` back to `master`'s version in F1 if #222 has not merged yet |
| Dev Record | — | A row per finding, and the expected delta per shard with causes |

**Re-review of F1 (new diff only):** reviewer-quality (QLT-01 to QLT-04; re-plants on F1: **A1 red at `:131` and A2 red at `:105`, each at three widths**; the QLT-02 control if a test was added) and reviewer-standards (STD-01 to STD-09, QLT-06, the STD-03 restriction). reviewer-performance is re-run only if F1 touches a query, the migration, a route's data path, CI, or the JS budget measurement beyond the record guard.

**Routed:**
- **ux-expert:** the SCR-12 sentences the developer proposed, and the edit page's error title, ruled in the ux-spec before G6 closes.
- **product-owner:** QLT-07, before G8.
- **product-manager:** PRF-02 (NFR-011 counts), before G8.
- **#326** (created by master): the cross-screen blind spot. Owner developer, narrow route, may ride #306, due G8.

**Accepted, no change:** STD-10, STD-11, QLT-08, PRF-03, PRF-04, PRF-05.

**G6 close (attempt 2; DL-172 (8))**
| Step | Owner | What | Pass |
|------|-------|------|------|
| U | orchestrator | After #222, #321 and #309 merge: GitHub update-branch (merge method) to the tip | `--cc` prints no hunk. `git diff <F1> U` over #297's files is empty. Both are posted. A conflict comes back to master |
| A | developer | One alignment commit on U | The Customers entry in `masters-table-actions.spec.ts` on #222's version (11 cases). `CUSTOMERS_SAVED_NOT_SHOWN_BODY` removed and the shared `SAVED_NOT_SHOWN_BODY` imported. The ux-expert's word changes. Nothing else |
| C | orchestrator | CI on H1 and the median of five (DL-173) | 5 of 5. Counts as the Dev Record states against the merge-ref `master` push run. Every base name present. Five paths posted with slowest shard, host line and slack |
| M | master | Close G6 | Round-2 verdicts with 0 open Major, the re-plants read, the alignment diff read. Then In QA, and G7 set in that record |

If #309 has not merged when F1's re-review is done, the orchestrator asks master.

**Merge (outline):** after #222, #321 and #309; a strict-protection update with empty-diff checks; "AQP-142: STORY-02.02: Customers"; "Refs #326" with no closing keyword.

**Risks:** none new. RISK-023 stays at 8. The H1 median is a reading, not a hold (DL-173). RISK-026: every deferred item has an issue (#326) or a named owner and due point.

**Rationale:** see DL-172 and DL-173. In short:
- Both code Majors have probed or rule-compliant fixes, so a fix round with a re-review is proportionate (DL-128, DL-142).
- The alignment waits for #222, because agents cannot hand-resolve (DL-158), and for #309, so there is one shared sentence constant (DL-171).

Alternatives considered:
- NO-GO. Rejected: no mandatory item fails.
- QLT-01 deferred to #326. Rejected: the story's own control requirement fails.
- The spec merged by GitHub as is. Rejected: a conflict would need a local merge.
- #309 widened to replace the Customers copy. Rejected: it widens a Sev-3 fix into a feature's files.

**Posted:** PR #297 comment 6818172998; Jira AQP-142 comment 11613. Tech-debt issue #326 created by master.

## G7 – QA Acceptance — AQP-245 (STORY-10.21 Users list table actions, PR #222: H1 = 03e21f2 = d59e8ea + `master` 6b1883f; H2 = 6422ea4 = H1 + the QA report) — 2026-11-12 (attempt 1)

- **Decision:** **GO (DL-174).** AQP-245 goes to **Done** (qa-engineer). **DEF-030 (AQP-275, #325) is reclassified Sev-2.** It does not hold AQP-245, because it is outside #222's diff (DL-094). It blocks G8.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:**
  - **QA report** `docs/07-qa/AQP-245-test-report.md` at 6422ea4: ACCEPT. QA hand-off: Jira 11614 and PR comment 6818187322. Step U checks: PR comment 6817527657.
  - **Branch, read by master:**
    - 03e21f2 has parents d59e8ea and 6b1883f. `git show --cc` prints no hunk.
    - `git diff d59e8ea 03e21f2` over the 2 files is empty. `git diff --stat 6b1883f 03e21f2` is exactly the 2 files (+262 / -37).
    - 6422ea4 has the one parent 03e21f2, and `git diff --stat 03e21f2 6422ea4` is the report alone (+151).
    - `master` is still 6b1883f.
  - **CI 43175448561** (H1, attempt 1): jobs API 5 of 5; merge ref 025b1c0 in every job; 18 cache restores, 0 misses; no leaks. Vitest 3,185 / 5,549; E2E **279 / 277 / 264 = 820**; skipped 24. Against 43169697211: **+0 / +0 / +12 / +0**, the target exactly. Path 5:20.
  - **Names (master's own extraction):** 823 distinct base names, 0 missing. 12 new: the 11 SCR-14 width cases and the AC-4 card case.
  - **QA control #324** (cdc384e on 03e21f2, closed unmerged): the diff is `TableActionsCell` → `TableCell` in `users-list.tsx` only. Run 43177111733: shard 3 has 11 failed and 253 passed, exactly the SCR-14 cases at `:291`, with "forced to scroll, at its start: action 0 ends inside the region" (22 lines over both attempts). Shards 1 and 2 are green.

**Checklist**
| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every AC has a result with evidence | ✱ | ✅ | Report: AC-1 to AC-6, M1 to M7, CI cases |
| 2 | No open Sev-1 / Sev-2 against the story | ✱ | ✅ | DEF-030 is Sev-2 but pre-existing and outside #222's 2 code files (origin AQP-65, AQP-28). DL-094: it does not hold the story |
| 3 | Regression recorded and green | ✱ | ✅ | 43175448561 at the target counts; 0 base names missing |
| 4 | Exploratory notes | | ✅ | Report, "Exploratory Testing" (60 min charter) |
| 5 | Accessibility checks (UI story) | | ✅ | axe 0 at 768 / 1024 / 1366 px, as drawn and forced; keyboard walk M5 |
| 6 | QA control red where expected, and only there | | ✅ | #324: 11 of 11 SCR-14 cases, nothing else |
| 7 | H2 = H1 + the report alone | | ✅ | `git diff --stat 03e21f2 6422ea4` |

**DEF-030 ruling.** The scale says "a WCAG 2.2 AA violation on a delivered screen" is Sev-2. A page scroll of 1011 px at 360 px, and 611 px at 768 and 1024 px, breaks SC 1.4.10 Reflow and the ux-spec's "Zoom and reflow" row. That is the same row DL-094 applied to DEF-014. Cause, read by master: `users-screen.tsx:132` interpolates the name, and its `Notice` has no wrapping class, while the master screens pass `BREAK_LONG_NAMES` (`materials-panel.tsx:49`).

| # | Owner | Action | Due |
|---|-------|--------|-----|
| a | qa-engineer | AQP-275 to priority High with label `sev-2`; #325 label `sev-2`; the defect file `docs/07-qa/defects/DEF-030-*.md` as Sev-2 citing DL-174, on the records branch | Now |
| b | developer | Fix PR `fix/AQP-275-<slug>` from `master` after #222 merges. One home for the wrapping rule (the shared `Notice`, or every Users call site), stated in the PR. A regression test asserting no page overflow at 360 and 768 px with a 120-character name. A `master`-based control without the class must turn it red | Before G8 |
| c | reviewer-quality, reviewer-standards | Review (DL-169 (3)(c) route) | Before G8 |
| d | qa-engineer | G7, plus a sweep at 360 px of every notice that repeats a user-entered name (Users, Process, Materials, Treatment / Color). Any other overflow is its own defect | Before G8 |

**Merge prerequisites (DL-170 (7), confirmed; orchestrator)**
- **Order:** #222, then #321, then #309 (DL-171). #297 comes after #309 (DL-172).
- **Update:** none now (the tip 6b1883f is in H2). If `master` moves, do a merge-commit update with the (6)(a) checks over the 3 files. A move that does not touch them needs no new G7; anything else comes back to master.
- **CI on the final head** (now 43179793942 on H2, in progress): 5 of 5 (jobs API), every attempt read, no failed or retried test, and 3,185 / 5,549 / 820 / 24 against the 6b1883f push run (+0 / +0 / +12 / +0). A path of 5:30 or more is reported, not held.
- **Post before the squash:** head, run, base push run, arithmetic, path.
- **Squash:** "AQP-245: STORY-10.21: Users list table actions". The body says 3 files and contains "Closes #134" and "Refs #319".
- **After the squash:** the `master` push run is 5 of 5 at base +0 / +0 / +12 / +0, posted on AQP-245; AQP-245 to Done (qa-engineer).
- **After the merge** (DL-170 (8)): #137 step 1, #307 Users part, #225, #245 item 5, the DEF-030 fix branch, and #297's F1 overlap. **H (delivery lead, before G8):** delete the branches of #223, #224, #233, #234, #310 to #313 and #324.

**Risks:** none new. RISK-023 unchanged (5:20).

**Rationale:** see DL-174. In short, every mandatory item holds on evidence master read itself. DEF-030 is graded by the scale, consistent with DL-094, and bound to G8, not to this story.

Alternatives considered:
- DEF-030 kept at Sev-3. Rejected: inconsistent with the scale and DL-094.
- Holding AQP-245 until DEF-030 is fixed. Rejected: the defect is outside its diff and its ACs.
- Fixing DEF-030 in #222. Rejected: it widens a 3-file PR after the G7 evidence was taken.

**Posted:** PR #222 comment 6818348583; Jira AQP-245 comment 11619; Jira AQP-275 comment 11620 (DEF-030 routing).

## G7 – QA Acceptance — AQP-274 (DEF-029, #308; PR #309: H1 = e6e1c14 = 356e9d6 + the tests-only condition A commit; H2 = a7f1a2d = H1 + the QA report) — 2026-11-12 (attempt 1)

- **Decision:** **GO (DL-181).** DL-171's conditions A, B and C are met. DEF-029 is verified, and AQP-274 goes to **Done** (qa-engineer). The afecc58 push run is green, which closes DL-175 (2).
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Every expected result verified with evidence | ✱ | ✅ | Report a7f1a2d: P1 to P6, M1 to M2, T1 at 360, 768 and 1366 px. P7 and M3 (failed first read) are recorded as not reachable |
| 2 | No open Sev-1 / Sev-2 against the story | ✱ | ✅ | No new defect. DEF-030 (Sev-2) and #307 are outside this diff |
| 3 | Regression recorded and green | ✱ | ✅ | 43179008751 5 of 5: 3,194 / 5,558 / 808 / 24 = 6b1883f +9 / +9 / +0 / +0 (files +1 / +1); every base name present; path 5:23 |
| 4 | Exploratory notes | | ✅ | Report, "Exploratory session" |
| 5 | Accessibility (UI) | | ✅ | axe 0 at three widths on P1, M1, T1, P4 to P6 |
| 6 | Condition A (tests only; QLT-01, STD-01, STD-02; Dev Record) | | ✅ | `git diff --stat 356e9d6 e6e1c14` lists 3 files under `tests/` and `src/` is empty. 9-case unit file; DEF-029 in both titles; two file-local constants; Dev Record rows |
| 7 | Condition B (reviewer's control) | | ✅ | #327 (0d4071b on e6e1c14; the diff is the sentence made unconditional, both files only), run 43180573071: exactly the 4 non-success unit rows failed (3,190 of 3,194 passed); E2E green |
| 8 | H2 = H1 + the report alone | | ✅ | `git diff --stat e6e1c14 a7f1a2d` (+385) |

**`master` move:** `master` is now cdcf18b (#222 afecc58 and #321). `git diff --stat 6b1883f origin/master` over #309's 10 files is empty, so no new G7. Push runs 43182725471 (afecc58) and 43185034340 (cdcf18b) are both 5 of 5 at 3,185 / 5,549 / 820 / 24.

**Merge prerequisites (DL-181 (5)):**
- **Order:** #309 now, #297 after it.
- **Update (strict protection):** GitHub update-branch, merge method. On H3: parents a7f1a2d and the tip; `--cc` prints no hunk; `git diff a7f1a2d H3` over the 10 files is empty; `git diff --stat <tip> H3` is exactly the 10 files.
- **CI on H3:** 5 of 5 with every attempt read, at the merge-ref `master` push run +9 / +9 / +0 / +0. On cdcf18b that is 3,194 / 5,558 / 820 / 24.
- **Post before the squash** on #309 and AQP-274.
- **Squash:** "AQP-274: DEF-029: saved-but-not-shown sentence on Process and Materials", with "Closes #308" and #307 named with no closing keyword.
- **After:** `master` push run at base +9 / +9 / +0 / +0, posted. AQP-274 to Done. The DEF-029 file set to Closed in the next records PR.
- **H (delivery lead, before G8):** delete the control branches of #316, #320 and #327.

**Risks:** none new. RISK-023 unchanged (path 5:23).

**Posted:** PR #309 comment 6820554578; Jira AQP-274 comment 11645.

## G6 – Peer Review — AQP-275 (DEF-030, #325, Sev-2: notices wrap a long name; PR #334 reviewed at 8ecdc0b, realigned to 7fe674a) — 2026-11-12 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-183)** on the DL-174 (3)(c) route (reviewer-quality and reviewer-standards). Master confirms the realignment commits 65ca898 and 7fe674a. **The conflict with `master` goes to the delivery lead:** no agent workaround (DL-158). Master recommends option (a). The resolution keeps the PR branch's side of both files.
- **Decided by:** master  ·  **Human override:** none (the delivery lead's choice is pending for the conflict step)
- **Attempt:** 1

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present (route DL-174 (3)(c)) | ✱ | ✅ | quality APPROVE (5872762390, 11657); standards APPROVE WITH COMMENTS (11656); `consolidated.md` |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | 0 / 0 / 0 Major |
| 3 | Majors fixed or accepted | | ✅ | none |
| 4 | Findings cite file:line | | ✅ | both reports |
| 5 | The fix is proven by a control | ✱ | ✅ | #335 (`notice.tsx` only; diff read): 5 of 6 new unit cases, `masters-table-actions.spec.ts:411` at both widths, and `aqp-122-qa.spec.ts:388` red |
| 6 | CI green, deltas as stated | ✱ | ✅ | 43195864855 5 of 5 (merge ref 7468a2b into cdcf18b): 3,191 / 5,555 / 822 / 24 = +6 / +6 / +2 / +0 |
| 7 | Realignment adds nothing unreviewed | | ✅ | `git diff 3f22672 7fe674a` on the two files = exactly #334's change |
| 8 | Mergeable with `master` | | ❌ → condition U | CONFLICTING; update-branch 422 |

**Conflict options (the delivery lead chooses):**
- **(a) Recommended.** Merge `origin/master` into the branch, take the branch's side for `master-texts.ts` and `treatment-panel.tsx` (`--ours`), commit and push (the d59e8ea route).
- **(b)** Re-cut from the tip: `git checkout 7fe674a -- <8 files>`, open a new PR, and close #334 unmerged.
- **(c)** Change the deny rule for this one step and restore it afterwards.
- **Checks after any option:** `git diff 7fe674a H1` over the 8 files is empty; `git diff --stat <tip> H1` is exactly the 8 files; for (a), `--cc` shows only the two files on the branch's side.

**Findings disposition:**
- **M (one commit after U):** STD-04 (`JSON_HEADERS`), STD-02 (direct import), STD-03 (cite DEF-030), and a `@deprecated` line on the re-export pointing to #225.
- **STD-01 → #225**: move the 10 importers, drop the re-export, and drop #297's two redundant `className` props (QLT-01). After #334 and #297 merge; due G8.
- **STD-05 → #319.**
- **QLT-02, QLT-03:** accepted.

**Conditions (checked by master at G7):** U; then M; then CI on the M head (5 of 5, merge-ref `master` push run +6 / +6 / +2 / +0, every base name present). Master reads the M diff, then In QA.

**G7 (qa-engineer):**
- AQP-275 at 360, 768 and 1024 px: with a 120-character name, no page overflow, and the notice and the Admin-name title wrap.
- At 360 px, sweep every notice that repeats a user-entered name on Users, Process, Materials and Treatment / Color.
- axe, and the regression by name. The report goes in as one commit.

**Merge (outline):** a strict-protection update with empty-diff checks; the overlap with #297 re-checked; squash "AQP-275: DEF-030: Users notice wraps a long name" with "Closes #325", "Refs #225" and "Refs #319".

**Also recorded:** DL-182, #309 squashed as 3f22672 (push run 43197966408 5 of 5, +9 / +9 / +0 / +0).

**Risks:** none new.

**Posted:** PR #334 comment 6821446985; Jira AQP-275 comment 11661; #225 scope comment 6821451017.

## G6 – Peer Review — AQP-142 (STORY-02.02 Customers, PR #297 at H1 = cb95102 = alignment commit on 2cee960 = F1 b9f36fa + `master` 3f22672) — 2026-11-12 (attempt 2)

- **Decision:** **GO (DL-184).** It closes DL-172's CONDITIONAL GO under DL-172 (8)(d). AQP-142 goes to **In QA** (orchestrator), and G7 (qa-engineer) is set below. The median of five on H1, 5:57, is a RISK-023 reading and holds nothing (DL-173 (3)).
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 2
- **Artefacts evaluated:** PR #297 (b9f36fa, 2cee960, cb95102) and its Dev Record; round-2 reviews 5872281163 (performance), 5872361768 (standards), 5872432837 (quality); `docs/06-reviews/AQP-142/{standards,quality,performance,consolidated}.md`; controls #332, #333; runs 43200501126 (attempts 1 to 6), 43197966408, 43194372418, 43194383200; ux-spec v0.26; Jira AQP-142 11640 to 11665

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Three reports present (round 2, new diff efcf768..b9f36fa) | ✱ | ✅ | All three APPROVE WITH COMMENTS; labels `review:*-approved` |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | 0 / 0; new Minors STD-12, QLT-09, PRF-06; Info PRF-07 |
| 3 | Majors fixed or accepted | | ✅ | QLT-01 and STD-01 fixed (round 2); 0 open Major |
| 4 | Findings cite file:line | | ✅ | the three reports, round 2 |
| 5 | Re-plants red as DL-172 (5) asked (read by master) | ✱ | ✅ | #332 = one A1 line: red at `customers-focus.spec.ts:131` × 3 widths (run 43194372418), not at `:105`. #333 = one A2 line: red at `:105` × 3 (43194383200), not at `:131`. The guard files do not change from b9f36fa to H1 |
| 6 | Update U has no hunk of its own | | ✅ | 2cee960 parents b9f36fa and 3f22672; `git show --cc` 0 lines |
| 7 | Alignment diff read (DL-172 (8)(b)) | ✱ | ✅ | cb95102: 8 files +57 / -38. Customers table-actions entry (11 cases); shared `SAVED_NOT_SHOWN_BODY` (identical string); QLT-06 header; STD-12 move; QLT-09 words = ux-spec v0.26. Extra items (c) to (e) accepted (DL-184 (3)) |
| 8 | CI on H1 5 of 5, deltas as stated | ✱ | ✅ | 43200501126 attempt 1; merge ref 321905e (cb95102 into 3f22672); 3,327 / 5,812 / 876 / 24 = **+133 / +254 / +56 / +0** against 43197966408; 0 flaky; no leaks |
| 9 | Every base E2E name present | | ✅ | 838 base names, 0 missing; 56 new = the story's specs at three widths + 11 table-actions cases |
| 10 | Median of five on H1 (DL-173) | | ✅ read | 6:30, 5:43, 5:53, 5:57, 6:10 → **5:57**; no cache miss or fallback; slack 1:54 to 2:20 (shards set the path); attempt 6 (5:48) not counted, same result either way |
| 11 | Dev Record current | | ✅ | rows for the alignment items and PRF-06; counts per shard |

**Conditions / remediation (G7, qa-engineer, on H1)**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| a | qa-engineer | test report | All eight ACs at 360 / 768 / 1366 px; AC-2 per DL-177 (`12.5` → `12.50`; `11.555` refused; untouched value not re-judged) | G7 |
| b | qa-engineer | test report | ux-spec v0.24 to v0.26 words string by string. Reset paragraphs reported (Should, no fail). QLT-09: reproduce case (5) or (6) in a browser if feasible (title focused, no "Nothing was changed"); else say why and cite the unit cases | G7 |
| c | qa-engineer | throwaway PR | One control: a plant in the Customers table only turns the 11 SCR-12 table-actions cases red, others green; diff printed; closed unmerged | G7 |
| d | qa-engineer | test report | Canary scan covers customer rates and phone (Engineer 0); Engineer 403 on the five customer routes | G7 |
| e | qa-engineer | test report | axe (full NFR-018 tags incl. `wcag21a`) on list, edit page, Add and Reset dialogs; keyboard and focus after good and failed reads | G7 |
| f | qa-engineer | test report | Regression by name against the merge-ref `master` push run, as a delta; 0 flaky | G7 |
| g | qa-engineer | PR #297 | Report as one commit (H2 = H1 + report). Any test file makes a new head: CI 5 of 5, delta stated, master reads it | G7 |

**Merge prerequisites (DL-172 (9), in full; DL-184 (9))**
- **Records first:** the records PR with ux-spec v0.24 to v0.26, PRD v0.24, DL-177 and DL-184 merges before #297's final update.
- **Hold:** #336 (AQP-276) does not merge before #297 (DL-180).
- **#334:** may merge first. The only shared file is `masters-table-actions.spec.ts`, with disjoint hunks; a conflict comes back to master.
- **Update:** by update-branch, merge method. On H3: parents H2 and the tip; `--cc` with no hunk; `git diff H2 H3` over #297's files empty; `git diff --stat <tip> H3` = #297's files. All posted.
- **CI on H3:** 5 of 5, every attempt read, at the merge-ref `master` push run +133 / +254 / +56 / +0 plus any QA delta; every base name present; 0 flaky.
- **Body and squash:** add "Refs #326" to the PR body, with no closing keyword. The orchestrator writes the squash body itself. Title "AQP-142: STORY-02.02: Customers".
- **After:** the `master` push run read and posted; AQP-142 Done (qa-engineer, on G7 GO); then #336.

**Findings disposition:**
- **Fixed:** STD-12, QLT-06, QLT-09 in H1.
- **Closed:** PRF-06 by the Dev Record (baseline 180,854 B); PRF-02 by DL-178; QLT-07 by DL-177.
- **Accepted:** PRF-07, STD-10, STD-11, QLT-08, PRF-03 to PRF-05.
- **Elsewhere:** #326 cross-screen follow-up (due G8); #297's two `BREAK_LONG_NAMES` props go to #225 (DL-183).

**Risks registered:** none new. RISK-023 reading recorded (median of five 5:57 on H1; stays at 8).
**Rationale:** Every mandatory G6 item is met on the head QA will test, with re-plants, alignment diff, counts and median read by master. The three items added to the alignment commit are small and owner-proposed, or ux-expert words; CI is green on them and QA tests them, so no round 3 is needed. CI time is a trigger for the next step, which is already placed, not a hold.

**Posted:** PR #297 comment 6823683085; Jira AQP-142 comment 11670.

## G6 – Peer Review — AQP-276 (STORY-10.22 CI fourth shard, PR #336 at 0c8b898, base `master` 3f22672; narrow route) — 2026-11-12 (attempt 1)

- **Decision:** **CONDITIONAL GO (DL-185).** All mandatory items are met on 0c8b898. Three conditions follow: S, the STD-01 title, which rides with the update the measure needs anyway; A, the solution-architect's statement before T6; and O, the orchestrator's measure schedule. AQP-276 **stays In Review** while the developer does T6 to T8 under DL-180. The orchestrator moves it to In QA when S is in and the PR body carries the AC-4 to AC-9 figures. No re-review round is needed.
- **Decided by:** master  ·  **Human override:** none
- **Attempt:** 1
- **Artefacts evaluated:** PR #336 (one commit 0c8b898, 3 files, +14 / -14) and its Dev Record; reviews 5874444804 (standards), 5874454267 and 5874457088 (performance); `docs/06-reviews/AQP-276/{standards,performance,consolidated}.md`; Jira AQP-276 description (AC-1 to AC-9) and comments 11666, 11667, 11668, 11669, 11672; controls #337, #338; runs 43202416203, 43212324945, 43212224753; test strategy v0.36 §10.5 item 12; DL-179, DL-180, DL-184
- **My own checks** (read-only; no run started, re-run or cancelled):
  - **Diff:** `git diff --stat 3f22672 0c8b898` = `ci.yml`, `ci-workflow.test.ts` and `ci-workflow-shards.test.ts`, +14 / -14. I read it in full: the only behavioural line is `shard: [1, 2, 3, 4]`; the two pins follow; the comments about shards are rewritten and those about widths are left. No `src/`, no runtime helper, no `tests/e2e/**`, no `playwright.config.ts`. `ci-workflow.test.ts` has 396 lines. **The narrow route holds** (DL-179 (2), DL-180 (3)).
  - **CI 43202416203:** the only run on 0c8b898 (`actions/runs?head_sha`), attempt 1, `pull_request`. Jobs API: `Stages 1 to 11b`, shards 1 to 4 of 4 and the fan-in `Stages 1 to 11` all `success`. Path 10:40:22 to 10:44:34 = **4:12** (one run, information only). Job logs via `gh api --allow-escape-sequences .../jobs/<id>/logs`: Vitest **3,194** and **5,558**; E2E **210 + 209 + 210 + 194 = 823** passed and **2 + 3 + 2 + 17 = 24** skipped; 0 `✘`, 0 flaky, 0 retry lines; Gitleaks "no leaks found". Against 3f22672's push run 43197966408 (3,194 / 5,558 / 820 / 24; DL-182): **+0 / +0 / +3 / +0**. The +3 is the `setup` file, which runs once per shard for each of the 3 projects (12 at four shards, 9 at three), so both sides hold 835 real tests.
  - **Controls (AC-3):** #337 and #338 are CLOSED and unmerged, with base `master`. `git diff 0c8b898 7eaaa7b` adds one file, `zz-control-shard-4-fails.spec.ts`, which fails only in `desktop`. `git diff 0c8b898 da25f00` adds one file, `zz-control-shard-4-waits.spec.ts`: 8 serial desktop-only waits of 25 s, with no timeout widened. Run 43212324945: shard 4 `failure`, shards 1 to 3 and 11b `success`, fan-in `failure`. Run 43212224753: shard 4 `cancelled` at 11:52:46, after every other job had ended (the last at 11:52:25), so only shard 4 was cancelled; the fan-in ran afterwards and `failure`.
  - **Branch protection:** `required_status_checks` = strict, contexts exactly `Stages 1 to 11`.
  - **Order:** `origin/master` is still 3f22672. #297 (AQP-142) is OPEN at cb95102 (G6 GO, DL-184), so AC-9's hold stands.

| # | Check | Mandatory | Result | Evidence |
|---|-------|-----------|--------|----------|
| 1 | Review reports present (narrow route: performance and standards) | ✱ | ✅ | Both in `docs/06-reviews/AQP-276/`, both APPROVE WITH COMMENTS, labels `review:*-approved`. Route confirmed by master's read of the diff (no `src/`, no runtime helper) |
| 2 | Zero open Blocker / Critical | ✱ | ✅ | 0 / 0 in both reports |
| 3 | Majors fixed or accepted | | ✅ | 0 Major |
| 4 | Findings cite file:line | | ✅ | STD-01 `ci-workflow.test.ts:184`; PRF-01 `ci.yml:330` and item 12 item 4; PRF-06 `ci.yml:312`; STD-03 `architecture.md:1169`, `test-strategy.md:599, 677` |
| 5 | AC-1 and AC-2 (diff and pins) | ✱ | ✅ | Diff read by master. The plants in the Dev Record (return to three, fifth shard) fail both pins; `e2e-shards.test.ts` unchanged and green in CI |
| 6 | AC-3 live controls (read by master) | ✱ | ✅ | #337 / 43212324945 red at shard 4 and fan-in; #338 / 43212224753 shard 4 cancelled, fan-in red; plant diffs one file each |
| 7 | CI on the head 5 of 5 with stated deltas | ✱ | ✅ | 43202416203: +0 / +0 / +3 / +0, 0 flaky, no leaks |
| 8 | AC-4 to AC-8 (ten-run measure) | | ⏳ by design | Not taken. DL-180 (2) starts it after AQP-142 merges, so it belongs to G7 |
| 9 | AC-9 order | | ✅ (hold) | PR body states the hold; #297 not merged |

**Conditions / remediation**
| # | Owner agent | Artefact | Required change | Due gate |
|---|-------------|----------|-----------------|----------|
| S | developer, then orchestrator | PR #336 | STD-01: rename the title at `tests/unit/ci-workflow.test.ts:184` to the reviewer's text (`'AQP-276 AC-2 (AQP-227 AC-1, AQP-208 AC-1): …exactly [1, 2, 3, 4]'`). One commit that changes that line only, with no added line. Push it at any time before the update. Its own CI run is not read. After AQP-142 merges, the orchestrator updates the branch to the new tip with update-branch, merge method. The result is **H_m**, the measure's head. Checks on H_m, posted by the orchestrator: `git show --cc H_m` prints no hunk; `git diff --stat <tip> H_m` = the 3 files; `git diff 0c8b898 <S>` = the one `it(` line. CI on H_m is 5 of 5 at the post-AQP-142 `master` push run **+0 / +0 / +3 / +0**, every base E2E name present (`:line:col` stripped), 0 flaky. Master verifies S from the diff at G7, with no re-review (DL-047, DL-124) | before T6 |
| A | solution-architect | test strategy §10.5 item 12 (next version); comment on AQP-276 | **PRF-01:** state the expected head median and same-day base median on the **post-AQP-142 suite**, with each set's listed E2E count. **PRF-02:** state in one sentence which comparator "the base's median of five is at least 20 s slower" uses. **PRF-02 / PRF-03:** say whether a slow-host outlier on the slowest-of-five line, or a shard queue wait, is replaced like a DL-128 (4) cache miss (with its threshold), or say that it is not. If the architect says nothing on that last point, only DL-128 (4) replacements apply. These statements do **not** move the pass lines (5:00, 5:30, the 5:15 exit, 20 s, 1.30 times). A change to any of them comes to master as a proposal, and to the product-owner for the AC-4 wording, before T6. **T6 does not start until A is posted** | before T6 |
| O | orchestrator | measure schedule (PRF-03) | Start only after #297 has merged, its `master` push run is 5 of 5 (so the `.next/cache` key exists), and H_m's first run meets S's checks. Run the sets **alternately, one run at a time**. Head runs are re-runs (attempts) of H_m's run, not new pushes. Base runs are attempts of that `master` push run, on the same commit. Do no merge to `master` and run no other measure during the ten runs. #334 merges before the window or after both sets. A test-adding merge between the sets restarts both (AC-4). Where possible, other branches' pushes wait for the window, which is about an hour | before T6 |

**What G7 needs** (qa-engineer report on the final head; master decides, as for AQP-227 and AQP-244)
1. **AC-4:** QA recomputes the ten paths from the jobs API, attempt by attempt: the earliest `started_at` to the `completed_at` of `Stages 1 to 11`. Each replacement is named with its reason. The result is judged against item 12's lines with A's statements. On a pass, the PR states it. On the exit, the PR gives both figures. On any other miss, the result is **BLOCKED** to the architect, who reports to the product-manager. G7 is then not decided until they report. No fifth shard is pre-ruled.
2. **AC-5:** billed and raw minutes, each a median of five, at most 1.30 times the base. The method is stated (A-2). Raw is read first (PRF-04). Billed is an estimate unless the billing endpoint is used.
3. **AC-6:** 0 flaky in the head's five runs. This is read from **attempt-specific** job logs (`gh api --allow-escape-sequences .../jobs/<id>/logs`, never `gh run view --job`, DL-184). Every base E2E name is present. Per-shard listed, passed and skipped counts are given. No file changes beyond the 3 files, and S is the one title line.
4. **AC-7:** the item 12 figures. PRF-01 adds the listed E2E counts of both sets. PRF-05 adds the slowest shard of each run and how often it is shard 4. PRF-06 adds each run's slack to `Stages 1 to 11b` and its median. PRF-03 adds each job's queue wait and the run order.
5. **AC-8:** the PR body hands the figures to the architect and states the RISK-023 sentence as DL-151 (5) words it. The architect's 10.5 record includes STD-03 (architecture §9.2 and the 10.5 pin row set to `[1, 2, 3, 4]`). It is due in the first records PR after the merge, at the latest G8. It does not hold G7.
6. **AC-9:** the PR body names AQP-142's merge commit and AQP-81's status. The PR merges after AQP-142 and before AQP-81. If AQP-81 reaches G5 before the measure is done, the orchestrator asks master (DL-180 (2)).
7. **Report** as one commit. CI on the final head is 5 of 5 at the invariant (+0 / +0 / +3 / +0 against the merge-ref `master` push run).

**Findings disposition:** **Rides:** STD-01 (S). **To the architect:** PRF-01 and PRF-02 (A, before T6); STD-03 (with the AC-8 record, by G8). **To the orchestrator:** PRF-03 (O). **Accepted, feed AC-7:** PRF-04, PRF-05, PRF-06. **Conformance:** STD-02. **Delivery lead:** STD-04, delete `control/AQP-276-shard4-fails` and `control/AQP-276-shard4-cancelled` from origin after G7. No finding is deferred, so no `tech-debt` issue is needed.

**Risks registered:** none new. RISK-023 stays at 8. PRF-01's thin headroom (expected head median about 4:49 to 5:11 on the post-AQP-142 suite, estimate) is a risk to the AC-4 reading inside RISK-023 and story risk (1). A states it before the measure, so a near miss is read with numbers.
**Rationale:** The diff is the one matrix line, its pins and its comments. CI and both controls behave as AC-1 to AC-3 require, and master read them independently. STD-01 is cheap. The branch must take a merge-commit update anyway before the measure (strict protection, and AC-4 measures on the post-AQP-142 suite), so the title rides with that update and costs no extra CI reading. PRF-01 and PRF-02 must be settled before the measure, so that its result is judged against a stated expectation and not one picked after the result is known.

**Posted:** PR #336 comment 6824364740; Jira AQP-276 comment 11674.
