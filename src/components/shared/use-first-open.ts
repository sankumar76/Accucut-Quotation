'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';

import { finishEarlyIntent, readEarlyIntent } from '@/lib/ui/early-intent';
import {
  hasFirstOpenFailed,
  INITIAL_FIRST_OPEN,
  isFirstOpenPending,
  reduceFirstOpen,
  shouldOpenOverlay,
  shouldRequestCode,
  type FirstOpenEvent,
} from '@/lib/ui/first-open';

/**
 * The one loader of every overlay that is opened by a user action (architecture section 10, AQP-188). The control is a
 * plain button in the first load; the overlay's code is fetched by a bare `import()` the first time the button is
 * pressed. It is not `React.lazy` or `next/dynamic`, because a rejected lazy component cannot be tried again; here a
 * failed request becomes the state `failed` and the next press sends a new one. The state is the pure reducer in
 * `src/lib/ui/first-open.ts`; this hook adds the request, the Escape key, the page change, the last-press-wins rule
 * between two controls, and the hand-over of a tap made before the page was interactive (DEF-013, AC-10).
 */

export interface FirstOpenOptions<Panel> {
  /** Names the control. Matches the control's `data-early-intent` value. */
  readonly id: string;
  /** Fetches the overlay's code: a bare `import()`. */
  readonly load: () => Promise<ComponentType<Panel>>;
  /** Called when the code is here and the person wanted the overlay open (the drawer sets its `open` state here). */
  readonly onOpen?: () => void;
}

export interface FirstOpenControl<Panel> {
  /** The overlay's component once its code is here, otherwise `null`. */
  readonly Overlay: ComponentType<Panel> | null;
  /** The code is here and the person wanted it: mount the overlay open. Stays true. */
  readonly shown: boolean;
  /** Waiting for the code: pressed look and `aria-busy`. */
  readonly pending: boolean;
  /** The last request failed: show the failure line. */
  readonly failed: boolean;
  /** The press that opened it was made with the keyboard. */
  readonly keyboard: boolean;
  /** The control was pressed. `keyboard` is true for Enter, Space and ArrowDown. */
  readonly activate: (keyboard: boolean) => void;
}

/** The control pressed last, so that pressing the other one cancels it (UX spec 7.3.1 rule 11: the last press wins). */
let pendingControl: { readonly id: string; readonly cancel: () => void } | null = null;

export function useFirstOpen<Panel>({ id, load, onOpen }: FirstOpenOptions<Panel>): FirstOpenControl<Panel> {
  const [state, setState] = useState(INITIAL_FIRST_OPEN);
  const [loaded, setLoaded] = useState<{ readonly Overlay: ComponentType<Panel> } | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const stateRef = useRef(state);
  const loadRef = useRef(load);
  const onOpenRef = useRef(onOpen);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    loadRef.current = load;
    onOpenRef.current = onOpen;
  });

  const send = useCallback(function send(event: FirstOpenEvent, byKeyboard = false): void {
    const before = stateRef.current;
    const after = reduceFirstOpen(before, event);
    if (after === before) return;
    stateRef.current = after;
    setState(after);
    if (event === 'activate') setKeyboard(byKeyboard);
    if (shouldRequestCode(before, after)) {
      loadRef.current().then(
        (Overlay) => {
          setLoaded({ Overlay });
          send('loaded');
        },
        () => send('failed'),
      );
    }
    if (shouldOpenOverlay(before, after, event)) onOpenRef.current?.();
  }, []);

  const activate = useCallback(
    (byKeyboard: boolean): void => {
      if (pendingControl !== null && pendingControl.id !== id) pendingControl.cancel();
      pendingControl = { id, cancel: () => send('cancel') };
      send('activate', byKeyboard);
    },
    [id, send],
  );

  // A tap made before the page was interactive is the first activation (AC-10).
  useEffect(() => {
    const early = readEarlyIntent(window, id);
    if (early !== undefined) activate(early.keyboard);
  }, [id, activate]);

  const pending = isFirstOpenPending(state);
  const failed = hasFirstOpenFailed(state);

  // Escape cancels a pending open and clears a failure, from anywhere on the page.
  useEffect(() => {
    if (!pending && !failed) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') send('cancel');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, failed, send]);

  // A failure line goes away when the page changes.
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    send('dismiss');
  }, [pathname, send]);

  return { Overlay: loaded?.Overlay ?? null, shown: state.shown, pending, failed, keyboard, activate };
}

/**
 * Called once by the page frame, after its controls have read the early tap: the script stops listening and React is
 * the only owner of `aria-busy` from then on. It must be declared after the `useFirstOpen` calls of the same
 * component; the account menu is a child of the frame, and effects run children first.
 */
export function useFinishEarlyIntent(): void {
  useEffect(() => {
    finishEarlyIntent(window);
  }, []);
}
