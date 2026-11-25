import { Circle, CircleCheck, Contrast, TriangleAlert, type LucideIcon } from 'lucide-react';

import { TREE_ALL_INPUTS, TREE_MISSING_INPUTS, TREE_NO_INPUTS, TREE_SOME_INPUTS } from './estimate-texts';

/** The words of each status (STORY-05.11 AC-4): spoken beside a row's icon, and written beside the same icon in the legend at the foot of the tree. */
export const COMPLETENESS_TEXT = { EMPTY: TREE_NO_INPUTS, PARTIAL: TREE_SOME_INPUTS, COMPLETE: TREE_ALL_INPUTS } as const;

/**
 * The icon of each word (STORY-05.11 AC-4; UX spec SCR-05 "Content": check, half circle, empty circle; DEF-081: a circled check, all three 18 px on one ring): a different shape for each, so the state is never told by colour alone. The icons are decorative
 * (lucide hides one that has no name from assistive technology); the words stay beside them for a screen reader.
 */
export const COMPLETENESS_ICON: Record<keyof typeof COMPLETENESS_TEXT, LucideIcon> = { EMPTY: Circle, PARTIAL: Contrast, COMPLETE: CircleCheck };

/** The ink of each status icon (DEF-081 ruling 6): the three share one outer ring, so the column reads as one set; green for done, the darker grey for half and the lighter grey for none. The shape, not the ink, tells them apart. */
export const COMPLETENESS_INK: Record<keyof typeof COMPLETENESS_TEXT, string> = { EMPTY: 'text-ink-3', PARTIAL: 'text-ink-2', COMPLETE: 'text-success' };

/** The mark of a part Calculate found a missing input in (STORY-05.09), and its ink: the fourth entry of the status legend. */
export const MISSING_ICON: LucideIcon = TriangleAlert;
export const MISSING_INK = 'text-danger';

/** The statuses in the order the legend names them: all, some, none, missing. */
export const STATUS_LEGEND: ReadonlyArray<{ readonly key: string; readonly icon: LucideIcon; readonly ink: string; readonly words: string }> = [
  { key: 'COMPLETE', icon: COMPLETENESS_ICON.COMPLETE, ink: COMPLETENESS_INK.COMPLETE, words: COMPLETENESS_TEXT.COMPLETE },
  { key: 'PARTIAL', icon: COMPLETENESS_ICON.PARTIAL, ink: COMPLETENESS_INK.PARTIAL, words: COMPLETENESS_TEXT.PARTIAL },
  { key: 'EMPTY', icon: COMPLETENESS_ICON.EMPTY, ink: COMPLETENESS_INK.EMPTY, words: COMPLETENESS_TEXT.EMPTY },
  { key: 'MISSING', icon: MISSING_ICON, ink: MISSING_INK, words: TREE_MISSING_INPUTS },
];
