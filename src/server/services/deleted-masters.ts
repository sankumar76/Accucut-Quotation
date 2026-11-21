import { ConflictError } from '../../lib/errors';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '../../lib/estimate/calculate-words';
import type { EstimateUnlocking } from '../repositories/estimate-repository';
import type { Transaction } from '../repositories/transaction';

import type { DeletedWords } from './calculation-masters';

/**
 * The one check of "an approved estimate whose customer or material was deleted after the approval" (STORY-06.08 AC-10 and STORY-06.12 AC-9; AQP-306 review SQR-01; architecture sections 4.4 and 4.10), written once for
 * Unlock and Cancel approval so the two cannot drift apart.
 *
 * Call it **under the estimate's row lock and after the status guard**, in the transaction that is about to write. It reads the estimate's customer (`FOR SHARE ... AND deleted_at IS NULL`), then the materials the parts
 * name in ascending ID order (`FOR SHARE`): the lock order of every writer (the estimate, its task, the customer, the materials), so a customer or a material delete, which takes no estimate lock and reads the
 * open estimates after its own row lock, either waits for this transaction or is seen by it, and the two never form a cycle. A customer or a material that was deleted is the 409 `CUSTOMER_DELETED` or
 * `MATERIAL_DELETED` in `words` (the caller's own sentences), and nothing has been written. An estimate with no customer is not affected.
 */
export async function assertCustomerAndMaterialsExist(
  estimates: Pick<EstimateUnlocking, 'findActiveCustomer' | 'lockMaterialsInUse'>,
  estimate: { readonly id: string; readonly customerId: string | null },
  tx: Transaction,
  words: DeletedWords,
): Promise<void> {
  if (estimate.customerId !== null && (await estimates.findActiveCustomer(estimate.customerId, tx)) === null) {
    throw new ConflictError(words.customer, { code: CUSTOMER_DELETED_CODE });
  }
  if ((await estimates.lockMaterialsInUse(estimate.id, tx)).some((material) => material.deleted)) {
    throw new ConflictError(words.material, { code: MATERIAL_DELETED_CODE });
  }
}
