import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** What happened, in order: `refresh` (the router) and `reset` (the boundary). */
const calls: string[] = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => calls.push('refresh') }) }));

import { RouteLoadError } from '../../src/components/shared/route-load-error';

/**
 * DEF-033 (AQP-287, GitHub 345; ux-spec section 6.0 "Error (load)"): "Try again" on a page-level load error asks the server for the route again
 * and then resets the boundary. `reset` alone draws the boundary's children again from the answer the client already holds, which is the failed one,
 * so the error stayed on the screen after the read worked again (Customers, Process master and every other page with its own `error.tsx`).
 *
 * The test takes EVERY `error.tsx` under `src/app`, so a new page that passes `reset` straight to its button fails here.
 */

const APP = join(__dirname, '..', '..', 'src', 'app');

type ErrorPage = (props: { error: Error; reset: () => void }) => ReactNode;

/** Every `error.tsx` under `src/app`, found by a glob and not by a list, so a new one is checked too. */
const MODULES = import.meta.glob<{ default: ErrorPage }>('../../src/app/**/error.tsx');
const PAGES = Object.keys(MODULES).map((key) => key.slice('../../src/app/'.length));

/** Every element under a node. The shared `RouteLoadError` is run (it holds the button); other components are read through their props only. */
function elementsOf(node: ReactNode): ReactElement[] {
  const found: ReactElement[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isValidElement(value)) return;
    const element = value as ReactElement<Record<string, unknown>>;
    found.push(element);
    if (element.type === RouteLoadError) {
      visit((element.type as (props: unknown) => ReactNode)(element.props));
      return;
    }
    for (const prop of Object.values(element.props)) visit(prop);
  };
  visit(node);
  return found;
}

function retryButtonOf(page: ErrorPage, reset: () => void): (() => void) | undefined {
  const tree = page({ error: new Error('invented failure'), reset });
  const buttons = elementsOf(tree).filter((element) => typeof (element.props as { onClick?: unknown }).onClick === 'function');
  return (buttons[0]?.props as { onClick?: () => void } | undefined)?.onClick;
}

beforeEach(() => {
  calls.length = 0;
});

describe('DEF-033: Try again on every route-level error page asks the server again', () => {
  it('there are error pages to check (the walk finds the root page and the portal pages)', () => {
    expect(PAGES).toContain('error.tsx');
    expect(PAGES).toContain('(portal)/masters/process/error.tsx');
    expect(PAGES).toContain('(portal)/masters/customers/error.tsx');
    expect(PAGES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(PAGES)('%s: pressing Try again refreshes the route, and then resets the boundary', async (page) => {
    const loader = MODULES[`../../src/app/${page}`];
    const loaded = await loader?.();
    const reset = vi.fn(() => calls.push('reset'));
    const onClick = retryButtonOf(loaded?.default ?? (() => null), reset);
    expect(onClick, 'the page has one button with a click handler').toBeDefined();
    onClick?.();
    expect(calls).toEqual(['refresh', 'reset']);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it.each(PAGES)('%s: the source does not hand `reset` straight to a button', (page) => {
    const source = readFileSync(join(APP, page), 'utf8');
    expect(source).not.toMatch(/on(Click|Retry)=\{reset\}/);
  });

  it('the shared piece asks again once per press (two presses, two refreshes and two resets)', () => {
    const reset = vi.fn(() => calls.push('reset'));
    const press = retryButtonOf(() => createElement(RouteLoadError, { pageTitle: 'Page', title: 'We could not load the page', reset }), reset);
    press?.();
    press?.();
    expect(calls).toEqual(['refresh', 'reset', 'refresh', 'reset']);
  });
});
