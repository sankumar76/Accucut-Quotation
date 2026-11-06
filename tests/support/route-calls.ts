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
    default:
      return DEFAULT_CALL;
  }
}
