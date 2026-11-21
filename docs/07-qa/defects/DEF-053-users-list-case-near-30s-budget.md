# DEF-053: `users.spec.ts:58` "AC-1, AC-7: shows name, e-mail, role and status..." [desktop] times out at 30 s (2 attempt-1 failures, one outside a ruled wave); 13 of 41 passing desktop readings are at 25 s or more (Test)

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.04 (AQP-65, Done) owns `users.spec.ts` (the spec header names it: "STORY-01.04 T6 (AC-1, AC-3, AC-4, AC-5, AC-7)"); the case is its AC-1 and AC-7. **No AC fails:** no attempt shows an `expect` message, a value or an axe violation list; both failures are `Test timeout of 30000ms exceeded.` AC-1 and AC-7 are not shown to regress |
| Severity | **Sev-3 Moderate** (qa-engineer, on master's DL-274): a Test-type defect, fails closed (a red required check if both attempts fail), workaround is the retry or a re-run under R10, no product behaviour affected as far as the evidence shows. Same grade family as DEF-045 to DEF-052 |
| Priority | P3 on its own. **Lane (DL-274 (2)): the hardening window (all stories are built), first among the test-only Bugs** |
| Type | **Test** (E2E, Playwright, `desktop` project; duration-tail class). No product defect found |
| Status | **Closed 2026-11-21 (qa-engineer), on master's DL-275 (I).** Fixed by PR #571 (squash `efeed217`): `expectNoAxeViolations` now scans with `.options({ resultTypes: ['violations'] }).withTags(AXE_TAGS)`. Proof P1, P2, P3 met (see "Closure"). Jira AQP-383 Done, GitHub #569 closed. Rule R10 ends with this close-out; the live rule is W1 only. **Near-line reading kept on watch:** 24.3 s [desktop] on the first `master` push run after the merge (test plan section 7) |
| Jira / GitHub | [AQP-383](https://sankumar76.atlassian.net/browse/AQP-383) / [#569](https://github.com/sankumar76/Accucut-Quotation/issues/569). Jira "relates to" AQP-65 (STORY-01.04) and AQP-376 (DEF-047, history). RISK-031 in the register |
| Risk / rule | RISK-031 (master's). Rule **R10** (DL-274 (2)) governs re-runs until this Bug is closed; live rules with it: W1 |
| Found by / date | CI. First seen as a watch entry on PR #555's run of record 44870213022 (DL-273 (4)); turned into a Bug by master on the full census (DL-274); logged by qa-engineer, 2026-11-21 |
| Build / commit | PR #555 heads 0dfef68e and d808bec0 (the failures); `master` 266db7a9 / 03c81cbf (readings). Spec read at `origin/master`; not edited |
| Environment | GitHub Actions `ubuntu-latest`, 4 vCPU, `Running 485 to 501 tests using 4 workers` (shard 4), one development server and one PostgreSQL shared by the four workers; invented data only |

## Scope: one test, identified by file and title (not by line)
`tests/e2e/users.spec.ts`, describe "the list", test "AC-1, AC-7: shows name, e-mail, role and status, does not scroll sideways and has no axe violations" (:58). It runs at three widths (mobile, tablet, desktop); the failures and the tail are in `[desktop]`. What it does: makes a disposable person (`createDisposableUser`, one argon2id hash), opens `/users` once and waits for hydration, checks the row's e-mail, role and status and the Admin's own row, checks the phone-card text (phone) or its absence (wider), checks no sideways overflow, and runs one whole-page axe scan.

## Steps to Reproduce
Not reproducible on demand: no local attempt (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR; the shard that holds `users.spec.ts` (shard 4 of 4 in these runs).
2. Watch `[desktop]` for the test above. It runs late in the shard (test no. 492 and 507, about 16 minutes in, on the two failing runs).

## Expected Result
The case inside its 30 s budget with margin: the proof below (P1 to P3, 15 s reported).

## Actual Result
| # | Date | Run (head) | Result | Wave status |
|---|---|---|---|---|
| 1 | 2026-11-21 | PR #555 run of record 44870213022 (0dfef68e), shard 4, `[desktop]` | **attempt 1 failed 31.8 s** (test no. 492, 05:35:00Z, 16.0 minutes after the shard started); retry passed 25.9 s. `Test timeout of 30000ms exceeded.` | **Not a ruled wave** (DL-274 (1)): shard 4 ran 1.52x the latest green `master` push (44869652720), but shard 1 of the same run ran 1.54x, so W1 (d)'s same-run control fails. **Counts** |
| 2 | 2026-11-21 | PR #555 merged-head run 44888215530 (d808bec0), shard 4, `[desktop]` | **attempt 1 failed 31.9 s** (no. 507, 16.6 minutes in); retry passed 27.0 s. Same error | **A W1-measured wave** (QA's measure against the latest green `master` push 44888177238: shard 4 1.50x, 1.43x in the first 4 minutes, the other shards at most 1.17x). **Does not count** (DL-270 (2)(a), DL-274 (1)) |

**The census (QA, overlapping logs, not a full census).** `[desktop]`, as counted for DL-274: 43 first-attempt readings, 2 failed (rows 1 and 2), the passing median is **20.9 s**, 24 of 41 passing are at 20 s or more, and **13 of 41 passing are at 25 s or more, 25.8 to 29.3 s**. Recounted on 2026-11-21 on the logs QA holds now (two more green readings, 17.3 s and 17.6 s, and others): 45 first-attempt readings, 2 failed, 43 passing, median 20.3 s, 13 of 43 at 25 s or more (the same 13). The 13, by date and source (run IDs where the log kept one): 2026-11-19 25.8 s and 26.5 s (two logs kept without run IDs), 26.4 s (44494663177), 26.4 s (44498855023), 26.2 s (44502983375), 27.6 s (`master` push 44505816384), 27.1 s (`master` push 44540107462), 26.1 s (the #510 run log); 2026-11-20 29.3 s (a shard job log, 136319317375), 26.8 s (#540 run 44752189754), 26.8 s (`master` push 44755812730), 26.0 s (#546 run 44781381557); 2026-11-21 27.8 s (`master` push 44850302908). Recent low readings: 17.3 s (#557 run 44875704411), 17.6 s (`master` push 44890683601). `[mobile]` readings are 5.1 to 12.5 s and `[tablet]` readings 7.6 to 17.4 s.

**Mechanism (what the logs show, not more).** The case ends with one whole-page axe scan of `/users`, which holds every person made by earlier specs in the same shard job (about 170 people, DL-263 (1)); the failures are late in the shard, when that list is longest, and not in its first minutes. The same page's scan took 8 to 16 s in the DEF-047 diagnostic (the SCR-14 axe cases of `masters-table-actions.spec.ts`, DL-263), which master ruled is a cost of the required scan on the shared E2E data and outside a spec. The CI log has only the whole-test time and the error position, so the split of the 20 to 30 s between the disposable person (argon2id), the page open, the assertions and the scan is **not measured, so not known**.

## Evidence
Job logs of PR #555 runs 44870213022 and 44888215530, `master` push runs 44890683601, 44869652720 and 44888177238 (for the wave measure), and the older runs in QA's census (`gh api repos/.../actions/jobs/<id>/logs`), read by qa-engineer on 2026-11-21; durations matched by project, file, line and title. DL-263 (1) for the scan and the data size; DL-273 (4) and DL-274 (1) for the ruling.

## Measurement hypotheses (developer; measure before changing anything, cheapest first)
1. **Phase times of the case** at three widths on CI: test start, `createDisposableUser` done, `/users` loaded and hydrated, the row assertions done, overflow checked, scan start, scan end. How much of 20 to 30 s is the scan, and how much is the argon2id set-up and the page open?
2. **Scan cost against list size.** Record the number of people in the list at scan time (DL-263 (4) left this open) and the scan's time; compare the case's position in the shard (late) with a run that has it early.
3. **Splitting the case.** The layout and row checks and the scan can be two cases, each with one page open and one scan at most, keeping every assertion and the scan (the shape of #527 and #546). This also removes one of the two `waitUntilHydrated` waits only if the open is shared; measure before choosing.
4. **Warm-up.** A spec-local `test.beforeAll` per worker that requests `/users` once (DL-272 (B) shape, limits as there) is allowed. The failures are late in the shard, so a warm-up of the first compile may not help; measure first.
5. **Product check.** Time to first render of `/users` with about 170 people on the development server. If slow after the first hit, that is a **product defect**: QA re-grades and master is told at once.

## Suspected Area
`tests/e2e/users.spec.ts` (:58 to :77, `openUsers` at :44), `tests/e2e/support/auth.ts` (`createDisposableUser`), `tests/e2e/support/design-system.ts:96` (`expectNoAxeViolations`). Not `src/`, unless hypothesis 5 shows it.

## Binding for the fix (DL-274 (2); DL-229 (4)(b); DL-257 (B))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, assertion or scan. **The axe scan and every assertion stay.** Splitting the case is allowed if every assertion and the scan are kept. Set-up through rows or routes only for steps that are not the case's subject (DL-257 (B)). **A spec-local warm-up limited to `users.spec.ts` is permitted** (DL-272 (B) shape: one `test.beforeAll` per worker that requests the pages the spec opens once; it asserts only that each request answered with a status that is not 5xx; it does not swallow errors; it changes no budget, retry or wait; it keeps every assertion and scan; its effect is shown by a phase print on a diagnostic head removed before merge). Not allowed: a change to the E2E global setup, `playwright.config.ts`, ci.yml, the web-server command, a shared `tests/e2e/support/` file, or other specs. A change under `src/` or a dependency means stop and go to master. It takes a separate PR in the hardening window.

## Proof (DL-274 (2), the form of DL-257 (A))
Read by the orchestrator from the job logs on the fix PR's run of record and on the first `master` push run after the merge whose Stage 2 is green, and posted on the Bug:
- **P1:** each case (or each case it is split into) passes on its first attempt at all three widths.
- **P2:** each takes under 25 s at every width.
- **P3:** each opens the page once and runs at most one axe scan. (The case already does; a split must keep it.)
- **15 s** reported, not gated.
If P1 or P2 fails, this Bug stays open and the developer brings the measured phases to master. **QA's note for master:** DEF-047's scan cases showed that the floor above 15 s can be the required scan on the shared E2E data and outside a spec; this case's passing median of 20.9 s is the same class, so P2 on a slow draw may need the same amended reading (DL-263).

## Rule R10 (master, DL-274 (2), as written; until this Bug is closed; live with W1)
R8's clauses (a), (c), (e) and the multi-rule sentence, as written in DL-261 (3) (summary: (a) `Stages 1 to 11b` success, the only red jobs are Stage 12 shards plus the fan-in, every red shard `1 failed`; (c) every attempt's error is `Test timeout of 30000ms exceeded.`, alone or with a `page.*`, `locator.*`, `apiRequestContext.*` or `AxeBuilder.analyze` time-out, and no attempt shows an `expect(...)` failure message or an axe violation list; (e) every other test passed, each flaky listed with the re-run; a run red on more than one live rule is re-run once only if it meets each in full), with these changes:
- **(b)** The failed test is exactly this test, in any project (file and title as above).
- **(d)** The failing call is a page or locator wait, or the axe scan, cut by the 30 s budget, with no received value and no violation list.
- **(f)** The diff touches none of: `tests/e2e/users.spec.ts`; the `tests/e2e/support/` files it imports; `playwright.config.ts`; the E2E global setup or seed; the Users page, its components, routes or services; or the `next`, `@playwright/test` or axe versions.
- **Never re-run, and report to master at once:** an axe violation, a shown value, a row, role or status mismatch, a red re-run, or a second red on the same head.
- **Records:** each re-run is one comment on AQP-383 (run ID, PR or `master`, head, result, the error position of each attempt), a line in the daily update, and an entry on RISK-031's re-run list (the orchestrator).

## Re-run list (orchestrator adds each; R10)
| When | PR / run | Head | Result |
|---|---|---|---|
| | none yet | | |

## Issues for other roles (no defect)
- **master:** the census is the full series (13 of 41), as in DL-274. The two failures are rows 1 and 2; only row 1 counts, so the Bug rests on one failure outside a ruled wave plus 13 readings, the DL-267 line. A second failure outside a ruled wave would be a re-grade input (a recurrence), not a new Bug.
- **orchestrator:** please add this Bug and R10 to RISK-031's register line and keep the R10 re-run list; QA does not write the register or the decision log.
- **solution-architect:** same root as DEF-047: the whole-page axe cost grows with the shared E2E data (the `architecture` issue of DL-264 (1)); QA did not create it.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Phases measured; mechanism confirmed or refuted | developer | | draft PR (never merged) or AQP-383 comment |
| Fixed (spec or test-only helper) | developer | | `fix/AQP-383-<slug>`, hardening window |
| Regression test added | developer | | the fix is the test change; the scan and every assertion kept |
| Verified: P1, P2, P3 on the fix PR's run and on the first `master` push run after merge | orchestrator reads, qa-engineer confirms | | |
| RISK-031 | master | | master decides (DL-274) |

## Severity history and routing
- qa-engineer graded Sev-3, type Test, 2026-11-21, on master's DL-274. It holds no story gate (AQP-65 is Done). It changes to a Product defect only if hypothesis 5 shows `/users` itself slow; master is told at once and QA re-grades.

## Closure (qa-engineer, 2026-11-21; proof of DL-275 (I) and DL-257 (A), read from the job logs)
| Proof | Result | Evidence |
|---|---|---|
| P1: first attempt at all three widths | **Met** | PR run of record 44902999104 (head `a11abdf1`, before the merge of `master` into the branch): `users.spec.ts:58` mobile 10.0 s, tablet 15.9 s, desktop 14.7 s, no retry. `master` push run 44907312557 on `efeed217`: mobile 8.3 s, tablet 9.9 s, desktop **24.3 s**, no retry |
| P2: each under 25 s | **Met, with the desktop reading 0.7 s under the line** | worst PR reading 15.9 s; `master` worst 24.3 s [desktop] (test no. 514 of shard 4, 16.7 minutes into the shard, the late position where the list is longest). Say it plainly: 24.3 s passes the 25 s line by 0.7 s, so the case is on the watch list with a trigger |
| P3: one page open, at most one scan per case | **Met** | the diff of PR #571 changes one line of `tests/e2e/support/design-system.ts` (the scan call); the case still opens `/users` once and the helper scans once per call. Negative control (DL-275 (I)(a)): never-merged diagnostic head `7b5ad499` (draft PR #572), run 44903060313: a planted violation was reported at all three widths (`AQP383PLANT`; per the PR body, not re-read by QA) |
| 15 s reported | desktop 24.3 s and PR 14.7 s on the `master` and PR runs | |
| Whole run | `master` push run 44907312557 (`efeed217`): CI success, Windows package run 44907312607 success; E2E 522 / 524 / 528 / 508 passed, **0 flaky and 0 failed in all four shards** | job logs read by qa-engineer |

Other readings of the same run (the DEF-047 axe cases of `masters-table-actions.spec.ts` at 768 / 1024 / 1366 px, desktop): 21.7 / 19.4 / 18.3 s, against 28.7 / 28.4 s on `242c21f7`: the helper change cut them as the ruling expected. The `[AQP-341 stored-values diagnostic]` line appears in no job of run 44907312557 (0 lines; PR #580 not merged yet).
