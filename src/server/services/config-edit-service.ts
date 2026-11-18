import { assertNever } from '../../lib/assert-never';
import { ConfigVersionChangedError, ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { checkFormulaEdit, isFormulaField, type FedField, type FormulaUse } from '../../lib/config/formula-edit';
import { previewFormula, type FormulaPreview, type PreviewRow } from '../../lib/config/formula-preview';
import { NO_FORMULA_FIELD_MESSAGE, savedMessage, UNCHANGED_MESSAGE, versionChangedMessage } from '../../lib/config/formula-words';
import { partNameOf } from '../../lib/estimate/part-name';
import { fieldLetter, findFieldById, referenceContext } from '../../lib/fields/registry';
import { parseConfigDocument, ConfigDocumentError, type ConfigDocument } from '../../lib/fields/schema';
import { fixedOperands, toDisplayForm } from '../../lib/formula';
import type { RoleName } from '../../lib/auth/roles';
import type { CalculationRepository, CalculationRecord } from '../repositories/calculation-repository';
import type { ConfigRepository } from '../repositories/config-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditService } from './audit-service';
import { getCurrentVersion, type ConfigVersionCache } from './config-service';
import type { StepUpCaller, StepUpService } from './step-up-service';

/**
 * Editing a formula of the field registry (STORY-08.02; FR-022, FR-023, FR-073, FR-077, FR-080; NFR-004, NFR-007, NFR-026; BR-005; ADR-004, ADR-005, ADR-009; architecture sections 4.5 and 6 "Formula check",
 * "Sample rows" and "Save formula"): the Admin changes how one cost is calculated, with a live check and a preview on a row of the latest calculated estimate, and saves it only with their own password.
 *
 * **Restricted** (ADR-008, NFR-002): it reads formulas, rate names and a stored calculation, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`). Who may call is decided before it
 * is reached (the manifest rows are for the Admin alone, so `withRoute` answers a Lead and an Engineer 403 and a signed-out caller 401), and every method refuses a role that is not the Admin **again before it reads
 * anything**, by name and closed by `assertNever`.
 *
 * **The check is the save's check.** `checkFormula` and `saveFormula` run the same `checkFormulaEdit` over the current document, so a client that skips the live check still gets the 422 on save (AC-2). The
 * formula is only ever read by the tokenizer and parser of `lib/formula`; nothing here runs text as code (AC-3).
 *
 * **The save, in this order** (a refusal costs nothing: each step before the write stores nothing):
 *   1. the field: 404 for an ID that is none, 409 `SYSTEM_FIELD` for a field with no formula to edit (A, F, I and BO, AC-6);
 *   2. the base version: 409 `CONFIG_VERSION_CHANGED` when the version the editor was opened on is no longer the latest (AC-9);
 *   3. the formula, with the same words as the live check: 422 (AC-2);
 *   4. **the formula is the saved text already: nothing is written, no version is made, the password is not asked for, and the answer says so.** This is the decision on "edit to its own text" (SPEC section 14
 *      item 7 and 9 test note): a version is a record of a change, and there is none, so a no-op leaves the history, the version number and the audit log exactly as they were;
 *   5. the password, through `verifyStepUp` on its own throttle key (AC-4): 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`;
 *   6. one transaction: the new version (stored only if the base is still the latest, so two saves from one base cannot both win, AC-9) and the audit entry `config.formula_changed` with the old and new text (AC-5).
 *      A failure in either rolls back both.
 *
 * Calculations already stored are untouched: a version is never changed and a calculation names the version it was made with (NFR-026). A new calculation reads the latest version, and its compiled plan is cached
 * by that version's ID, so the new formula is used from the next calculation and a stale plan cannot be (AC-5).
 *
 * The password never reaches this file's own data: it is passed to `verifyStepUp` and nowhere else, and is in no log line, audit entry, error or answer (AC-4).
 */

/** What a request of the editor carries about who sent it. `HandlerContext` fits. */
export interface ConfigEditCaller extends StepUpCaller {
  readonly user: { readonly id: string; readonly name: string; readonly role: RoleName };
}

export interface FormulaCheckRequest {
  readonly fieldId: string;
  /** The formula as typed, display form. */
  readonly text: string;
  /** The row to try it on; the first row of the sample estimate when left out. */
  readonly sampleRowId?: string | undefined;
}

export interface FormulaCheckView {
  readonly valid: true;
  readonly message: string;
  readonly uses: ReadonlyArray<FormulaUse>;
  readonly feeds: ReadonlyArray<FedField>;
  /** The estimate the preview was made from and the result, or `null` when no estimate was ever calculated. */
  readonly preview: (FormulaPreview & { readonly estimateCode: string }) | null;
}

export interface SampleRowsView {
  /** The latest calculated estimate, or `null` while none exists. */
  readonly estimate: { readonly code: string } | null;
  readonly rows: ReadonlyArray<{ readonly id: string; readonly slNo: string; readonly name: string }>;
  /**
   * The names of the fixed operands a formula may use (the Material Master values and the exchange rates), for the editor's suggestions. They are sent and not written in the browser's code, so no script of the
   * portal carries an operand name (STORY-08.01 AC-5).
   */
  readonly operandNames: ReadonlyArray<string>;
}

export interface SaveFormulaRequest {
  readonly text: string;
  readonly password: string;
  /** The number of the configuration version the editor was opened on. */
  readonly baseVersion: number;
}

export interface SaveFormulaResult {
  /** The number of the version that holds the formula now: the new one, or the current one when nothing changed. */
  readonly version: number;
  /** False when the text was the saved one already and nothing was written. */
  readonly changed: boolean;
  readonly message: string;
}

export interface ConfigEditService {
  /** `POST /config/formula-check`. 422 with the SCR-18 sentence for a formula that cannot be saved; the valid answer with the preview otherwise. */
  checkFormula(caller: ConfigEditCaller, request: FormulaCheckRequest): Promise<FormulaCheckView>;
  /** `GET /config/sample-rows`. */
  listSampleRows(caller: ConfigEditCaller): Promise<SampleRowsView>;
  /** `PUT /config/fields/{id}/formula`. */
  saveFormula(caller: ConfigEditCaller, fieldId: string, request: SaveFormulaRequest): Promise<SaveFormulaResult>;
}

export interface ConfigEditDependencies {
  readonly configurations: ConfigRepository;
  /** The Process Master: its rates are the names a formula may use. */
  readonly masters: Pick<MasterRepository, 'listProcessItems'>;
  readonly calculations: Pick<CalculationRepository, 'findLatestCalculation' | 'findCalculation'>;
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The parsed-version cache; the process's own when none is given (`getCurrentVersion`). Tests pass one. */
  readonly cache?: ConfigVersionCache | undefined;
}

/** The role check, first and alone: it reads nothing, so a role that may never edit learns nothing about the registry (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayEditConfiguration(caller: Pick<ConfigEditCaller['user'], 'role'>): void {
  switch (caller.role) {
    case 'ADMIN':
      return;
    case 'LEAD':
    case 'ENGINEER':
      throw new ForbiddenError();
    default:
      return assertNever(caller.role, 'role');
  }
}

/** 409 for a field with no formula to edit: a system field (AC-6). */
export const SYSTEM_FIELD_CODE = 'SYSTEM_FIELD';

const LABEL_FIELD = 'text';

function refused(message: string): FieldValidationError {
  return new FieldValidationError([{ field: LABEL_FIELD, message }]);
}

/** The latest calculation's rows, kept by calculation ID: a calculation never changes, so an entry is never stale, and a typing Admin makes one check per pause. */
interface SampleCache {
  id: string;
  record: CalculationRecord;
  code: string;
}

export function createConfigEditService({ configurations, masters, calculations, stepUp, transactions, audit, cache }: ConfigEditDependencies): ConfigEditService {
  let sample: SampleCache | undefined;

  const rateReferences = async () => (await masters.listProcessItems()).map(({ id, name }) => ({ id, name }));

  /** The field to edit in the current version, or the 404 and 409 of a field that is none or has no formula. */
  function editableField(document: ConfigDocument, fieldId: string) {
    const field = findFieldById(document, fieldId);
    if (field === undefined) throw new NotFoundError();
    if (!isFormulaField(field)) throw new ConflictError(NO_FORMULA_FIELD_MESSAGE, { code: SYSTEM_FIELD_CODE });
    return field;
  }

  async function latestSample(): Promise<SampleCache | null> {
    const latest = await calculations.findLatestCalculation();
    if (latest === null) return null;
    if (sample?.id === latest.id) return sample;
    const record = await calculations.findCalculation(latest.id);
    if (record === null) return null;
    sample = { id: latest.id, record, code: latest.taskCode };
    return sample;
  }

  const previewRowOf = (row: CalculationRecord['rows'][number]): PreviewRow => ({ nodeId: row.nodeId, slNo: row.slNo, inputs: row.inputs, outputs: row.outputs });

  return {
    async checkFormula(caller, request) {
      assertMayEditConfiguration(caller.user);
      const version = await getCurrentVersion(configurations, cache);
      const field = editableField(version.document, request.fieldId);
      const rates = await rateReferences();
      const checked = checkFormulaEdit({ document: version.document, rates, fieldId: field.id, text: request.text });
      if (!checked.ok) throw refused(checked.message);

      const found = await latestSample();
      let preview: FormulaCheckView['preview'] = null;
      if (found !== null) {
        const rows = found.record.rows.map(previewRowOf);
        const chosen = rows.find((row) => row.nodeId === request.sampleRowId) ?? rows[0] ?? null;
        const product = found.record.productValues;
        const tried = previewFormula({
          document: checked.edited,
          rates,
          fieldId: field.id,
          expression: checked.expression,
          snapshot: found.record.masterSnapshot,
          product,
          rows,
          row: field.rowScope === 'product' ? null : chosen,
        });
        preview = { ...tried, estimateCode: found.code };
      }
      return { valid: true, message: checked.message, uses: checked.uses, feeds: checked.feeds, preview };
    },

    async listSampleRows(caller) {
      assertMayEditConfiguration(caller.user);
      const operandNames = fixedOperands().map(({ name }) => name);
      const found = await latestSample();
      if (found === null) return { estimate: null, rows: [], operandNames };
      const { document } = await getCurrentVersion(configurations, cache);
      return {
        estimate: { code: found.code },
        rows: found.record.rows.map((row) => ({ id: row.nodeId, slNo: row.slNo, name: partNameOf(document, row.inputs) })),
        operandNames,
      };
    },

    async saveFormula(caller, fieldId, request) {
      assertMayEditConfiguration(caller.user);
      const version = await getCurrentVersion(configurations, cache);
      const field = editableField(version.document, fieldId);
      if (request.baseVersion !== version.number) throw new ConfigVersionChangedError(version.number, versionChangedMessage(version.number));

      const rates = await rateReferences();
      const checked = checkFormulaEdit({ document: version.document, rates, fieldId, text: request.text });
      if (!checked.ok) throw refused(checked.message);
      // The one decision on "edit to its own text": the stored formula is the same, so there is nothing to protect and nothing to record.
      if (checked.internalForm === field.formula) return { version: version.number, changed: false, message: UNCHANGED_MESSAGE };

      let document: ConfigDocument;
      try {
        document = parseConfigDocument(checked.edited);
      } catch (error) {
        // The registry's own rules refuse the result: a rule of the schema or of the document, never a thing the Admin typed that the check missed. The words hold no value.
        if (error instanceof ConfigDocumentError) throw refused('The field registry would not be valid with this formula, so it was not saved.');
        throw error;
      }

      // The password, after every check that can fail on the formula and before anything is written: a wrong password costs one of five attempts, a slip in the formula costs none (AC-4).
      await stepUp.verifyStepUp(caller, request.password);

      const letter = fieldLetter(field);
      const before = toDisplayForm(field.formula, referenceContext(version.document, rates));
      return await transactions.run(async (tx) => {
        const stored = await configurations.insertVersionAfter(
          { baseNumber: version.number, snapshot: document, reason: `Formula of ${letter} ${field.label} changed`, createdBy: caller.user.id },
          tx,
        );
        if (stored === null) {
          const latest = await configurations.findLatestRef(tx);
          throw new ConfigVersionChangedError(latest?.number ?? version.number, versionChangedMessage(latest?.number ?? version.number));
        }
        await audit.record(tx, {
          event: 'config.formula_changed',
          actorId: caller.user.id,
          actorLabel: caller.user.name,
          requestId: caller.requestId,
          object: { id: field.id, label: `${letter} ${field.label}` },
          before: { formula: before },
          after: { formula: request.text, version: stored.number },
        });
        return { version: stored.number, changed: true, message: savedMessage(stored.number) };
      });
    },
  };
}
