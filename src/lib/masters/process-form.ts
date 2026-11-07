import {
  changesFrom,
  defaultValueProblem,
  isProcessUnit,
  nameProblem,
  normaliseDefaultValue,
  UNIT_REQUIRED_MESSAGE,
  type ProcessItemFields,
  type ProcessItemValues,
} from './process-items';

/**
 * What the add and edit form of SCR-11 holds and checks before it sends anything (STORY-02.01 AC-2, AC-3). Pure, so the rules are
 * tested without a browser and the form component only draws. Only the shape is checked here; whether a name is free or safe in a
 * formula is the server's.
 */

export interface FormValues {
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
}

export type FieldName = keyof FormValues;
export type FieldErrors = Readonly<Partial<Record<FieldName, string>>>;

/** The fields in the order they are drawn, so focus goes to the first one with a message. */
export const FIELD_NAMES: ReadonlyArray<FieldName> = ['name', 'unit', 'defaultValue'];

/** A new rate starts empty; an edit starts from the rate's own values. */
export function initialValues(original: FormValues | null): FormValues {
  return original === null ? { name: '', unit: '', defaultValue: '' } : { name: original.name, unit: original.unit, defaultValue: original.defaultValue };
}

/**
 * The message under each field that has one. In an edit the default value is checked only when it was changed (QLT-12): the column
 * holds four decimals and a value that was stored with more than two must not stop a rename until it is retyped.
 */
export function formProblems(values: FormValues, original: FormValues | null): FieldErrors {
  const found: { name?: string; unit?: string; defaultValue?: string } = {};
  const name = nameProblem(values.name);
  if (name !== null) found.name = name;
  if (!isProcessUnit(values.unit)) found.unit = UNIT_REQUIRED_MESSAGE;
  const valueUnchanged = original !== null && values.defaultValue === original.defaultValue;
  const value = valueUnchanged ? null : defaultValueProblem(values.defaultValue);
  if (value !== null) found.defaultValue = value;
  return found;
}

/** What the person changed in an edit; an empty object for nothing. Spaces around the name do not count. */
export function editChanges(original: FormValues, values: FormValues): ProcessItemFields {
  return changesFrom(original, { name: values.name.trim(), unit: values.unit, defaultValue: values.defaultValue });
}

/** The body of an add: the name trimmed and the value as stored text. */
export function newRateBody(values: FormValues): ProcessItemValues {
  return { name: values.name.trim(), unit: values.unit, defaultValue: normaliseDefaultValue(values.defaultValue) };
}

/** The errors without the one for `field`, once the person has changed that field. */
export function withoutError(errors: FieldErrors, field: FieldName): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}
