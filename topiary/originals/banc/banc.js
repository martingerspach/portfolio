// Banc : la page. Le banc (banc-school.js) a un sens : il tourne autour de la question,
// part d'un coup quand elle est posée (les agents vont lire), revient par petits groupes
// à chaque source lue, puis se resserre autour de la réponse.
import { createSchool, P } from './banc-school.js';
import { monter as monterVerre, peindre as peindreVerre } from './banc-verre.js';

const NB = ' ';
const params = new URLSearchParams(location.search);
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
const isReduced = () => RMQ.matches || params.has('rm');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
if (params.has('solo')) document.documentElement.classList.add('solo');

/* =====================================================================
   1. Les questions préparées
   Les faits et les adresses ont été vérifiés le 2026-10-22 ; les adresses
   dont l'identifiant exact n'est pas sûr sont écrites en fil d'Ariane.
   ===================================================================== */
const tie = (t) => t.replace(/(\d) (?=\p{L})/gu, `$1${NB}`);
const Q = [
  {
    q: `Quels sont les délais de paiement légaux en Espagne${NB}?`,
    reads: [
      { url: 'boe.es/eli/es/l/2004/12/29/3', line: `Lu${NB}: BOE, loi 3/2004 sur les retards de paiement` },
      { url: 'boe.es/eli/es/l/2010/07/05/15', line: `Lu${NB}: BOE, loi 15/2010, le plafond de 60 jours` },
      { url: 'un blog juridique, article de 2009', line: `Écarté${NB}: article de 2009, antérieur à la loi 15/2010`, off: true },
      { url: 'boe.es/eli/es/l/2017/11/08/9', line: `Lu${NB}: BOE, loi 9/2017 sur les contrats publics` },
    ],
    answer: [
      ['Entre entreprises, une facture se paie dans les 30 jours qui suivent la livraison.', [1]],
      ['Un contrat peut allonger ce délai, sans dépasser 60 jours.', [2]],
      ['Une administration publique paie sous 30 jours.', [3]],
    ],
  },
  {
    q: `Combien de jours de congés payés en Allemagne${NB}?`,
    reads: [
      { url: 'gesetze-im-internet.de/burlg/__3.html', line: `Lu${NB}: loi fédérale sur les congés, article 3` },
      { url: 'un forum RH, sans date ni auteur', line: `Écarté${NB}: forum sans date ni auteur`, off: true },
      { url: 'boeckler.de › WSI › archives des conventions', line: `Lu${NB}: fondation Hans Böckler, conventions collectives` },
    ],
    answer: [
      [`La loi garantit 24 jours ouvrables par an, comptés sur six jours par semaine${NB}: 20 jours si vous travaillez du lundi au vendredi.`, [1]],
      ['La plupart des conventions collectives en accordent 30.', [2]],
    ],
  },
  {
    q: `Combien de temps faut-il garder ses factures en France${NB}?`,
    reads: [
      { url: 'legifrance.gouv.fr › Code de commerce › L123‑22', line: `Lu${NB}: Code de commerce, article L123‑22` },
      { url: 'un site de conseils, page de 2014', line: `Écarté${NB}: page de 2014 qui confond les deux délais`, off: true },
      { url: 'legifrance.gouv.fr › Livre des procédures fiscales › L102 B', line: `Lu${NB}: Livre des procédures fiscales, article L102${NB}B` },
    ],
    answer: [
      [`Gardez vos factures dix ans${NB}: le Code de commerce l’impose pour les pièces comptables.`, [1]],
      ['Pour l’administration fiscale, six ans suffisent.', [2]],
    ],
  },
];

/* =====================================================================
   2. La navigation : une barre de verre (en haut au bureau, en onglets sous le pouce
   au téléphone). La section en cours reçoit la plaque, qui glisse d'un renvoi à l'autre.
   ===================================================================== */
const top = $('#top');
const nav = $('.nav');
const plate = $('.nav-plate');
const navLinks = $$('.nav a');
const topCta = $('.top-cta');
const phone = matchMedia('(max-width: 600px)');
// la barre se densifie et se réduit au poisson une fois le hero quitté (pas pendant la démo)
const onScroll = () => top.classList.toggle('is-scrolled', scrollY > innerHeight * 0.45);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ----- la plaque : une goutte qui glisse. Son bord avant part vite, son bord arrière suit :
// elle s'étire pendant le trajet, puis se rassemble sur sa cible, sans jamais la dépasser.
const pl = { l: 0, r: 0, tl: 0, tr: 0, raf: 0, last: 0, ready: false };
function drawPlate() {
  const w = Math.max(0, pl.r - pl.l), tw = Math.max(1, pl.tr - pl.tl);
  const squish = clamp((w / tw - 1) * 0.22, 0, 0.07);       // étirée, elle s'amincit à peine
  plate.style.width = `${w}px`;
  plate.style.transform = `translateX(${pl.l}px) scaleY(${(1 - squish).toFixed(4)})`;
}
function stepPlate(now) {
  const dt = Math.min(0.05, (now - pl.last) / 1000);
  pl.last = now;
  const dir = Math.sign(pl.tl + pl.tr - pl.l - pl.r);
  const kl = 1 - Math.exp(-dt / (dir < 0 ? 0.07 : 0.11));
  const kr = 1 - Math.exp(-dt / (dir > 0 ? 0.07 : 0.11));
  pl.l += (pl.tl - pl.l) * kl;
  pl.r += (pl.tr - pl.r) * kr;
  if (Math.abs(pl.tl - pl.l) < 0.75 && Math.abs(pl.tr - pl.r) < 0.75) { pl.l = pl.tl; pl.r = pl.tr; drawPlate(); pl.raf = 0; return; }
  drawPlate();
  pl.raf = requestAnimationFrame(stepPlate);
}
let current = '';
function placePlate(instant) {
  const a = navLinks.find((l) => l.dataset.sec === current);
  const nb = nav.getBoundingClientRect();
  if (!a || !nb.width) return;
  const ab = a.getBoundingClientRect();
  pl.tl = ab.left - nb.left; pl.tr = ab.right - nb.left;
  if (instant || !pl.ready || isReduced()) {
    cancelAnimationFrame(pl.raf); pl.raf = 0;
    pl.l = pl.tl; pl.r = pl.tr; drawPlate();
    pl.ready = true; plate.classList.add('is-on');
    return;
  }
  if (!pl.raf) { pl.last = performance.now(); pl.raf = requestAnimationFrame(stepPlate); }
}
function setCurrent(id, instant) {
  if (id === current) return;
  current = id;
  navLinks.forEach((a) => {
    if (a.dataset.sec === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  placePlate(instant);
}

// ----- la section en cours, lue d'après la position de la page (pas de bande d'observation qui
// saute une section courte) ; suspendue pendant un trajet demandé par un clic
const sections = ['demo', 'sources', 'tarif'].map((id) => document.getElementById(id));
let lock = '', lockTimer = 0, spyRaf = 0;
function spyNow() {
  spyRaf = 0;
  if (lock) return;
  const y = scrollY + innerHeight * 0.4;
  let id = 'demo';
  for (const sec of sections) if (sec.offsetTop <= y) id = sec.id;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = 'tarif';
  setCurrent(id);
}
addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(spyNow); }, { passive: true });
function unlock() { lock = ''; clearTimeout(lockTimer); spyNow(); }
for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, (e) => { if (lock && !(ev === 'keydown' && (e.key === 'Enter' || e.key === ' '))) unlock(); }, { passive: true });
addEventListener('scrollend', () => { if (lock) setTimeout(unlock, 60); });

// ----- les liens de la page : un seul trajet doux vers la cible, la plaque part au clic.
// Au clavier, le focus passe au titre de la section atteinte.
function targetY(el) {
  if (el.id === 'demo') return 0;
  const offset = phone.matches ? 12 : top.querySelector('.bar').getBoundingClientRect().bottom + 12;
  const max = document.documentElement.scrollHeight - innerHeight;
  return clamp(Math.round(el.getBoundingClientRect().top + scrollY - offset), 0, max);
}
function goTo(id, viaKeyboard) {
  const el = document.getElementById(id);
  if (!el) return;
  const sec = sections.find((x) => x.id === id || x.contains(el));
  if (sec) { lock = sec.id; setCurrent(sec.id); }
  const y = targetY(el);
  const smooth = !isReduced() && Math.abs(y - scrollY) > 2;
  scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  clearTimeout(lockTimer);
  lockTimer = setTimeout(unlock, smooth ? 1600 : 50);
  if (viaKeyboard) {
    const h = el.matches('h1, h2') ? el : el.querySelector('h1, h2') || el;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-nowhere') || a.classList.contains('skip')) return;
  const id = a.getAttribute('href').slice(1);
  if (!id || id.startsWith('src-') || !document.getElementById(id)) return;
  e.preventDefault();
  goTo(id, e.detail === 0);
});

// téléphone : la barre d'onglets se montre quand elle ne couvre pas la console
const consoleBox = $('.console');
// Safari (WebKit) peut exécuter ce module avant que banc.css s'applique : la page n'a pas encore sa mise en
// page, rien ne se mesure (la console semblait hors écran, les onglets entraient par-dessus les exemples)
const cssOn = () => document.readyState === 'complete' || getComputedStyle($('.hero')).position === 'relative';
let tabRaf = 0;
function tabBar() {
  tabRaf = 0;
  if (!phone.matches) { top.classList.add('is-in'); return; }
  if (!cssOn()) return;
  const barTop = innerHeight - 84;
  const r = consoleBox.getBoundingClientRect();
  top.classList.toggle('is-in', r.bottom < barTop - 12 || r.top > innerHeight);
}
addEventListener('scroll', () => { if (!tabRaf) tabRaf = requestAnimationFrame(tabBar); }, { passive: true });
addEventListener('resize', tabBar);
addEventListener('load', tabBar);
phone.addEventListener('change', () => { tabBar(); if (phone.matches) pauseBtn.classList.remove('is-tucked'); });
tabBar();

setCurrent('demo', true);
new ResizeObserver(() => placePlate(true)).observe(nav);
document.fonts.ready.then(() => placePlate(true));
phone.addEventListener('change', () => placePlate(true));

// le formulaire est à l'écran : l'action de la barre s'efface (une seule action à la fois)
new IntersectionObserver((es) => { topCta.classList.toggle('is-quiet', es[0].isIntersecting); }, { threshold: 0.2 }).observe($('#signup'));

/* =====================================================================
   3. Le banc et la démo
   ===================================================================== */
const hero = $('.hero');
const canvas = $('.school');
const form = $('#ask-form');
const input = $('#q');
const send = $('#send');
const nowEl = $('#now');
const answerEl = $('#answer');
const readsEl = $('#reads');
const workEl = $('#work');
const pauseBtn = $('#pause');
const exampleBtns = $$('.examples button');
const consoleEl = $('.console');
const nextEl = $('#next');

let school = null;
try { school = createSchool(canvas); } catch (e) { console.warn('banc', e); school = null; }
if (!school) canvas.remove();

let running = !isReduced() && !params.has('fige');
let paused = false;
let visible = true;
let run = 0;                                    // jeton de la question en cours

// zones de texte, en px du hero : le banc les contourne et passe dessous en s'effaçant
// zones du hero, en px : sous le texte, le banc s'efface presque ; sous le verre, il reste visible au biseau,
// où la lentille le plie (le centre des pièces de verre reste calme pour la lecture)
function heroRects() {
  const hb = hero.getBoundingClientRect();
  const rel = (r) => [r.left - hb.left, r.top - hb.top, r.right - hb.left, r.bottom - hb.top];
  const textRect = (el) => { const range = document.createRange(); range.selectNodeContents(el); return rel(range.getBoundingClientRect()); };
  const union = (...rs) => [Math.min(...rs.map((r) => r[0])), Math.min(...rs.map((r) => r[1])), Math.max(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))];
  const pad = (r, p) => [r[0] - p, r[1] - p, r[2] + p, r[3] + p];
  const zone = (r, level, fade) => [...r, level, fade];
  const title = textRect($('#titre')), lede = pad(textRect($('.lede')), 6);
  const cb = rel(consoleEl.getBoundingClientRect());
  // le chapeau et l'interstice jusqu'au bord haut de la console : aucun poisson sombre ne s'y coince
  const ledeGap = [Math.min(lede[0], cb[0]), lede[1], Math.max(lede[2], cb[2]), cb[1] + 8];
  const rects = [zone(title, 0.08, 48), zone(ledeGap, 0.08, 30), zone(pad(cb, -14), 0.04, 10)];
  // la zone de travail entière (réservée dès le clic) : le banc ne passe jamais sur ses lignes
  if (workEl.classList.contains('is-on')) {
    const wb = rel(workEl.getBoundingClientRect());
    const last = nextEl.classList.contains('is-on') ? rel(nextEl.getBoundingClientRect())[3] : wb[3];
    rects.push(zone(pad([wb[0], wb[1], wb[2], Math.max(last, wb[1] + 30)], 12), 0.06, 36));
  }
  if (!pauseBtn.hidden) rects.push(zone(pad(rel(pauseBtn.getBoundingClientRect()), -6), 0.3, 8));
  rects.push(zone(pad(rel($('.bar').getBoundingClientRect()), 10), 0, 14));
  const logoPage = $('.logo--page');
  if (logoPage.offsetWidth) rects.push(zone(pad(rel(logoPage.getBoundingClientRect()), 8), 0.08, 24));
  // la console : les grands poissons la contournent toujours (5e valeur : grands seulement)
  return { hb, rects, avoid: [title, lede, [...rel(consoleEl.getBoundingClientRect()), 1]] };
}

let gathered = false;
function layout() {
  if (!school || !cssOn()) return;
  const { hb, rects, avoid } = heroRects();
  school.resize(Math.round(hb.width), Math.round(hb.height));
  school.st.rects = rects.slice(0, 8);
  school.st.avoid = avoid;
  aim(hb);
}
function aim(hb = hero.getBoundingClientRect()) {
  if (!school) return;
  const W = hb.width, H = hb.height;
  const ask = $('.ask').getBoundingClientRect();
  const form = consoleEl;
  if (gathered) {
    // resserré autour de la réponse
    // un anneau fin qui fait le tour de la réponse : il passe sous le bord bas de la console (où le verre
    // le plie), longe la réponse sur ses côtés et se referme sous le lien de suite
    const a = workEl.getBoundingClientRect();
    const nb = nextEl.getBoundingClientRect();
    const bottom = Math.max(a.bottom, nb.bottom) - hb.top;
    const topY = a.top - hb.top;
    const cy = (topY + bottom) / 2;
    const half = (bottom - topY) / 2;
    // au téléphone, pas de marge sur les côtés : le banc se reforme en bande juste sous la réponse
    if (phone.matches) school.orbit(W / 2, bottom + 62, W * 0.4, 30);
    else school.orbit(a.left - hb.left + a.width / 2, cy, Math.min(W * 0.47, a.width / 2 + 120), half + 40);
    school.tighten(1);
  } else {
    if (phone.matches) {
      // l'étang du téléphone : au-dessus du titre
      const t = $('#titre').getBoundingClientRect().top - hb.top;
      school.orbit(W / 2, t * 0.56, W * 0.42, Math.max(56, t * 0.3));
    } else {
      // l'anneau tient entier dans l'écran, centré sur la question
      const f = form.getBoundingClientRect();
      const ry = Math.min(H * 0.36, innerHeight * 0.38);
      const cy = clamp(f.top - hb.top + f.height / 2, ry + 40, H - ry - 40);
      // le poisson le plus au large (rayon × 1,26) reste à 40 px du bord : pas de tapis écrasé contre le cadre
      school.orbit(ask.left - hb.left + ask.width / 2, cy, Math.min((W / 2 - 40) / 1.26, Math.max(W * 0.36, ask.width * 0.62)), ry);
    }
    school.tighten(0);
  }
}

// boucle plafonnée à 60 images/s, arrêtée hors écran et onglet caché
let last = 0, raf = 0;
function loop(now) {
  raf = 0;
  if (!running || paused || !visible || document.hidden) { last = 0; return; }
  raf = requestAnimationFrame(loop);
  if (!last) { last = now; return; }
  const dt = now - last;
  if (dt < 1000 / 60 - 2) return;
  last = now;
  school.step(Math.min(dt, 34) / 1000);
  school.render();
}
function wake() { if (school && running && !paused && visible && !document.hidden && !raf) raf = requestAnimationFrame(loop); }

if (school) {
  new ResizeObserver(() => {
    if (!cssOn()) return;
    layout();
    if (!running || paused) school.render();
  }).observe(hero);
  // la zone de travail grandit pendant que la réponse s'écrit : les zones calmes la suivent
  let zoneRaf = 0;
  const zonesNow = () => { zoneRaf = 0; const { rects, avoid } = heroRects(); school.st.rects = rects.slice(0, 8); school.st.avoid = avoid; };
  const zonesSoon = () => { if (!zoneRaf) zoneRaf = requestAnimationFrame(zonesNow); };
  new ResizeObserver(zonesSoon).observe(workEl);
  new MutationObserver(zonesSoon).observe(workEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; wake(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  const go = () => {
    // sans mise en page, le banc naîtrait et s'installerait au mauvais endroit : on attend la feuille de style
    if (!cssOn()) { addEventListener('load', go, { once: true }); return; }
    layout();
    school.warm(params.has('fige') ? P('fige', 8) : isReduced() ? 16 : 8);
    school.render();
    wake();
  };
  // l'atlas des caractères dépend de la police mono : on l'attend (au plus 1,2 s)
  Promise.race([document.fonts.load('500 20px "JetBrains Mono"'), new Promise((r) => setTimeout(r, 1200))]).then(go, go);
  // le banc écoute : au survol et pendant que vous écrivez, il se resserre autour de la console
  let hovering = false;
  const listen = () => school.listen(hovering || consoleEl.contains(document.activeElement) || params.has('ecoute'));
  consoleEl.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; listen(); } });
  consoleEl.addEventListener('pointerleave', () => { hovering = false; listen(); });
  consoleEl.addEventListener('focusin', listen);
  consoleEl.addEventListener('focusout', () => setTimeout(listen, 0));
  listen();
}

// banc d'essai : pas à pas, image par image, et mesure du temps de calcul
if (params.has('shot') && school) {
  window.__banc = {
    school,
    stop() { running = false; },
    tick(dt) { school.step(dt); school.render(); },
    bench(n) {
      const gl = canvas.getContext('webgl2');
      const t = [];
      for (let i = 0; i < n; i++) {
        const a = performance.now();
        school.step(1 / 60); school.render(); gl.finish();
        t.push(performance.now() - a);
      }
      t.sort((x, y) => x - y);
      return { median: t[n >> 1], p95: t[Math.floor(n * 0.95)], max: t[n - 1] };
    },
    frame() { return canvas.toDataURL('image/png'); },
    ask: (i) => ask(i, true),
  };
}

// la pause se range quand elle passerait sous la barre de verre
// (au téléphone, la barre est en bas : rien à ranger)
new IntersectionObserver((es) => { pauseBtn.classList.toggle('is-tucked', !phone.matches && !es[0].isIntersecting && es[0].boundingClientRect.top < 120); },
  { rootMargin: '-76px 0px 0px 0px', threshold: 1 }).observe(pauseBtn);
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.setAttribute('aria-pressed', String(paused));
  $('.pause-long', pauseBtn).textContent = paused ? 'Relancer l’animation' : 'Mettre l’animation en pause';
  $('.pause-short', pauseBtn).textContent = paused ? 'Relancer' : 'Pause';
  wake();
});
if (isReduced() || !school) pauseBtn.hidden = true;
RMQ.addEventListener('change', () => { running = !isReduced(); pauseBtn.hidden = !running || !school; wake(); });

// ----- le bouton d'envoi : vide, prêt, au travail
function setBusy(on) {
  send.classList.toggle('is-busy', on);
  send.setAttribute('aria-label', on ? 'Recherche en cours' : 'Envoyer la question');
  workEl.toggleAttribute('aria-busy', on);
}
function syncSend() { send.dataset.empty = String(!input.value.trim()); }

// ----- écriture
const wait = (ms, tok) => new Promise((res, rej) => setTimeout(() => (tok === run ? res() : rej('stop')), ms));
const caret = () => { const c = document.createElement('span'); c.className = 'caret'; c.setAttribute('aria-hidden', 'true'); return c; };

function fit() { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; }
function setQ(v) { input.value = v; fit(); syncSend(); }
// la question s'écrit dans un champ déjà à sa hauteur finale : rien ne bouge en dessous
async function typeField(text, tok) {
  setQ(text);
  const hgt = input.style.height;
  form.classList.add('is-typing');
  input.value = '';
  for (let i = 1; i <= text.length; i++) {
    input.value = text.slice(0, i);
    input.style.height = hgt;
    await wait(text[i - 1] === ' ' ? 16 : 26, tok);
  }
  syncSend();
  form.classList.remove('is-typing');
}
function note(text) {
  nowEl.textContent = text; nowEl.classList.add('is-note');
  workEl.classList.add('is-on');
}
function clearWork() {
  nowEl.textContent = ''; nowEl.classList.remove('is-note');
  answerEl.textContent = ''; readsEl.textContent = '';
  nextEl.classList.remove('is-on');
  workEl.classList.remove('is-on');
  setBusy(false);
}

// un texte en caractères invisibles, chacun à sa place définitive
function charSpans(parent, text) {
  const out = [];
  for (const ch of text) {
    const sp = document.createElement('span');
    sp.className = 'c'; sp.textContent = ch;
    parent.append(sp); out.push(sp);
  }
  return out;
}
function refLink(n) {
  const a = document.createElement('a');
  a.className = 'ref ref--link w'; a.href = `#src-${n}`; a.textContent = String(n);
  a.setAttribute('aria-label', `Source ${n}`);
  const li = () => document.getElementById(`src-${n}`);
  for (const [ev, on] of [['mouseenter', 1], ['mouseleave', 0], ['focus', 1], ['blur', 0]]) a.addEventListener(ev, () => li()?.classList.toggle('lit', !!on));
  a.addEventListener('click', (e) => { e.preventDefault(); li()?.scrollIntoView({ block: 'nearest', behavior: isReduced() ? 'auto' : 'smooth' }); });
  return a;
}
// le bilan de la lecture, en chiffres comme une ligne de journal : « 4 pages lues, 3 retenues. »
const tally = (item) => `${item.reads.length}${NB}pages lues, ${item.reads.filter((r) => !r.off).length}${NB}retenues.`;
// pose toute la réponse, invisible : la hauteur finale est réservée dès le clic
function build(item) {
  clearWork();
  workEl.classList.add('is-on');
  const reads = [];
  let n = 0;
  for (const r of item.reads) {
    const li = document.createElement('li');
    if (r.off) li.className = 'off'; else li.id = `src-${++n}`;
    const num = document.createElement('span');
    num.className = r.off ? 'ref ref--off w' : 'ref w';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = r.off ? '×' : String(n);
    const txt = document.createElement('span'); txt.className = 't';
    li.append(num, txt);
    readsEl.append(li);
    reads.push({ li, num, chars: charSpans(txt, tie(r.line)), r });
  }
  const sentences = [];
  item.answer.forEach(([sentence, refs], i) => {
    const t = (i ? ' ' : '') + tie(sentence);
    const cut = t.lastIndexOf(' ');
    const words = [];
    for (const w of t.slice(0, cut + 1).split(/(?<= )/)) {
      const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w;
      answerEl.append(sp); words.push(sp);
    }
    const tail = document.createElement('span'); tail.className = 'nw';
    const lastW = t.slice(cut + 1), dot = lastW.endsWith('.') ? '.' : '';
    const lw = document.createElement('span'); lw.className = 'w'; lw.textContent = dot ? lastW.slice(0, -1) : lastW;
    tail.append(lw); words.push(lw);
    const refEls = refs.map((k) => { const a = refLink(k); tail.append(a); return a; });
    const dotEl = document.createElement('span'); dotEl.className = 'w'; dotEl.textContent = dot;
    tail.append(dotEl);
    answerEl.append(tail);
    sentences.push({ words, refEls, dotEl });
  });
  return { reads, sentences };
}
// pose l'état final, tout visible
function settle(item) {
  const { reads, sentences } = build(item);
  for (const x of reads) { x.num.classList.add('on'); x.chars.forEach((c) => c.classList.add('on')); }
  for (const s of sentences) { s.words.forEach((w) => w.classList.add('on')); s.refEls.forEach((r) => r.classList.add('on')); s.dotEl.classList.add('on'); }
  nowEl.textContent = tally(item);
  nextEl.classList.add('is-on');
}
// le curseur : un filet posé sur le dernier caractère écrit (aucune place prise dans la ligne)
let caretEl = null;
function caretOn(el) { if (caretEl) caretEl.classList.remove('caret-on'); caretEl = el; if (el) el.classList.add('caret-on'); }
async function revealChars(chars, perChar, tok) {
  for (const ch of chars) {
    ch.classList.add('on'); caretOn(ch);
    const t = ch.textContent;
    await wait(perChar * (t === ' ' ? 0.6 : 1) + (t === ',' || t === '.' ? perChar * 3 : 0), tok);
  }
  caretOn(null);
}
async function typeNow(text, perChar, tok) {
  nowEl.textContent = '';
  for (let i = 1; i <= text.length; i++) { nowEl.textContent = text.slice(0, i); await wait(perChar, tok); }
}

// un seul défilement, au départ : la zone de travail entière tient dans l'écran (au-dessus des onglets
// au téléphone) ; au bureau, le titre est soit entier, soit hors de vue, jamais coupé par la barre
function revealOnce() {
  const w = workEl.getBoundingClientRect();
  const barB = phone.matches ? 0 : top.querySelector('.bar').getBoundingClientRect().bottom;
  const floor = phone.matches ? innerHeight - 100 : innerHeight - 28;
  let need = w.bottom + (phone.matches ? 130 : 0) - floor;
  if (need <= 4) return;
  if (!phone.matches) {
    const t = $('#titre').getBoundingClientRect();
    if (t.top - need < barB + 8 && t.bottom - need > barB) need = t.bottom + 12 - barB;
    need = Math.min(need, consoleEl.getBoundingClientRect().top - barB - 16);
  } else need = Math.min(need, w.top - 16);
  if (need > 4) scrollBy({ top: need, behavior: isReduced() ? 'auto' : 'smooth' });
}

async function ask(idx, fromExample) {
  const tok = ++run;
  const item = Q[idx];
  exampleBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.q) === idx)));
  if (isReduced() || !school || paused) {
    setQ(item.q);
    settle(item);
    if (school) { gathered = true; layout(); school.all(); school.warm(10); school.render(); }
    revealOnce();
    return;
  }
  try {
    const { reads, sentences } = build(item);
    setBusy(true);
    gathered = false; layout();
    if (fromExample) await typeField(item.q, tok); else fit();
    revealOnce();
    await wait(160, tok);
    // les agents partent : le banc s'ouvre d'un coup, comme devant un prédateur
    school.leave();
    await wait(700, tok);
    const per = Math.ceil(school.fish.length / reads.filter((x) => !x.r.off).length / 2);
    for (const x of reads) {
      await typeNow(`Lecture${NB}: ${x.r.url}`, 11, tok);
      await wait(x.r.off ? 420 : 300, tok);
      x.num.classList.add('on');
      if (!x.r.off) school.back(per);
      await revealChars(x.chars, 9, tok);
      await wait(160, tok);
    }
    await typeNow(tally(item), 14, tok);
    // la réponse s'écrit mot à mot, le banc revient et se resserre autour d'elle
    gathered = true; layout(); school.all();
    for (const st of sentences) {
      for (const w of st.words) { w.classList.add('on'); caretOn(w); await wait(44 + w.textContent.length * 6, tok); }
      caretOn(null);
      await wait(70, tok);
      for (const r of st.refEls) { r.classList.add('on'); await wait(140, tok); }
      st.dotEl.classList.add('on');
      await wait(220, tok);
    }
    nextEl.classList.add('is-on');
    setBusy(false);
  } catch (e) {
    if (e !== 'stop') throw e;
  }
}

exampleBtns.forEach((b) => b.addEventListener('click', () => ask(Number(b.dataset.q), true)));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = input.value.trim().toLowerCase();
  if (!v) {
    run++; clearWork(); calmAgain();
    note('Écrivez une question, ou choisissez l’un des exemples juste au-dessus.');
    input.focus();
    return;
  }
  const keys = [['espagne', 'espagnol'], ['allemagne', 'allemand', 'congé'], ['facture']];
  const idx = keys.findIndex((ks) => ks.some((k) => v.includes(k)));
  if (idx >= 0) { ask(idx, false); return; }
  run++;
  clearWork(); calmAgain();
  exampleBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
  note('Cette démonstration répond à trois questions. Choisissez l’une d’elles juste au-dessus.');
});
input.addEventListener('input', () => { if (nowEl.classList.contains('is-note')) { nowEl.textContent = ''; nowEl.classList.remove('is-note'); workEl.classList.remove('is-on'); } fit(); syncSend(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
});
new ResizeObserver(() => {
  input.placeholder = form.clientWidth < 330 ? 'Votre question' : 'Posez votre question';
  if (!form.classList.contains('is-typing')) fit();   // pendant la saisie, le champ garde sa hauteur finale
}).observe(form);
syncSend();

// le banc reprend sa ronde autour de la question (après une question inconnue ou un champ vide)
function calmAgain() { if (!school) return; gathered = false; layout(); school.all(); }

// ----- état figé pour les captures : ?etat=reponse&ex=0
if (params.get('etat') === 'reponse') {
  const idx = Number(params.get('ex') || 0);
  setQ(Q[idx].q); settle(Q[idx]); gathered = true;
  if (school) requestAnimationFrame(() => layout());
  exampleBtns[idx].setAttribute('aria-pressed', 'true');
  if (school) requestAnimationFrame(() => { layout(); school.all(); school.warm(8); school.render(); });
}

/* =====================================================================
   4. La planche des sources : la réponse s'écrit, chaque renvoi ouvre son passage
   Les deux passages sont recopiés de Légifrance (vérifiés le 2026-10-22).
   ===================================================================== */
const plateRefs = $$('.plate-answer .ref');
const srcItems = $$('.src-list li[data-src]');
const srcBtns = $$('.src-btn');
const extract = $('.extract');
const SOURCES = [
  { from: `Code de commerce, article${NB}L123‑22, deuxième alinéa. Texte lu sur Légifrance.`,
    before: `«${NB}Les documents comptables et `, mark: `les pièces justificatives sont conservés pendant dix${NB}ans`, after: `.${NB}»` },
  { from: `Livre des procédures fiscales, article${NB}L102${NB}B, extrait. Texte lu sur Légifrance.`,
    before: `«${NB}Les livres, registres, documents ou pièces […] `, mark: 'doivent être conservés pendant un délai de six ans', after: ` à compter de la date de la dernière opération […].${NB}»` },
];
let readTimers = [];

function openSource(i, animate) {
  plateRefs.forEach((r, k) => r.setAttribute('aria-pressed', String(k === i)));
  srcBtns.forEach((r) => r.setAttribute('aria-pressed', String(Number(r.dataset.src) === i)));
  srcItems.forEach((li) => li.classList.toggle('is-on', Number(li.dataset.src) === i));
  readTimers.forEach(clearTimeout); readTimers = [];
  const src = SOURCES[i];
  const text = $('#extrait-text');
  text.textContent = '';
  text.append(src.before);
  const mk = document.createElement('mark');
  const cells = [...src.mark].map((ch) => { const sp = document.createElement('span'); sp.className = 'c'; sp.textContent = ch; mk.append(sp); return sp; });
  text.append(mk, src.after);
  $('#extrait-from').textContent = src.from;
  if (animate && !isReduced()) {
    // l'agent relit le passage : chaque caractère retenu reçoit sa case, un par un
    mk.classList.add('is-reading');
    cells.forEach((c, k) => readTimers.push(setTimeout(() => c.classList.add('on'), 260 + k * 20)));
  }
}
plateRefs.forEach((r, k) => r.addEventListener('click', () => openSource(k, true)));
// au téléphone, le passage s'ouvre sous la réponse, souvent sous les onglets ou hors de l'écran :
// un défilement court l'amène au-dessus des onglets, sans faire sortir le renvoi touché par le haut
plateRefs.forEach((r) => r.addEventListener('click', () => {
  if (!phone.matches) return;
  const need = Math.min(extract.getBoundingClientRect().bottom - (innerHeight - 96), r.getBoundingClientRect().top - 16);
  if (need > 4) scrollBy({ top: need, behavior: isReduced() ? 'auto' : 'smooth' });
}));
srcBtns.forEach((r) => r.addEventListener('click', () => openSource(Number(r.dataset.src), true)));

// à l'arrivée de la section, la réponse s'écrit, puis la première source se tire
const plateAnswer = $('#plate-answer');
if (!isReduced()) {
  const chars = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of n.data) { const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = ch; frag.append(sp); chars.push(sp); }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('ref')) walk(n);
      else if (n.nodeType === 1) chars.push(n);
    }
  };
  walk(plateAnswer);
  plateAnswer.classList.add('is-writing');
  openSource(0, false);
  extract.classList.add('is-shut');
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    chars.forEach((c, k) => setTimeout(() => c.classList.add('on'), k * 11));
    setTimeout(() => { extract.classList.remove('is-shut'); openSource(0, true); }, chars.length * 11 + 200);
  }, { threshold: 0.4 });
  io.observe(plateAnswer);
} else openSource(0, false);

/* =====================================================================
   5. Inscription (sans envoi)
   ===================================================================== */
const signup = $('#signup');
const mail = $('#mail');
const msg = $('#signup-msg');
const signupBtn = $('#signup-btn');
let signupTimer = 0;
signup.addEventListener('submit', (e) => {
  e.preventDefault();
  if (signupBtn.classList.contains('is-done') || signupBtn.classList.contains('is-busy')) return;
  clearTimeout(signupTimer);
  signup.classList.remove('is-error', 'is-done');
  msg.classList.remove('is-error');
  const v = mail.value.trim();
  const bad = !v ? `Indiquez votre adresse e-mail pour recevoir l’accès.`
    : !mail.checkValidity() || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) ? `Cette adresse semble incomplète. Exemple${NB}: nom@entreprise.fr.` : '';
  if (bad) {
    msg.textContent = bad; msg.classList.add('is-error');
    signup.classList.add('is-error');
    mail.setAttribute('aria-invalid', 'true');
    mail.focus();
    return;
  }
  mail.removeAttribute('aria-invalid');
  signupBtn.classList.add('is-busy'); signupBtn.setAttribute('aria-disabled', 'true');
  msg.textContent = '';
  signupTimer = setTimeout(() => {
    signupBtn.classList.remove('is-busy');
    signupBtn.classList.add('is-done'); $('.btn-txt', signupBtn).textContent = 'Merci';
    signup.classList.add('is-done');
    msg.textContent = `Merci. Banc est une marque de démonstration du studio Topiary${NB}: aucune donnée n’a été envoyée.`;
  }, isReduced() ? 0 : 900);
});
new ResizeObserver(() => {
  mail.placeholder = signup.clientWidth < 360 ? 'Votre adresse e-mail' : 'Votre adresse e-mail professionnelle';
}).observe(signup);
mail.addEventListener('input', () => {
  if (signupBtn.classList.contains('is-done')) {
    signupBtn.classList.remove('is-done'); signupBtn.removeAttribute('aria-disabled');
    $('.btn-txt', signupBtn).textContent = 'Recevoir mon accès'; signup.classList.remove('is-done'); msg.textContent = '';
  }
  if (signup.classList.contains('is-error')) { signup.classList.remove('is-error'); msg.textContent = ''; msg.classList.remove('is-error'); mail.removeAttribute('aria-invalid'); }
});

/* =====================================================================
   6. Pied de page : les liens hors de la page ne mènent nulle part, et le disent
   ===================================================================== */
const footNote = $('#foot-note');
$$('[data-nowhere]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  footNote.textContent = `«${NB}${a.lastChild.textContent.trim()}${NB}»${NB}: cette page n’existe pas.`;
}));

/* =====================================================================
   7. Le nom en caractères, au pied de page : la même matière que le banc du hero.
   Un petit banc traverse le mot ; chaque case s'allume au passage d'un poisson.
   ===================================================================== */
const F_RAMP = ['.', ':', '-', '=', '+', '*', '#'];
const F_EDGE = ['-', '\\', '|', '/'];
const F_INK = [[167, 176, 186], [78, 98, 118], [15, 21, 28]];
const foot = $('.foot-word');
let fc = null;                        // cases du mot
let footRaf = 0, footStarted = false, footDone = false;
function footInk(t) {
  const [a, b, c] = F_INK;
  const m = (x, y, k) => x.map((v, i) => Math.round(v + (y[i] - v) * k));
  return t < 0.5 ? m(a, b, t / 0.5) : m(b, c, (t - 0.5) / 0.5);
}
function prepFoot() {
  const r = foot.getBoundingClientRect();
  if (!r.width) return false;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  foot.width = Math.round(r.width * d); foot.height = Math.round(r.height * d);
  const cssCell = r.width >= 1024 ? 10 : r.width >= 600 ? 9 : 8;
  const cell = Math.round(cssCell * d);
  const cols = Math.floor(foot.width / cell), rows = Math.floor(foot.height / cell);
  // le mot, en masque fin, puis flouté : la case suit la lettre, le caractère suit son épaisseur
  const m = document.createElement('canvas'); m.width = cols * 4; m.height = rows * 4;
  const mx = m.getContext('2d', { willReadFrequently: true });
  mx.fillStyle = '#000'; mx.textBaseline = 'alphabetic'; mx.textAlign = 'center';
  let fs = m.height * 1.22;
  mx.font = `400 ${fs}px Manrope, sans-serif`;
  const tw = mx.measureText('banc').width;
  if (tw > m.width * 0.97) { fs *= (m.width * 0.97) / tw; mx.font = `400 ${fs}px Manrope, sans-serif`; }
  mx.fillText('banc', m.width / 2, m.height * 0.9);
  const bl = document.createElement('canvas'); bl.width = m.width; bl.height = m.height;
  const bx = bl.getContext('2d', { willReadFrequently: true });
  bx.filter = `blur(${Math.max(2, fs * 0.03)}px)`; bx.drawImage(m, 0, 0);
  const px = mx.getImageData(0, 0, m.width, m.height).data, pb = bx.getImageData(0, 0, m.width, m.height).data;
  const A = new Float32Array(cols * rows), T = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let a = 0, t = 0;
    for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) { const k = ((j * 4 + v) * m.width + i * 4 + u) * 4 + 3; a += px[k]; t += pb[k]; }
    A[j * cols + i] = a / (16 * 255); T[j * cols + i] = t / (16 * 255);
  }
  // atlas : chaque caractère en huit encres, dessiné une fois
  const glyphs = [...F_RAMP, ...F_EDGE], inks = 8;
  const atlas = document.createElement('canvas'); atlas.width = cell * glyphs.length; atlas.height = cell * inks;
  const ax = atlas.getContext('2d');
  ax.textAlign = 'center'; ax.textBaseline = 'middle';
  ax.font = `500 ${Math.round(cell * 1.08)}px "JetBrains Mono", monospace`;
  for (let k = 0; k < inks; k++) {
    ax.fillStyle = `rgb(${footInk(0.22 + 0.6 * k / (inks - 1)).join(',')})`;
    glyphs.forEach((g, gi) => ax.fillText(g, gi * cell + cell / 2, k * cell + cell * 0.56));
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? 0 : A[j * cols + i]);
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = A[j * cols + i];
    if (a < 0.07) continue;
    const dens = clamp(a * (0.4 + T[j * cols + i] * 0.85), 0, 1);
    let g = Math.round(Math.pow(dens, 0.85) * (F_RAMP.length - 1));
    const gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1);
    if (a < 0.72 && Math.hypot(gx, gy) > 0.2) {
      const ang = Math.atan2(gx, -gy);                 // le trait suit le bord
      g = F_RAMP.length + (Math.round(((ang / Math.PI * 4) % 4 + 4) % 4) % 4);
    }
    const ink = Math.round(clamp(0.15 + dens * 0.8, 0, 1) * (inks - 1));
    cells.push({ i, j, g, ink, lit: 0 });
  }
  const ox = Math.floor((foot.width - cols * cell) / 2);
  // le petit banc : des poissons qui traversent dans les deux sens, en ondulant
  const r0 = rows * 0.12, r1 = rows * 0.95;
  const fish = Array.from({ length: 9 }, (_, k) => {
    const dir = k % 2 ? -1 : 1;
    return { dir, y0: r0 + (r1 - r0) * ((k * 0.618) % 1), amp: rows * (0.08 + 0.1 * ((k * 0.37) % 1)), w: 2.2 + ((k * 0.71) % 1) * 1.6, ph: k * 1.7, delay: k * 0.11, speed: cols / (1.5 + ((k * 0.43) % 1) * 0.6) };
  });
  fc = { cells, cols, rows, cell, ox, atlas, glyphs: glyphs.length, fish, start: 0 };
  return true;
}
function drawFoot(now) {
  if (!fc) return;
  const x = foot.getContext('2d');
  const { cells, cell, ox, atlas, cols, rows } = fc;
  x.clearRect(0, 0, foot.width, foot.height);
  const t = fc.start ? (now - fc.start) / 1000 : 99;
  const heads = [];
  if (t < 99) for (const f of fc.fish) {
    const tt = t - f.delay;
    if (tt < 0) continue;
    const cx = f.dir > 0 ? -4 + tt * f.speed : cols + 4 - tt * f.speed;
    const cy = f.y0 + f.amp * Math.sin(tt * f.w + f.ph);
    if (cx < -6 || cx > cols + 6) continue;
    heads.push([cx, cy, f.dir]);
  }
  let left = 0;
  for (const k of cells) {
    if (!k.lit) {
      for (const [hx, hy] of heads) if ((k.i - hx) ** 2 + ((k.j - hy) * 1.25) ** 2 < 5.5) { k.lit = now || 1; break; }
      if (!k.lit && t > 2.6) k.lit = (now || 1) + (k.i * 7 + k.j * 13) % 380;   // les dernières cases, en fondu
    }
    if (!k.lit) { left++; continue; }
    const age = now ? (now - k.lit) / 280 : 1;
    if (age < 0) { left++; continue; }
    x.globalAlpha = Math.min(1, age);
    if (age < 1) left++;
    x.drawImage(atlas, k.g * cell, k.ink * cell, cell, cell, ox + k.i * cell, k.j * cell, cell, cell);
  }
  // les poissons du petit banc : un trait dans le sens de la nage
  x.globalAlpha = 1;
  for (const [hx, hy, dir] of heads) {
    for (let s2 = 0; s2 < 4; s2++) {
      const i = Math.round(hx - dir * s2), j = Math.round(hy);
      if (i < 0 || i >= cols || j < 0 || j >= rows) continue;
      x.globalAlpha = 1 - s2 * 0.22;
      x.drawImage(atlas, (s2 ? 2 : 6) * cell, 6 * cell, cell, cell, ox + i * cell, j * cell, cell, cell);
    }
  }
  x.globalAlpha = 1;
  return left === 0 && t > 2.6;
}
function footLoop(now) {
  footRaf = 0;
  if (!fc.start) fc.start = now;
  if (drawFoot(now)) { footDone = true; drawFoot(0); return; }
  footRaf = requestAnimationFrame(footLoop);
}
function footFinal() { if (!fc) return; for (const k of fc.cells) k.lit = 1; fc.start = 0; drawFoot(0); }
const footIo = new IntersectionObserver((es) => {
  if (!es[0].isIntersecting || footStarted || !fc) return;
  footStarted = true; footIo.disconnect();
  if (isReduced()) { footDone = true; footFinal(); return; }
  footRaf = requestAnimationFrame(footLoop);
}, { threshold: 0.4 });
document.fonts.ready.then(() => {
  if (prepFoot()) footIo.observe(foot);
  new ResizeObserver(() => {
    if (!prepFoot()) return;
    if (footDone || (footStarted && !footRaf)) { footDone = true; footFinal(); }
    else if (footStarted) { cancelAnimationFrame(footRaf); footDone = true; footFinal(); }
  }).observe(foot);
});

// le verre : monté une fois la page posée (les polices changent la taille des pièces)
monterVerre();
document.fonts.ready.then(() => document.querySelectorAll('[data-verre]').forEach(peindreVerre));
