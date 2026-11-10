# Consolidated Review — AQP-269 / AQP-270 / AQP-271 (DEF-024, DEF-025, DEF-026: dialog focus jump while typing)

| Field | Value |
|-------|-------|
| PR | [#167](https://github.com/sankumar76/Accucut-Quotation/pull/167), head `69805d1`, from `master` 322cd8e |
| CI on head | Run 42852617579, green 5 of 5, path 5:05 |
| Scope | 7 files: `src/components/shared/use-focus-on-refusal.ts` (new), the Material, Process and Users form dialogs, and one keyboard E2E test per dialog |
| Review route | Full three reviews (touches `src/`, DL-124 (1)); reviewers ran nothing locally (machine memory), evidence from the diff, CI logs and control PRs |
| Reports | [standards.md](standards.md), [quality.md](quality.md) (review 5845771350), [performance.md](performance.md) |
| Consolidated by | orchestrator, 2026-11-10 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info |
|----------|---------|---------|----------|-------|-------|------|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 3 | 2 |
| reviewer-quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 3 | 3 |
| reviewer-performance | APPROVE | 0 | 0 | 0 | 0 | 1 |
| **Distinct** | | **0** | **0** | **0** | **6** | **6** |

## Findings (by severity)

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| QLT-01 | Minor | The new tests skip the defects' second sequence for Material and Users: typing into a later refused field while an earlier one still shows its message | quality |
| QLT-02 | Minor | A second refusal of the same field is not tested: control PR #169 (focus request kept as a field name, run 42856570620) passed every job | quality |
| QLT-03 | Minor | Focus after a server refusal is tested only for Material: control PR #170 (focus dropped after a server refusal, run 42856414166) failed only the 6 Material tests | quality |
| STD-01 | Minor | Two different hooks are named `useFocusOnRefusal` (the shared one and the local one in `use-exchange-rates.ts`); the follow-up to merge them has no ticket | standards |
| STD-02 | Minor | `useFieldFocus` in the Process dialog now also returns `showErrors`; its nested ternary differs from the Users dialog's lookup | standards |
| STD-04 | Minor | `UserForm` is 146 lines with no inline justification (pre-existing) | standards |
| STD-03 | Info | Rename `order` to `fieldOrder` | standards |
| STD-05 | Info | Test traceability to DEF-024..026 is good | standards |
| PRF-01 | Info | Hook runs no effect per keystroke (one batched update per refusal); first-load JS 0 / -2 / +3 B; the 9 instances cost 23.9 s of worker time, about 2.5 s on the path; AQP-244's ledger may use about 0.8 s per instance | performance |
| QLT-(Info) x3 | Info | See quality.md | quality |

## Plant evidence

- Developer's control PR #168 (closed): run 42852695987 fails exactly the 9 new tests with the dialogs as on `master`.
- reviewer-quality's control PRs #169 and #170 (closed unmerged): show the two untested paths above (QLT-02, QLT-03).
- Exchange rates tab and the DEF-020 guard untouched; their tests pass in run 42852617579.

## For master (G6)

Zero Blocker, Critical and Major. reviewer-quality recommends adding the QLT-01 to QLT-03 assertions in this PR (one or two each), or a tech-debt issue. AQP-244's base and head runs are finished (16:39 UTC), so the merge hold on this PR is lifted.
