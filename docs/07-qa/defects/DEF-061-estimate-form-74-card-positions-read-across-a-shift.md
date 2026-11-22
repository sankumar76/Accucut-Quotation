# DEF-061: `estimate-form.spec.ts:74` [tablet] AC-1: cards 03 and 04 read 110 px apart on one flex line, because the page moved between two separate position reads (Test, product not excluded)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.03 (AQP-303, Done), AC-1: "the cards sit one above the other on a phone and side by side from a tablet". The case measures the first two cards of a pair (cards 03 and 04 since #600) |
| Severity | **Sev-3 Moderate** (master's DL-293 (3)): a Test-type defect, fails closed only if both attempts fail, workaround is the retry, and the geometry shows the cards do sit side by side, so no product regression |
| Priority | P3. **Lane (DL-293 (3), (4)(e)):** the next free lane after the DEF-060 fix and #605; it does not displace DEF-059's place after #601 (DL-291 (3)(b)) |
| Type | **Test**, **product not excluded** (if the element that grows has loading and loaded states of different heights, that is a layout shift the UX spec's loading states should prevent, and it comes back to master as a product question, as DEF-059 did) |
| Status | **New** (logged 2026-11-22) |
| Jira / GitHub | [AQP-395](https://sankumar76.atlassian.net/browse/AQP-395) / [#609](https://github.com/sankumar76/Accucut-Quotation/issues/609). Jira "relates to" AQP-388 (CR-01 item 1, #600, which exposed it), AQP-303 (STORY-05.03) and AQP-1 (Intake). **Not linked to RISK-031** (a received value, not a time-out). Labels `ai-delivery`, `aiid-DEF-061`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium. GitHub labels `bug`, `sev-3`, `ai-delivery` |
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

## What decides it (not collected)
- **Test:** two separate reads across a shift. A one-frame read (both boxes in one `evaluate`) after a page signal that the growing element settled removes it.
- **Product:** what grows by 110 px is not named. If it is a product element whose loading and loaded states differ in height, that is a layout-shift question for master.

## Suspected Area
`tests/e2e/estimate-form.spec.ts:74-94` (`waitForForm`, the two `boundingBox()` reads at :78 and :79); the elements above card 03 in the form (cards 01 and 02, the picture slot, the part progress line).

## Binding for the fix (DL-293 (3); developer, test-only, `tests/e2e/estimate-form.spec.ts` only)
1. **First name what grows:** a one-off diagnostic in the PR (the heights of cards 01 and 02 and of the picture slot, read before and after the page settles), with its output in the PR body.
2. Read both boxes in one `evaluate` (one frame), after a wait for a page signal that the growing element has reached its final state, proven by the `src/` line that renders it (DL-240).
3. Every assertion kept; no budget, retry, timeout, skip or fixed sleep.
4. If the grower is a product element whose loading and loaded states differ in height, **stop and come back to master**.
5. **Proof:** attempt-1 pass at tablet and desktop on the PR run of record and on the next `master` push.

## Re-run rule
None. Never re-run.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-395, #609 |
| Diagnostic (what grows) | developer | | one-off diagnostic output in the PR body |
| Fixed | developer | | `fix/AQP-395-<slug>`, `tests/e2e/estimate-form.spec.ts` only |
| Regression test added | developer | | the one-frame read after the settle signal; every assertion kept |
| Verified | qa-engineer | | attempt-1 pass at tablet and desktop on the PR run of record and on the next `master` push |
