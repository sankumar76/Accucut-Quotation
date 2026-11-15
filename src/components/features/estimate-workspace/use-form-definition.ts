'use client';

import { useEffect, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { loadForm, loadMaterialOptions, type FormView, type MaterialChoice } from '@/lib/estimates/form-client';

/** Something read from the server: on its way, here, or not got. */
export type Loaded<T> = { readonly status: 'loading' } | { readonly status: 'ready'; readonly value: T } | { readonly status: 'failed' };

export const loadedFrom = <T>(outcome: Outcome<T>): Loaded<T> => (outcome.status === 'ok' ? { status: 'ready', value: outcome.value } : { status: 'failed' });
export const LOADING = { status: 'loading' } as const;

/**
 * The form's definition and the materials (STORY-05.03 AC-1, AC-5): read once for the estimate, whatever part is shown, with "read again" for each. The sections, letters,
 * labels, hints and rules are the server's, from the registry; this holds them and draws nothing. `lastSavedAt` is the time of the last write to any part: the form's
 * start, and the moment of each save after it.
 *
 * It is a module of its own, apart from the part's values (`use-part-form.ts`), because `PartForm` is in the first load of `/estimates/[code]` and calls this, while everything that
 * reads and saves a part's values goes with `PartFields`, which is fetched after the page is up (NFR-009, ADR-016 E1).
 */
export function useFormDefinition(estimateId: string) {
  const [form, setForm] = useState<Loaded<FormView>>(LOADING);
  const [materials, setMaterials] = useState<Loaded<ReadonlyArray<MaterialChoice>>>(LOADING);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadForm(estimateId).then((outcome) => {
      if (cancelled) return;
      setForm(loadedFrom(outcome));
      if (outcome.status === 'ok') setLastSavedAt(outcome.value.lastSavedAt);
    });
    void loadMaterialOptions().then((outcome) => {
      if (!cancelled) setMaterials(loadedFrom(outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [estimateId, attempt]);

  return {
    form,
    materials,
    lastSavedAt,
    wrote: (at: string): void => setLastSavedAt(at),
    readAgain: (): void => {
      setForm(LOADING);
      setMaterials(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}
