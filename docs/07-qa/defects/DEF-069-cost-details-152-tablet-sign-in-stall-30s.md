# DEF-069: `cost-details.spec.ts:152` [tablet] AC-8 (NFR-002): "Test timeout of 30000ms exceeded." on attempt 1, stalled at the Lead's sign-in after the Engineer checks had passed (second occurrence, 23 Nov; passed on retry; type Test, product not excluded)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.03 (the Lead's cost-details page), **AC-8 (NFR-002)**: "an Engineer gets nothing: the route is the fixed 403 and the page is "no access" with HTTP 403, before anything is read; the Engineer sees no button or link to either; a Lead gets the answer". **No AC is shown to fail**: the case ran out of its 30 s budget in a sign-in call, with no wrong value received |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23; the DL-285 (3) form: a watch on the first occurrence, a Bug on the second). A **verdict** failure of this case (a status other than 403 on the Engineer's route, or a cost value in a response) is **Sev-1** and is not this Bug |
| Priority | P3. Lane: hardening window; the developer owns the fix. Does not block G8 as a Sev-3 |
| Type | **Test, product not excluded** (cause not determined; the NFR-002 reading is below) |
| Status | **Open** (logged 2026-11-23) |
| Jira / GitHub | [AQP-411](https://sankumar76.atlassian.net/browse/AQP-411) / [#638](https://github.com/sankumar76/Accucut-Quotation/issues/638). Jira "relates to" AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-069`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium |
| Risk / rule | The trigger of the watch entry (test plan section 7, DL-285 line) is met, so this is a Bug and not a watch. **No re-run rule** (no rule covers this case); a red on both attempts comes to master. Not counted on RISK-031 trigger (b) (PR runs, not `master` pushes). W1 does not apply (it re-runs the failed jobs of a **red** run; both runs here are `success` with one flaky case). Whether a "wave" read is wanted for shard 2 of run 45103803921 is master's call: the facts for it are below. DEF-064 (the Mailpit race) is a different Bug, opened the same day |
| Found by / date | CI (two PR runs); logged by qa-engineer, 2026-11-23 (UTC; the evening of 22 Nov local) |
| Build / commit | PR #633 run 45103803921 on head 84052624 (second occurrence); PR #625 run 45095519672 on head dfef7969 (first) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 2 of 4 (project tablet, 768 px), 4 workers, 30 s test timeout, one retry, `trace: 'on-first-retry'` (the run has no uploaded artifacts); invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local E2E, CLAUDE.md section 9 item 5). The case (`tests/e2e/cost-details.spec.ts` :152-:190, read at `master` d2771045): `engineerWithEstimate`; `calculateAsEngineer` (sign-in without the page, a goto, a Calculate); the Engineer's own page (:156); the forbidden route as the owner (`refused`, :160); the page `/estimates/<code>/costs/1` (:168); a second Engineer signs in (:175), the same page (:176) and the route (`foreign`, :177); **`signInAsLead` (:180)**; the Lead's answer (:181); `clearCookies` and the signed-out 401 (:188).

## Expected Result
The case passes in about 19 s on this shard's tablet readings (18.5 to 19.0 s on `master` push 45095489201; 20.9 s on the retry here).

## Actual Result
Attempt 1 stopped at the 30 s budget: `Test timeout of 30000ms exceeded.` followed by `Error: apiResponse.json: Response has been disposed` at `tests/e2e/support/auth.ts:628` (`const { csrfToken } = (await token.json())`, in `signInWithoutThePage`), called from `signInAs` (calculated-estimate.ts:35), `signInAsLead` (:65), cost-details.spec.ts:180. The "disposed" text is the test teardown of a body read that was still waiting.

## Evidence
Two occurrences, both Stage 12 shard 2, [tablet], attempt 1, bare 30 s time-out, passed on retry:

| # | Run | Job | Attempt 1 | Where it stood | Retry | Shard result |
|---|-----|-----|-----------|----------------|-------|--------------|
| 1 | PR #625 (AQP-405), run 45095519672, head dfef7969 (23 Nov 01:46Z) | 137434475534 | no. 304, 30.2 s | `page.evaluate` :177 (the forbidden route as the other Engineer) | 24.2 s | `2 flaky, 540 passed (21.6m)`; the same run's :100 [tablet] also timed out (30.3 s) |
| 2 | PR #633 (AQP-407), run **45103803921**, head 84052624, attempt 1, `success` (23 Nov 03:14:52Z) | **137460556380** | no. 304, 30.2 s | `auth.ts:628`, the Lead's CSRF body read, spec :180 | #1 passed, 20.9 s (03:15:16Z) | `1 flaky, 7 skipped, 541 passed (21.0m)`; shards 1, 4, 3: 13.3, 15.1, 15.4 min |

QA read the log of job 137460556380 (`gh run view 45103803921 --job 137460556380 --log`): one `✘` and one `(retry #1)` in the whole run, both this case; the run has no artifacts. No wave was ruled for the run.

**The same minute on the same shard (tablet, attempt 1, same file, four workers):** :67 13.9 s, :47 15.5 s, :78 15.3 s, :110 7.3 s, :89 19.6 s, **:100 27.8 s (passed)**, **:123 29.5 s (passed)**, :194 22.5 s, :240 7.0 s, and this case 30.2 s (failed). Typical readings of the same cases are 18.5 to 19.0 s (:100, :152) on `master` push 45095489201. So two other cases of the file finished within 0.5 and 2.2 s of the 30 s line in the window in which :152 did not: this reads as a slow window of the shard, not as a fault of one case. (QA read the durations from the log; the DL-267 count of "three passing readings of 25 s or more" and the W1 (d) per-test median are **not** computed here: master decides what the window counts as.)

**What #633 did not change:** its three files are `src/components/features/estimate-workspace/use-part-form.ts`, `tests/support/part-server.ts` and `tests/unit/use-part-values.test.ts` (`gh pr view 633 --json files`). Nothing in them is reachable from this case.

## NFR-002 reading (this case is an NFR-002 case, section 9 item 2)
- **No verdict failure.** Nothing was received that is not a 403, and no cost value was received. The Engineer part of the case ran to its end before the stall: the assertions at :157 to :178 (the Engineer's own page 200 with no "View cost details", the route's fixed 403 body with no `state|details|stages|formula|working|Material-Scrap-Rate` word, the page's 403 and "no access", the second Engineer's 403 on the page and on the route) sit before :180 and a failure of any of them would have reported its own message instead of the time-out. What did **not** run on attempt 1 is the Lead's half: the 200 with `details.stages` (:181-:186) and the signed-out 401 (:188). The retry ran all of it and passed.
- **The stall was at the Lead's sign-in, not on a cost route.** The statement running when the budget ended is `await token.json()` of `GET /api/auth/csrf` at auth.ts:628; the line before it (`expect(token.ok())`, :627) had passed, so the response head had arrived and its body had not been read. That is the sign-in of the Lead, after the Engineer checks.
- **Was the Engineer-forbidden route call itself slow? Not determinable from the log.** The log holds the start and end of the test only (the `✘` line at 03:14:52.05Z with 30.2 s, so the case began about 03:14:21.8Z), no per-step time; the trace is taken on the first retry (which passed) and no artifact was uploaded. What the log does say: that call, and the page check, were complete before :180, and the case as a whole is not shown to have waited on them. On the first occurrence the call that stood was the other Engineer's `fetch` of the route (:177); on this one it was a later call. Two occurrences at two different statements, in the same case, on the same shard, fit a slow window better than one slow route.
- **What would change the reading:** a time-out whose standing call is the forbidden route (the `refused` or `foreign` fetch) with the server's own log showing the route waiting; a status other than 403; any cost value. Any of the last two is a Sev-1 and is raised to master at once.

## Suspected Area (optional)
Shard 2 of a PR run, tablet project, the `cost-details` file's cases running together on four workers against one development server (every case of the file signs in two or three times without the page, `signInWithoutThePage`, and makes a Calculate). The two occurrences were both PR runs, in the same shard; the latest `master` push (45095489201) ran the same cases in 18.5 to 19.0 s. Cause not determined. **Later reading (same day):** the `master` push run 45110218895 on d2771045 (the #633 squash, the same cases) ran the file with no `✘` and no retry in any shard: `:100` at 21.9 / 18.0 / 23.5 s and `:152` at 21.5 / 20.7 / 25.7 s [mobile / tablet / desktop], shard 2 `542 passed (14.8m)` against 21.0 min on the PR run. So the long shard 2 of run 45103803921 was not repeated on the same code a few minutes later on `master`.

## Fix route (developer; test-only; observation first)
1. Observation, as for DEF-068 (DL-308 H1 standard): on a failure of this case print which of its steps was standing and for how long (a timing mark after each call: the Calculate, `refused`, the page, `foreign`, each `signInAs`), so the next occurrence names the standing call and a slow route is told from a slow sign-in. No timing constant is raised and no `test.setTimeout` is added without master's ruling.
2. Then the fix the observation points to (for example the case's three sign-ins and two page loads, which are a quarter of its budget on a loaded runner; or the file's concurrency).
3. Proof: attempt-1 pass of `:152` (and `:100`, `:123`) at three widths on the fix PR run and the first `master` push.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## For master
- Opened on the stated trigger. `:100` of the same watch entry passed on attempt 1 in run 45103803921 (27.8 s) but is the second case of that entry: master to say whether `:100` stays on the watch list on its own count or joins this Bug.
- Whether the slow window of shard 2 in run 45103803921 is a wave under W1 (a PR run, the run is green, so W1 does not authorise a re-run).
- Not a decision of QA: no gate, no rule changed.
