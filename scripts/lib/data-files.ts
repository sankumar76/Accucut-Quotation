/**
 * Data-file allow-list (NFR-006, ADR-014, architecture section 5.5).
 *
 * The repository is public. Master data (rates, prices) must never enter it, and a spreadsheet,
 * a CSV or a JSON file is the usual way for it to arrive. Any tracked file with one of these
 * extensions must be on the list below, with a reason. The list is exact paths, not patterns, so
 * a new data file is always a deliberate, reviewed change to this file.
 */

// `.sql` is listed, with one path rule below for Prisma migrations (G6 attempt 2, QLT-16). `.yaml` is not:
// the workflow and Compose files are YAML, and it stays deferred to issue #19.
export const DATA_FILE_EXTENSIONS: ReadonlyArray<string> = [
  '.csv',
  '.tsv',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xlsb',
  '.xltx',
  '.xltm',
  '.ods',
  '.json',
  '.jsonl',
  '.ndjson',
  '.parquet',
  '.dump',
  '.sql',
  '.docx',
];

export interface AllowedDataFile {
  readonly path: string;
  readonly reason: string;
}

const D13 = 'tracked since c7576f0 by the delivery lead\'s decision D-13 (repository stays public)';

export const ALLOWED_DATA_FILES: ReadonlyArray<AllowedDataFile> = [
  // Documented exceptions: already in history, named so they cannot become a pattern.
  { path: 'AMADA-20261006.xlsx', reason: `Sample workbook, ${D13}` },
  { path: 'Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx', reason: `Word draft, ${D13}` },
  // Project and tooling configuration. Each holds settings, never data.
  { path: 'package.json', reason: 'npm manifest' },
  { path: 'package-lock.json', reason: 'npm lockfile' },
  { path: 'tsconfig.json', reason: 'TypeScript configuration' },
  { path: 'components.json', reason: 'shadcn/ui CLI settings (paths and the cn alias), architect ruling on AQP-28' },
  {
    path: '.gitleaks-baseline.json',
    reason:
      'Gitleaks baseline: the 7 accepted documentation findings (delivery lead, 2026-11-02). Fingerprints and locations only, no matched text',
  },
  { path: '.mcp.json', reason: 'Agent tooling configuration' },
  { path: '.claude/settings.json', reason: 'Agent tooling configuration' },
  { path: 'Agents/.mcp.json', reason: 'Agent tooling configuration' },
  { path: 'Agents/.claude/settings.json', reason: 'Agent tooling configuration' },
];

function hasDataExtension(path: string): boolean {
  const lower = path.toLowerCase();
  return DATA_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * The one path rule: a Prisma migration, which is generated SQL and holds structure, not data. Exactly
 * one folder below prisma/migrations and exactly the file name migration.sql; a dump, a seed file or a
 * second file in a migration folder is still refused.
 */
export const MIGRATION_PATH = /^prisma\/migrations\/[^/]+\/migration\.sql$/;

/** Returns the tracked paths that are data files and are not on the allow-list. */
export function findDisallowedDataFiles(
  trackedPaths: ReadonlyArray<string>,
  allowed: ReadonlyArray<AllowedDataFile> = ALLOWED_DATA_FILES,
): string[] {
  const allowedPaths = new Set(allowed.map((entry) => entry.path));
  return trackedPaths
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => hasDataExtension(path) && !allowedPaths.has(path) && !MIGRATION_PATH.test(path));
}
