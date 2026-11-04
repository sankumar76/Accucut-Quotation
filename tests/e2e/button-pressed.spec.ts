import { expect, test, type Locator, type Page } from '@playwright/test';

import { PAGE, tokenColour } from './support/design-system';

/**
 * DEF-008 (Jira AQP-183, UX spec section 7.3.1): the computed pressed look of every button variant, with the mouse
 * held down on it, at 360x800, 768x1024 and 1366x768 (the three Playwright projects). The mouse is first moved onto
 * the button, so on a screen that can hover the button is hovered and pressed together and pressed must win.
 * A disabled button shows nothing, even with the pointer down on it. The sample buttons are SCR-00 section 05.
 */

/** `inset 0 2px 4px rgba(23, 24, 28, 0.28)` as the browser reports it inside a computed box-shadow. */
const PRESSED_SHADOW = 'rgba(23, 24, 28, 0.28) 0px 2px 4px 0px inset';
/** The graphite of the pressed shadow. A computed box-shadow without it shows no visible shadow. */
const GRAPHITE = 'rgba(23, 24, 28';

interface Sample {
  readonly name: string;
  readonly find: (page: Page) => Locator;
  /** Tokens of the pressed fill and of the pressed text. */
  readonly background: string;
  readonly text: string;
}

/** SCR-00 section 05: the `<section>` is named by its heading (`aria-labelledby`), so it is the "Buttons" region. */
const buttons = (page: Page): Locator => page.getByRole('region', { name: 'Buttons', exact: true });

const SAMPLES: readonly Sample[] = [
  { name: 'primary', find: (page) => buttons(page).getByRole('button', { name: 'Calculate' }), background: '--primary-hover', text: '--on-fill' },
  { name: 'secondary', find: (page) => buttons(page).getByRole('button', { name: 'Add part' }), background: '--border', text: '--ink' },
  { name: 'ghost', find: (page) => buttons(page).getByRole('button', { name: 'Cancel' }), background: '--primary-line', text: '--ink' },
  { name: 'danger', find: (page) => buttons(page).getByRole('button', { name: 'Delete' }), background: '--danger-ink', text: '--on-fill' },
  { name: 'icon (44 px square, secondary)', find: (page) => buttons(page).getByRole('button', { name: 'Edit part' }), background: '--border', text: '--ink' },
  { name: 'row icon (36 px square, secondary)', find: (page) => buttons(page).getByRole('button', { name: 'Edit row' }), background: '--border', text: '--ink' },
];

const DISABLED: ReadonlyArray<{ name: string; find: (page: Page) => Locator }> = [
  { name: 'disabled primary', find: (page) => buttons(page).getByRole('button', { name: 'Approve and lock' }) },
  { name: 'disabled secondary', find: (page) => buttons(page).getByRole('button', { name: 'Download Excel' }) },
  { name: 'loading (disabled, aria-busy)', find: (page) => buttons(page).getByRole('button', { name: 'Calculating' }) },
];

/**
 * Tailwind's `shadow-*` utilities set `box-shadow` to a list of five layers (inset shadow, inset ring, ring offset, ring,
 * shadow), most of them transparent zeros. So the computed value is read as text: it holds the pressed shadow, or no
 * graphite at all (`none` when no shadow utility applies, all zeros under `shadow-none`).
 */
async function shadowOf(button: Locator): Promise<string> {
  return button.evaluate((element) => getComputedStyle(element).boxShadow);
}

async function expectPressedShadow(button: Locator, pressed: boolean): Promise<void> {
  if (pressed) await expect.poll(() => shadowOf(button)).toContain(PRESSED_SHADOW);
  else await expect.poll(() => shadowOf(button)).not.toContain(GRAPHITE);
}

async function pointerDownOn(page: Page, button: Locator): Promise<void> {
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (box === null) throw new Error('the button has no box on the page');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

async function sizeOf(button: Locator): Promise<{ width: number; height: number }> {
  const box = await button.boundingBox();
  if (box === null) throw new Error('the button has no box on the page');
  return { width: box.width, height: box.height };
}

test.describe('button pressed state, DEF-008', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.evaluate(() => document.fonts.ready);
  });

  for (const sample of SAMPLES) {
    test(`${sample.name}: pointer down shows the pressed fill, text and inset shadow, and release takes the shadow away`, async ({ page }) => {
      const button = sample.find(page);
      await expect(button).toBeVisible();
      const pressed = await tokenColour(page, sample.background);
      const text = await tokenColour(page, sample.text);

      await expectPressedShadow(button, false);
      await pointerDownOn(page, button);
      try {
        await expect(button).toHaveCSS('background-color', pressed);
        await expect(button).toHaveCSS('color', text);
        await expectPressedShadow(button, true);
      } finally {
        await page.mouse.up();
      }

      // Released with the pointer still over it: the fill may stay (hover), the shadow may not.
      await expectPressedShadow(button, false);
    });

    test(`${sample.name}: the size does not change when it is pressed`, async ({ page }) => {
      const button = sample.find(page);
      await button.scrollIntoViewIfNeeded();
      const before = await sizeOf(button);
      await pointerDownOn(page, button);
      try {
        await expectPressedShadow(button, true);
        expect(await sizeOf(button)).toEqual(before);
      } finally {
        await page.mouse.up();
      }
    });
  }

  for (const sample of DISABLED) {
    test(`${sample.name}: pointer down shows no pressed state`, async ({ page }) => {
      const button = sample.find(page);
      await expect(button).toBeDisabled();
      const fill = await tokenColour(page, '--surface-2');
      const text = await tokenColour(page, '--ink-3');
      await pointerDownOn(page, button);
      try {
        await expect(button).toHaveCSS('background-color', fill);
        await expect(button).toHaveCSS('color', text);
        await expectPressedShadow(button, false);
      } finally {
        await page.mouse.up();
      }
    });
  }
});
