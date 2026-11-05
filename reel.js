/* The reel: every project printed on one strip of film, wound into a helix and drawn in WebGL2.
   The geometry follows the reference portfolio (a strip on a cylinder, six frames per turn, a slight
   look down), but the strip is a real textured mesh: perspective-correct mapping, mipmaps, MSAA and
   a depth buffer, so turns cross cleanly and the far side never bands or shimmers.

     u   position along the strip, in frames (0 = the gate, the frame facing us)
     v   across the strip, from -1 (bottom edge) to 1 (top edge)
     R   coil radius, K its drop per radian, W strip width, LEN = hypot(R, K)

   Motion: the strip slides along itself, so motion blur is a blur along the strip, in texture space,
   sampled across frame borders (blur, in frames). The side and vertical fades are computed per pixel
   from the screen position, on smootherstep curves, and dithered so they never band.            */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const TURN = 6;           // frames per revolution
  const SEG = 30;           // mesh segments per frame along the strip
  const SLOTS = 11;         // frames drawn on each side of the gate
  const FOV = 1500;         // camera distance, in CSS px
  const LOOK = -0.07;       // radians: a slight look down on the coil

  const VS = `#version 300 es
  precision highp float;
  in vec3 aPos;                     // x: slot (integer), y: s along the frame 0..1, z: v across -1..1
  uniform float uFrac, uBase;
  uniform float uR, uK, uLen, uW;
  uniform vec2 uView;               // viewport, CSS px
  uniform vec2 uCenter;             // coil centre on screen, CSS px
  uniform float uDepth, uZoom;
  uniform float uMorphFrame, uMorphK;
  uniform vec4 uMorphRect;          // x, y, w, h (CSS px)
  out vec2 vUV;
  out float vV, vFacing;
  flat out float vFrame;
  flat out float vMorph;
  void main() {
    float slot = aPos.x, s = aPos.y, v = aPos.z;
    float u = slot + s - uFrac - 0.5;
    float th = u * ${(TAU / TURN).toFixed(8)};
    float sn = sin(th), cs = cos(th);
    float half_ = 0.5 * uW * v;
    float x = uR * sn + half_ * uK * cs / uLen;
    float y = uK * th - half_ * uR / uLen;
    float z = uR * cs - half_ * uK * sn / uLen;
    float cl = cos(${LOOK.toFixed(4)}), sl = sin(${LOOK.toFixed(4)});
    float yt = y * cl - z * sl;
    float zt = y * sl + z * cl;
    float k = ${FOV.toFixed(1)} / (${FOV.toFixed(1)} - zt);
    vec2 scr = uCenter + vec2(x, yt) * k * uZoom;  // CSS px, y down
    float w = 1.0 / k;
    float depth = clamp(-zt / uDepth, -0.98, 0.98);

    float frame = uBase + slot;
    float isMorph = step(abs(frame - uMorphFrame), 0.5);
    vMorph = isMorph;
    if (isMorph > 0.5 && uMorphK > 0.0) {
      vec2 flat_ = uMorphRect.xy + vec2(s, (1.0 - v) * 0.5) * uMorphRect.zw;
      float e = uMorphK;
      scr = mix(scr, flat_, e);
      w = mix(w, 1.0, e);
      depth = mix(depth, -0.99, smoothstep(0.0, 0.15, e));
    }
    vUV = vec2(s, (1.0 - v) * 0.5);
    vV = v;
    vFacing = cs;
    vFrame = frame;
    vec2 ndc = vec2(scr.x / uView.x * 2.0 - 1.0, 1.0 - scr.y / uView.y * 2.0);
    gl_Position = vec4(ndc * w, depth * w, w);
  }`;

  const FS = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  uniform sampler2DArray uTex;
  uniform vec3 uBg, uInk, uTile;
  uniform float uReady[32];
  uniform float uDark, uN;
  uniform vec2 uView, uCenter;      // CSS px
  uniform float uDpr, uR;
  uniform vec4 uFade;               // vertical fade: top start, top end, bottom start, bottom end (CSS px)
  uniform float uMorphK, uOthers;
  uniform vec4 uCrop;               // the leaving frame's crop: offset xy, scale zw
  uniform float uBlur;              // motion blur along the strip, in frames
  uniform int uTaps;
  in vec2 vUV;
  in float vV, vFacing;
  flat in float vFrame;
  flat in float vMorph;
  out vec4 o;

  float smoother(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
  float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

  // One sample of the strip at s along the current frame; s may run into the neighbouring frames.
  vec3 strip(float s, float t, bool back, vec2 gx, vec2 gy, float fu) {
    float f = vFrame + floor(s);
    float ls = fract(s);
    float layer = mod(f, uN);
    vec2 uv = vec2(back ? 1.0 - ls : ls, t);
    vec3 c = mix(uTile, textureGrad(uTex, vec3(uv, layer), gx, gy).rgb, uReady[int(layer + 0.5)]);
    float gut = 1.0 - smoothstep(0.0, fu, min(ls, 1.0 - ls));   // the frame line, like the gutter of a contact sheet
    return mix(c, uBg, gut * 0.55);
  }

  void main() {
    bool back = !gl_FrontFacing && vMorph < 0.5;
    vec2 gx = dFdx(vUV), gy = dFdy(vUV);
    float fu = max(fwidth(vUV.x), 1e-4);
    vec3 c;
    if (vMorph > 0.5) {
      // the leaving frame: cropped like a cover image toward the shape of the page it opens
      float layer = mod(vFrame, uN);
      vec2 uv = uCrop.xy + vUV * uCrop.zw;
      c = mix(uTile, textureGrad(uTex, vec3(uv, layer), gx * uCrop.zw, gy * uCrop.zw).rgb, uReady[int(layer + 0.5)]);
      float gut = 1.0 - smoothstep(0.0, fu, min(vUV.x, 1.0 - vUV.x));
      c = mix(c, uBg, gut * 0.55 * (1.0 - smoothstep(0.0, 0.2, uMorphK)));
    } else if (uTaps <= 1) {
      c = strip(vUV.x, vUV.y, back, gx, gy, fu);
    } else {
      // a soft shutter: taps spread along the strip, weighted by a raised cosine, jittered per pixel
      float n = float(uTaps), sum = 0.0;
      float j = (hash(gl_FragCoord.xy) - 0.5) * 0.35 / n;   // a little jitter hides the steps between taps
      c = vec3(0.0);
      for (int i = 0; i < 33; i++) {
        if (i >= uTaps) break;
        float x = clamp((float(i) + 0.5) / n * 2.0 - 1.0 + j * 2.0, -1.0, 1.0);
        float wt = 0.5 + 0.5 * cos(3.14159265 * x);
        c += strip(vUV.x + x * 0.5 * uBlur, vUV.y, back, gx, gy, fu) * wt;
        sum += wt;
      }
      c /= max(sum, 1e-4);
    }
    if (back) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 0.55);                          // washed back: desaturated...
      c = mix(uBg, c, mix(0.34, 0.26, uDark));            // ...and pushed toward the page
    }
    // hairlines on both edges, so the flow of the strip stays readable where turns cross
    float fv = max(fwidth(vV), 1e-4);
    float edge = 1.0 - smoothstep(0.0, 1.25 * fv, 1.0 - abs(vV));
    float face = abs(vFacing);
    c = mix(c, uInk, edge * 0.26 * face * step(0.14, face) * (1.0 - vMorph));

    // fades, per pixel: the flanks of the coil dissolve into the page, and so do its top and bottom
    vec2 p = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
    float lift = vMorph * smoothstep(0.0, 0.28, uMorphK);   // the leaving frame sheds its fades early
    float hx = abs(p.x - uCenter.x) / max(uR, 1.0);
    float side = 1.0 - smoother(0.62, 1.01, hx);
    float vert = smoother(uFade.x, uFade.y, p.y) * (1.0 - smoother(uFade.z, uFade.w, p.y));
    float a = mix(side * vert, 1.0, lift) * mix(uOthers, 1.0, vMorph);
    a = clamp(a + (hash(gl_FragCoord.yx + 7.0) - 0.5) / 255.0, 0.0, 1.0);   // dither: no banding in the long fades
    o = vec4(c * a, a);
  }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Reel shader: ' + log);
    }
    return sh;
  }

  class Reel {
    constructor(canvas, frames) {
      this.canvas = canvas;
      this.frames = frames;                 // urls, in strip order
      this.N = frames.length;
      const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no webgl2');
      this.gl = gl;
      const pr = gl.createProgram();
      gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('Reel link: ' + gl.getProgramInfoLog(pr));
      this.pr = pr;
      this.u = {};
      const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(pr, i);
        const name = info.name.replace(/\[0\]$/, '');
        this.u[name] = gl.getUniformLocation(pr, info.name);
      }
      this.buildMesh();
      this.ready = new Float32Array(32);
      this.queue = [];
      this.loaded = 0;
      this.mips = false;
      this.dirty = true;
      this.theme = { bg: [0.957, 0.949, 0.937], ink: [0.12, 0.125, 0.118], tile: [0.9, 0.89, 0.875], dark: 0 };
      this.morph = { frame: -1e6, k: 0, rect: [0, 0, 1, 1], others: 1, crop: [0, 0, 1, 1] };
      this.blur = 0;            // motion blur length, in frames
      this.zoom = 1;            // the camera pulls back a little while the reel runs fast
      this.gateDevice = 600;
      this.L = null;
    }

    buildMesh() {
      const gl = this.gl;
      const verts = [];
      const idx = [];
      let base = 0;
      for (let slot = -SLOTS; slot <= SLOTS; slot++) {
        for (let i = 0; i <= SEG; i++) {
          const s = i / SEG;
          verts.push(slot, s, 1, slot, s, -1);       // top, bottom
        }
        for (let i = 0; i < SEG; i++) {
          const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
          idx.push(a, b, c, c, b, d);
        }
        base += (SEG + 1) * 2;
      }
      this.count = idx.length;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.pr, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.vao = vao;
    }

    /* Texture size follows the size of the frame in the gate, in device pixels. */
    allocTextures(gateDevicePx) {
      const gl = this.gl;
      const want = gateDevicePx * 1.08;
      const TW = want > 1100 ? 1600 : want > 900 ? 1280 : want > 700 ? 1024 : want > 520 ? 800 : 640;
      if (this.tex && this.TW >= TW) return;
      const TH = TW * 3 / 4;
      if (this.tex) gl.deleteTexture(this.tex);
      this.TW = TW; this.TH = TH;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      const levels = Math.floor(Math.log2(Math.max(TW, TH))) + 1;
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, TW, TH, this.N);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension('EXT_texture_filter_anisotropic');
      if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      this.ready.fill(0);
      this.loaded = 0;
      this.mips = false;
      this.queue.length = 0;
      this.gen = (this.gen || 0) + 1;
      const gen = this.gen;
      this.frames.forEach((url, i) => this.fetchFrame(url, i, gen));
    }

    async fetchFrame(url, i, gen) {
      try {
        const blob = await (await fetch(url)).blob();
        let bmp;
        try {
          bmp = await createImageBitmap(blob, { resizeWidth: this.TW, resizeHeight: this.TH, resizeQuality: 'high' });
        } catch (e) {
          const img = await createImageBitmap(blob);
          const c = document.createElement('canvas');
          c.width = this.TW; c.height = this.TH;
          c.getContext('2d').drawImage(img, 0, 0, this.TW, this.TH);
          bmp = c;
        }
        if (gen !== this.gen) return;
        this.queue.push({ i, bmp });
        this.dirty = true;
      } catch (e) {
        /* a missing frame keeps its tile colour */
      }
    }

    upload() {
      if (!this.queue.length) return false;
      const gl = this.gl;
      const { i, bmp } = this.queue.shift();     // one frame per animation frame keeps uploads off the critical path
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, this.TW, this.TH, 1, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      if (bmp.close) bmp.close();
      this.ready[i] = 1;
      this.loaded++;
      if (this.loaded === this.N) {
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        this.mips = true;
      }
      this.dirty = true;
      return true;
    }

    /* Layout. cx, cy: coil centre; R: radius; fade: [top0, top1, bot0, bot1] in CSS px. */
    layout({ vw, vh, cx, cy, R, fade, dpr }) {
      let RISE = vh * 0.45;
      let K = 0, LEN = 0;
      for (let pass = 0; pass < 6; pass++) {
        K = RISE / TAU;
        RISE = 0.75 * Math.hypot(R, K) * (TAU / TURN) * 1.95;
      }
      K = RISE / TAU;
      LEN = Math.hypot(R, K);
      const W = 0.75 * LEN * (TAU / TURN);
      this.L = { vw, vh, cx, cy, R, K, LEN, W, RISE, fade, dpr };
      const c = this.canvas;
      const pw = Math.round(vw * dpr), ph = Math.round(vh * dpr);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
      const gateCss = LEN * (TAU / TURN) * (FOV / (FOV - R));
      this.gateDevice = gateCss * dpr;
      this.allocTextures(gateCss * dpr);
      this.dirty = true;
      return this.L;
    }

    setTheme(t) { this.theme = t; this.dirty = true; }

    /* The projected corners of one piece of the strip, as the vertex shader computes them. */
    project(u, v) {
      const { R, K, LEN, W, cx, cy } = this.L;
      const th = u * TAU / TURN;
      const sn = Math.sin(th), cs = Math.cos(th);
      const h = 0.5 * W * v;
      const x = R * sn + h * K * cs / LEN;
      const y = K * th - h * R / LEN;
      const z = R * cs - h * K * sn / LEN;
      const cl = Math.cos(LOOK), sl = Math.sin(LOOK);
      const yt = y * cl - z * sl;
      const zt = y * sl + z * cl;
      const k = FOV / (FOV - zt) * this.zoom;
      return { x: cx + x * k, y: cy + yt * k, z: zt };
    }

    /* Frame under the pointer (absolute index along the strip), front faces only, nearest first. */
    hit(px, py, pos) {
      if (!this.L) return null;
      const base = Math.floor(pos), frac = pos - base;
      let best = null;
      const SUB = 10;
      const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const inTri = (p, a, b, c) => {
        const s1 = cross(a, b, p), s2 = cross(b, c, p), s3 = cross(c, a, p);
        return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
      };
      const P = { x: px, y: py };
      const { fade, R, cx } = this.L;
      for (let slot = -4; slot <= 4; slot++) {
        for (let i = 0; i < SUB; i++) {
          const u0 = slot + i / SUB - frac - 0.5, u1 = u0 + 1 / SUB;
          const A = this.project(u0, 1), B = this.project(u0, -1), C = this.project(u1, 1), D = this.project(u1, -1);
          // front faces wind clockwise on a y-down screen
          if (cross(A, B, C) > 0) continue;
          const y = (A.y + B.y) / 2;
          if (y < fade[1] || y > fade[2]) continue;
          if (Math.abs((A.x + C.x) / 2 - cx) > R * 0.9) continue;    // the dissolved flanks are not clickable
          if (inTri(P, A, B, C) || inTri(P, C, B, D)) {
            const z = (A.z + C.z) / 2;
            if (!best || z > best.z) best = { frame: base + slot, z };
          }
        }
      }
      return best ? best.frame : null;
    }

    /* Screen quad of an absolute frame (for the morph start, or a focus ring). */
    quadOf(frame, pos) {
      const u0 = frame - pos - 0.5;
      return [this.project(u0, 1), this.project(u0 + 1, 1), this.project(u0 + 1, -1), this.project(u0, -1)];
    }

    render(pos) {
      const gl = this.gl;
      if (!this.L) return;
      this.upload();
      const { vw, vh, cx, cy, R, K, LEN, W, fade } = this.L;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.pr);
      const u = this.u;
      const base = Math.floor(pos);
      gl.uniform1f(u.uFrac, pos - base);
      gl.uniform1f(u.uBase, base);
      gl.uniform1f(u.uN, this.N);
      gl.uniform1f(u.uR, R);
      gl.uniform1f(u.uK, K);
      gl.uniform1f(u.uLen, LEN);
      gl.uniform1f(u.uW, W);
      gl.uniform2f(u.uView, vw, vh);
      gl.uniform2f(u.uCenter, cx, cy);
      gl.uniform1f(u.uDpr, this.canvas.width / vw);
      gl.uniform1f(u.uDepth, R + W + 40);
      gl.uniform1f(u.uZoom, this.zoom);
      gl.uniform4f(u.uFade, fade[0], fade[1], fade[2], fade[3]);
      const m = this.morph;
      gl.uniform1f(u.uMorphFrame, m.frame);
      gl.uniform1f(u.uMorphK, m.k);
      gl.uniform4f(u.uMorphRect, m.rect[0], m.rect[1], m.rect[2], m.rect[3]);
      gl.uniform4f(u.uCrop, m.crop[0], m.crop[1], m.crop[2], m.crop[3]);
      gl.uniform1f(u.uOthers, m.others);
      // blur taps: about one every 1.6 device pixels of smear in the gate, so high-contrast edges stay clean
      const smear = this.blur * this.gateDevice;
      const taps = this.blur > 0.0015 ? Math.min(33, Math.max(3, Math.ceil(smear / 1.6) | 1)) : 1;
      gl.uniform1f(u.uBlur, taps > 1 ? this.blur : 0);
      gl.uniform1i(u.uTaps, taps);
      const t = this.theme;
      gl.uniform3f(u.uBg, t.bg[0], t.bg[1], t.bg[2]);
      gl.uniform3f(u.uInk, t.ink[0], t.ink[1], t.ink[2]);
      gl.uniform3f(u.uTile, t.tile[0], t.tile[1], t.tile[2]);
      gl.uniform1f(u.uDark, t.dark);
      gl.uniform1fv(u.uReady, this.ready);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform1i(u.uTex, 0);
      gl.bindVertexArray(this.vao);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      this.dirty = this.queue.length > 0;
    }
  }

  Reel.TURN = TURN;
  window.Reel = Reel;
})();
