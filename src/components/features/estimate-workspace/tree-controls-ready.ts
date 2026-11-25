/**
 * When the tree-width controls (the handle and the "Tree width" menu) may be fetched (AQP-426, DEF-085, DL-388): once the part form has shown, or when there is nothing to show it for (the tree could not be read, or it
 * has no rows). Their code is lazy, and on a slow network and on a cold development server (the one Stage 12 runs against, on 4 vCPUs) it competes with the form's own code if it is asked for at the same moment: the form
 * first, the controls after.
 */
export function treeControlsReady({ formShown, treeLoadFailed, treeRows }: { readonly formShown: boolean; readonly treeLoadFailed: boolean; readonly treeRows: number | null }): boolean {
  return formShown || treeLoadFailed || treeRows === 0;
}
