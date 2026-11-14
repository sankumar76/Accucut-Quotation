import { z } from 'zod';

/**
 * The contract of the parts-tree routes (STORY-05.02, architecture section 6 "Tree", "Node", "Reorder"). Every body, query, path parameter and answer is a strict object:
 * a key that is not named is an error, so nothing is sent that is not meant to be and a client cannot set a field the route does not offer.
 *
 * The routes are open to every role, an Engineer included (their own estimate, while it is a draft), so there is **one response schema for every caller, with no
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

const revisionSchema = z.number().int().min(1).max(MAX_INTEGER);
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
 * `DELETE /api/v1/estimates/{id}/nodes/{nodeId}?revision=&parts=`: the part as it was when the person looked, and how many parts they were told would go (the part
 * and every sub-part). A DELETE carries no body, so both travel in the query.
 */
export const deleteNodeQuerySchema = z.strictObject({ revision: digits(MAX_INTEGER), parts: digits(MAX_INTEGER) });

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

/** `GET /nodes/{nodeId}`: one part with what was typed into it. Strict and empty until STORY-05.03 names the fields. */
export const nodeDetailSchema = z.strictObject({ ...partShape, inputs: z.strictObject({}) });
