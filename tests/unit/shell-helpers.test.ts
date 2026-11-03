import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/cn';
import { ColourParseError, contrastRatio, parseHexColour, relativeLuminance } from '@/lib/contrast';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { initialsOf } from '@/lib/initials';
import { isActivePath } from '@/lib/nav';
import { computeStickyOffsets, STICKY_CLEARANCE } from '@/lib/sticky-offsets';

describe('cn', () => {
  it('joins class names and drops the falsy ones', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
    expect(cn()).toBe('');
  });
});

describe('contrast ratio (WCAG)', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#DE3030', '#de3030')).toBeCloseTo(1, 5);
  });

  it('does not depend on the order of the two colours', () => {
    expect(contrastRatio('#DE3030', '#FFFFFF')).toBe(contrastRatio('#FFFFFF', '#DE3030'));
  });

  it('gives the luminance of white as 1 and of black as 0', () => {
    expect(relativeLuminance(parseHexColour('#ffffff'))).toBeCloseTo(1, 5);
    expect(relativeLuminance(parseHexColour('#000000'))).toBe(0);
  });

  it('rejects a colour that is not #RRGGBB, so a typo cannot pass silently', () => {
    for (const bad of ['#FFF', 'white', 'rgb(0,0,0)', '#GG0000', '']) {
      expect(() => parseHexColour(bad), bad).toThrow(ColourParseError);
    }
  });
});

describe('isActivePath (side menu)', () => {
  it('matches the home link only on the home page', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/design-system', '/')).toBe(false);
  });

  it('matches an entry on its own page and on pages below it, not on a name that merely starts the same', () => {
    expect(isActivePath('/estimates', '/estimates')).toBe(true);
    expect(isActivePath('/estimates/Q-1', '/estimates')).toBe(true);
    expect(isActivePath('/estimates-archive', '/estimates')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isActivePath('/design-system/', '/design-system')).toBe(true);
  });
});

describe('initialsOf (avatar)', () => {
  it('uses the first and last word', () => {
    expect(initialsOf('Meera Iyer')).toBe('MI');
    expect(initialsOf('Meera Kumar Iyer')).toBe('MI');
  });

  it('uses one letter for one word and capitalises it', () => {
    expect(initialsOf('meera')).toBe('M');
  });

  it('never returns an empty avatar', () => {
    expect(initialsOf('   ')).toBe('?');
    expect(initialsOf('')).toBe('?');
  });
});

describe('computeStickyOffsets (WCAG 2.4.11)', () => {
  it('adds the height of the bars on each edge and the clearance', () => {
    const offsets = computeStickyOffsets([
      { edge: 'top', height: 64 },
      { edge: 'top', height: 36.4 },
      { edge: 'bottom', height: 181 },
    ]);
    expect(offsets).toEqual({ top: Math.ceil(100.4 + STICKY_CLEARANCE), bottom: 181 + STICKY_CLEARANCE });
  });

  it('keeps the clearance on an edge that has no bar', () => {
    expect(computeStickyOffsets([{ edge: 'top', height: 64 }]).bottom).toBe(STICKY_CLEARANCE);
    expect(computeStickyOffsets([])).toEqual({ top: STICKY_CLEARANCE, bottom: STICKY_CLEARANCE });
  });

  it('ignores a negative height', () => {
    expect(computeStickyOffsets([{ edge: 'top', height: -20 }]).top).toBe(STICKY_CLEARANCE);
  });
});

describe('isDesignSystemAvailable (AC-7)', () => {
  it('AC-7: is available in development and test', () => {
    expect(isDesignSystemAvailable('development')).toBe(true);
    expect(isDesignSystemAvailable('test')).toBe(true);
    expect(isDesignSystemAvailable(undefined)).toBe(true);
  });

  it('AC-7 (negative): is not available in a production build', () => {
    expect(isDesignSystemAvailable('production')).toBe(false);
  });
});
