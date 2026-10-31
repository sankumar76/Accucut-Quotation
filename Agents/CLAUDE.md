# Project Delivery Operating Model (AI Agent Team)

This repository is delivered by a team of specialised Claude Code agents that mirror a
professional software delivery team. Every agent (and every human working alongside
them) follows the rules in this file. Role-specific behaviour lives in
`.claude/agents/**`. Company-specific engineering rules live in `docs/standards/`.

> **Customise before first use:** fill in the `<<...>>` placeholders in
> `docs/standards/coding-standards.md` and the "Project Profile" section below.

---

## 1. Project Profile (edit per project)

| Item                  | Value                                   |
|-----------------------|-----------------------------------------|
| Project name          | <<PROJECT NAME>>                        |
| Business sponsor      | <<NAME / ROLE>>                         |
| Delivery lead (human) | <<NAME>> — final approver at every gate |
| Primary stack         | <<e.g. TypeScript / Node 22 / React / PostgreSQL>> |
| Test command          | <<e.g. npm test>>                       |
| Lint command          | <<e.g. npm run lint>>                   |
| Build command         | <<e.g. npm run build>>                  |
| Type-check command    | <<e.g. npx tsc --noEmit>>               |
| Branching model       | <<e.g. trunk-based, short-lived feature branches `feat/<story-id>`>> |
| Ticketing system      | <<e.g. Jira project KEY — or "docs/05-backlog is the source of truth">> |

### 1a. Integration Profile (Jira + GitHub)

| Setting | Value | Notes |
|---------|-------|-------|
| `INTEGRATION_MODE` | **jira+github** | `jira+github` = Jira and GitHub are the systems of record (see §7). `local` = markdown-only (no MCP calls). |
| Jira site | <<yourcompany.atlassian.net>> | |
| Jira project key | <<PROJ>> | |
| Jira issue types | Epic=<<Epic>>, Story=<<Story>>, Sub-task=<<Sub-task>>, Bug=<<Bug>>, Intake=<<Task>> | Use the exact names in your Jira project |
| Story points field | <<customfield_10016>> | Leave blank if not used |
| Jira status mapping | Draft=<<To Do>>, Ready=<<Ready for Dev>>, In Progress=<<In Progress>>, In Review=<<In Review>>, Changes Requested=<<In Progress>>, In QA=<<In QA>>, Rejected=<<In Progress>>, Done=<<Done>>, Blocked=<<Blocked>> | Must match your workflow's status names |
| Delivery lead Jira user | <<name or email>> | @-mentioned when human approval is needed |
| GitHub repository | <<owner/repo>> | |
| Base branch | <<main>> | |
| `AUTOMATION_LEVEL` | **full** | `full` = no prompts between phases; agents stop only at `HUMAN_APPROVAL_POINTS` or hard blockers. `gated` = orchestrator asks before each phase. |
| `HUMAN_APPROVAL_POINTS` | **G8** | Comma list of gates that wait for a human (e.g. `G2,G3,G8`). |
| `MERGE_POLICY` | **docs-auto, code-human** | `docs-auto, code-human` = orchestrator merges docs-only PRs after GO; code PRs wait for a human. `all-auto` = orchestrator also merges code PRs after G7 GO. |
| `REVIEW_IDENTITY` | **single-token** | `single-token` = reviewers submit PR reviews as COMMENT (GitHub forbids approving your own PR). `reviewer-bot` = a second token (`GITHUB_REVIEWER_PAT`) lets reviewers APPROVE / REQUEST_CHANGES. |

---

## 2. The Team

| Agent                  | Owns                                                        | Writes to                      |
|------------------------|-------------------------------------------------------------|--------------------------------|
| `orchestrator`         | Running the lifecycle; delegating; persisting hand-offs     | `docs/project-state.md`, `docs/06-reviews/**` |
| `master`               | Governance: gate decisions (GO / NO-GO), standards, risk, audit trail | `docs/project-state.md`, `docs/00-governance/**` |
| `business-analyst`     | Discovery, stakeholder needs, business rules, requirements catalogue | `docs/01-discovery/**` |
| `product-manager`      | Product vision, PRD, scope, prioritisation, release plan    | `docs/02-product/**`           |
| `ux-expert`            | User journeys, IA, wireframes (text), interaction & accessibility spec | `docs/03-ux/**`     |
| `solution-architect`   | Architecture, NFRs, ADRs, tech stack, source tree, test strategy (technical) | `docs/04-architecture/**` |
| `product-owner`        | Backlog integrity: epics, acceptance criteria, cross-artefact consistency, DoR | `docs/05-backlog/epics/**` |
| `scrum-master`         | Sprint plan, implementation-ready stories, impediments, retros | `docs/05-backlog/**`        |
| `developer`            | Implementing stories, unit/integration tests, dev notes     | `src/**`, `tests/**`, story Dev Record |
| `reviewer-standards`   | Coding standards, conventions, security hygiene, documentation | `docs/06-reviews/**`        |
| `reviewer-quality`     | Design quality, maintainability, correctness, test quality  | `docs/06-reviews/**`           |
| `reviewer-performance` | Algorithmic complexity, resource use, DB/IO, scalability    | `docs/06-reviews/**`           |
| `qa-engineer`          | Test plan, acceptance verification, regression, defects     | `docs/07-qa/**`, `tests/**`    |

Agents must **not** write outside their "Writes to" area. Write guards in
`.claude/hooks/restrict-writes.sh` enforce this for non-developer roles.

---

## 3. Lifecycle and Quality Gates

```
G0 Intake ─▶ G1 Discovery ─▶ G2 Product Definition ─▶ G3 Solution Design ─▶ G4 Backlog Ready
                                                                                   │
              ┌────────────────────── per story ───────────────────────────────────┘
              ▼
   G5 Code Complete ─▶ G6 Peer Review (3 reviewers) ─▶ G7 QA Acceptance ─▶ Story Done
                                                                                   │
                                                                     G8 Release Readiness
```

| Gate | Entry artefact(s)                                  | Decided by        | Pass criteria (summary) |
|------|----------------------------------------------------|-------------------|-------------------------|
| G0   | Idea / request recorded in `docs/project-state.md` | master            | Problem statement, sponsor, rough scope present |
| G1   | `01-discovery/project-brief.md`, `requirements-catalog.md` | master    | Goals measurable, stakeholders identified, open questions logged |
| G2   | `02-product/prd.md`                                | master            | Every FR traceable to a brief goal; NFRs quantified; MVP scope explicit |
| G3   | `03-ux/ux-spec.md`, `04-architecture/architecture.md`, ADRs | master   | Architecture covers every FR/NFR; UX covers every user-facing FR; risks logged |
| G4   | Epics + first sprint stories meet Definition of Ready | master         | PO consistency check passed; DoR checklist 100 % |
| G5   | Story Dev Record complete; all tests green locally | orchestrator      | Build, lint, type-check, tests pass; DoD dev items ticked |
| G6   | 3 review reports in `06-reviews/<story-id>/`       | master            | Zero open **Blocker/Critical** findings across all three reviews |
| G7   | `07-qa/<story-id>-test-report.md`                  | master            | All ACs verified; no open Sev-1/Sev-2 defects; regression green |
| G8   | Release notes, QA summary, open-risk register      | master + human    | All sprint stories Done or explicitly deferred; human sign-off |

**Every gate decision is recorded** in `docs/00-governance/gate-log.md` using
`docs/templates/gate-record.md`. A human delivery lead may override any decision;
the override and its reason are logged.

---

## 4. Story Status Model

`Draft → Ready → In Progress → In Review → (Changes Requested ↺ In Progress) → In QA → (Rejected ↺ In Progress) → Done`
plus `Blocked` (any time, with reason) and `Deferred`.

Only these agents change status:
- scrum-master: `Draft`, `Ready`, `Deferred`
- developer: `In Progress`, `In Review`, `Blocked`
- orchestrator: `Changes Requested`, `In QA` (on master's G6 decision)
- qa-engineer: `Rejected`, `Done` (on master's G7 decision)

---

## 5. Folder Conventions

```
docs/
  project-state.md            ← single source of truth for "where are we"
  00-governance/              ← gate-log.md, risk-register.md, decision-log.md
  01-discovery/               ← project-brief.md, requirements-catalog.md, stakeholder-map.md
  02-product/                 ← prd.md, release-plan.md
  03-ux/                      ← ux-spec.md, journeys/, wireframes/
  04-architecture/            ← architecture.md, adr/ADR-NNN-*.md, test-strategy.md
  05-backlog/                 ← epics/EPIC-NN-*.md, stories/STORY-NN.MM-*.md, sprint-NN-plan.md
  06-reviews/<story-id>/      ← standards.md, quality.md, performance.md, consolidated.md
  07-qa/                      ← test-plan.md, <story-id>-test-report.md, defects/DEF-NNN.md
  standards/                  ← coding-standards.md, definition-of-ready.md, definition-of-done.md
  templates/                  ← every artefact template (copy, never edit in place)
```

IDs: `EPIC-01`, `STORY-01.03` (epic 1, story 3), `ADR-004`, `DEF-012`, `FR-007`, `NFR-003`, `BR-005` (business rule).

---

## 6. Rules Every Agent Follows

1. **Artefacts over chat.** Every output that another role depends on is written to its
   file using the matching template in `docs/templates/`. Chat summaries are not hand-offs.
2. **Read before you write.** Start every task by reading `docs/project-state.md` and the
   upstream artefacts listed in your agent definition.
3. **Traceability is mandatory.** Requirements carry IDs; stories reference FR/NFR IDs;
   tests reference AC IDs; review findings reference file:line.
4. **Never invent facts.** If information is missing, record it as an *Open Question*
   (owner + needed-by) and proceed with a clearly labelled *Assumption*.
5. **Stay in your lane.** Do not do another role's job. If you spot an issue in another
   role's artefact, log it in your output under "Issues for other roles".
6. **No silent scope change.** Scope changes go through product-manager and are logged
   in `docs/00-governance/decision-log.md`.
7. **Security & privacy.** Never place secrets, credentials or real personal data in code,
   tests, fixtures or documents. Use placeholders and environment variables.
8. **Finish with a hand-off block.** End every run with:

```
## Hand-off
- Status: COMPLETE | PARTIAL | BLOCKED
- Artefacts written/updated: <paths>
- Jira / GitHub updates: <issue keys, PR/issue numbers, comment links — or "n/a (local mode)">
- Open questions: <ids or "none">
- Risks raised: <ids or "none">
- Recommended next agent: <agent-name> — <why>
```

---

## 7. Jira & GitHub Integration (when `INTEGRATION_MODE = jira+github`)

Full procedures, comment formats and tool usage: **the `jira-github-playbook` skill (`.claude/skills/jira-github-playbook/SKILL.md`)**.
Every agent reads it before its first Jira or GitHub action in a run.

### 7.1 System of record

| Information | Lives in | Mirror |
|-------------|----------|--------|
| Intake request, phase hand-offs, gate decisions (G0–G4, G8) | Jira **Intake** issue (comments) | `docs/project-state.md` at phase boundaries |
| Epics, stories, sub-tasks, ACs, story status, story discussion | **Jira** | — (story markdown files are not created in this mode) |
| Defects | **Jira Bug** (linked to the story) | GitHub issue labelled `bug` with the Jira key |
| Brief, PRD, UX spec, architecture, ADRs, test plan, standards | **GitHub repo** `docs/` (via a docs PR) | Linked from the Jira Intake issue and epics |
| Code, tests, commits, branches | **GitHub** | Jira development panel (GitHub for Jira app) |
| Dev Record | **PR description** | Summary comment on the Jira story |
| Peer reviews (G6) | **GitHub PR reviews + inline comments** | Summary comment on the Jira story |
| QA test report (G7) | `docs/07-qa/<KEY>-test-report.md` in the story PR | Summary comment on the Jira story + PR comment |
| Tech debt, follow-ups, architecture risks | **GitHub issues** (`tech-debt`, `follow-up`, `architecture`) | Linked in the Jira story/epic comment |

### 7.2 Conversation trail (what you will see in Jira and GitHub)
1. Before every delegation, `orchestrator` posts the **brief** as a Jira comment
   (`🧭 orchestrator → <agent>`) on the Intake issue (inception) or the story (story cycle).
2. Every agent posts its **hand-off** as a Jira comment (`🤖 <agent> — <phase>`) on the same issue.
3. `master` posts every **gate decision** (`⚖️ master — Gx`) on the same issue, and on the PR for G6/G7.
4. Story-level technical discussion (findings, rebuttals, fixes) happens **on the PR**, and its
   outcome is summarised on the Jira story.

### 7.3 Naming & linking rules
- Branches: `feat/<JIRA-KEY>-<slug>`, `fix/<BUG-KEY>-<slug>`, `docs/<INTAKE-KEY>-inception`.
- Commits: `feat(scope): summary [<JIRA-KEY>]` — the key makes Jira link the commit.
- PR title: `<JIRA-KEY>: <story title>`; PR body uses `.github/pull_request_template.md`.
- Every Jira issue created by an agent carries labels `ai-delivery` and `aiid-<internal-id>`
  (e.g. `aiid-EPIC-01`, `aiid-STORY-01.03`) — agents **search by this label before creating**
  so re-runs never duplicate issues.
- Never put secrets, tokens or personal data in Jira or GitHub content.
