'use client';

import { useState } from 'react';

import type { PartFormSeed } from '@/lib/estimates/part-form-seed';

/**
 * The seed the form may use for the part now shown (DEF-085, DL-469). The Engineer's page hands the form the first row's values **as the page read them**, which is the first showing of that row and no more: the
 * Engineer edits, so once another row has been shown the first row's values are no longer what the page read (the person's own saves came after). From then on the part body is left out of the seed, and the form reads
 * that row from the server whenever it is chosen again. The rest of the seed (the definition, the materials, the treatments) stays: an edit of a part changes none of it. A seed with no part chosen yet (the tree has
 * not answered) or for the part that is shown is used whole. The decision is made in render by a state, as the form's own "a row was chosen" is (`part-form.tsx`), so it cannot be missed by a render.
 */
export function useSeedOfFirstPart(seed: PartFormSeed | undefined, partId: string | null): PartFormSeed | undefined {
  const [left, setLeft] = useState(false);
  if (!left && seed !== undefined && partId !== null && partId !== seed.partId) setLeft(true);
  return seed === undefined || !left ? seed : { ...seed, part: null };
}
