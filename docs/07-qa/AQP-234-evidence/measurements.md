# AQP-234 G7 measurements

Written by QA from the files `tests/e2e/aqp-234-qa.spec.ts` produced on 2026-11-09 (development server, throwaway PostgreSQL 17, Chromium, Playwright 1.64.1). They are tables and not JSON files because the CI data-file check (ADR-014) refuses tracked `.json` files. Widths are CSS px. "Region" is the table region of the page (`role="region"`).

## G7-1: row actions of SCR-13 and SCR-11 (a 100-character name and an ordinary row in the list)

### SCR-13

| Viewport | Region | Table content (`scrollWidth`) | Region `clientWidth` | Table scrolled (`scrollLeft`) | Page overflow | Row actions measured | Any outside the region or covered |
|---|---|---|---|---|---|---|---|
| 768 | 718 | 718 | 718 | 0 | 0 | 25 | none (the test fails otherwise) |
| 1023 | 973 | 973 | 973 | 0 | 0 | 27 | none (the test fails otherwise) |
| 1024 | 710 | 710 | 710 | 0 | 0 | 29 | none (the test fails otherwise) |
| 1279 | 965 | 965 | 965 | 0 | 0 | 31 | none (the test fails otherwise) |
| 1280 | 966 | 966 | 966 | 0 | 0 | 33 | none (the test fails otherwise) |
| 1366 | 1052 | 1052 | 1052 | 0 | 0 | 35 | none (the test fails otherwise) |
| 1440 | 1126 | 1126 | 1126 | 0 | 0 | 37 | none (the test fails otherwise) |

### SCR-11

| Viewport | Region | Table content (`scrollWidth`) | Region `clientWidth` | Table scrolled (`scrollLeft`) | Page overflow | Row actions measured | Any outside the region or covered |
|---|---|---|---|---|---|---|---|
| 768 | 718 | 718 | 718 | 0 | 0 | 80 | none (the test fails otherwise) |
| 1023 | 973 | 973 | 973 | 0 | 0 | 84 | none (the test fails otherwise) |
| 1024 | 710 | 710 | 710 | 0 | 0 | 88 | none (the test fails otherwise) |
| 1279 | 965 | 965 | 965 | 0 | 0 | 92 | none (the test fails otherwise) |
| 1280 | 966 | 966 | 966 | 0 | 0 | 96 | none (the test fails otherwise) |
| 1366 | 1052 | 1052 | 1052 | 0 | 0 | 100 | none (the test fails otherwise) |
| 1440 | 1126 | 1126 | 1126 | 0 | 0 | 104 | none (the test fails otherwise) |

## G7-2: the other delivered tables (seed data)

| Screen | Viewport | Tables | Region | Content | Table scrolls | Row actions | Outside region | Covered | Page overflow |
|---|---|---|---|---|---|---|---|---|---|
| SCR-14 Users | 768 | 1 | 718 | 718 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1023 | 1 | 973 | 973 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1024 | 1 | 710 | 710 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1279 | 1 | 965 | 965 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1280 | 1 | 966 | 966 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1366 | 1 | 1052 | 1052 | false | 15 | 0 | 0 | 0 |
| SCR-14 Users | 1440 | 1 | 1126 | 1126 | false | 15 | 0 | 0 | 0 |
| SCR-16 Audit | 768 | 1 | 718 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1023 | 1 | 973 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1024 | 1 | 710 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1279 | 1 | 965 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1280 | 1 | 966 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1366 | 1 | 1052 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-16 Audit | 1440 | 1 | 1126 | 2070 | true | 0 | 0 | 0 | 0 |
| SCR-03 Task queue | 768 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1023 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1024 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1279 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1280 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1366 | 0 | - | - | - | - | - | - | - |
| SCR-03 Task queue | 1440 | 0 | - | - | - | - | - | - | - |
| SCR-17 route probe /customers | - | - | - | - | - | - | - | - | HTTP 404 |

The last row is a probe of a path that does not exist (`/customers`, 404); SCR-17 has no route in `src/app`.

## G7-2b: SCR-14 Users with a 120-character name (no space) and a 254-character e-mail written into the first row

| Viewport | Region | Content as drawn | Table scrolls | Actions outside the region | Page overflow |
|---|---|---|---|---|---|
| 768 | 718 | 1603 | true | 18 of 18 | 0 |
| 1023 | 973 | 1603 | true | 18 of 18 | 0 |
| 1024 | 710 | 1603 | true | 18 of 18 | 0 |
| 1279 | 965 | 1603 | true | 18 of 18 | 0 |
| 1280 | 966 | 1603 | true | 18 of 18 | 0 |
| 1366 | 1052 | 1603 | true | 18 of 18 | 0 |
| 1440 | 1126 | 1603 | true | 18 of 18 | 0 |

The "forced to 1000 px" figures of the same run are not used: React re-rendered the row and reset the edit at some widths.

## G7-3 (QLT-06): row lines under the sticky Actions column, 1024 px, table forced to 1000 px in a 710 px region

A line is counted at a column when any pixel in a band of three pixel rows at the row boundary differs from the card surface. 1.00 means the line is drawn across the whole width of that part of the row. Screenshots: `qlt06-<screen>-<position>.png`.

| Screen | Scroll position | `scrollLeft` | Left edge of the Actions column | Row boundaries checked | Lowest share left of the column | Lowest share under the column |
|---|---|---|---|---|---|---|
| SCR-13 | start | 0 | 642 | 13 | 1.00 | 1.00 |
| SCR-13 | middle | 145 | 642 | 13 | 1.00 | 1.00 |
| SCR-13 | end | 290 | 642 | 13 | 1.00 | 1.00 |
| SCR-11 | start | 0 | 598 | 28 | 1.00 | 1.00 |
| SCR-11 | middle | 145 | 598 | 28 | 1.00 | 1.00 |
| SCR-11 | end | 290 | 598 | 28 | 1.00 | 1.00 |

## G7-7: keyboard order with the table forced to scroll (first presses of Tab from the region)

| Screen | Viewport | Row actions reached by Tab | First four |
|---|---|---|---|
| SCR-13 | 768 | 12 | Edit QA234-linea-r0-t0-c58fa; Edit QA234-lineb-r0-t0-c6bbb; Edit QA234-linec-r0-t0-87803; Edit QA234-kb768-r0-t0-df7c6 |
| SCR-13 | 1024 | 12 | Edit QA234-linea-r0-t0-c58fa; Edit QA234-lineb-r0-t0-c6bbb; Edit QA234-linec-r0-t0-87803; Edit QA234-kb768-r0-t0-df7c6 |
| SCR-11 | 768 | 12 | Edit Cutting-Rate-per-Sec; Delete Cutting-Rate-per-Sec; Edit Bending-Rate-per-stroke; Delete Bending-Rate-per-stro |
| SCR-11 | 1024 | 12 | Edit Cutting-Rate-per-Sec; Delete Cutting-Rate-per-Sec; Edit Bending-Rate-per-stroke; Delete Bending-Rate-per-stro |
