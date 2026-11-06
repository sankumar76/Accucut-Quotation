import type { HttpMethod } from '../../src/server/http/route-manifest';

/**
 * What a **valid, allowed** call to each implemented API route looks like, so the role matrix can show that the role the
 * route lists gets through (a route with a body and an ID cannot answer 200 to an empty call). A story that adds a route
 * with a body or a path parameter adds its row here with its loader (`route-loaders.ts`); a route not listed is called
 * with no body and the ID `invented-id`, and is expected to answer 200.
 *
 * A refused role is sent the same valid call: the answer must not depend on the body or the ID, because the role check
 * runs before either is read (CR-33). Every name and address here is invented.
 */

export interface ValidCall {
  /** The value for the `[id]` segment of the path, when the route has one. */
  readonly id: string;
  readonly body?: unknown;
  /** The status the allowed role gets. */
  readonly status: number;
}

export interface CallContext {
  /** The ID of a person who is not the caller, for a route that changes someone. */
  readonly targetId: string;
}

/** The seed rate that no formula uses (`Plating-rate-per-sqin`, D-40), so a valid delete of it succeeds. */
const PLATING_ITEM_ID = '00000000-0000-4000-8000-000400000009';

const DEFAULT_CALL: ValidCall = { id: 'invented-id', status: 200 };

export function validCallFor(method: HttpMethod, path: string, context: CallContext): ValidCall {
  switch (`${method} ${path}`) {
    case 'GET /api/v1/users':
      return DEFAULT_CALL;
    case 'POST /api/v1/users':
      return {
        id: 'invented-id',
        body: { name: 'Invented New Person', email: 'invented.new.person@example.test', role: 'ENGINEER', password: 'invented-first-password-1' },
        status: 201,
      };
    case 'PATCH /api/v1/users/[id]':
      return { id: context.targetId, body: { name: 'Invented Renamed Engineer' }, status: 200 };
    case 'POST /api/v1/users/[id]/password-reset':
      return { id: context.targetId, body: { password: 'invented-temporary-password-1' }, status: 204 };
    // STORY-02.01: the Process Master routes. The ID is a seed rate no formula uses (so the delete can answer 204) and the body is invented.
    case 'GET /api/v1/process-items':
      return DEFAULT_CALL;
    case 'POST /api/v1/process-items':
      return { id: 'invented-id', body: { name: 'Invented-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' }, status: 201 };
    case 'PATCH /api/v1/process-items/[id]':
      return { id: PLATING_ITEM_ID, body: { defaultValue: '2.37' }, status: 200 };
    case 'DELETE /api/v1/process-items/[id]':
      return { id: PLATING_ITEM_ID, status: 204 };
    default:
      return DEFAULT_CALL;
  }
}
