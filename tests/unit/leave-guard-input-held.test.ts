import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FieldRenderer, type FieldRendererProps } from '@/components/features/estimate-workspace/field-renderer';
import type { FormField } from '@/lib/estimates/form-client';
import { afterLeaveChosen, holdGateForGuard } from '@/lib/estimates/leave-after-refresh';
import { createReviewRefresh } from '@/lib/estimates/review-refresh';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * DL-488 (iv), UX ruling on AQP-506 (comment 13645): while a row write or a repair step of the leave guard is in flight, the part form's fields do not accept input. They are `readonly` with `aria-readonly`
 * (never `disabled`, never `inert`), with no change of look before 300 ms; the one hold the guard sets reaches the form through the save gate the two share. The gate's part is tried here, and the fields as
 * they are drawn (the first paint, no browser). The timing (300 ms), `aria-busy` on the form and the polite line are read in the browser: `tests/e2e/leave-guard-history.spec.ts` (u3). Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000d1';

describe('DL-488 (iv): the hold on the fields travels through the save gate', () => {
  it('starts open, is set and cleared by the guard, and tells its listeners only when it changes', () => {
    const gate = createSaveGate();
    let told = 0;
    const stop = gate.subscribeInputHeld(() => void (told += 1));
    expect(gate.isInputHeld()).toBe(false);
    gate.setInputHeld(true);
    gate.setInputHeld(true);
    expect(gate.isInputHeld()).toBe(true);
    expect(told).toBe(1);
    gate.setInputHeld(false);
    expect(gate.isInputHeld()).toBe(false);
    expect(told).toBe(2);
    stop();
    gate.setInputHeld(true);
    expect(told).toBe(2);
  });

  it('is not the guard\'s dirty state: holding the fields marks nothing as unsaved and keeps no save waiting', async () => {
    const gate = createSaveGate();
    gate.setInputHeld(true);
    expect(gate.isDirty()).toBe(false);
    expect(await gate.settle()).toBe(true);
  });
});

describe('DL-488 (iii): "unsaved in the row on screen" is the fields\' marks, not a save in flight', () => {
  it('a save of another part in flight is dirty, and is no unsaved field', () => {
    const gate = createSaveGate();
    gate.track(new Promise(() => undefined));
    expect(gate.isDirty()).toBe(true);
    expect(gate.hasUnsaved()).toBe(false);
  });

  it('a field that shows a value the server does not hold is unsaved, until it is saved or its part leaves the screen', () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    expect(gate.hasUnsaved()).toBe(true);
    gate.mark(PART, 'field-j', false);
    expect(gate.hasUnsaved()).toBe(false);
    gate.mark(PART, 'field-j', true);
    gate.forget(PART);
    expect(gate.hasUnsaved()).toBe(false);
  });
});

const field = (overrides: Partial<FormField> = {}): FormField => ({
  id: '00000000-0000-4000-8000-00000000e001',
  letter: 'J',
  label: 'Description',
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: null,
  required: false,
  editable: true,
  visibleWhen: null,
  rule: { type: 'text', maxLength: 120, multiline: false },
  ...overrides,
});

const render = (overrides: Partial<FieldRendererProps> = {}, formField: FormField = field()): string =>
  renderToStaticMarkup(createElement(FieldRenderer, { field: formField, text: 'Invented text', error: undefined, editable: true, materials: { status: 'ready', value: [] }, onChange: () => undefined, onCommit: () => undefined, ...overrides }));

describe('DL-488 (iv): a held field is read-only in the frame it is held, and looks the same until 300 ms', () => {
  it('a field that is not held takes input: no readonly, no aria-readonly', () => {
    const markup = render();
    expect(markup).not.toMatch(/\breadonly\b/i);
    expect(markup).not.toContain('aria-readonly');
  });

  it('held: readonly and aria-readonly, never disabled; and it keeps the look of a box that can be typed in (no shaded read-only look yet)', () => {
    const markup = render({ held: true });
    expect(markup).toMatch(/\breadonly\b/i);
    expect(markup).toContain('aria-readonly="true"');
    // The attribute, not the `disabled:` classes every box carries.
    expect(markup).not.toMatch(/\sdisabled(="[^"]*")?[\s>]/);
    expect(markup).toContain('read-only:border-solid');
    expect(markup).toContain('read-only:bg-surface');
  });

  it('held for 300 ms or more: the same attributes, and the shaded read-only look comes', () => {
    const markup = render({ held: true, heldShown: true });
    expect(markup).toMatch(/\breadonly\b/i);
    expect(markup).toContain('aria-readonly="true"');
    expect(markup).not.toContain('read-only:border-solid');
  });

  it('a field that could not be typed in anyway (read-only by its definition) is drawn as it always is, held or not', () => {
    const before = render({}, field({ editable: false }));
    const during = render({ held: true }, field({ editable: false }));
    expect(during).toBe(before);
  });

  it('a long text box is held the same way', () => {
    const markup = render({ held: true }, field({ rule: { type: 'text', maxLength: 500, multiline: true } }));
    expect(markup).toMatch(/<textarea\b[^>]*\breadonly\b/i);
    expect(markup).toContain('aria-readonly="true"');
  });
});

describe('DL-489: the notice of a row write owed for 5 s, and the way out, travel through the same gate', () => {
  it('"too long" is set and cleared by the guard and told to the listeners of the hold, and "Stay on this row" calls what the guard offered', () => {
    const gate = createSaveGate();
    let told = 0;
    gate.subscribeInputHeld(() => void (told += 1));
    expect(gate.isHoldTooLong()).toBe(false);
    gate.setHoldTooLong(true);
    gate.setHoldTooLong(true);
    expect(gate.isHoldTooLong()).toBe(true);
    expect(told).toBe(1);
    const pressed: string[] = [];
    const withdraw = gate.offerStay(() => void pressed.push('stay'));
    gate.stayOnThisRow();
    expect(pressed).toEqual(['stay']);
    withdraw();
    gate.stayOnThisRow();
    expect(pressed).toEqual(['stay']);
    gate.setHoldTooLong(false);
    expect(told).toBe(2);
  });
});

describe('DL-491: the gate says a leave is under way and a refresh of the page is in flight', () => {
  it('"leaving" is set and cleared by the page and told to its listeners only when it changes', () => {
    const gate = createSaveGate();
    let told = 0;
    const stop = gate.subscribeLeaving(() => void (told += 1));
    expect(gate.isLeaving()).toBe(false);
    gate.setLeaving(true);
    gate.setLeaving(true);
    expect(gate.isLeaving()).toBe(true);
    expect(told).toBe(1);
    gate.setLeaving(false);
    expect(told).toBe(2);
    stop();
    gate.setLeaving(true);
    expect(told).toBe(2);
  });

  it('refreshEnded settles at once with no refresh in flight, when the refresh ends, and after the cap if it does not', async () => {
    vi.useFakeTimers();
    try {
      const gate = createSaveGate();
      await expect(gate.refreshEnded(1000)).resolves.toBeUndefined();
      gate.setRefreshing(true);
      let settled = 0;
      void gate.refreshEnded(1000).then(() => void (settled += 1));
      await vi.advanceTimersByTimeAsync(999);
      expect(settled).toBe(0);
      gate.setRefreshing(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(1);
      gate.setRefreshing(true);
      void gate.refreshEnded(1000).then(() => void (settled += 1));
      await vi.advanceTimersByTimeAsync(1000);
      expect(settled).toBe(2);
      expect(gate.isRefreshing()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('QLT-845-32 (DL-491 addendum (7)): the leave flag lasts for one leave only, on a gate that outlives the page', () => {
  const same = { proceed: () => undefined, cancel: () => undefined, samePage: true } as const;
  const away = { proceed: () => undefined, cancel: () => undefined } as const;

  it('it is cleared once the way out has been sent, whether the person stays on the page (a link to another row) or goes', () => {
    const gate = createSaveGate();
    gate.setLeaving(true);
    afterLeaveChosen(gate, same);
    expect(gate.isLeaving()).toBe(false);
    expect(gate.isLeaveAway()).toBe(false);
    gate.setLeaving(true);
    afterLeaveChosen(gate, away);
    expect(gate.isLeaving()).toBe(false);
    expect(gate.isLeaveAway()).toBe(true);
    // The next leave starts afresh.
    gate.setLeaving(true);
    expect(gate.isLeaveAway()).toBe(false);
  });

  it('a guard takes the gate clear and gives it back clear: a flag a former page left set is not carried into the next visit', () => {
    const gate = createSaveGate();
    gate.setLeaving(true);
    const release = holdGateForGuard(gate);
    expect(gate.isLeaving()).toBe(false);
    gate.setLeaving(true);
    release();
    expect(gate.isLeaving()).toBe(false);
  });

  describe('the review\'s refresh (createReviewRefresh) across a leave, a visit elsewhere and a return', () => {
    const runs = (): { count: number; run: () => void } => {
      const state = { count: 0, run: () => void (state.count += 1) };
      return state;
    };

    it('leave, navigate away, come back: the next rename\'s refresh runs', () => {
      vi.useFakeTimers();
      try {
        const gate = createSaveGate();
        const first = runs();
        const page = createReviewRefresh(gate, first.run, 300);
        // A rename's refresh is waiting when the person opens the leave dialog and chooses to leave.
        page.refresh();
        gate.setLeaving(true);
        vi.advanceTimersByTime(1000);
        expect(first.count, 'nothing starts while the leave is under way').toBe(0);
        afterLeaveChosen(gate, away);
        vi.advanceTimersByTime(1000);
        expect(first.count, 'the refresh that was owed is dropped when the leave takes the person away').toBe(0);
        page.dispose();
        // The person comes back (a later visit, with no full load): the guard takes the gate clear, and the next rename's refresh runs.
        const release = holdGateForGuard(gate);
        const second = runs();
        const again = createReviewRefresh(gate, second.run, 300);
        again.refresh();
        vi.advanceTimersByTime(300);
        expect(second.count).toBe(1);
        again.dispose();
        release();
      } finally {
        vi.useRealTimers();
      }
    });

    it('even if a page never gave the flag back, the next guard clears it on the way in and the refresh runs', () => {
      vi.useFakeTimers();
      try {
        const gate = createSaveGate();
        gate.setLeaving(true);
        holdGateForGuard(gate);
        const next = runs();
        const page = createReviewRefresh(gate, next.run, 300);
        page.refresh();
        vi.advanceTimersByTime(300);
        expect(next.count).toBe(1);
        page.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('"Keep editing" runs the refresh that was owed, once; a way out that keeps the person on the page does too', () => {
      vi.useFakeTimers();
      try {
        const gate = createSaveGate();
        const state = runs();
        const page = createReviewRefresh(gate, state.run, 300);
        page.refresh();
        gate.setLeaving(true);
        page.refresh();
        gate.setLeaving(false);
        vi.advanceTimersByTime(300);
        expect(state.count).toBe(1);
        page.refresh();
        gate.setLeaving(true);
        afterLeaveChosen(gate, same);
        vi.advanceTimersByTime(300);
        expect(state.count).toBe(2);
        page.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('asked many times it runs once, and a disposed page runs nothing', () => {
      vi.useFakeTimers();
      try {
        const gate = createSaveGate();
        const state = runs();
        const page = createReviewRefresh(gate, state.run, 300);
        page.refresh();
        page.refresh();
        page.refresh();
        vi.advanceTimersByTime(300);
        expect(state.count).toBe(1);
        page.refresh();
        page.dispose();
        vi.advanceTimersByTime(1000);
        expect(state.count).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
