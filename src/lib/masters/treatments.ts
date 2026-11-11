import { nameProblem, PROCESS_ITEM_NAME_MAX_LENGTH } from './process-items';

/**
 * What the Treatment / Color tab of SCR-13 (STORY-02.05; SPEC section 4.5, architecture sections 4.9, 5.1 and 6) and its routes share: the
 * limit, the words, and the one check of a typed name. Pure and without zod, so the page does not carry them (NFR-009) and a client component
 * may import it. The server states the same rules again in `src/server/views/schemas/treatments.ts`, which imports the limit and the words from
 * here, so a limit or a sentence is written once.
 *
 * The names the system keeps for itself are checked on the server only (`treatment-service.ts`): the screen never lists them, and a name that
 * is refused is answered with a sentence that does not name the hidden entry (architecture section 4.9).
 */

/** The longest treatment name. The same limit as a rate's name (SCR-11). */
export const TREATMENT_NAME_MAX_LENGTH = PROCESS_ITEM_NAME_MAX_LENGTH;

/** The sentence of AC-2 for a name that another treatment already has, ignoring letter case. */
export const TREATMENT_NAME_TAKEN_MESSAGE = 'A treatment with this name already exists.';
/** The sentence of AC-2 for a name the system keeps: it names neither "Other" nor the hidden entry. */
export const TREATMENT_NAME_RESERVED_MESSAGE = 'That name cannot be used.';
/** The refusal of a change or a delete of the locked "Other" entry (AC-3). */
export const TREATMENT_LOCKED_MESSAGE = 'This entry is always offered and cannot be renamed or deleted.';
export const NOTHING_TO_CHANGE_TREATMENT_MESSAGE = 'Change the name.';

/** What a treatment holds, as the screen and the routes carry it. */
export interface TreatmentValues {
  readonly name: string;
}

/** The part of it a request asks to set. */
export interface TreatmentFields {
  readonly name?: string | undefined;
}

export type TreatmentFieldName = keyof TreatmentValues;

/** The fields in the order the form draws them, so focus goes to the first one with a message. */
export const TREATMENT_FIELD_NAMES: ReadonlyArray<TreatmentFieldName> = ['name'];

export type TreatmentErrors = Readonly<Partial<Record<TreatmentFieldName, string>>>;

/**
 * The one form in which a name is stored and compared (QLT-01): compatibility forms folded (full-width letters become ordinary ones), surrounding spaces
 * removed, and every run of white space made one space. The server applies it; the unique index then compares names ignoring letter case only.
 */
export function canonicalTreatmentName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/** The message for the name field, or null. Only the shape is checked here; whether a name is free or kept by the system is the server's. */
export function treatmentNameProblem(value: string): string | null {
  return nameProblem(value);
}

/** The messages under the fields of the form, or none. */
export function treatmentFormProblems(values: TreatmentValues): TreatmentErrors {
  const name = treatmentNameProblem(values.name);
  return name === null ? {} : { name };
}

/**
 * What really changes when `wanted` is applied to a treatment: the name, when it is given and differs as written (so a change of letter case
 * counts). An empty result is a rename that changes nothing, which writes no entry on the server and sends no request from the screen. The one
 * rule of both.
 */
export function treatmentChangesFrom(before: TreatmentValues, wanted: TreatmentFields): TreatmentFields {
  return wanted.name !== undefined && wanted.name !== before.name ? { name: wanted.name } : {};
}

/** A new treatment starts empty; a rename starts from the treatment's own name. */
export function initialTreatmentValues(original: TreatmentValues | null): TreatmentValues {
  return { name: original === null ? '' : original.name };
}

/** What the person changed in a rename; an empty object for nothing. Spaces around the name do not count. */
export function treatmentEditChanges(original: TreatmentValues, values: TreatmentValues): TreatmentFields {
  return treatmentChangesFrom(original, { name: values.name.trim() });
}

/** The body of an add: the name trimmed. */
export function newTreatmentBody(values: TreatmentValues): TreatmentValues {
  return { name: values.name.trim() };
}

/** The errors without the one for `field`, once the person has changed that field. */
export function withoutTreatmentError(errors: TreatmentErrors, field: TreatmentFieldName): TreatmentErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}
