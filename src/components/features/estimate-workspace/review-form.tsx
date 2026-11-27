'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { createClearedRefresh } from '@/lib/estimates/cleared-refresh';
import { reviewSaveGate } from '@/lib/estimates/review-save-gate';

import { Autosave } from './autosave';
import { FORM_LOCKED } from './estimate-texts';
import { LeaveGuard } from './leave-guard';
import { PartForm, type PartFormProps } from './part-form';
import type { PartReview } from './review-look';
import { REVIEW_IGNORED_NOTICE, SAVED_CLEARED_LINE } from './review-look-texts';

/** What the server hands the review's form: the form's props with the review look it drew (no function, no figure). */
export type ReviewFormProps = Omit<PartFormProps, 'review'> & { readonly review: PartReview };

/** The words of the block's one notice: the page's own while the estimate can be corrected, and the server's reason once a save was refused because it can no longer be (ED-12). */
export const reviewNotice = (refused: 'locked' | 'ignored' | null, own: string): string => (refused === 'ignored' ? REVIEW_IGNORED_NOTICE : refused === 'locked' ? FORM_LOCKED : own);

/** The page is drawn again at most this often after saves and renames, so a run of them is one read of the review (architecture note lead-admin-input-edit-2026-11-27, 6a A-7). */
const REFRESH_QUIET_MS = 300;

/**
 * The form the Lead's and the Admin's review draws (AQP-488): the Engineer's own `PartForm`, with the review look, in a module of its own so that what only the review needs is not in the Engineer's form. A row
 * chosen after the page was drawn takes the form's title (the choice is said once and the tree folds, `PartForm`); the first paint does none of it.
 *
 * **Editing (DEF-131 stage 2; FR-116).** When the page says the estimate can be corrected (`editable`, which the server worked out with `canEditInputs` and the viewer's real role), the form is the Engineer's whole form:
 * the same fields, validation, on-leaving save and 30-second save (`Autosave`), the warning on leaving (`LeaveGuard`) and the conflict notice when the Engineer saved the part first. What is new is only what ties it to the
 * review page: **one save gate** (`reviewSaveGate`) shared with the Recalculate press, so a press saves first; **one refresh**, when the first real save takes the figures from current to cleared (the tiles, the
 * tree and the notices then show the Total cleared state, with focus and the cursor where they were) and again for a rename or a part that changed under the person; and the **turn to read-only** when the
 * server says the estimate was approved, taken out of the editable states or ignored while the person typed (what was typed stays on screen). No figure is read or kept here.
 */
export function ReviewForm({ review, editable, ...props }: ReviewFormProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  // The server said no: the estimate is approved, quoted or ignored now. `null` while it is as the page drew it.
  const [refused, setRefused] = useState<'locked' | 'ignored' | null>(null);
  // The polite line said once for a change from current to cleared; set from the save's callback and read by the status below.
  const [announcement, setAnnouncement] = useState('');
  const cleared = useRef(createClearedRefresh());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = editable && refused === null;

  // The page says whether its figures are current each time it is drawn: after a Recalculate the next edit asks for a refresh again.
  useEffect(() => cleared.current.sync(review.figuresCurrent), [review.figuresCurrent]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const refresh = useCallback((): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startRefresh(() => router.refresh());
    }, REFRESH_QUIET_MS);
  }, [router]);

  const wrote = useCallback((): void => {
    if (!cleared.current.wrote(review.figuresCurrent)) return;
    setAnnouncement(SAVED_CLEARED_LINE);
    refresh();
  }, [review.figuresCurrent, refresh]);
  const refuse = useCallback(
    (kind: 'locked' | 'ignored'): void => {
      setRefused(kind);
      refresh();
    },
    [refresh],
  );

  const notice = reviewNotice(refused, review.notice);
  return (
    <>
      {canEdit ? <Autosave gate={reviewSaveGate} enabled calculating={false} /> : null}
      {canEdit ? <LeaveGuard gate={reviewSaveGate} /> : null}
      <PartForm
        {...props}
        editable={canEdit}
        gate={reviewSaveGate}
        onChanged={refresh}
        onNamed={refresh}
        onServerIgnored={() => refuse('ignored')}
        review={{ ...review, notice, onWrote: wrote, onLocked: () => refuse('locked') }}
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
