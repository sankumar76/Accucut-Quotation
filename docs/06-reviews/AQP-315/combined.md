# Combined security-and-quality review: AQP-315 (STORY-05.07 "Part picture, optional")

- PR: https://github.com/sankumar76/Accucut-Quotation/pull/408, head `6a4b922` (re-cut of #407 onto master `292c850`)
- Reviewer: reviewer-quality (combined security and quality check, fast track CLAUDE.md §9)
- Date: 2026-11-14
- Evidence: GitHub MCP only (PR get, get_files with full patches for all 79 files, file contents at `6a4b922` for `src/proxy.ts`, `next.config.ts`, `package.json`, `deploy/`), Jira AQP-315 (AC-1 to AC-8, the "Careful" body-cap note), Next.js 16 docs (context7: `proxyClientMaxBodySize`, `body-streams.ts`). I ran no tests locally (no git or worktree access, as the brief said). I relied on the CI result in the brief: run 43668668842, 6 of 6 green, changed-code coverage 100 %.

## Verdict

**APPROVE WITH COMMENTS. Nothing blocks the merge.**

| Severity | Count |
|---|---|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (SQR-01: platform-level, affects every API route, existed before this PR; goes to the hardening window) |
| Minor | 2 |
| Info | 4 |

Under the standard reviewer rule, a Major means CHANGES REQUESTED. CLAUDE.md §9 items 2 and 3 and the orchestrator's brief say otherwise: only Blocker and Critical must be fixed before merge, and a Major waits for the hardening window unless the fix is small. The fix for SQR-01 is not story-local. It needs an architecture choice (the proxy body limit, the proxy matcher, or the Caddy `request_body` limit), and it changes every API route. So it goes to the hardening window.

## Scope checks

| # | Area | Result |
|---|---|---|
| 1 | `upload.ts`: streamed read with a 256 KB cap before parsing | **Correct at the app layer.** The body is counted per chunk and cancelled at more than `maxBytes`. `Content-Length` is only a shortcut: a header that is not a number gives 400, one over the cap gives 413, and a missing or lying header changes nothing. Chunked bodies are counted the same way. The multipart parser only ever sees at most the cap. Exactly one `file` entry is required. If the stream errors, the error goes back to the caller. **But see SQR-01:** in production `src/proxy.ts` matches `/api/*`, so Next 16 copies the body into memory (default limit 10 MB) before the route reads it. The cap does not stop the server receiving the bytes. |
| 2 | `picture-rules.ts`, `signature.ts` | Pass. `>= 204,800` is refused, so 204,799 is accepted and 204,800 is not. An empty file gives 415. The start and end markers are right for all four types: PNG checks the signature, IHDR at offset 8 and the fixed IEND chunk at the end; JPEG checks FFD8FF and FFD9 (trailing zeros allowed); GIF checks 87a/89a and the 0x3B trailer; WebP checks that the RIFF size equals the length minus 8, then WEBP and VP8/VP8L/VP8X. Nothing is decoded. The `<script`/`<svg` scan is **not** the only defence: the serving headers are (row 3). Its limits are in SQR-02. |
| 3 | `file-response.ts` | Pass. The type comes from the stored MIME only, which is held to 4 values by the DB CHECK, `IMAGE_ROW` and `pictureFileSchema`. The answer has `nosniff`, `private, no-store`, `inline` with no file name, `default-src 'none'; sandbox`, CORP `same-origin`, and a `Content-Length` taken from the bytes. No header is built from user data, and the test with a hostile name proves that. |
| 4 | `getPicture` | Pass. `findOwner` runs without the bytes, then `mayOpen` (the owning Engineer, a Lead or an Admin), and only then `readImage`. Not your picture, a missing ID and an ID that is not a UUID all get the same 404. Signed-out callers get 401 from `withRoute`. The upload 413 comes before the 404 and leaks nothing: it depends only on the body's length, the answer is the same for every ID, and it comes after auth, role and CSRF. One exception is a 400 for an ID over 100 characters (SQR-04, Info). |
| 5 | Migration `20261114150000_part_images` | Pass. The runtime role has SELECT and INSERT only, with UPDATE, DELETE and TRUNCATE revoked. The `forbid_immutable_change` triggers cover row changes and TRUNCATE for every role. The CHECKs cover the hash format, the MIME list, a size in (0, 204800), size equal to `octet_length`, and the name length. The table is unique on (estimate_id, sha256). The same-estimate trigger on `estimate_nodes` (INSERT, or UPDATE of image_id or estimate_id, with `search_path` pinned) keeps a part's picture in its own estimate. The rollback note is there. The change is additive. See SQR-06 (Info). |
| 6 | Lock, `assertEditable`, revisions, save queue | Pass. One transaction does all of this: `lockForChange` (404/409), then `findNode` (404), then the content check (413/415), then `storeImage` (ON CONFLICT DO NOTHING plus a read back), then `setImage`, which is conditional on the revision read, and finally `bumpInputsRevision`. The same file again writes nothing. In the client, `inTurn` puts the picture change in the form's save queue and in the `SaveGate`; `pictureSaved` takes the new revision. SQR-05 (Info) covers the PUT carrying no client revision. |
| 7 | File name | Pass. `sanitiseFileName` keeps the last path segment and strips control, invisible and bidi characters, `<>"'\`&:*?|` and leading dots. It cuts names to 100 characters by whole characters and falls back to `picture`. React renders the name as text (`{picture.fileName}`, `alt`). It is never put in a header. |
| 8 | Manifest, role matrix, strict schema, CSRF, recipes, import rule | Pass. Two manifest rows. Strict schemas, with a planted-key check for the file answer. CSRF origin check comes first (test). `image-repository` and `image-service` are blocked by the engineer-import rule. **On the deviation:** the role-matrix recipe is a 415, but a real successful upload is still proven end to end. `tests/unit/image-routes.test.ts` drives the real `withRoute`, session and estimate service with real multipart bytes (200, stored, revision 2, served back byte for byte with every header). `tests/e2e/estimate-picture.spec.ts` (CI) uploads through Next and PostgreSQL by picker, paste and drop, reloads, and reads the served headers. I accept the deviation. |
| 9 | No `capture` attribute (A-1) | No security issue. A question for the architect (SQR-07, Info). |
| 10 | Changes outside the story and #401 | Pass, and Calculate's checks are not weakened. `calculate-check.ts` only leaves the new `picture` rule out of `TypedField`/`isTyped`. Part Model is `editable: false`, so `formFieldById(...).editable` refuses a save under it, and `estimate-inputs` answers `FIELD_NOT_SAVABLE` for the `picture` case. The required count of section 01 is still B, D, H (test). Calculate now takes `imageId` from the locked node read (`NODE_SELECT` includes it), and `calculation_rows.image_id` stays without a foreign key, by design. The test changes only add `images` to `createEstimateService`. |

## AC conformance

| AC | Code | Test | Result |
|---|---|---|---|
| AC-1 add, preview, replace, remove, keyboard | `part-picture.tsx`, `picture-slot.tsx`, `image-service.ts`, image route | `image-service.test.ts`, `image-routes.test.ts`, e2e picker/paste/drop/Enter/reload | Met |
| AC-2 199 KB yes; 201 KB, renamed text, SVG, 0 B no; judged by content; nothing stored | `signature.ts`, `picture-rules.ts`, `image-service.ts` | `tests/unit/images/*`, `image-routes.test.ts`, integration `image.test.ts`, e2e | Met |
| AC-3 optional, never missing | `form-fields.ts`, `calculate-check.ts` | `form-fields.test.ts`, `calculate-validation.test.ts`, e2e | Met |
| AC-4 immutable row, dedup per estimate, replace = new row, `inputs_revision` in the same transaction | migration, `image-repository.ts`, `image-service.ts` | integration `image.test.ts`, `image-service.test.ts` | Met |
| AC-5 GET headers and access; plain `<img>` with width, height, alt | `file-response.ts`, images route, `part-picture.tsx` | `image-routes.test.ts`, e2e | Met |
| AC-6 409 / 404 / 413 / 415 | `image-service.ts`, `upload.ts` | `image-routes.test.ts`, role matrix, e2e | Met |
| AC-7 name sanitised, rendered as text | `sanitiseFileName`, JSX text | `picture-rules.test.ts`, `image-routes.test.ts`, e2e | Met |
| AC-8 360/768/1366, `role="alert"`, axe, keyboard | `part-picture.tsx` | e2e (CI) | Met (per CI) |

## Findings

### SQR-01 · Major: the 256 KB read cap does not limit what the server receives, because `src/proxy.ts` makes Next buffer the body first
- **Where:** `src/server/http/upload.ts:64` (`reader.cancel()`), with `src/proxy.ts` (matcher includes `/api/*`) and `next.config.ts` (no `experimental.proxyClientMaxBodySize`). Next is 16.4.5.
- **Issue:** When a proxy (middleware) runs, Next.js copies the incoming request body into an in-memory stream so that both the proxy and the route can read it (`getCloneableBody` in `body-streams.ts`; default limit **10 MB**). Past the limit, the body is cut short with a warning and the request goes on. The route's `request.body` is that copy. So the route's careful per-chunk cap and `cancel()` stop only the reading of a copy: they do not stop the server receiving and holding the bytes. The proxy matcher covers every `/api` path, signed in or not.
- **Impact:** The story's "Careful" note says a huge upload must not be able to exhaust memory. In production that holds only up to about 10 MB per request, plus the second copy, and anyone can reach it before authentication. A few dozen concurrent 10 MB bodies use hundreds of MB on the single on-premises Node process. This existed before this PR and applies to every JSON POST/PATCH route too. This PR is the first to *claim* the bound, and the unit tests prove the cap only on a bare `Request`, never through the proxy layer.
- **Fix (hardening window, architect's choice):** (a) a reverse-proxy limit (Caddy `request_body { max_size 300KB }` on the image route and a small global limit). This is the PR's own follow-up, and I recommend it as the main fix. Or (b) `experimental: { proxyClientMaxBodySize: '300kb' }` in `next.config.ts`. Beware that this cuts bodies short instead of refusing them, so a body over the limit with no `Content-Length` would reach `upload.ts` cut short and answer 400 rather than 413, and it limits every API route. Or (c) leave the upload route out of the proxy matcher, if the route does not need `SESSION_COOKIE_HEADER`.
- **Test that would catch it:** an E2E against `next start` that streams a 5 MB chunked body with no `Content-Length` to the image route and checks the process's RSS or the Next warning log, or a Caddy config test.

### SQR-02 · Minor: the script-marker scan is a heuristic. It can refuse real photos, and it misses other HTML openings
- **Where:** `src/lib/images/signature.ts:48` (`SCRIPT_MARKERS`).
- **Issue:** (1) Pictures with embedded XML metadata (XMP or other packets that start with `<?xml`) and pictures with data after the end marker (common on Samsung and motion photos) are refused with "Only PNG, JPG, GIF or WebP pictures are accepted.", which is misleading for a real JPEG. (2) As a polyglot guard it does not cover `<body`, `<img`, `<object`, `<a ` and so on. That is fine, because the real defence is the serving headers (`nosniff`, a fixed image MIME, `CSP sandbox`, CORP), which I verified.
- **Fix:** Keep the scan as defence in depth. Do not describe it anywhere as the control. Consider a clearer message for "picture with extra data". Record the stated limit in the UX notes.
- **Test:** a fixture JPEG with an XMP `<?xml` packet, to make the chosen behaviour explicit.

### SQR-03 · Minor: an oversized body without `Content-Length` gives 413, but the same body cut short at 10 MB gives a different answer
- This depends on SQR-01. A body over 10 MB is cut short by the platform. Because the copy is still more than 256 KB, `upload.ts` still answers 413. With fix (b) of SQR-01 set to a limit at or below the cap, the answer becomes 400. Whoever applies SQR-01 should keep the platform limit **above** `MAX_UPLOAD_BODY_BYTES`, so the route's 413 still decides. No change is needed now.

### SQR-04 · Info: `imageParamsSchema` answers 400 for an ID over 100 characters
- `src/server/views/schemas/images.ts:18`. The comment says an ID "is a 404, never a 400". A 400 for length alone reveals nothing about real IDs, but it contradicts the comment. Either drop `.max()` (the repository already turns any non-UUID into null, then 404) or fix the comment.

### SQR-05 · Info: `PUT .../image` carries no client revision
- The server writes on the revision it reads under the lock, so a picture change from a second tab or person overwrites a first one without a 409 (last writer wins). Saves of typed values in the other tab do get a 409 afterwards. This is acceptable for an optional picture and matches the contract as built. Noted for the architect.

### SQR-06 · Info: an estimate that ever had a picture can never be deleted
- `fk_part_images_estimate_id` is `NO ACTION` and `part_images` refuses DELETE for every role. This is consistent with immutable records, and nothing deletes estimates today. Feed it into the TD-03 (pruning) design.

### SQR-07 · Info: no `capture` attribute (story A-1)
- `part-picture.tsx:242`. Agreed: `capture` hides the gallery on many phones, and `accept` with the four types still offers camera and gallery. Not a security issue. The architect should confirm and amend A-1.

## Praise
- The fixed-header file answer is built in one place, and the type comes only from what is stored.
- The owner decision comes before any bytes are read, with one 404 for every refusal.
- The DB keeps immutability and the same-estimate rule for every role.
- The cap tests use a pull-counting stream with a high-water mark of 0, which is a genuinely good test.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 1, Minor 2, Info 4)
- Recommended next agent: orchestrator. Squash when ready. Record SQR-01 for the hardening window (solution-architect: choose between the proxy body limit, the matcher exclusion and Caddy `request_body`).
