import { Clock, Lock, Search, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { FocusMainHeading } from '@/components/shared/focus-main-heading';
import { Icon } from '@/components/shared/icon';
import { Card } from '@/components/ui/card';
import { assertNever } from '@/lib/assert-never';

/**
 * SCR-26, the system pages (STORY-01.02 AC-8, STORY-01.06 AC-3): no access, not found, server error and session ended. One component draws all four, so
 * the words and the look are in one place and a page frame, a boundary file or the design-system page can show the same
 * card. Each has one clear action, passed in: the link home is `home-action.tsx` (server only) and the retry button is the
 * error boundary's own, so this module, which the client error boundary imports, carries neither `Button` nor `next/link`
 * (PRF-01, NFR-009). The "no access" card takes no input at all: it is the same for every role and for
 * every page that was asked for, so it cannot show what a page holds or whether it exists (UX-22, CR-33). The error card
 * shows a reference the person can read out, and never a technical detail.
 */

export type SystemPageKind = 'forbidden' | 'not-found' | 'error' | 'session-ended';

export const NO_ACCESS_TITLE = 'You do not have access to this page';
export const NO_ACCESS_TEXT = 'Your role does not include this page. If you think it should, ask the Admin.';
export const NOT_FOUND_TITLE = 'We could not find that page';
export const NOT_FOUND_TEXT = 'The link may be old or mistyped.';
export const NOT_FOUND_MENU_TEXT = 'Use the menu to find what you need.';
export const ERROR_TITLE = 'Something went wrong on our side';
export const ERROR_TEXT = 'Your work is saved up to your last save. Try again in a moment.';
export const ERROR_REFERENCE_TEXT = 'If it keeps happening, give the Admin this reference:';
/** UX spec SCR-26 "session ended" (UX-33) and STORY-01.06 AC-3. */
export const SESSION_ENDED_TITLE = 'Your session ended';
export const SESSION_ENDED_TEXT =
  'Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there.';

/** The reference shown on the error page: `req-` and the digest Next.js gives the failed render, which its server log carries. */
export function errorReference(digest: string | undefined): string {
  return `req-${digest ?? 'unknown'}`;
}

export interface SystemPageCardProps {
  readonly kind: SystemPageKind;
  /** The card's one action. */
  readonly action: ReactNode;
  /** The error card: the reference to read out (`errorReference`). */
  readonly reference?: string | undefined;
  /** The not-found card: whether the page has a menu to point at. The standalone frame has none. */
  readonly hasMenu?: boolean | undefined;
}

function Words({ kind, reference, hasMenu }: Pick<SystemPageCardProps, 'kind' | 'reference' | 'hasMenu'>) {
  switch (kind) {
    case 'forbidden':
      return <>{NO_ACCESS_TEXT}</>;
    case 'session-ended':
      return <>{SESSION_ENDED_TEXT}</>;
    case 'not-found':
      return <>{hasMenu === true ? `${NOT_FOUND_TEXT} ${NOT_FOUND_MENU_TEXT}` : NOT_FOUND_TEXT}</>;
    case 'error':
      return (
        <>
          {ERROR_TEXT}
          {reference === undefined ? null : (
            <>
              {' '}
              {ERROR_REFERENCE_TEXT} <span className="font-mono">{reference}</span>.
            </>
          )}
        </>
      );
    default:
      return assertNever(kind, 'system page kind');
  }
}

const TITLE: Readonly<Record<SystemPageKind, string>> = {
  forbidden: NO_ACCESS_TITLE,
  'not-found': NOT_FOUND_TITLE,
  error: ERROR_TITLE,
  'session-ended': SESSION_ENDED_TITLE,
};

function KindIcon({ kind }: Pick<SystemPageCardProps, 'kind'>) {
  switch (kind) {
    case 'forbidden':
      return <Icon icon={Lock} size="state" />;
    case 'session-ended':
      return <Icon icon={Clock} size="state" />;
    case 'not-found':
      return <Icon icon={Search} size="state" />;
    case 'error':
      return <Icon icon={TriangleAlert} size="state" />;
    default:
      return assertNever(kind, 'system page kind');
  }
}

export function SystemPageCard({ kind, action, reference, hasMenu }: SystemPageCardProps) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-s-3 px-s-5 py-s-7 text-center">
        {kind === 'session-ended' ? <FocusMainHeading /> : null}
        <span aria-hidden="true" className="flex h-s-7 w-s-7 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <KindIcon kind={kind} />
        </span>
        <h1 tabIndex={-1} className="text-sub font-semibold text-ink">
          {TITLE[kind]}
        </h1>
        {/* The session-ended words are an alert: the person did not ask for this page, so a screen reader announces it (STORY-01.06 AC-6). */}
        <p className="max-w-prose text-ink-2" {...(kind === 'session-ended' ? { role: 'alert' } : {})}>
          <Words kind={kind} reference={reference} hasMenu={hasMenu} />
        </p>
        {action}
      </div>
    </Card>
  );
}
