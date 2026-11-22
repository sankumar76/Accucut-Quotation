| Status | **Closed** (logged 2026-11-22; #616 squashed as `f02c3b54`; P1, P2 and P3 met; closed by QA 2026-11-22) |
# DEF-062: `estimate-calculate.spec.ts` :143, :202 and :238 [tablet] cut by the 30 s budget on both attempts (PR #611 run 45009385390); tablet readings 17 to 28 s (Test)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.09 (AQP-317, Calculate): the AC-2 cases of the review SQR-01. :143 "AC-2: Calculate answers exactly {status, message}, the page turns to "Submitted": read-only inputs, no part actions, a disabled button, the one sentence and no number"; :202 "AC-2: a value typed just before the press is saved first: the press waits ("Calculating"), sends nothing until the save has been answered, and the record holds the typed value"; :238 "AC-2: nothing is sent while a field shows a value that is not saved: the page says so, the field says why, and fixing the field lets the next press go". **No AC is shown to fail:** every failed attempt ends on the 30 s budget |
| Severity | **Sev-3 Moderate** (qa-engineer; master is told and may rule otherwise): a Test-type defect, fails closed if both attempts fail (they did, on a PR run), workaround is a later head's run |
| Priority | P3. Lane: master rules (hardening window, test-only, behind the Sev-2 and Major items) |
| Type | **Test** (E2E, Playwright, `tablet` project; duration-tail class: 17 to 28 s on an ordinary draw) |
| Status | **New** (logged 2026-11-22) |
| Jira / GitHub | [AQP-396](https://sankumar76.atlassian.net/browse/AQP-396) / [#614](https://github.com/sankumar76/Accucut-Quotation/issues/614). Jira "relates to" AQP-317 (STORY-05.09) and AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-062`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium |
| Risk / rule | RISK-031 context (the failures are on a PR run, so not trigger (b)). No re-run rule is ordered; a red run (both attempts) comes to master. Live rules: W1, R10 (R11 ended with DEF-058) |
| Found by / date | CI, on PR #611 (AQP-395); read by qa-engineer, 2026-11-22, on two triggers: **(1)** the watch-list entry for `estimate-calculate.spec.ts:238` [tablet] (DL-293 (2)): a second attempt-1 time-out on any run is a Bug the same day (the first was `master` push 44992801362, 30.3 s); **(2)** the watch-list trigger (1), a failure on both attempts with no open Bug covering the case, for all three |
| Build / commit | PR #611 head `43d54bb6` (merge ref against `master`; the head's diff is `picture-slot.tsx` and `estimate-form.spec.ts`), run 45009385390, Stage 12 shard 2, job 137168093516 |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 2 of 4, project tablet, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). Run `estimate-calculate.spec.ts` [tablet] in Stage 12 on a slow draw: each of the three cases signs in as a new Engineer, makes a calculated estimate or types into the form, presses Calculate and reads the page, and reads 17 to 28 s on a normal draw.

## Expected Result
Each case passes on attempt 1 with margin under the 30 s budget (the P2 line of DL-257 (A) is 25 s).

## Actual Result
`3 failed, 6 skipped, 530 passed (22.0m)` in shard 2; shards 1, 3 and 4 green. All [tablet], tests 331 to 339, 10:00:00 to 10:01:06Z:

| Case | Attempt 1 | Retry | Result |
|---|---|---|---|
| :143 AC-2 submitted | 30.1 s: "Test timeout of 30000ms exceeded." and `expect(#calculate-button).toBeDisabled()` at :169 waiting 15 s, "element(s) not found" (after `page.reload()` at :167 had shown the sentence) | 33.8 s: `page.reload` at :167 "waiting for navigation until "load"" | **failed both** |
| :202 typed value saved first | 30.4 s: "Test timeout of 30000ms exceeded." alone | 31.3 s: `page.waitForResponse` at :228 | **failed both** |
| :238 not saved, the page says so | 30.3 s: "Test timeout of 30000ms exceeded." alone | 31.0 s | **failed both** |

`[WebServer] Error: aborted` (`ECONNRESET`) lines at 10:00:29 and 10:01:05Z. In the same window the other workers passed the neighbouring cases (:172, :264, :280, :297 and :305 all passed).

**Not a ruled wave:** on the tests common to both runs, shard 2 ran **1.17x** `master` 45008501202's shard 2 (shard 1 1.32x, shard 3 0.92x, shard 4 1.58x), so shard 2 was not above the highest other shard; W1 (d)'s 1.4x and 0.25 lines are not met. **Not caused by #611's diff:** the merge from `master` at 5e35f293 only brought #601 in, and #611 changes the picture slot and `estimate-form.spec.ts`. The run of record 45011895045 (head 5e35f293, after "Update branch") was green.

**Readings of the three cases [tablet], attempt 1, s (QA, from the job logs):**

| Run | :143 | :202 | :238 |
|---|---|---|---|
| `master` 44990887665 (08394110) | 21.8 | 22.0 | 21.3 |
| `master` 44992801362 (6087e8b8) | 23.3 | 28.0 | **FAIL 30.3** (retry 30.5) |
| `master` 44995772811 (62ff83c4) | 19.9 | 27.7 | 26.8 |
| PR #605 run 44999981920 | 24.0 | 27.0 | 24.6 |
| `master` 45008501202 (d959e8f7) | 21.0 | 16.4 | 20.1 |
| `master` 45010599354 (d119ae39) | 17.3 | 19.3 | 17.9 |
| **PR #611 run 45009385390 (43d54bb6)** | **FAIL 30.1** (retry 33.8) | **FAIL 30.4** (retry 31.3) | **FAIL 30.3** (retry 31.0) |

:202 sits at 27 to 28 s on three of six draws, :238 at 25 to 27 s on two and :143 at 23 to 24 s on two: one ordinary slow draw (DL-264 found 1.3x to 1.4x common) cuts them.

## Evidence
Job 137168093516 log (the error blocks at the end of the log, `Error Context: test-results/estimate-calculate-...-tablet/error-context.md`, and the `trace.zip` of the retries; `trace: on-first-retry` keeps nothing of attempt 1); the readings above are from the Stage 12 logs of the runs named; DL-290 A2 (iii) (one Bug for several cases in one spec and one mode), DL-293 (2) (the :238 trigger) and the test plan section 7 watch list.

## What decides it (not collected)
- **Test or runner (leading reading):** a margin fault, as DEF-058: the three cases do a lot in one test at tablet and have no room for a draw above about 1.3x. The same-minute failure of three workers and the `Error: aborted` lines say the draw was slow for the app as well as the runner.
- **Product:** nothing in the evidence points to a product fault (no received value; the :143 retry hangs in `page.reload` waiting for "load"). Note: DEF-057's slow `/recalculate` and the early-shard stalls in DEF-059 and DEF-063 may share a server-side cause; that is for the DEF-057 cause step, not decided here.

## Suspected Area
`tests/e2e/estimate-calculate.spec.ts` :143 (the reload at :167), :202 (the `waitForResponse` at :228), :238; the helpers `makeCanaryEstimateCalculable`, `engineerWithEstimate`, `openForm` (`tests/e2e/support/`).

## Binding for the fix (as DL-229 (4)(b), DL-257 (B); master rules the lane)
Test-only, `tests/e2e/estimate-calculate.spec.ts` only; no budget, retry, timeout, `test.slow()`, skip or fixed-sleep change; every assertion and the axe scans kept; a spec-local warm-up as in DL-272 (B) is allowed. Proof as DL-257 (A): **P1** (the PR run of record) and **P2** (the first `master` push after the merge): each case first attempt at all three widths and under 25 s; **P3** one page open and at most one scan per case; 15 s reported, not gated. A change under `src/` means stop and go to master.

## Proof and close-out (qa-engineer, 2026-11-22; DL-296 (3), DL-257 (A))
The fix is #616 (AQP-396, squashed as `f02c3b54`; test-only, `tests/e2e/estimate-calculate.spec.ts` only): a local helper `openCalculable` (the Engineer's estimate is made complete in the database before the page is opened, so the case loads the page once before the press instead of twice, `openForm` then `makeComplete`); every assertion and the axe scans kept; the cases moved from :143, :202 and :238 to **:155, :213 and :248** (bound by title). Seconds, attempt 1, all passed, mobile / tablet / desktop:

| Case (by title) | **P1: PR #616 run of record 45017915849** (head 58850c30) | **P2: first `master` push after the squash, 45020428761** (f02c3b54) |
|---|---|---|
| AC-2: Calculate answers exactly {status, message}, the page turns to "Submitted" (was :143) | 12.6 / 11.1 / 10.8 | 13.8 / 12.8 / 9.7 |
| AC-2: a value typed just before the press is saved first (was :202) | 10.6 / 13.4 / 11.0 | 12.3 / 14.5 / 15.7 |
| AC-2: nothing is sent while a field shows a value that is not saved (was :238) | 12.2 / 12.1 / 12.8 | 11.4 / 14.1 / 14.2 |

Run results: P1 `Stages 1 to 11` success, shards `543 passed (15.6m)`, `536 passed (18.3m)`, `538 passed (13.9m)`, `522 passed (15.4m)`, 0 flaky, 0 failed. P2 `Stages 1 to 11` success (job 137207378449), shards `543 passed (15.4m)`, `536 passed (19.5m)`, `538 passed (13.9m)`, `522 passed (11.6m)`, **0 flaky, 0 failed**. For comparison the same cases read 16 to 28 s on tablet before the fix.
- **P1:** each case attempt-1 at all three widths under 25 s: **met** (worst 13.4 s). **P2:** the same on the first `master` push: **met** (worst 15.7 s, desktop; 15 s is the report line, not gated).
- **P3 (structural floor):** one page open before the press per case. QA read the diff of #616: the helper makes one `page.goto` and `waitForForm`; the :155 case keeps the reload after the submit (its "still Submitted after a reload" check, an assertion kept as written); no axe scan was added or removed. **Met.**
- **R12 ends with this Bug** (DL-296 (3)). W1 and R10 stay.
- **Closed by QA 2026-11-22.** Jira AQP-396 Done; GitHub #614 closed. The AC-10 observer line (O5) of the same `master` push read: tablet 17,230 ms, desktop 10,259 ms, mobile 10,607 ms, all passed.

## Re-run rule
None (master may rule one). A red run (both attempts) comes to master and is not re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-396, #614 |
| Fixed | developer | 2026-11-22 | #616, `fix/AQP-396-calculate-ready-before-open`, squashed as `f02c3b54`; test-only, `tests/e2e/estimate-calculate.spec.ts` |
| Regression test added | developer | 2026-11-22 | the fix is the test change (`openCalculable`: one page open before the press); every assertion kept |
| Verified | qa-engineer | 2026-11-22 | P1 (run 45017915849, worst 13.4 s), P2 (`master` push 45020428761, worst 15.7 s), P3 (one page open before the press): all met |
