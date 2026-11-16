import { assertNever } from '../../lib/assert-never';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { exportFileName } from '../../lib/export/file-name';
import { partNameOf, typedText } from '../../lib/estimate/part-name';
import { buildTree } from '../../lib/estimate/tree';
import { findSystemField } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { Clock } from '../../lib/time';
import { exportColumnsOf, headerOnlyModel } from '../export/export-columns';
import { XLSX_MIME } from '../export/export-model';
import type { BuildFile } from '../export/thread-runner';
import type { EstimateNodeRepository } from '../repositories/estimate-node-repository';
import type { ExportRepository } from '../repositories/export-repository';
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
 * **Scope of STORY-07.01**: the file holds the fixed header row of the registry's columns, and nothing below it (node rows, pictures and hidden lines are STORY-07.02, row 2 and the footer STORY-07.03, the
 * refusal until a calculation is current STORY-07.04), so **no calculated figure is read** and the file state is not looked at yet. The file is built from the plain `ExportModel` by `build`, which the
 * composition makes a `worker_threads` thread (`thread-runner.ts`) and a test makes the build function itself.
 */

export interface ExportService {
  /** `GET /api/v1/estimates/{id}/export-summary`. 403 for an Engineer, before anything is read; 404 for an estimate that does not exist (or an ID that is not one). */
  getSummary(viewer: EstimateViewer, estimateId: string): Promise<ExportSummaryView>;
  /** `GET /api/v1/estimates/{id}/export`. The same refusals. The name carries the IST date of this moment. */
  getFile(viewer: EstimateViewer, estimateId: string): Promise<ExportFileView>;
}

export interface ExportDependencies {
  readonly header: ExportRepository;
  readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
  readonly configuration: {
    /** The version in force now. STORY-07.04 reads the version a calculation was made with instead. */
    readonly current: () => Promise<ConfigVersion>;
  };
  /** Turns the model into the file: a thread in production. */
  readonly build: BuildFile;
  readonly clock: Clock;
}

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

export function createExportService({ header, nodes, configuration, build, clock }: ExportDependencies): ExportService {
  async function nameOf(estimateId: string): Promise<string> {
    const found = await header.findHeader(estimateId);
    if (found === null) throw new NotFoundError();
    return exportFileName({ customerName: found.customerName, taskCode: found.code, now: clock.now() });
  }

  return {
    async getSummary(viewer, estimateId) {
      assertMayExport(viewer);
      const fileName = await nameOf(estimateId);
      const [version, records] = await Promise.all([configuration.current(), nodes.listNodes(estimateId)]);
      const { document } = version;
      const count = findSystemField(document, 'quantity');
      return exportSummarySchema.parse({
        fileName,
        partCount: records.length,
        pictureCount: records.filter((record) => record.imageId !== null).length,
        columns: columnsOf(document),
        rows: buildTree(records).map(({ node, slNo }) => {
          const typedCount = typedText(node.inputs, count);
          return { slNo, name: partNameOf(document, node.inputs), count: typedCount !== null && DECIMAL_TEXT.test(typedCount) ? typedCount : null };
        }),
      });
    },

    async getFile(viewer, estimateId) {
      assertMayExport(viewer);
      const fileName = await nameOf(estimateId);
      const { document } = await configuration.current();
      const bytes = await build(headerOnlyModel(document));
      return exportFileSchema.parse({ mime: XLSX_MIME, bytes, fileName });
    },
  };
}
