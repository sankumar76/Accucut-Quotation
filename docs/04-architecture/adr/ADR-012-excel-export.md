# ADR-012: Excel export with ExcelJS on a worker thread

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-066 to 071; NFR-010, 027; RISK-010; OQ-PM-05; Q-31; ADR-007 |

## Context
The export replicates the worksheet: columns A to BO, images in column C, currency formats, centred cells, BL, BN and BO in row 2. ExcelJS is the stated library. RISK-010 asked for a limit or a strategy: 500 nodes with images up to 200 KB could exceed 100 MB. ExcelJS's streaming worksheet has no `addImage` (read in the 4.4.0 source, `lib/stream/xlsx/worksheet-writer.js`), so embedded images need the in-memory workbook and the design must plan for memory. ExcelJS's last stable release is 4.4.0 of October 2023.

## Decision Drivers
- NFR-010: 50 nodes with 50 images within 10 s, and 500 ms p95 for other users meanwhile
- NFR-027: opens in Excel with no repair prompt
- FR-065: approved exports never change
- Simplicity: no job queue for a download

## Considered Options
### Option A — Build in memory on a `worker_threads` thread, gate large exports, stream the finished file
- Pros: the event loop stays free; a plain download; bounded by validation; no new infrastructure
- Cons: holds the file in memory while building; a thread entry file must be built and shipped
- Cost / effort: low

### Option B — Build on the main thread
- Pros: simplest
- Cons: seconds of blocked event loop for every other user
- Cost / effort: lowest, fails NFR-010 under load

### Option C — Background job through the `worker` container, with a "file ready" notice
- Pros: fully isolated
- Cons: file storage, status polling and clean-up to build, and a slower experience for the common small estimate
- Cost / effort: medium

### Option D — Generate XLSX by hand, or use a newer library
- Pros: no stale dependency
- Cons: high risk to NFR-027; leaves the stated stack
- Cost / effort: high

## Decision
We will use ExcelJS 4.4.0 (Option A), behind `src/server/export/build-workbook.ts`, whose only input is a plain `ExportModel`. The thread runs that function. Export reads one calculation record, `outputs` only, so a parent row holds its own values (D-12 (b3)). Cells hold full-precision numbers with two-decimal formats. Text is written as strings, never formulas. An empty cell stands for divide by zero. Row-2 cells are chosen in `product-cells.ts`, so Q-31 changes one file.

**Added at UX reconciliation.** The file holds one calculation record, so after inputs change it stays consistent but falls behind the screen, and `export-summary` returns `stale` so SCR-10 can say so (UX-05). A never-calculated estimate exports inputs with empty outputs (A-05). The file name's date is the IST date of the download. An Engineer gets no data from the file route, the summary route or the page. Because cells keep full precision, a Lead who adds a column in Excel gets the stored total, even though printed figures can differ by 0.01 (UX-02).

**No hard limit on size.** Validation caps the worst case at about 100 MB (500 × 200 KB). Evidence below shows that this builds, so a limit would only add a failure mode. One large export runs at a time (over 100 nodes), and another gets 503 with `Retry-After`. The proxy read timeout is at least 120 s.

**Evidence (2026-11-01).** Throwaway benchmark, invented data, in-memory ExcelJS 4.4.0 on an Intel i7-10510U with 8 GB, Node 24, 67 columns, one incompressible 199 KB image per row, excluding database reads. Runs shared one process, so memory figures are upper bounds.

| Nodes and images | Time | File | Peak memory |
|------------------|------|------|-------------|
| 50 | 1.7 to 1.8 s | 9.8 MB | 178 MB |
| 200 | 7.9 s | 39 MB | 312 MB |
| 500 | 16.9 s | 97.5 MB | 528 MB |

## Consequences
- Positive: NFR-010 is met with margin at 50 nodes on this evidence, and RISK-010 can be closed. The boundary makes a library swap possible (TD-01).
- Negative / trade-offs accepted: a 500-node export takes about 17 s on similar hardware. `npm audit` lists 9 moderate transitive advisories, in `archiver`, `glob`, `minimatch` and `uuid`. The export passes neither user-controlled glob patterns nor buffers to `uuid`, so reachability is judged low. CI blocks at high, so these stay visible but do not fail the build.
- Follow-up actions (with owners): architect reviews the library at each release; `overrides` if a transitive fix appears.

## Verification
Read-back tests of the generated file (cells, widths, formats, image anchors); timing on staging; manual open in Excel desktop before each release (NFR-027).
