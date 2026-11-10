import { afterEach, describe, expect, it, vi } from 'vitest';

import { focusOpener, type Opener } from '../../src/components/features/masters/process-opener';

/**
 * DEF-020 (AQP-235): when the list cannot be read right after a saved change, the load error title takes focus, and the close handler of
 * the dialog that was just saved must not move it to the page heading. QLT-01: but when the dialog itself held focus while the list was
 * in error, nothing holds focus once it closes, and it must go back to the opener (or the heading), never stay on `<body>`. The helper is
 * the one place both masters screens (SCR-11, SCR-13) return focus from, so it is tested here with a stand-in for the page; the browser
 * checks are in tests/e2e/aqp-122-qa.spec.ts and tests/e2e/process-master.spec.ts.
 */

const OPENER: Opener = { itemId: 'row-1', action: 'edit' };

interface FakeElement {
  readonly focus: ReturnType<typeof vi.fn>;
  readonly getClientRects: () => ReadonlyArray<object>;
}

function element(): FakeElement {
  return { focus: vi.fn(), getClientRects: () => [{}] };
}

type Holder = 'body' | 'load error title';

/** A page with a heading, the opener's button when `withButton` is set, and focus on `<body>` or on the load error title. */
function stubPage(withButton: boolean, holder: Holder): { heading: FakeElement; button: FakeElement } {
  const heading = element();
  const button = element();
  const body = {};
  const title = {};
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.stubGlobal('HTMLButtonElement', class {});
  vi.stubGlobal('document', {
    body,
    activeElement: holder === 'body' ? body : title,
    querySelector: (selector: string) => (selector === 'main h1' ? heading : null),
    querySelectorAll: () => (withButton ? [button] : []),
  });
  return { heading, button };
}

describe('focusOpener (DEF-020, QLT-01)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns focus to the button that opened the dialog', () => {
    const { heading, button } = stubPage(true, 'body');
    focusOpener(OPENER);
    expect(button.focus).toHaveBeenCalledTimes(1);
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('moves focus to the page heading when the opener is gone', () => {
    const { heading } = stubPage(false, 'body');
    focusOpener(OPENER);
    expect(heading.focus).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where it is when the list could not be read again and the load error title holds it, with or without the opener', () => {
    for (const withButton of [true, false]) {
      const { heading, button } = stubPage(withButton, 'load error title');
      focusOpener(OPENER, true);
      expect(heading.focus).not.toHaveBeenCalled();
      expect(button.focus).not.toHaveBeenCalled();
    }
  });

  it('QLT-01: when the list is in error but focus is lost to the body (the dialog held it), returns it to the opener', () => {
    const { heading, button } = stubPage(true, 'body');
    focusOpener(OPENER, true);
    expect(button.focus).toHaveBeenCalledTimes(1);
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('QLT-01: when the list is in error, focus is on the body and the opener is gone, moves it to the page heading', () => {
    const { heading, button } = stubPage(false, 'body');
    focusOpener(OPENER, true);
    expect(heading.focus).toHaveBeenCalledTimes(1);
    expect(button.focus).not.toHaveBeenCalled();
  });
});
