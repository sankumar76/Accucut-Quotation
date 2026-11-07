import { vi } from 'vitest';

import type { RoleName } from '../../src/lib/auth/roles';

import { type AuditService, createAuditService } from '../../src/server/services/audit-service';
import { createMastersService, type MastersService } from '../../src/server/services/masters-service';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type FakeUserRepository } from './fake-auth-repositories';
import { createFakeAuditWorld, type FakeAuditWorld } from './fake-audit';
import { createFakeMasterRepository, type FakeMasterRepository } from './fake-masters';
import { seedConfig } from './seed-config';
import { defined } from './defined';

/**
 * A signed-in caller for the tests that run the real routes and pages (`tests/security`), without a database or a
 * server. One invented person per role sits in a fake user repository, and `signInAs(role)` makes the next request come
 * from that person (`signInAs(null)` from nobody). The session itself is the real one: `getCurrentUser`, `requireUser`,
 * `requireUserOrRedirect` and `requireRole` run against the fake repository, so a deactivation or a role change in the
 * test is seen at the next request exactly as it is in the portal. Only the edges are replaced: `getServerSession`,
 * the request headers, `redirect`, `forbidden`, `notFound` and the composition root.
 *
 * Use it through `vi.mock` factories that import this file (see `role-matrix.test.ts`), because `vi.mock` is hoisted
 * above ordinary imports. Every name and address here is invented.
 */

const MILLISECONDS_PER_SECOND = 1_000;

/**
 * The instant at which every harness session was signed in, and at which the tests that use the harness hold the system
 * clock (`vi.useFakeTimers({ toFake: ['Date'], now: SESSION_NOW })` in `beforeAll`, see `holdSessionClock`). A session is 12
 * hours from sign-in, so a fixed instant for both makes the result the same on every run and at any time of day (STD-06).
 */
export const SESSION_NOW = new Date('2026-11-05T09:00:00.000Z');

/** Holds `Date` at `SESSION_NOW` until `releaseSessionClock`. Timers stay real, so nothing waits on a fake clock. */
export function holdSessionClock(): void {
  vi.useFakeTimers({ toFake: ['Date'], now: SESSION_NOW });
}

export function releaseSessionClock(): void {
  vi.useRealTimers();
}

export const REDIRECT_PREFIX = 'NEXT_REDIRECT:';
export const FORBIDDEN_SIGNAL = 'NEXT_FORBIDDEN';
export const NOT_FOUND_SIGNAL = 'NEXT_NOT_FOUND';

const PEOPLE: ReadonlyArray<{ readonly role: RoleName; readonly name: string; readonly email: string }> = [
  { role: 'ADMIN', name: 'Invented Admin', email: 'invented.admin@example.test' },
  { role: 'LEAD', name: 'Invented Lead', email: 'invented.lead@example.test' },
  { role: 'ENGINEER', name: 'Invented Engineer', email: 'invented.engineer@example.test' },
  // Nobody signs in as this person: the routes that change someone (rename, password reset) change them, so no caller is affected.
  { role: 'ENGINEER', name: 'Invented Target', email: 'invented.target@example.test' },
];

export interface SessionHarness {
  readonly users: FakeUserRepository;
  /** The real user service over the fake repository, for the routes that call it (`getUserService` in the composition mock). */
  readonly userService: UserService;
  /** The real audit service over in-memory storage, for the routes that call it (`getAuditService` in the composition mock). */
  readonly auditService: AuditService;
  /** The Process Master over in-memory rates (the 15 seed items) and the seed registry, for the routes that call it (`getMastersService` in the composition mock). */
  readonly mastersService: MastersService;
  /** The in-memory rates behind `mastersService`: a test sets values in them to look for in what a refused caller is sent. */
  readonly masters: FakeMasterRepository;
  /** The in-memory audit storage behind `auditService` and `userService`: what was recorded, and the clock that stamps it. */
  readonly auditWorld: FakeAuditWorld;
  /** The id of each role's person (the first of that role). */
  readonly idOf: Readonly<Record<RoleName, string>>;
  /** The id of a person nobody signs in as, for the routes that change someone. */
  readonly targetId: string;
  /** Who the next request comes from; `null` for nobody. */
  signInAs(role: RoleName | null): void;
  /** The address `proxy.ts` would record for the request, or `null` for none. */
  recordReturnPath(path: string | null): void;
  readonly getServerSession: ReturnType<typeof vi.fn>;
  readonly headers: () => Promise<Headers>;
  readonly redirect: (path: string) => never;
  readonly forbidden: () => never;
  readonly notFound: () => never;
}

export function createSessionHarness(): SessionHarness {
  const users = createFakeUserRepository(
    PEOPLE.map((person) => ({ name: person.name, email: person.email, passwordHash: 'invented-hash', role: person.role, mustChangePassword: false })),
  );
  const idFor = (role: RoleName): string => defined(users.records.find((record) => record.role === role)).id;
  const idOf: Readonly<Record<RoleName, string>> = { ADMIN: idFor('ADMIN'), LEAD: idFor('LEAD'), ENGINEER: idFor('ENGINEER') };
  const targetId = defined(users.records.find((record) => record.email === 'invented.target@example.test')).id;
  const state: { callerId: string | null; returnPath: string | null } = { callerId: null, returnPath: null };
  const auditWorld = createFakeAuditWorld();
  const auditService = createAuditService({ audit: auditWorld.audit });
  const masters = createFakeMasterRepository();

  return {
    users,
    auditService,
    auditWorld,
    masters,
    mastersService: createMastersService({
      masters,
      transactions: auditWorld.transactions,
      audit: auditService,
      currentConfiguration: () => Promise.resolve(seedConfig),
    }),
    userService: createUserService({
      users,
      throttles: createFakeThrottleRepository(),
      hasher: createCountingHasher(),
      transactions: auditWorld.transactions,
      audit: auditService,
      keySecret: 'invented-throttle-key-material',
    }),
    idOf,
    targetId,
    signInAs(role) {
      state.callerId = role === null ? null : idOf[role];
    },
    recordReturnPath(path) {
      state.returnPath = path;
    },
    getServerSession: vi.fn(() =>
      Promise.resolve(
        state.callerId === null ? null : { expires: 'x', userId: state.callerId, sessionVersion: 0, signedAt: Math.floor(SESSION_NOW.getTime() / MILLISECONDS_PER_SECOND) },
      ),
    ),
    headers: () => Promise.resolve(new Headers(state.returnPath === null ? {} : { 'x-return-path': state.returnPath })),
    redirect: (path) => {
      throw new Error(`${REDIRECT_PREFIX}${path}`);
    },
    forbidden: () => {
      throw new Error(FORBIDDEN_SIGNAL);
    },
    notFound: () => {
      throw new Error(NOT_FOUND_SIGNAL);
    },
  };
}

/** The one harness of a test file; the mock factories and the test share it through this module. */
export const harness: SessionHarness = createSessionHarness();
