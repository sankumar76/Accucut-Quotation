'use client';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { SkeletonBlock } from '@/components/shared/states';
import { UnitInput } from '@/components/shared/unit-input';
import { Button } from '@/components/ui/button';
import { EXCHANGE_RATE_FIELDS, EXCHANGE_RATE_LABELS, exchangeRateHint, type ExchangeRateField } from '@/lib/masters/exchange-rates';
import type { ExchangeRatesRow } from '@/lib/masters/exchange-rates-client';
import { RUPEE } from '@/lib/masters/process-items';
import { formatIst } from '@/lib/time';

import {
  EXCHANGE_ERROR_TITLE,
  EXCHANGE_LOADING_LABEL,
  FAILED_SAVE_RATES_MESSAGE,
  FAILED_SAVE_RATES_BODY,
  lastUpdatedLine,
  NOT_SET_YET,
  RATES_SAVED_NOT_SHOWN_BODY,
  RATES_SAVED_NOTICE,
  SAVE_EXCHANGE_RATES,
  SAVING_EXCHANGE_RATES,
} from './exchange-rate-texts';
import { MasterLoadError } from './master-load-error';
import { RATE_FIELD_IDS, useExchangeRates, type ExchangeRatesState } from './use-exchange-rates';

/**
 * The Exchange rates tab of SCR-13 (STORY-02.04 AC-1, AC-2, AC-5, AC-7): two fields, "1 USD in ₹" and "1 EUR in ₹", the hints that name their
 * columns by the letters the registry has now, the line "Last updated by <name>, <date and time> IST.", and one Save button. It is a form and
 * no table (ux-spec section 6.0 "Masters tables": no row actions here). It lays the form out and hands everything else to `useExchangeRates`; it
 * decides nothing: every rule about a rate is the server's, and this screen puts the server's reason where the person can read it.
 *
 * It is not in the first load of the page (NFR-009, PRF-01): the tab fetches this file the first time it is opened (`MastersScreen`), and the
 * panel then reads its data from `GET /api/v1/exchange-rates`. There is deliberately no `loading.tsx` beside the page (TD-06).
 */

/** The panel takes no props: it reads its own data when the tab first opens. */
export type ExchangeRatesPanelProps = Record<string, never>;

function RateField({ field, state }: { readonly field: ExchangeRateField; readonly state: ExchangeRatesState }) {
  const { row, values, errors, setField } = state;
  const error = errors[field];
  const hint = row === null ? undefined : exchangeRateHint(field, row.columns[field]);
  return (
    <FormField id={RATE_FIELD_IDS[field]} label={EXCHANGE_RATE_LABELS[field]} {...(hint === undefined ? {} : { hint })} {...(error === undefined ? {} : { error })}>
      {(control) => (
        <UnitInput
          {...control}
          name={field}
          unit={RUPEE}
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder={NOT_SET_YET}
          value={values[field]}
          onChange={(event) => setField(field, event.target.value)}
        />
      )}
    </FormField>
  );
}

/** The stamp of the pair, read as text (AC-1): who saved it and when, in IST. Nothing while no rate was ever saved. */
function LastUpdated({ row }: { readonly row: ExchangeRatesRow }) {
  if (row.updatedBy === null || row.updatedAt === null) return null;
  return <p className="text-label text-ink-2">{lastUpdatedLine(row.updatedBy, formatIst(new Date(row.updatedAt)))}</p>;
}

function RatesForm({ state, row }: { readonly state: ExchangeRatesState; readonly row: ExchangeRatesRow }) {
  return (
    <form noValidate onSubmit={(event) => void state.submit(event)} className="flex max-w-prose flex-col gap-s-4 p-s-4 md:p-s-5">
      {EXCHANGE_RATE_FIELDS.map((field) => (
        <RateField key={field} field={field} state={state} />
      ))}
      <LastUpdated row={row} />
      <div>
        <Button type="submit" data-action="save" loading={state.saving}>
          {state.saving ? SAVING_EXCHANGE_RATES : SAVE_EXCHANGE_RATES}
        </Button>
      </div>
    </form>
  );
}

/** What is said above the form: the page notice after a save (a status, because nothing failed), and the failure of a save. */
function Notices({ state }: { readonly state: ExchangeRatesState }) {
  const { notice, saveFailed } = state;
  if (notice === null && !saveFailed) return null;
  return (
    <div className="flex flex-col gap-s-3 p-s-4 pb-0 md:px-s-5">
      {notice === null ? null : (
        <Notice tone={notice.tone} role="status" {...(notice.title === undefined ? {} : { title: notice.title })}>
          {notice.text}
        </Notice>
      )}
      {saveFailed ? (
        <Notice tone="danger" title={FAILED_SAVE_RATES_MESSAGE}>
          {FAILED_SAVE_RATES_BODY}
        </Notice>
      ) : null}
    </div>
  );
}

/** What the tab shows below the notices: the error with "Try again", the skeleton, or the form. */
function Body({ state }: { readonly state: ExchangeRatesState }) {
  const { row, status, showSkeleton } = state;
  if (status === 'error') {
    // While the Saved notice is on the page, its sentence says the save happened, so the error never reads "Nothing was changed" under "Exchange rates saved.".
    const saved = state.notice === RATES_SAVED_NOTICE;
    return <MasterLoadError title={EXCHANGE_ERROR_TITLE} onRetry={state.retry} description={saved ? RATES_SAVED_NOT_SHOWN_BODY : undefined} />;
  }
  // The first read has no form to keep on screen: the skeleton appears after 300 ms. A later read keeps the form until 300 ms have passed.
  if (row === null) return <SkeletonBlock rows={2} label={EXCHANGE_LOADING_LABEL} />;
  if (showSkeleton) return <SkeletonBlock rows={2} delayMs={0} label={EXCHANGE_LOADING_LABEL} />;
  return <RatesForm state={state} row={row} />;
}

export function ExchangeRatesPanel() {
  const state = useExchangeRates();
  return (
    <div aria-busy={state.status === 'loading' || undefined} className="flex flex-col">
      <Notices state={state} />
      <Body state={state} />
    </div>
  );
}
