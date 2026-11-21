'use client';

import type { SaveGate } from '@/lib/estimates/save-gate';

import { useAutosave } from './use-autosave';

export interface AutosaveProps {
  /** The page's one save gate: what is unsaved, what is in flight, and the way to ask the part forms to send again. */
  readonly gate: SaveGate;
  /** The Engineer may change the inputs (`canEditInputs`): with no right to edit there is no timer. */
  readonly enabled: boolean;
  /** Calculate is in flight: a tick is skipped, not queued. */
  readonly calculating: boolean;
}

/**
 * The page's 30-second save (STORY-05.10), as a component that draws nothing: it is the one place the timer lives. It is fetched after the page is up with the form's own code (NFR-009, ADR-016): typing
 * is only possible once that is here, so there is nothing to save before it, and the first load of `/estimates/[code]` carries none of it.
 */
export function Autosave({ gate, enabled, calculating }: AutosaveProps) {
  useAutosave(gate, { enabled, isBlocked: () => calculating });
  return null;
}
