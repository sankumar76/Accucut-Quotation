/**
 * What Calculate waits for before it sends anything (STORY-05.09 AC-2, review SQR-01 of AQP-317). Leaving a field queues its save, and a press on Calculate follows the leaving at once, so
 * without a wait the press can reach the server before the save does: the estimate would then be submitted with the value the part held before, and the immutable record would hold that
 * value while the screen shows the new one. The gate holds the saves in flight and the fields that show a value the server does not hold (the rule refused it, the text is not a number,
 * or the save failed). `settle()` waits for every save and says whether Calculate may go.
 */
export interface SaveGate {
  /** A save was queued: `settle()` waits for it. */
  readonly track: (save: Promise<unknown>) => void;
  /** The field of a part shows a value that is not saved, or no longer does. */
  readonly mark: (partId: string, fieldId: string, unsaved: boolean) => void;
  /** The part is not on the screen (or was read again): what was typed into it is gone, so nothing of it is unsaved any more. */
  readonly forget: (partId: string) => void;
  /** Waits until no save is in flight; true when no field shows an unsaved value. Never rejects. */
  readonly settle: () => Promise<boolean>;
}

export function createSaveGate(): SaveGate {
  const inFlight = new Set<Promise<unknown>>();
  const unsaved = new Set<string>();
  const keyOf = (partId: string, fieldId: string): string => `${partId}/${fieldId}`;

  return {
    track(save) {
      const done = save.then(
        () => undefined,
        () => undefined,
      );
      inFlight.add(done);
      void done.then(() => inFlight.delete(done));
    },
    mark(partId, fieldId, isUnsaved) {
      if (isUnsaved) unsaved.add(keyOf(partId, fieldId));
      else unsaved.delete(keyOf(partId, fieldId));
    },
    forget(partId) {
      for (const key of [...unsaved]) if (key.startsWith(`${partId}/`)) unsaved.delete(key);
    },
    async settle() {
      // A save that finishes can queue nothing new, but one typed while this waits is waited for too.
      while (inFlight.size > 0) await Promise.all([...inFlight]);
      return unsaved.size === 0;
    },
  };
}
