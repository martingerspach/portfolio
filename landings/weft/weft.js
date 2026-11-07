/* Weft · landing behaviour */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const EASE = 'cubic-bezier(.22,.8,.24,1)';

  /* opened in the portfolio, the hero composes itself when the portfolio's curtain leaves: the page asks its parent;
     told to hold, it waits for the cue (4 s at most); with no answer within 150 ms (alone, or in any other frame) it
     starts as before */
  const cue = new Promise((go) => {
    if (window.parent === window) return go();
    const root = document.documentElement;
    let held = false;
    const done = () => { removeEventListener('message', on); root.classList.remove('is-held'); go(); };
    function on(e) {
      const k = e.source === parent && e.data && e.data.type;
      if (k === 'portfolio:hold' && !held) { held = true; setTimeout(done, 4000); } else if (k === 'portfolio:reveal') done();
    }
    root.classList.add('is-held');
    addEventListener('message', on);
    try { parent.postMessage({ type: 'landing:hello' }, '*'); } catch (e) { done(); }
    setTimeout(() => { if (!held) done(); }, 150);
  });

  async function settle(a) {
    try { await a.finished; a.commitStyles(); } catch (e) { /* cancelled */ }
    a.cancel();
  }
  function swapText(el, text) {
    if (!el || el.textContent === text) return;
    if (reduced()) { el.textContent = text; return; }
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
    out.finished.then(() => {
      el.textContent = text;
      el.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE });
      out.cancel();
    }, () => {});
  }

  /* ---------- Woven fields ---------- */
  function looms() {
    if (!window.Loom) return;
    const hero = $('canvas[data-loom="hero"]');
    if (hero) requestAnimationFrame(() => setTimeout(() => {
      const host = hero.closest('.hero');
      const run = $('#run', host), stackEl = $('.stack', run);
      const bodies = $$('.stack .card, .sheet', run);
      const L = Loom.mount(hero, { pitch: 3, ref: 1440, t0: 3, lift: 0, solid: true, dim: .22, pointer: true, blobs: [], frame(l) {
        // the cards and their sheets press into the silk; a sheet that tucks back lets the fabric settle
        const c = hero.getBoundingClientRect();
        l.rects = bodies.map((el) => {
          const r = el.getBoundingClientRect();
          const want = r.width && !el.classList.contains('is-out') ? 1 : 0;
          el.__wt = el.__wt == null ? want : el.__wt + (want - el.__wt) * (1 - Math.exp(-(l.dt || .016) / .35));
          return { x: r.left - c.left, y: c.bottom - r.bottom, w: r.width, h: r.height, wt: el.__wt };
        }).filter((q) => q.w > 0 && q.wt > .01);
      } });
      const layout = () => {
        if (!L) return;
        const c = hero.getBoundingClientRect();
        if (!c.width) return;
        const s = stackEl.getBoundingClientRect();
        const fx = (x) => (x - c.left) / c.width;
        // one continuous satin: the straight ribbons read as bars and a crosshair, so the silk carries no figure
        L.o.ribbons = null;
        // colour washes in from the edges; no bloom is centred behind a card, so nothing reads as a glow
        L.o.blobs = [
          { x: 1.1, y: .22, r: 380, w: 1.9, ax: 30, ay: 18, f: .05 },
          { x: fx(s.left + s.width * .45), y: 1.22, r: 330, w: 1.7, ax: 34, ay: 12, f: .045 },
          { x: fx(s.left - 40), y: -.18, r: 220, w: 1, ax: 26, ay: 10, f: .05 },
        ];
      };
      layout();
      new ResizeObserver(layout).observe(host);
      document.fonts.ready.then(layout);
    }, 30));
    // the wordmark loom compiles when the browser is idle, so the first screen never waits for it
    const later = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 400));
    const label = $('canvas[data-loom="label"]');
    if (label) {
      const go = () => Loom.mount(label, { pitch: 3, warp: 10, t0: 20, sheen: .5, solid: true, dim: .34, still: true, hiMask: true, pointer: true, hover: true, fingerR: 96, pointerArea: label.closest('footer'), blobs: [{ x: .5, y: .5, r: 1400, w: .08 }], mask(ctx, w, h) {
        // poster scale: the word fills the band's height, kept inside its width on narrow screens
        ctx.font = '700 100px "Host Grotesk", sans-serif';
        const m = ctx.measureText('weft');
        const w100 = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        const size = Math.min(100 * (h * .64) / m.actualBoundingBoxAscent, 100 * (w * .84) / w100);
        ctx.font = `700 ${size}px "Host Grotesk", sans-serif`;
        const mm = ctx.measureText('weft');
        const tw = mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight;
        const x = (w - tw) / 2 + mm.actualBoundingBoxLeft;
        const g = ctx.createLinearGradient((w - tw) / 2, 0, (w + tw) / 2, 0);
        g.addColorStop(0, '#5a5a5a'); g.addColorStop(1, '#d6d6d6');
        ctx.fillStyle = g;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('weft', x, Math.round((h + mm.actualBoundingBoxAscent) / 2));
      } });
      later(() => document.fonts.load('700 100px "Host Grotesk"').then(go, go));
    }
  }

  /* ---------- Segmented tabs ---------- */
  function segmented(list, onSelect) {
    const tabs = $$('[role="tab"]', list);
    const vertical = list.getAttribute('aria-orientation') === 'vertical';
    list.style.setProperty('--n', tabs.length);
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
      });
      list.style.setProperty('--i', i);
      if (focus) tabs[i].focus();
      onSelect(i, tabs[i]);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { if (t.getAttribute('aria-selected') !== 'true') select(i); });
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        let j = null;
        const fwd = vertical ? 'ArrowDown' : 'ArrowRight', back = vertical ? 'ArrowUp' : 'ArrowLeft';
        if (e.key === fwd) j = (i + 1) % n;
        else if (e.key === back) j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j !== null) { e.preventDefault(); select(j, true); }
      });
    });
    return select;
  }

  /* ---------- Hero: a live run board ---------- */
  const JOBS = [
    { title: 'Weekly churn review', steps: ['Listing cancellations in Stripe', 'Reading the last chats in Intercom', 'Drafting 4 win-back offers', 'Waiting for your approval'],
      ask: { q: 'Send win-back offers to 4\u00a0accounts?', who: 'Jo' }, result: '4 offers sent, review in #revenue', skill: 'Churn review, version 4' },
    { title: 'Contract renewals', steps: ['Reading 6 contracts in Drive', 'Checking usage in Stripe', 'Drafting renewal emails in Gmail'],
      result: '6 renewal drafts ready in Gmail' },
    { title: 'Refund requests', steps: ['Reading 9 tickets in Zendesk', 'Checking each order in Shopify', 'Preparing refunds in Stripe', 'Waiting for your approval'],
      ask: { q: 'Refund $86 to order #4471?', who: 'Sam' }, result: '9 tickets closed in Zendesk', skill: 'Refund requests, version 6' },
    { title: 'Lead routing', steps: ['Reading 7 new sign-ups', 'Looking each one up in HubSpot', 'Assigning owners'],
      result: '7 sign-ups assigned in HubSpot' },
    { title: 'Invoice matching', steps: ['Reading 12 invoices in Gmail', 'Finding purchase orders in QuickBooks', 'Comparing the totals', 'Waiting for your approval'],
      ask: { q: 'Release $6,240 to 3\u00a0suppliers?', who: 'Dana' }, result: '12 matched, 1 flagged', skill: 'Invoice matching, version 9' },
  ];
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const hm = (m) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`;

  function hero() {
    const root = $('#run');
    if (!root) return;
    const board = $('.board .seg', root);
    const panels = $$('.board__panel', root);
    segmented(board, (i) => panels.forEach((p, k) => { p.hidden = k !== i; }));

    const list = $('[data-runs]', root);
    const stepEl = $('[data-step]', root), jobEl = $('[data-job]', root), doingEl = $('[data-doing]', root), bar = $('[data-bar]', root);
    const ask = $('[data-ask]', root), askQ = $('[data-ask-q]', root), askWho = $('[data-ask-who]', root), askBtn = $('[data-ask-btn]', root);
    const skill = $('[data-skill]', root), skillName = $('[data-skill-name]', root);
    const stage = $('.stage', root);
    const ptr = $('.stage > [data-pointer]', root);
    const pauseBtn = $('[data-pause]', root);

    if (reduced()) { pauseBtn.hidden = true; return; }

    // both sheets start tucked behind their cards (no transition on this first frame); the request slides out once
    // the stage has settled, the skill tab when the first job is saved
    [ask, skill].forEach((s) => { s.style.transition = 'none'; s.classList.add('is-out'); s.offsetHeight; s.style.transition = ''; });

    let paused = false, onscreen = false, started = false;
    const anims = new Set();
    const track = (a) => {
      anims.add(a);
      a.finished.then(() => anims.delete(a), () => anims.delete(a));
      if (paused || !onscreen || document.hidden) a.pause();
      return a;
    };
    const blocked = () => paused || !onscreen || document.hidden;
    const wait = (ms) => new Promise((res) => {
      let left = ms, last = performance.now();
      const step = (now) => {
        if (!blocked()) left -= now - last;
        last = now;
        if (left <= 0) res();
        else if (blocked()) setTimeout(() => requestAnimationFrame(step), 200);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const sync = () => anims.forEach((a) => (blocked() ? a.pause() : a.play()));

    let barV = .875;
    const barTo = (v, ms) => { const a = track(bar.animate([{ transform: `scaleX(${barV})` }, { transform: `scaleX(${v})` }], { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' })); barV = v; return settle(a); };
    async function barReset() {
      await settle(track(bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' })));
      bar.style.transform = 'scaleX(0)'; barV = 0;
      await settle(track(bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' })));
    }

    async function tap(target) {
      const s = stage.getBoundingClientRect(), t = target.getBoundingClientRect();
      const x1 = t.left - s.left + t.width * .58, y1 = t.top - s.top + t.height * .5;
      const x0 = x1 + 90, y0 = y1 + 110;
      await settle(track(ptr.animate([
        { transform: `translate(${x0}px, ${y0}px)`, opacity: 0 },
        { transform: `translate(${x0 - 18}px, ${y0 - 22}px)`, opacity: 1, offset: .18 },
        { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 },
      ], { duration: 1100, easing: 'cubic-bezier(.35,.1,.15,1)', fill: 'forwards' })));
      target.classList.add('is-press');
      await wait(200);
      target.classList.remove('is-press');
      await wait(160);
      track(ptr.animate([{ transform: `translate(${x1}px, ${y1}px)`, opacity: 1 }, { transform: `translate(${x1 + 26}px, ${y1 + 34}px)`, opacity: 0 }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' }));
    }

    function addRow(time, title, detail) {
      const li = document.createElement('li');
      li.className = 'run';
      li.innerHTML = '<time></time><div><b></b><span></span></div><em>Done</em>';
      li.querySelector('time').textContent = time;
      li.querySelector('b').textContent = title;
      li.querySelector('span').textContent = detail;
      list.prepend(li);
      track(list.animate([{ transform: `translateY(-${li.offsetHeight}px)` }, { transform: 'none' }], { duration: 950, easing: EASE }));
      track(li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 180, easing: 'ease', fill: 'backwards' }));
      setTimeout(() => { while (list.children.length > 4) list.lastElementChild.remove(); }, 1200);
    }

    let clock = 9 * 60 + 31, k = 0;
    async function runJob(job, resume) {
      const N = job.steps.length;
      if (!resume) {
        await barReset();
        swapText(jobEl, job.title);
      }
      for (let i = resume ? N - 1 : 0; i < N; i++) {
        swapText(stepEl, `Step ${i + 1} of ${N}`);
        swapText(doingEl, job.steps[i]);
        const isAsk = job.ask && i === N - 1;
        if (isAsk) {
          if (!resume) {
            await barTo((i + .5) / N, 900);
            askQ.textContent = job.ask.q;
            askWho.textContent = `Asked ${job.ask.who} at ${hm(clock)}`;
            askBtn.textContent = 'Approve';
            askBtn.classList.remove('is-ok');
            ask.classList.remove('is-out');
          }
          if (resume) { await wait(900); ask.classList.remove('is-out'); }
          await wait(resume ? 1700 : 1500);
          await tap(askBtn);
          // the button answers in place: it settles into a quiet sage « Approved »
          await settle(track(askBtn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })));
          askBtn.classList.add('is-ok');
          askBtn.textContent = 'Approved';
          await settle(track(askBtn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: EASE, fill: 'forwards' })));
          askBtn.style.opacity = '';
          await wait(1100);
          ask.classList.add('is-out');
          await barTo(1, 800);
        } else {
          await barTo((i + 1) / N, 1500 + ((i * 37 + k * 11) % 5) * 120);
          await wait(260);
        }
      }
      swapText(stepEl, 'Done');
      swapText(doingEl, job.result);
      await wait(520);
      addRow(hhmm(clock), job.title, job.result);
      const cv = $('canvas[data-loom="hero"]');
      if (window.Loom && cv) { const c = cv.getBoundingClientRect(), r = list.getBoundingClientRect(); Loom.pulse(cv, r.left - c.left + r.width / 2, r.top - c.top + 32); }
      if (job.skill) {
        if (skill.classList.contains('is-out')) { skillName.textContent = job.skill; skill.classList.remove('is-out'); }
        else swapText(skillName, job.skill);
        await wait(2800);
        skill.classList.add('is-out');
        await wait(700);
      } else {
        await wait(1500);
      }
      clock += 17 + ((k * 7) % 13);
    }

    async function loop() {
      await runJob(JOBS[0], true);
      for (k = 1; ; k++) await runJob(JOBS[k % JOBS.length], false);
    }

    const io = new IntersectionObserver(([e]) => {
      onscreen = e.isIntersecting;
      sync();
      if (onscreen && !started) { started = true; cue.then(loop); }
    }, { threshold: .25 });
    io.observe(root);
    document.addEventListener('visibilitychange', sync);

    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', paused);
      pauseBtn.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
      $('use', pauseBtn).setAttribute('href', paused ? '#play' : '#pause');
      if (window.Loom) Loom.pause(paused);
      sync();
    });
  }

  /* ---------- Bento: one job per team ---------- */
  const TEAMS = {
    finance: {
      who: 'Dana', ask: 'Match this week’s invoices to their purchase orders. Flag anything off by more than 2%.',
      plan: 'Plan ready: 3 agents, 1 approval',
      i1: 'gmail', a1: 'Reads 41 invoices', i2: 'quickbooks', a2: 'Finds each purchase order', i3: 'googlesheets', a3: 'Compares the totals',
      out: 'Report posted in #finance',
      atime: '9:12', act: 'Release a payment batch of $18,420', to: '6 suppliers, 41 invoices', why: 'Above your $5,000 limit', done: 'Approved by Dana at 9:14. Sent to the bank file.',
      skill: 'invoice-matching', ver: '7', s1: 'Read new invoices sent to finance@', s2: 'Find each purchase order in QuickBooks', s3: 'Skip card payments under $50',
      s4: 'Compare totals with a 2% tolerance', s5: 'Post exceptions in #finance', note: 'Added after Dana’s correction on Tuesday.',
      when: 'every weekday at 7:00', rtime: '7:04 AM', chan: '#finance', r1: 'Matched 38 of 41 invoices. Three need a look.',
      l1a: 'Northwind Supply', l1b: '4.1% over', l2a: 'Halden & Co', l2b: 'No purchase order', l3a: 'Brightline', l3b: '2.6% over',
    },
    support: {
      who: 'Sam', ask: 'Handle refund requests under $200 the way our policy says, and send me anything unusual.',
      plan: 'Plan ready: 3 agents, 1 approval',
      i1: 'zendesk', a1: 'Reads 23 refund tickets', i2: 'shopify', a2: 'Checks each order', i3: 'stripe', a3: 'Prepares the refunds',
      out: 'Summary posted in #support',
      atime: '10:01', act: 'Refund $86 to order #4471', to: 'Maya Lin, arrived damaged', why: 'Above your $50 limit for refunds', done: 'Approved by Sam at 10:02. Refund sent, customer told.',
      skill: 'refund-requests', ver: '4', s1: 'Read new refund tickets in Zendesk', s2: 'Check the order and delivery in Shopify', s3: 'Ask for a photo when the parcel shows delivered',
      s4: 'Refund in Stripe under your limit', s5: 'Reply in the customer’s language', note: 'Added after Sam’s correction on Monday.',
      when: 'every hour from 8:00 to 20:00', rtime: '11:00 AM', chan: '#support', r1: 'Closed 20 of 23 refund requests. Three need you.',
      l1a: 'Order #4502', l1b: '$240, over the limit', l2a: 'Order #4517', l2b: 'Waiting for a photo', l3a: 'Order #4498', l3b: 'Second refund this month',
    },
    revenue: {
      who: 'Jo', ask: 'List last week’s cancellations, find out why they left, and draft win-back offers for the best accounts.',
      plan: 'Plan ready: 3 agents, 1 approval',
      i1: 'stripe', a1: 'Lists 12 cancellations', i2: 'intercom', a2: 'Reads their last chats', i3: 'hubspot', a3: 'Drafts win-back offers',
      out: 'Review posted in #revenue',
      atime: '8:40', act: 'Send win-back offers to 4 accounts', to: '$2,940 in yearly revenue', why: 'Emails go out under your name', done: 'Approved by Jo at 8:41. Sent from Jo’s inbox.',
      skill: 'churn-review', ver: '3', s1: 'List last week’s cancellations in Stripe', s2: 'Read the last conversations in Intercom', s3: 'Leave out accounts with an open ticket',
      s4: 'Group the reasons and draft offers', s5: 'Post the review in #revenue', note: 'Added after Jo’s correction last Monday.',
      when: 'every Monday at 8:00', rtime: '8:06 AM', chan: '#revenue', r1: '12 cancellations last week. Price came up most.',
      l1a: 'Price', l1b: '5 accounts', l2a: 'Missing integration', l2b: '4 accounts', l3a: 'Team changes', l3b: '3 accounts',
    },
  };

  let selectTeam = () => {};
  function bento() {
    const tabs = $('[data-teams]');
    const grid = $('#bento');
    if (!tabs || !grid) return;
    const flow = $('[data-flow]', grid);
    const svg = $('.flow__wires', flow);
    const node = (n) => $(`[data-node="${n}"]`, flow);
    const approve = $('[data-approve]', grid);
    const approveBtn = $('[data-approve-btn]', grid);
    const ptr = $('[data-pointer]', approve);
    const skillCard = $('[data-skillcard]', grid);
    const report = $('.report', grid);
    let team = 'finance', wires = [];

    function layoutWires() {
      const f = flow.getBoundingClientRect();
      if (!f.width) return;
      const pt = (el, side) => { const r = el.getBoundingClientRect(); return [r.left - f.left + r.width / 2, side === 'top' ? r.top - f.top : r.bottom - f.top]; };
      const curve = (a, b) => { const my = (a[1] + b[1]) / 2; return `M${a[0]} ${a[1]}C${a[0]} ${my} ${b[0]} ${my} ${b[0]} ${b[1]}`; };
      const msg = node('msg'), plan = node('plan'), out = node('out'), ag = ['a1', 'a2', 'a3'].map(node);
      const stacked = getComputedStyle($('.flow__agents', flow)).gridTemplateColumns.split(' ').length < 2;
      const d = [curve(pt(msg, 'bottom'), pt(plan, 'top'))];
      if (stacked) {
        d.push(curve(pt(plan, 'bottom'), pt(ag[0], 'top')), curve(pt(ag[2], 'bottom'), pt(out, 'top')));
      } else {
        ag.forEach((a) => d.push(curve(pt(plan, 'bottom'), pt(a, 'top'))));
        ag.forEach((a) => d.push(curve(pt(a, 'bottom'), pt(out, 'top'))));
      }
      svg.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
      svg.innerHTML = d.map((p) => `<path d="${p}"/>`).join('');
      wires = $$('path', svg).map((p) => { p.__len = p.getTotalLength(); return p; });
    }
    new ResizeObserver(layoutWires).observe(flow);
    document.fonts.ready.then(layoutWires);

    function fill(name) {
      const t = TEAMS[name];
      $$('[data-k]', grid).forEach((el) => { const v = t[el.dataset.k]; if (v != null) el.textContent = v; });
      $$('[data-ki]', grid).forEach((el) => el.setAttribute('href', `#i-${t[el.dataset.ki]}`));
    }

    // each team's copy has its own length: every cell keeps the height of its longest version,
    // so switching teams never moves the page below
    let reservedW = 0;
    function reserve() {
      const w = grid.clientWidth;
      if (!w || w === reservedW) return;
      reservedW = w;
      const cells = $$('.cell', grid);
      cells.forEach((c) => { c.style.minHeight = ''; });
      grid.style.alignItems = 'start';
      const max = cells.map(() => 0);
      Object.keys(TEAMS).forEach((name) => {
        fill(name);
        cells.forEach((c, i) => { max[i] = Math.max(max[i], c.offsetHeight); });
      });
      fill(team);
      grid.style.alignItems = '';
      cells.forEach((c, i) => { c.style.minHeight = `${max[i]}px`; });
    }
    document.fonts.ready.then(() => { reserve(); new ResizeObserver(reserve).observe(grid); });

    let token = 0;
    const drawWire = (p, ms) => {
      if (!p) return Promise.resolve();
      p.style.strokeDasharray = p.__len;
      const a = p.animate([{ strokeDashoffset: p.__len }, { strokeDashoffset: 0 }], { duration: ms, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
      return a.finished.then(() => { p.style.strokeDashoffset = 0; a.cancel(); }, () => {});
    };
    async function play() {
      if (reduced()) return;
      const tok = ++token;
      const live = () => tok === token;
      layoutWires();
      const nodes = ['msg', 'plan', 'a1', 'a2', 'a3', 'out'].map(node);
      const states = $$('[data-state]', flow);
      const planEl = $('[data-k="plan"]', flow);
      const planText = TEAMS[team].plan;
      flow.classList.add('is-play');
      nodes.forEach((n) => n.classList.remove('is-on'));
      states.forEach((s) => { s.textContent = 'Waiting'; s.classList.add('is-work'); });
      wires.forEach((p) => { p.style.strokeDasharray = p.__len; p.style.strokeDashoffset = p.__len; });
      approve.classList.remove('is-done');
      skillCard.classList.remove('is-typed');
      skillCard.classList.add('is-play');
      report.classList.remove('is-shown');
      report.classList.add('is-play');
      const stacked = wires.length < 5;

      // approval, in parallel
      (async () => {
        await sleep(1500); if (!live()) return;
        const c = approve.getBoundingClientRect(), b = approveBtn.getBoundingClientRect();
        const x1 = b.left - c.left + b.width * .55, y1 = b.top - c.top + b.height * .5;
        const a = ptr.animate([
          { transform: `translate(${x1 + 80}px, ${y1 + 70}px)`, opacity: 0 },
          { transform: `translate(${x1 + 64}px, ${y1 + 54}px)`, opacity: 1, offset: .2 },
          { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 },
        ], { duration: 1000, easing: 'cubic-bezier(.35,.1,.15,1)', fill: 'forwards' });
        await a.finished.catch(() => {}); if (!live()) { a.cancel(); return; }
        approveBtn.classList.add('is-press');
        await sleep(200); approveBtn.classList.remove('is-press');
        approve.classList.add('is-done');
        const o = ptr.animate([{ transform: `translate(${x1}px, ${y1}px)`, opacity: 1 }, { transform: `translate(${x1 + 24}px, ${y1 + 30}px)`, opacity: 0 }], { duration: 650, easing: 'ease-in-out', fill: 'forwards' });
        await o.finished.catch(() => {}); a.cancel(); o.cancel();
      })();
      // skill line types in
      (async () => {
        await sleep(1900); if (!live()) return;
        skillCard.classList.add('is-typed');
        await sleep(1900); if (!live()) return;
        skillCard.classList.remove('is-play', 'is-typed');
      })();
      // report lines
      (async () => {
        await sleep(2300); if (!live()) return;
        report.classList.add('is-shown');
        await sleep(1200); if (!live()) return;
        report.classList.remove('is-play', 'is-shown');
      })();

      await sleep(150); if (!live()) return;
      nodes[0].classList.add('is-on');
      await drawWire(wires[0], 480); if (!live()) return;
      nodes[1].classList.add('is-on');
      planEl.textContent = 'Planning the job…';
      await sleep(750); if (!live()) return;
      swapText(planEl, planText);
      if (stacked) await drawWire(wires[1], 420);
      else await Promise.all([1, 2, 3].map((i) => drawWire(wires[i], 520)));
      if (!live()) return;
      nodes.slice(2, 5).forEach((n) => n.classList.add('is-on'));
      states.forEach((s) => { s.textContent = 'Working'; });
      for (let i = 0; i < 3; i++) {
        await sleep(420 + i * 150); if (!live()) return;
        swapText(states[i], 'Done');
        states[i].classList.remove('is-work');
      }
      if (stacked) await drawWire(wires[2], 420);
      else await Promise.all([4, 5, 6].map((i) => drawWire(wires[i], 520)));
      if (!live()) return;
      nodes[5].classList.add('is-on');
      await sleep(500);
      if (live()) flow.classList.remove('is-play');
    }

    let seen = false, inView = false;
    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && !seen) { seen = true; play(); }
    }, { threshold: .3 }).observe(grid);

    const tabsSelect = segmented(tabs, async (i, tab) => {
      const name = tab.dataset.team;
      if (name === team) return;
      team = name;
      grid.setAttribute('aria-labelledby', tab.id);
      token++;
      if (reduced()) { fill(name); return; }
      grid.classList.add('is-swap');
      await sleep(260);
      fill(name);
      grid.classList.remove('is-swap');
      requestAnimationFrame(() => { layoutWires(); if (inView) { seen = true; play(); } });
    });
    const tabList = $$('[role="tab"]', tabs);
    selectTeam = (name) => { const i = tabList.findIndex((t) => t.dataset.team === name); if (i >= 0) tabsSelect(i); };
  }

  /* ---------- Pointer light: panel edges and the silk sheen on woven buttons ---------- */
  function pointerLight() {
    if (!matchMedia('(hover: hover)').matches) return;
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      const e = ev;
      if (!e || !(e.target instanceof Element)) return;
      const lit = e.target.closest('[data-lit]');
      if (lit) {
        const r = lit.getBoundingClientRect();
        lit.style.setProperty('--lx', `${Math.round(e.clientX - r.left)}px`);
        lit.style.setProperty('--ly', `${Math.round(e.clientY - r.top)}px`);
      }
      const w = e.target.closest('.weave');
      if (w) {
        const r = w.getBoundingClientRect();
        w.style.setProperty('--mx', `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
        w.style.setProperty('--my', `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
      }
    };
    document.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const w = e.target instanceof Element && e.target.closest('.weave');
      if (w && !w.contains(e.relatedTarget)) { w.style.removeProperty('--mx'); w.style.removeProperty('--my'); }
    });
  }

  /* ---------- Reveals: each block rises once into place as it enters the screen ---------- */
  function reveals() {
    if (reduced() || !('IntersectionObserver' in window)) return;
    const els = $$('[data-rv]');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add('rv-in');
    }), { rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => {
      // anything already on screen at load stays put: only what is still below the fold waits for its entrance
      if (el.getBoundingClientRect().top < innerHeight * .94) return;
      el.classList.add('rv');
      io.observe(el);
    });
  }


  /* ---------- Eyelets: the arrow always threads through in one direction, in and out ---------- */
  function eyelets() {
    $$('.weave').forEach((btn) => {
      const eye = $('.weave__eye', btn);
      if (!eye) return;
      let [a, b] = $$('svg', eye);
      let busy = false, queued = false;
      const run = () => {
        if (reduced()) return;
        if (busy) { queued = true; return; }
        busy = true;
        const o = { duration: 640, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' };
        const out = a.animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(30px)' }], o);
        const inn = b.animate([{ transform: 'translateX(-30px)' }, { transform: 'translateX(0px)' }], o);
        Promise.all([out.finished, inn.finished]).then(() => {
          a.style.transform = 'translateX(-30px)';
          b.style.transform = 'translateX(0px)';
          out.cancel(); inn.cancel();
          [a, b] = [b, a];
          busy = false;
          if (queued) { queued = false; run(); }
        }, () => { busy = false; });
      };
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') run(); });
      btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') run(); });
    });
  }

  /* ---------- Footer: over the woven word the pointer becomes a thimble that presses the silk ---------- */
  function thimble() {
    const label = $('.label');
    const canvas = label && $('canvas', label);
    if (!label || reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(forced-colors: active)').matches) return;
    const el = document.createElement('div');
    el.className = 'thimble';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="thimble__ring"></span><span class="thimble__dot"></span>';
    el.hidden = true;   // out of the layout until the pointer first reaches the word, and again once it has faded
    document.body.append(el);
    const ring = el.firstElementChild, dot = el.lastElementChild;
    const REST = .3;
    const st = { x: 0, y: 0, rx: 0, ry: 0, vx: 0, vy: 0, s: REST, sv: 0, d: 1, on: false, down: false, raf: 0, t: 0 };
    const frame = (now) => {
      const dt = Math.min(.034, st.t ? (now - st.t) / 1000 : 1 / 60);
      st.t = now;
      // the ring trails the pointer on a critically damped spring; its size on a slightly lively one
      const w = 24;
      st.vx += (w * w * (st.x - st.rx) - 2 * w * st.vx) * dt;
      st.vy += (w * w * (st.y - st.ry) - 2 * w * st.vy) * dt;
      st.rx += st.vx * dt; st.ry += st.vy * dt;
      const goal = st.on ? (st.down ? .62 : 1) : REST;
      const ws = 19, zeta = .66;
      st.sv += (ws * ws * (goal - st.s) - 2 * zeta * ws * st.sv) * dt;
      st.s += st.sv * dt;
      st.d += ((st.down ? 1.7 : 1) - st.d) * (1 - Math.exp(-dt / .07));
      // speed stretches the ring along its path, like a bead of liquid
      const sp = Math.hypot(st.vx, st.vy), k = Math.min(sp / 3400, .18), a = Math.atan2(st.vy, st.vx);
      ring.style.transform = `translate3d(${st.rx.toFixed(2)}px, ${st.ry.toFixed(2)}px, 0) rotate(${a.toFixed(3)}rad) scale(${(st.s * (1 + k)).toFixed(4)}, ${(st.s * (1 - k * .7)).toFixed(4)})`;
      dot.style.transform = `translate3d(${st.x}px, ${st.y}px, 0) scale(${st.d.toFixed(3)})`;
      const idle = !st.on && Math.abs(st.s - REST) < .01 && Math.abs(st.sv) < .05 && sp < 2;
      if (idle) el.hidden = true;
      st.raf = idle ? 0 : requestAnimationFrame(frame);
    };
    const start = () => { if (!st.raf) { st.t = 0; st.raf = requestAnimationFrame(frame); } };
    const enter = (e) => {
      if (e.pointerType !== 'mouse' || st.on) return;
      if (!st.raf) { st.x = st.rx = e.clientX; st.y = st.ry = e.clientY; st.vx = st.vy = 0; }
      st.on = true;
      if (el.hidden) { el.hidden = false; el.offsetWidth; }
      el.classList.add('is-on');
      label.classList.add('is-thimble');
      start();
    };
    const leave = () => {
      if (!st.on) return;
      st.on = false; st.down = false;
      el.classList.remove('is-on');
      label.classList.remove('is-thimble');
      if (window.Loom) Loom.press(canvas, 1);
      start();
    };
    label.addEventListener('pointerenter', enter);
    label.addEventListener('pointerleave', leave);
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      st.x = e.clientX; st.y = e.clientY;
      if (!st.on && e.target instanceof Element && label.contains(e.target)) enter(e);
    }, { passive: true });
    label.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button) return;
      st.down = true;
      if (window.Loom) Loom.press(canvas, 1.6);
      start();
    });
    addEventListener('pointerup', () => {
      if (!st.down) return;
      st.down = false;
      if (window.Loom) Loom.press(canvas, 1);
      start();
    });
  }

  /* ---------- Demo dialog ---------- */
  const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // the dialog says what the button that opened it promised
  const MODES = {
    demo: { title: 'Book a 30-minute demo', intro: 'Bring one job you repeat every week. We set it up with you during the call.',
      when: 'Pick a time, in your time zone', go: 'Book the demo', done: (n, m, s) => `Thanks, ${n}. We’ll email ${m} to confirm ${s}.` },
    trial: { title: 'Start your 14-day trial', intro: 'The trial runs on your own tools. A 30-minute setup call connects them and your first job.',
      when: 'Pick a time for the setup call', go: 'Start the trial', done: (n, m, s) => `Thanks, ${n}. Your trial starts with the setup call on ${s}. The details go to ${m}.` },
    sales: { title: 'Talk to sales', intro: 'Tell us about your setup. An engineer joins the first call to plan a deployment in your own cloud.',
      when: 'Pick a time for the first call', go: 'Book the call', done: (n, m, s) => `Thanks, ${n}. We’ll email ${m} to confirm the call on ${s}.` },
  };
  function demo() {
    const dlg = $('#demo');
    const form = $('#demo-form');
    if (!dlg || !form) return;
    const sets = $$('[data-dstep]', form);
    const marks = $$('.stepper li', form);
    const back = $('[data-back]', form), next = $('[data-next]', form);
    const doneBox = $('[data-done]', form), doneText = $('[data-done-text]', form);
    const arrow = '<svg aria-hidden="true"><use href="#arrow"/></svg>';
    let k = 0, finished = false, opener = null, mode = MODES.demo;
    function setMode(name) {
      mode = MODES[name] || MODES.demo;
      $('#demo-title').textContent = mode.title;
      $('[data-intro]', form).textContent = mode.intro;
      $('[data-when]', form).textContent = mode.when;
      if (!finished) show(k);
    }

    function show(i) {
      k = i;
      sets.forEach((f, j) => { f.hidden = j !== i; });
      marks.forEach((m, j) => {
        if (j === i) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
        m.classList.toggle('is-done', j < i);
      });
      back.hidden = i === 0;
      next.innerHTML = i < 2 ? `Next step${arrow}` : mode.go;
    }
    function reset() {
      form.reset(); finished = false; doneBox.hidden = true;
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      $$('.field__err', form).forEach((el) => { el.textContent = ''; });
      $('.picks-err', form)?.remove();
      show(0);
    }
    function err(input, msg) {
      const box = $(`#${input.id}-err`);
      if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', box.id); box.textContent = msg; }
      else { input.removeAttribute('aria-invalid'); box.textContent = ''; }
      return !msg;
    }
    function valid(i) {
      if (i === 0) {
        const name = $('#d-name'), mail = $('#d-mail'), co = $('#d-co');
        const ok = [
          err(name, name.value.trim() ? '' : 'Enter your name.'),
          err(mail, MAIL.test(mail.value.trim()) ? '' : 'Enter a work email, like dana@northwind.com.'),
          err(co, co.value.trim() ? '' : 'Enter your company name.'),
        ];
        const first = [name, mail, co][ok.indexOf(false)];
        if (first) first.focus();
        return ok.every(Boolean);
      }
      if (i === 1) {
        const any = $$('input[name="tools"]:checked', form).length > 0;
        let box = $('.picks-err', form);
        if (!any) {
          if (!box) { box = document.createElement('p'); box.className = 'field__err picks-err'; box.setAttribute('role', 'alert'); $('.picks', form).after(box); }
          box.textContent = 'Pick at least one tool.';
          $('input[name="tools"]', form).focus();
        } else box?.remove();
        return any;
      }
      return true;
    }
    function finish() {
      finished = true;
      sets.forEach((f) => { f.hidden = true; });
      marks.forEach((m) => { m.removeAttribute('aria-current'); m.classList.add('is-done'); });
      const name = $('#d-name').value.trim().split(/\s+/)[0];
      const slot = $('input[name="slot"]:checked', form)?.value || 'Tuesday at 10:00';
      doneText.textContent = mode.done(name, $('#d-mail').value.trim(), slot);
      doneBox.hidden = false;
      back.hidden = true;
      next.textContent = 'Close';
      doneBox.focus();
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (finished) { dlg.close(); return; }
      if (!valid(k)) return;
      if (k < 2) { show(k + 1); $('input, textarea', sets[k])?.focus(); }
      else finish();
    });
    back.addEventListener('click', () => { if (k > 0) { show(k - 1); $('input', sets[k])?.focus(); } });
    $('[data-close]', form).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { opener?.focus?.(); });
    $$('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      opener = b;
      if (finished) reset();
      setMode(b.dataset.demo);
      dlg.showModal();
      requestAnimationFrame(() => $('input, textarea', sets[k])?.focus());
    }));
    show(0);
  }

  /* ---------- Newsletter ---------- */
  function news() {
    const form = $('#news');
    if (!form) return;
    const input = $('#news-mail'), msg = $('#news-msg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!MAIL.test(v)) {
        input.setAttribute('aria-invalid', 'true');
        msg.classList.add('is-err');
        msg.textContent = 'Enter a valid email address, like you@company.com.';
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      msg.classList.remove('is-err');
      msg.textContent = `Subscribed. The next update goes to ${v}.`;
      form.reset();
    });
  }

  /* ---------- Header ---------- */
  function header() {
    const top = $('#top');
    if (!top) return;
    const on = () => top.classList.toggle('is-stuck', window.scrollY > 40);
    on();
    addEventListener('scroll', on, { passive: true });
    $$('[data-goteam]').forEach((a) => a.addEventListener('click', () => selectTeam(a.dataset.goteam)));
  }

  looms();
  hero();
  bento();
  pointerLight();
  eyelets();
  reveals();
  thimble();
  demo();
  news();
  header();
})();
