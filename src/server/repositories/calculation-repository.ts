import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the immutable calculation records (STORY-03.05; FR-031, NFR-026, NFR-002; ADR-007; architecture sections 4.2, 4.8 and 5.1): the tables
 * `calculations` and `calculation_rows`.
 *
 * **Restricted** (ADR-008, NFR-002): every column holds cost data, so nothing an Engineer's code path can reach may import this file. It is on the
 * blocked list of the Engineer allow-list in `eslint.config.mjs` (it is in neither list, so it is refused), and `tests/security/engineer-import-rule.test.ts`
 * lints a planted import of it from every Engineer view. It is the only importer of those two tables.
 *
 * **Immutable.** There is no update and no delete here, and none can be added by mistake: the database refuses them for every role (a trigger) and the
 * runtime role holds only SELECT and INSERT (ADR-007). A change is a new record, never an edit.
 *
 * **Every write takes the caller's `Transaction`, as required**, so a record and its rows are one commit or none, together with the estimate's new link to
 * them (AC-1). The estimate's row is locked, read and linked through `estimate-repository.ts` (`lockEstimate`, `linkCalculation`), in the same transaction: that
 * lock is the one that serialises Calculate against every input change (architecture section 4.8).
 *
 * **Reading a figure.** `findCalculation` returns what is stored and decides nothing about whether it may be shown: a caller reads a figure for a screen
 * or a file only through `lib/estimate/figure-state.ts` (architecture section 10).
 */

/** A text that is a number, as decimal text with full precision (ADR-005), or `null` for "no figure". Never a JavaScript number. */
const decimalTextOrNull = z.string().nullable();

/**
 * Every master value one calculation used, as it was at that moment, with the names then (ADR-007): the selected customer's rates, each distinct
 * material of the tree and the two exchange rates. A later change to a master shows as a plain comparison with this (STORY-06.11).
 */
export const masterSnapshotSchema = z.strictObject({
  customer: z.strictObject({ id: z.string(), name: z.string() }),
  rates: z.array(z.strictObject({ id: z.string(), name: z.string(), value: z.string() })),
  materials: z.array(
    z.strictObject({
      id: z.string(),
      materialInDrawing: z.string(),
      materialConsidered: z.string().nullable(),
      pricePerKg: z.string(),
      specificGravity: z.string(),
      scrapRate: z.string(),
    }),
  ),
  exchangeRates: z.strictObject({ usd: z.string().nullable(), eur: z.string().nullable() }),
});
export type MasterSnapshot = z.infer<typeof masterSnapshotSchema>;

/** The figures of the product: BL (the total price), BN (BL per Tool Cost) and the total Tool Cost, as full-precision decimal text. */
export const productValuesSchema = z.strictObject({
  totalPrice: decimalTextOrNull,
  pricePerToolCost: decimalTextOrNull,
  toolCostTotal: decimalTextOrNull,
});
export type ProductValues = z.infer<typeof productValuesSchema>;

/** A row's typed values and resolved display text, or its calculated outputs, by field ID. `null` is a field with no value or no figure. */
export const storedValuesSchema = z.record(z.string(), decimalTextOrNull);
export type StoredValues = z.infer<typeof storedValuesSchema>;

export interface NewCalculation {
  readonly estimateId: string;
  readonly configVersionId: string;
  readonly inputsRevision: number;
  readonly masterSnapshot: MasterSnapshot;
  readonly productValues: ProductValues;
  /** The user who pressed Calculate. With the time, it is also the acknowledgement of any warning (ADR-007). */
  readonly createdById: string;
}

export interface NewCalculationRow {
  readonly nodeId: string;
  readonly parentId: string | null;
  readonly sortIndex: number;
  readonly slNo: string;
  readonly inputs: StoredValues;
  readonly imageId: string | null;
  readonly outputs: StoredValues;
}

export interface CalculationRowRecord extends NewCalculationRow {
  readonly id: string;
}

export interface CalculationRecord extends NewCalculation {
  readonly id: string;
  /** `[]` until STORY-05.12 writes any. */
  readonly warnings: ReadonlyArray<unknown>;
  readonly createdAt: Date;
  /** Every node as calculated. The tree is rebuilt from `parentId` and `sortIndex`; the order of this list is only deterministic. */
  readonly rows: ReadonlyArray<CalculationRowRecord>;
}

export interface CalculationRepository {
  /** Inserts the record and one row per node, in the caller's transaction, and returns the new calculation's ID and time. `warnings` takes its default, `[]`. */
  insertCalculation(calculation: NewCalculation, rows: ReadonlyArray<NewCalculationRow>, tx: Transaction): Promise<{ readonly id: string; readonly createdAt: Date }>;
  /** One record with its rows, or null for an unknown ID. A plain read; the figure-state rule is the caller's (see above). */
  findCalculation(id: string): Promise<CalculationRecord | null>;
}

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Rows per `INSERT`, so a tree of any size stays well under PostgreSQL's limit of 65,535 bound parameters (9 a row). */
const ROWS_PER_INSERT = 1_000;

const WARNINGS = z.array(z.unknown());

/** Builds the calculation methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createCalculationRepository(db: PrismaClient): CalculationRepository {
  return {
    insertCalculation: (calculation, rows, tx) =>
      withDatabaseErrors(async () => {
        const client = clientFor(db, tx);
        const created = await client.calculation.create({
          data: {
            estimateId: calculation.estimateId,
            configVersionId: calculation.configVersionId,
            inputsRevision: calculation.inputsRevision,
            masterSnapshot: calculation.masterSnapshot,
            productValues: calculation.productValues,
            createdById: calculation.createdById,
          },
          select: { id: true, createdAt: true },
        });
        for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
          await client.calculationRow.createMany({
            data: rows.slice(start, start + ROWS_PER_INSERT).map((row) => ({
              calculationId: created.id,
              nodeId: row.nodeId,
              parentId: row.parentId,
              sortIndex: row.sortIndex,
              slNo: row.slNo,
              inputs: row.inputs,
              imageId: row.imageId,
              outputs: row.outputs,
            })),
          });
        }
        return created;
      }),

    findCalculation: (id) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const found = await db.calculation.findUnique({
          where: { id },
          include: { rows: { orderBy: [{ sortIndex: 'asc' }, { id: 'asc' }] } },
        });
        if (found === null) return null;
        return {
          id: found.id,
          estimateId: found.estimateId,
          configVersionId: found.configVersionId,
          inputsRevision: found.inputsRevision,
          masterSnapshot: masterSnapshotSchema.parse(found.masterSnapshot),
          productValues: productValuesSchema.parse(found.productValues),
          warnings: WARNINGS.parse(found.warnings),
          createdById: found.createdById,
          createdAt: found.createdAt,
          rows: found.rows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            parentId: row.parentId,
            sortIndex: row.sortIndex,
            slNo: row.slNo,
            inputs: storedValuesSchema.parse(row.inputs),
            imageId: row.imageId,
            outputs: storedValuesSchema.parse(row.outputs),
          })),
        };
      }),
  };
}
