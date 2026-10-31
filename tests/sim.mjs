// Marking simulator: runs the Mark module straight out of app/index.html on simulated handwriting.
// Run from the repo root: deno run --allow-read tests/sim.mjs [chars]   (or: node tests/sim.mjs)
// Correct writing should pass; wrong characters, out-of-order and backwards strokes should not.
import fs from "node:fs";
import { writer } from "./handwriting.mjs";
const html = fs.readFileSync("app/index.html", "utf8");
const at = html.indexOf("const Mark = (() => {");
const Mark = new Function(html.slice(at, html.indexOf("})();", at) + 5) + "; return Mark;")();
const S = JSON.parse(fs.readFileSync("app/strokes.json", "utf8"));
const W = JSON.parse(fs.readFileSync("app/words.json", "utf8"));

const { write, rnd, len } = writer(S);

const all = [...new Set(W.flatMap(w => [...w.t]))].filter(c => S[c]);
const only = (typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2))[0];
const chars = only ? [...only] : all;
const N = only ? 100 : 4;
const modes = ["standard", "lenient"];
const styles = { neat: { amt: 0.6 }, normal: { amt: 1 }, upright: { amt: 1, upright: true }, messy: { amt: 1.5, upright: true }, iphone: { amt: 1.2, finger: true, upright: true, px: 170 } };

for (const mode of modes) {
  const row = {}, worst = [];
  for (const [name, st] of Object.entries(styles)) {
    let ok = 0, tot = 0;
    for (const c of chars) {
      let k = 0;
      for (let n = 0; n < N; n++) { if (Mark.character(write(c, st), S[c], mode, st.px).correct) k++; }
      ok += k; tot += N;
      if (name === "normal") worst.push([c, k / N]);
    }
    row[name] = (100 * ok / tot).toFixed(1) + "%";
  }
  console.log(mode, "correct writing accepted:", JSON.stringify(row));
  if (!only) console.log("  hardest (normal):", worst.sort((a, b) => a[1] - b[1]).slice(0, 15).map(([c, r]) => c + " " + (100 * r).toFixed(0) + "%").join("  "));
  else for (const c of chars) {
    // which stroke fails most, and why
    const fails = {};
    for (let n = 0; n < N; n++) { const r = Mark.character(write(c, styles.upright), S[c], mode); r.marks.forEach((m, i) => { if (m !== "ok") { const k = `${i + 1} ${m}${r.why && r.why[i] ? ": " + r.why[i] : ""}`; fails[k] = (fails[k] || 0) + 1; } }); }
    console.log(" ", c, Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ×${v}`).join(" | "));
  }
}

// errors that must still be caught (neat writing, so a miss is the marker's fault, not the noise)
const pool = all.filter(c => S[c].medians.length >= 3);
const caught = Object.fromEntries(modes.map(m => [m, { swap: 0, back: 0, other: 0, turned: 0, moved: 0 }]));
let n = 0, nt = 0;
const centre = st => st.reduce((a, p) => ({ x: a.x + p.x / st.length, y: a.y + p.y / st.length }), { x: 0, y: 0 });
for (const c of pool) {
  const s = write(c, styles.neat), k = Math.floor(rnd() * (s.length - 1));
  const swap = s.slice(); [swap[k], swap[k + 1]] = [swap[k + 1], swap[k]];
  const back = s.slice(); back[k] = back[k].slice().reverse();
  const o = pool.find(x => x !== c && S[x].medians.length === s.length && !S[x].medians.every((m, i) => Math.hypot(m[0][0] - S[c].medians[i][0][0], m[0][1] - S[c].medians[i][0][1]) < 120));
  // the longest stroke turned a quarter turn about its middle (a 横 written as a 竖), or moved a third of the box away
  const li = s.map((st, i) => [len(st), i]).sort((a, b) => b[0] - a[0])[0][1], cc = centre(s[li]);
  const turned = s.slice(); turned[li] = s[li].map(p => ({ x: cc.x - (p.y - cc.y), y: cc.y + (p.x - cc.x) }));
  const a = rnd() * 2 * Math.PI, moved = s.slice(); moved[li] = s[li].map(p => ({ x: p.x + 340 * Math.cos(a), y: p.y + 340 * Math.sin(a) }));
  n++;
  for (const mode of modes) {
    if (!Mark.character(swap, S[c], mode).correct) caught[mode].swap++;
    if (!Mark.character(back, S[c], mode).correct) caught[mode].back++;
    if (!o || !Mark.character(write(o, styles.neat), S[c], mode).correct) caught[mode].other++;
    if (!Mark.character(turned, S[c], mode).correct) caught[mode].turned++;
    if (!Mark.character(moved, S[c], mode).correct) caught[mode].moved++;
  }
}
for (const mode of modes) console.log(mode, `caught of ${n}: order swap ${caught[mode].swap}, backwards ${caught[mode].back}, different character ${caught[mode].other}, stroke turned 90° ${caught[mode].turned}, stroke moved a third of the box ${caught[mode].moved}`);

// real handwriting that was marked wrong before, traced from screenshots (box pixels, top-left origin, box size)
const REAL = [
  { c: "也", px: 429, strokes: [[[87,100],[107,105],[227,95],[342,80],[344,125],[337,225],[317,210],[297,180]], [[245,25],[245,105],[245,185]], [[139,33],[142,105],[142,255],[157,285],[217,300],[307,300],[367,290],[412,273],[415,195],[419,115]]] },
];
for (const r of REAL) {
  const k = r.px / 1024, toChar = ([x, y]) => ({ x: x / k, y: (r.px - 124 * k - y) / k });
  const res = Mark.character(r.strokes.map(s => s.map(toChar)), S[r.c], "standard", r.px);
  console.log("real", r.c, res.correct ? "passes" : "FAILS: " + res.why.filter(Boolean).join(", "));
}
