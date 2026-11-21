# DEF-057: `rates-changed.spec.ts:135` [tablet] AC-10: after Recalculate the "Rates changed" notice is still there when the 15 s wait ends and the 30 s budget cuts the test (second occurrence)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.11 (AQP-328) AC-10 (an unlocked Draft with current figures: the notice shows, its link reaches a Recalculate button, pressing it calculates again, the notice goes and the estimate is Submitted); related STORY-06.04 (AQP-321) |
| Severity | **Sev-3 Moderate**. Re-grade to Sev-2 if the evidence shows the notice stays on screen after a successful Recalculate (a stale notice can mislead a Lead before approving) |
| Priority | P3 |
| Type | **Test** (the 30 s budget is spent while an assertion waits for a state the case's own action should produce); a product fault is not excluded |
| Status | New (logged 2026-11-21) |
| Jira / GitHub | [AQP-387](https://sankumar76.atlassian.net/browse/AQP-387) / [#585](https://github.com/sankumar76/Accucut-Quotation/issues/585). Jira "relates to" AQP-328. See also DEF-048 (AQP-377, the over-25 s list on which this case already stood) and RISK-031 |
| Found by / date | qa-engineer, 2026-11-21, on the trigger of master's DL-257 (E): a second occurrence of any of `estimate-save.spec.ts:107`, `rates-changed.spec.ts:135`, `unlock.spec.ts:186` on any run means a Bug the same day; none of the three may be re-run under any R-rule |
| Build / commit | PR #571 head `a11abdf1` (run 44902999104); first occurrence PR head `2f5b8511` (run 44577408149, branch `fix/AQP-377-estimate-e2e-timeouts`) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 3, project tablet, dev server, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The test (`tests/e2e/rates-changed.spec.ts:135-158`): makes a calculated estimate through the API and reprices a material; approves and unlocks through the API; opens SCR-06 as the Lead; follows the notice's Recalculate link; presses Recalculate (:154); expects the "Rates changed" status to leave the page (:155), then Approve enabled (:156), then the stored state SUBMITTED with 2 calculations (:157).

## Expected Result
After Recalculate succeeds the notice is gone and Approve is enabled, inside the 15 s expect and the 30 s budget.

## Actual Result
Two attempt-1 failures, both [tablet], both a 30 s test timeout with the same wait:

| # | Run | Head | Result |
|---|---|---|---|
| 1 | PR run 44577408149 (read by master, DL-257) | `2f5b8511` | the 30 s budget ended while the 15 s `toHaveCount(0)` waited for the notice to clear after Recalculate. The case also read 27.3 s on `master` push 44540107462 |
| 2 | PR run 44902999104, Stage 12 shard 3 (PR #571) | `a11abdf1` | attempt 1 failed at **30.2 s** (test no. 79 of the shard); retry passed in 10.5 s |

```
Test timeout of 30000ms exceeded.
Error: expect(locator).toHaveCount(expected) failed
Locator: getByRole('status').filter({ hasText: 'Rates changed since this was calculated.' })
Expected: 0   Received: 1
- Expect "toHaveCount" ... with timeout 15000ms
  20 x locator resolved to 1 element  (unexpected value "1")
- Test timeout of 30000ms exceeded.
at tests/e2e/rates-changed.spec.ts:155:34
```
Other readings of the case in the logs QA holds: mobile 10.4 to 12.5 s; desktop 9.1 to 17.4 s; tablet 10.5 s on the retry.

## Evidence
Job log of the Stage 12 shard 3 job of run 44902999104; DL-257 (E) and (6) in `docs/00-governance/decision-log.md`; risk register RISK-031 text for run 44577408149. No trace of attempt 1 (`trace: on-first-retry`), so the page state at the failure is not kept.

## What decides it (not collected)
- **Test or runner (leading reading):** the Recalculate request finished late (the dev server compiles on demand; tablet is the slow draw in this file), so the notice was still shown when the 15 s expect and then the 30 s budget ended. The retry shows the case at 10.5 s.
- **Product:** the notice is not cleared in the client after a successful Recalculate under some ordering (a response applied before a refresh, or a stale read). A trace or `error-context.md` showing the Recalculate answered 200 while the notice stays, or Approve disabled while the stored state is SUBMITTED, decides it. Then QA re-grades to Sev-2 the same day and tells master.

## Suspected Area
`tests/e2e/rates-changed.spec.ts:135-158`; client: `src/components/features/estimate-review/` (the Recalculate handler and the notice state).

## Binding for the fix (DL-229 (4)(b), DL-257 (B))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped assertion. Measure the phases first (Recalculate request time, response applied, notice cleared). Set-up through rows or routes only for steps that are not the case's subject. A change under `src/` means stop and go to master.

## Re-run rule
None (DL-257 (E)); master may rule one.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Phases measured | developer | | AQP-387 comment or a diagnostic PR (never merged) |
| Fixed | developer | | `fix/AQP-387-<slug>` |
| Regression test added | developer | | the fix is the test change; every assertion kept |
| Verified | qa-engineer | | PR run of record and the first `master` push run after the merge; the case first attempt at all three widths, under 25 s |
