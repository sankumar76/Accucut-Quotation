'use client';

import { useRef, type RefObject } from 'react';

import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';
import type { RevertedVersion } from '@/lib/config/checkpoints-client';

import { RevertPanel } from './revert-view';
import { useRevert, type RevertTarget } from './use-revert';

/**
 * The revert dialog of SCR-21 (STORY-08.06 AC-4, AC-7, AC-10; UX spec SCR-21): an alertdialog over the list of checkpoints. It is fetched on the first press of a Revert button, through the overlay loader every dialog
 * uses (`useFirstOpen`, architecture section 10), and is **not** in the first load of the page (NFR-009, ADR-016). It says what a revert does and asks for the Admin's password; the server judges everything
 * (see `use-revert.ts`).
 *
 * It is an AlertDialog, so focus starts on the safe choice and Escape closes it with nothing sent; neither works while the revert is under way. Radix has no trigger to return focus to, so the screen places it in
 * `onCloseAutoFocus`.
 */

export interface RevertDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The version the dialog is about. It stays set after the dialog closes, so the text does not change while the panel fades out. */
  readonly target: RevertTarget;
  /** The number of the version the screen shows as current. */
  readonly baseVersion: number;
  readonly onReverted: (result: RevertedVersion) => void;
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The state mounts when the dialog opens and goes when it closes, so every opening starts with an empty password and the confirm state. */
function RevertHost({ target, baseVersion, onReverted, onStale, inFlightRef }: Pick<RevertDialogProps, 'target' | 'baseVersion' | 'onReverted' | 'onStale'> & { readonly inFlightRef: RefObject<boolean> }) {
  const state = useRevert({ target, baseVersion, onReverted, onStale, inFlightRef });
  return <RevertPanel target={target} baseVersion={baseVersion} state={state} />;
}

export function RevertDialog(props: RevertDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while the revert is under way (it cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <RevertHost target={props.target} baseVersion={props.baseVersion} onReverted={props.onReverted} onStale={props.onStale} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
