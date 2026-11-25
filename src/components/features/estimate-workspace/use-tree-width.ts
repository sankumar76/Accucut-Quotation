'use client';

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';

import { clampTreeWidth, clearStoredTreeWidth, readStoredTreeWidth, TREE_WIDTH_DEFAULT, treeWidthCeiling, writeStoredTreeWidth } from '@/lib/ui/tree-width';

/** The custom property the tree's column, the drawing region and the form's track read (`globals.css`: `--tree-w`). */
const WIDTH_PROPERTY = '--tree-w';

const subscribeNever = (): (() => void) => () => undefined;

/**
 * False on the server and during hydration, true once the page is in the browser. It is how the separator is kept out of the server-rendered page: `useViewport` assumes `desktop` on the server (its doc comment
 * is right: the server snapshot is `'desktop'`), so a separator drawn from that alone would be announced at the wrong size on a phone. A store that never changes, not an effect, so no extra render is needed.
 */
export const useMounted = (): boolean => useSyncExternalStore(subscribeNever, () => true, () => false);

/** The one animation frame a drag has asked for: a new request replaces it, and it can be cancelled. A closure, so it is not a ref and not a value React renders (the same shape as the save gate). */
function createFrameSlot(): { readonly schedule: (run: () => void) => void; readonly cancel: () => void } {
  let frame = 0;
  return {
    schedule: (run) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    },
    cancel: () => cancelAnimationFrame(frame),
  };
}

export interface TreeWidth {
  /** The width shown, in pixels: the person's choice (or 320), held by `clampTreeWidth`. The stored number is never changed by that. */
  readonly width: number;
  /** The effective maximum: 400 or the room, `aria-valuemax`. */
  readonly ceiling: number;
  /** The workspace's width, or `null` until it has been measured. */
  readonly workspaceWidth: number | null;
  /** While a drag is on: shows this width now, batched to the frame, without a React render per pixel. */
  readonly preview: (width: number) => void;
  /** The end of a gesture: apply the width and store it (or, for a reset, remove the stored one). */
  readonly commit: (width: number, reset: boolean) => void;
}

/**
 * The width of the parts tree (AQP-426, STORY-CR01.3E, UX-AC-15.1, 15.6, 15.8, 15.12). The person's choice is read once from `localStorage` after the page is in the browser (a store read, so the first render in the
 * browser already has it and the page is never blocked), measured against the workspace's width (`ResizeObserver`) and written as `--tree-w` on the workspace element in a layout effect, so it is applied before first
 * paint. A drag does not go through React: `preview` writes the property in an animation frame. Nothing is stored until a gesture ends (`commit`), and a clamp never rewrites what is stored.
 *
 * Returns the width and, second, the callback ref that goes on the workspace element: its width is measured, and `--tree-w` is set on it.
 */
export function useTreeWidth(userId: string): readonly [TreeWidth, (element: HTMLElement | null) => void] {
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState<number | null>(null);
  const stored = useSyncExternalStore(subscribeNever, () => readStoredTreeWidth(userId), () => null);
  // What was chosen on this page: `null` until something is (then the stored number is the choice), `{ value: null }` after a reset. A choice that could not be stored still applies for as long as the page is open.
  const [chosen, setChosen] = useState<{ readonly value: number | null } | null>(null);
  const wanted = chosen === null ? stored : chosen.value;
  const width = clampTreeWidth(wanted ?? TREE_WIDTH_DEFAULT, workspaceWidth);
  const [pending] = useState(createFrameSlot);

  useEffect(() => {
    if (workspace === null) return;
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last !== undefined) setWorkspaceWidth(last.contentRect.width);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [workspace]);

  // No transition is set on the width anywhere (UX-AC-15.12), so this is the whole change.
  useLayoutEffect(() => {
    workspace?.style.setProperty(WIDTH_PROPERTY, `${width}px`);
  }, [workspace, width]);

  useEffect(() => pending.cancel, [pending]);

  const preview = useCallback(
    (next: number): void => {
      pending.schedule(() => workspace?.style.setProperty(WIDTH_PROPERTY, `${next}px`));
    },
    [pending, workspace],
  );

  const commit = useCallback(
    (next: number, reset: boolean): void => {
      // A frame still waiting from the drag must not write after this.
      pending.cancel();
      workspace?.style.setProperty(WIDTH_PROPERTY, `${next}px`);
      if (reset) clearStoredTreeWidth(userId);
      else writeStoredTreeWidth(userId, next);
      setChosen({ value: reset ? null : next });
    },
    [pending, userId, workspace],
  );

  return [{ width, ceiling: treeWidthCeiling(workspaceWidth), workspaceWidth, preview, commit }, setWorkspace];
}
