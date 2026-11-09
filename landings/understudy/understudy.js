/* Understudy v2: the masthead, the cover screen, the script ticked in pencil, the performance on the
   green screen (surtitles, stage manager's key, a camera that frames whole fields on phones), Marie's
   pencil answer, and the ticket. */
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  // transitions wait for the first painted frame, so nothing fades in from an unstyled state
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('preload')));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const dprOf = () => Math.min(2, window.devicePixelRatio || 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10)); // minimum jerk
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function watch(el, cb, threshold = 0) {
    if (!el) return;
    const io = new IntersectionObserver((es) => { for (const e of es) cb(e.isIntersecting, e); }, { threshold });
    io.observe(el);
  }

  /* ---------- one frame loop, capped at 60 fps, idle when nothing visible plays ---------- */
  const jobs = [];
  let raf = 0, last = 0, next = 0;
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    let any = false;
    if (now >= next - 2) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; next = Math.max(next + 1000 / 60, now - 4);
      const t0 = performance.now();
      for (const j of jobs) if (j.active()) { j.frame(dt, now); any = true; }
      if (window.__usPerf && any) window.__usPerf.push(performance.now() - t0);
    } else any = jobs.some((j) => j.active());
    if (any) raf = requestAnimationFrame(loop);
  }
  function wake() { if (!raf && !document.hidden) { last = next = performance.now(); raf = requestAnimationFrame(loop); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  /* ---------- masthead: tightens into a running head; it stays paper, the stage below is framed in paper ---------- */
  const mast = $('[data-mast]');
  const bill = $('.bill');
  let mastPending = false;
  function mastUpdate() {
    mastPending = false;
    if (!mast) return;
    const probe = mast.getBoundingClientRect().bottom - 6;
    // the programme's title is still in view under the masthead: its small wordmark waits (scroll timelines do it
    // smoothly where they run; this covers reduced motion and the browsers without them)
    if (bill) mast.classList.toggle('bill-gone', bill.getBoundingClientRect().bottom <= probe + 6);
  }
  addEventListener('scroll', () => { if (!mastPending) { mastPending = true; requestAnimationFrame(mastUpdate); } }, { passive: true });
  addEventListener('resize', mastUpdate);
  // the demo's split layout follows the window's shape (set first in the head, before the first paint); the stage's
  // scroll margin centres it in the window under the tightened masthead when "Watch a morning" or the key brings it in
  const perfBox = $('.perf');
  function centreStage() {
    if (!perfBox) return;
    // the masthead's bottom once the page has scrolled: it tightens by 14 px where scroll timelines run (desktop, motion
    // allowed); it keeps its height under reduced motion, in browsers without them, and on phones
    const tight = innerWidth > 900 && !RM.matches && CSS.supports('animation-timeline: scroll()');
    const head = (mast ? mast.offsetHeight : 72) - (tight ? 14 : 0), h = perfBox.offsetHeight;
    // the scroll margin adds to the root's scroll padding: y is where the stage's top lands in the window
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let y = pad + Math.max(30, Math.round(2 + (innerHeight - head - h) / 2));
    // the masthead's edge never slices a title or a line of the act above the stage: it falls in the blank just before
    // or just after it, whichever moves the stage less while the stage stays whole in the window
    // (the line boxes themselves, read from a range: a title set at .95 line height overflows its element's box)
    const top = perfBox.getBoundingClientRect().top, rg = document.createRange(), lines = [];
    for (const el of $$('.act--2 .act-no, .act--2 .act-name, .act--2 .act-lead')) {
      rg.selectNodeContents(el);
      for (const r of rg.getClientRects()) if (r.height > 1) lines.push([r.top - top, r.bottom - top]);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (const [a, b] of lines) {
        if (y + a >= head || y + b <= head) continue;
        const show = Math.ceil(head - a + 2), hide = Math.floor(head - b - 2);
        y = show + h <= innerHeight && show - y < y - hide ? show : hide;
      }
    }
    perfBox.style.scrollMarginTop = Math.max(0, y - pad) + 'px';
  }
  addEventListener('resize', () => {
    const w = innerWidth, h = innerHeight, s = Math.min(1040, (h - 372) * 1.52);
    // the act's width inside its frame and gutters (understudy.css): the split screen, centred between two columns of
    // 276 px, must come out larger than the one-column screen
    const c = w - 2 * Math.min(Math.max(0.014 * w, 10), 20) - 2 * Math.min(Math.max(0.04 * w, 16), 56);
    document.documentElement.classList.toggle('split', w >= 900 && s < Math.min(0.55 * w, 1000)
      && Math.min((h - 142) / 0.645 + 32, 1000, c - 552) > Math.min(c, Math.max(480, s)));
    centreStage();
  });
  if (perfBox) new ResizeObserver(centreStage).observe(perfBox);
  mastUpdate();

  /* ---------- the programme (menu on phones) ---------- */
  const prog = $('[data-prog]');
  if (prog && prog.showModal) {
    const opener = $('[data-prog-open]');
    const rows = $$('.prog-list a', prog);
    opener.addEventListener('click', () => {
      // the act in view is the selected row, the way an old list shows where you are
      let cur = null;
      for (const a of rows) { const s = $(a.getAttribute('href')); if (s && s.getBoundingClientRect().top < innerHeight * 0.5) cur = a; }
      for (const a of rows) a.removeAttribute('aria-current');
      if (cur) cur.setAttribute('aria-current', 'location');
      prog.showModal();
    });
    $('[data-prog-close]', prog).addEventListener('click', () => prog.close());
    // a row chosen in the programme hands the keyboard focus to its act, so the next Tab goes on from there
    let goTo = null;
    // the dimmed page around the window closes it, as a tap outside a menu does
    prog.addEventListener('click', (e) => { if (e.target === prog) prog.close(); });
    for (const a of $$('a', prog)) a.addEventListener('click', () => { goTo = $(a.getAttribute('href')); prog.close(); });
    prog.addEventListener('close', () => {
      if (goTo) { if (!goTo.matches('a, button, input')) goTo.setAttribute('tabindex', '-1'); goTo.focus({ preventScroll: true }); goTo = null; }
      else opener.focus({ preventScroll: true });
      prog.dispatchEvent(new Event('us-closed'));
    });
  }

  /* ---------- the box office's photo: fetched with the page (low priority, after the cover's), then decoded ahead, so it
     is on screen the moment a link or the scroll brings the box office in ---------- */
  const stillImg = $('.still img');
  if (stillImg && stillImg.decode) {
    const decode = () => stillImg.decode().catch(() => {});
    if (stillImg.complete) decode(); else stillImg.addEventListener('load', decode, { once: true });
  }

  /* ---------- 1. cover: the screen in the photo types four rows, then the cursor holds ---------- */
  const crt = $('[data-crt]');
  const crtS = { rows: [], row: 0, chr: 0, acc: 0, idle: 0.5, done: false, r: rng(5), visible: false, ready: false };
  {
    const R = crtS.r;
    for (let i = 0; i < 4; i++) {
      const words = []; let x = Math.floor(R() * 2) * 2, len = 0;
      const n = 3 + Math.floor(R() * 4);
      for (let w = 0; w < n && x < 62; w++) { const l = 2 + Math.floor(R() * 7); words.push([x, l]); x += l + 1 + Math.floor(R() * 2); len = x; }
      crtS.rows.push({ words, len });
    }
  }
  function crtDraw(dt) {
    if (!crt) return;
    const S = crtS, dpr = dprOf();
    const w = crt.clientWidth, h = crt.clientHeight;
    if (!w || !h) return;
    if (crt.width !== Math.round(w * dpr)) {
      crt.width = Math.round(w * dpr); crt.height = Math.round(h * dpr);
      // the photo's softness scales with the screen: a fixed blur would melt the lines of a small screen into one grey
      crt.style.filter = `blur(${Math.max(0.3, h * 0.0044).toFixed(2)}px)`;
    }
    if (!S.done) {
      if (S.idle > 0) S.idle -= dt;
      else {
        S.acc += dt * 48;          // four rows in under five seconds (WCAG 2.2.2): nothing moves on its own longer
        while (S.acc >= 1) {
          S.acc -= 1; S.chr++;
          if (S.chr > S.rows[S.row].len) {
            if (S.row === S.rows.length - 1) { S.done = true; S.chr = S.rows[S.row].len; break; }
            S.row++; S.chr = 0; S.idle = 0.18 + S.r() * 0.18; break;
          }
        }
      }
    }
    const ctx = crt.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // the rows continue the photo's own text, in its own ink and at its own strength: on the overexposed glass its lines
    // are a lighter core with a slightly darker band between them (a luminance swing of about -2.5 to +2 %), so each
    // typed word is a light smear and its line leaves a faint band of the glass's own cyan under it; same left edge
    // (3.7 % of the glass box), line pitch (2.95 %), first line right after the photo's last (img/cover-2400.webp)
    const cw = w * 0.9 / 80, left = w * 0.037, pitch = h * 0.0295, top = h * 0.443, gh = Math.max(0.9, pitch * 0.46);
    const smear = (x, y, ww, hh) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, ww, hh, hh / 2); else ctx.rect(x, y, ww, hh); ctx.fill(); };
    ctx.fillStyle = 'rgba(196, 222, 223, .2)';
    for (let i = 0; i <= S.row; i++) {
      const row = S.rows[i], lim = i < S.row ? row.len : Math.min(S.chr, row.len), x0 = row.words[0][0];
      if (lim > x0) smear(left + x0 * cw, top + (i + 0.5) * pitch - pitch * 0.22, (lim - x0) * cw, pitch * 0.44);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, .95)';
    for (let i = 0; i <= S.row; i++) {
      const row = S.rows[i], lim = i < S.row ? Infinity : S.chr, y = top + i * pitch - gh / 2;
      for (const [x, l] of row.words) {
        const vis = Math.min(l, lim - x);
        if (vis > 0) smear(left + x * cw, y, vis * cw - cw * 0.2, gh);
      }
    }
    // a steady block at the typing head, the brightest thing on the glass, with the line's band under it: no blinking,
    // so nothing keeps moving once the rows are typed
    const hx = left + (S.chr + 1) * cw, hy = top + S.row * pitch;
    ctx.fillStyle = 'rgba(196, 222, 223, .34)'; ctx.fillRect(hx - cw * 0.25, hy + pitch * 0.28, cw * 1.4, pitch * 0.44);
    ctx.fillStyle = '#fff'; ctx.fillRect(hx, hy - gh * 0.8, cw * 0.9, gh * 1.6);
  }
  if (crt) {
    const img = crt.previousElementSibling;
    const go = () => { crtS.ready = true; if (RM.matches) { crtS.row = crtS.rows.length - 1; crtS.chr = crtS.rows[crtS.row].len; crtS.done = true; crtDraw(0); } else wake(); };
    // opened in the portfolio, the screen waits for the portfolio's curtain to leave, so the visitor sees it start
    // typing: the page asks its parent; told to hold, it waits for the cue (4 s at most); with no answer within 150 ms
    // (alone, or in any other frame) it starts as before
    const cue = new Promise((done) => {
      if (window.parent === window) { done(); return; }
      let held = false;
      const end = () => { removeEventListener('message', on); done(); };
      const on = (e) => {
        const k = e.source === parent && e.data && e.data.type;
        if (k === 'portfolio:hold' && !held) { held = true; setTimeout(end, 4000); } else if (k === 'portfolio:reveal') end();
      };
      addEventListener('message', on);
      try { parent.postMessage({ type: 'landing:hello' }, '*'); } catch (e) { end(); }
      setTimeout(() => { if (!held) end(); }, 150);
    });
    const start = () => cue.then(go);
    if (img && !img.complete) { img.addEventListener('load', start, { once: true }); img.addEventListener('error', start, { once: true }); } else start();
    watch($('.cover'), (v) => { crtS.visible = v; if (v) wake(); });
    jobs.push({ active: () => crtS.ready && crtS.visible && !crtS.done && !RM.matches, frame: (dt) => crtDraw(dt) });
    new ResizeObserver(() => { if (crtS.ready) crtDraw(0); }).observe(crt);
  }

  /* ---------- 2. Act I: you tick each line of the script in pencil ---------- */
  // drawn on a narrow canvas in the page's left margin; the graphite grain is a noise tile made once
  const page = $('[data-page]'), pencil = $('[data-pencil]');
  const ticks = [];
  let ticked = false, tickT = -1, tickW = 0, tickH = 0, tickDpr = 1, grain = null;
  const TICK0 = 0.15, TICKGAP = 0.17, TICKDUR = 0.34;
  const easeTick = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  function makeGrain() {
    const g = document.createElement('canvas'); g.width = g.height = 96;
    const x = g.getContext('2d'), d = x.createImageData(96, 96), R = rng(31);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = Math.round(Math.pow(R(), 2.2) * 150); }
    x.putImageData(d, 0, 0);
    return g;
  }
  // the length of a tick (M, then two quadratic curves), measured on the curves themselves
  function tickLen(d) {
    const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const q = (x0, y0, cx, cy, x1, y1) => {
      let l = 0, px = x0, py = y0;
      for (let i = 1; i <= 24; i++) {
        const u = i / 24, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        const x = a * x0 + b * cx + c * x1, y = a * y0 + b * cy + c * y1;
        l += Math.hypot(x - px, y - py); px = x; py = y;
      }
      return l;
    };
    return q(n[0], n[1], n[2], n[3], n[4], n[5]) + q(n[4], n[5], n[6], n[7], n[8], n[9]);
  }
  function buildTicks() {
    if (!page || !pencil) return;
    ticks.length = 0;
    const pr = page.getBoundingClientRect();
    const PR = rng(9);
    const unit = parseFloat(getComputedStyle(page).fontSize) * 0.6;
    const left = parseFloat(getComputedStyle(page).paddingLeft);
    tickDpr = dprOf(); tickW = Math.ceil(left); tickH = Math.ceil(pr.height);
    pencil.style.width = tickW + 'px'; pencil.style.height = tickH + 'px';
    pencil.width = Math.round(tickW * tickDpr); pencil.height = Math.round(tickH * tickDpr);
    for (const el of $$('[data-tick]', page)) {
      const r = el.getBoundingClientRect();
      // narrow sheets have a narrow margin: the ticks are drawn smaller there, and keep their air from the text
      const km = clamp(left / 56, 0.72, 1);
      const x = left * 0.38 + (PR() - 0.5) * 6 * km, y = r.top - pr.top + unit * 1.45 + (PR() - 0.5) * 1.2;
      const sc = (1 + PR() * 0.22) * km, rot = (PR() - 0.5) * 16, j = () => (PR() - 0.5) * 1.6;
      const lx = -3 - PR() * 2.2, ly = -2 - PR() * 2, rx = 12 + PR() * 5, ry = -7 - PR() * 3;
      const d = `M${lx.toFixed(1)} ${(ly + j()).toFixed(1)} Q${(1.6 + j() * 0.3).toFixed(1)} ${(2.6 + j() * 0.3).toFixed(1)} ${(3.2 + j() * 0.4).toFixed(1)} 5.4 Q${(6.5 + j()).toFixed(1)} ${(-2.4 + j()).toFixed(1)} ${(rx + j()).toFixed(1)} ${(ry + j()).toFixed(1)}`;
      ticks.push({ path: new Path2D(d), len: tickLen(d) + 1, x, y, sc, rot: rot * Math.PI / 180, w: (1.5 + PR() * 0.7) / sc });
    }
    // ticks on neighbouring lines keep air between them: a tick close to another is drawn a little smaller
    ticks.forEach((k, i) => {
      const gap = Math.min(i ? k.y - ticks[i - 1].y : 99, i < ticks.length - 1 ? ticks[i + 1].y - k.y : 99);
      k.sc *= clamp(gap / 30, 0.8, 1); k.w = k.w;
    });
    drawTickFrame(ticked ? 99 : tickT);
  }
  function drawTickFrame(tt) {
    if (!pencil || !ticks.length) return;
    const g = pencil.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pencil.width, pencil.height);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#5E5A52'; g.lineCap = 'round'; g.lineJoin = 'round';
    ticks.forEach((k, i) => {
      const u = tt < 0 ? 0 : easeTick((tt - TICK0 - i * TICKGAP) / TICKDUR);
      if (u <= 0) return;
      g.setTransform(tickDpr, 0, 0, tickDpr, 0, 0);
      g.translate(k.x, k.y); g.rotate(k.rot); g.scale(k.sc, k.sc);
      g.lineWidth = k.w; g.setLineDash([k.len * u, k.len]);
      g.globalAlpha = 1; g.stroke(k.path);
      // a second, lighter pass a third of a pixel off: the lead's two edges
      g.translate(0.35, -0.3); g.lineWidth = k.w * 0.55; g.globalAlpha = 0.55; g.stroke(k.path); g.globalAlpha = 1;
    });
    // graphite: the grain lifts a little of the stroke, the way pencil skips on paper
    g.setTransform(1, 0, 0, 1, 0, 0); g.setLineDash([]);
    if (!grain) grain = makeGrain();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(0, 0, pencil.width, pencil.height);
    g.globalCompositeOperation = 'source-over';
  }
  const tickEnd = () => TICK0 + ticks.length * TICKGAP + TICKDUR;
  function drawTicks(animate) {
    ticked = true;
    if (!animate) { tickT = 99; drawTickFrame(99); return; }
    tickT = 0; wake();
  }
  // the edge of the stage runs just above the script's last direction ("plays the scene again..."): the sheet is laid
  // on the stage with that line on it, never with an empty band of paper
  function setLap() {
    if (!page) return;
    const last = $$('.typo > p', page).pop();
    if (!last) return;
    const lh = parseFloat(getComputedStyle(last).lineHeight) || 26;
    const lap = Math.round(page.getBoundingClientRect().bottom - last.getBoundingClientRect().top + lh * 0.5);
    document.documentElement.style.setProperty('--lap1', lap + 'px');
  }
  if (page) {
    jobs.push({ active: () => ticked && tickT >= 0 && tickT < tickEnd(), frame: (dt) => { tickT = Math.min(tickEnd(), tickT + dt); drawTickFrame(tickT); } });
    const init = () => { setLap(); buildTicks(); if (RM.matches) drawTicks(false); };
    document.fonts.ready.then(init);
    let rz = 0;
    new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { setLap(); buildTicks(); }); }).observe(page);
    watch(page, (v) => { if (v && !ticked) { if (!ticks.length) buildTicks(); requestAnimationFrame(() => drawTicks(!RM.matches)); } }, 0.45);
  }

  /* ---------- 3. Act II: the morning on the green screen ---------- */
  const term = $('[data-terminal]');
  const canvas = $('[data-screen]');
  const journal = $('[data-journal]');
  const live = $('[data-live]');
  const goKey = $('[data-go]');
  let surWho = $('[data-who]'), surLine = $('[data-line]');
  const hand = $('[data-hand]'), tagEl = $('[data-tag]'), actEl = $('[data-act]'), arrowEl = hand && $('.arrow', hand);
  const postit = $('[data-postit]');

  if (term && canvas) {
    const COLS = 80, ROWS = 24;
    const ch = new Array(COLS * ROWS).fill(' ');
    const at = new Uint8Array(COLS * ROWS); // 1 bright, 2 reverse field
    let cursor = { r: 20, c: 6, on: true };
    let dirty = true, switchAt = -1;
    const put = (r, c, s, a = 0) => { for (let i = 0; i < s.length && c + i < COLS; i++) { ch[r * COLS + c + i] = s[i]; at[r * COLS + c + i] = a; } dirty = true; };
    const field = (r, c, n) => put(r, c, ' '.repeat(n), 2);
    const clearAll = () => { ch.fill(' '); at.fill(0); dirty = true; };
    const center = (r, s, a = 1) => put(r, Math.floor((COLS - s.length) / 2), s, a);
    const pad = (s, n, right) => (right ? s.padStart(n) : s.padEnd(n)).slice(0, n);

    // the fictional purchasing system on an IBM i: HD/400 for Hollis & Daughters
    const FKEYS_MENU = ' F3=Exit   F4=Prompt   F9=Retrieve   F12=Cancel';
    const FKEYS_PO = ' F3=Exit   F4=Prompt   F6=Hold   F10=Post order   F12=Cancel';
    const hot = (label) => { const i = FKEYS_PO.indexOf(label); return { r: 22, c: i, n: label.length }; };
    const HOT = { F6: hot('F6=Hold'), F10: hot('F10=Post order') };
    const F = { po: [5, 34, 10], sup: [6, 34, 6], date: [8, 34, 8], wh: [9, 34, 2] };
    const L = (i) => ({ item: [12 + i, 9, 10], qty: [12 + i, 50, 5], price: [12 + i, 57, 10] });

    let clockSec = 6 * 3600 + 12;
    const clockStr = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
    function drawClock() { put(1, 70, clockStr(clockSec), 0); }
    function menuScreen() {
      clearAll();
      put(0, 1, 'PURMENU', 0); center(0, 'Purchasing'); put(0, 70, '02/11/26', 0);
      put(1, 1, 'HD/400', 0); drawClock();
      put(3, 1, 'Select one of the following:', 1);
      ['1. Enter purchase orders', '2. Change a purchase order', '3. Receive goods', '4. Supplier enquiry', '5. Print reports'].forEach((s, i) => put(5 + i, 6, s, 0));
      put(11, 5, '90. Sign off', 0);
      put(19, 1, 'Selection or command', 0);
      put(20, 1, '===>', 1); field(20, 6, 73);
      put(22, 0, FKEYS_MENU, 0);
    }
    function poScreen() {
      clearAll();
      put(0, 1, 'PO100R', 0); center(0, 'Purchase Order Entry'); put(0, 70, '02/11/26', 0);
      put(1, 1, 'HD/400', 0); drawClock();
      put(3, 1, 'Type information, press Enter.', 1);
      put(5, 3, 'Order number . . . . . . . .', 0); field(...F.po);
      put(6, 3, 'Supplier . . . . . . . . . .', 0); field(...F.sup);
      put(7, 3, 'Supplier VAT number  . . . :', 0);
      put(8, 3, 'Delivery date  . . . . . . .', 0); field(...F.date);
      put(9, 3, 'Warehouse  . . . . . . . . .', 0); field(...F.wh); put(F.wh[0], F.wh[1], 'B', 2);
      put(11, 3, 'Line  Item        Description                Qty    Unit price', 1);
      for (let i = 0; i < 4; i++) { put(12 + i, 4, '0' + (i + 1), 0); const l = L(i); field(...l.item); field(...l.qty); field(...l.price); }
      put(17, 42, 'Order total', 0);
      put(22, 0, FKEYS_PO, 0);
    }
    function clearPo() {
      for (const k of ['po', 'sup', 'date']) field(...F[k]);
      put(6, 49, ' '.repeat(26), 0); put(7, 34, ' '.repeat(14), 0);
      for (let i = 0; i < 4; i++) { const l = L(i); field(...l.item); put(12 + i, 21, ' '.repeat(26), 0); field(...l.qty); field(...l.price); }
      put(17, 55, ' '.repeat(12), 0);
    }

    // The inbox: 38 orders. One supplier, 20981, has no VAT number on file.
    const SUP = [['20417', 'Brindle Timber Ltd', 'GB 214 7781 30'], ['20552', 'Ashby Aggregates', 'GB 318 2045 77'], ['20063', 'Pell & Rowe Plumbing', 'GB 109 5520 13'],
      ['20730', 'Cotswold Slate Co', 'GB 447 0981 62'], ['20981', 'Kettering Fixings', '']];
    const ITEMS = [['TMB-4410', 'Sawn larch 47 x 150', 4.85], ['FIX-0912', 'Coach screws M10 x 100', 0.31], ['AGG-2020', 'Sharp sand, bulk bag', 46.5],
      ['PLB-1503', 'Copper pipe 15 mm x 3 m', 13.2], ['SLT-0600', 'Welsh slate 500 x 250', 2.74], ['FIX-0450', 'Wall plugs, box of 100', 3.1], ['TMB-2290', 'CLS stud 38 x 89 x 2.4', 3.95]];
    const R = rng(2026);
    const orders = [];
    for (let i = 0; i < 38; i++) {
      const no = '4471-0' + String(201 + i);
      const sup = i === 0 ? SUP[0] : i === 30 ? SUP[4] : SUP[Math.floor(R() * 4)];
      const n = i === 0 ? 2 : 1 + Math.floor(R() * 3);
      const lines = [];
      for (let k = 0; k < n; k++) {
        const it = i === 0 ? ITEMS[k] : ITEMS[Math.floor(R() * ITEMS.length)];
        const q = i === 0 ? [120, 400][k] : [12, 25, 40, 60, 100, 150, 200][Math.floor(R() * 7)];
        lines.push([it[0], it[1], q, it[2]]);
      }
      const day = 4 + Math.floor(R() * 4);
      orders.push({ no, sup, lines, date: i === 0 ? '05/11/26' : `0${day}/11/26` });
    }
    const money = (v) => v.toFixed(2);

    /* the timeline: ops sorted by time, pointer segments, surtitles, camera shots, journal notes */
    const ops = [], segs = [], notes = [], surs = [], shots = [], acts = [];
    let T = 0, ptr = { x: 68, y: 12.5 };
    const op = (dt, fn) => { T += dt; ops.push({ t: T, fn }); };
    // a word joiner after the hyphen keeps order numbers on one line (the fonts have no non-breaking hyphen)
    const nb = (x) => x && x.replace(/(\d)-(\d)/g, '$1-\u2060$2');
    const note = (text, liveText) => notes.push({ t: T, text: nb(text), live: liveText });
    const sur = (who, text, dt = 0) => surs.push({ t: T + dt, who, text: nb(text) });
    // camera rectangles in cells: [col, row, cols, rows]. Whole fields and whole lines, never a point.
    // each holds whole words only: labels and values (names start at column 49), the item lines, the keys and message rows
    const WIDE = [0, 0, 80, 24], FIELDS = [2, 5, 46, 5], LINES = [3, 11, 64, 7], KEYS = [0, 22, 62, 1], MSG = [0, 23, 36, 1], ERR = [0, 17, 64, 7];
    const shot = (rect, dt = 0) => shots.push({ t: T + dt, rect });
    // the tag on the hand says what it is doing; it sits on the side of the arrow that hides nothing being typed
    const act = (text, dt = 0) => acts.push({ t: T + dt, text: nb(text) });
    const cell = (r, c) => ({ x: c + 0.5, y: r + 0.55 });
    // on a function key, on desktops, the tip rests on the top of the label, so a tag above it never hides the row of
    // keys (phones keep the middle of the row: their camera frames it); set with the rest point in restFor
    const KEY = { y: 22.55 };
    function seg(to, dur, opts) {
      const from = ptr;
      const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy * 2.15);
      const bend = (opts.bend ?? (R() - 0.5) * 0.22) * d;
      // desktops can take another bend: there the tag rides above the arrow, so a path must not sag through the keys
      segs.push({ t0: T, t1: T + dur, from: ptr, to, bend, bendD: opts.bendD === undefined ? bend : opts.bendD * d, side: opts.side });
      ptr = to;
    }
    function move(to, dur, opts = {}) { seg(to, dur, opts); T += dur; }
    // a glide runs alongside what follows (the hand leaves the field while the keys go on)
    function glide(to, dur, opts = {}) { seg(to, dur, opts); }
    function reach(to, dur, opts = {}) { // a hand: lands a little short or long, then corrects
      const over = opts.over ?? 0.6;
      const ux = Math.sign(to.x - ptr.x) || 1;
      // the overshoot follows its target (whose height can change with the layout)
      const ox = ux * over * (R() * 0.8 + 0.4), oy = (R() - 0.5) * 0.25;
      move({ get x() { return to.x + ox; }, get y() { return to.y + oy; } }, dur, opts);
      move(to, 0.16 + R() * 0.1, { bend: 0, bendD: 0, side: opts.side });
    }
    // where the hand waits while it types: clear of every field it fills (cells, and the side of its tag)
    // where the hand waits: low on the right with its tag above it, in the empty rows between the total and the keys
    // (built with the old desktop rest point: the phone's bends are scaled by these first distances)
    const REST = { x: 70, y: 17.75 };
    // the hesitation over F10 and the step back from it: on desktops at the same low height
    const HOV1 = { x: HOT.F10.c + 6, y: 21.2 }, HOV2 = { x: HOT.F10.c + 5.2, y: 21.5 }, BACK = { x: 50, y: 18.6 };
    // the tag above the tip (its height plus 6 px) must clear the glyphs of row 17 (they end at 0.82 of a row)
    const restFor = (cam, low = 21.6) => {
      Object.assign(REST, cam ? { x: 75, y: 21.6 } : { x: 67, y: low });
      Object.assign(HOV1, { x: HOT.F10.c + 6, y: cam ? 21.2 : low });
      Object.assign(HOV2, { x: HOT.F10.c + 5.2, y: cam ? 21.5 : Math.min(22, low + 0.2) });
      Object.assign(BACK, cam ? { x: 50, y: 18.6 } : { x: 49, y: low });
      KEY.y = cam ? 22.55 : 22.36;
    };
    // pace: 1 as you did it, 0.5 attentive (the order it will stop on), 0 the replay
    const keyGap = (pace) => (pace === 0 ? 0.0011 + R() * 0.001 : (0.075 + R() * 0.07) * (pace === 1 ? 1 : 0.46));
    function type(r, c, s, pace, a = 2) {
      for (let i = 0; i < s.length; i++) {
        const k = i, gap = keyGap(pace) + (pace && /[-/.]/.test(s[i]) ? 0.08 * pace : 0);
        op(gap, () => { put(r, c + k, s[k], a); cursor = { r, c: c + k + 1, on: true }; });
      }
    }
    const tab = (f, pace) => op(pace === 0 ? 0.006 : (0.16 + R() * 0.08) * pace, () => { cursor = { r: f[0], c: f[1], on: true }; });
    let press = -9;
    function click(f, dwell) { T += dwell ?? (0.14 + R() * 0.1); const tt = T; ops.push({ t: tt, fn: () => { press = tt; if (f) cursor = { r: f[0], c: f[1], on: true }; } }); }
    function flashHot(h) { const t0 = T; ops.push({ t: t0, fn: () => { for (let i = 0; i < h.n; i++) at[h.r * COLS + h.c + i] = 2; dirty = true; } }); ops.push({ t: t0 + 0.16, fn: () => { for (let i = 0; i < h.n; i++) at[h.r * COLS + h.c + i] = 0; dirty = true; } }); }
    function msg(text, a) { put(23, 0, ' '.repeat(COLS), 0); if (text) put(23, 1, text, a); }
    function wait(sec) { op(0, () => { cursor.on = false; msg('X SYSTEM', 2); }); T += sec; }

    function performOrder(o, mode) {
      const pace = mode === 'fast' ? 0 : mode === 'medium' ? 0.5 : 1, slow = mode === 'slow';
      const gap = (q, s) => (pace === 0 ? q : s * pace);
      if (!slow) act(`Entering ${o.no}`);
      if (slow) {
        sur('UNDERSTUDY', '(in Order number) 4471-0201.'); reach(cell(...F.po), 0.95); click(F.po);
        act('Typing 4471-0201'); glide(REST, 0.75, { bend: -0.12 });
      }
      else op(gap(0.03, 0.3), () => { cursor = { r: F.po[0], c: F.po[1], on: true }; });
      type(...F.po.slice(0, 2), o.no, pace);
      if (slow) sur('UNDERSTUDY', '(Tab, Supplier) 20417.', 0.1);
      tab(F.sup, pace); if (slow) act('Typing 20417');
      type(F.sup[0], F.sup[1], o.sup[0], pace);
      op(gap(0.01, 0.22), () => { put(6, 49, pad(o.sup[1], 26), 1); put(7, 34, pad(o.sup[2], 14), 1); });
      if (slow) sur('UNDERSTUDY', '(Tab, Delivery date) 05/11/26.', 0.1);
      tab(F.date, pace); if (slow) act('Typing 05/11/26');
      type(F.date[0], F.date[1], o.date, pace);
      let total = 0;
      o.lines.forEach((ln, i) => {
        const l = L(i);
        if (slow && i === 0) {
          shot(LINES); sur('UNDERSTUDY', '(one line per item, then F10)'); act('Moving to line 1'); reach(cell(...l.item), 0.85, { bendD: 0.12 }); click(l.item);
          glide(REST, 0.7, { bend: 0.1 });
        }
        else tab(l.item, pace);
        if (slow) act(`Typing ${ln[0]}`);
        type(l.item[0], l.item[1], ln[0], pace);
        op(gap(0.008, 0.2), () => put(12 + i, 21, pad(ln[1], 26), 0));
        tab(l.qty, pace); if (slow) act(`Typing ${ln[2]}`);
        type(l.qty[0], l.qty[1], pad(String(ln[2]), 5, true), pace);
        tab(l.price, pace); if (slow) act(`Typing ${money(ln[3])}`);
        type(l.price[0], l.price[1], pad(money(ln[3]), 10, true), pace);
        total += ln[2] * ln[3];
        const tt = total;
        op(gap(0.004, 0.05), () => put(17, 55, pad(money(tt), 12, true), 1));
      });
      return total;
    }
    function post(o, mode) {
      const fast = mode === 'fast';
      if (mode === 'slow') { act('Moving to F10'); reach({ x: HOT.F10.c + 4, get y() { return KEY.y; } }, 1.05, { over: 1.4, bendD: 0 }); shot(KEYS, -0.6); click(null, 0.24); act('Pressing F10'); flashHot(HOT.F10); }
      else { op(fast ? 0.02 : 0.3, () => {}); flashHot(HOT.F10); }
      wait(fast ? 0.045 : 0.42);
      op(0, () => { msg(`Order ${o.no} posted.`, 1); cursor = { r: F.po[0], c: F.po[1], on: true }; clearPo(); clockSec += fast ? (clockSec < 6 * 3600 + 14 * 60 ? 22 : 19) + Math.floor(R() * 8) : 31; drawClock(); });   // 06:00 at the start, 06:16 at the end
      if (mode === 'slow') act(`Posted ${o.no}`);
    }

    // ----- write the morning -----
    sur('', 'Scene 1. Purchasing, 06:00.');
    op(0.2, () => { menuScreen(); cursor = { r: 20, c: 6, on: true }; switchAt = 0; });
    T += 0.5;
    sur('UNDERSTUDY', '(at the menu, types 1, then Enter)');
    act('Ready', -0.7);
    act('Choosing option 1');
    // the hand points at the option it reads (the cursor already waits on the command line), clear of every label
    reach({ x: 30.6, y: 5.55 }, 1.15, { over: 0.9, side: 'tr' });
    T += 0.25; type(20, 6, '1', 1); op(0.28, () => {});
    act('Pressing Enter');
    wait(0.45);
    op(0, () => { poScreen(); cursor = { r: F.po[0], c: F.po[1], on: true }; switchAt = 1; });
    act('Reading the screen');
    sur('THE SCREEN', 'Purchase Order Entry.'); shot(FIELDS, 0.2);
    note('Typing order 4471-0201 the way you did it.', 'The morning has started: order 4471-0201.');
    T += 0.9;
    performOrder(orders[0], 'slow');
    post(orders[0], 'slow');
    shot(MSG, -0.1);
    sur('THE SCREEN', 'Order 4471-0201 posted.');
    T += 1.1;
    shot(WIDE);
    // the pointer rests at the side of the keyboard: from here, keys only
    sur('', 'UNDERSTUDY plays the scene again for each order in the inbox.');
    move(REST, 0.9, { bend: 0.12, bendD: 0 });
    for (let i = 1; i < 30; i++) {
      const o = orders[i];
      if (i === 1) note('Playing the scene again for each order in the inbox.');
      performOrder(o, 'fast'); post(o, 'fast');
      // once its first line has been read (about 2 s), the journal counts each order at the instant the screen posts it
      // (never behind it); the live region keeps its own milestones
      if (i >= 7) note(`Entered ${i + 1} of 38 orders.`);
    }
    // order 31: the supplier has no VAT number
    const held = orders[30];
    shot(FIELDS, 0.1);
    note(`Order ${held.no}: supplier ${held.sup[0]}.`);
    performOrder(held, 'medium');
    op(0.32, () => {}); flashHot(HOT.F10);
    wait(0.45);
    op(0, () => { msg('Supplier 20981 has no VAT number.', 3); cursor.on = false; });
    act('Reading the error');
    // phones: a second on the message alone, then one framing for what follows (the hesitation over F10, F6, the
    // message line): the hand stays in view through the decision instead of leaving and coming back between close-ups
    shot(MSG, 0.05); shot(ERR, 1.0);
    sur('THE SCREEN', 'Supplier 20981 has no VAT number.', 0.15);
    note('Stopped on 4471-0231 to ask before posting.', 'Stopped on order 4471-0231: the supplier has no VAT number.');
    // the hand hesitates over F10, then backs away
    move(HOV1, 1.1, { bend: -0.1, bendD: 0 });
    act('Not sure');
    move(HOV2, 0.5, { bend: 0 });
    T += 0.55;
    move(BACK, 0.8, { bend: 0.2, bendD: 0 });
    sur('', 'UNDERSTUDY stops. It holds the order with F6.', -0.5);
    reach({ x: HOT.F6.c + 3.5, get y() { return KEY.y; } }, 0.95, { over: 0.8, bendD: 0 });
    click(null, 0.24); act('Holding with F6'); flashHot(HOT.F6);
    wait(0.32);
    op(0, () => { msg(`Order ${held.no} held.`, 1); cursor = { r: F.po[0], c: F.po[1], on: true }; clearPo(); clockSec = 6 * 3600 + 14 * 60 + 6; drawClock(); });
    shot(WIDE, 0.3);
    sur('UNDERSTUDY', '(to Marie, by email) I held order 4471-0231. Should I post it without a VAT number?', 0.3);
    act('Writing to Marie', 0.3);
    // the hand goes back to rest once the camera has opened on the whole screen (on phones it would leave the frame)
    T += 0.6;
    move(REST, 1.0, { bend: 0.15, bendD: 0 });
    T += 2.8;
    note('Asked Marie at 06:14, by email.', 'Asked Marie at 06:14.');
    sur('', 'UNDERSTUDY plays the scene again for the last seven orders.');
    for (let i = 31; i < 38; i++) { const o = orders[i]; performOrder(o, 'fast'); post(o, 'fast'); }
    T += 1.0;
    act('Done for the morning');
    const FINAL = 'Entered 37 purchase orders, held 4471-0231 because supplier 20981 has no VAT number, and asked Marie.';
    notes.push({ t: T, text: nb(FINAL), live: FINAL, final: true });
    // 08:40: Marie answers on a sticky note, pressed on the corner of the screen
    T += 1.8;
    const NOTE_T = T;
    sur('MARIE', '(at 08:40, on a note)');
    const ANSWER = FINAL + ' At 08:40, Marie answered on a note: Hold it. I’ll call them.';
    notes.push({ t: NOTE_T + 2.9, live: ANSWER, liveOnly: true });
    const T_END = NOTE_T + 3.1;
    ops.sort((a, b) => a.t - b.t);
    surs.sort((a, b) => a.t - b.t);
    shots.sort((a, b) => a.t - b.t);
    acts.sort((a, b) => a.t - b.t);
    notes.sort((a, b) => a.t - b.t);

    /* ---------- screen rendering ---------- */
    const COL = { bg: '#03110A', n: '#36DC6D', b: '#A2FFC1', rev: '#2FC761' };
    // the phosphor's halo: a blurred copy where the canvas can blur, otherwise a smaller copy scaled back up
    const BLOOM = 'filter' in CanvasRenderingContext2D.prototype;
    const ZMAX = 1.9;
    let c0 = 12.6, rh0 = 27, W = 1008, H = 650, dpr = 1, camMode = false, zr = 1;
    const tx = document.createElement('canvas'), bl = document.createElement('canvas'), pv = document.createElement('canvas'), sm = document.createElement('canvas');
    let fontReady = false;
    function layout() {
      const w = canvas.clientWidth;
      if (!w) return;
      dpr = dprOf();
      W = w; c0 = W / 80; rh0 = c0 * 2.15; H = Math.round(rh0 * ROWS * 100) / 100;
      camMode = W < 520 && innerWidth < 900;   // the camera is for phones; desktops always show the whole screen
      zr = camMode ? ZMAX : 1;
      restFor(camMode);
      if (hand) {
        hand.classList.toggle('is-compact', camMode); actIdx = -1; handKey = ''; measureTag();
        restFor(camMode, clamp(17.9 + (tagH + 6) / rh0, 20.9, 21.9));
        const gr = hand.parentElement.getBoundingClientRect(); glassX = gr.left + scrollX; glassY = gr.top + scrollY;
      }
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      for (const k of [tx, pv]) { k.width = Math.round(W * dpr * zr); k.height = Math.round(H * dpr * zr); }
      bl.width = Math.round(W * dpr / 2); bl.height = Math.round(H * dpr / 2);
      dirty = true;
    }
    function renderText() {
      const g = tx.getContext('2d');
      const s = dpr * zr;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, W, H);
      g.font = `${(c0 * 2.5).toFixed(2)}px VT323, monospace`;
      g.textBaseline = 'alphabetic';
      const base = (rh0 + c0 * 1.4) / 2;
      for (let r = 0; r < ROWS; r++) {
        let s0 = 0;
        while (s0 < COLS) {
          const a = at[r * COLS + s0]; let e = s0 + 1;
          while (e < COLS && at[r * COLS + e] === a) e++;
          const x = s0 * c0, y = r * rh0;
          if (a & 2) { g.fillStyle = a & 1 ? COL.b : COL.rev; g.fillRect(x, y + 1, (e - s0) * c0, rh0 - 2); g.fillStyle = COL.bg; }
          else g.fillStyle = a & 1 ? COL.b : COL.n;
          for (let i = s0; i < e; i++) { const k = ch[r * COLS + i]; if (k !== ' ') g.fillText(k, i * c0, y + base); }
          s0 = e;
        }
      }
      const b = bl.getContext('2d');
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, bl.width, bl.height);
      if (BLOOM) {
        b.filter = `blur(${(1.6 * dpr / 2).toFixed(2)}px)`;
        b.drawImage(tx, 0, 0, bl.width, bl.height);
        b.filter = 'none';
      } else {
        // no canvas filter (Safari): a copy at a quarter of the size, scaled back up with smoothing, spreads the light
        sm.width = Math.max(1, Math.round(bl.width / 2)); sm.height = Math.max(1, Math.round(bl.height / 2));
        const q = sm.getContext('2d'); q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high';
        q.clearRect(0, 0, sm.width, sm.height); q.drawImage(tx, 0, 0, sm.width, sm.height);
        b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
        b.drawImage(sm, 0, 0, bl.width, bl.height);
      }
      dirty = false;
    }
    // the pointer in cells, and where it is heading
    function ptrAt(t) {
      if (!segs.length) return { x: 68, y: 12.5, to: { x: 68, y: 12.5 }, i: -1, u: 1 };
      let p = { ...segs[0].from, to: segs[0].from, i: -1, u: 1 };
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (t < s.t0) break;
        if (t >= s.t1) { p = { ...s.to, to: s.to, i: -1, u: 1 }; continue; }
        const u = mj((t - s.t0) / (s.t1 - s.t0));
        const dx = s.to.x - s.from.x, dy = (s.to.y - s.from.y) * 2.15, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d, b = (camMode ? s.bend : s.bendD) * 4 * u * (1 - u);
        return { x: s.from.x + dx * u + nx * b, y: s.from.y + (s.to.y - s.from.y) * u + (ny * b) / 2.15, to: s.to, i, u };
      }
      return p;
    }
    // the side of the tag: the one that covers the least text and fields where the hand is going, seen through the
    // framing the camera is moving to; off-glass area costs more than ink, below-right is the habit, staying put is cheap
    const SIDES = [['br', 0], ['bl', 0.35], ['tr', 0.5], ['tl', 0.8], ['mr', 0.7], ['ml', 1]];
    function bestSide(to, cm, cur, stay = 0.6) {
      const z = cm.z, tx0 = (to.x * c0 - cm.x) * z, ty0 = (to.y * rh0 - cm.y) * z;
      if (tx0 < 0 || tx0 > W || ty0 < 0 || ty0 > H) return cur;   // the hand is off the glass: keep the tag as it is
      let best = cur, bestCost = 1e9;
      for (const [sd, pref] of SIDES) {
        const [ox, oy] = sideOff(sd, tagWmax);
        const x0 = tx0 + ox, y0 = ty0 + oy, x1 = x0 + tagWmax, y1 = y0 + tagH;
        const inside = Math.max(0, Math.min(x1, W) - Math.max(x0, 0)) * Math.max(0, Math.min(y1, H) - Math.max(y0, 0));
        const off = (tagWmax * tagH - inside) / (c0 * rh0 * z * z);
        const cx0 = x0 / z + cm.x, cy0 = y0 / z + cm.y, cx1 = x1 / z + cm.x, cy1 = y1 / z + cm.y;
        let ink = 0;
        for (let r = Math.max(0, Math.floor(cy0 / rh0)); r <= Math.min(ROWS - 1, Math.floor(cy1 / rh0)); r++) {
          const ov = Math.min(cy1, (r + 1) * rh0) - Math.max(cy0, r * rh0);
          if (ov <= 0) continue;
          for (let c = Math.max(0, Math.floor(cx0 / c0)); c <= Math.min(COLS - 1, Math.floor(cx1 / c0)); c++) {
            const j = r * COLS + c;
            if (ch[j] === ' ' && !(at[j] & 2)) continue;
            const oh = Math.min(cx1, (c + 1) * c0) - Math.max(cx0, c * c0);
            const typing = r === Math.floor(to.y) && c >= Math.floor(to.x) - 1 ? 3 : r >= 22 || r === 17 || r === 19 || r === 11 ? 3 : 1;
            // an empty field (reverse video, no character) hides nothing worth reading: it weighs far less than text
            const blank = ch[j] === ' ' ? 0.15 : 1;
            if (oh > 0) ink += typing * blank * (oh * ov) / (c0 * rh0);
          }
        }
        const cost = ink + 3 * off + pref - (sd === cur ? stay : 0);
        if (cost < bestCost) { bestCost = cost; best = sd; }
      }
      return best;
    }
    // camera: critically damped springs on x, y and zoom, aimed at whole rectangles
    const cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, ix0: 0, iy0: 0, ix1: 0, iy1: 0, vix0: 0, viy0: 0, vix1: 0, viy1: 0 };
    const CAMK = ['x', 'y', 'z', 'ix0', 'iy0', 'ix1', 'iy1'];
    function camTarget(t) {
      if (!camMode) return { x: 0, y: 0, z: 1, ix0: 0, iy0: 0, ix1: W, iy1: H };
      let rect = WIDE;
      for (const s of shots) { if (s.t <= t) rect = s.rect; else break; }
      const [c, r, w, h] = rect;
      const z = clamp(Math.min(W / (w * c0), H / (h * rh0)), 1, ZMAX);
      const vw = W / z, vh = H / z;
      const cx = (c + w / 2) * c0, cy = (r + h / 2) * rh0;
      const pc = 0.45 * c0, pr = 0.3 * rh0;
      return { x: clamp(cx - vw / 2, 0, W - vw), y: clamp(cy - vh / 2, 0, H - vh), z,
        ix0: c * c0 - pc, iy0: r * rh0 - pr, ix1: (c + w) * c0 + pc, iy1: (r + h) * rh0 + pr };
    }
    function camStep(t, dt, snap) {
      const tg = camTarget(t);
      if (snap || dt <= 0 || RM.matches) { for (const p of CAMK) { cam[p] = tg[p]; cam['v' + p] = 0; } return; }
      const k = 5;
      for (const p of CAMK) {
        const v = 'v' + p, a = -2 * k * cam[v] - k * k * (cam[p] - tg[p]);
        cam[v] += a * dt; cam[p] += cam[v] * dt;
      }
    }
    let pvAt = -1;
    function draw(t, dt, snap) {
      if (!fontReady) return;
      if (dirty) {
        if (switchAt >= 0) { const g = pv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pv.width, pv.height); g.drawImage(tx, 0, 0); pvAt = t; switchAt = -1; }
        renderText();
      }
      camStep(t, dt, snap);
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
      const z = cam.z;
      g.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * dpr * z, -cam.y * dpr * z);
      // a new screen is painted from the top down (140 ms): the old one stays below the line until it is reached
      const sweep = pvAt >= 0 ? clamp((t - pvAt) / 0.14, 0, 1) : 1;
      if (sweep < 1) {
        const yc = Math.ceil(sweep * ROWS) * rh0;   // row by row, like the terminal
        g.save(); g.beginPath(); g.rect(-1, yc, W + 2, H - yc + 1); g.clip(); g.drawImage(pv, 0, 0, W, H); g.restore();
        g.save(); g.beginPath(); g.rect(-1, -1, W + 2, yc + 1); g.clip();
      }
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = BLOOM ? 0.42 : 0.34; g.drawImage(bl, 0, 0, W, H);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(tx, 0, 0, W, H);
      if (sweep < 1) g.restore();
      // block cursor: steady while typing, blinking when idle
      if (cursor.on && sweep >= 1) {
        const lastKey = opIdx > 0 ? ops[opIdx - 1].t : -9;
        if (t - lastKey < 0.5 || (t % 1.06) < 0.62 || RM.matches) {
          const x = cursor.c * c0, y = cursor.r * rh0;
          g.fillStyle = COL.b; g.fillRect(x, y + 1, c0, rh0 - 2);
          const k = ch[cursor.r * COLS + cursor.c];
          if (k && k !== ' ') { g.fillStyle = COL.bg; g.font = `${(c0 * 2.5).toFixed(2)}px VT323, monospace`; g.fillText(k, x, y + (rh0 + c0 * 1.4) / 2); }
        }
      }
      const ia = camMode ? clamp((cam.z - 1.06) / 0.14, 0, 1) : 0;
      if (ia > 0.002) {
        g.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * dpr * z, -cam.y * dpr * z);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = COL.bg;
        for (const [grow, alpha] of [[0.5 * c0, 0.5], [0, 0.84]]) {
          const p = new Path2D();
          p.rect(-W, -H, W * 3, H * 3);
          p.roundRect(cam.ix0 - grow, cam.iy0 - grow, cam.ix1 - cam.ix0 + 2 * grow, cam.iy1 - cam.iy0 + 2 * grow, c0 * 0.6 + grow);
          g.globalAlpha = alpha * ia; g.fill(p, 'evenodd');
        }
        g.globalAlpha = 1;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHand(t, dt, snap); drawPostit(t);
    }
    /* ---------- the hand on the glass: arrow and tag in the DOM, so both stay sharp; whole device pixels ---------- */
    let handOkSince = Infinity, actIdx = -1, handKey = '', tagW = 180, tagH = 48, tagWmax = 200, glassX = 0, glassY = 0;
    const px = (v) => Math.round(v * dpr) / dpr;
    // the glass sits on a fraction of a pixel: round the hand on the page's pixel grid, then express it on the glass
    const pxOn = (v, o) => Math.round((v + o) * dpr) / dpr - o;
    function sideOff(s, w = tagW) {
      return [s[1] === 'l' ? -w - 4 : 14, s[0] === 't' ? -tagH - 6 : s[0] === 'm' ? Math.round((15 - tagH) / 2) : 21];
    }
    function measureTag() {
      if (!tagEl || !actEl) return;
      const keep = actEl.textContent;
      actEl.textContent = acts.reduce((m, a) => (a.text.length > m.length ? a.text : m), '');
      tagWmax = tagEl.offsetWidth; tagH = tagEl.offsetHeight;
      actEl.textContent = keep; tagW = tagEl.offsetWidth;
    }
    const tagS = { side: 'br', seg: -1, from: 'br', next: 'br', x: 14, y: 21, vx: 0, vy: 0, swap: null };
    // from one side to another without crossing the arrow: neighbours share a line clear of it (below, above, right
    // or left of its box); opposite corners go round by the neighbour that keeps the vertical side
    let detour = null;
    function offGlass(sd, hx, hy) {
      const [ox, oy] = sideOff(sd), x0 = hx + ox, y0 = hy + oy;
      const ix = Math.max(0, Math.min(x0 + tagW, W) - Math.max(x0, 0)), iy = Math.max(0, Math.min(y0 + tagH, H) - Math.max(y0, 0));
      return 1 - (ix * iy) / (tagW * tagH);
    }
    // a side as fractions: fx 0 right of the arrow, 1 left of it; fy 0 below, 1 above. The pixel offset is taken from
    // the tag's current size, so its edge next to the arrow never moves when the label changes length.
    const sideF = (sd) => [sd[1] === 'l' ? 1 : 0, sd[0] === 't' ? 1 : sd[0] === 'm' ? 0.5 : 0];
    const offF = (fx, fy) => [14 + (-4 - tagW - 14) * fx, 21 + (-6 - tagH - 21) * fy];
    // lanes clear of the arrow: up and down along its right or left side (fx 0 or 1), across only below or above it
    // (fy 0 or 1). Any change of side runs along them: down or up to a lane, across, then to the side of arrival.
    function tagPath(a, b, u, hx, hy) {
      const A = sideF(a), B = sideF(b);
      if (a === b) return A;
      if (A[0] === B[0] || (A[1] === B[1] && A[1] !== 0.5)) return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
      if (!detour || detour.a !== a || detour.b !== b) {
        const lane = (fy) => offGlass((fy ? 't' : 'b') + a[1], hx, hy) + offGlass((fy ? 't' : 'b') + b[1], hx, hy) + Math.abs(A[1] - fy) + Math.abs(B[1] - fy);
        const fy = lane(0) <= lane(1) ? 0 : 1;
        const pts = [A, [A[0], fy], [B[0], fy], B].filter((q, i, arr) => !i || q[0] !== arr[i - 1][0] || q[1] !== arr[i - 1][1]);
        const lens = pts.slice(1).map((q, i) => Math.abs(q[0] - pts[i][0]) * 2 + Math.abs(q[1] - pts[i][1]));
        detour = { a, b, pts, lens, total: lens.reduce((s, v) => s + v, 0) };
      }
      let d = u * detour.total;
      for (let i = 0; i < detour.lens.length; i++) {
        const L = detour.lens[i], P = detour.pts[i], Q = detour.pts[i + 1];
        if (d <= L || i === detour.lens.length - 1) { const v = L ? clamp(d / L, 0, 1) : 1; return [P[0] + (Q[0] - P[0]) * v, P[1] + (Q[1] - P[1]) * v]; }
        d -= L;
      }
      return B;
    }
    function drawHand(t, dt, snap) {
      if (!hand || !tagEl) return;
      let ai = 0;
      for (let k = 0; k < acts.length; k++) { if (acts[k].t <= t) ai = k; else break; }
      if (ai !== actIdx) { actIdx = ai; if (actEl) actEl.textContent = acts[ai].text; tagW = tagEl.offsetWidth; tagH = tagEl.offsetHeight; handKey = ''; }
      const p = ptrAt(t), z = cam.z;
      const sx = pxOn((p.x * c0 - cam.x) * z, glassX), sy = pxOn((p.y * rh0 - cam.y) * z, glassY);
      const cm = camTarget(t);
      let gx, gy;
      if (p.i >= 0) {   // moving: from the side it left with to the side chosen for where it lands, in step with the hand
        if (tagS.seg !== p.i) {
          // the side of arrival is chosen once, when the hand sets off: the path never changes under way
          tagS.from = tagS.seg >= 0 ? tagS.next : tagS.side; tagS.seg = p.i;
          const sg = segs[p.i], ca = camTarget(sg.t1), tz = ca.z;
          const ex = (p.to.x * c0 - ca.x) * tz, ey = (p.to.y * rh0 - ca.y) * tz;
          // leaving the frame: the tag trails the hand, so it stays on the glass as long as the arrow does
          if (ex < 0 || ex > W || ey < 0 || ey > H) tagS.next = tagS.from[0] + (sg.to.x > sg.from.x ? 'l' : 'r');
          // a gesture can name its side on desktops (above the option it points at: the form that follows stays clear)
          else tagS.next = sg.side && !camMode ? sg.side : bestSide(p.to, ca, tagS.from);
        }
        tagS.swap = null;
        [gx, gy] = tagPath(tagS.from, tagS.next, Math.min(1, p.u * 1.7), sx, sy);   // settled before the hand arrives
      } else {
        if (tagS.seg >= 0) { tagS.side = tagS.next; tagS.seg = -1; }
        // at rest: change side only for a clear gain (the camera reframed), in 0.3 s, round the arrow
        if (snap || dt <= 0) { tagS.side = bestSide(p, cm, tagS.side, 0.6); tagS.swap = null; }
        else if (!tagS.swap) {
          const b = bestSide(p, cm, tagS.side, 2.5);
          if (b !== tagS.side) tagS.swap = { a: tagS.side, b, t0: t };
        }
        if (tagS.swap) {
          const u = clamp((t - tagS.swap.t0) / 0.3, 0, 1);
          [gx, gy] = tagPath(tagS.swap.a, tagS.swap.b, mj(u), sx, sy);
          if (u >= 1 || t < tagS.swap.t0) { tagS.side = tagS.swap.b; tagS.swap = null; }
        } else [gx, gy] = sideF(tagS.side);
      }
      let [tx, ty] = offF(gx, gy);
      // desktops: the hand never leaves the glass, so the tag is simply kept on it
      tx = clamp(sx + tx, 0, W - tagW) - sx; ty = clamp(sy + ty, 0, H - tagH) - sy;
      const ox = px(tx), oy = px(ty);
      const sq = t >= press && t - press < 0.12 ? 0.86 : 1;
      // the hand shows only while its arrow and its whole tag are on the glass (a short fade in CSS): off the camera's
      // frame it is gone, and a tag is never seen cut by the edge
      // shown while its tip and its whole tag are on the glass (an arrow just clipped at the edge is what a real pointer does)
      const isWhole = (x, y) => x >= 3 && x <= W - 3 && y >= 3 && y <= H - 3 && x + ox >= 0 && x + ox + tagW <= W && y + oy >= 0 && y + oy + tagH <= H;
      // it also looks 0.25 s ahead (more than its fade), so a quick move out of the frame starts the fade in time
      // ...and through the framing the camera is heading to, since a reframe can take the hand out as surely as a move;
      // on phones it shows only if it stays in frame for the next 0.7 s, so it never flickers in for a moment
      // (ahead, only the tip is tested: the tag will have taken the side that keeps it on the glass by then)
      const tipIn = (x, y) => x >= 3 && x <= W - 3 && y >= 3 && y <= H - 3;
      // the camera is a critically damped spring (k = 5): where it will be after d seconds, from where it is now and
      // how fast it is going (x(d) = xt + (c1 + c2 d) e^(-kd), c1 = x0 - xt, c2 = v0 + k c1); the frame as it is now
      // only counts for the next quarter second, since by then the camera has moved on
      const wholeAhead = (d) => { const q = ptrAt(t + d), ct = camTarget(t + d), e = Math.exp(-5 * d);
        const pr = (k) => { const c1 = cam[k] - ct[k]; return ct[k] + (c1 + (cam['v' + k] + 5 * c1) * d) * e; };
        const mx = pr('x'), my = pr('y'), mz = pr('z');
        return (d > 0.25 || tipIn((q.x * c0 - cam.x) * z, (q.y * rh0 - cam.y) * z)) && tipIn((q.x * c0 - mx) * mz, (q.y * rh0 - my) * mz)
          && tipIn((q.x * c0 - ct.x) * ct.z, (q.y * rh0 - ct.y) * ct.z); };
      const raw = camMode ? (tipIn(sx, sy) && [0.2, 0.4, 0.6, 0.8, 1.0].every(wholeAhead) ? 1 : 0) : 1;
      // and it comes back only after 0.4 s in frame without a break (a camera move can still cut a short stay)
      if (!raw || t < handOkSince) handOkSince = raw ? t : Infinity;
      const ho = raw && t - handOkSince >= (camMode ? 0.4 : 0) ? 1 : 0;
      // when Marie's note arrives the morning's work is over: the hand leaves the glass
      const hv = t >= NOTE_T - 0.15 ? 0 : ho;
      const key = sx + ',' + sy + ',' + ox + ',' + oy + ',' + sq + ',' + hv;
      if (key === handKey) return;
      handKey = key;
      hand.style.opacity = String(hv);
      hand.style.transform = `translate(${sx}px, ${sy}px)`;
      tagEl.style.transform = `translate(${ox}px, ${oy}px)`;
      if (arrowEl) arrowEl.style.transform = sq < 1 ? `scale(${sq})` : '';
    }
    // the tag is still settling: keep frames coming while paused
    const tagMoving = () => false;

    /* ---------- Marie's note: pressed on the corner of the monitor, then written line by line ---------- */
    const scrawl = postit ? [...postit.querySelectorAll('g[data-x]')].map((g) => {
      const [a, b] = g.dataset.x.split(' ').map(Number);
      const id = g.getAttribute('mask').replace(/^url\(#|\)$/g, '');
      return { a, b, lg: postit.querySelector('#' + id + 'g') };
    }) : [];
    const WRITE = [[0.55, 1.15], [1.3, 1.95], [2.05, 2.45], [2.6, 2.85]];
    // the pencil is four pictures: decode them before the morning, so the note lands without a paint stall
    if (postit) for (const im of postit.querySelectorAll('image')) { const pre = new Image(); pre.src = im.getAttribute('href'); pre.decode().catch(() => 0); }
    let pk = null;
    function drawPostit(t) {
      if (!postit) return;
      const k = t - NOTE_T;
      const key = k < 0 ? -1 : Math.min(k, 3);
      if (key === pk) return;
      pk = key;
      if (k < 0) { postit.style.opacity = '0'; return; }
      const e = 1 - Math.pow(1 - clamp(k / 0.42, 0, 1), 3);
      const sc = 1 - 0.018 * Math.sin(Math.PI * clamp((k - 0.34) / 0.24, 0, 1));   // pressed flat, then let go
      postit.style.transform = `translate(${((1 - e) * 26).toFixed(2)}px, ${((1 - e) * -46).toFixed(2)}px) rotate(${(-8 - (1 - e) * 9).toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      postit.style.opacity = String(clamp(k / 0.05, 0, 1));   // three frames: the paper is opaque, it does not dissolve in
      scrawl.forEach((s, i) => {
        const v = clamp((k - WRITE[i][0]) / (WRITE[i][1] - WRITE[i][0]), 0, 1);
        const f = s.a - 1 + (s.b - s.a + 14) * v;
        s.lg.setAttribute('x1', (f - 12).toFixed(1)); s.lg.setAttribute('x2', f.toFixed(1));
      });
    }

    /* ---------- surtitles: the line of the script being played, typed above the stage ---------- */
    let surIdx = -1, surShown = -1;
    function drawSur(t) {
      let i = -1;
      for (let k = 0; k < surs.length; k++) { if (surs[k].t <= t) i = k; else break; }
      if (i < 0) i = 0;
      const s = surs[i];
      const nextT = surs[i + 1] ? surs[i + 1].t : s.t + 9;
      const speed = Math.max(44, s.text.length / Math.max(0.3, (nextT - s.t) * 0.6));
      const n = RM.matches || t >= T_END || i === 0 ? s.text.length : clamp(Math.floor((t - s.t) * speed), 0, s.text.length);
      if (i === surIdx && n === surShown) return;
      // the whole line is laid out from the first frame; the part not yet typed is there but unseen
      // a new line gets new nodes: the old ones never move, so nothing counts as a layout shift
      if (i !== surIdx) {
        const w = document.createElement('span'); w.className = 'who'; w.textContent = s.who ? s.who + ' ' : '';
        const l = document.createElement('span');
        const wrap = document.createElement('span'); wrap.append(w, l);
        surWho.parentElement.replaceWith(wrap); surWho = w; surLine = l;
      }
      surIdx = i; surShown = n;
      surLine.textContent = '';
      const typed = document.createElement('span'); typed.textContent = s.text.slice(0, n);
      surLine.append(typed);
      if (n < s.text.length) {
        const caret = document.createElement('span'); caret.className = 'caret';
        const rest = document.createElement('span'); rest.className = 'rest'; rest.textContent = s.text.slice(n);
        surLine.append(caret, rest);
      }
    }
    // reserve the height of the longest surtitle and of the final journal line, so nothing below moves
    function reserve() {
      const probe = (el, texts) => {
        if (!el) return;
        const c = el.cloneNode(false);
        c.removeAttribute('data-surtitle'); c.removeAttribute('data-journal');
        c.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;min-height:0;width:${el.clientWidth}px`;
        el.parentNode.appendChild(c);
        let m = 0;
        for (const t of texts) { c.innerHTML = t; m = Math.max(m, c.offsetHeight); }
        c.remove();
        el.style.minHeight = m + 'px';
      };
      const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      probe($('[data-surtitle]'), surs.map((s) => `<span><span class="who">${esc(s.who ? s.who + ' ' : '')}</span><span>${esc(s.text)}</span></span>`));
      probe(journal, [...notes.filter((n) => n.text).map((n) => esc(n.text)), `<time>06:16</time>${esc(nb(FINAL))}`]);
    }

    /* ---------- playback ---------- */
    let t = 0, opIdx = 0, playing = false, started = false, visible = false, noteIdx = 0, posed = false;
    function reset() {
      t = 0; opIdx = 0; noteIdx = 0; clockSec = 6 * 3600 + 12; cursor = { r: 20, c: 6, on: false };
      clearAll(); pvAt = -1; switchAt = -1; surIdx = -1; pk = null; actIdx = -1; handKey = ''; handOkSince = Infinity; tagS.side = tagS.from = tagS.next = 'br'; tagS.seg = -1; tagS.swap = null;
    }
    function advance(to) {
      while (opIdx < ops.length && ops[opIdx].t <= to) { ops[opIdx].fn(); opIdx++; }
      while (noteIdx < notes.length && notes[noteIdx].t <= to) {
        const n = notes[noteIdx++];
        if (!n.liveOnly) setJournal(n.text, n.final);
        if (n.live && live) live.textContent = n.live;
      }
    }
    function setJournal(text, final) {
      if (!journal) return;
      if (final) { journal.textContent = ''; const tm = document.createElement('time'); tm.textContent = clockStr(clockSec).slice(0, 5); journal.append(tm, text); }
      else journal.textContent = text;
    }
    function label() {
      if (!goKey) return;
      const again = t >= T_END && !posed;
      goKey.textContent = playing ? 'Pause' : again ? 'Go again' : 'Go';
      // the accessible name starts with the word on the key (WCAG 2.5.3), the rest says what it does
      goKey.setAttribute('aria-label', playing ? 'Pause the performance' : again ? 'Go again, play the morning again' : started && t < T_END ? 'Go, resume the performance' : 'Go, play the morning');
    }
    let needsFrame = 0;
    const kick = (n = 2) => { needsFrame = Math.max(needsFrame, n); wake(); };
    function frame(dt) {
      if (playing) {
        t = Math.min(T_END, t + dt);
        advance(t);
        if (t >= T_END) { playing = false; label(); }
      }
      draw(t, playing ? dt : 0, false);
      drawSur(t);
      if (!playing && ((camMode && Math.abs(cam.vz) + Math.abs(cam.vx) + Math.abs(cam.viy0) > 0.01) || tagMoving())) needsFrame = Math.max(needsFrame, 1);
    }
    jobs.push({ active: () => visible && (playing || needsFrame > 0), frame: (dt) => { if (needsFrame > 0) needsFrame--; frame(dt); } });
    function play() {
      posed = false;
      if (t >= T_END) reset();
      started = true; playing = true; label(); kick();
    }
    function hold() { playing = false; label(); kick(); }
    if (goKey) goKey.addEventListener('click', () => (playing ? hold() : play()));
    // the browser centres a focused control; at the foot of a split stage that cuts the screen in half. When the whole
    // stage fits in the window, a keyboard arrival lands on it whole instead.
    const perfEl = $('.perf');
    if (goKey && perfEl) goKey.addEventListener('focus', () => {
      const r = perfEl.getBoundingClientRect(), top = mast ? mast.getBoundingClientRect().bottom : 0;
      if ((r.top < top || r.bottom > innerHeight) && r.height <= innerHeight - top) perfEl.scrollIntoView({ block: 'start', behavior: RM.matches ? 'auto' : 'smooth' });
    });
    // the programme's window covers the stage: the performance waits for it
    let heldByProg = false;
    if (prog && prog.showModal) {
      $('[data-prog-open]').addEventListener('click', () => { if (playing) { hold(); heldByProg = true; } });
      prog.addEventListener('us-closed', () => { if (heldByProg) { heldByProg = false; play(); } });
    }
    function poseEnd() { reset(); t = T_END; advance(t); switchAt = -1; started = true; posed = true; label(); draw(t, 0, true); drawSur(t); }

    async function init() {
      try { await Promise.all([document.fonts.load('20px VT323'), document.fonts.load('17px "Courier Prime"')]); } catch (e) { /* fall back to monospace */ }
      fontReady = true;
      layout(); reserve();
      menuScreen(); cursor = { r: 20, c: 6, on: true };
      if (RM.matches) poseEnd(); else { draw(0, 0, true); drawSur(0); }
      let rz = 0;
      new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { layout(); reserve(); draw(t, 0, true); kick(2); }); }).observe(term);
      // in the split layout the journal's column can narrow while the screen keeps its size: measure the lines again
      let colW = 0;
      if (journal) new ResizeObserver(() => { const w = journal.clientWidth; if (w !== colW) { colW = w; reserve(); } }).observe(journal);
      watch(term, (v) => { visible = v; if (v) kick(2); });
      watch(term, (v) => { if (v && !started && !RM.matches) play(); }, 0.9);
      RM.addEventListener('change', () => { if (RM.matches) { if (!started || !playing) poseEnd(); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }

  /* ---------- 4. The ticket: the stub comes away, the answer is honest ---------- */
  const form = $('[data-form]');
  if (form) $('input', form).addEventListener('input', (e) => {
    const input = e.target, reply = $('[data-reply]', form);
    // the correction has started: the error goes at the first key, it comes back only on a new send
    if (input.hasAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); reply.textContent = ''; }
  });
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('input', form), reply = $('[data-reply]', form);
    if (!input.value.trim() || !input.checkValidity()) { reply.textContent = 'A work email, please.'; input.setAttribute('aria-invalid', 'true'); form.classList.remove('is-torn'); input.focus(); return; }
    input.removeAttribute('aria-invalid');
    reply.textContent = 'Thanks. Nothing was sent.';
    form.classList.add('is-torn');
  });
})();
