---
name: autopilot
description: Run the whole delivery lifecycle unattended from a requirement - inception, Jira backlog, every story through build, PR reviews and QA, and release preparation - stopping only at configured human approval points. Re-run with no argument to resume.
argument-hint: "<requirement text or path to a requirement document> (omit to resume)"
disable-model-invocation: true
---

# Autopilot — Requirement to Release

Input: **$ARGUMENTS**

Act as the `orchestrator` (`.claude/agents/orchestration/orchestrator.md`) with
`AUTOMATION_LEVEL = full` behaviour, regardless of the value in `CLAUDE.md`, unless that file
sets `gated`. Follow the `jira-github-playbook` skill (`.claude/skills/jira-github-playbook/SKILL.md`) for every Jira/GitHub action.

## 0. Preflight (fail fast)
1. Read `CLAUDE.md` §1 and §1a. If any `<<...>>` placeholder remains in the Integration
   Profile, stop and list the missing values.
2. Confirm Jira access (fetch the project by key) and GitHub access (read the repository).
   If either fails, stop with the exact error and the fix (`/mcp` to authenticate Atlassian,
   `GITHUB_PAT` for GitHub).
3. `git fetch`; confirm a clean working tree on the base branch.

## 1. Decide: new run or resume
- **Argument given** → new project/feature: create the Jira Intake issue (playbook §4.1),
  then run Phase A (`/kickoff` steps) through G4.
- **No argument** → resume: read `docs/project-state.md` and the Intake issue's latest
  comments. If waiting on a human approval, look for `APPROVED` or `CHANGES: …` from the
  delivery lead; act on it or stop again if neither is present.

## 2. Inception (G0 → G4)
Exactly as `/kickoff`, plus the Jira/GitHub duties of each agent: Intake comments for every
brief, hand-off and gate; open-question issues; inception docs PR; Jira epics, stories and
sub-tasks. Respect `HUMAN_APPROVAL_POINTS`.

## 3. Sprint execution (G5 → G7, repeated)
While there are Jira stories in the current sprint in the Ready status:
1. Pick the highest-priority Ready story whose blocking links are resolved **and** whose
   dependency PRs are merged (or, if `MERGE_POLICY` keeps code merges human, skip stories that
   depend on unmerged work and note them as "waiting for merge").
2. Run the `/story-cycle` procedure for it (developer → PR → three PR reviews → master G6 →
   QA → master G7 → merge per `MERGE_POLICY`).
3. After each story, post a one-line progress comment on the Intake issue
   (`▶ <KEY> Done · <n>/<total> stories complete`).
Stop the loop on: no more Ready stories, a loop limit reached on a story (escalate it and
continue with independent stories), or a systemic failure (tooling/auth) — post the reason.

## 4. Sprint close & release preparation (G8)
1. `scrum-master` → sprint review & retro (Intake comment). `qa-engineer` → release
   regression. `product-manager` → release notes (docs PR). Refresh the ledger and gate log in
   a `docs/<INTAKE-KEY>-status-sprint-NN` PR.
2. `master` → G8 recommendation, then post the approval request (playbook §3.4) and stop.
   Release/deployment is always a human action.

## 5. Final report
Print a summary: Intake key and link, epics and stories created, PRs (merged / awaiting
human merge), GitHub issues opened, defects, gate decisions, open questions, and exactly what
the human needs to do next.
