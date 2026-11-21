import { movedRuns, type LetterChanges, type MovedRun } from './field-insert-changes';
import { movedRunWords, sectionWords } from './field-insert-words';

/**
 * What the audit entry `config.field_inserted` keeps and the words it shows (STORY-08.03 AC-9; FR-011, FR-079; UX spec SCR-16). Pure, so the save and the registry's `describe` read one file. The entry names who
 * and when through its own columns, and here the new column or columns (letter, label, kind, the column each follows), the formula typed for an output (the log is read by the Admin alone, NFR-002) and what
 * moved, as runs of old letters. It has no key a password, figure or rate value could sit in.
 */

export interface InsertAuditField {
  readonly letter: string;
  readonly label: string;
  readonly kind: 'input' | 'output';
  /** The letter of the column just before it in the finished worksheet, or `null` for the first column. */
  readonly follows: string | null;
  /** The formula of an output in display form, or `null` for an input. */
  readonly formula: string | null;
}

export interface InsertAuditAfter {
  readonly fields: ReadonlyArray<InsertAuditField>;
  readonly moved: ReadonlyArray<MovedRun>;
  readonly version: number;
  /** The section the insert added (STORY-08.08 AC-7): its number and name; `null` when the input went into an existing section (an entry stored before this story reads as `null`). */
  readonly section: { readonly number: number; readonly name: string } | null;
  /** How many choices a choice input was given; `null` for any other insert. */
  readonly choices: number | null;
}

/** What a save of 08.08 adds to the entry beyond the letters: the new section and the number of choices, both `null` when they do not apply. */
export interface InsertAuditExtra {
  readonly section: { readonly number: number; readonly name: string } | null;
  readonly choices: number | null;
}

/** The "Before" cell of the entry: the field did not exist. */
export const NOT_IN_THE_WORKSHEET = 'Not in the worksheet';

/** The value stored under "after" (and its words), from the letter changes the save was shown. */
export function insertAuditAfter(
  changes: LetterChanges,
  formulas: ReadonlyArray<{ readonly letter: string; readonly formula: string }>,
  version: number,
  extra: InsertAuditExtra = { section: null, choices: null },
): InsertAuditAfter {
  return {
    fields: changes.inserted.map(({ letter, label, kind, followsLetter }) => ({ letter, label, kind, follows: followsLetter, formula: formulas.find((entry) => entry.letter === letter)?.formula ?? null })),
    moved: movedRuns(changes.moved),
    version,
    section: extra.section === null ? null : { number: extra.section.number, name: extra.section.name },
    choices: extra.choices,
  };
}

/** The "Before" cell: the field did not exist, and when the insert added a section, neither did the section. */
export function describeInsertBefore(after: InsertAuditAfter): string {
  return after.section === null ? NOT_IN_THE_WORKSHEET : `${NOT_IN_THE_WORKSHEET}, no ${sectionWords(after.section.number, after.section.name)}`;
}

function choiceWords(count: number | null): string {
  return count === null ? '' : `, a list of ${String(count)} choice${count === 1 ? '' : 's'}`;
}

function sectionPlaceWords(section: InsertAuditAfter['section']): string {
  return section === null ? '' : `, in the new ${sectionWords(section.number, section.name)}`;
}

function addedWords(fields: ReadonlyArray<InsertAuditField>): string {
  const [first, second] = fields;
  if (first === undefined) return 'Nothing was added';
  const follow = (field: InsertAuditField): string => (field.follows === null ? '' : ` after ${field.follows}`);
  // The pair side by side reads as one: "AY and AZ after AX".
  if (second !== undefined && second.follows === first.letter) return `Added as ${first.letter} and ${second.letter}${follow(first)}`;
  return `Added as ${fields.map((field) => `${field.letter}${follow(field)}`).join(' and ')}`;
}

/** `Added as AY after AX. Columns AY to BO moved one to the right (configuration version 10)`; with nothing after the new column: `No other column moved`. */
export function describeInsertAudit(after: InsertAuditAfter): string {
  const moved = after.moved.length === 0 ? 'No other column moved' : after.moved.map((run) => movedRunWords(run.from, run.to, run.by)).join('; ');
  return `${addedWords(after.fields)}${choiceWords(after.choices)}${sectionPlaceWords(after.section)}. ${moved} (configuration version ${String(after.version)})`;
}
