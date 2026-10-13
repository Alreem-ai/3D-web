(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  /* ---------- Non-3D UI ---------- */
  document.querySelectorAll('.bar .fill').forEach(f => { f.style.width = f.dataset.w + '%'; });

  const input = document.getElementById('promptInput');
  const parsedEl = document.getElementById('parsed');
  const promptState = { text: '', nums: [], typedAt: -1e9 };
  const parseNums = s => (s.match(/\d+(?:\.\d+)?/g) || []).slice(0, 4);
  input.addEventListener('input', () => {
    promptState.text = input.value;
    promptState.nums = parseNums(input.value);
    promptState.typedAt = performance.now();
    parsedEl.innerHTML = promptState.nums.length
      ? 'Found: ' + promptState.nums.map(n => '<span class="mm">' + n + ' mm</span>').join('')
      : 'The robot reads every millimetre value as you type.';
  });
  document.getElementById('promptForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!promptState.nums.length) { parsedEl.textContent = 'Add a size first, for example: plate 60 × 40 × 5 mm.'; input.focus(); return; }
    document.getElementById('scale').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });
  /* ---------- Router: one page per hash (#studio, #how, …) ---------- */
  const ROUTES = ['home', 'studio', 'how', 'library', 'results', 'about', 'guide'];
  const routeEls = [...document.querySelectorAll('.pg')];
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const menuBtn = document.getElementById('menuBtn'), navEl = document.getElementById('navlinks');
  const routeHooks = [];
  let currentRoute = null;
  function applyRoute() {
    let r = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!r || r === 'top') r = 'home';
    if (!ROUTES.includes(r)) r = '404';
    if (r === currentRoute) return;
    currentRoute = r;
    routeEls.forEach(el => { el.hidden = el.dataset.route !== r; });
    navLinks.forEach(a => { if (a.dataset.nav === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    navEl.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'instant' });
    routeHooks.forEach(fn => fn(r));
  }
  menuBtn.addEventListener('click', () => {
    const open = !navEl.classList.contains('open');
    navEl.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open);
  });
  addEventListener('hashchange', applyRoute);
  applyRoute();
  function openInStudio(prompt) {
    const ta = document.getElementById('stPrompt');
    ta.value = prompt;
    location.hash = 'studio';
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
  }

  /* ---------- How it works: architecture diagram ---------- */
  const ARCH = {
    prompt: ['Prompt', 'A plain-language request with its sizes in millimetres, like “Split shaft collar, 16 mm bore, 32 mm OD, 12 mm wide”.'],
    spec: ['Spec parser', 'Pulls out the part type, every dimension in mm and each feature (hole Ø, count, position) into a structured spec. Studio shows it to you, so a misread is caught before anything is built.'],
    rag: ['Recipe RAG', 'Compares the spec with the 8 engineering families and retrieves the closest recipe, together with its similarity score.'],
    router: ['Router', 'A confident family match goes to the deterministic compiler. Anything else goes to the corrected QLoRA fallback.'],
    compiler: ['Deterministic compiler', 'Fills the family recipe with your numbers and writes the CadQuery code directly, so known parts come out at exact size.'],
    qlora: ['Corrected QLoRA', 'A fine-tuned model writes CadQuery for parts outside the 8 families. If the code fails, it gets up to 3 repair loops.'],
    valid: ['Validation chain', 'Four checks in order: AST safety, isolated execution, watertight mesh and the envelope check against your millimetres. A part has to pass all four.'],
    export: ['Export', 'The validated part is exported as STEP for CAD tools, STL for 3D printers and GLB for the web.'],
  };
  const archDetail = document.getElementById('archDetail');
  const archNodes = [...document.querySelectorAll('#arch .node')];
  function showArch(k) {
    archNodes.forEach(n => n.setAttribute('aria-expanded', n.dataset.n === k));
    archDetail.innerHTML = '';
    const h = document.createElement('h3'); h.textContent = ARCH[k][0];
    const p = document.createElement('p'); p.textContent = ARCH[k][1];
    archDetail.append(h, p);
  }
  archNodes.forEach(n => n.addEventListener('click', () => showArch(n.dataset.n)));
  showArch('rag');

  /* ---------- How it works: stretch vs build-in-mm demo ---------- */
  const svg = document.getElementById('scaleSvg'), range = document.getElementById('scaleRange'), scaleNote = document.getElementById('scaleNote');
  let scaleMode = 'axis';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; };
  function drawScale() {
    const t = range.value / 100, px = 4, cx = 180, cy = 118;
    const w = lerp(40, 60 * px, t), h = lerp(40, 40 * px, t);
    let rx, ry;
    if (scaleMode === 'axis') { rx = .15 * w; ry = .15 * h; } else { rx = ry = lerp(6, 3 * px, t); }
    svg.innerHTML = '';
    svg.append(
      el('rect', { x: cx - 120, y: cy - 80, width: 240, height: 160, fill: 'none', stroke: 'rgba(94,214,255,.45)', 'stroke-dasharray': '5 5' }),
      el('text', { x: cx + 120, y: cy - 86, 'text-anchor': 'end', fill: '#8fa5c2', 'font-size': 11, 'font-family': 'IBM Plex Mono, monospace' }, 'target 60 × 40 mm'),
      el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 4, fill: '#16294a', stroke: '#5ed6ff', 'stroke-width': 1.5 }),
      el('ellipse', { cx, cy, rx, ry, fill: '#0a1628', stroke: scaleMode === 'axis' && t > .05 ? '#ff8a2a' : '#5ed6ff', 'stroke-width': 2 })
    );
    const dw = (rx * 2 / px).toFixed(1), dh = (ry * 2 / px).toFixed(1);
    svg.append(el('text', { x: cx, y: 238, 'text-anchor': 'middle', fill: scaleMode === 'axis' && dw !== dh ? '#ff8a2a' : '#e8f1fb', 'font-size': 13, 'font-family': 'IBM Plex Mono, monospace' },
      'hole ' + (dw === dh ? 'Ø' + dw + ' mm · round' : dw + ' × ' + dh + ' mm · oval')));
    scaleNote.textContent = scaleMode === 'axis'
      ? 'Stretching X by 60 and Y by 40 also stretches the hole. A bolt won’t fit an oval.'
      : 'Building the part in real millimetres keeps the hole round at the size you asked for.';
  }
  document.querySelectorAll('.segb').forEach(b => b.addEventListener('click', () => {
    scaleMode = b.dataset.mode;
    document.querySelectorAll('.segb').forEach(x => x.setAttribute('aria-pressed', x === b));
    drawScale();
  }));
  range.addEventListener('input', drawScale);
  drawScale();

  /* ---------- Prompt guide: live checker ---------- */
  const gPrompt = document.getElementById('gPrompt'), gChecks = [...document.querySelectorAll('#gChecks li')];
  const guide = { score: 0, typed: false };
  function checkPrompt() {
    const t = gPrompt.value.toLowerCase().replace(/×/g, 'x');
    const ok = {
      mm: /\d\s*(mm|millimet)/.test(t),
      type: /\b(plate|bracket|collar|bearing|mount|flange|sheet|panel)\b/.test(t),
      size: /\d+(?:\.\d+)?\s*(?:mm)?\s*x\s*\d+(?:\.\d+)?/.test(t),
      dia: /[øØ⌀φ]\s*\d|\d+(?:\.\d+)?\s*mm\s*(dia|bore|od|hole)|\bbore\b\s*\d|\bm\d/.test(t),
      count: /(\d+|one|two|three|four|six|eight)\s*(x\s*)?(mounting\s+|bolt\s+|sensor\s+)?holes?|from\s+(each|the)?\s*(corner|edge)|centred|centered|\bslot\b/.test(t),
    };
    guide.score = 0;
    gChecks.forEach(li => { const on = ok[li.dataset.k]; li.classList.toggle('on', on); if (on) guide.score++; });
    guide.typed = t.trim().length > 0;
  }
  gPrompt.addEventListener('input', checkPrompt);
  document.getElementById('gOpen').addEventListener('click', () => openInStudio(gPrompt.value.trim() || 'Plate 60 × 40 × 5 mm with 4 holes Ø5 mm, 6 mm from each corner'));
  /* ---------- Spec parsing, demo routing and CadQuery code (shared by Studio + Guide) ---------- */
  const FAMS = {
    plate:   { name: 'Plate', core: /\b(plate|sheet|panel)\b/, words: ['plate', 'sheet', 'panel', 'mounting', 'base', 'flat'], route: 'qlora' },
    bearing: { name: 'Flanged bearing mount', core: /\b(bearing|flanged?)\b/, words: ['bearing', 'flange', 'flanged', 'mount', 'boss', 'bore', 'pillow'], route: 'compiler' },
    bracket: { name: 'U-shaped sensor bracket', core: /\bbracket\b/, words: ['bracket', 'u', 'u-shaped', 'sensor', 'channel', 'uprights', 'side'], route: 'compiler' },
    collar:  { name: 'Split shaft collar', core: /\bcollar\b/, words: ['collar', 'shaft', 'split', 'clamp', 'bore', 'od', 'ring'], route: 'compiler' },
  };
  const UNKNOWN_HINT = /\b(gear|pulley|spring|hinge|knob|screw|bolt|nut|wheel|propeller|enclosure|box|case|vase|cup|hook)\b/;
  const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8 };
  const num = s => (s == null ? null : parseFloat(s));
  const r1 = v => Math.round(v * 100) / 100;
  const fmt = v => (Math.round(v * 100) / 100).toString();

  function parseSpec(raw) {
    const text = (raw || '').trim(), t = text.toLowerCase().replace(/×/g, 'x').replace(/,/g, ' , ');
    const out = { text, family: null, params: null, assumed: [], issues: [], features: [] };
    const hasNum = /\d/.test(t), hasMM = /\d\s*(mm|millimet)|mm\b/.test(t);
    if (!text) { out.fail = { stage: 'spec', reason: 'Describe a part first, for example: Plate 60 × 40 × 5 mm with 4 holes Ø5 mm.' }; return out; }
    if (!hasNum) { out.fail = { stage: 'spec', reason: 'I need sizes in millimetres. Try: U sensor bracket 50 × 30 × 35 mm.' }; return out; }
    if (!hasMM) { out.fail = { stage: 'spec', reason: 'No units. Add mm so I don’t have to guess the scale. Guessing is how parts come out at 0.0188.' }; return out; }

    const tri = t.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?(?:\s*x\s*(\d+(?:\.\d+)?))?/);
    const dias = [...t.matchAll(/[øØ⌀φ]\s*(\d+(?:\.\d+)?)/g)].map(m => num(m[1]))
      .concat([...t.matchAll(/(\d+(?:\.\d+)?)\s*mm\s*(?:dia(?:meter)?|hole)/g)].map(m => num(m[1])))
      .concat([...t.matchAll(/\bm(\d+(?:\.\d+)?)\b/g)].map(m => num(m[1])));
    const cm = t.match(/(\d+|one|two|three|four|five|six|eight)\s*(?:x\s*)?(?:mounting\s+|bolt\s+|through\s+|sensor\s+)?holes?\b/);
    const count = cm ? (WORDNUM[cm[1]] || parseInt(cm[1], 10)) : (/\bholes?\b/.test(t) ? 1 : 0);
    const pick = (re) => { const m = t.match(re); return m ? num(m[1] || m[2]) : null; };
    const bore = pick(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*bore|bore\s*(?:of\s*|ø\s*|diameter\s*)?(\d+(?:\.\d+)?)/);
    const od = pick(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:od\b|outer)|(?:\bod|outer diameter)\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
    const wide = pick(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:wide|width)\b/);
    const thick = pick(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*thick/);
    const inset = pick(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*from\s*(?:each|the)?\s*(?:corner|edge)s?/);

    // family by keyword overlap (the demo's toy retriever)
    const toks = new Set(t.split(/[^a-z\-]+/).filter(Boolean));
    let best = null, bestScore = 0;
    for (const k in FAMS) {
      const f = FAMS[k]; if (!f.core.test(t)) continue;
      const hits = f.words.filter(w => toks.has(w)).length;
      const s = Math.min(.93, .38 + hits * .07);
      if (s > bestScore) { bestScore = s; best = k; }
    }
    out.similarity = r1(bestScore);
    if (!best || UNKNOWN_HINT.test(t) && !/\b(plate|bracket|collar|bearing)\b/.test(t)) {
      out.family = null; out.similarity = r1(.12 + Math.min(.15, toks.size * .01));
      out.label = text.length > 42 ? text.slice(0, 40) + '…' : text;
      return out; // routed to QLoRA fallback, which only runs on the backend
    }
    out.family = best;
    const A = (key, v) => { out.assumed.push(key); return v; };
    let p;
    if (best === 'plate') {
      if (!tri || !(tri[3] || thick)) { out.fail = { stage: 'spec', reason: 'For a plate I need width × depth × thickness, like 60 × 40 × 5 mm.' }; return out; }
      const W = num(tri[1]), D = num(tri[2]), T = num(tri[3]) || thick;
      const d = dias[0] || (count ? A('hole Ø', 5) : 0);
      const ins = inset || (count ? A('hole inset', Math.round(Math.max(d * 1.2, Math.min(W, D) * .15) * 2) / 2) : 0);
      p = { W, D, T, n: count, d, inset: ins };
      p.holes = holeLayout(p);
      out.features = count ? [count + ' hole' + (count > 1 ? 's' : '') + ' Ø' + fmt(d), count > 1 ? fmt(ins) + ' mm from the edges' : 'centred'] : [];
      out.envelope = [W, T, D];
    } else if (best === 'bearing') {
      const W = tri ? num(tri[1]) : A('size', 48), D = tri ? num(tri[2]) : 48, H = tri && tri[3] ? num(tri[3]) : A('height', 18);
      const b = bore || A('bore Ø', 16);
      const bolt = dias.find(v => v !== b) || A('bolt hole Ø', 5.5);
      p = { W, D, H, tf: r1(H / 3), bossR: r1(Math.min(W, D) * .3125), bore: b, bolt, inset: 6 };
      out.features = ['bore Ø' + fmt(b), '4 bolt holes Ø' + fmt(bolt), 'flange ' + fmt(p.tf) + ' mm'];
      out.envelope = [W, H, D];
    } else if (best === 'bracket') {
      const W = tri ? num(tri[1]) : A('size', 50), D = tri ? num(tri[2]) : 30, H = tri && tri[3] ? num(tri[3]) : A('height', 35);
      const tt = thick || A('wall', 5), sd = dias[0] || A('sensor hole Ø', 10);
      p = { W, D, H, t: tt, sensorD: sd, sensorY: r1(tt + (H - tt) * .55), baseD: 5.2, baseX: r1(W * .24) };
      out.features = ['walls ' + fmt(tt) + ' mm', 'sensor hole Ø' + fmt(sd) + ' in each side', '2 base holes Ø5.2'];
      out.envelope = [W, H, D];
    } else {
      const OD = od || (dias.length ? Math.max(...dias) : (tri ? num(tri[1]) : A('outer Ø', 32)));
      const b = bore || A('bore Ø', 16), w = wide || (tri && tri[3] ? num(tri[3]) : A('width', 12));
      p = { OD, bore: b, width: w, slot: 1.5 };
      out.features = ['bore Ø' + fmt(b), 'outer Ø' + fmt(OD), 'split slot 1.5 mm'];
      out.envelope = [OD, w, OD];
    }
    out.params = p;
    const e = out.envelope;
    out.label = FAMS[best].name + ' · ' + fmt(e[0]) + ' × ' + fmt(e[2]) + ' × ' + fmt(e[1]) + ' mm';
    if (best === 'plate') out.label = 'Plate · ' + fmt(p.W) + ' × ' + fmt(p.D) + ' × ' + fmt(p.T) + ' mm' + (p.n ? ' · ' + p.n + ' hole' + (p.n > 1 ? 's' : '') + ' Ø' + fmt(p.d) : '');
    return out;
  }

  function holeLayout({ W, D, n, inset }) {
    const xs = [], hx = W / 2 - inset, hz = D / 2 - inset;
    if (!n) return xs;
    if (n === 1) return [[0, 0]];
    if (n === 2) return [[-hx, 0], [hx, 0]];
    if (n === 4) return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    if (n % 2 === 0 && n <= 12) { const c = n / 2; for (let i = 0; i < c; i++) { const x = -hx + (2 * hx) * i / (c - 1); xs.push([x, -hz], [x, hz]); } return xs; }
    for (let i = 0; i < n; i++) xs.push([-hx + (2 * hx) * i / Math.max(1, n - 1), 0]);
    return xs;
  }

  // Checks that don't need geometry. Returns {exec, water} failures (null = pass).
  function preflight(fam, p) {
    const r = { exec: null, water: null };
    const pos = Object.values(p).filter(v => typeof v === 'number');
    if (pos.some(v => !(v >= 0)) || pos.some(v => v > 2000)) r.exec = 'A dimension is negative or over 2 m.';
    if (fam === 'plate') {
      if (p.T >= Math.min(p.W, p.D)) r.exec = 'Thickness is bigger than the plate itself.';
      if (p.n) {
        if (p.inset - p.d / 2 < 1) r.water = 'Holes break through the edge. Move them in or make them smaller.';
        for (let i = 0; i < p.holes.length && !r.water; i++) for (let j = i + 1; j < p.holes.length; j++) {
          const a = p.holes[i], b = p.holes[j];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) < p.d + 1) { r.water = 'Holes overlap each other.'; break; }
        }
      }
    } else if (fam === 'bearing') {
      if (p.bore >= p.bossR * 2 - 4) r.water = 'The bore is wider than the boss around it.';
      if (p.inset - p.bolt / 2 < 1 || p.bossR * 2 > Math.min(p.W, p.D)) r.water = r.water || 'Bolt holes break into the boss or the edge.';
    } else if (fam === 'bracket') {
      if (p.t * 2 >= p.W || p.t >= p.H) r.exec = 'Walls are thicker than the bracket.';
      if (p.sensorD >= p.D - 4 || p.sensorY + p.sensorD / 2 > p.H - 2) r.water = 'The sensor hole is too big for the side walls.';
    } else if (fam === 'collar') {
      if (p.bore >= p.OD - 6) r.exec = 'The wall is too thin to clamp: bore must be at least 6 mm smaller than the outer Ø.';
    }
    return r;
  }

  function cadquery(fam, p, label) {
    const f = v => fmt(v);
    const head = 'import cadquery as cq\n\n# ' + label + '\n';
    if (fam === 'plate') {
      let s = head + 'result = (\n    cq.Workplane("XY")\n    .box(' + f(p.W) + ', ' + f(p.D) + ', ' + f(p.T) + ')\n';
      if (p.n) s += '    .faces(">Z").workplane()\n    .pushPoints([' + p.holes.map(h => '(' + f(h[0]) + ', ' + f(-h[1]) + ')').join(', ') + '])\n    .hole(' + f(p.d) + ')\n';
      return s + ')\n';
    }
    if (fam === 'bearing') {
      return head +
        'flange = (\n    cq.Workplane("XY")\n    .box(' + f(p.W) + ', ' + f(p.D) + ', ' + f(p.tf) + ', centered=(True, True, False))\n    .edges("|Z").fillet(4)\n' +
        '    .faces(">Z").workplane()\n    .rect(' + f(p.W - 2 * p.inset) + ', ' + f(p.D - 2 * p.inset) + ', forConstruction=True).vertices()\n    .hole(' + f(p.bolt) + ')\n)\n' +
        'boss = cq.Workplane("XY").workplane(offset=' + f(p.tf) + ').circle(' + f(p.bossR) + ').extrude(' + f(p.H - p.tf) + ')\n' +
        'result = flange.union(boss).faces(">Z").workplane().hole(' + f(p.bore) + ')\n';
    }
    if (fam === 'bracket') {
      return head +
        'base = (\n    cq.Workplane("XY")\n    .box(' + f(p.W) + ', ' + f(p.D) + ', ' + f(p.t) + ', centered=(True, True, False))\n' +
        '    .faces(">Z").workplane()\n    .pushPoints([(' + f(-p.baseX) + ', 0), (' + f(p.baseX) + ', 0)])\n    .hole(' + f(p.baseD) + ')\n)\n' +
        'side = cq.Workplane("YZ").rect(' + f(p.D) + ', ' + f(p.H) + ', centered=(True, False)).extrude(' + f(p.t) + ')\n' +
        'result = base.union(side.translate((' + f(-p.W / 2) + ', 0, 0))).union(side.translate((' + f(p.W / 2 - p.t) + ', 0, 0)))\n' +
        'sensor = (\n    cq.Workplane("YZ").workplane(offset=' + f(-p.W / 2) + ')\n    .center(0, ' + f(p.sensorY) + ').circle(' + f(p.sensorD / 2) + ').extrude(' + f(p.W) + ')\n)\n' +
        'result = result.cut(sensor)\n';
    }
    return head +
      'ring = cq.Workplane("XY").circle(' + f(p.OD / 2) + ').circle(' + f(p.bore / 2) + ').extrude(' + f(p.width) + ')\n' +
      'slot = (\n    cq.Workplane("XY")\n    .center(' + f((p.OD / 2 + p.bore / 2) / 2) + ', 0)\n    .rect(' + f(p.OD / 2 - p.bore / 2 + 1) + ', ' + f(p.slot) + ')\n    .extrude(' + f(p.width) + ')\n)\n' +
      'result = ring.cut(slot)\n';
  }
  const T = window.THREE;
  if (!T) return;

  /* ---------- Shared helpers ---------- */
  const C = { cyan: '#5ed6ff', orange: '#ff8a2a', navy: '#0a1628' };
  const MM = 0.025; // world units per millimetre on the workbench
  const DIMS = { plate: [60, 5, 40], bearing: [48, 18, 48], bracket: [50, 35, 30], collar: [32, 12, 32] };
  const NAMES = { bearing: 'Flanged bearing mount', bracket: 'U-shaped sensor bracket', collar: 'Split shaft collar' };
  const FILES = { bearing: 'bearing_mount', bracket: 'sensor_bracket', collar: 'shaft_collar' };
  const col = h => new T.Color(h).convertSRGBToLinear();
  const std = (h, r = .5, m = 0, extra = {}) => new T.MeshStandardMaterial(Object.assign({ color: col(h), roughness: r, metalness: m }, extra));
  const basic = (h, extra = {}) => new T.MeshBasicMaterial(Object.assign({ color: col(h) }, extra));
  const tmpV = new T.Vector3(), tmpV2 = new T.Vector3();

  function rrShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function rbox(w, h, d, r, m) {
    const b = 0.02;
    const g = new T.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, r), { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -(d - 2 * b) / 2);
    return new T.Mesh(g, m);
  }
  function rrPath(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function label(text, { fg = '#e8f1fb', border = C.cyan, h = .17, px = 40 } = {}) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const font = '600 ' + px + 'px "IBM Plex Mono", ui-monospace, monospace';
    x.font = font;
    c.width = Math.ceil(x.measureText(text).width + px * 1.1); c.height = Math.round(px * 1.75);
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    rrPath(x, 3, 3, c.width - 6, c.height - 6, 10); x.fillStyle = 'rgba(10,22,40,.9)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = border; x.stroke();
    x.fillStyle = fg; x.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    sp.scale.set(h * c.width / c.height, h, 1); sp.renderOrder = 20;
    return sp;
  }
  function fade(obj, o) {
    obj.visible = o > 0.005;
    obj.traverse(n => {
      if (!n.material) return;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
        if (m.userData.base === undefined) m.userData.base = m.opacity;
        m.transparent = true; m.opacity = m.userData.base * o;
      });
    });
  }
  // Dimension lines (world units) around a part whose base sits at y=0, centred in x/z
  function partDims(size, scale, labelH = .15, off = .14) {
    const k = off / .14, [X, Y, Z] = size.map(v => v * scale), g = new T.Group();
    const m = new T.LineBasicMaterial({ color: col(C.cyan), transparent: true, depthTest: false });
    const pts = [], add = (a, b, tick) => { pts.push(a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)); };
    const tv = new T.Vector3(0, .05 * k, 0), th = new T.Vector3(.05 * k, 0, 0);
    const w1 = new T.Vector3(-X / 2, 0, Z / 2 + off), w2 = new T.Vector3(X / 2, 0, Z / 2 + off); add(w1, w2, tv);
    const d1 = new T.Vector3(X / 2 + off, 0, -Z / 2), d2 = new T.Vector3(X / 2 + off, 0, Z / 2); add(d1, d2, tv);
    const h1 = new T.Vector3(X / 2 + off, 0, Z / 2 + off), h2 = new T.Vector3(X / 2 + off, Y, Z / 2 + off); add(h1, h2, th);
    const ls = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), m); ls.renderOrder = 19; g.add(ls);
    const lab = (a, b, t, txt) => { const l = label(txt, { h: labelH }); l.position.copy(a).add(b).multiplyScalar(.5).add(t.multiplyScalar(k)); g.add(l); };
    const f = v => Math.round(v * 100) / 100;
    lab(w1, w2, new T.Vector3(0, -.06, .16), f(size[0]) + ' mm');
    lab(d1, d2, new T.Vector3(.3, 0, -.16), f(size[2]) + ' mm');
    lab(h1, h2, new T.Vector3(.34, .06, .14), f(size[1]) + ' mm');
    return g;
  }

  /* ---------- Parts (geometry in mm, base on y=0), built from parameters ---------- */
  const circ = (x, y, r) => { const p = new T.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };
  let CURVE = 40;
  const ext = (s, d) => { const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: CURVE }); g.rotateX(-Math.PI / 2); return g; };
  const DEFAULTS = {
    plate: { W: 60, D: 40, T: 5, n: 0, d: 0, inset: 0, holes: [] },
    bearing: { W: 48, D: 48, H: 18, tf: 6, bossR: 15, bore: 16, bolt: 5.5, inset: 6 },
    bracket: { W: 50, D: 30, H: 35, t: 5, sensorD: 10, sensorY: 24, baseD: 5.2, baseX: 12 },
    collar: { OD: 32, bore: 16, width: 12, slot: 1.5 },
  };
  function buildGeos(kind, p) {
    if (kind === 'plate') {
      const s = rrShape(p.W, p.D, Math.min(3, Math.min(p.W, p.D) * .1));
      (p.holes || []).forEach(([x, z]) => s.holes.push(circ(x, -z, p.d / 2)));
      return [ext(s, p.T)];
    }
    if (kind === 'bearing') {
      const s = rrShape(p.W, p.D, 4), hx = p.W / 2 - p.inset, hz = p.D / 2 - p.inset;
      [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([x, y]) => s.holes.push(circ(x, y, p.bolt / 2)));
      s.holes.push(circ(0, 0, p.bore / 2));
      const boss = new T.Shape(); boss.absarc(0, 0, p.bossR, 0, Math.PI * 2, false); boss.holes.push(circ(0, 0, p.bore / 2));
      const b = ext(boss, p.H - p.tf); b.translate(0, p.tf, 0);
      return [ext(s, p.tf), b];
    }
    if (kind === 'bracket') {
      const W = p.W, D = p.D, base = new T.Shape();
      base.moveTo(-W / 2, -D / 2); base.lineTo(W / 2, -D / 2); base.lineTo(W / 2, D / 2); base.lineTo(-W / 2, D / 2); base.closePath();
      base.holes.push(circ(-p.baseX, 0, p.baseD / 2), circ(p.baseX, 0, p.baseD / 2));
      const up = () => {
        const s = new T.Shape(); s.moveTo(-D / 2, 0); s.lineTo(D / 2, 0); s.lineTo(D / 2, p.H); s.lineTo(-D / 2, p.H); s.closePath();
        s.holes.push(circ(0, p.sensorY, p.sensorD / 2));
        const g = new T.ExtrudeGeometry(s, { depth: p.t, bevelEnabled: false, curveSegments: CURVE }); g.rotateY(Math.PI / 2); return g;
      };
      const l = up(); l.translate(-W / 2, 0, 0); const r = up(); r.translate(W / 2 - p.t, 0, 0);
      return [ext(base, p.t), l, r];
    }
    // split shaft collar, slot facing the viewer
    const R = p.OD / 2, rb = p.bore / 2, a = (p.slot / 2) / R, b = (p.slot / 2) / rb, s = new T.Shape();
    s.moveTo(R * Math.cos(a), R * Math.sin(a)); s.absarc(0, 0, R, a, Math.PI * 2 - a, false);
    s.lineTo(rb * Math.cos(-b), rb * Math.sin(-b)); s.absarc(0, 0, rb, Math.PI * 2 - b, b, true); s.closePath();
    const g = ext(s, p.width); g.rotateY(-Math.PI / 2);
    return [g];
  }
  const partGeos = kind => buildGeos(kind, DEFAULTS[kind]);
  function makePart(kind, mat, edgeOpacity = .45, extraEdge = {}, geos) {
    const g = new T.Group();
    const em = new T.LineBasicMaterial(Object.assign({ color: col(C.cyan), transparent: true, opacity: edgeOpacity }, extraEdge));
    (geos || partGeos(kind)).forEach(geo => {
      g.add(new T.Mesh(geo, mat));
      g.add(new T.LineSegments(new T.EdgesGeometry(geo, 28), em));
    });
    g.userData.edgeMat = em;
    return g;
  }
  const metal = (extra = {}) => std('#c3cfdb', .36, .35, extra);

  /* ---------- Robot ---------- */
  function makeRobot() {
    const g = new T.Group(), R = { group: g };
    const white = std('#dde5ee', .42, .05), dark = std('#1d2e49', .55, .25);
    const orange = std(C.orange, .45, 0, { emissive: col(C.orange), emissiveIntensity: .4 });
    const steel = std('#b7c5d4', .28, .55);
    const cyl = (rt, rb, h, m) => new T.Mesh(new T.CylinderGeometry(rt, rb, h, 32), m);
    const sph = (r, m) => new T.Mesh(new T.SphereGeometry(r, 24, 16), m);

    const base = cyl(.5, .58, .2, dark); base.position.y = .1; g.add(base);
    const ring = new T.Mesh(new T.TorusGeometry(.52, .03, 10, 48), orange); ring.rotation.x = Math.PI / 2; ring.position.y = .2; g.add(ring);
    const waist = cyl(.22, .3, .22, dark); waist.position.y = .31; g.add(waist);
    const torso = rbox(.95, .9, .7, .2, white); torso.position.y = .84; g.add(torso);
    const chest = rbox(.52, .26, .06, .06, dark); chest.position.set(0, .9, .36); g.add(chest);
    const led = new T.Mesh(new T.PlaneGeometry(.38, .045), basic(C.cyan, { toneMapped: false })); led.position.set(0, .9, .395); g.add(led);
    const neck = cyl(.1, .12, .24, dark); neck.position.y = 1.38; g.add(neck);

    const head = new T.Group(); head.position.y = 1.42; g.add(head); R.headPivot = head;
    const shell = rbox(1.15, .78, .82, .24, white); shell.position.y = .42; head.add(shell);
    const frame = rbox(.99, .57, .06, .17, dark); frame.position.set(0, .42, .41); head.add(frame);
    const vc = document.createElement('canvas'); vc.width = 512; vc.height = 256;
    R.vctx = vc.getContext('2d'); R.vtex = new T.CanvasTexture(vc); R.vtex.encoding = T.sRGBEncoding;
    const visor = new T.Mesh(new T.PlaneGeometry(.88, .44), new T.MeshBasicMaterial({ map: R.vtex, toneMapped: false }));
    visor.position.set(0, .42, .447); head.add(visor);
    [-1, 1].forEach(s => { const ear = cyl(.12, .12, .1, orange); ear.rotation.z = Math.PI / 2; ear.position.set(s * .6, .42, 0); head.add(ear); });
    const ant = cyl(.012, .012, .28, dark); ant.position.set(.3, .93, 0); head.add(ant);
    R.tip = sph(.045, orange); R.tip.position.set(.3, 1.08, 0); head.add(R.tip);

    R.arms = {};
    [['L', -1], ['R', 1]].forEach(([k, s]) => {
      const sh = new T.Group(); sh.position.set(s * .6, 1.14, 0); g.add(sh); sh.add(sph(.12, dark));
      const up = cyl(.07, .065, .46, white); up.position.y = -.25; sh.add(up);
      const el = new T.Group(); el.position.y = -.5; sh.add(el); el.add(sph(.085, dark));
      const fo = cyl(.062, .055, .4, white); fo.position.y = -.22; el.add(fo);
      const hand = new T.Group(); hand.position.y = -.45; el.add(hand); hand.add(sph(.07, dark));
      [-1, 1].forEach(f => { const fi = new T.Mesh(new T.BoxGeometry(.035, .13, .07), dark); fi.position.set(f * .055, -.08, 0); hand.add(fi); });
      R.arms[k] = { sh, el, hand, cur: [0, 0, 0, 0], tgt: [-.15, s * .12, -.25, 0] };
    });

    // Caliper: the robot's signature prop (left hand)
    const cal = new T.Group();
    const beam = new T.Mesh(new T.BoxGeometry(.03, .012, .78), steel); beam.position.z = .3; cal.add(beam);
    const jaw = new T.Mesh(new T.BoxGeometry(.03, .17, .022), steel); jaw.position.set(0, -.085, .68); cal.add(jaw);
    const slider = new T.Group(); const jaw2 = jaw.clone(); jaw2.position.set(0, -.085, 0); slider.add(jaw2);
    const readout = new T.Mesh(new T.BoxGeometry(.045, .07, .13), dark); readout.position.set(0, .03, -.03); slider.add(readout);
    const lcd = new T.Mesh(new T.PlaneGeometry(.08, .04), basic(C.orange, { toneMapped: false })); lcd.rotation.y = -Math.PI / 2; lcd.position.set(-.024, .03, -.03); slider.add(lcd);
    slider.position.z = .42; cal.add(slider); cal.position.y = -.12;
    R.arms.L.hand.add(cal); R.calSlider = slider;

    // Magnifier + welding torch (right hand), toggled per scene
    const mag = new T.Group();
    const handle = cyl(.022, .022, .22, dark); handle.position.y = -.14; mag.add(handle);
    const rim = new T.Mesh(new T.TorusGeometry(.15, .022, 12, 40), steel); rim.position.y = -.4; rim.rotation.x = Math.PI / 2; mag.add(rim);
    const lens = new T.Mesh(new T.CircleGeometry(.15, 32), basic(C.cyan, { transparent: true, opacity: .22, side: T.DoubleSide, depthWrite: false }));
    lens.position.y = -.4; lens.rotation.x = Math.PI / 2; mag.add(lens);
    mag.scale.setScalar(0); R.arms.R.hand.add(mag); R.mag = mag;
    const torch = new T.Group();
    const tb = cyl(.03, .016, .24, dark); tb.position.y = -.15; torch.add(tb);
    R.torchTip = sph(.026, orange); R.torchTip.position.y = -.28; torch.add(R.torchTip);
    torch.visible = false; R.arms.R.hand.add(torch); R.torch = torch;

    R.vis = { gx: 0, gy: 0, squint: 0, text: 'READY · mm', big: null, bigColor: null, textColor: null };
    R.look = { yaw: 0, pitch: 0 }; R.cur = { yaw: 0, pitch: 0, gx: 0, gy: 0, sq: 0 };
    R.nextBlink = 1.5 + Math.random() * 2; R.blinkAt = -1;
    R.pose = (L, Ra) => { R.arms.L.tgt = L; R.arms.R.tgt = Ra; };

    R.drawVisor = () => {
      const c = R.vctx, v = R.vis, W = 512, H = 256;
      c.shadowBlur = 0; c.fillStyle = '#04111f'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(94,214,255,0.05)'; for (let y = 0; y < H; y += 6) c.fillRect(0, y, W, 2);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (v.big) {
        let px = 72; c.font = '600 ' + px + 'px "IBM Plex Mono", monospace';
        const mw = c.measureText(v.big).width; if (mw > 440) { px = Math.floor(px * 440 / mw); c.font = '600 ' + px + 'px "IBM Plex Mono", monospace'; }
        c.fillStyle = c.shadowColor = v.bigColor || C.cyan; c.shadowBlur = 18; c.fillText(v.big, W / 2 + R.cur.gx * 12, 108 - R.cur.gy * 8);
      } else {
        const ew = 74, eh = Math.max(8, 96 * (1 - R.cur.sq));
        c.fillStyle = c.shadowColor = C.cyan; c.shadowBlur = 22;
        [-1, 1].forEach(s => { rrPath(c, W / 2 + s * 100 + R.cur.gx * 46 - ew / 2, 106 - R.cur.gy * 34 - eh / 2, ew, eh, Math.min(24, eh / 2)); c.fill(); });
      }
      c.shadowBlur = 0; c.font = '500 26px "IBM Plex Mono", monospace';
      c.fillStyle = v.textColor || 'rgba(94,214,255,.8)'; c.fillText(v.text || '', W / 2, 224);
      R.vtex.needsUpdate = true;
    };
    R.update = (dt, t) => {
      Object.values(R.arms).forEach(a => {
        for (let i = 0; i < 4; i++) a.cur[i] = damp(a.cur[i], a.tgt[i], 6, dt);
        a.sh.rotation.x = a.cur[0]; a.sh.rotation.z = a.cur[1]; a.el.rotation.x = a.cur[2]; a.el.rotation.z = a.cur[3];
      });
      R.cur.yaw = damp(R.cur.yaw, R.look.yaw, 6, dt); R.cur.pitch = damp(R.cur.pitch, R.look.pitch, 6, dt);
      R.cur.roll = damp(R.cur.roll || 0, R.roll || 0, 5, dt);
      head.rotation.set(R.cur.pitch, R.cur.yaw, -R.cur.yaw * .08 + R.cur.roll);
      R.cur.gx = damp(R.cur.gx, R.vis.gx, 9, dt); R.cur.gy = damp(R.cur.gy, R.vis.gy, 9, dt);
      if (t > R.nextBlink && R.blinkAt < 0) R.blinkAt = t;
      let blink = 0;
      if (R.blinkAt >= 0) { const b = (t - R.blinkAt) / .16; blink = b < 1 ? Math.sin(b * Math.PI) : 0; if (b >= 1) { R.blinkAt = -1; R.nextBlink = t + 2 + Math.random() * 3; } }
      R.cur.sq = Math.max(damp(R.cur.sq, R.vis.squint, 8, dt), blink);
      R.calSlider.position.z = .3 + .12 * (reduce ? .5 : (.5 + .5 * Math.sin(t * 1.3)));
      orange.emissiveIntensity = .35 + (reduce ? 0 : .25 * Math.sin(t * 3));
      R.drawVisor();
    };
    return R;
  }

  /* ---------- Stage + loop ---------- */
  const stages = [];
  function makeStage(canvas, fov = 30) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.localClippingEnabled = true;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(fov, 1, .1, 200);
    scene.add(new T.HemisphereLight(col('#cfe9ff'), col('#0a1628'), .9));
    const key = new T.DirectionalLight(col('#fff3e6'), 1.3); key.position.set(-4, 6, 6); scene.add(key);
    const rim = new T.DirectionalLight(col(C.cyan), .9); rim.position.set(5, 3, -5); scene.add(rim);
    const S = { canvas, renderer, scene, camera, visible: false, w: 1, h: 1 };
    S.resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      S.w = w; S.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (S.onResize) S.onResize(w, h);
    };
    new IntersectionObserver(es => { S.visible = es[0].isIntersecting; if (S.visible && S.onShow) S.onShow(); }, { rootMargin: '100px' }).observe(canvas);
    stages.push(S);
    return S;
  }
  // Cursor (or phone tilt) → head angles, measured from where the robot's head sits on screen
  const ptr = { x: innerWidth * .5, y: innerHeight * .4, active: false, t: -1e9, gyro: false };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true; ptr.t = performance.now(); ptr.gyro = false; }, { passive: true });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null || (!ptr.gyro && performance.now() - ptr.t < 3000)) return;
    ptr.gyro = true; ptr.active = true; ptr.t = performance.now();
    ptr.x = innerWidth * (.5 + clamp(e.gamma / 40, -.5, .5)); ptr.y = innerHeight * (.5 + clamp((e.beta - 45) / 40, -.5, .5));
  });
  function cursorAngles(S, R, t) {
    const rect = S.canvas.getBoundingClientRect();
    R.headPivot.getWorldPosition(tmpV); tmpV.y += .4; tmpV.project(S.camera);
    const hx = rect.left + (tmpV.x + 1) / 2 * rect.width, hy = rect.top + (1 - tmpV.y) / 2 * rect.height;
    const idle = !ptr.active || performance.now() - ptr.t > 5000;
    const dx = idle ? (reduce ? 0 : Math.sin(t * .5) * 140) : ptr.x - hx;
    const dy = idle ? (reduce ? 0 : Math.sin(t * .37) * 60) : ptr.y - hy;
    const nx = clamp(dx / (innerWidth * .4), -1, 1), ny = clamp(dy / (innerHeight * .4), -1, 1);
    return { yaw: nx * .8 - R.group.rotation.y * .6, pitch: ny * .45, gx: nx, gy: -ny };
  }
  function lookAngles(R, p) {
    R.headPivot.getWorldPosition(tmpV); tmpV.y += .4; tmpV2.copy(p).sub(tmpV);
    return { yaw: Math.atan2(tmpV2.x, tmpV2.z) - R.group.rotation.y, pitch: clamp(Math.atan2(-tmpV2.y, Math.hypot(tmpV2.x, tmpV2.z)), -.6, .6) };
  }
  function aimHead(S, R, t, look, w = .7) {
    const ca = cursorAngles(S, R, t);
    if (look) { const la = lookAngles(R, look); R.look.yaw = lerp(ca.yaw, la.yaw, w); R.look.pitch = lerp(ca.pitch, la.pitch, w); }
    else { R.look.yaw = ca.yaw; R.look.pitch = ca.pitch; }
    R.look.yaw = clamp(R.look.yaw, -1.1, 1.1);
    R.vis.gx = ca.gx; R.vis.gy = ca.gy;
  }
  function makeBench(w, d, matTex) {
    const g = new T.Group();
    const top = new T.Mesh(new T.BoxGeometry(w, .16, d), std('#162847', .75, .1)); top.position.y = -.08; g.add(top);
    const edge = new T.Mesh(new T.BoxGeometry(w, .03, .03), basic(C.orange, { toneMapped: false })); edge.position.set(0, -.03, d / 2 + .005); g.add(edge);
    const legM = std('#0f1d35', .7, .2);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const l = new T.Mesh(new T.BoxGeometry(.14, 3, .14), legM); l.position.set(a * (w / 2 - .25), -1.66, b * (d / 2 - .25)); g.add(l); });
    if (matTex) { const m = new T.Mesh(new T.PlaneGeometry(w * .8, d * .82), new T.MeshStandardMaterial({ map: matTex, roughness: .9 })); m.rotation.x = -Math.PI / 2; m.position.y = .002; g.add(m); }
    return g;
  }
  function gridTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#0d1f3b'; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i <= 1024; i += 16) { x.fillStyle = i % 128 === 0 ? 'rgba(94,214,255,.32)' : 'rgba(94,214,255,.1)'; x.fillRect(i, 0, i % 128 === 0 ? 2 : 1, 512); }
    for (let j = 0; j <= 512; j += 16) { x.fillStyle = j % 128 === 0 ? 'rgba(94,214,255,.32)' : 'rgba(94,214,255,.1)'; x.fillRect(0, j, 1024, j % 128 === 0 ? 2 : 1); }
    x.fillStyle = 'rgba(94,214,255,.5)'; x.font = '500 18px "IBM Plex Mono", monospace';
    for (let i = 1; i < 8; i++) x.fillText(i * 10 + '', i * 128 + 4, 20);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }


  const clock = new T.Clock();
  let _matTex = null; const MAT_TEX = () => _matTex || (_matTex = gridTexture());
  function startLoop() {
    addEventListener('resize', () => stages.forEach(s => s.resize()));
    (function loop() {
      const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
      for (const s of stages) {
        if (!s.visible) continue;
        s.update(dt, t);
        if (s.render) s.render(); else s.renderer.render(s.scene, s.camera);
      }
      requestAnimationFrame(loop);
    })();
  }
  function initLanding() {
    const matTex = MAT_TEX();

    /* ===== Stage 1: the sticky workbench (hero → scale → pipeline) ===== */
    const S1 = makeStage(document.getElementById('bench'), 30);
    const sc = S1.scene;
    const bench = makeBench(7.4, 2.9, matTex); bench.position.x = .55; sc.add(bench);
    const R1 = makeRobot(); R1.group.position.set(-1.95, 0, -.15); R1.group.rotation.y = .3; sc.add(R1.group);

    // Prompt box on the bench
    const tabC = document.createElement('canvas'); tabC.width = 1024; tabC.height = 220;
    const tabX = tabC.getContext('2d'), tabTex = new T.CanvasTexture(tabC); tabTex.encoding = T.sRGBEncoding; tabTex.anisotropy = 8;
    const tablet = new T.Group(); tablet.position.set(-.35, 0, 1.0); sc.add(tablet);
    const tabBody = rbox(1.86, .44, .06, .06, std('#1d2e49', .5, .3)); tabBody.rotation.x = -1.05; tabBody.position.set(0, .2, -.02); tablet.add(tabBody);
    const tabScreen = new T.Mesh(new T.PlaneGeometry(1.76, .378), new T.MeshBasicMaterial({ map: tabTex, toneMapped: false }));
    tabScreen.rotation.x = -1.05; tabScreen.position.set(0, .2 + .033 * Math.sin(1.05) * 0, -.02); tabScreen.translateZ(.032); tablet.add(tabScreen);
    let tabKey = '';
    function drawTablet(text, hl, t) {
      const blink = (Math.floor(t * 2) % 2) === 0, key = text + '|' + hl + '|' + blink;
      if (key === tabKey) return; tabKey = key;
      const x = tabX, W = 1024, H = 220;
      x.fillStyle = '#081629'; x.fillRect(0, 0, W, H);
      x.strokeStyle = C.cyan; x.lineWidth = 4; rrPath(x, 6, 6, W - 12, H - 12, 22); x.stroke();
      x.fillStyle = 'rgba(94,214,255,.6)'; x.font = '500 26px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText('PROMPT', 40, 48);
      const shown = text || 'Describe a part in millimetres…';
      let px = 50; x.font = '500 ' + px + 'px "IBM Plex Mono", monospace';
      const tw = x.measureText(shown).width; if (tw > 930) { px = Math.floor(px * 930 / tw); x.font = '500 ' + px + 'px "IBM Plex Mono", monospace'; }
      let cx = 40; const cy = 132;
      shown.split(/(\d+(?:\.\d+)?(?:\s?mm)?)/).forEach((part, i) => {
        if (!part) return;
        const isNum = i % 2 === 1 && hl, w = x.measureText(part).width;
        if (isNum) { x.fillStyle = 'rgba(255,138,42,.18)'; x.fillRect(cx - 4, cy - px * .62, w + 8, px * 1.2); x.fillStyle = C.orange; }
        else x.fillStyle = text ? '#e8f1fb' : 'rgba(143,165,194,.85)';
        x.fillText(part, cx, cy); cx += w;
      });
      if (blink) { x.fillStyle = C.orange; x.fillRect(cx + 6, cy - px * .5, 4, px); }
      tabTex.needsUpdate = true;
    }

    // Scale problem: the plate, a pulsing marker for the speck, and dimension lines
    const plate = makePart('plate', metal()); plate.position.set(.95, 0, .3); sc.add(plate);
    const speck = new T.Mesh(new T.TorusGeometry(.2, .01, 8, 48), basic(C.orange, { transparent: true, toneMapped: false }));
    speck.rotation.x = -Math.PI / 2; speck.position.set(.95, .01, .3); sc.add(speck);
    const plateDims = partDims(DIMS.plate, MM); plateDims.position.copy(plate.position); sc.add(plateDims);

    // Recipe shelf with 8 blueprint cards
    const shelf = new T.Group(); shelf.position.set(1.3, .95, -1.25); sc.add(shelf);
    const back = new T.Mesh(new T.PlaneGeometry(2.7, 1.75), basic('#0c1c36', { transparent: true })); shelf.add(back);
    const backEdge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(2.7, 1.75)), new T.LineBasicMaterial({ color: col(C.cyan), transparent: true })); shelf.add(backEdge);
    function cardTex(i, sel) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d');
      x.fillStyle = sel ? '#14284a' : '#0e2245'; x.fillRect(0, 0, 256, 320);
      x.strokeStyle = 'rgba(94,214,255,.14)'; x.lineWidth = 1;
      for (let k = 0; k < 256; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 320); x.stroke(); }
      for (let k = 0; k < 320; k += 16) { x.beginPath(); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); }
      x.strokeStyle = sel ? C.orange : C.cyan; x.lineWidth = sel ? 8 : 4; x.strokeRect(6, 6, 244, 308);
      x.strokeStyle = sel ? C.orange : 'rgba(94,214,255,.85)'; x.lineWidth = 5; x.beginPath();
      const k = i % 4;
      if (sel) { x.arc(128, 130, 62, .25, Math.PI * 2 - .25); x.stroke(); x.beginPath(); x.arc(128, 130, 30, 0, Math.PI * 2); x.stroke(); }
      else if (k === 0) { x.strokeRect(68, 80, 120, 100); x.beginPath(); x.arc(128, 130, 22, 0, Math.PI * 2); x.stroke(); }
      else if (k === 1) { x.moveTo(70, 80); x.lineTo(70, 180); x.lineTo(186, 180); x.lineTo(186, 80); x.stroke(); }
      else if (k === 2) { x.arc(128, 130, 56, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(128, 130, 18, 0, Math.PI * 2); x.stroke(); }
      else { x.moveTo(64, 170); x.lineTo(128, 80); x.lineTo(192, 170); x.closePath(); x.stroke(); }
      x.fillStyle = sel ? C.orange : '#cfe3f7'; x.textAlign = 'center';
      x.font = '600 22px "IBM Plex Mono", monospace';
      if (sel) { x.fillText('SPLIT SHAFT', 128, 248); x.fillText('COLLAR', 128, 276); }
      else { x.fillText('FAMILY ' + String(i + 1).padStart(2, '0'), 128, 262); }
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
    }
    const cards = []; const SEL = 5;
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(.52, .65), new T.MeshBasicMaterial({ map: cardTex(i, i === SEL), transparent: true, toneMapped: false }));
      m.position.set(-.96 + (i % 4) * .64, i < 4 ? .4 : -.38, .02); shelf.add(m); cards.push(m);
    }
    const cardHome = cards[SEL].position.clone();
    const score = label('similarity 0.71', { border: C.orange, h: .2 }); shelf.add(score);

    // Fork: conveyor into the deterministic compiler, fallback station to the side
    const fork = new T.Group(); sc.add(fork);
    const beltC = document.createElement('canvas'); beltC.width = 256; beltC.height = 32; const bx = beltC.getContext('2d');
    bx.fillStyle = '#132542'; bx.fillRect(0, 0, 256, 32); bx.fillStyle = 'rgba(94,214,255,.35)'; for (let i = 0; i < 256; i += 32) bx.fillRect(i, 0, 6, 32);
    const beltTex = new T.CanvasTexture(beltC); beltTex.wrapS = T.RepeatWrapping; beltTex.repeat.set(5, 1);
    const belt = new T.Mesh(new T.BoxGeometry(2.4, .07, .55), [std('#0f1d35'), std('#0f1d35'), new T.MeshStandardMaterial({ map: beltTex, roughness: .8 }), std('#0f1d35'), std('#0f1d35'), std('#0f1d35')]);
    belt.position.set(-.05, .035, .3); fork.add(belt);
    const archM = std('#1d2e49', .5, .3);
    [-1, 1].forEach(s => { const p = new T.Mesh(new T.BoxGeometry(.08, .75, .08), archM); p.position.set(.78, .375, .3 + s * .36); fork.add(p); });
    const archTop = new T.Mesh(new T.BoxGeometry(.12, .1, .84), basic(C.orange, { toneMapped: false })); archTop.position.set(.78, .78, .3); fork.add(archTop);
    const compLabel = label('DETERMINISTIC COMPILER', { border: C.orange, h: .19 }); compLabel.position.set(.78, 1.05, .3); fork.add(compLabel);
    const fbStation = new T.Group(); fbStation.position.set(2.9, 0, -.55); fork.add(fbStation);
    const fbBox = rbox(.7, .5, .5, .08, std('#1d2e49', .6, .2)); fbBox.position.y = .25; fbStation.add(fbBox);
    const loopRing = new T.Mesh(new T.TorusGeometry(.17, .025, 8, 40, Math.PI * 1.6), basic(C.cyan, { toneMapped: false })); loopRing.position.set(0, .78, 0); fbStation.add(loopRing);
    const fbLabel = label('QLoRA FALLBACK · ≤ 3 repair loops', { h: .16 }); fbLabel.position.set(0, 1.12, 0); fbStation.add(fbLabel);
    const token = new T.Mesh(new T.PlaneGeometry(.3, .37), new T.MeshBasicMaterial({ map: cards[SEL].material.map, transparent: true, toneMapped: false, side: T.DoubleSide }));
    token.rotation.x = -Math.PI / 2; token.position.set(-.6, .08, .3); sc.add(token);

    // The compiled part (split shaft collar) + validation gate
    const COL_POS = new T.Vector3(1.15, 0, .3);
    const collar = makePart('collar', metal()); collar.position.copy(COL_POS); sc.add(collar);
    const scanner = new T.Mesh(new T.PlaneGeometry(1.1, .8), basic(C.orange, { transparent: true, opacity: .4, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
    scanner.rotation.y = Math.PI / 2; scanner.position.set(COL_POS.x, .4, COL_POS.z); sc.add(scanner);
    const bboxGeo = new T.BoxGeometry(32 * MM, 12 * MM, 32 * MM); bboxGeo.translate(0, 6 * MM, 0);
    const bbox = new T.LineSegments(new T.EdgesGeometry(bboxGeo), new T.LineBasicMaterial({ color: col(C.cyan), transparent: true, depthTest: false }));
    bbox.position.copy(COL_POS); bbox.renderOrder = 18; sc.add(bbox);
    const colDims = partDims(DIMS.collar, MM); colDims.position.copy(COL_POS); sc.add(colDims);

    // Export bins
    const bins = new T.Group(); sc.add(bins);
    const BIN_X = [1.8, 2.55, 3.3], binLabels = ['STEP', 'STL', 'GLB'];
    BIN_X.forEach((x, i) => {
      const b = new T.Group(); b.position.set(x, 0, .95); bins.add(b);
      const wallM = std('#1d2e49', .6, .2);
      const bot = new T.Mesh(new T.BoxGeometry(.66, .03, .5), wallM); bot.position.y = .015; b.add(bot);
      [[0, .2, .25, .66, .4, .03], [0, .2, -.25, .66, .4, .03], [.33, .2, 0, .03, .4, .5], [-.33, .2, 0, .03, .4, .5]].forEach(([px, py, pz, w, h, d]) => {
        const wm = new T.Mesh(new T.BoxGeometry(w, h, d), wallM); wm.position.set(px, py, pz); b.add(wm);
      });
      const rimL = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(.66, .4, .5)), new T.LineBasicMaterial({ color: col(C.orange), transparent: true }));
      rimL.position.y = .2; b.add(rimL);
      const l = label(binLabels[i], { border: C.orange, h: .2 }); l.position.set(0, .62, .1); b.add(l);
    });
    const clones = BIN_X.map(() => { const c = makePart('collar', metal()); c.scale.setScalar(MM * .75); sc.add(c); c.visible = false; return c; });

    const steps = [...document.querySelectorAll('.step')];
    const checks = [...document.querySelectorAll('#checks li')];
    const A = { plate: 0, speck: 0, pdim: 0, mag: 0, shelf: 0, pull: 0, fork: 0, token: 0, collar: 0, scan: 0, box: 0, cdim: 0, bins: 0, exp: 0 };
    const LOOK = { tablet: new T.Vector3(-.35, .2, 1.0), plate: new T.Vector3(.95, 0, .3), card: new T.Vector3(1.3, 1.1, -1.0), arch: new T.Vector3(.78, .5, .3), collar: COL_POS.clone(), bins: new T.Vector3(2.55, .2, .95) };
    const REQ = 'Split shaft collar, 16 mm bore, 32 mm OD, 12 mm wide';
    const IDLE_L = [-.15, -.12, -.25, 0], IDLE_R = [-.15, .12, -.25, 0], CAL_L = [-.55, -.15, -1.15, 0];

    S1.onResize = (w, h) => {
      const cam = S1.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      const sceneW = 6.3, cx = .72, cy = 1.0;
      if (w > 900) {
        const visW = sceneW / .5; const z = Math.max(visW / (2 * tanH * asp), 6.6 / (2 * tanH));
        const vw = 2 * tanH * z * asp, camX = cx - .24 * vw;
        cam.position.set(camX, cy + z * .2, z); cam.lookAt(camX, cy, 0);
        S1.mob = null;
      } else {
        const z = 4.5 / (2 * tanH * asp), vh = 2 * tanH * z, camY = cy - .2 * vh;
        S1.mob = { z, camY, x: S1.mob ? S1.mob.x : -.6 };
        cam.position.set(S1.mob.x, camY + z * .2, z); cam.lookAt(S1.mob.x, camY, 0);
      }
    };
    const MOB_X = [-.7, -.2, -.6, .5, .4, .6, 1.4];

    S1.update = (dt, t) => {
      const mid = innerHeight * .55; let idx = 0, local = 0;
      for (let i = 0; i < steps.length; i++) { const r = steps[i].getBoundingClientRect(); if (r.top <= mid) { idx = i; local = clamp((mid - r.top) / r.height, 0, 1); } }
      const v = R1.vis; v.big = null; v.bigColor = null; v.textColor = null; v.text = 'READY · mm'; v.squint = 0;
      const G = { plate: 0, speck: 0, pdim: 0, mag: 0, shelf: 0, pull: 0, fork: 0, token: 0, collar: 0, scan: 0, box: 0, cdim: 0, bins: 0, exp: 0 };
      let look = null, L = IDLE_L, Ra = IDLE_R, tabText = '', tabHL = false, tokenX = -.6;

      if (idx === 0) {
        L = CAL_L; tabText = promptState.text; tabHL = true;
        if (promptState.nums.length) { v.big = promptState.nums.slice(0, 3).join(' · '); v.text = 'PARSED · mm'; }
        if (document.activeElement === input || performance.now() - promptState.typedAt < 2500) look = LOOK.tablet;
      } else if (idx === 1) {
        const grow = smooth(.4, .78, local);
        G.plate = lerp(.03, 1, grow); G.speck = 1 - smooth(.3, .45, local); G.pdim = smooth(.78, .9, local);
        G.mag = 1 - smooth(.7, .82, local); Ra = G.mag > .5 ? [-1.05, .5, -.95, 0] : IDLE_R; L = [-.3, -.15, -.6, 0];
        look = LOOK.plate; tabText = '60 × 40 × 5 mm plate'; tabHL = true;
        if (grow < .5) { v.big = '0.0188'; v.bigColor = C.orange; v.text = 'TOO SMALL?'; v.textColor = C.orange; v.squint = grow < .1 ? .65 : .3; }
        else if (G.pdim < .5) { v.big = 'SCALING'; v.text = '→ real mm'; }
        else { v.big = '60·40·5'; v.text = 'TRUE SIZE · mm ✓'; }
      } else if (idx === 2) {
        tabText = REQ; tabHL = true; look = LOOK.tablet; L = CAL_L; v.big = '16·32·12'; v.text = '3 mm values found';
      } else if (idx === 3) {
        G.shelf = smooth(0, .25, local); G.pull = smooth(.3, .65, local); Ra = [-2.5, .35, -.25, 0]; look = LOOK.card;
        tabText = REQ; v.text = G.pull > .5 ? 'RECIPE MATCH' : 'SEARCHING 8 FAMILIES'; if (G.pull > .5) { v.big = '0.71'; v.bigColor = C.orange; }
      } else if (idx === 4) {
        G.fork = 1; const ride = smooth(.12, .6, local); tokenX = lerp(-.7, .72, ride); G.token = local < .6 ? 1 : 0;
        G.collar = smooth(.6, .8, local); Ra = [-1.35, .55, -.1, 0]; look = LOOK.arch; tabText = REQ;
        v.text = G.collar > .5 ? 'COMPILED ✓' : 'MATCH → COMPILER';
      } else if (idx === 5) {
        G.fork = .25; G.collar = 1; G.scan = 1 - smooth(.62, .72, local); G.box = smooth(.5, .68, local); G.cdim = smooth(.66, .8, local);
        look = LOOK.collar; v.squint = .25; tabText = REQ; L = CAL_L;
        v.text = local > .78 ? 'ENVELOPE PASS ✓' : 'SCANNING…'; if (local > .78) v.big = '32·32·12';
      } else {
        G.bins = smooth(0, .2, local); G.exp = smooth(.15, .75, local); G.collar = G.exp > 0.02 ? 0 : 1;
        Ra = [-1.2, .6, -.3, 0]; look = LOOK.bins; tabText = REQ; v.text = 'STEP · STL · GLB'; if (G.exp > .97) v.big = '✓';
      }
      checks.forEach((li, i) => li.classList.toggle('on', idx > 5 || (idx === 5 && local > .14 + i * .16)));

      for (const k in A) A[k] = damp(A[k], G[k], k === 'exp' ? 5 : 9, dt);
      if (S1.mob) {
        const m = S1.mob, cam = S1.camera; m.x = damp(m.x, MOB_X[idx], 3, dt);
        cam.position.set(m.x, m.camY + m.z * .2, m.z); cam.lookAt(m.x, m.camY, 0);
      }
      R1.pose(L, Ra); aimHead(S1, R1, t, look); R1.update(dt, t);
      R1.mag.scale.setScalar(A.mag);
      drawTablet(tabText, tabHL, t);

      plate.scale.setScalar(MM * A.plate); plate.visible = A.plate > .005;
      fade(speck, A.speck * (.55 + .45 * Math.sin(t * 6))); speck.scale.setScalar(1 + .2 * Math.sin(t * 6));
      fade(plateDims, A.pdim);
      fade(shelf, A.shelf);
      cards[SEL].position.set(cardHome.x, cardHome.y - A.pull * .2, cardHome.z + A.pull * .55);
      score.position.set(cardHome.x, cardHome.y + .5, cardHome.z + A.pull * .6); fade(score, A.pull * A.shelf);
      fade(fork, A.fork); beltTex.offset.x = reduce ? 0 : -t * .6; loopRing.rotation.z = reduce ? 0 : t * 1.5;
      token.position.x = tokenX; fade(token, A.token);
      collar.scale.setScalar(MM * A.collar); collar.visible = A.collar > .005;
      fade(scanner, A.scan); scanner.position.x = COL_POS.x + .48 * Math.sin(t * (reduce ? 0 : 3.2));
      fade(bbox, A.box); bbox.scale.set(1, Math.max(A.box, .001), 1);
      fade(colDims, A.cdim);
      fade(bins, A.bins);
      clones.forEach((c, i) => {
        const p = clamp((A.exp - i * .15) / .55, 0, 1);
        c.visible = A.exp > .02 && A.bins > .05;
        const tx = BIN_X[i];
        c.position.set(lerp(COL_POS.x, tx, p), lerp(0, .26, p) + Math.sin(p * Math.PI) * .9, lerp(COL_POS.z, .95, p));
        c.rotation.y = p * Math.PI;
      });
    };
    S1.resize();

    /* ===== Stage 2: gallery turntables ===== */
    const S2 = makeStage(document.getElementById('galleryCanvas'), 30);
    const GMM = .04, kinds = ['bearing', 'bracket', 'collar'];
    const xrayBtn = document.getElementById('xray'), tip = document.getElementById('tip');
    let xray = false;
    const items = kinds.map((k, i) => {
      const turn = new T.Group(); S2.scene.add(turn);
      const disc = new T.Mesh(new T.CylinderGeometry(1.2, 1.26, .08, 64), std('#14284a', .6, .2)); disc.position.y = -.04; turn.add(disc);
      const ring = new T.Mesh(new T.TorusGeometry(1.23, .01, 6, 96), basic(C.cyan, { toneMapped: false })); ring.rotation.x = Math.PI / 2; turn.add(ring);
      const spin = new T.Group(); turn.add(spin);
      const solid = metal(), ghost = basic(C.cyan, { transparent: true, opacity: .1, depthWrite: false, side: T.DoubleSide });
      const part = makePart(k, solid, .35); part.scale.setScalar(GMM); spin.add(part);
      const dims = partDims(DIMS[k], GMM, .17); spin.add(dims); fade(dims, 0);
      const name = label(NAMES[k], { h: .2 }); name.position.set(0, -.32, 1.1); turn.add(name);
      return { k, turn, spin, part, solid, ghost, dims, rot: i * 1.1 + .5, hover: 0, drag: false };
    });
    S2.onResize = (w, h) => {
      const cam = S2.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      if (asp > 1.1) {
        items.forEach((it, i) => it.turn.position.set((i - 1) * 2.95, 0, 0));
        const z = Math.max(9.2 / (2 * tanH * asp), 3.4 / (2 * tanH)) + 1;
        cam.position.set(0, z * .38, z); cam.lookAt(0, .45, 0);
      } else {
        items.forEach((it, i) => it.turn.position.set(0, (1 - i) * 2.5, 0));
        const z = Math.max(8.2 / (2 * tanH), 3.2 / (2 * tanH * asp)) + .5;
        cam.position.set(0, z * .22, z); cam.lookAt(0, .2, 0);
      }
    };
    xrayBtn.addEventListener('click', () => {
      xray = !xray; xrayBtn.setAttribute('aria-pressed', xray); xrayBtn.textContent = 'X-ray: ' + (xray ? 'on' : 'off');
      items.forEach(it => {
        it.part.children.forEach(n => { if (n.isMesh) n.material = xray ? it.ghost : it.solid; });
        it.part.userData.edgeMat.opacity = xray ? .95 : .35; it.part.userData.edgeMat.depthTest = !xray;
      });
    });
    const ray = new T.Raycaster(), ndc = new T.Vector2(), gcv = S2.canvas;
    let hovered = -1, dragIt = null, lastX = 0;
    function pick(e) {
      const r = gcv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, S2.camera);
      let best = -1, bd = 1e9;
      items.forEach((it, i) => { const hit = ray.intersectObject(it.turn, true)[0]; if (hit && hit.distance < bd) { bd = hit.distance; best = i; } });
      return best;
    }
    function showTip(e, i) {
      if (i < 0) { tip.hidden = true; return; }
      const r = gcv.parentElement.getBoundingClientRect(), d = DIMS[items[i].k];
      tip.innerHTML = NAMES[items[i].k] + ' · <b>' + d[0] + ' × ' + d[2] + ' × ' + d[1] + ' mm</b>';
      tip.hidden = false;
      const x = Math.min(e.clientX - r.left, r.width - tip.offsetWidth - 20);
      tip.style.left = Math.max(0, x) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
    }
    gcv.addEventListener('pointermove', e => {
      if (dragIt) { dragIt.rot += (e.clientX - lastX) * .012; lastX = e.clientX; return; }
      hovered = pick(e); showTip(e, hovered);
    });
    gcv.addEventListener('pointerleave', () => { if (!dragIt) { hovered = -1; tip.hidden = true; } });
    gcv.addEventListener('pointerdown', e => {
      hovered = pick(e); showTip(e, hovered);
      if (hovered >= 0) { dragIt = items[hovered]; dragIt.drag = true; lastX = e.clientX; }
    });
    const endDrag = () => { if (dragIt) { dragIt.drag = false; dragIt = null; } };
    addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
    S2.update = (dt, t) => {
      items.forEach((it, i) => {
        if (!it.drag && !reduce) it.rot += dt * .35;
        it.spin.rotation.y = it.rot;
        it.hover = damp(it.hover, hovered === i ? 1 : 0, 10, dt);
        it.spin.position.y = it.hover * .12;
        fade(it.dims, it.hover);
      });
    };
    S2.resize();

    /* ===== Stage 3: try it (weld layer by layer, hand over) ===== */
    const S3 = makeStage(document.getElementById('tryCanvas'), 30);
    const b3 = makeBench(5.2, 2.4, matTex); b3.position.x = -.2; S3.scene.add(b3);
    const R3 = makeRobot(); R3.group.position.set(-1.6, 0, -.25); R3.group.rotation.y = .5; S3.scene.add(R3.group);
    R3.torch.visible = true; R3.vis.text = 'PICK A PRESET';
    const clipPlane = new T.Plane(new T.Vector3(0, -1, 0), 0);
    const BUILD_POS = new T.Vector3(.75, 0, .25), TMM = .034;
    const builds = {};
    kinds.forEach(k => {
      const m = metal({ clippingPlanes: [clipPlane], side: T.DoubleSide });
      const p = makePart(k, m, .5, { clippingPlanes: [clipPlane] }); p.scale.setScalar(TMM); p.visible = false; p.position.copy(BUILD_POS);
      S3.scene.add(p); builds[k] = p;
    });
    const glow = new T.Mesh(new T.PlaneGeometry(1, 1), basic(C.orange, { transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.visible = false; S3.scene.add(glow);
    const SPN = 180, spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
    const spGeo = new T.BufferGeometry(); spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3));
    const sparks = new T.Points(spGeo, new T.PointsMaterial({ color: col('#ffb36b'), size: .045, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    S3.scene.add(sparks); let spI = 0;
    const statusEl = document.getElementById('status'), presetBtns = [...document.querySelectorAll('.preset')];
    const job = { kind: null, t0: 0 };
    const BUILD = 3.4, HAND = 1.0;
    function start(kind) {
      Object.values(builds).forEach(p => { p.visible = false; });
      job.kind = kind; job.t0 = clock.elapsedTime; job.announced = false;
      presetBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.part === kind));
      const d = DIMS[kind];
      statusEl.textContent = 'Building ' + NAMES[kind].toLowerCase() + ', ' + d[0] + ' × ' + d[2] + ' × ' + d[1] + ' mm…';
      if (job.label) { S3.scene.remove(job.label); job.label.material.map.dispose(); job.label.material.dispose(); } // clear the previous part's file label
      const nl =label(FILES[kind] + ' · .step .stl .glb', { border: C.orange, h: .19 }); nl.visible = false; S3.scene.add(nl); job.label = nl;
    }
    presetBtns.forEach(b => b.addEventListener('click', () => start(b.dataset.part)));
    let autoStarted = false;
    S3.onShow = () => { if (!autoStarted) { autoStarted = true; setTimeout(() => { if (!job.kind) start('bearing'); }, 400); } };
    S3.onResize = (w, h) => {
      const cam = S3.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      const z = Math.max(5.4 / (2 * tanH * asp), 3.8 / (2 * tanH)) + .8;
      cam.position.set(-.3, .7 + z * .3, z); cam.lookAt(-.3, .7, 0);
    };
    S3.update = (dt, t) => {
      const v = R3.vis; v.big = null; v.bigColor = null; v.textColor = null; v.squint = 0;
      let look = null, Ra = [-.2, .15, -.3, 0];
      const pArr = spGeo.attributes.position.array;
      let emit = false, wp = tmpV2;
      if (job.kind) {
        const p = builds[job.kind], d = DIMS[job.kind], H = d[1] * TMM, el = t - job.t0;
        p.visible = true;
        const bt = reduce ? 1 : clamp(el / BUILD, 0, 1), ht = reduce ? 1 : clamp((el - BUILD) / HAND, 0, 1);
        const h = bt * H;
        clipPlane.constant = bt >= 1 ? 100 : h + p.position.y;
        const hs = smooth(0, 1, ht);
        p.position.set(BUILD_POS.x - hs * .55, hs * .35, BUILD_POS.z + hs * .65);
        glow.visible = bt < 1; glow.scale.set(d[0] * TMM * 1.05, d[2] * TMM * 1.05, 1); glow.position.set(BUILD_POS.x, h + .003, BUILD_POS.z);
        if (bt < 1) {
          const a = t * 5;
          wp.set(BUILD_POS.x + Math.cos(a) * d[0] * TMM * .5, h, BUILD_POS.z + Math.sin(a) * d[2] * TMM * .5);
          emit = !reduce; Ra = [-1.25, .75, -.35, 0]; look = wp;
          v.big = Math.round(bt * 100) + '%'; v.bigColor = C.orange; v.text = 'WELDING LAYER ' + (1 + Math.floor(bt * d[1])) + ' / ' + d[1];
        } else if (ht < 1) {
          Ra = [-1.0, .5, -.6, 0]; v.text = 'HANDING OVER'; v.big = '✓'; look = p.position;
        } else {
          v.big = '✓'; v.text = 'DONE · ' + d[0] + '×' + d[2] + '×' + d[1] + ' mm'; v.squint = .3;
          if (!job.announced) { job.announced = true; statusEl.textContent = 'Done. ' + FILES[job.kind] + '.step, .stl and .glb are ready.'; }
        }
        if (job.label) { job.label.visible = ht > .5; job.label.position.set(p.position.x, p.position.y + H + .35, p.position.z); }
      } else { v.text = 'PICK A PRESET'; }
      R3.pose([-.2, -.15, -.35, 0], Ra); aimHead(S3, R3, t, look, .6); R3.update(dt, t);
      // sparks
      if (emit) for (let n = 0; n < 4; n++) {
        const i = spI = (spI + 1) % SPN; spLife[i] = .5 + Math.random() * .4;
        pArr[i * 3] = wp.x; pArr[i * 3 + 1] = wp.y; pArr[i * 3 + 2] = wp.z;
        spVel[i * 3] = (Math.random() - .5) * 1.6; spVel[i * 3 + 1] = Math.random() * 1.6 + .4; spVel[i * 3 + 2] = (Math.random() - .5) * 1.6;
      }
      for (let i = 0; i < SPN; i++) {
        if (spLife[i] <= 0) { pArr[i * 3 + 1] = -99; continue; }
        spLife[i] -= dt; spVel[i * 3 + 1] -= 4.5 * dt;
        pArr[i * 3] += spVel[i * 3] * dt; pArr[i * 3 + 1] += spVel[i * 3 + 1] * dt; pArr[i * 3 + 2] += spVel[i * 3 + 2] * dt;
        if (pArr[i * 3 + 1] < 0) { pArr[i * 3 + 1] = 0; spVel[i * 3 + 1] *= -.3; }
      }
      spGeo.attributes.position.needsUpdate = true;
    };
    S3.resize();

    /* ===== Stage 4: goodbye wave ===== */
    const S4 = makeStage(document.getElementById('byeCanvas'), 30);
    const b4 = makeBench(4.2, 2.2, matTex); S4.scene.add(b4);
    const R4 = makeRobot(); R4.group.position.set(-.8, 0, -.2); R4.group.rotation.y = .35; S4.scene.add(R4.group);
    const fin = makePart('collar', metal()); fin.scale.setScalar(.034); fin.position.set(1.05, 0, .35); S4.scene.add(fin);
    const finLabel = label('shaft_collar.step', { border: C.orange, h: .17 }); finLabel.position.set(1.05, .95, .35); S4.scene.add(finLabel);
    S4.onResize = (w, h) => {
      const cam = S4.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      const z = Math.max(3.8 / (2 * tanH * asp), 3.3 / (2 * tanH)) + .6;
      cam.position.set(.1, .8 + z * .25, z); cam.lookAt(.1, .85, 0);
    };
    S4.update = (dt, t) => {
      const cyc = t % 5, waving = !reduce && cyc < 2.4;
      R4.pose([-.2, -.15, -.3, 0], waving ? [-.15, 2.45, 0, .5 * Math.sin(t * 9)] : [-.4, .25, -.6, 0]);
      aimHead(S4, R4, t, null);
      R4.vis.text = waving ? 'SEE YOU SOON' : 'مجسّم · MUJASSAM'; R4.vis.squint = waving ? .45 : 0;
      R4.update(dt, t);
      fin.rotation.y = reduce ? .4 : t * .4;
    };
    S4.resize();

  }

  /* ===== Studio: the generator ===== */
  function initStudio() {
    const $ = id => document.getElementById(id);
    const S = makeStage($('stCanvas'), 35), sc = S.scene;
    S.camera.near = 1; S.camera.far = 20000; S.camera.updateProjectionMatrix(); // scene is in mm, so the far plane must cover a zoomed-out view
    const gridA = new T.GridHelper(1200, 120, col(C.cyan), col(C.cyan)); gridA.material.transparent = true; gridA.material.opacity = .1; sc.add(gridA);
    const gridB = new T.GridHelper(1200, 12, col(C.cyan), col(C.cyan)); gridB.material.transparent = true; gridB.material.opacity = .28; gridB.position.y = .02; sc.add(gridB);
    const table = new T.Mesh(new T.CylinderGeometry(1, 1.04, 2, 72), std('#14284a', .7, .2)); table.position.y = -1; sc.add(table);
    const tableRing = new T.Mesh(new T.TorusGeometry(1.02, .006, 6, 96), basic(C.cyan, { toneMapped: false })); tableRing.rotation.x = Math.PI / 2; sc.add(tableRing);
    const holder = new T.Group(); sc.add(holder);
    const clip = new T.Plane(new T.Vector3(0, -1, 0), 1e5);
    const solid = metal({ clippingPlanes: [clip], side: T.DoubleSide });
    const ghost = basic(C.cyan, { transparent: true, opacity: .1, depthWrite: false, side: T.DoubleSide, clippingPlanes: [clip] });
    const edgeExtra = { clippingPlanes: [clip] };
    let part = null, dims = null, xray = false, showDims = true, build = { t0: -1, H: 1 };
    const orbit = { th: .75, ph: 1.08, r: 220, tth: .75, tph: 1.08, tr: 220, ty: 0, y: 0 };

    function frameTo(size) {
      const m = Math.max(...size);
      orbit.tr = orbit.home = m * 2.4 + 30; orbit.min = m * .9; orbit.max = Math.max(400, m * 14);
      orbit.ty = size[1] * .4; orbit.tth = .75; orbit.tph = 1.08;
      table.scale.set(m * .78, 1, m * .78); tableRing.scale.set(m * .78, m * .78, 1);
    }
    frameTo([60, 10, 40]);
    function showPart(geos, size, instant) {
      if (part) { holder.remove(part); part.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }
      if (dims) { holder.remove(dims); dims = null; }
      part = null;
      if (!geos) return;
      part = makePart('custom', xray ? ghost : solid, xray ? .95 : .4, edgeExtra, geos);
      holder.add(part);
      const m = Math.max(...size);
      dims = partDims(size, 1, m * .075, m * .09); holder.add(dims); fade(dims, showDims ? 1 : 0);
      frameTo(size);
      build = { t0: instant ? -1 : clock.elapsedTime, H: size[1] };
      clip.constant = instant || reduce ? 1e5 : 0;
    }
    $('stXray').addEventListener('click', e => {
      xray = !xray; e.currentTarget.setAttribute('aria-pressed', xray);
      if (part) part.children.forEach(n => { if (n.isMesh) n.material = xray ? ghost : solid; });
      if (part) part.userData.edgeMat.opacity = xray ? .95 : .4;
    });
    $('stDims').addEventListener('click', e => { showDims = !showDims; e.currentTarget.setAttribute('aria-pressed', showDims); if (dims) fade(dims, showDims ? 1 : 0); });
    $('stReset').addEventListener('click', () => { orbit.tth = .75; orbit.tph = 1.08; if (orbit.home) orbit.tr = orbit.home; });
    // drag to orbit, wheel to zoom
    let drag = null; const cv = S.canvas;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      orbit.tth -= (e.clientX - drag.x) * .008; orbit.tph = clamp(orbit.tph - (e.clientY - drag.y) * .006, .25, 1.5);
      drag = { x: e.clientX, y: e.clientY };
    });
    const endDrag = () => { drag = null; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('wheel', e => { e.preventDefault(); orbit.tr = clamp(orbit.tr * (e.deltaY > 0 ? 1.1 : .9), orbit.min || 20, orbit.max || 1500); }, { passive: false });
    S.update = (dt, t) => {
      if (!drag && !reduce && part) orbit.tth += dt * .12;
      orbit.th = damp(orbit.th, orbit.tth, 8, dt); orbit.ph = damp(orbit.ph, orbit.tph, 8, dt);
      orbit.r = damp(orbit.r, orbit.tr, 5, dt); orbit.y = damp(orbit.y, orbit.ty, 5, dt);
      const cam = S.camera, sp = Math.sin(orbit.ph);
      cam.position.set(orbit.r * sp * Math.sin(orbit.th), orbit.y + orbit.r * Math.cos(orbit.ph), orbit.r * sp * Math.cos(orbit.th));
      cam.lookAt(0, orbit.y, 0);
      if (build.t0 >= 0) {
        const k = clamp((t - build.t0) / 1.3, 0, 1);
        clip.constant = k >= 1 ? 1e5 : k * build.H + .01;
        if (k >= 1) build.t0 = -1;
      }
    };
    S.onResize = () => {};
    S.resize();

    /* corner robot */
    const SR = makeStage($('stRobot'), 26);
    const R = makeRobot(); R.group.rotation.y = .45; SR.scene.add(R.group);
    SR.camera.position.set(.6, 1.85, 4.6); SR.camera.lookAt(.05, 1.25, 0);
    let bot = 'idle', botT = 0;
    function setBot(s) { bot = s; botT = clock.elapsedTime; }
    const IDLE = [[-.15, -.12, -.25, 0], [-.15, .12, -.25, 0]];
    SR.update = (dt, t) => {
      const v = R.vis; v.big = null; v.bigColor = null; v.textColor = null; v.squint = 0; R.roll = 0;
      let L = IDLE[0], Ra = IDLE[1];
      if ((bot === 'pass' || bot === 'fail') && t - botT > 6) bot = 'idle';
      if (bot === 'think') {
        Ra = [-.55, -.3, -2.3, 0]; L = [-.45, .25, -1.5, 0]; R.roll = .14;
        v.big = ['·  ', '·· ', '···'][Math.floor(t * 3) % 3]; v.text = 'THINKING';
      } else if (bot === 'pass') {
        Ra = [-2.4, .25, -.6, 0]; v.squint = .45; v.text = 'PASS ✓';
        if (t - botT < 1.2) v.big = '✓';
      } else if (bot === 'fail') {
        L = [-.3, -.6, -1.25, 0]; Ra = [-.3, .6, -1.25, 0]; R.roll = .2; v.big = '?'; v.bigColor = C.orange; v.text = 'HMM'; v.textColor = C.orange;
      } else { v.text = 'READY · mm'; }
      R.pose(L, Ra); aimHead(SR, R, t, null); R.update(dt, t);
    };
    SR.resize();

    /* pipeline UI */
    const trackEls = {}; document.querySelectorAll('#stTracker li').forEach(li => { trackEls[li.dataset.k] = li; });
    function setTrack(k, cls, text) { const li = trackEls[k]; li.className = cls || ''; li.querySelector('span').textContent = text; li.title = text; }
    const snapTrack = () => Object.keys(trackEls).map(k => [k, trackEls[k].className, trackEls[k].querySelector('span').textContent]);
    const checkEls = {}; document.querySelectorAll('#stChecks li').forEach(li => { checkEls[li.dataset.k] = li; });
    function setCheck(k, state, text) { const li = checkEls[k]; li.classList.toggle('on', state === 'pass'); li.classList.toggle('fail', state === 'fail'); li.querySelector('small').textContent = text; }
    const bubble = $('stBubble');
    function say(text, fail) { bubble.textContent = text; bubble.classList.toggle('fail', !!fail); }
    const dlBtns = [...document.querySelectorAll('[data-dl]')], dlNote = $('stDlNote');
    function setDownloads(on) { dlBtns.forEach(b => { b.disabled = !on; }); dlNote.textContent = on ? 'Every check passed. Files are in millimetres.' : 'Downloads unlock when every check passes.'; }

    function showSpec(spec) {
      const dl = $('stSpec'); dl.innerHTML = '';
      const row = (k, v, assumed) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v + (assumed ? ' (assumed)' : ''); dl.append(dt, dd); };
      if (!spec || (!spec.family && !spec.label)) { $('stSpecLine').textContent = spec && spec.fail ? 'I couldn’t read this one.' : 'Nothing yet.'; return; }
      $('stSpecLine').textContent = spec.label;
      row('Family', spec.family ? FAMS[spec.family].name : 'Not one of the demo families');
      if (spec.envelope) row('Envelope', fmt(spec.envelope[0]) + ' × ' + fmt(spec.envelope[2]) + ' × ' + fmt(spec.envelope[1]) + ' mm', spec.assumed.includes('size'));
      if (spec.features.length) row('Features', spec.features.join(', '));
      if (spec.assumed.length) row('Assumed', spec.assumed.join(', '));
      row('Units', 'mm');
    }
    function showEnv(req, meas) {
      const tb = $('stEnv'); tb.innerHTML = '';
      if (!req) { tb.innerHTML = '<tr><td colspan="3" class="muted">Runs after a build.</td></tr>'; return; }
      [['X (width)', 0], ['Z (depth)', 2], ['Y (height)', 1]].forEach(([n, i]) => {
        const tr = document.createElement('tr');
        const ok = meas && Math.abs(meas[i] - req[i]) <= .1;
        [n, fmt(req[i]) + ' mm', meas ? meas[i].toFixed(2) + ' mm' : '–'].forEach((txt, j) => { const td = document.createElement('td'); td.textContent = txt; if (j === 2 && meas) td.className = ok ? 'okv' : 'bad'; tr.append(td); });
        tb.append(tr);
      });
    }
    function measure(geos) {
      const b = new T.Box3(); geos.forEach(g => { g.computeBoundingBox(); b.union(g.boundingBox); });
      return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    }
    const wait = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 120) : ms));

    /* history */
    const history = []; let active = null;
    function renderHistory() {
      const ol = $('stHistory'); ol.innerHTML = '';
      $('stHistCount').textContent = history.length;
      if (!history.length) { ol.innerHTML = '<li class="empty">Parts you generate in this session appear here so you can compare them.</li>'; return; }
      history.slice().reverse().forEach(h => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.className = 'hist' + (h.pass ? '' : ' fail'); if (h === active) b.setAttribute('aria-current', 'true');
        const dot = document.createElement('i'); dot.className = 'dot';
        const name = document.createElement('b'); name.textContent = h.spec.family ? FAMS[h.spec.family].name : (h.spec.label || 'Unreadable request');
        const sub = document.createElement('span'); sub.textContent = (h.pass ? 'pass · ' : 'fail · ') + (h.meas ? h.meas.map(v => v.toFixed(1)).filter((_, i) => i !== 1).concat(h.meas[1].toFixed(1)).join(' × ') + ' mm' : h.reasonShort);
        b.append(dot, name, sub); b.addEventListener('click', () => restore(h));
        li.append(b); ol.append(li);
      });
    }
    function restore(h) {
      active = h; $('stPrompt').value = h.spec.text;
      h.track.forEach(([k, cls, txt]) => setTrack(k, cls, txt));
      showSpec(h.spec); h.checks.forEach(([k, s, txt]) => setCheck(k, s, txt));
      showEnv(h.spec.envelope, h.meas);
      $('stCode').textContent = h.code || '# No code: the request stopped before code generation.';
      showPart(h.geos, h.meas || [60, 10, 40], true);
      $('stViewLabel').textContent = h.geos ? (h.spec.label || '').toUpperCase() : 'NO PART · UNITS mm';
      setDownloads(h.pass); setBot(h.pass ? 'pass' : 'fail'); say(h.message, !h.pass);
      renderHistory();
    }

    /* the run */
    let running = false;
    const CHECKS = [['ast', 'AST safety'], ['exec', 'Execution'], ['water', 'Watertight'], ['env', 'Envelope']];
    async function run(prompt) {
      if (running) return; running = true;
      const go = $('stGo'); go.disabled = true;
      Object.keys(trackEls).forEach(k => setTrack(k, '', 'waiting'));
      CHECKS.forEach(([k]) => setCheck(k, '', '–')); showEnv(null); setDownloads(false);
      $('stCode').textContent = '# Writing…'; setBot('think'); say('Reading your request…');
      const entry = { spec: null, geos: null, meas: null, pass: false, code: '', checks: [] };
      const finish = (msg, pass) => {
        entry.message = msg; entry.pass = pass; entry.track = snapTrack();
        entry.checks = CHECKS.map(([k]) => [k, checkEls[k].classList.contains('on') ? 'pass' : checkEls[k].classList.contains('fail') ? 'fail' : '', checkEls[k].querySelector('small').textContent]);
        history.push(entry); active = entry; renderHistory();
        setBot(pass ? 'pass' : 'fail'); say(msg, !pass); running = false; go.disabled = false;
      };

      setTrack('spec', 'run', 'reading…'); await wait(650);
      const spec = parseSpec(prompt); entry.spec = spec; showSpec(spec);
      if (spec.fail) {
        setTrack('spec', 'fail', 'couldn’t read'); entry.reasonShort = 'spec'; $('stCode').textContent = '# No code: the request needs sizes in mm.';
        showPart(null); $('stViewLabel').textContent = 'NO PART · UNITS mm';
        return finish(spec.fail.reason, false);
      }
      setTrack('spec', 'ok', spec.family ? FAMS[spec.family].name.toLowerCase() : 'unknown part');
      setTrack('recipe', 'run', 'searching 8 families…'); say('Looking for the closest recipe…'); await wait(700);
      if (!spec.family) {
        setTrack('recipe', 'fail', 'no match · ' + spec.similarity.toFixed(2));
        setTrack('route', 'run', 'QLoRA fallback…'); await wait(650);
        setTrack('route', 'fail', 'QLoRA · backend only'); entry.reasonShort = 'not in demo';
        $('stCode').textContent = '# The QLoRA fallback writes this part on the backend.';
        showPart(null); $('stViewLabel').textContent = 'NO PART · UNITS mm';
        return finish('That part goes to the QLoRA fallback, which runs on the backend. Here I can build plates, bearing mounts, sensor brackets and shaft collars.', false);
      }
      const fam = FAMS[spec.family];
      setTrack('recipe', 'ok', fam.route === 'compiler' ? fam.name.toLowerCase() + ' · ' + spec.similarity.toFixed(2) : 'no confident match · ' + spec.similarity.toFixed(2));
      setTrack('route', 'run', 'routing…'); await wait(600);
      setTrack('route', 'ok', fam.route === 'compiler' ? 'deterministic compiler' : 'QLoRA (demo template)');
      say(fam.route === 'compiler' ? 'Known family. Compiling it with your numbers…' : 'No confident family match, so this goes the QLoRA route…');
      entry.code = cadquery(spec.family, spec.params, spec.label);
      $('stCode').textContent = entry.code;
      const pre = preflight(spec.family, spec.params);
      if (!pre.exec) { CURVE = 96; entry.geos = buildGeos(spec.family, spec.params); CURVE = 40; entry.meas = measure(entry.geos); }
      setTrack('valid', 'run', 'checking…');
      if (entry.geos) { showPart(entry.geos, entry.meas, false); $('stViewLabel').textContent = spec.label.toUpperCase(); }
      else { showPart(null); $('stViewLabel').textContent = 'NO PART · UNITS mm'; }
      const results = {
        ast: null, exec: pre.exec, water: pre.exec ? 'skip' : pre.water,
        env: pre.exec || pre.water ? 'skip' : (entry.meas.every((v, i) => Math.abs(v - spec.envelope[i]) <= .1) ? null : 'Measured box doesn’t match the request.'),
      };
      let failed = null;
      for (const [k, name] of CHECKS) {
        await wait(380);
        const r = results[k];
        if (failed || r === 'skip') { setCheck(k, '', 'skipped'); continue; }
        if (r) { setCheck(k, 'fail', 'fail'); failed = [name, r]; continue; }
        setCheck(k, 'pass', k === 'env' ? '±0.1 mm' : 'pass');
      }
      showEnv(spec.envelope, entry.meas);
      if (failed) {
        setTrack('valid', 'fail', failed[0].toLowerCase() + ' failed'); setTrack('export', 'fail', 'locked'); entry.reasonShort = failed[0].toLowerCase();
        return finish(failed[0] + ' failed: ' + failed[1], false);
      }
      setTrack('valid', 'ok', '4 / 4 passed'); setTrack('export', 'run', 'packing…'); await wait(450);
      setTrack('export', 'ok', 'STL · GLB · .py ready'); setDownloads(true);
      const m = entry.meas;
      finish('Envelope matches: ' + m[0].toFixed(2) + ' × ' + m[2].toFixed(2) + ' × ' + m[1].toFixed(2) + ' mm. Your files are ready.', true);
    }
    $('stForm').addEventListener('submit', e => { e.preventDefault(); run($('stPrompt').value); });
    $('stPrompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run($('stPrompt').value); } });
    document.querySelectorAll('.pchip').forEach(b => b.addEventListener('click', () => { $('stPrompt').value = b.dataset.prompt; run(b.dataset.prompt); }));

    /* downloads */
    function fileBase() { const h = active; return (h && h.spec.family ? FILES[h.spec.family] || h.spec.family : 'part'); }
    function toSTL(geos) {
      let tris = 0; geos.forEach(g => { tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
      const buf = new ArrayBuffer(84 + tris * 50), dv = new DataView(buf); dv.setUint32(80, tris, true);
      let o = 84; const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), e1 = new T.Vector3();
      const put = v => { dv.setFloat32(o, v.x, true); dv.setFloat32(o + 4, -v.z, true); dv.setFloat32(o + 8, v.y, true); o += 12; };
      geos.forEach(g => {
        const p = g.attributes.position, idx = g.index, cnt = idx ? idx.count : p.count;
        for (let i = 0; i < cnt; i += 3) {
          const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); c.fromBufferAttribute(p, ic);
          n.subVectors(c, b).cross(e1.subVectors(a, b)).normalize();
          put(n); put(a); put(b); put(c); dv.setUint16(o, 0, true); o += 2;
        }
      });
      return buf;
    }
    const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
    async function toGLB(geos) {
      if (!T.GLTFExporter) await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js');
      const g = new T.Group(); geos.forEach(geo => g.add(new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xc3cfdb, metalness: .35, roughness: .36 }))));
      g.scale.setScalar(.001); // glTF is in metres
      return new Promise(res => new T.GLTFExporter().parse(g, res, { binary: true }));
    }
    let dlCap;
    async function saveFile(name, data) {
      if (dlCap === undefined) dlCap = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
      if (dlCap) {
        if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        const zip = new window.JSZip(); zip.file(name, data);
        const blob = await zip.generateAsync({ type: 'blob' });
        try { await dlCap.save({ filename: name.replace(/\.[^.]+$/, '') + '.zip', data: blob }); dlNote.textContent = 'Saved ' + name + ' (zipped).'; }
        catch (e) { dlNote.textContent = e && e.code === 'declined' ? 'Download cancelled.' : 'Downloads aren’t available in this view.'; }
        return;
      }
      const url = URL.createObjectURL(new Blob([data])), a = document.createElement('a');
      a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      dlNote.textContent = 'Downloaded ' + name + '.';
    }
    dlBtns.forEach(b => b.addEventListener('click', async () => {
      const h = active; if (!h || !h.pass) return;
      const base = fileBase(), kind = b.dataset.dl;
      try {
        if (kind === 'stl') await saveFile(base + '.stl', toSTL(h.geos));
        else if (kind === 'glb') await saveFile(base + '.glb', await toGLB(h.geos));
        else if (kind === 'py') await saveFile(base + '.py', h.code + '\ncq.exporters.export(result, "' + base + '.step")\n');
        else dlNote.textContent = 'STEP comes from the CadQuery backend. Download the .py and run it with CadQuery: its last line writes ' + base + '.step.';
      } catch (e) { dlNote.textContent = 'That export didn’t work in this browser.'; }
    }));
    routeHooks.push(r => { if (r === 'studio') { S.resize(); SR.resize(); } });
  }
  /* ===== Library: 8 family cards, one shared WebGL canvas drawn into each card ===== */
  const LIB = [
    { k: 'bearing', name: 'Flanged bearing mount', desc: 'A square flange with four bolt holes and a raised boss that holds a bearing.', dims: '48 × 48 × 18 mm',
      prompts: ['Flanged bearing mount 48 × 48 × 18 mm, 16 mm bore, 4 holes Ø5.5 mm', 'Bearing mount 60 × 60 × 20 mm, 20 mm bore, 4 holes Ø6.5 mm'] },
    { k: 'bracket', name: 'U-shaped sensor bracket', desc: 'Two side walls on a base, with a matching hole in each wall to hold a sensor.', dims: '50 × 30 × 35 mm',
      prompts: ['U sensor bracket 50 × 30 × 35 mm, 5 mm thick, Ø10 mm sensor hole', 'U bracket 40 × 25 × 30 mm, 4 mm thick, Ø8 mm sensor hole'] },
    { k: 'collar', name: 'Split shaft collar', desc: 'A ring that clamps onto a shaft. The split slot lets it tighten.', dims: '≈ 32 × 32 × 12 mm',
      prompts: ['Split shaft collar, 16 mm bore, 32 mm OD, 12 mm wide', 'Shaft collar, 10 mm bore, 24 mm OD, 9 mm wide'] },
    null, null, null, null, null,
  ];
  function initLibrary() {
    const grid = document.getElementById('libGrid');
    const views = LIB.map((f, i) => {
      const card = document.createElement('article'); card.className = 'lcard' + (f ? '' : ' placeholder');
      const view = document.createElement('div'); view.className = 'lview';
      const tag = document.createElement('span'); tag.textContent = 'FAMILY ' + String(i + 1).padStart(2, '0'); view.append(tag);
      const body = document.createElement('div'); body.className = 'lbody';
      const h = document.createElement('h3'); h.textContent = f ? f.name : 'Family name';
      const p = document.createElement('p'); p.textContent = f ? f.desc : 'Description to come.';
      const d = document.createElement('div'); d.className = 'dims'; d.textContent = f ? 'Typical: ' + f.dims : 'Typical size to come';
      body.append(h, p, d);
      if (f) { const ul = document.createElement('ul'); f.prompts.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); }); body.append(ul); }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (f ? '' : ' ghost') + ' sm';
      b.textContent = f ? 'Open in Studio' : 'Coming soon'; b.disabled = !f;
      if (f) b.addEventListener('click', () => openInStudio(f.prompts[0]));
      body.append(b);
      card.append(view, body); grid.append(card);
      const it = { view, hover: 0, over: false };
      card.addEventListener('pointerenter', () => { it.over = true; }); card.addEventListener('pointerleave', () => { it.over = false; });
      return it;
    });
    const canvas = document.getElementById('libCanvas');
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const GM = .036;
    views.forEach((it, i) => {
      const f = LIB[i], scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1.4, .1, 50);
      scene.add(new T.HemisphereLight(col('#cfe9ff'), col('#0a1628'), .9));
      const key = new T.DirectionalLight(col('#fff3e6'), 1.3); key.position.set(-4, 6, 6); scene.add(key);
      const rim = new T.DirectionalLight(col(C.cyan), .9); rim.position.set(5, 3, -5); scene.add(rim);
      const spin = new T.Group(); scene.add(spin);
      const disc = new T.Mesh(new T.CylinderGeometry(1.15, 1.2, .07, 64), std('#14284a', .6, .2)); disc.position.y = -.035; scene.add(disc);
      const ring = new T.Mesh(new T.TorusGeometry(1.17, .01, 6, 96), basic(C.cyan, { toneMapped: false })); ring.rotation.x = Math.PI / 2; scene.add(ring);
      if (f) { const p = makePart(f.k, metal(), .4); p.scale.setScalar(GM); spin.add(p); }
      else {
        const box = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.1, .8, 1.1)), new T.LineDashedMaterial({ color: col(C.cyan), dashSize: .06, gapSize: .05, transparent: true, opacity: .6 }));
        box.computeLineDistances(); box.position.y = .4; spin.add(box);
        const q = label('?', { h: .42, px: 60 }); q.position.y = .45; spin.add(q);
      }
      cam.position.set(0, 1.45, 4.3); cam.lookAt(0, .35, 0);
      Object.assign(it, { scene, cam, spin, rot: i * .8 });
    });
    const S = { canvas, renderer, visible: false };
    S.resize = () => renderer.setSize(innerWidth, innerHeight, false);
    S.update = dt => views.forEach(it => { it.hover = damp(it.hover, it.over ? 1 : 0, 8, dt); it.rot += dt * (reduce ? 0 : .35 + it.hover * 1.4); it.spin.rotation.y = it.rot; it.spin.position.y = it.hover * .08; });
    S.render = () => {
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
      const H = innerHeight;
      views.forEach(it => {
        const r = it.view.getBoundingClientRect();
        if (r.bottom < 0 || r.top > H || r.width < 2) return;
        const bottom = H - r.bottom;
        renderer.setViewport(r.left, bottom, r.width, r.height); renderer.setScissor(r.left, bottom, r.width, r.height);
        it.cam.aspect = r.width / r.height; it.cam.updateProjectionMatrix();
        renderer.render(it.scene, it.cam);
      });
    };
    S.resize(); stages.push(S);
    routeHooks.push(r => { S.visible = r === 'library'; });
    S.visible = currentRoute === 'library';
  }

  /* ===== About: the robot at the table with the team ===== */
  function initAbout() {
    const S = makeStage(document.getElementById('aboutCanvas'), 32), sc = S.scene;
    const top = new T.Mesh(new T.CylinderGeometry(1.7, 1.7, .1, 64), std('#162847', .7, .1)); top.position.y = .75; sc.add(top);
    const edge = new T.Mesh(new T.TorusGeometry(1.7, .018, 8, 96), basic(C.orange, { toneMapped: false })); edge.rotation.x = Math.PI / 2; edge.position.y = .8; sc.add(edge);
    const leg = new T.Mesh(new T.CylinderGeometry(.18, .35, .75, 24), std('#0f1d35', .7, .2)); leg.position.y = .37; sc.add(leg);
    const matTop = new T.Mesh(new T.CircleGeometry(1.55, 64), new T.MeshStandardMaterial({ map: MAT_TEX(), roughness: .9 })); matTop.rotation.x = -Math.PI / 2; matTop.position.y = .802; sc.add(matTop);
    const R = makeRobot(); { const a = 293 * Math.PI / 180, x = 2.2 * Math.cos(a), z = 2.2 * Math.sin(a); R.group.position.set(x, -.35, z); R.group.rotation.y = Math.atan2(-x, -z); } sc.add(R.group);
    const part = makePart('collar', metal()); part.scale.setScalar(.03); part.position.set(0, .8, .2); sc.add(part);
    const pawns = []; let avatar = null, alien = null, eagle = null;
    // Alreem's character: a cream bunny with an XR headset, working on a holographic computer
    function makeAvatar(g) {
      const fur = std('#f2cfa2', .7, 0), inner = std('#ee8a86', .7, 0), blush = std('#f3a6a6', .8, 0, { transparent: true, opacity: .75 });
      const dark = std('#1c2a44', .45, .3), gold = std('#f2a43a', .4, .1, { emissive: col('#f2a43a'), emissiveIntensity: .2 });
      const glow = basic(C.cyan, { toneMapped: false });
      const body = new T.Mesh(new T.CylinderGeometry(.25, .4, 1.0, 40), fur); body.position.y = .93; g.add(body);
      const head = new T.Group(); head.position.y = 1.74; g.add(head);
      const skull = new T.Mesh(new T.SphereGeometry(.3, 40, 28), fur); skull.scale.set(1, .95, .95); head.add(skull);
      [-1, 1].forEach(s => {
        const eye = new T.Mesh(new T.SphereGeometry(.03, 16, 12), dark); eye.scale.set(1, 1.3, .6); eye.position.set(s * .1, -.01, .27); head.add(eye);
        const cheek = new T.Mesh(new T.CircleGeometry(.05, 24), blush); cheek.position.set(s * .17, -.08, .235); cheek.rotation.y = s * .55; head.add(cheek);
      });
      const smile = new T.Mesh(new T.TorusGeometry(.035, .009, 8, 20, Math.PI), dark); smile.rotation.z = Math.PI; smile.position.set(0, -.08, .282); head.add(smile);
      // ears (matching the character sheet): long, wide paddles splayed into a V; viewer's left ear stands up, viewer's right ear folds outward halfway
      const ears = [-1, 1].map(s => {
        const ear = new T.Group(); ear.position.set(s * .14, .2, -.02); ear.rotation.set(-.08, 0, -s * .3); head.add(ear);
        const low = new T.Mesh(new T.SphereGeometry(.1, 28, 18), fur); low.scale.set(1.3, 2.2, .42); low.position.y = .2; ear.add(low);
        const lowIn = new T.Mesh(new T.SphereGeometry(.068, 24, 16), inner); lowIn.scale.set(1.3, 2.3, .3); lowIn.position.set(0, .2, .03); ear.add(lowIn);
        const tip = new T.Group(); tip.position.y = .36; ear.add(tip);
        if (s > 0) tip.rotation.set(.1, 0, -1.2); else tip.rotation.z = .05;
        const up = new T.Mesh(new T.SphereGeometry(.1, 28, 18), fur); up.scale.set(1.3, 1.75, .42); up.position.y = .13; tip.add(up);
        const upIn = new T.Mesh(new T.SphereGeometry(.066, 24, 16), inner); upIn.scale.set(1.3, 1.8, .3); upIn.position.set(0, .12, .03); tip.add(upIn);
        return ear;
      });
      // XR headset pushed up on the forehead
      const strap = new T.Mesh(new T.TorusGeometry(.3, .028, 10, 56), dark); strap.rotation.x = Math.PI / 2 - .35; strap.position.y = .13; head.add(strap);
      const hs = rbox(.4, .12, .14, .04, dark); hs.position.set(0, .2, .22); hs.rotation.x = -.45; head.add(hs);
      const hsGlow = new T.Mesh(new T.PlaneGeometry(.32, .045), glow); hsGlow.position.set(0, .215, .295); hsGlow.rotation.x = -.45; head.add(hsGlow);
      const collar = new T.Mesh(new T.TorusGeometry(.26, .04, 12, 44), gold); collar.rotation.x = Math.PI / 2; collar.position.y = 1.43; g.add(collar);
      const tail = new T.Mesh(new T.SphereGeometry(.1, 16, 12), fur); tail.position.set(0, .55, -.4); g.add(tail);
      const arms = [-1, 1].map(s => {
        const sh = new T.Group(); sh.position.set(s * .3, 1.33, 0); g.add(sh);
        const arm = new T.Mesh(new T.CylinderGeometry(.06, .055, .4, 16), fur); arm.position.y = -.2; sh.add(arm);
        const hand = new T.Mesh(new T.SphereGeometry(.068, 16, 12), fur); hand.position.y = -.41; sh.add(hand);
        return sh;
      });
      // holographic computer in front of her: floating screen + light keyboard on the table
      const sc2 = document.createElement('canvas'); sc2.width = 384; sc2.height = 240;
      const sx = sc2.getContext('2d'), stex = new T.CanvasTexture(sc2);
      const holoMat = new T.MeshBasicMaterial({ map: stex, transparent: true, opacity: .9, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      const screen = new T.Mesh(new T.PlaneGeometry(.78, .49), holoMat); screen.position.set(.48, 1.52, .6); screen.rotation.set(-.15, -.6, 0); g.add(screen);
      const frame = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(.78, .49)), new T.LineBasicMaterial({ color: col(C.cyan), transparent: true, opacity: .9 }));
      screen.add(frame);
      const kb = new T.Mesh(new T.PlaneGeometry(.56, .2), basic(C.cyan, { transparent: true, opacity: .28, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide }));
      kb.rotation.set(-Math.PI / 2, 0, .5); kb.position.set(.3, .812, .62); g.add(kb);
      const kbEdge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(.56, .2)), new T.LineBasicMaterial({ color: col(C.cyan) }));
      kbEdge.rotation.copy(kb.rotation); kbEdge.position.copy(kb.position); g.add(kbEdge);
      function drawScreen(t) {
        const x = sx, W = 384, H = 240;
        x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(20,70,110,.35)'; x.fillRect(0, 0, W, H);
        x.strokeStyle = 'rgba(94,214,255,.25)'; x.lineWidth = 1;
        for (let i = 0; i < W; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
        for (let j = 0; j < H; j += 24) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
        x.strokeStyle = '#5ed6ff'; x.lineWidth = 3;
        x.beginPath(); x.arc(250, 120, 62, t, t + Math.PI * 1.6); x.stroke();
        x.beginPath(); x.arc(250, 120, 30, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = '#ff8a2a'; x.beginPath(); x.moveTo(170, 196); x.lineTo(330, 196); x.stroke();
        x.fillStyle = '#5ed6ff';
        for (let k = 0; k < 5; k++) x.fillRect(22, 32 + k * 30, 40 + 60 * (.5 + .5 * Math.sin(t * 1.7 + k)), 9);
        x.fillStyle = 'rgba(255,138,42,.9)'; x.fillRect(22, 32 + ((Math.floor(t * 2) % 5) * 30), 6, 9);
        stex.needsUpdate = true;
      }
      const tag = label('Alreem', { border: C.orange, h: .22 }); tag.position.set(-.25, 2.55, 0); g.add(tag);
      return { head, arms, ears, screen, drawScreen };
    }
    // Ghaida's character: a friendly mint-green alien typing on her laptop
    function makeAlien(g) {
      const skin = std('#7fd6a4', .55, 0), belly = std('#c9f2d8', .6, 0), dark = std('#121d33', .25, .2);
      const glowO = std(C.orange, .4, 0, { emissive: col(C.orange), emissiveIntensity: .9 });
      const body = new T.Mesh(new T.CylinderGeometry(.25, .4, 1.0, 40), skin); body.position.y = .93; g.add(body);
      const head = new T.Group(); head.position.y = 1.74; g.add(head);
      const skull = new T.Mesh(new T.SphereGeometry(.31, 40, 28), skin); skull.scale.set(1.12, .98, .95); head.add(skull);
      const chin = new T.Mesh(new T.SphereGeometry(.2, 32, 20), skin); chin.scale.set(.9, .7, .85); chin.position.set(0, -.18, .07); head.add(chin);
      const eyes = [-1, 1].map(s => {
        const eg = new T.Group(); eg.position.set(s * .125, .03, .262); eg.rotation.set(0, s * .3, -s * .38); head.add(eg);
        const eye = new T.Mesh(new T.SphereGeometry(.08, 28, 20), dark); eye.scale.set(1, 1.55, .5); eg.add(eye);
        const glint = new T.Mesh(new T.SphereGeometry(.018, 12, 8), basic('#ffffff')); glint.position.set(.025, .05, .04); eg.add(glint);
        const glint2 = new T.Mesh(new T.SphereGeometry(.009, 10, 6), basic('#ffffff')); glint2.position.set(-.02, -.045, .04); eg.add(glint2);
        return eg;
      });
      const smile = new T.Mesh(new T.TorusGeometry(.04, .009, 8, 20, Math.PI), dark); smile.rotation.z = Math.PI; smile.position.set(0, -.15, .29); head.add(smile);
      [-1, 1].forEach(s => { const c = new T.Mesh(new T.CircleGeometry(.04, 20), std('#f5a3b5', .8, 0, { transparent: true, opacity: .7 })); c.position.set(s * .2, -.1, .23); c.rotation.y = s * .6; head.add(c); });
      const antennae = [-1, 1].map(s => {
        const a = new T.Group(); a.position.set(s * .1, .26, 0); a.rotation.z = -s * .35; head.add(a);
        const stalk = new T.Mesh(new T.CylinderGeometry(.012, .018, .26, 10), skin); stalk.position.y = .13; a.add(stalk);
        const bulb = new T.Mesh(new T.SphereGeometry(.045, 20, 14), glowO); bulb.position.y = .28; a.add(bulb);
        return a;
      });
      const patch = new T.Mesh(new T.SphereGeometry(.2, 28, 18), belly); patch.scale.set(1, 1.3, .3); patch.position.set(0, .82, .3); g.add(patch);
      const collar = new T.Mesh(new T.TorusGeometry(.26, .035, 12, 44), basic(C.cyan, { toneMapped: false })); collar.rotation.x = Math.PI / 2; collar.position.y = 1.43; g.add(collar);
      const arms = [-1, 1].map(s => {
        const sh = new T.Group(); sh.position.set(s * .3, 1.33, 0); g.add(sh);
        const arm = new T.Mesh(new T.CylinderGeometry(.055, .05, .4, 16), skin); arm.position.y = -.2; sh.add(arm);
        const hand = new T.Mesh(new T.SphereGeometry(.062, 16, 12), skin); hand.position.y = -.41; sh.add(hand);
        return sh;
      });
      // laptop on the table, screen facing her
      const lap = new T.Group(); lap.position.set(0, .805, .58); g.add(lap);
      const shell = std('#2a3a55', .35, .5);
      const base = rbox(.46, .32, .025, .03, shell); base.rotation.x = -Math.PI / 2; base.position.y = .013; lap.add(base);
      const keys = new T.Mesh(new T.PlaneGeometry(.38, .14), std('#16223a', .6, .1)); keys.rotation.x = -Math.PI / 2; keys.position.set(0, .027, -.03); lap.add(keys);
      const hinge = new T.Group(); hinge.position.set(0, .02, .15); hinge.rotation.x = .28; lap.add(hinge);
      const lid = rbox(.46, .3, .018, .03, shell); lid.position.y = .15; hinge.add(lid);
      const lc = document.createElement('canvas'); lc.width = 256; lc.height = 168;
      const lx = lc.getContext('2d'), ltex = new T.CanvasTexture(lc); ltex.encoding = T.sRGBEncoding;
      const scr = new T.Mesh(new T.PlaneGeometry(.42, .26), new T.MeshBasicMaterial({ map: ltex, toneMapped: false }));
      scr.position.set(0, .15, -.011); scr.rotation.y = Math.PI; hinge.add(scr);
      const logo = new T.Mesh(new T.CircleGeometry(.03, 20), basic(C.cyan, { toneMapped: false })); logo.position.set(0, .15, .011); hinge.add(logo);
      const lines = [40, 120, 80, 150, 60, 110, 90];
      function drawLaptop(t) {
        lx.fillStyle = '#071427'; lx.fillRect(0, 0, 256, 168);
        const off = Math.floor(t * 1.5) % lines.length;
        for (let k = 0; k < 7; k++) {
          const w = lines[(k + off) % lines.length];
          lx.fillStyle = k % 3 === 0 ? '#ff8a2a' : '#5ed6ff'; lx.globalAlpha = .85;
          lx.fillRect(16 + (k % 2) * 16, 16 + k * 20, k === 6 ? w * ((t * 2) % 1) : w, 8);
        }
        lx.globalAlpha = 1;
        if (Math.floor(t * 2) % 2) { lx.fillStyle = '#e8f1fb'; lx.fillRect(16, 150, 8, 10); }
        ltex.needsUpdate = true;
      }
      const tag = label('Ghaida', { border: C.cyan, h: .22 }); tag.position.y = 2.42; g.add(tag);
      return { head, arms, eyes, antennae, drawLaptop };
    }
    // Fahad's character: a bald eagle watching his desktop 3D printer build a part
    function makeEagle(g) {
      const brown = std('#6b4a2f', .7, 0), feather = std('#4a3220', .7, 0), white = std('#f4efe4', .65, 0), cream = std('#e2d6bf', .7, 0);
      const gold = std('#f2b33a', .4, .05), dark = std('#1a1410', .3, .2);
      const body = new T.Mesh(new T.CylinderGeometry(.25, .4, 1.0, 40), brown); body.position.y = .93; g.add(body);
      const head = new T.Group(); head.position.y = 1.72; g.add(head);
      const skull = new T.Mesh(new T.SphereGeometry(.3, 40, 28), white); skull.scale.set(1, .95, 1); head.add(skull);
      // amber eyes under a low brow, the eagle's look
      const eyes = [-1, 1].map(s => {
        const eg = new T.Group(); eg.position.set(s * .12, .03, .255); eg.rotation.y = s * .35; head.add(eg);
        const iris = new T.Mesh(new T.SphereGeometry(.055, 24, 16), std('#f2c14e', .35, 0)); iris.scale.z = .5; eg.add(iris);
        const pupil = new T.Mesh(new T.SphereGeometry(.03, 16, 12), dark); pupil.position.z = .022; eg.add(pupil);
        const glint = new T.Mesh(new T.SphereGeometry(.011, 10, 6), basic('#ffffff')); glint.position.set(.015, .018, .04); eg.add(glint);
        const brow = new T.Mesh(new T.SphereGeometry(.08, 20, 12), cream); brow.scale.set(1.1, .26, .6); brow.position.set(s * .13, .115, .23); brow.rotation.z = s * .12; head.add(brow);
        return eg;
      });
      // hooked beak: cere, upper bill pointing forward, hook curling down at the tip
      const cere = new T.Mesh(new T.SphereGeometry(.075, 24, 16), gold); cere.scale.set(1, .8, 1); cere.position.set(0, -.04, .26); head.add(cere);
      const bill = new T.Mesh(new T.ConeGeometry(.06, .16, 24), gold); bill.rotation.x = Math.PI / 2; bill.position.set(0, -.05, .36); head.add(bill);
      const hook = new T.Mesh(new T.ConeGeometry(.028, .08, 16), gold); hook.rotation.x = Math.PI; hook.position.set(0, -.09, .43); head.add(hook);
      [-1, 0, 1].forEach(k => { const f = new T.Mesh(new T.ConeGeometry(.035, .14, 12), white); f.position.set(k * .07, .22, -.17); f.rotation.set(-.9, 0, k * .3); head.add(f); });
      const ruff = new T.Mesh(new T.TorusGeometry(.26, .06, 12, 44), white); ruff.rotation.x = Math.PI / 2; ruff.position.y = 1.43; g.add(ruff);
      const wings = [-1, 1].map(s => {
        const sh = new T.Group(); sh.position.set(s * .3, 1.33, 0); g.add(sh);
        const wing = new T.Mesh(new T.SphereGeometry(.13, 24, 16), brown); wing.scale.set(.45, 2.1, 1.2); wing.position.y = -.24; sh.add(wing);
        [-1, 0, 1].forEach(k => { const f = new T.Mesh(new T.SphereGeometry(.05, 12, 8), feather); f.scale.set(.5, 2, .9); f.position.set(0, -.5, k * .06); f.rotation.x = k * .3; sh.add(f); });
        return sh;
      });
      // desktop 3D printer on the table; the carriage rises one layer at a time
      const pr = new T.Group(); pr.position.set(0, .805, .82); pr.scale.setScalar(1.35); g.add(pr);
      const frameM = std('#2a3a55', .4, .5);
      const base = new T.Mesh(new T.BoxGeometry(.42, .04, .34), frameM); base.position.y = .02; pr.add(base);
      const bed = new T.Mesh(new T.BoxGeometry(.3, .012, .26), std('#16294a', .5, .3)); bed.position.y = .046; pr.add(bed);
      [-1, 1].forEach(s => { const post = new T.Mesh(new T.BoxGeometry(.03, .42, .03), frameM); post.position.set(s * .19, .23, -.12); pr.add(post); });
      const car = new T.Group(); pr.add(car);
      const bar = new T.Mesh(new T.BoxGeometry(.41, .025, .025), frameM); bar.position.z = -.12; car.add(bar);
      const nz = new T.Group(); car.add(nz);
      const arm = new T.Mesh(new T.BoxGeometry(.02, .02, .13), frameM); arm.position.z = -.06; nz.add(arm);
      const block = new T.Mesh(new T.BoxGeometry(.05, .045, .05), std(C.orange, .45, 0, { emissive: col(C.orange), emissiveIntensity: .35 })); nz.add(block);
      const tip = new T.Mesh(new T.ConeGeometry(.015, .035, 12), basic('#ffd27a', { toneMapped: false })); tip.rotation.x = Math.PI; tip.position.y = -.04; nz.add(tip);
      const PS = .006, printed = makePart('collar', metal(), .5); printed.position.y = .052; pr.add(printed);
      function print(t) {
        const c = t % 6.5, k = Math.min(1, c / 5);
        printed.scale.set(PS, PS * Math.max(k, .002), PS);
        car.position.y = .052 + DIMS.collar[1] * PS * k + .058;
        nz.position.x = c < 5 ? .085 * Math.sin(t * 6) : 0;
      }
      const tag = label('Fahad', { border: '#f2b33a', h: .22 }); tag.position.y = 2.42; g.add(tag);
      return { head, wings, eyes, nz, print };
    }
    [200, 247, 340].forEach((deg, i) => {
      const a = deg * Math.PI / 180, x = 2.25 * Math.cos(a), z = 2.25 * Math.sin(a);
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); sc.add(g);
      const chair = rbox(.8, 1.3, .12, .1, std('#1d2e49', .6, .2)); chair.position.set(0, .9, -.42); g.add(chair);
      if (i === 0) { g.rotation.y -= .55; avatar = makeAvatar(g); pawns.push(g); return; }
      if (i === 1) { g.rotation.y -= .2; alien = makeAlien(g); pawns.push(g); return; }
      g.rotation.y += .3; eagle = makeEagle(g); pawns.push(g);
    });
    S.onResize = (w, h) => {
      const cam = S.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      const z = Math.max(5.2 / (2 * tanH * asp), 3.2 / (2 * tanH)) - .2;
      cam.position.set(0, 1.0 + z * .42, z); cam.lookAt(0, 1.0, -.6);
    };
    S.update = (dt, t) => {
      const cyc = t % 7, waving = !reduce && cyc < 2.2;
      R.pose([-.2, -.15, -.3, 0], waving ? [-.15, 2.45, 0, .5 * Math.sin(t * 9)] : [-.3, .2, -.5, 0]);
      aimHead(S, R, t, null); R.vis.text = 'THE TEAM'; R.update(dt, t);
      pawns.forEach((p, i) => { p.children[2].position.y = (i === 0 ? 1.74 : 1.72) + (reduce ? 0 : .025 * Math.sin(t * 1.6 + i)); });
      if (alien) {
        alien.head.rotation.x = damp(alien.head.rotation.x, .06, 4, dt);
        alien.head.rotation.y = damp(alien.head.rotation.y, clamp((ptr.x / innerWidth - .5) * .4, -.25, .25), 4, dt);
        alien.arms.forEach((a, k) => { a.rotation.x = damp(a.rotation.x, -1.05 + (reduce ? 0 : Math.max(0, Math.sin(t * 9 + k * 1.7)) * .12), 12, dt); a.rotation.z = damp(a.rotation.z, k ? -.18 : .18, 6, dt); });
        const blink = reduce ? 1 : (t % 4.3 < .12 ? .15 : 1);
        alien.eyes.forEach(e => { e.scale.y = blink; });
        alien.antennae.forEach((a, k) => { a.rotation.x = reduce ? 0 : .12 * Math.sin(t * 2.2 + k); });
        alien.drawLaptop(reduce ? 0 : t);
      }
      if (eagle) {
        // watches the nozzle, tilts his head like a bird, flaps every few seconds
        eagle.head.rotation.y = damp(eagle.head.rotation.y, clamp((ptr.x / innerWidth - .5) * .4, -.25, .25) + eagle.nz.position.x * 1.5, 4, dt);
        eagle.head.rotation.x = damp(eagle.head.rotation.x, .22, 4, dt);
        eagle.head.rotation.z = damp(eagle.head.rotation.z, !reduce && t % 3.7 < 1.1 ? .22 : 0, 10, dt);
        const ft = t % 6, flap = reduce || ft > 1.2 ? 0 : Math.sin(ft / 1.2 * Math.PI * 3) ** 2 * .7;
        eagle.wings.forEach((w, k) => { w.rotation.z = damp(w.rotation.z, (k ? 1 : -1) * (.12 + flap), 14, dt); w.rotation.x = damp(w.rotation.x, -.15, 6, dt); });
        const blink = reduce ? 1 : (t % 5.1 < .12 ? .15 : 1);
        eagle.eyes.forEach(e => { e.scale.y = blink; });
        eagle.print(reduce ? 4 : t);
      }
      if (avatar) {
        const look = clamp((ptr.x / innerWidth - .5) * .5, -.3, .3);
        avatar.head.rotation.y = damp(avatar.head.rotation.y, look, 4, dt);
        avatar.head.rotation.x = damp(avatar.head.rotation.x, .12, 4, dt);
        const tap = reduce ? 0 : Math.max(0, Math.sin(t * 5)) * .12;
        avatar.arms[1].rotation.x = damp(avatar.arms[1].rotation.x, -1.45 + tap, 10, dt);
        avatar.arms[1].rotation.z = damp(avatar.arms[1].rotation.z, -.25, 6, dt);
        avatar.arms[0].rotation.x = damp(avatar.arms[0].rotation.x, -1.0 + (reduce ? 0 : Math.max(0, Math.sin(t * 6 + 1.3)) * .1), 10, dt);
        avatar.arms[0].rotation.z = damp(avatar.arms[0].rotation.z, .2, 6, dt);
        avatar.ears.forEach((e, i) => { e.rotation.x = -.08 + (reduce ? 0 : .1 * Math.max(0, Math.sin(t * 2.3 + i * .6)) ** 8); });
        avatar.screen.position.y = 1.52 + (reduce ? 0 : .015 * Math.sin(t * 1.4));
        avatar.drawScreen(reduce ? 0 : t);
      }
      part.rotation.y = reduce ? .4 : t * .4;
    };
    S.resize();
  }

  /* ===== Prompt guide: the robot scores your prompt ===== */
  function initGuide() {
    const S = makeStage(document.getElementById('guideCanvas'), 30);
    const b = makeBench(3.2, 1.8, MAT_TEX()); S.scene.add(b);
    const R = makeRobot(); R.group.position.set(-.2, 0, -.2); R.group.rotation.y = -.2; S.scene.add(R.group);
    S.camera.position.set(.2, 2.6, 6.2); S.camera.lookAt(-.1, 1.35, 0);
    S.update = (dt, t) => {
      const v = R.vis; v.big = null; v.bigColor = null; v.textColor = null; v.squint = 0; R.roll = 0;
      let L = [-.55, -.15, -1.15, 0], Ra = [-.15, .12, -.25, 0];
      if (guide.typed) {
        v.big = guide.score + ' / 5'; v.text = guide.score === 5 ? 'READY TO BUILD' : guide.score >= 3 ? 'ALMOST' : 'TOO VAGUE';
        if (guide.score === 5) { Ra = [-2.4, .25, -.6, 0]; v.squint = .45; }
        else if (guide.score <= 1) { L = [-.3, -.6, -1.25, 0]; Ra = [-.3, .6, -1.25, 0]; R.roll = .2; v.bigColor = C.orange; v.textColor = C.orange; }
      } else v.text = 'TYPE A PROMPT';
      R.pose(L, Ra); aimHead(S, R, t, null); R.update(dt, t);
    };
    S.resize();
  }

  /* ===== 404: the robot squints at a part that came out at 0.0188 scale ===== */
  function initNotFound() {
    const S = makeStage(document.getElementById('nfCanvas'), 30);
    const b = makeBench(3.6, 2, MAT_TEX()); S.scene.add(b);
    const R = makeRobot(); R.group.position.set(0, 0, -.2); S.scene.add(R.group);
    R.mag.scale.setScalar(1); R.calSlider.parent.visible = false;
    const tiny = makePart('plate', metal()); tiny.scale.setScalar(MM * .0188 * 8); tiny.position.set(0, -.2, .02); R.arms.L.hand.add(tiny);
    const ringM = basic(C.orange, { transparent: true, toneMapped: false });
    const ring = new T.Mesh(new T.TorusGeometry(.09, .006, 8, 40), ringM); ring.position.set(0, -.2, 0); R.arms.L.hand.add(ring);
    const cap = label('0.0188 ×', { border: C.orange, h: .2 }); S.scene.add(cap);
    S.onResize = (w, h) => {
      const cam = S.camera, asp = w / h, tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
      const z = Math.max(3.4 / (2 * tanH * asp), 3.2 / (2 * tanH)) + .8;
      cam.position.set(.4, 1.3 + z * .2, z); cam.lookAt(0, 1.3, 0);
    };
    S.update = (dt, t) => {
      const v = R.vis; v.big = '0.0188'; v.bigColor = C.orange; v.text = 'WHERE IS IT?'; v.textColor = C.orange; v.squint = .55;
      R.pose([-1.05, -.25, -.85, 0], [-1.3, .45, -1.05, 0]);
      R.arms.L.hand.getWorldPosition(tmpV);
      cap.position.set(tmpV.x - .45, tmpV.y + .25, tmpV.z + .2);
      aimHead(S, R, t, tmpV.clone(), .75); R.update(dt, t);
      ring.scale.setScalar(1 + .25 * Math.sin(t * 6)); ringM.opacity = .55 + .45 * Math.sin(t * 6);
    };
    S.resize();
  }
  routeHooks.push(() => requestAnimationFrame(() => stages.forEach(s => s.resize())));
  let booted = false;
  function init() {
    if (booted) return; booted = true;
    initLanding(); initStudio(); initLibrary(); initAbout(); initGuide(); initNotFound();
    startLoop();
  }
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([Promise.all([document.fonts.load('600 40px "IBM Plex Mono"'), document.fonts.load('500 26px "IBM Plex Mono"')]), new Promise(r => setTimeout(r, 1800))])
    : Promise.resolve();
  fontsReady.then(init, init);
})();
