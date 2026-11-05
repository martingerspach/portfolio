// « Ce que nous faisons » dans la landing : « La phrase » (o/phrase.js) s'enregistre comme sur le banc de revue
// (OV.register) et se monte aussitôt à la place de la section statique, identique, posée dans index.html pour les
// navigateurs sans JavaScript et pour qu'aucune hauteur ne change au montage.
(function (g) {
  const slot = document.getElementById('offre-slot');
  const ctx = { reduce: matchMedia('(prefers-reduced-motion: reduce)'), fine: matchMedia('(hover: hover) and (pointer: fine)'), kit: g.OFFRE_KIT, offre: g.OFFRE };
  g.OV = {
    register(def) {
      if (!slot || !def || def.id !== 'phrase') return;
      try { def.mount(slot, ctx); } catch (e) { console.error('Ce que nous faisons :', e); }
    },
  };
})(window);
