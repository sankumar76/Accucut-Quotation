/**
 * What the Lead's review page hands to the part form as props (DEF-141, DL-455): the four answers the form would otherwise fetch from the browser after hydration, **as the routes send them**:
 * the body of `GET /estimates/{id}/form`, of `GET /estimates/{id}/nodes/{nodeId}`, of `GET /options/materials` and of `GET /options/treatments`. The server page builds them with the same code, the same
 * services and the same strict schemas as those routes (`src/server/views/part-form-bodies.ts`), and the form reads them with the same readers as it reads an answer (`form-client.ts`,
 * `treatment-options-client.ts`), so the shapes are the same and nothing is added. They are plain data, so a server component may hand them over.
 *
 * A seed is the start of the form, not its life: the form reads it once for the part it names, and a read after that (Try again, a conflict, a part chosen that the seed does not name) goes to the
 * server as it always did. The Engineer's workspace passes none.
 */
export interface PartFormSeed {
  readonly estimateId: string;
  /** The part the `part` body is for. */
  readonly partId: string;
  readonly form: unknown;
  readonly part: unknown;
  readonly materials: unknown;
  readonly treatments: unknown;
}
