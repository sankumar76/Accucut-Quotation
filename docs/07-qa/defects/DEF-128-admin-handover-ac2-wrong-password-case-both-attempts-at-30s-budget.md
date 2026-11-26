# DEF-128: `admin-handover.spec.ts:185` [desktop] (STORY-01.09 AC-2, a wrong password is 422) times out at the 30 s budget on both attempts; four passing readings at 25 s or more (Test; product not excluded for one step; Sev-3 proposed; Jira AQP-485, GitHub #792)

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.09 (AQP-356, Done), AC-2: 'a wrong password is 422 under the password field with the field emptied and focused, the choice kept, the dialog still open, and nothing changed; the password is in no response'. **No AC is shown to fail:** both attempts end on `Test timeout of 30000ms exceeded.`; no attempt shows an `expect` message, a received value or an axe violation list. |
| Severity | **Sev-3 Moderate, proposed by QA; master grades.** A Test-type defect that fails closed (a red required check when both attempts fail), workaround a re-run (R16, once per head), no product behaviour shown to be wrong. It is in a section 9 item 2 area (authentication, the step-up), which is why it is filed on the first both-attempts failure and not left on a watch. |
| Priority | P3 (Jira Medium; labels `sev-3`, `final-review`) |
| Type | **Test (E2E, Playwright, `desktop`; duration-tail class); product not excluded for one step.** Attempt 1 has no trace (`trace: 'on-first-retry'`), so whether the last POST was slow or the 30 s were spent before it is not proven. No 5xx, 429 or wrong status was seen on any reading of the case. |
| Status | **Open (new), 2026-11-26.** Attempt 2 of run 45815929555 (the R16 re-run of shard 3) passed, `:185` 19.0 s on a 0.80 draw (see 'Attempt 2' below). Owner proposal: developer, hardening-window test lane (test-only fix); master rules the grade, type and lane. |
| Jira / GitHub | [AQP-485](https://sankumar76.atlassian.net/browse/AQP-485) / [#792](https://github.com/sankumar76/Accucut-Quotation/issues/792) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-128, agent-qa-engineer). Relates to AQP-356, AQP-383 (DEF-053, the same family: a `/users` page grown by earlier specs), AQP-1. Searched first: JQL on `aiid-DEF-128` and text `admin-handover`, and a GitHub search for DEF-128: nothing. |
| Found by / date | CI (a PR run); read and logged by qa-engineer, 2026-11-26, at the orchestrator's request |
| Build / commit | PR #780 (AQP-475, `fix/AQP-475-scr07-stage-cards`), head `bff9f23b`, 0 behind `master` `40feaa53`; it changes only cost-details UI files, so it cannot reach `admin-handover.spec.ts` or the handover route. |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 3 of 4)`, Playwright Chromium, project `desktop`, production build, 4 workers. Run 45815929555 (`pull_request`, attempt 1, created 12:02:18Z), shard 3 job 139895530212 (12:02:22Z to 12:22:02Z): `1 failed, 5 skipped, 590 passed (18.5m)`. |

## Steps to Reproduce
Not on demand; no local run (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 on a PR or `master`; read shard 3, `[desktop]`, `tests/e2e/admin-handover.spec.ts:185`.
2. On a slow draw the case reaches 30 s: attempt 1 in `clearStepUpCount`'s POST (spec :109), the retry in the axe scan (spec :206).

## Expected Result
The case reads under 25 s on attempt 1 on any draw the suite meets, with no time-out. (22.3 s on `master` `40feaa53`; median 17.1 s over 73 runs.)

## Actual Result
| # | Run | Attempt 1 | Retry |
|---|-----|-----------|-------|
| 1 | PR #780 run 45815929555 (head bff9f23b), shard 3 job 139895530212, no. 319 / no. 329 | **failed at 30.9 s** (12:12:51Z): `apiRequestContext.post: Test timeout of 30000ms exceeded`, at `clearStepUpCount` (spec :109, called from :209), the case's last step; the call log is `POST http://localhost:3100/api/v1/users/<admin id>/admin-handover`, headers only, no response line | **failed at 34.8 s** (12:13:31Z): `frame.evaluate: Test timeout of 30000ms exceeded`, `AxeBuilder.runPartialRecursive` (`support/design-system.ts:100`, `expectNoAxeViolations`, called from spec :206) |

The same spec's other `[desktop]` cases in that run passed: :171 16.0 s, :115 21.4 s, :281 2.8 s, :297 1.2 s, :310 0.3 s, :214 20.3 s, :245 16.3 s (finishing 12:12:32Z to 12:12:48Z). On `master` `40feaa53` they read 13.6, 18.0, 2.2, 0.9, 0.3, 17.7, 14.6 s and :185 22.3 s.

### Attempt 2 of run 45815929555 (the R16 re-run of the failed job)
**Green.** Shard 3 job 139908135568 (started 12:26:11Z, ended 12:40:53Z, `591 passed (13.8m)`, 5 skipped, 0 failed, 0 flaky): `:185` [desktop] **passed attempt 1 in 19.0 s** (its siblings :171 10.3, :115 13.4, :214 14.1, :245 10.9 s). QA draw against shard 3 of `master` `40feaa53`: **0.80** over 431 tests (quartiles 0.72 to 0.89), a fast draw. Run 45815929555 is `success` at attempt 2 (fan-in `Stages 1 to 11` success 12:41:06Z). The re-run therefore shows the case passes on a fast draw (19.0 s) and fails on an ordinary one (30.9 s, 34.8 s): the near-budget picture, not a reproduction of a product fault. It is R16's one re-run for #780's head, and it does not close this Bug.

## Evidence (job logs, ANSI stripped; no secrets or personal data)
- **No designed delay or throttle on the path.** `step-up-service.ts` reserves an attempt on the person's `stepup` key (one atomic `INSERT ... ON CONFLICT` statement), checks the password with argon2id (memory 64 MiB, 3 passes, about 0.25 s by design, `password-hasher.ts`) and clears the key on success. A grep for `setTimeout`, `sleep`, `delay` and `jitter` in `src/server`, `src/lib/auth` and `src/app/api` finds nothing on the path. The limit is 5 failures then a 15-minute block, and a block answers **429 at once**, it never waits. The case adds one failure and clears the count at its end with the right password (`clearStepUpCount`, the 409 'hand over to self' answer after the step-up passes). Within this spec every case that makes a wrong password clears the count the same way (spec header).
- **Not a ruled wave (W1 (d) not met).** Shard 3 of the failing run against shard 3 of `master` push `40feaa53` (CI 45815890325, `591 passed (17.1m)`, the same hour): median per-test ratio **1.05** over 451 tests (quartiles 0.95 to 1.18); by window 1.00 to 1.07, and **1.14 (12:11Z) and 1.22 (12:12 to 12:14Z)** in the minutes of the failure. W1 (d) needs 1.4 and 1.3 in the first 4 minutes. The shard's total was 18.5 m against 17.1 m. (The run's other three shards passed on attempt 1.)
- **The case sits near the budget.** `[desktop]` readings of `:185` in shard 3 of the 73 completed CI runs of 25 Nov 07:57Z to 26 Nov 12:02Z (QA's scan of the shard logs): min 10.8 s, median 17.1 s, max 26.1 s; **four at 25 s or more** (25.0 on `master` push `ea966cc1`; 26.1 on PR #777's run 45782511281 (head 2f9dbc88), 25.6 on PR run 45803029288 (0e6f6b50), 25.3 on PR run 45807998055 (fd891aeb)); 26 of 73 at 20 s or more. A draw of 1.35 on the 22.3 s of `40feaa53` reads 30 s. No earlier flaky or failed reading of `:185` in those 73 logs or in the failed logs of the 19 red runs of the 80 latest CI runs. [mobile] and [tablet] readings were not read (other shards).
- **Bug-or-watch line (DL-267 (2)) and trigger (1) of the near-budget list:** a time-out-mode attempt-1 failure outside a ruled wave **and** at least three passing readings of 25 s or more in the same project is a Bug; a failure on both attempts with no open Bug covering the case is a Bug the same day. Both hold. DL-264 (2) names three SCR-14 axe cases for a same-day Bug on any attempt-1 failure; `:185` is not named there, so it is read under trigger (1) and the DL-267 line.
- **Where the time goes (a lead, not a finding).** The case opens `/users` (grown by earlier specs to hundreds of people, each drawn twice: the cause DL-275 found for DEF-053), opens the dialog, chooses, types, submits, waits for the 422, makes six assertions, scans the whole page with axe with the dialog open, and then makes the clean-up request. It is the longest case of the spec: its siblings without the axe scan and the clean-up read 14.6 to 21.4 s here, and `:185` adds 5 to 9 s to them.
- Nothing in the shard log shows a lock wait or a server error for the case; the log has no server-side line for the request. The transaction itself is proved by the integration test (`tests/integration/users/admin-handover.test.ts`), which this record does not touch.

## Suspected Area (leads, not findings; the fix is the developer's)
`tests/e2e/admin-handover.spec.ts`, the case at :185 and its helper `clearStepUpCount` (:108). Whether the final POST itself was slow (a throttle-row statement queued behind another worker, or the 64 MiB hash on a busy runner) or the 30 s were gone before it is the first question; the retry's `trace.zip` (artifact of shard 3, `test-results/admin-handover-AC-2-a-wron-5ea46--password-is-in-no-response-desktop-retry1/`) shows the timing of the retry only.

## Binding and proof (proposed; master sets it)
1. **Fix test-only** (developer, hardening window), unless the first question above finds the cause in the product. Keep every assertion, including the password absent from the response and the unchanged state; no timeout raised, no retry or skip added, no case quarantined. Split the case so each part reads under 25 s on attempt 1 (the DEF-085 precedent: one case into two): the 422 and the field state in one, the axe scan with the field state in the other, the clean-up in `afterEach` or at the end of whichever runs last. No new person made before `users.spec.ts:58` (DL-422: +0), and no case placed after it (DL-388 (D)).
2. **Proof:** on the fix PR's run of record and the first two `master` pushes after the squash, every `admin-handover.spec.ts` case at all three widths under 25 s on attempt 1, and no time-out. QA reads each from the job logs.
3. **Until then:** a first-attempt failure of `:185` is read under this Bug; R16 allows one re-run per head (used on #780); a `master` push is never re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Cause found | developer | | |
| Fixed | developer | | |
| Regression test | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-485 and GitHub issue #792, created 2026-11-26 and cross-linked. Related: STORY-01.09 (AQP-356), DEF-053 (AQP-383, the `/users` list growth), DEF-085, DEF-088, RISK-031; DL-264 (2), DL-265 (W1), DL-267 (2), DL-275, DL-388 (D), DL-422; test plan 0.3.75; CI run 45815929555 (attempt 1 red, attempt 2 the R16 re-run), shard 3 job 139895530212.
