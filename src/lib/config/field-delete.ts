import { fieldLetter, findFieldById, referenceContext } from '../fields/registry';
import { isProtectedField } from '../fields/protected';
import { ConfigDocumentError, parseConfigDocument, type ConfigDocument } from '../fields/schema';
import type { FieldKind } from '../fields/types';
import { extractReferences, toDisplayForm, type RateReference } from '../formula';

import { describeLetterChanges, type LetterChanges } from './field-insert-changes';
import type { FieldUse, FormulaFieldUse, RuleFieldUse, StageTotalUse } from '../fields/uses';

/**
 * Deleting a field from the registry (STORY-08.04; FR-075, FR-076, FR-077; BR-035; SPEC sections 8.3 "Delete field" and "Automatic re-lettering" and 14 item 7; ADR-004; architecture sections 4.5 and 6 "Delete
 * field"). Pure: the current document and the rate list go in, and the next document, the letter changes and what was deleted come out; nothing is stored, logged or read from a clock. The insert's twin
 * (`field-insert.ts`): re-lettering is positions only, so no stored formula is rewritten, because a formula holds the stable ID of each field it reads (BR-035), and the product's cells move with their columns.
 *
 * **A field is deleted only when nothing uses it** (FR-076). A use is any of the four references architecture section 4.5 names: a formula that holds a reference to the field by its stable ID (found in internal form, never by display
 * letter, and including a field read through `SUM(column)`), a `hideWhenZero` rule, a `visibleWhen` rule and a stage total. The order of the answers is the order of the cheapest refusal first: no such field,
 * a protected field, a field in use; only then is the document made. `parseConfigDocument` is the last gate, as it is for every other change of the registry.
 */

/** What the Admin is told was deleted: the column as it was, and its formula in display form (an input has none). Kept in the audit entry (AC-8). */
export interface DeletedColumn {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly formula: string | null;
}

export type DeleteResult =
  | { readonly ok: false; readonly reason: 'not-found' | 'protected' | 'invalid' }
  | { readonly ok: false; readonly reason: 'in-use'; readonly uses: ReadonlyArray<FieldUse> }
  | {
      readonly ok: true;
      /** The next document, already through the registry's own schema and rules (`parseConfigDocument`, the last gate). */
      readonly document: ConfigDocument;
      readonly deleted: DeletedColumn;
      /** Every column after the deleted one with the letter it had and the letter it has now, and the product's cells. Nothing is inserted. */
      readonly changes: LetterChanges;
    };

export interface DeleteRequest {
  readonly document: ConfigDocument;
  /** The Process Master's rates: the names a formula shows in place of a stored rate reference. */
  readonly rates: ReadonlyArray<RateReference>;
  readonly fieldId: string;
}

/** A formula reads the field when one of its references is the field, read plainly or through `SUM(column)`. */
function readsField(formula: string, fieldId: string): boolean {
  return extractReferences(formula).some((reference) => reference.kind === 'field' && reference.id === fieldId);
}

/**
 * Everything that uses the field, in the order the dialog lists it: the formulas first, in column order, each with its text as the Admin reads it; then the rules of hide-when-zero and visibility, in column
 * order; then the stage totals, in stage order. A field is never counted as using itself. An ID that is no field of the document is used by nothing.
 */
export function fieldUses(document: ConfigDocument, rates: ReadonlyArray<RateReference>, fieldId: string): FieldUse[] {
  const context = referenceContext(document, rates);
  const formulas: FormulaFieldUse[] = [];
  const rules: RuleFieldUse[] = [];
  for (const field of document.fields) {
    if (field.id === fieldId) continue;
    if (field.kind === 'output' && field.formula !== null && readsField(field.formula, fieldId)) {
      formulas.push({ kind: 'formula', fieldId: field.id, letter: fieldLetter(field), label: field.label, formula: toDisplayForm(field.formula, context) });
    }
    if (field.kind === 'output' && field.hideWhenZero === fieldId) rules.push({ kind: 'hide-when-zero', fieldId: field.id, letter: fieldLetter(field), label: field.label });
    if (field.kind === 'input' && field.visibleWhen?.fieldId === fieldId) rules.push({ kind: 'visibility-rule', fieldId: field.id, letter: fieldLetter(field), label: field.label });
  }
  const totals: StageTotalUse[] = document.stages
    .filter((stage) => stage.totalFieldIds.includes(fieldId))
    .sort((a, b) => a.number - b.number)
    .map((stage) => ({ kind: 'stage-total', stageId: stage.id, number: stage.number, name: stage.name }));
  return [...formulas, ...rules, ...totals];
}

/**
 * Removes the field, or says why not. Every field after it moves one place down (`position` is renumbered 1 to N), every other property of every field is as it was, and the answer lists the columns whose
 * letter changed, so the preview, the audit entry and the success words are made from the same facts the save stores.
 */
export function deleteField({ document, rates, fieldId }: DeleteRequest): DeleteResult {
  const field = findFieldById(document, fieldId);
  if (field === undefined) return { ok: false, reason: 'not-found' };
  if (isProtectedField(field)) return { ok: false, reason: 'protected' };
  const uses = fieldUses(document, rates, fieldId);
  if (uses.length > 0) return { ok: false, reason: 'in-use', uses };

  const remaining = document.fields.filter((candidate) => candidate.id !== fieldId);
  let next: ConfigDocument;
  try {
    next = parseConfigDocument({ ...document, fields: remaining.map((candidate, index) => ({ ...candidate, position: index + 1 })) });
  } catch (error) {
    // The registry's own rules refuse the result: a rule of the schema or of the document, never something the checks above missed. The refusal holds no value.
    if (error instanceof ConfigDocumentError) return { ok: false, reason: 'invalid' };
    throw error;
  }
  const context = referenceContext(document, rates);
  const deleted: DeletedColumn = {
    id: field.id,
    letter: fieldLetter(field),
    label: field.label,
    kind: field.kind,
    formula: field.kind === 'output' && field.formula !== null ? toDisplayForm(field.formula, context) : null,
  };
  return { ok: true, document: next, deleted, changes: describeLetterChanges(document, remaining.map((candidate) => candidate.id), []) };
}
