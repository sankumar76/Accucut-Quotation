# DEF-064: `daily-digest.test.ts` (Stage 11): "Mailpit answered 404 for GET /api/v1/message/<id>" thrown in `mail-capture.ts` `mailpitJson` (shared-inbox race; second occurrence, on `master` push 45110218895; type Test)

| Field | Value |
|-------|-------|
| Story / AC | The daily-digest job (story ID not looked up by QA), `tests/integration/jobs/daily-digest.test.ts` AC-5 (first occurrence) and AC-8 "deactivated people" (second). **No AC is shown to fail**: the read of the test mailbox threw before any count was compared |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, DL-305 (C)/(5)) |
| Priority | P3. Lane: hardening window; the developer owns the fix (test-only). Does not block G8 as a Sev-3, but it turned a `master` push run red at Stage 11 (see Evidence) |
| Type | **Test** (master's reading in DL-305 (A): a pre-existing harness race on the shared Mailpit inbox; not the product) |
| Status | **Open** (logged 2026-11-23) |
| Jira / GitHub | [AQP-412](https://sankumar76.atlassian.net/browse/AQP-412) / [#639](https://github.com/sankumar76/Accucut-Quotation/issues/639). Jira "relates to" AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-064`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. The number DEF-064 was reserved for this case by DL-305 (JQL `labels in ("aiid-DEF-064","aiid-DEF-069")` found no issue before the two were created) |
| Risk / rule | The trigger of DL-305 (5) is met: a second occurrence of the signature, on any run, opens this Bug the same day. **Rule R13** (PR runs, once per head, the exact error text) does not name a `master` push run; QA asks for no re-run and has done none. Not a RISK-031 trigger (b) event as far as QA can tell (the Stage 11 failure is a harness error and the push run's four E2E shards are green); master counts it. |
| Found by / date | CI (`master` push); logged by qa-engineer, 2026-11-23 |
| Build / commit | `master` d2771045 (the squash of #633), push run 45110218895 |
| Environment | GitHub Actions, `Stages 1 to 11b`, Stage 11 (Vitest integration tests against PostgreSQL, with the Mailpit service container); invented data only |

## Steps to Reproduce
Not reproducible on demand (a timing race on a shared inbox; no local integration run, CLAUDE.md section 9 item 5). Mechanism as master read it (DL-305 (2), code read at dbc1bb2b and `master`): `list()` in `tests/support/mail-capture.ts` fetches `/api/v1/messages?limit=500` and then GETs each message by ID, one at a time; three other integration files delete the whole shared inbox (`DELETE /api/v1/messages`) in their `beforeAll` (`mail/outbox-send.test.ts:108`, `settings/alerts-settings.test.ts:77`, `tasks/assign-email.test.ts:118`); a delete that lands between the list and one GET makes that GET answer 404.

## Expected Result
`mailsWith` returns the messages that match the test's own marker, whatever other files do to the shared inbox.

## Actual Result
`Error: Mailpit answered 404 for GET /api/v1/message/0Jy9yX48YO4a6zd8aN202o` from `mailpitJson` (mail-capture.ts:68), called by `Object.list` (mail-capture.ts:82), `mailsWith` (daily-digest.test.ts:75) and the test at daily-digest.test.ts:379.

## Evidence
| # | Run | Where | Test | Result |
|---|-----|-------|------|--------|
| 1 | PR #624 run 45040682212, head dbc1bb2b (22 Nov) | job 137264206116 | AC-5 "after a failed run, the next start-up repeats the digest and sends it once", :281 | `Test Files 1 failed, 629 passed (630)` (master, DL-305). Did not recur on the same PR's next full run 45095763323 |
| 2 | **`master` push run 45110218895**, head d2771045 (23 Nov, Stage 11 log ends 04:17:21Z) | job **137480623515** (`Stages 1 to 11b`) | AC-8: deactivated people > "a deactivated assigner is left off the Cc, and their task stays in the table", :379 | `Test Files 1 failed \| 636 passed (637)`, `Tests 1 failed \| 16219 passed (16220)`; Stage 6 (unit) `473 passed`, `10603 passed`; the Stage 11 step failed (`Process completed with exit code 1`), so "Stage 11: coverage of changed code" and "Stage 11b: JS budget" were skipped |

QA read the log through `gh api --allow-escape-sequences repos/sankumar76/Accucut-Quotation/actions/jobs/137480623515/logs` while the run was still open (its four Stage 12 shards were in progress; `gh run view --log-failed` refuses an open run). The run finished later the same day: **`failure`** (the fan-in `Stages 1 to 11` red on `RESULT_VERIFY: failure`), with **all four Stage 12 shards success, 0 flaky** (`548 passed (20.5m)`, `542 (14.8m)`, `545 (14.8m)`, `529 (18.0m)`); the Windows package run 45110218896 is `success`. So the only red job of the `master` push is this Stage 11 failure. **The product is not in question:** the throw is in the test harness before any value was compared, #633 changes no mail or digest file, and the same head's PR run 45103803921 passed Stage 11 with `16220 passed`.

**Different test, different line, same helper and signature.** The first occurrence was AC-5 (:281), this one AC-8 (:379): both reach the 404 through `mailsWith` -> `list` -> `mailpitJson`. That points to the helper and the shared inbox (DL-305 (2)), not to one test. QA did not check which file was running a whole-inbox delete at that moment (the integration log is not timestamped per test).

## Suspected Area
`tests/support/mail-capture.ts` `list()` (:82) and the `beforeAll` deletes of the three files named above.

## Fix route (developer; test-only; DL-305 (5))
No test deletes the whole shared inbox (each file removes only its own messages, or each run uses its own marker and a per-file search), and no "skip a 404" alone (that would hide a real missing mail). Proof: the integration stage with the three files and `daily-digest` run together passes repeatedly; the 404 signature does not recur on the fix PR run and the next `master` push.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## For master
- The `master` push run on d2771045 is red at Stage 11 on this signature. Whether it is re-run (R13 names PR runs only), and how it counts for the 23 Nov RISK-031 trigger (b) ledger, is master's call; QA has not re-run anything.
- QA did not scan the earlier failed runs again for this signature (master's scan of DL-305 covered 40 runs back to 20 Nov 16:04Z).
