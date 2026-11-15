import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { imageParamsSchema, pictureFileSchema } from '@/server/views/schemas';

/**
 * `GET /api/v1/images/{id}` (STORY-05.07 AC-5; architecture sections 6 "Image" and 8; ADR-013): the stored picture of a part, for a plain `<img>`. Only for a person who may open the
 * picture's estimate: the Engineer whose task it is, a Lead or an Admin. A picture that is not theirs and one that does not exist are the same 404 (CR-33), and a signed-out caller gets
 * 401 before anything is looked up. The bytes are sent as they were stored with the **stored** type, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` and
 * `Content-Disposition: inline` with no file name (`file-response.ts`); they are never decoded on the server.
 */
export const GET = withRoute({
  route: '/api/v1/images/[id]',
  method: 'GET',
  params: imageParamsSchema,
  download: true,
  output: pictureFileSchema,
  handler: async ({ user, params }) => {
    const { mime, bytes } = await getEstimateService().getPicture({ id: user.id, role: user.role }, params.id);
    // A copy, so the answer owns its bytes whatever buffer they were read into.
    return { mime, bytes: new Uint8Array(bytes) };
  },
});
