# Review Report — AQP-245 (STORY-10.21), Users list (SCR-14) masters-table pattern — Quality, round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (re-review on the narrow route, DL-147 (5); new diff only) |
| Base…branch | merged `master` b710741 … `fix/AQP-245-users-table-actions` (PR #222). `master` is now 6b1883f (#291, tests only, does not touch either file) |
| Commit reviewed | d59e8ea, the merge commit (parents c9c8de7, the round-2 fix commit, and b710741) |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** (0 Blocker, 0 Critical, 0 Major). The PR review is [5870559816](https://github.com/sankumar76/Accucut-Quotation/pull/222#pullrequestreview-5870559816), submitted as COMMENT because REVIEW_IDENTITY is single-token. Label `review:quality-approved` (it replaces `review:quality-changes-requested`) |

## Summary

**The round is what DL-147 asked for.**
- **Condition A** is one test-only commit, c9c8de7.
- **Condition B** is one merge commit, d59e8ea, with a hand resolution of the spec and one semantic line in `users-list.tsx`.

**All four plants are red, each at the assertion it was written to prove:**
- P-WRAP is red at the fit.
- P-GAP is red at the gap.
- P-TAB is red in the Tab loop.
- P-PROP (the #224 form) is red at the scroll padding.

**All of #195's changes are kept.** #222's generic checks run on Treatment and pass there.

**Two cosmetic points remain, plus one judgement call:**
- a missing space that the resolution introduced (QLT-09, Minor);
- the spec is 412 lines, over the 400-line standard, with no inline justification (QLT-10, Info);
- Treatment's stricter `firstAction`, which I judge sound (QLT-11, Info).

None of these needs another round.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (QLT-09) |
| Info | 2 (QLT-10, QLT-11) |

## Scope and the master condition

| Check | Command | Result |
|-------|---------|--------|
| Route scope (the PR against merged `master`) | `git diff --stat b710741 d59e8ea` | 2 files: `src/components/features/users/users-list.tsx`, `tests/e2e/masters-table-actions.spec.ts`. The narrow route holds |
| Files the merge resolved | `git show --cc --name-only d59e8ea` | The same 2 files |
| Files the fix commit touched | `git diff --stat 72d92e9 c9c8de7` | Only the spec. No `src/` change in condition A |
| **Master's condition on `users-list.tsx`** | `git show --cc d59e8ea` | **Holds.** The only resolution (`++`) line in this file is `import { BREAK_LONG_NAMES } from '../masters/master-texts';`. Every other line in the hunk comes from one parent. `git diff c9c8de7 d59e8ea -- users-list.tsx` is that one line. `master-texts.ts:12` holds the value `process-texts.ts:11` held, `'[overflow-wrap:anywhere]'`. No other `src/` change |
| #195 kept | `git diff b710741 d59e8ea -- <spec>`; diff of the tail from `test.describe('SCR-13 Treatment` | The Treatment / Color entry (lines 116 to 130). The `open` hook (lines 126 to 129) and its call `await screen.open?.(page)` (line 300). The `./support/treatments` import (line 8). The header text from #195. The end-of-file SCR-13 "(e)" block, **byte-identical** to b710741. The STD-15 names: the masters titles are unchanged, and only the Users titles gain the `AC-…:` prefix. The `rename` pattern is now Treatment's `firstAction: /^rename$/` (QLT-11) |
| #222's checks on every screen, Treatment included | read | QLT-01 fit at line 311 (`scrollWidth - clientWidth`, `toBeLessThanOrEqual(0)`, no tolerance). QLT-03 gap at line 313, through `expectActionGaps` at line 244 (`toBeCloseTo(8, 0)`, which is a difference below 0.5 px). Both are outside `if (screen.users)`, so they run on SCR-11, SCR-13 Materials, SCR-13 Treatment and SCR-14 |
| QLT-02 Tab loop | read, lines 248 to 278 | Runs on the long-name row. Asserts 3 buttons and 3 enabled. Edit, Reset password and Deactivate are reached in order, each with the four checks: focused, `data-action`, `:focus-visible`, and not covered (`elementFromPoint`), plus inside the region |
| QLT-04 rules | read | Fillers are made only to reach six, inside `make` (lines 141 to 145). There is no shared `beforeAll`. The own row's DOM checks run as drawn only. The own row's buttons stay in `expectActionsInside` at all four points. axe runs at 768, 1024 and 1366 px. 12 instances |
| Did the round touch `expectThreeButtonColumn`? | `git diff 72d92e9 c9c8de7`, function block | **Yes: the docblock and the width assertion's message only** (the QLT-03 relabel). The operands are unchanged: `toBeCloseTo(156, 0)`, `scrollPaddingInlineEnd === '156px'`, headings `white-space: normal`. DL-147 (5) says to re-run the #224 form if the round touches the function, so I re-ran it as P-PROP. It is red |

## Checks Run

| Check | Source | Result |
|-------|--------|--------|
| PR CI on the head | run 43169604615, jobs API and shard logs read by me. It ran on merge ref a5794a7 = d59e8ea + 8f07c17 (docs only) | 5 of 5 green: `Stages 1 to 11b`, shards 1 to 3, `Stages 1 to 11`; 06:39:02Z to 06:43:44Z |
| Vitest | verify job 131019457601 | 3,185 / 3,185 and 5,557 / 5,557. These equal push run 43166263631 on 8f07c17 |
| E2E | shard summaries | Passed 272 + 270 + 257 = **799 = 787 + 12**. Skipped 3 + 4 + 17 = 24. 0 failed, 0 `✘` lines. All 11 SCR-14 width cases and the AC-4 card case pass. All 11 SCR-13 Treatment cases pass |
| Per-case means, shard 3 | `list` reporter lines | SCR-14 width cases (11) **3.01 s**, against 5.13 s in round 1. SCR-11 width cases (11) **2.07 s**, against 2.40 s. I recomputed both from the log |
| Full test name list (811) | Developer's Dev Record | Not recomputed by me. The counts above agree with it |
| Lint, type-check, build | CI `Stages 1 to 11b` green | Not run locally (no `npm ci`, as the brief says) |

## Plants (DL-147 (5))

Each plant is d59e8ea + 1 commit. Each was applied by `plant.mjs`, which writes nothing unless every anchor occurs exactly once in its file; line ends follow the file. Each diff was printed before the push. All four are draft PRs to `master`, closed unmerged after their result was read, with the branches kept (`control/AQP-245-r2-wrap`, `-gap`, `-tab`, `-prop`).

| Plant | Diff | PR / run | Result (failed list read from the logs) |
|-------|------|----------|------------------------------------------|
| **P-WRAP** | In `users-list.tsx`, `cn('font-semibold text-ink', BREAK_LONG_NAMES)` becomes `cn('font-semibold text-ink')`; in `process-list.tsx`, the same change. Both `BREAK_LONG_NAMES` imports are removed so lint passes | #310 / 43172313584 (4e15c5c) | **RED.** Shard 3 (job 131028271729): 22 failed, 17 skipped, 242 passed. The 22 are the 11 SCR-11 Process master width cases and the 11 SCR-14 Users width cases, every one at `as drawn: the table needs no scrolling (the fit)`. Shard 2 (job 131028271757): 7 QA G7-1 SCR-11 cases (`aqp-234-qa.spec.ts:146`) failed at "the table needs no scroll". Shard 1 green. **No width passed**, so there is no `scrollWidth` / `clientWidth` pair to post |
| **P-GAP** | `gap-s-2` becomes `gap-s-1` on the compact action wrapper | #311 / 43172326922 (8d6f117) | **RED.** Shard 3 (job 131028315925): 11 failed, the 11 SCR-14 width cases, all at `as drawn: the gap before action 1 is 8 px (gap-s-2)` (expected 8, received 4). Nothing else failed |
| **P-TAB** | `{...(compact ? { tabIndex: -1 } : {})}` on the compact Deactivate (toggle) button | #312 / 43172342852 (f83b399) | **RED.** Shard 3 (job 131028368856): 11 failed, the 11 SCR-14 width cases, all at `forced to scroll, tabbing the long-name row: Tab 3 reaches deactivate` (expected focused, received inactive). Nothing else failed |
| **P-PROP** (the #224 form) | `actionButtons={3}` removed from the Users `Table` | #313 / 43172353984 (e2133db) | **RED.** Shard 3 (job 131028404216): 11 failed, the 11 SCR-14 width cases, all at `as drawn: the region keeps focus clear of the Actions column` (`156px` expected, `auto` received). Nothing else failed |

<details><summary>P-WRAP received values (scrollWidth - clientWidth, as drawn)</summary>

| Width (px) | SCR-11 | SCR-14 |
|---|---|---|
| 768 | 772 | 1097 |
| 900 | 640 | 965 |
| 1000 | 540 | 865 |
| 1023 | 517 | 843 |
| 1024 | 780 | 1106 |
| 1180 | 624 | 950 |
| 1257 | 547 | 873 |
| 1279 | 525 | 851 |
| 1280 | 524 | 850 |
| 1366 | 438 | 764 |
| 1440 | 364 | 690 |

</details>

## AC conformance

The product code is unchanged since round 1, apart from the import path. This table records what round 2 changed in the tests.

| AC | Implemented in | Tested by (head d59e8ea) | Result |
|----|----------------|--------------------------|--------|
| AC-1 actions visible at eleven widths | `users-list.tsx:121` (`actionButtons={3}`), `TableActionsHead`, `TableActionsCell` | 11 SCR-14 cases, 4 modes each, with at least 6 rows of 3 buttons and a 120-character name. **The fit as drawn** (P-WRAP red) | **Met** |
| AC-2 the pattern | `users-list.tsx` lines 80, 121, 128, 134, 142 | The prop: scroll padding and wrapping headings (P-PROP red). **The 8 px gap** (P-GAP red). **The name wraps**, through the fit (P-WRAP red). The 156 px width is relabelled to what it proves | **Met and guarded** (round 1: two items were not guarded) |
| AC-3 own row | `RowActions`, unchanged | `expectOwnRowIntact` as drawn (order, disabled, exact names, inside, in sequence). Inside the region at the forced points through `expectActionsInside`. `users.spec.ts` is unchanged | **Met** |
| AC-4 cards at 360 px | `md:hidden` list, unchanged | The AC-4 card test, unchanged since round 1 | **Met** |
| AC-5 keyboard and axe | `Table` `scroll-pe`, through the prop | Step 3, then **a Tab through all 3 enabled buttons of the long-name row** (P-TAB red). axe at 768, 1024 and 1366 px | **Met** (round 1: met for one button) |
| AC-6 nothing else moves | — | 799 = 787 + 12, skipped equal, no test dropped, skipped or slowed. The masters titles are unchanged. The default `firstAction` for SCR-11 and SCR-13 Materials is back to round 1's `/^(edit|delete)$/` | **Met** |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-09 | Minor | `tests/e2e/masters-table-actions.spec.ts:304` | Coding standards (formatting); cross-reference reviewer-standards | `const row =page.locator(…)`: a missing space. It is a `++` line in `git show --cc`, so the hand resolution introduced it; c9c8de7:283 had it right | Cosmetic only. No formatter runs in `npm run lint`, so CI cannot catch it | `const row = page.locator(…)` at the next commit that touches the file (#225 or #119). It does not need its own round |
| QLT-10 | Info | `tests/e2e/masters-table-actions.spec.ts` (412 lines) | Coding standards §1 (files ≤ 400 lines, justify exceptions inline); cross-reference reviewer-standards | Over the limit by 12 lines, with the reason only in the PR Dev Record. The file was 366 lines at c9c8de7; #195's Treatment entry and "(e)" test tipped it over. Four other E2E specs are already over 400 (`aqp-234-qa` 522, `aqp-122-qa` 500, `exchange-rates` 421, `process-master` 419) | None on correctness. Splitting now would change reviewed content and void the plant evidence | At the next touch, add a one-line justification at the top of the file, or move the AC-4 card test to its own file |
| QLT-11 | Info | `tests/e2e/masters-table-actions.spec.ts:121-124` | DL-147 (4)(b) | Judgement on Treatment's `firstAction: /^rename$/`: **sound.** It is stricter than #195's `/^(edit|rename|delete)$/`, and the first Tab stop is deterministic: `treatment-list.tsx:102` renders no buttons for the locked "Other" row, and other rows render Rename (line 76) before Delete (line 79). All 11 cases are green, mean 2.06 s. `rowSelector` and `nameLength` repeat the defaults explicitly, which records DL-147 (4)(b) | None | None |

## Issues for other roles

- **qa-engineer (G7, DL-147 (6)):** I have run P-WRAP, P-GAP, P-TAB and the #224 form here, and QA does not repeat them. QA's own control (`TableActionsCell` replaced by `TableCell`) is still to run.
- **qa-engineer and master (QLT-06):** this is unchanged. #137 step 1 (deleting G7-1) waits until #222 has merged. P-WRAP shows that G7-1 and the new fit check now catch the same loss on SCR-11.
- **developer (QLT-07, QLT-09, QLT-10):** at #225, fix line 304, and justify the file length or split the file.
- **delivery lead:** four control branches `control/AQP-245-r2-*` are on the remote (PRs #310 to #313 are closed), alongside the earlier `plant/AQP-245-*` branches. Deleting them is for a human (DL-146 (5) pattern).

## Previous Findings (re-review)

| ID | Round-1 severity | Status | Evidence |
|----|------------------|--------|----------|
| QLT-01 | Major | **Fixed** | Line 311; P-WRAP #310 red: 22 cases plus 7 G7-1 cases |
| QLT-02 | Minor | **Fixed** | `expectTabThroughRow`; P-TAB #312 red: 11 cases |
| QLT-03 | Minor | **Fixed** | `expectActionGaps`, width check relabelled; P-GAP #311 red: 11 cases |
| QLT-04 | Minor | **Fixed** | SCR-14 3.01 s (was 5.13 s), SCR-11 2.07 s (was 2.40 s); fillers up to six inside each test; own-row DOM checks as drawn only |
| QLT-05 | Info | **Settled** | #195 merged first (ffc280b); the merge resolution was verified above |
| QLT-06 | Info | Open (qa-engineer, master) | #137 step 1 waits for #222's merge (DL-147 (8)) |
| QLT-07 | Info | Open (#225) | The import now names `master-texts` |
| QLT-08 | Info | Noted | — |

Thread replies on PR #222: 4547427302 (QLT-01), 4547427556 (QLT-02), 4547427750 (QLT-03), 4547428057 (QLT-04), 4547428285 (QLT-07).
