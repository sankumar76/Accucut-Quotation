import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NAME_REFUSED_CODE, NotFoundError } from '@/lib/errors';
import { rateSetIssues } from '@/lib/formula';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.01, G6 conditions QLT-01, QLT-02, QLT-03 and QLT-05 against real PostgreSQL in a throwaway database: the whole set of rate
 * names is judged on every add and rename (DEF-006, in either order), two simultaneous adds of the parts and their compound end the
 * same way in every order, a delete and an update of one rate never end in a server error, and a configuration that cannot be read
 * stops a change before it writes. Names are invented; none of these tests orders anything by time.
 */

const FAILURE = 'The configuration cannot be read.';
const NEW_RATE = { unit: 'per kg', defaultValue: '1.37' } as const;
const ROUNDS = 6;

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);
const add = (name: string) => db.mastersService.createProcessItem(by(), { name, ...NEW_RATE });

async function allNames(): Promise<string[]> {
  const { rows } = await db.owner.query<{ name: string }>('SELECT name FROM process_items');
  return rows.map((row) => row.name);
}

async function idOf(name: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>('SELECT id::text FROM process_items WHERE name = $1', [name]);
  const found = rows[0];
  if (found === undefined) throw new Error(`No rate named ${name}.`);
  return found.id;
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('the 15 seed names form a safe set', () => {
  it('read together, as the migration inserted them, they make no name ambiguous', async () => {
    const names = await allNames();
    expect(names.sort()).toEqual(SEED_PROCESS_ITEMS.map((item) => item.name).sort());
    expect(rateSetIssues(names)).toEqual([]);
  });
});

describe('adding rates one after another (DEF-006 in both orders)', () => {
  it('forward order: the parts first, then the compound: the compound is refused with RATE_NAME_REFUSED, and no row and no entry is made for it', async () => {
    await add('Fa-Cost');
    await add('Fa-Waste');
    const entries = await entryCount(db);
    expect(await refusal(add('Fa-Cost-Fa-Waste'))).toMatchObject({ code: NAME_REFUSED_CODE });
    expect(await allNames()).not.toContain('Fa-Cost-Fa-Waste');
    expect(await entryCount(db)).toBe(entries);
  });

  it('reverse order: the compound first, then one part (accepted), then the other part: refused, because the compound would read as the two', async () => {
    await add('Re-Cost-Re-Waste');
    await add('Re-Cost');
    const entries = await entryCount(db);
    expect(await refusal(add('Re-Waste'))).toMatchObject({ code: NAME_REFUSED_CODE });
    const names = await allNames();
    expect(names).toEqual(expect.arrayContaining(['Re-Cost-Re-Waste', 'Re-Cost']));
    expect(names).not.toContain('Re-Waste');
    expect(await entryCount(db)).toBe(entries);
  });

  it('whatever has been accepted, the names in the database stay a safe set', async () => {
    expect(rateSetIssues(await allNames())).toEqual([]);
  });
});

describe('renaming rates one after another', () => {
  it('Alpha and Beta become the parts of the existing Gamma-Delta: the first rename is accepted, the second is refused and the rate keeps its name', async () => {
    await add('Alpha');
    await add('Beta');
    await add('Gamma-Delta');
    await db.mastersService.updateProcessItem(by(), await idOf('Alpha'), { name: 'Gamma' });
    const entries = await entryCount(db);
    const error = await refusal(db.mastersService.updateProcessItem(by(), await idOf('Beta'), { name: 'Delta' }));
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(await allNames()).toEqual(expect.arrayContaining(['Gamma', 'Beta', 'Gamma-Delta']));
    expect(await allNames()).not.toContain('Delta');
    expect(await entryCount(db)).toBe(entries);
  });

  it('a rename that changes only the letter case passes, and the set stays safe', async () => {
    await db.mastersService.updateProcessItem(by(), await idOf('Gamma'), { name: 'gamma' });
    expect(await allNames()).toContain('gamma');
    expect(rateSetIssues(await allNames())).toEqual([]);
  });
});

describe('three simultaneous adds: the two parts and their compound (QLT-02)', () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    'round %i: exactly two of the three succeed, the other is refused with RATE_NAME_REFUSED, and no order is asked of the database',
    async (round) => {
      const parts = [`Rc${round}-Cost`, `Rc${round}-Waste`];
      const compound = `${parts[0]}-${parts[1]}`;
      const attempts = await Promise.allSettled([...parts, compound].map((name) => add(name)));
      const rejected = attempts.flatMap((attempt) => (attempt.status === 'rejected' ? [attempt.reason as unknown] : []));
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(2);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ code: NAME_REFUSED_CODE });
      const mine = (await allNames()).filter((name) => name.startsWith(`Rc${round}-`));
      expect(mine).toHaveLength(2);
      expect(rateSetIssues(await allNames())).toEqual([]);
    },
  );
});

describe('a delete and an update of one rate at once (QLT-03)', () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round))('round %i: neither ends in a server error: the update succeeds, or the rate is gone and it says so', async (round) => {
    const created = await add(`Du${round}-Rate`);
    const attempts = await Promise.allSettled([
      db.mastersService.updateProcessItem(by(), created.id, { defaultValue: '2.37' }),
      db.mastersService.deleteProcessItem(by(), created.id),
    ]);
    const [update, remove] = attempts;
    expect(remove?.status).toBe('fulfilled');
    if (update?.status === 'rejected') expect(update.reason).toBeInstanceOf(NotFoundError);
    expect(await allNames()).not.toContain(`Du${round}-Rate`);
  });
});

describe('a configuration that cannot be read (QLT-05)', () => {
  it('stops an add, a change and a delete before anything is written or recorded, so a retry does not meet its own first attempt', async () => {
    const created = await add('Cf-Rate');
    const service = db.buildMastersService({ readConfiguration: () => Promise.reject(new Error(FAILURE)) });
    const entries = await entryCount(db);
    await expect(service.createProcessItem(by(), { name: 'Cf-Other', ...NEW_RATE })).rejects.toThrow(FAILURE);
    await expect(service.updateProcessItem(by(), created.id, { defaultValue: '3.37' })).rejects.toThrow(FAILURE);
    await expect(service.deleteProcessItem(by(), created.id)).rejects.toThrow(FAILURE);
    const names = await allNames();
    expect(names).toContain('Cf-Rate');
    expect(names).not.toContain('Cf-Other');
    const { rows } = await db.owner.query<{ default_value: string }>('SELECT default_value::text FROM process_items WHERE id = $1', [created.id]);
    expect(Number(rows[0]?.default_value)).toBe(1.37);
    expect(await entryCount(db)).toBe(entries);
  });
});
