import { vi } from 'vitest';

import type { RoleName } from '../../src/lib/auth/roles';

import { createSessionCookieIssuer, type SessionCookieIssuer } from '../../src/server/auth/session-cookie';
import { type AccountService, createAccountService } from '../../src/server/services/account-service';
import { type AuditService, createAuditService } from '../../src/server/services/audit-service';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, systemClock } from '../../src/lib/time';
import { createSettingsService, type SettingsService } from '../../src/server/services/settings-service';
import { createConfigEditService, type ConfigEditService } from '../../src/server/services/config-edit-service';
import { createConfigReadService, type ConfigReadService } from '../../src/server/services/config-read-service';
import { createStepUpService } from '../../src/server/services/step-up-service';
import { createConfigVersionCache } from '../../src/server/services/config-service';
import { createMastersService, type MastersService } from '../../src/server/services/masters-service';
import type { CalculationRepository } from '../../src/server/repositories/calculation-repository';
import type { ConfigRepository } from '../../src/server/repositories/config-repository';
import type { EstimateNodeRepository } from '../../src/server/repositories/estimate-node-repository';
import { createApprovalService, type ApprovalService } from '../../src/server/services/approval-service';
import { createUnlockService, type UnlockService } from '../../src/server/services/unlock-service';
import { createCalculationService, type CalculationService } from '../../src/server/services/calculation-service';
import { createCostDetailsService, type CostDetailsService } from '../../src/server/services/cost-details-service';
import { createEstimateReviewService, type EstimateReviewService } from '../../src/server/services/estimate-review-service';
import { createEstimateService, type EstimateService } from '../../src/server/services/estimate-service';
import { buildWorkbook } from '../../src/server/export/build-workbook';
import type { ExportRepository } from '../../src/server/repositories/export-repository';
import { createExportService, type ExportService } from '../../src/server/services/export-service';
import { createTaskService, type TaskService } from '../../src/server/services/task-service';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { CUSTOMER_CANARIES, CUSTOMER_DELETE_RECIPE_ID, CUSTOMER_DELETE_RECIPE_NAME } from './customer-canary';
import { EXCHANGE_RATE_CANARIES } from './exchange-rate-canary';
import { HARNESS_PASSWORD } from './harness-password';
import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type FakeThrottleRepository, type FakeUserRepository } from './fake-auth-repositories';
import { createFakeAuditWorld, type FakeAuditWorld } from './fake-audit';
import { createAuditSink, type AuditSink } from './fake-audit-sink';
import { CANARY_FOLDER_PATH, canaryTaskCodeFor } from './estimate-recipe';
import { fakeCustomer } from './fake-customers';
import { inputsDependencies } from './estimate-inputs-deps';
import { createFakeConfigRepository } from './fake-config';
import { createFakeJobRunRepository, type FakeJobRunRepository } from './fake-job-runs';
import { createFakeCalculationWorld, type FakeCalculationWorld } from './fake-calculations';
import { createFakeEstimateWorld, type FakeEstimateWorld } from './fake-estimates';
import { createFakeTaskWorld, type FakeTaskWorld } from './fake-tasks';
import { createFakeMasterRepository, type FakeMasterRepository } from './fake-masters';
import { MATERIAL_CANARIES, MATERIAL_DELETE_RECIPE } from './material-master-canary';
import { seedConfig } from './seed-config';
import { defined } from './defined';
import { CANARY_PICTURE_HASH, smallPng } from './pictures';
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

/** A file path and a volume name an invented `job_runs` row holds in its `result`: no answer of the Settings routes or page may carry either (STORY-02.09 AC-5). */
export const JOB_RUN_CANARY_PATH = 'D:\\InventedBackupFolder\\copy-0001.age';
export const JOB_RUN_CANARY_VOLUME = 'InventedVolumeLabel';

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
  /** The read side of the field registry over the seed registry and the 15 seed rates, for the routes and the page of STORY-08.01 (`getConfigReadService` in the composition mock). */
  readonly configReadService: ConfigReadService;
  /** The formula editor (STORY-08.02) over the same in-memory versions, the 15 seed rates, the fake calculation store, the real step-up check over the harness's people and throttles, and the audit world (`getConfigEditService` in the composition mock). */
  readonly configEditService: ConfigEditService;
  /** The in-memory configuration versions behind `configReadService`: its members are plain functions, so a test can spy on each one. */
  readonly configRepository: ConfigRepository;
  /** The Settings page's reading of the backups and the disk over the in-memory `job_runs` below, for the routes and the page of STORY-02.09 (`getSettingsService` in the composition mock). */
  readonly settingsService: SettingsService;
  /** The in-memory `job_runs` behind `settingsService`: its members are plain functions, so a test can spy on each one (the refusal-before-lookup scan does). */
  readonly jobRuns: FakeJobRunRepository;
  /** The task service over in-memory tasks and the harness's own people, for the routes that call it (`getTaskService` in the composition mock, STORY-04.01). */
  readonly taskService: TaskService;
  /** The in-memory tasks behind `taskService`. */
  readonly taskWorld: FakeTaskWorld;
  /** The estimate service over in-memory estimates, the harness's own people and the Customer Master above (`getEstimateService` in the composition mock, STORY-05.01). */
  readonly estimateService: EstimateService;
  /** The Engineer's Calculate over the same in-memory estimates, masters and a fake calculation store (`getCalculationService` in the composition mock, STORY-05.09). The canary estimate has an empty part, so a valid call is refused 422 `CALCULATE_BLOCKED` and writes nothing, at any state, for every caller. */
  readonly calculationService: CalculationService;
  /** The audit entries written by `calculationService` (an acknowledged quantity warning, STORY-05.12): what a test reads, and clears between tests with `rows.length = 0`. */
  readonly calculationAudit: AuditSink;
  /** The in-memory calculation records behind `calculationService`, which a test reads (what was stored) and clears (between tests). */
  readonly calculationWorld: FakeCalculationWorld;
  /** The approval's guard (STORY-06.05) over the same estimates and calculation records (`getApprovalService` in the composition mock). It writes nothing in any case, so a valid call of the recipe is a 409 at every state. */
  readonly approvalService: ApprovalService;
  /** Unlock and its preview (STORY-06.08) over the same estimates and approval records (`getUnlockService` in the composition mock). The canary estimate is never APPROVED, so a valid call of the recipe is the state machine's 409 and writes nothing. */
  readonly unlockService: UnlockService;
  /** The estimate review (STORY-06.02) over the same estimates, parts and calculation records, with the seed registry as every version (`getEstimateReviewService` in the composition mock). Its reads are plain functions, so a test can spy on each. */
  readonly estimateReviewService: EstimateReviewService;
  /** The pieces `estimateReviewService` and `costDetailsService` read through, for a test that spies on what a refused caller causes to be read. */
  readonly reviewReads: Pick<CalculationRepository, 'findFigureBasis' | 'findReviewFigures' | 'findRowWorking'> & Pick<EstimateNodeRepository, 'listNodes'>;
  /** The cost details of a row (STORY-06.03) over the same pieces (`getCostDetailsService` in the composition mock). */
  readonly costDetailsService: CostDetailsService;
  /** The Excel export (STORY-07.01) over the same estimates and parts, building the file in process (`getExportService` in the composition mock). */
  readonly exportService: ExportService;
  /** The pieces `exportService` reads through, for a test that spies on what a refused caller causes to be read. */
  readonly exportReads: ExportRepository & Pick<EstimateNodeRepository, 'listNodes'>;
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
  const masters = createFakeMasterRepository(undefined, [...MATERIAL_CANARIES, MATERIAL_DELETE_RECIPE], [...FRESH_TREATMENTS, ...TREATMENT_CANARIES]);
  // The Customer Master holds the canary customer (STORY-02.02): a route that leaked a customer's rate or contact detail to a role would send one.
  for (const canary of CUSTOMER_CANARIES) {
    const values = Object.fromEntries(canary.rates.map((rate) => [rate.processItemId, rate.value]));
    masters.customers.push({ ...fakeCustomer(masters.records, canary.name, values, { phone: canary.phone }), id: canary.id });
  }
  // The customer the recipe of `DELETE /api/v1/customers/{id}` deletes (STORY-02.07), kept apart so the canary above survives the Admin's valid call.
  masters.customers.push({ ...fakeCustomer(masters.records, CUSTOMER_DELETE_RECIPE_NAME), id: CUSTOMER_DELETE_RECIPE_ID });
  // The Exchange Rate Master holds the canary rates (STORY-02.04): a route that leaked a rate to a role would send one.
  masters.exchange.usd = EXCHANGE_RATE_CANARIES.usd;
  masters.exchange.eur = EXCHANGE_RATE_CANARIES.eur;
  masters.exchange.stamp = { updatedById: idOf.ADMIN, updatedByName: 'Invented Admin', updatedAt: SESSION_NOW };

  const configRepository = createFakeConfigRepository();
  // The `job_runs` of STORY-02.09: one good backup two days before the held clock and a daily reading of 62 % free, whose `result` also holds a path and a volume name that no answer may carry.
  const jobRuns = createFakeJobRunRepository([
    { job: 'backup', finishedAt: new Date(SESSION_NOW.getTime() - 2 * MILLISECONDS_PER_DAY), result: { status: 'ok', sizeBytes: 1_000, freeBytes: 620, totalBytes: 1_000, path: JOB_RUN_CANARY_PATH } },
    { job: 'backup-watch', finishedAt: new Date(SESSION_NOW.getTime() - MILLISECONDS_PER_HOUR), result: { status: 'ok', freeBytes: 620, totalBytes: 1_000, volume: JOB_RUN_CANARY_VOLUME } },
  ]);
  const taskWorld = createFakeTaskWorld(() => users.records);
  // The recipe of the task route (`estimate-recipe.ts`, STORY-04.04): the harness Engineer owns a task whose ID is `targetId`, the same as the estimate's, as in the E2E database.
  taskWorld.seed({
    id: targetId,
    code: canaryTaskCodeFor(targetId),
    engineerId: idOf.ENGINEER,
    assignedById: idOf.LEAD,
    deadlineAt: new Date('2099-01-01T04:30:00.000Z'),
    title: 'Invented task',
    notes: 'Invented notes.',
    folderPath: CANARY_FOLDER_PATH,
  });
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
    // The one picture `GET /api/v1/images/{id}` opens (STORY-05.07): its ID is the estimate's too, and it is the harness Engineer's. It is not the part's picture, so every recipe of the
    // node keeps answering as before; the picture routes' own recipes (`route-calls.ts`) never change a revision.
    [{ id: targetId, estimateId: targetId, sha256: CANARY_PICTURE_HASH, mime: 'image/png', fileName: 'canary-part.png', bytes: smallPng() }],
  );
  const estimateService = createEstimateService({
    estimates: estimateWorld.repository,
    nodes: estimateWorld.nodeRepository,
    images: estimateWorld.imageRepository,
    transactions: estimateWorld.transactions,
    ...inputsDependencies(masters),
  });
  // The Engineer's Calculate over the same world (STORY-05.09). Its one part is empty, so the valid call of the recipe is the 422 that lists what is missing, which writes nothing: it answers the
  // same at any state, for every caller, however often the matrix and the scan repeat it.
  const calculationWorld = createFakeCalculationWorld(estimateWorld);
  // The audit entries of an acknowledged quantity warning (STORY-05.12), kept apart from `auditWorld`, whose transactions are its own.
  const calculationAudit = createAuditSink();
  const calculationService = createCalculationService({
    masters,
    currentConfiguration: () => Promise.resolve({ id: '00000000-0000-4000-8000-0aaa00000001', document: seedConfig }),
    storage: { calculations: calculationWorld.repository, estimates: calculationWorld.estimates, transactions: calculationWorld.transactions },
    workflow: { nodes: estimateWorld.nodeRepository, transition: estimateService.transition, audit: calculationAudit.service },
  });
  // The approval's guard (STORY-06.05) over the same world: the lock of the estimate, the basis of its figure state and the transactions that put a record back when one throws.
  // From STORY-06.06 it also writes: the estimate's move (`transition` of the estimate service, in the same transaction), the approval row (the fake rolls it back with the transaction) and the audit entry.
  const approvalService = createApprovalService({
    estimates: calculationWorld.estimates,
    calculations: calculationWorld.repository,
    approvals: calculationWorld.approvalRepository,
    transactions: calculationWorld.transactions,
    workflow: { transition: estimateService.transition, audit: calculationAudit.service },
  });
  // Unlock (STORY-06.08) over the same world. The canary estimate is a Draft at every state a test leaves it in, so the recipe's valid call is refused 409 by the state machine before any master is read: the masters and
  // the configuration here are the ones that refusal never reaches, and a call that did reach them would fail loudly.
  const unlockService = createUnlockService({
    estimates: calculationWorld.estimates,
    approvals: calculationWorld.approvalRepository,
    calculations: calculationWorld.repository,
    masters,
    configuration: {
      current: () => Promise.reject(new Error('The harness does not read a configuration version for an unlock.')),
      byId: () => Promise.reject(new Error('The harness does not read a configuration version for an unlock.')),
    },
    transactions: calculationWorld.transactions,
    workflow: { transition: estimateService.transition, audit: calculationAudit.service },
  });
  // The estimate review (STORY-06.02): the same estimates, parts and records. A plain object of functions each, so a test can spy on what a refused caller causes to be read.
  const reviewReads = {
    findFigureBasis: (estimateId: string) => calculationWorld.repository.findFigureBasis(estimateId),
    findReviewFigures: (calculationId: string) => calculationWorld.repository.findReviewFigures(calculationId),
    findMasterSnapshot: (calculationId: string) => calculationWorld.repository.findMasterSnapshot(calculationId),
    findEstimateAccess: (estimateId: string) => calculationWorld.estimates.findEstimateAccess(estimateId),
    findRowWorking: (calculationId: string, nodeId: string) => calculationWorld.repository.findRowWorking(calculationId, nodeId),
    findLatestApproval: (estimateId: string) => calculationWorld.approvalRepository.findLatestApproval(estimateId),
    listNodes: (estimateId: string) => estimateWorld.nodeRepository.listNodes(estimateId),
  };
  const reviewVersion = { id: '00000000-0000-4000-8000-0aaa00000001', number: 1, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: '2026-11-01T00:00:00.000Z' };
  const estimateReviewService = createEstimateReviewService({
    calculations: reviewReads,
    approvals: reviewReads,
    nodes: reviewReads,
    estimates: reviewReads,
    masters,
    configuration: { current: () => Promise.resolve(reviewVersion), byId: () => Promise.resolve(reviewVersion) },
  });

  // The cost details of a row (STORY-06.03) over the same pieces.
  const costDetailsService = createCostDetailsService({
    calculations: reviewReads,
    nodes: reviewReads,
    configuration: { current: () => Promise.resolve(reviewVersion), byId: () => Promise.resolve(reviewVersion) },
  });

  // The Excel export (STORY-07.01) over the same estimates and parts. The file is built in process: the thread is `thread.test.ts`'s.
  const exportReads = {
    findHeader: (estimateId: string) => {
      const estimate = estimateWorld.estimates.find((candidate) => candidate.id.toLowerCase() === estimateId.toLowerCase());
      if (estimate === undefined) return Promise.resolve(null);
      const customer = masters.customers.find((candidate) => candidate.id === estimate.customerId);
      return Promise.resolve({ code: estimate.code, customerName: customer?.name ?? null });
    },
    listNodes: (estimateId: string) => estimateWorld.nodeRepository.listNodes(estimateId),
  };
  const exportService = createExportService({
    header: exportReads,
    nodes: exportReads,
    configuration: { current: () => Promise.resolve(reviewVersion) },
    build: buildWorkbook,
    clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
  });

  return {
    estimateReviewService,
    costDetailsService,
    exportService,
    exportReads,
    reviewReads,
    calculationAudit,
    users,
    throttles,
    auditService,
    auditWorld,
    masters,
    taskWorld,
    estimateWorld,
    estimateService,
    calculationService,
    calculationWorld,
    approvalService,
    unlockService,
    // The system clock is the held one while a test file holds `Date` at `SESSION_NOW` (`holdSessionClock`), so a deadline is judged against that instant.
    taskService: createTaskService({ tasks: taskWorld.repository, transactions: taskWorld.transactions, clock: systemClock }),
    jobRuns,
    settingsService: createSettingsService({ jobRuns, clock: systemClock }),
    configRepository,
    configReadService: createConfigReadService({ configurations: configRepository, masters, cache: createConfigVersionCache() }),
    configEditService: createConfigEditService({
      configurations: configRepository,
      masters,
      calculations: calculationWorld.repository,
      stepUp: createStepUpService({ users, throttles, hasher, clock: { now: () => new Date() }, keySecret: THROTTLE_KEY_MATERIAL }),
      transactions: auditWorld.transactions,
      audit: auditService,
      cache: createConfigVersionCache(),
    }),
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
