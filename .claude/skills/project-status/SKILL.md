---
name: project-status
description: Summarise project health from the ledger, gate log, risk register and backlog - phase, story board, blockers, open questions, top risks and next actions.
disable-model-invocation: true
---

# Project Status Report

Read (do not modify): `docs/project-state.md`, `docs/00-governance/gate-log.md`,
`docs/00-governance/risk-register.md`, `docs/05-backlog/backlog.md`, the current
`docs/05-backlog/sprint-*-plan.md`, and open defects in `docs/07-qa/defects/`.

Produce a concise executive status (≤ 1 page):

1. **Headline:** phase, last gate passed, overall RAG health with a one-line reason.
2. **Sprint progress:** stories by status (count and IDs), sprint goal confidence.
3. **Quality:** review loops per story, open findings by severity, open defects by severity.
4. **Blockers & open questions** needing a human decision (with owner and needed-by date).
5. **Top 5 risks** by score with mitigation status.
6. **Next actions:** the next 3 commands/agents to run.

Flag any inconsistency you notice between the ledger and the underlying artefacts
(e.g. a story marked Done without a G7 entry in the gate log).
