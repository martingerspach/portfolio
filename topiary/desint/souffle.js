// Topiary v4.1 : « Le souffle », la désintégration du grand mot au survol retenue le 2026-10-21 (moteur : desint/desint.js ;
// les quatre autres versions et leur banc sont dans archive/2026-10-21-desintegration/).
// Le geste fait du vent. Un champ de vitesses grossier couvre la capsule : le pointeur y dépose sa vitesse, le vent se
// propage devant lui, se diffuse et retombe. Les éclats tiennent plus ou moins bien (les bords et les parois claires
// d'abord) ; arrachés, ils filent en traînées étirées dans le vent et ses tourbillons, puis, au calme, reviennent se
// poser par des courbes. Un geste lent ne fait frissonner que les bords. Les deux enfants partent avec le mot.
// step(P, E, dt) avance la simulation et renvoie true tant qu'il reste quelque chose à faire. P : tableaux des éclats
// (place hx, hy ; position x, y ; vitesse vx, vy ; angle a ; échelle s ; opacité al ; revers f ; état st ; minuteries
// t0, u). E : le pointeur (E.ptr), l'échelle du mot (E.U pour les longueurs, E.F pour les forces) et des outils (rest,
// curl, rand). États : 0 à sa place, 1 dans le vent, 2 de retour ; E.rest(i) remet un éclat exactement à sa place.
(function (g) {
  'use strict';
  const D = g.TOPIARY_DESINT;
  if (!D) return;
  const TAU = Math.PI * 2;
  const ease = (k, dt) => 1 - Math.exp(-k * dt); // part du chemin parcourue en dt par un lissage de constante k (1/s)
  const angTo = (a, b, k) => { let d = b - a; d -= TAU * Math.round(d / TAU); return a + d * k; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  let WIND = null;
  D.register({
    id: 'souffle', n: 1, name: 'Le souffle',
    cell: 4.4, jitter: 0.75,
    init(P, E) {
      for (let i = 0; i < P.n; i++) P.kind[i] = 0;
      const gs = 20 * E.U + 8, nx = Math.ceil(E.W / gs) + 2, ny = Math.ceil(E.H / gs) + 2, N = nx * ny;
      WIND = { gs, nx, ny, u: new Float32Array(N), v: new Float32Array(N), tu: new Float32Array(N), tv: new Float32Array(N), cw: new Uint8Array(N), cx: new Float32Array(N), cy: new Float32Array(N), energy: 0 };
    },
    reset() { if (WIND) { WIND.u.fill(0); WIND.v.fill(0); WIND.energy = 0; } },
    step(P, E, dt) {
      const p = E.ptr, F = E.F, t = E.now, W = WIND, gs = W.gs, nx = W.nx, ny = W.ny;
      // Le pointeur dépose sa vitesse le long de son chemin
      if (p.over && p.speed > 4) {
        const Rs = 58 * E.U + 22, len = Math.hypot(p.x - p.lx, p.y - p.ly), steps = Math.max(1, Math.ceil(len / (gs * 0.5)));
        for (let s = 1; s <= steps; s++) {
          const cx = p.lx + ((p.x - p.lx) * s) / steps, cy = p.ly + ((p.y - p.ly) * s) / steps;
          const i0 = Math.max(0, Math.floor((cx - Rs) / gs)), i1 = Math.min(nx - 1, Math.ceil((cx + Rs) / gs));
          const j0 = Math.max(0, Math.floor((cy - Rs) / gs)), j1 = Math.min(ny - 1, Math.ceil((cy + Rs) / gs));
          for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const dx = i * gs - cx, dy = j * gs - cy, wgt = Math.exp(-((dx * dx + dy * dy) / (Rs * Rs)) * 2.2);
            if (wgt < 0.02) continue;
            const k = wgt * ease(30, dt / steps), o = j * nx + i;
            W.u[o] += (p.vx - W.u[o]) * k;
            W.v[o] += (p.vy - W.v[o]) * k;
          }
        }
      }
      // Transport par lui-même, diffusion légère, retombée
      const decay = Math.exp(-dt * 1.6), dif = Math.min(1, dt * 8);
      const at = (A, x, y) => {
        const fx = Math.min(nx - 1.001, Math.max(0, x)), fy = Math.min(ny - 1.001, Math.max(0, y));
        const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, o = j * nx + i;
        return (A[o] * (1 - a) + A[o + 1] * a) * (1 - b) + (A[o + nx] * (1 - a) + A[o + nx + 1] * a) * b;
      };
      let energy = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const o = j * nx + i, x = i - (W.u[o] * dt) / gs, y = j - (W.v[o] * dt) / gs;
        W.tu[o] = at(W.u, x, y); W.tv[o] = at(W.v, x, y);
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const o = j * nx + i;
        const l = i > 0 ? o - 1 : o, r = i < nx - 1 ? o + 1 : o, u = j > 0 ? o - nx : o, d = j < ny - 1 ? o + nx : o;
        const au = (W.tu[l] + W.tu[r] + W.tu[u] + W.tu[d]) * 0.25, av = (W.tv[l] + W.tv[r] + W.tv[u] + W.tv[d]) * 0.25;
        W.u[o] = (W.tu[o] + (au - W.tu[o]) * dif) * decay;
        W.v[o] = (W.tv[o] + (av - W.tv[o]) * dif) * decay;
        energy = Math.max(energy, Math.abs(W.u[o]) + Math.abs(W.v[o]));
      }
      W.energy = energy;
      // Les cases où le vent peut arracher quelque chose (le plus faible des agrippements) ; ailleurs, les éclats
      // posés ne lisent même pas le vent
      const gmin = 220 * 0.45 * 0.72 * F;
      if (energy >= gmin) {
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const o = j * nx + i, a1 = Math.abs(W.u[o]) + Math.abs(W.v[o]), a2 = Math.abs(W.u[o + 1]) + Math.abs(W.v[o + 1]);
          const a3 = Math.abs(W.u[o + nx]) + Math.abs(W.v[o + nx]), a4 = Math.abs(W.u[o + nx + 1]) + Math.abs(W.v[o + nx + 1]);
          W.cw[o] = a1 > gmin || a2 > gmin || a3 > gmin || a4 > gmin ? 1 : 0;
        }
      }
      // Les tourbillons, calculés aux nœuds de la grille (une fois par image) puis lus par interpolation
      const cu = [0, 0];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { E.curl(i * gs, j * gs, t, cu); W.cx[j * nx + i] = cu[0]; W.cy[j * nx + i] = cu[1]; }
      let busy = energy > 3;
      for (let i = 0; i < P.n; i++) {
        let st = P.st[i];
        if (st === 0) {
          if (energy < gmin) continue;
          const gx = P.hx[i] / gs, gy = P.hy[i] / gs;
          if (gx < 0 || gy < 0 || gx >= nx - 1 || gy >= ny - 1 || !W.cw[(gy | 0) * nx + (gx | 0)]) continue;
        }
        const x = st === 0 ? P.hx[i] : P.x[i], y = st === 0 ? P.hy[i] : P.y[i];
        const wx = at(W.u, x / gs, y / gs), wy = at(W.v, x / gs, y / gs), wl = Math.hypot(wx, wy);
        const grip = (220 + 480 * P.rnd[i]) * (1 - 0.55 * P.edge[i]) * (0.72 + 0.5 * P.dark[i]) * F;
        if (st === 0) {
          if (wl <= grip) continue;
          st = P.st[i] = 1;
          P.vx[i] = wx * 0.55 + (E.rand() - 0.5) * 40 * F;
          P.vy[i] = wy * 0.55 + (E.rand() - 0.5) * 40 * F;
          P.u[i] = 0;
        }
        busy = true;
        let vx = P.vx[i], vy = P.vy[i];
        if (st === 1) {
          // Chaque éclat a sa masse (prise au vent plus ou moins forte), ses tourbillons et sa portance : le nuage
          // s'ouvre au lieu de glisser d'un bloc
          const r2 = P.rnd2[i], k = ease(1.3 + 3.4 * r2, dt);
          const qx = (x + P.rnd[i] * 140) / gs, qy = (y + r2 * 90) / gs;
          cu[0] = at(W.cx, qx, qy); cu[1] = at(W.cy, qx, qy);
          const turb = (110 + 0.5 * wl) * F;
          vx += (wx - vx) * k + cu[0] * turb * dt;
          vy += (wy - vy) * k + cu[1] * turb * dt + (r2 - 0.55) * 110 * F * dt;
          const sp = Math.hypot(vx, vy);
          if (wl < 22 * F && sp < 140 * F) P.u[i] += dt; else P.u[i] = 0;
          if (P.u[i] > 0.3) { P.st[i] = 2; P.t0[i] = t; }
        } else {
          if (wl > grip * 1.4) { P.st[i] = 1; P.u[i] = 0; }
          const ramp = smooth(0, 0.45, t - P.t0[i]), K = 140 * ramp + 6, cd = 2 * Math.sqrt(K) * 0.9;
          vx += ((P.hx[i] - x) * K - vx * cd + wx * 0.8 * (1 - 0.5 * ramp)) * dt;
          vy += ((P.hy[i] - y) * K - vy * cd + wy * 0.8 * (1 - 0.5 * ramp)) * dt;
        }
        const X = x + vx * dt, Y = y + vy * dt, sp = Math.hypot(vx, vy);
        const dist = Math.hypot(X - P.hx[i], Y - P.hy[i]);
        if (P.st[i] === 2 && dist < 0.3 * Math.sqrt(E.U) + 0.1 && sp < 12 * F) { E.rest(i); continue; }
        P.x[i] = X; P.y[i] = Y; P.vx[i] = vx; P.vy[i] = vy;
        // Étiré dans le sens de sa course quand il file, droit et entier quand il se pose
        const land = P.st[i] === 2 ? smooth(3.5, 0, dist) : 0;
        const kk = ease(12, dt);
        if (sp > 4) P.a[i] = angTo(P.a[i], Math.atan2(vy, vx), kk);
        P.a[i] *= 1 - land;
        P.f[i] = 1 + Math.min(1.6, sp / (300 * F)) * (1 - land);
        P.s[i] = 0.86 + 0.14 * Math.max(Math.exp(-sp / (200 * F)), land);
      }
      return busy;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
