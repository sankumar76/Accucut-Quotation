import { ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { buildFormSections, formFieldById, type FormFieldView, type FormSectionView } from '../../lib/estimate/form-fields';
import { completenessOf, type Completeness } from '../../lib/estimate/part-view';
import { validateNumberInput, validateTextInput, type InputCheck } from '../../lib/estimate/validation';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { EstimateNodeRepository } from '../repositories/estimate-node-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { EstimateViewer } from './estimate-service';

/**
 * The part form's two routes and the one rule that shapes what a part's `inputs` may hold (STORY-05.03; architecture sections 4.8, 6 "Estimate form" and "Save inputs",
 * and 8). It is the inputs half of the estimate service (`estimate-service.ts`, which builds it and hands it the estimate's lock and its own "may this person
 * open or change this estimate" rules, so the rules are written once) and is kept in its own file for the size limit of the coding standards.
 *
 * **What a part's `inputs` is.** A JSON object, by **field ID** (the registry's, a UUID), whose every value is **text**: a typed number as normalised decimal text with two
 * decimals (`"12.50"`, never a JavaScript number), a typed text trimmed, and for Material in Drawing (E) the **ID of the Material Master row** as lower-case UUID text
 * (`inputs[<ID of the field with key "material-in-drawing">] = "<materials.id>"`). A value that is cleared is not stored: its key is removed, so `{}` is a part with nothing
 * typed. Only fields of the form (`formFieldById`, `editable`) can be stored, so Material Rate (I), every calculated field, Material Considered (F), the Sl. No. (A)
 * and a field no story has built yet have no place to go; and only those are read back (`visibleInputs`). **A save writes only the keys it names**: every other stored key
 * (another story's field, one the registry moved or hid) stays as it is, whatever its value, and a cleared value removes only its own key.
 *
 * **A save** (`saveInputs`) runs in one transaction, in the order of the tree routes: the estimate is locked (404 when it is not this person's), this person must still
 * be allowed to change its inputs (409, `assertEditable`), the part must be in it (404), the part's `revision` must be the one the person saw (409), and then the
 * values are read (422, every problem at once, nothing stored). A save with no real change after normalisation writes nothing and raises neither revision; a real change
 * raises the **part's** revision (so a delete confirmed for the part as it was is refused, review SQR-01 (b)) and the estimate's `inputs_revision` (section 4.8), in the same
 * transaction. The material is read `FOR SHARE` in it, so a material being deleted waits for the part that names it.
 */

/** The `code` of the 409 of a save for a part that changed since the person looked. */
export const PART_CHANGED_CODE = 'PART_CHANGED';
export const PART_CHANGED_MESSAGE = 'This part was changed by someone else. It has been reloaded. Check it and try again.';
/** One message for a field that is unknown, Restricted, derived or not built yet, so the answer does not tell them apart. */
export const FIELD_NOT_SAVABLE_MESSAGE = 'This field cannot be saved.';
export const CHOOSE_MATERIAL_MESSAGE = 'Choose a material from the list.';

/** The form: its sections and when a part was last written. */
export interface EstimateForm {
  readonly sections: ReadonlyArray<FormSectionView>;
  /** ISO 8601 UTC text; null while the estimate has no part. */
  readonly lastSavedAt: string | null;
}

/** Save these values into a part, as it was when the person looked (`revision`). A blank value clears. */
export interface SaveInputsRequest {
  readonly nodeId: string;
  readonly revision: number;
  readonly values: Readonly<Record<string, string>>;
}

/** The part as it is now: its new revision, how complete it is and what is stored, by field ID. No figure. */
export interface SavedInputs {
  readonly id: string;
  readonly revision: number;
  readonly completeness: Completeness;
  readonly inputs: Readonly<Record<string, string>>;
}

export interface EstimateInputsDependencies {
  readonly nodes: EstimateNodeRepository;
  /**
   * Only the one lock every writer of a part's Material in Drawing must take (`lockMaterialForUse`, STORY-02.07 AC-5): the material `FOR SHARE`, after the estimate's row
   * lock, in the transaction that writes. It reads no number, and the delete of a material takes the same row `FOR UPDATE`, so the two serialise.
   */
  readonly materials: Pick<MasterRepository, 'lockMaterialForUse'>;
  /** The field registry the form is built from (the current version, cached per version by `getCurrentVersion`). */
  readonly currentConfiguration: () => Promise<ConfigDocument>;
  readonly transactions: TransactionRunner;
  /** The estimate's ID for a read: 404 when it is not this person's or does not exist. */
  readonly openForRead: (viewer: EstimateViewer, estimateId: string) => Promise<string>;
  /** Locks the estimate for a change: 404, or 409 when this person may no longer change its inputs. Returns the estimate's ID. */
  readonly lockForChange: (viewer: EstimateViewer, estimateId: string, tx: Transaction) => Promise<string>;
  /** Raises the estimate's `inputs_revision` by one, in the caller's transaction. */
  readonly bumpInputsRevision: (estimateId: string, tx: Transaction) => Promise<void>;
}

export interface EstimateInputs {
  /** The sections of the form and the time of the last save (`GET /api/v1/estimates/{id}/form`). The same for every role. */
  getForm(viewer: EstimateViewer, estimateId: string): Promise<EstimateForm>;
  /** Saves values into a part (`PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs`). 404, 409 (not editable, or a stale revision), 422 under each field at fault. */
  saveInputs(viewer: EstimateViewer, estimateId: string, request: SaveInputsRequest): Promise<SavedInputs>;
  /** Of what is stored in a part, the values of fields of the form, in the registry as it is now: what may be sent back. */
  visibleInputs(inputs: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, string>>>;
}

/** The stored values that are text and belong to a field a person types or chooses: anything else is not read. */
function typedValues(document: ConfigDocument, inputs: Readonly<Record<string, unknown>>): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(inputs)) {
    if (typeof value === 'string' && formFieldById(document, fieldId)?.editable === true) shown[fieldId] = value;
  }
  return shown;
}

export function createEstimateInputs(dependencies: EstimateInputsDependencies): EstimateInputs {
  const { nodes, materials, currentConfiguration, transactions, openForRead, lockForChange, bumpInputsRevision } = dependencies;

  /** One value read by its field's rule. A material is checked in the Material Master, so this takes the transaction. */
  async function readValue(field: FormFieldView, typed: string, tx: Transaction): Promise<InputCheck> {
    switch (field.rule.type) {
      case 'number':
        return validateNumberInput(typed);
      case 'text':
        return validateTextInput(typed, { multiline: field.rule.multiline, maxLength: field.rule.maxLength });
      case 'select': {
        const id = typed.trim().toLowerCase();
        if (id === '') return { ok: true, value: null };
        // A form has one material field, so one material is locked per save. A later story that lets a save name more than one must lock them in ascending ID, so two
        // saves cannot wait on each other's material.
        return (await materials.lockMaterialForUse(id, tx)) ? { ok: true, value: id } : { ok: false, message: CHOOSE_MATERIAL_MESSAGE };
      }
      case 'derived':
        return { ok: false, message: FIELD_NOT_SAVABLE_MESSAGE };
    }
  }

  /** Every value read, in the order sent: the text to store for each field (`null` clears it) and every problem found, so one answer names them all. */
  async function readValues(document: ConfigDocument, values: SaveInputsRequest['values'], tx: Transaction) {
    const problems: FieldProblem[] = [];
    const changes = new Map<string, string | null>();
    for (const [fieldId, typed] of Object.entries(values)) {
      const field = formFieldById(document, fieldId);
      const check: InputCheck = field === undefined ? { ok: false, message: FIELD_NOT_SAVABLE_MESSAGE } : await readValue(field, typed, tx);
      if (check.ok) changes.set(fieldId, check.value);
      else problems.push({ field: fieldId, message: check.message });
    }
    return { problems, changes };
  }

  return {
    async getForm(viewer, estimateId) {
      const id = await openForRead(viewer, estimateId);
      const [document, written] = await Promise.all([currentConfiguration(), nodes.lastWrittenAt(id)]);
      return { sections: buildFormSections(document), lastSavedAt: written === null ? null : written.toISOString() };
    },

    async saveInputs(viewer, estimateId, request) {
      // A registry version never changes, so it is read before the transaction: it holds neither a second connection nor the estimate's lock while it is read (review SQR-03).
      const document = await currentConfiguration();
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const part = await nodes.findNode(id, request.nodeId, tx);
        if (part === null) throw new NotFoundError();
        if (part.revision !== request.revision) throw new ConflictError(PART_CHANGED_MESSAGE, { code: PART_CHANGED_CODE });
        const { problems, changes } = await readValues(document, request.values, tx);
        if (problems.length > 0) throw new FieldValidationError(problems);
        // The save changes **only the keys it names** and writes the stored object back with every other key as it was: a value of a field that is not on the form now (another
        // story's, one the registry moved or hid, a non-text value) is never read, projected or dropped here (review SQR-01). A cleared value removes only its own key.
        const next: Record<string, unknown> = { ...part.inputs };
        for (const [fieldId, value] of changes) {
          if (value === null) delete next[fieldId];
          else next[fieldId] = value;
        }
        // Nothing really changed (the same value, spelled another way, or a blank where nothing was), judged on the submitted keys only: no write, no new revision, and no figure is cleared (section 4.8).
        const changed = [...changes.keys()].some((fieldId) => (part.inputs[fieldId] ?? null) !== (next[fieldId] ?? null));
        if (!changed) {
          const unchanged = typedValues(document, part.inputs);
          return { id: part.id, revision: part.revision, completeness: completenessOf(unchanged), inputs: unchanged };
        }
        // The write is conditional on the revision that was read, so a writer that skipped the estimate's lock is a 409 here and not a lost update (review SQR-02).
        const saved = await nodes.saveInputs(id, part.id, part.revision, next, tx);
        if (saved === null) throw new ConflictError(PART_CHANGED_MESSAGE, { code: PART_CHANGED_CODE });
        await bumpInputsRevision(id, tx);
        const visible = typedValues(document, saved.inputs);
        return { id: saved.id, revision: saved.revision, completeness: completenessOf(visible), inputs: visible };
      });
    },

    async visibleInputs(inputs) {
      return typedValues(await currentConfiguration(), inputs);
    },
  };
}
