'use client';

import type { ReactNode } from 'react';

import { useLazyComponent } from '../estimate-workspace/use-lazy-component';

import type { ReviewTreeEditorProps } from './review-tree-editor';

/** The island's code: a bare `import()` behind the type-only import above, so none of it is in the scripts the page names (NFR-009; the budget counts what the HTML names). Asked for as soon as the shell has mounted. */
const loadEditor = () => import('./review-tree-editor').then((module) => module.ReviewTreeEditor);

/**
 * The thin shell between the review page and the editing island (DEF-131 stage 2T; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7 (c)). The page draws the read-only tree and the inputs block of the open row on the
 * server (`children`), so the first paint is the one the Lead had before editing existed, with every figure; as soon as the island's code has arrived it takes their place, starting from the same row. If the code does not
 * come the read-only page stays as it was drawn (the first load of this route has no room for a line that says so). The shell holds no figure and no function of the page's: it passes the island its props and nothing else.
 */
export function ReviewEditShell({ children, ...island }: ReviewTreeEditorProps & { readonly children: ReactNode }) {
  const { Component: Editor } = useLazyComponent<ReviewTreeEditorProps>(loadEditor, true);
  return Editor === null ? children : <Editor {...island} />;
}
