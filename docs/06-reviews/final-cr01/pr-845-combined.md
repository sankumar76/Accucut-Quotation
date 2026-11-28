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
| **PF-23** (ux ruling `partform-placeholder-shape-2026-11-28.md` section 11, records-u `fc198353`; accepts QLT-845-06) | (a) a row stays a real link with its `href`; **only a plain primary click is replaced** (modified and middle clicks are the browser's own); (b) the address is updated (reload and shared link open the row); (c) the form's title takes focus and "Showing the inputs of ..." is said once (RO-2); (d) Approved, Quoted and Ignored review pages are unchanged, and that difference is named as a post-G8 item. **Cases:** PF-23a, three rows chosen by their links, then a clean Back shows the page before the review, not the previous row; PF-23b, a Ctrl-click opens a new tab and leaves this page's address unchanged. Each at 360, 768 and 1366 px |
| **PF-24** (R1: same-page fragment links add no history entry while the guard is installed) | (a) still a jump: scroll to the target, and focus or the sequential-focus start point moves exactly as native fragment navigation does (targets with `tabindex="-1"` take focus; after the skip link, the next Tab is the first focusable thing in `main`); (b) the hash changes in the address; (c) modified clicks stay native; (d) `scroll-padding` and `scroll-margin` keep the target clear of the sticky bars (WCAG 2.4.11); (e) **DL-465's Enter-before-swap case stays green and unchanged**; (f) no `:target` style is lost. **Cases:** PF-24a, the skip link with Enter then Tab: focus in `main`, the address ends `#main`, `history.length` unchanged; PF-24b, the same for an Engineer section-strip link (the heading holds focus) and `#review-calculate`; PF-24c, after any of these, Back asks only if something is unsaved, and a clean Back leaves. Each at 360, 768 and 1366 px. **For the code read:** R1 must not install on pages without the guard, must not break the browser's `hashchange` for any listener that relies on it, and must leave the Engineer's leave cases (`estimate-save.spec.ts`) unchanged |

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

---

## Round 2 (delta `64ca41ba..38859d2b`, 2026-11-28)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review, §9 (2)) |
| Commits reviewed | `4d016e1b`, `5c8a3af0`, `0a608796`, `70f72820`, `8b762cbf`, `c6127270`, **`38859d2b`** (head). The `master` merge `e2bf0dab` brings #843 (`part-picture.tsx`, `estimate-picture.spec.ts`), which was reviewed on `master` and is not reviewed again here |
| PR review | [#845 review 6096438356](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6096438356) (COMMENT, single-token); replies in the QLT-845-01 and -07 threads; label `review:quality-changes-requested` kept |
| **Verdict** | **REQUEST CHANGES. New: 1 Blocker (QLT-845-08), 0 Critical, 2 Major (QLT-845-09, -10), 1 Minor (QLT-845-11), 0 Info.** §9 (2): the Blocker is fixed before merge |

### Round 1 findings and DL-476 note 8
| ID / case | Status | Evidence |
|---|---|---|
| QLT-845-01 | **Fixed** | the length code is removed; `go(-2)` is kept with the invariant stated (`leave-guard.ts:237-240`); `tests/unit/leave-guard-writers.test.ts`. The invariant counts entries but does not keep the page's own entry at the address shown (QLT-845-08) |
| QLT-845-02 | **Fixed** | `replace={guarded}` (`review-tree.tsx:77`), `guarded={editable}`; `tests/unit/review-tree-replace.test.ts`; E2E `:118` and `:128` pass on attempt 1 at three widths, exact `/queue$` |
| QLT-845-03 | **Not fixed** (no follow-up issue open) | Minor, not a merge condition |
| QLT-845-07 | **Fixed** (the listener starts before `allowSaves`, `:189-190`) | the case (now `:184`) is red for QLT-845-08's reason |
| QLT-845-04, -05, -06 | -06 accepted (ux PF-23); -04 and -05 unchanged | — |
| (vii) | **Not proven**: QLT-845-10 | red at three widths, both choices |
| (viii) | **Fixed** | `:254`, both choices, three widths, attempt 1 |
| (ix) | **Fixed**, with a weak assertion (QLT-845-11) | `:298`, both choices, three widths |
| (x) | **Holds** | `rates-changed.spec.ts:263`, `:295`, `:325`, `:353` and `partform-placeholder.spec.ts` (5 cases) are unchanged and pass on attempt 1 at three widths |
| (xi), PF-23a/b, PF-24a/c, hash after refresh | **Green** | `:267`, `:313`, `:326`, `:340`, `:381`, three widths, attempt 1 |

### Check (b): Back and Forward after `replaceState(null, '', …)`
- **Code reading: met.** In Next 16.4.5 (`aqp-398/node_modules/next/dist/client/components/app-router.js`), a `null` state has no `__NA`, so the patched `replaceState` (`:302-312`) runs `copyNextJsInternalHistoryState` (`:128-140`). That copies `__NA` and `__PRIVATE_NEXTJS_INTERNALS_TREE` from the current entry (the one being rewritten) and records the address with `navigator.restore` (`:277-281`). On `popstate`, `handlePopState` (`:61-72`) sees `__NA` and calls `traverse` (soft), not `location.reload()`. The guard is installed only by the lazily loaded form, after `AppRouter`'s effect has patched `history`. This confirms the earlier reviewer's reading of `:61-71` and `:128-139`.
- **Test: not met (QLT-845-09).** `:360` is wrong by construction: `/queue` and the estimate are two `page.goto` documents. Back is shown only indirectly, by (xi) `:267`: the app's own dialog shows the typed text after Back. Nothing proves Forward.

### New findings
| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-------|--------|---------------|--------------------------|
| QLT-845-08 | **Blocker** | `src/lib/estimates/leave-guard.ts:183` (since `b804c6f2`); with `part-form.tsx:118`, `save-gate.ts:17`, Next `app-router.js:61-72` | While the guard is armed, a same-path row link keeps `armedFor` and replaces only the guard's entry, so the page's own entry keeps the old `?row=`. Back after typing lands there. The guard asks, but Next traverses to the old row at the same time, the new row's `Fields` unmount, and the gate drops their unsaved marks | **Typed text is lost with no choice made.** "Keep editing" shows the old row, "Save draft and leave" saves nothing, and a later Back leaves without asking. The Lead's and the Admin's editable review, at all three widths. **This branch only:** `master` clears `armedFor` on every guard-taken link (`leave-guard.ts:145` on `master`). My round 1 answer ("typed text survives Back: yes") was wrong; the earlier greens most likely raced the traversal (inference, not run) | Make the page's own entry carry the new row: on an armed same-path link, step off the guard's entry first (`history.back()`, marked as the guard's own traversal), then `navigate(href, true)`, and re-arm on the next keystroke; or DL-476's R2 for this path (master rules which) | lane 1's red `tests/unit/leave-guard-visible-row.test.ts`; `backTwiceAsks` `:90` on attempt 1 at three widths with no wait added; a "Save draft and leave" case that asserts the server's stored value for the new row |
| QLT-845-09 | Major | `tests/e2e/leave-guard-history.spec.ts:360-377` | The marker cannot survive Back across two `page.goto` documents. The case is red at three widths and says nothing about the product; Forward is not proven | DL-481 (2)'s required case is missing; the data-loss path rests on a code reading alone | Keep both entries in one document: from `/queue`, **click** the task link (`queue-list.tsx:78`, a Next `Link`), jump, Back (marker, `/queue$`), Forward (marker, `#main$`, form visible); and jump, type (saves failing), Back (dialog, `TYPED`, marker) | the case itself, three widths |
| QLT-845-10 | Major | `tests/e2e/leave-guard-history.spec.ts:285-287` | `armed()` saves on a Prepared estimate and waits for `TREE_CLEARED_LINE` (`out-of-date` only, `review-tree.tsx:139`), but the notice renders only when `current` (`rates-changed-notice.tsx:25`). The green at `c6127270` was a race | Case (vii) is not proven | Arm without a successful save (`failSaves` before the first keystroke), so the figures stay current | the case itself, three widths, both choices |
| QLT-845-11 | Minor | `tests/e2e/leave-guard-history.spec.ts:303-306` | (ix) asserts that the strip link is visible, not the heading's focus or an unchanged address | A regression in PF-24b's focus would pass | `toBeFocused()` on the target, and `page.url()` unchanged | — |

### CI: run 46117009843 on `38859d2b` (finished, failure)
- Stages 1 to 11b and shard 2 passed. Shards 1, 3 and 4 failed; "Stages 1 to 11" failed at its gate only.
- `leave-guard-history`: `:164` [mobile], `:176` [mobile, tablet], `:184` [all], `:196` [mobile, desktop; flaky tablet], each at `:90`, are **product (QLT-845-08)**. `:281` [all, both choices] at `:287` is **test (QLT-845-10)**. `:360` [all] at `:372` is **test (QLT-845-09)**. Every other case in the file passed on attempt 1 at three widths.
- **DL-479 (5):** `approve-override.spec.ts:230`, `:314` and `approve.spec.ts:312` passed on attempt 1 at [desktop] (and at mobile and tablet).
- `estimate-form-sections.spec.ts:137`, `:149`, `:172`, `:209` [desktop] were flaky. The file is untouched by this PR (the DEF-085 family, by my reading).
- **DL-404:** `38859d2b` swaps a response wait for a wait on the commit's visible effect, with the default expect time-out, and makes no budget, time-out or retry change. It exposes -08 and does not mask it.
- **Security:** no secret or real data; no route, role check or figure (NFR-002 and auth are not touched).

### Issues for other roles
- **developer (lane 1):** QLT-845-08 (Blocker), -09 and -10 (Major), and -11 (Minor) in the same push; open the `follow-up` issue for QLT-845-03.
- **master:** DL-481 (1) attributes `:172`'s signature to DEF-150 ("not DEF-149's mechanism, does not depend on #845"). QLT-845-08 explains it as #845's own. The DEF-150 waits in #845 may not be needed; DEF-150 on `master` is still to be reproduced by QA. Also: the route for -08's fix (the guard stepping off its entry, or R2).

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: this section (not committed)
- Jira / GitHub updates: PR #845 review 6096438356 and 2 thread replies; Jira AQP-506 comment
- Open questions: none
- Risks raised: QLT-845-08 (typed-text loss on this branch)
- Recommended next agent: developer (lane 1) for QLT-845-08 to -11; master for the -08 route and DL-481 (1); then reviewer-quality round 3 on the delta

## Round 3 (delta `38859d2b..8b07927d`, 2026-11-28)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review, §9 (2)) |
| Commits reviewed | **`8b07927d`** (head, one commit). 0 behind `master` (`51502650`, GitHub compare: behind 0, ahead 12) |
| Ruling read | DL-482 in full (records-u `docs/00-governance/decision-log.md`), with DL-481 as amended by DL-482 (6) |
| PR review | [#845 review 6096696582](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6096696582) (COMMENT, single-token); replies in the QLT-845-08 to -11 threads; label `review:quality-changes-requested` kept |
| **Verdict** | **REQUEST CHANGES. New: 0 Blocker, 1 Critical (QLT-845-18), 3 Major (QLT-845-12, -13, -14), 3 Minor (QLT-845-15, -16, -17), 0 Info.** 8b07927d does not deliver DL-482 option A in any Chromium browser (QLT-845-18) |

### Round 2 findings
| ID | Status | Evidence |
|---|---|---|
| QLT-845-08 (Blocker) | **Fixed for the text loss, by the fallback and not by A** (the Leave landing is QLT-845-18) | Code: Next 16.4.5 has one `popstate` listener, on `window`, non-capture (`app-router.js:314-315`), whose `handlePopState` → `traverse` (`:61-72`) is what drew the old row. The guard's listener is on `window` with `capture: true` (`leave-guard.ts:350-351`) and calls `stopImmediatePropagation` on the landing on P (`:320`) and on its own `go(1)` landing on G (`:313-315`), so `handlePopState` never runs, nothing is drawn, the form does not unmount and the gate keeps its marks. Next's own state stays G's, which is the address the window ends on. No other Next listener sees a traversal (`hasMissedTraversal` acts only before hydration). Unit: `leave-guard-visible-row.test.ts` (committed; red first as recorded in the PR body), 9 cases green locally (see Checks). E2E: in run 46122561641, after Back the dialog and `TYPED` behind it, and after Keep editing `?row=1`, the title and the length unchanged, are green on attempt 1 at three widths; the five cases are red at the Leave landing (`?row=1.1`). **But A never runs in Chromium:** `window` runs listeners in registration order, so the probe answers false and the guard takes the fallback (QLT-845-18) |
| QLT-845-09 (Major) | **Fixed** | `openedFromTheQueue` (`spec:446-456`): one `goto` of `/queue?q=`, then the task link is clicked (router push); a marker; Back, `QUEUE_OF_TASK`; Forward, `#main$`; `performance.getEntriesByType('navigation').length === 1`; a second case types, Backs and asserts the dialog, the text and the marker. `:465`, `:479` green on attempt 1 at three widths. |
| QLT-845-10 (Major) | **Fixed** | (vii) uses `armedUnsaved` (`spec:295-306`): saves fail from the first keystroke, so the figures stay current and the notice is drawn. `:353` green on attempt 1 at three widths, both choices. |
| QLT-845-11 (Minor) | **Fixed** | (ix) reads the strip link's `href`, asserts the named heading `toBeFocused()` and `page.url()` unchanged (`spec:379-385`). `:371` green on attempt 1 at three widths, both choices. |

### The judgements asked for
1. **QLT-845-08 fixed?** See the table. By code reading: yes, in an engine that runs capture listeners first. In CI: **the text loss is gone and the landing is red, on the fallback path** (QLT-845-18).
2. **The fail-safe.** `captureRunsFirst()` (`:84-95`) dispatches on a detached `EventTarget`, which is the target itself, so it measures the at-target order (capture listeners first in the current DOM specification), which is exactly the order that applies on `window`, where `popstate` is dispatched with `window` as its target and nothing above it. It is side-effect free (no page listener sees it), it passes the same boolean as the real registration, and a throw or a missing constructor answers false. The fallback is `master`'s path for a same-path link: `armedFor = null` at every guard-taken link (`:230`, as `master`'s `:145`), and `onPopStateText` is `master`'s handler; unit cases force the probe both ways and a failing probe keeps the text (`visible-row` `:160-224`). **Measured (my scratch Playwright script, Chromium 158.0.8127.18, no app):** a detached `EventTarget` and `window` (a synthetic `popstate`, and a real `pushState` + `back()`) run the bubble listener first; a detached element runs capture first. So the probe matches `window`, and DL-482 (3)'s wording ("a detached element") would have picked A in Chromium and lost the text again. **Lane 3's check (relayed, not run by me):** Firefox 159.0 and WebKit 27.2 run capture first on `window`; Chromium, new headless Chromium, Edge 158.0.4370.45 and Chrome 158.0.8127.88 run bubble first. Firefox and WebKit (DL-482 (4)) are after this review; the code makes them possible. **But CI does not show which path ran in Chromium: QLT-845-12 (Major).** Lane 1 confirms it.
3. **The relaxed assertion.** Applied to all 312 runs; only 2 need it (my scratch count). The second ask is not a second dialog and both requests' Leave land on BEFORE (scratch, 312 of 312). The family needs the island's bare `replaceState`, which is not on this branch or `master`. **QLT-845-13 (Major, test).** The product behaviour is Minor and is #811's to remove when its island lands.
4. **The "unknown address" fallback (lane 1's own, not ruled).** It makes the bounce counter-only after any armed strip click, against DL-482 (2)(i) and (ii), and it is not in the PR body. **QLT-845-14 (Major).** A tighter match is possible without it.
5. **`BOUNCE_GRACE_MS = 1_000`.** A product timer, not a test budget: **no DL-404 breach.** In known-address mode, a real Back landing elsewhere is never swallowed; the timer decides only in the same-address and (with -14) counter-only cases. Its size has no reason given: **QLT-845-15 (Minor).**
6. Round 2 findings: the table above.
7. DL-482 checklist: below.
8. Correctness, error paths, security: QLT-845-16 (Minor, a narrow router-commit race onto P); QLT-845-17 (Minor, the read-back does not name the typed text). A double Back faster than the bounce relies on the traversal queue being FIFO (HTML spec), which is Info. Security: no secret, no real data (invented codes and texts), no route, role check, figure or auth change; NFR-002 untouched. The server read-back in `expectStoredOnTheWayOut` uses the signed-in page's own request context.

### DL-482 checklist (run of record)
| Item | Result | Evidence |
|---|---|---|
| (2)(i) capture on `window`, stop only the owned traversal | **Partly**: met in known-address mode; not when `guardAddress` is null (QLT-845-14) | `leave-guard.ts:350-351`, `:313` |
| (2)(ii) own step matched on the landing address | **Partly** (same) | `:313`; `visible-row:131` covers the known-address mode only |
| (2)(iii) clean case lands on the exact page before | Met (unit) | `visible-row` "with nothing unsaved by then" |
| (2)(iv) writers model capture-first; changed cases listed in the PR body | Met (the writers model has only the guard's listener, so the order is vacuous there; `visible-row` models the router) | PR body lines 61-62 |
| (3) probe and fail-safe, unit case for the forced failure | Met in code and unit; **not shown in CI which path ran** (QLT-845-12) | `:84-95`, `visible-row:160-224` |
| (7) waits are set-up only, comments name DL-482 (7) and DEF-150 unconfirmed; no new wait for -08; no budget, time-out or retry change | Met | `spec:32-36`, `:84`, `:287`; no config change in the diff |
| (7)(iii) / (8) one no-wait case, three widths | Green on attempt 1 at three widths, but on the fallback path | `spec:161-195` |
| (8)(a) after Back: dialog and the new row; after Keep editing: `?row=`, the text, length unchanged; Save draft: server read-back and exact landing | Assertions present; the run is **red** at the Leave landing (QLT-845-18), and the read-back does not name the typed text (QLT-845-17) | `backTwiceAsks` `spec:98-114`; `expectStoredOnTheWayOut` `spec:43-52`; run 46122561641 |
| (8)(b) `leave-guard-visible-row.test.ts` committed, red first, green | Met | the file; PR body line 59; local run |
| (8)(c) -09, -10 fixed; Forward asserted once | Met | above |
| (8)(d) Firefox and WebKit results in the PR body | Out of scope here (after this review) | — |
| DL-479 (5): `leave-guard-history` attempt 1 at three widths; `approve-override.spec.ts:230`, `:314`, `approve.spec.ts:312` attempt 1 at [desktop] | **Not met**: `leave-guard-history` `:199`, `:208`, `:219`, `:231`, `:239` red on both attempts at three widths. The approve cases pass on attempt 1 at [desktop] (`approve-override.spec.ts:314` flaky at [tablet]) | run 46122561641 |
| (8)(e) 0 behind `master` | Met | compare API |

### New findings
| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-------|--------|---------------|--------------------------|
| QLT-845-18 | **Critical** | `src/lib/estimates/leave-guard.ts:350-351` | In Chromium (also Chrome and Edge 158), `window` runs `popstate` listeners in registration order, so the capture listener cannot run before Next's; the probe answers false and the guard takes the fallback | DEF-149's way-out fault is back in the PR's CI browser (Leave lands on the page's own entry, `?row=1.1`), red on both attempts at three widths; no text lost | Master re-rules the fix shape (DL-482 (5): C, or a shape that does not depend on running before Next's listener); correct DL-482 (3)'s "detached element" wording (an element probes capture-first in Chromium) | the five -08 cases, three widths, attempt 1 |
| QLT-845-12 | Major | `tests/e2e/leave-guard-history.spec.ts:109`, `:193`; `leave-guard.ts:186` | No assertion tells option A from the text-safe path in Chromium; the length after Keep editing is equal on both | The run of record cannot prove A (DL-482 (3), (8)); a silent fallback would bring back DEF-149's Sev-2 unseen | Lane 1's (a) (length equal from just before the row link, gate clean, to after typing in the second row; the text path is +1) and (b) (`page.evaluate` probe with `browser.version()`); (a) only where the gate is clean at the link; show the tell red once in the unit model with `captureFirst: false` | (a) and (b), three widths, attempt 1 |
| QLT-845-13 | Major (test) | `tests/unit/leave-guard-writers.test.ts:295-297` | "one or two" asks for all 312 runs; only 2 need it | A future double ask in 310 runs passes unseen (§5) | Exactly 1, except a named `ASKS_TWICE` list (exactly 2, and `asked[0].proceed()` lands on BEFORE) | the case, tightened |
| QLT-845-14 | Major | `src/lib/estimates/leave-guard.ts:218`, `:313` | Unruled fallback: `guardAddress = null` makes the bounce counter-only, after any armed click on a same-page link the guard does not take (the strip included) | A lost or overtaken step swallows a real Back silently; the Back after it leaves without a question (typed text lost). Against DL-482 (2)(i)-(ii) | Match on `here !== armedFor` and the same origin, path and query as the last known `guardAddress` (only the `#` can be unknown), or a master ruling | visible-row: armed strip click, step's event lost, real Back asks |
| QLT-845-15 | Minor | `src/lib/estimates/leave-guard.ts:77` | 1 s without a reason for its size | The timer alone decides the same-address (and counter-only) cases | Give the reason in the comment | — |
| QLT-845-16 | Minor | `src/lib/estimates/leave-guard.ts:332`, Next `app-router.js:103-110` | A router commit while the window is on P writes the canonical address onto P; P no longer equals `armedFor` | The next Back passes unasked, the one after it leaves without a question; needs a commit inside a frame or two | Follow-up issue (treat a same-path landing while armed as P, or refresh `armedFor` after the bounce) | visible-row: `replaceState` onto P between swallow and step, then two Backs |
| QLT-845-17 | Minor | `tests/e2e/leave-guard-history.spec.ts:43-52` | The read-back checks that the server holds what the save carried, not that the save carried the typed text of the row on screen | A save of another field or of the old row would pass DL-482 (8)(a) | Assert the sent values contain `TYPED`, `held` has it, and the part is the second row's | the three Save-draft -08 cases |

### CI: run 46122561641 on `8b07927d`
- **Conclusion: failure.** Stages 1 to 11b passed. Shard 2 passed with 2 flaky: `approve-override.spec.ts:314` [tablet] and `estimate-calculate.spec.ts:139` [tablet], neither file in this diff. Shards 1, 3 and 4 failed with the same five cases, one shard per width (mobile, tablet, desktop): `leave-guard-history.spec.ts:199`, `:208`, `:219`, `:231`, `:239`, both attempts, at the final `toHaveURL(//queue$/)`; received `/estimates/<code>?row=1.1`. "Stages 1 to 11" failed at its gate only.
- **Green on attempt 1 at three widths:** `:137`, `:147`, the no-wait `:164`, `:251`, (viii) `:326`, (xi) `:339`, (vii) `:353`, (ix) `:371`, PF-23a/b and PF-24a/c `:391`, `:404`, `:418`, R1 `:465`, `:479`, `:500`.
- **Reading:** the landing on P is the text-safe path's signature ([Q, P, G, G2]; `go(-2)` from G2 lands on P). Under A ([Q, P, G]) it would be Q. With the engine order measured above, the run exercised the fallback. **It does not prove A, and it cannot in Chromium.**
- **DL-404:** no budget, time-out or retry change in the diff.
- **Security:** no secret or real data; no route, role check, figure or auth change; NFR-002 not touched.

### Lane 1's two questions (relayed)
- **(1) Is (a) plus (b) enough?** Yes. (b) shows the engine's order, and (a) shows that the guard took the path that depends on it. (a) can pass falsely on the text-safe path only if the gate is already dirty when the row link is pressed, because then the keystroke makes no new dirty transition and `arm()` pushes nothing. `typedInTheSecondRow` and the no-wait case assert the first save is answered 200 before the link, so they are valid. Read the "before" length after that save, not before arming (reading it before arming gives a false red, not a false pass). Also show it red in the unit model.
- **(2) The second ask.** It is not user-visible as a second dialog, and it is harmless: both requests' Leave lands on BEFORE. The bound is applied to all 312 runs, though only 2 need it. Accept the behaviour with the documented reason (Minor), tighten the test to exactly once with a named exception (QLT-845-13, Major), and do not add the island call in #845. #811 adds it with its island and drops the exception. No master ruling is needed for that, unless lane 1 wants exactly-once now.

### Issues for other roles
- **master:** QLT-845-18. DL-482's premise for A does not hold on `window` in Chromium, Chrome or Edge: re-rule the fix shape (DL-482 (5)), and correct (3)'s probe wording to a detached `EventTarget`.
- **developer (lane 1):** after the re-ruling, QLT-845-12, -13, -14 before merge (Major, §9 (3) allows the hardening window only on the delivery lead's word, and DL-482 (8) needs -12 for the run of record). -15 in the same push (a comment). -16 as a `follow-up` issue. QLT-845-03's follow-up issue is still not opened.
- **master:** QLT-845-14 is a deviation from DL-482 (2)(ii) that lane 1 added. Either the tighter match goes in, or master rules on the fallback.
- **#811 (lane 2):** when the island's bare `replaceState` lands, tell the guard (one call), and remove QLT-845-13's named exception.

### Hand-off (round 3)
- Status: COMPLETE
- Artefacts written/updated: this section (not committed)
- Jira / GitHub updates: [#845 review 6096696582](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6096696582), 4 thread replies (Fixed: -08 for the text loss only, -09, -10, -11), label `review:quality-changes-requested` kept; Jira AQP-506 comment
- Open questions: none
- Risks raised: QLT-845-18 (A unreachable in Chromium; DEF-149 open there), QLT-845-14 (a swallowed real Back after a lost step), QLT-845-16 (narrow race)
- Recommended next agent: master, for the fix-shape re-ruling (QLT-845-18); then developer (lane 1)

### Round 3 addendum: DL-487 (option A withdrawn, option C ruled)
Master's DL-487 withdraws option A and rules option C. 8b07927d stays, and the bounce and the probe are removed in new commits. The round 3 findings now stand as follows:

| ID | Status under DL-487 | Carries to C as |
|---|---|---|
| QLT-845-18 (Critical) | **Resolved by the ruling** (A withdrawn). DL-487 accepts the evidence | The five -08 Leave cases (`:199`, `:208`, `:219`, `:231`, `:239`) must be green on attempt 1 at three widths on C |
| QLT-845-14 (Major), -15 (Minor), -16 (Minor) | **Superseded by DL-487** (the bounce, `BOUNCE_GRACE_MS` and the "unknown address" match go with A) | Nothing. Round 4 checks that they are removed and leave no dead code |
| QLT-845-12 (Major) | **Carries over, re-aimed** | A test must show that C's mechanism ran, not the old fallback: under C's arm-on-a-matching-address invariant, assert the history length and the address of the entry the guard arms on, after the row link and after the first keystroke in the new row, at three widths |
| QLT-845-13 (Major, test) | **Carries over** | Exactly one ask per sequence in `leave-guard-writers.test.ts`, with any exception named and justified. No blanket "once or twice" |
| QLT-845-17 (Minor) | **Carries over** | The Save-draft read-back must assert the typed text of the row on screen |
| QLT-845-09, -10, -11 | **Fixed** (green on attempt 1 at three widths in run 46122561641) | Must stay green on C |
| E2E additions at 8b07927d (no-wait `:164`, `backTwiceAsks` length and address, `expectStoredOnTheWayOut`, R1 `:465`, `:479`) | Kept | Round 4 re-reads them against C |

Verdict unchanged: **REQUEST CHANGES**. Round 4 reviews the C commits.

## Round 4 (posted 2026-11-28, on 9598c101)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review, §9 (2)) |
| Commits reviewed | `8b07927d..5e07cae3` (DL-487 option C) and `5e07cae3..9598c101` (the c2 fix: `settlePending`, and `onClick` taking a link while a write is owed). The verdict covers the whole `8b07927d..9598c101`. 0 behind `master` (compare: behind 0, ahead 14) |
| Why now | Posted at the delivery lead's request on the pushed head after the restart (pause 11). Lane 1's DL-488 head (local WIP `cfe350fd`, not pushed) is **not** reviewed here; it is round 5 |
| PR review | [#845 review 6097036884](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6097036884) (COMMENT, single-token, `commit_id` 9598c101). Inline comments: QLT-845-19 `leave-guard.ts:290` (4726421586), -23 `:336` (4726421587), -20 `:239` (4726421588), -21 `leave-guard-history.spec.ts:260` (4726421591), -22 `leave-guard.ts:274` (4726421593). Label `review:quality-changes-requested` kept (already present) |
| **Verdict** | **REQUEST CHANGES. New: 1 Blocker (QLT-845-19), 0 Critical, 1 Major (QLT-845-23, provisional), 3 Minor (QLT-845-20, -21, -22), 0 Info.** §9 (2): the Blocker is fixed before merge. DL-488 (A) rules its shape |

### Checks run
| Check | Result |
|---|---|
| CI 46127541282 on `9598c101` | **success.** Jobs: Stages 1 to 11b (11m33s; unit 558 files / 11,994 tests and 734 files / 17,875 tests passed), E2E shard 1 (616 passed), shard 2 (615 passed), shard 3 (625 passed, 1 flaky), shard 4 (610 passed, 4 flaky; finished after the pause), "Stages 1 to 11" gate passed |
| `leave-guard-history.spec.ts` in that run | **84 of 84 passed on attempt 1** (28 cases × mobile, tablet, desktop; no retry): the DEF-149 describe `:297` to `:351`, c1 `:202`, `:217`, c2 `:229`, c3a/b `:249`, `:260`, (vii) `:454`, (ix) `:472`, R1 `:566`, `:580`, PF-23 and PF-24 |
| DL-479 (5) | `approve-override.spec.ts:230` and `approve.spec.ts:312` passed on attempt 1 at three widths. **`approve-override.spec.ts:314` [desktop] failed attempt 1 (30.2 s) and passed on retry: not met.** For master (DL-487 (4)(b) lets master rule only on `approve.spec.ts:312`). Also flaky and outside this diff: `estimate-form-sections.spec.ts:172`, `:209`, `:223`, `:245` [desktop] (the DEF-085 family, by my reading) |
| The green run and the verdict | No CI case reaches QLT-845-19's sequence (an unarmed row link overtaken by a link to the row on screen). So QLT-845-19 is a Blocker that CI does not catch, and the fully green run does not change the verdict |
| Probe (scratch, not committed) | `probe4/stuck-pending.test.ts` survived the reboot (previous session's scratchpad). Re-run today against `leave-guard.ts`, `save-gate.ts` and `leave-registry.ts` extracted from `9598c101` with `git show` (lane 1's worktree holds the DL-488 WIP, so it was not used): `{entriesAfterTyping: 2, asked: 0, at: /queue}`. The same result was recorded at `5e07cae3` before the pause. Lane 1's model reproduces the class (14 of 49 sequences fail "typed ⇒ armed at idle"; the walk fails in 4 of 4 variants) |
| Why the c2 fix does not close it | Traced at `9598c101`: `onPageOwnLink` (`:290`) sets `pending` but not `shown`. So the second click is compared with `shown` (`:261`), the old row, and is not taken. Next discards the first navigation and settles on the old row, `committed()` never fires, `settlePending()` never matches, and `tryArm` (`:200`) refuses for good |
| Local unit | `vitest run tests/unit/leave-guard`: 84 passed at `5e07cae3`, 85 at `9598c101` (before the pause) |
| DL-404 | No wait, budget, time-out, retry or Playwright-configuration change in the diff |
| Security | No secret and no real data (invented codes and texts); no route, role check, figure or auth change; NFR-002 not touched |

### Carry-overs
| ID | Status | Evidence |
|---|---|---|
| QLT-845-12 (Major) | **Fixed** | Spec `:97` to `:109` (length at the link after the first save's 200, equal after typing) and `:115` to `:125` (unchanged after Back and "Keep editing"). Green on attempt 1 at three widths |
| QLT-845-13 (Major) | **Fixed** | Exactly one ask per sequence (`toHaveLength(1)`, 4 variants), no blanket exception |
| QLT-845-17 (Minor) | **Fixed** | `expectStoredOnTheWayOut` asserts that the save carried `TYPED`, that the stored part's `slNo` is the row on screen, and that the stored values hold `TYPED` (`:49` to `:62`) |
| QLT-845-14, -15, -16, -18 | **Removed with A** | `git grep` at `9598c101`: no `captureRunsFirst`, `BOUNCE_GRACE_MS`, `guardAddress` or `onPopStateText`; no dead code |
| QLT-845-09, -10, -11 | **Still fixed on C** | Green on attempt 1 at three widths in 46127541282 |
| QLT-845-03 (Minor) | Not fixed | No `follow-up` issue opened yet |

### DL-487 checklist at `9598c101`
| Term | Result |
|---|---|
| (2)(i) push only on a matching address | Met in the code (`:200` to `:201`); its liveness fails (QLT-845-19) |
| (2)(ii) `router.replace` only after the step lands, matched on the address | Met (`:333` to `:336`); a late landing is read as a Back (QLT-845-20) |
| (2)(iii) the stale forward entry is harmless, with a case | Unit: yes. E2E: no (QLT-845-21) |
| (2)(iv) two quick links resolve to the last one | Armed path met (c2 green at three widths); the unarmed overtaken path is QLT-845-19 |
| (2)(v) no wait, budget, time-out or retry change | Met |
| (2)(vi) the keepers | Met; the engine-order case `:276` to `:293` records `browser.version()` and asserts no value |
| (3) bounce, probe and `captureRunsFirst()` removed | Met |
| (4)(a) unit model, both orders and both timings | Met; its gaps are now red in lane 1's model (DL-488 (3)(a)) |
| (4)(b) Chromium run of record | `leave-guard-history` 84 of 84 on attempt 1; DL-479 (5) not met (`approve-override.spec.ts:314` [desktop]) |
| (4)(c) Firefox and WebKit | Lane 3 at `5e07cae3`, relayed: Firefox 159 at 1366 px: 28 passed, 2 failed (c2, (viii) Save draft `:427`). WebKit 27.2 at 360 px: 20 passed, 10 failed; at 1366 px: 22 passed, 8 failed. c2 was red in all three engines at `5e07cae3`. Lane 3 re-runs at `9598c101` today |
| 0 behind `master` | Met |

### New findings
| ID | Severity | File:line (at `9598c101`) | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-------|--------|---------------|--------------------------|
| QLT-845-19 | **Blocker** (data loss) | `src/lib/estimates/leave-guard.ts:290` (`onPageOwnLink`), `:261` (`heading` from `shown`), `:200` (`tryArm`), `:329`, `:371`; `leave-guard.tsx:85-87` | `pending` can outlive the router. An unarmed row link overtaken by a link to the row on screen: Next discards the first navigation (`app-router-instance.js:151-156`), the path and query do not change, `committed()` never runs, `settlePending()` never matches, and `tryArm` refuses for good. The same class by reading: a prevented-default link that never navigates; a redirect to the stale address; a traversal that clears `pending` but not `shown`; the end of `STEP_GRACE_MS` with no re-arm | Typing is unguarded. Back leaves to the queue with no question, and the unsaved text is lost. CI does not reach the sequence | DL-488 (A): F's floor (an owed write never blocks arming; `tryArm` re-run when a step ends and on every traversal), M's link handling, and the input-inert invariant | DL-488 (3): the model oracle at every state; E2E u2 (start clean, hold row 1's `_rsc`, press row 1 then row 1.1, release, type, Back → dialog; "Keep editing" keeps 1.1 and the text; "Leave" lands exactly on the page before) on attempt 1 at three widths |
| QLT-845-23 | Major (provisional) | `src/lib/estimates/leave-guard.ts:336` (`retarget` inside the step-off's `popstate`) | On WebKit at `5e07cae3`, most reds come after `Failed to fetch RSC payload … ?row=1#row-inputs. Falling back to browser navigation. TypeError: Load failed`; QA's `master` control (51502650) never shows it. `5e07cae3..9598c101` does not touch the step-off path. **Cause open:** the click fetch is ruled out (the guard takes the click on `document` in the capture phase, before Next's `Link`), and prefetch is unlikely (`prefetch={false}` at `review-tree.tsx:79`, from #800, confirmed by me and by lane 3). **That withdraws my draft's prefetch reading and its `prefetch={false}` test.** The aborted request may be the navigation's own RSC fetch or another one | Next's fallback for a `replace` is `location.replace`: a full reload of the estimate page after a row link in Safari. While the page is dirty, `onBeforeUnload` asks with the browser's own prompt, so nothing typed is lost unless the person confirms it. DEF-149 class (Sev-2/3 shape), not Sev-1; to fix before G8 | Place the aborted request with a WebKit trace (lane 3). If it is the guard's own write, change when it starts; the ordering is for master against DL-487 (2)(ii) | The DEF-149 describe and c1 to c3 on WebKit at 360 and 1366 px: no fallback line in the console, `performance.getEntriesByType('navigation').length === 1` |
| QLT-845-20 | Minor | `src/lib/estimates/leave-guard.ts:239` (the marker dropped by the timer), `:75`, `:342-346` | A landing of the guard's own step after `STEP_GRACE_MS` has `here === armedFor`, so it is read as a Back; on a clean page `history.back()` leaves the page. Nothing re-runs `tryArm` | Rare; nothing typed lost on a clean page, but an exit nobody asked for | Keep the landing marker until the next `popstate`; re-run `tryArm` when the step ends (DL-488 (2)(i)) | Unit: step, timer fires, landing arrives → no `history.back()` |
| QLT-845-21 | Minor | `tests/e2e/leave-guard-history.spec.ts:260` | c3b goes Back to Q and Forward to P, never to the stale forward entry; `/estimates/<code>` plus a visible form would pass on the wrong row | DL-487 (2)(iii) is not tested end to end | A Forward made directly from P with the row, the address, no dialog and the length asserted; c3b asserts `?row=1` | The cases, three widths |
| QLT-845-22 | Minor | `src/lib/estimates/leave-guard.ts:274`, `:301-302`, `:307`, `:313`, `:356` | Literal backslash-backticks in comments (an edit artefact) | Noise in the module's explanation | Plain backticks | — (style; reviewer-standards) |

### Lane 1's named risks (answers sent before the pause, unchanged)
- (1) The stale forward entry: accepted, DL-487 (2)(iii); the test gap is QLT-845-21.
- (2) A stuck wait: yes, typing is then unguarded. That is QLT-845-19.
- (3) The island while dirty: #811's to close.
- (4) The step-off flash: cosmetic while the row drawn is the row on screen.
- F/M advice: both, folded into DL-488. F's repair flash is a narrow data-loss window (DL-488 (2)(iv) now closes it with the input-inert rule), and `ensureAddressed`'s "clean" must mean nothing unsaved in the row on screen (DL-488 (2)(iii)).

### Issues for other roles
- **developer (lane 1):** QLT-845-19 under DL-488. QLT-845-20 to -22 in the same push. QLT-845-03's `follow-up` issue.
- **lane 3:** WebKit traces at `9598c101` (and on the DL-488 head) to name the aborted request for QLT-845-23.
- **master:** DL-479 (5) on this run: `approve-override.spec.ts:314` [desktop] failed attempt 1. And QLT-845-23's ordering, if the trace points at the guard's own write.

### Next round
Round 5 reviews lane 1's DL-488 head: the delta from `9598c101`, and the whole `8b07927d..head` for the verdict. It checks DL-488 (3) (the oracle, u2, u3, u4, c2, the input-inert invariant), lane 3's WebKit and Firefox reruns and traces (QLT-845-23), QA's `master` control, and the run of record at three widths on attempt 1.

### Hand-off (round 4)
- Status: COMPLETE
- Artefacts written/updated: this section (not committed; the orchestrator commits records-u)
- Jira / GitHub updates: [#845 review 6097036884](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6097036884) with 5 inline comments; label `review:quality-changes-requested` kept; Jira AQP-506 comment 13651
- Open questions: none
- Risks raised: QLT-845-19 (typed text lost after an overtaken row link; CI does not catch it), QLT-845-23 (a full reload on a row link in WebKit)
- Recommended next agent: developer (lane 1) for DL-488; then reviewer-quality round 5

## Round 5 (posted 2026-11-28, on b2e4b8f5)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review, §9 (2)) |
| Commits reviewed | `984ff6f1` (product) and `b2e4b8f5` (tests), the DL-488 head: the delta `9598c101..b2e4b8f5`, with the whole `8b07927d..b2e4b8f5` for the verdict. 0 behind `master` (compare: behind 0, ahead 16) |
| Ruling read | DL-488 in full (records-u `docs/00-governance/decision-log.md`) |
| PR review | [#845 review 6097382485](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6097382485) (COMMENT, single-token, `commit_id` b2e4b8f5). Inline: QLT-845-24 `leave-guard.ts:369` (4726703668), -25 `leave-guard.ts:95` (4726703672), -26 `part-fields.tsx:300` (4726703674), -27 `part-fields.tsx:288` (4726703677), -28 `leave-guard-writers.test.ts:642` (4726703681). Label `review:quality-changes-requested` kept |
| **Verdict** | **REQUEST CHANGES. New: 0 Blocker, 0 Critical, 2 Major (QLT-845-24, -25), 2 Minor (QLT-845-26, -27), 1 Info (QLT-845-28).** Still open: QLT-845-23 (Major, provisional), QLT-845-03 (Minor). **QLT-845-19 (Blocker) is closed for the text loss**, so the §9 (2) stop no longer applies. Under §9 (3), the Majors are fixed before G8 |

### Checks run
| Check | Result |
|---|---|
| CI 46133939325 on `b2e4b8f5` | **success**, every job. Stages 1 to 11b (unit: 559 files / 12,058 tests and 735 files / 17,939 tests). E2E shard 1: 618 passed. Shard 2: 616 passed, 1 flaky. Shard 3: 628 passed. Shard 4: 617 passed. Gate passed. The only attempt-1 failure in the run: `remove-price.spec.ts:300` [mobile], outside the diff |
| `leave-guard-history.spec.ts` | **93 of 93 on attempt 1** (31 cases × three widths; no retry): the DEF-149 describes, c1 `:203`, `:218`, c2 `:230`, c3a `:250`, c3b `:261`, u2 `:338`, u3 `:353`, u4 `:379`, (viii)/(xi)/(vii)/(ix) `:571` to `:616`, PF-23/24 `:636` to `:663`, R1 `:710`, `:724`, `:745` |
| DL-479 (5) | **Met**: `approve-override.spec.ts:230`, `:314` and `approve.spec.ts:312` passed on attempt 1 at three widths |
| u2 timing | 20.3, 20.2 and 17.0 s (desktop, mobile, tablet) against u3's 14.9, 16.5 and 11.5 s. That fits QLT-845-24's 5 s hold; it is not proof. The expect time-out (15 s, `playwright.config.ts:74`) is longer than the hold |
| Probe 5 (scratch, not committed) | `probe5/probe5.test.ts` against `leave-guard.ts`, `save-gate.ts` and `leave-registry.ts` from `b2e4b8f5` (via `git show`), with timers modelled. u2 with `#row-inputs`: the second click goes to Next and is held 5000 ms, then Back asks. Without the hash: the guard takes it, held 0 ms, Back asks. A write slower than `INPUT_HELD_MAX_MS`: released at 5001 ms, a key accepted in the old row, the guard pushes, and the write lands on the guard's entry |
| Code read | `leave-guard.ts` in full; `save-gate.ts`, `leave-guard.tsx`, `part-fields.tsx`, `field-renderer.tsx`, `use-input-held.ts`, `estimate-texts.ts` diffs; the walk (`sequencesOf`, `walk`, `check`, `typeWhenAllowed`, the writer lists); the E2E u2 to u4 and c3b; `inputsHref` (`review-tree.tsx:51`) |
| DL-404 | No wait, budget, time-out, retry or configuration change, except the walk's own unit time-out (QLT-845-28) |
| Security, NFR-002 | No secret or real data. No route, role check or auth change. The shared form gains a read-only hold, a look and one line of text; no figure, so the Engineer view shows no cost |

### Round 4 findings
| ID | Status | Evidence |
|---|---|---|
| QLT-845-19 (Blocker) | **Fixed for the text loss** | F's floor (`tryArm` `:266-277`); the walk's "typed ⇒ armed at idle" for every listed writer, in 4 variants; u2 green on attempt 1 at three widths. The residue is in the hold (QLT-845-24, -25) |
| QLT-845-20 (Minor) | **Fixed** | `late` (`:453-465`). On a dirty page a late landing still asks: Info, safe |
| QLT-845-21 (Minor) | **Fixed** | c3b reaches the guard's old entry from P; green on attempt 1 at three widths |
| QLT-845-22 (Minor) | **Fixed** | 0 literal backslash-backticks (6 at `9598c101`) |
| QLT-845-23 (Major, provisional) | **Open** | One write at a time and no step-off while a write is in flight (`:215-219`, `:323-327`) aim at it. Lane 3's WebKit traces are due (Docker was down) |

### DL-488 checklist
| Item | Result |
|---|---|
| (i) F's floor | Met. The `:271` skip is safe (typed text keeps `hasUnsaved` marks) |
| (ii) M's link handling | **Not met for `#row-inputs` links** (QLT-845-24) |
| (iii) "clean" = nothing unsaved in the row on screen | Met (`rowDirty: () => gate.hasUnsaved()`) |
| (iv) input-inert, `readonly` + `aria-readonly`, `aria-busy`, 300 ms, polite line | Mostly met. Gaps: QLT-845-25 (fail-open), -26 (line inside the busy form), -27 (treatments and picture not held) |
| (v) DL-487 invariants | Met in the walk's `check` and `backOracle` |
| (3)(a) model | Met, except hash-less row links (-24) and no slow-write writer (-25) |
| (3)(b) E2E | Green on attempt 1 at three widths. u4 is a save answered before the row change, not the hung-save trap. No repair keystroke stream. Both for master |
| (3)(c) Firefox, WebKit | Waiting for lane 3 |

### New findings
| ID | Severity | File:line | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-------|--------|---------------|--------------------------|
| QLT-845-24 | Major | `src/lib/estimates/leave-guard.ts:369`; `review-tree.tsx:51` | The `#` check uses `win.location`, not the row being written. Every tree link carries `#row-inputs`, so a link back to the current row while a write is owed is not taken. Next overtakes the owed write and the hold lasts until `INPUT_HELD_MAX_MS` | The form refuses every key for 5 s in u2's sequence. The first-key arming then depends on the fail-open timer (-25). The model's hrefs have no hash, so its u2 and c2-Firefox "the guard takes the second link" do not hold for the real links | `fragmentLinkOf(…, reference)` built from `heading`; the real `inputsHref` shape in the model's row links and in "a link to the address the page is on" | Model u2 and c2-Firefox with `#row-inputs`, no fail-open timer run. E2E u2 with an assertion time-out below `INPUT_HELD_MAX_MS` after release |
| QLT-845-25 | Major (for master) | `src/lib/estimates/leave-guard.ts:95`, `:300-305`, `:401-406` | The hold ends at 5 s whether or not the write has landed | For a row write slower than 5 s, a key is accepted in the row about to be replaced and dropped when the write lands: DL-488 (iv)'s "never accepted and then dropped" fails, silently | Master chooses: (a) hold until an event ends the write (commit, traversal, the guard's next link, a redirect's commit), keeping the timer only for known-dropped writes; (b) on the late landing, ask or keep the old row; (c) a named residual with a longer bound and a reason | Model writer "a row write that lands after `INPUT_HELD_MAX_MS`" with the oracle's no-drop check; E2E: hold `_rsc` past the bound, type, release |
| QLT-845-26 | Minor (for the ux-expert) | `src/components/features/estimate-workspace/part-fields.tsx:205`, `:299-301` | The `role="status"` line is inside the `<form aria-busy="true">` for exactly as long as it is shown | Assistive technology may hold the line back until the form is no longer busy, when it is already gone (WCAG 4.1.3) | `aria-busy` on the fields' grid, or the line outside the busy element | u3: the status element has no `[aria-busy="true"]` ancestor while the line shows |
| QLT-845-27 | Minor | `part-fields.tsx:251-262`, `:267-278` (`held` reaches only `FieldRenderer`, `:288`) | Treatment toggles and the picture still accept input during a hold | Nothing is dropped (each saves at once), but it saves to the row leaving the screen, against DL-488 (iv) | Pass `held` and make both read-only while it is set | u3: a toggle during the hold changes and sends nothing |
| QLT-845-28 | Info | `tests/unit/leave-guard-writers.test.ts:642` | The 30 s walk bound: justified (a finite walk, 1533 runs per variant; 1.4 to 1.9 s alone, 5.2 to 5.4 s under load). The comment says 0.5 to 2 s | — | 15 s with the measured figures, or split by length | — |

### Lane 1's items
1. -20 on a dirty page: accepted (Info).
2. No repair keystroke stream: a repair can be triggered from the browser through -25's path. **For master.**
3. u4: the E2E is a save answered before the row change, not the island rewrite with a hung save; the trap is in the unit cases only (`leave-guard-writers.test.ts:795`). **For master.**
4. Residual risks: the fail-open is -25. The once-swallowed Back on a clean page is Info (a dead press, nothing lost). The unannounced late write is the walk's "late write" writer.
5. The livelock skip: safe.
6. Replaced tests: no guarantee weakened, except that the "takes the second link" cases rely on hash-less links (-24).

### Issues for other roles
- **developer (lane 1):** QLT-845-24 (with the model's hrefs), -27, -28 (preference), after master's -25 ruling. QLT-845-03's `follow-up` issue.
- **master:** QLT-845-25 (the fail-open trade-off); lane 1's items 2 and 3; QLT-845-26 with the ux-expert (DL-488 (iv) names the form for `aria-busy`).
- **ux-expert:** QLT-845-26.
- **lane 3:** the WebKit traces for QLT-845-23, at `9598c101` or `b2e4b8f5` (one write at a time is new here).

### Hand-off (round 5)
- Status: COMPLETE (code and CI read; QLT-845-23 waits for lane 3 as an addendum)
- Artefacts written/updated: this section (not committed)
- Jira / GitHub updates: [#845 review 6097382485](https://github.com/sankumar76/Accucut-Quotation/pull/845#pullrequestreview-6097382485) with 5 inline comments; label kept; Jira AQP-506 comment 13655
- Open questions: none
- Risks raised: QLT-845-25 (silent drop on a slow row write), QLT-845-24 (5 s frozen form)
- Recommended next agent: master for QLT-845-25 and the two proof items; then developer (lane 1); then reviewer-quality round 6
