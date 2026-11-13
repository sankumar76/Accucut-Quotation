import type { HttpMethod, RouteRow } from '../../src/server/http/route-manifest';

import { CUSTOMER_RECIPE_ID } from './customer-canary';
import { EXCHANGE_RATE_CANARIES } from './exchange-rate-canary';
import { MATERIAL_RECIPE_ID } from './material-master-canary';
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
 * there is none yet, because no such page is implemented (`/estimates/[code]` arrives with story 05.x). Throws when there is none.
 */
export function validPageAddress(path: string, context: { readonly ownerId: string }): string {
  if (!DYNAMIC_SEGMENT.test(path)) return path;
  const recipe = PAGE_RECIPES[path];
  if (recipe === undefined) throw new Error(recipeProblem(path, NO_RECIPE_ID) ?? `add a real-value recipe for ${path}`);
  return recipe(context);
}

/** Real-value recipes for pages with a dynamic segment: path pattern to a function of the signed-in person. Empty until one is implemented. */
const PAGE_RECIPES: Readonly<Record<string, (context: { readonly ownerId: string }) => string>> = {
  // SCR-12's edit page (STORY-02.02): the canary customer exists wherever the canaries are loaded.
  '/masters/customers/[id]': () => `/masters/customers/${CUSTOMER_RECIPE_ID}`,
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
    default:
      return undefined;
  }
}

// Over 40 lines on purpose (coding standards section 1): one `switch` of the valid calls of the routes, a line or two per route; a master's routes move into a helper like `treatmentCall`.
export function validCallFor(method: HttpMethod, path: string, context: CallContext): ValidCall {
  switch (`${method} ${path}`) {
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
    // STORY-02.04: the Exchange Rate Master route. It has no ID. The body is the pair of canary rates, which every database the scan reads holds already.
    case 'GET /api/v1/exchange-rates':
      return DEFAULT_CALL;
    case 'PUT /api/v1/exchange-rates':
      return { id: NO_RECIPE_ID, body: { usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur }, status: 200 };
    default:
      return treatmentCall(method, path) ?? customerCall(method, path) ?? DEFAULT_CALL;
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
