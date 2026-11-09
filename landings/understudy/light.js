/* Understudy: the morning sun through the office blinds, over the paper, the sheets and the box office.
   One light function in page coordinates: three projections of the same window with its venetian blind (homographies
   from the window's square to a receding trapezoid), an analytic penumbra (an exact triangle blur of the slats, the
   mullion and the frame) that widens with the distance from the window, a warm sun and a shade lit by the cool sky.
   A single WebGL2 context, kept out of the DOM, renders each layer into a 2D canvas that scrolls with the page: the
   paper (one canvas the height of the document, behind everything), the box office's panel, and multiplied layers on
   the insert slip, the script's sheet and the ticket, so the sun on them meets the sun on the paper exactly.
   The motion is an afternoon's: the slats breathe a fraction of their opening, the sun drifts a few pixels a minute;
   one visible layer is redrawn per frame, each about eight times a second. Reduced motion: a still image.
   Without WebGL2, html.light-off and the paper keeps its own colour. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);
  const E = { cover: $('.cover'), bill: $('.bill'), stage: $('.stage'), slip: $('.slip'), act1: $('.act--1'), page: $('.page'),
    act2: $('.act--2'), box: $('.morning'), ticket: $('.ticket'), credits: $('.credits') };
  for (const k in E) if (!E[k]) { root.classList.add('light-off'); return; }

  const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform mat3 uM;          // canvas px (gl_FragCoord) -> page px
uniform mat3 uHi[3];      // page px -> window (u far..near, v top..bottom), one per projection
uniform vec4 uA[3];       // penumbra near (px), penumbra far (px), sun, sky
uniform vec4 uB[3];       // slats over the blind, open fraction, blind end (v), slat phase
uniform float uSg[3];     // sign of w inside the quad (the far side of the vanishing line is not lit)
uniform float uSkyR;      // sky blur (px)
uniform int uMode;        // 0 paper, 1 multiplied over a sheet, 2 the box office's dark panel
uniform vec3 uShade;      // the paper in shade (sRGB), = the masthead
uniform vec4 uCalm;       // the paper beside the panels stays in shade: cover top, cover bottom, Act II top
uniform float uT;

float ign(vec2 fc) { return fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))); }
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }

// cumulative of a triangle kernel of half-width w: the penumbra of one straight edge
float tri(float z, float w) { float s = clamp(z / max(w, 1e-4), -1., 1.); return s < 0. ? .5 * (1. + s) * (1. + s) : 1. - .5 * (1. - s) * (1. - s); }
// second integral of the slat square wave (open for fract(x) < a): exact triangle blur of the louvres at any width
float Hs(float x, float a) { float n = floor(x), f = x - n; float q = f < a ? .5 * f * f : a * f - .5 * a * a; return a * n * (n - 1.) * .5 + n * (a - .5 * a * a) + n * a * f + q; }
float louvre(float x, float a, float w) {
  if (w > 2.5) return a;
  w = max(w, 1e-3); x = fract(x);
  return clamp((Hs(x + w, a) - 2. * Hs(x, a) + Hs(x - w, a)) / (w * w), 0., 1.);
}
float bar(float z, float c, float h, float w) { return tri(z - (c - h), w) - tri(z - (c + h), w); }

// the window: frame, one mullion, the blind (slats down to its bottom rail), the clear pane under it
float win(vec2 uv, vec2 w, vec4 B, float tw) {
  float fu = tri(uv.x, w.x) - tri(uv.x - 1., w.x);
  float fv = tri(uv.y, w.y) - tri(uv.y - 1., w.y);
  float m = bar(uv.x, .58, .016, w.x);
  // the slats sag a little between their ladder tapes and are not evenly spaced: never a regular stripe
  float v = uv.y + .010 * sin(uv.y * 9.1 + 1.3) + .006 * sin(uv.y * 23.7 + .4) - .018 * (uv.x - .5) * (uv.x - .5) + .0025 * sin(uv.x * 6.2 + tw * .15);
  float s = louvre(v * B.x + B.w, B.y, w.y * B.x);
  float below = tri(uv.y - B.z, w.y);
  float rail = bar(uv.y, B.z - .008, .008, w.y);
  return max(fu * fv, 0.) * (1. - .92 * m) * mix(s, 1., below) * (1. - .9 * rail);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (uM * vec3(fc, 1.)).xy;
  float L = 0., K = 0.;
  for (int i = 0; i < 3; i++) {
    if (uA[i].z + uA[i].w <= 0.) continue;
    vec3 h = uHi[i] * vec3(p, 1.);
    float side = step(0., h.z * uSg[i]);
    vec2 uv = h.xy / h.z;
    // analytic Jacobian of the homography (screen derivatives are undefined inside this loop on D3D)
    mat3 Q = uHi[i];
    vec2 gu = (vec2(Q[0][0], Q[1][0]) - uv.x * vec2(Q[0][2], Q[1][2])) / h.z;
    vec2 gv = (vec2(Q[0][1], Q[1][1]) - uv.y * vec2(Q[0][2], Q[1][2])) / h.z;
    vec2 g = vec2(length(gu), length(gv));
    float r = mix(uA[i].y, uA[i].x, smoothstep(0., 1., clamp(uv.x, 0., 1.)));   // sharp near the window, soft far
    vec4 B = uB[i];
    B.y += .018 * sin(uT * .21 + float(i)) + .011 * sin(uT * .083 + 1.7) + .006 * sin(uT * .23 + .4 * float(i));  // the slats breathe
    B.w += .006 * sin(uT * .13 + 2.1);
    if (uA[i].z > 0.) L += side * uA[i].z * win(uv, g * r, B, uT);
    if (uA[i].w > 0.) K += side * uA[i].w * win(uv, g * uSkyR, B, uT);
  }
  vec3 c;
  // warm sun, cool sky: gains over the paper in shade (linear light)
  vec3 SUN = vec3(.33, .305, .232), SKY = vec3(.035, .045, .075);
  if (uMode == 0) {
    // the frame's narrow margins beside the cover and the dark panels stay in shade (no slivers of light there)
    float calm = smoothstep(uCalm.x, uCalm.x + 60., p.y) * (1. - smoothstep(uCalm.y - 40., uCalm.y, p.y)) + smoothstep(uCalm.z, uCalm.z + 60., p.y);
    calm = clamp(calm, 0., 1.);
    c = toLin(uShade) * (1. + (1. - calm) * (L * SUN + K * SKY));
  } else if (uMode == 1) {
    // a light sheet in shade stays cream, a little cooler: a high floor, barely blue; warm where the sun is
    vec3 F = vec3(.85, .86, .88), LIT = vec3(1., .975, .90);
    c = mix(F, LIT, clamp(L + .12 * K, 0., 1.));
  } else {
    vec3 H = toLin(vec3(16., 14., 11.) / 255.);
    c = H + L * vec3(.034, .020, .0092) + K * vec3(.0016, .0015, .0013);
  }
  c = toSrgb(c) + (ign(fc) - .5) / 255.;
  o = vec4(c, 1.);
}`;
  const VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
void main() { gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;
  const SHADE = [0xDA, 0xD6, 0xCE];   // the paper in shade, and the masthead: keep equal to understudy.css

  // ---------- geometry ----------
  // unit square -> quad (p0 top far, p1 top near, p2 bottom near, p3 bottom far), as a 3x3 row-major matrix
  function sq2quad(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  }
  function inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function mul3(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  const colMajor = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  // layout box in page px, ignoring transforms (offset chain)
  function pageBox(el) {
    let x = 0, y = 0, e = el;
    while (e) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight, r: x + el.offsetWidth, b: y + el.offsetHeight };
  }

  // ---------- WebGL2 ----------
  const glc = document.createElement('canvas');
  let gl = null, prog = null;
  try {
    gl = glc.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (gl) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog); gl.bindVertexArray(gl.createVertexArray());
    }
  } catch (e) { gl = null; }
  if (!gl) { root.classList.add('light-off'); return; }
  const U = {}; const u = (n) => (n in U ? U[n] : (U[n] = gl.getUniformLocation(prog, n)));
  gl.uniform3f(u('uShade'), SHADE[0] / 255, SHADE[1] / 255, SHADE[2] / 255);

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = RM.matches;

  // ---------- layers (hidden until the first draw, then faded in) ----------
  const made = [];
  function canvas2d(parent, cls, first) {
    const c = document.createElement('canvas');
    c.className = 'pers ' + cls; c.setAttribute('aria-hidden', 'true');
    c.style.opacity = '0';
    if (first) parent.prepend(c); else parent.append(c);
    made.push(c);
    return { c, g: c.getContext('2d', { alpha: false }) };
  }
  const tb = E.ticket.querySelector('.ticket-body'), ts = E.ticket.querySelector('.ticket-stub');
  const LAY = {
    paper: { L: canvas2d(document.body, 'pers-paper', true), el: document.body, k: .5, mode: 0, vis: true, pj: [0, 1, 2] },
    box: { L: canvas2d(E.box, 'pers-box', true), el: E.box, k: .5, mode: 2, vis: false, pj: [2] },
    page: { L: canvas2d(E.page, 'pers-mul', false), el: E.page, k: .5, mode: 1, vis: false, pj: [0, 1] },
    slip: { L: canvas2d(E.slip, 'pers-mul', false), el: E.slip, k: .75, mode: 1, vis: false, pj: [0, 1], rot: true },
  };
  if (tb) LAY.tb = { L: canvas2d(tb, 'pers-mul', false), el: tb, k: .5, mode: 1, vis: false, pj: [2] };
  if (ts) LAY.ts = { L: canvas2d(ts, 'pers-mul', false), el: ts, k: .75, mode: 1, vis: false, pj: [2] };
  const order = Object.keys(LAY);

  // ---------- the light: three projections of one window, placed on the page's own boxes ----------
  const PJ = [];   // { hi, A:[rn, rf, sun, sky], B:[N, a, blind, phase], sg }
  let W = 0, DOCH = 0, narrow = false, calm = [0, 0, 0];
  function quad(pts, A, B) {
    const hi = inv3(sq2quad(pts));
    const cx = pts.reduce((a, q) => a + q[0], 0) / 4, cy = pts.reduce((a, q) => a + q[1], 0) / 4;
    PJ.push({ hi, A, B, sg: Math.sign(hi[6] * cx + hi[7] * cy + hi[8]) || 1 });
  }
  function size(l) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = l === LAY.paper ? W : l.el.offsetWidth, bh = l === LAY.paper ? DOCH : l.el.offsetHeight;
    const k = l.k * Math.max(1, dpr * .75);
    l.cw = Math.max(1, Math.round(bw * k)); l.ch = Math.max(1, Math.round(bh * k));
    l.bw = Math.max(1, bw); l.bh = Math.max(1, bh);
    if (l.L.c.width !== l.cw || l.L.c.height !== l.ch) { l.L.c.width = l.cw; l.L.c.height = l.ch; }
  }
  function layout() {
    W = root.clientWidth;
    narrow = W < 700;
    const pc = LAY.paper.L.c;
    pc.style.height = '0px';
    DOCH = root.scrollHeight;
    pc.style.height = DOCH + 'px';
    const S = pageBox(E.page), A1 = pageBox(E.act1), A2 = pageBox(E.act2), BL = pageBox(E.bill), ST = pageBox(E.stage), SL = pageBox(E.slip);
    const M = pageBox(E.box), T = pageBox(E.ticket), CR = pageBox(E.credits), DL = pageBox(E.credits.querySelector('dl') || E.credits);
    PJ.length = 0;
    if (!narrow) {
      // the window stands just past the right edge of the page: the sharp side of its light falls at the same place on
      // the title and on Act I, close to that edge whatever the width
      const NEAR = .954 * W;
      // 0. first light around the title: softer, lower, passing behind the cover picture
      quad([[.10 * W, BL.y + .25 * BL.h], [NEAR, BL.y - .55 * BL.h], [NEAR, BL.y + .95 * BL.h], [.10 * W, BL.y + 3.4 * BL.h]],
        [9, 30, .72, .5], [6, .5, .72, .3]);
      // 1. the sun across Act I: the window's whole projection, sharp on the right, soft and wide on the left. Placed on
      // the script's sheet up to 1440 px; on wider windows it keeps the share of the page it has there instead of
      // staying the sheet's size (a band of shade then opened on the right)
      const x0 = Math.min(S.x - .62 * S.w, -.065 * W), x1 = Math.max(S.r + .40 * S.w, NEAR);
      quad([[x0, SL.y + .12 * A1.h], [x1, SL.y - 1.1 * SL.h], [x1, S.y + .30 * S.h], [x0, S.y + .98 * S.h]],
        [7, 28, 1, .9], [10, .54, .70, .15]);
      // 2. late morning, the sun higher: the slats cross the ticket's right half, then run down the black beside the credits
      quad([[T.x + .30 * T.w, T.y - .05 * T.h], [M.r + .02 * M.w, T.y - .60 * T.h], [M.r + .02 * M.w, M.b + .04 * M.h], [DL.r + 70, M.b + .02 * M.h]],
        [6, 14, 1, .5], [7, .5, 1.2, .30]);
    } else {
      // phones: the same window, nearer: its sharp edge stands in the right margin, the rest runs off the left side
      quad([[-.30 * W, BL.y + .35 * BL.h], [.94 * W, BL.y - .50 * BL.h], [.94 * W, BL.y + .90 * BL.h], [-.30 * W, BL.y + 3.0 * BL.h]],
        [8, 26, .72, .5], [6, .5, .72, .3]);
      quad([[S.x - .62 * S.w, SL.y + .10 * A1.h], [W - 12, SL.y - 1.1 * SL.h], [W - 12, S.y + .26 * S.h], [S.x - .62 * S.w, S.y + .85 * S.h]],
        [7, 24, 1, .9], [10, .54, .70, .15]);
      quad([[T.x + .40 * T.w, T.y - .08 * T.h], [M.r + .04 * M.w, T.y - .35 * T.h], [M.r + .04 * M.w, T.b + .10 * T.h], [T.x + .80 * T.w, CR.y + .10 * CR.h]],
        [6, 13, 1, .5], [6, .5, 1.2, .30]);
    }
    calm = [ST.y, ST.b, A2.y];
    for (const k of order) size(LAY[k]);
    let mw = 1, mh = 1;
    for (const k of order) { mw = Math.max(mw, LAY[k].cw); mh = Math.max(mh, LAY[k].ch); }
    if (glc.width !== mw || glc.height !== mh) { glc.width = mw; glc.height = mh; }
  }

  // ---------- drawing ----------
  function slipPose() {
    const cs = getComputedStyle(E.slip);
    const ang = (parseFloat(cs.rotate) || 0) * Math.PI / 180;
    const tr = (cs.translate && cs.translate !== 'none') ? cs.translate.split(' ').map(parseFloat) : [0, 0];
    return { ang, tx: tr[0] || 0, ty: tr[1] || 0, key: ang.toFixed(6) + ',' + (tr[0] || 0) + ',' + (tr[1] || 0) };
  }
  function draw(l, t, y0 = 0, y1 = l.ch) {
    const { cw, ch } = l;
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(ch, Math.ceil(y1));
    const bh = y1 - y0; if (bh <= 0) return;
    const kx = cw / l.bw, ky = ch / l.bh;
    // canvas px -> local CSS px -> page px
    const L0 = [1 / kx, 0, 0, 0, -1 / ky, (y0 + bh) / ky, 0, 0, 1];
    let m = L0;
    if (l !== LAY.paper) {
      const b = pageBox(l.el);
      let R = [1, 0, b.x, 0, 1, b.y, 0, 0, 1];
      if (l.rot) {
        const P = slipPose(), cx = b.w / 2, cy = b.h / 2, co = Math.cos(P.ang), si = Math.sin(P.ang);
        R = [co, -si, b.x + cx + P.tx - (co * cx - si * cy), si, co, b.y + cy + P.ty - (si * cx + co * cy), 0, 0, 1];
        l.key = P.key;
      }
      m = mul3(R, L0);
    }
    gl.viewport(0, 0, cw, bh);
    gl.uniformMatrix3fv(u('uM'), false, colMajor(m));
    gl.uniform1i(u('uMode'), l.mode);
    gl.uniform1f(u('uT'), t);
    gl.uniform1f(u('uSkyR'), narrow ? 220 : 340);
    gl.uniform4f(u('uCalm'), calm[0], calm[1], calm[2], 0);
    const drift = 6 * Math.sin(t / 500);   // the sun moves a few pixels a minute
    for (let i = 0; i < 3; i++) {
      const P = PJ[i], on = P && l.pj.includes(i);
      const hi = P ? mul3(P.hi, [1, 0, -drift, 0, 1, drift * .35, 0, 0, 1]) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
      gl.uniformMatrix3fv(u(`uHi[${i}]`), false, colMajor(hi));
      gl.uniform4f(u(`uA[${i}]`), P ? P.A[0] : 0, P ? P.A[1] : 0, on ? P.A[2] : 0, on ? P.A[3] : 0);
      gl.uniform4f(u(`uB[${i}]`), ...(P ? P.B : [1, .5, 1, 0]));
      gl.uniform1f(u(`uSg[${i}]`), P ? P.sg : 1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    l.L.g.drawImage(glc, 0, glc.height - bh, cw, bh, 0, y0, cw, bh);
    l.at = performance.now();
  }
  function drawAll(t) { for (const k of order) draw(LAY[k], t); }

  // ---------- time, visibility, resize ----------
  const t0 = performance.now();
  const T = () => (reduced ? 0 : 40 + (performance.now() - t0) / 1000);
  let started = false, raf = 0, rr = 0;
  const io = new IntersectionObserver((es) => {
    for (const e of es) for (const k of order) if (LAY[k].el === e.target) LAY[k].vis = e.isIntersecting;
  }, { rootMargin: '25% 0px' });
  for (const k of order) if (LAY[k] !== LAY.paper) io.observe(LAY[k].el);

  function relayout() {
    if (!started) return;
    try { layout(); drawAll(T()); } catch (e) { fail(); }
  }
  const ro = new ResizeObserver(relayout);
  addEventListener('resize', () => requestAnimationFrame(relayout));

  function tick() {
    raf = 0;
    if (!started || document.hidden) return;
    const t = T(), now = performance.now();
    // the slip slides in with the scroll: its light is redrawn with its pose, so it stays on the page's
    if (LAY.slip.vis && slipPose().key !== LAY.slip.key) draw(LAY.slip, t);
    else if (!reduced) {
      // the afternoon: one visible layer redrawn per frame, each about eight times a second
      for (let n = 0; n < order.length; n++) {
        rr = (rr + 1) % order.length;
        const l = LAY[order[rr]];
        if (!l.vis || now - (l.at || 0) < 120) continue;
        if (l === LAY.paper) { const k = l.ch / l.bh; draw(l, t, (scrollY - innerHeight * .5) * k, (scrollY + innerHeight * 1.5) * k); } else draw(l, t);
        break;
      }
    }
    raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf && started && !document.hidden) raf = requestAnimationFrame(tick); };
  document.addEventListener('visibilitychange', run);
  RM.addEventListener('change', () => { reduced = RM.matches; if (started) drawAll(T()); run(); });

  function fail() {
    cancelAnimationFrame(raf); raf = 0; started = false;
    ro.disconnect(); io.disconnect();
    made.forEach((c) => c.remove());
    root.classList.add('light-off');
  }

  // ---------- start: once the fonts are in and the page is shown, the sun comes in ----------
  const fontsIn = () => new Promise((res) => {
    const t1 = performance.now();
    const check = () => (!root.classList.contains('fonts-wait') || performance.now() - t1 > 3500 ? res() : requestAnimationFrame(check));
    check();
  });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fontsIn).then(() => {
    try {
      started = true;
      layout();
      drawAll(T());
    } catch (e) { fail(); return; }
    ro.observe($('main') || document.body);
    requestAnimationFrame(() => {
      for (const c of made) {
        if (!reduced) c.style.transition = 'opacity 1.1s cubic-bezier(.4, 0, .2, 1)';
        c.style.opacity = '1';
      }
      setTimeout(() => { for (const c of made) c.style.transition = ''; }, 1300);
      run();
    });
  });
})();
