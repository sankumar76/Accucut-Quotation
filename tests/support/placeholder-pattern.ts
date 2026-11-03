/**
 * The invented-number pattern for placeholder master data (ADR-014, test strategy section 4).
 *
 * Every number in `prisma/seed/placeholders/` and in the fixtures built from it ends in `.37`
 * (`n.37`, for example `12.37`). Real rates rarely do, so a real value pasted in by mistake stands
 * out and a test fails. The pattern reduces the risk, it does not remove it (ADR-014).
 */

export const PLACEHOLDER_NUMBER_PATTERN = /^\d+\.37$/;

/** A string that is a number once any sign and thousands separators are removed, such as "12.50". */
const NUMERIC_STRING = /^-?\d[\d,]*(\.\d+)?$/;

function isNumberLike(value: unknown): value is number | string {
  if (typeof value === 'number') return true;
  return typeof value === 'string' && NUMERIC_STRING.test(value.trim());
}

/**
 * Returns the path and value of every number in `data` that does not follow the pattern.
 * Walks objects and arrays; numeric strings count as numbers. An empty result means all conform.
 */
export function findNonConformingNumbers(data: unknown, path = '$'): string[] {
  if (Array.isArray(data)) {
    return data.flatMap((item, index) => findNonConformingNumbers(item, `${path}[${index}]`));
  }
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).flatMap(([key, value]) => findNonConformingNumbers(value, `${path}.${key}`));
  }
  if (isNumberLike(data) && !PLACEHOLDER_NUMBER_PATTERN.test(String(data).trim())) {
    return [`${path} = ${String(data)}`];
  }
  return [];
}
