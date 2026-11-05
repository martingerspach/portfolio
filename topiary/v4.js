// Topiary v4 : ajustement du grand « topiary », film sous le hero, en-tête flottant, menu, copie de l'adresse.
// Les couleurs et la police sont les tokens de v4.css (palette Lin, Corail, Onest).
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Le grand « topiary » : un SVG cadré sur l'encre des lettres, centré sur son « i » sous le trait médian ---------- */
  const card = document.querySelector('.hero__card');
  const mark = document.querySelector('.hero__mark');
  const svg = mark && mark.querySelector('svg');
  const text = svg && svg.querySelector('text');

  // Le point du « i » par rapport à l'origine du glyphe, en px pour un corps de 100 px : on dessine le glyphe à 400 px
  // et on lit, en haut du glyphe, la tache du point (ses colonnes pour le centre, ses lignes pour le haut et le bas).
  const dots = new Map();
  function dotOf(ts, g100) {
    const key = `${ts.fontWeight} ${ts.fontFamily}`;
    if (dots.has(key)) return dots.get(key);
    const S = 400;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = `${ts.fontWeight} ${S}px ${ts.fontFamily}`;
    const m = x.measureText('i');
    const ox = S / 2, base = Math.ceil(m.actualBoundingBoxAscent) + 4;
    x.fillText('i', ox, base);
    const top = Math.max(0, Math.floor(base - m.actualBoundingBoxAscent));
    const h = Math.max(4, Math.round(m.actualBoundingBoxAscent * 0.5));
    const d = x.getImageData(0, top, S, h).data;
    let min = S, max = -1, r0 = -1, r1 = -1;
    for (let row = 0; row < h; row++) {
      let inked = false;
      for (let col = 0; col < S; col++) {
        if (d[(row * S + col) * 4 + 3] > 127) { inked = true; if (col < min) min = col; if (col > max) max = col; }
      }
      if (inked && r0 < 0) r0 = row;
      if (!inked && r0 >= 0) { r1 = row; break; }
    }
    const u = S / 100;
    const v = max < 0
      ? { cx: (g100.actualBoundingBoxRight - g100.actualBoundingBoxLeft) / 2, yTop: -g100.actualBoundingBoxAscent, yBot: -g100.actualBoundingBoxAscent * 0.82 }
      : { cx: ((min + max + 1) / 2 - ox) / u, yTop: (top + r0 - base) / u, yBot: (top + (r1 < 0 ? h : r1) - base) / u };
    dots.set(key, v);
    return v;
  }

  // Géométrie du hero pour les signatures (coordonnées de la capsule, en px CSS).
  const rectIn = (r, o) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
  function geometry(o) {
    const lede = card.querySelector('.hero__lede');
    const range = document.createRange();
    range.selectNodeContents(lede);
    const lines = [...range.getClientRects()].filter((r) => r.width > 2).map((r) => rectIn(r, o));
    const head = [...card.querySelector('.top').children]
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => rectIn(r, o));
    return { lede: lines, ledeBox: rectIn(lede.getBoundingClientRect(), o), head };
  }

  function fit() {
    if (!card || !text) return;
    const cs = getComputedStyle(card);
    const avail = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ts = getComputedStyle(text);
    const track = parseFloat(ts.letterSpacing) || 0; // en px, le texte est posé à 100 px

    // Encre réelle à 100 px. Les positions des lettres viennent du SVG lui-même (crénage et interlettrage compris),
    // l'encre de chaque lettre autour de son origine vient du canevas.
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${ts.fontWeight} 100px ${ts.fontFamily}`;
    const word = text.textContent;
    const glyphs = [...word].map((ch) => ctx.measureText(ch));
    let xs;
    try {
      xs = glyphs.map((_, i) => text.getStartPositionOfChar(i).x);
    } catch {
      let acc = 0; // repli : chasses du canevas plus l'interlettrage, sans le crénage
      xs = glyphs.map((g) => { const x = acc; acc += g.width + track; return x; });
    }
    let minX = Infinity, maxX = -Infinity, asc = 0, desc = 0;
    glyphs.forEach((g, i) => {
      minX = Math.min(minX, xs[i] - g.actualBoundingBoxLeft);
      maxX = Math.max(maxX, xs[i] + g.actualBoundingBoxRight);
      asc = Math.max(asc, g.actualBoundingBoxAscent);
      desc = Math.max(desc, g.actualBoundingBoxDescent);
    });
    const w = maxX - minX;
    const h = asc + desc;
    svg.setAttribute('viewBox', `${minX.toFixed(2)} ${(-asc).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);

    // Le « i » : le milieu de son point (lu sur un rendu du glyphe, car l'empattement d'un « i » à sérif décentre son encre)
    // et le haut de ce point.
    const iIdx = word.indexOf('i');
    const gI = glyphs[iIdx];
    const dot = dotOf(ts, gI);
    const iMid = xs[iIdx] + dot.cx;
    const iAsc = gI.actualBoundingBoxAscent;

    // 85 % de la largeur utile, plafonné par la place sous l'en-tête et le chapeau (48 px d'air au-dessus du chapeau).
    const head = card.querySelector('.top');
    const lede = card.querySelector('.hero__lede');
    const used = head.offsetHeight + lede.offsetHeight + parseFloat(getComputedStyle(lede).marginBottom)
      + parseFloat(getComputedStyle(mark).marginBottom) + 48;
    // Au téléphone, la capsule épouse son contenu (v4.css, --hero-free) : pas de plafond par la hauteur.
    const free = cs.getPropertyValue('--hero-free').trim() === '1';
    const width = Math.max(120, Math.min(avail * 0.85, free ? Infinity : ((card.clientHeight - used) * w) / h));
    const k = width / w;
    svg.style.width = `${width.toFixed(1)}px`;
    svg.style.height = `${(h * k).toFixed(1)}px`;

    // Le mot est centré sur son « i » : le trait médian tombe à l'aplomb du point.
    const off = Math.min(Math.max(avail / 2 - (iMid - minX) * k, 0), avail - width);
    svg.style.marginLeft = `${off.toFixed(1)}px`;

    // Le trait s'arrête un peu au-dessus du point du « i », au bout d'un long fondu.
    const sR0 = svg.getBoundingClientRect();
    const iTop = sR0.top - card.getBoundingClientRect().top + (asc - iAsc) * k;
    const end = Math.max(0, iTop - (innerWidth < 600 ? 12 : 16));
    card.style.setProperty('--axis-end', `${end.toFixed(1)}px`);
    card.style.setProperty('--axis-fade', `${Math.min(innerWidth < 600 ? 140 : 200, end * 0.45).toFixed(1)}px`);
    root.classList.add('is-fit');

    // Géométrie exportée : capsule, mot (ligne de base, hauteur d'x), point du « i », lignes du chapeau, en-tête.
    const o = card.getBoundingClientRect();
    const sx = sR0.left - o.left, sy = sR0.top - o.top;
    const base = sy + asc * k;
    const mo = ctx.measureText('o');
    const G = {
      W: card.clientWidth, H: card.clientHeight, pad: parseFloat(cs.paddingLeft), ax: card.clientWidth / 2,
      mark: { x: sx, y: sy, w: width, h: h * k, k, minX, base, xh: base - mo.actualBoundingBoxAscent * k,
        family: ts.fontFamily, weight: ts.fontWeight, track, word, xs: xs.map((v) => sx + (v - minX) * k) },
      dot: { x: sx + (iMid - minX) * k, y: base + ((dot.yTop + dot.yBot) / 2) * k, r: ((dot.yBot - dot.yTop) / 2) * k, top: base + dot.yTop * k },
      ...geometry(o),
    };
    // Le mot en filigrane du pied de page : même encre que le grand mot, coupé à la moitié exacte de sa hauteur
    const ghost = document.querySelector('.night__ghost');
    if (ghost) {
      ghost.querySelector('svg').setAttribute('viewBox', svg.getAttribute('viewBox'));
      ghost.style.setProperty('--ink-ar', (w / h).toFixed(5));
      ghost.style.setProperty('--ghost-ar', ((2 * w) / h).toFixed(5));
    }
    window.topiaryGeom = G;
    card.dispatchEvent(new CustomEvent('topiary:fit', { detail: G }));
  }
  window.topiaryFit = () => { dots.clear(); fit(); }; // le panneau de revue le rappelle après un changement de police

  if (card && text) {
    let fontsDone = false;
    const run = () => { fontsDone = true; fit(); };
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`500 100px ${getComputedStyle(text).fontFamily}`, 'topiary').then(run, run);
      setTimeout(() => { if (!fontsDone) run(); }, 2500);
    } else run();
    new ResizeObserver(() => { if (fontsDone) fit(); }).observe(card);
    // Une police arrivée après le premier ajustement (choisie dans le panneau, ou mémorisée) : on remesure tout.
    if (document.fonts) document.fonts.addEventListener('loadingdone', () => { dots.clear(); if (fontsDone) fit(); });
  }

  /* ---------- Le film qui grandit sous le hero (repli sans animations liées au défilement) ---------- */
  const reel = document.getElementById('reel');
  const media = reel && reel.querySelector('.reel__media');
  if (reel && !CSS.supports('animation-timeline: view()')) {
    let ticking = false;
    const update = () => {
      ticking = false;
      if (reduce.matches) { reel.style.transform = ''; media.style.transform = ''; return; }
      const p = Math.min(1, Math.max(0, scrollY / innerHeight));
      reel.style.transform = p < 1 ? `scale(${(0.94 + 0.06 * p).toFixed(4)})` : '';
      media.style.transform = p < 1 ? `scale(${(1.08 - 0.08 * p).toFixed(4)})` : '';
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    reduce.addEventListener('change', update);
    update();
  }

  /* ---------- La boucle vidéo : reel.js ---------- */

  /* ---------- En-tête flottant : header.js ---------- */

  /* ---------- Menu au téléphone ---------- */
  const menu = document.getElementById('menu');
  if (menu) {
    const openers = document.querySelectorAll('.menu-btn');
    openers.forEach((b) => b.addEventListener('click', () => {
      menu.showModal();
      openers.forEach((o) => o.setAttribute('aria-expanded', 'true'));
    }));
    menu.addEventListener('close', () => openers.forEach((o) => o.setAttribute('aria-expanded', 'false')));
    document.getElementById('menu-close').addEventListener('click', () => menu.close());
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.close()));
  }

  /* ---------- Copier l'adresse ---------- */
  const copy = document.getElementById('copy');
  const addr = document.getElementById('addr');
  const status = document.getElementById('copy-status');
  if (copy && addr) {
    let timer;
    const label = copy.textContent;
    const done = () => {
      copy.textContent = 'Adresse copiée';
      status.textContent = 'L’adresse est dans votre presse-papiers.';
      clearTimeout(timer);
      timer = setTimeout(() => { copy.textContent = label; status.textContent = ''; }, 2600);
    };
    const select = () => {
      const r = document.createRange();
      r.selectNodeContents(addr);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      status.textContent = 'Adresse sélectionnée : copiez-la avec Ctrl+C ou ⌘+C.';
    };
    copy.addEventListener('click', () => {
      try { navigator.clipboard.writeText(addr.textContent.trim()).then(done, select); } catch { select(); }
    });
  }
})();
