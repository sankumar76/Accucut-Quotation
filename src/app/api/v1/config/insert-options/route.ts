import { getConfigStructureService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { insertOptionsAnswerSchema } from '@/server/views/schemas/config-structure';

/**
 * `GET /api/v1/config/insert-options` (STORY-08.03 AC-1, AC-2): what SCR-19 offers: the columns to insert after (and which may be watched), the sections of the Engineer's form, the stages with their sub-headings, the
 * number formats the worksheet already uses, and the number of the version the wizard is opened on (the base of the save). The Admin alone; names and structure only, no formula, rate or figure.
 */
export const GET = withRoute({
  route: '/api/v1/config/insert-options',
  method: 'GET',
  output: insertOptionsAnswerSchema,
  handler: async ({ user, requestId }) => {
    const options = await getConfigStructureService().getInsertOptions({ user, requestId });
    return {
      version: options.version,
      columns: [...options.columns],
      sections: [...options.sections],
      stages: options.stages.map((stage) => ({ ...stage, subHeadings: [...stage.subHeadings] })),
      numberFormats: [...options.numberFormats],
    };
  },
});
