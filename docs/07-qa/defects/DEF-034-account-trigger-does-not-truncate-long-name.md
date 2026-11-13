# DEF-034: The top-bar account trigger does not truncate a long signed-in name, so every signed-in page scrolls sideways at 768 px and wider (1,021 px at 768, 974 px at 1024, 632 px at 1366)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-275 (DEF-030, PR #334) / no AC of AQP-275 fails. Governing requirement: **NFR-016** (no horizontal page scroll at 768x1024, 1024x768 and 1366x768, "0 failures at the 3 test widths"), FR-085. Code owner: the shared shell (AQP-48 / AQP-188, `account-trigger.tsx`) |
| Severity | **Sev-2 Major**, graded by master in DL-195 (3) **on the NFR-016 clause, not on WCAG 2.2 SC 1.4.10 Reflow**: Reflow is measured at 320 CSS px, where the trigger shows the initials only. Test plan section 6: an AC fails with a workaround (scroll sideways or shorten the name), the clause DL-192 used for AQP-142's AC-8. Likelihood is low (about 60 characters or more at 768 px; 58 fit) and enters RISK-028's P, not the grade (DL-094, DL-135). QA proposed Sev-2 on the WCAG basis; master confirmed Sev-2 on the corrected basis |
| Priority | P2 (Jira AQP-288 High, label `sev-2`). **Blocks G8**; does not hold AQP-275 or any other story |
| Type | Product, **pre-existing; not caused by PR #334** (its 9 files do not include the shell) |
| Status | **New** (fix: a developer PR `fix/AQP-288-<slug>`, "Closes #347", due before G8; it may start now, no dependency on #334) |
| Jira / GitHub | [AQP-288](https://sankumar76.atlassian.net/browse/AQP-288) / [#347](https://github.com/sankumar76/Accucut-Quotation/issues/347); relates to AQP-275 and AQP-289 (DEF-035); class guard: [#348](https://github.com/sankumar76/Accucut-Quotation/issues/348) (RISK-028) |
| Found by / date | qa-engineer, 2026-11-12 (exploration in the Admin-name notice check of DL-183 (6)) |
| Build / commit | M head `e438ed9` of PR #334 (the shell is the same as `master` 3f22672 and 8f66157) |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium, a production build (`next start`) on a throwaway PostgreSQL 17; invented data only |

## Steps to Reproduce
1. Sign in as a person whose name is 120 characters (the longest the Users form accepts), for example the Admin renamed through the Users screen.
2. Open any signed-in page (measured on `/users`) at 768, 1024 or 1366 px.
3. Read `document.documentElement.scrollWidth - clientWidth` and the box of `button[aria-label^="Account menu"]`.

## Expected Result
The name in the trigger ends in an ellipsis inside the top bar (ux-spec SCR-25: "If a long name is cut with an ellipsis on screen, the full name stays in the accessible name"), and the page does not scroll sideways (NFR-016, FR-085).

## Actual Result
The `<button>` is a flex item with no `min-w-0` or maximum width, and so is its wrapper `div.relative`; the name span is `block truncate` (`white-space: nowrap`), so the button is as wide as the whole name.

| Name | 360 px | 768 px | 1024 px | 1366 px |
|---|---|---|---|---|
| 120 characters, no space | page overflow 0 (initials only) | **1,021 px** (trigger 1,637 px wide, right edge 1,789) | **974 px** | **632 px** |
| 58 characters with spaces | 0 | 0 (trigger 517 px) | 0 | 0 |
| 40 characters with spaces | 0 | 0 (trigger 382 px) | 0 | 0 |

With the top bar hidden, the same page has 0 px of overflow, so the top bar is the only source. The accessible name (DEF-014) is unaffected.

## Evidence
- QA's local spec `tests/e2e/aqp-275-qa.spec.ts` (not committed), tests B1 and D1; numbers and method in `docs/07-qa/AQP-275-test-report.md` (PR #334, H2 `7ddb335`, now on `master` as part of `8f66157`), sections "B1" and "Exploratory Testing".
- Code (read by master in DL-195 (3)): `src/components/shared/account-trigger.tsx:35-55`; the wrapper `div` in `account-menu.tsx` and `account-menu-panel.tsx`.

## Suspected Area (optional)
`account-trigger.tsx` (bound the button: `min-w-0` and a maximum width), the wrapper `div` in `account-menu.tsx` and `account-menu-panel.tsx` if needed. `header.tsx` and `features/auth/portal-account-panel.tsx` are in #341 (AQP-81): if the fix needs `header.tsx`, the PR branches after #341 has merged (DL-150 file-set rule).

## Fix & Verification  _(developer / qa-engineer)_
Route and conditions are master's, DL-195 (4):

- **Behaviour:** with the longest name the Users form accepts (120 characters, once with no space and once with spaces), the page overflow is <= 0 at 768, 1024 and 1366 px, for the closed trigger, the Radix trigger after the first open, and with the menu open. The visible name ends in an ellipsis. The open panel's label (name, e-mail, role, `account-menu-panel.tsx:65-69`, no wrap rule) was **not measured by QA**; the developer measures it in the same test, and if it overflows the window it is part of this defect and rides the PR, wrapped per ux-spec 6.0 "Names wrap". The DEF-014 accessible name `Account menu, <initials>, <name>, <role>` keeps the full name, and `account-trigger-name.spec.ts` stays green.
- **Tests:** extend `tests/e2e/account-trigger-name.spec.ts` rather than adding a file. Use a user created by the test and sign in as that user; never rename the shared E2E user (the DEF-022 / DEF-027 race class). Name every new title and give the count.
- **Review and control:** reviewer-quality runs one plant on a throwaway PR based on the fix head (closed unmerged, anchor-once script, diff printed): the bounding classes removed; the new cases go red at 768 and 1366 px and nothing else does. The developer does not run the plant. reviewer-standards reviews the rest. No performance review (no data path).
- **QA G7:** 768, 1024, 1366 and 1920 px, closed and open, plus 360 px for no change; axe at three widths, the label-in-name rule, and the regression by name.

| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Severity history and routing

- QA proposed Sev-2 on 2026-11-12 (Jira AQP-288, GitHub #347), reasoning from WCAG 2.2 SC 1.4.10 and the DEF-030 precedent.
- Master confirmed **Sev-2** in DL-195 (3) on the **NFR-016** clause and corrected the basis (Reflow is measured at 320 CSS px, where only the initials show). It does not hold AQP-275, it blocks G8, and other stories are not held. Sev-1 and Sev-2 are not accepted in writing.
- RISK-028's trigger fired on this defect (the third of the class after DEF-030 and DEF-031): P 3 to 4, score 8; the guard is tracked in #348 (DL-195 (5)).
- Jira AQP-288 priority is High with label `sev-2`; GitHub #347 carries `sev-2`.
