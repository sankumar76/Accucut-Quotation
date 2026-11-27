import { createAuditRepository } from '../../src/server/repositories/audit-repository';
import type { PrismaClient } from '../../src/server/repositories/prisma-client';
import { createAuditService, type AuditContext, type AuditService } from '../../src/server/services/audit-service';
import type { EstimateService } from '../../src/server/services/estimate-service';

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

/**
 * The estimate service with the audit context a route builds from the session given to every write of a Lead or an Admin that does not name one (DEF-131 stage 2: such a write is traced, and a call with no context is refused), so a
 * test of the rules of the writes (who may, in which status, what is stored) reads as it did. The tests of the trail itself (`input-audit.test.ts`) name the context.
 */
export function withAuditContext(service: EstimateService): EstimateService {
  return {
    ...service,
    saveInputs: (viewer, estimateId, request, audit) => service.saveInputs(viewer, estimateId, request, audit ?? changeContext(viewer)),
    putPicture: (viewer, estimateId, nodeId, upload, audit) => service.putPicture(viewer, estimateId, nodeId, upload, audit ?? changeContext(viewer)),
    removePicture: (viewer, estimateId, nodeId, audit) => service.removePicture(viewer, estimateId, nodeId, audit ?? changeContext(viewer)),
    addPart: (viewer, estimateId, request, audit) => service.addPart(viewer, estimateId, request, audit ?? changeContext(viewer)),
    moveNode: (viewer, estimateId, request, audit) => service.moveNode(viewer, estimateId, request, audit ?? changeContext(viewer)),
    deleteNode: (viewer, estimateId, request, audit) => service.deleteNode(viewer, estimateId, request, audit ?? changeContext(viewer)),
  };
}
