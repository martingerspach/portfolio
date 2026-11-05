/* Martin Gerspach, portfolio: the About page, « the wiring ».
   Chosen on 2026-11-03 from the About pistes (design/portfolio/about-pistes, piste C, v2).
   Jobs, skills and tools on three rows, joined like the nodes of an agent workflow. Pointing at anything draws
   its path (coral for its own wires, ink further on) and says it in words; a click pins it, Escape lets go.
   Phone: skills and tools face each other in two columns, the tools' names written.
   Data: SITE.experience, SITE.skills, SITE.jobSkills, SITE.skillTools (data.js); TOOLS, the brand marks (logos.js).
   app.js calls AboutPage.mount(main, { ico, copyEmail }) and gets the teardown back. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const PHONE = matchMedia('(max-width: 900px)');   // the vertical graph: below about 880 px the horizontal one overflows
  const HOVER = matchMedia('(hover: hover)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // escaped text whose hyphenated words never break at the hyphen (post-production, Metz-Strasbourg)
  const nw = (s) => esc(s).replace(/([^\s,.()]+-[^\s,.()]+)/g, '<span class="nw">$1</span>');
  const GROUPS = [
    { label: 'Generation', groups: ['Generation'] },
    { label: 'Web', groups: ['Web'] },
    { label: 'Agents and automation', groups: ['Agents', 'Automation'] },
  ];

  /* ---------- the marks ---------- */
  let BY = null;
  function toolOf(name) {
    if (!BY) BY = new Map(window.TOOLS.map((t) => [t.name, t]));
    const t = BY.get(name);
    if (!t) throw new Error('No logo for ' + name);
    return t;
  }
  // a mark whose single brand colour needs a lighter value on the night ground (token per theme)
  const THEMED = { WebGL: 'var(--c-webgl)' };
  // the brand's own colours; marks with no colour vector follow the ink, so they hold in both themes
  function tile(name) {
    const t = toolOf(name);
    const brand = THEMED[name] || (t.dark ? 'var(--ink)' : t.brand);
    const svg = THEMED[name] ? t.mono : (t.color || t.mono);
    const st = THEMED[name] ? ` style="color:${THEMED[name]}"` : '';
    return `<span class="tool cb__t" data-tool="${esc(t.name)}" role="img" aria-label="${esc(t.name)}" tabindex="-1" style="--brand:${brand}"><span class="tool__g"${st}>${svg}</span></span>`;
  }

  /* critically damped spring, exact step */
  function crit(p, v, T, w, dt) {
    const d = p - T, e = Math.exp(-w * dt), c = v + w * d;
    return [T + (d + c * dt) * e, (v - c * w * dt) * e];
  }

  /* The name tag: one label that glides from mark to mark and takes the new name's width.
     It sits under the mark (the wires arrive from above), over it when there is no room below. */
  function Tag() {
    const el = document.createElement('div');
    el.className = 'tool-tag';
    el.setAttribute('aria-hidden', 'true');
    const meas = document.createElement('span');
    meas.className = 'tool-tag__m';
    meas.setAttribute('aria-hidden', 'true');
    document.body.append(el, meas);
    const H = 36, GAP = 10, W = 24;
    const s = { x: 0, y: 0, w: 0, vx: 0, vy: 0, vw: 0, tx: 0, ty: 0, tw: 0 };
    let cur = null, txt = '', span = null, shown = false, raf = 0, last = 0;
    function target() {
      if (!cur || !cur.isConnected) return;
      const r = cur.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const x = Math.max(8, Math.min(vw - s.tw - 8, r.left + r.width / 2 - s.tw / 2));
      let y = r.bottom + GAP;
      if (y + H > innerHeight - 8) y = r.top - H - GAP;
      s.tx = x + scrollX; s.ty = y + scrollY;
    }
    function paint() {
      el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`;
      el.style.width = s.w.toFixed(2) + 'px';
    }
    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      target();
      if (RM.matches) { s.x = s.tx; s.y = s.ty; s.w = s.tw; s.vx = s.vy = s.vw = 0; }
      else {
        [s.x, s.vx] = crit(s.x, s.vx, s.tx, W, dt);
        [s.y, s.vy] = crit(s.y, s.vy, s.ty, W, dt);
        [s.w, s.vw] = crit(s.w, s.vw, s.tw, W, dt);
      }
      paint();
      const moving = Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty) + Math.abs(s.w - s.tw) > 0.05;
      raf = shown || moving ? requestAnimationFrame(frame) : 0;
    }
    function setText(t, animate) {
      if (t === txt) return;
      txt = t;
      meas.textContent = t;
      s.tw = Math.ceil(meas.getBoundingClientRect().width) + 26;
      const n = document.createElement('span');
      n.textContent = t;
      if (animate && span && !RM.matches) {
        const old = span;
        old.classList.add('is-out');
        setTimeout(() => old.remove(), 360);
        n.classList.add('is-in');
        el.append(n);
        n.getBoundingClientRect();
        n.classList.remove('is-in');
      } else { el.textContent = ''; el.append(n); }
      span = n;
    }
    return {
      el,
      show(node) {
        const was = shown;
        cur = node;
        setText(node.dataset.tool || '', was);
        if (!was) { target(); s.x = s.tx; s.y = s.ty - 6; s.w = s.tw; s.vx = s.vy = s.vw = 0; paint(); }
        shown = true;
        el.classList.add('is-shown');
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      },
      hide() { shown = false; cur = null; txt = ''; el.classList.remove('is-shown'); },
      destroy() { cancelAnimationFrame(raf); el.remove(); meas.remove(); },
    };
  }

  /* Names on hover, keyboard focus and tap for the marks of root. One Tab stop for the marks, arrows move
     between them (Home, End), Escape hides the name. quiet(): true when the names are already written. */
  function bindTools(root, o) {
    const tag = Tag();
    let active = null, timer = 0;
    $$('.tool', root).forEach((t, i) => { t.tabIndex = i ? -1 : 0; });
    const enter = (t) => {
      clearTimeout(timer);
      if (active !== t) {
        if (active) active.classList.remove('is-on');
        active = t;
        t.classList.add('is-on');
        o.enter(t.dataset.tool);
      }
      if (o.quiet()) tag.hide(); else tag.show(t);
    };
    const leave = (d = 150) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        tag.hide();
        if (active) active.classList.remove('is-on');
        active = null;
        o.leave();
      }, d);
    };
    const inside = (n) => { const t = n && n.closest ? n.closest('.tool') : null; return t && root.contains(t) ? t : null; };
    const onOver = (e) => { if (e.pointerType === 'touch') return; const t = inside(e.target); if (t) enter(t); };
    const onOut = (e) => {
      if (e.pointerType === 'touch' || !inside(e.target)) return;
      const to = e.relatedTarget;
      if (inside(to) || (to && tag.el.contains(to))) return;
      leave();
    };
    const onTagOver = () => clearTimeout(timer);
    const onTagOut = (e) => { if (!inside(e.relatedTarget)) leave(); };
    const onDown = (e) => {
      const t = inside(e.target);
      if (t && e.pointerType !== 'mouse') enter(t);
      else if (!t && active && e.pointerType !== 'mouse') leave(0);
    };
    const onDocDown = (e) => { if (active && !root.contains(e.target)) leave(0); };
    const onFocusIn = (e) => { const t = inside(e.target); if (t) enter(t); };
    const onFocusOut = (e) => { if (!inside(e.relatedTarget)) leave(0); };
    const onKey = (e) => {
      if (e.key === 'Escape' && active) { leave(0); return; }
      const t = inside(e.target);
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -1e3, End: 1e3 };
      if (!t || !(e.key in keys)) return;
      e.preventDefault();
      const list = $$('.tool', root);
      const j = Math.max(0, Math.min(list.length - 1, list.indexOf(t) + keys[e.key]));
      list.forEach((x, k) => { x.tabIndex = k === j ? 0 : -1; });
      list[j].focus();
    };
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('keydown', onKey);
    tag.el.addEventListener('pointerover', onTagOver);
    tag.el.addEventListener('pointerout', onTagOut);
    document.addEventListener('pointerdown', onDocDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onDocDown);
      tag.destroy();
    };
  }

  /* Every order of the six skills is tried; tools are sorted inside their group by the mean position of their
     skills; jobs keep their chronological order. The order with the fewest wire crossings wins (39 instead of 89
     with the data of 2026-11-03). */
  function arrange(jobs, skills, JS, ST) {
    const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    const cross = (E) => { let c = 0; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if ((E[i][0] - E[j][0]) * (E[i][1] - E[j][1]) < 0) c++; return c; };
    let best = null;
    perms(skills).forEach((sk) => {
      const sx = {};
      sk.forEach((s, i) => { sx[s] = i / (sk.length - 1); });
      const groups = GROUPS.map((g) => window.TOOLS.filter((t) => g.groups.includes(t.group)).map((t, k) => {
        const own = sk.filter((s) => (ST[s] || []).includes(t.name));
        return { n: t.name, k, b: own.reduce((a, s) => a + sx[s], 0) / Math.max(1, own.length) };
      }).sort((a, b) => a.b - b.b || a.k - b.k).map((o) => o.n));
      const flat = groups.flat(), tx = {};
      flat.forEach((n, i) => { tx[n] = i / (flat.length - 1); });
      const E1 = [], E2 = [];
      jobs.forEach((j, i) => (JS[j] || []).forEach((s) => E1.push([i / Math.max(1, jobs.length - 1), sx[s]])));
      sk.forEach((s) => (ST[s] || []).forEach((t) => E2.push([sx[s], tx[t]])));
      const c = cross(E1) + cross(E2);
      if (!best || c < best.c) best = { c, skills: sk, groups };
    });
    return best;
  }
  const low = (s) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
  // "a, b and c"; with a serial comma when an item already holds "and" ("web and apps, and AI agents")
  const list = (a) => {
    if (a.length < 2) return a.join('');
    const inner = a.some((x) => / and /.test(x));
    return a.slice(0, -1).join(', ') + (inner ? ', and ' : ' and ') + a[a.length - 1];
  };

  function mount(main, h) {
    const JS = SITE.jobSkills || {}, ST = SITE.skillTools || {};
    const jobs = SITE.experience;
    const desc = Object.fromEntries(SITE.skills);
    const ar = arrange(jobs.map((j) => j.at), SITE.skills.map(([s]) => s), JS, ST);
    const hint = () => (HOVER.matches ? 'Point at a job, a skill or a tool to follow its wires.' : 'Tap a job, a skill or a tool to follow its wires.');

    main.innerHTML = `
      <section class="page about cb" aria-labelledby="aboutTitle">
        <h1 class="sr" id="aboutTitle">About Martin Gerspach</h1>
        <div class="cb__head">
          <div class="cb__intro">
            <p class="cb__say rise" style="--k:1">${esc(SITE.intro)}</p>
            <a class="btn btn--accent rise" style="--k:2" href="#contact">Get in touch ${h.ico('arrow')}</a>
          </div>
          <p class="cb__read rise" style="--k:3" aria-live="polite"><span class="is-hint">${hint()}</span></p>
        </div>
        <div class="cb__loom">
          <svg class="cb__wires" aria-hidden="true"><g class="cb__w"></g><g class="cb__bus"></g></svg>
          <div class="cb__row cb__row--jobs">
            <h2>Where</h2>
            <ul>${jobs.map((j) => `<li><button class="cb__node" type="button" aria-pressed="false" data-k="job:${esc(j.at)}"><b>${nw(j.at)}</b><span>${nw(j.role)}, ${esc(j.when)}</span></button></li>`).join('')}</ul>
          </div>
          <div class="cb__row cb__row--skills">
            <h2>What I do</h2>
            <ul>${ar.skills.map((s) => `<li><button class="cb__node" type="button" aria-pressed="false" data-k="skill:${esc(s)}"><b>${esc(s)}</b><span>${nw(desc[s])}</span></button></li>`).join('')}</ul>
          </div>
          <div class="cb__row cb__row--tools">
            <h2>Tools</h2>
            <div class="cb__tools">
              ${GROUPS.map((g, i) => `<div class="cb__grp" role="group" aria-label="${g.label}"><ul class="cb__glist">${ar.groups[i].map((n) => `<li class="cb__tool">${tile(n)}<span class="cb__tname" aria-hidden="true">${esc(n)}</span></li>`).join('')}</ul><span class="cb__glabel" aria-hidden="true">${g.label}</span></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="cb__foot">
          <div><h2>About</h2>${SITE.bio.map((b, i) => `<p${i ? ' class="muted"' : ''}>${nw(b)}</p>`).join('')}</div>
          <div><h2>Education</h2><ul class="cb__list">${SITE.education.map((x) => `<li><b>${esc(x.at)}</b><time>${esc(x.when)}</time></li>`).join('')}</ul><h2>Languages</h2><p>${esc(SITE.languages)}</p></div>
          <div>
            <h2>Elsewhere</h2>
            <ul class="links">
              ${SITE.links.map((l) => `<li><a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${h.ico('arrow')}</a></li>`).join('')}
              <li class="mail"><span class="mail__addr">${esc(SITE.email)}</span><button class="copy" type="button" data-copy>${h.ico('copy')}Copy</button></li>
            </ul>
          </div>
        </div>
      </section>`;
    $$('[data-copy]', main).forEach((b) => b.addEventListener('click', h.copyEmail));

    const loom = $('.cb__loom', main), svg = $('.cb__wires', main), gw = $('.cb__w', main), gb = $('.cb__bus', main);
    const node = {};
    $$('[data-k]', main).forEach((n) => { node[n.dataset.k] = n; });
    $$('.cb__t', main).forEach((t) => { t.dataset.k = 'tool:' + t.dataset.tool; node[t.dataset.k] = t; });

    /* edges, upper end first; level 1 = job -> skill, level 2 = skill -> tool */
    const edges = [];
    jobs.forEach((j) => (JS[j.at] || []).forEach((s) => edges.push({ a: 'job:' + j.at, b: 'skill:' + s, lv: 1 })));
    ar.skills.forEach((s) => (ST[s] || []).forEach((t) => edges.push({ a: 'skill:' + s, b: 'tool:' + t, lv: 2 })));
    edges.forEach((e) => { e.p = document.createElementNS(NS, 'path'); e.p.setAttribute('pathLength', '1'); gw.appendChild(e.p); });
    let buses = [];
    let W = 1;

    /* ---------- geometry: wires spread along each node's edge in the order of where they go ---------- */
    function layout() {
      const v = PHONE.matches;
      loom.classList.toggle('is-v', v);
      const L = loom.getBoundingClientRect();
      if (!L.width) return;
      W = L.width;
      svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
      svg.setAttribute('width', L.width);
      svg.setAttribute('height', L.height);
      const box = {};
      Object.entries(node).forEach(([k, n]) => {
        const r = n.getBoundingClientRect();
        const b = { l: r.left - L.left, r: r.right - L.left, t: r.top - L.top, b: r.bottom - L.top, w: r.width, h: r.height, tool: k.startsWith('tool:') };
        b.cx = (b.l + b.r) / 2; b.cy = (b.t + b.b) / 2;
        box[k] = b;
      });
      const sides = {};
      const push = (key, it) => { (sides[key] = sides[key] || []).push(it); };
      edges.forEach((e) => {
        e.off = v && e.lv === 1;
        if (e.off) { e.p.setAttribute('d', ''); return; }
        push(e.a + '|' + (v ? 'r' : 'b'), { e, end: 'pa', o: v ? box[e.b].cy : box[e.b].cx });
        push(e.b + '|' + (v ? 'l' : 't'), { e, end: 'pb', o: v ? box[e.a].cy : box[e.a].cx });
      });
      // sockets are kept from one layout to the next (a late font load must not restart their entrance)
      const keep = new Map(buses.map((b) => [b.dataset.side, b]));
      buses = [];
      Object.entries(sides).forEach(([ks, its]) => {
        const [k, side] = ks.split('|');
        const b = box[k], n = its.length, flat = side === 't' || side === 'b';
        its.sort((p, q) => p.o - q.o);
        const span = Math.min((flat ? b.w : b.h) * (b.tool ? .5 : .56), (n - 1) * (b.tool ? 6 : 9));
        const c = flat ? b.cx : b.cy;
        const off = b.tool ? 9 : 10;
        const fix = side === 'b' ? b.b + off : side === 't' ? b.t - off : side === 'r' ? b.r + off : b.l - off;
        its.forEach((it, i) => {
          const pos = c + (n > 1 ? -span / 2 + (span * i) / (n - 1) : 0);
          it.e[it.end] = flat ? [pos, fix] : [fix, pos];
        });
        // the socket: a short bar the wires leave from
        const half = Math.max(span / 2, 4);
        const ln = keep.get(ks) || document.createElementNS(NS, 'line');
        keep.delete(ks);
        ln.dataset.side = ks;
        ln.dataset.k = k;
        if (flat) { ln.setAttribute('x1', c - half); ln.setAttribute('x2', c + half); ln.setAttribute('y1', fix); ln.setAttribute('y2', fix); }
        else { ln.setAttribute('y1', c - half); ln.setAttribute('y2', c + half); ln.setAttribute('x1', fix); ln.setAttribute('x2', fix); }
        if (!ln.parentNode) gb.appendChild(ln);
        buses.push(ln);
      });
      keep.forEach((ln) => ln.remove());
      edges.forEach((e) => {
        if (e.off) return;
        const [x1, y1] = e.pa, [x2, y2] = e.pb;
        e.p.setAttribute('d', v
          ? `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + (x2 - x1) * .5).toFixed(1)} ${y1.toFixed(1)} ${(x2 - (x2 - x1) * .5).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
          : `M${x1.toFixed(1)} ${y1.toFixed(1)}C${x1.toFixed(1)} ${(y1 + (y2 - y1) * .55).toFixed(1)} ${x2.toFixed(1)} ${(y2 - (y2 - y1) * .55).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      });
      paint();
    }

    /* ---------- what goes with a key, and how it is said ---------- */
    const skillsOf = (job) => JS[job] || [];
    function reach(k) {
      const i = k.indexOf(':'), type = k.slice(0, i), name = k.slice(i + 1);
      const all = ar.groups.flat();
      let J = [], S = [], T = [];
      if (type === 'job') { J = [name]; S = ar.skills.filter((s) => skillsOf(name).includes(s)); T = all.filter((t) => S.some((s) => (ST[s] || []).includes(t))); }
      if (type === 'skill') { S = [name]; J = jobs.map((j) => j.at).filter((j) => skillsOf(j).includes(name)); T = all.filter((t) => (ST[name] || []).includes(t)); }
      if (type === 'tool') { T = [name]; S = ar.skills.filter((s) => (ST[s] || []).includes(name)); J = jobs.map((j) => j.at).filter((j) => skillsOf(j).some((s) => S.includes(s))); }
      const keys = new Set([...J.map((x) => 'job:' + x), ...S.map((x) => 'skill:' + x), ...T.map((x) => 'tool:' + x)]);
      const on = new Set(edges.filter((e) => {
        if (!keys.has(e.a) || !keys.has(e.b)) return false;
        if (type === 'tool' && e.lv === 2) return e.b === k;
        if (type === 'job' && e.lv === 1) return e.a === k;
        return true;
      }));
      return { type, name, J, S, T, keys, on };
    }
    function sentence(r) {
      if (r.type === 'job') { const j = jobs.find((x) => x.at === r.name); return `At ${j.at}, ${j.when}: ${list(r.S.map(low))}.`; }
      if (r.type === 'skill') return `${r.name} with ${list(r.T)}${r.J.length ? `, at ${list(r.J)}` : ''}.`;
      // a tool is tied to skills only: which job it served is not in the CV, so it is not said
      return `${r.name}, for ${list(r.S.map(low))}.`;
    }

    const read = $('.cb__read', main);
    let said = hint();
    function say(t, isHint) {
      if (t === said) return;
      said = t;
      const n = document.createElement('span');
      n.textContent = t;
      if (isHint) n.className = 'is-hint';
      if (RM.matches || !read.lastElementChild) { read.replaceChildren(n); return; }
      [...read.children].forEach((c) => c.classList.add('is-out'));
      n.classList.add('is-in');
      read.append(n);
      n.getBoundingClientRect();
      n.classList.remove('is-in');
      setTimeout(() => { [...read.children].forEach((c) => { if (c !== read.lastElementChild) c.remove(); }); }, 320);
    }

    /* ---------- state ---------- */
    let shown = null, pinned = null, R = null;
    function paint() {
      loom.classList.toggle('is-focus', !!shown);
      Object.entries(node).forEach(([key, n]) => {
        if (key.startsWith('tool:')) return;
        n.classList.toggle('is-lit', !!R && R.keys.has(key));
        n.classList.toggle('is-off', !!R && !R.keys.has(key));
      });
      $$('.cb__tool', loom).forEach((li) => {
        const off = !!R && !R.keys.has('tool:' + $('.tool', li).dataset.tool);
        li.classList.toggle('is-off', off);
        $('.tool', li).classList.toggle('is-dim', off);
      });
      edges.forEach((e) => {
        const on = !!R && R.on.has(e);
        e.p.classList.toggle('is-on', on);
        e.p.classList.toggle('is-near', on && (e.a === shown || e.b === shown));
      });
      buses.forEach((b) => {
        b.classList.toggle('is-on', !!R && R.keys.has(b.dataset.k));
        b.classList.toggle('is-near', b.dataset.k === shown);
      });
    }
    const rank = { job: 0, skill: 1, tool: 2 };
    function show(k) {
      if (k === shown) return;
      const before = new Set(R ? R.on : []);
      shown = k;
      R = k ? reach(k) : null;
      paint();
      say(R ? sentence(R) : hint(), !R);
      if (!R || RM.matches) return;
      // newly lit wires are drawn away from the node in focus
      R.on.forEach((e) => {
        if (before.has(e) || e.off) return;
        const below = rank[R.type] > rank[e.a.slice(0, e.a.indexOf(':'))];
        e.p.animate([{ strokeDasharray: '1 1', strokeDashoffset: below ? -1 : 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }],
          { duration: 560, delay: e.a === k || e.b === k ? 0 : 120, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      });
    }

    /* jobs and skills: hover previews, click pins, Escape lets go */
    const buttons = $$('.cb__node', main);
    const pin = (k) => { pinned = k; buttons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.k === pinned))); };
    buttons.forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(k); });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(pinned); });
      b.addEventListener('focus', () => show(k));
      b.addEventListener('blur', () => show(pinned));
      b.addEventListener('click', () => { pin(pinned === k ? null : k); shown = undefined; show(pinned || k); });
    });
    const onKey = (e) => { if (e.key === 'Escape' && pinned) { pin(null); show(null); } };
    document.addEventListener('keydown', onKey);
    const unbind = bindTools($('.cb__tools', main), { quiet: () => PHONE.matches, enter: (n) => show('tool:' + n), leave: () => show(pinned) });

    /* ---------- entrance ----------
       Arriving by a page change, the sheet brings the texts and the marks: the wires wait under it and draw
       themselves once it has landed (mg:reveal). Arriving directly, the whole graph draws itself, after the
       intro if one is playing. Nothing moves under reduced motion. */
    const ease = 'cubic-bezier(.22,1,.36,1)';
    function entrance(full) {
      loom.classList.remove('is-pre');
      if (RM.matches || loom.getBoundingClientRect().top > innerHeight * .8) return;
      if (full) {
        const fade = (n, delay, y = 10) => n.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 700, delay, easing: ease, fill: 'backwards' });
        $$('.cb__row--jobs .cb__node', main).forEach((n, i) => fade(n, 60 + i * 70));
        $$('.cb__row--skills .cb__node', main).forEach((n, i) => fade(n, 380 + i * 55));
        $$('.cb__glabel', main).forEach((n, i) => fade(n, 1150 + i * 120, 6));
        $$('.cb__t', main).forEach((n, i) => n.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 900 + i * 28, easing: ease, fill: 'backwards' }));
      }
      const t0 = full ? 0 : -120;
      edges.forEach((e) => {
        if (e.off) return;
        const x = e.pa[0] / Math.max(1, W);
        e.p.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }],
          { duration: 900, delay: t0 + (e.lv === 1 ? 180 : 620) + x * (e.lv === 1 ? 260 : 420), easing: ease, fill: 'backwards' });
      });
      buses.forEach((b) => b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: t0 + (b.dataset.k.startsWith('job:') ? 160 : b.dataset.k.startsWith('skill:') ? 520 : 1000), fill: 'backwards' }));
    }
    let onReveal = null, waitObs = null, revealTimer = 0;
    layout();
    if (!RM.matches) {
      if (main.classList.contains('tr-own')) {
        loom.classList.add('is-pre');
        onReveal = () => { clearTimeout(revealTimer); document.removeEventListener('mg:reveal', onReveal); onReveal = null; entrance(false); };
        document.addEventListener('mg:reveal', onReveal);
        revealTimer = setTimeout(() => onReveal && onReveal(), 4000);   // never left without its wires
      } else if (main.classList.contains('is-waiting')) {
        loom.classList.add('is-pre');
        waitObs = new MutationObserver(() => { if (!main.classList.contains('is-waiting')) { waitObs.disconnect(); waitObs = null; entrance(true); } });
        waitObs.observe(main, { attributes: true, attributeFilter: ['class'] });
      } else entrance(true);
    }

    const ro = new ResizeObserver(() => layout());
    ro.observe(loom);
    if (document.fonts) document.fonts.ready.then(() => { if (loom.isConnected) layout(); });
    PHONE.addEventListener('change', layout);
    return () => {
      ro.disconnect();
      unbind();
      document.removeEventListener('keydown', onKey);
      PHONE.removeEventListener('change', layout);
      if (onReveal) document.removeEventListener('mg:reveal', onReveal);
      clearTimeout(revealTimer);
      if (waitObs) waitObs.disconnect();
    };
  }

  window.AboutPage = { mount };
})();
