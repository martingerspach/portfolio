/* Martin Gerspach, portfolio: the page changes.
   Each one is a pure function of its own clock: begin() sets up layers before the page changes, mounted()
   measures the new page, frame(t) draws the instant t (ms), end() hands the page back. Everything moves with
   transforms, opacity and clip-paths, written once per frame; nothing reads layout inside frame().
   Work: the reel rolls in on its spring. A project: a curtain of squares in its brand's colours, from Work and
   from one project to the next. Playground: the wall rises. About: a sheet. Contact: the shutters open on the light of the moment.
   Chosen on the transition bench (banc/, 2026-11-02). Under reduced motion, app.js cross-fades instead. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-6) break; const s = dX(t); if (Math.abs(s) < 1e-6) break; t -= d / s; }
      return Y(clamp(t, 0, 1));
    };
  }
  /* The curves. One family: long, decided decelerations; nothing overshoots. */
  const E = {
    out: bezier(0.16, 1, 0.3, 1),      // arrivals
    soft: bezier(0.22, 1, 0.36, 1),    // the site's own --ease (text rising)
    io: bezier(0.7, 0, 0.2, 1),        // the reel's morph
    inn: bezier(0.5, 0, 0.75, 0),      // departures
    exit: bezier(0.33, 0, 0.67, 1),    // the old page leaving: it answers on the first frame, gone in 160 ms
    rec: bezier(0.72, 0, 0.12, 1),     // one sheet laid over another
    draw: bezier(0.65, 0, 0.35, 1),    // a line drawn by hand
    fly: bezier(0.6, 0, 0.12, 1),      // a shared element in flight: lifts, then lands softly
    back: bezier(0.45, 0, 0.12, 1),    // a page going back into its frame: answers at once, lands softly
    zoom: bezier(0.55, 0, 0.1, 1),     // a camera pulling back
    open: bezier(0.6, 0, 0.25, 1),     // a frame opening into its page, without a long tail
    shrink: bezier(0.3, 0, 0.1, 1),    // a page shrinking back into its frame: no hold at the start
    unroll: bezier(0.4, 0, 0.2, 1),    // a print coming out
    roll: bezier(0.3, 0, 0, 1),        // slot letters (the site's reel-spin)
    wipeIn: bezier(0.55, 0.02, 0.2, 1),
    wipeOut: bezier(0.7, 0, 0.25, 1),
  };
  const rectOf = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; };
  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

  const TR = window.TR = { running: null, E, by: {} };
  const define = (key, v) => { TR.by[key] = v; return v; };
  TR.keyOf = (from, to) => {
    if (to.name === 'project') return from && from.name === 'project' ? 'next' : 'project';
    return to.name;
  };
  // a page with no transition of its own changes at once
  const CUT = { dur: 0, frame() {} };
  TR.go = (c) => run(TR.by[TR.keyOf(c.from, c.to)] || CUT, c);

  async function run(v, c) {
    const main = $('#main');
    const html = document.documentElement;
    const touched = new Map();
    const ctx = Object.assign(c, {
      v, main, html, app: window.__APP, layers: [], cleanups: [],
      vw: html.clientWidth, vh: innerHeight,
      oRect: c.origin && c.origin.nodeType === 1 && c.origin.isConnected ? rectOf(c.origin)
        : c.origin && typeof c.origin.x === 'number' ? { x: c.origin.x, y: c.origin.y, w: 0, h: 0, cx: c.origin.x, cy: c.origin.y } : null,
      D: typeof v.dur === 'number' ? v.dur : 1200,
      swap: v.swap || 0,
      set(el, prop, val) {
        if (!el) return;
        el.style.setProperty(prop, val);
        let s = touched.get(el);
        if (!s) touched.set(el, (s = new Set()));
        s.add(prop);
      },
      layer(el) { document.body.appendChild(el); ctx.layers.push(el); return el; },
      // a move handed to the compositor (opacity and transform only): it starts with the click and runs on, whole,
      // while the main thread is busy mounting the next page
      T0: performance.now(),
      anims: [],
      early(el, frames, opts) {
        if (!el || typeof el.animate !== 'function') return null;
        const a = el.animate(frames, Object.assign({ fill: 'both', easing: 'linear' }, opts));
        ctx.anims.push(a);
        return a;
      },
    });
    TR.running = ctx;
    main.classList.remove('tr-done');
    main.classList.add('tr-own');
    let mounted = false;
    const doMount = () => {
      if (mounted) return;
      mounted = true;
      ctx.mount();
      if (ctx.moved) [...ctx.moved.querySelectorAll('[id]')].forEach((e) => e.removeAttribute('id'));
      ctx.riseEls = null;
      if (v.mounted) v.mounted(ctx);
    };
    // Mounting a page blocks the main thread (30 ms on a fast machine, 200 ms on a slow or busy one). A change that
    // gives its exit to the compositor (v.hold) mounts after it has started: one frame to hand it over, longer
    // while something still has to be drawn by script (the reel rolling on, v.pre). The click is answered at once
    // and the exit never loses a frame to the mounting.
    const held = () => new Promise((res) => {
      const until = ctx.T0 + (typeof v.hold === 'function' ? v.hold(ctx) : v.hold);
      const step = (now) => {
        try { if (v.pre) v.pre(now - ctx.T0, ctx); } catch (e) { console.warn('Page change:', e); }
        if (now >= until) setTimeout(res, 0); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    try {
      if (v.begin) v.begin(ctx);
      if (ctx.swap <= 0) {
        if (v.hold !== undefined) await held();
        doMount();
      }
      // the clock takes up where the exit is (v.lead at most: what comes in always starts from its own beginning)
      const leadMax = v.lead || 0;
      v.frame(clamp(performance.now() - ctx.T0, 0, leadMax), ctx);
      // the first pose (the page as it was) is drawn twice before the clock starts: new layers are rastered
      // while nothing moves, instead of stalling the first frames of the motion
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (ctx.D > 0) {
        await new Promise((res, rej) => {
          let t0 = -1;
          const step = (now) => {
            try {
              if (t0 < 0) t0 = now - clamp(now - ctx.T0, 0, leadMax);
              const t = now - t0;
              if (!mounted && t >= ctx.swap) doMount();
              v.frame(Math.min(t, ctx.D), ctx);
              if (t < ctx.D) requestAnimationFrame(step); else res();
            } catch (e) { rej(e); }
          };
          requestAnimationFrame(step);
        });
      }
      if (v.end) v.end(ctx);
    } catch (e) {
      // a page change that fails still lands on its page, and leaves nothing behind
      console.warn('Page change:', e);
      try { doMount(); } catch (e2) { console.warn('Page change:', e2); }
    }
    // the page gets its own styles back in the frame of the last pose (no extra frame where texts re-raster);
    // CSS transitions come back two frames later, so nothing animates from a state that was never shown
    ctx.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.warn('Page change:', e); } });
    touched.forEach((s, el) => s.forEach((p) => { if (p !== 'transition') el.style.removeProperty(p); }));
    ctx.layers.forEach((l) => l.remove());
    ctx.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* its element is gone */ } });
    main.classList.remove('tr-own');
    main.classList.add('tr-done');
    TR.running = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      touched.forEach((s, el) => { if (s.has('transition')) el.style.removeProperty('transition'); });
    }));
  }

  /* ---------- Shared pieces ---------- */

  // The page we leave, laid over (or under) the new one. Moved there whole when the browser can move nodes
  // without resetting them (moveBefore): pictures stay decoded, videos and a live landing keep playing, nothing
  // is drawn again from scratch. Otherwise a still copy: videos keep their current frame, a landing shows its
  // first screen. (A moved page keeps its ids until the new one is mounted: its own teardown may look for them.)
  function ghost(ctx, { opaque = true, z = 4, hide = null } = {}) {
    const src = ctx.main;
    const g = document.createElement('div');
    g.className = 'tr-ghost';
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    g.style.zIndex = z;
    if (!opaque) g.style.background = 'transparent';
    const inner = document.createElement('div');
    inner.className = 'tr-ghost__in';
    inner.style.width = ctx.vw + 'px';
    inner.style.top = (-window.scrollY) + 'px';
    g.appendChild(inner);
    if (hide) hide.forEach((el) => el && el.setAttribute('data-tr-hide', ''));
    if (typeof inner.moveBefore === 'function') {
      ctx.layer(g);
      [...src.children].forEach((ch) => inner.moveBefore(ch, null));
      $$('video', inner).forEach((v) => v.pause());     // its current frame stays; no decoding while it leaves
      ctx.moved = inner;
    } else {
      [...src.children].forEach((ch) => inner.appendChild(ch.cloneNode(true)));
      if (hide) hide.forEach((el) => el && el.removeAttribute('data-tr-hide'));
      snapVideos(src, inner);
      snapFrames(ctx, src, inner);
      [...inner.querySelectorAll('[id]')].forEach((e) => e.removeAttribute('id'));
      ctx.layer(g);
    }
    return g;
  }
  // videos in a copy become pictures of their current frame, at the size they had (the layout never moves);
  // only the ones on screen are drawn
  function snapVideos(srcRoot, cloneRoot) {
    const a = $$('video', srcRoot), b = $$('video', cloneRoot);
    const dpr = Math.min(2, devicePixelRatio || 1);
    a.forEach((v, i) => {
      const r = v.getBoundingClientRect();
      const w = r.width || 2, h = r.height || 2;
      const seen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const cv = document.createElement('canvas');
      cv.width = seen ? Math.round(w * dpr) : 1;
      cv.height = seen ? Math.round(h * dpr) : 1;
      cv.className = v.className;
      cv.style.cssText = `display:block;width:${w}px;height:${h}px`;
      try {
        if (seen && v.readyState >= 2 && v.videoWidth) {
          const g = cv.getContext('2d');
          const s = Math.max(cv.width / v.videoWidth, cv.height / v.videoHeight);
          const dw = v.videoWidth * s, dh = v.videoHeight * s;
          g.drawImage(v, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
        }
      } catch (e) { /* a frame we may not read: the poster's colour stays */ }
      if (b[i]) b[i].replaceWith(cv);
    });
  }
  // a live landing in a copy: never a second live page (it would load again); its first screen when it is
  // still at its top, else the page's own ground
  const shotOf = (p, vw) => (vw <= 760 ? `media/${p.id}/m-01.webp`
    : p.id === 'topiary' ? 'media/coil/topiary-site-hero.webp' : `media/coil/${p.id}-hero.webp`);
  function snapFrames(ctx, srcRoot, cloneRoot) {
    const a = $$('iframe', srcRoot), b = $$('iframe', cloneRoot);
    const p = ctx.from && ctx.from.p;
    b.forEach((f, i) => {
      let top = true;
      try { top = !a[i].contentWindow || a[i].contentWindow.scrollY < 40; } catch (e) { top = false; }
      const still = document.createElement(p && top ? 'img' : 'div');
      still.className = f.className + ' tr-still';
      if (p && top) { still.alt = ''; still.decoding = 'sync'; still.src = shotOf(p, ctx.vw); }
      f.replaceWith(still);
    });
  }

  // the site's own .rise entrance (opacity and 14 px), driven by this clock
  function rise(ctx, t, start, { els = null, stagger = 70, dur = 900, dist = 14, ease = E.soft, byK = !els } = {}) {
    const list = els || ctx.riseEls || (ctx.riseEls = $$('.rise', ctx.main));
    list.forEach((el, i) => {
      if (!el) return;
      const k = byK ? (parseFloat(el.style.getPropertyValue('--k')) || 0) : i;
      const p = ease(seg(t, start + k * stagger, start + k * stagger + dur));
      ctx.set(el, 'opacity', p.toFixed(3));
      ctx.set(el, 'transform', `translateY(${(dist * (1 - p)).toFixed(2)}px)`);
    });
  }
  // the old page leaves: it moves on the first frame, but keeps its full tone until 70 ms and then goes quickly,
  // so dark pictures spend as little time as possible in mid-grey
  function fadeOut(ctx, el, t, a, b, dy = -10) {
    if (!el) return;
    ctx.set(el, 'opacity', (1 - E.inn(seg(t, a + 70, b))).toFixed(3));
    ctx.set(el, 'transform', `translateY(${(dy * E.exit(seg(t, a, b))).toFixed(2)}px)`);
  }

  /* The reel, drawn by a transition (the work page's own loop holds while it does). */
  function reelOn(ctx) {
    const app = ctx.app, R = app.getReel();
    if (!R) return null;
    const g = app.reelGeom();
    R.layout({ vw: g.vw, vh: g.vh, cx: g.cx, cy: g.cy, R: g.R, fade: g.fade, dpr: g.dpr });
    R.setTheme(app.readTheme());
    app.HOLD.reel = true;
    const cv = $('#reel');
    ctx.set(cv, 'opacity', '1');
    ctx.set(cv, 'visibility', 'visible');
    ctx.set(cv, 'transition', 'none');
    ctx.cleanups.push(() => {
      app.HOLD.reel = false;
      R.blur = 0; R.zoom = 1;
      R.morph = { frame: -1e6, k: 0, rect: [0, 0, 1, 1], others: 1, crop: [0, 0, 1, 1] };
      R.dirty = true;
    });
    return { R, cv, last: null };
  }
  const ctxShutter = () => (window.__APP ? window.__APP.SHUTTER : 1 / 70);

  // leaving the work page: the reel rolls on a little and fades while the next page comes in
  function reelLeave(ctx) {
    if (!ctx.from || ctx.from.name !== 'work') return;
    const rc = reelOn(ctx);
    if (!rc) return;
    rc.pos0 = ctx.app.W.eased * ctx.app.F + ctx.app.GATE;
    rc.R.morph = { frame: -1e6, k: 0, rect: [0, 0, 1, 1], others: 1, crop: [0, 0, 1, 1] };
    ctx.leave = rc;
  }
  function reelLeaveFrame(ctx, t, a = 0, b = 420) {
    const rc = ctx.leave;
    if (!rc || rc.gone) return;
    if (t > b + 30) { rc.gone = true; return; }      // it has faded out: nothing more to draw
    // the strip rolls on 0.6 of a project, its blur carrying the exit, and keeps its tone until 70 ms
    const posAt = (tt) => rc.pos0 + 0.6 * E.inn(seg(tt, a, b));
    reelMotion(rc, posAt, t);
    rc.R.zoom = 1;
    if (!ctx.exitEarly) ctx.set(rc.cv, 'opacity', (1 - E.inn(seg(t, a + 70, b))).toFixed(3));
    rc.R.render(posAt(t));
  }
  // the old page goes: a still copy that fades and lifts; the reel, if it was the work page
  function leave(ctx, { z = 4, hide = null } = {}) {
    const fromWork = ctx.from && ctx.from.name === 'work';
    ctx.g = ghost(ctx, { opaque: !fromWork, z, hide });
    reelLeave(ctx);
  }
  // one exit for every page: 160 ms, then the new page starts; never both at once (no double exposure)
  const OUT = 160;
  function leaveFrame(ctx, t, a = 0, b = OUT) {
    if (!ctx.exitEarly) fadeOut(ctx, ctx.g, t, a, b, -8);
    reelLeaveFrame(ctx, t, a, b);
  }
  // The same exit, given to the compositor from the click (fadeOut's own curves and times): the page we leave, and
  // the reel's canvas when we leave Work, go whole whatever the main thread is doing. The strip's roll stays drawn
  // by script, for as long as script frames come (pre, then frame).
  const CSS_INN = 'cubic-bezier(.5, 0, .75, 0)', CSS_EXIT = 'cubic-bezier(.33, 0, .67, 1)', CSS_OUT = 'cubic-bezier(.16, 1, .3, 1)';
  function exitNow(ctx, { dy = -8, a = 0, b = OUT } = {}) {
    ctx.exitEarly = true;
    const fade = { delay: a + 70, duration: b - a - 70, easing: CSS_INN };
    ctx.early(ctx.g, [{ opacity: 1 }, { opacity: 0 }], fade);
    ctx.early(ctx.g, [{ transform: 'translateY(0px)' }, { transform: `translateY(${dy}px)` }], { delay: a, duration: b - a, easing: CSS_EXIT });
    if (ctx.leave) ctx.early(ctx.leave.cv, [{ opacity: 1 }, { opacity: 0 }], fade);
  }
  // a spring sampled into keyframes, for a move the compositor plays (it has no springs of its own)
  const sprKeys = (T, a, fn, n = 28) => Array.from({ length: n + 1 }, (_, i) => fn(spr((T * i) / n, T, a)));

  /* The motion of the chosen transitions: one critically damped spring, the reel's own physics.
     a (attack) is the starting speed as a share of the fastest start that never overshoots:
     0 starts from rest, 1 is already moving (a pure exponential approach). Normalised to land exactly at T. */
  function spr(t, T, a = 0.5, K = 10) {
    if (t <= 0) return 0;
    if (t >= T) return 1;
    const w = K / T, f = (x) => 1 - (1 + w * (1 - a) * x) * Math.exp(-w * x);
    return f(t) / f(T);
  }
  // the speed of the strip, in frames per second, read from its position a millisecond ahead
  function reelMotion(rc, posAt, t, extraZoom = 1) {
    const v = Math.abs(posAt(t + 1) - posAt(t)) * 1000;
    rc.R.blur = Math.min(0.2, v * ctxShutter());
    rc.R.zoom = Math.min(1 - 0.035 * smooth(0.6, 9, v), extraZoom);
  }

  /* ======================================================================================
     WORK: the page goes, the reel comes in already turning, motion-blurred, and brakes on its own spring
     onto the last project seen; the camera closes in on the same spring, the texts turn with it
     ====================================================================================== */
  define('work', {
    dur: OUT - 40 + 720,
    hold: 0,
    lead: OUT - 40,
    begin(ctx) {
      ctx.g = ghost(ctx, { opaque: true, z: 4 });
      exitNow(ctx, { dy: -10 });
    },
    mounted(ctx) {
      const app = ctx.app;
      ctx.rc = reelOn(ctx);
      ctx.pos1 = app.W.rest * app.F + app.GATE;
      if (ctx.rc) ctx.rc.R.morph = { frame: -1e6, k: 0, rect: [0, 0, 1, 1], others: 1, crop: [0, 0, 1, 1] };
      ctx.stage = $('#stage');
      // already turning when it appears (attack 1); one project of travel, under a pixel from it at about 530 ms
      ctx.t0 = OUT - 40;
      ctx.x = (t) => spr(t - ctx.t0, 700, 1);
      ctx.posAt = (t) => ctx.pos1 - (1 - ctx.x(t));
    },
    frame(t, ctx) {
      const rc = ctx.rc;
      if (rc) {
        const pos = ctx.posAt(t);
        ctx.set(rc.cv, 'opacity', t < ctx.t0 ? '0' : '1');
        // the camera rides the same spring: pulled back while the strip runs, at rest when it lands
        reelMotion(rc, ctx.posAt, t, 1 - 0.05 * (1 - ctx.x(t)));
        rc.R.render(pos);
        // the page's texts ride with the strip (they follow its position, as when it is scrolled)
        ctx.app.HOLD.e = (pos - ctx.app.GATE) / ctx.app.F;
      }
      ctx.set(ctx.stage, 'opacity', E.soft(seg(t, ctx.t0, ctx.t0 + 340)).toFixed(3));
    },
    end(ctx) { ctx.app.HOLD.e = null; },
  });

  /* ======================================================================================
     PLAYGROUND: the wall rises from under the screen, the left column first, then each column a little later
     and a little slower; each brakes on its spring, each picture settles in its frame just after it
     ====================================================================================== */
  // the grid's columns, read from where each figure sits (the grid is a CSS multi-column)
  function columns(ctx) {
    const figs = $$('#playGrid figure', ctx.main).filter((f) => !f.classList.contains('is-hidden'));
    const rs = figs.map((f) => rectOf(f));
    const lefts = [...new Set(rs.map((r) => Math.round(r.x)))].sort((a, b) => a - b);
    return figs.map((f, i) => {
      const media = $('img, video', f);
      // the pieces a transition brings into view must not wait for lazy loading
      if (media && media.loading === 'lazy' && rs[i].y < ctx.vh * 2.5) media.loading = 'eager';
      return { f, r: rs[i], c: lefts.indexOf(Math.round(rs[i].x)), media };
    });
  }

  define('playground', {
    dur: OUT - 40 + 2 * 60 + 700,
    // leaving Work, the strip rolls on by script for the 70 ms it keeps its tone; then the page is mounted while it fades
    hold: (ctx) => (ctx.leave ? 70 : 0),
    lead: OUT - 40,
    begin(ctx) { leave(ctx); exitNow(ctx); },
    pre(t, ctx) { reelLeaveFrame(ctx, t, 0, OUT); },
    mounted(ctx) {
      // only the pieces of the first screen move: those under it never show while the wall rises, and moving all
      // fifty-odd of them cost three times the work per frame
      ctx.cols = columns(ctx).filter((x) => x.r.y < ctx.vh);
      ctx.cols.forEach((x) => {
        if (!x.media) return;
        ctx.set(x.media, 'transition', 'none');
        if (x.r.y < ctx.vh * 1.2 && x.media.decode) x.media.decode().catch(() => {});
      });
      ctx.colTop = {};
      ctx.cols.forEach((x) => { ctx.colTop[x.c] = Math.min(ctx.colTop[x.c] ?? 1e9, x.r.y); });
      const aside = $('.play-aside__in', ctx.main);
      if (aside) ctx.aside = { el: aside, r: rectOf(aside) };
    },
    frame(t, ctx) {
      leaveFrame(ctx, t);
      // each block starts just under the screen and rises in one move (no fade: a fade greys the dark pieces)
      const travel = (top) => ctx.vh - top + 32;
      const left = (s, d) => 1 - spr(t - s, d, 0.85);
      const s0 = OUT - 40;
      if (ctx.aside) ctx.set(ctx.aside.el, 'transform', `translateY(${(travel(ctx.aside.r.y) * left(s0, 620)).toFixed(2)}px)`);
      (ctx.cols || []).forEach((x) => {
        const c = x.c, s = s0 + c * 60, d = 620 + c * 40;
        const k = left(s, d);
        ctx.set(x.f, 'transform', `translateY(${(travel(ctx.colTop[c]) * k).toFixed(2)}px)`);
        // the picture rides its own spring, 60 ms behind its frame, and lands with it
        if (x.media) {
          const ki = left(s + 60, d - 60);
          ctx.set(x.media, 'transform', `translateY(${(-5 * ki).toFixed(3)}%) scale(${(1 + 0.1 * ki).toFixed(4)})`);
        }
      });
    },
  });

  /* ======================================================================================
     ABOUT: the page comes up like a sheet, rounded and casting its shadow while it moves, over the one
     before, which steps back; it lands flat, its texts a beat behind it
     ====================================================================================== */
  define('about', {
    dur: 760,
    begin(ctx) {
      const fromWork = ctx.from && ctx.from.name === 'work';
      ctx.back = ctx.layer(Object.assign(document.createElement('div'), { className: 'tr-backdrop tr-backdrop--full tr-backdrop--sheet' }));
      ctx.g = ghost(ctx, { opaque: !fromWork, z: 2 });
      // the shade that falls on the page we leave: on the page itself, or, over Work (whose page is only its texts,
      // the ground showing through), on the whole screen, so no lighter band shows round the page as it steps back
      ctx.veil = Object.assign(document.createElement('div'), { className: 'tr-veil' });
      if (fromWork) { ctx.veil.style.cssText = 'position:fixed;z-index:2'; ctx.layer(ctx.veil); } else ctx.g.appendChild(ctx.veil);
      if (fromWork) {
        const rc = reelOn(ctx);
        if (rc) { ctx.leave = rc; rc.pos0 = ctx.app.W.eased * ctx.app.F + ctx.app.GATE; rc.R.render(rc.pos0); ctx.set(rc.cv, 'z-index', '1'); }
      }
      ctx.edge = ctx.layer(Object.assign(document.createElement('div'), { className: 'tr-sheet-edge' }));
      ctx.set(ctx.main, 'background', 'var(--bg)');
      ctx.set(ctx.main, 'min-height', '100vh');
      ctx.set(ctx.main, 'transform', `translateY(${ctx.vh}px)`);   // the sheet waits under the screen until its page is mounted
      // the page we leave steps back from the click, on the compositor (the sheet's own spring, sampled): it answers
      // at once, and the sheet comes over it as soon as its page is there
      const back = (x) => `translateY(${(-0.025 * ctx.vh * x).toFixed(2)}px) scale(${(1 - 0.045 * x).toFixed(4)})`;
      const keys = sprKeys(700, 0.3, (x) => ({ transform: back(x) }));
      ctx.early(ctx.g, keys, { duration: 700 });
      if (ctx.leave) ctx.early(ctx.leave.cv, keys, { duration: 700 });
      ctx.early(ctx.veil, sprKeys(700, 0.3, (x) => ({ opacity: 0.1 * x })), { duration: 700 });
      // the ground behind comes into its shade on the same move (at once, it was a jump of tone over Work), and the
      // sheet's shadow shows only once the sheet does
      ctx.early(ctx.back, sprKeys(700, 0.3, (x) => ({ opacity: x })), { duration: 700 });
      ctx.edge.style.opacity = '0';
    },
    hold: 0,
    mounted(ctx) { ctx.sec = $('.about', ctx.main); },
    frame(t, ctx) {
      // a sheet presented on a spring with a little push: it answers at once, without a jolt, and lands crisply
      const x = spr(t, 700, 0.3);
      const y = ctx.vh * (1 - x);
      ctx.g.style.borderRadius = `${(16 * x).toFixed(2)}px`;
      // the reel under the sheet is a still picture: drawn again only when one of its covers has just arrived
      if (ctx.leave && ctx.leave.R.dirty) ctx.leave.R.render(ctx.leave.pos0);
      ctx.set(ctx.main, 'transform', `translateY(${y.toFixed(2)}px)`);
      const r = (22 * (1 - smooth(0.55, 1, x))).toFixed(2);
      ctx.set(ctx.main, 'clip-path', `inset(0 round ${r}px ${r}px 0 0)`);
      // its shadow travels with its top edge and fades as it lands
      ctx.edge.style.transform = `translateY(${(y - 72).toFixed(2)}px)`;
      ctx.edge.style.opacity = (smooth(0, 0.06, x) * (1 - smooth(0.6, 1, x))).toFixed(3);
      // the page's content follows the sheet a beat behind: it has weight
      if (ctx.sec) ctx.set(ctx.sec, 'transform', `translateY(${(30 * (1 - spr(t, 740, 0.2))).toFixed(2)}px)`);
    },
  });

  /* ======================================================================================
     CONTACT, « Les volets » (2026-11-05): the room goes into the shade of the moment's light (cool by day, warm in
     the evening, read from the Contact page), the page we leave melts into the sheet under that shade, then the
     shutters fold back: the window's two panes of light widen from the mullion across the address. The light is the
     page's own (contact.js draws it, from Metz's real day or evening); the shade lifts as it comes in, the texts rise
     with it, and the platen strikes once the light is in.
     ====================================================================================== */
  // the shade, multiplied over the page: [white cotton, black cotton], each [window side (top), far side]
  const SHADE = { day: [['#B9C0CC', '#8B93A3'], ['#4A5262', '#2E3442']], evening: [['#C9AE9F', '#9C7966'], ['#56402F', '#3A281E']] };
  define('contact', {
    dur: 1350,
    begin(ctx) {
      leave(ctx, { z: 4 });
      ctx.shade = ctx.layer(Object.assign(document.createElement('div'), { className: 'tr-shade' }));
    },
    mounted(ctx) {
      const CP = window.ContactPage;
      const mode = CP && CP.mood ? CP.mood() : 'day';
      const dark = ctx.html.dataset.theme === 'dark';
      const c = SHADE[mode === 'evening' ? 'evening' : 'day'][dark ? 1 : 0];
      ctx.shade.style.background = `linear-gradient(to bottom, ${c[0]}, ${c[1]})`;
      ctx.openK = CP && CP.openK ? CP.openK : null;
      ctx.rest = $$('.pe-ink, .pe-cap, .pe-lead, .pe-write, .pe-facts, .pe-links', ctx.main);
      // the page we leave melts on the compositor, on the curves it had (the shade's tone is the new page's own, known
      // only now: the melt starts with the shade, and loses no frame to the page's first, heavy ones)
      ctx.exitEarly = true;
      const lag = 14;   // the clock starts two frames from now
      ctx.early(ctx.g, [{ opacity: 1 }, { opacity: 0 }], { delay: lag + 80, duration: 240, easing: CSS_INN });
      ctx.early(ctx.g, [{ transform: 'scale(1)' }, { transform: 'scale(.99)' }], { delay: lag, duration: 320, easing: CSS_OUT });
      if (ctx.leave) ctx.early(ctx.leave.cv, [{ opacity: 1 }, { opacity: 0 }], { delay: lag + 150, duration: 170, easing: CSS_INN });
    },
    frame(t, ctx) {
      // the room dims at once, without a jolt; the page we leave stays a beat, then melts into the sheet in the shade
      const dim = E.out(seg(t, 0, 320));
      if (ctx.leave) reelLeaveFrame(ctx, t, 80, 320);
      // the shade lifts as the shutters open (the page's own light); by the end it is gone whatever the light did
      const k = ctx.openK ? ctx.openK() : seg(t, 300, 1200);
      const lift = Math.max(E.soft(seg(k, 0.08, 1)), smooth(ctx.D - 240, ctx.D, t));
      if (ctx.shade) ctx.shade.style.opacity = (0.55 * dim * (1 - lift)).toFixed(3);
      // the texts come up with the light
      rise(ctx, t, 380, { els: ctx.rest, stagger: 50, dur: 760, dist: 12 });
    },
  });

  /* ======================================================================================
     PIXEL CURTAIN: opening a project from Work, and going from one project to the next
     A grid of squares in the project's own colours grows over the screen, the project's name rises in,
     the project page mounts behind, then the squares shrink away onto it and take the name with them.
     After the reference portfolio's own transition, rebuilt for smoothness:
     - every square grows and shrinks continuously, worked out every frame at the screen's own rate (no
       stepped scale): sub-pixel, anti-aliased edges while it moves, snapped to whole device pixels once
       full, so neighbours meet without a seam;
     - a finer grid than the reference (22 squares across the longer side, not 14);
     - their order follows the gesture (the point clicked, or the side of the arrow) with a little noise,
       neighbours slightly apart in time (never a lattice), the last ones out without stragglers;
     - no square the colour of a page (it would cut the text it lands on); the tones under the name all read
       with it (5.4:1 or more);
     - the name rises letter by letter into windows cut to its ink (no flicker of passing letters), shows
       only on the squares that are there, and lifts out through the top of its windows just before its
       plate dissolves (never faded, never chopped into specks).
     ====================================================================================== */
  // each brand's colours, weighted; `1` marks the tones the name may sit on
  const PALETTES = {
    topiary: { text: '#F4F2EF', c: [['#1F201E', .40, 1], ['#45443F', .25, 1], ['#FF7360', .20, 0], ['#FF9A8B', .05, 0], ['#E0D6C4', .10, 0]] },
    auvent: { text: '#FFFFFF', c: [['#0D274D', .40, 1], ['#1F39B6', .18, 1], ['#3A6AAF', .16, 1], ['#7FA6FF', .16, 0], ['#B7CBFB', .10, 0]] },
    quart: { text: '#1A1B19', c: [['#DDD4F8', .30, 1], ['#9A80F0', .28, 1], ['#C3B6F6', .20, 1], ['#D5D2C8', .14, 1], ['#B4B1A7', .08, 1]] },
    tiroir: { text: '#F6F4EF', c: [['#154690', .42, 1], ['#0D2C57', .22, 1], ['#2B5BA8', .14, 1], ['#C8CDD4', .14, 0], ['#8EA2C2', .08, 0]] },
    banc: { text: '#F8F8F6', c: [['#12161C', .30, 1], ['#2C3F52', .26, 1], ['#4A5663', .16, 1], ['#8F9CA7', .16, 0], ['#C9CFD5', .12, 0]] },
    // the house, its dark wood and the ink's second tone; the slip's yellow deepened (the paper's own tones would cut
    // the landing's text) and the bevel's shadow. Name 16.4, 11.9 and 7.3:1 on the plate tones; darks 1.38 and 1.62:1 apart
    understudy: { text: '#F1ECE1', c: [['#100E0B', .40, 1], ['#312B24', .24, 1], ['#514B41', .16, 1], ['#D8B64E', .10, 0], ['#8F8775', .10, 0]] },
    // the underpass at night, the agents' cobalt, the mist and the red line; both night blues lifted to 1.32:1 and more
    // from the landing's night photo (the brand's own night would cut its header text). Name 12.8, 8.4 and 5.5:1 on the
    // plate tones; darks 1.52:1 apart and more
    redline: { text: '#F2F1EC', c: [['#172A44', .44, 1], ['#26476E', .24, 1], ['#2346FF', .13, 1], ['#B9C8D6', .15, 0], ['#E5372B', .04, 0]] },
    // the night lifted to 1.31:1 from the landing's ground (#080809, or the squares would cut its title), the rule tone,
    // the mist, and the prism of the glass edge kept rare, as on the page: blue and amber (at a quarter, then a seventh
    // of the squares, with green, it read as confetti). Name 13.6 and 9.9:1 on the plate tones; darks 1.37:1 apart
    iris: { text: '#F2F2EE', c: [['#25252B', .50, 1], ['#3B3B43', .30, 1], ['#B6B6BA', .12, 0], ['#7B96FF', .045, 0], ['#EEAA4E', .035, 0]] },
    // the crimson deepened to 1.48:1 from the landing's own (#ce0f3d, or the squares would cut its title), the brand's
    // violet-800 (1.32:1 from the dark page), the pink of the half-tones and the violet of the tags, kept rare (at 8 %
    // it read as confetti). Name 8.0 and 13.7:1 on the plate tones; darks 1.82:1 apart
    glossa: { text: '#FFFAFB', c: [['#9E0B2E', .54, 1], ['#3A1A5C', .28, 1], ['#E8829A', .14, 0], ['#5B2BB0', .04, 0]] },
    // the satin's deep green lifted to 1.30:1 from the landing's ground (#0d100f, or the squares would cut its title),
    // two lighter greens of the silk, the sage thread, and the apricot kept rare, as on the page (the eyelet, the
    // approvals). Name 12.8, 9.9 and 7.5:1 on the plate tones; darks 1.48:1 apart
    weft: { text: '#EEF0EA', c: [['#1E2B23', .40, 1], ['#2C3E33', .26, 1], ['#3A5142', .14, 1], ['#A9C6A6', .14, 0], ['#ECBF9A', .06, 0]] },
  };
  const PX = {
    across: 22,      // squares across the longer side of the screen (the reference has 14)
    grow: 420,       // one square's spring; it looks full at 40 % of it (see `full`)
    full: 0.9,       // a square is drawn full from this share of its spring (the last step is under a pixel):
                     // no hairline seams while it settles
    shrink: 210,     // one square shrinking away, slightly accelerating: it leaves at once, without lingering specks
    spread: 400,     // the last square starts this long after the first
    spreadOut: 300,  // the same on the way out
    bias: 0.75,      // how much the order follows the gesture (the rest is noise)
    biasOut: 0.85,   // the way out follows it more closely: one clean wave, no stragglers
    plate: 0.3,      // the squares under the name come in within this share of the spread
    jitter: 24,      // neighbours this far apart in time: never a regular lattice
    rise: 440,       // one letter rising into its window, on a spring (landed at about half of it)
    stagger: 26,     // from one letter to the next
    read: 160,       // the whole name, landed and still
    lift: 240,       // one letter leaving its window upwards: it answers at once, then accelerates away
    liftStagger: 12,
    // the live landing boots under the curtain and blocks the page now and then: the squares leave once it has
    // loaded and no frame has stalled (over `stall` ms) for `calm` ms, or `settle` ms after it loaded at most
    stall: 25,
    calm: 120,
    settle: 800,
    // a landing waiting for its cue gets it this long after the squares start to go: its entrance (Redline's light
    // box striking) begins as the page shows through
    cue: 180,
  };
  const shrinkAway = (x) => Math.pow(x, 1.25);
  const liftAway = bezier(0.3, 0, 0.8, 0.5);
  const pick = (list, r) => {
    const tot = list.reduce((s, q) => s + q[1], 0);
    let x = r * tot;
    for (const q of list) if ((x -= q[1]) <= 0) return q[0];
    return list[0][0];
  };

  // the name, one window per letter cut to the name's ink (cap or ascender top to descender bottom, plus 6 px);
  // each letter rises from just under its window on a spring, a little after the one before: continuous,
  // no passing letters to flicker
  function pxRise(el, name, px) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = `600 ${px}px Onest, "Segoe UI", system-ui, sans-serif`;
    const fm = m.measureText('Hg');
    const fA = (fm.fontBoundingBoxAscent || px * 0.95) / px, fD = (fm.fontBoundingBoxDescent || px * 0.25) / px;
    const ink = m.measureText(name);
    const aI = ink.actualBoundingBoxAscent / px, dI = Math.max(0, ink.actualBoundingBoxDescent / px);
    const CELL = 1.35, base = (CELL - (fA + fD)) / 2 + fA, pad = 6 / px;
    const top = Math.max(0, base - aI - pad), bottom = Math.max(0, CELL - (base + dI + pad));
    const drop = aI + dI + 2 * pad;          // from here the letter is wholly under its window
    const esc = window.__APP.esc;
    let html = '';
    [...name].forEach((ch) => {
      if (ch === ' ') { html += '<span class="pxs"> </span>'; return; }
      html += `<span class="pxw" style="clip-path: inset(${top.toFixed(4)}em -0.04em ${bottom.toFixed(4)}em -0.04em)">`
        + `<span class="pxc"><span>${esc(ch)}</span></span></span>`;
    });
    el.innerHTML = `<span class="sr">${esc(name)}</span><span class="pxr" aria-hidden="true">${html}</span>`;
    const cols = $$('.pxc', el).map((c, i) => ({ c, i }));
    cols.forEach((x) => { x.c.style.transform = `translateY(${drop.toFixed(4)}em)`; });
    return {
      base, CELL,
      landed: (cols.length - 1) * PX.stagger + 0.5 * PX.rise,
      still: (cols.length - 1) * PX.stagger + 0.75 * PX.rise,     // the last letter within half a pixel of home
      liftEnd: (cols.length - 1) * PX.liftStagger + PX.lift,
      // in from below its window, then (u, time since the name started leaving) out through its top
      render(t, u) {
        cols.forEach((x) => {
          const p = spr(t - x.i * PX.stagger, PX.rise, 0.45);
          const q = u === null ? 0 : liftAway(seg(u - x.i * PX.liftStagger, 0, PX.lift));
          x.c.style.transform = `translateY(${(drop * (1 - p - q)).toFixed(4)}em)`;
        });
      },
    };
  }

  function pixelCurtain(def) {
    return Object.assign({
      dur: 9000,
      begin(ctx) {
        const app = ctx.app, p = ctx.to.p;
        const pal = PALETTES[p.id] || PALETTES.topiary;
        const W = ctx.vw, H = ctx.vh, dpr = Math.min(devicePixelRatio || 1, 2);
        // the grid, centred so any overflow is shared by both edges
        const cell = Math.ceil(Math.max(W, H) / PX.across);
        const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
        const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
        // the label: its kind in a mask, its name in windows; set with its baseline on a line of the grid
        const lab = ctx.layer(Object.assign(document.createElement('div'), { className: 'tr-px-label' }));
        lab.style.color = pal.text;
        lab.innerHTML = `<div class="tr-px-box"><p class="tr-px-kind"><span>${app.esc(p.kind)}</span></p><p class="tr-px-name"></p></div>`;
        const nameEl = $('.tr-px-name', lab);
        const px = parseFloat(getComputedStyle(nameEl).fontSize);
        ctx.letters = pxRise(nameEl, p.name, px);
        ctx.lab = lab;
        ctx.kindIn = $('.tr-px-kind span', lab);
        const nr = rectOf(nameEl);
        const baseY = nr.y - 0.215 * px + ctx.letters.base * px;
        const shift = oy + Math.round((baseY - oy) / cell) * cell - baseY;
        lab.style.transform = `translateY(${shift.toFixed(2)}px)`;
        ctx.shift = shift;
        const b0 = rectOf($('.tr-px-box', lab));
        const box = { x: b0.x, y: b0.y, w: b0.w, h: b0.h };
        // the canvas, at the device's pixels
        const cv = ctx.layer(Object.assign(document.createElement('canvas'), { className: 'tr-px' }));
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.g = cv.getContext('2d', { alpha: true });
        ctx.dpr = dpr;
        // where the gesture came from: the point clicked, or the side of the arrow (dir)
        const o = ctx.oRect ? { x: ctx.oRect.cx, y: ctx.oRect.cy } : { x: W / 2, y: H / 2 };
        const far = Math.max(Math.hypot(o.x, o.y), Math.hypot(W - o.x, o.y), Math.hypot(o.x, H - o.y), Math.hypot(W - o.x, H - o.y));
        // stratified noise (every slice of time gets its share of squares), a quarter of the wave
        const N = cols * rows;
        const perm = Array.from({ length: N }, (_, i) => i);
        for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
        const plateOf = pal.c.filter((q) => q[2]);
        const pad = cell * 0.3;
        ctx.sq = [];
        for (let r = 0, i = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++, i++) {
            const x = ox + c * cell, y = oy + r * cell, cx = x + cell / 2, cy = y + cell / 2;
            const s = ctx.dir ? (ctx.dir > 0 ? 1 - cx / W : cx / W) : Math.hypot(cx - o.x, cy - o.y) / far;
            const n = (perm[i] + Math.random()) / N;
            const k = clamp(PX.bias * s + (1 - PX.bias) * n, 0, 1);
            const kOut = clamp(PX.biasOut * s + (1 - PX.biasOut) * n, 0, 1);
            const jit = ((c + r) % 2 ? 1 : -1) * PX.jitter / 2;
            const under = x + cell > box.x - pad && x < box.x + box.w + pad && y + cell > box.y - pad && y < box.y + box.h + pad;
            ctx.sq.push({
              x, y, cx, cy, under,
              d: Math.max(0, k * PX.spread * (under ? PX.plate : 1) + jit),
              dOut: Math.max(0, kOut * PX.spreadOut + jit),
              color: pick(under ? plateOf : pal.c, Math.random()),
              // the full square's edges, in whole device pixels: neighbours share them exactly
              X0: Math.round(x * dpr), X1: Math.round((x + cell) * dpr), Y0: Math.round(y * dpr), Y1: Math.round((y + cell) * dpr),
            });
          }
        }
        // no stragglers on the way out: the last tenth leave within 40 ms of the rest
        const outs = ctx.sq.map((q) => q.dOut).sort((a, b) => a - b);
        const cap = outs[Math.floor(outs.length * 0.9)] + 40;
        ctx.sq.forEach((q) => { q.dOut = Math.min(q.dOut, cap); });
        const plateSq = ctx.sq.filter((q) => q.under);
        ctx.cell = cell;
        const full = Math.max(...ctx.sq.map((q) => q.d)) + 0.5 * PX.grow;          // every square looks full
        ctx.nameAt = Math.max(...plateSq.map((q) => q.d)) + 0.4 * PX.grow;         // the squares under the name are almost full
        // the page mounts, and its landing starts loading, once nothing moves: its heavy first frames fall on a
        // still picture (the name and its kind line landed)
        ctx.swap = Math.max(full, ctx.nameAt + ctx.letters.still, ctx.nameAt + 60 + 0.75 * 460);
        ctx.planOut = Math.max(ctx.nameAt + ctx.letters.landed + PX.read, ctx.swap + 60);
        // the squares start leaving so that those under the name go once it is nearly out of its windows:
        // it is never chopped by them (when the wave starts elsewhere, they start sooner)
        const plateOut = Math.min(...plateSq.map((q) => q.dOut));
        ctx.lead = Math.max(0, ctx.letters.liftEnd - 80 - plateOut);
        ctx.outAt = null;
        ctx.ready = false;
        ctx.readyAt = null;
        ctx.calmFrom = 0;
        ctx.lastT = 0;
      },
      mounted(ctx) {
        // the page under the curtain: its live frame shown at once (no fade of its own), loading now; the
        // curtain waits for it (2.5 s at most once the name has been read)
        const frame = $('.pv-frame', ctx.main);
        if (frame) { ctx.set(frame, 'transition', 'none'); ctx.set(frame, 'opacity', '1'); }
        // a landing that asks for its cue ('landing:hello', Redline's light box) keeps its entrance until the squares
        // go: it is told to hold, then to start; it is always released, even if the change is cut short
        const post = (type) => { try { if (ctx.cueWin) ctx.cueWin.postMessage({ type }, '*'); } catch (e) { /* gone */ } };
        const onHello = (e) => {
          if (ctx.cueSent || !frame || e.source !== frame.contentWindow || !e.data || e.data.type !== 'landing:hello') return;
          ctx.cueWin = e.source;
          post('portfolio:hold');
        };
        addEventListener('message', onHello);
        ctx.cue = () => { if (ctx.cueSent) return; ctx.cueSent = true; removeEventListener('message', onHello); post('portfolio:reveal'); };
        ctx.cleanups.push(ctx.cue);
        const v = ctx.app.viewer();
        const ok = () => { ctx.ready = true; };
        // loaded, then its first idle moment: the landing's own start-up (scripts run on load) is behind it
        const loaded = () => {
          let w = null;
          try { w = frame && frame.contentWindow; } catch (e) { w = null; }
          if (w && typeof w.requestIdleCallback === 'function') w.requestIdleCallback(ok, { timeout: 600 });
          else ok();
        };
        if (v) v.start().then(loaded, ok); else ok();
      },
      frame(t, ctx) {
        if (t - ctx.lastT > PX.stall) ctx.calmFrom = t;
        ctx.lastT = t;
        if (ctx.ready && ctx.readyAt === null) ctx.readyAt = t;
        const settled = ctx.ready && (t - Math.max(ctx.calmFrom, ctx.readyAt) >= PX.calm || t - ctx.readyAt >= PX.settle);
        if (ctx.outAt === null && t >= ctx.planOut && (settled || t >= ctx.planOut + 2500)) {
          ctx.outAt = t;
          ctx.D = t + ctx.lead + Math.max(...ctx.sq.map((q) => q.dOut)) + PX.shrink + 16;
        }
        if (ctx.cue && ctx.outAt !== null && t >= ctx.outAt + ctx.lead + PX.cue) ctx.cue();
        const g = ctx.g, dpr = ctx.dpr, half = ctx.cell / 2, sh = ctx.shift;
        g.clearRect(0, 0, g.canvas.width, g.canvas.height);
        let clip = '';
        for (const q of ctx.sq) {
          let s = Math.min(1, spr(t - q.d, PX.grow, 0.55) / PX.full);
          if (ctx.outAt !== null) {
            const b = t - ctx.outAt - ctx.lead - q.dOut;
            if (b > 0) s = Math.min(s, (1 - shrinkAway(seg(b, 0, PX.shrink))) / PX.full);
          }
          if (s <= 0.002) continue;
          g.fillStyle = q.color;
          if (s >= 1) {
            g.fillRect(q.X0, q.Y0, q.X1 - q.X0, q.Y1 - q.Y0);
            if (q.under) clip += `M${q.x.toFixed(1)} ${(q.y - sh).toFixed(1)}h${ctx.cell}v${ctx.cell}h${-ctx.cell}Z`;
          } else {
            // while it moves: sub-pixel and anti-aliased, so its growth is smooth at any speed
            const h = half * s;
            g.fillRect((q.cx - h) * dpr, (q.cy - h) * dpr, 2 * h * dpr, 2 * h * dpr);
            if (q.under) clip += `M${(q.cx - h).toFixed(2)} ${(q.cy - h - sh).toFixed(2)}h${(2 * h).toFixed(2)}v${(2 * h).toFixed(2)}h${(-2 * h).toFixed(2)}Z`;
          }
        }
        // the label shows only on the squares that are there: in with them, out with them, never faded
        ctx.lab.style.clipPath = clip ? `path('${clip}')` : 'inset(50%)';
        const u = ctx.outAt === null ? null : t - ctx.outAt;
        ctx.letters.render(t - ctx.nameAt, u);
        const ki = spr(t - ctx.nameAt - 60, 460, 0.45) - (u === null ? 0 : liftAway(seg(u, 0, PX.lift)));
        ctx.kindIn.style.transform = `translateY(${(110 * (1 - ki)).toFixed(2)}%)`;
      },
    }, def);
  }

  // opening a project from Work: from the point pressed
  define('project', pixelCurtain({}));
  // from one project to the next: from the side of the arrow pressed
  define('next', pixelCurtain({}));

})();
