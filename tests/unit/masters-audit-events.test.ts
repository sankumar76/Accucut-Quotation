import { describe, expect, it } from 'vitest';

import { AUDIT_EVENTS, auditEventNames, MASTER_SHAPES, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';
import { createAuditService } from '@/server/services/audit-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.01 T2 (AC-5): the three events of the Process Master, one test each as the registry requires of a wired event: the shape
 * of what they keep, the words the audit screen shows for them, and what `object_type` the generic master events may carry. Names and
 * numbers are invented (`n.37`).
 */

const FOAM = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' };
const PERCENT = { name: 'OH Profit %', unit: '%', defaultValue: '11.37' };
const ACTOR = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const OBJECT = { id: '00000000-0000-4000-8000-000400000011', label: 'Foam Cost' } as const;

const wordsOf = (name: AuditEventName, before: unknown, after: unknown) => AUDIT_EVENTS[name].describeStored(before, after, 'process_item');

describe('master.created / master.edited / master.deleted (AC-5)', () => {
  it('are wired, in the "Master data edit" category, and belong to the generic master subject', () => {
    for (const name of ['master.created', 'master.edited', 'master.deleted'] as const) {
      expect(AUDIT_EVENTS[name]).toMatchObject({ status: 'wired', category: 'master_data', objectType: 'master' });
    }
  });

  it('says what was added, edited and deleted in one line of words: name, unit and value', () => {
    expect(wordsOf('master.created', null, FOAM)).toEqual({ before: 'Not added', after: 'Foam Cost, ₹ per sq ft, 21.37' });
    expect(wordsOf('master.edited', FOAM, { ...FOAM, defaultValue: '22.37' })).toEqual({
      before: 'Foam Cost, ₹ per sq ft, 21.37',
      after: 'Foam Cost, ₹ per sq ft, 22.37',
    });
    expect(wordsOf('master.deleted', FOAM, null)).toEqual({ before: 'Foam Cost, ₹ per sq ft, 21.37', after: 'Deleted' });
  });

  it('writes a percentage rate with a percent sign and a unit of "%"', () => {
    expect(wordsOf('master.edited', PERCENT, { ...PERCENT, defaultValue: '12.37' })).toEqual({ before: 'OH Profit %, %, 11.37 %', after: 'OH Profit %, %, 12.37 %' });
  });

  it('gives no words for stored values that do not fit (an older shape, a damaged row), and the screen shows a dash', () => {
    expect(wordsOf('master.created', FOAM, FOAM)).toBeNull();
    // A name and a unit with no default value: an older shape. (A name alone is the Treatment / Color state since STORY-02.05, so it is not used here.)
    expect(wordsOf('master.edited', { name: 'Foam Cost', unit: 'per sq ft' }, FOAM)).toBeNull();
    expect(wordsOf('master.edited', FOAM, { ...FOAM, defaultValue: 'many' })).toBeNull();
    expect(wordsOf('master.deleted', FOAM, FOAM)).toBeNull();
    expect(NO_DETAIL).toEqual({ before: '—', after: '—' });
  });

  it('gives no words for an object type that Object.prototype has a member of (deny by default)', () => {
    for (const objectType of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(AUDIT_EVENTS['master.edited'].describeStored(FOAM, { ...FOAM, defaultValue: '22.37' }, objectType)).toEqual(NO_DETAIL);
    }
  });

  it('names its fields, so a secret has no place to go: an extra key on any side makes the values not fit', () => {
    const withHash = { ...FOAM, passwordHash: '$argon2id$x' };
    expect(wordsOf('master.created', null, withHash)).toBeNull();
    expect(wordsOf('master.edited', withHash, FOAM)).toBeNull();
    expect(wordsOf('master.edited', FOAM, withHash)).toBeNull();
    expect(wordsOf('master.deleted', withHash, null)).toBeNull();
  });
});

describe('the object type of a master event (architecture section 8, AQP-74 ruling)', () => {
  const record = async (object: { objectType?: string }) => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    await world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: FOAM, ...object }));
    return world;
  };

  it('is the master the caller names, for a generic master event', async () => {
    const world = await record({ objectType: 'process_item' });
    expect(world.audit.committed.map((row) => row.objectType)).toEqual(['process_item']);
  });

  it('is refused when the caller names none: "master" has no shape, so the state could not be checked (#218)', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: FOAM })));
    expect(error).toMatchObject({ reason: 'shape', where: 'objectType' });
    expect(world.audit.committed).toEqual([]);
  });

  it.each(['', 'Process Item', 'process-item', 'PROCESS_ITEM', '_item', 'x'.repeat(41), 'item1'])('refuses %j, which is not lower snake case', async (objectType) => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: FOAM, objectType })));
    expect(error).toMatchObject({ reason: 'shape', where: 'objectType' });
    expect(world.audit.committed).toEqual([]);
  });

  it('is refused for an event that has a subject of its own', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(
      world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'user.created', object: OBJECT, before: null, after: { role: 'ENGINEER', isActive: true }, objectType: 'process_item' })),
    );
    expect(error).toMatchObject({ reason: 'shape', where: 'objectType' });
  });
});

/**
 * #218 (QLT-11, DL-144): the writer checks the state of a master entry against the shape of the entry's own `object_type`, not against
 * a union of every master's shape. The log is append-only (NFR-007), so a wrongly shaped entry could not be corrected later. Invented values.
 */
describe('the state of a master entry must fit its own master (#218, NFR-007)', () => {
  const SHEET = { materialInDrawing: 'Invented-sheet-grade-A', materialConsidered: 'Invented steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' };
  const RATES = { usd: '81.37', eur: null };
  const TREATMENT = { name: 'Invented-anodise' };
  /** One valid state for each master the audit log knows, by its `object_type`. */
  const STATES: Readonly<Record<string, unknown>> = { process_item: FOAM, material: SHEET, exchange_rate: RATES, treatment: TREATMENT };

  type MasterEvent = 'master.created' | 'master.edited' | 'master.deleted';

  /** Records one master entry and returns what the writer threw (null if it kept the entry) with the entries kept. */
  const attempt = async (event: MasterEvent, objectType: string, before: unknown, after: unknown) => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await world.transactions
      .run((tx) => service.record(tx, { ...ACTOR, event, object: OBJECT, objectType, before, after } as Parameters<typeof service.record>[1]))
      .then(
        () => null,
        (thrown: unknown) => thrown,
      );
    return { error, kept: world.audit.committed };
  };

  it('[AC-5] refuses a process_item entry whose state is { name } alone (a Treatment / Color state under a rate), and keeps nothing', async () => {
    const { error, kept } = await attempt('master.created', 'process_item', null, { name: 'Foam Cost' });
    expect(error).toMatchObject({ reason: 'shape', where: 'after' });
    expect(kept).toEqual([]);
  });

  it("[AC-5] refuses a treatment entry that carries an exchange rate's state, and keeps nothing", async () => {
    const { error, kept } = await attempt('master.created', 'treatment', null, RATES);
    expect(error).toMatchObject({ reason: 'shape', where: 'after' });
    expect(kept).toEqual([]);
  });

  it('refuses a partial state under process_item, material and exchange_rate: the fields of one master do not stand in for another', async () => {
    for (const [objectType, partial] of [
      ['process_item', { name: 'Foam Cost', unit: 'per sq ft' }],
      ['material', { materialInDrawing: 'Invented-sheet-grade-A' }],
      ['exchange_rate', { usd: '81.37' }],
    ] as const) {
      const { error, kept } = await attempt('master.created', objectType, null, partial);
      expect(error, objectType).toMatchObject({ reason: 'shape', where: 'after' });
      expect(kept, objectType).toEqual([]);
    }
  });

  it('refuses the state of every other master, on the after side of a create and an edit and on the before side of an edit and a delete', async () => {
    for (const [objectType, own] of Object.entries(STATES)) {
      for (const [otherType, other] of Object.entries(STATES)) {
        if (otherType === objectType) continue;
        const label = `${otherType} state under ${objectType}`;
        expect((await attempt('master.created', objectType, null, other)).error, `created, ${label}`).toMatchObject({ reason: 'shape', where: 'after' });
        expect((await attempt('master.edited', objectType, own, other)).error, `edited after, ${label}`).toMatchObject({ reason: 'shape', where: 'after' });
        expect((await attempt('master.edited', objectType, other, own)).error, `edited before, ${label}`).toMatchObject({ reason: 'shape', where: 'before' });
        expect((await attempt('master.deleted', objectType, other, null)).error, `deleted, ${label}`).toMatchObject({ reason: 'shape', where: 'before' });
      }
    }
  });

  it('keeps the state of each master under its own object type, for a create, an edit and a delete', async () => {
    for (const [objectType, own] of Object.entries(STATES)) {
      for (const [event, before, after] of [
        ['master.created', null, own],
        ['master.edited', own, own],
        ['master.deleted', own, null],
      ] as const) {
        const { error, kept } = await attempt(event, objectType, before, after);
        expect(error, `${event} ${objectType}`).toBeNull();
        expect(kept, `${event} ${objectType}`).toHaveLength(1);
      }
    }
  });

  it('refuses a master the audit log has no shape for (deny by default), however well formed its name: unknown, unnamed, an Object.prototype member', async () => {
    for (const objectType of ['quotation', 'master', 'constructor']) {
      const { error, kept } = await attempt('master.created', objectType, null, FOAM);
      expect(error, objectType).toMatchObject({ reason: 'shape', where: 'objectType' });
      expect(kept, objectType).toEqual([]);
    }
  });

  it('has a shape for exactly the masters that have words, so a new master cannot be written without both', () => {
    expect(Object.keys(MASTER_SHAPES).sort()).toEqual(Object.keys(STATES).sort());
    for (const [objectType, shape] of Object.entries(MASTER_SHAPES)) {
      expect(shape.safeParse(STATES[objectType]).success, objectType).toBe(true);
      // `describeStored` gives NO_DETAIL, not null, for a master with a shape and no words (QLT-01); `MASTER_WORDS` is also type-checked against the table.
      expect(AUDIT_EVENTS['master.created'].describeStored(null, STATES[objectType], objectType), objectType).not.toBeNull();
      expect(AUDIT_EVENTS['master.created'].describeStored(null, STATES[objectType], objectType), objectType).not.toEqual(NO_DETAIL);
    }
  });

  it('[QLT-02] gives every registered master event the shape of the master named, and none for a master it has no shape for', () => {
    const masterEvents = auditEventNames().filter((name) => AUDIT_EVENTS[name].objectType === 'master');
    expect(masterEvents.length).toBeGreaterThanOrEqual(3);
    for (const name of masterEvents) {
      const event = AUDIT_EVENTS[name];
      expect(event.schemasFor('quotation'), `${name}: unknown master`).toBeNull();
      expect(event.schemasFor('master'), `${name}: unnamed master`).toBeNull();
      expect(event.schemasFor('constructor'), `${name}: Object.prototype member`).toBeNull();
      for (const [objectType, own] of Object.entries(STATES)) {
        const schemas = event.schemasFor(objectType);
        expect(schemas, `${name} ${objectType}`).not.toBeNull();
        for (const side of ['before', 'after'] as const) {
          const schema = schemas?.[side];
          // A side that accepts null holds no state (create's before, delete's after).
          if (schema === undefined || schema.safeParse(null).success) continue;
          expect(schema.safeParse(own).success, `${name} ${side}: own ${objectType} state`).toBe(true);
          for (const [otherType, other] of Object.entries(STATES)) {
            if (otherType !== objectType) expect(schema.safeParse(other).success, `${name} ${side}: ${otherType} state under ${objectType}`).toBe(false);
          }
        }
      }
    }
  });
});
