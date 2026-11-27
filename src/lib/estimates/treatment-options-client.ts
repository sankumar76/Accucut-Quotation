import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';
import { NOT_APPLICABLE_TREATMENT_ID, OTHER_TREATMENT_ID } from '../masters/system-entries';

/**
 * The browser's read of the treatments an estimate may choose (STORY-05.06 AC-3; architecture section 6 "Safe options"): `GET /api/v1/options/treatments`, an ID and a name for each, and nothing else
 * (the table has no rate of any kind, and an answer of another shape is a failure, not a crash). Apart from `form-client.ts` on purpose: only the part form's fields use it, and they are fetched after
 * the page is up, so none of this is in the first load of `/estimates/[code]` (NFR-009, ADR-016).
 */

/** A treatment to choose from. No number of any kind. */
export interface TreatmentOption {
  readonly id: string;
  readonly name: string;
}

function toOption(value: unknown): TreatmentOption | null {
  if (!isRecord(value)) return null;
  const { id, name } = value;
  return typeof id === 'string' && id !== '' && typeof name === 'string' && name !== '' ? { id: id.toLowerCase(), name } : null;
}

function toOptions(body: unknown): ReadonlyArray<TreatmentOption> | null {
  if (!isRecord(body) || !Array.isArray(body['options'])) return null;
  const options = body['options'].map(toOption);
  return options.every((option) => option !== null) ? options : null;
}

export { toOptions as parseTreatmentOptions };

/**
 * The options in the order the list shows them: the Admin's treatments as the server sends them, then "Not applicable", then "Other" last (AC-3), whatever order the server sends. The two entries the
 * system keeps are found by their fixed IDs (`system-entries.ts`), never by their names.
 */
export function inListOrder(options: ReadonlyArray<TreatmentOption>): ReadonlyArray<TreatmentOption> {
  const rank = (option: TreatmentOption): number => (option.id === OTHER_TREATMENT_ID ? 2 : option.id === NOT_APPLICABLE_TREATMENT_ID ? 1 : 0);
  return options.map((option, index) => ({ option, index })).sort((a, b) => rank(a.option) - rank(b.option) || a.index - b.index).map(({ option }) => option);
}

/** `GET /api/v1/options/treatments`. */
export function loadTreatmentOptions(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<TreatmentOption>>> {
  return sendJson(doFetch, '/api/v1/options/treatments', { method: 'GET', headers: ACCEPT_JSON }, toOptions);
}
