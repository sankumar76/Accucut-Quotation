/**
 * The class that lets a long name wrap instead of widening its box (ux-spec 6.0 "Names wrap": `overflow-wrap: anywhere`, however long the
 * value is). It is one string so that the rule is written once; Tailwind finds the class in this file. `Notice` applies it to every notice
 * (AQP-275, DEF-030) and `EmptyState` to every title (AQP-289, DEF-035), so a caller never adds it to either; table cells, dialog titles and
 * descriptions add it where they print a name.
 */
export const BREAK_LONG_NAMES = '[overflow-wrap:anywhere]';
