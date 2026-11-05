import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  errorReference,
  ERROR_REFERENCE_TEXT,
  ERROR_TEXT,
  ERROR_TITLE,
  HOME_ACTION_LABEL,
  HomeAction,
  NOT_FOUND_MENU_TEXT,
  NOT_FOUND_TEXT,
  NOT_FOUND_TITLE,
  NO_ACCESS_TEXT,
  NO_ACCESS_TITLE,
  SystemPageCard,
} from '@/components/features/system-pages/system-page';

/**
 * STORY-01.02 AC-8 (SCR-26): each system page has one clear action; the error page shows a reference and never technical
 * detail; the "no access" page is identical for every role and for every page that was asked for.
 */

const html = (element: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(element);
const noAccess = () => createElement(SystemPageCard, { kind: 'forbidden', action: createElement(HomeAction) });

describe('AC-8: the three system pages', () => {
  it('"no access" says it in the words of SCR-26 and names no page, role or record', () => {
    const markup = html(noAccess());
    expect(markup).toContain(NO_ACCESS_TITLE);
    expect(markup).toContain(NO_ACCESS_TEXT);
    expect(NO_ACCESS_TITLE).toBe('You do not have access to this page');
    expect(markup).not.toMatch(/estimate|cost|Q-\d{4}|\/users|\/masters|\/config/i);
  });

  it('"not found" points at the menu only where there is a menu', () => {
    const standalone = html(createElement(SystemPageCard, { kind: 'not-found', action: createElement(HomeAction) }));
    const inFrame = html(createElement(SystemPageCard, { kind: 'not-found', hasMenu: true, action: createElement(HomeAction) }));
    expect(standalone).toContain(NOT_FOUND_TITLE);
    expect(standalone).toContain(NOT_FOUND_TEXT);
    expect(standalone).not.toContain(NOT_FOUND_MENU_TEXT);
    expect(inFrame).toContain(NOT_FOUND_MENU_TEXT);
  });

  it('"error" shows a reference of the form req-… and nothing technical', () => {
    const reference = errorReference('1234567890');
    expect(reference).toBe('req-1234567890');
    const markup = html(createElement(SystemPageCard, { kind: 'error', reference, action: createElement('button', null, 'Try again') }));
    expect(markup).toContain(ERROR_TITLE);
    expect(markup).toContain(ERROR_TEXT);
    expect(markup).toContain(ERROR_REFERENCE_TEXT);
    expect(markup).toContain('req-1234567890');
    expect(markup).not.toMatch(/stack|Error:|at \w+\.|node_modules|ECONN/i);
  });

  it('"error" has a reference even when Next.js gave no digest', () => {
    expect(errorReference(undefined)).toBe('req-unknown');
  });

  it('each page has one h1, and one action (a link home, or the retry button)', () => {
    for (const kind of ['forbidden', 'not-found'] as const) {
      const markup = html(createElement(SystemPageCard, { kind, action: createElement(HomeAction) }));
      expect(markup.match(/<h1\b/g)).toHaveLength(1);
      expect(markup.match(/<a\b/g)).toHaveLength(1);
      expect(markup).toContain(HOME_ACTION_LABEL);
      expect(markup).toContain('href="/queue"');
    }
  });

  it('the decorative icon is hidden from assistive technology', () => {
    expect(html(noAccess())).toContain('aria-hidden="true"');
  });
});

describe('AC-8: "no access" is the same whoever asks and whatever was asked for', () => {
  it('renders the same markup every time (it takes no input), so content and cost of rendering cannot vary', () => {
    const first = html(noAccess());
    for (let attempt = 0; attempt < 5; attempt += 1) expect(html(noAccess())).toBe(first);
  });
});
