# DEF-036: `customers.spec.ts:175` is flaky on the E2E dev server (`apiRequestContext.post: read ECONNRESET` beside "The destination stream errored while writing data", digest 3305231884)

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.02 (AQP-142, Done, `0ca47df`): the suite `tests/e2e/customers.spec.ts` / none of AC-1 to AC-8 fails; raised against AQP-276's AC-6 ("0 flaky") reading, DL-203 (4). Test strategy flaky-test policy (quarantine with a ticket within a day) |
| Severity | **Sev-3 Moderate, graded by qa-engineer** on the test-plan scale (section 6, DL-094): a flaky test is a Test-type defect; it fails closed (a second failure turns the run red), the workaround is the one allowed retry, and the evidence is one client-side occurrence. Master's view in DL-203 (6) is the same. It becomes a product defect and is re-graded if the investigation finds a product path for the server error |
| Priority | P3 (Jira AQP-290 Medium, label `sev-3`). Fixed before G8 (DL-203 (6)); root cause posted before AQP-276's G7 |
| Type | **Test** (E2E against the `next dev` server on `DEV_PORT` 3100); pre-existing on `master` since AQP-142's merge. The server half may be a runtime issue |
| Status | New (investigation: developer, not AQP-276's while T6 runs; fix: `fix/AQP-290-<slug>` PR from `master`, outside any measure window) |
| Jira / GitHub | [AQP-290](https://sankumar76.atlassian.net/browse/AQP-290) / [#364](https://github.com/sankumar76/Accucut-Quotation/issues/364); relates to AQP-142 and AQP-276 |
| Found by / date | First seen in CI run 43342625012 (AQP-276 T6, head attempt 3, job 131625693705) at 2026-11-13 01:39:47Z, read by master (DL-203); opened by qa-engineer, 2026-11-13 (inside the one-day line of 01:39Z on 2026-11-14) |
| Build / commit | AQP-276 H_m `eff79fe`, merge ref `c699ba8` into `e76b513` (`master`); the test is AQP-142's, on `master` as `0ca47df` |
| Environment | GitHub Actions `ubuntu-latest`, 4 workers per shard, shard 3 of 4, the `next dev` server on port 3100 and the production build on 3101, throwaway PostgreSQL; invented data only |

## Steps to Reproduce
Not reproducible on demand: one occurrence in CI. What happened:
1. AQP-276's T6 measure re-ran "all jobs" of head run 43342625012; attempt 3, shard 3 of 4, job **131625693705**.
2. At 01:39:47.055Z the log has `[WebServer] ⨯ Error: The destination stream errored while writing data.` with `digest: '3305231884'`.
3. At 01:39:47.286Z `tests/e2e/customers.spec.ts:175:3` [desktop] ("AC-2, AC-8: the customer's page shows the details…") failed after 6.5 s at `tests/e2e/support/customers.ts:52` (`makeCustomer`), called from `customers.spec.ts:194` (the DEF-031 long-name step).

## Expected Result
`POST http://localhost:3100/api/v1/customers` answers 201 (or the server logs no stream error while the edit-page and reset tests run). A test that passes only on its one retry is reported as flaky, not green.

## Actual Result
`apiRequestContext.post: read ECONNRESET` for the `POST http://localhost:3100/api/v1/customers`; the test passed on `retry #1` (13.4 s). Summary of the job: `1 flaky`, `2 skipped`, `223 passed`. `playwright.config.ts:65` has `retries: 1`.

## Evidence
- Job 131625693705, run 43342625012 attempt 3 (merge ref `c699ba8`), lines as above; DL-203 (1) (master, read-only).
- **Scope, master's scan (DL-203 (2)):** 238 E2E job logs of 65 CI runs created 2026-11-12 10:29Z to 2026-11-13 01:25Z. The server error with the same digest appears 64 times in 21 run-attempts; **every scanned run-attempt whose tree holds AQP-142's customers suite shows it, and none without it**, including `master` at three shards (base run 43342511688 attempts 1 to 3; 0ca47df's push run 43339039704; #297's runs on e38db93 and 8506a96). It falls during `customers.spec.ts`'s edit-page and reset tests (`:203`, `:238`, `:295`, `:321`), 1 to 3 lines per job, and no test fails. **ECONNRESET appears in one log only (this job).**
- **Not caused by AQP-276:** its diff is `ci.yml`, `ci-workflow.test.ts`, `ci-workflow-shards.test.ts`; none touches the test, its helper or a server file. The fourth shard does not change what one runner does; it changes which tests share it.
- **Earlier, a local note only:** a local `apiRequestContext.get: read ECONNRESET` against the dev server in QA's AQP-274 run (`docs/07-qa/AQP-274-test-report.md:58`), on a machine under memory pressure: context, not CI evidence.
- **Unrelated note for the record (DL-203 (2)):** one other `1 flaky` line, on AQP-81's control run 43259492436 (79e285c, a tree without AQP-142): `masters-dialog-opener.spec.ts:82` [desktop], **with no server error** and a different test. It is not DEF-036's signature. QA records it here as a note and does not open a separate defect on one occurrence; a second occurrence of it opens its own defect.

## DEF-036's signature (DL-203 (4))
An `apiRequestContext` call failing with ECONNRESET against the dev server, in or beside the `digest '3305231884'` server error. Until the fix, a CI reader names a `customers.spec.ts` ECONNRESET retry as DEF-036 and does not count it as new. AQP-276's AC-6 reading (DL-203 (4)): the signature must not recur in 2 or more of the head's five samples while it is in none of the base's five.

## Suspected Area (optional)
The investigation (developer, DL-203 (6)): (a) why the dev server logs `destination stream errored` (digest 3305231884) during the customers edit-page tests, and whether `next start` on 3101 shows it too; (b) why a concurrent `page.request.post` gets ECONNRESET. QA's first reading, not a finding: the `POST /api/v1/customers` came from a test that had just made many requests and navigations (the long-name step opens the list and the customer page); a page navigation that aborts a streaming response while a request from the same context is in flight would produce both lines. Read-only logs and local runs only; **no throwaway PR or CI run inside the T6 window.** The fix may not add a retry, widen a timeout, quarantine, or move the test to one width (DL-057, test strategy 10.5 item 1).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Root cause posted on AQP-290 | developer | | before AQP-276's G7 |
| Fixed | developer | | `fix/AQP-290-<slug>`, before G8 |
| Regression test added | developer | | |
| Verified | qa-engineer | | by name in the fix PR's CI and the next `master` push run |

## Severity history and routing
- Master, DL-203 (6): opened by QA at the latest by 2026-11-14 01:39Z; severity is QA's on the test-plan scale; master's view is Sev-3, type Test, fails closed and pre-existing (the DL-120 / DL-132 pattern), unless the investigation finds a product path.
- QA graded Sev-3, type Test, 2026-11-13, for the reasons in the table. It does not hold AQP-142 (Done) or AQP-276's G7 by itself; DL-203 (4)(iii) is the recurrence line.
