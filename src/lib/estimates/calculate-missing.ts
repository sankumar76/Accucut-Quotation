/**
 * What Calculate found missing, as the screen keeps it (STORY-05.09 AC-1; architecture A-16: client state from the blocked answer, never stored). The types are the shape of one part and one field of
 * the 422 `CALCULATE_BLOCKED` (`calculate-client.ts` reads them from the body), and `withoutFilled` strikes what the person has since filled in. Pure and tiny, so the workspace carries it in its first
 * load while the code that sends Calculate and reads the answer is fetched when the button is first pressed (NFR-009: this page has no room in its 200 KB).
 */

/** A needed field that a part does not show a value for: its ID, to link to it, and its label. */
export interface MissingFieldView {
  readonly fieldId: string;
  readonly label: string;
}

/** A part that Calculate found a missing input in: its ID, Sl. No, name (null while it has none) and the fields. */
export interface BlockedPartView {
  readonly nodeId: string;
  readonly slNo: string;
  readonly name: string | null;
  readonly fields: ReadonlyArray<MissingFieldView>;
}

/**
 * What is still missing after a part was saved: the fields of that part that now hold a value come off the list, and a part with none left is no longer listed. `null` when nothing is left, so the
 * screen has no summary to show. The list is the server's from the blocked answer; this only strikes what the person has since filled in, and the next press asks the server again.
 */
export function withoutFilled(parts: ReadonlyArray<BlockedPartView>, partId: string, inputs: Readonly<Record<string, string>>): ReadonlyArray<BlockedPartView> | null {
  const next = parts
    .map((part) => (part.nodeId === partId ? { ...part, fields: part.fields.filter((field) => (inputs[field.fieldId] ?? '').trim() === '') } : part))
    .filter((part) => part.fields.length > 0);
  return next.length === 0 ? null : next;
}
