# Test Report — AQP-269, AQP-270, AQP-271 (DEF-024, DEF-025, DEF-026): dialog focus jump while typing

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | PR #167 (`sankumar76/Accucut-Quotation`), branch `fix/AQP-269-dialog-focus-jump`, head `cde1b29` (fix `69805d1`, round-2 tests `db1319a`, `cde1b29`), base `master` 322cd8e. The QA commit adds documents only; it changes nothing under `src/` or `tests/` |
| CI | Fix head `cde1b29`: run 42862491463, attempt 1, 5 of 5 green, path 4:59. QA controls: four throwaway PRs, runs 42867526102, 42867558564, 42867587822, 42867619515 (below). The run on the QA commit is recorded on PR #167 |
| Environment | CI only (Ubuntu runner, Node 22, production build and development server, throwaway PostgreSQL service). The machine had too little free memory for a local Playwright, database or dev server, as master ruled for this gate (DL-136, DL-138), so nothing was run locally and nothing here is claimed from a local run |
| Date | 2026-11-10 |
| **Recommendation** | **ACCEPT.** The three defects are fixed. QA's own F-a and F-b probes, the sequences that found them, pass on the fixed code in all 18 cases (3 dialogs x 2 sequences x 360, 768, 1366 px) and fail with the old behaviour planted back in three different ways, each time together with the developer's tests. Full CI is green with the probe added. No new defect. DEF-024, DEF-025 and DEF-026 are Verified (DEF-026 restated as Sev-2, DL-135). Open by severity after this PR: Sev-1 0, Sev-2 0, Sev-3 2 (DEF-022, DEF-023), Sev-4 0 |

## Summary

PR #167 replaces the effect that was keyed on the `errors` object in the Material, Process and Users dialogs with one shared hook, `useFocusOnRefusal` (`src/components/shared/use-focus-on-refusal.ts`). A form calls the function it returns with the messages of a refusal, from its submit and from the server's answer; that call stores the messages and requests focus on the first refused field. Typing only clears its own field's message and never requests focus.

I read the diff (7 files, +173 / -36, no change outside the three dialogs, the hook and three specs), then verified the fix three ways without a local run: (1) my own probe, replayed in CI against the fixed code; (2) three throwaway control PRs of my own, each with a different fault planted, run in CI; (3) the developer's tests and the full suite on the fixed head.

## Verification of each defect

| Defect | Original reproduction (DEF record, `AQP-123-evidence/focus-jump-results.txt`) | Result on the fixed code | Evidence |
|--------|-----------------------------------------------------------------------------|--------------------------|----------|
| DEF-024 Material (AQP-269) | Empty submit refuses 5 fields. (a) `xyz` in the first field: `x`, `y`, `z` landed in three fields, focus on Specific gravity. (b) `xyz` in the second field: letters went to the second and first fields | F-a: all letters stay in Material in Drawing, focus stays. F-b: all letters stay in Material Considered, focus stays. 6 of 6 probe runs pass (3 widths x F-a, F-b) | Control c0, run 42867526102; developer test `materials.spec.ts` "DEF-024 ..." at three widths, in the same run |
| DEF-025 Process (AQP-270) | Empty submit refuses 3 fields. (a) `xyz` in Name: only `x` stayed, focus moved to the Unit list. (b) `xyz` in Default value: `x` there, `y` in Name | F-a: all letters stay in Rate name. F-b: all letters stay in Default value. 6 of 6 pass | c0; `process-master.spec.ts` "DEF-025 ..." |
| DEF-026 Users (AQP-271) | Empty submit refuses 3 fields. (a) `xyz` in Name: `x`, `y`, `z` in Name, E-mail, masked password. (b) `xyz` in E-mail: first letter there, the rest elsewhere | F-a: all letters stay in Name. F-b: all letters stay in E-mail. 6 of 6 pass | c0; `users.spec.ts` "DEF-026 ..." |

## How the fix was checked

### 1. QA's probe against the new tests

The probe is the spec I used at the G7 of AQP-123 (`docs/07-qa/AQP-123-evidence/aqp-123-focus-jump.spec.ts.txt`), with its console lines turned into annotations (`docs/07-qa/AQP-269-evidence/aqp-269-qa-probe.spec.ts.txt`). I replayed it as an E2E spec on the fixed head in control c0.

| Sequence | My probe | The developer's test | Same? |
|----------|----------|----------------------|-------|
| F-a | Press the dialog's submit button on an empty form, type `xyz` into the field that has focus (the first refused one), require the focus to be on that field | Material, Process and Users: refuse a partly filled form, check focus is on the first refused field, type `xyz`, check focus, the value `xyz` and that the other typed value is intact | Yes, and the developer's also checks values |
| F-b | Focus the second refused text field, type `xyz`, require the focus to be there | Material and Users: Tab to the second refused field, type, check focus and value and that the earlier field is still empty, then Shift+Tab and type into the first; Process: Tab twice to Default value, replace, check focus and the unit message | Yes; the developer's goes further (the earlier field stays empty, the order is reversed, the Unit list is skipped) |
| Second refusal of the same field | Not in my probe | Material: press Add a second time, Material in Drawing focused again | Added by the developer (QLT-02) |
| Server refusal | Not in my probe | Process duplicate name and column letter, Users used e-mail and second Admin | Added by the developer (QLT-03) |

Result of c0 (fixed code plus my probe, nothing planted): **CI run 42867526102, 5 of 5 green, path 5:09** (first job start 17:41:34 to the end of `Stages 1 to 11` 17:46:43). The 18 probe tests passed; the three shards passed 216, 219 and 257 tests (the whole existing suite, with the developer's tests). So every sequence that reproduced the defect now behaves, and the developer's tests cover everything my probe does and more.

### 2. QA's own control PRs (three plant classes, closed unmerged)

Each branch is `cde1b29` plus my probe spec and one fault. Diffs in `docs/07-qa/AQP-269-evidence/plant-c*.diff`; failing tests per control in `control-c*-result.txt`. All four PRs are closed and none was merged.

| Control | PR / run | Fault planted (class) | Failed on every attempt | Everything else |
|---------|----------|-----------------------|-------------------------|-----------------|
| c0 | #185 / 42867526102 | none (positive control: probe replay) | 0 | 5 of 5 green, probe 18 of 18 pass |
| c1 | #186 / 42867558564 | **Class 1, the original defect:** in all three dialogs the `useFocusOnRefusal` call is replaced by `setErrors` and the old `useEffect(... focus first field with a message ..., [errors])` is back | **27:** the 9 new DEF-024/025/026 tests (3 dialogs x 3 widths) and all 18 of my probe tests | `Stages 1 to 11b` green (lint, types, build, unit); no other E2E test failed |
| c2 | #187 / 42867587822 | **Class 2, typing asks the shared hook for focus:** each dialog's typing handler calls `showErrors(<its errors without this field>)` instead of only clearing its message (Process included; the developer's own plant of this class left Process out) | **27:** the same 9 new tests and the same 18 probe tests | `Stages 1 to 11b` green; no other E2E test failed |
| c3 | #188 / 42867619515 | **Class 3, a refusal sends focus to the wrong field:** the hook focuses the last refused field, not the first | **30:** 21 tests (the first-field focus checks of `materials.spec.ts:166`, `process-master.spec.ts:123`, `users.spec.ts:129`, `aqp-122-qa.spec.ts:136`, and the three DEF tests, each at 3 widths) and my 9 F-a probe tests | My 9 F-b probe tests pass, as they should: they focus the second field themselves, so a wrong target after the refusal does not touch them. `Stages 1 to 11b` green |

Every plant was caught by named tests, and every other test stayed green, so the fix has no hidden dependence the plants did not reach. The developer's three plants (A, B, C: second refusal, server refusal, a later field pulling focus back) are different realisations of different classes; together with mine the hook is covered for: typing, the first-field target, the second refusal and the server's answer.

### 3. Code read of the hook and the dialogs

- `showErrors(errors)` calls `setErrors(errors)` and, only when a field has a message, `setRequest({ field })`; each call makes a new object, so a second refusal of the same field requests focus again (Material test line 166 covers it).
- The effect depends on `[request]` alone (`useEffectEvent` keeps the focus callback out of the dependencies), so no later render, and no change of the errors, can move focus.
- Typing in the three dialogs still clears its own field's message through `setErrors((current) => withoutError(...))`, which is the hook's input but not its entry point. No `useEffect` keyed on `errors` is left in the three files (`git grep` on the head: none).
- `showErrors({})` clears all messages and requests nothing; `showErrors({ role: ... })` on the "second Admin" refusal of Users focuses Role.
- Edit mode goes through the same hook (one form component for Add and Edit). No new test drives the Edit dialogs, which is OBS-1.

## Regression

| Check | Result |
|-------|--------|
| CI on the fix head `cde1b29` (developer's run 42862491463) | 5 of 5 green: Stage 6 2,785 tests, Stage 11 4,903 tests, 3 shards; one known tablet flake (`aqp-122-qa.spec.ts:439`, passes on retry); JS budget unchanged: `/masters/materials` 187,115 B, `/masters/process` 173,879 B, `/users` 170,139 B; path 4:59 |
| Whole suite plus my probe (c0, run 42867526102) | 5 of 5 green, 692 E2E tests passed across the shards, path 5:09 |
| Files touched | 3 dialogs, 1 new hook, 3 specs; nothing else |

## Defects

None new. The records DEF-024, DEF-025 and DEF-026 have their Fix & Verification rows filled and are Verified; **DEF-026 is corrected to Sev-2 / P2** (master, DL-135; Jira AQP-271 and GitHub #163 were already updated).

## Observations for master to route

- **OBS-1 (Edit dialogs).** No test drives typing after a refusal in the Edit form of the three dialogs. They share the same component and hook as Add, so the risk is low; a test per dialog would close it if wanted.
- **OBS-2 (Exchange rates hook).** `use-exchange-rates.ts` keeps its own copy of the pattern; the developer lists moving it to the shared hook as a follow-up. Not needed for these defects.
- **OBS-3 (CI time).** The PR adds 9 E2E executions (3 tests x 3 widths) and rewrites assertions in existing ones; its path was 4:59 against 5:09 for the run with my 18 extra probe tests. My probe is not committed.
- **OBS-4 (what I did not run).** Nothing was run locally (memory), no real phone or screen reader was used, and the "Nothing was changed." wording follow-up (AQP-1 11307) is outside this PR. DEF-027 was not touched.

## Residual risks

- Evidence is CI only: Linux, Chromium, the development server for these specs. The faults I found on Windows at the G7 of AQP-123 are the ones the old effect produces in CI (control c1).
- The probes and the developer's tests drive Add dialogs only; the Edit dialogs rest on the shared code (OBS-1).

## Artefacts

- `docs/07-qa/AQP-269-test-report.md` (this file); `docs/07-qa/defects/DEF-024-*.md`, `DEF-025-*.md`, `DEF-026-*.md` (Fix & Verification filled, DEF-026 Sev-2).
- `docs/07-qa/AQP-269-evidence/`: `plant-c1.diff`, `plant-c2.diff`, `plant-c3.diff`, `control-c0..c3-result.txt` (jobs and the failing tests per run), `aqp-269-qa-probe.spec.ts.txt`.
- Control PRs #185 to #188 (closed unmerged), branches `control/AQP-269-qa-c0..c3`.
