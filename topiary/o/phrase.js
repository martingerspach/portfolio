// Piste 2 « La phrase », version 2 : le titre est la phrase « Nous créons votre marque, vos médias et vos outils. »
// Ses trois noms sont des boutons à état. Chacun montre dessous ce qu'il recouvre : la situation du client, puis les
// livrables. On passe d'un mot à l'autre de quatre façons : cliquer un mot, « Ensuite » au pied du volet (il ne bouge
// pas au bureau), les flèches du clavier sur un mot, un glissé horizontal au doigt.
// Le mouvement suit l'ordre de la phrase : le trait corail quitte l'ancien mot par le côté du nouveau et y entre par le
// côté opposé ; le texte sortant part à l'opposé, le texte entrant arrive du côté du mot choisi, situation puis livrables.
(function () {
  // Situations raccourcies pour cette piste : deux phrases, les précisions sont dans les livrables
  const LEDE = {
    marque: 'Vous lancez une activité ou votre image ne vous ressemble plus. Nous dessinons une identité que l’on reconnaît partout, du devis à l’application.',
    media: 'Vos clients vous cherchent en ligne avant de vous appeler. Nous construisons le site qu’ils trouvent et les films qui leur donnent envie de vous écrire.',
    machine: 'Une partie de vos journées part en saisies, en relances et en copier-coller. Nous construisons les outils qui s’en chargent à votre place.',
  };
  // « Ensuite » : le mot suivant, puis le retour au premier
  const NEXT = [['Ensuite,', 'vos médias'], ['Ensuite,', 'vos outils'], ['Revenir à', 'votre marque']];
  const NAME = ['Votre marque', 'Vos médias', 'Vos outils'];
  const ARROW = '<svg class="o-phr__arr" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/></svg>';
  // Au bout de la phrase : une flèche qui boucle (on recommence au premier mot)
  const BACK = '<svg class="o-phr__arr o-phr__arr--back" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.2 9.5A7.5 7.5 0 1 1 4.5 13"/><path d="M4.6 4.8v4.9h4.9"/></svg>';
  // Le pied : les trois étiquettes empilées dans la même case, le bouton prend la largeur de la plus longue et la flèche
  // reste en place ; seule l'étiquette du volet affiché se voit (les autres sont cachées aux lecteurs d'écran). Les deux
  // icônes sont empilées de même. index.html pose le même balisage avant le montage.
  const LABELS = NEXT.map(([k, v], i) => `<span class="o-phr__next-l${i ? '' : ' is-on'}"${i ? ' aria-hidden="true"' : ''}><span class="o-phr__next-k">${k}</span> <span class="o-phr__next-v">${v}</span></span>`).join('');
  const ICONS = `<span class="o-phr__ico"><span class="o-phr__ico-i is-on">${ARROW}</span><span class="o-phr__ico-i">${BACK}</span></span>`;

  OV.register({
    id: 'phrase',
    n: 2,
    name: 'La phrase',
    lesson: {
      short: 'Le titre est une phrase ; ses trois mots se choisissent au clic, au clavier, d’un glissé ou par « Ensuite ».',
      principle: 'Une seule phrase en grand : « Nous créons votre marque, vos médias et vos outils ». Chaque mot montre dessous ce qu’il recouvre. « Ensuite », au pied du volet, mène au mot suivant sans remonter.',
      why: 'La section tient en un écran et se lit comme une réponse : on choisit le mot qui nous concerne. Le mouvement suit l’ordre de la phrase, de gauche à droite : on sait toujours où l’on est et ce qui vient après.',
      gesture: 'Le trait corail quitte l’ancien mot du côté du nouveau puis entre dans le nouveau : il semble voyager. Le texte sortant glisse à l’opposé, le nouveau arrive du côté du mot choisi, la situation d’abord, puis les livrables un à un. À l’arrivée de la section, les soulignés se tracent une fois : on comprend que les mots se choisissent.',
      details: [
        'Quatre façons de changer de mot : cliquer un mot ; « Ensuite » au pied du volet (au bureau, il reste à la même place, on peut enchaîner les clics) ; les flèches gauche et droite sur un mot ; un glissé horizontal au téléphone.',
        'Hauteur fixe au bureau : rien ne saute. Au téléphone, la hauteur suit le volet en douceur et, après « Ensuite », la page remonte au début de la phrase si elle était sortie de l’écran.',
        'Mots non choisis en gris de texte, soulignés d’un filet ; au survol, le mot et son filet passent à l’encre.',
        'La situation et le premier livrable partagent la même ligne de base.',
        'Lecteurs d’écran : boutons à état, et une annonce discrète du mot choisi avec sa situation.',
        'Mouvements réduits : le changement est immédiat, sans tracé ni glissement.',
      ],
      content: 'Retirés à votre demande : la phrase sous le titre et le renvoi vers la méthode. Pour cette piste, chaque situation tient en deux phrases ; les précisions passent dans les livrables.',
      validate: ['Les trois situations raccourcies.', '« Revenir à votre marque » au bout du troisième mot.', 'Le tracé des soulignés à l’arrivée.'],
    },
    review: [
      { label: 'Votre marque', run: (slot) => slot.querySelector('[data-i="0"]')?.click() },
      { label: 'Vos médias', run: (slot) => slot.querySelector('[data-i="1"]')?.click() },
      { label: 'Vos outils', run: (slot) => slot.querySelector('[data-i="2"]')?.click() },
      { label: 'Rejouer l’arrivée', run: (slot) => slot.querySelector('.o-phr')?.dispatchEvent(new CustomEvent('o-phr:replay')) },
    ],
    mount(slot, { kit, offre: O, reduce }) {
      const F = O.families;
      const w = (f, i) => `<button class="o-phr__w" type="button" data-i="${i}" style="--i:${i}" aria-pressed="${i === 0}" aria-controls="o-phr-p${i}">${kit.esc(f.noun)}</button>`;
      const panels = F.map((f, i) => `
        <div class="o-phr__panel${i === 0 ? ' is-on' : ''}" id="o-phr-p${i}" role="region" aria-labelledby="o-phr-h${i}">
          <h3 class="vh" id="o-phr-h${i}">${NAME[i]}</h3>
          <p class="o-phr__lede">${kit.t(LEDE[f.id])}</p>
          <ul class="o-phr__items">${f.items.map((it) => `<li><span class="o-it">${kit.t(it.t)}</span><span class="o-id">${kit.t(it.d)}</span></li>`).join('')}</ul>
        </div>`).join('');
      slot.innerHTML = `
        <section class="panel o-phr" id="offre" aria-labelledby="offre-titre">
          <h2 class="o-phr__title" id="offre-titre"><span class="vh">${kit.esc(O.title)} : </span><span class="o-phr__l1">Nous créons votre <span class="o-nw">${w(F[0], 0)},</span></span> <span class="o-phr__l2">vos ${w(F[1], 1)} et vos <span class="o-nw">${w(F[2], 2)}.</span></span></h2>
          <div class="o-phr__stage">
            <div class="o-phr__panels">${panels}</div>
            <div class="o-phr__foot">
              <button class="o-phr__next" type="button" aria-controls="o-phr-p0 o-phr-p1 o-phr-p2"><span class="o-phr__next-t">${LABELS}</span>${ICONS}</button>
            </div>
          </div>
          <p class="vh" aria-live="polite" data-say></p>
        </section>`;

      const root = slot.querySelector('.o-phr');
      const title = root.querySelector('.o-phr__title');
      const words = [...root.querySelectorAll('.o-phr__w')];
      const pans = [...root.querySelectorAll('.o-phr__panel')];
      const box = root.querySelector('.o-phr__panels');
      const next = root.querySelector('.o-phr__next');
      const say = root.querySelector('[data-say]');
      const stacked = matchMedia('(max-width: 960px)');
      root.classList.add('is-live');

      let cur = 0, anims = [], timer = 0;
      const parts = (p) => [p.querySelector('.o-phr__lede'), ...p.querySelectorAll('.o-phr__items li')];
      const sync = () => pans.forEach((p, i) => { const on = i === cur; p.inert = !on; p.setAttribute('aria-hidden', String(!on)); });
      // Au téléphone, la boîte prend la hauteur du volet affiché (les volets sont empilés dans la même case)
      const fitBox = () => { box.style.height = stacked.matches ? `${pans[cur].getBoundingClientRect().height}px` : ''; }; // hauteur exacte, sans arrondi : rien ne bouge au montage

      // « Ensuite » change d'étiquette. Les trois sont empilées dans la même case (la flèche ne bouge jamais) ; seuls les
      // mots qui changent bougent (« Ensuite, » reste en place de « vos médias » à « vos outils ») : l'ancien s'efface en
      // roulant dans le sens du parcours (en avant : vers le haut), le nouveau arrive en se défloutant, sans temps mort.
      // L'icône ne change qu'au bout de la phrase : la flèche se fond en boucle sur place, en tournant.
      const labs = [...next.querySelectorAll('.o-phr__next-l')];
      const icos = [...next.querySelectorAll('.o-phr__ico-i')];
      const icoOf = (i) => icos[i === 2 ? 1 : 0];
      let shown = 0, lanims = [];
      const settle = () => next.querySelectorAll('.is-moving').forEach((e) => e.classList.remove('is-moving'));
      function label(i, animate, dir = 1) {
        if (i === shown) return;
        lanims.forEach((x) => x.cancel());
        lanims = [];
        settle();
        const a = labs[shown], b = labs[i], ia = icoOf(shown), ib = icoOf(i);
        const sameK = NEXT[shown][0] === NEXT[i][0];
        a.classList.remove('is-on'); a.setAttribute('aria-hidden', 'true');
        b.classList.add('is-on'); b.removeAttribute('aria-hidden');
        ia.classList.remove('is-on'); ib.classList.add('is-on');
        shown = i;
        if (!animate || reduce.matches) return;
        const s = dir < 0 ? -1 : 1;
        const OUT = { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'both' };
        const IN = { duration: 560, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' };
        const out = (el, delay) => lanims.push(el.animate(
          [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: `translateY(${-0.42 * s}em)`, filter: 'blur(3px)' }], { ...OUT, delay }));
        const inn = (el, delay) => lanims.push(el.animate(
          [{ opacity: 0, transform: `translateY(${0.5 * s}em)`, filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { ...IN, delay }));
        const [ak, av] = a.children, [bk, bv] = b.children;
        a.classList.add('is-moving');
        if (sameK) lanims.push(ak.animate({ opacity: [0, 0] }, { duration: 1, fill: 'forwards' })); // le même mot, déjà à sa place
        else { out(ak, 0); inn(bk, 70); }
        out(av, sameK ? 0 : 30);
        inn(bv, sameK ? 70 : 110);
        if (ia !== ib) {
          ia.classList.add('is-moving');
          lanims.push(ia.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `rotate(${-45 * s}deg) scale(.6)` }], { ...OUT, delay: 0 }));
          lanims.push(ib.animate([{ opacity: 0, transform: `rotate(${60 * s}deg) scale(.6)` }, { opacity: 1, transform: 'none' }], { ...IN, duration: 640, delay: 90 }));
        }
        const mine = lanims;
        Promise.all(mine.map((x) => x.finished)).then(() => {
          if (mine !== lanims) return;
          mine.forEach((x) => x.cancel());
          lanims = [];
          settle();
        }, () => {});
      }

      function go(i, how) {
        i = (i + 3) % 3;
        if (i === cur) return;
        const dir = i > cur ? 1 : -1;
        const from = pans[cur], to = pans[i];
        // Le trait : l'ancien se retire vers le nouveau mot, le nouveau entre depuis l'ancien
        words[cur].style.setProperty('--o', dir > 0 ? 'right' : 'left');
        words[i].style.setProperty('--o', dir > 0 ? 'left' : 'right');
        words[cur].setAttribute('aria-pressed', 'false');
        words[i].setAttribute('aria-pressed', 'true');
        // Volets : on arrête un changement en cours, puis l'ancien sort et le nouveau entre
        anims.forEach((a) => a.cancel()); anims = [];
        clearTimeout(timer);
        pans.forEach((p) => p.classList.remove('is-leaving'));
        from.classList.remove('is-on');
        to.classList.add('is-on');
        cur = i;
        sync();
        if (!reduce.matches) {
          // Course du texte : plus courte au téléphone, où la marge de la capsule n'est que de 24 px
          const run = stacked.matches ? [10, 16] : [20, 36];
          from.classList.add('is-leaving');
          parts(from).forEach((el) => anims.push(el.animate(
            [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * run[0]}px)` }],
            { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' })));
          parts(to).forEach((el, k) => anims.push(el.animate(
            [{ opacity: 0, transform: `translateX(${dir * run[1]}px)` }, { opacity: 1, transform: 'none' }],
            { duration: 680, delay: 150 + k * 55, easing: 'cubic-bezier(.16,.84,.24,1)', fill: 'both' })));
          const mine = anims;
          timer = setTimeout(() => from.classList.remove('is-leaving'), 210);
          Promise.all(mine.map((a) => a.finished)).then(() => { if (mine === anims) { mine.forEach((a) => a.cancel()); anims = []; } }, () => {});
        }
        fitBox();
        label(i, how !== 'init', dir);
        say.textContent = `${NAME[i]} : ${LEDE[F[i].id]}`;
        // Après « Ensuite » ou un glissé, si la phrase est sortie de l'écran par le haut, on y remonte
        if (how === 'next' || how === 'swipe') {
          const r = title.getBoundingClientRect();
          if (r.top < 0) scrollTo({ top: scrollY + r.top - (innerWidth < 600 ? 80 : 104), behavior: reduce.matches ? 'instant' : 'smooth' });
        }
      }

      words.forEach((b, i) => {
        b.addEventListener('click', () => go(i, 'word'));
        // Flèches, début et fin : on se déplace dans la phrase comme dans des onglets
        b.addEventListener('keydown', (e) => {
          const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          let j = null;
          if (k) j = Math.min(2, Math.max(0, i + k));
          else if (e.key === 'Home') j = 0;
          else if (e.key === 'End') j = 2;
          if (j === null) return;
          e.preventDefault(); e.stopPropagation();
          go(j, 'key'); words[j].focus();
        });
      });
      next.addEventListener('click', () => go(cur + 1, 'next'));

      // Glissé horizontal au doigt sur les volets (le défilement vertical reste natif : touch-action: pan-y)
      let sx = 0, sy = 0, pid = null;
      box.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; });
      box.addEventListener('pointerup', (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 56 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
          const j = cur + (dx < 0 ? 1 : -1);
          if (j >= 0 && j <= 2) go(j, 'swipe');
        }
      });
      box.addEventListener('pointercancel', () => { pid = null; });

      // À l'arrivée de la section, les soulignés se tracent une fois (corail d'abord, puis les deux filets)
      function arrive() {
        words.forEach((x) => x.style.removeProperty('--o'));
        root.classList.remove('is-seen', 'is-arriving');
        if (reduce.matches) { root.classList.add('is-seen'); return; }
        void root.offsetWidth;
        root.classList.add('is-arriving');
        requestAnimationFrame(() => root.classList.add('is-seen'));
        setTimeout(() => root.classList.remove('is-arriving'), 1700);
      }
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); arrive(); }
      }, { threshold: 0.6 });
      io.observe(title);
      root.addEventListener('o-phr:replay', arrive);

      sync();
      fitBox();
      const ro = new ResizeObserver(() => fitBox());
      pans.forEach((p) => ro.observe(p));
      const onMq = () => fitBox();
      stacked.addEventListener('change', onMq);
      return () => { io.disconnect(); ro.disconnect(); stacked.removeEventListener('change', onMq); anims.forEach((a) => a.cancel()); clearTimeout(timer); };
    },
  });
})();
