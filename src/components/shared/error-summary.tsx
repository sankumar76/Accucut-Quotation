'use client';

import type { MouseEvent } from 'react';

import { Notice } from './notice';

export interface ErrorSummaryItem {
  /** The `id` of the control the message is about: the link goes to it and puts focus on it. */
  readonly fieldId: string;
  readonly message: string;
}

export interface ErrorSummaryProps {
  /** The bold first line, for example "3 things need fixing before this task can be assigned." */
  readonly title: string;
  readonly items: ReadonlyArray<ErrorSummaryItem>;
}

/** Puts focus on the control a message is about, instead of only scrolling to it (the control is what the person fixes next). */
function goToField(event: MouseEvent<HTMLAnchorElement>, fieldId: string): void {
  const control = document.getElementById(fieldId);
  if (control === null) return;
  event.preventDefault();
  control.focus();
}

/**
 * The summary at the top of a form that was refused (UX spec section 6.0 "Forms", STORY-04.01 AC-3): one `role="alert"` notice that says how many things
 * need fixing and lists each message as a link to its field. The same messages are also under their fields, so the summary is a map and never the only
 * place a message is. It shows nothing when there is nothing to fix.
 */
export function ErrorSummary({ title, items }: ErrorSummaryProps) {
  if (items.length === 0) return null;
  return (
    <Notice tone="danger" title={title}>
      <ul className="mt-s-1 list-disc pl-s-5">
        {items.map((item) => (
          <li key={item.fieldId}>
            <a href={`#${item.fieldId}`} onClick={(event) => goToField(event, item.fieldId)} className="font-semibold text-danger-ink underline underline-offset-2">
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
