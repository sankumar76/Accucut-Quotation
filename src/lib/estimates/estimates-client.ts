import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of the two routes behind changing the customer of an estimate (SCR-06; architecture sections 4.11 b and 6 "Assign context" and "Set customer"): read the customers to choose from, and
 * send the choice. Only a Lead or an Admin changes the customer (CR-01 item 6, AQP-390), so only the review's dialog calls these. Nothing here decides anything: whether the estimate is still open to a change and
 * whether the customer exists are the server's, and this file only reads its answer (an answer of the wrong shape is a failure, not a crash). A customer is an ID, a name and a short name.
 */

export interface CustomerView {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
}

const ASSIGN_CONTEXT_PATH = '/api/v1/options/assign-context';

function toCustomer(value: unknown): CustomerView | null {
  if (!isRecord(value)) return null;
  const { id, name, shortName } = value;
  return typeof id === 'string' && id !== '' && typeof name === 'string' && name !== '' && typeof shortName === 'string' && shortName !== '' ? { id, name, shortName } : null;
}

function toCustomerChoices(body: unknown): ReadonlyArray<CustomerView> | null {
  if (!isRecord(body) || !Array.isArray(body['customers'])) return null;
  const customers = body['customers'].map(toCustomer);
  return customers.every((customer) => customer !== null) ? customers : null;
}

/** `GET /api/v1/options/assign-context` (a Lead and an Admin only): the customers that are not deleted, by name, with their short names. */
export function loadCustomerChoices(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<CustomerView>>> {
  return sendJson(doFetch, ASSIGN_CONTEXT_PATH, { method: 'GET', headers: ACCEPT_JSON }, toCustomerChoices);
}

/** `PUT /api/v1/estimates/{id}/customer`: the answer is the customer the estimate is now for. */
export function chooseCustomer(estimateId: string, customerId: string, doFetch: Fetch = fetch): Promise<Outcome<CustomerView>> {
  const path = `/api/v1/estimates/${encodeURIComponent(estimateId)}/customer`;
  return sendJson(doFetch, path, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ customerId }) }, (body) => (isRecord(body) ? toCustomer(body['customer']) : null));
}
