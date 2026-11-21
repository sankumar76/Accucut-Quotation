import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { AccountMenu } from '@/components/shared/account-menu';
import { ACCOUNT_WRAPPER, AccountTrigger } from '@/components/shared/account-trigger';

import { buildCss, declarationsOf, declarationsOfClass, type Declaration } from '../support/css-declarations';

/**
 * AQP-288 (DEF-034, NFR-016, ux-spec SCR-25): a long signed-in name is cut with an ellipsis inside the top bar and never widens the page. The cause was
 * a chain of flex items with the default minimum width (their content), so a nowrap name of 120 characters set the width of the whole top bar. The fix is
 * `min-w-0` on each flex item between the name and the top bar, and a maximum width on the button. A unit test cannot measure a layout, so this reads
 * the classes the components really render and the CSS Tailwind builds for them; the page-level proof, a 120-character name at 360, 768 and 1366 px in a
 * browser, is in `tests/e2e/account-trigger-name.spec.ts`.
 */

const USER = { name: 'Invented Person', email: 'a@example.test', role: 'Lead' };

const classesOf = (markup: string, pattern: RegExp): string[] => (pattern.exec(markup)?.[1] ?? '').split(' ').filter((name) => name !== '');

let all: Declaration[] = [];

beforeAll(async () => {
  all = declarationsOf(await buildCss([...ACCOUNT_WRAPPER.split(' '), 'max-w-full', 'min-w-0']));
});

const valuesOf = (className: string, property: string): string[] =>
  declarationsOfClass(all, className)
    .filter((declaration) => declaration.property === property)
    .map((declaration) => declaration.value);

describe('the account trigger is bounded by the top bar (AQP-288, DEF-034)', () => {
  it('the wrapper class lets the flex item shrink below its content: min-width 0', () => {
    expect(ACCOUNT_WRAPPER.split(' ')).toContain('min-w-0');
    expect(valuesOf('min-w-0', 'min-width')).toEqual(['0px']);
  });

  it('the plain button of the first load sits in the wrapper', () => {
    const markup = renderToStaticMarkup(createElement(AccountMenu, { user: USER, loadPanel: () => Promise.reject(new Error('not opened')) }));
    expect(classesOf(markup, /^<div class="([^"]*)"/)).toEqual(ACCOUNT_WRAPPER.split(' '));
  });

  it('the button cannot be wider than its wrapper, and its name box can shrink (so the name ends in an ellipsis)', () => {
    const markup = renderToStaticMarkup(createElement(AccountTrigger, { user: USER }));
    expect(classesOf(markup, /^<button[^>]* class="([^"]*)"/)).toContain('max-w-full');
    expect(valuesOf('max-w-full', 'max-width')).toEqual(['100%']);
    expect(markup).toMatch(/<span aria-hidden="true" class="hidden min-w-0 md:block"><span class="block truncate /);
  });
});
