/* The portfolio's Contact page, built by outils/contact-build.py from the review piste « L’empreinte »
   (contact-pistes/p-empreinte.js): edit the piste, then rebuild.
   « L’empreinte », v2: the address as a letterpress impression, in the light of Metz at this moment.
   The page is a sheet of thick mould-made cotton. The address is debossed across it (blind on white cotton, opaque
   white ink on black cotton) and the @ is hot-foil stamped in Corail metal. The sheet lies on a desk by a south window,
   beyond the top of the screen: the sun (NOAA position, real azimuth and elevation) throws the window's patch across it,
   crossed by the soft shadows of the mullion and the transom; the sky lights the rest, cooler. After sunset the twilight,
   then the blue hour; after civil dusk a desk lamp, its pool cut by the shade. The impression is the Copy button: the
   platen comes down again.
   WebGL2, drawn on demand only (arrival, strike, theme, resize, the light once a minute): no frame at rest. The paper's
   fine relief is baked once per canvas size; each frame only lights it.
   Capture parameters, read only by this piste: ?heure=HH:MM forces Metz's time, ?arrivee=0..1 freezes the arrival,
   ?gl=0 shows the CSS fallback, ?mesure=1 records GPU times. Review: window.EMPREINTE.setHeure('HH:MM' | null). */
(function () {
  'use strict';

  /* ---------- What the piste took from the review bench's kit (kit.js), on the portfolio's page ---------- */
  const CK = (function () {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ICONS = {
      arrow: '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
      copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
      check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    };
    const ico = (n, cls = 'ico') => `<svg class="${cls}${n === 'arrow' ? ' go' : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    function toast(msg) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('is-on');
      clearTimeout(toast.t);
      toast.t = setTimeout(() => t.classList.remove('is-on'), 2200);
    }
    async function copy(text, opts = {}) {
      const { select = null, quiet = false, done = 'Email address copied', fallback = 'Address selected: press Ctrl+C to copy' } = opts;
      try { await navigator.clipboard.writeText(text); if (!quiet) toast(done); return true; }
      catch (e) {
        if (select) { const r = document.createRange(); r.selectNodeContents(select); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        if (!quiet) toast(fallback);
        return false;
      }
    }
    const mailto = () => 'mailto:' + window.SITE.email;
    // the portfolio always sets data-theme (light unless the visitor chose dark) and says so with mg:theme
    const isDark = () => document.documentElement.dataset.theme === 'dark';
    function onTheme(fn) { document.addEventListener('mg:theme', fn); return () => document.removeEventListener('mg:theme', fn); }
    const token = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();
    return { esc, ico, ICONS, get REDUCE() { return mqReduce.matches; }, toast, copy, mailto, isDark, onTheme, token };
  })();

  const ID = 'empreinte';
  const QS = new URLSearchParams(location.search);
  const LAT = 49.1193, LON = 6.1757;
  const RAD = Math.PI / 180;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const mix3 = (a, b, t) => [0, 1, 2].map((i) => mix(a[i], b[i], t));

  /* ---------- The sun over Metz: NOAA's solar position equations ---------- */
  function solar(ms) {
    const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
    const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Mr = M * RAD;
    const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
    const om = (125.04 - 1934.136 * T) * RAD;
    const lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(om)) * RAD;
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = (eps0 + 0.00256 * Math.cos(om)) * RAD;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lam));
    const y = Math.tan(eps / 2) ** 2, L0r = L0 * RAD;
    const eqt = (4 / RAD) * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
    return { decl, eqt };
  }
  /* Azimuth (degrees from north, clockwise) and apparent elevation (with NOAA's refraction) at an instant. */
  function sunAt(ms) {
    const { decl, eqt } = solar(ms);
    const utcMin = (((ms % 86400000) + 86400000) % 86400000) / 60000;
    let tst = (utcMin + eqt + 4 * LON) % 1440;
    if (tst < 0) tst += 1440;
    const ha = tst / 4 - 180;
    const lat = LAT * RAD;
    const cz = clamp(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha * RAD), -1, 1);
    const zen = Math.acos(cz);
    const den = Math.cos(lat) * Math.sin(zen);
    let az = 180;
    if (Math.abs(den) > 1e-9) {
      const a = Math.acos(clamp((Math.sin(lat) * cz - Math.sin(decl)) / den, -1, 1)) / RAD;
      az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
    }
    const el0 = 90 - zen / RAD;
    let r = 0;
    if (el0 <= 85) {
      const te = Math.tan(el0 * RAD);
      if (el0 > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
      else if (el0 > -0.575) r = 1735 + el0 * (-518.2 + el0 * (103.4 + el0 * (-12.79 + el0 * 0.711)));
      else r = -20.772 / te;
    }
    return { az, el: el0 + r / 3600 };
  }
  /* The UTC instant of a Metz calendar day when the sun's centre reaches a zenith angle (sign -1 morning, +1 evening). */
  function crossAt(y, m, d, zen, sign) {
    const day0 = Date.UTC(y, m - 1, d);
    let t = day0 + 12 * 3600000;
    for (let k = 0; k < 3; k++) {
      const { decl, eqt } = solar(t);
      const lat = LAT * RAD;
      const c = Math.cos(zen * RAD) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
      if (c < -1 || c > 1) return null;
      const noon = 720 - 4 * LON - eqt;
      t = day0 + (noon + sign * 4 * Math.acos(c) / RAD) * 60000;
    }
    return t;
  }
  /* A day's events: civil dawn and dusk (zenith 96°), the blue hour's middle (95°), sunrise and sunset (90.833°). */
  function eventsOn(y, m, d) {
    return {
      dawn: crossAt(y, m, d, 96, -1), rise: crossAt(y, m, d, 90.833, -1),
      set: crossAt(y, m, d, 90.833, 1), dusk: crossAt(y, m, d, 96, 1), blue: crossAt(y, m, d, 95, 1),
    };
  }

  /* ---------- Metz's wall clock ---------- */
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  function wall(ms) {
    const p = {};
    for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
  }
  const offsetMin = (ms) => { const w = wall(ms); return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - ms) / 60000); };
  // a time in a sentence, kept on the line of the word before it
  const hm = (ms) => { const w = wall(ms); return ` ${w.h}:${String(w.mi).padStart(2, '0')}`; };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* 'HH:MM' -> today's instant in Metz at that time. */
  function instantOf(hhmm) {
    const q = /^(\d{1,2})[:h](\d{2})$/.exec(hhmm || '');
    if (!q || +q[1] > 23 || +q[2] > 59) return null;
    const w = wall(Date.now());
    const guess = Date.UTC(w.y, w.m - 1, w.d, +q[1], +q[2]);
    return guess - offsetMin(guess) * 60000;
  }
  const hhmmOf = (ms) => { const w = wall(ms); return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`; };

  /* ---------- The light at an instant: two scenes only, the day and the evening ----------
     Both keep the window's two panes of light across the sheet; the page is never left in the dark. Metz's real
     sunrise and sunset choose the scene. */
  const SCENES = {
    day: { az: 222, el: 10 },       // a clear afternoon sun: the two panes slanted, a light warmth
    evening: { az: 240, el: 2.2 },  // the last sun of the day: long rosy panes
  };
  function lightAt(t) {
    const w = wall(t);
    const ev = eventsOn(w.y, w.m, w.d);
    const isDay = ev.rise != null && ev.set != null ? t >= ev.rise && t <= ev.set : sunAt(t).el > -0.833;
    const mode = isDay ? 'day' : 'evening';
    let rise = ev.rise;
    if (rise != null && t > rise) { const n = wall(t + 86400000); rise = eventsOn(n.y, n.m, n.d).rise; }
    const caption = isDay
      ? `This page is lit by the sun over Metz. It sets at${hm(ev.set)}.`
      : `The sun has set over Metz, but this page keeps its last light. It rises at${hm(rise)}.`;
    return { t, mode, pm: !isDay, az: SCENES[mode].az, el: SCENES[mode].el, caption };
  }

  /* ---------- Shaders ---------- */
  const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const NOISE = `
// integer hash (PCG-like): a sine hash loses precision on large coordinates and draws bands
float hash(vec2 p) { uvec2 q = uvec2(ivec2(floor(p)) + 32768); uint v = q.x * 1664525u + q.y * 1013904223u; v ^= v >> 16u; v *= 0x7feb352du; v ^= v >> 15u; v *= 0x846ca68bu; v ^= v >> 16u; return float(v) * (1.0 / 4294967295.0); }
vec2 grd(vec2 i) { float a = hash(i) * 6.2831853; return vec2(cos(a), sin(a)); }
// gradient noise with its derivatives (value noise shows its grid under raking light)
vec3 gnd(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = grd(i), gb = grd(i + vec2(1, 0)), gc = grd(i + vec2(0, 1)), gd = grd(i + vec2(1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1, 0)), vc = dot(gc, f - vec2(0, 1)), vd = dot(gd, f - vec2(1, 1));
  float k = va - vb - vc + vd;
  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (vec2(vb - va, vc - va) + u.yx * k);
  return vec3(v, d);
}
const mat2 R1 = mat2(0.8, -0.6, 0.6, 0.8), R2 = mat2(0.28, -0.96, 0.96, 0.28);
`;

  /* The paper's fine relief, baked once per canvas size: the felt of a mould-made sheet and its couched fibres.
     Output (RGBA8): slope x and y (0.5 = flat, full range +-SLOPE css px per css px), albedo, felt height. */
  const SLOPE = 0.9;
  const FS_BAKE = `#version 300 es
precision highp float;
precision highp int;
uniform float uDpr, uOct, uFelt, uFib;
uniform vec2 uRes;
out vec4 o;
${NOISE}
// the felt: its 1 mm tooth, a finer weave, the grain of the pulp (css px); value and slope
vec3 felt(vec2 q) {
  vec3 a = gnd(q / 10.0 + 3.1); a.yz /= 10.0;
  vec3 b = gnd(R1 * q / 4.4 + 7.7); b.yz = transpose(R1) * b.yz / 4.4;
  vec3 c = gnd(R2 * q / 2.0 + 1.3); c.yz = transpose(R2) * c.yz / 2.0;
  vec3 d = gnd(R1 * q / 1.05 + 5.2); d.yz = transpose(R1) * d.yz / 1.05;
  return 0.50 * a + 0.30 * b + 0.17 * c + 0.07 * uOct * d;
}
// couched fibres: short bent strands lying in the surface, a little raised and a little lighter
vec3 fibres(vec2 q, out float lift) {
  const float C = 5.0;
  vec2 ci = floor(q / C);
  vec3 acc = vec3(0.0);
  lift = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 c = ci + vec2(float(i), float(j));
    if (hash(c + 711.0) > 0.78) continue;
    vec2 ctr = (c + vec2(hash(c + 13.0), hash(c + 29.0))) * C;
    float a = hash(c + 47.0) * 3.14159265;
    float hl = 0.5 * (3.0 + 14.0 * pow(hash(c + 61.0), 1.8));
    vec2 dir = vec2(cos(a), sin(a)), nrm = vec2(-dir.y, dir.x);
    vec2 dq = q - ctr;
    float t = dot(dq, dir);
    if (abs(t) > hl) continue;
    float tt = t / hl;
    float bend = (hash(c + 83.0) - 0.5) * 0.7 * hl;
    float off = dot(dq, nrm) - bend * (1.0 - tt * tt);
    float wid = 0.5 + 0.4 * hash(c + 97.0);
    float x = off / wid;
    if (abs(x) >= 1.0) continue;
    float taper = smoothstep(hl, hl - 1.4, abs(t));
    float k = 1.0 - x * x;
    float ht = (0.3 + 0.7 * hash(c + 101.0)) * taper;
    acc.x += ht * k * k;
    acc.yz += ht * (2.0 * k * (-2.0 * x / wid)) * (nrm + bend * 2.0 * tt / hl * dir);
    lift += ht * k;
  }
  return acc;
}
void main() {
  vec2 base = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 sl = vec2(0.0);
  float alb = 0.0, fh = 0.0;
  // supersampled once and for all: no aliasing of the fibres at density 1
  int N = uDpr < 1.5 ? 4 : 2;
  for (int k = 0; k < 4; k++) {
    if (k >= N) break;
    vec2 j = N == 4 ? vec2(float(k & 1), float(k >> 1)) * 0.5 - 0.25 : vec2(float(k) * 0.5 - 0.25, 0.25 - float(k) * 0.5) * 0.7;
    vec2 q = (base + j) / uDpr;
    vec3 f = felt(q);
    float lift;
    vec3 b = fibres(q, lift);
    sl += uFelt * f.yz + uFib * b.yz;
    alb += 0.022 * (0.6 * gnd(q / 46.0 + 11.0).x + 0.4 * gnd(R2 * q / 17.0 + 5.0).x) + 0.02 * uFib / 0.12 * min(lift, 1.2);
    fh += 0.5 + 0.9 * f.x;
  }
  sl /= float(N); alb /= float(N); fh /= float(N);
  float dth = (hash(gl_FragCoord.xy + 5.0) - 0.5) / 255.0;
  o = vec4(clamp(0.5 + sl / (2.0 * ${SLOPE.toFixed(2)}) + dth, 0.0, 1.0), clamp(0.5 + alb * 5.0 + dth, 0.0, 1.0), clamp(fh + dth, 0.0, 1.0));
}`;

  const FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uPT;   // the plate: height at full press (css px), its slope x and y, signed distance (css px, > 0 inside)
uniform sampler2D uFT;   // the paper's fine relief, baked at the canvas's pixels
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uPlate;     // the plate texture's rectangle, css px: x0 y0 w h
uniform vec4 uAt, uSig;  // the foil's box, the signature's box (css px: x0 y0 x1 y1)
uniform float uFade;     // the sheet fades into the page under the header (css px)
uniform float uPress, uFoil, uInk, uDepth, uBev;
uniform vec3 uSunL, uSunC;   // toward the sun (x right, y down, z up); colour x intensity
uniform float uSunA;         // the sun's apparent radius in the relief's shadows (tan)
uniform float uOpen;          // the shutters: 0 closed, 1 open (the window's panes widen from the mullion)
uniform vec4 uGW, uGB, uGP;  // the window: opening (u0 u1 v0 v1), bars (mullion u, half width, transom v, half height),
uniform float uGX, uGPen;    //   projection (wall y, unit, shear, tan of the elevation); its centre x; its penumbra
uniform vec3 uSkyP, uSkyC;   // the window's centre (css px, z above the sheet); the sky's light at the reference point
uniform vec2 uSkyF;          // the sky's falloff away from the wall and along it
uniform vec3 uLampP, uLampC;  // the lamp: its bulb (css px, z above the sheet), colour x intensity
uniform vec4 uLampK;          // its reflector throws forward (1/cos^k); the shade's rim cuts the pool: y at the lamp's x, curvature, softness
uniform float uLampA;
uniform vec3 uAmb, uRoom;    // the room's bounce; what the foil mirrors overhead
uniform vec4 uPlaten;        // the platen's footprint (css px: x0 y0 x1 y1)
uniform vec2 uPlZ;           // its height above the sheet (css px), its weight
uniform vec3 uPlO;           // its shadow's shift per unit of height (away from the main light), its blur per unit of height
uniform vec3 uPaper, uDesk, uCoral, uInkC;
uniform vec3 uExpo;
uniform float uKnee, uFine, uCockle, uSheen, uRough;
out vec4 o;
${NOISE}
vec4 plate(vec2 q) {
  vec2 uv = (q - uPlate.xy) / uPlate.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, -64.0);
  return textureLod(uPT, uv, 0.0);
}
float plateH(vec2 q) { vec2 uv = (q - uPlate.xy) / uPlate.zw; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : uPress * textureLod(uPT, uv, 0.0).r; }
float plateS(vec2 q) { vec2 uv = (q - uPlate.xy) / uPlate.zw; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? -64.0 : textureLod(uPT, uv, 0.0).a; }
float inBox(vec2 p, vec4 b) { return step(b.x, p.x) * step(p.x, b.z) * step(b.y, p.y) * step(p.y, b.w); }
float sst(float x, float r) { return smoothstep(-r, r, x); }
// a band of half width w around 0, seen through a blur of radius r: the box convolved, so a thin bar fades as it blurs
float band(float x, float w, float r) { return sst(x + w, r) - sst(x - w, r); }
float rectSoft(vec2 q, vec4 b, float r) { return (sst(q.x - b.x, r) - sst(q.x - b.z, r)) * (sst(q.y - b.y, r) - sst(q.y - b.w, r)); }

// the window's opening across (u0, u1): the shutters fold back from the mullion, each leaf uncovering its pane
vec2 openU() { float k = uOpen; return vec2(mix(uGB.x, uGW.x, k), mix(uGB.x, uGW.y, k)); }
// the window's patch: how much of the sun a point of the sheet sees through the opening, between the bars
float gobo(vec2 p) {
  float d = (p.y - uGP.x) / uGP.y;
  if (d <= 0.0) return 0.0;
  float u = (p.x - uGX) / uGP.y + d * uGP.z;
  float v = d * uGP.w;
  float r = d * uGPen + 0.003;       // the farther from the window, the softer
  vec2 wu = openU();
  float m = band(u - 0.5 * (wu.x + wu.y), 0.5 * (wu.y - wu.x), r) * band(v - 0.5 * (uGW.z + uGW.w), 0.5 * (uGW.w - uGW.z), r);
  m *= 1.0 - band(u - uGB.x, uGB.y, r);
  m *= 1.0 - band(v - uGB.z, uGB.w, r);
  return m;
}
// the sky through the window: brightest near the wall, falling off away from it and along it
float skyFall(vec2 p) {
  vec2 q = vec2((p.x - uSkyP.x) / uSkyF.y, (p.y - uSkyP.y) / uSkyF.x);
  return 1.0 / ((1.0 + q.y * q.y) * sqrt(1.0 + q.x * q.x));
}
// the fine relief under a light: a bounded relative change, so raking light raises the grain without turning it to stucco
float fineMod(vec2 g, vec3 L, float amp) {
  float x = -dot(g, L.xy) / max(L.z, 0.03);
  return 1.0 + amp * tanh(x / amp);
}
// light seen from a point at the bottom of the impression: through the flat floor by the distance field, then across
// the bevel in fine steps; the clearance over the wall gives a penumbra as wide as the light (no noise, no streaks)
float vis(vec2 p, float h, vec3 L, float tanA) {
  if (h > -0.02 || L.z <= 0.0) return 1.0;
  float lxy = length(L.xy);
  if (lxy < 1e-4) return 1.0;
  vec2 d = L.xy / lxy;
  float rise = L.z / lxy;
  float t = 0.0, hb = 0.5 * uBev;
  for (int i = 0; i < 10; i++) {
    float st = plateS(p + d * t) - hb;
    if (st < 0.3) break;
    t += st;
  }
  float res = 1e3;
  // fine steps, started on a fixed lattice along the ray so neighbouring pixels sample the wall alike (no stair-steps)
  float dt = 0.22;
  t = max(0.0, floor(t / dt) * dt - dt);
  for (int i = 0; i < 48; i++) {
    float hr = h + rise * t;
    if (hr > 0.2 * uDepth * uPress + 0.05) break;
    float hq = plateH(p + d * t);
    // only what stands above the point occludes it: the floor it starts on is not a wall (counting it drew a
    // darker band of fixed width along every wall, read as an inline)
    if (hq > h + 0.015) res = min(res, (hr - hq) / (t * tanA + 0.55 * rise + 0.02));
    t += dt;
  }
  return smoothstep(-1.0, 1.0, res);
}
float ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
// a light's specular lobe (scalar, without Fresnel), stretched along the foil's grain when an > 0
float lobe(vec3 n, vec3 L, float rough, float an) {
  vec3 Hh = normalize(L + vec3(0, 0, 1));
  float nl = max(dot(n, L), 0.0);
  if (nl <= 0.0) return 0.0;
  float nh = max(dot(n, Hh), 0.0), nv = max(n.z, 0.25);
  float a = rough * rough;
  float D = ggx(nh, a);
  if (an > 0.0) {
    vec3 t = normalize(vec3(1, 0, 0) - n * n.x), b = cross(n, t);
    float ax = a * (1.0 - 0.5 * an), ay = a * (1.0 + 0.8 * an);
    float th = dot(t, Hh), bh = dot(b, Hh);
    float dd = th * th / (ax * ax) + bh * bh / (ay * ay) + nh * nh;
    D = mix(D, 1.0 / (3.14159 * ax * ay * dd * dd), an);
  }
  float kk = a * 0.5;
  float G = (nl / (nl * (1.0 - kk) + kk)) * (nv / (nv * (1.0 - kk) + kk));
  return D * G / (4.0 * nv);
}
// a long shoulder above the knee: the sun's patch keeps its grain instead of burning to white
vec3 tone(vec3 x) { vec3 k = vec3(uKnee); vec3 u = max(x - k, 0.0); return mix(x, k + u / (1.0 + u / (1.0 - k)), step(k, x)); }
vec3 enc(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  float sheet = smoothstep(0.0, uFade, p.y);
  if (sheet <= 0.0) { o = vec4(enc(uDesk), 1.0); return; }

  // ---- matter
  vec4 F = texelFetch(uFT, ivec2(gl_FragCoord.xy), 0);
  vec2 gf = (F.xy - 0.5) * ${(2 * SLOPE).toFixed(2)};
  float albF = 1.0 + (F.z - 0.5) * 0.2;
  float feltH = F.w;
  vec4 P = plate(p);
  float s = P.w;
  float h = uPress * P.x;
  vec2 gm = uPress * P.yz;
  float pr = clamp(-P.x / max(uDepth, 1e-3), 0.0, 1.0) * clamp(uPress, 0.0, 1.0);
  // the sheet's cockle: long low waves, seen only when the light rakes
  vec3 c1 = gnd(p / 300.0 + 4.7), c2 = gnd(R2 * p / 120.0 + 8.1);
  vec2 gc = uCockle * (c1.yz / 300.0 + 0.4 * (transpose(R2) * c2.yz) / 120.0);
  float inAt = inBox(p, uAt), inSig = inBox(p, uSig);
  float rag = gnd(p / 1.4 + 17.0).x;
  float foil = uFoil * inAt * smoothstep(-0.4, 0.4, s + 0.22 * rag);
  float ink = uInk * (1.0 - inAt) * (1.0 - inSig) * smoothstep(-0.6, 0.6, s + 0.3 * uBev + 0.1 * rag);
  // the press flattens the felt; the ink film fills its valleys; the foil irons it down
  float keep = mix(1.0, 0.36, pr);
  keep = mix(keep, 0.5, ink);
  keep = mix(keep, 0.16, foil);
  vec2 gF = uFine * keep * gf;
  vec3 n = normalize(vec3(-(gm + gc), 1.0));
  vec3 nS = normalize(vec3(-gm, 1.0));   // the sky is too broad to show the cockle
  vec3 alb = uPaper * albF * (1.0 - 0.035 * pr);
  // opaque white ink, a little irregular at 1:1: thinner where the felt stands proud, a touch denser at the edges
  float mot = 0.55 * gnd(p / 7.0 + 23.0).x + 0.3 * gnd(R1 * p / 2.4 + 41.0).x;
  float inkA = ink * clamp(0.94 + 0.06 * mot - 0.1 * smoothstep(0.7, 0.98, feltH) + 0.03 * smoothstep(1.2, 0.2, s), 0.0, 1.0);
  alb = mix(alb, uInkC, inkA);
  vec3 P3 = vec3(p, h);
  float ao = 1.0 - 0.09 * pr * (1.0 - smoothstep(0.0, 2.6 * uBev, s));

  // ---- the platen's shadow, from each light
  // one soft shadow, cast away from the main light: it sharpens and darkens as the platen comes down
  float occ = 0.0;
  if (uPlZ.y > 0.0) occ = uPlZ.y * rectSoft(p - uPlO.xy * uPlZ.x, uPlaten, 18.0 + uPlZ.x * uPlO.z);
  // a direct light is dimmed more than the sky and the room
  float occS = min(1.0, 1.5 * occ), occL = occS, occK = occ, occA = occ;

  // ---- light
  vec3 E = vec3(0.0), S = vec3(0.0);
  // the sky, a large soft source at the window
  vec3 Ls = normalize(uSkyP - P3);
  // a window's sky is a broad but directional light: it models the walls like a portrait lit by a window
  float skyN = (0.12 + 0.88 * max(dot(nS, Ls), 0.0)) / (0.12 + 0.88 * Ls.z);
  float skyV = h < -0.02 ? mix(1.0, vis(p, h, Ls, 0.28), 0.75) : 1.0;
  E += uSkyC * skyFall(p) * skyN * skyV * fineMod(gF, Ls, 0.14) * ao * (1.0 - occK);
  // the room's bounce
  E += uAmb * ao * (0.8 + 0.2 * nS.z) * (1.0 - occA);
  // the sun through the window
  vec3 sunLit = vec3(0.0);
  if (uSunC.r + uSunC.g + uSunC.b > 0.0) {
    float g = gobo(p) * (1.0 - occS) * smoothstep(0.0, 0.3, uOpen);
    if (g > 0.0005) {
      // in the hollows, a sun lower than 12 deg would leave only thin lit wedges between long shadows (it reads as
      // hatching): the hollows' shadows take the sun at 12 deg at least, the paper keeps the true raking light
      vec3 sunH = uSunL.z < 0.2079 ? vec3(normalize(uSunL.xy + 1e-6) * 0.9781, 0.2079) : uSunL;
      float v = vis(p, h, sunH, uSunA);
      sunLit = uSunC * g * v;
      E += sunLit * max(dot(n, uSunL), 0.0) * fineMod(gF, uSunL, 0.34);
    }
  }
  // the desk lamp: inverse square, the shade's soft cut
  vec3 Ll = vec3(0, 0, 1), lampLit = vec3(0.0);
  if (uLampC.r + uLampC.g + uLampC.b > 0.0) {
    vec3 lv = uLampP - P3;
    float r2 = dot(lv, lv);
    Ll = lv * inversesqrt(r2);
    float dx = p.x - uLampP.x;
    float yc = uLampK.y - uLampK.z * dx * dx;
    float beam = pow(max(Ll.z, 0.05), -uLampK.x) * smoothstep(yc + uLampK.w, yc - uLampK.w, p.y);
    if (beam > 0.0) {
      float v = vis(p, h, Ll, uLampA);
      lampLit = uLampC * beam / r2 * v * (1.0 - occL);
      E += lampLit * max(dot(n, Ll), 0.0) * fineMod(gF, Ll, 0.38);
    }
  }
  // the cotton's sheen (black cotton shows its relief by it), the ink's slight gloss
  vec3 nF = normalize(vec3(-(gm + gc + 0.5 * gF), 1.0));
  float rough = mix(uRough, 0.64, inkA);
  float sheen = mix(uSheen, 0.35, inkA);
  S += sunLit * lobe(nF, uSunL, rough, 0.0) + lampLit * lobe(nF, Ll, rough, 0.0);
  vec3 col = alb * E + 0.04 * sheen * S;

  // ---- the foil: a coral metal mirrors the room, the window or the lamp's shade, and the lights themselves
  if (foil > 0.0) {
    // its micro-surface: a fine grain drawn along the foil's roll (anisotropic), the felt it irons, a sparse glitter
    vec3 fa = gnd(vec2(p.x / 3.2, p.y / 0.9) + 31.0);
    vec2 gG = 0.012 * vec2(fa.y / 3.2, fa.z / 0.9);
    vec2 cell = floor(p * 1.7);
    vec2 spark = hash(cell + 71.0) > 0.988 ? (vec2(hash(cell + 3.0), hash(cell + 9.0)) - 0.5) * 0.45 : vec2(0.0);
    // the foil takes the cotton's felt under it: soft blotches of reflection, the way a foil on cotton looks
    vec3 nf = normalize(vec3(-(gm + gc + 0.3 * gf + gG), 1.0));
    vec3 ng = normalize(vec3(-(gm + gc + 0.3 * gf + gG + spark), 1.0));
    // a photograph of a desk is taken from in front of it: the foil mirrors what lies toward the window
    vec3 V = normalize(vec3(0.0, 0.62, 1.0));
    vec3 R = reflect(-V, nf);
    // the room as the foil sees it: the ceiling, darker walls; the window itself on the wall beyond the top edge,
    // its cross softened by the satin finish (more along the roll's grain); the lamp's shade at night
    vec3 Ws = normalize(uSkyP - P3);
    float up = 0.45 + 0.55 * smoothstep(-0.2, 1.0, R.z);
    vec3 env = uRoom * up * (1.0 + 0.8 * dot(R.xy, normalize(Ws.xy + 1e-5)));
    if (R.y < -0.02) {
      float t = (uGP.x - P3.y) / R.y;
      vec2 q = vec2((P3.x + R.x * t - uGX) / uGP.y, (P3.z + R.z * t) / uGP.y);
      float r = 0.02 + 0.075 * t / uGP.y;
      vec2 wu = openU();
      float wv = band(q.x - 0.5 * (wu.x + wu.y), 0.5 * (wu.y - wu.x), 1.8 * r) * band(q.y - 0.5 * (uGW.z + uGW.w), 0.5 * (uGW.w - uGW.z), r);
      wv *= (1.0 - band(q.x - uGB.x, uGB.y, 1.8 * r)) * (1.0 - band(q.y - uGB.z, uGB.w, r));
      env += uSkyC * wv * 2.2 * (1.0 - occK);
    }
    if (uLampC.r + uLampC.g + uLampC.b > 0.0) {
      float aL = acos(clamp(dot(R, Ll), -1.0, 1.0));
      env += uLampC / dot(uLampP - P3, uLampP - P3) * exp(-aL * aL / 0.05) * 2.6 * (1.0 - occL);
    }
    vec3 spec = sunLit * lobe(ng, uSunL, 0.3, 0.7) + lampLit * lobe(ng, Ll, 0.32, 0.7);
    // the die squeezes the foil's very edge: a satin, darker rim
    float rim = 1.0 - 0.22 * smoothstep(1.6, 0.2, s);
    vec3 fcol = uCoral * (max(env, 0.0) * (1.0 - occA) + spec) * rim;
    col = mix(col, fcol, foil);
  }

  col = tone(col * uExpo);
  vec3 c = enc(mix(uDesk, col, sheet));
  // dither: no banding in the slow falloffs
  c += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 41.0) - 1.0) * 0.9 / 255.0;
  o = vec4(c, 1.0);
}`;

  /* ---------- The plate: the address drawn at 2x, a signed distance field, a smoothed height and its slopes ----------
     computePlate is self-contained: it runs in a worker (no long task on the page), or here if workers are refused. */
  function computePlate(job) {
    const INF = 1e20;
    const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
    function edt1(f, n, d, v, z) {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    }
    // distance from each texel to the other side of the outline (Felzenszwalb), with the antialiased edge's sub-texel offset
    function dist(a, w, h, inside) {
      const g = new Float32Array(w * h);
      for (let i = 0; i < g.length; i++) g[i] = (inside ? a[i] < 0.5 : a[i] >= 0.5) ? 0 : INF;
      const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
      for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
      for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]); }
      for (let i = 0; i < g.length; i++) g[i] = Math.max(0, g[i] + (inside ? a[i] - 0.5 : 0.5 - a[i]));
      return g;
    }
    function blur(a, w, h, sig) {
      const r = Math.ceil(sig * 3), k = [];
      let sum = 0;
      for (let i = -r; i <= r; i++) { const x = Math.exp(-(i * i) / (2 * sig * sig)); k.push(x); sum += x; }
      for (let i = 0; i < k.length; i++) k[i] /= sum;
      const t = new Float32Array(a.length);
      for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) { let v = 0; for (let j = -r; j <= r; j++) v += k[j + r] * a[o + clampN(x + j, 0, w - 1)]; t[o + x] = v; } }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let j = -r; j <= r; j++) v += k[j + r] * t[clampN(y + j, 0, h - 1) * w + x]; a[y * w + x] = v; }
    }
    // the bevel's profile across the edge (u: 0 where the paper breaks, 1 on the floor): a clean break at the top, then
    // a curve easing into a soft fillet (a constant ramp shades as a flat grey band, like a drawn outline); the paper pushed
    // aside rises in a low lip just outside the break
    const prof = (u) => { u = clampN(u, 0, 1); const v = 1 - u; return 0.5 * u * u * u * (u * (6 * u - 15) + 10) + 0.5 * (1 - v * v * v); };
    const { a, tw, th, S, lim, sg } = job;
    const din = dist(a, tw, th, true), dout = dist(a, tw, th, false);
    const sd = new Float32Array(tw * th), hh = new Float32Array(tw * th);
    for (let i = 0; i < a.length; i++) sd[i] = clampN((din[i] - dout[i]) / S, -lim, lim);
    // the distance field from a thresholded raster keeps one-texel stairs on shallow curves: the foil's edge and the
    // ink's followed them (a jagged @); smoothed once, every iso-line is a clean curve
    blur(sd, tw, th, 1.1);
    for (let i = 0; i < a.length; i++) {
      const s = sd[i];
      const px = i % tw, py = (i / tw) | 0;
      const isSig = sg && px >= sg.x0 && px <= sg.x1 && py >= sg.y0 && py <= sg.y1;
      const D = isSig ? sg.depth : job.depth, bv = isSig ? sg.bev : job.bev;
      const lip = (s + 0.75 * bv) / (0.75 * bv);
      hh[i] = -D * prof(s / bv + 0.5) + 0.04 * D * Math.exp(-lip * lip);
    }
    // a light blur: the distance field keeps sub-texel steps that would streak a raking light
    blur(hh, tw, th, Math.max(1.3, 0.15 * job.bev * S));   // at the bevel's scale: inner corners rounded, no crease
    const out = new Float32Array(tw * th * 4);
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const i = py * tw + px;
        const xl = hh[py * tw + Math.max(0, px - 1)], xr = hh[py * tw + Math.min(tw - 1, px + 1)];
        const yu = hh[Math.max(0, py - 1) * tw + px], yd = hh[Math.min(th - 1, py + 1) * tw + px];
        out[i * 4] = hh[i];
        out[i * 4 + 1] = (xr - xl) * S / 2;
        out[i * 4 + 2] = (yd - yu) * S / 2;
        out[i * 4 + 3] = sd[i];
      }
    }
    return { data: out, tw, th, rect: job.rect, key: job.key, id: job.id };
  }
  const hasLS = (() => { try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();
  const FONT = (px, wt = 600) => `${wt} ${px}px Onest, "Segoe UI", system-ui, sans-serif`;
  const TRACK = 0.004;   // a hair open: the bevels need room between the letters

  function measure(ctx, text, px, wt = 600, track = TRACK) {
    ctx.font = FONT(px, wt);
    if (hasLS) ctx.letterSpacing = (track * px) + 'px';
    const m = ctx.measureText(text);
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, adv: m.width };
  }

  /* The address (and the proof's signature) drawn at 2x: the coverage the distance field is built from. */
  function rasterPlate(L) {
    const S = 2;
    const pad = Math.ceil(L.bev * 1.6 + 6);
    const B = { x0: L.box.x0, y0: L.box.y0, x1: L.box.x1, y1: L.box.y1 };
    if (L.sig) { B.x0 = Math.min(B.x0, L.sig.x0); B.y0 = Math.min(B.y0, L.sig.y0); B.x1 = Math.max(B.x1, L.sig.x1); B.y1 = Math.max(B.y1, L.sig.y1); }
    const x0 = Math.floor(B.x0 - pad), y0 = Math.floor(B.y0 - pad);
    const w = Math.ceil(B.x1 + pad) - x0, h = Math.ceil(B.y1 + pad) - y0;
    const tw = w * S, th = h * S;
    const cv = document.createElement('canvas');
    cv.width = tw; cv.height = th;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    x.font = FONT(L.size * S);
    if (hasLS) x.letterSpacing = (TRACK * L.size * S) + 'px';
    for (const ln of L.lines) x.fillText(ln.text, (ln.x - x0) * S, (ln.base - y0) * S);
    if (L.sig) {
      x.font = FONT(L.sig.px * S, 500);
      if (hasLS) x.letterSpacing = (0.01 * L.sig.px * S) + 'px';
      x.fillText(L.sig.text, (L.sig.x - x0) * S, (L.sig.base - y0) * S);
    }
    const all = x.getImageData(0, 0, tw, th).data;
    const a = new Float32Array(tw * th);
    for (let i = 0; i < a.length; i++) a[i] = all[i * 4 + 3] / 255;
    const sg = L.sig ? { x0: (L.sig.x0 - 3 - x0) * S, y0: (L.sig.y0 - 3 - y0) * S, x1: (L.sig.x1 + 3 - x0) * S, y1: (L.sig.y1 + 3 - y0) * S, depth: L.sig.depth, bev: L.sig.bev } : null;
    return { a, tw, th, S, lim: L.bev * 1.6 + 5, sg, depth: L.depth, bev: L.bev, rect: [x0, y0, w, h] };
  }

  /* ---------- Materials, per theme ---------- */
  const toLin = (c) => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  function colorOf(str) {
    str = (str || '').trim();
    if (str[0] === '#') {
      let h = str.slice(1);
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return toLin([0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
    }
    const m = str.match(/[\d.]+/g);
    return m ? toLin(m.slice(0, 3).map((v) => +v / 255)) : [0.9, 0.9, 0.9];
  }
  function material(stage) {
    const dark = CK.isDark();
    return {
      dark: dark ? 1 : 0,
      paper: colorOf(CK.token('--pe-paper', stage)),
      desk: colorOf(CK.token('--bg')),
      coral: colorOf(CK.token('--accent')),
      ink: colorOf(CK.token('--pe-ink', stage)),
      // white cotton shows the relief by its shadows; black cotton by its sheen and the white ink in the hollows
      rough: dark ? 0.62 : 0.85, sheen: dark ? 0.9 : 0.5, fine: dark ? 0.5 : 1, knee: dark ? 0.86 : 0.72,
    };
  }

  /* ---------- The scene's light for the layout G (css px) ---------- */
  function scene(Lt, G, M) {
    const W = G.W, Hs = G.Hs;
    const el = Lt.el;
    // the sun, seen from the desk: the window faces south, beyond the top of the screen (east on the left)
    const off = Lt.az - 180;
    const behind = sstep(84, 97, Math.abs(off));                  // gone round behind the window's wall
    const shear = Math.tanh(Math.tan(clamp(off, -89, 89) * RAD));  // the patch's slant, eased at the extremes
    const dA = Math.atan(shear);
    const elR = Math.max(el, 0.8) * RAD;
    const sunL = [Math.cos(elR) * Math.sin(dA), -Math.cos(elR) * Math.cos(dA), Math.sin(elR)];
    const e0 = Math.max(el, 0);
    const am = 1 / (Math.sin(e0 * RAD) + 0.50572 * (e0 + 6.07995) ** -1.6364);
    const tr = [0.12, 0.2, 0.36].map((k) => Math.exp(-k * am) / Math.exp(-k * 2.2));
    const lt = lum(tr);
    const sunHue = tr.map((c) => mix(1, c / lt, 0.72));
    const on = (1 - behind) * sstep(-0.8, 1.2, el);

    // the sky: its strength (relative to the day), its colour with the hour
    const skyAbs = el >= 0 ? 0.07 + 0.93 * sstep(0, 32, el) : 0.07 * Math.exp(el / 1.05);
    let skyHue;
    if (el >= 2) skyHue = mix3([0.9, 0.95, 1.09], [0.94, 0.97, 1.05], sstep(4, 30, el));
    else if (el >= -1) skyHue = mix3([1.04, 0.88, 0.98], [0.9, 0.95, 1.09], sstep(-0.5, 2, el));
    else skyHue = mix3([0.44, 0.6, 1.0], [1.04, 0.88, 0.98], sstep(-4.6, -1, el));
    const lampOn = Lt.mode === 'night' ? 1 : 0;

    // the window: its foot on the wall just beyond the sheet's top, its centre over the sheet's middle
    const unit = Hs, wallY = -0.1 * Hs, xc = W * 0.54;
    const skyP = [xc, wallY, 0.45 * Hs];
    // dusk leaves only the window: the light falls off faster from it
    const tw = sstep(1, -4.5, el) * (1 - lampOn);
    const skyF = [mix(1.0, 0.78, tw) * Hs, mix(1.7, 1.35, tw) * Hs];
    const fallAt = (x, y) => { const qy = (y - skyP[1]) / skyF[0], qx = (x - skyP[0]) / skyF[1]; return 1 / ((1 + qy * qy) * Math.sqrt(1 + qx * qx)); };
    const ref = [xc, G.fadeTop + 0.04 * Hs];
    const fRef = fallAt(ref[0], ref[1]);
    // the patch: the window projected along the sun; its elevation eased so the patch stays on the sheet
    const f = clamp(el / 62, 0, 1);
    const tanE = 0.28 + 0.5 * (1 - (1 - f) ** 1.6);
    const gp = [wallY, unit, shear, tanE / Math.cos(dA)];
    const gw = [-0.52, 0.52, 0.13, 0.7];
    const gb = [0.0, 0.019, 0.53, 0.016];   // the mullion; the transom high, under a short upper light
    const pen = Math.tan(1.5 * RAD) / (Math.cos(dA) * Math.cos(Math.atan(tanE)));

    // the lamp: a desk lamp beyond the top edge, its reflector throwing the light forward over the sheet, its shade's
    // rim cutting the pool in a soft arc across the lower page
    const lampP = [W * 0.42, -1.25 * Hs, 1.0 * Hs];
    const cutY = Math.max(G.inkBottom + 0.3 * Hs, 1.0 * Hs);
    const lampK = [2.4, cutY, 0.3 / Hs, 0.1 * Hs];
    const lampFlat = (x, y) => {
      const lv = [lampP[0] - x, lampP[1] - y, lampP[2]];
      const r2 = lv[0] * lv[0] + lv[1] * lv[1] + lv[2] * lv[2], cz = lv[2] / Math.sqrt(r2);
      const dx = x - lampP[0], yc = lampK[1] - lampK[2] * dx * dx;
      return Math.max(cz, 0.05) ** -lampK[0] * sstep(yc + lampK[3], yc - lampK[3], y) * cz / r2;
    };
    const lampHue = [1.0, 0.74, 0.47];

    // what each light gives at the reference point (the top of the sheet, flat paper, out of the patch)
    let skyC, amb, lampC = [0, 0, 0], sunC = [0, 0, 0], room;
    if (lampOn) {
      const L0 = lampFlat(ref[0], ref[1]);
      const k = 1 / L0;
      lampC = lampHue.map((c) => c * k);
      skyC = [0.36, 0.46, 0.78].map((c) => c * 0.1 / fRef);     // the night through the window, faint and cold
      amb = lampHue.map((c) => c * 0.44);                         // the lamp's light back from the walls
      room = lampHue.map((c) => c * 0.45);
    } else {
      skyC = skyHue.map((c) => c * skyAbs);
      amb = [1.0, 0.98, 0.95].map((c) => c * mix(0.25, 0.12, tw) * skyAbs * fRef);
      room = skyHue.map((c) => c * 0.9 * skyAbs * fRef);
      const R = mix(1.6, 1.1, sstep(5, 25, el)) * on;        // the patch's flat light, against the sky at the top
      const iDir = R * skyAbs * fRef / Math.max(Math.sin(elR), 0.07);
      sunC = sunHue.map((c) => c * iDir);
    }
    // the platen's shadow falls away from the main light: the sun, else the lamp, else the window
    const cx = (G.box.x0 + G.box.x1) / 2, cy = (G.box.y0 + G.box.y1) / 2;
    const toward = (P) => { const v = [P[0] - cx, P[1] - cy, P[2]]; const n = Math.hypot(...v); return v.map((c) => c / n); };
    const dom = lampOn ? toward(lampP) : on > 0.3 ? sunL : toward(skyP);
    const sh = Math.min(1.6, Math.hypot(dom[0], dom[1]) / Math.max(dom[2], 0.05)) / Math.max(Math.hypot(dom[0], dom[1]), 1e-4);
    const plO = [-dom[0] * sh, -dom[1] * sh, lampOn ? 0.3 : on > 0.3 ? 0.14 : 0.4];
    const Eref = [0, 1, 2].map((i) => skyC[i] * fRef + amb[i] + (lampOn ? lampC[i] * lampFlat(ref[0], ref[1]) : 0));
    // the exposure brings the top of the sheet to the paper's own tone (it meets the page under the header); the
    // white balance follows the light only in part, so dusk stays blue and the lamp warm
    const adapt = lampOn ? 0.68 : mix(0.15, 0.38, sstep(0, -4, el));
    const le = lum(Eref);
    const expo = Eref.map((c) => (1 / le) * (le / c) ** adapt);
    // the tone curve's knee would darken the paper a touch: lift the exposure so the reference lands on the paper
    const y = lum(M.paper), k = M.knee;
    const xNeed = y <= k ? y : k + (y - k) / (1 - (y - k) / (1 - k));
    const ex = expo.map((v) => v * xNeed / y);
    return {
      sunL, sunC, sunA: 0.009,
      gw, gb, gp, gx: xc, gpen: pen,
      skyP, skyC, skyF,
      lampP, lampC, lampK, lampA: 0.03,
      amb, room, expo: ex, plO,
    };
  }

  /* ---------- The piste ---------- */
  function mount(stage) {
    const SITE = window.SITE;
    const { esc, ico } = CK;
    const email = SITE.email;
    const [user, domain] = email.split('@');
    stage.innerHTML = `
      <section class="pe" aria-labelledby="peTitle">
        <canvas class="pe-gl" aria-hidden="true"></canvas>
        <h1 class="sr" id="peTitle">Contact</h1>
        <div class="pe-top wrap">
          <div class="pe-zone">
            <span class="pe-css" aria-hidden="true"><span>${esc(user)}</span><span><b>@</b>${esc(domain)}</span></span>
            <p class="pe-ink">
              <span class="pe-addr" id="peAddr">${esc(email)}</span>
              <button class="pe-copy" type="button" aria-describedby="peAddr">${ico('copy')}<span data-label>Copy the address</span></button>
            </p>
          </div>
        </div>
        <div class="pe-below wrap">
          <p class="pe-cap" data-caption></p>
          <div class="pe-foot">
            <div class="pe-ask">
              <p class="pe-lead">Tell me what you need, by when, and what you already have. I&nbsp;reply with questions, then a plan.</p>
              <a class="btn btn--accent pe-write" href="${esc(CK.mailto())}">Write to me ${ico('arrow')}</a>
            </div>
            <div class="pe-facts">
              <p>${esc(SITE.availability)}</p>
              <p>${esc(SITE.where)}</p>
              <p>I work in French and English.</p>
            </div>
            <ul class="pe-links">${SITE.links.map((l) => `<li><a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${ico('arrow')}</a></li>`).join('')}</ul>
          </div>
        </div>
        <p class="sr" role="status" data-live></p>
      </section>`;

    const $ = (s) => stage.querySelector(s);
    const sec = $('.pe'), zone = $('.pe-zone'), canvas = $('.pe-gl'), ink = $('.pe-ink');
    const addr = $('.pe-addr');
    const btn = $('.pe-copy'), label = $('[data-label]'), live = $('[data-live]'), cap = $('[data-caption]'), css = $('.pe-css');
    const reduce = () => CK.REDUCE;
    const MESURE = QS.get('mesure') === '1';

    let disposed = false, raf = 0, G = null, plate = null, plateKey = '', bakeT = 0, labelT = 0;
    let press = 0, light = null, full = true, override = QS.get('heure') || null, visitT = 0;
    let platenZ = 0, platenW = 0;
    // the shutters: closed at first, opened once the sheet can be drawn (a page change opens them on its cue)
    let openK = 0, opened = false;
    const mountT = performance.now();
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const now = () => (override && instantOf(override)) || Date.now();

    /* ----- WebGL ----- */
    let gl = null, prog = null, progB = null, tex = null, ftex = null, fbo = null, paperKey = '', tq = null, glReady = false, pending = [];
    const U = {}, UB = {};
    let quality = 0;   // 0: density 2; 1: 1.5; 2: 1
    const gpuTimes = [];
    let slowGpu = 0;
    function initGL() {
      if (QS.get('gl') === '0') return false;
      // the drawing buffer at its final size from the start: resizing it at the first frame stalls 20 ms, in the motion
      const sb = sec.getBoundingClientRect(), d0 = Math.min(2, window.devicePixelRatio || 1);
      if (sb.width && sb.height) { canvas.width = Math.round(sb.width * d0); canvas.height = Math.round(sb.height * d0); }
      try {
        gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
      } catch (e) { gl = null; }
      if (!gl) return false;
      // the shaders compile in the background when the browser can (KHR_parallel_shader_compile): no long task on the
      // page; the sheet is drawn once they are ready
      const par = gl.getExtension('KHR_parallel_shader_compile');
      const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); return x; };
      const start = (fs) => { const p = gl.createProgram(); const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fs); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); return { p, v, f }; };
      pending = [start(FS), start(FS_BAKE)];
      prog = pending[0].p; progB = pending[1].p;
      glReady = false;
      const finish = () => {
        if (disposed || !gl) return;
        if (par && !pending.every((x) => gl.getProgramParameter(x.p, par.COMPLETION_STATUS_KHR))) { later(finish, 16); return; }
        for (const x of pending) {
          if (!gl.getProgramParameter(x.p, gl.LINK_STATUS)) {
            console.error(gl.getShaderInfoLog(x.f) || gl.getProgramInfoLog(x.p));
            gl = null; openK = 1; stage.classList.add('is-nogl'); placeCss(); return;
          }
        }
        for (const [p, map] of [[prog, U], [progB, UB]]) {
          const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
          for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); map[u.name] = gl.getUniformLocation(p, u.name); }
        }
        gl.useProgram(prog);
        gl.uniform1i(U.uPT, 0);
        gl.uniform1i(U.uFT, 1);
        glReady = true;
        if (MESURE) canvas._readyMs = performance.now() - tInit;
        kick(true);
        if (plate) ready();
      };
      later(finish, par ? 16 : 0);
      const params = () => { for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); };
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      params();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array([0, 0, 0, -64]));
      ftex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ftex);
      params();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 128]));
      fbo = gl.createFramebuffer();
      const tqe = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (tqe) tq = { ext: tqe, pending: [] };
      canvas.addEventListener('webglcontextlost', onLost);
      return true;
    }
    function onLost(e) { if (disposed) return; e.preventDefault(); gl = null; openK = 1; stage.classList.add('is-nogl'); placeCss(); }

    /* The paper's fine relief, baked at the canvas's pixels (once per size). */
    function bakePaper(cw, ch, d) {
      const key = `${cw}x${ch}@${d}`;
      if (key === paperKey) return;
      paperKey = key;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ftex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex, 0);
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(progB);
      gl.uniform1f(UB.uDpr, d);
      gl.uniform2f(UB.uRes, cw, ch);
      gl.uniform1f(UB.uOct, sstep(1.25, 2.0, d));
      gl.uniform1f(UB.uFelt, 0.28);
      gl.uniform1f(UB.uFib, 0.085);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
      full = true;
    }

    /* ----- Layout: the zone above the ink line, the address fitted to it ----- */
    const mctx = document.createElement('canvas').getContext('2d');
    function layout() {
      const b = sec.getBoundingClientRect(), z = zone.getBoundingClientRect(), k = ink.getBoundingClientRect();
      if (b.width < 10 || z.width < 10) return null;
      const Z = { x0: z.left - b.left, y0: z.top - b.top, x1: z.right - b.left, y1: z.bottom - b.top };
      const pt = parseFloat(getComputedStyle(zone).paddingTop) || 0;
      const area = { x0: Z.x0, x1: Z.x1, y0: Z.y0 + pt, y1: k.top - b.top - clamp(0.06 * (Z.y1 - Z.y0), 22, 48) };
      const aw = area.x1 - area.x0, ah = Math.max(40, area.y1 - area.y0);
      const one = z.width >= 860;
      const texts = one ? [email] : [user, '@' + domain];
      const P = 100;
      const ms = texts.map((t) => measure(mctx, t, P));
      const inkW = Math.max(...ms.map((m) => m.l + m.r));
      const gap = 0.12 * P;
      const blockH = ms.reduce((h, m, i) => h + m.a + m.d + (i ? gap : 0), 0);
      let size = Math.min(aw / inkW * P, ah / blockH * P, 200);
      size = Math.floor(size * 4) / 4;
      const k2 = size / P;
      let y = area.y0 + (ah - blockH * k2) * 0.86;
      const lines = [];
      ms.forEach((m, i) => {
        if (i) y += gap * k2;
        const base = y + m.a * k2;
        lines.push({ text: texts[i], x: area.x0 + m.l * k2, base, top: y, bottom: base + m.d * k2 });
        y = base + m.d * k2;
      });
      // the @: its own box, between the gaps that part it from its neighbours
      const ln = one ? lines[0] : lines[1];
      const pre = one ? user : '';
      const a0 = pre ? measure(mctx, pre, size).adv : 0;
      const a1 = measure(mctx, pre + '@', size).adv;
      const at = { x0: ln.x + a0 - (pre ? 0.03 * size : 0.2 * size), x1: ln.x + a1 + 0.03 * size, y0: ln.top - 0.2 * size, y1: ln.bottom + 0.2 * size };
      // on two lines the box must stop short of the line above, or the foil gilds the feet of « mar » (phone, 2026-11-05):
      // its top goes halfway between that line's baseline and the top of the @
      if (!one) at.y0 = Math.max(at.y0, (lines[0].base + ln.base - measure(mctx, '@', size).a) / 2);
      const box = { x0: area.x0, y0: lines[0].top, x1: area.x0 + inkW * k2, y1: lines[lines.length - 1].bottom };
      const sig = null;   // the dated proof line was dropped (user, 2026-11-05)
      const vh = window.innerHeight || b.height;
      const Hs = clamp(vh - Math.max(0, b.top + (window.scrollY || 0)), 320, Math.max(320, b.height));
      return {
        W: b.width, H: b.height, Hs, zone: Z, size, lines, at, box, one, sig,
        fadeTop: clamp(Z.y0 + 8, 24, 56), inkBottom: k.bottom - b.top,
        depth: Math.max(1.2, 0.022 * size), bev: Math.max(2.4, 0.052 * size),
      };
    }
    const keyOf = (L) => [L.size, L.one, L.sig ? L.sig.text + L.sig.x.toFixed(1) : '', ...L.lines.map((l) => `${l.x.toFixed(2)},${l.base.toFixed(2)}`)].join('|');

    function uploadPlate(p) {
      if (!gl) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, p.tw, p.th, 0, gl.RGBA, gl.FLOAT, p.data);
    }

    /* The CSS fallback: the same lines, debossed by inner shadows. */
    function placeCss() {
      if (!G || !stage.classList.contains('is-nogl')) return;
      css.style.fontSize = G.size + 'px';
      css.style.left = (G.box.x0 - G.zone.x0) + 'px';
      css.style.top = (G.lines[0].top - G.zone.y0 - 0.2 * G.size) + 'px';
      css.classList.toggle('is-one', G.one);
    }

    /* ----- Uniforms ----- */
    let M = null, Mfrom = null, Mk = 1;
    let Lfrom = null, Lk = 1, LU = null;
    const lerpObj = (a, b, t) => { const o = {}; for (const k in b) o[k] = Array.isArray(b[k]) ? b[k].map((v, i) => mix(a[k][i], v, t)) : mix(a[k], b[k], t); return o; };
    const platenRect = () => {
      if (!G) return [0, 0, 0, 0];
      const m = 0.16 * G.size;
      return [G.box.x0 - m, G.box.y0 - m, G.box.x1 + m, G.box.y1 + m];
    };

    let renders = 0;
    function draw() {
      if (!gl || !G || disposed || !glReady) return;
      const cap2 = [2, 1.5, 1][quality];
      const dpr = Math.min(cap2, window.devicePixelRatio || 1);
      const cw = Math.max(1, Math.round(G.W * dpr)), ch = Math.max(1, Math.round(G.H * dpr));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; full = true; }
      const d = cw / G.W;
      bakePaper(cw, ch, d);
      gl.viewport(0, 0, cw, ch);
      const m = Mk < 1 && Mfrom ? lerpObj(Mfrom, M, Mk) : M;
      const target = scene(light, G, m);
      const l = Lk < 1 && Lfrom ? lerpObj(Lfrom, target, Lk) : target;
      LU = l;
      const pl = platenRect();
      // a strike changes the plate and the platen's shadow only: redraw their rectangle, keep the rest of the sheet
      if (!full && plate) {
        const [x0, y0, w, h] = plate.rect;
        let r = [x0, y0, x0 + w, y0 + h];
        if (platenW > 0) {
          const zz = platenZ;
          const sx = l.plO[0] * zz, sy = l.plO[1] * zz;
          const g = 8 + zz * l.plO[2] * 2.2;
          r = [Math.min(r[0], pl[0] + Math.min(0, sx) - g), Math.min(r[1], pl[1] + Math.min(0, sy) - g), Math.max(r[2], pl[2] + Math.max(0, sx) + g), Math.max(r[3], pl[3] + Math.max(0, sy) + g)];
        }
        const sx0 = clamp(Math.floor(r[0] * d) - 2, 0, cw), sx1 = clamp(Math.ceil(r[2] * d) + 2, 0, cw);
        const sy0 = clamp(Math.floor(ch - r[3] * d) - 2, 0, ch), sy1 = clamp(Math.ceil(ch - r[1] * d) + 2, 0, ch);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(sx0, sy0, Math.max(0, sx1 - sx0), Math.max(0, sy1 - sy0));
      } else gl.disable(gl.SCISSOR_TEST);
      const wasFull = full;
      full = false;
      const f1 = (n, v) => U[n] && gl.uniform1f(U[n], v);
      const f2 = (n, a, b) => U[n] && gl.uniform2f(U[n], a, b);
      const f3 = (n, v) => U[n] && gl.uniform3f(U[n], v[0], v[1], v[2]);
      const f4 = (n, v) => U[n] && gl.uniform4f(U[n], v[0], v[1], v[2], v[3]);
      f2('uRes', cw, ch);
      f1('uDpr', d);
      f1('uFade', G.fadeTop);
      f4('uPlate', plate ? plate.rect : [-10, -10, 1, 1]);
      const at = (plate && plate.at) || G.at;   // while a resized plate bakes, the old one keeps its own box
      f4('uAt', [at.x0, at.y0, at.x1, at.y1]);
      f4('uSig', G.sig ? [G.sig.x0 - 3, G.sig.y0 - 3, G.sig.x1 + 3, G.sig.y1 + 3] : [-9, -9, -8, -8]);
      f1('uDepth', G.depth); f1('uBev', G.bev); f1('uPress', press);
      f1('uFoil', sstep(0.0, 0.5, press)); f1('uInk', m.dark * sstep(0.02, 0.45, press));
      f3('uSunL', l.sunL); f3('uSunC', l.sunC); f1('uSunA', l.sunA);
      f4('uGW', l.gw); f4('uGB', l.gb); f4('uGP', l.gp); f1('uGX', l.gx); f1('uGPen', l.gpen); f1('uOpen', openK);
      f3('uSkyP', l.skyP); f3('uSkyC', l.skyC); f2('uSkyF', l.skyF[0], l.skyF[1]);
      f3('uLampP', l.lampP); f3('uLampC', l.lampC); f4('uLampK', l.lampK); f1('uLampA', l.lampA);
      f3('uAmb', l.amb); f3('uRoom', l.room); f3('uExpo', l.expo);
      f4('uPlaten', pl); f2('uPlZ', platenZ, 0.3 * platenW); f3('uPlO', l.plO);
      f3('uPaper', m.paper); f3('uDesk', m.desk); f3('uCoral', m.coral); f3('uInkC', m.ink);
      f1('uKnee', m.knee); f1('uFine', m.fine); f1('uCockle', 1.6); f1('uSheen', m.sheen); f1('uRough', m.rough);
      let q = null;
      if (tq && tq.pending.length < 4) { q = gl.createQuery(); gl.beginQuery(tq.ext.TIME_ELAPSED_EXT, q); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (q) { gl.endQuery(tq.ext.TIME_ELAPSED_EXT); tq.pending.push({ q, full: wasFull, px: wasFull ? cw * ch : 0 }); }
      canvas._renders = ++renders;
      // read back later, outside the frame: a query read in the frame that issued the draw waits for the GPU
      if (tq && tq.pending.length && !pollT) pollT = later(() => { pollT = 0; pollTimes(); }, 60);
    }
    /* GPU time of each frame (when the browser gives it): a full frame over 16 ms lowers the density. Only results
       already there are read (availability first: the disjoint flag is a synchronous read, asked once per batch). */
    let pollT = 0;
    function pollTimes() {
      if (!tq || !gl) return;
      let disjoint = null;
      while (tq.pending.length) {
        const it = tq.pending[0];
        if (!gl.getQueryParameter(it.q, gl.QUERY_RESULT_AVAILABLE)) break;
        if (disjoint === null) disjoint = gl.getParameter(tq.ext.GPU_DISJOINT_EXT);
        tq.pending.shift();
        const ns = gl.getQueryParameter(it.q, gl.QUERY_RESULT);
        gl.deleteQuery(it.q);
        if (disjoint) continue;
        const ms = ns / 1e6 + (MESURE && window.EMPREINTE && window.EMPREINTE.lent ? 20 : 0);
        gpuTimes.push({ ms, full: it.full });
        if (gpuTimes.length > 400) gpuTimes.shift();
        // two heavy full frames in a row (not one stray spike) lower the density one step
        if (it.full) slowGpu = ms > 16 ? slowGpu + 1 : 0;
        if (slowGpu >= 2 && quality < 2) { quality++; slowGpu = 0; full = true; kick(true); }
      }
      if (tq.pending.length && !pollT) pollT = later(() => { pollT = 0; pollTimes(); }, 60);
    }
    if (MESURE) { canvas._gpu = gpuTimes; Object.defineProperty(canvas, '_quality', { get: () => quality }); }

    /* ----- On-demand frames: one rAF while something moves, none at rest ----- */
    const anims = new Set();
    let lastT = 0, slow = 0;
    function animate(dur, fn, done) { const a = { t0: performance.now(), dur, fn, done }; anims.add(a); fn(0); kick(); return a; }
    function kick(all) { if (all) full = true; if (!raf && !disposed) raf = requestAnimationFrame(frame); }
    function frame(ts) {
      raf = 0;
      // without GPU timers: frames that keep coming late also lower the density
      if (!tq && lastT && anims.size) { slow = ts - lastT > 28 ? slow + 1 : 0; if (slow >= 4 && quality < 2) { quality++; slow = 0; full = true; } }
      lastT = anims.size ? ts : 0;
      const t = performance.now();
      for (const a of [...anims]) {
        const k = clamp((t - a.t0) / a.dur, 0, 1);
        a.fn(k);
        if (k >= 1) { anims.delete(a); if (a.done) a.done(); }
      }
      draw();
      if (anims.size) kick();
    }
    const bez = (x1, y1, x2, y2) => (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x;
        const dx = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
        if (Math.abs(cx) < 1e-5 || !dx) break;
        t = clamp(t - cx / dx, 0, 1);
      }
      return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
    };
    const easeDown = bez(0.45, 0, 0.85, 0.6);   // the platen comes down, gathering speed
    const easeUp = bez(0.2, 0.6, 0.3, 1);       // and lifts away
    const easeSoft = bez(0.22, 0.7, 0.18, 1);

    /* ----- The gesture: the platen's shadow approaches, it strikes, it lifts; the paper settles ----- */
    // one stroke over k in [0, 1]: z0 the platen's starting height, deep the press at the stroke, from the press before it
    function stroke(k, z0, deep, from, tc) {
      if (k < tc) {
        const u = k / tc;
        platenZ = z0 * (1 - easeDown(u));
        platenW = sstep(0, 0.25, u);
        press = from;
      } else {
        const u = (k - tc) / (1 - tc);
        const up = easeUp(clamp(u / 0.75, 0, 1));
        platenZ = z0 * 0.8 * up;
        platenW = 1 - sstep(0.35, 1, u);
        // the type bites at once, then the sheet takes back a little of it: no rebound
        press = u < 0.08 ? mix(from, deep, sstep(0, 0.08, u)) : mix(deep, 1, easeSoft((u - 0.08) / 0.92));
      }
    }
    // the platen starts high enough for its shadow to come from the side of the light, softly
    const z0Of = () => (G ? 0.2 * G.Hs : 120);
    /* ----- The light comes in: the sheet fades up already printed, then the shutters fold back from the mullion and
       the sun's panes widen across it, raking the impression into relief (no patch popping in with the first frame,
       no platen on arrival: the platen is the Copy gesture). Under a page change (transitions.js « contact ») they
       open on its cue, 300 ms after the click, while the room's shade lifts. */
    const easeOpen = bez(0.55, 0, 0.2, 1);
    const OPEN_MS = 900;
    function ready() {
      if (opened || disposed || (gl && !glReady) || !plate) return;
      opened = true;
      if (!gl || reduce() || QS.has('arrivee')) { openK = 1; canvas.style.opacity = ''; kick(true); arrive(); return; }
      arrived = true; press = 1; platenW = 0; platenZ = 0;
      kick(true);
      canvas.style.transition = 'opacity .6s cubic-bezier(.22, .7, .18, 1)';
      // under a page change the print waits for the page we leave to be gone (never both at once)
      const under = !!(window.TR && window.TR.running);
      if (!under) canvas.style.opacity = '1';
      const cue = under ? 300 : 140;
      const go = () => {
        canvas.style.opacity = '1';
        animate(OPEN_MS, (k) => { openK = easeOpen(k); full = true; }, () => { openK = 1; canvas.style.transition = ''; });
      };
      const wait = mountT + cue - performance.now();
      if (wait > 8) later(go, wait); else go();
    }
    let arrived = false, arriving = null;
    function arrive() {
      if (arrived) return;
      if (gl && !glReady) return;   // the shaders call it again once they are ready
      arrived = true;
      const fixed = QS.has('arrivee') ? clamp(parseFloat(QS.get('arrivee')) || 0, 0, 1) : null;
      const z0 = z0Of(LU || (G && light ? scene(light, G, M) : null));
      if (fixed !== null) { stroke(fixed, z0, 1.14, 0, 0.5); if (fixed >= 1) { press = 1; platenW = 0; } kick(true); return; }
      if (reduce()) { press = 1; platenW = 0; kick(); return; }
      later(() => {
        arriving = animate(1050, (k) => stroke(k, z0, 1.14, 0, 0.5), () => { arriving = null; press = 1; platenW = 0; platenZ = 0; });
      }, 160);
    }
    let striking = null;
    function strike() {
      if (reduce() || !gl || !glReady || !plate) return;
      if (arriving) { anims.delete(arriving); arriving = null; }
      if (striking) anims.delete(striking);
      const from = Math.max(press, 1);
      // no platen over the sheet (its rectangular shadow read as a box popping up): the type bites once more, at once,
      // and the cotton settles back
      striking = animate(480, (k) => { stroke(k, 0, 1.3, from, 0.001); platenW = 0; platenZ = 0; }, () => { striking = null; press = 1; platenW = 0; platenZ = 0; });
    }
    function setLabel(text, icon) {
      label.textContent = text;
      const svg = btn.querySelector('svg');
      if (svg) svg.innerHTML = CK.ICONS[icon];
    }
    async function onCopy() {
      strike();
      const ok = await CK.copy(email, { select: addr, quiet: true });
      const show = () => {
        if (disposed) return;
        setLabel(ok ? 'Copied' : 'Selected, press Ctrl+C', ok ? 'check' : 'copy');
        live.textContent = ok ? 'Email address copied.' : 'Address selected: press Ctrl+C to copy.';
        clearTimeout(labelT);
        labelT = later(() => { setLabel('Copy the address', 'copy'); live.textContent = ''; }, 2600);
      };
      if (reduce() || !gl) show(); else later(show, 60);
    }
    btn.addEventListener('click', onCopy);

    /* ----- The light, once a minute: a slow, short transition, then rest ----- */
    let lightAnim = null;
    const near = (a, b) => { for (const k in a) { const x = a[k], y = b[k]; if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 1e-4 * (1 + Math.abs(x[i]))) return false; } else if (Math.abs(x - y) > 1e-4 * (1 + Math.abs(x))) return false; } return true; };
    function updateLight(animated, dur = 1600) {
      const next = lightAt(now());
      if (cap.textContent !== next.caption) cap.textContent = next.caption;
      stage.dataset.light = next.mode;
      if (!light || !G || !M) { light = next; kick(true); return; }
      // nothing to draw when the light has not moved (the lamp at night, a fixed review hour)
      if (LU && near(scene(next, G, M), LU) && Lk >= 1) { light = next; return; }
      if (animated && !reduce() && LU) {
        Lfrom = LU; Lk = 0; light = next;
        if (lightAnim) anims.delete(lightAnim);
        lightAnim = animate(dur, (k) => { Lk = easeSoft(k); full = true; }, () => { Lfrom = null; Lk = 1; lightAnim = null; });
      } else { light = next; Lfrom = null; Lk = 1; kick(true); }
    }
    function scheduleMinute() {
      later(() => { updateLight(true); scheduleMinute(); }, 60000 - (Date.now() % 60000) + 80);
    }
    function onVisible() { if (document.visibilityState === 'visible') updateLight(true); }
    document.addEventListener('visibilitychange', onVisible);

    /* ----- Review: force an hour of the day (kept in memory: the artifact keeps only the #hash) ----- */
    function setHeure(v) {
      override = v && instantOf(v) ? v : null;
      updateLight(true, 1100);
      return override;
    }
    window.EMPREINTE = { setHeure, get heure() { return override; }, open: () => openK };
    if (MESURE) {
      // GPU cost of n frames, full sheet or the plate only (ms per frame)
      window.EMPREINTE.mesure = async (n = 30, all = true) => {
        if (!gl || !tq || !glReady) return null;
        const q = gl.createQuery();
        gl.finish();
        gl.beginQuery(tq.ext.TIME_ELAPSED_EXT, q);
        const keepTq = tq; tq = null;
        for (let i = 0; i < n; i++) { full = all; draw(); }
        tq = keepTq;
        gl.endQuery(tq.ext.TIME_ELAPSED_EXT);
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        }
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
        return { ms: ns / 1e6 / n, w: canvas.width, h: canvas.height, disjoint: gl.getParameter(tq.ext.GPU_DISJOINT_EXT) };
      };
      // GPU cost of baking the paper once (ms)
      window.EMPREINTE.mesureBake = async () => {
        if (!gl || !tq) return null;
        const q = gl.createQuery();
        gl.finish();
        gl.beginQuery(tq.ext.TIME_ELAPSED_EXT, q);
        paperKey = '';
        bakePaper(canvas.width, canvas.height, canvas.width / G.W);
        gl.endQuery(tq.ext.TIME_ELAPSED_EXT);
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        }
        return gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      };
      window.EMPREINTE.press = (v, z = 0, w = 0) => { press = v; platenZ = z; platenW = w; full = true; draw(); };
      // one frame of the arrival (which = 'a') or of the strike ('f') at k in [0, 1], for frame-by-frame films
      window.EMPREINTE.geste = (k, which = 'a') => {
        anims.clear();
        if (which === 'a') stroke(k, z0Of(LU), 1.14, 0, 0.5); else stroke(k, 0.5 * z0Of(LU), 1.3, 1, 0.36);
        full = true; draw();
      };
    }

    /* ----- Theme: the paper changes with the page, at the page's pace ----- */
    const offTheme = CK.onTheme(() => {
      const next = material(stage);
      if (reduce() || !M) { M = next; Mfrom = null; Mk = 1; kick(true); return; }
      Mfrom = Mk < 1 && Mfrom ? lerpObj(Mfrom, M, Mk) : M;
      M = next; Mk = 0;
      animate(500, (k) => { Mk = easeSoft(k); full = true; }, () => { Mfrom = null; Mk = 1; });
    });

    /* ----- The plate's distance field is computed in a worker: the page never blocks on it ----- */
    let worker = null, workerUrl = '', jobId = 0, pendingKey = '', jobT0 = 0;
    const atOf = new Map();
    try {
      workerUrl = URL.createObjectURL(new Blob([`const computePlate = ${computePlate.toString()};\nself.onmessage = (e) => { const r = computePlate(e.data); self.postMessage(r, [r.data.buffer]); };`], { type: 'text/javascript' }));
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => { if (!disposed && e.data.id === jobId) { e.data.t0 = jobT0; applyPlate(e.data); } };
      worker.onerror = () => { worker = null; pendingKey = ''; if (!disposed) refit(true); };
    } catch (e) { worker = null; }
    function applyPlate(r) {
      pendingKey = '';
      plate = r; plateKey = r.key;
      plate.at = atOf.get(r.id) || (G && G.at); atOf.clear();
      if (MESURE) { canvas._bakeMs = performance.now() - r.t0; canvas._worker = !!worker; }
      uploadPlate(plate);
      kick(true);
      ready();
    }
    function bakeNow() {
      if (disposed || !G) return;
      const key = keyOf(G);
      if (key === plateKey || key === pendingKey) return;
      const job = rasterPlate(G);
      job.key = key; job.id = ++jobId;
      atOf.set(job.id, G.at);   // the foil's box goes with the plate it gilds, not with a newer layout
      const t0 = performance.now();
      if (worker) { pendingKey = key; worker.postMessage(job, [job.a.buffer]); jobT0 = t0; }
      else { const r = computePlate(job); r.t0 = t0; applyPlate(r); }
    }

    /* ----- Resize: refit at once, rebake the plate when the size settles ----- */
    let fontsReady = false;
    function refit(immediate) {
      const L = layout();
      if (!L) return;
      G = L;
      placeCss();
      if (!fontsReady) { kick(true); return; }
      const key = keyOf(L);
      if (key !== plateKey) {
        clearTimeout(bakeT);
        if (immediate || !plate) bakeNow(); else { bakeT = later(bakeNow, 160); kick(true); }
      } else kick(true);
    }
    const ro = new ResizeObserver(() => refit(false));

    /* ----- Start ----- */
    visitT = now();
    M = material(stage);
    const tInit = performance.now();
    if (!initGL()) { stage.classList.add('is-nogl'); openK = 1; }
    else if (!reduce() && !QS.has('arrivee')) canvas.style.opacity = '0';   // until the sheet and its print are ready
    if (MESURE) canvas._initMs = performance.now() - tInit;
    G = layout();
    updateLight(false);
    placeCss();
    const tDraw = performance.now();
    draw();
    if (MESURE) canvas._firstDrawMs = performance.now() - tDraw;
    ro.observe(sec);
    scheduleMinute();
    Promise.race([
      Promise.all([document.fonts.load(FONT(100)), document.fonts.load(FONT(16, 500))]).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 2500)),
    ]).then(() => {
      if (disposed) return;
      fontsReady = true;
      refit(true);
    });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      anims.clear();
      for (const t of timers) clearTimeout(t);
      timers.clear();
      ro.disconnect();
      offTheme();
      document.removeEventListener('visibilitychange', onVisible);
      btn.removeEventListener('click', onCopy);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (worker) worker.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      if (window.EMPREINTE && window.EMPREINTE.setHeure === setHeure) delete window.EMPREINTE;
      if (gl) {
        try { gl.deleteTexture(tex); gl.deleteTexture(ftex); gl.deleteFramebuffer(fbo); gl.deleteProgram(prog); gl.deleteProgram(progB); } catch (e) { /* the context may be gone */ }
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
      gl = null;
    };
  }

  /* ---------- The portfolio's Contact page: app.js mounts it in <main> and keeps its teardown ---------- */
  window.ContactPage = {
    mount(main) {
      main.innerHTML = '<div class="page-contact p-empreinte"></div>';
      return mount(main.firstElementChild);
    },
    // for the page change (transitions.js « contact »): the scene of the moment, and how far the shutters are open
    mood() { const el = document.querySelector('.page-contact'); return (el && el.dataset.light) || 'day'; },
    openK() { return window.EMPREINTE && window.EMPREINTE.open ? window.EMPREINTE.open() : 1; },
  };
  /* The first visit to Contact would compile its shaders while the page changes (a frame of 25 ms in the motion).
     Compiled once beforehand at idle, in a throwaway context, they come from the browser's shader cache then. */
  function prewarm() {
    if (document.querySelector('.page-contact')) return;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      const gl = c.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false });
      if (!gl) return;
      const progs = [FS, FS_BAKE].map((fs) => {
        const p = gl.createProgram();
        for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); }
        gl.linkProgram(p);
        return p;
      });
      const par = gl.getExtension('KHR_parallel_shader_compile');
      const done = () => {
        // one draw each, the way the page draws them (the sheet on screen, the paper into an RGBA8 texture)
        gl.useProgram(progs[0]); gl.drawArrays(gl.TRIANGLES, 0, 3);
        const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
        gl.useProgram(progs[1]); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.flush();
        setTimeout(() => { const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }, 800);
      };
      const poll = () => { if (par && !progs.every((p) => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR))) setTimeout(poll, 60); else done(); };
      poll();
    } catch (e) { /* no warm-up: the page compiles on its own */ }
  }
  const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 3000 }) : (fn) => setTimeout(fn, 600);
  addEventListener('load', () => setTimeout(() => idle(prewarm), 1500), { once: true });
})();
