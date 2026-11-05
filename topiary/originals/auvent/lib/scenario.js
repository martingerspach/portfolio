/* Auvent · scénario de démonstration (script classique, expose window.Auvent.scenario ; requiert lib/carte.js)
   Une entreprise fictive de gros œuvre et de second œuvre, cinq chantiers dans l'Ouest, la semaine du mardi 13 octobre 2026.
   « Maintenant » : mardi 13, 6 h (t = 0 dans le modèle de carte.js). Journées de chantier : 7 h à 17 h.
   Les seuils par défaut sont sourcés quand une source existe (INRS, EN 280, pratique du béton) ; les autres sont des
   « seuils de l'entreprise » : dans le produit, chaque entreprise saisit ceux de ses notices et de ses procédures.
   Auvent signale et propose ; le chef de chantier décide. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const C = A.carte;

  const JOURS = [
    { id: 'mar', court: 'mar. 13', long: 'mardi 13 octobre', nom: 'mardi' },
    { id: 'mer', court: 'mer. 14', long: 'mercredi 14 octobre', nom: 'mercredi' },
    { id: 'jeu', court: 'jeu. 15', long: 'jeudi 15 octobre', nom: 'jeudi' },
    { id: 'ven', court: 'ven. 16', long: 'vendredi 16 octobre', nom: 'vendredi' },
  ];
  const DEBUT = 7, FIN = 17;                       // heures de chantier
  const tDe = (jour, h) => jour * 24 + h - 6;      // heure du modèle (t = 0 : mardi 6 h)

  // Grandeurs : pluie (mm/h), rafales (km/h), temp (°C), secAvant (heures sans pluie avant le début)
  const TYPES = {
    coulage: { nom: 'Coulage', abri: false, seuils: [
      { g: 'pluie', max: 1.0, texte: 'pluie au-delà de 1 mm/h', source: 'Seuil de l\'entreprise : une forte pluie lessive le béton frais' },
      { g: 'temp', min: 5, texte: 'moins de 5 °C', source: 'Pratique du béton : précautions de temps froid sous +5 °C' } ] },
    levage: { nom: 'Levage', abri: false, seuils: [
      { g: 'rafales', max: 50, texte: 'rafales au-delà de 50 km/h', source: 'Seuil de l\'entreprise pour les charges à prise au vent (notice de la grue)' },
      { g: 'rafales', max: 72, texte: 'rafales au-delà de 72 km/h, grue en girouette', source: 'INRS, ED 6338' } ] },
    nacelle: { nom: 'Nacelle', abri: false, seuils: [
      { g: 'rafales', max: 45, texte: 'rafales au-delà de 45 km/h', source: 'EN 280 : nacelles d\'extérieur, 12,5 m/s' } ] },
    couverture: { nom: 'Couverture', abri: false, seuils: [
      { g: 'pluie', max: 0.2, texte: 'pluie', source: 'Seuil de l\'entreprise : support sec' },
      { g: 'rafales', max: 40, texte: 'rafales au-delà de 40 km/h', source: 'Seuil de l\'entreprise : travail en toiture' } ] },
    etancheite: { nom: 'Étanchéité', abri: false, seuils: [
      { g: 'pluie', max: 0.1, texte: 'pluie', source: 'Support sec exigé' },
      { g: 'secAvant', min: 12, texte: 'pluie dans les 12 h qui précèdent', source: 'Seuil de l\'entreprise : le support doit avoir séché' } ] },
    enduit: { nom: 'Enduit', abri: false, seuils: [
      { g: 'pluie', max: 0.1, texte: 'pluie', source: 'Seuil de l\'entreprise' },
      { g: 'temp', min: 5, texte: 'moins de 5 °C', source: 'Pratique des mortiers : pas d\'application sous +5 °C' },
      { g: 'secAvant', min: 12, texte: 'pluie dans les 12 h qui précèdent', source: 'Seuil de l\'entreprise : façade sèche' } ] },
    terrassement: { nom: 'Terrassement', abri: false, seuils: [
      { g: 'pluie', max: 2.0, texte: 'pluie au-delà de 2 mm/h', source: 'Seuil de l\'entreprise : sol détrempé' } ] },
    ferraillage: { nom: 'Ferraillage', abri: false, seuils: [
      { g: 'pluie', max: 3.0, texte: 'pluie au-delà de 3 mm/h', source: 'Seuil de l\'entreprise' } ] },
    interieur: { nom: 'Intérieur', abri: true, seuils: [] },
  };

  const CHANTIERS = [
    { id: 'nazaire', nom: 'Quai Ouest', ville: 'Saint-Nazaire', lat: 47.275, lon: -2.21, objet: 'Halle logistique, structure métallique', chef: 'Chef de chantier : équipe A' },
    { id: 'bateliers', nom: 'Les Bateliers', ville: 'Nantes', lat: 47.205, lon: -1.555, objet: '42 logements, gros œuvre R+5', chef: 'Chef de chantier : équipe B' },
    { id: 'cholet', nom: 'Halle B', ville: 'Cholet', lat: 47.06, lon: -0.88, objet: 'Réhabilitation d\'une halle', chef: 'Chef de chantier : équipe C' },
    { id: 'angers', nom: 'Groupe scolaire', ville: 'Angers', lat: 47.47, lon: -0.55, objet: 'Réfection des toitures', chef: 'Chef de chantier : équipe D' },
    { id: 'laval', nom: 'Résidence du Parc', ville: 'Laval', lat: 48.07, lon: -0.77, objet: '18 logements, fondations', chef: 'Chef de chantier : équipe E' },
  ].map((c) => ({ ...c, xy: C.project(c.lat, c.lon) }));

  // Tâches de la semaine : chantier, type, libellé, jour (0 = mardi), début et fin (heures)
  const TACHES = [
    ['nazaire', 'levage', 'Montage de la charpente', 0, 7.5, 16],
    ['nazaire', 'nacelle', 'Bardage façade nord', 1, 7.5, 16],
    ['nazaire', 'ferraillage', 'Ferraillage des longrines', 2, 7.5, 16],
    ['nazaire', 'nacelle', 'Bardage façade sud', 3, 7.5, 16],
    ['bateliers', 'levage', 'Levage des prédalles R+1', 0, 7.5, 16],
    ['bateliers', 'coulage', 'Coulage de la dalle R+1', 1, 7, 13],
    ['bateliers', 'interieur', 'Cloisons du RDC', 2, 7.5, 16],
    ['bateliers', 'ferraillage', 'Ferraillage des voiles R+2', 3, 7.5, 16],
    ['cholet', 'terrassement', 'Terrassement VRD', 0, 7.5, 16],
    ['cholet', 'enduit', 'Enduit façade ouest', 1, 8, 16],
    ['cholet', 'interieur', 'Plomberie intérieure', 2, 7.5, 16],
    ['cholet', 'interieur', 'Peinture intérieure', 3, 7.5, 16],
    ['angers', 'couverture', 'Dépose du zinc, aile B', 0, 7.5, 16],
    ['angers', 'couverture', 'Pose du zinc, aile B', 1, 7.5, 16],
    ['angers', 'interieur', 'Menuiseries intérieures', 2, 7.5, 16],
    ['angers', 'etancheite', 'Étanchéité toiture-terrasse', 3, 7.5, 16],
    ['laval', 'terrassement', 'Fouilles des semelles', 0, 7.5, 16],
    ['laval', 'coulage', 'Coulage des semelles', 1, 8, 13],
    ['laval', 'ferraillage', 'Ferraillage des longrines', 2, 7.5, 16],
    ['laval', 'coulage', 'Coulage des longrines', 3, 7, 12],
  ].map(([chantier, type, nom, jour, debut, fin], i) => ({ id: 't' + i, chantier, type, nom, jour, debut, fin }));

  const chantier = (id) => CHANTIERS.find((c) => c.id === id);

  // Météo horaire d'un chantier, avec un faisceau de 16 membres (prévision d'ensemble simulée).
  // avance : heures d'échéance supplémentaires (une prévision émise samedi voit mercredi avec 72 h de plus).
  const cache = new Map();
  function meteo(id, avance = 0) {
    const k = id + ':' + avance;
    if (cache.has(k)) return cache.get(k);
    const c = chantier(id), serie = C.serie(c.xy, 100), memb = membresAvance(c.xy, avance);
    const r = { serie, membres: memb };
    cache.set(k, r);
    return r;
  }
  function membresAvance(xy, avance, nb = 16) {
    // graine positive (une graine négative donnait des tirages négatifs, donc des membres affaiblis)
    let s = (Math.abs(Math.round(xy[0] * 3 + xy[1] * 7)) % 2147483646) + 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = [];
    for (let m = 0; m < nb; m++) {
      const phase = (rnd() - 0.5) * 2, amp = 0.75 + rnd() * 0.5, ventAmp = 0.92 + rnd() * 0.16;
      const row = [];
      for (let h = 0; h <= 100; h++) {
        const ech = h + avance, shift = phase * (0.6 + 0.07 * ech);          // l'incertitude croît avec l'échéance
        const tt = Math.max(0, h + shift);
        row.push({ pluie: C.pluie(xy[0], xy[1], tt) * amp, rafales: C.rafales(xy[0], xy[1], tt) * ventAmp, temp: C.temperature(xy[0], xy[1], tt) });
      }
      out.push(row);
    }
    return out;
  }

  // Une heure dépasse-t-elle un seuil, pour une série donnée ?
  function depasse(s, serie, t) {
    const v = serie[Math.round(t)];
    if (!v) return false;
    if (s.g === 'secAvant') { for (let k = 1; k <= s.min; k++) { const p = serie[Math.round(t) - k]; if (p && p.pluie > 0.2) return true; } return false; }
    if (s.max !== undefined) return v[s.g] > s.max;
    return v[s.g] < s.min;
  }

  // Évaluer une tâche à un créneau : état, heures touchées, probabilité (part des membres qui bloquent), raison écrite.
  function evaluer(tache, creneau = tache, avance = 0) {
    const type = TYPES[tache.type];
    if (type.abri) return { etat: 'abri', proba: 0, heures: [], raison: 'À l\'abri : la météo n\'a pas d\'effet.' };
    const m = meteo(tache.chantier, avance);
    const t0 = tDe(creneau.jour, creneau.debut), t1 = tDe(creneau.jour, creneau.fin);
    const heures = [], causes = new Map();
    for (let t = Math.ceil(t0); t < t1; t++) for (const s of type.seuils) if (depasse(s, m.serie, t)) { heures.push(t); causes.set(s.texte, s); }
    const duree = t1 - t0;
    // probabilité : part des membres où au moins un tiers du créneau est touché
    let bloquants = 0;
    for (const row of m.membres) {
      let n = 0; for (let t = Math.ceil(t0); t < t1; t++) if (type.seuils.some((s) => depasse(s, row, t))) n++;
      if (n >= duree / 3) bloquants++;
    }
    const proba = bloquants / m.membres.length;
    const uniques = [...new Set(heures)].sort((a, b) => a - b);
    const part = uniques.length / duree;
    let etat = 'prevue';
    if (part >= 1 / 3 && proba >= 0.6) etat = 'bloquee';
    else if (uniques.length || proba >= 0.3) etat = 'surveiller';
    return { etat, proba, heures: uniques, part, causes: [...causes.values()], raison: raison(tache, uniques, [...causes.values()], m.serie, etat) };
  }
  const hh = (t) => { const h = ((t + 6) % 24 + 24) % 24; return Math.floor(h) + ' h' + (h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, '0') : ''); };
  function raison(tache, heures, causes, serie, etat) {
    if (!heures.length) return etat === 'surveiller' ? 'Quelques scénarios touchent le créneau.' : 'Rien à signaler.';
    const c = causes[0], de = heures[0], a = heures[heures.length - 1] + 1;
    let val = '';
    if (c.g === 'pluie') { const tot = heures.reduce((s, t) => s + serie[t].pluie, 0); val = `pluie de ${hh(de)} à ${hh(a)}, ${nombre(tot, 0)} mm`; }
    else if (c.g === 'rafales') { const pic = Math.max(...heures.map((t) => serie[t].rafales)); val = `rafales jusqu'à ${Math.round(pic)} km/h de ${hh(de)} à ${hh(a)}`; }
    else if (c.g === 'temp') { const mn = Math.min(...heures.map((t) => serie[t].temp)); val = `${nombre(mn, 0)} °C au début du créneau`; }
    else if (c.g === 'secAvant') val = 'support encore humide après la pluie de la veille';
    return val.charAt(0).toUpperCase() + val.slice(1) + '.';
  }
  const nombre = (v, d = 0) => v.toFixed(d).replace('.', ',').replace('-', '−');

  // ---------- Le repli : pour chaque tâche bloquée, le premier créneau sûr ; une tâche à l'abri prend sa place ----------
  function repli(avance = 0) {
    const plan = TACHES.map((t) => ({ ...t }));
    const moves = [];
    for (const c of CHANTIERS) {
      const taches = plan.filter((t) => t.chantier === c.id).sort((a, b) => a.jour - b.jour);
      for (const t of taches) {
        const ev = evaluer(t, t, avance);
        if (ev.etat !== 'bloquee') continue;
        // jour cible : le premier jour suivant où la tâche passe sans réserve ; à défaut, le premier où elle n'est
        // qu'« à surveiller ». La tâche de ce jour-là prend la place libérée.
        let fait = false;
        for (const accepte of [['prevue'], ['prevue', 'surveiller']]) {
        if (fait) break;
        for (let j = t.jour + 1; j < JOURS.length; j++) {
          const autre = taches.find((x) => x.jour === j);
          const essai = { ...t, jour: j, debut: t.debut, fin: t.fin };
          const evT = evaluer(t, essai, avance);
          if (!accepte.includes(evT.etat)) continue;
          // l'autre tâche vient au jour libéré : elle doit y passer aussi (à l'abri, ou tolérante)
          const essaiAutre = autre ? { ...autre, jour: t.jour } : null;
          const evA = autre ? evaluer(autre, essaiAutre, avance) : null;
          if (autre && evA.etat === 'bloquee') continue;
          moves.push({
            chantier: c.id, tache: t.id, nom: t.nom, de: t.jour, vers: j, raison: ev.raison, apres: evT,
            echange: autre ? { tache: autre.id, nom: autre.nom, de: j, vers: t.jour, abri: TYPES[autre.type].abri, apres: evA } : null,
          });
          const oldJour = t.jour; t.jour = j; if (autre) autre.jour = oldJour;
          fait = true;
          break;
        }
        }
      }
    }
    return { moves, plan };
  }

  A.scenario = { JOURS, DEBUT, FIN, TYPES, CHANTIERS, TACHES, chantier, meteo, evaluer, repli, tDe, hh, nombre };
})();
