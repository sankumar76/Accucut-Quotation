# Review Report — PR #845 (AQP-506 / DEF-149: the leave guard loses count after a same-page row link) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review of CLAUDE.md §9 item 2: the leave guard protects typed work, so a change to it can lose data; DL-476 (3), (6), DL-477 (5)) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-506-leave-guard-history` (PR [#845](https://github.com/sankumar76/Accucut-Quotation/pull/845)), master `43b02a11` |
| Commits reviewed | `b804c6f2` (first head), then **`64ca41ba`** (`4ee29e58` tests, `64ca41ba` the count from `history.length`). **Superseded while this round was open** by `4d016e1b` (lane 2's hand-over in DL-476 note 8's shape), which is the next round's delta |
| Date | 2026-11-28 |
| Reviewed against | DL-476 (2), (3), (5), (6), note 7, note 8; DL-477 (5); DL-479 (5); DL-404; STORY-05.08 AC-4; the review SQR-03 rule (no dead Back press); QA's master reproduction (test plan 0.3.164); coding standards §1, §3, §6 |
| **Verdict (at `64ca41ba`)** | **REQUEST CHANGES.** **0 Blocker, 0 Critical, 2 Major (QLT-845-01, QLT-845-02), 2 Minor (QLT-845-03, QLT-845-07), 3 Info (QLT-845-04, -05, -06).** No Blocker or Critical, so the §9 (2) stop does not apply. **Both Majors were taken by master into DL-476 note 8**, with a gap master added (same-page fragment links). `4d016e1b` is already in that shape for QLT-845-01 and -02, and lane 1 does the fragment links next. **Both open CI questions are answered only in part,** because runs 46109892797 and 46110627795 were cancelled by the next push (see CI) |

## Summary

**The cause is fixed in the click path.** With the guard armed, a click on a same-page row link no longer sets `armedFor` to null, so the next typing does not push a second extra entry. That is the change that makes QA's master cases A, B and C reach the queue. `SaveGate.discardUnsaved()` gives the typing up on "Leave without saving", so what follows is not held back by it. It touches neither saves in flight nor any flush: every Autosave tick, tab hide and `pagehide` checks `gate.isDirty()` first, so text the person discarded cannot be saved afterwards. "Save draft and leave" calls `leave()` only after a successful save, and a failed save keeps the dialog. "Keep editing" keeps the guard armed. The SQR-03 cases and the Engineer page's leave specs are unchanged. There is no wait, budget or time-out change, no route, and no secret or personal data.

**At `64ca41ba` the length arithmetic does not do what the PR body says (QLT-845-01, Major).** On every Back, `onPopState` sets `armedFor` to null and calls `arm()`, which pushes again (truncating the forward entries) and **rewrites `ownLength`** from the new length. So `stepsOut()` is −2 in every reachable Back path, which is the old assumed count. The −3 unit case adds an entry *after* Back, while the dialog is up, and its fake history never truncates. In a browser, no such sequence exists.

**The row-link path before typing was still open (QLT-845-02, Major).** The Lead's row `<Link>` pushes an entry when the guard is not armed, so a row opened before typing leaves an earlier entry of the same estimate page *below* the page's own entry. Back, then either choice, lands on that earlier row instead of the queue. I found this by reading the code; it has no case. No count relative to the page's own entry can see it.

**Master ruled both in DL-476 note 8:** `replace` on the Lead's row links, the row-link-before-typing E2E, and `go(-2)` kept as an invariant that must hold for every writer. **Master added the gap I had missed:** same-page fragment links (`#main`, `#review-calculate`, and the Engineer's section strip, tree form link and calculate summary). The browser pushes those itself, and the guard does not take them (`leave-guard.ts:104`), so they put entries above the page's own entry. The fix routes are R1 or R2, with cases (vii) to (x).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (QLT-845-01, QLT-845-02; both taken into DL-476 note 8) |
| Minor | 2 (QLT-845-03, QLT-845-07) |
| Info | 3 (QLT-845-04, -05, -06) |

## Checks Run

| Check | Source | Result |
|-------|--------|--------|
| Diff and files at `b804c6f2` and `64ca41ba` | `git diff origin/master...`; `leave-guard.ts`, `leave-guard.tsx`, `save-gate.ts`, `use-autosave.ts`, `use-part-form.ts` (`sendAgain`, `autosaveField`) read at the head | done |
| Other history writers on the estimate page | `git grep` for `<iframe`, `router.push(`, `history.pushState(` in `src` | none besides the guard's own (`navigate` and `arm`). The Lead's row `<Link>` (`review-tree.tsx:73`, `scroll={false}`, no `replace`) pushes when the guard is not armed. **Not checked by me:** fragment links (`#…`), which master found (note 8) |
| DL-404 | the spec and the diff | no `timeout`, `waitForTimeout`, `slow()` or configuration change |
| CI at `b804c6f2` (run 46109892797) | job logs (gh run view --log) | Stages 1 to 11b **passed**. E2E **cancelled** by the next push. Before the cancel: `leave-guard-history.spec.ts:83`, `:91`, `:100` [tablet] passed attempt 1; `approve-override.spec.ts:230`, `:314` passed attempt 1 [mobile] and [tablet]; shard 4 [desktop] had four attempt-1 failures in `estimate-form-sections` and `estimate-form-choice` that passed on retry (the DEF-085 cold-start family, not this diff by my reading) |
| CI at `64ca41ba` (run 46110627795) | job logs | **cancelled in every job** by the push of `4d016e1b`. Before the cancel: `leave-guard-history.spec.ts:84`, `:93` (the overshoot case), `:104`, `:116`, `:133` [tablet] passed attempt 1; **`:124` [tablet] ("Save draft and leave") failed attempt 1 and passed on retry**; `approve-override.spec.ts:230` passed [mobile] and [tablet]; `:314` passed [mobile] and **failed attempt 1 [tablet]**. No error text (the run stopped before Playwright's report). No [desktop] result for any of these cases |
| Local runs | none | the PC is kept quiet for lane 2's TBT attempt; no servers started |

## The two open questions (asked by the orchestrator)

| Question | Answer at `64ca41ba` | Evidence |
|----------|----------------------|----------|
| Does the typed text survive Back, now that Back lands on the page's own entry (an older `?row=`) on master's Lead page without the island? | **Yes, at tablet width; not shown at 360 or 1366 px** | `backTwiceAsks` asserts the second row's typed value behind the dialog after each Back. It passed in `:83`, `:91`, `:100` (run 46109892797) and `:116`, `:133` (46110627795), and `:124` on its retry. The concern I raised (the page re-rendering the older row under the dialog) is **not seen**. The run of record must show it at all three widths |
| Do `approve-override.spec.ts:230`, `:312`, `:314` [desktop] pass attempt 1 (DL-479 (5))? | **Not answered:** no [desktop] result exists for this PR yet | at `64ca41ba`, `:314` failed attempt 1 on **[tablet]**, with no error text. Whether that is the DEF-140 / DEF-144 stall signature (DL-479 (8)) is for the orchestrator and master on the run of record. `:312` did not appear in the partial logs |

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------|-------|--------|---------------|--------------------------|
| QLT-845-01 | Major | `src/lib/estimates/leave-guard.ts` `arm()` (sets `ownLength`), `onPopState` (calls `arm()` after `armedFor = null`), `stepsOut()`; `tests/unit/leave-guard.test.ts` "DEF-149 (DL-476 (5))" group | DL-476 (5) ("no `history.go(-n)` with an assumed count") | The re-arm on every Back pushes (truncating the forward entries) and rewrites `ownLength`, so `stepsOut()` = `(p+1) − 1 − (p+2)` = −2 always. The case it exists for (entries pushed above the page's own entry before Back) also gives −2, because the re-arm overwrites the count. The −3 unit case adds an entry after Back, while the modal dialog is up, and its fake history adds one on each push and never truncates | The PR's claim that the count is worked out is not true in a browser. DL-476 (5)'s term is not met in substance | **Taken by DL-476 note 8:** remove the length code and keep `go(-2)` as a stated invariant that holds for every writer. `4d016e1b` does this. If a count is wanted later, record it once per page (not in the re-arm), and model a history that truncates on push and keeps a position | a unit fake with a position and a truncating push; an entry pushed above the page's entry before Back |
| QLT-845-02 | Major | `src/components/features/estimate-review/review-tree.tsx:73` (`<Link>` with no `replace`); `leave-guard.ts:138` (an unarmed, clean click is not taken) | STORY-05.08 AC-4; DL-476 (5) ("whatever … the page made while it was open") | Before anything is typed, a row link is a plain router push, so the history holds an earlier entry of the same estimate page *below* the page's own entry. Typing then arms; Back, then either choice, `go(-2)`s onto the earlier row. By reading; no case | DEF-149's symptom A by another order of steps: neither choice leaves the estimate page | **Taken by DL-476 note 8:** `replace` on the Lead's row links (one entry for the page, as #811's island already behaves), and the row-link-before-typing E2E with an exact landing. In `4d016e1b` | the row-link-before-typing E2E at three widths: press a row link, type, Back, each choice, land on `/queue` exactly |
| QLT-845-03 | Minor | `leave-guard.ts` (`installLeaveGuard` starts with `armedFor = null`) | STORY-05.08 AC-4 | A reload while armed (the gate clean, so the browser does not ask) leaves the guard's extra entry as a stale duplicate. The new install does not know about it, so a later Back, then Leave, lands on that duplicate (the same page). **Already on master** (the old `go(-2)` did the same) | Narrow: a reload after typing and saving. Fail-safe: nothing lost | Follow-up: on install, recognise that the current entry is the guard's (a field in the state the guard pushes, which survives a reload), and count it once. If the router replaces it, that field is lost, which is the router-replace caveat of DL-476 (6) | a guard unit case: install on a page whose `history.state` carries the guard's field |
| QLT-845-04 | Info | `leave-guard.ts` `proceed` | STORY-05.08 AC-4 | In a new tab, the estimate page's own entry is the first one, so `go(-2)` is out of range and does nothing: "Leave without saving" closes the dialog and leaves the person on the page with the typing discarded. **Already on master** | Nothing is lost that was not given up | Optional, for the ux-expert: when there is no entry before the page's own, go to the portal's start page instead | — |
| QLT-845-05 | Info | `leave-guard.ts` `stepsOut()` at `64ca41ba` | — | The 50-entry cap: `go()` is relative, so the cap does not matter to `go(-2)`. It would matter only to an absolute count (QLT-845-01's alternative): a push at the cap drops the oldest entry and the count under-steps by one, which fails safe (the person stays). Forward entries that exist when the page loads are cut by the guard's first push, so they never count. Another writer of `history.length` (an iframe or another `pushState`): none on the estimate page except the fragment links master found | — | None; another reason for note 8's invariant over a count | — |
| QLT-845-06 | Info | `leave-guard.ts` `go()` (same-path links keep `armedFor`) | review SQR-03 | A behaviour change on master's Lead page: after a guard-taken row link (armed, clean), Back passes through the page's own entry and leaves the page. Before, it showed the previous row. The page's own row may show for a moment before `history.back()` | Consistent with #811's island and with note 8's `replace` (one entry per page) | For the ux-expert: confirm "Back leaves the review" is the intended model (it matches the ux ruling's `?row=` by `replaceState`) | — |
| QLT-845-07 | Minor | `tests/e2e/leave-guard-history.spec.ts:124` [tablet] at `64ca41ba` | DL-436, DL-404 | "Save draft and leave saves what was typed and leaves the page" failed attempt 1 (28.5 s) and passed on retry. The run was cancelled before the error was printed. It may wait on `savedAnswer` or the landing, and it could be the case's own race with the route being let through | A first-attempt failure on the run of record would hold the merge | On the next head: if it fails attempt 1 again, read its error. If the save is what it waits on, start `waitForResponse` before letting the route through, or assert the server's stored value instead | the case itself, attempt 1 at three widths |

## Terms for the next round (lane 1's head)

| DL-476 note 8 term | What I will check |
|---|---|
| (a) `replace` on the Lead's row links | `review-tree-row.tsx` / `review-tree.tsx` `<Link replace>`; Approved and Quoted (no guard) keep a working row link; #811's island rows unchanged |
| (b) `go(-2)` as an invariant for every writer | the length code is gone; the guard's comment states the invariant; every same-page writer is either taken by the guard or makes no history entry: row links, the guard's own `router.replace`, #811's `replaceState`, **fragment links (R1 or R2)** |
| (c) the row-link-before-typing E2E | exact landing `/\/queue$/` at three widths, red before and green after |
| (vii) to (x) | the rates-changed Enter, the skip link and the Engineer's section strip, with exact landings. Focus, scroll and the hash are kept under R1 |
| Data | typed text behind the dialog after each Back, at all three widths; nothing discarded is saved; "Save draft and leave" stores the value |
| CI | a fully green run of record at 0 behind, with `approve-override.spec.ts:230`, `:312`, `:314` [desktop] passing attempt 1 (DL-479 (5)) and `leave-guard-history` passing attempt 1 |

## NFR impact

| NFR / AC | Risk | Findings |
|----------|------|----------|
| STORY-05.08 AC-4 (unsaved work, the Back button) | **Medium until note 8 lands; then low** | QLT-845-01, -02, -03 |
| NFR-001, NFR-002 | **None**: no route, no role check, no figure | — |
| NFR-009 | **None**: a few lines in a module the page already loads | — |

## Issues for other roles
- **developer (lane 1):** note 8's shape (already in `4d016e1b` for QLT-845-01 and -02) and the fragment links. QLT-845-07 if it fails again. QLT-845-03 as a `follow-up` issue.
- **ux-expert:** QLT-845-04 and QLT-845-06 (Back leaves the review; Leave in a new tab).
- **orchestrator:** the run of record's [desktop] `:230`, `:312`, `:314` attempt 1 and the [tablet] `:314` attempt-1 failure at `64ca41ba`, for DL-479 (5) and (8).

## Hand-off
- Status: COMPLETE (round 1 at `64ca41ba`; the next round is lane 1's head as a delta)
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-845-combined.md`
- Jira / GitHub updates: PR #845 COMMENT review; Jira AQP-506 comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer (lane 1) for note 8's fragment links; then reviewer-quality for the delta
