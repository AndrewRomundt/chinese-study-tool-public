// Recognition test: writes every course character in each simulated style and checks where the
// recogniser (the Recog module in app/index.html, with app/hw.txt) ranks the right one among all characters.
// Run from the repo root: node tests/recog.mjs [chars]
import fs from "node:fs";
import { writer } from "./handwriting.mjs";
const html = fs.readFileSync("app/index.html", "utf8");
const at = html.indexOf("const Recog = (() => {");
const Recog = new Function(html.slice(at, html.indexOf("})();", at) + 5) + "; return Recog;")();
Recog.load(fs.readFileSync("app/hw.txt", "utf8"));
const S = JSON.parse(fs.readFileSync("app/strokes.json", "utf8"));
const W = JSON.parse(fs.readFileSync("app/words.json", "utf8"));
const { write, rnd } = writer(S, 11);
// harder than the marker tests: real writers also swap strokes and run two strokes together
const swapped = st => { st = st.slice(); for (let k = 0; k < 2 && st.length > 2; k++) { const i = Math.floor(rnd() * (st.length - 1)); [st[i], st[i + 1]] = [st[i + 1], st[i]]; } return st; };
const joined = st => { if (st.length < 3) return st; st = st.slice(); const i = Math.floor(rnd() * (st.length - 1)); st.splice(i, 2, st[i].concat(st[i + 1])); return st; };
// real writers also place and size the parts of a character on their own (亻 and 尔 in 你), and stretch or shorten strokes:
// the strokes after a random split point are moved and resized together, and every stroke is lengthened or shortened from its start
const parts = st => {
  const k = 1 + Math.floor(rnd() * (st.length - 1)), sc = 0.8 + rnd() * 0.4, dx = (rnd() - 0.5) * 220, dy = (rnd() - 0.5) * 220;
  const pts = st.slice(k).flat(), cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return st.map((s, i) => {
    const g = 0.7 + rnd() * 0.6, o = s[0];
    s = s.map(p => ({ x: o.x + (p.x - o.x) * g, y: o.y + (p.y - o.y) * g }));
    return i < k ? s : s.map(p => ({ x: cx + (p.x - cx) * sc + dx, y: cy + (p.y - cy) * sc + dy }));
  });
};
// handwriting traced from screenshots of the app (canvas pixels, y down), that the recogniser once missed
const REAL = [
  { c: "你", strokes: [[[310,240],[260,285],[200,335],[160,370],[140,383],[125,385]], [[242,395],[238,500],[232,600],[228,700]], [[440,200],[415,245],[388,292]],
    [[430,262],[520,255],[600,255],[640,272],[600,320],[535,368]], [[465,318],[470,450],[478,560],[470,690],[452,745],[430,720],[400,660],[385,608]],
    [[435,465],[410,490],[385,520]], [[600,462],[620,495],[640,525]]] },
];
const arg = process.argv[2], every = +(process.env.EVERY || 1);
const chars = (arg ? [...arg] : [...new Set(W.flatMap(w => [...w.t]))].filter(c => S[c])).filter((_, i) => i % every === 0);
const styles = { neat: { amt: 0.6 }, normal: { amt: 1 }, messy: { amt: 1.5, upright: true }, iphone: { amt: 1.2, finger: true, upright: true },
  "two strokes swapped": { amt: 1, f: swapped }, "two strokes joined": { amt: 1, f: joined }, "parts moved and resized": { amt: 1, upright: true, f: parts } };
const t0 = Date.now();
for (const [name, st] of Object.entries(styles)) {
  let top1 = 0, top5 = 0, top8 = 0; const miss = [];
  for (const c of chars) {
    // the medians are y-up from the font's baseline; writing runs y-down, as on a canvas
    const r = Recog.rank((st.f || (x => x))(write(c, st)).map(s => s.map(p => ({ x: p.x, y: 900 - p.y }))), 8), i = r.indexOf(c);
    if (i === 0) top1++; if (i >= 0 && i < 5) top5++; if (i >= 0) top8++; else miss.push(c + "→" + r.slice(0, 3).join(""));
  }
  const pc = n => (100 * n / chars.length).toFixed(1) + "%";
  console.log(`${name}: first ${pc(top1)}, top 5 ${pc(top5)}, top 8 ${pc(top8)}`, arg ? miss.join(" ") : miss.slice(0, 12).join(" "));
}
for (const r of REAL) { const k = Recog.rank(r.strokes.map(s => s.map(([x, y]) => ({ x, y }))), 8).indexOf(r.c); console.log("real", r.c, k < 0 ? "not in the top 8" : k === 0 ? "first" : `number ${k + 1}`); }
console.log(`${chars.length} characters × 7 styles in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
