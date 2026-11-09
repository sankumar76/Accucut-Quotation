import { db, world } from './process-master-api';

import type { Answer } from './process-master-api';

/**
 * The shared world of the Material Master acceptance tests (QA, AQP-122; STORY-02.03). It reuses the Process Master world of
 * `process-master-api.ts` (the mocked edges, the throwaway database, the three people, the real route code, the real session code, the real
 * service and the real audit service) and adds the three material routes, the page, and the readers of the `materials` table. Oracles
 * are written in the tests from the acceptance criteria, the UX spec and the architecture, not copied from the code: the audit rows and the
 * stored numbers are read with plain SQL. All names and numbers are invented.
 */

export const MATERIALS_URL = 'https://portal.example.test/api/v1/materials';
export const OPTIONS_URL = 'https://portal.example.test/api/v1/options/materials';
const ORIGIN = 'https://portal.example.test';
const REQUEST_ID_HEADER = 'x-request-id';

type RouteModule = Record<string, (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>>;
let collection!: RouteModule;
let item!: RouteModule;
let options!: RouteModule;
let materialsPage!: { default: () => Promise<unknown> };

/** Loads the route modules and the page, in a hook (importing them can take longer than a test's limit on a busy machine). */
export async function loadMaterialRoutes(): Promise<void> {
  collection = (await import('@/app/api/v1/materials/route')) as unknown as RouteModule;
  item = (await import('@/app/api/v1/materials/[id]/route')) as unknown as RouteModule;
  options = (await import('@/app/api/v1/options/materials/route')) as unknown as RouteModule;
  materialsPage = (await import('@/app/(portal)/masters/materials/page')) as unknown as { default: () => Promise<unknown> };
}

export function renderMaterialsPage(): Promise<unknown> {
  return materialsPage.default();
}

export interface CallOptions {
  readonly origin?: string | null;
  readonly extraHeaders?: Record<string, string>;
  readonly rawBody?: string;
}

async function answerOf(response: Response): Promise<Answer> {
  const text = await response.text();
  let body: Record<string, unknown> | null = null;
  try {
    const value: unknown = text === '' ? null : JSON.parse(text);
    body = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body, text, requestId: response.headers.get(REQUEST_ID_HEADER), headers: response.headers };
}

/** `GET /api/v1/materials`, `POST /api/v1/materials` (id null) or `PATCH /api/v1/materials/{id}`, through the real route handler. */
export async function callMaterials(method: 'GET' | 'POST' | 'PATCH', id: string | null, body?: unknown, extra: CallOptions = {}): Promise<Answer> {
  const routes = id === null ? collection : item;
  const handler = routes[method];
  if (handler === undefined) throw new Error(`no ${method}`);
  const origin = extra.origin === undefined ? ORIGIN : extra.origin;
  const hasBody = method !== 'GET';
  const headers: Record<string, string> = { ...(origin === null ? {} : { origin }), ...(hasBody ? { 'content-type': 'application/json' } : {}), ...extra.extraHeaders };
  const request = new Request(`${MATERIALS_URL}${id === null ? '' : `/${id}`}`, {
    method,
    headers,
    ...(hasBody ? { body: extra.rawBody ?? JSON.stringify(body) } : {}),
  });
  return answerOf(await handler(request, { params: Promise.resolve(id === null ? {} : { id }) }));
}

/** `GET /api/v1/options/materials`. */
export async function callOptions(): Promise<Answer> {
  const handler = options['GET'];
  if (handler === undefined) throw new Error('no GET');
  return answerOf(await handler(new Request(OPTIONS_URL, { method: 'GET' }), { params: Promise.resolve({}) }));
}

/** A valid body. The numbers follow the invented pattern `n.37` (ADR-014). */
export const GOOD = { materialConsidered: 'Invented QA considered', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' } as const;

export function createMaterial(materialInDrawing: string, extra: Record<string, unknown> = {}): Promise<Answer> {
  return callMaterials('POST', null, { materialInDrawing, ...GOOD, ...extra });
}

export function idOf(answer: Answer): string {
  const id = answer.body?.['id'];
  if (typeof id !== 'string') throw new Error(`no id in the answer (status ${answer.status}): ${answer.text}`);
  return id;
}

/** Every error of a 422 as `field: message`, in the order the answer gives them. */
export function errorsOf(answer: Answer): string[] {
  const errors = answer.body?.['errors'];
  if (!Array.isArray(errors)) throw new Error(`no errors in the answer (status ${answer.status}): ${answer.text}`);
  return errors.map((error: unknown) => {
    const { field, message } = error as { field?: unknown; message?: unknown };
    return `${String(field)}: ${String(message)}`;
  });
}

export interface StoredMaterial {
  readonly id: string;
  readonly material_in_drawing: string;
  readonly material_considered: string | null;
  readonly price_per_kg: string;
  readonly specific_gravity: string;
  readonly scrap_rate: string;
  readonly is_hidden: boolean;
  readonly deleted_at: Date | null;
}

const COLUMNS = `id::text, material_in_drawing, material_considered, price_per_kg::text, specific_gravity::text, scrap_rate::text, is_hidden, deleted_at`;

/** Every row of the table, hidden and deleted ones included, read as the owner (plain SQL). */
export async function allRows(): Promise<ReadonlyArray<StoredMaterial>> {
  const { rows } = await db.owner.query<StoredMaterial>(`SELECT ${COLUMNS} FROM materials ORDER BY created_at, id`);
  return rows;
}

export async function rowOf(id: string): Promise<StoredMaterial | undefined> {
  const { rows } = await db.owner.query<StoredMaterial>(`SELECT ${COLUMNS} FROM materials WHERE id = $1`, [id]);
  return rows[0];
}

export async function rowCount(): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM materials');
  return Number(rows[0]?.count);
}

/** Puts a row in as the owner, which writes no audit entry: for a hidden or deleted row that no route can make yet (stories 02.06 and 02.07). */
export async function insertAsOwner(values: { readonly name: string; readonly considered: string | null; readonly hidden?: boolean; readonly deleted?: boolean; readonly gravity?: string; readonly price?: string }): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>(
    `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate, is_hidden, deleted_at)
     VALUES ($1, $2, $3, $4, 0, $5, ${values.deleted === true ? 'now()' : 'NULL'}) RETURNING id::text`,
    [values.name, values.considered, values.price ?? '0', values.gravity ?? (values.hidden === true ? '0' : '7.37'), values.hidden === true],
  );
  const found = rows[0];
  if (found === undefined) throw new Error('no row inserted');
  return found.id;
}

export interface AuditRow {
  readonly event: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly actor_id: string;
  readonly request_id: string;
  readonly before: unknown;
  readonly after: unknown;
}

/** Every audit entry about material objects, oldest first. */
export async function materialEntries(): Promise<ReadonlyArray<AuditRow>> {
  const { rows } = await db.owner.query<AuditRow>(
    "SELECT event, object_type, object_id::text, object_label, actor_id::text, request_id, before, after FROM audit_log WHERE object_type = 'material' ORDER BY created_at, id",
  );
  return rows;
}

export async function entriesOfObject(id: string): Promise<ReadonlyArray<AuditRow>> {
  const { rows } = await db.owner.query<AuditRow>(
    'SELECT event, object_type, object_id::text, object_label, actor_id::text, request_id, before, after FROM audit_log WHERE object_id = $1 ORDER BY created_at, id',
    [id],
  );
  return rows;
}

/** Whatever the audit table holds in all, for "a refusal writes nothing". */
export async function auditTotal(): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
  return Number(rows[0]?.count);
}

/** The person making the next request (null is signed out). */
export function actAs(id: string | null): void {
  world.userId = id;
}
