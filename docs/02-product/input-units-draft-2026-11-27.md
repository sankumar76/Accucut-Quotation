# Unit list for the part form's number inputs (accepted)

> **Accepted by the delivery lead on 2026-11-26, option A: "Use the draft list exactly as above" (master's DL-420). OQ-UX-07, input half, is closed.** Cutting Length (mm) and Weld (nos), which the SPEC does not give, are now the delivery lead's word. The file keeps "draft" in its name only so that earlier references resolve; the content below is the accepted list. DEF-125 (AQP-482) builds it.

| Field | Value |
|---|---|
| For | DEF-125 (AQP-482, GitHub #776); OQ-UX-07, input half; master's DL-418 (5) |
| Author / date | product-manager, 2026-11-26 (due end of Fri 27 Nov); accepted 2026-11-26 (DL-420) |
| Read from | `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` (SPEC 1.20) section 7.1 (the inputs), 7.4 (the formulas) and 4.1 (the Process Master units, D-38); `docs/03-ux/screens/SCR-05.html` (the mock-up's add-ons); `prisma/seed/config/seed-config.ts` and `src/lib/estimate/form-fields.ts` (what the build already shows); DEF-125 |
| Not done | I did not run the build. I did not read the sample workbook (NFR-006). No value, rate or cost figure is used anywhere here |

## The finding in one paragraph

**SPEC 7.1 gives no unit for any input.** It names the field, the column letter and the type, and nothing more. The units in the mock-up were inferred from the formulas (ux-spec OQ-UX-07). I checked each one against the SPEC's own formulas (7.4) and the delivery lead's list of rate units (4.1, D-38). **15 of the 17 number fields have a unit that the SPEC's formulas or rate units support. Two do not: Cutting Length (Q) and Weld (V).** For three fields the unit is a count and the SPEC does not say which word to show (nos, strokes or pieces).

## How to read the marks

| Mark | Meaning |
|------|---------|
| **S** | **The SPEC settles it**: the unit is the one a rate or formula in the SPEC needs |
| **D** | **Derived**: the SPEC's formula only works in this unit (a dimension check), but the SPEC never writes the word |
| **W** | The dimension is settled (a count); **the word shown is a choice** (the mock-up uses "nos") |
| **U** | **The SPEC does not settle it** |

## The list (17 number fields, in form order)

"Build today" is what the running build shows (seed config and the form's fallback, read on `master`); "Draft" is the unit I propose, which is the mock-up's add-on in every row.

| # | Section | Letter | Field key | Label | Draft unit | Build today | Mark | Basis |
|---|---|---|---|---|---|---|---|---|
| 1 | 01 Part Details | H | `qty-per-assy` | QTY per Assy | **nos** | none | **W** | SPEC 7.1 and 7.3: "the number of pieces" for the whole order. The count is settled; "nos" is the mock-up's word |
| 2 | 02 Material and Dimensions | J | `length` | Length | **mm** | none | **D** | AH = (J × K × 2) / 645 (about 645 square millimetres make a square inch) and M = (L × K × J × Material-Specific-Gravity) / 1,000,000 (millimetres to kilograms) |
| 3 | | K | `width` | Width | **mm** | none | **D** | The same two formulas |
| 4 | | L | `thickness` | Thickness | **mm** | none | **D** | The blank-weight formula needs L in the same unit as J and K |
| 5 | | N | `part-weight` | Part Weight | **kg** | kg | **S** | O = M − N with M in kg; welding, galvanizing and shot blasting are priced per kg of N (`Welding-rate-per-kg`, `Dip-Galvanizing-Cost-per-kg`, `Shot-Blasting-rate-per-kg`) |
| 6 | 03 Cutting Process | P | `cutting-time` | Cutting Time | **sec** | sec | **S** | AL = P × `Cutting-Rate-per-Sec` (the rate is per second, SPEC 4.1) |
| 7 | | Q | `cutting-length` | Cutting Length | **mm** | none | **U** | **No formula in the SPEC uses Q.** The word "length" and the other three lengths suggest mm, and the mock-up says mm, but nothing in the SPEC says so |
| 8 | 04 Bending | R | `bend-count` | No. of Bend | **nos** | none | **W** | AM = R × `Bending-Rate-per-stroke` (per stroke, SPEC 4.1), so R counts strokes. Whether to show "nos", "strokes" or "bends" is a word choice |
| 9 | 05 Fasteners | T | `fasteners-qty` | Fasteners Qty | **nos** | none | **W** | AZ = T × U, so T is a count of fasteners |
| 10 | | U | `fasteners-cost` | Fasteners Cost | **₹ / pc** | ₹ | **D** | AZ = T × U, so U is the cost of one fastener. The build shows "₹" only; the mock-up shows "₹ / pc" |
| 11 | 06 Welding | V | `weld` | Weld | **nos** | none | **U** | AO = N × `Welding-rate-per-kg` × V: **V is a multiplier on the weight-based welding cost.** The SPEC does not say what it counts (welds, passes, a length). "nos" is the mock-up's guess |
| 12 | | W | `drilling` | Drilling | **holes** | none | **S** | AN = (W + X + Y) × `Drilling-Tapping-Rate` (per hole, SPEC 4.1) |
| 13 | | X | `tapping` | Tapping | **holes** | none | **S** | The same formula |
| 14 | | Y | `csk` | CSK | **holes** | none | **S** | The same formula |
| 15 | 08 Other Costs and Remarks | AP | `machining-cost` | Machining Cost | **₹** | ₹ | **D** | Added into the Process Total, which is in rupees (AY, then BG "INR") |
| 16 | | AU | `plating-cost` | Plating Cost | **₹** | ₹ | **D** | The same |
| 17 | | BM | `tool-cost` | Tool Cost | **₹** | ₹ | **D** | BN = BL / SUM(BM), both in INR |

The eight surface-treatment flags (Z to AG), Fasteners (S), Remarks (AJ) and the picture (C) take no unit.

**Eleven fields have no unit in the build today** (H, J, K, L, Q, R, T, V, W, X, Y); six already have one (N, P, U, AP, AU, BM). So the fix is a registry change for eleven fields plus "/ pc" on U, as DEF-125 says.

## Fields the SPEC does not settle, and what I recommend

| Field | Open point | My recommendation |
|-------|------------|-------------------|
| **Q Cutting Length** | The unit of a field no formula uses | **mm**, with the other lengths. If the delivery lead does not know, leave it with the mock-up's mm and note that no calculation depends on it |
| **V Weld** | What the number counts | Keep **nos** for now. If the delivery lead says the field is a length, a weight or a count of passes, change the word. A wrong word here misleads an Engineer, but no calculation changes |
| H, R, T (the word) | "nos" against "pieces" or "strokes" | Keep the mock-up's **nos** for all three; R could read "strokes" if the delivery lead prefers the rate's own word |

## The one question for the delivery lead (for the orchestrator to ask)

"The input fields get a unit beside them (mm, kg, sec, nos, holes, ₹). The agreed specification gives the unit for most of them from the formulas, but not for two: **Cutting Length** (I propose mm) and **Weld** (I propose nos). What do you want? **A: accept the draft list (recommended).** **B: correct the marked fields** (Cutting Length, Weld, or the word nos)."

If they choose A, DEF-125 stays in lane 3 and ships with the list above. If they choose B, they name the unit for each field they correct. Either way the list is the registry's, not the component's (DEF-125's proof), so a unit can be changed later without a code change.

## What does not change

No FR, NFR, priority or release changes. The units are labels beside inputs, not stored values or rules; no calculation, export column or cost figure is affected (NFR-002 untouched). OQ-UX-07's input half closes with the answer (the rate half closed on 3 Nov, D-38).
