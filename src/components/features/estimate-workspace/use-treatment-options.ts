'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { inListOrder, loadTreatmentOptions, parseTreatmentOptions, type TreatmentOption } from '@/lib/estimates/treatment-options-client';

import { LOADING, loadedFrom, type Loaded } from './use-form-definition';

/** The body of `GET /options/treatments` as a page handed it over as a prop (`PartFormSeed.treatments`), or nothing: the fields provide it, and the control that needs it is deep in the form. */
export const TreatmentSeedContext = createContext<unknown>(undefined);

/**
 * The treatments a part may choose (STORY-05.06 AC-3): read when Treatment / Color is drawn, so a treatment the Admin added, renamed or deleted since is what the list shows, with "read again"
 * for a read that failed. IDs and names only, in the list's order ("Other" last). It lives with the control, in the part form's fields, which are fetched after the page is up (NFR-009).
 */
export function useTreatmentOptions() {
  const handedOver = useContext(TreatmentSeedContext);
  const [seeded] = useState(() => {
    const parsed = handedOver === undefined ? null : parseTreatmentOptions(handedOver);
    return parsed === null ? null : inListOrder(parsed);
  });
  const [options, setOptions] = useState<Loaded<ReadonlyArray<TreatmentOption>>>(seeded === null ? LOADING : { status: 'ready', value: seeded });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (seeded !== null && attempt === 0) return undefined;
    let cancelled = false;
    void loadTreatmentOptions().then((outcome) => {
      if (!cancelled) setOptions(outcome.status === 'ok' ? { status: 'ready', value: inListOrder(outcome.value) } : loadedFrom(outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, seeded]);

  return {
    options,
    readAgain: (): void => {
      setOptions(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}
