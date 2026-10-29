const { chromium } = require('playwright');
const fs = require('fs');
const W = JSON.parse(fs.readFileSync('app/words.json')), S = JSON.parse(fs.readFileSync('app/strokes.json'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/jsdelivr/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync('../pkgs/hw/package/dist/hanzi-writer.min.js','utf8') }));
  await p.route(/fonts.g/, r => r.abort());
  await p.route('http://localhost:8765/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('app/index.html','utf8') + '</body></html>' }));
  await p.goto('http://localhost:8765/');
  await p.waitForSelector('.lesson');
  await p.click('#startCur'); await p.click('#go');
  for (let round = 0; round < 2; round++) {
    await p.waitForSelector('.box .hw svg'); await p.waitForTimeout(300);
    const py = await p.textContent('.py'), hint = await p.$eval('.hint', e => e.firstChild.textContent);
    const w = W.find(x => x.p === py && x.h === hint);
    console.log('word', w.d);
    for (let k = 0; k < w.t.length; k++) {
      const svg = await p.$(`.box[data-k="${k}"] .hw svg`); const bb = await svg.boundingBox();
      const size = bb.width, pad = Math.round(size * 0.06), scale = (size - 2*pad)/1024, xo = pad, yo = 124*scale + pad;
      for (const med of S[w.t[k]].medians) {
        const pts = med.map(([x,y]) => [bb.x + x*scale + xo, bb.y + size - yo - y*scale]);
        await p.mouse.move(...pts[0]); await p.mouse.down();
        for (let i = 1; i < pts.length; i++) await p.mouse.move(...pts[i], { steps: 3 });
        await p.mouse.up(); await p.waitForTimeout(80);
      }
      await p.waitForTimeout(300);
    }
    await p.waitForTimeout(500);
    console.log('fb:', await p.textContent('#fb'));
    await p.screenshot({ path: `done${round}.png` });
    await p.click('#nextBtn');
  }
  await p.click('#quit'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'summary.png' });
  console.log('ERR', errs);
  await b.close();
})();
