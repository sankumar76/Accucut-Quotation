/**
 * One part of the parts tree as it leaves the server (STORY-05.02; architecture section 6 "Tree"): the same six facts for every role, and no figure of any kind
 * (NFR-002). It is a plain type so the error that carries a tree (`TreeChangedError`) and the service that builds one agree on it without importing each other.
 */

/**
 * How much of a part's inputs is filled (UX spec SCR-05, the per-node icons). Until the part form (STORY-05.03) and its rules (STORY-05.11) there is no
 * "complete": a part has something typed or nothing.
 */
export type Completeness = 'EMPTY' | 'PARTIAL' | 'COMPLETE';

/** `label` is the part's name, empty until the part form stores one (STORY-05.03). `slNo` is derived from the tree and never stored. */
export interface PartView {
  readonly id: string;
  readonly parentId: string | null;
  readonly slNo: string;
  readonly label: string;
  readonly completeness: Completeness;
  readonly revision: number;
}
