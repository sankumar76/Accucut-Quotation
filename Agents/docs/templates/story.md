# STORY-NN.MM: <<Story title>>

| Field | Value |
|-------|-------|
| Epic | EPIC-NN |
| Status | Draft |
| Priority | Must / Should / Could |
| Estimate | <<points>> |
| Trace | FR-…, NFR-…, BR-… |
| Sprint | <<NN>> |
| Branch | feat/STORY-NN.MM-<<slug>> |

## Story
**As a** <<persona>>, **I want** <<capability>>, **so that** <<benefit>>.

**Business value:** <<why now>>

## Acceptance Criteria
| ID | Given | When | Then |
|----|-------|------|------|
| AC-1 | | | |
| AC-2 | (negative path) | | |
| AC-3 | (NFR, e.g. performance/a11y) | | |

## Dev Context
> Extracted by scrum-master so the developer needs no other document unless cited.

- **Architecture rules that apply:** <<quote/summarise with source: architecture.md §x>>
- **Components & responsibilities:** …
- **API contract(s):** …
- **Data model fragment:** …
- **ADRs:** ADR-… — <<decision summary>>
- **Files to create / modify:**
  - `path/to/file` — <<purpose>> (exists / new)
- **Existing patterns to follow:** `path/to/example` — <<what to copy>>
- **Coding standards emphasis:** <<sections>>

## UX References (user-facing stories)
Screens: SCR-… · States required: … · Accessibility notes: …

## Tasks
- [ ] T1 <<task>> (AC-1)
  - [ ] T1.1 <<subtask>>
- [ ] T2 Write unit tests for … (AC-1, AC-2)
- [ ] T3 Integration test for … (AC-3)
- [ ] T4 Update docs / config

## Testing Notes
Test levels, test data, edge cases, mocks/stubs allowed, coverage target.

## Dependencies · Risks · Assumptions

## PO Validation (Definition of Ready)
| DoR item | Result | Note |
|----------|--------|------|
_Validated by product-owner on <<date>>: READY / NOT READY_

---
## Dev Record  _(developer)_
- **Baseline test run:** <<command → result>>
- **Files changed:**
  | Path | Change |
  |------|--------|
- **Decisions & deviations:**
- **Quality loop evidence:**
  | Check | Command | Result |
  |-------|---------|--------|
  | Format | | |
  | Lint | | |
  | Type-check | | |
  | Build | | |
  | Tests | | <<passed/failed/skipped>> |
  | Coverage (changed code) | | <<%>> |
- **Findings / defects addressed:**
  | Finding/Defect ID | Resolution | Commit | Test added |
  |-------------------|------------|--------|-----------|
- **Follow-ups:**
- **DoD (developer) checklist:** all ticked ☐

## Review  _(orchestrator — links)_
- Consolidated: `docs/06-reviews/STORY-NN.MM/consolidated.md` · G6 decision: <<ref>>

## QA  _(qa-engineer)_
- Test report: `docs/07-qa/STORY-NN.MM-test-report.md` · Recommendation: ACCEPT / REJECT · G7 decision: <<ref>>

## Status History
| Date | From → To | By | Note |
|------|-----------|----|------|
