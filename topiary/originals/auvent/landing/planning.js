/* Auvent · landing · le planning en quatre temps (script classique, expose window.Auvent.planning ; requiert scenario.js).
   0 · samedi soir : la prévision à trois jours (faisceau large, front en tirets) ;
   1 · mardi 6 h : la pluie est confirmée (faisceau serré, front plein, quatre tâches bloquées) ;
   2 · mardi 6 h 01 : chaque tâche bloquée passe au premier jour possible, un travail à l'intérieur prend sa place ;
   3 · mardi 6 h 02 : envoyé ; les accusés de lecture arrivent au rythme de leurs heures.

   Grammaire du mouvement (v13). Trois durées, celles des tokens (--av-duration-court 160 ms, -moyen 320 ms, -long 640 ms),
   une seule courbe (--av-ease-standard, cubic-bezier(.2, 0, 0, 1) : départ franc, longue arrivée, aucun dépassement), un pas
   de 80 ms entre les lignes, dans l'ordre où le front atteint les chantiers.
     long  : ce qui voyage (une barre d'un jour à l'autre, les bords du faisceau) et la couleur d'une barre qui change
             d'état (du blanc à l'encre en 320 ms, le changement paraissait sec : le détecteur de sauts le relevait) ;
     moyen : le reste de ce qui change d'état (texte entrant, trait du front, accusés, noms qui remontent) ;
     court : ce qui s'efface (texte sortant, accusés au retour), et le pas entre deux lignes vaut un demi-court.
   Une barre voyage avec l'état qu'elle quitte et prend le nouveau en arrivant (à mi-trajet en temps, 88 % du chemin).
   Ni soulèvement, ni échelle, ni ombre, ni ressort : la v12 mêlait six natures d'effets et cinq durées (1 000 ms de ressort à
   2 % de dépassement, tracé de 1 500 ms, faisceau sur ressort, 300 à 500 ms ailleurs).

   Chorégraphie. En avançant : la prévision se confirme (le faisceau se resserre), puis le planning change (les barres
   s'échangent, ligne après ligne), puis l'envoi (les accusés). En reculant : l'ordre inverse. Les couches s'enchaînent sur
   leurs horaires réels : la suivante part quand la précédente a fait l'essentiel de son chemin.
   Une étape changée en plein mouvement ne repasse pas par les étapes intermédiaires et ne relance rien de ce qui va déjà au
   bon endroit : chaque élément repart de sa valeur affichée vers la nouvelle cible (FLIP mesuré pour les barres, transitions
   CSS qui repartent de la valeur courante, fondus qui reprennent l'opacité affichée). Rien ne s'empile (WWDC 2018,
   « Designing Fluid Interfaces » : des mouvements interruptibles et réorientables).
   Pendant un passage, seuls transform et opacity bougent (barres, bords du faisceau, trait plein, accusés, textes) ; les
   barres qui changent d'état repeignent leurs couleurs. Mesuré (Performance.getMetrics) : une mise en page au changement
   d'étape (toutes les lectures avant toutes les écritures, aucun getAnimations() qui recalculerait le style dans une
   barre, conteneur de requêtes @container), aucune pendant le passage, une au ménage final (copies de texte effacées).

   Le front froid est une courbe de Catmull-Rom centripète passant, sur chaque ligne, par l'heure où il atteint le chantier
   (modèle lib/carte.js) ; ses dents sont posées à abscisse curviligne constante, tournées vers l'est. Le faisceau couvre les
   heures de passage ± f : chacun de ses bords est la courbe translatée de f heures. Il se resserre donc par une simple
   translation de chaque moitié, découpée par le trait (clip-path) : aucun tracé recalculé à chaque image. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const S = A.scenario, V = A.ville;
  const NB = ' ';
  const H0 = 7, H1 = 17;                       // axe d'une journée dans sa colonne : 7 h à 17 h
  const revue = new URLSearchParams(location.search);
  const reduit = () => revue.has('rm') || revue.has('fige') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  // durées lues dans les tokens, unités comprises (un minifieur écrit « .16s ») ; nulles en mouvements réduits, où rien ne bouge
  const duree = (nom, d) => { const v = css.getPropertyValue(nom).trim(), n = parseFloat(v); return !(n > 0) ? d : /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n; };
  const D = { court: duree('--av-duration-court', 160), moyen: duree('--av-duration-moyen', 320), long: duree('--av-duration-long', 640) };
  const PAS = D.court / 2;                      // décalage d'une ligne à la suivante
  const MINUTE = 70;                            // une minute de lecture des accusés = 70 ms à l'écran
  const COURBE = css.getPropertyValue('--av-ease-standard').trim() || 'cubic-bezier(.2, 0, 0, 1)';
  const hh = (h) => { const m = Math.round((h % 1) * 60); return Math.floor(h) + NB + 'h' + (m ? NB + String(m).padStart(2, '0') : ''); };

  // Chantiers dans l'ordre où le front les atteint
  const SITES = S.CHANTIERS.map((c) => ({ ...c, passage: V.passage(c.xy) })).sort((a, b) => a.passage - b.passage);
  const LIGNE = new Map(SITES.map((s, i) => [s.id, i]));
  const JOURS = [['mar.', '13'], ['mer.', '14'], ['jeu.', '15'], ['ven.', '16']];
  const ETAPES = [
    { avance: 72, emis: 'Météo de samedi soir', faisceau: 3.2, tirets: true },
    { avance: 0, emis: 'Météo de mardi, 6' + NB + 'h', faisceau: 0.8, tirets: false },
    { avance: 0, emis: 'Planning proposé', faisceau: 0.8, tirets: false, repli: true },
    { avance: 0, emis: 'Envoyé à 6' + NB + 'h' + NB + '02', faisceau: 0.8, tirets: false, repli: true, envoi: true },
  ];
  // accusés de lecture, dans l'ordre des lignes : l'heure affichée et les minutes après l'envoi de 6 h 02
  const VUS = [[3, 1], [4, 2], [4, 2], [7, 5], [11, 9]];

  // Fondu enchaîné d'un texte. L'élément garde son id, son rôle et reçoit tout de suite le texte final (lecteurs d'écran) ;
  // une copie sortante (aria-hidden), sœur dans la même case de grille (.fondu), s'efface par-dessus. Un nouveau changement
  // en plein fondu reprend chaque copie à l'opacité affichée. Les lectures (lireFondu) se font avant toute écriture du
  // passage : dans une barre (conteneur de requêtes @container), lire un style après une écriture force une mise en page.
  // les animations de fondu sont tenues ici : getAnimations() recalcule le style, donc la mise en page dans une barre
  const fondus = new WeakMap();
  const miens = (x) => { const l = fondus.get(x) || []; fondus.delete(x); return l; };
  const animer = (x, kf, o) => { const a = x.animate(kf, o); fondus.set(x, [...(fondus.get(x) || []), a]); return a; };
  function lireFondu(el) {
    const cs = getComputedStyle(el);
    return { o: el.innerHTML ? +cs.opacity : 0, couleur: cs.color,
      copies: [...el.parentNode.children].filter((c) => c !== el && c.classList.contains('sortant') && !('fini' in c.dataset)).map((c) => [c, +getComputedStyle(c).opacity]) };
  }
  function fondre(el, html, delai, anime, lu) {
    if (!el || el.dataset.vise === html) return;
    if (anime && !lu) lu = lireFondu(el);
    el.dataset.vise = html;
    const cadre = el.parentNode;
    cadre.querySelectorAll(':scope > .sortant[data-fini]').forEach((c) => c.remove());
    if (!anime) { cadre.querySelectorAll(':scope > .sortant').forEach((c) => c.remove()); miens(el).forEach((a) => a.cancel()); el.innerHTML = html; return; }
    for (const [c, o] of lu.copies) { miens(c).forEach((a) => { a.onfinish = null; a.cancel(); }); sortir(c, o, delai); }
    miens(el).forEach((a) => a.cancel());
    if (lu.o > 0.02) {
      const c = el.cloneNode(true);
      c.removeAttribute('id'); c.removeAttribute('aria-live'); c.removeAttribute('data-vise');
      c.setAttribute('aria-hidden', 'true'); c.classList.add('sortant');
      c.style.color = lu.couleur;                   // la copie garde la couleur affichée (l'état change sous elle)
      cadre.appendChild(c); sortir(c, lu.o, delai);
    }
    el.innerHTML = html;
    // le texte entrant attend que le sortant soit presque effacé (un demi-court) : les deux ne se superposent pas
    // fill both : une animation qui s'achève coûte une mise en page ; elle reste en vigueur (à 1) jusqu'au ménage
    animer(el, [{ opacity: 0 }, { opacity: 1 }], { id: 'fondu', duration: D.moyen, delay: delai + D.court / 2, easing: COURBE, fill: 'both' });
  }
  // La copie effacée reste en place, invisible : la retirer aussitôt coûterait une mise en page pendant le passage (une
  // par barre, toutes les 80 ms). Le ménage se fait en une fois, à la fin du passage ou au changement suivant.
  function sortir(c, o, delai) {
    const a = animer(c, [{ opacity: o }, { opacity: 0 }], { id: 'fondu', duration: D.court, delay: delai, easing: COURBE, fill: 'both' });
    a.onfinish = () => { c.dataset.fini = ''; };
  }
  // (de même, une barre arrivée garde son z-index de trajet jusqu'au ménage)
  function menage(racine) {
    racine.querySelectorAll('.sortant[data-fini]').forEach((c) => c.remove());
    racine.getAnimations({ subtree: true }).forEach((a) => { if (a.id === 'fondu' && a.playState === 'finished') a.cancel(); });
    racine.querySelectorAll('.barre').forEach((b) => { if (!b.getAnimations().some((a) => a.id === 'trajet' && a.playState === 'running')) b.style.zIndex = ''; });
    racine.querySelectorAll('.fondu > *').forEach((x) => { const l = (fondus.get(x) || []).filter((an) => an.playState !== 'idle'); if (l.length) fondus.set(x, l); else fondus.delete(x); });
  }
  const texteSeul = (html) => { const t = document.createElement('span'); t.innerHTML = html; return t.textContent; };
  // Étiquettes de la fenêtre (source de la météo, ligne d'état). Les quatre textes sont posés une fois, superposés dans la
  // même case (.fondu) : la case garde sa taille d'une étape à l'autre, et un passage les enchaîne couche après couche
  // (au saut de samedi à l'envoi, la fenêtre dit « mardi », puis « proposé », puis « envoyé »), par l'opacité seule, sans
  // mise en page. Une étape changée en plein fondu repart des opacités affichées.
  function etiquettes(el, textes) {
    if (!el) return () => {};
    el.innerHTML = textes.map((t) => `<span class="etiquette">${t}</span>`).join('');
    const spans = [...el.children];
    let anims = [];
    return function montrer(suite, anime) {          // suite : [[délai (ms), étape], …], dans l'ordre du temps
      const finale = suite[suite.length - 1][1];
      const vis = anime ? spans.map((x) => +getComputedStyle(x).opacity) : null;
      anims.forEach((a) => a.cancel()); anims = [];
      spans.forEach((x, i) => { x.style.opacity = anime ? vis[i] : (i === finale ? 1 : 0); if (i === finale) x.removeAttribute('aria-hidden'); else x.setAttribute('aria-hidden', 'true'); });
      if (!anime) return;
      const fondu = (x, de, a, delai, duree) => anims.push(x.animate([{ opacity: de }, { opacity: a }], { duration: duree, delay: delai, easing: COURBE, fill: 'forwards' }));
      for (const [delai, e] of suite.slice().sort((a, b) => a[0] - b[0])) {
        spans.forEach((x, i) => {
          if (i === e) { if (vis[i] < 0.99) fondu(x, vis[i], 1, delai + D.court / 2, D.moyen); vis[i] = 1; }
          else if (vis[i] > 0.01) { fondu(x, vis[i], 0, delai, D.court); vis[i] = 0; }
        });
      }
    };
  }

  // Noms courts des barres étroites (1 100 à 1 399 px, et au téléphone) : ce qu'un chef de chantier écrirait sur son
  // planning mural. La v20 affichait le type (« Nacelle », « Intérieur ») : un engin n'est pas une tâche, et trois
  // « Intérieur » se lisaient comme des doublons.
  const COURT = {
    'Montage de la charpente': 'Charpente', 'Bardage façade nord': 'Bardage nord', 'Ferraillage des longrines': 'Ferraillage',
    'Bardage façade sud': 'Bardage sud', 'Levage des prédalles R+1': 'Prédalles', 'Coulage de la dalle R+1': 'Coulage',
    'Cloisons du RDC': 'Cloisons', 'Ferraillage des voiles R+2': 'Ferraillage', 'Terrassement VRD': 'VRD',
    'Enduit façade ouest': 'Enduit', 'Plomberie intérieure': 'Plomberie', 'Peinture intérieure': 'Peinture',
    'Dépose du zinc, aile B': 'Dépose zinc', 'Pose du zinc, aile B': 'Pose zinc', 'Menuiseries intérieures': 'Menuiseries',
    'Étanchéité toiture-terrasse': 'Étanchéité', 'Fouilles des semelles': 'Fouilles', 'Coulage des semelles': 'Coulage',
    'Coulage des longrines': 'Coulage',
  };
  function monter(hote, etat) {
    const grille = document.createElement('div');
    grille.className = 'pg';
    let html = `<div class="pg-coin">Chantier</div>` + JOURS.map(([j, d], i) => `<div class="pg-jour"><b>${j} ${d}</b>${i === 1 ? '<span class="pg-jour-suf">, pluie et vent</span>' : ''}</div>`).join('');
    SITES.forEach((s, i) => {
      html += `<div class="pg-site" data-site="${s.id}"><b>${s.nom}</b><span>${s.ville}</span><span class="vu">Vu à 6${NB}h${NB}${String(VUS[i][0]).padStart(2, '0')}</span></div>`;
      for (let j = 0; j < 4; j++) html += `<div class="pg-case" data-site="${s.id}" data-jour="${j}"></div>`;
    });
    grille.innerHTML = html;
    hote.replaceChildren(grille);
    const sites = [...grille.querySelectorAll('.pg-site')];
    function caseDe(site, jour) { return grille.querySelector(`.pg-case[data-site="${site}"][data-jour="${jour}"]`); }

    // ---------- Le front : cinq calques (deux moitiés de faisceau, graduation, trait en tirets, trait plein) ----------
    const front = document.createElement('div');
    front.className = 'pg-front'; front.setAttribute('aria-hidden', 'true');
    front.innerHTML = '<div class="pf-moitie pf-moitie--g"><svg class="pf-bande pf-bande--g"><path class="pf-fond"/><path class="pf-bord"/></svg></div>'
      + '<div class="pf-moitie pf-moitie--d"><svg class="pf-bande pf-bande--d"><path class="pf-fond"/><path class="pf-bord"/></svg></div>'
      + '<svg class="pf-heures"><path/></svg>'
      + '<svg class="pf-trait pf-trait--tirets"><path class="pf-ligne"/><g class="pf-dents"></g></svg>'
      + '<svg class="pf-trait pf-trait--plein"><path class="pf-ligne"/><g class="pf-dents"></g></svg>';
    grille.appendChild(front);
    const $f = (s) => front.querySelector(s);

    // Barres : une par tâche, enfant de la case de son jour d'origine ; un déplacement change seulement sa position (left),
    // jamais son parent : un élément réinséré perdrait ses transitions CSS en cours (une couleur qui saute au retour)
    const barres = new Map();
    for (const t of S.TACHES) {
      const b = document.createElement('div');
      b.className = 'barre';
      b.dataset.tache = t.id;
      // le dernier mot court reste attaché au précédent (« aile B » ne se coupe plus)
      const nom = t.nom.replace(/ (\S{1,2})$/, NB + '$1');
      b.innerHTML = `<span class="barre-nom"><span class="barre-nom-long">${nom}</span><span class="barre-nom-court" aria-hidden="true">${COURT[t.nom] || S.TYPES[t.type].nom}</span></span><span class="fondu"><span class="barre-etat"></span></span>`;
      b.title = t.nom;
      barres.set(t.id, { el: b, etat: b.querySelector('.barre-etat'), t, jour: t.jour });
      b.style.width = `calc(${((t.fin - t.debut) / (H1 - H0)) * 100}% - 2px)`;
      caseDe(t.chantier, t.jour).appendChild(b);
      placer(barres.get(t.id));
    }
    // les cases d'une ligne sont jointives et de même largeur : k jours plus loin = k × (largeur de la case + son filet)
    function placer(o) {
      const x = ((o.t.debut - H0) / (H1 - H0)) * 100, k = o.jour - o.t.jour;
      o.el.style.left = k ? `calc(${x}% + ${k} * (100% + 1px))` : x + '%';
    }

    let geo = null;
    function mesurer() {
      const R = grille.getBoundingClientRect();
      if (!R.width) { geo = null; return; }
      const lignes = SITES.map((s) => {
        const c = caseDe(s.id, 1).getBoundingClientRect();
        const xh = (h) => c.left - R.left + ((h - H0) / (H1 - H0)) * c.width;
        return { y: c.top - R.top + c.height / 2, xh, h: s.passage - 24 + 6 };
      });
      const m = caseDe(SITES[0].id, 1).getBoundingClientRect();
      geo = { w: R.width, h: R.height, lignes, haut: m.top - R.top, merG: m.left - R.left, merL: m.width };
    }
    // Courbe de Catmull-Rom centripète (α = 0,5) -> Bézier cubiques ; points prolongés au-delà de la première et de la dernière ligne
    function courbe(pts) {
      const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])];
      let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
      for (let i = 1; i < P.length - 2; i++) {
        const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
        const t = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
        const t01 = t(p0, p1), t12 = t(p1, p2), t23 = t(p2, p3);
        const m1 = [0, 1].map((k) => (p2[k] - p1[k] + t12 * ((p1[k] - p0[k]) / t01 - (p2[k] - p0[k]) / (t01 + t12))));
        const m2 = [0, 1].map((k) => (p2[k] - p1[k] + t12 * ((p3[k] - p2[k]) / t23 - (p3[k] - p1[k]) / (t12 + t23))));
        const c1 = [p1[0] + m1[0] / 3, p1[1] + m1[1] / 3], c2 = [p2[0] - m2[0] / 3, p2[1] - m2[1] / 3];
        d += `C${c1.map((v) => v.toFixed(2)).join(' ')} ${c2.map((v) => v.toFixed(2)).join(' ')} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
      }
      return d;
    }
    function pointsFront(decal = 0) {
      const L = geo.lignes;
      const pts = L.map((l) => [l.xh(l.h + decal), l.y]);
      // prolongement jusqu'au bord haut des cases et au bas de la grille, dans la direction des deux premières/dernières lignes
      const a = pts[0], b = pts[1], z = pts[pts.length - 1], y = pts[pts.length - 2];
      const debut = [a[0] - ((b[0] - a[0]) * (a[1] - geo.haut)) / (b[1] - a[1]), geo.haut];
      const fin = [z[0] + ((z[0] - y[0]) * (geo.h - z[1])) / (z[1] - y[1]), geo.h];
      return [debut, ...pts, fin];
    }
    // Géométrie du front, sans animation (au montage et quand la grille change de taille)
    function dessiner() {
      if (!geo) return;
      const { w, h } = geo;
      for (const s of front.querySelectorAll('svg')) { s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('width', w); s.setAttribute('height', h); }
      // graduation horaire de mercredi (7 h à 17 h) au bord haut de la grille : on lit l'heure du passage du front
      let gr = '';
      for (let x = H0; x <= H1; x++) { const px = (Math.round(geo.merG + ((x - H0) / (H1 - H0)) * geo.merL) + 0.5).toFixed(1); gr += `M${px} ${geo.haut}v${x % 2 ? -4 : -7}`; }
      $f('.pf-heures path').setAttribute('d', gr);
      const z = pointsFront(0), ligne = courbe(z);
      front.querySelectorAll('.pf-ligne').forEach((p) => p.setAttribute('d', ligne));
      // faisceau : moitié gauche entre la courbe à −F et le trait, moitié droite entre le trait et la courbe à +F (F = samedi) ;
      // chaque moitié est découpée par le trait, et la translation de (F − f) heures vers lui la resserre à ± f
      const F = ETAPES[0].faisceau, f = ETAPES[1].faisceau;
      const g = pointsFront(-F), dr = pointsFront(F);
      const retour = (pts) => courbe(pts.slice().reverse()).replace(/^M/, 'L');
      const bout = (p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
      $f('.pf-bande--g .pf-fond').setAttribute('d', courbe(g) + bout(z[z.length - 1]) + retour(z) + 'Z');
      $f('.pf-bande--g .pf-bord').setAttribute('d', courbe(g));
      $f('.pf-bande--d .pf-fond').setAttribute('d', courbe(z) + bout(dr[dr.length - 1]) + retour(dr) + 'Z');
      $f('.pf-bande--d .pf-bord').setAttribute('d', courbe(dr));
      const corps = ligne.replace(/^M/, 'L'), loin = 99999;
      $f('.pf-moitie--g').style.clipPath = `path('M${-loin} ${geo.haut.toFixed(2)}${corps}L${-loin} ${h.toFixed(2)}Z')`;
      $f('.pf-moitie--d').style.clipPath = `path('M${loin} ${geo.haut.toFixed(2)}${corps}L${loin} ${h.toFixed(2)}Z')`;
      grille.style.setProperty('--decal', ((F - f) * geo.merL / (H1 - H0)).toFixed(2) + 'px');
      // dents (triangles du front froid), espacées de 34 px le long de la courbe, tournées vers l'est
      const tr = $f('.pf-trait--plein .pf-ligne');
      const L = tr.getTotalLength(), pas = 34, base = 9, haut = 7.5;
      let dents = '';
      for (let s = 18; s < L - 10; s += pas) {
        const p = tr.getPointAtLength(s), q = tr.getPointAtLength(Math.min(L, s + 0.5));
        let tx = q.x - p.x, ty = q.y - p.y; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
        const nx = ty, ny = -tx;                  // normale tournée vers l'est (x croissants quand le trait descend)
        const a = tr.getPointAtLength(Math.max(0, s - base / 2)), b2 = tr.getPointAtLength(Math.min(L, s + base / 2));
        dents += `<path d="M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${(p.x + nx * haut).toFixed(2)} ${(p.y + ny * haut).toFixed(2)}L${b2.x.toFixed(2)} ${b2.y.toFixed(2)}Z"/>`;
      }
      front.querySelectorAll('.pf-dents').forEach((g2) => { g2.innerHTML = dents; });
    }
    // Pose sans transition (montage, redimensionnement, mouvements réduits) : les transitions CSS ne partent pas
    function sansTransition(f) {
      grille.classList.add('pg--fixe');
      f();
      void getComputedStyle($f('.pf-trait--plein')).opacity;   // calcul du style avant de rendre les transitions
      grille.classList.remove('pg--fixe');
    }

    // ---------- États des barres ----------
    const ROLES = { bloquee: 'barre--bloquee', surveiller: 'barre--surveiller', abri: 'barre--abri', prevue: '', deplacee: 'barre--deplacee' };
    // État d'une barre : un préfixe (masqué dans les barres étroites) et l'essentiel ; le texte entier va dans le titre.
    // Dans une barre étroite, on garde l'essentiel : « Bloquée » (la cause est masquée), l'heure d'un déplacement,
    // « À suivre » pour une tâche incertaine (sans pourcentage : la page ne montre pas de probabilités).
    const pre = (p, c) => `<span class="etat-pre">${p} à </span>${c}`;
    const suf = (c, x) => `${c}<span class="etat-suf"> ${x}</span>`;
    function texteEtat(t, ev, deplacee) {
      if (deplacee) return pre('Déplacée', deplacee);
      if (ev.etat === 'abri') return 'À l’abri';
      if (ev.etat === 'bloquee') return suf('Bloquée', ev.causes[0] && ev.causes[0].g === 'rafales' ? '(vent)' : '(pluie)');
      if (ev.etat === 'surveiller') return 'À suivre';
      return 'Prévue';
    }
    const repli = S.repli(0);
    // paires de l'échange (la tâche bloquée, le travail qui prend sa place), de la première ligne touchée à la dernière
    const paires = repli.moves.map((m) => ({ tache: m.tache, echange: m.echange && m.echange.tache, ligne: LIGNE.get(m.chantier), vide: !m.echange }))
      .sort((a, b) => a.ligne - b.ligne);
    const rang = new Map();
    paires.forEach((p) => { rang.set(p.tache, [p.ligne, 0]); if (p.echange) rang.set(p.echange, [p.ligne, 1]); });
    // place laissée vide par une tâche déplacée sans échange (aucune dans cet exemple : chaque tâche bloquée a son échange)
    const fantomes = paires.filter((p) => p.vide).map((p) => {
      const t = S.TACHES.find((x) => x.id === p.tache), f = document.createElement('div');
      f.className = 'fantome'; f.style.left = ((t.debut - H0) / (H1 - H0)) * 100 + '%'; f.style.width = barres.get(p.tache).el.style.width;
      caseDe(t.chantier, t.jour).appendChild(f);
      return { el: f, i: p.ligne };
    });
    function etatBarres(etape) {
      const E = ETAPES[etape];
      const deplacements = new Map();
      if (E.repli) for (const mv of repli.moves) {
        deplacements.set(mv.tache, { vers: mv.vers, texte: hh(S.TACHES.find((t) => t.id === mv.tache).debut) });   // la colonne dit déjà le jour (« jeu. 7 h 30 » était tronqué à 1 440 px)
        if (mv.echange) deplacements.set(mv.echange.tache, { vers: mv.echange.vers, avance: true, texte: mv.echange.abri ? suf('Avancée', 'à l’abri') : 'Avancée' });
      }
      let bloquees = 0, surveiller = 0;
      for (const [id, o] of barres) {
        const dep = deplacements.get(id);
        const jour = dep ? dep.vers : o.t.jour;
        const ev = S.evaluer(o.t, { ...o.t, jour }, E.avance);
        if (!dep) { if (ev.etat === 'bloquee') bloquees++; if (ev.etat === 'surveiller') surveiller++; }
        const role = dep ? (ev.etat === 'abri' ? 'abri' : 'deplacee') : ev.etat;
        const texte = dep && dep.avance ? dep.texte : texteEtat(o.t, ev, dep && dep.texte);
        o.cible = { jour, role, texte };
      }
      return { bloquees, surveiller };
    }
    function poserEtat(o, delai, anime, lu) {
      const b = o.el, classe = 'barre ' + (ROLES[o.cible.role] || '');
      b.style.setProperty('--d', delai.toFixed(0) + 'ms');
      if (b.className.trim() !== classe.trim()) b.className = classe;
      fondre(o.etat, o.cible.texte, delai, anime, lu);
      b.title = o.t.nom + NB + ': ' + texteSeul(o.cible.texte);
    }
    // FLIP : « avant » est la position affichée de chaque barre (transformation en cours comprise), lue avant qu'on la
    // place à son nouveau jour ; elle repart de là. Seules les barres dont le jour change sont touchées.
    function voyager(liste, avant) {
      const apres = liste.map(({ o }) => o.el.getBoundingClientRect());
      liste.forEach(({ o, delai, dessus }, i) => {
        const n = apres[i], a = avant[i];
        const dx = a.left - n.left, dy = a.top - n.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        o.el.style.zIndex = dessus ? 4 : 3;     // la tâche bloquée passe par-dessus le travail qui prend sa place
        o.trajet = o.el.animate([{ transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` }, { transform: 'none' }],
          { id: 'trajet', duration: D.long, delay: delai, easing: COURBE, fill: 'backwards' });
      });
    }

    // Les étiquettes : la source de la météo, et la ligne d'état de chaque étape (comptée une fois, au montage)
    const statuts = ETAPES.map((E, i) => {
      const c = etatBarres(i);
      return [
        `${c.bloquees} tâches menacées, ${c.surveiller} à suivre`,
        `${c.bloquees} tâches bloquées mercredi, ${c.surveiller} à suivre`,
        `${repli.moves.length} tâches déplacées, ${repli.moves.filter((m) => m.echange).length} travaux avancés. En attente de votre accord.`,
        `Envoyé aux 5 chefs de chantier. Tous l’ont lu.`,
      ][i].replace(/(\d) h/g, '$1' + NB + 'h');
    });
    const montrerEmis = etiquettes(etat.emis, ETAPES.map((E) => E.emis));
    const montrerEtat = etiquettes(etat.vu, statuts);

    // ---------- Le chef d'orchestre ----------
    // Trois couches, dans cet ordre en avançant : le front (la prévision se confirme), le trajet (le planning change),
    // l'envoi (les accusés). Chacune garde l'horaire de son dernier passage, pour que la suivante parte au bon moment même
    // quand une étape arrive en plein mouvement.
    let cible = -1, minuteurMenage = 0;
    const couches = { front: { debut: -1e9, fin: -1e9 }, trajet: { debut: -1e9, fin: -1e9 }, vu: { debut: -1e9, fin: -1e9 } };
    const dureeTrajet = (Math.max(0, ...paires.map((p) => p.ligne)) + 1) * PAS + D.long;
    const dureeVus = Math.max(...VUS.map((v) => v[1] - 1)) * MINUTE + D.moyen;
    function aller(etape, o = {}) {
      if (etape === cible) return;
      const de = cible; cible = etape;
      const anime = o.anime !== false && de >= 0 && !reduit() && !!geo;
      const E = ETAPES[etape], E0 = de >= 0 ? ETAPES[de] : null;
      const avance = de < etape;
      const ch = { front: !E0 || E0.tirets !== E.tirets, trajet: !E0 || !!E0.repli !== !!E.repli, vu: !E0 || !!E0.envoi !== !!E.envoi };
      const now = performance.now();
      const t = { front: now, trajet: now, vu: now };
      if (anime && avance) {
        const front = ch.front ? now : couches.front.debut;
        t.trajet = Math.max(now, front + D.moyen);
        const finTrajet = ch.trajet ? t.trajet + dureeTrajet : couches.trajet.fin;
        t.vu = Math.max(now, front + D.moyen, finTrajet - D.moyen);
      } else if (anime) {
        const vu = ch.vu ? now : couches.vu.debut;
        t.trajet = Math.max(now, vu + D.court);
        const finTrajet = ch.trajet ? t.trajet + dureeTrajet : couches.trajet.fin;
        t.front = Math.max(now, vu + D.court, finTrajet - D.moyen);
      }
      if (ch.front) couches.front = { debut: t.front, fin: t.front + (anime ? D.long : 0) };
      if (ch.trajet) couches.trajet = { debut: t.trajet, fin: t.trajet + (anime ? dureeTrajet : 0) };
      if (ch.vu) couches.vu = { debut: t.vu, fin: t.vu + (anime ? (E.envoi ? dureeVus : D.court) : 0) };
      const dans = (x) => Math.max(0, x - now);

      const poser = () => {
        // Ce qui change : l'état cible des barres (calcul pur), le délai de chacune dans la chorégraphie.
        // 2 · les barres : celles qui changent de jour voyagent (long), paire après paire, et changent d'état en arrivant
        // (elles voyagent avec l'état qu'elles quittent) ; celles qui changent sur place suivent le front, ligne après ligne
        etatBarres(etape);
        const liste = [], delais = new Map();
        for (const o2 of barres.values()) {
          let d = 0;
          if (o2.cible.jour !== o2.jour) {
            const [i, second] = rang.get(o2.t.id) || [0, 0];
            const premier = avance ? !second : !!second;   // en avançant la tâche bloquée part d'abord ; en reculant, l'autre
            const depart = dans(t.trajet) + i * PAS + (premier ? 0 : PAS);
            liste.push({ o: o2, delai: depart, dessus: !second });
            // l'état change à l'atterrissage, vite (classe « voyage » : 160 ms) ; changé à mi-course en 640 ms, une barre
            // bloquée passait du noir au blanc par un gris boueux pendant qu'elle croisait l'autre (contre-revue)
            d = depart + Math.round(D.long * 0.8);
            if (anime) o2.el.classList.add('voyage');
          } else if (ch.front) d = dans(t.front) + (avance ? D.court : 0) + LIGNE.get(o2.t.chantier) * PAS;
          if (o2.cible.jour === o2.jour) o2.el.classList.remove('voyage');
          delais.set(o2, anime ? d : 0);
        }
        // Lectures, toutes avant la première écriture (une seule mise en page au changement d'étape) : où chaque barre qui
        // part est affichée, l'opacité et la couleur affichées des textes qui changent.
        const avant = anime ? liste.map(({ o: o2 }) => o2.el.getBoundingClientRect()) : [];
        const lus = new Map();
        if (anime) {
          for (const o2 of barres.values()) if (o2.etat.dataset.vise !== o2.cible.texte) lus.set(o2.etat, lireFondu(o2.etat));
        }
        // Écritures.
        // 1 · le front : les bords du faisceau glissent vers le trait (long) ; le trait plein se pose sur les tirets (moyen)
        if (ch.front) {
          const d = dans(t.front);
          grille.style.setProperty('--t-front', d + 'ms');
          grille.style.setProperty('--t-plein', (d + (avance ? D.court : 0)) + 'ms');
          grille.style.setProperty('--t-tirets', (avance ? d + D.court + D.moyen : d) + 'ms');
          grille.classList.toggle('pg--sure', !E.tirets);
        }
        // 2 · les barres : on les place à leur nouveau jour, puis FLIP depuis la position lue ; l'état change ensuite (la
        // transition de couleur part du style courant)
        for (const { o: o2 } of liste) { o2.jour = o2.cible.jour; if (o2.trajet) o2.trajet.cancel(); placer(o2); }
        if (anime) voyager(liste, avant);
        for (const [o2, d] of delais) poserEtat(o2, d, anime, lus.get(o2.etat));
        fantomes.forEach((f) => { f.el.style.setProperty('--d', (anime ? dans(t.trajet) + f.i * PAS : 0) + 'ms'); f.el.classList.toggle('visible', !!E.repli); });
        // 3 · les accusés : chaque nom remonte d'une ligne et son accusé arrive à l'heure de sa lecture ; au retour, tous
        // s'effacent ensemble
        if (ch.vu) sites.forEach((el, i) => {
          el.style.setProperty('--d', (anime && E.envoi ? dans(t.vu) + (VUS[i][1] - 1) * MINUTE : 0) + 'ms');
          el.classList.toggle('lu', !!E.envoi);
        });
        // 4 · les étiquettes suivent les couches : la source de la météo change quand une couche part, la ligne d'état quand
        // elle a fini (« Tous l'ont lu » avec le dernier accusé). Le lecteur d'écran entend l'étape atteinte, tout de suite.
        const ordre = avance ? [['front', 1], ['trajet', 2], ['vu', 3]] : [['vu', 2], ['trajet', 1], ['front', 0]];
        const couchesPassage = ordre.filter(([c]) => ch[c]);
        montrerEmis(anime ? couchesPassage.map(([c, e]) => [dans(t[c]), e]) : [[0, etape]], anime);
        montrerEtat(anime ? couchesPassage.map(([c, e]) => [dans(couches[c].fin - D.moyen), e]) : [[0, etape]], anime);
        if (etat.texte && etat.texte.textContent !== statuts[etape]) etat.texte.textContent = statuts[etape];
      };
      if (anime) poser(); else sansTransition(poser);
      // ménage des copies de texte effacées, en une mise en page, quand tout est posé
      clearTimeout(minuteurMenage);
      const fin = Math.max(couches.front.fin, couches.trajet.fin + D.long, couches.vu.fin) - now + D.moyen;
      minuteurMenage = setTimeout(() => menage(grille), Math.max(0, fin));
    }

    const ro = new ResizeObserver(() => { mesurer(); sansTransition(dessiner); });
    ro.observe(grille);
    mesurer(); sansTransition(dessiner);
    return { aller, get etape() { return cible; } };
  }

  A.planning = { monter, SITES, ETAPES };
})();
