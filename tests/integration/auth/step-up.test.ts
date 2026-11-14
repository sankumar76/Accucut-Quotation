import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DatabaseBusyError } from '@/lib/errors';
import { MILLISECONDS_PER_MINUTE } from '@/lib/time';
import type { PasswordHasher } from '@/server/auth/password-hasher';
import type { AuthenticatedUser } from '@/server/auth/session';
import { stepUpThrottleKey } from '@/server/auth/throttle-key';
import type { HttpMethod, RouteRow } from '@/server/http/route-manifest';
import { findSecretPath } from '@/server/services/audit-secrets';
import { createAuthService } from '@/server/services/auth-service';
import { createStepUpService, type StepUpService } from '@/server/services/step-up-service';
import { stepUpPasswordSchema } from '@/server/views/schemas/step-up';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { createTestHasher, insertUser } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-06.14 against real PostgreSQL in a throwaway database, through a REAL `withRoute` handler built in this file (AC-8): the step-up
 * service over the real repositories, the real (cheap) hasher and the real throttle statement; the real wrapper in front, which checks the
 * origin, reads the session, parses the body and turns an error into its problem body. Only the session (`requireUser`), the logger and the
 * manifest row are replaced, as in `tests/unit/http-with-route.test.ts`. There is no production step-up route and no second test-only route:
 * the handler exists only here, on a manifest row that exists only here (the last test holds that to the real manifest and source tree).
 *
 * What only the database can prove: ten wrong attempts at once reach the password check at most five times (AC-5), the five-failure block
 * and its 15-minute end on the real clock-driven statement (AC-3), and sign-in and step-up on separate rows (AC-4). Every name, address
 * and password is invented.
 */

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const TEST_ROUTE = '/api/v1/test-step-up';
const TEST_ROWS: ReadonlyArray<RouteRow> = [
  { path: TEST_ROUTE, kind: 'api', methods: ['POST'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' },
];

vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/logger', () => ({ logger: { debug: mocks.debug, info: mocks.info, warn: mocks.warn, error: mocks.error } }));
vi.mock('@/server/http/route-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/http/route-manifest')>();
  return { ...actual, findRoute: (path: string, method: HttpMethod) => TEST_ROWS.find((row) => row.path === path && row.methods.includes(method)) };
});

const { withRoute } = await import('@/server/http/with-route');

const APP_ORIGIN = 'https://portal.example.test';
const KEY_SECRET = 'invented-throttle-key-material';
const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const THEIRS = 'Zx8%mNc4#Tv-other';
const START = new Date('2026-11-14T10:00:00.000Z');
const BLOCK = 15 * MILLISECONDS_PER_MINUTE;

let db: AuthDatabase;
let now: Date;
let checks = 0;
let service: StepUpService;
let handle: ReturnType<typeof withRoute>;
const protectedAction = vi.fn<(userId: string) => void>();

/** The real (cheap) hasher, with a count of the password checks it was asked for. */
const realHasher = createTestHasher();
const countingHasher: PasswordHasher = {
  hash: (password) => realHasher.hash(password),
  verify(passwordHash, password) {
    checks += 1;
    return realHasher.verify(passwordHash, password);
  },
};

interface Person {
  readonly id: string;
  readonly email: string;
  readonly user: AuthenticatedUser;
}

async function person(label: string, role: 'LEAD' | 'ENGINEER', password: string): Promise<Person> {
  const { id, email } = await insertUser(db.users, realHasher, { email: `${label}@example.test`, role, password });
  return { id, email, user: { id, name: `Invented ${label}`, email, role, mustChangePassword: false } };
}

/** A request to the protected route: a same-origin POST with a JSON body. */
function post(body: Record<string, unknown>, headers: Record<string, string> = { origin: APP_ORIGIN }): Request {
  return new Request(`${APP_ORIGIN}${TEST_ROUTE}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

function signInAs(who: Person): void {
  mocks.requireUser.mockResolvedValue(who.user);
}

const problem = async (response: Response) => z.record(z.string(), z.unknown()).parse(await response.json());

async function throttleRow(key: string): Promise<{ failures: number; blocked_until: Date | null } | undefined> {
  const { rows } = await db.owner.query<{ failures: number; blocked_until: Date | null }>('SELECT failures, blocked_until FROM login_throttles WHERE key_hash = $1', [key]);
  return rows[0];
}

const stepUpKeyOf = (who: Person) => stepUpThrottleKey(KEY_SECRET, who.id);

async function countOf(table: 'audit_log' | 'login_throttles'): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
  return Number(defined(rows[0]).count);
}

/** The service and the real wrapper in front of a handler that does what a protected action does: check the step-up, then act. */
function buildHandler(over: StepUpService): ReturnType<typeof withRoute> {
  return withRoute({
    route: TEST_ROUTE,
    method: 'POST',
    // Loose on purpose (AC-6): a body that carries a user ID or another password field must reach the handler to show nothing in it is read.
    body: z.looseObject({ password: stepUpPasswordSchema }),
    output: z.strictObject({ done: z.literal(true) }),
    async handler(context) {
      await over.verifyStepUp(context, context.body.password);
      protectedAction(context.user.id);
      return { done: true as const };
    },
  });
}

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createStepUpService({ users: db.users, throttles: db.throttles, hasher: countingHasher, clock: { now: () => now }, keySecret: KEY_SECRET });
  handle = buildHandler(service);
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
  vi.clearAllMocks();
  now = new Date(START);
  checks = 0;
});

describe('AC-1: the right password', () => {
  it('passes, runs the action and clears the run of failures', async () => {
    const who = await person('right.password', 'LEAD', RIGHT);
    signInAs(who);
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await handle(post({ password: WRONG }))).status).toBe(422);
    expect((await throttleRow(stepUpKeyOf(who)))?.failures).toBe(3);

    const response = await handle(post({ password: RIGHT }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: true });
    expect(protectedAction.mock.calls).toEqual([[who.id]]);
    expect(await throttleRow(stepUpKeyOf(who))).toMatchObject({ failures: 0, blocked_until: null });
  });
});

describe('AC-2: a wrong password', () => {
  it('is 422 STEP_UP_FAILED, with the same neutral words for every wrong case, no new cookie, and the action does not run', async () => {
    const who = await person('wrong.password', 'ENGINEER', RIGHT);
    signInAs(who);
    const answers = [];
    for (const attempt of [WRONG, 'x', THEIRS]) {
      const response = await handle(post({ password: attempt }));
      expect(response.status).toBe(422);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(response.headers.get('Set-Cookie')).toBeNull();
      const { requestId, ...body } = await problem(response);
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      answers.push(body);
    }
    expect(answers[0]).toMatchObject({ status: 422, code: 'STEP_UP_FAILED' });
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(protectedAction).not.toHaveBeenCalled();
  });

  it('leaves the session valid: the next request with the right password passes with no sign-in in between', async () => {
    const who = await person('session.stays', 'ENGINEER', RIGHT);
    signInAs(who);
    expect((await handle(post({ password: WRONG }))).status).toBe(422);
    expect((await handle(post({ password: RIGHT }))).status).toBe(200);
  });
});

describe('AC-3: five wrong passwords block for 15 minutes, on a key of their own', () => {
  it('refuses the sixth with 429 STEP_UP_LOCKED even with the right password, then frees it after 15 minutes', async () => {
    const who = await person('blocked.stepup', 'LEAD', RIGHT);
    signInAs(who);
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await handle(post({ password: WRONG }))).status).toBe(422);
    expect((await throttleRow(stepUpKeyOf(who)))?.blocked_until).toEqual(new Date(START.getTime() + BLOCK));

    checks = 0;
    const locked = await handle(post({ password: RIGHT }));
    expect(locked.status).toBe(429);
    expect(locked.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await problem(locked)).toMatchObject({ status: 429, code: 'STEP_UP_LOCKED' });
    expect(checks).toBe(0);
    expect(protectedAction).not.toHaveBeenCalled();

    now = new Date(START.getTime() + BLOCK - 1);
    expect((await handle(post({ password: RIGHT }))).status).toBe(429);
    now = new Date(START.getTime() + BLOCK);
    expect((await handle(post({ password: RIGHT }))).status).toBe(200);
    expect(protectedAction.mock.calls).toEqual([[who.id]]);
  });

  it('blocks one person only', async () => {
    const blocked = await person('only.blocked', 'LEAD', RIGHT);
    const free = await person('still.free', 'ENGINEER', THEIRS);
    signInAs(blocked);
    for (let attempt = 0; attempt < 5; attempt += 1) await handle(post({ password: WRONG }));
    signInAs(free);
    expect((await handle(post({ password: THEIRS }))).status).toBe(200);
  });
});

describe('AC-4: sign-in and step-up never block each other', () => {
  const auth = () => createAuthService({ users: db.users, throttles: db.throttles, hasher: countingHasher, clock: { now: () => now }, keySecret: KEY_SECRET });

  it('a blocked step-up leaves sign-in open', async () => {
    const who = await person('stepup.blocked.signin.open', 'LEAD', RIGHT);
    signInAs(who);
    for (let attempt = 0; attempt < 5; attempt += 1) await handle(post({ password: WRONG }));
    expect((await handle(post({ password: RIGHT }))).status).toBe(429);
    expect((await auth().authenticate({ email: who.email, password: RIGHT, ipAddress: '192.0.2.21' })).status).toBe('signed-in');
  });

  it('four failed sign-ins and then a step-up: the step-up passes, and its own count starts at zero', async () => {
    const who = await person('signin.failed.then.stepup', 'LEAD', RIGHT);
    signInAs(who);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await auth().authenticate({ email: who.email, password: WRONG, ipAddress: '192.0.2.22' })).toEqual({ status: 'refused', reason: 'invalid' });
    }
    expect((await handle(post({ password: RIGHT }))).status).toBe(200);
    expect(await throttleRow(stepUpKeyOf(who))).toMatchObject({ failures: 0 });
  });

  it('a blocked sign-in leaves step-up open, and step-up failures after four failed sign-ins do not block sign-in', async () => {
    const who = await person('signin.blocked.stepup.open', 'LEAD', RIGHT);
    signInAs(who);
    for (let attempt = 0; attempt < 5; attempt += 1) await auth().authenticate({ email: who.email, password: WRONG, ipAddress: '192.0.2.23' });
    expect(await auth().authenticate({ email: who.email, password: RIGHT, ipAddress: '192.0.2.24' })).toEqual({ status: 'refused', reason: 'locked' });
    expect((await handle(post({ password: RIGHT }))).status).toBe(200);

    const second = await person('signin.four.stepup.five', 'ENGINEER', RIGHT);
    signInAs(second);
    for (let attempt = 0; attempt < 4; attempt += 1) await auth().authenticate({ email: second.email, password: WRONG, ipAddress: '192.0.2.25' });
    for (let attempt = 0; attempt < 5; attempt += 1) await handle(post({ password: WRONG }));
    expect((await handle(post({ password: RIGHT }))).status).toBe(429);
    expect((await auth().authenticate({ email: second.email, password: RIGHT, ipAddress: '192.0.2.26' })).status).toBe('signed-in');
  });
});

describe('AC-5: attempts are reserved before the password is checked', () => {
  it('ten wrong attempts at once reach the password check at most five times: five get 422, five get 429', async () => {
    const who = await person('ten.at.once', 'LEAD', RIGHT);
    signInAs(who);
    const responses = await Promise.all(Array.from({ length: 10 }, () => handle(post({ password: WRONG }))));
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    expect(statuses).toEqual([422, 422, 422, 422, 422, 429, 429, 429, 429, 429]);
    expect(checks).toBe(5);
    expect(protectedAction).not.toHaveBeenCalled();
  });

  it('a database fault gives the reservation back and answers 503 without counting against the person', async () => {
    const who = await person('database.fault', 'LEAD', RIGHT);
    signInAs(who);
    await handle(post({ password: WRONG }));
    await handle(post({ password: WRONG }));
    expect((await throttleRow(stepUpKeyOf(who)))?.failures).toBe(2);

    const faulty = buildHandler(
      createStepUpService({
        users: { ...db.users, findCredentialsById: () => Promise.reject(new DatabaseBusyError()) },
        throttles: db.throttles,
        hasher: countingHasher,
        clock: { now: () => now },
        keySecret: KEY_SECRET,
      }),
    );
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await faulty(post({ password: RIGHT }));
      expect(response.status).toBe(503);
      expect(await problem(response)).toMatchObject({ status: 503, code: 'DATABASE_BUSY' });
    }
    // Six faults, and still two failures on the count: nothing was kept, and the person is not blocked.
    expect((await throttleRow(stepUpKeyOf(who)))?.failures).toBe(2);
    expect((await handle(post({ password: RIGHT }))).status).toBe(200);
  });
});

describe('AC-6: nothing in the body picks whose password is checked', () => {
  it('a body that names another person and carries their password does not pass for them', async () => {
    const caller = await person('caller.signed.in', 'LEAD', RIGHT);
    const target = await person('other.person', 'ENGINEER', THEIRS);
    signInAs(caller);
    const response = await handle(post({ password: THEIRS, userId: target.id, id: target.id, email: target.email, currentPassword: THEIRS }));
    expect(response.status).toBe(422);
    expect(protectedAction).not.toHaveBeenCalled();
    expect(await throttleRow(stepUpKeyOf(target))).toBeUndefined();
    expect((await throttleRow(stepUpKeyOf(caller)))?.failures).toBe(1);
  });

  it('the session person\'s own password passes whatever else the body says, and the action runs for the session person', async () => {
    const caller = await person('own.password.passes', 'LEAD', RIGHT);
    const target = await person('named.in.body', 'ENGINEER', THEIRS);
    signInAs(caller);
    const response = await handle(post({ password: RIGHT, userId: target.id, otherPassword: THEIRS, currentPassword: THEIRS }));
    expect(response.status).toBe(200);
    expect(protectedAction.mock.calls).toEqual([[caller.id]]);
    expect(await throttleRow(stepUpKeyOf(target))).toBeUndefined();
  });

  it('is refused for a request with no password at all, and an over-long one is refused before any hash is made', async () => {
    const who = await person('no.password', 'LEAD', RIGHT);
    signInAs(who);
    expect((await handle(post({}))).status).toBe(422);
    expect((await handle(post({ password: 'x'.repeat(2_000) }))).status).toBe(422);
    expect(checks).toBe(0);
    expect(await throttleRow(stepUpKeyOf(who))).toBeUndefined();
  });
});

describe('AC-7: the password never appears', () => {
  it('not in a log call, a response, the throttle table or the audit log, after a pass, a fail and a block', async () => {
    const who = await person('never.appears', 'LEAD', RIGHT);
    signInAs(who);
    const auditBefore = await countOf('audit_log');
    const responses: Response[] = [];
    responses.push(await handle(post({ password: WRONG })));
    responses.push(await handle(post({ password: RIGHT })));
    for (let attempt = 0; attempt < 5; attempt += 1) responses.push(await handle(post({ password: WRONG })));
    responses.push(await handle(post({ password: RIGHT })));
    expect(responses.map((response) => response.status)).toEqual([422, 200, 422, 422, 422, 422, 422, 429]);

    const bodies = await Promise.all(responses.map((response) => response.text()));
    const logged = [mocks.debug, mocks.info, mocks.warn, mocks.error].flatMap((spy) => spy.mock.calls);
    const table = await db.owner.query('SELECT * FROM login_throttles');
    const everything = JSON.stringify({ bodies, logged, table: table.rows });
    for (const secret of [WRONG, RIGHT, THEIRS]) expect(everything).not.toContain(secret);
    expect(everything).not.toMatch(/\$argon2/);

    // The redaction of the audit log (audit-secrets.ts) finds nothing in what was logged, and the step-up wrote no audit row of its own.
    for (const call of logged) expect(findSecretPath(call)).toBeNull();
    expect(await countOf('audit_log')).toBe(auditBefore);
  });

  it('logs a failed step-up with the person\'s ID and the request ID, and nothing more', async () => {
    const who = await person('log.shape', 'ENGINEER', RIGHT);
    signInAs(who);
    const response = await handle(post({ password: WRONG }));
    const { requestId } = await problem(response);
    const stepUpLogs = mocks.warn.mock.calls.filter(([fields]) => typeof fields === 'object' && fields !== null && 'userId' in fields);
    expect(stepUpLogs).toHaveLength(1);
    expect(stepUpLogs[0]?.[0]).toEqual({ userId: who.id, requestId });
  });

  it('keeps the error body free of anything technical: no stack, no cause, no query', async () => {
    const who = await person('error.body', 'ENGINEER', RIGHT);
    signInAs(who);
    const body = await problem(await handle(post({ password: WRONG })));
    expect(Object.keys(body).sort()).toEqual(['code', 'requestId', 'status', 'title', 'type']);
  });
});

describe('AC-8: no new production route and no second test-only route', () => {
  it('the manifest has no step-up row, and exactly one test-only row (the cost-confidentiality negative control)', async () => {
    const { ROUTE_MANIFEST } = await vi.importActual<typeof import('@/server/http/route-manifest')>('@/server/http/route-manifest');
    expect(ROUTE_MANIFEST.filter((row) => row.testOnly === true).map((row) => row.path)).toEqual(['/api/test-only/leak']);
    expect(ROUTE_MANIFEST.filter((row) => /step-?up/i.test(row.path))).toEqual([]);
  });

  it('the source tree has no route file whose path names step-up or a second test-only directory', () => {
    const apiDirectory = fileURLToPath(new URL('../../../src/app/api/', import.meta.url));
    const routeFiles = readdirSync(apiDirectory, { recursive: true, encoding: 'utf8' }).map((entry) => entry.replaceAll('\\', '/'));
    expect(routeFiles.filter((entry) => /step-?up/i.test(entry))).toEqual([]);
    expect(routeFiles.filter((entry) => entry.startsWith('test-only/') && entry.endsWith('route.ts'))).toEqual(['test-only/leak/route.ts']);
  });
});
