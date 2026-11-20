import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';
import { NO_SENDER_CODE } from '../errors';
import type { SendFailureCode } from '../mail/codes';

import type { AlertSettingsInput, SenderProblems } from './validation';

/**
 * The browser's side of `PUT /api/v1/settings` and `POST /api/v1/settings/test-email` (SCR-15, STORY-09.02): two small calls and the reading of their answers through the shared
 * `sendJson`. Nothing here decides anything; the rules of a name and an address and the choice of recipient are the server's. It takes `fetch` as an argument so a test can answer for the
 * server. The classes of a failure are the codes of `src/lib/mail/codes.ts`; the page chooses its words from them.
 */

const SETTINGS_PATH = '/api/v1/settings';
const TEST_EMAIL_PATH = '/api/v1/settings/test-email';

/** The class of the 502 that the page words in its own way (the 422 `NO_SENDER` is the other). Typed, so a rename in `codes.ts` stops the build here. */
const SENDER_NOT_ALLOWED_CODE: SendFailureCode = 'SENDER_NOT_ALLOWED';

export interface SavedAlerts {
  readonly alertsEnabled: boolean;
  readonly senderName: string;
  readonly senderAddress: string;
}

function readSaved(body: unknown): SavedAlerts | null {
  if (!isRecord(body)) return null;
  const { alertsEnabled, senderName, senderAddress } = body;
  if (typeof alertsEnabled !== 'boolean' || typeof senderName !== 'string' || typeof senderAddress !== 'string') return null;
  return { alertsEnabled, senderName, senderAddress };
}

function readSentTo(body: unknown): string | null {
  return isRecord(body) && typeof body['sentTo'] === 'string' ? body['sentTo'] : null;
}

export function saveAlertSettings(input: AlertSettingsInput, doFetch: Fetch = fetch): Promise<Outcome<SavedAlerts>> {
  return sendJson(doFetch, SETTINGS_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(input) }, readSaved);
}

/** The route takes no body: who the e-mail goes to is the signed-in person, as the server knows them. */
export function sendTestEmail(doFetch: Fetch = fetch): Promise<Outcome<string>> {
  return sendJson(doFetch, TEST_EMAIL_PATH, { method: 'POST', headers: ACCEPT_JSON }, readSentTo);
}

/** What the card shows for the answer to Save. `fields` are the server's messages under the fields they name; `failed` is anything else (SCR-15 "Save failed"). */
export type SaveResult =
  | { readonly kind: 'saved'; readonly saved: SavedAlerts }
  | { readonly kind: 'fields'; readonly problems: SenderProblems }
  | { readonly kind: 'failed' };

export function saveResultOf(outcome: Outcome<SavedAlerts>): SaveResult {
  if (outcome.status === 'ok') return { kind: 'saved', saved: outcome.value };
  if (outcome.status === 'failed') return { kind: 'failed' };
  const problems: { senderName?: string; senderAddress?: string } = {};
  const name = outcome.fields['senderName'];
  const address = outcome.fields['senderAddress'];
  if (name !== undefined) problems.senderName = name;
  if (address !== undefined) problems.senderAddress = address;
  return Object.keys(problems).length > 0 ? { kind: 'fields', problems } : { kind: 'failed' };
}

/**
 * What the card shows for the answer to Send test e-mail (SCR-15 states): `sent` with the address it went to; `sender-not-allowed` (502 `SENDER_NOT_ALLOWED`: the sender stays editable); `no-sender`
 * (422: nothing saved to send from); `failed` for every other class and for no usable answer ("Test failed").
 */
export type TestResult =
  | { readonly kind: 'sent'; readonly sentTo: string }
  | { readonly kind: 'sender-not-allowed' }
  | { readonly kind: 'no-sender' }
  | { readonly kind: 'failed' };

export function testResultOf(outcome: Outcome<string>): TestResult {
  if (outcome.status === 'ok') return { kind: 'sent', sentTo: outcome.value };
  if (outcome.status === 'refused' && outcome.code === SENDER_NOT_ALLOWED_CODE) return { kind: 'sender-not-allowed' };
  if (outcome.status === 'refused' && outcome.code === NO_SENDER_CODE) return { kind: 'no-sender' };
  return { kind: 'failed' };
}
