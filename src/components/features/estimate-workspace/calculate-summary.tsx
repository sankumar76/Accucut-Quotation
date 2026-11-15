'use client';

import { useEffect, useRef, type MouseEvent } from 'react';

import { Notice } from '@/components/shared/notice';
import { blockedSummary } from '@/lib/estimate/calculate-words';
import type { BlockedPartView } from '@/lib/estimates/calculate-missing';

import { controlIdFor } from './field-ids';
import { focusFieldWhenPresent } from './focus-field';

/** The words of the summary, here and not in `estimate-texts.ts`, which the first load carries whole (NFR-009). */
const MISSING_SUMMARY_LABEL = 'Parts with missing inputs';
const missingPartLabel = (slNo: string, name: string | null): string => (name === null ? `Part ${slNo}` : `${slNo} ${name}`);

export interface CalculateSummaryProps {
  readonly parts: ReadonlyArray<BlockedPartView>;
  /** Chooses a part in the tree. The summary then puts focus on the field once that part's form is on the page (`focusFieldWhenPresent`). */
  readonly onChoosePart: (nodeId: string) => void;
  /** Changes with each blocked answer, so the summary takes focus once for each press and never while the person fills the fields in. */
  readonly focusRequest: number;
}

/**
 * The summary of a blocked Calculate (STORY-05.09 AC-1; UX spec SCR-05 "Calculate blocked"; UX spec section 6.0 "Forms"): one `role="alert"` notice, "Nothing was submitted. 3 parts have missing
 * inputs.", with each part and each of its missing fields as a link. The same words are under the fields and in the tree, so the summary is a map and never the only place a field is named.
 * It takes focus when a press is answered (the bar that was pressed is at the bottom of the page and the summary is at the top), and the link of a field chooses its part and focuses it.
 * It holds only what the server named: a Sl. No, a part's name and the labels of fields. No value, no rate and no figure (NFR-002).
 */
export function CalculateSummary({ parts, onChoosePart, focusRequest }: CalculateSummaryProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.focus();
  }, [focusRequest]);

  function go(event: MouseEvent<HTMLAnchorElement>, nodeId: string, fieldId: string): void {
    event.preventDefault();
    onChoosePart(nodeId);
    focusFieldWhenPresent(nodeId, fieldId);
  }

  return (
    <div ref={container} tabIndex={-1} data-calculate-summary="" className="rounded-md">
      <Notice tone="danger" title={blockedSummary(parts.length)}>
        <ul aria-label={MISSING_SUMMARY_LABEL} className="mt-s-1 flex flex-col gap-s-2">
          {parts.map((part) => (
            <li key={part.nodeId} className="min-w-0">
              <p className="font-semibold">{missingPartLabel(part.slNo, part.name)}</p>
              <ul className="flex min-w-0 flex-wrap gap-x-s-3">
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
