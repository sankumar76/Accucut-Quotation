'use client';

import { useEffect, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { loadForm, loadMaterialOptions, parseForm, parseMaterials, type FormView, type MaterialChoice } from '@/lib/estimates/form-client';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';

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
export function useFormDefinition(estimateId: string, seed?: PartFormSeed) {
  // A page that hands the two answers over as props (the Lead's review, DEF-141) starts with them and asks the server for nothing; an answer the readers do not accept is read from the server as ever.
  const [seeded] = useState(() => {
    const seededForm = seed !== undefined && seed.estimateId === estimateId ? parseForm(seed.form) : null;
    const seededMaterials = seededForm === null || seed === undefined ? null : parseMaterials(seed.materials);
    return seededForm !== null && seededMaterials !== null ? { form: seededForm, materials: seededMaterials } : null;
  });
  const [form, setForm] = useState<Loaded<FormView>>(seeded === null ? LOADING : { status: 'ready', value: seeded.form });
  const [materials, setMaterials] = useState<Loaded<ReadonlyArray<MaterialChoice>>>(seeded === null ? LOADING : { status: 'ready', value: seeded.materials });
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(seeded === null ? null : seeded.form.lastSavedAt);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (seeded !== null && attempt === 0) return undefined;
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
  }, [estimateId, attempt, seeded]);

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
