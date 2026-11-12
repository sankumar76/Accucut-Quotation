import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { EmptyState } from '@/components/shared/states';

/**
 * AQP-289 (DEF-035): the title of every `EmptyState` wraps an unbroken name, so a search screen that prints what the person typed in it
 * ("No rate matches ...") never scrolls sideways (ux-spec 6.0 "Names wrap", "Zoom and reflow"). The rule is written once, in
 * `shared/break-long-names.ts`; `EmptyState` puts it on its heading and its callers do not. The page-level proof, a 100-character search
 * at 360, 768 and 1366 px in a browser, is in `tests/e2e/process-master.spec.ts`.
 */

const LEVELS = ['h2', 'h3', 'h4'] as const;

/** The longest name the form of SCR-11 and SCR-13 accepts (UX spec 6.0 "Names wrap"): the title is checked with a value of that length. */
const LONG_NAME_LENGTH = 100;

interface RenderedHeading {
  readonly tag: string;
  readonly classes: string[];
  readonly text: string;
}

/** The heading `EmptyState` renders: its tag, its class list and its text. */
function headingOf(props: { readonly as?: (typeof LEVELS)[number]; readonly title?: string; readonly className?: string }): RenderedHeading {
  const icon: ReactNode = createElement('i');
  const html = renderToStaticMarkup(
    createElement(EmptyState, {
      icon,
      title: props.title ?? 'A title',
      description: 'A description',
      ...(props.as === undefined ? {} : { as: props.as }),
      ...(props.className === undefined ? {} : { className: props.className }),
    }),
  );
  const match = /<(h[2-4])(?: class="([^"]*)")?>([^<]*)<\/h[2-4]>/.exec(html);
  return { tag: match?.[1] ?? '', classes: (match?.[2] ?? '').split(' '), text: match?.[3] ?? '' };
}

describe('an empty state wraps an unbroken name in its title (AQP-289, DEF-035)', () => {
  it('the heading carries the one shared wrapping class', () => {
    expect(headingOf({}).classes).toContain(BREAK_LONG_NAMES);
  });

  it.each(LEVELS)('keeps the wrapping class on an %s heading', (level) => {
    const heading = headingOf({ as: level });
    expect(heading.tag).toBe(level);
    expect(heading.classes).toContain(BREAK_LONG_NAMES);
  });

  it('keeps the title typography beside the wrapping class', () => {
    expect(headingOf({}).classes).toEqual(expect.arrayContaining(['text-sub', 'font-semibold', 'text-ink']));
  });

  it(`prints a ${LONG_NAME_LENGTH}-character title in full, with the wrapping class on its heading`, () => {
    const title = `No rate matches "${'x'.repeat(LONG_NAME_LENGTH)}"`;
    const heading = headingOf({ title });
    expect(heading.text).toBe(title.replaceAll('"', '&quot;'));
    expect(heading.classes).toContain(BREAK_LONG_NAMES);
  });

  it('does not depend on the class a caller passes for the container', () => {
    expect(headingOf({ className: 'mt-s-4' }).classes).toContain(BREAK_LONG_NAMES);
  });
});
