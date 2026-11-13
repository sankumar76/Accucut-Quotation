# Review Report — AQP-275 (DEF-030, GitHub #325, PR #334) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (DL-174 (c): reviewer-quality and reviewer-standards, then QA G7 with the DL-174 (d) sweep) |
| Base…branch | `master` afecc58 (code) `...fix/AQP-275-notice-wraps-long-name` |
| Commit reviewed | `8ecdc0bb87428c549fbb5a1c2c2222d491326923` |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/334#pullrequestreview-5872762390. Label `review:quality-approved`.

## Summary
The fix is correct, and the rule now lives in one place. `Notice` (`src/components/shared/notice.tsx:45`) adds `BREAK_LONG_NAMES` (`[overflow-wrap:anywhere]`) to its outer `Alert`, merged with a caller's class through `cn`. The constant is defined once (`src/components/shared/break-long-names.ts`) and re-exported by `master-texts.ts`, so the 15 other importers are unchanged. The three masters callers drop their now-duplicate class. The PR states where the rule lives and why, as DL-174 (b) asks.

I found no notice that must not wrap. `overflow-wrap: anywhere` breaks inside a word only when that word cannot fit on a line by itself, so ordinary sentences wrap at spaces as before. It also lowers a box's min-content width. That would matter only for a notice in a shrink-to-fit context (inline, `w-fit`, a flex-row item or a table cell). Every one of the 23 call sites sits in a block or a stretched `flex-col` / grid parent (table below). The `Alert` row's description already had `min-w-0`, which is why the old code overflowed rather than squeezing.

Test power is good. The developer's control #335 (diff: `notice.tsx` only) is red where expected: 5 of the 6 new unit tests, the new E2E test at both widths, and `aqp-122-qa.spec.ts:388` at mobile. The sixth unit test, the CSS build of the class, stays green because the constant is unchanged. That is the right result. The exact CSS (`anywhere`, not `break-word`) is pinned by that build test. The E2E alone would pass with `break-word` here, because the description has `min-w-0`.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Scope | `git diff origin/master...8ecdc0b --stat` | 1 commit, 8 files, +113 / -11: `notice.tsx`, the new `break-long-names.ts`, the `master-texts.ts` re-export, 3 masters callers, 1 new unit file, 1 E2E file. No route, query, dependency or CI change |
| Every `Notice` caller | `git grep -n "<Notice" 8ecdc0b -- src` | 23 call sites: sign-in page and form, audit, design-system, Exchange rates, masters dialogs-failed, 3 masters page notices, 5 masters dialog failures, 4 Users dialogs and screen. Containers read: all block, `flex-col` or dialog panel, none shrink-to-fit |
| Customers (#297, not merged) | `git grep` on `origin/feat/AQP-142-customers` 2cee960 | `customer-screen.tsx:65` and `customer-edit-screen.tsx:86` still pass `className={BREAK_LONG_NAMES}` to `Notice`. After the rebase, `cn` dedupes it: `twMerge(clsx(X, X))` returns one `[overflow-wrap:anywhere]`, checked with the repo's `tailwind-merge`. Harmless; see QLT-01 |
| `cn` merge order | node, repo `tailwind-merge` | `cn('flex items-start …', '[overflow-wrap:anywhere]', 'mt-s-4')` keeps all three; a caller class does not drop the rule |
| PR CI | `gh run view 43195864855` | head 8ecdc0b, 5 of 5 success |
| Control #335 (developer) | `git diff 8ecdc0b e7af829`; run 43196210508 `--log-failed` | Diff: `notice.tsx` only (class and imports removed). Red: unit 5 failed of 3,191 (the 4 tone cases and the caller-class case); E2E `masters-table-actions.spec.ts:411` desktop at 360 and 768 (each with its retry); `aqp-122-qa.spec.ts:388` mobile (with retry). Shard 2 green |
| Own-width placement | `playwright.config.ts:41` `OWN_WIDTH_FILES`; file-level `beforeEach` skip at `masters-table-actions.spec.ts:299` | mobile and tablet ignore the file, so +2 instances (QLT-02) |
| New control of mine | not opened | No plausible plant survives. The class's presence is pinned by unit, its CSS by the build test, the page behaviour by E2E (#335). A run would only repeat #335 |
| Local tests | n/a | Not run (no `npm ci`); CI is the record |

## Correctness — every `Notice` caller after the change
| Caller | Container | Before | After |
|--------|-----------|--------|-------|
| Users page notices (`users-screen.tsx:157-170`: dialog failure, the Admin name in the title, success, danger) | page column | no class: **DEF-030** | wraps (also the Admin-name title at :163, a sibling the defect did not name) |
| Users dialogs (`user-form-dialog.tsx:172`, `deactivate-dialog.tsx:68`, `reset-password-dialog.tsx:73`) | dialog panel | no class | wraps; fixed sentences, no visible change |
| Process / Materials / Treatment page notices | page column | class from the caller | class from `Notice`; same rendered class |
| Masters dialog failures (5), `master-dialogs-failed.tsx`, Exchange rates (2) | dialog panel, `div`, `flex-col` | no class | wraps; fixed sentences, no visible change |
| Sign-in (`page.tsx:50`, `sign-in-form.tsx:51-54`), audit (`audit-screen.tsx:176`), design-system (4) | `flex-col` / padded `div` | no class | wraps; prose, no visible change |
| Customers (#297) page notices | page column | class from the caller | duplicate class, deduped by `cn` (QLT-01) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Info | `src/components/shared/notice.tsx:45` (and #297: `customer-screen.tsx:65`, `customer-edit-screen.tsx:86`) | DL-174 (b) "one place" | #297 still adds `className={BREAK_LONG_NAMES}` to two `Notice`s. After it rebases on this PR, that is a second copy of the rule that the comment says no caller adds. Nothing enforces "no caller adds it" | None visible: `cn` keeps one copy (checked). Only the "one place" is blurred | AQP-142's developer drops the two props when #297 rebases, and AQP-142's G6 checks it. Optional guard: a unit case that greps `src/` for a `<Notice` opening tag carrying `BREAK_LONG_NAMES` |
| QLT-02 | Info | `tests/e2e/masters-table-actions.spec.ts:406-436` | RISK-023, DL-151, DL-174 (b) | Placement is right. The test sets its own widths, so it belongs in an own-width file. This one already holds the SCR-14 Users width tests and their helpers (`addPerson`, `longName`, `USER_NAME_LENGTH`, `HEIGHT`), and DL-174 (b) prefers extending an existing Users test. Cost +2 instances, against +6 on three projects or a new own-width file plus changes to `playwright.config.ts` and `own-width-files.test.ts` | The file name no longer says everything it holds; the header says it | none from quality. File size and splitting are reviewer-standards STD-05; if the file is split, keep it in `OWN_WIDTH_FILES` with the file-level skip |
| QLT-03 | Info | `tests/unit/notice-wraps-long-names.test.ts:31-44` | test adequacy | The four tone cases repeat one branch-free assertion (cheap, +4). The build test is the one that pins `anywhere` over `break-word`, which the E2E cannot tell apart here. The E2E checks the notice box and the page overflow before and after Activate, which matches DEF-030's pass line | none | none |

## AC conformance (DEF-030 pass line, DL-174 (b))
| Requirement | Implemented in | Tested by | Result |
|-------------|----------------|-----------|--------|
| No page overflow after the notice with a 120-character name at 360 px | `notice.tsx:45`, `break-long-names.ts` | `masters-table-actions.spec.ts:411` (360) | Met; red on control #335 |
| Same at 768 px | same | `:411` (768) | Met; red on control #335 |
| The rule lives in one place, and the PR says where and why | `Notice`; PR body "Where the wrapping rule lives" | unit: 4 tones and the caller-class case | Met (QLT-01 for #297) |
| The class is `overflow-wrap: anywhere` (ux-spec 6.0 "Names wrap") | `break-long-names.ts:6` | unit build test | Met |
| Masters notices unchanged | 3 callers drop the duplicate | `aqp-122-qa.spec.ts:388` (Materials, mobile); unit | Met |
| A control without the class turns red | — | #335, run 43196210508 | Met |

## Issues for other roles
- **developer (AQP-142, #297):** at the rebase onto this PR, remove `className={BREAK_LONG_NAMES}` from the two `Notice`s (`customer-screen.tsx:65`, `customer-edit-screen.tsx:86`). The `BREAK_LONG_NAMES` import stays wherever cells or titles still use it.
- **qa-engineer (G7):** the DL-174 (d) sweep at 360 px also covers the Users danger notice whose title repeats the Admin's name (`users-screen.tsx:163`). The shared rule covers it now, but no E2E test exercises it.
