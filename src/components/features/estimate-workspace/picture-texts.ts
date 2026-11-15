import { kilobytesOf } from '@/lib/images/picture-rules';

/**
 * The words of the picture field (STORY-05.07; UX spec SCR-05 "Content and microcopy", "States": Picture too large). They live here and not in `estimate-texts.ts` because they are used by
 * the picture control alone, which is fetched when the form opens (NFR-009: `/estimates/[code]` has no room left in its first load). The file name in a message is display text, shown as
 * text and made safe by the server before it is stored. The limit and the refusals' own sentences are `lib/images/picture-rules.ts`'s, so the screen and the server say the same.
 */

export const PICTURE_OPTIONAL = 'Optional';
export const pictureGroupLabel = (fieldLabel: string): string => `${fieldLabel} picture`;
export const NO_PICTURE = 'No picture';
export const PROMPT_BEFORE = 'Paste, drop a picture here, or ';
export const CHOOSE_A_FILE = 'choose a file';
export const CHOOSE_A_FILE_BUTTON = 'Choose a file';
export const PASTE_HINT = 'Ctrl+V pastes a copied picture.';
export const PHONE_HINT = 'On a phone, choose a file to take a photo or pick from the gallery.';
export const REPLACE = 'Replace';
export const REMOVE = 'Remove';
export const ADDING = 'Adding the picture';
export const REMOVING = 'Removing the picture';
export const PICTURE_ADDED = 'Picture added.';
export const PICTURE_REPLACED = 'Picture replaced.';
export const PICTURE_REMOVED = 'Picture removed.';
export const PICTURE_CHANGED_NOTICE = 'This part was changed by someone else. It has been reloaded. Check it and try again.';
export const pictureAlt = (fileName: string): string => `Picture of the part: ${fileName}`;
export const sizeText = (bytes: number): string => `${String(kilobytesOf(bytes))} KB`;
