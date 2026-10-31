// Photo test: runs the photo reader (the Paddle module in app/index.html) on real photos of handwritten Chinese
// and reports how many of each photo's characters it finds (recall) and how many of the characters it reports are
// right (precision). The photos are listed in tests/photos.json (Wikimedia Commons, freely licensed) and are
// downloaded on the first run; they are not kept in the repo. More photos: a folder of x.jpg with x.txt beside it
// (the characters in the photo), passed as the second argument.
// Run from the repo root: npm i puppeteer-core && node tests/photo.mjs [cache folder] [extra photos folder]
// Uses Chrome (set CHROME to its path if it is not in the usual place).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const cache = process.argv[2] || "../pkgs/photos", extra = process.argv[3];
const UA = "ZitieOCRTest/1.0 (https://github.com/AndrewRomundt)";
fs.mkdirSync(cache, { recursive: true });
const cases = [];
for (const p of JSON.parse(fs.readFileSync("tests/photos.json", "utf8"))) {
  const file = path.join(cache, p.file.replace(/^File:/, "").replace(/[\\/:*?"<>|]/g, "_"));
  if (!fs.existsSync(file)) {
    const q = new URLSearchParams({ action: "query", titles: p.file, prop: "imageinfo", iiprop: "url", iiurlwidth: "1400", format: "json" });
    const info = await fetch("https://commons.wikimedia.org/w/api.php?" + q, { headers: { "User-Agent": UA } }).then(r => r.json());
    const ii = Object.values(info.query.pages)[0].imageinfo[0];
    fs.writeFileSync(file, Buffer.from(await fetch(ii.thumburl || ii.url, { headers: { "User-Agent": UA } }).then(r => r.arrayBuffer())));
    await new Promise(r => setTimeout(r, 1000)); // be gentle with Commons
  }
  cases.push({ name: p.file, file, truth: p.truth });
}
if (extra) for (const f of fs.readdirSync(extra).filter(f => /\.(jpe?g|png)$/i.test(f))) {
  const t = path.join(extra, f.replace(/\.\w+$/, ".txt"));
  if (fs.existsSync(t)) cases.push({ name: f, file: path.join(extra, f), truth: fs.readFileSync(t, "utf8").trim() });
}

// the app's folder, served with the types the model runtime needs
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const server = http.createServer((q, r) => fs.readFile(path.join("app", decodeURIComponent(q.url.split("?")[0])), (e, d) => {
  if (e) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(q.url.split("?")[0])] || "application/octet-stream" }); r.end(d);
})).listen(0);
const port = server.address().port;
const html = fs.readFileSync("app/index.html", "utf8"), at = html.indexOf("const Paddle = (() => {");
const paddle = html.slice(at, html.indexOf("})();", at) + 5);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 900000 });
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/words.json`);
await page.addScriptTag({ content: paddle + "\nwindow.Paddle = Paddle;" });
let R = 0, Pr = 0;
for (const c of cases) {
  const url = "data:image/jpeg;base64," + fs.readFileSync(c.file).toString("base64");
  const text = await page.evaluate(async url => {
    const img = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = url; });
    return (await Paddle.lines(img)).filter(l => l.conf > 0.5).map(l => l.text).join(" ");
  }, url);
  const truth = new Set(c.truth), found = [...text].filter(ch => /\p{Script=Han}/u.test(ch)), hit = found.filter(ch => truth.has(ch));
  const recall = new Set(hit).size / truth.size, precision = found.length ? hit.length / found.length : 1;
  R += recall; Pr += precision;
  console.log(`${(100 * recall).toFixed(0).padStart(3)}% found, ${(100 * precision).toFixed(0).padStart(3)}% right  ${c.name.slice(0, 50)}  → ${text.replace(/\s+/g, " ").slice(0, 50)}`);
}
console.log(`${cases.length} photos: ${(100 * R / cases.length).toFixed(0)}% of characters found, ${(100 * Pr / cases.length).toFixed(0)}% of reported characters right`);
await browser.close(); server.close();
