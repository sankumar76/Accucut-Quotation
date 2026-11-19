'use client';

import { useEffect, useRef, useState } from 'react';

import { checkFormula, type FormulaCheckView } from '@/lib/config/formula-editor-client';

/**
 * The live check of SCR-18 (STORY-08.02 AC-1, AC-2): the formula is sent to `POST /config/formula-check` after a 300 ms pause in typing, and the answer is one of four things: the check is on its way, the
 * formula is valid (with what it uses, feeds and gives on the sample row), the server refused it with the SCR-18 sentence, or no usable answer came. The first check of an opened editor starts at once.
 * Only the latest request counts: a slower answer to older text is dropped, so a valid line is never shown for a formula that has since been changed.
 */

export const CHECK_PAUSE_MS = 300;

export type CheckState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'valid'; readonly view: FormulaCheckView }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'failed' };

interface Settled {
  readonly text: string;
  readonly state: Exclude<CheckState, { kind: 'checking' }>;
}

/** The check, and the last valid answer, which "Used by" keeps showing while the formula is being fixed. */
export interface FormulaCheck {
  readonly state: CheckState;
  readonly lastValid: FormulaCheckView | null;
}

interface Answers {
  readonly settled: Settled | null;
  readonly lastValid: FormulaCheckView | null;
}

/** An answer arrived: it is the current one, and a valid one is also the last valid one. */
const answered =
  (settled: Settled) =>
  (before: Answers): Answers => ({ settled, lastValid: settled.state.kind === 'valid' ? settled.state.view : before.lastValid });

export function useFormulaCheck(fieldId: string, text: string, sampleRowId: string | null): FormulaCheck {
  const [answers, setAnswers] = useState<Answers>({ settled: null, lastValid: null });
  const latest = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    latest.current += 1;
    const mine = latest.current;
    const delay = first.current ? 0 : CHECK_PAUSE_MS;
    first.current = false;
    const handle = setTimeout(() => {
      void checkFormula({ fieldId, text, ...(sampleRowId === null ? {} : { sampleRowId }) }).then((outcome) => {
        if (mine !== latest.current) return;
        if (outcome.status === 'ok') return setAnswers(answered({ text, state: { kind: 'valid', view: outcome.value } }));
        if (outcome.status === 'refused') return setAnswers(answered({ text, state: { kind: 'invalid', message: outcome.fields['text'] ?? outcome.title } }));
        return setAnswers(answered({ text, state: { kind: 'failed' } }));
      });
    }, delay);
    return () => clearTimeout(handle);
  }, [fieldId, text, sampleRowId]);

  // An answer is for the text it was asked about: for any other text the check is still on its way.
  const { settled, lastValid } = answers;
  return { state: settled !== null && settled.text === text ? settled.state : { kind: 'checking' }, lastValid };
}
