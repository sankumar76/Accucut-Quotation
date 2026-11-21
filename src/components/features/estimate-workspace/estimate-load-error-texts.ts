/**
 * The words of the load-error pages of the three estimate routes (STORY-10.07 AC-4; ux-spec section 6.0 "Error (load)"): the workspace and the review at
 * `/estimates/<code>`, the cost details and the export. They sit here, and not in the folders of SCR-07 and SCR-10, because those folders are Restricted
 * (NFR-002): only their own page may import them, and an `error.tsx` is not their page.
 */

export const ESTIMATE_LOAD_ERROR_HEADER = 'Estimate';
export const ESTIMATE_LOAD_ERROR_TITLE = 'We could not load this estimate';
/**
 * Not "Nothing was changed.": the review's actions (Calculate, Approve, Unlock, Cancel) read the page again after they succeed, so this page can fail to
 * load right after a change that went through. The sentence is the one the customer's page uses for the same reason (SCR-12, ux-spec 0.26), for the
 * estimate. Words not in the UX spec: listed for the ux-expert (STORY-10.07 OQ-1).
 */
export const ESTIMATE_LOAD_ERROR_BODY = 'Check your connection and try again. If you just changed this estimate, that change was kept.';

export const COST_DETAILS_LOAD_ERROR_HEADER = 'Cost details';
export const COST_DETAILS_LOAD_ERROR_TITLE = 'We could not load the cost details';

export const EXPORT_LOAD_ERROR_HEADER = 'Excel export';
export const EXPORT_LOAD_ERROR_TITLE = 'We could not load the export';
