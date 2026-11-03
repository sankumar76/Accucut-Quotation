/**
 * Freezes a value and everything inside it, and returns the same value. For data that many callers share and
 * none may change: the parsed configuration document held in the version cache (architecture ruling R5) and
 * the seed module. Assigning to a frozen object throws a `TypeError` in strict mode, so a stray write fails
 * loudly instead of altering what every other caller sees.
 *
 * It walks into children even when a parent is already frozen (`Object.freeze` alone is shallow), and keeps
 * a set of the objects it has visited so a shared child is handled once and a cycle ends.
 *
 * Plain data only (objects and arrays, as JSON gives them). A `Date` or a `Map` inside is frozen as an
 * object but keeps its internal state mutable, so keep such values out (hold a time as an ISO string).
 */
export function deepFreeze<T>(value: T, visited: WeakSet<object> = new WeakSet()): T {
  if (typeof value !== 'object' || value === null || visited.has(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}
