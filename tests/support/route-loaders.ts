/**
 * A loader for each implemented route, so the security tests can call the real handler or page (STORY-01.02 AC-2, AC-4,
 * AC-5). `import()` takes a literal path here (a computed one is forbidden by lint), so a story that adds a route adds its
 * loader in the same change; `role-matrix.test.ts` fails until it does, and the completeness test fails until the manifest
 * has the row. A route with a body or an ID in its path also adds its valid call to `route-calls.ts`.
 */

export type Loader = () => Promise<unknown>;

/**
 * The public API routes that change state and are declared with `withPublicRoute` (STORY-09.07). They are in no role's list, so the role matrix never calls them; `csrf.test.ts` loads each of these
 * to hold it to the same origin check as every other state-changing route, and fails for a public state-changing route that is neither here nor in `OWN_PROTECTION`.
 */
export const PUBLIC_API_LOADERS: Readonly<Record<string, Loader>> = {
  '/api/v1/account/password/forgot': () => import('@/app/api/v1/account/password/forgot/route'),
  '/api/v1/account/password/reset': () => import('@/app/api/v1/account/password/reset/route'),
};

export const API_LOADERS: Readonly<Record<string, Loader>> = {
  '/api/v1/me': () => import('@/app/api/v1/me/route'),
  '/api/v1/account/password': () => import('@/app/api/v1/account/password/route'),
  '/api/v1/audit': () => import('@/app/api/v1/audit/route'),
  '/api/v1/config/fields': () => import('@/app/api/v1/config/fields/route'),
  '/api/v1/config/current': () => import('@/app/api/v1/config/current/route'),
  '/api/v1/config/formula-check': () => import('@/app/api/v1/config/formula-check/route'),
  '/api/v1/config/sample-rows': () => import('@/app/api/v1/config/sample-rows/route'),
  '/api/v1/config/fields/[id]/formula': () => import('@/app/api/v1/config/fields/[id]/formula/route'),
  '/api/v1/config/fields/preview': () => import('@/app/api/v1/config/fields/preview/route'),
  '/api/v1/config/fields/[id]': () => import('@/app/api/v1/config/fields/[id]/route'),
  '/api/v1/config/fields/[id]/references': () => import('@/app/api/v1/config/fields/[id]/references/route'),
  '/api/v1/config/insert-options': () => import('@/app/api/v1/config/insert-options/route'),
  '/api/v1/config/checkpoints': () => import('@/app/api/v1/config/checkpoints/route'),
  '/api/v1/config/versions/[id]/revert': () => import('@/app/api/v1/config/versions/[id]/revert/route'),
  '/api/v1/settings': () => import('@/app/api/v1/settings/route'),
  '/api/v1/settings/test-email': () => import('@/app/api/v1/settings/test-email/route'),
  '/api/v1/users': () => import('@/app/api/v1/users/route'),
  '/api/v1/users/[id]': () => import('@/app/api/v1/users/[id]/route'),
  '/api/v1/users/[id]/password-reset': () => import('@/app/api/v1/users/[id]/password-reset/route'),
  '/api/v1/users/[id]/admin-handover': () => import('@/app/api/v1/users/[id]/admin-handover/route'),
  '/api/v1/process-items': () => import('@/app/api/v1/process-items/route'),
  '/api/v1/process-items/[id]': () => import('@/app/api/v1/process-items/[id]/route'),
  '/api/v1/materials': () => import('@/app/api/v1/materials/route'),
  '/api/v1/materials/[id]': () => import('@/app/api/v1/materials/[id]/route'),
  '/api/v1/options/materials': () => import('@/app/api/v1/options/materials/route'),
  '/api/v1/treatments': () => import('@/app/api/v1/treatments/route'),
  '/api/v1/treatments/[id]': () => import('@/app/api/v1/treatments/[id]/route'),
  '/api/v1/options/treatments': () => import('@/app/api/v1/options/treatments/route'),
  '/api/v1/exchange-rates': () => import('@/app/api/v1/exchange-rates/route'),
  '/api/v1/customers': () => import('@/app/api/v1/customers/route'),
  '/api/v1/customers/[id]': () => import('@/app/api/v1/customers/[id]/route'),
  '/api/v1/customers/[id]/reset-rates': () => import('@/app/api/v1/customers/[id]/reset-rates/route'),
  '/api/v1/options/customers': () => import('@/app/api/v1/options/customers/route'),
  '/api/v1/tasks': () => import('@/app/api/v1/tasks/route'),
  '/api/v1/tasks/[id]': () => import('@/app/api/v1/tasks/[id]/route'),
  '/api/v1/estimates/[id]/customer': () => import('@/app/api/v1/estimates/[id]/customer/route'),
  '/api/v1/estimates/[id]/calculate': () => import('@/app/api/v1/estimates/[id]/calculate/route'),
  '/api/v1/estimates/[id]/recalculate': () => import('@/app/api/v1/estimates/[id]/recalculate/route'),
  '/api/v1/estimates/[id]/approve': () => import('@/app/api/v1/estimates/[id]/approve/route'),
  '/api/v1/estimates/[id]/unlock': () => import('@/app/api/v1/estimates/[id]/unlock/route'),
  '/api/v1/estimates/[id]/unlock-preview': () => import('@/app/api/v1/estimates/[id]/unlock-preview/route'),
  '/api/v1/estimates/[id]/approval/cancel': () => import('@/app/api/v1/estimates/[id]/approval/cancel/route'),
  '/api/v1/estimates/[id]/approval/remove-price': () => import('@/app/api/v1/estimates/[id]/approval/remove-price/route'),
  '/api/v1/estimates/[id]/costs': () => import('@/app/api/v1/estimates/[id]/costs/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]/costs': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/costs/route'),
  '/api/v1/estimates/[id]/export': () => import('@/app/api/v1/estimates/[id]/export/route'),
  '/api/v1/estimates/[id]/export-summary': () => import('@/app/api/v1/estimates/[id]/export-summary/route'),
  '/api/v1/estimates/[id]/tree': () => import('@/app/api/v1/estimates/[id]/tree/route'),
  '/api/v1/estimates/[id]/tree/move': () => import('@/app/api/v1/estimates/[id]/tree/move/route'),
  '/api/v1/estimates/[id]/nodes': () => import('@/app/api/v1/estimates/[id]/nodes/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route'),
  '/api/v1/estimates/[id]/form': () => import('@/app/api/v1/estimates/[id]/form/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]/inputs': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/inputs/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]/image': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/image/route'),
  '/api/v1/images/[id]': () => import('@/app/api/v1/images/[id]/route'),
  '/api/v1/options/assign-context': () => import('@/app/api/v1/options/assign-context/route'),
};

export const PAGE_LOADERS: Readonly<Record<string, Loader>> = {
  '/': () => import('@/app/(portal)/page'),
  '/queue': () => import('@/app/(portal)/queue/page'),
  '/assign': () => import('@/app/(portal)/assign/page'),
  '/estimates/[code]': () => import('@/app/(portal)/estimates/[code]/page'),
  '/estimates/[code]/costs/[slNo]': () => import('@/app/(portal)/estimates/[code]/costs/[slNo]/page'),
  '/estimates/[code]/export': () => import('@/app/(portal)/estimates/[code]/export/page'),
  '/design-system': () => import('@/app/(portal)/design-system/page'),
  '/about': () => import('@/app/(portal)/about/page'),
  '/account': () => import('@/app/(portal)/account/page'),
  '/users': () => import('@/app/(portal)/users/page'),
  '/audit': () => import('@/app/(portal)/audit/page'),
  '/settings': () => import('@/app/(portal)/settings/page'),
  '/config/fields': () => import('@/app/(portal)/config/fields/page'),
  '/config/fields/[id]/formula': () => import('@/app/(portal)/config/fields/[id]/formula/page'),
  '/config/fields/new': () => import('@/app/(portal)/config/fields/new/page'),
  '/config/checkpoints': () => import('@/app/(portal)/config/checkpoints/page'),
  '/masters/process': () => import('@/app/(portal)/masters/process/page'),
  '/masters/materials': () => import('@/app/(portal)/masters/materials/page'),
  '/masters/customers': () => import('@/app/(portal)/masters/customers/page'),
  '/masters/customers/[id]': () => import('@/app/(portal)/masters/customers/[id]/page'),
};
