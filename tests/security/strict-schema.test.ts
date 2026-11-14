import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';
import { withRoute, type RouteHandler } from '@/server/http/with-route';
import { meResponseSchema } from '@/server/views/schemas';

import { validCallFor } from '../support/route-calls';
import { API_LOADERS } from '../support/route-loaders';
import { nonEmpty } from '../support/security-loops';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.03 T3 (AC-2; ADR-008 layer 3; architecture section 6, "One route, one schema"): every route an Engineer may call
 * answers through ONE response schema, whoever calls it, and that schema is strict, so an unknown key raises an error instead of
 * reaching the client. The routes are taken from the manifest (every implemented API row that lists ENGINEER), so a story that
 * opens a new route to an Engineer is held to the same rule with no edit here (AC-6). Three things are shown:
 *   - the handler `withRoute` returns carries exactly one response schema (`responseSchema`);
 *   - that schema is strict at every object level, read from its JSON Schema and by planting an extra key into a real answer;
 *   - the wrapper fails closed: a handler that returns an extra key gets a 500 with a generic body, and the key does not leave.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
    getMastersService: () => shared.mastersService,
    getTaskService: () => shared.taskService,
    getEstimateService: () => shared.estimateService,
    getAccountService: () => shared.accountService,
    getSessionCookieIssuer: () => shared.sessionCookieIssuer,
  };
});

const ORIGIN = 'https://portal.example.test';
const PLANTED_KEY = 'plantedCostField';

/** What `withRoute` returns: the handler, and the one schema its answer is parsed with. */
type SchemaHandler = RouteHandler;

const routeHandler = z.custom<SchemaHandler>((value) => typeof value === 'function' && 'responseSchema' in value, 'a route handler made by withRoute');
const moduleShape = z.record(z.string(), z.unknown());

/** Every API row an Engineer may call, once per method. Throws when there is none, so the loops below cannot pass on nothing. */
const ENGINEER_CALLS: ReadonlyArray<{ readonly name: string; readonly row: RouteRow; readonly method: HttpMethod }> = nonEmpty(
  'Engineer-reachable API routes',
  ROUTE_MANIFEST.filter((row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public' && allowsRole(row, 'ENGINEER')).flatMap((row) =>
    row.methods.filter((method) => method !== 'HEAD').map((method) => ({ name: `${method} ${row.path}`, row, method })),
  ),
);

async function handlerFor(row: RouteRow, method: HttpMethod): Promise<SchemaHandler> {
  const loader = API_LOADERS[row.path];
  if (loader === undefined) throw new Error(`no loader for ${row.path}`);
  return routeHandler.parse(moduleShape.parse(await loader())[method]);
}

/** Calls the route as an Engineer with the valid call of `route-calls.ts` (a body and an ID that pass). */
async function callAsEngineer(row: RouteRow, method: HttpMethod): Promise<Response> {
  harness.signInAs('ENGINEER');
  const call = validCallFor(method, row.path, { targetId: harness.targetId });
  const path = row.path.replace(/\[(?:\.\.\.)?[^\]]+\]/g, call.id);
  const hasBody = call.body !== undefined && method !== 'GET';
  const request = new Request(`${ORIGIN}${path}${call.query ?? ''}`, {
    method,
    headers: { origin: ORIGIN, ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(call.body) } : {}),
  });
  const params = Object.fromEntries([...row.path.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map((match) => [match[1] ?? '', call.id]));
  return (await handlerFor(row, method))(request, { params: Promise.resolve(params) });
}

/** The keys of a JSON Schema node whose value is itself a schema, or a list of schemas, or a map of name to schema. */
const SCHEMA_KEYS = ['items', 'additionalProperties', 'not', 'if', 'then', 'else'] as const;
const SCHEMA_LIST_KEYS = ['prefixItems', 'anyOf', 'oneOf', 'allOf'] as const;
const SCHEMA_MAP_KEYS = ['properties', '$defs', 'definitions'] as const;

/**
 * Every place in a JSON Schema where an unknown key would be let through (QLT-06): an object that does not say `additionalProperties:
 * false`, a record included (its extra keys are free), and an empty schema `{}` (`z.unknown()` and `z.any()` accept anything). Only
 * nodes in schema position are judged, so an empty `properties` map of a strict object is not mistaken for an empty schema.
 */
function openObjects(node: unknown, path = '#'): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [];
  const record = z.record(z.string(), z.unknown()).parse(node);
  const own = Object.keys(record).length === 0 || (record['type'] === 'object' && record['additionalProperties'] !== false) ? [path] : [];
  const single = SCHEMA_KEYS.flatMap((key) => (key in record ? openObjects(record[key], `${path}/${key}`) : []));
  const lists = SCHEMA_LIST_KEYS.flatMap((key) => {
    const list = record[key];
    return Array.isArray(list) ? list.flatMap((child, index) => openObjects(child, `${path}/${key}/${index}`)) : [];
  });
  const maps = SCHEMA_MAP_KEYS.flatMap((key) => {
    const map = record[key];
    return typeof map === 'object' && map !== null && !Array.isArray(map)
      ? Object.entries(map).flatMap(([name, child]) => openObjects(child, `${path}/${key}/${name}`))
      : [];
  });
  return [...own, ...single, ...lists, ...maps];
}

/** A copy of a JSON value with an extra key planted in the object at `path`, or `undefined` when there is no such object. */
function plantAt(value: unknown, path: ReadonlyArray<string | number>): unknown {
  const [head, ...rest] = path;
  if (head === undefined) return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value, [PLANTED_KEY]: 'x' } : undefined;
  if (Array.isArray(value) && typeof head === 'number') {
    const planted = plantAt(value[head], rest);
    return planted === undefined ? undefined : value.map((item, index) => (index === head ? planted : item));
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof head === 'string') {
    const record = z.record(z.string(), z.unknown()).parse(value);
    const planted = plantAt(record[head], rest);
    return planted === undefined ? undefined : { ...record, [head]: planted };
  }
  return undefined;
}

/** The path of every object inside a JSON value, the root included (an array's items are addressed by index). */
function objectPaths(value: unknown, path: ReadonlyArray<string | number> = []): Array<ReadonlyArray<string | number>> {
  if (Array.isArray(value)) return value.flatMap((item, index) => objectPaths(item, [...path, index]));
  if (typeof value !== 'object' || value === null) return [];
  return [path, ...Object.entries(value).flatMap(([key, child]) => objectPaths(child, [...path, key]))];
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs(null);
});

describe.each(ENGINEER_CALLS)('$name (AC-2)', ({ row, method }) => {
  it('is made by withRoute, which hands over the one schema its answer is parsed with', async () => {
    const handler = await handlerFor(row, method);
    expect(handler.responseSchema).toBeInstanceOf(z.ZodType);
  });

  it('has a strict schema: no object in it lets an unknown key through', async () => {
    const { responseSchema } = await handlerFor(row, method);
    expect(openObjects(z.toJSONSchema(responseSchema, { io: 'input', unrepresentable: 'any' }))).toEqual([]);
  });

  it('refuses an unknown key planted in a real answer, at every object level', async () => {
    const { responseSchema } = await handlerFor(row, method);
    const answer = await callAsEngineer(row, method);
    const recipe = validCallFor(method, row.path, { targetId: harness.targetId });
    expect(answer.status).toBe(recipe.status);
    // A valid call that is documented as a refusal (STORY-05.02: a delete would remove the one canary part, so its call is refused 409 and can be repeated) has no
    // success body to plant a key in. Its schema is the one object the tree and move routes answer with, planted into there (`estimate-tree-route.test.ts` holds
    // that the delete route answers with that very schema), and the refusal's own body is read by the confidentiality scan.
    if (recipe.status >= 300) return;
    expect(answer.status).toBeLessThan(300);
    if (answer.status === 204) {
      // A 204 has no body, so there is no object to plant a key in: its schema accepts "no body" and nothing else, so no field can leave.
      expect(responseSchema.safeParse(undefined).success).toBe(true);
      expect(responseSchema.safeParse({ [PLANTED_KEY]: 'x' }).success).toBe(false);
      return;
    }
    const sample: unknown = await answer.json();
    const paths = objectPaths(sample);
    expect(paths.length, `${row.path} answered with no object to plant a key in`).toBeGreaterThan(0);
    expect(responseSchema.safeParse(sample).success).toBe(true);
    for (const path of paths) {
      const planted = plantAt(sample, path);
      const parsed = responseSchema.safeParse(planted);
      expect(parsed.success, `an extra key at ${path.join('.') || 'the root'} was accepted`).toBe(false);
      expect(JSON.stringify(parsed.error?.issues ?? [])).toContain('unrecognized_keys');
    }
  });
});

describe('the wrapper fails closed (AC-2: an unknown key raises an error)', () => {
  it('a handler that returns a key the schema does not name gets 500 with a generic body, and the key does not leave', async () => {
    const leaky = withRoute({
      route: '/api/v1/me',
      method: 'GET',
      output: meResponseSchema,
      // The handler is wrong on purpose: the extra key travels in a variable, which the compiler's excess-property check does not see.
      handler: ({ user }) => {
        const smuggled = { name: user.name, email: user.email, role: user.role, navigation: [], overdueCount: 0, [PLANTED_KEY]: '771.37' };
        return smuggled;
      },
    });
    harness.signInAs('ENGINEER');
    const answer = await leaky(new Request(`${ORIGIN}/api/v1/me`, { headers: { origin: ORIGIN } }));
    const text = await answer.text();
    expect(answer.status).toBe(500);
    expect(answer.headers.get('cache-control')).toBe('private, no-store');
    expect(text).not.toContain(PLANTED_KEY);
    expect(text).not.toContain('771.37');
    expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });

  it('the strict schema of /api/v1/me names exactly the five fields that are meant to leave', () => {
    expect(Object.keys(meResponseSchema.shape).sort()).toEqual(['email', 'name', 'navigation', 'overdueCount', 'role']);
  });

  const jsonOf = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });

  it('the walker can fail: a plain z.object has an open object, a strictObject has none', () => {
    expect(openObjects(jsonOf(z.object({ inner: z.object({ a: z.string() }) })))).toEqual(['#', '#/properties/inner']);
    expect(openObjects(jsonOf(z.strictObject({ inner: z.strictObject({ a: z.string() }) })))).toEqual([]);
  });

  it('the walker can fail on a record and on an unconstrained value inside a strict schema (QLT-06)', () => {
    // A strict object that carries a record lets any key through at that place, and z.unknown() / z.any() accept any value.
    expect(openObjects(jsonOf(z.strictObject({ extras: z.record(z.string(), z.string()).optional() })))).toEqual(['#/properties/extras']);
    expect(openObjects(jsonOf(z.strictObject({ extras: z.unknown() })))).toEqual(['#/properties/extras']);
    expect(openObjects(jsonOf(z.strictObject({ extras: z.any() })))).toEqual(['#/properties/extras']);
    expect(openObjects(jsonOf(z.strictObject({ rows: z.array(z.record(z.string(), z.number())) })))).toEqual(['#/properties/rows/items']);
    expect(openObjects(jsonOf(z.record(z.string(), z.string())))).toEqual(['#']);
  });

  it('the walker does not mistake the empty properties of a strict object, or plain values, for an open schema', () => {
    expect(openObjects(jsonOf(z.strictObject({})))).toEqual([]);
    expect(
      openObjects(
        jsonOf(z.strictObject({ n: z.number().int().nonnegative(), s: z.enum(['A', 'B']), l: z.array(z.string()), u: z.union([z.string(), z.null()]) })),
      ),
    ).toEqual([]);
  });
});
