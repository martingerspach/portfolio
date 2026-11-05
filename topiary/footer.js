// Topiary v4 : l'orbite des réseaux du pied de page « La surimpression » (footer.css).
// Le cercle que l'utilisateur a tracé à main levée autour des réseaux devient une ellipse parfaite : un anneau couché,
// vu d'en haut en perspective, qui entoure les deux icônes. Il se trace une fois à l'arrivée, en deux moitiés symétriques
// parties du point le plus lointain et réunies au plus proche ; les têtes du tracé arrivent en fondu. Le trait est un
// dégradé continu de profondeur : fin et pâle au fond, plein et plus épais devant, sans aucune marche. Sous chaque icône,
// une ombre portée très douce sur le plan de l'anneau. Puis le bloc vit en 3D : un léger lacet et un léger tangage
// suivent le défilement (le bloc se pose bien de face en bas de page) et, sur ordinateur, le pointeur ; l'anneau, les
// ombres et les icônes étant à des profondeurs différentes, ils glissent les uns par rapport aux autres (parallaxe).
// L'icône visée avance et s'élève, son ombre s'étale et pâlit. Projection perspective calculée à chaque image, dessinée
// sur deux canevas à la densité de l'écran (le fond derrière les icônes, l'avant devant) ; rien ne bouge en mouvements réduits.
(() => {
  const root = document.querySelector('.pied__orbite');
  if (!root) return;
  const cvBack = root.querySelector('.pied__ring--back');
  const cvFront = root.querySelector('.pied__ring--front');
  const nets = [...root.querySelectorAll('.pied__net')];
  const footer = root.closest('.pied') || root.parentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const rad = Math.PI / 180;
  if (!cvBack || !cvFront || !cvBack.getContext) return;
  const cb = cvBack.getContext('2d'), cf = cvFront.getContext('2d');

  // Géométrie, en px : rayon de l'anneau, demi-écart des icônes, hauteur des icônes au-dessus du plan, focale,
  // élévation du regard (44° : une ellipse de rapport 0,69, celle du tracé de l'utilisateur), avance et élévation d'une
  // icône visée, rayon de l'ombre.
  const G = { R: 92, s: 30, h: 14, f: 620, el: 44, near: 22, rise: 7, shadow: 14 };
  // Amplitudes : lacet et tangage dus au défilement (de l'arrivée jusqu'au bas de la page) et au pointeur.
  const A = { yawScroll: 16, tiltScroll: 7, yawPtr: 11, tiltPtr: 5 };
  // Le trait : épaisseur au fond et devant, part pâle au fond ; longueur du fondu des têtes pendant le tracé.
  const STROKE = { wBack: 0.9, wFront: 1.9, paleBack: 0.4, head: 0.16 };
  const TRACE_MS = 1300;
  const SEGS = 96;                 // segments par moitié d'anneau : le dégradé reste continu à l'œil

  let W = 0, H = 0, scale = 1, dpr = 1;
  const x = { yaw: -A.yawScroll, tilt: A.tiltScroll, h0: 0, h1: 0 };   // état courant
  const v = { yaw: 0, tilt: 0, h0: 0, h1: 0 };                          // vitesses
  const t = { yaw: 0, tilt: 0, h0: 0, h1: 0 };                          // cibles
  const ptr = { yaw: 0, tilt: 0 };
  let p = 0, traceStart = 0, traced = false, visible = false, raf = 0, last = 0;

  // ---------- Couleurs : lues sur les jetons, mélangées en OKLab ----------
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function oklab(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((u) => toLin(u / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function rgb([L, a, bb]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
    const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return `rgb(${c.map((u) => Math.round(255 * Math.min(1, Math.max(0, toSrgb(u))))).join(',')})`;
  }
  const mix = (a, b, k) => a.map((u, i) => u + (b[i] - u) * k);
  let C = null;
  function colors() {
    const cs = getComputedStyle(root);
    const hex = (name, fb) => { const v0 = cs.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(v0) ? v0 : fb; };
    const coral = oklab(hex('--accent', '#FF7360')), paper = oklab(hex('--paper', '#F4F2EF')), ink = hex('--ink', '#1F201E');
    const n = parseInt(ink.slice(1), 16);
    // 64 teintes précalculées, du fond pâle (40 % de corail sur le papier) au corail plein
    const ramp = Array.from({ length: 64 }, (_, i) => mix(mix(paper, coral, STROKE.paleBack), coral, i / 63));
    C = { coral, paper, ramp, rampCss: ramp.map(rgb), ink: [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
  }

  // ---------- Projection ----------
  // Monde : x à droite, y vers le haut, z vers le spectateur ; l'anneau est dans le plan y = 0.
  function proj(px, py, pz, yaw, el) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const x1 = px * cyw + pz * syw;
    const z1 = -px * syw + pz * cyw;
    const ce = Math.cos(el), se = Math.sin(el);
    const d = z1 * ce + py * se;          // profondeur vers le regard
    const vv = z1 * se - py * ce;         // hauteur à l'écran (positif = vers le bas)
    const k = G.f / (G.f - d);
    return { x: W / 2 + x1 * k * scale, y: H / 2 + vv * k * scale, d, k };
  }
  const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

  // Une moitié de l'anneau, du point le plus lointain (-90°) vers le plus proche, sur une fraction q de son chemin.
  // Chaque segment prend la teinte et l'épaisseur de sa profondeur ; près de la tête du tracé, il pâlit jusqu'au papier.
  function half(sign, q, yaw, el) {
    const dMax = G.R * Math.cos(el) + 1e-6;
    const end = q * SEGS;
    let prev = proj(0, 0, -G.R, yaw, el);
    for (let i = 1; i <= Math.ceil(end); i++) {
      const u = Math.min(i, end) / SEGS;
      const a = -Math.PI / 2 + sign * u * Math.PI;
      const P = proj(G.R * Math.cos(a), 0, G.R * Math.sin(a), yaw, el);
      const dm = (prev.d + P.d) / 2;
      const w = smooth((dm / dMax + 1) / 2);                         // 0 au fond, 1 devant
      // Fondu de la tête : sur les derniers 16 % du chemin tracé, tant que le tracé n'est pas fini
      const head = q >= 1 ? 1 : smooth((q - (u - 0.5 / SEGS)) / STROKE.head);
      const ctx = dm >= 0 ? cf : cb;
      const ci = Math.round(w * 63);
      ctx.strokeStyle = head >= 0.999 ? C.rampCss[ci] : rgb(mix(C.paper, C.ramp[ci], head));
      ctx.lineWidth = (STROKE.wBack + (STROKE.wFront - STROKE.wBack) * w) * scale * (0.55 + 0.45 * head);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(P.x, P.y);
      ctx.stroke();
      prev = P;
    }
  }

  // L'ombre portée d'une icône : une ellipse très douce sur le plan de l'anneau, à l'aplomb de l'icône
  function shadow(px, pz, lift, yaw, el) {
    const P = proj(px, 0, pz, yaw, el);
    const r = G.shadow * (1 + 0.35 * lift) * P.k * scale;
    const ry = r * Math.sin(el);
    const a = 0.15 * (1 - 0.3 * lift);
    const [R, Gc, B] = C.ink;
    cb.save();
    cb.translate(P.x, P.y);
    cb.scale(1, ry / r);
    const g = cb.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${R},${Gc},${B},${a})`);
    g.addColorStop(0.45, `rgba(${R},${Gc},${B},${a * 0.55})`);
    g.addColorStop(0.75, `rgba(${R},${Gc},${B},${a * 0.16})`);
    g.addColorStop(1, `rgba(${R},${Gc},${B},0)`);
    cb.fillStyle = g;
    cb.beginPath();
    cb.arc(0, 0, r, 0, Math.PI * 2);
    cb.fill();
    cb.restore();
  }

  function render() {
    if (!W || !C) return;
    const yaw = x.yaw * rad, el = (G.el + x.tilt) * rad;
    for (const c of [cb, cf]) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.lineCap = 'round'; c.lineJoin = 'round'; }
    nets.forEach((n, i) => {
      const lift = i === 0 ? x.h0 : x.h1;
      const sx = (i === 0 ? -1 : 1) * G.s, sz = lift * G.near;
      shadow(sx, sz, lift, yaw, el);
      // L'icône visée avance vers le regard et s'élève un peu au-dessus de son ombre
      const P = proj(sx, G.h + lift * G.rise, sz, yaw, el);
      n.style.transform = `translate(${(P.x - W / 2).toFixed(2)}px, ${(P.y - H / 2).toFixed(2)}px) scale(${P.k.toFixed(4)})`;
      n.style.zIndex = P.d > 0 ? 1 : 0;   // la plus proche passe devant l'autre, toutes deux sous l'avant de l'anneau
    });
    if (p > 0) { half(-1, p, yaw, el); half(1, p, yaw, el); }
  }

  // ---------- Pilotes ----------
  function scrollTargets() {
    const de = document.documentElement;
    const max = de.scrollHeight - innerHeight;
    // Distance au bas de la page, en hauteurs d'écran : 0 tout en bas (le bloc est alors parfaitement de face)
    const away = Math.min(1, Math.max(0, (max - scrollY) / innerHeight));
    const e = away * away * (3 - 2 * away);
    t.yaw = -A.yawScroll * e + ptr.yaw;
    t.tilt = A.tiltScroll * e + ptr.tilt;
  }

  // Ressort critique (aucun rebond), indépendant de la cadence d'affichage
  const W0 = 9;
  function spring(k, dt) {
    const a = W0 * W0 * (t[k] - x[k]) - 2 * W0 * v[k];
    v[k] += a * dt;
    x[k] += v[k] * dt;
  }
  const KEYS = ['yaw', 'tilt', 'h0', 'h1'];
  const settled = () => KEYS.every((k) => Math.abs(t[k] - x[k]) < 0.002 && Math.abs(v[k]) < 0.002);
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 0.5 - Math.cos(Math.PI * u) / 2); // sinusoïde : départ et arrivée doux

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (traced && p < 1) p = ease((now - traceStart) / TRACE_MS);
    KEYS.forEach((k) => spring(k, dt));
    render();
    if (visible && (p < 1 || !settled())) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function wake() { if (!raf && visible && !reduce.matches) raf = requestAnimationFrame(frame); }

  function layout() {
    W = root.clientWidth; H = root.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    scale = W / 216;                       // l'orbite est dessinée pour une boîte de 216 px, et suit sa taille
    for (const cv of [cvBack, cvFront]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    render();
  }

  function still() {
    // Mouvements réduits : l'anneau entier, de face, immobile
    p = 1; traced = true;
    KEYS.forEach((k) => { x[k] = 0; v[k] = 0; t[k] = 0; });
    cancelAnimationFrame(raf); raf = 0;
    render();
  }

  // ---------- Branchements ----------
  colors();
  root.classList.add('is-live');
  layout();
  if (reduce.matches) still();
  else { scrollTargets(); x.yaw = t.yaw; x.tilt = t.tilt; render(); }

  new ResizeObserver(layout).observe(root);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !traced && e.intersectionRatio >= 0.6) {
      traced = true;
      if (reduce.matches) still(); else traceStart = performance.now();
    }
    wake();
  }, { threshold: [0, 0.6] }).observe(root);

  addEventListener('scroll', () => { if (reduce.matches) return; scrollTargets(); wake(); }, { passive: true });
  addEventListener('resize', () => { scrollTargets(); wake(); });
  // Un changement de densité d'écran (fenêtre déplacée, zoom) : on redimensionne les canevas
  matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', layout);
  // Le panneau de revue peut changer l'accent ou le papier : on relit les couleurs
  document.documentElement.addEventListener('topiary:theme', () => { colors(); render(); });

  footer.addEventListener('pointermove', (e) => {
    if (!fine.matches || reduce.matches) return;
    const r = footer.getBoundingClientRect();
    const u = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    const w = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    ptr.yaw = u * A.yawPtr; ptr.tilt = w * A.tiltPtr;
    scrollTargets(); wake();
  });
  footer.addEventListener('pointerleave', () => { ptr.yaw = 0; ptr.tilt = 0; scrollTargets(); wake(); });

  nets.forEach((n, i) => {
    const key = i === 0 ? 'h0' : 'h1';
    const on = () => { if (!reduce.matches) { t[key] = 1; wake(); } };
    const off = () => { t[key] = 0; wake(); };
    n.addEventListener('pointerenter', on); n.addEventListener('pointerleave', off);
    n.addEventListener('focus', on); n.addEventListener('blur', off);
  });

  reduce.addEventListener('change', () => { if (reduce.matches) still(); else { scrollTargets(); wake(); } });
})();
