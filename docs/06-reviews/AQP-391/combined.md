# Combined security-and-quality review: AQP-391 (CR-01 item 9 "Excel file name `<Short Name>_<Subject>_<DD-MM-YYYY>.xlsx`")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/604 |
| Head reviewed | `b9bc893ece63a829aba20e11a64b14a81188c35b` on `feat/AQP-391-export-file-name` (the developer's commit `b9bc893e` on top of merge `fef4f097`, which brings in `master` `d119ae39` with AQP-390). Diff `git diff origin/master...b9bc893e`: 26 files. Source: 9 files, +149 / -43, including the new `src/server/http/content-disposition.ts`. Tests: 17 files, including the new `tests/unit/http-content-disposition.test.ts` |
| CI | Run 45011363827 (CI) on `b9bc893e`: **completed, success.** That covers "Stages 1 to 11b" (secret scan, data-file check, lint, type-check, unit with coverage, audit, licences, build, migrations and drift, PostgreSQL integration, changed-code coverage, JS budget), E2E shards 1 to 4 (543, 536, 538 and 518 passed) and "Stages 1 to 11". The new E2E test `export.spec.ts:82` ran and passed at all three widths: mobile (shard 1, #373), tablet (shard 2, #502) and desktop (shard 4, #151). Shard 4 reports 4 flaky tests, all in `estimate-fasteners.spec.ts` and `estimate-form.spec.ts`, which this PR does not touch (QLT-08). Nightly run 45011363825 passed every job except "CI feedback time", which does not count before G8 (DL-286) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`, shared with AQP-390 because the header builder and the browser parser form an input-to-header path. Trace: CR-01 row 9 (UX spec §0.9); architecture v0.59 §4.11 c and f; PRD v0.33 FR-071 (pending OQ-PM-11), NFR-032; RFC 6266 and RFC 8187 |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-22 |
| **Verdict** | **APPROVE WITH COMMENTS.** I found no Blocker, Critical or Major. **No typed value can inject a header or break a parameter.** The header carries only the ASCII set `A-Z a-z 0-9 . _ - % ' = " ; space`. Every value a person typed reaches it either filtered to `[A-Za-z0-9._-]` (`filename=`) or percent-encoded outside that set (`filename*=`), after a check that refuses any whitespace, control, format, lone surrogate or reserved character. The browser accepts a decoded name only after the same check, so no path can reach `link.download`. Authorisation and NFR-002 are unchanged. The tests are meaningful, and the real data path is covered by integration (real PostgreSQL) and by E2E at three widths. Three Minor items are cheap improvements: QLT-01, invisible "default-ignorable" letters pass the clean-up; QLT-02, a leading dot gives a hidden file, and Chromium strips it; QLT-03, the stem-limit tests do not read the constant (NFR-032) |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 3 · Info 7 |

## How I read it

- **Records:** Jira AQP-391 (12 ACs, Dev Context, Testing Notes, Risks); the PR body (Dev Record, 6 decisions plus the E2E regex note, quality-loop evidence); architecture v0.59 §4.11 c and f and §8 "Input validation" (`origin/docs/AQP-1-records-t`); PRD v0.33 FR-071, NFR-032 and OQ-PM-11 (same branch); UX spec §0.9 row 9 (`master`); `docs/standards/coding-standards.md` §1, §3, §5 and §6; my AQP-390 review (`docs/06-reviews/AQP-390/combined.md`, QLT-02/QLT-15: inputs refuse `\p{Cc}` and `\p{Cf}`).
- **Code read at the head without a checkout** (`git show origin/feat/AQP-391-export-file-name:<path>` in the records worktree): `lib/export/file-name.ts`, `lib/time.ts` (`istDayMonthYearOf`), `server/http/content-disposition.ts`, `server/http/file-response.ts`, `server/http/with-route.ts:243` (the one caller), `server/views/schemas/export.ts`, `server/repositories/export-repository.ts`, `server/services/export-service.ts` `nameOf`, `lib/export/download-client.ts` (whole file), and the callers `estimate-export.tsx:127,133` and `download-button.tsx`. The schema has `customers.short_name` and `tasks.subject` both `NOT NULL` with blank and length CHECKs (AQP-390 migrations), so the zod row's `subject: z.string()` is safe.
- **Tests read in full:** `unit/export/file-name.test.ts`, `unit/http-content-disposition.test.ts`, `unit/export-download-client.test.ts`, and the diffs of `unit/export-route.test.ts`, `export-service.test.ts`, `export-page`, `export-refusal`, `export-screen`, `integration/export/layout.test.ts`, `e2e/export.spec.ts`, `e2e/support/auth.ts` (`setCanarySubject`), `review-download`, `export-refusal`, `canary-scan`, and the two `e2e-sweep` specs.
- **Probe (scratchpad, a standalone copy of the two pure functions, Node 24):** BOM, NEL, U+3164, U+2800, U+034F, U+FE0F, a leading combining mark, tag characters, U+2215, U+FF0F, U+FFFE, private use, a leading dot, `..`, and ZWNJ. I also checked that `new Response(...)` accepts the built header, measured the UTF-8 bytes of a 100-code-point Tamil-subject name, and checked `\p{Default_Ignorable_Code_Point}` coverage. Results are cited in the findings.

## Security and correctness checks

| # | Check | Result |
|---|---|---|
| 1 | **Header injection: `content-disposition.ts`** | **Holds.** `attachmentDisposition` first refuses any name that fails `isExportFileName` (`\s` covers CR, LF, TAB, NBSP, U+2028 and U+2029; also `\p{Cc}`, `\p{Cf}`, `\p{Cs}`, `/ \ : * ? " < > \|`, wrong extension, empty or over-long stem). Its error does not repeat the name (tested). **`filename=`**: the stem is filtered to `[A-Za-z0-9._-]`, and `download` replaces a stem that ends up empty, which cannot happen for a built name because the date survives. No quote, semicolon, backslash or line break is possible. **`filename*=UTF-8''`**: each code point outside `[A-Za-z0-9._-]` becomes its UTF-8 bytes as `%XX` in upper case. That is a strict subset of RFC 8187 `attr-char`, so `'`, `;`, `%` and every non-ASCII byte are encoded (`%27`, `%3B`, `%25`). Parameter order is `filename` then `filename*`, as RFC 6266 §4.3 recommends for older clients. The whole value is ASCII, so the WHATWG `Headers` ByteString rule is met; the probe showed the old single-parameter form would have **thrown** on a CJK letter. Tests pin the exact header for an ASCII name, a non-ASCII name, a non-BMP name, an all-non-ASCII stem, `;%'`, and a hostile typed text with `"\r\nX-Injected: y; filename=evil.exe\'()*%`. For that text they assert exactly 2 `;` (3 parts) and a full-header regex. They also check the decode round trip |
| 2 | **`file-response.ts`** | **Holds.** The disposition is computed before the `Response` exists, so a bad name throws before any byte is sent, and `withRoute` answers its fixed 500. The inline, no-name picture branch is unchanged (tested). `SAFE_FILE_NAME` is gone and `isExportFileName` replaces it. AC-5's "keeps its throw for a control character" is met through `attachmentDisposition` (tested with `\r\n`, `"`, `../` and NUL) |
| 3 | **Builder `file-name.ts`: sanitising** | **Matches AC-3 in the stated order:** NFC, then `[\s/\\:*?"<>\|]` to one hyphen each (no run collapsing), then `[\p{Cc}\p{Cf}\p{Cs}]` removed. Both parts get the same treatment. The task code that stands in for a subject is cleaned the same way. Letters, digits, `_`, `-`, `.` and non-ASCII letters are kept. PRD FR-071's examples come out exactly (`Lid / rev: 2` gives `Lid---rev--2`). Gaps beyond the AC: invisible non-Cf letters (QLT-01) and a leading dot (QLT-02). Because step 2 runs first, U+FEFF becomes a hyphen rather than being removed (QLT-04, consistent with the AC's order) |
| 4 | **Builder: length and cut** | **Correct.** `fitParts` cuts by code points (`Array.from`), so a surrogate pair is never split (tested with 🔧 at the cut, in both parts). The short name is capped at `100 - 12 - 1 = 87`. The subject budget is `100 - 12 - len(shortName)`. So the stem is always at most 100, the short name and date survive, and neither part is empty. Every number derives from `EXPORT_FILE_NAME_STEM_MAX_LENGTH`, `PART_SEPARATOR` and `DATE_LENGTH` (AC-10). Boundary cases 99, 100 and 101, 80 under 10 (cut by 2), 20 under the ceiling (68 left), a 5,000-character subject, and a 500-character short name are all tested. Grapheme clusters can still be split at the cut (QLT-09, by design) |
| 5 | **Builder: fallbacks and date** | **Correct.** `cleanPart(...) \|\| 'Customer'` and `cleanPart(subject) \|\| cleanPart(taskCode)` give no `null`, `undefined` or empty part (tested, including invisible-only inputs). An empty usable task code throws `RangeError` (decision 6, confirmed below). `istDayMonthYearOf` reuses `istIsoDateOf` and reorders it, so the IST boundary logic exists once. 18:29:59.999Z and 18:30:00Z, the year end, 1 March and 29 February 2028 are tested. An invalid `Date` throws `RangeError` |
| 6 | **`isExportFileName` replaces the ASCII patterns: no loss of validation, no path traversal** | **Holds.** It is used by `exportFileSchema` and `exportSummarySchema` (zod `refine`), by `attachmentDisposition`, and by `fileNameFrom`. `git grep` at the head finds no `EXPORT_FILE_NAME_PATTERN`, `SAFE_FILE_NAME`, `customerPart`, `MAX_CUSTOMER_PART` or `Quotation_` left in `src` (AC-8). Compared with the old ASCII patterns, the check now admits non-ASCII letters, `.`, `;`, `'` and `%` in the stem. It refuses both separators, `:` (no drive letter), every whitespace, control, format and lone-surrogate character, and any extension other than lower-case `.xlsx`. A name without a separator, such as `..xlsx`, cannot climb a directory. `.xlsx.exe` and `.XLSX` are refused (tested) |
| 7 | **Browser: `download-client.ts` `fileNameFrom`** | **Holds.** `filename*` is read first, case-insensitively, with the value stopped at `;` or whitespace, and decoded in a `try`. A `URIError` (bad escape or an encoded lone surrogate) gives `null`. The decoded name is accepted only if `isExportFileName` passes, so `..%2F`, `%22`, `%0D%0A`, `%00`, `%E2%80%AE`, `%20`, `.exe` and a 101-character stem are all refused (tested). Then `filename="..."` is tried, checked the same way. If neither passes, `downloadExport` uses the summary's name, as before. A `filename=` hidden inside an encoded `filename*` value is not picked up (tested). The saved name is the decoded `filename*`, which equals the card (unit test plus E2E at three widths) |
| 8 | **Authorisation and NFR-002 (AC-9)** | **Unchanged.** The route manifest, `withRoute` order and service checks are untouched; this PR changes only the route's doc comment. `findHeader` adds `c.short_name` and `t.subject`, both class Internal; no rate, figure or contact column is selected, and the zod row is strict. The name is sent only by the Lead/Admin-only export and summary routes. The CI canary scan (`canary-scan.spec.ts`, positive control updated to the two-parameter header) passed in Stage 12 |
| 9 | **Tests: meaningful, none deleted or weakened (AC-11, AC-12)** | **Met.** The `customerPart` tests were removed with the function. Their security intent (quote, slash, line break, emoji, non-ASCII) now has stronger coverage: per-character tables, a 500-case seeded property check over a hostile alphabet that includes lone surrogates, and the header tests. Every relaxed E2E regex (`FILE_NAME` in five specs) is paired with an exact `_Canary-subject_` assertion or an exact-name assertion, so no expectation lost strength. The real data path is covered: `integration/export/layout.test.ts` (real DB: seeded short name and subject, a legacy-shaped estimate, the cut at 80 under 10, file and summary agreeing, the header encoding) and `e2e/export.spec.ts:82` (a subject with a space, a slash and CJK; saved name = card name, and a guard for IST midnight between the two reads; both header parameters). `setCanarySubject` asserts `rowCount === 1`. The one gap is NFR-032's "reads the constant" (QLT-03) |

## The developer's edge-case decisions

| # | Decision | Ruling |
|---|---|---|
| 1 | Cut reading: the end of the subject goes, so the short name and the date survive; isolated in `fitParts` | **Confirmed** against architecture §4.11 c and PRD v0.33 FR-071 (working reading). It is still **pending OQ-PM-11** with the delivery lead (customer meeting 2026-11-23). The Jira story's Risks section says "needed before merge" (QLT-07). Changing the reading would touch only `fitParts` and its tests |
| 2 | A short name longer than the stem allows is cut, so the subject keeps 1 character | **Confirmed.** The database ceiling (20) cannot reach this, the pure builder still never returns an invalid name, and it is tested (`S`×500 gives 87 characters plus `_s_`) |
| 3 | Lone surrogates removed with Cc and Cf | **Confirmed, and necessary.** `encodeURIComponent` throws `URIError` on a lone surrogate, and `TextEncoder` would silently write U+FFFD, so the encoded name would not decode back to the card's name. Within a well-formed string, `\p{Cs}` under the `u` flag matches only lone halves; a valid pair is read as one astral code point (tested with emoji) |
| 4 | `;`, `'` and `%` are legal in a name; whitespace is refused by `isExportFileName` | **Confirmed.** All three are encoded in `filename*` and dropped from `filename=` (tested), so none can end a parameter. Refusing all whitespace in the check is consistent with the builder, which turns all whitespace into hyphens |
| 5 | `filename*` encodes more than RFC 8187 requires (only `A-Z a-z 0-9 . _ -` literal) | **Confirmed.** RFC 8187 allows a `pct-encoded` octet anywhere in `value-chars`. Browsers decode either form, and one literal set for both parameters keeps the code simple |
| 6 | An empty task code that must stand in throws `RangeError` | **Confirmed.** The code is server-generated (`Q-YYYY-NNNN`, `NOT NULL`), so this can only be a code defect, and `withRoute` answers it with the fixed 500. AC-7's "never throws on a legacy row" holds, because every legacy row has a code |
| 7 | E2E regexes no longer expect the task code | **Confirmed, not weakened.** Each one is paired with an exact subject or exact name assertion (check 9) |

## AC conformance

| AC | Code | Test(s) | Result |
|---|---|---|---|
| AC-1 Pattern | `file-name.ts` `exportFileName` | `file-name.test.ts` (pattern; no `Q-2026`, no `Quotation`); integration `layout.test.ts`; e2e `export.spec.ts:41,82` | Met |
| AC-2 IST date | `time.ts` `istDayMonthYearOf` | `file-name.test.ts` (7-row date table, `istDayMonthYearOf` vs `istIsoDateOf`, NaN); `export-service.test.ts` (19:00Z gives the next day) | Met |
| AC-3 Sanitising | `cleanPart` (NFC, then hyphens, then removal) | `file-name.test.ts` (9 reserved, 6 whitespace kinds, Cc, bidi, zero-width, lone surrogate, NFC, short name) | Met (QLT-01, QLT-02 beyond the AC; QLT-04 note) |
| AC-4 Length | `fitParts`, code points | `file-name.test.ts` (99, 100, 101; 80 under 10; emoji at the cut in both parts; 5,000; 20; 500) | Met (working reading, QLT-07) |
| AC-5 Header | `content-disposition.ts`; `file-response.ts` | `http-content-disposition.test.ts`; `export-route.test.ts`; integration; e2e header regex at three widths | Met |
| AC-6 Browser | `download-client.ts` `fileNameFrom` | `export-download-client.test.ts` (7 cases plus a save-name case); e2e saved name = card | Met |
| AC-7 Fallbacks | `exportFileName` | `file-name.test.ts`; `export-service.test.ts`; `export-route.test.ts`; integration legacy-shaped estimate | Met |
| AC-8 One builder, one check | `isExportFileName` in schemas, `file-response` (via the header builder) and `download-client`; old names removed | `file-name.test.ts` (accepts, refuses, property); `git grep` clean | Met |
| AC-9 Security unchanged | no auth/route change; header builder | checks 1, 2, 6, 7, 8; canary scan green | Met |
| AC-10 Constants | `EXPORT_FILE_NAME_STEM_MAX_LENGTH` once; budget derived | `file-name.test.ts:91` | Met (NFR-032 test form: QLT-03) |
| AC-11 Unit tests | — | every listed case is present | Met |
| AC-12 Old tests updated, none weakened | — | check 9 | Met |

## Findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| QLT-01 | Minor | `src/lib/export/file-name.ts:30` (`REMOVED`) and `:32` (`REFUSED_IN_STEM`) | **Invisible "default-ignorable" characters that are not `\p{Cf}` pass the clean-up and the check.** The probe confirmed U+3164 HANGUL FILLER, U+115F, U+1160, U+FFA0, U+034F COMBINING GRAPHEME JOINER, and the variation selectors U+FE00 to U+FE0F and U+E0100 to U+E01EF. AQP-390's input rule refuses only Cc and Cf, so they can be typed. A subject of only U+3164 gives `MAS_ㅤ_22-11-2026.xlsx`, which reads as an empty part. That defeats the intent of AC-7 ("no empty part"): the task-code fallback never triggers. Two short names that differ only by such a character look identical on disk. This is not a security issue: the extension is fixed at the end and the bidi controls are removed | Add the Unicode property to both expressions: `/[\p{Cc}\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}]/gu` and the same inside `REFUSED_IN_STEM`. Node supports it, and the probe shows it covers all of the above plus U+00AD and U+200B. An invisible-only part then falls back as AC-7 intends. **Test:** `nameOf('MAS', 'ㅤ')` gives `MAS_Q-2026-0001_…`, `nameOf('MAS', 'a️b')` gives `MAS_ab_…`, and `isExportFileName('Mㅤ_x_….xlsx')` is false. Product owner: optionally mirror this in AQP-390's input rule |
| QLT-02 | Minor | `src/lib/export/file-name.ts:38-39` (`cleanPart`), `:77` (`isExportFileName`) | **A short name that starts with `.` gives a file whose name starts with a dot.** A-CR01-A2 lets the master hold any printable text, so `.MAS` gives `.MAS_x_….xlsx`. On macOS, Linux and Android that is a hidden file. Chromium's download-name sanitiser trims leading dots, so the browser would save `MAS_x_…` while the card says `.MAS_x_…`. That breaks AC-6's "saved name equals the card". A short name of `..` gives `.._x_….xlsx`. This is harmless as a path (no separator) but is the same problem | In `exportFileName`, after cleaning, replace leading dots of the short name with hyphens (`.replace(/^\.+/u, (dots) => '-'.repeat(dots.length))`, following the "one hyphen per character" rule), or drop them. Make `isExportFileName` refuse a leading `.` so the check and the builder agree. **Test:** `nameOf('.MAS', 'x')` does not start with `.`; `isExportFileName('.a_x_01-01-2026.xlsx')` is false; the property check's alphabet already has `.` |
| QLT-03 | Minor | `tests/unit/export/file-name.test.ts:91-150`, `:221-227` | **NFR-032 is not met for the file-name limit.** Its measure requires "one boundary test per limit (N accepted, N+1 refused) that reads the constant, so a changed limit needs no test edit". The length tests hard-code 100, 101, 78, 87, 85 and 68 (`'a'.repeat(101)`, `'x'.repeat(78)` …), and `limits-single-source.test.ts` (AQP-390) does not cover `EXPORT_FILE_NAME_STEM_MAX_LENGTH`. The limit is a proposal (A-CR01-4) and may change after the customer review (OQ-PM-11 offers "raise the limit to at least 102"). That change would then need roughly 10 test edits | Derive the edges: `const LIMIT = EXPORT_FILE_NAME_STEM_MAX_LENGTH; const FIXED = 12;`. Then `isExportFileName('a'.repeat(LIMIT) + '.xlsx')` is true and `LIMIT + 1` is false; `nameOf('S'.repeat(10), 'x'.repeat(LIMIT - FIXED - 10 + 1))` is cut to `LIMIT - FIXED - 10`; and so on. Keep exactly one value pin (`toBe(100)`, AC-10). Add the limit to `limits-single-source.test.ts` (a behaviour test plus a scan of `file-name.ts`, `content-disposition.ts` and `schemas/export.ts` for a stray `100`) |
| QLT-04 | Info | `src/lib/export/file-name.ts:28` | JavaScript's `\s` includes U+FEFF (BOM / zero-width no-break space), which is also `\p{Cf}`. Step 2 runs before step 3, so it becomes a hyphen rather than being removed. This follows AC-3's stated order literally. Since AQP-390 now refuses Cf at input, only a legacy row could hold one | None. If QLT-01 is done, consider running the removal before the hyphen step for U+FEFF only, or leave as is |
| QLT-05 | Info (for the product manager) | `EXPORT_FILE_NAME_STEM_MAX_LENGTH` in code points | 100 code points can be up to about 400 UTF-8 bytes. APFS (macOS) and ext4/F2FS (Linux, Android) cap a name at 255 bytes. A full-length subject in an Indic script (3 bytes each) measured **261 bytes** for the whole name. NTFS (Windows, the main target) counts 255 UTF-16 units, so it is unaffected. Browsers shorten an over-long name, so the download still works, but the saved name would then differ from the card | None now (AC-4 fixes code points). Mention it when OQ-PM-11 is answered; a byte cap is a one-function change in `fitParts` |
| QLT-06 | Info (for the solution-architect) | architecture §8 "Input validation" (line 1182 on `docs/AQP-1-records-t`) | §8 still describes the old rule: "spaces become underscores, anything outside `A-Za-z0-9_-` is removed, at most 60 characters", with the example `Quotation_Brightwater_Controls_Q-2026-0318_2026-11-05.xlsx`. §4.11 c supersedes it, but two statements now disagree | Rewrite that sentence to point to §4.11 c |
| QLT-07 | Info (process, for the orchestrator) | Jira AQP-391 "Dependencies / Risks"; PRD OQ-PM-11 | The cut reading (A-CR01-A3) is the working reading in architecture, PRD and code, but OQ-PM-11 is open with the delivery lead (customer on 2026-11-23). The story says the answer is "needed before merge". The code makes either answer a one-function change | Either get the answer before merging, or record the delivery lead's word that the PR may merge on the working reading, with a follow-up if the answer differs |
| QLT-08 | Info | CI run 45011363827, shard 4 | 4 tests were flaky (passed on retry), all in `estimate-fasteners.spec.ts:93,104,127` and `estimate-form.spec.ts:74` [desktop]. This PR changes none of those files or their code. Nightly "CI feedback time" is red and does not count before G8 (DL-286) | None for this PR. qa-engineer may track the flakes against the existing DEF-057 and DEF-058 lane if they recur |
| QLT-09 | Info | `fitParts` (`cut`) | A code-point cut can still split a grapheme cluster: an Indic vowel sign, an emoji skin-tone modifier, or one half of a flag. The name stays valid and encodable. AC-4 asks for code points, and ZWJ is removed anyway | None |
| QLT-10 | Info (praise) | whole change | A tight, well-reasoned boundary. One pure builder, one check used at all four points, a header builder that validates before it encodes and stays ASCII-only by construction, and a browser parser that trusts nothing it decodes. The tests go past the AC: per-character tables, a seeded property check over a hostile alphabet, an injection test that counts parameters, real-DB integration, and E2E at three widths with an IST-midnight guard. The edge-case decisions were disclosed for review rather than buried | None |

## Checks run

- **CI:** `gh pr checks 604`, `gh run view 45011363827`, `gh run list --commit b9bc893e`. CI run **success** (all 6 jobs). I downloaded the four shard logs (`gh api .../actions/jobs/<id>/logs`) and confirmed that `export.spec.ts:82` (the new AQP-391 test) passed on mobile, tablet and desktop, and identified the 4 flaky tests (QLT-08). Nightly: all green except "CI feedback time".
- **No local test run.** The branch is checked out in no worktree I may use. CLAUDE.md §9 item 5 keeps heavy suites in CI, and CI ran the unit, integration and E2E suites on this exact head. The developer's local evidence is 10,213 unit tests passed and 93 integration tests passed on `tests/integration/export`. The one local unit failure is `playwright-system-deps.test.ts`, a Windows-only timeout this PR does not touch; it passed in CI.
- **Probe:** a standalone copy of `cleanPart` and `isExportFileName` in the scratchpad (Node 24). Findings QLT-01, QLT-02, QLT-04 and QLT-05 are based on its output; I also used it to confirm that `Response` accepts the built header and that the old form throws on a CJK letter.
- **Greps at the head:** no `Quotation_`, `EXPORT_FILE_NAME_PATTERN`, `SAFE_FILE_NAME`, `customerPart` or `MAX_CUSTOMER_PART` in `src`. `fileResponse` has one caller (`with-route.ts:243`). The card and the button take `summary.fileName` only.
- Everything was read with `git show <ref>:<path>` in the records worktree. I did not check out the branch, modify code, read `.env*` files, or write in the main checkout.

## Issues for other roles

- **product-manager:** OQ-PM-11 (QLT-07); the byte-length note (QLT-05) for the same answer.
- **product-owner:** whether AQP-390's input rule should also refuse default-ignorable characters (QLT-01), and whether a leading dot in a short name should be refused at input (QLT-02).
- **solution-architect:** §8 "Input validation" sentence (QLT-06).
- **orchestrator:** merge condition on OQ-PM-11 (QLT-07). The Minor findings can be fixed in this PR, or recorded for §9 item 3's end review.

---

## Addendum 1: re-review at head `e13150c1` (2026-11-22)

| Item | Value |
|---|---|
| Head reviewed | `e13150c10ef44fca14d062b486a61813d21ffc35`. New since `b9bc893e`: the developer's commit `e13150c1` (3 files: `src/lib/export/file-name.ts`, `tests/unit/export/file-name.test.ts`, `tests/unit/limits-single-source.test.ts`) and merge `a0ad4fdf` of `master` `eb4137f4` (#611, DEF-061). The merge is clean: `git show --cc` has no conflict hunk, and it brings only `picture-slot.tsx`, `estimate-form.spec.ts` and `estimate-picture.spec.ts`. Only `e13150c1` was reviewed |
| CI | Run 45014203487 (CI) on `e13150c1`: **completed, success**. That covers "Stages 1 to 11b", E2E shards 1 to 4 and "Stages 1 to 11". Nightly 45014203461 is green except "CI feedback time" (does not count before G8, DL-286) |
| **Verdict** | **APPROVE WITH COMMENTS.** QLT-01, QLT-02 and QLT-03 are fixed. The header-injection path is unchanged and only got stricter. No Blocker, Critical, Major or Minor is open |
| Counts now open | Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 10 (QLT-04 to QLT-10 as before, plus QLT-11 to QLT-13 below) |

### Prior findings

| ID | Was | Now | Evidence |
|---|---|---|---|
| QLT-01 | Minor | **Fixed** | `REMOVED` and `REFUSED_IN_STEM` both gain `\p{Default_Ignorable_Code_Point}`, so the builder and the check stay in step. Tests: a part made only of U+3164, U+FFA0, U+034F, U+FE0F or U+00AD falls back (`Customer` or the task code); such characters are removed from inside a part; `isExportFileName` refuses them |
| QLT-02 | Minor | **Fixed** | `LEADING_DOTS = /^\.+/u`. Each leading dot of the cleaned short name becomes one hyphen. This runs after `cleanPart`, so `​.MAS` also gives `-MAS`. `isExportFileName` refuses a stem that starts with a dot. A dot inside the short name, or at the start of the subject (after `_`), is kept and pinned. **The browser check matches:** `download-client.ts` is unchanged and calls the same `isExportFileName` on the decoded `filename*` and on the plain `filename`, so a leading-dot name from either parameter is refused and the summary's name is used. The seeded property check's alphabet includes `.`, so random short names starting with a dot are now covered too |
| QLT-03 | Minor | **Fixed** | Every edge in the length tests derives from `EXPORT_FILE_NAME_STEM_MAX_LENGTH` (`LIMIT`, `FIXED = 12`, `ROOM`), and one `toBe(100)` pin remains (AC-10). The 99/100/101, room+2, emoji, ceiling-20 and over-long cases are all kept. `limits-single-source.test.ts` adds a behaviour test (N accepted, N+1 refused, built stem = N), a scan of the five name-path files for a stray `100` beside "stem" or "file name", and a definition pin. The definition pin follows AQP-390's precedent for its own limits |
| QLT-04 to QLT-10 | Info | Unchanged | QLT-07 (OQ-PM-11, "needed before merge") still stands for the orchestrator |

### Header-injection path

**Not reopened.** `content-disposition.ts`, `file-response.ts`, `schemas/export.ts` and `download-client.ts` are byte-identical to `b9bc893e` (`git diff b9bc893e e13150c1 -- src/server src/lib/export/download-client.ts` is empty). The only source change removes more characters and refuses more names. The header is still checked first and still ASCII-only by construction.

### New diff: findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| QLT-11 | Info | `src/server/http/content-disposition.ts` `asciiFallbackOf` (unchanged) | The ASCII fallback `filename=` can still start with a dot when the short name starts with non-ASCII letters followed by a dot. The probe showed `工.` gives the full name `工._x_….xlsx` (valid) and the fallback `._x_22-11-2026.xlsx`. This is not reachable in practice: the portal button and every current browser use `filename*`, and `fileNameFrom` would refuse the plain value anyway. Only a client without RFC 8187 support would see it | Optional: apply the same leading-dot replacement to the fallback's stem |
| QLT-12 | Info | `src/lib/export/file-name.ts` `cleanPart` | NFC runs before the removal, so removing a combining grapheme joiner between a letter and a combining mark leaves a non-NFC sequence (probe: `a` U+034F U+0308 gives `a` U+0308, where NFC is `ä`). The card, the header and the saved name are the same string, so nothing breaks. AC-3 states NFC as step 1, and the code follows that order | Optional: `.normalize('NFC')` once more at the end of `cleanPart` |
| QLT-13 | Info (style; reviewer-standards) | `tests/unit/limits-single-source.test.ts:7` | `CUSTOMER_SHORT_NAME_MAX_LENGTH,SHORT_NAME_TOO_LONG_MESSAGE` is missing a space after the comma. Lint passed; this is cosmetic | Add the space next time the file is touched |

### Checks run (addendum)

- `git log --first-parent b9bc893e..e13150c1`; `git diff e13150c1^ e13150c1` (source and tests read in full); `git show --cc a0ad4fdf` (no conflict hunk) and its stat; `git diff b9bc893e e13150c1 -- src/server src/lib/export/download-client.ts` (empty).
- Probe (Node 24, scratchpad): the ASCII fallback for `工._x_…` (QLT-11); NFC after CGJ removal (QLT-12).
- CI: `gh run list --commit e13150c1`; I watched run 45014203487 until it completed (success, all 6 jobs) and read Nightly 45014203461.
- No local run; everything was read with `git show`/`git diff` in the records worktree.

---

## Addendum 2: re-review at head `f091dddd` (2026-11-22): no length cut (OQ-PM-11, DL-297)

| Item | Value |
|---|---|
| Head reviewed | `f091dddd719355f9fb599df9a27765307521617e`. New since `e13150c1`: the developer's commit `f091dddd` (6 files: `src/lib/export/file-name.ts`, `tests/unit/export/file-name.test.ts`, `tests/unit/limits-single-source.test.ts`, `tests/unit/export-download-client.test.ts`, `tests/unit/http-content-disposition.test.ts`, `tests/integration/export/layout.test.ts`) and merge `32f9e16e` of `master` `de4799ae`. The merge is clean: `git show --cc` has no conflict hunk, and it touches no export file. Only `f091dddd` was reviewed |
| Decision implemented | DL-297 (records-t, the delivery lead's answer to OQ-PM-11, relayed on AQP-1 comment 12692): "Don't limit the characters." The name is `<Short Name>_<Subject>_<DD-MM-YYYY>.xlsx` in full; `EXPORT_FILE_NAME_STEM_MAX_LENGTH` goes. PRD v0.34 NFR-032 keeps one check: Short name limit + Subject limit + 17 must stay under 255 |
| CI | Run 45022922606 (CI) on `f091dddd`: **completed, success**. That covers "Stages 1 to 11b", E2E shards 1 to 4 and "Stages 1 to 11". Nightly 45022922612 is green except "CI feedback time" (does not count before G8, DL-286) |
| **Verdict** | **APPROVE WITH COMMENTS.** The header-injection path is unchanged, and removing the bound is acceptable (reasons below). One Minor: the NFR-032 check that DL-297 keeps is not implemented (QLT-14). No Blocker, Critical or Major |
| Counts now open | Blocker 0 · Critical 0 · Major 0 · Minor 1 (QLT-14) · Info 8 (QLT-04, 05, 06, 08, 10, 11, 12, 13 and QLT-15; QLT-07 and QLT-09 closed) |

### Header-injection path

**Not reopened.** `content-disposition.ts`, `file-response.ts`, `schemas/export.ts`, `download-client.ts` and `time.ts` are byte-identical to `e13150c1` (`git diff e13150c1 f091dddd -- src/server src/lib/export/download-client.ts src/lib/time.ts` is empty). The only source change removes `fitParts`, the cut helpers and the constant, and drops the length test from `isExportFileName`. Every character rule (whitespace, reserved, Cc, Cf, Cs, default-ignorable, leading dot, `.xlsx`, non-empty stem) is kept in both the builder and the check. The header builder never depended on length.

### Is removing the bound acceptable? Yes

- **Bounded at the source.** The parts come only from columns with database CHECKs (`short_name` at most 20, `subject` at most 200 code points) plus the server-made task code and a 10-character date. The forms hold them to 10 and 80, so 107 characters with `.xlsx` today (DL-297). The old upper bound in the schema was a second ceiling; the database CHECKs now provide it.
- **The header stays small.** At the database ceilings, all non-BMP characters (the worst case), `filename*` is about 220 × 12 + 17 ≈ 2.7 KB, plus a short ASCII fallback. That is well within Node's limits and those of Caddy and IIS (the proxies in `deploy/windows/README.md`). At today's form limits it is about 1.1 KB at most.
- **No new risk from an unbounded check.** `isExportFileName` and the browser's header expressions are single character classes, so they run in linear time with no backtracking. The browser check still refuses every path, quote, control, invisible and dot-led name, whatever the length.
- **What it costs.** The schema no longer stops an unexpectedly long name. That would need a code change to the field limits, which is exactly the event QLT-14's test would catch.

### Prior findings

| ID | Was | Now | Note |
|---|---|---|---|
| QLT-03 | Minor (fixed in addendum 1) | **Superseded** | The constant is gone. Its replacement under NFR-032 v0.34 is QLT-14 |
| QLT-05 | Info | Unchanged | Byte length on APFS/ext4: at 107 code points, a subject in an Indic script is still near or over 255 UTF-8 bytes; Windows NTFS is fine |
| QLT-07 | Info (process) | **Closed** | OQ-PM-11 is answered (DL-297) |
| QLT-09 | Info | **Closed** | There is no cut any more, so no grapheme can be split |
| QLT-06 | Info | **Widened** | Besides §8 "Input validation", architecture §4.11 c (the "Truncation" row, A-CR01-A3) and the constants table row `EXPORT_FILE_NAME_STEM_MAX_LENGTH` (around line 700) are now out of date. DL-297 (4) leaves them to the architect |
| QLT-04, 08, 10, 11, 12, 13 | Info | Unchanged | none |

### New diff: findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| QLT-14 | Minor | `tests/unit/limits-single-source.test.ts` (the AQP-391 block removed in `f091dddd`); PRD v0.34 NFR-032 | **The one length guard DL-297 keeps is not implemented.** NFR-032 v0.34's measure asks for "a unit test that the sum of the two limits plus 17 is under 255". With the cut and the schema bound gone, that test is the only thing that stops a future raise of `SUBJECT_MAX_LENGTH` (toward its 200 ceiling) or `CUSTOMER_SHORT_NAME_MAX_LENGTH` from producing names that Windows cannot save as shown. The browser would shorten them, and the saved name would differ from the card (AC-6). Today's sum is 107, so nothing breaks now | Add to `limits-single-source.test.ts`: `expect(CUSTOMER_SHORT_NAME_MAX_LENGTH + SUBJECT_MAX_LENGTH + 17).toBeLessThan(255)`, with a comment citing DL-297 and NFR-032. Stronger (product-manager or architect to choose): count the worst case in UTF-16 units, since NTFS's 255 is in UTF-16 units and a character outside the BMP counts 2: `2 * (S + N) + 17 < 255` (197 today) |
| QLT-15 | Info | `src/lib/export/file-name.ts:54-56` (the `isExportFileName` doc comment) | The comment says the stem is "at most about 232 code points, inside the 255 of Windows". 232 is the database-ceiling figure. Windows' 255 counts UTF-16 units, so 232 code points of non-BMP characters (464 units) would not fit. The bound the product relies on is the form limits (107 with `.xlsx`, DL-297) | Reword: "bounded by the form limits (short name 10, subject 80: 107 with `.xlsx`, DL-297; NFR-032's test keeps that under 255)". Drop the 232 claim or qualify it |

### Tests

Only the cut tests were removed; DL-297 removed that behaviour, so this is not a weakening. The replacements read `CUSTOMER_SHORT_NAME_MAX_LENGTH` and `SUBJECT_MAX_LENGTH` and assert that every character survives at the form limits, at the database ceilings (20 + 200), with non-BMP parts, with a 5,000-character subject and with a 150-digit task code. The date stays whole. `isExportFileName` accepts long names. The integration test now expects all 80 subject characters under a 10-character short name. Test sources now use `\uXXXX` escapes instead of literal invisible characters, which makes them reviewable. Two refusal cases were added to the client test: `.hidden.xlsx` and an encoded U+3164.

### For other roles

- **product-owner:** AQP-391 AC-4 (cut) and AC-10 (the constant) are superseded by DL-297; update the Jira ACs.
- **solution-architect:** architecture §4.11 c and the constants table (QLT-06), following DL-297 (4).
- **developer:** QLT-14 (one line), and optionally QLT-15.

### Checks run (addendum 2)

- `git log --first-parent e13150c1..f091dddd`; `git diff f091dddd^ f091dddd` (source and tests read in full); `git show --cc 32f9e16e` (no conflict hunk) and its stat; `git diff e13150c1 f091dddd` over the header path (empty); `git grep EXPORT_FILE_NAME_STEM_MAX_LENGTH\|fitParts` at the head (none).
- Records read: DL-297 and PRD v0.34 NFR-032 (`origin/docs/AQP-1-records-t`); the proxy kinds in `deploy/windows/README.md` and `install.ps1`.
- CI: `gh run list --commit f091dddd`; I watched run 45022922606 until it completed (success, all 6 jobs) and read Nightly 45022922612
- No local run.

---

## Addendum 3: QLT-14 and QLT-15 at `0d20b749` (2026-11-22)

`0d20b749` (2 files) fixes **QLT-14 (Minor)**: `limits-single-source.test.ts` adds three tests that read `CUSTOMER_SHORT_NAME_MAX_LENGTH` and `SUBJECT_MAX_LENGTH`. They check that short name + subject + 17 is under 255, that the UTF-16 worst case 2 × (short name + subject) + 17 is under 255 (197 today), and that the builder really adds exactly 17 characters. It also fixes **QLT-15 (Info)** (the `isExportFileName` comment now states the 107 form-limit bound and points to the test) and QLT-13 (the missing space). The header path is untouched. The PR head is now `42fcb118`, a clean update-branch merge of `master` `34bc3250` (#494, records only; `git show --cc` has no conflict hunk). CI run 45027769723 on `42fcb118` was queued at the time of writing; the merge gate is a fully green CI (CLAUDE.md §9 item 1). **Verdict: APPROVE WITH COMMENTS. Open: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 7** (QLT-04, 05, 06, 08, 10, 11 and 12).
