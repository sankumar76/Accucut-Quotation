'use client';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { ReviewFormProps } from './review-form';
import { useLazyComponent } from './use-lazy-component';

/** The form's code: a bare `import()`, so a failed request can be tried again. A type-only import of the props below, so none of the form is in the first load of the review (NFR-009; the ceiling of PRD 0.58). */
const loadForm = () => import('./review-form').then((module) => module.ReviewForm);

/**
 * The shell the Lead's and the Admin's review draws in place of `PartForm` (AQP-488, DEF-131 Stage 1): a server component cannot hand the form functions, and the form's code is not to be in the first load of a
 * page that has not opened it. Until the form's code arrives it draws what the server drew (`review.head`: the row's eyebrow, title and figure line) and a skeleton that is a status, so nothing moves when it
 * arrives (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.6). The words are short and its own, so this file pulls in none of the form's texts. It takes the form's props and holds no figure.
 */
export function LazyPartForm(props: ReviewFormProps) {
  const { Component: Form, failed, retry } = useLazyComponent<ReviewFormProps>(loadForm, true);
  if (Form !== null) return <Form {...props} />;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-s-3">
      {props.review?.head}
      {failed ? (
        <Notice tone="danger" title="We could not load the form">
          <p>Check your connection and try again.</p>
          <Button variant="secondary" className="mt-s-2" onClick={retry}>
            Try again
          </Button>
        </Notice>
      ) : (
        <div role="status" aria-label="Loading the form" className="flex min-w-0 flex-1 flex-col gap-s-3">
          <Skeleton className="h-(--control-h)" />
          <Skeleton className="h-(--control-h)" />
          <Skeleton className="h-(--control-h)" />
        </div>
      )}
    </div>
  );
}
