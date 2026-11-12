import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { ChangePasswordForm } from './change-password-form';
import {
  ACCOUNT_DESCRIPTION,
  ACCOUNT_TITLE,
  MUST_CHANGE_DESCRIPTION,
  MUST_CHANGE_NOTICE_BODY,
  MUST_CHANGE_NOTICE_TITLE,
  MUST_CHANGE_TITLE,
} from './texts';

/**
 * SCR-23 "Account" (STORY-01.05 AC-3, AC-5, AC-7; UX spec section 6, UJ-14): the person's name, e-mail and role as the Admin set them,
 * and the form that changes their own password. For a person who has to set a new password first (the first Admin, or anyone whose
 * password the Admin set or reset, FR-004) it is "Set a new password": the heading, a notice, no profile card; the frame leaves out the
 * side menu (`portal-frame-props.tsx`). A server component: only the form is client code.
 */

export interface AccountScreenProps {
  readonly name: string;
  readonly email: string;
  /** The role as the person reads it: "Admin", "Lead", "Engineer". */
  readonly roleLabel: string;
  readonly mustChange: boolean;
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-s-1 md:flex-row md:gap-s-4">
      <dt className="text-label text-ink-2 md:w-24 md:shrink-0">{label}</dt>
      <dd className="min-w-0 break-all text-ink">{value}</dd>
    </div>
  );
}

export function AccountScreen({ name, email, roleLabel, mustChange }: AccountScreenProps) {
  return (
    <div className="flex w-full max-w-prose flex-col gap-s-4 md:gap-s-5">
      <PageHeader
        title={mustChange ? MUST_CHANGE_TITLE : ACCOUNT_TITLE}
        description={mustChange ? MUST_CHANGE_DESCRIPTION : ACCOUNT_DESCRIPTION}
      />
      {mustChange ? (
        <Notice tone="warn" title={MUST_CHANGE_NOTICE_TITLE} role="status">
          {MUST_CHANGE_NOTICE_BODY}
        </Notice>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-s-3">
              <Detail label="Name" value={name} />
              <Detail label="E-mail" value={email} />
              <Detail label="Role" value={roleLabel} />
            </dl>
          </CardContent>
        </Card>
      )}
      <ChangePasswordForm email={email} mustChange={mustChange} />
    </div>
  );
}
