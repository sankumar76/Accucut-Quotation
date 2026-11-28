import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PICTURE_ZONE_HEIGHT_HELD, PICTURE_ZONE_HEIGHT_UNHINTED, PICTURE_ZONE_RESERVE, PICTURE_ZONE_RESERVE_HELD } from '@/components/shared/form-layout';

/**
 * PF-19 (DL-465, AQP-488): the read-only form of an editable page holds the island's picture box as a least height on `#row-inputs`. Tailwind reads class names as written, so the two reserve strings are
 * literals; each is **derived here from the height it follows**, so one cannot change without the other. Every value is invented or read from a control.
 */

/** `h-[146px] md:h-[114px]` -> `[&_[data-picture-zone]]:min-h-[146px] md:[&_[data-picture-zone]]:min-h-[114px]`. */
const reserveOf = (heights: string): string =>
  heights
    .split(' ')
    .map((token) => {
      const match = /^((?:md:|lg:)?)h-(\[[0-9]+px\])$/.exec(token);
      if (match === null) throw new Error('not a plain height: ' + token);
      return `${match[1] ?? ''}[&_[data-picture-zone]]:min-h-${match[2] ?? ''}`;
    })
    .join(' ');

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('PF-19: the picture box reserve follows the editable control\'s box', () => {
  it('the empty reserve is the unhinted editable height as a least height', () => {
    expect(PICTURE_ZONE_RESERVE).toBe(reserveOf(PICTURE_ZONE_HEIGHT_UNHINTED));
  });

  it('the held reserve is the picture-held editable height as a least height', () => {
    expect(PICTURE_ZONE_RESERVE_HELD).toBe(reserveOf(PICTURE_ZONE_HEIGHT_HELD));
  });

  it('a held picture is a little different from none at 360 px (the prompt line goes) and the same size from 768 px', () => {
    expect(PICTURE_ZONE_HEIGHT_HELD).toBe('h-[132px] md:h-[116px]');
  });

  it('the page reserves by the seed\'s part, only for an editable tree, and the ghost and the placeholder of the picture take the held height', () => {
    const review = read('src/components/features/estimate-review/estimate-review.tsx');
    expect(review).toMatch(/editTree && \(pictureHeldOf\(seed\?\.part\) \? PICTURE_ZONE_RESERVE_HELD : PICTURE_ZONE_RESERVE\)/);
    expect(read('src/components/features/estimate-workspace/part-form-ghost.tsx')).toContain('held ? PICTURE_ZONE_HEIGHT_HELD : PICTURE_ZONE_HEIGHT_UNHINTED');
    expect(read('src/components/features/estimate-workspace/picture-slot.tsx')).toContain('held ? PICTURE_ZONE_HEIGHT_HELD : PICTURE_ZONE_HEIGHT_UNHINTED');
  });
});
