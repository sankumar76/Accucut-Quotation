import { expect, type Locator, type Page } from '@playwright/test';

/**
 * What the resizable parts tree specs share (AQP-426, STORY-CR01.3E, FR-112): the numbers, the locators of the handle and the column, and the few measurements. This file has no tests and its name does not end in `.spec.ts`.
 * The pure rules are `tests/unit/tree-width*.test.ts`; the structure of the handle is `tests/unit/tree-resize-handle.test.ts`.
 */

export const DEFAULT_WIDTH = 320;
export const MINIMUM = 240;
export const MAXIMUM = 400;
export const FORM_MINIMUM = 232;
/** Sub-pixel layout: a width is compared within one pixel. */
export const TOLERANCE = 1;
export const HINT = 'Drag, or use the left and right arrow keys. Enter resets to the standard width.';

export const storageKey = (userId: string): string => `aqp.ui.treeWidth.${userId}`;
export const stored = (page: Page, userId: string): Promise<string | null> => page.evaluate((key) => window.localStorage.getItem(key), storageKey(userId));
export const store = (page: Page, key: string, value: string): Promise<void> => page.evaluate(([name, text]) => window.localStorage.setItem(name ?? '', text ?? ''), [key, value]);

/** The focusable separator: the one element that has the role, the ARIA values and the keys. */
export const handleOf = (page: Page): Locator => page.getByRole('separator', { name: 'Resize parts tree' });
/** The full-height hit area around it: no role, the element the pointer uses. */
export const hitAreaOf = (page: Page): Locator => page.locator('[data-tree-hit]');
export const column = (page: Page): Locator => page.locator('#parts-tree-column');
export const widthButton = (page: Page): Locator => page.getByRole('button', { name: 'Tree width', exact: true });
/** An alert that says something: the framework's own route announcer is an alert with no text. */
export const textAlerts = (page: Page): Locator => page.getByRole('alert').filter({ hasText: /\S/ });
export const columnWidth = (page: Page): Promise<number> => column(page).evaluate((element) => Math.round(element.getBoundingClientRect().width));

/** The width the separator says and the width the column has, which are one number (AC-2). */
export async function expectWidth(page: Page, width: number): Promise<void> {
  const handle = handleOf(page);
  await expect(handle).toHaveAttribute('aria-valuenow', String(width));
  await expect(handle).toHaveAttribute('aria-valuetext', `Parts tree ${width} pixels wide`);
  expect(await columnWidth(page), 'the column is as wide as the separator says').toBe(width);
}

/** The form's box, the narrowest section card, the page's sideways overflow, the drawing region and the tree column, in one step. */
export const layout = (page: Page): Promise<{ form: number; card: number; overflow: number; region: number; tree: number }> =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-part-grid] > *')].map((card) => card.getBoundingClientRect().width);
    return {
      form: document.querySelector('form[data-part-form]')?.getBoundingClientRect().width ?? -1,
      card: Math.min(...cards),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      region: document.querySelector('[data-drawing-region]')?.getBoundingClientRect().width ?? -1,
      tree: document.querySelector('#parts-tree-column')?.getBoundingClientRect().width ?? -1,
    };
  });

/**
 * The points of the hit area's centre line, in the part of it that is on screen and not under a sticky bar (the Actions bar and the top bar lie over the page by design, WCAG 2.4.11), where the topmost element is not the
 * handle. An empty list is a pass.
 */
export const centreLineMisses = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const box = document.querySelector('[data-tree-hit]')?.getBoundingClientRect();
    if (box === undefined) return ['no hit area'];
    const bars = [...document.querySelectorAll('[data-sticky-bar], header')].map((bar) => bar.getBoundingClientRect());
    const covered = (y: number): boolean => bars.some((bar) => y >= bar.top && y <= bar.bottom);
    const x = box.left + box.width / 2;
    const misses: string[] = [];
    for (let y = Math.max(box.top, 0) + 4; y < Math.min(box.bottom, window.innerHeight) - 4; y += 40) {
      if (covered(y)) continue;
      const reached = document.elementFromPoint(x, y);
      if (reached === null || reached.closest('[data-tree-hit]') === null) misses.push(`y ${Math.round(y)}: ${reached?.outerHTML.slice(0, 60) ?? 'nothing'}`);
    }
    return misses;
  });

/** WCAG relative luminance of an `rgb(...)` colour, and the contrast of two. */
export function contrast(first: string, second: string): number {
  const channels = (colour: string): number[] => (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const luminance = (colour: string): number => {
    const [red = 0, green = 0, blue = 0] = channels(colour).map((value) => {
      const unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** What only the code of the handle and of the Tree width menu contains: their own attributes. The development server hashes most chunk names, so the chunk is told by its content. */
const CONTROLS_MARKERS = ['data-tree-hit', 'data-tree-width-button'];
const CHUNK = /\/_next\/static\/chunks\/.*\.js(\?.*)?$/;

/**
 * Holds the code of the handle and of the Tree width menu (the chunks that carry their markers) until `release` is called, or refuses it (`'refuse'`, answered 503), and lets every other chunk through at once. Remove it with
 * `page.unroute(CHUNK_ROUTE)` (the returned pattern). The tests of "the form first" (DEF-085, DL-391) use it to look at the page while the controls are not there.
 */
export async function holdControlsCode(page: Page, mode: { readonly release: Promise<void> } | 'refuse'): Promise<RegExp> {
  await page.route(CHUNK, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (!CONTROLS_MARKERS.some((marker) => body.includes(marker))) return route.fulfill({ response, body });
    if (mode === 'refuse') return route.fulfill({ status: 503, contentType: 'text/plain', body: 'refused' });
    await mode.release;
    return route.fulfill({ response, body });
  });
  return CHUNK;
}
