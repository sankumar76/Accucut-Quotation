# Review Report — #244 and #277 (test-only tech-debt, PR #291) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (narrow reviewer-quality route, DL-124: tests only, nothing under `src/`) |
| Base…branch | `abdac01...tech-debt/244-slow-read-tests` (merge base b25891b; CI runs the merge with `master` abdac01) |
| Commit reviewed | `41e5fd4` |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/291#pullrequestreview-5869724916 (inline comments r4546790639 QLT-01, r4546791127 QLT-02, r4546791692 QLT-03)

## Summary
PR #291 is four commits and five test files. Nothing under `src/`, config, `package.json` or the CI workflow changes, so the narrow route holds (DL-124 (1)).

**The new tests close both gaps where the two issues said they were open.**
- **#244.** My A1 is red on the two new failed-read tests (Process, Materials) at three widths. My A2 is red on the three new ready tests (Process, Materials, Treatments) at three widths. Before this PR, A1 was caught only on Exchange rates and Treatments, and A2 only on Exchange rates (#239 and #240).
- **#277.** My P2 is red on both new opener tests at three widths. My P4 is red on the Process opener test at three widths. Both plants were green on #265 (#274, #276).

**STD-06's -8 Vitest cases weaken no assertion.** I listed every generated case of the two touched files at the merge base, at the head, at `master` abdac01, and at abdac01 with the PR's one-line change applied (the merge ref's content). In each pair, the 8 cases that go are exact duplicates of 8 that stay: `material-repository` was listed both in `REPOSITORIES.blocked` and in `FUTURE_IMPORTS`. The set of distinct case names is unchanged, at 646. `material-repository` is still refused by 20 cases: 4 views and 6 pages, each in 2 import forms.

The tests have no sleep, no serial mode and no shared mutable state. Each test makes the row it changes. The Process opener test only presses two seed rates; it never saves or deletes them.

The E2E cost is +21 instances (7 tests × 3 widths). Each test is the only one that catches its plant on its screen, and test strategy §10.5 keeps them at three widths. I found no cheaper set that proves the same.

**The developer's ux-spec §6.0 observation is confirmed** (probe N1, red 6). On Process and Materials, a list read that fails after a save that succeeded shows "Check your connection and try again. Nothing was changed." directly under "<name> saved. The change is in the audit log.". The fault was already on `master` and sits outside this PR. I route it to master as QLT-01; QA grades it.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 (QLT-01 is on `master` before this PR, outside the diff, and routed; QLT-02 is in this PR and cheap) |
| Info | 4 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Scope | `git diff --stat abdac01...41e5fd4` | 5 files, all under `tests/`: 2 new specs, 1 new support module, the `engineer-import-rule` one-line change and its header line, and the rename `process-opener` → `master-opener` (similarity 100 %). Nothing under `src/`, config or CI. Narrow route holds |
| CI on the head | run 43155701604 (`pull_request`, merge with abdac01), jobs and log read | 5 of 5 success. Unit **3,081**, full Vitest **5,436**, E2E **272 / 270 / 257 = 799**, skipped **3 / 4 / 17**. Path 04:34:39 → 04:40:17 = **5:38** |
| Reference | `master` abdac01 push run 43148695027 (log read) | 3,081 / 5,444 / 265 + 263 + 250 = 778 / 3 + 4 + 17. Delta **+0 / -8 / +7 +7 +7 (+21) / +0**, as the Dev Record states |
| STD-06: no weakening (test strategy §10, G12 rule; `tests/security/**` is in scope) | `npx vitest run tests/security/engineer-import-rule.test.ts <opener test> --reporter=verbose` at b25891b, 41e5fd4, abdac01, and abdac01 + the PR's change to the file (applied locally, then reverted); case names normalised and compared as multisets | b25891b 659 → 41e5fd4 651, and abdac01 654 → abdac01+PR 646 (engineer file only). In both pairs **0 distinct names lost and 0 gained** (646 distinct in each). The 8 removed are the second copies of `static import is refused` and `import() is refused too` × 4 views × `@/server/repositories/material-repository`. After the change, `material-repository` is refused by **4 + 4 view cases and 6 + 6 page cases = 20**. That is the §10 figure for a blocked repository file, where it had read 28 with the duplicate. The header line now names only files that do not exist. The PR body states the -8 and its reason, as the rule requires |
| Rename (STD-04) | `git diff -M` | `tests/unit/process-opener.test.ts` → `master-opener.test.ts`, similarity 100 %; 5 cases, the same names |
| Sleeps, serial mode, timing | `grep waitForTimeout\|setTimeout\|describe.serial\|configure` on the 3 new files | none. The waits are `expect` / `expect.poll` on a state, and `afterOneFrame`, which is one animation frame and not a duration |
| Order and shared state | read | Every slow-read test makes its own rate, material or treatment through the API, with a name that carries width, repeat, retry and 6 random hex digits. The Materials opener test makes its own material. The Process opener test presses `Plating-rate-per-sqin` and `Welding-rate-per-kg` but never saves or deletes them; in fail mode no dialog opens, and in hold mode the dialog is closed with Escape. No E2E deletes either seed rate: the canary scan's `DELETE` of Plating is sent as the Engineer and refused. The gates are `page.route` per page, so no state crosses tests |
| Gate robustness | read `gateListReads`, `ScriptGate` | A read the gate does not match is not held, so `expect.poll(waiting) === 1` fails loudly; it does not pass silently. The write of a save is not a GET and goes through. The ScriptGate is installed after `networkidle`, so only the dialogs' code is gated |
| Plants and probe | 5 draft control PRs from 41e5fd4 against `master` (below) | 4 plants red as predicted; probe N1 red as predicted |
| Lint | `npx eslint <planted file>` on each control branch | clean ×5, so each control can fail only in a test |

## Plants (DL-150 (1), #244 item 2, #277 "Controls")
Each control is one commit on top of `41e5fd4`, on a branch `control/244-qlt-*`. A script applied it and refused unless its anchor occurred exactly once; it kept the files' CRLF endings. Each diff was printed before the push and is in its PR body. CI ran on the merge with `master` abdac01. Stages 1 to 11b were green on all five, so every red is a test. All five PRs were opened as drafts and closed unmerged after their runs had been read.

| Control | Diff | PR, run | Result | Caught by |
|---|---|---|---|---|
| **A1** a failed read focuses the opener without `listFailed` | `use-read-again.ts:41` `else if (shouldFocusWhenFailed) focusOpener(opener.current, true);` → `else focusOpener(opener.current);` | #300, 43161026597 | **red 15** (5 per shard) | **New:** `masters-slow-read.spec.ts:76` (Process) and `:103` (Materials) at three widths, at `support/masters.ts:135` "the page heading never took focus". **Already covered before:** `exchange-rates.spec.ts:383` and `treatments-focus.spec.ts:181, 197` |
| **A2** a successful read focuses the heading | `use-read-again.ts:40` `focusOpener(opener.current)` → `focusOpener(null)` | #301, 43161038044 | **red 18** (6 per shard) | **New:** `masters-slow-read.spec.ts:62` (Process, at `:73`), `:89` (Materials, at `:100`) and `:116` (Treatments, at `:129`), `toBeFocused` failed, at three widths. **Already covered before:** `exchange-rates.spec.ts:171, 370, 383` |
| **P2** a second press while the dialogs load is not ignored | `use-dialog-opener.ts:25` drop `if (loader.pending) return false;` | #303, 43162387883 | **red 6** | `masters-dialog-opener.spec.ts:82` (SCR-11) and `:107` (SCR-13 Materials) at three widths, at `:67` "the first press is still the pending one" (`aria-busy` moved to the later button) |
| **P4** Process's failed-dialog titles swapped | `process-screen.tsx:79` `? FAILED_CONFIRMATION_TITLE : FAILED_DIALOGS_TITLE` → `? FAILED_DIALOGS_TITLE : FAILED_CONFIRMATION_TITLE` | #302, 43162250858 | **red 3** | `masters-dialog-opener.spec.ts:82` at three widths, at `:49`. It expected "The form did not open." and received "The confirmation did not open.Check your connection and try again." |
| **N1** probe, test-only: no "Nothing was changed." after a save that succeeded | `support/masters.ts`, one added `expect(main).not.toContainText('Nothing was changed.')` at the end of `expectLoadErrorHoldsFocus` | #304, 43162431792 | **red 6** | `masters-slow-read.spec.ts:76` and `:103` at three widths, only on the probe line `support/masters.ts:140`. The page received on Process read: "…E2E-rate-tablet-r0-t0-d3904b saved. The change is in the audit log.Search We could not load the rates Check your connection and try again. Nothing was changed. Try again". That confirms QLT-01 |

These match the developer's controls. Their A1 #293, A2 #294 and P4 #296 were on 8829c53, which differs from 41e5fd4 only in the opener spec's last press; their P2 #299 was on 41e5fd4. The developer's first P2 (#295) was green, and the cause stated is right. With the last press on the first button, a press that was not ignored put the pending look and the target back where they started. The fix in 41e5fd4 (`others` pressed after `first`, and `first` still `aria-busy`) is the check that bites.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor (on `master` before this PR; outside the diff; routed to master, QA grades) | `src/components/features/masters/process-results.tsx:48`; `material-results.tsx:56` | ux-spec §6.0 "Error (load)" ("'Nothing was changed.' … is not said when the read follows a save that succeeded"); the SCR-13 Exchange rates and Treatment / Color blocks; DL-167 | **Confirmed (N1 red 6).** Process and Materials render `MasterLoadError` without `description`, so the shared default "Check your connection and try again. Nothing was changed." appears. It appears under the success notice that `onSaved` sets just before `readAgain(true)` (`use-process-master.ts:89-90`, `use-material-master.ts:73-74`). Treatments (`treatment-panel.tsx:65`) and Exchange rates (`exchange-rates-panel.tsx:112`) pass the saved wording, and Process and Materials were never given it | An Admin whose Add, Edit or Delete succeeded, on a network that then dropped the re-read, is told on the same screen both that the change was saved and that nothing was changed. One of the two sentences is false. An Admin who believes the second may repeat an Add, which the server then refuses as a duplicate name, or may doubt the audit log | **Not in this PR:** it needs `src/`, which would end the narrow route. One small fix PR: on both screens, pass `description={notice?.tone === 'success' ? <the saved sentence> : undefined}`, in the pattern of `treatment-panel.tsx:63-65`, with the sentence ux-expert confirms for SCR-11 and Materials. The test is N1's assertion as a regression test in `masters-slow-read.spec.ts` (no new E2E: it rides the two failed-read tests), plus the positive sentence. The fix is checked by re-planting N1's assertion. Master routes it; QA reproduces and grades it; ux-expert confirms the two sentences |
| QLT-02 | Minor | `tests/e2e/support/masters.ts:81-84` (`pressWithKeyboard`), `:41-43` (`newName`), `:73-78` (`rowButton`) | coding standards §3 (no duplication); `CLAUDE.md` "reusable components" | `pressWithKeyboard` is a verbatim copy of `support/treatments.ts:72-75`, in a module that already imports three names from `./treatments` (`:7`). `newName` repeats `newTreatmentName`'s pattern, and `rowButton` repeats `rowOf` plus `getByRole`. `masters-slow-read.spec.ts` imports `pressWithKeyboard` from one module and `rowOf` from the other | Two copies of a helper drift: a fix to how a keyboard press is made (say, to wait for hydration) would reach one family of specs and not the other. Cost today: none | Import `pressWithKeyboard` and `rowOf` from `./treatments` (`rowButton` = `rowOf(page, name).getByRole('button', { name: \`${button} ${name}\` })`), and make `newName(kind)` the one generator with `newTreatmentName` calling it. Test-only; it can ride this PR or the QLT-01 fix PR. reviewer-standards owns the style side; I raise it only for maintainability |
| QLT-03 | Info | `tests/e2e/masters-dialog-opener.spec.ts:69-70` | #277 item 1 ("exactly one request") | `expect(new Set(requested).size, 'no script was requested twice')` cannot fail: the bundler shares an in-flight chunk load, so a second `import()` of the same chunk sends no second request. Under P2 every failure was at `:67`, and none at `:70`. #277's "exactly one request" is in fact proven by the pending look and the dialog target staying with the first press, and that check does bite | none: P2 is caught | Optional: drop the line, or reword its message to say that it guards against a different second chunk (a second dialog's code), which is all it can see |
| QLT-04 | Info | `tests/e2e/masters-slow-read.spec.ts` header | #244 item 1 ("…or on the heading for a deleted row") | The deleted-row branch (focus to the `h1`) is not in the new file. The header gives the reason: the same function's other branch, already tested in `process-master.spec.ts` with an immediate read. I accept it. A2 and A1 are the plants that #244 names, and both bite on every screen | none | none |
| QLT-05 | Info | the two new specs | test strategy §10.5 (`@one-width`), RISK-023 = 8 (DL-151) | **E2E cost is proportionate.** +21 instances at a mean of 3.79 s (≈ 80 s of worker time). The path read 5:38 against a 5:30 trigger. That is reported, not held (DL-151 (4)); for comparison, the base push run read 5:18. **No test can drop to one width under §10.5.** Focus returns to the row's button, which is a table cell at 768 and 1366 px but a card at 360 px, so a different element at each width (the AQP-74 ruling). The failed-dialog notice is brought into view by `revealNearest`, and scrolling a notice into view depends on the viewport (the AQP-65 ruling). Tagging also needs a §10.5 ruling and the allow-list in `one-width-tag.test.ts`, which this route cannot change. **No test is redundant:** each is the only one that catches its plant on its own screen. Merging the ready and failed tests of one screen into one page session would save two page opens per width, but it would make the second half depend on the first. I do not recommend it | ≈ +80 s of worker time, about +7 s of path across three shards (estimate) | none. Master reads the path against RISK-023 as usual |
| QLT-06 | Info | `tests/security/engineer-import-rule.test.ts:18, 84-93` | test strategy §10 G12 rule; "What a new data-layer file adds" | STD-06 is a pure de-duplication (checks above). As a side effect, `material-repository` now has exactly the §10 figure for a blocked repository file (20), where before it read 28 because of the duplicate. §10's sentence on #235 ("20 for each new `blocked` repository file") stays true | none | solution-architect: no change is needed. The -8 is explained by the duplicate, not by the rule |

## Reviewer-specific tables

**Conformance with the issues' "Required" items** (tech-debt has no ACs; these items stand in for them)

| Item | Implemented in | Tested / shown by | Result |
|---|---|---|---|
| #244 (1) one slow-read E2E per dialog screen at three widths: Process and Materials ready + failed, Treatments ready | `masters-slow-read.spec.ts:62, 76, 89, 103, 116` | A2 red 9 on the ready tests; A1 red 6 on the failed tests | Met |
| #244 (1) written from the ux-spec, not the code | file header cites ux-spec §6.0 "States", "Dialogs" and "Error (load)"; the words are in `support/masters.ts`, from SCR-11 and SCR-13 | read | Met |
| #244 (2) reviewer re-plants A1 and A2 on the head, diffs printed first, red on every screen covered | #300, #301 | above | Met |
| #244 (3) STD-04 rename only | `git diff -M`: similarity 100 % | 5 cases, the same names | Met |
| #244 (4) STD-06: entry deleted, header corrected, delta stated, no assertion weakened | `engineer-import-rule.test.ts:18, 84-93`; PR body | case multisets (above) | Met |
| #244 (5) E2E entries stated (RISK-023) | PR body and hand-off: 7 tests × 3 = 21, mean 3.79 s, path 5:38 | CI 43155701604 | Met |
| #244 "if a new test fails on `master`" | none failed without a plant | CI 5 of 5 | n/a; no regression from #235 / #265 |
| #277 (1) dialogs' chunk held, two presses: one request, pending look on the pressed button | `masters-dialog-opener.spec.ts:57-80` (`expectSecondPressesDoNothing`) | P2 red 6 | Met. The "one request" line itself cannot fail (QLT-03); the pending look and target checks prove it |
| #277 (2) chunk aborted: notice with the right title for Add / Edit and, on Process, Delete | `:82-105` (Process: Add form, Delete confirmation, Edit form, titles alternating), `:107-125` (Materials: Add, Edit) | P4 red 3 | Met |
| #277 follow `shell-first-open.spec.ts`; no `expect` removed, no matcher widened, no count lowered | `ScriptGate` from `support/lazy-load.ts`; no existing test file changed except the two above | diff | Met |
| #277 reviewer re-plants P2 and P4 on `master`-based controls from the head | #303, #302 | above | Met |

## Issues for other roles
- **master:** (1) QLT-01 is confirmed. It was on `master` before this PR, and it is outside the diff and the narrow route. Route it as a defect for QA to reproduce and grade, with a small fix PR whose regression test is N1's assertion (DL-167). It does not hold this PR. (2) The narrow route holds and the G6 evidence is complete: 0 Blocker, Critical or Major. (3) The path of 5:38 is reported against RISK-023 = 8 (QLT-05).
- **ux-expert:** confirm the sentence for a load error after a successful save on SCR-11 and on the SCR-13 Materials tab. It is "The change was saved, but we could not show the list. Check your connection and try again." on Treatments, and its own sentence on Exchange rates (QLT-01).
- **qa-engineer:** reproduce and grade QLT-01. It reproduces with any save on Process or Materials followed by a failed list read; N1 (#304) shows the exact page text.
- **developer (optional, test-only):** QLT-02.
- **orchestrator or the delivery lead:** commit this file. Before G8, delete the five branches `control/244-qlt-a1-failed-read-focuses-opener`, `control/244-qlt-a2-ready-focuses-heading`, `control/244-qlt-p2-no-pending-guard`, `control/244-qlt-p4-process-failed-title` and `control/244-qlt-n1-probe-nothing-was-changed`, with the developer's `control/244-*`. Local branches of the same names are in the shared repository; worktree `agent-a6d12939ca38d7ee3` is back on `docs/AQP-245-review-quality`.
