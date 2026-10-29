/* ---------------- Learn mode ---------------- */
const TONE_NAMES = { 1: "1st ˉ", 2: "2nd ˊ", 3: "3rd ˇ", 4: "4th ˋ", 5: "neutral" };
let learnLesson = null;
function uniqueWords(list) { const seen = new Set(); return list.filter(w => !seen.has(w.t) && seen.add(w.t)); }
function lessonWords(l) { return uniqueWords(byLesson[l] || []); }
function lessonOptions(sel) { return LESSONS.map(l => `<option value="${l}"${l === sel ? " selected" : ""}>Lesson ${l}</option>`).join(""); }
function charLoader(ch, onLoad, onErr) { return STROKES[ch] ? onLoad(STROKES[ch]) : onErr(new Error("no data for " + ch)); }
function themeColors() {
  const css = getComputedStyle(document.documentElement), tok = (k, d) => css.getPropertyValue(k).trim() || d;
  return { ink: tok("--stroke", "#17252a"), jade: tok("--jade", "#1d6b58"), grid: tok("--grid", "#d9534f"), muted: tok("--muted", "#5d6f72") };
}
function stageLabel(id) {
  const r = rec(id);
  if (!r) return { cls: "new", text: "New" };
  if (r.st >= 3) return { cls: "good", text: "Mastered" };
  return { cls: "warn", text: "Learning" };
}

function renderLearn(lesson) {
  route = "learn"; session = null;
  learnLesson = lesson || learnLesson || P.cur;
  const ws = lessonWords(learnLesson);
  const fresh = ws.filter(w => !rec(w.id)).length;
  main.innerHTML = `
  <div class="view">
    <div class="sechead"><div><div class="eyebrow">Learn mode</div><h2>Learn the words of a lesson</h2></div>
      <div class="field" style="min-width:200px"><label for="learnSel" class="lbl">Lesson</label><select id="learnSel">${lessonOptions(learnLesson)}</select></div></div>
    <p class="note">${ws.length} words in lesson ${esc(learnLesson)}, ${fresh} you haven't practised yet. A good order: word list, flashcards, trace and copy, then the match game and tones.</p>
    <section class="modes tools">
      <button class="mode" type="button" data-t="list"><span class="glyph">词</span><b>Word list</b><small>Every word with audio, stroke order, the radical and related course words.</small></button>
      <button class="mode" type="button" data-t="cards"><span class="glyph">卡</span><b>Flashcards</b><small>Flip, then rate how well you knew it. Ratings set when each card returns.</small></button>
      <button class="mode" type="button" data-t="trace"><span class="glyph">描</span><b>Trace and copy</b><small>Write over a faint outline, then again from memory.</small></button>
      <button class="mode" type="button" data-t="match"><span class="glyph">配</span><b>Match game</b><small>Pair characters with their meaning or pinyin, against the clock.</small></button>
      <button class="mode" type="button" data-t="tones"><span class="glyph">声</span><b>Tone trainer</b><small>Hear the word and pick the tone of each syllable.</small></button>
    </section>
  </div>`;
  $("#learnSel").onchange = e => renderLearn(e.target.value);
  main.querySelectorAll(".tools .mode").forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    if (t === "list") renderWordList(learnLesson);
    if (t === "cards") renderCardSetup(learnLesson);
    if (t === "trace") startWrite(lessonWords(learnLesson), "Trace and copy · Lesson " + learnLesson, { trace: true });
    if (t === "match") startMatch(learnLesson);
    if (t === "tones") startTones(learnLesson);
  });
  window.scrollTo(0, 0);
}

/* Word list: one card per word, expandable */
function renderWordList(lesson) {
  route = "wordlist";
  const ws = lessonWords(lesson);
  const C = themeColors();
  main.innerHTML = `
  <div class="view">
    <div class="sechead"><div><div class="eyebrow">Learn · Lesson ${esc(lesson)}</div><h2>Word list</h2></div>
      <button class="btn" id="backLearn" type="button">Back to Learn</button></div>
    <p class="note">Tap a word to see its stroke order. The radical, the part that hints at meaning, is shown in red.</p>
    <div class="wlist">${ws.map(w => {
      const s = stageLabel(w.id);
      return `<div class="wrow" data-id="${w.id}">
        <button class="whead" type="button" aria-expanded="false">
          <span class="han">${esc(w.d)}</span><span class="wpy">${esc(w.p)}</span><span class="muted">${esc(w.h)}</span>
          <span class="pill small ${s.cls}">${s.text}</span>
        </button>
        <div class="wbody" hidden></div>
      </div>`;
    }).join("")}</div>
  </div>`;
  $("#backLearn").onclick = () => renderLearn(lesson);
  main.querySelectorAll(".wrow").forEach(row => {
    const head = row.querySelector(".whead"), body = row.querySelector(".wbody");
    head.onclick = () => {
      const open = body.hidden;
      body.hidden = !open; head.setAttribute("aria-expanded", String(open));
      if (!open || body.dataset.built) { if (open) speak(WORDS[+row.dataset.id].t); return; }
      const w = WORDS[+row.dataset.id];
      body.dataset.built = "1";
      const related = WORDS.filter(o => o.t !== w.t && [...w.t].some(c => o.t.includes(c)));
      const relU = uniqueWords(related).slice(0, 10);
      body.innerHTML = `
        <div class="wchars">${[...w.t].map((c, k) => `<div class="wchar"><div class="anim" id="an${w.id}_${k}"></div><span class="note">${STROKES[c] ? STROKES[c].strokes.length : "?"} strokes</span></div>`).join("")}</div>
        <div class="settings-row"><button class="btn" data-a="play" type="button">Hear it</button><button class="btn" data-a="anim" type="button">Replay strokes</button>
        ${w.pos ? `<span class="note">Part of speech: ${esc(w.pos)}</span>` : ""}<span class="note">Lesson ${esc(w.l)}</span></div>
        ${relU.length ? `<div><div class="eyebrow">Course words that share a character</div><div class="related">${relU.map(o => `<span class="rel"><span class="han">${esc(o.d)}</span> ${esc(o.p)} · ${esc(o.h)} <em>${esc(o.l)}</em></span>`).join("")}</div></div>` : ""}`;
      const writers = [...w.t].map((c, k) => HanziWriter.create(`an${w.id}_${k}`, c, {
        width: 120, height: 120, padding: 6, strokeColor: C.ink, radicalColor: C.grid, renderer: "svg",
        charDataLoader: charLoader, strokeAnimationSpeed: 1.2, delayBetweenStrokes: 180,
      }));
      const play = async () => { for (const wr of writers) await wr.animateCharacter(); };
      body.querySelector('[data-a="play"]').onclick = () => speak(w.t);
      body.querySelector('[data-a="anim"]').onclick = play;
      speak(w.t); play();
    };
  });
}

/* Flashcards */
const cardSetup = { front: "chars", scope: "all" };
function renderCardSetup(lesson) {
  route = "cardsetup";
  main.innerHTML = `
  <div class="view">
    <div><div class="eyebrow">Learn · Lesson ${esc(lesson)}</div><h2>Flashcards</h2></div>
    <section class="sheet">
      <div class="field"><span class="lbl">Front of the card</span><div class="seg" id="segFront">
        <button type="button" data-v="chars">Characters</button><button type="button" data-v="english">English</button><button type="button" data-v="audio">Audio only</button>
      </div></div>
      <div class="field"><span class="lbl">Cards</span><div class="seg" id="segCScope">
        <button type="button" data-v="all">Whole lesson</button><button type="button" data-v="weak">Not yet mastered</button>
      </div></div>
      <p class="note" id="cardNote"></p>
      <div class="settings-row"><button class="btn primary" id="cgo" type="button">Start</button><button class="btn" id="cback" type="button">Back</button></div>
    </section>
  </div>`;
  const pool = () => { const ws = lessonWords(lesson); return cardSetup.scope === "weak" ? ws.filter(w => !mastered(w.id)) : ws; };
  const seg = (id, key) => {
    const el = $(id);
    const paint = () => { el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === cardSetup[key]))); const n = pool().length; $("#cardNote").textContent = n ? `${n} cards. Cards you rate Again come back later in the same round.` : "Every word in this lesson is mastered."; $("#cgo").disabled = !n; };
    el.querySelectorAll("button").forEach(b => b.onclick = () => { cardSetup[key] = b.dataset.v; paint(); });
    paint();
  };
  seg("#segFront", "front"); seg("#segCScope", "scope");
  $("#cback").onclick = () => renderLearn(lesson);
  $("#cgo").onclick = () => startCards(shuffle(pool()), lesson);
}
function startCards(words, lesson) {
  session = { kind: "cards", queue: words.slice(), total: words.length, done: 0, lesson, first: {}, again: 0 };
  route = "cards";
  showCard();
}
function showCard() {
  const s = session;
  if (!s.queue.length) return cardsDone();
  const w = s.queue[0], front = cardSetup.front, C = themeColors();
  const frontHtml = front === "chars" ? `<div class="fc-han">${esc(w.d)}</div>`
    : front === "english" ? `<div class="fc-en">${esc(w.h)}</div>${w.pos ? `<div class="note">${esc(w.pos)}</div>` : ""}`
    : `<button class="btn" id="fcPlay" type="button">Play again</button>`;
  main.innerHTML = `
  <div class="practice">
    <div class="ptop">
      <button class="iconbtn" id="quit" type="button">End</button>
      <div class="track"><i style="width:${100 * s.done / s.total}%"></i></div>
      <span class="count">${s.done} / ${s.total}</span>
    </div>
    <button class="flash" id="flash" type="button" aria-live="polite">
      <div class="fc-front">${frontHtml}<div class="note fc-tap">Tap to flip</div></div>
    </button>
    <div class="controls" id="rate"></div>
  </div>`;
  $("#quit").onclick = () => cardsDone();
  if (front === "audio") { speak(w.t); $("#fcPlay").onclick = e => { e.stopPropagation(); speak(w.t); }; }
  let flipped = false;
  $("#flash").onclick = () => {
    if (flipped) { speak(w.t); return; }
    flipped = true;
    $("#flash").classList.add("flipped");
    $("#flash").innerHTML = `
      <div class="fc-back">
        <div class="fc-row">${[...w.t].map((c, k) => `<div class="anim fc-anim" id="fa${k}"></div>`).join("")}</div>
        <div class="fc-py">${esc(w.p)}</div>
        <div class="fc-en">${esc(w.h)}</div>
        <div class="note">${w.pos ? esc(w.pos) + " · " : ""}Lesson ${esc(w.l)} · tap the card to hear it again</div>
      </div>`;
    const size = Math.min(130, Math.floor((Math.min(main.clientWidth, 640) - 80) / w.t.length));
    const ws = [...w.t].map((c, k) => HanziWriter.create("fa" + k, c, { width: size, height: size, padding: 4, strokeColor: C.ink, renderer: "svg", charDataLoader: charLoader, strokeAnimationSpeed: 1.5, delayBetweenStrokes: 120 }));
    (async () => { for (const x of ws) await x.animateCharacter(); })();
    speak(w.t);
    $("#rate").innerHTML = `
      <button class="btn rate-again" data-r="again" type="button">Again</button>
      <button class="btn rate-hard" data-r="hard" type="button">Hard</button>
      <button class="btn rate-good" data-r="good" type="button">Good</button>
      <button class="btn rate-easy" data-r="easy" type="button">Easy</button>`;
    $("#rate").querySelectorAll("button").forEach(b => b.onclick = () => rateCard(w, b.dataset.r));
  };
}
function rateCard(w, r) {
  const s = session;
  s.queue.shift();
  if (!(w.id in s.first)) {
    s.first[w.id] = r;
    // only the first rating of a round moves the review schedule
    grade(w.id, r === "again" ? "miss" : r === "hard" ? "close" : "good");
    if (r === "easy") { const x = P.w[w.id]; x.st = Math.min(x.st + 1, INTERVALS.length - 1); x.due = Date.now() + INTERVALS[x.st] * DAY; }
    save();
  }
  if (r === "again") { s.again++; s.queue.splice(Math.min(3, s.queue.length), 0, w); }
  else s.done++;
  showCard();
}
function cardsDone() {
  const s = session; if (!s) return renderLearn();
  const f = Object.values(s.first), count = k => f.filter(x => x === k).length;
  if (f.length) { P.hist.push({ t: Date.now(), mode: "cards", label: "Lesson " + s.lesson, n: f.length, good: count("good") + count("easy") }); P.hist = P.hist.slice(-200); save(); }
  route = "summary";
  const weak = Object.keys(s.first).filter(id => s.first[id] === "again" || s.first[id] === "hard").map(id => WORDS[+id]);
  main.innerHTML = `
  <div class="view">
    <div><div class="eyebrow">Learn · Lesson ${esc(s.lesson)}</div><h2>Flashcards done</h2></div>
    <div class="score"><span class="big">${f.length}</span><span>cards: ${count("easy")} easy, ${count("good")} good, ${count("hard")} hard, ${count("again")} again</span></div>
    ${weak.length ? `<p class="note">Still shaky: <span class="han-inline">${weak.map(w => esc(w.d)).join("、")}</span></p>` : ""}
    <div class="settings-row">
      ${weak.length ? `<button class="btn primary" id="weakCards" type="button">Flashcards for the ${weak.length} shaky words</button><button class="btn" id="weakTrace" type="button">Trace and copy them</button>` : ""}
      <button class="btn" id="toLearn" type="button">Back to Learn</button>
    </div>
  </div>`;
  $("#toLearn").onclick = () => renderLearn(s.lesson);
  if (weak.length) {
    $("#weakCards").onclick = () => startCards(shuffle(weak), s.lesson);
    $("#weakTrace").onclick = () => startWrite(weak, "Trace and copy · Lesson " + s.lesson, { trace: true });
  }
  session = null;
}

/* Match game */
let matchSide = "english";
function startMatch(lesson) {
  const ws = shuffle(lessonWords(lesson));
  const rounds = [];
  for (let i = 0; i < ws.length; i += 6) rounds.push(ws.slice(i, i + 6));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 3) rounds[rounds.length - 2].push(...rounds.pop());
  session = { kind: "match", lesson, rounds, r: 0, mistakes: 0, t0: Date.now(), wrongIds: new Set() };
  route = "match";
  showMatch();
}
function showMatch() {
  const s = session, round = s.rounds[s.r];
  const right = shuffle(round), left = shuffle(round);
  const label = w => matchSide === "english" ? esc(w.h) : esc(w.p);
  main.innerHTML = `
  <div class="practice">
    <div class="ptop">
      <button class="iconbtn" id="quit" type="button">End</button>
      <div class="track"><i style="width:${100 * s.r / s.rounds.length}%"></i></div>
      <span class="count">Round ${s.r + 1} / ${s.rounds.length}</span>
    </div>
    <div class="settings-row"><span class="note">Match with</span><div class="seg" id="segSide">
      <button type="button" data-v="english" aria-pressed="${matchSide === "english"}">English</button><button type="button" data-v="pinyin" aria-pressed="${matchSide === "pinyin"}">Pinyin</button>
    </div><span class="note" id="clock"></span></div>
    <div class="match">
      <div class="mcol">${left.map(w => `<button class="tile han-tile" type="button" data-id="${w.id}">${esc(w.d)}</button>`).join("")}</div>
      <div class="mcol">${right.map(w => `<button class="tile" type="button" data-id="${w.id}">${label(w)}</button>`).join("")}</div>
    </div>
  </div>`;
  $("#quit").onclick = () => matchDone(true);
  $("#segSide").querySelectorAll("button").forEach(b => b.onclick = () => { matchSide = b.dataset.v; showMatch(); });
  const tick = () => { const el = $("#clock"); if (!el || session !== s) return; el.textContent = fmtTime(Date.now() - s.t0); setTimeout(tick, 500); };
  tick();
  let pick = null, left_ = 0;
  const tiles = [...main.querySelectorAll(".tile")];
  tiles.forEach(t => t.onclick = () => {
    if (t.classList.contains("gone")) return;
    const isLeft = t.classList.contains("han-tile");
    if (!pick || pick.classList.contains("han-tile") === isLeft) {
      if (pick) pick.classList.remove("picked");
      pick = t; t.classList.add("picked");
      if (isLeft) speak(WORDS[+t.dataset.id].t);
      return;
    }
    const a = pick, b = t; pick = null; a.classList.remove("picked");
    if (a.dataset.id === b.dataset.id) {
      a.classList.add("gone"); b.classList.add("gone");
      if (++left_ === round.length) setTimeout(() => { s.r++; if (s.r < s.rounds.length) showMatch(); else matchDone(false); }, 350);
    } else {
      s.mistakes++;
      s.wrongIds.add(+a.dataset.id); s.wrongIds.add(+b.dataset.id);
      [a, b].forEach(x => { x.classList.add("bad"); setTimeout(() => x.classList.remove("bad"), 450); });
    }
  });
}
function fmtTime(ms) { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
function matchDone(early) {
  const s = session; if (!s) return renderLearn();
  const ms = Date.now() - s.t0, key = "match-" + s.lesson;
  P.best = P.best || {};
  const prev = P.best[key];
  const newBest = !early && (!prev || ms < prev);
  if (newBest) { P.best[key] = ms; save(); }
  route = "summary";
  const wrong = [...s.wrongIds].map(id => WORDS[id]);
  main.innerHTML = `
  <div class="view">
    <div><div class="eyebrow">Learn · Lesson ${esc(s.lesson)}</div><h2>${early ? "Match game stopped" : "All matched"}</h2></div>
    <div class="score"><span class="big">${fmtTime(ms)}</span><span>${s.mistakes} mistake${s.mistakes === 1 ? "" : "s"}${newBest ? " · new best time" : prev ? ` · best ${fmtTime(prev)}` : ""}</span></div>
    ${wrong.length ? `<p class="note">Mixed up: <span class="han-inline">${uniqueWords(wrong).map(w => esc(w.d)).join("、")}</span></p>` : ""}
    <div class="settings-row"><button class="btn primary" id="again" type="button">Play again</button><button class="btn" id="toLearn" type="button">Back to Learn</button></div>
  </div>`;
  $("#again").onclick = () => startMatch(s.lesson);
  $("#toLearn").onclick = () => renderLearn(s.lesson);
  session = null;
}

/* Tone trainer */
let toneHide = false;
function startTones(lesson) {
  const ws = shuffle(lessonWords(lesson).filter(w => w.tn));
  session = { kind: "tones", lesson, words: ws, i: 0, right: 0, missed: [] };
  route = "tones";
  showTone();
}
function showTone() {
  const s = session;
  if (s.i >= s.words.length) return tonesDone();
  const w = s.words[s.i], picks = w.tn.map(() => 0);
  main.innerHTML = `
  <div class="practice">
    <div class="ptop">
      <button class="iconbtn" id="quit" type="button">End</button>
      <div class="track"><i style="width:${100 * s.i / s.words.length}%"></i></div>
      <span class="count">${s.i + 1} / ${s.words.length}</span>
    </div>
    <div class="prompt">
      <div class="eyebrow">Which tones do you hear?</div>
      ${toneHide ? `<div class="py">？</div>` : `<div class="fc-han small">${esc(w.d)}</div>`}
      <div class="hint">${esc(w.h)}</div>
    </div>
    <div class="settings-row" style="justify-content:center">
      <button class="btn" id="tPlay" type="button">Play</button><button class="btn" id="tSlow" type="button">Play slowly</button>
      <button class="btn" id="tHide" type="button">${toneHide ? "Show characters" : "Hide characters"}</button>
    </div>
    <div class="tones">${w.tn.map((t, k) => `
      <div class="tcol" data-k="${k}"><div class="han">${toneHide ? "·" : esc(w.t[k])}</div>
        ${[1, 2, 3, 4, 5].map(n => `<button class="tbtn" type="button" data-n="${n}">${TONE_NAMES[n]}</button>`).join("")}
      </div>`).join("")}</div>
    <div class="feedback" id="fb"></div>
    <div class="controls" id="ctl"><button class="btn primary" id="tCheck" type="button" disabled>Check</button></div>
  </div>`;
  speak(w.t, 0.8);
  $("#quit").onclick = () => tonesDone();
  $("#tPlay").onclick = () => speak(w.t, 0.8);
  $("#tSlow").onclick = () => speak(w.t, 0.5);
  $("#tHide").onclick = () => { toneHide = !toneHide; showTone(); };
  main.querySelectorAll(".tcol").forEach(col => col.querySelectorAll(".tbtn").forEach(b => b.onclick = () => {
    if (s.checked) return;
    picks[+col.dataset.k] = +b.dataset.n;
    col.querySelectorAll(".tbtn").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("#tCheck").disabled = picks.some(p => !p);
  }));
  s.checked = false;
  $("#tCheck").onclick = () => {
    s.checked = true;
    const ok = picks.every((p, k) => p === w.tn[k]);
    if (ok) s.right++; else s.missed.push(w);
    main.querySelectorAll(".tcol").forEach((col, k) => col.querySelectorAll(".tbtn").forEach(b => {
      const n = +b.dataset.n;
      if (n === w.tn[k]) b.classList.add("right"); else if (n === picks[k]) b.classList.add("wrong");
    }));
    const sandhi = /[一不]/.test(w.t) ? " Note: 一 and 不 change tone in speech; the book's citation tone is marked here." : (w.tn.filter((t, k) => t === 3 && w.tn[k + 1] === 3).length ? " Note: two 3rd tones in a row: the first is spoken like a 2nd tone." : "");
    $("#fb").innerHTML = `<span class="pill ${ok ? "good" : "bad"}"><span class="han">${esc(w.d)}</span>${esc(w.p)}</span>${sandhi ? `<p class="note legend">${esc(sandhi.trim())}</p>` : ""}`;
    speak(w.t, 0.8);
    $("#ctl").innerHTML = `<button class="btn primary" id="tNext" type="button">${s.i + 1 < s.words.length ? "Next" : "See results"}</button>`;
    $("#tNext").onclick = () => { s.i++; showTone(); };
  };
}
function tonesDone() {
  const s = session; if (!s) return renderLearn();
  const n = s.i;
  route = "summary";
  main.innerHTML = `
  <div class="view">
    <div><div class="eyebrow">Learn · Lesson ${esc(s.lesson)}</div><h2>Tone trainer</h2></div>
    <div class="score"><span class="big">${s.right}/${n}</span><span>words with every tone right</span></div>
    ${s.missed.length ? `<div class="results">${uniqueWords(s.missed).map(w => `<div class="row"><span class="han">${esc(w.d)}</span><span>${esc(w.p)}</span><span class="muted">${w.tn.map(t => TONE_NAMES[t]).join(" + ")}</span><button class="btn" type="button" data-say="${esc(w.t)}">Hear it</button></div>`).join("")}</div>` : ""}
    <div class="settings-row">${s.missed.length ? `<button class="btn primary" id="retryT" type="button">Practise the ${s.missed.length} again</button>` : ""}<button class="btn" id="toLearn" type="button">Back to Learn</button></div>
  </div>`;
  main.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say, 0.7));
  $("#toLearn").onclick = () => renderLearn(s.lesson);
  const rt = $("#retryT");
  if (rt) rt.onclick = () => { session = { kind: "tones", lesson: s.lesson, words: shuffle(s.missed), i: 0, right: 0, missed: [] }; route = "tones"; showTone(); };
  session = null;
}

