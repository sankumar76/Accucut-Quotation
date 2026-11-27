'use client';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { ReviewFormProps } from './review-form';
import { useLazyComponent } from './use-lazy-component';

/**
 * The form's code: a bare `import()`, so a failed request can be tried again, behind a type-only import of the props, so the autosave, the leave guard and its dialog are not in the first load of the review (NFR-009,
 * ADR-016; `overlay-imports.test.ts` holds a module fetched by `import()` to that). It is asked for as soon as the shell has mounted.
 */
const loadForm = () => import('./review-form').then((module) => module.ReviewForm);

/**
 * The shell the Lead's and the Admin's review draws in place of `PartForm` while the estimate can be corrected (DEF-131 stage 2): the editable form (`ReviewForm`) is fetched after the page is up. Until its code arrives
 * the row's head, drawn above it, is on screen and this draws a skeleton that is a status, so nothing moves when the form arrives. The words are short and its own, so this file pulls in none of the form's texts. It takes
 * the form's props and holds no figure.
 */
export function LazyReviewForm(props: ReviewFormProps) {
  const { Component: Form, failed, retry } = useLazyComponent<ReviewFormProps>(loadForm, true);
  if (Form !== null) return <Form {...props} />;
  if (failed) {
    return (
      <Notice tone="danger" title="We could not load the form">
        <p>Check your connection and try again.</p>
        <Button variant="secondary" className="mt-s-2" onClick={retry}>
          Try again
        </Button>
      </Notice>
    );
  }
  return (
    <div role="status" aria-label="Loading the form" className="flex min-w-0 flex-1 flex-col gap-s-3">
      <Skeleton className="h-(--control-h)" />
      <Skeleton className="h-(--control-h)" />
      <Skeleton className="h-(--control-h)" />
    </div>
  );
}
