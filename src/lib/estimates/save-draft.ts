import type { SaveGate } from './save-gate';

/** What a press of Save draft came to: saved at this time, or a value is still not saved (the form says which, under the field). */
export type DraftResult = { readonly saved: true; readonly at: Date } | { readonly saved: false };

/**
 * Save draft (STORY-05.08 AC-1, AC-5), and the "Save draft and leave" of the warning on leaving. It is **not a second save path**: every value is saved by leaving its field, through the part form's
 * one save (a value equal after normalisation sends nothing, AC-2), so this asks each part form to send again what it shows (`flush`: a field still being typed in, and a field whose last save failed),
 * and waits for the saves with the same gate Calculate waits on. A draft needs no field filled in (FR-053): nothing here asks for completeness. It never says "saved" while a field still shows a value
 * the server does not hold.
 */
export async function saveDraft(gate: SaveGate, now: () => Date = () => new Date()): Promise<DraftResult> {
  gate.flush();
  return (await gate.settle()) ? { saved: true, at: now() } : { saved: false };
}
