/**
 * Closes a `switch` over a discriminated union (coding standards section 10). If a new member is added to
 * the union and a `switch` does not handle it, the call no longer type-checks; if bad data gets past the
 * types at run time, it throws instead of falling through.
 *
 * The message names only what was unhandled, never its content: the value may be a formula operand or a
 * rate (Restricted), and an error message can reach a log. The value travels as the error's `cause`, so it is
 * available to whoever debugs the failure but is not printed as part of the message.
 */
export function assertNever(value: never, description = 'value'): never {
  throw new Error(`Unhandled ${description}.`, { cause: value });
}
