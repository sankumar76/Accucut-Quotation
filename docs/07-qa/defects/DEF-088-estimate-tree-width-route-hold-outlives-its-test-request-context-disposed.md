# DEF-088: `estimate-tree-width.spec.ts:534`'s route hold outlives its test: an unhandled `route.fetch: Request context disposed` is thrown 0.15 s after the test passed, aborts the shard-4 desktop worker and leaves the next test (`estimate-warning.spec.ts:181`) not run (Test; product excluded; Sev-3; Jira AQP-444, GitHub #732)

| Field | Value |
|-------|-------|
| Story / AC | AQP-426 (STORY-CR01.3E, the resizable parts tree, PR #727, squash `0244e930`): the spec is `tests/e2e/estimate-tree-width.spec.ts`, its case at :534 is 'DEF-085, DL-391: when the code of the controls cannot be fetched the page works, the width is the stored one and no error is shown'. **No AC fails:** the case passed; the error is thrown after it, from its own route callback. |
| Severity | **Sev-3 Moderate (master, DL-399 (B), 2026-11-25); QA recorded it as given.** The severity follows the scale: it aborts a worker and can turn a shard red, but it has a test-only fix. |
| Priority | P3 (Jira Medium, labels `sev-3`, `final-review`) |
| Type | **Test; product excluded** (master, DL-399 (B)): the throw comes from test code (the spec's route callback) after its own test ended, and no product path is involved. |
| Status | **Open (new), 2026-11-25 (qa-engineer, on DL-399 (B)).** First occurrence on record. **R17** covers PR runs only until the fix merges or G8 (below). A `master` push turned red by this before the fix is RISK-031 trigger (a) and comes to master the same day; it is not a DEF-085 take-out event (DL-399 (4)). |
| Jira / GitHub | [AQP-444](https://sankumar76.atlassian.net/browse/AQP-444) / [#732](https://github.com/sankumar76/Accucut-Quotation/issues/732) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-088, agent-qa-engineer). Relates to AQP-426 and AQP-1; DEF-085 (AQP-441) is the neighbour. Searched first: JQL on `aiid-DEF-088` and 'Request context disposed', and a GitHub search: nothing. |
| Found by / date | CI (a PR run); read and logged by qa-engineer, 2026-11-25; classified by master, DL-399 |
| Build / commit | PR #730's head `53dcd588` (DEF-087; it changes only `deploy/windows/AccucutOps.psm1`, the README and the Pester tests, so it cannot reach E2E), which holds #727 (`0244e930`) |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 4 of 4)`, Playwright Chromium, project `desktop`, production build, 4 workers. Run 45631761004 (`pull_request`, attempt 1, created 14:13:46Z), shard 4 job 139266549077 (14:13:49Z to 14:28:25Z). |

## Steps to Reproduce
Not on demand; it needs the case's held `/_next/static/chunks/` request to be answered after the page and context have closed.
1. Run `tests/e2e/estimate-tree-width.spec.ts:534` [desktop] on a runner where the held chunk request is still pending when the test ends.
2. Read the error that follows the passing line.

## Expected Result
No route callback of a test calls `route.fetch`, `continue` or `fulfill` after its page or context has closed; no unhandled error appears after a passing test; the worker's next tests run.

## Actual Result
Shard 4: `22 skipped`, `1 did not run`, `569 passed (13.7m)`, `1 error was not a part of any test, see above for details`; the step failed. `✓ 129 [desktop] estimate-tree-width.spec.ts:534` passed at **14:20:40.599Z** (11.8 s). At **14:20:40.745Z**, 0.15 s later, an unhandled `Error: "route.fetch: Request context disposed.` ... `" while running route callback. Consider awaiting await page.unrouteAll({ behavior: 'ignoreErrors' })` was thrown. The call log is `GET http://localhost:3100/_next/static/chunks/src_20n_eq19c4i0l._.js` with `referer: http://localhost:3100/estimates/Q-9999-4113597198`. **`estimate-warning.spec.ts:181` [desktop] (no. 132) did not run** (the worker was aborted). Shards 1 to 3 and `Stages 1 to 11b` `success`; the Windows package run 45631760935 `success`.

## Evidence (job log, ANSI stripped; no secrets or personal data)
- **QA draw** (matched per-test median, shard 4 against 31015cce's shard 4): **0.68** over 501 tests, quartiles 0.61 to 0.79: a fast draw, so this is not a slow-shard effect.
- **The same spec's other desktop cases in that run** (attempt 1): `:129` 6.6 s, `:248` 5.1 s, `:308` 4.3 s, `:339` 9.3 s, `:410` 9.3 s, `:424` 9.8 s, `:435` 12.1 s, `:456` 5.2 s, `:497` 10.1 s, `:534` 11.8 s: all under 25 s, in order, finishing at 14:19:23Z to 14:20:40Z.
- `tests/e2e/support/tree-width.ts` has one importer, `estimate-tree-width.spec.ts` (`git grep`, master, DL-399 (1)).
- `master` push `0244e930` (CI 45611772700) was clean (test plan 0.3.60): the error did not occur on it.

## Suspected Area (leads, not findings; the fix is the developer's)
`tests/e2e/estimate-tree-width.spec.ts` (the case at :534 and its route hold) and `tests/e2e/support/tree-width.ts` (the hold helper). The hold answers a held request with `route.fetch` once released; if the test has ended and its page and context are closed, `route.fetch` throws. Playwright's own hint in the message is `page.unrouteAll({ behavior: 'ignoreErrors' })`; master's ruling prefers releasing the hold before the test ends (`behavior: 'wait'`) or ending the handler when the page closes, and ignoring only the disposed-context case, by its exact text.

## Binding and proof (master, DL-399; QA reads it)
1. **Fix:** lane 1, by #727's author, **test-only**, in `estimate-tree-width.spec.ts` and `tests/e2e/support/tree-width.ts`. The support file has a single importer, so changing it does not engage the `tests/e2e/support/**` binding of DL-370 (5); the PR body states that importer. No route callback may call `route.fetch`, `continue` or `fulfill` after its test's page or context has closed. Never swallow every error: only the disposed-context case may be ignored, by its exact text. Every assertion kept; no budget, retry or skip change; the DL-386 and DL-388 (D) statements restated (the spec still sorts before `users.spec.ts`, no case after it). The PR body shows a local run of a variant that closes the page while the chunk is held, with no unhandled error, then reverted.
2. **Proof:** on the fix PR's run of record and on the first two `master` pushes after the squash: **0 'error not part of any test' and 0 'Request context disposed' lines in any shard, and every `estimate-tree-width` case attempt 1 under 25 s.** QA reads each from the job logs, with durations and shard minutes.
3. **Cut-offs (DL-370 (E)):** start by the end of Mon 30 Nov, merge by the end of Wed 2 Dec; if it misses them it comes to master before the freeze. In the final regression a DEF-088 abort is a red outside DL-369's branch, so it would go to the delivery lead the same day.
4. **R17 (new; PR runs only, until the fix merges or G8):** one re-run of the failed shard jobs, once per head, with the head 0 behind, only if every failure is this signature: an unhandled `route.fetch: Request context disposed` whose call log is a request from `estimate-tree-width.spec.ts`'s route hold (a `/_next/static/chunks/` GET with an `/estimates/` referer), plus tests marked 'did not run' in the same worker. R10, R16 and R17 together give one re-run in total per head. `master` pushes are never re-run. Each re-run is listed. **#730 may take that re-run now** (DL-399 (A)); its green is #730's run of record.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fix (test-only; hold released before the test ends) | developer (#727's author) | | |
| PR body: the importer, the DL-386 and DL-388 (D) statements, the local close-the-page variant | developer | | |
| Proof: fix PR run of record | qa-engineer | | |
| Proof: first `master` push after the squash | qa-engineer | | |
| Proof: second `master` push after the squash | qa-engineer | | |
| Closed | qa-engineer | | |

## Records
Jira Bug AQP-444 and GitHub issue #732, created 2026-11-25 and cross-linked. Related: AQP-426, AQP-1, DEF-085 (AQP-441, #725), DEF-087 (the PR that carried the red); DL-399 (master's ruling), DL-398, DL-391, DL-386, DL-388 (D), DL-370 (5) and (E); test plan 0.3.62; CI run 45631761004 (attempt 1 red, attempt 2 the R17 re-run), shard 4 job 139266549077.
