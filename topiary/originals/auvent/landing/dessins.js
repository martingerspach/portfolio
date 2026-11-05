/* Auvent · dessins au trait (script classique, expose window.Auvent.dessins).
   Des élévations et des coupes de chantier tracées par le code, comme un plan d'exécution :
   - deux épaisseurs de trait, le trait fort (1,25 px) pour les contours, le trait fin (0,75 px, atténué) pour les treillis,
     hachures et détails ; les cachés en tirets ; tout à extrémités rondes ;
   - la météo est dans le bleu du signal, à part : la pluie tombe à 19,5° de la verticale (le vent d'ouest, le même angle
     que la pente du logotype), le vent passe en lignes de courant ;
   - ce qui bouge est séparé en calques (pluie, vent, charge suspendue) et animé en CSS, à l'arrêt en mouvements réduits.
   La viewBox est en pixels d'affichage et le trait ne se met pas à l'échelle (vector-effect). */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const f = (v) => +v.toFixed(2);
  const P = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L');
  const ligne = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  const cercle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;
  const PLUIE = (19.5 * Math.PI) / 180, SX = Math.sin(PLUIE), SY = Math.cos(PLUIE);
  let uid = 0;

  // Treillis en N : membrures a(t), b(t) pour t ∈ [0, 1], n panneaux ; montants et diagonales alternées
  function treillisN(a, b, n, montants = true) {
    let d = '';
    for (let i = 0; i <= n; i++) if (montants) d += ligne(a(i / n), b(i / n));
    for (let i = 0; i < n; i++) d += i % 2 ? ligne(a(i / n), b((i + 1) / n)) : ligne(b(i / n), a((i + 1) / n));
    return d;
  }
  // Treillis Warren (sans montants)
  function warren(a, b, n) {
    const pts = []; for (let i = 0; i <= n; i++) pts.push(i % 2 ? b(i / n) : a(i / n));
    return P(pts);
  }
  // Hachure du béton coupé (45°, pas p), contenue dans le rectangle
  function hachure45(x, y, w, h, p = 5) {
    let d = '';
    for (let k = -h; k < w; k += p) {
      let x0 = x + k, y0 = y + h, x1 = x + k + h, y1 = y;
      if (x0 < x) { y0 -= x - x0; x0 = x; }
      if (x1 > x + w) { y1 += x1 - (x + w); x1 = x + w; }
      if (x1 - x0 > 0.6) d += ligne([x0, y0], [x1, y1]);
    }
    return d;
  }
  // Crochet de levage sous une moufle, axe x : col courbe, gorge sous l'axe, bec qui remonte (rayon r)
  const crochet = (x, y, r = 5) =>
    `M${x} ${y}C${x} ${y + 3} ${x + r} ${y + 3.6} ${x + r} ${y + 7}V${f(y + 9 + r * 0.2)}A${r} ${r} 0 0 1 ${x} ${f(y + 9 + r * 1.2)}A${r} ${r} 0 0 1 ${x - r} ${f(y + 9 + r * 0.2)}V${f(y + 7 + r * 0.2)}`;

  // Pluie : des lignes à 19,5° qui couvrent la zone, en tirets qui défilent (une phase et une vitesse par ligne)
  function pluie(w, h, pas = 11, masque = '') {
    let s = '', seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = -h * Math.tan(PLUIE) - 4; x < w + 4; x += pas) {
      const x0 = x + rnd() * 3, L = (h + 24) / SY;
      // phase, vitesse et longueur de goutte propres à chaque ligne (motif de 32 px : la goutte et son vide)
      const p = (rnd() * 32).toFixed(1), v = (0.58 + rnd() * 0.3).toFixed(2), g = (5 + rnd() * 6).toFixed(1);
      s += `<path class="d-goutte" style="--p:${p}px;--v:${v}s;--g:${g}px" d="${ligne([x0, -12], [x0 + SX * L, -12 + SY * L])}"/>`;
    }
    return `<g class="d-pluie"${masque ? ` mask="url(#${masque})"` : ''}>${s}</g>`;
  }
  // Lignes de courant du vent (tirets qui défilent vers l'est)
  function vent(lignes) {
    return `<g class="d-vent">${lignes.map((d, i) => `<path class="d-courant" style="--p:${(i * 17) % 40}px;--v:${(1.5 + i * 0.25).toFixed(2)}s" d="${d}"/>`).join('')}</g>`;
  }

  function svg(w, h, couches, classe = '', defs = '') {
    return `<svg class="dessin ${classe}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">` +
      (defs ? `<defs>${defs}</defs>` : '') + couches + '</svg>';
  }
  const fort = (d) => (d ? `<path class="d-fort" d="${d}"/>` : '');
  const fin = (d) => (d ? `<path class="d-fin" d="${d}"/>` : '');
  const cache = (d) => (d ? `<path class="d-cache" d="${d}"/>` : '');

  // ---------- Benne à béton à manchette, sous le crochet de la grue, au-dessus d'une dalle coffrée (150 × 200) ----------
  // Axe x 78. Corps cylindrique de 56 px (x 50 à 106), trémie conique jusqu'à la sortie de 16 px, manchette souple, levier ;
  // élingue à deux brins sur les tourillons ; niveau du béton en trait caché. La pluie passe derrière la benne.
  function benne(o = {}) {
    const id = 'av-m' + ++uid;
    let F = '', fn = '', c = '';
    F += ligne([78, -2], [78, 16]);                                         // câble
    F += rect(71, 16, 14, 17);                                             // moufle
    fn += cercle(78, 23.5, 4.5) + cercle(78, 23.5, 1);                     // réa et axe
    F += crochet(78, 33, 5);                                               // crochet : gorge à y 48
    fn += cercle(78, 50.2, 2.2);                                           // anneau d'élingue
    fn += ligne([76.6, 52], [47.5, 90.4]) + ligne([79.4, 52], [108.5, 90.4]);   // brins d'élingue
    F += rect(44, 88, 6, 8) + rect(106, 88, 6, 8);                         // supports des tourillons
    fn += cercle(47, 92, 1.6) + cercle(109, 92, 1.6);                      // tourillons
    F += ligne([47, 76], [109, 76]) + ligne([50, 79.5], [106, 79.5]);      // lèvre du bord
    F += ligne([47, 76], [50, 79.5]) + ligne([109, 76], [106, 79.5]);
    F += ligne([50, 79.5], [50, 118]) + ligne([106, 79.5], [106, 118]);    // virole
    fn += ligne([50, 101], [106, 101]);                                    // cerclage
    F += P([[50, 118], [71, 150], [85, 150], [106, 118]]) + ligne([50, 118], [106, 118]);   // trémie
    c += ligne([51.5, 88], [104.5, 88]);                                   // niveau du béton (caché)
    F += rect(70, 150, 16, 4);                                             // collier de sortie
    F += 'M71.5 154C71.1 161 70.7 168 71 176M84.5 154C84.9 161 85.3 168 85 176' + ligne([71, 176], [85, 176]);   // manchette
    fn += ligne([71.3, 160], [84.7, 160]) + ligne([71, 166], [85, 166]) + ligne([71, 171.5], [85, 171.5]);   // plis
    F += ligne([86, 152], [103, 161]); fn += cercle(104.6, 161.8, 1.8);    // levier et poignée
    // dalle coffrée : peau du coffrage, rive, aciers en coupe (pas de 10 px)
    F += ligne([8, 186], [150, 186]) + ligne([8, 180], [8, 200]);
    fn += ligne([8, 192], [150, 192]);
    for (let x = 16; x <= 146; x += 10) fn += cercle(x, 189, 1.15);
    // masque : la benne, sa moufle et la dalle cachent la pluie qui passe derrière
    const silhouette = `${P([[46, 75], [110, 75], [110, 97], [107, 118], [86, 151], [86, 177], [70, 177], [70, 151], [49, 118], [43, 97]])}Z${rect(70, 15, 16, 19)}${rect(0, 185, 150, 20)}`;
    const defs = `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="150" height="200"><rect width="150" height="200" fill="#fff"/><path d="${silhouette}" fill="#000" stroke="#000" stroke-width="5"/></mask>`;
    return svg(150, 200, (o.pluie ? pluie(150, 200, 14, id) : '') + cache(c) + fin(fn) + fort(F), 'dessin-benne', defs);
  }

  // ---------- Grue à tour, élévation, une prédalle au crochet (150 × 200) ----------
  // Mât de 16 px en neuf panneaux de 14 px (treillis en N), flèche en treillis Warren, contre-flèche lestée, porte-flèche et
  // tirants, anémomètre en tête : la grue mesure son vent. La charge (moufle, crochet, élingues, prédalle et ses raidisseurs)
  // est un calque qui se balance autour du chariot.
  function grue(o = {}) {
    let F = '', fn = '', ch = '', chf = '';
    F += ligne([0, 200], [150, 200]) + rect(56, 188, 36, 12); fn += ligne([68, 188], [68, 200]) + ligne([80, 188], [80, 200]);   // sol, lest
    F += ligne([66, 188], [66, 62]) + ligne([82, 188], [82, 62]);                                                               // mât
    fn += treillisN((t) => [66, 188 - 126 * t], (t) => [82, 188 - 126 * t], 9);
    F += rect(63, 56, 22, 6);                                                                                                    // couronne
    F += rect(85, 48.5, 10, 11.5); fn += ligne([86.5, 50.5], [93.5, 50.5]) + ligne([93.5, 50.5], [93.5, 55.5]);               // cabine
    // flèche : membrure basse y 56 (x 85 à 148), membrure haute de (85, 49) à (148, 53)
    const fb = (t) => [85 + 63 * t, 56], fh = (t) => [85 + 63 * t, 49 + 4 * t];
    F += ligne(fb(0), fb(1)) + ligne(fh(0), fh(1)) + ligne(fh(1), fb(1));
    fn += warren(fb, fh, 18);
    // contre-flèche : de x 63 à 18, membrures y 56 et 51 ; contrepoids en trois dalles
    F += ligne([63, 56], [18, 56]) + ligne([66, 51], [18, 51]) + ligne([18, 51], [18, 56]);
    fn += warren((t) => [63 - 45 * t, 56], (t) => [63 - 45 * t, 51], 12);
    F += rect(18, 56, 13, 4) + rect(18, 60, 13, 4) + rect(18, 64, 13, 4);
    // porte-flèche et tirants
    F += ligne([69, 51], [74, 26]) + ligne([79, 51], [74, 26]); fn += ligne([71.4, 39], [76.6, 39]);
    fn += ligne([74, 26], [124, 50.5]) + ligne([74, 26], [19, 51]);
    // anémomètre en tête : mât, bras, deux coupelles ouvertes dans le même sens de rotation
    fn += ligne([74, 26], [74, 18]) + ligne([68.5, 18], [79.5, 18]);
    F += 'M68.5 16a2 2 0 0 0 0 4M79.5 16a2 2 0 0 1 0 4';
    // chariot ; la charge pend sous le chariot (pivot du balancement : x 125, y 59)
    F += rect(120, 56, 10, 3);
    chf += ligne([123.5, 59], [123.5, 112]) + ligne([126.5, 59], [126.5, 112]);
    ch += rect(120, 112, 10, 8) + crochet(125, 120, 4);
    chf += cercle(125, 133.6, 1.6) + ligne([124, 135], [103, 150]) + ligne([126, 135], [147, 150]);
    ch += rect(101, 150, 48, 4);                                                                    // prédalle
    const rai = []; for (let i = 0; i <= 14; i++) rai.push([103 + i * 3, i % 2 ? 146.5 : 150]);
    chf += P(rai);                                                                                  // raidisseurs en treillis
    const charge = `<g class="d-charge">${fin(chf)}${fort(ch)}</g>`;
    const courants = o.vent ? vent([
      'M10 92C22 88 34 96 48 91S59 86 62 87',
      'M14 109C25 105 36 113 50 108S59 103 62 104',
      'M10 126C21 123 32 130 46 125S57 121 62 122',
    ]) : '';
    return svg(150, 200, courants + fin(fn) + fort(F) + charge, 'dessin-grue');
  }

  // ---------- Cloison sur ossature, en coupe entre deux dalles (150 × 200) ----------
  // Dalles hachurées (béton coupé), rails, montants tous les 28 px (60 cm), une plaque de 56 px (1,20 m) vissée, laine
  // minérale (symbole conventionnel) dans les travées ouvertes. Dehors, la pluie frappe la dalle haute et s'arrête là.
  function cloison(o = {}) {
    const id = 'av-m' + ++uid;
    let F = '', fn = '';
    F += ligne([0, 26], [150, 26]) + ligne([0, 38], [150, 38]); fn += hachure45(0, 26, 150, 12);         // dalle haute
    F += ligne([0, 176], [150, 176]) + ligne([0, 188], [150, 188]); fn += hachure45(0, 176, 150, 12);   // dalle basse
    F += 'M18 38V42.5H134V38M18 176V171.5H134V176';                                                     // rails
    for (const x of [20, 48, 76, 104, 129]) fn += ligne([x, 42.5], [x, 171.5]) + ligne([x + 3, 42.5], [x + 3, 171.5]);   // montants
    F += rect(20, 44, 56, 126);                                                                         // plaque posée
    for (const x of [21.5, 49.5, 74.5]) for (let y = 52; y < 168; y += 14) fn += `M${f(x - 1.4)} ${f(y - 1.4)}l2.8 2.8M${f(x + 1.4)} ${f(y - 1.4)}l-2.8 2.8`;   // vis
    // laine minérale : boucles alternées dans chaque travée ouverte
    for (const [x0, x1] of [[79, 104], [107, 129]]) {
      let d = `M${x0 + 1} 45`;
      for (let y = 45; y < 168; y += 10) d += `C${x1 + 2} ${y + 1} ${x1 + 2} ${y + 9} ${(x0 + x1) / 2} ${y + 5}S${x0 - 2} ${y + 9} ${x0 + 1} ${y + 10}`;
      fn += d;
    }
    let impacts = '';
    for (const x of [14, 46, 79, 112, 140]) impacts += `M${x - 3} 24l2 -2.4M${x + 3} 24l-2 -2.4`;   // impacts sur la dalle haute
    const defs = `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="150" height="200"><rect width="150" height="24.5" fill="#fff"/></mask>`;
    return svg(150, 200, (o.pluie ? pluie(150, 200, 14, id) + `<path class="d-impact" d="${impacts}"/>` : '') + fin(fn) + fort(F), 'dessin-cloison', defs);
  }

  // ---------- Icônes des seuils (64 × 64), même grammaire de traits ----------
  const icone = (F, fn = '') => svg(64, 64, fin(fn) + fort(F), 'icone');
  function iconeGrue() {
    let F = '', fn = '';
    F += ligne([20, 62], [44, 62]) + ligne([28, 62], [28, 22]) + ligne([36, 62], [36, 22]);
    fn += treillisN((t) => [28, 62 - 40 * t], (t) => [36, 62 - 40 * t], 5);
    F += ligne([36, 22], [62, 22]) + ligne([36, 18], [62, 21]) + ligne([62, 21], [62, 22]);
    fn += warren((t) => [36 + 26 * t, 22], (t) => [36 + 26 * t, 18 + 3 * t], 8);
    F += ligne([28, 22], [8, 22]) + rect(8, 22, 7, 6);
    F += ligne([29.5, 19], [32, 6]) + ligne([34.5, 19], [32, 6]);
    fn += ligne([32, 6], [54, 20.3]) + ligne([32, 6], [10, 22]) + ligne([32, 6], [32, 2]);
    fn += ligne([51, 22], [51, 40]); F += crochet(51, 40, 2.6);
    return icone(F, fn);
  }
  function iconeNacelle() {
    let F = '', fn = '';
    F += rect(6, 48, 34, 8) + cercle(13, 59, 3.5) + cercle(33, 59, 3.5);
    F += rect(15, 42, 12, 6);
    F += ligne([19, 44], [45, 16]) + ligne([23, 46], [48.6, 18.4]);
    fn += ligne([31, 31.5], [35, 35.2]);
    F += rect(44, 11, 15, 7); fn += ligne([44, 5], [59, 5]) + ligne([44, 5], [44, 11]) + ligne([59, 5], [59, 11]) + ligne([51.5, 5], [51.5, 11]);
    return icone(F, fn);
  }
  function iconeThermometre() {
    let F = '', fn = '';
    F += 'M27 43V9a5 5 0 0 1 10 0v34' + 'M27 43a8.5 8.5 0 1 0 10 0';
    fn += ligne([32, 47], [32, 24]) + cercle(32, 50.5, 3.6);
    for (const [y, l] of [[12, 5], [18, 3], [24, 5], [30, 3], [36, 5]]) fn += ligne([40, y], [40 + l, y]);
    return icone(F, fn);
  }
  function iconeEnduit() {
    let F = '', fn = '';
    F += rect(4, 6, 30, 52);
    for (let y = 14; y < 58; y += 8) fn += ligne([4, y], [34, y]);
    for (let y = 6, i = 0; y < 58; y += 8, i++) fn += ligne([i % 2 ? 14 : 24, y], [i % 2 ? 14 : 24, Math.min(58, y + 8)]);
    F += rect(34, 6, 8, 52);
    F += rect(40, 30, 20, 5) + ligne([50, 30], [50, 24]) + ligne([45, 24], [55, 24]);
    return icone(F, fn);
  }

  A.dessins = { grue, benne, cloison, iconeGrue, iconeNacelle, iconeThermometre, iconeEnduit, svg, ligne, rect, cercle, P };
})();
