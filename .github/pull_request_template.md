## <JIRA-KEY>: <Story title>

**Jira:** <link>  ·  **Epic:** <key>  ·  **Branch:** `feat/<JIRA-KEY>-<slug>`

### What & why
<2–4 sentences: the user-visible change and the acceptance criteria it satisfies.>

### Acceptance criteria coverage
| AC | Implemented in | Test(s) |
|----|----------------|---------|
| AC-1 | | |

---

### Dev Record
**Baseline test run:** <command → result>

**Files changed**
| Path | Change |
|------|--------|

**Decisions & deviations** (with reasons; link ADRs)

**Quality loop evidence**
| Check | Command | Result |
|-------|---------|--------|
| Format | | |
| Lint | | |
| Type-check | | |
| Build | | |
| Tests | | |
| Coverage (changed code) | | |

**Findings / defects addressed**
| Finding / Defect | Resolution | Commit | Test added |
|------------------|------------|--------|-----------|

**Follow-ups:** <GitHub issue links>

### Checklist (Definition of Done — developer)
- [ ] All ACs implemented and covered by tests
- [ ] Coding standards followed; no secrets, debug code or untracked TODOs
- [ ] Docs / config updated where behaviour changed
- [ ] Migrations reversible and tested (if any)
- [ ] Cost confidentiality (STORY-01.03 AC-6): every new Restricted value is in `tests/support/canary-masters.ts` with its loader; every new route or page is in the route manifest, with a real-value recipe in `tests/support/route-calls.ts` for a dynamic segment; the canary scan still finds 0 (or: "none added")

### Gates
- [ ] G5 Code complete (orchestrator)
- [ ] G6 Peer review — standards · quality · performance (master)
- [ ] G7 QA acceptance (master)
