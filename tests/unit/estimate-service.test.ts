import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateViewer } from '@/server/services/estimate-service';

import { changeContext } from '../support/customer-change';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeCustomerEntry, type FakeEstimate } from '../support/fake-estimates';
import { createAuditSink } from '../support/fake-audit-sink';

/**
 * STORY-05.01 T1 to T3 (AC-1, AC-3, AC-4, AC-5), changed by CR-01 item 6 (AQP-390, AC-7, AC-8, AC-17): the rules of opening an estimate and of changing its customer, over in-memory storage. Only a Lead or an Admin
 * changes the customer: an Engineer is refused with a 403 before the estimate is read. Who may call is `tests/security`; the real queries and the row lock are `tests/integration/estimates`. Every name, path and
 * ID here is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const PRIYA = '00000000-0000-4000-8000-0000000000a2';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const BRIGHTWATER = '00000000-0000-4000-8000-000000000c01';
const MARLOW = '00000000-0000-4000-8000-000000000c02';
const GONE = '00000000-0000-4000-8000-000000000c03';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

const customers: FakeCustomerEntry[] = [
  { id: BRIGHTWATER, name: 'Brightwater Controls', shortName: 'BWC', deleted: false },
  { id: MARLOW, name: 'Marlow Agro Systems', shortName: 'MAS', deleted: false },
  { id: GONE, name: 'Gone Industries', shortName: 'GONE', deleted: true },
];

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: PATH,
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: 'Hopper cover',
  subject: 'Feed hopper',
  notes: 'Sheet-metal parts only.',
  status: 'DRAFT',
  customerId: null,
  inputsRevision: 0,
  ...overrides,
});

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const priya: EstimateViewer = { id: PRIYA, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' };

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()]) {
  const world = createFakeEstimateWorld(() => customers, initial);
  const audit = createAuditSink();
  const service = createEstimateService({ estimates: world.repository, audit: audit.service, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const stored = (): FakeEstimate => {
    const found = world.estimates[0];
    if (found === undefined) throw new Error('no estimate');
    return found;
  };
  const change = (viewer: EstimateViewer, estimateId: string, customerId: string) => service.setCustomer(viewer, changeContext(viewer), estimateId, customerId);
  return { world, service, stored, audit, change };
}

describe('AC-1: opening the workspace', () => {
  it('gives the Engineer the header of their own task: code, status, deadline, folder with a built link, title, subject, notes, who assigned it and no customer for an estimate made before CR-01', async () => {
    const { service } = setUp();
    const workspace = await service.getWorkspace(arjun, 'Q-2026-0318');
    expect(workspace).toEqual({
      estimateId: ESTIMATE,
      code: 'Q-2026-0318',
      status: 'DRAFT',
      customer: null,
      subject: 'Feed hopper',
      deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
      folderPath: PATH,
      folderUrl: 'file:////invented-server/invented-share/RFQ-123',
      title: 'Hopper cover',
      notes: 'Sheet-metal parts only.',
      assignedByName: 'Kiran Bose',
    });
  });

  it('names the customer with its short name once one is set, to the Engineer too', async () => {
    const { service } = setUp([estimate({ customerId: BRIGHTWATER })]);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer).toEqual({ id: BRIGHTWATER, name: 'Brightwater Controls', shortName: 'BWC' });
  });

  it('still names a customer who was deleted after it was chosen: the page shows what the estimate holds', async () => {
    const { service } = setUp([estimate({ customerId: GONE })]);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer).toEqual({ id: GONE, name: 'Gone Industries', shortName: 'GONE' });
  });

  it('a Lead and an Admin may open any task', async () => {
    const { service } = setUp();
    expect((await service.getWorkspace(lead, 'Q-2026-0318'))?.code).toBe('Q-2026-0318');
    expect((await service.getWorkspace(admin, 'Q-2026-0318'))?.code).toBe('Q-2026-0318');
  });

  it('AC-5: another Engineer, and a code that does not exist, get the same answer: nothing', async () => {
    const { service } = setUp();
    expect(await service.getWorkspace(priya, 'Q-2026-0318')).toBeNull();
    expect(await service.getWorkspace(arjun, 'Q-2026-9999')).toBeNull();
    expect(await service.getWorkspace(lead, 'Q-2026-9999')).toBeNull();
  });

  it('AC-8 (NFR-002): the answer carries no key that is not the header: no engineer ID, no revision, nothing of a customer but an ID, a name and a short name', async () => {
    const { service } = setUp([estimate({ customerId: BRIGHTWATER })]);
    const workspace = await service.getWorkspace(arjun, 'Q-2026-0318');
    expect(Object.keys(workspace ?? {}).sort()).toEqual(
      ['assignedByName', 'code', 'customer', 'deadlineAt', 'estimateId', 'folderPath', 'folderUrl', 'notes', 'status', 'subject', 'title'].sort(),
    );
    expect(Object.keys(workspace?.customer ?? {}).sort()).toEqual(['id', 'name', 'shortName']);
  });
});

describe('AC-3, AC-7: changing the customer (a Lead or an Admin)', () => {
  it('stores it and raises the revision by one, and answers with the estimate and the customer', async () => {
    const { stored, world, change } = setUp();
    const answer = await change(lead, ESTIMATE, BRIGHTWATER);
    expect(answer).toEqual({ id: ESTIMATE, status: 'DRAFT', customer: { id: BRIGHTWATER, name: 'Brightwater Controls', shortName: 'BWC' } });
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(1);
    expect(world.writes()).toBe(1);
  });

  it('the change survives a reopen: the workspace names the customer', async () => {
    const { service, change } = setUp();
    await change(lead, ESTIMATE, BRIGHTWATER);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer?.name).toBe('Brightwater Controls');
  });

  it('a Lead and an Admin may change the customer of a draft, and of a prepared estimate (their inputs, FR-064)', async () => {
    const { stored, change } = setUp();
    await change(lead, ESTIMATE, BRIGHTWATER);
    expect(stored().customerId).toBe(BRIGHTWATER);
    await change(admin, ESTIMATE, MARLOW);
    expect(stored().customerId).toBe(MARLOW);
    expect(stored().inputsRevision).toBe(2);
    stored().status = 'PREPARED';
    await change(lead, ESTIMATE, BRIGHTWATER);
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(3);
  });

  it('does not change what the estimate holds besides the customer and the revision', async () => {
    const { stored, change } = setUp();
    const before = { ...stored() };
    await change(lead, ESTIMATE, BRIGHTWATER);
    expect({ ...stored(), customerId: null, inputsRevision: 0 }).toEqual({ ...before, customerId: null, inputsRevision: 0 });
  });
});

describe('AC-4: a different customer, and the same one', () => {
  it('a different customer is a change: the customer is replaced and the revision goes up by one', async () => {
    const { stored, change } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 4 })]);
    await change(lead, ESTIMATE, MARLOW);
    expect(stored().customerId).toBe(MARLOW);
    expect(stored().inputsRevision).toBe(5);
  });

  it('the same customer is a no-op: nothing is written and the revision stays, whatever the letter case of the ID, and no entry is written', async () => {
    const { stored, world, audit, change } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 4 })]);
    const answer = await change(admin, ESTIMATE, BRIGHTWATER.toUpperCase());
    expect(answer.customer.name).toBe('Brightwater Controls');
    expect(stored().inputsRevision).toBe(4);
    expect(world.writes()).toBe(0);
    expect(audit.rows).toHaveLength(0);
  });
});

describe('AC-17: one estimate.customer_changed entry for a change, in the change\'s own transaction', () => {
  it('names the companies before and after, the task code as the object and the person who changed it', async () => {
    const { audit, change } = setUp([estimate({ customerId: BRIGHTWATER })]);
    await change(lead, ESTIMATE, MARLOW);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      event: 'estimate.customer_changed',
      actorId: LEAD,
      objectType: 'estimate',
      objectId: ESTIMATE,
      objectLabel: 'Q-2026-0318',
      before: { customer: { name: 'Brightwater Controls', shortName: 'BWC' } },
      after: { customer: { name: 'Marlow Agro Systems', shortName: 'MAS' } },
    });
  });

  it('has no customer before for an estimate that had none, and names a customer deleted since when it is replaced', async () => {
    const first = setUp();
    await first.change(admin, ESTIMATE, MARLOW);
    expect(first.audit.rows[0]?.before).toEqual({ customer: null });
    const second = setUp([estimate({ customerId: GONE })]);
    await second.change(lead, ESTIMATE, MARLOW);
    expect(second.audit.rows[0]?.before).toEqual({ customer: { name: 'Gone Industries', shortName: 'GONE' } });
  });

  it('writes none for a refused change', async () => {
    const { audit, change } = setUp([estimate({ status: 'APPROVED' })]);
    await change(lead, ESTIMATE, MARLOW).catch(() => undefined);
    await change(lead, ESTIMATE, GONE).catch(() => undefined);
    expect(audit.rows).toHaveLength(0);
  });

  it('holds no figure, rate or contact detail: the entry\'s states have the company names and nothing else', async () => {
    const { audit, change } = setUp([estimate({ customerId: BRIGHTWATER })]);
    await change(lead, ESTIMATE, MARLOW);
    for (const side of [audit.rows[0]?.before, audit.rows[0]?.after]) expect(Object.keys(JSON.parse(JSON.stringify(side)).customer).sort()).toEqual(['name', 'shortName']);
  });
});

describe('AC-7: the refusals', () => {
  it('an Engineer is refused with 403 for their own estimate, another\'s, one that does not exist and an ID that is no ID: the same refusal, before anything is read, and nothing changes', async () => {
    const { stored, world, audit, change } = setUp();
    const refusals = [
      await change(arjun, ESTIMATE, BRIGHTWATER).catch((error: unknown) => error),
      await change(priya, ESTIMATE, BRIGHTWATER).catch((error: unknown) => error),
      await change(arjun, '00000000-0000-4000-8000-00000000dead', BRIGHTWATER).catch((error: unknown) => error),
      await change(arjun, 'not-an-id', BRIGHTWATER).catch((error: unknown) => error),
    ];
    for (const refusal of refusals) {
      expect(refusal).toBeInstanceOf(ForbiddenError);
      expect(refusal).toMatchObject({ httpStatus: 403 });
    }
    expect(new Set(refusals.map((refusal) => (refusal instanceof ForbiddenError ? `${refusal.message}|${refusal.code}` : ''))).size).toBe(1);
    expect(stored().customerId).toBeNull();
    expect(stored().inputsRevision).toBe(0);
    expect(world.writes()).toBe(0);
    expect(audit.rows).toHaveLength(0);
  });

  it('an Engineer is refused at every status, a deleted or unknown customer included: the role is judged before the status and the customer', async () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      const { change } = setUp([estimate({ status })]);
      for (const customerId of [MARLOW, GONE, 'nonsense']) await expect(change(arjun, ESTIMATE, customerId)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it('a service built without the audit service refuses to change a customer, and writes nothing', async () => {
    const world = createFakeEstimateWorld(() => customers, [estimate()]);
    const unaudited = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
    await expect(unaudited.setCustomer(lead, changeContext(lead), ESTIMATE, BRIGHTWATER)).rejects.toThrow('without the audit service');
    expect(world.writes()).toBe(0);
  });

  it('an estimate that does not exist and an ID that is no ID are "not found" for a Lead, with the same words', async () => {
    const { change } = setUp();
    const missing = await change(lead, '00000000-0000-4000-8000-00000000dead', BRIGHTWATER).catch((error: unknown) => error);
    const malformed = await change(lead, 'not-an-id', BRIGHTWATER).catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(malformed).toBeInstanceOf(NotFoundError);
    expect(missing instanceof NotFoundError && malformed instanceof NotFoundError && missing.message === malformed.message && missing.code === malformed.code).toBe(true);
  });

  it('an approved estimate is refused with 409 ESTIMATE_NOT_EDITABLE for a Lead and an Admin, and nothing changes: nobody changes an approved estimate (FR-064 lets them edit a prepared one)', async () => {
    const { stored, change } = setUp([estimate({ status: 'APPROVED', customerId: BRIGHTWATER, inputsRevision: 3 })]);
    for (const viewer of [lead, admin]) {
      const refusal = await change(viewer, ESTIMATE, MARLOW).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(ConflictError);
      expect(refusal).toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE, httpStatus: 409 });
    }
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(3);
  });

  it.each([
    ['a customer that was deleted', GONE],
    ['a customer that does not exist', '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', 'Brightwater Controls'],
    ['nothing', ''],
  ])('%s is refused with 422 under customerId, in the words of the form, and nothing changes', async (_name, customerId) => {
    const { stored, change } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 2 })]);
    const refusal = await change(lead, ESTIMATE, customerId).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal).toMatchObject({ fields: [{ field: 'customerId', message: 'Choose a customer from the list.' }], httpStatus: 422 });
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(2);
  });

  it('the order of the refusals is 403, then 404, then 409, then 422: an approved estimate with a bad customer is 409, and an Engineer is 403 before either', async () => {
    const { change } = setUp([estimate({ status: 'APPROVED' })]);
    await expect(change(lead, ESTIMATE, GONE)).rejects.toBeInstanceOf(ConflictError);
    await expect(change(priya, ESTIMATE, GONE)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(change(lead, '00000000-0000-4000-8000-00000000dead', GONE)).rejects.toBeInstanceOf(NotFoundError);
  });
});
