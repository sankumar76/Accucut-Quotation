'use client';

import { useState } from 'react';

import { PartForm, type PartFormProps } from './part-form';
import type { PartReview } from './review-look';

/** What the server hands the review's form: the form's props with the review look it drew (no function, no figure). */
export type ReviewFormProps = Omit<PartFormProps, 'review'> & { readonly review: PartReview };

/**
 * The code the Lead's and the Admin's review loads after the page is up (`LazyPartForm`, AQP-488): the Engineer's own `PartForm`, with the review look. It is a module of its own so that the shell fetches it with a
 * bare `import()` while `PartForm` itself stays a plain import of the Engineer's workspace (the first-load guard, `overlay-imports.test.ts`, holds a module that is fetched by `import()` to that alone), and so that what
 * only the review needs is not in the Engineer's form. A row was chosen after the page was drawn (the part changed under this component): the form's title takes the focus, the choice is said once and the tree folds. The
 * first paint does none of it.
 */
export function ReviewForm({ review, ...props }: ReviewFormProps) {
  const [seen, setSeen] = useState(props.part?.id);
  const [chosen, setChosen] = useState(false);
  if (seen !== props.part?.id) {
    setSeen(props.part?.id);
    setChosen(true);
  }
  return <PartForm {...props} review={{ ...review, chosen }} />;
}
