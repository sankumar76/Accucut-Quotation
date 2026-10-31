---
name: kickoff
description: Start a new project or major feature and run inception (G0 to G4) - discovery, PRD, UX, architecture, backlog and sprint-1 stories - through the agent team with gate decisions.
argument-hint: "<project or feature request, or path to an intake document>"
disable-model-invocation: true
---

# Project Kickoff (Inception: G0 → G4)

Request from the user: **$ARGUMENTS**

Run Phase A of the lifecycle defined in `CLAUDE.md` and `.claude/agents/orchestration/orchestrator.md`.
If this session is not already running as the `orchestrator` agent, act as the orchestrator
and follow its procedure exactly (delegate; never author other roles' artefacts).

**Integrated mode** (`INTEGRATION_MODE = jira+github` in `CLAUDE.md` §1a): first create or
find the Jira Intake issue (playbook §4.1), post every delegation brief, hand-off and gate
decision on it, commit each phase's documents to the `docs/<INTAKE-KEY>-inception` PR, and
let product-owner / scrum-master create the Jira epics, stories and sub-tasks.

1. **Intake.** Record the request in the "Request (G0 Intake)" section of `docs/project-state.md`
   (problem, sponsor, outcome, constraints, inputs). Ask the user only for items that are
   missing and cannot be reasonably assumed. Fill in the Project Profile in `CLAUDE.md` if blank
   and the user provides the information.
2. `master` → **G0**.
3. `business-analyst` → brief + requirements catalogue + stakeholder map → `master` **G1**.
4. `product-manager` → PRD + release plan → `master` **G2**.
5. In parallel: `ux-expert` → UX spec; `solution-architect` → architecture, ADRs, test strategy.
   Then `solution-architect` reconciles with the UX spec → `master` **G3**.
6. `product-owner` → epics + consistency report + ordered backlog.
7. `scrum-master` → sprint-01 plan + stories → `product-owner` DoR validation →
   `scrum-master` marks validated stories Ready → `master` **G4**.
8. After each step, update `docs/project-state.md`. On NO-GO, route remediation to the owner
   and re-gate (max two attempts, then escalate to the user).

Finish with a summary for the user: gates passed, artefacts produced (paths), open questions
needing a human, top risks, and the recommended next command (`/story-cycle <story-id>`).
