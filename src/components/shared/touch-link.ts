/**
 * The class of a **standalone link that is the way to open a task or a view**: the task code of the queue and "View cost details" of the review (NFR-017 as ruled on 2026-11-24, DEF-079). On a touch layout, that is
 * below 1024 px or with a coarse pointer at any width, such a link is a control, so it is at least 44 px high (`--control-h`) with its text centred in that height; the text size is not touched. With a mouse from 1024 px
 * (`fine-wide:`, the same rule as the 36 px rows of the parts tree) it is the plain inline link it always was, so the desktop layout does not change. A link inside a sentence does not take this class: it is exempt.
 * It is one string so that the rule is written once; Tailwind finds the classes in this file.
 */
export const TOUCH_LINK = 'inline-flex min-h-(--control-h) items-center fine-wide:inline fine-wide:min-h-0';
