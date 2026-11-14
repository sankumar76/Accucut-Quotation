'use client';

import { useEffect, useRef, type MouseEvent } from 'react';

import { Notice } from '@/components/shared/notice';
import { blockedSummary } from '@/lib/estimate/calculate-words';
import type { BlockedPartView } from '@/lib/estimates/calculate-client';

import { CALCULATE_SUBMITTED_TITLE, MISSING_SUMMARY_LABEL, missingPartLabel } from './estimate-texts';
import { controlIdFor } from './field-renderer';

export interface SubmittedNoticeProps {
  /** The sentence the server answered with (the fixed one), or the same sentence from the page's constants when the estimate was submitted earlier. */
  readonly message: string;
  /** True for the press that just went through: focus moves here, because the button that was pressed has become "Submitted" and is off. False on a reload: nothing steals focus. */
  readonly takeFocus: boolean;
}

/**
 * The state "Submitted" of SCR-05 (STORY-05.09 AC-2, AC-6; UX spec SCR-05 "Submitted"): one notice with the single sentence the server answers with, and nothing else. **No number from the
 * calculation is anywhere**: the page has none to show, and the sentence is the answer's own (NFR-002).
 */
export function SubmittedNotice({ message, takeFocus }: SubmittedNoticeProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (takeFocus) container.current?.focus();
  }, [takeFocus]);

  return (
    <div ref={container} tabIndex={-1} data-calculate-submitted="" className="rounded-md">
      <Notice tone="success" title={CALCULATE_SUBMITTED_TITLE}>
        {message}
      </Notice>
    </div>
  );
}

export interface CalculateSummaryProps {
  readonly parts: ReadonlyArray<BlockedPartView>;
  /** Goes to a field of a part: chooses the part in the tree, and puts focus on the field once its form is there. */
  readonly onGo: (nodeId: string, fieldId: string) => void;
  /** Changes with each blocked answer, so the summary takes focus once for each press and never while the person fills the fields in. */
  readonly focusRequest: number;
}

/**
 * The summary of a blocked Calculate (STORY-05.09 AC-1; UX spec SCR-05 "Calculate blocked"; UX spec section 6.0 "Forms"): one `role="alert"` notice, "Nothing was submitted. 3 parts have missing
 * inputs.", with each part and each of its missing fields as a link. The same words are under the fields and in the tree, so the summary is a map and never the only place a field is named.
 * It takes focus when a press is answered (the bar that was pressed is at the bottom of the page and the summary is at the top), and the link of a field chooses its part and focuses it.
 * It holds only what the server named: a Sl. No, a part's name and the labels of fields. No value, no rate and no figure (NFR-002).
 */
export function CalculateSummary({ parts, onGo, focusRequest }: CalculateSummaryProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.focus();
  }, [focusRequest]);

  function go(event: MouseEvent<HTMLAnchorElement>, nodeId: string, fieldId: string): void {
    event.preventDefault();
    onGo(nodeId, fieldId);
  }

  return (
    <div ref={container} tabIndex={-1} data-calculate-summary="" className="rounded-md">
      <Notice tone="danger" title={blockedSummary(parts.length)}>
        <ul aria-label={MISSING_SUMMARY_LABEL} className="mt-s-1 flex flex-col gap-s-2">
          {parts.map((part) => (
            <li key={part.nodeId} className="flex flex-wrap items-baseline gap-x-s-2">
              <span className="font-semibold">{missingPartLabel(part.slNo, part.name)}:</span>
              <ul className="flex flex-wrap gap-x-s-3">
                {part.fields.map((field) => (
                  <li key={field.fieldId}>
                    <a
                      href={`#${controlIdFor(field.fieldId)}`}
                      onClick={(event) => go(event, part.nodeId, field.fieldId)}
                      className="inline-flex min-h-(--control-h) items-center font-semibold text-danger-ink underline underline-offset-2"
                    >
                      {field.label}
                      <span className="sr-only">{` in part ${part.slNo}`}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Notice>
    </div>
  );
}
