import { randomUUID } from 'node:crypto';

import type { EstimateNodeRepository, NodePlacement, NodeRecord } from '../../src/server/repositories/estimate-node-repository';
import type { CustomerChoice, EstimateLock, EstimateRepository, WorkspaceRecord } from '../../src/server/repositories/estimate-repository';
import type { EstimateStatus } from '../../src/server/repositories/task-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory estimate repository and transaction runner, for unit tests of the rules (no database): the estimates are a list the test owns, the customers
 * come from a list it also owns (so a deleted one is simply marked), and a transaction that throws puts the estimates back as they were, as PostgreSQL does.
 * The real queries and the row lock are tested against PostgreSQL in `tests/integration/estimates`. Every name here is invented.
 */

/** An estimate with its task, as a test sets it up and reads it back. `inputsRevision` is what the real table keeps. */
export interface FakeEstimate {
  id: string;
  code: string;
  engineerId: string;
  assignedByName: string;
  folderPath: string;
  deadlineAt: Date;
  title: string | null;
  notes: string | null;
  status: EstimateStatus;
  customerId: string | null;
  inputsRevision: number;
}

/** A part of an estimate's tree as the fake holds it: what the real table keeps, by estimate. */
export interface FakeNode {
  id: string;
  estimateId: string;
  parentId: string | null;
  sortIndex: number;
  revision: number;
  inputs: Record<string, unknown>;
}

export interface FakeCustomerEntry {
  readonly id: string;
  readonly name: string;
  readonly deleted: boolean;
}

export interface FakeEstimateWorld {
  readonly repository: EstimateRepository;
  /** The part methods over the same world, so one transaction rolls back an estimate and its parts together. */
  readonly nodeRepository: EstimateNodeRepository;
  /** The parts of every estimate, which a test may change in place. */
  readonly nodes: FakeNode[];
  /** How many times a part was added, placed or deleted, so "no write" is something a test can see. */
  nodeWrites(): number;
  readonly transactions: TransactionRunner;
  /** The estimates, which a test may change in place (a status, a customer). */
  readonly estimates: FakeEstimate[];
  /** How many times `setCustomer` wrote, so "no write" is something a test can see. */
  writes(): number;
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const recordOf = (node: FakeNode): NodeRecord => ({ id: node.id, parentId: node.parentId, sortIndex: node.sortIndex, revision: node.revision, inputs: { ...node.inputs } });

export function createFakeEstimateWorld(
  customers: () => ReadonlyArray<FakeCustomerEntry>,
  initial: ReadonlyArray<FakeEstimate> = [],
  initialNodes: ReadonlyArray<FakeNode> = [],
): FakeEstimateWorld {
  const estimates: FakeEstimate[] = initial.map((estimate) => ({ ...estimate }));
  const nodes: FakeNode[] = initialNodes.map((node) => ({ ...node, inputs: { ...node.inputs } }));
  let writes = 0;
  let nodeWrites = 0;
  const customerOf = (id: string | null): CustomerChoice | null => {
    const found = id === null ? undefined : customers().find((customer) => same(customer.id, id));
    return found === undefined ? null : { id: found.id, name: found.name };
  };

  const repository: EstimateRepository = {
    findWorkspaceByCode: (code) => {
      const estimate = estimates.find((candidate) => candidate.code === code);
      if (estimate === undefined) return Promise.resolve(null);
      const record: WorkspaceRecord = {
        estimateId: estimate.id,
        status: estimate.status,
        customer: customerOf(estimate.customerId),
        code: estimate.code,
        engineerId: estimate.engineerId,
        folderPath: estimate.folderPath,
        deadlineAt: estimate.deadlineAt,
        title: estimate.title,
        notes: estimate.notes,
        assignedByName: estimate.assignedByName,
      };
      return Promise.resolve(record);
    },
    findEstimateAccess: (id) => {
      const estimate = estimates.find((candidate) => same(candidate.id, id));
      return Promise.resolve(estimate === undefined ? null : { id: estimate.id, engineerId: estimate.engineerId, status: estimate.status });
    },
    lockEstimate: (id) => {
      const estimate = estimates.find((candidate) => same(candidate.id, id));
      const lock: EstimateLock | null = estimate === undefined ? null : { id: estimate.id, engineerId: estimate.engineerId, status: estimate.status, customerId: estimate.customerId };
      return Promise.resolve(lock);
    },
    findActiveCustomer: (id) => {
      const found = customers().find((customer) => same(customer.id, id) && !customer.deleted);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    setCustomer: (estimateId, customerId) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined) return Promise.reject(new Error('The estimate to change does not exist.'));
      estimate.customerId = customerId;
      estimate.inputsRevision += 1;
      writes += 1;
      return Promise.resolve();
    },
    bumpInputsRevision: (estimateId) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined) return Promise.reject(new Error('The estimate to change does not exist.'));
      estimate.inputsRevision += 1;
      return Promise.resolve();
    },
  };

  const nodeRepository: EstimateNodeRepository = {
    listNodes: (estimateId) => Promise.resolve(nodes.filter((node) => same(node.estimateId, estimateId)).map(recordOf)),
    insertNode: (estimateId, parentId, sortIndex) => {
      const node: FakeNode = { id: randomUUID(), estimateId, parentId, sortIndex, revision: 1, inputs: {} };
      nodes.push(node);
      nodeWrites += 1;
      return Promise.resolve(recordOf(node));
    },
    placeNodes: (estimateId, placements: ReadonlyArray<NodePlacement>) => {
      for (const placement of placements) {
        const node = nodes.find((candidate) => same(candidate.id, placement.id) && same(candidate.estimateId, estimateId));
        if (node === undefined) return Promise.reject(new Error('A part to place is not in this estimate.'));
        node.parentId = placement.parentId;
        node.sortIndex = placement.sortIndex;
        if (placement.bumpRevision) node.revision += 1;
      }
      if (placements.length > 0) nodeWrites += 1;
      return Promise.resolve();
    },
    deleteNodes: (estimateId, ids) => {
      const doomed = nodes.filter((node) => same(node.estimateId, estimateId) && ids.some((id) => same(id, node.id)));
      if (doomed.length !== ids.length) return Promise.reject(new Error('A part to delete is not in this estimate.'));
      nodes.splice(0, nodes.length, ...nodes.filter((node) => !doomed.includes(node)));
      nodeWrites += 1;
      return Promise.resolve();
    },
  };

  const transactions: TransactionRunner = {
    async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const before = estimates.map((estimate) => ({ ...estimate }));
      const nodesBefore = nodes.map((node) => ({ ...node, inputs: { ...node.inputs } }));
      try {
        return await work(createTransactionHandle());
      } catch (error) {
        estimates.splice(0, estimates.length, ...before);
        nodes.splice(0, nodes.length, ...nodesBefore);
        throw error;
      }
    },
  };

  return { repository, nodeRepository, transactions, estimates, nodes, writes: () => writes, nodeWrites: () => nodeWrites };
}
