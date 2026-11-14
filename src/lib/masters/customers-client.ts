import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { CustomerDetails, CustomerRate } from './customers';

/**
 * The browser's side of the Customer routes (SCR-12; `/api/v1/customers`, architecture section 6): four small calls and the reading of their
 * answers. Nothing here decides anything: who may call, whether a name is free, which rates a customer has and what a reset replaces are the
 * server's, and this file only turns its answer into something the screen can show.
 */

/** A row of the list: the details and how many of the customer's rates differ from the defaults. */
export interface CustomerSummaryRow extends CustomerDetails {
  readonly id: string;
  readonly differ: number;
}

/** A customer with every rate, as the edit page holds it. */
export interface CustomerRow extends CustomerDetails {
  readonly id: string;
  readonly rates: ReadonlyArray<CustomerRate>;
}

/** What `POST /api/v1/customers/{id}/reset-rates` answers: the customer as it is now, and how many rates were replaced. */
export interface ResetResult {
  readonly customer: CustomerRow;
  readonly count: number;
}

/** A rate the PATCH sets: the rate's Process Master item and the typed value. */
export interface RateChange {
  readonly processItemId: string;
  readonly value: string;
}

/** The body of a POST: the details, with `null` for a contact field that is not given. */
export type NewCustomerBody = CustomerDetails;

/** The body of a PATCH: only what changed. A contact field given as `null` is cleared. */
export interface CustomerChangesBody {
  readonly name?: string | undefined;
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly address?: string | null | undefined;
  readonly rates?: ReadonlyArray<RateChange> | undefined;
}

const CUSTOMERS_PATH = '/api/v1/customers';

function textOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function toDetails(value: Record<string, unknown>): CustomerDetails | null {
  const { name } = value;
  const phone = textOrNull(value['phone']);
  const email = textOrNull(value['email']);
  const address = textOrNull(value['address']);
  if (typeof name !== 'string' || phone === undefined || email === undefined || address === undefined) return null;
  return { name, phone, email, address };
}

/** One row of `GET /api/v1/customers` as the list holds it, or `null` when the value is not that shape (the answer is never trusted blindly). */
export function toCustomerSummaryRow(value: unknown): CustomerSummaryRow | null {
  if (!isRecord(value)) return null;
  const details = toDetails(value);
  const { id, differ } = value;
  return details === null || typeof id !== 'string' || typeof differ !== 'number' ? null : { id, ...details, differ };
}

function toRate(value: unknown): CustomerRate | null {
  if (!isRecord(value)) return null;
  const { processItemId, name, unit, defaultValue, value: own } = value;
  if (typeof processItemId !== 'string' || typeof name !== 'string' || typeof unit !== 'string' || typeof defaultValue !== 'string' || typeof own !== 'string') return null;
  return { processItemId, name, unit, defaultValue, value: own };
}

/** A customer with every rate, from `GET`, `PATCH` and the reset answer, or `null` when the value is not that shape. */
export function toCustomerRow(value: unknown): CustomerRow | null {
  if (!isRecord(value) || !Array.isArray(value['rates'])) return null;
  const details = toDetails(value);
  const rates = value['rates'].map(toRate);
  const { id } = value;
  if (details === null || typeof id !== 'string' || !rates.every((rate): rate is CustomerRate => rate !== null)) return null;
  return { id, ...details, rates };
}

function toResetResult(value: unknown): ResetResult | null {
  if (!isRecord(value) || typeof value['count'] !== 'number') return null;
  const customer = toCustomerRow(value['customer']);
  return customer === null ? null : { customer, count: value['count'] };
}

function readCustomers(body: unknown): ReadonlyArray<CustomerSummaryRow> | null {
  if (!isRecord(body) || !Array.isArray(body['customers'])) return null;
  const rows = body['customers'].map(toCustomerSummaryRow);
  return rows.every((row): row is CustomerSummaryRow => row !== null) ? rows : null;
}

const pathOf = (id: string): string => `${CUSTOMERS_PATH}/${encodeURIComponent(id)}`;

/** `GET /api/v1/customers`. */
export function listCustomers(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<CustomerSummaryRow>>> {
  return sendJson(doFetch, CUSTOMERS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readCustomers);
}

/** `POST /api/v1/customers`: the answer is the new customer with every rate at its default. */
export function createCustomer(input: NewCustomerBody, doFetch: Fetch = fetch): Promise<Outcome<CustomerRow>> {
  return sendJson(doFetch, CUSTOMERS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toCustomerRow);
}

/** `PATCH /api/v1/customers/{id}`: the details and rates that changed. */
export function updateCustomer(id: string, changes: CustomerChangesBody, doFetch: Fetch = fetch): Promise<Outcome<CustomerRow>> {
  return sendJson(doFetch, pathOf(id), { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) }, toCustomerRow);
}

/** The reading of an answer that has no body (a 204): there is nothing to read, and it worked. */
const readNothing = (): true => true;

/** `DELETE /api/v1/customers/{id}`. The answer is 204; a 409 `CUSTOMER_IN_USE` carries the open estimates that have the customer (`estimateUsesOf`). */
export function deleteCustomer(id: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, pathOf(id), { method: 'DELETE', headers: ACCEPT_JSON }, readNothing);
}

/** `POST /api/v1/customers/{id}/reset-rates`: every rate back to the current default. */
export function resetCustomerRates(id: string, doFetch: Fetch = fetch): Promise<Outcome<ResetResult>> {
  return sendJson(doFetch, `${pathOf(id)}/reset-rates`, { method: 'POST', headers: ACCEPT_JSON }, toResetResult);
}
