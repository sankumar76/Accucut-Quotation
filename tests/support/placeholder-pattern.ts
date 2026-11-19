/**
 * The invented-number pattern for placeholder master data (ADR-014, test strategy section 4).
 *
 * Every number in `prisma/seed/placeholders/` and in the fixtures built from it ends in `.37`
 * (`n.37`, for example `12.37`). Real rates rarely do, so a real value pasted in by mistake stands
 * out and a test fails. The pattern reduces the risk, it does not remove it (ADR-014).
 */

export const PLACEHOLDER_NUMBER_PATTERN = /^\d+\.37$/;

/**
 * The invented phone number (NFR-028, NFR-006; STORY-10.12 AC-1). Every phone number in a fixture, a seed placeholder or a
 * document is written as `+99 555 01nn`: country code 99 is not assigned to any country, and 555 01nn is the block the North
 * American numbering plan reserves for fiction. It is the form the existing fixtures already use (`+99 555 0142`), so no real
 * person's number can match it. One pattern, as with the numbers above: a second one would be a second thing to keep honest.
 */
export const PLACEHOLDER_PHONE_PATTERN = /^\+99 555 01\d{2}$/;

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
