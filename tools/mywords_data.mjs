// Builds the data behind "My words" (adding your own words), from CC-CEDICT and hanzi-writer-data:
//   app/dict.txt        simplified words: characters, numbered pinyin, a short English gloss (CC BY-SA 4.0)
//   app/hw.txt          stroke medians of every character, coarsened, for the handwriting recogniser
//   app/t2s.txt         traditional to simplified, two characters per pair, for speech recognised in traditional characters
//   app/strokes/NN.json full stroke data of characters not in app/strokes.json, 64 shards loaded on demand
// Run from the repo root: node tools/mywords_data.mjs <cedict_1_0_ts_utf-8_mdbg.txt> <hanzi-writer-data package folder>
import fs from "node:fs";
import path from "node:path";

const [cedict, hwd] = process.argv.slice(2);
if (!cedict || !hwd) { console.error("usage: node tools/mywords_data.mjs <cedict.txt> <hanzi-writer-data/package>"); process.exit(1); }
const HAN = /^[\p{Script=Han}〇]+$/u;
const char = c => { try { return JSON.parse(fs.readFileSync(path.join(hwd, c + ".json"), "utf8")); } catch { return null; } };

// one line per simplified word and reading; senses that only point elsewhere are dropped
const entries = new Map(), t2s = new Map();
for (const line of fs.readFileSync(cedict, "utf8").split("\n")) {
  const m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/)?.slice(1);
  if (!m || !HAN.test(m[1])) continue;
  // traditional → simplified, character by character, from the words that pair them
  const tc = [...m[0]], sc = [...m[1]];
  if (tc.length === sc.length) tc.forEach((c, i) => { if (c !== sc[i] && !t2s.has(c)) t2s.set(c, sc[i]); });
  const senses = m[3].split("/").filter(s => s && !/^(old |archaic |erhua |Japanese |)variant of |^CL:|^see |^used in |^abbr\. for /.test(s));
  if (!senses.length) continue;
  const key = m[1] + "\t" + m[2].replace(/u:/g, "v");
  const prev = entries.get(key) || [];
  entries.set(key, prev.concat(senses));
}
const lines = [];
for (const [key, senses] of entries) {
  let h = "";
  for (const s of [...new Set(senses)]) { if (h && h.length + s.length > 70) break; h += (h ? "; " : "") + s; }
  lines.push(key + "\t" + h.replace(/\t/g, " "));
}
fs.writeFileSync("app/dict.txt", lines.join("\n"));
fs.writeFileSync("app/t2s.txt", [...t2s].map(([t, s]) => t + s).join(""));

// every character the dictionary or the course uses, if hanzi-writer-data has it
const course = JSON.parse(fs.readFileSync("app/strokes.json", "utf8"));
const chars = new Set(Object.keys(course));
for (const key of entries.keys()) for (const c of key.split("\t")[0]) chars.add(c);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const q = v => B64[Math.max(0, Math.min(63, Math.round(v / 16)))]; // 1024 units to 64 steps
const hw = [], shards = Array.from({ length: 64 }, () => ({}));
for (const c of [...chars].sort()) {
  const d = course[c] || char(c);
  if (!d) continue;
  // y in hanzi-writer-data runs up from -124; store it top-down, 0 to 1024
  hw.push(c + d.medians.map(m => m.map(([x, y]) => q(x) + q(900 - y)).join("")).join(","));
  if (!course[c]) shards[c.codePointAt(0) % 64][c] = { strokes: d.strokes, medians: d.medians };
}
fs.writeFileSync("app/hw.txt", hw.join("\n"));
fs.mkdirSync("app/strokes", { recursive: true });
shards.forEach((s, i) => fs.writeFileSync(`app/strokes/${String(i).padStart(2, "0")}.json`, JSON.stringify(s)));
console.log(`${lines.length} dictionary lines, ${hw.length} characters for recognition, ${chars.size - hw.length} without stroke data`);
