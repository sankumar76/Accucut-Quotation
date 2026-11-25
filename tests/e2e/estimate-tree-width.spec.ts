import { expect, test, type Locator, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, tokenColour, widthOf } from './support/design-system';
import { expectFormAccessible, openForm, showTree, tree, waitForForm } from './support/part-form';

/**
 * AQP-426 (STORY-CR01.3E, FR-112; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, "Item 15 specification", UX-AC-15.1 to 15.15): the resizable parts tree of SCR-05. Binding rules of DL-377 (4):
 * the checks are made by the keyboard and the "Tree width" button; there is ONE pointer-drag case, at 1280 px, with stepped moves and an assertion on the final value and no wait on time; the clamping, step,
 * storage and drag-state rules are the unit tests of `tests/unit/tree-width*.test.ts`; and every case clears the stored width at its end. The tests that set their own widths run in the desktop project and skip in
 * the other two; the one below 1024 px runs at the width of the project. Every ID and name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

// Each case clears what it stored (DL-377 (4)); a page that is not on the app (the case failed before it opened) has no storage to clear.
test.afterEach(async ({ page }) => {
  await page
    .evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        // No storage on this page.
      }
    })
    .catch(() => undefined);
});

const DESKTOP_ONLY = 'the width of this case is its own; it runs in the desktop project';
const DEFAULT_WIDTH = 320;
const MINIMUM = 240;
const MAXIMUM = 400;
const FORM_MINIMUM = 232;
/** Sub-pixel layout: a width is compared within one pixel. */
const TOLERANCE = 1;
const HINT = 'Drag, or use the left and right arrow keys. Enter resets to the standard width.';

const storageKey = (userId: string): string => `aqp.ui.treeWidth.${userId}`;
const stored = (page: Page, userId: string): Promise<string | null> => page.evaluate((key) => window.localStorage.getItem(key), storageKey(userId));
const store = (page: Page, userId: string, value: string): Promise<void> => page.evaluate(([key, text]) => window.localStorage.setItem(key ?? '', text ?? ''), [storageKey(userId), value]);

const handleOf = (page: Page): Locator => page.getByRole('separator', { name: 'Resize parts tree' });
const column = (page: Page): Locator => page.locator('#parts-tree-column');
const widthButton = (page: Page): Locator => page.getByRole('button', { name: 'Tree width', exact: true });
const columnWidth = (page: Page): Promise<number> => column(page).evaluate((element) => Math.round(element.getBoundingClientRect().width));

/** The width the handle says and the width the column has, which are one number (AC-2). */
async function expectWidth(page: Page, width: number): Promise<void> {
  const handle = handleOf(page);
  await expect(handle).toHaveAttribute('aria-valuenow', String(width));
  await expect(handle).toHaveAttribute('aria-valuetext', `Parts tree ${width} pixels wide`);
  expect(await columnWidth(page), 'the column is as wide as the handle says').toBe(width);
}

/** The form's box, the narrowest section card and the page's sideways overflow, in one step. */
const layout = (page: Page): Promise<{ form: number; card: number; overflow: number; region: number; tree: number }> =>
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

/** WCAG relative luminance of an `rgb(...)` colour, and the contrast of two. */
function contrast(first: string, second: string): number {
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

test.describe('AC-11, AC-15: below 1024 px there is no handle and no button', () => {
  test('AC-11, AC-15: with 400 px stored, a phone and a tablet have no separator and no Tree width button, the panel keeps its own width, nothing scrolls sideways, the stored width is kept and axe finds nothing', async ({ page }, testInfo) => {
    const width = await widthOf(page);
    test.skip(width >= 1024, 'this case is the width of the phone and the tablet');
    const owner = await openForm(page, testInfo);
    await store(page, owner.id, '400');
    await page.reload();
    await waitForForm(page);
    await showTree(page);

    await expect(page.getByRole('separator')).toHaveCount(0);
    await expect(widthButton(page)).toHaveCount(0);
    expect(await stored(page, owner.id), 'the stored width is ignored here and kept, so it returns when the window grows').toBe('400');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    if (width >= 768) {
      // The stacked panel is the full width of its container, not the 400 px that is stored.
      const sizes = await column(page).evaluate((element) => ({ column: element.getBoundingClientRect().width, container: element.parentElement?.getBoundingClientRect().width ?? -1 }));
      expect(Math.abs(sizes.column - sizes.container)).toBeLessThanOrEqual(TOLERANCE);
    } else {
      // The drawer keeps its own width (`--drawer-w`, 288 px).
      const drawer = await page.getByRole('dialog').evaluate((element) => element.getBoundingClientRect().width);
      expect(Math.abs(drawer - 288)).toBeLessThanOrEqual(TOLERANCE);
    }
    await expectFormAccessible(page);
  });
});

test.describe('the handle and its keys, at 1366 px', () => {
  test('AC-1, AC-2, AC-4, AC-5, AC-9, AC-10, AC-12: 320 px by default; the separator has its name, values and description and sits after the tree and before the form; every key does its step and clamps; Up and Down are not taken; Enter and a double click reset and remove the stored width; the grip and the focus ring are as drawn; the hit area is 24 px; nothing is animated', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    const owner = await openForm(page, testInfo);
    const handle = handleOf(page);
    await expect(handle).toBeVisible();

    // AC-1 and AC-2: 320 px, and the separator's attributes.
    await expectWidth(page, DEFAULT_WIDTH);
    expect(await handle.evaluate((element) => element.tagName), 'a div, not a button').toBe('DIV');
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    await expect(handle).toHaveAttribute('aria-valuemin', String(MINIMUM));
    await expect(handle).toHaveAttribute('aria-valuemax', String(MAXIMUM));
    await expect(handle).toHaveAttribute('aria-controls', 'parts-tree-column');
    await expect(handle).toHaveAccessibleDescription(HINT);
    expect(await stored(page, owner.id), 'nothing is stored until a gesture is made').toBeNull();

    // AC-2: in the tab order after the tree's last control, before the form.
    await page.getByRole('button', { name: 'Add main assembly' }).focus();
    await page.keyboard.press('Tab');
    await expect(handle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(handle).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.closest('[data-form-area]') !== null), 'the next stop is in the form').toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(handle).toBeFocused();

    // AC-9: the focus ring is the 3 px --focus ring with a 2 px offset around the 12 x 48 pill behind the grip, not the strip; the grip is --primary.
    const pill = handle.locator('span').first();
    expect(await pill.evaluate((element) => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, offset: getComputedStyle(element).outlineOffset, colour: getComputedStyle(element).outlineColor, box: element.getBoundingClientRect().toJSON() }))).toMatchObject({
      width: '3px',
      style: 'solid',
      offset: '2px',
      colour: await tokenColour(page, '--focus'),
      box: { width: 12, height: 48 },
    });
    expect(await handle.evaluate((element) => getComputedStyle(element).outlineStyle), 'no ring on the full-height strip').toBe('none');
    const grip = handle.locator('[data-tree-grip]');
    expect(await grip.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await tokenColour(page, '--primary'));
    const gripBox = await grip.boundingBox();
    await testInfo.attach('handle-focus-ring', { body: await page.screenshot({ clip: { x: (gripBox?.x ?? 0) - 40, y: (gripBox?.y ?? 0) - 20, width: 80, height: 80 } }), contentType: 'image/png' });

    // AC-4: every key. Left and Right 16 px, Shift 64 px, End the maximum, Home 240, both ends clamp, Enter 320.
    const prevented = (): Promise<string | undefined> => page.evaluate(() => document.documentElement.dataset['keyPrevented']);
    await page.evaluate(() => window.addEventListener('keydown', (event) => (document.documentElement.dataset['keyPrevented'] = String(event.defaultPrevented))));
    await page.keyboard.press('ArrowLeft');
    await expectWidth(page, 304);
    expect(await prevented(), 'an arrow key is taken').toBe('true');
    await page.keyboard.press('ArrowRight');
    await expectWidth(page, 320);
    await page.keyboard.press('Shift+ArrowRight');
    await expectWidth(page, 384);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expectWidth(page, 400);
    await page.keyboard.press('ArrowRight');
    await expectWidth(page, 400);
    await page.keyboard.press('Home');
    await expectWidth(page, 240);
    expect(await stored(page, owner.id), 'the width is stored by the key').toBe('240');
    await page.keyboard.press('ArrowLeft');
    await expectWidth(page, 240);
    await page.keyboard.press('Shift+ArrowRight');
    await expectWidth(page, 304);
    await page.keyboard.press('End');
    await expectWidth(page, 400);
    expect(await stored(page, owner.id)).toBe('400');
    await page.keyboard.press('Shift+ArrowLeft');
    await expectWidth(page, 336);
    // Up, Down and other keys do nothing and are not taken, so the page scrolls as it does.
    for (const other of ['ArrowUp', 'ArrowDown', 'PageDown', 'a']) {
      await page.keyboard.press(other);
      expect(await prevented(), `${other} is not taken`).toBe('false');
      await expectWidth(page, 336);
    }
    await page.keyboard.press('Enter');
    await expectWidth(page, DEFAULT_WIDTH);
    expect(await stored(page, owner.id), 'a reset removes the stored width').toBeNull();
    await expect(page.getByRole('status').filter({ hasText: 'Parts tree width' })).toHaveText('Parts tree width: standard, 320 pixels.');

    // AC-5: a double click resets too.
    await page.keyboard.press('End');
    await expectWidth(page, 400);
    await handle.dblclick();
    await expectWidth(page, DEFAULT_WIDTH);
    expect(await stored(page, owner.id)).toBeNull();

    // AC-9 and AC-10: the grip is at rest --border-strong, at least 3:1 on the page and on the card; the hit area is the card's height and 24 px wide, from the card's right edge; touch-action is none.
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: 'Add main assembly' }).focus();
    const rest = await grip.evaluate((element) => ({ grip: getComputedStyle(element).backgroundColor, page: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('#parts-tree-panel [data-slot="card"]') ?? document.body).backgroundColor }));
    expect(rest.grip).toBe(await tokenColour(page, '--border-strong'));
    expect(contrast(rest.grip, rest.page), 'grip on the page').toBeGreaterThanOrEqual(3);
    expect(contrast(rest.grip, rest.card), 'grip on the card').toBeGreaterThanOrEqual(3);
    const boxes = await page.evaluate(() => {
      const card = document.querySelector('#parts-tree-panel [data-slot="card"]')?.getBoundingClientRect();
      const strip = document.querySelector('[data-tree-handle]')?.getBoundingClientRect();
      return { card: card?.toJSON(), strip: strip?.toJSON() };
    });
    expect(boxes.strip?.width).toBe(24);
    expect(Math.abs((boxes.strip?.height ?? 0) - (boxes.card?.height ?? -1))).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs((boxes.strip?.left ?? 0) - (boxes.card?.right ?? -1))).toBeLessThanOrEqual(TOLERANCE);
    expect(await handle.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
    await handle.hover();
    expect(await grip.evaluate((element) => getComputedStyle(element).backgroundColor), 'the grip is --primary on hover').toBe(await tokenColour(page, '--primary'));
    await expect(page.locator('#parts-tree-resize-hint')).toBeVisible();

    // AC-12: no transition on the column's width, and none on the grip's colour.
    expect(await column(page).evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
    expect(await grip.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  });
});

test.describe('the Tree width button, at 1366 px', () => {
  test('AC-7, AC-13, AC-6: the button is 32 px; it opens a group of Narrow, Standard (default) and Wide; a choice applies, is stored and is announced at once; the group stays open until Escape, and focus returns to the button; a choice that does not fit is off with its reason', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    const owner = await openForm(page, testInfo);
    await expect(handleOf(page)).toBeVisible();
    const button = widthButton(page);
    await expect(button).toBeVisible();
    const buttonBox = await button.boundingBox();
    expect([Math.round(buttonBox?.width ?? 0), Math.round(buttonBox?.height ?? 0)], 'the button is 32 px square with a mouse').toEqual([32, 32]);
    // After the row count, in the tree card's head.
    expect(await button.evaluate((element) => element.closest('[data-slot="card-header"]')?.textContent?.includes('row') ?? false)).toBe(true);

    await button.click();
    const group = page.getByRole('radiogroup', { name: 'Tree width' });
    await expect(group).toBeVisible();
    const narrow = group.getByRole('radio', { name: 'Narrow (256 px)' });
    const standard = group.getByRole('radio', { name: 'Standard (320 px)' });
    const wide = group.getByRole('radio', { name: 'Wide (400 px)' });
    await expect(group.getByRole('radio')).toHaveCount(3);
    await expect(standard).toBeChecked();
    await expect(standard).toHaveAccessibleDescription('default');

    const announcement = page.getByRole('status').filter({ hasText: 'Parts tree width' });
    await wide.click();
    await expectWidth(page, MAXIMUM);
    expect(await stored(page, owner.id)).toBe('400');
    await expect(announcement).toHaveText('Parts tree width: wide, 400 pixels.');
    await expect(group, 'the group stays open for the person to see the result').toBeVisible();
    await expect(wide).toBeChecked();
    await narrow.click();
    await expectWidth(page, 256);
    expect(await stored(page, owner.id)).toBe('256');
    await expect(announcement).toHaveText('Parts tree width: narrow, 256 pixels.');
    await standard.click();
    await expectWidth(page, DEFAULT_WIDTH);
    expect(await stored(page, owner.id), 'Standard removes the stored width').toBeNull();
    await expect(announcement).toHaveText('Parts tree width: standard, 320 pixels.');
    await expectNoAxeViolations(page);

    await page.keyboard.press('Escape');
    await expect(group).toBeHidden();
    await expect(button, 'focus returns to the button').toBeFocused();

    // AC-6, AC-8: a workspace with room for 352 px (600 less the menu's 248): a stored 400 shows 352 and is still 400; the choices that do not fit are off, with the reason. The room is made by narrowing the workspace element.
    await handleOf(page).focus();
    await page.keyboard.press('End');
    await expectWidth(page, MAXIMUM);
    const narrowWorkspace = async (pixels: number | null): Promise<void> => {
      await column(page).evaluate((element, width) => {
        element.parentElement?.style.setProperty('width', width === null ? '' : `${width}px`);
      }, pixels);
    };
    await narrowWorkspace(600);
    await expect(handleOf(page)).toHaveAttribute('aria-valuemax', '352');
    await expectWidth(page, 352);
    expect(await stored(page, owner.id), 'a clamp never rewrites the stored width').toBe('400');
    await button.click();
    await expect(wide).toBeDisabled();
    await expect(wide).toHaveAccessibleDescription('Not enough room at this window size');
    await expect(standard).toBeEnabled();
    await narrowWorkspace(520);
    await expect(handleOf(page)).toHaveAttribute('aria-valuemax', '272');
    await expect(standard).toBeDisabled();
    await expect(standard).toHaveAccessibleDescription('Not enough room at this window size');
    await expect(narrow).toBeEnabled();
    await narrowWorkspace(null);
    await expect(handleOf(page)).toHaveAttribute('aria-valuemax', String(MAXIMUM));
    await expectWidth(page, MAXIMUM);
    expect(await stored(page, owner.id), 'the stored 400 comes back with the room').toBe('400');
  });
});

test.describe('the one drag, at 1280 px', () => {
  test('AC-3: dragging the handle by the mouse changes the width by the distance, shows the value as it goes, and stores it once, when the button goes up', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    const owner = await openForm(page, testInfo);
    await page.setViewportSize({ width: 1280, height: 900 });
    const handle = handleOf(page);
    await expect(handle).toBeVisible();
    await expectWidth(page, DEFAULT_WIDTH);
    await handle.hover();
    const box = await handle.boundingBox();
    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + Math.min((box?.height ?? 0) / 2, 200);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step += 1) await page.mouse.move(x + step * 10, y);
    // While the button is down: the value follows, the page is in its dragging look, and nothing is stored yet.
    await expect(handle).toHaveAttribute('aria-valuenow', '380');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-tree-resizing'))).toBe(true);
    expect(await stored(page, owner.id), 'nothing is stored while the pointer moves').toBeNull();
    await page.mouse.up();
    await expectWidth(page, 380);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-tree-resizing'))).toBe(false);
    expect(await stored(page, owner.id), 'stored once, at the end of the gesture').toBe('380');
  });
});

test.describe('the layout, from 1024 px', () => {
  test('AC-6, AC-11, AC-8: at 1280 and 1024 px the form keeps 232 px and nothing scrolls sideways at the widest tree, the drawing region gives way before the tree does, and the handle and the button exist at 1024 and not at 1023, with the stored width kept', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    const owner = await openForm(page, testInfo);
    await expect(handleOf(page)).toBeVisible();
    await handleOf(page).focus();
    await page.keyboard.press('End');
    await expectWidth(page, MAXIMUM);

    for (const viewport of [1280, 1024]) {
      await page.setViewportSize({ width: viewport, height: 900 });
      await expectWidth(page, MAXIMUM);
      const widest = await layout(page);
      expect(widest.overflow, `no sideways scroll at ${viewport} px`).toBeLessThanOrEqual(0);
      expect(widest.form, `the form is at least one card at ${viewport} px`).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
      expect(widest.card, `a section card is at least 232 px at ${viewport} px`).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
      // The reserved region (340 px, as the layout spec sets it) yields to the tree: the tree keeps the chosen width.
      await page.evaluate(() => document.documentElement.style.setProperty('--drawing-region-width', '340px'));
      const withRegion = await layout(page);
      expect(withRegion.tree, `the tree keeps its 400 px with the region at ${viewport} px`).toBeCloseTo(MAXIMUM, 0);
      expect(withRegion.region).toBeLessThanOrEqual(340 + TOLERANCE);
      expect(withRegion.card).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
      expect(withRegion.overflow).toBeLessThanOrEqual(0);
      await page.evaluate(() => document.documentElement.style.removeProperty('--drawing-region-width'));
    }

    // AC-11: 1023 px has neither, and the stacked panel is the full width of its container; 1024 px has both and the stored 400 again.
    await page.setViewportSize({ width: 1023, height: 900 });
    await expect(handleOf(page)).toHaveCount(0);
    await expect(page.getByRole('separator')).toHaveCount(0);
    await expect(widthButton(page)).toHaveCount(0);
    const sizes = await column(page).evaluate((element) => ({ column: element.getBoundingClientRect().width, container: element.parentElement?.getBoundingClientRect().width ?? -1 }));
    expect(Math.abs(sizes.column - sizes.container)).toBeLessThanOrEqual(TOLERANCE);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await stored(page, owner.id), 'kept while the window is small').toBe('400');
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(handleOf(page)).toBeVisible();
    await expect(widthButton(page)).toBeVisible();
    await expectWidth(page, MAXIMUM);
  });
});

test.describe('a finger at 1024 px', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test('AC-10: with a coarse pointer the handle is 44 px wide and the button 44 px square, and no control of the form lies under the handle', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    await openForm(page, testInfo);
    const handle = handleOf(page);
    await expect(handle).toBeVisible();
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'the emulated device has a coarse pointer').toBe(true);
    const box = await handle.boundingBox();
    expect(box?.width).toBe(44);
    const buttonBox = await widthButton(page).boundingBox();
    expect([Math.round(buttonBox?.width ?? 0), Math.round(buttonBox?.height ?? 0)]).toEqual([44, 44]);
    const overlapping = await page.evaluate(() => {
      const strip = document.querySelector('[data-tree-handle]')?.getBoundingClientRect();
      if (strip === undefined) return ['no handle'];
      const controls = document.querySelectorAll('[data-form-area] :is(input, select, textarea, button, a[href], [role="combobox"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"]))');
      return [...controls]
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && rect.left < strip.right && rect.right > strip.left && rect.top < strip.bottom && rect.bottom > strip.top;
        })
        .map((control) => control.outerHTML.slice(0, 100));
    });
    expect(overlapping, 'no control of the form lies under the handle').toEqual([]);
  });
});

test.describe('the tree at its narrowest and widest', () => {
  test('AC-15, AC-6: axe finds nothing at 256, 320 and 400 px and with the Tree width group open; at 240 and 400 px a press at the centre of a row still chooses it and a long name wraps with no sideways scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    // One part with a long name: the tree answers the page's own read with it (a name wraps, the status icon stays at the right).
    await page.route('**/api/v1/estimates/*/tree', async (route) => {
      const response = await route.fetch();
      const body: unknown = await response.json();
      if (typeof body !== 'object' || body === null || !('nodes' in body) || !Array.isArray(body.nodes)) return route.fulfill({ response });
      const nodes: unknown[] = body.nodes;
      return route.fulfill({ response, json: { ...body, nodes: nodes.map((node) => (typeof node === 'object' && node !== null ? { ...node, label: 'Invented bracket assembly with an unusually long descriptive name that keeps going and going' } : node)) } });
    });
    await openForm(page, testInfo);
    const handle = handleOf(page);
    await expect(handle).toBeVisible();
    await handle.focus();
    const row = tree(page).getByRole('link').first();

    for (const [key, width] of [
      ['Home', MINIMUM],
      ['Enter', DEFAULT_WIDTH],
      ['End', MAXIMUM],
    ] as const) {
      await page.keyboard.press(key);
      await expectWidth(page, width);
      if (width !== DEFAULT_WIDTH) {
        const fits = await page.evaluate(() => {
          const card = document.querySelector('#parts-tree-panel [data-slot="card"]');
          return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, card: card === null ? -1 : card.scrollWidth - card.clientWidth };
        });
        expect(fits.overflow, `no sideways scroll of the page at ${width} px`).toBeLessThanOrEqual(0);
        expect(fits.card, `no sideways scroll of the tree at ${width} px`).toBeLessThanOrEqual(0);
        // The centre of the row's name reaches the row (AQP-418): a press there chooses it.
        const reached = await row.evaluate((link) => {
          const { left, top, width: boxWidth, height } = link.getBoundingClientRect();
          const at = document.elementFromPoint(left + boxWidth / 2, top + height / 2);
          return at !== null && link.contains(at);
        });
        expect(reached, `the centre of the row reaches the row at ${width} px`).toBe(true);
        await row.click();
        await expect(row).toHaveAttribute('aria-current', 'true');
        await handle.focus();
      }
      await expectFormAccessible(page);
    }
    // The Tree width group open: its radios are 44 px and its text is read.
    await widthButton(page).click();
    await expect(page.getByRole('radiogroup', { name: 'Tree width' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('the stored width, at 1366 px', () => {
  test('AC-8: a width is back after a reload; a value that is missing, not a number, not whole or out of range gives 320 with no message; another user\'s width is not read; storage that throws gives 320 and a change still applies for the page', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
    const owner = await openForm(page, testInfo);
    await expect(handleOf(page)).toBeVisible();
    await handleOf(page).focus();
    await page.keyboard.press('End');
    await expect(handleOf(page)).toHaveAttribute('aria-valuenow', String(MAXIMUM));
    await page.reload();
    await waitForForm(page);
    await expect(handleOf(page)).toBeVisible();
    await expectWidth(page, MAXIMUM);

    for (const bad of ['abc', '300.5', '1000', '239', '']) {
      await store(page, owner.id, bad);
      await page.reload();
      await waitForForm(page);
      await expect(handleOf(page)).toBeVisible();
      await expectWidth(page, DEFAULT_WIDTH);
      await expect(page.getByRole('alert'), `no message for ${JSON.stringify(bad)}`).toHaveCount(0);
    }

    await page.evaluate((key) => window.localStorage.removeItem(key), storageKey(owner.id));
    await store(page, `${owner.id}-another`, '280');
    await page.reload();
    await waitForForm(page);
    await expect(handleOf(page)).toBeVisible();
    await expectWidth(page, DEFAULT_WIDTH);

    // Storage that throws on every access, as in a private window with site data blocked.
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await page.reload();
    await waitForForm(page);
    await expect(handleOf(page)).toBeVisible();
    await expectWidth(page, DEFAULT_WIDTH);
    await handleOf(page).focus();
    await page.keyboard.press('End');
    await expectWidth(page, MAXIMUM);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
