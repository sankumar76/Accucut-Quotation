# EPIC-08: Admin configuration of fields and formulas

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-23](https://sankumar76.atlassian.net/browse/AQP-23) (labels `ai-delivery`, `aiid-EPIC-08`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-03) |
| Release | R2 (built after the R1 core, one hand-over under scope A) |
| Priority | Medium. PRD value 3, effort 12 to 16 h (estimate); the largest and least certain block |
| Status | Draft. Re-issued 2026-11-02 against SPEC v1.11, PRD v0.10, UX v0.5, architecture v0.9. Scope unchanged, so the Jira epic was not edited (the only change is 0.25 h less: no ROLLUP warning on the formula check) |

## Goal & User Value
The Admin changes fields and formulas without a developer, with Excel-style re-lettering, immutable versions, checkpoints and a change history. This closes SPEC MUST BRQ-006.

## Requirements Covered
- Functional: FR-072 to FR-080 (9 FRs, all Must, R2).
- Non-functional: NFR-004 (password re-entry, 3 of 3 actions; the hand-over of FR-006 is the fourth), NFR-007 (configuration events), NFR-025.
- Business rules: BR-005, 035 to 039, 012; BRQ-006, 007, 008.

## Scope
**In:** column list (Admin edits, Lead read-only on SCR-17); formula editor with autocomplete, live check and preview; insert input, output or input with cost column, with a letter preview; automatic re-lettering with formulas keeping the same results and BL, BN, BO moving with their columns; delete only after references are changed; immutable versions, approved estimates pinned; named checkpoints, revert (logged, undoable); change history view and filter; password re-entry on formula save, field delete and revert.
**Out:** Lead formula reading in R1 (EPIC-06, SCR-07); dark mode.

## UX & Architecture References
- Screens / journeys: SCR-16 (Configuration filter), SCR-17 (and the Lead variant), SCR-18, 19, 20, 21; UJ-12.
- Components: `server/config`, `lib/fields`, `lib/formula`, `lib/columns.ts`; architecture sections 4.5, 8; ADR-004, ADR-005. UX-40 (BM as a system field on SCR-17) and UX-41 (Scrap Weight seeded formula shown) are done on the screens (UX v0.5; verified in `SCR-17.html` and `SCR-07.html`).

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-08.01 | Fields and formulas list | Letter, label, section, type, formula; Admin and Lead views (FR-072) | Workflow step (read) | 03.01 | Draft |
| 2 | STORY-08.02 | Edit a formula | Autocomplete, live check, preview on a sample node; unknown name, syntax error and cycle cannot be saved; password re-entry through the step-up primitive built in STORY-06.12 (FR-073, FR-080 part). BL is listed as `SUM(BG)`, a system formula that can be edited and re-lettered like any other | Happy path, then unhappy paths | 08.01, 03.02, 06.12 | Draft |
| 3 | STORY-08.03 | Insert a field with re-lettering | Choose position and group; preview letter changes; new inputs mandatory and visible to Engineers, new outputs hidden; formulas keep results (FR-074, 075) | Workflow step | 08.02 | Draft |
| 4 | STORY-08.04 | Delete a field | Refused while any formula references it, listing them; password re-entry (FR-076, FR-080 part) | Business rule | 08.02 | Draft |
| 5 | STORY-08.05 | Configuration versions | Every change creates an immutable version; each estimate records its version; approved estimates pinned (FR-077) | Workflow step | 08.02, 03.05 | Draft |
| 6 | STORY-08.06 | Checkpoints and revert | Save, list, revert (logged, undoable, password re-entry); estimate data untouched (FR-078, FR-080 part) | CRUD operations | 08.05 | Draft |
| 7 | STORY-08.07 | Change history | Who, when, old and new for fields, formulas and reverts; filter by user and date (FR-079) | Data variation | 08.05, 01.07 | Draft |

## Epic Acceptance Criteria
- [ ] SPEC 14.6: insert after AX gives AY, former AY to BO shift one, and BL2 and BO2 move to BM2 and BP2; all displayed formulas keep calculating the same results.
- [ ] SPEC 14.7 and 14.9: deleting a referenced field is refused with the formula list; a formula with an unknown letter or name, a syntax error or a cycle cannot be saved; formula save, field delete and revert each fail without the correct password.
- [ ] SPEC 14.8: revert restores a checkpoint, is logged and can be undone, and leaves approved estimates unchanged.
- [ ] Every configuration change creates an immutable version, each estimate records its version, and changing a formula leaves an approved estimate's values and layout unchanged.
- [ ] The change history shows each change with all its parts and filters by user and date.

## Dependencies & Risks
- Depends on: EPIC-03 (engine, registry, versioning from R1), EPIC-01 (audit, step-up).
- Order inside R2: this epic before EPIC-09. PRD section 8 leaves the order open; ruling in `backlog.md`: EPIC-08 first, because it is the largest and riskiest block (more time to recalibrate), it closes a SPEC MUST, and EPIC-09 depends on mail facts that may arrive late.
- Open inputs: none blocking.
- Risks: underestimation (no velocity; the audit screen may lower the estimate by up to 1 h, not taken); re-lettering correctness (property test in the test strategy).
