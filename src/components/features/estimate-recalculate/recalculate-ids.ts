/**
 * The one name the review's action bar and the Recalculate button share (STORY-06.04). It lives in a file of its own, **not** in the button's file: the button is a client component, and a server component that
 * imports a value from a client file gets a reference to it and not the value, so the bar could not use it as an `id`.
 */

/** The element focus moves to when the press worked and the button goes away: the "Calculated ..." line of the bar, which carries `tabIndex={-1}`. */
export const CALCULATED_LINE_ID = 'review-calculated';
