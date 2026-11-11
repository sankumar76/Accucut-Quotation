# Consolidated review: tech-debt #119, PR #235 (head b2741ca)

Orchestrator, 2026-11-11. Route: one behaviour-preserving refactor PR, reviewed by reviewer-standards and reviewer-quality (DL-142 (3)). CI 43002218101 green 5 of 5 (E2E 778, unit 2,908, full Vitest 5,271 = 5,231 + 40 generated `engineer-import-rule` cases). Developer plants #236 to #238 red as before.

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Review |
|---|---|---|---|---|---|---|---|
| standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 4 | 5 | 5857568408, `standards.md` |
| quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 2 | 4 | 5857625090, `quality.md` |

## Findings, by severity

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| QLT-01 | Minor | No test pins either branch of the shared read-again effect on Process or Materials (`use-read-again.ts:40-41`). Plants A1 (#239) and A2 (#240) fail only exchange-rates and treatments tests; the Process and Materials DEF-020 and focus-return tests pass. The PR cannot add tests (behaviour-preserving, tests unchanged). Proposed: a follow-up with one slow-read E2E per dialog screen, A1 and A2 as controls, before AQP-142's G6 | quality |
| QLT-02 / STD-05 | Minor / Info | "Closes #119" would close the issue, but three original proposals are neither done nor declared out of scope: `useMasterList`, the dialog-loader wiring, and Process on `MasterSearchBox` (also `RUPEE`, per STD-05) | quality, standards |
| STD-01 | Minor | `ReadStatus` is a fifth copy of the same union; `OpenerRef` is inline in `use-treatments.ts` | standards |
| STD-02 | Minor | Comments still say "Process Master" after the rename; `MATERIAL_TEXT_MAX_LENGTH = 100` is a separate literal | standards |
| STD-03 | Minor | `whenFailed?: boolean` is not a predicate name and lacks `\| undefined` | standards |
| STD-04 | Minor | Test files keep the old module names (`process-opener.test.ts`, `process-items-lib.test.ts`) | standards |
| STD-06 | Info | Stale `FUTURE_IMPORTS` entry for `material-repository` in `engineer-import-rule.test.ts:87` (G12 scope), left for master | standards |
| STD-07 | Info | Architecture §6 and §4.9 name `master-repository` for the hidden-row rule | standards |
| STD-08 | Info | `tech-debt/` branch and `#119:` title follow PR #139, outside the §9 patterns | standards |
| STD-09 / QLT-03 | Info | Both reviewers recommend keeping `master-constraints.ts` as a third file (no cycle, no Process-imports-Material) | standards, quality |
| QLT-04 | Info | No test checks the row lock alone (#243 green, as at AQP-130 #213); pre-existing | quality |
| QLT-05 | Info | Exchange-rates effect dependencies grew to `[status, row, SAVE_BUTTON, true]`; harmless | quality |
| QLT-06 | Info | Test edits pass G12: 13 assertion lines renamed in identifier only, no test added or removed | quality |

## Plant evidence

- Developer (closed): #236 DEF-020 in the shared effect (exchange-rates 3 of 3 red), #237 DEF-020 close handler (9 of 9), #238 focus-on-refusal removed (30 of 30).
- reviewer-quality (closed; branches not deleted, permission refused): #239 A1 red 9, #240 A2 red 9, #241 B1 red 3, #242 B2 red 2, #243 B3 green as predicted.

## For master (G6)

Zero Blocker, Critical or Major. Decide: `master-constraints.ts` placement; QLT-01 routing (follow-up and due point); whether #119 stays open (QLT-02 / STD-05); which Minors ride a push before merge; STD-06; the doc references for other roles (ux-spec line 853, architecture §4.9 / §6, the test-strategy Vitest total).
