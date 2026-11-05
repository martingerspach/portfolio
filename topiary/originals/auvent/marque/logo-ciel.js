/* Auvent · le logotype « au vent », redessiné pour la DA v0.3 « Ciel » (2026-10-09).
   Même idée que la v3 (marque/vent.js, archivée avec la v2) : le mot se plie lui-même. « au » reste droit ; « vent »
   ploie de plus en plus, lettre après lettre, comme des tiges sous une rafale. Pied ancré, haut qui fléchit
   (x' = x + k·H·(y/H)^1,8, H = hauteur d'x) : une flexion, pas un faux italique. Pentes 0 · 0 · 3 · 7 · 12 · 17°
   (la v3 allait jusqu'à 19,5° en Archivo grasse ; dans une grotesque plus fine, 17° suffit et reste lisible).
   Dessin : Hanken Grotesk wght 500 (Hanken Design Co., OFL), contours extraits par fontTools (marque/mot-ciel-data.js).
   Mouvement : une rafale traverse le mot ; chaque lettre est un ressort amorti (ζ = 0,45), la rafale l'atteint 55 ms
   après sa voisine (classe Tiges, partagée avec le pied de page).
   Mouvements réduits : le mot est posé d'emblée. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const NS = 'http://www.w3.org/2000/svg';
  const P = 1.8, APP = -26, COMP = 0.8;
  // Rendu final (2026-10-23) : pentes 0 · 0 · 5 · 10 · 14 · 18 (v20 : 0 · 0 · 3 · 7 · 12 · 17). À 26 px, le 3° du « v » et le
  // 7° du « e » ne se voyaient pas : on lisait « auve » droit puis « nt » en italique, comme une faute de police. La
  // progression se lit maintenant dès 20 px, et reste juste en très grand (banc : essais/logo-final.html).
  const PENTES = [0, 0, 5, 10, 14, 18];
  const H = () => A.motData.xHeight;

  function parse(d) {
    const t = d.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/g), out = []; let i = 0, c;
    while (i < t.length) { if (/[MLQZ]/.test(t[i])) c = t[i++]; const n = { M: 2, L: 2, Q: 4, Z: 0 }[c]; out.push([c, t.slice(i, i + n).map(Number)]); i += n; }
    return out;
  }
  let LETTRES = null;
  function lettres() {
    if (LETTRES) return LETTRES;
    const M = A.motData; let x = 0;
    LETTRES = M.lettres.map((g, i) => { const l = { ch: g.ch, x, adv: g.adv, cmds: parse(g.d) }; x += g.adv + (i < M.lettres.length - 1 ? APP : 0); return l; });
    LETTRES.largeur = x; return LETTRES;
  }
  // Déformation d'un contour ; chaque courbe est subdivisée en 4 (écart sous le dixième d'unité à ces flexions).
  function plier(cmds, k) {
    const h = H(), r = (v) => v.toFixed(1);
    if (Math.abs(k) < 1e-6) return cmds.map(([c, v]) => c + v.map((n) => +n.toFixed(1)).join(' ')).join('');
    const f = (x, y) => [x + k * h * Math.sign(y) * Math.pow(Math.abs(y) / h, P), y];
    let d = '', cx = 0, cy = 0;
    for (const [c, v] of cmds) {
      if (c === 'M' || c === 'L') { const [a, b] = f(v[0], v[1]); d += c + r(a) + ' ' + r(b); cx = v[0]; cy = v[1]; }
      else if (c === 'Q') {
        const [qx, qy, x, y] = v, N = 4, B = (t) => [(1 - t) ** 2 * cx + 2 * (1 - t) * t * qx + t * t * x, (1 - t) ** 2 * cy + 2 * (1 - t) * t * qy + t * t * y];
        for (let j = 1; j <= N; j++) {
          const t0 = (j - 1) / N, t1 = j / N, F0 = f(...B(t0)), F1 = f(...B(t1)), Fm = f(...B((t0 + t1) / 2));
          d += `Q${r(2 * Fm[0] - (F0[0] + F1[0]) / 2)} ${r(2 * Fm[1] - (F0[1] + F1[1]) / 2)} ${r(F1[0])} ${r(F1[1])}`;
        }
        cx = x; cy = y;
      } else d += 'Z';
    }
    return d;
  }
  // Pentes (degrés) -> chemins et décalages (compensation optique des blancs à 60 % de la hauteur d'x)
  function poser(pentes) {
    const L = lettres(), h = H(); let dx = 0, kPrev = 0;
    const depl = (k) => k * h * Math.pow(0.6, P);
    return L.map((l, i) => {
      const k = Math.tan((pentes[i] * Math.PI) / 180);
      dx -= (depl(k) - depl(kPrev)) * COMP; kPrev = k;
      return { x: l.x + dx, d: plier(l.cmds, k) };
    });
  }
  // Boîte : du pied (−12, l'empattement optique des ronds) au haut du t (674) ; largeur jusqu'au haut du t plié.
  function boite(pentes = PENTES) {
    const p = poser(pentes), L = lettres(), t = L[L.length - 1];
    const k = Math.tan((pentes[pentes.length - 1] * Math.PI) / 180);
    const haut = 690, droite = p[p.length - 1].x + 330 + k * H() * Math.pow(haut / H(), P);
    return { x: 30, y: -haut, w: Math.ceil(droite - 30 + 8), h: haut + 14 };
  }
  const vb = (b) => `${b.x} ${b.y} ${b.w} ${b.h}`;

  function logotype(o = {}) {
    const { couleur = 'currentColor', titre = 'Auvent', attrs = '', pentes = PENTES, defs = '' } = o;
    const p = poser(pentes), b = boite();
    return `<svg viewBox="${vb(b)}" ${attrs} role="img" aria-label="${titre}">${defs}<g transform="scale(1 -1)" fill="${couleur}">` +
      p.map((q) => `<path transform="translate(${q.x.toFixed(1)} 0)" d="${q.d}"/>`).join('') + '</g></svg>';
  }
  // Monogramme : le a dont le haut ploie à 18° (la pente du t), sur le bleu signal (favicon, icône d'application,
  // notifications). Rendu final : le a est centré sur sa boîte et occupe `part` du carré (64 %) ; la v20 le posait à un
  // décalage fixe et il n'en occupait que la moitié, illisible à 16 px. `rayon` arrondit le carré (favicon), 0 pour
  // l'icône d'écran d'accueil (iOS l'arrondit lui-même).
  function monogramme(o = {}) {
    const { fond = '#136BFF', encre = '#FFFFFF', titre = 'Auvent', attrs = '', rayon = 0, part = 0.64 } = o;
    const a = lettres()[0], d = plier(a.cmds, Math.tan((18 * Math.PI) / 180));
    // boîte du a plié, lue sur les extrémités et les points de contrôle (un excès de moins d'une unité)
    const n = d.match(/-?\d*\.?\d+/g).map(Number);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    const s = (1000 * part) / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const g = `<g transform="translate(500 500) scale(${s.toFixed(4)} ${(-s).toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})"><path d="${d}" fill="${encre}"/></g>`;
    return `<svg viewBox="0 0 1000 1000" ${attrs} role="img" aria-label="${titre}"><rect width="1000" height="1000" rx="${rayon}" fill="${fond}"/>${g}</svg>`;
  }

  // ---------- Mouvement : un ressort par lettre ----------
  // Chaque lettre est une tige. Sa pente suit θ'' = ω²(F − θ) − 2ζωθ', ζ = 0,45, intégrée à pas fixe (1/240 s) : θ est
  // l'écart à la pente de repos, en degrés ; F, la charge du vent sur la lettre, est la somme des rafales qui la
  // traversent. Une rafale est un créneau doux, sin²(π·u^forme) (montée plus raide que la retombée, dérivée nulle aux
  // deux bouts), qui part d'une lettre et avance vers la droite avec un retard par lettre. Une rafale s'ajoute à l'état
  // courant (position et vitesse) : relancée en plein vol, rien ne saute (la v10 repartait du repos, défaut P1-8).
  class Tiges {
    constructor(n, o = {}) {
      this.n = n; this.th = new Float64Array(n); this.v = new Float64Array(n);
      this.c = o.souplesse || Array.from({ length: n }, (_, i) => i / Math.max(1, n - 1));
      this.w = 2 * Math.PI * (o.frequence || 2); this.z = o.amortissement || 0.45;
      this.retard = o.retard || 55; this.rafales = []; this.t = 0; this.reste = 0;
    }
    souffler(r) {
      this.rafales.push({ t0: this.t + (r.delai || 0), amp: r.amp, duree: r.duree || 600, retard: r.retard ?? this.retard, de: r.de || 0, forme: r.forme || 0.7 });
    }
    charge(i, t) {
      let F = 0;
      for (const r of this.rafales) {
        if (i < r.de) continue;
        const u = (t - r.t0 - (i - r.de) * r.retard) / r.duree;
        if (u > 0 && u < 1) F += r.amp * Math.sin(Math.PI * Math.pow(u, r.forme)) ** 2;
      }
      return F * this.c[i];
    }
    avancer(ms) {
      const h = 1000 / 240;
      this.reste += Math.min(ms, 100);
      while (this.reste >= h) {
        this.reste -= h; this.t += h;
        const dt = h / 1000, w2 = this.w * this.w, amort = 2 * this.z * this.w;
        for (let i = 0; i < this.n; i++) {
          const a = w2 * (this.charge(i, this.t) - this.th[i]) - amort * this.v[i];
          this.v[i] += a * dt; this.th[i] += this.v[i] * dt;          // Euler semi-implicite : stable, sans gain d'énergie
        }
      }
      const fin = this.t;
      this.rafales = this.rafales.filter((r) => r.t0 + (this.n - r.de) * r.retard + r.duree > fin);
    }
    calme() {
      if (this.rafales.length) return false;
      for (let i = 0; i < this.n; i++) if (Math.abs(this.th[i]) > 0.01 || Math.abs(this.v[i]) > 0.05) return false;
      return true;
    }
  }

  // En-tête : la rafale d'ouverture part du mot droit (θ = −pente de repos), le survol ajoute un souffle à l'état courant.
  const SOUPLESSE = [0, 0, 0.55, 0.75, 0.9, 1];
  function monter(el, o = {}) {
    const reduit = o.anime === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const svg = document.createElementNS(NS, 'svg'), b = boite();
    svg.setAttribute('viewBox', vb(b)); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', o.titre || 'Auvent');
    if (o.defs) svg.innerHTML = o.defs;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', 'scale(1 -1)'); svg.appendChild(g);
    const paths = lettres().map(() => { const p = document.createElementNS(NS, 'path'); g.appendChild(p); return p; });
    el.replaceChildren(svg);
    const dessiner = (pentes) => poser(pentes).forEach((q, i) => { paths[i].setAttribute('transform', `translate(${q.x.toFixed(1)} 0)`); paths[i].setAttribute('d', q.d); });
    let tiges = null, raf = 0, avant = 0;
    const pentes = () => PENTES.map((p, i) => p + tiges.th[i]);
    function nouvelles() { tiges = new Tiges(PENTES.length, { souplesse: SOUPLESSE, frequence: 2.2, amortissement: 0.45, retard: 55 }); }
    function ouverture() { nouvelles(); PENTES.forEach((p, i) => (tiges.th[i] = -p)); tiges.souffler({ amp: 9, duree: 520, delai: 40, de: 2 }); }
    function boucle(now) {
      tiges.avancer(avant ? now - avant : 16); avant = now; dessiner(pentes());
      if (tiges.calme()) { raf = 0; avant = 0; dessiner(PENTES); return; }
      raf = requestAnimationFrame(boucle);
    }
    const lancer = () => { if (!raf) { avant = 0; raf = requestAnimationFrame(boucle); } };
    const ctl = {
      svg,
      rafale() { cancelAnimationFrame(raf); raf = 0; if (reduit) { dessiner(PENTES); return; } ouverture(); lancer(); },
      souffle() { if (reduit) return; if (!tiges) nouvelles(); tiges.souffler({ amp: 5, duree: 420, de: 2 }); lancer(); },
      figer(ms) { cancelAnimationFrame(raf); raf = 0; ouverture(); tiges.avancer(0); for (let t = 0; t < ms; t += 50) tiges.avancer(Math.min(50, ms - t)); dessiner(pentes()); },
    };
    if (o.fige !== undefined) ctl.figer(o.fige); else if (reduit || o.rafale === false) dessiner(PENTES); else ctl.rafale();
    return ctl;
  }

  A.logo = { PENTES, SOUPLESSE, logotype, monogramme, monter, poser, boite, lettres, plier, Tiges };
})();
