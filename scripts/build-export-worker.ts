/**
 * Makes `.next/export-worker.mjs`, the file the export runs in its own thread (ADR-012; STORY-07.01 AC-5). `npm run build` runs it after `next build`, and the Playwright development server runs it before
 * `next dev`. The logic is in `scripts/lib/export-worker-bundle.ts`, which has a test.
 */
import { bundleExportWorker } from './lib/export-worker-bundle';

const written = bundleExportWorker();
process.stdout.write(`Export thread bundle: ${written}\n`);
