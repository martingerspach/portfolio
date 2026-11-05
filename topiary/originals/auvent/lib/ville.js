/* Auvent · la semaine d'une ville (script classique, expose window.Auvent.ville ; requiert lib/carte.js)
   Pour la landing et les pages par ville et par tâche : quand le front passe, ce que la pluie et le vent bloquent
   pendant les heures de chantier, et le premier jour où chaque tâche redevient possible. Semaine de démonstration
   du mardi 13 au vendredi 16 octobre 2026 (t = 0 : mardi 6 h). */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const C = A.carte;
  const NB = ' ';
  const JOURS = ['mardi', 'mercredi', 'jeudi', 'vendredi'];
  const DATES = ['mardi 13', 'mercredi 14', 'jeudi 15', 'vendredi 16'];
  const tDe = (j, h) => j * 24 + h - 6;
  const hh = (t) => `${((t + 6) % 24 + 24) % 24}${NB}h`;
  const nombre = (v, d = 0) => v.toFixed(d).replace('.', ',').replace('-', '−');

  // Types de travaux et leur créneau type ; « bloque » : l'heure dépasse un seuil par défaut (sourcé dans le produit)
  const TRAVAUX = {
    coulage: { nom: 'Couler du béton', court: 'le coulage', sujet: 'la dalle', de: 7, a: 13, grandeurs: ['pluie', 'temp'], bloque: (v) => v.pluie > 1 || v.temp < 5, seuil: 'pluie au-delà de 1 mm/h, ou moins de 5 °C' },
    nacelle: { nom: 'Travailler en nacelle', court: 'la nacelle', sujet: 'la nacelle', de: 8, a: 16, grandeurs: ['rafales'], bloque: (v) => v.rafales > 45, seuil: 'rafales au-delà de 45 km/h (EN 280)' },
    couverture: { nom: 'Couvrir une toiture', court: 'la couverture', sujet: 'la toiture', de: 8, a: 16, grandeurs: ['pluie', 'rafales'], bloque: (v) => v.pluie > 0.2 || v.rafales > 40, seuil: 'pluie, ou rafales au-delà de 40 km/h' },
    levage: { nom: 'Lever à la grue', court: 'le levage', sujet: 'la grue', de: 8, a: 16, grandeurs: ['rafales'], bloque: (v) => v.rafales > 50, seuil: 'rafales au-delà de 50 km/h (seuil courant des notices pour les charges à prise au vent)' },
    enduit: { nom: 'Enduire une façade', court: 'l\'enduit', sujet: 'la façade', de: 8, a: 16, grandeurs: ['pluie', 'temp'], bloque: (v) => v.pluie > 0.1 || v.temp < 5, seuil: 'pluie, ou moins de 5 °C' },
    terrassement: { nom: 'Terrasser', court: 'le terrassement', sujet: 'la pelle', de: 8, a: 16, grandeurs: ['pluie'], bloque: (v) => v.pluie > 2, seuil: 'pluie au-delà de 2 mm/h' },
  };

  // Heure du modèle où la ville change de côté du front froid
  function passage(xy) {
    let prev = null;
    for (let t = 0; t <= 96; t += 0.25) { const s = C.distPoly(xy[0], xy[1], C.froid(t)).side; if (prev !== null && s !== prev) return t; prev = s; }
    return null;
  }

  // Bilan d'un type de travaux, jour par jour (heures bloquées pendant son créneau)
  function travaux(serie, type) {
    const T = TRAVAUX[type], jours = [];
    for (let j = 0; j < 4; j++) {
      const heures = [];
      for (let t = tDe(j, T.de); t < tDe(j, T.a); t++) if (T.bloque(serie[t])) heures.push(t);
      const duree = T.a - T.de;
      jours.push({ jour: j, heures, bloque: heures.length >= Math.max(2, duree / 3) });
    }
    return jours;
  }

  const cache = new Map();
  function bilan(id) {
    if (cache.has(id)) return cache.get(id);
    const v = C.VILLES.find((x) => x.id === id), serie = C.serie(v.xy, 100);
    const tp = passage(v.xy);
    // jour de chantier le plus touché : celui qui cumule le plus de pluie pendant les heures de chantier (7 h à 17 h)
    let jour = 0, best = -1;
    for (let j = 0; j < 4; j++) { let s = 0, g = 0; for (let t = tDe(j, 7); t < tDe(j, 17); t++) { s += serie[t].pluie; g = Math.max(g, serie[t].rafales); } const score = s + Math.max(0, g - 40) / 10; if (score > best) { best = score; jour = j; } }
    const heuresPluie = []; let mm = 0, raf = 0;
    for (let t = tDe(jour, 7); t < tDe(jour, 17); t++) { const p = serie[t].pluie; if (p >= 0.5) heuresPluie.push(t); mm += p; raf = Math.max(raf, serie[t].rafales); }
    const types = Object.fromEntries(Object.keys(TRAVAUX).map((k) => [k, travaux(serie, k)]));
    const prochain = (k) => { const js = types[k]; for (let j = jour + 1; j < 4; j++) if (!js[j].bloque) return j; return null; };
    // titre : la tâche la plus parlante parmi celles que le jour bloque
    let titre, cle = null;
    for (const k of ['coulage', 'nacelle', 'couverture', 'levage']) if (types[k][jour].bloque) { cle = k; break; }
    const J = JOURS[jour][0].toUpperCase() + JOURS[jour].slice(1);
    if (cle === 'coulage') titre = `${J}, la coule de la dalle attendra ${JOURS[prochain('coulage')] || 'la semaine prochaine'}.`;
    else if (cle === 'nacelle') titre = `${J}, la nacelle restera au sol.`;
    else if (cle === 'couverture') titre = `${J}, la pose de la toiture attendra ${JOURS[prochain('couverture')] || 'la semaine prochaine'}.`;
    else if (cle === 'levage') titre = `${J}, le levage attendra que le vent tombe.`;
    else titre = `Cette semaine, le temps laisse vos chantiers tranquilles.`;
    // cause du blocage du coulage : la pluie ou le froid du matin
    if (cle === 'coulage' && !types.coulage[jour].heures.some((t) => serie[t].pluie > 1)) {
      const mn = Math.min(...types.coulage[jour].heures.map((t) => serie[t].temp));
      titre = `${J}, il fera ${nombre(mn, 0)}${NB}°C au petit matin : le béton attendra ${JOURS[prochain('coulage')] || 'la semaine prochaine'}.`;
    }
    // pluie de la semaine hors des heures de chantier (pour les villes que rien ne bloque)
    let nuit = 0, tNuit = null;
    for (let t = 0; t < 96; t++) { const h = (t + 6) % 24; if (h < 7 || h >= 17) { nuit += serie[t].pluie; if (serie[t].pluie >= 0.5 && tNuit === null) tNuit = t; } }
    let phrase;
    if (!cle) {
      const jn = tNuit !== null ? Math.floor((tNuit + 6) / 24) : null;
      phrase = nuit >= 2 && jn !== null
        ? `À ${v.nom}, la pluie (${nombre(nuit, 0)}${NB}mm) tombe la nuit de ${JOURS[Math.max(0, (tNuit + 6) % 24 < 7 ? jn - 1 : jn)]} : aucune heure de chantier n'est touchée.`
        : `À ${v.nom}, moins de 2${NB}mm de pluie sur la semaine, et des rafales sous ${Math.round(raf / 5) * 5 + 5}${NB}km/h.`;
    } else if (heuresPluie.length) phrase = `À ${v.nom}, ${DATES[jour]} : pluie de ${hh(heuresPluie[0])} à ${hh(heuresPluie[heuresPluie.length - 1] + 1)}, ${nombre(mm, 0)}${NB}mm ; rafales jusqu'à ${Math.round(raf)}${NB}km/h.`;
    else phrase = `À ${v.nom}, ${DATES[jour]} : rafales jusqu'à ${Math.round(raf)}${NB}km/h, la pluie tombe hors des heures de chantier.`;
    let suite = '';
    if (cle === 'coulage' && prochain('coulage') !== null) suite = `Le coulage passe à ${JOURS[prochain('coulage')]} 7${NB}h.`;
    else if (cle === 'nacelle' && prochain('nacelle') !== null) suite = `La nacelle reprend ${JOURS[prochain('nacelle')]} ; d'ici là, le travail au sol avance.`;
    else if (cle === 'couverture' && prochain('couverture') !== null) suite = `La couverture reprend ${JOURS[prochain('couverture')]}.`;
    const r = { id, nom: v.nom, xy: v.xy, serie, passage: tp, jour, mm, rafales: raf, heuresPluie, types, cle, titre, phrase, suite, prochain };
    cache.set(id, r);
    return r;
  }

  A.ville = { TRAVAUX, JOURS, DATES, tDe, hh, nombre, passage, bilan };
})();
