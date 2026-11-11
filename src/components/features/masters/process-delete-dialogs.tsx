'use client';

import { useState } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROCESS_ITEM_IN_USE_CODE } from '@/lib/errors';
import { deleteProcessItem, formulasOf, type FormulaUseRow, type ProcessItemRow } from '@/lib/masters/process-items-client';

import { BREAK_LONG_NAMES, TRY_AGAIN_BODY } from './master-texts';
import {
  BLOCKED_CLOSE,
  BLOCKED_TITLE,
  blockedSentence,
  deleteDescription,
  deleteTitle,
  DELETE_CONFIRM,
  DELETE_KEEP,
  FAILED_DELETE_MESSAGE,
} from './process-texts';

/**
 * The two alert dialogs of the delete on SCR-11 (STORY-02.01 AC-4, AC-7): the confirmation of an unused rate and the refusal of a rate
 * a formula uses. Both are alert dialogs, because the action takes something away or says it cannot; focus starts on the safe choice
 * ("Keep rate", "Close"), and Escape closes them with nothing sent. The refusal lists the formulas (the column letter and the field's
 * label) as plain text with Close as its only button: formulas cannot be changed until Release 2 (ux-spec v0.17, AC-4). It can come
 * from the list the page already holds, or from the server's 409 when the confirmation is answered "in use" (a formula began to use
 * the rate since the list was read): then the dialog turns into the refusal. A 404 (the rate was deleted elsewhere) is the screen's.
 */

export interface DeleteDialogProps {
  readonly open: boolean;
  readonly item: ProcessItemRow | null;
  readonly onClose: () => void;
  /** Called after the server deleted the rate. */
  readonly onDeleted: (item: ProcessItemRow) => void;
  /** Called when the server said a formula uses the rate: the screen then shows the refusal with these formulas. */
  readonly onBlocked: (formulas: ReadonlyArray<FormulaUseRow>) => void;
  /** Called when the server said the rate no longer exists. */
  readonly onGone: (item: ProcessItemRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The request of the confirmation and what it left: it is out, or it failed in a way the person can try again. */
function useDeleteRequest({ onDeleted, onBlocked, onGone }: Pick<DeleteDialogProps, 'onDeleted' | 'onBlocked' | 'onGone'>) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove(target: ProcessItemRow): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const outcome = await deleteProcessItem(target.id);
    setSubmitting(false);
    if (outcome.status === 'ok') return onDeleted(target);
    if (outcome.status === 'refused' && outcome.code === PROCESS_ITEM_IN_USE_CODE) return onBlocked(formulasOf(outcome));
    if (outcome.status === 'refused' && outcome.httpStatus === 404) return onGone(target);
    setFailed(true);
  }

  return { submitting, failed, clearFailure: () => setFailed(false), remove };
}

function DeleteBody({ item, request }: { readonly item: ProcessItemRow; readonly request: ReturnType<typeof useDeleteRequest> }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{deleteTitle(item.name)}</AlertDialogTitle>
        <AlertDialogDescription className={BREAK_LONG_NAMES}>{deleteDescription(item.name)}</AlertDialogDescription>
      </AlertDialogHeader>
      {request.failed ? (
        <Notice tone="danger" title={FAILED_DELETE_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>{DELETE_KEEP}</AlertDialogCancel>
        <AlertDialogAction
          disabled={request.submitting}
          aria-busy={request.submitting || undefined}
          onClick={(event) => {
            // Stay open while the request is out: the dialog closes when the server has answered, not before.
            event.preventDefault();
            void request.remove(item);
          }}
        >
          {request.submitting ? 'Deleting' : DELETE_CONFIRM}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export function DeleteDialog({ open, item, onClose, onCloseAutoFocus, ...handlers }: DeleteDialogProps) {
  const request = useDeleteRequest(handlers);
  const onOpenChange = (next: boolean): void => {
    if (next) return;
    request.clearFailure();
    onClose();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>{item === null ? null : <DeleteBody item={item} request={request} />}</AlertDialogContent>
    </AlertDialog>
  );
}

/** The formulas that use a rate: the column letter and the field's label, as text. */
function FormulaTable({ name, formulas }: { readonly name: string; readonly formulas: ReadonlyArray<FormulaUseRow> }) {
  return (
    <Table regionLabel="Formulas that use this rate, scrollable" caption={`Formulas that use ${name}`}>
      <TableHeader>
        <TableRow>
          <TableHead>Column</TableHead>
          <TableHead>Field</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {formulas.map((formula) => (
          <TableRow key={`${formula.letter}-${formula.label}`}>
            <TableCell>
              <ColumnTag letter={formula.letter} kind="output" />
            </TableCell>
            <TableCell>{formula.label}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export interface BlockedDialogProps {
  readonly open: boolean;
  readonly item: ProcessItemRow | null;
  /** The formulas that use the rate. */
  readonly formulas: ReadonlyArray<FormulaUseRow>;
  readonly onClose: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function BlockedDialog({ open, item, formulas, onClose, onCloseAutoFocus }: BlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {item === null ? null : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{BLOCKED_TITLE}</AlertDialogTitle>
              <AlertDialogDescription className={BREAK_LONG_NAMES}>{blockedSentence(item.name)}</AlertDialogDescription>
            </AlertDialogHeader>
            <FormulaTable name={item.name} formulas={formulas} />
            <AlertDialogFooter>
              <AlertDialogCancel>{BLOCKED_CLOSE}</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
