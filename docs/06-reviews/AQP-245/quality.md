# Review Report — AQP-245 (STORY-10.21), Users list (SCR-14) masters-table pattern — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (narrow route, DL-122 (1), as set in the story's Dev Context) |
| Base…branch | `master...fix/AQP-245-users-table-actions` (PR #222; merge base 1d37902; `master` is now 225a1c9, which does not touch either file) |
| Commit reviewed | 72d92e9 (85e9d61 test first, fbfb968 fix, 72d92e9 stronger assertions) |
| Date | 2026-11-11 |
| **Verdict** | **REQUEST CHANGES** (1 Major). The PR review is [5855399377](https://github.com/sankumar76/Accucut-Quotation/pull/222#pullrequestreview-5855399377), submitted as COMMENT because REVIEW_IDENTITY is single-token; label `review:quality-changes-requested` |

## Summary

The product change is correct. It is small, and it matches the SCR-11 and SCR-13 pattern line for line:

- `actionButtons={3}`
- `TableActionsHead` and `TableActionsCell`
- the wrapper `flex flex-nowrap items-center justify-end gap-s-2`
- `BREAK_LONG_NAMES` on the name cell

The own row, the accessible names and the card list are unchanged.

**The scope condition of the narrow route holds.** There are two files, `users-list.tsx` and the E2E spec. There is no data path, no `src/` outside the Users components, no config, no `package.json` and no CI workflow change.

**The findings are about the tests.** I ran two plants on throwaway PRs and **both survived**:

- **P-WRAP:** the name cell without `BREAK_LONG_NAMES`.
- **P-GAP:** the wrapper at `gap-s-1`.

The spec's step 1 says it checks the fit (ux-spec 6.0 part 3) but asserts only `scrollLeft === 0`, which is always true on load. Since the sticky column exists, the position checks cannot see an overflowing table either (QLT-01, Major).

**The Tab-through only ever reaches one button.** The first row is always the Admin's own row, where two of the three buttons are disabled (QLT-02).

**The 156 px width assertion catches nothing on its own**, and the 8 px gap is not tested (QLT-03).

**The cost per SCR-14 case is about 2.1 times SCR-11's.** About a third of the extra time is the axe scans that AC-5 requires; the rest can be trimmed (QLT-04).

**Good practice:** the developer caught that the first plant (#223) survived, said so in the PR, and strengthened the test until #224 failed.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-01) |
| Minor | 3 (QLT-02, QLT-03, QLT-04) |
| Info | 4 (QLT-05 to QLT-08) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Scope | `git diff --stat origin/master...pr222` | 2 files: `src/components/features/users/users-list.tsx` (+9 / −9), `tests/e2e/masters-table-actions.spec.ts` (+209 / −25) |
| Drift | `git diff --name-only 1d37902 225a1c9` | `master` moved by #216 (AQP-273); neither file is touched |
| PR CI (developer) | `gh run view 42978577848` | 5 of 5 green. Shard 3: all 12 SCR-14 cases passed |
| Guard unit tests | `vitest run tests/unit/own-width-files.test.ts tests/unit/one-width-tag.test.ts` at 72d92e9 (local, Windows) | 2 files, 18 tests passed |
| Per-test durations | shard-3 `list` reporter lines (test strategy 10.5 item 8) of runs 42978577848, 42980084449 and 42980091871 | SCR-11 mean 2.40 / 1.55 / 2.67 s; SCR-13 2.02 / 1.33 / 2.15 s; SCR-14 5.13 / 3.13 / 5.29 s (QLT-04) |
| Plant **P-GAP** (reviewer) | #226, 72d92e9 + 1 commit, diff below | CI 42980084449: **green 5 of 5**. Shard 3 (job 130388224283): 219 passed, 17 skipped, 0 failed; all 12 SCR-14 cases passed. **Not caught** |
| Plant **P-WRAP** (reviewer) | #227, 72d92e9 + 1 commit, diff below | CI 42980091871: **green 5 of 5**. Shard 3 (job 130388246510): 219 passed, 17 skipped, 0 failed; all 12 SCR-14 cases passed. **Not caught** |
| Plant clean-up | `gh pr close --delete-branch` | #226 and #227 closed unmerged; both branches deleted |
| Full unit suite, lint, type-check, build, E2E | not run locally | CI stages 1 to 11b and 12 on 72d92e9 are green; the developer reports 0 lint and 0 type errors locally. I have no local browser suite |

**Plant diffs (printed before the result, DL-091):**

P-GAP (#226):
```diff
-    <div className={compact ? 'flex flex-nowrap items-center justify-end gap-s-2' : 'flex flex-wrap gap-s-2'}>
+    <div className={compact ? 'flex flex-nowrap items-center justify-end gap-s-1' : 'flex flex-wrap gap-s-2'}>
```

P-WRAP (#227). The import is removed only so the build and lint do not fail on an unused name:
```diff
-import { BREAK_LONG_NAMES } from '../masters/process-texts';
...
-                <TableCell className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{user.name}</TableCell>
+                <TableCell className="font-semibold text-ink">{user.name}</TableCell>
```

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 actions visible at eleven widths | `users-list.tsx` 121 (`actionButtons={3}`), 128 (`TableActionsHead`), 142 (`TableActionsCell`) | 11 SCR-14 cases in four modes: as drawn, forced start, after Tab, forced end. Each has at least 6 rows with 3 buttons each and a 120-character name. Red on 85e9d61 (42959350855: `action 0 ends inside the region`, 1748.6 against ≤ 743), green on 72d92e9 | **Met** |
| AC-2 the pattern | Code read: all five items present | Prop: `scrollPaddingInlineEnd` and headings `white-space: normal` (plant #224 red). **Gap: not tested** (P-GAP green, QLT-03). **Name wraps: not tested** (P-WRAP green, QLT-01) | **Met in code; two items not guarded** |
| AC-3 own row and disabled buttons | `RowActions` unchanged; `OWN_PASSWORD_NAME`, `OWN_ACCOUNT_NAME` | `expectOwnRowIntact` at three points: three buttons in order; Edit enabled; Reset password and Deactivate disabled with their exact accessible names, written as literals so they are independent of the source constants; inside the region; each after the one before. `users.spec.ts` is unchanged and green in CI | **Met** |
| AC-4 card layout at 360 px unchanged | `md:hidden` list not touched | Card test: table region hidden; no page overflow; at least 6 cards; every button inside 360 px; no icon-only button; the own card's buttons have their text and two are disabled | **Met** |
| AC-5 keyboard and focus | `Table` `scroll-pe-(--actions-w)`, reached through the prop | Step 3 and `expectTabThroughFirstRow`: the focused button matches `:focus-visible`, is the element at its own centre (`elementFromPoint`) and is inside the region. axe (`expectNoAxeViolations`) runs on the forced table at 768, 1024 and 1366 px. **Only the own row's Edit is ever focused** (QLT-02) | **Met for one button** |
| AC-6 nothing else moves | — | No `skip`, no `fail`, no timeout change, no test removed. The SCR-11 and SCR-13 bounds are unchanged (`boundingBox` per button → one `getBoundingClientRect` call; same `>=` and `<=` bounds; same `/^(edit|delete)$/`). The 12 instances are stated, and none is `@one-width` | **Met** (cost: QLT-04) |

### Is the computed-style assertion a sound proof?

- **The AC-1 position checks cannot see a missing prop.** The `sticky right-0` classes belong to `TableActionsHead` and `TableActionsCell`, not to the prop. The prop sets only `--actions-w`, `isolate`, `scroll-pe` and wrapping `th`. The developer's plant #223 confirms it.
- **`scrollPaddingInlineEnd === '156px'` is sound and not brittle.**
  - It reads the resolved value of the custom property that the prop sets.
  - It runs only in Chromium, on the desktop project.
  - It pins the spec's own number (ux-spec 6.0 Width), which changes only if the spec does.
  - It catches a missing prop (`auto`) and a wrong count (`actionButtons={2}` gives `112px`).
- **Headings `white-space: normal`** also catches a missing prop, because a plain `TableHead` is `whitespace-nowrap`.
- **The 156 px width check catches nothing on its own** (QLT-03).

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `tests/e2e/masters-table-actions.spec.ts:250-251` | AC-2 ("headings and the name wrap"); ux-spec 6.0 part 3 (the fit); DL-121 pass line "visible without table scroll" | Step 1 claims the fit but asserts only `scrollLeft === 0`, which is always true on load. With the sticky column, the position checks cannot see an overflowing table either. P-WRAP survived | A lost wrap class leaves CI green while Admins at 768 to 1024 px must scroll the table to read names. The same gap reaches SCR-11 and SCR-13 once #137 deletes QA's G7-1, which is the only `scrollWidth <= clientWidth` check today (`aqp-234-qa.spec.ts:158`) | Assert `scrollWidth - clientWidth <= 0` as drawn, for every screen; re-plant P-WRAP red |
| QLT-02 | Minor | `tests/e2e/masters-table-actions.spec.ts:206-224` (208) | AC-5 | The first row is always the E2E Admin's own row: the ordering in `user-repository.ts:217` puts the only active `ADMIN` first, and `ADMIN` is first in the enum. So `enabled` is 1, and the loop re-tests the Edit button that step 3 already checked. The docblock and the PR's AC table claim a Tab through the row | AC-5 is met for one button. An enabled Reset password or Deactivate never gets keyboard focus; Deactivate is nearest the region edge | Tab through the long-name row, whose three buttons are enabled, or assert `enabled === 3` |
| QLT-03 | Minor | `tests/e2e/masters-table-actions.spec.ts:168-176` (171); `users-list.tsx:80` | AC-2 (`gap-s-2`); DL-122 condition B | The gap is not tested. The 156 px width check reads 156 with the prop at 3, 2, 1 or absent, because nowrap content plus padding is 156, and the prop pins it at 156 even at a 4 px gap. P-GAP survived | A copy back to `gap-s-1`, the exact regression condition B was raised for, stays green | In `expectOwnRowIntact`, assert `button.left - previous.right` is close to 8 (the edges are already read); re-plant P-GAP red. Optionally drop or relabel the width check |
| QLT-04 | Minor | `tests/e2e/masters-table-actions.spec.ts:104-108`, 256, 269, 288 | AC-6; RISK-023; test strategy 10.5 | An SCR-14 case takes about 2.1 times as long as an SCR-11 case in all three runs. About 10 s of each run is axe at 3 widths, which AC-5 requires. The other roughly 20 s: 2 filler `POST /users` per case (argon2id, 64 MiB, 3 passes; 22 extra hashes per run); own-row DOM checks (order, disabled, names) repeated at forced start and end; the Tab loop repeating step 3 | About 5 s of extra shard-3 path per run at 4 workers, every PR, with no extra proof | Make fillers only while the list has fewer than 6 rows, or once per worker; keep the DOM part of `expectOwnRowIntact` for "as drawn" only; QLT-02's fix removes the repeat |
| QLT-05 | Info | `tests/e2e/masters-table-actions.spec.ts` (whole file) | DL-121 (6), DL-123 (d), DL-141 (4c) merge conditions | #195 (AQP-130) edits the same docblock, the `Screen` interface, the tail of `SCREENS`, the Tab regex and the end of the file. #222's new required `Screen` fields would also break #195's Treatment entry at type-check | Whichever PR merges second needs a real conflict resolution in its own file, so it goes back to master | Orchestrator and master: set the merge order now; the second PR rebases its spec change deliberately and re-runs CI |
| QLT-06 | Info | `tests/e2e/aqp-234-qa.spec.ts:140-170` (GitHub #137 step 1) | test strategy G12 rule; DL-123 (a) | #137 deletes G7-1 as a duplicate, but G7-1 holds the only fit assertion for SCR-11 and SCR-13 | Deleting it before QLT-01 is fixed leaves the fit of every masters table unguarded | qa-engineer and master: do #137 step 1 only after QLT-01 is merged, or keep the fit line |
| QLT-07 | Info | `src/components/features/users/users-list.tsx:15`, `:80` | Coding standards, module boundaries | First import from `features/masters` into `features/users`; follow-up #225 is open. `flex-nowrap` is the flex default; it is kept for AC-2 and SCR-11 parity | None now | Keep #225 |
| QLT-08 | Info | — | DL-091 | Good practice: own plant run and reported when it survived; test strengthened until #224 failed; one-call `edgesOf`; literal accessible names | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01

**Current** (line 250)
```ts
// 1. As drawn (part 3, the fit): the headings and names wrap, so the table needs no scrolling.
expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
```
**Suggested**
```ts
// 1. As drawn (part 3, the fit): the headings and names wrap, so the table needs no scrolling.
expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
expect(await region.evaluate((element) => element.scrollWidth - element.clientWidth), 'as drawn: the table needs no scrolling (the fit)').toBeLessThanOrEqual(0);
```
Both values are integers in Chromium, so the bound needs no tolerance. QA's G7-1 has used the same bound at seven widths since AQP-234. If an SCR-11 or SCR-13 width fails, report it as a fit defect; do not loosen the check.

### QLT-02

**Suggested**
```ts
const row = page.locator(`${screen.rowSelector}:visible`).filter({ hasText: name }); // three enabled buttons
const buttons = row.locator('button[data-action]');
await expect(buttons).toHaveCount(3);
await buttons.first().focus();
for (let index = 0; index < 3; index += 1) {
  if (index > 0) await page.keyboard.press('Tab');
  // the same four checks as today
}
```
This means passing `name` to the helper.

### QLT-03

**Suggested** (in `expectOwnRowIntact`; the edges are already read)
```ts
if (index > 0) expect(button.left - (edges[index - 1]?.right ?? 0), `${mode}: own-row gap ${index} is 8 px (gap-s-2)`).toBeCloseTo(8, 0);
```

### QLT-04 (where the time goes, head run 42978577848)

| Group | Cases | Mean |
|---|---|---|
| SCR-11 | 11 | 2.40 s |
| SCR-13 | 11 | 2.02 s |
| SCR-14 non-axe (900, 1000, 1023, 1180, 1257, 1279, 1280, 1440) | 8 | 4.2 s |
| SCR-14 axe (768 / 1024 / 1366) | 3 | 5.1 / 7.9 / 9.7 s |
| SCR-14 card at 360 px | 1 | 3.8 s |

The other two runs show the same ratio, about 2.0 to 2.1 times SCR-11, on faster and slower hosts.

</details>

## Issues for other roles

- **orchestrator and master (QLT-05):** set the merge order of #222 and #195 before either is updated from `master`.
- **qa-engineer and master (QLT-06):** #137 step 1 must not remove QA's G7-1 fit assertion before QLT-01 is merged.
- **developer:** the developer's plant branches `plant/AQP-245-no-action-buttons` and `plant/AQP-245-no-action-buttons-2` were still on the remote when this review started (the PRs #223 and #224 are closed). Delete them, or note why they are kept.
- **QA at G7:** re-plant P-WRAP and P-GAP on the fix head; both must be red.

## Previous Findings (re-review only)

Not applicable (round 1).
