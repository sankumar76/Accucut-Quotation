import { isUserRole, type UserRoleValue } from './validation';

/**
 * The browser's side of the Users routes (SCR-14; `/api/v1/users`, architecture section 6): four small calls and the reading
 * of their answers. Nothing here decides anything: who may call, the one-Admin rule and the own-account rule are the server's,
 * and this file only turns its answer into something the screen can show. It takes `fetch` as an argument so a test can
 * answer for the server, and it has no zod, so the page does not carry it (NFR-009).
 *
 * The request carries the browser's own `Origin`, which the server's CSRF check needs (architecture section 8).
 */

export interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRoleValue;
  readonly isActive: boolean;
}

export interface NewUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRoleValue;
  readonly password: string;
}

export interface UserChanges {
  readonly name?: string;
  readonly role?: UserRoleValue;
  readonly isActive?: boolean;
}

/** Why the server said no, in the words it gave: a message for each field, and the Admin who holds the one place, if named. */
export interface Refusal {
  readonly status: 'refused';
  readonly httpStatus: number;
  readonly code: string;
  readonly title: string;
  /** Messages by field name (`email`, `password`, ...). */
  readonly fields: Readonly<Record<string, string>>;
  readonly currentAdminName: string | null;
}

/** The answer of a call: it worked, the server refused it with a reason, or no usable answer came (the network, a server fault). */
export type Outcome<T> = { readonly status: 'ok'; readonly value: T } | Refusal | { readonly status: 'failed' };

type Fetch = typeof fetch;

const USERS_PATH = '/api/v1/users';
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;
const SERVER_FAULT = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toUserRow(value: unknown): UserRow | null {
  if (!isRecord(value)) return null;
  const { id, name, email, role, isActive } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string' || typeof role !== 'string' || typeof isActive !== 'boolean') return null;
  return isUserRole(role) ? { id, name, email, role, isActive } : null;
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

/** A problem body (`application/problem+json`) read as a refusal. A 5xx, or a body that is not a problem, is `failed`. */
function refusalFrom(httpStatus: number, body: unknown): Refusal | { readonly status: 'failed' } {
  if (httpStatus >= SERVER_FAULT || !isRecord(body) || typeof body['code'] !== 'string' || typeof body['title'] !== 'string') return { status: 'failed' };
  const admin = body['currentAdmin'];
  return {
    status: 'refused',
    httpStatus,
    code: body['code'],
    title: body['title'],
    fields: fieldMessages(body['errors']),
    currentAdminName: isRecord(admin) && typeof admin['name'] === 'string' ? admin['name'] : null,
  };
}

async function send<T>(doFetch: Fetch, path: string, init: RequestInit, read: (body: unknown) => T | null): Promise<Outcome<T>> {
  try {
    const response = await doFetch(path, { credentials: 'same-origin', ...init });
    if (response.ok) {
      const value = read(response.status === 204 ? undefined : await readJson(response));
      return value === null ? { status: 'failed' } : { status: 'ok', value };
    }
    return refusalFrom(response.status, await readJson(response));
  } catch {
    return { status: 'failed' };
  }
}

function readUsers(body: unknown): ReadonlyArray<UserRow> | null {
  if (!isRecord(body) || !Array.isArray(body['users'])) return null;
  const rows = body['users'].map(toUserRow);
  return rows.every((row): row is UserRow => row !== null) ? rows : null;
}

const NOTHING = (): true => true;

/** `GET /api/v1/users`. */
export function listUsers(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<UserRow>>> {
  return send(doFetch, USERS_PATH, { method: 'GET', headers: { Accept: 'application/json' } }, readUsers);
}

/** `POST /api/v1/users`. */
export function createUser(input: NewUserInput, doFetch: Fetch = fetch): Promise<Outcome<UserRow>> {
  return send(doFetch, USERS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toUserRow);
}

/** `PATCH /api/v1/users/{id}`: a name, a role, or the active flag. */
export function updateUser(id: string, changes: UserChanges, doFetch: Fetch = fetch): Promise<Outcome<UserRow>> {
  return send(doFetch, `${USERS_PATH}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) }, toUserRow);
}

/** `POST /api/v1/users/{id}/password-reset`: a new, temporary password. The answer is 204. */
export function resetUserPassword(id: string, password: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return send(
    doFetch,
    `${USERS_PATH}/${encodeURIComponent(id)}/password-reset`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ password }) },
    NOTHING,
  );
}
