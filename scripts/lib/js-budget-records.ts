/**
 * The records the JS budget check opens a dynamic route at (STORY-10.10 AC-2; first used by STORY-02.02's `/masters/customers/[id]`).
 *
 * A page with a dynamic segment can only be requested at a record that exists. The check makes one from invented data through the portal's own API,
 * signed in as the invented Admin, and hands the path to `buildTargets` (`recordPaths`). The throwaway database it runs against is the one the Admin was
 * made in (`scripts/ensure-measurement-user.ts`), so the record is never cleaned up. When the record cannot be made (no Admin sign-in, the portal refused,
 * an answer without an ID), no path is returned: the route then fails with "a dynamic segment needs a record made from invented data, and none could be
 * made", and one line on stderr says which step failed. Nothing is skipped silently, and no credential or cookie is ever printed.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { signIn, type CredentialsProvider } from './js-budget-http';

/** The route pattern of the customer's page, as the route manifest spells it. */
export const CUSTOMER_PAGE_ROUTE = '/masters/customers/[id]';
const CUSTOMERS_API_PATH = '/api/v1/customers';
const REQUEST_TIMEOUT_MS = 30_000;

const createdSchema = z.object({ id: z.string().min(1) });

export interface RecordOptions {
  readonly baseUrl: string;
  readonly credentialsFor: CredentialsProvider;
  readonly fetchImpl?: typeof fetch;
  /** Where the one line about a record that could not be made goes. */
  readonly warn?: (line: string) => void;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unexpected error';
}

/** Adds one customer named from a random UUID (invented, and unique so a second run does not collide) and returns the path of its page. */
async function makeCustomerPath(options: RecordOptions): Promise<string | undefined> {
  const credentials = options.credentialsFor('ADMIN');
  if (credentials === undefined) return undefined;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cookie = await signIn(options.baseUrl, credentials, fetchImpl);
  const response = await fetchImpl(`${options.baseUrl}${CUSTOMERS_API_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie, origin: new URL(options.baseUrl).origin },
    body: JSON.stringify({ name: `Budget check customer ${randomUUID()}` }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status !== 201) throw new Error(`POST ${CUSTOMERS_API_PATH} answered HTTP ${response.status}, not 201`);
  const created = createdSchema.safeParse(await response.json());
  if (!created.success) throw new Error(`POST ${CUSTOMERS_API_PATH} did not answer with the customer's ID`);
  return `/masters/customers/${encodeURIComponent(created.data.id)}`;
}

/** The paths of the records made for the dynamic routes, keyed by route pattern. Empty when none could be made. */
export async function makeRecordPaths(options: RecordOptions): Promise<Readonly<Record<string, string>>> {
  try {
    const path = await makeCustomerPath(options);
    return path === undefined ? {} : { [CUSTOMER_PAGE_ROUTE]: path };
  } catch (error: unknown) {
    (options.warn ?? ((line: string) => void process.stderr.write(`${line}\n`)))(`JS budget: no record was made for ${CUSTOMER_PAGE_ROUTE}: ${describe(error)}`);
    return {};
  }
}
