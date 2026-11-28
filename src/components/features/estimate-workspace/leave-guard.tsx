'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { installLeaveGuard, type LeaveGuardHandle } from '@/lib/estimates/leave-guard';
import { registerLeaveGuard, type LeaveRequest } from '@/lib/estimates/leave-registry';
import { saveDraft } from '@/lib/estimates/save-draft';
import type { SaveGate } from '@/lib/estimates/save-gate';

import { LeaveDialog } from './leave-dialog';

export interface LeaveGuardProps {
  /** The page's one save gate: what is unsaved, and the saves in flight. */
  readonly gate: SaveGate;
}

/**
 * The warning on leaving the estimate page (STORY-05.08 AC-4). It draws nothing until a way out is taken while something is unsaved. It is fetched after the page is up (NFR-009, ADR-016): typing
 * is only possible once the form's own code is here, and both are asked for on mount. It puts the listeners of `leave-guard.ts` on the page (a closed tab, a link, the back button) and registers itself
 * for the two ways out that are not events (choosing another part, Sign out), so every way out asks the same question through one dialog.
 *
 * A request that finds nothing unsaved after the saves in flight have finished goes through without a word. Otherwise the dialog asks: **Keep editing** stays, **Leave without saving** gives the
 * typing up by the person's choice, and **Save draft and leave** saves it and goes only if it was saved (a draft that cannot be saved keeps the dialog open and says so).
 */
export function LeaveGuard({ gate }: LeaveGuardProps) {
  const router = useRouter();
  // The address the router has committed: the guard pushes its history entry only when the current address is the row on screen's (QLT-845-08, DL-487), so it is told when this changes.
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const installed = useRef<LeaveGuardHandle | null>(null);
  // The request the dialog is asking about, kept in a ref too so a second request can end the first one's wait (a Sign out waits for its answer).
  const asking = useRef<LeaveRequest | null>(null);
  // Where focus was when the person was asked, so "Keep editing" puts it back there.
  const askedFrom = useRef<Element | null>(null);

  const show = useCallback((next: LeaveRequest | null): void => {
    asking.current = next;
    setRequest(next);
  }, []);

  /** The person may go: a full page load (Sign out) is let through the browser's own prompt once, and then the request runs. */
  const go = useCallback((next: LeaveRequest): void => {
    if (next.fullLoad === true) installed.current?.allowFullLoad();
    next.proceed();
  }, []);

  const ask = useCallback(
    (next: LeaveRequest): void => {
      // The saves in flight finish first: most of the time that is all that was unsaved, and the person is not asked about work that is already safe.
      void gate.settle().then((clean) => {
        if (clean) {
          go(next);
          return;
        }
        asking.current?.cancel();
        askedFrom.current = document.activeElement;
        setSaveFailed(false);
        show(next);
      });
    },
    [gate, go, show],
  );

  useEffect(() => {
    const handle = installLeaveGuard({
      env: { win: window, doc: document },
      gate,
      ask,
      navigate: (href, replace) => (replace ? router.replace(href) : router.push(href)),
      // Nothing is unsaved in the row on screen when no field shows a value that is not saved: a save of another part, in flight or failed, is not that (DL-488 (iii)).
      rowDirty: () => gate.hasUnsaved(),
      // The part form takes this as its read-only state, through the gate it shares (DL-488 (iv)).
      onInputHeld: (held) => gate.setInputHeld(held),
    });
    installed.current = handle;
    const withdraw = registerLeaveGuard(ask);
    return () => {
      withdraw();
      handle.remove();
      installed.current = null;
    };
  }, [gate, ask, router]);

  // After the router commits an address its history write has been made, so the guard reads the address it has then. Declared after the effect above: on mount the guard is installed first.
  useEffect(() => {
    installed.current?.committed();
  }, [pathname, search]);

  function keep(): void {
    request?.cancel();
    show(null);
  }

  function leave(): void {
    if (request === null) return;
    show(null);
    // The typing is given up by the person's choice: nothing of it is unsaved from here, so a row opened by the address, or a page, is not held back by it.
    gate.discardUnsaved();
    go(request);
  }

  async function saveAndLeave(): Promise<void> {
    if (request === null || saving) return;
    setSaving(true);
    setSaveFailed(false);
    const result = await saveDraft(gate);
    setSaving(false);
    if (result.saved) leave();
    else setSaveFailed(true);
  }

  return (
    <LeaveDialog
      open={request !== null}
      saving={saving}
      saveFailed={saveFailed}
      onKeep={keep}
      onLeave={leave}
      onSaveAndLeave={() => void saveAndLeave()}
      onCloseAutoFocus={(event) => {
        // No trigger opened this dialog, so Radix has nowhere to return focus: it goes back to where the person was.
        event.preventDefault();
        if (askedFrom.current instanceof HTMLElement) askedFrom.current.focus();
      }}
    />
  );
}
