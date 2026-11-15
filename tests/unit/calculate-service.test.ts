import { describe, expect, it } from 'vitest';

import { CalculateBlockedError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { CalculateAckRequiredError } from '@/lib/estimate/calculate-ack-required-error';
import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { createTransactionHandle, type Transaction } from '@/server/repositories/transaction';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import type { AuditService } from '@/server/services/audit-service';
import { createCalculationService, type CalculationService } from '@/server/services/calculation-service';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { completePartInputs, fieldIdOf, INVENTED_MATERIAL_ID } from '../support/complete-part';
import { defined } from '../support/defined';
import { createAuditSink, type AuditSink } from '../support/fake-audit-sink';
import { createFakeCalculationWorld, type FakeCalculationWorld } from '../support/fake-calculations';
import { fakeCustomer } from '../support/fake-customers';
import { createFakeEstimateWorld, type FakeEstimate, type FakeEstimateWorld, type FakeNode } from '../support/fake-estimates';
import { createFakeMasterRepository, seedRecords, type FakeMasterRepository } from '../support/fake-masters';
import { MATERIAL, TYPED_RATES } from '../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';

/**
 * STORY-05.09 (FR-055, FR-056, FR-031; NFR-002; architecture sections 4.2 and 6 "Calculate"): the Engineer's Calculate, over in-memory storage. The same code is run against PostgreSQL in
 * `tests/integration/calc/calculate.test.ts`. One transaction under the estimate's lock: the state machine decides role, ownership and status; every part is checked; the customer must be
 * chosen; the masters are read; the record is stored and the status is SUBMITTED; the answer is `{status, message}` and nothing else. Every name, number and ID here is invented.
 */

const CONFIG_VERSION_ID = '00000000-0000-4000-8000-0aaa00000001';
const ESTIMATE_ID = '00000000-0000-4000-8000-0e5700000001';
const OTHER_ESTIMATE_ID = '00000000-0000-4000-8000-0e5700000002';
const ENGINEER_ID = '00000000-0000-4000-8000-0b0b00000001';
const OTHER_ENGINEER_ID = '00000000-0000-4000-8000-0b0b00000002';
const LEAD_ID = '00000000-0000-4000-8000-0b0b00000003';
const PART_ONE = '00000000-0000-4000-8000-0d0d00000001';
const PART_TWO = '00000000-0000-4000-8000-0d0d00000002';
const PART_THREE = '00000000-0000-4000-8000-0d0d00000003';

const ENGINEER: EstimateViewer = { id: ENGINEER_ID, role: 'ENGINEER' };
/** Who pressed and on which request, as the route gives it to the audit entry of an acknowledged warning (STORY-05.12). */
const AUDIT = { actorId: ENGINEER_ID, actorLabel: 'Invented Engineer', requestId: 'req-0badc0de' };

interface Fixture {
  readonly masters: FakeMasterRepository;
  readonly estimates: FakeEstimateWorld;
  readonly world: FakeCalculationWorld;
  readonly service: CalculationService;
  /** The audit entries the service wrote (STORY-05.12). */
  readonly audit: AuditSink;
  readonly estimate: () => FakeEstimate;
  readonly opened: () => number;
  readonly configurationReads: ReadonlyArray<Transaction | undefined>;
}

const partNode = (id: string, parentId: string | null, sortIndex: number, inputs: Record<string, unknown> = completePartInputs()): FakeNode => ({
  id,
  estimateId: ESTIMATE_ID,
  parentId,
  sortIndex,
  revision: 1,
  inputs: { ...inputs, [fieldIdOf('material-in-drawing')]: INVENTED_MATERIAL_ID },
});

function fixture(options: { status?: FakeEstimate['status']; customer?: boolean; nodes?: FakeNode[]; engineerId?: string; masterScale?: number; auditService?: AuditService } = {}): Fixture {
  const masters = createFakeMasterRepository(seedRecords());
  const scale = options.masterScale ?? 1;
  const rates = Object.fromEntries(SEED_PROCESS_ITEMS.map((item) => [item.id, String(Number(defined(TYPED_RATES[item.name], item.name)) * scale)]));
  const customer = fakeCustomer(masters.records, 'Invented customer', rates);
  masters.customers.push(customer);
  masters.materials.push({ id: INVENTED_MATERIAL_ID, materialInDrawing: 'Invented plate', materialConsidered: 'Invented steel', ...MATERIAL, pricePerKg: String(Number(MATERIAL.pricePerKg) * scale) });
  masters.exchange.usd = '80.00';
  masters.exchange.eur = '90.00';

  const estimates = createFakeEstimateWorld(
    () => masters.customers.map((entry) => ({ id: entry.id, name: entry.name, deleted: entry.deleted })),
    [
      {
        id: ESTIMATE_ID,
        code: 'Q-2026-0501',
        engineerId: options.engineerId ?? ENGINEER_ID,
        assignedByName: 'Invented Lead',
        folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
        deadlineAt: new Date('2026-11-20T11:30:00.000Z'),
        title: null,
        notes: null,
        status: options.status ?? 'DRAFT',
        customerId: options.customer === false ? null : customer.id,
        inputsRevision: 6,
      },
    ],
    options.nodes ?? [partNode(PART_ONE, null, 0), partNode(PART_TWO, PART_ONE, 0)],
  );
  const world = createFakeCalculationWorld(estimates);
  // Counts every transaction opened, and refuses one opened inside another (a nested one would wait on its own lock in PostgreSQL).
  const state = { opened: 0, active: 0 };
  const runner: FakeCalculationWorld['transactions'] = {
    run(work) {
      if (state.active > 0) throw new Error('A transaction was opened inside a transaction.');
      state.opened += 1;
      state.active += 1;
      return world.transactions.run(work).finally(() => {
        state.active -= 1;
      });
    },
  };
  const estimateService = createEstimateService({
    estimates: world.estimates,
    nodes: estimates.nodeRepository,
    images: estimates.imageRepository,
    transactions: runner,
    materials: masters,
    currentConfiguration: () => Promise.resolve(seedConfig),
  });
  const configurationReads: Array<Transaction | undefined> = [];
  const audit = createAuditSink();
  const service = createCalculationService({
    masters,
    currentConfiguration: (tx) => {
      configurationReads.push(tx);
      return Promise.resolve({ id: CONFIG_VERSION_ID, document: seedConfig });
    },
    storage: { calculations: world.repository, estimates: world.estimates, transactions: runner },
    workflow: { nodes: estimates.nodeRepository, transition: estimateService.transition, audit: options.auditService ?? audit.service },
  });
  return { masters, estimates, world, service, audit, estimate: () => defined(estimates.estimates[0]), opened: () => state.opened, configurationReads };
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error to be thrown.', { cause: error });
  }
  throw new Error('Expected the call to be refused, but it was not.');
}

/** Nothing was written: no record, the status and the link as they were, and the estimate's revision. */
function expectNothingWritten(f: Fixture, status: FakeEstimate['status'] = 'DRAFT'): void {
  expect(f.world.calculations).toHaveLength(0);
  expect(f.estimate().status).toBe(status);
  expect(f.estimate().currentCalculationId ?? null).toBeNull();
  expect(f.estimate().inputsRevision).toBe(6);
}

describe('AC-2: a complete estimate is calculated, stored and submitted in one transaction', () => {
  it('answers exactly {status, message} with the fixed sentence, and nothing else', async () => {
    const f = fixture();
    const answer = await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(answer).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    expect(Object.keys(answer).sort()).toEqual(['message', 'status']);
    expect(CALCULATE_MESSAGE).toBe('Cost will be calculated based on the input fields and sent for review/approval.');
  });

  it('stores one record with a row per part, links it, sets the status and leaves the input revision as it was', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(f.world.calculations).toHaveLength(1);
    const record = defined(f.world.calculations[0]);
    expect(record).toMatchObject({ estimateId: ESTIMATE_ID, configVersionId: CONFIG_VERSION_ID, inputsRevision: 6, createdById: ENGINEER_ID });
    expect(record.rows.map((row) => [row.nodeId, row.parentId, row.sortIndex, row.slNo])).toEqual([
      [PART_ONE, null, 0, '1'],
      [PART_TWO, PART_ONE, 0, '1.1'],
    ]);
    expect(f.estimate()).toMatchObject({ status: 'SUBMITTED', currentCalculationId: record.id, inputsRevision: 6 });
  });

  it('records each part with the picture it has (STORY-05.07, #401): its ID on the row, and null for a part with none, which calculates all the same (D-31)', async () => {
    const PICTURE_ID = '00000000-0000-4000-8000-0f0f00000001';
    const f = fixture({ nodes: [{ ...partNode(PART_ONE, null, 0), imageId: PICTURE_ID }, partNode(PART_TWO, PART_ONE, 0)] });
    expect(await f.service.calculate(ENGINEER, ESTIMATE_ID)).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    expect(defined(f.world.calculations[0]).rows.map((row) => [row.nodeId, row.imageId])).toEqual([
      [PART_ONE, PICTURE_ID],
      [PART_TWO, null],
    ]);
  });

  it('records the person who pressed Calculate, from the session, as the creator (SQR-08 of AQP-293)', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(defined(f.world.calculations[0]).createdById).toBe(ENGINEER_ID);
  });

  it('opens exactly one transaction, and reads the configuration once, inside it', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(f.opened()).toBe(1);
    expect(f.configurationReads).toHaveLength(1);
    expect(f.configurationReads[0]).toBeDefined();
  });

  it('keeps the words and numbers the calculation used: the material\'s names, the default "None" of Fasteners, and Fasteners Qty and Cost as 0 (hidden)', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    const inputs = defined(defined(f.world.calculations[0]).rows[0]).inputs;
    expect(inputs[fieldIdOf('material-in-drawing')]).toBe('Invented plate');
    expect(inputs[fieldIdOf('material-considered')]).toBe('Invented steel');
    expect(inputs[fieldIdOf('fasteners')]).toBe('None');
    expect(inputs[fieldIdOf('fasteners-qty')]).toBe('0.00');
    expect(inputs[fieldIdOf('fasteners-cost')]).toBe('0.00');
  });

  it('a Qty and a Cost typed before Fasteners became "None" are not calculated: AZ is built from 0 (SPEC section 14.4)', async () => {
    const stale = { ...completePartInputs(), [fieldIdOf('fasteners-qty')]: '50.00', [fieldIdOf('fasteners-cost')]: '70.00' };
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, stale)] });
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(defined(defined(f.world.calculations[0]).rows[0]).inputs[fieldIdOf('fasteners-qty')]).toBe('0.00');
  });

  it('works through a tree of several levels in reading order, each part with its Sl. No', async () => {
    const f = fixture({ nodes: [partNode(PART_THREE, PART_TWO, 0), partNode(PART_TWO, PART_ONE, 0), partNode(PART_ONE, null, 0)] });
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(defined(f.world.calculations[0]).rows.map((row) => row.slNo)).toEqual(['1', '1.1', '1.1.1']);
  });
});

describe('AC-3: a 0 in a number field is accepted', () => {
  it('every number is 0, QTY per Assy included, and the estimate is submitted once the warning for the 0 of QTY per Assy is acknowledged (STORY-05.12)', async () => {
    const zeros = Object.fromEntries(Object.entries(completePartInputs()).map(([id, value]) => [id, /^\d+\.\d+$/.test(value) ? '0' : value]));
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, zeros)] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toBeInstanceOf(CalculateAckRequiredError);
    expectNothingWritten(f);
    expect(await f.service.calculate(ENGINEER, ESTIMATE_ID, { acknowledge: { inputsRevision: 6 }, audit: AUDIT })).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    expect(f.estimate().status).toBe('SUBMITTED');
  });
});

describe('AC-1: a blank input blocks, lists the parts and the fields, and writes nothing', () => {
  it('a blank in one part is a 422 CALCULATE_BLOCKED that names the part with its Sl. No and name and the field, and the estimate stays a draft', async () => {
    const blank = Object.fromEntries(Object.entries(completePartInputs()).filter(([id]) => id !== fieldIdOf('cutting-time')));
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0), partNode(PART_TWO, PART_ONE, 0, blank)] });
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID));
    expect(failure).toBeInstanceOf(CalculateBlockedError);
    expect(failure).toMatchObject({ code: 'CALCULATE_BLOCKED', httpStatus: 422, message: 'Nothing was submitted. 1 part has missing inputs.' });
    expect((failure as CalculateBlockedError).parts).toEqual([
      { nodeId: PART_TWO, slNo: '1.1', name: 'Invented text', fields: [{ fieldId: fieldIdOf('cutting-time'), label: 'Cutting Time' }] },
    ]);
    expectNothingWritten(f);
  });

  it('every blocked part is listed at once, at any depth, and the sentence counts them', async () => {
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, {}), partNode(PART_TWO, PART_ONE, 0, {}), partNode(PART_THREE, PART_TWO, 0, {})] });
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID));
    expect((failure as CalculateBlockedError).parts.map((part) => part.slNo)).toEqual(['1', '1.1', '1.1.1']);
    expect(failure.message).toBe('Nothing was submitted. 3 parts have missing inputs.');
    expectNothingWritten(f);
  });

  it('a part with no material chosen is blocked and names Material in Drawing', async () => {
    const noMaterial: FakeNode = { ...partNode(PART_ONE, null, 0), inputs: completePartInputs() };
    const stripped = { ...noMaterial, inputs: Object.fromEntries(Object.entries(noMaterial.inputs).filter(([id]) => id !== fieldIdOf('material-in-drawing'))) };
    const f = fixture({ nodes: [stripped] });
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID));
    expect((failure as CalculateBlockedError).parts[0]?.fields.map((field) => field.label)).toEqual(['Material in Drawing']);
  });

  it('what the 422 holds is only parts, Sl. Nos, names and field labels: no value, and no figure', async () => {
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, { ...completePartInputs(), [fieldIdOf('length')]: '' })] });
    const failure = (await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))) as CalculateBlockedError;
    expect(JSON.stringify(failure.parts)).not.toMatch(/12\.50|0\.00/);
    expect(Object.keys(failure.parts[0] ?? {}).sort()).toEqual(['fields', 'name', 'nodeId', 'slNo']);
  });
});

describe('AC-5 (order): blank inputs come first, then the rest', () => {
  it('a blank beside a 0 in QTY per Assy is the 422, never anything about the quantity', async () => {
    const inputs = { ...completePartInputs(), [fieldIdOf('qty-per-assy')]: '0', [fieldIdOf('length')]: '' };
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, inputs)] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toBeInstanceOf(CalculateBlockedError);
    expectNothingWritten(f);
  });

  it('a blank before the customer: with both missing, the 422 is the answer', async () => {
    const f = fixture({ customer: false, nodes: [partNode(PART_ONE, null, 0, {})] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toBeInstanceOf(CalculateBlockedError);
  });

  it('the status comes before the blanks: a submitted estimate with a blank is the 409, not the 422', async () => {
    const f = fixture({ status: 'SUBMITTED', nodes: [partNode(PART_ONE, null, 0, {})] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED', httpStatus: 409 });
  });

  it('the owner comes before everything: another Engineer\'s estimate with blanks is a 404, and says nothing of the blanks', async () => {
    const f = fixture({ engineerId: OTHER_ENGINEER_ID, nodes: [partNode(PART_ONE, null, 0, {})] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-4: what cannot be calculated is a named 409, a 404, and never a partial write', () => {
  it('no customer chosen is the 409 CUSTOMER_NOT_CHOSEN once every input is there', async () => {
    const f = fixture({ customer: false });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'CUSTOMER_NOT_CHOSEN', httpStatus: 409 });
    expectNothingWritten(f);
  });

  it('a submitted estimate is the 409 ESTIMATE_ALREADY_SUBMITTED', async () => {
    const f = fixture({ status: 'SUBMITTED' });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED', httpStatus: 409 });
    expectNothingWritten(f, 'SUBMITTED');
  });

  it('an approved estimate is the 409 ESTIMATE_APPROVED_IS_LOCKED: one code for "approved" on this path (SQR-06 of STORY-06.01)', async () => {
    const f = fixture({ status: 'APPROVED' });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'ESTIMATE_APPROVED_IS_LOCKED', httpStatus: 409 });
    expectNothingWritten(f, 'APPROVED');
  });

  it('another Engineer\'s estimate and one that does not exist are the same 404', async () => {
    const other = fixture({ engineerId: OTHER_ENGINEER_ID });
    const none = fixture();
    const first = await rejection(other.service.calculate(ENGINEER, ESTIMATE_ID));
    const second = await rejection(none.service.calculate(ENGINEER, OTHER_ESTIMATE_ID));
    expect(first).toBeInstanceOf(NotFoundError);
    expect(second).toBeInstanceOf(NotFoundError);
    expect({ code: first.name, message: first.message }).toEqual({ code: second.name, message: second.message });
    expectNothingWritten(other);
  });

  it('a Lead or an Admin is refused 403 (Recalculate is their own event, STORY-06.04), whatever the estimate holds, and nothing is written', async () => {
    const f = fixture();
    expect(await rejection(f.service.calculate({ id: LEAD_ID, role: 'LEAD' }, ESTIMATE_ID))).toBeInstanceOf(ForbiddenError);
    expect(await rejection(f.service.calculate({ id: LEAD_ID, role: 'ADMIN' }, ESTIMATE_ID))).toBeInstanceOf(ForbiddenError);
    expectNothingWritten(f);
  });

  it('an estimate with no part is the 409 NO_PARTS: an immutable record of nothing is never made', async () => {
    const f = fixture({ nodes: [] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'NO_PARTS', httpStatus: 409 });
    expectNothingWritten(f);
  });

  it('a customer the Admin deleted after it was chosen is the 409 CUSTOMER_DELETED, not a 404 (STORY-02.07)', async () => {
    const f = fixture();
    defined(f.masters.customers[0]).deleted = true;
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'CUSTOMER_DELETED', httpStatus: 409 });
    expectNothingWritten(f);
  });

  it('a material the Admin deleted after a part chose it is the 409 MATERIAL_DELETED, not a 404, and no part is named', async () => {
    const f = fixture();
    // The Admin's delete takes the caller's transaction; the fake keeps the row, as the soft delete does, and marks it deleted.
    expect(await f.masters.softDeleteMaterial(INVENTED_MATERIAL_ID, createTransactionHandle())).toBe(true);
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID));
    expect(failure).toBeInstanceOf(ConflictError);
    expect(failure).toMatchObject({ code: 'MATERIAL_DELETED', httpStatus: 409 });
    expectNothingWritten(f);
  });

  it('a part that cannot be reached from the top is a fault in the data: a plain Error, never a record of the parts that can', async () => {
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0), partNode(PART_TWO, PART_THREE, 0)] });
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID));
    expect(failure).not.toBeInstanceOf(ConflictError);
    expect(failure.message).toBe('A part of the estimate cannot be reached from the top of its tree.');
    expectNothingWritten(f);
  });

  it('a failure after the record was written (the link) leaves no record and the estimate a draft: the status moves with the record or not at all', async () => {
    const f = fixture();
    f.world.failNextLinkWith(new Error('The link failed.'));
    await expect(f.service.calculate(ENGINEER, ESTIMATE_ID)).rejects.toThrow('The link failed.');
    expectNothingWritten(f);
  });
});

describe('AC-7: a second press is a 409 and makes no second calculation', () => {
  it('the second call is ESTIMATE_ALREADY_SUBMITTED and the one record stays the only one', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED', httpStatus: 409 });
    expect(f.world.calculations).toHaveLength(1);
  });

  it('two presses at once: the row lock queues them, one wins, and the other is the 409', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.service.calculate(ENGINEER, ESTIMATE_ID), f.service.calculate(ENGINEER, ESTIMATE_ID)]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(f.world.calculations).toHaveLength(1);
  });
});

describe('AC-6 (NFR-002): the answer does not depend on what the masters hold', () => {
  it('the same estimate under two sets of masters gives identical answers, and each stored record differs only where the masters do', async () => {
    const first = fixture({ masterScale: 1 });
    const second = fixture({ masterScale: 7 });
    const one = await first.service.calculate(ENGINEER, ESTIMATE_ID);
    const two = await second.service.calculate(ENGINEER, ESTIMATE_ID);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    expect(defined(first.world.calculations[0]).productValues).not.toEqual(defined(second.world.calculations[0]).productValues);
  });

  it('the answer holds no digit at all', async () => {
    const f = fixture();
    expect(JSON.stringify(await f.service.calculate(ENGINEER, ESTIMATE_ID))).not.toMatch(/\d/);
  });
});

/**
 * STORY-05.12 (FR-104; architecture section 4.3 "A zero quantity"; test strategy section 5.2 CE-9 "Integration"): the quantity warning in Calculate, over in-memory storage (the same code runs against
 * PostgreSQL in `tests/integration/calc/warn.test.ts`, including the race with an input save). An estimate of an item (1) with a part (1.1) and a sub-part (1.1.1), the part and sub-part with H 0.
 */
const QTY = fieldIdOf('qty-per-assy');
const NAME = fieldIdOf('description');

const warnedTree = (overrides: { part?: string; sub?: string } = {}): FakeNode[] => [
  partNode(PART_ONE, null, 0),
  partNode(PART_TWO, PART_ONE, 0, { ...completePartInputs(), [QTY]: overrides.part ?? '0', [NAME]: 'Invented top cover' }),
  partNode(PART_THREE, PART_TWO, 0, { ...completePartInputs(), [QTY]: overrides.sub ?? '0.00', [NAME]: 'Invented lid' }),
];

const WARNED_ROWS = [
  { code: 'QTY_ZERO', nodeId: PART_TWO, slNo: '1.1', label: 'Invented top cover' },
  { code: 'QTY_ZERO', nodeId: PART_THREE, slNo: '1.1.1', label: 'Invented lid' },
];

const ACKNOWLEDGED = { acknowledge: { inputsRevision: 6 }, audit: AUDIT };

/** The 409 a press earns, or a failure of the test when it earns none. */
async function askedToConfirm(f: Fixture, options?: Parameters<CalculationService['calculate']>[2]): Promise<CalculateAckRequiredError> {
  const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID, options));
  if (!(failure instanceof CalculateAckRequiredError)) throw new Error('Expected the 409 CALCULATE_ACK_REQUIRED.', { cause: failure });
  return failure;
}

describe('STORY-05.12 AC-2: a first press with a warning due is the 409, and writes nothing', () => {
  it('is 409 CALCULATE_ACK_REQUIRED with the revision, the field of QTY per Assy and one warning per row with a 0, in reading order', async () => {
    const f = fixture({ nodes: warnedTree() });
    const failure = await askedToConfirm(f);
    expect(failure).toMatchObject({ code: 'CALCULATE_ACK_REQUIRED', httpStatus: 409, inputsRevision: 6, quantityFieldId: QTY });
    expect(failure.warnings).toEqual(WARNED_ROWS);
  });

  it('writes nothing: no calculation, no status change, no audit entry, and the revision is as it was', async () => {
    const f = fixture({ nodes: warnedTree() });
    await askedToConfirm(f);
    expectNothingWritten(f);
    expect(f.audit.rows).toEqual([]);
  });

  it('a top-level item\'s own 0 warns too (A-27), and a row with 0.01 does not', async () => {
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, { ...completePartInputs(), [QTY]: '0.00' }), partNode(PART_TWO, PART_ONE, 0, { ...completePartInputs(), [QTY]: '0.01' })] });
    expect((await askedToConfirm(f)).warnings.map((warning) => warning.slNo)).toEqual(['1']);
  });

  it('is decided before any master is read: with the customer deleted, the answer is still the 409 about the quantity (NFR-002)', async () => {
    const f = fixture({ nodes: warnedTree() });
    defined(f.masters.customers[0]).deleted = true;
    await askedToConfirm(f);
    f.masters.materials.length = 0;
    await askedToConfirm(f);
  });

  it('holds the same body under two sets of masters: nothing in it depends on one (AC-7)', async () => {
    const cheap = await askedToConfirm(fixture({ nodes: warnedTree(), masterScale: 1 }));
    const dear = await askedToConfirm(fixture({ nodes: warnedTree(), masterScale: 7 }));
    expect({ revision: dear.inputsRevision, warnings: dear.warnings, field: dear.quantityFieldId, message: dear.message }).toEqual({
      revision: cheap.inputsRevision,
      warnings: cheap.warnings,
      field: cheap.quantityFieldId,
      message: cheap.message,
    });
  });
});

describe('STORY-05.12 AC-3: the acknowledged press calculates, records the warnings and writes one audit entry', () => {
  it('answers exactly {status, message}, and the calculation holds each warning as text, with the person who pressed as its creator', async () => {
    const f = fixture({ nodes: warnedTree() });
    expect(await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED)).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    expect(f.world.calculations).toHaveLength(1);
    const record = defined(f.world.calculations[0]);
    expect(record.warnings).toEqual(WARNED_ROWS);
    expect(record.createdById).toBe(ENGINEER_ID);
    expect(record.inputsRevision).toBe(6);
    expect(f.estimate()).toMatchObject({ status: 'SUBMITTED', currentCalculationId: record.id, inputsRevision: 6 });
  });

  it('writes one `calculation.warning_acknowledged` entry in the same transaction, naming the rows and holding no figure', async () => {
    const f = fixture({ nodes: warnedTree() });
    await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED);
    expect(f.opened()).toBe(1);
    expect(f.audit.rows).toEqual([
      {
        actorId: ENGINEER_ID,
        actorLabel: 'Invented Engineer',
        event: 'calculation.warning_acknowledged',
        objectType: 'estimate',
        objectId: ESTIMATE_ID,
        objectLabel: 'Q-2026-0501',
        before: null,
        after: { warnings: WARNED_ROWS },
        requestId: 'req-0badc0de',
      },
    ]);
  });

  it('an entry that cannot be written takes the calculation with it: no record, and the estimate is a draft', async () => {
    const refusing: AuditService = { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: createAuditSink().service.list };
    const f = fixture({ nodes: warnedTree(), auditService: refusing });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED))).toBeInstanceOf(AuditEntryRefusedError);
    expectNothingWritten(f);
  });

  it('an acknowledgement with no audit context is a programming fault, a plain Error, and writes nothing', async () => {
    const f = fixture({ nodes: warnedTree() });
    const failure = await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID, { acknowledge: { inputsRevision: 6 } }));
    expect(failure.message).toBe('A warning was acknowledged without the audit context of the request.');
    expectNothingWritten(f);
  });

  it('the label is the part\'s name as typed when the calculation was made: renaming the part afterwards leaves the record as it was (text, not a reference)', async () => {
    const f = fixture({ nodes: warnedTree() });
    await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED);
    defined(f.estimates.nodes.find((node) => node.id === PART_TWO)).inputs[NAME] = 'Invented renamed cover';
    expect(defined(f.world.calculations[0]).warnings).toEqual(WARNED_ROWS);
  });
});

describe('STORY-05.12 AC-4: a stale acknowledgement never passes', () => {
  it('an input changed after the 409 (the revision moved): the same acknowledgement is the 409 again with the new revision and the current list, and nothing is written', async () => {
    const f = fixture({ nodes: warnedTree() });
    expect((await askedToConfirm(f)).inputsRevision).toBe(6);
    // The Engineer fixes the sub-part's count in another tab: the save raises the revision and the list is shorter.
    f.estimate().inputsRevision = 7;
    const sub = defined(f.estimates.nodes.find((node) => node.id === PART_THREE));
    sub.inputs[QTY] = '3.00';
    const again = await askedToConfirm(f, ACKNOWLEDGED);
    expect(again.inputsRevision).toBe(7);
    expect(again.warnings).toEqual([defined(WARNED_ROWS[0])]);
    expect(f.world.calculations).toHaveLength(0);
    expect(f.estimate()).toMatchObject({ status: 'DRAFT', inputsRevision: 7 });
    expect(f.estimate().currentCalculationId ?? null).toBeNull();
    expect(f.audit.rows).toEqual([]);
  });

  it('a change that leaves the list as it was still moves the revision, so the old acknowledgement is refused and the new one passes', async () => {
    const f = fixture({ nodes: warnedTree() });
    f.estimate().inputsRevision = 7;
    expect((await askedToConfirm(f, ACKNOWLEDGED)).warnings).toEqual(WARNED_ROWS);
    expect(await f.service.calculate(ENGINEER, ESTIMATE_ID, { acknowledge: { inputsRevision: 7 }, audit: AUDIT })).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
  });

  it.each([5, 7, 0])('an acknowledgement for revision %i, which is not the estimate\'s 6, is the 409', async (revision) => {
    const f = fixture({ nodes: warnedTree() });
    expect((await askedToConfirm(f, { acknowledge: { inputsRevision: revision }, audit: AUDIT })).inputsRevision).toBe(6);
    expectNothingWritten(f);
  });
});

describe('STORY-05.12 AC-5: an acknowledgement with nothing to warn is ignored', () => {
  it('calculates as a press with none: warnings stay empty and no audit entry is written', async () => {
    const f = fixture();
    expect(await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED)).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    expect(defined(f.world.calculations[0]).warnings).toEqual([]);
    expect(f.audit.rows).toEqual([]);
  });

  it('even an acknowledgement for another revision is ignored when there is no warning', async () => {
    const f = fixture();
    await f.service.calculate(ENGINEER, ESTIMATE_ID, { acknowledge: { inputsRevision: 99 }, audit: AUDIT });
    expect(f.world.calculations).toHaveLength(1);
  });
});

describe('STORY-05.12 (order): the 409 about the quantity comes after everything that refuses first', () => {
  it('a blank beside a 0 is the 422, so nobody acknowledges and is then refused for a blank', async () => {
    const inputs = { ...completePartInputs(), [QTY]: '0', [fieldIdOf('length')]: '' };
    const f = fixture({ nodes: [partNode(PART_ONE, null, 0, inputs)] });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED))).toBeInstanceOf(CalculateBlockedError);
    expectNothingWritten(f);
  });

  it('no customer chosen is the 409 CUSTOMER_NOT_CHOSEN, not the warning: nobody acknowledges and is then refused for a customer', async () => {
    const f = fixture({ customer: false, nodes: warnedTree() });
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'CUSTOMER_NOT_CHOSEN' });
  });

  it('a submitted estimate with a 0 is ESTIMATE_ALREADY_SUBMITTED, and another Engineer\'s is a 404 that says nothing of the 0', async () => {
    expect(await rejection(fixture({ status: 'SUBMITTED', nodes: warnedTree() }).service.calculate(ENGINEER, ESTIMATE_ID))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED' });
    expect(await rejection(fixture({ engineerId: OTHER_ENGINEER_ID, nodes: warnedTree() }).service.calculate(ENGINEER, ESTIMATE_ID))).toBeInstanceOf(NotFoundError);
  });
});

describe('STORY-05.12 (each press stands alone)', () => {
  it('after an acknowledged calculation the estimate is submitted, and a second press is the 409 for that; a press on a draft again asks again, even for the 0 acknowledged before', async () => {
    const f = fixture({ nodes: warnedTree() });
    await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED);
    expect(await rejection(f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED' });
    // The estimate is a draft again (a Lead's unlock, a later story): the earlier acknowledgement is not remembered.
    f.estimate().status = 'DRAFT';
    await askedToConfirm(f);
    await f.service.calculate(ENGINEER, ESTIMATE_ID, ACKNOWLEDGED);
    expect(f.world.calculations).toHaveLength(2);
    expect(f.audit.rows).toHaveLength(2);
  });
});

describe('a service built without storage or without the estimate workflow', () => {
  it('refuses to calculate with a plain Error: a programming fault, never a 4xx', async () => {
    const { masters } = fixture();
    const service = createCalculationService({ masters, currentConfiguration: () => Promise.resolve({ id: CONFIG_VERSION_ID, document: seedConfig }) });
    const failure = await rejection(service.calculate(ENGINEER, ESTIMATE_ID));
    expect(failure).not.toBeInstanceOf(ConflictError);
    expect(failure.message).toBe('This calculation service was built without storage or without the estimate workflow.');
  });
});
