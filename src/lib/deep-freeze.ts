/**
 * Freezes a value and everything inside it, and returns the same value. For data that many callers share and
 * none may change: the parsed configuration document held in the version cache (architecture ruling R5) and
 * the seed module. Assigning to a frozen object throws a `TypeError` in strict mode, so a stray write fails
 * loudly instead of altering what every other caller sees.
 *
 * Plain data only (objects and arrays, as JSON gives them). A `Date` or a `Map` inside is frozen as an
 * object but keeps its internal state mutable, so do not pass one if that matters.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
