'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Notice } from '@/components/shared/notice';
import { ColumnTag } from '@/components/shared/column-tag';
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
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROCESS_ITEM_IN_USE_CODE } from '@/lib/errors';
import {
  deleteProcessItem,
  formulasOf,
  type FormulaUseRow,
  type ProcessItemRow,
} from '@/lib/masters/process-items-client';

import {
  BLOCKED_ADVICE,
  BLOCKED_CLOSE,
  BLOCKED_LINK,
  BLOCKED_TITLE,
  blockedSentence,
  deleteDescription,
  deleteTitle,
  DELETE_CONFIRM,
  DELETE_KEEP,
  FAILED_DELETE_MESSAGE,
  FIELDS_AND_FORMULAS_PATH,
  TRY_AGAIN_BODY,
} from './process-texts';

/**
 * The two alert dialogs of the delete on SCR-11 (STORY-02.01 AC-4, AC-7): the confirmation of an unused rate and the refusal of a rate
 * a formula uses. Both are alert dialogs, because the action takes something away or says it cannot; focus starts on the safe choice
 * ("Keep rate", "Close"), and Escape closes them with nothing sent. The refusal lists the formulas (the column letter and the field's
 * label) with a link to where they are changed. It can come from the list the page already holds, or from the server's 409 when the
 * confirmation is answered "in use" (a formula began to use the rate since the list was read): then the dialog turns into the refusal.
 */

export interface DeleteDialogProps {
  readonly open: boolean;
  readonly item: ProcessItemRow | null;
  readonly onClose: () => void;
  /** Called after the server deleted the rate. */
  readonly onDeleted: (item: ProcessItemRow) => void;
  /** Called when the server said a formula uses the rate: the screen then shows the refusal with these formulas. */
  readonly onBlocked: (formulas: ReadonlyArray<FormulaUseRow>) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function DeleteDialog({ open, item, onClose, onDeleted, onBlocked, onCloseAutoFocus }: DeleteDialogProps) {
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
    setFailed(true);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setFailed(false);
        onClose();
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {item === null ? null : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTitle(item.name)}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDescription(item.name)}</AlertDialogDescription>
            </AlertDialogHeader>
            {failed ? (
              <Notice tone="danger" title={FAILED_DELETE_MESSAGE}>
                {TRY_AGAIN_BODY}
              </Notice>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>{DELETE_KEEP}</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                aria-busy={submitting || undefined}
                onClick={(event) => {
                  // Stay open while the request is out: the dialog closes when the server has answered, not before.
                  event.preventDefault();
                  void remove(item);
                }}
              >
                {submitting ? 'Deleting' : DELETE_CONFIRM}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
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
              <AlertDialogDescription>
                {blockedSentence(item.name)}. {BLOCKED_ADVICE}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Table regionLabel="Formulas that use this rate, scrollable" caption={`Formulas that use ${item.name}`}>
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
            <AlertDialogFooter>
              <Link href={FIELDS_AND_FORMULAS_PATH} className={buttonVariants({ variant: 'secondary' })}>
                {BLOCKED_LINK}
              </Link>
              <AlertDialogCancel>{BLOCKED_CLOSE}</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
