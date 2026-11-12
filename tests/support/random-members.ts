/**
 * The random members of an answer, taken out before a test scans the rest for a short digit pattern (DEF-028).
 *
 * A "no rate in this body" check searches for digits such as `838` or `717`. A request ID (`req-` and eight random hex digits,
 * `src/server/http/problem.ts`) or a database-made UUID holds three-digit runs by chance, so a scan of the whole text fails
 * about one run in a few dozen with no leak. These two helpers remove only a member of that exact, strict form and leave every
 * other character in place, so a rate anywhere else in the text, or in a request ID of the wrong shape, is still found.
 */

/** The one `requestId` member of an error body, in the form the server makes: `req-` and eight lower-case hex digits. */
const REQUEST_ID_MEMBER = /"requestId":"req-[0-9a-f]{8}"/;

/** A UUID as `gen_random_uuid()` writes it: 8-4-4-4-12 lower-case hex digits, standing alone. */
const UUID = /(?<![\w-])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\w-])/g;

/** The text of an error body without its `requestId` member (the first one only). Any other text is returned as it is. */
export function withoutRequestId(text: string): string {
  return text.replace(REQUEST_ID_MEMBER, '');
}

/** The text with every well-formed UUID removed. A string that only looks like one, or any other value, stays. */
export function withoutUuids(text: string): string {
  return text.replace(UUID, '');
}
