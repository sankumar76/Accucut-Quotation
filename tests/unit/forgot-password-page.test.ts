import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * STORY-01.10 AC-10 and AC-11a (AQP-428, DEF-083 / AQP-427, G-2; the UX ruling `docs/03-ux/rulings/forgot-password-email-off-2026-11-24.md`, UX-AC-G2.1 to G2.5, G2.7):
 * `/forgot-password` while `FEATURE_EMAIL` is off (absent, empty or `off`) shows the explanation and no form; with it on, the page is as it was. The server decides on
 * each request, the same for everyone, with no call to the forgot API and no account lookup. The form itself is a client component with its own checks; here it only shows that it was rendered.
 */

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock('@/server/auth/session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/components/features/auth/forgot-password-form', () => ({
  ForgotPasswordForm: () => createElement('form', { 'aria-label': 'Request a reset link' }, createElement('input', { name: 'email' }), createElement('button', {}, 'Send reset link')),
}));

const pageModule = await import('@/app/(public)/forgot-password/page');
const ForgotPasswordPage = pageModule.default;

const render = (): string => renderToStaticMarkup(ForgotPasswordPage());

const OFF_COPY = {
  heading: 'Forgot your password?',
  lead: 'Ask the Admin to reset it.',
  title: 'Reset links are not sent by e-mail yet.',
  first: 'The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own.',
  second: 'If you are the Admin, ask Accucut IT.',
  action: 'Back to sign in',
} as const;

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.getCurrentUser.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('AC-10a (G2.1, G2.2, G2.7): the flag is off', () => {
  describe.each([
    ['off', 'off'],
    ['empty', ''],
    ['absent', undefined],
  ])('FEATURE_EMAIL %s', (_name, value) => {
    beforeEach(() => {
      // `stubEnv` first, so `unstubAllEnvs` puts the machine's own value back after the line is removed.
      vi.stubEnv('FEATURE_EMAIL', value ?? 'off');
      if (value === undefined) delete process.env['FEATURE_EMAIL'];
    });

    it('shows the heading, the sentence, the information notice with its two paragraphs, and "Back to sign in" to /sign-in', () => {
      const markup = render();
      expect(markup.match(/<h1\b[^>]*>/g)).toHaveLength(1);
      expect(markup).toMatch(new RegExp(`<h1\\b[^>]*>${OFF_COPY.heading.replace('?', '\\?')}</h1>`));
      expect(markup).toContain(`<p class="text-ink-2">${OFF_COPY.lead}</p>`);
      expect(markup).toContain(OFF_COPY.title);
      expect(markup).toContain(OFF_COPY.first);
      expect(markup).toContain(OFF_COPY.second);
      expect(markup).toMatch(/<a\b[^>]*href="\/sign-in"[^>]*>Back to sign in<\/a>/);
      // The notice comes first, then the action; the title is the notice's bold first line.
      expect(markup.indexOf(OFF_COPY.title)).toBeLessThan(markup.indexOf(OFF_COPY.first));
      expect(markup.indexOf(OFF_COPY.first)).toBeLessThan(markup.indexOf(OFF_COPY.second));
      expect(markup.indexOf(OFF_COPY.second)).toBeLessThan(markup.indexOf(OFF_COPY.action));
    });

    it('has no form, no e-mail field and no "Send reset link"; nothing says or implies a link is on its way', () => {
      const markup = render();
      for (const absent of ['<form', '<input', '<button', 'Send reset link', 'Check your e-mail', 'on its way', 'Enter your e-mail address', 'we will send you']) {
        expect(markup, absent).not.toContain(absent);
      }
    });

    it('has no live region (nothing changes after load) and no script', () => {
      const markup = render();
      expect(markup).not.toMatch(/role="(alert|status)"|aria-live/);
      expect(markup).not.toContain('<script');
    });

    it('is the same on every visit, signed in or out, with no session read, no request and no account lookup (G2.3, FR-001)', () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const first = render();
      mocks.getCurrentUser.mockResolvedValue({ id: 'someone' });
      const second = render();
      expect(second).toBe(first);
      expect(mocks.getCurrentUser).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('a "mail=on" in the address does nothing: the page takes no input at all (G2.5 rule 2)', () => {
    vi.stubEnv('FEATURE_EMAIL', 'off');
    expect(ForgotPasswordPage.length).toBe(0);
    expect(render()).not.toContain('<form');
  });

  it('uses the same instruction as the sign-in page, word for word (G2.7, SC 3.2.6), and leaves the sign-in sentence unchanged', () => {
    const signIn = readFileSync(fileURLToPath(new URL('../../src/components/features/auth/sign-in-form.tsx', import.meta.url)), 'utf8');
    expect(signIn).toContain(`'Forgot your password? ${OFF_COPY.lead}'`);
  });
});

describe('AC-10b (G2.4): the flag is on', () => {
  it('shows the form and the page\'s own sentence, as today, and none of the explanation', () => {
    vi.stubEnv('FEATURE_EMAIL', 'on');
    const markup = render();
    expect(markup).toContain('<form aria-label="Request a reset link">');
    expect(markup).toContain('Send reset link');
    expect(markup).toContain('Enter your e-mail address and we will send you a link to choose a new one.');
    expect(markup).toMatch(/<h1\b[^>]*>Forgot your password\?<\/h1>/);
    for (const absent of [OFF_COPY.title, OFF_COPY.first, OFF_COPY.second, OFF_COPY.lead]) expect(markup, absent).not.toContain(absent);
  });
});

describe('AC-10c (G2.5): the flag is read on each request', () => {
  it('exports dynamic = "force-dynamic", so a production build does not bake the flag in', () => {
    expect(pageModule.dynamic).toBe('force-dynamic');
  });

  it('one loaded page answers for the flag as it is at each render: off, on, off', () => {
    vi.stubEnv('FEATURE_EMAIL', 'off');
    const off = render();
    vi.stubEnv('FEATURE_EMAIL', 'on');
    const on = render();
    vi.stubEnv('FEATURE_EMAIL', 'off');
    const offAgain = render();
    expect(off).toContain('Reset links are not sent by e-mail yet.');
    expect(on).toContain('Send reset link');
    expect(on).not.toContain('Reset links are not sent by e-mail yet.');
    expect(offAgain).toBe(off);
  });
});
