import { buildTree500, type Tree500 } from './builders/tree500';
import { completePartInputs } from './complete-part';
import { type CalculationDatabase, idOf } from './calculation-database';
import { defined } from './defined';

/**
 * A DRAFT estimate of the Engineer's with the `tree500` fixture as its parts (STORY-05.09 AC-8; STORY-03.06): 500 parts, depth up to 6, each holding every input Calculate needs as the part form
 * stores it, the number and flag values of the fixture, and the first material. The customer is chosen. A Calculate of it takes the whole path: the parts are read, every one is checked, the masters
 * are read, 500 rows are calculated and inserted, and the status is set. Built through the owner, so building it is not part of what a test times. Every value is invented.
 */
export async function addTree500Estimate(db: CalculationDatabase, tree: Tree500 = buildTree500()): Promise<string> {
  const estimateId = await db.addEstimate({ engineer: true });
  const base = { ...completePartInputs(), [idOf('E')]: db.materialOneId };
  const ids: string[] = [];
  const nextPlace = new Map<number | null, number>();
  for (const node of tree.nodes) {
    const sortIndex = nextPlace.get(node.parentIndex) ?? 0;
    nextPlace.set(node.parentIndex, sortIndex + 1);
    const typed = Object.fromEntries([...node.inputs].map(([fieldId, value]) => [fieldId, value.toFixed(2)]));
    const parentId = node.parentIndex === null ? null : defined(ids[node.parentIndex]);
    ids.push(await db.addPart(estimateId, { parentId, sortIndex, inputs: { ...base, ...typed } }));
  }
  return estimateId;
}
