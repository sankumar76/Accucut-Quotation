# DEF-047: SCR-14 Users E2E case (`masters-table-actions.spec.ts:315`) times out at 30 s on `master` and on PR runs; the Users cases take 12 to 28 s against 2 to 4 s on the other masters screens

| Field | Value |
|-------|-------|
| Story / AC | STORY-10.21 (AQP-245, Done; `afecc587`, #222) owns the Users case (AC-1, AC-2, AC-3, AC-5 are in its title); the spec was first written for AQP-234 (DEF-021) and AQP-275 (DEF-030) added two Users cases. **No AC fails:** no `expect` failed and axe reported no violation on either red. NFR-016 and DEF-021 are not shown to regress |
| Severity | **Sev-3 Moderate, graded by qa-engineer, provisional**, on the test-plan scale (section 6): a Test-type defect, fails closed (a red required check), workaround is a re-run (rule R5), no product behaviour affected as far as the evidence shows. **Re-grade to a Product defect** (Sev-2 if the Users page serves or renders slowly enough to matter to a person, graded by the figures) if hypothesis 4 below shows `GET /users` or the first render slow. Same grade family as DEF-007, DEF-012, DEF-041 to DEF-046 |
| Priority | P3 on its own; **takes a lane at once** under DL-255 (D), because the test runs in the one required check on every PR and `master` push (not because of the grade) |
| Type | **Test** (E2E, Playwright, `desktop` project; duration-tail class). No product defect found |
| Status | **Closed 2026-11-20 (qa-engineer), on master's DL-263 (B).** The amended proof (DL-257 (A), in the form DL-257 (7) allows) is met: PR #527's run of record 44738649937 and the first `master` push run after the merge, 44752152410. See "Closure". Fixed by the developer (PR #527, squash 5d6d72b: `masters-table-actions.spec.ts` only); not fixed by QA |
| Jira / GitHub | [AQP-376](https://sankumar76.atlassian.net/browse/AQP-376) / [#522](https://github.com/sankumar76/Accucut-Quotation/issues/522); Jira "relates to" AQP-245, AQP-348 and AQP-1. Separate follow-up for the `pg` warning: [#523](https://github.com/sankumar76/Accucut-Quotation/issues/523) |
| Risk / rule | RISK-031 stays open at 9 (DL-263 (7)); this Bug's part of its close-out is met. Rule **R5 ended at this close-out** (DL-263 (3)): no re-run may cite it, and a recurrence of its signature is a new failure that comes to master. R5's text below is history. The three axe cases are on the near-budget watch list in the test plan (section 6, "Near-budget watch list (E2E)"), with master's trigger (DL-263 (6)(b)) |
| Found by / date | CI. `master` push run 44487090650 (head 0898563, the squash of #501) and PR #503 run 44490599806, job 135446235990 (head 3d5aebe). Evidence read by master (DL-255, 2026-11-19) and re-read by qa-engineer from the job log; logged by qa-engineer, 2026-11-19 |
| Build / commit | `origin/master` source of the spec; #503's 36 files touch no E2E spec, no `tests/e2e/support/` file, no Users page, service or repository, no auth or hashing code and no Playwright or axe version (DL-255 (1)); not re-checked by QA beyond reading the spec at `origin/master` |
| Environment | GitHub Actions `ubuntu-latest` (image ubuntu-26.04), "Runner: 4 vCPU, 15983 MB memory", step Stage 12 E2E shard 4 of 4, `Running 447 tests using 4 workers` (log line 840); one development server and one PostgreSQL shared by the four workers; invented data only |

## Closure (2026-11-20; qa-engineer, on DL-263)
**Result: P1 met, P2 met, P3 met in the diff; 15 s reported, not gated. DEF-047 is closed.** The proof cases are the three "AC-5: at N px axe finds no violation on the forced table, after a Tab through the long-name row" cases, `[desktop]`, in the describe "SCR-14 Users: axe scan of the forced table (DEF-021, AQP-245 AC-5)" of `tests/e2e/masters-table-actions.spec.ts` (N = 768, 1024, 1366; :407 on 5d6d72b). QA read the job logs of each run itself (every shard; durations matched by project, file, line and title), and the figures agree with master's (DL-263) and the orchestrator's (AQP-376 comments 12407 and 12411).

| Run | Head | Required check | P1: first attempt | 768 / 1024 / 1366 px, s | P2: worst | Over 15 s |
|---|---|---|---|---|---|---|
| PR #527 run of record 44738649937 | fb15d167 | `Stages 1 to 11` success; shards 468 / 473 / 469 / 454 passed (2 flaky elsewhere, neither a DEF-047 case) | 3 of 3, no retry | 19.3 / 18.9 / 19.5 | **19.5 s** | 3 of 3 |
| PR #527 merged-head run 44748674828 (extra, QA) | 0fbf789 | fully green; 0 flaky | 3 of 3 | 13.0 / 13.9 / 14.7 | 14.7 s | 0 of 3 |
| `master` push 44752152410 | 5d6d72b (#527's squash) | fully green; 1 flaky (`approve-override:155` [mobile], DEF-050) | 3 of 3, no retry | 15.6 / 14.9 / 15.6 | **15.6 s** | 2 of 3 |

**Diagnostic (DL-260 (5), draft PR #542, closed without merging, run 44752992735, QA read the same three cases):** 21.2 / 23.3 / 22.1 s on a 1.30x shard-4 draw. Master's reading (DL-263 (2)): phases account for each case to within 0.21 s; the floor above 15 s is the one required whole-page scan (8 to 9 s on a normal draw), outside the spec. P3 spot-check by QA: the PR diff is the one spec file; each new axe case opens the page once and runs one scan.

**After the closure (not part of the proof, for the watch list).** `master` push 44755812730 (f652c22c, fully green, 0 flaky; its shard 4 about 1.37x the run above): **23.4 / 24.7 / 25.2 s** at 768 / 1024 / 1366. The 25.2 s reading meets master's watch trigger (a reading of 25 s or more on any run, DL-263 (6)(b)) and is reported to master the same day. #540's run 44752189754: 23.9 / 24.8 / 24.0 s. They did not fail and do not reopen this Bug.

**R5:** ended. Re-runs made under R5 (orchestrator's record, on AQP-348 and RISK-031; QA holds none) are not listed here. A red on any of these cases is a new failure for master; QA reopens this Bug (Status Reopened) if one fails on a `master` push run or on both attempts.

## Steps to Reproduce
Not reproducible on demand: two occurrences on two heads, none locally attempted (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR; the shard that holds `masters-table-actions.spec.ts` (shard 4 of 4 in both occurrences).
2. Watch `[desktop] tests/e2e/masters-table-actions.spec.ts:315:7`, describe "SCR-14 Users: row actions are inside the table region (DEF-021)", at 768, 1024 and 1366 px (the `AXE_WIDTHS`).

## Expected Result
Every case of the describe passes inside its 30 s budget with margin (the master's proof target is at most 15 s per case, DL-255 (5)).

## Actual Result
`Test timeout of 30000ms exceeded.` on both attempts. No `expect(...)` message and no axe violation list.

| Run | Head | Attempt 1 | Retry (Playwright `retries: 1`) |
|---|---|---|---|
| 44487090650 (`master` push) | 0898563 | 31.4 s | 32.1 s, in the axe scan (:364) |
| 44490599806, job 135446235990 (PR #503) | 3d5aebe | 32.2 s, `locator.evaluate` at :368, call log "waiting for getByRole('region', { name: 'Users, scrollable' })" | 35.9 s, `page.evaluate` in `AxeBuilder.analyze` (`tests/e2e/support/design-system.ts:96`, called from :364) |

Shard 4 of the PR run: `1 failed, 2 flaky, 20 skipped, 424 passed (16.1m)`. Flaky (passed on retry): `estimate-fasteners.spec.ts:58` and `:69` [desktop] (`toBeVisible` on `form[data-part-form]` at the 15 s expect, `support/part-form.ts:50`; first attempts 20.9 s and 20.7 s at 08:55, retries 9.1 s and 9.5 s). Those two are recorded as RISK-031 time-out-mode occurrences and are **not part of this Bug's signature**.

Margin was already shrinking on green runs of this case (1366 px, per master): 17.7 s (44365345587), 19.4 s (44482838527), 22.0 s (44475841405), 22.6 s (44490526653), then 31 to 36 s on the reds. This looks like a duration-tail class, as DEF-045 and RISK-031 (time-out mode).

## Evidence: QA measurement from the job log (read only; no CI re-run)
Source: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/135446235990/logs` (scratch copy; per-case times are the `(N.Ns)` suffix of each Playwright line).

| Group (all [desktop], same run, same shard, 4 workers in parallel) | Cases | Time per case |
|---|---|---|
| SCR-11 Process master, `:315`, 11 widths | 11 | 2.4 to 4.0 s |
| SCR-13 Materials, 11 widths | 11 | 2.0 to 3.3 s |
| SCR-12 Customers, 11 widths | 11 | 2.4 to 3.5 s |
| SCR-13 Treatment / Color, 11 widths | 11 | 3.2 to 4.1 s |
| **SCR-14 Users, no axe scan** (900, 1000, 1023, 1180, 1257, 1279, 1280, 1440 px) | 8 | **12.4, 12.7, 13.3, 15.1, 15.4, 15.5, 15.5, 15.7 s** |
| **SCR-14 Users, with axe scan** (the `AXE_WIDTHS`) | 768 / 1024 / 1366 px | **26.2 s / 28.0 s / 32.2 s (timed out), retry 35.9 s (timed out)** |
| SCR-14 Users, card list at 360 px (AC-4) | 1 | 5.1 s |
| SCR-14 Users, "can sign in again" notice (AQP-275), 360 and 768 px | 2 | 8.1 s and 9.6 s |

All 44 masters instances (4 screens x 11 widths) were read in this run's log; the ranges above are theirs.

**Readings**
1. The Users case costs 12 to 16 s even without an axe scan, 3 to 5 times the same case on the other screens, so the extra is in what only Users does: the argon2id seeding of one to six people through `POST /api/v1/users` (the Users `make` in the `SCREENS` list), the three-buttons-per-row and own-row checks, the Tab through the long-name row with one `expect` per step, and a table that grows.
2. The axe scan adds about 11 to 13 s on top (768 and 1024 px against their neighbours), and the three failing or near-failing cases are exactly the three `AXE_WIDTHS`. The two reds both stop inside the axe scan (retry) or just after it (attempt 1, :368).
3. **Not measured, so not known:** the server time of `GET /users` and `POST /api/v1/users`, the hash time, and the number of people in the table at each case. The CI log has no request timings. Therefore "the Users page itself is slow" is **neither shown nor ruled out**; the grade stays Test and the developer measures hypothesis 4 first.
4. Context for the cost: `ARGON2_COST = { memoryCost: 65_536, timeCost: 3, parallelism: 1 }` (`src/server/auth/password-hasher.ts:15`); no test cost override (`TEST_HASH_COST` exists only in integration tests) was found for the E2E server in `playwright.config.ts`, `tests/e2e/support` or `src/`. Four workers hash at once on 4 vCPU. This is a reading of the source, not a measurement.

## Measurement hypotheses (developer; measure before changing anything, cheapest first)
1. **argon2id hashing when the suite adds people.** Wrap `addPerson` in the spec with `performance.now()` and print the total per case. Each case adds one long-name person, and fillers while the list holds fewer than six; with 4 workers at 64 MiB per hash on 4 vCPU, the hashes queue behind each other and behind the libuv thread pool of the server.
2. **The Users table grows across the suite.** Print `countPeople` at the start of each case and compare it with the case time (the rows and the `md:hidden` cards are both in the DOM). The same family as #118 (DEF-019: Users and Audit E2E on a database that holds about 200 E2E users).
3. **The axe scan cost.** Time `expectNoAxeViolations` alone at the three widths. A test-only option is to scope the scan to the Users region and the page chrome, with the same rules (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`), the same three widths and no rule dropped; whether that is allowed under AC-5 is for the developer and master to settle, not QA.
4. **Time to first render of `/users` on the development server** (`next dev`, compile on demand; `playwright.config.ts:107`): time `page.goto('/users')` up to the heading. If it is slow after the first hit, that is a **product defect**: QA re-grades it and master is told at once.

## Suspected Area
`tests/e2e/masters-table-actions.spec.ts` (the Users `make` seeding, `expectTabThroughRow`, the `AXE_WIDTHS` block at :362 to 364) and `tests/e2e/support/design-system.ts:96` (`expectNoAxeViolations`). Not `src/`: nothing here points there, but hypothesis 4 can.

## Binding for the fix (DL-255 (5); DL-229 (4)(b))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, axe scan or assertion. The fix stays in the spec or a test-only seeding helper; a change under `src/`, `playwright.config.ts`, ci.yml or a dependency means stop and come back to master. **Proof:** the whole SCR-14 Users describe at most 15 s per case on the fix PR's run and on the first `master` push run after the merge, read by the orchestrator and posted on the Bug (AQP-376).

## Rule R5 (until the fix PR has merged)
A red run may have its failed jobs re-run once per head only when all of (a) to (e) of DL-255 (3) hold: `Stages 1 to 11b` success and only Stage 12 shards plus the fan-in red, each red shard `1 failed`; the failed test exactly `:315:7` of this describe at 768, 1024 or 1366 px; every attempt's error `Test timeout of 30000ms exceeded.`, no `expect` message, no axe violation list; every other test passed and each flaky listed; the diff touches none of the listed paths or package versions. Never re-run and tell master at once: an assertion or axe failure in this test, a failure at another width, or a second failure on the same head.

## Re-run list (orchestrator adds each)
| When | PR / run | Head | Result |
|---|---|---|---|
| 2026-11-19 | PR #503, run 44490599806, failed jobs, ruling A | 3d5aebe | Not known to QA when this record was written; the orchestrator adds it (here, on AQP-348, on RISK-031 and in the daily update) |

## Issues for other roles (no defect)
**2026-11-20 (closure):** the three axe cases are on the near-budget watch list (test plan, section 7); the 25.2 s reading of 1366 px on `master` push 44755812730 is reported to master under DL-263 (6)(b).

- **orchestrator / master:** the `pg` DeprecationWarning "Calling client.query() when the client is already executing a query" (1 line in this job at 08:58:07Z; 13 lines on each of `master` push runs 44490526653, 44482838527, 44475841405, per master) is **not** part of this signature. It is filed as follow-up [#523](https://github.com/sankumar76/Accucut-Quotation/issues/523) (`follow-up`, `ai-delivery`) for the final review. No link to the time-outs is shown.
- **orchestrator:** RISK-031 (reopen at 9, DL-255 (6)) and the occurrence list (44487090650 and `estimate-fasteners:58` and `:69`) are the orchestrator's and master's to write in `docs/00-governance/risk-register.md`; QA did not edit it. The register line in the records worktree is already modified and uncommitted, so QA left it alone.
- **developer:** the spec's header says Users filler people "cost one argon2id hash (QLT-04)"; the cost of that hash on the CI runner has not been measured.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Hypotheses 1 to 4 measured; mechanism confirmed or refuted | developer | | AQP-376 comment |
| Fixed (spec or test-only helper) | developer | | `fix/AQP-376-<slug>`, a lane at once (DL-255 (D)) |
| Verified: amended proof P1, P2, P3 (15 s reported), on DL-263 (B) | orchestrator reads, qa-engineer confirms | 2026-11-20 | #527's run of record 44738649937 (3 of 3 on attempt 1, worst 19.5 s) and `master` push 44752152410 on 5d6d72b (3 of 3 on attempt 1, worst 15.6 s); read by QA from the job logs (see "Closure"). Replaces "every case at most 15 s". **Closed 2026-11-20** |
| RISK-031 closed again | master | | DEF-047's part is met (2026-11-20). The other conditions (DEF-049 and DEF-050 proofs, a `master` push run with 0 time-out-mode flaky) are master's to read; see the hand-off of 2026-11-20 |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-19, provisional, for the reasons in the table. It holds no story gate (AQP-245 is Done; #503 is not the cause). It changes to a Product defect only if the measurement of hypothesis 4 shows the Users page itself slow; the master is told at once, and QA re-grades.
