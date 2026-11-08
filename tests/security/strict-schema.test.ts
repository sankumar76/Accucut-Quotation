import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';
import { withRoute } from '@/server/http/with-route';
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
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
    getMastersService: () => shared.mastersService,
  };
});

const ORIGIN = 'https://portal.example.test';
const PLANTED_KEY = 'plantedCostField';

type SchemaHandler = ((request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>) & { readonly responseSchema: z.ZodType };

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
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(call.body) } : {}),
  });
  const params = Object.fromEntries([...row.path.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map((match) => [match[1] ?? '', call.id]));
  return (await handlerFor(row, method))(request, { params: Promise.resolve(params) });
}

/** Every object node of a JSON Schema that does not forbid other keys: the places where an unknown key would be let through. */
function openObjects(node: unknown, path = '#'): string[] {
  if (Array.isArray(node)) return node.flatMap((child, index) => openObjects(child, `${path}/${index}`));
  if (typeof node !== 'object' || node === null) return [];
  const record = z.record(z.string(), z.unknown()).parse(node);
  const own = record['type'] === 'object' && record['properties'] !== undefined && record['additionalProperties'] !== false ? [path] : [];
  return [...own, ...Object.entries(record).flatMap(([key, child]) => openObjects(child, `${path}/${key}`))];
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
    expect(answer.status).toBeLessThan(300);
    const sample: unknown = answer.status === 204 ? undefined : await answer.json();
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

  it('the walker can fail: a plain z.object has an open object, a strictObject has none', () => {
    const open = z.toJSONSchema(z.object({ inner: z.object({ a: z.string() }) }), { io: 'input', unrepresentable: 'any' });
    expect(openObjects(open)).toEqual(['#', '#/properties/inner']);
    const closed = z.toJSONSchema(z.strictObject({ inner: z.strictObject({ a: z.string() }) }), { io: 'input', unrepresentable: 'any' });
    expect(openObjects(closed)).toEqual([]);
  });
});
