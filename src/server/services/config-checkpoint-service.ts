import { ConfigVersionChangedError, CHECKPOINT_NAME_TAKEN_CODE, ConflictError, FieldValidationError, NOTHING_TO_REVERT_CODE, NotFoundError } from '../../lib/errors';
import { checkCheckpointName, CHECKPOINT_NAME_TAKEN_MESSAGE, NOTHING_TO_REVERT_MESSAGE, revertVersionChangedMessage } from '../../lib/config/checkpoint';
import { planRevert, revertAuditObjectLabel, revertReason, unusableMessage } from '../../lib/config/revert';
import type { ConfigCheckpointRepository, CheckpointRecord } from '../repositories/config-checkpoint-repository';
import type { ConfigRepository } from '../repositories/config-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditService } from './audit-service';
import { assertMayEditConfiguration, type ConfigEditCaller } from './config-edit-service';
import { ConfigVersionMissingError, getCurrentVersion, getVersionById, type ConfigVersion, type ConfigVersionCache } from './config-service';
import type { StepUpService } from './step-up-service';

/**
 * Checkpoints and revert (STORY-08.06; FR-077, FR-078, FR-080, FR-011, FR-079; NFR-002, NFR-004, NFR-007, NFR-026; BR-005, BR-012; SPEC sections 8.3 and 14 item 8; architecture sections 4.5, 5.1, 6 rows "Checkpoints" and
 * "Revert", and 8): the Admin names the configuration as it is now, lists the names, and goes back to one, with their own password.
 *
 * **Restricted** (ADR-008, NFR-002): a revert reads whole snapshots, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`). Who may call is decided before it is reached (the manifest
 * rows are for the Admin alone, so `withRoute` answers a Lead and an Engineer 403 and a signed-out caller 401), and every method refuses a role that is not the Admin **again before it reads anything**
 * (`assertMayEditConfiguration`). Nothing this service answers holds a snapshot, a formula or a rate: a checkpoint is a name, a number, a time and a person's name.
 *
 * **Saving a checkpoint** names the version that is the latest when the insert runs, in one statement. It stores **no version**, asks **no password** (FR-080 lists only revert) and writes **no audit entry**: nothing in
 * the configuration changed, and the checkpoint row itself records who and when, immutably (decision D-1 of the story).
 *
 * **A revert, in this order** (AC-4; a refusal costs nothing, and a target that cannot be reverted to never asks for a password):
 *   1. the role (above), then the target: 404 for a version that is none. A revert is by **version ID**, so an undo, which has no checkpoint, works (architecture section 16.4 item 8);
 *   2. the base version: 409 `CONFIG_VERSION_CHANGED` when the screen was opened on a version that is no longer the latest;
 *   3. the target against the current configuration: 409 `NOTHING_TO_REVERT` when its content is the same; then against today's Process master: 422 naming each field that reads a rate the master no longer has (AC-5);
 *   4. **the password**, through `verifyStepUp` on its own throttle key: 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`;
 *   5. one transaction: the new version, **a copy of the target's snapshot** stored through the one writer `insertVersionAfter` (only if the version the checks read is still the latest, so two reverts, or a revert and a
 *      save, cannot both win: 409 `CONFIG_VERSION_CHANGED`, which also covers a save that landed while the password was being checked), and the audit entry `config.reverted`. A failure in either rolls back both.
 * A revert never edits or deletes a version, and touches no estimate, calculation, approval, master or image: a calculation names the version it was made with (NFR-026), so an approved estimate keeps its figures and
 * layout (AC-6), and a Draft uses the reverted layout from its next calculation. The password reaches `verifyStepUp` and nowhere else.
 */

/** One checkpoint as the screen reads it: the name, the version it names (the revert is by this ID), when it was saved and by whom. No snapshot. */
export interface CheckpointView {
  readonly id: string;
  readonly name: string;
  readonly versionId: string;
  readonly versionNumber: number;
  /** An ISO 8601 instant in UTC; the screen shows IST. */
  readonly savedAt: string;
  /** The name of the person who saved it; `null` for the seed checkpoint, which no person saved. */
  readonly savedBy: string | null;
}

export interface CheckpointsView {
  /** Newest first. */
  readonly checkpoints: ReadonlyArray<CheckpointView>;
}

export interface SaveCheckpointRequest {
  readonly name: string;
}

export interface RevertRequest {
  /** The password of the step-up, in the body of the revert and nowhere else. */
  readonly password: string;
  /** The number of the configuration version the screen showed as current. The revert is made only if it still is. */
  readonly baseVersion: number;
}

export interface RevertResult {
  /** The number of the version the revert made. */
  readonly version: number;
  /** The number of the version whose snapshot it copied. */
  readonly copiedFrom: number;
  /** The ID of the version that was the latest just before: the target of "Revert to the version from before" (AC-7). */
  readonly undoVersionId: string;
}

export interface ConfigCheckpointService {
  /** `GET /config/checkpoints`: every checkpoint, newest first. */
  listCheckpoints(caller: ConfigEditCaller): Promise<CheckpointsView>;
  /** `POST /config/checkpoints`: a name for the latest version. No new version, no password, no audit entry. */
  saveCheckpoint(caller: ConfigEditCaller, request: SaveCheckpointRequest): Promise<CheckpointView>;
  /** `POST /config/versions/{id}/revert`: one new version equal to the target's snapshot, and its audit entry, after the checks and the password. */
  revert(caller: ConfigEditCaller, versionId: string, request: RevertRequest): Promise<RevertResult>;
}

export interface ConfigCheckpointDependencies {
  readonly configurations: ConfigRepository;
  readonly checkpoints: ConfigCheckpointRepository;
  /** The Process Master: its rates are the names a formula may use, which decide whether a target can still be used. */
  readonly masters: Pick<MasterRepository, 'listProcessItems'>;
  /** The password check of a revert (STORY-06.14): the person's own password, on its own throttle key. */
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The parsed-version cache; the process's own when none is given (`getCurrentVersion`). Tests pass one. */
  readonly cache?: ConfigVersionCache | undefined;
}

function viewOf(row: CheckpointRecord): CheckpointView {
  return { id: row.id, name: row.name, versionId: row.versionId, versionNumber: row.versionNumber, savedAt: row.createdAt.toISOString(), savedBy: row.createdByName };
}

/** The version with this ID, parsed (and cached like every version), or the 404 of an ID that is none. */
async function versionOrNotFound(configurations: ConfigRepository, versionId: string, cache: ConfigVersionCache | undefined): Promise<ConfigVersion> {
  try {
    return await getVersionById(configurations, versionId, cache);
  } catch (error) {
    if (error instanceof ConfigVersionMissingError) throw new NotFoundError();
    throw error;
  }
}

export function createConfigCheckpointService({ configurations, checkpoints, masters, stepUp, transactions, audit, cache }: ConfigCheckpointDependencies): ConfigCheckpointService {
  return {
    async listCheckpoints(caller) {
      assertMayEditConfiguration(caller.user);
      return { checkpoints: (await checkpoints.listCheckpoints()).map(viewOf) };
    },

    async saveCheckpoint(caller, request) {
      assertMayEditConfiguration(caller.user);
      const checked = checkCheckpointName(request.name);
      if (!checked.ok) throw new FieldValidationError([{ field: 'name', message: checked.message }]);
      // A checkpoint names the latest version, so one must exist (the seed step has run); the insert below names the latest at its own moment.
      if ((await configurations.findLatestRef()) === null) throw new ConfigVersionMissingError();
      const stored = await checkpoints.insertCheckpoint({ name: checked.name, createdBy: caller.user.id });
      if (stored === null) throw new ConflictError(CHECKPOINT_NAME_TAKEN_MESSAGE, { code: CHECKPOINT_NAME_TAKEN_CODE });
      return viewOf(stored);
    },

    async revert(caller, versionId, request) {
      assertMayEditConfiguration(caller.user);
      const target = await versionOrNotFound(configurations, versionId, cache);
      const current = await getCurrentVersion(configurations, cache);
      if (request.baseVersion !== current.number) throw new ConfigVersionChangedError(current.number, revertVersionChangedMessage(current.number));

      const plan = planRevert({
        current: { id: current.id, number: current.number, snapshot: current.document },
        target: { id: target.id, number: target.number, snapshot: target.document },
        document: target.document,
        rates: (await masters.listProcessItems()).map(({ id, name }) => ({ id, name })),
      });
      if (!plan.ok) {
        if (plan.reason === 'nothing-to-revert') throw new ConflictError(NOTHING_TO_REVERT_MESSAGE, { code: NOTHING_TO_REVERT_CODE });
        throw new FieldValidationError(plan.fields.map((field) => ({ field: `${field.letter} ${field.label}`, message: unusableMessage(field) })));
      }

      // The password, after every check that can fail on the target and before anything is written: a wrong password costs one of five attempts, a target that cannot be used costs none.
      await stepUp.verifyStepUp(caller, request.password);

      return await transactions.run(async (tx) => {
        const name = await checkpoints.findNameOfVersion(target.id, tx);
        const stored = await configurations.insertVersionAfter({ baseNumber: current.number, snapshot: plan.snapshot, reason: revertReason(name, target.number), createdBy: caller.user.id }, tx);
        if (stored === null) {
          const latest = await configurations.findLatestRef(tx);
          const newest = latest?.number ?? current.number;
          throw new ConfigVersionChangedError(newest, revertVersionChangedMessage(newest));
        }
        await audit.record(tx, {
          event: 'config.reverted',
          actorId: caller.user.id,
          actorLabel: caller.user.name,
          requestId: caller.requestId,
          object: { id: target.id, label: revertAuditObjectLabel(name, target.number) },
          before: { version: current.number },
          after: { version: stored.number, copiedFrom: target.number },
        });
        return { version: stored.number, copiedFrom: target.number, undoVersionId: current.id };
      });
    },
  };
}
