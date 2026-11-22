/**
 * The sweep's table (STORY-10.08 AC-1 to AC-3; ADR on the route manifest, `src/server/http/route-manifest.ts`): the pages the sweep walks, the roles each is opened as, and each page's
 * declared primary actions, written by hand once per page (assumption A-1 of the story) and reviewed with the screen set. Plain data with no Playwright import, so the unit guard
 * `tests/unit/sweep-covers-manifest.test.ts` can read it in the required check: a page of the manifest that is in neither `SWEEP_ROWS` nor `EXEMPT_PAGES` fails the build (AC-3).
 *
 * A page that the manifest gives to more than one kind of person can have more than one row, when what the screen shows differs (the review of a calculated estimate for a Lead and
 * the form of a draft for an Engineer are both `/estimates/[code]`). Every name here is the one the page shows; none is a cost figure, a rate or a formula (NFR-002).
 */

export type SweepRole = 'ADMIN' | 'LEAD' | 'ENGINEER';

/**
 * A control the page offers as its main job. `button` and `link` are found by role and accessible name; `css` is a selector, for the controls that have a fixed element ID.
 * `inMain` looks only inside the page's main region: the side menu has a link of the same name ("Assign task") that a phone keeps shut in its drawer.
 */
export type PrimaryAction =
  | { readonly kind: 'button' | 'link'; readonly name: string; readonly exact?: true; readonly inMain?: true }
  | { readonly kind: 'css'; readonly selector: string; readonly label: string };

/** Which seeded estimate a dynamic route is opened for: the one that has been calculated (the Lead's review) or the one still a draft (the Engineer's form). */
export type EstimateKind = 'calculated' | 'draft';

export interface SweepRow {
  /** The manifest's path pattern, for example `/estimates/[code]`. */
  readonly route: string;
  /** Tells apart two rows of one route; empty when the route has one row. */
  readonly variant?: string;
  /** The screen's name (UX spec), for the report. */
  readonly screen: string;
  /** The roles the sweep signs in as. Each must be allowed by the manifest; the forbidden roles of the page are checked once by the sweep itself. */
  readonly roles: ReadonlyArray<SweepRole>;
  readonly estimate?: EstimateKind;
  /** The page's declared primary actions: each must scroll into view and not be covered by a sticky bar. */
  readonly primary: ReadonlyArray<PrimaryAction>;
  /** An element of the loaded page (a row of its list, its form): the sweep waits for it before it measures, so a page is never judged while it still shows its first paint. */
  readonly readyCss?: string;
  /** Written when `primary` is empty: why this page has no action of its own (a read-only page). */
  readonly noPrimaryActionBecause?: string;
}

export const SWEEP_ROWS: ReadonlyArray<SweepRow> = [
  { route: '/', screen: 'Home', roles: ['ADMIN', 'LEAD', 'ENGINEER'], primary: [], noPrimaryActionBecause: 'the home page is a placeholder that holds a heading and, outside production, a link to the design system' },
  { route: '/queue', variant: 'lead', screen: 'SCR-03 Task queue', roles: ['ADMIN', 'LEAD'], primary: [{ kind: 'link', name: 'Assign task', inMain: true }] },
  { route: '/queue', variant: 'engineer', screen: 'SCR-03 Task queue', roles: ['ENGINEER'], primary: [], noPrimaryActionBecause: 'an Engineer opens a task from the list; the page has no button of its own' },
  { route: '/assign', screen: 'SCR-04 Assign task', roles: ['ADMIN', 'LEAD'], primary: [{ kind: 'button', name: 'Assign task' }] },
  {
    route: '/estimates/[code]',
    variant: 'review',
    screen: 'SCR-06 Estimate review',
    roles: ['ADMIN', 'LEAD'],
    estimate: 'calculated',
    primary: [
      { kind: 'css', selector: '#review-approve', label: 'Approve and lock' },
      { kind: 'link', name: 'Download .xlsx' },
    ],
  },
  { route: '/estimates/[code]', variant: 'form', readyCss: 'form[data-part-form]', screen: 'SCR-05 Estimate form', roles: ['ENGINEER'], estimate: 'draft', primary: [{ kind: 'css', selector: '#calculate-button', label: 'Calculate' }] },
  {
    route: '/estimates/[code]/costs/[slNo]',
    screen: 'SCR-07 Cost details',
    roles: ['ADMIN', 'LEAD'],
    estimate: 'calculated',
    primary: [{ kind: 'link', name: 'Back to the estimate' }],
  },
  { route: '/estimates/[code]/export', screen: 'SCR-10 Export', roles: ['ADMIN', 'LEAD'], estimate: 'calculated', primary: [{ kind: 'button', name: 'Download .xlsx' }] },
  { route: '/account', screen: 'SCR-23 Account', roles: ['ADMIN', 'LEAD', 'ENGINEER'], primary: [{ kind: 'button', name: 'Change password', exact: true }] },
  { route: '/about', screen: 'SCR-24 About', roles: ['ADMIN', 'LEAD', 'ENGINEER'], primary: [], noPrimaryActionBecause: 'the page only shows the product and version' },
  { route: '/users', screen: 'SCR-14 Users', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Add user' }] },
  { route: '/audit', screen: 'SCR-16 Audit log', roles: ['ADMIN'], primary: [], noPrimaryActionBecause: 'the page is a filtered list; its filters and "Show more entries" depend on how many entries exist' },
  { route: '/settings', screen: 'SCR-15 Settings', roles: ['ADMIN'], primary: [], noPrimaryActionBecause: 'the page shows the backup and disk state and has no control of its own' },
  { route: '/masters/process', readyCss: '[data-item-id]', screen: 'SCR-11 Process master', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Add rate' }] },
  { route: '/masters/materials', readyCss: '[data-item-id]', screen: 'SCR-13 Materials and lists', roles: ['ADMIN'], primary: [{ kind: 'css', selector: 'main button[data-action="add"]', label: 'Add (the active tab)' }] },
  { route: '/masters/customers', readyCss: '[data-item-id]', screen: 'SCR-12 Customers', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Add customer' }] },
  { route: '/masters/customers/[id]', screen: 'SCR-12 Customer', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Save customer' }, { kind: 'button', name: 'Reset to defaults' }] },
  { route: '/config/fields', readyCss: '[data-field-id]', screen: 'SCR-17 Fields and formulas', roles: ['ADMIN', 'LEAD'], primary: [], noPrimaryActionBecause: 'the page is a list of fields; each row has its own links' },
  { route: '/config/fields/[id]/formula', screen: 'SCR-18 Formula editor', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Save formula', exact: true }] },
  { route: '/config/fields/new', screen: 'SCR-19 Add field', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Next', exact: true }] },
  { route: '/config/checkpoints', screen: 'SCR-21 Checkpoints', roles: ['ADMIN'], primary: [{ kind: 'button', name: 'Save checkpoint' }] },
];

/** A page the sweep does not open, and why. The guard fails when a reason is empty or the page is in the table too. */
export interface ExemptPage {
  readonly route: string;
  readonly because: string;
}

export const EXEMPT_PAGES: ReadonlyArray<ExemptPage> = [
  { route: '/sign-in', because: 'a public page, covered by tests/e2e/sign-in.spec.ts at three widths with axe, and walked as a journey in every engine by browsers.spec.ts' },
  { route: '/forgot-password', because: 'a public page, covered by tests/e2e/password-reset.spec.ts at three widths with axe' },
  { route: '/reset-password', because: 'a public page that needs a reset link from an e-mail; covered by tests/e2e/password-reset.spec.ts at three widths with axe' },
  { route: '/design-system', because: 'a review page that a production build answers "not found" for (the sweep runs on the production build)' },
];

/** The sizes of the other check of NFR-016 (AC-5): no sideways scroll at 1024x768, 1920x1080 and the landscape form of the 360x800 phone. The landscape form of 768x1024 is 1024x768. */
export const OTHER_SIZES: ReadonlyArray<{ readonly name: string; readonly width: number; readonly height: number }> = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '800x360 (360x800 turned)', width: 800, height: 360 },
];
