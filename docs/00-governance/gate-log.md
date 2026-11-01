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

