import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { exchangeRatesSchema, putExchangeRatesBodySchema } from '@/server/views/schemas/exchange-rates';

/**
 * `GET /api/v1/exchange-rates` (STORY-02.04 AC-1): the two rates, who saved them and when, and the registry letters for the hints. Admin only
 * (BR-004); the role check runs before anything is read, so a Lead, an Engineer and a signed-out caller get the fixed 403 / 401 and no rate
 * (AC-6, BR-003).
 */
export const GET = withRoute({
  route: '/api/v1/exchange-rates',
  method: 'GET',
  output: exchangeRatesSchema,
  handler: () => getMastersService().getExchangeRates(),
});

/**
 * `PUT /api/v1/exchange-rates` (AC-2 to AC-4): saves both rates together and records who did it. The same body gives the same result. A blank,
 * negative, non-numeric or three-decimal value is 422 naming the field, and neither rate changes. One audit entry when a rate changes, none when
 * nothing does.
 */
export const PUT = withRoute({
  route: '/api/v1/exchange-rates',
  method: 'PUT',
  body: putExchangeRatesBodySchema,
  output: exchangeRatesSchema,
  handler: ({ user, requestId, body }) => getMastersService().saveExchangeRates({ actorId: user.id, actorLabel: user.name, requestId }, body),
});
