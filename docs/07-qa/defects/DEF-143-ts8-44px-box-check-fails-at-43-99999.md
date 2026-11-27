# DEF-143: estimate-tree-names.spec.ts:267 [mobile] TS-8's 44 px box check failed at 43.99999237 (44 minus 2^-17): a test precision fault (Test; Sev-4; Jira AQP-500, GitHub #828)

| Field | Value |
|-------|-------|
| Story / AC | AQP-490 (#812, the PR that carried TS-1 and TS-8); DEF-129 (closed; its reopen watch was triggered by this failure); RISK-031; NFR-017 (touch targets of 44 px) |
| Severity | **Sev-4 (master, DL-458 (D)); not a G8 blocker; due by the end of Wed 2 Dec 2026 (before the freeze), because each such flake breaks RISK-031's count** |
| Priority | P4 (Jira Low; labels `sev-4`, `test`) |
| Type | **Test** (a test precision fault) |
| Status | **Open, 2026-11-27 (qa-engineer, DL-458).** Fix: lane 1, a small test-only PR, merged on a fully green run at 0 behind. |
| Jira / GitHub | [AQP-500](https://sankumar76.atlassian.net/browse/AQP-500) / [#828](https://github.com/sankumar76/Accucut-Quotation/issues/828) (labels bug, sev-4, ai-delivery; Jira also aiid-DEF-143, agent-qa-engineer, test); linked 'relates to' AQP-490; RISK-031 named in the body. Searched first: JQL on `aiid-DEF-143` and the width: nothing earlier. |
| Found by / date | qa-engineer, 2026-11-27, on `master` push `864ecb0f` (test plan 0.3.130); ruled by master in DL-458 (records-u 8cac8b0e) |
| Build / commit | `master` `864ecb0f` (CI 45967524633), `Stage 12: E2E (shard 1 of 4)`, [mobile], draw 0.99 |
| Environment | CI, `next dev`, the `mobile` project (360 x 800, no device scale factor) |

## What happened
`estimate-tree-names.spec.ts:267` [mobile] (TS-1 to TS-6 and TS-8, the movement case) failed attempt 1 and passed on retry. The failing line is TS-8's finger branch (spec line 401): `expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)` on a button of row 1.2's toolbar: **expected >= 44, received 43.99999237060547** (44 minus 2^-17, 7.6e-6 px under). No row moved; TS-1's band, box and hit assertions passed; 0 'intercepts pointer events' lines. DL-456's reopen watch trigger (c) was met as written and **DEF-129 does not reopen (DL-458 (A))**.

## Cause (master's read at `864ecb0f`, DL-458 (1))
On touch the toolbar buttons are `size="icon"` = `h-(--control-h) w-(--control-h)` with `--control-h: 44px` (`button.tsx:38`, `globals.css:42`); the 36 px `ROW_ACTION_SIZE` applies only to `fine-wide:`; they sit in a `flex w-fit` row (`row-actions.tsx:66`); the `mobile` project is 360 x 800 with no device scale factor (`playwright.config.ts:84-88`). 44 px is declared exactly; 44 minus 2^-17 is the kind of value a fractional transform during the drawer's open animation (the case taps, then reopens the drawer) or a float conversion yields; it is far below Chromium's layout unit of 1/64 px, so it cannot be a real undersized layout. A flex shrink in the narrow drawer is the one product reading still open; the computed-size check below settles it.

## Fix (authorised, DL-458 (3); lane 1; test only; `estimate-tree-names.spec.ts` TS-8)
(i) each 44 px box check compares against **44 minus 1/64** (one layout unit, 0.015625 px), with a message naming the row, the button's name and its box; (ii) an **immediate check (no polling) that each button's computed `width` and `height` (`getComputedStyle`) are 44 px or more** (the declared size, independent of any transform, so a real undersized target still fails, and fails exactly); (iii) no wait, retry, budget or time-out change, and no assertion removed (DL-404, DL-441 (1)(d)). A tolerance of one layout unit cannot hide a real target smaller than 44 px, because layout cannot produce one closer than 1/64 px. The same tolerance may be used in any other 44 px box check a lane touches for its own reasons, always paired with (ii); no sweep (section 9 (4)). Merged on a fully green run at 0 behind by the end of Wed 2 Dec.

## Product-only clause (DL-458 (4))
**If the computed-size check (ii) ever reads under 44 px on any run, the buttons are being shrunk by their flex row: a Sev-3 Product defect against NFR-017** (the toolbar buttons get `shrink-0` or equivalent), and it comes to master the same day. The ux-expert is not needed unless that happens. QA reads the check's message on every `master` push and PR run of record.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Test-only fix PR | developer (lane 1) | | |
| Verified: TS-8 at attempt 1 on two `master` pushes, the computed-size check present | qa-engineer | | |

## Records
Jira Bug AQP-500 and GitHub issue #828, created 2026-11-27 and cross-linked. DL-456, DL-458; test plan 0.3.131.
