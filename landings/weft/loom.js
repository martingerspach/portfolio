/* Weft · loom.js
   Woven field renderer (WebGL2). Pass 1 computes one value per thread cell: soft figure field, woven ribbons
   (weft ribbons across, warp ribbons down, crossing over and under like the mark) and the shade they cast.
   Pass 2 draws every yarn: round profile, tuck where it dives under, anisotropic silk sheen on slow folds.
   Warp is dark green, the figure runs from sage to apricot. Rendered at twice the density on 1x screens so the
   yarns stay silk rather than pixels. */
(() => {
  'use strict';

  const VS = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`;

  const FS_FIELD = `#version 300 es
precision highp float;
uniform vec2 uCss;
uniform float uPitch;
uniform float uT;
uniform vec4 uB[6];
uniform int uN;
uniform vec4 uRh[4];
uniform vec4 uRh2[4];
uniform int uNh;
uniform vec4 uRv[4];
uniform vec4 uRv2[4];
uniform int uNv;
uniform float uSc;
uniform float uLift;
uniform sampler2D uMask;
uniform float uMaskOn;
uniform float uGain;
uniform float uWarpAmt;
uniform vec4 uFg;
out vec4 o;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
void main(){
  vec2 c = floor(gl_FragCoord.xy);
  vec2 q0 = vec2((c.x + .5) * uPitch, uCss.y - (c.y + .5) * uPitch);
  vec2 w = vec2(noise(q0 * .0032 + vec2(uT * .035, 1.7)), noise(q0 * .0032 + vec2(5.2, -uT * .03))) - .5;
  vec2 q = q0 + w * uWarpAmt;
  float s = 0.;
  for (int k = 0; k < 6; k++) { if (k >= uN) break; vec4 b = uB[k]; vec2 d = (q - b.xy) / b.z; s += b.w * exp(-dot(d, d)); }
  if (uMaskOn > .5) {
    vec2 cm = c;
    if (uFg.w > .001) {
      vec2 dq = q0 - uFg.xy;
      float fd = length(dq) + .001;
      float push = uFg.w * 15. * (fd / uFg.z) * exp(-pow(fd / uFg.z, 2.));
      vec2 src = q0 - dq / fd * push;
      cm = vec2(floor(src.x / uPitch), floor((uCss.y - src.y) / uPitch));
    }
    ivec2 ts = textureSize(uMask, 0);
    s += texelFetch(uMask, clamp(ivec2(cm), ivec2(0), ts - 1), 0).r * 2.4;
  }
  float F = 1. - exp(-s * uGain);
  float col = smoothstep(.12, .97, F);

  // woven ribbons
  float dh = 1e4, ch = .7; int ih = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= uNh) break;
    vec4 a = uRh[i], b = uRh2[i];
    float yc = a.x + uSc * (a.z * sin(q0.x * a.w + b.x + uT * b.y) + a.z * .3 * sin(q0.x * a.w * 2.3 + b.x * 1.7 - uT * b.y * .8));
    float d = abs(q0.y - yc) - a.y * uSc;
    if (d < dh) { dh = d; ih = i; ch = mix(b.z, b.w, clamp(q0.x / uCss.x, 0., 1.)); }
  }
  float dv = 1e4, cv = .35; int iv = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= uNv) break;
    vec4 a = uRv[i], b = uRv2[i];
    float xc = a.x + uSc * (a.z * sin(q0.y * a.w + b.x + uT * b.y) + a.z * .3 * sin(q0.y * a.w * 2.1 + b.x * 1.3 - uT * b.y * .7));
    float d = abs(q0.x - xc) - a.y * uSc;
    if (d < dv) { dv = d; iv = i; cv = mix(b.z, b.w, clamp(q0.y / uCss.y, 0., 1.)); }
  }
  float sh = 0.;
  float mh = 0., mv = 0.;
  if (uNh + uNv > 0) {
    float n = (noise(q0 * .006 + vec2(uT * .02, 0.)) - .5) * .08;
    mh = smoothstep(1.4, -1.4, dh);
    mv = smoothstep(1.4, -1.4, dv);
    bool hTop = ((ih + iv) & 1) == 0;
    float eh = max(dh, 0.), ev = max(dv, 0.);
    if (hTop) {
      sh = mv * (1. - mh) * .62 * exp(-eh / (7. * uSc));   // warp ribbon dives under the weft ribbon
      mv *= 1. - mh;
    } else {
      sh = mh * (1. - mv) * .62 * exp(-ev / (7. * uSc));
      mh *= 1. - mv;
    }
    float ground = (1. - mh) * (1. - mv);
    sh = max(sh, ground * (.34 * exp(-eh / (12. * uSc)) + .34 * exp(-ev / (12. * uSc))));
    if (mv > .5) col = max(col + uLift, cv) + n;
    else if (mh > .5) col = max(col + uLift, ch) + n;
    F = max(F, mh);
  }
  o = vec4(F, mv, clamp(col, 0., 1.), clamp(sh, 0., 1.));
}`;

  const FS_WEAVE = `#version 300 es
precision highp float;
uniform sampler2D uF;
uniform vec2 uCells;
uniform float uPitchD;
uniform float uDpr;
uniform float uT;
uniform vec3 uLab0, uLab1, uLab2, uLab3;
uniform vec3 uWarp, uGround, uSpec;
uniform vec2 uLight;
uniform float uSheen;
uniform float uSolid;
uniform float uDim;
uniform float uFine;
uniform sampler2D uHi;
uniform float uHiOn;
uniform float uHiBg;
uniform vec4 uR[6];
uniform float uRw[6];
uniform int uNR;
uniform vec4 uP;
uniform vec4 uFgW;
out vec4 o;

vec3 oklab2lin(vec3 c){
  float l = c.x + .3963377774 * c.y + .2158037573 * c.z;
  float m = c.x - .1055613458 * c.y - .0638541728 * c.z;
  float s = c.x - .0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
             -.0041960863 * l - .7034186147 * m + 1.7076147010 * s);
}
vec3 lin2srgb(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 ramp(float x){
  vec3 lab = x < .34 ? mix(uLab0, uLab1, x / .34) : (x < .68 ? mix(uLab1, uLab2, (x - .34) / .34) : mix(uLab2, uLab3, (x - .68) / .32));
  return oklab2lin(lab);
}
vec4 cell(vec2 c){ return texelFetch(uF, ivec2(clamp(c, vec2(0), uCells - 1.)), 0); }

// 0 = ground warp, 1 = ground weft binding point, 2 = figure weft (weft-faced satin), 3 = figure warp (warp-faced satin)
int kindAt(vec2 c){
  vec4 f = cell(c);
  float ow = mod(c.x * 3. + c.y, 8.);
  float ov = mod(c.y * 3. + c.x, 8.);
  if (f.g > .2 + .6 * (ov + .5) / 8.) return ov < .5 ? 1 : 3;
  if (uSolid > .5 || f.r > .2 + .1 * hash(c + 17.3)) return ow < .5 ? 0 : 2;
  return ow > 3.5 && ow < 4.5 ? 1 : 0;
}
// objects resting on the fabric: rounded boxes in css px, y up
float sdBox(vec2 p, vec2 c, vec2 b, float r){ vec2 q = abs(p - c) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
// the silk dips under each card and rises in a soft ridge around it
float press(vec2 q){
  float h = 0.;
  for (int i = 0; i < 6; i++) {
    if (i >= uNR) break;
    vec4 R = uR[i];
    float d = sdBox(q, R.xy + R.zw * .5, R.zw * .5, 16.);
    h += uRw[i] * (-(1. - smoothstep(-4., 40., d)) + .12 * exp(-pow((d - 46.) / 26., 2.)));
  }
  if (uFgW.w > .001) {
    float fd = length(q - uFgW.xy);
    h += uFgW.w * (-1.2 * exp(-pow(fd / (uFgW.z * .6), 2.)) + .3 * exp(-pow((fd - uFgW.z * .85) / (uFgW.z * .3), 2.)));
  }
  return h;
}
float occl(vec2 q){
  float a = 0.;
  for (int i = 0; i < 6; i++) {
    if (i >= uNR) break;
    vec4 R = uR[i];
    float d = sdBox(q, R.xy + R.zw * .5, R.zw * .5, 16.);
    a += uRw[i] * (1. - smoothstep(0., 26., d));
  }
  return min(a, 1.);
}
// slow folds: sum of sines, analytic gradient
vec3 fold(vec2 q){
  vec2 k1 = vec2(.0041, .0019), k2 = vec2(-.0015, .0047), k3 = vec2(.0068, -.0031);
  float p1 = dot(q, k1) + uT * .10, p2 = dot(q, k2) - uT * .075, p3 = dot(q, k3) + uT * .05;
  float h = .55 * sin(p1) + .35 * sin(p2) + .22 * sin(p3);
  vec2 g = .55 * cos(p1) * k1 + .35 * cos(p2) * k2 + .22 * cos(p3) * k3;
  return vec3(h, g);
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 c = floor(fc / uPitchD);
  vec2 uv = fract(fc / uPitchD);
  vec4 f = cell(c);
  int k = kindAt(c);
  bool solid = uSolid > .5;
  // on a solid satin the binding points stay inside the float, a little darker, instead of reading as bricks
  bool bindH = solid && k == 0, bindV = solid && k == 1;
  bool horiz = (k == 1 && !bindV) || k == 2 || bindH;
  vec2 d = horiz ? vec2(1, 0) : vec2(0, 1);
  int kp = kindAt(c + d), km = kindAt(c - d);
  int kk = bindH ? 2 : (bindV ? 3 : k);
  if (solid) { kp = kp == 0 && horiz ? 2 : (kp == 1 && !horiz ? 3 : kp); km = km == 0 && horiz ? 2 : (km == 1 && !horiz ? 3 : km); }
  float across = horiz ? uv.y : uv.x;
  float along = horiz ? uv.x : uv.y;
  float tm = (km == kk) ? 1. : smoothstep(0., .3, along);
  float tp = (kp == kk) ? 1. : smoothstep(0., .3, 1. - along);
  if (solid) { tm = 1.; tp = 1.; }   // a solid satin has no tucks at seams: the floats run straight into the next figure
  float tuck = min(tm, tp);
  float width = mix(.38, .5, tuck);
  float r = (across - .5) / width;
  float h = pow(clamp(1. - r * r, 0., 1.), .42);

  vec3 base; float sheenK;
  // shade and lightness interpolated between cell centres, so ribbon shadows and colour fields never step row by row
  vec2 cc = fc / uPitchD - .5, c0 = floor(cc), tb = cc - c0;
  vec4 sm = mix(mix(cell(c0), cell(c0 + vec2(1, 0)), tb.x), mix(cell(c0 + vec2(0, 1)), cell(c0 + vec2(1, 1)), tb.x), tb.y);
  float lit = smoothstep(0., .45, sm.r);
  float fb = f.b;
  if (uHiOn > .5) {
    // the figure read at screen resolution: smooth letter edges, same finger displacement as the field pass
    vec2 qh = fc;
    if (uFgW.w > .001) {
      vec2 q = fc / uDpr, dq = q - uFgW.xy;
      float fd = length(dq) + .001;
      float push = uFgW.w * 15. * (fd / uFgW.z) * exp(-pow(fd / uFgW.z, 2.));
      qh = (q - dq / fd * push) * uDpr;
    }
    float Fh = 1. - exp(-(uHiBg + texture(uHi, qh / (uCells * uPitchD)).r * 2.4));
    lit = smoothstep(0., .45, Fh);
    fb = smoothstep(.12, .97, Fh);
  }
  if (k >= 2) { base = ramp(fb); sheenK = 1.; if (k == 2 && uSolid > .5) { base *= mix(uDim, 1., lit); sheenK = mix(.035, 1., lit); } }
  else if (bindV) { base = ramp(fb) * (1. - .1 * uFine); sheenK = .7; }
  else if (k == 1) { base = mix(uGround, ramp(fb), smoothstep(.04, .4, max(f.r, f.g)) * .86); sheenK = .08; }
  else if (bindH) { base = ramp(fb) * mix(uDim, 1., lit) * (1. - .1 * uFine); sheenK = mix(.03, .7, lit); }
  else { base = mix(uWarp, ramp(fb), smoothstep(.04, .4, f.r) * .88); sheenK = .06; }
  // row-to-row irregularity and the dip between yarns: full on dense screens, softer at 1x where a row is 3 pixels
  float irr = 1. + uFine * (.2 * (horiz ? hash(vec2(c.y, 3.1)) : hash(vec2(c.x, 7.7))) - .1);

  vec2 qc = fc / uDpr;
  vec3 fd = fold(qc);
  vec2 g = fd.yz;
  float ao = 0.;
  if (uNR > 0 || uFgW.w > .001) {
    vec2 e = vec2(2., 0.);
    g += vec2(press(qc + e.xy) - press(qc - e.xy), press(qc + e.yx) - press(qc - e.yx)) * .012;
    ao = occl(qc);
  }
  vec3 n = normalize(vec3(-g * 95., 1.));
  vec3 L = normalize(vec3(uLight, .85));
  float diff = .8 + .3 * dot(n, L);
  vec3 H = normalize(L + vec3(0, 0, 1));
  vec3 T = horiz ? vec3(1, 0, 0) : vec3(0, 1, 0);
  T = normalize(T - n * dot(n, T));
  float th = dot(T, H);
  float aniso = pow(sqrt(max(0., 1. - th * th)), 26.);

  bool fig = k >= 2 || bindH || bindV;
  float floor_ = fig ? 1. - .1 * uFine : .13;
  vec3 col = base * irr * (floor_ + (1. - floor_) * h) * diff * mix(fig ? .88 : .5, 1., tuck);
  col += uSpec * sheenK * uSheen * aniso * pow(h, mix(1.6, 4., uFine)) * tuck;
  if (uP.w > 0.) {
    float dist = length(qc - uP.xy);
    float ring = exp(-pow((dist - uP.z * 520.) / 90., 2.)) * exp(-uP.z * 1.1) * uP.w;
    col += uSpec * ring * .2 * pow(h, 3.) * (fig ? 1. : .4);
  }
  col *= (1. - sm.a * .8) * (1. - ao * .05);
  vec3 s = lin2srgb(col);
  s += (hash(fc + fract(uT)) - .5) / 255.;
  o = vec4(s, 1.);
}`;

  function hexToLin(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => {
      x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
  }
  function hexToOklab(hex) {
    const [r, g, b] = hexToLin(hex);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }

  const PALETTE = {
    ramp: ['#243a2e', '#6f9479', '#cdd3b4', '#ecb990'],
    warp: '#18211c', ground: '#121915', spec: '#fff1df',
  };

  // compile without waiting: with KHR_parallel_shader_compile the driver works in the background
  function program(gl, fs) {
    const p = gl.createProgram();
    const v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, VS); gl.compileShader(v);
    const f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    return { p, f, u: null };
  }
  function finish(gl, prog) {
    if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) throw new Error(gl.getShaderInfoLog(prog.f) || gl.getProgramInfoLog(prog.p));
    const u = {};
    const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog.p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog.p, info.name);
    }
    prog.u = u;
  }

  class Loom {
    /* opts: pitch (css px), gain, warp, sheen, light angle, ss (minimum render density), blobs [{x, y, r, w, ax, ay, f}]
       with x/y as fractions of the canvas and r in css px; ribbons {h: [...], v: [...]}, each {at, hw, a, k, ph, s, c0, c1}
       with `at` as a fraction of the height (h) or width (v), hw and a in css px, c0/c1 the colour ramp at both ends;
       mask(ctx, w, h) draws the figure in cell units. */
    constructor(canvas, opts) {
      this.c = canvas;
      this.o = Object.assign({ pitch: 5, gain: 1, warp: 70, sheen: 0.55, light: 0.9, blobs: [], ribbons: null, mask: null, maxDpr: 2, ss: 2 }, opts);
      this.ok = false;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) { canvas.closest('[data-loom-host]')?.classList.add('loom-off'); return; }
      this.gl = gl;
      this.pext = gl.getExtension('KHR_parallel_shader_compile');
      this.pf = program(gl, FS_FIELD);
      this.pw = program(gl, FS_WEAVE);
      this.ready = false;
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.ftex = gl.createTexture();
      this.fbo = gl.createFramebuffer();
      this.mtex = gl.createTexture();
      this.htex = gl.createTexture();
      // a black texel until a figure is drawn, so the sampler is never incomplete
      for (const tx of [this.mtex, this.htex]) {
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      }
      this.lab = PALETTE.ramp.map(hexToOklab);
      this.cols = { warp: hexToLin(PALETTE.warp), ground: hexToLin(PALETTE.ground), spec: hexToLin(PALETTE.spec) };
      this.rects = [];
      this.pulse = null;
      this.ok = true;
      this.size();
    }

    isReady() {
      if (this.ready) return true;
      const gl = this.gl, ext = this.pext;
      if (ext && !(gl.getProgramParameter(this.pf.p, ext.COMPLETION_STATUS_KHR) && gl.getProgramParameter(this.pw.p, ext.COMPLETION_STATUS_KHR))) return false;
      try { finish(gl, this.pf); finish(gl, this.pw); } catch (e) {
        console.warn('[loom]', e); this.ok = false; this.c.closest('[data-loom-host]')?.classList.add('loom-off'); return false;
      }
      this.ready = true;
      return true;
    }

    size() {
      if (!this.ok) return false;
      const r = this.c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const want = Math.min(Math.max(window.devicePixelRatio || 1, this.o.ss), this.o.maxDpr);
      const maxPx = this.o.maxPx || 5.2e6;
      // a whole number of device pixels per thread and the exact css pitch, so rows never beat against the pixel grid
      let pitchD = Math.max(3, Math.round(this.o.pitch * want));
      while (pitchD > 3 && r.width * r.height * (pitchD / this.o.pitch) ** 2 > maxPx) pitchD -= 1;
      const dpr = pitchD / this.o.pitch;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      const cx = Math.ceil(W / pitchD) + 1, cy = Math.ceil(H / pitchD) + 1;
      if (W === this.W && H === this.H && pitchD === this.pitchD) return true;
      Object.assign(this, { W, H, dpr, pitchD, cx, cy, cssW: r.width, cssH: r.height });
      this.c.width = W; this.c.height = H;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.ftex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cx, cy, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ftex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (this.o.mask) this.buildMask();
      return true;
    }

    buildMask() {
      const { cx, cy, pitchD, dpr } = this;
      const cv = document.createElement('canvas'); cv.width = cx; cv.height = cy;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cx, cy);
      this.o.mask(ctx, cx, cy, pitchD / dpr);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.mtex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.o.hiMask) {
        // the same figure drawn over the cell grid's full extent in device pixels, filtered
        const hw = cx * pitchD, hh = cy * pitchD;
        const hv = document.createElement('canvas'); hv.width = hw; hv.height = hh;
        const hc = hv.getContext('2d');
        hc.fillStyle = '#000'; hc.fillRect(0, 0, hw, hh);
        this.o.mask(hc, hw, hh, 1 / dpr);
        gl.bindTexture(gl.TEXTURE_2D, this.htex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, hv);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    }

    ribbonUniforms(u, list, key, size, along) {
      const A = new Float32Array(16), B = new Float32Array(16);
      const n = Math.min(4, list ? list.length : 0);
      for (let i = 0; i < n; i++) {
        const r = list[i];
        A.set([r.at * size, r.hw, r.a || 0, r.k || 0.004], i * 4);
        B.set([r.ph || 0, r.s || 0.1, r.c0 ?? 0.6, r.c1 ?? 0.9], i * 4);
      }
      this.gl.uniform4fv(u[key], A);
      this.gl.uniform4fv(u[key + '2'], B);
      this.gl.uniform1i(u[along], n);
    }

    draw(t) {
      if (!this.ok || !this.W) return;
      if (!this.isReady()) { if (!this.retry) this.retry = setTimeout(() => { this.retry = 0; this.draw(t); }, 50); return; }
      const now = performance.now();
      this.dt = this.lastDraw ? Math.min(0.1, (now - this.lastDraw) / 1000) : 0.016;
      this.lastDraw = now;
      if (this.fTarget != null) this.fs = (this.fs || 0) + (this.fTarget - (this.fs || 0)) * (1 - Math.exp(-this.dt / 0.3));
      const gl = this.gl, o = this.o;
      if (o.frame) o.frame(this);
      const pitchCss = this.pitchD / this.dpr;
      const sc = o.ref ? Math.min(1, Math.max(.5, this.cssW / o.ref)) : 1;
      // pass 1: field per cell
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.cx, this.cy);
      gl.useProgram(this.pf.p);
      const u = this.pf.u;
      gl.uniform2f(u.uCss, this.cx * pitchCss, this.cy * pitchCss);
      gl.uniform1f(u.uPitch, pitchCss);
      gl.uniform1f(u.uT, t);
      gl.uniform1f(u.uSc, sc);
      gl.uniform1f(u.uLift, o.lift ?? .1);
      const B = new Float32Array(24);
      const n = Math.min(6, o.blobs.length);
      for (let i = 0; i < n; i++) {
        const b = o.blobs[i];
        const ph = t * (b.f || 0.05) + i * 1.7;
        B[i * 4] = b.x * this.cssW + Math.sin(ph) * (b.ax || 0) * sc;
        B[i * 4 + 1] = b.y * this.cssH + Math.cos(ph * 0.83) * (b.ay || 0);
        B[i * 4 + 2] = b.r * sc * (1 + 0.06 * Math.sin(ph * 0.7));
        B[i * 4 + 3] = b.w;
      }
      gl.uniform4fv(u.uB, B);
      gl.uniform1i(u.uN, n);
      const rb = (o.ribbons && !(o.ribbonsMin && this.cssW < o.ribbonsMin)) ? o.ribbons : {};
      this.ribbonUniforms(u, rb.h, 'uRh', this.cssH, 'uNh');
      this.ribbonUniforms(u, rb.v, 'uRv', this.cssW, 'uNv');
      gl.uniform1f(u.uGain, o.gain);
      gl.uniform1f(u.uWarpAmt, o.warp);
      gl.uniform1f(u.uMaskOn, o.mask ? 1 : 0);
      const fg = this.finger, fr = o.fingerR || 64;
      gl.uniform4f(u.uFg, fg ? fg.x : 0, fg ? fg.y : 0, fr, this.fs || 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mtex);
      gl.uniform1i(u.uMask, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // pass 2: yarns
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.W, this.H);
      gl.useProgram(this.pw.p);
      const w = this.pw.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ftex);
      gl.uniform1i(w.uF, 0);
      gl.uniform2f(w.uCells, this.cx, this.cy);
      gl.uniform1f(w.uPitchD, this.pitchD);
      gl.uniform1f(w.uDpr, this.dpr);
      gl.uniform1f(w.uT, t);
      gl.uniform3fv(w.uLab0, this.lab[0]); gl.uniform3fv(w.uLab1, this.lab[1]);
      gl.uniform3fv(w.uLab2, this.lab[2]); gl.uniform3fv(w.uLab3, this.lab[3]);
      gl.uniform3fv(w.uWarp, this.cols.warp); gl.uniform3fv(w.uGround, this.cols.ground); gl.uniform3fv(w.uSpec, this.cols.spec);
      const a = o.light + t * 0.045;
      let lx = Math.cos(a) * 0.75, ly = Math.sin(a) * 0.75;
      if (o.pointer && this.ptr && !reduce.matches) {
        const now = performance.now();
        const on = now - this.ptr.t < 6000 ? 1 : 0;
        const kp = 1 - Math.exp(-this.dt / 0.5), kl = 1 - Math.exp(-this.dt / 0.33);
        this.pk = (this.pk || 0) + (on - (this.pk || 0)) * kp;
        this.lx = this.lx == null ? this.ptr.x : this.lx + (this.ptr.x - this.lx) * kl;
        this.ly = this.ly == null ? this.ptr.y : this.ly + (this.ptr.y - this.ly) * kl;
        lx += (this.lx - lx) * this.pk;
        ly += (this.ly - ly) * this.pk;
      }
      gl.uniform2f(w.uLight, lx, ly);
      const RB = new Float32Array(24), RW = new Float32Array(6);
      const nr = Math.min(6, this.rects.length);
      for (let i = 0; i < nr; i++) { const q = this.rects[i]; RB.set([q.x, q.y, q.w, q.h], i * 4); RW[i] = q.wt; }
      gl.uniform4fv(w.uR, RB);
      gl.uniform1fv(w.uRw, RW);
      gl.uniform1i(w.uNR, nr);
      const p = this.pulse, age = p ? (performance.now() - p.t) / 1000 : 9;
      gl.uniform4f(w.uP, p ? p.x : 0, p ? p.y : 0, age, p && age < 4 ? (p.s || 1) : 0);
      gl.uniform4f(w.uFgW, fg ? fg.x : 0, fg ? this.cssH - fg.y : 0, fr, this.fs || 0);
      gl.uniform1f(w.uSheen, o.sheen);
      gl.uniform1f(w.uSolid, o.solid ? 1 : 0);
      gl.uniform1f(w.uDim, o.dim ?? .4);
      gl.uniform1f(w.uFine, (window.devicePixelRatio || 1) >= 1.75 ? 1 : (o.fine ?? .45));
      gl.uniform1f(w.uHiOn, o.hiMask ? 1 : 0);
      gl.uniform1f(w.uHiBg, o.hiBg ?? .08);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.htex);
      gl.uniform1i(w.uHi, 2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!this.shown) { this.shown = true; requestAnimationFrame(() => this.c.classList.add('is-on')); }
    }
  }

  /* Shared ticker, capped at 60 fps, runs only the looms that are on screen. */
  const live = new Set();
  let raf = 0, last = 0, paused = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const T0 = performance.now();
  // draw on every n-th frame, n chosen from the measured refresh, so the cadence stays even (60 Hz: 1, 120/144 Hz: 2)
  let frames = 0, iv = 16.7, lastNow = 0;
  function tick(now) {
    raf = 0;
    if (paused || reduce.matches || !live.size) { lastNow = 0; return; }
    if (lastNow) { const d = now - lastNow; if (d > 3 && d < 50) iv += (d - iv) * 0.05; }
    lastNow = now;
    if (++frames % Math.max(1, Math.round(15 / iv)) === 0) {
      const t = (now - T0) / 1000;
      live.forEach((l) => {
        l.draw(l.o.still ? (l.o.t0 || 0) : t + (l.o.t0 || 0));
        if (l.o.still && !l.fTarget && (l.fs || 0) < 0.004 && (l.pk || 0) < 0.01) live.delete(l);
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && !paused && !reduce.matches && live.size) raf = requestAnimationFrame(tick); }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const l = e.target.__loom;
      if (!l) return;
      if (e.isIntersecting) { if (!l.o.still) live.add(l); l.size(); l.draw(l.o.still ? (l.o.t0 || 0) : (performance.now() - T0) / 1000 + (l.o.t0 || 0)); }
      else live.delete(l);
    });
    wake();
  }, { rootMargin: '120px 0px' });

  const all = [];
  function mount(canvas, opts) {
    const l = new Loom(canvas, opts);
    if (!l.ok) return null;
    canvas.__loom = l;
    all.push(l);
    const ro = new ResizeObserver(() => { if (l.size()) l.draw(l.o.still ? (l.o.t0 || 0) : (performance.now() - T0) / 1000 + (l.o.t0 || 0)); });
    ro.observe(canvas);
    io.observe(canvas);
    if (opts.pointer && !reduce.matches) {
      const area = opts.pointerArea || canvas;
      addEventListener('pointermove', (e) => {
        const a = area.getBoundingClientRect();
        if (e.clientY < a.top || e.clientY > a.bottom || e.clientX < a.left || e.clientX > a.right) return;
        const r = canvas.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)));
        const y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (Math.max(r.height, 240) / 2)));
        l.ptr = { x: x * 0.6, y: -y * 0.6, t: performance.now() };
        if (opts.hover) {
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (inside) l.finger = { x: e.clientX - r.left, y: e.clientY - r.top };
          l.fTarget = inside ? (l.pressK || 1) : 0;
          if (!live.has(l)) { live.add(l); wake(); }
        }
      }, { passive: true });
      if (opts.hover) area.addEventListener('pointerleave', () => { l.fTarget = 0; });
    }
    return l;
  }
  reduce.addEventListener?.('change', () => { all.forEach((l) => l.draw(l.o.t0 || 0)); wake(); });

  window.Loom = {
    mount,
    pause(v) { paused = v; if (!v) wake(); },
    pulse(canvas, x, yTop, s) { const l = canvas && canvas.__loom; if (!l || reduce.matches) return; l.pulse = { x, y: l.cssH - yTop, t: performance.now(), s: s || 1 }; },
    // how deep the finger presses while it is over a hover loom (1 = resting touch)
    press(canvas, k) {
      const l = canvas && canvas.__loom; if (!l) return;
      l.pressK = k;
      if (l.fTarget > 0) { l.fTarget = k; if (!live.has(l)) live.add(l); wake(); }
    },
    get paused() { return paused; },
    redraw() { all.forEach((l) => { l.size(); l.draw((performance.now() - T0) / 1000 + (l.o.t0 || 0)); }); },
  };
})();
