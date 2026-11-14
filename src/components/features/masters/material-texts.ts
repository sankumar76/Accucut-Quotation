import { RUPEE } from '@/lib/masters/master-rules';
import { MATERIAL_FIELD_LABELS } from '@/lib/masters/materials';

import type { PageNotice } from './master-texts';

/**
 * The words of SCR-13 "Materials and lists", Materials tab, that more than one component says (UX spec section 6, "SCR-13"; the mock-up
 * `docs/03-ux/screens/SCR-13.html`). The messages under the fields are in `src/lib/masters/materials.ts`, where the server's schemas read
 * them too. The words every masters screen says (the failure lines, Try again, Clear filters) are in `master-texts.ts`, imported where used.
 * The delete states of the mock-up (story 02.07) are below; the Exchange rates and Treatment / Color tabs are stories 02.04 and 02.05.
 */

export const MASTERS_TITLE = 'Materials and lists';
export const MASTERS_DESCRIPTION = 'Material prices, exchange rates and the treatment and colour list.';

export const MATERIALS_TAB = 'Materials';
export const TABS_LABEL = 'Lists';

/** The column headings of the table and the labels of a card, as the mock-up writes them: the unit is in the heading, so a cell holds only the number. */
export const PRICE_HEADING = `${MATERIAL_FIELD_LABELS.pricePerKg} (${RUPEE})`;
export const SCRAP_HEADING = `Material-Scrap-Rate (${RUPEE} per kg)`;

export const ADD_MATERIAL = 'Add material';
export const ADDING_MATERIAL = 'Adding material';

export const MATERIAL_SEARCH_LABEL = 'Search materials';
export const MATERIAL_SEARCH_PLACEHOLDER = 'Material in Drawing or Considered';

export const MATERIALS_EMPTY_TITLE = 'No materials yet';
export const MATERIALS_EMPTY_DESCRIPTION = "Add the first material. A part's Material in Drawing is chosen from this list.";
export const MATERIALS_NO_MATCH_DESCRIPTION = 'Check the spelling, or clear the search.';

export const MATERIALS_ERROR_TITLE = 'We could not load the materials';
export const MATERIALS_LOADING_LABEL = 'Loading the materials';

export const FAILED_ADD_MATERIAL_MESSAGE = 'We could not add the material.';
export const FAILED_EDIT_MATERIAL_MESSAGE = 'We could not save the changes.';

/** The sentence under the page header after a change; the audit log keeps the detail (SCR-13 "Saved"). */
export const materialSavedNotice = (name: string, what: 'added' | 'saved'): PageNotice => ({
  tone: 'success',
  text: what === 'saved' ? `${name} saved. The change is in the audit log.` : `${name} was added. The change is in the audit log.`,
});

// ---- The delete dialogs (STORY-02.07 AC-3, AC-7; ux-spec SCR-13 "Delete" and "Delete blocked", the mock-up) --------------------------------------------

export const DELETE_ACTION = 'Delete';
/** The accessible name of the row's Delete button: it names the material, so a list of identical icons can be told apart. */
export const deleteMaterialLabel = (name: string): string => `Delete ${name}`;
export const DELETE_KEEP_MATERIAL = 'Keep material';
export const DELETE_CONFIRM_MATERIAL = 'Delete material';
export const deleteMaterialTitle = (name: string): string => `Delete ${name}?`;
/** The words of the mock-up, and the sentence of the Customers dialog: the portal has no restore, so what is deleted is gone from every screen. */
export const deleteMaterialDescription = (): string =>
  'This material no longer appears in the Material in Drawing list. Estimates that are already calculated keep their figures. You cannot undo this here.';
export const FAILED_DELETE_MATERIAL_MESSAGE = 'We could not delete the material.';
/** Under a failed Delete (nothing was typed): the shared sentence of ux-spec v0.21 section 6.0, which never says "Nothing was changed.". */
export const FAILED_WRITE_BODY = 'Check your connection and try again.';

/** After a delete: one `master.deleted` entry is written with it, so the clause is always true (the pattern of the Treatment / Color tab). */
export const materialDeletedNotice = (name: string): PageNotice => ({ tone: 'success', text: `${name} was deleted. The change is in the audit log.` });

/** The material was deleted elsewhere while the dialog was open (the pattern of ux-spec v0.17): nothing failed and nothing is at risk, so it is not an alert. */
export const materialGoneNotice = (name: string): PageNotice => ({
  tone: 'info',
  title: `${name} was already deleted.`,
  text: 'It was deleted after you opened this list, so there was nothing to delete.',
});

export const noMaterialMatchTitle =(query: string): string => `No material matches "${query.trim()}"`;
/** The title of the Edit dialog and the accessible name of the button that opens it: it names the material, so a list of identical icons can be told apart. */
export const editMaterialLabel = (name: string): string => `Edit ${name}`;
