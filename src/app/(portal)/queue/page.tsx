import { ListChecks } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { queueTitleFor, type RoleName } from '@/lib/auth/roles';
import { authorizePage } from '@/server/http/page-access';

/** SCR-03's empty-state sentences until the task list exists (STORY-04.02 replaces this page). */
const EMPTY_TITLE: Readonly<Record<RoleName, string>> = {
  ADMIN: 'No open tasks',
  LEAD: 'No open tasks',
  ENGINEER: 'Nothing assigned to you right now',
};
const EMPTY_DESCRIPTION: Readonly<Record<RoleName, string>> = {
  ADMIN: 'Assign a task to an Engineer and it appears here.',
  LEAD: 'Assign a task to an Engineer and it appears here.',
  ENGINEER: 'When a Lead assigns you a task it appears here, with its folder and deadline.',
};

/**
 * Every role's home after sign-in (STORY-01.01 AC-1): "My tasks" for an Engineer, "Task queue" for Lead and Admin.
 * A titled placeholder with SCR-03's empty-state text until story 04.02 builds the list. The page checks the person and
 * their role itself (`authorizePage`, STD-09) and does not rely on the portal layout; the role then picks the words.
 */
export default async function QueuePage() {
  const user = await authorizePage('/queue');
  return (
    <>
      <PageHeader title={queueTitleFor(user.role)} />
      <Card>
        <EmptyState
          icon={<Icon icon={ListChecks} size="state" />}
          title={EMPTY_TITLE[user.role]}
          description={EMPTY_DESCRIPTION[user.role]}
        />
      </Card>
    </>
  );
}
