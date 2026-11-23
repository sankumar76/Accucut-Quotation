'use client';

import { EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FormField } from '@/components/shared/form-field';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { checkIgnoreRemarks, IGNORE_REMARKS_TOO_LONG_MESSAGE } from '@/lib/estimate/ignore-words';
import { ignoreEstimate } from '@/lib/estimates/ignore-client';

import { announce, prepareAnnouncer } from './announce';
import { ALREADY_IGNORED_CODE } from './ignore-codes';
import { IGNORE_ALERT_ID, IGNORE_REMARKS_FIELD_ID } from './ignore-ids';
import { IGNORE_INTRO, IGNORE_SUBMIT_LABEL, IGNORE_UNCONFIRMED, IGNORING_LABEL, ignoredStatusLine, ignoreTitle, KEEP_IT_OPEN_LABEL, REMARKS_HINT, REMARKS_LABEL, REMARKS_REQUIRED_TAG } from './ignore-texts';

/**
 * "Ignore" (CR-01 item 7D, AQP-401 AC-2, AC-8; UX 12944 section 3): the dialog a Lead or an Admin opens on an estimate that is not taken forward. It collects the remarks the Engineer will read and the audit log keeps;
 * the server judges everything (the role, the status, the layer, the remarks), and this only shows its answer. The remarks are judged here as well, by the same function the server calls (`checkIgnoreRemarks`: the
 * shared text rule, 1 to 500 code points, no hidden character), so the sentence under the field is the server's own and nothing is sent that would be refused. **No `maxlength`**: it counts UTF-16 units, and a long
 * paste must be reported, not cut. It is an AlertDialog, so focus starts on the safe choice, **Keep it open**, and Escape closes it with nothing sent. It is fetched on the first press of the button, through the overlay
 * loader, and is **not** in the first load of the page (NFR-009, ADR-016). Its words are in `ignore-texts.ts`.
 *
 * **States.** Default; the remarks refused (the message is under the field: shown on blur only when the text is too long, and on every submit; focus goes to the field after a refused submit; what was typed stays and the
 * message clears when the field is edited); Saving ("Ignoring", the buttons held and the dialog cannot be dismissed); **a second press** (409 `ESTIMATE_ALREADY_IGNORED`: the estimate is ignored, which is what the
 * person wanted, so it is treated as done and the page is drawn again, showing the first person's name and remarks); any other refusal shows the server's own sentence and the page is drawn again when the dialog is
 * closed, because it is out of date; and when no usable answer comes the dialog says it could not confirm and the page is drawn again, because the Ignore may have gone through.
 */

export interface IgnoreDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The task's code, "Q-2026-0318": the title is "Ignore Q-2026-0318?". */
  readonly code: string;
  /** The Ignore worked, or the estimate was already ignored: the page is drawn again and shows the Ignored state. */
  readonly onIgnored: () => void;
  /** No usable answer came and the Ignore may have gone through: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  /** The server refused with a sentence (the estimate changed elsewhere): the dialog keeps the sentence in view and the page is drawn again when the dialog is closed, not before. */
  readonly onRefused: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  /** Any refusal that is not a field's and not "already ignored": the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const IDLE: Phase = { kind: 'idle' };

function Alert({ phase }: { readonly phase: Phase }) {
  const refusedAlert = useRef<HTMLDivElement>(null);
  // The button that was pressed is now off, so focus would be lost: it goes to the alert, which is read out by its role.
  useEffect(() => {
    if (phase.kind === 'refused') refusedAlert.current?.focus();
  }, [phase.kind]);
  if (phase.kind === 'refused') {
    return (
      <div id={IGNORE_ALERT_ID} ref={refusedAlert} tabIndex={-1} className="rounded-md">
        <Notice tone="danger">{phase.message}</Notice>
      </div>
    );
  }
  if (phase.kind === 'unconfirmed') return <Notice tone="danger">{IGNORE_UNCONFIRMED}</Notice>;
  return null;
}

function IgnoreForm({ props, inFlightRef }: { readonly props: IgnoreDialogProps; readonly inFlightRef: { current: boolean } }) {
  const { estimateId, code, onIgnored, onStale, onRefused } = props;
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(IDLE);
  const field = useRef<HTMLTextAreaElement>(null);
  const saving = phase.kind === 'saving';

  // The live region is made now, before the action is sent, so the sentence that follows the redraw is announced as a change.
  useEffect(() => {
    prepareAnnouncer();
  }, []);

  // A refusal of the remarks takes focus back to the field (one field, so no summary); the blur message does not move focus, so only a submit sets this.
  const [focusField, setFocusField] = useState(0);
  useEffect(() => {
    if (focusField > 0) field.current?.focus();
  }, [focusField]);

  function type(value: string): void {
    setRemarks(value);
    setError(null);
  }

  /** On leaving the field the length is said at once; the empty and hidden-character messages wait for the submit (UX 12944 section 3). */
  function leave(): void {
    const checked = checkIgnoreRemarks(remarks);
    if (!checked.ok && checked.message === IGNORE_REMARKS_TOO_LONG_MESSAGE) setError(checked.message);
  }

  /** Ignored, or already ignored: the polite status is said (to a region that outlives the redraw), and the page is told to draw itself again. */
  function done(): void {
    announce(ignoredStatusLine(code));
    onIgnored();
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // A second press while the first is in flight must not send a second request (a ref, not state: the next render has not happened yet).
    if (inFlightRef.current) return;
    const checked = checkIgnoreRemarks(remarks);
    if (!checked.ok) {
      setError(checked.message);
      setFocusField((count) => count + 1);
      return;
    }
    inFlightRef.current = true;
    setError(null);
    setPhase({ kind: 'saving' });
    const outcome = await ignoreEstimate(estimateId, remarks);
    inFlightRef.current = false;
    if (outcome.status === 'ok') return done();
    if (outcome.status === 'refused') {
      // The server refused the remarks (a 422 under the field): its own sentence under the field, and what was typed is kept.
      if (outcome.fields['remarks'] !== undefined) {
        setError(outcome.fields['remarks']);
        setPhase(IDLE);
        return setFocusField((count) => count + 1);
      }
      // A second press (another window, a double tap that got through): the estimate is ignored, which is what was asked for.
      if (outcome.httpStatus === 409 && outcome.code === ALREADY_IGNORED_CODE) return done();
      // Any other refusal means the estimate changed elsewhere (quoted, unlocked, deleted): the sentence stays in the dialog, and the page is drawn again when the dialog is closed.
      setPhase({ kind: 'refused', message: outcome.title });
      return onRefused();
    }
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{ignoreTitle(code)}</AlertDialogTitle>
        <AlertDialogDescription>{IGNORE_INTRO}</AlertDialogDescription>
      </AlertDialogHeader>
      <Alert phase={phase} />
      <FormField
        id={IGNORE_REMARKS_FIELD_ID}
        label={REMARKS_LABEL}
        tag={<span className="ml-s-2 text-label font-normal text-ink-2">{` ${REMARKS_REQUIRED_TAG}`}</span>}
        hint={REMARKS_HINT}
        {...(error === null ? {} : { error })}
      >
        {(control) => (
          <Textarea
            {...control}
            ref={field}
            name="remarks"
            rows={4}
            required
            autoComplete="off"
            disabled={saving}
            value={remarks}
            onChange={(event) => type(event.target.value)}
            onBlur={leave}
          />
        )}
      </FormField>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{KEEP_IT_OPEN_LABEL}</AlertDialogCancel>
        <Button type="submit" loading={saving} disabled={phase.kind === 'refused'}>
          <Icon icon={EyeOff} size="large" />
          {saving ? IGNORING_LABEL : IGNORE_SUBMIT_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

export function IgnoreDialog(props: IgnoreDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the Ignore cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <IgnoreForm props={props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
