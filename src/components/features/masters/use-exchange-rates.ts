'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import {
  changedExchangeRates,
  EXCHANGE_RATE_FIELDS,
  exchangeRateProblems,
  normaliseExchangeRate,
  type ExchangeRateField,
  type ExchangeRateValues,
} from '@/lib/masters/exchange-rates';
import { getExchangeRates, putExchangeRates, type ExchangeRatesRow } from '@/lib/masters/exchange-rates-client';

import { RATES_SAVED_NOTICE, RATES_UNCHANGED_NOTICE } from './exchange-rate-texts';
import { focusOpener, type Opener } from './process-opener';
import type { PageNotice } from './process-texts';

/**
 * What the Exchange rates tab of SCR-13 holds and does, apart from how it looks (STORY-02.04 AC-1 to AC-3): the pair as the server last
 * said it, what is typed, the notice under the tab bar, and where focus goes. `ExchangeRatesPanel` only draws it. It is the shape of
 * `useMaterialMaster` for a form with no dialog: the tab reads its own data from `GET /api/v1/exchange-rates` when it first opens (it is not
 * in the first load of the page, NFR-009), a save reads the pair again so what is on screen is the server's, and the skeleton waits 300 ms.
 *
 * **Focus after a save (DEF-020, ux-spec SCR-13 "focus goes to the title").** When the save succeeded and the read that follows fails, the
 * load error shows and takes focus on its title ("We could not load the exchange rates"). The step that would otherwise put focus back on the
 * Save button must then do nothing (`focusOpener` with `listFailed`), or focus is taken from the error and ends up on the page heading.
 */

export type ExchangeRatesStatus = 'loading' | 'ready' | 'error';

export type RateErrors = Readonly<Partial<Record<ExchangeRateField, string>>>;

/** The element id of each field: unique on the page, so a label, a hint and a message are tied to their own control. */
export const RATE_FIELD_IDS: Readonly<Record<ExchangeRateField, string>> = { usd: 'exchange-rate-usd', eur: 'exchange-rate-eur' };

/** The Save button, as `focusOpener` finds it (`data-action="save"`). */
const SAVE_BUTTON: Opener = { itemId: null, action: 'save' };

const NOTHING_TYPED: ExchangeRateValues = { usd: '', eur: '' };

/** What the fields hold for a pair the server sent: the stored text, or empty for a rate that was never set. */
function valuesOf(row: ExchangeRatesRow): ExchangeRateValues {
  return { usd: row.usd ?? '', eur: row.eur ?? '' };
}

/** What a save sends: both rates as the stored text. */
function bodyOf(values: ExchangeRateValues): ExchangeRateValues {
  return { usd: normaliseExchangeRate(values.usd), eur: normaliseExchangeRate(values.eur) };
}

/** The messages the server gave for the two fields, and nothing for any other field. */
function serverErrors(fields: Readonly<Record<string, string>>): RateErrors {
  return Object.fromEntries(EXCHANGE_RATE_FIELDS.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])));
}

/** After a refusal, focus goes to the first field with a message (UX spec section 6.0 "Forms"). */
function useFocusFirstError(errors: RateErrors) {
  useEffect(() => {
    const first = EXCHANGE_RATE_FIELDS.find((field) => errors[field] !== undefined);
    if (first !== undefined) document.getElementById(RATE_FIELD_IDS[first])?.focus();
  }, [errors]);
}

/**
 * Reading the pair from the server, and where focus goes when a read that a person asked for has finished: back to the Save button, unless the
 * read failed, in which case the load error owns focus (DEF-020).
 */
function useRatesRead() {
  const [row, setRow] = useState<ExchangeRatesRow | null>(null);
  const [status, setStatus] = useState<ExchangeRatesStatus>('loading');
  const wantsFocus = useRef(false);
  const showSkeleton = useAfterDelay(status === 'loading' && row !== null, SKELETON_DELAY_MS);

  /** Marks a read as under way. Called from an event handler; the first read of the tab starts as `loading` and needs no call. */
  const beginRead = useCallback((): void => setStatus('loading'), []);

  /** Reads the pair and settles the status. The answer is returned too, so a caller can start the form from it. Sets nothing before the answer. */
  const read = useCallback(async (returnFocus: boolean): Promise<ExchangeRatesRow | null> => {
    wantsFocus.current = returnFocus;
    const outcome = await getExchangeRates();
    if (outcome.status === 'ok') setRow(outcome.value);
    setStatus(outcome.status === 'ok' ? 'ready' : 'error');
    return outcome.status === 'ok' ? outcome.value : null;
  }, []);

  useEffect(() => {
    if (status === 'loading' || !wantsFocus.current) return;
    wantsFocus.current = false;
    focusOpener(SAVE_BUTTON, status === 'error');
  }, [status]);

  return { row, status, showSkeleton, read, beginRead };
}

/** The whole of the Exchange rates tab's behaviour. The notice is replaced by the next one and cleared by the next press of Save. */
export function useExchangeRates() {
  const { row, status, showSkeleton, read, beginRead } = useRatesRead();
  // What the person has typed, or null while nothing has been: the fields then show the pair the server last sent. A read that arrives late
  // therefore never writes over typed text, and a form that is shown always starts from the pair that was read with it.
  const [typed, setTyped] = useState<ExchangeRateValues | null>(null);
  const [errors, setErrors] = useState<RateErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  useFocusFirstError(errors);
  const values = typed ?? (row === null ? NOTHING_TYPED : valuesOf(row));

  // The first activation of the tab: the pair is read. The status starts as `loading`, so nothing is set before the answer.
  useEffect(() => {
    void read(false);
  }, [read]);

  /** Reads the pair again because a person asked (after a save, or Try again): the status goes to `loading` at once. */
  function readAgain(): Promise<unknown> {
    beginRead();
    return read(true);
  }

  const setField = (field: ExchangeRateField, value: string): void => {
    setTyped((current) => ({ ...(current ?? values), [field]: value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== field)));
  };

  /** Shows the server's answer to a save: the notice, and a read of the pair again, so the screen shows what the server holds. */
  async function finish(outcome: Awaited<ReturnType<typeof putExchangeRates>>): Promise<void> {
    setSaving(false);
    if (outcome.status === 'ok') {
      // What was typed is saved: the fields show the pair the read below brings, which is the server's.
      setTyped(null);
      setNotice(RATES_SAVED_NOTICE);
      await readAgain();
      return;
    }
    const fromServer = outcome.status === 'refused' ? serverErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) setSaveFailed(true);
    else setErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || status !== 'ready') return;
    const found = exchangeRateProblems(values);
    setErrors(found);
    setSaveFailed(false);
    setNotice(null);
    if (Object.keys(found).length > 0) return;
    const body = bodyOf(values);
    // The values already stored: nothing is sent, so nothing is stamped or written.
    if (row !== null && changedExchangeRates(row, body).length === 0) {
      setNotice(RATES_UNCHANGED_NOTICE);
      return;
    }
    setSaving(true);
    await finish(await putExchangeRates(body));
  }

  return { row, status, showSkeleton, values, errors, saving, saveFailed, notice, setField, submit, retry: () => void readAgain() };
}

export type ExchangeRatesState = ReturnType<typeof useExchangeRates>;
