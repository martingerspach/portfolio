// Topiary v4 : les signatures du hero. Un canevas sous le texte dessine la signature choisie à partir de la géométrie
// du hero (point du « i », ligne de base, lignes du chapeau). Chaque signature se déclare avec SIG.register({ id, name,
// idea, duration, setup(G, kit), draw(ctx, G, t, state, C, kit, view), under (fond sans réserve), clear }) ; draw est une fonction pure du temps t (ms),
// t = Infinity donnant l'état de repos. Le texte est protégé par des réserves douces (chapeau, en-tête, halo du mot).
// Options : live(ctx, G, clock, state, C, kit, view) dessine un second calque animé en continu (bouton de pause, rien en
// mouvements réduits : view.still demande alors un état figé) ; depth: true redessine au défilement (view.scroll, en px) ;
// teardown(state) range ce que la signature a posé hors de ses canevas quand on en change.
// Depuis le 2026-10-20, la landing n'en a plus qu'une, « Lettres de buis » (signatures.js) : elle s'affiche toujours, sans
// tenir compte d'un réglage mémorisé ni d'un lien #sig-… ; les autres sont dans archive/2026-10-20-signatures/.
(function (g) {
  const SIG = (g.TOPIARY_SIG = g.TOPIARY_SIG || { list: [] });
  SIG.register = (def) => { SIG.list.push(def); };

  /* ---------- Outils communs ---------- */
  const kit = {
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // Avancement d'une phase : 0 avant start, 1 après start + dur ; t = Infinity donne 1.
    prog: (t, start, dur) => (t === Infinity ? 1 : kit.clamp((t - start) / Math.max(1, dur))),
    easeOut: (p) => 1 - (1 - p) ** 3,
    easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
    smooth: (p) => p * p * (3 - 2 * p),
    smoother: (p) => p * p * p * (p * (p * 6 - 15) + 10),
    rng(seed) {
      let a = seed >>> 0;
      return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    },
    // Bruit de valeur lissé, 2D, reproductible
    noise(seed = 1) {
      const r = kit.rng(seed), P = new Float32Array(512);
      for (let i = 0; i < 512; i++) P[i] = r();
      const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
      const s = (t) => t * t * (3 - 2 * t);
      return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = s(xf), v = s(yf);
        const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
        return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v; // 0..1
      };
    },
    // Lignes de niveau d'un champ scalaire échantillonné (carrés marchants). F(x, y) -> nombre ; renvoie des segments.
    contours(F, W, H, step, levels, mask) {
      const nx = Math.ceil(W / step) + 1, ny = Math.ceil(H / step) + 1;
      const v = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = F(i * step, j * step);
      const segs = [];
      const lv = levels.slice().sort((a, b) => a - b);
      const interp = (x1, y1, a, x2, y2, b, L) => { const t = (L - a) / (b - a || 1e-9); return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]; };
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const x = i * step, y = j * step;
        if (mask && !mask(x + step / 2, y + step / 2)) continue;
        const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        let k0 = 0, k1 = lv.length;
        while (k0 < k1) { const m = (k0 + k1) >> 1; if (lv[m] < lo) k0 = m + 1; else k1 = m; }
        for (let k = k0; k < lv.length && lv[k] <= hi; k++) {
          const L = lv[k], pts = [];
          if ((a < L) !== (b < L)) pts.push(interp(x, y, a, x + step, y, b, L));
          if ((b < L) !== (c < L)) pts.push(interp(x + step, y, b, x + step, y + step, c, L));
          if ((c < L) !== (d < L)) pts.push(interp(x + step, y + step, c, x, y + step, d, L));
          if ((d < L) !== (a < L)) pts.push(interp(x, y + step, d, x, y, a, L));
          if (pts.length >= 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1], k]);
          if (pts.length === 4) segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1], k]);
        }
      }
      return segs;
    },
    // Distance signée à un rectangle arrondi (centre cx, cy, demi-tailles hw, hh, rayon r)
    sdRound(x, y, cx, cy, hw, hh, r) {
      const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    },
    line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); },
    poly(ctx, pts, close) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); ctx.stroke(); },
    // Unité : 1 à 1 440 px de large, plancher pour le téléphone
    unit: (G) => Math.max(0.42, G.W / 1400),
  };
  SIG.kit = kit;

  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  let card, canvas, ctx, G = null, def = null, state = null, raf = 0, t0 = 0, dpr = 1, C = {};
  // Calque vivant (live), masque des réserves calculé une fois par mise en place, état du défilement et de la pause.
  let live, lctx, mask, pauseBtn = null, lraf = 0, last = 0, clock = 0, paused = false, onScreen = true;
  const view = { scroll: 0, still: false };

  function colors() {
    const cs = getComputedStyle(root);
    const v = (n) => cs.getPropertyValue(n).trim();
    C = { field: v('--field'), line: v('--line'), ink: v('--ink'), ink2: v('--ink-2'), paper: v('--paper'), accent: v('--accent'), ground: v('--ground') };
  }

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(G.W * dpr);
    canvas.height = Math.round(G.H * dpr);
    canvas.style.width = `${G.W}px`;
    canvas.style.height = `${G.H}px`;
    for (const c of [live, mask]) { c.width = canvas.width; c.height = canvas.height; }
    live.style.width = `${G.W}px`;
    live.style.height = `${G.H}px`;
  }

  // Réserves : le texte reste net. Rectangles adoucis par une ombre (en px d'appareil), halo autour des lettres du mot.
  // Elles sont peintes une fois dans un masque, puis retirées de chaque calque (destination-out) à chaque image.
  function buildMask() {
    const ctx = mask.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, mask.width, mask.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const opt = Object.assign({ lede: true, head: true, mark: 'halo', dot: 0 }, def.clear || {});
    const u = kit.unit(G);
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.shadowColor = '#000';
    const soft = (rects, mx, my, blur) => {
      ctx.shadowBlur = blur * dpr;
      rects.forEach((r) => {
        ctx.beginPath();
        ctx.roundRect(r.x - mx, r.y - my, r.w + 2 * mx, r.h + 2 * my, Math.min(12, r.h / 2));
        ctx.fill();
      });
    };
    if (opt.lede) soft(G.lede, 10 * u + 4, 2, 14);
    if (opt.head) soft(G.head, 10, 8, 12);
    if (opt.mark) {
      const m = G.mark;
      if (opt.mark === 'box') soft([{ x: m.x, y: m.y, w: m.w, h: m.h }], 14 * u, 10 * u, 14);
      else {
        ctx.shadowBlur = 6 * dpr;
        ctx.font = `${m.weight} ${100 * m.k}px ${m.family}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${m.track * m.k}px`;
        ctx.lineWidth = (opt.mark === 'tight' ? 8 : 14) * u + 4;
        ctx.lineJoin = 'round';
        const x0 = m.x - m.minX * m.k;
        ctx.strokeText(m.word, x0, m.base);
        ctx.fillText(m.word, x0, m.base);
      }
    }
    if (opt.dot) {
      ctx.shadowBlur = 8 * dpr;
      ctx.beginPath();
      ctx.arc(G.dot.x, G.dot.y, G.dot.r + opt.dot * u, 0, Math.PI * 2);
      ctx.fill();
    }
    // Le bouton de pause du hero, quand il est affiché
    if (pauseBtn && !pauseBtn.hidden) {
      const o = card.getBoundingClientRect(), r = pauseBtn.getBoundingClientRect();
      if (r.width) soft([{ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }], 8, 8, 12);
    }
    ctx.restore();
  }
  function reserve(c) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 1;
    c.drawImage(mask, 0, 0);
    c.restore();
  }

  function render(t) {
    if (!G || !def || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.field;
    ctx.fillStyle = C.field;
    ctx.save();
    def.draw(ctx, G, t, state, C, kit, view);
    ctx.restore();
    reserve(ctx);
    // Fond de la signature (lavis, ombrage) : posé sous les traits, après les réserves, pour que le texte garde son fond sans halo.
    if (def.under) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      def.under(ctx, G, t, state, C, kit);
      ctx.restore();
    }
  }

  function loop(now) {
    const t = now - t0;
    render(t);
    if (def && t < (def.duration || 0)) raf = requestAnimationFrame(loop);
    else { raf = 0; render(Infinity); }
  }

  function play(intro) {
    cancelAnimationFrame(raf);
    raf = 0;
    clock = 0;
    if (!G || !def) return;
    if (!intro || reduce.matches || !def.duration) { render(Infinity); liveSync(); return; }
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
    liveSync();
  }

  /* ---------- Calque vivant : il tourne tant que le hero est à l'écran, l'onglet visible, sans pause ni mouvements réduits ---------- */
  function renderLive() {
    if (!lctx) return;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, live.width, live.height);
    if (!G || !def || !def.live || !state) return;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.save();
    const drawn = def.live(lctx, G, clock, state, C, kit, view);
    lctx.restore();
    if (drawn !== false) reserve(lctx);
  }
  const running = () => !!(def && def.live && G && state && !reduce.matches && !paused && onScreen && !document.hidden);
  function tick(now) {
    lraf = 0;
    if (!running()) return;
    clock += Math.min(50, Math.max(0, now - last)); // un onglet en veille ne fait pas sauter la sève
    last = now;
    renderLive();
    lraf = requestAnimationFrame(tick);
  }
  function liveSync() {
    view.still = reduce.matches;
    if (running()) {
      if (!lraf) { last = performance.now(); lraf = requestAnimationFrame(tick); }
    } else {
      cancelAnimationFrame(lraf);
      lraf = 0;
      renderLive(); // pause : l'image reste où elle est ; mouvements réduits : l'état figé de la signature
    }
  }
  function syncPause() {
    if (!pauseBtn) return;
    const show = !!(def && def.live && !reduce.matches);
    const changed = pauseBtn.hidden === show;
    pauseBtn.hidden = !show;
    pauseBtn.classList.toggle('is-paused', paused);
    pauseBtn.setAttribute('aria-label', paused ? 'Relancer l’animation du relief' : 'Mettre en pause l’animation du relief');
    return changed;
  }

  /* ---------- Profondeur au défilement (signatures « depth ») ---------- */
  let sraf = 0;
  function onScroll() {
    if (sraf || !def || !def.depth || !G) return;
    sraf = requestAnimationFrame(() => {
      sraf = 0;
      const y = reduce.matches ? 0 : Math.min(G.H + 64, Math.max(0, -card.getBoundingClientRect().top + restTop));
      if (Math.abs(y - view.scroll) < 0.5) return;
      view.scroll = y;
      if (!raf) render(Infinity);
      if (!lraf) renderLive();
    });
  }
  let restTop = 0; // position du haut de la capsule quand la page n'a pas défilé

  function prepare() {
    if (!G || !def) return;
    restTop = card.getBoundingClientRect().top + scrollY;
    view.scroll = def.depth && !reduce.matches ? Math.min(G.H + 64, Math.max(0, scrollY)) : 0;
    syncPause();
    size();
    colors();
    buildMask();
    state = def.setup ? def.setup(G, kit) : null;
  }

  // Poser la signature (au chargement, ou de nouveau quand la carte graphique rend son contexte)
  let ticker = 0;
  SIG.set = (id, intro = true) => {
    const next = SIG.list.find((d) => d.id === id) || SIG.list[0];
    if (def && def !== next && def.teardown) def.teardown(state);
    def = next;
    if (card) card.dataset.sig = def.id;
    clearInterval(ticker);
    ticker = 0;
    if (!G) return; // la géométrie arrivera avec le premier ajustement du mot
    prepare();
    play(intro);
    if (def.every) ticker = setInterval(() => { if (!raf) { if (def.refresh) state = def.setup(G, kit); render(Infinity); } }, def.every);
  };
  // Banc d'essai : dessiner l'instant t (ms) sans boucle ; seekLive fige le calque vivant à l'instant c (ms)
  SIG.seek = (t) => { cancelAnimationFrame(raf); raf = 0; render(t); };
  SIG.seekLive = (c, still = false) => { cancelAnimationFrame(lraf); lraf = 0; clock = c; view.still = still; renderLive(); };
  SIG.view = view;
  SIG.replay = () => play(true);
  SIG.current = () => def && def.id;
  SIG.pause = (on) => { paused = on === undefined ? !paused : !!on; syncPause(); liveSync(); return paused; };

  function boot() {
    card = document.querySelector('.hero__card');
    if (!card) return;
    canvas = document.createElement('canvas');
    canvas.className = 'hero__sig';
    canvas.setAttribute('aria-hidden', 'true');
    live = document.createElement('canvas');
    live.className = 'hero__sig hero__sig--live';
    live.setAttribute('aria-hidden', 'true');
    mask = document.createElement('canvas');
    kit.reserveMask = () => mask; // pour les signatures qui dessinent ailleurs (carte graphique)
    card.querySelector('.hero__lines').append(canvas, live);
    ctx = canvas.getContext('2d');
    lctx = live.getContext('2d');
    pauseBtn = card.querySelector('.hero__pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => SIG.pause());
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; liveSync(); }).observe(card);
    document.addEventListener('visibilitychange', liveSync);
    reduce.addEventListener('change', () => { if (!G || !def) return; prepare(); render(Infinity); liveSync(); });
    addEventListener('scroll', onScroll, { passive: true });
    const first = 'buis'; // la signature retenue, pour tout le monde
    let started = false, refit = 0;
    card.addEventListener('topiary:fit', (e) => {
      G = e.detail;
      if (!started) { started = true; SIG.set(def ? def.id : first, true); return; }
      clearTimeout(refit);
      refit = setTimeout(() => { prepare(); if (!raf) render(Infinity); renderLive(); liveSync(); }, 90);
    });
    root.addEventListener('topiary:theme', () => { colors(); if (!raf) render(Infinity); renderLive(); });
    def = SIG.list.find((d) => d.id === first) || SIG.list[0];
    card.dataset.sig = def.id;
    if (g.topiaryGeom) { G = g.topiaryGeom; started = true; SIG.set(def.id, true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
