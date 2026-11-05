/* Tiroir : l'en-tête façade, la question, la réponse, la fiche qui sort du tiroir */
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NB = ' ';
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fontsReady = Promise.race([
    document.fonts ? Promise.all([document.fonts.ready, document.fonts.load('400 17px Karla'), document.fonts.load('500 20px Karla'), document.fonts.load('400 48px "Bodoni Moda"')]) : Promise.resolve(),
    sleep(1600),
  ]);
  const onView = (el, th, fn) => new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: th }).observe(el);
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  /* Boucle d'animation plafonnée à 60 images/s (l'écran de la machine de test tourne à 144 Hz). */
  const BENCH = /[?&]bench/.test(location.search) ? (window.__tiroirFrames = []) : null;
  function loop(step) {
    let last = -1e9;
    const f = () => {
      const now = performance.now();   // même base de temps partout (rAF et horloges de test)
      if (now - last < 15.5) { requestAnimationFrame(f); return; }
      last = now;
      const t = BENCH ? performance.now() : 0;
      const more = step(now);
      if (BENCH) BENCH.push(performance.now() - t);
      if (more) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  /* =========================================================
     En-tête : la façade. En haut de page, posé sur le ciel ; la bande cobalt se forme sur les premiers pixels
     de défilement (tiroir.css, timeline de défilement). Plus bas, l'en-tête suit le défilement au pixel près :
     il se range quand on descend, ressort quand on remonte ; quand le défilement s'arrête à mi-course,
     il finit son geste (vers le haut ou vers le bas, selon le dernier sens).
     ========================================================= */
  const head = $('.head');
  const html = document.documentElement;
  const menuBtn = $('.menu-btn'), menu = $('#menu'), menuLabel = $('.menu-btn-label');
  let lastY = Math.max(0, scrollY), menuOpen = false;
  let hTarget = 0, hShown = 0, hMax = 84, lastDir = 0, idleT = 0, hLoop = false, hLast = 0, hTau = 55;
  const measureHead = () => { hMax = head.offsetHeight + 20; };   // la bande et sa poignée (14 px), plus une marge
  measureHead();
  /* L'en-tête rattrape sa cible en douceur (approche exponentielle : constante de temps de 55 ms quand il suit le défilement,
     90 ms quand il finit son geste) : il reste attaché au doigt, et les crans d'une molette ne le font pas sauter. */
  function headTick(now) {
    const dt = Math.min(64, now - hLast); hLast = now;
    hShown += (hTarget - hShown) * (RM ? 1 : 1 - Math.exp(-dt / hTau));
    if (Math.abs(hTarget - hShown) < 0.1) hShown = hTarget;
    head.style.transform = hShown > 0.05 ? `translate3d(0, ${(-hShown).toFixed(2)}px, 0)` : '';
    head.classList.toggle('is-hidden', hShown >= hMax - 0.5);
    if (hShown !== hTarget) requestAnimationFrame(headTick); else hLoop = false;
  }
  function setTarget(v, tau) {
    hTarget = clamp(v, 0, hMax); hTau = tau || 55;
    if (!hLoop && hTarget !== hShown) { hLoop = true; hLast = performance.now(); requestAnimationFrame(headTick); }
  }
  /* quand le défilement s'arrête à mi-course, l'en-tête finit son geste dans le dernier sens */
  function settle() {
    if (hTarget <= 0.5 || hTarget >= hMax - 0.5) return;
    setTarget(lastDir > 0 ? (hTarget > hMax * 0.25 ? hMax : 0) : (hTarget < hMax * 0.75 ? 0 : hMax), 90);
  }
  const heroEl = $('.hero');
  function onScroll() {
    const y = Math.max(0, scrollY);
    const low = y > heroEl.offsetHeight - hMax;     // sur le papier, la poignée masquerait des mots
    if (head.classList.contains('is-low') !== low) head.classList.toggle('is-low', low);
    const st = (y > 24 || menuOpen) ? 'strip' : 'top';
    if (head.dataset.state !== st) head.dataset.state = st;
    const dy = y - lastY;
    lastY = y;
    if (dy) lastDir = Math.sign(dy);
    if (menuOpen || head.contains(document.activeElement)) { setTarget(0); return; }
    /* l'en-tête ne se range qu'au-delà de 55 % de la hauteur d'écran, et jamais plus que la distance parcourue au-delà */
    const room = Math.max(0, y - innerHeight * 0.55);
    setTarget(Math.min(hTarget + dy, room));
    clearTimeout(idleT);
    idleT = setTimeout(settle, 140);
  }
  addEventListener('scroll', onScroll, { passive: true });
  head.addEventListener('focusin', () => setTarget(0, 90));
  addEventListener('resize', measureHead);
  onScroll();

  /* La section en cours, soulignée au crayon dans la navigation. */
  const navLinks = $$('.nav-link, .menu-link');
  const secs = ['demo', 'dossiers', 'tarif'].map((id) => document.getElementById(id));
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => seen.set(e.target.id, e.isIntersecting));
    const cur = secs.find((s) => seen.get(s.id));
    navLinks.forEach((a) => {
      const on = cur && a.getAttribute('href') === '#' + cur.id;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach((s) => io.observe(s));

  /* Menu de téléphone : le panneau sort comme un tiroir. Focus gardé dans le panneau, Échap ferme. */
  const outside = [$('main'), $('.end'), $('.skip'), $('.brand', head), $('.head-cta', head)];
  const trapList = () => [menuBtn, ...$$('a, button', menu)];
  let closeT = 0;
  function openMenu() {
    if (menuOpen) return;
    menuOpen = true; clearTimeout(closeT); head.classList.add('is-menu');
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true'); menuLabel.textContent = 'Fermer';
    html.classList.add('is-locked');
    outside.forEach((el) => el && (el.inert = true));
    onScroll();
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    setTimeout(() => { if (menuOpen) $('.menu-link', menu).focus({ preventScroll: true }); }, RM ? 0 : 120);
  }
  function closeMenu(focusBack) {
    if (!menuOpen) return;
    menuOpen = false; head.classList.remove('is-menu');
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false'); menuLabel.textContent = 'Menu';
    html.classList.remove('is-locked');
    outside.forEach((el) => el && (el.inert = false));
    closeT = setTimeout(() => { if (!menuOpen) menu.hidden = true; }, RM ? 0 : 480);
    if (focusBack) menuBtn.focus({ preventScroll: true });
    onScroll();
  }
  menuBtn.addEventListener('click', () => (menuOpen ? closeMenu(true) : openMenu()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
    if (e.key !== 'Tab') return;
    const list = trapList(), i = list.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && (i === list.length - 1 || i < 0)) { e.preventDefault(); list[0].focus(); }
  });
  matchMedia('(min-width: 880px)').addEventListener('change', (m) => { if (m.matches) closeMenu(false); });

  /* Le trait de crayon des liens : il se trace à l'entrée de la souris ; à la sortie, il finit son tracé en partant vers la droite. */
  $$('.trait').forEach((tr) => {
    const host = tr.parentElement;
    if (!host || !host.matches('a, button')) return;
    host.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      tr.classList.remove('is-out', 'is-reset'); tr.classList.add('is-on');
    });
    host.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || !tr.classList.contains('is-on')) return;
      tr.classList.remove('is-on');
      if (host.getAttribute('aria-current') === 'true' || RM) return;
      tr.classList.add('is-out');
    });
    tr.addEventListener('transitionend', () => {
      if (!tr.classList.contains('is-out')) return;
      tr.classList.add('is-reset'); tr.classList.remove('is-out');
      requestAnimationFrame(() => requestAnimationFrame(() => tr.classList.remove('is-reset')));
    });
  });

  /* Saisie caractère par caractère ; « from » permet de reprendre une phrase déjà commencée. */
  async function typeIn(el, text, speed, alive, from) {
    const node = document.createTextNode(text.slice(0, from || 0)), caret = document.createElement('span');
    caret.className = 'caret';
    el.textContent = ''; el.append(node, caret);
    for (let i = from || 0; i < text.length; i++) {
      if (alive && !alive()) return false;
      node.data = text.slice(0, i + 1);
      const c = text[i];
      await sleep(speed * (0.6 + Math.random() * 0.8) + (c === ',' ? 140 : 0));
    }
    await sleep(450);
    if (!alive || alive()) caret.remove();
    return true;
  }

  /* Crayon vert : traits serrés, bords irréguliers, posés de gauche à droite. */
  function crayon(rects, seed) {
    const R = rng(seed);
    const lines = rects.map((r) => {
      const strokes = [];
      for (let i = 0; i < 6; i++) {
        strokes.push({ y: r.y + r.h * (0.2 + 0.64 * (i / 5)) + (R() - 0.5) * 1.2, a: r.x - 3 + R() * 5, b: r.x + r.w + 1 + R() * 5, ph: R() * 6.28, wd: 2.4 + R() * 1.6, dash: [6 + R() * 18, 0.8 + R() * 1.8] });
      }
      return { r, strokes };
    });
    return { lines, total: rects.reduce((s, r) => s + r.w, 0) };
  }
  function drawCrayon(ctx, cv, w, h, hl, p) {
    const d = DPR();
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (!hl) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.strokeStyle = 'rgba(134, 184, 62, .42)'; ctx.lineCap = 'round';
    let budget = p * hl.total;
    for (const ln of hl.lines) {
      if (budget <= 0) break;
      const upto = ln.r.x + Math.min(ln.r.w + 6, budget + 4);
      budget -= ln.r.w;
      for (const s of ln.strokes) {
        const b = Math.min(s.b, upto);
        if (b <= s.a) continue;
        ctx.lineWidth = s.wd; ctx.setLineDash(s.dash);
        ctx.beginPath();
        for (let x = s.a; x <= b; x += 6) { const y = s.y + Math.sin(x * 0.045 + s.ph) * 0.6; x === s.a ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.lineTo(b, s.y + Math.sin(b * 0.045 + s.ph) * 0.6);
        ctx.stroke();
      }
    }
  }
  function tween(ms, fn, alive) {
    return new Promise((res) => {
      const t0 = performance.now();
      loop((now) => {
        if (alive && !alive()) { res(false); return false; }
        const p = clamp((now - t0) / ms, 0, 1); fn(p);
        if (p >= 1) { res(true); return false; }
        return true;
      });
    });
  }

  /* Les trois questions et leurs fiches (documents fictifs, rédaction plausible). */
  const QA = [
    {
      a: 'Six mois avant la fin de chaque période de trois ans.',
      file: 'Bail commercial Lyon 3e.pdf', path: 'Drive, Juridique, Baux', page: 'page 3', h: 'Article 4. Durée',
      body: [`Le présent bail est consenti pour neuf années entières et consécutives. Le Preneur pourra donner congé `, `à${NB}l’expiration de chaque période triennale, en respectant un préavis de six mois`, `, par lettre recommandée avec demande d’avis de réception ou par acte de commissaire de justice.`],
    },
    {
      a: `La directrice générale, ou le directeur administratif et financier en son absence.`,
      file: 'Délégations de signature 2026.docx', path: 'SharePoint, Direction', page: 'page 2', h: 'Article 3. Engagements de dépenses',
      body: [`Les devis et bons de commande d’un montant supérieur à 5${NB}000${NB}€${NB}HT sont `, `signés par la directrice générale ou, en son absence, par le directeur administratif et financier`, `. En deçà, le responsable du service concerné signe seul.`],
    },
    {
      a: `Oui, même hors de vos locaux, jusqu’à 15${NB}000${NB}€ par sinistre, après franchise.`,
      file: 'Multirisque professionnelle 2025.pdf', path: 'Drive, Assurances', page: 'page 12', h: 'Article 7. Biens confiés',
      body: [`Sont garantis les biens appartenant à l’assuré et confiés temporairement à ses clients, `, `y${NB}compris hors des locaux assurés, dans la limite de 15${NB}000${NB}€ par sinistre`, `, après application de la franchise prévue aux conditions particulières.`],
    },
  ];

  /* =========================================================
     Hero : la question est posée, la fiche sort du tiroir, la réponse s'écrit
     ========================================================= */
  const hero = $('.hero');
  const trame = $('.trame', hero);
  const tctx = trame.getContext('2d');
  const hillImg = $('.hill img', hero);
  const ask = $('.ask', hero);
  const copy = $('.hero-copy', hero);
  const askA = $('.ask-a', ask), askS = $('.ask-src', ask);
  const ANSWER = askA.textContent;
  /* Premier affichage : la question est déjà posée et la réponse est en cours d'écriture. */
  const START = 'Six mois avant la fin'.length;
  if (!RM) {
    askA.textContent = ANSWER.slice(0, START);
    const c = document.createElement('span'); c.className = 'caret'; askA.append(c);
    askS.classList.add('wait');
  }
  const COM = { x0: 688, x1: 884, top: 30, mouthX: 816, mouthY: 108, drawerW: 128 };
  /* la crête de la colline (premier pixel opaque), tous les 52 px de l'image ; sous la commode, interpolée */
  const CREST = [219, 209, 199, 190, 185, 179, 174, 171, 166, 160, 156, 151, 149, 147, 148, 149, 151, 153, 157, 160, 165, 171, 176, 180, 186, 195, 204, 214, 222];   // le tiroir tiré : de 752 à 880, bord haut à 108   // la commode et la bouche du tiroir ouvert, en pixels de l'image
  let HF = null, heroT0 = null, heroVisible = true, heroLooping = false, heroDirty = false;
  const PX = !RM && window.CSS && CSS.supports('animation-timeline: view()');
  const heroShift = () => (PX ? Math.min(Math.max(scrollY, 0), innerHeight) * 0.08 : 0);
  const relRect = (el, ref) => { const r = el.getBoundingClientRect(); return { l: r.left - ref.left, t: r.top - ref.top, w: r.width, h: r.height }; };
  const lineRects = (el, ref) => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((r) => r.width > 2).map((r) => ({ l: r.left - ref.left, t: r.top - ref.top, w: r.width, h: r.height })); };

  /* =========================================================
     La fiche en trame. La mise en page d'une fiche (son papier, ses lignes de texte, son filet) rendue en points
     blancs sur rangées décalées, comme la commode de la démo : le papier est fait de points, le texte et le filet
     sont des trous dans la trame (le bleu du ciel y tient lieu d'encre, comme sur la vraie fiche).
     Plus les points sont gros, plus l'empreinte est proche du papier : la trace se condense jusqu'à la fiche.
     Chaque empreinte est rendue une fois dans un calque, puis posée à chaque image (un drawImage).
     Partagée par le hero (la trace du vol) et la démo (la trace de la fiche qui sort du tiroir).
     ========================================================= */
  const TAU = 6.2832;
  function ghostLayout(w, h, lines, seed) {
    const R = rng(seed), words = [];
    for (const ln of lines) {
      const hh = ln.hh || 4;
      if (ln.kind === 'rule') { words.push({ x0: ln.x0, x1: ln.x1, y: ln.y, hh }); continue; }
      let x = ln.x0;
      while (x < ln.x1 - 6) {
        const len = Math.min(ln.x1 - x, 14 + R() * 46);
        if (len > 5) words.push({ x0: x, x1: x + len, y: ln.y, hh });
        x += len + 7 + R() * 3;
      }
    }
    return { w, h, words };
  }
  /* Le calque d'une empreinte : la fiche à l'échelle sc, des points au pas « pitch » (px d'écran), de rayon dens × pas / 2. */
  function ghostSprite(L, sc, dens, pitch, dir) {
    const dp = DPR(), w = L.w * sc, h = L.h * sc;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dp)); cv.height = Math.max(1, Math.ceil(h * dp));
    const x = cv.getContext('2d');
    x.setTransform(dp, 0, 0, dp, 0, 0);
    x.fillStyle = '#fff';
    x.beginPath();
    const lp = pitch / sc;                          // le pas, en pixels de la fiche
    /* dans le sens du vol, le papier s'éclaire : l'empreinte est plus pleine vers l'avant, plus claire vers l'arrière */
    const dx = dir ? dir[0] : 0, dy = dir ? dir[1] : 0, ext = Math.abs(dx) * L.w / 2 + Math.abs(dy) * L.h / 2 || 1;
    let row = 0;
    for (let gy = pitch / 2; gy < h; gy += pitch, row++) {
      const ly = gy / sc;
      const ink = L.words.filter((wd) => Math.abs(ly - wd.y) <= wd.hh + lp * 0.18);
      const off = row % 2 ? pitch / 2 : 0;
      for (let gx = pitch / 2 + off; gx < w; gx += pitch) {
        const lx = gx / sc;
        let hole = false;
        for (const wd of ink) if (lx >= wd.x0 - lp * 0.3 && lx <= wd.x1 + lp * 0.3) { hole = true; break; }
        if (hole) continue;
        const edge = clamp(Math.min(gx, w - gx, gy, h - gy) / (pitch * 0.55), 0.55, 1);   // le bord du papier s'amincit
        const lum = dir ? lerp(0.32, 1, smooth(-0.85, 0.75, ((lx - L.w / 2) * dx + (ly - L.h / 2) * dy) / ext)) : 1;
        const r = pitch * 0.5 * dens * edge * Math.sqrt(lum);
        if (r < 0.35) continue;
        x.moveTo(gx + r, gy); x.arc(gx, gy, r, 0, TAU);
      }
    }
    x.fill();
    return { cv, w, h, sc };
  }
  /* Pose une empreinte : centre (cx, cy), échelle, rotation (radians), opacité. La feuille cache ce qui est derrière elle. */
  function ghostPut(ctx, g, cx, cy, sc, rot, alpha) {
    if (alpha <= 0.01) return;
    const k = sc / g.sc;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = Math.min(1, alpha * 1.25);
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(g.cv, -g.w / 2, -g.h / 2, g.w, g.h);
    ctx.restore();
  }

  /* =========================================================
     Hero : la fiche sort du tiroir ouvert (le dernier, tiré) et vient se poser à sa place. En passant, elle laisse
     trois empreintes en trame, une chronophotographie de son vol : elles restent derrière elle, de plus en plus denses
     jusqu'à elle. La fiche passe devant la commode et sort de la fente du tiroir (masquée sous son bord).
     ========================================================= */
  function askLayout(ar) {
    /* la vraie mise en page de la fiche du hero : sa question, son filet, sa réponse entière (mesurée sur une copie), sa source */
    const ref = ask.getBoundingClientRect(), sx = ar.w / ref.width;   // en pixels de la fiche, hors transformation
    const fix = (r) => ({ l: r.l * sx, t: r.t * sx, w: r.w * sx, h: r.h * sx });
    const lines = [];
    const q = $('.ask-q span', ask);
    lineRects(q, ref).map(fix).forEach((r) => lines.push({ x0: r.l, x1: r.l + r.w, y: r.t + r.h * 0.56, hh: r.h * 0.22 }));
    const qr = fix(relRect($('.ask-q', ask), ref));
    lines.push({ kind: 'rule', x0: qr.l, x1: qr.l + qr.w, y: qr.t + qr.h - 1, hh: 1.2 });
    const cl = askA.cloneNode(false); cl.textContent = ANSWER; cl.style.visibility = 'hidden'; cl.style.position = 'absolute'; cl.style.width = askA.offsetWidth + 'px';
    cl.style.left = askA.offsetLeft + 'px'; cl.style.top = askA.offsetTop + 'px';
    ask.append(cl);
    lineRects(cl, ref).map(fix).forEach((r) => lines.push({ x0: r.l, x1: r.l + r.w, y: r.t + r.h * 0.6, hh: r.h * 0.2 }));
    cl.remove();
    const sr = fix(relRect(askS, ref));
    const srt = (lineRects(askS, ref).map(fix))[0] || sr;
    lines.push({ x0: sr.l, x1: srt.l + srt.w, y: sr.t + sr.h * 0.55, hh: sr.h * 0.22 });
    return ghostLayout(ar.w, ar.h, lines, 11);
  }
  /* Un chemin fait de courbes de Bézier cubiques à la suite, parcouru à la longueur d'arc : d de 0 à 1. */
  function pathOf(segs) {
    const pts = [], len = [0];
    segs.forEach((g, si) => {
      for (let i = si ? 1 : 0; i <= 48; i++) {
        const t = i / 48, m = 1 - t;
        pts.push([m * m * m * g[0][0] + 3 * m * m * t * g[1][0] + 3 * m * t * t * g[2][0] + t * t * t * g[3][0],
                  m * m * m * g[0][1] + 3 * m * m * t * g[1][1] + 3 * m * t * t * g[2][1] + t * t * t * g[3][1]]);
        const n = pts.length - 1;
        if (n) len.push(len[n - 1] + Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]));
      }
    });
    const N = pts.length - 1, T = len[N] || 1;
    const at = (d) => {
      const target = clamp(d, 0, 1) * T;
      let i = 1;
      while (i < N && len[i] < target) i++;
      const f = (target - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
      return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
    };
    at.total = T;
    return at;
  }
  /* u (temps, 0 à 1) tel que E.vol(u) = d : pour savoir quand la fiche passe à une étape de son vol */
  const volInv = (d) => { let a = 0, b = 1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (E.vol(m) < d) a = m; else b = m; } return (a + b) / 2; };
  let heroFlying = false, heroStale = false;
  const BENCH_HF = /[?&]bench/.test(location.search);
  const NS = 0.26, NS2 = 0.35;                     // téléphone : taille de la fiche à l'entrée et en haut du couloir libre
  /* Interpolation monotone (Fritsch-Carlson) par des points, plate avant le premier et après le dernier */
  function monoN(x, X, Y) {
    const n = X.length;
    if (x <= X[0]) return Y[0]; if (x >= X[n - 1]) return Y[n - 1];
    const S = [], M = [0];
    for (let i = 0; i < n - 1; i++) S.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
    for (let i = 1; i < n - 1; i++) {
      const h0 = X[i] - X[i - 1], h1 = X[i + 1] - X[i];
      M.push(S[i - 1] * S[i] <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / S[i - 1] + (h1 + 2 * h0) / S[i]));
    }
    M.push(0);
    let i = 0;
    while (i < n - 2 && x > X[i + 1]) i++;
    const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * M[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * M[i + 1];
  }
  function buildHero() {
    if (heroFlying) { heroStale = true; return; }
    const hr = hero.getBoundingClientRect(), dp = DPR();
    const W = hr.width, H = hr.height, wide = W >= 880;
    trame.width = Math.round(W * dp); trame.height = Math.round(H * dp);
    const ir = relRect(hillImg, hr), k = ir.w / 1456;
    const S = { x: ir.l + COM.mouthX * k, y: ir.t + COM.mouthY * k };   // la fente : le bord haut du tiroir tiré
    const ar = relRect(ask, hr);
    ar.t += heroShift();                           // mesurée hors du glissement du hero
    const C = { x: ar.l + ar.w / 2, y: ar.t + ar.h / 2 };
    const L = askLayout(ar);
    const s0 = Math.min(0.4, (COM.drawerW * k * 0.72) / ar.w);
    const half0 = (ar.h * s0) / 2;
    const A = [S.x, S.y + half0 + 2];              // départ : la fiche entière dans le tiroir
    const comTop = ir.t + COM.top * k;              // le haut de la commode
    /* la commode (tiroir tiré compris) et la crête de la colline : la trace ne passe jamais devant */
    const comBox = { l: ir.l + 680 * k, t: ir.t + 22 * k, w: 212 * k, h: 160 * k };
    const pb = PERSO ? PERSO.box : { x0: 846, y0: 50, x1: 990, y1: 186 };   // le chercheur, assis à droite du tiroir
    const persoBox = { l: ir.l + pb.x0 * k, t: ir.t + pb.y0 * k, w: (pb.x1 - pb.x0) * k, h: (pb.y1 - pb.y0) * k };
    const crestY = (x) => {
      const ix = clamp((x - ir.l) / k / 52, 0, CREST.length - 1.001), i = Math.floor(ix);
      return ir.t + k * lerp(CREST[i], CREST[i + 1], ix - i);
    };
    const crestMin = (l, r) => { let m = 1e9; for (let x = l; x <= r; x += 8) m = Math.min(m, crestY(x)); return Math.min(m, crestY(r)); };
    /* ce que la trace ne doit pas recouvrir : le titre, le chapeau, le bouton */
    const pad = (r, m) => ({ l: r.l - m, t: r.t - m, w: r.w + 2 * m, h: r.h + 2 * m });
    const keep = [...lineRects($('h1', hero), hr), ...lineRects($('.lede', hero), hr), relRect($('.hero-copy .btn', hero), hr)].map((r) => pad(r, 16));
    let segs;
    if (wide) {
      /* Elle monte hors du tiroir, s'écarte dans le ciel libre à gauche de sa place (juste ce qu'il faut pour qu'une
         empreinte à mi-vol y tienne, au-dessus de la commode), puis glisse vers sa place et y entre par la gauche.
         Quand la commode est loin à gauche de la fiche (grands écrans), l'écart est nul : elle monte, puis va à droite. */
      const hw = 0.23 * ar.w, hh = 0.23 * ar.h;      // une empreinte à mi-vol (environ 46 % de la fiche)
      const W2 = { x: Math.min(S.x, ar.l - 28 - hw), y: 0 };
      const below = Math.max(-1e9, ...keep.filter((r) => r.l < W2.x + hw && r.l + r.w > W2.x - hw).map((r) => r.t + r.h));
      const yLo = below + hh + 6, yHi = comTop - 12 - hh;
      if (yLo <= yHi) W2.y = clamp(C.y + 0.15 * ar.h, yLo, yHi);
      else { W2.x = S.x; W2.y = Math.min(yHi, C.y + 0.15 * ar.h); }   // pas de ciel libre à gauche : elle monte droit
      segs = [
        [A, [S.x, S.y - 0.4 * (S.y - W2.y)], [W2.x, W2.y + 0.45 * (S.y - W2.y)], [W2.x, W2.y]],
        [[W2.x, W2.y], [W2.x, W2.y - 0.55 * Math.max(40, W2.y - C.y + 0.3 * ar.h)], [C.x - 0.5 * (C.x - W2.x), C.y], [C.x, C.y]],
      ];
    } else {
      /* Téléphone et tablette : le chercheur est assis à droite de la commode. La fiche sort de la fente, part en
         diagonale dans le ciel libre à gauche de la commode (au-dessus de la crête), puis remonte vers sa place.
         Sans place à gauche, elle monte droit. */
      /* La fiche arrive dans ce couloir à NS de sa taille, y monte droit en grandissant un peu (NS2) jusque sous la
         fiche posée, à moitié glissée dessous, puis rejoint sa place. Le bord droit de la trace longe la commode. */
      const hw = (NS / 2) * ar.w, hh = (NS / 2) * ar.h;
      const room = comBox.l - 2 * hw - 12 >= 6;
      const W2 = { x: room ? Math.max(6 + hw, comBox.l - hw - 8) : S.x, y: 0 };
      W2.y = Math.min(S.y - 24, crestMin(W2.x - hw, W2.x + hw) - 6 - hh);
      const hw2 = (NS2 / 2) * ar.w, hh2 = (NS2 / 2) * ar.h;
      const W3 = { x: room ? Math.max(6 + hw2, comBox.l - hw2 - 8) : S.x, y: Math.min(ar.t + ar.h + 0.24 * hh2, comBox.t - 4 - hh2) };
      segs = [
        [A, [S.x, S.y - 0.6 * Math.max(30, S.y - W2.y)], [W2.x + 0.6 * (S.x - W2.x), W2.y], [W2.x, W2.y]],
        [[W2.x, W2.y], [W2.x, W2.y - 0.4 * (W2.y - W3.y)], [W3.x, W3.y + 0.4 * (W2.y - W3.y)], [W3.x, W3.y]],
        [[W3.x, W3.y], [W3.x, W3.y - 0.6 * (W3.y - C.y)], [C.x - 0.4 * (C.x - W3.x), C.y], [C.x, C.y]],
      ];
    }
    const P = segs[0];
    const path = pathOf(segs);
    // fin des premiers gestes, en part du chemin
    const d1 = segs.length > 1 ? pathOf([segs[0]]).total / path.total : 0.5;
    const d2 = segs.length > 2 ? pathOf([segs[0], segs[1]]).total / path.total : 0.7;
    const out = (2 * half0 + 4) / path.total;      // part du chemin parcourue dans la fente
    const dur = clamp(1000 + path.total * 0.55, 1250, 1700);
    const xAt = (u) => path(E.vol(clamp(u, 0, 1)))[0];
    const tl = tilt(xAt, dur);
    const poseAt = (u) => {
      const d = E.vol(u), [x, y] = path(d);
      /* petite tant qu'elle monte, elle grandit en venant vers sa place (elle s'approche de nous) */
      /* au bureau : petite tant qu'elle monte, elle grandit en venant vers sa place. Au téléphone : à NS au bout du
         premier geste, puis jusqu'à 1 (interpolation monotone, sans palier ni à-coup) */
      const sc = wide ? lerp(s0, 1, Math.pow(smooth(out * 1.1, 0.97, d), 1.6)) : monoN(d, [out * 1.1, d1, d2, 0.97], [s0, NS, NS2, 1]);
      return { d, x, y, sc, rot: 2.4 * tl(u) * smooth(out * 0.8, out * 3, d) };
    };
    /* Les empreintes : seulement des poses qui se lisent comme une feuille (au moins 30 % de la taille de la fiche),
       qui ne passent ni devant la commode ni sous la crête, hors du texte, et visibles au moins à moitié
       (pas de bande fine qui dépasserait de sous la fiche). Deux ou trois, bien séparées, sinon aucune. */
    const boxAt = (d) => { const p = poseAt(volInv(d)), gw = ar.w * p.sc, gh = ar.h * p.sc; return { d, p, l: p.x - gw / 2, t: p.y - gh / 2, w: gw, h: gh }; };
    const inter = (a, b) => Math.max(0, Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t));
    const ok = [], why = BENCH_HF ? [] : null;
    for (let d = 0.1; d <= 0.94; d += 0.01) {
      const b = boxAt(d);
      const r = b.p.sc < (wide ? 0.3 : NS - 0.02) ? 'petite' : b.l < 4 || b.l + b.w > W - 4 ? 'bord'
        : inter(b, comBox) > 0 ? 'commode' : inter(b, persoBox) > 0 ? 'perso' : b.t + b.h > crestMin(b.l, b.l + b.w) - 4 ? 'crete'
        : keep.some((k) => inter(b, k) > 0) ? 'texte' : inter(b, ar) > 0.5 * b.w * b.h ? 'fiche' : '';
      if (why) why.push(`${d.toFixed(2)}:${r || 'ok'}:${Math.round(b.l)},${Math.round(b.t)},${Math.round(b.w)}`);
      if (!r) ok.push(b);
    }
    if (why) window.__hfwhy = why;
    /* séparation : la plus récente cache en partie la précédente ; il faut qu'il reste au moins la moitié de celle-ci */
    const sep = (a, b) => Math.max(Math.abs(b.p.x - a.p.x) / a.w, Math.abs(b.p.y - a.p.y) / a.h);
    let pick = [];
    if (ok.length > 1) {
      const A1 = ok[0], B1 = ok[ok.length - 1];
      if (sep(A1, B1) >= 0.5) {
        pick = [A1, B1];
        if (sep(A1, B1) >= 1.3) {
          const mid = ok.reduce((m, b) => (Math.abs(b.d - (A1.d + B1.d) / 2) < Math.abs(m.d - (A1.d + B1.d) / 2) ? b : m), A1);
          if (sep(A1, mid) >= 0.5 && sep(mid, B1) >= 0.5) pick = [A1, mid, B1];
        }
      }
    }
    const DENS = { 2: [0.5, 0.68], 3: [0.42, 0.56, 0.72] }[pick.length] || [];
    const ALPHA = { 2: [0.85, 1], 3: [0.76, 0.9, 1] }[pick.length] || [];
    const pitch = wide ? 5.5 : 4.6;
    const ghosts = pick.map((b, i) => {
      const d = b.d, q0 = path(Math.max(0, d - 0.01)), q1 = path(Math.min(1, d + 0.01)), m = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1;
      return { i, u: volInv(d), d, sc: b.p.sc, alpha: ALPHA[i], spr: ghostSprite(L, b.p.sc, DENS[i], pitch, [(q1[0] - q0[0]) / m, (q1[1] - q0[1]) / m]) };
    });
    HF = { W, H, S, C, ar, path, poseAt, dur, s0, ghosts, wide };
    if (/[?&]bench/.test(location.search)) window.__hf = { S, P, kept: ghosts.map((g) => +g.d.toFixed(2)), keep: keep.length };
  }
  /* Le vol de la fiche du hero, joué par le navigateur (animation de transformation : nette à l'arrivée, sans calcul par image). */
  function heroFly(delay) {
    const { C, ar, poseAt, dur, S } = HF;
    const N = 40, frames = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = poseAt(u);
      const cut = Math.max(0, (p.y + (ar.h * p.sc) / 2 - S.y) / p.sc);   // sous le bord du tiroir, la fiche est cachée
      frames.push({
        offset: u,
        transform: `translate(${(p.x - C.x).toFixed(2)}px, ${(p.y - C.y).toFixed(2)}px) rotate(${p.rot.toFixed(3)}deg) scale(${p.sc.toFixed(4)})`,
        clipPath: `inset(0px 0px ${Math.min(ar.h, cut).toFixed(1)}px 0px)`,
      });
    }
    heroFlying = true;
    const an = ask.animate(frames, { duration: dur, delay, easing: 'linear', fill: 'backwards' });
    const done = () => { heroFlying = false; if (heroStale) { heroStale = false; buildHero(); heroRedraw(); } };
    return an.finished.then(done, done);
  }
  function ghostPose(g, t, scrollP) {
    /* l'empreinte apparaît quand la fiche vient de passer ; au défilement, la trace glisse vers la fiche et s'efface un peu */
    const a = RM ? 1 : smooth(0, 320, t - g.u * HF.dur - 40);
    if (a <= 0) return null;
    const u = volInv(clamp(g.d + 0.05 * scrollP, 0, 1)), p = HF.poseAt(u);
    return { x: p.x, y: p.y - heroShift() * p.d, sc: p.sc, rot: (p.rot * Math.PI) / 180, a: g.alpha * a * (1 - 0.55 * scrollP), done: a >= 1 };
  }
  function drawHero(now) {
    if (!HF) return false;
    const dp = DPR();
    tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, trame.width, trame.height);
    if (heroT0 == null) return false;
    tctx.setTransform(dp, 0, 0, dp, 0, 0);
    const t = RM ? 1e9 : now - heroT0;
    const sp = RM ? 0 : clamp(scrollY / (HF.H * 0.8), 0, 1);
    tctx.save();
    let active = false;
    for (const g of HF.ghosts) {
      const p = ghostPose(g, t, sp);
      if (!p) { active = true; continue; }
      if (!p.done) active = true;
      ghostPut(tctx, g.spr, p.x, p.y, p.sc, p.rot, p.a);
    }
    tctx.restore();
    return active;
  }
  function kickHero() {
    if (heroLooping || !heroVisible) return;
    heroLooping = true;
    loop((now) => {
      const a = drawHero(now);
      const go = (a || heroDirty) && heroVisible;
      heroDirty = false;
      if (!go) heroLooping = false;
      return go;
    });
  }
  const heroRedraw = () => { heroDirty = true; kickHero(); };
  /* =========================================================
     Le chercheur (perso.js) : un personnage au trait, assis dans l'herbe à droite du tiroir tiré. Il fouille, sort une
     fiche, la lit, la remet, se gratte la tête : une boucle de 10 s. Le canevas est posé sur la photo, dans ses coordonnées ;
     la boucle tourne seulement quand le hero est à l'écran ; un bouton la met en pause ; en mouvement réduit, une pose fixe.
     ========================================================= */
  const persoCv = $('.perso', hero), persoBtn = $('.perso-pause', hero), hillBox = $('.hill', hero);
  const PERSO = window.TiroirPerso && persoCv ? window.TiroirPerso.create(persoCv, { img: hillImg }) : null;
  const PV = { x0: 790, y0: 40, x1: 1004, y1: 196 };   // la zone du canevas (personnage et ombre), en pixels de l'image
  const PERSO_STILL = 6.75;                              // en mouvement réduit : il se gratte la tête devant le tiroir
  let persoT = 0, persoLast = null, persoRun = false, persoPaused = false, persoOn = false, persoReady = false;
  function placePerso() {
    if (!PERSO || !persoReady) return;
    const hb = hillBox.getBoundingClientRect(), ib = hillImg.getBoundingClientRect(), k = ib.width / 1456;
    if (!k) return;
    persoCv.style.left = (ib.left - hb.left + PV.x0 * k).toFixed(2) + 'px';
    persoCv.style.top = (ib.top - hb.top + PV.y0 * k).toFixed(2) + 'px';
    persoCv.style.width = ((PV.x1 - PV.x0) * k).toFixed(2) + 'px';
    persoCv.style.height = ((PV.y1 - PV.y0) * k).toFixed(2) + 'px';
    PERSO.setView({ ...PV, s: k * DPR() });
    PERSO.draw(RM ? PERSO_STILL : persoT);
  }
  /* Sa boucle à lui, à la fréquence de l'écran (pas de plafond : à 60 Hz, un seuil fait sauter une image dès que le battement
     varie ; à 120 ou 144 Hz, le geste reste au pas de l'écran). Le temps vient de l'horodatage des images. */
  function kickPerso() {
    if (!PERSO || RM || !persoOn || !persoReady || persoRun || persoPaused || !heroVisible) return;
    persoRun = true; persoLast = null;
    const f = (now) => {
      if (persoPaused || !heroVisible) { persoRun = false; return; }
      if (persoLast != null) persoT = (persoT + Math.min(0.1, (now - persoLast) / 1000)) % PERSO.PERIOD;
      persoLast = now;
      PERSO.draw(persoT);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }
  if (PERSO) {
    if (/[?&]perso=/.test(location.search)) persoT = parseFloat(location.search.split(/[?&]perso=/)[1]) || 0;
    if (/[?&]bench/.test(location.search)) window.__perso = {
      seek: (t) => { persoPaused = true; persoT = t; PERSO.draw(t); }, pose: (t) => PERSO.pose(t),
      cost: (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) PERSO.draw((i * 10) / n); return (performance.now() - t0) / n; },
    };
    /* le premier dessin attend la colline et le calcul des ressorts (fait par tranches, perso.js) */
    Promise.all([hillImg.decode ? hillImg.decode().catch(() => {}) : Promise.resolve(), window.TiroirPerso.ready])
      .then(() => { persoReady = true; placePerso(); kickPerso(); });
    if (!RM && persoBtn) {
      persoBtn.hidden = false;
      const label = $('.sr-only', persoBtn);
      persoBtn.addEventListener('click', () => {
        persoPaused = !persoPaused;
        persoBtn.setAttribute('aria-pressed', String(persoPaused));
        label.textContent = persoPaused ? 'Reprendre l’animation du personnage' : 'Mettre en pause l’animation du personnage';
        kickPerso();
      });
    }
  }
  new IntersectionObserver((es) => { heroVisible = es[0].isIntersecting; if (heroVisible) { heroRedraw(); kickPerso(); } }).observe(hero);
  if (!RM) addEventListener('scroll', () => { if (heroVisible && heroT0 != null) heroRedraw(); }, { passive: true });

  /* =========================================================
     L'ouverture : on attend la police et l'image de la colline (au plus 1,6 s), puis tout arrive ensemble.
     La colline se pose (tiroir.css, 1,1 s), le titre sort, et la fiche part du tiroir quand la commode est en place.
     ========================================================= */
  const root = document.documentElement;
  const FLY_AT = 520;
  async function heroPlay() {
    buildHero();                                   // mesuré avant les entrées (aucune transformation en cours)
    root.classList.add('rv-open');
    placePerso(); persoOn = true; kickPerso();
    if (RM) { heroT0 = 0; drawHero(0); return; }
    const fly = heroFly(FLY_AT);
    heroT0 = performance.now() + FLY_AT; heroRedraw();
    await fly;
    await sleep(120);
    await typeIn(askA, ANSWER, 26, null, START);
    askS.classList.remove('wait');
  }
  /* Écran large et peu haut (1 920 × 900) : la colline se coupe sous les pieds de la commode (au plus 40 % de l'image)
     plutôt que de sortir de l'écran. Les pieds sont à 51 % de la hauteur de l'image. */
  const heroIn = $('.hero-in', hero);
  function fitHill() {
    if (innerWidth < 880) { hero.style.removeProperty('--hill-crop'); return; }
    const hh = (innerWidth * 346) / 1456;           // tiroir.css : .hill
    const free = innerHeight - (heroIn.offsetTop + heroIn.offsetHeight);
    hero.style.setProperty('--hill-crop', clamp(hh - free, 0, hh * 0.4).toFixed(1) + 'px');
  }
  fitHill();
  fontsReady.then(fitHill);
  /* chaque image est marquée prête une fois décodée (tiroir.css : elle se fond si elle arrive en retard) */
  $$('.hill img, .end-hill img, .end-commode').forEach((im) => {
    const ok = () => im.classList.add('is-ready');
    (im.decode ? im.decode() : Promise.resolve()).then(ok, ok);
  });
  const opened = Promise.race([
    Promise.all([fontsReady, hillImg.decode ? hillImg.decode().catch(() => {}) : Promise.resolve()]),
    sleep(1600),
  ]);
  opened.then(heroPlay);

  /* =========================================================
     Démo : la scène cobalt, la commode en trame, la fiche qui sort du tiroir et se pose
     ========================================================= */
  const stage = $('.stage');
  const scv = $('.stage-dots', stage);
  const sctx = scv.getContext('2d');
  const replyEl = $('.stage-reply', stage);
  const fiche = $('.fiche', stage);
  const fBody = $('.fiche-body', fiche);
  const fInk = $('.fiche-ink', fiche);
  const fctx = fInk.getContext('2d');
  const live = $('.reply-live');
  let lum = null; const LW = 1000, LH = 310, LX0 = 300, LY0 = 470;
  const DRW = { x0: 782, x1: 884, top: 583 };
  const COMMODE = { top: 497, ground: 760, cx: 781 };
  let G = null, formT0 = null, scanT0 = null, dotsActive = false;
  const im = new Image();
  im.src = 'img/commode-lum.webp';
  const lumReady = im.decode().then(() => {
    const c = document.createElement('canvas'); c.width = LW; c.height = LH;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, LW, LH).data;
    lum = new Float32Array(LW * LH);
    for (let i = 0; i < LW * LH; i++) lum[i] = px[i * 4] / 255;
    /* flou de 5 px (l'écart d'un point) : la crête et les bords des tiroirs se tramant en points qui diminuent, pas en marches */
    const tmp = new Float32Array(LW * LH), r = 2, n = 2 * r + 1;
    for (let y = 0; y < LH; y++) {
      let a = 0;
      for (let x = -r; x <= r; x++) a += lum[y * LW + clamp(x, 0, LW - 1)];
      for (let x = 0; x < LW; x++) { tmp[y * LW + x] = a / n; a += lum[y * LW + Math.min(LW - 1, x + r + 1)] - lum[y * LW + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < LW; x++) {
      let a = 0;
      for (let y = -r; y <= r; y++) a += tmp[clamp(y, 0, LH - 1) * LW + x];
      for (let y = 0; y < LH; y++) { lum[y * LW + x] = a / n; a += tmp[Math.min(LH - 1, y + r + 1) * LW + x] - tmp[Math.max(0, y - r) * LW + x]; }
    }
  }).catch(() => {});
  function sample(sx, sy) {
    const x = clamp(sx - LX0, 0, LW - 1.001), y = sy - LY0;
    if (y < 0 || y >= LH - 1) return 0;
    const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, i = iy * LW + ix;
    return (lum[i] * (1 - fx) + lum[i + 1] * fx) * (1 - fy) + (lum[i + LW] * (1 - fx) + lum[i + LW + 1] * fx) * fy;
  }
  function fillFiche(i, el) {
    const q = QA[i], f = el || fiche;
    $('.fiche-name', f).textContent = q.file;
    $('.fiche-path', f).textContent = q.path;
    $('.fiche-page', f).textContent = q.page;
    $('.fiche-h', f).textContent = q.h;
    const b = $('.fiche-body', f);
    b.textContent = ''; b.append(q.body[0]);
    const m = document.createElement('mark'); m.textContent = q.body[1]; b.append(m); b.append(q.body[2]);
  }
  /* Mesure la plus haute fiche et la plus haute réponse, pour une scène qui ne bouge pas d'une question à l'autre.
     Sur des copies hors champ : la fiche et la réponse en cours ne sont pas touchées. */
  function measure(fw, rw) {
    let fh = 0, rh = 0;
    const fc = fiche.cloneNode(true), rc = replyEl.cloneNode(false);
    fc.style.cssText = `visibility:hidden;transform:none;width:${fw}px`;
    rc.style.cssText = `visibility:hidden;${rw ? `width:${rw}px` : ''}`;
    stage.append(fc, rc);
    QA.forEach((q, i) => { fillFiche(i, fc); fh = Math.max(fh, fc.offsetHeight); rc.textContent = q.a; rh = Math.max(rh, rc.offsetHeight); });
    fc.remove(); rc.remove();
    return { fh, rh };
  }
  function layoutStage() {
    const mode = innerWidth >= 880 ? 'wide' : stage.clientWidth >= 600 ? 'mid' : 'narrow';
    const wide = mode === 'wide';
    const W = stage.clientWidth;
    let fw, s, ox, oy, land, H;
    if (wide) {
      fw = Math.round(Math.min(500, W * 0.4));
      fiche.style.setProperty('--fw', fw + 'px');
      stage.style.height = '';
      H = stage.clientHeight;
      const pad = clamp(W * 0.034, 28, 56);
      const m = measure(fw);
      var rbox = { r: replyEl.offsetLeft + replyEl.offsetWidth + 28, b: replyEl.offsetTop + m.rh + 24 };
      land = { x: W - fw - Math.max(32, W * 0.045), y: pad };
      if (W > 1400) land.x = Math.min(land.x, Math.round(W * 0.7 - fw / 2));   // grand écran : la fiche vient vers le centre
      /* la commode occupe la colonne de gauche, sous la réponse, posée sur le bas de la scène */
      const top = replyEl.offsetTop + m.rh + 40;
      s = Math.min((W * 0.29) / 206, (H - top) / (COMMODE.ground - COMMODE.top), (land.x - pad) * 0.62 / 206);
      const cx = W > 1400 ? W * 0.33 : Math.min(W * 0.26, (land.x - 24) / 2);
      ox = cx - COMMODE.cx * s; oy = H - COMMODE.ground * s;
    } else if (mode === 'mid') {
      /* tablette : la réponse en haut, la fiche à droite (une ligne de lecture normale), la commode à gauche */
      fw = Math.round(Math.min(460, W * 0.6));
      fiche.style.setProperty('--fw', fw + 'px');
      const m = measure(fw, W - 44);
      var rbox = { r: W, b: 24 + m.rh + 18 };
      const top = 24 + m.rh + 28;
      land = { x: W - fw - 24, y: top };
      const colW = land.x - 24;
      s = Math.min((colW * 0.92) / 206, 1.25);
      H = Math.round(Math.max(top + m.fh + 40, top + 30 + (COMMODE.ground - COMMODE.top + 30) * s));
      stage.style.height = H + 'px';
      ox = 12 + colW / 2 - COMMODE.cx * s; oy = H - (COMMODE.ground + 18) * s;
    } else {
      fw = W - 32;
      fiche.style.setProperty('--fw', fw + 'px');
      const m = measure(fw, W - 44);
      var rbox = { r: W, b: 24 + m.rh + 18 };
      const top = 24 + m.rh + 22;
      /* Au téléphone, la scène tient dans un écran : la réponse, la fiche, et la commode juste dessous
         (assez grande pour que la trame se lise ; la fiche ne la recouvre pas). */
      s = Math.min((W * 0.56) / 206, 1.1);
      const comTop = top + m.fh + 10;
      H = Math.round(comTop + 283 * s);
      stage.style.height = H + 'px';
      ox = W * 0.5 - COMMODE.cx * s; oy = comTop - COMMODE.top * s;
      land = { x: 16, y: top };
    }
    const d = DPR();
    scv.width = Math.round(W * d); scv.height = Math.round(H * d);
    const fh = fiche.offsetHeight;
    const lineY = oy + DRW.top * s, dx = ox + ((DRW.x0 + DRW.x1) / 2) * s;
    const s0 = ((DRW.x1 - DRW.x0) * s * 0.9) / fw;
    G = { W, H, s, ox, oy, fw, fh, lineY, dx, s0, land, rbox, mode, pitch: mode !== 'narrow' ? clamp(W / 190, 4.6, 6.6) : 4.2 };
    shadowEl.style.width = fw + 'px'; shadowEl.style.height = fh + 'px';
    if (pose.rest || pose.inside) applyPose();
  }
  /* Les points de la commode, calculés une fois par mise en page (position, taille, délai d'apparition) ;
     à chaque image, seuls les points de la façade du tiroir (qui coulisse, que l'onde parcourt) sont recalculés. */
  let DOTS = null;
  const procL = (L) => Math.pow(clamp((L - 0.08) / 0.84, 0, 1), 1.9) * 0.95 + 0.05;
  const inDrawer = (ix, iy) => ix > 740 && ix < 905 && iy > 566 && iy < 628;
  function buildDots() {
    const { W, H, s, ox, oy, pitch } = G;
    const X = [], Y = [], Q = [], A = [], Z = [];
    const x0 = pitch / 2, x1 = W;
    const y0 = Math.max(pitch / 2, oy + LY0 * s), y1 = Math.min(H, oy + (LY0 + LH) * s);
    let row = Math.floor((y0 - pitch / 2) / pitch);
    for (let y = pitch / 2 + row * pitch; y < y1; y += pitch, row++) {
      const off = row % 2 ? pitch / 2 : 0;
      const xs = pitch / 2 + off + Math.floor((x0 - pitch / 2 - off) / pitch) * pitch;
      for (let x = xs; x < x1; x += pitch) {
        const ix = (x - ox) / s, iy = (y - oy) / s, z = inDrawer(ix, iy);
        const L = sample(ix, iy);
        if (!z && L < 0.06) continue;
        X.push(x); Y.push(y); Z.push(z ? 1 : 0); Q.push(L < 0.06 ? 0 : Math.sqrt(procL(L)));
        A.push(Math.hypot(x - G.dx, y - G.lineY) / 900 + hash(x, y) * 0.18);
      }
    }
    DOTS = { G, n: X.length, x: Float32Array.from(X), y: Float32Array.from(Y), q: Float32Array.from(Q), at: Float32Array.from(A), z: Uint8Array.from(Z) };
  }
  function drawStage(now) {
    if (!lum || !G) return false;
    if (!DOTS || DOTS.G !== G) buildDots();
    const d = DPR(), { s, ox, oy, pitch } = G, D = DOTS;
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, scv.width, scv.height);
    sctx.setTransform(d, 0, 0, d, 0, 0);
    sctx.fillStyle = '#fff';
    const el = formT0 == null ? -1 : RM ? 1e9 : (now - formT0) / 1000;
    const sc = scanT0 ? clamp((now - scanT0) / 900, 0, 1) : 2;
    const fl = ox + DRW.x0 * s, fr = ox + DRW.x1 * s, ft = G.lineY, fb = G.lineY + 34 * s;
    const k = pitch * 0.48;                          // les points pleins se touchent presque, sans se fondre
    let active = sc <= 1;
    sctx.beginPath();
    for (let i = 0; i < D.n; i++) {
      const u = (el - D.at[i]) / 0.45;
      if (u < 1) active = true;
      if (u <= 0) continue;
      const x = D.x[i], y = D.y[i];
      let q = D.q[i];
      if (D.z[i]) {
        const ix = (x - ox) / s, iy = (y - oy) / s;
        let L;
        if (drawerO > 0.002) {
          const sx = ix - drawerO * DRAWER.dx, sy = iy - drawerO * DRAWER.dy;
          const inSrc = sx > 748 && sx < 892 && sy > 572 && sy < 621;
          const inOrig = ix > 748 && ix < 892 && iy > 572 && iy < 621;
          L = inSrc ? sample(sx, sy) : inOrig ? 0.1 : sample(ix, iy);
        } else L = sample(ix, iy);
        if (L < 0.06) continue;
        q = Math.sqrt(procL(L));
        if (sc <= 1 && x > fl && x < fr && y > ft - 4 && y < fb) {
          const wave = Math.exp(-Math.pow((x - fl) / (fr - fl) - sc * 1.3 + 0.15, 2) / 0.012);
          q = Math.sqrt(Math.min(1, q * q * (1 - 0.55 * wave)));
        }
      }
      const r = k * q * (u < 1 ? easeOut(u) : 1);
      sctx.moveTo(x + r, y); sctx.arc(x, y, r, 0, 6.283);
    }
    sctx.fill();
    if (drawTrail(now)) active = true;
    return active;
  }
  let stageVisible = false;
  let dirty = false;
  /* La trace : trois fantômes en trame laissés par la fiche pendant son vol, qui s'effacent (la grammaire du hero). */
  let trail = [], ficheLay = null, ficheSpr = null;
  const TRAIL_MS = 1100;
  function ficheLayout() {
    const w = G.fw, h = G.fh, lines = [];
    lines.push({ x0: 52, x1: w * 0.62, y: 26, hh: 4 }, { x0: 52, x1: w * 0.4, y: 44, hh: 3.5 }, { kind: 'rule', x0: 22, x1: w - 22, y: 64, hh: 1.2 }, { x0: 22, x1: w * 0.45, y: 86, hh: 4 });
    for (let y = 114; y < h - 22; y += 28) lines.push({ x0: 22, x1: y + 28 >= h - 22 ? w * 0.5 : w - 24, y, hh: 4 });
    return ghostLayout(w, h, lines, 29);
  }
  function drawTrail(now) {
    if (!trail.length || RM) return false;
    let alive = false;
    sctx.fillStyle = '#fff';
    for (const g of trail) {
      const age = now - g.t;
      if (age >= TRAIL_MS) continue;
      alive = true;
      const a = 0.62 * (1 - easeOut(age / TRAIL_MS)) * smooth(0, 120, age);
      ghostPut(sctx, ficheSpr, g.x, g.y, g.sc, g.rot, a);
    }
    if (!alive) trail = [];
    return alive;
  }
  function kickStage() {
    if (dotsActive) return; dotsActive = true;
    loop((now) => {
      const a = drawStage(now);
      const go = (a || dirty) && stageVisible;
      dirty = false;
      if (!go) dotsActive = false;
      return go;
    });
  }
  function markDirty() { dirty = true; kickStage(); }

  /* =========================================================
     La fiche : une ligne de temps continue, en trois gestes.
     « Rangement » : la fiche se soulève, revient au-dessus du tiroir en rapetissant, plonge dans la fente ; le tiroir s'ouvre pour la recevoir.
     « Recherche » : une onde parcourt la façade du tiroir.
     « Coulisse » : la fiche sort droit de la fente puis part sur une courbe, sans arrêt entre les deux (chemin paramétré
     à la longueur d'arc), s'incline selon sa vitesse, prend de l'ombre en l'air, se pose sans rebond ; le tiroir se referme.
     Le texte est rendu à pleine taille pendant tout le trajet (calque créé à l'échelle 1), pour ne jamais passer de flou à net.
     ========================================================= */
  function cubicBezier(x1, y1, x2, y2) {
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const m = 1 - t;
        const fx = 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t - x;
        const dfx = 3 * m * m * x1 + 6 * m * t * (x2 - x1) + 3 * t * t * (1 - x2);
        if (Math.abs(fx) < 1e-5 || Math.abs(dfx) < 1e-6) break;
        t = clamp(t - fx / dfx, 0, 1);
      }
      const m = 1 - t;
      return 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t;
    };
  }
  const E = {
    vol: cubicBezier(0.45, 0, 0.2, 1),        // sortie et vol : départ souple, arrivée posée
    retour: cubicBezier(0.45, 0, 0.6, 0.9),   // retour : la fiche accélère puis entre dans la fente sans s'arrêter
    plonge: cubicBezier(0.55, 0, 0.85, 0.55), // la fiche tombe dans la fente
    ouvre: cubicBezier(0.2, 0.7, 0.2, 1),
    ferme: cubicBezier(0.55, 0, 0.3, 1),
  };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /* Courbe de Bézier cubique parcourue à vitesse réglée par la longueur d'arc : d de 0 à 1. */
  function curve(p0, p1, p2, p3) {
    const N = 64, pts = [], len = [0];
    for (let i = 0; i <= N; i++) {
      const t = i / N, m = 1 - t;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
      ]);
      if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const T = len[N] || 1;
    const at = (d) => {
      const target = clamp(d, 0, 1) * T;
      let i = 1;
      while (i < N && len[i] < target) i++;
      const f = (target - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
      return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
    };
    at.total = T;
    return at;
  }

  const shadowEl = $('.fiche-shadow', stage);
  /* La pose courante de la fiche, par son centre (la fiche grandit et tourne autour de son centre) ;
     « rest » : posée, en pixels entiers, sans calque. */
  const pose = { x: 0, y: 0, sc: 1, rot: 0, clip: 0, lift: 0, vis: false, rest: false, inside: true };
  let drawerO = 0;               // ouverture supplémentaire du tiroir (0 : comme la photo, 1 : tiré de 10 px d'image)
  const DRAWER = { dx: 10, dy: 3 };
  /* La fente : le centre horizontal du tiroir et la ligne d'où sort la fiche. */
  const slotAt = (o) => ({ x: G.dx + o * DRAWER.dx * G.s, y: G.lineY + o * DRAWER.dy * G.s });
  const slot = () => slotAt(drawerO);
  const landC = () => ({ x: G.land.x + G.fw / 2, y: G.land.y + G.fh / 2 });
  /* Vitesse horizontale le long d'un trajet minuté, rapportée à son maximum : l'inclinaison suit une cloche, sans plafond ni à-coup. */
  function tilt(xAt, dur) {
    const v = (p) => (xAt(p + 0.004) - xAt(p - 0.004)) / (0.008 * dur);
    let vmax = 1e-6;
    for (let i = 0; i <= 60; i++) vmax = Math.max(vmax, Math.abs(v(i / 60)));
    return (p) => v(p) / vmax;
  }
  const POSE_LOG = /[?&]bench/.test(location.search) ? (window.__pose = []) : null;
  function applyPose() {
    if (!G) return;
    fiche.style.visibility = pose.vis ? 'visible' : 'hidden';
    if (POSE_LOG) { const L = landC(); POSE_LOG.push([performance.now(), pose.rest ? L.x : pose.x, pose.rest ? L.y : pose.y, pose.rest ? 1 : pose.sc, pose.rest ? 0 : pose.rot, pose.vis ? 1 : 0]); }
    if (pose.rest) {
      fiche.style.transform = `translate(${Math.round(G.land.x)}px, ${Math.round(G.land.y)}px)`;
      fiche.style.clipPath = 'none';
      fiche.style.willChange = 'auto';
      shadowEl.style.opacity = '0';
      return;
    }
    const tx = pose.x - G.fw / 2, ty = pose.y - G.fh / 2;
    fiche.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${pose.rot.toFixed(3)}deg) scale(${pose.sc.toFixed(4)})`;
    fiche.style.clipPath = pose.clip > 0.5 ? `inset(0 0 ${pose.clip.toFixed(1)}px 0)` : 'none';
    const L = pose.vis ? pose.lift : 0;
    shadowEl.style.opacity = (0.42 * L).toFixed(3);
    shadowEl.style.transform = `translate(${(tx + 4 * L * pose.sc).toFixed(2)}px, ${(ty + (10 + 34 * L) * pose.sc).toFixed(2)}px) rotate(${pose.rot.toFixed(3)}deg) scale(${(pose.sc * (0.97 - 0.04 * L)).toFixed(4)})`;
  }
  /* Rogne le bas de la fiche sous la ligne de la fente (en pixels de la fiche, avant l'échelle). */
  const clipAt = (cy, sc, line) => Math.max(0, (cy + (G.fh * sc) / 2 - line) / sc);

  let drawerTok = 0;
  function drawerTo(target, ms, ease) {
    const my = ++drawerTok, from = drawerO;
    if (RM) { drawerO = target; markDirty(); return Promise.resolve(); }
    return tween(ms, (p) => { drawerO = lerp(from, target, ease(p)); markDirty(); }, () => my === drawerTok);
  }

  /* Rangement : de la pose courante jusqu'au fond du tiroir. */
  async function rangement(alive) {
    if (!pose.vis || pose.inside) { pose.vis = false; pose.inside = true; applyPose(); return true; }
    const L0 = landC();
    const c = pose.rest ? { x: L0.x, y: L0.y, sc: 1, rot: 0, lift: 0 } : { ...pose };
    pose.rest = false; pose.clip = 0;
    fiche.style.willChange = 'transform';
    drawerTo(1, 520, E.ouvre);
    const s = slotAt(1), half = (G.fh * G.s0) / 2;
    const yOut = s.y - half - 8, yIn = s.y + half + 2;
    if (Math.abs(c.sc - G.s0) < 0.01 && c.y > yOut - 4 && Math.abs(c.x - s.x) < 20) {
      const ok = await tween(160, (p) => {
        const y = lerp(c.y, yIn, E.plonge(p));
        pose.x = lerp(c.x, s.x, p); pose.y = y; pose.sc = G.s0; pose.rot = 0; pose.lift = 0; pose.clip = clipAt(y, G.s0, s.y); applyPose();
      }, alive);
      if (!ok) return false;
      pose.vis = false; pose.inside = true; applyPose();
      return true;
    }
    /* un seul trajet : lever, revenir au-dessus du tiroir, descendre droit dans la fente */
    const path = curve([c.x, c.y], [c.x, c.y - 40], [s.x, yOut - 70], [s.x, yIn]);
    const dur = clamp(420 + path.total * 0.5, 560, 900);
    const xAt = (t) => path(E.retour(clamp(t, 0, 1)))[0];
    const tl = tilt(xAt, dur);
    const into = (2 * half + 10) / path.total;   // fin du trajet passée dans la fente
    const ok = await tween(dur, (p) => {
      const d = E.retour(p);
      const [x, y] = path(d);
      pose.x = x; pose.y = y;
      pose.sc = lerp(c.sc, G.s0, smooth(0, 1 - into * 1.6, d));
      pose.rot = lerp(c.rot, 0, smooth(0, 0.8, d)) + 2 * tl(p);
      pose.lift = Math.max(c.lift * (1 - d), 0.7 * Math.sin(Math.PI * smooth(0, 1 - into * 1.2, d)));
      pose.clip = clipAt(y, pose.sc, s.y);
      applyPose();
    }, alive);
    if (!ok) return false;
    pose.vis = false; pose.inside = true; applyPose();
    return true;
  }

  /* Coulisse : la fiche sort de la fente et vient se poser. Au bureau, elle arrive de la gauche ; au téléphone, d'en dessous. */
  async function coulisse(alive) {
    const s = slot(), L = landC(), half = (G.fh * G.s0) / 2;
    const yIn = s.y + half + 2, yOut = s.y - half;
    const wide = G.mode !== 'narrow';
    const rise = Math.max(70, 0.32 * Math.abs(L.y - yOut));
    const path = curve(
      [s.x, yIn],
      [s.x, yOut - rise],
      wide ? [L.x + 0.32 * (s.x - L.x), L.y + 0.06 * (yOut - L.y)] : [L.x, L.y + 0.3 * (yOut - L.y)],
      [L.x, L.y],
    );
    const dur = clamp(1000 + path.total * 0.55, 1250, 1750);
    const xAt = (t) => path(E.vol(clamp(t, 0, 1)))[0];
    const tl = tilt(xAt, dur);
    const out = (2 * half + 4) / path.total;     // part du chemin parcourue dans la fente
    pose.vis = true; pose.inside = false; pose.rest = false;
    fiche.style.willChange = 'transform';
    let closing = false;
    const marks = [0.28, 0.52, 0.76];
    ficheLay = ficheLayout(); ficheSpr = ghostSprite(ficheLay, 1, 0.72, 5); trail = [];
    const ok = await tween(dur, (p) => {
      const d = E.vol(p);
      const [x, y] = path(d);
      pose.x = x; pose.y = y;
      pose.sc = lerp(G.s0, 1, smooth(out * 1.15, 0.94, d));
      pose.rot = 2.2 * tl(p) * smooth(out * 0.8, out * 3, d);
      pose.lift = Math.pow(Math.sin(Math.PI * smooth(out * 0.8, 1, d)), 0.85);
      pose.clip = d < out * 1.2 ? clipAt(y, pose.sc, s.y) : 0;
      applyPose();
      while (marks.length && d >= marks[0]) { marks.shift(); trail.push({ x, y, sc: pose.sc, rot: pose.rot * Math.PI / 180, t: performance.now() }); markDirty(); }
      if (!closing && d > out * 1.6) { closing = true; drawerTo(0, 900, E.ferme); }
    }, alive);
    if (!ok) return false;
    pose.rest = true; pose.lift = 0; applyPose();
    return true;
  }

  let hl = null, hlP = 0;
  function buildHL() {
    const mark = $('mark', fiche);
    if (!mark) return null;
    const prev = fiche.style.transform; fiche.style.transform = 'none';
    const cr = fiche.getBoundingClientRect();
    const rects = [...mark.getClientRects()].filter((r) => r.width > 2).map((r) => ({ x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }));
    fiche.style.transform = prev;
    return crayon(rects, 17);
  }
  const drawHL = (p) => { hlP = p; drawCrayon(fctx, fInk, fiche.offsetWidth, fiche.offsetHeight, hl, p); };
  /* Le texte de la fiche change de taille (police qui arrive, largeur) : on remesure le crayon. */
  new ResizeObserver(() => { if (hl) { hl = buildHL(); drawHL(hlP); } }).observe(fBody);

  const qs = $$('.q');
  let tok = 0;
  async function askDemo(i) {
    const my = ++tok, alive = () => my === tok;
    qs.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    stage.setAttribute('aria-busy', 'true');
    const q = QA[i];
    live.textContent = `${q.a} Source${NB}: ${q.file}, ${q.page}.`;
    if (RM) {
      fillFiche(i); replyEl.textContent = q.a; layoutStage();
      pose.vis = true; pose.inside = false; pose.rest = true; applyPose(); formT0 = 0; markDirty();
      requestAnimationFrame(() => { hl = buildHL(); drawHL(1); stage.removeAttribute('aria-busy'); });
      return;
    }
    replyEl.style.transition = 'opacity .3s ease'; replyEl.style.opacity = '.3';
    if (!(await rangement(alive))) return;
    fillFiche(i); hl = null; drawHL(0);
    G.fh = fiche.offsetHeight; shadowEl.style.height = G.fh + 'px';
    replyEl.style.opacity = '1';
    const typing = typeIn(replyEl, q.a, 30, alive);
    scanT0 = performance.now(); markDirty();
    if (drawerO < 0.99) drawerTo(1, 240, E.ouvre);
    await sleep(110);
    if (!alive()) return;
    if (!(await coulisse(alive))) return;
    await sleep(140);
    if (!alive()) return;
    hl = buildHL();
    await tween(300 + hl.total * 2, (p) => drawHL(p), alive);
    if (typing) await typing;
    if (alive()) stage.removeAttribute('aria-busy');
  }
  qs.forEach((b, i) => b.addEventListener('click', () => {
    /* Au téléphone, la scène est sous les questions : la réponse s'écrirait hors de l'écran. On amène la scène
       (la réponse en haut de l'écran) quand sa réponse est sous la moitié de l'écran (passe mobile du 2026-11-05). */
    if (innerWidth < 880 && stage.clientWidth < 600) {
      const top = replyEl.getBoundingClientRect().top;
      if (top > innerHeight * 0.5) scrollTo({ top: scrollY + stage.getBoundingClientRect().top - 16, behavior: RM ? 'auto' : 'smooth' });
    }
    askDemo(i);
  }));
  Promise.all([fontsReady, lumReady]).then(() => {
    /* Au repos, la scène montre déjà une réponse : la fiche est posée et lisible. La sortie du tiroir se joue à chaque question choisie. */
    fillFiche(0); replyEl.textContent = QA[0].a; layoutStage();
    pose.vis = true; pose.inside = false; pose.rest = true; applyPose();
    live.textContent = `${QA[0].a} Source${NB}: ${QA[0].file}, ${QA[0].page}.`;
    hl = buildHL(); drawHL(RM ? 1 : 0); drawStage(performance.now());
    new IntersectionObserver((es) => { stageVisible = es[0].isIntersecting; if (stageVisible && formT0 != null) kickStage(); }).observe(stage);
    onView(stage, 0.25, async () => {
      formT0 = performance.now(); kickStage();
      if (RM) return;
      const my = tok;
      await sleep(500);
      if (my !== tok) return;
      hl = buildHL();
      tween(300 + hl.total * 2, (p) => drawHL(p), () => my === tok);
    });
    let lastW = stage.clientWidth;
    new ResizeObserver(() => {
      if (stage.clientWidth === lastW && innerWidth >= 880) { layoutStage(); drawStage(performance.now()); return; }
      lastW = stage.clientWidth; layoutStage(); drawStage(performance.now()); if (hl) { hl = buildHL(); drawHL(hlP); }
    }).observe(stage);
  });

  /* =========================================================
     « Je ne trouve pas » : Tiroir tire les tiroirs qui lui sont ouverts, en cascade, feuillette leurs fiches,
     les referme ; les tiroirs fermés à clé ne bougent pas. Puis il écrit qu'il ne trouve pas.
     ========================================================= */
  const keys = $('.keys');
  const meuble = $('.meuble', keys);
  const nopeA = $('.nope-a', keys);
  const NOPE = nopeA.textContent;
  const casiers = $$('.casier.is-ouvert', keys);
  const AJAR = 0, PULL = 30;                       // tiroir.css : --ajar, --pull
  /* Le haut des fiches dans un tiroir : vues d'en haut et de face, leurs tranches s'empilent vers le fond, chacune avec
     son onglet (à gauche, au milieu, à droite, comme dans un vrai fichier), entre les côtés du tiroir.
     Un canevas par tiroir (dessiné quand le tiroir bouge) : pas de dizaines d'éléments à composer à l'arrivée du meuble. */
  const NCARD = 10;
  casiers.forEach((c, k) => {
    const fond = document.createElement('div'); fond.className = 'casier-fond';
    const cv = document.createElement('canvas'); cv.className = 'casier-fiches';
    fond.append(cv);
    const ombre = document.createElement('i'); ombre.className = 'casier-ombre';
    c.prepend(fond, ombre);
    const R = rng(41 + k * 7), cards = [];
    for (let j = 0; j < NCARD; j++) {
      cards.push({ y: 42.6 - Math.pow(j / (NCARD - 1), 0.82) * 38, ins: 4 + j * 0.35, tx: [9, 41, 72][(j + k) % 3] + (R() - 0.5) * 6, tw: 15 + R() * 4, op: lerp(0.92, 0.38, j / (NCARD - 1)) });
    }
    c._cards = cards; c._fiches = cv; c._ombre = ombre; c._face = $('.casier-face', c); c._t0 = null;
  });
  function drawCards(c, now) {
    const cv = c._fiches, w = cv.clientWidth, h = 44, d = DPR();
    if (!w) return false;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = '#fff';
    x.globalAlpha = 0.42; x.fillRect(0, 0, 1, h); x.fillRect(w - 1, 0, 1, h);     // les côtés du tiroir
    let active = false;
    for (let j = NCARD - 1; j >= 0; j--) {          // du fond vers l'avant
      const cd = c._cards[j];
      let lift = 0, op = cd.op;
      if (c._t0 != null) {
        const t = (now - c._t0 - j * 46) / 340;
        if (t < 1) active = true;
        if (t > 0 && t < 1) { const e = t < 0.38 ? easeOut(t / 0.38) : 1 - easeIO((t - 0.38) / 0.62); lift = 3.5 * e; op = lerp(cd.op, 1, e); }
      }
      const y = cd.y - lift, x0 = (w * cd.ins) / 100, tx = (w * cd.tx) / 100;
      x.globalAlpha = op;
      x.fillRect(x0, y - 0.4, w - 2 * x0, 1.5);       // la tranche
      x.fillRect(tx, y - 3, (w * cd.tw) / 100, 2.6);  // l'onglet
    }
    x.globalAlpha = 1;
    return active;
  }
  const drawAllCards = () => casiers.forEach((c) => drawCards(c, performance.now()));
  requestAnimationFrame(drawAllCards);
  new ResizeObserver(drawAllCards).observe(meuble);
  /* La réponse s'écrit dans sa place réservée (le texte entier, invisible, tient la hauteur : rien ne bouge en dessous). */
  let nopeTyped = nopeA;
  if (!RM) {
    nopeA.textContent = '';
    const full = document.createElement('span'); full.className = 'nope-plein'; full.textContent = NOPE;
    nopeTyped = document.createElement('span'); nopeTyped.className = 'nope-tape';
    nopeA.append(full, nopeTyped);                  // pas de curseur seul : il arrive avec la frappe
  }
  /* Tirer ou repousser un tiroir : la façade, les fiches et l'ombre bougent ensemble (transformations composées, sans calcul par image). */
  function pull(c, out, ms, ease) {
    const A = `translateY(${AJAR}px)`, B = `translateY(${PULL}px)`, Bs = B + ' scale(1.035)';
    const o = { duration: ms, easing: ease, fill: 'forwards' };
    c._face.animate([{ transform: out ? A : Bs }, { transform: out ? Bs : A }], o);
    c._fiches.animate([{ transform: out ? A : B }, { transform: out ? B : A }], o);
    return c._ombre.animate([{ transform: out ? A : B, opacity: out ? 0 : 0.9 }, { transform: out ? B : A, opacity: out ? 0.9 : 0 }], o).finished;
  }
  function riffle(c) {
    /* Tiroir feuillette : chaque fiche se soulève un peu, de l'avant vers le fond */
    c._t0 = performance.now();
    loop((now) => drawCards(c, now));
    return 340 + (NCARD - 1) * 46;
  }
  let firstClose = null;
  const firstClosing = new Promise((r) => { firstClose = r; });
  async function readOne(c, i) {
    await sleep(i * 150);
    c.classList.add('is-tire');
    drawCards(c, performance.now());
    await pull(c, true, 440, 'cubic-bezier(.16, .84, .24, 1)');
    c.classList.add('is-lu');
    await sleep(riffle(c) - 120);
    c.classList.add('is-lu-out');
    if (i === 0) firstClose();                       // la réponse commence dès que le premier tiroir se referme
    await pull(c, false, 400, 'cubic-bezier(.55, 0, .3, 1)');
    [c._face, c._fiches, c._ombre].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));   // retour au repos (tiroir.css)
    c.classList.remove('is-tire', 'is-lu', 'is-lu-out');
    c._t0 = null;
  }
  onView(meuble, 0.6, () => fontsReady.then(async () => {
    if (RM) return;
    await sleep(250);
    casiers.forEach(readOne);
    await firstClosing;
    typeIn(nopeTyped, NOPE, 18);
  }));

  /* ---------- Tarif : le mois offert, surligné au crayon ---------- */
  const gift = $('.gift'), gcv = $('.gift-ink'), gctx = gcv.getContext('2d');
  let giftHL = null;
  function buildGift() {
    const cr = gcv.getBoundingClientRect();
    const rects = [...gift.getClientRects()].map((r) => ({ x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }));
    return crayon(rects, 31);
  }
  onView(gift, 1, () => fontsReady.then(async () => {
    giftHL = buildGift();
    if (RM) { drawCrayon(gctx, gcv, gcv.offsetWidth, gcv.offsetHeight, giftHL, 1); return; }
    await sleep(300);
    tween(300 + giftHL.total * 2.4, (p) => drawCrayon(gctx, gcv, gcv.offsetWidth, gcv.offsetHeight, giftHL, p));
  }));

  /* Une police qui arrive après coup déplace les lignes : on remesure le crayon. */
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => requestAnimationFrame(() => {
    if (hl) { hl = buildHL(); drawHL(hlP); }
    if (giftHL) { giftHL = buildGift(); drawCrayon(gctx, gcv, gcv.offsetWidth, gcv.offsetHeight, giftHL, 1); }
  }));
  let rz = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      fitHill(); buildHero(); heroRedraw(); placePerso();
      if (giftHL) { giftHL = buildGift(); drawCrayon(gctx, gcv, gcv.offsetWidth, gcv.offsetHeight, giftHL, 1); }
    });
  });

  /* =========================================================
     Inscription : aucun envoi. Erreur, chargement, succès.
     ========================================================= */
  const form = $('.signup');
  const field = form.email, submit = $('button', form), msg = $('.signup-msg', form), btnLabel = $('.btn-label', submit);
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const wait = document.createElement('span'); wait.className = 'btn-wait'; wait.setAttribute('aria-hidden', 'true'); wait.innerHTML = '<i></i><i></i><i></i>';
  submit.append(wait);
  function say(text, kind) {
    msg.className = 'signup-msg' + (kind ? ' is-' + kind : '');
    msg.textContent = '';
    if (kind === 'done') { const s = document.createElement('span'); s.className = 'crayon'; s.textContent = text; msg.append(s); }
    else msg.textContent = text;
  }
  function invalid(text) {
    field.setAttribute('aria-invalid', 'true');
    say(text, 'error');
    field.focus();
  }
  field.addEventListener('input', () => {
    if (field.getAttribute('aria-invalid') === 'true' && EMAIL.test(field.value.trim())) { field.removeAttribute('aria-invalid'); say('', ''); }
  });
  form.addEventListener('focusin', () => form.classList.add('is-used'), { once: true });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.classList.contains('is-busy') || submit.classList.contains('is-done')) return;
    const v = field.value.trim();
    if (!v) return invalid(`Indiquez votre adresse e-mail.`);
    if (!EMAIL.test(v)) return invalid(`Cette adresse est incomplète. Elle doit ressembler à nom@entreprise.fr.`);
    field.removeAttribute('aria-invalid');
    submit.classList.add('is-busy'); submit.setAttribute('aria-disabled', 'true'); btnLabel.textContent = 'Un instant';
    field.readOnly = true; say('', '');
    await sleep(RM ? 300 : 1100);
    submit.classList.remove('is-busy');
    submit.classList.add('is-done'); btnLabel.textContent = `C’est noté`;
    field.classList.add('is-done');
    say(`Merci. Tiroir est une marque de démonstration du studio Topiary${NB}: vous ne recevrez aucun e-mail.`, 'done');
  });

  /* =========================================================
     Pied de page : les liens de section mènent aux sections ; les autres ne mènent nulle part,
     et le disent.
     ========================================================= */
  const note = $('.end-note');
  let noteT = 0;
  $$('[data-fictif]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    clearTimeout(noteT);
    note.classList.remove('is-on');
    note.textContent = `${a.textContent.trim()}${NB}: cette page n’existe pas. Tiroir est une marque de démonstration du studio Topiary.`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      note.classList.add('is-on');
      /* au téléphone, la note sort sous la dernière colonne, souvent sous le bord de l'écran : on la montre entière
         (passe mobile du 2026-11-05) */
      if (innerWidth < 880) {
        const ty = new DOMMatrix(getComputedStyle(note).transform).m42;   // la note part décalée : sa place finale
        const over = note.getBoundingClientRect().bottom - ty + 16 - innerHeight;
        if (over > 0) scrollBy({ top: over, behavior: RM ? 'auto' : 'smooth' });
      }
    }));
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && note.classList.contains('is-on')) note.classList.remove('is-on'); });
  /* =========================================================
     « Une question sur Tiroir ? » : la page est un dossier. Tiroir y répond avec une phrase de la page,
     et « Lire le passage » y mène et le souligne au crayon. Sinon, il dit qu'il ne trouve pas.
     ========================================================= */
  const fForm = $('.faq-card'), fIn = $('#faq-q'), fA = $('.faq-a'), fLive = $('#faq-a');
  const fCite = $('.faq-cite'), fSrc = $('.faq-src'), fWhere = $('.faq-where'), fEx = $('.faq-ex-row'), fLead = $('.faq-ex-lead');
  const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = (t) => norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !/^\d+$/.test(w));
  const SECTION = (n) => `Sur cette page, section «${NB}${n}${NB}»`;
  /* Tiroir répond seulement avec les phrases de la page, citées mot pour mot. Un mot fort suffit ; les mots faibles
     ne comptent que pour moitié. Un mot de la question absent de la page et inconnu de l'index : « Je ne trouve pas ». */
  const KB = [
    { s: ['prix', 'cout', 'tarif', 'cher', 'euro', 'payer', 'abonn', 'factur', 'budget', 'personne'], w: ['combien'], ids: ['p-prix'], where: SECTION('Tarif') },
    { s: ['essai', 'gratuit', 'offert', 'tester', 'essayer'], w: ['premier', 'mois'], ids: ['p-essai'], where: SECTION('Tarif') },
    { s: ['drive', 'google', 'sharepoint', 'dropbox', 'secur', 'confidenti', 'acces', 'prive', 'autoris', 'permission', 'ouvr', 'brancher', 'connect', 'compatib', 'lit', 'lire', 'lesquel'], w: ['dossier', 'fichier', 'voir', 'donnee'], ids: ['p-acces', 'p-sources'], where: SECTION('Vos dossiers') },
    { s: ['tromp', 'erreur', 'fiable', 'invent', 'verifi', 'preuve', 'cite', 'citation', 'source', 'halluc', 'exact'], w: ['passage', 'juste'], ids: ['p-preuve'], where: SECTION('Vos dossiers') },
    { s: ['fonctionn', 'marche', 'sert', 'utilis'], w: ['comment', 'quoi', 'question', 'repond'], ids: ['p-comment'], where: 'Sur cette page, en haut' },
    { s: ['fictif', 'fictive', 'vrai', 'vraie', 'reel', 'existe', 'topiary', 'demonstration', 'studio', 'entreprise', 'societe', 'marque', 'derriere', 'concu', 'createur'], w: [], ids: ['p-fictif'], where: 'Sur cette page, en bas' },
  ];
  const STOP = new Set(('le la les un une des du de et ou est ce ca cela ceci que qui quoi quel quelle quels quelles comment combien pourquoi quand '
    + 'il elle ils elles on je tu vous nous me te se mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ya ai as avez avons ont '
    + 'en dans sur pour par avec sans pas ne plus tres tiroir peut peux pouvez puis puisje faire fait etre sont suis es avoir aux au si oui non '
    + 'donc mais alors aussi bien tout tous toute toutes cette cet ces lui elle eux moi toi il-y-a est-ce ils-elles a').split(' '));
  const stem = (w, k) => (k.length <= 3 ? w === k : w.startsWith(k));
  let VOCAB = null;
  function vocab() {
    if (VOCAB) return VOCAB;
    VOCAB = new Set();
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const e = n.parentElement;
      if (!e || e.closest('[aria-hidden="true"], script, style, .faq-card')) continue;
      words(n.data).forEach((w) => VOCAB.add(w));
    }
    return VOCAB;
  }
  function lookup(q) {
    const ws = words(q), V = vocab();
    let best = null, top = 0;
    for (const w of ws) {
      const known = STOP.has(w) || V.has(w) || KB.some((e) => e.s.some((k) => stem(w, k)) || e.w.some((k) => stem(w, k)));
      if (!known && w.length >= 3) return null;              // un mot que la page ne contient pas
    }
    for (const e of KB) {
      let sc = 0, strong = false;
      for (const w of ws) {
        if (e.s.some((k) => stem(w, k))) { sc += 1; strong = true; } else if (e.w.some((k) => stem(w, k))) sc += 0.5;
      }
      if (strong && sc >= 1 && sc > top) { top = sc; best = e; }
    }
    return best;
  }
  const clean = (t) => t.replace(/[ \t\r\n]+/g, ' ').trim().replace(/(\d)\s*€/g, `$1${NB}€`);
  const quoteOf = (e) => clean(e.ids.map((id) => document.getElementById(id).textContent).join(' '));
  if (/[?&]bench/.test(location.search)) window.__tiroirAsk = (q) => { const h = lookup(q); return h ? quoteOf(h) : '—'; };
  let faqTok = 0, lastHit = null;
  function showExamples(lead) { fLead.textContent = lead; fEx.hidden = false; }
  async function answer(q) {
    const my = ++faqTok, alive = () => my === faqTok;
    const hit = q.trim() ? lookup(q) : null;
    lastHit = hit;
    fCite.classList.add('is-off');
    fEx.hidden = true;
    fA.classList.toggle('is-nope', !hit);
    const text = !q.trim() ? `Écrivez votre question dans le champ.`
      : hit ? `«${NB}${quoteOf(hit)}${NB}»` : 'Je ne trouve pas cette information sur cette page.';
    fLive.textContent = hit ? `${text} ${hit.where}.` : text;
    if (RM) fA.textContent = text;
    else { fA.textContent = ''; await sleep(220); if (!alive() || !(await typeIn(fA, text, 16, alive))) return; }
    if (!alive()) return;
    if (!hit) { showExamples(`Essayez plutôt${NB}:`); return; }
    fSrc.href = '#' + hit.ids[0];
    fWhere.textContent = hit.where;
    fCite.classList.remove('is-off');
  }
  fForm.addEventListener('focusin', () => fForm.classList.add('is-used'), { once: true });
  fForm.addEventListener('submit', (e) => { e.preventDefault(); answer(fIn.value); if (!fIn.value.trim()) fIn.focus(); });
  $$('.faq-ex', fEx).forEach((b) => b.addEventListener('click', () => { fIn.value = b.textContent.trim(); fIn.focus({ preventScroll: true }); answer(fIn.value); }));
  fIn.addEventListener('input', () => {
    if (fIn.value.trim()) return;
    faqTok++; fLive.textContent = ''; fA.textContent = ''; fCite.classList.add('is-off'); showExamples(`Exemples${NB}:`);
  });
  fCite.classList.add('is-off');
  /* « Lire le passage » : la page défile jusqu'au passage, qui se souligne au crayon puis s'efface. */
  let citeT = 0, cited = null;
  fSrc.addEventListener('click', (e) => {
    e.preventDefault();
    const t = document.getElementById(fSrc.getAttribute('href').slice(1));
    if (!t || !lastHit) return;
    clearTimeout(citeT);
    if (cited) cited.forEach((c) => c.classList.remove('is-cited'));
    cited = lastHit.ids.flatMap((id) => { const el = document.getElementById(id); return el.matches('.cite') ? [el] : [...el.querySelectorAll('.cite')]; });
    const r = t.getBoundingClientRect();
    const y = Math.max(0, r.top + scrollY - innerHeight * 0.4 + r.height / 2);
    t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
    const marks = cited;
    const mark = () => { marks.forEach((c) => c.classList.add('is-cited')); citeT = setTimeout(() => marks.forEach((c) => c.classList.remove('is-cited')), 3600); };
    if (RM || Math.abs(scrollY - y) < 4) { scrollTo({ top: y, behavior: 'auto' }); requestAnimationFrame(mark); return; }
    let done = false;
    const go = () => { if (done) return; done = true; removeEventListener('scrollend', go); mark(); };
    addEventListener('scrollend', go, { once: true });
    setTimeout(go, 1400);
    scrollTo({ top: y, behavior: 'smooth' });
  });
  /* =========================================================
     Les entrées au défilement (gestes et réglages : tiroir.css, « Les entrées »). Chaque élément entre une seule fois,
     quand il arrive à l'écran ; ceux qui arrivent ensemble se suivent de 90 ms, dans l'ordre de la page.
     ========================================================= */
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  /* Les lignes réelles d'un titre, mesurées sans toucher au texte, puis une fente par ligne le temps de l'entrée.
     Le contenu d'origine (et ses éléments) est remis à la fin : aucune ligne ne change. */
  function splitLines(el) {
    const rows = [];
    let top = null;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const re = /[^ \t\r\n]+/g;
      let m;
      while ((m = re.exec(n.data))) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        const r = rg.getClientRects()[0];
        if (!r) continue;
        if (top === null || r.top - top > r.height * 0.5) { rows.push([]); top = r.top; }
        rows[rows.length - 1].push(m[0]);
      }
    }
    if (!rows.length) return null;
    const html = el.innerHTML;
    el.innerHTML = rows.map((r, i) => `<span class="ln"><span class="ln-in" style="--ln:${i}">${esc(r.join(' '))}</span></span>`).join('');
    return { lines: rows.length, restore: () => { el.innerHTML = html; } };
  }
  const RV = root.classList.contains('rv');
  const DUR = { slot: 1050, block: 1100, rise: 950, sheet: 1200 };
  const TARGETS = [
    ['.demo h2', 'slot'], ['.qs .q', 'rise'], ['.stage', 'sheet'],
    ['.nope-q', 'rise'], ['.meuble', 'sheet'], ['#cles-titre', 'slot'], ['.keys-in p', 'rise'],
    ['.offer-num', 'block'], ['.offer-unit', 'rise'], ['.offer-side', 'sheet'],
    ['.faq-title', 'slot'], ['.faq-lede', 'rise'], ['.faq-card', 'sheet'], ['.end-id', 'rise'], ['.end-col', 'rise'],
  ];
  const kindOf = new Map();
  if (RV) TARGETS.forEach(([sel, kind]) => $$(sel).forEach((el) => { kindOf.set(el, kind); el.setAttribute('data-rv', ''); }));
  function play(el, kind, delay) {
    el.style.setProperty('--d', `${Math.round(delay)}ms`);
    let end = delay + DUR[kind], after = () => {};
    if (kind === 'slot') {
      const S = splitLines(el);
      if (S) { end += (S.lines - 1) * 85; after = S.restore; }
    }
    el.classList.add('rv-in', `rv-go-${kind}`);
    setTimeout(() => { after(); el.classList.remove(`rv-go-${kind}`); el.style.removeProperty('--d'); }, end + 80);
  }
  const order = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  /* Un élément entre dès que 56 px de lui sont à l'écran (ou 60 % s'il est petit), pas à une part fixe de sa hauteur :
     une grande scène n'arrive pas en retard. (rootMargin est ignoré dans le cadre de l'artefact : seuils seulement.) */
  const rvIO = new IntersectionObserver((es) => {
    let t = 0;
    es.filter((e) => e.isIntersecting && e.intersectionRect.height >= Math.min(56, e.boundingClientRect.height * 0.6) - 0.5)
      .map((e) => e.target).sort(order).forEach((el) => {
        rvIO.unobserve(el);
        play(el, kindOf.get(el), Math.min(t, 420));
        t += kindOf.get(el) === 'slot' ? 110 : 85;
      });
  }, { threshold: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6] });
  /* les entrées commencent une fois la page ouverte (sinon une section déjà visible entrerait avant le hero) */
  if (RV) opened.then(() => kindOf.forEach((_, el) => rvIO.observe(el)));
  /* Le clavier atteint un élément encore caché : il est là tout de suite. */
  document.addEventListener('focusin', (e) => {
    kindOf.forEach((_, el) => { if (!el.classList.contains('rv-in') && el.contains(e.target)) { rvIO.unobserve(el); el.classList.add('rv-in'); } });
  });

  /* Le titre du hero sort ligne à ligne à l'ouverture (découpé quand la police est là), puis il est remis. */
  if (RV) opened.then(() => {
    const h1 = $('h1', hero);
    const S = splitLines(h1);
    if (S) setTimeout(S.restore, 140 + (S.lines - 1) * 100 + 1100);
  });
})();
