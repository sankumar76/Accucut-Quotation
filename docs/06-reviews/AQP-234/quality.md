# Review Report — AQP-234 (DEF-021) and AQP-235 (DEF-020), masters table actions and focus — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (narrow scope, master ruling DL-121). Round 1 is below; round 2 is at the end of this file |
| Base…branch | `master...fix/AQP-234-masters-table-actions` (PR #135; merge base dd7e2f4) |
| Commit reviewed | Round 1: 51c3092. Round 2: `51c3092..04bec3e` (a698239, 04bec3e) |
| Date | 2026-11-09 |
| **Verdict** | Round 2: **APPROVE WITH COMMENTS** (no open Blocker, Critical, Major or Minor findings). Round 1 was REQUEST CHANGES (2 Major) |

## Summary

The scope is the 10 files of PR #135 and the four questions of DL-121.

The shared `Table` change follows ux-spec v0.19 section 6.0 "Masters tables" item by item, and every table that does not pass `actionButtons` gets exactly the same class strings as before. CI is green on all three E2E shards, with no flaky test.

There are two Major findings:

- **QLT-01 (product).** The DEF-020 guard returns early whenever the list is in error. When the dialog itself held focus, nothing then takes it. This happens in two cases:
  - The list is already in error and the Admin opens **Add** (it is always shown) and then cancels.
  - On SCR-11, the "blocked" refusal's re-read fails while that dialog is open.

  In both cases focus ends on `<body>`. On master it went back to the Add button or the heading, so this is a regression.
- **QLT-02 (test).** The new spec checks only the *fit* (headings and names wrap, part 3). It never makes the table scroll, so the sticky guarantee (part 2) that DEF-021 rests on is not tested. If `sticky right-0` were removed, all 22 cases would most likely still pass. The spec's own "Tests" list names the two cases that would test it: the table forced to 1000 px, and the region scrolled to its end.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (QLT-01, QLT-02) |
| Minor | 2 (QLT-03, QLT-04) |
| Info | 5 (QLT-05 to QLT-09) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| PR CI | `gh pr checks 135` (run 42645248921, head 51c3092) | 5 of 5 green: Stages 1 to 11, 1 to 11b, E2E shards 1, 2 and 3 |
| E2E shard totals (CI logs) | `gh run view --job <id> --log` | shard 1: 195 passed, 24 skipped; shard 2: 195 passed, 24 skipped; shard 3: 201 passed, 17 skipped. **0 flaky, 0 failed** (with `retries: 1`, a timeout followed by a pass would show as flaky) |
| New spec in CI | as above | 22 of 22 desktop cases passed (1.5 to 3.1 s each); mobile and tablet skip as intended |
| `aqp-122-qa` DEF-020 test (now without `test.fail`) | as above | passed in mobile (3.2 s), tablet (4.2 s) and desktop (5.7 s) |
| `aqp-122-qa` "100 letters with no space" (the local axe timeout) | as above | passed **first try** in tablet (768 px, 5.5 s) and mobile (6.0 s); see QLT-07 |
| DEF-020 unit test | `vitest run tests/unit/process-opener.test.ts` (scratchpad worktree at 51c3092) | 1 file, 3 of 3 passed |
| E2E locally | not run | DL-121 and the brief: the machine is low on memory; CI results used instead |
| Other users of `Table` | `grep "from '@/components/ui/table'" src` | 5 users without the prop (audit, users, design-system colours and component map, the formula table in the delete-refusal dialog); see question 4 |

## Answers to the four DL-121 questions

### 1. Does the `Table` change implement ux-spec v0.19 section 6.0 "Masters tables"?

Yes, every item is implemented. The one gap is in the tests (QLT-02).

| Spec item (6.0) | Where | Result |
|-----------------|-------|--------|
| Last column is Actions, hidden text "Actions", buttons named for their row | `table.tsx:86-92`; `material-list.tsx:68,79`; `process-list.tsx:84,96` | Met. The names are unchanged (`Edit <name>`, and so on) |
| Sticky `right-0`, header cell and body cells | `table.tsx:83` (`STICKY_ACTIONS` on both) | Met |
| Opaque fill: body `--surface`, header `--surface-2` | `table.tsx:96` (`bg-surface`); the header inherits `bg-surface-2` from `TableHead` (`table.tsx:70`) | Met. Masters rows have no hover or selected fill, so there is nothing to repeat |
| Hairline drawn as an inset shadow, not a border | `table.tsx:83` `shadow-[inset_1px_0_0_var(--border)]`; `--border` is defined in `globals.css` | Met (see QLT-06 for a visual check) |
| `z-index: 1` inside an isolated region | `table.tsx:83` `z-(--z-sticky-cell)`, `globals.css:58` `--z-sticky-cell: 1`, `table.tsx:42` `isolate` | Met. The token follows the existing `z-(--z-bar)` pattern |
| Width its buttons need (68, 112, 156 px); buttons on one line | `table.tsx:10-14` sets `--actions-w` on the region; `w-` and `min-w-(--actions-w)` on the cells. The 36 px `icon-row` button is `--control-h-row: 36px`, the gap `gap-s-2` is 8 px and the padding `px-s-4` is 16 px each side, so 36 + 32 = 68 and 2×36 + 8 + 32 = 112. `flex-nowrap` at `material-list.tsx:80` and `process-list.tsx:63` | Met |
| Headings wrap | `table.tsx:44` `[&_th]:whitespace-normal`. Its specificity (0,1,1) beats `whitespace-nowrap` (0,1,0) in the same `utilities` layer | Met |
| Names wrap | Materials: both name cells already had `BREAK_LONG_NAMES` (`material-list.tsx:74-75`). Process: added at `process-list.tsx:90` | Met. The number cells have no space to break at and are not given `overflow-wrap` |
| Focusable named region with `scroll-padding-inline-end` equal to the Actions width | `table.tsx:37-42`: `role="region"`, `aria-label`, `tabIndex={0}` kept; `scroll-pe-(--actions-w)` | Met. Not tested (QLT-03) |
| No hidden column | No `hidden` or `hide-*` added | Met |

**Is every table that does not pass the prop really unchanged?** Yes. When `actionButtons` is `undefined`, `masters` is `false`:

- `cn('relative w-full overflow-x-auto', false)` gives the old string exactly.
- `cn('w-full border-collapse text-body', false, className)` gives the old string exactly.

`TableHead`, `TableCell` and `TableRow` are untouched, and the new token is used only by the new components.

### 2. Is the DEF-020 fix correct on every path? Could it leave focus nowhere?

I traced each path through Radix `FocusScope`. It calls the latest `onCloseAutoFocus` through a callback ref, in a `setTimeout` after the content has unmounted, so the handler reads the `list.status` of the latest render.

| Path | `list.status` when the dialog unmounts | Focus ends on | OK? |
|------|---------------------------------------|---------------|-----|
| Save or Add, re-read succeeds | `loading` or `ready` | the opener, from both the handler and the `useReadAgain` effect (unchanged) | Yes |
| Save, re-read fails **before** the exit animation ends | `error` | the error title (it took focus on mount, and the guard keeps it there) | Yes. This is the DEF-020 fix |
| Save, re-read fails **after** the exit animation ends | `loading` | the opener first, then the error title when it mounts | Yes (unchanged) |
| SCR-11 Delete, or a rename by Edit, re-read fails | `error` or `loading` | the error title, as in the two rows above; when the opener is gone the heading comes first, then the error title | Yes |
| SCR-11 rate gone (`onGone`), re-read fails | as above | the error title | Yes |
| **List already in error → Add → Cancel, Escape or ×** | `error` | **`<body>`**. The guard returns, the dialog that held focus is gone, and the error title never had focus during this dialog | **No (QLT-01)**. On master, focus went to the Add button |
| **SCR-11: Delete refused by a new formula use (`onBlocked`), its `readAgain(false)` fails while the "blocked" dialog is open, then the dialog closes** | `error` | **`<body>`**. The error title's focus-on-mount is pulled back into the trapped dialog | **No (QLT-01)** |

**Yes, it can leave focus nowhere.** The row "List already in error → Add → Cancel" is easy to reach: the Add button stays above the error state on both screens (`materials-panel.tsx:84`; `process-screen.tsx:110`, in the page header).

### 3. Are the tests adequate?

- **New e2e spec.** It covers both screens, all eleven widths and a 100-character name, and the horizontal check is real.
  - `boundingBox()` gives each button's layout box. Overflow clipping does not shrink it, so a button beyond the region's right edge fails `x + width <= right` (spec lines 95-100).
  - It does not test the sticky column (QLT-02).
  - It does not check that the region itself lies inside the viewport, and it has no Tab check (QLT-03).
  - "With the region not scrolled" (line 88) is always true just after `goto`, so on its own it shows nothing.
- **DEF-020 unit test.** It is deterministic and has meaningful assertions on the helper. However, the hook wiring on SCR-11 is not tested anywhere (QLT-04). The third case (`process-opener.test.ts:51`) also pins the behaviour that QLT-01 asks to change.
- **Removal of the `test.fail` markers.** This is correct. Both tests are now plain tests that pass in CI in every project, and their comments say what was fixed. The DEF-021 QA test still checks only the right edge of the first Edit button, at the project's width. That is fine, because the new spec carries the width matrix.

### 4. Regression risk to other users of `Table`

None found.

- **Users not changed by this PR** (`audit-list.tsx:63`, `users-list.tsx:119`, `colour-section.tsx`, `component-map-section.tsx`, `process-delete-dialogs.tsx:123`): none of them passes `actionButtons`, so their DOM and classes are identical (see question 1).
- **The material and process lists**, the only callers that changed: their cards (below 768 px) are unchanged. The `RowActions` card branch still uses `flex flex-wrap gap-s-2`.
- **Hazard for later callers:** see QLT-05.

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `src/components/features/masters/process-opener.ts:38` (and the callers `use-material-master.ts:125`, `use-process-master.ts:119`) | AQP-122 AC-8 / SCR-11 and SCR-13 focus rules; WCAG 2.4.3 | `if (listFailed) return;` assumes the load error already holds focus. It does not when the dialog held focus while the list was in error: (a) the list is in error, then Add, then Cancel, Escape or ×; (b) on SCR-11, the `onBlocked` re-read fails while the "blocked" dialog is open. In both, focus falls to `<body>` | A keyboard or screen-reader Admin loses their place and the next Tab starts at the top of the document. This is a regression: master returned focus to the Add button or the heading on these paths | Keep focus only where it already rests outside the dialog, otherwise fall through. A more explicit option is to focus the error title when `listFailed`. Snippet below. Test: a unit case "list failed and `document.activeElement` is `body` → focuses the opener", and an e2e "list in error → Add → Escape → Add button is focused" |
| QLT-02 | Major | `tests/e2e/masters-table-actions.spec.ts:84-101` | ux-spec 6.0 "Masters tables", part 2 and "Tests" bullets 2-3; DL-121 pass line | Every case loads the table at its natural width. With headings wrapping and both name columns at `overflow-wrap:anywhere`, the tables fit the region (by the spec's own figures, 565 and 602 px against the narrowest 710 px). The region therefore never scrolls and the sticky column is never exercised. The negative control removed *both* parts of the fix, so it cannot show that the sticky part works. Inferred from the code and the spec's numbers; not run in a browser | The guarantee DEF-021 depends on ("a table that still scrolls is allowed, because of part 2") has no test. Removing `sticky right-0`, `bg-surface` or `isolate`, or a later sixth column, would go unnoticed until QA | Add the two cases the spec lists: the table forced to `min-width: 1000px`, checked at `scrollLeft = 0` and at the far end. In the forced case, also assert that the region really scrolls (`scrollWidth > clientWidth`). Snippet below |
| QLT-03 | Minor | `tests/e2e/masters-table-actions.spec.ts:84-88` | ux-spec 6.0 part 4 and "Tests" bullet 5 | (a) The region's own box is never checked against the viewport, so an ancestor that clips (`overflow: hidden`) would hide a button that is "inside the region". (b) There is no keyboard check: Tab to the last row's Edit, which must not be under the column, and the page must not move sideways. As a result `scroll-pe-(--actions-w)` has no test | Small: both hold today by reading the code | `expect(right).toBeLessThanOrEqual(width);` and one Tab case in the forced-width mode of QLT-02 |
| QLT-04 | Minor | `src/components/features/masters/use-process-master.ts:119`; `tests/unit/process-opener.test.ts:51-58` | AQP-235 (DEF-020) on SCR-11 | The unit test covers only the helper's flag, and the e2e DEF-020 test covers only Materials. Removing `list.status === 'error'` from the SCR-11 hook would leave every test green. The PR states SCR-11 is fixed too, so it should be tested | A later edit can quietly reopen DEF-020 on Process master | Add a twin of the `aqp-122-qa` DEF-020 e2e to `process-master.spec.ts` (route `GET /api/v1/process-items` to 503 after the dialog opens, save, expect the error title focused). Update the unit case at line 51 together with QLT-01 |
| QLT-05 | Info | `src/components/ui/table.tsx:86-97` | design / coupling | `TableActionsHead` and `TableActionsCell` rely on the parent `Table` having `actionButtons`. Without it, `--actions-w` is undefined, so the width falls back to `auto` and there is no `isolate`. This fails silently. It is documented in the JSDoc | Only a risk for later callers (follow-up #134 Users, Treatment / Color, Customers) | Optional: a small React context from `Table` with a dev-time warning, or keep it as documented and let the QLT-02 forced-width test catch a missing prop |
| QLT-06 | Info | `src/components/ui/table.tsx:83` | ux-spec 6.0 part 2 (visual) | A positioned cell with a `z-index` paints over its half of a collapsed 1 px row border. The row separators may therefore thin out or disappear under the Actions column. Not verified | Cosmetic | QA to check at 1024 px with the table forced to scroll (the mode QLT-02 adds). If the lines break, add `shadow-[inset_1px_0_0_var(--border),inset_0_-1px_0_var(--border)]` to the body cell |
| QLT-07 | Info | `tests/e2e/aqp-122-qa.spec.ts:387-409` | test stability | Judgement on the local axe timeout (100-letter material, 768 px): **local noise, not a defect of this PR**. (1) It also timed out locally without the fix at the same data size. (2) The e2e suites create rows and never remove them, so a reused local database grows on every run (about 210 materials), and the cost of axe's `target-size` and `color-contrast` rules grows with the number of rows. (3) In CI, each shard has its own fresh database: the test passed **first try** in tablet (5.5 s) and mobile (6.0 s) against a 30 s timeout, and no shard reports a flaky test. A timeout followed by a pass on the retry (`retries: 1`) would have been reported as flaky | Gives no false confidence locally; CI is unaffected today | Already confirmed by run 42645248921. To measure headroom at volume, a one-off CI run could seed about 200 materials before shard 2 and compare the duration. Locally, recreate the throwaway database before a full run |
| QLT-08 | Info | PR #135 Dev Record | DoD (developer) | The baseline test run is blank. The "pre-existing" claims (the `playwright-system-deps` hook timeout and the axe timeout) rest on the developer's own re-runs. The CI run above covers the gap for this PR | Process only | Cross-reference reviewer-standards. Record the baseline next time |
| QLT-09 | Info | `table.tsx:5-14`, `globals.css:55-58` | praise | The width is a typed prop mapped to static class names (Tailwind finds them, and no type assertion is needed). The z-index is a token, not a literal. The unchanged tables keep byte-identical classes. The fix sits in the one shared helper, so SCR-11 is covered too. A negative-control run was done for the new spec | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01

**Current** (`process-opener.ts:37-42`)
```ts
export function focusOpener(opener: Opener | null, listFailed = false): void {
  if (listFailed) return;
  const button = opener === null ? null : findOpenerElement(opener);
  if (button === null) focusHeading();
  else button.focus();
}
```

**Suggested**
```ts
/** Is focus on a live element of the page (not lost to `<body>` because the dialog that held it has gone)? */
function focusIsOnPage(): boolean {
  const active = document.activeElement;
  return active !== null && active !== document.body;
}

export function focusOpener(opener: Opener | null, listFailed = false): void {
  // DEF-020: the load error took focus on mount; leave it there. If the dialog held focus (opened from the error
  // state, or the error mounted while the dialog trapped focus), nothing holds it now: fall through (QLT-01).
  if (listFailed && focusIsOnPage()) return;
  const button = opener === null ? null : findOpenerElement(opener);
  if (button === null) focusHeading();
  else button.focus();
}
```

An alternative is, when `listFailed`, to focus the error title itself, for example `main [data-load-error] :is(h2,h3)` with a data attribute on `ErrorState`. This is idempotent, and it sends focus to the title in case (b), which arguably matches "focus goes to the title" better.

**Unit case to add** (`process-opener.test.ts`): stub `document.activeElement = document.body` (the stub object itself), call `focusOpener(OPENER, true)` with the button present, and expect `button.focus` to have been called once.

### QLT-02

Add a mode loop inside the width loop of `masters-table-actions.spec.ts`:
```ts
for (const mode of ['natural', 'forced-start', 'forced-end'] as const) {
  // ...after the region is found:
  if (mode !== 'natural') {
    // The sticky column, not the fit, is what is tested (ux-spec 6.0 "Tests", bullet 3).
    await region.locator('table').evaluate((table) => { table.style.minWidth = '1000px'; });
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  }
  if (mode === 'forced-end') await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  // ...the existing per-button box checks, unchanged.
}
```

At widths of 1000 px and above, the 1000 px minimum may not make the region scroll. Use `Math.max(1000, regionWidth + 200)`, or skip the forced modes where `scrollWidth <= clientWidth` and say so in the title. To prove the test works, remove `sticky right-0` from `STICKY_ACTIONS` locally: the forced cases must fail.

</details>

## AC conformance

| AC / rule | Implemented in | Tested by | Result |
|-----------|----------------|-----------|--------|
| AQP-122 AC-7 / DEF-021: every row action visible without scrolling the table, 768 to 1440 px | `table.tsx` (`actionButtons`, `TableActionsHead`, `TableActionsCell`), `material-list.tsx`, `process-list.tsx`, `globals.css` | `masters-table-actions.spec.ts` (22 cases, CI green); `aqp-122-qa.spec.ts` DEF-021 test (CI green, 3 projects) | **Met at natural width.** The sticky guarantee is untested (QLT-02) |
| ux-spec 6.0 part 2: sticky, opaque, hairline, z-index 1, isolated, width | `table.tsx:42,83,96`, `globals.css:58` | none specific (QLT-02) | Implemented; test gap |
| ux-spec 6.0 part 3: headings and names wrap | `table.tsx:44`, `process-list.tsx:90`, `material-list.tsx:74-75` | new spec, 100-character name | Met |
| ux-spec 6.0 part 4: focusable named region, `scroll-padding-inline-end` | `table.tsx:37-42` | axe `scrollable-region-focusable` in the existing specs; no scroll-padding test (QLT-03) | Implemented |
| ux-spec 6.0 part 5: no column hidden | — | new spec (every row action found) | Met |
| AQP-122 AC-8 / DEF-020: focus on the load error title after a saved change whose re-read fails | `process-opener.ts:37-42`, `use-material-master.ts:125`, `use-process-master.ts:119` | `process-opener.test.ts` (3/3 local); `aqp-122-qa` DEF-020 e2e (CI green, 3 projects) | **Met for the defect's path. Regression on the cancel-from-error path (QLT-01). SCR-11 wiring untested (QLT-04)** |

## Issues for other roles

- **ux-expert:** ux-spec 6.0 "Build notes" gives the row-action wrapper as `gap-s-1` (4 px), but "Width" says the gap between buttons is 8 px and derives 112 and 156 px from it. The build uses `gap-s-2` (8 px), which matches the width rule. Align the build note.
- **qa-engineer:** visual check of QLT-06 when G7 runs.

## Previous findings

Not applicable in round 1 (first quality review of PR #135). See round 2 below.

---

## Round 2 — re-review of a698239 and 04bec3e

**Verdict: APPROVE WITH COMMENTS.** QLT-01 and QLT-02 are closed, and so are the two Minor findings, QLT-03 and QLT-04. The fix introduced nothing new above Info. Only the new diff `51c3092..04bec3e` was reviewed: 4 files, `process-opener.ts` and three test files.

| Severity | Open after round 2 |
|----------|--------------------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 7 (QLT-05 to QLT-09 from round 1; QLT-10 and QLT-11 new) |

### Checks run (round 2)

| Check | Command | Result |
|-------|---------|--------|
| PR CI on head 04bec3e | `gh pr checks 135` (run 42649224878) | 5 of 5 green |
| E2E shard totals (CI logs) | `gh run view --job <id> --log` | shard 1: 196 passed, 24 skipped; shard 2: 196 passed, 24 skipped; shard 3: 202 passed, 17 skipped. **0 failed, 0 flaky** |
| New spec, now with forced-scroll and Tab checks | as above | 22 of 22 desktop cases passed (SCR-11 4.6 to 5.6 s, SCR-13 1.6 to 2.8 s each) |
| New SCR-11 DEF-020 / QLT-01 e2e (`process-master.spec.ts:365`) | as above | passed in mobile (4.6 s), tablet (4.5 s) and desktop (6.5 s) |
| `aqp-122-qa` "100 letters with no space" | as above | passed first try in mobile, tablet and desktop (5.5 to 6.3 s) |
| Unit | `vitest run tests/unit/process-opener.test.ts` (scratchpad worktree at 04bec3e) | 5 of 5 passed |
| Fault plant for QLT-01 (scratchpad only, reverted) | restore `if (listFailed) return;` | **2 of 5 fail**, the two new QLT-01 cases, so the unit tests catch the regression |
| Fault plant for QLT-02 | developer's run, reported on the PR thread; not repeated (no local e2e) | with `sticky right-0` removed, the forced cases fail at 1024 px on both screens ("ends inside the region": expected ≤ 991, received 1221 on SCR-11 and 1265 on SCR-13) |
| E2E locally | not run | per the brief (machine low on memory) |

### Previous findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** (a698239) | `process-opener.ts`: the early return now needs `listFailed && focusIsOnPage()`. Paths re-traced: <ul><li>Save, then a failed re-read: the error title keeps focus.</li><li>Error state, then Add, then Cancel or Escape: focus is on `<body>`, so it falls through to the Add button.</li><li>SCR-11 blocked dialog whose re-read failed: it falls through. The row is not rendered in the error state, so focus goes to the page heading (QLT-10).</li></ul>No path leaves focus on `<body>`. The unit tests cover both cases where focus is on `<body>`, and the e2e covers Add then Escape on SCR-11 in 3 projects |
| QLT-02 | Major | **Fixed** (04bec3e) | Each width now runs four checks: as drawn; forced to `max(1000, region + 200)` px at its start, asserting `scrollWidth > clientWidth`; after a Tab; and at the far end, asserting `scrollLeft > 0`. The developer's negative control shows the forced-start check fails without `sticky right-0`, so the guarantee is now tested |
| QLT-03 | Minor | **Fixed** (04bec3e) | (a) `expectActionsInside` asserts the region lies within `0..viewport width`. (b) A Tab from the region lands on a row action, which stays inside the box, and the page does not scroll sideways. The developer notes this does not isolate `scroll-padding-inline-end` (QLT-11) |
| QLT-04 | Minor | **Fixed** (a698239) | The `process-master.spec.ts` twin routes `GET /api/v1/process-items` to 503, saves an Edit and expects the error title to be focused. Without the hook's `list.status === 'error'`, the handler would move focus to the heading after the error title took it, so this test now guards the SCR-11 wiring. The unit case that pinned the old behaviour was rewritten |
| QLT-05 to QLT-09 | Info | Open, as notes | No change needed. QLT-06 (row lines under the sticky column) remains a visual check for QA, which is easier now that the forced-scroll mode exists |

### New findings (round 2)

| ID | Severity | File:line | Issue | Impact | Suggested fix |
|----|----------|-----------|-------|--------|---------------|
| QLT-10 | Info | `src/components/features/masters/process-opener.ts:46-49` | In the SCR-11 case where the "blocked" dialog's re-read fails while it is open, focus now goes to the page heading `h1`. The opener's row is not rendered in the error state, so the existing "opener gone, use the heading" rule applies. It is not lost, but SCR-11 says that in the load error "focus goes to the title" | Small. This is a rare path (a formula starts using the rate and the list read fails at the same moment), and focus lands on a sensible, named place | Optional: when `listFailed` and focus is on `<body>`, focus the load error title before falling back to the heading. Leave it unless ux-expert wants the title |
| QLT-11 | Info | `tests/e2e/masters-table-actions.spec.ts:128-132` | The Tab check lands on the first row's first action, which is itself in the sticky column. It shows the action is reachable and visible, but it does not test `scroll-padding-inline-end` on its own. The developer said so on the thread | None today: these tables have no focusable control under the sticky column (the name cells are plain text, and "Used in" has no links) | When a masters table gains a link in a scrolled column (for example Customers), add a Tab-to-that-link check |

### Did the fix introduce anything new?

Nothing above Info.

- **`focusIsOnPage`** depends on the browser moving focus to `<body>` when the dialog content is removed. Chromium does this, and Radix calls the handler in a `setTimeout` after the unmount. The e2e confirms it in a real browser.
- **The inline `minWidth`** is set only inside the test, after hydration, on a `<table>` that React gives no `style` prop, so a re-render cannot undo it.
- **The test type** `(table, minWidth) => { table.style.minWidth = … }` needs no type assertion, and CI stages 1 to 11 (lint and type-check) are green.
- **Run time:** the new e2e cases add about 2 to 3 s each on SCR-11, which is acceptable.
