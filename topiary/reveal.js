// Topiary v4.1 : les apparitions, reprises d'alt-shift (les gestes et leurs réglages sont décrits dans reveal.css).
// Chaque élément apparaît une seule fois, quand il entre à l'écran (12 % visible, à 80 px au-dessus du bas, comme
// alt-shift). Ceux qui entrent ensemble se suivent de 80 ms, dans l'ordre de la page. Les titres apparaissent ligne
// à ligne : un texte simple est découpé en lignes le temps de l'apparition, puis remis tel quel.
(() => {
  const root = document.documentElement;
  const on = root.classList.contains('rv'); // posé en tête d'index.html : pas de « mouvements réduits », observateur présent
  window.TOPIARY_REVEAL = { on, pending: new Set(), revealAll() {} }; // le filet de sécurité d'index.html ne démasque plus la page
  if (!on) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const STEP = 80;         // entre deux éléments, ou deux lignes, qui apparaissent ensemble
  const AFTER_TITLE = 100; // un texte qui suit un titre
  const MAX_DELAY = 480;   // une longue file n'attend pas plus
  const DUR = { rise: 700, kinetic: 600, line: 400, wipe: 1050 };

  // Les cibles, et leur geste. Mêmes sélecteurs que l'état masqué de reveal.css. Une image masquée par clip-path n'est
  // jamais « à l'écran » pour l'observateur : on guette alors son parent (watch), comme alt-shift.
  // « plates » : les trois aplats du pied de page se dévoilent l'un après l'autre.
  const TARGETS = [
    ['.work__head .h2', 'kinetic'],
    ['.proj__media', 'wipe', (el) => el.parentElement],
    ['.proj__text', 'rise'],
    ['.pj__cap', 'wipe', (el) => el.parentElement], // Projets choisis (projets.css) : chaque capsule, puis le logo dessous
    ['.pj__name', 'rise'],
    ['.o-phr__title', 'kinetic'],
    ['#o-phr-p0 > .o-phr__lede', 'rise'],
    ['#o-phr-p0 > .o-phr__items > li', 'rise'],
    ['.o-phr__foot', 'rise'],
    ['.pied__title', 'kinetic'],
    ['.pied__text', 'rise'],
    ['.pied__mail', 'rise'],
    ['.pied__foot', 'rise'],
    ['.pied__art', 'plates'],
  ];
  const kindOf = new Map(), watchOf = new Map(), targetOf = new Map();
  TARGETS.forEach(([sel, kind, watch]) => document.querySelectorAll(sel).forEach((el) => {
    kindOf.set(el, kind);
    const w = (watch && watch(el)) || el;
    watchOf.set(el, w);
    targetOf.set(w, el);
  }));
  const pending = window.TOPIARY_REVEAL.pending;
  kindOf.forEach((_, el) => pending.add(el));

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // Les lignes d'un titre. La phrase de « Ce que nous faisons » a déjà les siennes au bureau (deux blocs) ; un texte
  // simple est découpé à ses retours à la ligne réels ; un contenu riche apparaît d'un seul tenant.
  function linesOf(el) {
    const own = [...el.children].filter((c) => c.matches('.o-phr__l1, .o-phr__l2') && getComputedStyle(c).display === 'block');
    if (own.length) {
      own.forEach((c) => c.classList.add('rv-line'));
      return { lines: own, restore: () => own.forEach((c) => { c.classList.remove('rv-line', 'rv-go-kinetic', 'rv-go-line'); c.style.removeProperty('--rv-d'); }) };
    }
    if (el.children.length) return null;
    const html = el.innerHTML;
    const words = el.textContent.trim().split(/[ \t\r\n]+/); // les espaces insécables gardent leurs mots ensemble
    el.innerHTML = words.map((w) => `<span>${esc(w)}</span>`).join(' ');
    const rows = [];
    let y = null;
    for (const s of el.children) {
      const t = s.getBoundingClientRect().top;
      if (y === null || Math.abs(t - y) > 2) { rows.push([]); y = t; }
      rows[rows.length - 1].push(s.textContent);
    }
    el.innerHTML = rows.map((r) => `<span class="rv-line">${esc(r.join(' '))}</span>`).join('');
    return { lines: [...el.children], restore: () => { el.innerHTML = html; } };
  }

  const go = (el, kind, d) => { el.style.setProperty('--rv-d', `${Math.round(d)}ms`); el.classList.add(`rv-go-${kind}`); };

  // Un élément apparaît. Rend la durée de son apparition (pour la suite de la file).
  function play(el, kind, delay) {
    let end, after;
    if (kind === 'kinetic' || kind === 'line') {
      const L = linesOf(el);
      if (L) {
        L.lines.forEach((ln, i) => go(ln, kind, delay + i * STEP));
        end = delay + (L.lines.length - 1) * STEP + DUR[kind];
        after = L.restore;
      }
    }
    if (kind === 'plates') {
      const ps = [...el.children];
      ps.forEach((p, i) => go(p, 'wipe', delay + i * STEP));
      end = delay + (ps.length - 1) * STEP + DUR.wipe;
      after = () => ps.forEach((p) => { p.classList.remove('rv-go-wipe'); p.style.removeProperty('--rv-d'); });
    }
    if (!after) {
      go(el, kind === 'line' ? 'kinetic' : kind, delay);
      end = delay + DUR[kind];
      after = () => { el.classList.remove(`rv-go-${kind === 'line' ? 'kinetic' : kind}`); el.style.removeProperty('--rv-d'); };
    }
    el.classList.add('rv-in');
    // Plus aucun style d'animation une fois arrivé : ni calque, ni filtre. (hold : un banc d'essai fige les apparitions.)
    const tidy = () => (window.TOPIARY_REVEAL.hold ? setTimeout(tidy, 200) : after());
    setTimeout(tidy, end + 80);
  }

  const order = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  function reveal(list) {
    let t = 0;
    list.filter((el) => pending.has(el)).sort(order).forEach((el) => {
      pending.delete(el);
      io.unobserve(watchOf.get(el));
      const kind = kindOf.get(el);
      play(el, kind, Math.min(t, MAX_DELAY));
      t += kind === 'kinetic' ? AFTER_TITLE : STEP;
    });
  }
  // Sans animation : un élément qu'on atteint au clavier, une section dont on a déjà choisi un mot, mouvements réduits
  function show(list) {
    list.forEach((el) => { pending.delete(el); io.unobserve(watchOf.get(el)); el.classList.add('rv-in'); });
  }

  const io = new IntersectionObserver((entries) => {
    reveal(entries.filter((e) => e.isIntersecting).map((e) => targetOf.get(e.target)));
  }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });
  pending.forEach((el) => io.observe(watchOf.get(el)));

  // Tout en bas de la page, la marge de 80 px ne serait jamais franchie : ce qui est à l'écran apparaît.
  let ticking = false;
  const bottom = () => {
    ticking = false;
    if (!pending.size || scrollY + innerHeight < root.scrollHeight - 2) return;
    reveal([...pending].filter((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  };
  addEventListener('scroll', () => { if (!ticking && pending.size) { ticking = true; requestAnimationFrame(bottom); } }, { passive: true });

  // Le focus clavier entre dans un élément encore masqué (au bord bas de l'écran), ou se pose sur un lien qui en
  // contient (une capsule des Projets choisis) : il apparaît aussitôt.
  document.addEventListener('focusin', (e) => {
    const els = [...pending].filter((p) => p.contains(e.target) || e.target.contains(p));
    if (els.length) show(els);
  });

  // « Ce que nous faisons » : un mot choisi avant la fin des apparitions, toute la section est là (o/phrase.js anime
  // le volet qui entre).
  const phr = document.querySelector('.o-phr');
  if (phr) {
    const seen = () => {
      phr.classList.add('rv-seen');
      show([...pending].filter((el) => phr.contains(el)));
    };
    ['click', 'keydown', 'pointerup'].forEach((t) => phr.addEventListener(t, (e) => {
      if (e.target.closest('.o-phr__w, .o-phr__next, .o-phr__panels')) seen();
    }, true));
  }

  // L'ouverture : la capsule et l'en-tête sont animés par reveal.css dès le chargement ; le chapeau arrive ligne à
  // ligne quand le grand mot est ajusté (v4.js, après le chargement de la police), au plus tôt à 250 ms.
  const card = document.querySelector('.hero__card');
  const lede = document.querySelector('.hero__lede');
  setTimeout(() => root.classList.add('rv-opened'), Math.max(0, 360 - performance.now())); // la capsule est ouverte
  if (lede) {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      requestAnimationFrame(() => play(lede, 'line', Math.max(0, 250 - performance.now())));
    };
    if (root.classList.contains('is-fit') || !card) start();
    else { card.addEventListener('topiary:fit', start, { once: true }); setTimeout(start, 3000); }
  }

  // Mouvements réduits en cours de route : tout est là, plus rien ne bouge.
  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    show([...pending]);
    if (lede) lede.classList.add('rv-in');
    root.classList.remove('rv');
  });

  window.TOPIARY_REVEAL.revealAll = () => reveal([...pending]); // pour les bancs d'essai
})();
