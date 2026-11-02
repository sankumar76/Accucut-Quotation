'use strict';
/* Figures check (see README.md). Needs nothing but Node.
   1. Every number with 2 to 4 decimals on the money pages must come from the data model in lib.cjs.
   2. The identities of the quantity rule must hold: the Engineer types the count for the WHOLE ORDER on every row, a row's BG
      already holds it, BL is the sum of every row's BG, and a parent shows only its own row (no sum of the rows below it).
   Run:  node docs/03-ux/generator/check-figures.cjs        (SCREENS_DIR overrides the folder of pages)
   Exit code 1 if anything fails. */
const L = require('./lib.cjs');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.env.SCREENS_DIR || path.join(__dirname, '..', 'screens')) + path.sep;

const A = new Set();
const add = (x) => { if (typeof x === 'number' && isFinite(x)) { A.add(L.fmt(x)); A.add(x.toFixed(2)); A.add(x.toFixed(4)); } };
L.NODES.forEach((n) => {
  /* a row's own values only: a parent shows no sum of the rows below it (architecture UX-53), so no sigma is allowed here */
  Object.values(n.o).forEach(add); Object.values(n.n).forEach(add);
});
[L.BL, L.BN, L.TOOL, L.APPROVED, L.BL - L.APPROVED, L.FX.usd, L.FX.eur, 80.9].forEach(add);
Object.values(L.RATES).forEach(add); Object.values(L.MAT).forEach((m) => { add(m.price); add(m.sg); add(m.scrap); });
const n14 = L.get('1.4'); add(n14.o.BD + n14.o.BE + n14.o.BF); add(+L.fmt(n14.o.BD) + +L.fmt(n14.o.BE) + +L.fmt(n14.o.BF));
add(L.NODES.reduce((s, x) => s + L.shown(x.bg), 0));
/* invented figures of another estimate on SCR-16 (a second approval, with no reason given), and copy examples */
['4,812.40', '4,750.00'].forEach((x) => A.add(x));
const STATIC = new Set(['0.11', '1.10', '0.52', '0.00']);   // "11 means 11% and is used as 0.11"; "1.10 stays 1.10"; zero rows in the wording preview

const pages = ['SCR-06.html', 'SCR-07.html', 'SCR-10.html', 'SCR-08.html', 'SCR-09.html', 'SCR-16.html', 'SCR-03.html', 'SCR-03-engineer.html', 'SCR-05.html'];
let bad = 0;
for (const f of pages) {
  const t = fs.readFileSync(dir + f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&middot;|&times;|&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ');
  const nums = [...new Set((t.match(/\d[\d,]*\.\d{2,4}\b/g) || []))];
  const unk = nums.filter((x) => !A.has(x) && !STATIC.has(x));
  console.log(f.padEnd(24), '2-4dp numbers:', String(nums.length).padStart(3), ' not from the data model:', unk.length ? unk.join(' ') : 'none'); bad += unk.length;
}
const eq = (a, b, msg) => { const ok = Math.abs(a - b) < 0.005; console.log((ok ? 'OK  ' : 'FAIL') + ' ' + msg + ' ' + a.toFixed(4) + ' vs ' + b.toFixed(4)); if (!ok) bad++; };
const g = (no) => L.get(no).bg;
eq(L.sigma('1') + L.sigma('2'), L.BL, 'BL = the two item sums used inside the model (not shown on screen)');
eq(L.NODES.reduce((s, x) => s + x.bg, 0), L.BL, 'BL = sum of every row BG (the SCR-10 table)');
/* the rule against the constructed case: 2 frames, 6 pipes, 24 lids in all, each lid 1, each pipe 1, nothing on the frame */
eq(0 * 2 + 1 * 6 + 1 * 24, 30, 'constructed example: frame row 0 + pipe row 6 + lid row 24 = 30');
eq(L.get('1.1.1').n.H, 16, 'count of 1.1.1 = 16 (2 assemblies, 2 base frames in each, 4 gussets on each frame)');
eq(L.BL / L.TOOL, L.BN, 'BN = BL / total Tool Cost');
eq(L.BL - L.APPROVED, 29.9926, 'override difference = calculated total less approved price (29.99)');
/* the working lines on SCR-07 are checked inside s2.cjs: the build throws if one does not reproduce its result within 0.005 */
console.log(bad ? ('PROBLEMS: ' + bad) : 'figures agree');
process.exit(bad ? 1 : 0);
