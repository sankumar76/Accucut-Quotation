import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESET_LINK_INVALID_MESSAGE } from '@/lib/auth/password-reset';

/**
 * STORY-01.10 AC-12 (G-2b, UX-AC-G2.6; optional): `/reset-password` for a link that is used, expired, unknown or missing, while e-mail is off, says "This link has already been used or has expired." and
 * "Ask the Admin to reset your password.", with no "Ask for a new link" link, because no link can be sent. With e-mail on the page is as it was. The API text `RESET_LINK_INVALID_MESSAGE` is unchanged.
 */

const mocks = vi.hoisted(() => ({ isLinkUsable: vi.fn() }));

vi.mock('@/server/composition', () => ({ getPasswordResetService: () => ({ isLinkUsable: mocks.isLinkUsable }) }));
vi.mock('@/components/features/auth/reset-password-form', () => ({
  ResetPasswordForm: ({ token }: { readonly token: string }) => createElement('form', { 'data-token': token }),
}));

const { default: ResetPasswordPage } = await import('@/app/(public)/reset-password/page');

async function render(query: Record<string, string | undefined>): Promise<string> {
  return renderToStaticMarkup(await ResetPasswordPage({ searchParams: Promise.resolve(query) }));
}

const TITLE = 'This link has already been used or has expired.';
const OFF_BODY = 'Ask the Admin to reset your password.';
const UNUSABLE: ReadonlyArray<readonly [string, Record<string, string | undefined>, boolean]> = [
  ['an unknown or used link', { token: 'one.two-3' }, false],
  ['an expired link', { token: 'four.five-6' }, false],
  ['a missing token', {}, false],
  ['an empty token', { token: '' }, false],
];

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.isLinkUsable.mockReset();
  mocks.isLinkUsable.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(['off', ''])('AC-12: FEATURE_EMAIL "%s"', (flag) => {
  beforeEach(() => {
    vi.stubEnv('FEATURE_EMAIL', flag);
  });

  it.each(UNUSABLE)('%s shows the title and the plain sentence, and no "Ask for a new link" link', async (_name, query) => {
    const markup = await render(query);
    expect(markup).toContain(TITLE);
    expect(markup).toContain(OFF_BODY);
    expect(markup).not.toContain('Ask for a new link');
    expect(markup).not.toContain('/forgot-password');
    expect(markup).not.toContain('<form');
    expect(markup).toMatch(/role="alert"/);
  });

  it('a link that works still shows the form', async () => {
    mocks.isLinkUsable.mockResolvedValue(true);
    expect(await render({ token: 'seven.eight-9' })).toContain('data-token="seven.eight-9"');
  });
});

describe('AC-12: FEATURE_EMAIL is on', () => {
  beforeEach(() => {
    vi.stubEnv('FEATURE_EMAIL', 'on');
  });

  it.each(UNUSABLE)('%s is as it was: the sentence of the API and the link to ask for a new one', async (_name, query) => {
    const markup = await render(query);
    expect(markup).toContain(RESET_LINK_INVALID_MESSAGE);
    expect(markup).toMatch(/<a\b[^>]*href="\/forgot-password"[^>]*>Ask for a new link<\/a>/);
    expect(markup).not.toContain(OFF_BODY);
  });

  it('the API message is unchanged', () => {
    expect(RESET_LINK_INVALID_MESSAGE).toBe('This link has already been used or has expired. Ask for a new link.');
  });
});
