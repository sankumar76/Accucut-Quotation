import { createAuditRepository } from '../../src/server/repositories/audit-repository';
import type { PrismaClient } from '../../src/server/repositories/prisma-client';
import { createAuditService, type AuditContext, type AuditService } from '../../src/server/services/audit-service';

/**
 * Who is changing an estimate's customer, for the tests that call `EstimateService.setCustomer` (CR-01 item 6, AQP-390): the audit context the route builds from the session (the person's ID and
 * name, and the request), here made from the viewer the test already has. The name and the request ID are invented.
 */
export function changeContext(viewer: { readonly id: string }): AuditContext {
  return { actorId: viewer.id, actorLabel: 'Invented Lead', requestId: 'req-customer-test' };
}

/** The real audit service over a test database, for an estimate service that must write the entry of a customer change in its own transaction. */
export function auditFor(db: { readonly prisma: PrismaClient }): AuditService {
  return createAuditService({ audit: createAuditRepository(db.prisma) });
}
