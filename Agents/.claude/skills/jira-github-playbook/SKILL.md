---
name: jira-github-playbook
description: Procedures, comment templates, labels and naming rules every delivery agent follows for Jira and GitHub actions (issues, transitions, comments, branches, PRs, reviews, issues, merges). Use before any Jira or GitHub action in the AI delivery workflow.
---

# Jira & GitHub Integration Playbook

> Applies when `INTEGRATION_MODE = jira+github` in `CLAUDE.md` §1a. Every agent follows
> these procedures for every Jira or GitHub action. Settings (project key, issue types,
> status names, repo, policies) come from `CLAUDE.md` §1a — never hard-code them.

---

## 1. Tools

| Server | Tool prefix | Used for |
|--------|-------------|----------|
| Atlassian Rovo MCP | `mcp__atlassian__*` | Jira issues, comments, transitions, links, JQL search (and Confluence, if you choose) |
| GitHub MCP | `mcp__github__*` | Branches, PRs, PR reviews and inline comments, issues, labels, file contents |
| `git` (Bash) | — | Local branch, commit, push of feature/docs branches |

Tool names can change between server versions. **Discover them at the start of a run**: list
the available `mcp__atlassian__*` / `mcp__github__*` tools and pick the one whose description
matches the operation (e.g. "create issue", "add comment", "transition issue", "search with JQL",
"create pull request", "pull request review write", "add comment to pending review",
"issue write", "add issue comment"). Typical GitHub names: `create_pull_request`,
`pull_request_read` (`get_diff`, `get_files`), `pull_request_review_write`,
`add_comment_to_pending_review`, `issue_write` (`create`/`update`), `add_issue_comment`,
`merge_pull_request`, `create_branch`.

If a required tool is unavailable or returns an authorisation error: **do not work around it**.
Complete the work locally, report `Status: PARTIAL` with the exact failed operation, and
the orchestrator records a blocker.

## 2. Universal Rules

1. **Search before create (idempotency).** Before creating any Jira issue, run JQL
   `project = <KEY> AND labels = "aiid-<internal-id>"`. If found, update it instead.
   Before creating a PR, check for an open PR from the same head branch.
2. **Labels on everything an agent creates:** Jira → `ai-delivery`, `aiid-<id>`, and the role
   label `agent-<role>` of the creator; GitHub issues/PRs → `ai-delivery` plus type labels.
3. **Links, not copies.** Link repo documents with full GitHub URLs
   (`https://github.com/<owner>/<repo>/blob/<branch>/<path>`); link PRs/issues by URL.
4. **One comment per hand-off.** Keep comments ≤ ~400 words; put detail in the linked
   document or PR. Never paste large code blocks into Jira.
5. **Status changes go through transitions.** Get the available transitions for the issue
   and pick the one that leads to the mapped status name (§1a). If no transition reaches it,
   comment the intended status and report it — do not change workflows.
6. **No secrets or personal data** in any Jira field, comment, PR, issue or commit.
7. **Formatting.** Write comments in Markdown; the Atlassian server converts it. Use the
   templates in §3 exactly so the trail is consistent and searchable.

## 3. Comment Templates

### 3.1 Delegation brief (orchestrator)
```
🧭 **orchestrator → <agent>** · <phase / gate> · <YYYY-MM-DD HH:mm>
**Task:** <one sentence>
**Inputs:** <links>
**Expected output:** <files / Jira / GitHub items>
**Done when:** <conditions>
```

### 3.2 Agent hand-off (every agent)
```
🤖 **<agent>** — <phase / story step> · Status: COMPLETE | PARTIAL | BLOCKED
**Summary:** <2–4 sentences>
**Produced:** <links to docs / Jira issues / PRs / GitHub issues>
**Open questions:** <list or "none">  ·  **Risks:** <list or "none">
**Next:** <recommended next agent and why>
```

### 3.3 Gate decision (master)
```
⚖️ **master — <Gx name>: GO | CONDITIONAL GO | NO-GO** · attempt <n>
| Check | Result | Evidence |
|---|---|---|
**Conditions / remediation:** <owner agent → change>
**Human approval required:** yes (@<delivery lead>) | no
```

### 3.4 Human-approval request (orchestrator)
```
✋ **Approval needed — <Gx>** @<delivery lead>
Master recommends **<decision>**. Evidence: <links>.
Reply on this issue with **APPROVED** or **CHANGES: <what>**, then run `/autopilot` (or the pipeline script) to resume.
```

## 4. Jira Procedures

### 4.1 Intake issue (orchestrator, at kickoff)
- Type: Intake type from §1a. Summary: `[AI Delivery] <project name>`.
  Description: the requirement exactly as the human gave it + sponsor, constraints, inputs.
- Labels: `ai-delivery`, `aiid-INTAKE`, `ai-intake`.
- All inception briefs, hand-offs and G0–G4 gate decisions are comments on this issue.
- Its key is the **Intake key**, recorded in `docs/project-state.md`.

### 4.2 Open questions (business-analyst, product-manager, any agent)
Create a Jira issue (Intake type) per blocking question: summary `Q-<nn>: <question>`,
label `open-question`, linked to the Intake issue ("relates to"), assigned to the named
owner if resolvable, else mention the delivery lead in a comment. Non-blocking questions
stay in the artefact.

### 4.3 Epics (product-owner)
- One Jira Epic per `EPIC-NN`. Summary = epic title. Description = goal, user value, FRs/NFRs,
  scope in/out, epic acceptance criteria, links to PRD/UX/architecture sections.
- Labels: `ai-delivery`, `aiid-EPIC-NN`, `agent-product-owner`. Link to the Intake issue.

### 4.4 Stories (scrum-master creates, product-owner validates)
- Jira Story with **parent = epic**. Summary = story title.
- Description follows `docs/templates/story.md` sections **Story → Acceptance Criteria →
  Dev Context → UX References → Testing Notes → Dependencies/Risks** (Dev Record/Review/QA
  sections are not used in Jira — they live on the PR and in comments).
- Story points in the field from §1a (if configured). Labels: `ai-delivery`,
  `aiid-STORY-NN.MM`, `sprint-NN`, `agent-scrum-master`.
- Tasks → Jira Sub-tasks (one per top-level task, AC IDs in the summary).
- Dependencies → issue links ("is blocked by").
- Sprint assignment: if no MCP tool can set the sprint, keep the `sprint-NN` label and say so
  in the sprint-plan comment (a Jira automation rule or a human can assign by label).
- Status flow uses the mapping in §1a.

### 4.5 Defects (qa-engineer)
- Jira Bug, linked to the story ("is caused by"/"relates to") with label `aiid-DEF-NNN`,
  severity in the priority field (Sev-1→Highest … Sev-4→Low), body from `docs/templates/defect.md`.
- Mirror as a GitHub issue (§5.4) and cross-link both.

## 5. GitHub Procedures

### 5.1 Inception documents (orchestrator)
- After G0 GO, create branch `docs/<INTAKE-KEY>-inception` from the base branch and push it.
- After each inception agent finishes, commit its files (`docs(<area>): <summary> [<INTAKE-KEY>]`)
  and push. Open **one draft PR** after the first commit: title `<INTAKE-KEY>: Inception artefacts`,
  label `documentation`, `ai-delivery`. Mark it ready at G4 GO.
- `MERGE_POLICY` includes `docs-auto` → after G4 GO, merge it (squash) if checks pass and
  the PR touches only `docs/`. Otherwise request review from the delivery lead.
- Story branches are created from the base branch **after** this PR is merged.

### 5.2 Story branch & PR (developer)
- `git fetch` and branch `feat/<JIRA-KEY>-<slug>` from the up-to-date base branch.
- Commit per task with the Jira key; push with `git push -u origin <branch>`.
- Open a **draft PR** early (after the first meaningful commit) with the PR template;
  mark **Ready for review** when the quality loop is green. Labels: `ai-delivery`, `feature`.
- The PR description's **Dev Record** section replaces the story file's Dev Record.
- Comment on the Jira story with the PR link and the hand-off (§3.2).

### 5.3 Peer reviews (three reviewers)
- Read the diff with `pull_request_read` (`get_diff`, `get_files`) or `git diff`.
- Create a **pending review**, add **inline comments** on the exact lines
  (`add_comment_to_pending_review`), then submit it with a summary body:
  - Inline comment format: `**<FINDING-ID> · <Severity>** — <issue>. *Why:* <impact>. *Fix:* <suggestion>`
  - Summary body: verdict, counts by severity, checks run, and the rule references.
  - Submit event: `REVIEW_IDENTITY = single-token` → `COMMENT` (verdict stated in the body);
    `reviewer-bot` → `REQUEST_CHANGES` or `APPROVE`.
- Apply PR label `review:<area>-changes-requested` or `review:<area>-approved`, where
  `<area>` is `standards`, `quality` or `performance` (labels come from `scripts/setup-github-labels.sh`).
- Post a short hand-off comment (§3.2) on the Jira story linking the review.
- Re-review: reply in the original comment threads (Fixed / Not fixed / Rebuttal accepted) and
  submit a new review for the new diff only.

### 5.4 Issues
| Created by | When | Labels | Body must include |
|------------|------|--------|-------------------|
| qa-engineer | Each defect | `bug`, severity label `sev-1…sev-4`, `ai-delivery` | Jira Bug key + link, repro steps, expected/actual |
| developer | Follow-ups / out-of-scope improvements | `follow-up`, `ai-delivery` | Origin story key, rationale |
| reviewers | Major/Minor findings deliberately deferred by master | `tech-debt`, `ai-delivery` | Finding ID, PR link, master's decision |
| solution-architect | Architecture risks / tech-debt items | `architecture` or `tech-debt`, `ai-delivery` | Risk/ADR reference |

### 5.5 Merge (orchestrator only)
- Code PRs: `MERGE_POLICY = all-auto` → squash-merge after G7 GO **and** all required checks
  green **and** no `REQUEST_CHANGES` review outstanding. Otherwise request review from the
  delivery lead, comment on Jira, and continue with other independent stories.
- Never bypass branch protection, never force-push, never merge a PR that changes files outside
  the story's scope.
- After merge: transition the Jira story to Done (if not already), close linked follow-up
  sub-tasks, delete nothing.

## 6. Recommended Jira & GitHub Setup (one-time, by an admin)
1. **GitHub for Jira** app installed and connected to the repo (shows branches, commits, PRs,
   builds inside each Jira issue).
2. Jira workflow statuses matching §1a (add "Ready for Dev", "In Review", "In QA" if missing).
3. GitHub branch protection on the base branch: required checks (build, lint, tests),
   at least one approval from CODEOWNERS for `src/`, no force push. This is the real safety net.
4. Labels created with `scripts/setup-github-labels.sh`.
5. Optional: a dedicated bot GitHub account and Atlassian service user so agent actions are
   attributable to "AI Delivery" rather than a person.
