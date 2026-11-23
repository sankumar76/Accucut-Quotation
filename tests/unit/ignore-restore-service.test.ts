import { describe, expect, it, vi } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { checkIgnoreRemarks, IGNORE_REMARKS_MAX_LENGTH } from '@/lib/estimate/ignore-words';
import { ESTIMATE_STATUSES, TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { validateTextInput } from '@/lib/estimate/validation';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { createEstimateStatusService } from '@/server/services/estimate-status-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createAuditSink } from '../support/fake-audit-sink';
import { createFakeEstimateWorld, IGNORER_NAME, type FakeEstimate } from '../support/fake-estimates';

/**
 * CR-01 item 7D, AC-1, AC-2, AC-4, AC-5 (AQP-401; FR-109; BR-067; architecture section 4.12 a and c; ADR-019): Ignore and Restore through the estimate status service, over in-memory storage whose transactions roll back as
 * PostgreSQL does. The real row lock, the real CHECKs and the real audit table are `tests/integration/estimates/ignore-restore.test.ts`. What these pin: the role is refused before anything is read; the remarks are judged
 * by the shared rule before the estimate is looked up (422 under `remarks`); the state machine's refusals (a Quoted estimate, a second Ignore, a Restore of what is not ignored); the status underneath comes back exactly
 * from each of Draft, Prepared and Approved; one audit entry each, with no figure, and an entry that fails takes the write back; and a refusal writes no entry. Every name and ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const REQUEST_ID = 'request-ignore-0001';
const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-123',
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'PREPARED',
  customerId: null,
  inputsRevision: 3,
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
const ignore = (service: ReturnType<typeof setUp>['service'], viewer: EstimateViewer = lead, remarks: string = REMARKS) => service.ignore(viewer, ESTIMATE, { remarks, audit: audit(viewer, 'Kiran Bose') });
const restore = (service: ReturnType<typeof setUp>['service'], viewer: EstimateViewer = lead) => service.restore(viewer, ESTIMATE, { audit: audit(viewer, 'Kiran Bose') });

describe('AC-1, AC-5: a good Ignore sets the layer, keeps the status and writes one audit entry together', () => {
  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('a Lead ignores a %s estimate: the status is unchanged, the three columns are set and the inputs revision stands', async (status) => {
    const { service, stored, world } = setUp([estimate({ status })]);
    const answer = await ignore(service);
    expect(answer).toEqual({ status, ignored: { at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/), byName: IGNORER_NAME, remarks: REMARKS } });
    expect(stored()).toMatchObject({ status, ignoredBy: LEAD, ignoreRemarks: REMARKS, inputsRevision: 3 });
    expect(stored().ignoredAt).toBeInstanceOf(Date);
    expect(world.statusWrites()).toBe(0);
  });

  it('an Admin may ignore too', async () => {
    const { service, stored } = setUp();
    await ignore(service, admin);
    expect(stored().ignoredBy).toBe(ADMIN);
  });

  it('stores the remarks trimmed, with a carriage return folded into a line feed', async () => {
    const { service, stored } = setUp();
    await ignore(service, lead, '  First line.\r\nSecond line.  \n');
    expect(stored().ignoreRemarks).toBe('First line.\nSecond line.');
  });

  it('writes the one entry estimate.ignored: the task code is the object, the status before, the status and the remarks after, and no figure', async () => {
    const { service, sink } = setUp();
    await ignore(service);
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      event: 'estimate.ignored',
      actorId: LEAD,
      actorLabel: 'Kiran Bose',
      requestId: REQUEST_ID,
      objectId: ESTIMATE,
      objectLabel: 'Q-2026-0318',
      before: { status: 'PREPARED' },
      after: { status: 'PREPARED', remarks: REMARKS },
    });
    expect(JSON.stringify(sink.rows[0])).not.toMatch(/price|₹|\d+\.\d{2}/);
  });

  it('an entry that cannot be written takes the layer back: the estimate is not ignored and holds no remarks', async () => {
    const { world, stored } = setUp();
    const failing = createEstimateStatusService({
      estimates: world.repository,
      transactions: world.transactions,
      workflow: {
        transition: createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() }).transition,
        audit: { record: () => Promise.reject(new Error('Invented failure.')), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: () => Promise.reject(new Error('Invented: not used.')) },
      },
    });
    await expect(ignore(failing)).rejects.toThrow('Invented failure.');
    expect(stored().ignoredAt ?? null).toBeNull();
    expect(stored().ignoreRemarks ?? null).toBeNull();
  });
});

describe('AC-1: the role is refused first, before anything is read', () => {
  it('an Engineer is a ForbiddenError on their own estimate, on one that is none and with empty remarks, and the row is never locked', async () => {
    const { service, world, sink } = setUp();
    const lock = vi.spyOn(world.repository, 'lockEstimate');
    expect(await caught(ignore(service, arjun))).toBeInstanceOf(ForbiddenError);
    expect(await caught(service.ignore(arjun, '00000000-0000-4000-8000-00000000dead', { remarks: '', audit: audit(arjun, 'Arjun Rao') }))).toBeInstanceOf(ForbiddenError);
    expect(await caught(restore(service, arjun))).toBeInstanceOf(ForbiddenError);
    expect(lock).not.toHaveBeenCalled();
    expect(sink.rows).toEqual([]);
  });

  it('an estimate that does not exist is a NotFoundError for a Lead, for both actions, and writes nothing', async () => {
    const { service, sink } = setUp();
    expect(await caught(service.ignore(lead, '00000000-0000-4000-8000-00000000dead', { remarks: REMARKS, audit: audit(lead, 'Kiran Bose') }))).toBeInstanceOf(NotFoundError);
    expect(await caught(service.restore(lead, '00000000-0000-4000-8000-00000000dead', { audit: audit(lead, 'Kiran Bose') }))).toBeInstanceOf(NotFoundError);
    expect(sink.rows).toEqual([]);
  });
});

describe('AC-2: the remarks are judged by the shared rule, 422 under `remarks`, before the estimate is read', () => {
  it.each([
    ['empty', ''],
    ['only spaces and line breaks', ' \n\t \r\n'],
    ['501 code points', 'x'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1)],
    ['a zero-width joiner', 'Not taken‍ forward'],
    ['a bidirectional override', 'Not taken‮ forward'],
    ['a NUL', 'Not taken\u0000 forward'],
    ['a lone surrogate', 'Not taken\uD800 forward'],
  ])('%s is a FieldValidationError under remarks with the message of checkIgnoreRemarks, and nothing is read or written', async (_name, remarks) => {
    const { service, world, sink, stored } = setUp();
    const lock = vi.spyOn(world.repository, 'lockEstimate');
    const error = await caught(ignore(service, lead, remarks));
    expect(error).toBeInstanceOf(FieldValidationError);
    const checked = checkIgnoreRemarks(remarks);
    if (checked.ok) throw new Error('The remarks should be refused.');
    expect((error as FieldValidationError).fields).toEqual([{ field: 'remarks', message: checked.message }]);
    expect(lock).not.toHaveBeenCalled();
    expect(stored().ignoredAt ?? null).toBeNull();
    expect(sink.rows).toEqual([]);
  });

  it('a hidden-character message is the shared rule\'s own output, not a sentence of this service', async () => {
    const { service } = setUp();
    const text = 'Not taken‍ forward';
    const shared = validateTextInput(text, { multiline: true, maxLength: IGNORE_REMARKS_MAX_LENGTH, countCodePoints: true });
    if (shared.ok) throw new Error('The shared rule should refuse it.');
    expect(((await caught(ignore(service, lead, text))) as FieldValidationError).fields).toEqual([{ field: 'remarks', message: shared.message }]);
  });

  it('accepts exactly 500 code points (500 emoji) and a line feed, and refuses 501', async () => {
    expect((await ignore(setUp().service, lead, '\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH))).ignored.remarks).toBe('\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH));
    expect(await caught(ignore(setUp().service, lead, '\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1)))).toBeInstanceOf(FieldValidationError);
  });
});

describe('AC-1: the state machine decides under the lock, and a refusal writes no entry', () => {
  it('a Quoted estimate cannot be ignored: 409 ESTIMATE_QUOTED_IS_FINAL, and nothing changes', async () => {
    const { service, sink, stored } = setUp([estimate({ status: 'QUOTED', quotedBy: LEAD, quotedAt: new Date('2026-11-20T10:00:00.000Z') })]);
    const error = await caught(ignore(service));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: TRANSITION_REFUSALS.QUOTED_IS_FINAL.code, message: TRANSITION_REFUSALS.QUOTED_IS_FINAL.message });
    expect(stored().ignoredAt ?? null).toBeNull();
    expect(sink.rows).toEqual([]);
  });

  it('a second Ignore is 409 ESTIMATE_ALREADY_IGNORED, writes no second entry and keeps the first person\'s remarks', async () => {
    const { service, sink, stored } = setUp();
    await ignore(service, lead, 'First remarks.');
    const error = await caught(ignore(service, admin, 'Second remarks.'));
    expect(error).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.ALREADY_IGNORED.code });
    expect(sink.rows).toHaveLength(1);
    expect(stored().ignoreRemarks).toBe('First remarks.');
    expect(stored().ignoredBy).toBe(LEAD);
  });

  it('two Ignores one after the other leave exactly one layer and one entry', async () => {
    const { service, sink } = setUp();
    const results = await Promise.allSettled([ignore(service, lead, 'One.'), ignore(service, admin, 'Two.')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(sink.rows).toHaveLength(1);
  });
});

describe('AC-4, AC-5: Restore clears the layer, gives the status back exactly, and writes one entry', () => {
  it.each(ESTIMATE_STATUSES.filter((status): status is Exclude<EstimateStatus, 'QUOTED'> => status !== 'QUOTED'))(
    'from %s: Ignore then Restore returns the same status, clears the three columns and leaves the inputs revision as it was',
    async (status) => {
      const { service, stored } = setUp([estimate({ status })]);
      await ignore(service);
      expect(await restore(service)).toEqual({ status });
      expect(stored()).toMatchObject({ status, inputsRevision: 3 });
      expect(stored().ignoredAt ?? null).toBeNull();
      expect(stored().ignoredBy ?? null).toBeNull();
      expect(stored().ignoreRemarks ?? null).toBeNull();
    },
  );

  it('writes the one entry estimate.restored: the Ignore remarks before (they stay on record), the status after, and no remarks of its own', async () => {
    const { service, sink } = setUp();
    await ignore(service);
    await restore(service, admin);
    expect(sink.rows).toHaveLength(2);
    expect(sink.rows[1]).toMatchObject({
      event: 'estimate.restored',
      actorId: ADMIN,
      objectId: ESTIMATE,
      objectLabel: 'Q-2026-0318',
      before: { status: 'PREPARED', remarks: REMARKS },
      after: { status: 'PREPARED' },
    });
  });

  it('Restore of an estimate that is not ignored is 409 ESTIMATE_NOT_IGNORED and writes nothing', async () => {
    const { service, sink } = setUp();
    const error = await caught(restore(service));
    expect(error).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_IGNORED.code, message: TRANSITION_REFUSALS.NOT_IGNORED.message });
    expect(sink.rows).toEqual([]);
  });

  it('a second Restore is the same 409, with no second entry', async () => {
    const { service, sink } = setUp();
    await ignore(service);
    await restore(service);
    expect(await caught(restore(service))).toMatchObject({ code: TRANSITION_REFUSALS.NOT_IGNORED.code });
    expect(sink.rows.map((row) => row.event)).toEqual(['estimate.ignored', 'estimate.restored']);
  });

  it('an entry that cannot be written takes the clearing back: the estimate is still ignored with its remarks', async () => {
    const { world, stored, service } = setUp();
    await ignore(service);
    const failing = createEstimateStatusService({
      estimates: world.repository,
      transactions: world.transactions,
      workflow: {
        transition: createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() }).transition,
        audit: { record: () => Promise.reject(new Error('Invented failure.')), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: () => Promise.reject(new Error('Invented: not used.')) },
      },
    });
    await expect(restore(failing)).rejects.toThrow('Invented failure.');
    expect(stored().ignoredAt).toBeInstanceOf(Date);
    expect(stored().ignoreRemarks).toBe(REMARKS);
  });
});
