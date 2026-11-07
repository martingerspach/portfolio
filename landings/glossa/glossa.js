/* Glossa landing: plates, masthead, product demos, workflow walkthrough, dashboard. */
(function () {
  'use strict';

  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var ease = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  /* ---------------------------------------------------------------------------------------------------------- */
  /* plates (WebGL halftone, image fallback) */
  var screens = [];
  function fallback(el) {
    el.classList.add('is-fallback');
    $$('img[data-src]', el).forEach(function (img) {
      img.srcset = img.getAttribute('data-srcset') || '';
      img.src = img.getAttribute('data-src');
    });
  }
  function mountPlate(name, opts) {
    var el = document.querySelector('[data-screen="' + name + '"]');
    if (!el) return;
    var s = null;
    try { if (window.GlossaScreen && root.classList.contains('has-gl')) s = window.GlossaScreen.mount(el, opts); } catch (e) { s = null; }
    if (!s) { fallback(el); return; }
    screens.push(s);
  }
  /* opened in the portfolio, the hero's print waits until the portfolio's curtain leaves, so the visitor sees it
     develop: the page asks its parent; told to hold, it waits for the cue (4 s at most); with no answer within 150 ms
     (alone, or in any other frame) it starts as before */
  var cue = new Promise(function (go) {
    if (window.parent === window) return go();
    var held = false;
    function done() { removeEventListener('message', on); go(); }
    function on(e) {
      var k = e.source === parent && e.data && e.data.type;
      if (k === 'portfolio:hold' && !held) { held = true; setTimeout(done, 4000); } else if (k === 'portfolio:reveal') done();
    }
    addEventListener('message', on);
    try { parent.postMessage({ type: 'landing:hello' }, '*'); } catch (e) { done(); }
    setTimeout(function () { if (!held) done(); }, 150);
  });
  mountPlate('hero', {
    tone: 'img/hero-tone.webp', pitch: 4, bg: '#ce0f3d', ink: '#fffafb', reduced: reduced, gate: cue,
    focus: [0.8, 0.62], push: 'leave', pushAmount: 0.06,
    pitchFn: function (w) { return w < 600 ? 3 : 4; }
  });
  if (window.glossaHero) {
    window.addEventListener('resize', window.glossaHero);
    if (document.fonts) document.fonts.ready.then(window.glossaHero);
  }

  mountPlate('footer', {
    tone: 'img/footer-tone.webp', pitch: 4, bg: '#ce0f3d', ink: '#fffafb', reduced: reduced,
    focus: [0.3, 0.6], startRatio: 0.2,
    /* the footer is one screen tall, so the plate's height varies: keep the orator's raised fist 28 px under the
       plate's top edge (it sits 6.6 % down the 2048 x 1232 tone), cropping sky first and city last */
    posFn: function (w, h) {
      var s = Math.max(w / 2048, h / 1232), dh = 1232 * s;
      if (dh - h < 1) return [w < 760 ? 0.24 : 0.4, 0];
      var oy = Math.min(0, Math.max(h - dh, 28 - 0.066 * dh));
      return [w < 760 ? 0.24 : 0.4, oy / (h - dh)];
    },
    pitchFn: function (w) { return w < 600 ? 3 : 4; }
  });

  /* ---------------------------------------------------------------------------------------------------------- */
  /* masthead: transparent at the top of the hero, a crimson band while the hero scrolls under it, paper after */
  var mast = $('.mast'), hero = $('.hero');
  (function () {
    if (!mast || !hero) return;
    var ticking = false;
    function update() {
      ticking = false;
      if (mast.classList.contains('is-open')) return;
      var y = window.scrollY, mh = mast.offsetHeight;
      var past = hero.getBoundingClientRect().bottom <= mh;
      mast.classList.toggle('is-solid', past);
      mast.classList.toggle('is-over', !past && y > 2);
    }
    window.glossaMast = update;
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();
  var menuBtn = $('.mast__menu'), sheet = $('#sheet');
  if (menuBtn && sheet) {
    var closeTimer = 0;
    var setMenu = function (open) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var lab = menuBtn.querySelector('[data-menu-label]');
      if (lab) lab.textContent = open ? 'Close' : 'Menu';
      clearTimeout(closeTimer);
      if (open) {
        sheet.hidden = false;
        requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('is-open'); }); });
      } else {
        sheet.classList.remove('is-open');
        closeTimer = setTimeout(function () { sheet.hidden = true; }, reduced ? 0 : 360);
      }
      root.classList.toggle('is-locked', open);
      /* the page behind the open sheet leaves the tab order */
      ['main', '.foot'].forEach(function (sel) { var el = $(sel); if (el) el.inert = open; });
      mast.classList.toggle('is-open', open);
      if (open) mast.classList.add('is-solid');
      else if (window.glossaMast) { mast.classList.remove('is-solid'); window.glossaMast(); }
    };
    window.addEventListener('resize', function () {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && getComputedStyle(menuBtn).display === 'none') setMenu(false);
    });
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () {
        setMenu(false);
        var t = document.querySelector(a.getAttribute('href'));
        if (t) { t.setAttribute('tabindex', '-1'); setTimeout(function () { t.focus({ preventScroll: true }); }, 10); }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
  }

  /* run `fn` once when `el` is well in view; `again` replays on hover after it finished */
  function onView(el, fn, ratio) {
    if (!el) return;
    var busy = false, done = false;
    var run = function () {
      if (busy) return;
      busy = true;
      Promise.resolve(fn()).then(function () { busy = false; done = true; });
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); run(); } });
    }, { threshold: ratio || 0.45 });
    io.observe(el);

  }

  /* ---------------------------------------------------------------------------------------------------------- */
  /* card 1: drafts typed in six languages */
  (function () {
    var ui = $('[data-demo="drafts"]');
    if (!ui) return;
    var rows = $$('.drafts li', ui), state = $('[data-state]', ui);
    var store = rows.map(function (li) {
      var el = $('[data-type]', li);
      var nodes = [];
      (function walk(n) { n.childNodes.forEach(function (c) { if (c.nodeType === 3) nodes.push({ n: c, t: c.nodeValue }); else walk(c); }); })(el);
      return { li: li, el: el, nodes: nodes, len: nodes.reduce(function (a, b) { return a + Array.from(b.t).length; }, 0) };
    });
    var caret = document.createElement('i');
    caret.className = 'caret';
    function show(r, k) {
      var left = k;
      r.nodes.forEach(function (o) {
        var chars = Array.from(o.t);
        var take = Math.max(0, Math.min(chars.length, left));
        o.n.nodeValue = chars.slice(0, take).join('');
        left -= take;
      });
    }
    function reset() {
      store.forEach(function (r) { r.li.className = 'is-wait'; show(r, r.len); });
      state.textContent = 'Drafting';
    }
    async function play() {
      if (reduced) return;
      await wait(250);
      for (var i = 0; i < store.length; i++) {
        var r = store[i];
        r.li.className = 'is-typing';
        $('.drafts__tag', r.li).textContent = 'Drafting';
        show(r, 0);
        r.el.appendChild(caret);
        state.textContent = 'Drafting ' + (i + 1) + ' of 6';
        for (var k = 1; k <= r.len; k++) {
          show(r, k);
          await wait(18 + Math.random() * 22);
        }
        await wait(120);
        caret.remove();
        r.li.className = '';
        $('.drafts__tag', r.li).textContent = 'Draft';
      }
      state.textContent = '6 of 6 drafted';
    }
    if (!reduced) reset();
    onView(ui, play, 0.5);
  })();

  /* card 2: a reviewer selects the cut button on the live screen and approves a shorter label */
  (function () {
    var ui = $('[data-demo="review"]');
    if (!ui) return;
    var cur = $('[data-cursor]', ui), target = $('[data-target]', ui), note = $('[data-note]', ui);
    var longL = $('[data-long]', target), shortL = $('[data-short]', target), who = $('[data-who]', note);
    function label(isShort) { longL.classList.toggle('is-on', !isShort); shortL.classList.toggle('is-on', isShort); }
    var pos = { x: 0, y: 0 };
    function place(x, y) { pos.x = x; pos.y = y; cur.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)'; }
    function glide(x, y, ms) {
      return new Promise(function (res) {
        var x0 = pos.x, y0 = pos.y, t0 = performance.now();
        /* a slight arc, like a hand */
        var mx = (x0 + x) / 2 + (y - y0) * 0.18, my = (y0 + y) / 2 - (x - x0) * 0.12;
        (function step(now) {
          var t = Math.min(1, (now - t0) / ms), e = ease(t), a = 1 - e;
          place(a * a * x0 + 2 * a * e * mx + e * e * x, a * a * y0 + 2 * a * e * my + e * e * y);
          if (t < 1) requestAnimationFrame(step); else res();
        })(t0);
      });
    }
    function spots() {
      var u = ui.getBoundingClientRect(), b = target.getBoundingClientRect();
      var bx = b.left - u.left, by = b.top - u.top;
      return {
        /* inside the screen, top right, where nothing is written */
        rest: [u.width - 66, 24],
        /* the tip on the button's lower edge, left of the label, so the name tag hangs below and covers nothing */
        btn: [bx + 10, by + b.height + 1],
        /* then out of the way, over the order details, while the note opens below */
        away: [bx + b.width * 0.45, by - 48]
      };
    }
    function finalState() {
      label(true); target.classList.remove('is-marked'); note.classList.remove('is-hidden');
      who.textContent = 'Approved by Hana'; who.classList.add('is-ok'); cur.classList.remove('is-on');
    }
    function startState() {
      label(false); note.classList.add('is-hidden'); target.classList.remove('is-marked');
      who.textContent = 'Hana, German reviewer'; who.classList.remove('is-ok'); cur.classList.remove('is-on');
    }
    async function play() {
      if (reduced) { finalState(); return; }
      var s = spots();
      place(s.rest[0], s.rest[1]);
      cur.classList.add('is-on');
      await wait(550);
      await glide(s.btn[0], s.btn[1], 1050);
      await wait(150);
      cur.animate([{ scale: 1 }, { scale: .86 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
      target.classList.add('is-marked');
      await wait(450);
      s = spots();
      glide(s.away[0], s.away[1], 800);
      await wait(350);
      note.classList.remove('is-hidden');
      await wait(1100);
      label(true);
      await wait(800);
      target.classList.remove('is-marked');
      who.textContent = 'Approved by Hana';
      who.classList.add('is-ok');
      await wait(500);
      cur.classList.remove('is-on');
    }
    if (reduced) finalState(); else startState();
    onView(ui, play, 0.55);
  })();

  /* card 3: a reviewer adds a term to the glossary */
  (function () {
    var ui = $('[data-demo="glossary"]');
    if (!ui) return;
    var row = $('[data-new]', ui), dd = $('[data-type]', row), count = $('[data-count]', ui);
    var word = dd.textContent;
    var text = document.createTextNode(word);
    var caret = document.createElement('i');
    caret.className = 'caret';
    dd.textContent = '';
    dd.appendChild(text);
    if (!reduced) { text.nodeValue = ''; count.textContent = '47 terms'; }
    async function play() {
      if (reduced) return;
      await wait(500);
      row.classList.add('is-lit');
      dd.appendChild(caret);
      for (var k = 1; k <= word.length; k++) {
        text.nodeValue = word.slice(0, k);
        await wait(90 + Math.random() * 60);
      }
      await wait(380);
      dd.removeChild(caret);
      count.textContent = '48 terms';
      await wait(500);
      row.classList.remove('is-lit');
    }
    onView(ui, play, 0.55);
  })();

  /* card 5: the pull request checks run, then the merge button wakes up */
  (function () {
    var ui = $('[data-demo="pr"]');
    if (!ui) return;
    var checks = $$('[data-check]', ui), merge = $('[data-merge]', ui);
    if (!reduced) {
      merge.classList.add('is-off');
      checks.forEach(function (li) { li.classList.add('is-queued'); $('em', li).textContent = 'Queued'; });
    }
    async function play() {
      if (reduced) return;
      checks.forEach(function (li) { li.classList.remove('is-queued'); li.classList.add('is-run'); $('em', li).textContent = '0 s'; });
      await wait(300);
      var t0 = performance.now();
      await new Promise(function (res) {
        (function step(now) {
          /* one CI second every 140 ms */
          var s = (now - t0) / 140, left = 0;
          checks.forEach(function (li) {
            var end = +li.getAttribute('data-check');
            $('em', li).textContent = Math.min(end, Math.floor(s)) + ' s';
            if (s >= end) li.classList.remove('is-run'); else left++;
          });
          if (left) requestAnimationFrame(step); else res();
        })(t0);
      });
      await wait(350);
      merge.classList.remove('is-off');
    }
    onView(ui, play, 0.55);
  })();

  /* measured buttons (fit card, compare): the width the label needs, so the overflow is drawn to the pixel */
  function measureFit(b) {
    var lab = $('[data-long]', b);
    if (!lab) return 0;
    var r = document.createRange();
    r.selectNodeContents(lab);
    var text = r.getBoundingClientRect().width;
    var bw = parseFloat(getComputedStyle(b).getPropertyValue('--bw')) || 164;
    var need = Math.ceil(text + 28);
    b.style.setProperty('--need', need + 'px');
    var em = $('[data-over]', b);
    if (em) em.textContent = '+' + (need - bw) + ' px';
    b.setAttribute('data-over-px', need - bw);
    return need - bw;
  }
  function measureAll() { $$('[data-bfit]').forEach(measureFit); }
  measureAll();
  window.addEventListener('resize', measureAll);

  /* card 4: a German string measured in its button; Glossa offers a shorter one, then applies it */
  (function () {
    var ui = $('[data-demo="fit"]');
    if (!ui) return;
    var b = $('[data-bfit]', ui), verdict = $('[data-verdict]', ui), alt = $('.fit__alt', ui), tag = $('.fit__now em', ui);
    function verdictOver(on) {
      verdict.classList.toggle('is-bad', on);
      verdict.textContent = on ? (b.getAttribute('data-over-px') || '') + ' px too long' : 'Fits';
    }
    if (reduced) { b.classList.remove('is-over'); verdictOver(false); alt.classList.add('is-struck', 'is-on'); tag.textContent = 'Applied'; }
    else { b.classList.add('is-over'); verdictOver(true); }
    if (document.fonts) document.fonts.ready.then(function () { measureAll(); if (b.classList.contains('is-over')) verdictOver(true); });
    window.addEventListener('resize', function () { if (b.classList.contains('is-over')) verdictOver(true); });
    async function play() {
      if (reduced) return;
      await wait(1200);
      alt.classList.add('is-struck');
      await wait(600);
      alt.classList.add('is-on');
      await wait(1000);
      b.classList.remove('is-over');
      await wait(380);
      verdictOver(false);
      tag.textContent = 'Applied';
    }
    onView(ui, play, 0.55);
  })();

  /* compare: each column plays once when its drawing is in view (both together when they sit side by side) */
  (function () {
    var cells = $$('.versus td');
    if (!cells.length) return;
    if (reduced) { cells.forEach(function (c) { c.classList.add('is-played'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var td = e.target.closest('td');
        td.classList.add('is-played');
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    cells.forEach(function (c) { var d = $('.inst', c); if (d) io.observe(d); });
  })();

  /* ---------------------------------------------------------------------------------------------------------- */
  /* workflow: three scenes, played in turn; tabs, arrows and a pause button */
  (function () {
    var tabs = $$('.step'), list = $('.steps'), stage = $('.flow__stage');
    if (!tabs.length || !stage) return;
    var scenes = $$('[data-scene]', stage), live = $('[data-live]', stage), pauseBtn = $('[data-pause]', stage);
    var pauseLabel = $('[data-pause-label]', stage);
    var box = document.createElement('span');
    box.className = 'steps__box';
    box.setAttribute('aria-hidden', 'true');
    list.prepend(box);
    var idx = 0, timer = 0, paused = false, inView = false, run = 0;
    var DWELL = 7000;
    var PRE = ['Glossa reads pull request #482.', 'Drafting 96 translations.', 'Merging into main.'];
    var LIVE = [
      'Pull request #482 adds 3 strings and changes 1.',
      '21 of 24 languages approved. Korean, Thai and Hebrew are in review.',
      'Merged 98 minutes after the pull request opened.'
    ];

    /* grid of 24 languages x 4 strings */
    var codes = ['FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'PL', 'SV', 'DA', 'FI', 'NO', 'CS', 'TR', 'EL', 'RO', 'HU', 'UK', 'AR', 'HE', 'HI', 'JA', 'KO', 'ZH', 'TH'];
    var waiting = { KO: 2, TH: 1, HE: 3 };
    var grid = $('[data-grid]', stage), cells = [];
    grid.innerHTML = '';
    codes.forEach(function (c) {
      var b = document.createElement('div');
      b.className = 'lang';
      b.innerHTML = '<span class="grid__code">' + c + '</span>';
      var row = document.createElement('span');
      row.className = 'lang__sq';
      for (var i = 0; i < 4; i++) {
        var q = document.createElement('i');
        q.className = 'sq sq--empty';
        row.appendChild(q);
        cells.push({ q: q, code: c, i: i });
      }
      b.appendChild(row);
      grid.appendChild(b);
    });
    var approvedEl = $('[data-approved]', stage);
    var lit = $$('[data-hl]', stage), countEl = $('[data-count]', stage), logs = $$('.ship__log li', stage), chips = $$('.ship__langs span', stage);

    function finalOf(cell) {
      var w = waiting[cell.code];
      if (w && cell.i >= 4 - w) return 'sq sq--draft';
      return 'sq sq--ok';
    }
    function settle(n) {
      /* the end state of scene n, shown at once (reduced motion, tab jumps) */
      if (n === 0) { lit.forEach(function (b) { b.classList.add('is-lit'); }); countEl.textContent = '4'; }
      if (n === 1) { cells.forEach(function (c) { c.q.className = finalOf(c); }); approvedEl.textContent = '21 of 24 approved'; }
      if (n === 2) { logs.forEach(function (l) { l.style.opacity = 1; }); chips.forEach(function (c) { c.style.opacity = 1; }); }
    }
    async function animate(n, token) {
      var alive = function () { return token === run; };
      if (n === 0) {
        lit.forEach(function (b) { b.classList.remove('is-lit'); });
        countEl.textContent = '0';
        await wait(500);
        for (var i = 0; i < lit.length && alive(); i++) {
          lit[i].classList.add('is-lit');
          countEl.textContent = String(i + 1);
          await wait(520);
        }
      }
      if (n === 1) {
        cells.forEach(function (c) { c.q.className = 'sq sq--empty'; });
        approvedEl.textContent = '0 of 24 approved';
        await wait(300);
        for (var k = 0; k < cells.length && alive(); k += 4) {
          for (var j = 0; j < 4; j++) cells[k + j].q.className = 'sq sq--draft';
          await wait(28);
        }
        await wait(420);
        var done = 0;
        for (var L = 0; L < codes.length && alive(); L++) {
          var full = true;
          for (var m = 0; m < 4; m++) {
            var c = cells[L * 4 + m];
            c.q.className = finalOf(c);
            if (c.q.className !== 'sq sq--ok') full = false;
          }
          if (full) done++;
          approvedEl.textContent = done + ' of 24 approved';
          await wait(90);
        }
      }
      if (n === 2) {
        logs.forEach(function (l) { l.style.opacity = .18; });
        chips.forEach(function (c) { c.style.opacity = .25; });
        await wait(300);
        for (var a = 0; a < logs.length && alive(); a++) {
          logs[a].animate([{ opacity: .18 }, { opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.22,.7,.18,1)', fill: 'forwards' });
          logs[a].style.opacity = 1;
          if (a === 1) chips.forEach(function (c, ci) { setTimeout(function () { if (alive()) c.style.opacity = 1; }, ci * 22); });
          await wait(560);
        }
      }
    }
    function moveBox() {
      var t = tabs[idx], r = t.getBoundingClientRect(), lr = list.getBoundingClientRect();
      box.style.transform = 'translateY(' + (r.top - lr.top) + 'px)';
      box.style.height = r.height + 'px';
    }
    function show(n, user) {
      idx = n;
      run++;
      tabs.forEach(function (t, i) {
        var on = i === n;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      stage.setAttribute('aria-labelledby', tabs[n].id);
      scenes.forEach(function (s, i) { s.classList.toggle('is-on', i === n); });
      if (user) live.setAttribute('aria-live', 'polite');
      moveBox();
      if (reduced || user === 'jump') { live.textContent = LIVE[n]; if (reduced || n !== 0) settle(n); }
      else {
        live.textContent = PRE[n];
        var token = run;
        animate(n, token).then(function () { if (token === run) live.textContent = LIVE[n]; });
      }
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || reduced || !inView) return;
      timer = setTimeout(function () { show((idx + 1) % tabs.length); }, DWELL);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i, true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = idx;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = (idx + 1) % tabs.length;
        else if (k === 'ArrowUp' || k === 'ArrowLeft') n = (idx + tabs.length - 1) % tabs.length;
        else if (k === 'Home') n = 0;
        else if (k === 'End') n = tabs.length - 1;
        else return;
        e.preventDefault();
        show(n, true);
        tabs[n].focus();
      });
    });
    function setPaused(p) {
      paused = p;
      pauseBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
      pauseLabel.textContent = p ? 'Play the walkthrough' : 'Pause the walkthrough';
      schedule();
    }
    pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    if (reduced) { pauseBtn.hidden = true; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var was = inView;
        inView = e.isIntersecting;
        if (inView && !was && !reduced && !stage.dataset.started) { stage.dataset.started = '1'; show(0); }
        else schedule();
      });
    }, { threshold: 0.4 }).observe(stage);
    new ResizeObserver(moveBox).observe(list);
    var sceneBox = $('.flow__scene', stage);
    new ResizeObserver(function () {
      var r = sceneBox.getBoundingClientRect();
      var k = Math.min(1, (r.width - 24) / 400, (r.height - 24) / 300);
      sceneBox.style.setProperty('--k', Math.max(0.5, k).toFixed(4));
    }).observe(sceneBox);
    show(0, 'jump');
    if (reduced) settle(0);
    else { lit.forEach(function (b) { b.classList.remove('is-lit'); }); countEl.textContent = '0'; live.textContent = PRE[0]; }
  })();

  /* ---------------------------------------------------------------------------------------------------------- */
  /* dashboard: drawn once, scaled to its frame */
  (function () {
    var fit = $('[data-fit]');
    if (!fit) return;
    var cover = $('[data-cover]', fit);
    /* release 4.2 coverage: the 24 languages, the three still in review stand out */
    var codes = ['AR', 'CS', 'DA', 'DE', 'EL', 'ES', 'FI', 'FR', 'HE', 'HI', 'HU', 'IT', 'JA', 'KO', 'NL', 'NO', 'PL', 'PT', 'RO', 'SV', 'TH', 'TR', 'UK', 'ZH'];
    var review = { HE: 90, KO: 85, TH: 95 };
    cover.innerHTML = codes.map(function (c) {
      var r = review[c];
      return '<span class="cover__t' + (r ? ' is-rev' : '') + '"><b>' + c + '</b>' +
        (r ? '<span>' + r + '%</span>' : '') + '</span>';
    }).join('');

    var chart = $('[data-chart]', fit), tip = $('[data-tip]', fit);
    var weeks = [3.1, 3.4, 2.9, 3.8, 4.2, 3.6, 4.4, 4.9, 4.1, 5.2, 4.8, 5.6, 5.1, 4.6, 5.9, 6.4, 5.5, 6.1, 6.8, 6.2, 7.1, 6.6, 7.4, 8.0];
    var prev = [2.6, 2.9, 2.7, 3.1, 3.5, 3.2, 3.6, 3.9, 3.5, 4.2, 4.0, 4.4, 4.3, 4.0, 4.6, 5.0, 4.7, 5.0, 5.3, 5.1, 5.6, 5.4, 5.8, 6.1];
    var frag = '';
    weeks.forEach(function (v, i) {
      var n = Math.round(v * 2), col = '';
      for (var b = 0; b < n; b++) col += '<i></i>';
      frag += '<span class="chart__col" data-i="' + i + '">' + col + '</span>';
    });
    chart.insertAdjacentHTML('beforeend', frag);
    var cols = $$('.chart__col', chart);
    /* week 21 starts on 18 May 2026: first week of each month */
    var months = [['Jun', 2], ['Jul', 7], ['Aug', 11], ['Sep', 15], ['Oct', 20]];
    $('[data-months]', chart).innerHTML = months.map(function (m) {
      return '<span style="left:' + (m[1] / weeks.length * 100).toFixed(2) + '%">' + m[0] + '</span>';
    }).join('');
    function point(i) {
      cols.forEach(function (c, k) { c.classList.toggle('is-hot', k === i); });
      var c = cols[i], cr = chart.getBoundingClientRect(), r = c.getBoundingClientRect(), s = parseFloat(getComputedStyle(fit).getPropertyValue('--s')) || 1;
      $('[data-tip-week]', tip).textContent = 'Week ' + (21 + i);
      $('[data-tip-val]', tip).textContent = Math.round(weeks[i] * 1000).toLocaleString('en-US') + ' words';
      var x = (r.left - cr.left) / s + (r.width / s) / 2 - tip.offsetWidth / 2;
      x = Math.max(0, Math.min(chart.offsetWidth - tip.offsetWidth, x));
      tip.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    }
    chart.addEventListener('pointermove', function (e) {
      var t = e.target.closest('.chart__col');
      if (t) point(+t.getAttribute('data-i'));
    });
    chart.addEventListener('pointerleave', function () { point(cols.length - 1); });

    var frame = fit.parentElement;
    function scale() {
      var w = frame.clientWidth, s = Math.min(1, w / 1160), x = 0, vh = 780;
      if (w < 520) {
        /* phones: the figures and the coverage panel at a readable size, instead of a thumbnail */
        s = 0.72;
        x = -238 * s;
        vh = 600;
      }
      fit.style.setProperty('--s', s.toFixed(4));
      fit.style.setProperty('--x', x.toFixed(1) + 'px');
      fit.style.setProperty('--vh', vh + 'px');
      point(cols.length - 1);
    }
    new ResizeObserver(scale).observe(frame);
    scale();
  })();

  /* ---------------------------------------------------------------------------------------------------------- */
  /* decode the plates below the fold while the page is idle, so their first raster does not cost a frame */
  (function () {
    var imgs = $$('main img, .offer__figure img').filter(function (im) { return im.decode; });
    var go = function () {
      var i = 0;
      (function next() {
        if (i >= imgs.length) return;
        var im = imgs[i++];
        var done = function () { setTimeout(next, 30); };
        if (im.complete && im.naturalWidth) im.decode().then(done, done);
        else im.addEventListener('load', function () { im.decode().then(done, done); }, { once: true });
      })();
    };
    var later = window.requestIdleCallback || function (f) { return setTimeout(f, 600); };
    window.addEventListener('load', function () { later(go, { timeout: 2500 }); }, { once: true });
  })();

  /* ---------------------------------------------------------------------------------------------------------- */
  /* demo form: honest answer */
  (function () {
    var form = $('#demo');
    if (!form) return;
    var input = $('#demo-email'), msg = $('#demo-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        input.setAttribute('aria-invalid', 'true');
        msg.textContent = 'Please enter a work email address, like name@company.com.';
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      msg.textContent = 'Thanks. Glossa is a fictional product, so nothing was sent.';
    });
  })();

  /* ---------------------------------------------------------------------------------------------------------- */
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      reduced = e.matches;
      root.classList.toggle('reduced', reduced);
      screens.forEach(function (s) { s.reduced = reduced; });
    });
  }
})();
