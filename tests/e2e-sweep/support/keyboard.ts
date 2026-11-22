import { expect, type Locator, type Page } from '@playwright/test';

/**
 * What the keyboard-only flows share (STORY-10.08 AC-4, NFR-018): moving by the keyboard to a control, and the two checks made at every step, that the focus is visible and that the
 * focused control is not behind the sticky action bar. Nothing here uses the mouse: the keys go through `page.keyboard`. This file has no tests and its name does not end in `.spec.ts`.
 */

/** How many presses of Tab are allowed to reach a control before the flow says it cannot be reached. The longest list a flow crosses is the Process master's. */
const MAX_PRESSES = 400;

/** The ancestors of the focused element that are also asked for a focus indicator: a field in a bordered wrapper shows the ring on the wrapper (`focus-within`). */
const WRAPPER_LEVELS = 3;

interface FocusState {
  readonly focused: boolean;
  readonly what: string;
  readonly indicated: boolean;
}

/** What has focus now, and whether it (or a wrapper within a few levels) draws an outline or a ring. `focused` is false when nothing but the page itself has focus. */
async function focusState(page: Page): Promise<FocusState> {
  return page.evaluate((levels) => {
    const element = document.activeElement;
    if (element === null || element === document.body) return { focused: false, what: 'nothing', indicated: false };
    const draws = (candidate: Element): boolean => {
      const style = getComputedStyle(candidate);
      const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      return outline || style.boxShadow !== 'none';
    };
    let indicated = element.matches(':focus-visible') && draws(element);
    let wrapper = element.parentElement;
    for (let level = 0; !indicated && level < levels && wrapper !== null && wrapper !== document.body; level += 1) {
      indicated = draws(wrapper);
      wrapper = wrapper.parentElement;
    }
    const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '';
    return { focused: true, what: `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`} "${label}"`, indicated };
  }, WRAPPER_LEVELS);
}

/** AC-4: "at every step focus is visible". The element that has focus matches `:focus-visible`, and it or a wrapper within a few levels draws an outline or a ring. */
export async function expectFocusVisible(page: Page, where: string): Promise<void> {
  const state = await focusState(page);
  expect(state.focused, `something has focus ${where}`).toBe(true);
  expect(state.indicated, `the focus of ${state.what} is visible ${where}`).toBe(true);
}

async function hasFocus(target: Locator): Promise<boolean> {
  return target.evaluateAll((elements) => elements.some((element) => element === document.activeElement));
}

/**
 * Presses `key` (Tab or Shift+Tab) until `target` has focus, checking the focus indicator after every press. The target must name one element.
 * Fails after `MAX_PRESSES` presses, with the name of what was being looked for.
 */
export async function pressUntilFocused(page: Page, key: 'Tab' | 'Shift+Tab', target: Locator, what: string): Promise<void> {
  let wraps = 0;
  for (let press = 1; press <= MAX_PRESSES; press += 1) {
    await page.keyboard.press(key);
    const state = await focusState(page);
    if (!state.focused) {
      // Past the last control (or before the first) the browser hands focus back to the page for one press. A second press with nothing focused is a gap in the tab order.
      wraps += 1;
      expect(wraps, `focus was lost after ${key} number ${press} on the way to ${what}`).toBeLessThanOrEqual(1);
      continue;
    }
    wraps = 0;
    expect(state.indicated, `the focus of ${state.what} is visible after ${key} number ${press} on the way to ${what}`).toBe(true);
    if (await hasFocus(target)) return;
  }
  throw new Error(`${what} did not get focus within ${MAX_PRESSES} presses of ${key}.`);
}

/**
 * UX-14: the control that has focus is fully visible above the sticky action bar. Its box must be inside the window and end above the top of the bar, unless it is in the bar.
 * `where` names the step, so a failure says which field it was.
 */
export async function expectClearOfBar(page: Page, bar: Locator, where: string): Promise<void> {
  const barBox = await bar.boundingBox();
  expect(barBox, `the action bar is on the page ${where}`).not.toBeNull();
  const inBar = await bar.evaluate((element) => element.contains(document.activeElement));
  if (inBar || barBox === null) return;
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return null;
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, name: `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`}` };
  });
  expect(focused, `something has focus ${where}`).not.toBeNull();
  if (focused === null) return;
  expect(focused.top, `${focused.name} starts inside the window ${where}`).toBeGreaterThanOrEqual(0);
  expect(focused.bottom, `${focused.name} ends above the action bar (bar top ${barBox.y.toFixed(1)}) ${where}`).toBeLessThanOrEqual(barBox.y + 0.5);
}
