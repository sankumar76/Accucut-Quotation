import { describe, expect, it, vi } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { ESTIMATE_EVENTS, TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { createEstimateStatusService } from '@/server/services/estimate-status-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createAuditSink } from '../support/fake-audit-sink';
import { createFakeEstimateWorld, type FakeEstimate } from '../support/fake-estimates';

/**
 * CR-01 item 7C (AQP-400; architecture section 4.12 a, c; AC-2, AC-3, AC-7): the estimate status service's `markQuoted`, over in-memory storage whose transactions roll back as PostgreSQL does. The real row lock,
 * the real CHECKs and the real audit table are `tests/integration/estimates/mark-quoted.test.ts`. What these pin: the role is refused before anything is read; the explicit ignored refusal comes first, so an ignored
 * Draft or Prepared estimate is `ESTIMATE_IGNORED` and not `ESTIMATE_NOT_APPROVED`; every refusal writes no status and no audit entry; a good mark writes the status, the marker and one entry together, and an
 * entry that fails takes the status back. Every name and ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const REQUEST_ID = 'request-quoted-0001';

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-123',
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'APPROVED',
  customerId: null,
  inputsRevision: 0,
  ...overrides,
});

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: ADMIN, role: 'ADMIN' };

const audit = (viewer: EstimateViewer, name: string) => ({ actorId: viewer.id, actorLabel: name, requestId: REQUEST_ID });

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()]) {
  const world = createFakeEstimateWorld(() => [], initial);
  const sink = createAuditSink();
  const estimates = createEstimateService({ estimates: world.repository, audit: sink.service, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const service = createEstimateStatusService({ estimates: world.repository, transactions: world.transactions, workflow: { transition: estimates.transition, audit: sink.service } });
  const stored = (): FakeEstimate => {
    const found = world.estimates[0];
    if (found === undefined) throw new Error('no estimate');
    return found;
  };
  return { world, sink, service, stored };
}

const caught = (work: Promise<unknown>): Promise<unknown> => work.catch((error: unknown) => error);

describe('AC-2, AC-7: a good mark writes the status, the marker and one audit entry together', () => {
  it.each([
    ['a Lead', lead, LEAD, 'Kiran Bose'],
    ['an Admin', admin, ADMIN, 'Meera Iyer'],
  ] as const)('%s takes an APPROVED estimate to QUOTED and the answer holds the status, the time and the name, and nothing else', async (_name, viewer, personId, name) => {
    const { service, stored, world, sink } = setUp();
    const answer = await service.markQuoted(viewer, ESTIMATE, { audit: audit(viewer, name) });
    expect(answer).toEqual({ status: 'QUOTED', quoted: { at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/), byName: expect.any(String) } });
    expect(stored()).toMatchObject({ status: 'QUOTED', quotedBy: personId });
    expect(world.statusWrites()).toBe(1);
    expect(sink.rows).toHaveLength(1);
  });

  it('the one entry is estimate.quoted: the task code is the object, the actor is the person, the status is APPROVED before and QUOTED after, and no figure is in it', async () => {
    const { service, sink } = setUp();
    await service.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      event: 'estimate.quoted',
      actorId: LEAD,
      actorLabel: 'Kiran Bose',
      requestId: REQUEST_ID,
      objectId: ESTIMATE,
      objectLabel: 'Q-2026-0318',
      before: { status: 'APPROVED' },
      after: { status: 'QUOTED' },
    });
    expect(JSON.stringify(sink.rows[0])).not.toMatch(/price|₹|\d+\.\d{2}/);
  });

  it('an entry that cannot be written takes the status back: the estimate is APPROVED again and the marker is gone', async () => {
    const { world, stored } = setUp();
    const failing = createEstimateStatusService({
      estimates: world.repository,
      transactions: world.transactions,
      workflow: {
        transition: createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() }).transition,
        audit: { record: () => Promise.reject(new Error('Invented failure.')), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: () => Promise.reject(new Error('Invented: not used.')) },
      },
    });
    await expect(failing.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') })).rejects.toThrow('Invented failure.');
    expect(stored().status).toBe('APPROVED');
    expect(stored().quotedBy ?? null).toBeNull();
  });
});

describe('AC-2: the role is refused first, before anything is read', () => {
  it('an Engineer is a ForbiddenError on their own estimate and on one that is none, and the row is never locked', async () => {
    const { service, world, stored } = setUp();
    const lock = vi.spyOn(world.repository, 'lockEstimate');
    expect(await caught(service.markQuoted(arjun, ESTIMATE, { audit: audit(arjun, 'Arjun Rao') }))).toBeInstanceOf(ForbiddenError);
    expect(await caught(service.markQuoted(arjun, '00000000-0000-4000-8000-00000000dead', { audit: audit(arjun, 'Arjun Rao') }))).toBeInstanceOf(ForbiddenError);
    expect(lock).not.toHaveBeenCalled();
    expect(stored().status).toBe('APPROVED');
  });

  it('an estimate that does not exist is a NotFoundError for a Lead, and writes nothing', async () => {
    const { service, sink } = setUp();
    expect(await caught(service.markQuoted(lead, '00000000-0000-4000-8000-00000000dead', { audit: audit(lead, 'Kiran Bose') }))).toBeInstanceOf(NotFoundError);
    expect(sink.rows).toHaveLength(0);
  });
});

describe('AC-3: every refusal is a 409 with its own code, and the estimate and the log are as they were', () => {
  it('a second press is ESTIMATE_ALREADY_QUOTED, writes no second entry and leaves the first marker', async () => {
    const { service, stored, sink, world } = setUp();
    await service.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') });
    const first = { ...stored() };
    const again = await caught(service.markQuoted(admin, ESTIMATE, { audit: audit(admin, 'Meera Iyer') }));
    expect(again).toBeInstanceOf(ConflictError);
    expect(again).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_QUOTED.code });
    expect(stored()).toEqual(first);
    expect(sink.rows).toHaveLength(1);
    expect(world.statusWrites()).toBe(1);
  });

  it.each<EstimateStatus>(['DRAFT', 'PREPARED'])('a %s estimate is ESTIMATE_NOT_APPROVED', async (status) => {
    const { service, stored, sink } = setUp([estimate({ status })]);
    const refusal = await caught(service.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') }));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(stored()).toEqual(estimate({ status }));
    expect(sink.rows).toHaveLength(0);
  });

  it.each<EstimateStatus>(['DRAFT', 'PREPARED', 'APPROVED'])('an ignored %s estimate is ESTIMATE_IGNORED, refused by this service before the machine is asked, so an ignored Draft or Prepared one is not "not approved"', async (status) => {
    const row = estimate({ status, ignoredAt: new Date('2026-11-20T10:00:00.000Z') });
    const { service, stored, sink, world } = setUp([row]);
    const refusal = await caught(service.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') }));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code, message: TRANSITION_REFUSALS.IGNORED.message });
    expect(stored()).toEqual(row);
    expect(sink.rows).toHaveLength(0);
    expect(world.statusWrites()).toBe(0);
  });

  it('an ignored estimate is refused here even if the machine were not asked: the service reads the layer itself, under the lock', async () => {
    const { world } = setUp([estimate({ ignoredAt: new Date('2026-11-20T10:00:00.000Z') })]);
    const transition = vi.fn();
    const guarded = createEstimateStatusService({ estimates: world.repository, transactions: world.transactions, workflow: { transition, audit: createAuditSink().service } });
    expect(await caught(guarded.markQuoted(lead, ESTIMATE, { audit: audit(lead, 'Kiran Bose') }))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    expect(transition).not.toHaveBeenCalled();
  });
});

describe('AC-6: there is no other way back from QUOTED than Unlock (and the Admin\'s Cancel)', () => {
  it('no event of the machine undoes a quote (the exact list is pinned in `tests/unit/estimate/state-machine.test.ts`)', () => {
    expect(ESTIMATE_EVENTS.some((event) => /UNMARK|UNQUOTE|UNDO|REVERT/i.test(event))).toBe(false);
    expect(ESTIMATE_EVENTS).not.toContain('UNMARK_QUOTED');
  });

  it('the service has a markQuoted and no method that unmarks, unquotes or undoes it', () => {
    const { service } = setUp();
    expect(Object.keys(service)).toContain('markQuoted');
    expect(Object.keys(service).some((name) => /unmark|unquote|undo|revert/i.test(name))).toBe(false);
  });
});
