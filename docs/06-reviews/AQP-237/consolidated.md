# Consolidated review: AQP-237 (STORY-10.18), PR #250 (head 87465b6)

Orchestrator, 2026-11-11. Three reviews, per the story's Dev Context. CI 43027184210 green 5 of 5 (unit 3,054 = +140, full 5,377 = +140, E2E 778). Developer plants #251 (P4, lint) and #252 (P1, P2, P3, P3b, P5) red. 15 `record` calls counted (AC-4 says 11).

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Review |
|---|---|---|---|---|---|---|---|
| standards | REQUEST CHANGES | 0 | 0 | 1 | 8 | 3 | `standards.md`, Jira 11510 |
| quality | REQUEST CHANGES | 0 | 1 | 1 | 4 | 1 | 5860664620, `quality.md`, Jira 11513 |
| performance | APPROVE | 0 | 0 | 0 | 0 | 2 | `performance.md`, Jira 11511 |

## Findings, by severity

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| QLT-01 | Critical | The check accepts a `tx` that is a parameter of any enclosing function, not of the function directly holding `record`, so a `record` inside `forEach(async () => ...)` in the callback passes (plant Q2, #257). All 15 real calls already meet the stricter rule. Developer's Decision 4; not ruled by architect or product-owner | quality |
| QLT-02 | Major | An un-awaited `record` (`void audit.record(...)` or a missing `await`) passes; lint does not catch it (plants Q1, Q1b). All 15 real calls are awaited | quality |
| STD-01 | Major | `checkAuditTransactions` (`tests/support/audit-transaction-check.ts:129-280`) is 152 lines with ten inner functions and no inline justification (Coding Standards §1, 40 lines) | standards |
| QLT-03 | Minor | Calls picked by name only: `audit.record.call` / `.bind` aliases unchecked (Q3, Q3b); `z.record(...)` in a service falsely flagged (Q6, `audit-events.ts:298`), and no escape hatch is allowed | quality |
| QLT-04 | Minor | A repository call in a closure that never runs counts as "another repository call" (Q5) | quality |
| QLT-05 | Minor | Lint tests check only the rule ID: with the new rule removed from the group blocks, 22 of 27 tests still pass | quality |
| QLT-06 | Minor | The test header's "what it cannot see" list omits these forms | quality |
| STD-02 to STD-09 | Minor | Complexity 14 in `chainProblem`; test file 442 lines; unnamed `120_000`; ESLint test helper duplicated (extract for the new file, older ones to tech-debt); `eslint.config.mjs` comment wrong and block position undocumented; `import()` message; "types only" overstated for `transaction`; naming and magic strings | standards |
| QLT-07, STD-10 to STD-12, PRF-01, PRF-02 | Info | Exported cross-file helper with a kept handle passes (documented limit); Engineer import rule change is stricter, not weaker (both reviewers); handle matched by module name; control branches to delete; 5.2 s / 4.1 s test baseline for the test strategy; `usesOf` rescans per helper call | quality, standards, performance |

## Plant evidence

- Developer: #251, #252 (closed). reviewer-quality: #257 (Q1 to Q6; closed). Branches `chore/AQP-237-plants-control`, `-b` and `chore/AQP-237-qlt-plants-control` remain on the remote (delete refused).
- #235 and #247 merged locally into 87465b6 by reviewer-quality: the check still visits 15 calls with no finding.

## Questions for master

- QLT-01 and QLT-02: fix now, or an architect ruling if the current behaviour is kept.
- Step count (three calls pass, four fail): product-owner to confirm. AC-4's 11 vs the counted 15: product-owner.
- Architecture §6 count ("eight" / 11) to 15: architect. PRF-01 baseline: architect.
- CI path: no effect (performance); RISK-023 stays 8.
