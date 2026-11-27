import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { readListBodies, readPartFormBodies, seedOf, type SeedServices } from '@/app/(portal)/estimates/[code]/part-form-seed';
import { parseForm, parseMaterials, parsePartInputs } from '@/lib/estimates/form-client';
import { parseTreeAnswer } from '@/lib/estimates/tree-client';
import { parseTreatmentOptions } from '@/lib/estimates/treatment-options-client';
import { formBody, materialOptionsBody, nodeBody, treatmentOptionsBody } from '@/server/views/part-form-bodies';

import { createEstimateService } from '@/server/services/estimate-service';

import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createAuditSink } from '../support/fake-audit-sink';
import { cloneSeedConfig, seedFieldAt } from '../support/seed-config';
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
const { GET: getTree } = await import('@/app/api/v1/estimates/[id]/tree/route');

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
  held.currentCalculationId = null;
  held.configVersionId = null;
  held.ignoredAt = null;
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

    const lists = defined(await readListBodies(services()));
    const row = defined(await readPartFormBodies(services(), viewer, id, id));
    expect(JSON.parse(JSON.stringify(row.form))).toEqual(await formResponse.json());
    expect(JSON.parse(JSON.stringify(row.part))).toEqual(await nodeResponse.json());
    expect(JSON.parse(JSON.stringify(lists.materials))).toEqual(await materialsResponse.json());
    expect(JSON.parse(JSON.stringify(lists.treatments))).toEqual(await treatmentsResponse.json());
  });

  it.each(['LEAD', 'ADMIN'] as const)('as %s the tree body of the page equals what GET /tree answers, as JSON, and the tree reader accepts it (the island\'s seed)', async (role) => {
    harness.signInAs(role);
    const id = estimate().id;
    const viewer = { id: harness.idOf[role], role };
    const response = await getTree(request(`/api/v1/estimates/${id}/tree`), forEstimate(id));
    expect(response.status).toBe(200);
    const row = defined(await readPartFormBodies(services(), viewer, id, id));
    expect(JSON.parse(JSON.stringify(row.tree))).toEqual(await response.json());
    expect(parseTreeAnswer(row.tree)).not.toBeNull();
    expect(Object.keys(defined(seedOf(id, id, defined(await readListBodies(services())), row, true))).sort()).toContain('tree');
    expect(Object.keys(defined(seedOf(id, id, defined(await readListBodies(services())), row))).sort()).not.toContain('tree');
  });

  it('the form reads each body with its own reader, and a body the readers refuse is not a seed', async () => {
    const id = estimate().id;
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const lists = defined(await readListBodies(services()));
    const row = defined(await readPartFormBodies(services(), viewer, id, id));
    expect(parseForm(row.form)).not.toBeNull();
    expect(parseMaterials(lists.materials)).not.toBeNull();
    expect(parseTreatmentOptions(lists.treatments)).not.toBeNull();
    expect(parsePartInputs(row.part)).toMatchObject({ id });
    expect(parseForm({ sections: 'x', lastSavedAt: null })).toBeNull();
  });

  it('the reader accepts every field of the real registry (PRF-827-06): a body it refused would make the form read from the server again, and the four reads would come back unseen', async () => {
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const row = defined(await readPartFormBodies(services(), viewer, estimate().id, estimate().id));
    const sent = (row.form as { sections: ReadonlyArray<{ fields: ReadonlyArray<{ rule: { type: string } }> }> }).sections.flatMap((section) => section.fields);
    const read = defined(parseForm(row.form)).sections.flatMap((section) => section.fields);
    expect(read).toHaveLength(sent.length);
    expect(sent.length).toBeGreaterThan(30);
    expect(new Set(read.map((field) => field.rule.type))).toEqual(new Set(sent.map((field) => field.rule.type)));
    expect(new Set(sent.map((field) => field.rule.type)).size).toBeGreaterThanOrEqual(5);
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
    const broken: SeedServices = { estimates: { getPartForm: () => Promise.reject(new TypeError('connection refused to invented-host')) }, masters: services().masters };
    expect(await readPartFormBodies(broken, viewer, id, id)).toBeNull();
    const noLists: SeedServices = { ...services(), masters: { ...services().masters, listTreatmentOptions: () => Promise.reject(new Error('invented fault')) } };
    expect(await readListBodies(noLists)).toBeNull();
    const lists = defined(await readListBodies(services()));
    const row = defined(await readPartFormBodies(services(), viewer, id, id));
    expect(seedOf(id, id, lists, null)).toBeUndefined();
    expect(seedOf(id, id, null, row)).toBeUndefined();
    const logged = await import('@/lib/logger');
    expect(JSON.stringify(vi.mocked(logged.logger.warn).mock.calls)).not.toContain('invented-host');
  });

  it('a seed names the estimate, the part and the four bodies, and nothing else', async () => {
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const id = estimate().id;
    const lists = defined(await readListBodies(services()));
    const row = defined(await readPartFormBodies(services(), viewer, id, id));
    const seed = defined(seedOf(id, id, lists, row));
    expect(Object.keys(seed).sort()).toEqual(['estimateId', 'form', 'materials', 'part', 'partId', 'treatments']);
  });
});

describe('getPartForm is getForm and getNode in one read (the combined read of DEF-141, DL-457)', () => {
  const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('answers exactly what getForm and getNode answer, as %s', async (role) => {
    const id = estimate().id;
    const viewer = { id: harness.idOf[role], role };
    const [form, node, tree, both] = await Promise.all([harness.estimateService.getForm(viewer, id), harness.estimateService.getNode(viewer, id, id), harness.estimateService.getTree(viewer, id), harness.estimateService.getPartForm(viewer, id, id)]);
    expect(asJson(both.form)).toEqual(asJson(form));
    expect(asJson(both.node)).toEqual(asJson(node));
    expect(asJson(both.tree)).toEqual(asJson(tree));
  });

  it('answers the same in every state of the estimate, and with a value typed into the part', async () => {
    const id = estimate().id;
    const viewer = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    const sections = (await harness.estimateService.getForm(viewer, id)).sections;
    const typedField = defined(sections.flatMap((section) => section.fields).find((field) => field.rule.type === 'number'));
    defined(harness.estimateWorld.nodes[0]).inputs = { [typedField.id]: '3' };
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      estimate().status = status;
      const [form, node, tree, both] = await Promise.all([harness.estimateService.getForm(viewer, id), harness.estimateService.getNode(viewer, id, id), harness.estimateService.getTree(viewer, id), harness.estimateService.getPartForm(viewer, id, id)]);
      expect(asJson(both.form)).toEqual(asJson(form));
      expect(asJson(both.node)).toEqual(asJson(node));
    expect(asJson(both.tree)).toEqual(asJson(tree));
    }
  });

  it('answers the same for every role in every state, ignored or not (PRF-827-09): the whole grid', async () => {
    const id = estimate().id;
    const sections = (await harness.estimateService.getForm({ id: harness.idOf.LEAD, role: 'LEAD' }, id)).sections;
    const typedField = defined(sections.flatMap((section) => section.fields).find((field) => field.rule.type === 'number'));
    defined(harness.estimateWorld.nodes[0]).inputs = { [typedField.id]: '3' };
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      for (const status of ['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'] as const) {
        for (const ignored of [false, true]) {
          estimate().status = status;
          estimate().ignoredAt = ignored ? new Date('2026-11-27T10:00:00.000Z') : null;
          const viewer = { id: harness.idOf[role], role };
          const [form, node, tree, both] = await Promise.all([harness.estimateService.getForm(viewer, id), harness.estimateService.getNode(viewer, id, id), harness.estimateService.getTree(viewer, id), harness.estimateService.getPartForm(viewer, id, id)]);
          expect(asJson(both.form), `${role} ${status} ignored=${String(ignored)}`).toEqual(asJson(form));
          expect(asJson(both.node), `${role} ${status} ignored=${String(ignored)}`).toEqual(asJson(node));
          expect(asJson(both.tree), `${role} ${status} ignored=${String(ignored)}`).toEqual(asJson(tree));
        }
      }
    }
  });

  it('reads the registry the approved figure was made with, as getForm and getNode do (the frozen-registry branch, PRF-827-09)', async () => {
    const id = estimate().id;
    const current = cloneSeedConfig();
    const length = seedFieldAt('J').id;
    const frozen = { ...current, fields: current.fields.map((field) => (field.id === length ? { ...field, label: 'Frozen invented label' } : field)) };
    // The estimate is approved and its calculation names a version of the registry: that version, not the newest, is what every read of the form and of the part uses.
    const service = createEstimateService({
      estimates: harness.estimateWorld.repository,
      audit: createAuditSink().service,
      nodes: harness.estimateWorld.nodeRepository,
      images: harness.estimateWorld.imageRepository,
      transactions: harness.estimateWorld.transactions,
      ...inputsDependencies(),
      configurationById: () => Promise.resolve(frozen),
    });
    const lead = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    estimate().status = 'APPROVED';
    estimate().currentCalculationId = '00000000-0000-4000-8000-0000000000c1';
    estimate().configVersionId = '00000000-0000-4000-8000-0000000000c2';
    const [form, node, tree, both] = await Promise.all([service.getForm(lead, id), service.getNode(lead, id, id), service.getTree(lead, id), service.getPartForm(lead, id, id)]);
    expect(asJson(both.form)).toEqual(asJson(form));
    expect(asJson(both.node)).toEqual(asJson(node));
    expect(asJson(both.tree)).toEqual(asJson(tree));
    const labelsOf = (view: typeof form): string[] => view.sections.flatMap((section) => section.fields).map((field) => field.label);
    expect(labelsOf(both.form)).toContain('Frozen invented label');
    expect(labelsOf(await harness.estimateService.getForm(lead, id))).not.toContain('Frozen invented label');
  });

  it('refuses as they refuse (NFR-001): another Engineer, an unknown estimate and an unknown part are the same not-found, with the same words', async () => {
    const id = estimate().id;
    const unknown = '00000000-0000-4000-8000-00000000dead';
    const stranger = { id: harness.idOf.LEAD, role: 'ENGINEER' as const };
    const lead = { id: harness.idOf.LEAD, role: 'LEAD' as const };
    for (const [viewer, estimateId, nodeId] of [
      [stranger, id, id],
      [lead, unknown, unknown],
      [lead, id, unknown],
    ] as const) {
      const direct = await harness.estimateService.getNode(viewer, estimateId, nodeId).then(() => null, (error: unknown) => error);
      const combined = await harness.estimateService.getPartForm(viewer, estimateId, nodeId).then(() => null, (error: unknown) => error);
      expect(direct).not.toBeNull();
      expect(combined).not.toBeNull();
      expect((combined as Error).constructor).toBe((direct as Error).constructor);
      expect((combined as Error).message).toBe((direct as Error).message);
    }
    // getForm refuses the stranger and the unknown estimate the same way, so the combined read gives away nothing that the two did not.
    const formRefusal = await harness.estimateService.getForm(stranger, id).then(() => null, (error: unknown) => error);
    const combinedRefusal = await harness.estimateService.getPartForm(stranger, id, id).then(() => null, (error: unknown) => error);
    expect((combinedRefusal as Error).constructor).toBe((formRefusal as Error).constructor);
  });
});
