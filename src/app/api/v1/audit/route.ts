import { getAuditService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { auditPageSchema, auditQuerySchema } from '@/server/views/schemas/audit';

/**
 * `GET /api/v1/audit?who=&category=&event=&from=&to=&limit=&cursor=` (STORY-01.07 AC-6, AC-7): a page of the audit log, newest
 * first, and the total. Admin only, and the role is checked before the query is read or anything is looked up (CR-33), so a Lead
 * and an Engineer get the same fixed 403 with no data.
 *
 * Only GET is exported, on purpose: the log has no write route, so Next.js answers PATCH, PUT, DELETE (and POST) with 405. An
 * entry is written by the service that makes the change it records, in that change's transaction, never through the web.
 */
export const GET = withRoute({
  route: '/api/v1/audit',
  method: 'GET',
  query: auditQuerySchema,
  output: auditPageSchema,
  handler: async ({ query }) => {
    const page = await getAuditService().list(query);
    return { ...page, entries: [...page.entries] };
  },
});
