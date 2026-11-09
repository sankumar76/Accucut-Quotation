import { afterEach, describe, expect, it, vi } from 'vitest';

import { focusOpener, type Opener } from '../../src/components/features/masters/process-opener';

/**
 * DEF-020 (AQP-235): when the list cannot be read right after a saved change, the load error title takes focus, and the close handler of the
 * dialog that was just saved must not move it to the page heading. The helper is the one place both masters screens (SCR-11, SCR-13) return
 * focus from, so it is tested here with a stand-in for the page; the browser check is in tests/e2e/aqp-122-qa.spec.ts.
 */

const OPENER: Opener = { itemId: 'row-1', action: 'edit' };

interface FakeElement {
  readonly focus: ReturnType<typeof vi.fn>;
  readonly getClientRects: () => ReadonlyArray<object>;
}

function element(): FakeElement {
  return { focus: vi.fn(), getClientRects: () => [{}] };
}

/** A page with a heading and, when `withButton` is set, the opener's button. */
function stubPage(withButton: boolean): { heading: FakeElement; button: FakeElement } {
  const heading = element();
  const button = element();
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.stubGlobal('HTMLButtonElement', class {});
  vi.stubGlobal('document', {
    querySelector: (selector: string) => (selector === 'main h1' ? heading : null),
    querySelectorAll: () => (withButton ? [button] : []),
  });
  return { heading, button };
}

describe('focusOpener (DEF-020)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns focus to the button that opened the dialog', () => {
    const { heading, button } = stubPage(true);
    focusOpener(OPENER);
    expect(button.focus).toHaveBeenCalledTimes(1);
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('moves focus to the page heading when the opener is gone', () => {
    const { heading } = stubPage(false);
    focusOpener(OPENER);
    expect(heading.focus).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where it is when the list could not be read again: the load error owns it, with or without the opener', () => {
    for (const withButton of [true, false]) {
      const { heading, button } = stubPage(withButton);
      focusOpener(OPENER, true);
      expect(heading.focus).not.toHaveBeenCalled();
      expect(button.focus).not.toHaveBeenCalled();
    }
  });
});
