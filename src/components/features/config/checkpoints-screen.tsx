'use client';

import { History, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CurrentVersion } from '@/lib/config/checkpoints-client';
import { CHECKPOINT_NAME_MAX_LENGTH } from '@/lib/config/checkpoint';
import { formatIst } from '@/lib/time';

import { CheckpointsList } from './checkpoints-table';
import {
  CHECKPOINTS_DESCRIPTION,
  CHECKPOINTS_TITLE,
  CURRENT_LOADING_LABEL,
  CURRENT_TITLE,
  DIALOG_FAILED_LINE,
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  ERROR_RETRY,
  ERROR_TITLE,
  estimatesInUseLine,
  LIST_TITLE,
  LOADING_LABEL,
  REVERTED_TITLE,
  SAVE_BUTTON,
  SAVE_HINT,
  SAVE_LABEL,
  SAVE_PLACEHOLDER,
  SAVED_TITLE,
  SAVING_BUTTON,
  SEED_SAVED_BY,
  UNDO_LABEL,
} from './checkpoints-texts';
import { useCheckpointData, type CheckpointData } from './use-checkpoint-data';
import { useCheckpointsRevert, type CheckpointsRevert } from './use-checkpoints-revert';
import { useSaveCheckpoint, type SaveCheckpoint } from './use-save-checkpoint';
import { revertedMessage } from '@/lib/config/checkpoint';

/**
 * SCR-21 "Checkpoints and versions" (STORY-08.06 AC-2, AC-3, AC-7, AC-10): the current configuration card with the form that saves a checkpoint, the list of checkpoints newest first with a Revert on each row but the
 * one that names the current version, and the revert dialog (fetched on the first press, not in the first load, NFR-009). The page has checked the role and sent nothing; the screen asks the three routes itself, so its
 * Loading and Error states are real: the skeleton after 300 ms, and "We could not load the checkpoints" with "Try again". It decides nothing: the names, the versions, the words of a refusal and the revert are the
 * server's. There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, QLT-72).
 */

const SKELETON_ROWS = 4;
const CURRENT_SKELETON_ROWS = 3;

/** The current configuration card (AC-3): the version, who saved it and when (IST), and how many estimates use it. */
function CurrentCard({ current }: { readonly current: CurrentVersion | null }) {
  return (
    <Card aria-labelledby="current-title">
      <CardHeader>
        <CardTitle id="current-title">{CURRENT_TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        {current === null ? (
          <SkeletonBlock rows={CURRENT_SKELETON_ROWS} label={CURRENT_LOADING_LABEL} />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-s-4 gap-y-s-2">
            <dt className="text-ink-2">Version</dt>
            <dd className="font-semibold text-ink">{current.number}</dd>
            <dt className="text-ink-2">Saved</dt>
            <dd>
              {formatIst(new Date(current.savedAt))}
              {current.savedBy === null ? ` (${SEED_SAVED_BY.toLowerCase()})` : ` by ${current.savedBy}`}
            </dd>
            <dt className="text-ink-2">In use by</dt>
            <dd>{estimatesInUseLine(current.estimatesInUse)}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

/** The form that saves a checkpoint (AC-2): one labelled name field, the sentence under it when the name is refused, and one button. */
function SaveForm({ save }: { readonly save: SaveCheckpoint }) {
  return (
    <form
      noValidate
      className="flex flex-col gap-s-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save.submit();
      }}
    >
      <FormField id="checkpoint-name" label={SAVE_LABEL} hint={SAVE_HINT} {...(save.error === null ? {} : { error: save.error })}>
        {(control) => (
          <Input
            {...control}
            ref={save.inputRef}
            name="name"
            autoComplete="off"
            placeholder={SAVE_PLACEHOLDER}
            maxLength={CHECKPOINT_NAME_MAX_LENGTH * 2}
            value={save.name}
            onChange={(event) => save.setName(event.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" className="self-start" loading={save.saving}>
        {save.saving ? SAVING_BUTTON : SAVE_BUTTON}
      </Button>
    </form>
  );
}

/** What stands above the cards: a saved or unconfirmed save (polite or alert), the success of a revert with its undo (AC-7), and the line for a dialog whose code did not arrive. */
function Notices({ save, revert }: { readonly save: SaveCheckpoint; readonly revert: CheckpointsRevert }) {
  const { notice } = revert;
  return (
    <>
      {save.notice === null ? null : (
        <Notice tone={save.notice.tone} {...(save.notice.tone === 'success' ? { title: SAVED_TITLE } : {})}>
          {save.notice.text}
        </Notice>
      )}
      {notice === null ? null : (
        <Notice tone="success" title={REVERTED_TITLE}>
          <span className="block">{revertedMessage(notice.copiedFrom, notice.version)}</span>
          <Button variant="secondary" className="mt-s-2" data-action="undo" aria-haspopup="dialog" {...(revert.undoPressed ? ({ 'aria-busy': true } as const) : {})} onClick={(event) => revert.onUndo(event.detail === 0)}>
            <Icon icon={History} />
            {UNDO_LABEL}
          </Button>
        </Notice>
      )}
      {revert.loader.failed ? <Notice tone="danger">{DIALOG_FAILED_LINE}</Notice> : null}
    </>
  );
}

/** The dialog, once its code is here (not in the first load, NFR-009). The version it is about stays set after it closes, so its text does not change while the panel fades out. */
function RevertDialogHost({ revert }: { readonly revert: CheckpointsRevert }) {
  const Dialog = revert.loader.Overlay;
  if (Dialog === null || revert.target === null) return null;
  return <Dialog open={revert.open} onOpenChange={revert.setOpen} target={revert.target} baseVersion={revert.base} onReverted={revert.onReverted} onStale={revert.onStale} onCloseAutoFocus={revert.onCloseAutoFocus} />;
}

/** What the list card shows: the error with "Try again", the skeleton, the empty state, or the rows. */
function ListBody({ data, revert }: { readonly data: CheckpointData; readonly revert: CheckpointsRevert }) {
  if (data.status === 'error' && data.rows === null) {
    return (
      <ErrorState
        title={ERROR_TITLE}
        focusOnMount
        action={
          <Button onClick={() => void data.refresh()}>
            <Icon icon={RotateCcw} />
            {ERROR_RETRY}
          </Button>
        }
      />
    );
  }
  if (data.rows === null || data.current === null) return <SkeletonBlock rows={SKELETON_ROWS} label={LOADING_LABEL} />;
  if (data.rows.length === 0) return <EmptyState icon={<Icon icon={History} size="state" />} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />;
  return <CheckpointsList rows={data.rows} currentNumber={data.current.number} onRevert={revert.onRevert} pressedRowId={revert.pressedRowId} />;
}

export function CheckpointsScreen() {
  const data = useCheckpointData();
  const { read } = data;
  const save = useSaveCheckpoint({ onChanged: () => void data.refresh() });
  const revert = useCheckpointsRevert({ readAgain: data.refresh, listFailed: data.status === 'error', currentNumber: data.current?.number ?? null });

  // The first read starts when the screen opens: the status is `loading` already, so nothing is set first.
  useEffect(() => {
    void read();
  }, [read]);

  return (
    <>
      <PageHeader title={CHECKPOINTS_TITLE} description={CHECKPOINTS_DESCRIPTION} />
      <Notices save={save} revert={revert} />
      <div className="flex flex-col gap-s-4 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-s-4 lg:w-[22rem] lg:shrink-0">
          <CurrentCard current={data.current} />
          <Card>
            <CardContent>
              <SaveForm save={save} />
            </CardContent>
          </Card>
        </div>
        <Card className="min-w-0 flex-1" aria-busy={data.status === 'loading' || undefined}>
          <CardHeader>
            <CardTitle>{LIST_TITLE}</CardTitle>
          </CardHeader>
          <ListBody data={data} revert={revert} />
        </Card>
      </div>
      <RevertDialogHost revert={revert} />
    </>
  );
}
