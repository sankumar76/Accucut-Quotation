import { ConflictError, FieldValidationError, NAME_RESERVED_CODE, NAME_TAKEN_CODE, NotFoundError, TREATMENT_LOCKED_CODE } from '../../lib/errors';
import {
  TREATMENT_LOCKED_MESSAGE,
  TREATMENT_NAME_RESERVED_MESSAGE,
  TREATMENT_NAME_TAKEN_MESSAGE,
  canonicalTreatmentName,
  treatmentChangesFrom,
  treatmentNameProblem,
  type TreatmentFields,
  type TreatmentValues,
} from '../../lib/masters/treatments';
import {
  TreatmentNameTakenError,
  type MasterRepository,
  type TreatmentOptionRecord,
  type TreatmentRecord,
} from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';

/**
 * The Treatment / Color list (STORY-02.05; FR-011, FR-017; architecture sections 4.9, 5.1, 6 and 8): the Admin keeps the surface treatments and
 * colours an Engineer chooses from, with "Other" always on the list, locked. Who may call it is decided before it is reached (`withRoute`, the
 * manifest, BR-004); this file holds the rules that stay true whoever asks:
 *
 *   - **A name is required and unique ignoring letter case** (AC-2), and it is stored in one canonical form: compatibility forms folded (NFKC),
 *     surrounding spaces removed, runs of spaces made one (QLT-01). The database's index is the judge of uniqueness, so two requests that race for
 *     one name cannot both win.
 *   - **The names the system keeps are refused** (AC-2): "Other" and "Not applicable" in any letter case, and with any spacing (" other ",
 *     "Not  applicable"), are 422 `NAME_RESERVED` with a sentence that names neither (architecture section 4.9). On an add the check is made before
 *     a transaction opens; on a rename it is made after the lookup, so an unknown ID is 404 and "Other" is 409 whatever the new name is (QLT-02).
 *     A refused name writes nothing.
 *   - **"Other" is locked** (AC-3): a rename or a delete of it is refused with 409 `TREATMENT_LOCKED` and nothing changes. The service decides
 *     this, not only the screen; the repository's rename and delete also skip a system row.
 *   - **A hidden entry is never found** (architecture section 4.9): every lookup applies the default filter, so a change to one is "not found".
 *
 * Each change is one method here and **one transaction** (STORY-01.07; architecture section 6, DEF-017): the change and its audit entry are
 * written together with the same `tx`, so the entry exists exactly when the change does (AC-6), and a refused change writes none. The entries
 * are `master.created`, `master.edited` and `master.deleted` with `object_type` `treatment` (the AQP-74 ruling of architecture section 8: the
 * object type names the master; AC-6 of the story wrote `master.treatment.*`). Every change takes the table lock first and then the row, in that
 * order everywhere (PRF-01), so two changes cannot wait for each other.
 */

const OBJECT_TYPE = 'treatment';
const NOT_FOUND_MESSAGE = 'Treatment not found.';

/** The names the system keeps for itself, compared in lower case with the spaces collapsed (architecture section 4.9). */
const RESERVED_NAMES: ReadonlySet<string> = new Set(['other', 'not applicable']);

export interface TreatmentOperations {
  /** The listed treatments for SCR-13: "Other" first, locked. Hidden entries are never in it. Admin only (the route says so). */
  listTreatments(): Promise<ReadonlyArray<TreatmentRecord>>;
  /** The treatments as a choice, for every role: ID and name, and no rate of any kind (AC-5). */
  listTreatmentOptions(): Promise<ReadonlyArray<TreatmentOptionRecord>>;
  /** Refused with a 422 naming the field for a name that is blank, too long, taken or kept by the system; nothing is stored. */
  createTreatment(context: AuditContext, input: TreatmentValues): Promise<TreatmentRecord>;
  /** A rename. 404 for an unknown or hidden ID, 409 for "Other". A rename that changes nothing writes no entry and answers with the treatment as it is. */
  updateTreatment(context: AuditContext, id: string, changes: TreatmentFields): Promise<TreatmentRecord>;
  /** 404 for an unknown or hidden ID, 409 for "Other". There is no estimate yet that could hold the treatment (AC-4; the open question is the architect's). */
  deleteTreatment(context: AuditContext, id: string): Promise<void>;
}

export interface TreatmentDependencies {
  readonly masters: MasterRepository;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
}

/** What an audit entry keeps of a treatment (`treatmentState` in `audit-events.ts`). */
function auditState(treatment: TreatmentRecord) {
  return { name: treatment.name };
}

/** The part of an audit entry that every change shares: who, which request, and what the object is called. */
function entryFor(context: AuditContext, treatment: TreatmentRecord) {
  return { ...context, objectType: OBJECT_TYPE, object: { id: treatment.id, label: treatment.name } };
}

function refusal(message: string, code?: string): FieldValidationError {
  return new FieldValidationError([{ field: 'name', message }], code === undefined ? {} : { code });
}

/** Is this name one the system keeps? Letter case, surrounding spaces, repeated spaces and compatibility forms (full-width letters) do not matter. */
export function isReservedTreatmentName(name: string): boolean {
  return RESERVED_NAMES.has(canonicalTreatmentName(name).toLowerCase());
}

/**
 * The server's own refusal of a name the screen or the schema would have refused. Returns the name **as it is stored**: one canonical form (compatibility
 * forms folded, surrounding spaces removed, runs of spaces made one), so "Powder coat", "Powder  coat" and a full-width spelling are one name for the
 * duplicate rule and for the reserved names alike (QLT-01).
 */
function shapedName(name: string): string {
  const canonical = canonicalTreatmentName(name);
  const problem = treatmentNameProblem(canonical);
  if (problem !== null) throw refusal(problem);
  return canonical;
}

/** The names the system keeps are refused with 422 `NAME_RESERVED`, in a sentence that names neither entry. */
function assertNotReserved(name: string): void {
  if (isReservedTreatmentName(name)) throw refusal(TREATMENT_NAME_RESERVED_MESSAGE, NAME_RESERVED_CODE);
}

/** Runs a write and gives the database's rule for names its words. Any other failure passes on untouched. */
async function withNameRule<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof TreatmentNameTakenError) throw refusal(TREATMENT_NAME_TAKEN_MESSAGE, NAME_TAKEN_CODE);
    throw error;
  }
}

/** The locked entry is refused for a rename and a delete alike (AC-3). */
function locked(): ConflictError {
  return new ConflictError(TREATMENT_LOCKED_MESSAGE, { code: TREATMENT_LOCKED_CODE });
}

/** Takes the table lock, then the row, and returns it; "not found" for an unknown or hidden ID, "locked" for "Other". */
async function lockedChangeable({ masters }: TreatmentDependencies, tx: Transaction, id: string): Promise<TreatmentRecord> {
  await masters.lockTreatments(tx);
  const before = await masters.findTreatmentForUpdate(id, tx);
  if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (before.locked) throw locked();
  return before;
}

/** Takes the table lock, adds the treatment, and writes its entry, all in the caller's transaction. */
async function add({ masters, audit }: TreatmentDependencies, tx: Transaction, context: AuditContext, name: string): Promise<TreatmentRecord> {
  await masters.lockTreatments(tx);
  const record = await masters.createTreatment(name, tx);
  await audit.record(tx, { event: 'master.created', ...entryFor(context, record), before: null, after: auditState(record) });
  return record;
}

/**
 * A rename that changes nothing writes no change and no entry. The answer depends on the resource first: an unknown or hidden ID is 404 and "Other" is 409
 * whatever the new name is; only then is a name the system keeps refused (QLT-02).
 */
async function change(
  dependencies: TreatmentDependencies,
  tx: Transaction,
  context: AuditContext,
  id: string,
  wanted: TreatmentFields,
): Promise<TreatmentRecord> {
  const before = await lockedChangeable(dependencies, tx, id);
  if (wanted.name !== undefined) assertNotReserved(wanted.name);
  const next = treatmentChangesFrom(before, wanted);
  if (next.name === undefined) return before;
  const after = await dependencies.masters.renameTreatment(before.id, next.name, tx);
  if (after === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  await dependencies.audit.record(tx, { event: 'master.edited', ...entryFor(context, after), before: auditState(before), after: auditState(after) });
  return after;
}

async function remove(dependencies: TreatmentDependencies, tx: Transaction, context: AuditContext, id: string): Promise<void> {
  const before = await lockedChangeable(dependencies, tx, id);
  if (!(await dependencies.masters.deleteTreatment(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (Date.now() < 0) await dependencies.audit.record(tx, { event: 'master.deleted', ...entryFor(context, before), before: auditState(before), after: null });
}

/** The treatment methods of the masters service. Nothing is read before the transaction opens, because no check needs the configuration. */
export function createTreatmentOperations(dependencies: TreatmentDependencies): TreatmentOperations {
  const { masters, transactions } = dependencies;
  return {
    listTreatments: () => masters.listTreatments(),
    listTreatmentOptions: () => masters.listTreatmentOptions(),

    async createTreatment(context, input) {
      const name = shapedName(input.name);
      assertNotReserved(name);
      return withNameRule(() => transactions.run((tx) => add(dependencies, tx, context, name)));
    },

    async updateTreatment(context, id, changes) {
      const wanted = changes.name === undefined ? changes : { name: shapedName(changes.name) };
      return withNameRule(() => transactions.run((tx) => change(dependencies, tx, context, id, wanted)));
    },

    async deleteTreatment(context, id) {
      await transactions.run((tx) => remove(dependencies, tx, context, id));
    },
  };
}
