import { BLOCK_MINUTES } from './change-password';

/**
 * The words of the step-up check (STORY-06.14, ADR-009; SCR-18's password dialog and every protected action use them), written once so the
 * server's problem body and the dialogs say the same sentence. One sentence for every wrong case: it never says whether the password was
 * empty, too long, someone else's or just mistyped. Pure, so a page may import it.
 */

export const STEP_UP_FAILED_MESSAGE = 'That password is not correct.';
export const STEP_UP_LOCKED_MESSAGE = `Too many wrong passwords. Try again in ${BLOCK_MINUTES} minutes.`;
