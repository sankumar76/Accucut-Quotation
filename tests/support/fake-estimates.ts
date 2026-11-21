import { randomUUID } from 'node:crypto';

import type { ImageMime } from '../../src/lib/images/signature';
import type { EstimateNodeRepository, NodePlacement, NodeRecord } from '../../src/server/repositories/estimate-node-repository';
import type { CustomerChoice, EstimateLock, EstimateRepository, WorkspaceRecord } from '../../src/server/repositories/estimate-repository';
import type { ImageRepository } from '../../src/server/repositories/image-repository';
import type { EstimateStatus } from '../../src/server/repositories/task-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory estimate repository and transaction runner, for unit tests of the rules (no database): the estimates are a list the test owns, the customers
 * come from a list it also owns (so a deleted one is simply marked), a transaction that throws puts the estimates back as they were, as PostgreSQL does, and
 * transactions run one after another, as the estimate's row lock makes them (STORY-06.01 AC-4: the second waits and then sees what the first did).
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
  /** The calculation the estimate is linked to (STORY-03.05). Absent counts as none. */
  currentCalculationId?: string | null;
  /** The configuration version that calculation was made with (STORY-08.05); absent counts as none. */
  configVersionId?: string | null;
}

/** A part of an estimate's tree as the fake holds it: what the real table keeps, by estimate. */
export interface FakeNode {
  id: string;
  estimateId: string;
  parentId: string | null;
  sortIndex: number;
  revision: number;
  inputs: Record<string, unknown>;
  /** The part's picture (STORY-05.07); absent counts as none. */
  imageId?: string | null;
}

/** A stored picture as the fake holds it: what the real table keeps, by estimate. */
export interface FakeImage {
  readonly id: string;
  readonly estimateId: string;
  readonly sha256: string;
  readonly mime: ImageMime;
  readonly fileName: string;
  readonly bytes: Uint8Array;
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
  /** The picture methods over the same world (STORY-05.07): added in a transaction that rolls back with the estimate, never changed or deleted. */
  readonly imageRepository: ImageRepository;
  /** The stored pictures of every estimate. */
  readonly images: FakeImage[];
  /** How many pictures were stored (a picture found again is not a write), so "stored nothing" is something a test can see. */
  imageWrites(): number;
  /** The parts of every estimate, which a test may change in place. */
  readonly nodes: FakeNode[];
  /** How many times a part was added, placed or deleted, so "no write" is something a test can see. */
  nodeWrites(): number;
  readonly transactions: TransactionRunner;
  /** The estimates, which a test may change in place (a status, a customer). */
  readonly estimates: FakeEstimate[];
  /** How many times `setCustomer` wrote, so "no write" is something a test can see. */
  writes(): number;
  /** How many times `setStatus` changed a status. */
  statusWrites(): number;
  /** The materials the parts name, with whether each was deleted (STORY-06.08 `lockMaterialsInUse`); a test fills it in. Empty: no part names a material. */
  readonly materialsInUse: Array<{ id: string; deleted: boolean }>;
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const recordOf = (node: FakeNode): NodeRecord => ({
  id: node.id,
  parentId: node.parentId,
  sortIndex: node.sortIndex,
  revision: node.revision,
  inputs: { ...node.inputs },
  imageId: node.imageId ?? null,
});

export function createFakeEstimateWorld(
  customers: () => ReadonlyArray<FakeCustomerEntry>,
  initial: ReadonlyArray<FakeEstimate> = [],
  initialNodes: ReadonlyArray<FakeNode> = [],
  initialImages: ReadonlyArray<FakeImage> = [],
): FakeEstimateWorld {
  const estimates: FakeEstimate[] = initial.map((estimate) => ({ ...estimate }));
  const nodes: FakeNode[] = initialNodes.map((node) => ({ ...node, inputs: { ...node.inputs } }));
  const images: FakeImage[] = [...initialImages];
  const materialsInUse: Array<{ id: string; deleted: boolean }> = [];
  let imageWrites = 0;
  let writes = 0;
  let nodeWrites = 0;
  let statusWrites = 0;
  /** When a part was last written, as the real table's `updated_at` shows it; the creation of the world counts as a write. */
  let lastWritten = new Date();
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
    findConfigurationBasis: (id) => {
      const estimate = estimates.find((candidate) => same(candidate.id, id));
      return Promise.resolve(estimate === undefined ? null : { status: estimate.status, configVersionId: estimate.currentCalculationId == null ? null : (estimate.configVersionId ?? null) });
    },
    lockEstimate: (id) => {
      const estimate = estimates.find((candidate) => same(candidate.id, id));
      const lock: EstimateLock | null = estimate === undefined ? null : { id: estimate.id, engineerId: estimate.engineerId, status: estimate.status, customerId: estimate.customerId, inputsRevision: estimate.inputsRevision, taskCode: estimate.code };
      return Promise.resolve(lock);
    },
    findActiveCustomer: (id) => {
      const found = customers().find((customer) => same(customer.id, id) && !customer.deleted);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    lockMaterialsInUse: () => Promise.resolve([...materialsInUse].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))),
    linkCalculation: (estimateId, calculationId, status) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined) return Promise.reject(new Error('The estimate to link does not exist.'));
      estimate.currentCalculationId = calculationId;
      estimate.status = status;
      return Promise.resolve();
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
    setStatus: (estimateId, from, to) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined || estimate.status !== from) return Promise.resolve(false);
      estimate.status = to;
      statusWrites += 1;
      return Promise.resolve(true);
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
    findNode: (estimateId, nodeId) => {
      const node = nodes.find((candidate) => same(candidate.id, nodeId) && same(candidate.estimateId, estimateId));
      return Promise.resolve(node === undefined ? null : recordOf(node));
    },
    saveInputs: (estimateId, nodeId, expectedRevision, inputs) => {
      const node = nodes.find((candidate) => same(candidate.id, nodeId) && same(candidate.estimateId, estimateId));
      if (node === undefined) return Promise.reject(new Error('A part to change is not in this estimate.'));
      if (node.revision !== expectedRevision) return Promise.resolve(null);
      node.inputs = { ...inputs };
      node.revision += 1;
      nodeWrites += 1;
      lastWritten = new Date();
      return Promise.resolve(recordOf(node));
    },
    setImage: (estimateId, nodeId, expectedRevision, imageId) => {
      const node = nodes.find((candidate) => same(candidate.id, nodeId) && same(candidate.estimateId, estimateId));
      if (node === undefined) return Promise.reject(new Error('A part to change is not in this estimate.'));
      // The database refuses a picture of another estimate (a trigger), and so does the fake.
      if (imageId !== null && !images.some((image) => same(image.id, imageId) && same(image.estimateId, estimateId))) return Promise.reject(new Error('The picture of a part must belong to the same estimate.'));
      if (node.revision !== expectedRevision) return Promise.resolve(null);
      node.imageId = imageId;
      node.revision += 1;
      nodeWrites += 1;
      lastWritten = new Date();
      return Promise.resolve(recordOf(node));
    },
    lastWrittenAt: (estimateId) => Promise.resolve(nodes.some((node) => same(node.estimateId, estimateId)) ? lastWritten : null),
  };

  const pictureOf = (image: FakeImage): { id: string; fileName: string; sizeBytes: number } => ({ id: image.id, fileName: image.fileName, sizeBytes: image.bytes.byteLength });
  const imageRepository: ImageRepository = {
    storeImage: (estimateId, image) => {
      const found = images.find((candidate) => same(candidate.estimateId, estimateId) && candidate.sha256 === image.sha256);
      if (found !== undefined) return Promise.resolve(pictureOf(found));
      const stored: FakeImage = { id: randomUUID(), estimateId, sha256: image.sha256, mime: image.mime, fileName: image.fileName, bytes: new Uint8Array(image.bytes) };
      images.push(stored);
      imageWrites += 1;
      return Promise.resolve(pictureOf(stored));
    },
    findPicture: (estimateId, imageId) => {
      const found = images.find((candidate) => same(candidate.id, imageId) && same(candidate.estimateId, estimateId));
      return Promise.resolve(found === undefined ? null : pictureOf(found));
    },
    findOwner: (imageId) => {
      const image = images.find((candidate) => same(candidate.id, imageId));
      const estimate = image === undefined ? undefined : estimates.find((candidate) => same(candidate.id, image.estimateId));
      return Promise.resolve(image === undefined || estimate === undefined ? null : { estimateId: image.estimateId, engineerId: estimate.engineerId });
    },
    readImage: (imageId) => {
      const found = images.find((candidate) => same(candidate.id, imageId));
      return Promise.resolve(found === undefined ? null : { mime: found.mime, bytes: found.bytes });
    },
    findMimes: (estimateId, imageIds) =>
      Promise.resolve(images.filter((candidate) => same(candidate.estimateId, estimateId) && imageIds.some((id) => same(id, candidate.id))).map((found) => ({ id: found.id, mime: found.mime }))),
    readMany: (estimateId, imageIds) =>
      Promise.resolve(
        images
          .filter((candidate) => same(candidate.estimateId, estimateId) && imageIds.some((id) => same(id, candidate.id)))
          .map((found) => ({ id: found.id, mime: found.mime, bytes: new Uint8Array(found.bytes) })),
      ),
  };

  // The row lock: one transaction at a time, in the order they were opened. A failed one releases it, as a rollback does.
  let lock: Promise<unknown> = Promise.resolve();
  const transactions: TransactionRunner = {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const turn = lock.then(async () => {
        const before = estimates.map((estimate) => ({ ...estimate }));
        const nodesBefore = nodes.map((node) => ({ ...node, inputs: { ...node.inputs } }));
        const imagesBefore = [...images];
        try {
          return await work(createTransactionHandle());
        } catch (error) {
          estimates.splice(0, estimates.length, ...before);
          nodes.splice(0, nodes.length, ...nodesBefore);
          images.splice(0, images.length, ...imagesBefore);
          throw error;
        }
      });
      lock = turn.catch(() => undefined);
      return turn;
    },
  };

  return {
    repository,
    nodeRepository,
    imageRepository,
    images,
    imageWrites: () => imageWrites,
    transactions,
    estimates,
    nodes,
    writes: () => writes,
    nodeWrites: () => nodeWrites,
    statusWrites: () => statusWrites,
    materialsInUse,
  };
}
