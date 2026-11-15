import { describe, expect, it, vi } from 'vitest';

import { figureState, figuresWhenCurrent, readFiguresWhenCurrent } from '@/lib/estimate/figure-state';

/**
 * STORY-03.05 (FR-031, FR-100, FR-101; ADR-007; architecture section 4.8): the state of an estimate's figures is read from two counts and never
 * written. `none` before any calculation, `current` while the estimate's `inputs_revision` equals the calculation's, `out-of-date` otherwise.
 * The module has 100 % branch coverage by `vitest.config.ts`.
 */

describe('figureState (architecture section 4.8)', () => {
  it('is none while no calculation is linked, whatever the revision', () => {
    expect(figureState({ inputsRevision: 0, calculationInputsRevision: null })).toBe('none');
    expect(figureState({ inputsRevision: 7, calculationInputsRevision: null })).toBe('none');
  });

  it('is current when the estimate and the calculation have the same revision', () => {
    expect(figureState({ inputsRevision: 3, calculationInputsRevision: 3 })).toBe('current');
    expect(figureState({ inputsRevision: 0, calculationInputsRevision: 0 })).toBe('current');
  });

  it('is out-of-date when an input changed after the calculation', () => {
    expect(figureState({ inputsRevision: 4, calculationInputsRevision: 3 })).toBe('out-of-date');
  });

  it('is out-of-date, never current, when the calculation is somehow ahead of the estimate', () => {
    expect(figureState({ inputsRevision: 2, calculationInputsRevision: 3 })).toBe('out-of-date');
  });
});

describe('figuresWhenCurrent: no calculated value is read unless the state is current (architecture section 4.8)', () => {
  const figures = { totalPrice: '100' };

  it('returns the figures while current', () => {
    expect(figuresWhenCurrent('current', figures)).toBe(figures);
  });

  it.each(['none', 'out-of-date'] as const)('withholds them while %s', (state) => {
    expect(figuresWhenCurrent(state, figures)).toBeNull();
  });
});

describe('readFiguresWhenCurrent: a figure is not even read unless the state is current (STORY-06.02 AC-7)', () => {
  it('reads and returns the figures while current', async () => {
    const read = vi.fn(() => Promise.resolve({ totalPrice: '100' }));
    expect(await readFiguresWhenCurrent('current', read)).toEqual({ totalPrice: '100' });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each(['none', 'out-of-date'] as const)('does not call the read at all while %s, and gives nothing', async (state) => {
    const read = vi.fn(() => Promise.resolve({ totalPrice: '100' }));
    expect(await readFiguresWhenCurrent(state, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('lets a failing read fail the call while current, and never runs it otherwise', async () => {
    await expect(readFiguresWhenCurrent('current', () => Promise.reject(new Error('Invented failure.')))).rejects.toThrow('Invented failure.');
    await expect(readFiguresWhenCurrent('out-of-date', () => Promise.reject(new Error('Invented failure.')))).resolves.toBeNull();
  });
});
