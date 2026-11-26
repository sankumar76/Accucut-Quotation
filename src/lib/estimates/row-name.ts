import { nodeKindLabel } from '../estimate/node-kinds';

import type { PartItem } from './tree-client';

/**
 * The name of a row of the parts tree and what is said after a row is added (AQP-446, DEF-089 and DEF-090; UX ruling `docs/03-ux/rulings/parts-tree-scr05-conformance-2026-11-26.md` items 1 and 2). Pure code,
 * with no import of the form or the registry, so the first load of the estimate page carries it.
 *
 * **A row's name is its Description, else its Part No., else the kind's own name** (`Main Assembly`, `Sub-Assembly`, `Part`, `Sub-part`, `Fastener`; the Part / Sub-part word follows the siblings). The server sends
 * the first two as the row's `label` (`partNameOf`, the one reader that SCR-06 and SCR-07 use too), so this file only adds the third. There is no separate name field: the Description is the name.
 */

/** Said after the kind's own name, for a screen reader only, so the repeated word is understood as a placeholder: "Sub-Assembly, no description yet". */
export const NO_DESCRIPTION_YET = ', no description yet';

/** Has the row a name of its own (a Description or a Part No.), by the same rule as the server: a label of only spaces is none. */
export const hasRowName = (label: string): boolean => label.trim() !== '';

/** The words that name a row where no style is possible (a button's spoken name, a title): its label, else the name of its kind. */
export const rowNameOf = (label: string, kindLabel: string): string => (hasRowName(label) ? label : kindLabel);

/** The rows that were a Sub-part before and are a Part now (the delete left one Part under their parent), by their Sl. No in `after`. */
function nowAPart(before: ReadonlyArray<PartItem>, after: ReadonlyArray<PartItem>): string[] {
  const beforeLabels = new Map(before.map((node) => [node.id, nodeKindLabel(node, before)]));
  return after.filter((node) => beforeLabels.get(node.id) === 'Sub-part' && nodeKindLabel(node, after) === 'Part').map((node) => node.slNo);
}

/** What is announced after a delete (ruling item 2): the words it always had, and, when it left one Part under a parent, which row is a Part now: "Row deleted. 1.1 is now a Part." `deleted` is those words. */
export function deletedAnnouncement(deleted: string, before: ReadonlyArray<PartItem>, after: ReadonlyArray<PartItem>): string {
  const rows = nowAPart(before, after);
  return rows.length === 0 ? deleted : `${deleted}. ${rows.join(' and ')} ${rows.length === 1 ? 'is' : 'are'} now a Part.`;
}

/**
 * What is announced after a row was added (polite status; ruling item 2): "Added 1.5 Part. Type a Description to name it." The kind word is the new row's own, and when the add made an earlier Part a
 * Sub-part (a second Part under the same parent) the row is named at the end: " 1.2 is now a Sub-part." `before` is the tree the add was made on, `after` the tree it made.
 */
export function addedAnnouncement(before: ReadonlyArray<PartItem>, after: ReadonlyArray<PartItem>, addedId: string): string {
  const added = after.find((node) => node.id === addedId);
  if (added === undefined) return '';
  const beforeLabels = new Map(before.map((node) => [node.id, nodeKindLabel(node, before)]));
  const nowSubParts = after.filter((node) => node.id !== addedId && beforeLabels.get(node.id) === 'Part' && nodeKindLabel(node, after) === 'Sub-part').map((node) => node.slNo);
  const renamed = nowSubParts.length === 0 ? '' : ` ${nowSubParts.join(' and ')} ${nowSubParts.length === 1 ? 'is' : 'are'} now a Sub-part.`;
  return `Added ${added.slNo} ${nodeKindLabel(added, after)}. Type a Description to name it.${renamed}`;
}
