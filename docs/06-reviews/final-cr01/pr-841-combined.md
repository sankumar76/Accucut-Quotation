# Review Report: PR #841 (AQP-505: follow-ups #840, QLT-839-03, -04, -08). Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality, as the CLAUDE.md §9 (2) combined security-and-quality review (data integrity: the revision a save sends) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-505-followups-840` (PR [#841](https://github.com/sankumar76/Accucut-Quotation/pull/841)), 0 behind master `e64cc034` (#839 squashed) |
| Commits reviewed | `32bc9578` (QLT-839-04), `8ed5556c` (QLT-839-08, -03) and **`8d2e5b8a09ab4f1b0691785ba9e558edd4c48eae`** (head; comment only: "follow-up #840" became "follow-up 840" at `use-part-form.ts:488`, so that the hex-colour token test does not match it. Verified with `git diff 8ed5556c 8d2e5b8a`; no line moved) |
| Date | 2026-11-27 |
| Reviewed against | `pr-839-combined.md` (QLT-839-03, -04, -08 and the one-snapshot rule); DL-472; DL-475; architect note v1.3 rule 8; RISK-035; DL-468 (Stage 11b ≤ 194,000 B); STORY-05.08 AC-5, AC-6; STORY-05.10 AC-7a/b; `docs/standards/coding-standards.md` §1, §6 |
| **Verdict** | **REQUEST CHANGES.** **0 Blocker, 0 Critical, 1 Major, 2 Minor, 4 Info.** No Blocker or Critical is open, so the §9 (2) stop does not apply. The one Major (QLT-841-01: the move adoption trusts a revision that does not prove this move wrote) is a two-line change and should be fixed before merge. **CI on `8d2e5b8a` had not started when this report was written** (run 46099380289 on `8ed5556c` failed at Stage 6 on a comment and is not the run of record). Stage 11b in particular must be read before the squash (QLT-841-04) |

## Summary

**QLT-839-03 and QLT-839-08 are done well.** The form is now told about a picture inside the turn, and a new ordering case pins it: "the form is told" comes before "the next save starts". The `changed` value is pinned by four component cases (same picture, another picture, first picture, removal), and the mutants `onChanged(result, true)` and `onChanged(result, false)` are each caught.

**QLT-839-04 is the right idea, and in the common case it is right.** After a successful move, the server answer gives the moved part revision `sent + 1`. The move is conditional on `part.revision === request.revision` under the estimate lock (`estimate-service.ts:478`), and only the moved part is bumped (`:489`). If the row's revision equals the form's, "exactly one ahead" is then exactly "my move, on the values I hold". Taking it in turn after the queued saves is also right, and it is tested.

**But "exactly one ahead of the form" is not the same as "this move wrote" (QLT-841-01, Major).** The form compares the answer with its own revision, not with the revision the move was sent with. Two answers that the tree hands over do not prove a write:
- (a) **A no-op move is 200 with the part's current revision** (`estimate-service.ts:486`, `return viewsOf(before, readers)`). That revision is the one sent, not one more.
- (b) **A move whose answer was lost** goes through `settleAfterLimit`. `landed` there accepts any re-read where the row's Sl. No. changed, and `onDone` then takes the row's revision from that re-read.

In both cases, if the tree row is one ahead of the form, the form adopts a revision over values it has not seen, and DEF-148's chain runs again. That happens after another person's edit, once the row has been patched or re-read (for example `reportSaved` from a picture answer that was not adopted, QLT-839-06). The triggers are rare races. The fix is exact and small: carry the revision the move was sent with, adopt only when `answer === sent + ONE_WRITE && sent === revisionRef.current`, and never hand over a revision from the re-read path.

**#839's rule holds otherwise.** No other path changed. The seed guard line and its comment are untouched. The merge with #811 is clean. **The merge with #836 conflicts on one line in `estimate-workspace.tsx`** (the `<PartForm …>` props). Whoever resolves it must keep both `seed=…` and `ownMove={tree.ownMove}`. No test would catch a dropped `ownMove` (QLT-841-02).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-841-01) |
| Minor | 2 (QLT-841-02, QLT-841-04) |
| Info | 4 (SEC-841-01, QLT-841-03, -05, -06) |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff | `git diff e64cc034...8ed5556c` (11 files, +293 −6). Read in full: `use-part-form.ts` (`ownMoved`), `use-parts-tree.ts` (`moveTo`, `change`, `settle`, `settleAfterLimit`), `part-fields.tsx` (the effect), `part-form.tsx`, `estimate-workspace.tsx`, `part-picture.tsx`. Server rules read: `estimate-service.ts:470-497` (`moveNode`). UI guards read: `move-menu.tsx` (Move up and Move down disabled at the ends), `tree-reorder.ts` (`end` returns null for the same place) | read |
| Unit tests at head (read-only, lane 1's clean worktree `.claude/worktrees/aqp-505-followups` at `8ed5556c` (the head differs only in that comment)) | `vitest run` of `part-form-revision`, `part-picture-changed`, `use-parts-tree`, `parts-tree-card`, `tree-row-actions`, `use-part-values`, `part-form-seeded-reads` | **7 files, 167 tests pass** |
| Red run and mutants | PR body: five `ownMoved` cases red (`not a function`) before the code; the mutants "adopt at once" and "adopt any answer ahead" are killed; the two `changed` mutants are killed | Taken from the PR. Consistent with the cases I read |
| Merge with #836 / #811 | `git merge-tree --write-tree` of `8ed5556c` (the same tree as `8d2e5b8a` outside that comment) with #836 `6a5d8abc` and with #811 `19ced41e` | **#811: clean. #836: one conflict, `estimate-workspace.tsx`, the `<PartForm …>` line** (#836 adds `seed=…`, this PR adds `ownMove=…`) |
| CI of record | `gh pr checks 841` | **Not yet started on `8d2e5b8a`** at the time of writing. Run 46099380289 on `8ed5556c` failed at Stage 6 on the `#840` comment alone (the hex-colour token test), and it is not the run of record |
| Servers | none started | — |

## Focus questions

**(1) Can the move adoption take another person's change?** Yes, in two shapes. Both are rare, and both are closed by QLT-841-01's fix.

| Answer the tree hands over | What its revision proves | Current rule (`answer === held + 1`) | With the fix (`answer === sent + 1 && sent === held`) |
|---|---|---|---|
| 200, the move wrote | The part was at `sent` under the lock, and this move made `sent + 1` | Adopts when `sent === held`: **right** | Same: **right** |
| 200, someone else wrote first | Impossible: a different revision is a 409 `TREE_CHANGED` (`:478`), and `settle` gives no `onDone` (tested) | — | — |
| 200, **no-op** (the part is already at `index` on the server: someone else reordered its siblings, which does not raise its revision) | Nothing was written. The answer is `sent` | **Adopts when `sent === held + 1`**, that is, when the row was one ahead of the form (another person's edit shown on the row). **Wrong** | `sent + 1 ≠ sent`: not adopted. **Right** |
| **Lost answer, re-read** (`settleAfterLimit` → `landed`: the Sl. No. changed) | Only that the row moved, by anyone. The revision may hold another person's edit | **Adopts when the re-read row is `held + 1`.** **Wrong** when that `+1` is someone else's edit and a sibling reorder changed the Sl. No. | The re-read is not handed over: not adopted. The next save gets a 409, which is safe |
| Answer two or more ahead | Someone else wrote as well | Not adopted (tested) | Not adopted |

The client's own guards (the menu disables the ends, and a drop at the same place gives `null`) stop the person from asking for a no-op on their own tree. A no-op therefore needs the server's order to differ from the tree's, which takes another person's reorder that the tree has not yet shown. That is rare. But it is silent, and the fix makes the rule exact instead of probable.

**(2) #839's rule (a save sends the revision of the values held).** Every path from #839 is unchanged. `ownMoved` is the second place a revision is adopted without values. That is justified only because a move changes no inputs, so it must be exactly "my write on my snapshot", which the fix ensures. Taking it in turn is right: a save in flight is answered first, and a save queued between the move's answer and the effect is sent with the older revision and gets a safe 409. The remount replay of an old `ownMove` (QLT-841-03) cannot adopt.

**(3) RISK-035.** The seed guard line is not touched (`git diff` of `use-part-form.ts` adds only `ownMoved` and its return entry, with no `part.revision`). The `PartTarget` comment is unchanged. The merges: #811 is clean. #836 has one conflicting line (see QLT-841-02).

**(4) First-load cost.** The first-load files gain one state and one `find` in `moveTo` (`use-parts-tree.ts`), one prop (`estimate-workspace.tsx`) and one prop passed on (`part-form.tsx`). `part-fields.tsx` and `OwnMove` (type-only) are in the lazy chunk or erased. By reading that is likely tens of bytes, but only Stage 11b can say. See QLT-841-04 for the arithmetic against the 194,000 B ceiling with #811 and #836 still to land.

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix | Test that catches it |
|----|----------|-----------|-----------|-------|--------|---------------|----------------------|
| QLT-841-01 | **Major** | `src/components/features/estimate-workspace/use-part-form.ts:493-497` (`ownMoved`); `use-parts-tree.ts:274-277` (`moveTo`'s `onDone`, also reached from `settleAfterLimit:215-231`) | STORY-05.08 AC-5, AC-6; DL-472 (4) (a); architect rule 8 | The form adopts a move answer that is "exactly one ahead of the revision it holds". That is not proof that this move wrote. (a) A no-op move is 200 with the part's current revision (`estimate-service.ts:486`), which is the revision sent. (b) After a lost answer, `landed` takes any re-read with a changed Sl. No., and `onDone` takes that re-read's revision. If the row was one ahead of the form (another person's edit, shown on the row), both adopt it over values the form has not seen | DEF-148's chain: the next save goes through with no 409, `heldRef` takes the other person's values while the old texts show, and Save draft, a tab hide or the 30-second tick sends them back. Rare (a concurrent reorder or a lost answer, plus a concurrent edit), but silent | Carry the revision the move was sent with, and adopt only a proven write on the held snapshot. `use-parts-tree.ts`: `export interface OwnMove { readonly id: string; readonly sent: number; readonly revision: number }` and, in `moveTo`'s **direct** answer only, `setOwnMove({ id, sent: revision, revision: moved.revision })`. Do not set it from `settleAfterLimit` (give `change` an `onAnswered` used by `settle` only, or a flag on the answer). `use-part-form.ts`: `function ownMoved(move: { readonly sent: number; readonly revision: number })` with `if (move.revision === move.sent + ONE_WRITE && move.sent === revisionRef.current) revisionRef.current = move.revision;` | Unit, red first: (a) `open()` (held 1); `partServer.changeElsewhere({ a: '9.00' })` (2); `form.ownMoved({ sent: 2, revision: 2 })` (the no-op answer); edit C; `gate.flush('draft')`; expect `sent[0].revision` 1 and the server's A `9.00`. (b) `use-parts-tree.test.ts`: a move that times out and is followed by a re-read with a changed Sl. No. leaves `ownMove` null |
| QLT-841-02 | Minor | `part-fields.tsx:151-158` (the effect and its `ownMove?.id === part.id` filter); `part-form.tsx:128`; `estimate-workspace.tsx:194` | coding standards §6; RISK-035 | Nothing tests the wiring. The hook cases call `form.ownMoved` directly. The tree case checks `state().ownMove`. No test renders `PartFields` (or `PartForm`) with an `ownMove`. So these mutants survive: dropping `ownMove={ownMove}` in `part-form.tsx`, dropping `ownMove={tree.ownMove}` in the workspace, and, the dangerous one, `const moved = ownMove` without the id filter (another row's move revision handed to this form). The id filter is a safety guard. **The #836 merge conflict is on exactly the workspace line** | A conflict resolution or a later edit can drop the feature (QLT-839-04 comes back) or the filter (an unrelated revision is adopted when it happens to be one ahead) with nothing going red | One render-level case. Render `PartFields` (or `PartForm`) with the invented server. Hand it `ownMove = { id: OTHER_ID, … }` and expect the next save not to carry it. Then hand it `{ id: part.id, … }` and expect the save to carry it. Plus a note in the PR, and in DL-475 (3)'s pre-squash check: "the `<PartForm>` line keeps `seed=…` **and** `ownMove={tree.ownMove}`" | That case |
| QLT-841-04 | Minor | the first-load files above | DL-468 (Stage 11b ≤ 194,000 B) | This PR's Stage 11b figure is not known yet (CI pending). #839's run read 193,081 B. With #811 (≈ +555 B) and #836 (+40 B) still to land, the room left is about 194,000 − 193,676 ≈ **324 B** for this PR and anything else | If the three together pass the ceiling, the last of them to merge fails Stage 11b near the freeze | The orchestrator reads this PR's Stage 11b on its run of record and records the delta against `e64cc034`. If the sum with #811's and #836's deltas is over 194,000 B, decide the merge order before the squash | Stage 11b |
| SEC-841-01 | Info | whole diff | coding standards §5; CLAUDE.md §6 rule 7 | Client-only. No route, schema, authorization, log or cost value. The server is still the only judge (the move's own revision condition and the inputs' conditional write). The tests use invented IDs and values | — | — | — |
| QLT-841-03 | Info | `part-fields.tsx:151-158` | — | `ownMove` is never cleared, so a form that mounts again for a part moved earlier replays that old move in its first effect. It cannot adopt: the old answer is at most the row's revision, and the form starts at the row's (or the load's) revision. With QLT-841-01's fix it is also refused by `sent === held`. Optional: let the tree clear it, or keep a "consumed" ref | — | Optional | — |
| QLT-841-05 | Info | `part-picture.tsx:132-136`; `part-picture-changed.test.ts` | QLT-839-03, -08 | Praise. Telling the form inside the turn closes the false 409 for a save queued during an upload. The ordering case and the four `changed` cases pin both halves of #839's picture fix, and the PR records its mutants | — | — | — |
| QLT-841-06 | Info | `part-form-revision.test.ts:257-271` | STORY-05.10 AC-7a/b | Praise. The "own move, then type, then leave" case checks the one keepalive save with the new revision and the server's value: QLT-839-04's loss is gone for the direct-answer path | — | — | — |

## Prior findings carried here

| ID | Prior | Status |
|----|-------|--------|
| QLT-839-03 | Minor | **Fixed** (`part-picture.tsx:132-136`; ordering case) |
| QLT-839-04 | Minor | **Fixed for a direct answer**, with QLT-841-01 open on the proof of the write |
| QLT-839-08 | Minor | **Fixed** (`part-picture-changed.test.ts`, four cases, mutants killed) |
| QLT-839-05 | Minor | Still open; it applies at the second squash among #811 and #836 (not touched here) |

## Issues for other roles

- **developer (lane 1):** QLT-841-01 before merge. QLT-841-02's render case in this PR if cheap, otherwise at least the PR note for the #836 conflict.
- **orchestrator:** QLT-841-04, Stage 11b arithmetic before the squash. Add to DL-475 (3)'s pre-squash check that `<PartForm>` keeps both `seed=…` and `ownMove={tree.ownMove}` when #836 is merged after #841.

## Hand-off
- Status: COMPLETE on the code; CI on `8d2e5b8a` not yet read (not started when written)
- Verdict: REQUEST CHANGES; 0 Blocker, 0 Critical, 1 Major, 2 Minor, 4 Info
- Next: developer (lane 1) to fix QLT-841-01 (and QLT-841-02 if cheap); reviewer-quality to review that delta; orchestrator to read CI and Stage 11b

---

# Round 2: re-review of `98e9a43e` (delta `8d2e5b8a...98e9a43e` only)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the §9 (2) combined review, round 2) |
| Commit reviewed | **`98e9a43eb89af534ff2e91de2f9623fe16c71716`** (one commit on `8d2e5b8a`: 6 files, +108 −25), 0 behind master `e64cc034` |
| Date | 2026-11-27 |
| **Verdict** | **APPROVE WITH COMMENTS on the code.** **Open: 0 Blocker, 0 Critical, 0 Major, 1 Minor (QLT-841-04, Stage 11b still to read), 5 Info (SEC-841-01, QLT-841-03, -05, -06, -07).** QLT-841-01 and QLT-841-02 are fixed. **Merge conditions:** (1) run of record 46100326250 on `98e9a43e` fully green; (2) its Stage 11b, as a delta over 193,081 B, plus #836's tree-seed delta, fits the ≈ 323 B left under 194,000 B. **When this round was written, run 46100326250 was in progress** (stages 1 to 11b and all four E2E shards running), so Stage 11b is not known. The orchestrator reads it |

## Checks run (round 2)

| Check | Result |
|-------|--------|
| Delta | `git diff 8d2e5b8a 98e9a43e`, read in full: `use-part-form.ts` (`ownMoved`), `use-parts-tree.ts` (`OwnMove`, `change`, `settle`, `settleAfterLimit`, `moveTo`), `part-fields.tsx` (one argument), the three test files |
| Other `onDone` callers | `addUnder` and the delete keep their one-parameter callbacks. A shorter parameter list is assignable in TypeScript, and their behaviour is unchanged |
| Unit tests at `98e9a43e` (read-only, lane 1's clean worktree) | `part-form-revision`, `part-picture-changed`, `use-parts-tree`, `own-move-wiring`, `parts-tree-card`, `tree-row-actions`, `use-part-values`, `part-form-seeded-reads`: **173 tests pass** |
| CI | Run 46100326250 (`98e9a43e`): **in progress** at the time of writing |

## Prior findings

| ID | Prior | Status | Evidence |
|----|-------|--------|----------|
| QLT-841-01 | Major | **Fixed** | `use-part-form.ts:496`: `move.revision === move.sent + ONE_WRITE && move.sent === revisionRef.current`, taken in turn. `use-parts-tree.ts:280`: `const moved = direct ? … : undefined`, and `setOwnMove({ id, sent: revision, revision: moved.revision })` with `revision` the one sent. `settle` passes `direct` true (`:194`) and `settleAfterLimit` passes false (`:230`). Every row of round 1's table now resolves correctly: wrote, `sent === held` → adopted; no-op (`revision === sent`) → not adopted (case (a)); lost answer → nothing handed over (case (b), `use-parts-tree.test.ts`, which also checks that the landed path ran, "Part renumbered to 1.1"); row one ahead (`sent === held + 1`) → not adopted (case (c)); a save in flight → evaluated after it, `sent 2, revision 3` adopted after the save left 2. The rule is now exact, not probable: a direct 200 with `revision = sent + 1` proves this move wrote on state `sent`, and `sent === held` proves that state is the one whose values the form holds |
| QLT-841-02 | Minor | **Fixed** | `own-move-wiring.test.ts`, 4 source-text cases. The `<PartForm>` tag must hold both `ownMove={tree.ownMove}` and `onChanged={tree.readAgain}`, so a conflict resolution that drops one is seen. `part-form.tsx` passes it down. The exact id filter line and the effect are pinned. The tree's direct-only line and `sent: revision` are pinned. Each mutant I named in round 1 now fails one of these |
| QLT-841-04 | Minor | **Open, CI pending** | See the verdict |
| QLT-841-03 | Info | unchanged | The remount replay is now also refused by `sent === held` |

## New (round 2)

| ID | Severity | File:line | Note |
|----|----------|-----------|------|
| QLT-841-07 | Info | `tests/unit/own-move-wiring.test.ts` | A source-text test pins exact strings, so a harmless reformat (Prettier reflowing the `<PartForm>` line, or a renamed local) turns it red. It fails safe and fits the project's other wiring tests (there is no DOM in the unit project). A render-level case would be sturdier if a DOM project is ever added. No action needed |

## Hand-off (round 2)
- Status: COMPLETE on the code. Run 46100326250 was in progress, so Stage 11b is not yet known
- Verdict: APPROVE WITH COMMENTS; open 0 Blocker, 0 Critical, 0 Major, 1 Minor, 5 Info
- Next: orchestrator reads run 46100326250. If it is green and Stage 11b's delta over 193,081 B plus #836's tree-seed delta is within ≈ 323 B, the merge can proceed under §9 (1). Whoever merges #836 after #841 keeps both `seed=…` and `ownMove={tree.ownMove}` (now pinned by `own-move-wiring.test.ts`)
