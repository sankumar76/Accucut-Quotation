import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ROUTE_MANIFEST } from '@/server/http/route-manifest';
import { assignedTaskSchema, reassignedTaskSchema, taskDetailSchema, taskQueueSchema } from '@/server/views/schemas/tasks';
import { calculateAnswerSchema, estimateCustomerSchema, markQuotedAnswerSchema, quotedMarkerSchema } from '@/server/views/schemas/estimates';
import { formResponseSchema, savedInputsSchema } from '@/server/views/schemas/form';
import { addedNodeSchema, nodeDetailSchema, partsTreeSchema, treePartSchema } from '@/server/views/schemas/tree';

/**
 * CR-01 item 7C, AC-8 (AQP-400; NFR-002; ADR-008; architecture section 4.12 c): **the `quoted` field exists only in the Lead and Admin schemas.** The Engineer's schemas carry the status word Quoted and nothing
 * more, and every one of them is strict, so a handler that tried to send `quoted` to an Engineer would fail the parse. And **no file an Engineer's page or route reaches imports the code of Mark as quoted**:
 * the service and the browser's call are named here with the only files that may import them. A new importer fails this test until it is classed.
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

/** The answers an Engineer can be given that carry a task or an estimate: none may have a `quoted` key. */
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

describe('AC-8: `quoted` is in no schema an Engineer is answered with', () => {
  it.each(ENGINEER_REACHABLE)('%s has no `quoted` key and no marker field', (_title, schema) => {
    const keys = jsonKeysOf(schema);
    for (const name of ['quoted', 'quotedAt', 'quotedBy', 'quotedByName']) expect(keys.has(name), name).toBe(false);
  });

  it('the answer of Mark as quoted carries it, and holds a time and a name: no price, no figure, no ID', () => {
    const keys = jsonKeysOf(markQuotedAnswerSchema);
    expect(keys.has('quoted')).toBe(true);
    expect([...jsonKeysOf(quotedMarkerSchema)].sort()).toEqual(['at', 'byName']);
    expect([...keys].sort()).toEqual(['at', 'byName', 'quoted', 'status']);
  });

  it('every schema that carries it is strict: a key that is not named is an error, and the status is the one word QUOTED', () => {
    const good = { status: 'QUOTED', quoted: { at: '2026-11-23T04:30:00.000Z', byName: 'Kiran Bose' } };
    expect(markQuotedAnswerSchema.safeParse(good).success).toBe(true);
    expect(markQuotedAnswerSchema.safeParse({ ...good, price: '1000.00' }).success).toBe(false);
    expect(markQuotedAnswerSchema.safeParse({ ...good, quoted: { ...good.quoted, userId: 'u' } }).success).toBe(false);
    expect(markQuotedAnswerSchema.safeParse({ ...good, status: 'APPROVED' }).success).toBe(false);
    expect(markQuotedAnswerSchema.safeParse({ ...good, quoted: { ...good.quoted, byName: '' } }).success).toBe(false);
  });
});

describe('AC-2, AC-8: the route of Mark as quoted lists no Engineer', () => {
  it('POST /api/v1/estimates/[id]/quoted is for the Lead and the Admin alone, and is implemented', () => {
    const rows = ROUTE_MANIFEST.filter((row) => row.path === '/api/v1/estimates/[id]/quoted');
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ kind: 'api', methods: ['POST'], roles: ['ADMIN', 'LEAD'], status: 'implemented' });
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

/** The modules of Mark as quoted, by the text that imports them, and the only files in `src` that may import each. */
const IMPORTERS: ReadonlyArray<readonly [module: RegExp, allowed: ReadonlyArray<string>]> = [
  [/from '[^']*[/]services[/]estimate-status-service'/, ['src/server/composition.ts']],
  // CR-01 item 7D (AQP-401): the same service holds Ignore and Restore, so their two routes ask for it as well, for the Lead and the Admin alone.
  [/getEstimateStatusService/, ['src/app/api/v1/estimates/[id]/ignore/route.ts', 'src/app/api/v1/estimates/[id]/quoted/route.ts', 'src/app/api/v1/estimates/[id]/restore/route.ts', 'src/server/composition.ts']],
  [/from '[^']*[/]estimates[/]mark-quoted-client'/, ['src/components/features/estimate-quote/mark-quoted-dialog.tsx']],
  [/['"]\.[/]mark-quoted-dialog['"]/, ['src/components/features/estimate-quote/mark-quoted-button.tsx']],
  [/from '[^']*[/]estimate-quote[/]mark-quoted-button'/, ['src/components/features/estimate-review/review-actions.tsx']],
  [/from '[^']*[/]estimate-quote[/]mark-quoted-ids'/, ['src/components/features/estimate-review/estimate-review.tsx', 'src/components/features/estimate-review/review-actions.tsx']],
];

describe('AC-8: only the Lead\'s and the Admin\'s code imports Mark as quoted', () => {
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

  it('SCR-05, the Engineer\'s workspace, imports nothing of Mark as quoted', () => {
    for (const path of sources.filter((candidate) => candidate.startsWith('src/components/features/estimate-workspace/') || candidate.startsWith('src/server/views/engineer-'))) {
      expect(texts.get(path), path).not.toMatch(/mark-quoted|markQuoted|estimate-status-service|getEstimateStatusService/);
    }
  });
});
