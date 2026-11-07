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
     La matière : le ciel cobalt et le papier sont imprimés. Pour chacun, une tuile de 640 px CSS, périodique (aucun raccord),
     est calculée une fois par WebGL à la densité de l'écran (au plus 2) : marbrure lente de l'encre, nuage plus fin,
     grain de 1,3 px, fibres du papier (segments courts, orientés au hasard), et sur le cobalt quelques points où le papier
     perce sous l'encre. Sa moyenne est recalée sur la couleur exacte du jeton (une lecture, une correction).
     Posée sous le contenu (tiroir.css, .tx::before), elle arrive en fondu et défile avec la page :
     aucun calcul par image, aucun décalage au défilement. Sans WebGL, les aplats restent.
     ========================================================= */
  const TX = 640;                                   // la tuile, en px CSS (tiroir.css : --tx-size)
  const SURF = [
    { v: '--tex-sky', base: [14, 76, 158], kind: 0, seed: 0.137 },
    { v: '--tex-paper', base: [246, 244, 239], kind: 1, seed: 0.611 },
  ];
  const MATTER_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uPx; uniform vec3 uBase; uniform float uKind; uniform float uSeed; uniform vec3 uShift;
const float T = ${TX.toFixed(1)};
vec2 h22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973) + uSeed);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
/* bruit de gradient périodique : n cases sur la largeur de la tuile */
float gn(vec2 x, float n) {
  vec2 p = x * n, i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = dot(h22(mod(i, n)) * 2. - 1., f);
  float b = dot(h22(mod(i + vec2(1., 0.), n)) * 2. - 1., f - vec2(1., 0.));
  float c = dot(h22(mod(i + vec2(0., 1.), n)) * 2. - 1., f - vec2(0., 1.));
  float d = dot(h22(mod(i + vec2(1., 1.), n)) * 2. - 1., f - vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
/* fibres : jusqu'à deux segments courts par case, effilés aux bouts ; distance en px CSS, bord adouci d'un demi-pixel d'écran */
float fibers(vec2 x, float n, out float sgn) {
  vec2 pc = x * T; float cs = T / n; vec2 cell = floor(x * n);
  float best = 0.; sgn = 1.;
  for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec2 c = cell + vec2(float(j), float(k)); vec2 cw = mod(c, n);
    for (int m = 0; m < 2; m++) {
      vec2 r1 = h22(cw * 1.37 + float(m) * 17.1), r2 = h22(cw * 2.11 + float(m) * 5.3 + 9.7);
      if (r2.y < .35) continue;
      vec2 ctr = (c + r1) * cs;
      float ang = r2.x * 6.2831853; vec2 dir = vec2(cos(ang), sin(ang));
      float L = cs * (.35 + .65 * fract(r1.x * 7.13 + r1.y * 3.7));
      vec2 d = pc - ctr; float t = clamp(dot(d, dir), -L * .5, L * .5);
      float dist = length(d - dir * t), taper = 1. - pow(abs(t) / (L * .5), 3.);
      float w = .4 + .22 * fract(r2.y * 11.), aa = .6 / uPx;
      float v = (1. - smoothstep(w - aa, w + aa, dist)) * taper;
      if (v > best) { best = v; sgn = fract(r1.y * 13.7) < .55 ? 1. : -1.; }
    }
  }
  return best;
}
/* le papier qui perce sous l'encre : de rares points clairs */
float specks(vec2 x, float n) {
  vec2 pc = x * T; float cs = T / n; vec2 cell = floor(x * n); float v = 0.;
  for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec2 c = cell + vec2(float(j), float(k)); vec2 cw = mod(c, n);
    vec2 r = h22(cw * 3.17 + 41.);
    if (r.x < .988) continue;
    vec2 ctr = (c + h22(cw * 1.9 + 7.)) * cs;
    float rad = .45 + .5 * fract(r.y * 9.1), aa = .6 / uPx;
    v = max(v, (1. - smoothstep(rad - aa, rad + aa, length(pc - ctr))) * (.5 + .5 * fract(r.y * 23.)));
  }
  return v;
}
void main() {
  vec2 x = gl_FragCoord.xy / uRes;
  float mottle = gn(x, 3.) * .5 + gn(x, 6.) * .3 + gn(x, 12.) * .2;      // 213, 107, 53 px
  float cloud = gn(x, 24.) * .6 + gn(x, 48.) * .4;                        // 27 et 13 px
  float grain = gn(x, 480.) * .65 + gn(x, 240.) * .35;                    // 1,3 et 2,7 px
  float sg; float fib = fibers(x, 24., sg);
  vec3 col;
  if (uKind < .5) {
    col = uBase * (1. + mottle * .16 + cloud * .065 + grain * .13);
    col += vec3(.017) * fib * (sg > 0. ? 1. : .35) + vec3(.045) * specks(x, 96.);
  } else {
    col = uBase * (1. + mottle * .04 + cloud * .018 + grain * .045);
    col += vec3(.02 * sg) * fib;
  }
  col += uShift + (h22(gl_FragCoord.xy + 31.7).x - .5) / 255.;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;
  function matter() {
    const sc = Math.min(2, Math.max(1, window.devicePixelRatio || 1)), N = Math.round(TX * sc);
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    let gl = null;
    try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }); } catch (e) { /* aplats */ }
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }'), fs = sh(gl.FRAGMENT_SHADER, MATTER_FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1f(U('uPx'), sc);
    const S = 256, px = new Uint8Array(S * S * 4);
    const tiles = SURF.map((s) => {
      gl.uniform3f(U('uBase'), s.base[0] / 255, s.base[1] / 255, s.base[2] / 255);
      gl.uniform1f(U('uKind'), s.kind); gl.uniform1f(U('uSeed'), s.seed); gl.uniform3f(U('uShift'), 0, 0, 0);
      /* la moyenne : la même tuile échantillonnée sur 256 × 256 points (la fonction est continue, la moyenne ne dépend pas
         de la finesse de l'échantillon), puis le décalage qui la ramène sur la couleur du jeton */
      gl.viewport(0, 0, S, S); gl.uniform2f(U('uRes'), S, S);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const m = [0, 0, 0];
      for (let i = 0; i < px.length; i += 4) { m[0] += px[i]; m[1] += px[i + 1]; m[2] += px[i + 2]; }
      const n = S * S;
      gl.uniform3f(U('uShift'), (s.base[0] - m[0] / n) / 255, (s.base[1] - m[1] / n) / 255, (s.base[2] - m[2] / n) / 255);
      gl.viewport(0, 0, N, N); gl.uniform2f(U('uRes'), N, N);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const c2 = document.createElement('canvas'); c2.width = N; c2.height = N;
      c2.getContext('2d').drawImage(cv, 0, 0);
      return { s, c2 };
    });
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    /* une image par tuile (blob, sinon data URL si le cadre refuse les blobs), décodée avant d'être posée */
    const toURL = (c) => new Promise((res) => {
      const viaData = () => { try { res(c.toDataURL('image/webp', 0.95)); } catch (e) { res(null); } };
      c.toBlob((b) => {
        if (!b) { viaData(); return; }
        const u = URL.createObjectURL(b), im = new Image();
        im.onload = () => (im.decode ? im.decode() : Promise.resolve()).then(() => res(u), () => res(u));
        im.onerror = () => { URL.revokeObjectURL(u); viaData(); };
        im.src = u;
      }, 'image/png');
    });
    Promise.all(tiles.map(({ s, c2 }) => toURL(c2).then((u) => { if (u) document.documentElement.style.setProperty(s.v, `url("${u}")`); })))
      .then(() => requestAnimationFrame(() => document.documentElement.classList.add('tx-on')));
  }
  /* juste après le premier affichage : le calcul (une vingtaine de millisecondes) tombe avant l'entrée du hero,
     qui attend la police et la colline (tiroir.js, « L'ouverture ») ; la tuile arrive ensuite en fondu */
  if (!/[?&]matiere=0/.test(location.search)) requestAnimationFrame(() => setTimeout(matter, 0));

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

  /* La section en cours, mise en avant dans la navigation (les autres liens s'effacent un peu, tiroir.css). */
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

  /* Le survol des liens et des boutons : le libellé roule (tiroir.css, .roll). Deux copies du texte dans une fente ;
     la seconde est cachée aux lecteurs d'écran et à la recherche du pied de page (aria-hidden). */
  function roll(el) {
    const t = el.textContent;
    if (!t.trim() || el.querySelector('.roll')) return;
    const r = document.createElement('span'), i = document.createElement('span'), a = document.createElement('span'), b = document.createElement('span');
    r.className = 'roll'; i.className = 'roll-in'; b.className = 'roll-b'; b.setAttribute('aria-hidden', 'true');
    a.textContent = t; b.textContent = t;
    i.append(a, b); r.append(i);
    el.textContent = ''; el.append(r);
  }
  /* le libellé d'un lien ou d'un bouton, sans sa copie */
  const label = (el) => ($('.roll-in > span', el) || el).textContent.trim();
  $$('.trait').forEach(roll);
  $$('.btn').forEach((btn) => { const lab = $('.btn-label', btn) || btn; if (!lab.children.length) roll(lab); });

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

  /* Le surligneur : un aplat vert à bords droits sur le bas de chaque ligne (de 30 à 94 % de sa hauteur),
     posé de gauche à droite d'une ligne à l'autre. Bords calés sur les pixels de l'écran : net, sans flou. */
  function crayon(rects) {
    return { lines: rects.map((r) => ({ r })), total: rects.reduce((s, r) => s + r.w, 0) };
  }
  function drawCrayon(ctx, cv, w, h, hl, p) {
    const d = DPR();
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (!hl) return;
    ctx.fillStyle = 'rgba(134, 184, 62, .42)';
    let budget = p * hl.total;
    for (const { r } of hl.lines) {
      if (budget <= 0) break;
      const ww = Math.min(r.w, budget);
      budget -= r.w;
      const x0 = Math.round((r.x - 2) * d), x1 = Math.round((r.x + ww + (ww >= r.w ? 2 : 0)) * d);
      const y0 = Math.round((r.y + r.h * 0.3) * d), y1 = Math.round((r.y + r.h * 0.94) * d);
      if (x1 > x0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
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
      nh: 'Article 5. Loyer', next: `Le présent bail est consenti et accepté moyennant un loyer annuel hors taxes et hors charges, payable par trimestre et d’avance.`,
      body: [`Le présent bail est consenti pour neuf années entières et consécutives. Le Preneur pourra donner congé `, `à${NB}l’expiration de chaque période triennale, en respectant un préavis de six mois`, `, par lettre recommandée avec demande d’avis de réception ou par acte de commissaire de justice.`],
    },
    {
      a: `La directrice générale, ou le directeur administratif et financier en son absence.`,
      file: 'Délégations de signature 2026.docx', path: 'SharePoint, Direction', page: 'page 2', h: 'Article 3. Engagements de dépenses',
      nh: 'Article 4. Contrats de prestation', next: `Les contrats conclus pour plus d’un an sont signés par la directrice générale, après avis du directeur administratif et financier.`,
      body: [`Les devis et bons de commande d’un montant supérieur à 5${NB}000${NB}€${NB}HT sont `, `signés par la directrice générale ou, en son absence, par le directeur administratif et financier`, `. En deçà, le responsable du service concerné signe seul.`],
    },
    {
      a: `Oui, même hors de vos locaux, jusqu’à 15${NB}000${NB}€ par sinistre, après franchise.`,
      file: 'Multirisque professionnelle 2025.pdf', path: 'Drive, Assurances', page: 'page 12', h: 'Article 7. Biens confiés',
      nh: 'Article 8. Exclusions', next: `Ne sont pas garantis les dommages dus à l’usure normale des biens ou à un défaut d’entretien.`,
      body: [`Sont garantis les biens appartenant à l’assuré et confiés temporairement à ses clients, `, `y${NB}compris hors des locaux assurés, dans la limite de 15${NB}000${NB}€ par sinistre`, `, après application de la franchise prévue aux conditions particulières.`],
    },
  ];

  /* =========================================================
     Hero : la question est posée, la fiche sort du tiroir, la réponse s'écrit
     ========================================================= */
  const hero = $('.hero');
  const hillImg = $('.hill img', hero);
  const ask = $('.ask', hero);
  const askA = $('.ask-a', ask), askS = $('.ask-src', ask);
  const ANSWER = askA.textContent;
  /* Premier affichage : la question est déjà posée et la réponse est en cours d'écriture. */
  const START = 'Six mois avant la fin'.length;
  if (!RM) {
    askA.textContent = ANSWER.slice(0, START);
    const c = document.createElement('span'); c.className = 'caret'; askA.append(c);
    askS.classList.add('wait');
  }
  /* la bouche du tiroir tiré (son bord haut) et sa largeur, en pixels de l'image de la colline */
  const COM = { mouthX: 816, mouthY: 108, drawerW: 128 };
  let HF = null;
  const PX = !RM && window.CSS && CSS.supports('animation-timeline: view()');
  const heroShift = () => (PX ? Math.min(Math.max(scrollY, 0), innerHeight) * 0.08 : 0);
  const relRect = (el, ref) => { const r = el.getBoundingClientRect(); return { l: r.left - ref.left, t: r.top - ref.top, w: r.width, h: r.height }; };

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
  let heroFlying = false, heroStale = false;
  /* Le vol de la fiche du hero : elle sort droit de la fente du tiroir tiré, puis rejoint sa place sur une seule courbe,
     en grandissant (elle vient vers nous) ; elle s'incline selon sa vitesse et se pose sans rebond.
     Sous le bord du tiroir, elle est cachée. Mesuré à la place de repos de la fiche, hors glissement du hero. */
  function buildHero() {
    if (heroFlying) { heroStale = true; return; }
    const hr = hero.getBoundingClientRect();
    const ir = relRect(hillImg, hr), k = ir.w / 1456;
    const S = { x: ir.l + COM.mouthX * k, y: ir.t + COM.mouthY * k };
    const ar = relRect(ask, hr);
    ar.t += heroShift();
    const C = { x: ar.l + ar.w / 2, y: ar.t + ar.h / 2 };
    const s0 = Math.min(0.4, (COM.drawerW * k * 0.72) / ar.w);
    const half0 = (ar.h * s0) / 2;
    const A = [S.x, S.y + half0 + 2];              // départ : la fiche entière dans le tiroir
    const up = Math.max(60, 0.42 * (S.y - C.y));
    const path = pathOf([[A, [S.x, S.y - up], [C.x - 0.32 * (C.x - S.x), C.y + 0.2 * (S.y - C.y)], [C.x, C.y]]]);
    const out = (2 * half0 + 4) / path.total;      // part du chemin parcourue dans la fente
    const dur = clamp(1000 + path.total * 0.5, 1200, 1600);
    const xAt = (u) => path(E.vol(clamp(u, 0, 1)))[0];
    const tl = tilt(xAt, dur);
    const poseAt = (u) => {
      const d = E.vol(u), [x, y] = path(d);
      return { d, x, y, sc: lerp(s0, 1, Math.pow(smooth(out * 1.1, 0.97, d), 1.4)), rot: 2.2 * tl(u) * smooth(out * 0.8, out * 3, d) };
    };
    HF = { S, C, ar, poseAt, dur };
  }
  /* Le vol, joué par le navigateur (animation de transformation : nette à l'arrivée, sans calcul par image). */
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
    const done = () => { heroFlying = false; if (heroStale) { heroStale = false; buildHero(); } };
    return an.finished.then(done, done);
  }

  /* =========================================================
     Le chercheur (perso.js), en option : ?chercheur=1. Un personnage au trait assis à droite du tiroir tiré,
     qui fouille et se gratte la tête (boucle de 10 s). Retiré par défaut le 2026-11-06 : le trait d'enfant sur la photo
     tirait l'affiche vers le dessin naïf. Chargé seulement s'il est demandé (son calcul de ressorts ne coûte rien sinon).
     ========================================================= */
  const CHERCHEUR = /[?&]chercheur=1/.test(location.search);
  const persoCv = $('.perso', hero), persoBtn = $('.perso-pause', hero), hillBox = $('.hill', hero);
  let PERSO = null, heroVisible = true;
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
  function initPerso() {
    PERSO = window.TiroirPerso && persoCv ? window.TiroirPerso.create(persoCv, { img: hillImg }) : null;
    if (!PERSO) return;
    if (/[?&]perso=/.test(location.search)) persoT = parseFloat(location.search.split(/[?&]perso=/)[1]) || 0;
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
  if (CHERCHEUR) {
    const sc = document.createElement('script');
    sc.src = 'perso.js'; sc.onload = initPerso;
    document.body.append(sc);
  }
  new IntersectionObserver((es) => { heroVisible = es[0].isIntersecting; if (heroVisible) kickPerso(); }).observe(hero);

  /* =========================================================
     L'ouverture : on attend la police et l'image de la colline (au plus 1,6 s), puis tout arrive ensemble.
     La colline se pose (tiroir.css, 1,1 s), le titre sort, et la fiche part du tiroir quand la commode est en place.
     ========================================================= */
  const root = document.documentElement;
  const FLY_AT = 520;
  async function heroPlay() {
    buildHero();                                   // mesuré avant les entrées (aucune transformation en cours)
    root.classList.add('rv-open');
    persoOn = true; placePerso(); kickPerso();
    if (RM) return;
    await heroFly(FLY_AT);
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

  /* Courbes de mouvement partagées */
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
  };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /* Vitesse horizontale le long d'un trajet minuté, rapportée à son maximum : l'inclinaison suit une cloche, sans plafond ni à-coup. */
  function tilt(xAt, dur) {
    const v = (p) => (xAt(p + 0.004) - xAt(p - 0.004)) / (0.008 * dur);
    let vmax = 1e-6;
    for (let i = 0; i <= 60; i++) vmax = Math.max(vmax, Math.abs(v(i / 60)));
    return (p) => v(p) / vmax;
  }

  /* =========================================================
     Démo : la réponse à gauche ; à droite, le tiroir. Ses fiches dépassent de la façade, la page lue en sort.
     À chaque question : la page redescend dans le tiroir, Tiroir feuillette les fiches de l'avant vers le fond,
     l'étiquette prend le nom du dossier, la bonne page monte, le passage se surligne au crayon, la réponse s'écrit.
     Tout en transformations composées (la page) et en un petit canevas (le haut des fiches).
     ========================================================= */
  const stage = $('.stage');
  const replyEl = $('.stage-reply', stage), srcEl = $('.stage-src', stage), srcT = $('.stage-src-t', stage);
  const desk = $('.desk', stage), slotEl = $('.desk-slot', desk);
  const fiche = $('.fiche', desk), fBody = $('.fiche-body', fiche), fInk = $('.fiche-ink', fiche), fctx = fInk.getContext('2d');
  const cvBack = $('.desk-cards--back', desk), cvFront = $('.desk-cards--front', desk);
  const plaque = $('.drawer-plaque', desk);
  const live = $('.reply-live');
  const folderOf = (q) => q.path.split(', ').pop();
  function fillFiche(i, el) {
    const q = QA[i], f = el || fiche;
    $('.fiche-name', f).textContent = q.file;
    $('.fiche-path', f).textContent = q.path;
    $('.fiche-page', f).textContent = q.page;
    $('.fiche-h', f).textContent = q.h;
    const b = $('.fiche-body', f);
    b.textContent = ''; b.append(q.body[0]);
    const m = document.createElement('mark'); m.textContent = q.body[1]; b.append(m); b.append(q.body[2]);
    $('.fiche-h--next', f).textContent = q.nh;
    $('.fiche-next', f).textContent = q.next;
  }
  /* La hauteur utile d'une page (l'article cité et le titre du suivant) et de la réponse, pour les trois questions :
     la scène ne bouge pas d'une question à l'autre. Sur des copies hors champ. */
  function measure() {
    let fh = 0, rh = 0;
    const fc = fiche.cloneNode(true), rc = replyEl.cloneNode(false);
    fc.style.cssText = 'visibility:hidden;transform:none;animation:none';
    rc.style.cssText = `visibility:hidden;position:absolute;left:0;top:0;width:${replyEl.clientWidth}px;min-height:0`;
    slotEl.append(fc); replyEl.parentElement.append(rc);
    QA.forEach((q, i) => {
      fillFiche(i, fc);
      const nh = $('.fiche-h--next', fc);
      fh = Math.max(fh, nh.offsetTop + nh.offsetHeight + 6);    // jusqu'au titre de l'article suivant : son texte est sous les fiches de devant
      rc.textContent = q.a; rh = Math.max(rh, rc.offsetHeight);
    });
    fc.remove(); rc.remove();
    return { fh, rh };
  }
  let hideY = 600, pageUp = true;
  const COVER = 12;                                 // ce que les deux fiches de devant cachent du bas de la page
  function layoutStage() {
    const m = measure();
    replyEl.style.minHeight = m.rh + 'px';
    stage.style.setProperty('--page-h', Math.ceil(m.fh) + 'px');
    hideY = slotEl.clientHeight - fiche.offsetTop + 2;
    if (!pageUp && !fiche.getAnimations().length) fiche.style.transform = `translateY(${hideY}px)`;
    drawDeskCards(performance.now());
  }

  /* Le haut des fiches dans le tiroir : sept derrière la page, deux devant. Vues de face et un peu d'en haut :
     celles du fond dépassent plus haut, plus sombres ; chacune a son onglet (à gauche, au milieu, à droite). */
  const BACK = 7, FRONT = 2;
  const CARDS = [];
  {
    const R = rng(23), tones = ['#ffffff', '#f2f0ea', '#e2eaf6'];
    for (let j = 0; j < BACK + FRONT; j++) CARDS.push({ tone: tones[(j * 2) % 3], tab: [0.07, 0.43, 0.76][(j * 2 + 1) % 3] + (R() - 0.5) * 0.05, tw: 0.13 + R() * 0.04 });
  }
  let riffleT0 = null;
  function canvasFor(cv) {
    const w = cv.clientWidth, h = cv.clientHeight, d = DPR();
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(d, 0, 0, d, 0, 0);
    return { x, w, h };
  }
  function tabPath(x, l, t, w, h, r) {
    x.beginPath(); x.moveTo(l, t + h); x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t);
    x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r); x.lineTo(l + w, t + h); x.closePath();
  }
  function drawDeskCards(now) {
    const B = canvasFor(cvBack), F = canvasFor(cvFront);
    if (!B || !F) return false;
    const W = B.w, H = B.h, I = Math.max(0, (W - slotEl.clientWidth) / 2), cw = W - 2 * I;
    /* le tiroir vu d'un peu au-dessus : l'intérieur sombre, le chant du fond, les chants des côtés qui fuient vers lui */
    {
      const x = B.x, yb = 3, st = Math.min(7, I * 0.3), dx = Math.min(I * 0.45, 14);
      x.fillStyle = '#062654';
      x.beginPath(); x.moveTo(st, H); x.lineTo(dx + st * 0.7, yb); x.lineTo(W - dx - st * 0.7, yb); x.lineTo(W - st, H); x.closePath(); x.fill();
      x.fillStyle = '#d9d4c8';                      // le chant du fond, dans l'ombre
      x.fillRect(dx, yb, W - 2 * dx, 3);
      x.fillStyle = '#ebe8e0';                      // les chants des côtés, éclairés
      x.beginPath(); x.moveTo(0, H); x.lineTo(dx, yb); x.lineTo(dx + st * 0.7, yb); x.lineTo(st, H); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(W, H); x.lineTo(W - dx, yb); x.lineTo(W - dx - st * 0.7, yb); x.lineTo(W - st, H); x.closePath(); x.fill();
    }
    const N = CARDS.length;
    let active = false;
    for (let j = 0; j < N; j++) {                   // du fond vers l'avant
      const c = CARDS[j], front = j >= BACK, x = front ? F.x : B.x;
      let y = front ? H - (j === N - 1 ? 5 : COVER) : 10 + (j / (BACK - 1)) * (H - 10 - COVER - 6);
      if (riffleT0 != null) {
        const t = (now - riffleT0 - (N - 1 - j) * 42) / 300;   // Tiroir feuillette de l'avant vers le fond
        if (t < 1) active = true;
        if (t > 0 && t < 1) y -= 7 * (t < 0.35 ? easeOut(t / 0.35) : 1 - easeIO((t - 0.35) / 0.65));
      }
      const tl = I + c.tab * cw, tw = c.tw * cw;
      x.fillStyle = c.tone;
      x.fillRect(I, y, cw, H - y + 1);
      tabPath(x, tl, y - 6.5, tw, 7, 2.5); x.fill();
      const shade = front ? 0 : 0.06 + 0.24 * (1 - j / (BACK - 1));
      if (shade) {
        x.fillStyle = `rgba(6, 38, 84, ${shade.toFixed(3)})`;
        x.fillRect(I, y, cw, H - y + 1);
        tabPath(x, tl, y - 6.5, tw, 7, 2.5); x.fill();
      }
      x.fillStyle = 'rgba(13, 44, 87, .22)';         // le chant de la fiche
      x.fillRect(I, y, tl - I, 1); x.fillRect(tl + tw, y, I + cw - tl - tw, 1);
    }
    if (!active && riffleT0 != null && now - riffleT0 > 2000) riffleT0 = null;
    return active;
  }
  /* La page monte du tiroir ou y redescend (transformation seulement ; la fente la coupe). */
  function pageTo(up, ms) {
    const cur = getComputedStyle(fiche).transform;   // la pose en cours, même au milieu d'un geste : on repart d'elle
    const y0 = cur && cur !== 'none' ? new DOMMatrixReadOnly(cur).m42 : 0;
    fiche.getAnimations().forEach((a) => a.cancel());
    const down = `translateY(${hideY}px)`;
    pageUp = up;
    if (RM || !ms) { fiche.style.transform = up ? '' : down; return Promise.resolve(true); }
    fiche.style.transform = '';
    /* en montant, la page se redresse d'un rien (pivot au bas de la page, dans le tiroir) */
    const a = fiche.animate(
      up ? [{ transform: `translateY(${y0.toFixed(2)}px) rotate(-.6deg)` }, { transform: 'none' }]
         : [{ transform: `translateY(${y0.toFixed(2)}px)` }, { transform: down }],
      { duration: ms, easing: up ? 'cubic-bezier(.16, .84, .24, 1)' : 'cubic-bezier(.5, 0, .75, .25)', fill: 'forwards' });
    return a.finished.then(() => { fiche.style.transform = up ? '' : down; a.cancel(); return true; }, () => false);
  }
  /* L'étiquette prend le nom du dossier où la page a été trouvée : elle s'éteint, change, se rallume. */
  let plaqueTok = 0;
  async function swapPlaque(text) {
    if (plaque.textContent === text) return;
    const my = ++plaqueTok;
    plaque.getAnimations().forEach((a) => a.cancel());
    if (RM) { plaque.textContent = text; return; }
    const out = plaque.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    await out.finished.catch(() => {});
    if (my !== plaqueTok) return;
    plaque.textContent = text;
    out.cancel();
    plaque.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  }

  let hl = null, hlP = 0;
  function buildHL() {
    const mark = $('mark', fiche);
    if (!mark) return null;
    const cr = fiche.getBoundingClientRect();
    const rects = [...mark.getClientRects()].filter((r) => r.width > 2).map((r) => ({ x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }));
    return crayon(rects, 17);
  }
  const drawHL = (p) => { hlP = p; drawCrayon(fctx, fInk, fiche.offsetWidth, fiche.offsetHeight, hl, p); };
  /* Le texte de la fiche change de taille (police qui arrive, largeur) : on remesure le crayon. */
  new ResizeObserver(() => { if (hl && pageUp && !fiche.getAnimations().length) { hl = buildHL(); drawHL(hlP); } }).observe(fBody);

  const qs = $$('.q');
  let tok = 0;
  function show(i) {
    const q = QA[i];
    fillFiche(i); replyEl.textContent = q.a; srcT.textContent = `${q.file}, ${q.page}`; plaque.textContent = folderOf(q);
    live.textContent = `${q.a} Source${NB}: ${q.file}, ${q.page}.`;
  }
  async function askDemo(i) {
    const my = ++tok, alive = () => my === tok;
    qs.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    stage.setAttribute('aria-busy', 'true');
    const q = QA[i];
    live.textContent = `${q.a} Source${NB}: ${q.file}, ${q.page}.`;
    if (RM) {
      show(i); layoutStage(); pageTo(true, 0);
      requestAnimationFrame(() => { hl = buildHL(); drawHL(1); stage.removeAttribute('aria-busy'); });
      return;
    }
    stage.classList.add('is-searching');
    if (!(await pageTo(false, 460)) || !alive()) return;
    fillFiche(i); hl = null; drawHL(0);
    swapPlaque(folderOf(q));
    riffleT0 = performance.now(); loop((now) => drawDeskCards(now));
    await sleep(400);
    if (!alive()) return;
    srcEl.classList.add('wait'); srcT.textContent = `${q.file}, ${q.page}`;
    stage.classList.remove('is-searching');
    const typing = typeIn(replyEl, q.a, 28, alive);
    if (!(await pageTo(true, 980)) || !alive()) return;
    await sleep(90);
    if (!alive()) return;
    hl = buildHL();
    await tween(300 + hl.total * 2, (p) => drawHL(p), alive);
    if (!alive()) return;
    srcEl.classList.remove('wait');
    if (typing) await typing;
    if (alive()) stage.removeAttribute('aria-busy');
  }
  qs.forEach((b, i) => b.addEventListener('click', () => {
    /* Au téléphone, la scène est sous les questions : la réponse s'écrirait hors de l'écran. On amène la scène
       (la réponse en haut de l'écran) quand sa réponse est sous la moitié de l'écran (passe mobile du 2026-11-05). */
    if (innerWidth < 880) {
      const top = replyEl.getBoundingClientRect().top;
      if (top > innerHeight * 0.5) scrollTo({ top: scrollY + stage.getBoundingClientRect().top - 16, behavior: RM ? 'auto' : 'smooth' });
    }
    askDemo(i);
  }));
  fontsReady.then(() => {
    /* Au repos, la scène montre déjà une réponse : la page est sortie et lisible. Le crayon passe à l'arrivée de la scène. */
    show(0); layoutStage();
    hl = buildHL(); drawHL(RM ? 1 : 0);
    onView(stage, 0.25, async () => {
      if (RM) return;
      const my = tok;
      await sleep(500);
      if (my !== tok) return;
      hl = buildHL();
      tween(300 + hl.total * 2, (p) => drawHL(p), () => my === tok);
    });
    let lastW = stage.clientWidth;
    new ResizeObserver(() => {
      const w = stage.clientWidth;
      layoutStage();
      if (w !== lastW && hl && pageUp && !fiche.getAnimations().length) { hl = buildHL(); drawHL(hlP); }
      lastW = w;
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
    return c._ombre.animate([{ transform: out ? A : B, opacity: out ? 0 : 0.5 }, { transform: out ? B : A, opacity: out ? 0.5 : 0 }], o).finished;
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
      fitHill(); buildHero(); placePerso();
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
    note.textContent = `${label(a)}${NB}: cette page n’existe pas. Tiroir est une marque de démonstration du studio Topiary.`;
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
  $$('.faq-ex', fEx).forEach((b) => b.addEventListener('click', () => { fIn.value = label(b); fIn.focus({ preventScroll: true }); answer(fIn.value); }));
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
