# DEF-145: late layout shift above the Lead's action block: PartForm's skeleton is replaced after hydration by the full form, moving Recalculate and Approve down by up to about 900 px (Product, layout stability; Sev-3; Jira AQP-502, GitHub #832)

| Field | Value |
|-------|-------|
| Story / AC | #800 (AQP-488, DEF-131 stage 1: introduced the skeleton-then-form swap on the Lead's page); #827 (AQP-498, DEF-141 step 1: moved the swap into the window where a person acts); the Lead's review page `/estimates/[code]`; `rates-changed.spec.ts:263`; RISK-031 (trigger (b) counts the failure as time-out mode) |
| Severity | **Sev-3 (master, DL-465 (A)); not a G8 blocker; not a WCAG 2.4.3 failure** |
| Priority | P3 (Jira Medium; labels `sev-3`, `layout-stability`, `final-review`) |
| Type | **Product (layout stability)** |
| Status | **Open, 2026-11-27 (qa-engineer, DL-465).** Fix: lane 2, test-first, its own small PR from `master`; the ux-expert sets the placeholder's shape by the end of Sat 28 Nov; **due by the end of Wed 2 Dec 2026; if it is not merged by the freeze it goes to G8 open, named.** |
| Jira / GitHub | [AQP-502](https://sankumar76.atlassian.net/browse/AQP-502) / [#832](https://github.com/sankumar76/Accucut-Quotation/issues/832) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-145, agent-qa-engineer, layout-stability, final-review); linked 'relates to' AQP-488 and AQP-498; RISK-031 named in the body. Searched first: JQL on `aiid-DEF-145` and 'layout shift': nothing earlier. |
| Found by / date | qa-engineer's first occurrence (`master` push `7aa23c44`, test plan 0.3.139); lane 2's read-only code check (DL-464 (3)); ruled in DL-465 (records-u b959f792) |
| Build / commit | `master` `7aa23c44` (CI 45991786275), `Stage 12: E2E (shard 4 of 4)`, [desktop] |
| Environment | CI, `next dev`; the page code is the same in production |

## What happens
On the Lead's review page, `PartForm` draws **three `h-(--control-h)` skeleton bars (about 120 px)** until its lazy fields chunk arrives (`part-form.tsx:95-101`), then the **full form (8 section cards, several hundred to about 1,000 px)** replaces them. `#review-actions` (Recalculate `#review-calculate`, Approve and the other actions; `review-actions.tsx:241`) is an ordinary block after the two columns, so it moves **down by up to about 900 px after first paint**. Before #827 the swap waited for four browser reads; with server props (#827) the data is there at hydration, so the swap lands as soon as the chunk arrives, in the window where a person acts. A fragment jump made while the skeleton shows lands on the button, and the swap then pushes the button down by the form's height.

## Evidence
`rates-changed.spec.ts:263` [desktop] on `7aa23c44` (19.8 s, attempt 1): `await expect(recalculateButton(page)).toBeInViewport()` (spec line 286) after Enter on the notice's fragment link (`<a href="#review-calculate">`, `rates-changed-notice.tsx:30`) and `toHaveURL(/#review-calculate$/)` passed: `#review-calculate` resolved 33 times with 'viewport ratio 0' for 15 s; the retry passed in 8.0 s (the chunk cached). **Lane 2's read-only code check (DL-464 (3)):** no `scrollIntoView`, `scrollTo`, scroll restoration or overflow-anchor rule, and no `focus()` at hydration (each is on a user action or on a row chosen after first paint, `part-fields.tsx:150` gated by `part-form.tsx:60-64`). #813 changed only the SCR-05 task cards.

## Why Sev-3 (DL-465 (2))
The shift began with #800 and #827 moved it earlier. It moves **Recalculate, Approve and the other actions** by up to about 900 px after first paint: a link that points to them does not hold, and a pointer aimed at one can meet something else. The actions behind them confirm (the approve dialog; step-up for cancel approval and remove price, NFR-004), so no data is lost without a further step. **Not Sev-2** (no irreversible action is one press away); **not Sev-4** (it hits the approval actions and a keyboard path). **WCAG 2.4.3 is not failed** (the focus order is unchanged; a fragment link moves only the starting point). NFR-009 names LCP and TBT, not CLS, so the bar below is **this defect's own fix condition and adds no NFR** (no scope change).

## The fix condition (DL-465 (3))
**After first paint, the top of `#review-actions` moves no more than 8 px when the form replaces its placeholder, on Draft and Prepared at 360, 768 and 1366 px; the same check on the Engineer's workspace (where the same `PartForm` placeholder sits: improved, not regressed); Stage 11b under the 193,500 B ceiling (rendering the form without waiting for its chunk is allowed only if the ceiling holds; 685 B of headroom on `635e7f7a`); and one Lighthouse CLS reading per state on a production build before and after, reported, not gated.** The ux-expert sets the placeholder's form within the design system (for example a skeleton of the form's own structure, one card per section the server knows from the form definition, or a reserved minimum height). **Proof, test-first:** (i) a regression E2E that **delays the fields chunk by a Playwright route** (deterministic, not a wait), measures `#review-actions`' top before and after the swap, and follows the notice link with Enter before the swap and asserts the button in view after it: **red before the fix, green after, at three widths**; (ii) the Engineer's workspace check; (iii) Stage 11b; (iv) the CLS readings. **`rates-changed.spec.ts:263` stays unchanged** (it found a real fault); no wait, budget or time-out change (DL-404). **Review:** reviewer-quality's delta review and the ux-expert's check of the built page against the shape (layout only, no action changed: not section 9 (2)'s combined review).

## Gating (DL-465 (4))
**It does NOT gate #806** (which merges as DL-463 set; the fix PR takes it in by a merge, DL-442). **It GATES #811:** the island is a second insertion; #811 merges after this fix, and its terms gain one more: the move check passes with the island on the page.

## RISK-031 (DL-465 (5))
Unchanged: the `:263` failure stays counted as time-out mode for today's trigger (b) count (1 of 2, DL-464 (2)), because the trigger counts the mode and not the cause.

## Fix & Verification  _(developer (lane 2) / ux-expert / reviewer-quality / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Placeholder's shape set | ux-expert | | |
| Test-first PR (regression E2E red, then green) | developer (lane 2) | | |
| Delta review and the built-page check | reviewer-quality, ux-expert | | |
| Verified: the move check at three widths and the Engineer's workspace, Stage 11b, CLS readings; `rates-changed:263` reads clean on two `master` pushes | qa-engineer | | |

## Records
Jira Bug AQP-502 and GitHub issue #832, created 2026-11-27 and cross-linked (Jira linked to AQP-488 and AQP-498). DL-464 (3), DL-465; test plan 0.3.141. Related: DEF-141 (closed), follow-up #831 (the deferred mount after G8).
