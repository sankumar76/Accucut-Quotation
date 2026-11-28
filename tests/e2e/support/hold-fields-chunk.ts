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

export const FORM_PROP = /["']data-part-form["']\s*:/;

export const holdFieldsChunk = (page: Page): Promise<HeldChunk> => holdChunkHolding(page, FORM_PROP);

/** The same hold for the one script that holds `marker`: the fields chunk above, or the review's editing island (`review-tree-editor.tsx`, which alone writes its own words). */
export async function holdChunkHolding(page: Page, marker: RegExp): Promise<HeldChunk> {
  return (await holdChunks(page, { only: marker })).only;
}

/**
 * Several holds in one route (a page has one route for its scripts: a second route would answer first and never pass the request on): each script is held by the first marker it holds, and let go by that
 * marker's own `release()`. The fields chunk and the editing island can be held apart, so the page can be seen in each of its three states: the ghost, the read-only form, and the island.
 */
export async function holdChunks<K extends string>(page: Page, markers: Readonly<Record<K, RegExp>>): Promise<Readonly<Record<K, HeldChunk>>> {
  const keys = Object.keys(markers) as K[];
  const gates = new Map<K, { release: () => void; gate: Promise<void>; held: number }>();
  for (const key of keys) {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    gates.set(key, { release, gate, held: 0 });
  }
  await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const key = keys.find((candidate) => markers[candidate].test(body));
    const entry = key === undefined ? undefined : gates.get(key);
    if (entry !== undefined) {
      entry.held += 1;
      await entry.gate;
      entry.held -= 1;
    }
    await route.fulfill({ response, body });
  });
  const out = {} as Record<K, HeldChunk>;
  for (const key of keys) {
    const entry = gates.get(key);
    if (entry === undefined) continue;
    out[key] = { release: entry.release, held: () => entry.held };
  }
  return out;
}
