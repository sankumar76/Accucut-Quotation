# DEF-048: `estimate-treatments.spec.ts:238` AC-8 axe-scan case exceeds its 30 s budget (28.6 s on `master`, 30.4 s and 32.7 s on PR #510); `estimate-tree.spec.ts:313` is the same class and in scope

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.06 (AQP-314, Done) owns `estimate-treatments.spec.ts:238` (its AC-8). STORY-05.02 (AQP-302, Done) owns `estimate-tree.spec.ts:313` (its AC-3). Seen on PR #510 (AQP-336, STORY-07.06), which is not the cause. **No AC fails:** neither failing attempt shows an `expect` message or an axe violation list. NFR for accessibility and AC-8 are not shown to regress |
| Severity | **Sev-3 Moderate, graded by qa-engineer, provisional** (DL-256 (B)), on the test-plan scale: a Test-type defect, fails closed (a red required check), workaround is a re-run under rule R6, no product behaviour affected as far as the evidence shows. **Re-grade to a Product defect** (Sev-2 if the part form serves or renders slowly enough to matter to a person, graded by the figures) if hypothesis 4 below shows it. Same grade family as DEF-045 to DEF-047 |
| Priority | P3 on its own; **takes the first lane that frees and is not already promised**, ahead of any new story (DL-256 (D)). Pre-emption: a second head red on R6's signature, or any `master` push run red on it, gives it a lane at once, but never a slot the delivery lead promised without asking the delivery lead first |
| Type | **Test** (E2E, Playwright, `tablet` project; duration-tail class). No product defect found |
| Status | New. Not fixed by QA (measurement and fix: developer) |
| Jira / GitHub | [AQP-377](https://sankumar76.atlassian.net/browse/AQP-377) / [#530](https://github.com/sankumar76/Accucut-Quotation/issues/530); Jira "relates to" AQP-314, AQP-302, AQP-336 and AQP-376 |
| Risk / rule | RISK-031 stays open at 9 (DL-256 (6)); its close-out now also needs this Bug's proof. Rule **R6** (DL-256 (3)) governs re-runs until the fix PR has merged |
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

## Evidence: every E2E case at 25 s or more on the last two `master` push runs
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

## Rule R6 (until the fix PR has merged)
A red run may have its failed jobs re-run once per head only when all of (a) to (e) of DL-256 (3) hold: `Stages 1 to 11b` success and only Stage 12 shards plus the fan-in red, each red shard `1 failed`; the failed test exactly `tests/e2e/estimate-treatments.spec.ts:238:3` (any of the three projects); every attempt's error `Test timeout of 30000ms exceeded.`, alone or with a `page.evaluate`, `locator.*` or `AxeBuilder.analyze` time-out, no `expect` message and no axe violation list; every other test passed (each flaky listed with the re-run); the diff touches none of the listed paths or package versions. A green run with `estimate-tree :313` or `:238` flaky (passed on retry) is fully green; list each flaky here. **Never re-run, and tell master at once:** an `expect` failure or axe violation in :238 (a possible AC-8 regression); `estimate-tree :313` failing on both attempts; a second failure on the same head.

## Re-run list (orchestrator adds each)
| When | PR / run | Head | Result |
|---|---|---|---|
| 2026-11-19 | PR #510, run 44540150487 | fc8b10a | Not re-run (DL-256 (A)): no rule covered it; R5 (e) excluded #510. #510 takes `master` by "Update branch" |

## Issues for other roles (no defect)
- **master:** `unlock.spec.ts:186` [mobile] flaky on green `master` run 44509175744 (see "Not in this Bug"); one occurrence, an assertion wait, not a budget time-out. QA raised no Bug. Say if it should be tracked; a second occurrence would be a RISK-031 trigger ("a flaky in that mode on two runs in one day" does not apply, the mode differs).
- **master:** `estimate-treatments :264` (28.8 s, 96 % of budget) is the next case at risk in the same file; not in scope unless master widens it.
- **orchestrator:** the register line (RISK-031) and the daily update carry the R6 re-run list; QA did not edit them. The Jira links to AQP-245 named in the brief were not made: AQP-245 is STORY-10.21 (Users list), unrelated to these two specs; DL-256 (4) names AQP-314 and AQP-376, and QA added AQP-302 (owner of `estimate-tree`) and AQP-336 (where it was seen).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Hypotheses 1 to 4 measured; mechanism confirmed or refuted | developer | | AQP-377 comment |
| Fixed (spec or test-only helper) | developer | | `fix/AQP-377-<slug>`, first free lane (DL-256 (D)) |
| Regression test added | developer | | the fix is the test change; both specs keep every assertion and scan |
| Verified: every `:238` and `:313` case at most 15 s at each width | orchestrator reads, qa-engineer confirms at hardening | | fix PR's run and the first `master` push run after merge |
| RISK-031 close-out (DEF-048 part) | master | | fix proof plus a `master` push run with 0 time-out-mode flaky |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-19, provisional (DL-256 (B)). It holds no story gate (AQP-314 and AQP-302 are Done; #510 is not the cause). It changes to a Product defect only if the measurement of hypothesis 4 shows the part form or the tree page itself slow; master is told at once, and QA re-grades.
