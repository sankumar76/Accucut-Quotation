/**
 * A loader for each implemented route, so the security tests can call the real handler or page (STORY-01.02 AC-2, AC-4,
 * AC-5). `import()` takes a literal path here (a computed one is forbidden by lint), so a story that adds a route adds its
 * loader in the same change; `role-matrix.test.ts` fails until it does, and the completeness test fails until the manifest
 * has the row. A route with a body or an ID in its path also adds its valid call to `route-calls.ts`.
 */

export type Loader = () => Promise<unknown>;

export const API_LOADERS: Readonly<Record<string, Loader>> = {
  '/api/v1/me': () => import('@/app/api/v1/me/route'),
  '/api/v1/account/password': () => import('@/app/api/v1/account/password/route'),
  '/api/v1/audit': () => import('@/app/api/v1/audit/route'),
  '/api/v1/users': () => import('@/app/api/v1/users/route'),
  '/api/v1/users/[id]': () => import('@/app/api/v1/users/[id]/route'),
  '/api/v1/users/[id]/password-reset': () => import('@/app/api/v1/users/[id]/password-reset/route'),
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
  '/api/v1/estimates/[id]/tree': () => import('@/app/api/v1/estimates/[id]/tree/route'),
  '/api/v1/estimates/[id]/tree/move': () => import('@/app/api/v1/estimates/[id]/tree/move/route'),
  '/api/v1/estimates/[id]/nodes': () => import('@/app/api/v1/estimates/[id]/nodes/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route'),
  '/api/v1/estimates/[id]/form': () => import('@/app/api/v1/estimates/[id]/form/route'),
  '/api/v1/estimates/[id]/nodes/[nodeId]/inputs': () => import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/inputs/route'),
  '/api/v1/options/assign-context': () => import('@/app/api/v1/options/assign-context/route'),
};

export const PAGE_LOADERS: Readonly<Record<string, Loader>> = {
  '/': () => import('@/app/(portal)/page'),
  '/queue': () => import('@/app/(portal)/queue/page'),
  '/assign': () => import('@/app/(portal)/assign/page'),
  '/estimates/[code]': () => import('@/app/(portal)/estimates/[code]/page'),
  '/design-system': () => import('@/app/(portal)/design-system/page'),
  '/account': () => import('@/app/(portal)/account/page'),
  '/users': () => import('@/app/(portal)/users/page'),
  '/audit': () => import('@/app/(portal)/audit/page'),
  '/masters/process': () => import('@/app/(portal)/masters/process/page'),
  '/masters/materials': () => import('@/app/(portal)/masters/materials/page'),
  '/masters/customers': () => import('@/app/(portal)/masters/customers/page'),
  '/masters/customers/[id]': () => import('@/app/(portal)/masters/customers/[id]/page'),
};
