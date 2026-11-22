# DEF-059: `estimate-first-load.spec.ts:64` [desktop] AC-4: the "Loading the form" skeleton is found but stays hidden for the 15 s expect (attempt 1 on two `master` pushes on 22 Nov; Test, product not excluded)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.13 (AQP-339, Done; ADR-016 E1), AC-4: "the part form fetches its fields; while the fields are on their way the skeleton shows as a status, then the fields take its place". The failing step is the skeleton being visible (`:77`); the later steps (the form shows, the skeleton goes) are not reached on the failed attempt. AC-4 is not shown to regress: the retry passes, and the same case passes on attempt 1 at mobile and tablet |
| Severity | **Sev-3 Moderate** (qa-engineer, by the rule of DL-285 (3) read for this case; master is told and may rule otherwise): a Test-type defect, fails closed only if both attempts fail, workaround is the retry, no product behaviour shown to be affected |
| Priority | P3. Lane: hardening window, a Minor-class test-only item behind the Sev-2, Major and DEF-058 items (an assumption for master to confirm) |
| Type | **Test**, **product not excluded** (the element is on the page and "hidden" for the whole 15 s; no trace of the failed attempt, so a product cause such as a hidden or zero-size skeleton is not ruled out) |
| Status | **New** (logged 2026-11-22) |
| Jira / GitHub | [AQP-393](https://sankumar76.atlassian.net/browse/AQP-393) / [#603](https://github.com/sankumar76/Accucut-Quotation/issues/603). Jira "relates to" AQP-1 (Intake) and AQP-339 (STORY-05.13). Labels `ai-delivery`, `aiid-DEF-059`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium |
| Risk / rule | RISK-031: **not counted on trigger (b)**. Each failed attempt is an `expect` that ran out on its own 15 s (the failed attempts ended at 26.2 s and 25.6 s, under the 30 s budget), which DL-264 (4)(d), DL-267 (3) and DL-285 (4) exclude. **No re-run rule** has been ordered; a red run on this case (both attempts) comes to master |
| Found by / date | CI. First occurrence read by master in DL-290 (4) as "not counted" with no further ruling; the second occurrence made this a Bug under DL-285 (3). Logged by qa-engineer, 2026-11-22 |
| Build / commit | `master` push 44975509844 (616d7e34), shard 4, job 137064401810; `master` push 44983705175 (0381fc5c), shard 4, job 137089551760 |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 4 of 4, project desktop, dev server, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The case (`tests/e2e/estimate-first-load.spec.ts:64-80`): installs a `ScriptGate`, signs in as a new Engineer, opens the Engineer's canary task, waits until `#estimate-customer` is hydrated, sets the gate to `slow` (each script held 3 s), chooses the customer, expects "Customer saved." (:76), expects the status named "Loading the form" to be visible (:77), expects the form within `SLOW_OPEN_WAIT_MILLISECONDS` (9 s, :78), then expects the skeleton to be gone (:79).

## Expected Result
After "Customer saved.", the skeleton status shows while the fields' code is held, then the form replaces it.

## Actual Result
Two attempt-1 failures on `master` push runs, 1 h 49 min apart, both [desktop], same line, same message, both passed on the retry:

| # | Run | Attempt 1 | Retry | Shard result |
|---|---|---|---|---|
| 1 | 44975509844 (616d7e34), 02:21Z | failed at **26.2 s** (test no. 5) | 9.5 s | `3 flaky, 510 passed (16.1m)`; the other flaky were `estimate-fasteners.spec.ts:207` and :234 [desktop] (master's DL-290 (4): own-expect form, not counted) |
| 2 | 44983705175 (0381fc5c), 04:10Z | failed at **25.6 s** (test no. 4) | 11.8 s | `1 flaky, 512 passed (16.7m)` |

```
Error: expect(locator).toBeVisible() failed
Locator: getByRole('status', { name: 'Loading the form' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - waiting for getByRole('status', { name: 'Loading the form' })
    7 to 8 x locator resolved to <div role="status" aria-label="Loading the form" class="flex flex-col gap-s-3">...</div>
      - unexpected value "hidden"
> 77 | await expect(page.getByRole('status', { name: 'Loading the form' })).toBeVisible();
```
Readings of the case at the other widths and on the next run: `master` push 44988681963 (45512bd4, 0 flaky): 8.9 s mobile, 16.4 s tablet, 13.2 s desktop, all attempt 1. Series read by QA: no failure of `:64` in the six `master` push runs of 21 Nov (44945571540, 44941416105, 44939278781, 44937075594, 44924430846, 44922163960, Stage 12 logs searched for the failed case), so 22 Nov 02:21Z is the first occurrence and 04:10Z the second.

## Evidence
Stage 12 shard 4 job logs of both runs (error blocks at the end of each log, `Error Context: test-results/estimate-first-load-AC-4-t-80eb5-n-the-fields-take-its-place-desktop/error-context.md`, which CI does not keep for the failed attempt); DL-285 (3) and DL-290 (4) in `docs/00-governance/decision-log.md`.

## What decides it (not collected)
- **Test or runner (QA's working reading, not proven):** the status element is in the DOM but Playwright counts it as hidden (no box, or not painted) for the whole 15 s on a slow draw, while the held scripts delay the page. Nothing in the logs shows why; the retry passes within 12 s.
- **Product:** the skeleton in `src/components/features/estimate-workspace/part-form.tsx` (`FORM_LOADING`, `role="status"`) is hidden for the whole wait on some orderings (for example a re-suspended boundary or a zero-size container). A trace or `error-context.md` of attempt 1 would decide it. If the fix attempt shows this, a change under `src/` means stop and go to master.

## Suspected Area
`tests/e2e/estimate-first-load.spec.ts:64-80` and `tests/e2e/support/lazy-load.ts` (`ScriptGate`, slow mode); client: `src/components/features/estimate-workspace/part-form.tsx` and `part-fields.tsx` (the skeleton).

## Binding for the fix (as DL-229 (4)(b), DL-257 (B))
Test-only unless the measurement shows a product fault. No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped assertion. First measure why the element is on the page and hidden when "Customer saved." shows (for example a diagnostic attachment in the style of DEF-057's). Proof as DL-257 (A): attempt-1 passes at all three widths on the PR run of record and on the first `master` push run after the merge, each under 25 s.

## Re-run rule
None. Master may rule one. A red run on this case (both attempts) comes to master and is not re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-393, #603 |
| Phases measured | developer | | AQP-393 comment or a diagnostic PR (never merged) |
| Fixed | developer | | `fix/AQP-393-<slug>` |
| Regression test added | developer | | the fix is the test change; every assertion kept |
| Verified | qa-engineer | | PR run of record and the first `master` push run after the merge; the case first attempt at all three widths, under 25 s |
