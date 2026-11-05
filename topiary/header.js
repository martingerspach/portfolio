// Topiary v4 : l'en-tête. Une pastille de survol qui glisse d'un lien à l'autre, et l'en-tête du hero qui se resserre
// en une capsule flottante pendant les premiers pixels de défilement.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 961px)'); // au-dessous, la capsule prend toute la largeur (v4.css, header.css)
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- Pastille de survol ----------
     Elle apparaît sur place quand le pointeur entre dans le menu, glisse d'un lien à l'autre, s'efface sur place quand il en
     sort ou passe sur le bouton d'appel (qui a son propre survol). Elle suit aussi le focus au clavier. Sur une page du
     menu (Studio, Méthode), elle se pose sur le lien de la page et y revient au lieu de s'effacer. */
  function chip(nav) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.setAttribute('aria-hidden', 'true');
    for (const k of ['l', 'm', 'r']) {
      const s = document.createElement('span');
      s.className = `chip__${k}`;
      c.append(s);
    }
    nav.prepend(c);
    nav.classList.add('has-chip');
    const [l, m, r] = c.children;
    const R = 8, M = 100; // rayon des bouts (--r-btn), largeur de base du milieu
    let on = false, offAt = -1e9, h0 = -1, y0 = -1, cur = null;
    const home = nav.querySelector('a[aria-current="page"]:not(.btn)');

    function go(a, instant) {
      const x = a.offsetLeft, w = a.offsetWidth, h = a.offsetHeight, y = a.offsetTop;
      // Pastille encore visible (elle s'efface) : elle repart d'où elle est ; sinon elle apparaît directement sous le lien.
      const snap = instant || (!on && performance.now() - offAt > 380);
      if (snap) c.classList.add('is-snap');
      if (h !== h0 || y !== y0) { c.style.height = `${h}px`; c.style.top = `${y}px`; h0 = h; y0 = y; }
      l.style.transform = `translate3d(${x}px,0,0)`;
      r.style.transform = `translate3d(${x + w - R}px,0,0)`;
      m.style.transform = `translate3d(${x + R - 1}px,0,0) scaleX(${((w - 2 * R + 2) / M).toFixed(4)})`;
      c.style.transformOrigin = `${x + w / 2}px 50%`;
      if (snap) { void getComputedStyle(c).opacity; c.classList.remove('is-snap'); }
      c.classList.add('is-on');
      on = true;
      cur = a;
    }
    function off() {
      if (home) { go(home); return; }
      if (!on) return;
      c.classList.remove('is-on');
      on = false;
      cur = null;
      offAt = performance.now();
    }
    // Les liens changent de place (police chargée, fenêtre redimensionnée) : la pastille s'y recale sans glisser
    new ResizeObserver(() => { if (cur) go(cur, true); }).observe(nav);
    if (home) go(home, true);

    nav.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const a = e.target.closest('a');
      if (!a || !nav.contains(a)) return; // entre deux liens : la pastille attend sur le dernier
      if (a.classList.contains('btn')) off(); else go(a);
    });
    nav.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') off(); });
    nav.addEventListener('focusin', (e) => {
      const a = e.target;
      if (a.classList.contains('btn')) off();
      else if (a.matches(':focus-visible')) go(a);
    });
    nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) off(); });
  }
  document.querySelectorAll('.nav').forEach(chip);

  /* ---------- Fusion de l'en-tête au défilement ----------
     Le resserrement lié au défilement (retenu le 2026-10-20) : sur les 180 premiers pixels, la marque et le menu
     quittent leur place dans le hero pour une capsule blanche centrée, qui se forme autour d'eux. Un ressort amortit
     le suivi du défilement ; on peut s'arrêter à mi-course. */
  const card = document.querySelector('.hero__card');
  const top = document.querySelector('.top');
  const float = document.getElementById('float');
  if (!card || !top || !float) return;
  const bar = float.querySelector('.float__bar');
  const brand = float.querySelector('.float__brand');
  const group = float.querySelector('.float__links');
  const bg = float.querySelector('.float__bg');

  // Les pièces qui bougent, appariées entre le hero (A) et la capsule (B). Le menu se déplace d'un seul bloc, liens,
  // bouton et pastille de survol compris : la pastille reste sous le lien visé à tout état du défilement.
  const pieces = (scope) => ({ logo: scope.querySelector('.logo'), nav: scope.querySelector('.nav'), menu: scope.querySelector('.menu-btn') });
  const PA = pieces(top), PB = pieces(float);
  const NAMES = Object.keys(PA).filter((n) => PA[n] && PB[n]);
  // Les éléments focalisables, appariés pour que le focus clavier passe de l'un à l'autre
  const focusables = (scope) => [scope.querySelector('.logo'), ...scope.querySelectorAll('.nav a'), scope.querySelector('.menu-btn')].filter(Boolean);
  const FA = focusables(top), FB = focusables(float);
  FA.forEach((el, i) => { el.dataset.pair = i; });
  FB.forEach((el, i) => { el.dataset.pair = i; });

  const RANGE = 180; // px de défilement sur lesquels se fait la fusion
  const OMEGA = 16; // raideur du ressort qui suit le défilement (rad/s)
  // Un seul avancement pour la capsule et les pièces : arrêtées à mi-course, les pièces restent à leur place dans la
  // capsule qui se forme (un fond en avance laissait le logo et le bouton dehors). Seule l'opacité du fond arrive tôt,
  // pour que le texte qui remonte passe dessous.
  // La copie flottante est affichée dès le haut de page, à la place exacte de l'en-tête du hero (vérifié au pixel) :
  // fixe, elle est tenue par le compositeur dès le premier pixel de défilement, avant même que le script ne réagisse
  // (sinon l'original montait d'une image avec la page, puis la copie le ramenait).
  const T = 0.5;
  // Le logo flottant est écrit au corps du hero (25 px) puis réduit dans la capsule : au départ, il est identique à
  // l'original au pixel près ; au repos, la réduction se peint en vectoriel (pas de calque figé), il reste net.
  const LOGO_K = 22 / 25;

  const A = {}, B = {};
  let G = null;
  const S = { x: 0, v: 0, t: 0 };
  let merged = false, shown = null, topOut = false, raf = 0, last = 0, frozen = null, wasMoving = true;

  const box = (el, dy = 0) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x: r.left, y: r.top + dy, w: r.width, h: r.height } : null;
  };
  const grow = (b, p) => b && { x: b.x - p[3], y: b.y - p[0], w: b.w + p[1] + p[3], h: b.h + p[0] + p[2] };
  const union = (list) => {
    const l = list.filter(Boolean);
    if (!l.length) return null;
    const x = Math.min(...l.map((b) => b.x)), y = Math.min(...l.map((b) => b.y));
    return { x, y, w: Math.max(...l.map((b) => b.x + b.w)) - x, h: Math.max(...l.map((b) => b.y + b.h)) - y };
  };
  const pads = (el) => { const c = getComputedStyle(el); return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(parseFloat); };

  // La capsule centrée prend une largeur entière, centrée sur un pixel entier, le menu calé sur son bord droit :
  // il tombe alors sur les mêmes fractions de pixel que dans le hero (calé à droite sur un bord entier), et le texte
  // comme le fond du bouton se peignent à l'identique au moment où la copie prend la place de l'original.
  function evenBar() {
    if (!wide.matches) return;
    let w = Math.ceil(bar.getBoundingClientRect().width);
    if ((float.clientWidth - w) % 2) w += 1;
    bar.style.width = `${w}px`;
  }

  // A : les pièces du hero, en coordonnées de page (l'écran quand on est tout en haut). B : leur place dans la capsule,
  // mesurée transformations retirées. Puis le fond : de la rangée du hero à la capsule.
  // Le hero part plus vite que la page (v4.css, hero-leave) : mesuré en cours de défilement, on retire ce décalage.
  const hero = card.closest('.hero');
  const heroShift = () => {
    const t = hero ? getComputedStyle(hero).transform : 'none';
    return t && t !== 'none' ? new DOMMatrixReadOnly(t).m42 : 0;
  };
  function measure() {
    const sy = scrollY - heroShift();
    NAMES.forEach((n) => { A[n] = box(PA[n], sy); });
    const saved = NAMES.map((n) => PB[n].style.transform);
    NAMES.forEach((n) => { PB[n].style.transform = 'none'; });
    bar.style.width = '';
    // La place que la réduction du logo libère est rendue à la rangée (marge négative)
    const lw = PB.logo.getBoundingClientRect().width;
    brand.style.marginRight = `${(-lw * (1 - LOGO_K)).toFixed(3)}px`;
    evenBar();
    NAMES.forEach((n) => { B[n] = box(PB[n]); });
    const barB = box(bar);
    NAMES.forEach((n, i) => { PB[n].style.transform = saved[i]; });
    const pb = pads(brand), pg = pads(group);
    const a = grow(union(NAMES.map((n) => A[n])), [pg[0], pg[1], pg[2], pb[3]]);
    G = a && barB ? { a, b: barB } : null;
  }

  // Chaque pièce va de sa place dans le hero (A) à sa place dans la capsule (B), centres interpolés ; seul le logo
  // change d'échelle. Au repos dans la capsule, plus aucune transformation (sauf la réduction du logo).
  function draw(s0) {
    const s = s0 != null ? s0 : S.x;
    const full = s0 == null && S.x === 1 && !S.v;
    for (const n of NAMES) {
      const el = PB[n], a = A[n], b = B[n];
      if (!a || !b) continue;
      const kb = n === 'logo' ? LOGO_K : 1;
      if (full && kb === 1) { el.style.transform = ''; continue; }
      const k = n === 'logo' ? lerp(a.w / b.w, kb, s) : 1;
      const cx = lerp(a.x + a.w / 2, b.x + (b.w * kb) / 2, s), cy = lerp(a.y + a.h / 2, b.y + b.h / 2, s);
      el.style.transform = `translate(${(cx - (k * b.w) / 2 - b.x).toFixed(3)}px, ${(cy - (k * b.h) / 2 - b.y).toFixed(3)}px) scale(${k.toFixed(5)})`;
    }
    if (G) {
      bg.style.transform = `translate(${lerp(G.a.x, G.b.x, s).toFixed(2)}px, ${lerp(G.a.y, G.b.y, s).toFixed(2)}px)`;
      bg.style.width = `${lerp(G.a.w, G.b.w, s).toFixed(2)}px`;
      bg.style.height = `${lerp(G.a.h, G.b.h, s).toFixed(2)}px`;
      bg.style.opacity = smooth(0, 0.3, s).toFixed(3);
    }
  }

  // Passage de l'en-tête du hero à sa copie flottante, et retour (mouvements réduits). Le focus clavier suit.
  function show(v) {
    if (v === shown) return;
    const first = shown == null;
    shown = v;
    const act = document.activeElement;
    const pair = !first && act && (v ? top : float).contains(act) ? act.dataset.pair : null;
    float.classList.toggle('is-on', v);
    float.inert = !v;
    root.classList.toggle('head-float', v);
    if (pair != null) {
      const t = (v ? FB : FA)[pair];
      if (t && t.getClientRects().length) t.focus({ preventScroll: true });
    }
  }

  // Ressort critique (aucun dépassement), intégré exactement à chaque image : il repart d'où il est, vitesse comprise,
  // quand on change de sens en cours de route.
  function step(s, dt) {
    const d0 = s.x - s.t, e = Math.exp(-OMEGA * dt), c = s.v + OMEGA * d0;
    s.x = s.t + (d0 + c * dt) * e;
    s.v = (s.v - OMEGA * c * dt) * e;
    if (Math.abs(s.x - s.t) < 4e-4 && Math.abs(s.v) < 4e-3) { s.x = s.t; s.v = 0; return false; }
    return true;
  }

  // Cibles selon le défilement ; mouvements réduits : rien ne bouge, la capsule apparaît d'un coup quand l'en-tête du
  // hero a quitté l'écran.
  function targets() {
    if (reduce.matches) {
      merged = topOut;
      S.t = merged ? 1 : 0;
      return;
    }
    merged = scrollY > T;
    S.t = smooth(0, 1, clamp((scrollY - T) / RANGE));
  }

  function frame(now) {
    raf = 0;
    if (frozen != null) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    targets();
    const still = reduce.matches;
    const x0 = S.x;
    let moving = false;
    if (still) { S.x = S.t; S.v = 0; } else moving = step(S, dt);
    const changed = S.x !== x0;
    show(!still || merged);
    if (moving || changed || wasMoving) draw(); // au repos, rien à redessiner en plein défilement
    wasMoving = moving;
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // L'en-tête du hero a-t-il quitté l'écran ? (seuil des mouvements réduits)
  new IntersectionObserver(([e]) => {
    topOut = !e.isIntersecting && e.boundingClientRect.top < 0;
    kick();
  }).observe(top);

  // Mise en place, sans animation, dans l'état qui correspond au défilement actuel (chargement, mouvements réduits).
  function init() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    targets();
    S.x = S.t;
    S.v = 0;
    measure();
    show(!reduce.matches || merged);
    draw();
  }

  addEventListener('scroll', kick, { passive: true });
  const remeasure = () => { measure(); draw(); kick(); };
  new ResizeObserver(remeasure).observe(card);
  new ResizeObserver(remeasure).observe(bar);
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', remeasure);
    document.fonts.ready.then(remeasure);
  }
  root.addEventListener('topiary:theme', remeasure);
  reduce.addEventListener('change', init);
  init();

  // Pour les bancs d'essai : poser toutes les pièces à un avancement donné (null pour relâcher).
  window.TOPIARY_HEAD = {
    freeze(s) {
      frozen = s;
      if (s == null) { init(); return; }
      measure();
      show(true);
      draw(s);
    },
  };
})();
