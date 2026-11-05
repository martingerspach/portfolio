// Banc : le banc de poissons en caractères (WebGL2).
// Un vrai banc : beaucoup de petits poissons qui tournent ensemble en tourbillon autour
// de la question (le « moulin » des sardines), et quelques grands poissons plus proches.
// Passe 1 : chaque poisson est rendu dans un « champ » (4 × 4 texels par case) : épaisseur,
// encre, couverture, et le sens de la nage. Passe 2 : chaque case choisit son caractère.

const params = new URLSearchParams(location.search);
export const P = (k, d) => (params.has(k) ? Number(params.get(k)) : d);   // réglages de banc d'essai
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// la rampe de densité, du plus clair au plus dense
const RAMP = ['.', ':', '-', '=', '+', '*', '#', '%', '@'];
// le trait suit une direction : horizontal, descendant, vertical, montant
const EDGES = ['-', '\\', '|', '/'];
const EYE = 'o';
const ATLAS = [...RAMP, ...EDGES, EYE];

// petit poisson (sardine) : corps fuselé, pédoncule fin, caudale en V
function sardineHalf(s) {
  if (s < 0.22) { const u = 1 - s / 0.22; return 0.095 * Math.pow(1 - u * u, 0.55); }
  if (s < 0.8) { const u = (s - 0.22) / 0.58; return 0.095 * (1 - Math.pow(u, 1.7) * 0.72); }
  const u = (s - 0.8) / 0.2; return 0.027 + Math.pow(u, 0.8) * 0.085;
}
// grand poisson (bar) : plus haut, tête plus longue, grande fourche
function bassHalf(s) {
  if (s < 0.27) { const u = 1 - s / 0.27; return 0.12 * Math.pow(1 - Math.pow(u, 2.1), 0.6); }
  if (s < 0.82) { const u = (s - 0.27) / 0.55; return 0.12 * (1 - Math.pow(u, 2) * 0.72); }
  const u = (s - 0.82) / 0.18; return 0.034 + Math.pow(u, 0.7) * 0.14;
}

const VS_FIELD = `#version 300 es
in vec2 aP; in vec4 aA; in vec2 aB;
uniform vec2 uField;
out vec4 vA; out vec2 vB;
void main(){ vA = aA; vB = aB; gl_Position = vec4(aP / uField * 2.0 - 1.0, 0.0, 1.0); }`;

// sorties : o0 = (épaisseur, encre, œil, couverture) ; o1 = (cos 2θ, sin 2θ, petit poisson, 0) en 0..1
const FS_FIELD = `#version 300 es
precision highp float;
in vec4 vA; in vec2 vB;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
void main(){
  float v = vA.x, s = vA.y, ink = vA.z, kind = vA.w;
  vec2 dir = vB * 0.5 + 0.5;
  if (kind < 0.5) {                       // grand poisson : corps
    float r = pow(max(1.0 - v * v, 0.0), 1.1);
    float th = r * mix(1.0, 0.62, smoothstep(0.45, 0.82, s));
    if (s > 0.82) {
      float u = (s - 0.82) / 0.18;
      th = 0.38 + 0.14 * (1.0 - abs(v));
      if (u > 0.22 && abs(v) < pow((u - 0.22) / 0.78, 0.85) * 0.84) discard;   // fourche
    }
    float back = (1.0 - smoothstep(0.0, 0.5, abs(v))) * step(s, 0.82) * smoothstep(0.03, 0.16, s);
    o0 = vec4(th, ink * (0.66 + 0.34 * back), 0.0, 1.0);
    o1 = vec4(dir, 0.0, 0.0);
  } else if (kind < 1.5) {                // grand poisson : nageoires
    o0 = vec4(0.34, ink * 0.72, 0.0, 1.0);
    o1 = vec4(dir, 0.0, 0.0);
  } else if (kind < 2.5) {                // grand poisson : œil
    o0 = vec4(0.85, min(1.0, ink * 1.15), 1.0, 1.0);
    o1 = vec4(dir, 0.0, 0.0);
  } else {                                // petit poisson
    float r = pow(max(1.0 - v * v, 0.0), 0.9);
    float th = r * mix(1.0, 0.55, smoothstep(0.35, 0.8, s));
    if (s > 0.8) {
      float u = (s - 0.8) / 0.2;
      th = 0.3;
      if (u > 0.35 && abs(v) < (u - 0.35) / 0.65 * 0.7) discard;
    }
    float head = 1.0 - smoothstep(0.1, 0.3, s);
    o0 = vec4(th * mix(1.0, 1.15, head), ink * mix(1.0, 1.12, head), 0.0, 1.0);
    o1 = vec4(dir, 1.0, 0.0);
  }
}`;

const VS_QUAD = `#version 300 es
in vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }`;

const FS_GLYPH = `#version 300 es
precision highp float;
uniform sampler2D uF0, uF1, uAtlas;
uniform vec2 uFieldSize, uCanvas;
uniform float uCell, uN, uFade, uRn, uCount, uEdge, uCalm, uSmallMin;
uniform vec4 uR[8];
uniform vec2 uRL[8];   // pour chaque zone : niveau sous la zone, largeur du fondu (px)
uniform vec3 uC0, uC1, uC2;
out vec4 o;
float glyph(float i, vec2 f){ return texture(uAtlas, vec2((i + f.x) / uCount, f.y)).a; }
vec4 avg(sampler2D t, vec2 cell){
  vec2 b = cell * 4.0;
  return 0.25 * (texture(t, (b + vec2(1.0, 1.0)) / uFieldSize) + texture(t, (b + vec2(3.0, 1.0)) / uFieldSize)
               + texture(t, (b + vec2(1.0, 3.0)) / uFieldSize) + texture(t, (b + vec2(3.0, 3.0)) / uFieldSize));
}
// un trait orienté selon l'angle (y vers le bas), en fondu entre deux directions voisines
float stroke(float ang, vec2 f){
  float q = mod(ang / 3.14159265 * 4.0, 4.0);
  float q0 = floor(q), qt = smoothstep(0.3, 0.7, q - q0);
  return mix(glyph(uN + q0, f), glyph(uN + mod(q0 + 1.0, 4.0), f), qt);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 cell = floor(p / uCell);
  vec2 f = (p - cell * uCell) / uCell;
  vec4 a0 = avg(uF0, cell);
  float cov = a0.a;
  if (cov < 0.05) { o = vec4(0.0); return; }
  vec4 a1 = avg(uF1, cell);
  float smallA = a1.b / cov;
  // un petit poisson tient sur une case de large : les cases à peine effleurées restent vides
  float covMin = mix(0.05, uSmallMin, smallA);
  if (cov < covMin) { o = vec4(0.0); return; }
  float d = a0.r;                                  // épaisseur moyenne de la case
  float tone = a0.g / cov;
  float small = a1.b / cov;                        // part de petits poissons dans la case
  vec2 cs = a1.rg / cov * 2.0 - 1.0;               // sens moyen de la nage (angle doublé)
  float heading = 0.5 * atan(cs.y, cs.x);
  float align = length(cs);                        // 1 : tous dans le même sens
  // volume : la rampe, en fondu entre deux niveaux voisins
  // la rampe s'arrête à « # » pour les grands poissons : jamais un pavé plus noir que le texte
  float lev = clamp(pow(d, 0.82), 0.0, 1.0) * mix(6.2, uN - 1.0, small);
  float i0 = floor(lev), t = smoothstep(0.3, 0.7, lev - i0);
  float g = mix(glyph(i0, f), glyph(min(i0 + 1.0, uN - 1.0), f), t);
  // contour des grands poissons : le caractère suit le bord
  float dl = avg(uF0, cell - vec2(1.0, 0.0)).r, dr = avg(uF0, cell + vec2(1.0, 0.0)).r;
  float du = avg(uF0, cell - vec2(0.0, 1.0)).r, dd = avg(uF0, cell + vec2(0.0, 1.0)).r;
  vec2 gr = vec2(dr - dl, dd - du) * 0.5;
  float edge = uEdge * smoothstep(0.1, 0.22, length(gr)) * (1.0 - smoothstep(0.42, 0.6, d)) * (1.0 - small);
  if (edge > 0.0) g = mix(g, stroke(atan(gr.x, -gr.y), f), edge);
  // petits poissons : là où le corps est mince, le trait suit le sens de la nage
  float thin = small * smoothstep(0.35, 0.75, align) * (1.0 - smoothstep(0.18, 0.3, d));
  if (thin > 0.0) g = mix(g, stroke(heading, f), thin);
  if (a0.b / cov > 0.62) { g = glyph(uN + 4.0, f); tone = 0.9; }
  float al = smoothstep(covMin, covMin + 0.1, cov);
  // zones calmes : le banc passe sous le texte en s'effaçant
  vec2 cc = (cell + 0.5) * uCell;
  float calm = 1.0;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= uRn) break;
    vec4 r = uR[k];
    vec2 qd = max(max(r.xy - cc, cc - r.zw), 0.0);
    calm = min(calm, mix(uRL[k].x, 1.0, smoothstep(0.0, uRL[k].y, length(qd))));
  }
  al *= calm;
  float tn = clamp(tone * (0.72 + 0.42 * d), 0.0, 1.0);
  vec3 c = tn < 0.5 ? mix(uC0, uC1, tn / 0.5) : mix(uC1, uC2, (tn - 0.5) / 0.5);
  float A = al * g;
  o = vec4(c * A, A);
}`;

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createSchool(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: params.has('shot') });
  if (!gl) return null;

  const pField = compile(gl, VS_FIELD, FS_FIELD);
  const pGlyph = compile(gl, VS_QUAD, FS_GLYPH);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const uFieldLoc = U(pField, 'uField');
  const uG = {};
  for (const n of ['uF0', 'uF1', 'uAtlas', 'uFieldSize', 'uCanvas', 'uCell', 'uN', 'uFade', 'uRn', 'uR', 'uC0', 'uC1', 'uC2', 'uCount', 'uEdge', 'uCalm', 'uSmallMin', 'uRL']) uG[n] = U(pGlyph, n);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vaoQ = gl.createVertexArray();
  gl.bindVertexArray(vaoQ);
  const aQ = gl.getAttribLocation(pGlyph, 'aP');
  gl.enableVertexAttribArray(aQ);
  gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);

  const STRIDE = 8;
  const mesh = gl.createBuffer();
  const vaoM = gl.createVertexArray();
  gl.bindVertexArray(vaoM);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
  const aP = gl.getAttribLocation(pField, 'aP'), aA = gl.getAttribLocation(pField, 'aA'), aB = gl.getAttribLocation(pField, 'aB');
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, STRIDE * 4, 0);
  gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 4, gl.FLOAT, false, STRIDE * 4, 8);
  gl.enableVertexAttribArray(aB); gl.vertexAttribPointer(aB, 2, gl.FLOAT, false, STRIDE * 4, 24);
  gl.bindVertexArray(null);

  let tex0 = null, tex1 = null, fbo = null, atlasTex = null;
  let W = 0, H = 0, dpr = 1, cellDev = 9, fw = 0, fh = 0;
  let verts = new Float32Array(1 << 17);
  const fish = [];
  const st = {
    cx: 0, cy: 0, rx: 300, ry: 200, dir: 1, t: 0,
    rects: [], avoid: [], tight: 0, tightTo: 0, listen: 0, listenTo: 0,
  };

  function makeTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function makeAtlas() {
    const n = ATLAS.length;
    const cv = document.createElement('canvas');
    cv.width = cellDev * n; cv.height = cellDev;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `${P('gw', 500)} ${Math.round(cellDev * P('gs', 1.14))}px "JetBrains Mono", ui-monospace, monospace`;
    ATLAS.forEach((g, i) => x.fillText(g, i * cellDev + cellDev / 2, cellDev * 0.56));
    if (!atlasTex) atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function resize(w, h) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && d === dpr && tex0) return false;
    const first = !W;
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    W = w; H = h; dpr = d;
    const cssCell = P('cell', w >= 1024 ? 9 : w >= 700 ? 8 : 7);
    cellDev = Math.max(7, Math.round(cssCell * dpr));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    fw = Math.ceil(canvas.width / cellDev) * 4; fh = Math.ceil(canvas.height / cellDev) * 4;
    if (tex0) { gl.deleteTexture(tex0); gl.deleteTexture(tex1); }
    tex0 = makeTex(); tex1 = makeTex();
    if (!fbo) fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex1, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    makeAtlas();
    if (first) populate();
    else for (const f of fish) {              // on garde le banc, on le recale
      for (let j = 0; j < f.K * 2; j += 2) { f.p[j] *= sx; f.p[j + 1] *= sy; }
      f.x *= sx; f.y *= sy;
    }
    return true;
  }

  /* ---------- le banc ---------- */
  function makeFish(o) {
    const K = o.kind === 'big' ? 26 : 9;
    const f = Object.assign({ K, p: new Float32Array(K * 2), c: new Float32Array(K * 2), turn: 0, boost: 0, mode: 'mill', delay: 0 }, o);
    f.profile = Array.from({ length: K }, (_, j) => (f.kind === 'big' ? bassHalf : sardineHalf)(j / (K - 1)));
    f.phase = f.seed * 6.28;
    f.u = f.cruise;
    lay(f);
    return f;
  }
  function lay(f) {
    const seg = f.L / (f.K - 1);
    for (let j = 0; j < f.K; j++) { f.p[j * 2] = f.x - Math.cos(f.a) * seg * j; f.p[j * 2 + 1] = f.y - Math.sin(f.a) * seg * j; }
  }

  function populate() {
    fish.length = 0;
    const r = rng(11);
    const scale = clamp(Math.min(W, H * 1.4) / 1100, 0.5, 1.15);
    const nS = Math.round(P('ns', W >= 1024 ? 140 : W >= 700 ? 90 : 52));
    const nB = Math.round(P('nb', W >= 1024 ? 2 : 1));
    st.scale = scale;
    // les petits : trois profondeurs, chacun sur son propre anneau
    for (let i = 0; i < nS; i++) {
      const depth = Math.pow(r(), 0.8);                  // 0 loin, 1 près
      const L = (P('ls', 64) + depth * P('ld', 34) + r() * 10) * Math.max(scale, 0.62);
      const ang = r() * Math.PI * 2;
      // un sur sept est curieux : il tourne plus près de la question et passe sous le verre
      const curious = r() < P('cur', 0.15);
      const rf = curious ? 0.5 + r() * 0.16 : 0.74 + r() * 0.52;
      const rfy = rf * (curious ? 0.42 + r() * 0.2 : 0.9 + r() * 0.2);
      fish.push(makeFish({
        kind: 'small', L, depth, rf, rfy,
        ink: 0.22 + depth * 0.62,
        x: W / 2 + Math.cos(ang) * W * 0.3 * rf, y: H / 2 + Math.sin(ang) * H * 0.3 * rfy,
        a: ang + Math.PI / 2, ang,
        cruise: L * (1.25 + r() * 0.3),
        seed: r(),
      }));
    }
    // les grands : plus près, plus lents, au large de l'anneau
    for (let i = 0; i < nB; i++) {
      const L = (P('lb', 230) + r() * 40) * scale;
      const ang = (i / nB) * Math.PI * 2 + 0.6;
      const rf = P('brf', 0.98) + r() * 0.06;
      fish.push(makeFish({
        kind: 'big', L, depth: 1, rf, rfy: rf * 0.95,
        ink: 0.5 + r() * 0.06,
        x: W / 2 + Math.cos(ang) * W * 0.36, y: H / 2 + Math.sin(ang) * H * 0.34,
        a: ang + Math.PI / 2, ang,
        cruise: L * (0.3 + r() * 0.05),
        seed: r(),
      }));
    }
    // le dessin : les lointains d'abord, les grands en dernier
    fish.sort((a, b) => (a.kind === 'big') - (b.kind === 'big') || a.depth - b.depth);
  }

  /* ---------- nage ---------- */
  function step(dt) {
    st.t += dt;
    const t = st.t;
    st.tight += (st.tightTo - st.tight) * Math.min(1, dt * 1.2);
    st.listen += (st.listenTo - st.listen) * Math.min(1, dt * 1.5);
    const shrink = 1 - st.listen * (1 - st.tight) * P('ecoute', 0.3);
    const thin = 1 - 0.78 * st.tight;   // resserré : un anneau fin
    const n = fish.length;
    for (let i = 0; i < n; i++) {
      const f = fish[i];
      if (f.mode === 'away') continue;
      if (f.delay > 0) { f.delay -= dt; }
      const big = f.kind === 'big';
      let gx = 0, gy = 0;
      if (f.mode === 'leave' && f.delay <= 0) {
        gx = f.exit[0] - f.x; gy = f.exit[1] - f.y;
        const m = Math.hypot(gx, gy) || 1; gx = gx / m * 3; gy = gy / m * 3;
        const margin = f.L * 1.1;
        if (f.x < -margin || f.x > W + margin || f.y < -margin || f.y > H + margin) { f.mode = 'away'; continue; }
      } else {
        // l'anneau : la tangente, et un rappel vers son propre rayon
        const frf = big ? f.rf + 0.2 * st.tight : 1 + (f.rf - 1) * thin, frfy = big ? f.rfy + 0.25 * st.tight : 1 + (f.rfy / f.rf * f.rf - 1) * thin;
        const rx = st.rx * frf * (big ? 1 : shrink), ry = st.ry * frfy * (big ? 1 : shrink);
        const ex = (f.x - st.cx) / rx, ey = (f.y - st.cy) / ry;
        const r = Math.hypot(ex, ey) + 1e-6;
        let tx = -ey * rx * st.dir, ty = ex * ry * st.dir;
        const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
        let nx = ex / rx, ny = ey / ry; const nm = Math.hypot(nx, ny) || 1; nx /= nm; ny /= nm;
        const radial = clamp(1 - r, -1.4, 1.4) * (big ? 1.6 : 2.6);
        gx = tx + nx * radial; gy = ty + ny * radial;
      }
      // voisins : séparation, alignement, un peu de cohésion
      let sx = 0, sy = 0, ax = 0, ay = 0, ccx = 0, ccy = 0, cn = 0;
      const sepR = big ? f.L * 0.7 : f.L * 0.62, aliR = f.L * 2.2;
      for (let k = 0; k < n; k++) {
        const o = fish[k];
        if (o === f || o.mode === 'away') continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        if (dx > aliR + 200 || dx < -aliR - 200 || dy > aliR + 200 || dy < -aliR - 200) continue;
        const d = Math.hypot(dx, dy) || 1;
        const same = big || o.kind === 'big' ? 0.25 : 1 - Math.abs(f.depth - o.depth) * 0.85;
        const sep = o.kind === 'big' ? (o.L * 0.45 + f.L * 0.3) : sepR;
        if (d < sep) { const k2 = (1 - d / sep) * (0.5 + 1.6 * same); sx += dx / d * k2; sy += dy / d * k2; }
        if (!big && o.kind !== 'big' && d < aliR) { ax += Math.cos(o.a) * same; ay += Math.sin(o.a) * same; ccx += o.x; ccy += o.y; cn++; }
      }
      gx += sx * 1.5 + ax * 0.08; gy += sy * 1.5 + ay * 0.08;
      if (cn > 0 && f.mode !== 'leave') { gx += ((ccx / cn) - f.x) / aliR * 0.25; gy += ((ccy / cn) - f.y) / aliR * 0.25; }
      // le texte : on le contourne (les zones d'évitement), sans y entrer de front
      if (f.mode !== 'leave') for (const R of st.avoid) {
        if (R[4] && !big) continue;
        const m = big ? 70 : 34;
        const qx = clamp(f.x, R[0], R[2]), qy = clamp(f.y, R[1], R[3]);
        let dx = f.x - qx, dy = f.y - qy, d = Math.hypot(dx, dy);
        if (d === 0) { dx = f.x - (R[0] + R[2]) / 2; dy = f.y - (R[1] + R[3]) / 2; d = Math.hypot(dx, dy) || 1; gx += dx / d * 1.2; gy += dy / d * 1.2; }
        else if (d < m) { const k2 = (1 - d / m) * 0.9; gx += dx / d * k2; gy += dy / d * k2; }
      }
      // bords
      const b = big ? f.L * 1.0 : 30;           // les grands restent entiers dans le cadre
      if (f.mode !== 'leave') {
        const k = big ? 2.2 : 1;
        if (f.x < b) gx += (b - f.x) / b * k; if (f.x > W - b) gx -= (f.x - W + b) / b * k;
        if (f.y < b) gy += (b - f.y) / b * k; if (f.y > H - b) gy -= (f.y - H + b) / b * k;
      }
      const wander = 0.3 * Math.sin(t * 0.37 + f.seed * 40) + 0.2 * Math.sin(t * 0.83 + f.seed * 91);
      const want = Math.atan2(gy, gx) + wander * (f.mode === 'leave' ? 0.15 : big ? 0.6 : 1);
      let da = want - f.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const maxTurn = (f.mode === 'leave' ? 3.2 : big ? 0.9 : 2.4) * dt;
      f.turn = clamp(da * (big ? 1.8 : 3.4) * dt, -maxTurn, maxTurn);
      f.a += f.turn;
      // vitesse : un banc attaqué file d'un coup, puis chacun reprend sa croisière
      f.boost = Math.max(0, f.boost - dt * 0.6);
      const leaving = f.mode === 'leave' && f.delay <= 0;
      const target = f.cruise * (1 + (leaving ? (big ? 2.2 : 3.6) : 0) + f.boost * 1.8) * (1 - st.tight * 0.2 - st.listen * 0.12)
        * (1 + 0.12 * Math.sin(t * 0.9 + f.seed * 17));
      f.u += (target - f.u) * Math.min(1, dt * (leaving ? 3.2 : 1.2));
      f.x += Math.cos(f.a) * f.u * dt; f.y += Math.sin(f.a) * f.u * dt;
      // battement : la queue bat plus vite quand le poisson accélère
      f.phase += dt * Math.PI * 2 * ((big ? 0.5 : 1.6) + (f.u / f.L) * (big ? 1.3 : 0.9));
      const seg = f.L / (f.K - 1);
      f.p[0] = f.x; f.p[1] = f.y;
      for (let j = 1; j < f.K; j++) {
        const q = j * 2;
        const dx = f.p[q] - f.p[q - 2], dy = f.p[q + 1] - f.p[q - 1];
        const d = Math.hypot(dx, dy) || 1;
        f.p[q] = f.p[q - 2] + dx / d * seg; f.p[q + 1] = f.p[q - 1] + dy / d * seg;
      }
    }
  }

  /* ---------- maillage ---------- */
  const bb = [0, 0, 0, 0];                    // boîte des poissons (px CSS), pour le ciseau sous 900 px
  function build() {
    let n = 0;
    const kx = fw / (W || 1), ky = fh / (H || 1);
    let cx2 = 1, sx2 = 0;
    bb[0] = bb[1] = Infinity; bb[2] = bb[3] = -Infinity;
    const push = (x, y, v, s, ink, kind) => {
      if (n + STRIDE > verts.length) { const nv = new Float32Array(verts.length * 2); nv.set(verts); verts = nv; }
      if (x < bb[0]) bb[0] = x; if (x > bb[2]) bb[2] = x; if (y < bb[1]) bb[1] = y; if (y > bb[3]) bb[3] = y;
      verts[n++] = x * kx; verts[n++] = y * ky; verts[n++] = v; verts[n++] = s; verts[n++] = ink; verts[n++] = kind; verts[n++] = cx2; verts[n++] = sx2;
    };
    for (const f of fish) {
      if (f.mode === 'away') continue;
      const K = f.K, L = f.L, c = f.c, p = f.p, big = f.kind === 'big';
      for (let j = 0; j < K; j++) {
        const s = j / (K - 1), i = j * 2;
        const jn = Math.min(j, K - 2) * 2;
        let tx = p[jn] - p[jn + 2], ty = p[jn + 1] - p[jn + 3];
        const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
        const amp = L * (big ? 0.01 + 0.07 * s * s : 0.006 + 0.06 * s * s) * (0.75 + Math.min(1.2, f.u / f.L * (big ? 1 : 0.4)));
        const lat = amp * Math.sin(Math.PI * 2 * s * 0.95 - f.phase);
        c[i] = p[i] - ty * lat; c[i + 1] = p[i + 1] + tx * lat;
      }
      const Lp = [], Rp = [], T = [];
      for (let j = 0; j < K; j++) {
        const i = j * 2;
        const a = Math.max(0, j - 1) * 2, b = Math.min(K - 1, j + 1) * 2;
        let tx = c[a] - c[b], ty = c[a + 1] - c[b + 1];
        const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
        const w = f.profile[j] * L;
        Lp.push([c[i] - ty * w, c[i + 1] + tx * w]);
        Rp.push([c[i] + ty * w, c[i + 1] - tx * w]);
        T.push([tx, ty]);
      }
      const dir2 = (j) => { const [tx, ty] = T[j]; cx2 = tx * tx - ty * ty; sx2 = 2 * tx * ty; };
      const kindBody = big ? 0 : 3;
      if (big) {
        // pectorales qui battent doucement
        const flap = 0.5 + 0.35 * Math.sin(f.phase * 0.5 + 1.3) + Math.abs(f.turn || 0) * 4;
        const j0 = Math.round(0.24 * (K - 1)), j1 = Math.round(0.34 * (K - 1));
        dir2(j0);
        const ang = 0.5 + flap * 0.18, len = L * 0.12;
        for (const side of [-1, 1]) {
          const r0 = side < 0 ? Lp[j0] : Rp[j0], r1 = side < 0 ? Lp[j1] : Rp[j1];
          const [tx, ty] = T[j0];
          const nx = side < 0 ? -ty : ty, ny = side < 0 ? tx : -tx;
          const dx = (-tx * Math.cos(ang) + nx * Math.sin(ang)) * len, dy = (-ty * Math.cos(ang) + ny * Math.sin(ang)) * len;
          const a2 = ang * 0.62;
          const ex = (-tx * Math.cos(a2) + nx * Math.sin(a2)) * len * 0.43, ey = (-ty * Math.cos(a2) + ny * Math.sin(a2)) * len * 0.43;
          const tip = [r0[0] + dx, r0[1] + dy], back = [r1[0] + ex, r1[1] + ey];
          push(r0[0], r0[1], 0, 0, f.ink, 1); push(r1[0], r1[1], 0, 0, f.ink, 1); push(tip[0], tip[1], 0, 0, f.ink, 1);
          push(r1[0], r1[1], 0, 0, f.ink, 1); push(back[0], back[1], 0, 0, f.ink, 1); push(tip[0], tip[1], 0, 0, f.ink, 1);
        }
      }
      for (let j = 0; j < K - 1; j++) {
        const s0 = j / (K - 1), s1 = (j + 1) / (K - 1);
        const a = Lp[j], b = Rp[j], c2 = Lp[j + 1], d = Rp[j + 1];
        dir2(j);
        push(a[0], a[1], -1, s0, f.ink, kindBody); push(b[0], b[1], 1, s0, f.ink, kindBody); push(c2[0], c2[1], -1, s1, f.ink, kindBody);
        push(b[0], b[1], 1, s0, f.ink, kindBody); push(d[0], d[1], 1, s1, f.ink, kindBody); push(c2[0], c2[1], -1, s1, f.ink, kindBody);
      }
      if (!big) continue;
      const je = Math.round(0.08 * (K - 1));
      const [etx, ety] = T[je];
      const er = L * 0.011;
      for (const side of [-1, 1]) {
        const w = f.profile[je] * L * 0.62 * side;
        const ex = c[je * 2] - ety * w, ey = c[je * 2 + 1] + etx * w;
        push(ex - er, ey - er, 0, 0, f.ink, 2); push(ex + er, ey - er, 0, 0, f.ink, 2); push(ex - er, ey + er, 0, 0, f.ink, 2);
        push(ex + er, ey - er, 0, 0, f.ink, 2); push(ex + er, ey + er, 0, 0, f.ink, 2); push(ex - er, ey + er, 0, 0, f.ink, 2);
      }
    }
    return n / STRIDE;
  }

  const C0 = hex('#a7b0ba'), C1 = hex('#4e6276'), C2 = hex('#0f151c');
  const R = new Float32Array(32), RL = new Float32Array(16);
  function render() {
    const count = build();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fw, fh);
    gl.disable(gl.BLEND);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.useProgram(pField);
    gl.uniform2f(uFieldLoc, fw, fh);
    gl.bindVertexArray(vaoM);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
    gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, count * STRIDE), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, count);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pGlyph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(uG.uF0, 0); gl.uniform1i(uG.uF1, 1); gl.uniform1i(uG.uAtlas, 2);
    gl.uniform2f(uG.uFieldSize, fw, fh);
    gl.uniform2f(uG.uCanvas, canvas.width, canvas.height);
    gl.uniform1f(uG.uCell, cellDev);
    gl.uniform1f(uG.uN, RAMP.length);
    gl.uniform1f(uG.uCount, ATLAS.length);
    gl.uniform1f(uG.uEdge, P('edge', 1));
    gl.uniform1f(uG.uCalm, P('calm', 0.08));
    gl.uniform1f(uG.uSmallMin, P('smin', 0.3));
    gl.uniform1f(uG.uFade, 48 * dpr);
    R.fill(0); RL.fill(0);
    const rs = st.rects.slice(0, 8);
    rs.forEach((r, i) => {
      R.set([r[0] * dpr, r[1] * dpr, r[2] * dpr, r[3] * dpr], i * 4);
      RL.set([r[4] ?? P('calm', 0.08), (r[5] ?? 48) * dpr], i * 2);
    });
    gl.uniform4fv(uG.uR, R); gl.uniform2fv(uG.uRL, RL); gl.uniform1f(uG.uRn, rs.length);
    gl.uniform3fv(uG.uC0, C0); gl.uniform3fv(uG.uC1, C1); gl.uniform3fv(uG.uC2, C2);
    // au téléphone (et couché, sous 900 px), la passe des caractères ne couvre que la boîte des poissons (3 cases de marge) :
    // hors de la boîte, le champ est vide et la passe ne posait que des pixels transparents (image identique)
    const cut = W < 900 && count > 0;
    if (cut) {
      const k = cellDev / 4, pad = 3 * cellDev;
      const x0 = Math.max(0, Math.floor(bb[0] * fw / W * k) - pad), x1 = Math.min(canvas.width, Math.ceil(bb[2] * fw / W * k) + pad);
      const y0 = Math.max(0, Math.floor(bb[1] * fh / H * k) - pad), y1 = Math.min(canvas.height, Math.ceil(bb[3] * fh / H * k) + pad);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, canvas.height - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    }
    gl.bindVertexArray(vaoQ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    if (cut) gl.disable(gl.SCISSOR_TEST);
  }

  /* ---------- ce que la démo commande ---------- */
  const api = {
    resize, step, render, fish, st,
    size: () => [W, H],
    orbit(cx, cy, rx, ry) { st.cx = cx; st.cy = cy; st.rx = rx; st.ry = ry; },
    tighten(v) { st.tightTo = v; },
    listen(v) { st.listenTo = v ? 1 : 0; },
    // l'expansion éclair : chacun file vers l'extérieur, les plus proches du centre un peu après
    leave() {
      const r = rng(Math.floor(st.t * 1000) + 3);
      for (const f of fish) {
        if (f.mode === 'away') continue;
        let dx = f.x - st.cx, dy = f.y - st.cy;
        const dist = Math.hypot(dx, dy) || 1;
        dx = dx / dist * 0.6 + Math.cos(f.a) * 0.4; dy = dy / dist * 0.6 + Math.sin(f.a) * 0.4;
        const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        const rot = (r() - 0.5) * 0.4;
        const ex = dx * Math.cos(rot) - dy * Math.sin(rot), ey = dx * Math.sin(rot) + dy * Math.cos(rot);
        const far = Math.max(W, H) * 1.5;
        f.exit = [f.x + ex * far, f.y + ey * far];
        // l'onde part du bord intérieur de l'anneau
        f.delay = clamp(0.32 - dist / Math.max(st.rx, 1) * 0.22, 0, 0.3) + r() * 0.08 + (f.kind === 'big' ? 0.2 : 0);
        f.mode = 'leave';
      }
    },
    // k poissons reviennent, par le bord où ils sont sortis
    back(k) {
      const away = fish.filter((f) => f.mode === 'away' || f.mode === 'leave');
      away.sort((a, b) => a.seed - b.seed);
      for (const f of away.slice(0, k)) {
        const ang = Math.atan2(f.y - st.cy, f.x - st.cx);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        if (f.mode === 'away') {
          const m = f.L * 0.8;
          const tx = ca > 0 ? (W + m - st.cx) / ca : ca < 0 ? (-m - st.cx) / ca : Infinity;
          const ty = sa > 0 ? (H + m - st.cy) / sa : sa < 0 ? (-m - st.cy) / sa : Infinity;
          const d = Math.min(tx, ty);
          f.x = st.cx + ca * d; f.y = st.cy + sa * d;
          f.a = ang + Math.PI + (f.seed - 0.5) * 0.7;
          f.u = f.cruise * 2;
          lay(f);
        }
        f.mode = 'mill'; f.boost = 1; f.delay = 0;
      }
    },
    all() { api.back(fish.length); },
    away() { return fish.filter((f) => f.mode === 'away').length; },
    warm(seconds) { const dt = 1 / 60; for (let i = 0; i < seconds * 60; i++) step(dt); },
  };
  return api;
}
