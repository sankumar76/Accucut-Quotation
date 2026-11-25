# DEF-068: `estimate-save.spec.ts:107` [mobile] AC-5: after Save draft the alert "The draft was not saved." is not found in 15 s on attempt 1 (second occurrence, 19 and 23 Nov; passed on retry; type Test, product not ruled out)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316, Save a draft and the unsaved-changes warning), **AC-5** (a draft that cannot be saved says so in an alert and keeps what was typed). **No AC is shown to fail**: the failing step is the case's own `expect` on the alert, and what the page did is not observed |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, DL-324 (2); the DL-285 (3) form). **Becomes provisional Sev-2 the same day** if an observation shows that the page sent the save and showed no alert (or "Draft saved" over a value it does not hold); the fix then needs the section 9 item 2 combined review and master is told at once |
| Priority | P3. Lane: hardening window; the developer owns the fix. **Does not block #630** (DL-324 (3)) and does not block G8 as a Sev-3 |
| Type | **Test, product not ruled out** (cause not determined) |
| Status | **Open** (logged 2026-11-23) |
| Jira / GitHub | [AQP-410](https://sankumar76.atlassian.net/browse/AQP-410) / [#637](https://github.com/sankumar76/Accucut-Quotation/issues/637). Jira "relates to" AQP-316 (STORY-05.08) and AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-068`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium |
| Risk / rule | The trigger of DL-257 (E) is met (second occurrence), so this is a Bug and not a DL-285 watch; **no re-run rule** (every rule so far excludes an `expect` that ran out on its own timeout); a red run on both attempts comes to master. Not a RISK-031 trigger (b) event (PR runs, an assertion wait and not a budget time-out, DL-324 (4)). RISK-035 is checked for a save-path link: none is shown (see "What is and is not shown") |
| Found by / date | CI, two PR runs (19 and 23 Nov); logged by qa-engineer, 2026-11-23 |
| Build / commit | PR #630 run 45098883310 (head 9dec7d3d) and PR run 44574122579 (head c4451d9b) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 1 (project mobile, 360 px), 4 workers, 60 s test timeout in this spec (`test.setTimeout(60_000)`), expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local E2E, CLAUDE.md section 9 item 5). The case: `openForm`; `typeAValueThatCannotBeSaved` (waits for the Save draft button, routes every save to `route.abort`, types 7 into Length, leaves the field, waits for "The change was not saved" under the form and J = 7.00); then `saveDraftButton(page).click()` (:111) and `expect(draftAlert(page)).toContainText('The draft was not saved.')` (:112).

## Expected Result
The press asks the part form to send again what it shows (`saveDraft`: `gate.flush()`, then `gate.settle()`); the send fails again, J stays marked unsaved, `settle()` answers false, and `SaveDraftNotice` shows the danger notice "The draft was not saved." in `[data-calculate-bar]`.

## Actual Result
`expect(locator).toContainText` on `locator('[data-calculate-bar]').getByRole('alert')`, expected substring "The draft was not saved.", Timeout 15000 ms, "element(s) not found", call log "waiting for locator(...)". No received value (the alert element never existed).

| # | Run | Job (shard) | Test no. / attempt 1 | Retry | Shard result |
|---|---|---|---|---|---|
| 1 | PR run 44574122579, head c4451d9b (`fix/AQP-377-estimate-e2e-timeouts`), 19 Nov 17:19Z | 135736855452 (1) | [mobile] 21.1 s | 17.0 s, passed | `1 flaky, 460 passed (14.2m)` |
| 2 | PR #630 run 45098883310, head 9dec7d3d, 23 Nov 02:23Z | 137444848745 (1) | [mobile] 20.7 s | 16.1 s, passed | `1 flaky, 1 skipped, 547 passed (15.8m)` |

Both attempts fail about 15 s after the press, so the press came at about 5 to 6 s into the test (the passing runs take 16 to 17 s on mobile in total).

**Readings of the case on passing runs (attempt 1, s):** `master` push 6d85f555 (CI run 45095489270): mobile 16.6, tablet 9.5, desktop 16.8; run 45098883310: tablet 16.3, desktop 15.5; run 44574122579: tablet 11.6, desktop 15.2. It has failed only at mobile, in both runs.

**Wave check (W1 (d) pattern, QA's measure; matched tests by project, file and title against the latest fully green `master` push run 45095489270):** run 45098883310 shard 1 median **0.87x** (first 4 minutes 0.85x); shards 2, 3, 4 at 1.07x, 1.42x and 1.04x. **Shard 1 was not slow**, so this is not a slow-runner wave (W1 would not apply either way: clause (c) excludes an `expect` that ran out on its own timeout). The 19 Nov run was not measured.

## What is and is not shown
- **Not shown: which of two things happened.** (a) The press was lost or sent nothing (a test gap: the test acts at about 5 s, early on a fast draw), or (b) the page sent the save and showed no alert when it failed (product). The logs hold only the failed `expect`; there is no request log in this spec, no trace of attempt 1 (`trace: 'on-first-retry'` keeps the retry, which passed), and the runs have no artifacts.
- **Hook level (QA, 2026-11-23; throwaway file, not committed; the project's `hook-harness` and `part-server`, the real `createSaveGate` and `saveDraft`):** a value that cannot be saved (first save fails), then `saveDraft(gate)` with the next save failing, returns `saved: false`, with J still unsaved; the same when the press comes in the same tick as the first failure; the next press with the connection back returns `saved: true`. So the hook, the gate and `saveDraft` give no support for "sent and silent". `save-bar.tsx` (`useSaveDraft`, `SaveDraftNotice`) and the browser's click were **not observed**.
- Read in code (`origin/master`): the notice depends only on `outcome.kind === 'failed'` set after `saveDraft`; `CalculateBar` is a lazily loaded component (`estimate-workspace.tsx:38, :75`), so its state is lost if it is re-created; the part form's unsaved mark is removed by `gate.forget(partId)` when the form's load effect re-runs or the form is unmounted (`use-part-form.ts:120, :131`), after which a press would send nothing and `settle()` would answer true. None of these is shown to have happened.
- **Readings still open:** (a) lost press (the same class as DEF-011 and the keyboard case of DL-285); (b) the part form or the bar was re-created between the failed save and the press (a refresh of the page's data in the development server under four workers), which would drop the alert, the unsaved mark and the typed text together; (c) a product path in `save-bar.tsx` not reachable from the hook. The observation below tells them apart.

## Evidence
Job logs 135736855452 (run 44574122579) and 137444848745 (run 45098883310): the "1) [mobile] › tests/e2e/estimate-save.spec.ts:107:3" blocks, the "(retry #1)" passed lines and the shard summaries; the spec's `typeAValueThatCannotBeSaved` (:64-71), :107-124; `src/lib/estimates/save-draft.ts`, `save-bar.tsx`, `calculate-bar.tsx`, `use-part-form.ts`. DL-257 (E) and DL-324 in `docs/00-governance/decision-log.md`.

## Suspected Area
`tests/e2e/estimate-save.spec.ts:107-124` (the press at :111 follows the first failure at about 5 s on a fast draw; the case has no wait for the page to be settled before the press, unlike the saves in the other cases); `src/components/features/estimate-workspace/save-bar.tsx` and `calculate-bar.tsx` (state of the press and the notice); `use-part-form.ts` `gate.forget` and the unsaved mark (:120, :131, `explain` :183-190).

## Fix route (developer; test-only first; the DL-308 H1 standard: no assertion, timeout, retry, `test.slow()`, skip or sleep change; every assertion kept)
Observation first (the DEF-038 / DEF-057 pattern, `expectStored` in `estimate-fasteners.spec.ts`): in `estimate-save.spec.ts`, from the press on, record the save requests (`request` and `requestfailed` of the save route, with time), the page's navigations (`framenavigated`) and console errors; when :112 fails, print and attach the text of `[data-calculate-bar]`, the Save draft button's label and busy state, and the part form's alert text. Reading the result: no PATCH after the press and the button idle means (a) a lost press; a navigation between the first failure and the press means (b); a request that failed after the press with no alert and the bar quiet (or "Draft saved") means **product**, and then: provisional Sev-2, the combined review on the fix, master told at once. Then fix what it shows (for (a), wait for the page to be settled before the press, as `waitUntilHydrated` does elsewhere).

## Proof needed
1. The observation lands (assertions unchanged).
2. Once a recurrence or the code names the cause: attempt-1 pass of `estimate-save.spec.ts:107` at mobile, tablet and desktop on the fix PR's run of record and on the first `master` push after the merge (DL-257 (A)).
3. Every recurrence before then is recorded here as an occurrence (run, head, shard, attempt-1 time, whether it was a wave); a red run on both attempts goes to master.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Observation added | developer | | |
| Cause named | qa-engineer | | |
| Fixed | developer | | |
| Verified | qa-engineer | | |
