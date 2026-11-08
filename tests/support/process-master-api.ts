import { readFileSync } from 'node:fs';

import { createConfigRepository } from '@/server/repositories/config-repository';
import { type TransactionRunner } from '@/server/repositories/transaction';
import { getCurrentVersion } from '@/server/services/config-service';
import { type MastersService } from '@/server/services/masters-service';

import type { ConfigDocument } from '../../src/lib/fields/schema';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from './audit-database';
import { rateRef } from './formula-config';
import { cloneSeedConfig, seedConfig } from './seed-config';

/**
 * The shared world of the Process master acceptance tests (QA, AQP-113; STORY-02.01 and DEF-006). Every call goes through the real route
 * handlers (`POST/GET /api/v1/process-items`, `PATCH/DELETE /api/v1/process-items/{id}`) with the real `withRoute`, the real session code
 * over the real user repository, the real Process Master service, the real audit service and real PostgreSQL in a throwaway database per
 * describe. Only next-auth's cookie reading and the Next.js edges are replaced (the mock factories below, as in
 * `tests/security/role-matrix.test.ts`). The configuration the formulas are read from is stored as rows of `config_versions` and read by
 * `getCurrentVersion`, exactly as `composition.ts` does, so a "stored formula" is a stored formula and not an injected object.
 *
 * Oracles are written in the tests from the acceptance criteria, SPEC section 4.1 and the DEF-006 record, not copied from the code: the
 * used-by list is recomputed from the seed formulas with a regular expression of this module's own, and the audit rows are read with plain
 * SQL. All names and numbers are invented.
 */

export const ORIGIN = 'https://portal.example.test';
export const FOREIGN_ORIGIN = 'https://evil.example.test';
const REQUEST_ID_HEADER = 'x-request-id';
const SESSION_MS_PER_S = 1_000;

/** What the mocked edges read: the database, the Process Master service and the person making the next request. */
export const world: { db: AuditDatabase | null; service: MastersService | null; userId: string | null } = { db: null, service: null, userId: null };

/** Factory bodies for `vi.mock`: a test file registers them in one line each. */
export function nextAuthMock() {
  return {
    getServerSession: () =>
      Promise.resolve(
        world.userId === null ? null : { expires: 'x', userId: world.userId, sessionVersion: 0, signedAt: Math.floor(Date.now() / SESSION_MS_PER_S) },
      ),
  };
}

export function navigationMock() {
  return {
    redirect: (path: string): never => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    },
    forbidden: (): never => {
      throw new Error('NEXT_FORBIDDEN');
    },
    notFound: (): never => {
      throw new Error('NEXT_NOT_FOUND');
    },
  };
}

export function compositionMock() {
  const database = (): AuditDatabase => {
    if (world.db === null) throw new Error('no database');
    return world.db;
  };
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => database().users,
    getUserService: () => database().userService,
    getAuditService: () => database().audit,
    getMastersService: () => {
      if (world.service === null) throw new Error('no service');
      return world.service;
    },
  };
}

type RouteModule = Record<string, (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>>;
let collection!: RouteModule;
let item!: RouteModule;
let processPage!: { default: () => Promise<unknown> };

export interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown> | null;
  readonly text: string;
  readonly requestId: string | null;
  readonly headers: Headers;
}

/** Every 422 and 409 body the tests saw, so the "no refusal names a rate or a formula" check can read all of them. */
export const seenRefusals: Array<{ readonly status: number; readonly text: string; readonly body: Record<string, unknown> | null }> = [];
/** Every rate name this file invented or used, in any test, to look for in the refusals. */
export const namesUsed = new Set<string>();

export async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  id: string | null,
  body?: unknown,
  options: { readonly origin?: string | null; readonly extraHeaders?: Record<string, string>; readonly rawBody?: string } = {},
): Promise<Answer> {
  const routes = id === null ? collection : item;
  const handler = routes[method];
  if (handler === undefined) throw new Error(`no ${method}`);
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const hasBody = method === 'POST' || method === 'PATCH';
  const headers: Record<string, string> = { ...(origin === null ? {} : { origin }), ...(hasBody ? { 'content-type': 'application/json' } : {}), ...options.extraHeaders };
  const request = new Request(`${ORIGIN}/api/v1/process-items${id === null ? '' : `/${id}`}`, {
    method,
    headers,
    ...(hasBody ? { body: options.rawBody ?? JSON.stringify(body) } : {}),
  });
  const response = await handler(request, { params: Promise.resolve(id === null ? {} : { id }) });
  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    const value: unknown = text === '' ? null : JSON.parse(text);
    parsed = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }
  if (response.status === 422 || response.status === 409) seenRefusals.push({ status: response.status, text, body: parsed });
  return { status: response.status, body: parsed, text, requestId: response.headers.get(REQUEST_ID_HEADER), headers: response.headers };
}

export const NEW = { unit: 'per kg', defaultValue: '1.37' } as const;

export async function create(name: string, extra: Record<string, unknown> = {}): Promise<Answer> {
  namesUsed.add(name);
  return call('POST', null, { name, ...NEW, ...extra });
}

export async function rename(id: string, name: string): Promise<Answer> {
  namesUsed.add(name);
  return call('PATCH', id, { name });
}

export function idOf(answer: Answer): string {
  const id = answer.body?.['id'];
  if (typeof id !== 'string') throw new Error(`no id in the answer (status ${answer.status})`);
  return id;
}

export function firstError(answer: Answer): { readonly field: string; readonly message: string } {
  const errors = answer.body?.['errors'];
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  if (typeof first !== 'object' || first === null) throw new Error(`no errors in the answer (status ${answer.status}): ${answer.text}`);
  const { field, message } = first as { field?: unknown; message?: unknown };
  return { field: String(field), message: String(message) };
}

export let db: AuditDatabase;
export let adminId: string;
export let leadId: string;
export let engineerId: string;

export async function names(): Promise<string[]> {
  const { rows } = await db.owner.query<{ name: string }>('SELECT name FROM process_items ORDER BY name');
  return rows.map((row) => row.name);
}

export async function rowOf(id: string): Promise<{ name: string; unit: string; default_value: string } | undefined> {
  const { rows } = await db.owner.query<{ name: string; unit: string; default_value: string }>(
    'SELECT name, unit, default_value::text FROM process_items WHERE id = $1',
    [id],
  );
  return rows[0];
}

export async function idByName(name: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>('SELECT id::text FROM process_items WHERE name = $1', [name]);
  const found = rows[0];
  if (found === undefined) throw new Error(`No rate named ${name}.`);
  return found.id;
}

export async function installVersion(document: ConfigDocument, number: number): Promise<void> {
  await db.owner.query('INSERT INTO config_versions (number, snapshot, created_by, reason) VALUES ($1, $2::jsonb, NULL, $3)', [
    number,
    JSON.stringify(document),
    'QA test version',
  ]);
}

/** The service as `composition.ts` wires it: the configuration is the latest stored version, read through `getCurrentVersion`. */
export function serviceOverStoredVersions(options: { readonly transactions?: TransactionRunner } = {}): MastersService {
  const configurations = createConfigRepository(db.prisma);
  return db.buildMastersService({
    ...(options.transactions === undefined ? {} : { transactions: options.transactions }),
    readConfiguration: async () => (await getCurrentVersion(configurations)).document,
  });
}

export async function openWorld(): Promise<void> {
  db = await openAuditDatabase();
  world.db = db;
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  leadId = await insertPersonAsOwner(db, 'Lead', 'LEAD');
  engineerId = await insertPersonAsOwner(db, 'Engineer', 'ENGINEER');
  await installVersion(seedConfig, 1);
  world.service = serviceOverStoredVersions();
  world.userId = adminId;
}

export async function closeWorld(): Promise<void> {
  world.userId = null;
  world.service = null;
  world.db = null;
  await db.close();
}

/** A, B, ..., Z, AA, AB, ... from a 1-based position (this file's own, so it does not rely on `columns.ts`). */
function letterAt(position: number): string {
  let rest = position;
  let letters = '';
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

/** The formulas of the seed that hold `{{rate:<id>}}`, in column order, as the AC-1 "Used in" column should list them. */
export function usesFromSeed(rateId: string): Array<{ letter: string; label: string }> {
  const pattern = new RegExp(`\\{\\{rate:${rateId}\\}\\}`, 'i');
  return [...seedConfig.fields]
    .sort((a, b) => a.position - b.position)
    .filter((field) => field.kind === 'output' && field.formula !== null && pattern.test(field.formula))
    .map((field) => ({ letter: letterAt(field.position), label: field.label }));
}

/**
 * The seed configuration with `formula` stored on one more output field: "Unit Production Price (USD)" (position 62), a row-level leaf that no
 * other formula reads, so the document stays valid (`parseConfigDocument` runs when the version is read) and no seed use of a rate changes.
 */
const PROBE_FIELD_POSITION = 62;
export function configurationWithFormula(formula: string): ConfigDocument {
  const document = cloneSeedConfig();
  return { ...document, fields: document.fields.map((field) => (field.position === PROBE_FIELD_POSITION && field.kind === 'output' ? { ...field, formula } : field)) };
}

export function entryEvents(entries: ReadonlyArray<{ event: string }>): string[] {
  return entries.map((entry) => entry.event);
}

export const setUserId = (id: string | null) => {
  world.userId = id;
};

/** Loads the two route modules and the page, in a hook (importing them can take longer than a test's limit on a busy machine). */
export async function loadProcessMasterRoutes(): Promise<void> {
  collection = (await import('@/app/api/v1/process-items/route')) as unknown as RouteModule;
  item = (await import('@/app/api/v1/process-items/[id]/route')) as unknown as RouteModule;
  processPage = (await import('@/app/(portal)/masters/process/page')) as unknown as { default: () => Promise<unknown> };
}

/** Renders the page as the current person; rejects with the forbidden, not-found or redirect signal the page raises. */
export function renderProcessPage(): Promise<unknown> {
  return processPage.default();
}

/** The text of a repository file, for the checks of the README and of SPEC 4.1 (names only). */
export function repositoryText(path: string): string {
  return readFileSync(path, 'utf8');
}

/** A stored formula that subtracts one rate from another, in internal form. */
export const aMinusB = (a: string, b: string): string => `${rateRef(a)}-${rateRef(b)}`;
