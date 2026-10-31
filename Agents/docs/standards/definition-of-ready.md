# Definition of Ready (DoR)

A story may move from `Draft` to `Ready` only when **every** item is satisfied.
The scrum-master self-checks; the product-owner validates; master confirms at G4.

## Business clarity
- [ ] Written in the form *As a <persona>, I want <capability>, so that <benefit>*.
- [ ] Traces to at least one FR/NFR ID in `docs/02-product/prd.md` and to its epic.
- [ ] Business value and priority (MoSCoW) stated.
- [ ] Relevant business rules (BR-IDs) listed.

## Acceptance criteria
- [ ] 3–10 acceptance criteria, each with an ID (`AC-1`, `AC-2` …).
- [ ] Each AC is testable and written in Given / When / Then.
- [ ] Negative / error paths covered (invalid input, permissions, empty states, timeouts).
- [ ] Non-functional criteria that apply (performance, security, accessibility) are explicit and measurable.

## Technical clarity
- [ ] "Dev Context" section cites the exact architecture sections, ADRs, and source-tree locations needed.
- [ ] Data model / API contract changes identified.
- [ ] Dependencies on other stories, services or teams identified and unblocked.
- [ ] No open question that would block implementation.

## UX clarity (user-facing stories)
- [ ] Linked to the screen / journey in `docs/03-ux/ux-spec.md`.
- [ ] States defined: default, loading, empty, error, success.
- [ ] Accessibility notes present (WCAG 2.2 AA target).

## Sizing
- [ ] Estimated (story points or T-shirt) and small enough to finish within one sprint.
- [ ] Tasks / subtasks listed for the developer.
