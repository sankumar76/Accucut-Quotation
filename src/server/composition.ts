import type { NextAuthOptions } from 'next-auth';

import { loadAppEnv, loadEmailFeature, loadExportEnv, loadOriginEnv } from '../lib/env';
import { MILLISECONDS_PER_SECOND, systemClock } from '../lib/time';

import { buildAuthOptions } from './auth/options';
import { createThreadBuilder, exportThreadFile } from './export/thread-runner';
import { passwordHasher } from './auth/password-hasher';
import { createSessionCookieIssuer, type SessionCookieIssuer } from './auth/session-cookie';
import { createApprovalRepository } from './repositories/approval-repository';
import { createAuditRepository } from './repositories/audit-repository';
import { createCalculationRepository } from './repositories/calculation-repository';
import { createConfigCheckpointRepository } from './repositories/config-checkpoint-repository';
import { createConfigRepository } from './repositories/config-repository';
import { createEstimateNodeRepository } from './repositories/estimate-node-repository';
import { createEstimateRepository } from './repositories/estimate-repository';
import { createExportRepository } from './repositories/export-repository';
import { createImageRepository } from './repositories/image-repository';
import { createHeartbeatRepository, createJobRunRepository, type HeartbeatRepository } from './repositories/job-run-repository';
import { createEmailOutboxRepository } from './repositories/email-outbox-repository';
import { createPasswordResetRepository } from './repositories/password-reset-repository';
import { createSettingsRepository } from './repositories/settings-repository';
import { createMasterRepository } from './repositories/master-repository';
import { getPrismaClient } from './repositories/prisma-client';
import { createTaskRepository } from './repositories/task-repository';
import { createThrottleRepository } from './repositories/throttle-repository';
import { createTransactionRunner } from './repositories/transaction';
import { createUserRepository, type UserRepository } from './repositories/user-repository';
import { type AccountService, createAccountService } from './services/account-service';
import { type AdminHandoverService, createAdminHandoverService } from './services/admin-handover-service';
import { type ApprovalService, createApprovalService } from './services/approval-service';
import { type AuditService, createAuditService } from './services/audit-service';
import { type AuthService, createAuthService } from './services/auth-service';
import { type CancelApprovalService, createCancelApprovalService } from './services/cancel-approval-service';
import { type CalculationService, createCalculationService } from './services/calculation-service';
import { createConfigEditService, type ConfigEditService } from './services/config-edit-service';
import { createConfigReadService, type ConfigReadService } from './services/config-read-service';
import { createConfigCheckpointService, type ConfigCheckpointService } from './services/config-checkpoint-service';
import { createConfigStructureService, type ConfigStructureService } from './services/config-structure-service';
import { getCurrentVersion, getVersionById } from './services/config-service';
import { createCostDetailsService, type CostDetailsService } from './services/cost-details-service';
import { createEstimateReviewService, type EstimateReviewService } from './services/estimate-review-service';
import { createEstimateService, type EstimateService } from './services/estimate-service';
import { createMailService, type MailService } from './mail/mail-service';
import { createMailer } from './mail/send';
import { createMailTransport } from './mail/transport';
import { createExportService, type ExportService } from './services/export-service';
import { createMastersService, type MastersService } from './services/masters-service';
import { createPasswordResetService, type PasswordResetService } from './services/password-reset-service';
import { createRemovePriceService, type RemovePriceService } from './services/remove-price-service';
import { createSettingsService, type SettingsService } from './services/settings-service';
import { createStepUpService, type StepUpService } from './services/step-up-service';
import { createTaskMail } from './services/task-mail';
import { createTaskService, type TaskService } from './services/task-service';
import { createUnlockService, type UnlockService } from './services/unlock-service';
import { createUserService, type UserService } from './services/user-service';

/**
 * Where the pieces are put together for the web process (a composition root). Services and repositories take
 * their dependencies as arguments, so tests build them over a test database; this is the one place that picks
 * the real ones: the shared runtime-role database client, the system clock, the real hasher and `AUTH_SECRET`.
 *
 * Everything is built on first use, not at import, so `next build` (which has no settings) can load the modules.
 */

let userRepository: UserRepository | undefined;
let authService: AuthService | undefined;
let userService: UserService | undefined;
let accountService: AccountService | undefined;
let passwordResetService: PasswordResetService | undefined;
let adminHandoverService: AdminHandoverService | undefined;
let stepUpService: StepUpService | undefined;
let configEditService: ConfigEditService | undefined;
let sessionCookieIssuer: SessionCookieIssuer | undefined;
let auditService: AuditService | undefined;
let mastersService: MastersService | undefined;
let taskService: TaskService | undefined;
let estimateService: EstimateService | undefined;
let configReadService: ConfigReadService | undefined;
let configStructureService: ConfigStructureService | undefined;
let configCheckpointService: ConfigCheckpointService | undefined;
let calculationService: CalculationService | undefined;
let estimateReviewService: EstimateReviewService | undefined;
let approvalService: ApprovalService | undefined;
let unlockService: UnlockService | undefined;
let cancelApprovalService: CancelApprovalService | undefined;
let removePriceService: RemovePriceService | undefined;
let costDetailsService: CostDetailsService | undefined;
let exportService: ExportService | undefined;
let settingsService: SettingsService | undefined;
let mailService: MailService | undefined;
let heartbeatRepository: HeartbeatRepository | undefined;
let authOptions: NextAuthOptions | undefined;

function runtimeClient() {
  return getPrismaClient('app', loadAppEnv().DATABASE_URL);
}

export function getUserRepository(): UserRepository {
  userRepository ??= createUserRepository(runtimeClient());
  return userRepository;
}

/** The worker's heartbeat, as `GET /api/health` reads it (STORY-10.09a AC-6). The web process only reads it: the worker writes the rows and prunes them. */
export function getHeartbeatRepository(): HeartbeatRepository {
  heartbeatRepository ??= createHeartbeatRepository(runtimeClient());
  return heartbeatRepository;
}

export function getAuthService(): AuthService {
  authService ??= createAuthService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    clock: systemClock,
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return authService;
}

/** The audit log: appended in a caller's transaction, read by the Admin's screen (STORY-01.07). */
export function getAuditService(): AuditService {
  auditService ??= createAuditService({ audit: createAuditRepository(runtimeClient()) });
  return auditService;
}

/**
 * User management by the Admin (STORY-01.04). Shares the runtime-role client, the real hasher and the throttle table of sign-in.
 * Every change runs in one transaction with its audit entry (STORY-01.07).
 */
export function getUserService(): UserService {
  userService ??= createUserService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return userService;
}

/**
 * The signed-in person's own account (STORY-01.05): change your own password with the current one. Shares the runtime-role client, the real
 * hasher and the throttle table; its attempts are counted on a key of their own.
 */
export function getAccountService(): AccountService {
  accountService ??= createAccountService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    clock: systemClock,
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return accountService;
}

/**
 * Reset a password by an e-mailed link (STORY-09.07): the request for a link (public, enumeration-safe, counted on keys of its own) and the use of one. The link is queued through the outbox
 * (`getMailService().enqueue`), so a mail server that is down never blocks the request, and it is built from `APP_ORIGIN`. `FEATURE_EMAIL` is read on every request.
 */
export function getPasswordResetService(): PasswordResetService {
  passwordResetService ??= createPasswordResetService({
    resets: createPasswordResetRepository(runtimeClient()),
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    transactions: createTransactionRunner(runtimeClient()),
    mail: { enqueue: (tx, message) => getMailService().enqueue(tx, message) },
    clock: systemClock,
    keySecret: loadAppEnv().AUTH_SECRET,
    appOrigin: () => loadOriginEnv().APP_ORIGIN,
    emailEnabled: () => loadEmailFeature(),
  });
  return passwordResetService;
}

/**
 * The password step-up check (STORY-06.14): a protected action's handler calls `getStepUpService().verifyStepUp(context, password)` before it
 * writes anything. Shares the runtime-role client, the real hasher and the throttle table; its attempts are counted on a `stepup` key of their own.
 */
export function getStepUpService(): StepUpService {
  stepUpService ??= createStepUpService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    clock: systemClock,
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return stepUpService;
}

/** Issues the fresh session cookie that follows a password change (STORY-01.05 AC-3): same secret, same cookie name as sign-in. */
export function getSessionCookieIssuer(): SessionCookieIssuer {
  sessionCookieIssuer ??= createSessionCookieIssuer({
    secret: loadAppEnv().AUTH_SECRET,
    clock: systemClock,
    production: process.env.NODE_ENV === 'production',
  });
  return sessionCookieIssuer;
}

/**
 * The masters: the Process Master (STORY-02.01), the Material Master (STORY-02.03) and the Exchange Rate Master (STORY-02.04). Every change runs in
 * one transaction with its audit entry (STORY-01.07). The formulas that use a rate, and the letters the exchange-rate hints name, are read from
 * the current configuration version, which the process caches per version (`getCurrentVersion`). The exchange-rate stamp takes its time from
 * the system clock.
 */
export function getMastersService(): MastersService {
  if (mastersService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    mastersService = createMastersService({
      masters: createMasterRepository(runtimeClient()),
      transactions: createTransactionRunner(runtimeClient()),
      audit: getAuditService(),
      currentConfiguration: async () => (await getCurrentVersion(configurations)).document,
      clock: systemClock,
    });
  }
  return mastersService;
}

/**
 * Tasks (STORY-04.01): assigning a task makes the task, its empty estimate and its number in one transaction. The deadline is judged against the system clock,
 * and the year of the task code is the year in IST.
 */
export function getTaskService(): TaskService {
  taskService ??= createTaskService({
    tasks: createTaskRepository(runtimeClient()),
    transactions: createTransactionRunner(runtimeClient()),
    clock: systemClock,
    // A reassign writes its audit entry in its own transaction (STORY-04.07).
    audit: getAuditService(),
    // The assignment e-mail (STORY-09.03). The mail service is reached only when a row is written (alerts ON and `FEATURE_EMAIL` on, DEF-055), so an assignment with either off never builds
    // the mail transport; withdrawing an unsent row is a plain outbox update and does not build it either. `FEATURE_EMAIL` is read on every call, as the other writers of mail do.
    mail: createTaskMail({
      mail: { enqueue: (tx, message) => getMailService().enqueue(tx, message) },
      outbox: createEmailOutboxRepository(runtimeClient()),
      settings: createSettingsRepository(runtimeClient()),
      appOrigin: () => loadOriginEnv().APP_ORIGIN,
      clock: systemClock,
      emailEnabled: () => loadEmailFeature(),
    }),
  });
  return taskService;
}

/**
 * The estimate workspace (STORY-05.01): opening a task's estimate and choosing its customer. Choosing runs in one transaction with the estimate's input
 * revision, under the estimate's row lock. From STORY-05.03 it also serves the part form and saves what is typed into a part.
 */
export function getEstimateService(): EstimateService {
  if (estimateService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    estimateService = createEstimateService({
      estimates: createEstimateRepository(runtimeClient()),
      // A customer change writes its audit entry in its own transaction (CR-01 item 6).
      audit: getAuditService(),
      nodes: createEstimateNodeRepository(runtimeClient()),
      // The part pictures (STORY-05.07): stored whole in the database, added and read by the runtime role and never changed.
      images: createImageRepository(runtimeClient()),
      transactions: createTransactionRunner(runtimeClient()),
      // The part form (STORY-05.03): a part's material is locked in the Material Master (`lockMaterialForUse`, no number is read), and the form is built from the current registry, except for an
      // APPROVED estimate, whose form is built from the version it was calculated with (STORY-08.05), read by its ID and cached per version.
      materials: createMasterRepository(runtimeClient()),
      currentConfiguration: async () => (await getCurrentVersion(configurations)).document,
      configurationById: async (versionId) => (await getVersionById(configurations, versionId)).document,
    });
  }
  return estimateService;
}

/**
 * The read side of the field registry (STORY-08.01): the list of fields and formulas and the line for the current version. Restricted: a formula and the rate names in it are
 * for the Admin and the Lead only (NFR-002), and the routes and the page that call this are in the manifest for those two roles alone.
 */
export function getConfigReadService(): ConfigReadService {
  configReadService ??= createConfigReadService({ configurations: createConfigRepository(runtimeClient()), masters: createMasterRepository(runtimeClient()) });
  return configReadService;
}

/**
 * The formula editor (STORY-08.02): the live check, the sample rows and the save of a formula with the Admin's password. Restricted (ADR-008): the routes that call it are in the manifest for the Admin alone. It shares the
 * runtime-role client, the step-up check (its attempts are counted on the `stepup` key) and the audit service, so the new version and its entry are one transaction.
 */
export function getConfigEditService(): ConfigEditService {
  configEditService ??= createConfigEditService({
    configurations: createConfigRepository(runtimeClient()),
    masters: createMasterRepository(runtimeClient()),
    calculations: createCalculationRepository(runtimeClient()),
    stepUp: getStepUpService(),
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
  });
  return configEditService;
}

/**
 * The structure of the field registry: the insert wizard (STORY-08.03: the options SCR-19 offers, the preview of the letter changes and the insert of a field or a pair, with no password step) and the delete of a field
 * (STORY-08.04: the references read and the delete, with the password step, FR-080). Restricted (ADR-008): the routes that call it are in the manifest for the Admin alone. It shares the runtime-role client, the step-up
 * check and the audit service, so the new version and its entry are one transaction.
 */
export function getConfigStructureService(): ConfigStructureService {
  configStructureService ??= createConfigStructureService({
    configurations: createConfigRepository(runtimeClient()),
    masters: createMasterRepository(runtimeClient()),
    stepUp: getStepUpService(),
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
  });
  return configStructureService;
}

/**
 * Checkpoints and revert (STORY-08.06): the list and the save of a checkpoint, and the revert to an earlier version with the Admin's password (FR-078, FR-080). Restricted (ADR-008): the routes that call it are in the
 * manifest for the Admin alone. It shares the runtime-role client, the step-up check and the audit service, so the new version and its entry are one transaction.
 */
export function getConfigCheckpointService(): ConfigCheckpointService {
  configCheckpointService ??= createConfigCheckpointService({
    configurations: createConfigRepository(runtimeClient()),
    checkpoints: createConfigCheckpointRepository(runtimeClient()),
    masters: createMasterRepository(runtimeClient()),
    stepUp: getStepUpService(),
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
  });
  return configCheckpointService;
}

/**
 * The Engineer's Calculate (STORY-05.09): one transaction under the estimate's row lock, in which the state machine of the estimate service decides role, ownership and status, every part is
 * checked, the masters and the registry are read **inside that transaction** (so the request holds one pooled connection, review SQR-01 of AQP-293), the immutable record is stored and the
 * estimate is prepared. The service is the Restricted side (ADR-008): only a route handler asks for it here, and what it hands back is `{status, message}`.
 */
export function getCalculationService(): CalculationService {
  if (calculationService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    const estimates = createEstimateRepository(runtimeClient());
    calculationService = createCalculationService({
      masters: createMasterRepository(runtimeClient()),
      currentConfiguration: async (tx) => {
        const version = await getCurrentVersion(configurations, undefined, tx);
        return { id: version.id, document: version.document };
      },
      storage: { calculations: createCalculationRepository(runtimeClient()), estimates, transactions: createTransactionRunner(runtimeClient()) },
      workflow: {
        nodes: createEstimateNodeRepository(runtimeClient()),
        transition: (viewer, estimateId, event, tx) => getEstimateService().transition(viewer, estimateId, event, tx),
        audit: getAuditService(),
      },
    });
  }
  return calculationService;
}

/**
 * The estimate review (STORY-06.02): the figures of SCR-06 for the Lead and the Admin, read from the stored calculation only while its state is `current`. The configuration version a
 * calculation was made with is read by its ID (parsed and cached per version, like the current one). Restricted (NFR-002): only the `/costs` route and the review page ask for it here,
 * both for the Lead and the Admin alone.
 */
export function getEstimateReviewService(): EstimateReviewService {
  if (estimateReviewService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    estimateReviewService = createEstimateReviewService({
      calculations: createCalculationRepository(runtimeClient()),
      // BO is read from the approvals row, never through the figure state (STORY-06.06 AC-9).
      approvals: createApprovalRepository(runtimeClient()),
      nodes: createEstimateNodeRepository(runtimeClient()),
      // The status and the masters now, for the notice of rates that changed since the calculation (STORY-06.11): read only while the figures are current and the estimate is not approved.
      estimates: createEstimateRepository(runtimeClient()),
      masters: createMasterRepository(runtimeClient()),
      configuration: { current: () => getCurrentVersion(configurations), byId: (id) => getVersionById(configurations, id) },
    });
  }
  return estimateReviewService;
}

/**
 * The approval (STORY-06.05, STORY-06.06): under the estimate's row lock in one transaction, the guard (the status, the state of the figures read as counts through `figure-state`, the calculation named) and then
 * the write: the estimate's move to APPROVED (the estimate service's `transition`, in the same transaction), the `approvals` row and the audit entry. Restricted (NFR-002): only the `/approve` route asks for it
 * here, for the Lead and the Admin alone.
 */
export function getApprovalService(): ApprovalService {
  approvalService ??= createApprovalService({
    estimates: createEstimateRepository(runtimeClient()),
    calculations: createCalculationRepository(runtimeClient()),
    approvals: createApprovalRepository(runtimeClient()),
    transactions: createTransactionRunner(runtimeClient()),
    workflow: { transition: (viewer, estimateId, event, tx) => getEstimateService().transition(viewer, estimateId, event, tx), audit: getAuditService() },
  });
  return approvalService;
}

/**
 * Unlock and its preview (STORY-06.08): under the estimate's row lock in one transaction, the customer and the materials read `FOR SHARE`, the estimate's move to DRAFT (the estimate service's `transition`, in the same
 * transaction), the unlock stored on the approval and the audit entry; and the read of what changed since the approval, as counts. Restricted (NFR-002): only the two unlock routes ask for it here, for the Lead and the Admin alone.
 */
export function getUnlockService(): UnlockService {
  if (unlockService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    unlockService = createUnlockService({
      estimates: createEstimateRepository(runtimeClient()),
      approvals: createApprovalRepository(runtimeClient()),
      calculations: createCalculationRepository(runtimeClient()),
      masters: createMasterRepository(runtimeClient()),
      configuration: { current: () => getCurrentVersion(configurations), byId: (id) => getVersionById(configurations, id) },
      transactions: createTransactionRunner(runtimeClient()),
      workflow: { transition: (viewer, estimateId, event, tx) => getEstimateService().transition(viewer, estimateId, event, tx), audit: getAuditService() },
    });
  }
  return unlockService;
}

/**
 * Cancel approval (STORY-06.12): the password check of STORY-06.14 in the request, then under the estimate's row lock in one transaction the customer and the materials read `FOR SHARE` (the check Unlock shares), the
 * estimate's move (the estimate service's `transition`, in the same transaction), the cancel stored on the approval and the audit entry. Restricted (NFR-002): only the one cancel route asks for it here, for the Admin alone.
 */
export function getCancelApprovalService(): CancelApprovalService {
  cancelApprovalService ??= createCancelApprovalService({
    estimates: createEstimateRepository(runtimeClient()),
    approvals: createApprovalRepository(runtimeClient()),
    transactions: createTransactionRunner(runtimeClient()),
    stepUp: getStepUpService(),
    workflow: { transition: (viewer, estimateId, event, tx) => getEstimateService().transition(viewer, estimateId, event, tx), audit: getAuditService() },
  });
  return cancelApprovalService;
}

/**
 * The Admin hand-over (STORY-01.09): the password check of STORY-06.14 in the request, then in one transaction with both rows locked the swap of the two roles and the one audit entry. Shares the
 * runtime-role client and the step-up check; only its one route asks for it, for the Admin alone.
 */
export function getAdminHandoverService(): AdminHandoverService {
  adminHandoverService ??= createAdminHandoverService({
    users: getUserRepository(),
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
    stepUp: getStepUpService(),
  });
  return adminHandoverService;
}

/**
 * Remove price (STORY-06.13): the password check of STORY-06.14 in the request, then under the estimate's row lock in one transaction the removal stored on the approval and the audit entry that keeps the price.
 * Restricted (NFR-002): only the one remove-price route asks for it here, for the Admin alone.
 */
export function getRemovePriceService(): RemovePriceService {
  removePriceService ??= createRemovePriceService({
    estimates: createEstimateRepository(runtimeClient()),
    approvals: createApprovalRepository(runtimeClient()),
    transactions: createTransactionRunner(runtimeClient()),
    stepUp: getStepUpService(),
    audit: getAuditService(),
  });
  return removePriceService;
}

/**
 * The Settings page (STORY-02.09, STORY-09.02): the last good backup and the newest free-space reading, from `job_runs`, against the system clock, and the e-mail alerts of the `settings` row with
 * the test e-mail, which goes through the mail service's `sendNow`. The routes and the page that call it are in the manifest for the Admin alone.
 */
export function getSettingsService(): SettingsService {
  settingsService ??= createSettingsService({
    jobRuns: createJobRunRepository(runtimeClient()),
    outbox: createEmailOutboxRepository(runtimeClient()),
    settings: createSettingsRepository(runtimeClient()),
    users: getUserRepository(),
    mail: getMailService(),
    emailEnabled: () => loadEmailFeature(),
    clock: systemClock,
  });
  return settingsService;
}

/**
 * The cost details of one row (STORY-06.03): the six stages of SCR-07 for the Lead and the Admin, worked from the stored calculation record only while its state is `current`. Built like the review
 * (the configuration version a calculation was made with is read by its ID). Restricted (NFR-002): only the `/nodes/{nodeId}/costs` route and the cost details page ask for it here, both for the
 * Lead and the Admin alone.
 */
export function getCostDetailsService(): CostDetailsService {
  if (costDetailsService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    costDetailsService = createCostDetailsService({
      calculations: createCalculationRepository(runtimeClient()),
      nodes: createEstimateNodeRepository(runtimeClient()),
      configuration: { current: () => getCurrentVersion(configurations), byId: (id) => getVersionById(configurations, id) },
    });
  }
  return costDetailsService;
}

/**
 * The Excel export (STORY-07.01): the summary of SCR-10 and the `.xlsx`, for the Lead and the Admin. The file is built in a `worker_threads` thread from the bundle `scripts/build-export-worker.ts` makes at
 * `.next/export-worker.mjs` under the folder the server runs in (ADR-012). Restricted (NFR-002): only the two export routes and the export page ask for it here, all for the Lead and the Admin alone.
 */
export function getExportService(): ExportService {
  if (exportService === undefined) {
    const configurations = createConfigRepository(runtimeClient());
    exportService = createExportService({
      header: createExportRepository(runtimeClient()),
      nodes: createEstimateNodeRepository(runtimeClient()),
      calculations: createCalculationRepository(runtimeClient()),
      approvals: createApprovalRepository(runtimeClient()),
      images: createImageRepository(runtimeClient()),
      configuration: { current: () => getCurrentVersion(configurations), byId: (id) => getVersionById(configurations, id) },
      transactions: createTransactionRunner(runtimeClient()),
      builder: createThreadBuilder({ entry: exportThreadFile(process.cwd()), timeoutMs: loadExportEnv().EXPORT_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND }),
      clock: systemClock,
    });
  }
  return exportService;
}

/**
 * The next-auth options for the running process. `NEXTAUTH_URL` is set from `APP_ORIGIN` so next-auth builds its
 * addresses from the portal's own origin, whatever host header arrives, and never from a request header.
 */
export function getAuthOptions(): NextAuthOptions {
  if (authOptions === undefined) {
    const env = loadAppEnv();
    process.env.NEXTAUTH_URL = env.APP_ORIGIN;
    authOptions = buildAuthOptions({
      authService: getAuthService(),
      clock: systemClock,
      secret: env.AUTH_SECRET,
      production: process.env.NODE_ENV === 'production',
    });
  }
  return authOptions;
}

/**
 * The mail outbox and the direct send (STORY-09.01): `enqueue(tx, message)` for the alerts and the reset link, `sendNow(message)` for the Settings test e-mail. The transport is built
 * from `SMTP_AUTH_MODE` and its variables when first used, never at import. The worker builds its own pair in `src/worker/main.ts`; nothing else in `app` sends.
 */
export function getMailService(): MailService {
  mailService ??= createMailService({
    outbox: createEmailOutboxRepository(runtimeClient()),
    mailer: createMailer(createMailTransport(loadAppEnv(), { clock: systemClock })),
    clock: systemClock,
  });
  return mailService;
}
