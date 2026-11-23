# DEF-066: Part form: Qty or Cost typed within one save round trip of Fasteners is sent twice (`syncWatchers` sends it, then its own queued save sends it again); no wrong data

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313, Fasteners fields show only when needed), AC-2, AC-3 (the watchers of Fasteners are saved again when it changes). **No AC is shown to fail**: the stored and shown values are right; the fault is a redundant request |
| Severity | **Sev-4 Minor** (qa-engineer, 2026-11-23; test plan section 6: no effect on use) |
| Priority | P3. Lane: with DEF-065's fix if the developer takes it there (recommended); otherwise the backlog after G8. **Does not block G8** |
| Type | **Product** |
| Status | **Open** (logged 2026-11-23) |
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
| Fixed | developer | | |
| Regression test added (red on master first) | developer | | |
| Verified | qa-engineer | | |
