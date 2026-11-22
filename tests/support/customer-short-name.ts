import { createHash } from 'node:crypto';

/**
 * A short name for a test customer that is made from its name (CR-01 item 6, AQP-390): the first 10 hex characters of the name's MD5, so it is unique wherever the names are, the same
 * every time, and within the limit of 10. The tests that do not care about a short name use it, so a customer made with a different name never meets another's short name by accident.
 * The same function is `left(md5(name), 10)` in the SQL of the tests that insert customers directly.
 */
export function shortNameOf(name: string): string {
  return createHash('md5').update(name).digest('hex').slice(0, 10);
}
