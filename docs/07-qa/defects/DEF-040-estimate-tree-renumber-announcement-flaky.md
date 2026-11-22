# DEF-040: `estimate-tree.spec.ts:103` [desktop] flaky: after Alt+ArrowUp the live region never says "Part renumbered to 1" (expect toHaveCount(1) received 0 after 15 s; passed on retry; seen once, PR #464)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.02 (AQP-302) AC-2 (arrow keys, Home, End and Alt with arrows; the screen says what changed) |
| Severity | Sev-3 Moderate, **provisional**; raise to Sev-2 if a snapshot shows the tree moved but no announcement |
| Priority | P3 |
| Type | Undecided: Product (move dropped or announcement missing) or Test; not shown to be a product fault |
| Status | **Open** (Jira To Do; a diagnostic PR #472 merged as `5c4a21a6`; fix not merged). Hardening window; DL-275 A11 asks for a fix or a written acceptance at G8 |
| Jira / GitHub | [AQP-343](https://sankumar76.atlassian.net/browse/AQP-343) / [#468](https://github.com/sankumar76/Accucut-Quotation/issues/468) |
| Found by / date | qa-engineer, 2026-11-17; PR #464 head `6097dff` |
| Environment | CI run 44087410883, job `Stage 12: E2E (shard 4 of 4)`, project desktop, dev server; no trace kept (first attempt) |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-343, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Not reproduced. Spec lines 127 to 138: tree 1, 1.1, 2; walk focus; press Alt+ArrowUp on part 2; expect text "Part renumbered to 1" (a `role="status"` sr-only paragraph in `tree-panel.tsx`, filled by `use-parts-tree.ts` `move()` after the server answered ok).

## Expected Result
The live region reads "Part renumbered to 1" (one element) and the tree reads 1, 2, 2.1.

## Actual Result
First attempt 28.7 s: `toHaveCount(1)` received 0 after the full 15 s (clean assertion failure, not a 30 s timeout or a reset); retry passed in 17.0 s. 1 in 11 runs.

## Suspected Area
`tree-panel.tsx` (Alt+Arrow branch), `use-parts-tree.ts` (`move`, `change`, the `busy` gate: it returns silently when busy); test side `estimate-tree.spec.ts:127-138` (no wait that the selected part is focused and nothing is in flight).

## Fix & Verification  _(developer / qa-engineer)_
Deciding evidence: the `error-context.md` or a trace of a failed first attempt (danger notice, unchanged tree, or moved tree with an empty region), the dev-server status of the move request, or a `--repeat-each` loop in CI.
