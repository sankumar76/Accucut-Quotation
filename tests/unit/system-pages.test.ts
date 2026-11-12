import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeAction } from '@/components/features/system-pages/home-action';
import { RETRY_BUTTON_CLASSES } from '@/components/features/system-pages/retry-button-classes';
import { SignInAgainAction } from '@/components/features/system-pages/sign-in-again-action';
import {
  errorReference,
  ERROR_REFERENCE_TEXT,
  ERROR_TEXT,
  ERROR_TITLE,
  NOT_FOUND_MENU_TEXT,
  NOT_FOUND_TEXT,
  NOT_FOUND_TITLE,
  NO_ACCESS_TEXT,
  NO_ACCESS_TITLE,
  SESSION_ENDED_TEXT,
  SESSION_ENDED_TITLE,
  SystemPageCard,
} from '@/components/features/system-pages/system-page';
import { buttonVariants } from '@/components/ui/button';
import { homeActionLabel, type RoleName } from '@/lib/auth/roles';

// `headers()` is only available inside a request; the page for unauthorized() reads the address the proxy recorded from it.
const mocks = vi.hoisted(() => {
  const state: { returnPath: string | null } = { returnPath: null };
  return state;
});
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers(mocks.returnPath === null ? {} : { 'x-return-path': mocks.returnPath })),
}));

const { default: Unauthorized } = await import('@/app/unauthorized');

/**
 * STORY-01.02 AC-8 (SCR-26, UX spec v0.12): each system page has one clear action; the error page shows a reference and never
 * technical detail; the "no access" page is identical for every request of a role, and its button is named for the role.
 */

const html = (element: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(element);
const noAccess = (role: RoleName | null) => createElement(SystemPageCard, { kind: 'forbidden', action: createElement(HomeAction, { role }) });

describe('AC-8: the three system pages', () => {
  it('"no access" says it in the words of SCR-26 and names no page, role or record', () => {
    const markup = html(noAccess('LEAD'));
    expect(markup).toContain(NO_ACCESS_TITLE);
    expect(markup).toContain(NO_ACCESS_TEXT);
    expect(NO_ACCESS_TITLE).toBe('You do not have access to this page');
    expect(markup).not.toMatch(/estimate|cost|Q-\d{4}|\/users|\/masters|\/config/i);
  });

  it('"not found" points at the menu only where there is a menu', () => {
    const standalone = html(createElement(SystemPageCard, { kind: 'not-found', action: createElement(HomeAction, { role: 'LEAD' }) }));
    const inFrame = html(createElement(SystemPageCard, { kind: 'not-found', hasMenu: true, action: createElement(HomeAction, { role: 'LEAD' }) }));
    expect(standalone).toContain(NOT_FOUND_TITLE);
    expect(standalone).toContain(NOT_FOUND_TEXT);
    expect(standalone).not.toContain(NOT_FOUND_MENU_TEXT);
    expect(inFrame).toContain(NOT_FOUND_MENU_TEXT);
  });

  it('"error" shows a reference of the form req-… and nothing technical', () => {
    const reference = errorReference('1234567890');
    expect(reference).toBe('req-1234567890');
    const markup = html(createElement(SystemPageCard, { kind: 'error', reference, action: createElement('button', null, 'Try again') }));
    expect(markup).toContain(ERROR_TITLE);
    expect(markup).toContain(ERROR_TEXT);
    expect(markup).toContain(ERROR_REFERENCE_TEXT);
    expect(markup).toContain('req-1234567890');
    expect(markup).not.toMatch(/stack|Error:|at \w+\.|node_modules|ECONN/i);
  });

  it('"error" has a reference even when Next.js gave no digest', () => {
    expect(errorReference(undefined)).toBe('req-unknown');
  });

  it('each page has one h1, and one action (a link to the queue, or the retry button)', () => {
    for (const kind of ['forbidden', 'not-found'] as const) {
      const markup = html(createElement(SystemPageCard, { kind, action: createElement(HomeAction, { role: 'ENGINEER' }) }));
      expect(markup.match(/<h1\b/g)).toHaveLength(1);
      expect(markup.match(/<a\b/g)).toHaveLength(1);
      expect(markup).toContain('href="/queue"');
    }
  });

  it('the decorative icon is hidden from assistive technology', () => {
    expect(html(noAccess('ADMIN'))).toContain('aria-hidden="true"');
  });
});

describe('AC-8, UX spec v0.12: the button is named for the viewer\x27s role', () => {
  it.each<[RoleName | null, string]>([
    ['ENGINEER', 'Go to my tasks'],
    ['LEAD', 'Go to the task queue'],
    ['ADMIN', 'Go to the task queue'],
    [null, 'Go to the task list'],
  ])('role %s reads %j', (role, label) => {
    expect(homeActionLabel(role)).toBe(label);
    expect(html(createElement(HomeAction, { role }))).toContain(`>${label}</a>`);
  });

  it('every role goes to the queue (SCR-03), and "Go to your tasks" is not used for anyone', () => {
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN', null] as const) {
      expect(html(createElement(HomeAction, { role }))).toContain('href="/queue"');
      expect(homeActionLabel(role)).not.toBe('Go to your tasks');
    }
  });
});

describe('AC-8: "no access" is the same whatever address was asked for, for the same role', () => {
  it('renders the same markup every time: the card takes no address, so its content cannot show whether one exists (UX-22)', () => {
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN', null] as const) {
      const first = html(noAccess(role));
      for (let attempt = 0; attempt < 5; attempt += 1) expect(html(noAccess(role))).toBe(first);
    }
  });

  it('differs between roles only in the label of the button', () => {
    const strip = (markup: string): string => markup.replace(/>Go to [^<]*</, '>LABEL<');
    expect(strip(html(noAccess('ENGINEER')))).toBe(strip(html(noAccess('ADMIN'))));
    expect(strip(html(noAccess('LEAD')))).toBe(strip(html(noAccess(null))));
    expect(html(noAccess('ENGINEER'))).not.toBe(html(noAccess('LEAD')));
  });
});

describe('STORY-01.06 AC-3: SCR-26 "Session ended"', () => {
  const sessionEnded = (href = '/sign-in') => createElement(SystemPageCard, { kind: 'session-ended', action: createElement(SignInAgainAction, { href }) });

  it('says it in the words of the story and the UX spec (UX-33), and the notice is announced (role="alert")', () => {
    const markup = html(sessionEnded());
    expect(SESSION_ENDED_TITLE).toBe('Your session ended');
    expect(SESSION_ENDED_TEXT).toBe(
      'Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there.',
    );
    expect(markup).toContain(SESSION_ENDED_TITLE);
    expect(markup).toMatch(/<p [^>]*role="alert"[^>]*>Sessions last 12 hours from the time you sign in, so you were signed out\./);
    expect(markup).toContain('Anything you had saved is still there.');
  });

  it('has one h1 that can take focus, one action ("Sign in again") and a hidden icon', () => {
    const markup = html(sessionEnded('/sign-in?callbackUrl=%2Fusers'));
    expect(markup.match(/<h1\b[^>]*tabindex="-1"/g)).toHaveLength(1);
    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).toContain('>Sign in again</a>');
    expect(markup).toContain('href="/sign-in?callbackUrl=%2Fusers"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('the other system pages do not announce themselves: only this one is an alert', () => {
    expect(html(noAccess('ADMIN'))).not.toContain('role="alert"');
  });

  it('shows nothing technical and names no page, role or person', () => {
    expect(html(sessionEnded())).not.toMatch(/stack|Error:|node_modules|req-|estimate|cost|\/users|\/masters/i);
  });
});

describe('STORY-01.06 AC-3: app/unauthorized.tsx, the page Next.js shows for unauthorized()', () => {
  afterEach(() => {
    mocks.returnPath = null;
  });

  async function pageMarkup(): Promise<string> {
    return html(await Unauthorized());
  }

  it('is the standalone frame (skip link, brand, main) around the card, and takes focus to the heading', async () => {
    const markup = await pageMarkup();
    expect(markup).toContain('Skip to main content');
    expect(markup).toContain('<main id="main"');
    expect(markup).toContain(SESSION_ENDED_TITLE);
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
  });

  it('"Sign in again" leads to SCR-01 and keeps the page that was asked for, as the proxy recorded it', async () => {
    mocks.returnPath = '/masters/materials?q=steel';
    expect(await pageMarkup()).toContain('href="/sign-in?callbackUrl=%2Fmasters%2Fmaterials%3Fq%3Dsteel"');
  });

  it('with no recorded address the link is the bare sign-in page', async () => {
    mocks.returnPath = null;
    expect(await pageMarkup()).toContain('href="/sign-in"');
  });

  it.each(['https://evil.example/x', '//evil.example/x', '/\\evil.example', '/api/v1/me', '/sign-in'])(
    'a recorded address that is not a page of this portal (%j) is dropped',
    async (recorded) => {
      mocks.returnPath = recorded;
      const markup = await pageMarkup();
      expect(markup).toContain('href="/sign-in"');
      expect(markup).not.toContain('evil');
    },
  );
});

describe('PRF-01: the error boundary stays light', () => {
  const SRC = 'src';

  /** The modules a file imports, read from its import lines and not from its comments. */
  function importsOf(source: string): string[] {
    return [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)].map((match) => match[1] ?? '');
  }

  function sourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : [path];
    });
  }

  it('the retry button copies the secondary look of the shared Button: every class is one the shared button gives', () => {
    const shared = new Set(buttonVariants({ variant: 'secondary' }).split(/\s+/));
    const copied = RETRY_BUTTON_CLASSES.split(/\s+/);
    const missing = copied.filter((name) => !shared.has(name) && !['h-(--control-h)', 'px-s-4', '[-webkit-touch-callout:none]'].includes(name));
    expect(missing).toEqual([]);
    // And the other way: the rest state, hover and pressed looks of the shared button are all in the copy.
    // (`border-transparent` is the base border; the variant's own border colour wins over it through `cn`, as it does in the copy.)
    const looks = [...shared].filter((name) => !name.startsWith('disabled:') && !name.startsWith('enabled:') && name !== 'border-transparent');
    expect(looks.filter((name) => !copied.includes(name))).toEqual([]);
  });

  it('app/error.tsx imports neither the shared Button, nor next/link, nor the home action', () => {
    const source = readFileSync(join(SRC, 'app', 'error.tsx'), 'utf8');
    expect(importsOf(source)).not.toContain('@/components/ui/button');
    expect(importsOf(source)).not.toContain('next/link');
    expect(importsOf(source).filter((name) => name.includes('home-action'))).toEqual([]);
    expect(source).toContain('<button');
  });

  it('system-page.tsx, which the boundary imports, carries no Button and no link', () => {
    const source = readFileSync(join(SRC, 'components', 'features', 'system-pages', 'system-page.tsx'), 'utf8');
    expect(importsOf(source)).not.toContain('@/components/ui/button');
    expect(importsOf(source)).not.toContain('next/link');
  });

  it('home-action.tsx is server only, and only the not-found and forbidden pages import it', () => {
    expect(readFileSync(join(SRC, 'components', 'features', 'system-pages', 'home-action.tsx'), 'utf8')).toMatch(/^import 'server-only';/);
    const importers = sourceFiles(SRC)
      .filter((file) => importsOf(readFileSync(file, 'utf8')).some((name) => name.endsWith('/home-action')))
      .map((file) => file.split('\\').join('/'))
      .sort();
    expect(importers).toEqual(['src/app/(portal)/forbidden.tsx', 'src/app/(portal)/not-found.tsx', 'src/app/not-found.tsx']);
  });

  it('sign-in-again-action.tsx is server only, and only the "Session ended" page imports it (STORY-01.06)', () => {
    expect(readFileSync(join(SRC, 'components', 'features', 'system-pages', 'sign-in-again-action.tsx'), 'utf8')).toMatch(/^import 'server-only';/);
    const importers = sourceFiles(join(SRC, 'app'))
      .filter((file) => importsOf(readFileSync(file, 'utf8')).some((name) => name.endsWith('/sign-in-again-action')))
      .map((file) => file.split('\\').join('/'));
    expect(importers).toEqual(['src/app/unauthorized.tsx']);
    expect(importsOf(readFileSync(join(SRC, 'app', 'error.tsx'), 'utf8')).filter((name) => name.includes('sign-in-again'))).toEqual([]);
  });
});
