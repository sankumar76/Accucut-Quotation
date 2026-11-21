/**
 * Makes a text safe to put inside a SQL `LIKE` or `ILIKE` pattern (a `contains` search, STORY-04.06 AC-3): the backslash, the percent sign and the underscore each get a backslash in
 * front, so a person who types `50%` or `Plate_A` finds exactly that and not "anything" or "any one character". PostgreSQL's default escape character is the backslash. Prisma's
 * `contains` does not do this itself (`tests/integration/tasks/queue-filters.test.ts` holds it to account on real rows).
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
