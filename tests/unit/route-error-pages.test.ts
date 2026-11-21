import { readFileSync } from 'node:fs';

import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import AssignError from '../../src/app/(portal)/assign/error';
import CheckpointsError from '../../src/app/(portal)/config/checkpoints/error';
import CostDetailsError from '../../src/app/(portal)/estimates/[code]/costs/[slNo]/error';
import EstimateError from '../../src/app/(portal)/estimates/[code]/error';
import ExportError from '../../src/app/(portal)/estimates/[code]/export/error';
import { RouteLoadError } from '../../src/components/shared/route-load-error';

/**
 * STORY-10.07 AC-4 (FR-088; ux-spec section 6.0 "Error (load)"): the pages that had no `error.tsx` have one, so a thrown render error shows the
 * page's own "We could not load ..." with Try again and not the generic page of the root. The words are written out here, not imported, so a change
 * to a constant cannot change what the test expects. Nothing the error carries (its message, its stack, its digest) reaches the page.
 */

const STANDARD_LINE = 'Check your connection and try again. Nothing was changed.';
const KEPT_LINE = 'Check your connection and try again. If you just changed this estimate, that change was kept.';

const reset = vi.fn();
const thrown = Object.assign(new Error('SECRET-MESSAGE-4711 at /srv/app/server.js'), { digest: 'digest-9f3a', stack: 'Error: SECRET-STACK-4711\n    at render' });
const props = { error: thrown, reset };

const render = (page: (props: { error: Error & { digest?: string }; reset: () => void }) => ReactNode): string => renderToStaticMarkup(createElement(page, props));

const PAGES = [
  ['assign', AssignError, 'Assign task', 'We could not load the assign form', STANDARD_LINE],
  ['the estimate', EstimateError, 'Estimate', 'We could not load this estimate', KEPT_LINE],
  ['the cost details', CostDetailsError, 'Cost details', 'We could not load the cost details', STANDARD_LINE],
  ['the export', ExportError, 'Excel export', 'We could not load the export', STANDARD_LINE],
  ['the checkpoints', CheckpointsError, 'Checkpoints and versions', 'We could not load the checkpoints', STANDARD_LINE],
] as const;

beforeEach(() => {
  refresh.mockClear();
  reset.mockClear();
});

describe('STORY-10.07 AC-4: the route-level error pages', () => {
  it.each(PAGES)('%s: the page header, the title, its sentence and a Try again button', (_name, page, header, title, sentence) => {
    const html = render(page);
    expect(html).toContain(`>${header}</h1>`);
    expect(html).toContain(title);
    expect(html).toContain(sentence);
    expect(html).toContain('Try again');
  });

  it.each(PAGES)('%s: the error state takes focus to its heading (a failed page load)', (_name, page, header, title) => {
    const html = render(page);
    // The shared state puts the heading in the tab order with `tabindex="-1"` so that `focusOnMount` can move focus to it.
    expect(html).toMatch(new RegExp(`<h2[^>]*tabindex="-1"[^>]*>${title}</h2>`));
  });

  it.each(PAGES)('%s: nothing the error carries is on the page (no message, no stack, no digest, no path)', (_name, page) => {
    const html = render(page);
    for (const secret of ['SECRET-MESSAGE-4711', 'SECRET-STACK-4711', 'digest-9f3a', '/srv/app']) expect(html).not.toContain(secret);
  });

  it('the estimate says that a change just made was kept, and never Nothing was changed: its read can fail after an approval or a calculation that went through', () => {
    const html = render(EstimateError);
    expect(html).not.toContain('Nothing was changed');
    expect(html).toContain('that change was kept');
  });

  it('the pages that only read keep the standard sentence, which is true of a read', () => {
    for (const page of [AssignError, CostDetailsError, ExportError, CheckpointsError]) expect(render(page)).toContain(STANDARD_LINE);
  });

  it('each page has its own title: none of them says the generic words of the root page', () => {
    for (const [, page] of PAGES) expect(render(page)).not.toContain('Something went wrong');
  });
});

/** Every element of a tree, found without rendering it (the shared component's own children are not run). */
function elementsOf(node: ReactNode): ReactElement[] {
  const found: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    found.push(child as ReactElement);
    found.push(...elementsOf((child.props as { children?: ReactNode }).children));
    for (const value of Object.values(child.props as Record<string, unknown>)) if (isValidElement(value)) found.push(...elementsOf(value));
  });
  return found;
}

describe('STORY-10.07 AC-4: Try again asks the server again', () => {
  it('pressing Try again refreshes the route and then resets the boundary, so a failed read is read again and not shown from the failed answer', () => {
    const tree = RouteLoadError({ pageTitle: 'Estimate', title: 'We could not load this estimate', reset });
    const button = elementsOf(tree).find((element) => typeof (element.props as { onClick?: unknown }).onClick === 'function');
    expect(button).toBeDefined();
    (button?.props as { onClick: () => void }).onClick();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('STORY-10.07 AC-7: no copy of the shared parts', () => {
  it.each(['assign', 'config/checkpoints', 'estimates/[code]', 'estimates/[code]/costs/[slNo]', 'estimates/[code]/export'])('%s/error.tsx draws the shared RouteLoadError and nothing of its own', (folder) => {
    const source = readFileSync(`src/app/(portal)/${folder}/error.tsx`, 'utf8');
    expect(source).toContain('RouteLoadError');
    expect(source).not.toMatch(/ErrorState|<Button|<Card|PageHeader/);
  });
});
