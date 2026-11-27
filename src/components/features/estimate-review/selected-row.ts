/**
 * The row whose inputs the Lead's view shows (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.1, RO-16): the row of the address (`?row=<Sl. No>`), or the first row of the tree when there is
 * no `row` or it is not in the tree (no error page, no notice); `null` for an estimate with no rows, which has no block. The address is the person's choice and is only ever compared with the rows the server
 * holds: nothing in it is looked up or drawn as it came.
 */
export function selectedRow<T extends { readonly slNo: string }>(nodes: ReadonlyArray<T>, row: string | undefined): T | null {
  if (row !== undefined && row !== '') {
    const found = nodes.find((node) => node.slNo === row);
    if (found !== undefined) return found;
  }
  return nodes[0] ?? null;
}
