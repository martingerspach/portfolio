// Banc : le verre liquide des commandes (la vitre de l'aquarium).
// Technique reprise d'Auvent (design/abri/lib/verre.js, 2026-10-09) : sous Chromium, un filtre SVG par pièce dans
// backdrop-filter (carte de déplacement du biseau, trois canaux légèrement décalés, saturation) ; ailleurs, un léger
// flou de repli ; partout, un liseré vectoriel (banc.css). Le banc nage dessous et se plie au bord du verre.
//
// Options par pièce : data-verre="bord:18 force:1 dispersion:0.05 flou:0.4 lentille:1"
//   bord : largeur du biseau (px) ; force : déviation ; lentille:0 = liseré et teinte seulement (pièce sur fond uni).
// Profil du biseau monotone : s(d) = d + σ·b·(1 − d/b)^4 avec 4σ < 1, sinon l'image se replie (boucles).

const NS = 'http://www.w3.org/2000/svg';
// Banc est en niveaux de gris : la dispersion des trois couleurs ne se verrait pas et triplerait le coût.
const DEF = { bord: 18, force: 1, dispersion: 0, flou: 0, saturation: 1, lentille: 1 };

// Chromium seul applique un filtre SVG dans backdrop-filter. userAgentData n'existe qu'en contexte sécurisé :
// repli sur la chaîne d'agent (jamais CriOS, EdgiOS, FxiOS : WebKit sur iPhone).
const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
const ua = navigator.userAgent || '';
export const chromium = brands.length
  ? brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))
  : /(Chrome|Chromium)\/\d/.test(ua) && !/CriOS|EdgiOS|FxiOS|OPiOS/.test(ua);
const reduit = matchMedia('(prefers-reduced-transparency: reduce)');
const contraste = matchMedia('(prefers-contrast: more)');
const lentille = () => chromium && !reduit.matches && !contraste.matches && !new URLSearchParams(location.search).has('sansverre');
document.documentElement.classList.toggle('verre-lentille', lentille());

let defs = null;
function svgDefs() {
  if (defs) return defs;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

// distance signée au bord d'un rectangle arrondi (négative dedans) et normale sortante
function sdf(px, py, hx, hy, r) {
  const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
  let d, nx, ny;
  if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); d = l - r; nx = qx / l; ny = qy / l; }
  else if (qx > qy) { d = qx - r; nx = 1; ny = 0; }
  else { d = qy - r; nx = 0; ny = 1; }
  return { d, nx: nx * Math.sign(px || 1), ny: ny * Math.sign(py || 1) };
}
const SIGMA = 0.23;
const deviation = (u, force) => Math.min(0.2475, SIGMA * force) * Math.pow(1 - Math.min(1, Math.max(0, u)), 4);

const cartes = new Map();
function carte(w, h, r, bord, force) {
  const k = [w, h, r, bord, force].join(':');
  if (cartes.has(k)) return cartes.get(k);
  const s = w * h > 320000 ? 0.5 : 1;
  const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
  const hx = w / 2, hy = h / 2, max = deviation(0, force);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = (x + 0.5) / s - hx, Y = (y + 0.5) / s - hy;
    const g = sdf(X, Y, hx, hy, r), dedans = -g.d;
    let dx = 0, dy = 0;
    if (dedans < bord) { const m = deviation(dedans / bord, force) / max; dx = -g.nx * m; dy = -g.ny * m; }   // vers l'intérieur
    const i = (y * W + x) * 4;
    px[i] = Math.round(127.5 + dx * 127.5); px[i + 1] = Math.round(127.5 + dy * 127.5); px[i + 2] = 128; px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  cartes.set(k, url);
  return url;
}

let n = 0;
function filtre(el, w, h, o) {
  let f = el._verreFiltre;
  if (!f) {
    f = document.createElementNS(NS, 'filter');
    f.id = 'banc-verre-' + (++n);
    svgDefs().appendChild(f);
    el._verreFiltre = f;
  }
  const b = Math.min(o.bord, Math.min(w, h) / 2);
  const S = deviation(0, o.force) * b;
  const map = carte(w, h, o.rayon, b, o.force);
  for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
  const canal = { R: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', G: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', B: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0' };
  const sc = { R: S * (1 + o.dispersion), G: S, B: S * (1 - o.dispersion) };
  const map2 = `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="c"/>`;
  const src = o.flou > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${o.flou}" edgeMode="duplicate" result="f"/>` : '';
  const inp = o.flou > 0 ? 'f' : 'SourceGraphic';
  if (!o.dispersion) {
    // un seul déplacement : le biseau plie ce qui passe dessous
    f.innerHTML = src + map2 + `<feDisplacementMap in="${inp}" in2="c" scale="${(2 * S).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>` +
      (o.saturation !== 1 ? `<feColorMatrix type="saturate" values="${o.saturation}"/>` : '');
    return f.id;
  }
  f.innerHTML = src + map2 +
    ['R', 'G', 'B'].map((k) => `<feDisplacementMap in="${inp}" in2="c" scale="${(2 * sc[k]).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${k}"/>` +
      `<feColorMatrix in="d${k}" type="matrix" values="${canal[k]}" result="${k}"/>`).join('') +
    `<feComposite in="R" in2="G" operator="arithmetic" k2="1" k3="1" result="RG"/>` +
    `<feComposite in="RG" in2="B" operator="arithmetic" k2="1" k3="1" result="RGB"/>` +
    `<feColorMatrix in="RGB" type="saturate" values="${o.saturation}"/>`;
  return f.id;
}

function options(el) {
  const o = { ...DEF };
  for (const part of (el.getAttribute('data-verre') || '').split(/\s+/)) {
    const [k, v] = part.split(':');
    if (k && v !== undefined && k in o) o[k] = parseFloat(v);
  }
  o.rayon = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return o;
}
export function peindre(el) {
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if (!w || !h) return;
  const o = options(el);
  o.rayon = Math.min(o.rayon, w / 2, h / 2);
  el.style.setProperty('--verre-bord', +Math.min(o.bord, Math.min(w, h) / 2).toFixed(2));
  if (!o.lentille) el.style.backdropFilter = 'none';
  else if (lentille()) el.style.backdropFilter = `url(#${filtre(el, w, h, o)})`;
  else el.style.backdropFilter = '';
  el._verreTaille = w + 'x' + h;
}
// pendant un changement de taille : la carte en place est étirée, puis recalculée 120 ms après le dernier changement
function etirer(el, w, h) {
  const f = el._verreFiltre;
  if (f) {
    f.setAttribute('width', w); f.setAttribute('height', h);
    const im = f.querySelector('feImage'); if (im) { im.setAttribute('width', w); im.setAttribute('height', h); }
  }
  clearTimeout(el._verreMinuterie);
  el._verreMinuterie = setTimeout(() => peindre(el), 120);
}
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target, w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (el._verreTaille === w + 'x' + h) continue;
    if (el._verreTaille) etirer(el, w, h); else peindre(el);
  }
});
export function monter(racine = document) {
  for (const el of racine.querySelectorAll('[data-verre]')) {
    if (el._verreMonte) continue;
    el._verreMonte = true; ro.observe(el); peindre(el);
  }
}
for (const m of [reduit, contraste]) m.addEventListener('change', () => {
  document.documentElement.classList.toggle('verre-lentille', lentille());
  document.querySelectorAll('[data-verre]').forEach(peindre);
});
