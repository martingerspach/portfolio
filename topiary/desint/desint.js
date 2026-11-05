// Topiary v4.1 : le grand mot se désagrège au survol. La version retenue le 2026-10-21 est « Le souffle »
// (desint/souffle.js) ; le banc des cinq versions est dans archive/2026-10-21-desintegration/.
// Référence : alt-shift (altshiftstudio.com, composant « shift-particle ») : le logo échantillonné en cellules de 6 px,
// une érosion en diagonale au passage du pointeur, de la lévitation, un sillage, puis un retour en cascade par couches.
//
// Ici, le mot tel qu'il est peint (relief « Lettres de buis » du canevas WebGL2, face noire du SVG et les deux enfants)
// est copié une fois dans une texture, puis découpé en éclats : les cellules de Voronoï d'une grille légèrement tremblée.
// Au repos, chaque pixel appartient à un seul éclat et reprend sa couleur exacte (texelFetch) : le canevas prend la place
// du mot sans saut. En mouvement, chaque éclat emporte son vrai morceau de lettre (arêtes anticrénelées), peut se changer
// en grain, en feuille ou en anneau, et montrer son revers dans la teinte des parois de la haie. La physique tourne en JS
// sur des tableaux typés ; le rendu est instancié (deux appels : les éclats au repos, puis ceux qui bougent, devant).
// La boucle ne tourne que pendant l'effet ; le mot reprend sa place quand tout est revenu. Rien en mouvements réduits,
// en couleurs forcées ou sans WebGL2 : le mot reste tel quel. Les deux enfants font partie du mot : ils se désagrègent
// avec lui. Le relief est relu dans son canevas après son dessin (signatures.js garde son tampon).
(function (g) {
  'use strict';
  if (typeof document === 'undefined') return;

  const D = (g.TOPIARY_DESINT = g.TOPIARY_DESINT || { list: [] });
  D.register = (def) => { D.list.push(def); D.list.sort((a, b) => a.n - b.n); };

  const doc = document, root = doc.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const SEED = 7;
  const REF_W = 1143;            // largeur de la boîte du mot à 1 440 px : l'unité des réglages

  /* ---------- Hachage commun au JS et au GLSL (graines de la grille tremblée) ---------- */
  const hsh = (x) => {
    x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  };
  const jit = (i, j) => { const a = hsh((Math.imul(i, 1597334677) ^ hsh((j + SEED) >>> 0)) >>> 0); return [(a & 0xffff) / 65536, (a >>> 16) / 65536]; };
  const GLSL_HASH = `
uniform uint uSeed;
uniform float uCell, uJit;
uint hsh(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
vec2 jit(ivec2 c) { uint a = hsh((uint(c.x) * 1597334677u) ^ hsh(uint(c.y) + uSeed)); return vec2(float(a & 0xffffu), float(a >> 16u)) / 65536.0; }
vec2 seedOf(ivec2 c) { return (vec2(c) + 0.5 + uJit * (jit(c) - 0.5)) * uCell; }`;

  const VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aQ;
layout(location = 1) in vec4 iA; // gi, gj, alea, forme
layout(location = 2) in vec4 iB; // x, y (px CSS de la capsule), angle, échelle
layout(location = 3) in vec4 iC; // métamorphose, opacité, revers (échelle en x), mobile (0 : au repos exact)
uniform vec2 uCard;
uniform float uQuad;
uniform int uPass;
out vec2 vL;
flat out ivec2 vG;
flat out vec2 vS;
flat out vec4 vA;
flat out vec4 vC;
${GLSL_HASH}
void main() {
  bool moving = iC.w > 0.5;
  if (iC.y <= 0.0 || (uPass == 0) == moving) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  ivec2 gc = ivec2(iA.xy);
  vec2 L = aQ * uQuad;
  vec2 q = L * iB.w;
  q.x *= iC.z;
  float c = cos(iB.z), s = sin(iB.z);
  vec2 p = iB.xy + vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec2 n = p / uCard * 2.0 - 1.0;
  gl_Position = vec4(n.x, -n.y, 0.0, 1.0);
  vL = L; vG = gc; vS = seedOf(gc); vA = iA; vC = iC;
}`;

  const FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vL;
flat in ivec2 vG;
flat in vec2 vS;
flat in vec4 vA;
flat in vec4 vC;
uniform sampler2D uTex;
uniform vec2 uBox, uBoxSize, uBoxDev;
uniform ivec2 uTexSize;
uniform float uDpr, uDevH, uLod;
uniform vec4 uSz;   // poussière (demi-côté), anneau (rayon, demi-épaisseur), grain (rayon) ; px CSS
uniform vec2 uLeaf; // feuille : demi-longueur, demi-largeur
uniform vec3 uBack; // revers des éclats : la teinte des parois de la haie
out vec4 o;
${GLSL_HASH}
// Distance signée au bord de l'éclat (positive dedans) : demi-plans médiateurs avec les huit voisins
float region(vec2 h) {
  float d = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    vec2 sn = seedOf(vG + ivec2(i, j));
    vec2 e = vS - sn;
    d = min(d, dot(h - 0.5 * (vS + sn), e) * inversesqrt(dot(e, e)));
  }
  return d;
}
float sdVesica(vec2 p, float r, float d) {
  p = abs(p);
  float b = sqrt(r * r - d * d);
  return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
void main() {
  if (vC.w < 0.5) {
    // Au repos : le pixel appartient à l'éclat dont la graine est la plus proche ; tous les éclats font le même calcul
    // sur le centre du pixel, donc chaque pixel est peint une fois, à sa couleur exacte.
    vec2 fc = vec2(gl_FragCoord.x, uDevH - gl_FragCoord.y);
    vec2 h = fc / uDpr - uBox;
    ivec2 c0 = ivec2(floor(h / uCell));
    float best = 1e20;
    ivec2 bi = c0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 c = c0 + ivec2(i, j);
      vec2 d = seedOf(c) - h;
      float dd = dot(d, d);
      if (dd < best) { best = dd; bi = c; }
    }
    if (bi != vG) discard;
    ivec2 tc = ivec2(floor(fc - uBoxDev));
    if (any(lessThan(tc, ivec2(0))) || any(greaterThanEqual(tc, uTexSize))) discard;
    o = texelFetch(uTex, tc, 0) * vC.y;
    return;
  }
  vec2 h = vS + vL;
  float dr = region(h);
  int kind = int(vA.w + 0.5);
  float sf = 0.6 + 0.8 * vA.z;
  float ds = dr;
  if (kind == 1) {        // poussière : un petit carré à peine arrondi
    float hs = uSz.x * sf;
    vec2 b = abs(vL) - vec2(hs * 0.75);
    ds = hs * 0.25 - (length(max(b, 0.0)) + min(max(b.x, b.y), 0.0));
  } else if (kind == 2) { // anneau, comme le point du « i » évidé
    ds = uSz.z - abs(length(vL) - uSz.y * sf);
  } else if (kind == 3) { // feuille de buis : une amande
    float L = uLeaf.x * sf, W = uLeaf.y * sf;
    float r = 0.5 * (L * L / W + W), dd = 0.5 * (L * L / W - W);
    ds = -sdVesica(vL.yx, r, dd);
  } else if (kind == 4) { // grain de sable
    ds = uSz.w * sf - length(vL);
  }
  float m = vC.x;
  float d = mix(dr, ds, m);
  float aa = max(fwidth(d), 1e-4);
  float a = clamp(d / aa + 0.5, 0.0, 1.0);
  vec4 tx = texture(uTex, h / uBoxSize);
  vec4 av = textureLod(uTex, vS / uBoxSize, uLod);
  vec4 ac = av.a > 0.004 ? vec4(av.rgb / av.a, 1.0) * smoothstep(0.02, 0.3, av.a) : vec4(0.0);
  vec4 col = mix(tx, ac, m);
  float f = vC.z;
  if (f < 0.0) col.rgb = mix(col.rgb, uBack * col.a, 0.8);
  col.rgb *= 0.86 + 0.14 * min(abs(f), 1.0);
  if (a <= 0.0) discard;
  o = col * (a * vC.y);
}`;

  /* ---------- Rendu ---------- */
  function makeGL() {
    const cv = doc.createElement('canvas');
    cv.className = 'hero__desint';
    cv.setAttribute('aria-hidden', 'true');
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const loc = {};
    ['uCard', 'uQuad', 'uPass', 'uSeed', 'uCell', 'uJit', 'uTex', 'uBox', 'uBoxSize', 'uBoxDev', 'uTexSize', 'uDpr', 'uDevH', 'uLod', 'uSz', 'uLeaf', 'uBack']
      .forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const sbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);
    const dbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dbuf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    const r = { cv, gl, prog, loc, vao, sbuf, dbuf, tex: gl.createTexture(), lost: false };
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; stop(true); });
    cv.addEventListener('webglcontextrestored', () => { cv.remove(); GL = null; ready = false; schedule(300); });
    return r;
  }

  /* ---------- État ---------- */
  let card = null, geom = null, def = null, GL = null, S = null, P = null, ready = false, on = false;
  let raf = 0, last = 0, firstFit = 0, timer = 0, manual = false, onScreen = true;
  let stat = null, dyn = null, sDirty = [Infinity, -1];
  const ptr = { cx: 0, cy: 0, x: -1e4, y: -1e4, lx: -1e4, ly: -1e4, vx: 0, vy: 0, speed: 0, over: false, inside: false, near: false,
    lastMove: -1e9, leftAt: -1e9, enteredAt: -1e9, fresh: true, type: 'mouse', synthetic: false };
  const E = { ptr, U: 1, F: 1, W: 0, H: 0, now: 0, dt: 0, box: null, dir: [0.6157, -0.788], cell: 5 };
  const stats = { frames: 0, step: 0, pack: 0, draw: 0, n: 0, cap: 0, moving: 0 };
  D.stats = stats;

  /* ---------- Copie du mot ---------- */
  // Le mot entier tel qu'il est peint : le relief, la face, puis les deux enfants (ils font partie du mot et se
  // désagrègent avec lui). Tout est dessiné avec la matrice du SVG lui-même, pour qu'au repos la copie tombe au pixel.
  function snapshot() {
    const bc = card.querySelector('canvas.hero__sig--buis');
    const text = card.querySelector('.hero__mark svg > text');
    if (!bc || bc.hidden || !bc.width || !text || !geom) return null;
    const st = bc.style;
    const b0 = { x: parseFloat(st.left), y: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height) };
    if (!(b0.w > 0 && b0.h > 0)) return null;
    const o = card.getBoundingClientRect();
    // La boîte : le relief, élargie aux enfants (la tête de celui du « o » dépasse parfois du relief)
    const kids = [...card.querySelectorAll('.hero__mark .hero__child')];
    let x0 = b0.x, y0 = b0.y, x1 = b0.x + b0.w, y1 = b0.y + b0.h;
    kids.forEach((gk) => {
      const r = gk.getBoundingClientRect();
      if (!r.width) return;
      x0 = Math.min(x0, r.left - o.left - 2); y0 = Math.min(y0, r.top - o.top - 2);
      x1 = Math.max(x1, r.right - o.left + 2); y1 = Math.max(y1, r.bottom - o.top + 2);
    });
    // La copie est calée sur la grille de pixels du canevas des éclats (densité de l'écran, plafonnée à 3) : au repos,
    // un pixel du canevas lit exactement un texel.
    const dpr = Math.min(3, devicePixelRatio || 1);
    const dx0 = Math.floor(x0 * dpr), dy0 = Math.floor(y0 * dpr);
    const W = Math.ceil(x1 * dpr) - dx0, H = Math.ceil(y1 * dpr) - dy0;
    const box = { x: dx0 / dpr, y: dy0 / dpr, w: W / dpr, h: H / dpr };
    const cv = doc.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d', { willReadFrequently: true });
    // Le relief : le canevas de « Lettres de buis », posé comme le compositeur le pose (interpolé s'il tombe entre deux
    // pixels, ou agrandi quand sa densité est plafonnée à 2)
    x.imageSmoothingEnabled = true;
    x.drawImage(bc, b0.x * dpr - dx0, b0.y * dpr - dy0, b0.w * dpr, b0.h * dpr);
    // La matrice du SVG : viewBox (arrondi au centième) posé dans sa boîte, « meet » centré. Chrome cale l'origine
    // d'un SVG en ligne sur le pixel CSS entier, pas sa taille.
    const m = geom.mark;
    const svg = text.ownerSVGElement, vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    const k = Math.min(r.width / vb.width, r.height / vb.height);
    const e = Math.round(r.left) + (r.width - vb.width * k) / 2 - vb.x * k - o.left;
    const f = Math.round(r.top) + (r.height - vb.height * k) / 2 - vb.y * k - o.top;
    const base = (c) => c.setTransform(dpr * k, 0, 0, dpr * k, e * dpr - dx0, f * dpr - dy0);
    const glyphs = (c) => {
      base(c);
      c.font = `${m.weight} 100px ${m.family}`;
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      [...m.word].forEach((ch, i) => c.fillText(ch, m.minX + (m.xs[i] - m.x) / m.k, 0));
    };
    // La face : le texte du SVG, glyphe par glyphe
    x.fillStyle = getComputedStyle(text).fill;
    glyphs(x);
    // Les enfants : leurs tracés, avec la transformation de chaque tracé jusqu'au repère du SVG
    const rootInv = svg.getScreenCTM().inverse();
    const fillPath = (c, path, M) => {
      base(c);
      if (M) c.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      c.fill(new Path2D(path.getAttribute('d')), path.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero');
    };
    kids.forEach((gk) => {
      if (getComputedStyle(gk).opacity === '0') return;
      const fill = getComputedStyle(gk).fill;
      const maskRef = gk.getAttribute('mask');
      // Sans masque (celui du « o ») : dessiné tel quel, devant les lettres
      if (!maskRef) {
        x.fillStyle = fill;
        gk.querySelectorAll('path').forEach((pa) => fillPath(x, pa, rootInv.multiply(pa.getScreenCTM())));
        return;
      }
      // Avec masque (celui du « p ») : caché derrière la face des lettres, sauf la découpe de son bras pendant
      const mk = svg.querySelector(maskRef.replace(/^url\((.*)\)$/, '$1'));
      const lay = doc.createElement('canvas'), mask = doc.createElement('canvas');
      lay.width = mask.width = W; lay.height = mask.height = H;
      const lx = lay.getContext('2d'), mx = mask.getContext('2d');
      lx.fillStyle = fill;
      gk.querySelectorAll('path').forEach((pa) => fillPath(lx, pa, rootInv.multiply(pa.getScreenCTM())));
      mx.fillStyle = '#fff';
      mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = 'destination-out';
      mx.fillStyle = '#000';
      glyphs(mx);
      mx.globalCompositeOperation = 'source-over';
      mx.fillStyle = '#fff';
      if (mk) mk.querySelectorAll('path').forEach((pa) => fillPath(mx, pa, pa.transform.baseVal.consolidate() && pa.transform.baseVal.consolidate().matrix));
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.globalCompositeOperation = 'destination-in';
      lx.drawImage(mask, 0, 0);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.drawImage(lay, 0, 0);
    });
    x.setTransform(1, 0, 0, 1, 0, 0);
    const data = x.getImageData(0, 0, W, H).data;
    const cs = getComputedStyle(root);
    return { cv, W, H, dpr, box, data, paper: cs.getPropertyValue('--paper').trim(), ink: cs.getPropertyValue('--ink').trim() };
  }

  const rgbOf = (css) => {
    const c = doc.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  };

  /* ---------- Les éclats ---------- */
  const cellOf = (d) => d.cell * Math.min(1.2, Math.max(0.62, Math.sqrt(S.box.w / REF_W)));

  function particles() {
    const box = S.box, dpr = S.dpr, c = cellOf(def), J = def.jitter;
    const cols = Math.ceil(box.w / c) + 1, rows = Math.ceil(box.h / c) + 1, N = cols * rows;
    const sum = new Float32Array(N), dk = new Float32Array(N), mx = new Uint8Array(N);
    const data = S.data, W = S.W, H = S.H;
    const ci = new Int32Array(W);
    for (let x = 0; x < W; x++) ci[x] = Math.floor((x + 0.5) / dpr / c) * rows;
    for (let y = 0; y < H; y++) {
      const gj = Math.floor((y + 0.5) / dpr / c);
      let o = y * W * 4;
      for (let x = 0; x < W; x++, o += 4) {
        const a = data[o + 3];
        if (!a) continue;
        const k = ci[x] + gj;
        sum[k] += a;
        if (a > mx[k]) mx[k] = a;
        dk[k] += a * (1 - (data[o] + data[o + 1] + data[o + 2]) / 765);
      }
    }
    const area = (c * dpr) ** 2 * 255;
    const use = new Uint8Array(N);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (mx[i * rows + j] <= 6) continue;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < cols && b < rows) use[a * rows + b] = 1;
      }
    }
    let n = 0;
    for (let k = 0; k < N; k++) n += use[k];
    const cap = n + (def.debris || 0);
    const F32 = () => new Float32Array(cap), U8 = () => new Uint8Array(cap);
    const p = {
      n, cap, cols, rows, cell: c, grid: new Int32Array(N).fill(-1),
      gi: new Int16Array(cap), gj: new Int16Array(cap), hx: F32(), hy: F32(), rnd: F32(), rnd2: F32(), kind: U8(), layer: U8(),
      cov: F32(), dark: F32(), edge: F32(),
      x: F32(), y: F32(), vx: F32(), vy: F32(), a: F32(), va: F32(), s: F32(), m: F32(), al: F32(), f: F32(),
      st: U8(), mv: U8(), t0: F32(), u: F32(), w: F32(), z: F32(), next: n,
    };
    let i = 0;
    for (let gi = 0; gi < cols; gi++) for (let gj = 0; gj < rows; gj++) {
      const k = gi * rows + gj;
      if (!use[k]) continue;
      const [jx, jy] = jit(gi, gj);
      p.gi[i] = gi; p.gj[i] = gj; p.grid[k] = i;
      p.hx[i] = box.x + (gi + 0.5 + J * (jx - 0.5)) * c;
      p.hy[i] = box.y + (gj + 0.5 + J * (jy - 0.5)) * c;
      p.cov[i] = sum[k] / area;
      p.dark[i] = sum[k] > 0 ? dk[k] / sum[k] : 0;
      let empty = 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const a = gi + di, b = gj + dj;
        if (a < 0 || b < 0 || a >= cols || b >= rows || sum[a * rows + b] / area < 0.08) empty++;
      }
      p.edge[i] = empty / 8;
      i++;
    }
    // Aléas reproductibles
    for (let k = 0; k < cap; k++) {
      const h1 = hsh((k * 2654435761 + 11) >>> 0), h2 = hsh(h1 ^ 0x9e3779b9);
      p.rnd[k] = (h1 & 0xffffff) / 16777216;
      p.rnd2[k] = (h2 & 0xffffff) / 16777216;
    }
    for (let k = 0; k < cap; k++) home(p, k);
    for (let k = n; k < cap; k++) p.al[k] = 0;
    p.mv.fill(1); // tout s'écrit au premier passage
    return p;
  }

  function home(p, i) {
    p.x[i] = p.hx[i]; p.y[i] = p.hy[i];
    p.vx[i] = 0; p.vy[i] = 0; p.a[i] = 0; p.va[i] = 0;
    p.s[i] = 1; p.m[i] = 0; p.al[i] = 1; p.f[i] = 1; p.st[i] = 0;
  }

  /* ---------- Outils pour les versions ---------- */
  E.rest = (i) => home(P, i);
  E.free = (i) => { P.al[i] = 0; P.st[i] = 0; };
  E.markStatic = (i) => { sDirty[0] = Math.min(sDirty[0], i); sDirty[1] = Math.max(sDirty[1], i); };
  // Un débris : la copie d'un éclat qui vit sa vie (le sécateur) ; anneau de tampons, le plus ancien est repris
  E.spawn = (src) => {
    const p = P;
    if (p.cap === p.n) return -1;
    const i = p.next;
    p.next = p.next + 1 >= p.cap ? p.n : p.next + 1;
    p.gi[i] = p.gi[src]; p.gj[i] = p.gj[src]; p.kind[i] = p.kind[src];
    p.hx[i] = p.hx[src]; p.hy[i] = p.hy[src]; p.cov[i] = p.cov[src]; p.dark[i] = p.dark[src];
    p.x[i] = p.x[src]; p.y[i] = p.y[src]; p.vx[i] = 0; p.vy[i] = 0; p.a[i] = p.a[src]; p.va[i] = 0;
    p.s[i] = p.s[src]; p.m[i] = p.m[src]; p.al[i] = 1; p.f[i] = 1; p.st[i] = 9; p.t0[i] = E.now;
    stat[i * 4] = p.gi[i]; stat[i * 4 + 1] = p.gj[i]; stat[i * 4 + 2] = p.rnd[i]; stat[i * 4 + 3] = p.kind[i];
    E.markStatic(i);
    return i;
  };
  // Les éclats dont la place (au repos) est à moins de r de (x, y)
  E.near = (x, y, r, fn) => {
    const p = P, c = p.cell, b = S.box;
    const i0 = Math.max(0, Math.floor((x - r - b.x) / c) - 1), i1 = Math.min(p.cols - 1, Math.floor((x + r - b.x) / c) + 1);
    const j0 = Math.max(0, Math.floor((y - r - b.y) / c) - 1), j1 = Math.min(p.rows - 1, Math.floor((y + r - b.y) / c) + 1);
    const r2 = r * r;
    for (let gi = i0; gi <= i1; gi++) for (let gj = j0; gj <= j1; gj++) {
      const i = p.grid[gi * p.rows + gj];
      if (i < 0) continue;
      const dx = p.hx[i] - x, dy = p.hy[i] - y, d2 = dx * dx + dy * dy;
      if (d2 < r2) fn(i, Math.sqrt(d2));
    }
  };
  // … et ceux dont la place est à moins de r du segment (ax, ay) -> (bx, by)
  E.seg = (ax, ay, bx, by, r, fn) => {
    const p = P, c = p.cell, b = S.box;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - b.x) / c) - 1), i1 = Math.min(p.cols - 1, Math.floor((Math.max(ax, bx) + r - b.x) / c) + 1);
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - r - b.y) / c) - 1), j1 = Math.min(p.rows - 1, Math.floor((Math.max(ay, by) + r - b.y) / c) + 1);
    const ux = bx - ax, uy = by - ay, l2 = ux * ux + uy * uy || 1e-9, r2 = r * r;
    for (let gi = i0; gi <= i1; gi++) for (let gj = j0; gj <= j1; gj++) {
      const i = p.grid[gi * p.rows + gj];
      if (i < 0) continue;
      const t = Math.min(1, Math.max(0, ((p.hx[i] - ax) * ux + (p.hy[i] - ay) * uy) / l2));
      const dx = p.hx[i] - ax - ux * t, dy = p.hy[i] - ay - uy * t, d2 = dx * dx + dy * dy;
      if (d2 < r2) fn(i, Math.sqrt(d2), t);
    }
  };
  E.at = (gi, gj) => (gi < 0 || gj < 0 || gi >= P.cols || gj >= P.rows ? -1 : P.grid[gi * P.rows + gj]);
  // Tourbillons sans divergence (rotationnel d'une fonction de courant analytique), px/s pour une amplitude de 1
  E.curl = (x, y, t, out) => {
    const k1 = 0.021, k2 = 0.017, k3 = 0.011;
    const a1 = x * k1 + t * 0.7, b1 = y * k2 - t * 0.5, a3 = (x + y) * k3 + t * 1.1, a4 = (x - 0.6 * y) * 0.031 - t * 0.9;
    // psi = sin(a1) cos(b1) + 0.6 sin(a3) + 0.35 cos(a4)
    const dpx = Math.cos(a1) * Math.cos(b1) * k1 + 0.6 * Math.cos(a3) * k3 - 0.35 * Math.sin(a4) * 0.031;
    const dpy = -Math.sin(a1) * Math.sin(b1) * k2 + 0.6 * Math.cos(a3) * k3 + 0.35 * Math.sin(a4) * 0.031 * 0.6;
    out[0] = dpy / 0.03; out[1] = -dpx / 0.03;
    return out;
  };
  E.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  E.smooth = (t) => t * t * (3 - 2 * t);
  // Hasard reproductible (mulberry32), remis à zéro à chaque mise en place : les films du banc se rejouent à l'identique
  let rs = 1;
  E.rand = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  E.reseed = (s) => { rs = s >>> 0; };

  /* ---------- Préparation ---------- */
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const run = () => prepare();
      if ('requestIdleCallback' in g) requestIdleCallback(run, { timeout: 800 }); else run();
    }, delay);
  }

  // Le temps d'intro réellement affiché depuis le premier ajustement du mot (les images d'animation s'arrêtent quand
  // l'onglet est caché), puis la copie
  const INTRO = 4300;
  let introMs = 0;
  function introClock() {
    let prev = 0;
    const f = (t) => {
      if (prev) introMs += Math.min(100, t - prev);
      prev = t;
      if (introMs < INTRO) requestAnimationFrame(f); else schedule(0);
    };
    requestAnimationFrame(f);
  }
  // Les enfants sont posés : opaques, et la jambe de celui du « o » ne balance plus
  const kidsSettled = () => [...card.querySelectorAll('.hero__mark .hero__child')]
    .every((k) => k.style.opacity === '' && ![...k.querySelectorAll('path')].some((p) => p.hasAttribute('transform')));

  function prepare() {
    if (!card || !def || !geom || introMs < INTRO) return;
    if (reduce.matches || forced.matches) { stop(true); ready = false; return; }
    if (!kidsSettled()) { schedule(300); return; }
    stop(true);
    try {
      if (!GL || GL.lost) {
        GL = makeGL();
        if (!GL) return;
        card.querySelector('.hero__lines').append(GL.cv);
      }
    } catch (e) { GL = null; return; }
    S = snapshot();
    if (!S) { schedule(400); return; }
    build();
  }

  function build() {
    P = particles();
    E.cell = P.cell;
    E.box = S.box;
    E.W = card.clientWidth;
    E.H = card.clientHeight;
    E.U = S.box.w / REF_W;
    E.F = Math.pow(E.U, 0.75); // les forces et les vitesses suivent la taille du mot, un peu moins que linéairement
    E.reseed(20261021);
    if (def.init) def.init(P, E);
    const gl = GL.gl, cap = P.cap;
    stat = new Float32Array(cap * 4);
    for (let i = 0; i < cap; i++) { stat[i * 4] = P.gi[i]; stat[i * 4 + 1] = P.gj[i]; stat[i * 4 + 2] = P.rnd[i]; stat[i * 4 + 3] = P.kind[i]; }
    dyn = new Float32Array(cap * 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL.sbuf);
    gl.bufferData(gl.ARRAY_BUFFER, stat, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL.dbuf);
    gl.bufferData(gl.ARRAY_BUFFER, dyn.byteLength, gl.DYNAMIC_DRAW);
    sDirty = [Infinity, -1];
    // La copie du mot, avec ses niveaux réduits (la couleur moyenne d'un éclat changé en grain ou en feuille)
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, S.cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Le canevas couvre toute la capsule : les éclats peuvent voler partout, la capsule les rogne
    const dpr = S.dpr;
    GL.cv.width = Math.round(E.W * dpr);
    GL.cv.height = Math.round(E.H * dpr);
    const paper = rgbOf(S.paper), ink = rgbOf(S.ink);
    GL.back = paper.map((v, k) => v + (ink[k] - v) * 0.2);
    stats.n = P.n; stats.cap = P.cap;
    ready = true;
    D.ready = true;
    card.dispatchEvent(new CustomEvent('topiary:desint-ready'));
  }

  function draw() {
    const gl = GL.gl, L = GL.loc, sz = def.sizes || {}, U = Math.sqrt(E.U), c = P.cell;
    gl.viewport(0, 0, GL.cv.width, GL.cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(GL.prog);
    gl.bindVertexArray(GL.vao);
    if (sDirty[1] >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, GL.sbuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, sDirty[0] * 16, stat, sDirty[0] * 4, (sDirty[1] - sDirty[0] + 1) * 4);
      sDirty = [Infinity, -1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, GL.dbuf);
    if (dHi >= dLo) { gl.bufferSubData(gl.ARRAY_BUFFER, dLo * 32, dyn, dLo * 8, (dHi - dLo + 1) * 8); dHi = -1; }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.uniform1i(L.uTex, 0);
    gl.uniform2f(L.uCard, E.W, E.H);
    const speck = (sz.speck || 0.32) * c, ring = (sz.ring || 1.1) * c, ringW = (sz.ringW || 0.11) * c, grain = (sz.grain || 0.46) * c;
    const leafL = (sz.leafL || 0.62) * c, leafW = (sz.leafW || 0.24) * c;
    const ext = Math.max(1.62 * c, (ring + ringW) * 1.4, leafL * 1.4, grain * 1.4, speck * 1.6);
    gl.uniform1f(L.uQuad, ext);
    gl.uniform1ui(L.uSeed, SEED);
    gl.uniform1f(L.uCell, c);
    gl.uniform1f(L.uJit, def.jitter);
    gl.uniform2f(L.uBox, S.box.x, S.box.y);
    gl.uniform2f(L.uBoxSize, S.box.w, S.box.h);
    gl.uniform2f(L.uBoxDev, S.box.x * S.dpr, S.box.y * S.dpr);
    gl.uniform2i(L.uTexSize, S.W, S.H);
    gl.uniform1f(L.uDpr, S.dpr);
    gl.uniform1f(L.uDevH, GL.cv.height);
    gl.uniform1f(L.uLod, Math.max(0, Math.log2(c * S.dpr) - 0.5));
    gl.uniform4f(L.uSz, speck, ring, ringW, grain);
    gl.uniform2f(L.uLeaf, leafL, leafW);
    gl.uniform3fv(L.uBack, GL.back);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(L.uPass, 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, P.cap);
    gl.uniform1i(L.uPass, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, P.cap);
    gl.bindVertexArray(null);
  }

  // Les tableaux de la simulation vers le tampon d'instances ; compte ce qui bouge encore. Un éclat déjà écrit au repos
  // (mv 0) ou déjà écrit caché (mv 2) n'est pas réécrit ; seule la plage réécrite part vers la carte graphique.
  let dLo = 0, dHi = -1;
  function pack() {
    const p = P, d = dyn;
    let moving = 0, lo = p.cap, hi = -1;
    for (let i = 0, o = 0; i < p.cap; i++, o += 8) {
      const al = p.al[i];
      if (al === 0) {
        if (p.mv[i] === 2) continue;
        d[o + 5] = 0; p.mv[i] = 2;
        if (i < lo) lo = i;
        hi = i;
        continue;
      }
      const rest = al === 1 && p.s[i] === 1 && p.m[i] === 0 && p.f[i] === 1 && p.a[i] === 0 && p.x[i] === p.hx[i] && p.y[i] === p.hy[i];
      if (rest && p.mv[i] === 0) continue;
      d[o] = p.x[i]; d[o + 1] = p.y[i]; d[o + 2] = p.a[i]; d[o + 3] = p.s[i];
      d[o + 4] = p.m[i]; d[o + 5] = al; d[o + 6] = p.f[i]; d[o + 7] = rest ? 0 : 1;
      p.mv[i] = rest ? 0 : 1;
      if (i < lo) lo = i;
      hi = i;
      if (!rest) moving++;
    }
    dLo = lo; dHi = hi;
    return moving;
  }

  /* ---------- Pointeur ---------- */
  function zone(x, y, m) {
    const b = S.box;
    return x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m;
  }
  function pointer(dt, now) {
    const r = card.getBoundingClientRect();
    const x = ptr.cx - r.left, y = ptr.cy - r.top;
    if (ptr.fresh || !ptr.over) { ptr.lx = x; ptr.ly = y; ptr.vx = 0; ptr.vy = 0; ptr.fresh = !ptr.over; }
    else { ptr.lx = ptr.x; ptr.ly = ptr.y; }
    // Vitesse lue sur les coordonnées de l'écran (un défilement sans geste ne souffle rien), lissée
    const rx = (ptr.cx - (ptr.pcx ?? ptr.cx)) / dt, ry = (ptr.cy - (ptr.pcy ?? ptr.cy)) / dt;
    ptr.pcx = ptr.cx; ptr.pcy = ptr.cy;
    const k = 1 - Math.exp(-dt * 30);
    if (ptr.over) { ptr.vx += (rx - ptr.vx) * k; ptr.vy += (ry - ptr.vy) * k; }
    else { ptr.vx = 0; ptr.vy = 0; }
    ptr.speed = Math.hypot(ptr.vx, ptr.vy);
    if (ptr.over) { ptr.x = x; ptr.y = y; }
    const inside = ptr.over && zone(x, y, 14 * E.U + 6);
    if (inside && !ptr.inside) ptr.enteredAt = now / 1000;
    if (!inside && ptr.inside) ptr.leftAt = now / 1000;
    ptr.inside = inside;
    ptr.near = ptr.over && zone(x, y, 90 * E.U + 20);
    ptr.idle = now / 1000 - ptr.lastMove;
  }
  function onMove(e) {
    if (ptr.synthetic) return;
    if (e.pointerType === 'touch' && e.type === 'pointermove' && !ptr.over) return;
    ptr.type = e.pointerType;
    ptr.cx = e.clientX; ptr.cy = e.clientY;
    if (!ptr.over) { ptr.over = true; ptr.fresh = true; ptr.pcx = e.clientX; ptr.pcy = e.clientY; }
    ptr.lastMove = performance.now() / 1000;
    wake();
  }
  function onLeave(e) {
    if (ptr.synthetic) return;
    if (e && e.type === 'pointerup' && e.pointerType !== 'touch') return;
    ptr.over = false;
    wake();
  }

  /* ---------- Boucle ---------- */
  function wake() {
    if (!ready || manual || !onScreen || doc.hidden || reduce.matches || forced.matches || !GL || GL.lost) return;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function frame(now) {
    raf = 0;
    if (!ready) return;
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    const keep = tick(dt, now);
    if (keep) raf = requestAnimationFrame(frame);
  }
  function tick(dt, now) {
    pointer(dt, now);
    E.now = now / 1000;
    E.dt = dt;
    const t0 = performance.now();
    const busy = def.step(P, E, dt);
    const t1 = performance.now();
    const moving = pack();
    const t2 = performance.now();
    draw();
    const t3 = performance.now();
    if (!on) show(true);
    const a = 0.1;
    stats.frames++;
    stats.step += (t1 - t0 - stats.step) * a;
    stats.pack += (t2 - t1 - stats.pack) * a;
    stats.draw += (t3 - t2 - stats.draw) * a;
    stats.moving = moving;
    const live = busy || moving > 0;
    if (live || (ptr.inside && ptr.idle < 0.25)) return true;
    if (!ptr.inside) show(false);
    return false;
  }
  function show(v) {
    if (on === v) return;
    on = v;
    card.classList.toggle('desint-on', v);
  }
  // Tout remettre en place sur-le-champ (changement de version, mise en page, hors écran)
  function stop(hide) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (P) for (let i = 0; i < P.cap; i++) { home(P, i); if (i >= P.n) P.al[i] = 0; P.mv[i] = 1; }
    if (P && def && def.reset) def.reset(P, E);
    if (hide && card) { card.classList.remove('desint-on'); on = false; }
  }

  /* ---------- Version choisie ---------- */
  D.set = (id) => {
    const next = D.list.find((d) => d.id === id) || D.list[0];
    if (!next) return null;
    const live = ready && S;
    if (live) stop(true); // avec la version sortante, qui range son propre état
    def = next;
    if (card) card.dataset.desint = def.id;
    if (live) build();
    return def;
  };
  D.current = () => def && def.id;

  // Banc d'essai : pointeur de synthèse (px CSS de la capsule) et images pas à pas, sans requestAnimationFrame
  D.bench = {
    manual(v) { manual = !!v; if (manual) { cancelAnimationFrame(raf); raf = 0; } },
    pointer(x, y, over = true) {
      ptr.synthetic = true;
      const r = card.getBoundingClientRect();
      if (over && !ptr.over) { ptr.fresh = true; ptr.pcx = x + r.left; ptr.pcy = y + r.top; }
      ptr.cx = x + r.left; ptr.cy = y + r.top; ptr.over = over;
      if (over) ptr.lastMove = (manual ? D.bench.t : performance.now()) / 1000;
      wake();
    },
    release() { ptr.synthetic = false; ptr.over = false; },
    t: 0,
    step(ms) { D.bench.t += ms; return tick(ms / 1000, D.bench.t); },
    reset() { stop(true); E.reseed(20261021); D.bench.t = performance.now(); },
    rebuild() { prepare(); return ready; },
    show(v) { if (v) { pack(); draw(); } show(!!v); },
    state: () => ({ ready, on, n: P && P.n, cap: P && P.cap, cell: P && P.cell, box: S && S.box }),
    get E() { return E; }, get P() { return P; },
  };

  /* ---------- Démarrage ---------- */
  function boot() {
    card = doc.querySelector('.hero__card');
    if (!card) return;
    def = def || D.list[0];
    if (def) card.dataset.desint = def.id;
    const mark = card.querySelector('.hero__mark');
    if (mark) mark.style.touchAction = 'pan-y';
    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerdown', onMove, { passive: true });
    card.addEventListener('pointerleave', onLeave, { passive: true });
    card.addEventListener('pointerup', onLeave, { passive: true });
    card.addEventListener('pointercancel', onLeave, { passive: true });
    const onFit = (G) => {
      geom = G;
      ready = false;
      stop(true);
      // La première fois, on laisse la haie pousser et les enfants s'installer (≈ 3,9 s d'images réellement
      // affichées : un onglet ouvert en arrière-plan ne fait pas avancer l'intro) ; ensuite, le temps que
      // signatures.js redessine le relief après un ajustement (90 ms)
      if (!firstFit) { firstFit = performance.now(); introClock(); } else if (introMs >= INTRO) schedule(350);
    };
    card.addEventListener('topiary:fit', (e) => onFit(e.detail));
    if (g.topiaryGeom) onFit(g.topiaryGeom);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (!onScreen) stop(true); }).observe(card);
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(true); });
    const re = () => { if (reduce.matches || forced.matches) { stop(true); ready = false; } else if (geom) schedule(50); };
    reduce.addEventListener('change', re);
    forced.addEventListener('change', re);
  }
  D.boot = boot;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
