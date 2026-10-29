// Checks app/lessons.json: every lesson has a reading with 3 questions, every gap question has one blank,
// no question repeats an option, and every grammar example is plain words separated by spaces.
// Run from the repo root: node tests/lessons-check.js
const T = require("../app/lessons.json");
const words = require("../app/words.json");
const bad = [];
const dupes = (where, opts) => { if (new Set(opts).size !== opts.length) bad.push(`${where}: repeated option in ${opts}`); };
for (const l of new Set(words.map(w => w.l))) {
  const c = T[l];
  if (!c) { bad.push(`${l}: no entry`); continue; }
  if (!c.r || c.r[1].length !== 3) bad.push(`${l}: reading needs 3 questions`);
  else c.r[1].forEach(([q, o]) => dupes(`${l} reading "${q}"`, o));
  if (!c.g || !c.g.length) bad.push(`${l}: no grammar points`);
  else c.g.forEach(([title, , ex, gaps]) => {
    gaps.forEach(([s, o]) => { if (s.split("＿").length !== 2) bad.push(`${l} ${title}: "${s}" needs exactly one ＿`); dupes(`${l} "${s}"`, o); });
    ex.forEach(([zh]) => { if (/[，。？！]/.test(zh)) bad.push(`${l} ${title}: punctuation in example "${zh}"`); });
  });
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("lessons.json ok");
