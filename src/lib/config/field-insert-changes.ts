import { columnLetterToIndex, indexToColumnLetter } from '../columns';
import type { ConfigDocument } from '../fields/schema';

/**
 * Where an insert puts its new fields and which letters change because of it (STORY-08.03; FR-074, FR-075; SPEC section 8.3 "Automatic re-lettering" and "Fixed cells move"; BR-035). Pure: positions are
 * counted in a list of IDs, and a letter is only ever derived from a place in it (`indexToColumnLetter`), never stored or typed. **The preview, the letters list of step 2 and the save all read this file**, so
 * what the Admin is shown is what is stored.
 */

/** A new field before it has an ID of its own: where it goes. `afterId` is a field of the list, or the ID of a slot placed before it (the pair's cost column right after its input). */
export interface Slot {
  readonly id: string;
  readonly afterId: string;
}

/**
 * The IDs in their order after the insert, or `null` when a slot names a column that is not in the list. The slots are placed one after the other, so a later slot may follow an earlier one. Every field
 * that was in the list keeps its ID, and no other field is dropped or repeated.
 */
export function orderAfterInsert(order: ReadonlyArray<string>, slots: ReadonlyArray<Slot>): string[] | null {
  const placed = [...order];
  for (const slot of slots) {
    const at = placed.indexOf(slot.afterId);
    if (at === -1) return null;
    placed.splice(at + 1, 0, slot.id);
  }
  return placed;
}

/** A new field as the preview lists it: the letter it will have. */
export interface InsertedColumn {
  readonly id: string;
  readonly label: string;
  readonly kind: 'input' | 'output';
  readonly letter: string;
  /** The letter of the column just before it once the insert is made. */
  readonly followsLetter: string | null;
}

/** A column whose letter changes: "AY → AZ". */
export interface MovedColumn {
  readonly id: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/** A cell of the product that moves with its column: `BL2 → BM2`. */
export interface MovedProductCell {
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

export interface LetterChanges {
  readonly inserted: ReadonlyArray<InsertedColumn>;
  readonly moved: ReadonlyArray<MovedColumn>;
  readonly productCells: ReadonlyArray<MovedProductCell>;
}

/** The product's own cells are in row 2 of the file: row 1 is the header and the first part is row 2 (architecture section 4.6). */
export const PRODUCT_CELL_ROW = 2;

export interface NewColumnSummary {
  readonly id: string;
  readonly label: string;
  readonly kind: 'input' | 'output';
}

/**
 * Every letter that changes when the fields in `after` take their places, from the document as it is now. `after` is `orderAfterInsert`'s answer. A field is found by its ID, so the product's cells
 * (BL2, BN2, BO2) move with their columns and are never found by a letter.
 */
export function describeLetterChanges(before: ConfigDocument, after: ReadonlyArray<string>, added: ReadonlyArray<NewColumnSummary>): LetterChanges {
  const newLetterOf = new Map(after.map((id, index) => [id, indexToColumnLetter(index + 1)]));
  const moved: MovedColumn[] = [];
  const productCells: MovedProductCell[] = [];
  for (const field of before.fields) {
    const from = indexToColumnLetter(field.position);
    const to = newLetterOf.get(field.id);
    if (to === undefined || to === from) continue;
    moved.push({ id: field.id, label: field.label, from, to });
    if (field.rowScope === 'product') productCells.push({ label: field.label, from: `${from}${PRODUCT_CELL_ROW}`, to: `${to}${PRODUCT_CELL_ROW}` });
  }
  const inserted = added.map((column): InsertedColumn => {
    const place = after.indexOf(column.id);
    return { ...column, letter: indexToColumnLetter(place + 1), followsLetter: place > 0 ? indexToColumnLetter(place) : null };
  });
  return { inserted, moved, productCells };
}

/** Columns that moved by the same number of places, as one range of their old letters: `AY` to `BO`, one place. */
export interface MovedRun {
  readonly from: string;
  readonly to: string;
  readonly by: number;
}

/** The moved columns grouped into runs of equal shift (one run for one field or a pair side by side, two for a pair with its cost column further on). Used by the audit entry's words. */
export function movedRuns(moved: ReadonlyArray<MovedColumn>): MovedRun[] {
  const runs: MovedRun[] = [];
  for (const column of moved) {
    const by = columnLetterToIndex(column.to) - columnLetterToIndex(column.from);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.by === by && columnLetterToIndex(column.from) === columnLetterToIndex(last.to) + 1) {
      runs[runs.length - 1] = { ...last, to: column.from };
    } else {
      runs.push({ from: column.from, to: column.from, by });
    }
  }
  return runs;
}
