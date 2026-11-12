'use client';

import type { ComponentProps, RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import type { ChangePasswordField } from '@/lib/auth/change-password';

import { BLOCKED_BODY, BLOCKED_TITLE, errorSummaryTitle, FAILED_BODY, FAILED_TITLE, SUCCESS_BODY, SUCCESS_TITLE } from './texts';

/**
 * The pieces of the "Change password" form that repeat (SCR-23): one password field with its label, hint and message, the notice of a
 * result, and the summary of what needs fixing. They hold no state; `change-password-form.tsx` owns it.
 */

export const FIELD_IDS: Readonly<Record<ChangePasswordField, string>> = {
  currentPassword: 'current-password',
  newPassword: 'new-password',
  repeatPassword: 'repeat-password',
};

export interface PasswordFieldProps {
  readonly field: ChangePasswordField;
  readonly label: string;
  readonly autoComplete: 'current-password' | 'new-password';
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly hint?: string;
  readonly error?: string | undefined;
}

/** A labelled password field with the show and hide button; the label, hint and message are tied to it for assistive technology. */
export function PasswordField({ field, label, autoComplete, value, onValue, inputRef, hint, error }: PasswordFieldProps) {
  const optional: Pick<ComponentProps<typeof FormField>, 'hint' | 'error'> = {
    ...(hint === undefined ? {} : { hint }),
    ...(error === undefined ? {} : { error }),
  };
  return (
    <FormField id={FIELD_IDS[field]} label={label} {...optional}>
      {(control) => (
        <PasswordInput {...control} ref={inputRef} name={field} autoComplete={autoComplete} required value={value} onChange={(event) => onValue(event.target.value)} />
      )}
    </FormField>
  );
}

export type ResultKind = 'saved' | 'blocked' | 'failed' | 'refused';

export interface ResultNoticeProps {
  readonly kind: ResultKind;
  /** The server's own title, for a refusal with no field to put it under. It is the notice's title, with no body. */
  readonly serverTitle?: string;
}

/** The notice of a result at the top of the page: saved (`status`), or the three kinds of "no" (`alert`). */
export function ResultNotice({ kind, serverTitle }: ResultNoticeProps) {
  if (kind === 'saved') return <Notice tone="success" title={SUCCESS_TITLE}>{SUCCESS_BODY}</Notice>;
  if (kind === 'blocked') return <Notice tone="danger" title={BLOCKED_TITLE}>{BLOCKED_BODY}</Notice>;
  if (kind === 'refused') return <Notice tone="danger" title={serverTitle ?? FAILED_TITLE} />;
  return <Notice tone="danger" title={FAILED_TITLE}>{FAILED_BODY}</Notice>;
}

export interface SummaryEntry {
  readonly field: ChangePasswordField;
  readonly message: string;
}

/** "N things need fixing.", each message a link that moves focus to its field. */
export function ErrorSummary({ entries, onFocusField }: { readonly entries: ReadonlyArray<SummaryEntry>; readonly onFocusField: (field: ChangePasswordField) => void }) {
  return (
    <Notice tone="danger" title={errorSummaryTitle(entries.length)}>
      <ul className="list-disc pl-s-4 opacity-10">
        {entries.map(({ field, message }) => (
          <li key={field}>
            <a
              href={`#${FIELD_IDS[field]}`}
              className="underline"
              onClick={(event) => {
                event.preventDefault();
                onFocusField(field);
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
