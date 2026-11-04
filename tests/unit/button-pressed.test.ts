import { beforeAll, describe, expect, it } from 'vitest';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import {
  buildCss,
  declarationsOf,
  declarationsOfClass,
  isInsideHoverQuery,
  ruleOf,
  type Declaration,
} from '../support/css-declarations';

/**
 * DEF-008 (Jira AQP-183, UX spec section 7.3.1): every button variant shows a pressed state for mouse, finger and pen.
 * A phone has no hover, so the hover colours (which Tailwind wraps in `@media (hover: hover)`) are no sign that a tap
 * registered. These tests have Tailwind build the CSS of the real token file and the real button classes, and read
 * what it made: each variant's `:active` rule must exist outside the hover media query, must come after the hover
 * rule it overrides, and a disabled button must show nothing. The computed result in a browser is in
 * `tests/e2e/button-pressed.spec.ts`.
 */

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const SIZES = ['default', 'icon', 'icon-row'] as const;

/** UX spec 7.3.1: [variant, pressed background token, pressed text token, the hover class it must beat]. */
const PRESSED = [
  ['primary', 'primary-hover', 'on-fill', 'hover:bg-primary-hover'],
  ['secondary', 'border', 'ink', 'hover:bg-surface-2'],
  ['ghost', 'primary-line', 'ink', 'hover:bg-primary-soft'],
  ['danger', 'danger-ink', 'on-fill', 'hover:bg-danger-ink'],
] as const;

const classesOf = (variant: (typeof VARIANTS)[number], size: (typeof SIZES)[number] = 'default'): string[] =>
  buttonVariants({ variant, size }).split(' ');

let all: Declaration[] = [];

beforeAll(async () => {
  const candidates = VARIANTS.flatMap((variant) => SIZES.flatMap((size) => classesOf(variant, size)));
  all = declarationsOf(await buildCss([...new Set(candidates)]));
});

const valueOf = (className: string, property: string): Declaration | undefined =>
  declarationsOfClass(all, className).find((declaration) => declaration.property === property);

describe('pressed state in the built CSS, DEF-008', () => {
  it.each(PRESSED)('%s: active sets the pressed fill, text and inset shadow, and none of it is inside the hover query', (variant, background, text) => {
    const fill = valueOf(`active:bg-${background}`, 'background-color');
    const colour = valueOf(`active:text-${text}`, 'color');
    const shadow = declarationsOfClass(all, 'active:shadow-pressed').find((declaration) => declaration.value.includes('--shadow-pressed'));

    expect(classesOf(variant)).toEqual(expect.arrayContaining([`active:bg-${background}`, `active:text-${text}`, 'active:shadow-pressed']));
    for (const declaration of [fill, colour, shadow]) {
      expect(declaration, `${variant}: no active rule was generated`).toBeDefined();
      expect(declaration && ruleOf(declaration)).toMatch(/:active$/);
      expect(declaration && isInsideHoverQuery(declaration)).toBe(false);
    }
    expect(fill?.value).toBe(`var(--${background})`);
    expect(colour?.value).toBe(`var(--${text})`);
  });

  it('the hover colours stay limited to devices that can hover', () => {
    for (const [, , , hoverClass] of PRESSED) {
      const hover = declarationsOfClass(all, hoverClass).find((declaration) => declaration.property === 'background-color');
      expect(hover, hoverClass).toBeDefined();
      expect(hover && isInsideHoverQuery(hover), hoverClass).toBe(true);
    }
  });

  it('pressed wins over hover: the active rule comes after the hover rule it overrides', () => {
    for (const [variant, background, , hoverClass] of PRESSED) {
      const hover = valueOf(hoverClass, 'background-color');
      const pressed = valueOf(`active:bg-${background}`, 'background-color');
      expect(pressed && hover && pressed.order > hover.order, `${variant}: ${hoverClass} comes after active:bg-${background}`).toBe(true);
    }
  });

  it('a disabled button shows no pressed state: disabled:active resets fill, text and shadow, after every active rule', () => {
    const fill = valueOf('disabled:active:bg-surface-2', 'background-color');
    const text = valueOf('disabled:active:text-ink-3', 'color');
    const shadow = declarationsOfClass(all, 'disabled:active:shadow-none').find((declaration) => declaration.value.includes('0 0 #0000'));
    expect(fill && ruleOf(fill)).toMatch(/:disabled:active$/);
    expect(fill?.value).toBe('var(--surface-2)');
    expect(text?.value).toBe('var(--ink-3)');
    expect(shadow, 'disabled:active:shadow-none').toBeDefined();
    const lastActive = Math.max(...PRESSED.map(([, background]) => valueOf(`active:bg-${background}`, 'background-color')?.order ?? -1));
    expect(fill?.order).toBeGreaterThan(lastActive);
    for (const variant of VARIANTS) {
      expect(classesOf(variant)).toEqual(
        expect.arrayContaining(['disabled:active:bg-surface-2', 'disabled:active:text-ink-3', 'disabled:active:shadow-none']),
      );
    }
  });

  it('the 44 px icon square and the 36 px row icon button carry the pressed look of their variant', () => {
    for (const size of ['icon', 'icon-row'] as const) {
      for (const [variant, background, text] of PRESSED) {
        expect(classesOf(variant, size), `${variant} ${size}`).toEqual(
          expect.arrayContaining([`active:bg-${background}`, `active:text-${text}`, 'active:shadow-pressed']),
        );
      }
    }
  });

  it('cn keeps every pressed class of a button, and a later shadow replaces the pressed one', () => {
    for (const variant of VARIANTS) {
      const merged = cn(buttonVariants({ variant })).split(' ');
      expect(merged).toEqual(expect.arrayContaining(['active:shadow-pressed', 'disabled:active:shadow-none']));
    }
    expect(cn('active:shadow-pressed', 'active:shadow-none')).toBe('active:shadow-none');
  });
});
