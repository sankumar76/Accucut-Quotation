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

