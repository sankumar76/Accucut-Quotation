'use strict';

/**
 * Loaded into the E2E development server with `NODE_OPTIONS=--require` (`playwright.config.ts`, AQP-340).
 *
 * Node closes an idle keep-alive connection after 5 s (`server.keepAliveTimeout`). The specs' `page.request` calls (the API calls a test makes beside the browser) keep their connections in a
 * pool, and a call that takes a connection at the very moment the server closes it fails with `read ECONNRESET` before the server has read it. The traces and logs of the red runs show it in
 * a dozen different specs (`masters-delete`, `estimate-form-sections`, `estimate-treatments`, `lead-warning`, and `customers.spec.ts:175`, DEF-036), always on a call after a few seconds in the browser, and it
 * passes on the retry. The development server of a test run is the only one changed: a pool of connections that the server keeps for longer than the test's longest pause cannot meet the close.
 * The production server (`next start`) and the product are unchanged, and this file is not part of the build.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS file for `--require`: require is its only import form
const http = require('node:http');

const KEEP_ALIVE_MS = 65_000;
const listen = http.Server.prototype.listen;

http.Server.prototype.listen = function listenWithLongerKeepAlive(...args) {
  this.keepAliveTimeout = KEEP_ALIVE_MS;
  // Node asks for the header timeout to be longer than the keep-alive timeout.
  this.headersTimeout = KEEP_ALIVE_MS + 1_000;
  return listen.apply(this, args);
};
