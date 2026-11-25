import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { treeControlsReady } from '@/components/features/estimate-workspace/tree-controls-ready';

/**
 * AQP-426, DEF-085 (DL-388, DL-389): the handle's and the Tree width menu's code is asked for only after the part form has shown, so it never competes with the form's code on a slow network or a cold development
 * server. The rule is one function; that nothing is asked for before it says yes is read from the loaders' source (a static render runs no effect, so the request itself cannot be observed here; the browser
 * order is `tests/e2e/estimate-tree-width.spec.ts`).
 */

describe('treeControlsReady', () => {
  it('is false while the form has not shown and the tree is still being read or has rows', () => {
    expect(treeControlsReady({ formShown: false, treeLoadFailed: false, treeRows: null })).toBe(false);
    expect(treeControlsReady({ formShown: false, treeLoadFailed: false, treeRows: 3 })).toBe(false);
  });

  it('is true once the form has shown', () => {
    expect(treeControlsReady({ formShown: true, treeLoadFailed: false, treeRows: 3 })).toBe(true);
  });

  it('is true when there is no form to wait for: the tree could not be read, or it has no rows', () => {
    expect(treeControlsReady({ formShown: false, treeLoadFailed: true, treeRows: null })).toBe(true);
    expect(treeControlsReady({ formShown: false, treeLoadFailed: false, treeRows: 0 })).toBe(true);
  });
});

describe('the loaders of the controls', () => {
  const source = readFileSync(fileURLToPath(new URL('../../src/components/features/estimate-workspace/tree-resize-slots.tsx', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
  const exported = (name: string): string => source.slice(source.indexOf(`export function ${name}`), source.indexOf('\n}\n', source.indexOf(`export function ${name}`)));

  it('start no request in the component the page draws first: the hook that asks for the code is only in the one drawn once `ready`', () => {
    for (const name of ['LazyTreeResizeHandle', 'LazyTreeWidthMenu']) {
      const body = exported(name);
      expect(body, name).toContain('ready');
      expect(body, name).not.toContain('useLazyComponent');
    }
    expect(source.match(/useLazyComponent</g)).toHaveLength(2);
  });
});
