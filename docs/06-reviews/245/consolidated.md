# Consolidated review: tech-debt #245 (`useMasterList` and the remaining master pieces), PR #265 (head dcdad49)

Orchestrator, 2026-11-11. Two reviews (DL-150, DL-153 route: standards and quality). CI 43058209908 on dcdad49: 5 of 5, counts equal to `master`, path 4:45. 16 files, all under `src/`; no test, dependency, Prisma or CI change. Base 2891457; `master` has moved by docs files only, so an update touches none of the 16 files.

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Review |
|---|---|---|---|---|---|---|---|
| standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 2 | 4 | 5867110166, `standards.md`, #245 comment 6810555942 |
| quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 2 | 5 | 5867213193, `quality.md`, #245 comment 6810768969 |

## Findings, by severity

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| STD-01 | Minor | `use-master-list.ts:24-25` and the PR body understate the latest-read-wins change: any read that is not the newest when it answers is dropped, so the status stays `loading` until the newest answers, and if the older read succeeds and the newest fails the older rows are never applied. Wording only | standards |
| STD-02 | Minor | `useMasterList` (exported, `use-master-list.ts:59`) has no doc comment of its own | standards |
| QLT-01 | Minor | Nothing tests the shared dialog-opening pieces (item 2): plants P2 (second press while dialogs load not ignored) and P4 (Process failed-dialog titles swapped) stayed green. Proposed: tests in a follow-up (#244 or a new tech-debt issue) | quality |
| QLT-02 | Minor | `useMasterList` relies on `readList` being stable across renders, stated only in a comment; an inline function on the lazy path would re-read in a loop. No current screen affected; AQP-142 is the next caller. Fix: a ref, in this PR or as a line in AQP-142's Dev Context | quality |
| STD-03 to STD-06 | Info | Branch and title pattern for tech-debt not in the standards (carry-over); item 5 (Users) honestly deferred, #245 stays open; dcdad49 comment repairs moot after the squash; no test of `refresh` or the `press` guard | standards |
| QLT-03 to QLT-07 | Info | The four screens behave as before; the hook's API fits SCR-12 as DL-153 reads it; item 5 held for a real reason | quality |

## The behaviour change

Latest-read-wins now applies on Process, Materials and Treatment / Color, as on Exchange rates. reviewer-quality recommends ruling it **in**: it is a fix (an older re-read could restore a list missing the just-saved row, or show a false load error), the final list is the same, and the visible difference is a longer `loading` state while reads overlap. It is tested once through the Treatments test (plant P1 red, `treatments-focus.spec.ts:213` at three widths); Process and Materials use the same line. P3 (`refresh` without `loading`) is red 9.

## Plant evidence

Control PRs from dcdad49, all closed unmerged: #273 P1 red 3 (run 43126775325); #274 P2 green (43126788511); #275 P3 red 9 (43126800700); #276 P4 green (43126812281). Branches `control/245-qlt-*` (4) remain (delete refused for agents). Developer's controls #268 (A1), #269 (A2).

## Questions for master

- Rule latest-read-wins in or out.
- G6 decision; STD-01 and STD-02 (wording, doc comment) and QLT-02 (ref) in this PR before the squash, or routed?
- QLT-01: follow-up issue or into #244; and #244 ordering (quality: branch #244 after #265 merges; still due before AQP-142's G6).
- G7 route (master with no QA run, as for #119 and #218?), and the squash message must say "Refs #245", not "Closes".
