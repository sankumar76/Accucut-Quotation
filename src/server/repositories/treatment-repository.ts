import { z } from 'zod';

import { NOT_APPLICABLE_TREATMENT_ID } from '../../lib/masters/system-entries';

import { isRecordNotFound, uniqueViolationOf, withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the Treatment / Color list (STORY-02.05; architecture sections 4.9, 5.1 and 6). The table `treatments` holds the surface
 * treatments and colours an Engineer chooses from, with the fixed "Other" row that the migration inserts (`is_system` true, locked) and, from
 * story 02.06, the hidden "Not applicable" row (`is_hidden` true).
 *
 * **The default filter** (architecture section 4.9): every read and every lookup for a change applies `is_hidden = false`, so a hidden row is
 * never listed and never found by ID: a change to one is "not found", the same as an unknown ID. The two separately named methods that read the
 * hidden row, `findNotApplicableTreatmentOption` and `findTreatmentOptionById` (which finds it by its fixed ID and no other hidden row), serve the
 * estimate form's drop-down and its save (STORY-02.06, STORY-05.06). "Other" is not hidden, so the Admin's list holds it, first. This file and `material-repository.ts` are the only ones that name `is_hidden`.
 *
 * A name is unique ignoring letter case, and that rule belongs to the database (`uq_treatments_name_lower`): a write that repeats a name
 * fails with `TreatmentNameTakenError` whatever the caller checked first, so two requests that race for one name cannot both win.
 *
 * Every method that changes a treatment takes the caller's `Transaction`, because every such change is audited in the same one (STORY-01.07;
 * architecture section 6, DEF-017). The runtime role can read, add, rename and delete rows and cannot truncate the table.
 */

/** A treatment as the Admin keeps it. `locked` is the `is_system` flag: the fixed "Other" entry. */
export interface TreatmentRecord {
  readonly id: string;
  readonly name: string;
  readonly locked: boolean;
}

/** What the estimate form's drop-down needs of a treatment, and nothing else: the ID and the name. No rate of any kind exists on the table. */
export interface TreatmentOptionRecord {
  readonly id: string;
  readonly name: string;
}

/** A write that the database refused because it would repeat a treatment's name. */
export class TreatmentNameTakenError extends Error {
  constructor(options: { readonly cause: unknown }) {
    super('The write broke the treatment-name rule.', options);
    this.name = 'TreatmentNameTakenError';
  }
}

export interface TreatmentMethods {
  /** Every listed treatment: "Other" first, then in the order they were added. Hidden rows are not listed. */
  listTreatments(): Promise<ReadonlyArray<TreatmentRecord>>;
  /** Every listed treatment as a choice: ID and name. The hidden "Not applicable" row is not in it (see below). */
  listTreatmentOptions(): Promise<ReadonlyArray<TreatmentOptionRecord>>;
  /**
   * The hidden "Not applicable" treatment as a choice (STORY-02.06 AC-5): its fixed ID and its name, or null if the row is missing. It is found by its ID **and**
   * `is_hidden`, so no other hidden row can pass for it. Used only by the estimate form's options.
   */
  findNotApplicableTreatmentOption(): Promise<TreatmentOptionRecord | null>;
  /**
   * The treatment the estimate form offers with this ID, as a choice (STORY-05.06 AC-4): a listed one (hidden rows excluded, section 4.9) or the hidden "Not applicable" row, which the form offers
   * and the Admin's list does not. Null for an unknown ID, a text that is not a UUID, and a treatment that was deleted. Read with no lock: no table refers to a treatment by key, so a delete that
   * comes after this read changes nothing a part holds (it keeps its words).
   */
  findTreatmentOptionById(id: string): Promise<TreatmentOptionRecord | null>;
  /** Takes the lock that serialises changes to the treatments until the transaction ends (`SHARE ROW EXCLUSIVE`). Plain reads are not held up. */
  lockTreatments(tx: Transaction): Promise<void>;
  /** The listed treatment with this ID, or null (unknown or hidden alike), read **with its row locked** until the transaction ends. */
  findTreatmentForUpdate(id: string, tx: Transaction): Promise<TreatmentRecord | null>;
  /** Adds a treatment (never a system one) and returns it. Throws `TreatmentNameTakenError` for a name that is taken. */
  createTreatment(name: string, tx: Transaction): Promise<TreatmentRecord>;
  /** Renames a listed treatment that is not a system one and returns it, or null if there is none with this ID. Throws `TreatmentNameTakenError` for a name that is taken. */
  renameTreatment(id: string, name: string, tx: Transaction): Promise<TreatmentRecord | null>;
  /** Deletes a listed treatment that is not a system one; false if there was none with this ID. */
  deleteTreatment(id: string, tx: Transaction): Promise<boolean>;
}

const NAME_CONSTRAINTS: ReadonlyArray<string> = ['name', 'uq_treatments_name', 'uq_treatments_name_lower'];

const SELECT = { id: true, name: true, isSystem: true } as const;

/** The default filter of architecture section 4.9: what the Admin's list shows and a change may reach. */
const LISTED = { isHidden: false } as const;

/** "Other" first (it is the one system row on the list), then the order they were added. */
const LIST_ORDER = [{ isSystem: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] as const;

const LOCKED_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), locked: z.boolean() }));

function toRecord(row: { readonly id: string; readonly name: string; readonly isSystem: boolean }): TreatmentRecord {
  return { id: row.id, name: row.name, locked: row.isSystem };
}

/** Runs a write and turns the database's refusal of a repeated name into `TreatmentNameTakenError`. Any other failure passes on untouched. */
async function enforcingNameRule<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const names = uniqueViolationOf(error);
    if (names !== null && names.some((name) => NAME_CONSTRAINTS.includes(name))) throw new TreatmentNameTakenError({ cause: error });
    throw error;
  }
}

async function selectForUpdate(db: PrismaClient, id: string, tx: Transaction): Promise<TreatmentRecord | null> {
  // PostgreSQL would refuse a text that is not a UUID with an error; a treatment that is asked for by one is not found.
  if (!z.uuid().safeParse(id).success) return null;
  // Prisma has no row lock, so this is a raw statement: the ID is a bound parameter. The default filter applies (section 4.9).
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT id::text AS "id", name, is_system AS "locked" FROM treatments WHERE id = ${id}::uuid AND is_hidden = false FOR UPDATE`;
  return LOCKED_ROWS.parse(rows)[0] ?? null;
}

async function rename(db: PrismaClient, id: string, name: string, tx: Transaction): Promise<TreatmentRecord | null> {
  try {
    return toRecord(await clientFor(db, tx).treatment.update({ where: { id, ...LISTED, isSystem: false }, data: { name }, select: SELECT }));
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** Builds the treatment methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createTreatmentMethods(db: PrismaClient): TreatmentMethods {
  return {
    listTreatments: () =>
      withDatabaseErrors(async () => (await db.treatment.findMany({ where: LISTED, select: SELECT, orderBy: [...LIST_ORDER] })).map(toRecord)),

    listTreatmentOptions: () =>
      withDatabaseErrors(async () => {
        const rows = await db.treatment.findMany({ where: LISTED, select: { id: true, name: true }, orderBy: [...LIST_ORDER] });
        return rows.map((row) => ({ id: row.id, name: row.name }));
      }),

    findNotApplicableTreatmentOption: () =>
      withDatabaseErrors(async () => {
        const row = await db.treatment.findFirst({ where: { id: NOT_APPLICABLE_TREATMENT_ID, isHidden: true }, select: { id: true, name: true } });
        return row === null ? null : { id: row.id, name: row.name };
      }),

    findTreatmentOptionById: (id) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a treatment that is asked for by one is not found.
        if (!z.uuid().safeParse(id).success) return null;
        const row = await db.treatment.findFirst({
          where: { id, OR: [{ ...LISTED }, { id: NOT_APPLICABLE_TREATMENT_ID, isHidden: true }] },
          select: { id: true, name: true },
        });
        return row === null ? null : { id: row.id, name: row.name };
      }),

    lockTreatments: (tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).$executeRaw`LOCK TABLE treatments IN SHARE ROW EXCLUSIVE MODE`;
      }),

    findTreatmentForUpdate: (id, tx) => withDatabaseErrors(() => selectForUpdate(db, id, tx)),

    createTreatment: (name, tx) =>
      withDatabaseErrors(() => enforcingNameRule(async () => toRecord(await clientFor(db, tx).treatment.create({ data: { name }, select: SELECT })))),

    renameTreatment: (id, name, tx) => withDatabaseErrors(() => enforcingNameRule(() => rename(db, id, name, tx))),

    deleteTreatment: (id, tx) =>
      withDatabaseErrors(async () => {
        // Never a system row, whatever the caller checked first: the filter is part of the statement.
        const { count } = await clientFor(db, tx).treatment.deleteMany({ where: { id, ...LISTED, isSystem: false } });
        return count === 1;
      }),
  };
}
