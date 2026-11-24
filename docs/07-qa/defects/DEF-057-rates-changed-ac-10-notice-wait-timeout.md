# DEF-057 (Sev-2 from 2026-11-22): `rates-changed.spec.ts:135` [tablet] AC-10: after Recalculate the "Rates changed" notice is still there when the 15 s wait ends and the 30 s budget cuts the test (second occurrence)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.11 (AQP-328) AC-10 (an unlocked Draft with current figures: the notice shows, its link reaches a Recalculate button, pressing it calculates again, the notice goes and the estimate is Submitted); related STORY-06.04 (AQP-321) |
| Severity | **Sev-3 Moderate from 2026-11-24 (master DL-356 (A): re-graded from Sev-2 on the code reading N1; off the G8 blocking list; reopen trigger below).** Earlier: **Sev-2 Major, from 2026-11-22 (master's DL-294 (1); was Sev-3).** DL-280's trigger is met as written on the diagnostic's own server reads: the server had cleared the rates-changed state (costs view `state: "current"`, `ratesChanged: null`, stored estimate SUBMITTED with 2 calculations) while the screen kept the notice and the busy Recalculate button to the end of the wait (a stale notice can mislead a Lead before approving). **Blocks G8**: fixed in the hardening window and not waived without the delivery lead's word (CLAUDE.md section 9 item 3) |
| Priority | **P3 from 2026-11-24 (Jira Medium, label `sev-3`; not a G8 blocker).** Earlier: **P2.** Takes the next lane that frees, ahead of every Sev-3 and Minor (so ahead of DEF-059); does not displace the DEF-060 fix, the #605 and #601 updates, or the DEF-061 developer's lane. Under the merge freeze (DL-293 (1b)) it does not squash before the DEF-060 fix. A fix under `src/` gets the combined security-and-quality review of section 9 item 2 |
| Type | **Test, product excluded on the code reading (DL-356 (A)); residual kept by the reopen trigger.** Earlier: **Open**; product not excluded. The cause step comes first: a `src/` cause is a Product fix, a shared-data cause is Test and comes back to master for re-grade, host load alone comes back to master with no change (DL-294 (1) ruling 1b) |
| Status | **Open, Sev-3, not blocking (DL-356 (A), 2026-11-24); the #612 observer stays until G8; listed at G8 under "open, not blocking" with master's written acceptance unless it has closed.** Earlier: **Open, Sev-2** (logged 2026-11-21; re-graded 2026-11-22, DL-294; route set by DL-295: observation first, time-box 2026-11-26) |
| Jira / GitHub | [AQP-387](https://sankumar76.atlassian.net/browse/AQP-387) (priority High from 2026-11-22) / [#585](https://github.com/sankumar76/Accucut-Quotation/issues/585) (label `sev-2`, no longer `sev-3`). Jira "relates to" AQP-328. PR [#612](https://github.com/sankumar76/Accucut-Quotation/pull/612) (matcher fix and observer; "Refs #585"). See also DEF-048 (AQP-377, the over-25 s list on which this case already stood), RISK-031 and RISK-033 (re-scored to 9 by DL-295 (6)) |
| Found by / date | qa-engineer, 2026-11-21, on the trigger of master's DL-257 (E): a second occurrence of any of `estimate-save.spec.ts:107`, `rates-changed.spec.ts:135`, `unlock.spec.ts:186` on any run means a Bug the same day; none of the three may be re-run under any R-rule |
| Build / commit | PR #571 head `a11abdf1` (run 44902999104); first occurrence PR head `2f5b8511` (run 44577408149, branch `fix/AQP-377-estimate-e2e-timeouts`) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 3, project tablet, dev server, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The test (`tests/e2e/rates-changed.spec.ts:135-158`): makes a calculated estimate through the API and reprices a material; approves and unlocks through the API; opens SCR-06 as the Lead; follows the notice's Recalculate link; presses Recalculate (:154); expects the "Rates changed" status to leave the page (:155), then Approve enabled (:156), then the stored state SUBMITTED with 2 calculations (:157).

## Expected Result
After Recalculate succeeds the notice is gone and Approve is enabled, inside the 15 s expect and the 30 s budget.

## Actual Result
Two attempt-1 failures, both [tablet], both a 30 s test timeout with the same wait:

| # | Run | Head | Result |
|---|---|---|---|
| 1 | PR run 44577408149 (read by master, DL-257) | `2f5b8511` | the 30 s budget ended while the 15 s `toHaveCount(0)` waited for the notice to clear after Recalculate. The case also read 27.3 s on `master` push 44540107462 |
| 2 | PR run 44902999104, Stage 12 shard 3 (PR #571) | `a11abdf1` | attempt 1 failed at **30.2 s** (test no. 79 of the shard); retry passed in 10.5 s |

```
Test timeout of 30000ms exceeded.
Error: expect(locator).toHaveCount(expected) failed
Locator: getByRole('status').filter({ hasText: 'Rates changed since this was calculated.' })
Expected: 0   Received: 1
- Expect "toHaveCount" ... with timeout 15000ms
  20 x locator resolved to 1 element  (unexpected value "1")
- Test timeout of 30000ms exceeded.
at tests/e2e/rates-changed.spec.ts:155:34
```
**Third occurrence, 2026-11-22 (qa-engineer, read with master's DL-290 (4)): the first on a `master` push run, and the first with the diagnostic of #591.** `master` push run 44985240147 (60ac0d18), Stage 12 shard 3 (job 137094268903), `rates-changed.spec.ts:224` [tablet] (the AC-10 case, renumbered from :135): attempt 1 failed at **33.1 s** (test no. 77), retry passed in 14.8 s; the shard `1 flaky, 528 passed (14.5m)`. The error is `Test timeout of 30000ms exceeded.` alone, with the case's own attachment:
```
[AQP-387 rates-changed diagnostic] tablet | attempt 1 | after the press the test ended as "timedOut" | no answer to the Recalculate request was seen
  Recalculate request: sent +null ms after the press; answer none
  notice elements still on the page: 0
```
**[Corrected 2026-11-22 by DL-294 (1): the "no answer" headline is false, see the fourth occurrence below. On this run the request log printed by the same report shows `POST .../recalculate` answered 200 at +12,483 ms and the refresh answered at +13,920 ms, with 0 notice elements and Approve enabled: a 12.1 s recalculation that used up the test budget, rightly counted on RISK-031 trigger (b) as a budget cut. Only the "no answer" wording is withdrawn. The text below is kept as first written.]**

**Read against this file's Sev-2 trigger** (Recalculate answered 200 while the notice stays, or the server cleared and the screen kept it): **not met.** No answer to the request was seen and no notice element was left on the page, so this attempt shows no stale notice. The diagnostic does not say whether the press was lost or the request was never sent, so the cause (test, runner or product) is still open. The case reads 9.2 / 16.3 / 15.5 s (mobile / tablet / desktop, attempt 1) on `master` push 44988681963 (45512bd4, 0 flaky). The failure is a budget cut, so master counted it as the one RISK-031 trigger (b) occurrence of 22 Nov (1 of 2, DL-290 (4)); RISK-031 stays closed. Severity stays Sev-3, no re-run rule; a red run (both attempts) comes to master.

Other readings of the case in the logs QA holds: mobile 10.4 to 12.5 s; desktop 9.1 to 17.4 s; tablet 10.5 s on the retry.

**Fourth occurrence, 2026-11-22: the diagnostic shows a 200 and the server state cleared while the screen kept the notice (master's DL-294 (1); QA read the log).** PR #605 run 44999981920 (head 9f54429d, merge ref "Merge 9f54429d into 62ff83c4"), Stage 12 shard 3 (job 137139171639), `rates-changed.spec.ts:224` [tablet]: attempt 1 failed at **31.1 s** (test no. 80), retry passed in 15.1 s. The error: "Test timeout of 30000ms exceeded." with `expect(noticeOf(page)).toHaveCount(0)` at :245 showing "17 x locator resolved to 1 element", Expected 0, Received 1. The case's diagnostic (printed and attached):
```
[AQP-387 rates-changed diagnostic] tablet | attempt 1 | after the press the test ended as "timedOut" | no answer to the Recalculate request was seen
  Recalculate request: sent +null ms after the press; answer none
  notice elements still on the page: 1   ("Rates changed since this was calculated. 1 material price changed ...")
  Recalculate button: {"count":1,"busy":"true"}
  Approve enabled: false
  page: "/estimates/Q-9999-<number>#review-calculate"
  second read of the server, costs view: {"status":200,"state":"current","ratesChanged":null}
  second read of the server, stored estimate: {"status":"SUBMITTED","calculations":2}
  request +115 ms sent POST /api/v1/estimates/<id>/recalculate
  request +5910 ms answered POST /api/v1/estimates/<id>/recalculate 200
  request +5929 ms sent GET /estimates/Q-9999-<number> (rsc)     (no answer to this refresh by the end)
```
**The headline is wrong, and the request log disproves it:** at 9f54429d `watchRecalculate` (:101) matches `isCalculate` to `POST .../estimates/${ownerId}/calculate` only, so the verdict (:140 to :143) never sees the AC-10 press, which posts `/recalculate`; the request log (:102 to :115) does see it. The fault is in #591's diagnostic, not in the product. **What the screen did:** after a 200, `recalculate-button.tsx` calls `startRefresh(() => router.refresh())` (:93) and stays `aria-busy` while sending or refreshing (:97); the server draws the notice, so the notice stays until the refresh answers. Here the server had stored the recalculation and cleared the rates-changed state, while the screen kept the notice and the busy button for about 9 s after the 200 (about 14.9 s after the press, 17 polls) until the 30 s budget cut the wait just before the expect's own 15 s. **Not counted on RISK-031 trigger (b)** (a PR run; the failure is also a received value; DL-294 (2)). The 22 Nov count stays 2 of 2 and RISK-031 stays open.

**Neighbour in the same window (evidence, DL-294 (1)):** `process-propagation.spec.ts:109` [tablet] failed attempt 1 on the same shard at 30.4 s in `cleanUp` (:88, called from :175), 07:52:57 to 07:53:28Z, while the AC-10 case's server answers were slow; in all three attempt-1 failures master read (PR run 44902999104, `master` 44985240147, this run) the :109 case ran on another worker and started 1.3 to 2.7 s before the AC-10 case. The overlap alone proves nothing (their green attempts overlap too). Watch entry in test plan section 7.

**Fifth occurrence, 2026-11-22: PR #612 run 45008203701 (the cause step's run of record; master's DL-295 (1); QA read the log).** Head 93e12a5f, merge ref "Merge 93e12a5f into ea915150", Stage 12 shard 3 (job 137164420759, `1 flaky, 4 skipped, 531 passed (14.4m)`; fan-in `Stages 1 to 11` success, job 137168299494). `rates-changed.spec.ts:224` **[tablet]** attempt 1 failed at **31.3 s** (test no. 79): "Test timeout of 30000ms exceeded.", `toHaveCount(0)` with "18 x locator resolved to 1 element"; the retry passed in **10.8 s** (no. 86). **[mobile] 9.2 s and [desktop] 9.8 s passed attempt 1** (shards 1 and 4). With the corrected matcher the diagnostic's headline reads **"RECALCULATE ANSWERED 200 AND THE NOTICE IS STILL SHOWN (the Sev-2 trigger of DL-280)"**:
```
  notice elements still on the page: 1
  Recalculate button: {"count":1,"busy":"true"}
  Approve enabled: false
  second read of the server, costs view: {"status":200,"state":"current","ratesChanged":null}
  second read of the server, stored estimate: {"status":"SUBMITTED","calculations":2}
  request +210 ms answered GET /_next/static/chunks/src_lib_0y0y7na9i3h23._.js 200
  request +222 ms sent POST /api/v1/estimates/<id>/recalculate
  request +5199 ms answered POST /api/v1/estimates/<id>/recalculate 200
  request +5236 ms sent GET /estimates/Q-9999-<number> (rsc)
  request +6052 ms answered GET /estimates/Q-9999-<number> (rsc) 200
```
The notice was still shown at about +14.9 s after the press (18 polls). `process-propagation.spec.ts:109` [tablet] passed attempt 1 just before it. **Note from DL-295: "answered" in the request log is Playwright's `response` event, which fires when the headers arrive.** An RSC refresh streams its body after the headers, so "+6,052 ms answered 200" shows only that the stream started, not that the browser had the whole payload; the log also never notes a script as `sent` (only `answered`), so a client chunk still pending at the end would not show. Runs 44999981920 (refresh headers not seen in 9 s) and this one (headers seen, body end unknown) may be the same stall seen at two points. **Count of [tablet] attempt-1 failures of the AC-10 case (RISK-033's trigger): 44985240147, 44999981920, 45008203701; mobile and desktop none in these runs.** Not counted on RISK-031 trigger (b) (a PR run). Run 45008203701 is a run of record for the cause step, **not merge evidence** (its merge ref is against ea915150).

**Readings of the case on the two `master` pushes after #605 (QA; attempt 1, all passed), s, mobile / tablet / desktop:** `master` 45008501202 (d959e8f7) 10.0 / 17.6 / 10.1; 45010599354 (d119ae39) 7.9 / 12.6 / 14.0. PR #612 run 45008203701: 9.2 / **FAIL 31.3** / 9.8.

**Sixth occurrence, found 2026-11-22 by the rate count (qa-engineer): `master` push 44941416105 (6e63bb90, the merge of #591, 21 Nov 19:31Z), shard 3 (job 136960478083), `rates-changed.spec.ts:224` [tablet], attempt 1 at 32.2 s** (test no. 77; the retry passed in 13.4 s; shard `1 flaky, 528 passed (14.3m)`). It was not in this file or in the test plan until now. It has the Sev-2 signature, read with the old matcher (headline "no answer to the Recalculate request was seen", which is wrong): `toHaveCount(0)` "24 x locator resolved to 1 element", 1 notice element, button `busy: true`, Approve disabled, server `current` / `ratesChanged: null` / SUBMITTED with 2 calculations. Request log: `POST /recalculate` sent +94 ms, **answered 200 at +8,117 ms**; `_rsc` refresh sent +8,134 ms, **headers answered 200 at +9,419 ms**; the notice was still shown at the end of the 15 s expect, about 15 s later. It is the first AC-10 failure on a `master` push whose log carries the diagnostic, and it shows the notice staying long after the refresh's headers (DL-295's open question: body end or applying). It is a 30 s time-out on a `master` push on 21 Nov: **possible RISK-031 trigger (b) event for 21 Nov, master to rule.**

## Rate count for RISK-033 (DL-295 q2; the narrow route, 2026-11-22)
**Scope counted, and what was not.** The full count over every CI run since 2026-11-20 (about 330 runs, by a script over all their Stage 12 logs) was **not run: the command was denied by the permission system and was not worked around**; the delivery lead is told by master. The narrow route (master's instruction) was read instead: the Stage 12 job logs of **every `master` push CI run from 2026-11-20 02:37Z to 22 Nov 10:04Z (49 runs: 9f9981fa to d119ae39) plus the push of eb4137f4 (45013997495)**, and the PR runs whose logs QA already held or read this week. Counted: attempt-1 results of the AC-10 case ("AC-10: an unlocked Draft with current figures", `:135` before its renumbering, `:224` now), by width, per run. PR runs not read are not in the figures.

| Set | Runs | Attempt-1 failures, tablet | mobile | desktop |
|---|---|---|---|---|
| `master` push runs, 20 Nov 02:37Z to 22 Nov 10:04Z | 49 (each ran the case once at each width) | **2**: 44941416105 (6e63bb90, 21 Nov, 32.2 s), 44985240147 (60ac0d18, 22 Nov, 33.1 s) | 0 | 0 |
| `master` push eb4137f4 (45013997495) | 1 | 0 | 0 | 0 |
| PR runs read in full this week (QA): #599 run 44990897082; #605 run 44999981920; #611 runs 45009385390 and 45011895045; #612 run 45008203701 (mobile and desktop read as well) | 5 | **2**: 44999981920 (31.1 s), 45008203701 (31.3 s) | 0 | 0 |
| PR runs outside what was read now, already in this file | | 44902999104 (#571, 21 Nov, 30.2 s) | | |

So on the logs read: **`master` pushes 2 of 50 (4 %) at tablet, 0 of 50 at mobile, 0 of 50 at desktop; PR runs 2 of 5 at tablet, 0 of 5 elsewhere; 5 tablet attempt-1 failures since 20 Nov (44902999104, 44941416105, 44985240147, 44999981920, 45008203701), none at mobile or desktop.** Every failing attempt was test no. 77 to 80 of shard 3 (the case sits early in shard 3). On the PR runs read in full the passing tablet attempts read 13.8 to 29.4 s (29.4 s on PR #599 run 44990897082), mobile and desktop 11.2 to 18.4 s. The rate is a lower bound for PR runs (only the runs read are in it) and exact for `master` pushes. Failures per width are tablet-only on this evidence.

## Evidence
Job log of the Stage 12 shard 3 job of run 44902999104; DL-257 (E) and (6) in `docs/00-governance/decision-log.md`; risk register RISK-031 text for run 44577408149. No trace of attempt 1 (`trace: on-first-retry`), so the page state at the failure is not kept.

## What decides it (as first logged; the fourth occurrence above settles that the 200 was answered and the screen kept the notice, the cause is for the cause step)
- **Test or runner (leading reading):** the Recalculate request finished late (the dev server compiles on demand; tablet is the slow draw in this file), so the notice was still shown when the 15 s expect and then the 30 s budget ended. The retry shows the case at 10.5 s.
- **Product:** the notice is not cleared in the client after a successful Recalculate under some ordering (a response applied before a refresh, or a stale read). A trace or `error-context.md` showing the Recalculate answered 200 while the notice stays, or Approve disabled while the stored state is SUBMITTED, decides it. Then QA re-grades to Sev-2 the same day and tells master.

## Suspected Area
`tests/e2e/rates-changed.spec.ts:135-158`; client: `src/components/features/estimate-review/` (the Recalculate handler and the notice state).

## Route (master's DL-295; supersedes the "Binding for the fix" below where they differ; the diagnostic's matcher fix is in #612)
- **Ruling 1, observation first, widened by master (#612, `tests/e2e/rates-changed.spec.ts` only, no `src/`, config, `auth.setup.ts` or `tests/e2e/support/` change):** **O1** for every noted request record sent, headers (`response`) and body end (`requestfinished`) or failed, each as ms after the press; scripts are recorded as `sent` too. **O2** the report lists every request sent but not finished, with its age. **O3** console error and warning messages and `pageerror` from the press on (at most 20), with ms after the press. **O4** just before the click one `page.evaluate` (errors caught; it can never fail the case) installs a buffered `PerformanceObserver` for `longtask`; the report gives the count, total and longest long task after the press and `document.visibilityState`, or "unsupported". **O5** one timing line on **every attempt of :224 at every width, pass or fail**: POST sent, headers and body end, the `_rsc` refresh sent, headers and body end, and the test's duration. Observers only: no wait or assertion added, removed or changed; no budget, timeout, retry, skip, `test.slow()` or fixed sleep; every AC-10 assertion kept; no re-run rule.
- **Observer proof (developer, #612 PR body):** red-first on the local plant (the `_rsc` refresh held 25 s) lists the refresh as unfinished under O2; a local cold-start reproduction (:224 [tablet] alone first on a fresh dev server, 5 runs with Chromium CPU throttled 4x via CDP `Emulation.setCPUThrottlingRate` and 5 without, each run's O5 line printed); the O5 lines for all three widths from the updated head's CI run.
- **What the readings route to (master rules on the evidence):** **R-A**, a test-environment cause (the refresh body ends late or a dev chunk is pending in the same window as a first compile): a spec-local warm-up in the DL-272 (B) form in a new test-only PR, and DEF-057 comes back for re-grade. **R-B**, a client fault (the body ended and the notice stays, with a `pageerror` or React error, or no long tasks): a `src/` fix with the combined review of section 9 item 2. **R-C**, starvation (the body ended and long tasks cover the window): master rules; a waiver goes to the delivery lead.
- **Rulings 2 and 3:** no warm-up in `auth.setup.ts` (frozen enabler, section 9 item 4; the suite-wide first-compile cause stays in #545 for after G8); the spec-local warm-up is held until the observation reports or the time-box ends; **no product change now** (the 200's body is deliberately not read so that no state reaches the screen except through the server's redraw, NFR-002, `recalculate-button.tsx` :22, :23).
- **#612 (ruling 4):** the observer goes in as a second commit, then "Update branch", and #612 squashes on that head's fully green run; its body keeps "Refs #585", not "Closes". Fallback: if the observer is not pushed by the end of 2026-11-23, #612 merges matcher-only and the observer follows in its own PR.
- **G8 (ruling 5):** DEF-057 stays Sev-2 and blocks G8. It is cleared only by (a) a fix on R-A or R-B with the DL-294 proof (an attempt-1 pass of :224 at all three widths on the fix PR's run of record and on the first `master` push after the squash, with the O5 line kept in place for the final regression), (b) a master re-grade on R-A evidence (then the Sev-3 route), or (c) the delivery lead's word. **Time-box: 2026-11-26.** If no observer reading names the point of the stall (a CI failure with the full report, or a local reproduction) by then, master rules again; the default is the spec-local warm-up as the candidate fix, DEF-057 still Sev-2 until its proof. If it is not closed by the G8 freeze (about 1 Dec), master brings it to the delivery lead with options.
- **QA tasks (DL-295 "For qa-engineer"):** (q1) this record; (q2) count, by 2026-11-24, the runs since 2026-11-20 that executed :224 and the attempt-1 failures among them per width, so that RISK-033's P rests on a rate (see the test plan section 7 note for its state); (q3) once the observer is on `master`, read the O5 line from shard 3 of every run (PR or `master` push) into test plan section 7, and bring the first failure with an O1 to O5 report to master the same day.

## Binding for the fix (DL-294 (1) ruling 1b; supersedes the first-logged text; developer, DEF-057's developer if free)
**Step 1 is the cause, before any `src/` change.** Test-only commits are allowed in the DEF-057 PR.
1. Fix the diagnostic's matcher so it sees both `/calculate` and `/recalculate` and the headline matches the request log. Nothing else in the case changes.
2. Name why `POST /recalculate` took 5.8 s and 12.1 s on a small fixture when the green retries took a normal time (NFR-008 asks for under 2 s p95 at 500 nodes; the CI host is not the NFR machine, so this is a signal, not a measurement). Also name why the refresh had not answered after 9 s. Read what the recalculate service and the estimate page wait on. Check whether the rate-default change or the customer moves in `process-propagation.spec.ts:109` write rows or rates that the AC-10 estimate's recalculation or page reads or waits on. Shared test data is a Test cause; a wait in the service is a Product cause.
3. Show the screen's behaviour with a delayed refresh in a local run (a `page.route` delay on the `_rsc` request): the notice and the busy line stay until the refresh answers. Then one of three routes: a `src/` cause gets the fix with the combined review of section 9 item 2; a shared-data cause gets a tests-only fix and DEF-057 comes back to master for re-grade with the evidence; no cause beyond host load comes back to master with no change.
**Binding on :224:** no change to the budget, timeouts, retries, skips, `test.slow()` or fixed sleeps; every AC-10 assertion kept; no re-run rule (DL-280 stands). **Proof:** an attempt-1 pass of :224 at all three widths on the PR run of record and on the first `master` push after the squash. The corrected headline is shown red-first on one local plant: the plant diff and result are printed in the PR body, then the plant is reverted. If DEF-057's cause step shows that `process-propagation.spec.ts:109` shares the cause, :109 is folded in and the proof adds an attempt-1 pass of :109 at all three widths. At G8, master reads DEF-057 as fixed or brings it to the delivery lead.

## Observer readings since #612 (qa-engineer, 2026-11-24; for master's T4 re-rule due 2026-11-26, DL-295, DL-314)
**Scope.** #612 (the observer; `master` 50cb1150) merged 2026-11-22 11:17Z. Every CI run since then that ran Stage 12 (workflow CI, any event; cancelled and still-running runs have no result and are left out) had the `[AQP-387 timing]` line of O5 read from all three shards' logs for the AC-10 case (`rates-changed.spec.ts:224`, renumbered `:325` by later merges). **119 runs: 32 `master` push runs (50cb1150 to the push on ab3f45a7, run 45297038711) and 87 PR runs; 357 readings (one per width per run).** Read by script from the job logs; the full O1 to O4 report prints only when the case fails.

| Reading | Result |
|---|---|
| Attempt-1 failures of the AC-10 case since #612 | **0 of 357** (0 of 119 at each width). No second attempt was run; every reading is `attempt 1 | passed` |
| O1 to O4 report (the full diagnostic) | **none was printed**: it prints only on a failure, and there was none |
| Does any reading name the stall? | **No.** There is no failing reading to name it. The O5 lines of passing runs show no stall: POST /recalculate answered (headers) at a median 0.8 s (tablet) to 1.4 s (mobile), at most 4.4 s; the `_rsc` refresh answered (headers) at a median 1.3 s to 2.3 s, at most 6.4 s (mobile, PR run 45025658869); the case took a median 12.1 to 13.8 s, at most 23.4 s (tablet, PR run 45040542543, 22 Nov 15:50Z; next 22.4 s, PR run 45040682212; the slowest `master` push reading was 19.4 s, 45183160959) |
| Contrast with the sixth occurrence (push 44941416105, 21 Nov, before the observer) | POST answered at +8,117 ms and the refresh headers at +9,419 ms; every passing reading since is under 4.5 s and 6.5 s, so the failing draw was 2 to 3x the slowest passing one |
| Refresh body end | recorded on 355 of 357; "body end none" on two passing readings (desktop PR 45022922606, mobile PR 45117982717): the refresh's headers had answered and the notice still cleared inside the case. It does not bear on the failing ordering (DL-295's open question: body end or applying) |
| Per width (attempt 1, ms): test median / max | mobile 12,092 / 18,650; tablet 13,756 / 23,403; desktop 13,003 / 20,305 |

**Did it reproduce at all recently?** **No: not once since 2026-11-22 11:17Z** (about 37 hours, 119 runs, 357 attempts). The last attempt-1 failures on record are the two PR runs of 22 Nov (44999981920 at 31.1 s, 45008203701 at 31.3 s, both before the observer) and the `master` push 44985240147 (22 Nov 04:28Z, 33.1 s). Before the observer the rate on `master` pushes was 2 of 50 (4 %) at tablet (the rate count above); at that rate 32 `master` pushes would have given about 1.3 failures, so zero is a 27 % outcome by chance alone (0.96^32): **not a proof that it is gone.** Over all 119 runs at the same 4 % the chance of zero is 0.8 %, but the PR-run rate before the observer was higher and mixed (PR runs read were chosen, 2 of 5), so QA does not rest a conclusion on that figure.

**What changed in the same period that could matter (facts, not a cause):** the observer itself (it adds one `page.evaluate` before the click and listeners; no wait or assertion) and other test-only and product merges (for example #616 and the DEF-070, DEF-072 and DEF-073 fixes). No wave reading (matched-test median ratio) was made for these runs for DEF-057. QA names no cause.

**For master's T4 re-rule (QA's reading, master decides):** the observation route of DL-295 has produced **no failing reading to rule R-A, R-B or R-C on**. The time-box ends 2026-11-26; the default in DL-295 is the spec-local warm-up in the DL-272 (B) form as the candidate fix, DEF-057 still Sev-2 until its proof (an attempt-1 pass of the case at three widths on the fix PR's run of record and on the first `master` push after the squash, with the O5 line kept for the final regression). QA's watch stays: the first failing attempt-1 with an O1 to O5 report is brought to master the same day (DL-295 q3). Run list and the per-run readings are held in QA's scratch (118 runs to 2026-11-23 22:26Z, then push 45297038711); the table of per-run lines can be produced on request.

## Re-run rule
None (DL-257 (E)); master may rule one.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Cause step | developer | | the matcher fix, the reason for the 5.8 s and 12.1 s recalculations and the pending refresh, the delayed-refresh local run (binding above) |
| Fixed | developer | | `fix/AQP-387-<slug>` |
| Regression test added | developer | | the fix is the test change; every assertion kept |
| Verified | qa-engineer | | an attempt-1 pass of :224 at all three widths on the PR run of record and on the first `master` push run after the merge (under 25 s); the plant shown red-first; a `src/` fix also needs the combined review |

## Re-grade to Sev-3, type Test (master's DL-356 (A); recorded by qa-engineer, 2026-11-24)
**Ruling.** The developer's code-facts note (AQP-387 comment 13017) reads N1 and master accepts it: the product cannot leave the "Rates changed" notice up after a refresh that read `current` (the 200 is read only for `state === 'current'`, the notice is drawn by the server, the button leaves the page in the same commit, there is no cache, refreshes replace the whole tree). The failing screens were the complete pre-refresh page, the "refresh not yet applied" state (R-A or R-C of DL-295). **DEF-057 is re-graded Sev-3, type Test, product excluded on the code reading (DL-295 (5)(b)) and leaves the G8 blocking list.** With it, no Sev-1 or Sev-2 defect is open. RISK-033 is re-scored to 6 (P 3 to 2; 0 of 357 failures since the observer and no product path), open until G8.

**Records changed:** this file (Severity, Priority, Type, Status rows); Jira AQP-387 priority Medium, label `sev-3`; GitHub #585 label `sev-3` (not `sev-2`); test plan section 7.1 E row and change log 0.3.33.

**Reopen trigger (DL-356 (A); QA's watch to G8).** The #612 observer (O1 to O5) stays in `rates-changed.spec.ts` until G8. **Any attempt-1 failure of the AC-10 case** (`rates-changed.spec.ts:325`, was :224) comes to master the same day with its O1 to O5 report. **If O1 shows the refresh finished (`requestfinished`) and the notice was still up more than 5 s later, DEF-057 reopens at once as provisional Sev-2, type Product (N2)** and QA tells master. A red run (both attempts) comes to master as before. No re-run rule.

**Not a defect (DL-356 (A)):** the busy state during a slow refresh (no client time limit or re-read; the same for the nine `router.refresh()` buttons) is not the DEF-040 shape: the button shows `aria-busy` for the whole wait and a failed refresh ends in a full navigation. A time limit on refresh-pending buttons may be logged as a post-G8 follow-up (GitHub `follow-up`).

**At G8:** listed under "open, not blocking" with master's written acceptance (DL-354 (4)), with the readings: 0 of 357 attempt-1 failures in 119 runs from 2026-11-22 11:17Z to push 45297038711 (section "Observer readings since #612" above), unless it has closed by then.
