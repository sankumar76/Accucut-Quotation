import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FormulaEditorScreen } from '@/components/features/config/formula-editor-screen';
import { FORMULA_EDITOR_META_DESCRIPTION, FORMULA_EDITOR_TITLE } from '@/components/features/config/formula-editor-texts';
import { authorizePage } from '@/server/http/page-access';

/** No field name, column or formula in the tab title (architecture section 8, FR-089). */
export const metadata: Metadata = { title: FORMULA_EDITOR_TITLE, description: FORMULA_EDITOR_META_DESCRIPTION };

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** A field ID is a UUID. Anything else names no field, so nothing is asked for it. */
const FIELD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SCR-18 "Formula editor" at `/config/fields/<id>/formula` (STORY-08.02 AC-1, AC-7): the Admin edits one field's formula. The manifest row lists the Admin alone, so `authorizePage` sends a signed-out visitor to the
 * sign-in page and answers a Lead and an Engineer with SCR-26 and HTTP 403 **before the address is looked at** (CR-33). A formula and the rate names in it are Restricted (NFR-002), so the page reads none of them:
 * the screen asks the Admin-only routes after it has opened. An address that is no UUID is the same SCR-26 "not found" with HTTP 404; a UUID that is no field, or a field with no formula, is the screen's own state.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (QLT-72, `tests/security/loading-boundaries.test.ts`).
 */
export default async function FormulaEditorPage({ params }: PageProps) {
  await authorizePage('/config/fields/[id]/formula');
  const { id } = await params;
  if (!FIELD_ID.test(id)) notFound();
  return <FormulaEditorScreen fieldId={id} />;
}
