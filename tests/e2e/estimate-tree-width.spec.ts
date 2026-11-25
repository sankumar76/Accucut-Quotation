import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, tokenColour, widthOf } from './support/design-system';
import { control, expectFormAccessible, openForm, showTree, tree, waitForForm } from './support/part-form';
import {
  centreLineMisses,
  column,
  columnWidth,
  contrast,
  DEFAULT_WIDTH,
  expectWidth,
  FORM_MINIMUM,
  HINT,
  handleOf,
  hitAreaOf,
  holdControlsCode,
  layout,
  MAXIMUM,
  MINIMUM,
  store,
  storageKey,
  stored,
  textAlerts,
  TOLERANCE,
  widthButton,
} from './support/tree-width';

/**
 * AQP-426 (STORY-CR01.3E, FR-112; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, "Item 15 specification", UX-AC-15.1 to 15.15, and its notes 698a618f and 90e23166): the resizable parts tree of SCR-05, as it
 * is re-landed (DL-388, DL-389). Binding rules: the checks are made by the keyboard and the "Tree width" button; ONE pointer-drag case, at 1280 px, with stepped moves and an assertion on the final value and no wait on
 * time; the clamping, step, storage and drag-state rules are the unit tests of `tests/unit/tree-width*.test.ts` (a storage that throws is unit-only); every case clears the stored width at its end.
 *
 * ONE person, a serial group (DL-386, DL-388 (6)): `beforeAll` makes one disposable Engineer and signs in once; each case starts from a fresh load of the same estimate with the stored width cleared, and a case that
 * needs a finger opens a second context from the first one's saved session, so no second person and no second sign-in. Ten small cases run in the desktop project and each is judged on its own time (attempt 1 under 25 s on the runner, DL-388 (6)(c)); the eleventh, below
 * 1024 px, runs at the width of the phone and of the tablet project. A failure skips the cases after it, and its retry repeats the group. The file sorts before `users.spec.ts`. Every ID and name is invented.
 */

test.describe.configure({ mode: 'serial' });

const DESKTOP_ONLY = 'the width of this case is its own; it runs in the desktop project';
const slot = (target: Page): Locator => target.locator('[data-tree-width-slot]');

/** The boxes the tree-width controls must not move: the tree card's head with its title and count, the tree card, and the form's card. */
const boxes = (target: Page): Promise<Record<string, string>> =>
  target.evaluate(() => {
    const box = (selector: string): string => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect === undefined ? 'none' : [rect.x, rect.y, rect.width, rect.height].map((value) => value.toFixed(1)).join(' ');
    };
    return { head: box('#parts-tree-panel [data-slot="card-header"]'), title: box('#parts-tree-panel [data-slot="card-title"]'), count: box('#parts-tree-panel [data-slot="card-header"] > span'), card: box('#parts-tree-panel [data-slot="card"]'), form: box('[data-form-area]') };
  });

let context: BrowserContext;
let page: Page;
let ownerId = '';
let workspaceUrl = '';
let baseViewport = { width: 1366, height: 768 };
let baseURL = '';

test.beforeAll(async ({ browser }) => {
  const testInfo = test.info();
  const use = testInfo.project.use;
  baseViewport = use.viewport ?? baseViewport;
  baseURL = use.baseURL ?? '';
  context = await browser.newContext({ baseURL, viewport: baseViewport, hasTouch: use.hasTouch ?? false });
  await useFreshAddress(context);
  page = await context.newPage();
  ownerId = (await openForm(page, testInfo)).id;
  workspaceUrl = page.url();
});

// The finger (case C4): a second context made from the first one's saved session (no second sign-in), 1024 x 768, touch, with the estimate already loaded, so the case itself only measures. Made in its own hook, so its
// load is not part of any case's time. Only the desktop project runs the case.
let fingerContext: BrowserContext | null = null;
let fingerPage: Page | null = null;
test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== 'desktop') return;
  fingerContext = await browser.newContext({ baseURL, storageState: await context.storageState(), viewport: { width: 1024, height: 768 }, hasTouch: true });
  fingerPage = await fingerContext.newPage();
  await fingerPage.goto(workspaceUrl);
  await waitForForm(fingerPage);
});

test.afterAll(async () => {
  await fingerContext?.close();
  await context.close();
});

// Each case starts from a fresh load of the estimate at the project's own width, with nothing stored.
test.beforeEach(async () => {
  await page.setViewportSize(baseViewport);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(workspaceUrl);
  await waitForForm(page);
});

// Each case clears what it stored (DL-377 (4)).
test.afterEach(async () => {
  await page.evaluate(() => window.localStorage.clear()).catch(() => undefined);
});

test('AC-11, AC-15: with 400 px stored, a phone and a tablet have no separator and no Tree width button, the panel keeps its own width, nothing scrolls sideways, the stored width is kept and axe finds nothing', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name === 'desktop', 'this case is the width of the phone and the tablet');
  const width = await widthOf(page);
  await store(page, storageKey(ownerId), '400');
  await page.reload();
  await waitForForm(page);
  await showTree(page);

  await expect(page.getByRole('separator')).toHaveCount(0);
  await expect(widthButton(page)).toHaveCount(0);
  await expect(slot(page), 'no slot for the button either').toHaveCount(0);
  expect(await stored(page, ownerId), 'the stored width is ignored here and kept, so it returns when the window grows').toBe('400');
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

test('AC-1, AC-2, AC-4, AC-5, AC-9, AC-10, AC-12: 320 px by default; the separator, its keys, its own ring and its hit area', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const handle = handleOf(page);
  const hitArea = hitAreaOf(page);
  await expect(handle).toBeVisible();

  // AC-1 and AC-2: 320 px, and the attributes of the one separator; the hit area around it has no role and no tab stop.
  await expectWidth(page, DEFAULT_WIDTH);
  expect(await handle.evaluate((element) => element.tagName), 'a div, not a button').toBe('DIV');
  await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  await expect(handle).toHaveAttribute('aria-valuemin', String(MINIMUM));
  await expect(handle).toHaveAttribute('aria-valuemax', String(MAXIMUM));
  await expect(handle).toHaveAttribute('aria-controls', 'parts-tree-column');
  await expect(handle).toHaveAccessibleDescription(HINT);
  expect(await hitArea.evaluate((element) => ({ role: element.getAttribute('role'), tabindex: element.getAttribute('tabindex'), aria: element.getAttributeNames().filter((name) => name.startsWith('aria-')) }))).toEqual({ role: null, tabindex: null, aria: [] });
  expect(await stored(page, ownerId), 'nothing is stored until a gesture is made').toBeNull();

  // AC-2: in the tab order after the tree's last control, before the form.
  await page.getByRole('button', { name: 'Add main assembly' }).focus();
  await page.keyboard.press('Tab');
  await expect(handle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(handle).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.closest('[data-form-area]') !== null), 'the next stop is in the form').toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect(handle).toBeFocused();

  // AC-9: the focused element draws the 3 px --focus ring with a 2 px offset itself; it is the 24 x 48 box with the grip in it, the ring is not clipped by an ancestor, and the grip is --primary.
  expect(await handle.evaluate((element) => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, offset: getComputedStyle(element).outlineOffset, colour: getComputedStyle(element).outlineColor, box: [element.getBoundingClientRect().width, element.getBoundingClientRect().height] }))).toEqual({
    width: '3px',
    style: 'solid',
    offset: '2px',
    colour: await tokenColour(page, '--focus'),
    box: [24, 48],
  });
  const clippedBy = await handle.evaluate((element) => {
    for (let parent = element.parentElement; parent !== null && parent !== document.documentElement; parent = parent.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(parent);
      if (overflowX !== 'visible' || overflowY !== 'visible') return `${parent.tagName.toLowerCase()}${parent.id === '' ? '' : `#${parent.id}`}`;
    }
    return null;
  });
  expect(clippedBy, 'no ancestor clips the ring').toBeNull();
  expect(Number(await hitArea.evaluate((element) => getComputedStyle(element).zIndex)), 'the handle sits above its neighbours').toBeGreaterThan(0);
  const grip = handle.locator('[data-tree-grip]');
  expect(await grip.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await tokenColour(page, '--primary'));
  const gripBox = await grip.boundingBox();
  await testInfo.attach('separator-focus-ring', { body: await page.screenshot({ clip: { x: (gripBox?.x ?? 0) - 40, y: (gripBox?.y ?? 0) - 30, width: 80, height: 100 } }), contentType: 'image/png' });

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
  expect(await stored(page, ownerId), 'the width is stored by the key').toBe('240');
  await page.keyboard.press('ArrowLeft');
  await expectWidth(page, 240);
  await page.keyboard.press('Shift+ArrowRight');
  await expectWidth(page, 304);
  await page.keyboard.press('End');
  await expectWidth(page, 400);
  expect(await stored(page, ownerId)).toBe('400');
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
  expect(await stored(page, ownerId), 'a reset removes the stored width').toBeNull();
  await expect(page.getByRole('status').filter({ hasText: 'Parts tree width' })).toHaveText('Parts tree width: standard, 320 pixels.');

  // AC-5: a double click on the handle resets too.
  await page.keyboard.press('End');
  await expectWidth(page, 400);
  await hitArea.dblclick();
  await expectWidth(page, DEFAULT_WIDTH);
  expect(await stored(page, ownerId)).toBeNull();

  // AC-9 and AC-10 at rest: the grip is --border-strong, at least 3:1 on the page and on the card; the hit area is the card's height and 24 px wide from the card's right edge, with touch-action none; a mouse over it makes
  // the grip --primary and shows the hint; every point of its centre line reaches the handle.
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: 'Add main assembly' }).focus();
  const rest = await grip.evaluate((element) => ({ grip: getComputedStyle(element).backgroundColor, page: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('#parts-tree-panel [data-slot="card"]') ?? document.body).backgroundColor }));
  expect(rest.grip).toBe(await tokenColour(page, '--border-strong'));
  expect(contrast(rest.grip, rest.page), 'grip on the page').toBeGreaterThanOrEqual(3);
  expect(contrast(rest.grip, rest.card), 'grip on the card').toBeGreaterThanOrEqual(3);
  const boxes = await page.evaluate(() => ({ card: document.querySelector('#parts-tree-panel [data-slot="card"]')?.getBoundingClientRect().toJSON(), strip: document.querySelector('[data-tree-hit]')?.getBoundingClientRect().toJSON() }));
  expect(boxes.strip?.width).toBe(24);
  expect(Math.abs((boxes.strip?.height ?? 0) - (boxes.card?.height ?? -1))).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs((boxes.strip?.left ?? 0) - (boxes.card?.right ?? -1))).toBeLessThanOrEqual(TOLERANCE);
  expect(await hitArea.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
  expect(await centreLineMisses(page), 'the centre line of the hit area reaches the handle').toEqual([]);
  await hitArea.hover();
  expect(await grip.evaluate((element) => getComputedStyle(element).backgroundColor), 'the grip is --primary on hover').toBe(await tokenColour(page, '--primary'));
  await expect(page.locator('#parts-tree-resize-hint')).toBeVisible();

  // AC-12: no transition on the column's width, and none on the grip's colour.
  expect(await column(page).evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await grip.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');

});

test('AC-3, AC-6, AC-11: the one drag at 1280 px (a press on the hit area focuses the separator, the value follows, stored once at the end); the form keeps 232 px from 1280 down to 1024 px and the handle is there at 1024 and not at 1023', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const handle = handleOf(page);
  const hitArea = hitAreaOf(page);
  await expect(handle).toBeVisible();

  // AC-3: the one drag, at 1280 px. A press on the hit area focuses the separator; the value follows the mouse; nothing is stored while it moves; the width is stored once, when the button goes up.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Add main assembly' }).focus();
  await expectWidth(page, DEFAULT_WIDTH);
  await hitArea.hover();
  const box = await hitArea.boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + Math.min((box?.height ?? 0) / 2, 200);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(handle, 'a press on the hit area focuses the separator').toBeFocused();
  for (let step = 1; step <= 6; step += 1) await page.mouse.move(x + step * 10, y);
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-tree-resizing'))).toBe(true);
  expect(await stored(page, ownerId), 'nothing is stored while the pointer moves').toBeNull();
  await page.mouse.up();
  await expectWidth(page, 380);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-tree-resizing'))).toBe(false);
  expect(await stored(page, ownerId), 'stored once, at the end of the gesture').toBe('380');
  await expect(handle, 'the separator keeps the focus after the drag, so the keys work').toBeFocused();

  // AC-6, AC-11: at the widest tree, 1280 then 1024 px: the form keeps one card, nothing scrolls sideways, the drawing region (340 px token) gives way before the tree does; 1023 px has neither handle nor button, 1024 both.
  await page.keyboard.press('End');
  await expectWidth(page, MAXIMUM);
  for (const viewport of [1280, 1024]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    await expectWidth(page, MAXIMUM);
    const widest = await layout(page);
    expect(widest.overflow, `no sideways scroll at ${viewport} px`).toBeLessThanOrEqual(0);
    expect(widest.form, `the form is at least one card at ${viewport} px`).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
    expect(widest.card, `a section card is at least 232 px at ${viewport} px`).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
    await page.evaluate(() => document.documentElement.style.setProperty('--drawing-region-width', '340px'));
    const withRegion = await layout(page);
    expect(withRegion.tree, `the tree keeps its 400 px with the region at ${viewport} px`).toBeCloseTo(MAXIMUM, 0);
    expect(withRegion.region).toBeLessThanOrEqual(340 + TOLERANCE);
    expect(withRegion.card).toBeGreaterThanOrEqual(FORM_MINIMUM - TOLERANCE);
    expect(withRegion.overflow).toBeLessThanOrEqual(0);
    await page.evaluate(() => document.documentElement.style.removeProperty('--drawing-region-width'));
  }
  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(page.getByRole('separator')).toHaveCount(0);
  await expect(widthButton(page)).toHaveCount(0);
  const sizes = await column(page).evaluate((element) => ({ column: element.getBoundingClientRect().width, container: element.parentElement?.getBoundingClientRect().width ?? -1 }));
  expect(Math.abs(sizes.column - sizes.container)).toBeLessThanOrEqual(TOLERANCE);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await stored(page, ownerId), 'kept while the window is small').toBe('400');
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(handle).toBeVisible();
  await expect(widthButton(page)).toBeVisible();
  await expectWidth(page, MAXIMUM);

});

test('AC-9, AC-10: with a finger at 1024 px the hit area is 44 px, the separator 44 x 48, the button 44 px, and nothing of the form lies under the hit area', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);

  const finger = fingerPage;
  expect(finger, 'the finger page was made in beforeAll').not.toBeNull();
  if (finger === null) return;
  {
    await expect(handleOf(finger)).toBeVisible();
    expect(await finger.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'the emulated device has a coarse pointer').toBe(true);
    expect((await hitAreaOf(finger).boundingBox())?.width, 'the hit area is 44 px wide').toBe(44);
    const separatorBox = await handleOf(finger).boundingBox();
    expect([separatorBox?.width, separatorBox?.height], 'the separator is 44 x 48 px').toEqual([44, 48]);
    const buttonBox = await widthButton(finger).boundingBox();
    expect([Math.round(buttonBox?.width ?? 0), Math.round(buttonBox?.height ?? 0)]).toEqual([44, 44]);
    expect(await centreLineMisses(finger), 'the centre line of the hit area reaches the handle').toEqual([]);
    const overlapping = await finger.evaluate(() => {
      const strip = document.querySelector('[data-tree-hit]')?.getBoundingClientRect();
      if (strip === undefined) return ['no hit area'];
      const controls = document.querySelectorAll('[data-form-area] :is(input, select, textarea, button, a[href], [role="combobox"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"]))');
      return [...controls]
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && rect.left < strip.right && rect.right > strip.left && rect.top < strip.bottom && rect.bottom > strip.top;
        })
        .map((control) => control.outerHTML.slice(0, 100));
    });
    expect(overlapping, 'no control of the form lies under the hit area').toEqual([]);
  }
});

test('AC-7, AC-13, AC-6: the Tree width button and its three choices, a choice that does not fit, a stored 400 on a narrow workspace', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const handle = handleOf(page);
  await expect(handle).toBeVisible();
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
  expect(await stored(page, ownerId)).toBe('400');
  await expect(announcement).toHaveText('Parts tree width: wide, 400 pixels.');
  await expect(group, 'the group stays open for the person to see the result').toBeVisible();
  await expect(wide).toBeChecked();
  await narrow.click();
  await expectWidth(page, 256);
  expect(await stored(page, ownerId)).toBe('256');
  await expect(announcement).toHaveText('Parts tree width: narrow, 256 pixels.');
  await standard.click();
  await expectWidth(page, DEFAULT_WIDTH);
  expect(await stored(page, ownerId), 'Standard removes the stored width').toBeNull();
  await expect(announcement).toHaveText('Parts tree width: standard, 320 pixels.');
  await page.keyboard.press('Escape');
  await expect(group).toBeHidden();
  await expect(button, 'focus returns to the button').toBeFocused();

  // AC-6, AC-8: a workspace with room for 352 px (600 less the menu's 248): a stored 400 shows 352 and is still 400; the choices that do not fit are off, with the reason. The room is made by narrowing the workspace element.
  await handle.focus();
  await page.keyboard.press('End');
  await expectWidth(page, MAXIMUM);
  const narrowWorkspace = async (pixels: number | null): Promise<void> => {
    await column(page).evaluate((element, width) => {
      element.parentElement?.style.setProperty('width', width === null ? '' : `${width}px`);
    }, pixels);
  };
  await narrowWorkspace(600);
  await expect(handle).toHaveAttribute('aria-valuemax', '352');
  await expectWidth(page, 352);
  expect(await stored(page, ownerId), 'a clamp never rewrites the stored width').toBe('400');
  await button.click();
  await expect(wide).toBeDisabled();
  await expect(wide).toHaveAccessibleDescription('Not enough room at this window size');
  await expect(standard).toBeEnabled();
  await narrowWorkspace(520);
  await expect(handle).toHaveAttribute('aria-valuemax', '272');
  await expect(standard).toBeDisabled();
  await expect(standard).toHaveAccessibleDescription('Not enough room at this window size');
  await expect(narrow).toBeEnabled();
  await narrowWorkspace(null);
  await expect(handle).toHaveAttribute('aria-valuemax', String(MAXIMUM));
  await expectWidth(page, MAXIMUM);
  expect(await stored(page, ownerId), 'the stored 400 comes back with the room').toBe('400');
  await page.keyboard.press('Escape');

});

test('AC-8: nothing stored gives 320; a width that was stored is back after a reload, and a width stored under the key of another person is not read', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const handle = handleOf(page);
  await expect(handle).toBeVisible();
  await expectWidth(page, DEFAULT_WIDTH);
  await store(page, storageKey(ownerId), '400');
  await store(page, `${storageKey(ownerId)}-another`, '280');
  await page.reload();
  await waitForForm(page);
  await expect(handle).toBeVisible();
  await expectWidth(page, MAXIMUM);
});

test('AC-8: a stored value that is not a width gives 320 and no message (the other bad values and a storage that throws are unit tests)', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  await store(page, storageKey(ownerId), 'abc');
  await page.reload();
  await waitForForm(page);
  await expect(handleOf(page)).toBeVisible();
  await expectWidth(page, DEFAULT_WIDTH);
  await expect(textAlerts(page)).toHaveCount(0);
});

test('AC-15: axe finds nothing at the narrowest (240 px) and the widest (400 px) tree, and at the standard width with the Tree width group open', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const handle = handleOf(page);
  await expect(handle).toBeVisible();
  await handle.focus();
  for (const [key, width] of [
    ['Home', MINIMUM],
    ['End', MAXIMUM],
  ] as const) {
    await page.keyboard.press(key);
    await expectWidth(page, width);
    await expectFormAccessible(page);
  }
  await page.keyboard.press('Enter');
  await expectWidth(page, DEFAULT_WIDTH);
  await widthButton(page).click();
  await expect(page.getByRole('radiogroup', { name: 'Tree width' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('AC-6, AC-11: a press at the centre of a row still chooses it at 240 and 400 px, and a long name wraps with no sideways scroll (the status icon stays at the right)', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);

  // One part with a long name: the name is set in the page (no second load), so it wraps in the column and the status icon stays at the right.
  await page.locator('#parts-tree-panel a[data-part-id] [data-sl-no]').first().evaluate((number) => {
    const name = number.nextElementSibling;
    if (name !== null) name.textContent = 'Invented bracket assembly with an unusually long descriptive name that keeps going and going';
  });
  const handle = handleOf(page);
  await expect(handle).toBeVisible();
  await handle.focus();
  const row = tree(page).getByRole('link').first();

  for (const [key, width] of [
    ['Home', MINIMUM],
    ['End', MAXIMUM],
  ] as const) {
    await page.keyboard.press(key);
    await expectWidth(page, width);
    {
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
  }
});

test('DEF-085, DL-391: the form comes first and the controls appear in place: before the handle and the menu have loaded (their code held) there is no separator and no Tree width button, the slot is an empty hidden box, the stored 400 px is applied, and when the code arrives nothing moves and a focus in the form stays', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  await page.setViewportSize({ width: 1280, height: 900 });
  const controls = await holdControlsCode(page, 'hold');
  try {
    await store(page, storageKey(ownerId), '400');
    await page.reload();
    await waitForForm(page);

    // Before: the form is there, the controls are not; the slot holds the button's place and nothing else.
    await expect(page.getByRole('separator')).toHaveCount(0);
    await expect(widthButton(page)).toHaveCount(0);
    await expect(slot(page)).toHaveCount(1);
    expect(await slot(page).evaluate((element) => ({ hidden: element.getAttribute('aria-hidden'), tabindex: element.getAttribute('tabindex'), text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))).toEqual({ hidden: 'true', tabindex: null, text: '', width: 32, height: 32 });
    expect(await columnWidth(page), 'the stored width is applied by the eager part, before the code of the controls').toBe(MAXIMUM);
    const before = await boxes(page);
    // Without scrolling, so the boxes are compared where they stood.
    await control(page, 'J').evaluate((element) => element.focus({ preventScroll: true }));

    // After: the code arrives; the controls appear in their places.
    controls.release();
    await expect(handleOf(page)).toBeVisible();
    await expect(widthButton(page)).toBeVisible();
    await expectWidth(page, MAXIMUM);
    expect(await boxes(page), 'the head, the count, the tree card and the form have not moved').toEqual(before);
    await expect(control(page, 'J'), 'a focus in the form stays where it was').toBeFocused();
  } finally {
    await controls.stop();
  }
});

test('DEF-085, DL-391: when the code of the controls cannot be fetched the page works, the width is the stored one and no error is shown', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'desktop', DESKTOP_ONLY);
  const controls = await holdControlsCode(page, 'refuse');
  try {
    await store(page, storageKey(ownerId), '400');
    const refused = page.waitForResponse((response) => response.status() === 503 && response.url().includes('/_next/static/chunks/'));
    await page.reload();
    await waitForForm(page);
    await refused;
    await expect(page.getByRole('separator')).toHaveCount(0);
    await expect(widthButton(page)).toHaveCount(0);
    await expect(textAlerts(page), 'no error for an enhancement that did not load').toHaveCount(0);
    expect(await columnWidth(page)).toBe(MAXIMUM);
    await expect(control(page, 'J')).toBeEnabled();
  } finally {
    await controls.stop();
  }
});
