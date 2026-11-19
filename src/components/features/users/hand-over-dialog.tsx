'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { roleLabel } from '@/lib/auth/roles';
import { HAND_OVER_WRONG_PASSWORD_MESSAGE } from '@/lib/users/hand-over';
import { handOverAdminRole, type Refusal, type UserRow } from '@/lib/users/users-client';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';

import {
  CANCEL_LABEL,
  CHOICE_LABEL,
  CHOICE_PLACEHOLDER,
  CHOICE_REQUIRED_MESSAGE,
  CONFIRM_LABEL,
  CONFIRMING_LABEL,
  HAND_OVER_TITLE,
  HAND_OVER_UNCONFIRMED,
  HAND_OVER_WARNING,
  NO_ONE_TO_CHOOSE_HINT,
  PASSWORD_HINT,
  PASSWORD_LABEL,
} from './hand-over-texts';

/**
 * "Hand over the Admin role?" (STORY-01.09 AC-1, AC-2, AC-10; UX spec SCR-14 "Hand over" and "Hand over: wrong password"): the dialog the Admin opens from the Users page. It shows a choice of the **other active people**, whatever
 * their role (the screen hands in the list; never the Admin themself, never a deactivated person), the warning that the Admin becomes a Lead and is signed out, and the Admin's password. The server judges everything (the
 * role, the password, the person), so this only shows its answer. It is an AlertDialog, so focus starts on the safe choice, **Cancel**, and Escape closes it with nothing sent. It is fetched on the first press of the button
 * through the overlay loader and is **not** in the first load of the page (NFR-009).
 *
 * **The password** is the shared `PasswordInput` (`autocomplete="current-password"`). It is sent in the one request and **emptied as soon as the answer is in**; it is never put in the page, a link, storage or a log line from here.
 *
 * **States.** Default; Saving ("Handing over", the buttons held, the dialog cannot be dismissed); **Wrong password** (422 `STEP_UP_FAILED`: "That password is not correct. Try again." under the field, which is emptied and takes
 * focus; **the choice is kept**); **Blocked step-up** (429: a danger alert with the server's sentence, the choice kept); the person is no longer a choice (409, 404: the server's sentence under the choice, and the page's list is
 * read again); the caller is no longer the Admin (403: the server's sentence). When no usable answer comes the dialog says it could not confirm. On success the screen leaves for the sign-in page: the session has ended.
 */

export interface HandOverDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The people who may receive the role: active, not the caller. The screen derives it from the list the server sent. */
  readonly candidates: ReadonlyArray<UserRow>;
  /** The role was handed over: the Admin's session has ended, so the screen goes to the sign-in page. */
  readonly onHandedOver: () => void;
  /** The server said the choice is no longer valid (a person deactivated, or not found): read the list again so the choice is the truth. */
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  /** Any refusal that is not about a field: the step-up is blocked (429), the caller is no longer the Admin (403), or no usable answer came. */
  | { readonly kind: 'refused'; readonly message: string };

const EDITING: Phase = { kind: 'editing' };
const STEP_UP_FAILED_CODE = 'STEP_UP_FAILED';
const UNPROCESSABLE = 422;
const NOT_FOUND = 404;
const CONFLICT = 409;

/** A person as the choice says it: "Meera Nair (Lead)". */
const choiceLabel = (person: UserRow): string => `${person.name} (${roleLabel(person.role)})`;

function useHandOver(props: HandOverDialogProps, inFlightRef: RefObject<boolean>) {
  const { onHandedOver, onStale } = props;
  const [chosenId, setChosenId] = useState('');
  const [chosenError, setChosenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(EDITING);

  function refuse(outcome: Refusal): void {
    if (outcome.code === STEP_UP_FAILED_CODE && outcome.httpStatus === UNPROCESSABLE) {
      setPasswordError(HAND_OVER_WRONG_PASSWORD_MESSAGE);
      return setPhase(EDITING);
    }
    // The person chosen is gone, deactivated or the caller: the sentence goes under the choice, and the list is read again.
    if (outcome.httpStatus === CONFLICT || outcome.httpStatus === NOT_FOUND) {
      setChosenError(outcome.title);
      setPhase(EDITING);
      return onStale();
    }
    // A password the body schema refuses (422 with a field message) is said under the password.
    if (outcome.httpStatus === UNPROCESSABLE && outcome.fields['password'] !== undefined) {
      setPasswordError(outcome.fields['password']);
      return setPhase(EDITING);
    }
    // The block (429), an Admin who is no longer the Admin (403) and anything else: the server's own sentence.
    setPhase({ kind: 'refused', message: outcome.title });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current) return;
    const missingChoice = chosenId === '';
    const missingPassword = password === '';
    setChosenError(missingChoice ? CHOICE_REQUIRED_MESSAGE : null);
    setPasswordError(missingPassword ? PASSWORD_REQUIRED_MESSAGE : null);
    if (missingChoice || missingPassword) return;
    inFlightRef.current = true;
    setPhase({ kind: 'saving' });
    const outcome = await handOverAdminRole(chosenId, password);
    inFlightRef.current = false;
    // The password was sent: it is not kept, whatever the answer was.
    setPassword('');
    if (outcome.status === 'ok') return onHandedOver();
    if (outcome.status === 'refused') return refuse(outcome);
    setPhase({ kind: 'refused', message: HAND_OVER_UNCONFIRMED });
  }

  return {
    chosenId,
    chosenError,
    password,
    passwordError,
    phase,
    choose: (id: string): void => {
      setChosenId(id);
      setChosenError(null);
    },
    /** The person chosen is no longer a choice (the list was read again): the choice is emptied, and the server's sentence stays under it. */
    dropChoice: (): void => setChosenId(''),
    typePassword: (value: string): void => {
      setPassword(value);
      setPasswordError(null);
    },
    submit,
  };
}

type HandingOver = ReturnType<typeof useHandOver>;

function HandOverForm({ candidates, handing }: { readonly candidates: ReadonlyArray<UserRow>; readonly handing: HandingOver }) {
  const { phase, chosenId, chosenError, password, passwordError } = handing;
  const passwordField = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const saving = phase.kind === 'saving';
  const refusedMessage = phase.kind === 'refused' ? phase.message : null;

  // A password that was refused takes focus back to its field; a refusal that stops the hand-over is read out by its role and takes focus.
  useEffect(() => {
    if (passwordError !== null) passwordField.current?.focus();
  }, [passwordError]);
  useEffect(() => {
    if (refusedMessage !== null) alert.current?.focus();
  }, [refusedMessage]);
  const { dropChoice } = handing;
  useEffect(() => {
    if (chosenId !== '' && !candidates.some((person) => person.id === chosenId)) dropChoice();
  }, [candidates, chosenId, dropChoice]);

  return (
    <form noValidate onSubmit={(event) => void handing.submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle>{HAND_OVER_TITLE}</AlertDialogTitle>
        <AlertDialogDescription>{HAND_OVER_WARNING}</AlertDialogDescription>
      </AlertDialogHeader>
      {refusedMessage === null ? null : (
        <div ref={alert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{refusedMessage}</Notice>
        </div>
      )}
      <FormField
        id="hand-over-choice"
        label={CHOICE_LABEL}
        {...(candidates.length === 0 ? { hint: NO_ONE_TO_CHOOSE_HINT } : {})}
        {...(chosenError === null ? {} : { error: chosenError })}
      >
        {(control) => (
          <Select name="newAdmin" value={chosenId} disabled={saving || candidates.length === 0} onValueChange={handing.choose}>
            <SelectTrigger {...control}>
              <SelectValue placeholder={CHOICE_PLACEHOLDER} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {choiceLabel(person)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField id="hand-over-password" label={PASSWORD_LABEL} hint={PASSWORD_HINT} {...(passwordError === null ? {} : { error: passwordError })}>
        {(control) => (
          <PasswordInput
            {...control}
            ref={passwordField}
            name="password"
            required
            autoComplete="current-password"
            disabled={saving}
            value={password}
            onChange={(event) => handing.typePassword(event.target.value)}
          />
        )}
      </FormField>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{CANCEL_LABEL}</AlertDialogCancel>
        <Button type="submit" variant="danger" loading={saving} disabled={candidates.length === 0}>
          {saving ? CONFIRMING_LABEL : CONFIRM_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts with no choice and an empty password. */
function HandOverFormHost({ inFlightRef, ...props }: HandOverDialogProps & { readonly inFlightRef: RefObject<boolean> }) {
  const handing = useHandOver(props, inFlightRef);
  return <HandOverForm candidates={props.candidates} handing={handing} />;
}

export function HandOverDialog(props: HandOverDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the hand-over cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <HandOverFormHost {...props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
