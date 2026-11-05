import { Lock, Search, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { assertNever } from '@/lib/assert-never';
import { HOME_PATH } from '@/lib/auth/return-path';

/**
 * SCR-26, the system pages (STORY-01.02 AC-8): no access, not found and server error. One component draws all three, so
 * the words and the look are in one place and a page frame, a boundary file or the design-system page can show the same
 * card. Each has one clear action. The "no access" card takes no input at all: it is the same for every role and for
 * every page that was asked for, so it cannot show what a page holds or whether it exists (UX-22, CR-33). The error card
 * shows a reference the person can read out, and never a technical detail.
 */

export type SystemPageKind = 'forbidden' | 'not-found' | 'error';

export const NO_ACCESS_TITLE = 'You do not have access to this page';
export const NO_ACCESS_TEXT = 'Your role does not include this page. If you think it should, ask the Admin.';
export const NOT_FOUND_TITLE = 'We could not find that page';
export const NOT_FOUND_TEXT = 'The link may be old or mistyped.';
export const NOT_FOUND_MENU_TEXT = 'Use the menu to find what you need.';
export const ERROR_TITLE = 'Something went wrong on our side';
export const ERROR_TEXT = 'Your work is saved up to your last save. Try again in a moment.';
export const ERROR_REFERENCE_TEXT = 'If it keeps happening, give the Admin this reference:';
export const HOME_ACTION_LABEL = 'Go to your tasks';

/** The reference shown on the error page: `req-` and the digest Next.js gives the failed render, which its server log carries. */
export function errorReference(digest: string | undefined): string {
  return `req-${digest ?? 'unknown'}`;
}

/** The one action of the "no access" and "not found" cards: back to the page every role lands on. */
export function HomeAction() {
  return (
    <Button asChild>
      <Link href={HOME_PATH}>{HOME_ACTION_LABEL}</Link>
    </Button>
  );
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

const TITLE: Readonly<Record<SystemPageKind, string>> = { forbidden: NO_ACCESS_TITLE, 'not-found': NOT_FOUND_TITLE, error: ERROR_TITLE };

function KindIcon({ kind }: Pick<SystemPageCardProps, 'kind'>) {
  switch (kind) {
    case 'forbidden':
      return <Icon icon={Lock} size="state" />;
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
        <span aria-hidden="true" className="flex h-s-7 w-s-7 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <KindIcon kind={kind} />
        </span>
        <h1 tabIndex={-1} className="text-sub font-semibold text-ink">
          {TITLE[kind]}
        </h1>
        <p className="max-w-prose text-ink-2">
          <Words kind={kind} reference={reference} hasMenu={hasMenu} />
        </p>
        {action}
      </div>
    </Card>
  );
}
