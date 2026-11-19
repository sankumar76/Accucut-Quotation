import { getConfigStructureService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { insertPreviewAnswerSchema, insertPreviewBodySchema } from '@/server/views/schemas/config-structure';

/**
 * `POST /api/v1/config/fields/preview` (STORY-08.03 AC-1, AC-3, AC-7; FR-075; architecture section 6 "Insert preview"): the letters that change when the chosen field or pair is inserted, including the product's cells
 * (`BL2 → BM2`), and the formula of a new output with its final letters. The Admin alone: `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401, before the body is read for anything.
 * It runs the same pure function as the save, so what is shown is what is stored; a bad label, section, column, default, width, format or formula is the same 422 the save gives. It stores nothing and makes no version.
 */
export const POST = withRoute({
  route: '/api/v1/config/fields/preview',
  method: 'POST',
  body: insertPreviewBodySchema,
  output: insertPreviewAnswerSchema,
  handler: async ({ user, body, requestId }) => {
    const preview = await getConfigStructureService().previewInsert({ user, requestId }, body);
    return {
      baseVersion: preview.baseVersion,
      // The new fields as the Admin reads them; the internal ID of a field that does not exist yet is not part of the answer (the schema is strict).
      inserted: preview.inserted.map(({ letter, label, kind, followsLetter }) => ({ letter, label, kind, followsLetter })),
      moved: preview.moved.map(({ label, from, to }) => ({ label, from, to })),
      productCells: [...preview.productCells],
      formulas: [...preview.formulas],
    };
  },
});
