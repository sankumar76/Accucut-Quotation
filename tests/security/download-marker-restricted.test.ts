import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ROUTE_MANIFEST } from '@/server/http/route-manifest';
import { assignedTaskSchema, reassignedTaskSchema, taskDetailSchema, taskQueueSchema } from '@/server/views/schemas/tasks';
import { calculateAnswerSchema, estimateCustomerSchema } from '@/server/views/schemas/estimates';
import { formResponseSchema, savedInputsSchema } from '@/server/views/schemas/form';
import { addedNodeSchema, nodeDetailSchema, partsTreeSchema, treePartSchema } from '@/server/views/schemas/tree';
import { downloadMarkersSchema, downloadMarkerSchema } from '@/server/views/schemas/download-marker';
import { exportSummarySchema } from '@/server/views/schemas/export';

/**
 * STORY-CR01.7E AC-6 (NFR-002; ADR-008; architecture section 4.12 d): the download marker is for a Lead and an Admin only. **The `download` field exists only in the Lead and Admin schemas**, so a schema an Engineer is
 * answered with has no key for it, and every one of them is strict, so a handler that tried to send one would fail the parse. And **no file that an Engineer's page or route reaches imports the marker's code**: the chip, the
 * marker's pure rule, the reader of the browser, the repository and the service are named here with the only files that may import them. A new importer fails this test until it is classed.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Every key named anywhere in a schema's JSON description (properties, nested objects, array items, unions). */
function keysOf(node: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) keysOf(item, found);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties' && typeof value === 'object' && value !== null) for (const name of Object.keys(value)) found.add(name);
      keysOf(value, found);
    }
  }
  return found;
}

const jsonKeysOf = (schema: z.ZodType): Set<string> => keysOf(z.toJSONSchema(schema, { unrepresentable: 'any', io: 'output' }));

/** The answers an Engineer can be given that carry a task or an estimate: none may have a `download` key. */
const ENGINEER_REACHABLE: ReadonlyArray<readonly [string, z.ZodType]> = [
  ['the queue (GET /api/v1/tasks)', taskQueueSchema],
  ['the task detail (GET /api/v1/tasks/{id})', taskDetailSchema],
  ['an assigned task', assignedTaskSchema],
  ['a reassigned task', reassignedTaskSchema],
  ['the customer of an estimate', estimateCustomerSchema],
  ['the answer of Calculate', calculateAnswerSchema],
  ['the parts tree', partsTreeSchema],
  ['one part of the tree', treePartSchema],
  ['an added node', addedNodeSchema],
  ['the detail of a part', nodeDetailSchema],
  ['the part form', formResponseSchema],
  ['the saved inputs', savedInputsSchema],
];

describe('AC-6: the marker is in no schema an Engineer is answered with', () => {
  it.each(ENGINEER_REACHABLE)('%s has no `download` key and no marker field', (_title, schema) => {
    const keys = jsonKeysOf(schema);
    for (const name of ['download', 'downloads', 'downloadedBy', 'downloadedAt', 'downloadMarker']) expect(keys.has(name), name).toBe(false);
  });

  it('the schemas that carry it do: the export summary (SCR-10) and the markers of the Closed tab', () => {
    expect(jsonKeysOf(exportSummarySchema).has('download')).toBe(true);
    expect(jsonKeysOf(downloadMarkersSchema).has('marker')).toBe(true);
  });

  it('the marker schema holds a kind, a count and who and when: no price, no figure, no ID', () => {
    expect([...jsonKeysOf(downloadMarkerSchema)].sort()).toEqual(['at', 'byName', 'count', 'kind', 'last']);
  });

  it('every schema that carries it is strict: a key that is not named is an error', () => {
    expect(downloadMarkerSchema.safeParse({ kind: 'none', approvalId: 'x' }).success).toBe(false);
    expect(downloadMarkerSchema.safeParse({ kind: 'downloaded', count: 1, last: { byName: 'X', at: '2026-11-23T04:30:00.000Z', userId: 'u' } }).success).toBe(false);
    expect(downloadMarkersSchema.safeParse({ markers: [], extra: 1 }).success).toBe(false);
  });
});

describe('AC-6: the routes that carry the marker list no Engineer', () => {
  it.each(['/api/v1/download-markers', '/api/v1/estimates/[id]/export-summary', '/api/v1/estimates/[id]/export', '/estimates/[code]/export'])('%s is for the Lead and the Admin alone', (path) => {
    const rows = ROUTE_MANIFEST.filter((row) => row.path === path);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.roles).toEqual(['ADMIN', 'LEAD']);
  });
});

/** Source files, depth first, under a folder of the repository. */
function filesUnder(folder: string, found: string[] = []): string[] {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) filesUnder(path, found);
    else if (/\.(ts|tsx)$/.test(name)) found.push(relative(ROOT, path).replaceAll('\\', '/'));
  }
  return found;
}

/** The modules of the marker, by the text that imports them, and the only files in `src` that may import each. */
const IMPORTERS: ReadonlyArray<readonly [module: RegExp, allowed: ReadonlyArray<string>]> = [
  [
    /from '[^']*[/]download-chip'/,
    [
      'src/components/features/estimate-export/estimate-export.tsx',
      'src/components/features/estimate-review/estimate-review.tsx',
      'src/components/features/queues/queue-list.tsx',
    ],
  ],
  [
    /from '[^']*[/]download-marker-view'/,
    [
      'src/components/features/estimate-review/estimate-review.tsx',
      'src/components/shared/download-chip.tsx',
      'src/lib/tasks/download-markers-client.ts',
    ],
  ],
  [/from '[^']*[/]download-markers-client'/, ['src/app/(portal)/queue/page.tsx', 'src/components/features/queues/queue-list.tsx', 'src/components/features/queues/queue-screen.tsx']],
  [
    /from '[^']*[/]repositories[/]download-repository'/,
    ['src/server/composition.ts', 'src/server/services/download-marker-service.ts', 'src/server/services/export-service.ts'],
  ],
  [/from '[^']*[/]services[/]download-marker-service'/, ['src/server/composition.ts']],
  [/getDownloadMarkerService/, ['src/app/(portal)/estimates/[code]/review-page.tsx', 'src/app/(portal)/queue/page.tsx', 'src/app/api/v1/download-markers/route.ts', 'src/server/composition.ts']],
];

describe('AC-6: only the Lead\'s and the Admin\'s code imports the marker', () => {
  const sources = filesUnder(join(ROOT, 'src')).filter((path) => !path.startsWith('src/generated/'));
  // Read once: the source tree read again for each test would run past a test's time.
  const texts = new Map<string, string>();
  beforeAll(() => {
    for (const path of sources) texts.set(path, readFileSync(join(ROOT, path), 'utf8'));
  }, 60_000);

  it.each(IMPORTERS.map(([module, allowed]) => [String(module), module, allowed] as const))('%s is imported only by %j', (_title, module, allowed) => {
    const importers = sources.filter((path) => module.test(texts.get(path) ?? '')).sort();
    expect(importers).toEqual([...allowed].sort());
  });

  it('SCR-05, the Engineer\'s workspace, imports neither the chip nor the marker service', () => {
    for (const path of sources.filter((candidate) => candidate.startsWith('src/components/features/estimate-workspace/') || candidate.startsWith('src/server/views/engineer-'))) {
      expect(texts.get(path), path).not.toMatch(/download-chip|download-marker|getDownloadMarkerService/);
    }
  });
});
