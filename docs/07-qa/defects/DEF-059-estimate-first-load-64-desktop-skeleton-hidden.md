# DEF-059: `estimate-first-load.spec.ts:64` [desktop] AC-4: the "Loading the form" skeleton is found but stays hidden for the 15 s expect (attempt 1 on two `master` pushes on 22 Nov; Product (layout), probable, DL-291)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.13 (AQP-339, Done; ADR-016 E1), AC-4: "the part form fetches its fields; while the fields are on their way the skeleton shows as a status, then the fields take its place". The failing step is the skeleton being visible (`:77`); the later steps (the form shows, the skeleton goes) are not reached on the failed attempt. AC-4 is not shown to regress: the retry passes, and the same case passes on attempt 1 at mobile and tablet |
| Severity | **Sev-3 Moderate, CONFIRMED by master (DL-291 (1))**: the rule of DL-285 (3) fired on the second occurrence. A loading state the UX spec requires is not painted at desktop widths, there is a workaround (the values arrive), and nothing is lost or exposed |
| Priority | P3. **Lane (DL-291 (3)(b)):** a separate PR, after DEF-058's fix PR (or the next lane that frees after #601 merges, whichever comes first), branched from a `master` that contains #601 (AQP-390) |
| Type | **Product (layout), probable** (master's DL-291 (1), from the code; not yet measured), with the test catching it only sometimes. **If the measurement shows a width over 0, the type stays Test, product not excluded, and the case comes back to master** |
| Status | **Closed** (logged 2026-11-22; type Product (layout) confirmed by the measurement; #613 squashed as `de4799ae`; P1 and P2 met; closed by QA 2026-11-22) |
| Jira / GitHub | [AQP-393](https://sankumar76.atlassian.net/browse/AQP-393) / [#603](https://github.com/sankumar76/Accucut-Quotation/issues/603). Jira "relates to" AQP-1 (Intake) and AQP-339 (STORY-05.13). Labels `ai-delivery`, `aiid-DEF-059`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium |
| Risk / rule | RISK-031: **not counted on trigger (b)**. (DL-291: not counted.) Each failed attempt is an `expect` that ran out on its own 15 s (the failed attempts ended at 26.2 s and 25.6 s, under the 30 s budget), which DL-264 (4)(d), DL-267 (3) and DL-285 (4) exclude. **No re-run rule** has been ordered; a red run on this case (both attempts) comes to master |
| Found by / date | CI. First occurrence read by master in DL-290 (4) as "not counted" with no further ruling; the second occurrence made this a Bug under DL-285 (3). Logged by qa-engineer, 2026-11-22 |
| Build / commit | `master` push 44975509844 (616d7e34), shard 4, job 137064401810; `master` push 44983705175 (0381fc5c), shard 4, job 137089551760 |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 4 of 4, project desktop, dev server, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The case (`tests/e2e/estimate-first-load.spec.ts:64-80`): installs a `ScriptGate`, signs in as a new Engineer, opens the Engineer's canary task, waits until `#estimate-customer` is hydrated, sets the gate to `slow` (each script held 3 s), chooses the customer, expects "Customer saved." (:76), expects the status named "Loading the form" to be visible (:77), expects the form within `SLOW_OPEN_WAIT_MILLISECONDS` (9 s, :78), then expects the skeleton to be gone (:79).

## Expected Result
After "Customer saved.", the skeleton status shows while the fields' code is held, then the form replaces it.

## Actual Result
Two attempt-1 failures on `master` push runs, 1 h 49 min apart, both [desktop], same line, same message, both passed on the retry:

| # | Run | Attempt 1 | Retry | Shard result |
|---|---|---|---|---|
| 1 | 44975509844 (616d7e34), 02:21Z | failed at **26.2 s** (test no. 5) | 9.5 s | `3 flaky, 510 passed (16.1m)`; the other flaky were `estimate-fasteners.spec.ts:207` and :234 [desktop] (master's DL-290 (4): own-expect form, not counted) |
| 2 | 44983705175 (0381fc5c), 04:10Z | failed at **25.6 s** (test no. 4) | 11.8 s | `1 flaky, 512 passed (16.7m)` |

```
Error: expect(locator).toBeVisible() failed
Locator: getByRole('status', { name: 'Loading the form' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - waiting for getByRole('status', { name: 'Loading the form' })
    7 to 8 x locator resolved to <div role="status" aria-label="Loading the form" class="flex flex-col gap-s-3">...</div>
      - unexpected value "hidden"
> 77 | await expect(page.getByRole('status', { name: 'Loading the form' })).toBeVisible();
```
Readings of the case at the other widths and on the next run: `master` push 44988681963 (45512bd4, 0 flaky): 8.9 s mobile, 16.4 s tablet, 13.2 s desktop, all attempt 1. Series read by QA: no failure of `:64` in the six `master` push runs of 21 Nov (44945571540, 44941416105, 44939278781, 44937075594, 44924430846, 44922163960, Stage 12 logs searched for the failed case), so 22 Nov 02:21Z is the first occurrence and 04:10Z the second.

**Readings of this case by title, added 2026-11-22 (qa-engineer, DL-291 request 3). Every one is attempt 1 and green; no "hidden" line and no failed attempt of the case in any of these runs.** Seconds, mobile / tablet / desktop: `master` push 44988681963 (45512bd4) 8.9 / 16.4 / 13.2 (above); `master` push 44990887665 (08394110, #600) 13.5 / 12.7 / 13.7; PR #599 run of record 44990897082 (95d882cc) 10.0 / 10.2 / 10.2; `master` push 44992801362 (6087e8b8) 9.3 / 10.6 / 8.4; `master` push 44995772811 (62ff83c4) 9.4 / 13.6 / 8.9. **Desktop "hidden" failures since the second occurrence (04:10Z): none** in the master pushes read (44988681963, 44990887665, 44992801362, 44995772811). The desktop readings sit at 8 to 14 s, so the case reaches :77 and passes; a pass does not clear the layout reading (closure rule).

## Evidence
Stage 12 shard 4 job logs of both runs (error blocks at the end of each log, `Error Context: test-results/estimate-first-load-AC-4-t-80eb5-n-the-fields-take-its-place-desktop/error-context.md`, which CI does not keep for the failed attempt); DL-285 (3) and DL-290 (4) in `docs/00-governance/decision-log.md`.

## Identified element and reading (master, DL-291 (1); code read, not a measurement)
- **Element:** the failing call log names `<div role="status" aria-label="Loading the form" class="flex flex-col gap-s-3">`. Of the two "Loading the form" statuses, that class list is only the **values-loading skeleton at `src/components/features/estimate-workspace/part-fields.tsx:124`** (inside `values.stored.status === 'loading'`; QA confirmed the markup on `origin/master` on 2026-11-22). The other, `part-form.tsx:68` (fields' code or form definition loading), carries `min-w-0 flex-1`.
- **Layout:** its parent is the `CardContent` at `estimate-workspace.tsx:176`, `flex flex-col gap-s-4 lg:flex-row`. From 1024 px (the desktop project is 1366 px) the parent is a row. An item with no grow whose children are only empty block `Skeleton` spans (a height, no width, no content) resolves to **0 px wide**, which Playwright reports as hidden. At 360 and 768 px the column layout stretches it to full width. That fits desktop-only failures and passes at mobile and tablet. The element stays in the accessibility tree.
- **Why the test catches it only sometimes:** the failure needs the `part-form.tsx` skeleton to be gone before :77 looks (the fields' code already in) and the stored-values read to stay pending for the whole 15 s. That read's length is not explained and is for the measurement. A desktop user sees an empty form area, not the skeleton, while a part's values load.
- **Measurement first (DL-291 (3)(b)(i)):** a red-first check that holds the part's stored-values read (`loadPartInputs`, by `page.route`, the way #601 holds `/form`), so the `part-fields.tsx` status is the one on screen; it asserts the status is visible at all three widths and attaches its bounding box; expected to fail at desktop only.

## What decides it (as first logged; superseded by the section above)
- **Test or runner (QA's working reading, not proven):** the status element is in the DOM but Playwright counts it as hidden (no box, or not painted) for the whole 15 s on a slow draw, while the held scripts delay the page. Nothing in the logs shows why; the retry passes within 12 s.
- **Product:** the skeleton in `src/components/features/estimate-workspace/part-form.tsx` (`FORM_LOADING`, `role="status"`) is hidden for the whole wait on some orderings (for example a re-suspended boundary or a zero-size container). A trace or `error-context.md` of attempt 1 would decide it. If the fix attempt shows this, a change under `src/` means stop and go to master.

## Suspected Area
`tests/e2e/estimate-first-load.spec.ts:64-80` and `tests/e2e/support/lazy-load.ts` (`ScriptGate`, slow mode); client: `src/components/features/estimate-workspace/part-fields.tsx:124` (the values-loading skeleton, `flex flex-col gap-s-3`, 0 px wide inside `lg:flex-row` at `estimate-workspace.tsx:176` from 1024 px), compare `part-form.tsx:68` (`min-w-0 flex-1`).

## Binding for the fix (DL-291 (3)(b); supersedes the first-logged text)
Separate PR, **not combined with DEF-058** (a different spec and type, a probable `src/` change, a dependency on #601; DEF-058's R11 (f) excludes `estimate-workspace/**`). It starts only after #601 (AQP-390, CR-01 item 6) has merged and branches from a `master` that contains it.
1. **Measure first**, from the PR's first commit: the red-first check above, at all three widths, expected to fail at desktop only.
2. **If confirmed**, the fix may change only the class list of the loading status at `part-fields.tsx:124`, giving it the same `min-w-0 flex-1` as `part-form.tsx:68`. No other `src/` file, no text, role or label change. This is not a section 9 item 2 area, so no combined review is needed while the change stays to that line and the tests. Anything wider comes to master.
3. The existing AC-4 case keeps every assertion. No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep.
4. **Proof:** the new check green at all three widths on attempt 1 on the PR run of record and on the first `master` push after the merge, each under 25 s; and the rewritten AC-4 case attempt-1 green at all three widths.

### Bind the case by title
#601 rewrites this case (drops the customer step, holds `/api/v1/estimates/*/form` for 3 s), so its line and `:77` move. The case is bound by file and title: `tests/e2e/estimate-first-load.spec.ts`, "AC-4: the part form fetches its fields" > "AC-4: while the fields are on their way the skeleton shows as a status, then the fields take its place" (the title stays; DL-257 (B)). `:64` in this file's name and text is the line on 616d7e34, 0381fc5c and 6087e8b8 only.

### Closure rule (DL-291 (2))
**DEF-059 does not close on #601, on a run of passes, or on a watch count.** #601 does not touch `part-fields.tsx`, so its rewritten case will probably stop catching the fault without fixing it. It closes only on the fix and its proof above, or on the measurement plus a master ruling (for example a width over 0, which returns the type to Test).

## Measurement, fix, proof and close-out (qa-engineer, 2026-11-22; DL-291 (3)(b), DL-296)
**Measured (PR #613 body, commit 1, 2c404e1a, run 45014618697, shard 4 job 137184153496):** the new case (it holds the stored-values read, `GET /api/v1/estimates/{id}/nodes/{id}`, by `page.route` so the `part-fields.tsx` status is on screen, attaches the status box and asserts width and visibility) failed at **desktop only**, attempt 1 and the retry, on its width assertion with the box `{"viewportWidth":1366,"box":{"x":609,"y":651,"width":0,"height":204}}`: **0 px wide at 1366 px**, as master read it from the code. Mobile (360 px) and tablet (768 px) passed. **Type confirmed: Product (layout).**

**Fix:** #613 (squashed as `de4799ae`): `min-w-0 flex-1` added to the class list of the loading status at `part-fields.tsx:124`, as at `part-form.tsx:68`; nothing else under `src/`; the existing AC-4 case unchanged; the new case in `estimate-first-load.spec.ts`. Not a section 9 item 2 area (DL-291 (3)(b)(iii)).

**Proof** (attempt 1, seconds, all passed, mobile / tablet / desktop; cases by title):

| Run | New case "AC-4: while the stored values of the part are on their way the skeleton has a width and shows as a status" (:75) | Existing "AC-4: while the fields are on their way the skeleton shows as a status, then the fields take its place" (:59) |
|---|---|---|
| **P1: PR #613 run of record 45020577093** (head 3128b5ff; `Stages 1 to 11` success; shards 543 / 539 / 537 / 523 passed, 0 flaky, 0 failed) | 7.6 / 7.2 / 5.7 | 8.6 / 11.0 / 8.4 |
| **P2: first `master` push after the squash, 45022375651** (de4799ae; `Stages 1 to 11` success, job 137212454425; shards `543 passed (16.1m)`, `537 passed (15.1m)`, `539 passed (13.6m)`, `523 passed (11.2m)`: **0 flaky, 0 failed**) | 7.1 / 5.9 / 5.1 | 8.5 / 7.4 / 8.1 |
| next `master` push 45025620716 (2ff31d2b; 0 flaky, 0 failed) | 4.4 / 9.6 / 5.4 | 8.1 / 9.5 / 8.6 |

An earlier PR run of the fixed head, 45016832555 (f70067fe): 7.3 / 6.5 / 4.8 and 10.3 / 7.7 / 6.8.
- **Met:** the new check green at all three widths on attempt 1 on the PR run of record and on the first `master` push after the merge, each under 25 s, and the rewritten AC-4 case attempt-1 green at all three widths. The closure rule (DL-291 (2)) is satisfied by the fix and its proof, not by a run of passes. **Desktop "hidden" failures of the case since the second occurrence (22 Nov 04:10Z): none** in any `master` push read.
- **DEF-063's question (DL-296 (4)):** the measured 0 px skeleton does not explain DEF-063 (the fasteners cases wait for `form[data-part-form]`, which is absent while any skeleton shows); DEF-063 was measured separately as a cold first compile (see its file).
- **Closed by QA 2026-11-22.** Jira AQP-393 Done; GitHub #603 closed.

## Re-run rule
None. Master may rule one. A red run on this case (both attempts) comes to master and is not re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-393, #603 |
| Measured | developer | 2026-11-22 | #613 commit 1 (2c404e1a), run 45014618697: red at desktop only, box width 0 |
| Fixed | developer | 2026-11-22 | #613, `fix/AQP-393-part-fields-skeleton-width`, squashed as `de4799ae`; class list at `part-fields.tsx:124` only |
| Regression test added | developer | 2026-11-22 | the new case in `estimate-first-load.spec.ts` (the skeleton has a width), plus the AC-4 case with every assertion kept |
| Verified | qa-engineer | 2026-11-22 | P1 (run 45020577093) and P2 (`master` push 45022375651): the new case and the AC-4 case attempt-1 green at all three widths, each under 25 s; closed on the fix and its proof (closure rule) |
