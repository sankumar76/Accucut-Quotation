# Claude Code Agent Team Kit — Requirement to Release, in Jira & GitHub

A drop-in configuration that gives a repository a complete AI delivery team in
[Claude Code](https://code.claude.com/docs/en/sub-agents): **Orchestrator, Master,
Business Analyst, Product Manager, UX Expert, Solution Architect, Product Owner,
Scrum Master, Developer, three Peer Reviewers (Standards, Quality, Performance) and QA**.

Give the team a requirement once. It runs discovery, design and planning, creates the
**Jira** epics, stories and sub-tasks, builds each story on a **GitHub** branch, opens a PR,
reviews it with three independent reviewers (inline PR comments), tests it, logs defects as
Jira Bugs and GitHub issues, and records every hand-off and gate decision as a comment in Jira.
It stops only at the human approval points you configure (release, by default).

---

## 1. What's in the box

```
CLAUDE.md                          Operating model + Project & Integration Profile (edit first)
README.md                          This guide
.mcp.json                          Atlassian (Jira) and GitHub MCP server connections
.github/pull_request_template.md   PR body incl. Dev Record and gate checklist
.gitignore.claude-kit              Lines to append to your .gitignore
.gitattributes                     Keeps .sh files in Unix line endings (needed on Windows)
.claude/
  settings.json                    Permissions: allow feature/docs pushes + MCP, deny force-push,
                                   pushes to main, local merges, rm -rf, reading secrets
  hooks/restrict-writes.sh         Each role writes only its own artefacts
  hooks/block-git-writes.sh        Read-only roles cannot commit/push
  agents/                          13 agents (orchestration, discovery, design, delivery, review, quality)
  skills/
    jira-github-playbook/          Jira & GitHub rulebook, preloaded into every agent
    autopilot/     /autopilot      Whole lifecycle unattended; re-run to resume
    kickoff/       /kickoff        Inception G0 → G4
    story-cycle/   /story-cycle    One story: build → PR → 3 reviews → QA (G5 → G7)
    gate-check/    /gate-check     Formal gate decision by master
    project-status/ /project-status Executive status report
scripts/
  run-autopilot.sh / .ps1          Unattended run (headless Claude Code); .ps1 = Windows PowerShell
  preflight.sh / .ps1              Checks tokens, MCP auth, git remote, placeholders
  setup-github-labels.sh / .ps1    Creates the labels the agents use
docs/
  project-state.md                 Ledger (Jira is the live view in integrated mode)
  00-governance/                   gate-log, risk-register, decision-log
  01-discovery … 07-qa/            Artefact folders per role
  standards/                       coding-standards, DoR, DoD (+ pointer to the playbook skill)
  templates/                       15 artefact templates
```

## 2. What you will see in Jira and GitHub

| Where | What appears | Posted by |
|-------|--------------|-----------|
| **Jira Intake issue** `[AI Delivery] <project>` | Your requirement; every delegation brief (🧭), every agent hand-off (🤖) and every gate decision (⚖️) for inception; sprint plan; progress; approval requests (✋) | orchestrator, all inception agents, master |
| **Jira open-question issues** `Q-nn` | Blocking questions for stakeholders, linked to Intake | business-analyst, product-manager |
| **Jira Epics** | Goal, scope, epic ACs, links to PRD/UX/architecture | product-owner |
| **Jira Stories + Sub-tasks** | Story, ACs (Given/When/Then), Dev Context, testing notes, points, links; DoR verdict; per-story briefs, hand-offs, review and QA summaries, G6/G7 decisions; status moving To Do → Ready → In Progress → In Review → In QA → Done | scrum-master, product-owner, developer, reviewers, qa-engineer, master, orchestrator |
| **Jira Bugs** | Defects with repro steps, linked to the story and to a GitHub issue | qa-engineer |
| **Jira development panel** | Branches, commits, PRs, builds (needs the *GitHub for Jira* app) | automatic |
| **GitHub inception PR** `<INTAKE>: Inception artefacts` | Brief, requirements, PRD, UX spec, architecture, ADRs, test strategy, backlog docs | orchestrator (commits), authoring agents |
| **GitHub story PRs** `<KEY>: <title>` | Code, tests, Dev Record, QA report; three PR reviews with inline `STD-`/`QLT-`/`PRF-` findings; fix replies in threads; gate labels; master's decisions | developer, reviewers, qa-engineer, master, orchestrator |
| **GitHub issues** | `bug` (mirrors Jira Bugs), `tech-debt`, `follow-up`, `architecture` | qa-engineer, reviewers/master, developer, solution-architect |

## 3. One-time setup

### 3.1 Jira (admin)
1. Choose the project (key) and confirm issue types: Epic, Story, Sub-task, Bug and one type
   for the Intake issue (Task is fine).
2. Make sure the workflow has statuses for the mapping in `CLAUDE.md` §1a (add *Ready for Dev*,
   *In Review*, *In QA*, *Blocked* if missing, or map them to what you have).
3. Enable the **Atlassian Rovo MCP Server** for your site. Calls consume Rovo credits from
   your organisation's pool — check your plan allowance.
4. Recommended: install **GitHub for Jira** and connect the repository.
5. Optional: create a service user (e.g. "AI Delivery") and have it authenticate the MCP
   server, so agent actions are attributed to it rather than a person.

### 3.2 GitHub (admin)
1. Create a **fine-grained token** (ideally on a bot account) for the repository with:
   Contents, Pull requests, Issues = Read & write; Metadata = Read; Checks/Actions = Read.
   Export it as `GITHUB_PAT` (CI secret or your shell profile — never commit it).
2. **Branch protection** on the base branch: required CI checks, required review from
   CODEOWNERS for code paths, no force pushes. This is the real safety net under automation.
3. Run `scripts/setup-github-labels.sh owner/repo`.
4. Optional: a second bot token for formal approvals — see §6.

### 3.3 Repository
```bash
cp -r kit/.claude kit/.github kit/docs kit/scripts kit/.mcp.json kit/CLAUDE.md .
cat kit/.gitignore.claude-kit >> .gitignore
chmod +x .claude/hooks/*.sh scripts/*.sh
```
Then edit:
- `CLAUDE.md` §1 **Project Profile** (stack, build/lint/test commands) and §1a **Integration
  Profile** (Jira site, key, issue types, status mapping, story-points field, delivery lead,
  repo, automation level, approval points, merge policy).
- `docs/standards/coding-standards.md` (the reviewers enforce it).

Commit and push to the base branch.

### 3.4 Authenticate once per machine / runner
```bash
export GITHUB_PAT=...            # GitHub MCP uses this header
claude                           # open Claude Code in the repo, accept the workspace-trust prompt
/mcp                             # select "atlassian" → Authenticate (browser OAuth)
```
Then `scripts/preflight.sh` should pass.

### 3.5 Windows
- Install **Git for Windows** (provides Git Bash). Claude Code runs the kit's guard hooks with
  Git Bash; without it the hooks cannot run.
- Use the `.ps1` scripts from PowerShell: `.\scripts\preflight.ps1`,
  `.\scripts\run-autopilot.ps1 "<requirement>"`, `.\scripts\setup-github-labels.ps1 owner/repo`.
  If PowerShell refuses to run them, once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  and `Get-ChildItem .\scripts\*.ps1 | Unblock-File`.
- Set the token permanently: `setx GITHUB_PAT "your-token"` (then open a new window).
- Install jq: `winget install jqlang.jq`. GitHub CLI: `winget install GitHub.cli`.
- `.claude/settings.json` sets `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` so agents run commands through
  Git Bash, where the permission rules and git guard apply.
- Keep `.gitattributes` — it stops Git converting the `.sh` hooks to Windows line endings.

## 4. Running it

### Fully automatic
```bash
scripts/run-autopilot.sh "Customers need a self-service portal to view invoices, download PDFs and raise disputes. Sponsor: Head of Billing. Go-live target: Q2."
# or
scripts/run-autopilot.sh --file requirements/invoice-portal.md
```
The run continues until it reaches a human approval point, runs out of Ready stories, hits a
loop limit, or meets a blocker. Each stop is explained on the Jira Intake issue with an
@mention of the delivery lead. **To resume** after you reply `APPROVED` (or `CHANGES: …`) on
the Intake issue:
```bash
scripts/run-autopilot.sh
```

### Interactive
```bash
claude --agent orchestrator
/autopilot <requirement>      # same as the script, but you can watch and interject
/kickoff <requirement>        # inception only
/story-cycle PROJ-123         # one story
/gate-check G3
/project-status
```

## 5. Automation controls (`CLAUDE.md` §1a)

| Setting | Default | Options |
|---------|---------|---------|
| `AUTOMATION_LEVEL` | `full` | `gated` — orchestrator asks you before each phase |
| `HUMAN_APPROVAL_POINTS` | `G8` | Add gates, e.g. `G2,G3,G8` to approve the PRD and architecture before build |
| `MERGE_POLICY` | `docs-auto, code-human` | `all-auto` — orchestrator squash-merges code PRs after G7 GO and green checks (still subject to branch protection) |
| `REVIEW_IDENTITY` | `single-token` | `reviewer-bot` — see §6 |

With `code-human`, stories that depend on unmerged PRs wait; independent stories continue.
Use `all-auto` if you want an uninterrupted sprint and rely on branch protection + CI.

Permission mode for unattended runs: `PERMISSION_MODE=auto` (default, a classifier approves
safe actions) or `PERMISSION_MODE=dontAsk` (only what `.claude/settings.json` allows runs;
add your build/test commands to `permissions.allow` first).

## 6. Formal PR approvals (optional)
GitHub does not let an account approve or request changes on its own PR. With one token the
reviewers therefore submit **COMMENT** reviews with the verdict in the body and a
`review:*` label. For real APPROVE / REQUEST_CHANGES reviews:
1. Create a second bot account with a token (`GITHUB_REVIEWER_PAT`).
2. Add a second server to `.mcp.json`:
   ```json
   "github-reviewer": { "type": "http", "url": "https://api.githubcopilot.com/mcp/",
     "headers": { "Authorization": "Bearer ${GITHUB_REVIEWER_PAT}" } }
   ```
3. In the three reviewer agents replace `mcp__github__*` with `mcp__github-reviewer__*`, add
   `"github-reviewer"` to `enabledMcpjsonServers`, and set `REVIEW_IDENTITY = reviewer-bot`.

## 7. Tools, skills, plugins and MCP servers on the machine

The agents use whatever is installed where they run, not just Jira and GitHub.

| What | Reaches the specialists? | How |
|------|--------------------------|-----|
| **MCP servers** — user-level (`claude mcp add …`), project `.mcp.json`, plugin-provided | ✅ All of them | Specialists have no `tools:` allowlist, so they inherit every tool in the session. Each role's `disallowedTools` removes only what it must not do. |
| **Skills** — project `.claude/skills`, user `~/.claude/skills`, plugin skills | ✅ All of them, on demand | Inherited Skill tool. Each agent is told to discover and prefer relevant skills. |
| **Preloaded skills** | ✅ `jira-github-playbook` in every agent | `skills:` field — the skill's full text is in the agent's context from the start. |
| **Hooks** — user, project, managed and plugin settings | ✅ Always | Session hooks fire inside subagents; agent-specific write/git guards add to them. |
| **Plugins** | ✅ Their skills, MCP servers and hooks | Through the three routes above. |
| **CLAUDE.md** — user, project, local | ✅ | Loaded into every custom subagent. |

What each specialist is still denied:

| Agent | Denied (`disallowedTools`) | Also guarded by |
|-------|----------------------------|-----------------|
| All specialists | `Agent` (only the orchestrator delegates) | — |
| developer, qa-engineer | GitHub PR merge | write-guard (QA only) |
| all other specialists | GitHub PR merge, GitHub file writes, GitHub branch creation | write-guard; git-guard for master, scrum-master, architect, reviewers |

The **orchestrator** keeps an explicit tool list (that is what limits it to spawning only the
delivery agents). It has Jira, GitHub and all skills; it delegates work that needs other
tools to the right specialist. To give it another server, add `mcp__<server>__*` to its
`tools:` line.

**Pointing roles at your company's tools.** Each agent ends with a "Typical tools and skills
for your role" list (e.g. QA → Playwright, axe, k6; architect → cloud and observability
servers; BA → Confluence, Slack, meeting transcripts). Edit these lists to name the servers
and skills your company actually uses. To guarantee a skill is always in a role's context,
add it to that agent's `skills:` list, for example:
```yaml
skills:
  - jira-github-playbook
  - acme-coding-standards      # your company skill
  - frontend-design
```
A listed skill that isn't installed is skipped with a warning in the debug log.

**Things to keep in mind**
- Wider access means the guardrails are your permissions, hooks and branch protection, not
  the tool lists. Review `.claude/settings.json` when you connect write-capable servers
  (e.g. chat, ticketing, cloud): add `deny` rules for actions agents must never take, such as
  `mcp__slack__send_message` if posting should stay human.
- `.claude/settings.json` pre-approves only the Atlassian and GitHub servers. Other servers'
  tools follow your permission mode: prompts in interactive runs, the classifier in
  `PERMISSION_MODE=auto`, and **denied** in `dontAsk` unless you add them to `permissions.allow`.
- Every connected server's tool descriptions load into each agent's context. Disconnect
  servers the team doesn't need, or deny whole servers per role with `mcp__<server>` in
  `disallowedTools`.
- Agents running in the background keep all MCP tools but only a fixed set of built-in tools.
- MCP servers must be authenticated on the machine (or CI runner) that runs the agents.

## 8. Model & cost tuning
| Agent | Model | Why |
|-------|-------|-----|
| orchestrator, master, solution-architect, reviewer-quality | `opus` | Judgement-heavy |
| others | `sonnet` | Structured production work |

Force one model for all subagents: `"env": { "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet", "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1" }`.
Each Jira call also uses Rovo credits; a typical story produces ~10–20 Jira calls.
Loop limits (2 gate attempts, 3 fix loops per story) cap runaway cost.

## 9. Customising
| Want to… | Change |
|----------|--------|
| Enforce your coding standards | `docs/standards/coding-standards.md` |
| Different Jira statuses / issue types | `CLAUDE.md` §1a only |
| Keep business docs in Confluence | Add a Confluence step to each authoring agent's duties (the Atlassian MCP server covers Confluence) and link pages instead of repo files |
| Azure DevOps / GitLab instead | Swap the MCP server in `.mcp.json`, and update tool prefixes in agent `tools:` lines and the playbook |
| Add Security Reviewer / DevOps | Copy a reviewer agent, adjust checklist and outputs, add it to the orchestrator's `Agent(...)` list and `/story-cycle` step 4 |
| Run in CI instead of a laptop | Call `scripts/run-autopilot.sh` from a scheduled or manually-triggered pipeline with `GITHUB_PAT` as a secret; Atlassian OAuth needs to be completed once for that runner's identity (or use API-token auth if your admin enables it) |

## 10. Governance & safety
- Humans own: release (G8), merges of code PRs (unless you choose `all-auto`), scope and budget.
- The agents can't force-push, push to protected branches, run local merges, delete files via
  the GitHub API, or read `.env`/key files. Read-only roles can't commit or push at all.
- Branch protection and CODEOWNERS are your enforceable controls; the hooks and permissions
  are guardrails on top.
- Never put secrets or personal data in requirements, Jira or GitHub content.
- Review the agents' prompts at each retrospective; version them like code.

## 11. Troubleshooting
| Symptom | Fix |
|---------|-----|
| "Atlassian MCP needs authentication" | `claude` → `/mcp` → atlassian → Authenticate |
| GitHub 401/403 | `GITHUB_PAT` missing, expired or lacking repo permissions |
| Jira transition fails | Status names in `CLAUDE.md` §1a don't match your workflow, or no transition path exists |
| Story points not set | Wrong custom field ID in §1a (find it in Jira field settings) |
| Sprint not assigned | The MCP server may not expose sprint editing; stories carry a `sprint-NN` label — add a Jira automation rule to set the sprint from the label |
| Reviewer review fails with "can't request changes on your own PR" | Expected with one token — set `REVIEW_IDENTITY = single-token` or configure §6 |
| Duplicate Jira issues | Someone removed the `aiid-*` labels; agents search on them before creating |
| "Write guard" / "Git guard" messages | Working as designed — a role tried to act outside its lane |
| Hooks not running | Accept the workspace-trust prompt in the project folder |
| An agent doesn't use a tool you installed | Check it is connected and authenticated (`claude mcp list`, `/mcp`); name it in that role's "Typical tools" list or in the delegation brief; check it isn't in the role's `disallowedTools` |
| "Agent descriptions over the token limit" warning | Too many agents installed across scopes/plugins; trim `description` fields |
