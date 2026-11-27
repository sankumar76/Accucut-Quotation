import type { NodeKind } from '../../../src/lib/estimate/node-kinds';
import { encodeTreatment, type TreatmentChoice } from '../../../src/lib/estimate/treatment-value';
import { incompressiblePicture } from '../../support/builders/export-pictures';

/**
 * The pure parts of the load script's set-up (STORY-10.09 AC-3, AC-10; test strategy 8.1): the invented names, the order in which the parts of an estimate are added through the API, the values
 * of a complete part as the wire carries them, and the small helpers the set-up uses. Nothing here touches the network, so a unit test holds each rule. Every name and number is invented
 * (NFR-006, ADR-014); the numbers follow the `n.37` pattern of `prisma/seed/placeholders`.
 */

export const INVENTED_RATE = '12.37';
export const CHANGED_RATE = '13.37';
export const INVENTED_MATERIAL = { pricePerKg: '90.37', specificGravity: '7.85', scrapRate: '12.37' } as const;
export const INVENTED_EXCHANGE_RATES = { usd: '83.37', eur: '90.37' } as const;
export const FOLDER_PATH = '\\\\invented-server\\invented-share\\RFQ-load';

/** The portal changes the rate of every fifth customer by this many entries, so the list's "differs" count is not always 0 (test strategy 8.1 step 3). */
export const CHANGED_RATES_PER_CUSTOMER = 5;
export const CUSTOMER_CHANGE_EVERY = 5;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

export const customerName = (n: number): string => `Volume customer ${pad(n, 3)}`;
/** The customer's short name (CR-01 item 6): unique, and at most 10 characters. */
export const customerShortName = (n: number): string => `VOL${pad(n, 3)}`;
export const processItemName = (n: number): string => `Volume process item ${pad(n, 2)}`;
export const materialName = (n: number): string => `Volume material ${pad(n, 3)}`;
export const treatmentName = (n: number): string => `Volume treatment ${pad(n, 2)}`;
export const taskTitle = (n: number): string => `Invented load task ${n}`;

/** A short run mark (from the clock), so the people this run makes cannot collide with those of an earlier run on the same database. */
export function runMark(now: Date): string {
  return now.getTime().toString(36);
}

export const engineerEmail = (mark: string): string => `load-engineer-${mark}@example.test`;

/** The deadline of the queue's tasks as the assign form writes it, `YYYY-MM-DDTHH:mm` in IST, always later than now: 30 days ahead is later in any zone. */
export function deadlineText(now: Date): string {
  const ahead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return `${ahead.toISOString().slice(0, 10)}T10:00`;
}

/** One call that adds a part: a Main Assembly at the top, or a row of `nodeKind` last under a part made earlier (named by its index in the build order). */
export type AddCall = { readonly kind: 'item' } | { readonly kind: 'sub-part'; readonly parentIndex: number; readonly nodeKind: NodeKind };

/** The kind of a row at each level of a tree the API accepts (CR-01 item 3A): Main Assembly, Sub-Assembly, Part, Fastener. Nothing can sit under a Fastener, so the tree has four levels. */
const KIND_BY_LEVEL: ReadonlyArray<NodeKind> = ['MAIN_ASSEMBLY', 'SUB_ASSEMBLY', 'PART', 'FASTENER'];

/**
 * The calls that build a tree from the `tree500` fixture's shape, in the four levels the add rule allows (`ALLOWED_CHILDREN`). A parent always comes before its children in the fixture, so
 * building in order puts every row under one that exists, and a row is added last under its parent. The fixture is six levels deep, which the API no longer accepts (a Fastener holds nothing):
 * a node below the fourth level goes under its ancestor at the third, as a Fastener. So the tree built has the fixture's 500 parts and its shape down to four levels; the Sl. No of a
 * row after a re-parented one can differ from the fixture's.
 */
export function addCallsFor(nodes: ReadonlyArray<{ readonly parentIndex: number | null }>): ReadonlyArray<AddCall> {
  const placed: Array<{ readonly parent: number | null; readonly level: number }> = [];
  return nodes.map((node, index) => {
    if (node.parentIndex === null) {
      placed.push({ parent: null, level: 1 });
      return { kind: 'item' };
    }
    if (node.parentIndex >= index) throw new Error(`Node ${index} names a parent (${node.parentIndex}) that is not made yet.`);
    let parent = node.parentIndex;
    let level = (placed[parent]?.level ?? 0) + 1;
    while (level > KIND_BY_LEVEL.length) {
      parent = placed[parent]?.parent ?? parent;
      level -= 1;
    }
    placed.push({ parent, level });
    return { kind: 'sub-part', parentIndex: parent, nodeKind: KIND_BY_LEVEL[level - 1] ?? 'FASTENER' };
  });
}

/** The values of a complete part as a save carries them: texts by field ID (a treatment as its JSON text). */
export function wireValues(inputs: Readonly<Record<string, string | TreatmentChoice>>): Record<string, string> {
  return Object.fromEntries(Object.entries(inputs).map(([fieldId, value]) => [fieldId, typeof value === 'string' ? value : encodeTreatment(value)]));
}

/** The quantity a part's save writes in a round: it changes every round (an equal value changes nothing and raises no revision), and stays a whole number from 1 to 24. */
export function quantityFor(user: number, round: number): string {
  return String(1 + ((user + round) % 24));
}

/** An incompressible picture of 199 KB that the portal's content check accepts every time (`incompressiblePicture` holds no script marker: issue 821). */
export function acceptedPicture(index: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(incompressiblePicture(index));
}

/** Runs `work` over the items with at most `limit` at once, in order of start, and fails with the first error. */
export async function mapLimit<T>(items: ReadonlyArray<T>, limit: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item !== undefined) await work(item, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
