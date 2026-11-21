import { assertNever } from '../../lib/assert-never';
import { ConfigVersionChangedError, ConflictError, FieldInUseError, FieldValidationError, NotFoundError } from '../../lib/errors';
import { deleteField, fieldUses, type DeleteResult } from '../../lib/config/field-delete';
import { deleteAuditAfter, deleteAuditBefore } from '../../lib/config/field-delete-audit';
import { DELETE_REFUSED_MESSAGE, deletedMessage, deleteVersionChangedMessage, PROTECTED_FIELD_MESSAGE } from '../../lib/config/field-delete-words';
import type { FieldUse } from '../../lib/fields/uses';
import { insertAuditAfter } from '../../lib/config/field-insert-audit';
import { insertFields, previewLetters, type InsertResult, type InsertSpec } from '../../lib/config/field-insert';
import type { LetterChanges } from '../../lib/config/field-insert-changes';
import { canHideWhenZero, insertableSections, isWatchable, numberFormatsOf } from '../../lib/config/field-insert-check';
import { AFTER_REQUIRED_MESSAGE, insertedMessage, insertVersionChangedMessage } from '../../lib/config/field-insert-words';
import { isProtectedField } from '../../lib/fields/protected';
import { fieldLetter, findFieldById } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { FieldKind } from '../../lib/fields/types';
import type { ConfigRepository } from '../repositories/config-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditService } from './audit-service';
import { getCurrentVersion, type ConfigVersionCache } from './config-service';
import { assertMayEditConfiguration, SYSTEM_FIELD_CODE, type ConfigEditCaller } from './config-edit-service';
import type { StepUpService } from './step-up-service';

/**
 * Changing the structure of the field registry: inserting an input, an output, or an input with its cost column (STORY-08.03; FR-074, FR-075, FR-077, FR-011, FR-079; NFR-007, NFR-026; BR-035, BR-038;
 * ADR-004, ADR-005; architecture sections 4.5 and 6 "Insert preview" and "Insert field"), and deleting a field (STORY-08.04; FR-075, FR-076, FR-080; NFR-004; architecture sections 4.5 and 6 "Delete field").
 *
 * **Restricted** (ADR-008, NFR-002): it reads formulas, rate names and labels, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`). Who may call is decided before it is reached
 * (the manifest rows are for the Admin alone), and every method refuses a role that is not the Admin **again before it reads anything** (`assertMayEditConfiguration`, closed by `assertNever`).
 *
 * **The preview is the save's check.** `previewInsert` and `insertFields` both run the pure `insertFields` of `lib/config/field-insert.ts` over the current document, so the letters the Admin is shown are the letters
 * stored, and a client that skips the preview still gets the 422 on save (AC-3, AC-7). The registry's own `parseConfigDocument` is the last gate inside it.
 *
 * **The save, in this order** (a refusal costs nothing: each step before the write stores nothing):
 *   1. the base version: 409 `CONFIG_VERSION_CHANGED` when the wizard was opened on a version that is no longer the latest (AC-4);
 *   2. the insert, with the same words as the preview: 422 (AC-7);
 *   3. one transaction: the new version (stored only if the base is still the latest, so two inserts from one base cannot both win) and the audit entry `config.field_inserted`. A failure in either rolls back both (AC-4, AC-9).
 *
 * There is **no password step for an insert**: FR-080 lists only formula save, delete and revert, and SCR-19 says so. Calculations already stored are untouched: a version is never changed and a calculation names the version it
 * was made with (NFR-026), so an approved estimate keeps its figures, letters and cell addresses (AC-8).
 *
 * **The delete, in this order** (STORY-08.04 AC-2 to AC-4; a refusal costs nothing, and a field that is blocked never asks for a password):
 *   1. the role (above), then the field: 404 for an ID that is none, 409 `SYSTEM_FIELD` for a protected one (a system role, or a key the code needs: `isProtectedField`);
 *   2. what uses it, read again from the latest version on every call (a formula edited after the dialog opened is seen here): 409 `FIELD_IN_USE` with every use;
 *   3. **the password**, through `verifyStepUp` on its own throttle key (AC-4): 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`;
 *   4. one transaction: the new version, stored only if the version the checks read is still the latest (so two deletes, or a delete and a formula save, cannot both win: 409 `CONFIG_VERSION_CHANGED`, which also covers
 *      a save that landed while the password was being checked), and the audit entry `config.field_deleted`. A failure in either rolls back both.
 * The password reaches `verifyStepUp` and nowhere else. The rate list is read only to show a formula in display form; a delete removes no rate, so the race of a rate deleted during the save (GitHub issue 524) does not apply.
 */

/** The request of the preview: the spec, and whether only the letters are wanted (step 2's live list). */
export interface InsertPreviewRequest {
  readonly spec: InsertSpec;
  readonly lettersOnly?: boolean | undefined;
}

export interface InsertFieldRequest {
  readonly spec: InsertSpec;
  /** The number of the configuration version the wizard was opened on. */
  readonly baseVersion: number;
}

export interface InsertPreviewView extends LetterChanges {
  /** The number of the version the preview was worked out from. */
  readonly baseVersion: number;
  readonly formulas: ReadonlyArray<{ readonly letter: string; readonly label: string; readonly formula: string }>;
}

export interface InsertFieldResult {
  readonly version: number;
  /** The letters the new fields have in the stored version. */
  readonly letters: ReadonlyArray<string>;
  readonly message: string;
}

export interface InsertOptionsView {
  readonly version: number;
  readonly columns: ReadonlyArray<{ readonly id: string; readonly letter: string; readonly label: string; readonly kind: FieldKind; readonly watchable: boolean; readonly hideable: boolean }>;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly number: number; readonly name: string }>;
  readonly stages: ReadonlyArray<{ readonly id: string; readonly number: number; readonly name: string; readonly subHeadings: ReadonlyArray<string> }>;
  readonly numberFormats: ReadonlyArray<string>;
}

/** The password of the step-up, in the body of the delete and nowhere else. */
export interface DeleteFieldRequest {
  readonly password: string;
}

export interface DeleteFieldResult {
  /** The number of the version that no longer holds the field. */
  readonly version: number;
  readonly message: string;
}

/** What the dialog reads before it asks for a password: the field, and everything that uses it (empty when nothing does). */
export interface FieldReferencesView {
  readonly fieldId: string;
  readonly letter: string;
  readonly label: string;
  readonly uses: ReadonlyArray<FieldUse>;
}

export interface ConfigStructureService {
  /** `GET /config/insert-options`: what SCR-19 offers and the version it opens on. */
  getInsertOptions(caller: ConfigEditCaller): Promise<InsertOptionsView>;
  /** `POST /config/fields/preview`: the letters that change. Stores nothing. */
  previewInsert(caller: ConfigEditCaller, request: InsertPreviewRequest): Promise<InsertPreviewView>;
  /** `POST /config/fields`: one new version for one field or two, and its audit entry. */
  insertFields(caller: ConfigEditCaller, request: InsertFieldRequest): Promise<InsertFieldResult>;
  /** `GET /config/fields/{id}/references`: what uses the field, for the dialog of SCR-20. 404 and 409 `SYSTEM_FIELD` as the delete answers them. Stores nothing. */
  listReferences(caller: ConfigEditCaller, fieldId: string): Promise<FieldReferencesView>;
  /** `DELETE /config/fields/{id}`: one new version without the field, and its audit entry, after the checks and the password. */
  deleteField(caller: ConfigEditCaller, fieldId: string, request: DeleteFieldRequest): Promise<DeleteFieldResult>;
}

export interface ConfigStructureDependencies {
  readonly configurations: ConfigRepository;
  /** The Process Master: its rates are the names a formula may use. */
  readonly masters: Pick<MasterRepository, 'listProcessItems'>;
  /** The password check of a delete (STORY-06.14): the person's own password, on its own throttle key. */
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The parsed-version cache; the process's own when none is given (`getCurrentVersion`). Tests pass one. */
  readonly cache?: ConfigVersionCache | undefined;
}

/** The audit entry's Object is `AY Notch Cost`; the audit log keeps at most this many characters of it. */
const OBJECT_LABEL_MAX_LENGTH = 200;
/** How much of a label the version's `reason` line holds. */
const REASON_LABEL_LENGTH = 60;

function refusedWith(issues: ReadonlyArray<{ readonly field: string; readonly message: string }>): FieldValidationError {
  return new FieldValidationError(issues.map(({ field, message }) => ({ field, message })));
}

function changedAs(result: Extract<InsertResult, { ok: true }>): string {
  const names = result.changes.inserted.map((column) => `${column.letter} ${column.label.slice(0, REASON_LABEL_LENGTH)}`);
  return `Inserted ${names.join(' and ')}`;
}

/** The 404 of a field that is none and the 409 of a protected one: the first two checks of the delete and of the references read. */
function deletableField(document: ConfigDocument, fieldId: string) {
  const field = findFieldById(document, fieldId);
  if (field === undefined) throw new NotFoundError();
  if (isProtectedField(field)) throw new ConflictError(PROTECTED_FIELD_MESSAGE, { code: SYSTEM_FIELD_CODE });
  return field;
}

/** The refusal a delete that did not go ahead stands for. Nothing was written. */
function refusalOf(result: Extract<DeleteResult, { ok: false }>, document: ConfigDocument, fieldId: string): Error {
  switch (result.reason) {
    case 'not-found':
      return new NotFoundError();
    case 'protected':
      return new ConflictError(PROTECTED_FIELD_MESSAGE, { code: SYSTEM_FIELD_CODE });
    case 'in-use': {
      const field = findFieldById(document, fieldId);
      return new FieldInUseError(field === undefined ? '' : fieldLetter(field), field?.label ?? '', result.uses);
    }
    case 'invalid':
      return new ConflictError(DELETE_REFUSED_MESSAGE);
    default:
      return assertNever(result, 'delete refusal');
  }
}

export function createConfigStructureService({ configurations, masters, stepUp, transactions, audit, cache }: ConfigStructureDependencies): ConfigStructureService {
  const rateReferences = async () => (await masters.listProcessItems()).map(({ id, name }) => ({ id, name }));

  return {
    async getInsertOptions(caller) {
      assertMayEditConfiguration(caller.user);
      const { number, document } = await getCurrentVersion(configurations, cache);
      return {
        version: number,
        columns: [...document.fields].sort((a, b) => a.position - b.position).map((field) => ({ id: field.id, letter: fieldLetter(field), label: field.label, kind: field.kind, watchable: isWatchable(field), hideable: canHideWhenZero(field) })),
        sections: insertableSections(document).map(({ id, number: sectionNumber, name }) => ({ id, number: sectionNumber, name })),
        stages: [...document.stages].sort((a, b) => a.number - b.number).map(({ id, number: stageNumber, name, subHeadings }) => ({ id, number: stageNumber, name, subHeadings: [...subHeadings] })),
        numberFormats: numberFormatsOf(document),
      };
    },

    async previewInsert(caller, request) {
      assertMayEditConfiguration(caller.user);
      const version = await getCurrentVersion(configurations, cache);
      if (request.lettersOnly === true) {
        const letters = previewLetters(version.document, request.spec);
        if (letters === null) throw refusedWith([{ field: 'afterFieldId', message: AFTER_REQUIRED_MESSAGE }]);
        return { ...letters, baseVersion: version.number, formulas: [] };
      }
      const result = insertFields({ document: version.document, rates: await rateReferences(), spec: request.spec });
      if (!result.ok) throw refusedWith(result.issues);
      return { ...result.changes, baseVersion: version.number, formulas: result.formulas };
    },

    async insertFields(caller, request) {
      assertMayEditConfiguration(caller.user);
      const version = await getCurrentVersion(configurations, cache);
      if (request.baseVersion !== version.number) throw new ConfigVersionChangedError(version.number, insertVersionChangedMessage(version.number));

      const result = insertFields({ document: version.document, rates: await rateReferences(), spec: request.spec });
      if (!result.ok) throw refusedWith(result.issues);
      const letters = result.changes.inserted.map((column) => column.letter);
      const first = result.changes.inserted[0];

      return await transactions.run(async (tx) => {
        const stored = await configurations.insertVersionAfter({ baseNumber: version.number, snapshot: result.document, reason: changedAs(result), createdBy: caller.user.id }, tx);
        if (stored === null) {
          const latest = await configurations.findLatestRef(tx);
          const current = latest?.number ?? version.number;
          throw new ConfigVersionChangedError(current, insertVersionChangedMessage(current));
        }
        const entry = insertAuditAfter(result.changes, result.formulas, stored.number, { section: result.section === null ? null : { number: result.section.number, name: result.section.name }, choices: result.choices });
        await audit.record(tx, {
          event: 'config.field_inserted',
          actorId: caller.user.id,
          actorLabel: caller.user.name,
          requestId: caller.requestId,
          object: { id: result.inserted[0]?.id ?? stored.id, label: `${first?.letter ?? ''} ${first?.label ?? ''}`.slice(0, OBJECT_LABEL_MAX_LENGTH) },
          before: null,
          after: { ...entry, fields: [...entry.fields], moved: [...entry.moved] },
        });
        return { version: stored.number, letters, message: insertedMessage(letters, stored.number) };
      });
    },

    async listReferences(caller, fieldId) {
      assertMayEditConfiguration(caller.user);
      const { document } = await getCurrentVersion(configurations, cache);
      const field = deletableField(document, fieldId);
      return { fieldId: field.id, letter: fieldLetter(field), label: field.label, uses: fieldUses(document, await rateReferences(), fieldId) };
    },

    async deleteField(caller, fieldId, request) {
      assertMayEditConfiguration(caller.user);
      const version = await getCurrentVersion(configurations, cache);
      const result = deleteField({ document: version.document, rates: await rateReferences(), fieldId });
      if (!result.ok) throw refusalOf(result, version.document, fieldId);

      // The password, after every check that can fail on the field and before anything is written: a wrong password costs one of five attempts, a field that is blocked costs none (AC-4).
      await stepUp.verifyStepUp(caller, request.password);

      const { deleted, changes } = result;
      return await transactions.run(async (tx) => {
        const stored = await configurations.insertVersionAfter(
          { baseNumber: version.number, snapshot: result.document, reason: `Deleted ${deleted.letter} ${deleted.label.slice(0, REASON_LABEL_LENGTH)}`, createdBy: caller.user.id },
          tx,
        );
        if (stored === null) {
          const latest = await configurations.findLatestRef(tx);
          const current = latest?.number ?? version.number;
          throw new ConfigVersionChangedError(current, deleteVersionChangedMessage(current));
        }
        const after = deleteAuditAfter(changes, stored.number);
        await audit.record(tx, {
          event: 'config.field_deleted',
          actorId: caller.user.id,
          actorLabel: caller.user.name,
          requestId: caller.requestId,
          object: { id: deleted.id, label: `${deleted.letter} ${deleted.label}`.slice(0, OBJECT_LABEL_MAX_LENGTH) },
          before: deleteAuditBefore(deleted),
          after: { ...after, moved: [...after.moved] },
        });
        return { version: stored.number, message: deletedMessage(stored.number) };
      });
    },
  };
}
