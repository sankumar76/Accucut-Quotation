import { describe, expect, it } from 'vitest';

import { saveDraft } from '@/lib/estimates/save-draft';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * STORY-05.08 AC-1, AC-5: Save draft is no save path of its own. It asks every part form to send again what it shows (`flush`, which goes through the form's one save, so a value that is the same after
 * normalisation sends nothing, AC-2) and then waits for the saves with the gate that Calculate waits on. It says "saved" only when no field shows a value that is not saved. Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000e1';
const NOW = new Date('2026-11-06T05:12:00.000Z');

describe('AC-1: Save draft says saved only when nothing is left unsaved', () => {
  it('with nothing typed it is saved at once, at the time of the clock', async () => {
    await expect(saveDraft(createSaveGate(), () => NOW)).resolves.toEqual({ saved: true, at: NOW });
  });

  it('reads the real clock when it is not given one', async () => {
    const before = Date.now();
    const result = await saveDraft(createSaveGate());
    expect(result.saved && result.at.getTime() >= before).toBe(true);
  });

  it('asks the part form to send again first, then waits for the saves it starts', async () => {
    const gate = createSaveGate();
    const events: string[] = [];
    let finish: () => void = () => undefined;
    gate.offerFlush(() => {
      events.push('flush');
      gate.track(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
    });
    const pending = saveDraft(gate, () => NOW).then((result) => events.push(result.saved ? 'saved' : 'not saved'));
    await Promise.resolve();
    expect(events).toEqual(['flush']);
    finish();
    await pending;
    expect(events).toEqual(['flush', 'saved']);
  });
});

describe('AC-5: a field that still shows a value that is not saved is told to the person, never called saved', () => {
  it('is not saved when a field is still marked after the saves have finished', async () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    await expect(saveDraft(gate, () => NOW)).resolves.toEqual({ saved: false });
  });

  it('is saved when the flush fixed the field', async () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    gate.offerFlush(() => gate.mark(PART, 'field-j', false));
    await expect(saveDraft(gate, () => NOW)).resolves.toEqual({ saved: true, at: NOW });
  });
});
