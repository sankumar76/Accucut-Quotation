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
