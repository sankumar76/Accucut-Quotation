import { describe, expect, it, vi } from 'vitest';

import type { DownloadMarkerFacts } from '@/lib/export/download-marker';
import type { DownloadRepository } from '@/server/repositories/download-repository';
import { createDownloadMarkerService } from '@/server/services/download-marker-service';

/**
 * STORY-CR01.7E AC-4, AC-6 (NFR-002): the marker service over a fake download repository. The role is refused before anything is read, by name and closed by `assertNever`; the answer is the marker of the pure rule,
 * parsed by its strict schema; an estimate that is not there is a 404. Every name and ID is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const TASK_ID = '00000000-0000-4000-8000-0000000d0e0a';
const APPROVAL = '00000000-0000-4000-8000-0000000ab001';
const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e0001', role: 'ENGINEER' } as const;
const LAST = { approvalId: APPROVAL, byName: 'Invented Lead', at: new Date('2026-11-23T04:30:00.000Z') };

function world(facts: DownloadMarkerFacts | null = { count: 2, last: LAST, latestApprovalId: APPROVAL }) {
  const findMarkerFacts = vi.fn<DownloadRepository['findMarkerFacts']>(() => Promise.resolve(facts));
  const findMarkerFactsOfTasks = vi.fn<DownloadRepository['findMarkerFactsOfTasks']>(() => Promise.resolve(facts === null ? [] : [{ taskId: TASK_ID, facts }]));
  return { service: createDownloadMarkerService({ downloads: { findMarkerFacts, findMarkerFactsOfTasks } }), findMarkerFacts, findMarkerFactsOfTasks };
}

describe('getMarker', () => {
  it.each([LEAD, ADMIN])('answers $role with the marker of the facts: downloaded, with the last person and time as ISO text', async (viewer) => {
    const { service } = world();
    expect(await service.getMarker(viewer, ESTIMATE_ID)).toEqual({ kind: 'downloaded', count: 2, last: { byName: 'Invented Lead', at: '2026-11-23T04:30:00.000Z' } });
  });

  it('answers changed when the approval that stands is not the one in the last file', async () => {
    const { service } = world({ count: 1, last: LAST, latestApprovalId: null });
    expect(await service.getMarker(LEAD, ESTIMATE_ID)).toMatchObject({ kind: 'changed', count: 1 });
  });

  it('answers none when nothing was downloaded', async () => {
    const { service } = world({ count: 0, last: null, latestApprovalId: APPROVAL });
    expect(await service.getMarker(LEAD, ESTIMATE_ID)).toEqual({ kind: 'none' });
  });

  it('is a 404 for an estimate that is not there', async () => {
    const { service } = world(null);
    await expect(service.getMarker(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe('getMarkersOfTasks', () => {
  it('answers one entry for each task that exists, and leaves out one that does not', async () => {
    const { service, findMarkerFactsOfTasks } = world();
    expect(await service.getMarkersOfTasks(LEAD, [TASK_ID])).toEqual({ markers: [{ taskId: TASK_ID, marker: { kind: 'downloaded', count: 2, last: { byName: 'Invented Lead', at: '2026-11-23T04:30:00.000Z' } } }] });
    expect(findMarkerFactsOfTasks).toHaveBeenCalledWith([TASK_ID]);
    expect(await world(null).service.getMarkersOfTasks(ADMIN, [TASK_ID])).toEqual({ markers: [] });
  });
});

describe('AC-6: the role is refused first (NFR-002)', () => {
  it.each(['getMarker', 'getMarkersOfTasks'] as const)('%s refuses an Engineer before anything is read', async (method) => {
    const { service, findMarkerFacts, findMarkerFactsOfTasks } = world();
    const call = method === 'getMarker' ? service.getMarker(ENGINEER, ESTIMATE_ID) : service.getMarkersOfTasks(ENGINEER, [TASK_ID]);
    await expect(call).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    expect(findMarkerFacts).not.toHaveBeenCalled();
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
  });

  it.each(['getMarker', 'getMarkersOfTasks'] as const)('%s refuses a role that does not exist yet, by the same closed list', async (method) => {
    const { service, findMarkerFacts, findMarkerFactsOfTasks } = world();
    const viewer = { id: ESTIMATE_ID, role: 'AUDITOR' as never };
    await expect(method === 'getMarker' ? service.getMarker(viewer, ESTIMATE_ID) : service.getMarkersOfTasks(viewer, [TASK_ID])).rejects.toThrow();
    expect(findMarkerFacts).not.toHaveBeenCalled();
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
  });
});
