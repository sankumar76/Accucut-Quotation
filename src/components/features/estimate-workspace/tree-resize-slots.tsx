'use client';

import type { TreeResizeHandleProps } from './tree-resize-handle';
import type { TreeWidthMenuProps } from './tree-width-menu';
import { useLazyComponent } from './use-lazy-component';

/** The handle's and the menu's code: bare `import()`s behind type-only imports above, so none of it is in the first load of `/estimates/[code]` (NFR-009, ADR-016; AQP-426). */
const loadHandle = () => import('./tree-resize-handle').then((module) => module.TreeResizeHandle);
const loadMenu = () => import('./tree-width-menu').then((module) => module.TreeWidthMenu);

/**
 * The resize handle, fetched when it is first drawn. It is drawn only where the tree is docked beside the form (1024 px and wider) and only in the browser, so a phone or a tablet never asks for its code. Until it
 * arrives there is nothing in its place: the column is 320 px (or the stored width, which does not need the handle) and the form is whole.
 */
export function LazyTreeResizeHandle(props: TreeResizeHandleProps) {
  const { Component } = useLazyComponent<TreeResizeHandleProps>(loadHandle, true);
  return Component === null ? null : <Component {...props} />;
}

/** The "Tree width" button and its three choices, fetched when the head is drawn at 1024 px and wider; its box is kept empty until the code is here. */
export function LazyTreeWidthMenu(props: TreeWidthMenuProps) {
  const { Component } = useLazyComponent<TreeWidthMenuProps>(loadMenu, true);
  // The button's box is kept while its code is on the way, so the head does not change height when it arrives.
  return Component === null ? <span aria-hidden="true" className="block h-(--control-h) w-(--control-h) fine-wide:h-[32px] fine-wide:w-[32px]" /> : <Component {...props} />;
}
