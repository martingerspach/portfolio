/* Redline v4. The page is a design file; Redline's agents work in it like expert collaborators.
   Each agent has a track: aimed moves timed by Fitts' law (a fast primary movement that lands a little short,
   then a small correction), dwells before clicks, double-clicks, drags with snapping, keystrokes at human intervals.
   A scene is a pure function of time: render(t) sets every cursor, selection, redline, picker and edit,
   so pause, replay, seek and reduced motion all show exact states. */
(() => {
'use strict';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const PHONE = matchMedia('(max-width: 699px)');
const NS = 'http://www.w3.org/2000/svg';
const H = document.documentElement;
H.classList.add('js');
{ const sp = new URLSearchParams(location.search); for (const k of ["look", "foot", "hov"]) if (sp.get(k)) H.dataset[k] = sp.get(k); }   /* grid bench */

/* ---------- maths ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mj = x => { x = clamp(x); return x * x * x * (10 - 15 * x + 6 * x * x); };          // minimum jerk
const out3 = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const in2 = x => { x = clamp(x); return x * x; };
/* a light spring for things that pop into place (handles, pickers): about 6 % overshoot, settled in 0.25 s */
const pop = dt => dt <= 0 ? 0 : 1 - Math.exp(-dt * 22) * (Math.cos(dt * 26) + .85 * Math.sin(dt * 26));
const fitts = (D, W) => clamp(.17 + .11 * Math.log2(D / Math.max(W, 6) + 1), .22, .82);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
const toS = c => c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055;
function oklab([r, g, b]) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function rgb([L, a, b]) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
    .map(c => Math.round(clamp(toS(clamp(c))) * 255));
}
const mix = (a, b, t) => { const A = oklab(hex(a)), B = oklab(hex(b)); const c = rgb(A.map((v, i) => lerp(v, B[i], t))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(); };
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const q = (root, k) => root.querySelector(`[data-el="${k}"]`);
const textLen = (group, str) => { const t = el('text', { x: 0, y: -1000 }, group); t.textContent = str; const L = t.getComputedTextLength(); t.remove(); return L; };
/* write only what changed: the scenes touch dozens of attributes per frame */
const sa = (n, k, v) => { const c = n._c || (n._c = {}); if (c[k] !== v) { c[k] = v; n.setAttribute(k, v); } };
const ss = (n, k, v) => { const c = n._s || (n._s = {}); if (c[k] !== v) { c[k] = v; n.style[k] = v; } };
const f2 = v => (+v).toFixed(2);
const inBox = (p, b, m = 0) => p && b && p[0] >= b[0] - m && p[0] <= b[0] + b[2] + m && p[1] >= b[1] - m && p[1] <= b[1] + b[3] + m;
const win = (t, a, b) => t >= a && t < b;

/* ---------- the poster sits in the photo: a homography onto the measured face ---------- */
const FACE = [[.093468, .116772], [.91813, .116381], [.918649, .521455], [.093219, .520705]];
/* the print runs .5 px under the frame, as a real backlit print does: its blurred edge then covers the lit edge of the
   face, with no bright rim (measured: no light hairline and no dark line at DPR 1 and 2, from 1024 to 1920) */
const BLEED = .5;
function fit(stage, svgs) {
  const W = stage.clientWidth, Hh = stage.clientHeight;
  if (!W || !Hh) return;
  const P = FACE.map(([x, y], i) => [x * W + (i === 1 || i === 2 ? BLEED : -BLEED), y * Hh + (i > 1 ? BLEED : -BLEED)]);
  /* a composited box with a 3D transform is snapped to whole pixels: keep the box whole and put the fraction in the matrix */
  const bx = Math.floor(Math.min(P[0][0], P[3][0])), by = Math.floor(Math.min(P[0][1], P[1][1]));
  const bw = Math.ceil(Math.max(P[1][0], P[2][0]) - bx), bh = Math.ceil(Math.max(P[2][1], P[3][1]) - by);
  const [x0, y0] = [P[0][0] - bx, P[0][1] - by], [x1, y1] = [P[1][0] - bx, P[1][1] - by], [x2, y2] = [P[2][0] - bx, P[2][1] - by], [x3, y3] = [P[3][0] - bx, P[3][1] - by];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  const m = [a / bw, d / bw, 0, g / bw, b / bh, e / bh, 0, h / bh, 0, 0, 1, 0, x0, y0, 0, 1].map(v => +v.toFixed(7)).join(',');
  svgs.forEach(s => s && Object.assign(s.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px', transform: `matrix3d(${m})` }));
}

/* ---------- a track: how one expert hand moves, clicks, drags and types ---------- */
class Track {
  constructor(p, t = 0) { this.p0 = this.p = p; this.tIn = this.t = t; this.segs = []; this.pr = []; this.holds = []; this.sh = [[-9, 'arrow']]; this.ev = {}; this.tOut = 1e9; }
  /* an aimed move: Fitts time; the primary movement curves a little and lands short and slightly off, a correction finishes it */
  go(qq, w = 30, o = {}) {
    const p = this.p, dx = qq[0] - p[0], dy = qq[1] - p[1], D = Math.hypot(dx, dy);
    if (D < .5) return this;
    const T = o.T ?? fitts(D, w), ux = dx / D, uy = dy / D, nx = -uy, ny = ux;
    const side = o.side ?? (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? -1 : 1) : (dy > 0 ? -1 : 1));
    const under = o.under ?? clamp(3 / D + .03, .025, .08);
    const aim = [qq[0] - dx * under + nx * side * D * .01, qq[1] - dy * under + ny * side * D * .01];
    const bow = side * D * (o.bow ?? .07);
    const c = [(p[0] + aim[0]) / 2 + nx * bow, (p[1] + aim[1]) / 2 + ny * bow];
    this.segs.push({ k: 'go', t0: this.t, t1: this.t + T, p0: p, q: qq, aim, c });
    this.t += T; this.p = qq; return this;
  }
  /* a drag keeps the button down; the hand slows down early to place things precisely */
  drag(qq, T, key) {
    const p = this.p;
    this.holds.push([this.t - .05, this.t + T + .04]);
    if (key) { this.ev[key + '0'] = this.t; this.ev[key + '1'] = this.t + T; }
    this.segs.push({ k: 'drag', t0: this.t, t1: this.t + T, p0: p, q: qq });
    this.t += T + .04; this.p = qq; return this;
  }
  wait(s) { this.t += s; return this; }
  mark(k) { this.ev[k] = this.t; return this; }
  click(k, dwell = .1) { this.t += dwell; this.pr.push(this.t); if (k) this.ev[k] = this.t; this.t += .085; return this; }
  dbl(k) { this.pr.push(this.t, this.t + .15); if (k) this.ev[k] = this.t + .15; this.t += .24; return this; }
  keys(key, gaps) { const T = []; gaps.forEach(g => { this.t += g; T.push(this.t); }); this.ev[key] = T; this.t += .04; return this; }
  shift(d) {
    this.t += d; this.tIn += d; if (this.tOut < 1e8) this.tOut += d;
    this.segs.forEach(g => { g.t0 += d; g.t1 += d; }); this.pr = this.pr.map(x => x + d); this.holds.forEach(h => { h[0] += d; h[1] += d; });
    this.sh.forEach(g => { if (g[0] > -5) g[0] += d; });
    for (const k in this.ev) { const v = this.ev[k]; if (Array.isArray(v)) v.forEach((x, i) => { v[i] = x + d; }); else this.ev[k] = v + d; }
    return this;
  }
  insert(at, d) {
    if (!(d > 0)) return this;
    const f = x => x > at + 1e-6 ? x + d : x;
    this.segs.forEach(g => { if (g.t0 >= at - 1e-6) { g.t0 += d; g.t1 += d; } else if (g.t1 > at) g.t1 += d; });
    this.pr = this.pr.map(f); this.holds.forEach(h => { h[0] = f(h[0]); h[1] = f(h[1]); }); this.sh.forEach(g => { g[0] = f(g[0]); });
    for (const k in this.ev) { const v = this.ev[k]; if (Array.isArray(v)) v.forEach((x, i) => { v[i] = f(x); }); else this.ev[k] = f(v); }
    this.t = f(this.t); if (this.tOut < 1e8) this.tOut = f(this.tOut);
    return this;
  }
  shape(s, at = this.t) { this.sh.push([at, s]); this.sh.sort((a, b) => a[0] - b[0]); return this; }
  leave(qq, w = 60) { this.go(qq, w, { under: 0 }); this.tOut = this.t - .32; return this; }
  pos(t) {
    let p = this.p0;
    for (const s of this.segs) {
      if (t < s.t0) break;
      if (t >= s.t1) { p = s.q; continue; }
      const u = (t - s.t0) / (s.t1 - s.t0);
      if (s.k === 'go') {
        const w1 = mj(Math.pow(clamp(u / .82), .88)), w2 = mj((u - .58) / .42);
        const a = [lerp(lerp(s.p0[0], s.c[0], w1), lerp(s.c[0], s.aim[0], w1), w1), lerp(lerp(s.p0[1], s.c[1], w1), lerp(s.c[1], s.aim[1], w1), w1)];
        return [a[0] + (s.q[0] - s.aim[0]) * w2, a[1] + (s.q[1] - s.aim[1]) * w2];
      }
      const w = mj(Math.pow(u, .78));
      return [lerp(s.p0[0], s.q[0], w), lerp(s.p0[1], s.q[1], w)];
    }
    return p;
  }
  at(t) {
    let press = 0;
    for (const p of this.pr) press = Math.max(press, clamp((t - p + .02) / .02) * (1 - clamp((t - p - .07) / .03)));
    for (const [a, b] of this.holds) if (t >= a && t <= b) press = Math.max(press, clamp((t - a) / .03) * (1 - clamp((t - b + .03) / .03)));
    let shape = 'arrow'; for (const [a, s] of this.sh) if (t >= a) shape = s;
    const vis = clamp((t - this.tIn) / .18) * (1 - clamp((t - this.tOut) / .3));
    return { pos: this.pos(t), press, shape, vis, born: t - this.tIn };
  }
}

/* ---------- cursors: a pointer that changes with the job, a name, and a chat bubble that unfolds from the name ---------- */
const CUR = `<svg class="cur" viewBox="-12 -12 24 24"><g class="c-arrow"><path d="M0 0v16.4l4.2-4.1 3 6.7 2.8-1.2-3-6.6h6.1z"/></g>
<g class="c-ibeam"><path d="M-4.2-9h2.6L0-8l1.6-1h2.6v1.8H1V7.2h3.2V9H1.6L0 8l-1.6 1h-2.6V7.2H-1V-7.2h-3.2z"/></g>
<g class="c-nwse"><path transform="rotate(45)" d="M-9.4 0l4.4-4.4v2.8H5v-2.8L9.4 0 5 4.4V1.6H-5v2.8z"/></g>
<g class="c-ew"><path d="M-9.4 0l4.4-4.4v2.8H5v-2.8L9.4 0 5 4.4V1.6H-5v2.8z"/></g></svg>`;
function makeAgent(layer, name) {
  const a = document.createElement('div');
  a.className = 'agent'; a.dataset.shape = 'arrow';
  a.innerHTML = `${CUR}<div class="lab"><b class="nm">${name}</b><span class="msg"><span class="ca"></span><span class="cb"></span></span></div>`;
  layer.appendChild(a);
  return { el: a, cur: a.querySelector('.cur'), lab: a.querySelector('.lab'), nm: a.querySelector('.nm'), msg: a.querySelector('.msg'), ca: a.querySelector('.ca'), cb: a.querySelector('.cb'), name, step: undefined, left: false, W: 0, Hh: 0, tw: 0, th: 0 };
}
/* side and size are frozen once per step, so a bubble never re-wraps while it is read;
   it opens below the hand, or above it when the frame ends too close */
function sizeChat(A, s, x, y, lw, lh, maxW, S) {
  A.step = s;
  A.ca.textContent = s ? s.say[0] : ''; A.cb.textContent = s ? s.say[1] : '';
  ss(A.lab, 'width', ''); ss(A.lab, 'transform', ''); ss(A.msg, 'width', ''); ss(A.msg, 'transform', ''); ss(A.msg, 'maxWidth', maxW + 'px'); ss(A.msg, 'display', s && !S?.quiet?.(S) ? '' : 'none');
  const lw1 = sp => { const r = document.createRange(); r.selectNodeContents(sp); let a = 1e9, b = -1e9; for (const q of r.getClientRects()) { a = Math.min(a, q.left); b = Math.max(b, q.right); } return b > a ? b - a : 0; };
  const wa = s ? Math.ceil(lw1(A.ca)) : 0, wb = s ? Math.ceil(lw1(A.cb)) : 0;
  if (s && (wa || wb)) ss(A.msg, 'width', (Math.max(wa, wb) + 23) + 'px');
  A.tw = A.nm.offsetWidth; A.th = A.nm.offsetHeight;
  A.W = A.lab.offsetWidth; A.Hh = A.lab.offsetHeight;
  const ha = s ? A.ca.offsetHeight : 0, hb = s ? A.cb.offsetHeight : 0, hm = Math.max(ha, hb);
  A.Wa = Math.max(A.tw, wa + 23); A.Wb = Math.max(A.tw, wb + 23); A.Ha = A.Hh - (hm - ha); A.Hb = A.Hh - (hm - hb);
  ss(A.lab, 'width', A.W + 'px');
  const want = s?.side || 'r';
  A.left = want === 'l' ? x - A.W - 12 > 0 : lw - x - 22 < A.W && x - A.W - 12 > lw - x - 22 - A.W;
  A.up = !!s && y + 24 + A.Hh > lh - 4 && y - A.Hh - 16 > 0;
  A.mid = false;
  if (s && S) placeChat(A, S, x, y, lw, lh, want, s);
  A.el.classList.toggle('is-left', A.left); A.el.classList.toggle('is-up', A.up); A.el.classList.toggle('is-mid', !!A.mid);
}
/* a bubble never hides the file: it tries its four corners and the two sides of the hand, over the whole time it is
   open (the hand moves while it talks), and takes the place that covers the least of the drawing, of the agent's own
   marks (s.avoid) and, in the hero, of the fixed header; ties keep the scripted side, below the hand */
function placeChat(A, S, x, y, lw, lh, want, s) {
  if (!A.lab.offsetWidth) return;
  const L = S.layer.getBoundingClientRect(), area = lw * lh;
  const keep = [...S.svg.querySelectorAll('[data-el], text, use')].map(e => e.getBoundingClientRect())
    .filter(r => r.width > 2 && r.height > 2 && r.width * r.height < area * .2)
    .map(r => [r.left - L.left, r.top - L.top, r.right - L.left, r.bottom - L.top, r.width * r.height, 1]);
  for (const v of s.avoid || []) { if (v.panel && A.ph) continue; const p0 = S.toPx([v[0], v[1]]), p1 = S.toPx([v[0] + v[2], v[1] + v[3]]); keep.push([p0[0], p0[1], p1[0], p1[1], (p1[0] - p0[0]) * (p1[1] - p0[1]), 3]); }
  const head = S.svg.closest('.hero') ? (document.querySelector('[data-top]')?.getBoundingClientRect().bottom ?? 0) - L.top + 6 : -1e9;
  /* on a phone the hand is placed where the camera will be (xAtT), the drawing where it is now: each point carries
     that gap, so what the bubble must keep clear of is read where it will stand when the bubble opens */
  const T0 = A.ph ? s.ev.say1 : (s.ev.say0 ?? s.tr.tIn), q0 = S.xAtT && S.toPx(s.tr.pos(T0));
  const pts = [[x, y, q0 ? x - q0[0] : 0]];
  for (const k of s.ev.hush0 == null ? ['say1', 'shut'] : A.ph ? ['shut'] : ['hush0']) if (s.ev[k] != null) { const T = s.ev[k] - .02, q = S.toPx(s.tr.pos(T)), cx = S.xAtT?.(s, T); if (q) pts.push([cx ?? q[0], q[1], cx != null ? cx - q[0] : 0]); }
  const opts = [], other = want !== 'l';
  const cands = [[want === 'l', false, false], [other, false, false], [want === 'l', true, false], [other, true, false], [want === 'l', false, true], [other, false, true]];
  A.el.style.setProperty('--mt', `${Math.round(-A.Hh / 2 + 2)}px`);
  for (const [left, up, mid] of cands) {
    A.el.classList.toggle('is-left', left); A.el.classList.toggle('is-up', up); A.el.classList.toggle('is-mid', mid);
    const E = A.el.getBoundingClientRect(), b = A.lab.getBoundingClientRect(), dx = b.left - E.left, dy = b.top - E.top;
    let cover = 0, out = 0;
    for (const [px, py, pd] of pts) {
      const x0 = px + dx, y0 = py + dy, x1 = x0 + b.width, y1 = y0 + b.height;
      for (const k of keep) { const ix = Math.min(x1 - pd, k[2]) - Math.max(x0 - pd, k[0]), iy = Math.min(y1, k[3]) - Math.max(y0, k[1]); if (ix > 0 && iy > 0) cover += k[5] * ix * iy / Math.min(k[4], b.width * b.height); }
      out += (Math.max(0, 4 - x0) + Math.max(0, x1 - lw + 4)) * b.height + (Math.max(0, Math.max(4, head) - y0) + Math.max(0, y1 - lh + 4)) * b.width;
    }
    opts.push({ left, up, mid, score: (cover + 20 * out / (b.width * b.height)) / pts.length + opts.length * .02 });
  }
  const best = opts.reduce((m, o) => o.score < m.score ? o : m); A.opts = opts; A.pts = pts.map(q => q.map(Math.round)); A.lwh = [Math.round(lw), Math.round(lh), Math.round(head)];
  A.left = best.left; A.up = best.up; A.mid = best.mid;
}
function drawAgent(A, st, x, y, chat) {
  ss(A.el, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`);
  ss(A.el, 'opacity', st.vis.toFixed(3));
  if (A.el.dataset.shape !== st.shape) A.el.dataset.shape = st.shape;
  ss(A.cur, 'transform', st.press ? `scale(${(1 - st.press * .14).toFixed(3)})` : '');
  /* the name tag pops in as the agent joins, then unfolds into the bubble; the bubble eases to the size of each phrase */
  const o = chat.o, f = out3(chat.fix);
  const Wc = lerp(A.Wa ?? A.W, A.Wb ?? A.W, f), Hc = lerp(A.Ha ?? A.Hh, A.Hb ?? A.Hh, f);
  const ix = A.W - (A.tw + (Wc - A.tw) * o), iy = A.Hh - (A.th + (Hc - A.th) * o), born = .86 + .14 * pop(st.born);
  const r = A.left ? `0 0 ${f2(iy)}px ${f2(ix)}px` : `0 ${f2(ix)}px ${f2(iy)}px 0`;
  const u = A.left ? `${f2(iy)}px 0 0 ${f2(ix)}px` : `${f2(iy)}px ${f2(ix)}px 0 0`;
  ss(A.lab, 'clipPath', ix < .2 && iy < .2 ? 'none' : `inset(${A.up ? u : r} round 4px)`);
  ss(A.lab, 'transform', born < .999 ? `scale(${born.toFixed(3)})` : '');
  ss(A.msg, 'transform', A.left && Wc < A.W - .5 ? `translateX(${f2(A.W - Wc)}px)` : '');
  ss(A.msg, 'opacity', (chat.shut ? o : clamp((o - .45) / .55)).toFixed(3));
  ss(A.lab, 'opacity', (chat.tag ?? 1).toFixed(3));
  ss(A.ca, 'opacity', chat.fix > 0 ? '0' : '1'); ss(A.cb, 'opacity', chat.fix > 0 ? (.35 + .65 * chat.fix).toFixed(3) : '0');
}
/* how far a bubble is open, and which of its two phrases shows; box and text close together */
const chatOf = (s, t) => {
  if (!s?.say || s.ev.say0 == null) return { o: 0, fix: 0, shut: false };
  const shut = s.ev.shut ?? 1e9, closing = t >= shut;
  /* a hand that leaves its spot to work closes its bubble (hush0), and opens it again where it reports (say1) */
  if (s.ev.hush0 != null && t >= s.ev.hush0 && t < shut) {
    if (t < s.ev.say1) return { o: 1 - in2((t - s.ev.hush0) / .22), fix: 0, shut: true, tag: 1 - in2((t - s.ev.hush0 - .06) / .2) };
    return { o: out3(clamp((t - s.ev.say1) / .3)), fix: 1, shut: false, tag: out3(clamp((t - s.ev.say1) / .16)) };
  }
  return { o: closing ? 1 - in2((t - shut) / .22) : out3(clamp((t - s.ev.say0) / .3)), fix: clamp((t - (s.ev.say1 ?? 1e9)) / .16), shut: closing };
};
/* reading: a phrase stays whole at least 1.2 s, and 0.22 s per word */
const RD = str => Math.max(1.2, .22 * str.trim().split(/\s+/).length);
/* each step gets the time its phrases need, then the next agent speaks once the last bubble has closed */
function pace(steps) {
  let prev = null;
  steps.forEach(s => {
    const e = s.ev;
    if (s.say && e.say0 != null && e.say1 != null) {
      s.tr.insert(e.say0, e.say0 + .3 + RD(s.say[0]) - (e.hush0 ?? e.say1));
      if (e.shut != null) s.tr.insert(e.say1, e.say1 + .16 + RD(s.say[1]) - e.shut);
    }
    if (prev && e.say0 != null) { let d = prev.ev.shut + .08 - e.say0; if (prev.ev.pclose != null && e.pclose != null) d = Math.max(d, prev.ev.pclose + .1 - e.sel); s.tr.shift(d); }
    prev = s;
  });
  return steps;
}

/* ---------- a small picker, laid out in fixed pixels so the hands can aim at its items ---------- */
const PK = { w: 228, pad: 14, head: 20, gap: 12, row: 30, sw: 26, swg: 10, cap: 18 };
function pickerLayout(spec) {
  let y = PK.pad + PK.head + PK.gap; const items = {};
  spec.rows.forEach(r => {
    r.y = y;
    if (r.type === 'val') { items[r.id] = [PK.pad - 6, y, PK.w - 2 * PK.pad + 12, PK.row]; y += PK.row + 6; }
    else if (r.type === 'sw') { const y2 = y + (r.cap ? PK.cap + 8 : 0); r.items.forEach((it, i) => { items[it.id] = [PK.pad + i * (PK.sw + PK.swg), y2, PK.sw, PK.sw]; }); y = y2 + PK.sw + 12; }
    else if (r.type === 'seg') { const n = r.items.length, w = (PK.w - 2 * PK.pad) / n; r.items.forEach((it, i) => { items[it.id] = [PK.pad + i * w, y, w, 32]; }); y += 32 + 12; }
    else if (r.type === 'list') { r.items.forEach((it, i) => { items[it.id] = [PK.pad - 6, y + i * 32, PK.w - 2 * PK.pad + 12, 32]; }); y += r.items.length * 32 + 12; }
  });
  return { h: y - 12 + PK.pad, items };
}
class Picker {
  constructor(layer) { this.el = document.createElement('div'); this.el.className = 'picker'; this.el.setAttribute('aria-hidden', 'true'); layer.appendChild(this.el); this.key = ''; this.n = {}; }
  draw(p) {
    if (!p) { if (this.warm) return; ss(this.el, 'opacity', '0'); ss(this.el, 'visibility', 'hidden'); return; }
    const spec = p.spec;
    if (spec.key !== this.key) {
      this.key = spec.key; const L = pickerLayout(spec); this.L = L; let h = `<p class="pk-head" style="top:${PK.pad}px">${spec.head}</p>`;
      if (spec.hv) h += `<p class="pk-hv" data-i="${spec.hv}" style="top:${PK.pad}px"><span class="pk-sw"></span><span class="pk-a"></span></p>`;
      spec.rows.forEach(r => {
        if (r.type === 'val') h += `<div class="pk-val" data-i="${r.id}" style="left:${L.items[r.id][0]}px;top:${r.y}px;width:${L.items[r.id][2]}px;height:${PK.row}px"><span class="pk-sw"></span><span class="pk-a"></span><span class="pk-b"></span></div>`;
        if (r.type === 'sw') { if (r.cap) h += `<p class="pk-cap" style="top:${r.y}px">${r.cap}</p>`; r.items.forEach(it => { const b = L.items[it.id]; h += `<span class="pk-chip" data-i="${it.id}" style="left:${b[0]}px;top:${b[1]}px;background:${it.c}"></span>`; }); }
        if (r.type === 'seg') r.items.forEach(it => { const b = L.items[it.id]; h += `<span class="pk-seg" data-i="${it.id}" style="left:${b[0]}px;top:${b[1]}px;width:${b[2]}px">${it.label}</span>`; });
        if (r.type === 'list') r.items.forEach(it => { const b = L.items[it.id]; h += `<span class="pk-item" data-i="${it.id}" style="left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;${it.font ? 'font-family:' + it.font : ''}">${it.label}</span>`; });
      });
      this.el.innerHTML = h; ss(this.el, 'height', L.h + 'px'); this.n = {};
      this.el.querySelectorAll('[data-i]').forEach(n => { this.n[n.dataset.i] = n; });
    }
    ss(this.el, 'visibility', 'visible');
    ss(this.el, 'opacity', p.a.toFixed(3));
    ss(this.el, 'transform', `translate3d(${p.x.toFixed(1)}px,${(p.y + (1 - p.a) * 6).toFixed(1)}px,0)`);
    for (const id in this.n) { const n = this.n[id]; n.classList.toggle('is-hover', p.hover === id); n.classList.toggle('is-sel', (p.sel || []).includes(id)); }
    if (spec.hv && p.vals?.[spec.hv]) { const n = this.n[spec.hv], v = p.vals[spec.hv]; ss(n.querySelector('.pk-sw'), 'background', v.sw); const a = n.querySelector('.pk-a'); if (a.textContent !== v.a) a.textContent = v.a; }
    (spec.rows || []).forEach(r => { if (r.type === 'val') { const n = this.n[r.id], v = p.vals?.[r.id]; if (v) { ss(n.querySelector('.pk-sw'), 'background', v.sw); const a = n.querySelector('.pk-a'), b = n.querySelector('.pk-b'); if (a.textContent !== v.a) a.textContent = v.a; if (b.textContent !== v.b) b.textContent = v.b; } } });
  }
}

/* ---------- what an agent draws on the file: hover, selection with handles, text selection, caret, marquee, redlines ---------- */
class Overlay {
  constructor(parent) {
    const g = this.g = el('g', {}, parent);
    this.flag = el('rect', { class: 'ui-flag' }, g);
    this.grid = el('g', {}, g);
    this.hov = el('rect', { class: 'ui-hov' }, g);
    this.mq = el('rect', { class: 'ui-mq' }, g);
    this.hl = el('rect', { class: 'ui-hl' }, g);
    this.sel = el('rect', { class: 'ui-sel' }, g);
    this.hs = [0, 1, 2, 3, 4, 5, 6, 7].map(() => el('rect', { class: 'ui-h' }, g));
    this.caret = el('line', { class: 'ui-caret' }, g);
    this.guides = el('g', {}, g);
    this.red = el('g', {}, g);
    this.labs = el('g', {}, g);
    this.name = el('text', { class: 'ui-name' }, g);
  }
  rect(n, b, a) { if (!b || !a) { ss(n, 'opacity', '0'); return; } sa(n, 'x', f2(b[0])); sa(n, 'y', f2(b[1])); sa(n, 'width', f2(Math.max(0, b[2]))); sa(n, 'height', f2(Math.max(0, b[3]))); ss(n, 'opacity', (+a).toFixed(3)); }
  label(n, text, cx, cy, fs, kk, cls, anchor = 'c') {
    let r = n.firstChild, tx = n.lastChild;
    if (!r) { r = el('rect', {}, n); tx = el('text', {}, n); }
    const w = String(text).length * fs * (/word/.test(cls) ? .55 : .62) + 12 / kk, x = anchor === 'l' ? cx : anchor === 'r' ? cx - w : cx - w / 2;
    if (tx.textContent !== String(text)) tx.textContent = text;
    sa(n, 'class', 'ui-lab ' + (cls || ''));
    sa(tx, 'font-size', f2(fs)); sa(r, 'x', f2(x)); sa(r, 'y', f2(cy - fs * .78)); sa(r, 'width', f2(w)); sa(r, 'height', f2(fs * 1.55)); sa(r, 'rx', f2(2 / kk));
    sa(tx, 'x', f2(x + 6 / kk)); sa(tx, 'y', f2(cy + fs * .36));
  }
  draw(s, kk) {
    const fs = 15.2 / kk;   /* labels and names on the file read at 15 px, like the rest of the page (the poster plane is .4 % smaller on screen) */
    this.rect(this.flag, s.flag, s.flag ? 1 : 0); if (s.flag) sa(this.flag, 'stroke-dasharray', `${f2(5 / kk)} ${f2(4 / kk)}`);
    this.rect(this.hov, s.hover, s.hover ? 1 : 0);
    this.rect(this.mq, s.mq, s.mq ? 1 : 0);
    this.rect(this.hl, s.hl, s.hl ? 1 : 0);
    const sel = s.sel, pad = 2 / kk;
    if (sel) {
      const b = sel.box, X = [b[0] - pad, b[0] + b[2] / 2, b[0] + b[2] + pad], Y = [b[1] - pad, b[1] + b[3] / 2, b[1] + b[3] + pad];
      this.rect(this.sel, [X[0], Y[0], X[2] - X[0], Y[2] - Y[0]], sel.a ?? 1);
      const hs = 7 / kk * (.5 + .5 * (sel.hp ?? 1));
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]].forEach(([i, j], n) => {
        const h = this.hs[n];
        if (!sel.handles || ((sel.corners || b[2] * kk < 52 || b[3] * kk < 30) && (i === 1 || j === 1))) { ss(h, 'opacity', '0'); return; }
        this.rect(h, [X[i] - hs / 2, Y[j] - hs / 2, hs, hs], (sel.a ?? 1) * clamp((sel.hp ?? 1) * 3));
      });
    } else { this.rect(this.sel, null, 0); this.hs.forEach(h => ss(h, 'opacity', '0')); }
    if (s.caret) { const [x, y0, y1, a] = s.caret; sa(this.caret, 'x1', f2(x)); sa(this.caret, 'x2', f2(x)); sa(this.caret, 'y1', f2(y0)); sa(this.caret, 'y2', f2(y1)); ss(this.caret, 'opacity', String(a)); } else ss(this.caret, 'opacity', '0');
    /* layout grid of the file, when the agent needs it */
    if (s.cols && !this.grid.firstChild) { const [x0, y0, w, h, n, gut] = s.cols, cw = (w - (n - 1) * gut) / n; for (let i = 0; i < n; i++) el('rect', { class: 'ui-col', x: f2(x0 + i * (cw + gut)), y: y0, width: f2(cw), height: h }, this.grid); }
    ss(this.grid, 'opacity', String(s.gridA || 0));
    /* guides and redlines */
    const G = s.guides || [];
    while (this.guides.childNodes.length < G.length) el('path', { class: 'ui-guide' }, this.guides);
    [...this.guides.childNodes].forEach((n, i) => { const g = G[i]; if (!g) { ss(n, 'opacity', '0'); return; } const tk = 3 / kk; sa(n, 'd', `M${f2(g[0])} ${f2(g[1])}L${f2(g[2])} ${f2(g[3])}M${f2(g[0] - tk)} ${f2(g[1] - tk)}l${f2(tk * 2)} ${f2(tk * 2)}m0 ${f2(-tk * 2)}l${f2(-tk * 2)} ${f2(tk * 2)}M${f2(g[2] - tk)} ${f2(g[3] - tk)}l${f2(tk * 2)} ${f2(tk * 2)}m0 ${f2(-tk * 2)}l${f2(-tk * 2)} ${f2(tk * 2)}`); ss(n, 'opacity', '1'); });
    const R = s.red || [];
    while (this.red.childNodes.length < R.length) el('path', { class: 'ui-red' }, this.red);
    while (this.labs.childNodes.length < R.length + 1) el('g', {}, this.labs);
    [...this.red.childNodes].forEach((n, i) => {
      const r = R[i]; if (!r) { ss(n, 'opacity', '0'); return; }
      const tick = 4 / kk, vert = Math.abs(r.x1 - r.x2) < .02;
      sa(n, 'd', vert ? `M${f2(r.x1)} ${f2(r.y1)}V${f2(r.y2)}M${f2(r.x1 - tick)} ${f2(r.y1)}h${f2(tick * 2)}M${f2(r.x1 - tick)} ${f2(r.y2)}h${f2(tick * 2)}` : `M${f2(r.x1)} ${f2(r.y1)}H${f2(r.x2)}M${f2(r.x1)} ${f2(r.y1 - tick)}v${f2(tick * 2)}M${f2(r.x2)} ${f2(r.y1 - tick)}v${f2(tick * 2)}`);
      n.classList.toggle('ok', !!r.ok); ss(n, 'opacity', String(r.a ?? 1));
    });
    [...this.labs.childNodes].forEach((n, i) => {
      const r = R[i];
      if (r) { this.label(n, r.label, r.lx ?? (r.x1 + r.x2) / 2, r.ly ?? (r.y1 + r.y2) / 2, fs, kk, r.ok ? 'ok' : '', r.anchor); ss(n, 'opacity', String(r.a ?? 1)); }
      else if (i === R.length && s.size) { this.label(n, s.size.text, s.size.x, s.size.y, fs, kk, 'size ' + (s.size.cls || '')); ss(n, 'opacity', String(s.size.a ?? 1)); }
      else ss(n, 'opacity', '0');
    });
    if (s.name) { const [txt, x, y, a] = s.name; if (this.name.textContent !== txt) this.name.textContent = txt; sa(this.name, 'x', f2(x)); sa(this.name, 'y', f2(y)); sa(this.name, 'font-size', f2(fs)); ss(this.name, 'opacity', String(a)); } else ss(this.name, 'opacity', '0');
  }
}

/* shared pieces of an agent's state */
const selS = (t, a, b, box, o = {}) => win(t, a, b) ? { box, hp: pop(t - a), handles: o.handles !== false, corners: o.corners, a: o.a ?? 1 } : null;
const caretBlink = (t, last) => (t - last < .5 || Math.floor((t - last - .5) / .53) % 2 === 1) ? 1 : 0;

/* ---------- a scene: agents with their tracks, rendered from t ---------- */
class Scene {
  constructor(o) {
    Object.assign(this, o);
    this.ui.innerHTML = '';
    this.agents = {};
    this.layer.querySelectorAll('.agent, .picker').forEach(n => n.remove());
    this.picker = new Picker(this.layer);
    this.layout();
  }
  frame() {
    const r = this.svg.getBoundingClientRect(), L = this.layer.getBoundingClientRect();
    this.k = r.width / this.vbw; this.ky = r.height / this.vbh;
    this.ox = r.left - L.left; this.oy = r.top - L.top; this.lw = L.width; this.lh = L.height;
  }
  /* tracks are rebuilt on resize: positions in the picker depend on pixels, times never do */
  layout() {
    this.frame();
    this.steps = this.build(this);
    if (this.paced !== false) pace(this.steps.filter(z => z.agent));
    this.ui.innerHTML = '';
    this.steps.forEach(s => { s.ov = new Overlay(this.ui); if (s.agent && !this.agents[s.agent]) this.agents[s.agent] = makeAgent(this.layer, s.agent); });
    for (const n in this.agents) this.agents[n].step = undefined;
    const ends = this.steps.map(s => Math.max(s.tr.t, s.end ?? 0));
    this.total = Math.max(...ends, this.tail ?? 0) + (this.pad ?? .6);
  }
  toPx(p) { return [this.ox + p[0] * this.k, this.oy + p[1] * this.ky]; }
  render(t, pinned = false) {
    this.preRender?.(t, pinned);
    this.frame();
    const kk = this.k, T = pinned ? 1e6 : t;
    this.steps.forEach(s => s.edit?.(T));
    let pk = null;
    this.steps.forEach(s => {
      const st = pinned ? (s.pinned?.() || {}) : s.ui(t, s.tr.at(t).pos);
      s.ov.draw(st, kk);
      if (st.pick) pk = st.pick;
    });
    this.picker.draw(pk);
    for (const name in this.agents) {
      const A = this.agents[name], s = this.steps.find(z => z.agent === name);
      const st = pinned ? { pos: s.pin || s.tr.p, press: 0, shape: 'arrow', vis: s.pin && this.pinAgents !== false ? 1 : 0, born: 1 } : s.tr.at(t);
      const [x, y] = this.toPx(st.pos);
      /* a step that falls silent (hush0) and reports later chooses its place again for the second phrase */
      const ph = !pinned && s.ev.hush0 != null && t >= s.ev.hush0 + .24 ? 1 : 0;
      if (A.step !== (pinned ? null : s) || A.lwSeen !== Math.round(this.lw) || A.ph !== ph) { const T0 = ph ? s.ev.say1 : (s.ev.say0 ?? s.tr.tIn), at = pinned ? [x, y] : this.toPx(s.tr.pos(T0)), xs = pinned ? x : (this.xAtT?.(s, T0) ?? at[0]); A.ph = ph; sizeChat(A, pinned ? null : s, xs, at[1], this.lw, this.lh, s.chatW ? Math.min(s.chatW, Math.round(this.lw * .6)) : (this.chatW?.(this) ?? 250), this); A.lwSeen = Math.round(this.lw); }
      drawAgent(A, st, x, y, pinned ? { o: 0, fix: 0 } : chatOf(s, t));
    }
    this.onRender?.(t, pinned);
  }
}

/* ---------- the billboard: three agents correct Duskrail's poster, then the file is approved ---------- */
function heroSteps(board, S) {
  const bad = q(board, 'w-bad'), good = q(board, 'w-good'), rest = q(board, 'w-rest'), l2 = q(board, 'w-2'), logo = q(board, 'logo');
  const sunBad = q(board, 'sun-bad'), sunGood = q(board, 'sun-good');
  const g = bad.parentNode, x0 = 44, base = 132;
  const wBad = textLen(g, 'Unleash'), sp = textLen(g, 'Unleash the') - wBad - textLen(g, 'the'), wRest = textLen(g, 'the weekend');
  const W = [0, ...'Start'.split('').map((_, i) => textLen(g, 'Start'.slice(0, i + 1)))];
  good.removeAttribute('opacity');
  const bb = bad.getBBox(), b2 = l2.getBBox();
  const layer = n => { const w1 = (n < 0 ? wBad : W[n]) + sp + wRest; return [x0, bb.y, Math.max(w1, b2.x + b2.width - x0), b2.y + b2.height - bb.y]; };
  const narrow = S.lw < 700;
  const steps = [];
  if (!board._lines) board._lines = [0, 1, 2, 3, 4, 5].map(n => {
    const ln = el('g', { 'aria-hidden': 'true' }, g); ln.style.opacity = 0;
    const word = el('text', { x: x0, y: base }, ln); word.textContent = n ? 'Start'.slice(0, n) : 'Unleash';
    const r2 = el('text', { x: (x0 + (n ? W[n] : wBad) + sp).toFixed(2), y: base }, ln); r2.textContent = 'the weekend';
    return ln; });
  const lines = board._lines;

  /* Tone: selects the headline, double-clicks the banned word, moves the hand away and retypes it */
  {
    const tr = new Track([-70, 380], 0);
    tr.go([bb.x + bb.width * .62, bb.y + bb.height * .64], bb.height).click('sel', .1).wait(.12).dbl('edit').shape('ibeam', tr.ev.edit).wait(.1);
    tr.shape('arrow', tr.t + .12).go([196, 232], 40, { T: .3 }).mark('say0').wait(.6)
      .keys('k', [0, .12, .085, .15, .095]).wait(.3).mark('say1').wait(.85).mark('esc').wait(.2).mark('desel').mark('shut').wait(.05).leave([-60, 400]);
    const e = tr.ev, K = e.k;
    const typed = t => K.filter(x => t >= x).length;
    steps.push({ agent: 'Tone', tr, ev: e, say: ['Your tone guide bans ‘Unleash’.', 'Changed it to ‘Start’.'], pin: [layer(5)[0] + layer(5)[2] + 18, 150],
      /* each typing state is its own line, drawn once and never moved */
      edit(t) { const n = typed(t); if (this._n === n) return; this._n = n;
        bad.style.opacity = 0; good.style.opacity = 0; rest.style.opacity = 0;
        lines.forEach((ln, i) => { ln.style.opacity = i === n ? 1 : 0; }); },
      ui(t, p) {
        const n = typed(t), box = layer(n ? n : -1), last = n ? K[n - 1] : e.edit;
        const sel = selS(t, e.sel, e.desel, box, { handles: !win(t, e.edit, e.esc) }); if (sel) sel.hp = t >= e.esc ? pop(t - e.esc) : pop(t - e.sel);
        return {
          hover: t < e.sel && inBox(p, box, 2) ? box : null, sel,
          hl: win(t, e.edit, K[0]) ? [bb.x - 1, bb.y + 3, wBad + 2, bb.height - 4] : null,
          caret: win(t, K[0], e.esc) ? [x0 + W[n] + 2.5, base - 52, base + 12, caretBlink(t, last)] : null,
        };
      } });
  }
  /* Colour: clicks the setting sun, opens the fill beside it, hovers the document colours and picks Lamp */
  const sun = [923, 138, 124, 62];
  {
    const tr = new Track([1262, 410], 0);
    tr.go([1003, 172], 50).click('sel', .09);
    const L = pickerLayout(HERO_FILL()), pw = PK.w / S.k, ph = L.h / S.ky;
    let ax = sun[0] - 10 / S.k - pw, ay = sun[1] - 24 / S.ky;
    /* on a phone the camera frames the sun: the picker lies over the foot of the board, inside the frame */
    if (narrow || S.k < .62) { ax = 985 - pw / 2; const top = Math.min(S.oy + 330.4 * S.ky - 34, S.lh - 6 - L.h); ay = (top - S.oy) / S.ky; }
    const it = L.items.lamp, lamp = [ax + (it[0] + it[2] / 2) / S.k, ay + (it[1] + it[3] / 2) / S.ky];
    tr.wait(.14).go(lamp, 26, { T: .42 }).mark('say0').wait(.95).click('pick', 0).wait(.22).mark('say1').wait(.62).mark('pclose').wait(.16).mark('shut').wait(.14).mark('desel').wait(.05).leave([1250, 430]);
    const e = tr.ev;
    steps.push({ agent: 'Colour', tr, ev: e, side: narrow && S.lw >= 360 ? 'r' : 'l', say: ['Your guide keeps Lamp flat.', 'Set it to Lamp, F09A3A.'], pin: [1062, 150], avoid: [[ax, ay, pw, ph]],
      edit(t) { const a = clamp((t - e.pick) / .1); if (this._a === a) return; this._a = a; sunBad.style.opacity = a >= 1 ? 0 : 1; sunGood.style.opacity = a; },
      ui(t, p) {
        const open = clamp((t - e.sel - .06) / .16) * (1 - clamp((t - e.pclose) / .14));
        let pick = null;
        if (open > 0) {
          const [px, py] = S.toPx([ax, ay]), rel = [(p[0] - ax) * S.k, (p[1] - ay) * S.ky];
          const hov = Object.keys(L.items).find(id => inBox(rel, L.items[id])) || null, done = t >= e.pick;
          pick = { spec: HERO_FILL(), a: out3(open), x: px, y: py, hover: hov, sel: done ? ['lamp'] : [],
            vals: { fill: done ? { sw: '#F09A3A', a: 'F09A3A' } : { sw: 'linear-gradient(#FFE45C,#FFA126,#FF4F1A)', a: 'Linear' } } };
        }
        return {
          hover: t < e.sel && inBox(p, sun) ? sun : null,
          sel: selS(t, e.sel, e.desel, sun),
          size: win(t, e.sel, e.desel) && S.k > .55 ? { text: '41 × 21 cm', x: sun[0] + sun[2] / 2, y: sun[1] - 16 / S.k } : null,
          pick,
        };
      } });
  }
  /* Layout: lassoes the logo, reads the clear space, drags it until it snaps to the margins */
  const cm = u => Math.round(u * 400 / 1197);
  {
    const L0 = [1032, 9, 152, 33], dest = [1001, 44];
    const tr = new Track([1240, -60], 0);
    /* the hand steps aside to talk, so the bubble never sits on the measures: into the sky left of the logo, or on a
       phone onto the lit wall under the box, left of the timetable so the bubble beside the hand leaves 'Sat 10:25'
       readable; it closes while the hand works and opens again to report */
    const aside = narrow ? [975, 340] : [985, 98];
    tr.go([1192, 3], 20).drag([1016, 60], .34, 'mq').mark('sel').wait(.05);
    if (aside) tr.go(aside, 40, { T: .36 }); tr.mark('say0').wait(.05); if (aside) tr.wait(.1).mark('hush0'); tr
      .go([1104, 26], 34, { T: .34 }).wait(.5);
    const grab = tr.p, slip = [1.4, 1.1];
    tr.drag([grab[0] + dest[0] - L0[0] + slip[0], grab[1] + dest[1] - L0[1] + slip[1]], .8, 'mv').wait(.1);
    if (aside) tr.go([aside[0] - 8, aside[1] + 2], 40, { T: .36 });
    tr.mark('say1').wait(1.05).mark('desel').mark('shut').wait(.05).leave([1250, -50]);
    const e = tr.ev;
    const at = t => {    /* where the logo is: it follows the hand, and snaps within 4 units of the margin */
      if (t < e.mv0) return { x: L0[0], y: L0[1], sx: false, sy: false };
      const p = tr.pos(Math.min(t, e.mv1)), x = L0[0] + p[0] - grab[0], y = L0[1] + p[1] - grab[1];
      const sx = Math.abs(x - dest[0]) < 4, sy = Math.abs(y - dest[1]) < 4;
      return { x: sx ? dest[0] : x, y: sy ? dest[1] : y, sx, sy };
    };
    steps.push({ agent: 'Layout', tr, ev: e, side: 'l', say: ['One sun of clear space is 7 cm. Here it is 3 cm.', 'Now 15 cm from both edges.'], pin: [980, 96], avoid: [sun, [1030, -4, 70 / S.k + 10, 26 / S.k], [1197 - 62 / S.k, 25 + 8 / S.k, 62 / S.k, 22 / S.k], [1000, 10 + 4 / S.k, 70 / S.k + 10, 26 / S.k], [1197 - 62 / S.k, 60 + 8 / S.k, 62 / S.k, 22 / S.k]],
      edit(t) { const a = at(t), k = `${a.x.toFixed(2)},${a.y.toFixed(2)}`; if (this._k === k) return; this._k = k; logo.setAttribute('transform', `translate(${(a.x - L0[0]).toFixed(2)} ${(a.y - L0[1]).toFixed(2)})`); },
      ui(t, p) {
        const a = at(t), box = [a.x, a.y, L0[2], L0[3]];
        const mq = win(t, e.mq0, e.mq1) ? (() => { const c = tr.pos(t); return [Math.min(1192, c[0]), Math.min(3, c[1]), Math.abs(c[0] - 1192), Math.abs(c[1] - 3)]; })() : null;
        const touching = mq && mq[0] < L0[0] + L0[2] && mq[1] + mq[3] > L0[1];
        const top = Math.round(a.y), right = Math.round(1197 - a.x - L0[2]);
        const show = win(t, e.sel, e.desel) ? 1 : 0, cx = a.x + L0[2] / 2, cy = a.y + L0[3] / 2;
        const red = show ? [
          { x1: cx, y1: 0, x2: cx, y2: a.y, label: `${cm(top)} cm`, ok: top >= 20, lx: cx - 10 / S.k, ly: Math.min(a.y / 2, a.y - (15 * .77 + 3) / S.k), anchor: 'r' },
          { x1: a.x + L0[2], y1: cy, x2: 1197, y2: cy, label: `${cm(right)} cm`, ok: right >= 20, lx: 1197 - 6 / S.k, ly: cy + 18 / S.k, anchor: 'r' },
        ] : [];
        const guides = show && t >= e.mv0 && a.sx ? [[1153, a.y + L0[3] + 4, 1153, 284]] : [];
        const gridA = show ? clamp((t - e.sel) / .3) * (1 - clamp((t - e.desel + .35) / .35)) : 0;
        return { hover: (t < e.sel && inBox(p, box)) || touching ? box : null, mq, sel: selS(t, e.sel, e.desel, box), red, guides, cols: [44, 0, 1109, 330.4, 12, 16], gridA };
      } });
  }
  pace(steps);
  /* the camera on a phone moves only once the last bubble has closed */
  steps[0].focus = [0, 260]; steps[1].focus = [steps[0].ev.shut, 985]; steps[2].focus = [steps[1].ev.shut, 1060];
  /* the file is approved: the whole frame is selected and marked ready to print; on a phone the camera comes back to the title */
  {
    const t0 = steps[2].ev.desel + .12, frame = [0, 0, 1197, 330.4];
    S.fin = t0;
    steps.push({ agent: null, tr: { t: t0 + 2.1, at: () => ({}), pos: () => null }, ev: { fin: t0 }, end: t0 + 2.1, focus: [t0, 300],
      ui(t) {
        const a = clamp((t - t0) / .12) * (1 - clamp((t - t0 - 1.75) / .35));
        if (a <= 0) return {};
        return { sel: { box: frame, hp: pop(t - t0), handles: true, a }, name: narrow ? null : ['Duskrail billboard, 400 × 110 cm', 0, -9 / S.ky, a], size: { text: 'Ready to print', x: narrow ? 330 : 598.5, y: 330.4 + 18 / S.ky, a, cls: 'word' } };
      } });
  }
  return steps;
}
const HERO_FILL = () => ({ key: 'fill', head: 'Fill', hv: 'fill', rows: [{ type: 'sw', items: [{ id: 'night', c: '#1C2045' }, { id: 'lamp', c: '#F09A3A' }, { id: 'dusk', c: '#8F90B6' }, { id: 'linen', c: '#F4EFE5' }] }] });

/* ---------- the demo files ---------- */
const DOC = [{ id: 'night', c: '#1C2045' }, { id: 'lamp', c: '#F09A3A' }, { id: 'dusk', c: '#8F90B6' }, { id: 'linen', c: '#F4EFE5' }];
/* a picker placed beside a box, inside the work area; returns its origin in file units and item centres */
/* the open panel, as a box the bubbles keep clear of */
const pkBox = (S, P) => Object.assign([P.ax, P.ay, PK.w / S.k, P.L.h / S.ky], { panel: true });
function placePicker(S, box, spec, prefer = 'r') {
  const L = pickerLayout(spec), pw = PK.w / S.k, ph = L.h / S.ky, m = 14 / S.k;
  const room = { r: S.lw - (S.ox + (box[0] + box[2]) * S.k), l: S.ox + box[0] * S.k };
  let side = prefer; if (room[side] < PK.w + 24) side = side === 'r' ? 'l' : 'r';
  let ax = side === 'r' ? box[0] + box[2] + m : box[0] - m - pw;
  let ay = clamp(box[1], (-S.oy + 8) / S.ky, (S.lh - S.oy - 8) / S.ky - ph);
  if (room.r < PK.w + 24 && room.l < PK.w + 24) { ax = clamp(box[0] + box[2] / 2 - pw / 2, -S.ox / S.k + 4 / S.k, (S.lw - S.ox) / S.k - pw - 4 / S.k); ay = box[1] + box[3] + m; if ((S.oy + (ay + ph) * S.ky) > S.lh) ay = box[1] - m - ph; ay = clamp(ay, (-S.oy + 8) / S.ky, (S.lh - S.oy - 8) / S.ky - ph); }
  const c = id => { const b = L.items[id]; return [ax + (b[0] + b[2] / 2) / S.k, ay + (b[1] + b[3] / 2) / S.ky]; };
  return { ax, ay, L, c };
}
function pickState(S, P, spec, t, p, open, close, extra) {
  const a = clamp((t - open) / .16) * (1 - clamp((t - close) / .14));
  if (a <= 0) return null;
  const [x, y] = S.toPx([P.ax, P.ay]), rel = [(p[0] - P.ax) * S.k, (p[1] - P.ay) * S.ky];
  return { spec, a: out3(a), x, y, hover: Object.keys(P.L.items).find(id => inBox(rel, P.L.items[id])) || null, ...extra };
}
const DEMO = {
  poster(svg, S) {
    const c1 = q(svg, 'caps-1'), c2 = q(svg, 'caps-2'), logo = q(svg, 'logo');
    logo.style.transformBox = 'view-box'; logo.style.transformOrigin = '376px 556px';
    const cb1 = c1.getBBox(), cb2 = c2.getBBox(), head = [cb1.x - 2, cb1.y, Math.max(cb1.width, cb2.width) + 4, cb2.y + cb2.height - cb1.y];
    const steps = [];
    {
      const CASE = { key: 'case', head: 'Type', rows: [{ type: 'seg', items: [{ id: 'up', label: 'AG' }, { id: 'sent', label: 'Ag' }, { id: 'low', label: 'ag' }] }] };
      const P = placePicker(S, head, CASE);
      const tr = new Track([470, 640], .35);
      /* it names the fault at the panel, picks, closes the panel, then reports beside the reset headline */
      const aside = [head[0] + head[2] + 14, head[1] + head[3] * .55];
      tr.go([head[0] + 150, head[1] + head[3] * .58], 44).click('sel', .09).wait(.12).go(P.c('sent'), 28, { T: .4 }).mark('say0').wait(.85).click('pick', 0).wait(.22).mark('hush0').wait(.3).mark('pclose').wait(.08).go(aside, 30, { T: .34 }).mark('say1').wait(.65).mark('desel').mark('shut').leave([470, 300]);
      const e = tr.ev;
      steps.push({ agent: 'Type', tr, ev: e, say: ['The headline is in capitals.', 'Set in sentence case, as your guide asks.'], pin: [head[0] + head[2] + 12, head[1] + 10], avoid: [pkBox(S, P), [250, 495, 150, 95]],
        inspect: t => [{ k: 'Text', v: 'Headline' }, { k: 'Case', v: t >= e.pick ? 'Sentence' : 'Upper', cls: t >= e.pick ? 'good' : 'bad' }],
        edit(t) { const on = t >= e.pick; if (this._o === on) return; this._o = on; c1.textContent = on ? 'Wake up' : 'WAKE UP'; c2.textContent = on ? 'in Berlin.' : 'IN BERLIN.'; [c1, c2].forEach(n => n.setAttribute('letter-spacing', on ? 0 : 1)); },
        ui(t, p) { return { hover: t < e.sel && inBox(p, head) ? head : null, sel: selS(t, e.sel, e.desel, head), pick: pickState(S, P, CASE, t, p, e.sel + .06, e.pclose, { sel: [t >= e.pick ? 'sent' : 'up'] }) }; } });
    }
    {
      const L0 = [330, 546, 46, 10], s1 = 2.4, w1 = 46 * s1, h1 = 10 * s1;
      const tr = new Track([480, 420], 2.95);
      /* it selects the logo, steps aside above the line to comment (the bubble lands right of the headline, clear of
         the measures), comes back to the corner to stretch it, then steps aside again to report */
      const aside = [206, 497];
      tr.go([353, 551], 12).click('sel', .1).wait(.08).go(aside, 30, { T: .34 }).mark('say0').wait(.12).mark('hush0').go([L0[0] - 1.5, L0[1] - 1.5], 7, { T: .46 }).shape('nwse').wait(.35);
      const grab = tr.p;
      tr.drag([grab[0] - 46 * (s1 - 1) - 1.2, grab[1] - 10 * (s1 - 1) - .8], .82, 'rs').wait(.08).shape('arrow').go([aside[0] + 4, aside[1] - 1], 30, { T: .36 }).mark('say1').wait(.9).mark('desel').mark('shut').leave([480, 640]);
      const e = tr.ev;
      const sc = t => { if (t < e.rs0) return 1; const p = tr.pos(Math.min(t, e.rs1)), v = clamp(1 + (grab[0] - p[0]) / 46, 1, s1); return s1 - v < .03 ? s1 : v; };
      steps.push({ agent: 'Layout', tr, ev: e, side: 'l', say: ['The logo is 138 mm. Posters need 300 mm.', 'Now it is 331 mm wide.'], pin: [250, 516], avoid: [[262, 532 - 46 / S.k, 118, 14 + 34 / S.k], [321 - 44 / S.k, 556 + 6 / S.k, 32 + 88 / S.k, 24 / S.k]],
        inspect: t => { const mm = Math.round(138 * sc(t)); return [{ k: 'Logo', v: 'Duskrail' }, { k: 'Width', v: `${mm} mm`, cls: mm >= 300 ? 'good' : 'bad' }, { k: 'Minimum', v: '300 mm' }]; },
        edit(t) { const s = sc(t).toFixed(4); if (this._s === s) return; this._s = s; logo.style.transform = `scale(${s})`; },
        ui(t, p) {
          const s = sc(t), w = 46 * s, h = 10 * s, box = [376 - w, 556 - h, w, h], mm = Math.round(138 * s), y = box[1] - 16 / S.k;
          const on = win(t, e.sel, e.desel);
          return { hover: t < e.sel && inBox(p, box, 3) ? box : null, sel: selS(t, e.sel, e.desel, box),
            red: on ? [{ x1: box[0], y1: y, x2: 376, y2: y, label: `${mm} mm`, ok: mm >= 300, lx: box[0] + w / 2, ly: y - 16 / S.k }] : [],
            size: on && t >= e.rs0 - .05 ? { text: `${mm} × ${Math.round(30 * s)}`, x: box[0] + w / 2, y: 556 + 18 / S.k } : null };
        } });
    }
    {
      const ph = [24, 24, 352, 318];
      const tr = new Track([-50, 420], 6.05);
      tr.go([300, 250], 120).click('sel', .1).mark('say0').wait(1.5).mark('flag').mark('say1').wait(1.2).mark('desel').mark('shut').leave([-50, 470]);
      const e = tr.ev;
      steps.push({ agent: 'Image', tr, ev: e, side: 'l', say: ['This photo is 44 px wide, far too small to print.', 'Flagged. Ask the photographer for the original.'], pin: [-14, 200],
        inspect: () => [{ k: 'Image', v: '44 × 40 px' }, { k: 'Printed', v: '106 cm' }, { k: 'Resolution', v: '1 ppi', cls: 'bad' }],
        ui(t, p) { return { hover: t < e.sel && inBox(p, ph) ? ph : null, sel: selS(t, e.sel, e.desel, ph), flag: t >= e.flag ? [ph[0] - 5, ph[1] - 5, ph[2] + 10, ph[3] + 10] : null, size: win(t, e.sel, e.desel) ? { text: '44 × 40', x: 200, y: ph[1] + ph[3] + 18 / S.k } : null }; },
        pinned: () => ({ flag: [ph[0] - 5, ph[1] - 5, ph[2] + 10, ph[3] + 10] }) });
    }
    return steps;
  },
  post(svg, S) {
    const book = q(svg, 'book'), bang = q(svg, 'bang'), info = q(svg, 'info'), logo = q(svg, 'logo');
    const bx = 40 + textLen(book.parentNode, 'Book tonight'), wb = textLen(book.parentNode, '!!'), wd = textLen(book.parentNode, '.');
    bang.setAttribute('x', bx.toFixed(1));
    logo.style.transformBox = 'view-box'; logo.style.transformOrigin = '500px 506px';
    const ib = info.getBBox(), bb = bang.getBBox(), steps = [];
    {
      const s0 = 1.18;
      const tr = new Track([620, 640], .35);
      tr.go([440, 506], 32).click('sel', .1).mark('say0').wait(.12).go([500 - 148 * s0 - 2, 506], 8, { T: .44 }).shape('ew').wait(.4);
      const grab = tr.p;
      tr.drag([grab[0] + 148 * (s0 - 1) + .9, grab[1] + .6], .62, 'rs').wait(.06).shape('arrow').mark('say1').wait(.85).mark('desel').mark('shut').leave([620, 420]);
      const e = tr.ev;
      const sx = t => { if (t < e.rs0) return s0; const p = tr.pos(Math.min(t, e.rs1)), v = s0 - (p[0] - grab[0]) / 148; return Math.abs(v - 1) < .012 ? 1 : clamp(v, 1, s0); };
      steps.push({ agent: 'Layout', tr, ev: e, side: 'l', say: ['The logo is stretched to 118%.', 'Back to its true proportions.'], pin: [330, 470],
        inspect: t => [{ k: 'Logo', v: 'Duskrail' }, { k: 'Scale X', v: `${Math.round(sx(t) * 100)}%`, cls: sx(t) <= 1.001 ? 'good' : 'bad' }],
        edit(t) { const s = sx(t).toFixed(4); if (this._s === s) return; this._s = s; logo.style.transform = `scaleX(${s})`; },
        ui(t, p) { const w = 148 * sx(t), box = [500 - w, 490, w, 32];
          return { hover: t < e.sel && inBox(p, box) ? box : null, sel: selS(t, e.sel, e.desel, box), size: win(t, e.sel, e.desel) ? { text: `${Math.round(w)} × 32`, x: 500 - w / 2, y: 490 - 16 / S.k } : null }; } });
    }
    {
      const FILL = { key: 'pfill', head: 'Fill', rows: [{ type: 'val', id: 'fill' }, { type: 'sw', cap: 'Document colours', items: DOC }] };
      const box = [ib.x - 1, ib.y, ib.width + 2, ib.height], P = placePicker(S, box, FILL, 'r');
      const tr = new Track([-60, 300], 2.75);
      tr.go([box[0] + box[2] * .5, box[1] + box[3] * .6], 20).click('sel', .1).wait(.14).go(P.c('night'), 26, { T: .42 }).mark('say0').wait(.9).click('pick', 0).wait(.2).mark('say1').wait(.6).mark('pclose').wait(.25).mark('desel').mark('shut').leave([-60, 260]);
      const e = tr.ev;
      const a = t => clamp((t - e.pick) / .1);
      steps.push({ agent: 'Colour', tr, ev: e, say: ['This line reads at 1.4:1. Your floor is 4.5:1.', 'Set in Night. It reads at 13.7:1.'], pin: [box[0] + box[2] + 10, box[1] - 4], avoid: [pkBox(S, P)],
        inspect: t => [{ k: 'Fill', v: t >= e.pick ? '1C2045' : 'EBC593' }, { k: 'Contrast', v: t >= e.pick ? '13.7:1' : '1.4:1', cls: t >= e.pick ? 'good' : 'bad' }],
        edit(t) { const v = a(t); if (this._v === v) return; this._v = v; info.setAttribute('fill', mix('#EBC593', '#1C2045', v)); },
        ui(t, p) { const done = t >= e.pick;
          return { hover: t < e.sel && inBox(p, box, 3) ? box : null, sel: selS(t, e.sel, e.desel, box),
            pick: pickState(S, P, FILL, t, p, e.sel + .06, e.pclose, { sel: done ? ['night'] : [], vals: { fill: done ? { sw: '#1C2045', a: 'Solid', b: '1C2045' } : { sw: '#EBC593', a: 'Solid', b: 'EBC593' } } }) }; } });
    }
    {
      const tr = new Track([620, 260], 5.25);
      const word = [bx - 1, bb.y + 2, wb + 2, bb.height - 4];
      tr.go([bx + wb * .55, bb.y + bb.height * .45], 14).dbl('edit').shape('ibeam').mark('say0').wait(.8).keys('k', [0]).wait(.25).mark('say1').wait(.8).mark('esc').mark('desel').mark('shut').shape('arrow').leave([620, 210]);
      const e = tr.ev;
      steps.push({ agent: 'Tone', tr, ev: e, say: ['Your guide bans ‘!’.', 'It ends on a full stop now.'], pin: [bx + 22, bb.y - 6], chatW: 330, avoid: [[ib.x, ib.y, ib.width, ib.height]],
        inspect: t => [{ k: 'Text', v: 'Call to action' }, { k: 'Ends with', v: t >= e.k[0] ? 'Full stop' : '!!', cls: t >= e.k[0] ? 'good' : 'bad' }],
        edit(t) { const on = t >= e.k[0]; if (this._o === on) return; this._o = on; bang.textContent = on ? '.' : '!!'; },
        ui(t, p) { const done = t >= e.k[0];
          return { hover: t < e.edit && inBox(p, word, 3) ? word : null, sel: selS(t, e.edit, e.esc, [40, bb.y, bx - 40 + (done ? wd : wb), bb.height], { handles: false }),
            hl: win(t, e.edit, e.k[0]) ? word : null, caret: win(t, e.k[0], e.esc) ? [bx + wd + 1.5, bb.y + 3, bb.y + bb.height - 1, caretBlink(t, e.k[0])] : null }; } });
    }
    return steps;
  },
  slide(svg, S) {
    const tb = q(svg, 't-bad'), tg = q(svg, 't-good'), cap = q(svg, 'caption'), grid = q(svg, 'grid');
    const A = [q(svg, 'bars-a'), q(svg, 'sw-a')], B = [q(svg, 'bars-b'), q(svg, 'sw-b')];
    cap.style.transform = 'none';
    const cb = cap.getBBox(), shift = 752 + 36 - (cb.x + cb.width), t = tb.getBBox(), steps = [];
    tg.removeAttribute('opacity');
    {
      const FONT = { key: 'font', head: 'Font', rows: [{ type: 'list', items: [{ id: 'arial', label: 'Arial Bold', font: 'Arial, sans-serif' }, { id: 'fr', label: 'Fraunces Soft', font: 'Fraunces, Georgia, serif' }] }] };
      const g = tg.getBBox(), box = [t.x - 2, t.y, t.width + 4, t.height], box2 = [g.x - 2, g.y, g.width + 4, g.height];
      const u = [Math.min(box[0], box2[0]), Math.min(box[1], box2[1])], all = [u[0], u[1], Math.max(box[0] + box[2], box2[0] + box2[2]) - u[0], Math.max(box[1] + box[3], box2[1] + box2[3]) - u[1]];
      const P = placePicker(S, all, FONT, 'r');
      const tr = new Track([860, 520], .35);
      /* it names the fault at the panel, picks, closes it, then reports beside the reset title */
      tr.go([box[0] + box[2] * .62, box[1] + box[3] * .6], 30).click('sel', .1).wait(.12).go(P.c('fr'), 30, { T: .4 }).mark('say0').wait(.85).click('pick', 0).wait(.2).mark('hush0').wait(.3).mark('pclose').wait(.08).go([box2[0] + box2[2] + 14, box2[1] + box2[3] * .55], 30, { T: .34 }).mark('say1').wait(.6).mark('desel').mark('shut').leave([860, 560]);
      const e = tr.ev;
      steps.push({ agent: 'Type', tr, ev: e, say: ['The title fell back to Arial.', 'Set in Fraunces, your display face.'], pin: [all[0] + all[2] + 10, all[1]], avoid: [pkBox(S, P), all, [48, 120, 380, 266]], fx: box2[0] + box2[2] / 2,
        inspect: t2 => [{ k: 'Font', v: t2 >= e.pick ? 'Fraunces Soft' : 'Arial Bold', cls: t2 >= e.pick ? 'good' : 'bad' }, { k: 'Size', v: t2 >= e.pick ? '38' : '31' }],
        edit(t2) { const on = t2 >= e.pick; if (this._o === on) return; this._o = on; tb.style.opacity = on ? 0 : 1; tg.style.opacity = on ? 1 : 0; },
        ui(t2, p) { /* the frame follows the reset title, on the same quick ease as the panel */
          const f = out3(clamp((t2 - e.pick) / .2)), cur = box.map((v, i) => v + (box2[i] - v) * f);
          return { hover: t2 < e.sel && inBox(p, box) ? box : null, sel: selS(t2, e.sel, e.desel, cur), pick: pickState(S, P, FONT, t2, p, e.sel + .06, e.pclose, { sel: [t2 >= e.pick ? 'fr' : 'arial'] }) }; } });
    }
    {
      const SEL = { key: 'selc', head: 'Selection colours', rows: [{ type: 'val', id: 's1' }, { type: 'val', id: 's2' }, { type: 'sw', cap: 'Document colours', items: DOC }] };
      const chart = [48, 120, 380, 266], P = placePicker(S, chart, SEL, 'r');
      const tr = new Track([-60, 480], 3.05);
      /* it names the fault at the chart's corner, works in the panel without a bubble, then reports beside the chart */
      tr.go([414, 150], 60).click('sel', .1).mark('say0').wait(.1).mark('hush0').wait(.04).go(P.c('night'), 26, { T: .42 }).wait(.3).click('p1', 0).wait(.12).go(P.c('s2'), 30, { T: .3 }).click('row2', .05).go(P.c('lamp'), 26, { T: .3 }).click('p2', .04).wait(.2).mark('pclose').wait(.1).go([452, 330], 30, { T: .34 }).mark('say1').wait(.65).mark('desel').mark('shut').leave([-60, 520]);
      const e = tr.ev;
      steps.push({ agent: 'Colour', tr, ev: e, say: ['The chart uses the app’s default colours.', 'Night and Lamp, from your palette.'], pin: [-14, 300], fx: chart[0] + chart[2] / 2,
        inspect: t2 => [{ k: 'Series 1', v: t2 >= e.p1 ? '1C2045' : '4285F4', cls: t2 >= e.p1 ? 'good' : 'bad' }, { k: 'Series 2', v: t2 >= e.p2 ? 'F09A3A' : '34A853', cls: t2 >= e.p2 ? 'good' : 'bad' }],
        edit(t2) { const k = (t2 >= e.p1) + 2 * (t2 >= e.p2); if (this._k === k) return; this._k = k; A.forEach(n => n.setAttribute('fill', t2 >= e.p1 ? '#1C2045' : '#4285F4')); B.forEach(n => n.setAttribute('fill', t2 >= e.p2 ? '#F09A3A' : '#34A853')); },
        ui(t2, p) { const r2 = t2 >= e.row2;
          return { hover: t2 < e.sel && inBox(p, chart) ? chart : null, sel: selS(t2, e.sel, e.desel, chart),
            pick: pickState(S, P, SEL, t2, p, e.hush0 + .06, e.pclose, { sel: [r2 ? 's2' : 's1', ...(t2 >= e.p1 && !r2 ? ['night'] : []), ...(t2 >= e.p2 ? ['lamp'] : [])],
              vals: { s1: t2 >= e.p1 ? { sw: '#1C2045', a: 'Night', b: '1C2045' } : { sw: '#4285F4', a: '', b: '4285F4' }, s2: t2 >= e.p2 ? { sw: '#F09A3A', a: 'Lamp', b: 'F09A3A' } : { sw: '#34A853', a: '', b: '34A853' } } }) }; } });
    }
    {
      const tr = new Track([860, 120], 6.45);
      const vt = 752 - (cb.x + cb.width), past = v => Math.max(0, Math.round(cb.x + cb.width + v - 752));
      const at = t2 => { if (t2 < (tr.ev.mv0 ?? 1e9)) return shift; const p = tr.pos(Math.min(t2, tr.ev.mv1)); const v = shift + (p[0] - grab[0]); return Math.abs(v - vt) < 4 ? vt : v; };
      tr.go([cb.x + shift + cb.width * .45, cb.y + cb.height * .6], 40).click('sel', .1).mark('say0').wait(.75);
      const grab = tr.p;
      tr.drag([grab[0] - (shift - vt) - 1.3, grab[1] + .9], .66, 'mv').wait(.1).mark('say1').wait(.85).mark('desel').mark('shut').leave([860, 80]);
      const e = tr.ev;
      steps.push({ agent: 'Layout', tr, ev: e, side: 'l', say: ['The caption crosses the right margin by 36 px.', 'Moved back inside the grid.'], pin: [cb.x - 16, cb.y - 10], fx: cb.x + vt + cb.width / 2,
        inspect: t2 => [{ k: 'Caption', v: 'Text' }, { k: 'Past margin', v: `${past(at(t2))} px`, cls: past(at(t2)) <= 0 ? 'good' : 'bad' }],
        edit(t2) { const v = at(t2).toFixed(2); if (this._v === v) return; this._v = v; cap.style.transform = `translateX(${v}px)`; },
        ui(t2, p) { const v = at(t2), box = [cb.x + v, cb.y, cb.width, cb.height], on = win(t2, e.sel, e.desel), over = past(v), y = cb.y - 18;
          grid.style.opacity = on ? 1 : 0;
          return { hover: t2 < e.sel && inBox(p, box) ? box : null, sel: selS(t2, e.sel, e.desel, box),
            red: on && t2 < e.mv1 + .05 ? [{ x1: 752, y1: y, x2: Math.max(752.03, cb.x + cb.width + v), y2: y, label: `${over} px`, ok: over <= 0, lx: 752, ly: y - 16 / S.k, anchor: 'r' }] : [],
            guides: on && v === vt ? [[752, 30, 752, 420]] : [] }; } });
    }
    return steps;
  },
};

/* ---------- a player: clock, pause, seek, replay ---------- */
const ICON = { pause: '#i-pause', play: '#i-play', replay: '#i-replay' };
class Player {
  constructor(ctl, fadeEls, label) {
    this.ctl = ctl; this.fadeEls = fadeEls; this.label = label;
    this.scene = null; this.t = 0; this.running = false; this.paused = false; this.visible = false; this.raf = 0; this.done = false; this.busy = false;
    ctl?.addEventListener('click', () => this.toggle());
  }
  load(scene) { this.scene = scene; this.t = 0; this.done = false; this.paused = false; this.running = false; if (RM.matches) { scene.render(scene.total, true); this.done = true; } else scene.render(0); this.setCtl(); }
  play() { if (!this.scene || RM.matches) return; this.running = true; this.kick(); this.setCtl(); }
  kick() { if (!this.raf && this.running && !this.paused && this.visible) { this.last = performance.now(); this.raf = requestAnimationFrame(n => this.frame(n)); } }
  frame(now) {
    this.raf = 0;
    if (!this.running || this.paused || !this.visible) return;
    const dt = now - this.last;
    this.last = now; this.t = Math.min(this.scene.total, this.t + Math.min(dt, 64) / 1000);
    this.onTick?.(this.t, Math.min(dt, 64) / 1000);
    this.scene.render(this.t);
    if (this.t >= this.scene.total) { this.running = false; this.done = true; this.setCtl(); this.onEnd?.(); this.settle(); return; }
    this.raf = requestAnimationFrame(n => this.frame(n));
  }
  settle() {
    if (!this.onSettle || this.onSettle()) return;
    let last = performance.now(), n = 0;
    const go = now => { if (!this.done || this.busy) return; const dt = Math.min(now - last, 64) / 1000; last = now; this.onTick?.(this.t, dt); this.scene.render(this.t); if (!this.onSettle() && n++ < 400) requestAnimationFrame(go); };
    requestAnimationFrame(go);
  }
  seek(t) { this.paused = true; this.t = t; this.onTick?.(t, 0); this.scene.render(t); this.setCtl(); }
  setVisible(v) { this.visible = v; this.kick(); }
  toggle() { if (this.busy) return; if (this.done) { this.replay(); return; } this.paused = !this.paused; this.setCtl(); this.kick(); }
  /* no rewind: the fixed file leaves, the faulty one comes back, the agents start again */
  replay(next) {
    if (this.busy) return;
    this.busy = true; this.running = false;
    const reset = () => { if (next) next(); else { this.t = 0; this.onTick?.(0, 0); this.scene.render(0); } };
    const resume = () => { this.busy = false; this.done = false; this.paused = false; if (RM.matches) { this.done = true; this.setCtl(); } else this.play(); };
    if (this.swap) { this.swap(reset).then(resume); return; }
    const els = this.fadeEls().filter(Boolean);
    const outs = els.map(e => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }));
    outs[0].finished.then(() => {
      reset(); outs.forEach(a => a.cancel());
      const ins = this.fadeEls().filter(Boolean).map(e => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.4,0,.6,1)' }));
      (ins[0]?.finished || Promise.resolve()).then(resume);
    });
  }
  setCtl() {
    const c = this.ctl; if (!c) return;
    c.hidden = RM.matches;
    const st = this.done ? 'replay' : this.paused ? 'play' : 'pause';
    const lab = { pause: 'Pause', play: 'Play', replay: 'Replay' }[st];
    c.querySelector('span').textContent = lab;
    c.querySelector('use').setAttribute('href', ICON[st]);
    c.setAttribute('aria-label', `${lab} ${this.label}`);
  }
}

function seen(elm, fn, threshold = .3) {
  new IntersectionObserver(es => es.forEach(e => fn(e.isIntersecting)), { threshold }).observe(elm);
  document.addEventListener('visibilitychange', () => { if (document.hidden) fn(false); });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
/* text written by an agent: the full text keeps its place, the unwritten part is transparent */
function typeable(n) {
  const txt = n.textContent; n.textContent = '';
  const on = document.createElement('span'), off = document.createElement('span');
  on.className = 'tw-on'; off.className = 'tw-off'; off.textContent = txt; n.append(on, off);
  return { set(k, caret) { k = Math.round(clamp(k, 0, txt.length)); if (on._k !== k) { on._k = k; on.textContent = txt.slice(0, k); off.textContent = txt.slice(k); } n.classList.toggle('is-typing', !!caret); }, len: txt.length };
}

/* ---------- small scenes in pixels: the brand book read, the export written ---------- */
class PxScene {
  constructor(layer, build) { this.layer = layer; this.build = build; this.agents = {}; this.layout(); }
  layout() { this.steps = this.build(); this.steps.forEach(s => { if (!this.agents[s.agent]) this.agents[s.agent] = makeAgent(this.layer, s.agent); }); this.total = Math.max(...this.steps.map(s => s.tr.t)) + .3; }
  render(t, pinned) {
    this.steps.forEach(s => s.draw(pinned ? 1e6 : t, pinned));
    for (const n in this.agents) {
      const A = this.agents[n], s = this.steps.find(z => z.agent === n), st = pinned ? { pos: [0, 0], press: 0, shape: 'arrow', vis: 0, born: 1 } : s.tr.at(t);
      if (A.step !== null) sizeChat(A, null, 0, 0, 1e4, 1e4, 200);
      drawAgent(A, st, st.pos[0], st.pos[1], { o: 0, fix: 0 });
    }
  }
}

/* ---------- boot ---------- */
/* the layout grid of a band switches on when its agents start */
const gridOn = k => document.querySelector(`.zone--${k}`)?.classList.add('is-on');
document.querySelectorAll('.zone .lg').forEach(lg => { const f = lg.cloneNode(true); f.classList.add('lg--flash'); lg.after(f); });
function boot() {
  /* header: light over the photo, ink on the page */
  const top = document.querySelector('[data-top]'), hero = document.querySelector('.hero');
  const copy = hero.querySelector('.hero-copy');
  /* the paper lands before the copy reaches the header: a lead that grows with scroll speed covers the short fade-in,
     and the way back waits 64 px so a stop near the edge does not flicker */
  let lastY = scrollY, lastT = performance.now(), vel = 0;
  const onScroll = () => { const r = copy.getBoundingClientRect(), v = hero.querySelector('[data-view]').getBoundingClientRect();
    const reach = copy.offsetParent === hero && getComputedStyle(copy).position === 'absolute' ? r.top : v.bottom;
    const now = performance.now(), dt = Math.max(now - lastT, 4), dy = scrollY - lastY;
    const inst = Math.max(dy, 0) / Math.min(dt, 17);
    vel = dt > 120 ? inst : .5 * vel + .5 * inst; lastY = scrollY; lastT = now;
    const edge = top.offsetHeight + 12, solid = top.classList.contains('is-solid');
    const next = solid ? reach < edge + 64 : reach < edge + Math.min(vel * 200, 480);
    if (next && !solid) top.classList.toggle('is-quick', vel > 1.2);
    top.classList.toggle('is-solid', next); top.style.setProperty('--veil', Math.min(Math.max(scrollY / 40, 0), 1).toFixed(3)); };
  addEventListener('resize', onScroll);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelectorAll('.top-nav a').forEach(a => {
    const s = document.querySelector(a.getAttribute('href'));
    if (s) new IntersectionObserver(es => es.forEach(e => a.classList.toggle('is-current', e.isIntersecting)), { rootMargin: '-45% 0px -50% 0px' }).observe(s);
  });

  /* hero */
  const stage = document.querySelector('[data-stage]'), view = document.querySelector('[data-view]');
  const board = document.querySelector('[data-board]'), ui = document.querySelector('[data-ui]'), layer = document.querySelector('[data-agents]');
  const off = document.querySelector('[data-off]');
  const fitAll = () => fit(stage, [board, ui, off]);
  fitAll();
  const heroScene = new Scene({ svg: board, ui, layer, vbw: 1197, vbh: 330.4, build: S => heroSteps(board, S), paced: false, pinAgents: false, chatW: S => S.lw < 700 ? Math.min(190, Math.round(S.lw * .46)) : Math.min(250, Math.round(S.lw * .2)), pad: .2 });
  /* the fill panel is drawn once, unseen, while the light box is still off: its first raster (about 40 ms of GPU at
     DPR 2) no longer lands in the middle of the scene */
  heroScene.picker.warm = true;
  heroScene.picker.draw({ spec: HERO_FILL(), a: .01, x: 0, y: 0, hover: null, sel: [], vals: {} });
  setTimeout(() => { heroScene.picker.warm = false; heroScene.picker.draw(null); }, 350);
  const logEl = document.querySelector('[data-log="hero"]'), said = new Set();
  heroScene.onRender = (t, pinned) => {
    heroScene.steps.forEach(s => { if (s.say && (pinned || t >= s.ev.say1) && !said.has(s.agent)) { said.add(s.agent); const li = document.createElement('li'); li.textContent = `${s.say[0]} ${s.say[1]}`; logEl.appendChild(li); } });
  };
  /* phone: the camera follows the agent at work, on a critically damped spring */
  const cam = { x: 0, v: 0, on: false };
  const focusAt = t => { let fx = 260; heroScene.steps.forEach(s => { if (s.focus && t >= s.focus[0]) fx = s.focus[1]; }); return fx; };
  const camTarget = t => {
    const Ws = stage.clientWidth, Wv = view.clientWidth;
    return clamp(Wv / 2 - (FACE[0][0] + focusAt(t) / 1197 * (FACE[1][0] - FACE[0][0])) * Ws, Wv - Ws, 0);
  };
  /* on a phone a bubble picks its side for where the camera will be when it opens */
  heroScene.xAtT = (s, T) => cam.on ? camTarget(T) + FACE[0][0] * stage.clientWidth + s.tr.pos(T)[0] * heroScene.k : null;
  heroScene.xAt = s => heroScene.xAtT(s, s.ev.say0 ?? 0);
  const placeCam = () => { stage.style.transform = cam.on ? `translate3d(${cam.x.toFixed(2)}px,0,0)` : ''; };
  const camMode = () => { cam.on = stage.clientWidth > view.clientWidth * 1.2 && !RM.matches; if (!cam.on) cam.x = 0; placeCam(); };
  const heroPlayer = new Player(document.querySelector('[data-ctl="hero"]'), () => [board, ui, layer], 'the agents on the billboard');
  heroPlayer.onSettle = () => !cam.on || (Math.abs(cam.x - camTarget(heroPlayer.t)) < .5 && Math.abs(cam.v) < 5);
  heroPlayer.onTick = (t, dt) => {
    if (!cam.on) return;
    const target = camTarget(t);
    if (!dt) { cam.x = target; cam.v = 0; }
    else { const w = 3.6; const x0 = cam.x - target, e = Math.exp(-w * dt), k = cam.v + w * x0; cam.x = target + (x0 + k * dt) * e; cam.v = (cam.v - w * k * dt) * e; }
    placeCam();
  };
  /* replay: the light box switches off, the faulty poster goes back in, it lights up again */
  heroPlayer.swap = async reset => {
    hero.classList.add('is-off'); await wait(340);
    said.clear(); logEl.innerHTML = '';
    camMode(); reset();
    hero.classList.remove('is-off', 'is-lit'); void hero.offsetWidth; hero.classList.add('is-lit');
    await wait(1050);
  };
  camMode();
  heroPlayer.load(heroScene);
  if (cam.on) { cam.x = camTarget(0); placeCam(); }
  seen(hero, v => heroPlayer.setVisible(v), .15);
  /* entrance: the light box switches on, then the agents join the file */
  let lit = false;
  /* the title in lines, each in its own mask; rebuilt when the width changes the breaks */
  const h1 = hero.querySelector('.display'), h1Text = h1.textContent;
  const splitLines = () => {
    h1.textContent = h1Text;
    const words = h1Text.split(' '); h1.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
    const lines = []; let y = null;
    h1.querySelectorAll('.w').forEach(w => { const t = Math.round(w.getBoundingClientRect().top); if (t !== y) { lines.push([]); y = t; } lines[lines.length - 1].push(w.textContent); });
    h1.innerHTML = lines.map((l, i) => `<span class="ln" style="--l:${i}"><span>${l.join(' ')}</span></span>`).join(' ');
    h1.setAttribute('aria-label', h1Text);
  };
  splitLines(); hero.classList.add('has-lines');
  let lw = innerWidth; addEventListener('resize', () => { if (innerWidth !== lw) { lw = innerWidth; splitLines(); } });
  const startHero = () => { if (lit) return; lit = true; document.documentElement.classList.add('is-struck'); hero.classList.add('is-ready'); if (RM.matches) { hero.classList.add('is-copy'); return; } hero.classList.add('is-lit'); setTimeout(() => hero.classList.add('is-copy'), 380); setTimeout(() => heroPlayer.play(), 1000); };
  const img = hero.querySelector('img');
  /* the box strikes once the page's own set-up and first paint are behind it, so its first frames are not dropped */
  const strike = () => requestAnimationFrame(() => requestAnimationFrame(startHero));
  /* the page's largest drawings (the footer's inspected logo, the tool names and the price) are drawn once, unseen,
     while the light box is still off: their first draw costs the GPU 15 to 30 ms once per browser, which otherwise
     lands on the first jump to Pricing */
  { const w = document.createElement('div');
    w.setAttribute('aria-hidden', 'true'); w.inert = true;
    w.style.cssText = 'position:fixed;left:0;top:0;z-index:1;opacity:.004;pointer-events:none;color:var(--ink);white-space:nowrap';
    for (const q of ['.where .tools', '.where .price']) { const n = document.querySelector(q); if (!n) continue; const c = n.cloneNode(true);
      c.style.cssText = `display:grid;margin:0;width:${n.getBoundingClientRect().width}px`; w.appendChild(c); }
    const foot = document.querySelector('.foot-wrap');
    if (foot) { const c = foot.cloneNode(true); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); c.style.width = document.documentElement.clientWidth + 'px'; w.appendChild(c); }
    document.body.appendChild(w); setTimeout(() => w.remove(), 450); }
  /* opened in the portfolio, the box waits until the portfolio's curtain leaves, so the visitor sees it strike: the page
     asks its parent; told to hold, it waits for the cue (4 s at most); with no answer within 150 ms (alone, or in any
     other frame) it starts as before */
  const cue = new Promise(go => {
    if (window.parent === window) return go();
    let held = false;
    const done = () => { removeEventListener('message', on); go(); };
    const on = e => { const k = e.source === parent && e.data && e.data.type;
      if (k === 'portfolio:hold' && !held) { held = true; setTimeout(done, 4000); } else if (k === 'portfolio:reveal') done(); };
    addEventListener('message', on);
    try { parent.postMessage({ type: 'landing:hello' }, '*'); } catch (e) { done(); }
    setTimeout(() => { if (!held) done(); }, 150);
  });
  const go = () => cue.then(strike);
  if (img.complete && img.naturalWidth) go(); else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
  new ResizeObserver(() => { fitAll(); heroScene.layout(); camMode(); if (cam.on) { cam.x = camTarget(heroPlayer.t); cam.v = 0; placeCam(); } heroScene.render(RM.matches ? heroScene.total : heroPlayer.t, RM.matches); }).observe(view);

  /* the brand book: four agents lasso what they read; each rule is written as it is read */
  const bookBand = document.querySelector('.rules'), book = document.querySelector('[data-book]');
  const rlayer = document.createElement('div'); rlayer.className = 'agents agents--px'; rlayer.setAttribute('aria-hidden', 'true'); bookBand.appendChild(rlayer);
  const reads = [...book.querySelectorAll('.read')], ruleEls = [...document.querySelectorAll('[data-rules] li .rt')], rules = ruleEls.map(typeable);
  const who = ['Layout', 'Colour', 'Type', 'Tone'];
  const bookScene = new PxScene(rlayer, () => {
    const L = bookBand.getBoundingClientRect();
    return reads.map((g, i) => {
      const svg = g.ownerSVGElement, r = svg.getBoundingClientRect(), k = r.width / 440, rc = g.querySelector('rect');
      const x = +rc.getAttribute('x'), y = +rc.getAttribute('y'), w = +rc.getAttribute('width'), h = +rc.getAttribute('height');
      const P = (a, b) => [r.left - L.left + a * k, r.top - L.top + b * k];
      const start = P(x + w, y - 0), end = P(x, y + h), t0 = .15 + i * .5;
      const from = i % 2 ? [L.width + 30, start[1] + 60] : [start[0] + 140, -30];
      const tr = new Track(from, t0);
      tr.go(start, 24, { T: .42 }).drag(end, .34, 'mq').mark('sel').wait(.08);
      /* then it takes what it read to the list and writes the rule there, at the start of its line */
      const rr = ruleEls[i].getBoundingClientRect(), at = [rr.left - L.left - 2, rr.top - L.top + Math.min(rr.height, 30) * .55];
      tr.go(at, 18, { T: .52 }).shape('ibeam', tr.t + .02).wait(.06).mark('w0');
      const n = rules[i].len, tw = n * .022;
      tr.wait(tw).mark('w1').wait(.16).shape('arrow', tr.t).wait(.08).leave([L.width + 40, at[1] + 70]);
      const e = tr.ev, hs = [...g.querySelectorAll('.h')], box = g.querySelector('rect');
      let mqEl = g.querySelector('.mq'); if (!mqEl) { mqEl = el('rect', { class: 'mq' }, g); }
      const sx0 = start[0] - (x + w) * k + x * k, sx1 = start[0];
      return { agent: who[i], tr, span: [Math.min(sx0, sx1), Math.max(sx0, sx1)], svg, rx: [x, x + w], ev: e, draw(t, pinned) {
        const on = pinned || win(t, e.sel, e.w1 + .5);
        box.style.opacity = on ? 1 : 0; hs.forEach(hh => { hh.style.opacity = on ? (pinned ? 1 : clamp((t - e.sel) / .08)).toFixed(3) : 0; });
        if (!pinned && win(t, e.mq0, e.mq1)) { const c = tr.pos(t); const cx = x + w, cy = y, px = (c[0] - (r.left - L.left)) / k, py = (c[1] - (r.top - L.top)) / k; sa(mqEl, 'x', f2(Math.min(cx, px))); sa(mqEl, 'y', f2(Math.min(cy, py))); sa(mqEl, 'width', f2(Math.abs(cx - px))); sa(mqEl, 'height', f2(Math.abs(py - cy))); mqEl.style.opacity = 1; } else mqEl.style.opacity = 0;
        rules[i].set(pinned ? n : clamp((t - e.w0) / (e.w1 - e.w0)) * n, !pinned && win(t, e.w0, e.w1 + .4));
      } };
    });
  });
  bookBand.classList.add('is-scripted');
  /* the layout grid as the agents' tool: on the page being read, the page's own six columns show where the selection lies */
  const pageCols = new Map();
  book.querySelectorAll('svg').forEach(svg => { const gg = el('g', { class: 'pg-cols' }); svg.insertBefore(gg, svg.querySelector('.reads'));
    pageCols.set(svg, [0, 1, 2, 3, 4, 5].map(c => el('rect', { x: 40 + c * 62, y: 0, width: 50, height: 560 }, gg))); });
  const baseBook = bookScene.render.bind(bookScene);
  bookScene.render = (t, pinned) => { baseBook(t, pinned);
    const hot = new Map([...pageCols.keys()].map(k => [k, new Set()]));
    if (!pinned) bookScene.steps.forEach(s => { if (!win(t, s.ev.sel, s.ev.w1 + .3)) return;
      pageCols.get(s.svg).forEach((r, n) => { const a = 40 + n * 62, b = a + 50; if (b > s.rx[0] && a < s.rx[1]) hot.get(s.svg).add(n); }); });
    pageCols.forEach((rs, svg) => rs.forEach((r, n) => r.classList.toggle('on', hot.get(svg).has(n)))); };
  let bookT = 0, bookRaf = 0, bookLast = 0, held = false;
  const bookTick = now => { bookRaf = 0; if (held) return; const dt = now - bookLast; bookLast = now; bookT = Math.min(bookScene.total, bookT + Math.min(dt, 64) / 1000); bookScene.render(bookT); if (bookT < bookScene.total) bookRaf = requestAnimationFrame(bookTick); };
  bookScene.render(0);
  if (RM.matches) bookScene.render(0, true);
  else new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); gridOn('book'); bookLast = performance.now(); bookRaf = requestAnimationFrame(bookTick); } }), { threshold: .35 }).observe(book);
  new ResizeObserver(() => { bookScene.layout(); bookScene.render(RM.matches ? 1e6 : bookT, RM.matches); }).observe(bookBand);

  /* the demo: a file view */
  const proof = document.querySelector('[data-proof]'), dlayer = document.querySelector('[data-agents-demo]');
  const ibody = document.querySelector('[data-inspect-body]'), list = document.querySelector('[data-findings]');
  const svgOf = k => proof.querySelector(`[data-visual="${k}"]`);
  const uiOf = k => { const sh = proof.querySelector(`[data-sheet="${k}"]`); let u = sh.querySelector('.demo-ui'); if (!u) { u = el('svg', { class: 'demo-ui', viewBox: svgOf(k).getAttribute('viewBox'), 'aria-hidden': 'true' }); sh.appendChild(u); } return u; };
  const scenes = {};
  let curK = 'poster';
  const sceneOf = k => {
    if (!scenes[k]) { const svg = svgOf(k), vb = svg.viewBox.baseVal; scenes[k] = new Scene({ svg, ui: uiOf(k), layer: dlayer, vbw: vb.width, vbh: vb.height, build: S => DEMO[k](svg, S), chatW: S => Math.max(160, Math.min(205, Math.round(S.lw * .3))), pinAgents: false }); }
    const s = scenes[k];
    /* on a phone the slide is shown 1.25 times larger and the view glides to what each agent fixes, once the
       previous bubble has closed; the pan is a function of the scene time, so pause and seek stay exact */
    /* a slide shown small (under about 1400 px) leaves no room beside its text: the bubbles keep their names and the
       phrases read in the comments, right beside the file, as on a phone */
    if (k === 'slide') s.quiet = S => S.k < .8;
    if (k === 'slide') { const sheet = proof.querySelector('[data-sheet="slide"]'), Z = 1.25, W = 800 / Z;
      s.preRender = (t, pinned) => {
        if (!PHONE.matches) { if (sheet.style.transform) sheet.style.transform = ''; return; }
        const st = s.steps.filter(z => z.fx != null); let x = st[0].fx;
        if (pinned) x = 400; else { for (let i = 1; i < st.length; i++) { const f = clamp((t - st[i - 1].ev.shut) / .8), e = f * f * (3 - 2 * f); x += (st[i].fx - x) * e; }
          const f = clamp((t - st[st.length - 1].ev.shut - .2) / .9), e = f * f * (3 - 2 * f); x += (st[0].fx - x) * e; }
        const left = clamp(x - W / 2, 0, 800 - W), v = `translate3d(${(-left * sheet.offsetWidth / 800).toFixed(2)}px,0,0)`;
        if (sheet.style.transform !== v) sheet.style.transform = v; }; }
    s.onRender = (t, pinned) => {
      const T = pinned ? 1e6 : t;
      const cur = [...s.steps].reverse().find(z => T >= (z.ev.sel ?? z.ev.edit ?? 1e9)) || null;
      const rows = cur?.inspect ? cur.inspect(T) : null;
      const html = rows ? rows.map(r => `<div class="irow"><b>${r.k}</b><span class="v ${r.cls || ''}${/\d/.test(r.v) ? '' : ' w'}">${r.v}</span></div>`).join('') : '<p class="inspect-empty">Nothing selected yet</p>';
      if (html !== ibody._h) { ibody._h = html; ibody.innerHTML = html; }
      [...list.children].forEach((li, i) => { const z = s.steps[i]; li.classList.toggle('is-wait', !(pinned || t >= z.ev.say0)); li.classList.toggle('is-fixed', pinned || t >= z.ev.say1); });
    };
    return s;
  };
  const fill = k => { list.innerHTML = sceneOf(k).steps.map(s => `<li class="is-wait"><span class="who">${s.agent}</span><span class="sr">: </span><span class="fault">${s.say[0]}</span> <span class="fix">${s.say[1]}</span></li>`).join(''); };
  const demoPlayer = new Player(document.querySelector('[data-ctl="demo"]'), () => [proof.querySelector('.sheet.is-on'), dlayer], 'the agents on the file');
  const show = k => {
    curK = k;
    Object.keys(scenes).forEach(n => { if (n !== k) { scenes[n].steps.forEach(s => { s._n = s._o = s._a = s._k = s._s = s._v = undefined; s.edit?.(-1); }); scenes[n].steps.forEach(s => s.ov.draw({}, scenes[n].k || 1)); } });
    proof.querySelectorAll('[data-sheet]').forEach(s => s.classList.toggle('is-on', s.dataset.sheet === k));
    dlayer.querySelectorAll('.agent, .picker').forEach(n => n.remove());
    if (scenes[k]) { scenes[k].agents = {}; scenes[k].picker = new Picker(dlayer); scenes[k].layout(); }
    fill(k); demoPlayer.load(sceneOf(k));
  };
  /* the file list shows each file as it was sent */
  document.querySelectorAll('[data-thumb]').forEach(span => {
    const c = svgOf(span.dataset.thumb).cloneNode(true); c.removeAttribute('data-visual'); c.querySelectorAll('[data-el]').forEach(n => n.removeAttribute('data-el')); span.appendChild(c);
  });
  show('poster');
  let started = false;
  document.querySelector('[data-picker]').addEventListener('change', e => {
    started = true;
    if (RM.matches) { show(e.target.value); return; }
    demoPlayer.replay(() => show(e.target.value));
  });
  seen(proof, v => { demoPlayer.setVisible(v); if (v) gridOn('app'); if (v && !started) { started = true; demoPlayer.play(); } }, .45);
  new ResizeObserver(() => { const s = demoPlayer.scene; if (!s) return; s.layout(); s.render(RM.matches ? s.total : demoPlayer.t, RM.matches); }).observe(proof);

  /* the export: each agent writes what it fixed, the thumbnail follows, then the file is ready to leave */
  const win2 = document.querySelector('.export-win'), elayer = document.createElement('div');
  elayer.className = 'agents agents--px'; elayer.setAttribute('aria-hidden', 'true'); win2.appendChild(elayer);
  const lines = [...win2.querySelectorAll('.export-log li .tw')].map(typeable), thumb = win2.querySelector('.export-thumb');
  const state = win2.querySelector('[data-export-state]'), check = win2.querySelector('[data-export]');
  const T = { bad: thumb.querySelector('[data-te="w-bad"]'), good: thumb.querySelector('[data-te="w-good"]'), rest: thumb.querySelector('[data-te="w-rest"]'), sb: thumb.querySelector('[data-te="sun-bad"]'), sg: thumb.querySelector('[data-te="sun-good"]'), logo: thumb.querySelector('[data-te="logo"]') };
  const tg = T.bad.parentNode, tw0 = textLen(tg, 'Unleash'), tw1 = textLen(tg, 'Start'), tsp = textLen(tg, 'Unleash the') - tw0 - textLen(tg, 'the');
  T.good.removeAttribute('opacity');
  const fixThumb = [
    on => { T.bad.style.opacity = on ? 0 : 1; T.good.style.opacity = on ? 1 : 0; T.rest.setAttribute('x', (44 + (on ? tw1 : tw0) + tsp).toFixed(2)); },
    on => { T.sb.style.opacity = on ? 0 : 1; T.sg.style.opacity = on ? 1 : 0; },
    on => { T.logo.setAttribute('transform', on ? 'translate(-31 35)' : ''); },
  ];
  const ewho = ['Tone', 'Colour', 'Layout'];
  const expScene = new PxScene(elayer, () => {
    const W = win2.getBoundingClientRect();
    return lines.map((ln, i) => {
      const li = ln && win2.querySelectorAll('.export-log li')[i], r = li.getBoundingClientRect();
      const t0 = .15 + i * .8, tr = new Track([W.width + 30, r.top - W.top + 30 + i * 10], t0);
      const end = [Math.min(r.left - W.left + r.width * .82, W.width - 30), r.top - W.top + r.height * .55];
      tr.go(end, 30, { T: .5 }).mark('w0').wait(ln.len * .02).mark('w1').wait(.3).leave([W.width + 40, end[1] + 40]);
      const e = tr.ev;
      return { agent: ewho[i], tr, draw(t, pinned) {
        ln.set(pinned ? ln.len : clamp((t - e.w0) / (e.w1 - e.w0)) * ln.len, !pinned && win(t, e.w0, e.w1 + .3));
        fixThumb[i](pinned || t >= e.w1);
      } };
    });
  });
  check.classList.add('is-scripted');
  const ready = on => { check.classList.toggle('is-done', on); state.children[0].setAttribute('aria-hidden', on); state.children[1].setAttribute('aria-hidden', !on); };
  expScene.render(0); ready(false);
  if (RM.matches) { expScene.render(0, true); ready(true); }
  else new IntersectionObserver((es, o) => es.forEach(e => { if (!e.isIntersecting) return; o.disconnect(); gridOn('export');
    let t = 0, last = performance.now();
    const tick = now => { if (held) return; const dt = now - last; last = now; t = Math.min(expScene.total + .4, t + Math.min(dt, 64) / 1000); expScene.render(t); if (t >= expScene.steps[expScene.steps.length - 1].tr.ev.w1 + .45) ready(true); if (t < expScene.total + .4) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); }), { threshold: .6 }).observe(win2);
  new ResizeObserver(() => { expScene.layout(); }).observe(win2);

  /* hover: the lasso starts from the corner the pointer came in by; a selected button shows its size */
  document.querySelectorAll('.sel').forEach(n => {
    n.addEventListener('pointerenter', e => { const r = n.getBoundingClientRect();
      n.style.setProperty('--ox', e.clientX < r.left + r.width / 2 ? '0%' : '100%'); n.style.setProperty('--oy', e.clientY < r.top + r.height / 2 ? '0%' : '100%');
      if (n.classList.contains('btn')) n.dataset.size = `${Math.round(r.width)} × ${Math.round(r.height)}`; });
    n.addEventListener('focus', () => { if (n.classList.contains('btn')) { const r = n.getBoundingClientRect(); n.dataset.size = `${Math.round(r.width)} × ${Math.round(r.height)}`; } });
  });

  /* the close: the red line is drawn under the words once */
  const endB = document.querySelector('.end');
  new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); endB.classList.add('is-seen'); } }), { threshold: .5 }).observe(endB.querySelector('.title'));

  /* the footer measures its own logo, as an agent would */
  const mk = document.querySelector('.mk');
  if (mk) new ResizeObserver(() => { const r = mk.getBoundingClientRect(), x = Math.round(r.width * .1418);
    mk.querySelectorAll('.mk-cote b').forEach(b => { b.textContent = x; });
    mk.querySelector('.mk-size').textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`; }).observe(mk);

  /* the form answers honestly */
  const form = document.querySelector('[data-form]'), out = form.querySelector('[data-out]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = form.mail.value.trim();
    out.textContent = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Thanks. This is a fictional product, so nothing was sent.' : 'Please enter a work email.';
  });
  RM.addEventListener?.('change', () => location.reload());
  /* frame-exact review: holds the two small scenes at a given time */
  window.__rl = { hero: heroPlayer, demo: demoPlayer, show, heroScene, bookScene, expScene, scenes, book: t => { held = true; bookScene.render(t); }, exp: t => { held = true; expScene.render(t); ready(t >= expScene.total + .2); } };
}

const ready = Promise.race([Promise.all(['600 60px "Mona Sans"', '330 70px Fraunces', '430 22px Fraunces'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]);
const start = () => ready.then(boot).then(() => H.classList.add('is-live')).catch(e => { H.classList.replace('js', 'nojs'); console.error(e); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
