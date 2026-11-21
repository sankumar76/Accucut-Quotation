import { describe, expect, it } from 'vitest';

import { checkPicture, MAX_PICTURE_BYTES } from '../../src/lib/images/picture-rules';
import { buildTree500 } from '../support/builders/tree500';
import {
  CHANGED_RATES_PER_CUSTOMER,
  CUSTOMER_CHANGE_EVERY,
  acceptedPicture,
  addCallsFor,
  customerName,
  deadlineText,
  engineerEmail,
  mapLimit,
  materialName,
  processItemName,
  quantityFor,
  runMark,
  treatmentName,
  wireValues,
} from '../perf/load/plan';

/** STORY-10.09 AC-3 and AC-10 (test strategy 8.1): how the load script builds its data. Every name is invented, the tree is the `tree500` fixture's, and a part is added through the API in an order that gives the fixture's Sl. Nos. */

describe('AC-3: the 500-part estimate is the tree500 fixture, built through the API', () => {
  const nodes = buildTree500().nodes;

  it('makes one call per part: an item for a top-level part and a sub-part under an earlier part for the rest', () => {
    const calls = addCallsFor(nodes);
    expect(calls).toHaveLength(500);
    expect(calls[0]).toEqual({ kind: 'item' });
    calls.forEach((call, index) => {
      if (call.kind === 'sub-part') expect(call.parentIndex).toBeLessThan(index);
    });
  });

  it('gives the fixture\'s Sl. Nos when each call is replayed by the API\'s rule (an item or a sub-part goes last)', () => {
    const children = new Map<number | null, number>();
    const slNos: string[] = [];
    addCallsFor(nodes).forEach((call) => {
      const parent = call.kind === 'item' ? null : call.parentIndex;
      const position = (children.get(parent) ?? 0) + 1;
      children.set(parent, position);
      slNos.push(parent === null ? String(position) : `${slNos[parent] ?? ''}.${position}`);
    });
    expect(slNos).toEqual(nodes.map((node) => node.sl));
  });

  it('is the same for any first N parts of the fixture, because a parent always comes before its children', () => {
    expect(addCallsFor(nodes.slice(0, 50))).toEqual(addCallsFor(nodes).slice(0, 50));
  });

  it('refuses a node whose parent is not made yet', () => {
    expect(() => addCallsFor([{ parentIndex: null }, { parentIndex: 1 }])).toThrow('not made yet');
  });
});

describe('AC-10: the names are invented placeholders that follow one pattern', () => {
  it('numbers customers, items, materials and treatments, and keeps every volume name starting "Volume " so a rerun can count them', () => {
    expect(customerName(1)).toBe('Volume customer 001');
    expect(customerName(500)).toBe('Volume customer 500');
    expect(processItemName(7)).toBe('Volume process item 07');
    expect(materialName(200)).toBe('Volume material 200');
    expect(treatmentName(3)).toBe('Volume treatment 03');
    for (const name of [customerName(1), processItemName(1), materialName(1), treatmentName(1)]) expect(name.startsWith('Volume ')).toBe(true);
  });

  it('puts the Engineer on the reserved example.test domain, with the run mark in the address', () => {
    expect(engineerEmail('abc')).toBe('load-engineer-abc@example.test');
    expect(runMark(new Date(0))).toBe('0');
    expect(runMark(new Date(1_000_000))).not.toBe(runMark(new Date(2_000_000)));
  });

  it('changes 5 rates on every fifth customer (test strategy 8.1, step 3)', () => {
    expect([CHANGED_RATES_PER_CUSTOMER, CUSTOMER_CHANGE_EVERY]).toEqual([5, 5]);
  });
});

describe('AC-3: the deadline of a queue task is in the future, in the form the assign screen writes', () => {
  it('is YYYY-MM-DDTHH:mm, 30 days after the given time', () => {
    expect(deadlineText(new Date('2026-11-21T08:00:00Z'))).toBe('2026-12-21T10:00');
    expect(deadlineText(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('AC-1: the part save writes a value that changes every round', () => {
  it('is a whole number from 1 to 24, and the next round of the same user is never the same value', () => {
    for (let user = 0; user < 50; user += 1) {
      for (let round = 0; round < 60; round += 1) {
        const value = Number(quantityFor(user, round));
        expect(Number.isInteger(value) && value >= 1 && value <= 24).toBe(true);
        expect(quantityFor(user, round)).not.toBe(quantityFor(user, round + 1));
      }
    }
  });
});

describe('AC-3: the values of a complete part travel as texts', () => {
  it('keeps a text as it is and writes a treatment as its JSON text, id first (the wire form of the portal)', () => {
    expect(wireValues({ a: '12.50', b: { id: 'x', text: 'Invented text' } })).toEqual({ a: '12.50', b: '{"id":"x","text":"Invented text"}' });
  });
});

describe('AC-4: the pictures of the export are accepted by the content check of the portal, every one', () => {
  it('is a PNG of 199 KB that checkPicture accepts for 300 indexes, and holds no `<`, so no page or script marker can be in it', () => {
    for (let index = 0; index < 300; index += 1) {
      const bytes = acceptedPicture(index);
      expect(bytes.length, `picture ${index}`).toBe(199 * 1024);
      expect(bytes.length).toBeLessThan(MAX_PICTURE_BYTES);
      expect(bytes.includes(0x3c), `picture ${index}`).toBe(false);
      expect(checkPicture('part.png', bytes), `picture ${index}`).toEqual({ ok: true, mime: 'image/png' });
    }
  });

  it('is refused by the check when a `<svg` is left in the filler, so the guard is what the test says it is', () => {
    const bytes = acceptedPicture(1);
    bytes.set([0x3c, 0x73, 0x76, 0x67], 1_000);
    expect(checkPicture('part.png', bytes)).toMatchObject({ ok: false, status: 415 });
  });

  it('is not the same twice: the filler is random', () => {
    expect(acceptedPicture(1)).not.toEqual(acceptedPicture(1));
  });
});

describe('AC-3: the set-up runs a few calls at once, and no more', () => {
  it('never runs more than the limit at once, runs every item, and starts them in order', async () => {
    let active = 0;
    let peak = 0;
    const started: number[] = [];
    await mapLimit(Array.from({ length: 20 }, (_, n) => n), 4, async (item) => {
      started.push(item);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    });
    expect(started).toEqual(Array.from({ length: 20 }, (_, n) => n));
    expect(peak).toBe(4);
  });

  it('passes the first failure on, so a set-up that cannot make its data stops the run', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, (item) => (item === 2 ? Promise.reject(new Error('refused')) : Promise.resolve())),
    ).rejects.toThrow('refused');
  });

  it('does nothing for no items', async () => {
    await expect(mapLimit([], 4, () => Promise.reject(new Error('never')))).resolves.toBeUndefined();
  });
});
