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
  async function setMode(m) { await p.click('#settingsBtn'); await p.click(`#segMark button[data-v="${m}"]`); await p.click('#done'); }
  async function drawWord(transform) {
    await p.waitForSelector('.box canvas'); await p.waitForTimeout(200);
    const py = await p.textContent('.py'), hint = await p.$eval('.hint', e => e.firstChild.textContent);
    const w = W.find(x => x.p === py && x.h === hint);
    for (let k = 0; k < w.t.length; k++) {
      const cv = await p.$(`.box[data-k="${k}"] canvas`); const bb = await cv.boundingBox();
      const size = bb.width, pad = Math.round(size * 0.06), scale = (size - 2*pad)/1024;
      let meds = S[w.t[k]].medians.slice(); meds = transform(meds);
      for (const med of meds) {
        const pts = med.map(([x,y]) => [bb.x + x*scale + pad, bb.y + size - 124*scale - pad - y*scale]);
        await p.mouse.move(...pts[0]); await p.mouse.down();
        for (let i = 1; i < pts.length; i++) await p.mouse.move(...pts[i], { steps: 4 });
        await p.mouse.up();
      }
    }
    await p.click('#checkBtn'); await p.waitForTimeout(300);
    return [w.d, await p.textContent('#fb'), await p.$$eval('.mnote', es => es.map(e => e.textContent))];
  }
  const rev = m => m.slice().reverse();
  for (const [mode, tf, name] of [['standard', m => m, 'correct'], ['standard', rev, 'reversed order'], ['free', rev, 'reversed order'], ['standard', m => m.slice(1), 'missing stroke']]) {
    await setMode(mode);
    await p.click('#startCur'); await p.click('#go');
    console.log(mode, name, JSON.stringify(await drawWord(tf)));
    await p.screenshot({ path: `t_${mode}_${name.replace(' ','_')}.png` });
    await p.click('#quit');
  }
  console.log('ERR', errs);
  await b.close();
})();
