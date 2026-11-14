import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

import { REVIEW_CUSTOMER_LABEL, REVIEW_NO_CUSTOMER } from './estimate-texts';
import { WorkspaceHeader, type WorkspaceHeaderView } from './workspace-header';

/**
 * What a Lead or an Admin sees at `/estimates/<code>` until STORY-06.02 builds SCR-06 (STORY-05.01, assumption A-1): the task's header and the customer, as text.
 * There is no form, no tree and no figure here, and no script: the page is the same header the Engineer has, plus one line.
 */

export interface ReviewHeaderProps {
  readonly header: WorkspaceHeaderView;
  readonly customer: { readonly id: string; readonly name: string } | null;
}

export function ReviewHeader({ header, customer }: ReviewHeaderProps) {
  return (
    <>
      <WorkspaceHeader view={header} />
      <Card>
        <CardContent>
          <p className={cn('text-body', BREAK_LONG_NAMES)}>
            <strong>{`${REVIEW_CUSTOMER_LABEL}: `}</strong>
            {customer === null ? REVIEW_NO_CUSTOMER : customer.name}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
