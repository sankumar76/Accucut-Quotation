import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddNodeMenuPanel } from '@/components/features/estimate-workspace/add-node-menu-panel';
import { AddNodeTrigger } from '@/components/features/estimate-workspace/add-node-trigger';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';

import { renderHook } from '../support/hook-harness';

// The panel is called as a function and the elements it returns are read, as in `add-node-menu-sub-part.test.ts`: no DOM is needed to pin where the menu is put.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));

/**
 * AQP-451 (DEF-094; UX spec section 0.9 row 3 and the ux-expert's check C-05-02): the "+" menu opens IN LINE under its row, in the row's own toolbar group, and not as a floating popover in a portal on the page body
 * (which covered the tree's head and the form, and at 360 px sat outside the drawer). The menu's content is given the row's group as the place its portal goes (`container`), and the stylesheet takes it out of
 * Radix's floating position, so it is a block in the flow that pushes the rows below it down. Names are invented.
 */

type Props = Record<string, unknown>;

function elementsIn(node: ReactNode, found: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsIn(child as ReactNode, found);
  } else if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as ReactElement<Props>;
    found.push(element);
    elementsIn(element.props['children'] as ReactNode, found);
  }
  return found;
}

const group = { tag: 'the row group' };

/** A trigger button as the browser would give it to the callback ref: it finds the group of its row. */
const buttonIn = (closest: (selector: string) => unknown) => ({ closest });

function panel() {
  const hook = renderHook(AddNodeMenuPanel, { label: 'Add under 1.1 Frame', nodeKinds: ['PART', 'FASTENER'], onChoose: vi.fn(), keyboard: false } as Parameters<typeof AddNodeMenuPanel>[0]);
  const contentOf = () => elementsIn(hook.render()).find((element) => element.type === DropdownMenuContent);
  const triggerOf = () => {
    const found = elementsIn(hook.render()).find((element) => element.type === AddNodeTrigger);
    if (found === undefined) throw new Error('no trigger');
    return found;
  };
  return { contentOf, triggerOf };
}

describe('AQP-451: the "+" menu opens in line under its row', () => {
  it('draws no menu content until it knows where its row\'s group is, so it is never put on the page body first', () => {
    const { contentOf } = panel();
    expect(contentOf()).toBeUndefined();
  });

  it('puts the content in the group of its row (the nearest [data-row-actions] of the trigger), marked as the in-line menu', () => {
    const { contentOf, triggerOf } = panel();
    const seen: string[] = [];
    (triggerOf().props['ref'] as (node: unknown) => void)(buttonIn((selector) => (seen.push(selector), group)));
    expect(seen).toEqual(['[data-row-actions]']);
    const content = contentOf();
    expect(content?.props['container']).toBe(group);
    expect(content?.props).toHaveProperty('data-inline-menu');
  });

  it('falls back to the default place (the page body) when the trigger is in no row group, so the menu still opens', () => {
    const { contentOf, triggerOf } = panel();
    (triggerOf().props['ref'] as (node: unknown) => void)(buttonIn(() => null));
    expect(contentOf()).toBeDefined();
    expect(contentOf()?.props['container']).toBeNull();
  });

  it('keeps the group it found when the button is taken away (the callback ref is called with null)', () => {
    const { contentOf, triggerOf } = panel();
    const ref = triggerOf().props['ref'] as (node: unknown) => void;
    ref(buttonIn(() => group));
    ref(null);
    expect(contentOf()?.props['container']).toBe(group);
  });
});

describe('AQP-451: the stylesheet takes the menu out of the floating position', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

  it('makes the Radix wrapper of the in-line menu static, with no transform and no minimum width, and only for that menu', () => {
    const rule = /\[data-radix-popper-content-wrapper\]:has\(> \[data-inline-menu\]\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/position:\s*static\s*!important/);
    expect(rule).toMatch(/transform:\s*none\s*!important/);
    expect(rule).toMatch(/min-width:\s*0\s*!important/);
  });
});
