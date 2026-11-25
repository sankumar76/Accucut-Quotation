/**
 * When the tree-width controls (the handle and the "Tree width" menu) may be fetched (AQP-426, DEF-085, DL-388): once the part form has shown, or when there is nothing to show it for (the tree could not be read, or it
 * has no rows). Their code is lazy, and on a slow network and on a cold development server (the one Stage 12 runs against, on 4 vCPUs) it competes with the form's own code if it is asked for at the same moment: the form
 * first, the controls after.
 */
export function treeControlsReady({ formShown, treeLoadFailed, treeRows }: { readonly formShown: boolean; readonly treeLoadFailed: boolean; readonly treeRows: number | null }): boolean {
  return formShown || treeLoadFailed || treeRows === 0;
}

/**
 * The signal the part form gives (`PartForm`'s `onShown`): it has something to show for the part, which is its fields, or the notice that they could not be read (the form's definition failed, or its code did not come):
 * a form that shows its error state has settled too, so the controls are not held back for ever behind it (DL-391 (2)). With no part chosen there is no form to wait for here (the workspace asks the tree).
 */
export function partFormShown({ hasPart, definition, fieldsCodeFailed, fieldsCodeHere }: { readonly hasPart: boolean; readonly definition: 'loading' | 'ready' | 'failed'; readonly fieldsCodeFailed: boolean; readonly fieldsCodeHere: boolean }): boolean {
  return hasPart && (definition === 'failed' || fieldsCodeFailed || (definition === 'ready' && fieldsCodeHere));
}
