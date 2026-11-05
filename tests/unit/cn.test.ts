import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cn, THEME_SHADOWS, THEME_SPACING, THEME_TEXT_SIZES } from '@/lib/cn';

/**
 * The architect's ruling on AQP-28 (Jira 10705, item 2): `cn` is `clsx` plus `tailwind-merge`, configured with this
 * theme's own text sizes and 4-point spacing. With the stock `twMerge`, `text-body` is read as a colour and
 * dropped when a colour follows it, and `p-s-2 p-s-4` is not resolved (QLT-01: a secondary button lost its border
 * because two `border-color` classes were both kept).
 */

const globals = readFileSync(fileURLToPath(new URL('../../src/app/globals.css', import.meta.url)), 'utf8');

/** Names after a prefix in the `@theme inline` block, for example `--text-body:` gives `body`. */
function themeNames(prefix: string): string[] {
  return [...globals.matchAll(new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, 'gm'))]
    .map((match) => match[1] ?? '')
    .filter((name) => !name.includes('--') && !name.endsWith('line-height'));
}

describe('cn', () => {
  it('joins class names and drops the falsy ones', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
    expect(cn()).toBe('');
  });

  it('accepts clsx forms: objects and arrays', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });

  it('QLT-01: a later border colour replaces an earlier one, so a variant can override the base', () => {
    expect(cn('border border-transparent', 'border-border-strong')).toBe('border border-border-strong');
  });

  it('architect ruling, case 1: a theme text size survives a colour that follows it', () => {
    expect(cn('text-body font-semibold text-on-fill p-s-2 p-s-4')).toBe('text-body font-semibold text-on-fill p-s-4');
  });

  it('architect ruling, case 2: two theme text sizes conflict and the later one wins', () => {
    expect(cn('text-body', 'text-label')).toBe('text-label');
    expect(cn('text-heading text-ink', 'text-sub')).toBe('text-ink text-sub');
  });

  it('architect ruling, case 3: two spacing steps of the same property conflict, different properties do not', () => {
    expect(cn('px-s-4', 'px-s-2')).toBe('px-s-2');
    expect(cn('px-s-4', 'py-s-2')).toBe('px-s-4 py-s-2');
    expect(cn('gap-s-1', 'gap-s-3')).toBe('gap-s-3');
  });

  it('keeps the custom shadow, radius and size classes the components use, and resolves them', () => {
    expect(cn('shadow-card', 'shadow-none')).toBe('shadow-none');
    expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg');
    expect(cn('h-(--control-h) px-s-4', 'h-(--control-h-row)')).toBe('px-s-4 h-(--control-h-row)');
  });
});

describe('cn is configured for every theme token', () => {
  it('registers exactly the text sizes of the token file', () => {
    expect([...THEME_TEXT_SIZES].sort()).toEqual(themeNames('text').sort());
  });

  it('registers exactly the spacing steps of the token file (the s-1 to s-7 scale)', () => {
    const scale = themeNames('spacing').filter((name) => /^s-\d+$/.test(name));
    expect([...THEME_SPACING].sort()).toEqual(scale.sort());
  });

  it('registers exactly the shadows of the token file (card, overlay, pressed; DEF-008)', () => {
    // --shadow-1 and --shadow-2 are the raw values; the named ones (card, overlay, pressed) are the utilities.
    const named = new Set(themeNames('shadow').filter((name) => /^[a-z]/.test(name)));
    expect([...THEME_SHADOWS].sort()).toEqual([...named].sort());
  });

  it('DEF-008: shadow-pressed is a shadow, so it conflicts with another shadow and not with a shadow colour', () => {
    expect(cn('shadow-card', 'shadow-pressed')).toBe('shadow-pressed');
    expect(cn('shadow-pressed', 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-pressed', 'shadow-ink')).toBe('shadow-pressed shadow-ink');
  });

  it.each(themeNames('text'))('text-%s is a size, so a colour after it does not drop it', (size) => {
    expect(cn(`text-${size}`, 'text-on-fill')).toBe(`text-${size} text-on-fill`);
    expect(cn(`text-${size}`, 'text-heading')).toBe('text-heading');
  });

  it.each(themeNames('spacing').filter((name) => /^s-\d+$/.test(name)))('p-%s conflicts with another padding step', (step) => {
    expect(cn(`p-${step}`, 'p-s-1')).toBe('p-s-1');
  });
});
