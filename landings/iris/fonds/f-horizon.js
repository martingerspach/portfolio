// Iris, fond du pied « L'horizon » : une seule ligne de lumière traverse le pied à la hauteur du champ e-mail ; le champ
// de verre fait office de prisme : la ligne y entre blanche et ressort, après le bouton, en trois raies fines (modèle,
// lecture, écriture) qui s'écartent à peine et s'éteignent vers la droite. Au téléphone, le champ occupe la largeur :
// la lumière entre par la gauche et ressort par la face du bas, en un petit éventail qui s'éteint avant la barre.
const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
const NS = 6;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uK, uT, uLit;
uniform vec4 uA[${NS}], uB[${NS}], uC[${NS}], uD[${NS}];
uniform vec4 uBox; uniform float uR; uniform vec4 uHot; uniform vec4 uPulse; uniform vec4 uFanO, uFanP;
out vec4 o;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float sdBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 pal(float u){ // 0 ambre, 0.5 vert, 1 bleu
  vec3 am = vec3(0.933, 0.667, 0.306), gr = vec3(0.310, 0.780, 0.490), bl = vec3(0.482, 0.588, 1.0);
  return u < 0.5 ? mix(am, gr, smoothstep(0.0, 0.5, u)) : mix(gr, bl, smoothstep(0.5, 1.0, u));
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uK;
  vec3 col = vec3(0.031, 0.031, 0.035);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${NS}; i++) {
    vec2 o0 = uA[i].xy, dr = uA[i].zw;
    vec2 v = p - o0;
    float sa = dot(v, dr), qd = abs(v.x * dr.y - v.y * dr.x);
    float len = uB[i].x, front = uB[i].y, w0 = uB[i].z, dv = uB[i].w;
    float m = smoothstep(-0.6, 0.6, sa) * (1.0 - smoothstep(len - 0.6, len + 0.6, sa));
    m *= 1.0 - smoothstep(front - 50.0, front, sa);
    m *= smoothstep(0.0, max(uD[i].x, 1e-3), sa);
    float w = w0 + dv * max(sa, 0.0);
    float core = exp(-(qd * qd) / (w * w)) * (w0 / w);
    float skirt = exp(-qd / (w * 5.0)) * uD[i].y * (w0 / w);
    // une impulsion lente parcourt la ligne (une exécution qui passe)
    float pl = 1.0 + uD[i].z * exp(-pow((dot(p, uPulse.xy) - uPulse.z) / uPulse.w, 2.0));
    acc += uC[i].rgb * (core + skirt) * exp(-max(sa, 0.0) / uC[i].w) * m * pl;
  }
  // l'arête du champ s'allume là où la lumière entre et sort (le biseau de verre du champ la réfracte au-dessus)
  float d = sdBox(p, uBox.xy, uBox.zw, uR);
  float rim = exp(-pow(d / 0.9, 2.0)) + 0.3 * exp(-abs(d) / 3.5);
  float near = exp(-length(p - uHot.xy) / 42.0) * 1.1 + exp(-length(p - uHot.zw) / 56.0) * 1.5;
  acc += vec3(0.95, 0.95, 0.93) * rim * near * uLit;
  // l'éventail : un continuum faible entre les raies, hors du champ
  vec2 fv = p - uFanO.xy; float fs = length(fv);
  float fu = (atan(fv.y, fv.x) - uFanO.z) / (uFanO.w - uFanO.z);
  float win = smoothstep(-0.12, 0.06, fu) * (1.0 - smoothstep(0.94, 1.12, fu));
  float ff = exp(-fs / uFanP.y) * smoothstep(2.0, 40.0, fs) * (1.0 - smoothstep(uFanP.x - 50.0, uFanP.x, fs));
  acc += pal(clamp(fu, 0.0, 1.0)) * win * ff * uFanP.z * step(0.5, d);
  col += acc;
  float mx = max(col.r, max(col.g, col.b));                         // compression qui garde la teinte des raies
  col *= (1.0 - exp(-mx * 1.08)) / max(mx, 1e-4);
  col += (hash(gl_FragCoord.xy + fract(uT * 7.13) * 91.0) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 3); };
const SPEC = [[0.933, 0.667, 0.306], [0.310, 0.780, 0.490], [0.482, 0.588, 1.0]]; // ambre, vert, bleu

function scene(W, H, B, t) {
  const f = B.field;
  const phone = f.w > W * 0.8;
  const eIn = ease((t - 0.15) / 1.0), eFan = ease((t - 1.0) / 1.3), lit = ease((t - 0.9) / 0.7);
  const segs = [];
  const add = (o, d, len, front, w0, dv, rgb, k, fall, fadeIn = 0, skirt = 0.04, pulse = 0) =>
    segs.push({ o, d, len, front, w0, dv, rgb: rgb.map((x) => x * k), fall, fadeIn, skirt, pulse });
  const breathe = 1 + 0.08 * Math.sin((2 * Math.PI * t) / 31 - Math.PI / 2);
  let hot, pulse, fan;
  if (!phone) {
    const y = f.y + f.h / 2, x1 = f.x + f.w;
    add([-4, y], [1, 0], f.x + 4, (f.x + 60) * eIn, 0.8, 0, [0.96, 0.96, 0.94], 1.7, 1e6, Math.min(f.x * 0.8, 440), 0.08, 0.4);
    const L = W - x1 + 40;
    // ouverture : les raies extrêmes finissent à ~±30 px au bord, loin des libellés et de la barre
    const spread = Math.min(0.085, Math.atan2(Math.min(34, (B.bar.y - y) * 0.3), L)) * breathe;
    SPEC.forEach((c, i) => {
      const a = (i - 1) * spread + 0.006;                    // ambre en haut, bleu en bas
      add([x1, y], [Math.cos(a), Math.sin(a)], L, L * 1.1 * eFan * eFan + 1, 0.85, 0.0022, c, 1.55, Math.max(260, L * 0.9), 0, 0.14, 0.3);
    });
    fan = [x1, y, -spread + 0.006, spread + 0.006, L * 1.1 * eFan * eFan + 1, Math.max(220, L * 0.7), 0.09];
    hot = [f.x, y, x1, y];
    // l'impulsion avance de gauche à droite toutes les 9 s
    const ph = ((t - 2.6) / 9) % 1, run = ph < 0 ? -1e4 : -300 + ph * (W + 900);
    pulse = [1, 0, run, 140];
  } else {
    // la lumière entre par la gauche au niveau du champ de saisie (sur l'axe du texte saisi) et ressort par la face du
    // bas, sous le bouton. La marge ne fait que 18 px : la ligne y arrive pleine (elle vient de hors de l'écran) ; un
    // fondu d'entrée la réduisait à un trait gris de quelques pixels, qui se lisait comme un défaut
    const inp = B.input, y = inp ? inp.y + inp.h / 2 : f.y + f.h * 0.28, p = B.primary, xo = p.x + p.w * 0.5, yo = f.y + f.h;
    add([-4, y], [1, 0], f.x + 4, (f.x + 30) * eIn, 0.8, 0, [0.96, 0.96, 0.94], 1.7, 1e6, 0, 0.08, 0);
    const spread = 0.07 * breathe, Lp = W - xo;
    const base = Math.atan2(Math.max(20, B.bar.y - yo - 30), Lp) - spread;
    SPEC.forEach((c, i) => {
      const a = base + (i - 1) * spread;
      add([xo, yo], [Math.cos(a), Math.sin(a)], 900, (Lp + 80) * 1.3 * eFan * eFan + 1, 0.85, 0.004, c, 1.6, Math.max(120, Lp * 0.9), 0, 0.14, 0);
    });
    fan = [xo, yo, base - spread, base + spread, (Lp + 80) * 1.3 * eFan * eFan + 1, Math.max(90, Lp * 0.6), 0.09];
    hot = [f.x, y, xo, yo];
    pulse = [1, 0, -1e4, 100];
  }
  return { segs, hot, pulse, lit, fan, box: [f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2] };
}

export default {
  id: 'f-horizon',
  kind: 'foot',
  layout: 'center',
  name: 'L’horizon',
  tech: 'WebGL2 · shader, rayons analytiques',
  idea: 'Une ligne de lumière traverse le champ d’inscription et en ressort décomposée, comme une exécution dans Iris.',
  still: 8,
  mount(host, ctx) {
    const cv = document.createElement('canvas');
    host.appendChild(cv);
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) { host.style.background = '#080809'; return {}; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    const u = { res: U('uRes'), k: U('uK'), t: U('uT'), lit: U('uLit'), a: U('uA'), b: U('uB'), c: U('uC'), d: U('uD'), box: U('uBox'), r: U('uR'), hot: U('uHot'), pulse: U('uPulse'), fo: U('uFanO'), fp: U('uFanP') };
    const A = new Float32Array(NS * 4), Bf = new Float32Array(NS * 4), C = new Float32Array(NS * 4), D = new Float32Array(NS * 4);
    let k = 1, W = 1, H = 1;
    return {
      resize(w, h) {
        W = w; H = h;
        k = Math.min(ctx.dpr(), 1.5);
        cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        gl.viewport(0, 0, cv.width, cv.height);
      },
      frame(t) {
        const sc = scene(W, H, ctx.boxes(), t);
        A.fill(0); Bf.fill(0); C.fill(0); D.fill(0);
        sc.segs.slice(0, NS).forEach((g, i) => {
          A.set([g.o[0], g.o[1], g.d[0], g.d[1]], i * 4);
          Bf.set([g.len, g.front, g.w0, g.dv], i * 4);
          C.set([g.rgb[0], g.rgb[1], g.rgb[2], g.fall], i * 4);
          D.set([g.fadeIn, g.skirt, g.pulse, 0], i * 4);
        });
        for (let i = sc.segs.length; i < NS; i++) { Bf[i * 4 + 2] = 1; C[i * 4 + 3] = 1; }
        gl.uniform2f(u.res, cv.width, cv.height); gl.uniform1f(u.k, k); gl.uniform1f(u.t, t); gl.uniform1f(u.lit, sc.lit);
        gl.uniform4fv(u.a, A); gl.uniform4fv(u.b, Bf); gl.uniform4fv(u.c, C); gl.uniform4fv(u.d, D);
        gl.uniform4f(u.box, ...sc.box); gl.uniform1f(u.r, 18);
        gl.uniform4f(u.hot, ...sc.hot); gl.uniform4f(u.pulse, ...sc.pulse);
        gl.uniform4f(u.fo, sc.fan[0], sc.fan[1], sc.fan[2], sc.fan[3]); gl.uniform4f(u.fp, sc.fan[4], sc.fan[5], sc.fan[6], 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy() { gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  },
};
