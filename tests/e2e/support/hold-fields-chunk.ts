import type { Page } from '@playwright/test';

/**
 * Holds the part form's fields chunk (`part-fields.tsx`, fetched after the page is up) until the test lets it go, so the moment of the swap from the form's placeholder to the form is the test's and n
 * (DEF-145). **A deterministic hold, not a wait:** every script of the page is fetched through the route and answered, and the one that draws the form (it holds the JSX prop `data-part-form`, which n
 * the page writes as a prop: the attribute's name elsewhere is a string constant or a selector) is answered only after `release()`. The chunk's own request is what waits, so nothing else is slowed.
 *
 * With `picture: true` the picture control's chunk (`part-picture.tsx`: it holds the JSX prop `data-picture-zone` and not the form's) is held too, until `releasePicture()`. The form shows its own picture
 * placeholder until that control arrives, and the control is then a different height for the Lead's read-only view: a second shift that is the form's and not the placeholder's, which a measurement of the swap must
 * not mix in (QLT-833-01).
 */
export interface HeldChunk {
  /** Lets the held chunk go: the form replaces its placeholder as soon as the page has it. */
  readonly release: () => void;
  /** How many requests of the fields chunk are being held now (it is fetched once per page). */
  readonly held: () => number;
  /** Lets the picture control's chunk go (with `picture: true`; a no-op otherwise). */
  readonly releasePicture: () => void;
}

const FORM_PROP = /["']data-part-form["']\s*:/;
const PICTURE_PROP = /["']data-picture-zone["']\s*:/;

export async function holdFieldsChunk(page: Page, options: { readonly picture?: boolean } = {}): Promise<HeldChunk> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let releasePicture: () => void = () => undefined;
  const pictureGate = new Promise<void>((resolve) => {
    releasePicture = resolve;
  });
  let held = 0;
  await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (FORM_PROP.test(body)) {
      held += 1;
      await gate;
      held -= 1;
    } else if (options.picture === true && PICTURE_PROP.test(body)) {
      await pictureGate;
    }
    await route.fulfill({ response, body });
  });
  return { release, held: () => held, releasePicture };
}
