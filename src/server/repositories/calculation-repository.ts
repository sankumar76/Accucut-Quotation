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
  /**
   * The warnings the person acknowledged for this calculation (STORY-05.12; architecture section 4.3): code, part, Sl. No and name, as text at that moment. Absent is none: the column takes its
   * default `[]`. A calculation with warnings cannot exist unless they were acknowledged, so `createdById` and the time are the acknowledgement.
   */
  readonly warnings?: ReadonlyArray<StoredWarning>;
}

/** One acknowledged warning as the record keeps it: text only, no figure (the shape of `QuantityWarning`). */
export interface StoredWarning {
  readonly code: string;
  readonly nodeId: string;
  readonly slNo: string;
  readonly label: string;
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

export interface CalculationRecord extends Omit<NewCalculation, 'warnings'> {
  readonly id: string;
  /** The acknowledged warnings (STORY-05.12), `[]` for a calculation that had none. */
  readonly warnings: ReadonlyArray<unknown>;
  readonly createdAt: Date;
  /** Every node as calculated. The tree is rebuilt from `parentId` and `sortIndex`; the order of this list is only deterministic. */
  readonly rows: ReadonlyArray<CalculationRowRecord>;
}

/**
 * What decides whether an estimate's figures may be shown, and nothing that is a figure (STORY-06.02): the estimate's count of input changes, and which calculation it is linked to with
 * the count that calculation was made at, the version it used and when. `lib/estimate/figure-state.ts` turns the two counts into a state.
 */
export interface FigureBasis {
  readonly inputsRevision: number;
  readonly calculation: {
    readonly id: string;
    readonly inputsRevision: number;
    readonly configVersionId: string;
    readonly createdAt: Date;
  } | null;
}

/** What the estimate review shows of a calculation (STORY-06.02): the product's figures and each row's outputs by node. Not the master snapshot and not the typed inputs. */
export interface ReviewFigures {
  readonly productValues: ProductValues;
  readonly rows: ReadonlyArray<{ readonly nodeId: string; readonly outputs: StoredValues }>;
  /** The warnings the person acknowledged for this calculation (STORY-06.10), as text; `[]` for none. Read with the figures, so only while the state is `current` (AC-4). */
  readonly warnings: ReadonlyArray<StoredWarning>;
  /** The name now of the person who pressed Calculate or Recalculate: with the time, the acknowledgement of the warnings. */
  readonly madeByName: string;
}

/**
 * What the cost details of one row are worked out from (STORY-06.03): the row's own stored inputs and outputs, and the master snapshot of the calculation (the rates, the materials and the exchange rates it
 * used, with their names then). Nothing of another row, and neither the customer's name nor the product totals are selected.
 */
export interface RowWorkingRecord {
  readonly masterSnapshot: MasterSnapshot;
  readonly inputs: StoredValues;
  readonly outputs: StoredValues;
}

/** A calculation an estimate is linked to, with what its figure state is worked out from. No figure. */
export interface LinkedCalculation {
  readonly id: string;
  readonly taskCode: string;
  /** `estimates.inputs_revision` now. */
  readonly inputsRevision: number;
  /** `calculations.inputs_revision` of this calculation. */
  readonly calculationInputsRevision: number;
}

/**
 * What the Excel export is built from (STORY-07.02; architecture section 4.6): every node of one calculation, with its typed values, its stored figures and its picture, and the words and price of
 * each material in the calculation's own snapshot, and the product's figures (BL, BN and the total Tool Cost: STORY-07.03). Nothing else of the snapshot (no customer, no rate, no exchange rate) is read.
 */
export interface ExportFigures {
  readonly rows: ReadonlyArray<CalculationRowRecord>;
  /** The stored figures of the product, as the review shows them: the file's BL2, BN2 and footer are these, so they equal SCR-06's to the paisa. */
  readonly productValues: ProductValues;
  readonly materials: ReadonlyArray<{ readonly materialInDrawing: string; readonly pricePerKg: string }>;
}

export interface CalculationRepository {
  /** Inserts the record and one row per node, in the caller's transaction, and returns the new calculation's ID and time. `warnings` is the acknowledged list, or the default `[]` when there is none. */
  insertCalculation(calculation: NewCalculation, rows: ReadonlyArray<NewCalculationRow>, tx: Transaction): Promise<{ readonly id: string; readonly createdAt: Date }>;
  /** One record with its rows, or null for an unknown ID. A plain read; the figure-state rule is the caller's (see above). */
  findCalculation(id: string): Promise<CalculationRecord | null>;
  /**
   * The calculations the estimates are linked to now, the newest first, at most `limit`, each with the code of its task and the two revisions the figure state is worked out from (STORY-08.02: the formula
   * editor tries a formula on a row of the latest calculated estimate, "Sample rows come from the latest calculated estimate, Q-..."). No figure is read: the caller picks the first whose state is
   * `current` (`figureState`) and reads its record through `readFiguresWhenCurrent`, as every other reader does. **The one caller is the Admin's formula editor** (ADR-008, NFR-002).
   */
  findRecentLinked(limit: number): Promise<ReadonlyArray<LinkedCalculation>>;
  /**
   * The basis of the figure state of an estimate (no figure is read), or null for an unknown estimate or an ID that is not a UUID. Pass `tx` to read it in the caller's transaction (STORY-06.05: an approval
   * reads it under the estimate's row lock, on the one connection it already holds); without it the read is a plain one.
   */
  findFigureBasis(estimateId: string, tx?: Transaction): Promise<FigureBasis | null>;
  /**
   * The figures the estimate review shows, of the calculation with this ID: the product's values and every row's outputs, selected column by column (neither the master snapshot nor a row's
   * inputs are read). Null for an unknown ID. **The caller reads it only while the state is `current`** (`readFiguresWhenCurrent` of `figure-state.ts`).
   */
  findReviewFigures(calculationId: string): Promise<ReviewFigures | null>;
  /**
   * The stored working of one row of a calculation (STORY-06.03): its inputs and outputs, and the master snapshot, selected column by column. Null for an unknown calculation, a row it does not hold,
   * or an ID that is not a UUID. **The caller reads it only while the state is `current`** (`readFiguresWhenCurrent` of `figure-state.ts`).
   */
  findRowWorking(calculationId: string, nodeId: string): Promise<RowWorkingRecord | null>;
  /**
   * The nodes of one calculation and its materials' words and prices, for the Excel file (STORY-07.02): the rows in a fixed order, and from the master snapshot only `materials` (selected as one column, the
   * rest of it dropped before it leaves). Null for an unknown calculation or an ID that is not a UUID. **The caller reads it only while the state is `current`** (`readFiguresWhenCurrent` of `figure-state.ts`).
   * Pass `tx` to read in the caller's transaction (STORY-07.04: the export reads the state and these rows in one repeatable-read snapshot).
   */
  findExportFigures(calculationId: string, tx?: Transaction): Promise<ExportFigures | null>;
  /**
   * The calculated total (BL) of one calculation as decimal text, selected on its own (STORY-06.06: the approval keeps it beside the price and pre-fills nothing else): neither a row nor the snapshot is
   * read. Null for an unknown calculation, an ID that is not a UUID, or a calculation with no total. **The caller reads it only while the state is `current`.** Pass `tx` to read in the caller's transaction.
   */
  findCalculatedTotal(calculationId: string, tx?: Transaction): Promise<string | null>;
  /**
   * The master snapshot of one calculation and the configuration version it used, selected on their own (STORY-06.08: the unlock preview compares the snapshot with the masters now). Neither a row nor a figure is
   * read. Null for an unknown calculation or an ID that is not a UUID. **The snapshot holds rates and prices, which are cost data**: only the Lead's and the Admin's code may ask (ADR-008).
   */
  findMasterSnapshot(calculationId: string): Promise<{ readonly configVersionId: string; readonly masterSnapshot: MasterSnapshot } | null>;
}

/**
 * What an approval reads of the calculation repository: the basis of the figure state and the calculated total (STORY-06.06). A named interface and not a `Pick`, so the audit-transaction check sees a
 * repository type, declared in this directory, as the receiver of the reads the approval's audit entry follows.
 */
export interface CalculationApprovalReads {
  readonly findFigureBasis: CalculationRepository['findFigureBasis'];
  readonly findCalculatedTotal: CalculationRepository['findCalculatedTotal'];
}

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Rows per `INSERT`, so a tree of any size stays well under PostgreSQL's limit of 65,535 bound parameters (9 a row). */
const ROWS_PER_INSERT = 1_000;

const WARNINGS = z.array(z.unknown());

/** The warnings of a record as the review reads them: the four texts `insertCalculation` keeps, and no other key. A value of another shape is a fault in the data, not a half-drawn notice. */
const storedWarningsSchema = z.array(z.strictObject({ code: z.string(), nodeId: z.string(), slNo: z.string(), label: z.string() }));

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
            // Built key by key, so a record can only ever hold the four texts of a warning, whatever the caller hands over.
            warnings: (calculation.warnings ?? []).map(({ code, nodeId, slNo, label }) => ({ code, nodeId, slNo, label })),
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

    findRecentLinked: (limit) =>
      withDatabaseErrors(async () => {
        const found = await db.estimate.findMany({
          where: { currentCalculationId: { not: null } },
          orderBy: [{ currentCalculation: { createdAt: 'desc' } }, { id: 'desc' }],
          take: limit,
          select: { inputsRevision: true, task: { select: { code: true } }, currentCalculation: { select: { id: true, inputsRevision: true } } },
        });
        return found.flatMap((estimate) =>
          estimate.currentCalculation === null
            ? []
            : [{ id: estimate.currentCalculation.id, taskCode: estimate.task.code, inputsRevision: estimate.inputsRevision, calculationInputsRevision: estimate.currentCalculation.inputsRevision }],
        );
      }),

    findFigureBasis: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(estimateId)) return null;
        const found = await clientFor(db, tx).estimate.findUnique({
          where: { id: estimateId },
          select: { inputsRevision: true, currentCalculation: { select: { id: true, inputsRevision: true, configVersionId: true, createdAt: true } } },
        });
        return found === null ? null : { inputsRevision: found.inputsRevision, calculation: found.currentCalculation };
      }),

    findReviewFigures: (calculationId) =>
      withDatabaseErrors(async () => {
        if (!isUuid(calculationId)) return null;
        const found = await db.calculation.findUnique({
          where: { id: calculationId },
          select: {
            productValues: true,
            warnings: true,
            creator: { select: { name: true } },
            rows: { select: { nodeId: true, outputs: true }, orderBy: [{ sortIndex: 'asc' }, { id: 'asc' }] },
          },
        });
        if (found === null) return null;
        return {
          productValues: productValuesSchema.parse(found.productValues),
          rows: found.rows.map((row) => ({ nodeId: row.nodeId, outputs: storedValuesSchema.parse(row.outputs) })),
          warnings: storedWarningsSchema.parse(found.warnings),
          madeByName: found.creator.name,
        };
      }),

    findCalculatedTotal: (calculationId, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(calculationId)) return null;
        const found = await clientFor(db, tx).calculation.findUnique({ where: { id: calculationId }, select: { productValues: true } });
        return found === null ? null : productValuesSchema.parse(found.productValues).totalPrice;
      }),

    findMasterSnapshot: (calculationId) =>
      withDatabaseErrors(async () => {
        if (!isUuid(calculationId)) return null;
        const found = await db.calculation.findUnique({ where: { id: calculationId }, select: { configVersionId: true, masterSnapshot: true } });
        return found === null ? null : { configVersionId: found.configVersionId, masterSnapshot: masterSnapshotSchema.parse(found.masterSnapshot) };
      }),

    findExportFigures: (calculationId, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(calculationId)) return null;
        const found = await clientFor(db, tx).calculation.findUnique({
          where: { id: calculationId },
          select: {
            masterSnapshot: true,
            productValues: true,
            rows: { select: { id: true, nodeId: true, parentId: true, sortIndex: true, slNo: true, inputs: true, imageId: true, outputs: true }, orderBy: [{ sortIndex: 'asc' }, { id: 'asc' }] },
          },
        });
        if (found === null) return null;
        return {
          productValues: productValuesSchema.parse(found.productValues),
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
          materials: masterSnapshotSchema.parse(found.masterSnapshot).materials.map(({ materialInDrawing, pricePerKg }) => ({ materialInDrawing, pricePerKg })),
        };
      }),

    findRowWorking: (calculationId, nodeId) =>
      withDatabaseErrors(async () => {
        if (!isUuid(calculationId) || !isUuid(nodeId)) return null;
        const found = await db.calculationRow.findUnique({
          where: { calculationId_nodeId: { calculationId, nodeId } },
          select: { inputs: true, outputs: true, calculation: { select: { masterSnapshot: true } } },
        });
        if (found === null) return null;
        return {
          masterSnapshot: masterSnapshotSchema.parse(found.calculation.masterSnapshot),
          inputs: storedValuesSchema.parse(found.inputs),
          outputs: storedValuesSchema.parse(found.outputs),
        };
      }),
  };
}
