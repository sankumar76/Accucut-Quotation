import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the parts tree (STORY-05.02; architecture sections 4.8, 5.1 `estimate_nodes` and 6). A part is a row with its estimate, its parent (null at the
 * top), its place among its siblings, the inputs a person typed, and its own `revision`. **The Sl. No is not here**: the service reads it from the layout.
 *
 * Every write runs in the caller's transaction, after the caller has taken the estimate's row lock (`EstimateRepository.lockEstimate`), so two changes to one
 * tree are serialised and the layout a service read is the layout it writes back. The estimate's ID is a condition of every statement that changes a row, so a
 * node ID of another estimate can neither be moved nor deleted through this one.
 *
 * **What leaves.** A part's inputs are what a person typed, by field ID. No rate, cost or formula is stored in the table or selected here (BR-003, NFR-002).
 */

/** A part as stored. */
export interface NodeRecord {
  readonly id: string;
  readonly parentId: string | null;
  readonly sortIndex: number;
  readonly revision: number;
  /** What a person typed, by field ID. Empty until the part form (STORY-05.03) writes it. */
  readonly inputs: Readonly<Record<string, unknown>>;
}

/** One part's new place. `bumpRevision` is true for the part a person asked to move, and false for a sibling that only shifted. */
export interface NodePlacement {
  readonly id: string;
  readonly parentId: string | null;
  readonly sortIndex: number;
  readonly bumpRevision: boolean;
}

export interface EstimateNodeRepository {
  /** Every part of the estimate, in no particular order (the tree rules put them in order). Takes no lock. */
  listNodes(estimateId: string, tx?: Transaction): Promise<NodeRecord[]>;
  /** Adds a part with empty inputs and revision 1, and returns it. The caller then writes the new places of the siblings that shifted (`placeNodes`). */
  insertNode(estimateId: string, parentId: string | null, sortIndex: number, tx: Transaction): Promise<NodeRecord>;
  /** Writes the new place of each of these parts, and raises `revision` by one on those marked. Throws when a part is not in the estimate. */
  placeNodes(estimateId: string, placements: ReadonlyArray<NodePlacement>, tx: Transaction): Promise<void>;
  /** Deletes exactly these parts, in one statement. Throws when one of them is not in the estimate. */
  deleteNodes(estimateId: string, ids: ReadonlyArray<string>, tx: Transaction): Promise<void>;
}

const NODE_SELECT = { id: true, parentId: true, sortIndex: true, revision: true, inputs: true } as const;

/** `inputs` is a JSON object (a CHECK holds it); a value that is not one is a fault in the data and is refused rather than shown. */
const INPUTS = z.record(z.string(), z.unknown());

const NODE_ROW = z.strictObject({ id: z.string(), parentId: z.string().nullable(), sortIndex: z.number(), revision: z.number(), inputs: INPUTS });

const toRecord = (row: unknown): NodeRecord => NODE_ROW.parse(row);

/** The parent of a part that has none is sent to the statement as an empty text and read back as null, so one array can carry both. */
const NO_PARENT = '';

/** Builds the part methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createEstimateNodeRepository(db: PrismaClient): EstimateNodeRepository {
  return {
    listNodes: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        const rows = await clientFor(db, tx).estimateNode.findMany({ where: { estimateId }, select: NODE_SELECT });
        return rows.map(toRecord);
      }),

    insertNode: (estimateId, parentId, sortIndex, tx) =>
      withDatabaseErrors(async () => {
        const row = await clientFor(db, tx).estimateNode.create({ data: { estimateId, parentId, sortIndex }, select: NODE_SELECT });
        return toRecord(row);
      }),

    placeNodes: (estimateId, placements, tx) =>
      withDatabaseErrors(async () => {
        if (placements.length === 0) return;
        const ids = placements.map((placement) => placement.id);
        const parents = placements.map((placement) => placement.parentId ?? NO_PARENT);
        const places = placements.map((placement) => String(placement.sortIndex));
        const bumps = placements.map((placement) => (placement.bumpRevision ? '1' : '0'));
        const changed = await clientFor(db, tx).$executeRaw`
          UPDATE estimate_nodes n
          SET parent_id = NULLIF(u.parent_id, '')::uuid, sort_index = u.sort_index, revision = n.revision + u.bump, updated_at = now()
          FROM unnest(${ids}::uuid[], ${parents}::text[], ${places}::int[], ${bumps}::int[]) AS u(id, parent_id, sort_index, bump)
          WHERE n.id = u.id AND n.estimate_id = ${estimateId}::uuid`;
        if (changed !== placements.length) throw new Error('A part to place is not in this estimate.');
      }),

    deleteNodes: (estimateId, ids, tx) =>
      withDatabaseErrors(async () => {
        const { count } = await clientFor(db, tx).estimateNode.deleteMany({ where: { estimateId, id: { in: [...ids] } } });
        if (count !== ids.length) throw new Error('A part to delete is not in this estimate.');
      }),
  };
}
