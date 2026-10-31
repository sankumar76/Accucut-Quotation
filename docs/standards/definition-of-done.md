# Definition of Done (DoD)

A story is `Done` only when every applicable item is satisfied and evidenced.

## Developer (checked before G5 — Code Complete)
- [ ] All acceptance criteria implemented; every task in the story ticked.
- [ ] Code follows `docs/standards/coding-standards.md`.
- [ ] Unit tests written for new/changed logic; integration tests for new interfaces.
- [ ] Coverage on changed code ≥ <<80>> % (or the project threshold).
- [ ] Build, lint, type-check and full test suite pass locally — command output recorded in the Dev Record.
- [ ] No secrets, credentials, debug code, commented-out code, or unresolved TODOs without a ticket.
- [ ] Public interfaces documented; README / runbook updated if behaviour or config changed.
- [ ] Database migrations are reversible and tested.
- [ ] Dev Record in the story completed (files changed, decisions, deviations, test evidence).

## Peer Review (G6)
- [ ] reviewer-standards, reviewer-quality and reviewer-performance have each issued a report.
- [ ] Zero open **Blocker** or **Critical** findings.
- [ ] **Major** findings fixed or explicitly accepted by master with a logged reason.

## QA (G7)
- [ ] Every AC verified with evidence (test ID, result).
- [ ] Regression suite green.
- [ ] Exploratory testing performed on risk areas; results recorded.
- [ ] No open Sev-1 / Sev-2 defects against the story.
- [ ] Accessibility checks passed for user-facing changes.

## Closure
- [ ] Story status `Done`, project-state ledger updated, gate decisions logged.
- [ ] Release notes entry drafted (user-visible changes).
