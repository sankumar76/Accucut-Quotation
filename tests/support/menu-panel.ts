import type { ReactElement, ReactNode } from 'react';

import { AddNodeMenuPanel } from '@/components/features/estimate-workspace/add-node-menu-panel';

import { renderHook } from './hook-harness';

/**
 * The loaded "+" menu as a test reads it (AQP-451): the panel draws its content only once its trigger has been put on the page and has found the group of its row (the menu opens in line under the row), so
 * the helper does what the browser does at that moment: it renders once, hands the trigger's callback ref a button whose row group is found, and answers the hook, whose next `render()` has the content.
 * The caller must have mocked `react` with the harness's hooks (`vi.mock('react', ...)`), as every test of the panel does.
 */
export type MenuPanelProps = Parameters<typeof AddNodeMenuPanel>[0];

/** A button that finds a group for its row, as `button.closest('[data-row-actions]')` does on the page. */
export const ROW_GROUP = { rowGroup: true } as const;

function refOf(node: ReactNode): ((button: unknown) => void) | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = refOf(child as ReactNode);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null || !('props' in node)) return null;
  const props = (node as ReactElement<Record<string, unknown>>).props;
  if (typeof props['ref'] === 'function') return props['ref'] as (button: unknown) => void;
  return refOf(props['children'] as ReactNode);
}

export function renderPanel(props: MenuPanelProps) {
  const hook = renderHook(AddNodeMenuPanel, props);
  const ref = refOf(hook.render());
  if (ref === null) throw new Error('the menu has no trigger with a callback ref');
  ref({ closest: () => ROW_GROUP });
  return hook;
}
