/* Auvent · carte synoptique (script classique, expose window.Auvent.carte)
   - Contour de la France métropolitaine, généralisé à la main à partir de points côtiers et frontaliers connus
     (≈ 190 points, précision de l'ordre de 5 à 10 km : celle d'une carte du temps, pas d'un plan).
   - Projection conique conforme de Lambert, parallèles 44° et 49°, origine 46,5° N 3° E (celle de Lambert-93), sphère de 6 371 km.
   - Une situation météo fictive mais plausible : dépression qui passe au large de l'Irlande, front froid qui traverse
     la France d'ouest en est en 72 heures, front chaud au nord, occlusion près du centre de la dépression.
     Toutes les données des démos (pluie, rafales par ville et par heure) sortent de ce même modèle : elles restent
     cohérentes entre la carte, le planning et le téléphone. Ce sont des données de démonstration, pas une prévision. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const R = 6371, D2R = Math.PI / 180;
  const p1 = 44 * D2R, p2 = 49 * D2R, p0 = 46.5 * D2R, l0 = 3 * D2R;
  const t = (p) => Math.tan(Math.PI / 4 + p / 2);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1));
  const F = (Math.cos(p1) * Math.pow(t(p1), n)) / n;
  const rho = (p) => (R * F) / Math.pow(t(p), n);
  const rho0 = rho(p0);
  function project(lat, lon) {
    const r = rho(lat * D2R), th = n * (lon * D2R - l0);
    return [r * Math.sin(th), rho0 - r * Math.cos(th)];
  }

  // [lat, lon], dans le sens des aiguilles d'une montre depuis la frontière belge sur la mer du Nord.
  const FRANCE = [
    [51.08, 2.54], [51.04, 2.37], [51.0, 2.12], [50.96, 1.85], [50.87, 1.58], [50.72, 1.6], [50.52, 1.59], [50.4, 1.56],
    [50.24, 1.6], [50.18, 1.5], [50.06, 1.37], [49.93, 1.08], [49.87, 0.71], [49.76, 0.37], [49.71, 0.2], [49.51, 0.07],
    [49.44, 0.2], [49.37, 0.08], [49.29, -0.12], [49.28, -0.25], [49.33, -0.46], [49.34, -0.62], [49.39, -1.05], [49.32, -1.12],
    [49.42, -1.18], [49.59, -1.27], [49.67, -1.26], [49.65, -1.62], [49.72, -1.94], [49.53, -1.88], [49.37, -1.79], [49.04, -1.6],
    [48.84, -1.6], [48.65, -1.5], [48.68, -1.85], [48.65, -2.03], [48.68, -2.32], [48.53, -2.75], [48.78, -3.05], [48.82, -3.45],
    [48.69, -3.65], [48.73, -3.98], [48.67, -4.33], [48.6, -4.56], [48.45, -4.78], [48.35, -4.77], [48.3, -4.55], [48.25, -4.62],
    [48.1, -4.33], [48.04, -4.74], [48.02, -4.54], [47.8, -4.37], [47.87, -4.1], [47.87, -3.92], [47.73, -3.37], [47.48, -3.12],
    [47.58, -3.07], [47.55, -2.85], [47.48, -2.48], [47.29, -2.53], [47.27, -2.2], [47.11, -2.1], [46.98, -2.03], [46.78, -2.07],
    [46.69, -1.94], [46.5, -1.79], [46.34, -1.44], [46.3, -1.25], [46.16, -1.15], [45.99, -1.1], [45.82, -1.15], [45.69, -1.24],
    [45.62, -1.03], [45.57, -1.07], [45.51, -1.13], [45.2, -1.17], [45.0, -1.2], [44.63, -1.25], [44.58, -1.21], [44.44, -1.25],
    [44.2, -1.3], [43.79, -1.4], [43.64, -1.45], [43.52, -1.53], [43.48, -1.56], [43.39, -1.66], [43.37, -1.78],
    // Pyrénées
    [43.3, -1.62], [43.25, -1.4], [43.05, -1.3], [42.95, -0.95], [42.8, -0.55], [42.72, -0.05], [42.69, 0.3], [42.82, 0.68],
    [42.85, 0.95], [42.7, 1.2], [42.65, 1.45], [42.5, 1.75], [42.45, 2.0], [42.4, 2.3], [42.46, 2.86], [42.43, 3.17],
    // Méditerranée
    [42.53, 3.09], [42.7, 3.04], [42.91, 3.05], [43.1, 3.12], [43.24, 3.3], [43.28, 3.51], [43.4, 3.7], [43.53, 3.93],
    [43.53, 4.14], [43.45, 4.43], [43.36, 4.58], [43.38, 4.83], [43.33, 5.04], [43.3, 5.36], [43.21, 5.54], [43.17, 5.61],
    [43.13, 5.75], [43.05, 5.86], [43.03, 6.13], [43.13, 6.37], [43.2, 6.68], [43.27, 6.64], [43.42, 6.77], [43.5, 6.94],
    [43.55, 7.02], [43.56, 7.13], [43.69, 7.27], [43.73, 7.42], [43.78, 7.51],
    // Alpes
    [43.87, 7.56], [44.05, 7.7], [44.15, 7.6], [44.2, 7.25], [44.38, 6.92], [44.6, 6.95], [44.8, 7.0], [44.93, 6.75],
    [45.1, 6.68], [45.25, 6.95], [45.45, 7.1], [45.68, 6.88], [45.83, 6.85], [45.95, 7.02], [46.1, 6.88], [46.4, 6.8],
    // Léman, Genève, Jura
    [46.4, 6.48], [46.32, 6.25], [46.25, 6.12], [46.13, 5.97], [46.28, 6.0], [46.42, 6.08], [46.6, 6.25], [46.75, 6.45],
    [46.92, 6.6], [47.05, 6.72], [47.17, 6.95], [47.3, 7.0], [47.43, 6.95], [47.5, 7.08], [47.48, 7.3], [47.58, 7.58],
    // Rhin
    [47.8, 7.55], [48.1, 7.58], [48.35, 7.75], [48.58, 7.8], [48.8, 8.08], [48.97, 8.23],
    // Allemagne, Luxembourg, Belgique
    [49.05, 7.95], [49.12, 7.6], [49.1, 7.38], [49.15, 7.07], [49.22, 6.85], [49.35, 6.65], [49.47, 6.37], [49.52, 6.0],
    [49.55, 5.8], [49.52, 5.47], [49.7, 5.2], [49.8, 4.98], [49.95, 4.85], [50.15, 4.85], [50.1, 4.7], [49.97, 4.45],
    [50.02, 4.2], [50.18, 4.15], [50.32, 3.97], [50.45, 3.7], [50.5, 3.45], [50.58, 3.28], [50.76, 3.15], [50.72, 2.92],
    [50.82, 2.62], [50.95, 2.6],
  ];
  const CORSE = [
    [43.01, 9.42], [42.7, 9.45], [42.38, 9.53], [42.1, 9.52], [41.86, 9.4], [41.59, 9.28], [41.39, 9.16], [41.5, 8.93],
    [41.67, 8.9], [41.92, 8.73], [41.95, 8.6], [42.13, 8.59], [42.27, 8.69], [42.41, 8.65], [42.57, 8.76], [42.64, 8.94],
    [42.68, 9.3], [42.97, 9.35],
  ];
  // Villes proposées sur la landing : préfectures de région et grands bassins de chantiers.
  const VILLES = [
    { id: 'lille', nom: 'Lille', lat: 50.63, lon: 3.06 },
    { id: 'rouen', nom: 'Rouen', lat: 49.44, lon: 1.1 },
    { id: 'paris', nom: 'Paris', lat: 48.86, lon: 2.35 },
    { id: 'reims', nom: 'Reims', lat: 49.26, lon: 4.03 },
    { id: 'metz', nom: 'Metz', lat: 49.12, lon: 6.18 },
    { id: 'strasbourg', nom: 'Strasbourg', lat: 48.57, lon: 7.75 },
    { id: 'brest', nom: 'Brest', lat: 48.39, lon: -4.49 },
    { id: 'rennes', nom: 'Rennes', lat: 48.11, lon: -1.68 },
    { id: 'caen', nom: 'Caen', lat: 49.18, lon: -0.37 },
    { id: 'nantes', nom: 'Nantes', lat: 47.22, lon: -1.55 },
    { id: 'tours', nom: 'Tours', lat: 47.39, lon: 0.69 },
    { id: 'orleans', nom: 'Orléans', lat: 47.9, lon: 1.91 },
    { id: 'dijon', nom: 'Dijon', lat: 47.32, lon: 5.04 },
    { id: 'bordeaux', nom: 'Bordeaux', lat: 44.84, lon: -0.58 },
    { id: 'limoges', nom: 'Limoges', lat: 45.83, lon: 1.26 },
    { id: 'clermont', nom: 'Clermont-Ferrand', lat: 45.78, lon: 3.08 },
    { id: 'lyon', nom: 'Lyon', lat: 45.76, lon: 4.84 },
    { id: 'grenoble', nom: 'Grenoble', lat: 45.19, lon: 5.72 },
    { id: 'toulouse', nom: 'Toulouse', lat: 43.6, lon: 1.44 },
    { id: 'montpellier', nom: 'Montpellier', lat: 43.61, lon: 3.88 },
    { id: 'marseille', nom: 'Marseille', lat: 43.3, lon: 5.37 },
    { id: 'nice', nom: 'Nice', lat: 43.7, lon: 7.27 },
  ].map((v) => ({ ...v, xy: project(v.lat, v.lon) }));

  // ---------- La situation : t en heures depuis « maintenant » (mardi 6 h), de 0 à 96 ----------
  // DECALAGE : le système a 4 h de retard sur son horaire de référence ; le front passe à Nantes mercredi entre 8 h et 15 h.
  const DECALAGE = 4;
  // Centre de la dépression (km, repère Lambert) : du large de l'Irlande vers la mer du Nord.
  function low(tt) {
    const k = (tt - DECALAGE) / 96;
    return [-980 + 1150 * k, 820 + 160 * k - 60 * k * k];
  }
  // Point triple (occlusion, front chaud, front froid), en avance sur le centre, au sud-est.
  function triple(tt) {
    const [lx, ly] = low(tt), k = (tt - DECALAGE) / 96;
    return [lx + 330 + 140 * k, ly - 230 - 60 * k];
  }
  // Le front froid s'enroule autour de la dépression : sa base, au sud, avance plus vite que le point triple tant
  // qu'elle est loin, puis le front se redresse. Points du nord au sud.
  function froid(tt) {
    const [tx, ty] = triple(tt), k = (tt - DECALAGE) / 96, pts = [];
    for (let i = 0; i <= 14; i++) {
      const s = i / 14; // 0 au point triple, 1 à la base (≈ 1 300 km au sud)
      const lag = 360 * s * s * (1 - 0.55 * k) - 30 * s;
      pts.push([tx - 120 * s - lag + 90 * Math.sin(s * 3.1) * (0.6 + 0.4 * k), ty - 1300 * s]);
    }
    return pts;
  }
  function chaud(tt) {
    const [tx, ty] = triple(tt), pts = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      pts.push([tx + 520 * s, ty - 260 * s - 120 * s * s]);
    }
    return pts;
  }
  function occlus(tt) {
    const [lx, ly] = low(tt), [tx, ty] = triple(tt), pts = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8, a = (-0.2 + 0.95 * s) * Math.PI; // spirale autour du centre
      const r = 60 + 180 * s;
      const sx = lx + r * Math.cos(-a + 0.35), sy = ly + r * Math.sin(-a + 0.35) * 0.9;
      pts.push([sx + (tx - sx) * s * s, sy + (ty - sy) * s * s]);
    }
    return pts;
  }

  // Les fronts ne dépendent que de l'heure : on garde le dernier calcul (des milliers d'échantillons par image
  // demandent le même front ; le recalculer à chaque point coûtait 8 ms par image).
  const memo = (f) => { let k = NaN, v; return (tt) => (tt === k ? v : ((k = tt), (v = f(tt)))); };
  const froidM = memo(froid), chaudM = memo(chaud), occlusM = memo(occlus);

  // Distance d'un point à une polyligne, et côté (positif à l'est/en avant du front).
  const longueurs = new WeakMap();
  function distPoly(x, y, pts) {
    let best = Infinity, side = 1, along = 0, acc = 0, total = longueurs.get(pts);
    if (total === undefined) { total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); longueurs.set(pts, total); }
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
      let u = ((x - ax) * dx + (y - ay) * dy) / L2; u = Math.max(0, Math.min(1, u));
      const px = ax + u * dx, py = ay + u * dy, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; side = Math.sign(dx * (y - ay) - dy * (x - ax)) || 1; along = (acc + u * L) / total; }
      acc += L;
    }
    return { d: best, side: -side, along };
  }

  // Pression au niveau de la mer (hPa) : dépression, anticyclone des Açores vers la Méditerranée, talweg le long du front froid.
  function pression(x, y, tt) {
    const [lx, ly] = low(tt);
    const dl2 = (x - lx) ** 2 + (y - ly) ** 2;
    let p = 1017 - 27 * Math.exp(-dl2 / (2 * 560 ** 2)) + 9 * Math.exp(-((x - 300) ** 2 + (y + 950) ** 2) / (2 * 700 ** 2));
    p += 0.0045 * (y - 300) * 0; // pas de pente régionale : laissée à zéro, gardée pour réglage
    const f = distPoly(x, y, froidM(tt));
    p -= 5.5 * Math.exp(-(f.d * f.d) / (2 * 48 ** 2)) * (1 - 0.55 * f.along);
    return p;
  }

  // Pluie (mm/h) : bande étroite le long du front froid, plus large en avant du front chaud. Pluie de démonstration.
  function pluie(x, y, tt) {
    const f = distPoly(x, y, froidM(tt));
    // avant le front (côté est) : 70 km d'averses ; derrière : 40 km
    const w = f.side > 0 ? 46 : 26;
    let mm = 3.2 * Math.exp(-(f.d * f.d) / (2 * w * w)) * (1 - 0.75 * f.along);
    const c = distPoly(x, y, chaudM(tt));
    if (c.side > 0) mm += 0.9 * Math.exp(-(c.d * c.d) / (2 * 95 ** 2)) * (1 - 0.7 * c.along);
    return Math.max(0, mm);
  }
  // Rafales (km/h) : fortes près de la dépression et au passage du front froid.
  function rafales(x, y, tt) {
    const [lx, ly] = low(tt);
    const dl = Math.hypot(x - lx, y - ly);
    const f = distPoly(x, y, froidM(tt));
    // la dépression se comble en s'éloignant : le vent de fond retombe après le passage du front
    const comble = 1 - 0.55 * Math.min(1, Math.max(0, (tt - DECALAGE) / 96));
    let g = 22 + 34 * comble * Math.exp(-((dl - 380) ** 2) / (2 * 300 ** 2));
    g += 32 * Math.exp(-(f.d * f.d) / (2 * 90 ** 2)) * (1 - 0.5 * f.along);
    return g;
  }
  function temperature(x, y, tt) {
    // Matin plus froid, après-midi plus doux, air plus frais derrière le front froid.
    const hour = (6 + tt) % 24;
    const diurne = -3.2 * Math.cos(((hour - 4) / 24) * 2 * Math.PI);
    const f = distPoly(x, y, froidM(tt));
    // mi-octobre : matins de 7 à 11 °C, après-midi de 13 à 17 °C ; plus frais au nord et derrière le front
    const base = 15 - 0.012 * y + (f.side < 0 ? -3.5 * Math.min(1, f.d / 200) : 0);
    return base + diurne;
  }

  // Série horaire pour un point (ville ou chantier) : pluie, rafales, température, et un faisceau de 16 membres
  // (prévision d'ensemble simulée : chaque membre décale le front de quelques heures et module l'intensité).
  function serie(xy, heures = 96) {
    const [x, y] = xy, out = [];
    for (let h = 0; h <= heures; h++) out.push({ h, pluie: pluie(x, y, h), rafales: rafales(x, y, h), temp: temperature(x, y, h) });
    return out;
  }
  function membres(xy, heures = 96, nb = 16, graine = 7) {
    let s = (Math.abs(graine) % 2147483646) + 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const [x, y] = xy, res = [];
    for (let m = 0; m < nb; m++) {
      const dt = (rnd() - 0.5) * 2;           // décalage de phase de base
      const spread = 0.11;                    // dispersion qui croît avec l'échéance
      const amp = 0.7 + rnd() * 0.6;
      const row = [];
      for (let h = 0; h <= heures; h++) {
        const shift = dt * (1 + spread * h);
        row.push({ h, pluie: pluie(x, y, Math.max(0, h + shift)) * amp, rafales: rafales(x, y, Math.max(0, h + shift)) * (0.9 + 0.2 * amp) });
      }
      res.push(row);
    }
    return res;
  }

  // ---------- Isobares : marching squares sur une grille, segments raccordés en lignes, lissés ----------
  // Point dans un polygone (lat, lon) : sert à choisir le fond des étiquettes
  function surTerre(x, y) {
    for (const poly of [FRANCE, CORSE]) {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = project(poly[i][0], poly[i][1]), [xj, yj] = project(poly[j][0], poly[j][1]);
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
      }
      if (ins) return true;
    }
    return false;
  }
  function isobares(tt, vb, pas = 4, res = 26) {
    const [x0, y0, x1, y1] = vb; // y0 < y1, en km
    const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
    const g = new Float32Array(nx * ny);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = pression(x0 + i * res, y0 + j * res, tt); g[j * nx + i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    const levels = [];
    for (let L = Math.ceil(mn / pas) * pas; L <= mx; L += pas) levels.push(L);
    return levels.map((L) => ({ niveau: L, lignes: contour(g, nx, ny, L, x0, y0, res) }));
  }
  function contour(g, nx, ny, L, x0, y0, res) {
    const segs = [];
    const P = (i, j) => g[j * nx + i];
    const lerp = (a, b, va, vb) => a + ((L - va) / (vb - va)) * (b - a);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      const idx = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const X = x0 + i * res, Y = y0 + j * res;
      const e = {
        b: [lerp(X, X + res, a, b), Y], r: [X + res, lerp(Y, Y + res, b, c)],
        t: [lerp(X, X + res, d, c), Y + res], l: [X, lerp(Y, Y + res, a, d)],
      };
      const T = {
        1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['r', 't'], 5: ['l', 't', 'b', 'r'], 6: ['b', 't'], 7: ['l', 't'],
        8: ['t', 'l'], 9: ['t', 'b'], 10: ['b', 'l', 't', 'r'], 11: ['t', 'r'], 12: ['r', 'l'], 13: ['r', 'b'], 14: ['b', 'l'],
      }[idx];
      for (let k = 0; k < T.length; k += 2) segs.push([e[T[k]], e[T[k + 1]]]);
    }
    // raccord des segments en polylignes
    const key = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10);
    const map = new Map();
    segs.forEach((s, i) => { for (const p of s) { const k = key(p); (map.get(k) || map.set(k, []).get(k)).push(i); } });
    const used = new Uint8Array(segs.length), lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1; const line = [segs[i][0], segs[i][1]];
      for (const dir of [1, 0]) {
        let grow = true;
        while (grow) {
          grow = false;
          const end = dir ? line[line.length - 1] : line[0];
          for (const si of map.get(key(end)) || []) {
            if (used[si]) continue;
            used[si] = 1; const s = segs[si];
            const nxt = key(s[0]) === key(end) ? s[1] : s[0];
            dir ? line.push(nxt) : line.unshift(nxt); grow = true; break;
          }
        }
      }
      if (line.length > 3) lines.push(chaikin(line, 2));
    }
    return lines;
  }
  function chaikin(pts, it) {
    for (let k = 0; k < it; k++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      out.push(pts[pts.length - 1]); pts = out;
    }
    return pts;
  }

  A.carte = { surTerre, project, FRANCE, CORSE, VILLES, low, triple, froid: froidM, chaud: chaudM, occlus: occlusM, pression, pluie, rafales, temperature, serie, membres, isobares, distPoly, chaikin };
})();
