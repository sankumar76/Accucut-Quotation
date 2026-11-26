import { ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { readChoiceInput } from '../../lib/estimate/choice-value';
import { buildFormSections, formFieldById, type FormFieldView, type FormSectionView } from '../../lib/estimate/form-fields';
import { hiddenFieldIds, storedValueOf, zeroHiddenNumbers } from '../../lib/estimate/hidden-inputs';
import { createCompletenessReader } from '../../lib/estimate/part-completeness';
import type { Completeness } from '../../lib/estimate/part-view';
import { CHOOSE_TREATMENT_MESSAGE, decodeTreatment, encodeTreatment, isOtherTreatment, readFlagInput, readTreatmentInput, treatmentChoiceOf, type TreatmentChoice } from '../../lib/estimate/treatment-value';
import { validateNumberInput, validateTextInput } from '../../lib/estimate/validation';
import type { ConfigDocument } from '../../lib/fields/schema';
import { OTHER_TREATMENT_ID } from '../../lib/masters/system-entries';
import type { EstimateNodeRepository } from '../repositories/estimate-node-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext } from './audit-service';
import type { EstimateViewer } from './estimate-service';
import type { InputChangeAudit } from './input-change-audit';

/**
 * The part form's two routes and the one rule that shapes what a part's `inputs` may hold (STORY-05.03; architecture sections 4.8, 6 "Estimate form" and "Save inputs",
 * and 8). It is the inputs half of the estimate service (`estimate-service.ts`, which builds it and hands it the estimate's lock and its own "may this person
 * open or change this estimate" rules, so the rules are written once) and is kept in its own file for the size limit of the coding standards.
 *
 * **What a part's `inputs` is.** A JSON object, by **field ID** (the registry's, a UUID), whose every value is **text**: a typed number as normalised decimal text with two
 * decimals (`"12.50"`, never a JavaScript number), a typed text trimmed, and for Material in Drawing (E) the **ID of the Material Master row** as lower-case UUID text
 * (`inputs[<ID of the field with key "material-in-drawing">] = "<materials.id>"`). A value that is cleared is not stored: its key is removed, so `{}` is a part with nothing
 * typed. Only fields of the form (`formFieldById`, `editable`) can be stored, so Material Rate (I), every calculated field, Material Considered (F), the Sl. No. (A)
 * and a field no story has built yet have no place to go; and only those are read back (`visibleInputs`). **Two values are not a number or a word of the person's**
 * (STORY-05.06; architecture section 5.1 "A treatment on an estimate"): a surface treatment (Z to AG) is `"1"` or `"0"`, and Treatment / Color (G) is stored as the object `{ "id", "text" }`
 * (it travels as that object's JSON text, `treatment-value.ts`). For a listed treatment and for "Not applicable" the server writes `text` from the row's name and ignores the text the client sent; for
 * "Other" it is the typed words, trimmed. **A choice** (STORY-08.08: an input of type `select` with the Admin's `options`) is stored as the text of its option and is 422 under the field when it is none of them. A treatment that does not exist is 422 under G, **except** the one the part already holds (it was deleted since): an unchanged G is kept as it is. There is no foreign key. **A save writes only the keys it names**: every other stored key
 * (another story's field, one the registry moved or hid) stays as it is, whatever its value, and a cleared value removes only its own key.
 *
 * **A save** (`saveInputs`) runs in one transaction, in the order of the tree routes: the estimate is locked (404 when it is not this person's), this person must still
 * be allowed to change its inputs (409, `assertEditable`), the part must be in it (404), the part's `revision` must be the one the person saw (409), and then the
 * values are read (422, every problem at once, nothing stored). A save with no real change after normalisation writes nothing and raises neither revision; a real change
 * raises the **part's** revision (so a delete confirmed for the part as it was is refused, review SQR-01 (b)) and the estimate's `inputs_revision` (section 4.8), in the same
 * transaction. The material is read `FOR SHARE` in it, so a material being deleted waits for the part that names it.
 *
 * **A hidden field** (STORY-05.05; FR-048, SPEC section 14.4): a field the registry's `visibleWhen` hides for the part as the save leaves it (Fasteners Qty and Cost while Fasteners is "None" or
 * blank) takes no value from a save, and a number of it that the part holds is stored as `0.00` in the same write (`hidden-inputs.ts`; the rule is `isFieldShown`, the one copy). Every answer
 * reads a hidden number as `0.00` whatever is stored, so a value typed before the rule hid it is never sent back (A-03). A hidden number that holds nothing stays without a key: a part with nothing
 * typed is `{}` and `EMPTY`, and every reader (Calculate, the answers) reads an absent number as 0.
 */

/** The `code` of the 409 of a save for a part that changed since the person looked. */
export const PART_CHANGED_CODE = 'PART_CHANGED';
export const PART_CHANGED_MESSAGE = 'This part was changed by someone else. It has been reloaded. Check it and try again.';
/** One message for a field that is unknown, Restricted, derived or not built yet, so the answer does not tell them apart. */
export const FIELD_NOT_SAVABLE_MESSAGE = 'This field cannot be saved.';
export const CHOOSE_MATERIAL_MESSAGE = 'Choose a material from the list.';

/** What a save stores for one field: the text of a number, a text, a material or a flag, the `{ id, text }` of Treatment / Color, or `null` to clear it. */
type StoredValue = string | TreatmentChoice | null;
type SaveCheck = { readonly ok: true; readonly value: StoredValue } | { readonly ok: false; readonly message: string };

/** Two stored values are the same: texts as they are, a treatment by its ID and its words (a stored object's keys may come back in another order). */
function sameValue(before: unknown, after: unknown): boolean {
  const left = treatmentChoiceOf(before);
  const right = treatmentChoiceOf(after);
  if (left !== null || right !== null) return left !== null && right !== null && left.id === right.id && left.text === right.text;
  return before === after;
}

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
   * The one lock every writer of a part's Material in Drawing must take (`lockMaterialForUse`, STORY-02.07 AC-5): the material `FOR SHARE`, after the estimate's row
   * lock, in the transaction that writes. It reads no number, and the delete of a material takes the same row `FOR UPDATE`, so the two serialise. And the one read of a treatment's
   * name (`findTreatmentOptionById`, STORY-05.06): an ID and a name, no lock, because a part refers to a treatment by no key.
   */
  readonly materials: Pick<MasterRepository, 'lockMaterialForUse' | 'findTreatmentOptionById' | 'listMaterialOptions' | 'findNotApplicableMaterialOption'>;
  /** The field registry a save is checked against: the latest version (cached per version by `getCurrentVersion`). */
  readonly currentConfiguration: () => Promise<ConfigDocument>;
  /**
   * The registry the form of **this estimate** is built from and its stored values are read back with (STORY-08.05; FR-065, FR-077, SPEC section 8.4): the version of the current calculation for an APPROVED
   * estimate, the latest one for every other. The caller has already checked that this person may open the estimate, so nothing here is asked twice.
   */
  readonly configurationFor: (estimateId: string) => Promise<ConfigDocument>;
  readonly transactions: TransactionRunner;
  /** The estimate's ID for a read: 404 when it is not this person's or does not exist. */
  readonly openForRead: (viewer: EstimateViewer, estimateId: string) => Promise<string>;
  /** Locks the estimate for a change: 404, or 409 when this person may no longer change its inputs. Returns the estimate's ID. */
  readonly lockForChange: (viewer: EstimateViewer, estimateId: string, tx: Transaction) => Promise<string>;
  /** Raises the estimate's `inputs_revision` by one, in the caller's transaction. */
  readonly bumpInputsRevision: (estimateId: string, tx: Transaction) => Promise<void>;
  /** The trail of a Lead's or an Admin's save (DEF-131 stage 2): none for an Engineer's, and a refusal for a Lead's or an Admin's when the service has no audit. */
  readonly traces: InputChangeAudit;
}

export interface EstimateInputs {
  /** The sections of the form and the time of the last save (`GET /api/v1/estimates/{id}/form`). The same for every role. */
  getForm(viewer: EstimateViewer, estimateId: string): Promise<EstimateForm>;
  /** Saves values into a part (`PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs`). 404, 409 (not editable, or a stale revision), 422 under each field at fault. */
  saveInputs(viewer: EstimateViewer, estimateId: string, request: SaveInputsRequest, audit?: AuditContext): Promise<SavedInputs>;
  /** Of what is stored in a part of this estimate, the values of fields of its form, in the registry the form is built from (`configurationFor`): what may be sent back. */
  visibleInputs(estimateId: string, inputs: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, string>>>;
}

/**
 * The stored values that are text and belong to a field a person types or chooses: anything else is not read. **A hidden number is read as 0** (STORY-05.05 AC-5; `zeroHiddenNumbers`): a
 * Fasteners Qty or Cost stored before Fasteners became "None" is never sent back as it was typed.
 */
function typedValues(document: ConfigDocument, inputs: Readonly<Record<string, unknown>>): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(zeroHiddenNumbers(document, inputs))) {
    const field = formFieldById(document, fieldId);
    if (field?.editable !== true) continue;
    if (field.rule.type === 'treatment') {
      // Treatment / Color is the one value that is stored as an object; it is sent as that object's text (`treatment-value.ts`), and nothing else under it is read.
      const choice = treatmentChoiceOf(value);
      if (choice !== null) shown[fieldId] = encodeTreatment(choice);
    } else if (typeof value === 'string') shown[fieldId] = value;
  }
  return shown;
}

export function createEstimateInputs(dependencies: EstimateInputsDependencies): EstimateInputs {
  const { nodes, materials, currentConfiguration, configurationFor, transactions, openForRead, lockForChange, bumpInputsRevision, traces } = dependencies;

  /**
   * Treatment / Color: the shape first (`readTreatmentInput`, the browser's own rule), then the row. "Other" keeps the typed words; a listed entry and "Not applicable" take the row's name and
   * nothing the client sent; an ID with no row is refused, unless it is the one the part already holds (deleted since, so left as it was).
   */
  async function readTreatment(typed: string, stored: unknown): Promise<SaveCheck> {
    const shaped = readTreatmentInput(typed);
    if (!shaped.ok || shaped.value === null) return shaped;
    const asked = decodeTreatment(shaped.value);
    if (asked === null) return { ok: false, message: CHOOSE_TREATMENT_MESSAGE };
    if (isOtherTreatment(asked.id)) return { ok: true, value: { id: OTHER_TREATMENT_ID, text: asked.text } };
    const row = await materials.findTreatmentOptionById(asked.id);
    if (row !== null) return { ok: true, value: { id: row.id.toLowerCase(), text: row.name } };
    const kept = treatmentChoiceOf(stored);
    return kept !== null && kept.id === asked.id ? { ok: true, value: kept } : { ok: false, message: CHOOSE_TREATMENT_MESSAGE };
  }

  /** One value read by its field's rule. A material is checked in the Material Master, so this takes the transaction; `stored` is what the part holds under the field. */
  async function readValue(field: FormFieldView, typed: string, stored: unknown, tx: Transaction): Promise<SaveCheck> {
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
      case 'choice':
        // The list is the registry's, read on the server (`formFieldById`): the browser's list is not trusted. A value no longer in it is kept only when it is sent back unchanged (STORY-08.08 AC-2).
        return readChoiceInput(typed, field.rule.options, stored);
      case 'treatment':
        return readTreatment(typed, stored);
      case 'flag':
        return readFlagInput(typed);
      case 'derived':
      // A picture is changed by its own routes (STORY-05.07), never by a value in a save: the same refusal as a field that is shown and not typed.
      case 'picture':
        return { ok: false, message: FIELD_NOT_SAVABLE_MESSAGE };
    }
  }

  /** Every value read, in the order sent: the text to store for each field (`null` clears it) and every problem found, so one answer names them all. */
  async function readValues(document: ConfigDocument, values: SaveInputsRequest['values'], stored: Readonly<Record<string, unknown>>, tx: Transaction) {
    const problems: FieldProblem[] = [];
    const changes = new Map<string, StoredValue>();
    for (const [fieldId, typed] of Object.entries(values)) {
      const field = formFieldById(document, fieldId);
      const check: SaveCheck = field === undefined ? { ok: false, message: FIELD_NOT_SAVABLE_MESSAGE } : await readValue(field, typed, stored[fieldId], tx);
      if (check.ok) changes.set(fieldId, check.value);
      else problems.push({ field: fieldId, message: check.message });
    }
    return { problems, changes };
  }

  return {
    async getForm(viewer, estimateId) {
      const id = await openForRead(viewer, estimateId);
      const [document, written] = await Promise.all([configurationFor(id), nodes.lastWrittenAt(id)]);
      return { sections: buildFormSections(document), lastSavedAt: written === null ? null : written.toISOString() };
    },

    async saveInputs(viewer, estimateId, request, audit) {
      // A Lead's or an Admin's save is traced (DEF-131): asked first, so a service with no audit refuses it before anything is read or written. An Engineer's has no trace.
      const trace = traces.traceFor(viewer, audit);
      // A registry version never changes, so it is read before the transaction: it holds neither a second connection nor the estimate's lock while it is read (review SQR-03).
      const document = await currentConfiguration();
      const completenessOf = createCompletenessReader(document);
      // The names of the materials, for the entry's words, read before the transaction too, and only when this save names the material field.
      const materialNames = trace !== null && Object.keys(request.values).some((fieldId) => formFieldById(document, fieldId)?.rule.type === 'select') ? await traces.materialNames() : new Map<string, string>();
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const part = await nodes.findNode(id, request.nodeId, tx);
        if (part === null) throw new NotFoundError();
        if (part.revision !== request.revision) throw new ConflictError(PART_CHANGED_MESSAGE, { code: PART_CHANGED_CODE });
        const { problems, changes } = await readValues(document, request.values, part.inputs, tx);
        if (problems.length > 0) throw new FieldValidationError(problems);
        // The save changes **only the keys it names** and writes the stored object back with every other key as it was: a value of a field that is not on the form now (another
        // story's, one the registry moved or hid, a non-text value) is never read, projected or dropped here (review SQR-01). A cleared value removes only its own key.
        const applied: Record<string, unknown> = { ...part.inputs };
        for (const [fieldId, value] of changes) {
          if (value === null) delete applied[fieldId];
          else applied[fieldId] = value;
        }
        // **The rule of a hidden field is applied here, by the server** (STORY-05.05 AC-3, AC-4; SPEC section 14.4): a field the registry hides for the part as it now is (Fasteners Qty and Cost
        // while Fasteners is "None" or blank) takes no value from this save, and a number of it that the part already holds is stored as 0, even if it was typed before the rule hid it.
        const hidden = hiddenFieldIds(document, storedValueOf(document, applied));
        for (const fieldId of changes.keys()) {
          if (!hidden.has(fieldId)) continue;
          if (fieldId in part.inputs) applied[fieldId] = part.inputs[fieldId];
          else delete applied[fieldId];
        }
        const next = zeroHiddenNumbers(document, applied);
        // Nothing really changed (the same value, spelled another way, or a blank where nothing was), judged on the submitted keys that show: no write, no new revision, and no figure is cleared (section 4.8).
        // A hidden number set to 0 by the rule is part of a write that a change of a shown field makes (Fasteners becoming "None" is one), so it is a real change then and raises both revisions with it.
        const changed = [...changes.keys()].some((fieldId) => !hidden.has(fieldId) && !sameValue(part.inputs[fieldId] ?? null, next[fieldId] ?? null));
        if (!changed) {
          return { id: part.id, revision: part.revision, completeness: completenessOf(part.inputs), inputs: typedValues(document, part.inputs) };
        }
        // The write is conditional on the revision that was read, so a writer that skipped the estimate's lock is a 409 here and not a lost update (review SQR-02).
        const saved = await nodes.saveInputs(id, part.id, part.revision, next, tx);
        if (saved === null) throw new ConflictError(PART_CHANGED_MESSAGE, { code: PART_CHANGED_CODE });
        await bumpInputsRevision(id, tx);
        // The entry of a Lead's or an Admin's change, in this transaction: if it cannot be written, the save is rolled back with it.
        await trace?.inputsChanged(tx, { estimateId: id, document, before: part, after: saved, materialNames });
        return { id: saved.id, revision: saved.revision, completeness: completenessOf(saved.inputs), inputs: typedValues(document, saved.inputs) };
      });
    },

    async visibleInputs(estimateId, inputs) {
      return typedValues(await configurationFor(estimateId), inputs);
    },
  };
}
