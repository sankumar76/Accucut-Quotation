import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { AccountTrigger } from '@/components/shared/account-trigger';
import { buttonVariants } from '@/components/ui/button';

import { buildCss, declarationsOf, declarationsOfClass, isInsideHoverQuery, ruleOf, type Declaration } from '../support/css-declarations';

/**
 * AQP-188 (UX spec 7.3.1 rule 11): a control that opens an overlay on its first open is enabled, has `aria-busy="true"`, and
 * keeps its variant's pressed look held. The look is keyed to the attribute, so it shows before React has run (the early tap,
 * DEF-013). Tailwind builds the CSS of the real classes here, and these tests read what it made. The computed colour in a
 * browser is in `tests/e2e/shell-lazy-load.spec.ts`.
 */

const PENDING = [
  ['primary', 'primary-pressed', 'on-fill'],
  ['secondary', 'border', 'ink'],
  ['ghost', 'primary-line', 'ink'],
  ['danger', 'danger-pressed', 'on-fill'],
] as const;

const classesOf = (variant: (typeof PENDING)[number][0]): string[] => buttonVariants({ variant }).split(' ');

let all: Declaration[] = [];
const accountTriggerClasses = (): string[] =>
  (/ class="([^"]*)"/.exec(renderToStaticMarkup(createElement(AccountTrigger, { user: { name: 'Invented Person', email: 'a@example.test', role: 'Lead' } })))?.[1] ?? '')
    .split(' ')
    .filter((name) => name !== '');

beforeAll(async () => {
  all = declarationsOf(await buildCss([...PENDING.flatMap(([variant]) => classesOf(variant)), ...accountTriggerClasses()]));
});

describe('the held pressed look of a pending first open (rule 11)', () => {
  it.each(PENDING)('%s: an enabled button with aria-busy takes the pressed fill and text, outside the hover query', (variant, background, text) => {
    expect(classesOf(variant)).toEqual(
      expect.arrayContaining([
        `enabled:aria-busy:bg-${background}`,
        `enabled:aria-busy:text-${text}`,
        'enabled:aria-busy:shadow-pressed',
        'enabled:aria-busy:transition-none',
      ]),
    );
    const fill = declarationsOfClass(all, `enabled:aria-busy:bg-${background}`).find((declaration) => declaration.property === 'background-color');
    expect(fill?.value).toBe(`var(--${background})`);
    expect(fill && ruleOf(fill)).toMatch(/:enabled/);
    expect(fill && ruleOf(fill)).toMatch(/aria-busy/);
    expect(fill && isInsideHoverQuery(fill)).toBe(false);
  });

  it('a loading button (disabled) is not matched: the look needs :enabled', () => {
    for (const [variant, background] of PENDING) {
      const fill = declarationsOfClass(all, `enabled:aria-busy:bg-${background}`).find((declaration) => declaration.property === 'background-color');
      expect(fill && ruleOf(fill), variant).toMatch(/:enabled/);
    }
  });

  it('the held look wins over the hover colour: its rule comes after it', () => {
    const hover = declarationsOfClass(all, 'hover:bg-surface-2').find((declaration) => declaration.property === 'background-color');
    const held = declarationsOfClass(all, 'enabled:aria-busy:bg-border').find((declaration) => declaration.property === 'background-color');
    expect(hover && held && held.order > hover.order).toBe(true);
  });

  it('the account trigger has a pressed rule and the held look (it had neither before AQP-188)', () => {
    const classes = accountTriggerClasses();
    expect(classes).toEqual(
      expect.arrayContaining([
        'active:bg-border',
        'active:shadow-pressed',
        'active:transition-none',
        'enabled:aria-busy:bg-border',
        'enabled:aria-busy:shadow-pressed',
        'enabled:aria-busy:transition-none',
        'select-none',
        '[-webkit-touch-callout:none]',
        'hover:bg-surface-2',
      ]),
    );
    const active = declarationsOfClass(all, 'active:bg-border').find((declaration) => declaration.property === 'background-color');
    expect(active && isInsideHoverQuery(active)).toBe(false);
  });

  it('the account trigger keeps its accessible name and is a button that submits nothing', () => {
    const markup = renderToStaticMarkup(createElement(AccountTrigger, { user: { name: 'Invented Person', email: 'a@example.test', role: 'Lead' } }));
    expect(markup).toContain('aria-label="Account menu, Invented Person, Lead"');
    expect(markup).toContain('type="button"');
  });
});
