import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPORT_RETRY_AFTER_SECONDS, ExportBusyError } from '@/lib/errors';
import { LARGE_EXPORT_PARTS, createThreadBuilder } from '@/server/export/thread-runner';

import { openExportPerfWorld, type ExportPerfWorld } from '../support/export-perf-world';

/**
 * STORY-07.05 AC-3 (the concurrency gate of architecture section 4.6, built in STORY-07.02, tested here): two exports of an estimate **over 100 nodes** asked for at the same moment. One is given the place
 * for a large build and the other is refused 503 `EXPORT_BUSY`, never queued, and while the build runs the portal stays responsive: a request that needs the main thread (a read from PostgreSQL through the
 * same pool the routes use, as `GET /api/health` makes) is answered within 1 second every time it is asked, and the event loop is never held for that long. A third export, asked for once the first has ended,
 * is given its file: the place was given back.
 *
 * What is run is `getFile` of the real export service with the production places (`createThreadBuilder` with its defaults: two threads, one large build at a time). The `Retry-After` header itself is the
 * route's (`tests/unit/export-route.test.ts`); here the refusal carries the status 503, the code and the seconds the header is made from. The probe is a database round trip and not the HTTP route, because the
 * test calls the service and not a server: it shows that the build does not hold the main thread, which is what the portal's other requests need. Every value is invented.
 */

const PARTS = LARGE_EXPORT_PARTS + 20;
const PICTURE_BYTES = 199 * 1024;
const PROBE_EVERY_MS = 50;
const RESPONSIVE_WITHIN_MS = 1000;
const MIN_PROBES = 5;

let world: ExportPerfWorld;
let estimateId: string;

beforeAll(async () => {
  world = await openExportPerfWorld();
  estimateId = await world.calculatedEstimate(PARTS, PICTURE_BYTES);
}, 300_000);

afterAll(async () => {
  await world.close();
});

describe('@perf NFR-010: two exports of an estimate over 100 nodes at once (the concurrency gate)', { timeout: 600_000 }, () => {
  it('gives the file to one and a 503 EXPORT_BUSY with Retry-After seconds to the other, the portal answers within 1 s throughout, and the place is free afterwards', async () => {
    const exporter = world.exporter(createThreadBuilder({ entry: world.bundle }));
    const probes: number[] = [];
    let lag = 0;
    let building = true;
    const probe = (async () => {
      while (building) {
        const started = performance.now();
        await world.db.prisma.$queryRaw`SELECT 1`;
        probes.push(performance.now() - started);
        await sleep(PROBE_EVERY_MS);
      }
    })();
    const watchLag = (async () => {
      while (building) {
        const started = performance.now();
        await sleep(PROBE_EVERY_MS);
        lag = Math.max(lag, performance.now() - started - PROBE_EVERY_MS);
      }
    })();

    const outcomes = await Promise.allSettled([exporter.getFile(world.lead, estimateId), exporter.getFile(world.lead, estimateId)]);
    building = false;
    await Promise.all([probe, watchLag]);

    const given = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const refused = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(given).toHaveLength(1);
    expect(refused).toHaveLength(1);
    const reason: unknown = refused[0]?.reason;
    expect(reason).toBeInstanceOf(ExportBusyError);
    expect(reason).toMatchObject({ httpStatus: 503, code: 'EXPORT_BUSY', retryAfterSeconds: EXPORT_RETRY_AFTER_SECONDS });
    expect(given[0]?.value.bytes.byteLength).toBeGreaterThan(PARTS * PICTURE_BYTES * 0.9);

    // The portal stayed responsive while the build ran (it was asked often enough to mean something).
    expect(probes.length).toBeGreaterThanOrEqual(MIN_PROBES);
    const slowest = Math.max(...probes);
    process.stdout.write(`\nNFR-010 concurrency gate, ${String(PARTS)} nodes: ${String(probes.length)} probes during the build, slowest ${slowest.toFixed(1)} ms, event loop held at most ${lag.toFixed(1)} ms.\n`);
    expect(slowest).toBeLessThan(RESPONSIVE_WITHIN_MS);
    expect(lag).toBeLessThan(RESPONSIVE_WITHIN_MS);

    // The place was given back: the same request now gets its file.
    const again = await exporter.getFile(world.lead, estimateId);
    expect(again.bytes.byteLength).toBeGreaterThan(PARTS * PICTURE_BYTES * 0.9);
  });
});
