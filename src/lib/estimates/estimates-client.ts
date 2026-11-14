import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of the two routes behind choosing the customer (SCR-05; architecture section 6 "Safe options" and "Set customer"): read the list of
 * customers, and send the choice. Nothing here decides anything: whether the estimate is the person's, whether it is still a draft and whether the customer
 * exists are the server's, and this file only reads its answer (an answer of the wrong shape is a failure, not a crash). A customer is an ID and a name.
 */

export interface CustomerView {
  readonly id: string;
  readonly name: string;
}

const CUSTOMER_OPTIONS_PATH = '/api/v1/options/customers';

function toCustomer(value: unknown): CustomerView | null {
  if (!isRecord(value)) return null;
  const { id, name } = value;
  return typeof id === 'string' && id !== '' && typeof name === 'string' && name !== '' ? { id, name } : null;
}

function toCustomerOptions(body: unknown): ReadonlyArray<CustomerView> | null {
  if (!isRecord(body) || !Array.isArray(body['options'])) return null;
  const customers = body['options'].map(toCustomer);
  return customers.every((customer) => customer !== null) ? customers : null;
}

/** `GET /api/v1/options/customers`: the customers to choose from, by name. */
export function loadCustomerOptions(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<CustomerView>>> {
  return sendJson(doFetch, CUSTOMER_OPTIONS_PATH, { method: 'GET', headers: ACCEPT_JSON }, toCustomerOptions);
}

/** `PUT /api/v1/estimates/{id}/customer`: the answer is the customer the estimate is now for. */
export function chooseCustomer(estimateId: string, customerId: string, doFetch: Fetch = fetch): Promise<Outcome<CustomerView>> {
  const path = `/api/v1/estimates/${encodeURIComponent(estimateId)}/customer`;
  return sendJson(doFetch, path, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ customerId }) }, (body) => (isRecord(body) ? toCustomer(body['customer']) : null));
}
