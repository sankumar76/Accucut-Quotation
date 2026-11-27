import 'server-only';

/**
 * The words of the card of SCR-05 that holds the task's folder, customer, subject and notes (AQP-453, DEF-096; the mock-up `SCR-05.html`). In a module of their own, `server-only`, with the card that draws them:
 * the workspace is a client component, so the words stay out of its first load (NFR-009; PRD 0.65).
 */
export const FOLDER_TITLE = 'Task folder';
export const NO_LINK_NOTE = 'This path has no link. Select it and copy it yourself.';
export const CUSTOMER_LABEL = 'Customer';
export const SUBJECT_LABEL = 'Subject';
/** The line under the customer: who set it, and who can change it (an Engineer cannot; the Lead does on SCR-06). */
export const customerLockLine = (leadName: string): string => `Set by ${leadName}. Only a Lead or Admin can change the customer.`;
