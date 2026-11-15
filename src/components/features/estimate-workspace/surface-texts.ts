/**
 * The words of Treatment / Color (G) and of the eight surface treatments (Z to AG) on the part form (STORY-05.06; UX spec SCR-05). The UX spec gives the field names and the hint of G
 * ("Choose "Not applicable" if this row has no treatment or colour", from the registry); the sentences below it does not give are the developer's, to be ruled by the ux-expert, and name no rate,
 * price or formula (UX-24). In a module of its own, with the two controls: the part form's fields are fetched after the page is up, so none of these words is in the first load (NFR-009, ADR-016).
 */

/** The label of the multi-select, the hint under it, and what its trigger says while nothing is chosen. */
export const SURFACE_LABEL = 'Surface treatments';
export const SURFACE_HINT = 'Choose every treatment this part needs. Choose none if it needs none.';
export const SURFACE_NONE_SELECTED = 'None selected';
/** The trigger's words: how many are chosen and which, in the order of the list ("2 selected: Primer, Foam"). */
export const surfaceSelectedText = (names: ReadonlyArray<string>): string => (names.length === 0 ? SURFACE_NONE_SELECTED : `${names.length} selected: ${names.join(', ')}`);

/** Treatment / Color: the drop-down's first (empty) choice, the state while the list is read, the words for a stored treatment that is no longer listed, and the box of "Other". */
export const TREATMENT_PLACEHOLDER = 'Choose a treatment or colour';
export const TREATMENT_LOADING = 'Loading the treatments';
export const treatmentNoLongerListed = (words: string): string => `${words} (no longer listed)`;
export const TREATMENT_OTHER_LABEL = 'Other treatment or colour';
/** Under the field when Calculate found it blank, and when the list could not be read. */
export const TREATMENT_MISSING_MESSAGE = 'Choose a treatment or colour.';
export const TREATMENT_LOAD_FAILED = 'We could not load the treatments.';
