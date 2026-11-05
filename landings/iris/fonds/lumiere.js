// lumiere : la nappe de caustiques du héros, étendue à toute la page (v11). Dérivée de h-caustiques.js, gardé intact pour
// la planche des fonds. Un seul canvas fixe plein écran sous le contenu (iris.css, .lumiere) ; la composition suit le
// défilement : au héros, la nappe tient le haut et les côtés et tombe sur le titre ; dans les sections sombres, elle se
// retire vers les gouttières, plus faible, et ses flaques glissent avec une parallaxe douce. Les textes sont protégés par
// des boîtes douces (en px de la vue, fournies par iris.js à chaque image). Sous la planche et le pied : rien n'est peint
// (ciseaux), et iris.js met la boucle en pause quand ils couvrent la vue.
// Technique (inchangée) : grille posée sur la surface d'eau, chaque sommet réfracté vers le sol (décalage -L·∇h), son
// éclairement vaut 1/|det(I - L·Hess h)| ; trois passes additives (ambre, lumière, bleu) qui frangent les filets.
const CV = `#version 300 es
precision highp float;
uniform mat4 uVP; uniform vec4 uZX, uTh; uniform ivec2 uN; uniform float uT, uL, uU, uWedge, uFlip;
uniform vec2 uOff;
uniform vec4 uW[6]; uniform float uPh[6];
out float vI;
void main(){
  // grille indexée : un sommet par nœud, partagé par six triangles (le cache des sommets évite de le recalculer)
  int ix = gl_VertexID % (uN.x + 1), iy = gl_VertexID / (uN.x + 1);
  // v12 : la grille suit la vue et non le sol. Une grille régulière sur le sol donnait, en haut de l'image (le sol proche,
  // retourné), des mailles de 8 px de haut et 10 de large, dont les facettes perlaient au bord des filets. Les colonnes
  // couvrent à chaque profondeur la seule largeur visible (bords de la vue : droites du sol), les rangées mêlent un pas
  // régulier en profondeur et un pas régulier en angle (uTh.z) : 4,6 px près, 2,3 px loin, au lieu de 8,2 et 1,3.
  vec2 q = vec2(ix, iy) / vec2(uN);
  float z = mix(mix(uZX.x, uZX.y, q.y), uTh.w / tan(mix(uTh.x, uTh.y, q.y)), uTh.z);
  vec2 p = vec2((q.x * 2.0 - 1.0) * mix(uZX.z, uZX.w, (z - uZX.x) / (uZX.y - uZX.x)), z);
  vec2 r = (p - uOff) / uU;
  vec2 g = vec2(0.0); vec3 H = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec2 k = uW[i].xy; float th = dot(k, r) - uW[i].w * uT + uPh[i];
    float s = sin(th), co = cos(th);
    g += uW[i].z * co * k; H -= uW[i].z * s * vec3(k.x * k.x, k.x * k.y, k.y * k.y);
  }
  vec2 P = p - uU * uL * g + vec2(uU * uWedge, 0.0);
  float a11 = 1.0 - uL * H.x, a12 = -uL * H.y, a22 = 1.0 - uL * H.z;
  float I = min(1.0 / max(abs(a11 * a22 - a12 * a12), 0.06), 9.0);
  // flaques : un champ lent sur le sol, qui glisse avec le motif (la lumière n'est pas un papier peint)
  float pool = 0.5 + 0.5 * sin(r.x * 0.83 + 0.6 * sin(r.y * 0.51 + 1.3)) * sin(r.y * 0.69 + 0.9 + 0.5 * sin(r.x * 0.37));
  vI = I * mix(0.42, 1.0, smoothstep(0.1, 0.9, pool));
  gl_Position = uVP * vec4(P.x, 0.0, P.y, 1.0);
  gl_Position.y *= uFlip;
}`;
const CF = `#version 300 es
precision highp float;
uniform vec3 uCol; in float vI; out vec4 o;
void main(){ o = vec4(uCol * vI, 1.0); }`;
const QV = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
const NB = 12;
const QF = `#version 300 es
precision highp float;
uniform sampler2D uC; uniform vec2 uRes, uTx; uniform float uT, uE, uS, uFloor, uGain, uDim;
uniform vec4 uTitle;   // titre du héros (px du canvas, origine en haut à gauche)
uniform vec4 uEnv;     // x : poids du héros (0 en bas de page), y : niveau des sections, z : demi-colonne (px), w : 1 = portrait
uniform vec4 uBox[${NB}]; uniform vec2 uBoxF[${NB}]; uniform int uNB;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// v12 : échantillonnage B-spline cubique (quatre lectures bilinéaires) au lieu du flou à cinq points. Même douceur
// (écart type 0,58 texel dans les deux cas), mais une reconstruction continue jusqu'à la dérivée seconde : au DPR 2, le
// tampon (1 texel par px CSS) est agrandi 1,5 fois et le seuil qui suit dessinait les coudes de l'interpolation
// bilinéaire, un perlé au pas du texel le long des filets.
vec3 bspl(sampler2D s, vec2 uv, vec2 n){
  vec2 st = uv * n - 0.5, i = floor(st), f = st - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (-f3 + 3.0 * f2 - 3.0 * f + 1.0) / 6.0, w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = (i - 0.5 + w1 / g0) / n, h1 = (i + 1.5 + w3 / g1) / n;
  return g0.y * (g0.x * texture(s, h0).rgb + g1.x * texture(s, vec2(h1.x, h0.y)).rgb)
       + g1.y * (g0.x * texture(s, vec2(h0.x, h1.y)).rgb + g1.x * texture(s, h1).rgb);
}
float box(vec2 p, vec4 b, float f){ vec2 c = b.xy + b.zw * 0.5; vec2 q = abs(p - c) - b.zw * 0.5; float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); float u = 1.0 - smoothstep(0.0, f, d); return u * u * (3.0 - 2.0 * u); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = bspl(uC, gl_FragCoord.xy / uRes, 1.0 / uTx) * uS * uE;
  // héros : la nappe tient le haut et les côtés, et tombe sur le titre (plus faible à mesure qu'elle en approche)
  vec2 tc = uTitle.xy + uTitle.zw * 0.5;
  float top = mix(1.0, 0.2, smoothstep(uRes.y * 0.02, uTitle.y + uTitle.w * 0.35, px.y));
  float hw = uTitle.z * (uEnv.w > 0.5 ? 0.42 : 0.5);
  float side = smoothstep(hw * 0.8, hw * 1.6, abs(px.x - tc.x)) * mix(1.0, 0.5, smoothstep(tc.y - uTitle.w, uRes.y, px.y));
  float below = smoothstep(uTitle.y + uTitle.w * 1.4, uTitle.y + uTitle.w * 3.0, px.y) * 0.3;
  float eh = max(max(top, side), below);
  // sections : un fond plus faible, plus vivant dans les gouttières, de part et d'autre de la colonne
  float g = smoothstep(uEnv.z * 0.78, uEnv.z * 1.04, abs(px.x - uRes.x * 0.5));
  // revue : rien dans la colonne du contenu (à 0,6, le seuil y laissait des fragments isolés entre titres et phrases)
  float es = uEnv.y * g;
  c *= mix(es, eh, uEnv.x);
  // les textes : boîtes douces
  float m = 0.0;
  for (int i = 0; i < ${NB}; i++) { if (i >= uNB) break; m = max(m, uBoxF[i].x * box(px, uBox[i], uBoxF[i].y)); }
  c *= 1.0 - m;
  // les filets sur une ardoise sombre : l'éclairement moyen (1) tombe au noir, seules les concentrations restent. La
  // composition et les boîtes s'appliquent avant ce seuil : la nappe s'éclaircit (moins de filets) au lieu de pâlir.
  c = max(c - uFloor, 0.0) * uGain;
  // v12 : la lumière atténuée (uDim) d'un sixième ; le noir et la forme des filets ne bougent pas
  vec3 col = vec3(0.031, 0.031, 0.035) + (1.0 - exp(-pow(c, vec3(1.6)) * 0.95)) * vec3(0.92, 0.92, 0.9) * uDim;
  col += (hash(px + fract(uT * 7.13)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

// six ondes : longueur d'onde (unités du sol), direction (degrés), courbure relative σ, vitesse de phase (unités/s)
const WAVES = [[1.15, 14, 0.36, 0.040], [0.86, 79, 0.33, 0.034], [0.69, 143, 0.29, 0.046], [0.57, 205, 0.24, 0.038], [0.48, 263, 0.19, 0.050], [0.41, 321, 0.15, 0.044]];
const AMBER = [1.0, 0.651, 0.329], LIGHT = [0.949, 0.949, 0.933], BLUE = [0.486, 0.588, 1.0];
const DISP = [[AMBER, 0.92, 0.36, -0.024], [LIGHT, 1.0, 0.28, 0], [BLUE, 1.08, 0.36, 0.024]];  // teinte, indice relatif, poids, coin

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function camera(eye, tgt, fovy, asp) {
  const f = nrm(sub(tgt, eye)), s = nrm(cross(f, [0, 1, 0])), u = cross(s, f);
  const t = 1 / Math.tan(fovy / 2), n = 0.1, fa = 60;
  const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
  const P = [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
  const M = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let v = 0; for (let k = 0; k < 4; k++) v += P[k * 4 + r] * V[c * 4 + k]; M[c * 4 + r] = v; }
  const ray = (nx, ny) => { const th = Math.tan(fovy / 2); const d = [0, 1, 2].map((i) => f[i] + nx * th * asp * s[i] + ny * th * u[i]); const k = -eye[1] / d[1]; return [eye[0] + k * d[0], eye[2] + k * d[2]]; };
  return { M, ray };
}

// « La voûte » (choisie le 2026-11-04 sur le rendu) : la nappe vue comme un plafond, retournée dans l'image : proche et
// large en haut, elle s'affine en descendant vers le titre. Essayée et écartée : « l'aplomb » (vue presque verticale,
// pitch 76°, sans retournement), maille régulière sans profondeur, un papier peint. [paysage, portrait]
// v12 : dim 0,83, la lumière atténuée d'un sixième (demande de l'utilisateur : « légèrement »)
const LOOK = { flip: -1, pitch: [48, 50], fov: [46, 56], scale: [7, 4.4], floor: 0.6, gain: 1.0, dim: 0.83 };

export default {
  id: 'lumiere',
  kind: 'page',
  still: 8,
  mount(host, ctx) {
    const cv = document.createElement('canvas');
    host.appendChild(cv);
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) { cv.remove(); return {}; }
    const half = !!gl.getExtension('EXT_color_buffer_float');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; return { p, u: (n) => (u[n] ??= gl.getUniformLocation(p, n)) }; };
    const PC = prog(CV, CF), PQ = prog(QV, QF);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(PQ.p, 'a');
    const empty = gl.createVertexArray(), ibuf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(), fb = gl.createFramebuffer();
    const sum = [0, 1, 2].map((i) => DISP.reduce((a, [c, , w]) => a + c[i] * w, 0));
    const W = new Float32Array(24), PH = new Float32Array(6);
    WAVES.forEach(([lam, deg, sig, v], i) => { const k = (2 * Math.PI) / lam, r = (deg * Math.PI) / 180; W.set([Math.cos(r) * k, Math.sin(r) * k, sig / (k * k), v * k], i * 4); PH[i] = i * 2.399; });
    const look = LOOK;
    let k = 1, kb = 1, bw = 1, bh = 1, cam = null, zx = [0, 1, 1, 1], tq = [0, 1, 0, 1], N = [360, 300], U = 1, off0 = [0, 0], dz = 0, tall = false, vw = 1, vh = 1;
    const boxU = new Float32Array(NB * 4), boxF = new Float32Array(NB * 2);
    return {
      canvas: cv,
      resize(w, h) {
        vw = w; vh = h;
        k = ctx.dpr() * 0.75;
        cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // le tampon des caustiques plafonne à un texel par px CSS (au DPR 2, 44 % du remplissage) ; la passe finale
        // l'agrandit, ses filets sont déjà adoucis d'un texel
        kb = Math.min(k, 1); bw = Math.max(1, Math.round(w * kb)); bh = Math.max(1, Math.round(h * kb));
        gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, bw, bh, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const asp = w / h; tall = asp < 0.9;
        const pitch = look.pitch[tall ? 1 : 0] * Math.PI / 180, fov = look.fov[tall ? 1 : 0] * Math.PI / 180, ht = 1.7;
        cam = camera([0, ht, 0], [0, 0, ht / Math.tan(pitch)], fov, asp);
        // le sol vu par les quatre coins (avec une marge pour la réfraction) : la grille couvre toute la vue
        // (sans roulis, une rangée de la vue est une profondeur constante du sol, et ses bords des droites)
        const near = cam.ray(1.15, -1.15), far = cam.ray(1.15, 1.15);
        zx = [near[1], far[1], Math.abs(near[0]), Math.abs(far[0])];
        tq = [Math.atan(ht / near[1]), Math.atan(ht / far[1]), 0.6, ht];
        // échelle du motif : la largeur du sol au milieu de la vue
        const mid = [cam.ray(-1, 0), cam.ray(1, 0)];
        U = Math.abs(mid[1][0] - mid[0][0]) / look.scale[tall ? 1 : 0];
        off0 = cam.ray(0.12, 0.25);
        // parallaxe : un pixel de défilement fait glisser le motif de 0,28 px au milieu de la vue
        const e = 0.02, a = cam.ray(0, -e), b = cam.ray(0, e);
        dz = (b[1] - a[1]) / (e * h) * 0.28 * look.flip;
        // 2026-11-05, téléphone (vue de moins de 900 px) : la maille garde la densité du bureau en px CSS (colonnes de
        // 2,6 px, rangées de 2,5 px en moyenne) au lieu de la doubler : 51 000 sommets au lieu de 109 000 à 390 × 844,
        // rendu identique à 1:1 (écart moyen 1,3 niveau sur les filets). Bureau et cover inchangés.
        const n0 = w < 900
          ? [Math.min(tall ? 260 : 400, Math.round(w / 2.6)), Math.min(tall ? 420 : 360, Math.round(h / 2.5))]
          : tall ? [260, 420] : [400, 360];
        if (n0[0] !== N[0] || n0[1] !== N[1]) {
          N = n0;
          const I = new Uint32Array(N[0] * N[1] * 6), r = N[0] + 1;
          for (let y = 0, j = 0; y < N[1]; y++) for (let x = 0; x < N[0]; x++) { const a = y * r + x; I.set([a, a + 1, a + r, a + 1, a + r + 1, a + r], j); j += 6; }
          gl.bindVertexArray(empty); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
          gl.bindVertexArray(null);
        }
      },
      // sc : { sy, title:{x,y,w,h}, boxes:[[x,y,w,h,s,f]], heroW (0..1), level, col (demi-colonne px), cut (px de la vue
      // sous lesquels rien n'est visible), still (pas de parallaxe) }
      frame(t, sc) {
        const u = Math.min(1, Math.max(0, t / 2.2)), e = u * u * (3 - 2 * u);
        const focus = 0.42 + 0.58 * (1 - Math.pow(1 - Math.min(1, t / 2.4), 3));
        // sous la planche, rien n'est visible : on ne peint que jusqu'à son arc, plus une marge (le compositeur peut
        // devancer d'une image le défilement que lit la page)
        const cut = Math.max(0, Math.min(cv.height, Math.ceil(((sc.cut ?? vh) + 120) * k)));
        if (cut <= 0) return;
        const cb = Math.min(bh, Math.ceil(cut * kb / k) + 2);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(0, bh - cb, bw, cb);
        // 1. caustiques
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, bw, bh);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(PC.p); gl.bindVertexArray(empty);
        gl.uniformMatrix4fv(PC.u('uVP'), false, cam.M);
        gl.uniform4f(PC.u('uZX'), ...zx); gl.uniform4f(PC.u('uTh'), ...tq); gl.uniform2i(PC.u('uN'), N[0], N[1]);
        gl.uniform1f(PC.u('uT'), t); gl.uniform1f(PC.u('uFlip'), look.flip);
        const py = sc.still ? 0 : sc.sy * dz;
        gl.uniform2f(PC.u('uOff'), off0[0], off0[1] + py);
        gl.uniform4fv(PC.u('uW'), W); gl.uniform1f(PC.u('uU'), U); gl.uniform1fv(PC.u('uPh'), PH);
        const s = half ? 1 : 0.25;
        for (const [c, n, wgt, wedge] of DISP) {
          gl.uniform1f(PC.u('uL'), 1.32 * n * focus); gl.uniform1f(PC.u('uWedge'), wedge * focus);
          gl.uniform3f(PC.u('uCol'), (c[0] * wgt / sum[0]) * s, (c[1] * wgt / sum[1]) * s, (c[2] * wgt / sum[2]) * s);
          gl.drawElements(gl.TRIANGLES, N[0] * N[1] * 6, gl.UNSIGNED_INT, 0);
        }
        gl.disable(gl.BLEND);
        gl.scissor(0, cv.height - cut, cv.width, cut);
        // 2. passe finale : composition, textes protégés, tonalité, tramage
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
        gl.useProgram(PQ.p); gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(PQ.u('uC'), 0);
        gl.uniform2f(PQ.u('uRes'), cv.width, cv.height); gl.uniform2f(PQ.u('uTx'), 1 / bw, 1 / bh); gl.uniform1f(PQ.u('uT'), t);
        gl.uniform1f(PQ.u('uE'), e); gl.uniform1f(PQ.u('uS'), 1 / s);
        gl.uniform1f(PQ.u('uFloor'), look.floor); gl.uniform1f(PQ.u('uGain'), look.gain); gl.uniform1f(PQ.u('uDim'), look.dim);
        const T = sc.title;
        gl.uniform4f(PQ.u('uTitle'), T.x * k, T.y * k, T.w * k, T.h * k);
        gl.uniform4f(PQ.u('uEnv'), sc.heroW, sc.level, sc.col * k, tall ? 1 : 0);
        const n = Math.min(NB, sc.boxes.length);
        sc.boxes.forEach((b, i) => { if (i >= NB) return; boxU.set([b[0] * k, b[1] * k, b[2] * k, b[3] * k], i * 4); boxF.set([b[4], b[5] * k], i * 2); });
        gl.uniform4fv(PQ.u('uBox'), boxU); gl.uniform2fv(PQ.u('uBoxF'), boxF); gl.uniform1i(PQ.u('uNB'), n);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
      },
      destroy() { gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  },
};
