'use client';

import { Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { type FormField, PART_CHANGED_CODE } from '@/lib/estimates/form-client';
import { dropPicture, pictureUrl, sendPicture, type PartPictureAnswer } from '@/lib/estimates/picture-client';
import type { PictureView } from '@/lib/estimates/picture-view';
import { MAX_PICTURE_BYTES, PICTURE_TYPE_MESSAGE, PICTURE_UPLOAD_FAILED_MESSAGE, pictureTooLargeMessage, sanitiseFileName } from '@/lib/images/picture-rules';
import { detectImageType, IMAGE_MIMES } from '@/lib/images/signature';

import { controlIdOf } from './field-renderer';
import {
  ADDING,
  CHOOSE_A_FILE,
  CHOOSE_A_FILE_BUTTON,
  NO_PICTURE,
  PASTE_HINT,
  PHONE_HINT,
  PICTURE_ADDED,
  PICTURE_CHANGED_NOTICE,
  PICTURE_OPTIONAL,
  PICTURE_REMOVED,
  PICTURE_REPLACED,
  pictureAlt,
  pictureGroupLabel,
  PROMPT_BEFORE,
  REMOVE,
  REMOVING,
  REPLACE,
  sizeText,
} from './picture-texts';

export interface PartPictureProps {
  /** The picture field as the server's form states it: its ID, Excel letter, label and hint. */
  readonly field: Pick<FormField, 'id' | 'letter' | 'label' | 'kind' | 'hint'>;
  readonly estimateId: string;
  readonly partId: string;
  /** The picture the part has when the form read it, or null. The control keeps its own copy after a change of its own. */
  readonly picture: PictureView | null;
  /** False once the estimate may no longer be changed by this person: the picture is shown and nothing offers a change (UX-07). The server refuses a change regardless. */
  readonly editable: boolean;
  /** Runs a change in turn with the part's saves of values, so no save is sent with a revision this change has just moved (`usePartValues.inTurn`). */
  readonly inTurn: <T>(job: () => Promise<T>) => Promise<T>;
  /** A change went through: the part's new revision and how complete it is, for the tree and the form to keep in step. */
  readonly onChanged: (answer: PartPictureAnswer) => void;
  /** The server says the part is not as the person saw it: the tree is read again. */
  readonly onConflict: () => void;
}

/** What the file picker offers: the four kinds. On a phone it lists the camera and the gallery as well, which `capture` would take away. */
const ACCEPT = IMAGE_MIMES.join(',');

type Busy = 'adding' | 'removing' | null;

/** Judges a file on the screen before it is sent, by its size and its content, as the server will (`lib/images`; the server is the judge). Null when it may be sent. */
async function problemWith(file: File): Promise<string | null> {
  if (file.size >= MAX_PICTURE_BYTES) return pictureTooLargeMessage(sanitiseFileName(file.name), file.size);
  return detectImageType(new Uint8Array(await file.arrayBuffer())) === null ? PICTURE_TYPE_MESSAGE : null;
}

/** The first picture on the clipboard, or undefined: a paste of text carries none and is left alone. */
const pastedPicture = (event: ClipboardEvent): File | undefined => Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));

const carriesFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer.types).includes('Files');

/**
 * The picture field of the part form: Part Model (C) (STORY-05.07; FR-047, D-31; UX spec SCR-05). A picture is added by pasting a copied one (Ctrl+V), by dropping one here, or by
 * "choose a file" (a phone offers the camera and the gallery); it is shown as a preview with its name and size, and can be replaced or removed. It is **optional**: it says so, and
 * nothing anywhere asks for one. A file is judged on the screen first (its size and its content, the same rule as the server's), so a refusal comes at once and says what to do; the
 * server judges again and is the only judge. A message is inline in the field, `role="alert"`, and the picture that was there stays. Everything that changes a picture is the one button
 * or key a person can reach without a mouse. This is fetched when the form opens (`PictureSlot`), not in the first load of the page.
 */
export function PartPicture({ field, estimateId, partId, picture: initial, editable, inTurn, onChanged, onConflict }: PartPictureProps) {
  const [picture, setPicture] = useState<PictureView | null>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const chooser = useRef<HTMLInputElement>(null);
  const working = useRef(false);

  const controlId = controlIdOf(field);
  const labelId = `${controlId}-label`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  /** Runs one change at a time: a second paste or drop while one is on its way is ignored, so two requests cannot cross. */
  async function change(kind: Exclude<Busy, null>, run: () => Promise<PartPictureAnswer | string>, said: (answer: PartPictureAnswer) => string): Promise<void> {
    if (working.current) return;
    working.current = true;
    setBusy(kind);
    setProblem(null);
    // A file that cannot be read (taken away after it was chosen) is a failure like a lost connection, and never leaves the control stuck.
    // In turn with the part's saves of values: the ones already asked for finish first, and the next is sent with the revision this change makes.
    const result = await inTurn(run).catch(() => PICTURE_UPLOAD_FAILED_MESSAGE);
    working.current = false;
    setBusy(null);
    if (typeof result === 'string') {
      setProblem(result);
      return;
    }
    setPicture(result.picture);
    setAnnouncement(said(result));
    onChanged(result);
  }

  /** The words for a refusal or a failure: the server's own for a refusal of the picture, and the sentence for a part that changed under the person. */
  function wordsFor(outcome: Awaited<ReturnType<typeof sendPicture>>): string {
    if (outcome.status === 'ok') return '';
    if (outcome.status === 'failed') return PICTURE_UPLOAD_FAILED_MESSAGE;
    if (outcome.code === PART_CHANGED_CODE) {
      onConflict();
      return PICTURE_CHANGED_NOTICE;
    }
    return outcome.title;
  }

  function add(file: File): Promise<void> {
    const replacing = picture !== null;
    return change(
      'adding',
      async () => {
        const refused = await problemWith(file);
        if (refused !== null) return refused;
        const outcome = await sendPicture(estimateId, partId, file);
        return outcome.status === 'ok' ? outcome.value : wordsFor(outcome);
      },
      () => (replacing ? PICTURE_REPLACED : PICTURE_ADDED),
    );
  }

  function remove(): Promise<void> {
    return change(
      'removing',
      async () => {
        const outcome = await dropPicture(estimateId, partId);
        return outcome.status === 'ok' ? outcome.value : wordsFor(outcome);
      },
      () => PICTURE_REMOVED,
    );
  }

  // Ctrl+V of a copied picture, anywhere in the form (not in an open dialog): the handler is the latest `add`, and the listener is set once.
  const addRef = useRef(add);
  useEffect(() => {
    addRef.current = add;
  });
  useEffect(() => {
    if (!editable) return;
    const onPaste = (event: ClipboardEvent): void => {
      if (event.target instanceof Element && event.target.closest('[role="dialog"]') !== null) return;
      const file = pastedPicture(event);
      if (file === undefined) return;
      event.preventDefault();
      void addRef.current(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [editable]);

  function chosen(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again (after a refusal, say) fires the change again.
    event.target.value = '';
    if (file !== undefined) void add(file);
  }

  function dropped(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (editable && file !== undefined) void add(file);
  }

  const openChooser = (): void => chooser.current?.click();
  const describedBy = [field.hint === null ? undefined : hintId, problem === null ? undefined : errorId].filter((id) => id !== undefined).join(' ');

  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <span id={labelId} className="flex items-center gap-s-2 text-label font-semibold text-ink-2">
        <span className="flex items-center gap-s-1">
          <ColumnTag letter={field.letter} kind={field.kind} />
          {field.label}
        </span>
        <span className="font-normal text-ink-3">{PICTURE_OPTIONAL}</span>
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        aria-busy={busy === null ? undefined : true}
        data-picture-zone=""
        onDragOver={(event) => {
          if (!editable || !carriesFiles(event)) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={dropped}
        className={cn(
          'flex min-w-0 items-start gap-s-3 rounded-md border border-dashed p-s-3',
          dragging ? 'border-primary bg-primary-soft' : problem === null ? 'border-border-strong bg-surface-2' : 'border-danger-line bg-surface-2',
        )}
      >
        {picture === null ? (
          <span className="flex h-s-7 w-s-7 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-ink-3">
            <Icon icon={ImageIcon} size="large" />
          </span>
        ) : (
          // A plain <img> with its size, from our own route (architecture section 10); the picture is shown by its stored type and never decoded by the server.
          <img src={pictureUrl(picture.id)} alt={pictureAlt(picture.fileName)} width={48} height={48} className="h-s-7 w-s-7 shrink-0 rounded-sm border border-border bg-surface object-contain" />
        )}
        <div className="flex min-w-0 flex-col gap-s-1">
          {picture === null ? (
            <span className="text-body text-ink-2">{editable ? null : NO_PICTURE}</span>
          ) : (
            <span className={cn('text-body font-semibold text-ink', BREAK_LONG_NAMES)}>
              {picture.fileName}
              <span className="font-normal text-ink-2">{` ${sizeText(picture.sizeBytes)}`}</span>
            </span>
          )}
          {editable ? (
            <>
              <input ref={chooser} id={controlId} type="file" accept={ACCEPT} tabIndex={-1} aria-label={pictureGroupLabel(field.label)} className="hidden" onChange={chosen} />
              {picture === null ? <span className="text-label text-ink-2">{PROMPT_BEFORE}{CHOOSE_A_FILE}.</span> : null}
              <span className="flex flex-wrap items-center gap-s-2">
                <Button type="button" variant="secondary" aria-busy={busy === null ? undefined : true} onClick={openChooser}>
                  {picture === null ? CHOOSE_A_FILE_BUTTON : REPLACE}
                </Button>
                {picture === null ? null : (
                  <Button type="button" variant="ghost" aria-busy={busy === null ? undefined : true} onClick={() => void remove()}>
                    {REMOVE}
                  </Button>
                )}
              </span>
              <span className="hidden text-label text-ink-3 md:block">{PASTE_HINT}</span>
              <span className="text-label text-ink-3 md:hidden">{PHONE_HINT}</span>
            </>
          ) : null}
        </div>
      </div>
      {problem === null ? null : (
        <div id={errorId}>
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        </div>
      )}
      {field.hint === null ? null : (
        <p id={hintId} className="text-label text-ink-3">
          {field.hint}
        </p>
      )}
      <p role="status" className="sr-only">
        {busy === 'adding' ? ADDING : busy === 'removing' ? REMOVING : announcement}
      </p>
    </div>
  );
}
