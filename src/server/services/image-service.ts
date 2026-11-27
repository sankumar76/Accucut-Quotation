import { createHash } from 'node:crypto';

import { ConflictError, NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../../lib/errors';
import { createCompletenessReader, type CompletenessReader } from '../../lib/estimate/part-completeness';
import type { Completeness } from '../../lib/estimate/part-view';
import type { ConfigDocument } from '../../lib/fields/schema';
import { checkPicture, PICTURE_TOO_LARGE_CODE, sanitiseFileName } from '../../lib/images/picture-rules';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import type { ImageRepository, PictureRecord, StoredImage } from '../repositories/image-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext } from './audit-service';
import type { EstimateViewer } from './estimate-service';
import type { InputChangeAudit } from './input-change-audit';
import { PART_CHANGED_CODE, PART_CHANGED_MESSAGE } from './estimate-inputs';

/**
 * The picture half of the estimate service (STORY-05.07; FR-047, FR-064, FR-067; NFR-005; ADR-013; architecture sections 4.8, 6 "Image" and 8). It is built by the estimate service and
 * handed the estimate's lock and its rules for who may open or change an estimate, so those are written once, exactly as the part form's are (`estimate-inputs.ts`).
 *
 * **A picture is added, replaced or removed in one transaction, in the order of every write to an estimate:** the estimate is locked (404 when it is not this person's or does not
 * exist), this person must still be allowed to change its inputs (409, `assertEditable`: a draft for an Engineer, a draft or a prepared estimate for a Lead or an Admin, never an
 * approved one), the part must be in it (404), and only then is the file judged by its **content** (`lib/images`: 413 at 200 x 1024 bytes or more, 415 for anything that is not a PNG,
 * JPEG or GIF (a WebP too: the browser converts it before it is sent, DL-237), whatever its name or declared type). A picture that passes is stored once for the estimate (`sha256`, immutable, a replacement is a new row), the part is pointed at
 * it, the part's `revision` goes up, and so does the estimate's `inputs_revision` (section 4.8: a picture added, replaced or removed is an input change), all in the same transaction, so
 * a Calculate in progress is serialised against it and a figure is cleared with the change or not at all. The same picture again, and removing a picture that is not there, change
 * nothing and raise nothing.
 *
 * **A picture is read** by its ID (`GET /api/v1/images/{id}`): only for a person who may open its estimate, the owning Engineer, a Lead or an Admin; a picture that is not theirs
 * and one that does not exist are the same 404. The bytes are read only after that decision, and are never decoded here.
 */

/** The part after a picture change: its revision (so the form keeps saving with the right one), how complete it is, and the picture it has now (or none). No figure. */
export interface PartPicture {
  readonly id: string;
  readonly revision: number;
  readonly completeness: Completeness;
  readonly picture: PictureRecord | null;
}

/** One file as it was sent: the name as the browser gave it (sanitised here, never trusted) and its bytes. */
export interface PictureUpload {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface ImageService {
  /** Adds or replaces the part's picture (`PUT .../nodes/{nodeId}/image`). 404, 409, 413 and 415 in the order above. */
  putPicture(viewer: EstimateViewer, estimateId: string, nodeId: string, upload: PictureUpload, audit?: AuditContext): Promise<PartPicture>;
  /** Removes the part's picture (`DELETE .../nodes/{nodeId}/image`). 404 and 409; a part with none is answered as it is. */
  removePicture(viewer: EstimateViewer, estimateId: string, nodeId: string, audit?: AuditContext): Promise<PartPicture>;
  /** The stored type and bytes of a picture (`GET /api/v1/images/{id}`), or a 404 for one that is not this person's or does not exist. */
  getPicture(viewer: EstimateViewer, imageId: string): Promise<StoredImage>;
  /** The picture a part points at, for a read of the part: null when it has none. Takes no lock. */
  pictureOf(estimateId: string, imageId: string | null): Promise<PictureRecord | null>;
}

export interface ImageServiceDependencies {
  readonly nodes: EstimateNodeRepository;
  readonly images: ImageRepository;
  readonly transactions: TransactionRunner;
  /** The field registry the completeness of a part is read against (the current version, cached per version): the same rule as the tree's and the form's save (STORY-05.11). */
  readonly currentConfiguration: () => Promise<ConfigDocument>;
  /** Locks the estimate for a change: 404, or 409 when this person may no longer change its inputs. Returns the estimate's ID. */
  readonly lockForChange: (viewer: EstimateViewer, estimateId: string, tx: Transaction) => Promise<string>;
  /** Raises the estimate's `inputs_revision` by one, in the caller's transaction. */
  readonly bumpInputsRevision: (estimateId: string, tx: Transaction) => Promise<void>;
  /** Whether this person may open an estimate whose task belongs to this Engineer (an Admin and a Lead any, an Engineer their own). */
  readonly mayOpen: (viewer: EstimateViewer, engineerId: string) => boolean;
  /** The trail of a Lead's or an Admin's picture change (DEF-131 stage 2): none for an Engineer's, and a refusal for a Lead's or an Admin's when the service has no audit. */
  readonly traces: InputChangeAudit;
}

/** The hash a picture is told apart by: the SHA-256 of its bytes, as lower-case hex. */
export const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The refusal of a file that fails the rules: 413 or 415, in the words of SCR-05 (the file name in them is already sanitised). */
function refusal(check: { readonly status: 413 | 415; readonly code: string; readonly message: string }): PayloadTooLargeError | UnsupportedMediaTypeError {
  return check.status === 413 ? new PayloadTooLargeError(check.message, { code: PICTURE_TOO_LARGE_CODE }) : new UnsupportedMediaTypeError(check.message, { code: check.code });
}

export function createImageService({ nodes, images, transactions, currentConfiguration, lockForChange, bumpInputsRevision, mayOpen, traces }: ImageServiceDependencies): ImageService {
  const unchanged = (part: NodeRecord, picture: PictureRecord | null, completenessOf: CompletenessReader): PartPicture => ({ id: part.id, revision: part.revision, completeness: completenessOf(part.inputs), picture });

  /** The rule for the registry as it is now, read before the transaction opens (a version never changes), so it holds no connection and no lock while it is read. */
  const completenessReader = async (): Promise<CompletenessReader> => createCompletenessReader(await currentConfiguration());

  /** Points the part at `picture` (or none) as it was read, raises both revisions in this transaction, and answers the part as it is now. */
  async function point(estimateId: string, part: NodeRecord, picture: PictureRecord | null, completenessOf: CompletenessReader, tx: Transaction): Promise<PartPicture> {
    // The write is conditional on the revision that was read, so a writer that skipped the estimate's lock is a 409 here and not a lost update (as the form's save).
    const saved = await nodes.setImage(estimateId, part.id, part.revision, picture?.id ?? null, tx);
    if (saved === null) throw new ConflictError(PART_CHANGED_MESSAGE, { code: PART_CHANGED_CODE });
    await bumpInputsRevision(estimateId, tx);
    return unchanged(saved, picture, completenessOf);
  }

  /** The part in the estimate, locked for a change: 404 for one that is not there. */
  async function lockedPart(viewer: EstimateViewer, estimateId: string, nodeId: string, tx: Transaction): Promise<{ readonly id: string; readonly part: NodeRecord }> {
    const id = await lockForChange(viewer, estimateId, tx);
    const part = await nodes.findNode(id, nodeId, tx);
    if (part === null) throw new NotFoundError();
    return { id, part };
  }

  const pictureOf = (estimateId: string, imageId: string | null, tx?: Transaction): Promise<PictureRecord | null> =>
    imageId === null ? Promise.resolve(null) : images.findPicture(estimateId, imageId, tx);

  return {
    async putPicture(viewer, estimateId, nodeId, upload, audit) {
      // A Lead's or an Admin's change is traced (DEF-131): asked first, so a service with no audit refuses it before anything is read or written.
      const trace = traces.traceFor(viewer, audit);
      const completenessOf = await completenessReader();
      const document = await currentConfiguration();
      return transactions.run(async (tx) => {
        const { id, part } = await lockedPart(viewer, estimateId, nodeId, tx);
        // The name is display text and is made safe before anything else reads it, the refusals' words included.
        const fileName = sanitiseFileName(upload.name);
        const check = checkPicture(fileName, upload.bytes);
        if (!check.ok) throw refusal(check);
        const stored = await images.storeImage(id, { sha256: sha256Of(upload.bytes), mime: check.mime, fileName, bytes: upload.bytes }, tx);
        // The same picture again (the same bytes for the same part) is no change: no write and no new revision, so a repeated request cannot clear a total (section 4.8).
        if (part.imageId === stored.id) return unchanged(part, stored, completenessOf);
        const pointed = await point(id, part, stored, completenessOf, tx);
        if (trace !== null) await trace.audit.recordMany(tx, await trace.pictureChanged(tx, { estimateId: id, document, part, did: part.imageId === null ? 'added' : 'replaced' }));
        return pointed;
      });
    },

    async removePicture(viewer, estimateId, nodeId, audit) {
      const trace = traces.traceFor(viewer, audit);
      const completenessOf = await completenessReader();
      const document = await currentConfiguration();
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const part = await nodes.findNode(id, nodeId, tx);
        if (part === null) throw new NotFoundError();
        if (part.imageId === null) return unchanged(part, null, completenessOf);
        const pointed = await point(id, part, null, completenessOf, tx);
        if (trace !== null) await trace.audit.recordMany(tx, await trace.pictureChanged(tx, { estimateId: id, document, part, did: 'removed' }));
        return pointed;
      });
    },

    async getPicture(viewer, imageId) {
      const owner = await images.findOwner(imageId);
      // A picture that is not this person's and one that does not exist are the same answer, so the answer never says that an ID is real (CR-33).
      if (owner === null || !mayOpen(viewer, owner.engineerId)) throw new NotFoundError();
      const stored = await images.readImage(imageId);
      if (stored === null) throw new NotFoundError();
      return stored;
    },

    pictureOf: (estimateId, imageId) => pictureOf(estimateId, imageId),
  };
}
