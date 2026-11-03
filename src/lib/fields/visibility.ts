import type { FieldDefinition } from './field-schema';
import { MATERIAL_CONSIDERED_KEY } from './types';

/**
 * Who may see a field, and when it shows (SPEC sections 7.1 and 7.3; ADR-008; architecture section 4.5).
 *
 * `engineerVisible` is an allow-list. An Engineer's response is built from the fields it marks, so a
 * wrong flag leaks a cost (ARCH-R2). The schema therefore refuses it everywhere it must not be true.
 */

/**
 * True when `engineerVisible: true` is allowed on this field: every input, and Material Considered (F).
 * Not Material Rate (I), which carries a price, and not the exchange-rate fields (BH, BI), which are
 * outputs. Outputs are never visible to an Engineer.
 */
export function isEngineerVisibleAllowed(field: Pick<FieldDefinition, 'kind' | 'key'>): boolean {
  return field.kind === 'input' || (field.kind === 'auto' && field.key === MATERIAL_CONSIDERED_KEY);
}

/** The fields an Engineer may be shown, in registry order. */
export function engineerVisibleFields(fields: ReadonlyArray<FieldDefinition>): FieldDefinition[] {
  return fields.filter((field) => field.engineerVisible);
}

/**
 * Whether a field shows, given the current value of the field its rule watches. A field with no rule
 * always shows. A blank or absent watched value counts as `''`, so Fasteners Qty (T) and Fasteners Cost
 * (U) are hidden while Fasteners (S) is blank as well as while it is "None".
 */
export function isFieldShown(field: FieldDefinition, valueOf: (fieldId: string) => string | undefined): boolean {
  if (field.kind !== 'input' || field.visibleWhen === null) return true;
  const watched = valueOf(field.visibleWhen.fieldId) ?? '';
  return !field.visibleWhen.values.includes(watched);
}
