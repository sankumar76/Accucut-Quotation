'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Notice } from '@/components/shared/notice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Outcome } from '@/lib/api-client';
import { estimateUsesOf, statusWords, unnamedCount, type EstimateUsesRow } from '@/lib/masters/estimate-uses';

import {
  BREAK_LONG_NAMES,
  IN_USE_CLOSE,
  IN_USE_LIST_LABEL,
  inUseAdvice,
  inUseLead,
  inUseMore,
  inUseTitle,
  type InUseKind,
} from './master-texts';

/**
 * The two alert dialogs of the delete of a customer (SCR-12) and of a material (SCR-13), the same shape for both (STORY-02.07 AC-2, AC-3, AC-7): the
 * confirmation, and the refusal that names the open estimates which use the record. Both are alert dialogs, because the action takes something away or says it
 * cannot; focus starts on the safe choice ("Keep ...", "Close"), and Escape closes them with nothing sent. The confirmation stays open while the request is out
 * and closes when the server has answered. A 409 from the server (an estimate began to use the record since the list was read) turns it into the refusal; a 404
 * (it was deleted elsewhere) is the screen's. A failed delete keeps the dialog open with the sentence for a write with nothing typed (ux-spec v0.21, section 6.0).
 * The words are the caller's, so one component serves both masters; it decides nothing.
 */

/** What the dialogs are about: the record's ID and the name the person knows it by. */
export interface DeleteTarget {
  readonly id: string;
  readonly name: string;
}

/** The words of a master's confirmation. */
export interface DeleteConfirmTexts {
  readonly title: (name: string) => string;
  readonly description: (name: string) => string;
  readonly keep: string;
  readonly confirm: string;
  readonly failedTitle: string;
  /** Under a failed Delete (nothing was typed): the shared sentence of ux-spec v0.21 section 6.0, which never says "Nothing was changed.". */
  readonly failedBody: string;
}

const DELETING = 'Deleting';

export interface MasterDeleteDialogProps {
  readonly open: boolean;
  readonly target: DeleteTarget | null;
  readonly texts: DeleteConfirmTexts;
  /** The master's delete call and the `code` of its 409. */
  readonly remove: (id: string) => Promise<Outcome<true>>;
  readonly inUseCode: string;
  readonly onClose: () => void;
  /** Called after the server deleted the record. */
  readonly onDeleted: (target: DeleteTarget) => void;
  /** Called when the server said an open estimate uses the record: the screen then shows the refusal with these estimates. */
  readonly onBlocked: (uses: EstimateUsesRow) => void;
  /** Called when the server said the record no longer exists. */
  readonly onGone: (target: DeleteTarget) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type RequestHandlers = Pick<MasterDeleteDialogProps, 'remove' | 'inUseCode' | 'onDeleted' | 'onBlocked' | 'onGone'>;

/** The request of the confirmation and what it left: it is out, or it failed in a way the person can try again. */
function useDeleteRequest({ remove, inUseCode, onDeleted, onBlocked, onGone }: RequestHandlers) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(target: DeleteTarget): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const outcome = await remove(target.id);
    setSubmitting(false);
    if (outcome.status === 'ok') return onDeleted(target);
    if (outcome.status === 'refused' && outcome.code === inUseCode) {
      const uses = estimateUsesOf(outcome);
      if (uses !== null) return onBlocked(uses);
    }
    if (outcome.status === 'refused' && outcome.httpStatus === 404) return onGone(target);
    setFailed(true);
  }

  return { submitting, failed, clearFailure: () => setFailed(false), send };
}

function DeleteBody({ target, texts, request }: { readonly target: DeleteTarget; readonly texts: DeleteConfirmTexts; readonly request: ReturnType<typeof useDeleteRequest> }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{texts.title(target.name)}</AlertDialogTitle>
        <AlertDialogDescription className={BREAK_LONG_NAMES}>{texts.description(target.name)}</AlertDialogDescription>
      </AlertDialogHeader>
      {request.failed ? (
        <Notice tone="danger" title={texts.failedTitle}>
          {texts.failedBody}
        </Notice>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>{texts.keep}</AlertDialogCancel>
        <AlertDialogAction
          disabled={request.submitting}
          aria-busy={request.submitting || undefined}
          onClick={(event) => {
            // Stay open while the request is out: the dialog closes when the server has answered, not before.
            event.preventDefault();
            void request.send(target);
          }}
        >
          {request.submitting ? DELETING : texts.confirm}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}


export function MasterDeleteDialog({ open, target, texts, onClose, onCloseAutoFocus, ...handlers }: MasterDeleteDialogProps) {
  const request = useDeleteRequest(handlers);
  const onOpenChange = (next: boolean): void => {
    if (next) return;
    request.clearFailure();
    onClose();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>{target === null ? null : <DeleteBody target={target} texts={texts} request={request} />}</AlertDialogContent>
    </AlertDialog>
  );
}

const estimateHref = (code: string): string => `/estimates/${encodeURIComponent(code)}`;

/** The estimates the refusal names, each by its task code (a link to it) and its status, and "and N more" when the server counted more than it named. */
function OpenEstimates({ uses }: { readonly uses: EstimateUsesRow }) {
  const more = unnamedCount(uses);
  return (
    <ul aria-label={IN_USE_LIST_LABEL} className="flex flex-col gap-s-1">
      {uses.estimates.map((use) => (
        <li key={use.code} className={BREAK_LONG_NAMES}>
          <Link href={estimateHref(use.code)} className="font-semibold text-primary-ink underline-offset-2 hover:underline">
            {use.code}
          </Link>{' '}
          <span className="text-ink-2">({statusWords(use.status)})</span>
        </li>
      ))}
      {more > 0 ? <li className="text-ink-2">{inUseMore(more)}</li> : null}
    </ul>
  );
}

export interface MasterInUseDialogProps {
  readonly open: boolean;
  readonly kind: InUseKind;
  /** The name of the record that cannot be deleted yet. */
  readonly name: string | null;
  readonly uses: EstimateUsesRow | null;
  readonly onClose: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function MasterInUseDialog({ open, kind, name, uses, onClose, onCloseAutoFocus }: MasterInUseDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {name === null || uses === null ? null : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className={BREAK_LONG_NAMES}>{inUseTitle(name)}</AlertDialogTitle>
              <AlertDialogDescription>{inUseLead(kind, uses.total)}</AlertDialogDescription>
            </AlertDialogHeader>
            <OpenEstimates uses={uses} />
            <p className="text-ink-2">{inUseAdvice(kind, uses.total)}</p>
            <AlertDialogFooter>
              <AlertDialogCancel>{IN_USE_CLOSE}</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
