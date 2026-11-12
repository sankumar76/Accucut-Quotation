import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_ENDED_NOTICE } from '@/lib/auth/session-ended';

/**
 * STORY-01.06 AC-4 and AC-6: SCR-01 in its "Session ended" state. A client that was told the session ended goes to
 * `/sign-in?reason=session-ended`; the page then shows the notice as an alert. Any other value of `reason` shows nothing, and a
 * person who is already signed in is still sent on (STORY-01.01). The form itself is covered in `tests/e2e/sign-in.spec.ts`.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('@/server/auth/session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
// The form is a client component with its own tests; here it only shows what the page handed it.
vi.mock('@/components/features/auth/sign-in-form', () => ({
  SignInForm: ({ returnTo }: { readonly returnTo: string }) => createElement('form', { 'data-return-to': returnTo }),
}));

const { default: SignInPage } = await import('@/app/(public)/sign-in/page');

async function render(query: Record<string, string | string[] | undefined> = {}): Promise<string> {
  return renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve(query) }));
}

beforeEach(() => {
  mocks.getCurrentUser.mockReset();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.redirect.mockClear();
});

describe('AC-4: the "Session ended" state of SCR-01', () => {
  it('says "Your session ended. Sign in again to continue where you left off." as an alert, above the form', async () => {
    const markup = await render({ reason: 'session-ended' });
    expect(SESSION_ENDED_NOTICE).toBe('Your session ended. Sign in again to continue where you left off.');
    expect(markup).toMatch(/role="alert"[^>]*>.*Your session ended\. Sign in again to continue where you left off\./);
    expect(markup.indexOf(SESSION_ENDED_NOTICE)).toBeLessThan(markup.indexOf('<form'));
  });

  it('keeps the heading able to take focus (AC-6), and the page has one h1', async () => {
    const markup = await render({ reason: 'session-ended' });
    expect(markup.match(/<h1\b[^>]*tabindex="-1"[^>]*>Sign in<\/h1>/g)).toHaveLength(1);
  });

  it.each([{}, { reason: 'other' }, { reason: '' }, { reason: ['session-ended', 'x'] }, { reason: 'SESSION-ENDED' }])(
    'shows no notice for %j',
    async (query) => {
      expect(await render(query)).not.toContain(SESSION_ENDED_NOTICE);
    },
  );

  it('the default page has no alert at all (the form shows its own after a failed attempt)', async () => {
    expect(await render()).not.toContain('role="alert"');
  });

  it('AC-3: a return address next to the state is handed to the form, and anything that is not a page of this portal becomes home', async () => {
    expect(await render({ reason: 'session-ended', callbackUrl: '/users?tab=a' })).toContain('data-return-to="/users?tab=a"');
    for (const evil of ['https://evil.example/x', '//evil.example/x', '/\\evil.example', '/api/v1/me']) {
      expect(await render({ reason: 'session-ended', callbackUrl: evil })).toContain('data-return-to="/queue"');
    }
    expect(await render({ reason: 'session-ended' })).toContain('data-return-to="/queue"');
  });

  it('a person who is already signed in is sent on to the page they were headed for, notice or not', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u' });
    await expect(render({ reason: 'session-ended', callbackUrl: '/users' })).rejects.toThrow('NEXT_REDIRECT:/users');
    await expect(render({ reason: 'session-ended', callbackUrl: 'https://evil.example' })).rejects.toThrow('NEXT_REDIRECT:/queue');
  });
});
