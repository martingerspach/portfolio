/* Auvent · landing v3 « Ciel » : orchestration de la page (script classique ; requiert carte.js, scenario.js, ville.js,
   verre.js, logo-ciel.js, dessins.js, planning.js).
   Paramètres de revue : ?rm=1 force les mouvements réduits (captures) ; ?ville=lille choisit la ville ; ?etape=0..3 fige le
   planning ; ?fige=1 coupe la pluie et pose tout à l'état final. */
(function () {
  const A = window.Auvent, S = A.scenario, V = A.ville, C = A.carte;
  const NB = ' ';
  const q = new URLSearchParams(location.search);
  const FIGE = q.has('fige');
  const reduit = () => q.has('rm') || FIGE || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const nombre = (v, d = 0) => v.toFixed(d).replace('.', ',').replace('-', '−');
  const hh = (t) => `${((t + 6) % 24 + 24) % 24}${NB}h`;           // heure du modèle -> « 9 h »
  const JOURS = ['mardi', 'mercredi', 'jeudi', 'vendredi'];
  const DATES = ['mardi 13', 'mercredi 14', 'jeudi 15', 'vendredi 16'];
  const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  document.documentElement.classList.add('js');
  // le squelette de l'artefact pose <html> sans langue : sans elle, un lecteur d'écran lit la page avec une voix anglaise
  document.documentElement.lang = 'fr';
  if (q.has('rm') || FIGE) document.documentElement.classList.add('rm');

  // ---------- Logo ----------
  const logoTete = $('.tete-marque [data-logo]');
  const ctlLogo = A.logo.monter(logoTete, { rafale: !reduit() });
  $('.tete-marque').addEventListener('mouseenter', () => ctlLogo.souffle());
  // Le mot géant du pied prend le vent (marque/vent-pied.js, direction « champ ») : rafales à l'entrée à l'écran, au
  // passage rapide du pointeur sur le mot, au défilement rapide ; au repos en moins de 5 s ; posé en mouvements réduits.
  A.ventPied.pied = A.ventPied.monter($('.pied-mot [data-logo]'), { direction: 'champ', id: 'pied', zone: $('.pied-mot'), anime: !reduit() });

  // ---------- Héros : la ville ----------
  const VILLES = C.VILLES.map((v) => ({ id: v.id, nom: v.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const choixVille = $('#ville'), choixEssai = $('#essai-ville');
  for (const sel of [choixVille, choixEssai]) sel.innerHTML = VILLES.map((v) => `<option value="${v.id}">${v.nom}</option>`).join('');
  const villeInit = VILLES.some((v) => v.id === q.get('ville')) ? q.get('ville') : 'nantes';
  choixVille.value = choixEssai.value = villeInit;

  // Le verdict : la tâche que la météo bloque, le jour, et quand elle reprend. La cause est dite quand ce n'est pas la
  // pluie que mesure l'instrument (le vent, le froid du matin). Aucune mesure dans la phrase : elle est sur la cote.
  function verdictDe(b) {
    if (!b.cle) return `Cette semaine, la météo ne bloque rien à ${b.nom}.`;
    const J = maj(JOURS[b.jour]), suite = b.prochain(b.cle), quand = suite !== null ? JOURS[suite] : 'la semaine prochaine';
    if (b.cle === 'coulage') {
      const froid = !b.types.coulage[b.jour].heures.some((t) => b.serie[t].pluie > 1);
      return froid ? `${J}, il fera trop froid${NB}: la coule de la dalle attendra ${quand}.` : `${J}, la coule de la dalle attendra ${quand}.`;
    }
    if (b.cle === 'nacelle') return `${J}, le vent laissera la nacelle au sol.`;
    if (b.cle === 'couverture') {
      // cause dominante : le vent si toutes les heures bloquées dépassent 40 km/h, sinon la pluie
      const vent = b.types.couverture[b.jour].heures.every((h) => b.serie[h].rafales > 40);
      return `${J}, ${vent ? 'le vent' : 'la pluie'} repousse la pose de la toiture à ${quand}.`;
    }
    return `${J}, le levage attendra que le vent tombe.`;
  }
  function titreEnLignes(el, texte) {
    el.textContent = '';
    texte.split(' ').forEach((mot, i, arr) => {
      const s = document.createElement('span'); s.className = 'ligne'; s.style.setProperty('--i', i); s.textContent = mot;
      el.appendChild(s); if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  titreEnLignes($('#titre'), $('#titre').textContent);
  function choisirVille(id, anime = true) {
    const b = V.bilan(id);
    const verdict = $('.heros-verdict');
    $('#verdict').textContent = verdictDe(b);
    if (anime && !reduit()) { verdict.classList.remove('rejoue'); void verdict.offsetWidth; verdict.classList.add('rejoue'); }
    choixEssai.value = id;
    niveauMm = b.mm < 1 ? 0 : Math.round(b.mm);       // la cote et le niveau disent la même valeur, au millimètre
    $('#cote-quand').textContent = ` de pluie ${JOURS[b.jour]} à ${b.nom}.`;
    if (anime && !reduit() && affiche === null) cotes(true, DUREE_VILLE, COURBE_VILLE); else cotes();
    if (anime && averse) averse(3500);
  }
  choixVille.addEventListener('change', () => choisirVille(choixVille.value));

  // ---------- Héros : l'instrument (coordonnées de l'image 1360 × 2048) ----------
  // Relevées au pixel sur le rendu (canal alpha) : bord de l'entonnoir le plus large à y 82 (x 265 à 1095), éprouvette
  // de y 450 à 1515 (x 501 à 858), axe x 680. Intérieur du tube : alpha > 200 de 503 à 857. Graduations relevées sur
  // l'éprouvette sèche (outils/eau.py) : une tous les 29,6 px, la première au-dessus du fond à y 1 480 ; le zéro est donc
  // à 1 509,6 et la n-ième graduation vaut n mm. Le niveau se lit au bas du ménisque (bande de 62 px, lu à 45,5 px du haut).
  // Les mêmes repères, en fractions de la hauteur, placent le verdict en CSS (landing.css, .heros-sortie).
  const IMG = { w: 1360, h: 2048, axe: 680, bordG: 265, bordD: 1095, bordY: 82, tubeG: 501, tubeD: 858, tubeH: 450, tubeB: 1515,
    inG: 503, inD: 857, zero: 1509.6, grad: 29.6, fond: 1503, menH: 62, menLu: 45.5 };
  const niveauY = (mm) => Math.max(IMG.tubeH + 70, IMG.zero - mm * IMG.grad);
  const texteMm = (mm) => (mm < 1 ? `moins de 1${NB}mm` : `${mm}${NB}mm`);
  // La montée d'ouverture dure le temps de l'averse ; un changement de ville est plus court. Le chiffre compte avec l'eau,
  // la surface frémit à l'arrivée. Rien de tout cela en mouvement réduit.
  const COURBE_EAU = [0.3, 0.1, 0.25, 1], COURBE_VILLE = [0.45, 0.05, 0.2, 1];
  const DUREE_MONTEE = 2600, DUREE_VILLE = 1200;
  function bezier([x1, y1, x2, y2]) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (t) => ((ax * t + bx) * t + cx) * t, dfx = (t) => (3 * ax * t + 2 * bx) * t + cx, fy = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => { let t = x; for (let i = 0; i < 8; i++) { const e = fx(t) - x, dd = dfx(t); if (Math.abs(e) < 1e-6 || !dd) break; t -= e / dd; } return fy(clamp(t)); };
  }
  let rafCompte = 0;
  function compter(de, a, duree, courbe) {
    cancelAnimationFrame(rafCompte);
    const el = $('#cote-mm'), f = bezier(courbe), t0 = performance.now();
    const pas = (now) => {
      const p = Math.min(1, (now - t0) / duree);
      el.textContent = p >= 1 ? texteMm(a) : `${Math.round(de + (a - de) * f(p))}${NB}mm`;
      if (p < 1) rafCompte = requestAnimationFrame(pas);
    };
    rafCompte = requestAnimationFrame(pas);
  }
  function fremir(apres, ampl) {
    const m = $('.eau-menisque');
    m.getAnimations().forEach((x) => x.id === 'fremit' && x.cancel());
    m.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${(-ampl).toFixed(2)}px)`, offset: 0.2 }, { transform: `translateY(${(ampl * 0.45).toFixed(2)}px)`, offset: 0.48 },
      { transform: `translateY(${(-ampl * 0.16).toFixed(2)}px)`, offset: 0.74 }, { transform: 'translateY(0)' }], { id: 'fremit', duration: 1000, delay: Math.max(0, apres - 140), easing: 'cubic-bezier(.3,0,.3,1)' });
  }
  // niveauMm : la pluie de la ville (au millimètre) ; affiche : le niveau dessiné (0 jusqu'à la montée d'ouverture) ;
  // mmDessine : la valeur que montre la cote
  const heros = $('#haut');
  let finEau = 0, niveauMm = 14, mmDessine = 0, minuterieEau = 0, affiche = (reduit() || q.has('fige')) ? null : 0;
  if (affiche === 0) setTimeout(() => { affiche = null; cotes(true, DUREE_MONTEE, COURBE_EAU); }, 700);
  function cotes(anime = false, duree = 0, courbe = COURBE_VILLE) {
    const fig = $('#objet'), svg = $('#cotes'), eau = $('#eau');
    const w = fig.clientWidth, h = fig.clientHeight;
    if (!w || !h) return;
    // Hors d'un changement de ville, tout se pose sans glisser (redimensionnement, polices) ; un replacement demandé
    // pendant un mouvement de l'eau attend sa fin.
    if (anime) finEau = performance.now() + duree;
    else if (performance.now() < finEau) { clearTimeout(cotes.attente); cotes.attente = setTimeout(() => cotes(), finEau - performance.now() + 30); return; }
    else { heros.classList.add('pose'); requestAnimationFrame(() => requestAnimationFrame(() => heros.classList.remove('pose'))); }
    const s = Math.min(w / IMG.w, h / IMG.h), ox = (w - IMG.w * s) / 2, oy = (h - IMG.h * s) / 2;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const r = (v) => Math.round(v) + 0.5;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // l'axe de symétrie (trait mixte fin), du dessus de l'entonnoir au pied
    svg.innerHTML = `<line x1="${r(X(IMG.axe))}" y1="${Y(26) - 22}" x2="${r(X(IMG.axe))}" y2="${Y(2030) + 14}" stroke-dasharray="14 4 2 4"/>`;
    // l'eau : calque posé sur l'intérieur du tube, surface à la pluie de la ville (sec sous 1 mm)
    const mm = affiche === null ? niveauMm : affiche, sec = mm < 1;
    const yEau = niveauY(mm);
    const haut = IMG.tubeH, k = Math.max(0, (IMG.fond - (yEau - IMG.menLu + IMG.menH)) / (IMG.fond - haut));
    Object.assign(eau.style, { left: X(IMG.inG) + 'px', top: Y(haut) + 'px', width: (IMG.inD - IMG.inG) * s + 'px', height: (IMG.fond - haut) * s + 'px' });
    if (anime) {
      heros.style.setProperty('--eau-duree', duree + 'ms'); heros.style.setProperty('--eau-courbe', `cubic-bezier(${courbe.join(',')})`);
      clearTimeout(minuterieEau); minuterieEau = setTimeout(() => { heros.style.removeProperty('--eau-duree'); heros.style.removeProperty('--eau-courbe'); }, duree + 100);
    }
    eau.style.setProperty('--eau-y', ((yEau - IMG.menLu - haut) * s).toFixed(2) + 'px');
    eau.style.setProperty('--eau-k', (sec ? 0 : k).toFixed(4));
    eau.style.setProperty('--eau-o', sec ? '0' : '1');
    // le verdict se pose sur la ligne de lecture : la surface de l'eau, ou le fond de l'éprouvette quand elle est sèche
    // (en millimètres de graduation, que landing.css convertit avec les mêmes repères)
    const yLu = sec ? IMG.fond - 4 : yEau;
    heros.style.setProperty('--mm', ((IMG.zero - yLu) / IMG.grad).toFixed(3));
    cancelAnimationFrame(rafCompte);
    $('#cote-mm').textContent = texteMm(mm);
    if (anime && mm !== mmDessine) {
      compter(mmDessine, mm, duree, courbe);
      if (!sec) fremir(duree, 4 * s);
    }
    mmDessine = mm;
  }

  // ---------- Héros : l'averse (canvas, 19,5° depuis la verticale) ----------
  // Une averse dure 4 s, puis passe : les gouttes ne renaissent plus et s'effacent en 0,9 s. Elle revient à chaque
  // changement de ville (WCAG 2.2.2 : aucun mouvement automatique au-delà de 5 s). L'entonnoir la recueille : une goutte
  // qui atteint sa bouche y entre (elle est coupée au bord), et sous l'entonnoir, à l'abri de son pavillon, il ne pleut pas.
  let averse = null;
  function pluie() {
    const cv = $('#pluie'), ctx = cv.getContext('2d');
    const ang = (19.5 * Math.PI) / 180, sx = Math.sin(ang), sy = Math.cos(ang), pente = sx / sy;
    let W = 0, H = 0, dpr = 1, gouttes = [], raf = 0, visible = true, t0 = 0, fin = 0;
    let bouche = null;                  // l'entonnoir dans le repère du canvas : { y, g, d }
    const EFFACE = 900;
    const N = () => Math.round(clamp((W * H) / 9000, 60, 220));
    function mesurer() {
      const f = $('#objet').getBoundingClientRect(), c = cv.getBoundingClientRect();
      const s = Math.min(f.width / IMG.w, f.height / IMG.h);
      if (!s) { bouche = null; return; }
      const ox = f.left - c.left + (f.width - IMG.w * s) / 2, oy = f.top - c.top + (f.height - IMG.h * s) / 2;
      bouche = { y: oy + IMG.bordY * s, g: ox + (IMG.bordG + 10) * s, d: ox + (IMG.bordD - 10) * s };
    }
    function taille() {
      dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      gouttes = Array.from({ length: N() }, () => ({ x: rnd() * (W + H * 0.4) - H * 0.35, y: rnd() * H, l: 26 + rnd() * 70, v: 700 + rnd() * 600, a: 0.035 + rnd() * 0.1 }));
      mesurer();
      dessiner(0);
    }
    // sous la bouche, à l'abri : le point, remonté le long de la pluie jusqu'à la hauteur de la bouche, tombe dans l'entonnoir
    const abrite = (x, y) => bouche && y > bouche.y && (() => { const xb = x - (y - bouche.y) * pente; return xb > bouche.g && xb < bouche.d; })();
    function dessiner(dt, now = 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      const k = now ? clamp(1 - (now - fin) / EFFACE) : 1;      // 1 pendant l'averse, puis vers 0
      for (const g of gouttes) {
        if (g.mort) continue;
        g.y += g.v * dt; g.x += g.v * dt * pente;
        if (g.y - g.l > H) {
          if (now && now > fin) { g.mort = true; continue; }
          g.y = -g.l * sy; g.x -= H * pente + g.l * sx;
        }
        let x1 = g.x, y1 = g.y;
        const x0 = x1 - sx * g.l, y0 = y1 - sy * g.l;
        if (abrite(x1, y1)) {
          if (y0 >= bouche.y) continue;                 // déjà dans l'entonnoir
          const u = (bouche.y - y0) / (y1 - y0);         // coupée au bord de la bouche
          x1 = x0 + (x1 - x0) * u; y1 = bouche.y;
        }
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, 'rgba(188,205,232,0)'); gr.addColorStop(1, `rgba(220,228,239,${(g.a * k).toFixed(4)})`);
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    function boucle(now) {
      const dt = t0 ? Math.min(0.05, (now - t0) / 1000) : 0; t0 = now; dessiner(dt, now);
      if (now > fin + EFFACE) { ctx.clearRect(0, 0, W, H); raf = 0; return; }
      raf = visible ? requestAnimationFrame(boucle) : 0;
    }
    new ResizeObserver(() => { taille(); if (!reduit() && !raf) ctx.clearRect(0, 0, W, H); }).observe(cv);
    new ResizeObserver(mesurer).observe($('#objet'));
    if (reduit()) return;
    averse = (ms) => {
      mesurer();
      fin = performance.now() + ms; gouttes.forEach((g) => (g.mort = false));
      if (!raf && visible) { t0 = 0; raf = requestAnimationFrame(boucle); }
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting; cancelAnimationFrame(raf); raf = 0; t0 = 0;
      if (visible && performance.now() < fin + EFFACE) raf = requestAnimationFrame(boucle);
    }).observe(cv);
    averse(4000);
  }

  // ---------- En-tête : contexte de la section survolée, curseur de navigation ----------
  const tete = $('#tete');
  const sections = $$('[data-contexte]').filter((e) => e !== tete);
  // « nuit@-230 » : à 230 px du bas ; « jour@150 » : à 150 px du haut ; « jour@--aube*0.5 » : à mi-hauteur du fondu --aube
  // (propriété enregistrée en longueur, donc lue en pixels ; mise en cache, relue au redimensionnement)
  const seuils = new Map();
  addEventListener('resize', () => seuils.clear());
  function seuilDe(cle, s, v, h) {
    if (!v.startsWith('--')) return +v < 0 ? h + +v : +v;
    if (!seuils.has(cle)) { const [nom, k] = v.split('*'); seuils.set(cle, parseFloat(getComputedStyle(s).getPropertyValue(nom)) * (+k || 1)); }
    return seuils.get(cle);
  }
  function contexte() {
    const y = 36;
    let ctx = 'nuit';
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        ctx = s.dataset.contexte;
        // « nuit@-230 » : le fond devient sombre à 230 px du bas ; « jour@150 » : clair à partir de 150 px du haut
        // plusieurs bascules, dans l'ordre de la section : « jour@--aube*0.5 nuit@-230 »
        for (const b of (s.dataset.bascule || '').split(' ').filter(Boolean)) { const [c, v] = b.split('@'); if (y - r.top >= seuilDe(s.id + v, s, v, r.height)) ctx = c; }
        break;
      }
    }
    if (tete.dataset.contexte !== ctx) {
      tete.dataset.contexte = ctx;
      tete.classList.toggle('av-nuit', ctx === 'nuit'); tete.classList.toggle('av-jour', ctx === 'jour');
      ['.tete-liens', '.tete-fond'].forEach((q) => A.verre.peindre($(q)));
    }
  }
  tete.classList.add('av-nuit');
  const curseur = $('.tete-curseur');
  // L'indicateur se pose au sous-pixel près (offsetLeft et offsetWidth arrondis le décalaient jusqu'à 0,45 px vers la
  // droite). Quand il est invisible, il se pose sans glisser : à l'entrée dans la barre, il apparaît sous le lien visé au
  // lieu de partir du dernier lien survolé.
  const liens = $('.tete-liens');
  const liensTete = $$('.tete-liens a'), liensFeuille = $$('.tete-feuille-nav a');
  let entree = true, actif = -1;
  const viser = (a) => {
    const R = liens.getBoundingClientRect(), r = a.getBoundingClientRect();
    if (!R.width) return;
    if (entree) curseur.style.transition = 'none';
    curseur.style.width = r.width + 'px';
    curseur.style.transform = `translateX(${r.left - R.left - liens.clientLeft}px)`;
    if (entree) { void curseur.offsetWidth; curseur.style.transition = ''; entree = false; }
  };
  // L'indicateur est visible au survol, au focus, ou au repos sous la section lue. Quand il était invisible, il apparaît
  // en place au lieu de glisser depuis le dernier lien visé.
  const pris = () => liens.matches(':hover') || liens.matches(':focus-within');
  liens.addEventListener('pointerenter', () => { if (actif < 0 && !liens.matches(':focus-within')) entree = true; });
  liens.addEventListener('focusin', (e) => { if (actif < 0 && !liens.contains(e.relatedTarget) && !liens.matches(':hover')) entree = true; });
  const reposer = () => { if (!pris() && actif >= 0) viser(liensTete[actif]); };
  liens.addEventListener('pointerleave', () => requestAnimationFrame(reposer));
  liens.addEventListener('focusout', () => requestAnimationFrame(reposer));
  liensTete.forEach((a) => { a.addEventListener('pointerenter', () => viser(a)); a.addEventListener('focus', () => viser(a)); });
  viser(liensTete[0]);
  // Section active : celle qui passe à 40 % de la hauteur de l'écran ; aria-current dans la barre et dans le menu
  const cibles = liensTete.map((a) => $(a.getAttribute('href')));
  function sectionActive() {
    const y = innerHeight * 0.4;
    let i = -1;
    cibles.forEach((s, k) => { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) i = k; });
    if (i === actif) return;
    if (actif < 0 && !pris()) entree = true;
    actif = i;
    [liensTete, liensFeuille].forEach((L) => L.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'))));
    liens.classList.toggle('a-actif', i >= 0);
    if (i >= 0 && !pris()) viser(liensTete[i]);
  }

  // ---------- En-tête : le menu de téléphone ----------
  // Une feuille qui se déroule sous l'en-tête comme la toile d'un store (clip-path du haut vers le bas), un voile sur la
  // page. Ouvert : la page est inerte et ne défile plus, le focus va au premier lien et reste dans le menu (bouton,
  // liens, appel) ; Échap, le voile ou un lien le ferment. Mouvements réduits : il s'ouvre et se ferme d'un coup.
  const btnMenu = $('#tete-menu'), feuille = $('#tete-feuille'), voile = $('#tete-voile');
  const horsMenu = ['#contenu', '#pied', '.evitement', '.tete-marque', '.tete-appel'].map((s) => $(s)).filter(Boolean);
  let menuOuvert = false, animMenu = null;
  const COURBE_STD = 'cubic-bezier(.2,0,0,1)';
  function ouvrirMenu() {
    if (menuOuvert) return;
    menuOuvert = true;
    feuille.hidden = false; voile.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'true');
    tete.classList.add('menu-ouvert'); document.documentElement.classList.add('menu-ouvert');
    horsMenu.forEach((el) => (el.inert = true));
    A.verre.peindre($('.tete-feuille-fond'));
    if (animMenu) animMenu.cancel();
    if (!reduit()) {
      animMenu = feuille.animate([{ clipPath: 'inset(0 0 100% 0 round 24px)' }, { clipPath: 'inset(0 0 0% 0 round 24px)' }], { duration: 460, easing: COURBE_STD });
      voile.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'linear' });
      $$('.tete-feuille-nav a, .tete-feuille-appel', feuille).forEach((a, i) => a.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 110 + i * 40, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
    liensFeuille[0].focus();
  }
  function fermerMenu(rendre = true) {
    if (!menuOuvert) return;
    menuOuvert = false;
    btnMenu.setAttribute('aria-expanded', 'false');
    tete.classList.remove('menu-ouvert'); document.documentElement.classList.remove('menu-ouvert');
    horsMenu.forEach((el) => (el.inert = false));
    const fin = () => { if (!menuOuvert) { feuille.hidden = true; voile.hidden = true; } };
    if (animMenu) animMenu.cancel();
    if (reduit()) fin();
    else {
      animMenu = feuille.animate([{ clipPath: 'inset(0 0 0% 0 round 24px)' }, { clipPath: 'inset(0 0 100% 0 round 24px)' }], { duration: 280, easing: 'cubic-bezier(.4,0,1,1)' });
      voile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'linear', fill: 'forwards' });
      animMenu.onfinish = fin;
    }
    if (rendre) btnMenu.focus();
  }
  btnMenu.addEventListener('click', () => (menuOuvert ? fermerMenu() : ouvrirMenu()));
  voile.addEventListener('click', () => fermerMenu());
  feuille.addEventListener('click', (e) => { if (e.target.closest('a')) fermerMenu(false); });
  addEventListener('keydown', (e) => {
    if (!menuOuvert) return;
    if (e.key === 'Escape') { e.preventDefault(); fermerMenu(); return; }
    if (e.key !== 'Tab') return;
    const f = [btnMenu, ...$$('a', feuille)], i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (m) => { if (m.matches) fermerMenu(false); });

  // ---------- Comment ça marche : la pluie de mercredi, à côté du bulletin qui en découle ----------
  // Un seul rang (la pluie) et une seule tâche (le coulage, celle du bulletin) : les barres heure par heure, le créneau
  // prévu, la limite du coulage en tirets. Les heures du créneau au-dessus de la limite passent au bleu du signal, avec
  // une accolade qui dit la conséquence : la pluie dépasse la limite dès 9 h, ce que le téléphone annonce.
  const MER = 1;
  const meteoNantes = S.meteo('bateliers', 0).serie;
  const HEURES = Array.from({ length: 15 }, (_, i) => 6 + i);                // 6 h à 20 h
  const serieH = HEURES.map((h) => meteoNantes[S.tDe(MER, h)]);
  const COULAGE = { debut: 7, fin: 13, limite: 1 };                         // créneau du bulletin, limite en mm/h
  function releve() {
    const hote = $('#releve-graphe');
    const W = hote.clientWidth, H = hote.clientHeight;
    if (!W || !H) return;
    // pendant l'entrée, un redessin (polices, taille) attend sa fin : il remplaçait le SVG et coupait l'animation
    const reste = releveT0 + RELEVE_DUREE + 120 - performance.now();
    if (reste > 0 && hote.querySelector('svg')) { clearTimeout(releve.attente); releve.attente = setTimeout(releve, reste); return; }
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const net = (v) => Math.round(v * dpr) / dpr;                           // calé sur le pixel de l'écran
    const r1 = (v) => (+v.toFixed(2)).toString();
    const g = 2, dr = 2, bas = 34, pas = (W - g - dr) / 15;
    const x = (h) => g + (h - 6 + 0.5) * pas;                               // centre de l'heure h
    const xb = (h) => net(g + (h - 6) * pas);                               // bord de l'heure h
    const base = net(H - bas) + 0.5 / dpr;
    // Échelle : la barre la plus haute monte jusqu'à 84 px du haut, sous le libellé du créneau et l'accolade (v22 : un
    // plafond fixe laissait la moitié haute du graphique vide).
    const PMAX = Math.max(...serieH.map((v) => v.pluie)) * 1.02, hautBarres = 84;
    const yP = (p) => base - (p / PMAX) * (base - hautBarres);
    // Barres à sommet arrondi ; les heures bloquées sont pleines, au bleu du signal. La hachure de pluie (à 19,5°) se
    // lisait, dans des barres de 16 px, comme des traits verticaux penchés.
    const bw = net(Math.max(6, Math.min(22, pas * 0.56))), rr = Math.min(bw / 2, 5);
    const barre = (h, p) => {
      const x0 = net(x(h) - bw / 2), y = net(Math.min(base - rr - 1, yP(p)));
      return `M${r1(x0)} ${r1(base)}V${r1(y + rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}h${r1(bw - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${r1(base)}Z`;
    };
    const depasse = (h, p) => h >= COULAGE.debut && h < COULAGE.fin && p > COULAGE.limite;
    const barres = serieH.map((v, i) => `<path class="b-pluie${depasse(HEURES[i], v.pluie) ? ' b-pluie--depasse' : ''}" data-h="${HEURES[i]}" d="${barre(HEURES[i], v.pluie)}"/>`).join('');
    const bloques = serieH.map((v, i) => ({ h: HEURES[i], p: v.pluie })).filter((b) => depasse(b.h, b.p));
    const pleins = bloques.map((b) => `<path class="b-depasse" data-h="${b.h}" d="${barre(b.h, b.p)}"/>`).join('');
    // une étiquette toutes les 2 h, toutes les 4 h si la place manque ; pas de graduations sous l'axe (elles faisaient règle)
    const tous = pas * 2 >= 44 ? 2 : 4;
    const axes = HEURES.filter((h) => (h - 6) % tous === 0).map((h) => `<text class="g-heure" x="${r1(x(h))}" y="${H - 8}" text-anchor="middle">${h}${NB}h</text>`).join('');
    const yL = net(yP(COULAGE.limite)) + 0.5 / dpr, xa = xb(COULAGE.debut), xf = xb(COULAGE.fin);
    // accolade au-dessus des heures bloquées, son libellé centré dessus (gardé dans le cadre)
    let accolade = '';
    if (bloques.length) {
      const a0 = xb(bloques[0].h) + 3, a1 = xb(bloques[bloques.length - 1].h + 1) - 3;
      const ya = net(Math.min(...bloques.map((b) => yP(b.p))) - 14) + 0.5 / dpr;
      accolade = `<g class="g-accolade"><path d="M${r1(a0)} ${r1(ya + 6)}V${r1(ya)}H${r1(a1)}V${r1(ya + 6)}M${r1((a0 + a1) / 2)} ${r1(ya)}v-5"/>`
        + `<text class="g-accolade-txt" x="${r1((a0 + a1) / 2)}" y="${r1(ya - 12)}" text-anchor="middle">Trop de pluie pour couler</text></g>`;
    }
    hote.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs>
        <linearGradient id="barre-pluie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F5FA" stop-opacity=".46"/><stop offset="1" stop-color="#F2F5FA" stop-opacity=".14"/></linearGradient>
        <linearGradient id="barre-bloquee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9C1FF"/><stop offset="1" stop-color="#4F80F2"/></linearGradient>
      </defs>
      <rect class="g-fenetre" x="${r1(xa)}" y="0" width="${r1(xf - xa)}" height="${r1(base)}" rx="10"/>
      <text class="g-fenetre-txt" x="${r1(xa + 12)}" y="24">Coulage prévu</text>
      <g class="g-pluie">${barres}</g>
      <g class="g-pluie-depasse">${pleins}</g>
      <g class="g-limite"><line class="g-seuil" x1="${g}" x2="${W - dr}" y1="${r1(yL)}" y2="${r1(yL)}"/></g>
      <text class="g-seuil-txt" x="${W - dr}" y="${r1(yL - 9)}" text-anchor="end">Limite du coulage</text>
      ${accolade}
      <line class="g-base" x1="${g}" x2="${W - dr}" y1="${r1(base)}" y2="${r1(base)}"/>
      ${axes}
    </svg>`;
    // La limite est nommée sur son trait, à droite, là où les barres sont sous la limite ; si une barre touche le
    // libellé, il passe sous le trait. Le libellé de l'accolade reste dans le cadre quand le graphique est étroit.
    const ts = hote.querySelector('.g-seuil-txt'), lt = ts.getComputedTextLength();
    // Sinon (graphique étroit), la légende revient en tête de la carte : sous le trait, le libellé chevauchait les barres.
    const touche = serieH.some((v, i) => x(HEURES[i]) + bw / 2 > W - dr - lt - 6 && yP(v.pluie) < yL - 2);
    if (touche) ts.remove();
    $('#releve-legende').hidden = !touche;
    const t = hote.querySelector('.g-accolade-txt');
    if (t) { const l = t.getComputedTextLength(), cx = +t.getAttribute('x'); t.setAttribute('x', r1(Math.min(W - dr - l / 2, Math.max(g + l / 2, cx)))); }
  }
  // Entrée, une fois, en quatre temps qui racontent la lecture : les heures de pluie montent, le créneau se pose, la
  // limite se trace de gauche à droite et se nomme, les heures bloquées passent au bleu l'une après l'autre, puis
  // l'accolade dit pourquoi. Le téléphone reçoit ensuite le bulletin (arriveeBulletin, décalé d'autant). Transform,
  // opacité et découpe seulement ; rien en mouvements réduits.
  let releveVu = false, releveT0 = -1e9;
  const RELEVE_DUREE = 2100;
  function entreeReleve() {
    const svg = $('#releve-graphe svg'); if (!svg || reduit()) return;
    releveT0 = performance.now();
    const doux = 'cubic-bezier(.16,1,.3,1)', trace = 'cubic-bezier(.45,.05,.2,1)';
    $$('.b-pluie', svg).forEach((b) => b.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 820, delay: 26 * (+b.dataset.h - 6), easing: doux, fill: 'backwards' }));
    $$('.g-fenetre, .g-fenetre-txt', svg).forEach((e) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 300, easing: 'linear', fill: 'backwards' }));
    svg.querySelector('.g-limite').animate([{ clipPath: 'inset(-4px 100% -4px 0)' }, { clipPath: 'inset(-4px 0 -4px 0)' }], { duration: 760, delay: 620, easing: trace, fill: 'backwards' });
    const ts = svg.querySelector('.g-seuil-txt');
    if (ts) ts.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 1240, easing: 'linear', fill: 'backwards' });
    $$('.b-depasse', svg).forEach((b, i) => b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 1180 + 110 * i, easing: 'linear', fill: 'backwards' }));
    const acc = svg.querySelector('.g-accolade');
    if (acc) acc.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 1560, easing: doux, fill: 'backwards' });
    $('#releve-graphe').classList.remove('attente');     // les animations tiennent l'état de départ pendant leur délai
  }

  // ---------- Planning ----------
  // Au-delà de 1 100 px, l'étape suit la lecture : elle change quand le haut d'une étape passe la mi-hauteur de l'écran,
  // avec une hystérésis (bande de ± 2 % de la hauteur d'écran, 12 px au moins) : un léger va-et-vient sur le seuil ne la
  // fait pas basculer. La position décide, jamais l'inverse : le défilement reste natif. Un défilement rapide qui franchit
  // plusieurs seuils dans la même image va droit à l'étape atteinte, et planning.js y va sans repasser par les autres.
  const plan = A.planning.monter($('#app-grille'), { emis: $('#app-emis'), texte: $('#app-etat'), vu: $('#app-etat-vu') });
  const etapes = $$('.etape');
  const onglets = $$('.onglet');
  const listeEtapes = $('#etapes');
  const appPlan = $('#app');
  // le filet de progression est lié au défilement par le navigateur (landing.css) ; sinon, ou en mouvements réduits, ici
  const railNatif = !!(window.CSS && CSS.supports('animation-timeline: view()'));
  function allerEtape(i, o) {
    etapes.forEach((e) => e.classList.toggle('actif', +e.dataset.etape === i));
    etapes.forEach((e) => e.querySelector('.etape-bouton').setAttribute('aria-current', +e.dataset.etape === i ? 'step' : 'false'));
    onglets.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.etape === i));
    const e = etapes[i];
    $('#onglet-texte').innerHTML = `<b>${e.querySelector('.etape-titre').textContent}</b>${e.querySelector('.etape-texte').innerHTML}`;
    plan.aller(i, o);
    suivreRepli(i, o);
  }
  onglets.forEach((b) => b.addEventListener('click', () => allerEtape(+b.dataset.etape)));
  // Sur écran étroit, la grille défile : on l'ouvre sur mercredi, le jour du front (colonne des chantiers collée à gauche)
  function ouvrirSurMercredi() {
    const d = $('#app-grille'); if (d.scrollWidth <= d.clientWidth) return;
    const c = $('.pg-jour:nth-of-type(3)'), site = $('.pg-coin');
    if (c && site) d.scrollLeft = c.offsetLeft - site.offsetWidth;
    auBout();
  }
  // Au téléphone, une seule colonne de jour est visible : après le repli (« Proposé », « Envoyé »), la grille glisse
  // jusqu'à jeudi, où arrivent les tâches déplacées, une fois leur trajet commencé ; aux deux premiers temps, elle revient
  // sur mercredi, le jour du front. Le lecteur peut toujours la faire défiler lui-même.
  let minuterieRepli = 0;
  function suivreRepli(i, o = {}) {
    const d = $('#app-grille'); if (!d || d.scrollWidth <= d.clientWidth + 2) return;
    const col = $(`.pg-jour:nth-of-type(${i >= 2 ? 4 : 3})`), site = $('.pg-coin');
    if (!col || !site) return;
    const x = col.offsetLeft - site.offsetWidth;
    clearTimeout(minuterieRepli);
    const aller = () => d.scrollTo({ left: x, behavior: reduit() || o.anime === false ? 'instant' : 'smooth' });
    if (i >= 2 && o.anime !== false && !reduit()) minuterieRepli = setTimeout(aller, 520); else aller();
  }
  // le fondu du bord droit disparaît quand vendredi est atteint
  function auBout() { const d = $('#app-grille'); $('.app-defile').classList.toggle('au-bout', d.scrollLeft + d.clientWidth >= d.scrollWidth - 2); }
  $('#app-grille').addEventListener('scroll', auBout, { passive: true });
  // Un clic (ou Entrée) sur une étape amène son texte sur la ligne de lecture : la page y défile, et le planning passe
  // directement à cette étape. Pendant ce défilement, la position ne décide plus ; elle reprend la main dès qu'il finit
  // ou que le lecteur défile lui-même.
  let modeManuel = false;                            // revue : ?etape=n fige le planning (posé au démarrage)
  let verrou = false, finVerrou = 0, premier = true;
  const lever = () => { if (!verrou) return; verrou = false; clearTimeout(finVerrou); etapeParDefilement(); };
  etapes.forEach((e) => e.querySelector('.etape-bouton').addEventListener('click', () => {
    const i = +e.dataset.etape;
    if (modeManuel || innerWidth < 1100) { allerEtape(i); return; }
    const y = scrollY + e.getBoundingClientRect().top - innerHeight * 0.5 + Math.max(48, innerHeight * 0.06);
    allerEtape(i);
    if (Math.abs(y - scrollY) < 2) return;
    verrou = true; clearTimeout(finVerrou); finVerrou = setTimeout(lever, 1600);
    scrollTo({ top: y, behavior: reduit() ? 'instant' : 'smooth' });
  }));
  addEventListener('scrollend', lever);
  ['wheel', 'touchstart'].forEach((t) => addEventListener(t, lever, { passive: true }));
  addEventListener('keydown', (ev) => { if (!ev.target.closest || !ev.target.closest('.etape-bouton')) lever(); });
  function etapeParDefilement() {
    if (innerWidth < 1100) return;
    const mid = innerHeight * 0.5, bande = Math.max(12, innerHeight * 0.02);
    const tops = etapes.map((e) => e.getBoundingClientRect().top);
    if (!modeManuel && !verrou) {
      let c = Math.max(0, plan.etape);
      while (c < etapes.length - 1 && tops[c + 1] < mid - bande) c++;
      while (c > 0 && tops[c] > mid + bande) c--;
      if (c !== plan.etape) {
        // au chargement au milieu de la section, ou fenêtre hors de l'écran : l'étape se pose sans passage
        const r = appPlan.getBoundingClientRect();
        allerEtape(c, { anime: !premier && r.bottom > 0 && r.top < innerHeight });
      }
    }
    premier = false;
    if (railNatif && !reduit()) return;
    const H = listeEtapes.offsetHeight || 1, c = Math.max(0, plan.etape);
    const v = reduit() ? (c >= etapes.length - 1 ? 1 : (tops[c + 1] - tops[0]) / H) : clamp((mid - tops[0]) / H);
    listeEtapes.style.setProperty('--rail', v.toFixed(4));
  }

  // ---------- Comment ça marche : le téléphone du chef de chantier ----------
  function fondTelephone() {
    // Fond d'écran : une carte de surface en traits fins (isobares autour d'une dépression hors champ, front froid à dents)
    const W = 320, H = 690;
    let d = '';
    for (let k = 0; k < 9; k++) {
      const r = 210 + k * 62, cx = -80, cy = 60;
      let p = '';
      for (let a = -10; a <= 100; a += 2) {
        const t = (a * Math.PI) / 180, w = 1 + 0.06 * Math.sin(3 * t + k);
        p += (a === -10 ? 'M' : 'L') + (cx + Math.cos(t) * r * w * 1.25).toFixed(1) + ' ' + (cy + Math.sin(t) * r * w).toFixed(1);
      }
      d += `<path d="${p}" fill="none" stroke="rgba(220,228,239,.16)" stroke-width="1"/>`;
    }
    const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${d}</svg>`;
    $('#tel-ecran').style.setProperty('--fond-tel', `url("data:image/svg+xml,${encodeURIComponent(svgTxt)}")`);
    const icone = A.logo.monogramme({ attrs: 'xmlns="http://www.w3.org/2000/svg"' });
    document.documentElement.style.setProperty('--icone-app', `url("data:image/svg+xml,${encodeURIComponent(icone)}")`);
  }
  // Arrivée du bulletin : sa place s'ouvre en ressort dans la pile (la notification de la veille reste en bas, la
  // nouvelle se pose au-dessus), la bannière se condense dedans, l'île respire. Transformation, opacité et hauteur
  // d'une enveloppe sans verre : le verre n'est pas recalculé pendant le mouvement.
  const VERRE_EASE = getComputedStyle(document.documentElement).getPropertyValue('--av-ease-verre').trim() || 'ease-out';
  function arriveeBulletin(apres = 0) {
    if (reduit()) return;
    const place = $('#notif-place'), n = $('#notif'), ile = $('#tel-ile');
    if (n.contains(document.activeElement)) { $('#tel').classList.remove('attente'); return; }   // le clavier y est déjà
    const h = n.offsetHeight;
    place.getAnimations().concat(n.getAnimations()).forEach((x) => x.cancel());
    place.style.overflow = 'visible';
    place.animate([{ height: '0px', marginBottom: '-8px' }, { height: h + 'px', marginBottom: '0px' }], { duration: 760, delay: 140 + apres, easing: VERRE_EASE, fill: 'backwards' });
    n.animate([{ opacity: 0, transform: 'translateY(-18px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 820, delay: 220 + apres, easing: VERRE_EASE, fill: 'backwards' });
    ile.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.16) scaleY(1.06)', offset: 0.4 }, { transform: 'scaleX(1)' }], { duration: 560, delay: apres, easing: 'cubic-bezier(.3,0,.2,1)' });
    $('#tel').classList.remove('attente');
  }
  // Le clavier n'attend pas une animation : si le focus entre dans la notification avant qu'elle soit posée (le focus fait
  // défiler la page, ce qui lance l'arrivée), elle se pose tout de suite et reste à l'écran (contre-revue, P0 : le focus
  // tombait sur des boutons à opacité 0, dans une place de hauteur nulle).
  $('#notif').addEventListener('focusin', (e) => {
    const attendait = $('#tel').classList.contains('attente');
    $('#tel').classList.remove('attente');
    const encours = $('#notif-place').getAnimations().concat($('#notif').getAnimations(), $('#tel-ile').getAnimations());
    if (attendait && !encours.length) e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    if (!encours.length) return;
    encours.forEach((x) => x.finish());
    e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  const retour = $('#tel-retour');
  function repondre(id, texte) {
    const b = $(id), autre = $(id === '#notif-ok' ? '#notif-pb' : '#notif-ok');
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); autre.setAttribute('aria-pressed', 'false');
    retour.textContent = on ? texte : ''; retour.classList.toggle('visible', on);
  }
  $('#notif-ok').addEventListener('click', () => repondre('#notif-ok', `Lu à 6${NB}h${NB}04${NB}: le bureau est prévenu.`));
  $('#notif-pb').addEventListener('click', () => repondre('#notif-pb', `Le conducteur de travaux vous rappelle.`));

  // ---------- Questions : l'ouverture est native (::details-content dans landing.css), plus de script ----------

  // ---------- Essai : validation, envoi, confirmation (rien ne part : la marque est une démonstration) ----------
  // États : repos ; erreur (le champ porte aria-invalid et la hachure de pluie, le message dit quoi corriger) ; envoi
  // (aria-busy, la pluie passe dans le carré de la flèche) ; succès (le bouton reste focalisable, aria-disabled).
  // Modifier un champ après une erreur ou un succès remet le formulaire au repos.
  const formEssai = $('#essai'), mail = $('#essai-mail'), envoi = $('.essai-envoi'), retourEssai = $('#essai-retour');
  const texteEnvoi = envoi.querySelector('.bouton-texte'), flecheEnvoi = envoi.querySelector('.bouton-fleche path');
  const FLECHE = flecheEnvoi.getAttribute('d'), COCHE = 'M3.5 8.4l3 3 6-6.8';
  const MAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
  let minuterieEssai = 0;
  function reposEssai() {
    clearTimeout(minuterieEssai);
    envoi.removeAttribute('aria-busy'); envoi.removeAttribute('aria-disabled'); envoi.classList.remove('fait'); flecheEnvoi.setAttribute('d', FLECHE); texteEnvoi.textContent = 'Essayer un mois';
    retourEssai.textContent = ''; retourEssai.classList.remove('erreur'); mail.removeAttribute('aria-invalid');
  }
  [mail, choixEssai].forEach((el) => el.addEventListener('input', () => {
    if (envoi.hasAttribute('aria-disabled') || mail.hasAttribute('aria-invalid')) reposEssai();
  }));
  formEssai.addEventListener('submit', (e) => {
    e.preventDefault();
    if (envoi.hasAttribute('aria-busy') || envoi.hasAttribute('aria-disabled')) return;
    const v = mail.value.trim();
    if (!MAIL.test(v)) {
      mail.setAttribute('aria-invalid', 'true');
      retourEssai.classList.add('erreur');
      retourEssai.textContent = v ? `Cette adresse est incomplète. Exemple${NB}: nom@entreprise.fr.` : 'Indiquez votre adresse e-mail pour recevoir le premier bulletin.';
      mail.focus();
      return;
    }
    const nom = VILLES.find((x) => x.id === choixEssai.value).nom;
    retourEssai.textContent = ''; retourEssai.classList.remove('erreur');
    envoi.setAttribute('aria-busy', 'true'); texteEnvoi.textContent = 'Envoi en cours';
    minuterieEssai = setTimeout(() => {
      envoi.removeAttribute('aria-busy'); envoi.setAttribute('aria-disabled', 'true'); envoi.classList.add('fait'); flecheEnvoi.setAttribute('d', COCHE); texteEnvoi.textContent = 'C’est noté';
      retourEssai.textContent = `Votre premier bulletin pour ${nom} arriverait demain à 6${NB}h. Rien n’est envoyé${NB}: Auvent est une démonstration.`;
    }, reduit() ? 300 : 1100);
  });

  // ---------- Pied : les liens d'une vraie marque ne mènent nulle part, et le disent ----------
  const notePied = $('#pied-note');
  $$('[data-nulle-part]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    notePied.textContent = `«${NB}${a.textContent.trim()}${NB}» n’existe pas${NB}: Auvent est une marque de démonstration.`;
    notePied.classList.add('visible');
  }));

  // ---------- Défilement : une seule boucle pour tout ce qui suit la lecture ----------
  let rafDefile = 0;
  function surDefilement() {
    cancelAnimationFrame(rafDefile);
    rafDefile = requestAnimationFrame(() => { contexte(); tete.classList.toggle('defile', scrollY > 40); sectionActive(); etapeParDefilement(); });
  }
  addEventListener('scroll', surDefilement, { passive: true });
  addEventListener('resize', () => { cotes(); releve(); surDefilement(); });

  // ---------- Démarrage ----------
  choisirVille(villeInit, false);
  fondTelephone();
  pluie();
  new ResizeObserver(() => cotes()).observe($('#objet'));
  addEventListener('load', () => cotes());   // sans l'événement en argument : il passait pour « anime » et coupait le compteur
  new ResizeObserver(() => releve()).observe($('#releve-graphe'));
  const etapeInit = q.has('etape') ? clamp(+q.get('etape'), 0, 3) : 0;
  if (q.has('etape')) modeManuel = true;
  allerEtape(etapeInit, { anime: false });
  ouvrirSurMercredi();
  A.verre.monter();
  surDefilement();
  // Entrées au premier passage : le météogramme, le téléphone. Avant d'entrer à l'écran, ils attendent vides.
  if (!reduit()) { $('#releve-graphe').classList.add('attente'); $('#tel').classList.add('attente'); }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target.id === 'releve' && !releveVu) { releveVu = true; entreeReleve(); }
    // le bulletin arrive quand le graphique a fini de dire pourquoi (s'il est en train de le dire)
    if (e.target.id === 'tel') arriveeBulletin(Math.max(0, releveT0 + RELEVE_DUREE - performance.now()));
  }), { threshold: 0.35 });
  io.observe($('#releve')); io.observe($('#tel'));
  document.fonts && document.fonts.ready.then(() => { cotes(); releve(); A.verre.monter(); });
})();
