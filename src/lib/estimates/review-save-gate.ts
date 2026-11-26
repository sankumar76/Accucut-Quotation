import { createSaveGate } from './save-gate';

/**
 * The one save gate of the Lead's and the Admin's review page (DEF-131 stage 2; architecture note lead-admin-input-edit-2026-11-27, 6a A-4). The inputs island registers its saves and its unsaved fields in it, and
 * the Recalculate press waits on it (`recalculate-client.ts`), so a press never reaches the server before the save of the value typed just before it. The two are separate scripts of one page, so the gate is a
 * module of its own that both import: the browser holds one instance of it. It holds nothing about a figure. Plain data and functions, no component, so the button's first load does not carry it (the button
 * fetches `recalculate-client` on its first press, and the island is fetched after the page is up).
 */
export const reviewSaveGate = createSaveGate();

/**
 * Whether the review's Recalculate is running (DEF-131 stage 2T, ED-31). The press sets it (`recalculate-client.ts`) and the tree's editing island reads it, so the tree's buttons say why they are not offered while the
 * figures are being worked out: the server serialises the two anyway (a tree write and a calculation take the same row lock), so this is for the person's sake and not for safety. Plain data, like the gate above.
 */
let calculating = false;
const listeners = new Set<() => void>();
export const reviewCalculating = {
  get: (): boolean => calculating,
  set(next: boolean): void {
    if (next === calculating) return;
    calculating = next;
    for (const listener of [...listeners]) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
