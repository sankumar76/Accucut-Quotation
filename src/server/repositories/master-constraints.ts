import { uniqueViolationOf } from './database-errors';

/**
 * The rules of the database that a write to the Process Master, the Material Master or the Customer Master can break, and the error that says which
 * (STORY-02.01, STORY-02.03, STORY-02.02). Shared by `master-repository.ts`, `material-repository.ts` and `customer-repository.ts`, so none imports another.
 *
 * A name is unique ignoring letter case, and that rule belongs to the database (`uq_process_items_name_lower` and `uq_process_items_name` for the
 * exact spelling; `uq_materials_material_in_drawing_lower` and its exact twin; `uq_customers_name_lower` and its exact twin): a write that repeats a name fails with `MasterConstraintError`
 * whatever the caller checked first, so two requests that race for one name cannot both win.
 */

/** Which of the rules of the database a write broke. */
export type MasterConstraint = 'process-item-name' | 'material-name' | 'customer-name';

/** A write that the database refused because it would repeat a rate's, a material's or a customer's name. */
export class MasterConstraintError extends Error {
  constructor(
    readonly constraint: MasterConstraint,
    options: { readonly cause: unknown },
  ) {
    super(`The write broke the ${constraint} rule.`, options);
    this.name = 'MasterConstraintError';
  }
}

const PROCESS_NAME_CONSTRAINTS: ReadonlyArray<string> = ['name', 'uq_process_items_name', 'uq_process_items_name_lower'];
const MATERIAL_NAME_CONSTRAINTS: ReadonlyArray<string> = ['material_in_drawing', 'uq_materials_material_in_drawing', 'uq_materials_material_in_drawing_lower'];
/** The customers' own index names, and only those: the bare column `name` is the Process rule's (`PROCESS_NAME_CONSTRAINTS`), so it cannot say it is a customer. */
const CUSTOMER_NAME_CONSTRAINTS: ReadonlyArray<string> = ['uq_customers_name', 'uq_customers_name_lower'];

/** The constraint a unique violation names, from the column or the index it names; null for anything else. */
function constraintOf(error: unknown): MasterConstraint | null {
  const names = uniqueViolationOf(error);
  if (names === null) return null;
  // The customers' index names first (STORY-02.02): a violation that names `name` as well as a customers index is a customer's, not a rate's.
  if (names.some((name) => CUSTOMER_NAME_CONSTRAINTS.includes(name))) return 'customer-name';
  if (names.some((name) => PROCESS_NAME_CONSTRAINTS.includes(name))) return 'process-item-name';
  return names.some((name) => MATERIAL_NAME_CONSTRAINTS.includes(name)) ? 'material-name' : null;
}

/** Runs a write and turns the database's refusal of a repeated name into `MasterConstraintError`. Any other failure passes on untouched. */
export async function enforcingConstraints<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = constraintOf(error);
    if (constraint === null) throw error;
    throw new MasterConstraintError(constraint, { cause: error });
  }
}
