// Iris v3. Architecture et logo de la v1 ; les démos se jouent comme des films à l'arrivée ; verre liquide sur les commandes.
// Canon de mouvement (skill motion-launch) : grille de 0,5 s, départs à vitesse nulle (cubic-bezier(.55,0,.12,1)),
// une chose à la fois, le texte sort avant que la caméra parte, le texte qu'on lit ne bouge pas, aucune jauge.
// Références : planche de Fraunhofer (raies lettrées), spectres de plaques photographiques, films produit d'Apple et Linear.

import { mount as mountGlass, warm as warmGlass } from './glass.js';
import lumiere from './fonds/lumiere.js';
import horizon from './fonds/f-horizon.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Q = new URLSearchParams(location.search);
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => RMQ.matches || Q.get('rm') === '1';
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const NOW = () => performance.now();
if (Q.has('bench')) window.__rt = [];

// courbes : cubic-bezier résolue par Newton
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    return Y(clamp(t));
  };
}
const PUSH = bez(0.55, 0, 0.12, 1);     // caméra : départ à vitesse nulle, arrivée posée
const OUT = bez(0.22, 0.7, 0.18, 1);    // sortie douce
const DEV = bez(0.33, 0, 0.15, 1);      // développement d'une plaque
const seg = (t, a, b, f = (x) => x) => f(clamp((t - a) / (b - a)));

/* ---------- Données : couleur = type d'étape, largeur = durée, lettres = classes de défaut ---------- */
const RUNS = {
  '8f2c': {
    total: 40.4,
    // nom, type, durée (s), coût ($, appels de modèle seulement)
    steps: [['plan', 'model', 1.2, 0.004], ['get_order', 'read', 0.8], ['check_policy', 'model', 2.1, 0.006], ['refund_order', 'write', 30.0],
      ['decide_retry', 'model', 1.6, 0.003], ['refund_order', 'write', 1.2], ['reply', 'model', 3.5, 0.009]],
    lines: [['A', 10.3], ['C', 34.1], ['A', 36.4]],
  },
  c05e: {
    total: 21.6,
    steps: [['plan', 'model', 1.0, 0.003], ['check_stock', 'read', 0.9], [null, 'wait', 1.0], ['check_stock', 'read', 0.9], [null, 'wait', 2.0],
      ['check_stock', 'read', 0.9], [null, 'wait', 4.0], ['check_stock', 'read', 0.9], [null, 'wait', 5.8], ['check_stock', 'read', 0.8],
      ['reply', 'model', 3.4, 0.008]],
    // un refus 429 arrive à la fin de l'appel : chaque marqueur sur le bord droit de sa barre
    lines: [['B', 1.9], ['B', 3.8], ['B', 6.7], ['B', 11.6]],
  },
  '31a7': {
    total: 7.4,
    steps: [['plan', 'model', 0.9, 0.003], ['get_customer', 'read', 0.6], ['validate_address', 'model', 1.8, 0.005], ['update_address', 'write', 1.1],
      ['send_confirmation', 'write', 0.9], ['reply', 'model', 2.1, 0.006]],
    lines: [],
  },
};
// le rejeu ne montre que les étapes 4 à 6 (le reste ne change pas), avant et après, sur la même échelle
const TAIL = { from: 4.1, total: 36.9, steps: [[null, 'wait', 4.1], ['refund_order', 'write', 30.0], ['decide_retry', 'model', 1.6, 0.003], ['refund_order', 'write', 1.2]] };
RUNS['8f2c-tail'] = { ...TAIL, lines: [['A', 10.3], ['C', 34.1], ['A', 36.4]] };
RUNS['8f2c-fix'] = { ...TAIL, lines: [['A', 10.3], ['C', 34.1]] };
const ANSWERS = {
  '8f2c': ['Run 8f2c failed.', '<code>refund_order</code> timed out after the refund had gone through, so the retry refunded it a\u00a0second time.', 'Make the tool idempotent.'],
  c05e: ['Run c05e worked but took 21.6\u00a0s.', 'The stock API rate-limited four calls, and the agent backed off longer each time.', 'Cache the stock for a minute.'],
  '31a7': ['Run 31a7 is clean.', 'It finished its six steps in 7.4\u00a0s.', 'Nothing needs fixing.'],
};

// boucle partagée, plafonnée à 60 images/s ; v12 : `full` lève le plafond pour un mouvement qui accompagne le
// défilement (le filet de la navigation glissait à 72 i/s sur l'écran à 144 Hz, une position tenue deux images)
const subs = new Set(), full = new Set();
let rafId = 0, lastT = 0;
function tick(t) {
  rafId = 0;
  const due = t - lastT >= 12.5;
  if (due) lastT = t;
  for (const f of [...subs]) if (due || full.has(f)) { const t0 = NOW(); f(t); if (window.__rt) window.__rt.push(NOW() - t0); }
  if (subs.size) rafId = requestAnimationFrame(tick);
}
function onFrame(f, every = false) { subs.add(f); if (every) full.add(f); if (!rafId) rafId = requestAnimationFrame(tick); return () => { subs.delete(f); full.delete(f); }; }

/* ---------- 1. Fonds vivants : le héros « Caustiques » (v11 : la lumière de page, lightBg) et le pied « L'horizon » ----------
   Choisis par l'utilisateur le 2026-11-04 sur la planche des fonds (fonds.html). Chaque fond est un module au contrat du
   banc (fonds/<id>.js) : mount(host, ctx) rend { resize, frame(t), destroy }, frame est une fonction pure du temps. Ici :
   la boucle partagée, pause hors écran et onglet caché, mouvement réduit = l'image `still`, `?t=ms` fige l'instant.
   Le héros lance son entrée une fois le verre préparé (gate) ; le pied, à sa première apparition. */
const relBox = (host, el) => { const h = host.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height }; };
function livingBg(mod, host, boxes, gate = Promise.resolve()) {
  const tFix = Q.has('t') ? Number(Q.get('t')) / 1000 : null;
  const ctx = { kind: mod.kind, reduced: reduced(), frozen: tFix !== null, dpr: DPR, boxes };
  let inst = {};
  try { inst = mod.mount(host, ctx) || {}; } catch (e) { console.error(e); }
  if (!inst.frame) { host.style.background = '#080809'; return; }
  let t0 = null, stop = null, visible = false, armed = false;
  const still = mod.still != null ? mod.still : 8;
  const now = () => (tFix !== null ? tFix : reduced() ? still : t0 === null ? 0 : (NOW() - t0) / 1000);
  const draw = () => inst.frame(now());
  const size = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) inst.resize(r.width, r.height); };
  const run = () => {
    if (stop || !armed || !visible || document.hidden || tFix !== null || reduced()) return;
    if (t0 === null) t0 = NOW();
    stop = onFrame(draw);
  };
  const halt = () => { if (stop) { stop(); stop = null; } };
  size(); draw();
  new ResizeObserver(() => { size(); draw(); }).observe(host);
  if (document.fonts) document.fonts.ready.then(() => { size(); draw(); });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) run(); else halt(); }, { threshold: 0 }).observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });
  gate.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { armed = true; run(); })));
}
/* v11 : la lumière du héros irradie la page. Un seul canvas fixe sous le contenu (.lumiere, fonds/lumiere.js) ; les
   boîtes des textes sont mesurées en coordonnées de page (au redimensionnement, aux polices, quand la page change de
   hauteur) et la boucle ne lit que scrollY. Pause quand la planche et le pied couvrent la vue (tout ce qui suit le haut
   de la planche est opaque), onglet caché ; mouvement réduit et `?t=` : une image redessinée au défilement, sans
   parallaxe en mouvement réduit. */
function lightBg(gate) {
  const host = $('.lumiere');
  const tFix = Q.has('t') ? Number(Q.get('t')) / 1000 : null;
  let inst = {};
  try { inst = lumiere.mount(host, { dpr: DPR }) || {}; } catch (e) { console.error(e); }
  if (!inst.frame) return;
  const hero = $('.hero'), h1 = $('.hero .h1'), paper = $('.paper'), film = $('.film');
  // [élément, force, fondu (px), fixe]
  // (la barre de l'en-tête est du verre qui réfracte son pourtour : sa boîte est plus forte et plus large)
  const marks = [[$('.top .bar'), 0.96, 64, true], [h1, 0.8, 150], [$('.hero-foot p'), 0.94, 130], [$('.hero .cta'), 0.9, 90],
    ...$$('.sec-head .h2').map((e) => [e, 0.93, 170]), ...$$('.sec-head .lead').map((e) => [e, 0.97, 170])];
  const textBox = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
  let doc = [], title = { x: 0, y: 0, w: 1, h: 1 }, heroH = 1, cutY = Infinity, col = 600;
  const measure = () => {
    const y0 = scrollY;
    doc = marks.map(([el, s, f, fixed]) => { const r = el.matches('.h1, .h2, p') ? textBox(el) : el.getBoundingClientRect(); return [r.left, r.top + (fixed ? 0 : y0), r.width, r.height, s, f, !!fixed]; });
    const r = textBox(h1); title = { x: r.left, y: r.top + y0, w: r.width, h: r.height };
    heroH = hero.offsetHeight;
    // tout ce qui suit le haut plein de la planche est opaque (planche, bande sous l'arc, pied)
    cutY = paper.getBoundingClientRect().top + y0 + (parseFloat(getComputedStyle(paper).getPropertyValue('--fade')) || 0);
    col = film.getBoundingClientRect().width / 2;
  };
  const scene = () => {
    // les fondus des boîtes suivent la largeur de la vue (au téléphone, 150 px de fondu mangeraient toute la largeur)
    const sy = scrollY, u = clamp(sy / (heroH * 0.9)), fk = clamp(innerWidth / 1100, 0.45, 1);
    return {
      sy, still: reduced(), col, level: 0.95, cut: cutY - sy,
      heroW: 1 - u * u * (3 - 2 * u),
      title: { x: title.x, y: title.y - sy, w: title.w, h: title.h },
      boxes: doc.map((b) => [b[0], b[6] ? b[1] : b[1] - sy, b[2], b[3], b[4], b[5] * fk]),
    };
  };
  let t0 = null, stop = null, armed = false, pend = 0;
  const now = () => (tFix !== null ? tFix : reduced() ? lumiere.still : t0 === null ? 0 : (NOW() - t0) / 1000);
  const covered = () => cutY - scrollY <= 0;
  const draw = () => inst.frame(now(), scene());
  const live = () => armed && !document.hidden && tFix === null && !reduced() && !covered();
  // v12 : sa propre boucle. Plafonnée comme la boucle partagée (12,5 ms), la lumière suivait le défilement une image
  // sur deux à 144 Hz (le contenu à chaque image) : sa parallaxe et ses boîtes saccadaient. Elle dessine maintenant à
  // chaque image tant que scrollY change et pendant l'entrée ; en dérive seule, toutes les 12,5 ms (la dérive est lente).
  let lastD = -1e9, lastY = NaN;
  const loop = (ts) => {
    raf = requestAnimationFrame(loop);
    const sy = scrollY;
    if (sy !== lastY || ts - lastD >= 12.5 || now() < 2.6) { lastD = ts; lastY = sy; draw(); }
  };
  let raf = 0, lead = 0;
  const run = () => { if (stop || !live()) return; if (t0 === null) t0 = NOW() - lead; raf = requestAnimationFrame(loop); stop = () => cancelAnimationFrame(raf); };
  const halt = () => { if (stop) { stop(); stop = null; } };
  const once = () => { if (!stop && !pend) pend = requestAnimationFrame(() => { pend = 0; if (!stop && !covered()) draw(); }); };
  const size = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) inst.resize(r.width, r.height); };
  size(); measure(); draw();
  new ResizeObserver(() => { size(); measure(); draw(); }).observe(host);
  new ResizeObserver(() => { measure(); once(); }).observe(document.body);
  if (document.fonts) document.fonts.ready.then(() => { measure(); draw(); });
  addEventListener('scroll', () => { if (live()) run(); else { halt(); once(); } }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });
  // levée du rideau du portfolio : l'exposition part 0,4 s plus loin dans sa courbe (avant, la lumière ne pointait que
  // 0,6 s après le départ des derniers carrés : un temps de noir immobile entre les deux)
  gate.then((v) => requestAnimationFrame(() => requestAnimationFrame(() => { lead = v && v[1] === 'reveal' ? 400 : 0; armed = true; run(); })));
}
function footBg() {
  const host = $('.ft-bg');
  livingBg(horizon, host, () => ({ title: relBox(host, $('.ft .h2')), text: relBox(host, $('.ft .lead')), field: relBox(host, $('.ft .field')), input: relBox(host, $('.ft .field input')), primary: relBox(host, $('.ft .field .btn')), bar: relBox(host, $('.ft-bar')) }));
}
/* ---------- 2. Les démos : des diagrammes de trace, joués comme des films ----------
   v6 : une exécution est une cascade de spans. Une ligne par étape : son nom, son type (le mot dans sa teinte), sa barre
   à sa place dans le temps, sa durée et, pour un appel de modèle, son coût ; le total du run dans l'en-tête. Les
   événements se posent sur leur barre avec leur mot (plus de lettres à décoder). Une chose à la fois. Aucune jauge :
   une barre se trace en 0,55 s quelle que soit sa durée, sa durée paraît ensuite, aucun compteur ne court.
   La hauteur de la scène est la plus grande des trois exécutions : changer d'exécution ne déplace rien. */
const DRAW = bez(0.45, 0, 0.15, 1);
const STEPS_OF = (run) => {
  let t = 0, gap = 0; const out = [];
  for (const [name, type, d, cost = 0] of run.steps) {
    if (name) { out.push({ name, type, a: t, b: t + d, d, cost, wait: gap }); gap = 0; } else gap += d;
    t += d;
  }
  return out;
};
const rowOf = (sp, tm) => sp.findIndex((s) => tm >= s.a - 1e-6 && tm <= s.b + 1e-6);
const costOf = (run) => run.steps.reduce((a, s) => a + (s[3] || 0), 0);
const money = (c) => '$' + c.toFixed(3);
const textW = (() => {
  const c = document.createElement('canvas').getContext('2d');
  return (s, px = 15, w = 400, fam = '"Atkinson Mono Iris", ui-monospace, monospace') => { c.font = `${w} ${px}px ${fam}`; return Math.ceil(c.measureText(s).width); };
})();

// partitions : ev = entrée de chaque événement, lit = lignes tenues éclairées (0 = dès le départ, sinon l'instant où
// elles se rallument), dimAt / relight = les autres lignes s'effacent puis reviennent, say = les trois phrases
const SCRIPT = {
  '8f2c': {
    title: 'Refund', state: 'failed', bad: true, words: ['refund sent', 'timed out', 'refunded again'], kinds: ['a', 'f', 'f'],
    ev: [4.1, 5.4, 7.7], dimAt: 3.75, relight: 9.1, lit: { 3: 0, 4: 6.4, 5: 6.4 }, link: [3, 6.5],
    stateAt: 5.5, say: [5.7, 8.0, 9.4], dur: 10.7,
    // l'encart s'ouvre une fois « timed out » posé (5,4 s + 0,42 s) : il ne devance pas la preuve
    insp: { ev: 0, at: 5.85, title: 'refund_order', lines: [['amount', '49.00 EUR'], ['status', 'refunded'], ['response', 'none after 30.0 s', 'f']] },
  },
  c05e: {
    title: 'Stock check', state: 'slow', words: ['rate-limited', 'rate-limited', 'rate-limited', 'rate-limited'], kinds: ['f', 'f', 'f', 'f'],
    ev: [4.05, 4.5, 4.95, 5.4], waitsAt: 6.2, dimAt: 3.75, relight: 8.3, lit: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    insp: { ev: 3, at: 5.9, title: 'check_stock', lines: [['status', '429 rate limited', 'f'], ['attempt', '4 of 5'], ['next wait', '5.8 s']] },
    stateAt: 6.2, say: [6.7, 7.9, 9.0], dur: 9.9,
  },
  '31a7': { title: 'Address change', state: 'clean', good: true, words: [], kinds: [], ev: [], stateAt: 3.4, say: [3.5, 4.0, 4.5], dur: 5.4 },
};

function traceView(host, extraCls = '') {
  const root = document.createElement('div');
  root.className = 'tr ' + extraCls;
  host.appendChild(root);
  const v = { root, rows: [], head: null };
  const mk = (cls, html, parent = root, tag = 'div') => {
    const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; parent.appendChild(e); return e;
  };
  // écrit une propriété seulement si elle change
  const put = (el, k, val) => { if (el['_' + k] !== val) { el['_' + k] = val; el.style.setProperty(k, val); } };
  v.put = put;

  v.build = (id, o = {}) => {
    root.textContent = '';
    v.o = o; v.run = RUNS[id]; v.sp = STEPS_OF(v.run);
    // en-tête : le nom en sans, l'identifiant et l'état en mono ; le coût total à droite
    const head = v.head = mk('tr-head', '');
    v.hTitle = mk('tr-title', o.title || '', head, 'span');
    v.hId = mk('tr-id', o.label || id, head, 'span');
    v.hState = o.state ? mk('tr-state' + (o.bad ? ' is-bad' : o.good ? ' is-good' : ''), o.state, head, 'span') : null;
    v.hState2 = o.state2 ? mk('tr-state is-good', o.state2, head, 'span') : null;
    v.hCost = o.noCost ? null : mk('tr-cost', o.note || money(o.total != null ? o.total : costOf(v.run)), head, 'span');
    v.ax0 = mk('tr-ax', (v.run.from || 0).toFixed(v.run.from ? 1 : 0) + ' s');
    v.ax1 = mk('tr-ax tr-ax--r', v.run.total.toFixed(1) + ' s');
    v.rows = v.sp.map((s) => {
      const el = mk('tr-row', '');
      const r = { s, el, ev: [], wait: null };
      r.name = mk('tr-name', s.name, el, 'span');
      r.type = mk('tr-type k-' + s.type, s.type, el, 'span');
      r.bar = mk('tr-bar tb-' + s.type, '', el, 'i');
      r.dur = mk('tr-dur', s.d.toFixed(1) + ' s', el, 'span');
      r.cost = s.cost ? mk('tr-c', money(s.cost), el, 'span') : null;
      return r;
    });
    // événements : chacun dans sa ligne, qui l'éteint avec elle ; le mot dit ce qui s'est passé
    const words = o.words || [], kinds = o.kinds || [];
    const evs = v.run.lines.map(([, tm], k) => [tm, words[k] || '', kinds[k] || 'f']).concat(o.extra || []);
    v.evs = evs.map(([tm, word, kind], k) => {
      const r = v.rows[rowOf(v.sp, tm)];
      const el = mk('tr-ev is-' + kind, '', r.el);
      const line = kind === 'ok' ? null : mk('', '', el, 'i');
      const lab = mk('', '', el, 'span');
      const e = { tm, word, kind, el, line, lab, k };
      r.ev.push(e);
      return e;
    });
    v.waits = [];
    v.rows.forEach((r, i) => {
      if (i === 0 || r.s.wait < 0.05) return;
      const el = mk('tr-wait', '', r.el);
      const w = { r, prev: v.rows[i - 1].s.b, d: r.s.wait, el, line: mk('', '', el, 'i'), lab: mk('', '', el, 'span') };
      r.wait = w; v.waits.push(w);
    });
    // l'inspecteur : ce que l'appel a envoyé et reçu, ouvert au moment de la faute (bureau seulement)
    v.insp = null;
    if (o.insp) {
      const box = mk('tr-insp', '');
      mk('tr-insp-t', o.insp.title, box, 'span');
      for (const [k, val, kind] of o.insp.lines) {
        const row = mk('tr-insp-r', '', box, 'span');
        mk('tr-insp-k', k, row, 'span');
        mk('tr-insp-v' + (kind ? ' is-' + kind : ''), val, row, 'span');
      }
      v.insp = { box, o: o.insp, lead: mk('tr-insp-lead', '') };
    }
    v.link = null;
    if (o.link != null) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tr-link');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('pathLength', '1');
      svg.appendChild(p); root.appendChild(svg);
      v.link = { svg, p, i: o.link };
    }
  };

  // mise en place. Bureau : nom et type à gauche, barres dans la colonne du temps, durée et coût toujours à droite de
  // la barre (la colonne du temps leur garde la place), mots au-dessus de la barre. Téléphone : nom, type, coût et
  // durée sur une ligne, la barre dessous, les mots sous la barre sur une ou deux voies. Jamais un mot supprimé.
  v.layout = ({ x = 0, y = 0, w, mob, top, padX, short: shortMode = false }) => {
    v.mob = mob;
    root.style.left = x + 'px'; root.style.top = y + 'px'; root.style.width = w + 'px';
    root.classList.toggle('is-mob', mob);
    const nameRows = v.o.names || v.rows.map((r) => [r.s.name, r.s.type]);
    // v8 : le type forme sa propre colonne, alignée à gauche, à 20 px du nom le plus long
    const maxN = Math.max(...nameRows.map(([n]) => textW(n))), maxT = Math.max(...nameRows.map(([, t]) => textW(t)));
    const typeX = maxN + 20;
    const nameW = mob ? 0 : clamp(typeX + maxT + 8, 168, 260);
    // aux hauteurs courtes, le coût par étape cède sa place à l'axe du temps (le total reste dans l'en-tête)
    const stepCost = !(shortMode && !mob);
    const tailW = mob ? 0 : Math.max(...v.rows.map((r) => textW(r.dur.textContent) + (r.cost && stepCost ? 14 + textW(r.cost.textContent) : 0))) + 12;
    const x0 = padX + nameW + (mob ? 0 : 28), x1 = w - padX - tailW;
    const T0 = v.run.from || 0;
    const X = (tm) => x0 + ((tm - T0) / (v.run.total - T0)) * (x1 - x0);
    v.X = X;
    Object.assign(v.head.style, { left: padX + 'px', top: top + 'px', width: (w - 2 * padX) + 'px' });
    if (v.hState2) { v.hState2.textContent = mob ? 'with the fix' : v.o.state2; v.hState2.style.left = v.hState.offsetLeft + 'px'; }
    v.head.style.flexWrap = mob ? 'wrap' : '';
    v.head.style.rowGap = mob ? '6px' : '';
    const headH = mob ? Math.max(18, v.head.offsetHeight || 18) : 18;
    const axY = shortMode && !mob ? top : top + (mob ? headH + 22 : 46);
    v.ax0.hidden = v.ax1.hidden = !!v.o.noAxis;
    // aux hauteurs courtes, l'axe monte sur la ligne de l'en-tête : « 0 s » est implicite
    if (shortMode && !mob) v.ax0.hidden = true;
    v.ax0.style.left = x0 + 'px'; v.ax0.style.top = axY + 'px';
    v.ax1.style.left = (x1 - textW(v.ax1.textContent)) + 'px'; v.ax1.style.top = axY + 'px';
    const big = !!v.o.big;
    const barH = mob ? (big ? 12 : 10) : (big && !shortMode ? 18 : 14);
    const hideType = mob && w < 330;
    let yy = v.o.noAxis ? top + (mob ? headH + 16 : 40) : axY + (mob ? 30 : shortMode ? 30 : 32);
    const lo = mob ? padX : x0 - 18, hi = mob ? w - padX : w - padX;
    const short = !mob && !!shortMode;
    const rhs = [];
    // les voies au-dessus et au-dessous de la barre peuvent passer au-dessus de la colonne des noms (autre ligne) ;
    // la ligne de la barre, non
    const loLane = padX, loBar = x0 - 14;
    // le format des attentes vaut pour tout le run : « wait x s » avant le trait si toutes tiennent, sinon « x s »
    const wTxt = (d, full) => (full ? 'wait ' : '') + d.toFixed(1) + '\u00a0s';
    const fitsBar = (full) => v.rows.every((r) => !r.wait || X(r.wait.prev) - 10 - (textW(wTxt(r.wait.d, full)) + 2) >= loBar);
    const wFull = mob ? true : fitsBar(true) || !fitsBar(false);
    const wInline = !mob && fitsBar(wFull);
    const costMob = mob ? v.rows.every((r) => !r.cost || padX + textW(r.s.name) + (hideType ? 0 : 10 + textW(r.s.type)) + 16 <= x1 - textW(r.dur.textContent) - 14 - textW(r.cost.textContent)) : stepCost;
    v.rows.forEach((r) => {
      const s = r.s;
      if (r.cost) r.cost.style.display = costMob ? '' : 'none';
      const nw = textW(s.name), tw = textW(s.type), dw = textW(r.dur.textContent), cw = r.cost && costMob ? textW(r.cost.textContent) : 0;
      r.type.style.display = hideType ? 'none' : '';
      // voies des mots : 0 puis 1 ; un mot ne touche jamais un autre mot ni la durée (16 px d'air)
      const lanes = [[], []];
      const barY0 = mob ? 26 : short ? 25 : 30;
      const laneTop = (k) => (k === -2 ? 2 : k < 0 ? Math.round(barY0 + barH / 2 - 9) : mob ? barY0 + barH + 9 + k * 21 : (k === 0 ? barY0 - 25 : barY0 + barH + 6));
      const nameLine = mob ? [[padX, padX + nw + (hideType ? 0 : 10 + tw)], [x1 - dw - (cw ? 14 + cw : 0), x1]] : [];
      if (!mob) {
        const after = X(s.b) + 12;
        lanes[0].push([after, after + dw + (cw ? 14 + cw : 0)]);
      }
      const fits = (k, a, b) => a >= (mob ? lo : loLane) && b <= hi && lanes[k].every(([c, d]) => b + 16 <= c || a >= d + 16);
      const items = r.ev.map((e) => ({ x: X(e.tm), w: textW(e.word) + 2, e })).filter((it) => it.e.word);
      if (r.wait) items.push({ x: X(s.a), w: textW(wTxt(r.wait.d, wFull)) + 2, wait: r.wait });
      const placed = [];
      for (const it of items) {
        const sides = it.e && it.e.kind === 'ok' ? ['c', 'l', 'r'] : it.wait ? ['l'] : ['r', 'l'];
        let pick = null;
        if (it.wait && wInline) pick = { k: -1, a: X(it.wait.prev) - 10 - it.w };
        if (!pick && mob && it.wait) { const a = X(it.wait.prev) - 10 - it.w; if (a >= padX) pick = { k: -1, a }; }
        if (!pick && mob && it.e) {
          for (const side of sides) {
            const a = side === 'r' ? it.x + 8 : side === 'l' ? it.x - 8 - it.w : it.x - it.w / 2;
            if (a >= padX && a + it.w <= hi && nameLine.every(([c, d]) => a + it.w + 16 <= c || a >= d + 16)) { pick = { k: -2, a }; break; }
          }
        }
        if (!pick) for (const k of (it.wait ? [1] : [0, 1])) {
          for (const side of sides) {
            const a = side === 'r' ? it.x + 8 : side === 'l' ? it.x - 8 - it.w : it.x - it.w / 2;
            if (fits(k, a, a + it.w)) { pick = { k, a }; break; }
          }
          if (pick) break;
        }
        if (!pick) pick = { k: 1, a: clamp(it.x - it.w / 2, lo, hi - it.w) };
        if (pick.k >= 0) lanes[pick.k].push([pick.a, pick.a + it.w]);
        if (pick.k === -2) nameLine.push([pick.a, pick.a + it.w]);
        placed.push({ ...it, ...pick });
      }
      const used1 = placed.some((p) => p.k === 1);
      const hasLab = placed.some((p) => p.k >= 0);
      const rh = mob ? (used1 ? barY0 + barH + 54 : hasLab ? barY0 + barH + 33 : barY0 + barH + 12) : used1 ? barY0 + barH + 28 : barY0 + barH + (short ? 6 : 8);
      rhs.push(rh);
      r.barY = barY0; r.barH = barH;
      const bx = X(s.a), bw = Math.max(3, X(s.b) - bx);
      Object.assign(r.bar.style, { left: bx.toFixed(2) + 'px', top: barY0 + 'px', height: barH + 'px' }); r.bar.style.setProperty('--bw', bw.toFixed(2) + 'px');
      const ty = mob ? 2 : Math.round(barY0 + barH / 2 - 9);
      Object.assign(r.name.style, { left: padX + 'px', top: ty + 'px' });
      if (mob) {
        Object.assign(r.type.style, { left: (padX + nw + 10) + 'px', top: ty + 'px' });
        Object.assign(r.dur.style, { left: (x1 - dw) + 'px', top: ty + 'px' });
        if (r.cost) Object.assign(r.cost.style, { left: (x1 - dw - 14 - cw) + 'px', top: ty + 'px' });
      } else {
        Object.assign(r.type.style, { left: (padX + typeX) + 'px', top: ty + 'px' });
        const after = X(s.b) + 12;
        Object.assign(r.dur.style, { left: after + 'px', top: ty + 'px' });
        if (r.cost) Object.assign(r.cost.style, { left: (after + dw + 14) + 'px', top: ty + 'px' });
      }
      r.lineTop = (mob ? [2, 20] : [ty, ty + 18]);
      r.obst = mob ? [[padX, padX + nw + (hideType ? 0 : 10 + tw)], [x1 - dw - (cw ? 14 + cw : 0), x1]] : [];
      r.ev.forEach((e) => {
        const ex = X(e.tm);
        // calé au pixel : un filet de 2 px net, jamais à cheval sur deux pixels
        e.el.style.left = Math.round(ex) + 'px';
        const p = placed.find((q) => q.e === e);
        e.lab.textContent = e.word;
        const lt = p ? laneTop(p.k) : laneTop(0);
        if (p) Object.assign(e.lab.style, { left: (p.a - Math.round(ex)).toFixed(1) + 'px', top: lt + 'px' });
        e.x = Math.round(ex); e.labTop = lt;
        if (e.line) {
          // le filet traverse la barre et rejoint son mot
          // sans mot, le filet ne fait que traverser la barre
          const up = p && (p.k === -2 || (!mob && p.k === 0));
          const a = !p ? barY0 - 5 : up ? Math.min(lt + 2, barY0 - 5) : barY0 - 5, b = !p ? barY0 + barH + 5 : up ? barY0 + barH + 5 : Math.max(barY0 + barH + 5, lt + 16);
          Object.assign(e.line.style, { top: a + 'px', height: (b - a) + 'px' });
        }
      });
      if (r.wait) {
        const wa = X(r.wait.prev), wb = X(s.a);
        Object.assign(r.wait.el.style, { left: wa.toFixed(2) + 'px', top: '0px' });
        r.wait.line.style.top = (barY0 + barH / 2) + 'px'; r.wait.line.style.setProperty('--bw', Math.max(0, wb - wa - 3).toFixed(2) + 'px');
        const p = placed.find((q) => q.wait === r.wait);
        r.wait.lab.textContent = wTxt(r.wait.d, wFull);
        Object.assign(r.wait.lab.style, { left: (p.a - wa).toFixed(1) + 'px', top: laneTop(p.k) + 'px' });
      }
    });
    // une grille régulière : toutes les lignes d'un run ont la même hauteur
    const rhMax = Math.max(...rhs);
    v.rows.forEach((r, i) => { const h = mob ? rhs[i] : rhMax; r.top = yy; Object.assign(r.el.style, { top: yy + 'px', height: h + 'px', width: w + 'px' }); yy += h; });
    if (v.link) {
      // le filet de cause : la fin du délai descend vers la décision de relancer ; jamais contre un texte (8 px)
      const i = v.link.i, R = v.rows, ra = R[i], rb = R[i + 1];
      const xa = X(ra.s.b), ya = ra.top + ra.barY + ra.barH + 2, xb = X(rb.s.a), yb = rb.top + rb.barY - 2;
      const clash = rb.obst.some(([a, b]) => xa > a - 8 && xa < b + 8);
      v.link.p.setAttribute('d', `M${xa.toFixed(1)} ${ya.toFixed(1)}V${(yb - 5).toFixed(1)}Q${xa.toFixed(1)} ${yb.toFixed(1)} ${(xa + Math.min(5, Math.max(0, xb - xa))).toFixed(1)} ${yb.toFixed(1)}`);
      v.link.svg.setAttribute('width', w); v.link.svg.setAttribute('height', yy);
      v.link.svg.style.display = clash ? 'none' : '';
    }
    if (v.insp) {
      const e = v.evs[v.insp.o.ev], r = v.rows.find((q) => q.ev.includes(e));
      const show = !mob && w >= 900 && r && v.rows.indexOf(r) >= 3;
      v.insp.box.hidden = !show; v.insp.lead.hidden = !show;
      v.rows.forEach((q) => q.el.classList.toggle('is-insp', show && q === r));
      if (show) {
        // sa hauteur réelle (la formule 22 px par ligne la surestimait de 2 px : le filet finissait sous l'encart)
        const bh = v.insp.box.offsetHeight || 22 * (v.insp.o.lines.length + 1) + 18;
        const top = Math.round(r.top + e.labTop - 8 - bh);
        // jamais sur le texte d'une ligne du dessus : à droite de leur durée et de leur coût (20 px d'air)
        // (le bord gauche de l'encart, son liseré d'un pixel, dans l'axe du filet qui monte de l'événement)
        let left = e.x;
        for (const q of v.rows) {
          if (q.top + q.barY + q.barH < top || q.top > top + bh) continue;
          const tail = q.dur.offsetParent ? parseFloat(q.dur.style.left) + textW(q.dur.textContent) + (q.cost ? 14 + textW(q.cost.textContent) : 0) : 0;
          left = Math.max(left, tail + 20);
        }
        // posé sur son filet, l'encart a un coin bas gauche droit : le filet monte et devient son bord. Décalé à droite,
        // le filet file sur la ligne du bord bas et passe dessous (encart au-dessus) : il rejoint le bord droit, pas le
        // coin arrondi. Il part du haut du filet de l'événement.
        const flush = left - e.x < 1;
        const y0 = top + bh - 1, y1 = Math.round(r.top + e.labTop + 2);
        Object.assign(v.insp.box.style, { left: left + 'px', top: top + 'px', borderBottomLeftRadius: flush ? '0' : '' });
        Object.assign(v.insp.lead.style, { left: e.x + 'px', top: y0 + 'px', width: (flush ? 1 : left - e.x + 16) + 'px', height: Math.max(0, y1 - y0) + 'px', borderTopLeftRadius: flush ? '0' : '' });
      }
    }
    return yy;
  };

  // un état : opacités et tracés ; rien d'autre ne bouge
  v.paint = (P) => {
    put(v.head, 'opacity', P.head.toFixed(3));
    if (v.hState) put(v.hState, 'opacity', P.state.toFixed(3));
    if (v.hState2) put(v.hState2, 'opacity', (P.state2 || 0).toFixed(3));
    if (v.hCost) put(v.hCost, 'opacity', (P.cost == null ? P.state : P.cost).toFixed(3));
    put(v.ax0, 'opacity', P.head.toFixed(3)); put(v.ax1, 'opacity', P.head.toFixed(3));
    v.rows.forEach((r, i) => {
      const q = P.rows[i];
      put(r.el, 'opacity', q.o.toFixed(3));
      put(r.name, 'opacity', q.a.toFixed(3)); put(r.type, 'opacity', q.a.toFixed(3));
      put(r.bar, '--p', q.p.toFixed(4));
      put(r.bar, '--fill', (q.fill == null ? 1 : q.fill).toFixed(3));
      put(r.bar, 'opacity', (q.bo == null ? 1 : q.bo).toFixed(3));
      put(r.dur, 'opacity', q.d.toFixed(3));
      if (r.cost) put(r.cost, 'opacity', q.d.toFixed(3));
    });
    v.evs.forEach((e) => {
      const q = P.ev[e.k] || { m: 1, l: 1 };
      if (e.line) put(e.line, '--m', q.m.toFixed(4));
      put(e.lab, 'opacity', q.l.toFixed(3));
      put(e.el, 'opacity', (q.o == null ? 1 : q.o).toFixed(3));
    });
    v.waits.forEach((w, k) => {
      const q = P.waits[k] || { p: 0, l: 0 };
      put(w.line, '--p', q.p.toFixed(4)); put(w.lab, 'opacity', q.l.toFixed(3));
    });
    if (v.link) put(v.link.p, 'stroke-dashoffset', (1 - P.link).toFixed(4));
    if (v.insp) {
      put(v.insp.box, 'opacity', (P.insp || 0).toFixed(3)); put(v.insp.lead, 'opacity', (P.insp || 0).toFixed(3));
      v.rows.forEach((q) => put(q.el, '--hl', (q.el.classList.contains('is-insp') ? P.insp || 0 : 0).toFixed(3)));
    }
  };
  return v;
}

function demoEngine(fig, { duration, frame, layout, onEnd }) {
  const stage = $('.film-stage', fig);
  const btn = $('.ctl', fig);
  const dur = typeof duration === 'function' ? duration : () => duration;
  const st = { t: 0, playing: false, ended: false, started: false, autoPaused: false, t0: 0, stop: null, fade: 1 };
  const tFrozen = Q.has('ft') ? Number(Q.get('ft')) : null;
  let lastW = 0;
  const draw = () => frame(st.t, st.fade);
  function setIcon() {
    const ic = st.ended ? 'i-replay' : st.playing ? 'i-pause' : 'i-play';
    btn.querySelector('use').setAttribute('href', '#' + ic);
    btn.setAttribute('aria-label', st.ended ? 'Play the demo again' : st.playing ? 'Pause the demo' : 'Play the demo');
  }
  function play(from = null) {
    if (reduced()) { st.t = dur(); st.ended = true; st.started = true; draw(); setIcon(); if (onEnd) onEnd(); return; }
    if (from !== null) st.t = from;
    st.playing = true; st.ended = false; st.started = true;
    st.t0 = NOW() - st.t * 1000;
    if (!st.stop) st.stop = onFrame((now) => {
      st.t = (now - st.t0) / 1000;
      if (st.t >= dur()) {
        st.t = dur(); st.playing = false; st.ended = true;
        st.stop(); st.stop = null; draw(); setIcon(); if (onEnd) onEnd(); return;
      }
      draw();
    });
    setIcon();
  }
  function halt() { st.playing = false; if (st.stop) { st.stop(); st.stop = null; } }
  function pause() { halt(); setIcon(); }
  // repartir du noir : le diagramme, les phrases et le compte s'éteignent ensemble en 420 ms, puis le film repart
  let fadeStop = null;
  function fadeThen(change) {
    halt();
    if (fadeStop) fadeStop();
    const f0 = st.fade, t0 = NOW();
    fadeStop = onFrame((now) => {
      const k = clamp((now - t0) / 420);
      st.fade = f0 * (1 - OUT(k));
      draw();
      if (k >= 1) { fadeStop(); fadeStop = null; if (change) change(); st.fade = 1; st.t = 0; st.ended = false; play(0); }
    });
  }
  btn.addEventListener('click', () => {
    st.autoPaused = false;
    if (fadeStop) return;
    if (st.ended) { if (reduced()) play(0); else fadeThen(null); } else if (st.playing) pause(); else play();
  });
  const api = {
    draw, play, pause, st,
    relayout() { layout(stage.clientWidth); draw(); },
    freeze(t) { pause(); st.t = t; st.started = true; draw(); setIcon(); },
    warm() {},
    switchTo(change) {
      if (reduced() || !st.started) { change(); if (reduced()) { st.t = dur(); st.ended = true; } draw(); return; }
      fadeThen(change);
    },
  };
  new ResizeObserver(() => { const w = stage.clientWidth; if (w === lastW) return; lastW = w; layout(w); draw(); }).observe(stage);
  if (document.fonts) document.fonts.ready.then(() => api.relayout());
  new IntersectionObserver((es) => {
    const e = es[0];
    if (tFrozen !== null) return;
    // le film part quand presque toute la scène est à l'écran (au téléphone, la scène est plus haute que la vue)
    const need = Math.min(0.8, (innerHeight * 0.8) / Math.max(1, e.boundingClientRect.height));
    if (e.intersectionRatio >= need - 0.01) {
      if (!st.started) play(0);
      else if (st.autoPaused && !st.ended) { st.autoPaused = false; play(); }
    } else if (e.intersectionRatio < 0.12 && st.playing) { st.autoPaused = true; pause(); }
  }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }).observe(stage);
  if (reduced()) btn.hidden = true;
  lastW = stage.clientWidth; layout(lastW);
  if (tFrozen !== null) setTimeout(() => api.freeze(tFrozen), 0);
  else if (reduced()) setTimeout(() => { st.t = dur(); st.ended = true; st.started = true; draw(); }, 0);
  else draw();
  return api;
}

const answerHTML = (id) => ANSWERS[id].map((s) => `<span class="as" style="--k:0">${s}</span>`).join(' ');
const padOf = (w) => (w < 640 ? 18 : clamp(Math.round(w * 0.034), 24, 44));

// l'état d'une lecture à l'instant t : les lignes entrent une à une, puis les événements, le filet, l'état du run
function readState(id, sp, t) {
  const S = SCRIPT[id];
  const r0 = 0.55, rs = 0.34;
  const dim = S.dimAt ? seg(t, S.dimAt, S.dimAt + 0.6, OUT) * (1 - seg(t, S.relight, S.relight + 0.8, OUT)) : 0;
  const rows = sp.map((s, i) => {
    const ti = r0 + i * rs;
    const lit = S.lit && i in S.lit ? S.lit[i] : null;
    const on = lit === null ? 0 : lit === 0 ? 1 : seg(t, lit, lit + 0.5, OUT);
    return { a: seg(t, ti, ti + 0.45, OUT), p: seg(t, ti + 0.08, ti + 0.63, DRAW), d: seg(t, ti + 0.5, ti + 0.9, OUT), o: 1 - 0.55 * dim * (1 - on) };
  });
  const ev = S.ev.map((e) => ({ m: seg(t, e, e + 0.42, DRAW), l: seg(t, e + 0.16, e + 0.6, OUT) }));
  const waits = S.waitsAt ? [0, 1, 2, 3].map((k) => { const w = S.waitsAt + k * 0.36; return { p: seg(t, w, w + 0.5, DRAW), l: seg(t, w + 0.22, w + 0.62, OUT) }; }) : [];
  return {
    head: seg(t, 0.1, 0.55, OUT), rows, ev, waits,
    link: S.link ? seg(t, S.link[1], S.link[1] + 0.85, DRAW) : 0,
    state: seg(t, S.stateAt, S.stateAt + 0.45, OUT),
    insp: S.insp ? seg(t, S.insp.at, S.insp.at + 0.5, OUT) : 0,
  };
}

function readFilm() {
  const fig = $('.film[data-film="read"]');
  const stage = $('.film-stage', fig);
  const answer = $('.answer', fig);
  let run = '8f2c', parts = $$('.as', answer);
  const tv = traceView(stage);
  const NAMES = Object.keys(SCRIPT).flatMap((id) => STEPS_OF(RUNS[id]).map((s) => [s.name, s.type]));
  const opts = (id) => { const S = SCRIPT[id]; return { title: S.title, state: S.state, bad: S.bad, good: S.good, words: S.words, kinds: S.kinds, link: S.link ? S.link[0] : null, insp: S.insp, names: NAMES }; };
  const build = () => tv.build(run, opts(run));
  build();
  // une vue de mesure, hors page : la scène prend la hauteur de la plus haute des trois exécutions
  const probe = traceView(document.createElement('div'));
  const ghost = document.createElement('p');
  ghost.className = 'answer answer--probe'; ghost.setAttribute('aria-hidden', 'true');
  fig.appendChild(ghost);
  // la scène prend la hauteur du run affiché ; la place réservée (la plus haute scène et la plus longue phrase) reste
  // sous la phrase, si bien que le sélecteur ne bouge jamais et que la phrase suit sa dernière ligne
  let hMax = 0, aMax = 0;
  const lay = (w) => { const mob = w < 720; return { w, mob, top: mob ? 22 : 30, padX: padOf(w), short: !mob && innerHeight < 760 }; };
  const fit = () => {
    const h = tv.layout(lay(stage.clientWidth));
    stage.style.height = Math.round(h + 10) + 'px';
    answer.style.marginBottom = '';
    const pad = stage.clientWidth < 720 ? 0 : (Math.round(hMax + 10) - Math.round(h + 10)) + (aMax - answer.offsetHeight);
    answer.style.marginBottom = 'calc(' + Math.max(0, pad) + 'px + 26px)';
  };
  const layout = (w) => {
    const o = lay(w);
    hMax = 0;
    for (const id of Object.keys(SCRIPT)) { probe.build(id, opts(id)); hMax = Math.max(hMax, probe.layout(o)); }
    aMax = 0;
    for (const id of Object.keys(SCRIPT)) { ghost.innerHTML = answerHTML(id); aMax = Math.max(aMax, ghost.offsetHeight); }
    fit();
  };
  const frame = (t, fade) => {
    const S = SCRIPT[run];
    tv.paint(readState(run, tv.sp, t));
    tv.put(tv.root, 'opacity', fade.toFixed(3));
    parts.forEach((p, i) => p.style.setProperty('--k', (seg(t, S.say[i], S.say[i] + 0.5, OUT) * fade).toFixed(3)));
  };
  const eng = demoEngine(fig, { duration: () => SCRIPT[run].dur, frame, layout });
  const setRun = (id) => { run = id; build(); answer.innerHTML = answerHTML(run); parts = $$('.as', answer); fit(); };
  $$('input[name="run"]', fig).forEach((inp) => inp.addEventListener('change', () => {
    if (!inp.checked) return;
    eng.switchTo(() => setRun(inp.value));
  }));
  if (Q.get('run') && SCRIPT[Q.get('run')]) {
    const i = $(`input[value="${Q.get('run')}"]`, fig);
    if (i) { i.checked = true; setRun(i.value); eng.draw(); }
  }
  return eng;
}

/* Le rejeu : un diff serré. Seules les étapes 4 à 6 changent ; elles sont montrées plus grandes, le run 8f2c au-dessus,
   le rejeu au-dessous, sur la même échelle de temps. Le délai arrive toujours, la relance part toujours ; dans le rejeu,
   sa barre arrive creuse (l'appel a eu lieu, il n'a rien écrit) et le mot le dit, juste sous « refunded again ». Le
   compte passe de 2 à 1. */
function replayFilm() {
  const fig = $('.film[data-film="replay"]');
  const stage = $('.film-stage', fig);
  const tally = $$('.tally p', fig);
  const A = traceView(stage, 'tr--big');
  const B = traceView(stage, 'tr--big');
  A.build('8f2c-tail', { title: 'Refund', label: '8f2c', state: 'failed', bad: true, note: 'steps 4 to 6', big: true,
    words: ['refund sent', 'timed out', 'refunded again'], kinds: ['a', 'f', 'f'] });
  B.build('8f2c-fix', { title: 'Replay', label: '8f2c', state: 'fixed', good: true, note: 'same input', big: true, noAxis: true,
    words: ['refund sent', 'timed out'], kinds: ['a', 'f'], extra: [[36.3, 'nothing written', 'ok']] });
  const sep = document.createElement('i');
  sep.className = 'tr-sep';
  stage.appendChild(sep);
  const layout = (w) => {
    const mob = w < 720, o = { w, mob, top: mob ? 22 : 30, padX: padOf(w), short: !mob && innerHeight < 760 };
    const hA = A.layout({ ...o, x: 0, y: 0 });
    const hB = B.layout({ ...o, x: 0, y: hA + (mob ? 6 : 10) });
    sep.style.top = Math.round(hA + (mob ? 6 : 10)) + 'px';
    stage.style.height = Math.round(hA + hB + (mob ? 16 : 22)) + 'px';
  };
  const lane = (t, t0, n, dim, fill) => Array.from({ length: n }, (_, i) => {
    const ti = t0 + i * 0.3;
    // le retrait ne touche que les barres : les textes restent lisibles (AA) dans l'image finale
    return { a: seg(t, ti, ti + 0.4, OUT), p: seg(t, ti + 0.06, ti + 0.6, DRAW), d: seg(t, ti + 0.35, ti + 0.75, OUT), o: 1, bo: dim(i), fill: fill(i) };
  });
  const frame = (t, fade) => {
    // à la fin, la paire qui diffère reste éclairée, le reste s'efface un peu
    // la paire qui diffère reste éclairée ; dans l'image finale, ce qui ne change pas reste en retrait
    const focus = seg(t, 5.7, 6.3, OUT);
    const dim = (i) => 1 - 0.7 * focus * (i === 2 ? 0 : 1);
    A.paint({ head: seg(t, 0.1, 0.5, OUT), state: seg(t, 0.2, 0.6, OUT), cost: seg(t, 0.2, 0.6, OUT), waits: [], link: 0,
      rows: lane(t, 0.4, 3, dim, () => 1),
      ev: [1.5, 1.75, 2.25].map((e) => ({ m: seg(t, e, e + 0.4, DRAW), l: seg(t, e + 0.12, e + 0.55, OUT) })) });
    B.paint({ head: seg(t, 3.0, 3.4, OUT), state: seg(t, 5.5, 5.9, OUT), cost: seg(t, 3.0, 3.4, OUT), waits: [], link: 0,
      rows: lane(t, 3.3, 3, dim, (i) => (i === 2 ? 0 : 1)),
      ev: [{ m: seg(t, 4.4, 4.8, DRAW), l: seg(t, 4.5, 4.95, OUT) * (1 - focus) }, { m: seg(t, 4.65, 5.05, DRAW), l: seg(t, 4.75, 5.2, OUT) * (1 - focus) }, { m: 1, l: seg(t, 5.15, 5.6, OUT) }] });
    A.put(A.root, 'opacity', fade.toFixed(3)); B.put(B.root, 'opacity', fade.toFixed(3));
    A.put(sep, 'opacity', (seg(t, 2.9, 3.4, OUT) * fade).toFixed(3));
    tally[0].style.setProperty('--k', (seg(t, 2.6, 3.1, OUT) * fade).toFixed(3));
    tally[1].style.setProperty('--k', (seg(t, 6.1, 6.6, OUT) * fade).toFixed(3));
  };
  return demoEngine(fig, { duration: 8.6, frame, layout });
}

/* ---------- 3. Les intégrations : un schéma de flux à l'encre, la même grammaire que le héros ----------
   v6 : la lampe d'étalonnage est retirée. Les frameworks émettent des spans OpenTelemetry ; leurs traits convergent,
   entrent dans Iris, puis l'exécution se décompose en ses étapes (la cascade de 8f2c, aux couleurs des types). Au
   bureau le flux va de gauche à droite ; au téléphone il descend le long d'une tige. Joué une fois à l'arrivée
   (traits tracés, puis barres), mouvement réduit = image finale. Encres ≥ 3:1 sur le papier (calculé). */
const FLOW_SRC = [['LangGraph', 'LangGraph'], ['Claude Agent SDK', 'Claude Agent SDK'], ['OpenAI Agents SDK', 'OpenAI Agents SDK'], ['your own loop', 'your own loop']];
const FLOW_INK = { model: '#3557d6', read: '#1f8a4a', write: '#a8650a' };
function flowPlate() {
  const fig = $('.flow');
  // v12 : le schéma est peint dans un canvas 2D (il était en SVG). La première trame de ses tracés SVG coûtait une
  // image de 63 à 70 ms à un navigateur neuf, une vue avant son arrivée (bissection, NOTES v12) ; mêmes géométrie,
  // encres, partition et netteté (tampon au DPR).
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  $('svg', fig).replaceWith(cv);
  const g = cv.getContext('2d');
  const sp = STEPS_OF(RUNS['8f2c']);
  const T = RUNS['8f2c'].total;
  // le symbole #logo : ses tracés et leurs transformations (les lettres sont posées par translate / scale)
  const logo = [...document.querySelectorAll('#logo path')].map((p) => { const m = p.transform.baseVal.consolidate(); return [new Path2D(p.getAttribute('d')), m && m.matrix]; });
  let parts = null, shown = reduced() ? 1 : 0, lastW = 0, ink = {};
  // une polyligne (les courbes échantillonnées tous les 2,5 px environ) et sa longueur, pour la tracer en partie
  const pl = (x, y) => {
    const pts = [[x, y]], at = () => pts[pts.length - 1];
    const o = {
      H(x2) { pts.push([x2, at()[1]]); return o; },
      V(y2) { pts.push([at()[0], y2]); return o; },
      C(x1, y1, x2, y2, x3, y3) {
        const [x0, y0] = at(), n = Math.max(4, Math.ceil(Math.hypot(x3 - x0, y3 - y0) / 2.5));
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); }
        return o;
      },
      Q(x1, y1, x2, y2) {
        const [x0, y0] = at(), n = 8;
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]); }
        return o;
      },
      done: () => { const seg = []; let L = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; } return { pts, seg, L }; },
    };
    return o;
  };

  function build() {
    const W = fig.clientWidth;
    if (!W || W === lastW) return;
    lastW = W;
    const cs = getComputedStyle(fig);
    ink = { t: cs.getPropertyValue('--ink-2').trim(), o: cs.getPropertyValue('--ink').trim(), font: '400 15px ' + (cs.getPropertyValue('--f-mono').trim() || 'monospace') };
    const mob = W < 700;
    const P = { src: [], conv: [], trunk: [], logo: null, otel: null, fan: [], bars: [] };
    const tw = (s) => textW(s, 15, 400);
    const lw = 66, lh = 24;
    let H;
    if (!mob) {
      // gauche → droite : sources, convergence, OpenTelemetry sur le tronc, Iris, éventail, cascade
      const rowS = 36, top = 18;
      const srcH = rowS * (FLOW_SRC.length - 1);
      const rowC = 22, casH = rowC * (sp.length - 1);
      H = Math.max(srcH, casH) + top * 2 + 24;
      const mid = top + 12 + Math.max(srcH, casH) / 2;
      const sx = Math.max(...FLOW_SRC.map(([n]) => tw(n))) + 18;
      const cx = Math.round(W * 0.34), lx = Math.round(W * 0.52), fx = lx + lw + 16;
      const x0 = Math.round(W * 0.64), x1 = W - 2;
      FLOW_SRC.forEach(([n], i) => {
        const y = mid - srcH / 2 + i * rowS;
        P.src.push({ x: 0, y: y + 5, s: n, a: 'left' });
        const a = tw(n) + 10, k = (cx - sx) * 0.55;
        P.conv.push(pl(a, y).H(sx).C(sx + k, y, cx - k, mid, cx, mid).done());
      });
      P.trunk.push(pl(cx, mid).H(lx - 14).done());
      P.otel = { x: (cx + lx - 14) / 2, y: mid - 12, s: 'OpenTelemetry', a: 'center' };
      P.logo = { x: lx, y: mid - lh / 2 };
      const X = (t) => x0 + (t / T) * (x1 - x0);
      sp.forEach((s, i) => {
        const y = mid - casH / 2 + i * rowC, bx = X(s.a), k = (x0 - 10 - fx) * 0.5;
        P.fan.push(pl(fx, mid).C(fx + k, mid, x0 - 10 - k, y, x0 - 10, y).H(bx - 4).done());
        P.bars.push({ x: bx, y: y - 3, w: Math.max(3, X(s.b) - bx), c: FLOW_INK[s.type] });
      });
    } else {
      // téléphone : une tige descend à gauche ; les sources s'y branchent, puis OpenTelemetry, Iris, l'éventail, la cascade
      const sx = 12, ind = 30, rowS = 34, rowC = 24;
      let y = 14;
      FLOW_SRC.forEach(([, n], i) => {
        const yy = y + i * rowS;
        P.src.push({ x: ind, y: yy + 5, s: n, a: 'left' });
        P.conv.push(pl(ind - 8, yy).H(sx + 10).Q(sx, yy, sx, yy + 10).V(y + FLOW_SRC.length * rowS + 8).done());
      });
      y += FLOW_SRC.length * rowS + 8;
      P.otel = { x: ind, y: y + 22, s: 'OpenTelemetry', a: 'left' };
      P.trunk.push(pl(sx, y).V(y + 48).done());
      y += 54;
      P.logo = { x: sx - 11, y };
      y += lh + 14;
      const x0 = ind, x1 = W - 2, X = (t) => x0 + (t / T) * (x1 - x0);
      sp.forEach((s, i) => {
        const yy = y + i * rowC, bx = X(s.a);
        P.fan.push(pl(sx, y - 8).V(yy - 8).Q(sx, yy, sx + 8, yy).H(bx - 4).done());
        P.bars.push({ x: bx, y: yy - 3, w: Math.max(3, X(s.b) - bx), c: FLOW_INK[s.type] });
      });
      H = y + (sp.length - 1) * rowC + 14;
    }
    const d = DPR();
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.style.aspectRatio = W + ' / ' + H;
    P.W = W; P.H = H; P.d = d;
    parts = P;
    paint(shown);
  }
  // une polyligne tracée sur la fraction p de sa longueur (extrémités rondes, comme le pointillé SVG d'avant)
  function line(l, p, color, width) {
    if (p <= 0) return;
    let left = p * l.L;
    g.beginPath(); g.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let i = 1; i < l.pts.length; i++) {
      const s = l.seg[i - 1];
      if (left >= s) { g.lineTo(l.pts[i][0], l.pts[i][1]); left -= s; continue; }
      const k = left / s; g.lineTo(l.pts[i - 1][0] + (l.pts[i][0] - l.pts[i - 1][0]) * k, l.pts[i - 1][1] + (l.pts[i][1] - l.pts[i - 1][1]) * k);
      break;
    }
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }
  // la partition : sources, traits qui convergent, OpenTelemetry, Iris, éventail, barres une à une (3,4 s)
  function paint(k) {
    if (!parts) return;
    const t = k * 3.4, P = parts;
    g.setTransform(P.d, 0, 0, P.d, 0, 0);
    g.clearRect(0, 0, P.W, P.H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.font = ink.font; g.textBaseline = 'alphabetic';
    const text = (o, a, color) => { if (a <= 0) return; g.globalAlpha = a; g.fillStyle = color; g.textAlign = o.a; g.fillText(o.s, o.x, o.y); g.globalAlpha = 1; };
    P.src.forEach((o, i) => text(o, seg(t, 0.05 + i * 0.08, 0.5 + i * 0.08, OUT), ink.t));
    P.conv.forEach((l, i) => line(l, seg(t, 0.3 + i * 0.08, 1.15 + i * 0.08, DRAW), 'rgb(10 10 11 / 0.46)', 1.25));
    text(P.otel, seg(t, 1.1, 1.5, OUT), ink.o);
    P.trunk.forEach((l) => line(l, seg(t, 1.2, 1.65, DRAW), ink.o, 1.5));
    const la = seg(t, 1.55, 1.95, OUT);
    if (la > 0) {
      // le logo : symbole #logo (viewBox 110,4 × 40) posé dans 66 × 24, centré comme preserveAspectRatio « meet »
      const s = Math.min(66 / 110.4, 24 / 40);
      g.save(); g.globalAlpha = la; g.fillStyle = ink.o;
      g.translate(P.logo.x + (66 - 110.4 * s) / 2, P.logo.y + (24 - 40 * s) / 2); g.scale(s, s);
      logo.forEach(([p, m]) => { g.save(); if (m) g.transform(m.a, m.b, m.c, m.d, m.e, m.f); g.fill(p); g.restore(); }); g.restore();
    }
    P.fan.forEach((l, i) => line(l, seg(t, 1.8 + i * 0.05, 2.45 + i * 0.05, DRAW), 'rgb(10 10 11 / 0.32)', 1.25));
    P.bars.forEach((b, i) => {
      const w = b.w * seg(t, 2.25 + i * 0.12, 2.8 + i * 0.12, DRAW);
      if (w <= 0) return;
      // la barre grandit depuis son bord gauche, coins arrondis à l'échelle (scaleX d'avant)
      g.save(); g.fillStyle = b.c; g.translate(b.x, 0); g.scale(w / b.w, 1);
      g.beginPath(); g.roundRect(0, b.y, b.w, 6, 1.5); g.fill(); g.restore();
    });
  }
  new ResizeObserver(build).observe(fig);
  if (document.fonts) document.fonts.ready.then(() => { lastW = 0; build(); });
  if (Q.has('ft')) shown = 1;
  if (!reduced() && !Q.has('ft')) {
    new IntersectionObserver((es, ob) => {
      if (!es[0].isIntersecting) return;
      ob.disconnect();
      const t0 = NOW();
      const stop = onFrame((now) => { shown = clamp((now - t0) / 3400); paint(shown); if (shown >= 1) stop(); });
    }, { threshold: 0.55 }).observe(fig);
  }
}

/* ---------- 4. Le sélecteur : un pouce de lumière qui s'étire vers l'option choisie puis se pose ---------- */
function segmented() {
  const box = $('.seg');
  const thumb = $('.seg-thumb', box);
  const labels = $$('label', box);
  const st = { l: 0, r: 0, vl: 0, vr: 0, tl: 0, tr: 0, ready: false };
  let stop = null;
  function target() {
    const on = labels.find((l) => $('input', l).checked) || labels[0];
    const b = box.getBoundingClientRect(), r = on.getBoundingClientRect();
    return [r.left - b.left, r.right - b.left];
  }
  function apply() { thumb.style.transform = `translate3d(${st.l.toFixed(2)}px,0,0)`; thumb.style.width = (st.r - st.l).toFixed(2) + 'px'; }
  function snap() { [st.tl, st.tr] = target(); st.l = st.tl; st.r = st.tr; st.vl = st.vr = 0; apply(); st.ready = true; }
  function go() {
    [st.tl, st.tr] = target();
    if (reduced() || !st.ready) { snap(); return; }
    const right = st.tr > st.r;
    // deux ressorts amortis critiques : le bord de tête part vite, celui de queue suit (étirement sans dépassement)
    const wLead = 26, wTail = 15;
    let last = NOW();
    if (stop) stop();
    stop = onFrame((now) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      const step = (x, v, tgt, w) => { const a = w * w * (tgt - x) - 2 * w * v; v += a * dt; x += v * dt; return [x, v]; };
      [st.l, st.vl] = step(st.l, st.vl, st.tl, right ? wTail : wLead);
      [st.r, st.vr] = step(st.r, st.vr, st.tr, right ? wLead : wTail);
      apply();
      if (Math.abs(st.l - st.tl) < 0.2 && Math.abs(st.r - st.tr) < 0.2 && Math.abs(st.vl) + Math.abs(st.vr) < 2) { snap(); stop(); stop = null; }
    });
  }
  labels.forEach((l) => $('input', l).addEventListener('change', go));
  new ResizeObserver(snap).observe(box);
  if (document.fonts) document.fonts.ready.then(snap);
}

/* ---------- 5. Formulaire honnête ---------- */
function form() {
  const f = $('.signup');
  const msg = $('.form-msg', f);
  const input = $('#email', f);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim() || !input.checkValidity()) { msg.textContent = 'Please enter a work email.'; input.focus(); return; }
    msg.textContent = 'Thanks. This is a fictional product, so nothing was sent.';
  });
}

/* ---------- 6. En-tête qui se resserre ; lumière discrète qui suit le pointeur sur les boutons clairs ---------- */
function header() {
  const top = $('.top');
  const paper = $('.paper');
  const nav = $('.nav');
  const mark = $('.nav-mark', nav);
  const links = $$('a', nav).map((a) => ({ a, sec: $(a.getAttribute('href')) }));
  // le filet de la section en cours : deux ressorts amortis critiques (bord de tête rapide, bord de queue plus lent)
  const m = { l: 0, r: 0, vl: 0, vr: 0, tl: 0, tr: 0, ready: false };
  let cur = null, stopM = null, half = 0;
  const measure = () => { half = (parseFloat(getComputedStyle(paper).getPropertyValue('--fade')) || 0) / 2; };
  measure(); addEventListener('resize', measure);
  const applyM = () => { mark.style.transform = `translate3d(${m.l.toFixed(2)}px,0,0) scaleX(${((m.r - m.l) / 100).toFixed(4)})`; };
  const targetM = (a) => { const b = nav.getBoundingClientRect(), r = a.getBoundingClientRect(); return [r.left - b.left + 2, r.right - b.left - 2]; };
  function moveM(snap) {
    if (!cur) { mark.classList.remove('is-on'); return; }
    [m.tl, m.tr] = targetM(cur.a);
    const wasOn = mark.classList.contains('is-on');
    mark.classList.add('is-on');
    if (snap || !wasOn || !m.ready || reduced() || !nav.offsetParent) {
      if (stopM) { stopM(); stopM = null; }
      m.l = m.tl; m.r = m.tr; m.vl = m.vr = 0; m.ready = true; applyM(); return;
    }
    const right = m.tr > m.r;
    let last = NOW();
    if (stopM) stopM();
    stopM = onFrame((now) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      const step = (x, v, tgt, w) => { const acc = w * w * (tgt - x) - 2 * w * v; v += acc * dt; return [x + v * dt, v]; };
      [m.l, m.vl] = step(m.l, m.vl, m.tl, right ? 13 : 22);
      [m.r, m.vr] = step(m.r, m.vr, m.tr, right ? 22 : 13);
      applyM();
      if (Math.abs(m.l - m.tl) < 0.2 && Math.abs(m.r - m.tr) < 0.2 && Math.abs(m.vl) + Math.abs(m.vr) < 2) { m.l = m.tl; m.r = m.tr; applyM(); stopM(); stopM = null; }
    }, true);
  }
  const on = () => {
    top.classList.toggle('is-scrolled', scrollY > 24);
    // la planche commence et finit par un fondu : l'en-tête bascule au milieu de chacun
    const r = paper.getBoundingClientRect(), y = 44;
    top.classList.toggle('on-paper', r.top + half <= y && r.bottom - half >= y);
    // la section en cours : la dernière dont le haut a passé la ligne au tiers de la vue. Elle le reste dans la marge
    // qui la sépare de la suivante (sinon, entre Replay et Setup, le filet s'éteignait puis renaissait en fondu au lieu
    // de glisser) ; la dernière section le reste jusqu'à son bas, puis plus rien (le pied).
    const line = innerHeight * 0.36;
    let next = null;
    links.forEach((l, i) => {
      const b = l.sec.getBoundingClientRect();
      if (b.top <= line) next = b.bottom > line || i < links.length - 1 ? l : null;
    });
    if (next !== cur) {
      if (cur) cur.a.removeAttribute('aria-current');
      cur = next;
      if (cur) cur.a.setAttribute('aria-current', 'location');
      moveM(false);
    }
  };
  addEventListener('scroll', on, { passive: true }); on();
  new ResizeObserver(() => moveM(true)).observe(nav);
  if (document.fonts) document.fonts.ready.then(() => moveM(true));
  for (const b of $$('.btn--light')) {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      b.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }
}

/* ---------- 7. Liens internes : défilement doux, puis le focus suit (data-focus : un champ ; « Start free », qui
   l'utilisait, a quitté le héros en v11) ---------- */
function anchors() {
  const fine = matchMedia('(pointer: fine)');
  for (const a of $$('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const t = id === '#top' ? $('.hero') : $(id);
      if (!t || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      // la planche commence par son fondu : on s'arrête là où le papier est plein, sous l'en-tête
      const fade = parseFloat(getComputedStyle(t).getPropertyValue('--fade')) || 0;
      const y = id === '#top' ? 0 : t.getBoundingClientRect().top + scrollY + (fade > 100 ? fade - 100 : 0);
      scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
      const f = a.dataset.focus && fine.matches ? $(a.dataset.focus) : t;
      if (f === t && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
    });
  }
}

/* ---------- 8. Copier le code ---------- */
function copyCode() {
  const b = $('.copy');
  if (!b) return;
  const l = $('.copy-l', b), live = $('.code-plate [role="status"]');
  let timer = 0;
  b.addEventListener('click', async () => {
    let ok = true;
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch (_) {
      // repli (iframe sans permission presse-papiers) : sélection d'un champ caché
      const ta = document.createElement('textarea');
      ta.value = b.dataset.copy; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
    }
    l.textContent = ok ? 'Copied' : 'Select';
    live.textContent = ok ? 'Code copied.' : 'Copy failed. Select the code instead.';
    clearTimeout(timer);
    timer = setTimeout(() => { l.textContent = 'Copy'; live.textContent = ''; }, 2200);
  });
}

// le héros dérive sans cesse : aucune préparation ne doit tomber pendant qu'il bouge. Le verre du champ (première
// composition d'un filtre SVG : 55 à 100 ms sur une image, mesuré sur la RTX) se prépare au démarrage, page immobile,
// et l'entrée du héros part ensuite. Les accrocs du premier défilement (départ des films, schéma) sont des compilations
// de shaders d'un profil neuf : ils disparaissent dès que le cache du navigateur les connaît (`_outils/coldtrace.py`).
// Ouverte dans le portfolio, la page attend aussi que son rideau se lève, pour que l'on voie la lumière s'exposer : elle
// le demande à la page parente ; priée d'attendre, elle attend le signal (4 s au plus) ; sans réponse en 150 ms (seule,
// ou dans un autre cadre), elle part comme avant.
const cue = new Promise((go) => {
  if (window.parent === window) { go(); return; }
  let held = false;
  const done = () => { removeEventListener('message', on); go(); };
  const on = (e) => {
    const k = e.source === parent && e.data && e.data.type;
    if (k === 'portfolio:hold' && !held) { held = true; setTimeout(done, 4000); } else if (k === 'portfolio:reveal') { removeEventListener('message', on); go('reveal'); }
  };
  addEventListener('message', on);
  try { parent.postMessage({ type: 'landing:hello' }, '*'); } catch (e) { done(); }
  setTimeout(() => { if (!held) done(); }, 150);
});
let warmed;
const gate = Promise.all([new Promise((res) => { warmed = res; }), cue]);
lightBg(gate);
footBg();
const films = [readFilm(), replayFilm()];
flowPlate();
setTimeout(() => {
  warmGlass($('.field'));
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(warmed)));
}, 0);
segmented();
form();
header();
anchors();
copyCode();
mountGlass();

