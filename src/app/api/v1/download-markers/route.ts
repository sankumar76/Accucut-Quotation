import { getDownloadMarkerService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { downloadMarkersQuerySchema, downloadMarkersSchema } from '@/server/views/schemas/download-marker';

/**
 * `GET /api/v1/download-markers?ids=<task id>,<task id>` (STORY-CR01.7E AC-5; CR-01 item 7c; architecture section 4.12 d): the download marker ("Not downloaded", "Downloaded N times", "Changed since download") of
 * the estimate of each task a page of the Closed tab lists, for the Lead and the Admin only. The queue's own answer (`GET /api/v1/tasks`) is one strict schema for every role and carries no marker, so the marker
 * is a route of its own whose manifest row lists no Engineer: an Engineer is refused with the fixed 403 **before the query is read** (CR-33, NFR-002), and the service refuses an Engineer again before it reads. The answer
 * is one strict schema and holds a count, a person's name and an instant for each task: no price, no figure and no ID of an estimate.
 */
export const GET = withRoute({
  route: '/api/v1/download-markers',
  method: 'GET',
  query: downloadMarkersQuerySchema,
  output: downloadMarkersSchema,
  handler: ({ user, query }) => getDownloadMarkerService().getMarkersOfTasks({ id: user.id, role: user.role }, query.ids),
});
