'use client';

import { useRef, useState } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { saveDraft } from '@/lib/estimates/save-draft';
import type { SaveGate } from '@/lib/estimates/save-gate';
import { formatIstTime } from '@/lib/time';

import { DRAFT_NOT_SAVED_BODY, DRAFT_NOT_SAVED_TITLE, draftSavedText, SAVE_DRAFT_LABEL, SAVING_LABEL } from './save-texts';

/** What the last press of Save draft came to: nothing yet, saved at a time (already written as the notice writes it), or a value is still not saved. */
type DraftOutcome = { readonly kind: 'none' } | { readonly kind: 'saved'; readonly time: string } | { readonly kind: 'failed' };

export interface SaveDraftControl {
  readonly saving: boolean;
  readonly outcome: DraftOutcome;
  readonly press: () => Promise<void>;
}

/**
 * The state of the Save draft button (STORY-05.08 AC-1, AC-5). A press is one save through the gate (`saveDraft`), and a press while one is on its way is ignored, so a double click is one save.
 * A draft is saved with any field blank: nothing here asks for completeness (FR-053).
 */
export function useSaveDraft(gate: SaveGate): SaveDraftControl {
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<DraftOutcome>({ kind: 'none' });
  // State is read after the render, so a second click in the same tick needs a ref to be seen.
  const inFlight = useRef(false);

  async function press(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const result = await saveDraft(gate);
    inFlight.current = false;
    setSaving(false);
    setOutcome(result.saved ? { kind: 'saved', time: formatIstTime(result.at) } : { kind: 'failed' });
  }

  return { saving, outcome, press };
}

/**
 * The line and the alert of Save draft, drawn in the action bar. The line is a polite live region that is always on the page, so the words are announced when they arrive ("Draft saved at 10:42
 * IST."); a draft that could not be saved is an alert that says what to do, and the typed values stay where they are.
 */
export function SaveDraftNotice({ draft }: { readonly draft: SaveDraftControl }) {
  return (
    <>
      <p role="status" data-draft-status="" className="min-h-[1lh] text-label font-medium text-ink-2">
        {draft.outcome.kind === 'saved' ? draftSavedText(draft.outcome.time) : ''}
      </p>
      {draft.outcome.kind === 'failed' ? (
        <Notice tone="danger" title={DRAFT_NOT_SAVED_TITLE}>
          {DRAFT_NOT_SAVED_BODY}
        </Notice>
      ) : null}
    </>
  );
}

export function SaveDraftButton({ draft }: { readonly draft: SaveDraftControl }) {
  return (
    <Button variant="secondary" loading={draft.saving} onClick={() => void draft.press()} className="flex-1 sm:flex-none">
      {draft.saving ? SAVING_LABEL : SAVE_DRAFT_LABEL}
    </Button>
  );
}
