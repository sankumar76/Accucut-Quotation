import { InsertFieldScreen } from '@/components/features/config/insert-field-screen';
import { INSERT_META_DESCRIPTION, INSERT_TITLE } from '@/components/features/config/insert-field-texts';
import { pageMetadata } from '@/lib/page-metadata';
import { authorizePage } from '@/server/http/page-access';

/** No field name, column or formula in the tab title (architecture section 8, FR-089). */
export const metadata = pageMetadata(INSERT_TITLE, INSERT_META_DESCRIPTION);

interface PageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** A field ID is a UUID. Anything else in `?after=` names no column, so the wizard opens with none chosen. */
const FIELD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SCR-19 "Insert field" at `/config/fields/new?after=<field id>` (STORY-08.03 AC-1, AC-2): the Admin adds an input, an output, or an input with its cost column. The manifest row lists the Admin alone, so
 * `authorizePage` sends a signed-out visitor to the sign-in page and answers a Lead and an Engineer with SCR-26 and HTTP 403 **before the address is looked at** (CR-33). A formula and the rate names in it are
 * Restricted (NFR-002), so the page reads none of them: the screen asks the Admin-only routes after it has opened. `?after=` is read only as a UUID and passed to the screen, which pre-chooses that column when the
 * worksheet has it; a value that is no UUID is ignored.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` runs (QLT-72, `tests/security/loading-boundaries.test.ts`).
 */
export default async function InsertFieldPage({ searchParams }: PageProps) {
  await authorizePage('/config/fields/new');
  const { after } = await searchParams;
  const requested = typeof after === 'string' && FIELD_ID.test(after) ? after : null;
  return <InsertFieldScreen afterId={requested} />;
}
