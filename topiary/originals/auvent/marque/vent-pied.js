/* Auvent · le mot géant du pied de page prend le vent (script classique ; requiert mot-ciel-data.js et logo-ciel.js).
   Grammaire de la marque : « au » reste droit, « vent » ploie de plus en plus (pentes de repos 0 · 0 · 5 · 10 · 14 · 18°, rendu final du 2026-10-23),
   le pied est ancré sur la ligne de base (sous la coupe du pied de page), chaque lettre est un ressort amorti à ζ = 0,45.

   Références :
   - Ghost of Tsushima, GDC 2021 (Bill Rockenbeck, « Blowing from the West » ; Eric Wohllaib, « Procedural Grass ») : chaque
     brin répond seul à un champ de vent qui avance ; l'équipe a écarté la poussée par particules, qui « faisait faux » ;
   - les ressorts par caractère de x-kinetic-font (BareDOM) : un biais ne fait que pencher la lettre, ici on la plie ;
   - la toile d'un auvent : la tension la stabilise, son battement accélère avec le vent et s'éteint dès qu'il retombe.

   Le vent est un champ de rafales : chacune part d'une lettre, avance vers l'est avec un retard par lettre, monte plus
   vite qu'elle ne retombe (sin²(π·u^0,7)), et son intensité est tirée au sort (bruit borné, jamais un sinus visible).
   Trois directions, comparées dans essais/vent-pied.html :
   - « tiges » : des ressorts indépendants ;
   - « toile » : des ressorts couplés à leurs voisins, comme une toile tendue : la rafale passe en vague ;
   - « champ » : des tiges, plus une lumière qui court devant la rafale (le givre s'allume sur la lettre chargée).
   Retenue pour la landing : « champ » (voir workstreams/abri/NOTES.md, 2026-10-09). Un frisson fin à 4,2 Hz a été essayé
   puis retiré : il plafonnait à 0,11°, invisible.
   Déclencheurs : l'entrée à l'écran (deux ou trois rafales), la vitesse du pointeur au survol, la vitesse du défilement.
   Le mot revient au repos de lui-même en moins de 5 s (WCAG 2.2.2) ; mouvements réduits : posé à ses pentes de repos.
   Hors de l'écran, rien ne tourne ; à chaque image, aucune lecture de mise en page (positions mises en cache). */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const L = () => A.logo;

  // Hasard reproductible (même entrée, même film)
  function hasard(graine) { let s = graine >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  const DIRECTIONS = {
    // tiges : chaque lettre plie seule, la rafale l'atteint 70 ms après sa voisine
    tiges: { frequence: 1.15, couplage: 0, propre: 1, retard: 70, lumiere: 0.35, devant: 0 },
    // toile : une membrane tendue depuis « u » ; peu de raideur propre, beaucoup de tension entre lettres, la rafale la
    // charge presque d'un bloc et la flexion se propage d'elle-même du bord fixe vers le bord libre
    toile: { frequence: 1.0, couplage: 2.4, propre: 0.35, retard: 18, lumiere: 0.35, devant: 0 },
    // champ : des tiges, et une lumière qui court devant la rafale
    champ: { frequence: 1.15, couplage: 0, propre: 1, retard: 70, lumiere: 0.3, devant: 0.9 },
  };

  function monter(hote, o = {}) {
    const Lg = L(), PENTES = Lg.PENTES, n = PENTES.length;
    const dir = { ...DIRECTIONS[o.direction || 'tiges'], ...(o.reglages || {}) };
    const reduit = o.anime === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Canevas : le mot est redessiné à chaque image sans toucher au DOM (ni mise en page, ni recalcul de style ; la
    // version SVG en coûtait une par image). Même géométrie que le logotype ; un dégradé par lettre, dont le givre
    // s'allume selon la charge et la flexion de la lettre.
    const b = Lg.boite();
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = `display:block;width:100%;height:auto;aspect-ratio:${b.w} / ${b.h}`;
    hote.replaceChildren(cv);
    const ctx = cv.getContext('2d');
    let echelle = 0, boite = null;
    function taille() {
      const w = cv.clientWidth; if (!w) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round((w * b.h / b.w) * dpr);
      echelle = cv.width / b.w;
      const r = cv.getBoundingClientRect(); boite = { x: r.left, w: r.width };
      dessiner();
    }

    const souplesse = o.souplesse || [0, 0, 0.5, 0.7, 0.87, 1];
    const retard = o.retard || dir.retard;
    const tiges = new Lg.Tiges(n, { souplesse, frequence: dir.frequence, amortissement: 0.45, retard });
    // couplage (toile) : un terme de tension entre voisines, ajouté à l'intégration ; « u » (indice 1) est le bord fixe
    if (dir.couplage) {
      tiges.avancer = function (ms) {
        const h = 1000 / 240; this.reste += Math.min(ms, 100);
        while (this.reste >= h) {
          this.reste -= h; this.t += h;
          const dt = h / 1000, w2 = this.w * this.w, amort = 2 * this.z * this.w, k = dir.couplage * w2, kp = dir.propre * w2, th = this.th;
          for (let i = 2; i < this.n; i++) {
            const voisins = (th[i - 1] - th[i]) + (i + 1 < this.n ? th[i + 1] - th[i] : 0);
            const a = kp * (this.charge(i, this.t) - th[i]) - amort * this.v[i] + k * voisins;
            this.v[i] += a * dt;
          }
          for (let i = 2; i < this.n; i++) th[i] += this.v[i] * dt;
        }
        const fin = this.t;
        this.rafales = this.rafales.filter((r) => r.t0 + (this.n - r.de) * r.retard + r.duree > fin);
      };
    }
    let alea = hasard(o.graine || 11);

    function dessiner() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (!echelle) return;
      // unités du dessin (y vers le haut, ligne de base à 0) vers pixels du canevas
      ctx.setTransform(echelle, 0, 0, -echelle, -b.x * echelle, -b.y * echelle);
      const pentes = PENTES.map((p, i) => p + tiges.th[i]);
      Lg.poser(pentes).forEach((q, i) => {
        // la lumière : le givre monte sur la lettre qui ploie (θ) et, pour « champ », court devant la rafale (charge)
        const e = Math.max(0, Math.min(1, dir.lumiere * Math.max(0, tiges.th[i]) / 8 + dir.devant * tiges.charge(i, tiges.t) / 9));
        const gr = ctx.createLinearGradient(0, 690, 0, -40);
        gr.addColorStop(0, `rgba(242,245,250,${(0.92 + 0.08 * e).toFixed(3)})`);
        gr.addColorStop(0.55 + 0.17 * e, `rgba(188,205,232,${(0.42 + 0.4 * e).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(142,170,218,0)');
        ctx.save(); ctx.translate(q.x, 0); ctx.fillStyle = gr; ctx.fill(new Path2D(q.d)); ctx.restore();
      });
    }
    const avancer = (ms) => tiges.avancer(ms);
    const calme = () => tiges.calme();

    // ---------- Rafales ----------
    const intensite = (min, max) => min + (max - min) * (0.5 - 0.5 * Math.cos(Math.PI * alea()));   // bruit borné, centré
    function rafale(amp, de = 2, duree = 900) { tiges.souffler({ amp, duree, de, retard }); lancer(); }
    // À l'entrée : deux ou trois rafales d'intensités tirées au sort ; la dernière finit avant 3,3 s, le mot est au repos
    // avant 5 s (amortissement ζ = 0,45 : 99 % de l'écart résorbé en 1,3 s à 1,15 Hz).
    function entree(lancerApres = true) {
      const k = 2 + (alea() < 0.5 ? 1 : 0); let t = 80;
      for (let j = 0; j < k; j++) {
        const duree = 650 + 500 * alea();
        tiges.souffler({ amp: intensite(5, 11), duree, de: 2, retard, delai: t });
        t += duree * (0.55 + 0.35 * alea());
        if (t > 2200) break;
      }
      if (lancerApres) lancer();
    }

    // ---------- Boucle ----------
    let raf = 0, avant = 0, visible = true;
    function boucle(now) {
      avancer(avant ? now - avant : 16); avant = now; dessiner();
      if (calme()) { raf = 0; avant = 0; tiges.th.fill(0); tiges.v.fill(0); dessiner(); return; }
      raf = visible ? requestAnimationFrame(boucle) : 0;
    }
    function lancer() { if (reduit) return; if (!raf && visible) { avant = 0; raf = requestAnimationFrame(boucle); } }

    // ---------- Déclencheurs ----------
    let dernierPointeur = null, repitPointeur = 0, vu = false;
    // lettre sous une abscisse (positions de repos des lettres, en unités du dessin)
    const lettres = Lg.lettres();
    function lettreA(x) {
      if (!boite) return 2;
      const u = b.x + ((x - boite.x) / boite.w) * b.w;
      let k = 0; for (let i = 0; i < n; i++) if (u >= lettres[i].x) k = i;
      return Math.max(2, k);
    }
    new ResizeObserver(taille).observe(cv);
    if (!reduit && o.declencheurs !== false) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (!visible) { cancelAnimationFrame(raf); raf = 0; return; }
        if (!vu) { vu = true; entree(); } else if (!calme()) lancer();
      }, { threshold: 0.25 }).observe(hote);
      const zone = o.zone || hote;
      zone.addEventListener('pointermove', (e) => {
        const t = e.timeStamp;
        if (dernierPointeur) {
          const dt = t - dernierPointeur.t, v = dt > 0 ? Math.abs(e.clientX - dernierPointeur.x) / dt : 0;   // px/ms
          if (v > 0.35 && t > repitPointeur) {
            rafale(Math.min(9, 3 + v * 3.2), lettreA(e.clientX), 700); repitPointeur = t + 320;
          }
        }
        dernierPointeur = { x: e.clientX, t };
      }, { passive: true });
      zone.addEventListener('pointerleave', () => (dernierPointeur = null));
      let dernierY = scrollY, dernierT = performance.now(), repitDefile = 0;
      addEventListener('scroll', () => {
        const t = performance.now(), dy = Math.abs(scrollY - dernierY), dt = t - dernierT;
        dernierY = scrollY; dernierT = t;
        if (!visible || dt <= 0 || dt > 200) return;
        const v = dy / dt;                                                                 // px/ms
        if (v > 0.8 && t > repitDefile) { rafale(Math.min(8, 2 + v * 2), 2, 800); repitDefile = t + 420; }
      }, { passive: true });
    }
    return {
      canevas: cv, rafale, entree,
      // Revue image par image : rejoue l'entrée depuis le repos et pose l'instant ms (simulation déterministe)
      figer(ms, graine = o.graine || 11) {
        cancelAnimationFrame(raf); raf = 0;
        tiges.th.fill(0); tiges.v.fill(0); tiges.rafales = []; tiges.t = 0; tiges.reste = 0;
        alea = hasard(graine); entree(false);
        for (let t = 0; t < ms; t += 1000 / 120) avancer(Math.min(1000 / 120, ms - t));
        dessiner();
        return { pentes: PENTES.map((p, i) => p + tiges.th[i]), calme: calme() };
      },
    };
  }

  A.ventPied = { monter, DIRECTIONS };
})();
