'use client';

import { UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import { ADMIN_ALREADY_ACTIVE_CODE } from '@/lib/errors';
import { listUsers, updateUser, type UserRow } from '@/lib/users/users-client';

import { findOpenerElement, isOpener, type DialogKind, type Opener } from './opener';
import { dialogFailureTitle, FAILED_ACTIVATE_MESSAGE, FAILED_DIALOGS_MESSAGE, FAILED_REFRESH_MESSAGE, FAILED_REFRESH_TITLE, TRY_AGAIN_BODY } from './texts';
import type { UsersDialogsProps } from './users-dialogs';
import { UsersList, type RowAction } from './users-list';

/**
 * SCR-14 "Users" (STORY-01.04 AC-1, AC-3, AC-4, AC-5, AC-7). It holds the list the server rendered, opens the dialogs (add,
 * edit, reset password, deactivate), activates a person directly, and shows what the server answered. It decides nothing:
 * every rule (one active Admin, no deactivating or re-roling yourself, temporary passwords) is the server's, and this screen
 * puts the server's reason where the person can read it. After a change it asks the server for the list again, so the order
 * and the flags on screen are the server's too.
 *
 * The dialogs are not in the first load of the page (NFR-009, 200 KB per route): they are fetched the first time a button
 * opens one, through the shared first-open loader (architecture section 10, AQP-188), and stay mounted after that. Until the
 * code arrives the pressed button keeps its pressed look and is `aria-busy` (UX spec 7.3.1 rule 11); if it does not arrive a
 * notice says so and the next press tries again. A press made before the page was interactive is not kept (it is not a menu
 * button, and it could not say which person it was for).
 *
 * Focus (UX spec section 8): a dialog is opened from a button, and when it closes focus goes back to that button, or, when
 * the list has changed under it (a person moved down the list), to the same action of the same person.
 */

export interface UsersScreenProps {
  readonly initialUsers: ReadonlyArray<UserRow>;
  readonly currentUserId: string;
}

type ScreenNotice =
  | { readonly tone: 'success'; readonly text: string }
  | { readonly tone: 'danger'; readonly title: string; readonly text: string };

/** The dialogs' code: a bare `import()` that the loader can try again after a failure. */
const loadDialogs = () => import('./users-dialogs').then((module) => module.UsersDialogs);

export function UsersScreen({ initialUsers, currentUserId }: UsersScreenProps) {
  const [users, setUsers] = useState<ReadonlyArray<UserRow>>(initialUsers);
  const [open, setOpen] = useState<DialogKind | null>(null);
  // The people a dialog is about stay set after it closes, so the text does not change while the panel fades out.
  const [target, setTarget] = useState<UserRow | null>(null);
  const [formUser, setFormUser] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<ScreenNotice | null>(null);
  const [adminNotice, setAdminNotice] = useState<{ readonly name: string | null } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pressed, setPressed] = useState<Opener | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const opener = useRef<Opener | null>(null);
  const refocus = useRef<Opener | null>(null);
  const failureNotice = useRef<HTMLDivElement>(null);
  const first = useFirstOpen<UsersDialogsProps>({ id: 'users-dialogs', load: loadDialogs });

  // A list that changed may have moved the button focus returned to: put focus back on it once the new list is drawn.
  useEffect(() => {
    if (refocus.current === null) return;
    findOpenerElement(refocus.current)?.focus();
    refocus.current = null;
  }, [users]);

  // A notice that is off-screen is brought into view; one already in view does not move (UX spec v0.14, SCR-25).
  useEffect(() => {
    if (first.failed) failureNotice.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [first.failed]);

  function openDialog(kind: DialogKind, person: UserRow | null, from: Opener, byKeyboard: boolean): void {
    // A second press while the first is loading does nothing (UX spec 7.3.1 rule 11): no second request, no second target.
    if (first.pending) return;
    opener.current = from;
    setPressed(from);
    setNotice(null);
    setAdminNotice(null);
    setTarget(person);
    if (kind === 'add' || kind === 'edit') setFormUser(person);
    setOpen(kind);
    first.activate(byKeyboard);
  }

  function onRowAction(action: RowAction, person: UserRow, button: HTMLButtonElement, byKeyboard: boolean): void {
    const from: Opener = { userId: person.id, action: button.dataset['action'] ?? action };
    if (action === 'activate') {
      opener.current = from;
      void activate(person);
      return;
    }
    openDialog(action, person, from, byKeyboard);
  }

  function onCloseAutoFocus(event: Event): void {
    // Radix returns focus only to a trigger, and these dialogs have none: the opener is remembered here.
    event.preventDefault();
    if (opener.current !== null) findOpenerElement(opener.current)?.focus();
  }

  /** Reads the list again. The change itself is already saved, so a failure here says so and leaves the list as it was. */
  async function refresh(): Promise<void> {
    refocus.current = opener.current;
    setRefreshing(true);
    const outcome = await listUsers();
    setRefreshing(false);
    if (outcome.status === 'ok') {
      setUsers(outcome.value);
      return;
    }
    refocus.current = null;
    setNotice({ tone: 'danger', title: FAILED_REFRESH_TITLE, text: FAILED_REFRESH_MESSAGE });
  }

  async function saved(text: string): Promise<void> {
    setOpen(null);
    setNotice({ tone: 'success', text });
    await refresh();
  }

  async function activate(person: UserRow): Promise<void> {
    setNotice(null);
    setAdminNotice(null);
    setBusyUserId(person.id);
    const outcome = await updateUser(person.id, { isActive: true });
    setBusyUserId(null);
    if (outcome.status === 'ok') return saved(`${person.name} can sign in again.`);
    if (outcome.status === 'refused' && outcome.code === ADMIN_ALREADY_ACTIVE_CODE) return setAdminNotice({ name: outcome.currentAdminName });
    setNotice({ tone: 'danger', title: FAILED_ACTIVATE_MESSAGE, text: TRY_AGAIN_BODY });
  }

  const Dialogs = first.shown ? first.Overlay : null;

  return (
    <>
      <PageHeader
        title="Users"
        description="Create and deactivate users, set roles and reset passwords. There is exactly one active Admin."
        actions={
          <Button
            data-action="add"
            {...(isOpener(pressed, null, 'add') && first.pending ? { 'aria-busy': true } : {})}
            onClick={(event) => openDialog('add', null, { userId: null, action: 'add' }, event.detail === 0)}
          >
            <Icon icon={UserPlus} />
            Add user
          </Button>
        }
      />
      {first.failed ? (
        <div ref={failureNotice}>
          <Notice tone="danger" title={dialogFailureTitle(open)}>
            {FAILED_DIALOGS_MESSAGE}
          </Notice>
        </div>
      ) : null}
      {adminNotice === null ? null : (
        <Notice tone="danger" title={adminNotice.name === null ? 'There is already an active Admin.' : `There is already an active Admin: ${adminNotice.name}.`}>
          Only one Admin can be active.
        </Notice>
      )}
      {notice === null ? null : notice.tone === 'success' ? (
        <Notice tone="success">{notice.text}</Notice>
      ) : (
        <Notice tone="danger" title={notice.title}>
          {notice.text}
        </Notice>
      )}
      <UsersList
        users={users}
        currentUserId={currentUserId}
        busyUserId={busyUserId}
        refreshing={refreshing}
        pendingOpener={first.pending ? pressed : null}
        onAction={onRowAction}
      />
      {Dialogs === null ? null : (
        <Dialogs
          open={open}
          target={target}
          formUser={formUser}
          currentUserId={currentUserId}
          onClose={() => setOpen(null)}
          onSaved={(text) => void saved(text)}
          onAdminTaken={(name) => setAdminNotice({ name })}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      )}
    </>
  );
}
