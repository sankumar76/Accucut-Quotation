import type { FormField } from './form-client';
import { readTyped } from './form-values';

/**
 * What to do when the server refuses a save because the part moved on since the person looked (409, a stale revision; STORY-05.08 AC-5, AC-6). It is never an overwrite and never drops what was
 * typed, so each field is judged by two questions asked of the text on screen (`typed`), what the screen last held (`held`) and what the part holds now (`fresh`):
 *
 * - **Did the person change it?** Their text, read by the field's rule, is not what was held.
 * - **Did the other side change it?** What the part holds now is not what was held.
 *
 * Only the person: the part is sent again with the new revision (the server stores only the keys a save names, so nobody else's value is touched). Only the other side: the screen takes the newer
 * value. Both, to the same value: nothing to do. Both, to different values: a conflict, where the person's text stays on screen and the newer value is offered against it. A value the person typed that
 * the rule cannot read keeps its message and is left as it is. Pure: no request, no state.
 */

type PlannedField = Pick<FormField, 'id' | 'rule' | 'defaultValue' | 'editable'>;
type Texts = Readonly<Record<string, string>>;

export interface NewerPartInput {
  readonly fields: ReadonlyArray<PlannedField>;
  /** The text of every field on screen, by field ID: the person's own. A field that was never typed into and holds nothing has no entry. */
  readonly typed: Texts;
  /** What the server held when the screen last had it. */
  readonly held: Texts;
  /** What the server holds now. */
  readonly fresh: Texts;
}

export interface FieldConflict {
  readonly fieldId: string;
  /** The text the part holds now, blank when the other side cleared it. */
  readonly newer: string;
}

export interface NewerPartPlan {
  /** Fields only the person changed: send again with the new revision. */
  readonly resend: ReadonlyArray<string>;
  /** Fields both sides changed to different values: the person's text stays, and the newer one is offered. */
  readonly conflicts: ReadonlyArray<FieldConflict>;
  /** Fields only the other side changed: show these texts (blank where it was cleared). */
  readonly adopt: Texts;
}

/** A stored text as the form compares it: read by the field's rule, and the field's default standing in for nothing (a blank over "None" is "None"). */
function normalised(field: PlannedField, text: string | undefined): string | null {
  const read = readTyped(field.rule, text ?? '');
  const value = read.ok ? read.value : (text ?? null);
  return value ?? field.defaultValue;
}

export function planAfterNewerPart({ fields, typed, held, fresh }: NewerPartInput): NewerPartPlan {
  const resend: string[] = [];
  const conflicts: FieldConflict[] = [];
  const adopt: Record<string, string> = {};
  for (const field of fields) {
    if (!field.editable || field.rule.type === 'derived' || field.rule.type === 'picture') continue;
    // A text the rule cannot read is the person's own and keeps its message: it was never sent, so it is neither compared nor replaced.
    if (!readTyped(field.rule, typed[field.id] ?? '').ok) continue;
    const mine = normalised(field, typed[field.id]);
    const before = normalised(field, held[field.id]);
    const now = normalised(field, fresh[field.id]);
    const changedByMe = mine !== before;
    const changedByOther = now !== before;
    if (changedByMe && !changedByOther) resend.push(field.id);
    else if (changedByMe && mine !== now) conflicts.push({ fieldId: field.id, newer: fresh[field.id] ?? '' });
    else if (!changedByMe && changedByOther) adopt[field.id] = fresh[field.id] ?? '';
  }
  return { resend, conflicts, adopt };
}
