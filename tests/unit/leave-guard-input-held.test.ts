import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FieldRenderer, type FieldRendererProps } from '@/components/features/estimate-workspace/field-renderer';
import type { FormField } from '@/lib/estimates/form-client';
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
