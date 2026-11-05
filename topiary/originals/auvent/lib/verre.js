/* Auvent · verre liquide (script classique, expose window.Auvent.verre).
   Références : le matériau Liquid Glass d'Apple (iOS 26, juin 2025) : une lentille au bord, un reflet spéculaire qui suit
   la lumière, une teinte qui s'adapte ; la réfraction d'un biseau convexe rendue par feDisplacementMap dans
   backdrop-filter (méthode publiée par kube.io en 2025, qui ne marche que sous Chromium).

   Chaque élément [data-verre] reçoit, recalculés à chaque changement de taille :
   - dans tous les navigateurs, un liseré spéculaire (ombres intérieures vectorielles du calque ::before, verre.css ; le
     script ne pose que la largeur du biseau, --verre-bord) ;
   - sous Chromium, un filtre SVG à sa taille : réfraction du bord, dispersion des trois couleurs, saturation ;
   - ailleurs, un flou classique (règle CSS de repli) : le verre reste lisible, sans lentille.
   Options par élément : data-verre="bord:22 force:1 dispersion:0.06 flou:0.6 zoom:1 vivant:0 lentille:1" (bord en px ; force
   multiplie la déviation du bord ; zoom ajoute une loupe ; vivant étire la carte pendant un changement de taille ; lentille:0
   garde le liseré et la teinte sans filtre d'arrière-plan).
   Préférence « transparence réduite » : aucun filtre, la teinte devient opaque (CSS). */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const NS = 'http://www.w3.org/2000/svg';
  const css = getComputedStyle(document.documentElement);
  const num = (k, d) => { const v = parseFloat(css.getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
  const DEF = {
    bord: num('--av-verre-bord', 22), dispersion: num('--av-verre-dispersion', 0.06),
    flou: num('--av-verre-flou', 0.6), saturation: num('--av-verre-saturation', 1.45),
  };
  // Chromium seul applique un filtre SVG dans backdrop-filter (Safari et Firefox l'ignorent sans erreur).
  // userAgentData n'existe qu'en contexte sécurisé : repli sur la chaîne d'agent (Chrome, Edge, Opera de bureau et
  // Android ; jamais CriOS, EdgiOS ni FxiOS, qui sont WebKit sur iPhone).
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const ua = navigator.userAgent || '';
  const chromium = brands.length
    ? brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))
    : /(Chrome|Chromium)\/\d/.test(ua) && !/CriOS|EdgiOS|FxiOS|OPiOS/.test(ua);
  const reduit = matchMedia('(prefers-reduced-transparency: reduce)');
  const lentille = () => chromium && !reduit.matches;
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

  // ---------- Géométrie : rectangle arrondi ----------
  // Distance signée au bord (négative dedans) et normale sortante, pour un point relatif au centre.
  function sdf(px, py, hx, hy, r) {
    const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
    let d, nx, ny;
    if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); d = l - r; nx = qx / l; ny = qy / l; }
    else if (qx > qy) { d = qx - r; nx = 1; ny = 0; }
    else { d = qy - r; nx = 0; ny = 1; }
    return { d, nx: nx * Math.sign(px || 1), ny: ny * Math.sign(py || 1) };
  }

  // Profil du bord. Un rayon vertical qui traverse un biseau convexe est dévié vers l'intérieur : le bord montre, étiré,
  // ce qui est un peu plus loin sous la pièce. Point échantillonné à la profondeur d : s(d) = d + m(d), avec
  // m(d) = σ·b·(1 − d/b)^4 (b : largeur du biseau). s reste croissante tant que 4σ < 1 : jamais de repli de l'image
  // (la v1, calculée par la loi de Snell sans cette borne, faisait des boucles dans une grille vue au travers).
  // Étirement au bord : 1 / (1 − 4σ), soit ×12 pour σ = 0,23.
  const SIGMA = 0.23;
  const deviation = (u, force) => Math.min(0.2475, SIGMA * force) * Math.pow(1 - Math.min(1, Math.max(0, u)), 4);

  // ---------- Carte de déplacement (R, G) ----------
  // Une carte en pixels CSS suffit : le filtre tourne au pixel de l'écran et l'étire de façon lisse (essai à pleine
  // densité : 34 à 46 pixels différents sur toute la page, écart de 16 niveaux au plus).
  const cartes = new Map();
  // zoom > 1 : en plus du bord, une loupe — chaque point lit plus près du centre (s = c + (p − c) / zoom).
  function carteDeplacement(w, h, r, bord, force, zoom = 1) {
    const k = ['d', w, h, r, bord, force, zoom].join(':');
    if (cartes.has(k)) return cartes.get(k);
    // Résolution réduite pour les grandes pièces : la carte est lisse, le filtre l'étire sans marche visible.
    const s = w * h > 320000 ? 0.5 : 1;
    const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
    const hx = w / 2, hy = h / 2, kz = 1 - 1 / zoom;
    const max = deviation(0, force) + Math.max(hx, hy) * kz / Math.max(1e-6, bord);   // en largeurs de biseau
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X = (x + 0.5) / s - hx, Y = (y + 0.5) / s - hy;
      const g = sdf(X, Y, hx, hy, r), dedans = -g.d;
      let dx = 0, dy = 0;
      if (dedans < bord) { const m = deviation(dedans / bord, force) / max; dx = -g.nx * m; dy = -g.ny * m; }   // vers l'intérieur
      if (kz && dedans >= 0) { dx -= (X * kz) / bord / max; dy -= (Y * kz) / bord / max; }
      const i = (y * W + x) * 4;
      px[i] = Math.round(127.5 + dx * 127.5); px[i + 1] = Math.round(127.5 + dy * 127.5); px[i + 2] = 128; px[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    cartes.set(k, url);
    return url;
  }

  // ---------- Filtre SVG d'un élément ----------
  let n = 0;
  function filtre(el, w, h, o) {
    const d = svgDefs();
    let f = el._verreFiltre;
    if (!f) {
      f = document.createElementNS(NS, 'filter');
      f.id = 'verre-' + (++n);
      d.appendChild(f);
      el._verreFiltre = f;
    }
    const b = Math.min(o.bord, Math.min(w, h) / 2), z = o.zoom || 1;
    const S = deviation(0, o.force) * b + Math.max(w, h) / 2 * (1 - 1 / z);   // déviation maximale, en px
    const carte = carteDeplacement(w, h, o.rayon, b, o.force, z);
    const att = { x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' };
    for (const [k, v] of Object.entries(att)) f.setAttribute(k, v);
    const canal = (c) => ({ R: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', G: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', B: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0' }[c]);
    const sc = { R: S * (1 + o.dispersion), G: S, B: S * (1 - o.dispersion) };
    // Pièce posée dans une autre pièce de verre : son arrière-plan n'est que le contenu de la pièce parente, transparent
    // ailleurs. On le pose sur la couleur de la parente (--verre-fond), sinon la transparence devient un voile gris.
    const fond = o.fond ? `<feFlood flood-color="${o.fond}" result="fl"/><feComposite in="SourceGraphic" in2="fl" operator="over" result="src"/>` : '';
    f.innerHTML = fond +
      `<feGaussianBlur in="${o.fond ? 'src' : 'SourceGraphic'}" stdDeviation="${o.flou}" edgeMode="duplicate" result="f"/>` +
      `<feImage href="${carte}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="c"/>` +
      ['R', 'G', 'B'].map((k) => `<feDisplacementMap in="f" in2="c" scale="${(2 * sc[k]).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${k}"/>` +
        `<feColorMatrix in="d${k}" type="matrix" values="${canal(k)}" result="${k}"/>`).join('') +
      `<feComposite in="R" in2="G" operator="arithmetic" k2="1" k3="1" result="RG"/>` +
      `<feComposite in="RG" in2="B" operator="arithmetic" k2="1" k3="1" result="RGB"/>` +
      `<feColorMatrix in="RGB" type="saturate" values="${o.saturation}"/>`;
    return f.id;
  }

  // ---------- Montage ----------
  function options(el) {
    const o = { ...DEF, force: 1, zoom: 1, vivant: 0, lentille: 1 };
    const s = el.getAttribute('data-verre') || '';
    for (const part of s.split(/\s+/)) { const [k, v] = part.split(':'); if (k && v !== undefined && k in o) o[k] = parseFloat(v); }
    const cs = getComputedStyle(el);
    o.rayon = parseFloat(cs.borderTopLeftRadius) || 0;
    o.fond = cs.getPropertyValue('--verre-fond').trim();
    return o;
  }
  function peindre(el) {
    // Seules les pièces [data-verre] ont une lentille. L'indicateur de la navigation n'en est plus une depuis la v11 (un
    // remplissage, jamais de verre sur du verre) : repeint au changement de contexte, il recevait une lentille sur la
    // barre, à la taille du lien d'alors, puis s'étirait sans elle.
    if (!el || !el.hasAttribute('data-verre')) return;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const o = options(el);
    o.rayon = Math.min(o.rayon, w / 2, h / 2);
    const bord = Math.min(o.bord, Math.min(w, h) / 2);
    el.style.setProperty('--verre-bord', +bord.toFixed(2));
    // lentille:0 : liseré et teinte seulement, sans filtre d'arrière-plan (pièce posée sur un fond uni, ou qui contient
    // une animation : un filtre recalculé à chaque image coûterait plus qu'il ne montre)
    if (!o.lentille) el.style.backdropFilter = 'none';
    else if (lentille()) {
      const id = filtre(el, w, h, o);
      el.style.backdropFilter = `url(#${id})`;
    } else el.style.backdropFilter = '';
    // Repli (Safari, Firefox) : un flou proportionnel à la pièce. À 14 px, un bouton de 48 px devenait une pastille de
    // couleur ; Apple garde de la structure sous les petites commandes.
    el.style.setProperty('--verre-flou-repli', Math.round(Math.max(5, Math.min(14, Math.min(w, h) * 0.13))) + 'px');
    el._verreTaille = w + 'x' + h;
  }
  // Changement de taille d'une pièce déjà peinte : la carte en place est seulement étirée à la nouvelle taille (le liseré,
  // vectoriel, suit seul), puis recalculée 120 ms après le dernier changement. Jamais dans la tâche qui change la taille :
  // le recalcul y coûtait jusqu'à 35 ms, processeur ralenti 4 fois (avec le reflet en image, retiré depuis).
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
  // Lueur qui suit le pointeur (appareils à survol) : la lumière glisse sur la pièce, position en variables CSS
  const survol = matchMedia('(hover: hover) and (pointer: fine)');
  function lueur(el) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
    el.addEventListener('pointerenter', () => el.classList.add('verre-survol'));
    el.addEventListener('pointerleave', () => el.classList.remove('verre-survol'));
  }
  function monter(racine = document) {
    const els = racine.querySelectorAll ? racine.querySelectorAll('[data-verre]') : [];
    for (const el of els) {
      if (el._verreMonte) continue;
      el._verreMonte = true; ro.observe(el); peindre(el);
      if (survol.matches && !el.classList.contains('tete-curseur')) lueur(el);
    }
  }
  reduit.addEventListener('change', () => {
    document.documentElement.classList.toggle('verre-lentille', lentille());
    document.querySelectorAll('[data-verre]').forEach(peindre);
  });
  A.verre = { monter, peindre, chromium };
})();
