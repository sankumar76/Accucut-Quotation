/**
 * The hint under QTY per Assy (FR-029, D-34; UX spec UX-52). It is here and not in the registry because a stored registry version is immutable (NFR-026) and an
 * install that was seeded earlier holds the older hint. The form's definition gives it to the field with the system role `quantity` and to no other, so the browser tells that field by this
 * hint without carrying the form definition (the part form uses it to leave "Use 0" off the words under a blank QTY per Assy: a 0 there is the case STORY-05.12 warns about).
 */
export const QTY_PER_ASSY_HINT = 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.';
