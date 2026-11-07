/* Portfolio content: the only place to edit texts.
   Sources: design/cv/cv-data.js and the project journals (fact sheet of 2026-11-01).
   The four SaaS brands are fictional (Topiary Originals): never present them as clients. */
window.SITE = {
  name: 'Martin Gerspach',
  role: 'Creative technologist',
  city: 'Metz',
  tz: 'Europe/Paris',
  email: 'martin.gerspach@gmail.com',
  statement: 'Creative technologist in Metz, France. I make brands, websites, films and apps with AI, and I build the agents that help me make them.',
  intro: 'I make brands, websites, films and apps with AI, and I build the agents that help me make them.',
  links: [
    { label: 'Topiary, my studio', url: 'https://martingerspach.github.io/topiary/', shown: 'martingerspach.github.io/topiary' },
    { label: 'GitHub', url: 'https://github.com/martingerspach', shown: 'github.com/martingerspach' },
  ],
  availability: 'Open to full-time roles and freelance work.',
  where: 'Based in Metz. Ready to work in Luxembourg, Nancy, Strasbourg or Paris.',
  bio: [
    'I studied information and communication, then digital project design, in Metz. I have since worked on websites, social media and AI films for JCD Groupe, the Eurométropole de Metz and the World Trade Center Metz-Strasbourg.',
    'In 2026 I started Topiary, a small production studio. I split each project into parts, brief an AI agent for each one, and review every delivery myself. The projects on this site come from there.',
  ],
  experience: [
    { at: 'Topiary', role: 'Founder', where: 'Metz', when: '2026', kinds: 'web brand film' },
    { at: 'JCD Groupe', role: 'Web design, digital communication, AI films', where: 'Metz', when: '2026', kinds: 'web film' },
    { at: 'Eurométropole de Metz', role: 'Digital communication', where: 'Metz', when: '2025', kinds: 'web' },
    { at: 'World Trade Center Metz-Strasbourg', role: 'Communications officer', where: 'Metz', when: '2024', kinds: 'brand' },
  ],
  education: [
    { at: 'Master’s degree, digital project design', where: 'Metz', when: '2025–2026' },
    { at: 'Bachelor’s degree, information and communication', where: 'Metz', when: '2021–2024' },
  ],
  skills: [
    ['Generative AI', 'Films, UGC, images and voice'],
    ['Motion design', 'Animation, editing, post-production'],
    ['Web and apps', 'UI and UX, front-end, business tools, SEO and GEO'],
    ['Visual identity', 'Logos, brand guidelines, design systems'],
    ['AI agents', 'Orchestration, custom harnesses, workflows'],
    ['Automation', 'n8n workflows and bots wired to business tools'],
  ],
  tools: [
    ['Generation', 'Higgsfield, Sunra (Seedance, Kling), Midjourney, GPT Image, Nano Banana, ElevenLabs, HeyGen'],
    ['Web', 'Figma, Astro, WebGL, Three.js, GSAP'],
    ['Agents', 'Claude Code, Codex, MCP'],
    ['Automation', 'n8n'],
  ],
  languages: 'French (native), English (B2)',
  /* The About page's wiring: which skills each job used (from its kinds; Topiary also runs on agents) and which
     tools serve each skill. A reading of the CV, to be confirmed by Martin. */
  jobSkills: {
    'Topiary': ['Web and apps', 'Visual identity', 'Generative AI', 'Motion design', 'AI agents'],
    'JCD Groupe': ['Web and apps', 'Generative AI', 'Motion design'],
    'Eurométropole de Metz': ['Web and apps'],
    'World Trade Center Metz-Strasbourg': ['Visual identity'],
  },
  skillTools: {
    'Generative AI': ['Higgsfield', 'Sunra', 'Seedance', 'Kling', 'Midjourney', 'GPT Image', 'Nano Banana', 'ElevenLabs', 'HeyGen'],
    'Motion design': ['GSAP', 'WebGL', 'Three.js', 'Higgsfield', 'Seedance', 'Kling'],
    'Web and apps': ['Figma', 'Astro', 'WebGL', 'Three.js', 'GSAP', 'Claude Code', 'Codex'],
    'Visual identity': ['Figma', 'Midjourney', 'GPT Image', 'Nano Banana'],
    'AI agents': ['Claude Code', 'Codex', 'MCP'],
    'Automation': ['n8n', 'MCP'],
  },
};

/* Each project opens on its live page (site, a path inside the artifact), at the top, with no extra text.
   Reel frames and the playground come from content.js (built by outils/contenu.py). */
window.PROJECTS = [
  /* Order of the reel (2026-11-07, the user asked for the most coherent sequence of the ten covers): one loop of colour,
     warm dark and coral (Topiary), green (Weft), black (Iris), night blues (Redline, Auvent), cobalt (Tiroir), whites
     (Banc, Quart), cream (Understudy), crimson (Glossa), and back to the coral. Topiary stays first: the opening lands on it. */
  {
    id: 'topiary',
    name: 'Topiary',
    kind: 'Studio brand and website',
    tag: 'My production studio',
    short: 'My production studio: its brand, its website and a launch film in motion design.',
    year: '2026',
    role: 'Founder. Brand, design, code, film',
    scope: ['Identity', 'Website', 'Motion design'],
    tools: ['WebGL2', 'Canvas 2D', 'Higgsfield', 'Seedance', 'Python'],
    site: 'topiary/index.html',
    reveal: 'lift',          // the reel shows the brand, not the page: it lifts away instead of dissolving
    film: { tab: 'Motion design', title: 'Méthode, the launch film', src: 'media/methode/methode-1600.mp4', poster: 'media/methode/poster.webp' },
  },
  {
    id: 'weft',
    name: 'Weft',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, my own concept',
    short: 'Agents that run a team’s weekly jobs, shown on a satin woven live in WebGL.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demos'],
    tools: ['WebGL2 weave shader', 'Canvas 2D', 'Web Animations'],
    site: 'landings/weft/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'iris',
    name: 'Iris',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, my own concept',
    short: 'Tracing for AI agents: each run is played back as a film, lit by live caustics.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demos'],
    tools: ['WebGL2 caustics', 'SVG liquid glass', 'Canvas 2D'],
    site: 'landings/iris/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'redline',
    name: 'Redline',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, my own concept',
    short: 'Agents that check every file against its brand book, at work like designers in a shared file.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demo'],
    tools: ['Midjourney', 'Homography inlay', 'Fitts’s law cursors'],
    site: 'landings/redline/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'auvent',
    name: 'Auvent',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, a Topiary Original',
    short: 'A weather planner for building sites, with playable demos.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demos'],
    tools: ['SVG', 'CSS liquid glass', 'GPT Image'],
    site: 'topiary/originals/auvent/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'tiroir',
    name: 'Tiroir',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, a Topiary Original',
    short: 'An assistant that answers from your files and shows the exact passage.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demo'],
    tools: ['Midjourney', 'WebGL', 'Web Animations'],
    site: 'topiary/originals/tiroir/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'banc',
    name: 'Banc',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, a Topiary Original',
    short: 'A research tool whose hero is a school of fish drawn in characters.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demo'],
    tools: ['WebGL2', 'Boids', 'Glyph rendering'],
    site: 'topiary/originals/banc/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'quart',
    name: 'Quart',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, a Topiary Original',
    short: 'Night shifts for AI coding agents, drawn like an architect’s plan.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demo'],
    tools: ['Isometric SVG', 'Spring physics', 'fontTools'],
    site: 'topiary/originals/quart/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'understudy',
    name: 'Understudy',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, my own concept',
    short: 'An agent that replays routines in old software, staged as a theatre programme.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demo'],
    tools: ['FLUX', 'Canvas 2D', 'Photo inlay in Python'],
    site: 'landings/understudy/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
  {
    id: 'glossa',
    name: 'Glossa',
    kind: 'SaaS landing page',
    tag: 'Fictional brand, my own concept',
    short: 'Localisation that ships with the code, printed in pixel type and crimson halftone.',
    year: '2026',
    role: 'Brand, copywriting, design, code',
    scope: ['Identity', 'Landing page', 'Interactive demos'],
    tools: ['Midjourney', 'WebGL halftone', 'Pixel font from Geist'],
    site: 'landings/glossa/index.html',
    reveal: 'lift',          // its reel frame is the brand cover, not the page
  },
];
