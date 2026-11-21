'use client';

import { useRef, useState } from 'react';

import { systemClock } from '@/lib/time';

/** What a part form does with its automatic saves' record. The object is the same on every render, so an effect may list it as a dependency. */
export interface AutosaveTrail {
  /** A save the tick starts for this field is queued (`begin`) and judged (`end`). */
  readonly begin: (fieldId: string) => void;
  readonly end: (fieldId: string) => void;
  /** A save the tick started for this field is on its way or being judged. */
  readonly isAutomatic: (fieldId: string) => boolean;
  /** The tick's save of this field failed; `refusedText` is the text the server refused (a 422), or null when no answer came (network, 5xx). */
  readonly fail: (fieldId: string, refusedText: string | null) => void;
  /** This field was saved, or no longer differs from what the server holds: it is no longer a failure, and when none is left the status goes. */
  readonly saved: (fieldId: string) => void;
  /** The server refused exactly this text for this field on the tick, and it has not been changed since. */
  readonly refusedBefore: (fieldId: string, text: string) => boolean;
  /** The part was read again: what was typed is gone, and so is every failure of it. */
  readonly reset: () => void;
}

/**
 * What a part form remembers about its automatic saves (STORY-05.10), apart from the form's own state so that file does not grow with it:
 * - which fields have a save on its way that the 30-second tick started, so a failure of it is a quiet status (AC-5) and not the alert of a failed blur;
 * - which fields the tick failed to save, and the time of the first failure while any still has not been saved: **one** status, not repeated while the same failure continues, cleared by the next
 *   good save of those fields;
 * - the text the server refused (422) for a field, so the tick does not send the same refused text again on every tick; typing something else lifts it.
 * Answers the time of the failure (null when there is none) and the actions.
 */
export function useAutosaveTrail(): readonly [Date | null, AutosaveTrail] {
  const [failedAt, setFailedAt] = useState<Date | null>(null);
  const started = useRef(new Map<string, number>());
  const failed = useRef(new Set<string>());
  const refused = useRef(new Map<string, string>());
  const [trail] = useState<AutosaveTrail>(() => ({
    begin(fieldId) {
      started.current.set(fieldId, (started.current.get(fieldId) ?? 0) + 1);
    },
    end(fieldId) {
      const left = (started.current.get(fieldId) ?? 0) - 1;
      if (left > 0) started.current.set(fieldId, left);
      else started.current.delete(fieldId);
    },
    isAutomatic: (fieldId) => started.current.has(fieldId),
    fail(fieldId, refusedText) {
      if (refusedText !== null) refused.current.set(fieldId, refusedText);
      failed.current.add(fieldId);
      const at = systemClock.now();
      setFailedAt((current) => current ?? at);
    },
    saved(fieldId) {
      refused.current.delete(fieldId);
      if (failed.current.delete(fieldId) && failed.current.size === 0) setFailedAt(null);
    },
    refusedBefore: (fieldId, text) => refused.current.get(fieldId) === text,
    reset() {
      started.current.clear();
      failed.current.clear();
      refused.current.clear();
      setFailedAt(null);
    },
  }));
  return [failedAt, trail];
}
