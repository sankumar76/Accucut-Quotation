# DEF-085: On every run that holds #721 (AQP-426, the resizable parts tree), shard 4 `[desktop]` shows the part form not found within its 15 s wait (`estimate-form-choice` :88, :109, :126; `estimate-form-sections` :64; `workspace-tree-width` :449) and the `users.spec.ts` tail (`:292`, `:329`) failing both attempts at the 30 s budget; at fast draws too (Test; Sev-3 since DL-389; Jira AQP-441, GitHub #725)

| Field | Value |
|-------|-------|
| Story / AC | AQP-426 (STORY-CR01.3E, the resizable parts tree, PR #721, squash `0c201e65`) is the change that brought it; the failing cases' own stories are STORY-05.x (the part form) and STORY-01.04 (`users.spec.ts`). **No AC is shown to fail by value or text:** every failure is a time-out at the 30 s budget or at a 15 s `expect`. |
| Severity | **Sev-3 Moderate (master, DL-389 (A), 2026-11-25), type Test.** It was a provisional Sev-2 with product not excluded (DL-388 (4)). The developer's cause step (AQP-441 comment 13254: the code read and one production-build check, no product delay; master read the CI timelines) meets DL-388 (6) (a). The CI symptoms have test-run causes: (i) the cold `next dev` compile at the head of shard 4, whose 15 s form waits were already within about 1 s of the edge before #721 (`estimate-form-choice:88` 20.7 s on f2f19f76), shifted by the change in the shard head; (ii) the eight heavy tree-width cases beside the `users.spec` tail. A product share under about 1 s on the dev server is not excluded and is not material in production (first paint equal or faster). Not a G8 blocker. **Earlier:** provisional Sev-2 (DL-388 (4)). |
| Priority | P3 (Jira Medium, labels `sev-3`, `final-review`; was P2 / High) |
| Type | **Test** (DL-389 (A)); was 'Product not excluded'. |
| Status | **Open, re-graded 2026-11-25 (qa-engineer, on DL-389 (A)); stays open for the re-land's proof** (DL-388 (6) (c)). #721 is reverted by PR #724 (squashes on a fully green R10 re-run at 0 behind; the freeze lifts at that squash). **New watch (no Bug now, DL-389 (2)):** a first-attempt part-form miss at the head of shard 4 on any `master` push before G8 comes to master with the head's timeline (the cold head of shard 4 is close to the 15 s form wait without #721 too). The keyboard-focus failure of the Nightly sweep is a separate Bug, DEF-086 (AQP-442, #726). Earlier: Open (new), 2026-11-25 (qa-engineer, on DL-388 (4)). |
| Jira / GitHub | [AQP-441](https://sankumar76.atlassian.net/browse/AQP-441) / [#725](https://github.com/sankumar76/Accucut-Quotation/issues/725) (labels bug, sev-2, ai-delivery, final-review; Jira also aiid-DEF-085, agent-qa-engineer). Relates to AQP-426 and AQP-1; also DEF-053 (AQP-383) and DEF-084 (AQP-440) as neighbours. Searched first: JQL on `aiid-DEF-085` and the AQP-426 key; GitHub title search: no earlier Bug. |
| Found by / date | CI; read and logged by qa-engineer, 2026-11-25; classified by master, DL-388 |
| Build / commit | `master` `0c201e65` (the #721 squash) and every head that holds it (`01cf56f0`, PR #719's head `95f3cc15`) |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 4 of 4)`, Playwright Chromium, project `desktop` (1366 px), production build, 4 workers, one shared PostgreSQL 17 per shard job. |

## Steps to Reproduce
Not on demand; it appears on shard 4's desktop list, where the new `workspace-tree-width.spec.ts` cases run beside the Users cases at the end of the shard.
1. Run Stage 12 on a head that holds `0c201e65`.
2. Read shard 4's `[desktop]` results: the part-form waits of `estimate-form-*` and `workspace-tree-width.spec.ts:449`, and `users.spec.ts:292`, `:329`.

## Expected Result
The part form is visible within its wait on every worker; `users.spec.ts:292` and `:329` pass attempt 1 under 25 s as on the five pushes before #721 (18.6 to 21.0 s and 15.4 to 19.7 s, master, DL-388 (1)).

## Actual Result
All time-outs; no wrong value or text.
- **The part form missing:** `expect(locator('form[data-part-form]')).toBeVisible()` at `tests/e2e/support/part-form.ts:97`, "element(s) not found" within its 15 s wait: `estimate-form-choice.spec.ts:88`, `:109`, `:126` and `estimate-form-sections.spec.ts:64` (attempt 1 about 20 to 21 s, four workers within one second, passed on retry); `workspace-tree-width.spec.ts:449` (attempt 1 about 30 s, retry passes at 28 to 30 s).
- **The Users tail:** `users.spec.ts:292` ('reset a password': the status 'Password set for ...' not visible after the dialog hid, the dialog not hidden after Enter, or the dialog not found) and `:329` ('deactivate and activate': the alert dialog still shown after the Deactivate click, or the row not showing 'Active') time out on both attempts at 32 to 35 s.

## Evidence (job logs, ANSI stripped; draw = matched per-test median of shard 4 against 31015cce's shard 4, job 138423470602; no secrets or personal data)
| # | Run | Shard 4 | Draw (QA) | What |
|---|---|---|---|---|
| 1 | **`master` push CI 45564830026** (0c201e65, #721), `failure`, 07:00:44Z to 07:23:37Z; Windows package 45564829966 `success` | job 139036974559: `3 failed, 5 flaky, 22 skipped, 557 passed (21.6m)` | **1.06** (511 tests, quartiles 0.94 to 1.17; windows 1.00 to 1.15) | `:292` 33.1 s (no. 583) and 32.4 s (no. 589); `:329` 34.6 s (no. 584) and 32.4 s (no. 592); `:449` 30.1 s (no. 594), retry passed 29.5 s (no. 595); the four form cases failed attempt 1 at 07:03:08Z (20.2, 20.9, 20.8, 21.5 s) and passed on retry (10.7 to 14.8 s); `users.spec.ts:58` (DEF-053, row 14) failed both attempts (33.0, 41.1 s). Shards 1 to 3 `success`, 0.71 to 0.88 of e20aa039's |
| 2 | **PR #719 run 45568776038** (head 95f3cc15, 0 behind 01cf56f0, so it holds #721; the PR changes only `tests/e2e/cancel-approval.spec.ts`), `failure`, `pull_request`, attempt 1, 07:31:14Z to 07:53:54Z | job 139049994081: `2 failed, 1 flaky, 22 skipped, 563 passed (18.3m)`; shards 1 to 3 `success` (`582 passed (15.4m)`, `574 passed (21.4m)`, `577 passed (14.0m)`) | **0.89** (510 tests, quartiles 0.81 to 1.00; windows 0.85 to 0.94): a fast draw | `:292` 33.1 s (no. 579) and 32.8 s (no. 589); `:329` 33.7 s (no. 580) and 34.6 s (no. 590); `:449` attempt 1 30.1 s (no. 588, `form[data-part-form]` not found), retry passed 28.2 s (no. 591); `users.spec.ts:58` passed. The DEF-084 split cases passed attempt 1 (master's reading) |
| 3 | **`master` push CI 45568667794** (01cf56f0, #722, holds #721), `success` with 2 flaky, 07:30:28Z to 07:52:56Z; Windows package 45568667807 `success` | job 139049648630: `2 flaky, 22 skipped, 563 passed (18.0m)`; shards 1 to 3 `success` (`581 passed (13.7m)`, `572 passed (21.3m)`, `575 passed (12.9m)`) | **0.92** (507 tests, quartiles 0.81 to 1.01) | `:329` attempt 1 32.9 s (no. 579), retry passed 30.3 s (no. 588); `:449` attempt 1 30.2 s (no. 587), retry passed 28.2 s (no. 589); **`:292` passed attempt 1 at 29.4 s and `:58` at 27.1 s** (both within 1 to 3 s of the budget); **0 failed part-form waits** on this run; other `workspace-tree-width` cases 6.3 to 18.0 s |

**Master's counter-reading (DL-388 (1), (7)):** before #721, on the five previous `master` pushes at ordinary draws, `:292` read 18.6 to 21.0 s and `:329` 15.4 to 19.7 s, including runs where they overlapped a 31 to 32 s `:58` retry, with no failed wait for the part form in shard 4. **PR #715's green run 45567646711 (head 6c59a2cd, holds #721) on a draw of 0.68:** `:292` 19.8 s, `:329` 20.1 s, `:449` 16.9 s, `:58` 19.0 s, 0 failed part-form waits; at the same draw without #721, e20aa039 (0.67) read `:292` 11.9 s and `:329` 9.4 s: about 1.7x and 2.1x slower beside #721's spec, and so about 30 s or more at a normal draw. **QA's readings of rows 2 and 3 add: at draws of 0.89 and 0.92 (faster than the reference) the Users tail and `:449` still time out or sit at 27 to 33 s, so a slow shard does not explain this.** The part-form miss recurred in rows 1 and 2 (one case in row 2) and not in row 3.

## Suspected Area (leads, not findings; the cause step is the developer's)
- **#721's change to the estimate page** (13 `src/` files, +564 / -9 per master): `page.tsx`, `estimate-workspace.tsx`, `parts-tree-area.tsx`, `tree-panel.tsx`, `use-parts-tree.ts`, lazy handle and menu chunks, `use-tree-width.ts` (`useSyncExternalStore`, `ResizeObserver`, a layout effect). Master saw no render gate on the form in the diff. Playwright drops the `next` server's stdout (DL-167), so no compile line can be read.
- **The new spec's cases beside the Users cases:** `workspace-tree-width.spec.ts` runs on the other workers from about 07:21:40Z in row 1, while `:292` and `:329` run; shard 4 has 587 tests against 581 before. A server or CPU effect (the tree-width cases reload and resize a page at 1366 px) would slow the Users dialogs' POSTs (reset password, deactivate) without any change to the Users page itself.
- **Not yet traced by QA:** whether #721 touches the Users page or its calls, or the account store; and whether the new spec makes people before `users.spec.ts:58`.

## Binding and proof (master, DL-388 (6); QA reads it)
1. **Cause step first**, before the re-land PR is opened, in writing on this Bug, with no new CI tooling: the developer reads the first render of the part form on `/estimates/[code]` after #721 (a Suspense boundary, a lazy chunk, `useSyncExternalStore`, a layout effect, the parts-tree data), and checks once by hand on a production build (`next build`, `next start`, 1366 px, Chrome's fast-network throttling) that the form is visible without waiting for the tree-width chunks, with the time stated. A product delay is fixed in the re-land; the PR carries the section 9 item 2 combined review only if it touches save or data paths.
2. **The re-land PR** (a new branch citing DL-387 and DL-388) keeps the DL-386 count at +1 or less (one shared person for the spec's cases, which allows a name that sorts before `users.spec.ts`), lists any E2E cases it places after `users.spec.ts` in its shard (DL-388 (5); such a PR comes to master first, with `:58`, `:292` and `:329` timings from its run of record), and splits or trims `:449` so every case reads under 25 s.
3. **Proof** on the re-land PR's run of record at 0 behind **and** on the first `master` push after its squash: 0 failed waits for `form[data-part-form]` in any shard; `users.spec.ts:292` and `:329` attempt 1 under 25 s; every `workspace-tree-width` case attempt 1 under 25 s; `users.spec.ts:58` within DEF-053's accepted behaviour. Durations (attempt 1, per width, shard and test number) and shard minutes reported.
4. **Bring-back:** the re-land merges by the end of **Wed 2 Dec**; otherwise DL-373 (5) puts the choice to the delivery lead (merge on Thu 3 Dec with the regression a day later, or move the panel to after G8 as known gap KG-5).
5. **Severity:** drops to Sev-3, type Test, only on the cause step. A wrong value or text received in any attempt, or a price on the Engineer's page, changes the grade at once (DL-385 (4) for the DEF-084 case).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| #721 reverted (new PR; freeze lifts at its squash) | orchestrator | | |
| Cause step, in writing on this Bug | developer | | |
| Re-land PR (placement, `:449` split or trimmed) | developer | | |
| Proof: re-land PR run of record | qa-engineer | | |
| Proof: first `master` push after the squash | qa-engineer | | |
| Severity set (Sev-3 Test, or kept) | master | | |
| Closed | qa-engineer | | |

## Records
Jira Bug AQP-441 and GitHub issue #725, created 2026-11-25 and cross-linked. Related: AQP-426 (STORY-CR01.3E), AQP-1, #721, #715, #719, #722; DEF-053 (row 14), DEF-084; DL-388 (master's ruling), DL-386, DL-387, DL-385 (6), DL-373 (5), DL-293; test plan 0.3.56 (the 0c201e65 reading and the watch entries, now this Bug's) and 0.3.57; CI runs 45564830026, 45568776038, 45568667794, 45567646711.
