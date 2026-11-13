import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { createCustomerBodySchema, customerSchema, customersResponseSchema } from '@/server/views/schemas/customers';

const CREATED = 201;

/** `GET /api/v1/customers` (STORY-02.02 AC-1): every listed customer for SCR-12, with how many of its rates differ from the defaults. Admin only; the role check runs before anything is read. */
export const GET = withRoute({
  route: '/api/v1/customers',
  method: 'GET',
  output: customersResponseSchema,
  handler: async () => ({ customers: await getMastersService().listCustomers() }),
});

/**
 * `POST /api/v1/customers` (AC-1, AC-6): adds a customer with a rate for every Process Master item at its current default, and records who did it. A name that
 * is blank, too long or taken, or an e-mail address that does not look like one, is 422 with the field named; nothing is stored.
 */
export const POST = withRoute({
  route: '/api/v1/customers',
  method: 'POST',
  status: CREATED,
  body: createCustomerBodySchema,
  output: customerSchema,
  handler: ({ user, requestId, body }) =>
    getMastersService().createCustomer(
      { actorId: user.id, actorLabel: user.name, requestId },
      { name: body.name, phone: body.phone ?? null, email: body.email ?? null, address: body.address ?? null },
    ),
});
