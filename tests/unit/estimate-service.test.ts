import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateViewer } from '@/server/services/estimate-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeCustomerEntry, type FakeEstimate } from '../support/fake-estimates';

/**
 * STORY-05.01 T1 to T3 (AC-1, AC-3, AC-4, AC-5): the rules of opening an estimate and choosing its customer, over in-memory storage. Who may call is
 * `tests/security`; the real queries and the row lock are `tests/integration/estimates`. Every name, path and ID here is invented.
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
  { id: BRIGHTWATER, name: 'Brightwater Controls', deleted: false },
  { id: MARLOW, name: 'Marlow Agro Systems', deleted: false },
  { id: GONE, name: 'Gone Industries', deleted: true },
];

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: PATH,
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: 'Hopper cover',
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
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, transactions: world.transactions, ...inputsDependencies() });
  const stored = (): FakeEstimate => {
    const found = world.estimates[0];
    if (found === undefined) throw new Error('no estimate');
    return found;
  };
  return { world, service, stored };
}

describe('AC-1: opening the workspace', () => {
  it('gives the Engineer the header of their own task: code, status, deadline, folder with a built link, notes, who assigned it and no customer yet', async () => {
    const { service } = setUp();
    const workspace = await service.getWorkspace(arjun, 'Q-2026-0318');
    expect(workspace).toEqual({
      estimateId: ESTIMATE,
      code: 'Q-2026-0318',
      status: 'DRAFT',
      customer: null,
      deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
      folderPath: PATH,
      folderUrl: 'file:////invented-server/invented-share/RFQ-123',
      title: 'Hopper cover',
      notes: 'Sheet-metal parts only.',
      assignedByName: 'Kiran Bose',
    });
  });

  it('names the customer once one is chosen', async () => {
    const { service } = setUp([estimate({ customerId: BRIGHTWATER })]);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer).toEqual({ id: BRIGHTWATER, name: 'Brightwater Controls' });
  });

  it('still names a customer who was deleted after it was chosen: the page shows what the estimate holds', async () => {
    const { service } = setUp([estimate({ customerId: GONE })]);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer).toEqual({ id: GONE, name: 'Gone Industries' });
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

  it('the answer carries no key that is not the header: no engineer ID, no revision, nothing of a customer but an ID and a name', async () => {
    const { service } = setUp([estimate({ customerId: BRIGHTWATER })]);
    const workspace = await service.getWorkspace(arjun, 'Q-2026-0318');
    expect(Object.keys(workspace ?? {}).sort()).toEqual(
      ['assignedByName', 'code', 'customer', 'deadlineAt', 'estimateId', 'folderPath', 'folderUrl', 'notes', 'status', 'title'].sort(),
    );
    expect(Object.keys(workspace?.customer ?? {}).sort()).toEqual(['id', 'name']);
  });
});

describe('AC-3: choosing the customer', () => {
  it('stores it and raises the revision by one, and answers with the estimate and the customer', async () => {
    const { service, stored, world } = setUp();
    const answer = await service.setCustomer(arjun, ESTIMATE, BRIGHTWATER);
    expect(answer).toEqual({ id: ESTIMATE, status: 'DRAFT', customer: { id: BRIGHTWATER, name: 'Brightwater Controls' } });
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(1);
    expect(world.writes()).toBe(1);
  });

  it('the choice survives a reopen: the workspace names the customer', async () => {
    const { service } = setUp();
    await service.setCustomer(arjun, ESTIMATE, BRIGHTWATER);
    expect((await service.getWorkspace(arjun, 'Q-2026-0318'))?.customer?.name).toBe('Brightwater Controls');
  });

  it('a Lead and an Admin may choose the customer of any draft', async () => {
    const { service, stored } = setUp();
    await service.setCustomer(lead, ESTIMATE, BRIGHTWATER);
    expect(stored().customerId).toBe(BRIGHTWATER);
    await service.setCustomer(admin, ESTIMATE, MARLOW);
    expect(stored().customerId).toBe(MARLOW);
    expect(stored().inputsRevision).toBe(2);
  });

  it('does not change what the estimate holds besides the customer and the revision', async () => {
    const { service, stored } = setUp();
    const before = { ...stored() };
    await service.setCustomer(arjun, ESTIMATE, BRIGHTWATER);
    expect({ ...stored(), customerId: null, inputsRevision: 0 }).toEqual({ ...before, customerId: null, inputsRevision: 0 });
  });
});

describe('AC-4: a different customer, and the same one', () => {
  it('a different customer is a change: the customer is replaced and the revision goes up by one', async () => {
    const { service, stored } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 4 })]);
    await service.setCustomer(arjun, ESTIMATE, MARLOW);
    expect(stored().customerId).toBe(MARLOW);
    expect(stored().inputsRevision).toBe(5);
  });

  it('the same customer is a no-op: nothing is written and the revision stays, whatever the letter case of the ID', async () => {
    const { service, stored, world } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 4 })]);
    const answer = await service.setCustomer(arjun, ESTIMATE, BRIGHTWATER.toUpperCase());
    expect(answer.customer.name).toBe('Brightwater Controls');
    expect(stored().inputsRevision).toBe(4);
    expect(world.writes()).toBe(0);
  });
});

describe('AC-5: the refusals', () => {
  it('another Engineer is told "not found", exactly as for an estimate that does not exist, and nothing changes', async () => {
    const { service, stored } = setUp();
    const notOwn = await service.setCustomer(priya, ESTIMATE, BRIGHTWATER).catch((error: unknown) => error);
    const missing = await service.setCustomer(arjun, '00000000-0000-4000-8000-00000000dead', BRIGHTWATER).catch((error: unknown) => error);
    expect(notOwn).toBeInstanceOf(NotFoundError);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect((notOwn as NotFoundError).message).toBe((missing as NotFoundError).message);
    expect((notOwn as NotFoundError).code).toBe((missing as NotFoundError).code);
    expect(stored().customerId).toBeNull();
    expect(stored().inputsRevision).toBe(0);
  });

  it('an ID that is not an ID at all is "not found" too', async () => {
    const { service } = setUp();
    await expect(service.setCustomer(arjun, 'not-an-id', BRIGHTWATER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['SUBMITTED', 'APPROVED'] as const)('a %s estimate is refused with 409 ESTIMATE_NOT_EDITABLE and nothing changes', async (status) => {
    const { service, stored } = setUp([estimate({ status, customerId: BRIGHTWATER, inputsRevision: 3 })]);
    const refusal = await service.setCustomer(arjun, ESTIMATE, MARLOW).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).code).toBe(ESTIMATE_NOT_EDITABLE_CODE);
    expect((refusal as ConflictError).httpStatus).toBe(409);
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(3);
  });

  it('a Lead and an Admin are refused on an approved estimate: nobody changes an approved estimate (STORY-06.01 replaced the draft-only check; FR-064 lets them edit a submitted one)', async () => {
    const { service } = setUp([estimate({ status: 'APPROVED' })]);
    await expect(service.setCustomer(lead, ESTIMATE, MARLOW)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.setCustomer(admin, ESTIMATE, MARLOW)).rejects.toBeInstanceOf(ConflictError);
  });

  it.each([
    ['a customer that was deleted', GONE],
    ['a customer that does not exist', '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', 'Brightwater Controls'],
    ['nothing', ''],
  ])('%s is refused with 422 under customerId, in the words of the form, and nothing changes', async (_name, customerId) => {
    const { service, stored } = setUp([estimate({ customerId: BRIGHTWATER, inputsRevision: 2 })]);
    const refusal = await service.setCustomer(arjun, ESTIMATE, customerId).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect((refusal as FieldValidationError).fields).toEqual([{ field: 'customerId', message: 'Choose a customer from the list.' }]);
    expect((refusal as FieldValidationError).httpStatus).toBe(422);
    expect(stored().customerId).toBe(BRIGHTWATER);
    expect(stored().inputsRevision).toBe(2);
  });

  it('the order of the refusals is 404, then 409, then 422: a submitted estimate with a bad customer is 409, and another Engineer is 404 before either', async () => {
    const { service } = setUp([estimate({ status: 'SUBMITTED' })]);
    await expect(service.setCustomer(arjun, ESTIMATE, GONE)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.setCustomer(priya, ESTIMATE, GONE)).rejects.toBeInstanceOf(NotFoundError);
  });
});
