import { z } from 'zod';

import { FINGERPRINT_PATTERN } from '../../../lib/estimate/subtree-fingerprint';

/**
 * The contract of the parts-tree routes (STORY-05.02, architecture section 6 "Tree", "Node", "Reorder"). Every body, query, path parameter and answer is a strict object:
 * a key that is not named is an error, so nothing is sent that is not meant to be and a client cannot set a field the route does not offer.
 *
 * The routes are open to every role, an Engineer included (their own estimate, while they may change it), so there is **one response schema for every caller, with no
 * rate, cost, formula or figure in it** (NFR-002, ADR-008): a part is its ID, its parent, its Sl. No, its label, how complete it is and its revision. The Sl. No is
 * derived from the tree and is never stored. A part's `inputs` is an empty object until the part form (STORY-05.03) names the fields a person may type; it is strict,
 * so a value that nothing declared cannot leave through this route.
 *
 * Path parameters, bodies and queries only bound the size of what is sent. Whether the estimate or the part exists and is the caller's is the service's to say, and
 * an ID that is not one of them is a 404, never a 400 that would tell a real ID from an invented one.
 */

const MAX_ID_LENGTH = 100;
/** The largest number a PostgreSQL integer column holds: a revision, a count or a place above it cannot be real. */
const MAX_INTEGER = 2_147_483_647;

/** The path parameters of `/api/v1/estimates/{id}/nodes/{nodeId}`. */
export const nodeParamsSchema = z.strictObject({ id: z.string().max(MAX_ID_LENGTH), nodeId: z.string().max(MAX_ID_LENGTH) });

export const revisionSchema = z.number().int().min(1).max(MAX_INTEGER);
/** The place a part is to end up in among its new siblings: 0 is first. A place past the end puts it last. */
const indexSchema = z.number().int().min(0).max(MAX_INTEGER);
const parentIdSchema = z.string().max(MAX_ID_LENGTH).nullable();

/** `POST /api/v1/estimates/{id}/nodes`: a new item at the top, a sub-part under a part, or a part beside a part. */
export const addNodeBodySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('item') }),
  z.strictObject({ kind: z.literal('sub-part'), nodeId: z.string().max(MAX_ID_LENGTH) }),
  z.strictObject({ kind: z.literal('beside'), nodeId: z.string().max(MAX_ID_LENGTH) }),
]);

/** `PUT /api/v1/estimates/{id}/nodes/{nodeId}`: move this part, as it was when the person looked (`revision`). */
export const moveNodeBodySchema = z.strictObject({ revision: revisionSchema, parentId: parentIdSchema, index: indexSchema });

/** `POST /api/v1/estimates/{id}/tree/move`: the same move, with the part named in the body. */
export const moveTreeBodySchema = z.strictObject({ nodeId: z.string().max(MAX_ID_LENGTH), revision: revisionSchema, parentId: parentIdSchema, index: indexSchema });

const digits = (max: number) => z.string().regex(/^\d{1,10}$/, 'Send a whole number.').transform(Number).pipe(z.number().int().min(1).max(max));

/**
 * `DELETE /api/v1/estimates/{id}/nodes/{nodeId}?revision=&parts=&subtree=`: the part as it was when the person looked, how many parts they were told would go (the part
 * and every sub-part), and the fingerprint of those parts with their revisions (`subtreeFingerprint`), so a part moved in, replaced or typed into since is not deleted
 * unseen. A DELETE carries no body, so all three travel in the query.
 */
export const deleteNodeQuerySchema = z.strictObject({
  revision: digits(MAX_INTEGER),
  parts: digits(MAX_INTEGER),
  subtree: z.string().regex(FINGERPRINT_PATTERN, 'Send the fingerprint of the parts.'),
});

const completenessSchema = z.enum(['EMPTY', 'PARTIAL', 'COMPLETE']);

const partShape = {
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  slNo: z.string().min(1),
  label: z.string(),
  completeness: completenessSchema,
  revision: z.number().int(),
};

/** One part of the tree: no figure of any kind. */
export const treePartSchema = z.strictObject(partShape);

/** `GET /tree`, the move routes and the delete route: the tree in reading order. */
export const partsTreeSchema = z.strictObject({ nodes: z.array(treePartSchema) });

/** `POST /nodes`: the part added, and the tree as it is now. */
export const addedNodeSchema = z.strictObject({ nodeId: z.string().min(1), nodes: z.array(treePartSchema) });

/**
 * What was typed into a part, as a list of **field ID and text** entries (STORY-05.03; SQR-09): a number as decimal text with two decimals, a text as typed, and Material in
 * Drawing (E) as the ID of its Material Master row. It is a list and not an object keyed by field ID because the security tests hold every object of an answer to named,
 * strict keys. The service sends only the values of fields of the form, so no rate, cost or formula can be in it; this schema bounds the shape: an ID that is not a UUID, a
 * value that is not text or one longer than `MAX_INPUT_VALUE_LENGTH`, or a key beside the two, fails closed (a generic 500) and does not leave.
 */
export const MAX_INPUT_VALUE_LENGTH = 1_000;
/** The most entries one part can have: a bound and not a rule (the form has fewer than this many fields). */
export const MAX_INPUT_ENTRIES = 200;
export const partInputsSchema = z.array(z.strictObject({ fieldId: z.uuid(), value: z.string().max(MAX_INPUT_VALUE_LENGTH) })).max(MAX_INPUT_ENTRIES);

/** `GET /nodes/{nodeId}`: one part with what was typed into it, by field ID. */
export const nodeDetailSchema = z.strictObject({ ...partShape, inputs: partInputsSchema });
