// Topiary v4 : la signature du hero, « Lettres de buis » (le mot en haie taillée, en WebGL2, avec ses deux enfants corail),
// retenue par l'utilisateur le 2026-10-20. Les dix-sept autres signatures, les variantes des courbes de niveau et le calque
// d'alt-shift sont rangés dans archive/2026-10-20-signatures/ (l'ancien fichier entier, avec les vignettes du panneau).
(function (g) {
  const SIG = g.TOPIARY_SIG;
  const R = SIG.register;

  // Distance euclidienne exacte (carrés, en place ; Felzenszwalb et Huttenlocher) : sert à la distance signée des lettres
  const edt1 = (src, len, out, v, z) => {
    let k2 = 0;
    v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let q = 1; q < len; q++) {
      let s = (src[q] + q * q - (src[v[k2]] + v[k2] * v[k2])) / (2 * q - 2 * v[k2]);
      while (s <= z[k2]) { k2--; s = (src[q] + q * q - (src[v[k2]] + v[k2] * v[k2])) / (2 * q - 2 * v[k2]); }
      k2++; v[k2] = q; z[k2] = s; z[k2 + 1] = 1e20;
    }
    k2 = 0;
    for (let q = 0; q < len; q++) { while (z[k2 + 1] < q) k2++; out[q] = (q - v[k2]) ** 2 + src[v[k2]]; }
  };
  const edt = (f, w, h) => { // carrés des distances, en place (Felzenszwalb et Huttenlocher)
    const n = Math.max(w, h), src = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) src[y] = f[y * w + x]; edt1(src, h, out, v, z); for (let y = 0; y < h; y++) f[y * w + x] = out[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) src[x] = f[y * w + x]; edt1(src, w, out, v, z); for (let x = 0; x < w; x++) f[y * w + x] = out[x]; }
  };

  /* 18. Lettres de buis ------------------------------------------------------------------------------------------- */
  // Le mot devient une haie de buis taillée en lettres, vue de trois quarts : chaque lettre prend une épaisseur vers
  // l'arrière (en haut à droite). Pour chaque pixel, la carte graphique remonte cette direction jusqu'à la lettre la plus
  // proche : arêtes anticrénelées au vrai (y compris les tangentes qui partent des coins), paroi qui s'éclaircit vers le
  // fond, parois tournées vers la lumière (en haut à gauche) un peu plus claires. Repli en Canvas 2D sans WebGL2.
  // Sur le « o », un enfant est assis comme sur un croissant de lune : un seul aplat d'accent, de profil, appuyé sur
  // une main, les deux jambes qui pendent devant la lettre. Il apparaît quand la haie a poussé et balance une fois la
  // jambe de devant.
  const BUIS = {
    depth: 9,          // profondeur, en unités du corps 100 du mot (un peu moins qu'un fût)
    angle: -52,        // direction de la profondeur, en degrés (vers le haut à droite)
    near: 0.2,         // part d'encre de la paroi contre la face…
    far: 0.115,        // … et au fond
    light: [-0.42, -0.91], relief: 0.3, // lumière venue du haut à gauche ; écart de teinte entre parois éclairées et à l'ombre
    grow: 1500,        // l'épaisseur pousse en 1,5 s
    // Les enfants sont retirés du hero pour le moment (2026-10-29, à la demande de l'utilisateur) : leurs tracés restent
    // ci-dessous et dans archive/2026-10-29-enfants/ ; true les remet (intro, balancement, désintégration compris)
    kids: false,
    child: { show: [950, 700], drop: 1.2, swing: [1550, 2300], amp: 15 },
    lounger: { show: [1150, 700], drop: 0.75 }, // le second, au creux du « p »
  };
  // Les deux enfants : silhouettes construites en code (outils/enfant/) sur les contours mesurés d'Onest, puis cuites en
  // courbes de Bézier. Même profil de tête pour les deux (crâne, frange, épi, petit nez retroussé, lèvre, menton), même
  // pied d'enfant ; membres balayés le long de lignes médianes à rayon variable, fondus entre eux. Unités du corps 100,
  // dans le repère de la lettre porteuse (origine du glyphe, ligne de base à 0), posés sur la face et ancrés sur le bord
  // noir : ce qui repose s'y enfonce un peu, puis la lettre le retranche (« o ») ou le masque le cache (« p »).
  // Depuis le 2026-10-28, les deux reposent sur un squelette commun d'enfant de six-sept ans (cuisse et tibia de même
  // longueur, bras, tronc ; tibia et mollet dessinés à la plume), genoux et coudes placés par cinématique inverse.
  // Même taille de tête pour les deux (un sixième de la taille), coiffures différentes : cheveux courts et un épi pour
  // celui du « o », cheveux en bol pour celui du « p ».
  // Le 2026-10-29, cous refaits : le cou monte dans l'axe du dos et entre sous le crâne, sans bosse aux épaules.
  // Celui du « o » est assis, appuyé sur une main, les deux jambes qui pendent : celle du fond lancée un peu en avant,
  // celle de devant presque à l'aplomb ; son tibia (pièce à part) pivote au genou.
  const CHILD = {
    body: 'M16.985 -50.995C16.984 -50.862 17.072 -50.583 17.252 -50.642C17.312 -50.662 17.622 -50.828 17.71 -50.87C17.807 -50.917 17.907 -50.955 18.005 -50.999C18.086 -51.035 18.163 -51.077 18.244 -51.112C18.394 -51.177 18.545 -51.239 18.694 -51.307C18.779 -51.345 18.861 -51.389 18.947 -51.425C19.299 -51.572 19.662 -51.694 20.021 -51.823C20.274 -51.915 20.525 -52.017 20.782 -52.099C21.101 -52.2 21.424 -52.29 21.747 -52.38C21.865 -52.413 22.063 -52.445 22.133 -52.555C22.215 -52.682 22.244 -52.961 22.283 -53.116C22.353 -53.391 22.47 -53.668 22.566 -53.936C22.896 -54.853 23.228 -55.771 23.488 -56.712C23.565 -56.991 23.636 -57.271 23.705 -57.552C23.748 -57.729 23.785 -57.908 23.839 -58.081C23.914 -58.326 24.019 -58.563 24.114 -58.8C24.189 -58.987 24.257 -59.175 24.353 -59.352C24.502 -59.627 24.658 -59.898 24.81 -60.171C24.935 -60.395 25.057 -60.622 25.186 -60.843C25.268 -60.983 25.439 -61.262 25.638 -61.155C25.81 -61.061 25.885 -60.753 25.938 -60.578C26.106 -60.027 26.18 -59.456 26.247 -58.886C26.334 -58.149 26.395 -57.41 26.466 -56.671C26.507 -56.248 26.534 -55.715 26.633 -55.311C26.804 -54.619 27.21 -53.998 27.766 -53.555C27.843 -53.493 27.925 -53.423 28.019 -53.388C28.142 -53.341 28.595 -53.377 28.752 -53.381C29.322 -53.395 29.891 -53.402 30.46 -53.392C30.912 -53.384 31.366 -53.382 31.818 -53.353C31.962 -53.344 32.105 -53.324 32.25 -53.313C32.431 -53.3 32.613 -53.295 32.794 -53.277C32.947 -53.261 33.099 -53.236 33.253 -53.222C33.448 -53.203 33.645 -53.203 33.839 -53.179C33.945 -53.166 34.05 -53.142 34.156 -53.126C34.285 -53.107 34.416 -53.099 34.545 -53.081C34.661 -53.066 34.775 -53.039 34.89 -53.023C35.006 -53.006 35.122 -52.999 35.238 -52.984C35.354 -52.969 35.467 -52.944 35.583 -52.926C35.689 -52.91 35.796 -52.901 35.901 -52.881C36.144 -52.837 36.382 -52.77 36.624 -52.72C37.139 -52.613 37.654 -52.506 38.158 -52.352C38.305 -52.308 38.618 -52.245 38.721 -52.139C38.775 -52.083 38.812 -52.011 38.851 -51.945C39.048 -51.604 39.107 -51.336 39.188 -50.957C39.317 -50.356 39.438 -49.809 39.67 -49.235C40.101 -48.169 40.799 -47.461 41.443 -46.543C41.933 -45.847 42.324 -45.093 42.719 -44.341C42.802 -44.184 42.891 -44.031 42.974 -43.874C43.08 -43.67 43.152 -43.452 43.15 -43.22C43.148 -42.983 43.076 -42.747 43.119 -42.51C43.177 -42.198 43.464 -41.872 43.716 -41.692C44.058 -41.448 44.25 -41.585 44.615 -41.661C44.958 -41.732 45.306 -41.775 45.655 -41.802C46.712 -41.884 47.711 -41.748 48.76 -41.738C48.885 -41.737 49.012 -41.735 49.136 -41.756C49.368 -41.796 49.685 -41.948 49.736 -42.202C49.773 -42.383 49.681 -42.56 49.589 -42.709C49.332 -43.122 49.16 -43.243 48.704 -43.409C47.814 -43.733 46.868 -43.884 45.938 -44.048C45.705 -44.089 45.159 -44.165 44.969 -44.256C44.885 -44.295 44.812 -44.354 44.755 -44.427C44.601 -44.623 44.518 -44.975 44.443 -45.216C44.285 -45.723 44.136 -46.234 43.986 -46.745C43.79 -47.412 43.59 -48.078 43.379 -48.74C43.074 -49.692 42.757 -50.639 42.503 -51.605C42.357 -52.16 42.232 -52.72 42.047 -53.265C41.923 -53.629 41.746 -54.034 41.474 -54.311C41.241 -54.549 40.946 -54.685 40.654 -54.836C40.293 -55.022 39.934 -55.211 39.57 -55.391C39.185 -55.581 38.794 -55.76 38.405 -55.941C37.314 -56.448 36.209 -56.935 35.058 -57.292C34.684 -57.408 34.306 -57.512 33.926 -57.609C33.687 -57.67 33.444 -57.722 33.209 -57.8C32.63 -57.993 32.139 -58.367 31.823 -58.893C31.632 -59.209 31.518 -59.564 31.396 -59.91C31.227 -60.388 31.06 -60.874 30.963 -61.372C30.85 -61.945 30.815 -62.53 30.731 -63.107C30.629 -63.806 30.43 -64.482 30.26 -65.166C30.185 -65.465 30.113 -65.764 30.042 -66.064C29.992 -66.277 29.949 -66.493 29.881 -66.701C29.666 -67.354 29.232 -67.836 28.855 -68.393C28.623 -68.736 28.389 -69.116 28.4 -69.544C28.404 -69.674 28.427 -69.804 28.467 -69.928C28.511 -70.065 28.574 -70.197 28.653 -70.318C28.873 -70.661 29.133 -70.778 29.458 -70.993C29.665 -71.13 29.859 -71.283 30.039 -71.453C30.143 -71.551 30.252 -71.652 30.329 -71.773C30.443 -71.954 30.397 -72.124 30.413 -72.322C30.42 -72.404 30.465 -72.482 30.452 -72.565C30.437 -72.661 30.336 -72.738 30.348 -72.838C30.368 -73.002 30.718 -72.969 30.665 -73.215C30.658 -73.245 30.646 -73.275 30.631 -73.302C30.484 -73.576 29.973 -73.738 29.91 -74.029C29.886 -74.14 29.939 -74.257 29.955 -74.366C29.967 -74.458 29.969 -74.552 29.96 -74.645C29.938 -74.888 29.861 -75.178 29.756 -75.398C29.691 -75.536 29.595 -75.66 29.536 -75.801C29.497 -75.893 29.525 -75.991 29.499 -76.085C29.452 -76.25 29.324 -76.4 29.201 -76.514C28.858 -76.832 28.391 -76.989 27.948 -77.106C27.523 -77.218 27.085 -77.337 26.643 -77.341C25.999 -77.346 25.342 -77.138 24.725 -76.977C24.543 -76.93 24.282 -76.998 24.09 -77.015C24.006 -77.022 23.882 -77.039 23.807 -76.989C23.743 -76.946 23.825 -76.891 23.863 -76.87C23.95 -76.819 24.189 -76.723 24.099 -76.586C24.057 -76.52 23.68 -76.242 23.588 -76.166C23.21 -75.853 22.814 -75.507 22.604 -75.054C22.302 -74.404 22.023 -73.64 22.256 -72.924C22.41 -72.451 22.736 -72.062 22.954 -71.619C23.022 -71.481 23.08 -71.338 23.124 -71.19C23.198 -70.943 23.221 -70.715 23.427 -70.534C23.757 -70.244 24.22 -70.218 24.601 -70.027C24.704 -69.974 24.803 -69.911 24.889 -69.832C25.052 -69.681 25.262 -69.359 25.357 -69.157C25.661 -68.508 25.348 -67.742 25.155 -67.106C25.085 -66.874 25.016 -66.641 24.96 -66.405C24.906 -66.173 24.864 -65.938 24.804 -65.708C24.675 -65.206 24.474 -64.755 24.259 -64.286C24.141 -64.027 24.022 -63.768 23.905 -63.509C23.437 -62.476 22.979 -61.438 22.519 -60.402C22.472 -60.295 22.423 -60.189 22.366 -60.087C22.235 -59.856 22.074 -59.641 21.991 -59.386C21.9 -59.11 21.889 -58.817 21.811 -58.538C21.702 -58.152 21.575 -57.771 21.467 -57.384C21.294 -56.759 21.153 -56.125 21.023 -55.49C20.939 -55.074 20.858 -54.657 20.778 -54.24C20.741 -54.049 20.705 -53.742 20.616 -53.577C20.574 -53.5 20.514 -53.434 20.441 -53.385C20.316 -53.301 19.709 -53.081 19.513 -52.996C18.762 -52.669 18.29 -52.313 17.672 -51.789C17.572 -51.705 17.473 -51.62 17.372 -51.537C17.193 -51.39 16.989 -51.251 16.985 -50.995Z',
    shin: 'M38.386 -49.892C38.386 -48.597 38.784 -47.797 39.113 -46.599C39.34 -45.773 39.458 -44.929 39.572 -44.081C39.599 -43.878 39.639 -43.675 39.661 -43.472C39.723 -42.899 39.433 -42.816 39.265 -42.416C39.125 -42.084 39.245 -41.473 39.462 -41.191C39.599 -41.013 39.825 -40.986 40.027 -40.923C40.347 -40.823 40.66 -40.697 40.964 -40.556C41.62 -40.253 42.223 -39.868 42.826 -39.473C43.164 -39.252 43.628 -38.931 43.981 -38.76C44.344 -38.583 44.868 -38.581 44.942 -39.077C44.96 -39.193 44.953 -39.31 44.947 -39.426C44.94 -39.533 44.933 -39.64 44.905 -39.744C44.81 -40.093 44.516 -40.398 44.274 -40.655C43.703 -41.26 43.064 -41.792 42.428 -42.326C42.23 -42.492 41.789 -42.84 41.648 -43.026C41.594 -43.097 41.555 -43.176 41.528 -43.26C41.438 -43.543 41.483 -43.858 41.496 -44.15C41.52 -44.681 41.555 -45.212 41.588 -45.743C41.633 -46.46 41.676 -47.178 41.705 -47.896C41.739 -48.759 41.76 -49.622 41.827 -50.483C41.872 -51.065 41.951 -51.643 41.985 -52.226C42.004 -52.547 42.032 -52.886 41.958 -53.201C41.759 -54.053 40.912 -54.902 39.988 -54.804C39.774 -54.782 39.567 -54.713 39.392 -54.586C39.217 -54.46 39.083 -54.289 38.967 -54.11C38.864 -53.951 38.596 -53.504 38.529 -53.345C38.502 -53.281 38.483 -53.214 38.475 -53.145C38.433 -52.804 38.613 -52.376 38.585 -51.938C38.566 -51.654 38.516 -51.372 38.477 -51.091C38.421 -50.693 38.387 -50.294 38.386 -49.892Z',
    knee: [40.211, -53.073],
    seat: 0,
  };
  // Celui du « p » est assis au creux de la boucle, adossé au flanc droit : bassin sur la pente, dos, épaules et arrière
  // du crâne contre la paroi, tête droite, regard levé vers le « o » ; genoux levés et serrés, un pied au fond, l'autre
  // plus haut sur la pente gauche, sur le talon. Son bras droit longe le corps ; le
  // gauche se laisse tomber par-dessus le rebord et pend devant la face de la lettre : « shown », découpée dans le
  // masque, le laisse voir.
  const LOUNGER = {
    body: 'M18.9 -15.396C18.901 -15.047 19.14 -14.801 19.38 -14.581C19.817 -14.181 20.281 -13.812 20.729 -13.423C20.922 -13.255 21.291 -12.941 21.434 -12.746C21.592 -12.528 21.613 -12.248 21.753 -12.021C21.9 -11.784 22.289 -11.502 22.517 -11.33C22.611 -11.26 22.708 -11.196 22.802 -11.126C23.03 -10.955 23.194 -10.818 23.487 -10.959C23.583 -11.005 23.664 -11.079 23.751 -11.139C23.878 -11.227 24.009 -11.305 24.115 -11.42C24.246 -11.56 24.345 -11.724 24.454 -11.882C24.571 -12.051 24.71 -12.202 24.861 -12.341C25.136 -12.593 25.429 -12.827 25.718 -13.061C26.486 -13.682 27.162 -14.2 28.025 -14.691C28.423 -14.917 28.827 -15.13 29.217 -15.369C29.321 -15.432 29.54 -15.586 29.643 -15.449C29.726 -15.338 29.677 -15.11 29.663 -14.98C29.622 -14.605 29.583 -14.229 29.545 -13.853C29.484 -13.249 29.427 -12.645 29.354 -12.043C29.324 -11.791 29.302 -11.483 29.045 -11.356C28.908 -11.288 28.745 -11.282 28.596 -11.265C28.346 -11.237 28.095 -11.21 27.845 -11.182C27.057 -11.095 26.266 -10.999 25.5 -10.789C25.113 -10.683 24.847 -10.582 24.595 -10.254C24.558 -10.206 24.428 -10.051 24.425 -9.996C24.424 -9.966 24.543 -10.01 24.564 -10.012C24.652 -10.021 24.731 -9.98 24.807 -9.942C25.12 -9.785 25.447 -9.66 25.773 -9.535C26.251 -9.354 26.773 -9.188 27.268 -9.064C27.363 -9.04 27.46 -9.024 27.555 -9.003C27.706 -8.97 27.855 -8.933 28.006 -8.901C28.11 -8.88 28.214 -8.849 28.319 -8.831C28.501 -8.799 28.689 -8.767 28.872 -8.742C29.024 -8.722 29.178 -8.71 29.33 -8.685C29.607 -8.64 29.886 -8.628 30.165 -8.598C30.333 -8.58 30.479 -8.543 30.609 -8.681C30.727 -8.805 30.782 -8.963 30.833 -9.123C30.894 -9.313 30.962 -9.505 30.97 -9.706C30.985 -10.055 30.903 -10.289 30.962 -10.668C31.022 -11.048 31.187 -11.506 31.301 -11.881C31.514 -12.581 31.735 -13.281 32.034 -13.951C32.205 -14.334 32.396 -14.709 32.588 -15.082C32.654 -15.21 32.749 -15.412 32.925 -15.38C33.084 -15.35 33.23 -15.134 33.33 -15.018C33.614 -14.69 33.901 -14.364 34.189 -14.039C34.371 -13.833 34.554 -13.627 34.737 -13.421C34.964 -13.166 35.192 -12.915 35.384 -12.632C35.706 -12.157 35.951 -11.633 36.3 -11.175C36.853 -10.448 37.615 -9.99 38.535 -9.923C39.506 -9.852 40.351 -10.229 41.024 -10.916C41.359 -11.258 41.617 -11.656 41.893 -12.046C42.083 -12.314 42.282 -12.517 42.502 -12.757C42.66 -12.929 42.812 -13.106 42.957 -13.288C43.035 -13.386 43.107 -13.491 43.193 -13.582C43.224 -13.614 43.281 -13.666 43.323 -13.62C43.381 -13.557 43.398 -13.271 43.409 -13.176C43.442 -12.914 43.429 -12.657 43.427 -12.394C43.426 -12.203 43.431 -12.011 43.437 -11.82C43.448 -11.498 43.464 -11.177 43.489 -10.856C43.543 -10.158 43.621 -9.46 43.584 -8.76C43.562 -8.341 43.443 -8.058 43.368 -7.664C43.309 -7.35 43.303 -7.018 43.327 -6.701C43.338 -6.562 43.355 -6.422 43.407 -6.292C43.448 -6.19 43.527 -6.089 43.538 -5.977C43.548 -5.875 43.466 -5.691 43.443 -5.581C43.403 -5.395 43.385 -5.184 43.451 -5.002C43.547 -4.739 43.818 -4.593 44.08 -4.721C44.163 -4.762 44.239 -4.817 44.317 -4.868C44.383 -4.911 44.451 -4.953 44.512 -5.003C44.698 -5.158 44.807 -5.39 44.912 -5.603C44.981 -5.745 45.056 -5.887 45.107 -6.037C45.233 -6.406 45.253 -6.948 45.248 -7.339C45.244 -7.666 45.196 -7.991 45.201 -8.318C45.208 -8.784 45.287 -9.288 45.351 -9.751C45.435 -10.357 45.61 -10.946 45.693 -11.552C45.727 -11.806 45.75 -12.063 45.751 -12.319C45.752 -12.478 45.74 -12.637 45.752 -12.795C45.76 -12.902 45.783 -13.007 45.795 -13.113C45.805 -13.211 45.799 -13.309 45.804 -13.406C45.811 -13.533 45.835 -13.654 45.826 -13.781C45.797 -14.154 45.716 -14.519 45.644 -14.885C45.572 -15.247 45.5 -15.608 45.428 -15.97C45.379 -16.216 45.25 -16.736 45.274 -16.962C45.296 -17.17 45.414 -17.423 45.481 -17.628C45.535 -17.792 45.584 -17.957 45.629 -18.124C45.74 -18.534 45.825 -18.95 45.898 -19.369C45.963 -19.746 46.019 -20.124 46.103 -20.498C46.151 -20.712 46.205 -20.925 46.262 -21.136C46.389 -21.599 46.476 -21.928 46.44 -22.417C46.4 -22.954 46.212 -23.473 45.907 -23.915C45.625 -24.323 45.222 -24.676 45.19 -25.185C45.153 -25.756 45.574 -26.19 45.755 -26.698C45.848 -26.963 45.857 -27.234 45.889 -27.51C45.907 -27.677 45.934 -27.843 45.968 -28.007C46.027 -28.295 46.107 -28.578 46.184 -28.862C46.323 -29.376 46.407 -29.761 46.286 -30.295C46.13 -30.985 45.624 -31.887 45.129 -32.393C44.996 -32.53 44.846 -32.652 44.685 -32.754C44.166 -33.081 43.545 -33.205 42.944 -33.278C42.376 -33.347 41.74 -33.414 41.172 -33.325C40.843 -33.274 40.532 -33.157 40.231 -33.017C40.016 -32.917 39.802 -32.81 39.604 -32.679C39.078 -32.331 38.574 -31.785 38.384 -31.173C38.356 -31.082 38.329 -30.977 38.389 -30.892C38.435 -30.828 38.546 -30.786 38.548 -30.698C38.55 -30.611 38.47 -30.511 38.443 -30.428C38.398 -30.289 38.395 -30.13 38.396 -29.985C38.397 -29.85 38.417 -29.716 38.461 -29.588C38.493 -29.495 38.552 -29.403 38.55 -29.302C38.543 -29.003 38.062 -28.757 37.958 -28.467C37.946 -28.434 37.937 -28.399 37.936 -28.363C37.93 -28.116 38.271 -28.206 38.311 -28.044C38.335 -27.946 38.248 -27.855 38.252 -27.756C38.254 -27.673 38.311 -27.602 38.33 -27.523C38.392 -27.264 38.354 -27.124 38.576 -26.927C38.879 -26.659 39.326 -26.432 39.7 -26.282C39.843 -26.225 39.99 -26.178 40.132 -26.119C40.295 -26.051 40.455 -25.971 40.613 -25.893C41 -25.702 41.418 -25.424 41.582 -25.006C41.682 -24.752 41.651 -24.484 41.614 -24.221C41.564 -23.869 41.492 -23.522 41.436 -23.172C41.392 -22.895 41.352 -22.618 41.315 -22.341C41.25 -21.855 41.192 -21.368 41.057 -20.895C40.969 -20.585 40.844 -20.288 40.72 -19.991C40.53 -19.534 40.327 -19.083 40.15 -18.621C39.98 -18.176 39.832 -17.723 39.659 -17.28C39.594 -17.11 39.514 -16.847 39.348 -16.751C39.147 -16.635 38.904 -16.794 38.744 -16.912C38.529 -17.069 38.339 -17.258 38.145 -17.438C37.937 -17.632 37.728 -17.826 37.519 -18.019C36.388 -19.065 35.227 -20.077 34.125 -21.153C33.978 -21.297 33.835 -21.443 33.701 -21.599C33.317 -22.045 33.075 -22.386 32.453 -22.501C31.634 -22.653 30.885 -22.196 30.313 -21.654C30.171 -21.52 30.033 -21.379 29.908 -21.229C29.672 -20.945 29.475 -20.633 29.261 -20.333C29.142 -20.165 29.014 -20.004 28.889 -19.841C27.955 -18.616 26.901 -17.49 25.908 -16.313C25.496 -15.825 25.09 -15.331 24.678 -14.842C24.523 -14.658 24.167 -14.21 23.999 -14.08C23.738 -13.878 23.523 -14.006 23.283 -14.161C23.166 -14.238 23.049 -14.314 22.932 -14.391C22.238 -14.847 21.016 -15.655 20.252 -15.894C19.993 -15.975 19.8 -15.976 19.538 -15.914C19.452 -15.894 19.365 -15.873 19.282 -15.843C19.072 -15.77 18.9 -15.636 18.9 -15.396Z',
    shown: 'M41.672 -21.715C41.672 -21.443 41.78 -21.081 41.842 -20.809C41.959 -20.3 42.076 -19.79 42.193 -19.281C42.455 -18.134 42.713 -16.987 42.968 -15.839C43.087 -15.301 43.216 -14.765 43.324 -14.225C43.353 -14.078 43.373 -13.909 43.334 -13.761C43.303 -13.64 43.22 -13.648 43.228 -13.482C43.239 -13.273 43.283 -13.066 43.292 -12.856C43.302 -12.628 43.287 -12.399 43.29 -12.171C43.299 -11.652 43.326 -11.135 43.369 -10.619C43.424 -9.969 43.503 -9.241 43.433 -8.593C43.4 -8.29 43.294 -8.003 43.236 -7.705C43.177 -7.405 43.169 -7.09 43.184 -6.785C43.192 -6.624 43.205 -6.457 43.256 -6.302C43.291 -6.196 43.366 -6.096 43.384 -5.985C43.401 -5.885 43.312 -5.651 43.293 -5.531C43.236 -5.18 43.278 -4.775 43.632 -4.594C43.73 -4.544 43.843 -4.519 43.953 -4.534C44.102 -4.555 44.228 -4.644 44.351 -4.725C44.428 -4.776 44.509 -4.824 44.582 -4.881C44.789 -5.043 44.911 -5.289 45.024 -5.519C45.134 -5.742 45.243 -5.962 45.297 -6.206C45.382 -6.589 45.401 -7.151 45.379 -7.544C45.366 -7.777 45.34 -8.01 45.338 -8.243C45.337 -8.49 45.363 -8.737 45.392 -8.983C45.44 -9.381 45.485 -9.781 45.562 -10.174C45.651 -10.633 45.769 -11.084 45.831 -11.548C45.865 -11.797 45.887 -12.049 45.889 -12.301C45.89 -12.455 45.879 -12.609 45.891 -12.763C45.9 -12.884 45.928 -13.002 45.942 -13.123C45.956 -13.234 45.95 -13.346 45.956 -13.457C45.961 -13.565 45.979 -13.67 45.974 -13.778C45.96 -14.098 45.875 -14.429 45.813 -14.743C45.712 -15.251 45.611 -15.759 45.51 -16.268C45.469 -16.474 45.428 -16.68 45.387 -16.886C45.379 -16.925 45.356 -17.089 45.329 -17.111C45.288 -17.145 45.274 -16.903 45.243 -16.95C45.211 -16.998 45.187 -17.188 45.174 -17.253C45.128 -17.487 45.082 -17.72 45.036 -17.954C44.855 -18.884 44.677 -19.815 44.5 -20.745C44.44 -21.059 44.289 -21.968 44.191 -22.209C43.752 -23.286 42.219 -23.292 41.772 -22.218C41.706 -22.059 41.672 -21.887 41.672 -21.715Z',
    seat: 0,
  };

  // Couleur CSS -> [r, g, b] entre 0 et 1
  const rgbOf = (() => {
    let x = null;
    return (css) => {
      if (!x) { const c = document.createElement('canvas'); c.width = c.height = 1; x = c.getContext('2d', { willReadFrequently: true }); }
      x.clearRect(0, 0, 1, 1);
      x.fillStyle = '#000';
      x.fillStyle = css;
      x.fillRect(0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    };
  })();

  const BUIS_GL = (() => {
    const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
    const FS = `#version 300 es
precision highp float;
uniform sampler2D uC, uS;  // couverture des lettres (px d'appareil) ; distance signée à leur bord (grille deux fois plus lâche)
uniform vec2 uDev, uSd, uV, uLight;
uniform float uD, uDmax, uD0;
uniform vec3 uPaper, uInk, uTone;
out vec4 o;
float cov(vec2 p) { return texture(uC, p / uDev).r; }
float dist(vec2 p) { return texture(uS, p / uSd).r; }
// De p, on remonte vers la face (-uV) : la couverture la plus forte rencontrée donne l'anticrénelage des bords,
// le premier passage au-dessus de la moitié donne la profondeur de la paroi vue. Les vides se sautent grâce à la distance.
vec2 march(vec2 p) {
  float d = uD0, best = 0.0, bestD = uD, hit = -1.0, prevC = 0.0, prevD = uD0;
  for (int i = 0; i < 400; i++) {
    if (d > uD) break;
    vec2 q = p - d * uV;
    float s = dist(q);
    if (s > 3.5 && hit < 0.0) { d += s - 3.0; prevC = 0.0; prevD = d; continue; }
    float c = cov(q);
    if (c > best) { best = c; bestD = d; }
    if (hit < 0.0 && c >= 0.5) hit = mix(prevD, d, clamp((0.5 - prevC) / max(c - prevC, 1e-4), 0.0, 1.0));
    if (hit >= 0.0 && (best > 0.996 || d > hit + 2.0)) break;
    prevC = c; prevD = d;
    d += 0.35;
  }
  float cE = cov(p - uD * uV); // le fond exact : un dernier échantillon à la profondeur voulue
  if (cE > best) { best = cE; bestD = uD; }
  return vec2(best, hit >= 0.0 ? hit : bestD);
}
vec3 shade(vec2 p, float dep) {
  // Normale de la paroi : la couverture lue sur un cercle de 3 px autour du point d'origine (douze rayons), plus lisse
  // qu'une différence entre deux voisins, qui rayait les parois courbes dans le sens de la profondeur.
  vec2 q = p - dep * uV, gr = vec2(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    vec2 u = vec2(cos(a), sin(a));
    gr -= cov(q + 3.0 * u) * u;
  }
  float lam = dot(gr / max(length(gr), 1e-4), uLight);
  float t = mix(uTone.x, uTone.y, smoothstep(0.0, 1.0, dep / uDmax)) * (1.0 - uTone.z * lam);
  return mix(uPaper, uInk, t);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uDev.y - gl_FragCoord.y);
  vec2 m = march(p);
  float fw = fwidth(m.y);
  if (m.x <= 0.002) { o = vec4(0.0); return; }
  vec3 col;
  if (fw > 1.2 && m.x > 0.99) { // une paroi en masque une autre : quatre rayons par pixel
    col = vec3(0.0);
    for (int k = 0; k < 4; k++) {
      vec2 f = vec2(k == 0 || k == 2 ? -0.25 : 0.25, k < 2 ? -0.25 : 0.25);
      col += shade(p + f, march(p + f).y);
    }
    col *= 0.25;
  } else col = shade(p, m.y);
  col += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  o = vec4(col * m.x, m.x);
}`;
    const NAMES = ['uC', 'uS', 'uDev', 'uSd', 'uV', 'uLight', 'uD', 'uDmax', 'uD0', 'uPaper', 'uInk', 'uTone'];
    let R0 = null;
    function make() {
      const cv = document.createElement('canvas');
      cv.className = 'hero__sig hero__sig--buis';
      cv.setAttribute('aria-hidden', 'true');
      // Tampon gardé : la désintégration du mot au survol (desint/desint.js) relit le relief après son dessin
      const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
      if (!gl) return null;
      const sh = (type, src) => {
        const o = gl.createShader(type);
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
        return o;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const loc = {};
      NAMES.forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
      const r = { cv, gl, prog, loc, tex: [gl.createTexture(), gl.createTexture()], lost: false, last: -1 };
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; });
      cv.addEventListener('webglcontextrestored', () => { cv.remove(); R0 = null; if (SIG.current && SIG.current() === 'buis') SIG.set('buis', false); });
      return r;
    }
    function get() {
      if (R0 && !R0.lost) return R0;
      try { R0 = make(); } catch (e) { R0 = null; }
      return R0;
    }
    function show(r, b) {
      const lines = document.querySelector('.hero__lines');
      if (lines && r.cv.parentNode !== lines) lines.insertBefore(r.cv, lines.querySelector('.hero__sig--live'));
      Object.assign(r.cv.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      r.cv.hidden = false;
    }
    function hide() { if (R0) R0.cv.hidden = true; }
    function upload(r, s) {
      const gl = r.gl;
      r.cv.width = s.W;
      r.cv.height = s.H;
      gl.viewport(0, 0, s.W, s.H);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      [[s.cov, s.W, s.H, gl.R8, gl.UNSIGNED_BYTE], [s.sdf, s.sw, s.sh, gl.R16F, gl.FLOAT]].forEach(([data, w, h, fmt, type], i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, r.tex[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RED, type, data);
      });
      r.last = -1;
    }
    function draw(r, s, depth, C) {
      const gl = r.gl, L = r.loc, key = `${depth}|${C.paper}|${C.ink}`;
      if (key === r.last) return;
      r.last = key;
      gl.useProgram(r.prog);
      gl.uniform1i(L.uC, 0);
      gl.uniform1i(L.uS, 1);
      gl.uniform2f(L.uDev, s.W, s.H);
      gl.uniform2f(L.uSd, s.sw * 2, s.sh * 2);
      gl.uniform2f(L.uV, s.v[0], s.v[1]);
      const ll = Math.hypot(BUIS.light[0], BUIS.light[1]);
      gl.uniform2f(L.uLight, BUIS.light[0] / ll, BUIS.light[1] / ll);
      gl.uniform1f(L.uD, Math.max(0.01, s.Dpx * s.dpr * depth));
      gl.uniform1f(L.uDmax, s.Dpx * s.dpr);
      gl.uniform1f(L.uD0, 0.75);
      gl.uniform3fv(L.uPaper, rgbOf(C.paper));
      gl.uniform3fv(L.uInk, rgbOf(C.ink));
      gl.uniform3f(L.uTone, BUIS.near, BUIS.far, BUIS.relief);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (depth > 0) gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { get, show, hide, upload, draw };
  })();

  // Repli sans WebGL2 : des copies pleines des lettres, du fond vers la face, la teinte s'assombrissant vers l'avant
  function buis2D(ctx, s, depth, C, k) {
    const m = s.m, D = s.Dpx * depth;
    if (D < 0.5) return;
    const pa = rgbOf(C.paper), ink = rgbOf(C.ink), n = Math.ceil(D * 2);
    ctx.font = `${m.weight} ${100 * m.k}px ${m.family}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    for (let i = n; i >= 1; i--) {
      const dd = (D * i) / n, t = k.lerp(BUIS.near, BUIS.far, k.smooth(dd / s.Dpx));
      ctx.fillStyle = `rgb(${pa.map((c, j) => Math.round(255 * k.lerp(c, ink[j], t))).join(' ')})`;
      [...m.word].forEach((ch, j) => ctx.fillText(ch, m.xs[j] + s.v[0] * dd, m.base + s.v[1] * dd));
    }
  }

  // Les enfants, dans le SVG du mot, aux mêmes unités : chacun est posé à l'origine de sa lettre. Celui du « o » est devant
  // les lettres ; celui du « p » est derrière leur face, qu'un masque fait du mot lui-même (le même texte, en noir sur
  // blanc) lui retire, sauf son bras qui pend devant (une découpe blanche dans le masque, posée comme lui). Le masque se
  // pose sur un groupe sans transformation, la pose sur un groupe intérieur.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const originOf = (m, ch) => { const i = m.word.indexOf(ch); return i < 0 ? null : m.minX + (m.xs[i] - m.x) / m.k; };
  const pathOf = (d, rule) => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); if (rule) p.setAttribute('fill-rule', rule); return p; };
  function childOf(m) {
    const svg = document.querySelector('.hero__mark svg'), x = originOf(m, 'o');
    if (!svg || x === null) return null;
    let g = svg.querySelector('.hero__child--o');
    if (!g) {
      g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'hero__child hero__child--o');
      g.style.opacity = '0'; // posé et révélé par la première image de la signature
      g.append(pathOf(CHILD.body), pathOf(CHILD.shin));
      svg.append(g);
    }
    return { g, shin: g.lastChild, x };
  }
  function loungerOf(m) {
    const svg = document.querySelector('.hero__mark svg'), x = originOf(m, 'p');
    if (!svg || x === null) return null;
    let g = svg.querySelector('.hero__child--p');
    if (!g) {
      const box = (e) => ['x', 'y', 'width', 'height'].forEach((a, i) => e.setAttribute(a, [-1000, -1000, 3000, 3000][i]));
      const defs = document.createElementNS(SVGNS, 'defs'), mk = document.createElementNS(SVGNS, 'mask'), r = document.createElementNS(SVGNS, 'rect');
      defs.setAttribute('class', 'hero__child-defs');
      mk.id = 'hero-child-mask';
      mk.setAttribute('maskUnits', 'userSpaceOnUse');
      box(mk);
      box(r);
      r.setAttribute('fill', '#fff');
      const tx = svg.querySelector('text').cloneNode(true);
      tx.style.fill = '#000';
      const rv = pathOf(LOUNGER.shown);
      rv.setAttribute('fill', '#fff');
      mk.append(r, tx, rv);
      defs.append(mk);
      g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'hero__child hero__child--p');
      g.setAttribute('mask', 'url(#hero-child-mask)');
      g.style.opacity = '0';
      const inner = document.createElementNS(SVGNS, 'g');
      inner.append(pathOf(LOUNGER.body, 'evenodd'));
      g.append(inner);
      svg.append(defs, g);
    }
    return { g, inner: g.firstChild, shown: svg.querySelector('#hero-child-mask').lastChild, x };
  }
  function dropChild() {
    document.querySelectorAll('.hero__mark .hero__child, .hero__mark .hero__child-defs').forEach((e) => e.remove());
  }
  function poseChild(s, t, depth, k) {
    const c = s.child;
    if (!c) return;
    // Les tracés sont posés à leur profondeur (« seat », nulle depuis qu'ils sont ancrés sur la face) : pendant que la
    // haie pousse, on les ramène vers la face
    const back = (f) => BUIS.depth * f * (1 - depth);
    // L'enfant du « o » s'assoit : il apparaît un peu au-dessus du « o » et s'y pose en devenant opaque
    const B = BUIS.child, e = k.prog(t, B.show[0], B.show[1]), b1 = back(CHILD.seat), drop = B.drop * (1 - k.easeOut(e));
    c.g.setAttribute('transform', `translate(${(c.x - s.v[0] * b1).toFixed(3)} ${(-s.v[1] * b1 - drop).toFixed(3)})`);
    const op = k.smooth(e);
    c.g.style.opacity = op >= 1 ? '' : op.toFixed(3);
    // Un balancement amorti de la jambe de devant : deux allers-retours, qui s'éteignent sans à-coup ; le premier, le plus
    // ample, part vers l'arrière (vers l'avant, elle passerait sur la jambe du fond)
    const u = k.prog(t, B.swing[0], B.swing[1]);
    const th = u > 0 && u < 1 ? B.amp * Math.sin(4 * Math.PI * u) * (1 - u) ** 2 : 0;
    if (th) c.shin.setAttribute('transform', `rotate(${th.toFixed(3)} ${CHILD.knee[0]} ${CHILD.knee[1]})`);
    else c.shin.removeAttribute('transform');
    // Le second s'installe dans le creux un peu après, et ne bouge plus
    const l = s.lounger;
    if (!l) return;
    const L = BUIS.lounger, e2 = k.prog(t, L.show[0], L.show[1]), b2 = back(LOUNGER.seat);
    const tf = `translate(${(l.x - s.v[0] * b2).toFixed(3)} ${(-s.v[1] * b2 - L.drop * (1 - k.easeOut(e2))).toFixed(3)})`;
    l.inner.setAttribute('transform', tf);
    l.shown.setAttribute('transform', tf); // la découpe du masque suit l'enfant
    const o2 = k.smooth(e2);
    l.g.style.opacity = o2 >= 1 ? '' : o2.toFixed(3);
  }

  R({
    id: 'buis', name: 'Lettres de buis',
    idea: 'Le mot devient une haie de buis taillée en lettres : il prend de l’épaisseur vers l’arrière, comme un massif vu de trois quarts. Sur le « o », un enfant est assis comme sur un croissant de lune, les jambes qui pendent devant la lettre ; au creux du « p », un autre se la coule douce, les genoux levés.',
    duration: BUIS.child.swing[0] + BUIS.child.swing[1] + 50, clear: { mark: false },
    setup(G) {
      const m = G.mark, dpr = Math.min(2, devicePixelRatio || 1);
      const a = (BUIS.angle * Math.PI) / 180, v = [Math.cos(a), Math.sin(a)], Dpx = BUIS.depth * m.k;
      // Boîte de travail : l'encre du mot prolongée de la profondeur vers l'arrière, et une marge (px CSS de la capsule)
      const x0 = Math.floor(m.x - 3), y0 = Math.floor(m.y + v[1] * Dpx - 3);
      const box = { x: x0, y: y0, w: Math.ceil(m.x + m.w + v[0] * Dpx + 3) - x0, h: Math.ceil(m.y + m.h + 3) - y0 };
      const W = Math.round(box.w * dpr), H = Math.round(box.h * dpr);
      // Sous 20 px de haut (téléphone couché), les enfants ne seraient que des taches ; et ils épousent les glyphes d'Onest :
      // avec une autre police du panneau, on ne les pose pas
      const tall = BUIS.kids && 34 * m.k >= 20 && /onest/i.test(m.family);
      if (!tall) dropChild();
      const s = { m, v, Dpx, dpr, box, W, H, gl: null, child: tall ? childOf(m) : null, lounger: tall ? loungerOf(m) : null };
      // Fond de secours d'abord : sans WebGL2, rien d'autre à préparer
      const r = BUIS_GL.get();
      if (!r) return s;
      // 1. Couverture des lettres en px d'appareil, glyphe par glyphe aux positions exactes du SVG
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
      x.font = `${m.weight} ${100 * m.k}px ${m.family}`;
      [...m.word].forEach((ch, i) => x.fillText(ch, m.xs[i], m.base));
      const px = x.getImageData(0, 0, W, H).data, cov = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) cov[i] = px[i * 4 + 3];
      // 2. Distance signée au bord des lettres, sur une grille deux fois plus lâche (pour sauter les vides et lire la normale)
      const sw = Math.ceil(W / 2), sh = Math.ceil(H / 2), N = sw * sh, ah = new Float32Array(N);
      for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
        let sum = 0, n = 0;
        for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
          const X = 2 * i + di, Y = 2 * j + dj;
          if (X < W && Y < H) { sum += cov[Y * W + X]; n++; }
        }
        ah[j * sw + i] = sum / (255 * n);
      }
      const fo = new Float64Array(N), fi = new Float64Array(N);
      for (let i = 0; i < N; i++) { const inside = ah[i] >= 0.5; fo[i] = inside ? 0 : 1e20; fi[i] = inside ? 1e20 : 0; }
      edt(fo, sw, sh);
      edt(fi, sw, sh);
      const sdf = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const q = ah[i];
        let d = q >= 0.5 ? 0.5 - Math.sqrt(fi[i]) : Math.sqrt(fo[i]) - 0.5;
        if (q > 0 && q < 1) d = 0.5 - q; // sur le bord, la couverture situe l'arête à mieux qu'un demi-pixel
        sdf[i] = d * 2; // en px d'appareil
      }
      Object.assign(s, { cov, sdf, sw, sh, gl: r });
      BUIS_GL.upload(r, s);
      return s;
    },
    draw(ctx, G, t, s, C, k) {
      if (!s) return;
      const depth = k.smoother(k.prog(t, 0, BUIS.grow));
      if (s.gl && !s.gl.lost) {
        BUIS_GL.show(s.gl, s.box);
        BUIS_GL.draw(s.gl, s, depth, C);
      } else {
        BUIS_GL.hide();
        buis2D(ctx, s, depth, C, k);
      }
      poseChild(s, t, depth, k);
    },
    teardown() {
      BUIS_GL.hide();
      dropChild();
    },
  });

})(typeof window !== 'undefined' ? window : globalThis);
