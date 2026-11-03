/**
 * Runs an action that must throw and returns what it threw, narrowed to the expected class, without a type
 * assertion (coding standards section 10). Fails with a readable message if nothing was thrown or the wrong
 * thing was.
 */
export function thrownAs<T extends Error>(action: () => unknown, type: abstract new (...args: never[]) => T): T {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) throw new Error('Expected the action to throw, but it did not.');
  if (!(thrown instanceof type)) throw new Error(`Expected a ${type.name}, but the action threw something else.`, { cause: thrown });
  return thrown;
}
