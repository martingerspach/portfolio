/* Glossa: live halftone screen for the hero and the footer plates.
   The tone map (share of light ink per pixel, made by _outils/halftone.py) is screened on the GPU with an
   Euclidean dot at 45 degrees, at the device pixel density, so dots stay sharp at any size and zoom.
   Arrival: the plate develops like a print, lights first, then the mid-tones (1.9 s), once it is in view and its
   opts.gate promise (if any) has resolved. Scrolling the plate out of view eases a slight push-in on its focus.
   Draws only when something changes. */
(function () {
  'use strict';

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    '#ifdef GL_OES_standard_derivatives',
    '#extension GL_OES_standard_derivatives : enable',
    '#endif',
    'precision highp float;',
    'uniform sampler2D uTone;uniform sampler2D uLut;',
    'uniform vec2 uRes;uniform float uPitch;uniform vec4 uMap;uniform vec3 uBg;uniform vec3 uInk;',
    'uniform float uDev;uniform float uZoom;uniform vec2 uFocus;',
    'float hash(vec2 q){return fract(sin(dot(q,vec2(41.3,289.1)))*43758.5453);}',
    'void main(){',
    '  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    '  vec2 uv=px/uRes;',
    '  uv=uFocus+(uv-uFocus)/uZoom;',
    '  vec2 tuv=uMap.xy+uv*uMap.zw;',
    '  float c=texture2D(uTone,tuv).r;',
    '  if(tuv.x<0.||tuv.x>1.||tuv.y<0.||tuv.y>1.)c=0.;',
    /* development: each cell gets a start time from its tone (lights first) and a little grain */
    '  vec2 r=mat2(.70710678,-.70710678,.70710678,.70710678)*px/uPitch;',
    '  vec2 cell=floor(r);',
    '  float delay=(1.-c)*.62+hash(cell)*.18;',
    '  float k=clamp((uDev*1.8-delay)/1.,0.,1.);',
    '  k=k*k*(3.-2.*k);',
    '  c=min(c,.965)*k;',
    '  vec2 f=fract(r)-.5;',
    '  float s=(cos(6.2831853*f.x)+cos(6.2831853*f.y))*.5;',
    '  float t=texture2D(uLut,vec2(c*.99609+.00195,.5)).r*2.-1.;',
    '  float w=max(fwidth(s),1e-4);',
    '  float a=clamp((s-t)/w+.5,0.,1.);',
    '  if(c<.004)a=0.;',
    '  if(c>.996)a=1.;',
    '  gl_FragColor=vec4(mix(uBg,uInk,a),1.);',
    '}'
  ].join('\n');

  /* threshold for a target area of light ink, for the Euclidean spot (s > t) */
  function lut() {
    var n = 160, vals = new Float32Array(n * n), k = 0, i, j;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      var fx = (i + 0.5) / n - 0.5, fy = (j + 0.5) / n - 0.5;
      vals[k++] = (Math.cos(6.2831853 * fx) + Math.cos(6.2831853 * fy)) * 0.5;
    }
    vals.sort();
    var out = new Uint8Array(256 * 4);
    for (i = 0; i < 256; i++) {
      var area = i / 255;
      /* s > t covers `area`: t is the value below which (1 - area) of the samples fall */
      var idx = Math.min(vals.length - 1, Math.max(0, Math.round((1 - area) * (vals.length - 1))));
      var t = area <= 0 ? 1 : area >= 1 ? -1 : vals[idx];
      var v = Math.round((t + 1) / 2 * 255);
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
    }
    return out;
  }

  function hex(h) {
    return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  }

  function mount(el, opts) {
    var canvas = el.querySelector('canvas');
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    var derivs = gl.getExtension('OES_standard_derivatives');
    if (!derivs) return null;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var prog = gl.createProgram();
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uTone', 'uLut', 'uRes', 'uPitch', 'uMap', 'uBg', 'uInk', 'uDev', 'uZoom', 'uFocus'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var lutTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uLut, 1);
    gl.uniform1i(U.uTone, 0);
    gl.uniform3fv(U.uBg, hex(opts.bg));
    gl.uniform3fv(U.uInk, hex(opts.ink));

    var tex = gl.createTexture(), img = null, iw = 1, ih = 1;
    var W = 0, H = 0, dpr = 1, dev = opts.reduced ? 1 : 0, zoom = 1, want = 1, raf = 0, visible = false, started = false;
    var t0 = 0, DUR = 2600;
    var gateOpen = !opts.gate;
    if (opts.gate) opts.gate.then(function () { gateOpen = true; if (visible && img && !started) { started = true; t0 = 0; kick(); } });

    function cover() {
      /* object-fit: cover with an object-position given in opts.pos (0..1); returns uv offset and scale */
      var s = Math.max(W / iw, H / ih);
      var dw = iw * s, dh = ih * s;
      var px = opts.pos ? opts.pos[0] : 0.5, py = opts.pos ? opts.pos[1] : 0.5;
      if (typeof opts.posFn === 'function') { var p = opts.posFn(W / dpr, H / dpr); px = p[0]; py = p[1]; }
      var ox = (W - dw) * px, oy = (H - dh) * py;
      return [-ox / dw, -oy / dh, W / dw, H / dh];
    }

    function resize() {
      var r = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      draw();
    }

    function draw() {
      if (!img || !W) return;
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uPitch, (opts.pitchFn ? opts.pitchFn(W / dpr) : (opts.pitch || 4)) * dpr);
      gl.uniform4fv(U.uMap, cover());
      gl.uniform1f(U.uDev, dev);
      gl.uniform1f(U.uZoom, zoom);
      gl.uniform2fv(U.uFocus, opts.focus || [0.5, 0.5]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function tick(now) {
      raf = 0;
      var again = false;
      if (started && dev < 1) {
        if (!t0) t0 = now;
        var x = Math.min(1, (now - t0) / DUR);
        dev = 1 - Math.pow(1 - x, 2.2);
        again = x < 1;
      }
      var dz = want - zoom;
      if (Math.abs(dz) > 1e-4) { zoom += dz * 0.18; again = true; } else zoom = want;
      draw();
      if (again) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }

    function onScroll() {
      if (!visible || opts.reduced || !opts.push) return;
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      /* 0 while the plate fills the screen, 1 when it has left */
      var out = opts.push === 'leave' ? Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))) :
        Math.min(1, Math.max(0, (r.bottom - vh) / Math.max(1, r.height)));
      want = 1 + out * opts.pushAmount;
      kick();
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible && img && !started && gateOpen && e.intersectionRatio >= (opts.startRatio || 0)) { started = true; t0 = 0; kick(); }
      });
    }, { threshold: [0, opts.startRatio || 0.01, 0.25] });

    var ro = new ResizeObserver(function () { resize(); });

    img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      iw = img.naturalWidth; ih = img.naturalHeight;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      W = H = 0;
      resize();
      el.classList.add('is-live');
      ro.observe(el);
      io.observe(el);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };
    img.onerror = function () { el.classList.add('is-fallback'); };
    img.src = opts.tone;

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); el.classList.remove('is-live'); el.classList.add('is-fallback'); });

    return {
      replay: function () { if (opts.reduced) return; dev = 0; t0 = 0; started = true; kick(); },
      set reduced(v) { opts.reduced = v; if (v) { dev = 1; want = zoom = 1; draw(); } }
    };
  }

  window.GlossaScreen = { mount: mount };
})();
