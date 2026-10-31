// Simulated handwriting: writes a character from its stroke medians the way a person might, for the marking and recognition tests.
// writer(S) gives write(c, style) for the characters in S (stroke data keyed by character), plus the seeded random source it uses.
export function writer(S, seed = 7) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5; // roughly normal, within ±1
  const P = ([x, y]) => ({ x, y });
  const len = m => m.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - m[i].x, p.y - m[i].y), 0);
  const turn = (a, b, c) => { const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y }; return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1)))); };
  // the font's brush entry: a short first segment bent away from the rest; people never write it
  function dropEntry(m) { return m.length > 3 && len(m.slice(0, 2)) < 0.15 * len(m) && turn(m[0], m[1], m[2]) > 0.5 ? m.slice(1) : m; }
  // a hook: a short last segment that turns sharply; people write it short, tiny or not at all
  function hookAt(m) { for (let i = m.length - 2; i >= 1 && i >= m.length - 3; i--) if (turn(m[i - 1], m[i], m[i + 1]) > 1.2 && len(m.slice(i)) < 0.3 * len(m)) return i; return -1; }
  
  // one person's writing of a character. style: { amt: messiness, finger: big-tipped tiny strokes (iPhone) }
  function write(c, style) {
    const d = S[c], rad = new Set(d.radStrokes || []), amt = style.amt;
    // the radical and the rest are sized and placed a little independently, as real writers do
    const part = () => ({ s: 1 + g() * 0.12 * amt, dx: g() * 45 * amt, dy: g() * 45 * amt });
    const pr = part(), po = part();
    const meds = d.medians.map(m => m.map(P));
    const ctr = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const cr = ctr(meds.filter((_, i) => rad.has(i)).flat().concat([{ x: 512, y: 388 }])), co = ctr(meds.filter((_, i) => !rad.has(i)).flat().concat([{ x: 512, y: 388 }]));
    return meds.map((m, i) => {
      m = dropEntry(m);
      const h = hookAt(m), r = rnd();
      if (h > 0 && r < 0.35) m = m.slice(0, h + 1); // hook left off
      else if (h > 0 && r < 0.7) { const a = m[h], b = m[m.length - 1]; m = [...m.slice(0, h + 1), { x: a.x + (b.x - a.x) * 0.4, y: a.y + (b.y - a.y) * 0.4 }]; } // hook written short
      // the book's brush font slants its horizontals up and leans its verticals; handwriting is flatter and more upright
      if (style.upright) {
        const a = m[0], b = m[m.length - 1], ang = Math.atan2(b.y - a.y, b.x - a.x), q = Math.PI / 2;
        const near = Math.round(ang / q) * q, off = ang - near;
        if (Math.abs(off) < 0.6) {
          const th = -off * (0.5 + rnd() * 0.5), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          // only the main line straightens; a hook keeps its own turn relative to it
          m = m.map(p => ({ x: c.x + (p.x - c.x) * Math.cos(th) - (p.y - c.y) * Math.sin(th), y: c.y + (p.x - c.x) * Math.sin(th) + (p.y - c.y) * Math.cos(th) }));
        }
      }
      const L = len(m);
      // dots and very short strokes: a finger or a quick tap makes them longer and straighter than the font's
      if (L < 220 && Math.hypot(m.at(-1).x - m[0].x, m.at(-1).y - m[0].y) > 0.8 * L) {
        const grow = style.finger ? 1.4 + rnd() * 0.8 : 1 + rnd() * 0.5, a = m[0], b = m[m.length - 1], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const th = g() * 0.35;
        const v = { x: (b.x - a.x) / 2 * grow, y: (b.y - a.y) / 2 * grow }, w = { x: v.x * Math.cos(th) - v.y * Math.sin(th), y: v.x * Math.sin(th) + v.y * Math.cos(th) };
        m = [{ x: mid.x - w.x, y: mid.y - w.y }, { x: mid.x + w.x, y: mid.y + w.y }];
      }
      // the stroke itself: resized, turned and moved a little; ends wander; the line wobbles
      // a pen samples evenly along the line (the book's medians do not: their points can be 700 units apart)
      const pts = [];
      for (let k = 1; k < m.length; k++) { const n = Math.max(1, Math.ceil(Math.hypot(m[k].x - m[k - 1].x, m[k].y - m[k - 1].y) / 12)); for (let t = 0; t < n; t++) pts.push({ x: m[k - 1].x + (m[k].x - m[k - 1].x) * t / n, y: m[k - 1].y + (m[k].y - m[k - 1].y) * t / n }); }
      pts.push(m[m.length - 1]);
      const p = rad.has(i) ? pr : po, pc = rad.has(i) ? cr : co, c0 = ctr(pts);
      const sc = 1 + g() * 0.15 * amt, th = g() * 0.12 * amt, off = { x: g() * 30 * amt, y: g() * 30 * amt };
      const ph = rnd() * 6, wob = (style.finger ? 22 : 14) * amt * rnd();
      return pts.map((q, k) => {
        let x = (q.x - c0.x) * sc, y = (q.y - c0.y) * sc;
        const X = x * Math.cos(th) - y * Math.sin(th), Y = x * Math.sin(th) + y * Math.cos(th);
        const cx = pc.x + (c0.x - pc.x) * p.s + p.dx, cy = pc.y + (c0.y - pc.y) * p.s + p.dy;
        return { x: cx + X + off.x + Math.sin(k / 12 + ph) * wob, y: cy + Y + off.y + Math.cos(k / 15 + ph) * wob };
      });
    });
  }
  return { write, rnd, len };
}
