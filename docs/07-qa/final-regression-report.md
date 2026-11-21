# Final Regression Report and Test-Plan Check: whole product at master 242c21f7

| Field | Value |
|-------|-------|
| Author | qa-engineer |
| Date | 2026-11-21 (hardening window, CLAUDE.md section 9 item 3; DL-275 (A1), (C), (C4)) |
| Commit under test | `242c21f7` (AQP-365, STORY-02.08, PR #564, the last build story). Code read in the read-only worktree `final-review`; nothing was run locally (section 9 item 5) |
| Jira / GitHub | AQP-1 (Intake). Bugs logged: AQP-384 (DEF-054), AQP-385 (DEF-055). Mirrors: #37, #578 |
| Folded in (DL-249) | STORY-10.08 (AQP-370) and STORY-10.09 (AQP-371): their intent is covered in section 5 |
| Inputs read | `docs/07-qa/test-plan.md` (section 7 watch list), `docs/07-qa/defects/**`, decision log to DL-275, risk register (RISK-031), the three final review reports, the CI runs named below, Jira (104 stories; 54 Bugs before this run), the PRD and the test suite at `242c21f7` |

## 1. Summary and recommendation

**CI verdict: green on the final head, with one flaky.** `master` push run 44899114212 on `242c21f7` passed every required check (Stages 1 to 11b; four E2E shards at three widths; fan-in) and the Windows package run 44899114142 passed. The run had 1 flaky: `users.spec.ts:58` [desktop], the DEF-053 case.

**But `master` was red earlier today.** Push run 44894461614 on `77b98fbb` (AQP-366, STORY-04.06) failed Stage 12 shard 4: the same `users.spec.ts:58` [desktop] timed out on both attempts (34.9 s and 32.5 s, 30 s budget), plus two more flaky. That meets **RISK-031 reopen trigger 1**, and on the face of the record **trigger 2** (section 2.3). DEF-053 has no fix PR yet (the only open PRs are #494, a docs PR, and #476, Dependabot).

**Recommendation: do not recommend G8 yet (REJECT for now, in the sense that the open list below is not empty).** The product regresses green, but these block under section 9 item 3 and DL-275 (A1):

| Blocker for G8 | Item |
|---|---|
| Open Sev-2 (known) | DEF-034 (AQP-288), DEF-038 (AQP-341) |
| Open Sev-2 (new from this run) | **DEF-054 (AQP-384)** no page security headers; **DEF-055 (AQP-385)** assignment e-mail rows never expire |
| Open Majors from the final reviews | PRF-F-01 to F-06, STD-F-01 (= DEF-054), STD-F-02, STD-F-03, QLT-F-01 (= DEF-055), #382, #410, #568 |
| Unbuilt story work | STORY-10.08 (no sweep, no Firefox or WebKit run, no keyboard-flow suite) and the load half of STORY-10.09 (NFR-010 and NFR-011 never measured) |
| Human steps | G8-C-AC8, G8-C-NFR10, 09.08 (section 8) |

After the fixes, the full regression must run again on the final head (freeze planned 29 Nov, DL-275 (B)). This report is the first pass, not the last.

| Defects | Sev-1 | Sev-2 | Sev-3 | Sev-4 |
|---|---|---|---|---|
| New, logged in this run | 0 | 2 (DEF-054, DEF-055) | 0 | 0 |
| Open before this run (all tracked) | 0 | 2 (DEF-034, DEF-038) | 7 (DEF-018, 033, 036, 040, 043, 052, 053; DEF-053 is the live one) | 2 (DEF-019, DEF-042) |

(DEF-020 and DEF-021 are Done in Jira but their files and GitHub issues still say open; see section 7.)

## 2. CI evidence from `master`

Durations are job wall-clock from the Actions API. Test counts are read from the job logs (`gh api .../actions/jobs/<id>/logs`), not from a re-run. No workflow was re-run.

### 2.1 `master` push runs, newest first

| Run | Head | CI | Stages 1 to 11b | E2E shards 1 / 2 / 3 / 4 | Passed / skipped / flaky (E2E) | Windows package |
|---|---|---|---|---|---|---|
| 44899114212 | `242c21f7` | success, 20 min | 9.7 min | 19.9 / 17.4 / 14.5 / 18.3 min | 2,075 / 30 / **1** (`users.spec.ts:58` [desktop]) | 44899114142 success |
| 44894461614 | `77b98fbb` | **failure**, 19 min | success | 16.3 / 14.1 / 14.3 / **18.9** min | shard 4: 502 passed, **1 failed**, 2 flaky | 44894461602 success |
| 44892640890 | `877baffd` | success, 21 min | 8.1 min | 20.5 / 21.6 / 14.8 / 13.9 min | 2,054 / 30 / **1** (`estimate-form-sections.spec.ts:161` [tablet]) | 44892640872 success |
| 44890683601 | `03c81cbf` | success, 21 min | 7.1 min | 21.7 / 21.3 / 11.0 / 12.1 min | 2,055 / 30 / 0 | 44890683621 success |
| 44888177238 | `5eff5fd9` | success, 17 min | 8.5 min | 17.0 / 14.3 / 12.2 / 13.7 min | 2,055 / 30 / 0 | 44888177252 success |
| 44883887032 | `368954bc` | success, 20 min | 8.9 min | 16.5 / 20.3 / 14.8 / 17.6 min | 2,043 / 30 / 0 | 44883887058 success |

Stage results on `242c21f7` (job "Stages 1 to 11b", run 44899114212):

| Stage | Result |
|---|---|
| 2 secret scan (Gitleaks, full history) | no leaks found (read on 44892640890; same job) |
| 3 data-file check, 4 lint, 5 type-check | pass |
| 6 unit tests with coverage of pure code | 436 files, 9,701 tests passed; coverage statements 96.78 %, branches 92.16 %, lines 97.61 % |
| 7 dependency audit (high and above, runtime) | pass; 2 moderate reported (uuid via exceljs, #536). A full `npm ci` also lists 4 high in a dev-only chain (#537) |
| 8 licence check, 9 build, 10 migrations and drift check | pass |
| 11 unit, integration, security, acceptance with coverage | **587 files, 15,064 tests passed**; no failure, no timeout (the DEF-052 file `aqp-38-sign-in.test.ts` took 4.5 s for 42 tests, 4.4 s on 877baffd) |
| 11 changed-code coverage (80 %), 11b JS budget | pass. Tightest headroom: `/queue` 9.8 KB, `/masters/materials` 10.8 KB, `/estimates/[code]` 14.4 KB (limit 200,000 B gzip) |
| 12 E2E, four shards, Chromium at mobile, tablet and desktop | see table; `forbidOnly` is on in CI, one retry |
| 13 Docker image build | **disabled** (`if: false` in `ci.yml`); the Windows package run replaces it (ADR-015). The header comment in `ci.yml` and the "Docker Compose" line in `CLAUDE.md` section 1 are stale (Sev-4, documentation) |

The 30 skipped E2E cases are conditional and carry a reason in the spec (own-width files run in one project; phone-only, tablet-only and desktop-only cases; two `QA234_MEASURE` measurement cases). A guard test (`aqp-27-scaffold`) bans `it.skip`, `it.todo`, `it.only` and `describe.skip`; none exists in the Vitest suites (the only skips are the conditional Playwright ones above).

**Windows package** (workflow "Windows package", not a required check): success on all six push runs above and on the scheduled run 44893289555. Run 44892640872 shows the install assertions passing three times, `/api/health` 200 with the worker's heartbeat row found, and the update and rollback steps green. A scheduled run on 2026-11-19 (44508508794) was cancelled, not failed.

**Nightly** (workflow "Nightly"): **red in six of the last six runs** (2026-11-18 to 2026-11-21; latest 44884087674). The only red job is "CI feedback time": for "Stages 1 to 11", p95 22 m 15 s against the 10 minute target, median 20 m 17 s against the 6 minute early warning (8 runs). The Lighthouse job and the cache job pass. Master froze this work (DL-235, section 9 item 4). Consequence: the nightly can no longer tell anyone something new is wrong; it is permanently red. Ask master to accept the figure in writing at G8 or to change the gate (Sev-3 process item, not logged as a Bug). The Lighthouse job measures `/` only (LCP 187 ms, TBT 0 ms): `KEY_SCREENS` is empty (PRF-F-02, #485). The nightly does not run Firefox, WebKit, the 500-node timing or any perf test (test plan section 7 "R-nightly" promises them; DL-275 (C2) lists them).

### 2.2 Flaky and failed tests, by file and title (today's master pushes)

| Run | File : line, project | Title (short) | Mode and reading | Covered by |
|---|---|---|---|---|
| 44894461614 | `users.spec.ts:58` [desktop] | the list: AC-1, AC-7 | failed attempt 1 and retry: `Test timeout of 30000ms exceeded.` 34.9 s and 32.5 s | **DEF-053** (AQP-383) |
| 44894461614 | `estimate-fasteners.spec.ts:171` and `:198` [desktop] | AC-6: showing and hiding Qty and Cost / with Qty and Cost shown | flaky: 15 s `expect(form[data-part-form]).toBeVisible()` ("element(s) not found"); tests no. 4 and 5 of the shard, in its first 30 s | no open Bug. Same early-shard cluster as DL-269 (2)(c); evidence for the post-G8 `architecture` issue |
| 44892640890 | `estimate-form-sections.spec.ts:161` [tablet] | AC-3: Fasteners shows "None" on a new part... | flaky: after `page.reload()`, `expect(S).toHaveValue('M6 bolt')` not found, cut by the 30 s budget (test no. 362 of shard 2) | no open Bug; same signature as `:145` (watch trigger 3 of DL-264 is for `:145` only). Listed on the watch list (section 4) |
| 44899114212 | `users.spec.ts:58` [desktop] | the list: AC-1, AC-7 | flaky, passed on retry | **DEF-053** |

No failure on any of these runs showed an `expect` value mismatch, an axe violation list or a wrong stored value. Failures are time-outs and "not found after reload". The estimate-fasteners and form-sections cases touch the Fasteners "None" path that **DEF-038** (AQP-341) is about (a wrong stored value, seen once on `estimate-fasteners.spec.ts:113`). I cannot say from the logs that `:161` is a DEF-038 recurrence: the error is a missing locator after a reload, not a wrong value. The developer who takes DEF-038 should read `:161` of run 44892640890 first.

### 2.3 RISK-031 (closed 2026-11-20, DL-268): the four reopen triggers

| # | Trigger (register text) | Status on 2026-11-21 | Evidence |
|---|---|---|---|
| 1 | a red required check on a `master` push run in the time-out mode (Stage 11 or 12) | **FIRED** | run 44894461614 (`77b98fbb`), Stage 12 shard 4, `users.spec.ts:58` [desktop], both attempts. R10 (DEF-053 re-run list) shows "none yet"; no re-run was seen |
| 2 | two time-out-mode attempt-1 failures outside a ruled wave on `master` push runs on one day | **Met on the face of the record; master rules on waves** | five attempt-1 failures on three `master` push runs today: 44894461614 (`users:58`, `fasteners:171`, `fasteners:198`), 44892640890 (`form-sections:161`), 44899114212 (`users:58`). Wave measure (QA, matched-test median ratio, `ratio.cjs` over the job logs): shard 4 of 44894461614 ran **1.33x** the shard 4 of green 44892640890 (matched 466) and **1.54x** that of green 44890683601 (465); shards 1, 2, 3 of the same run ran **0.76x, 0.64x, 0.97x** of 44892640890. W1 names PR runs, not `master` pushes, so no wave ruling applies; the measure is given as a fact. Run 44899114212 (`users:58`, shard 4 of 18.3 min) is not a measured wave |
| 3 | a red W1 or R9 re-run | not seen | no re-run record in DEF-053, DEF-051 or RISK-031 for today |
| 4 | a second occurrence of DEF-052 | not seen | Stage 11 green and no "Test timed out" on all six runs |

QA's proposal (master decides; QA does not write the register): reopen RISK-031 at 9 (P 3, I 3) on triggers 1 and 2, and move DEF-053 to the front of lane 3 (DL-275 (B)): it is the one test that has now turned `master` red, and no PR exists. The DL-275 (I) fix (`resultTypes: ['violations']` in `expectNoAxeViolations`) also reduces the cost of the SCR-14 axe cases (28.4 and 28.7 s [desktop] on 242c21f7).

### 2.4 DEF-052 and DEF-053 status

| Bug | Status read by QA |
|---|---|
| DEF-052 (AQP-382, #550; Vitest, three lock-out cases at 5 s) | **watch**; no second occurrence. `aqp-38-sign-in.test.ts` 4.4 to 4.5 s for the file on `877baffd` and `242c21f7` (3.1 to 3.3 s on 2026-11-21 early, DL-266 update); slower, not failing. The Jira Bug is still To Do |
| DEF-053 (AQP-383, #569; `users.spec.ts:58`) | **open, In Progress in Jira, no fix PR**. Three more attempt-1 failures today (44894461614 x2, 44899114212 x1) on top of the two on PR #555. On `242c21f7` attempt 1 failed at 32.3 s and the retry passed in 28.3 s. Rule R10 stays. Recommend master re-reads the re-grade input in the Bug file ("a second failure outside a ruled wave is a recurrence"). Stays Sev-3 (Test) unless master widens it, since `master` red is a tooling effect and no product behaviour is affected |
| DEF-051 (closed 2026-11-21; early-shard reopen trigger to 2026-11-28) | not touched: `lead-warning.spec.ts` cases passed on every run above, none flaky |

### 2.5 Watch list (test plan section 7), readings at `master` 242c21f7

Read from the four shard logs of run 44899114212 (cases at 25 s or more on a 30 s budget; cases on 60 s or 90 s budgets are not listed unless over 80 %).

| Case | Reading | Trigger status |
|---|---|---|
| SCR-14 Users axe cases (`masters-table-actions.spec.ts`, 768 / 1024 / 1366 px) | 28.7 and 28.4 s [desktop] on two widths; no attempt-1 failure | DL-264 (1) not reached (it is a first-attempt failure); readings of 25 to 30 s are recorded only |
| `users.spec.ts:58` [desktop] | 28.3 s on the retry; attempt 1 failed (32.3 s) | DEF-053 |
| `estimate-form-sections.spec.ts:145`, `:92`, `:431`; `estimate-treatments.spec.ts:87`; `estimate-warning.spec.ts:63`, `:117`; `lead-warning.spec.ts` x3; `approve-override`, `remove-price` | none at 25 s or more on this run; no attempt-1 failure | triggers 3, 5, 6, 7 not reached |
| `estimate-form-sections.spec.ts:161` [tablet] | attempt-1 failure on 44892640890 (not a ruled wave; shard 2 of that run read slow, 20.4 min) | **new watch entry**: same signature as `:145`; apply the `:145` rule (the next attempt-1 failure outside a ruled wave is a Bug the same day) |
| `estimate-fasteners.spec.ts:171`, `:198` [desktop] | flaky at the first 30 s of shard 4 on 44894461614; `:198` read 33.0 s [desktop] on 242c21f7 (60 s budget) | **new watch entry** (early-shard cluster, DL-269 (2)(c)) |
| `auth.setup.ts:165` "make the E2E Admin the one active Admin" | 30 to 39 s on every run (setup project, 120 s budget) | evidence only |

## 3. Traceability: acceptance criteria

**Method.** 104 Jira stories (`project = AQP AND issuetype = Story`): 101 Done; AQP-355 (09.08, human step), AQP-370 (10.08) and AQP-371 (10.09) are To Do. A script (not committed) read the 673 test and spec files in `tests/` (unit 436, integration 109, security 21, acceptance 21, E2E 81, perf 5) and matched story keys (`AQP-nnn`, `STORY-nn.mm`) and `AC-n` in test titles and describe blocks, then listed per story the ACs cited and the numbers missing from 1..max. **Limits:** (a) I read the full Jira AC text for five stories only (AQP-318, AQP-335, AQP-369, AQP-370, AQP-371), because 104 descriptions do not fit in one session; for the rest the evidence is that tests cite AC-1..AC-n without a hole. (b) A story whose last ACs are not cited cannot be seen this way; (c) a cross-reference such as "STORY-01.03 AC-6" can inflate the highest number (AQP-335 shows "AC-8", but the story has five ACs, all cited). Where I checked, the apparent gap was a citation habit, not a missing test.

**Result for the 101 Done stories:** every one has tests that cite its ACs (AQP-375, STORY-10.09a, was not in my key map; its tests are named in the 10.09 paragraph); 78 of the 100 mapped Done stories have no gap in the numbering. The others, with what I could confirm:

| Story | Numbers not cited in a test title | Confirmed how | Verdict |
|---|---|---|---|
| AQP-28 (10.02) AC-5; AQP-169 (10.10) AC-4; AQP-188 (10.13) AC-1, AC-2; AQP-208 (10.15) AC-1; AQP-227 (10.17) AC-3; AQP-243 (10.19) AC-1, AC-4; AQP-245 (10.21) AC-3 | enabler or measurement ACs | their G7 reports (`docs/07-qa/AQP-nnn-test-report.md`): inspection, CI stage 11b, Actions-API measurements | covered by a measurement, no test by design. **AQP-208 AC-1 now fails:** the nightly median must be at most 6:00 and p95 at most 7:00; it reads 20:17 and 22:15 (section 2.1) |
| AQP-326 (06.09) AC-2, AC-3; AQP-334 (07.04) AC-6; AQP-356 (01.09) AC-8; AQP-307 (02.09) AC-3; AQP-339 (05.13) AC-1 | cited in the PR table, not in a title | PR #470, #511, #508, #413, #421 bodies name the test for each (same-file "AC-2" case; integration AC-6; `createLateFailingRunner` AC-8; unit, screen and integration; CI Stage 11b 179,084 B) | covered; title citation to fix if the guard is wanted |
| AQP-369 (10.07) AC-1, AC-2, AC-3, AC-5, AC-8 | proved by an inventory table (`tests/support/screen-states.ts`) and the guard test; AC-4, AC-6, AC-7 cited | PR #565 body; Jira AC text read | covered at unit level. **Gap: AC-8** (three widths, axe and keyboard for the new `error.tsx` pages) has no Playwright case (PR deviation 3: a thrown render cannot be driven without fault injection). Sev-4; fold into STORY-10.08 |
| AQP-310, AQP-311, AQP-312 (Windows install, backup, restore): AC-2, 3, 4, 7 / AC-2, 6, 7 / AC-6, 9 | scripts, not Vitest | the Windows package workflow (install, update, rollback, Pester) is green on every push; the Pester suites are not mapped one by one to ACs | **not individually confirmed**; AC-8 of AQP-312 is the Accucut IT kit (manual, G8-C-AC8) |
| AQP-81 (01.05) AC-8; AQP-294 (03.06) AC-5, 6, 7; AQP-299 (06.01) AC-7; AQP-331 (07.01) AC-8; AQP-364 (07.07) AC-8 | no citation found | not confirmed (AQP-335 suggests cross-reference noise) | **unconfirmed**: check the AC text and name a test in the next pass |
| AQP-355 (09.08) | by nature | human step | see section 8 |

**STORY-10.08 (AQP-370), nine ACs: not built.** There is no `playwright.sweep.config.ts`, no `tests/e2e-sweep/`, no `sweep-covers-manifest` guard (AC-3), no Firefox or WebKit project (AC-6, NFR-019), no extra sizes (AC-5), no five-flow keyboard suite (AC-4; per-story keyboard cases exist in many specs), and no manual-check checklist (AC-9). Per-story Playwright specs with axe at three widths do exist (81 spec files, 2,075 cases at 242c21f7), so SPEC section 14 item 13 is covered story by story, not for "every screen" by one sweep. NFR-019 (browser compatibility) has **no evidence at all**.

**STORY-10.09 (AQP-371), ten ACs: half built.** Delivered under STORY-10.09a (AQP-375, Done): AC-5 (error logging: `onRequestError`, user ID on the route error line; `tests/unit/observability-faults.test.ts`), AC-6 (one job wrapper `runJob`; `job-wrapper.test.ts`), AC-7 (heartbeat and health; `health-route.test.ts`, Windows package asserts). **Not built:** AC-1 to AC-4 (the 25-user load script and the page latency during an export, the 50-user run, the 500-node answer), AC-9 (the nightly job "Capacity and latency"), AC-8 (the "Uptime monitor" section of `deploy/windows/README.md`; the README has no such section). This is final-review PRF-F-01 (#573).

## 4. Traceability: functional requirements

The PRD (`docs/02-product/prd.md`) has 108 FR rows. FR IDs are not cited in test titles (tests cite story and AC IDs; the FR link sits in each Jira story's Trace line), so FR to test is not machine-checkable from the repository. What I did: counted FR-ID mentions in `src`, `tests`, `deploy`, `scripts`, `prisma`; for the 30 FRs with no FR-ID mention in `tests` I checked the behaviour of a sample.

| Group | FRs | Finding |
|---|---|---|
| In scope, implemented by a story (a sample spot-checked, not each one) | FR-013, 017, 032 to 035, 039, 041, 042, 045 to 047, 051, 052, 054, 059, 072, 085, 086, 089, 099, 102, 105 | implemented; spot-checked: Enter moves focus (`estimate-fasteners.spec.ts` "Enter goes S, T, U, V"), decimal keyboard (`field-renderer.tsx` `inputMode`), 12-hour session (`aqp-38-sign-in.test.ts`, `session-ended.spec.ts`), SEO metadata (STORY-10.03 tests), queue filters (STORY-04.06) |
| FR-091 (install and update scripts) | | no unit test by ID; covered by the Windows package workflow and the Pester suites |
| Out of scope by decision (FR-090, 092, 094, 095, 096, 097) | | absent, as the test plan section 1.3 says: one "not present" check each, not run (needs a live app; listed in section 8) |

**No in-scope FR was found with no implementation.** I did not map each FR to one named test; that is a gap in the method, not a finding. A Jira-side FR to story to AC export would close it.

## 5. Risk-based exploratory checks (by reading; no live app)

| Area | What I read | Result |
|---|---|---|
| Engineer cost visibility (NFR-002) | `tests/e2e/canary-scan.spec.ts` (1,068 lines; scan of every page, payload, header and script as an Engineer, with positive controls that find the canary values in what the Admin and Lead get, and negative controls that plant a sentinel); `tests/security/` (21 files: role matrix, manifest completeness, strict schema, mail confidentiality, rates-changed restricted, config history and field confidentiality, engineer choice section, password-reset enumeration, CSRF); Stage 11 and 12 green on `242c21f7` | **Pass on paper and in CI.** The scan covers the queue, task page, Calculate, export refusal, cost details refusal. It does not drive the 08.08 Engineer form with the new sections or the 04.06 filters in the E2E scan; `engineer-choice-section.test.ts` and the manifest tests cover them. A live Engineer session with view-source and the network panel stays on the release list |
| Authentication and reset | `password-reset-enumeration.test.ts`, `aqp-38-sign-in.test.ts` (lock-out, throttle), STORY-01.06 session tests, reset pages' `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer` in `next.config.ts` | Pass. Open Minors (not graded by me): #560 (timing, shared-address limit, token in access logs; the last depends on the proxy of STD-F-02), #558 (unused reset links survive another password change), #509 (stale Admin request after hand-over). **DEF-054** is the auth-adjacent Sev-2 |
| Approvals, step-up, immutability | `tests/integration/approval/immutability.test.ts`, `aqp-approved-immutable.test.ts` (database-grant refusals 42501), step-up (AQP-300, 10 ACs cited) | Pass. DEF-054 (framing of Approve and step-up dialogs) and DEF-038 (Fasteners "None") are the open items |
| Exports | `rows-and-pictures.test.ts:343` plants `=1+1`, `+SUM(A1)`, `-2+3`, `@A1` and control-character prefixes and reads the cell back | **Formula injection (#394) is tested and held**; #394 is still open on GitHub and should be closed with that test as evidence. `tests/perf/` (50x50, 500, concurrency, memory) exists but runs only on demand, never in CI (#563): the 500-node figures (14 to 67 s, about 1 GB, DL-271) are from one delivery PC |
| Mail | `src/server/mail/transport.ts` (password over STARTTLS; OAuth2 client-credentials for Microsoft 365 with token fetch), outbox tests, `mail-confidentiality.test.ts` | Pass for the design. **DEF-055** found. The real send is not tested (Q-18 not answered) |
| Configuration revert and versions | STORY-08.05, 08.06 (19 test files cite it), 08.07; the one-Admin and step-up rules | Pass on paper; no live revert was run |
| Windows install and restore documents | `deploy/windows/README.md` (Install, Update, Look and fix, Backups, Restore with JEA), the Windows package workflow | Present and exercised in CI. Missing: "Uptime monitor" (10.09 AC-8); the reverse-proxy requirements (STD-F-02, #576); the rollback plan (G8 evidence item A9) |
| Security headers | `src/proxy.ts`, `next.config.ts`, repo-wide search | **DEF-054** |

## 6. Defects

### 6.1 New, logged in this run

| Bug | Key | Mirror | Sev | Type | Summary |
|---|---|---|---|---|---|
| DEF-054 | [AQP-384](https://sankumar76.atlassian.net/browse/AQP-384) | [#37](https://github.com/sankumar76/Accucut-Quotation/issues/37) (existing follow-up, relabelled `bug`, `sev-2`) | Sev-2 | Product | No page response carries a CSP, `frame-ancestors`, `nosniff` or `Permissions-Policy`; architecture section 8 and ADR-010 require them. Same finding as STD-F-01. File: `docs/07-qa/defects/DEF-054-no-page-security-headers.md` |
| DEF-055 | [AQP-385](https://sankumar76.atlassian.net/browse/AQP-385) | [#578](https://github.com/sankumar76/Accucut-Quotation/issues/578) (existing, label `sev-2` added) | Sev-2 | Product | Assignment e-mail rows have no `sendBefore` and are written while `FEATURE_EMAIL` is off; the first real send (09.08) or an outage sends every old mail. Same finding as QLT-F-01. File: `docs/07-qa/defects/DEF-055-assignment-e-mail-rows-never-expire.md` |

Both are QA's own reading of the code, graded Sev-2 on test plan section 6; the reviewers' Major findings are the same items. The GitHub issues already existed (search before create), so no second mirror was made.

### 6.2 Open before this run (reconciled)

| Bug | Jira | GitHub | Sev | State |
|---|---|---|---|---|
| DEF-034 | AQP-288 In Progress | #347 open | Sev-2 | no PR; blocks G8 (DL-275 A2) |
| DEF-038 | AQP-341 In Progress | #462 open | Sev-2 | no PR; data path, combined review first (DL-275 A2); no defect file exists |
| DEF-053 | AQP-383 In Progress | #569 | Sev-3 | section 2.4 |
| DEF-052 | AQP-382 To Do | #550 | Sev-3 | watch |
| DEF-033, 036, 040, 043, 018 | AQP-287, 290, 343, 346, 225 To Do | #345, 364, 468, 481, 117 | Sev-3 | fix or accept in writing at G8 (test plan section 6) |
| DEF-019, DEF-042 | AQP-226, 345 To Do | #118, 480 | Sev-4 | backlog |

### 6.3 Sev-3 and Sev-4 observations, listed, not logged as Bugs

1. Nightly red six of six (CI feedback time) hides any new nightly signal (section 2.1). Process; frozen by DL-235.
2. NFR-019 browsers, NFR-010 and NFR-011 loads and NFR-009 key-screen figures have no evidence (STORY-10.08, 10.09, PRF-F-01 and PRF-F-02). Tracked by the stories and reviews.
3. `ci.yml` header comment on Stage 13 and the "Docker Compose" line in `CLAUDE.md` section 1 are stale after ADR-015 (Windows native services). Sev-4.
4. Test-title citation: ACs proved only in a PR table (section 3) cannot be found by a script. Sev-4.
5. `estimate-form-sections.spec.ts:161` and `estimate-fasteners.spec.ts:171`, `:198` flaky (section 2.2).

## 7. Reconciliation of defect records (DL-275 (A9), QA part)

| Item | Finding | Action (owner) |
|---|---|---|
| GitHub #127 (DEF-021) and #128 (DEF-020) | open; Jira AQP-234 and AQP-235 are Done | close both with a comment naming the Jira Done (orchestrator or QA, with master's word) |
| Defect files DEF-020 and DEF-021 | Status "New" | update to Closed (qa-engineer, next pass) |
| Defect files DEF-024, 025, 026 | "closes with the merge and master's G7" | update (qa-engineer) |
| No defect file for DEF-013, DEF-037 to DEF-044 | Jira Bugs AQP-197, 340, 341, 342, 343, 344, 345, 346, 347 exist, files do not (DEF-038 is Sev-2 and open) | write the files (qa-engineer) |
| #394 (Excel formula injection) | open; the case is covered by `rows-and-pictures.test.ts:343` | close with that evidence (developer or QA) |
| Jira Done stories with an open follow-up issue | about 70 open follow-up and tech-debt issues | DL-275 (A14) lists the Minors; master states the accepted list at G8 |

QA did not change the GitHub issue states or the defect files above in this run (not asked); the two new files are DEF-054 and DEF-055.

## 8. Manual and live steps still needed for G8 and the release round

| # | Step | Owner | Needed by | Notes |
|---|---|---|---|---|
| 1 | **G8-C-AC8:** Accucut IT runs the AQP-312 AC-8 kit on a real Windows Server | delivery lead and Accucut IT; orchestrator tracks | before 1 Dec, else move G8 or accept in writing (D3) | QA reviews the kit's result |
| 2 | **G8-C-NFR10:** answer OQ-PM-05 or accept 14 to 67 s at 500 nodes (D1); re-read `npm run test:perf` AC-1 and AC-2 on the target host or the rehearsal machine | delivery lead (D1, by 26 Nov), then qa-engineer; the host is D4 | after the host is named | QA proposes the run be a CI workflow-dispatch on a runner as well, so the figures exist on a second machine (#563 asks for the nightly job after G8) |
| 3 | **G8-C-NFR9:** the five key screens measured (LCP, TBT, Wi-Fi profile, median of 5) | developer (`KEY_SCREENS` in `lighthouserc.cjs`), reviewer-performance | early, the performance review depends on it | nightly Lighthouse reads `/` only |
| 4 | **09.08 (AQP-355):** one real send on the real mailbox; Q-18 mail settings from Accucut IT (about 28 Nov, D2) | delivery lead and Accucut IT, then qa-engineer | G8, or defer formally | fix DEF-055 first; check with Mailpit that no stale mail goes out when `FEATURE_EMAIL` is switched on; test the OAuth2 path on the real tenant |
| 5 | Live header check on the release candidate: `curl -I` on `/sign-in` and a signed-in page, and framing of `/sign-in` from another origin | qa-engineer | after DEF-054 is fixed | verifies DEF-054 |
| 6 | Live Engineer session: view-source and network panel on queue, task, form (with the 08.08 sections), Calculate, export refusal; the canary scan result stays the gate | qa-engineer | release round | NFR-002 |
| 7 | Excel desktop open of a real export (50 and about 500 nodes) | qa-engineer | release round | formats and pictures; #440 (currency symbols and grouping) |
| 8 | Real phone, tablet, screen reader, Windows high contrast on the changed screens; keyboard run on key screens; the five WCAG criteria axe cannot judge | qa-engineer with the delivery lead (devices) | release round | test plan section 12; STORY-10.08 AC-9 not built |
| 9 | NFR-010 25-user page and save timing; NFR-011 at 25 and 50 users and the 500-customer volume | developer builds the script (AQP-371 AC-1 to AC-4); qa-engineer runs on the rehearsal machine | after the script exists | PRF-F-01 |
| 10 | Browser matrix: Firefox and WebKit journeys at 360 and 1366 px (NFR-019) | developer builds (AQP-370 AC-6); qa-engineer reads | lanes permitting | no evidence today |
| 11 | Windows package install with a backup and restore rehearsal on a clean server; restore by the actual Admin from the README alone | delivery lead (as Admin and IT, QA-A5), Accucut IT | before G8 | test plan section 14; add the "Uptime monitor" and proxy sections first |
| 12 | Absent-feature checks (FR-090, 092, 094, 095, 096, 097) and the usability test (test plan section 13) | qa-engineer, delivery lead | release round | not run |
| 13 | Full regression again on the final `master` head after the freeze | orchestrator runs, qa-engineer reads | the day after the last merge (planned 29 Nov) | every change after it needs a new pass |

## 9. Watch list and risk register: what QA asks master to decide

1. Reopen RISK-031 (triggers 1 and 2, section 2.3), or rule that today's `master` timeouts were a wave.
2. Put DEF-053 first in lane 3, since `master` has been red from it once and flaky on it twice today; decide whether DL-275 (I)'s helper change is enough or the case is split too.
3. Add `estimate-form-sections.spec.ts:161` and `estimate-fasteners.spec.ts:171`, `:198` to the watch list with the `:145` rule.
4. State the nightly's red as accepted (or change the gate) so a real nightly failure can be seen.
5. Record DEF-054 and DEF-055 on the pre-G8 list (A2) beside DEF-034 and DEF-038; both also appear in the reviewers' Major lists.

## Hand-off
- Status: COMPLETE (report written; nothing was run locally; no workflow re-run)
- Artefacts written/updated: `docs/07-qa/final-regression-report.md`, `docs/07-qa/defects/DEF-054-no-page-security-headers.md`, `docs/07-qa/defects/DEF-055-assignment-e-mail-rows-never-expire.md`
- Jira / GitHub updates: Bugs AQP-384 (DEF-054) and AQP-385 (DEF-055); GitHub #37 and #578 relabelled and commented; hand-off comment on AQP-1; comment on AQP-383
- Open questions: none new (D1 to D4 of DL-275 stay open)
- Risks raised: RISK-031 reopen triggers 1 and 2 met (master to rule); nightly permanently red; NFR-019, NFR-010, NFR-011 and NFR-009 key-screen figures unevidenced
- Recommended next agent: orchestrator, to route DEF-054, DEF-055, DEF-034 and DEF-038 into the developer lanes and DEF-053 first in lane 3; then master for the RISK-031 ruling

## Addendum, 2026-11-21 (later the same day; rulings after this report)
- **#382** (AQP-293 SQR-01) is off the list of G8-blocking Majors (DL-284 (3)); its remaining items are Minor. Section 1's table of blockers is read without it.
- **DEF-038** was re-graded to Sev-3, type Test (DL-277), and **DEF-034** is closed (fix #579); the Sev-2 count in section 1 is therefore DEF-054 and DEF-055 only. **DEF-053** is closed (fix #571) with a watch of 1 of 2 (DL-284). **DEF-056** (AQP-386) is a Test defect (DL-283); **DEF-057** (AQP-387) is open. **RISK-031** was reopened by DL-276.
- This report is not edited above this line; the current state is in `docs/07-qa/test-plan.md` section 7 and the defect files.
