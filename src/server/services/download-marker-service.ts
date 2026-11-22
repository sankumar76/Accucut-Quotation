import { assertNever } from '../../lib/assert-never';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { downloadMarkerOf } from '../../lib/export/download-marker';
import type { DownloadRepository } from '../repositories/download-repository';
import { downloadMarkersSchema, downloadMarkerSchema, markerViewOf, type DownloadMarkersView, type DownloadMarkerView } from '../views/schemas/download-marker';

import type { EstimateViewer } from './estimate-service';

/**
 * What a Lead and an Admin read of an estimate's Excel downloads (STORY-CR01.7E, AQP-402; CR-01 item 7c; FR-111; architecture section 4.12 d): the marker of SCR-06's header and, for a page of the Closed tab, the
 * marker of each task. The marker itself is `lib/export/download-marker.ts`; this service reads its facts and checks who asks.
 *
 * **Restricted** (ADR-008, NFR-002): classed as blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`), and `server-only` code reaches it only through the composition. Who may call is decided
 * before it is reached (the manifest row, `withRoute`, `authorizePage`), and it refuses an Engineer **again before it reads anything**, by name and closed by `assertNever`: a role added one day fails to compile here
 * and is refused at run time. The answers are parsed with their strict schemas, which hold a count, a person's name and an instant and nothing else.
 */

export interface DownloadMarkerService {
  /** The marker of one estimate (SCR-06's header). 403 for an Engineer, before anything is read; 404 for an estimate that does not exist (or an ID that is not one). */
  getMarker(viewer: EstimateViewer, estimateId: string): Promise<DownloadMarkerView>;
  /** The markers of the estimates of these tasks (`GET /api/v1/download-markers`): one entry for each task that exists. 403 for an Engineer, before anything is read. */
  getMarkersOfTasks(viewer: EstimateViewer, taskIds: ReadonlyArray<string>): Promise<DownloadMarkersView>;
}

export interface DownloadMarkerDependencies {
  readonly downloads: Pick<DownloadRepository, 'findMarkerFacts' | 'findMarkerFactsOfTasks'>;
}

/** Before any read, and by name: only the Lead and the Admin are let through (NFR-002). */
function assertMayRead(viewer: EstimateViewer): void {
  switch (viewer.role) {
    case 'ADMIN':
    case 'LEAD':
      return;
    case 'ENGINEER':
      throw new ForbiddenError();
    default:
      return assertNever(viewer.role, 'role');
  }
}

export function createDownloadMarkerService({ downloads }: DownloadMarkerDependencies): DownloadMarkerService {
  return {
    async getMarker(viewer, estimateId) {
      assertMayRead(viewer);
      const facts = await downloads.findMarkerFacts(estimateId);
      if (facts === null) throw new NotFoundError();
      return downloadMarkerSchema.parse(markerViewOf(downloadMarkerOf(facts)));
    },

    async getMarkersOfTasks(viewer, taskIds) {
      assertMayRead(viewer);
      const found = await downloads.findMarkerFactsOfTasks(taskIds);
      return downloadMarkersSchema.parse({ markers: found.map(({ taskId, facts }) => ({ taskId, marker: markerViewOf(downloadMarkerOf(facts)) })) });
    },
  };
}
