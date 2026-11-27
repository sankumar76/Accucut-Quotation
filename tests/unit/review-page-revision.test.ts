import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/lib/errors';
import type { EstimateViewer } from '@/server/services/estimate-service';

/**
 * DEF-131 stage 2, QLT-806-06: the revision of the part that the review sends with a Lead's or an Admin's save. A part that is gone (deleted meanwhile) gives 0, and the first save then meets the server's own answer; any
 * other fault, a database error, is **not** turned into a 0, which the Lead would meet as a conflict of their own save: it goes on to the route's error boundary and its load-error wording. Every name is invented.
 */

const getNode = vi.fn();
vi.mock('@/server/composition', () => ({
  getEstimateService: () => ({ getNode }),
  getEstimateReviewService: () => ({}),
  getDownloadMarkerService: () => ({}),
}));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { revisionOf } = await import('@/app/(portal)/estimates/[code]/review-page');

const VIEWER = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as EstimateViewer;

beforeEach(() => {
  getNode.mockReset();
});

describe('QLT-806-06: revisionOf', () => {
  it('is the revision the service reads', async () => {
    getNode.mockResolvedValue({ revision: 7 });
    expect(await revisionOf(VIEWER, 'estimate', 'node')).toBe(7);
    expect(getNode).toHaveBeenCalledWith(VIEWER, 'estimate', 'node');
  });

  it('is 0 for a part that is gone (not found), so the first save meets the server\'s own answer', async () => {
    getNode.mockRejectedValue(new NotFoundError());
    expect(await revisionOf(VIEWER, 'estimate', 'node')).toBe(0);
  });

  it.each([new Error('connection refused'), new TypeError('x is not a function')])('does not turn a fault into a 0: %s is thrown on', async (fault) => {
    getNode.mockRejectedValue(fault);
    await expect(revisionOf(VIEWER, 'estimate', 'node')).rejects.toBe(fault);
  });
});
