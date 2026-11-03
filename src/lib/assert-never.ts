/**
 * Closes a `switch` over a discriminated union (coding standards section 10). If a new member is added to
 * the union and a `switch` does not handle it, the call no longer type-checks; if bad data gets past the
 * types at run time, it throws instead of falling through.
 */
export function assertNever(value: never, description = 'value'): never {
  throw new Error(`Unhandled ${description}: ${JSON.stringify(value)}`);
}
