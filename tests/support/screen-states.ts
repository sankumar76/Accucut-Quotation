/**
 * The inventory of screen states (STORY-10.07 AC-1, FR-088; ux-spec section 6.0 "States"): every implemented page is either a data screen, with the
 * component or the file that proves each state it owes, or an exempt page with its reason. `tests/unit/screen-states-guard.test.ts` reads this table
 * against the route files, so a page added later (EPIC-08, EPIC-09, the R2 screens) fails the unit tests until it adds one row here.
 *
 * A proof is a file of the repository and a marker the file must contain, so a row that names a file that was renamed, or a state that was taken out
 * of it, fails too. A state a screen does not have is `na(...)` with the reason, never a silent blank. The states:
 *   - loading: the shared skeleton (`SkeletonBlock`, after 300 ms, `aria-busy`, a polite status) or the screen's own busy marker;
 *   - empty: the shared `EmptyState`, or the screen's own wording where the spec rules a notice (SCR-10);
 *   - noMatch: a search or filter that matches nothing, "Clear filters";
 *   - errorLoad: "We could not load ..." with Try again; a screen that reads after it opened proves it in its component, and every screen that
 *     does not say `na` also owes a route-level `error.tsx` at or above its page, so a thrown render error shows this page and not the generic one;
 *   - saved: the confirmation of a save (a notice with no timer, `role="status"`, or the screen's polite status). A failed save is an inline `alert`
 *     that keeps what was typed and never says "Nothing was changed." (section 6.0 "Error (action)"; proved in each screen's own tests).
 */

export interface FileProof {
  /** Relative to the repository, with forward slashes. */
  readonly file: string;
  /** Text the file must contain: the component, constant or attribute that makes the state. */
  readonly marker: string;
}

export interface NotApplicable {
  /** Why the screen does not have the state. */
  readonly na: string;
}

export type StateProof = FileProof | NotApplicable;

export const STATE_NAMES = ['loading', 'empty', 'noMatch', 'errorLoad', 'saved'] as const;
export type StateName = (typeof STATE_NAMES)[number];

export interface DataScreen {
  /** The Next.js route pattern, as `readRouteFiles` gives it. */
  readonly page: string;
  readonly screen: string;
  readonly states: Readonly<Record<StateName, StateProof>>;
}

export interface ExemptPage {
  readonly page: string;
  readonly reason: string;
}

const FEATURES = 'src/components/features/';
const APP = 'src/app/(portal)/';

const proof = (file: string, marker: string): FileProof => ({ file, marker });
const na = (reason: string): NotApplicable => ({ na: reason });

export const isNotApplicable = (value: StateProof): value is NotApplicable => 'na' in value;

const READ_ON_SERVER = 'The page is read on the server and drawn with its data, so no read starts after the first paint.';
const NO_SEARCH = 'The screen has no search or filter.';
const READ_ONLY = 'The screen saves nothing.';

export const DATA_SCREENS: ReadonlyArray<DataScreen> = [
  {
    page: '/queue',
    screen: 'SCR-03',
    states: {
      loading: proof(`${FEATURES}queues/queue-screen.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}queues/queue-screen.tsx`, 'EmptyState'),
      noMatch: na('The queue has tabs, not a search or a filter: each tab has its own empty words.'),
      errorLoad: proof(`${APP}queue/error.tsx`, 'ErrorState'),
      saved: na(`${READ_ONLY} Assigning is SCR-04.`),
    },
  },
  {
    page: '/assign',
    screen: 'SCR-04',
    states: {
      loading: proof(`${FEATURES}tasks/assign-screen.tsx`, 'SUBMITTING_ASSIGN'),
      empty: proof(`${FEATURES}tasks/assign-fields.tsx`, 'NO_ENGINEERS_HINT'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}assign/error.tsx`, 'RouteLoadError'),
      saved: proof(`${FEATURES}tasks/assign-screen.tsx`, 'assignedTitle'),
    },
  },
  {
    page: '/estimates/[code]',
    screen: 'SCR-05, SCR-06',
    states: {
      loading: proof(`${FEATURES}estimate-workspace/tree-panel.tsx`, 'Skeleton'),
      empty: proof(`${FEATURES}estimate-workspace/estimate-texts.ts`, 'TREE_EMPTY'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}estimates/[code]/error.tsx`, 'RouteLoadError'),
      saved: proof(`${FEATURES}estimate-workspace/save-bar.tsx`, 'role="status"'),
    },
  },
  {
    page: '/estimates/[code]/costs/[slNo]',
    screen: 'SCR-07',
    states: {
      loading: na(READ_ON_SERVER),
      empty: proof(`${FEATURES}cost-details/cost-details.tsx`, 'NOT_CALCULATED_TITLE'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}estimates/[code]/costs/[slNo]/error.tsx`, 'RouteLoadError'),
      saved: na(READ_ONLY),
    },
  },
  {
    page: '/estimates/[code]/export',
    screen: 'SCR-10',
    states: {
      loading: proof(`${FEATURES}estimate-export/download-button.tsx`, 'aria-busy'),
      empty: proof(`${FEATURES}estimate-export/estimate-export.tsx`, 'EMPTY_TITLE'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}estimates/[code]/export/error.tsx`, 'RouteLoadError'),
      saved: na('Nothing is saved: the file is built and downloaded, and a failed build has its own alert.'),
    },
  },
  {
    page: '/masters/process',
    screen: 'SCR-11',
    states: {
      loading: proof(`${FEATURES}masters/process-results.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}masters/process-results.tsx`, 'EmptyState'),
      noMatch: proof(`${FEATURES}masters/process-results.tsx`, 'CLEAR_FILTERS'),
      errorLoad: proof(`${APP}masters/process/error.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}masters/process-texts.ts`, 'savedNotice'),
    },
  },
  {
    page: '/masters/customers',
    screen: 'SCR-12',
    states: {
      loading: proof(`${FEATURES}masters/customer-results.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}masters/customer-results.tsx`, 'CUSTOMERS_EMPTY_TITLE'),
      noMatch: proof(`${FEATURES}masters/customer-results.tsx`, 'noCustomerMatchTitle'),
      errorLoad: proof(`${APP}masters/customers/error.tsx`, 'CustomerLoadError'),
      saved: proof(`${FEATURES}masters/customer-texts.ts`, 'customerAddedNotice'),
    },
  },
  {
    page: '/masters/customers/[id]',
    screen: 'SCR-12',
    states: {
      loading: na(READ_ON_SERVER),
      empty: na('A customer always has its rates table; there is no list to be empty.'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}masters/customers/[id]/error.tsx`, 'CustomerLoadError'),
      saved: proof(`${FEATURES}masters/customer-texts.ts`, 'customerSavedNotice'),
    },
  },
  {
    page: '/masters/materials',
    screen: 'SCR-13',
    states: {
      loading: proof(`${FEATURES}masters/material-results.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}masters/material-results.tsx`, 'EmptyState'),
      noMatch: proof(`${FEATURES}masters/material-results.tsx`, 'CLEAR_FILTERS'),
      errorLoad: proof(`${APP}masters/materials/error.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}masters/material-texts.ts`, 'materialSavedNotice'),
    },
  },
  {
    page: '/config/fields',
    screen: 'SCR-17',
    states: {
      loading: proof(`${FEATURES}config/fields-screen.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}config/fields-screen.tsx`, 'EmptyState'),
      noMatch: proof(`${FEATURES}config/fields-screen.tsx`, 'CLEAR_FILTERS'),
      errorLoad: proof(`${APP}config/fields/error.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}config/fields-screen.tsx`, 'DeleteNotices'),
    },
  },
  {
    page: '/config/fields/new',
    screen: 'SCR-19',
    states: {
      loading: proof(`${FEATURES}config/insert-field-screen.tsx`, 'SkeletonBlock'),
      empty: na('The wizard is a form: it lists nothing that can be empty.'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${FEATURES}config/insert-field-screen.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}config/insert-field-wizard.tsx`, 'Notice'),
    },
  },
  {
    page: '/config/fields/[id]/formula',
    screen: 'SCR-18',
    states: {
      loading: proof(`${FEATURES}config/formula-editor-screen.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}config/formula-editor-screen.tsx`, 'NO_FORMULA_TITLE'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${FEATURES}config/formula-editor-screen.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}config/formula-editor-texts.ts`, 'SAVED_TITLE'),
    },
  },
  {
    page: '/config/checkpoints',
    screen: 'SCR-21',
    states: {
      loading: proof(`${FEATURES}config/checkpoints-screen.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}config/checkpoints-screen.tsx`, 'EmptyState'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${FEATURES}config/checkpoints-screen.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}config/checkpoints-screen.tsx`, 'SAVED_TITLE'),
    },
  },
  {
    page: '/users',
    screen: 'SCR-14',
    states: {
      loading: proof(`${FEATURES}users/users-list.tsx`, 'aria-busy'),
      empty: na('The list always holds at least the Admin who is signed in.'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}users/error.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}users/users-screen.tsx`, 'saved('),
    },
  },
  {
    page: '/settings',
    screen: 'SCR-15',
    states: {
      loading: na(READ_ON_SERVER),
      empty: proof(`${FEATURES}settings/texts.ts`, 'BACKUP_NEVER_BODY'),
      noMatch: na(NO_SEARCH),
      errorLoad: proof(`${APP}settings/error.tsx`, 'ErrorState'),
      saved: proof(`${FEATURES}settings/alerts-card.tsx`, 'role="status"'),
    },
  },
  {
    page: '/audit',
    screen: 'SCR-16',
    states: {
      loading: proof(`${FEATURES}audit/audit-screen.tsx`, 'SkeletonBlock'),
      empty: proof(`${FEATURES}audit/audit-screen.tsx`, 'EMPTY_UNFILTERED_TITLE'),
      noMatch: proof(`${FEATURES}audit/texts.ts`, 'EMPTY_CLEAR_FILTERS'),
      errorLoad: proof(`${APP}audit/error.tsx`, 'ErrorState'),
      saved: na(READ_ONLY),
    },
  },
  {
    page: '/account',
    screen: 'SCR-23',
    states: {
      loading: na('The page reads nothing after it opens: the name, e-mail and role come with the session.'),
      empty: na('The page lists nothing.'),
      noMatch: na(NO_SEARCH),
      errorLoad: na('The page reads no record that could fail to load; a thrown render error falls to the root boundary of the portal.'),
      saved: proof(`${FEATURES}account/change-password-form.tsx`, 'role="status"'),
    },
  },
];

export const EXEMPT_PAGES: ReadonlyArray<ExemptPage> = [
  { page: '/', reason: 'Home: a placeholder that reads nothing and saves nothing.' },
  { page: '/about', reason: 'About: static text, nothing is read or saved.' },
  { page: '/design-system', reason: 'Review page for the shared parts; a production build answers not found.' },
  { page: '/sign-in', reason: 'Sign-in: a public form with its own states (STORY-01.01); no data is read.' },
  { page: '/forgot-password', reason: 'Public form of the sign-in family (STORY-01.04); no data is read, and its outcome sentences are that story\'s.' },
  { page: '/reset-password', reason: 'Public form of the sign-in family (STORY-01.04); no data is read, and its outcome sentences are that story\'s.' },
];
