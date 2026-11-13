import { MASTER_SHAPES } from '@/server/services/audit-events';

/**
 * One side (`before` or `after`) of a customer's audit entry, read through the strict shape the writer stores by (`MASTER_SHAPES.customer`), so a wrong
 * shape fails with the schema's message and a test needs no type assertion (STORY-02.02, standards finding STD-06).
 */
export const customerSide = (side: unknown) => MASTER_SHAPES.customer.parse(side);
