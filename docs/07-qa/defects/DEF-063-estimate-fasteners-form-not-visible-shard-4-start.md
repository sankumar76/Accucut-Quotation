# DEF-063: `estimate-fasteners.spec.ts` :93, :104 and :127 [desktop] the part form is not visible in 15 s at the start of shard 4, attempt 1 on two PR runs 8 minutes apart (open type; product not excluded)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313, Fasteners fields show only when needed), AC-1 to AC-3: :93 "AC-1: Qty and Cost are not on a new part (not disabled: not there), and the card counts Fasteners alone"; :104 "AC-1: "none", " NONE " and a blank keep them hidden as they are typed, and a repeat of the default sends nothing"; :127 "AC-2: another word shows Qty and Cost, empty and counted; typed values are saved as two decimals". **No AC is shown to fail:** the failing step is `openForm` (`waitForForm`) |
| Severity | **Sev-3 Moderate** (qa-engineer, by the line of DL-285 (3): a case that fails on its own `expect` timeout is a watch on its first occurrence and a Bug on its second; master is told and may rule otherwise): fails closed only if both attempts fail, workaround is the retry |
| Priority | P3. Lane: master rules, and whether it joins the DEF-057 and DEF-059 cause step |
| Type | **Open: Test, product not excluded** (the same early-shard stall as DEF-057 and DEF-059; a product cause such as the zero-width values-loading skeleton of DEF-059 taking the form's place is not ruled out) |
| Status | **Closed** (logged 2026-11-22; cause measured as a cold first compile (Test); #617 squashed as `2ff31d2b`; P1 and P2 met; closed by QA 2026-11-22) |
| Jira / GitHub | [AQP-397](https://sankumar76.atlassian.net/browse/AQP-397) / [#615](https://github.com/sankumar76/Accucut-Quotation/issues/615). Jira "relates to" AQP-313 (STORY-05.05), AQP-393 (DEF-059) and AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-063`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium |
| Risk / rule | RISK-031: **not counted on trigger (b)** (own 15 s `expect`, ended at about 20 s, under the 30 s budget; PR runs). No re-run rule; a red run (both attempts) comes to master |
| Found by / date | CI, two PR runs on 22 Nov; read by qa-engineer, 2026-11-22 |
| Build / commit | PR #604 run 45011363827 (head b9bc893e), shard 4 job 137174187838; PR #611 run of record 45011895045 (head 5e35f293), shard 4 job 137175825653 |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 4 of 4 (runner 4 vCPU, 15,983 MB), project desktop (1366 px), 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The three cases are among the first tests of the desktop project in shard 4, started by three of the four workers right after the set-up project (`auth.setup.ts`, the 36 s "make the E2E Admin the one active Admin" test) ends. Each calls `openForm` (`tests/e2e/support/part-form.ts:77`), which waits for `form[data-part-form]` (:57).

## Expected Result
The form is visible within the 15 s `expect`, as it is on the retry (7.3 to 11.9 s) and on every other run read.

## Actual Result
Attempt 1 of each case ended on `expect(locator).toBeVisible() failed`, Locator `form[data-part-form]`, Expected visible, Timeout 15000 ms, "element(s) not found" (no received value), at `support/part-form.ts:57`, called from `openForm` (:77) and the case (:94 and :105 read in the log).

| # | Run | Job | Cases (test no., attempt 1) | Retry | Shard result |
|---|---|---|---|---|---|
| 1 | PR #604 run 45011363827, head b9bc893e, 10:16:08Z | 137174187838 | :104 (no. 4) 20.3 s; :93 (no. 6) 20.2 s; :127 (no. 5) 20.5 s | all passed | `4 flaky, 20 skipped, 518 passed (17.1m)`; the fourth flaky was `estimate-form.spec.ts:74` [desktop] (DEF-061, 102 px) |
| 2 | PR #611 run of record 45011895045, head 5e35f293, 10:22:30Z | 137175825653 | :104 (no. 4) 20.2 s; :127 (no. 6) 20.1 s; :93 (no. 7) 20.3 s | 9.6, 11.9, 7.3 s | `3 flaky, 20 skipped, 519 passed (16.2m)` |

The set-up test finished at 10:15:46Z (run 1) and 10:22:09Z (run 2), and the cases failed 20 s after it. In run 2 the fourth worker passed `estimate-customer.spec.ts:235` (no. 5) at 10:22:20Z. **Not seen** on `master` push runs 45008501202 and 45010599354 (shard 4: 0 flaky). Same file and mode earlier on 22 Nov, not the same cases: `master` push 44975509844 (616d7e34) `estimate-fasteners.spec.ts:207` and `:234` [desktop] and `estimate-first-load.spec.ts:64` (DEF-059), each an own-15 s `expect` (master's DL-290 (4)); and `estimate-first-load.spec.ts:64` on 44983705175.

## Evidence
Shard 4 job logs of the two runs (the three error blocks each, at the end of the log); the spec's own comment at the AC-3 case (`estimate-fasteners.spec.ts` about :186, AQP-340 part 2, DL-232 M3): "On the desktop shard it is one of the first eight tests after the set-up project, which does not warm the estimate workspace, so it waits for the development server's first compile of that page"; DL-285 (3) and DL-290 (4) in `docs/00-governance/decision-log.md`.

## What decides it (not collected)
- **Test or runner (leading reading, not proven):** the first estimate-form open after the set-up project waits for a cold first compile or first read that takes more than 15 s on a slow draw; three workers start it at once. The same reading is the working one in DEF-057's route R-A (DL-295) and for the stored-values read in DEF-059.
- **Product:** the form not appearing for 15 s could be the values-loading skeleton of `part-fields.tsx:124` (0 px wide at 1366 px, DEF-059) showing instead of the form while the stored-values read is pending. The DEF-059 measurement would decide it. No trace of attempt 1 is kept (`trace: on-first-retry`; a trace-setting change is frozen tooling, section 9 item 4).

## Suspected Area
`tests/e2e/support/part-form.ts:57-77` (`waitForForm`, `openForm`); `tests/e2e/auth.setup.ts` (the warm-up step does not cover the estimate workspace; a change there is a frozen enabler, DL-233 (5), DL-295 ruling 2); client `src/components/features/estimate-workspace/part-fields.tsx:124`.

## Binding for the fix (as DL-229 (4)(b), DL-257 (B), DL-272 (B); master rules the route)
Test-only unless the cause is in `src/`, in which case stop and go to master. No budget, retry, `test.slow()`, skip or fixed-sleep change; every assertion kept. A spec-local warm-up in the DL-272 (B) form (in `estimate-fasteners.spec.ts` only, proven by the `src/` line, failing visibly) is the allowed candidate; an `auth.setup.ts` warm-up is not. If the DEF-057 cause step (DL-295) or the DEF-059 measurement names the stall, this Bug joins that route. Proof as DL-257 (A): attempt-1 pass of :93, :104 and :127 at all three widths on the PR run of record and on the first `master` push after the merge, each under 25 s.

## Cause, fix, proof and close-out (qa-engineer, 2026-11-22; DL-296 (4))
**Measured cause (PR #617 body, commit 1, observe only, run 45019003031, shard 4 job 137197520191, desktop, attempt 1; not a failing run, so the chain is at its ordinary size):** a **cold first compile** of the estimate page and its three reads on the development server, not a product fault. The three cases that start first (one per worker) read the document 2.3 to 2.6 s, the form read 2.6 to 2.7 s, the tree read 3.0 to 3.1 s and the stored-values read 1.7 s, against 0.4 to 0.9 s for the cases after them; the form first on the page at +9.2 to +9.6 s against +3.4 to +5.3 s. The page was served, no script was pending, and the 4-block values skeleton stood until the stored-values read answered, then the form. A zero-width skeleton (DEF-059) cannot make `waitForForm` fail, so DEF-059's measurement does not explain this Bug. The failing size is the same chain on a slower draw (the 15 s `expect` that ran out at about 20 s on runs 45011363827 and 45011895045); no failing-attempt line was captured.

**Fix:** #617 (AQP-397, squashed as `2ff31d2b`; test-only, `tests/e2e/estimate-fasteners.spec.ts` only): a `test.beforeAll` in the DL-272 (B) form (each worker opens the estimate workspace once as a person of its own, so the routes are compiled before the first case; a failure there fails the hook visibly; it prints an `[AQP-397 warm-up]` line). No budget, retry, timeout, `test.slow()`, skip or sleep change; no `auth.setup.ts` change; the cases moved from :93, :104, :127 to **:96, :107, :130** (bound by title).

**Proof** (attempt 1, seconds, all passed, mobile / tablet / desktop):

| Run | :96 "AC-1: Qty and Cost are not on a new part ..." | :107 "AC-1: "none", " NONE " and a blank keep them hidden ..." | :130 "AC-2: another word shows Qty and Cost ..." |
|---|---|---|---|
| **P1: PR #617 run of record 45022384312** (head 41208ebb; `Stages 1 to 11` success; shards 543 / 537 / 539 / 523 passed, 0 flaky, 0 failed) | 9.4 / 10.4 / 4.3 | 9.2 / 11.5 / 3.8 | 13.6 / 15.7 / 10.4 |
| **P2: first `master` push after the squash, 45025620716** (2ff31d2b; `Stages 1 to 11` success, job 137223401008; shards `523 passed (12.5m)`, `539 passed (12.2m)`, `537 passed (19.3m)`, `543 passed (13.6m)`: **0 flaky, 0 failed**) | 6.6 / 9.0 / 4.4 | 6.7 / 10.5 / 3.9 | 8.7 / 13.7 / 9.0 |

The warm-up lines of the run of record (the form on the page after the hook began): tablet 6,608 to 9,158 ms, desktop 5,375 to 10,258 ms, mobile 5,487 to 7,312 ms; that is the cold cost the cases no longer carry.
- **Met:** attempt-1 pass of :96, :107 and :130 at all three widths on the PR run of record and on the first `master` push after the merge, each under 25 s (worst 15.7 s, 15 s is the report line, not gated).
- **Not a shortcut on the Bug's subject:** the three cases still open the form and assert as before; the warm-up only moves the one-time compile cost out of the first case of each worker. A cold first compile is also what #612's cause step found for DEF-057's slow `/recalculate`; the suite-wide form of the fix stays in #545, after G8.
- **Closed by QA 2026-11-22.** Jira AQP-397 Done; GitHub #615 closed.

## Re-run rule
None. A red run (both attempts) comes to master and is not re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-397, #615 |
| Cause named | developer | 2026-11-22 | #617 commit 1, run 45019003031: a cold first compile of the estimate page and its reads |
| Fixed | developer | 2026-11-22 | #617, `fix/AQP-397-fasteners-first-load`, squashed as `2ff31d2b`; a spec-local `test.beforeAll` warm-up |
| Regression test added | developer | 2026-11-22 | the fix is the test change; every assertion kept |
| Verified | qa-engineer | 2026-11-22 | P1 (run 45022384312) and P2 (`master` push 45025620716): the three cases attempt-1 green at all three widths, worst 15.7 s |
