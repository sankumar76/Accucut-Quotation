import { MATERIAL_FIELD_LABELS } from '@/lib/masters/materials';
import { RUPEE } from '@/lib/masters/process-items';

import type { PageNotice } from './process-texts';

/**
 * The words of SCR-13 "Materials and lists", Materials tab, that more than one component says (UX spec section 6, "SCR-13"; the mock-up
 * `docs/03-ux/screens/SCR-13.html`). The messages under the fields are in `src/lib/masters/materials.ts`, where the server's schemas read
 * them too. The words that SCR-11 says for every master (the failure lines, Try again, Clear filters) are SCR-11's, imported where used.
 * The delete states of the mock-up are story 02.07's; the Exchange rates and Treatment / Color tabs are stories 02.04 and 02.05.
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

export const noMaterialMatchTitle = (query: string): string => `No material matches "${query.trim()}"`;
/** The title of the Edit dialog and the accessible name of the button that opens it: it names the material, so a list of identical icons can be told apart. */
export const editMaterialLabel = (name: string): string => `Edit ${name}`;
