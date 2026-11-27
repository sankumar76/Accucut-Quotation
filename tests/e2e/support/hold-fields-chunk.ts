import type { Page } from '@playwright/test';

/**
 * Holds the part form's fields chunk (`part-fields.tsx`, fetched after the page is up) until the test lets it go, so the moment of the swap from the form's placeholder to the form is the test's and not the network's
 * (DEF-145). **A deterministic hold, not a wait:** every script of the page is fetched through the route and answered, and the one that draws the form (it holds the JSX prop `data-part-form`, which no other module of
 * the page writes as a prop: the attribute's name elsewhere is a string constant or a selector) is answered only after `release()`. The chunk's own request is what waits, so nothing else is slowed.
 */
export interface HeldChunk {
  /** Lets the held chunk go: the form replaces its placeholder as soon as the page has it. */
  readonly release: () => void;
  /** How many requests of the fields chunk are being held now (it is fetched once per page). */
  readonly held: () => number;
}

const FORM_PROP = /["']data-part-form["']\s*:/;

export async function holdFieldsChunk(page: Page): Promise<HeldChunk> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (FORM_PROP.test(body)) {
      held += 1;
      await gate;
      held -= 1;
    }
    await route.fulfill({ response, body });
  });
  return { release, held: () => held };
}
