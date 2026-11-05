/* Topiary v4 : le film sous le hero (la boucle du labyrinthe), tiré en « pellicule ».
   La vidéo est décodée par un <video> et peinte dans un canevas WebGL2, en quatre passes :
   1. le tirage, à la taille de la vidéo : contraste local et piqué, puis une couleur de film tiré sur papier (verts éteints,
      ombres vers l'encre du site, hautes lumières vers son papier), la chaise passée dans la couleur d'accent grâce à son
      détourage, calculé hors ligne et livré sous le film dans le même fichier ;
   2. la post-production, à la taille de la vidéo (glitch.js) : retirée le 2026-10-26, le film passe sans elle ; le socle reste
      prêt (le dernier « relevé » est dans v4/archive/2026-10-26-releve-v2/) ;
      avant elle, dans le tirage, l'écran du portable (images 112 à 150) montre la landing, suivi image par image ;
   3. l'affichage, à la taille de l'écran : agrandissement bicubique, cadrage qui suit le personnage quand la capsule est
      plus étroite que l'image, grain argentique à la résolution de l'écran, renouvelé à chaque image du film.
   Les couleurs viennent des tokens (--night, --paper, --accent) : le panneau de revue les change, le film suit.
   Sans WebGL2, ou si le contexte se perd, la vidéo seule s'affiche. Mouvements réduits : pas de lecture automatique,
   la première image reste en place, le bouton lance le film, et aucune post-production ne joue. */
(function () {
  'use strict';
  const reel = document.getElementById('reel');
  if (!reel) return;
  const media = reel.querySelector('.reel__media');
  const video = reel.querySelector('video');
  const btn = reel.querySelector('.reel__toggle');
  const hero = document.querySelector('.hero');
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);

  /* ---------- Le film ---------- */
  const FPS = 25, FRAMES = 252, W = 1280, H = 720; // boucle remasterisée : cadence rétablie, raccord sans saut (image 124 recréée retirée le 2026-10-21)
  // Centre du sujet (chaise, ordinateur, casque) à chaque image, en millièmes de la largeur et de la hauteur.
  const TX = '464,463,462,462,461,460,460,459,459,458,458,458,458,458,458,458,458,458,459,459,459,459,459,459,459,460,460,460,460,460,460,460,460,460,460,460,460,461,461,461,461,461,461,461,462,462,462,462,462,462,462,462,462,462,462,462,462,461,461,461,461,461,461,460,460,460,460,461,461,461,462,462,463,463,464,465,466,467,468,469,471,472,473,474,475,476,477,478,478,479,480,481,482,482,483,485,486,487,489,490,492,495,497,499,502,504,507,510,512,515,517,519,521,523,524,526,527,528,529,529,530,531,531,531,533,533,534,535,535,536,537,538,539,540,541,542,543,544,545,546,546,547,548,548,548,549,549,549,550,550,550,550,550,550,550,550,550,550,549,549,548,548,547,546,545,544,542,541,540,538,537,535,533,531,530,528,526,524,522,520,518,517,515,513,512,510,509,507,506,504,503,502,501,499,498,497,496,494,493,492,490,489,487,486,484,483,482,480,479,478,477,476,475,474,474,473,473,473,473,472,472,472,472,473,473,473,473,473,473,473,473,473,473,473,473,473,473,473,473,473,473,472,472,472,471,471,470,469,468,467,466,465';
  const TY = '577,577,577,577,576,576,575,574,573,572,571,570,568,567,566,564,563,562,560,559,558,557,556,555,555,554,554,554,554,554,554,555,556,556,557,558,559,560,560,561,562,563,564,565,566,566,567,568,569,569,570,571,572,573,573,574,575,576,576,577,578,579,579,580,580,581,581,581,581,581,581,580,579,579,578,576,575,574,573,572,571,570,569,569,569,569,570,571,573,575,578,581,584,587,591,595,598,602,605,609,612,614,617,618,620,620,621,621,620,619,617,615,612,609,606,603,599,595,591,588,584,580,577,574,568,566,564,563,561,560,560,559,559,559,559,559,560,560,560,560,561,561,561,561,560,560,560,559,558,557,556,555,554,553,551,550,548,547,545,544,542,541,539,537,536,534,533,531,529,528,526,524,523,521,519,517,516,514,513,511,510,509,508,507,506,506,506,506,506,507,508,508,509,510,511,513,514,515,516,516,517,518,518,519,520,520,521,521,522,523,524,525,526,527,529,530,532,534,536,538,540,541,543,545,547,548,550,551,553,554,555,556,557,559,560,561,562,563,565,566,567,569,570,571,572,573,574,575,576,577,577,577';
  const num = (s) => s.split(',').map(Number);
  const TRX = num(TX), TRY = num(TY);
  function trackAt(t) {
    const f = ((t * FPS) % FRAMES + FRAMES) % FRAMES;
    const i = Math.floor(f), a = f - i, j = (i + 1) % FRAMES;
    return [(TRX[i] + (TRX[j] - TRX[i]) * a) / 1000, (TRY[i] + (TRY[j] - TRY[i]) * a) / 1000];
  }
  // image du film (0 à 252) à un instant de la vidéo
  const filmFrame = (t) => ((Math.floor(t * FPS + 0.01) % FRAMES) + FRAMES) % FRAMES;

  /* ---------- La post-production (glitch.js, retirée le 2026-10-26 : sans lui, aucune passe n'est peinte) ---------- */
  const GLITCH = window.TOPIARY_GLITCH || { comps: [] };
  const DATA = window.TOPIARY_GLITCH_DATA || { box: [], ev: {} };
  const COMPS = [{ id: 'net', name: 'Sans glitch', idea: 'La pellicule seule, la référence pour comparer.' }].concat(GLITCH.comps);
  let comp = COMPS.length > 1 ? COMPS[1].id : 'net';
  if (COMPS.some((c) => c.id === params.get('glitch'))) comp = params.get('glitch');

  /* ---------- Lecture ---------- */
  let userPaused = reduce.matches;
  let revealed = false, inView = false, loaded = false;
  let packed = false; // le lecteur WebGL lit le paquet (film en haut, détourage de la chaise en bas) ; la vidéo seule lit le film simple
  const setBtn = () => {
    const paused = video.paused;
    btn.classList.toggle('is-paused', paused);
    btn.setAttribute('aria-label', paused ? 'Lire le film' : 'Mettre le film en pause');
  };
  const want = () => revealed && inView && !userPaused && !document.hidden;
  const play = () => { const p = video.play(); if (p) p.catch(() => {}); };
  function sync() {
    if (want()) { load(); play(); } else if (!video.paused) video.pause();
  }
  function load() {
    if (loaded) return;
    loaded = true;
    const d = reel.dataset;
    const av1 = video.canPlayType('video/mp4; codecs="av01.0.05M.08"') === 'probably';
    video.src = packed ? (av1 && d.packAv1 ? d.packAv1 : d.pack) : d.video;
    video.preload = 'auto';
    video.load();
  }
  if (!reel.dataset.video) return;
  btn.hidden = false;
  btn.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause(); else { load(); play(); }
  });
  video.addEventListener('play', setBtn);
  video.addEventListener('pause', setBtn);
  setBtn();
  // Le film est caché sous le hero tant que celui-ci n'a pas bougé : on le lance quand il se découvre.
  if (hero) {
    // Au téléphone, le hero ne couvre que le haut de l'écran (v4.css) : le film se voit dessous dès l'arrivée.
    new IntersectionObserver(([e]) => { revealed = e.intersectionRatio < 0.995 || e.boundingClientRect.height < innerHeight * 0.8; sync(); }, { threshold: [0.995, 1] }).observe(hero);
  } else revealed = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(reel);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', () => { if (reduce.matches) { userPaused = true; sync(); } });
  // Préchargement une fois la page posée (pas en mode économie de données) : le film est prêt quand on défile.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!saveData) addEventListener('load', () => idle(load, { timeout: 3000 }), { once: true });

  /* ---------- WebGL2 ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'reel__gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  // La vidéo seule, avec son image d'attente (et le film simple si le paquet était déjà chargé).
  const fallback = () => {
    if (reel.dataset.poster) video.poster = reel.dataset.poster;
    if (packed && loaded) {
      const t = video.currentTime, wasPlaying = !video.paused;
      video.src = reel.dataset.video;
      video.addEventListener('loadedmetadata', () => { video.currentTime = t; if (wasPlaying) play(); }, { once: true });
    }
    packed = false;
  };
  if (!gl || !reel.dataset.pack) { fallback(); return; }
  media.append(canvas);

  const VS = `#version 300 es
  out vec2 vUv;
  void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  const COMMON = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 toLab(vec3 c) {
    vec3 lms = vec3(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
                    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
                    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)));
    lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
    return vec3(dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
                dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
                dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660)));
  }
  vec3 fromLab(vec3 L) {
    vec3 lms = vec3(L.x + 0.3963377774 * L.y + 0.2158037573 * L.z,
                    L.x - 0.1055613458 * L.y - 0.0638541728 * L.z,
                    L.x - 0.0894841775 * L.y - 1.2914855480 * L.z);
    lms = lms * lms * lms;
    return vec3(dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
                dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
                dot(lms, vec3(-0.0041960863, -0.7034186147, 1.7076147010)));
  }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;

  // 1. Le tirage, à la taille de la vidéo. Le détourage de la chaise (calculé image par image hors ligne, bords recalés sur
  //    l'image, stable dans le temps) arrive sous le film dans le même fichier. La vidéo arrive la tête en bas : on la retourne ici.
  const FS_GRADE = `${COMMON}
  uniform sampler2D uVid, uPack;
  uniform vec2 uPx;
  uniform vec3 uInk, uPaper, uAcc;   // OKLab
  uniform vec4 uTone;                // noir, blanc, contraste, gamma
  uniform vec2 uDetail;              // piqué, contraste local
  // L'écran du portable : présence, luminosité (fondus compris), douceur de l'image (comme le film), homographies (px de la vidéo -> verre, verre -> px à l'image
  // d'avant), marges du verre autour de l'affichage (gauche, haut, droite, bas), et l'image affichée.
  uniform vec4 uScr;
  uniform mat3 uScrHi, uScrHp;
  uniform vec4 uScrIn;
  uniform sampler2D uScrImg;
  float scurve(float x, float c) { x = clamp(x, 0.0, 1.0); float a = pow(x, c), b = pow(1.0 - x, c); return a / (a + b); }
  bool inGamut(vec3 c) { return all(greaterThanEqual(c, vec3(-0.0005))) && all(lessThanEqual(c, vec3(1.0005))); }
  // ramène une couleur OKLab dans la gamme sRGB en ne retirant que de la chroma (clarté et teinte gardées)
  vec3 gamut(vec3 lab) {
    if (inGamut(fromLab(lab))) return lab;
    float lo = 0.0, hi = 1.0;
    for (int i = 0; i < 8; i++) { float m = 0.5 * (lo + hi); if (inGamut(fromLab(vec3(lab.x, lab.yz * m)))) lo = m; else hi = m; }
    return vec3(lab.x, lab.yz * lo);
  }
  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec3 c = texture(uVid, uv).rgb;
    // piqué (masque flou en croix) et contraste local (écart aux environs, niveau 3,5 des mipmaps, quatre prises)
    float y0 = luma(c);
    float yn = luma(texture(uVid, uv + vec2(uPx.x, 0.0)).rgb + texture(uVid, uv - vec2(uPx.x, 0.0)).rgb
                  + texture(uVid, uv + vec2(0.0, uPx.y)).rgb + texture(uVid, uv - vec2(0.0, uPx.y)).rgb) * 0.25;
    vec2 d = uPx * 9.0;
    float yb = 0.25 * (luma(textureLod(uVid, uv + vec2(d.x, d.y), 3.5).rgb) + luma(textureLod(uVid, uv + vec2(-d.x, d.y), 3.5).rgb)
                     + luma(textureLod(uVid, uv + vec2(d.x, -d.y), 3.5).rgb) + luma(textureLod(uVid, uv - d, 3.5).rgb));
    float mid = 1.0 - abs(2.0 * y0 - 1.0);
    c = clamp(c + uDetail.x * (y0 - yn) + uDetail.y * (y0 - yb) * mid, 0.0, 1.0);

    // L'écran du portable. Coordonnées sur l'affichage et leurs dérivées calculées avant toute branche par pixel.
    vec2 Xs = uv * vec2(${W}.0, ${H}.0) - 0.5;                    // px de la vidéo (centre du pixel sur l'entier)
    vec2 span = 1.0 - uScrIn.xy - uScrIn.zw;
    vec3 hs = uScrHi * vec3(Xs, 1.0);
    vec2 sd = (hs.xy / hs.z - uScrIn.xy) / span;                     // 0..1 sur l'affichage
    vec2 sdx = dFdx(sd), sdy = dFdy(sd);
    if (uScr.x > 0.001) {
      // ce qui n'est pas du verre ne reçoit rien : le liseré clair du capot, la haie qui passerait devant
      float gr = c.g - 0.5 * (c.r + c.b);
      float glass = (1.0 - smoothstep(0.03, 0.07, gr)) * (1.0 - smoothstep(0.35, 0.55, luma(c)));
      // flou de bougé : l'affichage glisse comme la caméra pendant l'exposition (une demi-image)
      vec3 hp = uScrHp * vec3(sd * span + uScrIn.xy, 1.0);
      vec2 vel = Xs - hp.xy / hp.z;
      vec2 px = vec2(length(vec2(sdx.x, sdy.x)), length(vec2(sdx.y, sdy.y)));   // part de l'affichage par px
      vec3 acc = vec3(0.0); float cov = 0.0;
      for (int k = 0; k < 5; k++) {
        float t = (float(k) - 2.0) * 0.125;
        vec3 ht = uScrHi * vec3(Xs - vel * t, 1.0);
        vec2 d = (ht.xy / ht.z - uScrIn.xy) / span;
        // couverture des bords de l'affichage, au pixel près
        vec2 e = min(d, 1.0 - d) / max(px, 1e-5);
        float w = clamp(e.x + 0.5, 0.0, 1.0) * clamp(e.y + 0.5, 0.0, 1.0);
        acc += lin(textureGrad(uScrImg, clamp(d, 0.0, 1.0), sdx * uScr.z, sdy * uScr.z).rgb) * w;
        cov += w;
      }
      acc /= 5.0; cov /= 5.0;
      // la lumière émise par l'écran s'ajoute à ce que le verre reflétait (reflets et ciel gardés) ; les fondus
      // l'assombrissent comme un écran qui s'allume ou se détourne, sans jamais le rendre transparent
      vec3 lit = lin(c) + acc * uScr.y;
      c = mix(c, srgb(lit), cov * glass);
    }

    vec3 L = lin(c);
    vec3 s = toLab(L);
    float key = smoothstep(0.025, 0.975, texture(uPack, vec2(uv.x, 0.5 + clamp(uv.y, 0.5 / 720.0, 1.0 - 0.5 / 720.0) * 0.5)).g); // seuil doux : efface le résidu de compression
    // pellicule : courbe en S sur la clarté, verts éteints vers l'olive, ombres vers l'encre, hautes lumières vers le papier
    float t = scurve(pow(clamp((s.x - uTone.x) / (uTone.y - uTone.x), 0.0, 1.0), uTone.w), uTone.z);
    float C = length(s.yz), hue = atan(s.z, s.y);
    float green = smoothstep(0.55, 0.3, abs(hue - 2.25));
    hue -= green * 0.12;
    C *= mix(0.74, 0.56, green);
    vec3 lab = vec3(mix(uInk.x, uPaper.x, t), C * vec2(cos(hue), sin(hue)) + mix(uInk.yz, uPaper.yz, t) * 0.9);
    // La chaise dans la couleur d'accent. Sa clarté est celle de la chaise d'origine, décalée de l'écart entre l'accent et le
    // plastique éclairé (0,72) : ombres, arêtes et reflets restent ceux de la prise de vue. Sa chroma suit celle de l'origine,
    // lissée (la couleur de la vidéo est enregistrée à demi-résolution et bruitée) ; teinte de l'accent ; puis retour dans la gamme.
    // La chroma suit la clarté (une matière à l'ombre garde sa saturation relative, elle ne vire pas au rouge sang),
    // modulée par la saturation relative de l'origine (les reflets pâlissent) ; l'intérieur des panneaux est un peu débruité.
    if (key > 0.002) {
      vec3 sb = toLab(lin(textureLod(uVid, uv, 1.0).rgb));
      float Ca = length(uAcc.yz);
      vec2 ha = uAcc.yz / max(Ca, 1e-5);
      float Lc = clamp(mix(s.x, sb.x, 0.5) + (uAcc.x - 0.72), 0.04, 0.985);
      float rs = (length(sb.yz) / max(sb.x, 0.05)) / (0.12 / 0.72);
      float Cc = Ca * (Lc / max(uAcc.x, 0.05)) * clamp(rs, 0.3, 1.1);
      lab = mix(lab, gamut(vec3(Lc, ha * Cc)), key);
    }
    o = vec4(srgb(fromLab(lab)), 1.0 - 0.5 * key); // alpha : moitié moins de grain sur la chaise
  }`;

  // 2. La post-production : le socle commun des compositions de glitch.js. Chaque composition écrit
  //    vec4 comp(vec4 base, inout vec4 st) : la couleur affichée (alpha = part du grain) et, si elle en a une, sa mémoire.
  //    Repère : P en fractions de l'image (origine en haut à gauche), Px en pixels de la vidéo.
  const FX_HEAD = `${COMMON.replace('out vec4 o;', 'layout(location = 0) out vec4 o; layout(location = 1) out vec4 o2;')}
  precision highp sampler2DArray;
  uniform sampler2D uImg, uVid, uPack, uState;
  uniform sampler2DArray uHist;
  uniform int uLag[8];               // couche de l'historique qui tient l'image d'il y a n images
  uniform float uF, uReset, uSplit;  // image du film, mémoire à repartir, avant/après (x de la coupure, -1 sans)
  uniform vec2 uRes;
  uniform vec4 uBox;                 // boîte du sujet (fractions du cadre)
  uniform vec3 uInk, uPaper, uAcc;   // OKLab
  uniform vec4 uEv[4];               // événements collés aux haies : centre (px), enveloppe, avancée
  uniform vec4 uEvM[4];              // axes locaux (px par pas local) à cette image
  uniform vec4 uEvP[4];              // centre à l'image précédente, graine, rayon (px)
  uniform vec4 uEvPM[4];             // axes locaux à l'image précédente
  vec2 P, Px;
  vec2 tu(vec2 Q) { return vec2(Q.x, 1.0 - Q.y); }
  vec3 img(vec2 Q) { return texture(uImg, tu(Q)).rgb; }
  vec3 imgL(vec2 Q, float l) { return textureLod(uImg, tu(Q), l).rgb; }
  vec3 hist(vec2 Q, int n) { return texture(uHist, vec3(tu(Q), float(uLag[n]))).rgb; }
  vec4 mem(vec2 Q) { return texture(uState, tu(Q)); }                                // la mémoire de l'image précédente
  vec3 vidL(vec2 Q, float l) { return textureLod(uVid, Q, l).rgb; }
  vec3 paperRGB() { return srgb(fromLab(uPaper)); }
  vec3 inkRGB() { return srgb(fromLab(uInk)); }
  // la haie : vert franc de la prise de vue (teinte 102 à 132°, chroma > 0,02)
  float green(vec2 Q, float l) {
    vec3 s = toLab(lin(vidL(Q, l)));
    float C = length(s.yz), h = degrees(atan(s.z, s.y));
    return clamp((C - 0.02) / 0.025, 0.0, 1.0) * clamp(1.0 - (abs(h - 117.0) - 15.0) / 15.0, 0.0, 1.0);
  }
  float chair(vec2 Q) { return texture(uPack, vec2(Q.x, 0.5 + clamp(Q.y, 0.0007, 0.9993) * 0.5)).g; }
  // le sujet : ce qui n'est pas de la haie dans sa boîte, plus la chaise ; les glitchs s'y effacent
  // distance à la boîte du sujet (coins arrondis), en hauteurs d'image ; négative dedans
  float boxDist(vec2 Q) {
    vec2 k = vec2(16.0 / 9.0, 1.0), c = 0.5 * (uBox.xy + uBox.zw), h = 0.5 * (uBox.zw - uBox.xy) * k;
    float r = 0.5 * min(h.x, h.y);
    vec2 d = abs(Q - c) * k - (h - r);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  }
  // loin du sujet : 0 dans sa boîte, 1 au-delà d'une marge (pour les glitchs qui vont chercher l'image ailleurs ou avant)
  float farFromSubject(vec2 Q, float margin) { return smoothstep(0.0, margin, boxDist(Q)); }
  float subject(vec2 Q) {
    float inBox = 1.0 - smoothstep(-0.02, 0.05, boxDist(Q));
    return max(inBox * (1.0 - smoothstep(0.2, 0.6, green(Q, 2.0))), smoothstep(0.02, 0.3, chair(Q)));
  }
  mat2 evM(int i) { return mat2(uEvM[i].xy, uEvM[i].zw); }
  vec2 evLocal(int i, vec2 X) { return inverse(evM(i)) * (X - uEv[i].xy); }
  // où était, à l'image précédente, le point de la scène qui est en X (px)
  vec2 evPrev(int i, vec2 X) { return uEvP[i].xy + mat2(uEvPM[i].xy, uEvPM[i].zw) * evLocal(i, X); }
  float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 17.1) + 0.2 * vnoise(p * 4.01 + 41.7); }
  vec4 comp(vec4 base, inout vec4 st);
  void main() {
    P = vec2(vUv.x, 1.0 - vUv.y); Px = P * uRes;
    vec4 base = texture(uImg, vUv);
    vec4 st = vec4(0.0);
    vec4 c = comp(base, st);
    o = P.x < uSplit ? base : c;
    o2 = st;
  }
  `;

  const FS_COPY = `${COMMON}
  uniform sampler2D uImg;
  void main() { o = texture(uImg, vUv); }`;

  // 3. L'affichage : bicubique (Catmull-Rom) ou mipmaps si l'image est réduite, cadrage, grain, tramage.
  const FS_SHOW = `${COMMON}
  uniform sampler2D uImg, uGrain;
  uniform vec2 uSrc;
  uniform vec4 uCrop;      // origine et taille de la fenêtre dans l'image (repère GL)
  uniform float uLod;
  uniform vec4 uGOff;      // décalages du grain pour cette image du film
  uniform vec3 uG;         // taille d'un grain (px de l'écran), intensité, intensité du second tirage
  vec4 bicubic(vec2 uv) {
    vec2 p = uv * uSrc, t1 = floor(p - 0.5) + 0.5, f = p - t1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2, t0 = (t1 - 1.0) / uSrc, t3 = (t1 + 2.0) / uSrc, t12 = (t1 + w2 / w12) / uSrc;
    vec4 r = texture(uImg, vec2(t0.x, t0.y)) * w0.x * w0.y + texture(uImg, vec2(t12.x, t0.y)) * w12.x * w0.y
           + texture(uImg, vec2(t3.x, t0.y)) * w3.x * w0.y + texture(uImg, vec2(t0.x, t12.y)) * w0.x * w12.y
           + texture(uImg, vec2(t12.x, t12.y)) * w12.x * w12.y + texture(uImg, vec2(t3.x, t12.y)) * w3.x * w12.y
           + texture(uImg, vec2(t0.x, t3.y)) * w0.x * w3.y + texture(uImg, vec2(t12.x, t3.y)) * w12.x * w3.y
           + texture(uImg, vec2(t3.x, t3.y)) * w3.x * w3.y;
    return r;
  }
  float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  void main() {
    vec2 uv = uCrop.xy + vUv * uCrop.zw;
    vec4 c4 = uLod > 0.0 ? textureLod(uImg, uv, uLod) : bicubic(uv);
    vec3 c = c4.rgb;
    if (uG.y > 0.0) {
      vec2 q = gl_FragCoord.xy / (uG.x * 512.0);
      float n = (texture(uGrain, q + uGOff.xy).r - 0.5) * 8.0 * 0.8 + (texture(uGrain, q * 0.47 + uGOff.zw).r - 0.5) * 8.0 * uG.z;
      float y = luma(c);
      float amp = uG.y * (0.3 + 0.7 * smoothstep(0.02, 0.3, y) * (1.0 - smoothstep(0.62, 0.98, y))) * clamp(c4.a, 0.5, 1.0);
      c += n * amp;
      // le grain ne doit pas faire déborder une couleur vive (le corail est au bord de la gamme) : on désature, sans changer la clarté
      float mxc = max(c.r, max(c.g, c.b));
      if (mxc > 1.0) { float yy = luma(c); c = yy + (c - yy) * clamp((1.0 - yy) / max(mxc - yy, 1e-4), 0.0, 1.0); }
    }
    c += (hash(gl_FragCoord.xy + uGOff.xy * 997.0) - 0.5) / 255.0;
    o = vec4(c, 1.0);
  }`;

  function program(fs) {
    const p = gl.createProgram();
    for (const [type, srcText] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, srcText);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, ut = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name); ut[name] = info.type;
    }
    return { p, u, ut };
  }
  function texture(w, h, internal, levels, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, levels, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : (filter || gl.LINEAR));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }

  let P, texPack, texVid, texImg, fbPack, fbVid, fbImg, texGrain, texScr, imgLevels, half;
  try {
    P = { grade: program(FS_GRADE), show: program(FS_SHOW), copy: program(FS_COPY) };
    const levels = (w, h) => Math.floor(Math.log2(Math.max(w, h))) + 1;
    // le paquet tel qu'il arrive (film et détourage), puis le film seul recopié à part pour ses mipmaps (contraste local)
    texPack = texture(W, 2 * H, gl.RGBA8, 1);
    fbPack = target(texPack);
    texVid = texture(W, H, gl.RGBA8, levels(W, H));
    fbVid = target(texVid);
    // Le tirage en demi-flottant si la carte sait y peindre (dégradés de la brume sans paliers), sinon sur 8 bits.
    half = !!gl.getExtension('EXT_color_buffer_float');
    imgLevels = levels(W, H);
    texImg = texture(W, H, half ? gl.RGBA16F : gl.RGBA8, imgLevels);
    fbImg = target(texImg);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('cible incomplète');
    texGrain = grainTexture(512);
    texScr = gl.createTexture();
  } catch (err) {
    canvas.remove();
    fallback();
    console.warn('Film : WebGL2 indisponible, vidéo seule.', err);
    return;
  }
  gl.bindVertexArray(gl.createVertexArray());
  packed = true;

  // Grain : bruit gaussien filtré (sigma 0,75 texel), raccordable en mosaïque, d'écart type 1 stocké autour de 0,5.
  function grainTexture(n) {
    const a = new Float32Array(n * n);
    for (let i = 0; i < a.length; i += 2) {
      const u = Math.random() || 1e-9, v = Math.random(), r = Math.sqrt(-2 * Math.log(u));
      a[i] = r * Math.cos(2 * Math.PI * v); a[i + 1] = r * Math.sin(2 * Math.PI * v);
    }
    const k = [], sig = 0.75;
    for (let i = -2; i <= 2; i++) k.push(Math.exp(-(i * i) / (2 * sig * sig)));
    const ks = k.reduce((x, y) => x + y, 0);
    for (let i = 0; i < 5; i++) k[i] /= ks;
    const blur = (src, dx, dy) => {
      const out = new Float32Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let s = 0;
        for (let i = -2; i <= 2; i++) s += k[i + 2] * src[((y + i * dy + n) % n) * n + ((x + i * dx + n) % n)];
        out[y * n + x] = s;
      }
      return out;
    };
    const b = blur(blur(a, 1, 0), 0, 1);
    let v = 0;
    for (let i = 0; i < b.length; i++) v += b[i] * b[i];
    const sd = Math.sqrt(v / b.length);
    const data = new Uint8Array(n * n);
    for (let i = 0; i < b.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(128 + (b[i] / sd) * 32)));
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  /* ---------- Couleurs des tokens, en OKLab ---------- */
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function cssRgb(name, fallback) {
    probe.fillStyle = fallback;
    probe.fillStyle = getComputedStyle(root).getPropertyValue(name).trim() || fallback;
    probe.fillRect(0, 0, 1, 1);
    return probe.getImageData(0, 0, 1, 1).data;
  }
  function cssLab(name, fallback) {
    const [r, g, b] = cssRgb(name, fallback);
    const li = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const R = li(r), G = li(g), B = li(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  let ink, paper, acc;
  function readTheme() {
    const night = cssLab('--night', '#171816');
    ink = [night[0] * 0.78, night[1], night[2]]; // un noir un peu plus profond que la capsule, de la même encre
    paper = cssLab('--paper', '#F4F2EF');
    acc = cssLab('--accent', '#FF7360');
  }
  readTheme();
  // Le canevas couvre la vidéo dès maintenant (le paquet n'est pas fait pour être vu), dans la couleur de la capsule.
  {
    const [r, g, b] = cssRgb('--night', '#171816');
    gl.clearColor(r / 255, g / 255, b / 255, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    reel.classList.add('is-gl');
  }

  // Réglages du tirage : tonalité (noir, blanc, contraste, gamma), détail (piqué, contraste local), grain (taille, intensité, second tirage).
  const TUNE = { tone: [0.10, 0.97, 1.08, 0.94], detail: [0.15, 0.3], grain: [0.85, 0.026, 0.3] };
  window.TOPIARY_REEL_TUNE = TUNE; // pour les bancs d'essai

  /* ---------- La post-production ---------- */
  // Boîte du sujet à chaque image (personnage, ordinateur, chaise), en fractions du cadre.
  const BOX = DATA.box.map((v) => v / 1000);
  let fx = null;             // la composition active : programme, historique, mémoire
  const progs = {};          // programmes compilés, par composition
  let split = -1;            // avant/après : x de la coupure (fractions de l'image), -1 sans
  const fxWanted = () => comp !== 'net' && !reduce.matches;
  function fxRelease() {
    if (!fx) return;
    if (fx.hist) { gl.deleteTexture(fx.hist.tex); gl.deleteFramebuffer(fx.hist.fb); }
    if (fx.state) fx.state.forEach((s) => { gl.deleteTexture(s.tex); gl.deleteFramebuffer(s.fb); });
    gl.deleteTexture(fx.out);
    if (fx.fbOut) gl.deleteFramebuffer(fx.fbOut);
    fx = null;
  }
  function fxSetup() {
    const def = GLITCH.comps.find((c) => c.id === comp);
    if (!fxWanted() || !def) { fxRelease(); return; }
    if (fx && fx.def === def) return;
    fxRelease();
    try {
      if (!progs[def.id]) progs[def.id] = program(FX_HEAD + def.glsl);
      const f = { def, prog: progs[def.id], lastF: -1, count: 0 };
      f.out = texture(W, H, half ? gl.RGBA16F : gl.RGBA8, imgLevels);
      if (def.hist) {
        const K = Math.min(8, def.hist);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, W, H, K);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        f.hist = { tex: t, fb: gl.createFramebuffer(), K, frames: new Array(K).fill(-1e9), head: 0 };
      }
      if (def.state) {
        // deux mémoires qui s'échangent, chacune avec la sortie en premier attachement
        f.state = [0, 1].map(() => {
          const tex = texture(W, H, half ? gl.RGBA16F : gl.RGBA8, 1);
          const fb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.out, 0);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex, 0);
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
          return { tex, fb };
        });
        f.cur = 0;
      } else f.fbOut = target(f.out);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('cible incomplète');
      fx = f;
    } catch (err) {
      console.warn('Film : composition indisponible, pellicule seule.', def.id, err);
      fxRelease();
    }
  }
  function pushHistory(count) {
    const h = fx.hist;
    h.head = (h.head + 1) % h.K;
    copyInto(h, h.head);
    h.frames[h.head] = count;
  }
  function copyInto(h, layer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, h.fb);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, h.tex, 0, layer);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.copy.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
    gl.uniform1i(P.copy.u.uImg, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // Enveloppe d'un événement : montée et descente adoucies (fractions de sa durée).
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function envelope(k, len, att, rel) { const p = (k + 0.5) / len; return smooth(0, att, p) * (1 - smooth(1 - rel, 1, p)); }
  // Valeurs des uniformes par leur type (les compositions en déclarent à leur guise).
  function setUniform(pr, name, v) {
    const loc = pr.u[name];
    if (loc == null) return;
    const a = typeof v === 'number' ? [v] : v;
    switch (pr.ut[name]) {
      case gl.FLOAT: gl.uniform1fv(loc, a); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(loc, a); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(loc, a); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(loc, a); break;
      case gl.INT: gl.uniform1iv(loc, a); break;
      default: break;
    }
  }
  function runFx() {
    const F = filmFrame(lastTime);
    const dF = fx.lastF < 0 ? -1 : (F - fx.lastF + FRAMES) % FRAMES;
    const step = dF >= 1 && dF <= 3, reset = !step && dF !== 0;
    if (reset) {
      fx.count = 0;
      if (fx.hist) { for (let i = 0; i < fx.hist.K; i++) { copyInto(fx.hist, i); fx.hist.frames[i] = 0; } fx.hist.head = 0; }
    } else if (step) {
      fx.count += dF;
      if (fx.hist) pushHistory(fx.count);
    }
    fx.lastF = F;
    const pr = fx.prog, def = fx.def;
    gl.useProgram(pr.p);
    gl.viewport(0, 0, W, H);
    // mémoire : on lit l'une, on écrit l'autre (on ne l'échange qu'en avançant d'une image)
    let src = null;
    if (fx.state) {
      src = fx.state[fx.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, fx.state[1 - fx.cur].fb);
    } else gl.bindFramebuffer(gl.FRAMEBUFFER, fx.fbOut);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texVid);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texPack);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, src ? src.tex : texImg);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, fx.hist ? fx.hist.tex : null);
    gl.uniform1i(pr.u.uImg, 0);
    if (pr.u.uVid) gl.uniform1i(pr.u.uVid, 1);
    if (pr.u.uPack) gl.uniform1i(pr.u.uPack, 2);
    if (pr.u.uState) gl.uniform1i(pr.u.uState, 3);
    if (pr.u.uHist) gl.uniform1i(pr.u.uHist, 4);
    if (fx.hist && pr.u.uLag) {
      // pour chaque retard n, la couche qui tient l'image la plus proche de (maintenant - n), sans aller dans le futur
      const h = fx.hist, lag = new Int32Array(8);
      for (let n = 0; n < 8; n++) {
        const want = fx.count - n;
        let best = h.head, bf = -1e9;
        for (let i = 0; i < h.K; i++) if (h.frames[i] <= want && h.frames[i] > bf) { bf = h.frames[i]; best = i; }
        if (bf === -1e9) { let lo = 1e9; for (let i = 0; i < h.K; i++) if (h.frames[i] < lo) { lo = h.frames[i]; best = i; } }
        lag[n] = best;
      }
      gl.uniform1iv(pr.u.uLag, lag);
    }
    setUniform(pr, 'uF', F);
    setUniform(pr, 'uReset', reset ? 1 : 0);
    if (split < 0) setUniform(pr, 'uSplit', -1);
    else { const v = view(); setUniform(pr, 'uSplit', v[0] + split * v[2]); } // la coupure est donnée à l'écran
    setUniform(pr, 'uRes', [W, H]);
    setUniform(pr, 'uBox', BOX.length ? BOX.slice(F * 4, F * 4 + 4) : [0, 0, 0, 0]);
    setUniform(pr, 'uInk', ink); setUniform(pr, 'uPaper', paper); setUniform(pr, 'uAcc', acc);
    // événements collés aux haies (données de glitch-data.js)
    const evs = (DATA.ev && DATA.ev[def.id]) || def.events || [];
    const E = new Float32Array(16), EM = new Float32Array(16), EP = new Float32Array(16), EPM = new Float32Array(16);
    for (let i = 0; i < 4; i++) { EM.set([1, 0, 0, 1], i * 4); EPM.set([1, 0, 0, 1], i * 4); }
    let slot = 0;
    const active = [];
    for (const e of evs) {
      const k = F - e.f0;
      if (k < 0 || k >= e.len || slot >= 4) continue;
      const env = envelope(k, e.len, def.attack || 0.25, def.release || 0.3);
      active.push({ e, k, env });
      if (e.t) {
        const r = e.t.slice(k * 6, k * 6 + 6), q = k > 0 ? e.t.slice((k - 1) * 6, k * 6) : r;
        E.set([r[0], r[1], env, k / Math.max(1, e.len - 1)], slot * 4);
        EM.set([r[2], r[3], r[4], r[5]], slot * 4);
        EP.set([q[0], q[1], e.seed || 0, e.r || 100], slot * 4);
        EPM.set([q[2], q[3], q[4], q[5]], slot * 4);
      }
      slot++;
    }
    setUniform(pr, 'uEv', E); setUniform(pr, 'uEvM', EM); setUniform(pr, 'uEvP', EP); setUniform(pr, 'uEvPM', EPM);
    // réglages propres à la composition
    if (def.uniforms) {
      const extra = def.uniforms(F, active, { envelope, smooth, W, H, FRAMES });
      for (const name in extra) setUniform(pr, name, extra[name]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (fx.state && (step || reset)) fx.cur = 1 - fx.cur;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fx.out); gl.generateMipmap(gl.TEXTURE_2D);
  }

  /* ---------- Rendu ---------- */
  let hasFrame = false, poster = null, frameNo = 0, lastTime = 0;

  function upload(source) {
    gl.bindTexture(gl.TEXTURE_2D, texPack);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, 2 * H, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // le film (lignes 0 à 719 du paquet) recopié seul, puis ses mipmaps
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbPack);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbVid);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, texVid);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  /* ---------- L'écran du portable ---------- */
  // Les coins du verre, image par image (glitch-data.js, clé « screen ») ; l'image affichée : data-screen sur #reel, sinon film/ecran.webp.
  // ?ecran=0 ou #sans-ecran : le film sans l'écran (comparaison).
  const SCR = DATA.screen;
  const scrOff = params.get('ecran') === '0' || location.hash === '#sans-ecran';
  let scrReady = false;
  if (SCR && !scrOff) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texScr);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension('EXT_texture_filter_anisotropic');
      if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      scrReady = true;
      if (hasFrame) redraw();
    };
    addEventListener('load', () => { img.src = reel.dataset.screen || 'film/ecran.webp'; }, { once: true });
  }
  // Réglages : fondus d'entrée et de sortie (images), luminosité de l'écran au soleil, douceur de l'image (1 : nette ;
  // au-delà, aussi floue que le film), marges du verre (part de sa largeur et de sa hauteur : gauche, haut, droite, bas).
  const SCR_TUNE = { fadeIn: [111, 116], fadeOut: [144, 150], bright: 0.3, soft: 1.6, inset: [0.025, 0.035, 0.025, 0.055] };
  window.TOPIARY_SCREEN_TUNE = SCR_TUNE;
  const scrQuad = (f) => { const i = (f - SCR.f0) * 8; return SCR.q.slice(i, i + 8); };
  // homographie du carré unité vers le quadrilatère (h33 = 1), en colonnes pour WebGL
  function homog(q) {
    const A = [], b = [];
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], k) => {
      const x = q[2 * k], y = q[2 * k + 1];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    });
    for (let i = 0; i < 8; i++) {                       // élimination de Gauss avec pivot
      let m = i;
      for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const h = new Array(8);
    for (let i = 7; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < 8; c++) s -= A[i][c] * h[c]; h[i] = s / A[i][i]; }
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];   // lignes
  }
  function inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
            C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  const cols = (m) => new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  const area = (q) => 0.5 * Math.abs((q[0] * q[3] - q[2] * q[1]) + (q[2] * q[5] - q[4] * q[3]) + (q[4] * q[7] - q[6] * q[5]) + (q[6] * q[1] - q[0] * q[7]));
  let scrMaxArea = 0;
  if (SCR) for (let f = SCR.f0; f < SCR.f0 + SCR.len; f++) scrMaxArea = Math.max(scrMaxArea, area(scrQuad(f)));
  function screenUniforms(g) {
    const F = filmFrame(lastTime);
    const on = scrReady && !reduce.matches && F >= SCR.f0 && F < SCR.f0 + SCR.len;
    const fade = on ? smooth(SCR_TUNE.fadeIn[0], SCR_TUNE.fadeIn[1], F) * (1 - smooth(SCR_TUNE.fadeOut[0], SCR_TUNE.fadeOut[1], F)) : 0;
    if (fade <= 0) { gl.uniform4f(g.u.uScr, 0, 0, 0, 0); return; }
    const q = scrQuad(F), qp = scrQuad(Math.max(SCR.f0, F - 1));
    // un écran vu de biais paraît plus sombre : luminosité selon sa surface apparente
    const ang = smooth(0.4, 0.9, area(q) / scrMaxArea);
    gl.uniform4f(g.u.uScr, 1, SCR_TUNE.bright * (0.55 + 0.45 * ang) * fade, SCR_TUNE.soft, 0);
    gl.uniformMatrix3fv(g.u.uScrHi, false, cols(inv3(homog(q))));
    gl.uniformMatrix3fv(g.u.uScrHp, false, cols(homog(qp)));
    gl.uniform4fv(g.u.uScrIn, SCR_TUNE.inset);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texScr);
    gl.uniform1i(g.u.uScrImg, 2);
  }

  function grade() {
    gl.viewport(0, 0, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbImg);
    const g = P.grade;
    gl.useProgram(g.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texVid);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texPack);
    // unité 2 : l'image de l'écran du portable, jamais le tirage qu'on peint ici (après l'écran, elle restait liée au tirage :
    // boucle de rétroaction refusée par WebGL, une image du film sautait à chaque boucle)
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texScr);
    gl.uniform1i(g.u.uVid, 0); gl.uniform1i(g.u.uPack, 1); gl.uniform1i(g.u.uScrImg, 2);
    gl.uniform2f(g.u.uPx, 1 / W, 1 / H);
    gl.uniform3fv(g.u.uInk, ink); gl.uniform3fv(g.u.uPaper, paper); gl.uniform3fv(g.u.uAcc, acc);
    gl.uniform4fv(g.u.uTone, TUNE.tone);
    gl.uniform2fv(g.u.uDetail, TUNE.detail);
    if (SCR) screenUniforms(g); else gl.uniform4f(g.u.uScr, 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg); gl.generateMipmap(gl.TEXTURE_2D);
  }
  const rnd = (n, k) => { const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  // Fenêtre affichée (fractions de l'image, origine en haut à gauche) : toute la hauteur (ou toute la largeur) de l'image,
  // centrée sur le sujet autant que possible.
  function view() {
    const ac = (canvas.width || 16) / (canvas.height || 9), av = W / H;
    const fw = ac < av ? ac / av : 1, fh = ac < av ? 1 : av / ac;
    const [sx, sy] = trackAt(lastTime);
    const cx = Math.min(1 - fw / 2, Math.max(fw / 2, sx)), cy = Math.min(1 - fh / 2, Math.max(fh / 2, sy));
    return [cx - fw / 2, cy - fh / 2, fw, fh];
  }
  function show() {
    const cw0 = canvas.width, ch0 = canvas.height;
    if (!cw0 || !ch0) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw0, ch0);
    const s = P.show;
    gl.useProgram(s.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fx ? fx.out : texImg);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texGrain);
    gl.uniform1i(s.u.uImg, 0); gl.uniform1i(s.u.uGrain, 1);
    gl.uniform2f(s.u.uSrc, W, H);
    const [x0, y0, fw, fh] = view();
    gl.uniform4f(s.u.uCrop, x0, 1 - y0 - fh, fw, fh);
    const scale = cw0 / (fw * W); // pixels d'écran par pixel de la vidéo
    gl.uniform1f(s.u.uLod, scale < 0.85 ? Math.log2(1 / scale) : 0);
    const dpr = cw0 / Math.max(1, canvas.clientWidth);
    gl.uniform3f(s.u.uG, TUNE.grain[0] * Math.max(1, dpr * 0.8), TUNE.grain[1], TUNE.grain[2]);
    const f = reduce.matches ? 0 : frameNo;
    gl.uniform4f(s.u.uGOff, rnd(f, 1), rnd(f, 2), rnd(f, 3), rnd(f, 4));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(time, fresh) {
    if (fresh) {
      if (video.readyState >= 2 && video.videoWidth === W && video.videoHeight === 2 * H) { upload(video); hasFrame = true; }
      else if (poster && !hasFrame) upload(poster);
      else return;
      lastTime = time;
      frameNo = Math.round(time * FPS);
      grade();
      fxSetup();
      if (fx) runFx();
    }
    show();
  }

  // Image d'attente : la première image du paquet, tirée comme la suite.
  if (reel.dataset.posterPack) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (img.naturalWidth !== W || img.naturalHeight !== 2 * H) return; poster = img; if (!hasFrame) frame(0, true); };
    img.src = reel.dataset.posterPack;
  }
  // Chaque nouvelle image du film (requestVideoFrameCallback donne l'instant exact de l'image présentée).
  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const onVideoFrame = (now, meta) => { frame(meta.mediaTime, true); reel.classList.add('is-gl'); video.requestVideoFrameCallback(onVideoFrame); };
  if (rvfc) video.requestVideoFrameCallback(onVideoFrame);
  else {
    let last = -1;
    const tick = () => { if (!video.paused && video.currentTime !== last) { last = video.currentTime; frame(last, true); reel.classList.add('is-gl'); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  video.addEventListener('loadeddata', () => frame(video.currentTime, true));
  video.addEventListener('seeked', () => frame(video.currentTime, true));

  // Taille du canevas en pixels de l'écran (deux au plus par pixel CSS : au-delà, le grain ne se voit plus et le coût double).
  new ResizeObserver(([e]) => {
    const box = e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0];
    const dpr = devicePixelRatio || 1, cap = Math.min(1, 2 / dpr);
    const w = Math.max(1, Math.round((box ? box.inlineSize : e.contentRect.width * dpr) * cap));
    const h = Math.max(1, Math.round((box ? box.blockSize : e.contentRect.height * dpr) * cap));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      if (hasFrame || poster) show(); else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
  }).observe(canvas);

  const redraw = () => (hasFrame || poster) && frame(lastTime, true);
  root.addEventListener('topiary:theme', () => { readTheme(); redraw(); });
  reduce.addEventListener('change', redraw);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); reel.classList.remove('is-gl'); canvas.remove(); fallback(); });

  /* ---------- Pour le panneau de revue, la planche de comparaison et les bancs ---------- */
  window.TOPIARY_REEL = {
    comps: COMPS,
    get: () => comp,
    set(id) {
      if (!COMPS.some((c) => c.id === id) || id === comp) return;
      comp = id;
      redraw();
      root.dispatchEvent(new CustomEvent('topiary:film', { detail: id }));
    },
    // instants des glitchs de la composition (en images du film), pour sauter au suivant
    events(id) {
      const c = id || comp, def = GLITCH.comps.find((d) => d.id === c);
      if (!def) return [];
      return ((DATA.ev && DATA.ev[c]) || def.events || []).map((e) => [e.f0, e.len, e.label || '']);
    },
    split(x) { split = x; redraw(); },              // x : fraction de la largeur affichée, -1 sans coupure
    active: () => (fx ? fx.def.id : null), // composition réellement peinte (aucune en mouvements réduits)
    redraw,
    video,
    FPS, FRAMES,
  };
  // ?filmt=4.2 : pose le film à cet instant, en pause (captures de revue)
  if (params.has('filmt')) {
    userPaused = true;
    load();
    const t = parseFloat(params.get('filmt')) || 0;
    video.addEventListener('loadedmetadata', () => { video.currentTime = t; }, { once: true });
  }
})();
