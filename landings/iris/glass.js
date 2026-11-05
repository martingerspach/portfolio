// Iris : le verre liquide des commandes (en-tête, boutons, sélecteur, champ). Jamais sur le contenu.
// Technique reprise d'Auvent (design/abri/lib/verre.js) et du banc (design/saas/banc/banc-verre.js) : sous Chromium, un
// filtre SVG par pièce dans backdrop-filter (carte de déplacement du biseau, saturation) ; ailleurs un flou de repli ;
// partout un liseré vectoriel en ombres intérieures (iris.css). Profil du biseau monotone : s(d) = d + σ·b·(1 − d/b)^4,
// 4σ < 1, sinon l'image se replie.
// Options : data-glass="edge:16 force:1 spread:0.04 frost:0.6 sat:1.25 lens:1 p:4 amp:0"
// p : exposant du profil D(u) = amp·b·(1 − u)^p ; monotone tant que amp·p·(1 + spread) < 1. p = 2 donne un biseau
// deux fois plus réfractant que p = 4 à largeur égale, plus large et plus doux (lentille lisible sur une photo).

const NS = 'http://www.w3.org/2000/svg';
const DEF = { edge: 16, force: 1, spread: 0, frost: 0.6, sat: 1.25, lens: 1, p: 4, amp: 0 };
const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
const ua = navigator.userAgent || '';
export const chromium = brands.length
  ? brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))
  : /(Chrome|Chromium)\/\d/.test(ua) && !/CriOS|EdgiOS|FxiOS|OPiOS/.test(ua);
const lessTransp = matchMedia('(prefers-reduced-transparency: reduce)');
const moreContrast = matchMedia('(prefers-contrast: more)');
const lensOn = () => chromium && !lessTransp.matches && !moreContrast.matches && !new URLSearchParams(location.search).has('noglass');
document.documentElement.classList.toggle('glass-lens', lensOn());

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
function sdf(px, py, hx, hy, r) {
  const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
  let d, nx, ny;
  if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); d = l - r; nx = qx / l; ny = qy / l; }
  else if (qx > qy) { d = qx - r; nx = 1; ny = 0; }
  else { d = qy - r; nx = 0; ny = 1; }
  return { d, nx: nx * Math.sign(px || 1), ny: ny * Math.sign(py || 1) };
}
const SIGMA = 0.23;
const dev = (u, o) => {
  const p = o.p || 4, a = o.amp > 0 ? o.amp : SIGMA * o.force;
  return Math.min(a, 0.97 / (p * (1 + (o.spread || 0)))) * Math.pow(1 - Math.min(1, Math.max(0, u)), p);
};
const maps = new Map();
function dispMap(w, h, r, edge, o) {
  const k = [w, h, r, edge, o.force, o.p, o.amp, o.spread].join(':');
  if (maps.has(k)) return maps.get(k);
  const s = w * h > 320000 ? 0.5 : 1;
  const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
  const hx = w / 2, hy = h / 2, max = dev(0, o);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = (x + 0.5) / s - hx, Y = (y + 0.5) / s - hy;
    const g = sdf(X, Y, hx, hy, r), inside = -g.d;
    let dx = 0, dy = 0;
    if (inside < edge) { const m = dev(inside / edge, o) / max; dx = -g.nx * m; dy = -g.ny * m; }
    const i = (y * W + x) * 4;
    px[i] = Math.round(127.5 + dx * 127.5); px[i + 1] = Math.round(127.5 + dy * 127.5); px[i + 2] = 128; px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  maps.set(k, url);
  return url;
}
let n = 0;
function filter(el, w, h, o) {
  let f = el._glassFilter;
  if (!f) {
    f = document.createElementNS(NS, 'filter');
    f.id = 'iris-glass-' + (++n);
    svgDefs().appendChild(f);
    el._glassFilter = f;
  }
  const b = Math.min(o.edge, Math.min(w, h) / 2);
  const S = dev(0, o) * b;
  const map = dispMap(w, h, o.radius, b, o);
  for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
  const frost = o.frost > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${o.frost}" edgeMode="duplicate" result="f"/>` : '';
  const inp = o.frost > 0 ? 'f' : 'SourceGraphic';
  const img = `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="c"/>`;
  if (!o.spread) {
    f.innerHTML = frost + img + `<feDisplacementMap in="${inp}" in2="c" scale="${(2 * S).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>` +
      `<feColorMatrix type="saturate" values="${o.sat}"/>`;
  } else {
    const ch = { R: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', G: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', B: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0' };
    const sc = { R: S * (1 + o.spread), G: S, B: S * (1 - o.spread) };
    f.innerHTML = frost + img + ['R', 'G', 'B'].map((k) => `<feDisplacementMap in="${inp}" in2="c" scale="${(2 * sc[k]).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${k}"/>` +
      `<feColorMatrix in="d${k}" type="matrix" values="${ch[k]}" result="${k}"/>`).join('') +
      `<feComposite in="R" in2="G" operator="arithmetic" k2="1" k3="1" result="RG"/><feComposite in="RG" in2="B" operator="arithmetic" k2="1" k3="1" result="RGB"/>` +
      `<feColorMatrix in="RGB" type="saturate" values="${o.sat}"/>`;
  }
  return f.id;
}
function opts(el) {
  const o = { ...DEF };
  for (const part of (el.getAttribute('data-glass') || '').split(/\s+/)) {
    const [k, v] = part.split(':');
    if (k && v !== undefined && k in o) o[k] = parseFloat(v);
  }
  o.radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return o;
}
export function paint(el) {
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if (!w || !h) return;
  const o = opts(el);
  o.radius = Math.min(o.radius, w / 2, h / 2);
  el.style.setProperty('--glass-edge', +Math.min(o.edge, Math.min(w, h) / 2).toFixed(2));
  if (!o.lens) el.style.backdropFilter = '';
  else if (lensOn()) el.style.backdropFilter = `url(#${filter(el, w, h, o)})`;
  else el.style.backdropFilter = '';
  el._glassSize = w + 'x' + h;
}
function stretch(el, w, h) {
  const f = el._glassFilter;
  if (f) {
    f.setAttribute('width', w); f.setAttribute('height', h);
    const im = f.querySelector('feImage'); if (im) { im.setAttribute('width', w); im.setAttribute('height', h); }
  }
  clearTimeout(el._glassTimer);
  el._glassTimer = setTimeout(() => paint(el), 120);
}
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target, w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (el._glassSize === w + 'x' + h) continue;
    if (el._glassSize) stretch(el, w, h); else paint(el);
  }
});
// préparer une pièce avant son arrivée : la première image d'un filtre SVG (graphe, carte du biseau décodée) coûtait
// 20 à 35 ms à l'arrivée du champ. Une sonde (opacité 0,03 : le fond filtré sur le fond, invisible) le compose une fois, au repos.
export function warm(el) {
  if (!el || !el._glassFilter || !lensOn()) return;
  const p = document.createElement('div');
  p.setAttribute('aria-hidden', 'true');
  p.style.cssText = `position:fixed;left:0;top:0;width:${el.offsetWidth}px;height:${el.offsetHeight}px;pointer-events:none;opacity:0.03;z-index:29;backdrop-filter:url(#${el._glassFilter.id})`;
  document.body.appendChild(p);
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => p.remove())));
}
export function mount(root = document) {
  for (const el of root.querySelectorAll('[data-glass]')) {
    if (el._glassMounted) continue;
    el._glassMounted = true; ro.observe(el); paint(el);
  }
}
for (const m of [lessTransp, moreContrast]) m.addEventListener('change', () => {
  document.documentElement.classList.toggle('glass-lens', lensOn());
  document.querySelectorAll('[data-glass]').forEach(paint);
});
