# DEF-061: `estimate-form.spec.ts:74` [tablet] AC-1: cards 03 and 04 read 110 px apart on one flex line, because the picture slot's 48 px skeleton is replaced by a control about 160 px tall (Product, layout)

| Field | Value |
|-------|-------|
| Story / AC | **Owning story STORY-05.07 (AQP-315, #408), the picture control and its slot** (master's DL-294 (4); first logged against STORY-05.03, AQP-303, whose AC-1 is the case's subject: "the cards sit one above the other on a phone and side by side from a tablet"). UX spec :417 (Loading) requires "Skeleton rows shaped like the content" |
| Severity | **Sev-3 Moderate** (DL-294 (4): stays). A loading state off the UX spec, with a workaround (the control arrives); nothing is lost or exposed |
| Priority | P3. **Lane (DL-294 (4)):** the DEF-061 developer keeps the lane and works now, one PR (product fix and test fix). Under the freeze it squashes only after the DEF-060 fix (done, #610), on its own fully green run on a head that is not behind; if it is ready with #605 or #601, those go first. DEF-057 takes the next lane that frees |
| Type | **Product (layout)** (master's DL-294 (4); was Test, product not excluded) |
| Status | **New**, type moved to Product (layout) by DL-294 (logged 2026-11-22) |
| Jira / GitHub | [AQP-395](https://sankumar76.atlassian.net/browse/AQP-395) / [#609](https://github.com/sankumar76/Accucut-Quotation/issues/609). Jira "relates to" **AQP-315 (STORY-05.07, the owning story; the site has no "is caused by" type)**, AQP-388 (CR-01 item 1, #600, which exposed it) and AQP-1 (Intake); the earlier "relates to" AQP-303 (STORY-05.03) stays on the issue because QA has no tool to remove a link. **Not linked to RISK-031** (a received value, not a time-out). RISK-033 (DL-294 (5)). Labels `ai-delivery`, `aiid-DEF-061`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium. GitHub labels `bug`, `sev-3`, `ai-delivery` |
| Risk / rule | None. **Never re-run** this failure: it is the case's subject failing with a received value (DL-293 (3)); no rule may cover it. RISK-031 trigger (b): not counted (not a time-out) |
| Found by / date | CI, `master` push 44995772811; read by master (DL-293 (3)); logged by qa-engineer, 2026-11-22 |
| Build / commit | `master` push 44995772811 (62ff83c4, #588 squash), Stage 12 shard 2, job 137126360509. #600 is 08394110 |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 2 of 4, project tablet (768 px), dev server, 4 workers; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). The case waits for the form, reads the bounding box of card 03 (:78) and then of card 04 (:79) in two separate calls, and expects the same top (`:91`) at tablet width. If the page grows above card 03 between the two reads, the tops differ.

## Expected Result
At 768 px the two cards are on one flex line and share a top (a difference under 2 px).

## Actual Result
Attempt 1 failed at 12.4 s at :91; the retry passed (12.9 s).
```
Error: layout {"formWidth":670,"columns":"none","viewport":768}, first {"x":49,"y":1781,"width":329,"height":173}, second {"x":390,"y":1891,"width":329,"height":173}

expect(received).toBeLessThan(expected)
Expected: < 2
Received:   110
> 91 | expect(Math.abs(second.y - first.y), why).toBeLessThan(2);
```
**Reading (master, DL-293 (3); QA confirms the numbers from the job log):** 04.x (390) = 03.x (49) + 03.width (329) + 12, the 12 px gap of `flex flex-wrap gap-s-3` (`part-fields.tsx:188`, 12 px since #600), so the two cards are on one flex line and one line has one top. A 110 px difference can only come from two separate `boundingBox()` reads taken across a layout shift: something above card 03 grew by 110 px after `waitForForm` returned (it waits only for the form, J and E).

**Why #600 exposed it:** before #600 the case measured cards 01 and 02, the top row, which growth inside the form cannot move. #600 (08394110) moved the pair to 03 and 04, below 01 and 02, so a growth above them shifts both. #600 did not cause a product regression.

**Readings of the case, 22 Nov `master` pushes (master, DL-293 (3)):** 5.7 to 13.2 s at every width across eight pushes; this is the only failure. Not a timing problem.

## Evidence
`master` push 44995772811 Stage 12 shard 2 job 137126360509 (the error block above, from the log; `Error Context: test-results/estimate-form-AC-1-AC-2-AC-fd98b--side-by-side-from-a-tablet-tablet/error-context.md`, not kept by CI for the failed attempt; shard 2 `1 flaky, 529 passed (20.0m)`); DL-293 (3).


## What grows (master's DL-294 (4), read on origin/master 62ff83c4; not measured, Playwright is CI-only here)
`picture-slot.tsx` loads the picture control by a bare `import()` in a `useEffect` (:13, :26) and renders `<Skeleton className="h-s-7" />` until it arrives (:41). `--s-7` is 48 px (`globals.css:35`). The loaded `part-picture.tsx` control is about 158 to 162 px tall at 768 px by its CSS (the developer's sum), so about 110 to 114 px taller, which matches the received 110 px gap between cards 03 and 04. `git log`: `picture-slot.tsx` came from AQP-315 (STORY-05.07, #408). UX spec :417 (Loading) requires "Skeleton rows shaped like the content"; the no-shift line at :1280 covers only the menu button and the account trigger. A 48 px bar is not shaped like a control about 160 px tall, and every card below card 01 jumps about 110 px on each part open. Master's ruling: **option 1, a product fix plus the test fix, in one PR** (option 2, test-only and accept the shift, rejected: it would hide a product deviation the case caught, as DEF-059 was routed away from in DL-291).

## Binding for the fix PR (DL-294 (4); supersedes the first-logged binding; one PR, the DEF-061 developer, from current `master`)
1. **Measure first, red-first:** a case that holds the picture control's code request so the skeleton is on screen, reads the slot's height, releases the request, and reads the height again once `[data-picture-zone]` (or the loaded control's own marker, proven by its `src/` line) is visible. It asserts the two heights are equal within 2 px at all three widths, attaches both, and is shown red before the `src/` change (printed in the PR body). The hold mechanism is the developer's choice; if the chunk cannot be held reliably, stop and come back to master.
2. **The `src/` change** is only the loading branch of `picture-slot.tsx` (:41): a skeleton shaped like the loaded control (its label line, drop zone and hint line, or one block of the same height at each width), built from the existing `Skeleton` and existing spacing tokens. No other `src/` file, no `part-picture.tsx` change, no new token, and no text, role, label, `aria` or behaviour change. If equal heights within 2 px cannot be reached that way, come back to master.
3. **The test change ships in the same PR:** in `tests/e2e/estimate-form.spec.ts`, read both boxes in one `evaluate` after waiting for the loaded control's marker, proven by its `src/` line (DL-240). Every assertion kept; no budget, retry, timeout, skip or fixed sleep. The one-off diagnostic of the first binding is replaced by the red-first case. The PR's files: `picture-slot.tsx`, `tests/e2e/estimate-form.spec.ts` and, if the red-first case lives there, `tests/e2e/estimate-picture.spec.ts`; nothing else.
4. **No combined review:** not a section 9 item 2 area; the gate is fully green CI (section 9 item 1).
5. **Proof:** the red-first case red before and green after at all three widths, and :74 passing attempt 1 at tablet and desktop, both on the PR run of record and on the first `master` push after the squash.
**For ux-expert (not blocking, before G8's final review):** one sentence in the UX spec Loading row: "a skeleton holds the height of the content that replaces it, so nothing below it moves".

## Re-run rule
None. Never re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-395, #609 |
| Red-first case (heights equal within 2 px, skeleton vs loaded) | developer | | printed red in the PR body before the `src/` change |
| Fixed | developer | | `fix/AQP-395-<slug>`: `picture-slot.tsx` loading branch (:41), `tests/e2e/estimate-form.spec.ts`, and `estimate-picture.spec.ts` only if the case lives there |
| Regression test added | developer | | the red-first height case; the one-frame read of :74 after the loaded control's marker; every assertion kept |
| Verified | qa-engineer | | the red-first case green at all three widths and :74 attempt-1 green at tablet and desktop, on the PR run of record and on the first `master` push after the squash |
