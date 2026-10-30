/* ---------------- Marking (stroke matching adapted from Hanzi Writer's quiz) ----------------
   Strokes are compared in the character's 1024-unit space against the stroke medians. */
const Mark = (() => {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mag = p => Math.hypot(p.x, p.y);
  const dist = (a, b) => mag(sub(a, b));
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const last = a => a[a.length - 1];
  const len = pts => pts.slice(1).reduce((acc, p, i) => acc + dist(p, pts[i]), 0);
  const cos = (a, b) => (a.x * b.x + a.y * b.y) / mag(a) / mag(b);
  const extend = (p1, p2, d) => { const v = sub(p2, p1), n = d / mag(v); return { x: p2.x + n * v.x, y: p2.y + n * v.y }; };
  function frechet(c1, c2) {
    const L = c1.length >= c2.length ? c1 : c2, S = c1.length >= c2.length ? c2 : c1;
    let prev = [];
    for (let i = 0; i < L.length; i++) {
      const cur = [];
      for (let j = 0; j < S.length; j++) {
        const d = dist(L[i], S[j]);
        if (i === 0 && j === 0) cur.push(d);
        else if (j === 0) cur.push(Math.max(prev[0], d));
        else if (i === 0) cur.push(Math.max(cur[j - 1], d));
        else cur.push(Math.max(Math.min(prev[j], prev[j - 1], cur[j - 1]), d));
      }
      prev = cur;
    }
    return prev[S.length - 1];
  }
  function subdivide(c, maxLen = 0.05) {
    const out = c.slice(0, 1);
    for (const p of c.slice(1)) {
      const q = last(out), l = dist(p, q);
      if (l > maxLen) { const n = Math.ceil(l / maxLen), s = l / n; for (let i = 0; i < n; i++) out.push(extend(p, q, -s * (i + 1))); }
      else out.push(p);
    }
    return out;
  }
  function outline(c, n = 30) {
    const seg = len(c) / (n - 1), out = [c[0]], end = last(c), rest = c.slice(1);
    for (let i = 0; i < n - 2; i++) {
      let lp = last(out), rem = seg;
      for (;;) {
        if (!rest.length) break;
        const nd = dist(lp, rest[0]);
        if (nd < rem) { rem -= nd; lp = rest.shift(); }
        else { out.push(extend(lp, rest[0], rem - nd)); break; }
      }
    }
    out.push(end);
    return out;
  }
  function normalize(c) {
    const o = outline(c), m = { x: avg(o.map(p => p.x)), y: avg(o.map(p => p.y)) };
    const t = o.map(p => sub(p, m));
    const s = Math.sqrt(avg([t[0].x ** 2 + t[0].y ** 2, last(t).x ** 2 + last(t).y ** 2])) || 1;
    return subdivide(t.map(p => ({ x: p.x / s, y: p.y / s })));
  }
  const rot = (c, th) => c.map(p => ({ x: Math.cos(th) * p.x - Math.sin(th) * p.y, y: Math.sin(th) * p.x + Math.cos(th) * p.y }));
  const ROTS = [Math.PI / 16, Math.PI / 32, 0, -Math.PI / 32, -Math.PI / 16];
  const shapeFit = (a, b, len_) => { const na = normalize(a), nb = normalize(b); return Math.min(...ROTS.map(t => frechet(na, rot(nb, t)))) <= 0.4 * len_; };
  const avgDist = (pts, stroke) => avg(pts.map(p => Math.min(...stroke.map(q => dist(p, q)))));
  const dirMatch = (pts, stroke) => {
    const ev = pts.slice(1).map((p, i) => sub(p, pts[i]));
    const sv = stroke.slice(1).map((p, i) => sub(p, stroke[i]));
    return avg(ev.map(e => Math.max(...sv.map(s => cos(s, e))))) > 0;
  };
  function matchData(pts, stroke, idx, lenc, checkBackwards = true) {
    const ad = avgDist(pts, stroke);
    const within = ad <= 350 * (idx > 0 ? 0.5 : 1) * lenc;
    if (!within) return { ok: false, ad, back: false };
    const ends = dist(stroke[0], pts[0]) <= 250 * lenc && dist(last(stroke), last(pts)) <= 250 * lenc;
    const ok = ends && dirMatch(pts, stroke) && shapeFit(pts, stroke, lenc) && lenc * (len(pts) + 25) / (len(stroke) + 25) >= 0.35;
    if (!ok && checkBackwards && matchData(pts.slice().reverse(), stroke, idx, lenc, false).ok) return { ok: false, ad, back: true };
    return { ok, ad, back: false };
  }
  const clean = pts => pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);

  // strict: user stroke i must be the character's stroke i
  function strict(user, meds, lenc) {
    const marks = user.map((raw, i) => {
      const pts = clean(raw);
      if (pts.length < 2) return "wrong";
      if (i >= meds.length) return "extra";
      let m = matchData(pts, meds[i], i, lenc);
      if (m.ok) {
        // a much closer match to a later stroke means the strokes were written out of order
        let best = m.ad;
        for (let j = i + 1; j < meds.length; j++) { const o = matchData(pts, meds[j], j, lenc, false); if (o.ok && o.ad < best) best = o.ad; }
        if (best < m.ad) m = matchData(pts, meds[i], i, lenc * 0.6 * (best + m.ad) / (2 * m.ad));
        if (m.ok) return "ok";
      }
      if (m.back) return "backwards";
      for (let j = 0; j < meds.length; j++) if (j !== i && matchData(pts, meds[j], j, lenc, false).ok) return "order";
      return "wrong";
    });
    return marks;
  }
  // free: each user stroke may match any not-yet-used stroke of the character
  function free(user, meds, lenc) {
    const marks = user.map(() => "wrong"), pairs = [];
    user.forEach((raw, i) => {
      const pts = clean(raw);
      if (pts.length < 2) return;
      meds.forEach((s, j) => { const m = matchData(pts, s, 1, lenc); if (m.ok) pairs.push({ i, j, ad: m.ad }); else if (m.back && marks[i] === "wrong") marks[i] = "backwards"; });
    });
    pairs.sort((a, b) => a.ad - b.ad);
    const ui = new Set(), mj = new Set();
    for (const p of pairs) if (!ui.has(p.i) && !mj.has(p.j)) { ui.add(p.i); mj.add(p.j); marks[p.i] = "ok"; }
    return marks;
  }
  function character(user, data, mode) {
    const meds = data.medians.map(m => m.map(([x, y]) => ({ x, y })));
    const lenc = mode === "lenient" ? 1.4 : mode === "free" ? 1.3 : 1;
    const marks = mode === "free" ? free(user, meds, lenc) : strict(user, meds, lenc);
    const good = marks.filter(m => m === "ok").length;
    return { marks, good, expected: meds.length, drawn: user.length, correct: good === meds.length && user.length === meds.length };
  }
  return { character };
})();

function markingMode() {
  const s = P.settings;
  if (!s.marking) s.marking = s.leniency > 1 ? "lenient" : "standard";
  return s.marking;
}

/* ---------------- Write card ---------------- */
function renderCard() {
  const s = session, w = s.words[s.i], n = w.t.length;
  const avail = Math.min(main.clientWidth, 1040) - 32;
  const size = Math.max(70, Math.min(260, Math.floor((avail - (n - 1) * 12) / n)));
  const pad = Math.round(size * 0.06);
  const css = getComputedStyle(document.documentElement);
  const tok = (k, d) => css.getPropertyValue(k).trim() || d;
  const C = { ink: tok("--stroke", "#17252a"), jade: tok("--jade", "#1d6b58"), bad: tok("--bad", "#b3261e"), warn: tok("--warn", "#a86400") };
  main.innerHTML = `
  <div class="practice">
    <div class="ptop">
      <button class="iconbtn" id="quit" type="button">End</button>
      <div class="track"><i style="width:${100 * s.i / s.words.length}%"></i></div>
      <span class="count">${s.i + 1} / ${s.words.length}</span>
    </div>
    <div class="prompt">
      <div class="eyebrow">${esc(s.label)} · from lesson ${esc(w.l)}</div>
      <div class="py">${esc(w.p)}</div>
      <div class="hint">${esc(w.h)}${w.pos ? `<em>${esc(w.pos)}</em>` : ""}</div>
    </div>
    <div class="boxes" id="boxes">${[...w.t].map((c, k) => `
      <div class="col">
        <div class="box" style="width:${size}px;height:${size}px" data-k="${k}">${gridSvg()}<div class="hw" id="hw${k}"></div><canvas class="ink" width="${size}" height="${size}"></canvas></div>
        <div class="model" hidden><div class="mw" id="mw${k}"></div><span class="mnote"></span></div>
      </div>`).join("")}</div>
    <div class="feedback" id="fb" aria-live="polite"></div>
    <div class="controls" id="ctl">
      <button class="btn" id="undoBtn" type="button">Undo stroke</button>
      <button class="btn" id="clearBtn" type="button">Clear</button>
      <button class="btn" id="hintBtn" type="button">Hint</button>
      <button class="btn" id="hearBtn" type="button">Hear it</button>
      <button class="btn" id="revealBtn" type="button">Show answer</button>
      <button class="btn primary" id="checkBtn" type="button">Check</button>
    </div>
  </div>`;
  $("#quit").onclick = () => finish();
  $("#hearBtn").onclick = () => speak(w.t);

  const st = { ink: [...w.t].map(() => []), order: [], hints: 0, revealed: false, done: false, marks: null, writers: [], models: [] };
  s.cur = st;
  const boxes = [...main.querySelectorAll(".box")];
  const canvases = boxes.map(b => b.querySelector("canvas.ink"));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvases.forEach(cv => { cv.width = size * dpr; cv.height = size * dpr; cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0); });
  const loader = (ch, onLoad, onErr) => STROKES[ch] ? onLoad(STROKES[ch]) : onErr(new Error("no data for " + ch));
  [...w.t].forEach((c, k) => {
    st.writers[k] = HanziWriter.create("hw" + k, c, {
      width: size, height: size, padding: pad, showCharacter: false, showOutline: false,
      strokeColor: C.jade, outlineColor: "rgba(127,127,127,.28)", renderer: "svg", charDataLoader: loader,
    });
  });

  // ink: each stroke is a list of {x, y, w} points in box pixels, drawn with Pencil pressure
  const base = Math.max(4, size / 26);
  const colorFor = m => m === "ok" || !m ? C.ink : (m === "order" || m === "backwards") ? C.warn : C.bad;
  function drawSeg(ctx, a, b, color) {
    ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = (a.w + b.w) / 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function redraw(k) {
    const ctx = canvases[k].getContext("2d");
    ctx.clearRect(0, 0, size, size);
    st.ink[k].forEach((stroke, i) => {
      const color = colorFor(st.marks && st.marks[k] ? st.marks[k].marks[i] : null);
      if (stroke.length === 1) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(stroke[0].x, stroke[0].y, stroke[0].w / 2, 0, 7); ctx.fill(); }
      for (let j = 1; j < stroke.length; j++) drawSeg(ctx, stroke[j - 1], stroke[j], color);
    });
  }
  const widthFor = e => {
    const pr = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.55;
    return base * (0.45 + 1.1 * pr);
  };

  // Apple Pencil: one pointer at a time; a resting palm (non-pen pointer) is ignored once a Pencil has been seen
  const container = $("#boxes");
  const block = e => { if (e.target.closest && e.target.closest(".box") && e.cancelable) e.preventDefault(); };
  ["touchstart", "touchmove"].forEach(t => container.addEventListener(t, block, { passive: false }));
  let active = null;
  const ptIn = (e, cv) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: widthFor(e) }; };
  container.addEventListener("pointerdown", e => {
    if (st.done) return;
    if (e.pointerType === "pen" && !P.settings.sawPencil) { P.settings.sawPencil = true; save(); }
    if (e.pointerType === "touch" && pencilOnly()) return;
    const box = e.target.closest(".box"); if (!box) return;
    if (active) {
      if (e.pointerType !== "pen" || active.type === "pen") return;
      st.ink[active.k].pop(); st.order.pop(); redraw(active.k); active = null; // a pen takes over from an accidental touch
    }
    e.preventDefault();
    const k = +box.dataset.k, cv = canvases[k];
    try { container.setPointerCapture(e.pointerId); } catch (_) {}
    const stroke = [ptIn(e, cv)];
    st.ink[k].push(stroke); st.order.push(k);
    active = { id: e.pointerId, type: e.pointerType, k, cv, stroke };
    redraw(k);
    $("#fb").textContent = "";
  });
  container.addEventListener("pointermove", e => {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const ctx = active.cv.getContext("2d");
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])) {
      const p = ptIn(ev, active.cv), prev = active.stroke[active.stroke.length - 1];
      if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) < 0.8) continue;
      p.w = prev.w * 0.6 + p.w * 0.4; // smooth width changes
      active.stroke.push(p);
      drawSeg(ctx, prev, p, C.ink);
    }
  });
  const end = e => { if (active && e.pointerId === active.id) active = null; };
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);

  $("#undoBtn").onclick = () => { if (st.done || !st.order.length) return; const k = st.order.pop(); st.ink[k].pop(); redraw(k); };
  $("#clearBtn").onclick = () => { if (st.done) return; st.ink.forEach(a => a.length = 0); st.order = []; canvases.forEach((_, k) => redraw(k)); };
  $("#hintBtn").onclick = () => {
    if (st.done) return;
    st.hints++;
    st.writers.forEach(wr => wr.showOutline());
    setTimeout(() => st.writers.forEach(wr => wr.hideOutline()), 1200);
  };
  $("#revealBtn").onclick = () => { if (st.done) return; st.revealed = true; check(true); };
  $("#checkBtn").onclick = () => {
    if (st.done) return;
    const empty = st.ink.findIndex(a => !a.length);
    if (empty >= 0) {
      $("#fb").innerHTML = `<span class="pill warn">${n > 1 ? `Box ${empty + 1} is still empty` : "Write the character first"}</span>`;
      return;
    }
    check(false);
  };

  function check(revealed) {
    st.done = true;
    const mode = markingMode();
    const toChar = p => {
      const scale = (size - 2 * pad) / 1024, xo = pad, yo = 124 * scale + pad;
      return { x: (p.x - xo) / scale, y: (size - yo - p.y) / scale };
    };
    st.marks = [...w.t].map((c, k) => Mark.character(st.ink[k].map(stroke => stroke.map(toChar)), STROKES[c], mode));
    canvases.forEach((_, k) => redraw(k));
    if (revealed) st.writers.forEach(wr => wr.showCharacter());
    const allCorrect = st.marks.every(m => m.correct);
    const strokesOk = st.marks.reduce((a, m) => a + m.good, 0), strokesExp = st.marks.reduce((a, m) => a + Math.max(m.expected, m.drawn), 0);
    let result;
    if (revealed) result = "miss";
    else if (allCorrect && !st.hints) result = "good";
    else if (allCorrect || strokesOk / strokesExp >= 0.75) result = "close";
    else result = "miss";
    grade(w.id, result);
    s.results.push({ w, result, hints: st.hints, revealed, bad: strokesExp - strokesOk });
    save();

    // model characters under each box, with a note on what went wrong
    boxes.forEach((b, k) => {
      const m = st.marks[k], col = b.parentElement, note = col.querySelector(".mnote");
      b.classList.add(m.correct ? "done" : "wrongbox");
      col.querySelector(".model").hidden = false;
      st.models[k] = HanziWriter.create("mw" + k, w.t[k], { width: 64, height: 64, padding: 3, strokeColor: C.ink, renderer: "svg", charDataLoader: loader, strokeAnimationSpeed: 1.4, delayBetweenStrokes: 150 });
      const order = m.marks.filter(x => x === "order").length, back = m.marks.filter(x => x === "backwards").length;
      const msgs = [];
      if (m.correct) msgs.push("All strokes right");
      else {
        if (m.drawn !== m.expected) msgs.push(`${m.drawn} strokes, should be ${m.expected}`);
        if (order) msgs.push(`${order} out of order`);
        if (back) msgs.push(`${back} written backwards`);
        const wrong = m.marks.filter(x => x === "wrong" || x === "extra").length;
        if (wrong) msgs.push(`${wrong} wrong shape or place`);
        if (!msgs.length) msgs.push(`${m.good} of ${m.expected} strokes right`);
      }
      note.textContent = msgs.join(" · ");
      note.className = "mnote " + (m.correct ? "good" : "bad");
    });

    const label = revealed ? "Answer shown" : { good: "Correct", close: allCorrect ? `Correct, with ${st.hints} hint${st.hints === 1 ? "" : "s"}` : "Nearly, check the red strokes", miss: "Not quite, this one comes back soon" }[result];
    const cls = { good: "good", close: "warn", miss: "bad" }[result];
    $("#fb").innerHTML = `<span class="pill ${cls}"><span class="han">${esc(w.d)}</span>${esc(label)}</span>`;
    speak(w.t);
    $("#ctl").innerHTML = `
      <button class="btn" id="animBtn" type="button">Watch stroke order</button>
      <button class="btn" id="hearBtn2" type="button">Hear it</button>
      <button class="btn" id="againBtn" type="button">Write it again</button>
      <button class="btn primary" id="nextBtn" type="button">${s.i + 1 < s.words.length ? "Next word" : "See results"}</button>`;
    $("#hearBtn2").onclick = () => speak(w.t);
    $("#animBtn").onclick = async () => { for (const m of st.models) await m.animateCharacter(); };
    $("#againBtn").onclick = () => practiseAgain();
    $("#nextBtn").onclick = () => { s.i++; if (s.i < s.words.length) renderCard(); else finish(); };
    $("#nextBtn").focus({ preventScroll: true });
  }

  // extra practice on the same word; the first attempt's grade stands
  function practiseAgain() {
    st.done = false; st.marks = null; st.ink.forEach(a => a.length = 0); st.order = [];
    canvases.forEach((_, k) => redraw(k));
    st.writers.forEach(wr => wr.hideCharacter());
    boxes.forEach(b => b.classList.remove("done", "wrongbox"));
    $("#fb").innerHTML = `<span class="pill warn">Practice round, your first try is already scored</span>`;
    $("#ctl").innerHTML = `
      <button class="btn" id="undo2" type="button">Undo stroke</button>
      <button class="btn" id="clear2" type="button">Clear</button>
      <button class="btn primary" id="check2" type="button">Check</button>`;
    $("#undo2").onclick = () => { if (st.done || !st.order.length) return; const k = st.order.pop(); st.ink[k].pop(); redraw(k); };
    $("#clear2").onclick = () => { st.ink.forEach(a => a.length = 0); st.order = []; canvases.forEach((_, k) => redraw(k)); };
    $("#check2").onclick = () => {
      if (st.ink.some(a => !a.length)) return;
      st.done = true;
      const mode = markingMode();
      const toChar = p => { const scale = (size - 2 * pad) / 1024; return { x: (p.x - pad) / scale, y: (size - 124 * scale - pad - p.y) / scale }; };
      st.marks = [...w.t].map((c, k) => Mark.character(st.ink[k].map(stroke => stroke.map(toChar)), STROKES[c], mode));
      canvases.forEach((_, k) => redraw(k));
      boxes.forEach((b, k) => b.classList.add(st.marks[k].correct ? "done" : "wrongbox"));
      const ok = st.marks.every(m => m.correct);
      $("#fb").innerHTML = `<span class="pill ${ok ? "good" : "bad"}"><span class="han">${esc(w.d)}</span>${ok ? "Correct this time" : "Still some red strokes"}</span>`;
      $("#ctl").innerHTML = `
        <button class="btn" id="animBtn" type="button">Watch stroke order</button>
        <button class="btn" id="againBtn" type="button">Write it again</button>
        <button class="btn primary" id="nextBtn" type="button">${s.i + 1 < s.words.length ? "Next word" : "See results"}</button>`;
      $("#animBtn").onclick = async () => { for (const m of st.models) await m.animateCharacter(); };
      $("#againBtn").onclick = () => practiseAgain();
      $("#nextBtn").onclick = () => { s.i++; if (s.i < s.words.length) renderCard(); else finish(); };
    };
  }
}

