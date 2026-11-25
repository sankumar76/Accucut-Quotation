# DEF-066: Part form: Qty or Cost typed within one save round trip of Fasteners is sent twice (`syncWatchers` sends it, then its own queued save sends it again); no wrong data

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313, Fasteners fields show only when needed), AC-2, AC-3 (the watchers of Fasteners are saved again when it changes). **No AC is shown to fail**: the stored and shown values are right; the fault is a redundant request |
| Severity | **Sev-4 Minor** (qa-engineer, 2026-11-23; test plan section 6: no effect on use) |
| Priority | P3. Lane: with DEF-065's fix if the developer takes it there (recommended); otherwise the backlog after G8. **Does not block G8** |
| Type | **Product** |
| Status | **Verified and Closed 2026-11-23** (fixed inside PR #633, `master` d2771045, commit e9ec27c1 of the PR; see "Verification 2026-11-23"). Logged 2026-11-23 |
| Jira / GitHub | [AQP-408](https://sankumar76.atlassian.net/browse/AQP-408) / [#634](https://github.com/sankumar76/Accucut-Quotation/issues/634). Jira "relates to" AQP-313, AQP-341 (DEF-038), AQP-407 (DEF-065) and AQP-1. Labels `ai-delivery`, `aiid-DEF-066`, `sev-4`, `final-review`, `agent-qa-engineer`; priority Low |
| Risk / rule | Same family as RISK-035 (a compare with a stale `heldRef`, at a different site). DEF-064 stays reserved for the Mailpit race (DL-305) |
| Found by / date | qa-engineer, 2026-11-23, classifying DEF-038 (DL-321) on PR #632's run 45097669695 |
| Build / commit | `master` 444d10b7 (the same on PR #633 head 43b6366f) |
| Environment | Hook level (Vitest, Node), `tests/support/hook-harness.ts` and `tests/support/part-server.ts`; invented data only |

## Steps to Reproduce
1. Open `usePartValues` over three fields as in `tests/unit/fasteners-none-requests.test.ts`: S text, default "None"; T and U numbers (2 decimals) that watch S.
2. Hold the next save (`partServer.holdNextSave()`).
3. `setText('s','M6 bolt')`, `commit(S)`; then, with no waiting, `setText('t','5')`, `commit(T)`, `setText('u','3.5')`, `commit(U)`.
4. Release the held save, `await gate.settle()`, read `partServer.sent`.

In the browser it is the same order of events: the test (or a quick typist) types Qty right after Fasteners' answer arrives and before the page has handled it.

## Expected Result
One request per field changed: S, T, U (the same text is not queued twice, `queueSave`'s own rule).

## Actual Result
`[{rev 1, s "M6 bolt"}, {rev 2, t "5.00"}, {rev 3, u "3.50"}, {rev 4, t "5.00"}, {rev 4, u "3.50"}]`: T and U are sent a second time, unchanged, at revision 4; the server revision does not move and the stored values are right (`{s:'M6 bolt', t:'5.00', u:'3.50'}`).

## Evidence
- Hook-level run on a throwaway file (moved out of the worktree, never committed), `master` 444d10b7 and a copy of `use-part-form.ts` from `origin/pr-633` (43b6366f): the same five requests on both; the assertion "exactly one request carries t, and one carries u" failed on both (`expected 2 to be 1`).
- CI: PR #632 run 45097669695, shard 1 job 137441009977, `estimate-fasteners.spec.ts:151` [mobile], attempt 1 save list: S rev 1 (+900 ms), T rev 2 (+1905), U rev 3 (+3258), **T rev 4 (+3640), U rev 4 (+4073)**, S "None" rev 4 (+4299). The same shape as the hook run. Attempt 2: S rev 1, T rev 2, **T rev 3 (unchanged)**, U rev 3, S "None" rev 4 (T was typed before the sync ran, U after it).

## Suspected Area
`use-part-form.ts` `syncWatchers` (:363-380): it compares the watcher's typed text with `heldRef` (:376) and calls `send()` directly (:377), outside `queueSave`'s `onItsWayRef` check (:329). `commit(T)` queues the same text behind the sync that is running, because `onItsWayRef` was never set for the sync's own send. #633's description says `syncWatchers` was left alone because "every earlier save is answered and `heldRef` is current when it compares"; that holds for saves queued before the sync, not for text typed and queued after it was queued, which is the case here.

## Fix route (developer)
Send the watcher through the same dedupe as `queueSave` (compare with the value on its way before the held one, as `settledValue` does in #633), and skip a watcher whose typed text is already on its way. Recommended in #633 (same hook, same combined review, DL-319 (5)); a Sev-4 does not gate G8 and may go to the backlog after G8.

## Proof needed
1. A test in `tests/unit/use-part-values.test.ts` of the steps above: exactly one request carries `t` and one carries `u`; **fails on `master` before the fix** (shown red on the base commit or in a commit-1 red run).
2. `fasteners-none-requests.test.ts` (four requests, one per field left) and the `estimate-autosave*` tests unchanged and green; CI green.
3. QA reruns the new test and the regression around it, then closes.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-22 | PR #633 squash `d2771045` (`syncWatchers` compares with `settledValue` and sends as a ticketed on-its-way save) |
| Regression test added (red on master first) | developer | 2026-11-22 | `use-part-values.test.ts` describe "AQP-408: Fasteners and its watchers within one save round trip" (three DEF-066 tests); red on `444d10b7`'s hook and on `43b6366f`'s, green on `d2771045` |
| Verified | qa-engineer | 2026-11-23 | see "Verification 2026-11-23" |

## Verification 2026-11-23 (qa-engineer; `master` d2771045 = PR #633 squash; run of record 45103803921)
Method: QA reran the tests on a clean `git archive` copy of `master` d2771045 in the session scratchpad (project `node_modules` linked; Vitest 5.1.0 from that link; nothing committed, no worktree written). See DEF-065's verification section for the commands and the copy's limits.

| Proof (this file's "Proof needed") | Evidence | Result |
|---|---|---|
| 1. A test of the steps above: exactly one request carries `t` and one carries `u`; fails on `master` before the fix | The describe "AQP-408: Fasteners and its watchers within one save round trip": "DEF-066: Qty and Cost typed and left right after Fasteners are sent once each, not a second time by their own saves" (QA's steps: S, then T and U typed within S's round trip), "Qty left while the save that follows Fasteners is on its way is not sent again" and "a Qty typed since the one a queued save carries is sent, and the earlier one is not sent after it". At `d2771045` all pass (`use-part-values` 34 of 34). The same three **fail** with the hook at `444d10b7` (the base) and at `43b6366f` (the head before the DEF-066 commit): the base run is `16 failed \| 21 passed (37)` with the three among the 16; the `43b6366f` run is `7 failed \| 27 passed (34)` with the three among the 7 | **Pass** |
| QLT-09 of the combined review (on the base the same shape could store **stale** data: Qty `5` left, then `6` typed while the sync was queued, the server held `5.00`, the screen `6`) | The third test above is that shape; it passes at `d2771045` (the server ends with `6.00`) and fails at `444d10b7` and `43b6366f`. QA's own hook run of 2026-11-23 had found only the repeat (no wrong data); the stale-data shape is the review's and is now covered | **Pass** (note: "no wrong data" in the Actual Result held only for the steps as written; the base could also store a stale value, as QLT-09 says) |
| 2. `fasteners-none-requests` (four requests, one per field left) and the `estimate-autosave*` tests unchanged and green; CI green | Local at `d2771045`: the 9 related files `Test Files 9 passed (9)`, `Tests 117 passed (117)`, `fasteners-none-requests` green. CI run of record 45103803921: all 6 jobs success, `Stages 1 to 11b` unit `10603 passed`, integration `16220 passed`; `estimate-fasteners.spec.ts:151` attempt-1 `✓` at mobile, tablet and desktop | **Pass** |
| A watcher shown again after Fasteners goes back to "None" is still re-sent when nothing is on its way (review check 5) | Reviewer's probe Q1 on `febca143` (the PR head before the merge of master; the hook file is the same as `d2771045`'s) and the DEF-065 "Fasteners cleared" tests, which pass at `d2771045`; `fasteners-none-requests` green | Pass (as read; QA did not re-run Q1) |

**Result: verified. DEF-066 is closed.** It was fixed inside #633 (the route this file recommended), so it did not wait for the backlog after G8.
