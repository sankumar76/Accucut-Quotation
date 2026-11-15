'use client';

import { useEffect, useState } from 'react';

import { inListOrder, loadTreatmentOptions, type TreatmentOption } from '@/lib/estimates/treatment-options-client';

import { LOADING, loadedFrom, type Loaded } from './use-form-definition';

/**
 * The treatments a part may choose (STORY-05.06 AC-3): read when Treatment / Color is drawn, so a treatment the Admin added, renamed or deleted since is what the list shows, with "read again"
 * for a read that failed. IDs and names only, in the list's order ("Other" last). It lives with the control, in the part form's fields, which are fetched after the page is up (NFR-009).
 */
export function useTreatmentOptions() {
  const [options, setOptions] = useState<Loaded<ReadonlyArray<TreatmentOption>>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadTreatmentOptions().then((outcome) => {
      if (!cancelled) setOptions(outcome.status === 'ok' ? { status: 'ready', value: inListOrder(outcome.value) } : loadedFrom(outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return {
    options,
    readAgain: (): void => {
      setOptions(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}
