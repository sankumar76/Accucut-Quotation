import {
  CONSIDERED_REQUIRED_MESSAGE,
  MATERIAL_NAME_REQUIRED_MESSAGE,
  materialChangesFrom,
  materialNumberProblem,
  materialTextProblem,
  normaliseMaterialNumber,
  specificGravityProblem,
  type MaterialFieldName,
  type MaterialFields,
  type MaterialValues,
} from './materials';

/**
 * What the add and edit form of SCR-13 (Materials) holds and checks before it sends anything (STORY-02.03 AC-2, AC-3, AC-8). Pure, so the
 * rules are tested without a browser and the form component only draws. Only the shape is checked here (the server's schema states the same
 * rules from the same functions); whether a name is free is the server's.
 */

export type FieldErrors = Readonly<Partial<Record<MaterialFieldName, string>>>;

const TEXT_CHECKS = [
  { name: 'materialInDrawing', required: MATERIAL_NAME_REQUIRED_MESSAGE },
  { name: 'materialConsidered', required: CONSIDERED_REQUIRED_MESSAGE },
] as const;

const NUMBER_FIELDS = ['pricePerKg', 'specificGravity', 'scrapRate'] as const;

/** The check of each number: a price and a scrap rate are 0 or more, a specific gravity is above 0 (UX-37). */
const NUMBER_CHECKS: Readonly<Record<(typeof NUMBER_FIELDS)[number], (value: string) => string | null>> = {
  pricePerKg: materialNumberProblem,
  specificGravity: specificGravityProblem,
  scrapRate: materialNumberProblem,
};

const EMPTY_FORM: MaterialValues = { materialInDrawing: '', materialConsidered: '', pricePerKg: '', specificGravity: '', scrapRate: '' };

/** A new material starts empty; an edit starts from the material's own values. */
export function initialMaterialValues(original: MaterialValues | null): MaterialValues {
  return original === null ? EMPTY_FORM : { ...original };
}

/**
 * The message under each field that has one. In an edit a number is checked only when it was changed: the column holds four decimals,
 * and a value that was stored with more than two must not stop a rename until it is retyped.
 */
export function materialFormProblems(values: MaterialValues, original: MaterialValues | null): FieldErrors {
  const found: { -readonly [Field in MaterialFieldName]?: string } = {};
  for (const field of TEXT_CHECKS) {
    const problem = materialTextProblem(values[field.name], field.required);
    if (problem !== null) found[field.name] = problem;
  }
  for (const field of NUMBER_FIELDS) {
    if (original !== null && values[field] === original[field]) continue;
    const problem = NUMBER_CHECKS[field](values[field]);
    if (problem !== null) found[field] = problem;
  }
  return found;
}

/** What the person changed in an edit; an empty object for nothing. Spaces around a name do not count. */
export function materialEditChanges(original: MaterialValues, values: MaterialValues): MaterialFields {
  return materialChangesFrom(original, {
    materialInDrawing: values.materialInDrawing.trim(),
    materialConsidered: values.materialConsidered.trim(),
    pricePerKg: values.pricePerKg,
    specificGravity: values.specificGravity,
    scrapRate: values.scrapRate,
  });
}

/** The body of an add: the names trimmed and the numbers as stored text. */
export function newMaterialBody(values: MaterialValues): MaterialValues {
  return {
    materialInDrawing: values.materialInDrawing.trim(),
    materialConsidered: values.materialConsidered.trim(),
    pricePerKg: normaliseMaterialNumber(values.pricePerKg),
    specificGravity: normaliseMaterialNumber(values.specificGravity),
    scrapRate: normaliseMaterialNumber(values.scrapRate),
  };
}

/** The errors without the one for `field`, once the person has changed that field. */
export function withoutMaterialError(errors: FieldErrors, field: MaterialFieldName): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}
