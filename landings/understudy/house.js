/* Understudy: Act II: the empty house, lit by the screen alone (after Hiroshi Sugimoto's « Theaters »).
   Seen from the back of the balcony: a trapezoid of stalls narrowing to the proscenium between converging side walls,
   eleven gently curved rows, a soft rake, two radial aisles and one along each wall. Only the rounded top of each back
   catches the screen's light, brighter near the stage; the rows nearest the eye are dark silhouettes with discreet
   lines, the far ones lifted a hair by the lit haze. Drawn once with Canvas 2D (3D geometry in metres, perspective, painter's order)
   into two canvases at the same density: the dark plate and the light; the light breathes with the screen's
   mean brightness (its opacity only, +-8 %). Reduced motion: the same picture, still. Without a 2D context the panel
   keeps its own black.
   One camera for everything: a 16 m cinema screen, its foot 0.5 m above a 0.9 m stage, 2 m behind the nosing; the eye
   looks level from the back of the balcony, 30 m from the screen (27 m on a phone), its height chosen per layout (a
   different seat, the same theatre) so that the stalls fill the band under the screen. The focal length and the
   principal point are solved so that the screen projects exactly onto the monitor's glass; the black masking, the
   proscenium reveals, the stage, the pit rail, the walls and the rows follow from the same projection. The monitor
   itself has no box: its bezel is the masking painted here. */
(() => {
  'use strict';
  const act = document.querySelector('.act--2');
  const screen = document.querySelector('[data-screen]');
  const monitor = act && act.querySelector('.monitor');
  if (!act || !screen || !monitor) return;

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const AIR = [16, 14, 11];   // #100E0B, the panel's own black

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // fine film grain, made once: a still tile, it never shimmers
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'), im = g.createImageData(160, 160), r = rng(7);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = clamp(0.5 + (r() + r() + r() - 1.5) * 0.55) * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return (GRAIN = c);
  }

  // ---------- the house, in metres: rows are arcs centred C metres behind the stage (z = 0); z grows to the back ----------
  // eleven rows from 3.6 m out, 0.95 m apart, rising 0.13 m each; arcs centred 60 m behind the stage (a sag of about
  // 0.6 m across the house: the rows read level, the side blocks turn only a few degrees to the stage); two aisles at
  // exactly +-3 m from the first row, opening slowly towards the back, 1.1 m clear, and a 1 m aisle along each side
  // wall; the walls leave the proscenium (+-P at z = Zp) and open by 0.15 m per metre: no seat ever stands past them.
  // The house is a mirror about the axis: no missing seat, no seat leaning, the centre block keeps its parity row
  // after row so its seats stand in columns
  const HOUSE = { rows: 11, R0: 3.6, pitch: 0.95, rake: 0.13, seatW: 0.56, backW: 0.53, aisles: [-3, 3], aisleOpen: 0.025, aisleW: 0.55,
    P: 8.8, Zp: -0.6, flare: 0.15, side: 1.0, C: 60 };
  const wallAt = (Z) => HOUSE.P + HOUSE.flare * (Z - HOUSE.Zp);
  // the stage end, in metres: screen 16 m wide (its height follows the glass), foot 1.4 m above the stalls' floor (stage
  // 0.9 m, then 0.5 m), 2 m behind the nosing (z = 0 on the axis); proscenium opening +-8.8 m, its face at z = -0.6, where
  // the curved nosing meets it; pit rail 2 m out, first row 3.6 m out. Exposure and albedos for the light layer.
  const STAGE = { W: 16, bot: 1.4, Z: -2, stageY: 0.9, P: HOUSE.P, top: 13.2, Zp: HOUSE.Zp, railZ: 2.0, railY: 0.95, pitY: -0.9,
    mask: [7, 6, 5], riser: [13, 12, 9], expo: 1, reveal: 0.32, floor: 0.16, nosing: 0.75, cap: 0.45 };
  // the eye: 30 m from the screen (27 m on a phone); per layout, which row (r) lands how far above the foot of the
  // panel (foot, px), and the bounds of the eye's height above the first row's floor (lo, hi, m)
  const CAM = { Z: 28, phoneZ: 25, wide: { r: 10, foot: 22, lo: 5.5, hi: 11 }, phone: { r: 10, foot: 8, lo: 5.5, hi: 13 },
    split: { r: 1, foot: 24, lo: 3.5, hi: 9 } };
  function buildHouse(o) {
    const rows = [];
    let cpar = -1;   // the centre block's parity, set by the first row
    for (let r = 0; r < o.rows; r++) {
      const rad = o.C + o.R0 + r * o.pitch, fy = r * o.rake;
      // the row's reach along its arc (s = rad x angle): from the side aisle on the left to the one on the right
      const reach = (side) => { let th = 0.3; for (let k = 0; k < 3; k++) th = Math.asin((wallAt(rad * Math.cos(th) - o.C) - o.side) / rad); return side * rad * th; };
      // three blocks between the walls' aisles and the two radial aisles (constant clear width, straight edges): the
      // side blocks are packed against their radial aisle, the slack falls by the wall; the centre block is centred
      const e = o.aisles.map((x) => rad * Math.asin(x * (1 + o.aisleOpen * r * o.pitch) / rad));
      const blocks = [[reach(-1), e[0] - o.aisleW, 1], [e[0] + o.aisleW, e[1] - o.aisleW, 0], [e[1] + o.aisleW, reach(1), -1]];
      const items = [];
      let i = 0;
      for (const [s0, s1, pack] of blocks) {
        let n = Math.floor((s1 - s0) / o.seatW);
        if (pack === 0) { if (cpar < 0) cpar = n % 2; else if (n % 2 !== cpar) n -= 1; }
        if (n < 1) continue;
        const slack = s1 - s0 - n * o.seatW, start = s0 + (pack > 0 ? slack : pack < 0 ? 0 : slack / 2) + o.seatW / 2;
        let prev = null;
        for (let k = 0; k < n; k++, i++) {
          const th = (start + k * o.seatW) / rad;
          const s = { th, X: rad * Math.sin(th), Z: rad * Math.cos(th) - o.C, r, i, h: 0.98, tilt: 0, w: o.backW, endL: !prev };
          items.push(s);
          prev = s;
        }
        if (prev) prev.endR = true;
      }
      rows.push({ r, rad, fy, items, C: o.C });
    }
    return rows;
  }

  // ---------- render the house from the back into the dark plate (gD) and the light (gL) ----------
  function render(gD, gL, house, v) {
    const { W, H, kD, kL, cam, lTop } = v;
    const proj = (X, Y, Z) => { const D = cam.Z - Z; return [cam.cx + cam.f * (X - cam.X) / D, cam.cy + cam.f * (cam.Y - Y) / D, D]; };
    const L = v.light;
    const lightAt = (X, Y, Z) => {
      const dx = L.P[0] - X, dy = L.P[1] - Y, dz = L.P[2] - Z, d = Math.hypot(dx, dy, dz);
      return { I: L.power / (1 + (d / L.d0) ** 2), l: [dx / d, dy / d, dz / d], d };
    };
    gD.setTransform(kD, 0, 0, kD, 0, 0);
    gL.setTransform(kL, 0, 0, kL, 0, -lTop * kL);   // the light canvas starts at lTop (CSS px) in the panel
    gD.fillStyle = rgba(AIR); gD.fillRect(0, 0, W, H);
    gL.clearRect(0, lTop, W, H - lTop);

    // the side walls: planes between pilasters, a grazing light that falls off with the distance to the screen;
    // the pilasters' edges on the stage side catch a thin vertical line
    const wl = v.walls;
    if (wl) {
      const fl = (zz) => Math.max(0, (zz - HOUSE.R0) / HOUSE.pitch) * HOUSE.rake - 0.4;
      for (const side of [-1, 1]) {
        for (let z = wl.z0; z < wl.z1; z += wl.bay) {
          const z2 = Math.min(wl.z1, z + wl.bay);
          const X = side * wallAt(z), X2 = side * wallAt(z2);
          const a = proj(X, fl(z), z), b = proj(X, wl.top, z), c = proj(X2, wl.top, z2), d = proj(X2, fl(z2), z2);
          if (a[2] < 0.5 || d[2] < 0.5) continue;
          const m1 = lightAt(X, L.P[1] * 0.7, z), m2 = lightAt(X2, L.P[1] * 0.7, z2);
          const lit1 = m1.I * Math.max(0, -side * m1.l[0]) * wl.gain, lit2 = m2.I * Math.max(0, -side * m2.l[0]) * wl.gain;
          const grd = gD.createLinearGradient(a[0], 0, d[0], 0);
          grd.addColorStop(0, rgba(mix(AIR, wl.col, lit1))); grd.addColorStop(1, rgba(mix(AIR, wl.col, lit2)));
          gD.fillStyle = grd;
          gD.beginPath(); gD.moveTo(a[0], a[1]); gD.lineTo(b[0], b[1]); gD.lineTo(c[0], c[1]); gD.lineTo(d[0], d[1]); gD.closePath(); gD.fill();
          const e0 = proj(X2, fl(z2), z2), e1 = proj(X2, wl.top * 0.62, z2);
          const ea = clamp(lit2 * wl.edge);
          if (ea > 0.004) {
            const eg = gL.createLinearGradient(0, e1[1], 0, e0[1]);
            eg.addColorStop(0, rgba(L.col, 0)); eg.addColorStop(0.6, rgba(L.col, ea * 0.8)); eg.addColorStop(1, rgba(L.col, ea * 0.35));
            gL.strokeStyle = eg; gL.lineWidth = 1.25;
            gL.beginPath(); gL.moveTo(e0[0] + side * 0.6, e0[1]); gL.lineTo(e1[0] + side * 0.6, e1[1]); gL.stroke();
          }
        }
      }
      // walls and ceiling sink into the dark above the eye line
      const yF = cam.cy + (H - cam.cy) * 0.12;
      const fade = gD.createLinearGradient(0, 0, 0, yF);
      fade.addColorStop(0, rgba(AIR, 1)); fade.addColorStop(0.55, rgba(AIR, 0.82)); fade.addColorStop(1, rgba(AIR, 0));
      gD.fillStyle = fade; gD.fillRect(0, 0, W, yF);
      const lf = gL.createLinearGradient(0, 0, 0, yF);
      lf.addColorStop(0, 'rgba(0,0,0,1)'); lf.addColorStop(0.55, 'rgba(0,0,0,.7)'); lf.addColorStop(1, 'rgba(0,0,0,0)');
      gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = lf; gL.fillRect(0, 0, W, yF); gL.globalCompositeOperation = 'source-over';
    }

    // ---------- the stage end: masking, proscenium reveals, stage floor and nosing, pit rail ----------
    // light from the screen as an area source (5 x 4 samples, Lambert at both ends), for the surfaces close to it
    const S = v.stage, sw = S.W / 2, sTop = S.bot + S.H;
    const E = (X, Y, Z, n) => {
      let e = 0;
      for (let i = 0; i < 5; i++) for (let k = 0; k < 4; k++) {
        const sx = -sw + S.W * (i + 0.5) / 5, sy = S.bot + S.H * (k + 0.5) / 4;
        const dx = sx - X, dy = sy - Y, dz = S.Z - Z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
        const cp = (n[0] * dx + n[1] * dy + n[2] * dz) / d, cs = -dz / d;
        if (cp > 0 && cs > 0) e += cp * cs / d2;
      }
      return e * S.W * S.H / 20 / Math.PI;
    };
    const P = S.P, Zp = S.Zp, nose = (X) => Zp * (X / P) ** 2, rail = (X) => S.railZ - 0.9 * (X / P) ** 2;
    const curve = (fz, Y, n = 32) => { const a = []; for (let j = 0; j <= n; j++) { const X = -P + 2 * P * j / n; a.push(proj(X, Y, fz(X))); } return a; };
    const poly = (g, pts) => { g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    const ex = S.expo;
    // the masking: black velour around the screen, darker than the house; it dissolves into the house above the screen
    const mk = [proj(-P, S.stageY, S.Z), proj(P, S.stageY, S.Z), proj(P, S.top, S.Z), proj(-P, S.top, S.Z)];
    const yST = proj(0, sTop, S.Z)[1];
    const mg = gD.createLinearGradient(0, mk[2][1], 0, yST);
    mg.addColorStop(0, rgba(mix(AIR, S.mask, 0.35))); mg.addColorStop(0.3, rgba(mix(AIR, S.mask, 0.75))); mg.addColorStop(0.6, rgba(mix(AIR, S.mask, 0.95))); mg.addColorStop(1, rgba(S.mask));
    gD.fillStyle = mg; poly(gD, mk); gD.fill();
    // the reveals of the proscenium (inner faces at x = +-P), grazed by the screen from behind; fading above its top
    for (const side of [-1, 1]) {
      const X = side * P, n = [-side, 0, 0];
      const q = [proj(X, S.stageY, S.Z), proj(X, S.top, S.Z), proj(X, S.top, Zp), proj(X, S.stageY, Zp)];
      if (q.some((p) => p[2] < 0.5)) continue;
      const hz = gL.createLinearGradient(q[0][0], 0, q[3][0], 0);
      for (let j = 0; j <= 6; j++) { const Z = S.Z + (Zp - S.Z) * j / 6; hz.addColorStop(j / 6, rgba(L.col, clamp(ex * S.reveal * E(X, S.bot + S.H * 0.4, Z, n)))); }
      gL.fillStyle = hz; poly(gL, q); gL.fill();
      // the same face, darker upwards: the light falls off above the screen's middle and is gone by the top
      gL.save(); poly(gL, q); gL.clip();
      const ya = proj(X, S.bot + S.H * 0.45, Zp)[1], yb = proj(X, S.top, S.Z)[1];
      const vf = gL.createLinearGradient(0, ya, 0, yb);
      vf.addColorStop(0, 'rgba(0,0,0,0)'); vf.addColorStop(0.4, 'rgba(0,0,0,.45)'); vf.addColorStop(0.75, 'rgba(0,0,0,.85)'); vf.addColorStop(1, 'rgba(0,0,0,1)');
      gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = vf; gL.fillRect(Math.min(q[0][0], q[3][0]) - 2, Math.min(yb, ya) - 2, Math.abs(q[3][0] - q[0][0]) + 4, Math.abs(ya - yb) + 4);
      gL.restore();
    }
    // the stage floor, lit most near the nosing, where the screen faces it best; its sides fall off past the screen
    const fl = curve(nose, S.stageY).concat([proj(P, S.stageY, S.Z), proj(-P, S.stageY, S.Z)]);
    const yb0 = proj(0, S.stageY, S.Z)[1], yn0 = proj(0, S.stageY, 0)[1];
    const up = [0, 1, 0], fg = gL.createLinearGradient(0, yb0, 0, yn0);
    for (let j = 0; j <= 8; j++) fg.addColorStop(j / 8, rgba(L.col, clamp(ex * S.floor * E(0, S.stageY, S.Z + (0 - S.Z) * j / 8, up))));
    gL.fillStyle = fg; poly(gL, fl); gL.fill();
    gL.save(); poly(gL, fl); gL.clip();
    const xl = proj(-P, S.stageY, -1)[0], xr = proj(P, S.stageY, -1)[0], e0 = E(0, S.stageY, -1, up);
    const lat = gL.createLinearGradient(xl, 0, xr, 0);
    for (let j = 0; j <= 10; j++) lat.addColorStop(j / 10, `rgba(0,0,0,${(1 - (E(-P + 2 * P * j / 10, S.stageY, -1, up) / e0) ** 2.5).toFixed(3)})`);
    gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = lat; gL.fillRect(xl - 2, yb0 - 4, xr - xl + 4, yn0 - yb0 + 8);
    gL.restore();
    // the riser and the pit rail stay in the dark (they face away from the screen); the house floor beyond
    const nz = curve(nose, S.stageY), rl = curve(rail, S.railY);
    gD.fillStyle = rgba(S.riser); poly(gD, nz.concat(curve(nose, S.pitY).reverse())); gD.fill();
    gD.fillStyle = rgba(v.floor); poly(gD, curve(rail, 0).concat([[proj(P, 0, rail(P))[0], H + 60], [proj(-P, 0, rail(-P))[0], H + 60]])); gD.fill();
    gD.fillStyle = rgba(S.riser); poly(gD, rl.concat(curve(rail, 0).reverse())); gD.fill();
    // the nosing and the cap of the rail: two fine curves catching the light (the rail's fainter, farther from it)
    const crest = (pts, fz, Y, gain, lw) => {
      const g = gL.createLinearGradient(pts[0][0], 0, pts[pts.length - 1][0], 0);
      for (let j = 0; j <= 10; j++) { const X = -P + 2 * P * j / 10, a = clamp(ex * gain * E(X, Y, fz(X), up) * (E(X, Y, fz(X), up) / E(0, Y, fz(0), up)) ** 1.5); g.addColorStop(j / 10, rgba(L.col, j === 0 || j === 10 ? 0 : a)); }
      gL.strokeStyle = g; gL.lineWidth = lw; gL.beginPath(); pts.forEach((p, j) => (j ? gL.lineTo(p[0], p[1]) : gL.moveTo(p[0], p[1]))); gL.stroke();
    };
    crest(nz, nose, S.stageY, S.nosing, 1);
    crest(rl, rail, S.railY, S.cap, 1);

    // rows, far to near
    const order = house.map((row) => ({ row, D: proj(0, row.fy, row.rad - row.C)[2] })).filter((o) => o.D > 0.4).sort((a, b) => b.D - a.D);

    const stats = [], dRef = Math.hypot(L.P[1] - 0.98, L.P[2] - HOUSE.R0);
    for (const { row } of order) {
      const fy = row.fy;
      // the light on the backs falls off with the distance to the screen, (d / d0)^-2.1 from the first row: the rows under
      // the eye keep only faint lines (about 40 % of the first row's), so the eye goes to the screen first
      // (floored at half the first row's: the rows under the eye stay readable as seats, never as an empty floor)
      const fall = (d) => v.gain * Math.max(0.5, Math.min(1.15, dRef / d) ** 2.1);
      // (the aisles have no lit step: at this distance their nosings read as stray dashes; the gap alone draws them)
      const items = row.items.map((s) => {
        const t = [Math.cos(s.th), 0, -Math.sin(s.th)], hw = s.w / 2, top = fy + s.h;
        // the back has a thickness (9 cm): seen at an angle its outline takes the outer corners of both faces, so a back
        // on the sides stays a broad rounded shape, never a narrow post
        const nx = Math.sin(s.th) * 0.045, nz = Math.cos(s.th) * 0.045;
        const corner = (side, y, k) => {
          const a = proj(s.X + side * t[0] * hw * k + nx, y, s.Z + side * t[2] * hw * k + nz), b = proj(s.X + side * t[0] * hw * k - nx, y, s.Z + side * t[2] * hw * k - nz);
          return side < 0 ? (a[0] < b[0] ? a : b) : (a[0] > b[0] ? a : b);
        };
        const l = corner(-1, top, 1), r = corner(1, top, 1), lb = corner(-1, fy - 0.2, 0.94), rb = corner(1, fy - 0.2, 0.94);
        const c = proj(s.X, top, s.Z);
        const arm = (side, end) => {
          const ax = s.X + side * t[0] * (hw + 0.045), az = s.Z + side * t[2] * (hw + 0.045), aw = end ? 0.07 : 0.035, ah = fy + (end ? 0.7 : 0.62);
          return { l: proj(ax - t[0] * aw, ah, az - t[2] * aw), r: proj(ax + t[0] * aw, ah, az + t[2] * aw), b: proj(ax, fy - 0.2, az), end, li: lightAt(ax, ah, az) };
        };
        return { s, l, r, lb, rb, c, sc: cam.f / c[2], li: lightAt(s.X, top, s.Z), t, arm: arm(-1, s.endL), arm2: s.endR ? arm(1, true) : null };
      }).filter((p) => p.c[2] > 0.4 && p.r[0] > -60 && p.l[0] < W + 60 && p.c[1] - 2 < H + 40).sort((a, b) => b.c[2] - a.c[2]);
      if (!items.length) continue;
      const mid = items.filter((p) => Math.abs(p.s.X) < 3).map((p) => p.r[0] - p.l[0]).sort((a, b) => a - b);
      stats.push({ r: row.r, y: Math.round(Math.min(...items.map((p) => p.c[1]))), w: mid.length ? +mid[mid.length >> 1].toFixed(1) : 0, n: items.length });

      // the floor under the row, down to the foot of the frame (nearer rows are drawn over it)
      const ths = row.items.map((q) => q.th);
      const t0 = Math.min(...ths) - 0.4 / row.rad, t1 = Math.max(...ths) + 0.4 / row.rad, fp = [];
      for (let j = 0; j <= 24; j++) { const th = t0 + (t1 - t0) * j / 24; const q = proj(row.rad * Math.sin(th), fy + 0.25, row.rad * Math.cos(th) - row.C); if (q[2] > 0.3) fp.push(q); }
      if (fp.length > 1) {
        gD.fillStyle = rgba(v.floor);
        gD.beginPath(); fp.forEach((q, j) => (j ? gD.lineTo(q[0], q[1]) : gD.moveTo(q[0], q[1])));
        gD.lineTo(fp[fp.length - 1][0], H + 60); gD.lineTo(fp[0][0], H + 60); gD.closePath(); gD.fill();
      }

      // a faint haze lit by the screen lifts the rows nearest the stage a hair; the rows under the eye stay dark
      const dStage = Math.hypot(L.P[2] - (row.rad - row.C), L.P[1] - fy);
      const sil = mix(v.sil, v.hazeCol, clamp(0.75 * Math.exp(-dStage / 7)));

      const backPath = (g, p) => {
        // a seat back always has round shoulders and a top almost flat: the camber, the lean and the slant of a back seen
        // at an angle are held to small fractions of its projected width (no peak, no saw tooth)
        const w = Math.max(1, p.r[0] - p.l[0]);
        const rr = Math.min(0.1 * p.sc, w * 0.3), bul = Math.min(0.018 * p.sc, w * 0.04), tilt = clamp(p.s.tilt * p.sc, -w * 0.02, w * 0.02);
        const ym = (p.l[1] + p.r[1]) / 2, dy = clamp((p.r[1] - p.l[1]) / 2, -w * 0.08, w * 0.08);
        const yl = ym - dy + tilt, yr = ym + dy - tilt;
        g.moveTo(p.lb[0], p.lb[1]);
        g.lineTo(p.l[0] + (p.lb[0] - p.l[0]) * 0.02, yl + rr);
        g.bezierCurveTo(p.l[0], yl + rr * 0.4, p.l[0] + rr * 0.4, yl, p.l[0] + rr, yl - bul * 0.35);
        g.quadraticCurveTo((p.l[0] + p.r[0]) / 2, (yl + yr) / 2 - bul * 1.3, p.r[0] - rr, yr - bul * 0.35);
        g.bezierCurveTo(p.r[0] - rr * 0.4, yr, p.r[0], yr + rr * 0.4, p.r[0] + (p.rb[0] - p.r[0]) * 0.02, yr + rr);
        g.lineTo(p.rb[0], p.rb[1]); g.closePath();
        return { rr, yl, yr, bul };
      };
      const armPath = (g, a) => {
        const rr = (a.r[0] - a.l[0]) * 0.5;
        g.moveTo(a.l[0], a.b[1]); g.lineTo(a.l[0], a.l[1] + rr); g.quadraticCurveTo(a.l[0], a.l[1], a.l[0] + rr, a.l[1]);
        g.lineTo(a.r[0] - rr, a.r[1]); g.quadraticCurveTo(a.r[0], a.r[1], a.r[0], a.r[1] + rr); g.lineTo(a.r[0], a.b[1]); g.closePath();
      };
      const silhouettes = (g) => { g.beginPath(); for (const p of items) { backPath(g, p); armPath(g, p.arm); if (p.arm2) armPath(g, p.arm2); } };

      // the row hides the light behind it, then is drawn on the plate
      gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = '#000'; silhouettes(gL); gL.fill(); gL.globalCompositeOperation = 'source-over';
      gD.fillStyle = rgba(sil); silhouettes(gD); gD.fill();

      // the light on the rounded top of each back only, brighter on the shoulder that faces the screen; a short sheen
      // under it where the roll turns away; the flanks stay in the dark
      for (const p of items) {
        const { li, t } = p;
        const dot = (n) => n[0] * li.l[0] + n[1] * li.l[1] + n[2] * li.l[2];
        const back = clamp(0.35 + 0.65 * Math.max(0, -li.l[2]));
        // +-4 % per seat, hashed on the seat's distance from the axis: the same on both sides (a mirror), no pattern
        const col = Math.round(Math.abs(p.s.X) / 0.28);
        const hh = (Math.imul(col + 1000, 73856093) ^ Math.imul(row.r + 7, 19349663)) >>> 0;
        const keep = fall(li.d) * (0.96 + 0.08 * ((hh >>> 8) % 100) / 100);
        const aL = clamp(back * (0.3 + 0.9 * Math.max(0, dot([-t[0] * 0.7, 0.7, -t[2] * 0.7]))) * keep);
        const aR = clamp(back * (0.3 + 0.9 * Math.max(0, dot([t[0] * 0.7, 0.7, t[2] * 0.7]))) * keep);
        const aC = clamp(back * (0.45 + 0.75 * Math.max(0, li.l[1] + 0.25)) * keep);
        if (Math.max(aL, aR, aC) < 0.008) continue;
        const w = clamp(0.026 * p.sc, 1, 2.4);
        gL.save();
        gL.beginPath(); const geo = backPath(gL, p); gL.clip();
        const gx = gL.createLinearGradient(p.l[0], 0, p.r[0], 0);
        gx.addColorStop(0, rgba(L.col, 0)); gx.addColorStop(0.13, rgba(L.col, aL * 0.8)); gx.addColorStop(0.3, rgba(L.col, aL));
        gx.addColorStop(0.5, rgba(L.col, aC)); gx.addColorStop(0.7, rgba(L.col, aR)); gx.addColorStop(0.87, rgba(L.col, aR * 0.8)); gx.addColorStop(1, rgba(L.col, 0));
        gL.strokeStyle = gx; gL.lineWidth = w * 2; gL.lineJoin = 'round';
        const rr = geo.rr;
        gL.beginPath();
        gL.moveTo(p.l[0], geo.yl + rr * 0.75);
        gL.bezierCurveTo(p.l[0], geo.yl + rr * 0.4, p.l[0] + rr * 0.4, geo.yl, p.l[0] + rr, geo.yl - geo.bul * 0.35);
        gL.quadraticCurveTo((p.l[0] + p.r[0]) / 2, (geo.yl + geo.yr) / 2 - geo.bul * 1.3, p.r[0] - rr, geo.yr - geo.bul * 0.35);
        gL.bezierCurveTo(p.r[0] - rr * 0.4, geo.yr, p.r[0], geo.yr + rr * 0.4, p.r[0], geo.yr + rr * 0.75);
        gL.stroke();
        const sh = 0.13 * p.sc, top = Math.min(geo.yl, geo.yr) - geo.bul, am = (aL + aR + aC) / 3;
        const gy = gL.createLinearGradient(0, top, 0, top + sh + w * 2);
        gy.addColorStop(0, rgba(L.col, am * 0.3)); gy.addColorStop(0.35, rgba(L.col, am * 0.11)); gy.addColorStop(1, rgba(L.col, 0));
        gL.fillStyle = gy; gL.fillRect(p.l[0] + rr * 0.5, top - 2, p.r[0] - p.l[0] - rr, sh + w * 2 + 2);
        gL.restore();
      }
      // the armrests' tops; the row-end standards stay dark (lit, they read as stray specks along the aisles)
      for (const p of items) {
        for (const a of [p.arm, p.arm2]) {
          if (!a || a.end) continue;
          const I = clamp(fall(a.li.d) * clamp(0.35 + 0.65 * Math.max(0, -a.li.l[2])) * 0.26);
          if (I < 0.012) continue;
          gL.save(); gL.beginPath(); armPath(gL, a); gL.clip();
          gL.strokeStyle = rgba(L.col, I); gL.lineWidth = clamp(0.02 * p.sc, 1, 2.4) * 2;
          gL.beginPath(); gL.moveTo(a.l[0], a.l[1]); gL.lineTo(a.r[0], a.r[1]); gL.stroke();
          gL.restore();
        }
      }
    }

    // the front of the balcony we sit behind (split layout, where the band under the screen is narrow): a dark rail
    // closing the frame just under the first two rows, an arc around the same centre as the rows; its cap a faint line
    const pb = v.parapet;
    if (pb) {
      const pts = [];
      for (let j = 0; j <= 48; j++) { const th = -0.24 + 0.48 * j / 48, q = proj(pb.R * Math.sin(th), pb.Y, pb.R * Math.cos(th) - HOUSE.C); if (q[2] > 0.5) pts.push(q); }
      const shape = (g) => { g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineTo(pts[pts.length - 1][0], H + 60); g.lineTo(pts[0][0], H + 60); g.closePath(); };
      gD.fillStyle = rgba(pb.col); shape(gD); gD.fill();
      gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = '#000'; shape(gL); gL.fill(); gL.globalCompositeOperation = 'source-over';
      const ca = clamp(lightAt(0, pb.Y, pb.R - HOUSE.C).I * pb.cap);
      gL.strokeStyle = rgba(L.col, ca); gL.lineWidth = 1;
      gL.beginPath(); pts.forEach((p, j) => (j ? gL.lineTo(p[0], p[1] + 0.5) : gL.moveTo(p[0], p[1] + 0.5))); gL.stroke();
    }

    // the foot of the panel sinks into its black (it meets the box office there)
    const y0 = H - v.footFade;
    const fd = gD.createLinearGradient(0, y0, 0, H);
    fd.addColorStop(0, rgba(AIR, 0)); fd.addColorStop(0.5, rgba(AIR, 0.55)); fd.addColorStop(1, rgba(AIR, 1));
    gD.fillStyle = fd; gD.fillRect(0, y0, W, v.footFade);
    const fl2 = gL.createLinearGradient(0, y0, 0, H);
    fl2.addColorStop(0, 'rgba(0,0,0,0)'); fl2.addColorStop(0.5, 'rgba(0,0,0,.6)'); fl2.addColorStop(1, 'rgba(0,0,0,1)');
    gL.globalCompositeOperation = 'destination-out'; gL.fillStyle = fl2; gL.fillRect(0, y0, W, v.footFade);

    // calm under the journal and the key: a soft capsule of shade hugging each text box (flat over the text, then a long
    // smooth fall), never a cut-out; drawn as a middle band and two round ends that share one profile, joined on whole
    // device pixels so no seam shows
    for (const e of v.calm) {
      const rc = e.h * 0.56 + 4, R = rc + e.pad, yc = e.y + e.h / 2;
      const snap = (x) => Math.round(x * kL) / kL;
      const x0 = snap(e.x + e.h / 4), x1 = Math.max(x0, snap(e.x + e.w - e.h / 4));
      const stops = (g, mirror) => {
        for (let k = 0; k <= 8; k++) {
          const u = k / 8, a = e.a * (1 - u * u * (3 - 2 * u)), d = (rc + u * e.pad) / R;
          if (mirror) { g.addColorStop(0.5 - d / 2, `rgba(0,0,0,${a.toFixed(4)})`); g.addColorStop(0.5 + d / 2, `rgba(0,0,0,${a.toFixed(4)})`); } else g.addColorStop(d, `rgba(0,0,0,${a.toFixed(4)})`);
        }
        if (mirror) { g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)'); } else g.addColorStop(0, `rgba(0,0,0,${e.a})`);
      };
      const band = gL.createLinearGradient(0, yc - R, 0, yc + R); stops(band, true);
      gL.fillStyle = band; gL.fillRect(x0, yc - R, x1 - x0, 2 * R);
      for (const [cx, xa, xb] of [[x0, x0 - R, x0], [x1, x1, x1 + R]]) {
        const rg = gL.createRadialGradient(cx, yc, 0, cx, yc, R); stops(rg, false);
        gL.fillStyle = rg; gL.fillRect(xa, yc - R, xb - xa, 2 * R);
      }
    }
    gL.globalCompositeOperation = 'source-over';
    gD.canvas.__rows = stats;   // per row: top (px), median back width near the axis, seats drawn (read by the review tools)

    // film grain on the dark plate, multiplicative (it lives in the shadows, never lifts the black)
    gD.save(); gD.setTransform(1, 0, 0, 1, 0, 0);
    gD.globalCompositeOperation = 'overlay'; gD.globalAlpha = 0.1;
    gD.fillStyle = gD.createPattern(grain(), 'repeat'); gD.fillRect(0, 0, gD.canvas.width, gD.canvas.height);
    gD.restore();
  }

  // ---------- the canvases ----------
  const mk = (cls) => { const c = document.createElement('canvas'); c.className = 'house ' + cls; c.setAttribute('aria-hidden', 'true'); return c; };
  const cD = mk('house-dark'), cL = mk('house-light');
  const gD = cD.getContext('2d', { alpha: false }), gL = cL.getContext('2d');
  if (!gD || !gL) return;
  act.prepend(cD, cL);

  const rel = (el, z) => { const r = el.getBoundingClientRect(); return { x: r.left - z.left, y: r.top - z.top, w: r.width, h: r.height }; };
  function textExtent(el, z) {
    const rg = document.createRange(); rg.selectNodeContents(el);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 0);
    if (!rs.length) return rel(el, z);
    const x0 = Math.min(...rs.map((r) => r.left)), x1 = Math.max(...rs.map((r) => r.right)), y0 = Math.min(...rs.map((r) => r.top)), y1 = Math.max(...rs.map((r) => r.bottom));
    return { x: x0 - z.left, y: y0 - z.top, w: x1 - x0, h: y1 - y0 };
  }

  let drawn = '';
  function draw() {
    const W = act.clientWidth, H = act.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = act.getBoundingClientRect();
    const gl = rel(screen, z);   // the glass: the screen's own box (the phone's zoom happens inside its pixels)
    const key = [W, H, dpr, gl.x, gl.y, gl.w, gl.h].map((n) => Math.round(n * 100)).join(',');
    if (key === drawn) return;
    drawn = key;
    const phone = W < 640, split = document.documentElement.classList.contains('split');
    // the screen in metres, shaped like the glass; the eye at the back of the balcony, looking level. Its height is the
    // seat we take in this layout: the last row lands at the foot of the panel (in the split layout, where only a narrow
    // band shows under the screen, the second row does, just above the front of our balcony). Linear in the height, so
    // solved directly.
    const S = Object.assign({}, STAGE, { H: STAGE.W * gl.h / gl.w });
    // on the axis of the house: the view is a mirror about the screen's centre
    const cam = { X: 0, Z: phone ? CAM.phoneZ : CAM.Z };
    const Ds = cam.Z - S.Z, f = gl.w * Ds / S.W;
    const band = H - (gl.y + gl.h);
    const fit = split ? CAM.split : phone ? CAM.phone : CAM.wide;
    const Zr = HOUSE.R0 + fit.r * HOUSE.pitch, Yr = fit.r * HOUSE.rake + 0.98, Dr = cam.Z - Zr;
    cam.Y = clamp(((band - fit.foot) / f + Yr / Dr - S.bot / Ds) / (1 / Dr - 1 / Ds), fit.lo, fit.hi);
    cam.f = f;
    cam.cx = gl.x + gl.w / 2 + f * (cam.X - 0) / Ds;
    cam.cy = gl.y - f * (cam.Y - (S.bot + S.H)) / Ds;
    // split layout: the front of our balcony, 3 m ahead of the eye, its top 3 px under the second row
    const parapet = split ? { R: cam.Z - 3 + HOUSE.C, Y: cam.Y - (gl.y + gl.h + band - fit.foot + 3 - cam.cy) * 3 / f, col: [9, 8, 7], cap: 0.3 } : null;
    // the light canvas starts where the reveals fade out above the screen; both canvases at full density (up to 2)
    const lTop = Math.max(0, Math.floor(Math.min(gl.y - f * (STAGE.top - S.bot - S.H) / Ds, cam.cy - 40, gl.y) - 2));
    const kL = dpr, kD = dpr;
    cD.width = Math.round(W * kD); cD.height = Math.round(H * kD);
    cL.width = Math.round(W * kL); cL.height = Math.max(1, Math.round((H - lTop) * kL));
    cL.style.top = lTop + 'px'; cL.style.height = (H - lTop) + 'px'; cL.style.bottom = 'auto';
    // the journal, the key (and the surtitle in the split column) sit in a calm hollow of the light
    const calm = [];
    const j = act.querySelector('.journal'), go = act.querySelector('.cue-key'), sur = act.querySelector('.surtitle');
    const pad = phone ? 24 : 34, a = phone ? 0.55 : 0.66;
    for (const b of [j && textExtent(j, z), go && rel(go, z), split && sur && textExtent(sur, z)]) if (b) calm.push(Object.assign(b, { pad, a }));
    render(gD, gL, buildHouse(HOUSE), {
      W, H, kD, kL, cam, lTop, stage: S,
      light: { P: [0, S.bot + S.H * 0.5, S.Z], col: [212, 222, 196], power: phone ? 3.1 : 2.2, d0: 11 }, gain: phone ? 2.3 : 1.5,
      sil: [7, 7, 6], hazeCol: [22, 24, 20], floor: [10, 9, 8],
      walls: phone ? null : { z0: S.Zp, z1: cam.Z - 1, bay: 3.1, top: 14, col: [36, 38, 33], gain: 0.12, edge: 0.14 },
      footFade: phone ? 28 : split ? 10 : 24, calm, parapet,
    });
  }

  // ---------- the light breathes with the screen ----------
  const probe = document.createElement('canvas'); probe.width = 16; probe.height = 10;
  const gp = probe.getContext('2d', { willReadFrequently: true });
  let on = false, raf = 0, last = 0, acc = 0, lum = 0.05, sm = -1, ref = -1;
  function read() {
    try {
      gp.drawImage(screen, 0, 0, 16, 10);
      const d = gp.getImageData(0, 0, 16, 10).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      lum = s / (160 * 255);
      if (sm < 0) sm = lum;
    } catch (e) { /* the light stays still */ }
  }
  let shown = -1;
  function tick(now) {
    raf = 0;
    if (!on || RM.matches) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    acc += dt;
    if (acc >= 0.1) { acc = 0; read(); }
    sm += (lum - sm) * (1 - Math.exp(-dt / 0.9));
    if (ref < 0) ref = sm;
    ref += (sm - ref) * (1 - Math.exp(-dt / 12));
    // the screen's mean light (about 0.15 to 0.17) against its own slow average: a change of page lifts or lowers the
    // house by a few per cent, then it settles (0.92, +-8 % at most)
    const o = Math.round(0.92 * (1 + clamp((sm - ref) / Math.max(ref, 0.02) * 0.8, -0.08, 0.08)) * 1000) / 1000;
    if (o !== shown) { cL.style.opacity = String(o); shown = o; }
    raf = requestAnimationFrame(tick);
  }
  function run() {
    if (RM.matches) { cancelAnimationFrame(raf); raf = 0; cL.style.opacity = '0.93'; shown = -1; return; }
    if (on && !raf) { last = 0; raf = requestAnimationFrame(tick); }
  }
  new IntersectionObserver((es) => { for (const e of es) on = e.isIntersecting; run(); }, { rootMargin: '10% 0px' }).observe(act);
  RM.addEventListener('change', run);

  // drawn once, early (before the act is reached: no long frame while scrolling), then on every change of layout, in the
  // same frame as the layout (a ResizeObserver runs before paint): the masking never lags behind the screen
  const ro = new ResizeObserver(() => draw());
  ro.observe(act); ro.observe(screen);
  let rq = 0;
  addEventListener('resize', () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; draw(); }); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { draw(); run(); });
})();
