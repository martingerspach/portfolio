// Topiary v4.1 : le film de la page Méthode. Il part seul à l'arrivée, sans le son (les navigateurs refusent la lecture
// automatique avec le son), une seule fois, et reste sur le logo à la fin. Boutons : son, pause (WCAG 2.2.2), plein écran.
// Il s'arrête quand il quitte l'écran et reprend en y revenant. Mouvements réduits : rien ne part seul, l'affiche montre
// la dernière image. Sans script, la vidéo garde les commandes du navigateur.
(() => {
  const fig = document.querySelector('.mf');
  if (!fig) return;
  const frame = fig.querySelector('.mf__frame');
  const video = fig.querySelector('.mf__video');
  const bar = fig.querySelector('.mf__ctrl');
  const son = bar.querySelector('.mf__son');
  const lecture = bar.querySelector('.mf__lecture');
  const plein = bar.querySelector('.mf__plein');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  video.controls = false;
  video.setAttribute('aria-hidden', 'true'); // la légende décrit le film, les boutons le pilotent
  video.muted = true;
  bar.hidden = false;
  if (reduce) video.poster = 'film/methode-fin.webp';

  let wanted = !reduce; // lecture voulue : automatique à l'arrivée, puis celle du visiteur
  let seen = true;

  function sync() {
    const ended = video.ended;
    lecture.classList.toggle('is-ended', ended);
    lecture.classList.toggle('is-paused', video.paused && !ended);
    lecture.setAttribute('aria-label', ended ? 'Revoir le film' : video.paused ? 'Lire le film' : 'Mettre le film en pause');
    son.classList.toggle('is-on', !video.muted);
    son.setAttribute('aria-pressed', String(!video.muted));
  }
  function run() {
    if (!wanted || !seen || !video.paused || video.ended) return;
    video.play().catch((e) => {
      if (e.name !== 'NotAllowedError') return; // une pause demandée pendant le chargement, pas un refus
      wanted = false; // lecture automatique refusée (économie d'énergie, réglage du navigateur) : le bouton propose de lire
      sync();
    });
  }

  lecture.addEventListener('click', () => {
    if (video.paused || video.ended) { wanted = true; video.play().catch(() => {}); } // à la fin, play() repart du début
    else { wanted = false; video.pause(); }
  });
  son.addEventListener('click', () => { video.muted = !video.muted; sync(); }); // volumechange arrive une tâche plus tard
  video.addEventListener('ended', () => { wanted = false; });
  for (const ev of ['play', 'pause', 'ended', 'volumechange']) video.addEventListener(ev, sync);

  // L'en-tête flotte sur le haut du film, où passent la barre du site de Banc et d'autres plans. Comme un lecteur en plein
  // écran, il s'efface pendant la lecture et revient quand le pointeur approche du haut, au toucher, à la pause et à la
  // fin ; au clavier, le focus le rend visible (methode-film.css). Écran plus haut que large : il est au-dessus du film.
  const page = document.querySelector('.mf-page');
  const head = document.querySelector('.mf-head');
  const over = matchMedia('not all and (max-aspect-ratio: 1/1)');
  let idle = 0, near = false;
  const covers = () => head.getBoundingClientRect().bottom > frame.getBoundingClientRect().top; // sinon il tient au-dessus
  function wake(ms = 2500) {
    page.classList.remove('is-calme');
    clearTimeout(idle);
    if (!video.paused && over.matches) idle = setTimeout(() => {
      if (near) wake(); else if (covers()) page.classList.add('is-calme');
    }, ms);
  }
  video.addEventListener('play', () => wake());
  video.addEventListener('pause', () => wake());
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const was = near;
    near = e.clientY < head.getBoundingClientRect().bottom + 48;
    if (near && !was) wake();
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') wake(3500); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { near = false; });

  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    if (seen) run(); else if (!video.paused) video.pause();
  }, { threshold: 0.2 }).observe(frame);

  // Plein écran : la capsule entière, boutons compris ; sur iPhone, seule la vidéo peut passer en plein écran.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFs = (document.fullscreenEnabled || document.webkitFullscreenEnabled) && (frame.requestFullscreen || frame.webkitRequestFullscreen);
  const iosFs = !canFs && typeof video.webkitEnterFullscreen === 'function';
  if (!canFs && !iosFs) plein.hidden = true;
  plein.addEventListener('click', () => {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (canFs) (frame.requestFullscreen || frame.webkitRequestFullscreen).call(frame);
    else video.webkitEnterFullscreen();
  });
  function syncFs() {
    const on = fsEl() === frame;
    plein.classList.toggle('is-on', on);
    plein.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
  }
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);

  sync();
  run();
})();
