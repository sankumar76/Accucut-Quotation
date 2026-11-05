import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock } from '@/components/shared/states';
import { Card } from '@/components/ui/card';

/** SCR-14 "Loading": the title, then grey rows shaped like the list (UX spec section 6.0 "States"). */
export default function UsersLoading() {
  return (
    <>
      <PageHeader title="Users" />
      <Card>
        <SkeletonBlock rows={5} label="Loading users" />
      </Card>
    </>
  );
}
