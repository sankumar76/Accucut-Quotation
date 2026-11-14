import { vi } from 'vitest';

import type { RoleName } from '../../src/lib/auth/roles';

import { createSessionCookieIssuer, type SessionCookieIssuer } from '../../src/server/auth/session-cookie';
import { type AccountService, createAccountService } from '../../src/server/services/account-service';
import { type AuditService, createAuditService } from '../../src/server/services/audit-service';
import { systemClock } from '../../src/lib/time';
import { createMastersService, type MastersService } from '../../src/server/services/masters-service';
import { createEstimateService, type EstimateService } from '../../src/server/services/estimate-service';
import { createTaskService, type TaskService } from '../../src/server/services/task-service';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { CUSTOMER_CANARIES } from './customer-canary';
import { EXCHANGE_RATE_CANARIES } from './exchange-rate-canary';
import { HARNESS_PASSWORD } from './harness-password';
import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type FakeThrottleRepository, type FakeUserRepository } from './fake-auth-repositories';
import { createFakeAuditWorld, type FakeAuditWorld } from './fake-audit';
import { CANARY_FOLDER_PATH, canaryTaskCodeFor } from './estimate-recipe';
import { fakeCustomer } from './fake-customers';
import { inputsDependencies } from './estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimateWorld } from './fake-estimates';
import { createFakeTaskWorld, type FakeTaskWorld } from './fake-tasks';
import { createFakeMasterRepository, type FakeMasterRepository } from './fake-masters';
import { MATERIAL_CANARIES } from './material-master-canary';
import { seedConfig } from './seed-config';
import { defined } from './defined';
import { FRESH_TREATMENTS, TREATMENT_CANARIES } from './treatment-canary';

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

const THROTTLE_KEY_MATERIAL = 'invented-throttle-key-material';

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
  /** The task service over in-memory tasks and the harness's own people, for the routes that call it (`getTaskService` in the composition mock, STORY-04.01). */
  readonly taskService: TaskService;
  /** The in-memory tasks behind `taskService`. */
  readonly taskWorld: FakeTaskWorld;
  /** The estimate service over in-memory estimates, the harness's own people and the Customer Master above (`getEstimateService` in the composition mock, STORY-05.01). */
  readonly estimateService: EstimateService;
  /** The in-memory estimates behind `estimateService`: one draft with no customer, the harness Engineer's, with the ID `targetId` (`estimate-recipe.ts`). */
  readonly estimateWorld: FakeEstimateWorld;
  /** The attempt counters behind `userService` and `accountService`, which a test can clear between cases. */
  readonly throttles: FakeThrottleRepository;
  /** The real account service over the fake repository, for `POST /api/v1/account/password` (`getAccountService` in the composition mock). */
  readonly accountService: AccountService;
  /** The real issuer of the fresh session cookie, over a held clock (`getSessionCookieIssuer` in the composition mock). */
  readonly sessionCookieIssuer: SessionCookieIssuer;
  /** The in-memory audit storage behind `auditService` and `userService`: what was recorded, and the clock that stamps it. */
  readonly auditWorld: FakeAuditWorld;
  /** The id of each role's person (the first of that role). */
  readonly idOf: Readonly<Record<RoleName, string>>;
  /** The id of a person nobody signs in as, for the routes that change someone. */
  readonly targetId: string;
  /** Who the next request comes from; `null` for nobody. */
  signInAs(role: RoleName | null): void;
  /** Sets or clears "must change password" on the first person of a role (STORY-01.05 AC-5). */
  setMustChangePassword(role: RoleName, value: boolean): void;
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
    PEOPLE.map((person) => ({ name: person.name, email: person.email, passwordHash: `hash:${HARNESS_PASSWORD}`, role: person.role, mustChangePassword: false })),
  );
  const idFor = (role: RoleName): string => defined(users.records.find((record) => record.role === role)).id;
  const idOf: Readonly<Record<RoleName, string>> = { ADMIN: idFor('ADMIN'), LEAD: idFor('LEAD'), ENGINEER: idFor('ENGINEER') };
  const targetId = defined(users.records.find((record) => record.email === 'invented.target@example.test')).id;
  const state: { callerId: string | null; returnPath: string | null } = { callerId: null, returnPath: null };
  const throttles = createFakeThrottleRepository();
  const hasher = createCountingHasher();
  const auditWorld = createFakeAuditWorld();
  const auditService = createAuditService({ audit: auditWorld.audit });
  // The Material Master holds the canary materials (STORY-02.03): a route that leaked a price, a gravity or a scrap rate to a role would send one.
  const masters = createFakeMasterRepository(undefined, MATERIAL_CANARIES, [...FRESH_TREATMENTS, ...TREATMENT_CANARIES]);
  // The Customer Master holds the canary customer (STORY-02.02): a route that leaked a customer's rate or contact detail to a role would send one.
  for (const canary of CUSTOMER_CANARIES) {
    const values = Object.fromEntries(canary.rates.map((rate) => [rate.processItemId, rate.value]));
    masters.customers.push({ ...fakeCustomer(masters.records, canary.name, values, { phone: canary.phone }), id: canary.id });
  }
  // The Exchange Rate Master holds the canary rates (STORY-02.04): a route that leaked a rate to a role would send one.
  masters.exchange.usd = EXCHANGE_RATE_CANARIES.usd;
  masters.exchange.eur = EXCHANGE_RATE_CANARIES.eur;
  masters.exchange.stamp = { updatedById: idOf.ADMIN, updatedByName: 'Invented Admin', updatedAt: SESSION_NOW };

  const taskWorld = createFakeTaskWorld(() => users.records);
  // The recipe of the estimate routes (`estimate-recipe.ts`): the harness Engineer owns a draft whose ID is `targetId` and whose code is made from it.
  const estimateWorld = createFakeEstimateWorld(
    () => masters.customers.map((customer) => ({ id: customer.id, name: customer.name, deleted: customer.deleted })),
    [
      {
        id: targetId,
        code: canaryTaskCodeFor(targetId),
        engineerId: idOf.ENGINEER,
        assignedByName: 'Invented Lead',
        folderPath: CANARY_FOLDER_PATH,
        deadlineAt: new Date('2099-01-01T04:30:00.000Z'),
        title: 'Invented task',
        notes: 'Invented notes.',
        status: 'DRAFT',
        customerId: null,
        inputsRevision: 0,
      },
    ],
    // The one part the node routes of STORY-05.02 open: its ID is the estimate's, so the one value that fills every dynamic segment of a path names a real part of a real estimate.
    [{ id: targetId, estimateId: targetId, parentId: null, sortIndex: 0, revision: 1, inputs: {} }],
  );

  return {
    users,
    throttles,
    auditService,
    auditWorld,
    masters,
    taskWorld,
    estimateWorld,
    estimateService: createEstimateService({ estimates: estimateWorld.repository, nodes: estimateWorld.nodeRepository, transactions: estimateWorld.transactions, ...inputsDependencies(masters) }),
    // The system clock is the held one while a test file holds `Date` at `SESSION_NOW` (`holdSessionClock`), so a deadline is judged against that instant.
    taskService: createTaskService({ tasks: taskWorld.repository, transactions: taskWorld.transactions, clock: systemClock }),
    mastersService: createMastersService({
      masters,
      transactions: auditWorld.transactions,
      audit: auditService,
      currentConfiguration: () => Promise.resolve(seedConfig),
    }),
    userService: createUserService({ users, throttles, hasher, transactions: auditWorld.transactions, audit: auditService, keySecret: THROTTLE_KEY_MATERIAL }),
    accountService: createAccountService({ users, throttles, hasher, clock: { now: () => new Date() }, keySecret: THROTTLE_KEY_MATERIAL }),
    sessionCookieIssuer: createSessionCookieIssuer({ secret: 'invented-session-secret-for-the-harness', clock: { now: () => new Date() }, production: false }),
    idOf,
    targetId,
    signInAs(role) {
      state.callerId = role === null ? null : idOf[role];
      // Every call starts from the same password, so the account recipe (current -> a different new one, QLT-01) repeats as every role.
      if (role !== null) defined(users.records.find((record) => record.id === idOf[role])).passwordHash = `hash:${HARNESS_PASSWORD}`;
    },
    setMustChangePassword(role, value) {
      defined(users.records.find((record) => record.id === idOf[role])).mustChangePassword = value;
    },
    recordReturnPath(path) {
      state.returnPath = path;
    },
    // The cookie of the caller carries the version their row has now: a password change raises it and issues a fresh cookie, as the portal does.
    getServerSession: vi.fn(() => {
      const caller = state.callerId === null ? undefined : users.records.find((record) => record.id === state.callerId);
      return Promise.resolve(
        caller === undefined ? null : { expires: 'x', userId: caller.id, sessionVersion: caller.sessionVersion, signedAt: Math.floor(SESSION_NOW.getTime() / MILLISECONDS_PER_SECOND) },
      );
    }),
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
