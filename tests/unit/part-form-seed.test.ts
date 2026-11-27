import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFormBodies, readPartBody, seedOf, type SeedServices } from '@/app/(portal)/estimates/[code]/part-form-seed';
import { parseForm, parseMaterials, parsePartInputs } from '@/lib/estimates/form-client';
import { parseTreatmentOptions } from '@/lib/estimates/treatment-options-client';
import { formBody, materialOptionsBody, nodeBody, treatmentOptionsBody } from '@/server/views/part-form-bodies';

import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * DEF-141 (DL-455 2 (a), (b)): the Lead's review page hands the part form its four answers as props. They must be **the routes' own answers**: the same services as the same viewer, built by the same code and the
 * same strict schemas, so the same shapes with no added field, and read by the form's own readers. The four routes are called through the real `withRoute` and the real session over the same in-memory estimate, masters
 * and form registry as the page's reads, and what they answer is compared, byte for byte as JSON, with what the page reads. A fault in a read gives no seed, so the form reads from the server as it did. Every name and ID is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService, getMastersService: () => shared.mastersService };
});

const ORIGIN = 'https://portal.example.test';
const { GET: getForm } = await import('@/app/api/v1/estimates/[id]/form/route');
const { GET: getNode } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route');
const { GET: getMaterials } = await import('@/app/api/v1/options/materials/route');
const { GET: getTreatments } = await import('@/app/api/v1/options/treatments/route');

const estimate = () => defined(harness.estimateWorld.estimates[0]);
const request = (path: string): Request => new Request(`${ORIGIN}${path}`, { method: 'GET', headers: { origin: ORIGIN } });
const forEstimate = (id: string) => ({ params: Promise.resolve({ id }) });
const forNode = (id: string, nodeId: string) => ({ params: Promise.resolve({ id, nodeId }) });
const services = (): SeedServices => ({ estimates: harness.estimateService, masters: harness.mastersService });

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
});

afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  harness.estimateWorld.nodes.splice(0, harness.estimateWorld.nodes.length, { id: held.id, estimateId: held.id, parentId: null, sortIndex: 0, revision: 1, inputs: {} });
});

describe('the seed is the routes\' own answers (DL-455 2 (a))', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s, the four bodies equal what the four routes answer, as JSON', async (role) => {
    harness.signInAs(role);
    const id = estimate().id;
    const viewer = { id: harness.idOf[role], role };
    const [formResponse, nodeResponse, materialsResponse, treatmentsResponse] = await Promise.all([
      getForm(request(`/api/v1/estimates/${id}/form`), forEstimate(id)),
      getNode(request(`/api/v1/estimates/${id}/nodes/${id}`), forNode(id, id)),
      getMaterials(request('/api/v1/options/materials'), undefined as never),
      getTreatments(request('/api/v1/options/treatments'), undefined as never),
    ]);
    for (const response of [formResponse, nodeResponse, materialsResponse, treatmentsResponse]) expect(response.status).toBe(200);

    const bodies = defined(await readFormBodies(services(), viewer, id));
    const part = await readPartBody(services(), viewer, id, id);
    expect(JSON.parse(JSON.stringify(bodies.form))).toEqual(await formResponse.json());
    expect(JSON.parse(JSON.stringify(part))).toEqual(await nodeResponse.json());
    expect(JSON.parse(JSON.stringify(bodies.materials))).toEqual(await materialsResponse.json());
    expect(JSON.parse(JSON.stringify(bodies.treatments))).toEqual(await treatmentsResponse.json());
  });

  it('the form reads each body with its own reader, and a body the readers refuse is not a seed', async () => {
    const id = estimate().id;
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const bodies = defined(await readFormBodies(services(), viewer, id));
    const part = await readPartBody(services(), viewer, id, id);
    expect(parseForm(bodies.form)).not.toBeNull();
    expect(parseMaterials(bodies.materials)).not.toBeNull();
    expect(parseTreatmentOptions(bodies.treatments)).not.toBeNull();
    expect(parsePartInputs(part)).toMatchObject({ id });
    expect(parseForm({ sections: 'x', lastSavedAt: null })).toBeNull();
  });

  it('carries no rate, cost or formula: the strict schemas refuse an added field in each of the four', () => {
    expect(() => formBody({ sections: [], lastSavedAt: null, rate: '1.00' } as never)).not.toThrow();
    expect(formBody({ sections: [], lastSavedAt: null, rate: '1.00' } as never)).toEqual({ sections: [], lastSavedAt: null });
    expect(() => materialOptionsBody([{ id: 'a', name: 'b', materialConsidered: null, pricePerKg: '90.00' }] as never)).toThrow();
    expect(() => treatmentOptionsBody([{ id: 'a', name: 'b', rate: '1.00' }] as never)).toThrow();
    expect(() => nodeBody({ id: 'not-an-id', inputs: {} } as never)).toThrow();
  });
});

describe('what the page does when a read fails', () => {
  it('gives no seed (the form reads from the server) and logs the kind of the fault only', async () => {
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const id = estimate().id;
    const broken: SeedServices = { estimates: { ...services().estimates, getForm: () => Promise.reject(new TypeError('connection refused to invented-host')) }, masters: services().masters };
    expect(await readFormBodies(broken, viewer, id)).toBeNull();
    const failing: SeedServices = { ...services(), estimates: { ...services().estimates, getNode: () => Promise.reject(new Error('invented fault')) } };
    expect(await readPartBody(failing, viewer, id, id)).toBeNull();
    const bodies = defined(await readFormBodies(services(), viewer, id));
    expect(seedOf(id, id, bodies, null)).toBeUndefined();
    expect(seedOf(id, id, null, { id })).toBeUndefined();
    const logged = await import('@/lib/logger');
    expect(JSON.stringify(vi.mocked(logged.logger.warn).mock.calls)).not.toContain('invented-host');
  });

  it('a seed names the estimate, the part and the four bodies, and nothing else', async () => {
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const id = estimate().id;
    const bodies = defined(await readFormBodies(services(), viewer, id));
    const part = await readPartBody(services(), viewer, id, id);
    const seed = defined(seedOf(id, id, bodies, part));
    expect(Object.keys(seed).sort()).toEqual(['estimateId', 'form', 'materials', 'part', 'partId', 'treatments']);
  });
});
