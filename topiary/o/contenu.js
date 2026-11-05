// « Ce que nous faisons » : le contenu commun aux huit compositions (une seule source, pour comparer à texte égal).
// Réécrit le 2026-10-21 à la demande de l'utilisateur : parler plus directement au visiteur, détailler un peu chaque famille
// (à la manière d'alt-shift : une situation, ce que nous faisons, puis les livrables), sans inventer de prix ni de délai.
// Typographie française : espace insécable avant « : », espace fine insécable avant « ? ! ; » (échappements \u00a0 et  ).
(function (g) {
  const OFFRE = {
    title: 'Ce que nous faisons',
    intro: 'Nous concevons et produisons votre marque, vos médias et vos outils, de la première esquisse à la mise en ligne. Confiez-nous tout ou commencez par ce qui presse.',
    families: [
      {
        id: 'marque',
        name: 'Marque',
        noun: 'marque', // dans la phrase « Nous créons votre marque, vos médias et vos outils »
        lede: 'Vous lancez une activité ou votre image ne vous ressemble plus. Nous dessinons une identité complète, du nom au ton, puis nous la déclinons en composants d’interface pour qu’on la reconnaisse partout, du devis à l’application.',
        items: [
          { t: 'Nom et logo', d: 'Un signe qui tient du favicon à l’enseigne' },
          { t: 'Charte graphique', d: 'Couleurs, typographies, ton et règles d’usage' },
          { t: 'Design system', d: 'Les composants de vos interfaces, prêts à coder' },
        ],
      },
      {
        id: 'media',
        name: 'Média',
        noun: 'médias',
        lede: 'Vos clients vous cherchent en ligne avant de vous appeler. Nous construisons un site rapide et accessible, nous le rendons visible sur Google comme dans les assistants IA et nous produisons les films qui le font vivre, sans tournage.',
        items: [
          { t: 'Site web', d: 'Rapide et accessible, sur tous les écrans' },
          { t: 'Référencement', d: 'Sur Google et dans les assistants IA (SEO, GEO)' },
          { t: 'Motion design', d: 'Logo animé, schémas et interfaces en mouvement' },
          { t: 'Films sans tournage', d: 'Pour votre site, vos réseaux et vos présentations' },
        ],
      },
      {
        id: 'machine',
        name: 'Machine',
        noun: 'outils',
        lede: 'Une partie de vos journées part en saisies, en relances et en copier-coller. Nous construisons les outils qui s’en chargent à votre place\u00a0: une application à la mesure de votre métier, des automatisations entre vos logiciels, des agents qui préparent le travail et vous laissent décider.',
        items: [
          { t: 'Application métier', d: 'Votre façon de travailler, sur ordinateur et téléphone' },
          { t: 'Automatisations', d: 'Vos logiciels s’échangent devis, relances et factures' },
          { t: 'Agents IA sur mesure', d: 'Ils préparent le travail, vous validez' },
          { t: 'Assistant sur vos documents', d: 'Il répond à partir de vos propres fichiers' },
        ],
      },
    ],
    next: {
      text: 'Comment se déroule un projet, du cadrage à la livraison.',
      cta: 'Voir notre méthode',
      href: 'methode.html',
    },
    mail: 'contact@topiary.studio',
  };

  // Petites aides de mise en page, communes aux compositions
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Texte courant : échappé, et les mots composés ne se coupent pas à leur trait d'union
  // (Onest n'a pas de trait d'union insécable U+2011 : un glyphe de repli se verrait).
  const t = (s) => esc(s).replace(/[A-Za-zÀ-ÿ’]+(?:-[A-Za-zÀ-ÿ’]+)+/g, (w) => `<span class="o-nw">${w}</span>`);
  // Le renvoi vers la méthode, identique partout (le bouton noir de la v4)
  const next = (cls = '') => `<div class="o-next ${cls}"><p>${t(OFFRE.next.text)}</p><a class="btn btn--ink" href="${OFFRE.next.href}">${esc(OFFRE.next.cta)}</a></div>`;
  // Liste des livrables : intitulé, puis sa précision
  const items = (f, cls = 'o-items') => `<ul class="${cls}">${f.items.map((it) => `<li><span class="o-it">${t(it.t)}</span><span class="o-id">${t(it.d)}</span></li>`).join('')}</ul>`;

  g.OFFRE = OFFRE;
  g.OFFRE_KIT = { esc, t, next, items };
})(window);
