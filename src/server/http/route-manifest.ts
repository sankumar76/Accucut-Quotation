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
 * to an Engineer, whatever the menu shows (BR-003, NFR-001).
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
  /** A review page that a production build answers "not found" for (`/design-system`). */
  readonly hiddenInProduction?: true;
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

  // ---- Planned: Work -----------------------------------------------------------------------------------------------
  {
    path: '/assign',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_AND_LEAD,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-04',
    nav: { group: 'Work', label: 'Assign task', order: 20, icon: 'user-plus' },
  },
  { path: '/estimates/[code]', kind: 'page', methods: ['GET'], roles: ALL_ROLES, status: 'planned', stage: 'R1', screen: 'SCR-05' },
  { path: '/estimates/[code]/costs/[slNo]', kind: 'page', methods: ['GET'], roles: ADMIN_AND_LEAD, status: 'planned', stage: 'R1', screen: 'SCR-07' },
  { path: '/estimates/[code]/export', kind: 'page', methods: ['GET'], roles: ADMIN_AND_LEAD, status: 'planned', stage: 'R1', screen: 'SCR-10' },

  // ---- Planned: Masters (Admin) ------------------------------------------------------------------------------------
  {
    path: '/masters/process',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-11',
    nav: { group: 'Masters', label: 'Process master', order: 10, icon: 'database' },
  },
  {
    path: '/masters/customers',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-12',
    nav: { group: 'Masters', label: 'Customers', order: 20, icon: 'users-round' },
  },
  {
    path: '/masters/materials',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-13',
    nav: { group: 'Masters', label: 'Materials and lists', order: 30, icon: 'package' },
  },

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
  {
    path: '/audit',
    kind: 'page',
    methods: ['GET'],
    roles: ADMIN_ONLY,
    status: 'planned',
    stage: 'R1',
    screen: 'SCR-16',
    nav: { group: 'Administration', label: 'Audit log', order: 30, icon: 'scroll-text' },
  },

  // ---- Planned: Help and account (every role) ------------------------------------------------------------------------
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
  { path: '/account/password', kind: 'page', methods: ['GET'], roles: ALL_ROLES, status: 'planned', stage: 'R1', screen: 'SCR-23' },
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
