import AxeBuilder from '@axe-core/playwright';
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

/**
 * Shared by the two /design-system specs (`design-system.spec.ts`: the page; `shell.spec.ts`: the page frame).
 * This file has no tests, and its name does not end in `.spec.ts`, so Playwright does not run it by itself.
 */

export const PAGE = '/design-system';
export const HOME = '/';
export const TABLET_MIN_WIDTH = 768;
export const TOUCH_TARGET = 44;
export const ROW_TARGET = 36;
/** Width at which the page must still reflow without sideways scroll (WCAG 1.4.10; 200 percent zoom of 640 px). */
export const REFLOW_WIDTH = 320;
export const REFLOW_HEIGHT = 640;
/** Tab presses that must stay inside the open drawer (it holds the menu links and the close button). */
export const DRAWER_TAB_PRESSES = 6;
/** Shift+Tab presses from the bottom of the page, each checked against the sticky top bar. */
export const FOCUS_SCAN_PRESSES = 14;

/**
 * The rules every scan in the suite uses (NFR-016 to 018: WCAG 2.0, 2.1 and 2.2, levels A and AA). `wcag21a` is the WCAG 2.1
 * Level A rules; without it no 2.1 Level A rule ran, which hid the Label in Name failure of DEF-014.
 */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The desktop project is the only one at 1024 px or wider (playwright.config.ts). */
export const isDesktopProject = (projectName: string): boolean => projectName === 'desktop';

export async function widthOf(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** A CSS custom property resolved to the colour the browser paints, so a token is compared with what is drawn. */
export async function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, token);
}

/** The platform fonts the browser really used to draw the text of an element (not the declared stack). */
export async function platformFonts(page: Page, target: Locator): Promise<Array<{ familyName: string; isCustomFont: boolean }>> {
  await page.evaluate(() => document.fonts.ready);
  await target.evaluate((element) => element.setAttribute('data-probe', 'font'));
  const session: CDPSession = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-probe="font"]' });
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  await target.evaluate((element) => element.removeAttribute('data-probe'));
  return fonts;
}

/**
 * Waits until no finite animation or transition is running in the document (DEF-009). A colour that is half way
 * through a CSS transition is a blend of two colours, and axe reads that blend as the colour of the text: the
 * "Sign in" button caught while it faded from the loading grey back to red was reported as a contrast failure that
 * the page does not have at rest. There is no retry and no timeout of its own: it waits for the browser's own
 * `Animation.finished`, and the test's timeout is the only limit.
 *
 * Animations that never end (a spinner, a skeleton's shimmer: `infinite`) and paused ones are left out, because
 * waiting for them would wait for ever; they do not change the colour of text from one moment to the next in a way
 * that makes a scan wrong, and the reduced-motion tests cover them. New animations that start while it waits (one
 * transition setting off another) are waited for too.
 */
export async function waitForAnimationsToFinish(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const endsByItself = (animation: Animation): boolean => {
      const end = animation.effect?.getComputedTiming().endTime;
      return end !== undefined && Number.isFinite(Number(end));
    };
    const isActive = (animation: Animation): boolean => animation.playState === 'running' || animation.pending;
    for (;;) {
      const active = document.getAnimations().filter((animation) => isActive(animation) && endsByItself(animation));
      if (active.length === 0) return;
      // A cancelled animation rejects `finished`; that also means it is no longer running.
      await Promise.allSettled(active.map((animation) => animation.finished));
    }
  });
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // A named step, so a timeout in a test report says it was waiting for animations and not scanning (QLT-40).
  await test.step('wait for animations and transitions to finish before the axe scan', () => waitForAnimationsToFinish(page));
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    // What the rule compared the node with (the elements that overlap it or sit too close), so a failure says which neighbour it was.
    neighbours: violation.nodes.flatMap((node) => node.any.flatMap((check) => (check.relatedNodes ?? []).map((related) => related.target.join(' ')))).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

/** The menu button of the top bar; the page frame names it the same way at every width below 1024 px. */
const OPEN_MENU_BUTTON = 'button[aria-label="Open menu"]';

/**
 * Waits until React has hydrated the element that `selector` names (DEF-011). The server sends the button as plain
 * HTML and `goto` returns at the `load` event, which can come before React has attached its handlers: a click made
 * in that gap is lost, with no error (the AQP-182 G7 probe: `hydratedAtClick=false`, `opened=false`). React gives every
 * DOM node it has hydrated a `__reactProps$...` property that holds the props it was rendered with, so the signal is that
 * the node has one and its `onClick` is a function. That is the state the click needs; no sleep, no retry, no timeout of
 * its own (the test's timeout is the only limit).
 *
 * `handler` is the prop the interaction needs: `onClick` for a button, `onPointerDown` for a Radix menu trigger (it
 * opens on pointer down, not on click), `onSubmit` for a form.
 *
 * The element is looked up again on each check, so a node that React replaced is found, not a stale one.
 *
 * DEPENDENCY ON A REACT INTERNAL (QLT-50): the `__reactProps$` property name is React's own private bookkeeping, not
 * public API. A React upgrade that renames it makes this wait never become true, so the tests that use it time out
 * loudly instead of passing wrongly, and the late-scripts test in `shell.spec.ts` (which needs the wait to pass)
 * names the cause. Re-check the prefix when React is upgraded; the public alternative would be a hydration marker in the
 * product, which the architect decides under DEF-013.
 */
export async function waitUntilHydrated(page: Page, selector: string, handler = 'onClick'): Promise<void> {
  await page.waitForFunction(
    ({ css, prop }) => {
      const element = document.querySelector(css);
      if (element === null) return false;
      const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
      if (propsKey === undefined) return false;
      const props: unknown = Reflect.get(element, propsKey);
      return typeof props === 'object' && props !== null && typeof Reflect.get(props, prop) === 'function';
    },
    { css: selector, prop: handler },
  );
}

/**
 * The account trigger of the top bar is a plain button until its first open (AQP-188), so its click handler is the one that
 * must be there. (Once the menu has loaded, the Radix trigger opens on pointer down; a test that opens the menu again does
 * not need this wait.)
 */
export async function waitUntilAccountMenuIsLive(page: Page): Promise<void> {
  await waitUntilHydrated(page, 'button[aria-label^="Account menu"]', 'onClick');
}

/** Waits for the menu button to be live (see `waitUntilHydrated`), for a test that reaches it by keyboard. */
export async function waitUntilMenuButtonIsLive(page: Page): Promise<void> {
  await waitUntilHydrated(page, OPEN_MENU_BUTTON);
}

export async function openDrawer(page: Page): Promise<Locator> {
  await waitUntilMenuButtonIsLive(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await expect(drawer).toBeVisible();
  return drawer;
}
