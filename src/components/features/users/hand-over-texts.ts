/**
 * The words of the "Hand over Admin role" dialog of SCR-14 (STORY-01.09 AC-1, AC-2; UX spec SCR-14 "Hand over" and "Hand over: wrong password"). The hint and the wrong-password sentence are the spec's; the rest are the
 * developer's proposal, which the ux-expert rules on at the end review (AC-1). They are fetched with the dialog, on the first press of the button, and are **not** in the first load of `/users` (NFR-009): nothing in the
 * screen's first-load files imports this file, except the label of the button that opens it, which lives in `texts.ts`. A refusal of the server (the 409s, the 429) is said in its own words
 * (`src/lib/users/hand-over.ts`, `src/lib/auth/step-up.ts`) and is not repeated here.
 */

export const HAND_OVER_TITLE = 'Hand over the Admin role?';

/** What the person must know before they confirm: who the role goes to, what they become, and that they are signed out now. */
export const HAND_OVER_WARNING =
  'The person you choose becomes the Admin. You become a Lead and are signed out straight away. The new Admin signs in again to hold the role. There is only ever one Admin.';

export const CHOICE_LABEL = 'New Admin';
export const CHOICE_PLACEHOLDER = 'Choose a person';
export const CHOICE_REQUIRED_MESSAGE = 'Choose the person who becomes the Admin.';
export const NO_ONE_TO_CHOOSE_HINT = 'There is no other active user. Add a user first.';

export const PASSWORD_LABEL = 'Your password';
export const PASSWORD_HINT = 'We ask for your password again because this is the biggest change in the portal.';

export const CANCEL_LABEL = 'Cancel';
export const CONFIRM_LABEL = 'Hand over';
export const CONFIRMING_LABEL = 'Handing over';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was stored: the hand-over may have gone through, in which case the next page the person opens asks them to sign
 * in again.
 */
export const HAND_OVER_UNCONFIRMED = 'We could not confirm the hand-over. Check your connection and try again. If it went through, you will be asked to sign in again.';
