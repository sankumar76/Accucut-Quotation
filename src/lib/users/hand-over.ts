import { STEP_UP_FAILED_MESSAGE } from '../auth/step-up';

/**
 * The words and codes of the Admin hand-over (STORY-01.09; UX spec SCR-14 "Hand over" and "Hand over: wrong password"; architecture section 6 "Hand over Admin").
 * Written once so the server's refusals and the dialog say the same sentence. Pure, so a page may import it (no zod, no server code).
 *
 * The wrong-password sentence is the step-up's own (`STEP_UP_FAILED_MESSAGE`) with the UX spec's "Try again.": the server's 422 carries the first part, and the
 * dialog shows this whole sentence under the field.
 */

/** `POST /api/v1/users/{id}/admin-handover` names the caller as the person to receive the role (409). */
export const CANNOT_HAND_OVER_TO_SELF_CODE = 'CANNOT_HAND_OVER_TO_SELF';
export const CANNOT_HAND_OVER_TO_SELF_MESSAGE = 'You are the Admin already. Choose another person.';

/** The person to receive the role is deactivated (409). */
export const HAND_OVER_TARGET_INACTIVE_CODE = 'HAND_OVER_TARGET_INACTIVE';
export const HAND_OVER_TARGET_INACTIVE_MESSAGE = 'That person is deactivated, so they cannot take the Admin role. Choose another person.';

/** The person to receive the role does not exist (404). */
export const HAND_OVER_TARGET_UNKNOWN_MESSAGE = 'User not found.';

/** The state "Hand over: wrong password" (SCR-14): shown under the password field. */
export const HAND_OVER_WRONG_PASSWORD_MESSAGE = `${STEP_UP_FAILED_MESSAGE} Try again.`;

/**
 * An edit that would take the Admin role from the active Admin or deactivate them, made by someone else (409). Only a hand-over moves the role, so the portal always has an Admin: before the hand-over existed
 * no edit could do this (the Admin cannot edit themself), and a request of the old Admin that waits for a hand-over's row lock must not run afterwards on the new Admin.
 */
export const ADMIN_CANNOT_BE_REMOVED_CODE = 'ADMIN_CANNOT_BE_REMOVED';
export const ADMIN_CANNOT_BE_REMOVED_MESSAGE = 'The Admin cannot be demoted or deactivated here. Hand the Admin role over to another person instead.';
