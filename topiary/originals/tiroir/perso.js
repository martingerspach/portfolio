/* Tiroir : le chercheur.
   Un personnage au trait, assis dans l'herbe devant le tiroir tiré de la commode. Il fouille, sort une fiche, la lit,
   secoue la tête, la remet, se redresse, se gratte la tête, et replonge la main dans le tiroir. Boucle de 10 s,
   continue au raccord (positions et vitesses) : chaque piste est une courbe périodique, chaque oscillation fait
   un nombre entier de tours sur 10 s.
   Coordonnées : pixels de l'image de la colline (img/colline.webp, 1 456 × 346). Le tiroir tiré : façade de x 783 à 882,
   bord haut à y 112 ; la lumière vient de la droite (l'ombre de la commode part à gauche).
   Le personnage regarde vers la gauche : on voit son côté gauche (bras et jambe gauches devant, droits derrière, plus pâles). */
(() => {
  'use strict';
  const PERIOD = 10;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rad = (d) => (d * Math.PI) / 180;

  /* Piste périodique : clés [t, v] (t en secondes), interpolation de Hermite à tangentes de Catmull-Rom,
     mises à zéro aux extremums (pas de dépassement), et raccord continu de 10 s à 0 s. */
  function track(keys) {
    const K = keys.slice().sort((a, b) => a[0] - b[0]), n = K.length;
    const at = (i) => { const j = ((i % n) + n) % n, w = Math.floor(i / n); return [K[j][0] + w * PERIOD, K[j][1]]; };
    const tan = K.map((_, i) => {
      const [t0, v0] = at(i - 1), [t1, v1] = at(i), [t2, v2] = at(i + 1);
      if ((v1 - v0) * (v2 - v1) <= 0) return 0;          // extremum ou palier : arrivée posée
      return (v2 - v0) / (t2 - t0);
    });
    return (t) => {
      t = ((t % PERIOD) + PERIOD) % PERIOD;
      let i = n - 1;
      for (let k = 0; k < n; k++) if (K[k][0] <= t) i = k;
      const [ta, va] = at(i), [tb, vb] = at(i + 1);
      const tt = t < ta ? t + PERIOD : t, h = tb - ta, s = (tt - ta) / h;
      const ma = tan[i] * h, mb = tan[(i + 1) % n] * h;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * va + (s3 - 2 * s2 + s) * ma + (-2 * s3 + 3 * s2) * vb + (s3 - s2) * mb;
    };
  }
  /* Enveloppe périodique : 0 hors de [a, d], 1 de b à c, montées et descentes en douceur. */
  const env = (t, a, b, c, d) => {
    t = ((t % PERIOD) + PERIOD) % PERIOD;
    // une enveloppe peut enjamber le raccord (a en fin de boucle, d au début de la suivante)
    if (b < a) b += PERIOD; if (c < a) c += PERIOD; if (d < a) d += PERIOD;
    const f = (x) => (x < a || x > d ? 0 : x < b ? smooth(a, b, x) : x <= c ? 1 : 1 - smooth(c, d, x));
    return Math.max(f(t), f(t + PERIOD), f(t - PERIOD));
  };
  /* Deux segments (épaule, coude, main) : cinématique inverse en 3D, projetée. Le coude tourne autour de l'axe
     épaule-main ; c = cosinus de cette rotation (+1 : coude du côté « gauche » de l'axe, −1 : de l'autre côté,
     0 : coude tourné vers nous, segments raccourcis par la perspective). c varie en douceur : jamais de saut du coude. */
  function ik2(ax, ay, tx, ty, l1, l2, c) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
    /* portée saturée en douceur : au-delà de 88 % de la longueur du bras, la main se rapproche de la limite sans jamais
       l'atteindre (pas de bras qui se tend d'un coup, pas de coude qui saute) */
    const L = l1 + l2, k0 = 0.88 * L, span = 0.115 * L;
    const dm = d < k0 ? Math.max(d, Math.abs(l1 - l2) + 0.5) : k0 + span * Math.tanh((d - k0) / span), k = dm / (d || 1);
    dx *= k; dy *= k; d = dm;
    const ux = dx / d, uy = dy / d;
    const a = (l1 * l1 + d * d - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { ex: ax + ux * a - uy * h * c, ey: ay + uy * a + ux * h * c, hx: ax + dx, hy: ay + dy };
  }

  /* Le corps : longueurs en pixels d'image */
  const B = { torso: 80, neck: 4, headR: 14, sh: 16, upper: 41, fore: 39, thigh: 50, shin: 47, w: 3.7 };
  const HIP = { x: 938, y: 176.5 };                       // la hanche ; le bassin touche l'herbe à y 181
  /* jambe gauche (devant) pliée, genou en l'air ; jambe droite (derrière) allongée vers le tiroir, pied sous sa façade */
  const FEET = { near: { x: 881, y: 180.5 }, far: { x: 858, y: 182 } };
  /* l'intérieur du tiroir : ce qui passe sous ce bord est caché par la façade (et les côtés) */
  const DRAWER = [[748, 103], [783, 110.5], [884, 113.5], [884, 147], [748, 147]];   // la caisse du tiroir tiré
  const KNEE = ik2(HIP.x - 1, HIP.y, FEET.near.x, FEET.near.y, B.thigh, B.shin, 1);   // genou gauche au repos

  /* ---------- La chorégraphie (secondes) ----------
     0 à 1,8 : il fouille, penché, la tête au-dessus du tiroir ; 1,9 à 2,9 : il sort une fiche et la lève ;
     2,9 à 4,2 : il la lit, fait « non » de la tête ; 4,3 à 5,0 : il la remet en regardant le tiroir ;
     5,2 à 5,9 : il se redresse, lève la main, pose le coude sur le genou ; 6,0 à 7,4 : il se gratte la tête en regardant en l'air ;
     7,5 à 8,1 : la main au menton, un léger recul (l'élan) ; 8,2 à 10 : il replonge la main et fouille. */
  // inclinaison du buste vers le tiroir (degrés, + = penché vers la gauche)
  const lean = track([[0, 22], [1.6, 24], [2.25, 18], [2.95, 9], [4.1, 10], [4.6, 20], [5.0, 22], [5.55, 6], [6.25, 0.5], [7.4, 1.5], [7.85, 1.5], [8.02, -1], [8.3, 12], [8.65, 21], [9.35, 22]]);
  // tête par rapport au buste (+ = penchée en avant, vers le bas) : il regarde dans le tiroir, puis la fiche, puis en l'air
  const headTilt = track([[0, 17], [1.6, 19], [2.3, 5], [2.95, 2], [4.1, 3], [4.6, 14], [5.2, 5], [5.85, -13], [7.35, -15], [7.85, 2], [8.25, 4], [8.6, 16], [9.45, 17]]);
  /* main gauche (devant) : cible en pixels d'image. Au repos, le coude est posé sur le genou et l'avant-bras pend
     vers l'avant (155°, calculé par _outils/perso/knee2.mjs) */
  const kx = KNEE.ex - 34.3, ky = KNEE.ey + 12.5;
  const nearX = track([[0, 839], [1.5, 835], [1.95, 846], [2.35, 866], [2.95, 884], [4.1, 883], [4.55, 864], [4.95, 843], [5.3, 874], [5.62, 878], [5.95, kx], [7.42, kx], [7.82, 872], [8.15, 908], [8.5, 868], [8.95, 845], [9.6, 838]]);
  const nearY = track([[0, 125], [1.5, 127], [1.95, 121], [2.35, 103], [2.95, 86], [4.1, 87], [4.55, 104], [4.95, 125], [5.3, 108], [5.62, 92], [5.95, ky], [7.42, ky], [7.82, 101], [8.15, 93], [8.5, 104], [8.95, 121], [9.6, 126]]);
  // le bras gauche passe par-dessus la façade (1) ou non (0) : une piste à lui, pour que le coude ne batte jamais
  const reach = track([[0, 1], [1.95, 1], [2.55, 0], [4.45, 0], [4.8, 1], [5.05, 1], [5.55, 0], [8.25, 0], [8.65, 1]]);
  // la main droite (derrière) : de l'herbe (0) à la tête (1)
  const farUp = track([[0, 0], [5.45, 0], [6.15, 1], [7.3, 1], [8.0, 0]]);
  // glissement léger du bassin
  const hipX = track([[0, -2], [2.6, 1], [4.5, -1], [6.5, 2], [8.6, -2]]);
  const W = (k, t) => TAU * k * t / PERIOD;              // une oscillation de k tours par boucle

  /* ---------- L'inertie ----------
     Chaque partie suit sa piste avec un ressort amorti (retard, léger dépassement, arrivée qui se pose) : la tête
     sur le buste, la main sur sa cible, la fiche, souple, sur la main. La réponse est calculée une fois sur trois boucles
     (régime établi, périodique), échantillonnée à 120 Hz et relue par Catmull-Rom : le personnage reste une fonction
     exacte du temps (boucle sans raccord, arrêt sur image, mouvement réduit). */
  const SR = 120, NS = PERIOD * SR, SUB = 4;
  const SPRINGS = [];
  function spring(fn, f, z, dim) {
    const S = { fn, w: TAU * f, z, dim, out: Array.from({ length: dim }, () => new Float32Array(NS)), x: null, v: null, i: 0, pass: 0, done: false };
    SPRINGS.push(S);
    return (t) => {
      if (!S.done) ensure();
      const u = (((t % PERIOD) + PERIOD) % PERIOD) * SR, i = Math.floor(u), s = u - i;
      return S.out.map((a) => {
        const p0 = a[(i - 1 + NS) % NS], p1 = a[i % NS], p2 = a[(i + 1) % NS], p3 = a[(i + 2) % NS];
        return 0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (3 * (p1 - p2) + p3 - p0) * s * s * s);
      });
    };
  }
  /* Un pas de calcul : un échantillon (quatre sous-pas) du premier ressort inachevé. Deux passes : la première installe
     le régime établi (les transitoires s'éteignent en moins d'une seconde), la seconde l'enregistre. */
  function work(n) {
    for (const S of SPRINGS) {
      if (S.done) continue;
      const h = 1 / (SR * SUB), w2 = S.w * S.w, zw = 2 * S.z * S.w;
      if (!S.x) { S.x = S.fn(0).slice(); S.v = new Array(S.dim).fill(0); }
      while (n-- > 0) {
        for (let k = 0; k < SUB; k++) {
          const g = S.fn((S.i + k / SUB) / SR);
          for (let d = 0; d < S.dim; d++) { S.v[d] += (w2 * (g[d] - S.x[d]) - zw * S.v[d]) * h; S.x[d] += S.v[d] * h; }
        }
        if (S.pass === 1) for (let d = 0; d < S.dim; d++) S.out[d][S.i] = S.x[d];
        if (++S.i === NS) { S.i = 0; if (++S.pass === 2) { S.done = true; break; } }
      }
      return true;
    }
    return false;
  }
  function ensure() { while (work(1e9)); }
  /* Le calcul se fait par tranches de 2 à 8 ms quand le navigateur est libre (jamais une longue tâche à l'ouverture) ;
     si le dessin le demande avant la fin, il se termine d'un coup. */
  let readyRes; const ready = new Promise((r) => { readyRes = r; });
  function idleBuild() {
    const ric = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 4 }), 16));
    const slice = (dl) => {
      const end = performance.now() + clamp(dl.timeRemaining(), 2, 8);
      let more = true;
      while (more && performance.now() < end) more = work(16);
      if (more) ric(slice, { timeout: 150 }); else readyRes();
    };
    ric(slice, { timeout: 150 });
  }
  const sway = (t) => 0.6 * Math.sin(W(2, t) + 0.3);    // une respiration de tout le haut du corps : les tenues ne sont jamais figées
  const leanS = spring((t) => [lean(t) + sway(t)], 3.2, 0.8, 1);
  const headS = spring((t) => [lean(t) + sway(t) + headTilt(t)], 2.8, 0.5, 1);   // la tête suit le buste avec retard
  const nearS = spring((t) => [nearX(t), nearY(t)], 3.4, 0.72, 2);

  /* le corps, à partir des angles (degrés) du buste et de la tête */
  function body(t, leanDeg, headDeg) {
    const breathe = Math.sin(W(3, t));                   // trois respirations par boucle
    const lr = rad(leanDeg), hip = { x: HIP.x + hipX(t), y: HIP.y };
    const tl = B.torso * (1 + 0.007 * breathe);
    const ux = -Math.sin(lr), uy = -Math.cos(lr);
    const curl = 4.5 * smooth(5, 30, leanDeg);           // un dos légèrement voûté quand il se penche
    const neck = { x: hip.x + ux * tl, y: hip.y + uy * tl };
    const mid = { x: hip.x + ux * tl * 0.55 - uy * curl, y: hip.y + uy * tl * 0.55 + ux * curl };
    const sh = { x: neck.x - ux * B.sh, y: neck.y - uy * B.sh - 0.35 * breathe };   // les épaules montent à l'inspiration
    const hr = rad(headDeg);
    const head = { x: neck.x - Math.sin(hr) * (B.neck + B.headR), y: neck.y - Math.cos(hr) * (B.neck + B.headR) };
    return { lr, hip, neck, mid, sh, hr, head };
  }
  /* la main droite, sans le grattement : posée dans l'herbe, ou sur le crâne, côté nuque (passe par l'arrière) */
  function farBase(t, bd) {
    const restF = { x: bd.hip.x + 7, y: 179.5 };
    const ang = rad(50) - bd.hr;
    const onHead = { x: bd.head.x + Math.sin(ang) * (B.headR + 1.5), y: bd.head.y - Math.cos(ang) * (B.headR + 1.5) };
    const fu = farUp(t), bow = Math.sin(Math.PI * fu) * 10;
    return [lerp(restF.x, onHead.x, fu) + bow, lerp(restF.y, onHead.y, fu)];
  }
  const farS = spring((t) => farBase(t, body(t, leanS(t)[0], headS(t)[0])), 3.6, 0.68, 2);
  /* la fiche tenue : inclinée selon l'avant-bras, redressée pour être lue ; elle suit la main avec un léger retard */
  function cardRaw(t) {
    const bd = body(t, leanS(t)[0], headS(t)[0]), [hx, hy] = nearS(t);
    const a = ik2(bd.sh.x, bd.sh.y, hx, hy, B.upper, B.fore, lerp(-1, 1, clamp(reach(t), 0, 1)));
    const fa = Math.atan2(a.hy - a.ey, a.hx - a.ex), read = env(t, 2.7, 3.0, 4.1, 4.4);
    return [lerp(clamp(fa + 0.5, -0.45, 0.45), rad(-10), read)];
  }
  const cardS = spring(cardRaw, 3.2, 0.58, 1);   // du bristol : souple, mais raide

  function pose(t) {
    t = ((t % PERIOD) + PERIOD) % PERIOD;
    const rum = env(t, 8.75, 9.3, 1.75, 2.15);         // fouille
    const scr = env(t, 6.0, 6.2, 7.2, 7.4);             // grattement
    const no = env(t, 3.35, 3.5, 3.95, 4.15);           // « non » de la tête
    const rest = env(t, 5.85, 6.05, 7.35, 7.5);         // coude sur le genou
    const card = env(t, 1.9, 1.95, 4.95, 5.0) > 0.5;    // la fiche, tenue (cachée tant qu'elle est dans le tiroir)
    /* la fouille : la main plonge, remonte, va de côté, par gestes d'amplitude inégale ; l'épaule plonge avec elle,
       la tête suit en regardant dedans */
    const amp = 1 + 0.35 * Math.sin(W(2, t) + 1);
    const dig = Math.sin(W(16, t) + 1.9);
    const leanDeg = leanS(t)[0] + rum * amp * 1.5 * dig;
    const shake = no * Math.sin(W(25, t));
    const headDeg = headS(t)[0] + rum * amp * (1.5 * dig + 1) + 4 * shake
      - scr * (4 + Math.sin(W(50, t) + Math.PI));        // en se grattant, la tête penche vers la main
    const bd = body(t, leanDeg, headDeg);
    bd.head.x += 1.4 * shake;
    const [nx, ny] = nearS(t);
    const tx = nx + rum * amp * (3.5 * Math.sin(W(16, t)) + 1.5 * Math.sin(W(27, t) + 1));
    const ty = ny + rum * amp * (4.5 * dig + 1.5 * Math.sin(W(33, t) + 0.4));
    /* coude gauche : au-dessus de l'axe quand la main plonge dans le tiroir (le bras passe par-dessus la façade),
       en dessous quand elle tient la fiche ou se pose sur le genou ; entre les deux, il tourne vers nous */
    const rc = clamp(reach(t), 0, 1);
    const armN = ik2(bd.sh.x, bd.sh.y, tx, ty, B.upper, B.fore, lerp(-1, 1, rc));
    // jambes : pieds posés ; le genou gauche cède d'un pixel sous le poids du coude
    const hip = bd.hip, hipN = { x: hip.x - 1, y: hip.y }, hipF = { x: hip.x + 3, y: hip.y + 1.5 };
    const legN = ik2(hipN.x, hipN.y, FEET.near.x - 1.2 * rest, FEET.near.y, B.thigh, B.shin, 1);
    const legF = ik2(hipF.x, hipF.y, FEET.far.x, FEET.far.y, B.thigh, B.shin, 1);
    // main droite : sa base suit un ressort ; le grattement la fait aller et venir sur le crâne
    let [fx, fy] = farS(t);
    if (scr > 0) {
      const da = scr * 0.3 * Math.sin(W(50, t)), cx = bd.head.x, cy = bd.head.y, dx = fx - cx, dy = fy - cy;
      fx = cx + dx * Math.cos(da) - dy * Math.sin(da); fy = cy + dx * Math.sin(da) + dy * Math.cos(da);
    }
    const fu = farUp(t);
    const armF = ik2(bd.sh.x + 1.5, bd.sh.y + 1, fx, fy, B.upper, B.fore, lerp(-1, 1, smooth(0.15, 0.85, fu)));
    return { t, hip, mid: bd.mid, neck: bd.neck, sh: bd.sh, head: bd.head, hr: bd.hr, armN, armF, legN, legF, hipN, hipF,
      card, inDrawer: rc > 0.5, cardA: cardS(t)[0] };
  }

  /* ---------- Le dessin ---------- */
  function stroke(ctx, pts, w) {
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  function torsoPath(ctx, p, w) {
    ctx.lineWidth = w; ctx.beginPath();
    ctx.moveTo(p.hip.x, p.hip.y);
    ctx.quadraticCurveTo(p.mid.x * 2 - (p.hip.x + p.neck.x) / 2, p.mid.y * 2 - (p.hip.y + p.neck.y) / 2, p.neck.x, p.neck.y);
    ctx.stroke();
  }
  function cardPath(ctx, p) {
    // une fiche bristol de 23 × 15 px, tenue par un coin
    const h = p.armN;
    ctx.save(); ctx.translate(h.hx, h.hy); ctx.rotate(p.cardA);
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, -14, 23, 15);
    ctx.fillStyle = 'rgba(14, 76, 158, .9)'; ctx.fillRect(1, -10.5, 15, 1.4);
    ctx.fillStyle = 'rgba(14, 76, 158, .45)'; ctx.fillRect(1, -6.5, 17, 1); ctx.fillRect(1, -3.5, 12, 1);
    ctx.restore();
  }
  const outsideDrawer = (ctx) => {
    ctx.beginPath(); ctx.rect(-9999, -9999, 29999, 29999);
    DRAWER.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.clip('evenodd');
  };

  function create(cv, opt = {}) {
    const ctx = cv.getContext('2d');
    const far = document.createElement('canvas'), fctx = far.getContext('2d');
    let grass = null, view = { x0: 820, y0: 40, x1: 1010, y1: 200, s: 1 };
    /* Les brins d'herbe devant lui : les pixels de la photo, découpés en brins effilés le long du sol. */
    function buildGrass(img) {
      const g = document.createElement('canvas'); const s = Math.max(1, view.s);
      const X0 = 872, X1 = 1000, Y0 = 162, Y1 = 196;
      g.width = Math.ceil((X1 - X0) * s); g.height = Math.ceil((Y1 - Y0) * s);
      const x = g.getContext('2d');
      x.setTransform(s, 0, 0, s, -X0 * s, -Y0 * s);
      /* le masque : une bande d'herbe au bord déchiqueté, faite de brins fins (1,5 à 4 px, à l'échelle du grain de la
         photo), serrés là où il touche le sol (bassin, pieds, main d'appui), clairsemés ailleurs */
      let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      x.beginPath();
      const contact = (px) => Math.max(Math.exp(-((px - 940) ** 2) / 260), Math.exp(-((px - 881) ** 2) / 60), Math.exp(-((px - 946) ** 2) / 40));
      for (let px = X0; px < X1; px += 0.55 + R() * 0.6) {
        const dense = contact(px);
        if (R() > 0.12 + 0.85 * dense) continue;
        const hgt = 1.5 + R() * 2.5 * (0.5 + dense), lean = (R() - 0.4) * 1.6, w = 0.35 + R() * 0.45;
        const b = 182.6 + R() * 0.8;
        x.moveTo(px - w, b); x.quadraticCurveTo(px + lean * 0.4, b - hgt * 0.6, px + lean, b - hgt); x.quadraticCurveTo(px + lean * 0.4 + w * 0.2, b - hgt * 0.5, px + w, b); x.closePath();
      }
      x.rect(X0, 182.8, X1 - X0, Y1 - 182.8);
      x.fillStyle = '#000'; x.fill();
      x.globalCompositeOperation = 'source-in';
      x.drawImage(img, 0, 0);
      grass = { c: g, X0, Y0, X1, Y1 };
    }
    function setView(v) {
      Object.assign(view, v);
      const W = Math.ceil((view.x1 - view.x0) * view.s), H = Math.ceil((view.y1 - view.y0) * view.s);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; far.width = W; far.height = H; }
      if (opt.img && opt.img.complete) buildGrass(opt.img);
    }
    function draw(t) {
      const p = pose(t), s = view.s;
      const W = cv.width, H = cv.height;
      const T = (c) => c.setTransform(s, 0, 0, s, -view.x0 * s, -view.y0 * s);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const w = B.w;
      const nearParts = (c, ww) => {
        torsoPath(c, p, ww);
        stroke(c, [[p.hipN.x, p.hipN.y], [p.legN.ex, p.legN.ey], [p.legN.hx, p.legN.hy]], ww);
        stroke(c, [[p.neck.x, p.neck.y], [p.head.x, p.head.y]], ww);   // le cou, jusque sous la tête : elle ne flotte pas
        c.beginPath(); c.arc(p.head.x, p.head.y, B.headR + (ww - w) / 2, 0, TAU); c.fill();
      };
      const nearArm = (c, ww) => stroke(c, [[p.sh.x, p.sh.y], [p.armN.ex, p.armN.ey], [p.armN.hx, p.armN.hy]], ww);

      /* 1. L'ombre portée : le personnage projeté sur l'herbe, vers la gauche et un peu vers le fond (lumière à droite) */
      const G = 181;
      const proj = (x, y) => [x - (G - y) * 0.95, G - (G - y) * 0.16];
      ctx.save(); T(ctx);
      // l'ombre tombe sur l'herbe, pas sur la commode (elle passerait derrière) : on la découpe autour du meuble
      ctx.beginPath(); ctx.rect(-9999, -9999, 29999, 29999); ctx.rect(680, 20, 205, 159); ctx.clip('evenodd');
      ctx.filter = `blur(${(2 * s).toFixed(1)}px)`;
      ctx.strokeStyle = 'rgba(8, 24, 6, .58)'; ctx.fillStyle = 'rgba(8, 24, 6, .58)'; ctx.lineCap = 'round';
      const sp = [[p.hip.x, p.hip.y], [p.neck.x, p.neck.y]].map(([x, y]) => proj(x, y));
      stroke(ctx, sp, w * 2.2);
      stroke(ctx, [proj(p.sh.x, p.sh.y), proj(p.armN.ex, p.armN.ey), proj(p.armN.hx, p.armN.hy)], w * 1.6);
      const hc = proj(p.head.x, p.head.y);
      ctx.beginPath(); ctx.ellipse(hc[0], hc[1], B.headR * 1.1, B.headR * 0.32, 0, 0, TAU); ctx.fill();
      // l'ombre de contact, sous le bassin et les pieds
      ctx.filter = `blur(${(1.3 * s).toFixed(1)}px)`;
      ctx.fillStyle = 'rgba(6, 18, 4, .72)';
      ctx.beginPath(); ctx.ellipse(p.hip.x - 5, G + 1.2, 15, 2.8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(FEET.near.x + 0.5, FEET.near.y + 1.2, 6.5, 1.8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(FEET.far.x + 0.5, FEET.far.y + 0.8, 5.5, 1.5, 0, 0, TAU); ctx.fill();
      // la main droite posée dans l'herbe : son ombre s'éteint quand elle se lève
      const hf = smooth(172, 179, p.armF.hy);
      if (hf > 0.02) { ctx.globalAlpha = hf; ctx.beginPath(); ctx.ellipse(p.armF.hx - 2, 180.5, 5, 1.4, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
      ctx.filter = 'none';

      /* 2. Les membres du fond (droits), plus pâles, avec une réserve là où passent les membres de devant */
      fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, W, H); T(fctx);
      fctx.lineCap = 'round'; fctx.lineJoin = 'round'; fctx.strokeStyle = '#fff'; fctx.fillStyle = '#fff';
      stroke(fctx, [[p.hipF.x, p.hipF.y], [p.legF.ex, p.legF.ey], [p.legF.hx, p.legF.hy]], w * 0.92);
      stroke(fctx, [[p.sh.x + 1.5, p.sh.y + 1], [p.armF.ex, p.armF.ey], [p.armF.hx, p.armF.hy]], w * 0.92);
      fctx.beginPath(); fctx.arc(p.armF.hx, p.armF.hy, w * 0.66, 0, TAU); fctx.fill();   // la main
      fctx.globalCompositeOperation = 'destination-out';
      nearParts(fctx, w + 3.2);
      fctx.save(); if (p.inDrawer) outsideDrawer(fctx); nearArm(fctx, w + 3.2); fctx.restore();
      fctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.6; ctx.drawImage(far, 0, 0); ctx.restore();

      /* 3. Le buste, la tête, la jambe et le bras de devant */
      ctx.save(); T(ctx);
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
      nearParts(ctx, w);
      ctx.save(); if (p.inDrawer) outsideDrawer(ctx);
      nearArm(ctx, w);
      if (p.card) cardPath(ctx, p);
      // la main : un peu plus large que le trait
      ctx.beginPath(); ctx.arc(p.armN.hx, p.armN.hy, w * 0.72, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.restore();

      /* 4. L'herbe devant lui */
      if (grass) {
        ctx.save(); T(ctx);
        ctx.drawImage(grass.c, grass.X0, grass.Y0, grass.X1 - grass.X0, grass.Y1 - grass.Y0);
        ctx.restore();
      }
      return p;
    }
    if (opt.img) { if (opt.img.complete) buildGrass(opt.img); else opt.img.addEventListener('load', () => buildGrass(opt.img), { once: true }); }
    return { draw, setView, pose, PERIOD, box: { x0: 846, y0: 50, x1: 990, y1: 186 } };
  }
  /* le calcul des ressorts commence tout de suite, par tranches ; ready : il est fini */
  if (typeof window.requestIdleCallback === 'function' || typeof setTimeout === 'function') { try { idleBuild(); } catch (e) { /* hors navigateur */ } }
  window.TiroirPerso = { create, PERIOD, ready, ensure };
})();
