import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bundleExportWorker } from '../../scripts/lib/export-worker-bundle';
import { buildTree500 } from './builders/tree500';
import { incompressiblePicture } from './builders/export-pictures';
import { createConfigRepository } from '../../src/server/repositories/config-repository';
import { createDownloadRepository } from '../../src/server/repositories/download-repository';
import { createExportRepository } from '../../src/server/repositories/export-repository';
import { createImageRepository } from '../../src/server/repositories/image-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '../../src/server/services/config-service';
import { createExportService, type ExportService } from '../../src/server/services/export-service';
import type { ExportBuilder } from '../../src/server/export/thread-runner';

import { addTree500Estimate } from './calculate-tree';
import { type CalculationDatabase, openCalculationDatabase } from './calculation-database';
import { defined } from './defined';

/**
 * What the export timings of STORY-07.05 stand on: a throwaway migrated database, the **real export service** over the real repositories (the state and the figures read in one repeatable-read
 * transaction, the pictures read 50 at a time, as `GET /api/v1/estimates/{id}/export` reads them), a builder of the caller's choosing, and calculated estimates whose parts each carry an incompressible
 * picture of 199 KB. An estimate is built through the owner, outside what a test times. The bundle of the export thread is made once, in a folder of its own that `close` removes. Every value is invented.
 */

export interface ExportPerfWorld {
  readonly db: CalculationDatabase;
  /** The Lead who asks for the file. */
  readonly lead: { readonly id: string; readonly role: 'LEAD' };
  /** The thread's bundle, for `createThreadBuilder`. */
  readonly bundle: string;
  /** The export service over the real repositories, taking its places from this builder. */
  exporter(builder: ExportBuilder): ExportService;
  /** A calculated estimate of `parts` parts (the first of the shape of the `tree500` fixture, so at most 500), each with a picture of `pictureBytes` bytes. Its ID. */
  calculatedEstimate(parts: number, pictureBytes?: number): Promise<string>;
  /** Drops the database and removes the bundle. */
  close(): Promise<void>;
}

export async function openExportPerfWorld(): Promise<ExportPerfWorld> {
  const scratch = mkdtempSync(join(tmpdir(), 'export-perf-'));
  try {
    const bundle = bundleExportWorker(process.cwd(), join(scratch, 'export-worker.mjs'));
    const db = await openCalculationDatabase();
    const configurations = createConfigRepository(db.prisma);
    const cache = createConfigVersionCache();
    const images = createImageRepository(db.prisma);
    const engineer = { id: db.engineerId, role: 'ENGINEER' as const };

    return {
      db,
      lead: { id: db.personId, role: 'LEAD' },
      bundle,
      exporter: (builder) =>
        createExportService({
          header: createExportRepository(db.prisma),
          downloads: createDownloadRepository(db.prisma),
          nodes: db.nodes,
          calculations: db.calculations,
          approvals: db.approvals,
          images,
          configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
          transactions: db.transactions,
          builder,
          clock: { now: () => new Date('2026-11-21T12:00:00.000Z') },
        }),
      async calculatedEstimate(parts, pictureBytes) {
        const tree = buildTree500();
        const estimateId = await addTree500Estimate(db, { seed: tree.seed, nodes: tree.nodes.slice(0, parts) }, async (partId, index, owner) => {
          const bytes = incompressiblePicture(index, pictureBytes);
          const stored = await db.owner.query<{ id: string }>(
            `INSERT INTO part_images (estimate_id, sha256, mime, bytes, size_bytes, file_name) VALUES ($1::uuid, $2, 'image/png', $3, $4, 'invented.png') RETURNING id::text`,
            [owner, createHash('sha256').update(bytes).digest('hex'), Buffer.from(bytes), bytes.byteLength],
          );
          await db.owner.query('UPDATE estimate_nodes SET image_id = $2::uuid WHERE id = $1::uuid', [partId, defined(stored.rows[0]).id]);
        });
        await db.service.calculate(engineer, estimateId);
        return estimateId;
      },
      async close() {
        try {
          await db.close();
        } finally {
          rmSync(scratch, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    throw error;
  }
}
