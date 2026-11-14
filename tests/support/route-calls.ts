import type { HttpMethod, RouteRow } from '../../src/server/http/route-manifest';

import { CUSTOMER_DELETE_RECIPE_ID, CUSTOMER_RECIPE_ID } from './customer-canary';
import { canaryEstimatePageFor } from './estimate-recipe';
import { EXCHANGE_RATE_CANARIES } from './exchange-rate-canary';
import { HARNESS_NEXT_PASSWORD, HARNESS_PASSWORD } from './harness-password';
import { MATERIAL_DELETE_RECIPE, MATERIAL_RECIPE_ID } from './material-master-canary';
import { TREATMENT_RECIPE_ID } from './treatment-canary';

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
  /** The query string, with its `?`, of a route that takes its input there (a DELETE carries no body: `DELETE /api/v1/estimates/{id}/nodes/{nodeId}?revision=&parts=`). */
  readonly query?: string;
  /** The status the allowed role gets. */
  readonly status: number;
}

export interface CallContext {
  /** The ID of a person who is not the caller, for a route that changes someone. */
  readonly targetId: string;
}

/** The seed rate that no formula uses (`Plating-rate-per-sqin`, D-40), so a valid delete of it succeeds. */
const PLATING_ITEM_ID = '00000000-0000-4000-8000-000400000009';

/** The ID a route with no recipe gets. A route with a dynamic segment that still gets it has no real-value recipe (see `recipeProblem`). */
export const NO_RECIPE_ID = 'invented-id';

const DEFAULT_CALL: ValidCall = { id: NO_RECIPE_ID, status: 200 };

const DYNAMIC_SEGMENT = /\[[^\]]+\]/;

/**
 * Why a route's recipe cannot be trusted, or `null` when it can (STORY-01.03 AC-6, QLT-02, QLT-08). A path with a dynamic segment
 * whose valid call still carries `NO_RECIPE_ID` has no real-value recipe: the scan would open it with an ID that exists for no one and
 * see only a 404 or "no access", and a real ID and an invented one would be the same ID. The scan and the CR-33 loops fail on it, so
 * the story that adds the route adds its recipe here, in the same change (the pull-request checklist says so).
 */
export function recipeProblem(path: string, id: string): string | null {
  return DYNAMIC_SEGMENT.test(path) && id === NO_RECIPE_ID ? `add a real-value recipe for ${path} to tests/support/route-calls.ts (AC-6)` : null;
}

/**
 * The address of a page for the scan. A page with a fixed address is that address. A page with a dynamic segment needs a recipe that
 * names a record the signed-in person really owns (`context.ownerId`), so the scan sees the page with its data and not "no access";
 * `/estimates/[code]` (STORY-05.01) is the first. Throws when there is none.
 */
export function validPageAddress(path: string, context: { readonly ownerId: string }): string {
  if (!DYNAMIC_SEGMENT.test(path)) return path;
  const recipe = PAGE_RECIPES[path];
  if (recipe === undefined) throw new Error(recipeProblem(path, NO_RECIPE_ID) ?? `add a real-value recipe for ${path}`);
  return recipe(context);
}

/** Real-value recipes for pages with a dynamic segment: path pattern to a function of the signed-in person. */
const PAGE_RECIPES: Readonly<Record<string, (context: { readonly ownerId: string }) => string>> = {
  // SCR-12's edit page (STORY-02.02): the canary customer exists wherever the canaries are loaded.
  '/masters/customers/[id]': () => `/masters/customers/${CUSTOMER_RECIPE_ID}`,
  // SCR-05 (STORY-05.01): the canary task of the signed-in Engineer, who owns it (`estimate-recipe.ts`).
  '/estimates/[code]': (context) => canaryEstimatePageFor(context.ownerId),
};

/**
 * STORY-02.05: the Treatment routes. The ID is a canary treatment (`treatment-canary.ts`), which the in-memory repository of the security tests holds; the bodies
 * are invented. `GET /api/v1/treatments` and `GET /api/v1/options/treatments` have no ID or body: the default call is their valid call. Kept apart so
 * `validCallFor` does not grow with each master.
 */
function treatmentCall(method: HttpMethod, path: string): ValidCall | undefined {
  switch (`${method} ${path}`) {
    case 'POST /api/v1/treatments':
      return { id: NO_RECIPE_ID, body: { name: 'Invented-treatment-Z' }, status: 201 };
    case 'PATCH /api/v1/treatments/[id]':
      return { id: TREATMENT_RECIPE_ID, body: { name: 'Invented-renamed-treatment' }, status: 200 };
    case 'DELETE /api/v1/treatments/[id]':
      return { id: TREATMENT_RECIPE_ID, status: 204 };
    default:
      return undefined;
  }
}

/**
 * STORY-02.02: the Customer routes. The ID is a canary customer (`customer-canary.ts`), which the in-memory repository of the security tests holds; the bodies
 * are invented. `GET /api/v1/customers` and `GET /api/v1/options/customers` have no ID or body: the default call is their valid call.
 */
function customerCall(method: HttpMethod, path: string): ValidCall | undefined {
  switch (`${method} ${path}`) {
    case 'POST /api/v1/customers':
      return { id: NO_RECIPE_ID, body: { name: 'Invented-customer-Z' }, status: 201 };
    case 'PATCH /api/v1/customers/[id]':
      return { id: CUSTOMER_RECIPE_ID, body: { phone: '+99 555 0142' }, status: 200 };
    case 'POST /api/v1/customers/[id]/reset-rates':
      return { id: CUSTOMER_RECIPE_ID, status: 200 };
    // STORY-02.07: the delete of the allowed role really deletes, so it names a customer of its own, not the canary the pages and the scan keep reading.
    case 'DELETE /api/v1/customers/[id]':
      return { id: CUSTOMER_DELETE_RECIPE_ID, status: 204 };
    default:
      return undefined;
  }
}

/**
 * STORY-04.01, STORY-04.04: the task routes. The Engineer is the harness's spare Engineer (`context.targetId`), who is active, and the deadline is far in the future, so the
 * valid call is accepted whatever instant the held clock stands at. `GET /api/v1/options/assign-context` has no ID or body: the default call is its valid call.
 */
function taskCall(method: HttpMethod, path: string, context: CallContext): ValidCall | undefined {
  switch (`${method} ${path}`) {
    case 'POST /api/v1/tasks':
      return {
        id: NO_RECIPE_ID,
        body: { engineerId: context.targetId, folderPath: '\\\\invented-server\\invented-share\\RFQ-0', deadline: '2099-01-01T10:00', title: 'Invented task', notes: 'Invented notes.' },
        status: 201,
      };
    // STORY-04.04: the canary task of the signed-in Engineer, whose task ID is the same as its estimate's (`estimate-recipe.ts`), so the scan opens a task that really exists.
    case 'GET /api/v1/tasks/[id]':
      return { id: context.targetId, status: 200 };
    default:
      return undefined;
  }
}

/**
 * STORY-05.01 and STORY-05.02: the estimate routes. The estimate is the one the caller's recipe owner has (`estimate-recipe.ts`: its ID is `context.targetId`), and the
 * customer is the canary customer, which the in-memory repository of the security tests and the E2E database both hold. Every call must answer the same at any state,
 * because the matrix and the scan repeat them for each role:
 *   - choosing the customer the estimate already has is a no-op that answers 200;
 *   - the parts tree has one part, the canary part, whose ID is the estimate's too (one value fills every dynamic segment of a path), first at the top with revision 1.
 *     Adding an item appends it, so the canary part stays first; moving it to where it is changes nothing and answers 200;
 *   - a delete would remove the canary part and every later call would answer 404, so its valid call names a revision the part never has: it is refused 409 with the tree,
 *     which is also the one answer of the tree routes that carries parts in an error body, so the confidentiality scan reads it.
 */
function estimateCall(method: HttpMethod, path: string, context: CallContext): ValidCall | undefined {
  const id = context.targetId;
  const stay = { revision: 1, parentId: null, index: 0 };
  switch (`${method} ${path}`) {
    case 'PUT /api/v1/estimates/[id]/customer':
      return { id, body: { customerId: CUSTOMER_RECIPE_ID }, status: 200 };
    case 'GET /api/v1/estimates/[id]/tree':
    case 'GET /api/v1/estimates/[id]/nodes/[nodeId]':
      return { id, status: 200 };
    case 'POST /api/v1/estimates/[id]/nodes':
      return { id, body: { kind: 'item' }, status: 201 };
    case 'POST /api/v1/estimates/[id]/tree/move':
      return { id, body: { nodeId: id, ...stay }, status: 200 };
    case 'PUT /api/v1/estimates/[id]/nodes/[nodeId]':
      return { id, body: stay, status: 200 };
    case 'DELETE /api/v1/estimates/[id]/nodes/[nodeId]':
      return { id, query: '?revision=999&parts=1&subtree=0000000000000000', status: 409 };
    default:
      return undefined;
  }
}

// Over 40 lines on purpose (coding standards section 1): one `switch` of the valid calls of the routes, a line or two per route; a master's routes move into a helper like `treatmentCall`.
export function validCallFor(method: HttpMethod, path: string, context: CallContext): ValidCall {
  switch (`${method} ${path}`) {
    // STORY-01.05: the person changes their own password to a different one (QLT-01). The harness puts each role back on the first password
    // whenever `signInAs` names it, so the call repeats as every role; the real scan makes it once for a person made for the run.
    case 'POST /api/v1/account/password':
      return { id: NO_RECIPE_ID, body: { currentPassword: HARNESS_PASSWORD, newPassword: HARNESS_NEXT_PASSWORD }, status: 204 };
    case 'GET /api/v1/users':
      return DEFAULT_CALL;
    case 'POST /api/v1/users':
      return {
        id: NO_RECIPE_ID,
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
      return { id: NO_RECIPE_ID, body: { name: 'Invented-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' }, status: 201 };
    case 'PATCH /api/v1/process-items/[id]':
      return { id: PLATING_ITEM_ID, body: { defaultValue: '2.37' }, status: 200 };
    case 'DELETE /api/v1/process-items/[id]':
      return { id: PLATING_ITEM_ID, status: 204 };
    // STORY-02.03: the Material Master routes. The ID is a canary material (`material-master-canary.ts`), which every database the scan reads
    // holds; the bodies are invented. `GET /api/v1/options/materials` has no ID or body: the default call is its valid call.
    case 'GET /api/v1/materials':
      return DEFAULT_CALL;
    case 'POST /api/v1/materials':
      return {
        id: NO_RECIPE_ID,
        body: { materialInDrawing: 'Invented-sheet-grade-Z', materialConsidered: 'Invented alloy', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
        status: 201,
      };
    case 'PATCH /api/v1/materials/[id]':
      return { id: MATERIAL_RECIPE_ID, body: { scrapRate: '23.37' }, status: 200 };
    // STORY-02.07: the delete of the allowed role really deletes, so it names a material of its own, not the canary the scan keeps reading.
    case 'DELETE /api/v1/materials/[id]':
      return { id: MATERIAL_DELETE_RECIPE.id, status: 204 };
    // STORY-02.04: the Exchange Rate Master route. It has no ID. The body is the pair of canary rates, which every database the scan reads holds already.
    case 'GET /api/v1/exchange-rates':
      return DEFAULT_CALL;
    case 'PUT /api/v1/exchange-rates':
      return { id: NO_RECIPE_ID, body: { usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur }, status: 200 };
    default:
      return treatmentCall(method, path) ?? customerCall(method, path) ?? taskCall(method, path, context) ?? estimateCall(method, path, context) ?? DEFAULT_CALL;
  }
}

/**
 * Every implemented route of a manifest that has a dynamic segment and no real-value recipe, one line each (QLT-02, QLT-08). Empty means
 * every dynamic route the scan and the CR-33 loops open has a record that really exists. A story that implements such a route adds its
 * recipe in the same change, or this list names it and `tests/security/route-recipes.test.ts` fails.
 */
export function rowsWithoutRecipe(manifest: ReadonlyArray<RouteRow>, context: CallContext): string[] {
  const implemented = manifest.filter((row) => row.status === 'implemented' && row.roles !== 'public' && row.path.includes('['));
  return implemented.flatMap((row) => {
    if (row.kind === 'page') {
      if (row.hiddenInProduction === true) return [];
      try {
        validPageAddress(row.path, { ownerId: context.targetId });
        return [];
      } catch (error) {
        return [`page ${row.path}: ${error instanceof Error ? error.message : 'no recipe'}`];
      }
    }
    return row.methods
      .filter((method) => method !== 'HEAD')
      .flatMap((method) => {
        const problem = recipeProblem(row.path, validCallFor(method, row.path, context).id);
        return problem === null ? [] : [`${method} ${row.path}: ${problem}`];
      });
  });
}
