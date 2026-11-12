# Review Report — #245 (tech-debt: `useMasterList` and the remaining master pieces) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...tech-debt/245-use-master-list` (PR #265; base 2891457, `origin/master` is now cdb5dec, docs files only; 5 commits, 16 files, +205 / -165) |
| Commit reviewed | dcdad49743efd86c76c5abf323d1419aca10b556 |
| Date | 2026-11-11 |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/265#pullrequestreview-5867110166 (3 inline comments, submitted as COMMENT, `REVIEW_IDENTITY = single-token`); PR label `review:standards-approved` |
| Rulings | DL-150 (5), DL-153 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; two Minor and four Info) |

## Summary
Items 1 to 4 of #245 are done and nothing outside them changed: 16 files, all under `src/`, with no test, dependency, lockfile, Prisma, route, audit-call or CI change. The new files sit in the right place (`features/masters/`), use named exports and `'use client'`, and are small (87, 34 and 27 lines). The three list copies and the two dialog-wiring copies are gone; no fourth list body is left in `src` (DL-153 (1) is met for what this PR owns). The two Minors are about wording: the latest-read-wins comment and PR-body row understate how the guard behaves, and the exported hook has no doc comment of its own. Item 5 (Users) is not done; the PR says so plainly and the reasons hold up against the code.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint` on the 16 changed `.ts` / `.tsx` files plus `use-read-again.ts`, run read-only in the existing worktree `agent-a38dd44fc18d3f035` (`node_modules` junction, `src/generated/prisma` present) | Clean, no output. CI "Stages 1 to 11b" green on run 43058209908 |
| Type-check | `npx tsc --noEmit --incremental false` in the same worktree | Exit 0, no errors. CI green |
| Format-check | none configured (`CLAUDE.md` lists none; ESLint is the style gate) | n/a |
| CI | `pull_request_read get_check_runs` | 5 of 5 success on run 43058209908 (Stages 1 to 11, 11b, E2E shards 1 to 3). Counts, path 4:45 and first-load JS are the developer's figures (PR body); I did not recompute them (not my lane) |
| Worktree caveat | `git log -1` | The worktree was at dcdad49 when I started and was then moved to `be48b0c` (branch `control/245-qlt-p1-no-latest-read-wins`, reviewer-quality's plant P1). The plant changes one line, `use-master-list.ts:75` (`!==` to `>`); it cannot change a lint or type result, and CI on dcdad49 is the reference. I did not touch the worktree |
| Scope | `pull_request_read get_files`; `git diff --name-only 2891457...dcdad49` | 16 files, all under `src/`: 12 in `src/components/features/masters/`, 3 in `src/lib/masters/` (`exchange-rates.ts`, `master-rules.ts`, `process-items.ts`) and `src/server/services/audit-events.ts` (one import line). No `tests/`, `package.json`, lockfile, `prisma/`, `.github/`, route file |
| Behaviour (strings) | node script over `git diff -U0 2891457...dcdad49 -- src`: string and template literals on code lines (comments and imports excluded), added vs removed | Added only: `'use client'` x3 (the three new files). Removed only: the class strings, `"rate-search"`, `"search"`, `"off"`, `"small"`, `"danger"` of the removed local `SearchBox` and `DialogsFailed` / `DialogFailed` (all present again in `MasterSearchBox` and `MasterDialogsFailed`), and `'ok'`, `'loading'`, `'ready'`, `'error'`, `''` from the three removed list copies. No user-visible copy appears or disappears |
| Behaviour (markup) | read of `master-search-box.tsx` against the removed `SearchBox` in the diff | Character-identical markup and classes; `id`, label, placeholder are props, `process-screen.tsx` passes `id="rate-search"` as before |
| Old names / stale references | `grep` for `DialogsFailed`, `DialogFailed`, `useItemsList`, `useFocusAfterRead`, `RUPEE` across `src`, `tests`, `scripts`, `docs` | No importer of `RUPEE` from `process-items`; no test names a moved symbol; `docs/04-architecture/architecture.md` and `ux-spec.md` name none of the moved files or hooks (so no doc update is owed); only `decision-log.md`, `gate-log.md`, `project-state.md` mention the hooks, historically |
| Duplicates left behind | `grep` for `useAfterDelay(status === 'loading'`, `useFirstOpen`, `revealNearest`, `newest.current`, `'₹'` | The list body now exists once (`use-master-list.ts`); `use-exchange-rates.ts:66` is a pair of rates with its own `row`, not a list; the Audit screen is a different screen; `useFirstOpen` / `revealNearest` copies remain only in `users-screen.tsx` (item 5) and the shell components (not masters). `₹` literal is written once (`master-rules.ts:34`); the others are comments |
| File and function size (§1) | `wc -l`; read of every new function | `use-master-list.ts` 87 lines, `use-dialog-opener.ts` 34, `master-dialogs-failed.tsx` 27. `useMasterList` body about 27 lines, complexity under 10. No file near 400 lines |
| Naming (§2) | read | `useMasterList`, `useDialogOpener`, `MasterDialogsFailed` are intent-revealing; `read` vs `refresh` is documented; `press`, `prepare`, `byKeyboard` read as intended; `Initial` / `Items` are readable generics. `newest` / `mine` are carried over unchanged from `use-treatments.ts` |
| Security hygiene (§5) | read of the diff | No input handling, query, shell, secret, URL, auth or dependency change. Gitleaks: CI Stage 2 green (the developer also ran 8.30.1 over `src`) |
| Commits and branch (§9) | `pull_request_read get_commits` | 5 Conventional Commits `refactor(masters): ... [#245]`, one logical change each. Branch and title: see STD-03. Fix-up commit: see STD-05 |
| PR body (CLAUDE.md §7.1: the Dev Record of record) | read in full | Item 5 deferral and "Refs #245" are stated; the behaviour change is declared; counts and plants are tabulated. One row is inexact: STD-01 |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `src/components/features/masters/use-master-list.ts:24-25`; PR #265 body, table "How the three copies' differences are treated", row "Treatments' latest-read-wins" | Coding Standards §8 (comments must stay true); DL-153 (2) ("The PR states how it treats the differences") | The comment says the rule "only matters when two reads overlap and the older one answers last", and the PR body says "the state after ... two reads that answer in order, is the same". The guard at line 75 (`if (mine !== newest.current) return;`) drops every read that is not the newest when it answers, including an older read that answers first. With two overlapping reads on Process or Materials: (a) the first answer is discarded and the status stays `loading` (skeleton, `aria-busy`) until the newest read answers; (b) if the older read succeeds and the newest fails, the older rows are never applied (before: applied, then `error`). The state after both answers in order ends the same; the path does not | Master rules on the behaviour change from the body's wording, and AQP-142 reads the comment as the hook's contract. Both under-describe the one change the PR admits | Reword the comment to "A read that answers after a newer one was started is ignored, whichever answers first, so the status stays `loading` until the newest read answers. Treatment / Color had this rule; Process and Materials did not." and correct the body row the same way, naming case (b). No behaviour change is asked |
| STD-02 | Minor | `src/components/features/masters/use-master-list.ts:59` | Coding Standards §8 (public functions have doc comments) | `useMasterList` is the only exported function in the PR's new files without a doc comment. The block at lines 11-28 is a module comment (blank line, then `export interface`), so it does not show at the function; `useFocusAfterRead`, `useReadAgain` and `useDialogOpener` each have one | The Customers list (AQP-142) will copy this call shape; the one thing a caller must get right (`initialItems` list vs `null`, stable `readList`) is not at the function | Add above line 59: `/** The list of a masters screen: pass \`initialItems\` when the page rendered the list, \`null\` when the screen reads it itself (then call \`read()\` once). \`readList\` must be a stable import. A failed read sets \`status\` to \`'error'\` and keeps the rows; nothing throws. */` |
| STD-03 | Info | branch `tech-debt/245-use-master-list`; PR title `#245: ...` | Coding Standards §9; `CLAUDE.md` §7.3 | Carry-over of #119 STD-08. `tech-debt/<issue>-<slug>` and `#<issue>:` are not in the listed patterns; they follow merged PRs #139 and #235. Coding Standards §9 and `CLAUDE.md` §7.3 are unchanged | None for the developer | Master's recommendation of DL-150 (6) stands: the delivery lead adds both patterns to §9 and §7.3 (outside the reviewer's and master's write area) |
| STD-04 | Info | PR #265 body, "Item 5" row and decision 7; `src/components/features/users/opener.ts`, `texts.ts`, `users-screen.tsx` | #245 scope; DL-150 (5) ("Items 4 and 5 may be dropped with a recorded reason") | Good practice. Item 5 is stated plainly (line 3 "Refs #245 ... #245 stays open", the table, decision 7). Reasons checked against the code: `users/opener.ts` has a `userId`-keyed `Opener` and the `deactivate` / `activate` toggle, and `users-list.tsx` (edited by open PR #222, labels `review:quality-changes-requested`) imports `isOpener`; `users/texts.ts:28-31` repeats the four strings (`FAILED_DIALOGS_TITLE`, `FAILED_CONFIRMATION_TITLE`, `FAILED_DIALOGS_MESSAGE`, `TRY_AGAIN_BODY`) and `FAILED_CONFIRMATION_TITLE` lives in `process-texts.ts`, the other three in `master-texts.ts`, as stated; `users-screen.tsx` has a refresh notice (`FAILED_REFRESH_TITLE`), no `MasterLoadError`; its `useFirstOpen` / `revealNearest` wiring is the item 2 shape. Nothing in the diff is outside items 1 to 4 | None | None. For master: #245 stays open for item 5, due before G8 (DL-150 (5)); its follow-up needs `useDialogOpener` generic over the opener type and the shared strings |
| STD-05 | Info | commits 9f08d56, 0411da8 (comments in `use-master-list.ts` and `use-dialog-opener.ts`), fixed in dcdad49 | Coding Standards §9 (one logical change per commit) | The two comments carried the text `#245`, which `tests/unit/tokens.test.ts` reads as a 3-digit hex colour; dcdad49 rewrites them to "GitHub issue 245". The earlier commits therefore fail that test on their own (run 43057465219 was red at 5c98b89) | None after a squash merge | None. A fix-up folded into its origin commit would have kept each commit green |
| STD-06 | Info | `src/components/features/masters/use-dialog-opener.ts:22-30`; `use-master-list.ts:59-86` | Coding Standards §6 (conventions only); cross-reference | No direct test or plant covers `useMasterList.refresh` or the `loader.pending` guard of `press` (PR decision 8), and A1 / A2 are not caught on Process or Materials (the #244 gap, per the PR). Test adequacy is reviewer-quality's lane | AQP-142 will compose both hooks | Note for reviewer-quality and master; no standards action. Placement, naming and the JSDoc of `use-dialog-opener.ts` conform |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
// use-master-list.ts:24-25
 * Latest read wins (QLT-04): a read that answers after a newer one was started changes nothing. Treatment / Color had this rule; Process and
 * Materials did not, and with this hook they have it too. It only matters when two reads overlap and the older one answers last.
...
    if (mine !== newest.current) return;
```
**Suggested**
```ts
 * Latest read wins (QLT-04): a read that answers after a newer one was started changes nothing, whichever of the two answers first. While two
 * reads overlap the status therefore stays `loading` until the newest one answers. Treatment / Color had this rule; Process and Materials did not,
 * and with this hook they have it too.
```
Trace for the two cases, with A started before B and `refresh` setting `loading` each time: A answers first, `mine` 1 against `newest` 2, A is dropped, status `loading`; B answers, status `ready` or `error`. Before this PR (Process, Materials) A would have set the rows and `ready` at its answer.

### STD-02
**Suggested**
```ts
/**
 * The list of a masters screen: pass `initialItems` when the page rendered the list, `null` when the screen reads it itself (then call `read()`
 * once). `readList` must be a stable import. A failed read sets `status` to `'error'` and keeps the rows; nothing throws.
 */
export function useMasterList<Row, Initial extends ReadonlyArray<Row> | null>({
```
</details>

## Conformance of #245's items (standards view)
| Item | Done in | Standards check | Result |
|------|---------|-----------------|--------|
| 1. `useMasterList` | `use-master-list.ts`; `use-process-master.ts`, `use-material-master.ts`, `use-treatments.ts` | One generic parameter instead of an overload (decision 3, §1 DRY); wrappers kept for `ReturnType<typeof useItemsList>` (decision 4); `readList` stability documented (decision 2); no list body left | Done; STD-01, STD-02 |
| 2. Dialog-loader wiring | `use-dialog-opener.ts`, `master-dialogs-failed.tsx`; Process and Materials | Order of state changes unchanged (read against the old `openDialog` bodies in the diff); title passed in, so no copy changed; Treatment / Color has no loader, as stated | Done |
| 3. Process on `MasterSearchBox` | `process-screen.tsx` | Markup identical; five imports removed; `master-search-box.tsx` comment corrected | Done |
| 4. `RUPEE` | `master-rules.ts` | Neutral file the server may import (decision 6); no re-export; five importers changed one import line each; header comment of `master-rules.ts` updated | Done |
| 5. Users copies | none | Deferral recorded with reasons that hold (STD-04) | Not done, allowed by DL-150 (5) |

## Reviewer-specific tables
Issues for other roles:
- **master:** (1) STD-01 asks only for exact wording; the behaviour change itself (latest-read-wins on Process and Materials, one flag away from an option) is for master's G6 decision, with reviewer-quality's view. (2) #245 stays open for item 5 ("Refs", not "Closes"); make sure the squash message does not close it. (3) STD-03: the branch and title patterns still wait for the delivery lead. (4) `origin/master` moved by docs files only since 2891457 (cdb5dec), so "Update branch" changes none of the 16 files.
- **reviewer-quality:** STD-06 (no test or plant on `refresh` / `press`; the #244 gap for A1 and A2). The worktree `agent-a38dd44fc18d3f035` is the one holding your plant be48b0c; I ran lint and type-check there before or alongside it and did not modify it.
- **solution-architect, ux-expert:** none from this PR. The architecture and UX documents name none of the moved files, hooks or `RUPEE`; the earlier #119 items (STD-07, `ux-spec.md:853`) are unchanged by this PR.

## Previous Findings (re-review only)
n/a (round 1). Carried over from PR #235: STD-04 (rename `process-opener.test.ts`) and STD-06 (stale `FUTURE_IMPORTS` entry) ride in #244 and are untouched by this PR (no test file changes); STD-05 is the scope of this PR (items 1 to 5 as above); STD-08 is STD-03 here.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS; Blocker 0, Critical 0, Major 0, Minor 2, Info 4
- Review: https://github.com/sankumar76/Accucut-Quotation/pull/265#pullrequestreview-5867110166
