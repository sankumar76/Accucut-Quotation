import { z } from 'zod';

import { NO_STORE, REQUEST_ID_HEADER } from './problem';

/**
 * The answer of a route that serves a stored file (STORY-05.07 AC-5; ADR-013; architecture section 8): the picture of a part. The bytes are sent as they were stored and are **never
 * decoded on the server**. The headers are fixed here, so no route can forget one:
 *   - `Content-Type` is the **stored** type, one of the four the content check accepted at upload (the route's schema holds the list), never one taken from a request;
 *   - `X-Content-Type-Options: nosniff`, so a browser never guesses another type from the bytes;
 *   - `Cache-Control: private, no-store`, as every answer of the API: a picture is confidential and is not kept by a shared cache or the disk;
 *   - `Content-Disposition: inline` with **no file name**: the stored name is display text and is never put in a header, so no name can break one;
 *   - `Content-Security-Policy: default-src 'none'; sandbox`, so the address opened as a page can run nothing; and `Cross-Origin-Resource-Policy: same-origin`, so another site cannot embed it.
 */

export interface StoredFile {
  readonly mime: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/** What a download route's schema must give: the type and the bytes, read back from the parsed answer so nothing is taken on trust. */
export const STORED_FILE_SHAPE = z.object({ mime: z.string(), bytes: z.instanceof(Uint8Array) });

export function fileResponse(file: StoredFile, requestId: string): Response {
  return new Response(file.bytes, {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': NO_STORE,
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
