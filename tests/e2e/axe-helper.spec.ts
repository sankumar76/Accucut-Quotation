import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { AXE_TAGS, expectNoAxeViolations, waitForAnimationsToFinish } from './support/design-system';

/**
 * DEF-009: the shared accessibility helper waits for CSS transitions to finish before axe scans. These tests use a
 * page made in the browser (`setContent`), so they need no server and no sign-in, and they do not depend on any
 * product page.
 *
 * The transition uses `steps(1, jump-end)`: the value stays at the START colour for the whole duration and jumps to
 * the end colour at the end. A scan made while the transition runs therefore always reads the start colour, so the
 * outcome does not depend on how fast the machine is, only on whether the scan waited. A slow machine can make the
 * test "pass without the wait" (the scan starts after the 2 seconds), never fail with it.
 *
 * The page is not responsive and the colours and timing do not change with width, so every test here is tagged
 * `@one-width` and runs in the desktop project only (test strategy section 10.5, AQP-199).
 */

const TRANSITION_MILLISECONDS = 2_000;
const POOR_CONTRAST = '#cccccc';
const GOOD_CONTRAST = '#000000';

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Transition probe</title>
  <style>
    body { background: #ffffff; }
    button { background: #ffffff; color: ${POOR_CONTRAST}; font: 16px sans-serif; transition: color ${TRANSITION_MILLISECONDS}ms steps(1, jump-end); }
    button.settled { color: ${GOOD_CONTRAST}; }
    .spinner { width: 16px; height: 16px; background: ${GOOD_CONTRAST}; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main>
    <h1>Probe</h1>
    <button id="probe" type="button">Sign in</button>
    <div class="spinner" role="img" aria-label="Loading"></div>
  </main>
</body>
</html>`;

/**
 * Starts the transition and returns the colour the button has at that instant, read in the same browser step that
 * starts it, so no time passes between the two (QLT-39): a slow machine cannot let the 2 seconds run out in between.
 */
async function startTransition(page: Page): Promise<string> {
  await page.setContent(PAGE);
  return page.evaluate(() => {
    const button = document.getElementById('probe');
    if (button === null) throw new Error('The probe button is missing.');
    // Read the style first so the start colour is committed, then change it: the transition starts now.
    void getComputedStyle(button).color;
    button.classList.add('settled');
    return getComputedStyle(button).color;
  });
}

const colourOfProbe = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.getElementById('probe') ?? document.body).color);

test('DEF-009: the wait returns only after a running transition has reached its end value', { tag: '@one-width' }, async ({ page }) => {
  const colourAtStart = await startTransition(page);
  expect(colourAtStart).toBe('rgb(204, 204, 204)');
  await test.step('wait for the transition to finish', () => waitForAnimationsToFinish(page));
  expect(await colourOfProbe(page)).toBe('rgb(0, 0, 0)');
});

test('DEF-009: the wait does not wait for an animation that never ends, such as a spinner', { tag: '@one-width' }, async ({ page }) => {
  await startTransition(page);
  await waitForAnimationsToFinish(page);
  const spinnersStillRunning = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === 'running' && !Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).length,
  );
  expect(spinnersStillRunning).toBe(1);
});

test('DEF-009: the wait returns at once when nothing is animating', { tag: '@one-width' }, async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>Still</title></head><body><main><h1>Still</h1></main></body></html>');
  await waitForAnimationsToFinish(page);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('DEF-009: the shared axe helper scans after the transition, so the settled colours are judged, not the blend', { tag: '@one-width' }, async ({ page }) => {
  await startTransition(page);
  // Without the wait this scan reads the start colour (grey on white, contrast 1.6) and reports color-contrast.
  await expectNoAxeViolations(page);
});

test('DEF-009 (control): a scan that does not wait does see the start colour, so the test above can fail', { tag: '@one-width' }, async ({ page }) => {
  await startTransition(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  // Meaningful only if the transition is still running when the scan ends; on a machine so slow that the 2 seconds
  // passed first, there is nothing to compare, which is not a fault.
  const stillRunning = await page.evaluate(() =>
    document
      .getAnimations()
      .some((animation) => animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))),
  );
  test.skip(!stillRunning, 'The transition ended before the scan finished; nothing to compare.');
  expect(results.violations.map((violation) => violation.id)).toContain('color-contrast');
});
