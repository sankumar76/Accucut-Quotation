/**
 * What Calculate waits for before it sends anything (STORY-05.09 AC-2, review SQR-01 of AQP-317). Leaving a field queues its save, and a press on Calculate follows the leaving at once, so
 * without a wait the press can reach the server before the save does: the estimate would then be submitted with the value the part held before, and the immutable record would hold that
 * value while the screen shows the new one. The gate holds the saves in flight and the fields that show a value the server does not hold (the rule refused it, the text is not a number,
 * or the save failed). `settle()` waits for every save and says whether Calculate may go.
 *
 * **The same two facts say whether anything typed would be lost** (STORY-05.08 AC-4): `isDirty()` is true while a save is in flight or a field shows a value the server does not hold, and
 * the warning on leaving, the guard on choosing another part and Save draft all read it from here, so there is one save path and one answer.
 */
export interface SaveGate {
  /** A save was queued: `settle()` waits for it. */
  readonly track: (save: Promise<unknown>) => void;
  /** The field of a part shows a value that is not saved, or no longer does. A field is marked as soon as it is typed into (STORY-05.08), not only when a save fails. */
  readonly mark: (partId: string, fieldId: string, unsaved: boolean) => void;
  /** The part is not on the screen (or was read again): what was typed into it is gone, so nothing of it is unsaved any more. The page asks before it lets a part with unsaved values go (`leave-guard.tsx`). */
  readonly forget: (partId: string) => void;
  /** Waits until no save is in flight; true when no field shows an unsaved value. Never rejects. */
  readonly settle: () => Promise<boolean>;
  /** A save is in flight, or a field shows a value that is not saved: leaving the page now could lose typing. */
  readonly isDirty: () => boolean;
  /** Told after every change of what is dirty (never for a change that changes nothing). Answers the way to stop listening. */
  readonly subscribe: (listener: () => void) => () => void;
  /** A part form offers the way to send again what it shows (Save draft, STORY-05.08 AC-1). Answers the way to withdraw it. */
  readonly offerFlush: (flush: () => void) => () => void;
  /** Asks every part form that offered one to send again what it shows. The saves it starts are tracked like any other. */
  readonly flush: () => void;
}

export function createSaveGate(): SaveGate {
  const inFlight = new Set<Promise<unknown>>();
  const unsaved = new Set<string>();
  const listeners = new Set<() => void>();
  const flushers = new Set<() => void>();
  const keyOf = (partId: string, fieldId: string): string => `${partId}/${fieldId}`;
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return {
    track(save) {
      const done = save.then(
        () => undefined,
        () => undefined,
      );
      inFlight.add(done);
      notify();
      void done.then(() => {
        inFlight.delete(done);
        notify();
      });
    },
    mark(partId, fieldId, isUnsaved) {
      const key = keyOf(partId, fieldId);
      if (isUnsaved === unsaved.has(key)) return;
      if (isUnsaved) unsaved.add(key);
      else unsaved.delete(key);
      notify();
    },
    forget(partId) {
      const dropped = [...unsaved].filter((key) => key.startsWith(`${partId}/`));
      for (const key of dropped) unsaved.delete(key);
      if (dropped.length > 0) notify();
    },
    async settle() {
      // A save that finishes can queue nothing new, but one typed while this waits is waited for too.
      while (inFlight.size > 0) await Promise.all([...inFlight]);
      return unsaved.size === 0;
    },
    isDirty: () => inFlight.size > 0 || unsaved.size > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    offerFlush(flush) {
      flushers.add(flush);
      return () => void flushers.delete(flush);
    },
    flush() {
      for (const flush of [...flushers]) flush();
    },
  };
}
