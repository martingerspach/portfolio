// Banc : le recoupement. Quand les sources se contredisent, le banc se partage en deux autour des deux
// réponses que donne le web ; puis Banc tranche : le banc de la réponse périmée pâlit et se défait,
// celui du texte en vigueur se resserre. Même matière que le hero (banc-school.js), sur un second canevas.
//
// Le cas est vrai : avant la loi n° 2024-364 du 22 avril 2024, un arrêt maladie non professionnel
// n'ouvrait aucun congé payé ; depuis, l'article L3141-5-1 du Code du travail en donne 2 jours
// ouvrables par mois (24 au plus par période de référence). Vérifié le 2026-11-06. Les nombres de
// pages (9 et 4) sont ceux de la démonstration.
//
// Le film n'avance que dans la boucle : il s'arrête avec la pause, hors écran et onglet caché.
import { createSchool, P } from './banc-school.js';

const params = new URLSearchParams(location.search);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const SHARE = 9 / 14;                   // part du banc qui suit la réponse périmée : 9 pages sur 14
const T_FACTS = 1.1;                    // s après le partage : les faits s'écrivent sous les chiffres
const PER_CHAR = 0.016;                 // s par caractère
const T_MIN = P('vmin', 3.2), T_MAX = P('vmax', 5);   // le verdict, quand les deux bancs sont formés

export function mountSplit({ isReduced, cssOn, isPaused, setPaused, onPause, phone }) {
  const sec = document.getElementById('recoupement');
  if (!sec) return;
  window.__bancSplit = true;            // la page a son script : la classe « js » posée en tête peut rester
  const $ = (s) => sec.querySelector(s);
  const canvas = $('.split-school');
  const stage = $('.split-stage');
  const nums = [...sec.querySelectorAll('.claim-n')];
  const units = [...sec.querySelectorAll('.claim-u')];
  const caps = [...sec.querySelectorAll('.claim-cap')];
  const facts = [...sec.querySelectorAll('.claim-f')];
  const pauseBtn = $('.pause');

  let school = null;
  try {
    // des poissons plus petits que ceux du hero : deux anneaux tiennent dans la place d'un
    school = createSchool(canvas, { small: (W) => P('sn', W >= 1024 ? 104 : W >= 700 ? 80 : 52), big: 0, curious: 0, size: P('sz', 0.86) });
  } catch (e) { console.warn('banc, recoupement', e); school = null; }
  if (!school) { canvas.remove(); pauseBtn.hidden = true; }

  const forced = params.has('coupe') ? clamp(Number(params.get('coupe')) || 0, 0, 2) : -1;
  // le film ne se joue qu'une fois, à l'arrivée ; sinon (mouvement réduit, état posé) tout est déjà là
  const armed = !isReduced() && forced < 0;
  let phase = 0;                        // 0 : un seul banc ; 1 : partagé ; 2 : verdict
  let started = false;

  /* ---------- l'écriture des faits : chaque caractère à sa place, révélé par l'opacité ----------
     (le texte entier est lu par les lecteurs d'écran dans un .sr ; cette copie leur est cachée) */
  let t0 = T_FACTS;
  const chars = facts.map((el) => {
    if (!armed) return { list: [], at: 0, k: 0 };
    const list = [];
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType !== 3) { walk(n); continue; }
        const frag = document.createDocumentFragment();
        for (const ch of n.data) { const sp = document.createElement('span'); sp.className = 'c'; sp.textContent = ch; frag.append(sp); list.push(sp); }
        n.replaceWith(frag);
      }
    };
    walk(el);
    const at = t0;
    t0 += list.length * PER_CHAR + 0.25;
    return { list, at, k: 0 };
  });

  /* ---------- la mise en page : zones calmes, zones évitées, anneaux ---------- */
  const rel = (r, s) => [r.left - s.left, r.top - s.top, r.right - s.left, r.bottom - s.top];
  const textRect = (el, s) => { const range = document.createRange(); range.selectNodeContents(el); return rel(range.getBoundingClientRect(), s); };
  const pad = (r, p) => [r[0] - p, r[1] - p, r[2] + p, r[3] + p];
  const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  const zone = (r, level, fade) => [...r, level, fade];

  let geo = null;
  function measure() {
    const s = sec.getBoundingClientRect();
    const q = textRect($('.split-q'), s);
    // la réponse en grand : le chiffre (sa boîte de ligne, serrée) et son unité
    const figs = nums.map((n, i) => union(rel(n.getBoundingClientRect(), s), textRect(units[i], s)));
    const capR = caps.map((c) => rel(c.getBoundingClientRect(), s));
    const W = s.width, H = s.height;
    const small = W < 601;
    // un anneau par réponse : il tourne autour du chiffre et de son unité, sans couvrir la légende
    const col = $('.claims').getBoundingClientRect().width / 2;
    const dist = Math.abs((figs[1][0] + figs[1][2]) - (figs[0][0] + figs[0][2])) / 2;
    const capTop = Math.min(...capR.map((r) => r[1]));
    // au téléphone, les poissons débordent de l'anneau d'un tiers environ : on garde la marge
    const spill = small ? 1.35 : 1.2;
    const rings = figs.map((f, i) => {
      const hw = (f[2] - f[0]) / 2, hh = (f[3] - f[1]) / 2;
      const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2;
      // le bord extérieur de l'anneau reste loin du bord de l'écran ; au milieu, les deux anneaux ne se touchent pas
      const lim = Math.min(cx - (small ? 6 : 28), W - cx - (small ? 6 : 28), dist / 2 - 14);
      const rx = Math.min(Math.max(hw * 1.6, col * P('rk', 0.24)) * (i ? 0.86 : 1), lim / spill);
      // en hauteur : entre la question et les légendes, sans les toucher ; jamais un œuf au bureau
      const room = Math.min(cy - q[3], capTop - cy) - (small ? 8 : 14);
      let ry = Math.min(Math.max(hh * 1.2, hh + (small ? 30 : 50)), room / 1.18);
      if (!small) ry = Math.min(ry, rx * 1.2);
      return { cx, cy, rx, ry };
    });
    // un seul banc, avant le partage : une ellipse qui enveloppe les deux places
    const mid = { cx: (rings[0].cx + rings[1].cx) / 2, cy: (rings[0].cy + rings[1].cy) / 2 };
    const one = { ...mid, rx: Math.abs(rings[1].cx - rings[0].cx) / 2 + (rings[0].rx + rings[1].rx) / 2 * 0.72, ry: Math.max(rings[0].ry, rings[1].ry) * 0.92 };
    one.rx = Math.min(one.rx, (W / 2 - 24) / 1.26);
    // le banc nage dans une bande : sous la question, au-dessus des légendes. Le plafond et le plancher
    // débordent loin hors du cadre : un poisson qui s'y égare est repoussé vers la bande, jamais de côté
    const far = 6000;
    const ceil = [-far, -far, W + far, q[3] + 6], floor = [-far, capTop - 10, W + far, H + far];
    const rects = [
      zone(ceil, 0, 26), zone(floor, 0, 22),
      zone(pad(rel(nums[0].getBoundingClientRect(), s), -6), 0.05, 18), zone(pad(rel(nums[1].getBoundingClientRect(), s), -6), 0.05, 18),
      zone(pad(textRect(units[0], s), 4), 0.06, 18), zone(pad(textRect(units[1], s), 4), 0.06, 18),
    ];
    const avoid = [ceil, floor, ...figs.map((r) => pad(r, -10))];
    geo = { W, H, small, rings, one, rects, avoid };
    return geo;
  }

  // les orbites : avant le partage, une seule ; ensuite, une par réponse, dans le sens du banc d'origine
  // (chaque poisson garde son cap au partage). Partagés, les deux bancs sont « tenus » : chaque poisson
  // a sa place et l'anneau se remplit en entier. Au verdict, le banc écarté lâche ses places, s'élargit,
  // ralentit et dérive ; le banc retenu se resserre.
  function aim() {
    if (!school || !geo) return;
    const { rings, one, small } = geo;
    school.orbit(one.cx, one.cy, one.rx, one.ry);
    if (phase < 1) return;
    const v = phase >= 2;
    const loose = v ? P('lx', 1.06) : 1;
    school.orbits([
      { ...rings[0], rx: rings[0].rx * loose, ry: rings[0].ry * loose, dir: 1, tightTo: v ? P('ta', -0.35) : P('ts', 0.5), pace: v ? P('pa', 0.55) : 1, lock: v ? 0 : 1, drift: v ? (small ? 8 : P('dr', 22)) : 0 },
      { ...rings[1], dir: 1, tightTo: v ? P('tb', 1) : P('ts', 0.5), pace: 1, lock: 1, drift: 0 },
    ]);
  }
  function layout() {
    if (!school || !cssOn()) return;
    const g = measure();
    school.resize(Math.round(g.W), Math.round(g.H));
    school.st.rects = g.rects.slice(0, 8);
    school.st.avoid = g.avoid;
    aim();
  }

  /* ---------- les temps du film ---------- */
  // le partage : les poissons de gauche (9 sur 14) suivent la réponse périmée, les autres le texte en vigueur ;
  // dans chaque banc, chacun prend la place libre la plus proche sur son anneau
  function split(now) {
    phase = Math.max(phase, 1);
    sec.classList.add('is-split');
    if (!school) return;
    aim();
    const order = [...school.fish].sort((a, b) => a.x - b.x);
    const n = order.length, k = Math.round(n * SHARE);
    order.forEach((f, i) => { f.g = i < k ? 0 : 1; });
    school.place([k, n - k], true);
    if (!now) school.burst(0.7);      // le banc se fend d'un coup, comme devant un obstacle
  }
  // le verdict : le banc de la réponse périmée pâlit, s'estompe et se défait ; l'autre se resserre
  function verdict(now) {
    phase = 2;
    sec.classList.add('is-verdict');
    if (!school) return;
    aim();
    school.dim(0, 0.32, now);
    school.dim(1, 1, now);
  }
  function showAll() { for (const c of chars) { c.list.forEach((sp) => sp.classList.add('on')); c.k = c.list.length; } }

  // un état posé d'un coup (mouvement réduit, pause, captures) : le banc s'installe hors écran
  function pose(p) {
    started = true;
    layout();                       // le banc naît à la première mise en page : il faut ses poissons avant de les répartir
    if (p >= 1) split(true);
    if (p >= 2) verdict(true);
    showAll();
    if (!school) return;
    school.settle();
    school.warm(p >= 1 ? 12 : 8);
    school.render();
  }

  // les deux bancs sont-ils formés ? (la plupart des poissons dans leur couloir, aucun grand trou dans les anneaux :
  // au plus 57° dans le grand banc, 75° dans le petit). Mesuré sur le film réel à 1 440 : vrai vers 2,9 s.
  function ready() {
    const a = school.ringStats(0), b = school.ringStats(1);
    return a.inFrac >= 0.68 && b.inFrac >= 0.75 && a.maxGap < 1.0 && b.maxGap < 1.3;
  }
  let film = null;                      // { t : temps du film (s), v : verdict rendu }
  function start() {
    if (started) return;
    started = true;
    if (!armed || isPaused() || !school) { pose(2); return; }
    split();
    film = { t: 0, v: false };
  }
  function tickFilm(dt) {
    if (!film) return;
    film.t += dt;
    for (const c of chars) {
      while (c.k < c.list.length && film.t >= c.at + c.k * PER_CHAR) c.list[c.k++].classList.add('on');
    }
    if (!film.v && film.t >= T_MIN && (film.t >= T_MAX || ready())) { film.v = true; verdict(); }
    if (film.v && chars.every((c) => c.k >= c.list.length)) film = null;
  }

  /* ---------- la boucle : arrêtée hors écran, onglet caché ou en pause ----------
     1000/75 : 60 images/s sur un écran à 60 Hz, 72 sur un écran à 144 Hz (une sur deux) */
  let running = !isReduced() && !params.has('fige');
  let visible = false, last = 0, raf = 0, wantAt = 0;
  function loop(now) {
    raf = 0;
    if (!running || isPaused() || !visible || document.hidden) { last = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!last) { last = now; return; }
    const dt = now - last;
    if (dt < 1000 / 75) return;
    last = now;
    // le banc entier se voit un instant (420 ms à l'écran) avant de se partager
    if (!started && wantAt && now - wantAt >= 420) start();
    const s = Math.min(dt, 34) / 1000;
    school.step(s);
    school.render();
    tickFilm(s);
  }
  function wake() { if (school && running && !isPaused() && visible && !document.hidden && !raf) raf = requestAnimationFrame(loop); }

  if (school) {
    new ResizeObserver(() => {
      if (!cssOn()) return;
      layout();
      if (!running || isPaused()) school.render();
    }).observe(sec);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; wake(); }, { threshold: 0 }).observe(sec);
    document.addEventListener('visibilitychange', wake);
    const go = () => {
      if (!cssOn()) { addEventListener('load', go, { once: true }); return; }
      layout();
      if (forced >= 0) pose(forced);
      else if (!armed) pose(2);
      else { school.warm(8); school.render(); }
      wake();
    };
    Promise.race([document.fonts.load('500 20px "JetBrains Mono"'), new Promise((r) => setTimeout(r, 1200))]).then(go, go);
    // les chiffres changent de taille quand Manrope arrive : les anneaux se recalent
    document.fonts.ready.then(() => { layout(); if (!running || isPaused()) school.render(); });
  } else if (forced >= 0 || !armed) pose(2);

  // le film part quand la scène est bien à l'écran, et y reste : un passage au défilement ne le lance pas
  if (forced < 0 && armed) {
    const io = new IntersectionObserver((es) => {
      if (started) { io.disconnect(); return; }
      if (!es[0].isIntersecting) { wantAt = 0; return; }
      // en pause (ou sans banc), l'état final est posé d'un coup
      if (isPaused() || !school) { start(); io.disconnect(); return; }
      wantAt = performance.now();
      wake();
    }, { threshold: P('seuil', 0.55) });
    io.observe(stage);
  }

  /* ---------- la pause : la même que celle du hero ---------- */
  const label = (p) => {
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.querySelector('.pause-long').textContent = p ? 'Relancer l’animation' : 'Mettre l’animation en pause';
    pauseBtn.querySelector('.pause-short').textContent = p ? 'Relancer' : 'Pause';
  };
  pauseBtn.addEventListener('click', () => setPaused(!isPaused()));
  onPause((p) => {
    label(p);
    // mis en pause avant le partage, la scène à l'écran : l'état final, sans mouvement
    if (p && !started && wantAt) start();
    wake();
  });
  if (isReduced()) pauseBtn.hidden = true;
  // au bureau, la pause se range quand elle passerait sous la barre de verre (comme celle du hero)
  new IntersectionObserver((es) => { pauseBtn.classList.toggle('is-tucked', !phone.matches && !es[0].isIntersecting && es[0].boundingClientRect.top < 120); },
    { rootMargin: '-76px 0px 0px 0px', threshold: 1 }).observe(pauseBtn);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    running = !isReduced() && !params.has('fige');
    pauseBtn.hidden = !running || !school;
    if (!running) { film = null; pose(2); }
    wake();
  });

  // banc d'essai : ?shot expose le banc du recoupement
  if (params.has('shot') && school) {
    window.__split = {
      school, start, pose,
      stop() { running = false; },
      tick(dt) { school.step(dt); school.render(); tickFilm(dt); },
      frame() { return canvas.toDataURL('image/png'); },
      phase: () => phase,
      filmT: () => (film ? film.t : -1),
    };
  }
}
