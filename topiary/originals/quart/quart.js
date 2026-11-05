/* Quart : planches isométriques dessinées en code, démo de la nuit. */
(() => {
  'use strict';

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const NB = ' ';
  const C = Math.cos(Math.PI / 6);
  const NS = 'http://www.w3.org/2000/svg';
  const q = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ease = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const params = new URLSearchParams(location.search);
  const unlock = () => requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('q-load')));
  if (document.readyState === 'complete') unlock(); else addEventListener('load', unlock, { once: true });
  setTimeout(() => document.documentElement.classList.remove('q-load'), 2500);

  /* ---------- projection ---------- */

  // Isométrie vraie : x vers le bas à droite, y vers le bas à gauche, z vers le haut.
  const U = (x, y, z = 0) => [(x - y) * C, (x + y) * 0.5 - z];

  // Ajuste l'échelle pour que les arêtes verticales tombent sur des colonnes de pixels.
  function projector(pts, W, H, box) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const [X, Y] = U(p[0], p[1], p[2] || 0);
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    const bw = x1 - x0, bh = y1 - y0;
    const L = box.l || 0, R = box.r || 0, T = box.t || 0, B = box.b || 0;
    let s = Math.min((W - L - R) / bw, (H - T - B) / bh);
    if (box.maxS) s = Math.min(s, box.maxS);
    let k = Math.max(2, Math.floor(s * C));
    if (k % 2) k -= 1; // demi-unités entières
    s = k / C;
    const ax = box.ax == null ? 0.5 : box.ax, ay = box.ay == null ? 0.5 : box.ay;
    const ox = Math.round(L + (W - L - R - bw * s) * ax - x0 * s) + 0.5;
    const oy = Math.round(T + (H - T - B - bh * s) * ay - y0 * s) + Math.round(box.dy || 0);
    const P = (x, y, z = 0) => [ox + (x - y) * k, oy + ((x + y) * 0.5 - z) * s];
    return { P, s, k };
  }

  /* ---------- briques SVG ---------- */

  const pt = (p) => r2(p[0]) + ' ' + r2(p[1]);
  const poly = (ps, close) => 'M' + ps.map(pt).join('L') + (close ? 'Z' : '');
  // Pointillés précalculés (tiret 2 px, blanc 3 px) : stroke-dasharray coûtait ~120 ms au premier rendu du hero.
  const DG = (params.get('dg') || '2,3').split(',').map(Number);
  const dashed = (ps, close) => {
    const pts = close ? ps.concat([ps[0]]) : ps;
    let d = '', carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!len) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      let s = carry;
      while (s < len) {
        const e = Math.min(len, s + DG[0]);
        d += 'M' + pt([a[0] + ux * s, a[1] + uy * s]) + 'L' + pt([a[0] + ux * e, a[1] + uy * e]);
        s += DG[0] + DG[1];
      }
      carry = s - len;
    }
    return d || poly(ps, close);
  };
  const solidH = params.has('solidh');
  const shape = (ps, close, cls) => (/\bln-h\b/.test(cls) && !solidH ? dashed(ps, close) : poly(ps, close));

  // Chaque trait reçoit un instant de tracé (data-a="début,durée") pour la planche d'accueil.
  function Sheet() {
    this.out = [];
    this.t = 0;
  }
  Sheet.prototype = {
    push(s) { this.out.push(s); return this; },
    at(t) { this.t = t; return this; },
    wait(dt) { this.t += dt; return this; },
    anim(d) { return this.timed ? ` data-a="${Math.round(this.t)},${Math.round(d)}"` : ''; },
    line(a, b, cls, d = 260) { return this.path([a, b], false, cls, d); },
    path(ps, close, cls, d = 420) {
      // Lignes cachées : un tiret = un trait simple (un tracé à plusieurs contours fait passer le premier rendu par un chemin lent).
      if (/\bln-h\b/.test(cls) && !solidH) {
        const segs = dashed(ps, close).split('M').filter(Boolean).map((x) => `<path d="M${x}"/>`).join('');
        return this.push(`<g class="${cls}"${this.anim(d)}>${segs}</g>`);
      }
      return this.push(`<path class="${cls}" d="${poly(ps, close)}"${this.anim(d)}/>`);
    },
    face(ps, cls) { return this.push(`<path class="${cls}" d="${poly(ps, true)}"${this.timed ? ` data-f="${Math.round(this.t)}"` : ''}/>`); },
    raw(s) { return this.push(s); },
    text(x, y, str, cls, extra = '') {
      return this.push(`<text class="${cls}" x="${r2(x)}" y="${r2(y)}"${extra}${this.timed ? ` data-f="${Math.round(this.t)}"` : ''}>${str}</text>`);
    },
    toString() { return this.out.join(''); },
  };

  // Boîte : faces (dessus, gauche +y, droite +x), arêtes intérieures, contour.
  function box(S, P, x, y, z, w, d, h, o = {}) {
    // Arêtes verticales au milieu d'une colonne de pixels (x = n + 0,5) : largeurs arrondies au pixel, position recalée
    // (décalage de moins d'un demi-pixel). Sans cela, un contour de 1,5 px s'étale sur deux colonnes grises.
    const kk = P(1, 0)[0] - P(0, 0)[0];
    if (kk >= 4) {
      w = Math.round(w * kk) / kk; d = Math.round(d * kk) / kk;
      const fx = P(x, y, z)[0] - 0.5;
      x -= (fx - Math.round(fx)) / kk;
    }
    const A = P(x, y, z + h), B = P(x + w, y, z + h), Cc = P(x + w, y + d, z + h), D = P(x, y + d, z + h);
    const E = P(x + w, y, z), F = P(x + w, y + d, z), G = P(x, y + d, z), H = P(x, y, z);
    if (o.hidden) {
      S.line(H, E, 'ln ln-h', 200); S.line(H, G, 'ln ln-h', 200); S.line(H, A, 'ln ln-h', 200);
    }
    const fc = o.fill === undefined ? ['f-t', 'f-l', 'f-r'] : o.fill;
    if (fc) { S.face([A, B, Cc, D], fc[0]); S.face([D, Cc, F, G], fc[1]); S.face([Cc, B, E, F], fc[2]); }
    if (o.after) o.after(S, { A, B, Cc, D });
    if (o.glassFill) {
      S.push(`<path class="glass" d="${poly([A, B, Cc, D], true)}"/><path class="glass" d="${poly([D, Cc, F, G], true)}"/><path class="glass" d="${poly([Cc, B, E, F], true)}"/>`);
    }
    const ci = o.inner || 'ln ln-i';
    S.path([A, B, E, F, G, D], true, o.outer || 'ln ln-o', o.dur || 520);
    S.line(D, Cc, ci, 160); S.line(Cc, B, ci, 160); S.line(Cc, F, ci, 160);
    return { A, B, Cc, D, E, F, G, H };
  }

  // Le quart blanc sur le dessus du cube de l'agent : le logo inversé (diagonales du dessus, quart de 12 h à 3 h).
  // Sous 110 px de large, le quart blanc reste seul : les deux diagonales chargeaient trop un petit cube (effet d'enveloppe).
  function agentQuarter(S, c) {
    const F = [(c.A[0] + c.Cc[0]) / 2, (c.A[1] + c.Cc[1]) / 2];
    S.face([c.A, c.B, F], 'o-q');
    if (Math.abs(c.B[0] - c.D[0]) < 110) return;
    S.line(c.A, c.Cc, 'ln ln-d', 160);
    S.line(c.D, c.B, 'ln ln-d', 160);
  }

  // Verre devant le cube : les arêtes avant du dessus du verre, redessinées en clair sur la seule silhouette du cube.
  function glassOver(S, id, cube, glass, d = 200) {
    S.raw(`<clipPath id="${id}"><path d="${poly([cube.D, cube.Cc, cube.B, cube.E, cube.F, cube.G], true)}"/></clipPath><g clip-path="url(#${id})">`);
    S.path([glass.D, glass.Cc, glass.B], false, 'ln-glass', d);
    S.raw('</g>');
  }

  // Évents d'une machine sur la face +y.
  function vents(S, P, x, y, z, w, d, h) {
    const yy = y + d;
    for (let i = 0; i < 3; i++) {
      const zz = z + h - 0.32 - i * 0.16;
      S.line(P(x + 0.28, yy, zz), P(x + 0.28 + w * 0.32, yy, zz), 'ln ln-d', 90);
    }
  }

  // Empreinte d'une machine effacée.
  function ghost(S, P, x, y, w, d) {
    S.path([P(x, y), P(x + w, y), P(x + w, y + d), P(x, y + d)], true, 'ln ln-h', 300);
  }

  // Feuille de PR posée au sol, trois lignes de texte.
  function prSheet(S, P, x, y, z, w = 1.5, d = 1.1) {
    box(S, P, x, y, z, w, d, 0.05, { fill: ['f-t', 'f-l', 'f-r'], dur: 260 });
    dogEar(S, P, x, y, z + 0.05, w, Math.min(0.24, w * 0.14));
    for (let i = 0; i < 3; i++) {
      const yy = y + 0.3 + i * 0.22;
      S.line(P(x + 0.22, yy, z + 0.05), P(x + 0.22 + (i === 2 ? 0.5 : 0.95), yy, z + 0.05), 'ln ln-d', 80);
    }
  }

  // Clé à plat sur un plan horizontal : anneau percé, tige à deux traits, panneton à trois dents.
  function key(S, P, cx, cy, z, sc = 1) {
    S.path(isoCircle(P, 'z', [cx, cy, z], 0.26 * sc, 32), true, 'ln ln-i', 240);
    S.path(isoCircle(P, 'z', [cx - 0.06 * sc, cy, z], 0.09 * sc, 16), true, 'ln ln-d', 80);
    const x0 = cx + 0.26 * sc, x1 = cx + 1.05 * sc, t = 0.035 * sc;
    S.line(P(x0 - 0.01 * sc, cy - t, z), P(x1, cy - t, z), 'ln ln-i', 160);
    S.path([P(x0 - 0.01 * sc, cy + t, z), P(x1 - 0.3 * sc, cy + t, z)], false, 'ln ln-i', 120);
    const u = (xx, yy) => P(x1 - xx * sc, cy + yy * sc, z);
    S.path([P(x1, cy - t, z), u(0, 0.22), u(0.08, 0.22), u(0.08, 0.14), u(0.15, 0.14), u(0.15, 0.2), u(0.22, 0.2), u(0.22, 0.12), u(0.3, 0.12), u(0.3, 0.035)], false, 'ln ln-i', 200);
  }

  /* ---------- détails des planches (v7) ---------- */

  // Cercle posé sur un plan : 'z' (horizontal), 'x' (face droite) ou 'y' (face gauche).
  function isoCircle(P, plane, c, r, n = 36) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
      if (plane === 'z') out.push(P(c[0] + u, c[1] + v, c[2]));
      else if (plane === 'x') out.push(P(c[0], c[1] + u, c[2] + v));
      else out.push(P(c[0] + u, c[1], c[2] + v));
    }
    return out;
  }

  // Machine fermée : joint du couvercle, plinthe, deux rangées de fentes sur la face gauche, deux ports et un témoin à droite.
  // Les détails s'effacent sous 26 px par unité (trop serrés au téléphone).
  function machineDetails(S, P, x, y, z, w, d, h, s) {
    if (s < 26) { vents(S, P, x, y, z, w, d, h); return; }
    const i = 0.15;
    S.path([P(x + i, y + i, z + h), P(x + w - i, y + i, z + h), P(x + w - i, y + d - i, z + h), P(x + i, y + d - i, z + h)], true, 'ln ln-f', 220);
    const pz = z + 0.14;
    S.line(P(x, y + d, pz), P(x + w, y + d, pz), 'ln ln-f', 160);
    S.line(P(x + w, y, pz), P(x + w, y + d, pz), 'ln ln-f', 160);
    const n = 5, span = w - 0.56, step = span / n;
    const rows = h < 1.2 ? [z + h * 0.6] : [z + h - 0.34, z + h - 0.54];
    for (const zz of rows) for (let k = 0; k < n; k++) {
      const x0 = x + 0.28 + k * step;
      S.line(P(x0, y + d, zz), P(x0 + step * 0.6, y + d, zz), 'ln ln-d', 50);
    }
    const port = (y0, z0, pw, ph) => S.path([P(x + w, y0, z0), P(x + w, y0 + pw, z0), P(x + w, y0 + pw, z0 + ph), P(x + w, y0, z0 + ph)], true, 'ln ln-d', 90);
    port(y + 0.3, z + 0.36, 0.34, 0.13);
    port(y + 0.74, z + 0.36, 0.34, 0.13);
    S.path(isoCircle(P, 'x', [x + w, y + d - 0.36, z + h - 0.38], 0.07, 20), true, 'ln ln-d', 90);
  }

  // Porte de coffre sur la face gauche : cadre, deux charnières, cadran gradué, poignée.
  function vaultDoor(S, P, x, y, w, d, h, s) {
    const yy = y + d, m = 0.2;
    S.path([P(x + m, yy, h - m), P(x + w - m, yy, h - m), P(x + w - m, yy, m), P(x + m, yy, m)], true, 'ln ln-d', 200);
    if (s < 26) { S.line(P(x + w - 0.48, yy, h * 0.64), P(x + w - 0.48, yy, h * 0.36), 'ln ln-i', 80); return; }
    for (const zz of [h - m - 0.2, m + 0.2]) S.line(P(x + m - 0.06, yy, zz - 0.08), P(x + m - 0.06, yy, zz + 0.08), 'ln ln-i', 60);
    const c = [x + w * 0.58, yy, h * 0.52], r = Math.min(w, h) * 0.19;
    S.path(isoCircle(P, 'y', c, r, 40), true, 'ln ln-i', 220);
    S.path(isoCircle(P, 'y', c, r * 0.32, 20), true, 'ln ln-d', 90);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      S.line(P(c[0] + Math.cos(a) * r * 0.78, yy, c[2] + Math.sin(a) * r * 0.78), P(c[0] + Math.cos(a) * r * 0.92, yy, c[2] + Math.sin(a) * r * 0.92), 'ln ln-f', 40);
    }
    S.line(P(x + w - m - 0.12, yy, h * 0.66), P(x + w - m - 0.12, yy, h * 0.38), 'ln ln-i', 80);
  }

  // Coin corné d'une feuille posée (coin arrière droit) : le pli se rabat sur la feuille.
  function dogEar(S, P, x, y, z, w, k = 0.2) {
    const a = P(x + w - k, y, z), b = P(x + w, y + k, z), f = P(x + w - k, y + k, z), c0 = P(x + w, y, z);
    S.push(`<path class="f-under" d="${poly([a, c0, b], true)}"/>`);
    S.face([a, f, b], 'f-l');
    S.path([a, f, b], false, 'ln ln-d', 80);
    S.line(a, b, 'ln ln-i', 60);
  }

  // Cadenas debout : corps plus large que haut, anse épaisse (deux arcs concentriques et leurs jambes), entrée de serrure.
  function padlock(S, P, x, y, z, sc = 1) {
    const w = 0.4 * sc, d = 0.14 * sc, h = 0.26 * sc, cx = x + w / 2, cy = y + d / 2, z0 = z + h, leg = 0.07 * sc;
    const shackle = (r, n = 18) => {
      const pts = [P(cx - r, cy, z0), P(cx - r, cy, z0 + leg)];
      for (let i = 0; i <= n; i++) { const a = Math.PI - Math.PI * (i / n); pts.push(P(cx + Math.cos(a) * r, cy, z0 + leg + Math.sin(a) * r)); }
      pts.push(P(cx + r, cy, z0));
      return pts;
    };
    S.path(shackle(w * 0.36), false, 'ln ln-i', 160);
    S.path(shackle(w * 0.22), false, 'ln ln-d', 140);
    box(S, P, x, y, z, w, d, h, { dur: 200 });
    S.path(isoCircle(P, 'y', [cx, y + d, z + h * 0.6], 0.04 * sc, 14), true, 'ln ln-d', 40);
    S.line(P(cx, y + d, z + h * 0.52), P(cx, y + d, z + h * 0.26), 'ln ln-d', 40);
  }


  // Trait de cote oblique, à 45° de la ligne de cote à l'écran.
  function tick(a, b, at, len = 6) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 4;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    return [[at[0] - dx, at[1] - dy], [at[0] + dx, at[1] + dy]];
  }

  /* ---------- trait de crayon (annotations à la main) ---------- */

  function rnd(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* Encre : chaque geste de plume est UN contour rempli, calculé autour d'une ligne médiane dense (un point tous les 1,2 px),
     avec une épaisseur continue (la pression) : attaque fine, plein, relâché. Pas de segments juxtaposés, donc ni bosses
     ni raccords ; une annotation entière (courbe et pointe) tient dans un seul <path>. Le tracé progressif recalcule le
     contour jusqu'à la longueur parcourue, terminé par un bout rond : la plume est là où le trait s'arrête. */
  const sstep = (a, b, x) => smooth((x - a) / (b - a));

  function pen(pts, wFn) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    return { pts, cum, L, ws: Array.isArray(wFn) ? wFn : cum.map((c, i) => wFn(c / L, i)) };
  }

  // Contour du geste jusqu'à la longueur len (bouts ronds : arcs de demi-cercle, tous les contours tournent dans le même sens).
  function penOutline(st, len) {
    if (len <= 0.05) return '';
    const { pts, ws, cum } = st;
    const P = [pts[0]], W = [ws[0]];
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] <= len) { P.push(pts[i]); W.push(ws[i]); continue; }
      const f = (len - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      P.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
      W.push(ws[i - 1] + (ws[i] - ws[i - 1]) * f);
      break;
    }
    if (P.length < 2) return '';
    const n = P.length, Lf = [], Rt = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const h = W[i] / 2;
      Lf.push([P[i][0] - ty * h, P[i][1] + tx * h]);
      Rt.push([P[i][0] + ty * h, P[i][1] - tx * h]);
    }
    const he = r2(Math.max(0.2, W[n - 1] / 2)), hs = r2(Math.max(0.2, W[0] / 2));
    return 'M' + Lf.map(pt).join('L') + `A${he} ${he} 0 0 0 ${pt(Rt[n - 1])}` + 'L' + Rt.reverse().map(pt).join('L') + `A${hs} ${hs} 0 0 0 ${pt(Lf[0])}Z`;
  }

  // Une annotation = des gestes enchaînés ; p de 0 à 1 parcourt leur longueur totale dans l'ordre.
  function inkD(strokes, p = 1) {
    let rest = p * strokes.reduce((s, st) => s + st.L, 0), d = '';
    for (const st of strokes) {
      if (rest <= 0) break;
      d += penOutline(st, Math.min(st.L, rest));
      rest -= st.L;
    }
    return d;
  }

  // Quadratique de a vers b, arquée de bend (fraction de la longueur), avec une ondulation lente qui s'éteint aux deux bouts.
  function inkCurvePts(a, b, bend, seed) {
    const R = rnd(seed);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const c = [(a[0] + b[0]) / 2 + nx * bend * len, (a[1] + b[1]) / 2 + ny * bend * len];
    const n = Math.max(16, Math.round(len * (1 + Math.abs(bend)) / 1.2));
    const ph = R() * 6, amp = 0.28 + R() * 0.12;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0];
      const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1];
      const wob = Math.sin(t * 7.5 + ph) * amp * Math.sin(Math.PI * t);
      pts.push([x + nx * wob, y + ny * wob]);
    }
    return pts;
  }

  // Flèche au crayon : la courbe (attaque fine, plein, relâché vers la pointe), puis la pointe en deux gestes qui se rejoignent.
  function inkArrow(from, to, bend, seed, wMax = 1.6, headK = 1) {
    const R = rnd(seed + 101);
    const ph = R() * 6;
    const body = pen(inkCurvePts(from, to, bend, seed), (t) => wMax * (0.3 + 0.7 * sstep(0, 0.2, t)) * (1 - 0.34 * sstep(0.6, 1, t)) * (1 + 0.05 * Math.sin(t * 6 + ph)));
    const n = body.pts.length;
    const back = body.pts[Math.max(0, n - 7)];
    const ang = Math.atan2(to[1] - back[1], to[0] - back[0]);
    const size = (7.5 + wMax * 0.8) * headK, spread = 0.46;
    const barb = (da) => [to[0] - Math.cos(ang + da) * size, to[1] - Math.sin(ang + da) * size];
    const b1 = barb(spread), b2 = barb(-spread);
    const wTip = wMax * 0.86;
    const h1 = pen(inkCurvePts(b1, to, 0.05, seed + 7), (t) => wTip * (0.4 + 0.6 * sstep(0, 1, t)));
    const h2 = pen(inkCurvePts(to, b2, -0.05, seed + 11), (t) => wTip * (1 - 0.6 * sstep(0, 1, t)));
    return [body, h1, h2];
  }

  // Ellipse tracée à la main : départ et arrivée se chevauchent, la pression monte puis se relâche.
  // Le raccord (environ 10 px de chevauchement) est en bas à droite ; l'épaisseur suit la direction du trait comme une
  // plume à bec tenue à 35° (pleins sur les montants, déliés en haut et en bas), avec une attaque et un relâché.
  function inkLoopStroke(cx, cy, rx, ry, seed, wMax = 1.8) {
    const R = rnd(seed);
    const a0 = 0.45 + R() * 0.1, sweep = Math.PI * 2 + 10 / ((rx + ry) / 2);
    const ph1 = R() * 6, ph2 = R() * 6;
    const n = Math.max(90, Math.round((rx + ry) * Math.PI * 1.1 / 1.2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + sweep * t;
      const k = 1 + 0.03 * Math.sin(a * 2 + ph1) + 0.04 * t;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k + Math.sin(a * 3 + ph2) * 0.6]);
    }
    const nib = -0.61;
    const ws = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const th = Math.atan2(b[1] - a[1], b[0] - a[0]), t = i / n;
      return wMax * (0.42 + 0.58 * Math.abs(Math.sin(th - nib))) * (0.3 + 0.7 * sstep(0, 0.1, t)) * (1 - 0.6 * sstep(0.86, 1, t));
    });
    return [pen(pts, ws)];
  }

  // Halo de papier sous l'encre : le même contour rempli, élargi de 5 px (2,5 px de chaque côté). Il interrompt proprement
  // les traits que l'encre croise. Un remplissage, jamais un trait épais : tracer un trait de contour sur ces courbes
  // coûtait jusqu'à 120 ms de rastérisation.
  const haloOf = (strokes) => strokes.map((st) => ({ ...st, ws: st.ws.map((w) => w + 5) }));

  // Registre des encres (le tracé progressif retrouve ici la géométrie de chaque encre et de son halo).
  const INK = new Map();
  let inkSeq = 0;
  function inkPath(strokes, S, t0 = 0, dur = 600) {
    const id = 'k' + (++inkSeq);
    INK.set(id, strokes);
    const timing = S && S.timed ? ` data-k="${Math.round(t0)},${Math.round(dur)}"` : '';
    return `<path class="ink-halo" data-ink="${id}"${timing} d="${inkD(haloOf(strokes), 1)}"/><path class="ink" data-ink="${id}"${timing} d="${inkD(strokes, 1)}"/>`;
  }

  // Les hachures sont définies une seule fois, dans le sprite du document (index.html) : aucun identifiant en double.
  function svgEl(inner, W, H, cls = '') {
    return `<svg xmlns="${NS}"${cls ? ` class="${cls}"` : ''} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" focusable="false">${inner}</svg>`;
  }
  // Rattache à chaque encre sa géométrie (pour le tracé progressif), puis libère le registre.
  function bindInk(root) {
    const els = [...root.querySelectorAll('path[data-ink]')];
    els.forEach((el) => { const st = INK.get(el.dataset.ink); el._ink = st && el.classList.contains('ink-halo') ? haloOf(st) : st; });
    els.forEach((el) => INK.delete(el.dataset.ink));
  }
  function mount(host, inner, W, H) {
    host.innerHTML = svgEl(inner, W, H);
    bindInk(host);
    return host.firstChild;
  }

  /* ---------- planche d'accueil ---------- */

  // Largeur réelle d'une annotation (Fragment Mono 15 px, approche -0,01 em), mesurée sur la police chargée.
  let mctx = null;
  const monoW = (s) => {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '400 15px "Fragment Mono", "Mono Repli", monospace';
    return mctx.measureText(s).width - 0.15 * s.length;
  };
  // Largeur d'un libellé de cote (Hanken Grotesk 15 px, chiffres tabulaires) : les cotes parlent la même langue que les heures de la démo.
  const sansW = (s) => {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '400 15px "Hanken Grotesk", "Hanken Repli", sans-serif';
    return mctx.measureText(s).width;
  };

  // Ce que la planche du hero a le droit d'occuper, dans le repère de l'hôte :
  // à droite, le filet du cadre moins 18 px ; à gauche, la colonne du texte ; jamais sur le bloc du chapeau et des boutons.
  function heroLimits(host) {
    const hr = host.getBoundingClientRect();
    const bw = document.documentElement.clientWidth;
    const gutter = Math.min(72, Math.max(20, innerWidth * 0.05));
    const framed = innerWidth > 760;
    const fx = framed ? Math.floor(Math.max(gutter / 2, (bw - 1312) / 2)) : 0;
    const h1 = q('.hero h1').getBoundingClientRect();
    const cp = q('.hero__copy').getBoundingClientRect();
    return {
      minX: Math.max(-hr.left, h1.left - hr.left),
      maxX: framed ? bw - fx - 18 - hr.left : bw - gutter - hr.left,
      copy: { x0: cp.left - hr.left - 20, y0: cp.top - hr.top - 20, x1: cp.right - hr.left + 20, y1: cp.bottom - hr.top + 20 },
    };
  }

  // Un rectangle touche-t-il un polygone convexe (séparation des axes) ?
  function hitsConvex(poly, b, m) {
    const R = [[b.x0 - m, b.y0 - m], [b.x1 + m, b.y0 - m], [b.x1 + m, b.y1 + m], [b.x0 - m, b.y1 + m]];
    const axes = [[1, 0], [0, 1]];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], c = poly[(i + 1) % poly.length]; axes.push([a[1] - c[1], c[0] - a[0]]); }
    for (const ax of axes) {
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const v of poly) { const d = v[0] * ax[0] + v[1] * ax[1]; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
      for (const v of R) { const d = v[0] * ax[0] + v[1] * ax[1]; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
      if (p1 < q0 || q1 < p0) return false;
    }
    return true;
  }
  const boxesHit = (a, b, m) => !(a.x1 + m < b.x0 || b.x1 + m < a.x0 || a.y1 + m < b.y0 || b.y1 + m < a.y0);

  // Ligne de base de la première ligne du chapeau (repère pour caler la première note du dessin).
  function leadBaseline() {
    const lead = q('.hero .lead');
    if (!lead || !lead.firstChild) return null;
    const r = document.createRange(); r.setStart(lead.firstChild, 0); r.setEnd(lead.firstChild, 1);
    const rect = r.getClientRects()[0];
    if (!rect) return null;
    const cs = getComputedStyle(lead);
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${cs.fontWeight} ${cs.fontSize} "Hanken Grotesk", "Hanken Repli", sans-serif`;
    return rect.top + mctx.measureText('Q').fontBoundingBoxAscent;
  }

  function drawHero(host, intro) {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    // Téléphone : la planche est cadrée plus grande que l'hôte et rognée à droite (la cote n'y figure pas).
    const crop = matchMedia('(max-width: 640px)').matches;
    const side = !crop && matchMedia('(min-width: 1024px)').matches; // texte et planche côte à côte
    const lim = heroLimits(host);
    const right = crop ? Math.round(W * 1.55) : Math.min(W, lim.maxX);
    const M = 2, Z0 = -0.4;
    const pts = [[0, 0, Z0], [12, 0, Z0], [12, 8, Z0], [0, 8, Z0], [1.5, 1.2, M], [-1.2, 1, 2.6]];
    if (!crop) pts.push([13.5, 8, Z0], [13.5, 0, Z0]);

    // La planche peut s'étendre à gauche, sous les boutons, tant que la dalle et la machine de verre restent à 28 px
    // du chapeau et des boutons : elle grandit dans le vide au lieu de le laisser.
    const project = (extra, dy) => {
      const pad = crop ? { l: 4, r: 4, t: 6, b: 6 } : { l: 8, r: Math.max(4, W - right), t: 8, b: 8 };
      const pr = projector(pts, (crop ? right : W) + extra, H, { ...pad, ax: crop ? 0.5 : 1, dy });
      return { s: pr.s, k: pr.k, P: (x, y, z = 0) => { const p = pr.P(x, y, z); return [p[0] - extra, p[1]]; } };
    };
    const hexOf = (P, x, y, z, w, d, h) => [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z), P(x, y + d, z + h)];
    let extra = 0;
    if (side) {
      const copy = { x0: lim.copy.x0 - 8, y0: lim.copy.y0 - 8, x1: lim.copy.x1 + 8, y1: lim.copy.y1 + 8 };
      for (let e = Math.max(0, Math.floor(-lim.minX)); e > 0; e -= 8) {
        const { P } = project(e, 0);
        const slab = [P(0, 0, 0), P(12, 0, 0), P(12, 0, Z0), P(12, 8, Z0), P(0, 8, Z0), P(0, 8, 0)];
        const glass = hexOf(P, 1.5, 1.2, 0, M, M, M);
        if (P(0, 8, 0)[0] < lim.minX) continue;
        if (!hitsConvex(slab, copy, 0) && !hitsConvex(glass, copy, 0)) { extra = e; break; }
      }
    }

    const build = (dy) => {
      const { P, s, k } = project(extra, dy);
      // Positions recalées pour que toutes les arêtes verticales tombent au milieu d'une colonne de pixels.
      const col = (x, y) => y + Math.round((x - y) * k) / k;
      const sz = (v) => Math.round(v * k) / k;
      const S = new Sheet();
      S.timed = intro;
      const sil = []; // silhouettes du dessin, que les annotations ne doivent pas toucher
      const hex = (c) => [c.A, c.B, c.E, c.F, c.G, c.D];

      // Socle : dalle coupée, tranche hachurée comme une coupe.
      S.at(0);
      const A = P(0, 0, 0), B = P(12, 0, 0), Cc = P(12, 8, 0), D = P(0, 8, 0);
      const E = P(12, 0, Z0), F = P(12, 8, Z0), G = P(0, 8, Z0);
      S.face([A, B, Cc, D], 'f-t');
      S.face([D, Cc, F, G], 'hatch-l');
      S.face([Cc, B, E, F], 'hatch-r');
      S.path([A, B, E, F, G, D], true, 'ln ln-o', 760);
      S.line(D, Cc, 'ln ln-i', 300); S.line(Cc, B, 'ln ln-i', 300); S.line(Cc, F, 'ln ln-i', 120);
      sil.push([A, B, E, F, G, D]);
      S.at(420);
      for (let i = 1; i < 12; i++) S.line(P(i, 0), P(i, 8), 'ln ln-g', 320).wait(16);
      for (let j = 1; j < 8; j++) S.line(P(0, j), P(12, j), 'ln ln-g', 320).wait(16);

      // Cote : la nuit mesurée le long du bord avant droit. Attaches à 5 px de la dalle, 7 px au-delà de la ligne de cote ;
      // traits obliques de 9 px à 45° ; le texte posé à plat dans le plan du sol, centré dans sa coupure.
      if (!crop) {
        S.at(760);
        const xd = 12 + Math.max(0.8, 34 / s), g0 = 12 + 5 / s, g1 = xd + 7 / s;
        S.line(P(g0, 0, Z0), P(g1, 0, Z0), 'ln ln-f', 160);
        S.line(P(g0, 8, Z0), P(g1, 8, Z0), 'ln ln-f', 160);
        const label = 'de 22' + NB + 'h à 7' + NB + 'h';
        const tl = (sansW(label) + 22) / s;
        const showLabel = tl < 6.2; // sous cette échelle, la cote reste sans texte
        if (showLabel) {
          S.line(P(xd, 0, Z0), P(xd, 4 - tl / 2, Z0), 'ln ln-d', 260);
          S.line(P(xd, 4 + tl / 2, Z0), P(xd, 8, Z0), 'ln ln-d', 260);
        } else S.line(P(xd, 0, Z0), P(xd, 8, Z0), 'ln ln-d', 360);
        for (const yy of [0, 8]) S.line(...tick(P(xd, 0, Z0), P(xd, 8, Z0), P(xd, yy, Z0), 4.5), 'ln ln-i', 80);
        const tp = P(xd, 4, Z0);
        if (showLabel) S.text(0, 5, label, 'lab lab-c', ` text-anchor="middle" transform="translate(${r2(tp[0])} ${r2(tp[1])}) matrix(${r2(C)} -0.5 ${r2(C)} 0.5 0 0)"`);
        sil.push([P(12, 0, Z0), P(g1 + 0.3, 0, Z0), P(g1 + 0.3, 8, Z0), P(12, 8, Z0)]);
      }

      // Arrière : la machine de verre (l'agent), deux machines fermées.
      S.at(980);
      const gy = 1.2, gx = col(1.5, gy);
      let csk = Math.round(1.08 * k); if ((M * k - csk) % 2) csk -= 1;
      const cs = csk / k, co = (M - cs) / 2;
      const glassFloor = [P(gx, gy), P(gx + M, gy), P(gx + M, gy + M), P(gx, gy + M)];
      S.face(glassFloor, 'f-p');
      S.line(P(gx, gy), P(gx + M, gy), 'ln ln-h', 200); S.line(P(gx, gy), P(gx, gy + M), 'ln ln-h', 200); S.line(P(gx, gy), P(gx, gy, M), 'ln ln-h', 200);
      S.path([P(gx + co - 0.14, gy + co - 0.14), P(gx + co + cs + 0.14, gy + co - 0.14), P(gx + co + cs + 0.14, gy + co + cs + 0.14), P(gx + co - 0.14, gy + co + cs + 0.14)], true, 'ln ln-f', 200);
      S.wait(160);
      const glass = box(S, P, gx, gy, 0, M, M, M, { fill: null, glassFill: true });
      sil.push(hex(glass));
      S.wait(220);
      const cube = box(S, P, gx + co, gy + co, 0.22, cs, cs, cs, { fill: ['o-t', 'o-l', 'o-r'], dur: 380, after: agentQuarter });
      glassOver(S, 'qcl-hero', cube, glass);
      S.wait(200);
      const sealed = (x, y) => { sil.push(hex(box(S, P, col(x, y), y, 0, M, M, M))); machineDetails(S, P, col(x, y), y, 0, M, M, M, s); S.wait(170); };
      sealed(5, 1.2);

      // Coffre et clé, au fond à droite. La clé est posée vers l'avant du dessus, loin des arêtes arrière.
      const vy = 1.3, vx = col(9.1, vy), vw = sz(1.7), vh = 1.3;
      sil.push(hex(box(S, P, vx, vy, 0, vw, vw, vh)));
      vaultDoor(S, P, vx, vy, vw, vw, vh, s);
      const kx = vx + 0.6, ky = vy + 0.85;
      key(S, P, kx, ky, vh, 0.9);
      S.wait(160);

      // Les clés prêtées : un chemin en tirets au sol, du pied du coffre à la machine de verre, par l'allée entre les rangées.
      if (s >= 26) {
        const ay = 3.82, kxs = vx + vw * 0.5, gxe = gx + M * 0.62;
        S.path([P(kxs, vy + vw + 0.14), P(kxs, ay), P(gxe, ay), P(gxe, gy + M + 0.2)], false, 'ln ln-h', 600);
        const tipK = P(gxe, gy + M + 0.14), backK = P(gxe, gy + M + 0.42);
        const ang = Math.atan2(tipK[1] - backK[1], tipK[0] - backK[0]);
        for (const da of [0.45, -0.45]) S.line(tipK, [tipK[0] - Math.cos(ang + da) * 6, tipK[1] - Math.sin(ang + da) * 6], 'ln ln-f', 60);
      }

      // Avant : deux machines effacées, leur PR posée devant, une machine fermée.
      // Les feuilles laissent 0,45 unité jusqu'au bord de la dalle : la pointe de la flèche s'y loge sans toucher un trait.
      ghost(S, P, col(1.5, 4.45), 4.45, M, M); S.wait(80);
      ghost(S, P, col(5, 4.45), 4.45, M, M); S.wait(140);
      prSheet(S, P, col(1.6, 6.6), 6.6, 0, sz(1.8), sz(0.95)); S.wait(120);
      prSheet(S, P, col(5.1, 6.6), 6.6, 0, sz(1.8), sz(0.95)); S.wait(160);
      sealed(8.5, 4.45);

      /* Annotations au crayon. Chaque note essaie ses places dans l'ordre et prend la première qui tient :
         dans la zone permise (cadre, colonne du texte, hôte visible), hors du dessin (6 px de marge), hors du chapeau et des
         boutons, à distance des autres notes, avec une flèche de 26 à 150 px. Sinon, la note n'est pas posée.
         Un halo de papier sous chaque encre interrompt proprement les traits qu'elle croise. */
      let ink = '', firstBase = null;
      if (s >= 18) {
        S.at(1500);
        const X0 = crop ? 6 : lim.minX, X1 = crop ? W - 6 : Math.min(W, lim.maxX);
        const LH = 19;
        const block = (lines, anchor, x, y) => {
          const w = Math.max(...lines.map(monoW));
          const x0 = anchor === 'end' ? x - w : x;
          return { lines, anchor, x, y, w, b: { x0, y0: y - 12, x1: x0 + w, y1: y + LH * (lines.length - 1) + 4 } };
        };
        const startOf = (nb, sd) => {
          const b = nb.b, my = (b.y0 + b.y1) / 2, inset = Math.min(22, nb.w / 3);
          if (sd === 'right') return [b.x1 + 9, my];
          if (sd === 'left') return [b.x0 - 9, my];
          const x = nb.anchor === 'end' ? b.x1 - inset : b.x0 + inset;
          return sd === 'top' ? [x, b.y0 - 7] : [x, b.y1 + 7];
        };
        const placed = [];
        const fits = (nb, from, tip) => {
          const b = nb.b;
          if (b.x0 < X0 || b.x1 > X1 || b.y0 < 4 || b.y1 > H - 4) return false;
          if (!crop && boxesHit(b, lim.copy, 0)) return false;
          if (sil.some((pl) => hitsConvex(pl, b, 6))) return false;
          if (placed.some((o) => boxesHit(b, o.b, 14))) return false;
          const L = Math.hypot(tip[0] - from[0], tip[1] - from[1]);
          return L >= 26 && L <= 170;
        };
        const g1 = P(gx, gy + M * 0.5, M);
        const agentTip = [(cube.D[0] + cube.G[0]) / 2 - 5, (cube.D[1] + cube.G[1]) / 2];
        const pr = P(col(1.6, 6.6) + 0.55, 6.6 + sz(0.95), 0.05); // milieu du bord avant gauche de la feuille
        const kp = P(kx, ky, vh);                                    // anneau de la clé
        const notes = [
          { text: ['l’agent', 'travaille'], ref: [g1[0] - 4, g1[1] - 5], tip: agentTip, first: true, tries: [
            ['end', -1.3, -0.95, 'right', 0.2], ['end', -1.7, -0.15, 'right', 0.16], ['end', -0.9, -1.55, 'right', 0.22]] },
          { text: ['sa PR', 'vous attend'], tip: [pr[0] - 4.3, pr[1] + 2.6], head: 0.85, tries: [
            ['end', -1.1, 0.75, 'right', -0.2], ['start', -0.6, 1.8, 'top', 0.2], ['start', -0.8, 2.5, 'top', 0.18], ['start', -1.0, 3.2, 'top', 0.16]] },
          { text: ['vos clés', 'restent ici'], tip: [kp[0], kp[1] - 0.17 * s - 6], head: 0.85, tries: [
            ['start', 0.25, -2.7, 'bottom', -0.16], ['end', -0.25, -2.7, 'bottom', 0.16], ['start', 1.0, -1.7, 'left', 0.2]] },
        ];
        notes.forEach((nt, i) => {
          for (const [anchor, ux, uy, sd, bend] of nt.tries) {
            const ref = nt.ref || nt.tip; // la note se place par rapport à son repère, la flèche va à sa pointe
            const nb = block(nt.text, anchor, ref[0] + ux * s, ref[1] + uy * s);
            const from = startOf(nb, sd);
            if (!fits(nb, from, nt.tip)) continue;
            placed.push(nb);
            if (nt.first) firstBase = nb.y;
            ink += inkPath(inkArrow(from, nt.tip, bend, 7 + i * 13, 1.55, nt.head || 1), S, S.t, 560);
            S.wait(300);
            const an = anchor === 'end' ? ' text-anchor="end"' : '';
            nt.text.forEach((ln, j) => S.text(nb.x, nb.y + j * LH, ln, 'lab lab--k halo', an));
            S.wait(100);
            break;
          }
        });
      }
      // Emprise verticale du dessin et des notes (pour savoir jusqu'où on peut le déplacer).
      const ys = sil.flat().map((p) => p[1]);
      return { html: S.toString() + `<g class="ink-g">${ink}</g>`, firstBase, top: Math.min(...ys), bottom: Math.max(...ys) };
    };

    let g = build(0);
    // Côte à côte : la première note se cale sur la première ligne du chapeau (même ligne de base), si la place le permet.
    if (side && g.firstBase != null) {
      const lb = leadBaseline();
      if (lb != null) {
        const want = Math.round(lb - host.getBoundingClientRect().top - g.firstBase);
        const dy = Math.max(Math.min(want, H - 8 - g.bottom), 8 - g.top);
        if (Math.abs(dy) >= 1) { INK.clear(); const g2 = build(dy); if (g2.firstBase != null) g = g2; else g = build(0); }
      }
    }
    const svg = mount(host, g.html, W, H);
    if (intro) playIntro(svg);
  }

  // Courbe du tracé (cubic-bezier(.45, .05, .25, 1)), résolue en x.
  const traceEase = (() => {
    const x1 = 0.45, y1 = 0.05, x2 = 0.25, y2 = 1;
    const bx = (t) => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
    const by = (t) => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 18; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
      return by(t);
    };
  })();

  // Tracé de la planche comme au traceur : chaque trait grandit de son début à sa fin (trait plein, partiel).
  // Pas de stroke-dasharray : animé sur de nombreux traits à la fois, il coûtait une image de ~140 ms.
  // prepare() vide les traits ; run() lance (une fois) ; run.finish() pose l'état final sans animation.
  function prepareTrace(svg) {
    const lines = [];
    svg.querySelectorAll('[data-a]').forEach((el) => {
      const [t0, d] = el.dataset.a.split(',').map(Number);
      el.style.setProperty('--t0', t0 + 'ms');
      if (el.tagName.toLowerCase() !== 'path') return; // les lignes cachées (groupes de tirets) apparaissent en fondu
      const full = el.getAttribute('d');
      const nums = full.match(/-?[\d.]+/g).map(Number);
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      if (/Z\s*$/.test(full)) pts.push(pts[0]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      lines.push({ el, full, pts, cum, L: cum[cum.length - 1], t0, d, last: -1 });
    });
    svg.querySelectorAll('[data-f]').forEach((el) => { el.style.setProperty('--t0', (+el.dataset.f + 200) + 'ms'); });
    // Encres : la plume avance le long du geste (contour recalculé jusqu'à la longueur parcourue).
    const inks = [];
    svg.querySelectorAll('path[data-ink][data-k]').forEach((el) => {
      const [t0, d] = el.dataset.k.split(',').map(Number);
      if (el._ink) inks.push({ el, st: el._ink, full: el.getAttribute('d'), t0, d, last: -1, halo: el.classList.contains('ink-halo') });
    });
    let end = 0;
    lines.forEach((l) => { end = Math.max(end, l.t0 + l.d); });
    inks.forEach((k) => { end = Math.max(end, k.t0 + k.d); });
    svg.querySelectorAll('[data-a]').forEach((el) => { const [t0, d] = el.dataset.a.split(','); end = Math.max(end, +t0 + +d); });
    svg.querySelectorAll('[data-f]').forEach((el) => { end = Math.max(end, +el.dataset.f + 700); });
    svg.classList.add('is-intro', 'is-wait');
    lines.forEach((l) => l.el.setAttribute('d', 'M0 0'));
    lines.forEach((l) => l.el.setAttribute('visibility', 'hidden'));
    inks.forEach((k) => k.el.setAttribute('d', ''));

    const partial = (l, p) => {
      const target = l.L * p;
      let s = 'M' + pt(l.pts[0]);
      for (let i = 1; i < l.pts.length; i++) {
        if (l.cum[i] <= target) { s += 'L' + pt(l.pts[i]); continue; }
        const seg = l.cum[i] - l.cum[i - 1] || 1, u = (target - l.cum[i - 1]) / seg;
        const a = l.pts[i - 1], b = l.pts[i];
        s += 'L' + pt([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
        break;
      }
      return s;
    };
    let ran = false, done = false, raf = 0, start = 0, lastFrame = 0;
    const finish = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      lines.forEach((l) => { l.el.setAttribute('d', l.full); l.el.removeAttribute('visibility'); });
      inks.forEach((k) => k.el.setAttribute('d', k.full));
      svg.classList.remove('is-intro', 'is-wait');
    };
    const frame = (now) => {
      raf = 0;
      if (done) return;
      if (lastFrame && now - lastFrame < 15.5) { raf = requestAnimationFrame(frame); return; } // 60 images/s au plus
      lastFrame = now;
      const e = now - start;
      let busy = false;
      for (const l of lines) {
        const p = traceEase((e - l.t0) / l.d);
        if (p < 1) busy = true;
        const q = Math.round(p * 400);
        if (q === l.last) continue;
        l.last = q;
        if (p <= 0) continue;
        if (l.el.hasAttribute('visibility')) l.el.removeAttribute('visibility');
        l.el.setAttribute('d', p >= 1 ? l.full : partial(l, p));
      }
      for (const k of inks) {
        const p = traceEase((e - k.t0) / k.d);
        if (p < 1) busy = true;
        const qv = Math.round(p * 600);
        if (qv === k.last) continue;
        k.last = qv;
        if (p <= 0) continue;
        k.el.setAttribute('d', p >= 1 ? k.full : inkD(k.st, p));
      }
      if (busy) raf = requestAnimationFrame(frame);
      else setTimeout(() => { if (!done) { done = true; svg.classList.remove('is-intro'); } }, Math.max(0, end - e) + 900);
    };
    const run = () => {
      if (ran) return; ran = true;
      svg.classList.remove('is-wait');
      start = performance.now();
      if (params.has('film')) (window.__qruns = window.__qruns || []).push([svg, start]); // films image par image (_outils/film_ink.py)
      raf = requestAnimationFrame(frame);
    };
    run.finish = finish;
    return run;
  }
  function playIntro(svg) { prepareTrace(svg)(); }

  // Une arrivée par section : quand la planche entre à l'écran, on la trace.
  const arrivals = new Map();
  const arrIO = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      const fn = arrivals.get(e.target);
      arrIO.unobserve(e.target);
      arrivals.delete(e.target);
      e.target.dataset.arrived = '1';
      if (fn) fn();
    }
  }, { threshold: 0.3 });
  function onArrive(el, fn) {
    if (el.dataset.arrived) { fn(); return; }
    arrivals.set(el, fn); arrIO.observe(el);
  }
  const animate = () => !RM.matches && !params.has('t') && params.get('intro') !== '0';

  /* ---------- vue éclatée : les couches s'écartent à l'arrivée ---------- */

  /* Chaque couche est un SVG à part, composité (will-change) : le flottement ne redessine rien, il déplace des calques.
     Bureau : chaque légende est attachée à sa couche par un trait horizontal de 1 px, posé sur une ligne de pixels entière,
     qui part d'un point sur l'arête droite de la couche. La couche, son trait et sa légende flottent ensemble : le trait
     reste horizontal et net à chaque image. Sous 900 px (ou si les légendes ne tiennent pas), les légendes passent en
     liste numérotée sous le dessin. */
  let exOpened = false, exBuilt = false;
  const EX_KEY = { agent: 'core', repo: 'repo', keys: 'keys', box: 'base' };
  function drawExploded(host) {
    const wrap = q('#eclate'), notes = q('#eclate-notes'), leadsBox = q('#eclate-leads');
    const lis = [...notes.children];
    if (!exBuilt) {
      exBuilt = true;
      leadsBox.innerHTML = lis.map((li, i) => `<span class="eclate__lead" style="--i:${i}"></span>`).join('');
    }
    const leadEls = [...leadsBox.children];
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    const stacked = matchMedia('(max-width: 900px)').matches;
    // Les légendes commencent sur la colonne 8 de la grille, comme le texte du tarif.
    const noteW = stacked ? 0 : W - Math.round(7 * (W + 32) / 12);
    if (!stacked) lis.forEach((li) => { li.style.width = noteW + 'px'; });
    else lis.forEach((li) => { li.style.left = li.style.top = li.style.width = ''; });
    const noteH = lis.map((li) => li.offsetHeight);

    // Écarts entre couches (en unités) ; on les ouvre un peu si une légende ne tient pas face à sa couche.
    let g = 1, geo;
    for (;;) {
      const Z = { base: 0 };
      Z.keys = 0.7 + 1.2 * g; Z.repo = Z.keys + 0.1 + 1.4 * g; Z.core = Z.repo + 0.1 + 1.35 * g;
      const pts = [[0, 0, -0.1], [3, 0, -0.1], [3, 3, -0.1], [0, 3, -0.1], [0.75, 0.75, Z.core + 1.5], [2.25, 0.75, Z.core + 1.5], [0.75, 2.25, Z.core + 1.5]];
      // Le dessin est posé sur le bas de son cadre : le vide jusqu'au filet suivant est exactement le pas des sections.
      // Au bureau, le dessin part du bord gauche de la colonne, sous le titre (même axe).
      const pr = projector(pts, W, H, { l: stacked ? 4 : 1, r: stacked ? 64 : noteW + 64, t: 14, b: 1, ax: stacked ? 0.42 : 0, ay: 1, maxS: 132 });
      const anchors = { core: pr.P(2.25, 0.75, Z.core + 0.75), repo: pr.P(2.75, 0.25, Z.repo + 0.05), keys: pr.P(2.75, 0.25, Z.keys + 0.05), base: pr.P(3, 0, 0.35) };
      geo = { Z, ...pr, anchors };
      if (stacked || g >= 1.9) break;
      // La légende i (titre centré sur son point d'attache) doit finir 16 px avant le titre de la suivante.
      const ys = lis.map((li) => Math.round(anchors[EX_KEY[li.dataset.k]][1]) + 0.5);
      let fit = true;
      for (let i = 0; i + 1 < lis.length; i++) if (ys[i + 1] - ys[i] < noteH[i] + 16) fit = false;
      if (fit) break;
      g += 0.1;
    }
    const { Z, P, s, anchors } = geo;

    // Au téléphone, le repère numéroté voyage avec sa couche.
    const tag = {};
    if (stacked) {
      // Même règle qu'au bureau : un point sur l'arête de la couche, puis le trait jusqu'au numéro.
      lis.forEach((li, i) => {
        const a = anchors[EX_KEY[li.dataset.k]];
        const y = Math.round(a[1] - 0.5) + 0.5, x = a[0], t = 400 + i * 140;
        const L = new Sheet(); L.timed = true; L.at(t);
        L.raw(`<circle class="ex-dot" cx="${r2(x)}" cy="${y}" r="3" data-f="${t}"/>`);
        L.line([x + 6, y], [x + 28, y], 'ln ln-l', 200);
        L.raw(`<text class="lab lab--k" x="${r2(x + 36)}" y="${r2(y + 5)}" data-f="${t + 120}">${i + 1}</text>`);
        tag[EX_KEY[li.dataset.k]] = L.toString();
      });
    }

    // Lignes d'alignement de l'éclaté (derrière tout, fixes).
    const al = new Sheet(); al.timed = true; al.at(0);
    // Elles passent par les sommets des plaques : les points d'attache du dépôt et des clés sont posés sur le rail de droite.
    for (const c of [[0.25, 2.75], [2.75, 2.75], [2.75, 0.25]]) al.line(P(c[0], c[1], 0.7), P(c[0], c[1], Z.repo + 0.1), 'ln ln-h', 400);
    al.line(P(1.5, 1.5, Z.repo + 0.1), P(1.5, 1.5, Z.core), 'ln ln-h', 300);

    // Machine : bac ouvert.
    const b = new Sheet();
    for (const [fx, fy] of [[0.12, 2.58], [2.58, 2.58], [2.58, 0.12]]) box(b, P, fx, fy, -0.1, 0.3, 0.3, 0.1, { dur: 120 });
    box(b, P, 0, 0, Z.base, 3, 3, 0.7, { fill: ['hatch-s', 'f-l', 'f-r'] });
    const ins = 0.24;
    const hole = [P(ins, ins, 0.7), P(3 - ins, ins, 0.7), P(3 - ins, 3 - ins, 0.7), P(ins, 3 - ins, 0.7)];
    // Intérieur de la baie, découpé à la forme de l'ouverture : les deux parois du fond (seules visibles) et le plancher quadrillé.
    b.raw(`<clipPath id="ex-bay"><path d="${poly(hole, true)}"/></clipPath><g clip-path="url(#ex-bay)">`);
    b.path([P(ins, ins, 0.7), P(ins, ins, 0.2), P(3 - ins, ins, 0.2), P(3 - ins, ins, 0.7)], true, 'f-l');
    b.path([P(ins, ins, 0.7), P(ins, ins, 0.2), P(ins, 3 - ins, 0.2), P(ins, 3 - ins, 0.7)], true, 'f-r');
    b.path([P(ins, ins, 0.2), P(3 - ins, ins, 0.2), P(3 - ins, 3 - ins, 0.2), P(ins, 3 - ins, 0.2)], true, 'f-p');
    for (let k = 1; k < 5; k++) {
      const t = ins + k * (3 - 2 * ins) / 5;
      b.line(P(t, ins, 0.2), P(t, 3 - ins, 0.2), 'ln ln-g');
      b.line(P(ins, t, 0.2), P(3 - ins, t, 0.2), 'ln ln-g');
    }
    b.line(P(ins, ins, 0.2), P(3 - ins, ins, 0.2), 'ln ln-f'); b.line(P(ins, ins, 0.2), P(ins, 3 - ins, 0.2), 'ln ln-f'); b.line(P(ins, ins, 0.7), P(ins, ins, 0.2), 'ln ln-f');
    b.raw('</g>');
    b.path(hole, true, 'ln ln-d');
    machineDetails(b, P, 0, 0, 0, 3, 3, 0.7, 30);
    // Clés prêtées : la clé est posée dans la bande avant de la plaque, celle que la couche du dessus ne cache pas.
    const kk = new Sheet();
    box(kk, P, 0.25, 0.25, Z.keys, 2.5, 2.5, 0.1);
    key(kk, P, 0.66, 2.08, Z.keys + 0.1, 1.0);
    padlock(kk, P, 2.18, 2.28, Z.keys + 0.1, 1.1);
    // Dépôt cloné : arborescence.
    const rp = new Sheet();
    box(rp, P, 0.25, 0.25, Z.repo, 2.5, 2.5, 0.1);
    {
      const zz = Z.repo + 0.1, ym = 1.55, yb = 2.35;
      const dot = (x, y, main) => {
        const c = isoCircle(P, 'z', [x, y, zz], 0.085, 20);
        rp.face(c, main ? 'f-t' : 'o-dot'); rp.path(c, true, main ? 'ln ln-i' : 'ln ln-v', 60);
      };
      // main : de bout en bout, deux commits à l'avant-gauche, un à droite (loin de la pointe de la PR)
      rp.line(P(0.45, ym, zz), P(2.6, ym, zz), 'ln ln-i', 300);
      // départ de la branche : courbe douce de main vers la voie de l'agent
      const x0 = 0.9, curve = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, e = t * t * (3 - 2 * t); curve.push(P(x0 + t * 0.5, ym + (yb - ym) * e, zz)); }
      rp.path(curve.concat([P(2.05, yb, zz)]), false, 'ln ln-v', 360);
      // la PR : tirets qui montent vers main et s'arrêtent avant, pointe ouverte
      const pa = P(2.05, yb - 0.14, zz), pb = P(2.05, ym + 0.2, zz);
      rp.line(pa, pb, 'ln ln-h', 200);
      const ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
      for (const da of [0.5, -0.5]) rp.line(pb, [pb[0] - Math.cos(ang + da) * 6, pb[1] - Math.sin(ang + da) * 6], 'ln ln-f', 60);
      for (const x of [0.62, 0.9, 2.42]) dot(x, ym, true);
      for (const x of [1.45, 1.75, 2.05]) dot(x, yb, false);
    }
    // L'agent : le cube violet, son quart blanc (le logo inversé).
    const co = new Sheet();
    box(co, P, 0.75, 0.75, Z.core, 1.5, 1.5, 1.5, { fill: ['o-t', 'o-l', 'o-r'], after: (S2, c) => agentQuarter(S2, c) });

    const layer = (name, inner) => {
      return svgEl(inner + (tag[name] || ''), W, H, 'ex-svg').replace('<svg ', `<svg data-name="${name}" `);
    };
    host.innerHTML = svgEl(al.toString(), W, H, 'ex-align') + layer('base', b) + layer('keys', kk) + layer('repo', rp) + layer('core', co);
    const layers = [...host.querySelectorAll('.ex-svg')];
    // Chaque calque est réduit à l'emprise de sa couche (6 px de marge pour les traits) : quatre petites surfaces à
    // rastériser au lieu de quatre calques de la taille de la section. Décalages entiers : le dessin reste au pixel près.
    layers.forEach((sv) => {
      const bb = sv.getBBox();
      const x = Math.floor(bb.x - 6), y = Math.floor(bb.y - 6);
      const w = Math.ceil(bb.x + bb.width + 6) - x, h = Math.ceil(bb.y + bb.height + 6) - y;
      sv.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); sv.setAttribute('width', w); sv.setAttribute('height', h);
      Object.assign(sv.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    });

    // Légendes au bureau : titre centré sur le point d'attache, trait de la couche à la légende.
    const leads = [];
    if (!stacked) {
      const colX = Math.round(W - noteW);
      lis.forEach((li, i) => {
        const name = EX_KEY[li.dataset.k], a = anchors[name];
        const row = Math.round(a[1] - 0.5);           // ligne de pixels du trait
        const x0 = Math.floor(a[0]);                  // l'arête tombe au milieu de cette colonne (n + 0,5)
        li.style.left = colX + 'px';
        li.style.top = (row - 14) + 'px';             // milieu des capitales du titre sur la ligne du trait
        const ld = leadEls[i];
        ld.style.left = x0 + 'px'; ld.style.top = row + 'px'; ld.style.width = Math.max(24, colX - 14 - x0) + 'px';
        leads.push({ name, li, ld });
      });
    }
    const runs = [...host.querySelectorAll('svg')].filter((sv) => sv.querySelector('[data-a]')).map((sv) => prepareTrace(sv));
    const runAll = () => runs.forEach((r) => r());
    runAll.finish = () => runs.forEach((r) => r.finish());
    const open = (instant) => {
      exOpened = true;
      layers.forEach((g2, i) => {
        g2.style.transition = instant ? 'none' : `transform 1.35s cubic-bezier(.2,.75,.18,1) ${i * 90}ms`;
        g2.style.transform = 'translate3d(0,0,0)';
      });
      if (instant) { runAll.finish(); notes.classList.add('is-open'); wrap.classList.add('is-open'); return; }
      setTimeout(runAll, 900);
      setTimeout(() => { notes.classList.add('is-open'); wrap.classList.add('is-open'); }, 1000);
    };
    open(true); // section immobile : ni ouverture, ni flottement
  }



  /* ---------- cote du tarif : une heure de machine ---------- */

  function drawCote(host) {
    const num = q('.tarif__chiffre');
    if (!num) return;
    const r = document.createRange(); r.selectNodeContents(num);
    const w = Math.round(r.getBoundingClientRect().width);
    const H = host.clientHeight;
    if (!w || !H) return;
    const S = new Sheet(); S.timed = true; S.at(0);
    const y = Math.round(H * 0.5) + 0.5;
    // Même convention que la cote du hero : attaches qui dépassent de 7 px, traits obliques de 9 px, coupure ajustée au texte.
    // Chaque trait de part et d'autre du libellé garde au moins 26 px (les obliques ne touchent jamais le texte) ;
    // sinon le libellé court, et en dernier recours le libellé passe au-dessus d'un trait continu.
    const GAP = 11, MIN = 26;
    let label = 'une heure de machine';
    let tw = sansW(label) + 2 * GAP;
    if (w - tw < 2 * MIN) { label = '1' + NB + 'h de machine'; tw = sansW(label) + 2 * GAP; }
    const above = w - tw < 2 * MIN;
    S.line([0.5, y - 7], [0.5, H - 2], 'ln ln-f', 200);
    S.line([w - 0.5, y - 7], [w - 0.5, H - 2], 'ln ln-f', 200);
    S.wait(160);
    if (above) S.line([0.5, y], [w - 0.5, y], 'ln ln-d', 520);
    else {
      S.line([0.5, y], [Math.round((w - tw) / 2) + 0.5, y], 'ln ln-d', 360);
      S.line([Math.round((w + tw) / 2) - 0.5, y], [w - 0.5, y], 'ln ln-d', 360);
    }
    S.wait(300);
    for (const x of [0.5, w - 0.5]) S.line(...tick([0, y], [w, y], [x, y], 4.5), 'ln ln-i', 80);
    S.text(w / 2, above ? y - 8 : y + 5, label, 'lab lab-c', ' text-anchor="middle"');
    host.style.width = w + 'px';
    const svg = mount(host, S.toString(), w, H);
    // Côte à côte : le haut des attaches de la cote se cale sur le haut des capitales du titre voisin (sur l'encre, pas sur les boîtes).
    host.style.marginTop = '';
    if (matchMedia('(min-width: 1024px)').matches) {
      const h2 = q('#tarif-titre'), cs = getComputedStyle(h2);
      if (!mctx) mctx = document.createElement('canvas').getContext('2d');
      mctx.font = `${cs.fontWeight} ${cs.fontSize} "Hanken Grotesk", "Hanken Repli", sans-serif`;
      const m = mctx.measureText('V');
      const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
      const capTop = h2.getBoundingClientRect().top + (parseFloat(cs.lineHeight) - asc - desc) / 2 + (asc - m.actualBoundingBoxAscent);
      const inkTop = host.getBoundingClientRect().top + (y - 7);
      host.style.marginTop = Math.round(capTop - inkTop) + 'px';
    } else host.style.marginTop = -Math.floor(y - 7) + 'px'; // empilé : l'encre de la cote commence au haut de la section
    const run = prepareTrace(svg);
    if (!animate() || host.dataset.arrived) { run.finish(); return; }
    onArrive(host, run);
  }

  /* ---------- la nuit ---------- */

  const hm = (t) => {
    const h = (22 + Math.floor(t / 60)) % 24, m = Math.floor(t % 60);
    return h + NB + 'h' + NB + String(m).padStart(2, '0');
  };
  const hmLog = (t) => {
    const h = (22 + Math.floor(t / 60)) % 24, m = Math.floor(t % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  const TASKS = [
    { name: 'formulaires', on: 2, pr: 312, n: '#214' },
    { name: 'pagination', on: 3, pr: 168, n: '#213' },
    { name: 'tests du panier', on: 4, pr: 455, n: '#215' },
    { name: 'webhooks Stripe', on: 5, stop: 82 },
  ];

  const LOG = [
    [0, '', 'quart › 4 tâches, 4 machines'],
    [2, 1, 'machine prête, acme/boutique cloné'],
    [3, 2, 'machine prête, branche quart/pagination'],
    [4, 3, 'machine prête, npm ci'],
    [5, 4, 'machine prête, branche quart/stripe'],
    [9, 1, 'claude › lit src/forms, 38 fichiers'],
    [12, 2, 'codex › reproduit le bug : page 2 vide'],
    [16, 4, 'aider › lit src/payments/webhook.ts'],
    [19, 3, 'vitest › 12 tests, 12 passent'],
    [25, 2, 'codex › offset calculé avant le filtre'],
    [33, 1, 'claude › contact.tsx migré'],
    [41, 2, 'codex › correctif écrit, 1 fichier'],
    [48, 3, 'claude › écrit cart.add.test.ts'],
    [56, 1, 'claude › devis.tsx migré'],
    [64, 4, 'aider › STRIPE_WEBHOOK_SECRET introuvable'],
    [72, 4, 'aider › aucune valeur dans le coffre'],
    [82, 4, 'quart › tâche en attente, machine en veille', 'k'],
    [96, 2, 'vitest › 31 tests, 31 passent'],
    [112, 1, 'claude › inscription.tsx migré'],
    [128, 3, 'vitest › 24 tests, 2 échouent'],
    [141, 3, 'claude › arrondi de la TVA corrigé'],
    [152, 2, 'git › push quart/pagination'],
    [168, 2, 'quart › PR #213 ouverte, machine effacée', 'o'],
    [186, 1, 'claude › adresse.tsx migré'],
    [205, 3, 'vitest › 33 tests, 33 passent'],
    [227, 1, 'claude › paiement.tsx migré'],
    [249, 1, 'claude › retour.tsx migré'],
    [266, 1, 'tsc › aucune erreur'],
    [283, 1, 'vitest › 58 tests, 58 passent'],
    [300, 1, 'git › push quart/formulaires'],
    [312, 1, 'quart › PR #214 ouverte, machine effacée', 'o'],
    [331, 3, 'claude › cas limite : panier vide'],
    [358, 3, 'claude › cas limite : code promo expiré'],
    [386, 3, 'vitest › 47 tests, 47 passent'],
    [411, 3, 'claude › couverture du panier : 91 %'],
    [433, 3, 'git › push quart/tests-panier'],
    [455, 3, 'quart › PR #215 ouverte, machine effacée', 'o'],
    [470, '', 'quart › plus rien à faire cette nuit'],
    [538, '', 'quart › résumé envoyé, 3 PR, 1 question', 'k'],
  ];

  const SAY = [
    [0, 'Vous confiez quatre tâches. Quatre machines s’allument.'],
    [42, 'Quatre agents travaillent, chacun sur sa machine.'],
    [82, 'La tâche Stripe attend une variable. Sa machine se met en veille.'],
    [168, 'La pagination est corrigée. Sa PR vous attend.'],
    [312, 'Les formulaires sont migrés. Deux PR vous attendent.'],
    [455, 'Les tests du panier sont écrits. Trois PR sur quatre sont prêtes.'],
    [532, 'Il est 7\u00a0h. Trois PR sont prêtes, une tâche attend une variable.'],
  ];

  // Instants où chaque machine écrit dans le journal : son noyau s'éclaircit un instant.
  const ACT = [0, 1, 2, 3].map((i) => LOG.filter((l) => l[1] === i + 1).map((l) => l[0]));

  function stateWord(i, t) {
    const T = TASKS[i];
    if (t < T.on) return 'éteinte';
    if (T.stop != null && t >= 532) return 'il manque une variable';
    if (T.stop != null && t >= T.stop) return 'attend votre réponse';
    if (T.pr != null && t >= T.pr) return 'PR ' + T.n;
    return 'travaille';
  }

  const Night = {
    t: 0, target: 0, playing: false, auto: false, last: 0, raf: 0, visible: false, interacted: false,
    u: 0, uv: 0, tv: 0, // u : position du curseur (heure affichée) ; uv, tv : vitesses des deux ressorts
    rewind: null, cache: new Map(),
  };

  // États qu'une tâche peut afficher (pour réserver la place de son étiquette).

  function buildNight(host) {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    const M0 = 2.2, gapU = 3.6, labZ = M0 + 1.55;
    const xs0 = [0, 1, 2, 3].map((i) => i * gapU);
    const X1 = xs0[3] + M0 + 0.8, Y1 = M0 + 2.6;
    const pts = [[-0.8, -0.8, 0], [X1, -0.8, 0], [X1, Y1, -0.25], [-0.8, Y1, -0.25]].concat(xs0.map((x) => [x + M0 / 2, M0 / 2, labZ]));
    // La scène est centrée avec ses étiquettes (leur texte dépasse des points du dessin ; trois passes suffisent).
    const fit = (padB) => {
      const pad = W < 460 ? 20 : 32;
      const labW = TASKS.map((T, i) => monoW(String(i + 1)));
      let bx = { l: pad, r: pad, t: pad, b: pad + padB, ay: 0.5 }, pr;
      for (let it = 0; it < 3; it++) {
        pr = projector(pts, W, H, bx);
        let gx1 = -Infinity, gy0 = Infinity, tx1 = -Infinity, ty0 = Infinity;
        for (const p of pts.slice(0, 4)) { const v = pr.P(...p); gx1 = Math.max(gx1, v[0]); gy0 = Math.min(gy0, v[1]); }
        xs0.forEach((x, i) => {
          const lab = pr.P(x + M0 / 2, M0 / 2, labZ);
          tx1 = Math.max(tx1, lab[0] + labW[i] / 2);
          ty0 = Math.min(ty0, lab[1] - 12);
          gx1 = Math.max(gx1, lab[0]); gy0 = Math.min(gy0, lab[1]);
        });
        bx = { ...bx, r: pad + Math.max(0, tx1 - gx1), t: pad + Math.max(0, gy0 - ty0) };
      }
      return pr;
    };
    // Même structure à toutes les largeurs : des numéros dans la scène (la scène reste grande), le nom et l'état de
    // chaque tâche dans la légende. Quand la légende se pose dans la case de la scène (fenêtre en deux colonnes),
    // on lui réserve le bas de la case.
    const app = host.closest('.app'), legend = q('#legend');
    app.classList.add('is-compact');
    const lr = legend.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const pr = fit(lr.top < hr.bottom - 1 ? lr.height : 0);
    const { P, s, k } = pr;
    // Positions et tailles recalées au pixel : arêtes verticales nettes, fils des repères sur la même colonne que les sommets.
    const xs = xs0.map((x) => Math.round(x * k) / k);
    const M = Math.round(M0 * k) / k;
    let csk = Math.round(1.2 * k); if ((Math.round(M * k) - csk) % 2) csk -= 1;
    const cs = csk / k, co = (M - cs) / 2;
    const S = new Sheet();

    // Socle mince, trame.
    box(S, P, -0.8, -0.8, -0.25, X1 + 0.8, Y1 + 0.8, 0.25);
    for (let i = 0; i <= Math.floor(X1 + 0.8); i++) S.line(P(-0.8 + i, -0.8), P(-0.8 + i, Y1), 'ln ln-g');
    for (let j = 0; j <= Math.floor(Y1 + 0.8); j++) S.line(P(-0.8, -0.8 + j), P(X1, -0.8 + j), 'ln ln-g');

    TASKS.forEach((T, i) => {
      const x = xs[i], y = 0;
      S.raw(`<g class="n-k" data-k="${i + 1}">`);
      // Feuille de PR (dessinée avant la machine, qui la cache tant qu'elle sort).
      if (T.pr != null) {
        const sh = new Sheet();
        prSheet(sh, P, x + 0.35, y + M + 0.35, 0, 1.5, 1.1);
        S.raw(`<g class="n-sheet" data-m="${i}">${sh}</g>`);
      }
      // Empreinte.
      const gh = new Sheet();
      box(gh, P, x, y, 0, M, M, M, { fill: null, outer: 'ln ln-h', inner: 'ln ln-h' });
      S.raw(`<g class="n-ghost" data-m="${i}">${gh}</g>`);
      // Machine : verre, puis le noyau devant ses arêtes arrière, puis les arêtes avant du verre en clair sur le noyau.
      const mc = new Sheet();
      mc.path([P(x, y), P(x + M, y), P(x + M, y + M), P(x, y + M)], true, 'f-p');
      mc.line(P(x, y, 0), P(x + M, y, 0), 'ln ln-h'); mc.line(P(x, y, 0), P(x, y + M, 0), 'ln ln-h'); mc.line(P(x, y, 0), P(x, y, M), 'ln ln-h');
      const glass = box(mc, P, x, y, 0, M, M, M, { fill: null });
      const core = new Sheet();
      const cube = box(core, P, x + co, y + co, 0.28, cs, cs, cs, { fill: ['o-t', 'o-l', 'o-r'], after: agentQuarter });
      const hat = new Sheet();
      box(hat, P, x + co, y + co, 0.28, cs, cs, cs, { fill: ['hatch', 'hatch', 'hatch'] });
      const ct = [cube.A, cube.B, cube.Cc, cube.D];
      mc.raw(`<g class="n-core">${core}<path class="o-act" d="${poly(ct, true)}" opacity="0"/></g><g class="n-hatch">${hat}</g>`);
      glassOver(mc, 'qcl-n' + i, cube, glass);
      S.raw(`<g class="n-mach" data-m="${i}">${mc}</g>`);
      S.raw('</g>');
    });

    // Repères : le fil descend de l'étiquette jusqu'au sommet arrière de la machine (même colonne), où un point le pose.
    TASKS.forEach((T, i) => {
      const x = xs[i];
      const v = P(x, 0, M);
      const lab = P(x + M / 2, M / 2, labZ);
      const fx = Math.round(v[0] - 0.5) + 0.5;
      S.raw(`<g class="n-k" data-k="${i + 1}">`);
      S.line([fx, Math.round(lab[1] + 7)], [fx, Math.round(v[1] - 5)], 'ln ln-l');
      S.raw(`<circle class="n-dot" cx="${fx}" cy="${r2(v[1])}" r="3"/>`);
      S.raw(`<text class="lab lab--k halo" text-anchor="middle" x="${r2(lab[0])}" y="${r2(lab[1])}">${i + 1}</text>`);
      S.raw('</g>');
    });

    // Cercle du matin autour du noyau de la tâche bloquée ; son sommet reste 11 px sous le point du repère.
    const c4 = P(xs[3] + M / 2, M / 2, M / 2);
    const ry = Math.max(8, (M * s - 10) / 1.075);
    S.raw(`<g class="n-loop">${inkPath(inkLoopStroke(c4[0], c4[1] + 4, M * k * 0.74, ry, 41, 1.8))}</g>`);

    const svg = mount(host, S.toString(), W, H);
    const dirY = [P(0, 1)[0] - P(0, 0)[0], P(0, 1)[1] - P(0, 0)[1]];
    Night.svg = svg;
    Night.geo = { dirY, M };
    Night.sheets = [...svg.querySelectorAll('.n-sheet')].map((el) => ({ el, i: +el.dataset.m }));
    Night.ghosts = [...svg.querySelectorAll('.n-ghost')];
    Night.machs = [...svg.querySelectorAll('.n-mach')].map((el) => ({ el, core: q('.n-core', el), hatch: q('.n-hatch', el), act: q('.o-act', el) }));
    Night.loop = q('.n-loop .ink', svg);
    Night.loopQ = -1;

    renderNight(true);
  }

  function setAttr(el, name, v) {
    const key = el;
    let c = Night.cache.get(key);
    if (!c) { c = {}; Night.cache.set(key, c); }
    if (c[name] === v) return;
    c[name] = v;
    if (name === 'text') el.textContent = v; else el.setAttribute(name, v);
  }

  let logEls = [], logLH = 34, logH = [], logViewH = 0, sayIdx = -1, lastValText = '';

  function renderNight(force) {
    const t = Night.t;
    if (Night.svg) {
      const { dirY } = Night.geo;
      TASKS.forEach((T, i) => {
        const m = Night.machs[i];
        const on = smooth((t - T.on) / 5);
        let alive = on, coreO = on, hatchO = 0;
        if (T.stop != null) { const b = smooth((t - T.stop) / 6); coreO = on * (1 - b); hatchO = b; alive = on * (1 - 0.45 * b); }
        if (T.pr != null) { alive = on * (1 - smooth((t - T.pr - 2) / 9)); coreO = alive; }
        setAttr(m.el, 'opacity', r2(alive));
        setAttr(m.core, 'opacity', r2(coreO));
        setAttr(m.hatch, 'opacity', r2(hatchO));
        setAttr(Night.ghosts[i], 'opacity', r2(1 - alive));
        if (Night.legend) setAttr(Night.legend[i], 'text', stateWord(i, t));
        let act = 0;
        for (const tl of ACT[i]) { const u = (t - tl) / 4; if (u > 0 && u < 1) act = Math.max(act, Math.sin(Math.PI * u)); }
        setAttr(m.act, 'opacity', r2(act * 0.75));
      });
      Night.sheets.forEach(({ el, i }) => {
        const T = TASKS[i];
        const p = ease((t - (T.pr - 7)) / 7);
        const off = (1 - p) * -(Night.geo.M + 0.2);
        setAttr(el, 'transform', `translate(${r2(dirY[0] * off)} ${r2(dirY[1] * off)})`);
        setAttr(el, 'opacity', t < T.pr - 7 ? 0 : 1);
      });
      // Le cercle du matin se trace à la plume entre 6 h 40 et 6 h 56 (contour recalculé, jamais par paliers).
      const lp = clamp((t - 520) / 16);
      const lq = Math.round(lp * 400);
      if (Night.loop && lq !== Night.loopQ) { Night.loopQ = lq; Night.loop.setAttribute('d', lq ? inkD(Night.loop._ink, traceEase(lp)) : ''); }
    }

    // Journal : chaque ligne entre en glissant ; le décalage dépend seulement de l'heure (et de la hauteur réelle des lignes).
    let shown = 0, now = -1;
    for (let i = 0; i < LOG.length; i++) {
      const e = smooth((t - LOG[i][0]) / 2.2);
      shown += e * (logH[i] || logLH);
      if (e > 0.5) now = i;
      const el = logEls[i];
      if (el) setAttr(el, 'style', `opacity:${r2(e)}`);
    }
    for (let i = 0; i < logEls.length; i++) setAttr(logEls[i], 'class', i === now ? 'is-now' : '');
    if (logEls.length) {
      const y = Math.min(8, logViewH - 10 - shown);
      setAttr(logList, 'style', `transform:translateY(${r2(y)}px)`);
    }

    if (appCount) {
      let work = 0, wait = 0;
      TASKS.forEach((T) => {
        if (t < T.on) return;
        if (T.stop != null && t >= T.stop) { wait++; return; }
        if (T.pr != null && t >= T.pr) return;
        work++;
      });
      const w1 = work === 0 ? 'Aucune machine au travail' : work === 1 ? '1 machine au travail' : work + ' machines au travail';
      setAttr(appCount, 'text', t < 2 ? 'Machines en route' : (wait ? w1 + ', 1 en veille' : w1));
    }

    let idx = 0;
    for (let i = 0; i < SAY.length; i++) if (t >= SAY[i][0]) idx = i;
    if (idx !== sayIdx) {
      const first = sayIdx === -1;
      sayIdx = idx;
      if (first || RM.matches || !say.animate) say.textContent = SAY[idx][1];
      else swapSay(SAY[idx][1]);
    }
  }

  let clock, say, input, logList, play, appCount;

  // La phrase sort en remontant (220 ms), la suivante entre d'en dessous (520 ms). Une bascule en cours repart de l'état affiché.
  let sayAnim = null;
  function swapSay(text) {
    const cs = getComputedStyle(say);
    const from = { opacity: cs.opacity, transform: cs.transform === 'none' ? 'translateY(0px)' : cs.transform };
    if (sayAnim) sayAnim.cancel();
    sayAnim = say.animate([from, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 220, easing: 'cubic-bezier(.4, 0, .9, .6)', fill: 'forwards' });
    sayAnim.onfinish = () => {
      say.textContent = text;
      sayAnim = say.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 520, easing: 'cubic-bezier(.22, .7, .18, 1)', fill: 'forwards' });
      sayAnim.onfinish = () => { sayAnim.cancel(); sayAnim = null; };
    };
  }

  // La place de la phrase est réservée pour la plus longue : rien ne saute sous elle quand elle change (téléphone compris).
  function sizeSay() {
    const w = say.clientWidth;
    if (!w) return;
    const probe = say.cloneNode(false);
    probe.removeAttribute('id'); probe.removeAttribute('aria-live');
    probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${w}px;min-height:0`;
    say.parentNode.appendChild(probe);
    let hmax = 0;
    for (const [, t] of SAY) { probe.textContent = t; hmax = Math.max(hmax, probe.offsetHeight); }
    probe.remove();
    say.style.minHeight = hmax + 'px';
  }

  function buildLog() {
    logList = q('#log-list');
    appCount = q('#app-count');
    logList.innerHTML = LOG.map(([t, m, x, c]) => {
      // « outil › action » reste d'un tenant ; les deux-points et le pour cent gardent leur espace insécable.
      // Les noms de fichiers et de branches ne se coupent jamais (passage à la ligne entre les mots seulement).
      const txt = x.replace(' › ', NB + '›' + NB).replace(' : ', NB + ': ').replace(' %', NB + '%')
        .replace(/(\S*[\/._-]\S*)/g, (w) => (/[a-z]/i.test(w) && w.length > 2 ? `<span class="nw">${w.replace(/\//g, '/</span><wbr><span class="nw">')}</span>` : w));
      return `<li${m ? ` data-k="${m}"` : ''}><span class="t">${hmLog(t)}</span><span class="m">${m}</span><span class="x${c ? ' ' + c : ''}">${txt}</span></li>`;
    }).join('');
    logEls = [...logList.children];
    measureLog();
    new ResizeObserver(() => { measureLog(); renderNight(true); }).observe(q('.app__log'));
  }
  function measureLog() {
    const v = q('.app__log');
    logViewH = v.clientHeight;
    logH = logEls.map((el) => el.offsetHeight);
    logLH = logH[0] || 34;
    Night.cache.delete(logList);
  }

  // Les heures posées sous la piste, sans crans : toutes les heures au bureau, une sur trois au téléphone.
  let hourEls = [];
  function drawTicks() {
    const box = q('#hours');
    const W = box.clientWidth;
    if (!W) return;
    const step = W < 520 ? 3 : 1;
    let html = '';
    for (let k = 0; k <= 9; k += step) {
      const m = k * 60;
      html += `<span data-m="${m}" style="left:${(m / 540 * 100).toFixed(3)}%">${(22 + k) % 24}${NB}h</span>`;
    }
    box.innerHTML = html;
    hourEls = [...box.children].map((el) => ({ el, m: +el.dataset.m, past: null }));
  }


  /* ---------- boucle ---------- */

  const SPEED = 540 / 26000; // minutes de nuit par milliseconde
  // Deux ressorts amortis au plus juste (jamais de rebond) : le curseur suit la cible (le doigt, le clavier, la lecture),
  // la scène suit le curseur. Solution exacte à chaque image : stable quel que soit l'écart entre deux images.
  // Pendant un glissé, le ressort du curseur se raidit (il colle au doigt sans reprendre ses à-coups).
  const W_U = 22, W_U_DRAG = 120, W_T = 30;
  function spring(x, v, to, w, dt) {
    const x0 = x - to, e = Math.exp(-w * dt), k = v + w * x0;
    return [to + (x0 + k * dt) * e, (v - w * k * dt) * e];
  }
  function loop(now) {
    Night.raf = 0;
    const dt = Night.last ? Math.min(64, now - Night.last) / 1000 : 1 / 120;
    Night.last = now;
    if (Night.rewind) {
      const r = Night.rewind, p = clamp((now - r.t0) / r.d);
      Night.target = r.from + (r.to - r.from) * (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      if (p >= 1) { Night.rewind = null; if (r.then) r.then(); }
    } else if (Night.playing) {
      Night.target = Math.min(540, Night.target + dt * 1000 * SPEED);
      if (Night.target >= 540) setPlaying(false);
    }
    if (RM.matches) { Night.u = Night.t = Night.target; Night.uv = Night.tv = 0; }
    else {
      [Night.u, Night.uv] = spring(Night.u, Night.uv, Night.target, Rule.drag ? W_U_DRAG : W_U, dt);
      [Night.t, Night.tv] = spring(Night.t, Night.tv, Night.u, W_T, dt);
      if (Math.abs(Night.u - Night.target) < 0.003 && Math.abs(Night.uv) < 0.03) { Night.u = Night.target; Night.uv = 0; }
      if (Math.abs(Night.t - Night.u) < 0.003 && Math.abs(Night.tv) < 0.03) { Night.t = Night.u; Night.tv = 0; }
    }
    renderNight();
    renderRule();
    if (Night.rewind || Night.playing || Night.u !== Night.target || Night.t !== Night.u) kick();
    else Night.last = 0; // au repos : la prochaine reprise part d'un pas d'image, pas d'un écart de plusieurs secondes
  }
  function kick() {
    if (!Night.raf && Night.visible && !document.hidden) Night.raf = requestAnimationFrame(loop);
  }

  const Rule = { el: null, thumb: null, fill: null, tip: null, tipIn: null, w: 1, drag: false, tipAt: null, x: '', min: -1, vt: '' };
  // Le curseur, la part violette, l'heure et la bulle suivent u (la position du curseur), la scène suit t.
  function renderRule() {
    if (!Rule.el) return;
    const u = clamp(Night.u, 0, 540), p = u / 540;
    const xs = (p * Rule.w).toFixed(2);
    if (xs !== Rule.x) {
      Rule.x = xs;
      Rule.thumb.style.transform = `translate3d(${xs}px,0,0)`;
      Rule.fill.style.transform = `scaleX(${p.toFixed(5)})`;
      if (Rule.tipAt === 'thumb') Rule.tip.style.transform = `translate3d(${xs}px,0,0)`;
    }
    const mn = Math.floor(u);
    if (mn !== Rule.min) {
      Rule.min = mn;
      clock.textContent = hm(mn);
      if (Rule.tipAt === 'thumb') Rule.tipIn.textContent = hm(mn);
      input.value = String(Math.round(u));
      for (const h of hourEls) { const past = u >= h.m - 0.5; if (past !== h.past) { h.past = past; h.el.classList.toggle('is-past', past); } }
    }
    const vt = hm(Math.round(u / 15) * 15);
    if (vt !== Rule.vt) { Rule.vt = vt; input.setAttribute('aria-valuetext', vt); }
  }
  function initRule() {
    const track = q('#rule');
    Object.assign(Rule, { el: track, thumb: q('.rule__thumb', track), fill: q('.rule__fill', track), tip: q('.rule__tip', track), tipIn: q('.rule__tip-in', track) });
    const measure = () => { Rule.w = Math.max(1, track.clientWidth - 22); Rule.x = ''; Rule.min = -1; renderRule(); };
    new ResizeObserver(measure).observe(track);
    measure();
    const valAt = (cx) => clamp((cx - track.getBoundingClientRect().left - 11) / Rule.w) * 540;
    const showTip = (at, cx) => {
      Rule.tipAt = at;
      if (at === 'thumb') { Rule.tip.style.transform = `translate3d(${Rule.x}px,0,0)`; Rule.tipIn.textContent = hm(Math.floor(clamp(Night.u, 0, 540))); }
      else { const v = valAt(cx); Rule.tip.style.transform = `translate3d(${(v / 540 * Rule.w).toFixed(2)}px,0,0)`; Rule.tipIn.textContent = hm(Math.round(v)); }
      track.classList.add('is-tip');
    };
    const hideTip = () => { Rule.tipAt = null; track.classList.remove('is-tip'); };
    const interact = () => {
      Night.interacted = true; Night.rewind = null;
      if (Night.playing) setPlaying(false);
    };
    let id = null, sx = 0, sy = 0, off = 0, armed = false, moved = false, fromPointer = false;
    const seek = (cx) => {
      Night.target = valAt(cx - off);
      syncPlay();
      kick();
    };
    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || id !== null) return;
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
      track.classList.remove('is-focus');
      fromPointer = true; input.focus({ preventScroll: true }); fromPointer = false;
      // Saisi sur le curseur : il ne saute pas sous le doigt (on garde l'écart). Ailleurs sur la piste : il glisse jusqu'au point.
      const thumbX = track.getBoundingClientRect().left + 11 + clamp(Night.u, 0, 540) / 540 * Rule.w;
      off = Math.abs(e.clientX - thumbX) <= 16 ? e.clientX - thumbX : 0;
      interact();
      if (e.pointerType === 'touch') { armed = true; return; } // au toucher, on attend de savoir si le geste est horizontal
      e.preventDefault();
      track.setPointerCapture(id);
      track.classList.add('is-press');
      seek(e.clientX);
      showTip('thumb');
    });
    track.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) { if (e.pointerType === 'mouse' && id === null) showTip('pointer', e.clientX); return; }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (armed) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        armed = false; track.setPointerCapture(id); showTip('thumb');
      }
      if (!moved && Math.abs(dx) > 2) { moved = true; Rule.drag = true; track.classList.add('is-drag'); }
      seek(e.clientX);
    });
    const end = (e, tap) => {
      if (e.pointerId !== id) return;
      if (armed && tap) seek(e.clientX); // toucher bref : le curseur glisse jusqu'au point
      armed = false; id = null; Rule.drag = false;
      track.classList.remove('is-drag', 'is-press');
      kick();
      if (e.pointerType === 'mouse' && track.matches(':hover')) showTip('pointer', e.clientX); else hideTip();
    };
    track.addEventListener('pointerup', (e) => end(e, true));
    track.addEventListener('pointercancel', (e) => end(e, false));
    track.addEventListener('pointerleave', () => { if (id === null) hideTip(); });
    // Anneau de focus : à l'arrivée au clavier (Tab), ou dès qu'une touche règle l'heure ; jamais après un geste du pointeur.
    input.addEventListener('focus', () => track.classList.toggle('is-focus', !fromPointer && input.matches(':focus-visible')));
    input.addEventListener('keydown', () => track.classList.add('is-focus'));
    input.addEventListener('blur', () => track.classList.remove('is-focus'));
  }

  function syncPlay() {
    if (Night.playing || Night.rewind) return;
    const end = Night.target >= 539.5;
    play.dataset.state = end ? 'ended' : 'paused';
    play.setAttribute('aria-label', end ? 'Rejouer la nuit' : 'Lire la nuit');
  }
  function setPlaying(v) {
    Night.playing = v;
    play.dataset.state = v ? 'playing' : (Night.target >= 540 ? 'ended' : 'paused');
    play.setAttribute('aria-label', v ? 'Mettre la nuit en pause' : (Night.target >= 540 ? 'Rejouer la nuit' : 'Lire la nuit'));
    if (v) { Night.last = 0; kick(); }
  }

  function initNight() {
    clock = q('#clock'); say = q('#say'); input = q('#heure'); play = q('#play');
    // Au téléphone, les repères 1 à 4 gardent leur nom et leur état dans une légende sous la scène.
    const lg = q('#legend');
    if (lg) {
      lg.innerHTML = TASKS.map((T, i) => `<li data-k="${i + 1}"><span class="n">${i + 1}</span><span class="nm">${T.name}</span><span class="st"></span></li>`).join('');
      Night.legend = [...lg.querySelectorAll('.st')];
      // Suivre une tâche : survol d'une entrée de la légende ou d'une ligne du journal (pointeur fin seulement).
      const app = lg.closest('.app');
      const follow = (e) => {
        if (e.pointerType !== 'mouse') return;
        const li = e.target.closest('li[data-k]');
        if (li) app.dataset.k = li.dataset.k; else delete app.dataset.k;
      };
      for (const box of [lg, q('#log-list')]) {
        box.addEventListener('pointerover', follow);
        box.addEventListener('pointerleave', () => { delete app.dataset.k; });
      }
    }
    buildLog();
    drawTicks();
    sizeSay();
    let sayW = say.clientWidth;
    new ResizeObserver(() => { if (say.clientWidth !== sayW) { sayW = say.clientWidth; sizeSay(); } }).observe(say);
    const host = q('#plan-nuit');

    const fixed = params.get('t');
    // La démo s'ouvre déjà en route (22 h 09 : machines allumées, premières lignes du journal) ; « Rejouer » repart de 22 h.
    Night.t = Night.u = Night.target = 9;
    if (RM.matches) { Night.t = Night.u = Night.target = 540; Night.interacted = true; }
    if (fixed != null) { Night.t = Night.u = Night.target = clamp(+fixed, 0, 540); Night.interacted = true; }
    buildNight(host);
    initRule();
    setPlaying(false);

    input.addEventListener('input', () => {
      Night.interacted = true; Night.rewind = null;
      if (Night.playing) setPlaying(false);
      Night.target = +input.value;
      syncPlay();
      kick();
    });
    input.addEventListener('keydown', (e) => {
      const map = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 };
      let to = null;
      if (e.key in map) {
        const base = Math.round(Night.target / 15) * 15;
        to = base + map[e.key];
      } else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = 540;
      if (to == null) return;
      e.preventDefault();
      Night.interacted = true; Night.rewind = null;
      if (Night.playing) setPlaying(false);
      Night.target = clamp(to, 0, 540);
      syncPlay();
      kick();
    });
    play.addEventListener('click', () => {
      Night.interacted = true;
      // Arrêt en plein rembobinage : la cible devient le point d'arrêt naturel du curseur (il ralentit sans revenir en arrière).
      if (Night.rewind) { Night.rewind = null; Night.target = clamp(Night.u + Night.uv / W_U, 0, 540); setPlaying(false); return; }
      if (Night.playing) { setPlaying(false); return; }
      if (Night.target >= 539.5) {
        if (RM.matches) { Night.t = Night.u = Night.target = 0; kick(); setPlaying(true); return; }
        Night.rewind = { from: Night.u, to: 0, t0: performance.now(), d: 1400, then: () => setPlaying(true) };
        play.dataset.state = 'playing';
        play.setAttribute('aria-label', 'Mettre la nuit en pause');
        kick();
        return;
      }
      setPlaying(true);
    });

    const sec = q('#nuit');
    new IntersectionObserver((ents) => {
      for (const e of ents) {
        Night.visible = e.isIntersecting;
        // Part visible rapportée à la plus petite des deux hauteurs (section ou fenêtre).
        const seen = e.intersectionRect.height / Math.max(1, Math.min(innerHeight, e.boundingClientRect.height));
        if (e.isIntersecting && seen >= 0.45 && !Night.interacted) {
          Night.interacted = true;
          setTimeout(() => setPlaying(true), 500);
        }
        if (Night.visible) kick();
      }
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }).observe(sec);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { Night.last = 0; kick(); } });

    new ResizeObserver(() => { buildNight(host); measureLog(); drawTicks(); renderNight(true); Rule.min = -1; renderRule(); }).observe(host);
  }

  /* ---------- formulaire ---------- */

  function initForm() {
    const f = q('#acces');
    const msg = q('#acces-msg');
    const email = q('#email');
    const btn = q('.btn--submit', f);
    const champ = email.closest('.champ');
    let busy = false, timer = 0;
    const setMsg = (text, kind) => {
      // « e-mail » ne se coupe jamais à son trait d'union.
      msg.textContent = '';
      text.split(/(e-mail)/).forEach((part) => {
        if (part === 'e-mail') { const w = document.createElement('span'); w.className = 'nw'; w.textContent = part; msg.appendChild(w); }
        else if (part) msg.appendChild(document.createTextNode(part));
      });
      msg.classList.toggle('is-error', kind === 'error');
      msg.classList.toggle('is-ok', kind === 'ok');
    };
    const label = q('.btn__label', btn);
    const LABEL = label.textContent;
    const reset = () => {
      if (!btn.classList.contains('is-done')) return;
      btn.classList.remove('is-done'); btn.removeAttribute('aria-disabled'); label.textContent = LABEL; btn.style.width = '';
    };
    email.addEventListener('input', () => {
      if (email.getAttribute('aria-invalid') === 'true' && email.checkValidity() && email.value) {
        email.removeAttribute('aria-invalid'); setMsg('', null);
      }
      if (champ.classList.contains('is-ok')) { champ.classList.remove('is-ok'); setMsg('', null); }
      reset();
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy || btn.classList.contains('is-done')) return;
      if (!email.value || !email.checkValidity()) {
        setMsg('Indiquez une adresse e-mail complète, par exemple nom@domaine.fr.', 'error');
        email.setAttribute('aria-invalid', 'true');
        champ.classList.remove('is-ok');
        email.focus();
        return;
      }
      email.removeAttribute('aria-invalid');
      busy = true;
      btn.classList.add('is-busy');
      btn.setAttribute('aria-disabled', 'true');
      f.setAttribute('aria-busy', 'true');
      setMsg('', null);
      clearTimeout(timer);
      timer = setTimeout(() => {
        busy = false;
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-disabled');
        f.removeAttribute('aria-busy');
        champ.classList.add('is-ok');
        // « C'est noté » : le bouton garde sa largeur et ne se rejoue pas tant que l'adresse ne change pas.
        btn.style.width = btn.offsetWidth + 'px';
        label.textContent = 'Merci';
        btn.classList.add('is-done'); btn.setAttribute('aria-disabled', 'true');
        setMsg('Quart est une marque fictive, conçue par le studio Topiary' + NB + ': aucun e-mail n’a été envoyé.', 'ok');
      }, RM.matches ? 0 : 900);
    });
  }

  /* ---------- en-tête : posé au défilement, ton de nuit, section courante ---------- */

  function initHead() {
    const head = q('#tete');
    const nuit = q('#nuit');
    const machine = q('#machine');
    const links = [...document.querySelectorAll('.lien-nav')];
    // Une section devient courante quand son contenu (pas son fondu) passe 40 % de la fenêtre.
    const MARK = { '#nuit': '#say', '#machine': '#machine-titre' };
    const secs = links.map((a) => { const h = a.getAttribute('href'); return { s: q(h), m: q(MARK[h] || h) }; });
    let raf = 0;
    const update = () => {
      raf = 0;
      head.classList.toggle('is-pose', scrollY > 8);
      const h = head.offsetHeight;
      // Sombre quand le fond sous le bas de l'en-tête est plus sombre que le gris moyen : du 58 % du crépuscule au 42 % de l'aube.
      const r = nuit.getBoundingClientRect();
      const dusk = parseFloat(getComputedStyle(nuit).paddingTop) * 0.76;
      const m = machine.getBoundingClientRect();
      const dawn = parseFloat(getComputedStyle(machine, '::before').height) * 0.42;
      head.classList.toggle('is-nuit', r.top + dusk < h && m.top + dawn > h);
      // Section courante : la dernière dont le contenu a passé 40 % de la fenêtre.
      let cur = -1;
      const line = innerHeight * 0.4;
      secs.forEach((s, i) => {
        if (!s.s || !s.m) return;
        if (s.m.getBoundingClientRect().top < line && s.s.getBoundingClientRect().bottom > h) cur = i;
      });
      links.forEach((a, i) => { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    update();

    // Menu du téléphone : dialogue modal (focus gardé dedans, Échap ferme), aria-expanded tenu à jour.
    const btn = q('#menu-btn'), menu = q('#menu'), close = q('#menu-close');
    let closing = 0;
    // Au doigt (click.detail > 0), le focus suit sans anneau et ne va jamais dans un champ : Safari dessinait l'anneau
    // après un toucher, et « Tarif » focalisait le champ e-mail (clavier du téléphone). Au clavier, rien ne change.
    let byKey = true;
    const quiet = (el) => {
      if (!el.matches('a[href], button, input, [tabindex]')) el.tabIndex = -1;
      el.classList.add('is-quiet');
      el.addEventListener('blur', () => el.classList.remove('is-quiet'), { once: true });
      el.focus({ preventScroll: true });
    };
    const finish = (thenGo) => {
      clearTimeout(closing); closing = 0;
      menu.classList.remove('is-closing');
      if (menu.open) menu.close();
      btn.setAttribute('aria-expanded', 'false');
      if (!thenGo) { if (byKey) btn.focus(); else quiet(btn); return; }
      const target = q(thenGo);
      if (!target) return;
      target.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
      const f = !byKey ? target : target.matches('input, a, button') ? target : q('input, a, button, [tabindex]', target);
      if (f) setTimeout(() => (byKey ? f.focus({ preventScroll: true }) : quiet(f)), RM.matches ? 0 : 600);
    };
    const shut = (thenGo) => {
      if (!menu.open || closing) return;
      if (RM.matches) { finish(thenGo); return; }
      menu.classList.add('is-closing');
      closing = setTimeout(() => finish(thenGo), 340);
    };
    btn.addEventListener('click', (e) => {
      if (menu.open) return;
      byKey = e.detail === 0;
      menu.showModal();
      drawMenuPlan(q('#plan-menu'));
      btn.setAttribute('aria-expanded', 'true');
      if (byKey) q('.menu__nav a', menu).focus(); else quiet(menu);
    });
    close.addEventListener('click', (e) => { byKey = e.detail === 0; shut(); });
    menu.addEventListener('cancel', (e) => { e.preventDefault(); byKey = true; shut(); });
    // Le focus boucle dans le menu (sans sortir vers le navigateur).
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...menu.querySelectorAll('a[href], button')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); byKey = e.detail === 0; shut(a.getAttribute('href')); }));
    // Au-delà du seuil du téléphone, le menu n'a plus de bouton : on le referme sans animation.
    matchMedia('(min-width: 761px)').addEventListener('change', (e) => {
      if (e.matches && menu.open) { clearTimeout(closing); closing = 0; menu.classList.remove('is-closing'); menu.close(); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Planche du menu : un extrait du hero, sans annotations (immobile).
  function drawMenuPlan(host) {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H || host.dataset.w === String(W) + 'x' + H) return;
    host.dataset.w = String(W) + 'x' + H;
    const M = 2, Z0 = -0.3;
    const pts = [[0, 0, Z0], [7.4, 0, Z0], [7.4, 4.6, Z0], [0, 4.6, Z0], [0.8, 0.8, M + 0.2]];
    const { P, s } = projector(pts, W, H, { l: 4, r: 4, t: 4, b: 4 });
    const S = new Sheet();
    const A = P(0, 0, 0), B = P(7.4, 0, 0), Cc = P(7.4, 4.6, 0), Dd = P(0, 4.6, 0);
    const E = P(7.4, 0, Z0), F = P(7.4, 4.6, Z0), G = P(0, 4.6, Z0);
    S.face([A, B, Cc, Dd], 'f-t'); S.face([Dd, Cc, F, G], 'hatch-l'); S.face([Cc, B, E, F], 'hatch-r');
    S.path([A, B, E, F, G, Dd], true, 'ln ln-o'); S.line(Dd, Cc, 'ln ln-i'); S.line(Cc, B, 'ln ln-i'); S.line(Cc, F, 'ln ln-i');
    for (let i = 1; i < 7; i++) S.line(P(i, 0), P(i, 4.6), 'ln ln-g');
    for (let j = 1; j < 5; j++) S.line(P(0, j), P(7.4, j), 'ln ln-g');
    const gx = 0.8, gy = 0.8, cs = 1.1, co = (M - cs) / 2;
    S.face([P(gx, gy), P(gx + M, gy), P(gx + M, gy + M), P(gx, gy + M)], 'f-p');
    const glass = box(S, P, gx, gy, 0, M, M, M, { fill: null, glassFill: true });
    const cube = box(S, P, gx + co, gy + co, 0.2, cs, cs, cs, { fill: ['o-t', 'o-l', 'o-r'], after: agentQuarter });
    glassOver(S, 'qcl-menu', cube, glass);
    box(S, P, 4.2, 0.8, 0, 1.6, 1.6, 1.2);
    vaultDoor(S, P, 4.2, 0.8, 1.6, 1.6, 1.2, s);
    prSheet(S, P, 1.0, 3.3, 0, 1.6, 0.9);
    mount(host, S.toString(), W, H);
  }

  /* ---------- pied de page : les liens qui ne mènent nulle part ---------- */

  function initNowhere() {
    const note = q('#cartouche-note');
    let t = 0;
    document.querySelectorAll('[data-nulle-part]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        note.textContent = 'La page « ' + a.textContent.trim() + ' » n’existe pas : Quart est une marque de démonstration du studio Topiary.';
        note.classList.add('is-on');
        clearTimeout(t);
        t = setTimeout(() => note.classList.remove('is-on'), 6000);
      });
    });
  }

  /* ---------- démarrage ---------- */

  // Mesure facultative (?perf) : durée de chaque dessin, lue par _outils/longtasks.py.
  const perfOn = params.has('perf');
  const timed = (name, fn) => (...a) => { const t = performance.now(); const r = fn(...a); if (perfOn) (window.__qperf = window.__qperf || []).push([name, Math.round(t), Math.round(performance.now() - t)]); return r; };
  drawHero = timed('hero', drawHero); initNight = timed('nuit', initNight); drawExploded = timed('eclate', drawExploded); drawCote = timed('cote', drawCote); buildNight = timed('nuit-plan', buildNight);

  function start() {
    const hero = q('#plan-hero');
    let first = true;
    const intro = !RM.matches && !params.has('t') && params.get('intro') !== '0';
    const drawH = () => { drawHero(hero, first && intro); first = false; };
    new ResizeObserver(() => drawH()).observe(hero);
    initForm();
    initHead();
    initNowhere();
    // Les planches hors écran se montent après le tracé du hero (monter pendant le tracé coûtait une image de ~115 ms),
    // ou dès que le visiteur quitte le haut de page. Une par tâche.
    const skip = perfOn ? (params.get('skip') || '').split(',') : [];
    const later = (fn, ms, name) => { if (!skip.includes(name)) setTimeout(fn, ms); };
    let mounted = false;
    const mountRest = () => {
      if (mounted) return;
      mounted = true;
      removeEventListener('scroll', onMove);
      removeEventListener('keydown', onMove);
      later(initNight, 0, 'nuit');
      later(() => { const ex = q('#plan-eclate'); new ResizeObserver(() => drawExploded(ex)).observe(ex); }, 60, 'eclate');
      // Empilé (sous 1 024 px), la cote décale sa propre colonne : on redessine à l'image suivante (sinon « ResizeObserver loop »).
      later(() => { const ct = q('#plan-cote'), side = matchMedia('(min-width: 1024px)'); new ResizeObserver(() => (side.matches ? drawCote(ct) : requestAnimationFrame(() => drawCote(ct)))).observe(q('.tarif__prix')); }, 100, 'cote');
    };
    const onMove = () => mountRest();
    if (intro && scrollY < 40 && !location.hash) {
      addEventListener('scroll', onMove, { passive: true });
      addEventListener('keydown', onMove);
      setTimeout(mountRest, 4600);
    } else mountRest();
  }

  if (document.fonts && document.fonts.ready) {
    let done = false;
    const go = () => { if (!done) { done = true; start(); } };
    // Fragment Mono sert d'abord aux annotations des planches : on la charge avant le tracé, sinon elle arrive en plein tracé.
    Promise.all([document.fonts.ready, document.fonts.load('400 15px "Fragment Mono"').catch(() => {})]).then(go);
    setTimeout(go, 1500);
  } else start();
})();
