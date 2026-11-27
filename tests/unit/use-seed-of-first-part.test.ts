import { describe, expect, it, vi } from 'vitest';

import { useSeedOfFirstPart } from '@/components/features/estimate-workspace/use-seed-of-first-part';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';

import { renderHook } from '../support/hook-harness';

/**
 * DEF-085 (DL-469): the Engineer's page seeds its form with the values of the first row, as the page read them. The Engineer **edits**, so that snapshot is only the first showing of that row: once the person
 * chooses another row, the first row's values are read from the server when it is chosen again, never taken from the old snapshot (they would show what was there before the person's own saves and make the next
 * save a conflict). The rest of the seed (the definition, the materials and the treatments, which an edit does not change) stays. The hook runs with no DOM (`tests/support/hook-harness.ts`). Invented ids only.
 */

vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);

const FIRST = '00000000-0000-4000-8000-0000000000f1';
const OTHER = '00000000-0000-4000-8000-0000000000f2';
const seed: PartFormSeed = { estimateId: 'e', partId: FIRST, form: { sections: [] }, part: { id: FIRST, inputs: [] }, materials: { options: [] }, treatments: { options: [] } };

interface Props {
  seed: PartFormSeed | undefined;
  partId: string | null;
}

/** Renders twice: the second render is the one that follows the state the first one set, as React's own immediate re-render does. */
function shown(view: { readonly render: () => PartFormSeed | undefined }): PartFormSeed | undefined {
  view.render();
  return view.render();
}

describe('the seed of the first part is for its first showing only', () => {
  it('is the whole seed while the seeded part is the one shown, and before the tree has chosen any part', () => {
    const props: Props = { seed, partId: null };
    const view = renderHook((given: Props) => useSeedOfFirstPart(given.seed, given.partId), props);
    expect(shown(view)).toBe(seed);
    props.partId = FIRST;
    expect(shown(view)).toBe(seed);
  });

  it('keeps the part body out once another part has been shown: the first part is then read from the server when it is chosen again', () => {
    const props: Props = { seed, partId: FIRST };
    const view = renderHook((given: Props) => useSeedOfFirstPart(given.seed, given.partId), props);
    expect(shown(view)).toBe(seed);
    props.partId = OTHER;
    const away = shown(view);
    expect(away?.part).toBeNull();
    props.partId = FIRST;
    const back = shown(view);
    expect(back?.part).toBeNull();
    expect(back?.partId).toBe(FIRST);
  });

  it('keeps the rest of the seed after that: the definition, the materials and the treatments, which an edit does not change', () => {
    const props: Props = { seed, partId: OTHER };
    const view = renderHook((given: Props) => useSeedOfFirstPart(given.seed, given.partId), props);
    const away = defined(shown(view));
    expect(away.form).toBe(seed.form);
    expect(away.materials).toBe(seed.materials);
    expect(away.treatments).toBe(seed.treatments);
    expect(away.estimateId).toBe('e');
  });

  it('gives nothing when there was no seed, and nothing is invented when the seeded part was never the first shown', () => {
    const props: Props = { seed: undefined, partId: FIRST };
    const view = renderHook((given: Props) => useSeedOfFirstPart(given.seed, given.partId), props);
    expect(shown(view)).toBeUndefined();
  });
});

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}
