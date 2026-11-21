import { describe, expect, it } from 'vitest';

import { estimatePathOf } from '@/lib/tasks/task-link';

/** STORY-09.04 AC-7: the one path an e-mail's "Open the task" link and the queue's row both point to. */
describe('estimatePathOf', () => {
  it('is /estimates/<code>, the page the queue opens', () => {
    expect(estimatePathOf('Q-2026-0042')).toBe('/estimates/Q-2026-0042');
  });

  it('encodes a code so that no character of it can change the path or add a query', () => {
    expect(estimatePathOf('Q/2026?x=1#y')).toBe('/estimates/Q%2F2026%3Fx%3D1%23y');
  });
});
