# DEF-127: the "+" menu items of #742 (AQP-449) fail axe `label-content-name-mismatch` (WCAG 2.5.3, Level A): the `aria-label` did not contain the visible hint text; on `master` from 6085f71e until #777 (Product; Sev-2; Jira AQP-484, GitHub #783; CLOSED 2026-11-26)

| Field | Value |
|-------|-------|
| Story / AC | AQP-449 (DEF-092, PR #742): the "+" menu items name the kind ("Part" or "Sub-part") and carry a hint; NFR-018 (WCAG 2.2 AA; Level A criteria are included); AQP-405 and the SCR-05 "+" menu. The fix is PR #777 (AQP-451, DEF-094). |
| Severity | **Sev-2 (master, DL-419 (4), DL-094):** a WCAG 2.2 failure on a delivered screen. WCAG 2.5.3 Label in Name is Level A, which NFR-018's AA target includes. |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`) |
| Type | **Product** (accessibility regression brought in by #742) |
| Status | **CLOSED (Verified, Closed), 2026-11-26 (qa-engineer).** Fixed by #777 (squash `bb8656dc`). Proof: PR run 45785936137 (fully green; `estimate-tree-plus-menu.spec.ts:64`, axe with the menu open, passed at [mobile], [tablet] and [desktop]) and the `master` push run of `bb8656dc` (CI 45795446420, run attempt 1, created 09:48:50Z, `success` at 10:20:47Z; Windows package 45795446363 `success`): shards 1 to 4 `577 passed (22.3m)`, `576 passed (16.6m)`, `589 passed (14.5m)`, `572 passed (12.8m)`, 0 failed, 0 flaky, no `✘`; the same case read 20.6 s [mobile], 17.9 s [tablet], 14.4 s [desktop] on attempt 1 and passed. It lived on `master` from `6085f71e` (07:55Z) to `bb8656dc`. |
| Jira / GitHub | [AQP-484](https://sankumar76.atlassian.net/browse/AQP-484) / [#783](https://github.com/sankumar76/Accucut-Quotation/issues/783) (labels bug, sev-2, ai-delivery, final-review; Jira also aiid-DEF-127, agent-qa-engineer). Relates to AQP-449, AQP-451 and AQP-1. Searched first: JQL on `aiid-DEF-127` and 'label-content-name-mismatch', and a GitHub search: nothing earlier. |
| Found by / date | #777's E2E (lane 3), which runs axe with the "+" menu open at three widths; read by master (DL-419 (1)) and logged by qa-engineer, 2026-11-26. No earlier case ran axe with the menu open, so #742's own CI was green. |
| Build / commit | `master` `6085f71e` (#742's squash). Fixed in `bb8656dc` (#777, head `3a42b83a`). |
| Environment | CI, `Stage 12: E2E`, Playwright Chromium, three widths (mobile, tablet, desktop), production build, axe through the shared helper (`expectNoAxeViolations`). |

## Steps to Reproduce
1. On `6085f71e`, open an estimate as an Engineer (a Main Assembly or Sub-Assembly row) and press its "+" button.
2. Run axe on the page with the menu open.

## Expected Result
No axe violation with the menu open. Each menu item's accessible name contains its visible text (WCAG 2.5.3).

## Actual Result
axe `label-content-name-mismatch` (serious) on the menu items: AQP-449's `aria-label` did not contain the visible hint (as read by master from #777's run, DL-419 (1)). QA did not run the page; the figures are from master's read of #777's run and the PR body.

## Evidence
- PR #777 (head `3a42b83a`, 0 behind `6085f71e`), run 45785936137 (`pull_request`): fully green, 0 flaky; shards `576 / 572 / 589 / 577` passed. `tests/e2e/estimate-tree-plus-menu.spec.ts:64` (the "+" menu case, which runs `expectNoAxeViolations(page)` with the menu open, spec line 51) passed at `[mobile]`, `[tablet]` and `[desktop]` (QA read the three lines in the shard logs).
- The fix, per master's read of the diff: the item's name is the visible name span with no `aria-label`; the hint is `aria-hidden`; the item is described by it (`aria-describedby`). `src/components/ui/dropdown-menu.tsx` gains an optional `container` prop (default unchanged); `tests/support/menu-panel.ts` is new and unit-only.
- Lesson recorded by master (DL-419 (4)): every PR that changes an overlay (a menu, a dialog or a popover) runs axe with it open, at three widths.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity) | master | 2026-11-26 | DL-419 (4): Sev-2, Product |
| Fixed | developer | 2026-11-26 | PR #777, squash `bb8656dc` (AQP-451, DEF-094) |
| Regression test | developer | 2026-11-26 | `estimate-tree-plus-menu.spec.ts:64` (axe with the menu open, three widths) |
| Verified | qa-engineer | 2026-11-26 | PR run 45785936137: three widths pass; `master` push run 45795446420 (bb8656dc): all jobs success, 0 flaky, 0 failed; the case passes at three widths |

## Records
Jira Bug AQP-484 and GitHub issue #783, created 2026-11-26 and cross-linked. Related: AQP-449 (#742), AQP-451 (#777, DEF-094), DEF-092, DEF-094; DL-094, DL-419; test plan 0.3.70.
