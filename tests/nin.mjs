// Translation picks the accepted answer your writing fits best: a 你 with a stroke off must stay 你, not become 您
// (您 is 你 over 心, so its first 7 strokes can match). Run from the repo root: node tests/nin.mjs
import fs from "node:fs"; import assert from "node:assert";
const html = fs.readFileSync("app/index.html", "utf8");
const at = html.indexOf("const Mark = (() => {");
const Mark = new Function(html.slice(at, html.indexOf("})();", at) + 5) + "; return Mark;")();
const S = JSON.parse(fs.readFileSync("app/strokes.json", "utf8"));
const score = m => m.good - Math.abs(m.expected - m.drawn); // the rule markInk uses to choose between answers
// the book's own strokes, with one stroke (bend) bent away
const ink = (c, bend) => S[c].medians.map((m, i) => m.map(([x, y], k) => ({ x: x + (i === bend ? k * 60 : 0), y: y + (i === bend ? -k * 50 : 0), w: 1, t: k * 16 })));
let n = 0;
for (const mode of ["standard", "lenient", "free"]) for (const [wrote, other] of [["你", "您"], ["您", "你"]]) for (let bend = -1; bend < S[wrote].medians.length; bend++) {
  const u = ink(wrote, bend), s1 = score(Mark.character(u, S[wrote], mode, 300)), s2 = score(Mark.character(u, S[other], mode, 300));
  assert(s1 > s2, `${mode}: wrote ${wrote} (stroke ${bend} bent) scored ${s1}, ${other} ${s2}`); n++;
}
console.log("ok", n, "cases");
