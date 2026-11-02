'use strict';
const s1 = require('./s1.cjs'), s2 = require('./s2.cjs'), s3 = require('./s3.cjs'), s4 = require('./s4.cjs'), s5 = require('./s5.cjs');
const made = [];
const run = (f) => { const m = f(); made.push(m.file); };
[s1.scr00, s1.scr01, s1.scr02, s1.scr03, s1.scr03e, s1.scr04,
  s2.scr05, s2.scr06, s2.scr07, s2.scr08, s2.scr09, s2.scr10,
  s3.scr11, s3.scr12, s3.scr13, s3.scr14, s3.scr15, s3.scr16, s3.scr23, s3.scr24, s3.scr25, s3.scr26,
  () => s4.scr17(false), () => s4.scr17(true), s4.scr18, s4.scr19, s4.scr20, s4.scr21, s4.scr22].forEach(run);
s5.DEVICES.forEach((d) => { s5.devicePage(d); made.push(d.file); });
const r = s5.buildIndex();
console.log(made.length + ' pages + index; index lists', r.count, 'screens and', r.states, 'state links');
