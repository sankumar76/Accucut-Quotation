# DEF-129: tree toolbar cases fail on a pointer interception: `estimate-tree-names.spec.ts:52` and `estimate-tree.spec.ts:1065` [desktop] time out at 30 s on `master` push 3ece5e47 and pass on retry (Test; product not excluded until the hand check is read; Sev-3; lane 2; Jira AQP-486, GitHub #793)

| Field | Value |
|-------|-------|
| Story / AC | AQP-448 (DEF-091, #741: the row toolbar shows only for the hovered, keyboard-focused or selected row; ux ruling of 26 Nov 2026, item 3, checks TB-1 to TB-6) and AQP-446 / AQP-447 (DEF-089, DEF-090, #756: tree rows show their name and kind). The cases: `estimate-tree-names.spec.ts:52` 'NAME-1 to NAME-4, KIND-1: rows show their kind and their name; a new row is named through its Description ...' and `estimate-tree.spec.ts:1065` 'AQP-406 AC-1: a drag to the place after the last sibling moves the row down ...'. **No AC is shown to fail:** both passed on retry, and no wrong value was received. |
| Severity | **Sev-3 Moderate (master, DL-426 (B)); QA filed it on master's DL-426 and the orchestrator's relay.** **Provisional Sev-2, type Product, the same day, if lane 2's hand check or the ux-expert's re-check fails** (see 'Binding'). |
| Priority | P3 (Jira Medium; labels `sev-3`, `final-review`). It does not stop merges (DL-426 (3)). |
| Type | **Test; product not excluded** (master, DL-426 (B)): the log points at the test's order of actions, but the ux ruling's pointer checks have not been read on the merged build. |
| Status | **Open (new), 2026-11-26.** Owner: **lane 2** (#741's author; the toolbar and `estimate-tree.spec.ts` are lane 2's, DL-410 (1)). **Lane 2's hand check PASSED on `master` `744a8fa5` (reported by lane 2 and relayed by the orchestrator, 2026-11-26; QA did not run or observe it; the probe was a throwaway script, not committed).** Setup: dev server, Chromium at 1366x768 with a fine pointer, a 5-row tree, pointer moved in 3 px steps. (a) Slow movement down five rows: one toolbar at a time in the order 1, 1.1, 1.2, 1.3, 1.4, with no flicker and no row coming back; the same going back up. (b) Pointer moved down onto a row's own toolbar line: the toolbar was kept until the pointer went below it, then the next row took over. So the product is not at fault on lane 2's reading, and tree PRs do not hold; DEF-129 stays a Sev-3 test defect (the pointer is aimed at the 1-px clipped toolbar point over the next row). **Still due: the ux-expert's re-check of the same behaviour, in the one pass before the freeze (DL-423 (3));** if it fails, DEF-129 becomes a provisional Sev-2 Product the same day. |
| Jira / GitHub | [AQP-486](https://sankumar76.atlassian.net/browse/AQP-486) / [#793](https://github.com/sankumar76/Accucut-Quotation/issues/793) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-129, agent-qa-engineer). Relates to AQP-448, AQP-446, AQP-447, AQP-426, DEF-085, AQP-1. Searched first: JQL on `aiid-DEF-129`, 'DEF-129' and 'pointer interception': nothing. |
| Found by / date | CI (a `master` push); read by qa-engineer, 2026-11-26; classified by master (DL-426) |
| Build / commit | `master` `3ece5e47` (#788, AQP-456 / DEF-099: the delete-dialog and empty-Draft words; it does not touch the tree). The toolbar is `bffde135` (#741); the names are `3cb43a1e` (#756). |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 4 of 4)`, job 139910812062, Playwright Chromium, project `desktop`, production build, 4 workers. CI run 45820387977 (`push`, created 12:31:07Z). Shard 4 draw **1.03** over 387 tests against 31015cce (quartiles 0.93 to 1.15): a normal draw. |

## Steps to Reproduce
Not on demand; no local run (CLAUDE.md section 9 (5)).
1. Run Stage 12 on `master` or a PR; read shard 4, `[desktop]`, the two cases.
2. Look for attempt 1 ending `Test timeout of 30000ms exceeded.` after a `locator.click` or `locator.hover` on a toolbar button whose call log shows `... intercepts pointer events` and `retrying click action`.

## Expected Result
A toolbar button is pressed or hovered once the toolbar is in view, with no retry on an interception, in well under 25 s (the cases read 10 to 17 s on their retries and on other pushes).

## Actual Result
| # | Case | Attempt 1 | Call log (target and what took the pointer) | Retry |
|---|------|-----------|---------------------------------------------|-------|
| 1 | `estimate-tree-names.spec.ts:52` [desktop], no. 100 | **30.5 s** (12:38:52Z) `locator.click: Test timeout of 30000ms exceeded.` | target `getByRole('navigation', { name: 'Parts tree' }).getByRole('button', { name: /^Add under 1\.1 / })`; the click point is taken first by a row link `<a href="#estimate-form-area-title" data-part-id=...>`, then by a row's branch-arrow `<span data-branch-arrow="none">`; 'retrying click action' until the budget | passed |
| 2 | `estimate-tree.spec.ts:1065` [desktop], no. 123 | **30.3 s** (12:40:39Z) `locator.hover: Test timeout of 30000ms exceeded.` | target `/^Move 1\.1 /` (the move handle); the point is taken by a kind-icon `<path>` of another `<li data-part-row>`, then by a branch-arrow span; 'retrying hover action', 'waiting 20ms' | passed |

Shard 4 has 18 'intercepts pointer events' lines; shard 1 (same run) has none.

## Evidence (job log, ANSI stripped; no secrets or personal data)
- **Mechanism, master (DL-426 (3)).** While the toolbar is clipped to 1 px, Playwright aims at the button's point, which lies over the next row; that row takes the pointer and its own hover, so the toolbar the test wants never opens, and the click retries until the budget runs out. A person cannot aim at a toolbar they cannot see: they hover the row, the toolbar line opens under it, and they move down onto it. So the mechanism is the test's order of actions, made timing-dependent by the row shift the design accepts.
- **Not DEF-085.** Neither failure shows `waiting for locator('form[data-part-form]')`; DEF-085's 4 misses on this push are `estimate-form-choice.spec.ts` :88, :109, :126 and `estimate-form-sections.spec.ts:64` (QA's grep of the whole CI log: that signature appears only under those four, three times each). DL-425 (4) counted `estimate-tree-names:52` among them; DL-426 (A) corrects it.
- **Not part of this defect:** `estimate-tree.spec.ts:790` [mobile] (shard 1, no. 354, 29.4 s, passed on retry): `expect(getByRole('alertdialog', { name: /^Delete 1\.1 .+\?$/ })).toContainText(...)` ran out on its own 15 s after Enter (spec :890), `element(s) not found`; no pointer interception in shard 1. A watch (a second attempt-1 failure of it on any run is a Bug the same day), test plan 0.3.76.
- **Product evidence (partly outstanding):** lane 2's hand check passed on `744a8fa5` (Status above); the ux-expert's re-check is still due. The ux ruling's checks ('moving the pointer slowly down five rows shows one toolbar at a time with no flicker'; 'from a row down onto its toolbar, the toolbar stays') were not run by QA, which ran no browser.

## Suspected Area (leads, not findings; the fix is lane 2's)
`tests/e2e/estimate-tree.spec.ts` and `tests/e2e/estimate-tree-names.spec.ts` (every case that presses or hovers a toolbar button with a mouse on desktop), the row toolbar of #741 (`row-actions.tsx`, `HIDDEN_UNTIL_NEEDED`; the clip and the row shift), and a shared desktop helper.

## Binding and proof (master, DL-426 (3); QA reads it)
1. **Fix, test-first and test-only, unless the hand check finds a product fault:** a desktop helper that hovers the row, waits for the toolbar to be in view, then acts on the button; used by every tree test that presses a toolbar button with a mouse; no new wait on time, no budget change, no retry, skip or quarantine; every assertion kept. A new case after `users.spec.ts` is refused (DL-388 (D)); the person ledger stays +0 (DL-422).
2. **Hand check (due):** lane 2 runs the ux ruling's two pointer checks by hand on the merged build and states the result in the PR body; the ux-expert repeats them in their re-check pass (DL-423 (3)). **If either fails** (the toolbar flickers between rows, or moving down onto it closes it), **DEF-129 becomes a provisional Sev-2, type Product, the same day; it comes to master and tree PRs hold until it is fixed.**
3. **Proof:** 0 pointer-interception retries on toolbar actions, and every affected case attempt 1 under 25 s, on the fix PR's run of record and the first two `master` pushes after the squash. QA reads each from the job logs, with durations and shard minutes.
4. It does not stop merges now: both failures passed on retry and no wrong value was received.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-426 (B) |
| Hand check (lane 2) | developer (lane 2) | 2026-11-26 | PASSED on `744a8fa5`, as reported (a) slow movement down five rows and back, (b) down onto the row's own toolbar line; a throwaway probe, not committed |
| Hand check (re-check pass) | ux-expert | | |
| Cause found / fix | developer (lane 2) | | |
| Regression test | developer (lane 2) | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-486 and GitHub issue #793, created 2026-11-26 and cross-linked. Related: DEF-085, DEF-088, DEF-091 (AQP-448, #741), DEF-089 and DEF-090 (#756), RISK-031; DL-426 (master's ruling), DL-425, DL-423 (3), DL-410 (1), DL-388 (D), DL-422; test plan 0.3.76; CI run 45820387977, shard 4 job 139910812062.
