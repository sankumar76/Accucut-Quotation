/**
 * When the review page is drawn again after a Lead's or an Admin's save (DEF-131 stage 2; architecture note 6a A-7): **once, when the figures go from current to cleared**. The first real save of a part whose figures
 * are current clears every calculated figure on the server, so the page asks to be read again to show "Cleared" and the Recalculate button. Every later save changes no figure on the page, so none asks again. After
 * a Recalculate the figures are current once more, and the next edit session asks once more. Plain logic, no browser: the island tells it what it knows.
 */
export interface ClearedRefresh {
  /** A save changed the part while the figures were (`figuresCurrent`) or were not current as the page was drawn. True when the page should be drawn again now. */
  wrote(figuresCurrent: boolean): boolean;
  /** What the page says now about its figures, after each draw. A change from not current to current (a Recalculate worked) lets the next edit ask again. */
  sync(figuresCurrent: boolean): void;
}

export function createClearedRefresh(): ClearedRefresh {
  let asked = false;
  let seen: boolean | null = null;
  return {
    wrote(figuresCurrent) {
      if (!figuresCurrent || asked) return false;
      asked = true;
      return true;
    },
    sync(figuresCurrent) {
      if (seen === false && figuresCurrent) asked = false;
      seen = figuresCurrent;
    },
  };
}
