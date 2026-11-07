/**
 * The browser's side of a JSON route of the portal (architecture section 6): send a request, and turn the answer into something a
 * screen can show. Nothing here decides anything; who may call and every rule are the server's. It takes `fetch` as an argument so
 * a test can answer for the server, and it has no zod, so the page does not carry it (NFR-009).
 *
 * The request carries the browser's own `Origin`, which the server's CSRF check needs (architecture section 8). An answer is
 * one of three things: it worked, the server refused it with a reason (`application/problem+json`, RFC 9457), or no usable
 * answer came (the network, a server fault, an answer of the wrong shape).
 */

/** Why the server said no, in the words it gave: a message for each field, and the whole problem body for an extension member. */
export interface Refusal {
  readonly status: 'refused';
  readonly httpStatus: number;
  readonly code: string;
  readonly title: string;
  /** Messages by field name (`name`, `defaultValue`, ...). */
  readonly fields: Readonly<Record<string, string>>;
  /** The problem body as sent, for a member only one route has (`usedBy`). Read it with `isRecord`. */
  readonly body: Readonly<Record<string, unknown>>;
}

/** The answer of a call: it worked, the server refused it with a reason, or no usable answer came. */
export type Outcome<T> = { readonly status: 'ok'; readonly value: T } | Refusal | { readonly status: 'failed' };

export type Fetch = typeof fetch;

export const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;
export const ACCEPT_JSON = { Accept: 'application/json' } as const;

const SERVER_FAULT = 500;
const NO_CONTENT = 204;

/** Is this value an object whose keys can be read? (JSON from the server is checked with it, field by field.) */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function fieldMessages(errors: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!Array.isArray(errors)) return fields;
  for (const entry of errors) {
    if (isRecord(entry) && typeof entry['field'] === 'string' && typeof entry['message'] === 'string' && !(entry['field'] in fields)) {
      fields[entry['field']] = entry['message'];
    }
  }
  return fields;
}

/** A problem body read as a refusal. A 5xx, or a body that is not a problem, is `failed`. */
function refusalFrom(httpStatus: number, body: unknown): Refusal | { readonly status: 'failed' } {
  if (httpStatus >= SERVER_FAULT || !isRecord(body) || typeof body['code'] !== 'string' || typeof body['title'] !== 'string') return { status: 'failed' };
  return { status: 'refused', httpStatus, code: body['code'], title: body['title'], fields: fieldMessages(body['errors']), body };
}

/**
 * Sends one request. `read` turns the JSON of a success (undefined for a 204) into the value, or null if its shape is wrong,
 * which is a failure and not a crash.
 */
export async function sendJson<T>(doFetch: Fetch, path: string, init: RequestInit, read: (body: unknown) => T | null): Promise<Outcome<T>> {
  try {
    const response = await doFetch(path, { credentials: 'same-origin', ...init });
    if (response.ok) {
      const value = read(response.status === NO_CONTENT ? undefined : await readJson(response));
      return value === null ? { status: 'failed' } : { status: 'ok', value };
    }
    return refusalFrom(response.status, await readJson(response));
  } catch {
    return { status: 'failed' };
  }
}
