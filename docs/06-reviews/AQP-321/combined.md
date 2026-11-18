# Combined security-and-quality review: AQP-321 (STORY-06.04 "Recalculate and the cleared figures")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/437 |
| Head reviewed | `77c5f8edc527945e783099d68850b5af44dde5f5` (base `master` 538489a, the merge base) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`: it writes immutable calculation records through Recalculate and decides when figures show or clear (NFR-002, FR-061, FR-100) |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-15 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 4 · Info 6 |

## How I read it

- The whole `src/` diff (13 files, 540 lines) and every test file in the PR. The PR description, including "Points for the reviewer" 1 to 6, assumptions 1 to 4 and the Stage 11b table.
- Full files at the head, from a detached worktree in my scratchpad: `calculation-service.ts` (`store`, `checkedPartsOf`, `warningsToAcknowledge`, `submit`, `press`), `estimate-service.ts` (`applyTransition`, `lockForChange`), `state-machine.ts`, `with-route.ts` (CSRF, role, body), the calculate, costs and recalculate routes, `api-client.ts` (`sendJson`, `refusalFrom`), `recalculate-client.ts`, `recalculate-button.tsx`, `review-actions.tsx`, `figure-tiles.tsx`, `review-texts.ts`, `cost-details-texts.ts`, `notice.tsx`, `save-gate.ts`, `errors.ts` and `calculate-words.ts`.
- Jira AQP-321: AC-1 to AC-10, the product-owner change note, Dev Context and Testing notes.
- Architecture v0.49: §4.2 (the sequence and the snapshot block for #432 / DL-225), §4.3 (warning), §4.4 (state machine), §4.8 (cleared figures, unlock), §6 row "Recalculate" (line 962), A-08 and A-26. UX spec v0.29: SCR-06 states, "SCR-06 interim and final words" and "SCR-07 final words". AQP-317, AQP-319 and AQP-320 `combined.md`, for continuity and format.
- **Tests run by me at the head:** (1) 9 targeted unit files (`recalculate-route`, `recalculate-client`, `estimate-review-screen`, `estimate-review-architecture`, `cost-details-screen`, `cost-details-page`, `canary-scan-gate`, `estimate-page`, `http-route-manifest`): **148 of 148 pass**. (2) The 16 files of `tests/security` (`role-matrix`, `engineer-refused-before-lookup`, `csrf`, `strict-schema`, `engineer-import-rule`, `manifest-completeness`, `route-recipes` and the rest): **1,954 of 1,954 pass**.
- I did not run Playwright, `next build`, Docker or the PostgreSQL integration tests (as briefed). CI on this head is run 43739777977, attempt 2: **6 of 6 green** (the orchestrator's report). Attempt 1 failed only on the known flaky `tests/integration/estimates/material-race.test.ts`, which this PR does not touch.

## Security and data-integrity scope: results

| # | Check | Result |
|---|---|---|
| 1a | One calculation path | **Verified.** `calculate` and `recalculate` both call `press(event, …)`, which runs the same `submit` in one `transactions.run`. The two differ only in the event (`CALCULATE` or `RECALCULATE`) and in what they return (`calculation-service.ts:446-469`). `store` (the snapshot write) is untouched. `tests/integration/calc/recalculate.test.ts` "one path for both presses" stores an Engineer's and a Lead's record from the same inputs and asserts they are equal to the last digit. |
| 1b | Locking and revisions | **Verified.** `flow.transition` → `applyTransition` takes `lockEstimate` (row lock) first, then `submit` and `store` lock the same row again in the same transaction (re-entrant in PostgreSQL). Every input writer goes through `lockForChange` on the same row, so a save and a press are serialised. `submit` reads `inputsRevision` and the nodes under that lock, and `store` writes the record with the revision it read, so a record can never claim a revision whose inputs it did not read. Two presses at once give two records and both succeed (`cleared.test.ts:254`). The race test itself is weak (SQR-02), but the code is right. |
| 1c | Immutability | **Verified.** Every press calls `insertCalculation`. Nothing updates or deletes a record. `linkCalculation` moves only the estimate's pointer, and the old record stays (database trigger, ADR-007). `recalculate-route.test.ts:139`: a press on figures that are already current makes another record and changes no input. |
| 1d | All or nothing | **Verified.** The status move DRAFT → SUBMITTED happens inside the transaction, before the checks. A 422 `CALCULATE_BLOCKED`, a 409 (no parts, no customer, `CALCULATE_ACK_REQUIRED`) or any later error rolls it back. Tests: `recalculate-route.test.ts:160` ("a Draft stays a Draft") and `cleared.test.ts:230` (status and link as they were). |
| 1e | SaveGate | **Not applicable on SCR-06 yet.** SCR-06 has no input form, so nothing can be in flight when Recalculate is pressed there. A Lead editing in another tab is serialised by the row lock (1b). When a story adds the input form to SCR-06, the button must `settle()` the gate first, as the Engineer's `use-calculate.ts` does (SQR-08). |
| 2a | Role | **Verified.** The manifest row is `ADMIN_AND_LEAD` (`route-manifest.ts:278`), so `withRoute` refuses an Engineer with the fixed 403 before `params` is parsed. The machine refuses again (`EVENT_ROLES.RECALCULATE = ['LEAD','ADMIN']`, and an Engineer gets `NotFoundError`). Tests: `recalculate-route.test.ts:218` (403 body scanned, nothing written), the manifest-driven role matrix and refused-before-lookup (both green in my run), and `estimate-cleared.spec.ts:159`. |
| 2b | CSRF | **Verified.** POST is state-changing, so `withRoute` checks same-origin first (`with-route.ts:200`). `csrf.test.ts` covers every manifest row (green). |
| 2c | State | **Verified.** APPROVED → 409 `ESTIMATE_APPROVED_IS_LOCKED`, written by the machine, with `store`'s check as a second guard. DRAFT → SUBMITTED, and SUBMITTED stays SUBMITTED. Test: `recalculate-route.test.ts:148`, `cleared.test.ts:221`. Note SQR-08: a Lead's Calculate on a never-calculated Draft submits the Engineer's Draft, by design (A-08). |
| 2d | Body | **Verified.** The same `calculateBodySchema` as Calculate, with `optionalBody` and `badBodyIs400`. Test: `recalculate-route.test.ts:202`. |
| 3a | NFR-002: the Engineer | **Nothing new reaches an Engineer.** The route is not in any Engineer list. The button is a client file that holds no figure and imports no schema, service or calculation code, and its request code is a bare `import()` (pinned by `estimate-review-architecture.test.ts`). Labels reach it only as props, from the review, which loads only on the Lead's and the Admin's branch. |
| 3b | NFR-002: the answer | **Verified.** `costsSchema` is strict. The route reads the costs view through `getCosts` (figure state) after the write, and the service returns nothing. The client keeps only `state === 'current'` (`recalculate-client.ts:15`). |
| 3c | Canary scan | **Covers the new route.** Two new E2E tests: the Lead's answer and the page after it contain the record's figures (a positive control) and no master value, rate name or formula, the cleared page and the cleared `/costs` contain no figure, and a value planted in `/recalculate` is found. The Engineer's 403 on this route is covered by the manifest-driven scan (`route-calls.ts` recipe, `spec-access.ts` row), not by the new test, whose title says it is (SQR-09). |
| 4 | Cleared versus current | **Verified.** `figure-state.ts` stays the only reader (the architecture test "every read of a figure goes through figure-state" is green). The route answers through `getCosts`, and the page redraws through `router.refresh()`, so no figure passes through browser state. Cleared pages hold no figure (unit, integration, canary). After a good press, the E2E test sees the figures, the Calculated line and the table come back, with focus on `#review-calculated`. |
| 5 | AC-10 against ux-spec v0.29 | **Exact match, every row.** See the table below. **#430 and #436 can both close.** |
| 6 | Snapshot (DL-225 / #432) | **No conflict.** `store`, `readMasters` and `master_snapshot` are untouched. Both presses use the same `store`, so when #432 filters the rates it applies to Calculate and Recalculate alike. This PR adds no reader of `rates`. |
| 7 | JS budget (Stage 11b) | **Within the rule.** The PR body records 180,895 B gzip, headroom **19,105 B** (CI run 43739777977, attempt 2, job 132894912355, head 77c5f8ed). That is +460 B against master's 180,435 B, close to the local estimate, and well above the 10,000 B floor. |

### AC-10: every interim line, word for word

| Place (ux-spec v0.29 table) | Final words required | At the head | Result |
|---|---|---|---|
| Not-calculated notice | `The Engineer has not calculated this estimate yet. Press Calculate to see costs.` | `review-texts.ts:33`, identical | Match |
| Cleared notice, body (title unchanged) | `Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.` | `CLEARED_NOTICE_BODY`, identical. Title unchanged | Match |
| BL tile line when cleared | `An input changed, so every calculated figure is cleared. Press Recalculate to see them again.` | `BL_CLEARED_HINT`, identical (new: assumption 1) | Match |
| Tree line when cleared (`TREE_CLEARED_LINE`) | `Every calculated figure is cleared because an input changed. Press Recalculate to see them again.` | `review-texts.ts:43`, identical | Match |
| BO tile line when cleared | `You set it when you approve, after Recalculate.` | `APPROVED_NOT_SET_CLEARED_HINT`, identical | Match |
| Approve, disabled reason, not calculated | `Calculate first. Approving is available once the figures have been calculated.` | `review-texts.ts:73` | Match |
| Approve, disabled reason, cleared | `Recalculate first. Approving is available once the figures have been calculated again.` | `review-texts.ts:74` | Match |
| Download, disabled reason | `Calculate or Recalculate first. There is no file until a calculation is current.` | `review-texts.ts:76` | Match |
| The disabled Calculate or Recalculate button | removed: the button is live | `CALCULATE_NOT_YET_REASON` and its `Reason` deleted; the button is enabled | Match |
| SCR-07 cleared title, body and link | `Cleared. Press Recalculate`; `An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.`; `Go to the estimate to Recalculate` | `cost-details-texts.ts:24-25`, `:31-32`, identical | Match |
| SCR-07 not-calculated link | `Go to the estimate to Calculate` | `GO_TO_ESTIMATE_TO_CALCULATE`, identical | Match |
| SCR-07 working sentence (#436 item 1) | the v0.29 sentence | `RULES_WORKING`, already on master from AQP-320, identical | Match |

**#430** (the interim not-calculated words) is superseded by AC-10's final words, which are shipped. **#436** (SCR-07 interim words and the working sentence) is fully carried: item 1 by AQP-320, and items 2 and 3 are replaced by the final words here. Both can close when this PR merges ("Closes #430 and #436" is in the PR body).

## AC conformance

| AC | Implemented in | Tests | Result |
|---|---|---|---|
| AC-1 Cleared on any input change; counts stay; table hidden; server omits values | Existing figure state; `figure-tiles.tsx` (BL line); `estimate-review.tsx` (table only while `current`) | `cleared.test.ts:122` (9 writers, each read straight after, Recalculate brings it back), `recalculate-route.test.ts:246`, screen test | **Pass** |
| AC-2 No-change save stays current; changed and back is two changes | Revision rule of 05.08 | `cleared.test.ts:168-189`, `recalculate-route.test.ts:257` | **Pass** |
| AC-3 Same checks; new record in the Lead's name; status rule; `current`; costs view; Engineer 403 | `calculation-service.ts` `recalculate`/`press`/`submit`; `recalculate/route.ts`; manifest row | `recalculate-route.test.ts` (18 tests), `recalculate.test.ts`, `cleared.test.ts:191-240`, role matrix | **Pass** (the "state becomes current" half has a race edge, SQR-01) |
| AC-4 BO stays | No approval storage yet (06.06); BO is fixed text and is not read through the figure state | none possible | **Not testable in this story; accepted** (SQR-07) |
| AC-5 Cleared notice, Recalculate primary, Approve and Download disabled with reasons | `review-actions.tsx`, `recalculate-button.tsx`, `review-texts.ts` | `estimate-review-screen.test.ts`, `estimate-cleared.spec.ts:51` | **Pass** |
| AC-6 Unlock alone changes no input | No change needed | `cleared.test.ts:243`, `recalculate-route.test.ts:266` | **Pass** |
| AC-7 Engineer carries no state or value; canary green | Manifest row Admin and Lead; strict `costsSchema`; architecture pin on the button | Canary (2 new), role matrix, refused-before-lookup, `recalculate-route.test.ts:218/236`, `estimate-cleared.spec.ts:159` | **Pass** |
| AC-8 500 nodes under 2 s p95 | Same path as Calculate | `recalculate.test.ts:31` (a loose 5 s bound; the measure is printed); p95 is the on-demand `tests/perf/calc-500-nodes.test.ts` | **Pass**, on the same terms as AQP-317 |
| AC-9 360/768/1366, axe 0, `role="status"`, tile skeleton | `figure-tiles.tsx` (CSS `group-has-[[aria-busy=true]]/review`), `recalculate-button.tsx` | `estimate-cleared.spec.ts:73`, `:137` (busy, polite line, 3 skeletons visible) | **Pass** (CI green) |
| AC-10 Final words | See the AC-10 table | `estimate-review-screen.test.ts`, `cost-details-screen.test.ts`, `cost-details-page.test.ts`, `estimate-review.spec.ts`, `cost-details.spec.ts` | **Pass** |

## The developer's assumptions

| Assumption | Judgement |
|---|---|
| 1. The BL tile cleared line is added | **Correct, not an assumption.** The ux-spec v0.29 table has a row "BL tile line when cleared", and the build's words match its final column exactly. |
| 2. A Lead with a 0 in QTY per Assy sees only the server's sentence until 06.10 | **Accepted for this story.** Jira puts the Lead's warning dialog (06.10) out of scope. The 409 is shown in the server's own words in a `role="alert"` notice, and nothing is written (`estimate-cleared.spec.ts:120`). **Consequence:** until 06.10, a Lead cannot bring a cleared estimate with a 0 in H back to `current`, so once 06.05 lands it cannot be approved. 06.10 must merge before G8 (SQR-06). |
| 3. The failure text drops the ux-spec "reference" clause | **Accepted.** `refusalFrom` turns every 5xx into `failed` and drops the body (`api-client.ts:59`), so the screen has no request ID to show. **But** the sentence's "Nothing was changed" can be false (SQR-01). ux-expert should rule on both halves of the SCR-06 Error row together. |
| 4. After a good press, focus moves to the "Calculated …" line | **Accepted.** The button unmounts, so focus would otherwise be lost. `tabIndex={-1}` is on the target, and the E2E test asserts `toBeFocused()` (`estimate-cleared.spec.ts:97`). |

## Findings

| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|---|---|---|---|---|---|---|
| SQR-01 | Minor | `src/components/features/estimate-review/review-texts.ts:72`; `src/components/features/estimate-recalculate/recalculate-button.tsx:69`; `src/app/api/v1/estimates/[id]/recalculate/route.ts:28-29`; `src/lib/estimates/recalculate-client.ts:15` | The failure line says `Nothing was changed.`, but there are three ways to see it after the press **committed**. (a) The answer was lost on the network. (b) `getCosts` failed after the commit (5xx). (c) A save landed between the press's commit and the route's costs read. The press and the read are two transactions, so the route answers 200 with `state: 'out-of-date'`, which `toCurrent` treats as `failed`. In (c) the button stays on screen with the sentence, while a new record exists and a Draft has become Submitted (the badge changes on refresh). The words come from the SCR-06 Error row, but they break the ux-spec §6.0 rule (v0.21): "a failed write never claims 'Nothing was changed', because the answer may have been lost after the server committed". | A Lead is told something false in a rare race, or after a lost answer. Data is correct, and the refresh shows the truth. No NFR-002 impact. | **ux-expert:** reword the SCR-06 Error row to follow §6.0, for example `We could not confirm the calculation. Check the figures below and try again.` **developer:** then change `CALCULATE_FAILED`. Optionally, for (c), the route can tell "the press worked, but an input changed since" apart from a failure: read the costs view in the press's transaction, or return `ok` on any 200 that passes the schema and let the refresh show the state. | A client test: a 200 with `state: 'out-of-date'` → the outcome shown is not "Nothing was changed". |
| SQR-02 | Minor | `tests/integration/estimates/cleared.test.ts:263-270` | The "save racing a Recalculate" test is a tautology. `figure-state` *defines* `current` as `calculation.inputs_revision === estimates.inputs_revision`, so `expect(state).toBe(calculation === inputs ? 'current' : 'out-of-date')` holds whatever the lock does. `Promise.allSettled` also lets the test pass if either call failed. It does not prove PR point 2 ("a record is never marked current for inputs it did not read"). | A future change that drops the lock from one path (for example a save outside `lockForChange`) would still pass. The code is correct today (see check 1b). | Assert both calls are `fulfilled`. Assert that the linked record's `inputs_revision` is ≤ the estimate's, and that the record's rows equal the node inputs at that revision (for example the Remarks text is either in the record and the state is `current`, or not in it and the state is `out-of-date`). To make it deterministic, hold the row with `SELECT … FOR UPDATE` in a third connection, start both, then release. | The improved test itself. Check that it fails when the save path skips `lockEstimate`. |
| SQR-03 | Minor | `tests/unit/recalculate-client.test.ts:68-85`; `src/components/features/estimate-recalculate/recalculate-button.tsx:58-73` | The button's behaviour is not tested anywhere except the happy path and the 409 alert in E2E. These are untested: the in-flight guard (a double click sends one request), the `failed` path and its line, the refresh after `failed` or a 409 but not after a 422, a failed `import()` of the client, and `problem` being cleared on the next press. The unit tests render only the static markup. | A regression in the guard would send two presses. That is safe on the server (two serialised records) but adds needless history rows. Failure handling could break unseen. | A small jsdom test with `@testing-library/react`, mocking `next/navigation` and the client module, or two E2E cases with `page.route`: (1) a double click → one POST; (2) a 500 → the failure line and a refresh. | The tests named. |
| SQR-04 | Minor | `src/components/features/estimate-review/review-actions.tsx:65` | The button is drawn only when `state !== 'current'`, whatever the status. Architecture §4.8 says that after an unlock the figures stay `current` and "the state is DRAFT, so approval still needs a Recalculate". ux-spec SCR-06 "Draft after unlock" has **Recalculate** as the primary button. With this condition, a current Draft has no button, so a Lead cannot submit it without changing an input. The "Rates changed" notice (UX-62, 06.11) also links to Recalculate while `current`. Unlock (06.08) is not built, so nothing is reachable today. | When 06.08 ships, an unlocked estimate cannot be approved unless someone edits an input: a dead end. | No change here. **product-owner / scrum-master:** add to 06.08's ACs (and 06.11's): "Recalculate is shown while the status is DRAFT, whatever the figure state". It needs the estimate's status as a prop of `ReviewActions`. | A 06.08 screen test: Draft + `current` → the Recalculate button is shown. |
| SQR-05 | Info | `src/lib/estimate/calculate-words.ts:28-30` (used by the 422) | A 422 `CALCULATE_BLOCKED` on SCR-06 shows only the title, `Nothing was submitted. 2 parts have missing inputs.` The `parts` list in the problem body is not shown, so the Lead cannot see which parts. ux-spec UX-36 already notes that SCR-06 has no blocked state. | The Lead must find the parts on SCR-05. | **ux-expert:** decide whether SCR-06 lists the parts (the body already carries them, with no figure). This is a later story, not this one. | n/a |
| SQR-06 | Info | Assumption 2; `estimate-cleared.spec.ts:120` | Until 06.10, a Lead cannot recalculate an estimate with a 0 in QTY per Assy. With 06.05 (approval blocked while not current), such an estimate, once cleared, cannot be approved. | A release dependency, not a defect. | **orchestrator:** sequence 06.10 to merge before G8, ideally right after 06.05. Note it in `project-state.md`. | n/a |
| SQR-07 | Info | AC-4 | BO is fixed "Not set yet" and is not read through the figure state, so clearing cannot affect it. AC-4 has nothing to test until 06.06 stores an approval. | AC-4 could be lost between stories. | **product-owner:** carry AC-4 ("BO stays when figures clear, labelled Approved earlier after an unlock") into 06.06 and 06.08 as a named test. | A 06.06/06.08 integration test: approve, change an input → BO unchanged while BL is cleared. |
| SQR-08 | Info | `src/lib/estimate/state-machine.ts:79-82`; `review-actions.tsx:70` | (1) A Lead's **Calculate** on a never-calculated Draft submits the Engineer's Draft (A-08, as specified). After that, the Engineer can no longer edit, and their next save is a 409. This is by design, but worth stating on the screen or in the user guide. (2) SaveGate is not needed on SCR-06 today (no form). When the input form arrives on SCR-06, the button must `settle()` the gate before it sends, as `use-calculate.ts` does. | (1) Surprise for the Engineer. (2) A future stale-record risk (the AQP-317 SQR-01 class). | (1) **ux-expert / product-manager:** note it. (2) **scrum-master:** add it to the story that adds the SCR-06 form. | n/a |
| SQR-09 | Info | `tests/e2e/canary-scan.spec.ts:735` | The new test's title ends "…and an Engineer's press is the fixed 403", but its body makes no Engineer press. That case is covered elsewhere: by the manifest-driven refusal scan (the recipe in `route-calls.ts` and the row in `spec-access.ts`) and by `estimate-cleared.spec.ts:159`. | The title says more than the test does. | Drop the clause from the title, or add the Engineer's call to the test. | n/a |
| SQR-10 | Info | whole PR | **Praise.** There is truly one calculation path, `press` → `submit`, with no copied checks. Role, CSRF and state are each decided once, by the manifest, `withRoute` and the machine, with the service as a second guard. The service returns nothing, and the answer is read back through the figure state. A matrix of 9 writers is tested against real PostgreSQL. The button is small and pinned by an architecture test, and its request code is loaded on first press. The skeleton is CSS only. Stage 11b costs +460 B. AC-10 is word-perfect, including SCR-07. | n/a | n/a | n/a |

There are no Major findings, so no `tech-debt` issue is raised. SQR-01 to SQR-04 are recorded here for the final review if they are not fixed in this PR.

## Test adequacy (would the tests fail?)

| Fault | Caught by |
|---|---|
| An Engineer reaches `/recalculate` | Manifest role matrix, refused-before-lookup, `recalculate-route.test.ts:218`, `estimate-cleared.spec.ts:159`, the canary refusal scan |
| A second calculation path, or different figures from a Lead's press | `recalculate.test.ts:57` (Engineer and Lead records equal to the last digit) |
| A refused press that leaves the status moved or writes a record | `recalculate-route.test.ts:148/160/173/182/202`, `cleared.test.ts:221/230` |
| A writer that does not clear the figures | `cleared.test.ts:122` (9 writers, read straight after) |
| A figure on a cleared page or answer | `cleared.test.ts` `expectCleared`, canary AC-7 (STORY-06.04), screen tests |
| A master value in the Lead's answer | Canary positive control and planted-leak control, `recalculate-route.test.ts:236` |
| A press that bypasses the row lock | **Not reliably**: the race test cannot fail (SQR-02) |
| A double click sending two presses; the failure path | **Not tested** (SQR-03) |
| A wrong AC-10 sentence | Screen, page and E2E expectations on every line |

## Issues for other roles

- **ux-expert:** SQR-01 (the SCR-06 Error row against the §6.0 rule, and the dropped reference clause), SQR-05 (the blocked parts on SCR-06), SQR-08 (1).
- **product-owner / scrum-master:** SQR-04 (06.08 and 06.11 ACs: Recalculate on a current Draft), SQR-07 (carry AC-4 into 06.06 and 06.08), SQR-08 (2) (SaveGate when SCR-06 gets a form).
- **orchestrator:** SQR-06 (06.10 before G8). Close #430 and #436 on merge.
- **developer (this PR or hardening):** SQR-02, SQR-03, SQR-09, and SQR-01 once ux-expert gives the words.

## Recommendation

There are no Blocker, Critical or Major findings, so the critical-review condition of CLAUDE.md §9 item 2 is met at `77c5f8ed`. NFR-002 holds: an Engineer cannot reach the route, a figure, a state or a count through the API, the page, the client bundle or an error. Recalculate uses the Calculate service and the state machine in one transaction under the row lock, writes a new immutable record, and leaves the old one intact.

- **Cheap in this PR, if the developer wants to:** SQR-02 (strengthen the race test) and SQR-09 (the test title). Neither blocks the merge.
- **Hardening window:** SQR-01 (after ux-expert gives the words) and SQR-03.
- **Carried to later stories:** SQR-04, SQR-06, SQR-07, SQR-08.

Mergeable at `77c5f8ed` with CI green (run 43739777977, attempt 2, 6 of 6). A re-review is needed only if a fix-up touches `src/server/**` or the route.
