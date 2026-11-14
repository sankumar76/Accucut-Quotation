/**
 * One part of the parts tree as it leaves the server (STORY-05.02; architecture section 6 "Tree"): the same six facts for every role, and no figure of any kind
 * (NFR-002). It is a plain type so the error that carries a tree (`TreeChangedError`) and the service that builds one agree on it without importing each other.
 */

/**
 * How much of a part's inputs is filled (UX spec SCR-05, the per-node icons). Until the part form (STORY-05.03) and its rules (STORY-05.11) there is no
 * "complete": a part has something typed or nothing.
 */
export type Completeness = 'EMPTY' | 'PARTIAL' | 'COMPLETE';

/**
 * How complete a part is from what is stored in it: nothing typed is `EMPTY`, anything typed is `PARTIAL` (the part form stores only a value that is there: a cleared one
 * is removed). `COMPLETE` is the Calculate story's (STORY-05.11).
 */
export const completenessOf = (inputs: Readonly<Record<string, unknown>>): Completeness => (Object.keys(inputs).length === 0 ? 'EMPTY' : 'PARTIAL');

/** One stored value of a part, as it leaves the server: the field's ID and the text. A list of these and not an object, so every object of an answer has keys that are named (the strict schemas). */
export interface InputEntry {
  readonly fieldId: string;
  readonly value: string;
}

/** The typed inputs of a part (by field ID) as entries, in the order of the field IDs, so the same inputs are always sent in the same order. */
export const inputEntriesOf = (inputs: Readonly<Record<string, string>>): InputEntry[] =>
  Object.entries(inputs)
    .map(([fieldId, value]) => ({ fieldId, value }))
    .sort((a, b) => (a.fieldId < b.fieldId ? -1 : a.fieldId > b.fieldId ? 1 : 0));

/** `label` is the part's name, empty until the part form stores one (STORY-05.03). `slNo` is derived from the tree and never stored. */
export interface PartView {
  readonly id: string;
  readonly parentId: string | null;
  readonly slNo: string;
  readonly label: string;
  readonly completeness: Completeness;
  readonly revision: number;
}
