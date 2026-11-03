/**
 * Narrows a value that a test knows is there, without a non-null assertion (which the lint rules forbid).
 * Throws with a readable message if the test's own assumption is wrong.
 */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`Expected the ${what} to exist.`);
  return value;
}
