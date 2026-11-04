# DEF-011: shell E2E clicks "Open menu" before the page has hydrated; the click is lost and the drawer never opens

| Field | Value |
|-------|-------|
| Story / AC | Found at AQP-182 G7 evidence (a). Origin: AQP-28 (`tests/e2e/shell.spec.ts`; `openDrawer` in `tests/e2e/support/design-system.ts`) |
| Severity | Sev-3 Moderate |
| Priority | P2 |
| Type | Test (race) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-04 |
| Build / commit | `db768eb` (PR #57, master merged in) |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1); development server (port 3100) and production build (3101); throwaway Postgres `qa38` with the E2E users |
| Jira / GitHub | [AQP-186](https://sankumar76.atlassian.net/browse/AQP-186) / [#67](https://github.com/sankumar76/Accucut-Quotation/issues/67) |

## Steps to Reproduce
1. `npx playwright test tests/e2e/shell.spec.ts -g "drawer" --repeat-each=15 --retries=0`.

## Expected Result
0 failures: the drawer opens every time "Open menu" is clicked.

## Actual Result
- **Run 1, on a loaded machine:** 3 failures of 181.
- **Run 2, on a quiet machine:** 6 failures of 181.
- **The step:** all 9 failures are the same, `openDrawer`: `getByRole('dialog', { name: 'Menu' })` is not visible after 15 s. The page snapshot shows the "Open menu" button and no dialog.
- **Which tests:** "AC-8: axe finds 0 violations with the drawer open" (6), "QLT-02: choosing a page in the drawer moves focus ..." (2), and once "AC-4: ... no wider than the drawer token", which failed at `openDrawer`, before its width check.

## Evidence
A probe on the mobile project clicked "Open menu" as soon as it was visible, then waited and looked again:

| Probe | Hydrated when clicked | Drawer opened | Hydrated afterwards |
|---|---|---|---|
| No delay (`goto` with `waitUntil: 'commit'`) | false | false | true |
| JavaScript chunks delayed by 4 s | false | false | true |

A click that arrives before React has hydrated the button is lost, and the drawer stays closed even after hydration has finished. `openDrawer` clicks once, straight after `page.goto` (which waits only for the `load` event), with nothing that waits for hydration. On the development server the heavy `/design-system` page often hydrates after `load`.

## Suspected Area
`tests/e2e/support/design-system.ts`, `openDrawer`, and any first click after a `goto` in `tests/e2e/shell.spec.ts`. Wait until the page is interactive before the first click. Two ways:
- a hydration marker the app sets in a client effect;
- the click and the dialog check together inside `expect(async () => { ...click...; await expect(dialog).toBeVisible({ timeout: 2_000 }); }).toPass()`.

Do not raise the timeout and do not rely on the retry.

**Product note** (not part of this fix): a person who taps "Open menu" before hydration also gets nothing. Whether the trigger should look inactive until the page is ready is for the ux-expert or solution-architect.

## Impact
No product change is needed for the tests to be reliable. It hides the DEF-004 evidence: one of the 60 width checks in AQP-182 G7 (a) could not run. It makes the drawer suite fail locally about once in 30 to 60 tests.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
