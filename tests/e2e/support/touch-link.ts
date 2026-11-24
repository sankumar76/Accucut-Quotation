import { expect, type Locator, type Page } from '@playwright/test';

import { TOUCH_TARGET } from './design-system';

/**
 * What the specs of DEF-079 (AQP-422, NFR-017 as ruled on 2026-11-24) share: the check of a standalone link, the one that is the way to open a task or a view. On a touch layout (below 1024 px, or any width with a coarse
 * pointer) such a link is a control and is 44 px high by padding or a least height, with the text of the same size as before; on a fine pointer from 1024 px nothing changes. This file has no tests, and its name does not
 * end in `.spec.ts`, so Playwright does not run it by itself.
 */

/** Half a pixel: layout rounds to a fraction of a pixel. */
const TOLERANCE = 0.5;

/** A touch layout: below 1024 px, or a pointer that is not a mouse (the rule of `fine-wide:` in globals.css, inverted). */
export const isTouchLayout = (page: Page): Promise<boolean> =>
  page.evaluate(() => !(window.matchMedia('(min-width: 1024px)').matches && window.matchMedia('(pointer: fine)').matches));

interface Reading {
  readonly height: number;
  readonly fontSize: number;
  readonly parentFontSize: number;
  /** True when the element at the middle of the link's top and bottom edges (2 px inside) is the link or inside it, so the padding is part of the link and a tap there is a tap on the link. */
  readonly topEdgeIsTheLink: boolean;
  readonly bottomEdgeIsTheLink: boolean;
}

/**
 * The link as a person sees it. It is brought to the middle of the window first (the sticky top bar must not cover its edges), and `getBoundingClientRect` is the height of the box, padding included.
 * Its text is the size of the text around it: no class of the fix sets a size.
 */
const read = (link: Locator): Promise<Reading> =>
  link.evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    const x = rect.left + Math.min(rect.width / 2, 20);
    const isLink = (y: number): boolean => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && element.contains(hit);
    };
    const parent = element.parentElement;
    return {
      height: rect.height,
      fontSize: parseFloat(getComputedStyle(element).fontSize),
      parentFontSize: parent === null ? Number.NaN : parseFloat(getComputedStyle(parent).fontSize),
      topEdgeIsTheLink: isLink(rect.top + 2),
      bottomEdgeIsTheLink: isLink(rect.bottom - 2),
    };
  });

/**
 * On a touch layout the link is at least 44 px high, a tap at its top and bottom edges lands on it, and its text keeps the size of the text around it. On a fine pointer from 1024 px it is not made a control: it keeps the
 * height of its text line (DEF-079: "do not change the desktop layout"), which is less than 44 px.
 */
export async function expectLinkTarget(page: Page, what: string, link: Locator): Promise<void> {
  await expect(link, `${what} is there`).toBeVisible();
  const touch = await isTouchLayout(page);
  const reading = await read(link);
  const width = page.viewportSize()?.width ?? 0;
  const where = `${what} at ${width} px (${touch ? 'touch layout' : 'fine pointer'})`;
  if (touch) {
    expect.soft(reading.height, `${where}: at least 44 px high`).toBeGreaterThanOrEqual(TOUCH_TARGET - TOLERANCE);
    expect.soft(reading.topEdgeIsTheLink, `${where}: a tap at the top edge lands on the link`).toBe(true);
    expect.soft(reading.bottomEdgeIsTheLink, `${where}: a tap at the bottom edge lands on the link`).toBe(true);
  } else {
    expect.soft(reading.height, `${where}: keeps the height of its text line`).toBeLessThan(TOUCH_TARGET);
  }
  expect.soft(reading.fontSize, `${where}: the text keeps the size of the text around it`).toBe(reading.parentFontSize);
}
