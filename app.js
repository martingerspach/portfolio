/* Martin Gerspach, portfolio: router, chrome, the reel stage, page changes and pages. */
(function () {
  'use strict';

  /* ---------- Small tools ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-6) break; const s = dX(t); if (Math.abs(s) < 1e-6) break; t -= d / s; }
      return Y(clamp(t, 0, 1));
    };
  }
  const EASE_OUT = bezier(0.16, 1, 0.3, 1);

  const html = document.documentElement;
  const main = $('#main');
  const P = window.PROJECTS;
  const SITE = window.SITE;
  const F = 1;                       // frames per project on the reel
  const GATE = (F - 1) / 2;          // which of a project's frames faces us
  const NP = P.length;
  const NF = NP * F;
  const OMEGA = 10.5;                // the reel's spring (rad/s), critically damped: settles in about 0.6 s
  const SHUTTER = 1 / 70;            // motion blur: the strip's travel during this time, in frames
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let REDUCE = mqReduce.matches;
  mqReduce.addEventListener('change', (e) => { REDUCE = e.matches; });
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');

  const ICONS = {
    arrow: '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
    back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    prev: '<path d="m15 6-6 6 6 6"/>',
    next: '<path d="m9 6 6 6-6 6"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  };
  const ico = (n, cls = 'ico') => `<svg class="${cls}${n === 'arrow' ? ' go' : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('is-on'), 2200);
  }
  async function copyEmail() {
    try { await navigator.clipboard.writeText(SITE.email); toast('Email address copied'); }
    catch (e) {
      const el = $('.mail__addr');
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast('Address selected: press Ctrl+C to copy');
    }
  }

  /* A giant line (words and a circle) set to the exact width available. */
  function fitRow(row, max = 300) {
    const run = () => {
      if (!row.isConnected) return;
      // measured small, where the line cannot overflow (a centred overflow hides half of its width)
      row.style.setProperty('--fs', '10px');
      const natural = row.getBoundingClientRect().width;
      const cs = getComputedStyle(row.parentElement);
      const avail = row.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (natural > 0 && avail > 0) row.style.setProperty('--fs', Math.min(max, (10 * avail) / natural - 0.05).toFixed(2) + 'px');
    };
    run();
    if (document.fonts) document.fonts.ready.then(run);
    addEventListener('resize', run);
    return () => removeEventListener('resize', run);
  }

  /* ---------- Theme ---------- */
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => html.getAttribute('data-theme') === 'dark';   // light unless the visitor chose dark
  function paintThemeUI() {
    const dark = isDark();
    $('#themeLabel').textContent = dark ? 'Light' : 'Dark';
    $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to the light theme' : 'Switch to the dark theme');
    $('#themeBtn svg').innerHTML = dark ? ICONS.sun : ICONS.moon;
    $$('[data-theme-label]').forEach((e) => { e.textContent = dark ? 'Light theme' : 'Dark theme'; });
  }
  function setTheme(t) {
    html.setAttribute('data-theme', t);
    try { localStorage.setItem('mg-theme', t); } catch (e) { /* the choice lasts this visit only */ }
  }
  const hex = (h) => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  function readTheme() {
    const cs = getComputedStyle(html);
    return { bg: hex(cs.getPropertyValue('--bg')), ink: hex(cs.getPropertyValue('--ink')), tile: hex(cs.getPropertyValue('--tile')), dark: isDark() ? 1 : 0 };
  }
  const onTheme = () => { paintThemeUI(); document.dispatchEvent(new CustomEvent('mg:theme')); };
  $('#themeBtn').addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));
  $$('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark')));
  mqDark.addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  paintThemeUI();

  /* ---------- Clock (Metz) ---------- */
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.tz, hour: '2-digit', minute: '2-digit', hour12: false });
  function tick() {
    const t = fmt.format(new Date());
    $$('#clock, [data-clock]').forEach((e) => { e.textContent = t; });
  }
  tick();
  setInterval(tick, 10000);

  /* ---------- Navigation chrome ---------- */
  const navLine = $('#navLine');
  function markNav(name) {
    const key = name === 'project' ? 'work' : name;
    $$('[data-nav]').forEach((a) => {
      if (a.classList.contains('brand') || a.classList.contains('pv-back')) return;
      a.toggleAttribute('aria-current', a.dataset.nav === key);
      if (a.dataset.nav === key) a.setAttribute('aria-current', 'page');
    });
    placeLine();
  }
  let lineLost = false;
  function placeLine() {
    const a = $('#nav a[aria-current="page"]');
    if (!a) { navLine.style.opacity = 0; return; }
    // a hidden nav (phone width, a resize across 760 px) has no size: keep the line, and when the nav comes back put
    // it in place at once rather than sweeping it in from the left edge
    if (!a.offsetWidth) { lineLost = true; return; }
    const x = a.offsetLeft + 14, w = a.offsetWidth - 28;
    navLine.style.opacity = 1;
    if (lineLost) { lineLost = false; navLine.style.transition = 'none'; }
    navLine.style.transform = `translateX(${x}px) scaleX(${w})`;
    if (navLine.style.transition) { navLine.getBoundingClientRect(); navLine.style.transition = ''; }
  }
  addEventListener('resize', placeLine);
  document.fonts && document.fonts.ready.then(placeLine);

  const menu = $('#menu'), menuBtn = $('#menuBtn');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('is-locked', open);
  }
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));

  /* ---------- Router ---------- */
  const PAGES = {
    work: { label: 'Work', n: '01' },
    playground: { label: 'Playground', n: '02' },
    about: { label: 'About', n: '03' },
    contact: { label: 'Contact', n: '04' },
  };
  function routeOf(token) {
    token = String(token || '').replace(/^#/, '');
    if (PAGES[token]) return { name: token, token };
    const p = P.find((x) => x.id === token);
    if (p) return { name: 'project', token, p, tab: 'site' };
    // the Méthode film lives inside Topiary, as its motion design tab
    if (token === 'methode') { const t = P.find((x) => x.film); if (t) return { name: 'project', token, p: t, tab: 'film' }; }
    return { name: 'work', token: 'work' };
  }
  const isRoute = (token) => routeOf(token).token === token;
  let current = null;
  let viewer = null;                 // the open project view: { p, ready, setTab }
  let teardown = null;
  let busy = false;

  function setHash(token, replace) {
    try {
      if (replace) history.replaceState(null, '', '#' + token);
      else history.pushState(null, '', '#' + token);
    } catch (e) { /* the frame may refuse history changes: the page still works */ }
  }

  function mount(r, opts = {}) {
    if (teardown) { teardown(); teardown = null; }
    closeLightbox(true);
    current = r;
    viewer = null;
    markNav(r.name);
    html.classList.toggle('on-work', r.name === 'work');
    html.classList.toggle('on-project', r.name === 'project');
    html.classList.toggle('on-play', r.name === 'playground');
    if (opts.via !== 'tr') main.classList.remove('tr-done', 'tr-own');   // a page mounted without a page change plays its own entrance
    if (r.name !== 'work') { window.scrollTo(0, 0); }
    if (r.name === 'work') teardown = renderWork(opts);
    else if (r.name === 'project') teardown = renderViewer(r.p, { ...opts, tab: r.tab });
    else if (r.name === 'playground') teardown = renderPlayground(opts);
    else if (r.name === 'about') teardown = renderAbout(opts);
    else if (r.name === 'contact') teardown = renderContact(opts);
    if (opts.focus !== false) main.focus({ preventScroll: true });
  }

  /* Phones: a project opens as its own page. Inside the portfolio (a live landing in a frame, over a fixed page that
     keeps the reel's WebGL), Safari on iPhone dropped the layers and showed a white screen while the landing
     scrolled. As a page of its own the landing scrolls natively; the phone's Back returns to Work, on the same
     project of the reel (sessionStorage mg-reel). Larger screens keep the project view. */
  const PHONE_PAGES = matchMedia('(max-width: 760px) and (pointer: coarse)');
  function openAsPage(r) {
    try { sessionStorage.setItem('mg-reel', String(P.indexOf(r.p))); } catch (e) { /* the reel starts on the first project */ }
    const url = new URL(r.tab === 'film' ? 'topiary/methode.html' : r.p.site, location.href).href;
    busy = true;
    [main, $('#reel')].forEach((el) => { el.style.transition = 'opacity .2s linear'; el.style.opacity = 0; });
    setTimeout(() => location.assign(url), REDUCE ? 0 : 200);
  }
  // back from the landing, the browser may show this page as it was left (back-forward cache): show it again
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    [main, $('#reel')].forEach((el) => { el.style.transition = ''; el.style.opacity = ''; });
    busy = false;
  });

  let pendingPop = false;
  async function navigate(token, opts = {}) {
    const r = routeOf(token);
    // the browser's back and forward during a page change are played once it ends (the address already moved)
    if (busy) { if (opts.pop) pendingPop = true; return; }
    setMenu(false);
    if (r.name === 'project' && PHONE_PAGES.matches) { openAsPage(r); return; }
    // Topiary's two tabs (its site, its film) are one project: switch in place
    if (viewer && r.name === 'project' && r.p === viewer.p) {
      if (!opts.pop) setHash(r.token, opts.replace);
      current = r;
      viewer.setTab(r.tab);
      return;
    }
    if (current && r.token === current.token && r.name !== 'work') { window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); return; }
    if (current && r.name === 'work' && current.name === 'work') return;
    if (!opts.pop) setHash(r.token, opts.replace);
    if (REDUCE) {
      busy = true;
      main.style.transition = 'opacity .18s linear';
      main.style.opacity = 0;
      await sleep(180);
      mount(r, { from: current && current.name });
      main.style.opacity = 1;
      await sleep(180);
      main.style.transition = '';
      busy = false;
      afterChange();
      return;
    }
    // every page change is one of transitions.js; from one project to another, it follows the way we go
    // (the arrow pressed, else the shorter way round the reel)
    const from = current;
    let dir = opts.dir || 0;
    if (!dir && from && from.name === 'project' && r.name === 'project') dir = shortestP(P.indexOf(r.p) - P.indexOf(from.p)) >= 0 ? 1 : -1;
    busy = true;
    try {
      await window.TR.go({ from, to: r, origin: opts.origin || null, dir, mount: () => mount(r, { from: from && from.name, via: 'tr' }) });
    } finally {
      busy = false;
      document.dispatchEvent(new CustomEvent('mg:reveal'));
      afterChange();
    }
  }
  function afterChange() {
    if (!pendingPop) return;
    pendingPop = false;
    if (routeOf(location.hash).token !== (current && current.token)) navigate(location.hash, { pop: true });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-skip')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const token = a.getAttribute('href').slice(1);
    if (!isRoute(token)) return;
    e.preventDefault();
    if (a.dataset.open !== undefined && current && current.name === 'work') return workOpen(P.findIndex((p) => p.id === token), a);
    if (a.classList.contains('brand') && current && current.name === 'work') return replayIntro();
    // the project bar's arrows set the way the next project comes in
    const dir = a.classList.contains('pv-arrow') ? (/^Next/.test(a.getAttribute('aria-label') || '') ? 1 : -1) : 0;
    navigate(token, { origin: a, dir });
  });
  addEventListener('popstate', () => navigate(location.hash, { pop: true }));
  $('[data-skip]').addEventListener('click', (e) => { e.preventDefault(); main.focus(); });

  /* ---------- The reel (shared across visits) ---------- */
  let reel = null, reelFailed = false;
  function getReel() {
    if (reel || reelFailed) return reel;
    try { reel = new window.Reel($('#reel'), P.flatMap((p) => p.frames)); }
    catch (e) { reelFailed = true; console.warn('Reel unavailable:', e.message); }
    if (reel) { const t = readTheme(); themeNow = t; reel.setTheme(t); }
    return reel;
  }
  let themeNow = null;
  const W = { rest: 0, eased: 0, vel: 0, target: 0, first: true };   // reel state, kept between visits
  let entranceInit = null;                 // the reel's entrance as the opening wants it (__APP.setEntrance)
  const HELD = { reel: false, e: null };   // a page change draws the reel itself (e: its position, for the texts)
  const wrapP = (i) => ((i % NP) + NP) % NP;
  const shortestP = (v) => { const m = ((v % NP) + NP) % NP; return m >= NP / 2 ? m - NP : m; };
  let workOpen = () => {};
  let lastTap = null;                      // where the last press on the reel was (a project opens from there)

  /* The reel's place on screen for the current window (the work page and the page changes share it). */
  function reelGeom() {
    const vw = html.clientWidth, vh = innerHeight;
    const mode = vw <= 760 ? 'phone' : vw <= 1100 ? 'mid' : 'wide';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let cx, cy, Rr, fade, STEP, SP;
    // the radius sets the size of the frame in the gate (about R high, 4R/3 wide)
    if (mode === 'phone') {
      cx = vw / 2; cy = vh * 0.37;
      Rr = clamp(vw * 0.45, 120, 236);
      fade = [vh * 0.07, vh * 0.17, vh * 0.5, vh * 0.6];
      STEP = clamp(vh * 0.2, 130, 190);
      SP = 1;
    } else if (mode === 'mid') {
      const listW = 300 + 48;
      cx = (vw - listW) / 2 + 12; cy = vh / 2;
      Rr = clamp(Math.min(cx - 40, vh * 0.36), 140, 340);
      // the strip is gone before the counter (bottom left, about 140 px high), the frame in the gate stays whole
      let f3 = Math.min(vh * 0.95, vh - 140), f2 = Math.max(Math.min(vh * 0.78, f3 - vh * 0.15), cy + Rr * 0.62);
      f3 = Math.max(f3, f2 + 40);
      fade = [vh * 0.07, vh * 0.24, f2, f3];
      STEP = clamp(vh * 0.24, 160, 260);
      SP = clamp(vh * 0.25, 140, 168);   // a short window brings the neighbours closer, clear of the button
    } else {
      cx = vw / 2; cy = vh / 2;
      Rr = clamp(Math.min(cx - 300, vw - 380 - cx, vh * 0.385) - 14, 180, 440);
      fade = [vh * 0.07, vh * 0.25, vh * 0.78, vh * 0.95];
      STEP = clamp(vh * 0.24, 170, 270);
      SP = clamp(vh * 0.25, 140, 176);
    }
    return { vw, vh, mode, dpr, cx, cy, R: Rr, fade, STEP, SP };
  }

  function renderWork(opts) {
    main.innerHTML = `
      <section class="work" aria-labelledby="workTitle">
        <h1 class="sr" id="workTitle">Selected work</h1>
        <div class="work__spacer" id="spacer"></div>
        <div class="stage" id="stage">
          <dl class="w-meta" id="wMeta" aria-hidden="true">
            ${[['Role', (p) => esc(p.role)], ['Year', (p) => esc(p.year)],
               ['Scope', (p) => p.scope.map((s) => `<span>${esc(s)}</span>`).join('')],
               ['Tools', (p) => p.tools.map((s) => `<span>${esc(s)}</span>`).join('')]].map(([k, v]) => `
              <div class="w-meta__row"><dt>${k}</dt><dd>${P.map((p) => `<span class="w-val">${v(p)}</span>`).join('')}</dd></div>`).join('')}
          </dl>
          <ol class="w-list" id="wList">
            ${P.map((p, i) => `
              <li class="w-item" data-i="${i}">
                <a href="#${p.id}" data-open>
                  <span class="w-cat">${esc(p.kind)}</span>
                  <span class="w-title">${esc(p.name)}</span>
                  <span class="w-more"><span class="w-rule" aria-hidden="true"></span><span class="w-desc">${esc(p.short)}</span></span>
                </a>
              </li>`).join('')}
          </ol>
          <div class="w-count" aria-hidden="true">
            <span class="w-count__lab">Selected work</span>
            <span class="w-count__num" id="wNum"><span>01</span><span>02</span></span>
            <span class="w-count__tot">/ ${pad2(NP)}</span>
          </div>
          <p class="w-hint" id="wHint" style="opacity:${W.first ? 1 : 0}"><i aria-hidden="true"></i>Scroll to turn the reel</p>
          <div class="w-cta">
            <a class="btn btn--line w-open" id="wOpen" href="#${P[0].id}" data-open><span id="wOpenLab">View ${esc(P[0].name)}</span></a>
            <a class="btn btn--accent" href="#contact">Get in touch ${ico('arrow')}</a>
          </div>
        </div>
      </section>`;

    const R = getReel();
    const spacer = $('#spacer'), meta = $('#wMeta'), numEl = $('#wNum'), hint = $('#wHint'), openBtn = $('#wOpen');
    const items = $$('.w-item');
    const canvas = $('#reel');
    const tag = $('#cursorTag');
    let vw = 0, vh = 0, STEP = 200, MID = 0, LOOP = 0, SP = 170, mode = 'wide';
    let raf = 0, snapT = 0, liveT = 0, last = performance.now();
    let shown = -1, lastPos = NaN, lastState = '';
    let entrance = null;
    let frozen = false;
    let themeFrom = null, themeTo = null, themeT0 = 0;
    const cache = items.map(() => ({ y: NaN, o: NaN, f: NaN, g: NaN }));
    // the meta column: one stack of values per row (one value per project), under labels that never move
    const vals = $$('.w-meta__row', meta).map((row) => $$('.w-val', row).map((el) => ({ el, o: NaN, y: NaN })));
    const nums = $$('span', numEl), openLab = $('#wOpenLab');
    let numK = NaN, numY = NaN, hintO = W.first ? 1 : 0, hint0 = NaN;

    function measure() {
      const g = reelGeom();
      vw = g.vw; vh = g.vh; mode = g.mode; STEP = g.STEP; SP = g.SP;
      if (R) R.layout({ vw, vh, cx: g.cx, cy: g.cy, R: g.R, fade: g.fade, dpr: g.dpr });
      LOOP = NP * STEP;
      MID = LOOP * 6;
      spacer.style.height = Math.round(LOOP * 12 + vh) + 'px';
    }

    // The page scrolls natively; the reel follows the scroll on a critically damped spring. When the page comes
    // to rest, the scroll is set on the nearest project at once and the spring carries the reel there, so every
    // move is one continuous curve, whatever the input.
    function jump(top) {
      if (Math.abs(window.scrollY - top) > 0.5) window.scrollTo({ top, behavior: 'instant' });
    }
    function settleScroll() {
      jump(MID + W.rest * STEP);
      W.target = (window.scrollY - MID) / STEP;
    }

    function onScroll() {
      if (frozen) return;
      const y = window.scrollY;
      W.target = (y - MID) / STEP;
      if (W.first && Math.abs(y - (MID + W.rest * STEP)) > 24) { W.first = false; hint.classList.add('is-gone'); }
      clearTimeout(snapT);
      snapT = setTimeout(snap, REDUCE ? 60 : 150);
    }
    // A mouse wheel moves in notches: each notch is one project, however fast they come, and the reel heads
    // for it from the first notch instead of following the page's partial scroll.
    let notches = 0, aim = null;
    function onWheel(e) {
      if (frozen || e.ctrlKey) return;
      const notch = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (notch && e.deltaY) { notches += Math.sign(e.deltaY); aim = W.rest + notches; }
      else { notches = 0; aim = null; }
    }
    function snap() {
      if (frozen || dragging) return;
      const y = window.scrollY;
      const d = (y - (MID + W.rest * STEP)) / STEP;
      const ad = Math.abs(d);
      if (notches) W.rest += notches;                   // mouse: one project per notch, from the last aim
      else if (ad >= 0.1) W.rest += Math.sign(d) * Math.max(1, Math.floor(ad + 0.6));   // trackpad, touch, drag
      notches = 0; aim = null;
      if (Math.abs(W.rest) >= NP * 2) {
        // far from the middle: jump back whole loops. The strip repeats every loop, so nothing moves.
        const n = Math.round(W.rest / NP) * NP;
        W.rest -= n; W.eased -= n; lastE -= n;
      }
      W.target = W.rest;
      jump(MID + W.rest * STEP);
      clearTimeout(liveT);
      liveT = setTimeout(() => {
        const p = P[wrapP(W.rest)];
        $('#live').textContent = `${p.name}, ${p.kind}. Project ${wrapP(W.rest) + 1} of ${NP}.`;
      }, 500);
    }
    function stepTo(i) {
      W.rest = i; W.target = i; aim = null;
      if (W.first) { W.first = false; hint.classList.add('is-gone'); }
      jump(MID + W.rest * STEP);
    }
    const goTo = (j) => stepTo(W.rest + shortestP(j - wrapP(W.rest)));

    /* Touch screens: the page itself does not scroll (scrolling it made the browser's address bar slide away, the
       window grow and the reel jump in the middle of the gesture). The finger turns the reel directly, one project
       per STEP of travel as the scroll did, and a flick carries on with its speed before the reel settles on a
       project. Pinch-zoom stays (CSS: touch-action: pinch-zoom on the page, none on the reel and its stage). */
    const TOUCH = matchMedia('(pointer: coarse)').matches && !FINE.matches;
    let swipe = null;
    function onTDown(e) {
      if (e.pointerType !== 'touch' || frozen || busy || swipe) return;
      swipe = { id: e.pointerId, x0: e.clientX, y0: e.clientY, e0: W.target, moved: false, samples: [[performance.now(), W.target]] };
    }
    function onTMove(e) {
      if (!swipe || e.pointerId !== swipe.id || frozen) return;
      const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
      if (!swipe.moved && Math.hypot(dx, dy) < 10) return;
      swipe.moved = true;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      W.target = swipe.e0 - d / STEP;
      aim = null; notches = 0; clearTimeout(snapT);
      if (W.first) { W.first = false; hint.classList.add('is-gone'); }
      const now = performance.now();
      swipe.samples.push([now, W.target]);
      while (swipe.samples.length > 2 && now - swipe.samples[0][0] > 90) swipe.samples.shift();
    }
    function onTUp(e) {
      if (!swipe || e.pointerId !== swipe.id) return;
      const s = swipe;
      swipe = null;
      if (!s.moved || frozen) return;                 // a tap: the reel's own handler opens or winds to the frame
      const [t0, a] = s.samples[0], [t1, b] = s.samples[s.samples.length - 1];
      const v = t1 > t0 && performance.now() - t1 < 120 ? (b - a) / ((t1 - t0) / 1000) : 0;   // projects per second
      const glide = clamp(v * 0.22, -3, 3);
      let rest = Math.round(W.target + glide) || 0;
      if (rest === W.rest && Math.abs(W.target - W.rest) > 0.12) rest = W.rest + Math.sign(W.target - W.rest);
      W.rest = rest;
      if (Math.abs(W.rest) >= NP * 2) { const n = Math.round(W.rest / NP) * NP; W.rest -= n; W.eased -= n; W.target -= n; lastE -= n; }
      W.target = W.rest;
      jump(MID + W.rest * STEP);
      clearTimeout(liveT);
      liveT = setTimeout(() => {
        const p = P[wrapP(W.rest)];
        $('#live').textContent = `${p.name}, ${p.kind}. Project ${wrapP(W.rest) + 1} of ${NP}.`;
      }, 500);
    }

    function onKey(e) {
      if (busy || frozen || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); stepTo(W.rest + 1); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); stepTo(W.rest - 1); }
    }

    /* Every text of the page is a function of the reel's position as drawn this frame (e, in projects), on
       one clock and one curve, so nothing runs ahead of the strip or lags behind it. A project's texts fade on
       the reel's own smootherstep, over FADE of a step on each side of the gate: two projects never show their
       texts at once. While the strip runs fast (a flick through several projects), the details of the projects
       it passes stay out, as its frames blur (calm), and come back as it slows down on the last one. */
    const FADE = 0.45;
    const LAG = 0.03;          // meta rows: phase offset from one row to the next, so the column turns over in the direction of travel
    const HOLD = LAG * 1.5;    // texts stay whole this close to the gate, so every meta row is whole at rest (HOLD + FADE < 0.5)
    const DRIFT = 24;          // meta values: travel per step, in px, the way the list goes
    const ease5 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    const fadeAt = (d) => 1 - ease5(HOLD, HOLD + FADE, Math.abs(d));
    let labO = '';

    function updateList(e, calm, landed) {
      // the list: titles ride with the strip; size, weight and colour follow the distance to the gate on a bell
      for (let i = 0; i < NP; i++) {
        const dd = shortestP(i - e);
        const ad = Math.abs(dd);
        const f = (1 - ease5(0, 1, ad)).toFixed(3);
        const o = (mode === 'phone' ? fadeAt(dd) : 1 - ease5(1.15, 1.75, ad)).toFixed(3);
        const g = (mode === 'phone' ? calm : fadeAt(dd) * calm).toFixed(3);   // category, rule, description
        const c = cache[i], it = items[i];
        const y = (mode === 'phone' ? dd * 56 : dd * SP).toFixed(2);
        if (c.y !== y) {
          it.style.transform = mode === 'phone' ? `translate3d(${y}px, 0, 0)` : `translate3d(0, calc(-50% + ${y}px), 0)`;
          c.y = y;
        }
        if (c.o !== o) {
          it.style.opacity = o;
          it.style.pointerEvents = +o < 0.2 ? 'none' : '';   // still focusable: focus winds it into view
          c.o = o;
        }
        if (c.f !== f) { it.style.setProperty('--f', f); c.f = f; }
        if (c.g !== g) { it.style.setProperty('--g', g); c.g = g; }
      }
      // the meta column: values cross under fixed labels, on the same window as the list's details
      const rows = vals.length;
      for (let r = 0; r < rows; r++) {
        const lag = (r - (rows - 1) / 2) * LAG;
        for (let i = 0; i < NP; i++) {
          const x = shortestP(i - e) + lag, ax = Math.abs(x);
          const o = (fadeAt(x) * calm).toFixed(3);
          const v = vals[r][i];
          if (v.o !== o) { v.el.style.opacity = o; v.el.style.visibility = +o > 0 ? 'visible' : 'hidden'; v.o = o; }
          if (+o > 0) {
            const y = (Math.sign(x) * Math.max(0, ax - HOLD) * DRIFT).toFixed(2);
            if (v.y !== y) { v.el.style.transform = `translate3d(0, ${y}px, 0)`; v.y = y; }
          }
        }
      }
      // the counter: an odometer geared to the reel, project k leaving upward as k + 1 comes up from below
      // (the two spans take turns by parity: a number keeps its span from entering to leaving, so the one in
      // view never changes text or element)
      const k = Math.floor(e), fr = e - k;
      const na = nums[k & 1], nb = nums[(k + 1) & 1];
      if (k !== numK) {
        const ta = pad2(wrapP(k) + 1), tb = pad2(wrapP(k + 1) + 1);
        if (na.textContent !== ta) na.textContent = ta;
        if (nb.textContent !== tb) nb.textContent = tb;
        numK = k;
      }
      const ny = k + ':' + (fr * 100).toFixed(3);
      if (ny !== numY) {
        na.style.transform = `translate3d(0, ${(-fr * 100).toFixed(3)}%, 0)`;
        nb.style.transform = `translate3d(0, ${(100 - fr * 100).toFixed(3)}%, 0)`;
        numY = ny;
      }
      // the phone's button names the project in the gate: its label turns over with the titles
      const idx = wrapP(Math.round(e));
      if (idx !== shown) {
        openBtn.setAttribute('href', '#' + P[idx].id);
        openLab.textContent = 'View ' + P[idx].name;
        shown = idx;
      }
      const lo = fadeAt(e - Math.round(e)).toFixed(3);
      if (lo !== labO) { openLab.style.opacity = lo; labO = lo; }
      // the hint comes in as the reel lands, and leaves with the first turn, for good
      if (hintO > 0) {
        if (landed >= 1 && Number.isNaN(hint0)) hint0 = W.eased;
        if (!Number.isNaN(hint0)) hintO = Math.min(hintO, 1 - ease5(0, 0.35, Math.abs(W.eased - hint0)));
      }
      hint.style.opacity = (hintO * landed).toFixed(3);
    }

    function tweenTheme(now) {
      if (!themeTo) return false;
      const t = clamp((now - themeT0) / 500, 0, 1), k = EASE_OUT(t);
      const mix = (a, b) => a.map((v, j) => v + (b[j] - v) * k);
      themeNow = { bg: mix(themeFrom.bg, themeTo.bg), ink: mix(themeFrom.ink, themeTo.ink), tile: mix(themeFrom.tile, themeTo.tile), dark: themeTo.dark };
      R.setTheme(themeNow);
      if (t >= 1) themeTo = null;
      return true;
    }
    function onThemeChange() {
      if (!R) return;
      themeFrom = themeNow || readTheme();
      themeTo = readTheme();
      themeT0 = performance.now();
    }

    let lastE = NaN, speed = 0, lastBlur = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!frozen) {
        const goal = aim !== null ? aim : W.target;
        if (REDUCE || !dt) { if (REDUCE) { W.eased = goal; W.vel = 0; } }
        else {
          // exact step of a critically damped spring: no overshoot, and the speed never jumps
          const x = W.eased - goal, ex = Math.exp(-OMEGA * dt), m = (W.vel + OMEGA * x) * dt;
          W.eased = goal + (x + m) * ex;
          W.vel = (W.vel - OMEGA * m) * ex;
          if (Math.abs(W.eased - goal) < 2e-5 && Math.abs(W.vel) < 2e-3) { W.eased = goal; W.vel = 0; }
        }
      }
      let e = HELD.e !== null ? HELD.e : W.eased;
      if (entrance) {
        const t = clamp((now - entrance.t0) / entrance.dur, 0, 1);
        e -= entrance.from * (1 - EASE_OUT(t));
        if (R) R.morph.others = Math.max(entrance.o0 || 0, now < entrance.t0 ? 0 : smooth(0, 0.3, t));
        if (t >= 1) { entrance = null; if (R) R.morph.others = 1; }
      }
      // speed of the strip as drawn (spring, entrance, drag alike), lightly smoothed: it drives the motion blur
      // and a slight pull-back of the camera, which settle with the reel
      const v = dt && Number.isFinite(lastE) ? Math.abs(e - lastE) / dt : 0;
      lastE = e;
      speed += (v - speed) * (1 - Math.exp(-dt * 28));
      if (speed < 0.02) speed = 0;
      if (R && !HELD.reel) {
        R.blur = REDUCE ? 0 : Math.min(0.2, speed * F * SHUTTER);
        R.zoom = REDUCE ? 1 : 1 - 0.035 * smooth(0.6, 9, speed);
      }
      const pos = e * F + GATE;
      const th = R && tweenTheme(now);
      const blurMoved = R && Math.abs(R.blur - lastBlur) > 1e-4;
      if (R && !HELD.reel && (pos !== lastPos || R.dirty || th || entrance || blurMoved)) { R.render(pos); lastBlur = R.blur; }
      lastPos = pos;
      // the texts read the same frame: position, speed (details hold back while the strip blurs), landing
      const calm = REDUCE ? 1 : 1 - ease5(3.5, 6, speed);
      const landed = entrance ? ease5(0.5, 1, clamp((now - entrance.t0) / entrance.dur, 0, 1)) : 1;
      const st = e.toFixed(4) + mode + calm.toFixed(3) + landed.toFixed(3);
      if (st !== lastState) { updateList(e, calm, landed); lastState = st; if (pointer) hover(); }
      raf = requestAnimationFrame(frame);
    }

    /* Pointer: hover names the frame, click opens or winds, a mouse drag turns the reel. */
    let dragging = false, down = null, moved = 0;
    const curPos = () => W.eased * F + GATE;
    function projectAt(x, y) {
      if (!R) return -1;
      const fr = R.hit(x, y, curPos());
      if (fr === null) return -1;
      return Math.floor((((fr % NF) + NF) % NF) / F);
    }
    function onMove(e) {
      if (frozen) return;
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        moved = Math.max(moved, Math.hypot(e.clientX - down.x0, e.clientY - down.y0));
        if (moved > 6) {
          dragging = true;
          const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          window.scrollBy(0, -d * (STEP / 220));
          down.x = e.clientX; down.y = e.clientY;
        }
      }
      if (!FINE.matches) return;
      pointer = { x: e.clientX, y: e.clientY };
      hover();
    }
    // The label under the pointer is worked out again whenever the reel moves under a still pointer.
    let pointer = null;
    function hover() {
      if (!pointer || frozen) return;
      const j = dragging ? -1 : projectAt(pointer.x, pointer.y);
      canvas.classList.toggle('is-hover', j >= 0);
      if (j >= 0) {
        const txt = j === wrapP(Math.round(W.target)) ? `Open ${P[j].name}` : `Go to ${P[j].name}`;
        if (tag.textContent !== txt) tag.textContent = txt;
        tag.classList.add('is-on');
        tag.style.transform = `translate3d(${pointer.x + 18}px, ${pointer.y + 20}px, 0)`;
      } else tag.classList.remove('is-on');
    }
    let touch = null;
    function onDown(e) {
      if (frozen) return;
      if (e.pointerType === 'touch') { touch = { x: e.clientX, y: e.clientY, t: performance.now() }; return; }
      if (e.button !== 0) return;
      aim = null; notches = 0;
      down = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      moved = 0;
      canvas.setPointerCapture(e.pointerId);
    }
    function onUp(e) {
      lastTap = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'touch') {
        // a tap on a frame (a swipe scrolls the page and cancels the pointer instead)
        const t = touch; touch = null;
        if (!t || frozen || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10 || performance.now() - t.t > 450) return;
        const j = projectAt(e.clientX, e.clientY);
        if (j < 0) return;
        if (j === wrapP(Math.round(W.eased))) open(j); else goTo(j);
        return;
      }
      if (!down) return;
      const wasDrag = dragging;
      down = null; dragging = false;
      if (wasDrag) { snap(); return; }
      const j = projectAt(e.clientX, e.clientY);
      if (j < 0) return;
      if (j === wrapP(Math.round(W.eased)) && Math.abs(W.target - Math.round(W.target)) < 0.35) open(j);
      else goTo(j);
    }
    function onLeave() { pointer = null; tag.classList.remove('is-on'); canvas.classList.remove('is-hover'); }
    function onCancel() { touch = null; }

    items.forEach((it, i) => {
      const a = $('a', it);
      a.addEventListener('focus', () => { if (wrapP(W.rest) !== i) goTo(i); });
    });

    /* Opening a project: a curtain of squares in its brand's colours, from the point pressed (transitions.js);
       the reel holds still under it. */
    function open(j, from) {
      if (busy) return;
      clearTimeout(snapT); aim = null;
      tag.classList.remove('is-on');
      frozen = true;
      const origin = from || lastTap;
      lastTap = null;
      navigate(P[j].id, { origin }).finally(() => { frozen = false; });
    }
    workOpen = (j, from) => (j >= 0 ? (j === wrapP(Math.round(W.eased)) ? open(j, from) : goTo(j)) : null);

    measure();
    settleScroll();
    if (W.first && opts.via !== 'tr') W.eased = W.target;
    const doEntrance = !REDUCE && R && (opts.entrance || (W.first && !opts.via));
    if (opts.via === 'tr' || opts.via === 'pop') W.eased = W.target;
    const init = entranceInit;               // the opening's waiting state (__APP.setEntrance), for this mount only
    entranceInit = null;
    if (doEntrance) {
      entrance = Object.assign({ t0: performance.now() + 9e9, dur: 2100, from: 1.6, o0: 0 }, init || {});
      if (R) R.morph.others = 0;
      // the opening's promise may resolve with the entrance it hands over to: { from, dur, o0 }
      const go = (o) => { if (entrance) { if (o && typeof o === 'object') Object.assign(entrance, o); entrance.t0 = performance.now(); } };
      if (opts.entrance) opts.entrance.then(go); else go();
    }
    updateList(W.eased, 1, entrance ? 0 : 1);
    if (R) R.render(W.eased * F + 1);

    const onResize = () => { measure(); window.scrollTo(0, MID + W.rest * STEP); W.target = W.rest; lastState = ''; };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    document.addEventListener('mg:theme', onThemeChange);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onCancel);
    if (TOUCH) {
      html.classList.add('work-touch');
      addEventListener('pointerdown', onTDown, true);
      addEventListener('pointermove', onTMove, true);
      addEventListener('pointerup', onTUp, true);
      addEventListener('pointercancel', onTUp, true);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(snapT); clearTimeout(liveT);
      removeEventListener('scroll', onScroll);
      removeEventListener('wheel', onWheel);
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
      document.removeEventListener('mg:theme', onThemeChange);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onCancel);
      if (TOUCH) {
        html.classList.remove('work-touch');
        removeEventListener('pointerdown', onTDown, true);
        removeEventListener('pointermove', onTMove, true);
        removeEventListener('pointerup', onTUp, true);
        removeEventListener('pointercancel', onTUp, true);
        swipe = null;
      }
      tag.classList.remove('is-on');
      canvas.classList.remove('is-hover');
      W.eased = W.target = W.rest; W.vel = 0;
      if (R) { R.blur = 0; R.zoom = 1; }
    };
  }

  /* ---------- Project view: the live page itself, from its top, under a thin bar ---------- */
  function renderViewer(p, opts) {
    const i = P.indexOf(p), prev = P[(i - 1 + NP) % NP], next = P[(i + 1) % NP];
    let tab = p.film && opts.tab === 'film' ? 'film' : 'site';
    const arriving = opts.via === 'morph';
    main.innerHTML = `
      <section class="pv${arriving ? ' is-arriving' : ''}" data-id="${p.id}" aria-labelledby="pvTitle">
        <header class="pv-bar">
          <a class="pv-back" href="#work" data-nav="work">${ico('back')}<span>All work</span></a>
          <div class="pv-id">
            <h1 class="pv-name" id="pvTitle">${esc(p.name)}</h1>
            <p class="pv-tag">${esc(p.tag)}</p>
          </div>
          <div class="pv-end">
            ${p.film ? `
            <div class="pv-tabs" role="tablist" aria-label="${esc(p.name)}">
              <button type="button" role="tab" id="pvTabSite" aria-controls="pvSite">Website</button>
              <button type="button" role="tab" id="pvTabFilm" aria-controls="pvFilm">${esc(p.film.tab)}</button>
            </div>` : ''}
            <span class="pv-count" aria-hidden="true">${pad2(i + 1)}<span> / ${pad2(NP)}</span></span>
            <a class="pv-arrow" href="#${prev.id}" aria-label="Previous project: ${esc(prev.name)}">${ico('prev')}</a>
            <a class="pv-arrow" href="#${next.id}" aria-label="Next project: ${esc(next.name)}">${ico('next')}</a>
          </div>
        </header>
        <div class="pv-stage">
          <div class="pv-panel pv-site" id="pvSite"${p.film ? ' role="tabpanel" aria-labelledby="pvTabSite"' : ''}>
            <iframe class="pv-frame" title="${esc(p.name)}, the live page" allow="autoplay; fullscreen"></iframe>
          </div>
          ${p.film ? `
          <div class="pv-panel pv-film is-off" id="pvFilm" role="tabpanel" aria-labelledby="pvTabFilm" inert>
            <video src="${esc(p.film.src)}" poster="${esc(p.film.poster)}" controls playsinline preload="metadata" aria-label="${esc(p.film.title)}"></video>
          </div>` : ''}
        </div>
      </section>`;
    const root = $('.pv');
    const frame = $('.pv-frame', root);
    const film = $('.pv-film video', root);
    // the reel will show this project when we go back to it
    W.rest += shortestP(i - wrapP(W.rest));
    W.eased = W.target = W.rest;

    let loaded = false, waiting = arriving, go = () => {}, watchT = 0;
    const ready = new Promise((res) => {
      go = res;
      frame.addEventListener('load', () => { loaded = true; root.classList.add('is-loaded'); res(); }, { once: true });
    });
    // the landing shows as soon as its document is parsed (it paints once its styles are in), not once its last film
    // or image has arrived: on a phone network that took seconds, and the page stood white after the curtain left
    const watch = () => {
      let d = null;
      try { d = frame.contentDocument; } catch (e) { root.classList.add('is-loaded'); return; }
      if (d && d.URL !== 'about:blank' && d.body && d.body.firstElementChild) { root.classList.add('is-loaded'); return; }
      if (!loaded) watchT = setTimeout(watch, 80);
    };
    // when the reel's frame is flying in, the page waits for it to land (start), then loads behind it
    const loadSite = () => {
      if (waiting || frame.getAttribute('src')) return;
      frame.setAttribute('src', p.site);
      watchT = setTimeout(watch, 80);
      setTimeout(go, 4500);                      // a slow page never holds the transition longer than this
    };

    function setTab(t, user) {
      tab = p.film && t === 'film' ? 'film' : 'site';
      if (!p.film) { loadSite(); return; }
      $('#pvTabSite').setAttribute('aria-selected', String(tab === 'site'));
      $('#pvTabFilm').setAttribute('aria-selected', String(tab === 'film'));
      $('#pvTabSite').tabIndex = tab === 'site' ? 0 : -1;
      $('#pvTabFilm').tabIndex = tab === 'film' ? 0 : -1;
      // panels stay laid out at full size; the one not shown is hidden from sight, focus and screen readers
      [['#pvSite', 'site'], ['#pvFilm', 'film']].forEach(([s, k]) => { const el = $(s); el.classList.toggle('is-off', tab !== k); el.inert = tab !== k; });
      if (tab === 'site') { loadSite(); film.pause(); }
      else if (user !== false) {
        // a click on the tab is a gesture: the film can start with its sound
        film.muted = false;
        film.play().catch(() => {});
      }
    }
    setTab(tab, false);
    if (p.film) {
      const tabs = $('.pv-tabs', root);
      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[role="tab"]');
        if (!b) return;
        navigate(b.id === 'pvTabFilm' ? 'methode' : p.id, { replace: true });
      });
      tabs.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const t = tab === 'site' ? 'film' : 'site';
        navigate(t === 'film' ? 'methode' : p.id, { replace: true });
        $(t === 'film' ? '#pvTabFilm' : '#pvTabSite').focus();
      });
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy && !lb && !e.target.closest('video')) navigate('work');
    };
    addEventListener('keydown', onKey);
    viewer = {
      p,
      start: () => { waiting = false; if (tab === 'site') loadSite(); else go(); return ready; },
      setTab: (t) => setTab(t, true),
      arrived: () => root.classList.remove('is-arriving'),
    };
    if (!arriving) root.classList.remove('is-arriving');
    return () => {
      removeEventListener('keydown', onKey);
      clearTimeout(watchT);
      if (film) film.pause();
      if (!loaded) frame.removeAttribute('src');
    };
  }

  /* ---------- Playground ----------
     One mixed grid, no categories. Loops play while on screen; a piece that animates when a visitor reaches it
     (a footer, a hero's entrance) is a film that plays from its start each time it comes into view, then rests on
     its last image. A click zooms the piece, alone, to the middle of the screen. */
  let playPaused = false;            // one switch stops every video of the page (WCAG 2.2.2)
  // the width of a tile, for the images' srcset: one column on a phone, two on a tablet, three beside the aside
  const PLAY_SIZES = '(max-width: 560px) calc(100vw - 32px), (max-width: 1100px) calc(50vw - 31px), calc((min(100vw, 1680px) - 432px) / 3)';
  function renderPlayground() {
    const items = window.PLAY;
    main.innerHTML = `
      <section class="page play" aria-labelledby="playTitle">
        <aside class="play-aside"><div class="play-aside__in">
          <h1 class="sr" id="playTitle">Playground</h1>
          <div class="play-count rise" aria-hidden="true">${pad2(items.length)}</div>
          <p class="play-note rise" style="--k:1">Heroes, footers and films from my projects, and smaller pieces made along the way. New work lands here first.</p>
          <button class="play-pause rise" style="--k:2" type="button" id="playPause" aria-pressed="${playPaused}"></button>
          <a class="btn btn--accent rise" style="--k:3; justify-self:start" href="#contact">Get in touch ${ico('arrow')}</a>
        </div></aside>
        <div class="play-grid" id="playGrid">
          ${items.map((x, i) => `
            <figure>
              <button type="button" data-i="${i}" aria-label="Enlarge: ${esc(x.title)}">
                ${x.video
                  ? `<video src="${esc(x.video)}" poster="${esc(REDUCE && x.end ? x.end : x.small)}" muted${x.once ? '' : ' loop'} playsinline preload="none" data-auto${x.once ? ' data-once' : ''} width="${x.w}" height="${x.h}" aria-hidden="true"></video>`
                  : `<img src="${esc(x.small)}"${x.sw ? ` srcset="${esc(x.small)} ${x.sw}w, ${esc(x.src)} ${x.w}w" sizes="${PLAY_SIZES}"` : ''} alt="${esc(x.title)}" width="${x.w}" height="${x.h}" loading="lazy" decoding="async">`}
              </button>
            </figure>`).join('')}
        </div>
      </section>`;
    const grid = $('#playGrid');
    grid.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) openZoom(+b.dataset.i, b); });
    const vids = $$('video[data-auto]', grid);
    const ready = new Set();          // on screen enough to play
    const once = (v) => v.dataset.once !== undefined;
    // while a page change brings the wall in, no video starts (decoders starting mid-motion cost frames, and an
    // arrival film would begin before its piece has landed): they start when it ends (mg:reveal)
    const sync = (v) => {
      if (ready.has(v) && !REDUCE && !playPaused && !v._held && !main.classList.contains('tr-own')) {
        v.preload = 'auto';
        if (once(v) && v._fresh) { v._fresh = false; v.currentTime = 0; }
        v.play().catch(() => {});
      } else v.pause();
    };
    const vio = new IntersectionObserver((ents) => ents.forEach((en) => {
      const v = en.target;
      // an arriving piece waits until half of it is on screen; a loop starts as soon as it shows
      if (en.intersectionRatio >= (once(v) ? 0.5 : 0.15)) ready.add(v); else ready.delete(v);
      if (!en.isIntersecting) v._fresh = true;   // fully gone: it plays from its start next time
      sync(v);
    }), { threshold: [0, 0.15, 0.5] });
    vids.forEach((v) => { v._fresh = true; vio.observe(v); });
    playSync = () => vids.forEach(sync);
    const pauseBtn = $('#playPause');
    const paintPause = () => {
      pauseBtn.setAttribute('aria-pressed', String(playPaused));
      pauseBtn.innerHTML = playPaused ? `${ico('play')}<span>Play the videos</span>` : `${ico('pause')}<span>Pause the videos</span>`;
    };
    paintPause();
    pauseBtn.hidden = REDUCE || !vids.length;
    pauseBtn.addEventListener('click', () => { playPaused = !playPaused; paintPause(); vids.forEach(sync); });
    const onReveal = () => vids.forEach(sync);
    document.addEventListener('mg:reveal', onReveal);
    return () => { vio.disconnect(); playSync = () => {}; document.removeEventListener('mg:reveal', onReveal); };
  }
  let playSync = () => {};

  /* Zoom: the piece leaves its place in the grid and grows, alone, to the middle of the screen; it goes back the same way. */
  let lb = null, lbReturn = null;
  const ZOOM_IN = 'cubic-bezier(.22, 1, .36, 1)', ZOOM_OUT = 'cubic-bezier(.5, 0, .2, 1)';
  function zoomRect(w, h) {
    const vw = html.clientWidth, vh = innerHeight, m = vw < 760 ? 16 : 64;
    const s = Math.min((vw - 2 * m) / w, (vh - 2 * m) / h);
    return { x: (vw - w * s) / 2, y: (vh - h * s) / 2, w: w * s, h: h * s };
  }
  const flip = (from, to) => `translate(${from.left - to.x}px, ${from.top - to.y}px) scale(${from.width / to.w}, ${from.height / to.h})`;
  function openZoom(i, btn) {
    if (lb) return;
    const x = window.PLAY[i];
    const tile = btn.querySelector('img, video');
    const from = tile.getBoundingClientRect();
    lbReturn = btn;
    lb = document.createElement('div');
    lb.className = 'zoom';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', x.title);
    lb.innerHTML = `<div class="zoom__scrim"></div><div class="zoom__media"></div><button class="zoom__close" type="button" aria-label="Close">${ico('close')}</button>`;
    const box = $('.zoom__media', lb);
    const film = x.video && x.loop === false;   // a film with its sound (also one that plays once in the grid)
    let media;
    if (x.video) {
      media = document.createElement('video');
      media.playsInline = true;
      media.poster = tile.poster || x.small;
      media.src = x.video;
      if (film) media.controls = true;
      else { media.muted = true; media.loop = !x.once; }
      media.setAttribute('aria-label', x.title);
      try { media.currentTime = film ? 0 : tile.currentTime || 0; } catch (e) { /* set once metadata arrives */ }
      tile.pause();
    } else {
      media = new Image();
      media.alt = x.title;
      media.src = x.small;                               // already on screen: the zoom starts at once
      const full = new Image();
      full.src = x.src;
      full.decode().then(() => { if (media.isConnected) media.src = x.src; }).catch(() => {});
    }
    box.appendChild(media);
    const place = () => { const r = zoomRect(x.w, x.h); box.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`; return r; };
    const to = place();
    const saveData = navigator.connection && navigator.connection.saveData;
    if (x.hd && !film && !saveData && to.w * (devicePixelRatio || 1) > x.w * 1.2) sharpen(box, media, x.hd);
    document.body.appendChild(lb);
    document.body.classList.add('is-locked');
    tile.style.visibility = 'hidden';                     // the piece itself leaves the grid
    const dur = REDUCE ? 0 : 680;
    if (dur) {
      box.animate([{ transform: flip(from, to) }, { transform: 'none' }], { duration: dur, easing: ZOOM_IN });
      $('.zoom__scrim', lb).animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.75, easing: 'linear', fill: 'both' });
      $('.zoom__close', lb).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: dur * 0.55, easing: 'linear', fill: 'both' });
    }
    if (x.video && (film || !REDUCE)) media.play().catch(() => {});   // opened by a click: a film starts with its sound
    lb.addEventListener('click', (e) => { if (film && e.target === media) return; closeZoom(); });
    lb._resize = () => place();
    addEventListener('resize', lb._resize);
    document.addEventListener('keydown', zoomKeys);
    $('.zoom__close', lb).focus({ preventScroll: true });
  }
  /* A dense screen gets the loop filmed at twice the density: it loads behind the one on screen (the grid's file,
     already there); once it can play through, the loop holds one frame, the sharp one takes the same frame and goes on. */
  function sharpen(box, base, src) {
    const hd = document.createElement('video');
    hd.className = 'zoom__hd';
    hd.muted = true; hd.playsInline = true; hd.loop = base.loop; hd.preload = 'auto';
    hd.setAttribute('aria-hidden', 'true');
    hd.src = src;
    hd.addEventListener('canplaythrough', () => {
      if (!base.isConnected) return;
      const playing = !base.paused;
      base.pause();
      hd.addEventListener('seeked', () => {
        if (!base.isConnected) return;
        hd.classList.add('is-on');
        if (playing) hd.play().catch(() => {});
      }, { once: true });
      hd.currentTime = base.currentTime;
    }, { once: true });
    box.appendChild(hd);
  }
  function zoomKeys(e) {
    if (!lb) return;
    if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
    else if (e.key === 'Tab') {
      const f = $$('button, video[controls]', lb);
      const k = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }
  function closeZoom(silent) {
    if (!lb) return;
    const el = lb, btn = lbReturn;
    lb = null;
    document.removeEventListener('keydown', zoomKeys);
    removeEventListener('resize', el._resize);
    const tile = btn && btn.isConnected ? btn.querySelector('img, video') : null;
    const box = $('.zoom__media', el);
    const done = () => {
      el.remove();
      document.body.classList.remove('is-locked');
      if (tile) tile.style.visibility = '';
      playSync();
    };
    if (!silent && btn && btn.isConnected) btn.focus({ preventScroll: true });
    if (silent || REDUCE || !tile) { done(); return; }
    const from = tile.getBoundingClientRect(), b = box.getBoundingClientRect();
    const to = { x: b.left, y: b.top, w: b.width, h: b.height };
    const dur = 560;
    box.animate([{ transform: 'none' }, { transform: flip(from, to) }], { duration: dur, easing: ZOOM_OUT, fill: 'forwards' }).finished.then(done, done);
    $('.zoom__scrim', el).animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' });
    $('.zoom__close', el).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' });
  }
  const closeLightbox = (silent) => closeZoom(silent);

  /* ---------- About: the wiring (about.js; the page before 2026-11-03 is in archive/about-v1/) ---------- */
  function renderAbout() {
    return window.AboutPage.mount(main, { ico, copyEmail });
  }

  /* ---------- Contact: « L’empreinte » (contact.js; the page before 2026-11-05 is in archive/contact-v1/) ---------- */
  function renderContact() {
    return window.ContactPage.mount(main);
  }

  /* ---------- Opening: « L’équipe » (opening.js, built from opening-pistes/p-equipe.js by outils/opening-build.py;
     the intro before 2026-11-05 is in archive/intro-v1/). Martin and four agents finish the Work page live. Once per
     visit, only when the visit starts on Work (a link to another page goes straight there); the brand replays it.
     It returns a promise: the reel's entrance starts when it resolves, with the parameters it resolves with. ---------- */
  function playIntro(r) {
    let seen = true;
    try { seen = sessionStorage.getItem('mg-intro') === '1'; sessionStorage.setItem('mg-intro', '1'); } catch (e) { seen = true; }
    if (seen || !r || r.name !== 'work' || !W.first || !window.Opening) return null;
    try { return window.Opening.play() || null; } catch (e) { console.warn('Opening unavailable:', e.message); return null; }
  }
  function replayIntro() {
    try { sessionStorage.removeItem('mg-intro'); } catch (e) { /* nothing to reset */ }
    W.first = true;
    const p = playIntro(routeOf('work'));
    if (!p) return;
    mount(routeOf('work'), { entrance: p, focus: false });
  }

  /* ---------- What the page changes (transitions.js) and the opening (opening.js) may use ---------- */
  window.__APP = {
    F, GATE, W, HOLD: HELD, SHUTTER,
    getReel, reelGeom, readTheme, esc,
    viewer: () => viewer,
    // the reel's entrance as the next Work page will start it (it waits under the opening): { from, dur, o0 }
    setEntrance: (o) => { entranceInit = Object.assign({}, entranceInit || {}, o); },
  };

  /* ---------- Boot ---------- */
  try { history.scrollRestoration = 'manual'; } catch (e) { /* older browsers */ }
  let first = routeOf(location.hash);
  // back from a project opened as a page (phones): the reel shows that project again
  try {
    const k = sessionStorage.getItem('mg-reel');
    sessionStorage.removeItem('mg-reel');
    if (k !== null && P[+k]) { W.rest = W.target = W.eased = +k; W.first = false; }
  } catch (e) { /* the reel starts on the first project */ }
  // a project's address opened on a phone (a shared link): Work, with the reel on that project (opening the landing
  // by itself would be a redirect, and the phone's Back would skip the portfolio)
  if (first.name === 'project' && PHONE_PAGES.matches) {
    W.rest = W.target = W.eased = P.indexOf(first.p); W.first = false;
    setHash('work', true);
    first = routeOf('work');
  }
  const intro = playIntro(first);
  html.classList.remove('op-boot');        // the head's script hid the static name for the opening, which has it now
  if (intro) { main.classList.add('is-waiting'); intro.then(() => main.classList.remove('is-waiting')); }
  mount(first, { entrance: first.name === 'work' ? (intro || null) : undefined, focus: false });
  // arriving on another page: the reel (its WebGL program, its covers) is made while the page is idle, so the
  // first page change to Work does not stall on it
  if (first.name !== 'work') {
    const warm = () => { if (current && current.name !== 'work') getReel(); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2000);
  }
})();
