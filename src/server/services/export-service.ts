import { assertNever } from '../../lib/assert-never';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { exportFileName } from '../../lib/export/file-name';
import { figureState, readFiguresWhenCurrent, type FigureState } from '../../lib/estimate/figure-state';
import { NOT_CALCULATED_REFUSAL, OUT_OF_DATE_REFUSAL, refusalMessage, type RefusalWords } from '../../lib/export/refusal-words';
import { partNameOf, typedText } from '../../lib/estimate/part-name';
import { buildTree } from '../../lib/estimate/tree';
import { fieldLetter, findSystemField } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { Clock } from '../../lib/time';
import { exportColumnsOf, SHEET_NAME } from '../export/export-columns';
import { XLSX_MIME, type ExportFooter, type ExportModel, type ExportRow } from '../export/export-model';
import { isEmbeddableMime, readPictures } from '../export/image-batches';
import { approvedPriceOf, footerOf, withProductCells, type ProductFigures } from '../export/product-cells';
import { exportRowsOf } from '../export/rows';
import { summaryFiguresOf, type SummaryApproval } from '../export/summary-figures';
import type { ExportBuilder } from '../export/thread-runner';
import type { ApprovalRepository } from '../repositories/approval-repository';
import type { CalculationRepository, ExportFigures, FigureBasis } from '../repositories/calculation-repository';
import type { EstimateNodeRepository } from '../repositories/estimate-node-repository';
import type { ExportRepository } from '../repositories/export-repository';
import type { ImageRepository } from '../repositories/image-repository';
import type { Transaction, TransactionOptions, TransactionRunner } from '../repositories/transaction';
import { exportFileSchema, exportSummarySchema, type ExportFileView, type ExportSummaryView } from '../views/schemas/export';

import type { ConfigVersion } from './config-service';
import type { EstimateViewer } from './estimate-service';

/**
 * The Excel export of an estimate (STORY-07.01; FR-066, FR-071, FR-070 role part; NFR-002, NFR-027; ADR-012; architecture sections 4.6 and 6 "Export", "Export summary"): the summary SCR-10 shows and the
 * `.xlsx` in the worksheet's own layout, for the Lead and the Admin.
 *
 * **Restricted** (ADR-008, NFR-002): the file is the one thing that carries the layout of cost columns and, from STORY-07.02, their figures, so this service is classed as blocked for every Engineer view
 * (`tests/security/engineer-import-rule.test.ts`) and `server-only` code reaches it only through the composition. Who may call is decided before it is reached (the manifest row, `withRoute`,
 * `authorizePage`), and it refuses an Engineer **again before it reads anything**, by name and closed by `assertNever`: a role added one day fails to compile here and is refused at run time.
 *
 * **Scope of STORY-07.02 and 07.03**: the file holds the header row and one row per node of the estimate's calculation, in depth-first order, with the part's picture and every column (hidden lines as 0), BL2, BN2
 * and BO2 in row 2, and the total Tool Cost in a footer (`product-cells.ts`). BL2, BN2 and the footer are the calculation's stored product values, **read with its rows through the one read of the figures**, so they equal
 * SCR-06's to the paisa. **BO2 is read through `findLatestApproval`** (architecture section 4.10, the ruling on AQP-330) and by no query of this file's own: it is the latest approval row, and none once its price was
 * removed; a cancelled approval leaves the file. The summary's figures are read back from the cells of that same model (`summary-figures.ts`). The refusal screen, its words and its tests are STORY-07.04's.
 *
 * **Figures only while they are current** (architecture sections 4.6 and 10; the ordering condition of AQP-332): the calculation's rows are read **only through `readFiguresWhenCurrent`** of
 * `lib/estimate/figure-state.ts`, from the one calculation the estimate is linked to, and the file is built from the registry version **that calculation was made with**. In any other state nothing is read
 * and the answer is a 409 with fixed words (`NOT_CALCULATED`, `EXPORT_OUT_OF_DATE`), so a file can never carry out-of-date figures.
 *
 * **One snapshot (STORY-07.04 AC-4; architecture section 4.6 "never taken from an earlier `export-summary`")**: the state and everything the file is made of that depends on it (the calculation's rows, the latest
 * approval for BO2, and for the summary the parts) are read in **one repeatable-read transaction**, so a Recalculate, an input change or a cancelled approval that commits between two of those reads cannot give a
 * file made of two moments, and the state the file is refused or allowed by is the state of the figures it holds. The transaction ends when the reads end: the workbook is built afterwards, from what was read, in
 * the thread (a build takes seconds, up to 120 s, and a transaction may not: ADR-012, the 10 s limit of `transaction.ts`). Nothing else decides: the one refusal is `refusalOf`, and the state is never taken from the summary.
 *
 * **Bounded** (review QS-01, GitHub issue 440): a place is taken (`ExportBuilder.admit`, counted from the number of rows, before any picture is read) and given back in a `finally`; the pictures are then
 * read 50 at a time (`image-batches.ts`) and the model is built and sent to the thread. The file is built from the plain `ExportModel` by the place's `build`, which the composition makes a
 * `worker_threads` thread (`thread-runner.ts`) and a test makes the build function itself.
 */

export interface ExportService {
  /** `GET /api/v1/estimates/{id}/export-summary`. 403 for an Engineer, before anything is read; 404 for an estimate that does not exist (or an ID that is not one). */
  getSummary(viewer: EstimateViewer, estimateId: string): Promise<ExportSummaryView>;
  /** `GET /api/v1/estimates/{id}/export`. The same refusals. The name carries the IST date of this moment. */
  getFile(viewer: EstimateViewer, estimateId: string): Promise<ExportFileView>;
}

export interface ExportDependencies {
  readonly header: ExportRepository;
  /** The parts as they are now, for the summary (SCR-10 lists them before any file is asked for). */
  readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
  /** The state of the figures and the calculation's own rows. The rows are read only through the figure state. */
  readonly calculations: Pick<CalculationRepository, 'findFigureBasis' | 'findExportFigures'>;
  /** Opens the one repeatable-read transaction in which the state and the figures are read (STORY-07.04 AC-4). */
  readonly transactions: TransactionRunner;
  /** BO2: the estimate's latest approval, through the one function every reader of BO uses (it answers none once the price was removed). Not a figure of the calculation: never through the figure state. */
  readonly approvals: Pick<ApprovalRepository, 'findLatestApproval'>;
  /** The pictures of the estimate, by batch. */
  readonly images: Pick<ImageRepository, 'readMany' | 'findMimes'>;
  readonly configuration: {
    /** The version in force now, for the summary. */
    readonly current: () => Promise<ConfigVersion>;
    /** The version a calculation was made with, by its ID: the file's columns and the letters of its cells. */
    readonly byId: (id: string) => Promise<ConfigVersion>;
  };
  /** Takes the place of a build and turns the model into the file: a thread in production. */
  readonly builder: ExportBuilder;
  readonly clock: Clock;
}

/** What the person is told when there is no file to give: the fixed words of the 409 of architecture section 4.6, the same sentences SCR-10 shows (`lib/export/refusal-words.ts`, STORY-07.04 AC-1, AC-2, AC-5). */
const REFUSALS: Readonly<Record<Exclude<FigureState, 'current'>, RefusalWords>> = {
  none: NOT_CALCULATED_REFUSAL,
  'out-of-date': OUT_OF_DATE_REFUSAL,
};

/** Both reads are taken from one snapshot of the database: see the header, "One snapshot". */
const SNAPSHOT: TransactionOptions = { isolation: 'repeatable-read' };

/** Before any read, and by name: only the Lead and the Admin are let through (CR-33, NFR-002). */
function assertMayExport(viewer: EstimateViewer): void {
  switch (viewer.role) {
    case 'ADMIN':
    case 'LEAD':
      return;
    case 'ENGINEER':
      throw new ForbiddenError();
    default:
      return assertNever(viewer.role, 'role');
  }
}

/** The 409 of a state with no file to give: the one refusal of the download, for the file and, through the same words, the screen. */
const refusalOf = (state: Exclude<FigureState, 'current'>): ConflictError => new ConflictError(refusalMessage(REFUSALS[state]), { code: REFUSALS[state].code });

/** The state of an estimate's figures from its basis: `none` while it has no calculation. */
const stateOf = ({ inputsRevision, calculation }: FigureBasis): FigureState =>
  calculation === null ? 'none' : figureState({ inputsRevision, calculationInputsRevision: calculation.inputsRevision });

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/** What the summary says of the file's columns: the first letter, the last and how many, from the registry. */
function columnsOf(document: ConfigDocument): ExportSummaryView['columns'] {
  const columns = exportColumnsOf(document);
  const first = columns[0];
  const last = columns[columns.length - 1];
  // A registry with no field cannot be drawn: a fault in the data (a plain `Error`, a 500 with fixed words), never a file with no header.
  if (first === undefined || last === undefined) throw new Error('The configuration version has no fields.');
  return { first: first.letter, last: last.letter, count: columns.length };
}

/** The figures of the product that the file's own cells are made of: the calculation's stored values and BO as the file holds it. */
function productFiguresOf(figures: ExportFigures, approval: SummaryApproval | null): ProductFigures {
  return { ...figures.productValues, approvedPrice: approvedPriceOf(approval) };
}

export function createExportService({ header, nodes, calculations, approvals, images, configuration, builder, clock, transactions }: ExportDependencies): ExportService {
  async function nameOf(estimateId: string): Promise<string> {
    const found = await header.findHeader(estimateId);
    if (found === null) throw new NotFoundError();
    return exportFileName({ customerName: found.customerName, taskCode: found.code, now: clock.now() });
  }

  /** The calculation's rows, read **only through the figure state** and in this one place: in any other state `read` is not called. */
  const figuresOf = (state: FigureState, calculationId: string, tx: Transaction) => readFiguresWhenCurrent(state, () => calculations.findExportFigures(calculationId, tx));

  /** The node rows with row 2's cells, and the footer: the one place the two methods build what the file holds, so the summary can say nothing the file does not. */
  function cellsOf(document: ConfigDocument, figures: ExportFigures, approval: SummaryApproval | null, pictureIndexOf: (imageId: string) => number | undefined): { rows: ExportRow[]; footer: ExportFooter } {
    const rows = withProductCells(document, exportRowsOf({ document, rows: figures.rows, materials: figures.materials, pictureIndexOf }), productFiguresOf(figures, approval));
    return { rows, footer: footerOf(document, rows.length, figures.productValues.toolCostTotal) };
  }

  return {
    async getSummary(viewer, estimateId) {
      assertMayExport(viewer);
      const fileName = await nameOf(estimateId);
      // The state, the parts, the figures and BO2 from one snapshot (AC-4), so the page never says "current" over rows of another moment.
      const { state, calculation, records, figures, approval } = await transactions.run(async (tx) => {
        const basis = await calculations.findFigureBasis(estimateId, tx);
        if (basis === null) throw new NotFoundError();
        const found = basis.calculation;
        const current = stateOf(basis);
        const read = {
          state: current,
          calculation: found,
          records: await nodes.listNodes(estimateId, tx),
          figures: found === null ? null : await figuresOf(current, found.id, tx),
          approval: current === 'current' ? await approvals.findLatestApproval(estimateId, tx) : null,
        };
        if (current === 'current' && read.figures === null) throw new Error('The calculation linked to the estimate could not be read.');
        return read;
      }, SNAPSHOT);
      // While the figures are current the columns and the cells are the version the calculation was made with, as the file's are; otherwise the version in force now (no figure is shown). A version never changes: it is read outside the snapshot.
      const version = await (calculation !== null && state === 'current' ? configuration.byId(calculation.configVersionId) : configuration.current());
      const { document } = version;
      // A picture is counted only if the file can hold it, so the summary never promises a picture the file lacks (review SQR-01 of AQP-332).
      const imageIds = [...new Set(records.flatMap((record) => (record.imageId === null ? [] : [record.imageId])))];
      const types = imageIds.length === 0 ? [] : await images.findMimes(estimateId, imageIds);
      const embeddable = new Set(types.filter((type) => isEmbeddableMime(type.mime)).map((type) => type.id));
      const columns = columnsOf(document);
      const count = findSystemField(document, 'quantity');
      const shown = figures === null ? null : cellsOf(document, figures, approval, () => undefined);
      return exportSummarySchema.parse({
        fileName,
        partCount: records.length,
        pictureCount: records.filter((record) => record.imageId !== null && embeddable.has(record.imageId)).length,
        columns,
        rows: buildTree(records).map(({ node, slNo }) => {
          const typedCount = typedText(node.inputs, count);
          return { slNo, name: partNameOf(document, node.inputs), count: typedCount !== null && DECIMAL_TEXT.test(typedCount) ? typedCount : null };
        }),
        state,
        figures: shown === null ? null : summaryFiguresOf({ document, ...shown, approval }),
      });
    },

    async getFile(viewer, estimateId) {
      assertMayExport(viewer);
      const fileName = await nameOf(estimateId);
      // The state and what it lets out, read in one snapshot (AC-4): the file is refused, or made, from the state of the very figures it holds, never from the summary the page was drawn from. The rows and the
      // product's figures are read only while the state is current; BO2 is the latest approval (through `findLatestApproval`, which answers none once its price was removed).
      const { calculation, figures, approval } = await transactions.run(async (tx) => {
        const basis = await calculations.findFigureBasis(estimateId, tx);
        if (basis === null) throw new NotFoundError();
        const state = stateOf(basis);
        // Never calculated (`none`) or out of date: nothing is read and the one refusal is thrown (AC-1, AC-2).
        if (state !== 'current') throw refusalOf(state);
        const found = basis.calculation;
        if (found === null) throw new Error('A current state has a calculation.');
        const rows = await figuresOf(state, found.id, tx);
        if (rows === null) throw new Error('The calculation linked to the estimate could not be read.');
        return { calculation: found, figures: rows, approval: await approvals.findLatestApproval(estimateId, tx) };
      }, SNAPSHOT);
      // The version the calculation was made with, so the letters and columns are the ones its stored figures are keyed by (a version never changes: read outside the snapshot).
      const version = await configuration.byId(calculation.configVersionId);

      // The place is taken from the number of rows alone, before any picture is read (issue 440), and given back whatever happens next.
      const place = builder.admit(figures.rows.length);
      try {
        const pictures = await readPictures((ids) => images.readMany(estimateId, ids), figures.rows.flatMap((row) => (row.imageId === null ? [] : [row.imageId])));
        const imageField = version.document.fields.find((field) => field.kind === 'input' && field.dataType === 'image');
        const { rows, footer } = cellsOf(version.document, figures, approval, pictures.indexOf);
        const model: ExportModel = {
          sheetName: SHEET_NAME,
          columns: exportColumnsOf(version.document),
          rows,
          footer,
          ...(pictures.pictures.length > 0 && imageField !== undefined ? { pictures: pictures.pictures, pictureColumn: fieldLetter(imageField) } : {}),
        };
        const bytes = await place.build(model);
        return exportFileSchema.parse({ mime: XLSX_MIME, bytes, fileName });
      } finally {
        place.release();
      }
    },
  };
}
