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
  await p.screenshot({ path: 'l_home.png' });
  await p.click('#modeLearn'); await p.screenshot({ path: 'l_hub.png' });
  await p.click('[data-t="list"]'); await p.click('.wrow:nth-child(3) .whead'); await p.waitForTimeout(1500); await p.screenshot({ path: 'l_list.png' });
  await p.click('#backLearn'); await p.click('[data-t="cards"]'); await p.click('#cgo');
  await p.screenshot({ path: 'l_card_front.png' });
  await p.click('#flash'); await p.waitForTimeout(800); await p.screenshot({ path: 'l_card_back.png' });
  await p.click('[data-r="again"]');
  for (let i=0;i<30;i++){ if(!(await p.$('#flash'))) break; await p.click('#flash'); await p.waitForTimeout(50); await p.click('[data-r="good"]'); }
  await p.screenshot({ path: 'l_cards_done.png' });
  await p.click('#weakTrace'); await p.waitForSelector('.box canvas'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'l_trace.png' });
  await p.click('#revealBtn'); await p.click('#nextBtn'); await p.waitForTimeout(300);
  console.log('copy eyebrow:', await p.textContent('.prompt .eyebrow'));
  await p.click('#quit');
  await p.click('#brand'); await p.click('#modeLearn'); await p.click('[data-t="match"]');
  await p.screenshot({ path: 'l_match.png' });
  // solve round 1 with one mistake
  const ids = await p.$$eval('.mcol:first-child .tile', ts => ts.map(t => t.dataset.id));
  await p.click(`.mcol:first-child .tile[data-id="${ids[0]}"]`); await p.click(`.mcol:last-child .tile[data-id="${ids[1]}"]`);
  for (const id of ids) { await p.click(`.mcol:first-child .tile[data-id="${id}"]`); await p.click(`.mcol:last-child .tile[data-id="${id}"]`); }
  await p.waitForTimeout(500); console.log('match:', await p.textContent('.count'));
  await p.click('#quit'); await p.screenshot({ path: 'l_match_done.png' });
  await p.click('#toLearn'); await p.click('[data-t="tones"]');
  const cols = await p.$$('.tcol'); for (const c of cols) await (await c.$('.tbtn[data-n="3"]')).click();
  await p.click('#tCheck'); await p.screenshot({ path: 'l_tones.png' });
  console.log('ERR', errs);
  await b.close();
})();
