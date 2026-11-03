import { indexToColumnLetter } from '../columns';

import type { FieldDefinition, SectionDefinition, StageDefinition } from './field-schema';
import type { ReferenceContext, RateReference } from './formula-references';
import type { ConfigDocument } from './schema';
import type { SystemRole } from './types';

/**
 * Read-only helpers over a validated configuration document. Letters are always derived here, from
 * position (FR-021); nothing stores or caches one.
 */

/** The letter of a field in this document, e.g. "BO". */
export function fieldLetter(field: Pick<FieldDefinition, 'position'>): string {
  return indexToColumnLetter(field.position);
}

/** Lookups built once per document (PRF-04), so a per-row caller pays O(1), not a scan of every field. */
interface DocumentIndex {
  readonly byId: ReadonlyMap<string, FieldDefinition>;
  readonly byKey: ReadonlyMap<string, FieldDefinition>;
  readonly byRole: ReadonlyMap<SystemRole, FieldDefinition>;
  /** Field IDs in position order, shared by every `referenceContext` of this document. */
  readonly fieldIds: ReadonlyArray<string>;
}

/**
 * One index per document object. A document is immutable (a stored version, deep-frozen in the version
 * cache, or the frozen seed), so an index never goes stale. Do not edit a document after reading it
 * through these helpers: build a new one with the edit applied and parse that.
 */
const indexes = new WeakMap<ConfigDocument, DocumentIndex>();

function indexOf(document: ConfigDocument): DocumentIndex {
  const existing = indexes.get(document);
  if (existing !== undefined) return existing;
  const byRole = new Map<SystemRole, FieldDefinition>();
  for (const field of document.fields) {
    if (field.systemRole !== null) byRole.set(field.systemRole, field);
  }
  const index: DocumentIndex = {
    byId: new Map(document.fields.map((field) => [field.id, field])),
    byKey: new Map(document.fields.map((field) => [field.key, field])),
    byRole,
    fieldIds: document.fields.map((field) => field.id),
  };
  indexes.set(document, index);
  return index;
}

/** The field with this ID, or `undefined` if the document has none. */
export function findFieldById(document: ConfigDocument, id: string): FieldDefinition | undefined {
  return indexOf(document).byId.get(id);
}

/** The field with this key, or `undefined` if the document has none. */
export function findFieldByKey(document: ConfigDocument, key: string): FieldDefinition | undefined {
  return indexOf(document).byKey.get(key);
}

/** The one field that carries a system role. The schema guarantees there is exactly one. */
export function findSystemField(document: ConfigDocument, role: SystemRole): FieldDefinition | undefined {
  return indexOf(document).byRole.get(role);
}

/** Fields of a section, in the order of the Engineer's form (`formOrder`), then by position. */
export function fieldsInFormOrder(document: ConfigDocument, section: SectionDefinition): FieldDefinition[] {
  return document.fields
    .filter((field) => field.sectionId === section.id)
    .sort((a, b) => (a.formOrder ?? Number.MAX_SAFE_INTEGER) - (b.formOrder ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
}

/** The fields placed in a stage, in position order. */
export function fieldsInStage(document: ConfigDocument, stage: StageDefinition): FieldDefinition[] {
  return document.fields.filter((field) => field.stageId === stage.id);
}

/** What `toInternalForm` and `toDisplayForm` need from a document, plus the Process Master rates. */
export function referenceContext(document: ConfigDocument, rates: ReadonlyArray<RateReference>): ReferenceContext {
  return { fieldIds: indexOf(document).fieldIds, rates };
}

/** Two letters are written as a list, three or more in a row as a range: positions E, F, J, K, L, N give "E, F, J–L, N". */
const MIN_RUN_FOR_RANGE = 3;
const EN_DASH = '–';

/**
 * The column tag of a card or section header, derived from the positions of its fields (SPEC section 7.1;
 * architecture section 4.5). Pass only the fields the viewer sees, so the tag differs per role.
 */
export function formatColumnRange(positions: ReadonlyArray<number>): string {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  const parts: string[] = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (sorted[end + 1] === (sorted[end] ?? 0) + 1) end += 1;
    const run = sorted.slice(index, end + 1);
    if (run.length >= MIN_RUN_FOR_RANGE) {
      parts.push(`${indexToColumnLetter(run[0] ?? 1)}${EN_DASH}${indexToColumnLetter(run[run.length - 1] ?? 1)}`);
    } else {
      parts.push(...run.map(indexToColumnLetter));
    }
    index = end + 1;
  }
  return parts.join(', ');
}

/** The range tag of a section, from its fields. */
export function sectionColumnRange(
  document: ConfigDocument,
  section: SectionDefinition,
  isShown: (field: FieldDefinition) => boolean = () => true,
): string {
  return formatColumnRange(
    document.fields.filter((field) => field.sectionId === section.id && isShown(field)).map((field) => field.position),
  );
}

/** The rule of a field's `visibleWhen` as a Lead reads it, e.g. `S not in ['None','']`. */
export function describeVisibleWhen(document: ConfigDocument, field: FieldDefinition): string | null {
  if (field.kind !== 'input' || field.visibleWhen === null) return null;
  const watched = findFieldById(document, field.visibleWhen.fieldId);
  if (watched === undefined) return null;
  const values = field.visibleWhen.values.map((value) => `'${value}'`).join(',');
  return `${fieldLetter(watched)} not in [${values}]`;
}
