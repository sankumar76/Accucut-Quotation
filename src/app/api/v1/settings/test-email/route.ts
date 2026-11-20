import { getSettingsService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { testEmailSchema } from '@/server/views/schemas/settings';

/**
 * `POST /api/v1/settings/test-email` (STORY-09.02 AC-4, AC-5, AC-6): sends one test message at once, through the mail transport, to the signed-in Admin's own address and answers that address.
 * Admin only, decided before anything is read. The route takes no body and reads none: the recipient is the address in `users` for the person who pressed the button (`user.id`), never a value
 * from the request, so a body that names another address changes nothing (architecture section 4.7). The sender is the saved one. A refusal by the mail server is a 502 with a class code
 * (`SENDER_NOT_ALLOWED`, `AUTH_FAILED`, `CONNECTION`, `UNKNOWN`) and the generic title: no secret, host or server reply is in any body. No sender saved is a 422 `NO_SENDER`.
 */
export const POST = withRoute({
  route: '/api/v1/settings/test-email',
  method: 'POST',
  output: testEmailSchema,
  handler: ({ user }) => getSettingsService().sendTestEmail(user.id),
});
