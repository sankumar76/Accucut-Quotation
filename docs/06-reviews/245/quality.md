# Review Report — #245 (tech-debt refactor, PR #265) — Quality

> **Round 2 (DL-162 condition R) is at the end of this file:** APPROVE WITH COMMENTS at `aad53e9`. QLT-02 is Fixed. P1 is red 3 and P3 is red 9 again. The round-1 text below is unchanged.

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `2891457...tech-debt/245-use-master-list` |
| Commit reviewed | `dcdad49` |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/265#pullrequestreview-5867213193

## Summary
The refactor keeps behaviour on all four screens, with one exception: latest-read-wins. I checked equivalence screen by screen (tables below). Two of my plants turned CI red, and both confirm that the new shared code carries the old guarantees. The latest-read-wins guard in `useMasterList` is pinned by Treatments' existing test (P1, red 3). The `loading` step of `refresh` is pinned on Process and Materials (P3, red 9).

The one behaviour change is that latest-read-wins now applies on Process and Materials too. It is a fix, not a regression, and I recommend that master rule it **in**. Before this PR, an older re-read could put back a list that was missing the change just saved, with the "saved" notice above it. It could also show a false load error after a good read. Neither can happen now.

Two Minors, neither of which holds the gate:
- **QLT-01:** item 2's new shared pieces have no regression net. The press guard (P2) and the failed-dialog title (P4) both stayed green.
- **QLT-02:** `useMasterList` depends on `readList` keeping its identity, and only a comment says so. AQP-142 is the next caller, and it is the caller that would trip over this.

The hook's API serves SCR-12 as DL-153 (2) reads it. I agree that item 5 (Users) is held for a real reason. **#244 does not have to land before or with this PR** (QLT-07).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| CI on the PR head | run 43058209908 (jobs read) | 5 of 5 success on dcdad49. Unit 2,922, full Vitest 5,285, E2E 778 passed (265 + 263 + 250), skipped 24: equal to `master` 2891457 (run 43053208506), as the PR states |
| Type-check | `npx tsc --noEmit` (worktree `agent-a38dd44fc18d3f035` at dcdad49, Prisma client present) | exit 0 |
| Unit tests (targeted) | `npx vitest run` on `tokens`, `treatments-focus-rule`, `process-items-lib`, `materials-lib`, `masters-audit-events`, `treatments-lib`, `process-opener` | 7 files, 206 of 206 passed. CI is the reference for the full run (DL-057); a local full run was not done |
| Lint (plants) | `npx eslint <the planted file>` on each plant branch | clean ×4, so each plant can fail only in a test, not in lint |
| Test-file diff (G12) | `git diff --stat 2891457...dcdad49 -- tests` | empty: no test changed |
| Plants | 4 control PRs from dcdad49 (below) | 2 red and 2 green, all as predicted |

## Plants (DL-091, DL-153 (2) "plants on the shared hook")
Each plant is a one-line diff from `dcdad49`. A script applied it and failed unless the anchor occurred exactly once; a CRLF anchor was handled. The diff was printed before the push and is in the PR body. CI runs on the merge with `master`. All four PRs were closed unmerged after their runs had been read.

| Plant | Diff | PR, run | Result | Caught by |
|---|---|---|---|---|
| **P1** latest-read-wins guard can never fire | `use-master-list.ts:75` `if (mine !== newest.current) return;` → `if (mine > newest.current) return;` | #273, 43126775325 | **red, 3** | `treatments-focus.spec.ts:213` "the latest read wins" at all three widths, failing at `:249` `await expect(rowOf(page, name)).toBeVisible();` (the older list came back). No Process or Materials test overlaps two reads |
| **P2** a second press while the dialogs' code loads is not ignored | `use-dialog-opener.ts:25` drop `if (loader.pending) return false;` | #274, 43126788511 | green, 5 of 5 (as predicted) | none. E2E 778 passed, skipped 24 |
| **P3** `refresh` does not set `loading` | `use-master-list.ts:81` drop `setStatus('loading');` | #275, 43126800700 | **red, 9** | `process-master.spec.ts:337` (`:355` "Loading the rates" not attached), `materials.spec.ts:335` (`:353`) and `aqp-122-qa.spec.ts:277` (`:299`), each at three widths. Treatment / Color's loading test covers only the first read |
| **P4** Process's failed-dialog titles swapped | `process-screen.tsx:79` `? FAILED_CONFIRMATION_TITLE : FAILED_DIALOGS_TITLE` → `? FAILED_DIALOGS_TITLE : FAILED_CONFIRMATION_TITLE` | #276, 43126812281 | green, 5 of 5 (as predicted) | none. No test makes the Process or Materials dialogs' code fail to load |

The developer's A1 (#268) and A2 (#269) controls on `use-read-again.ts` stand as reported. I read their lists in the PR body; they match DL-150 (1). A1 is caught on Treatment / Color through the new `useMasterList` + `useReadAgain` path, which is evidence that the rewired Treatments focus path still holds DEF-020.

The permission system refused deletion of the branches `control/245-qlt-{p1-no-latest-read-wins,p2-no-pending-guard,p3-refresh-no-loading,p4-process-failed-title}`. They are left for the orchestrator or a human to delete.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `src/components/features/masters/use-dialog-opener.ts:25`; `process-screen.tsx:79`; `materials-panel.tsx:71` | UX spec 7.3.1 rule 11; SCR-25; test adequacy | Item 2 puts the first-open wiring of Process and Materials in one place, and no test pins it. P2 (the press guard dropped) and P4 (Process's two failed-dialog titles swapped) stayed green. The gap existed before, in two copies. It now sits in one shared piece that any later masters screen with dialogs will compose | A change to `press` or to the title choice can let a double press start a second request with a second focus target, or show "The form did not open." for a delete, with CI green. Admins on a slow or failing network are the ones who would see it | Follow-up, not this PR (a refactor keeps its tests unchanged, DL-129 (5)). One E2E per screen in the `shell-first-open.spec.ts` pattern: hold the dialogs' chunk, press twice, expect one request and the pending look; abort the chunk, expect the notice with the right title for Add / Edit and for Delete (Process). P2 and P4 are the controls. Master decides whether this rides in #244 or gets its own `tech-debt` issue |
| QLT-02 | Minor | `src/components/features/masters/use-master-list.ts:33-36, 71-78` | DL-153 (2) (API for AQP-142); maintainability | `read` and `refresh` keep their identity only while `readList` does. Only the doc comment says so (decision 2). On the `initialItems: null` path, the screen starts the first read in `useEffect(() => void read(), [read])`, as `use-treatments.ts:121-123` does. With an inline `readList` (`() => listCustomers()`, say), every settled read re-renders, makes a new `read`, re-runs the effect and reads again: an endless fetch loop | No current caller is affected, because all three pass a module import. AQP-142 is the next caller, and nothing but a comment stops the loop there | Hold the latest `readList` in a ref so `read` never depends on it: `const readListRef = useRef(readList); useEffect(() => { readListRef.current = readList; });` and `const read = useCallback(async () => { …; const outcome = await readListRef.current(); … }, []);`. Behaviour is the same for an import. Either in this PR (cheap, `src/` only, re-read by both reviewers) or as a line in AQP-142's Dev Context ("`readList` is an import"); master's choice |
| QLT-03 | Info | `src/components/features/masters/use-master-list.ts:75` | DL-150 (5), DL-153 (2); AQP-130 QLT-04 | **Latest-read-wins on Process and Materials is a fix. Recommend master rule it in.** Details below. It is pinned on the one shared line by `treatments-focus.spec.ts:213` (P1 red 3). Process and Materials reach the same line with no code of their own, so a per-screen overlap test would test the same line again | Better outcomes only (below). The wording of the comment and the PR body is STD-01's (reviewer-standards); I do not repeat it | none. No per-screen test required |
| QLT-04 | Info | `use-process-master.ts:34-36`, `use-material-master.ts:34-36`, `use-treatments.ts:39-46`, `process-screen.tsx`, `materials-panel.tsx` | DL-150 behaviour preservation | Screen-by-screen equivalence holds; see the tables below. P3 (red 9) shows that `refresh`'s `loading` step is pinned on both server-rendered screens | none | none |
| QLT-05 | Info | `use-master-list.ts:59-87` | DL-153 (2), AQP-142 Dev Context C | The API serves SCR-12 as DL-153 reads it. Per AQP-142's Dev Context, SCR-12 is a server-rendered list (`masters/customers/page.tsx`) with a separate edit page (`[id]/page.tsx`), a client-side search, and the states Loading, Empty, No match and Error. That is `useMasterList({ readList: listCustomers, initialItems, filter })` plus `useReadAgain` and `MasterLoadError`. `filter` is the caller's, so a search over several columns needs no change to the hook | none, provided QLT-02 is respected | AQP-142 composes it. Its slow-read focus test (DL-150 (8) D) applies wherever its list uses `useReadAgain` |
| QLT-06 | Info | PR body decision 7; `src/components/features/users/opener.ts`, `texts.ts` | #245 item 5 | I agree that item 5 is held for a real reason. `users/opener.ts` is keyed by `userId` and is imported by `users-list.tsx` (PR #222). The Users list has no `loading` / `error` state and reports a failed re-read as a page notice, which is a different shape, not a copy. "Refs #245" keeps the issue open | none | #245 stays open for item 5 after #222 and #171, due G8 as set |
| QLT-07 | Info | process | DL-150 (4), DL-153 (2) | **#244 need not land before or with this PR.** Process and Materials call `useReadAgain` exactly as before; only the body of `refresh` moved, and P3 pins it. Treatments' focus path did change, and A1 (#268) catches it there. #244's gap (A2 on all three screens, A1 on Process and Materials) is the same before and after this PR (#268 and #269 match DL-150 (1)) | none new | #244 branches from `master` **after** this PR merges, so that its A1 and A2 controls plant the code AQP-142 composes. It stays due before AQP-142's G6 |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-03: what a person could see, before and after
Two re-reads overlap only when a second change is saved while the first change's re-read is still out. The rows stay on screen for 300 ms, and the header's Add button stays usable throughout. Process can also overlap through `onBlocked`'s background read.

| Case | Before (Process, Materials) | After (all three) |
|---|---|---|
| Older read answers **last**, OK | The older list replaces the newer one: the row just saved is missing under its "saved" notice, and stays missing until the next change | ignored: the newest list stays |
| Older read answers last, **failed** | The load error replaces a good list, and focus goes to its title (DEF-020 path) | ignored: the newest outcome stays |
| Older read answers **first** | Its list shows briefly and the status is `ready`, then the newer list arrives | ignored: the status stays `loading` (skeleton after 300 ms, `aria-busy`) until the newest answers. The end state is the same |
| One read, or no overlap | — | identical |

The third row is the only new visible difference in a correct run. It is consistent: the screen does not claim `ready` while a read it started is still out. Focus is unaffected, because `useFocusAfterRead` returns focus once, on the first settled read, and the opener ref is the current one in both versions.

### QLT-02: suggested change (sketch)
```ts
const readListRef = useRef(readList);
useEffect(() => {
  readListRef.current = readList;
});
const read = useCallback(async (): Promise<void> => {
  newest.current += 1;
  const mine = newest.current;
  const outcome = await readListRef.current();
  if (mine !== newest.current) return;
  if (outcome.status === 'ok') setItems(outcome.value);
  setStatus(outcome.status === 'ok' ? 'ready' : 'error');
}, []);
```
</details>

## Reviewer-specific tables
**Equivalence, screen by screen** (base 2891457 against head dcdad49)

| Screen | Old | New | Same? |
|---|---|---|---|
| Process (SCR-11) list | `useItemsList`: `items`, `status` `'ready'`, `query`, `useAfterDelay(status==='loading')`, `refresh` = set `loading`, `await listProcessItems()`, set items if ok, set status; deps `[]` | `useMasterList({ readList: listProcessItems, initialItems, filter: filterByName })`. Skeleton gate `status==='loading' && items !== null`, and `items` is never `null` here. `refresh` deps `[read]` → `[readList]`, an import, so stable | yes, apart from latest-read-wins (QLT-03) |
| Process dialogs | `useDialogs.openDialog`: guard `loader.pending`, `opener.current`, `setPressed`, target / form / blocked, `setOpen`, `activate`; `DialogsFailed confirmation={open==='delete'\|\|'blocked'}` | `press(from, byKeyboard, prepare)` in the same order; `MasterDialogsFailed title={…same condition…}` with the same reveal effect and the same `Notice` | yes (not pinned: QLT-01) |
| Process search | local `SearchBox`, id `rate-search` | `MasterSearchBox id="rate-search"`, the same label and placeholder; the markup is character-identical (STD-04 of reviewer-standards) | yes |
| Process focus | `useReadAgain({ status, result: items, opener, refresh })` | unchanged call | yes |
| Materials | as Process, with `filterMaterials` and `FAILED_DIALOGS_TITLE` | as Process | yes, apart from QLT-03 |
| Treatment / Color | `read(returnFocus)`: `askForFocus(returnFocus)`, newest guard; `readAgain` = set `loading`, `read(returnFocus)`; first read `read(false)` | `useMasterList({ readList: listTreatments, initialItems: null })` and `useReadAgain`. `askForFocus` and set `loading` swap order, both synchronous in one handler. The first `read()` no longer calls `askForFocus(false)`, which makes no difference: `wantsFocus` starts `false`, and no ask can come before the mount effect | yes. A1 (#268) catches its DEF-020 branch on the new path; P1 is caught here |
| Exchange rates | `RUPEE` from `process-items` | `RUPEE` from `master-rules`, the same value; the hook is not touched | yes |
| Server `audit-events.ts` | `RUPEE` from `process-items` | from `master-rules`; no other change | yes |

**Conformance with the #245 items** (a tech-debt PR has no ACs, so these items stand in for them)

| Item | Implemented in | Tested by | Result |
|---|---|---|---|
| 1. `useMasterList` | `use-master-list.ts`; three callers | P1 red 3 (Treatments), P3 red 9 (Process, Materials); existing E2E 778 | Met |
| 2. Dialog-loader wiring | `use-dialog-opener.ts`, `master-dialogs-failed.tsx` | none (P2, P4 green) | Met; regression net absent (QLT-01) |
| 3. Process on `MasterSearchBox` | `process-screen.tsx` | the Process search E2E (unchanged, green) | Met |
| 4. `RUPEE` home | `master-rules.ts`; five importers | tsc; `process-items-lib`, `masters-audit-events` unit tests | Met |
| 5. Users copies | not done | n/a | Held, with a real reason (QLT-06); #245 stays open |
| DL-153 (2): state how the three copies' differences are treated | PR body table | n/a | Met; latest-read-wins is declared (QLT-03) |

## Issues for other roles
- **master:** (1) rule latest-read-wins on Process and Materials **in** (QLT-03); (2) #244 neither before nor with this PR, but after it, still due before AQP-142's G6 (QLT-07); (3) route QLT-01 (into #244 or a new `tech-debt` issue) and QLT-02 (this PR, or an AQP-142 Dev Context line).
- **scrum-master (if master routes QLT-02 to AQP-142):** in AQP-142's Dev Context C, `readList` must be a module import.
- **orchestrator or a human:** delete the four `control/245-qlt-*` branches; the permission system refused it.

---

# Round 2 — DL-162 condition R

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (narrow: the condition-A push and the branch update; DL-091, DL-162 (4)) |
| Diff reviewed | `dcdad49..65af06b` (condition A); merge commit `aad53e9` (65af06b + `master` 774eff8) |
| Commit reviewed | `aad53e9` |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/265#pullrequestreview-5867836989

## Summary
Condition A is one commit, `65af06b`, in one file: `use-master-list.ts`, +20/-7. It makes three changes. The module comment now states latest-read-wins exactly (STD-01). The exported hook gets a doc comment (STD-02). The latest `readList` is held in a ref, so `read` is `useCallback(…, [])` (QLT-02). The PR body's row, decision 2 and the round-2 Dev Record row match the code. The push stays inside DL-162 (3), and nothing else changes behaviour.

The orchestrator's update is a GitHub merge commit, `aad53e9`. `git show --cc aad53e9` prints no hunks, so there was no conflict resolution. `git diff 65af06b aad53e9 -- src tests` is empty. The PR's 16 files against 774eff8 are the same set as in round 1. Master's side of the merge brings only Dependabot bumps (tailwindcss 4.3.5, @playwright/test 1.65.0, next 16.4.5) and docs.

**QLT-02 is Fixed.** P1 is red 3 and P3 is red 9 again, on `master`-based controls from `aad53e9`, with the same failing tests as round 1. CI on `aad53e9` is 5 of 5, with counts +0 / +0 / +0 / +0 against the `master` commit in its merge ref. One new Info (QLT-08).

| Severity | Count (round 2, open on this PR) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 (QLT-01 is carried by #277, DL-162 (5)) |
| Info | 1 (QLT-08) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Push diff | `git diff dcdad49 65af06b` | 1 file, `use-master-list.ts`: comments (:24-27, :35-36, :61-65, :76), `import { useEffect }`, `readListRef` and its effect (:77, :80-82), `await readListRef.current()` and deps `[]` (:87, :91). No test change |
| Merge commit | `git show --cc aad53e9`; `git diff 65af06b aad53e9 -- src tests`; `git diff --stat 774eff8 aad53e9` | no resolution hunks; empty; the same 16 files (218+/165-) |
| CI on the PR head | run 43136387943 (jobs and log read), the only run on aad53e9, attempt 1 | merge ref 3c18dcd (aad53e9 into **774eff8**), 5 of 5 success. Unit **2,922**, full Vitest **5,285**, E2E **265 / 263 / 250 = 778**, skipped **3 + 4 + 17 = 24**. That equals 774eff8's push run 43135619452 (2,922 / 5,285 / 265 / 263 / 250 / 24): **+0 / +0 / +0 / +0**. JS budget: `/masters/materials` 186,501, `/masters/process` 174,153 (limit 200,000). Gitleaks: 701 commits, no leaks. 0 failed and 0 flaky lines |
| Previous push run | 43135407890 on 65af06b | success (the developer's evidence; not re-read in detail) |
| Type-check | `npx tsc --noEmit` (worktree `agent-a38dd44fc18d3f035` at 65af06b; `src` identical to aad53e9) | exit 0 |
| Lint | `npx eslint src/components/features/masters/use-master-list.ts` (same worktree, and on each plant) | clean ×3 |
| Plants | 2 control PRs from aad53e9 against `master` | both red, with the same lists as round 1 |

## Round-1 findings, verified
| ID | Round 1 | Round 2 status | Evidence |
|---|---|---|---|
| QLT-01 | Minor | **Not fixed here, as ruled.** Routed to #277 by DL-162 (5) | `use-dialog-opener.ts:25` unchanged; thread reply r4545291226 |
| QLT-02 | Minor | **Fixed** | Below; thread reply r4545290661 |
| QLT-03 | Info | Ruled IN (DL-162 (2)); still pinned | P1 red 3 (#278); the comment (:24-27) matches the code; thread reply r4545315210 |
| QLT-04 | Info | Still pinned | P3 red 9 (#279); thread reply r4545315516 |
| QLT-05 | Info | Holds, and is stronger | An inline `readList` such as `() => listCustomers()` is now safe for AQP-142. No Dev Context line is needed (DL-162 (7)) |
| QLT-06, QLT-07 | Info | Unchanged | — |

### QLT-02: why the loop can no longer happen
- `read` (`use-master-list.ts:84-91`) is `useCallback(…, [])`. Everything it uses is a ref (`newest`, `readListRef`) or a state setter (`setItems`, `setStatus`), and React keeps all of those stable. So `read` has one identity for the life of the component, whatever `readList` is passed.
- `refresh` (:93-96) depends only on `[read]`, so it is stable too. `useReadAgain` receives a stable `refresh`.
- `use-treatments.ts:121-123`, `useEffect(() => void read(), [read])`, therefore runs once on mount, plus React's StrictMode re-run in development, as before. A settled read re-renders the screen but cannot re-run the effect. The endless loop of round 1 cannot happen.
- **Latest function.** `readListRef` starts as the first `readList` (:77) and is overwritten after every commit by a no-deps effect (:80-82). This is the same pattern as `use-first-open.ts:65-68`. The hook's effect is declared before the caller's effects in the same component, so in the commit where `readList` changes, it runs before the screen's own effect. Event-handler calls (Try again, a saved change) always come after the commit.
- **For the three callers** (`listProcessItems`, `listMaterials`, `listTreatments`, all module imports), `readListRef.current` is always the same function. The guard, the setters and the `loading` step are untouched, so behaviour is identical, and CI's +0 counts and the two red plants agree.
- The option doc (:35-36) now says that `readList` "may be a different function on each render" and that `read` / `refresh` "keep their identity whatever is passed". Both are true of the code. The new doc comment (:61-65) is accurate too. "A failed read … keeps the rows; nothing throws" holds because the three `list*` client functions return an `Outcome` rather than throwing. That is unchanged from round 1.

## Plants (round 2; DL-091, DL-162 (4))
Each plant is a one-line diff from `aad53e9`, on a branch `control/245-qlt-r2-*`. The script fails unless its anchor occurs exactly once and keeps the file's line endings. Each diff was printed before the push and is in its PR body. Lint was clean on each planted file, so a plant can fail only in a test. CI runs on the merge with `master` 774eff8. Both PRs were opened as drafts and closed unmerged after their runs had been read.

| Plant | Diff | PR, run | Result | Caught by |
|---|---|---|---|---|
| **P1** the newest-read guard never fires | `use-master-list.ts:88` `if (mine !== newest.current) return;` → `if (mine > newest.current) return;` | #278, 43137195323 (merge ref cccbf95) | **red, 3** (one per shard; Stages 1 to 11b green) | `treatments-focus.spec.ts:213` "the latest read wins (AC-1, AC-8) › a first read that answers after the list was read again does not bring the older list back" at mobile, tablet and desktop. It fails at `:249` `await expect(rowOf(page, name)).toBeVisible();` with "element(s) not found". The same as round 1's #273 |
| **P3** `refresh` does not set `loading` | `use-master-list.ts:94` drop `setStatus('loading');` | #279, 43137205416 (merge ref 0d0b507) | **red, 9** (4 + 3 + 2 by shard; Stages 1 to 11b green) | `process-master.spec.ts:337` (`:355` 'Loading the rates' not attached), `materials.spec.ts:335` (`:353` 'Loading the materials') and `aqp-122-qa.spec.ts:277` (`:299` `WORDS.loading`), each at three widths. The same as round 1's #275 |

The new mechanism has no plant of its own. A plant that put `[readList]` back would stay green, because every caller passes an import, so it would show nothing. The guarantee is structural (deps `[]`) and is argued above. P1 and P3 show that the ref did not disconnect the read path: through `readListRef.current()`, both the guard and the `loading` step are still pinned.

## Findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-08 | Info | `src/components/features/masters/use-master-list.ts:80-82` | maintainability; DL-153 (2) | `readListRef` is set in a passive effect, as `use-first-open.ts` does for `load`. A call made during the commit that changed `readList`, before that effect runs, uses the previous function. Such a call comes from a child component's passive effect (children's effects run first) or from any layout effect | None today: all three callers pass imports, and the screen's own `read` effect runs after the hook's. It would matter only if a future caller both passed an inline `readList` closing over changing props and started a read from a child's mount effect or a layout effect | No action in this PR (it keeps the house pattern). If that case ever arises, change this effect to `useLayoutEffect` |

## Reviewer-specific tables (round 2)
**Condition A against DL-162 (3)**

| DL-162 (3) item | In 65af06b | Result |
|---|---|---|
| STD-01: comment and body row state the rule as in (2) | :24-27 "any read that is not the newest one when it answers is dropped, whichever … answers first … status therefore stays `loading` … older rows are not applied … status is `error`"; the body row "Treatments' latest-read-wins" says the same | Met (reviewer-standards owns the wording; master checks at G7, DL-047) |
| STD-02: doc comment on `useMasterList` | :61-65 | Met |
| QLT-02: identity whatever is passed, latest one called | `readListRef`, deps `[]`; option doc and decision 2 reworded | Met (above) |
| `use-master-list.ts` and the body only; no test change | 1 file; `tests/` diff empty | Met |
| Counts +0 against the merge-ref `master` push run | 43136387943 against 43135619452 (774eff8) | Met |
| Dev Record round-2 row; "Refs #245" stays | PR body round-2 table; "Refs #245" opens the body's first paragraph; no closing keyword found | Met |

## Issues for other roles (round 2)
- **master:** condition R is met. DL-162 (8)(b) is satisfied: round 2 has no Blocker, Critical or Major, and P1 and P3 are red. reviewer-standards is not needed: the push stays within comments, the latest-function mechanism and `read`'s deps (DL-162 (4)).
- **orchestrator:** commit this file. Under DL-162 H, the delivery lead deletes the two new control branches, `control/245-qlt-r2-p1-no-latest-read-wins` and `control/245-qlt-r2-p3-refresh-no-loading`, together with the round-1 `control/245-qlt-*` branches. Local branches of the same names also exist in the shared repository; worktree `agent-a38dd44fc18d3f035` is back on `tech-debt/245-rebased` at 65af06b.
