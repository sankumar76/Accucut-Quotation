import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import type { AlertTone } from '@/components/ui/alert';

import { buildCss, declarationsOf, declarationsOfClass, type Declaration } from '../support/css-declarations';

/**
 * AQP-275 (DEF-030): every `Notice` wraps an unbroken name, so the page never scrolls sideways because of one (ux-spec 6.0 "Names wrap",
 * "Zoom and reflow"). The rule is written once, in `shared/break-long-names.ts`; `Notice` applies it and its callers do not. The page-level
 * proof, a 120-character name at 360 and 768 px in a browser, is in `tests/e2e/masters-table-actions.spec.ts`.
 */

const TONES: ReadonlyArray<AlertTone> = ['info', 'success', 'warn', 'danger'];

/** The class list of the notice's outer element, with the title and a body, as the page renders it. */
function noticeClasses(tone: AlertTone, className?: string): string[] {
  const html = renderToStaticMarkup(createElement(Notice, { tone, title: 'A title', ...(className === undefined ? {} : { className }) }, 'A body'));
  return (/ class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
}

let all: Declaration[] = [];

beforeAll(async () => {
  all = declarationsOf(await buildCss([BREAK_LONG_NAMES]));
});

describe('a notice wraps an unbroken name (AQP-275, DEF-030)', () => {
  it.each(TONES)('%s: the notice carries the one shared wrapping class', (tone) => {
    expect(noticeClasses(tone)).toContain(BREAK_LONG_NAMES);
  });

  it('keeps the wrapping class when a caller passes its own class', () => {
    const classes = noticeClasses('success', 'mt-s-4');
    expect(classes).toContain(BREAK_LONG_NAMES);
    expect(classes).toContain('mt-s-4');
  });

  it('the class builds to overflow-wrap: anywhere, the rule the spec names', () => {
    expect(declarationsOfClass(all, BREAK_LONG_NAMES).map((declaration) => [declaration.property, declaration.value])).toEqual([['overflow-wrap', 'anywhere']]);
  });
});
