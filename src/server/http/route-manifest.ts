import { deepFreeze } from '../../lib/deep-freeze';
import type { RoleName } from '../../lib/auth/roles';

/**
 * The route manifest (STORY-01.02, architecture sections 4.1, 6 and 8): one table of every page and API route with the
 * roles that may open it. Four things read it, so a role can never be allowed in one place and refused in another:
 *   - `withRoute` takes a handler's roles from its row (API routes);
 *   - `authorizePage` takes a page's roles from its row (pages);
 *   - the navigation (side menu, drawer and `GET /api/v1/me`) lists the rows that carry `nav`, are implemented and allow
 *     the role (`navigation.ts`);
 *   - the tests: the role matrix calls every implemented row as each role, and the completeness test fails when a route
 *     file has no row or a row has no route file.
 *
 * The file is plain data, with no `server-only` and no Next.js import, so the JS budget check (scripts) can read it.
 *
 * A story that adds a route adds its row in the same change; one that leaves a row `planned` has no route file yet, and
 * a planned row is neither reachable nor listed in the menu. The `planned` rows below are proposed from the screen list
 * (SPEC section 9, UX spec section 4, SCR-25) and the page addresses of architecture section 6; the story that builds
 * the page confirms or corrects the address. Engineer rows are the ones that list `ENGINEER`: nothing else is reachable
 * to an Engineer, whatever the menu shows (BR-003, NFR-001). A path has one row for each set of roles: when the methods of one file differ in who may call
 * them (`GET` and `POST` of `/api/v1/tasks`), each method has its own row, and `findRoute` takes the row that lists the method.
 */

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** `'public'` is for the sign-in page and next-auth's own routes: no session is needed. Otherwise the roles allowed. */
export type RouteAccess = 'public' | ReadonlyArray<RoleName>;

/** The names of the icons the menu draws; the mapping to the drawing is in the page frame (`portal-frame-props.tsx`). */
export type NavIcon =
  | 'list-checks'
  | 'house'
  | 'palette'
  | 'user-plus'
  | 'database'
  | 'users-round'
  | 'package'
  | 'sliders'
  | 'flag'
  | 'users'
  | 'settings'
  | 'scroll-text'
  | 'info';

/** The order of the menu's groups (SCR-25). `Review` is the non-production reference page and comes last. */
export const NAV_GROUP_ORDER = ['Work', 'Masters', 'Configuration', 'Administration', 'Help', 'Review'] as const;

export type NavGroupName = (typeof NAV_GROUP_ORDER)[number];

export interface NavMeta {
  readonly group: NavGroupName;
  readonly label: string;
  /** Where it sits within its group, ascending. */
  readonly order: number;
  readonly icon: NavIcon;
  /** A different label for a role, for example "My tasks" for an Engineer. */
  readonly labelFor?: Readonly<Partial<Record<RoleName, string>>>;
}

export interface RouteRow {
  /** A Next.js route pattern: `/queue`, `/estimates/[code]`, `/api/v1/me`. No route group. */
  readonly path: string;
  readonly kind: 'page' | 'api';
  readonly methods: ReadonlyArray<HttpMethod>;
  readonly roles: RouteAccess;
  /** `implemented` has a route file; `planned` does not, and is not reachable. */
  readonly status: 'implemented' | 'planned';
  /** The release that builds it (PRD). */
  readonly stage: 'R1' | 'R2';
  /** The screen it shows, for a page. */
  readonly screen?: string;
  /** Present when the route is a menu entry; only a page with a fixed address can be one. */
  readonly nav?: NavMeta;
  /**
   * A route that a person who still has to set a new password may use (STORY-01.05 AC-5, FR-004): the account page and the change itself.
   * Every other page redirects to the account page and every other API route answers 403 `PASSWORD_CHANGE_REQUIRED` until the flag is
   * cleared. Deny by default: a row without this is closed to them.
   */
  readonly mustChangeAllowed?: true;
  /** A review page that a production build answers "not found" for (`/design-system`). */
  readonly hiddenInProduction?: true;
  /**
   * A route that exists only when `NODE_ENV` is `test` and answers 404 everywhere else (STORY-01.03 AC-4: the negative control
   * of the confidentiality scan). It is public, so it is in no role's list; the scan iterates the roles' rows and so never
   * counts it as an Engineer route. At most one row carries it (`tests/unit/http-route-manifest.test.ts`).
   */
  readonly testOnly?: true;
}

const ALL_ROLES: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD', 'ENGINEER'];
const ADMIN_AND_LEAD: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD'];
const ADMIN_ONLY: ReadonlyArray<RoleName> = ['ADMIN'];

const ROWS: ReadonlyArray<RouteRow> = [
  // ---- Implemented -------------------------------------------------------------------------------------------------
  { path: '/sign-in', kind: 'page', methods: ['GET'], roles: 'public', status: 'implemented', stage: 'R1', screen: 'SCR-01' },
  { path: '/api/auth/[...nextauth]', kind: 'api', methods: ['GET', 'POST'], roles: 'public', status: 'implemented', stage: 'R1' },
  {
    path: '/queue',
    kind: 'page',
    methods: ['GET'],
    roles: ALL_ROLES,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-03',
    nav: { group: 'Work', label: 'Task queue', order: 10, icon: 'list-checks', labelFor: { ENGINEER: 'My tasks' } },
  },
  {
    path: '/',
    kind: 'page',
    methods: ['GET'],
    roles: ALL_ROLES,
    status: 'implemented',
    stage: 'R1',
    nav: { group: 'Work', label: 'Home', order: 90, icon: 'house' },
  },
  {
    path: '/design-system',
    kind: 'page',
    methods: ['GET'],
    roles: ALL_ROLES,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-00',
    nav: { group: 'Review', label: 'Design system', order: 10, icon: 'palette' },
    hiddenInProduction: true,
  },
  { path: '/api/v1/me', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-01.04 (SCR-14). The Admin only; the address `/users` and the three API paths are as architecture section 6 plans them.
  {
    path: '/users',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-14',
    nav: { group: 'Administration', label: 'Users', order: 10, icon: 'users' },
  },
  { path: '/api/v1/users', kind: 'api', methods: ['GET', 'POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/users/[id]', kind: 'api', methods: ['PATCH'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/users/[id]/password-reset', kind: 'api', methods: ['POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  // STORY-01.07 (SCR-16). The Admin only. The API has GET and nothing else: the log has no write route (PATCH, PUT and DELETE are 405).
  {
    path: '/audit',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-16',
    nav: { group: 'Administration', label: 'Audit log', order: 30, icon: 'scroll-text' },
  },
  { path: '/api/v1/audit', kind: 'api', methods: ['GET'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  // STORY-02.01 (SCR-11). The Admin only (BR-004). The default-change routes (`/process-items/{id}/default-change`) are story 02.08's.
  {
    path: '/masters/process',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-11',
    nav: { group: 'Masters', label: 'Process master', order: 10, icon: 'database' },
  },
  { path: '/api/v1/process-items', kind: 'api', methods: ['GET', 'POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/process-items/[id]', kind: 'api', methods: ['PATCH', 'DELETE'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  // STORY-02.03 (SCR-13, the Materials tab). The page and the two Admin routes are the Admin's (BR-004); `DELETE /materials/{id}` is
  // story 02.07's. `/api/v1/options/materials` is the one route of the story that every role may call (AC-4): IDs, names and Material
  // Considered, and no rate of any kind, so the cost scan covers it as an Engineer route. The nav entry is the page's, from the planned row.
  {
    path: '/masters/materials',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-13',
    nav: { group: 'Masters', label: 'Materials and lists', order: 30, icon: 'package' },
  },
  { path: '/api/v1/materials', kind: 'api', methods: ['GET', 'POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/materials/[id]', kind: 'api', methods: ['PATCH'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/options/materials', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-02.04 (SCR-13, the Exchange rates tab). The Admin only (BR-004); an Engineer never receives a rate (BR-003), so the route is in no Engineer list.
  // The tab is in the page of the Materials row above: no new page, no new menu entry.
  { path: '/api/v1/exchange-rates', kind: 'api', methods: ['GET', 'PUT'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  // STORY-02.05 (SCR-13, the Treatment / Color tab). The Admin only (BR-004); the tab is in the page of the Materials row above. `/api/v1/options/treatments` is
  // the one route of the story that every role may call (AC-5): IDs and names, "Other" included, and no rate of any kind, so the cost scan covers it as an Engineer route.
  { path: '/api/v1/treatments', kind: 'api', methods: ['GET', 'POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/treatments/[id]', kind: 'api', methods: ['PATCH', 'DELETE'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/options/treatments', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-01.05 (SCR-23). Every role. The page and the change are the two routes open to a person who must set a new password first (`mustChangeAllowed`).
  { path: '/account', kind: 'page', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1', screen: 'SCR-23', mustChangeAllowed: true },
  { path: '/api/v1/account/password', kind: 'api', methods: ['POST'], roles: ALL_ROLES, status: 'implemented', stage: 'R1', mustChangeAllowed: true },
  // STORY-02.02 (SCR-12). The Admin only (BR-004): the list and the edit page are pages (adding a customer is a dialog on the list); `DELETE /customers/{id}` is story 02.07's.
  // `/api/v1/options/customers` is the one route of the story that every role may call (AC-5): IDs and names, and no contact detail or rate of any kind, so
  // the cost scan covers it as an Engineer route.
  {
    path: '/masters/customers',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-12',
    nav: { group: 'Masters', label: 'Customers', order: 20, icon: 'users-round' },
  },
  { path: '/masters/customers/[id]', kind: 'page', methods: ['GET'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1', screen: 'SCR-12' },
  { path: '/api/v1/customers', kind: 'api', methods: ['GET', 'POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/customers/[id]', kind: 'api', methods: ['PATCH'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/customers/[id]/reset-rates', kind: 'api', methods: ['POST'], roles: ADMIN_ONLY, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/options/customers', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-04.01 (SCR-04). A Lead and an Admin assign (BR-004); an Engineer is refused on all three, with 403 for the routes and SCR-26 for the page (AC-5). The
  // options route is for the same two roles, so it is in no Engineer's list and the cost scan never calls it as an Engineer. Reassign (`PATCH /tasks/{id}`) is story 04.07's.
  {
    path: '/assign',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_AND_LEAD,
    status: 'implemented',
    stage: 'R1',
    screen: 'SCR-04',
    nav: { group: 'Work', label: 'Assign task', order: 20, icon: 'user-plus' },
  },
  { path: '/api/v1/tasks', kind: 'api', methods: ['POST'], roles: ADMIN_AND_LEAD, status: 'implemented', stage: 'R1' },
  // STORY-04.02 (SCR-03). The queue read: every role, because an Engineer's own list is the same call (architecture section 6, "Tasks": A L, E own). It is a second row for the
  // same path, one per method, because the roles differ: the POST row above stays Lead and Admin, so an Engineer's POST is still the fixed 403 before the body is read.
  // The answer is cut to the caller's own tasks by the service, from the session, and parsed with a strict schema that names no cost.
  { path: '/api/v1/tasks', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/options/assign-context', kind: 'api', methods: ['GET'], roles: ADMIN_AND_LEAD, status: 'implemented', stage: 'R1' },
  // STORY-05.01 (SCR-05). Every role opens the address and the server decides what it shows (UX spec section 4): an Engineer the workspace of their own task and SCR-26
  // for any other, a Lead and an Admin a short header until SCR-06 (STORY-06.02). The customer is chosen through `PUT /estimates/{id}/customer`: an Admin and a Lead on any
  // draft, an Engineer on their own while it is a draft (architecture section 6 "Set customer"), so it is in the Engineer's list and the cost scan calls it.
  { path: '/estimates/[code]', kind: 'page', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1', screen: 'SCR-05' },
  { path: '/api/v1/estimates/[id]/customer', kind: 'api', methods: ['PUT'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-05.02 (SCR-05's parts tree; architecture section 6 "Tree", "Node", "Reorder"): A L, and an Engineer on their own estimate; a write only while it is a draft. One response
  // schema per route for every role, with no figure in it, so every one is in the Engineer's list and the cost scan calls it.
  { path: '/api/v1/estimates/[id]/tree', kind: 'api', methods: ['GET'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/estimates/[id]/tree/move', kind: 'api', methods: ['POST'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/estimates/[id]/nodes', kind: 'api', methods: ['POST'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  { path: '/api/v1/estimates/[id]/nodes/[nodeId]', kind: 'api', methods: ['GET', 'PUT', 'DELETE'], roles: ALL_ROLES, status: 'implemented', stage: 'R1' },
  // STORY-01.03 (AC-4). The scan's negative control: leaks one invented sentinel under NODE_ENV=test and answers 404 anywhere else.
  // Public and `testOnly`, so no role's list holds it and no navigation, menu or role matrix row is made for it.
  { path: '/api/test-only/leak', kind: 'api', methods: ['GET'], roles: 'public', status: 'implemented', stage: 'R1', testOnly: true },

  // ---- Planned: Work -----------------------------------------------------------------------------------------------
  { path: '/estimates/[code]/costs/[slNo]', kind: 'page', methods: ['GET'], roles: ADMIN_AND_LEAD, status: 'planned', stage: 'R1', screen: 'SCR-07' },
  { path: '/estimates/[code]/export', kind: 'page', methods: ['GET'], roles: ADMIN_AND_LEAD, status: 'planned', stage: 'R1', screen: 'SCR-10' },

  // ---- Planned: Masters (Admin) ------------------------------------------------------------------------------------
  // ---- Planned: Configuration (Admin edits; a Lead may view the fields and formulas) ----------------------------------
  {
    path: '/config/fields',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_AND_LEAD,
    status: 'planned',
    stage: 'R2',
    screen: 'SCR-17',
    nav: { group: 'Configuration', label: 'Fields and formulas', order: 10, icon: 'sliders' },
  },
  {
    path: '/config/checkpoints',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R2',
    screen: 'SCR-21',
    nav: { group: 'Configuration', label: 'Checkpoints', order: 20, icon: 'flag' },
  },

  // ---- Planned: Administration (Admin) -------------------------------------------------------------------------------
  {
    path: '/settings',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-15',
    nav: { group: 'Administration', label: 'Settings', order: 20, icon: 'settings' },
  },

  // ---- Planned: Help (every role) ------------------------------------------------------------------------------------
  {
    path: '/about',
    kind: 'page',
    methods: ['GET'],
    roles: ALL_ROLES,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-24',
    nav: { group: 'Help', label: 'About', order: 10, icon: 'info' },
  },
];

export const ROUTE_MANIFEST: ReadonlyArray<RouteRow> = deepFreeze([...ROWS]);

/** The methods that change nothing, and so need no origin check (architecture section 8, CSRF). */
export const SAFE_METHODS: ReadonlyArray<string> = ['GET', 'HEAD', 'OPTIONS'];

export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.includes(method.toUpperCase());
}

/** The row for a path and method, or `undefined` when the manifest has none (a route outside it is refused by the tests). */
export function findRoute(path: string, method: HttpMethod, manifest: ReadonlyArray<RouteRow> = ROUTE_MANIFEST): RouteRow | undefined {
  return manifest.find((row) => row.path === path && row.methods.includes(method));
}

/** The page row for a path. */
export function findPage(path: string, manifest: ReadonlyArray<RouteRow> = ROUTE_MANIFEST): RouteRow | undefined {
  return manifest.find((row) => row.kind === 'page' && row.path === path);
}

/** Is this role listed on the row? A public row lists no role: it needs none. Deny by default. */
export function allowsRole(row: RouteRow, role: RoleName): boolean {
  return row.roles === 'public' ? true : row.roles.includes(role);
}
