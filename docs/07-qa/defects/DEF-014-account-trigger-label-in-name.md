# DEF-014: The account trigger's accessible name does not contain its visible text (WCAG 2.5.3 Label in Name); the E2E axe tags omit `wcag21a`

| Field | Value |
|-------|-------|
| Story / AC | Found in STORY-01.02 (AQP-48) G7. Origin: the portal frame's account trigger (AQP-38 / AQP-188). NFR-018 |
| Jira / GitHub | [AQP-198](https://sankumar76.atlassian.net/browse/AQP-198) / [#82](https://github.com/sankumar76/Accucut-Quotation/issues/82) |
| Severity | **Sev-2 Major** (master's ruling at AQP-48 G7, DL-094; raised from Sev-3) |
| Priority | P2 |
| Type | Product (accessibility) + Test (tag set) |
| Status | Open |
| Found by / date | qa-engineer, 2026-11-05 |
| Build / commit | `561f48e` (PR #79). `src/components/shared/account-trigger.tsx` is not changed by that PR |
| Environment | Production build (`next start`), Chromium (Playwright 1.64.1), @axe-core/playwright; invented users |

## Steps to Reproduce
1. Sign in as the invented Lead and open any portal page with the top bar, for example `/queue`.
2. Run axe with `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']`.
3. Repeat at 360 px and at 1366 px.

## Expected Result
0 violations. WCAG 2.2 AA includes 2.5.3 Label in Name (Level A): a control's accessible name contains its visible label.

## Actual Result
`label-content-name-mismatch` (serious; tags `wcag21a`, `wcag253`) on `button[aria-label^="Account menu"]`:
- **Accessible name:** "Account menu, E2E Lead, Lead".
- **Visible text:** "EL E2E Lead Lead" at 1366 px, and only "EL" (the initials) at 360 px.

The project's `AXE_TAGS` (`tests/e2e/support/design-system.ts`) is `['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']`. It leaves out `wcag21a`, so no WCAG 2.1 Level A rule runs in the suite, and with those tags the same page shows 0 violations.

## Evidence
QA probe output (scratch, not committed), on the "no access" page at 360 px:
```
/queue tags=wcag2a,wcag2aa,wcag21aa,wcag22aa: 0 violation(s)
/queue tags=wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa: 1 violation(s)
  label-content-name-mismatch [cat.semantics,wcag21a,wcag253,…] impact=serious
    target=[".px-s-2"] html=<button type="button" aria-label="Account menu, E2E Le…" … data-early-intent="account" aria-haspopup="menu" aria-expanded="false">
```

## Suspected Area (optional)
- `account-trigger.tsx`: the `aria-label` and the visible initials.
- `tests/e2e/support/design-system.ts`: `AXE_TAGS`.

The ux-expert decides the accessible name. One option is to let the name begin with the visible text; another is to treat the initials as a decorative avatar.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
