import { buildFormSections } from '../../lib/estimate/form-fields';
import { partNameOf } from '../../lib/estimate/part-name';
import { changedFields, MAX_ENTRY_VALUE_LENGTH } from '../../lib/estimate/input-change';
import { buildTree } from '../../lib/estimate/tree';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import type { EstimateRepository } from '../repositories/estimate-repository';
import type { MasterRepository } from '../repositories/master-repository';
import type { Transaction } from '../repositories/transaction';

import type { AnyAuditEntryInput, AuditContext, AuditService } from './audit-service';
import { DELETED_ROWS_LISTED } from './audit-events';
import type { EstimateViewer } from './estimate-service';

/**
 * The trail of a Lead's or an Admin's writes to an estimate's inputs, picture and tree (DEF-131 stage 2; FR-116; architecture note lead-admin-input-edit-2026-11-27, sections 3.4, 3.8 and 3.9). **Nothing may let a
 * Lead or an Admin change inputs or the tree without a trace**, so each write asks for a trace first (`traceFor`) and writes its entry in its own transaction, after the write and before the commit: if the entry
 * cannot be written the write is rolled back with it. An Engineer's own writes are **not** audited (they are the author, and Calculate records what it used), so for an Engineer `traceFor` gives `null` and nothing
 * here runs. A service built without `audit`, or a caller that gave no context, **refuses** a Lead's or an Admin's write (an error, before anything is read or written) rather than write it silently.
 *
 * What an entry holds is words and numbers of the tree: Sl. No, the row's name as it is typed (`partNameOf`), its stored kind and, for an input, the letter, label and display text of each changed field
 * (`changedFields`). It never holds a calculated value, a rate, a formula, the input **values** of a deleted row, the bytes or the file name of a picture, or any ID (NFR-002, NFR-007). The object of every
 * entry is the estimate, labelled with its task code.
 */

export interface InputChangeAuditDependencies {
  readonly audit: AuditService | undefined;
  /** Reads the task code the entry is labelled with, in the write's transaction (the row is already locked). */
  readonly estimates: Pick<EstimateRepository, 'lockEstimate'>;
  readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
  /** The names of the materials, to show a part's material by its name; no number is read (`listMaterialOptions` does not even read the columns). */
  readonly materials: Pick<MasterRepository, 'listMaterialOptions' | 'findNotApplicableMaterialOption'>;
}

/** The entries a write builds (none when nothing changed); the owner of the write's transaction records them, so the trail is checked where the transaction is (`audit-transaction-architecture.test.ts`). */
export type Entries = Promise<ReadonlyArray<AnyAuditEntryInput>>;

/** What the picture of a part did. */
export type PictureChange = 'added' | 'replaced' | 'removed';

const PICTURE_WORDS: Readonly<Record<PictureChange, string>> = { added: 'Picture added', replaced: 'Picture replaced', removed: 'Picture removed' };

export interface Trace {
  /** The audit service the owner of the write records the entries with, in its own transaction (`recordMany`). */
  readonly audit: AuditService;
  /** A save of inputs changed these fields of a part (`before` the stored part, `after` as saved). Writes nothing when no field of the form differs. */
  inputsChanged(tx: Transaction, change: { readonly estimateId: string; readonly document: ConfigDocument; readonly before: NodeRecord; readonly after: NodeRecord; readonly materialNames: ReadonlyMap<string, string> }): Entries;
  /** The Part Model picture of a part was added, replaced or removed. */
  pictureChanged(tx: Transaction, change: { readonly estimateId: string; readonly document: ConfigDocument; readonly part: NodeRecord; readonly did: PictureChange }): Entries;
  /** A row was added: it is in the tree as `after` lists it. */
  partAdded(tx: Transaction, change: { readonly estimateId: string; readonly document: ConfigDocument; readonly nodeId: string; readonly after: ReadonlyArray<NodeRecord> }): Entries;
  /** A row was moved among its siblings: it is where `before` and `after` list it. */
  partMoved(tx: Transaction, change: { readonly estimateId: string; readonly document: ConfigDocument; readonly nodeId: string; readonly before: ReadonlyArray<NodeRecord>; readonly after: ReadonlyArray<NodeRecord> }): Entries;
  /** A row and the rows under it (`doomed`, the root first) were deleted from the tree as `before` lists it. */
  partDeleted(tx: Transaction, change: { readonly estimateId: string; readonly document: ConfigDocument; readonly nodeId: string; readonly before: ReadonlyArray<NodeRecord>; readonly doomed: ReadonlyArray<string> }): Entries;
}

export interface InputChangeAudit {
  /** `null` for an Engineer (not audited); for a Lead or an Admin the trace of their write. Throws, before anything is read or written, when there is nothing to write the trail with. */
  traceFor(viewer: EstimateViewer, context: AuditContext | undefined): Trace | null;
  /** The names of the materials by ID (lower case), for a save that touches the material field. */
  materialNames(): Promise<ReadonlyMap<string, string>>;
}

/** The numbers (Sl. No) of the rows of a listing, by ID, and the rows in reading order. */
function numbered(records: ReadonlyArray<NodeRecord>): { readonly slNoOf: ReadonlyMap<string, string>; readonly byId: ReadonlyMap<string, NodeRecord> } {
  const slNoOf = new Map<string, string>();
  for (const entry of buildTree(records)) slNoOf.set(entry.node.id, entry.slNo);
  return { slNoOf, byId: new Map(records.map((record) => [record.id, record])) };
}

const cut = (name: string): string => name.slice(0, 200);

export function createInputChangeAudit({ audit, estimates, nodes, materials }: InputChangeAuditDependencies): InputChangeAudit {
  async function codeOf(estimateId: string, tx: Transaction): Promise<string> {
    const estimate = await estimates.lockEstimate(estimateId, tx);
    return estimate?.taskCode ?? '';
  }

  function build(auditService: AuditService, context: AuditContext, actorRole: 'LEAD' | 'ADMIN'): Trace {
    const object = async (estimateId: string, tx: Transaction) => ({ id: estimateId, label: await codeOf(estimateId, tx) });
    return {
      audit: auditService,
      async inputsChanged(tx, { estimateId, document, before, after, materialNames }) {
        const fields = changedFields(document, before.inputs, after.inputs, materialNames);
        if (fields.after.length === 0) return [];
        const { slNoOf } = numbered(await nodes.listNodes(estimateId, tx));
        const slNo = slNoOf.get(after.id) ?? '';
        return [{
          event: 'estimate.inputs_changed',
          ...context,
          object: await object(estimateId, tx),
          before: { part: { slNo, name: cut(partNameOf(document, before.inputs)) }, fields: [...fields.before] },
          after: { actorRole, part: { slNo, name: cut(partNameOf(document, after.inputs)) }, fields: [...fields.after] },
        }];
      },

      async pictureChanged(tx, { estimateId, document, part, did }) {
        const field = changedPictureField(document);
        const { slNoOf } = numbered(await nodes.listNodes(estimateId, tx));
        const part3 = { slNo: slNoOf.get(part.id) ?? '', name: cut(partNameOf(document, part.inputs)) };
        return [{
          event: 'estimate.inputs_changed',
          ...context,
          object: await object(estimateId, tx),
          before: { part: part3, fields: [{ ...field, value: did === 'added' ? null : 'Picture' }] },
          after: { actorRole, part: part3, fields: [{ ...field, value: PICTURE_WORDS[did] }] },
        }];
      },

      async partAdded(tx, { estimateId, document, nodeId, after }) {
        const { slNoOf, byId } = numbered(after);
        const added = byId.get(nodeId);
        if (added === undefined) return [];
        const parent = added.parentId === null ? undefined : byId.get(added.parentId);
        return [{
          event: 'estimate.part_added',
          ...context,
          object: await object(estimateId, tx),
          before: {},
          after: {
            actorRole,
            part: { slNo: slNoOf.get(nodeId) ?? '', kind: added.nodeKind },
            parent: parent === undefined ? null : { slNo: slNoOf.get(parent.id) ?? '', name: cut(partNameOf(document, parent.inputs)) },
          },
        }];
      },

      async partMoved(tx, { estimateId, document, nodeId, before, after }) {
        const was = numbered(before);
        const now = numbered(after);
        const row = now.byId.get(nodeId);
        if (row === undefined) return [];
        const name = cut(partNameOf(document, row.inputs));
        return [{
          event: 'estimate.part_moved',
          ...context,
          object: await object(estimateId, tx),
          before: { part: { slNo: was.slNoOf.get(nodeId) ?? '', name, kind: row.nodeKind } },
          after: { actorRole, part: { slNo: now.slNoOf.get(nodeId) ?? '', name, kind: row.nodeKind } },
        }];
      },

      async partDeleted(tx, { estimateId, document, nodeId, before, doomed }) {
        const { slNoOf, byId } = numbered(before);
        const root = byId.get(nodeId);
        if (root === undefined) return [];
        const gone = new Set(doomed);
        // The rows in reading order, the root first; no input value is copied, so the entry stays small and holds nothing a person typed beyond the row's name.
        const rows = buildTree(before)
          .filter((entry) => gone.has(entry.node.id))
          .map((entry) => ({ slNo: entry.slNo, name: cut(partNameOf(document, entry.node.inputs)), kind: entry.node.nodeKind }));
        const part = { slNo: slNoOf.get(nodeId) ?? '', name: cut(partNameOf(document, root.inputs)), kind: root.nodeKind };
        const list = rows.slice(0, DELETED_ROWS_LISTED);
        // Two shapes and no optional key (an optional key is not JSON): `truncated: true` is there only when the list was cut.
        const listed = rows.length > DELETED_ROWS_LISTED ? { part, rows: rows.length, list, truncated: true as const } : { part, rows: rows.length, list };
        return [{ event: 'estimate.part_deleted', ...context, object: await object(estimateId, tx), before: listed, after: { actorRole } }];
      },
    };
  }

  return {
    traceFor(viewer, context) {
      if (viewer.role === 'ENGINEER') return null;
      if (audit === undefined || context === undefined) throw new Error('A write by a Lead or an Admin needs the audit trail, and this service was built without it.');
      return build(audit, context, viewer.role);
    },

    async materialNames() {
      const [listed, notApplicable] = await Promise.all([materials.listMaterialOptions(), materials.findNotApplicableMaterialOption()]);
      const names = new Map<string, string>();
      for (const option of notApplicable === null ? listed : [...listed, notApplicable]) names.set(option.id.toLowerCase(), option.name.slice(0, MAX_ENTRY_VALUE_LENGTH));
      return names;
    },
  };
}

/** The Part Model field of the form: its letter and its label, as an entry shows it. */
function changedPictureField(document: ConfigDocument): { readonly letter: string; readonly label: string } {
  const field = buildFormSections(document).flatMap((section) => section.fields).find((candidate) => candidate.rule.type === 'picture');
  return field === undefined ? { letter: 'C', label: 'Part Model' } : { letter: field.letter, label: field.label };
}
