# DEF-086: Nightly sweep `keyboard-flows.spec.ts:112` [chromium-1366] fails on both attempts: the focus of the "Resize parts tree" separator is not visible by the sweep's rule (the 3 px ring is drawn on a child pill, not on the focused element or one of its three nearest ancestors) (Product; Sev-3; Jira AQP-442, GitHub #726)

| Field | Value |
|-------|-------|
| Story / AC | AQP-426 (STORY-CR01.3E, the resizable parts tree, PR #721) AC-9 (the pill and ring) and its neighbours AC-2 and AC-10; the failing check is the sweep's AC-4 'five flows by keyboard alone' (NFR-016, NFR-018, NFR-019). **WCAG 2.2 SC 2.4.7 is met in substance by master's reading** (a 3 px ring is drawn), so this is not an AA failure. |
| Severity | **Sev-3 Moderate (master, DL-389 (3)), type Product.** The failure is the project's stricter sweep rule (focus drawn by the element or a near ancestor), not an AA violation, so DL-094's Sev-2 does not apply (DL-358 (1): name the right criterion). The revert removes it from `master`. |
| Priority | P3 (Jira Medium, label `sev-3`) |
| Type | **Product** (placement of the focus indicator) |
| Status | **Open (new), 2026-11-25 (qa-engineer, on master's DL-389 (3)).** If the revert (PR #724) has not squashed before tonight's Nightly, that red is this Bug, not a new item. It **binds the re-land** (below). |
| Jira / GitHub | [AQP-442](https://sankumar76.atlassian.net/browse/AQP-442) / [#726](https://github.com/sankumar76/Accucut-Quotation/issues/726) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-086, agent-qa-engineer). Relates to AQP-426 and AQP-1; DEF-085 (AQP-441) is the neighbour but a different symptom, cause and check. Searched first: JQL on `aiid-DEF-086` and 'Resize parts tree', and a GitHub search: nothing. |
| Found by / date | CI (Nightly sweep); read and logged by qa-engineer, 2026-11-25; classified by master, DL-389 |
| Build / commit | PR #723's head `0499e355` (branch `fix/AQP-1-std-c-04-tls-front-loopback`), which holds #721 (squash `0c201e65`) |
| Environment | GitHub-hosted runner, workflow Nightly, `pull_request` event, run 45569109316 (created 07:33:48Z), job 139051091918 'Sweep, keyboard flows and browsers (NFR-016, NFR-018, NFR-019)', Playwright project `chromium-1366` |

## Steps to Reproduce
1. On a build that holds #721, run the sweep project `chromium-1366` (`tests/e2e-sweep/keyboard-flows.spec.ts`).
2. Case (2): an Engineer opens the part form and goes through it with Tab; the sweep presses Tab until the target (Part No.) has focus and checks, after each press, that the focus is visible (`tests/e2e-sweep/support/keyboard.ts:68`).
3. At Tab number 16 the focus is on the "Resize parts tree" separator.

## Expected Result
The focus of every element reached by Tab is visible by the sweep's rule: the focused element, or one of its three nearest ancestors, draws the outline.

## Actual Result
`Error: the focus of div "Resize parts tree" is visible after Tab number 16 on the way to Part No.` `expect(state.indicated).toBe(true)`: Expected true, Received false (`keyboard.ts:68`, called from `keyboard-flows.spec.ts:114`). Both attempts (test no. 84 and the retry no. 92) fail alike. `1 failed, 174 passed (1.7m)`: every other keyboard flow passes, and the same case at [chromium-360] passes (the separator does not exist at 360 px).

## Evidence (job log, ANSI stripped; no secrets or personal data)
- Run 45569109316: jobs 'Lighthouse reference run', 'Warm the Playwright cache' and 'Capacity and latency (NFR-010, NFR-011)' `success`; **'Sweep, keyboard flows and browsers' `failure`** (this Bug); **'CI feedback time' `failure`** at its step 'CI feedback time of the required job (p95 at most 10 minutes, median at most 6)' (a different check; QA has not read it further and files nothing for it).
- Master's reading of the cause (DL-389 (1)): #721 made the `role="separator"` focusable and drew the ring on a child pill; the sweep's rule needs the focused element or one of its three nearest ancestors to draw it.

## Suspected Area (leads, not findings)
`src/components/features/estimate-workspace/` (the separator and its pill, from #721) and `tests/e2e-sweep/support/keyboard.ts` (the rule). The sweep's rule is not changed: the fix is in the component.

## Binding and proof (master, DL-389 (4) (a); QA reads it)
1. **The re-land:** the focusable `role="separator"` is the 24 x 48 px box that draws the 3 px ring itself; the full-height hit area (24 px with a mouse, 44 px with a coarse pointer) is a wrapper with the pointer handlers that cannot take focus. This changes AC-9's words (the pill and ring) and touches AC-2 and AC-10. The ux-expert confirms the look in writing and the product-owner amends AC-9 (and AC-2 or AC-10 if their words change) before the PR is ready. The target size (SC 2.5.8, NFR-017) is measured on the wrapper the pointer uses.
2. **Closes** when the re-land's `keyboard-flows.spec.ts` passes at [chromium-1366] **and** the first Nightly after its squash is green.
3. No change to the sweep's rule or support files to make it pass (the standing Test-Bug binding in spirit; this is a Product Bug).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| #721 reverted (PR #724) | orchestrator | | |
| Re-land with the focus ring on the focusable box | developer | | |
| ux-expert's written confirmation; AC-9 amended | ux-expert, product-owner | | |
| Proof: the re-land's sweep `keyboard-flows.spec.ts` passes at [chromium-1366] | qa-engineer | | |
| Proof: first Nightly after the squash is green | qa-engineer | | |
| Closed | qa-engineer | | |

## Records
Jira Bug AQP-442 and GitHub issue #726, created 2026-11-25 and cross-linked. Related: AQP-426, AQP-1, DEF-085 (AQP-441); #721, #723, #724; DL-389 (master's ruling), DL-388, DL-358 (1), DL-094; test plan 0.3.58; Nightly run 45569109316, job 139051091918.
