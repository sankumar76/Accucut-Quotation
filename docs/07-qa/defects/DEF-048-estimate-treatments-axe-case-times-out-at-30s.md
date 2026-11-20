# DEF-048: `estimate-treatments.spec.ts:238` AC-8 axe-scan case exceeds its 30 s budget (28.6 s on `master`, 30.4 s and 32.7 s on PR #510); `estimate-tree.spec.ts:313` is the same class and in scope

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.06 (AQP-314, Done) owns `estimate-treatments.spec.ts:238` (its AC-8). STORY-05.02 (AQP-302, Done) owns `estimate-tree.spec.ts:313` (its AC-3). Seen on PR #510 (AQP-336, STORY-07.06), which is not the cause. **No AC fails:** neither failing attempt shows an `expect` message or an axe violation list. NFR for accessibility and AC-8 are not shown to regress |
| Severity | **Sev-3 Moderate, graded by qa-engineer, provisional** (DL-256 (B)), on the test-plan scale: a Test-type defect, fails closed (a red required check), workaround is a re-run under rule R6, no product behaviour affected as far as the evidence shows. **Re-grade to a Product defect** (Sev-2 if the part form serves or renders slowly enough to matter to a person, graded by the figures) if hypothesis 4 below shows it. Same grade family as DEF-045 to DEF-047 |
| Priority | P3 on its own; **takes the first lane that frees and is not already promised**, ahead of any new story (DL-256 (D)). Pre-emption: a second head red on R6's signature, or any `master` push run red on it, gives it a lane at once, but never a slot the delivery lead promised without asking the delivery lead first |
| Type | **Test** (E2E, Playwright, `tablet` project; duration-tail class). No product defect found |
| Status | **Closed 2026-11-20 (qa-engineer).** Both halves of the amended proof (DL-257 (A)) are met: PR #531's run of record 44737067927 and the first `master` push run after the merge whose Stage 2 is green, 44739529276. See "Closure" below. Fixed by the developer (PR #531, squash 402485c); not fixed by QA |
| Jira / GitHub | [AQP-377](https://sankumar76.atlassian.net/browse/AQP-377) / [#530](https://github.com/sankumar76/Accucut-Quotation/issues/530); Jira "relates to" AQP-314, AQP-302, AQP-336 and AQP-376, and (2026-11-19) [AQP-378](https://sankumar76.atlassian.net/browse/AQP-378) = DEF-049 |
| Risk / rule | RISK-031 stays open at 9 (DL-256 (6), DL-257 (8), DL-259 (4)); this Bug's part of its close-out is met (proof below), but the risk's other conditions are not (see "Closure"). Rule **R6 ended at this Bug's close-out** (DL-257 (C)); its text below is kept as history. The near-budget watch list moved to DEF-049 (below) |

## Closure (2026-11-20; qa-engineer)
**Result: P1 met, P2 met, P3 met (in the diff, as master read it in DL-257 (A)); 15 s reported. DEF-048 is closed.** QA read the job logs of both runs itself (every shard of each; per-test durations matched by project, file, line and title; the five cases are the ones listed in "Re-pointing", identified by file and title), not only the orchestrator's comments (AQP-377 comments 12383 and 12390), and the figures agree with them.

| Run | Head | Required check | P1: first attempt, 15 cases | P2: worst | Over the 15 s target |
|---|---|---|---|---|---|
| PR #531, run of record 44737067927 (shards: jobs 136291009130, 136291009468, 136291009520, 136291009599) | 85735d86 (up to date with `master`; diff = the two spec files) | `Stages 1 to 11` success; shards 476, 470, 471, 455 passed, 0 flaky, 0 retries | **15 of 15**, no retry | **13.0 s** (list open, mobile) | **0 of 15** |
| `master` push 44739529276 (jobs 136299349496, 136299349610, 136299349579, 136299349142) | 402485c (#531's squash) | fully green, Stage 2 green; shards 475 (+1 flaky), 470, 471, 455 passed | **15 of 15**, no retry | **18.3 s** (confirm, mobile) | **5 of 15** |

Readings, seconds, mobile / tablet / desktop:

| Case | #531 run 44737067927 | `master` push 44739529276 |
|---|---|---|
| treatments AC-8 closed | 8.0 / 11.8 / 9.6 | 12.9 / 16.0 / 8.2 |
| treatments AC-8 list open | 13.0 / 12.0 / 9.9 | 14.9 / 16.9 / 8.5 |
| treatments AC-8 "Other" showing | 11.0 / 10.9 / 10.9 | 17.8 / 15.5 / 8.8 |
| tree AC-3 Cancel | 9.6 / 8.7 / 7.3 | 10.2 / 11.3 / 8.1 |
| tree AC-3 confirm | 9.8 / 12.2 / 10.0 | 18.3 / 12.1 / 9.9 |

The only flaky on `master` push 44739529276 is `approve-override.spec.ts:155` [mobile], not a DEF-048 case; it is logged as DEF-050 (AQP-380, #539). The earlier reading (master, run 44580739670: all 30 readings first attempt, worst 22.5 s) is unchanged. PR #531 merged 2026-11-20 12:53Z as 402485c (the diff is the two spec files only; nothing under `src/`, support, config, ci.yml or dependencies).

**What stays open.** (1) **RISK-031** (master's): its close-out also needs DEF-047's proof, DEF-049's proof, and a `master` push run with 0 time-out-mode flaky. The last is **not met on 44739529276**: its one flaky (`approve-override:155` [mobile], 30.1 s, `page.evaluate` time-out) is a time-out-mode flaky, now DEF-050. (2) **R6 ended** with this closure (DL-257 (C)); a failure of any of the five cases is no longer covered by a re-run rule. If one fails again, QA reopens this Bug (Status Reopened) and tells master at once. (3) **The near-budget watch list** is no longer here; it lives in DEF-049 (section "Near-budget watch list"), where it is kept current.

## Re-pointing after the #531 split (DL-257, 2026-11-19; qa-engineer, QA artefacts only)
**1. The five new cases (replace `estimate-treatments.spec.ts:238` and `estimate-tree.spec.ts:313`), each identified by file and title, not by line** (lines are those of b0320c05):

| # | File | Describe | Title | Line |
|---|---|---|---|---|
| 1 | `tests/e2e/estimate-treatments.spec.ts` | "AC-8: the screen at 360, 768 and 1366 px" | "AC-8 (closed): no sideways scroll, axe finds nothing, and the trigger and the field are 44 px high" | :241 |
| 2 | `tests/e2e/estimate-treatments.spec.ts` | same | "AC-8 (list open): every checkbox is 44 px, there is no sideways scroll, axe finds nothing, and Escape closes the list" | :250 |
| 3 | `tests/e2e/estimate-treatments.spec.ts` | same | "AC-8 ("Other" showing): the box is 44 px high, there is no sideways scroll and axe finds nothing" | :265 |
| 4 | `tests/e2e/estimate-tree.spec.ts` | "AC-3: delete asks first and names the count" | "AC-3: a part with 2 sub-parts: the dialog names 3 parts and Cancel is the safe choice; Cancel changes nothing" | :348 |
| 5 | `tests/e2e/estimate-tree.spec.ts` | same | "AC-3: a part with 2 sub-parts: confirming deletes all three" | :365 |

The AC-3 case with no sub-parts (:382) was not one of the two original cases and is not in scope. `estimate-treatments` AC-2 "every treatment chosen" (was :264, :275 after #531) is **not** in this Bug: it moved to DEF-049 (AQP-378, #533), with `estimate-form.spec.ts` AC-9 (:224).

**2. Amended proof (DL-257 (A)); it replaces "at most 15 s at each width" (DL-256 (5)).** Read by the orchestrator from the job logs and posted on AQP-377, on two runs: #531's run of record, and the first `master` push run after the merge whose Stage 2 is green.
- **P1:** each of the five cases passes on its first attempt at all three widths (mobile, tablet, desktop).
- **P2:** each takes under 25 s at every width (at least 1.2x inside the 30 s budget; 25 s is QA's near-budget line).
- **P3 (structural floor, met in this diff):** each case opens the page once and runs at most one axe scan. A later change that adds a second page open or scan to one of these cases needs master.
- **15 s stays the target for a quiet draw.** The count of readings above 15 s is reported and does not gate.
- If P1 or P2 fails on either run, DEF-048 stays open, R6 continues, and the developer brings the measured phases to master. No further fix goes into an unrelated PR.
- **Reading so far (master, DL-257 (1), run 44580739670, both attempts):** all 30 readings (5 cases x 3 widths x 2 attempts) passed on the first attempt; worst 22.5 s ([tablet] closed, attempt 2, 75 % of the budget); 11 of 30 above 15 s. These are master's figures; QA did not re-read the logs for this record. The proof is not complete until the `master` push run after the merge has been read.

**3. R6 as amended (DL-257 (4), amends DL-256 (3)).** Duration: until DEF-048 is closed under the amended proof, no longer only until its fix PR has merged. **(b) now reads, as master wrote it:**
> the failed test is exactly one of these. On a head that contains #531's squash commit, one of the three cases in `tests/e2e/estimate-treatments.spec.ts`, describe "AC-8: the screen at 360, 768 and 1366 px": "AC-8 (closed): no sideways scroll, axe finds nothing, and the trigger and the field are 44 px high", "AC-8 (list open): every checkbox is 44 px, there is no sideways scroll, axe finds nothing, and Escape closes the list", or "AC-8 ("Other" showing): the box is 44 px high, there is no sideways scroll and axe finds nothing" (:241, :250 and :265 on b0320c05). On a head without that commit, the old `:238:3` case as written in DL-256 (3). Any project. Each test is identified by file and title, not by line.

(a), (c), (d) and (e) are unchanged. (a) still requires every red shard to say `1 failed`, so two AC-8 cases failing in one shard come to master. **The two `estimate-tree` cases (#4 and #5) stay outside R6**, for the reason in DL-256 (3): their time-out shows as an `expect` wait on the state their own action makes. A flaky is allowed and is listed here; failing on both attempts goes to master at once. **Never re-run, and report at once:** as in DL-256 (3). In addition, after #531's merge, an AC-8 case failing on both attempts may be re-run once under R6, but it is a P1 failure: the orchestrator reports it to master the same day, and DEF-048 cannot close on that run. A head without #531's commit cannot merge once #531 has merged (`strict: true`), so it takes "Update branch", which is not a re-run (DL-254 (C)).

**4. Merge route for #531 (DL-257 (2), for the record).** The orchestrator squash-merges when the required check `Stages 1 to 11` is `success`. Stage 2 is red repo-wide ("leaks found: 3", RISK-027 pattern) until the delivery lead deletes the old branch; after that, failed jobs only are re-run if #531 is not behind `master`, or "Update branch" is used if it is. A P2 miss on that new run does not block the merge; it keeps DEF-048 open.

**5. Ruling B (DL-257 (3)):** the direct-row insert of the two sub-parts in #531's Cancel and confirm cases is accepted as test set-up (the delete is the subject, not the add). QA notes it so a later reader of `estimate-tree.spec.ts` does not read it as a dropped assertion.

**6. Watch only, no Bug (DL-257 (E)):** `estimate-save.spec.ts:107` [mobile], `rates-changed.spec.ts:135` [tablet] and `unlock.spec.ts:186` [mobile]. A second occurrence of any one of them on any run means QA logs a Bug the same day and tells master. None may be re-run under any R-rule.

**7. Superseded below:** the "Expected Result" sentence about 15 s per case, the "Binding" proof sentence, the "Rule R6 (until the fix PR has merged)" section and the "Fix & Verification" proof row are left as first written (history) and are read together with this section; where they differ, this section governs.
| Found by / date | CI. PR #510 run 44540150487 (head fc8b10a), shard 2, job 135615976339; margin seen on `master` push run 44509175744 (head 0056227). Evidence read by master (DL-256, 2026-11-19) and re-read by qa-engineer from the job logs; logged by qa-engineer, 2026-11-19 |
| Build / commit | PR head fc8b10a (red); `master` 0056227 (tip at run 44509175744) and 4232a36 (run 44540107462). Specs read at `origin/master`; not edited |
| Environment | GitHub Actions `ubuntu-latest`, 4 vCPU and 15,983 MB, Stage 12 E2E shard 2 of 4, `Running 458 tests using 4 workers` on the `master` run; one development server and one PostgreSQL shared by the four workers; invented data only |

## Steps to Reproduce
Not reproducible on demand: one red head, none locally attempted (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR; the shard that holds `estimate-treatments.spec.ts` and `estimate-tree.spec.ts` (shard 2 of 4 in these runs).
2. Watch `[tablet] tests/e2e/estimate-treatments.spec.ts:238:3` and `[tablet] tests/e2e/estimate-tree.spec.ts:313:3`.

## Expected Result
Every case inside its 30 s budget with margin (the master's proof target is at most 15 s per case, DL-256 (5)).

## Actual Result
Run 44540150487 (PR #510, head fc8b10a), shard 2: `1 failed, 1 flaky, 6 skipped, 454 passed (21.8m)`.

| Test | Attempt 1 | Retry (Playwright `retries: 1`) | Error location |
|---|---|---|---|
| `[tablet] estimate-treatments.spec.ts:238:3` AC-8 | **failed, 30.4 s** | **failed, 32.7 s** | `Test timeout of 30000ms exceeded.` plus `page.evaluate: Test timeout of 30000ms exceeded.` inside `AxeBuilder.analyze` (`@axe-core/playwright` `index.mjs:219`, cause in `finishRun`), at **`tests/e2e/support/design-system.ts:96`** (`new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()`). Attempt 1 reached it through `expectFormAccessible` (`support/part-form.ts:83`) from **spec :261** (last scan, "Other" showing); the retry through `expectNoAxeViolations` from **spec :253** (scan with the list open). No `expect(...)` message and no axe violation list on either attempt |
| `[tablet] estimate-tree.spec.ts:313:3` AC-3 (delete of a part with 2 sub-parts) | **failed, 30.2 s** (flaky) | passed, 29.1 s | `Test timeout of 30000ms exceeded.` with **`expect(locator).toBeVisible()` failed, `element(s) not found`** on `getByText('No parts yet. Choose "New item" to add the first one.')` at **:344, after `page.reload()`**, its 15 s expect still waiting when the 30 s budget ended |

The `toBeVisible` and `element(s) not found` lines belong to `estimate-tree :313`, not to `estimate-treatments :238` (master, DL-256 (1) ii). The `[WebServer] Error: The destination stream errored while writing data.` lines (3 in that run, about 9 minutes before) are pre-existing noise on green runs and are not part of either signature.

### Durations of the same two tests, `[tablet]`, on other runs
| Run | Head | estimate-treatments :238 | estimate-tree :313 |
|---|---|---|---|
| `master` push 44509175744 | 0056227 | **28.6 s** (95 % of 30 s), passed | **28.1 s**, passed |
| `master` push 44540107462 | 4232a36 | 21.4 s | 19.4 s |
| PR #510 run 44540150487 | fc8b10a | **30.4 s and 32.7 s, failed** | **30.2 s failed, 29.1 s passed** |

Other widths, `master` run 44540107462: :238 at 16.5 s (mobile) and 19.4 s (desktop); :313 at 17.4 s and 21.4 s. So the **tablet** case is the slow one. Per master (DL-256 (1)): on #510's own earlier head a5548c7 (run 44494663177) they took 15.4 s and 18.3 s; the whole of shard 2 on the red run took 1.27x the time of `master` run 44540107462 (median per-test ratio 1.28), led by files #510 does not touch (estimate-form 1.71x, estimate-picture 1.60x, lead-warning 1.48x, cost-details 1.40x). Both runners report 4 vCPU and 15,983 MB. #510's `src/` changes are the export and review screens; neither spec opens them and neither imports `calculated-estimate.ts` or `fake-calculations.ts`.

## Evidence: every E2E case at 25 s or more on the last two `master` push runs (history, 2026-11-19; the live list is in DEF-049, "Near-budget watch list")
Source: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/<id>/logs` for all four Stage 12 shards of run **A = 44509175744** (jobs 135508596948, 135508596988, 135508597038, 135508597129) and run **B = 44540107462** (jobs 135615825924, 135615825981, 135615826064, 135615826150); per-case times are the `(N.Ns)` suffix of each Playwright line (scratch copy, read only, no CI re-run). Each run lists about 1,800 timed lines (cases and retries). "Budget" is the test's own, read from `origin/master`: 30 s default (`playwright.config.ts`), 60 s where the file sets `test.setTimeout(60_000)` (`estimate-save`, `estimate-picture`), 90 s where the test calls `test.slow()` (`estimate-fasteners` :113, :149, :198; `estimate-form` :96; `estimate-tree` :235). The `auth.setup.ts:165` set-up case (27.1 to 36.4 s on every shard of both runs, budget 180 s) is left out.

| Case | A (44509175744) | B (44540107462) | Budget |
|---|---|---|---|
| `estimate-treatments.spec.ts:264` AC-2, all eight chosen | tablet 28.8 s | - | 30 s |
| **`estimate-treatments.spec.ts:238` AC-8 (this Bug)** | **tablet 28.6 s** | - | 30 s |
| **`estimate-tree.spec.ts:313` AC-3 (this Bug)** | **tablet 28.1 s** | - | 30 s |
| `masters-table-actions.spec.ts:315` Users (DEF-047, AQP-376) | - | desktop 28.3 s (1366 px), 28.0 s (768), 25.2 s (1024) | 30 s |
| `users.spec.ts:58` AC-1, AC-7 | - | desktop 27.1 s | 30 s |
| `rates-changed.spec.ts:135` AC-10 | - | tablet 27.3 s | 30 s |
| `unlock.spec.ts:186` (see "Not in this Bug") | mobile 27.7 s, a failed attempt | - | 30 s |
| `estimate-treatments.spec.ts:187` AC-4 | tablet 26.5 s | - | 30 s |
| `estimate-treatments.spec.ts:61` AC-1 | tablet 25.0 s | desktop 26.5 s | 30 s |
| `lead-warning.spec.ts:229` AC-5 | - | desktop 26.5 s | 30 s |
| `estimate-form.spec.ts:224` AC-9 | tablet 26.1 s | - | 30 s |
| `remove-price.spec.ts:136` | - | tablet 25.9 s | 30 s |
| `estimate-fasteners.spec.ts:92` AC-2 | - | desktop 25.8 s | 30 s |
| `estimate-save.spec.ts:304` | tablet 37.1 s | tablet 33.2 s, desktop 34.4 s | 60 s |
| `estimate-save.spec.ts:347` | tablet 31.1 s | desktop 29.5 s, tablet 27.5 s | 60 s |
| `estimate-save.spec.ts:335` | tablet 34.2 s | desktop 25.1 s | 60 s |
| `estimate-save.spec.ts:146` | tablet 25.2 s | - | 60 s |
| `estimate-picture.spec.ts:111` | tablet 30.3 s | - | 60 s |
| `estimate-picture.spec.ts:208` | tablet 27.9 s | desktop 28.2 s | 60 s |
| `estimate-tree.spec.ts:235` | tablet 36.8 s | tablet 28.7 s, desktop 28.3 s | 90 s |
| `estimate-form.spec.ts:96` | tablet 31.6 s | desktop 27.5 s | 90 s |
| `estimate-fasteners.spec.ts:113` | tablet 31.3 s | desktop 35.5 s, tablet 25.1 s | 90 s |
| `estimate-fasteners.spec.ts:149` | tablet 25.8 s | desktop 30.4 s | 90 s |
| `estimate-fasteners.spec.ts:198` | tablet 30.5 s | - | 90 s |

**Readings**
1. 13 cases (the first 13 rows) sit at 25 s or more on a 30 s budget. Four reached 28 s or more on a `master` run: `estimate-treatments :264` (28.8 s), `:238` (28.6 s), `estimate-tree :313` (28.1 s) and the DEF-047 case (28.3 s). `:264` is the next candidate after the two in this Bug: it is in the same file, with the same tablet width, at 96 % of its budget; QA names it so the developer can look at the file once. It is **not** added to the scope (master set the scope in DL-256 (4)); master decides.
2. The rest already have a 60 s or 90 s budget; the heaviest, `estimate-save :304` at 37.1 s, is at 62 % of 60 s.
3. Of the cases at 25 s or more on a 30 s budget, tablet and desktop both appear: the tablet project on shard 2 (estimate-*), the desktop project on shard 4 (masters, users).
4. **Not measured, so not known:** the time of each axe scan inside :238, the seeding time, and the server time of the part form. The CI log has only the whole-test time.

### Not in this Bug
`unlock.spec.ts:186` [mobile] "an input changed after the unlock ..." was **flaky on the green `master` run 44509175744**: attempt 1 failed at 27.7 s with `expect(locator).toBeEnabled()` failed on `#review-approve` ("Expected: enabled, Received: disabled", 15 s expect, spec :205) and passed on retry in 12.8 s. That is an assertion wait on a state, not a 30 s time-out, so it is a different mode. One occurrence; reported to master under "Issues for other roles", no Bug raised.

## Measurement hypotheses (developer; measure before changing anything, cheapest first)
1. **Three whole-form axe scans in one test.** :238 calls `expectFormAccessible` (:242), `expectNoAxeViolations` (:253, list open) and `expectFormAccessible` (:261, "Other" showing) after a layout pass over every checkbox; both red attempts stopped inside a scan (:261, then :253). Time each named step alone at tablet width (a named `test.step` exists for the animation wait, `design-system.ts:95`). A test-only option is to split the case into smaller tests that keep every assertion, every scan and every width (allowed by DL-256 (5)); the master's proof target is at most 15 s per resulting case.
2. **Treatment seeding and page loads before the first scan** (`openForm`, `treatmentsLoaded`, `openList` for the eight options): print the time to the first scan.
3. **`estimate-tree :313` after the reload.** A reload of the estimate page on the development server (`next dev`, compile on demand), then the empty-tree words; the 15 s expect was still waiting at 30.2 s. Time the sequence: three clicks to build the tree, the Delete and Cancel steps, the confirm, the reload. Same family as hypothesis 2.
4. **Time to first render of the part form and the tree page on the development server.** If it is slow after the first hit, that is a **product defect**: QA re-grades it and master is told at once.

## Suspected Area
`tests/e2e/estimate-treatments.spec.ts` (the AC-8 case, :238 to :262), `tests/e2e/estimate-tree.spec.ts` (:313 to :345), `tests/e2e/support/design-system.ts:96` (`expectNoAxeViolations`) and `tests/e2e/support/part-form.ts:83` (`expectFormAccessible`). Not `src/`: nothing here points there, but hypothesis 4 can.

## Binding for the fix (DL-256 (5); DL-229 (4)(b))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, axe scan or assertion. Splitting a case into smaller tests that keep every assertion and every scan is allowed. QA first confirms where the time goes (the axe scans of the whole part form, the treatment seeding, or page loads). The fix stays in the two specs or in test-only support; a change under `src/`, `playwright.config.ts`, ci.yml or a dependency means stop and come back to master. **Proof:** every case of `estimate-treatments :238` (or the cases it is split into) and of `estimate-tree :313` takes at most 15 s at each width (mobile, tablet, desktop), on the fix PR's run and on the first `master` push run after the merge, read by the orchestrator and posted on the Bug (AQP-377). The fix takes a separate PR (not folded into #527, whose one-file scope stays).

## Rule R6 (as first written by DL-256 (3); amended by DL-257 (4), see "Re-pointing" above; the duration and (b) below are superseded)
A red run may have its failed jobs re-run once per head only when all of (a) to (e) of DL-256 (3) hold: `Stages 1 to 11b` success and only Stage 12 shards plus the fan-in red, each red shard `1 failed`; the failed test exactly `tests/e2e/estimate-treatments.spec.ts:238:3` (any of the three projects); every attempt's error `Test timeout of 30000ms exceeded.`, alone or with a `page.evaluate`, `locator.*` or `AxeBuilder.analyze` time-out, no `expect` message and no axe violation list; every other test passed (each flaky listed with the re-run); the diff touches none of the listed paths or package versions. A green run with `estimate-tree :313` or `:238` flaky (passed on retry) is fully green; list each flaky here. **Never re-run, and tell master at once:** an `expect` failure or axe violation in :238 (a possible AC-8 regression); `estimate-tree :313` failing on both attempts; a second failure on the same head.

## Re-run list (orchestrator adds each)
| When | PR / run | Head | Result |
|---|---|---|---|
| 2026-11-19 | PR #510, run 44540150487 | fc8b10a | Not re-run (DL-256 (A)): no rule covered it; R5 (e) excluded #510. #510 takes `master` by "Update branch" |
| 2026-11-20 | (closed) | | R6 ended with the closure; no re-run was ever made under R6 |

## Issues for other roles (no defect)
**2026-11-20 (closure):** the near-budget watch list moved to DEF-049 (this Bug is closed). New Bug DEF-050 (AQP-380, #539) for `approve-override:155` [mobile] and `remove-price:136` [tablet]; master is asked to rule on its scope, a re-run rule and a lane (see DEF-050).

**Answered by DL-257 (2026-11-19):**
- `unlock.spec.ts:186` [mobile]: watched, no Bug yet (DL-257 (E)); a second occurrence means a Bug the same day. Not re-runnable under any R-rule.
- `estimate-treatments :264` (28.8 s; 29.4 s on #531): a new Bug, DEF-049 (AQP-378, #533), with `estimate-form.spec.ts` AC-9 (:224) and rule R7 (DL-257 (D)). DEF-048's scope was not widened.
- Also watched (DL-257 (E)): `estimate-save.spec.ts:107` and `rates-changed.spec.ts:135`.

**As first written (history):**
- **master:** `unlock.spec.ts:186` [mobile] flaky on green `master` run 44509175744 (see "Not in this Bug"); one occurrence, an assertion wait, not a budget time-out. QA raised no Bug. Say if it should be tracked; a second occurrence would be a RISK-031 trigger ("a flaky in that mode on two runs in one day" does not apply, the mode differs).
- **master:** `estimate-treatments :264` (28.8 s, 96 % of budget) is the next case at risk in the same file; not in scope unless master widens it.
- **orchestrator:** the register line (RISK-031) and the daily update carry the R6 re-run list; QA did not edit them. The Jira links to AQP-245 named in the brief were not made: AQP-245 is STORY-10.21 (Users list), unrelated to these two specs; DL-256 (4) names AQP-314 and AQP-376, and QA added AQP-302 (owner of `estimate-tree`) and AQP-336 (where it was seen).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Hypotheses 1 to 4 measured; mechanism confirmed or refuted | developer | 2026-11-19 | PR #531 body (phases on diagnostic run 44567048767: 6 to 9 s to open the part form on `next dev`, 2.2 to 3.4 s per whole-form scan; no step hangs; read by master, DL-257 (1)) |
| Fixed (spec or test-only helper) | developer | 2026-11-19 | PR #531, head b0320c05: two files, `estimate-treatments.spec.ts` and `estimate-tree.spec.ts`; every assertion and scan kept (diff checked by master); merge on a fully green required check (DL-257 (A)) |
| Regression test added | developer | 2026-11-19 | the fix is the test change; the original two cases are now the five cases in "Re-pointing" |
| Verified, amended proof: P1, P2, P3 (15 s reported) for the five cases | orchestrator reads, qa-engineer confirms | 2026-11-20 | #531's run of record 44737067927 (15 of 15 on attempt 1, worst 13.0 s, 0 over 15 s) and `master` push 44739529276 on 402485c (15 of 15 on attempt 1, worst 18.3 s, 5 over 15 s); read by QA from the job logs (see "Closure"). **Closed 2026-11-20** |
| RISK-031 close-out (DEF-048 part) | master | | DEF-048's proof is met (2026-11-20). The `master` push run with 0 time-out-mode flaky is **not** met on 44739529276 (`approve-override:155` [mobile] flaky, DEF-050). Master decides |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-19, provisional (DL-256 (B)). It holds no story gate (AQP-314 and AQP-302 are Done; #510 is not the cause). It changes to a Product defect only if the measurement of hypothesis 4 shows the part form or the tree page itself slow; master is told at once, and QA re-grades.
