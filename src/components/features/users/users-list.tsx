'use client';

import { CircleCheck, CircleOff, KeyRound, Pencil, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { roleLabel } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import type { UserRow } from '@/lib/users/users-client';

import { BREAK_LONG_NAMES } from '../masters/process-texts';
import { isOpener, type Opener } from './opener';
import { OWN_PASSWORD_NAME } from './texts';

/**
 * The people of SCR-14 (STORY-01.04 AC-1, AC-4, AC-7): a table from 768 px, where it scrolls inside its own container only,
 * and a card for each person below it. Both carry the same actions with the same names; the row actions of the table are the
 * 36 px icon buttons of dense tables, the cards' are full-size. It decides nothing: it draws the people it is given and tells
 * its parent which action was pressed, with the button, so focus can return to it.
 */

export const OWN_ACCOUNT_NAME = 'You cannot deactivate your own account';

export type RowAction = 'edit' | 'reset' | 'deactivate' | 'activate';

export interface UsersListProps {
  readonly users: ReadonlyArray<UserRow>;
  /** The Admin looking at the list: their own row cannot be deactivated. */
  readonly currentUserId: string;
  /** The ID of the person whose activation is being sent, so its button shows it. */
  readonly busyUserId: string | null;
  /** The list is being read again after a change: the card says it is busy (UX spec section 6.0 "States"). */
  readonly refreshing: boolean;
  /** The button whose dialog is still loading: it keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pendingOpener: Opener | null;
  readonly onAction: (action: RowAction, user: UserRow, opener: HTMLButtonElement, byKeyboard: boolean) => void;
}

function StatusBadge({ user }: { readonly user: UserRow }) {
  return user.isActive ? (
    <Badge tone="success">
      <Icon icon={CircleCheck} size="badge" />
      Active
    </Badge>
  ) : (
    <Badge tone="neutral">
      <Icon icon={CircleOff} size="badge" />
      Deactivated
    </Badge>
  );
}

function RoleText({ user }: { readonly user: UserRow }) {
  return user.role === 'ADMIN' ? <Badge tone="brand">{roleLabel(user.role)}</Badge> : <span>{roleLabel(user.role)}</span>;
}

/** The accessible name of an action: it names the person, so a list of identical icons can be told apart. */
const ACTION_NAMES: Readonly<Record<RowAction, (user: UserRow) => string>> = {
  edit: (user) => `Edit ${user.name}`,
  reset: (user) => `Reset password for ${user.name}`,
  deactivate: (user) => `Deactivate ${user.name}`,
  activate: (user) => `Activate ${user.name}`,
};

function RowActions({ user, currentUserId, busyUserId, pendingOpener, onAction, compact }: UsersListProps & { readonly user: UserRow; readonly compact: boolean }) {
  const own = user.id === currentUserId;
  const toggle: RowAction = user.isActive ? 'deactivate' : 'activate';
  const press = (action: RowAction) => (event: MouseEvent<HTMLButtonElement>) => onAction(action, user, event.currentTarget, event.detail === 0);
  const size = compact ? 'icon-row' : 'default';
  const variant = compact ? 'ghost' : 'secondary';
  // Passed only when true: an explicit `aria-busy={undefined}` would replace the one a `loading` button sets itself.
  const busyFor = (action: string) => (isOpener(pendingOpener, user.id, action) ? ({ 'aria-busy': true } as const) : {});
  const label = (text: string, icon: LucideIcon) => (compact ? <Icon icon={icon} size="large" /> : <><Icon icon={icon} />{text}</>);

  return (
    <div className={compact ? 'flex flex-nowrap items-center justify-end gap-s-2' : 'flex flex-wrap gap-s-2'}>
      <Button variant={variant} size={size} data-action="edit" aria-label={ACTION_NAMES.edit(user)} {...busyFor('edit')} onClick={press('edit')}>
        {label('Edit', Pencil)}
      </Button>
      {own ? (
        // Disabled on screen and refused by the server (STD-01): the Admin's own password is changed with the current one.
        <Button variant={variant} size={size} data-action="reset" disabled aria-label={OWN_PASSWORD_NAME}>
          {label('Reset password', KeyRound)}
        </Button>
      ) : (
        <Button variant={variant} size={size} data-action="reset" aria-label={ACTION_NAMES.reset(user)} {...busyFor('reset')} onClick={press('reset')}>
          {label('Reset password', KeyRound)}
        </Button>
      )}
      {own ? (
        // Disabled on screen and refused by the server (AC-4). The name says why, because a disabled button can not be asked.
        <Button variant={variant} size={size} data-action="deactivate" disabled aria-label={OWN_ACCOUNT_NAME}>
          {label('Deactivate', UserX)}
        </Button>
      ) : (
        <Button
          variant={variant}
          size={size}
          data-action={toggle}
          aria-label={ACTION_NAMES[toggle](user)}
          loading={busyUserId === user.id}
          {...busyFor(toggle)}
          onClick={press(toggle)}
        >
          {busyUserId === user.id ? null : label(user.isActive ? 'Deactivate' : 'Activate', user.isActive ? UserX : UserCheck)}
        </Button>
      )}
    </div>
  );
}

export function UsersList(props: UsersListProps) {
  const { users, refreshing } = props;
  return (
    <Card aria-busy={refreshing || undefined}>
      <div className="hidden md:block">
        <Table regionLabel="Users, scrollable" caption="Users">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-user-id={user.id}>
                <TableCell className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{user.name}</TableCell>
                <TableCell className="break-all text-ink-2">{user.email}</TableCell>
                <TableCell>
                  <RoleText user={user} />
                </TableCell>
                <TableCell>
                  <StatusBadge user={user} />
                </TableCell>
                <TableActionsCell>
                  <RowActions {...props} user={user} compact />
                </TableActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label="Users" className="flex flex-col md:hidden">
        {users.map((user) => (
          <li key={user.id} data-user-id={user.id} className="flex flex-col gap-s-3 border-b border-border p-s-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-s-2">
              <span className="min-w-0 font-semibold break-words text-ink">{user.name}</span>
              <StatusBadge user={user} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-s-2 text-ink-2">
              <span className="min-w-0 break-all">{user.email}</span>
              <span aria-hidden="true">·</span>
              <RoleText user={user} />
            </div>
            <RowActions {...props} user={user} compact={false} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
