'use client';

import { Skeleton } from '@/components/ui/skeleton';

import type { ReviewFormProps } from './review-form';
import { useLazyComponent } from './use-lazy-component';

/** The form's code: a bare `import()`, so a failed request can be tried again. A type-only import of the props below, so none of the form is in the first load of the review (NFR-009; the ceiling of PRD 0.58). */
const loadForm = () => import('./review-form').then((module) => module.ReviewForm);

/**
 * The shell the Lead's and the Admin's review draws in place of `PartForm` (AQP-488, DEF-131 Stage 1): a server component cannot hand the form functions, and the form's code is not to be in the first load of a
 * page that has not opened it. Until the form's code arrives it draws what the server drew (`review.head`: the row's eyebrow, title and figure line) and a skeleton that is a status, so nothing moves when it
 * arrives (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.6). The words are short and its own, so this file pulls in none of the form's texts. It takes the form's props and holds no figure. It imports **nothing but
 * the skeleton**: the notice and the button of the failure are plain markup, because the shared `Notice` and `Button` bring their icons and variants into the first load, which is held to 192,500 B (PRD 0.58).
 */
export function LazyPartForm(props: ReviewFormProps) {
  const { Component: Form, failed, retry } = useLazyComponent<ReviewFormProps>(loadForm, true);
  if (Form !== null) return <Form {...props} />;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-s-3">
      {props.review?.head}
      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-s-2 rounded-md border border-danger-line bg-danger-soft p-s-4 text-body text-ink">
          <p className="font-semibold">We could not load the form</p>
          <p>Check your connection and try again.</p>
          <button type="button" onClick={retry} className="inline-flex min-h-(--control-h) items-center rounded-md border border-border-strong bg-surface px-s-4 text-body font-semibold text-ink hover:bg-surface-2">
            Try again
          </button>
        </div>
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
