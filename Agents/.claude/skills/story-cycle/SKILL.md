---
name: story-cycle
description: Run one Ready story through implementation, three parallel peer reviews and QA (G5 to G7), looping on findings until the story is Done or escalated. Uses Jira and GitHub PRs in integrated mode.
argument-hint: "<story id or Jira key, e.g. STORY-01.02 or PROJ-123> (omit to take the next Ready story)"
disable-model-invocation: true
---

# Story Cycle (Build → Review → QA)

Target story: **$ARGUMENTS**. If empty, take the highest-priority Ready story whose
dependencies are Done — from Jira (integrated mode: JQL on the sprint label and the Ready
status) or from `docs/05-backlog/backlog.md` (local mode).

Follow Phase B of `.claude/agents/orchestration/orchestrator.md`. In `jira+github` mode also
follow the `jira-github-playbook` skill (`.claude/skills/jira-github-playbook/SKILL.md`) and post a delegation brief (§3.1) on the Jira
story before every step.

1. Confirm the story exists and is Ready (or Changes Requested / Rejected for a fix loop).
2. `developer` → implement on `feat/<KEY>-<slug>`; integrated mode: draft PR → Dev Record in
   PR body → PR ready for review → Jira *In Review*. Local mode: Dev Record in the story file.
3. **G5 check (you):** run build/lint/type-check/tests from `CLAUDE.md` on the branch and, in
   integrated mode, confirm the PR's CI checks are green or pending-only-because-new.
4. In parallel: `reviewer-standards`, `reviewer-quality`, `reviewer-performance`. Each brief
   gives the Jira key, PR number (integrated) or base/feature branches and output path
   `docs/06-reviews/<id>/<reviewer>.md` (local), plus the previous review on re-review.
5. Consolidate: integrated → post a consolidated findings table as a **PR comment**
   (de-duplicated, by severity, with each reviewer's verdict); local → write
   `docs/06-reviews/<id>/consolidated.md`.
6. `master` → **G6** (decision posted on Jira and PR). NO-GO → Jira *Changes Requested*,
   send the consolidated findings to `developer`, then re-run only the reviewers who asked
   for changes.
7. `qa-engineer` → tests + test report on the branch, defects as Jira Bugs + GitHub issues →
   `master` **G7**. REJECT → defects to `developer`, reviews of the fix diff only, QA again.
8. Integrated mode: merge per `MERGE_POLICY` (playbook §5.5) or request the delivery lead's
   review on the PR and note "awaiting human merge" on Jira.
9. Loop limit: 3 developer↔review/QA loops, then escalate on the Jira story and stop.
10. Update `docs/project-state.md` (story board, activity log).

Report: final status, loops, findings fixed by severity, defects, PR link and merge state,
Jira link, and the next Ready story.
