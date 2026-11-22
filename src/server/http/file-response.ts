import { z } from 'zod';

import { attachmentDisposition } from './content-disposition';
import { NO_STORE, REQUEST_ID_HEADER } from './problem';

/**
 * The answer of a route that serves a stored file (STORY-05.07 AC-5; ADR-013; architecture section 8): the picture of a part. The bytes are sent as they were stored and are **never
 * decoded on the server**. The headers are fixed here, so no route can forget one:
 *   - `Content-Type` is the **stored** type, one of the four the content check accepted at upload (the route's schema holds the list), never one taken from a request;
 *   - `X-Content-Type-Options: nosniff`, so a browser never guesses another type from the bytes;
 *   - `Cache-Control: private, no-store`, as every answer of the API: a picture is confidential and is not kept by a shared cache or the disk;
 *   - `Content-Disposition: inline` with **no file name**: the stored name is display text and is never put in a header, so no name can break one. The one exception is a file the portal **makes** and
 *     names itself (the export, STORY-07.01 AC-2): it passes `fileName`, the answer is then an `attachment` of that name (`content-disposition.ts`: an ASCII `filename=` and a percent-encoded `filename*=`), and a name that is not one the export makes (`isExportFileName`) is refused;
 *   - `Content-Security-Policy: default-src 'none'; sandbox`, so the address opened as a page can run nothing; and `Cross-Origin-Resource-Policy: same-origin`, so another site cannot embed it. Behind the proxy the
 *     policy on the wire for this answer is the proxy's own (`API_CONTENT_SECURITY_POLICY`, which also holds `sandbox`): Next.js keeps a header the proxy set and drops the route's of the same name
 *     (DEF-054, AQP-384). This one stays so the answer is safe by itself, and `tests/unit/security-headers.test.ts` pins the policy that reaches the browser.
 */

export interface StoredFile {
  readonly mime: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  /** Set only for a file the portal made and names itself: the answer is then an attachment of this name. */
  readonly fileName?: string | undefined;
}

/** What a download route's schema must give: the type and the bytes (and, for a file the portal names, its name), read back from the parsed answer so nothing is taken on trust. */
export const STORED_FILE_SHAPE = z.object({ mime: z.string(), bytes: z.instanceof(Uint8Array), fileName: z.string().optional() });

export function fileResponse(file: StoredFile, requestId: string): Response {
  // A name that is not one the export makes throws inside `attachmentDisposition` (a mistake in the code), before any response exists.
  const disposition = file.fileName === undefined ? 'inline' : attachmentDisposition(file.fileName);
  return new Response(file.bytes, {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': NO_STORE,
      'Content-Disposition': disposition,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
